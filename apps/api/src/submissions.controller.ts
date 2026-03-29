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
import { query } from "./db";
import { JudgeQueueService } from "./judge-queue.service";
import { CodeMode, Language, ModeSupport, SubmissionStatus } from "./types";

type CreateSubmissionBody = {
  problemSlug?: string;
  language?: Language;
  mode?: CodeMode;
  code?: string;
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
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type UserRow = {
  id: string;
};

const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL ?? "demo@leetcodepro.local";

@Controller("submissions")
export class SubmissionsController {
  constructor(private readonly judgeQueueService: JudgeQueueService) {}

  @Post()
  async createSubmission(@Body() body: CreateSubmissionBody) {
    if (!body.problemSlug || !body.language || !body.mode || !body.code) {
      throw new BadRequestException("Missing required fields: problemSlug, language, mode, code");
    }

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
      [body.problemSlug]
    );

    const problem = problemResult.rows[0];
    if (!problem) {
      throw new BadRequestException("Invalid problemSlug");
    }

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

    return {
      item: submission
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
}
