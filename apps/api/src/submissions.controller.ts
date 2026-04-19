import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  ServiceUnavailableException
} from "@nestjs/common";
import { normalizeCustomTestCases, runCustomTestCases } from "./custom-test-runner";
import { query } from "./db";
import { JudgeQueueService } from "./judge-queue.service";
import { CodeMode, Language, ModeSupport, SubmissionStatus } from "./types";

type CreateSubmissionBody = {
  problemSlug?: string;
  language?: Language;
  mode?: CodeMode;
  code?: string;
};

type RunCustomTestsBody = CreateSubmissionBody & {
  testCases?: unknown;
};

type ProblemLookupRow = {
  id: string;
  slug: string;
  modeSupport: ModeSupport;
};

type CountRow = {
  totalCount: string;
};

type SubmissionRow = {
  id: string;
  problemSlug: string;
  language: Language;
  mode: CodeMode;
  code: string;
  status: SubmissionStatus;
  runtimeMs: number | null;
  memoryKb: number | null;
  passedCount: number;
  totalCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  failureCase?: SubmissionFailureCase | null;
};

type SubmissionHistoryRow = Omit<SubmissionRow, "code">;

type UserRow = {
  id: string;
};

type SubmissionFailureCase = {
  status: SubmissionStatus;
  isHidden: boolean;
  inputData: string;
  actualOutput: string | null;
  expectedOutput: string;
  stderr: string | null;
};

type SubmissionFailureCaseRow = {
  status: SubmissionStatus;
  isHidden: boolean;
  inputData: string;
  actualOutput: string | null;
  expectedOutput: string;
  stderr: string | null;
};

type ReplayAiMessage = {
  content: string;
  createdAt: string;
  sessionId: string;
  source: string | null;
  provider: string | null;
};

type ReplayAiMessageRow = {
  content: string;
  createdAt: string;
  sessionId: string;
  source: string | null;
  provider: string | null;
};

const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL ?? "demo@leetcodepro.local";

function inferActualOutputFromStderr(stderr: string | null): string | null {
  if (!stderr) {
    return null;
  }

  const trimmed = stderr.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const matched = trimmed.match(/^Expected\s+([\s\S]*?),\s+got\s+([\s\S]*)$/);
  if (!matched) {
    return null;
  }

  const got = matched[2]?.trim() ?? "";
  return got.length > 0 ? got : null;
}

@Controller("submissions")
export class SubmissionsController {
  constructor(private readonly judgeQueueService: JudgeQueueService) {}

  @Post("run-tests")
  async runCustomTests(@Body() body: RunCustomTestsBody) {
    if (!body.problemSlug || !body.language || !body.mode || !body.code) {
      throw new BadRequestException("Missing required fields: problemSlug, language, mode, code");
    }

    const problem = await this.loadProblem(body.problemSlug);
    if (!this.isModeSupported(body.mode, problem.modeSupport)) {
      throw new BadRequestException(`Problem ${body.problemSlug} does not support mode ${body.mode}`);
    }

    const normalizedCases = normalizeCustomTestCases(body.testCases);
    const result = await runCustomTestCases(
      {
        problemSlug: problem.slug,
        language: body.language,
        mode: body.mode,
        code: body.code
      },
      normalizedCases
    );

    return {
      item: {
        ...result,
        problemSlug: problem.slug,
        language: body.language,
        mode: body.mode,
        executedAt: new Date().toISOString()
      }
    };
  }

  @Post()
  async createSubmission(@Body() body: CreateSubmissionBody) {
    if (!body.problemSlug || !body.language || !body.mode || !body.code) {
      throw new BadRequestException("Missing required fields: problemSlug, language, mode, code");
    }

    const problem = await this.loadProblem(body.problemSlug);
    if (!this.isModeSupported(body.mode, problem.modeSupport)) {
      throw new BadRequestException(`Problem ${body.problemSlug} does not support mode ${body.mode}`);
    }

    const userId = await this.getOrCreateDemoUserId();
    const totalCasesResult = await query<CountRow>(
      "SELECT COUNT(*)::text AS \"totalCount\" FROM test_cases WHERE problem_id = $1;",
      [problem.id]
    );
    const totalCount = Number(totalCasesResult.rows[0]?.totalCount ?? "0");

    const submissionResult = await query<SubmissionRow>(
      `
        INSERT INTO submissions(
          user_id,
          problem_id,
          language,
          mode,
          code,
          status,
          total_count
        )
        VALUES($1, $2, $3, $4, $5, 'QUEUED', $6)
        RETURNING
          id,
          $7::text AS "problemSlug",
          language,
          mode,
          code,
          status,
          runtime_ms AS "runtimeMs",
          memory_kb AS "memoryKb",
          passed_count AS "passedCount",
          total_count AS "totalCount",
          error_message AS "errorMessage",
          created_at::text AS "createdAt",
          updated_at::text AS "updatedAt";
      `,
      [userId, problem.id, body.language, body.mode, body.code, totalCount, problem.slug]
    );

    const submission = submissionResult.rows[0];

    try {
      await this.judgeQueueService.enqueueSubmission({
        submissionId: submission.id
      });
    } catch {
      await query(
        `
          UPDATE submissions
          SET
            status = 'RE',
            error_message = $2,
            updated_at = NOW()
          WHERE id = $1;
        `,
        [submission.id, "判题队列暂时不可用，请稍后重试。"]
      );

      throw new ServiceUnavailableException("Judge queue unavailable, please retry.");
    }

    return {
      item: submission
    };
  }

  @Get(":id")
  async getSubmission(@Param("id") id: string) {
    const submission = await this.loadSubmissionWithFailureCase(id);

    return {
      item: {
        ...submission
      }
    };
  }

  @Get(":id/replay")
  async getSubmissionReplay(@Param("id") id: string) {
    const submission = await this.loadSubmissionWithFailureCase(id);
    const [review, solution] = await Promise.all([
      this.loadLatestReplayAiMessage(id, "review"),
      this.loadLatestReplayAiMessage(id, "solution")
    ]);

    return {
      submission,
      ai: {
        review,
        solution
      }
    };
  }

  @Get("history/by-problem/:problemSlug")
  async listSubmissionHistory(@Param("problemSlug") problemSlug: string) {
    const userId = await this.getOrCreateDemoUserId();

    const result = await query<SubmissionHistoryRow>(
      `
        SELECT
          submissions.id,
          problems.slug AS "problemSlug",
          submissions.language,
          submissions.mode,
          submissions.status,
          submissions.runtime_ms AS "runtimeMs",
          submissions.memory_kb AS "memoryKb",
          submissions.passed_count AS "passedCount",
          submissions.total_count AS "totalCount",
          submissions.error_message AS "errorMessage",
          submissions.created_at::text AS "createdAt",
          submissions.updated_at::text AS "updatedAt"
        FROM submissions
        INNER JOIN problems ON problems.id = submissions.problem_id
        WHERE submissions.user_id = $1
          AND problems.slug = $2
        ORDER BY submissions.created_at DESC
        LIMIT 30;
      `,
      [userId, problemSlug]
    );

    return {
      items: result.rows
    };
  }

  private isModeSupported(mode: CodeMode, modeSupport: ModeSupport): boolean {
    if (modeSupport === "BOTH") {
      return true;
    }

    if (modeSupport === "CORE" && mode === "core") {
      return true;
    }

    return modeSupport === "ACM" && mode === "acm";
  }

  private async loadProblem(problemSlug: string): Promise<ProblemLookupRow> {
    const problemResult = await query<ProblemLookupRow>(
      `
        SELECT
          id,
          slug,
          mode_support AS "modeSupport"
        FROM problems
        WHERE slug = $1
        LIMIT 1;
      `,
      [problemSlug]
    );

    const problem = problemResult.rows[0];
    if (!problem) {
      throw new BadRequestException("Invalid problemSlug");
    }

    return problem;
  }

  private async getOrCreateDemoUserId(): Promise<string> {
    const userResult = await query<UserRow>(
      `
        INSERT INTO users(email, password_hash, nickname)
        VALUES ($1, $2, $3)
        ON CONFLICT (email) DO UPDATE
          SET updated_at = NOW()
        RETURNING id;
      `,
      [DEMO_USER_EMAIL, "demo-password-not-used", "Demo User"]
    );

    return userResult.rows[0].id;
  }

  private async loadFailureCase(submissionId: string): Promise<SubmissionFailureCase | null> {
    const result = await query<SubmissionFailureCaseRow>(
      `
        SELECT
          scr.status,
          tc.is_hidden AS "isHidden",
          tc.input_data AS "inputData",
          scr.actual_output AS "actualOutput",
          tc.expected_output AS "expectedOutput",
          scr.stderr
        FROM submission_case_results scr
        INNER JOIN test_cases tc ON tc.id = scr.case_id
        WHERE scr.submission_id = $1
          AND scr.status <> 'AC'
        ORDER BY tc.is_hidden ASC, scr.id ASC
        LIMIT 1;
      `,
      [submissionId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      ...row,
      actualOutput: row.actualOutput ?? inferActualOutputFromStderr(row.stderr)
    };
  }

  private async loadSubmissionWithFailureCase(id: string): Promise<SubmissionRow & { failureCase: SubmissionFailureCase | null }> {
    const submissionResult = await query<SubmissionRow>(
      `
        SELECT
          submissions.id,
          problems.slug AS "problemSlug",
          submissions.language,
          submissions.mode,
          submissions.code,
          submissions.status,
          submissions.runtime_ms AS "runtimeMs",
          submissions.memory_kb AS "memoryKb",
          submissions.passed_count AS "passedCount",
          submissions.total_count AS "totalCount",
          submissions.error_message AS "errorMessage",
          submissions.created_at::text AS "createdAt",
          submissions.updated_at::text AS "updatedAt"
        FROM submissions
        INNER JOIN problems ON problems.id = submissions.problem_id
        WHERE submissions.id = $1
        LIMIT 1;
      `,
      [id]
    );

    const submission = submissionResult.rows[0];
    if (!submission) {
      throw new NotFoundException("Submission not found");
    }

    let failureCase: SubmissionFailureCase | null = null;
    if (submission.status !== "QUEUED" && submission.status !== "RUNNING" && submission.status !== "AC") {
      failureCase = await this.loadFailureCase(submission.id);
    }

    return {
      ...submission,
      failureCase
    };
  }

  private async loadLatestReplayAiMessage(
    submissionId: string,
    messageType: "review" | "solution"
  ): Promise<ReplayAiMessage | null> {
    const typeFilter =
      messageType === "solution"
        ? "AND am.token_usage->>'type' = 'solution'"
        : "AND (am.token_usage->>'type' IS NULL OR am.token_usage->>'type' NOT IN ('solution', 'solution-error'))";

    const result = await query<ReplayAiMessageRow>(
      `
        SELECT
          am.content,
          am.created_at::text AS "createdAt",
          am.session_id AS "sessionId",
          am.token_usage->>'source' AS source,
          am.token_usage->>'provider' AS provider
        FROM ai_messages am
        INNER JOIN ai_sessions s ON s.id = am.session_id
        WHERE s.context_submission_id = $1
          AND am.role = 'assistant'
          ${typeFilter}
        ORDER BY am.created_at DESC
        LIMIT 1;
      `,
      [submissionId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    const source = row.source?.trim();
    const provider = row.provider?.trim();
    return {
      content: row.content,
      createdAt: row.createdAt,
      sessionId: row.sessionId,
      source: source && source.length > 0 ? source : null,
      provider: provider && provider.length > 0 ? provider : null
    };
  }
}
