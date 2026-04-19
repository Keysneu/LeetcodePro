import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { query } from "./db";
import { buildMasteryByProblem, buildProblemMastery, MasterySubmissionRow } from "./mastery-metrics";
import { ModeSupport } from "./types";
import { buildAcmInputSpec, buildAcmOutputSpec, toAcmStdin } from "./acm-format";
import { getProblemAcmProjectionSql } from "./problem-acm-schema";
import { normalizeProblemSearchQuery, toProblemSearchPattern } from "./problems-search";

type ProblemListRow = {
  id: string;
  leetcodeId: number | null;
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string[];
  modeSupport: ModeSupport;
};

type ProblemDetailRow = ProblemListRow & {
  description: string;
  inputSpec: string;
  outputSpec: string;
  acmInputSpec: string;
  acmOutputSpec: string;
  acmSampleInput: string;
  acmSampleOutput: string;
};

type PublicCaseRow = {
  sampleInput: string;
  sampleOutput: string;
};

type UserRow = {
  id: string;
};

const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL ?? "demo@leetcodepro.local";

@Controller("problems")
export class ProblemsController {
  @Get()
  async listProblems(@Query("q") rawQuery: string | string[] | undefined) {
    const normalizedQuery = normalizeProblemSearchQuery(rawQuery);
    const hasSearch = Boolean(normalizedQuery);
    const userId = await this.getOrCreateDemoUserId();
    const [problemsResult, submissionsResult] = await Promise.all([
      query<ProblemListRow>(
        `
          SELECT
            id,
            leetcode_id AS "leetcodeId",
            slug,
            title,
            difficulty,
            tags,
            mode_support AS "modeSupport"
          FROM problems
          ${hasSearch ? 'WHERE COALESCE(leetcode_id::text, \'\') ILIKE $1 OR title ILIKE $1 OR slug ILIKE $1 OR EXISTS (SELECT 1 FROM unnest(tags) AS tag WHERE tag ILIKE $1)' : ""}
          ORDER BY COALESCE(leetcode_id, 2147483647) ASC, created_at ASC;
        `,
        hasSearch ? [toProblemSearchPattern(normalizedQuery!)] : []
      ),
      query<MasterySubmissionRow>(
        `
          SELECT
            submissions.id,
            submissions.problem_id AS "problemId",
            submissions.mode,
            submissions.language,
            submissions.status,
            submissions.created_at::text AS "createdAt"
          FROM submissions
          WHERE submissions.user_id = $1;
        `,
        [userId]
      )
    ]);

    const masteryByProblem = buildMasteryByProblem(
      problemsResult.rows.map((problem) => ({ id: problem.id, modeSupport: problem.modeSupport })),
      submissionsResult.rows
    );

    return {
      items: problemsResult.rows.map((problem) => ({
        ...problem,
        masterySummary: masteryByProblem.get(problem.id)?.summary
      }))
    };
  }

  @Get(":slug/mastery")
  async getProblemMastery(@Param("slug") slug: string) {
    const userId = await this.getOrCreateDemoUserId();
    const problemResult = await query<Pick<ProblemDetailRow, "id" | "modeSupport">>(
      `
        SELECT
          id,
          mode_support AS "modeSupport"
        FROM problems
        WHERE slug = $1
        LIMIT 1;
      `,
      [slug]
    );

    const problem = problemResult.rows[0];
    if (!problem) {
      throw new NotFoundException("Problem not found");
    }

    const submissionsResult = await query<MasterySubmissionRow>(
      `
        SELECT
          submissions.id,
          submissions.problem_id AS "problemId",
          submissions.mode,
          submissions.language,
          submissions.status,
          submissions.created_at::text AS "createdAt"
        FROM submissions
        WHERE submissions.user_id = $1
          AND submissions.problem_id = $2;
      `,
      [userId, problem.id]
    );

    return buildProblemMastery(problem.modeSupport, submissionsResult.rows);
  }

  @Get(":slug")
  async getProblem(@Param("slug") slug: string) {
    const acmProjectionSql = await getProblemAcmProjectionSql();
    const problemResult = await query<ProblemDetailRow>(
      `
        SELECT
          id,
          leetcode_id AS "leetcodeId",
          slug,
          title,
          difficulty,
          tags,
          mode_support AS "modeSupport",
          description_md AS description,
          input_spec AS "inputSpec",
          output_spec AS "outputSpec",
          ${acmProjectionSql}
        FROM problems
        WHERE slug = $1
        LIMIT 1;
      `,
      [slug]
    );

    const problem = problemResult.rows[0];

    if (!problem) {
      throw new NotFoundException("Problem not found");
    }

    const publicCaseResult = await query<PublicCaseRow>(
      `
        SELECT
          input_data AS "sampleInput",
          expected_output AS "sampleOutput"
        FROM test_cases
        WHERE problem_id = $1
          AND is_hidden = FALSE
        ORDER BY created_at ASC
        LIMIT 1;
      `,
      [problem.id]
    );

    const publicCase = publicCaseResult.rows[0];

    const sampleInput = publicCase?.sampleInput ?? "";
    const sampleOutput = publicCase?.sampleOutput ?? "";
    const computedAcmSampleInput = sampleInput ? await toAcmStdin(problem.slug, sampleInput) : null;

    return {
      item: {
        ...problem,
        sampleInput,
        sampleOutput,
        acmInputSpec: problem.acmInputSpec || (computedAcmSampleInput ? buildAcmInputSpec(computedAcmSampleInput) : problem.inputSpec),
        acmOutputSpec: problem.acmOutputSpec || buildAcmOutputSpec(problem.outputSpec),
        acmSampleInput: problem.acmSampleInput || computedAcmSampleInput || sampleInput,
        acmSampleOutput: problem.acmSampleOutput || sampleOutput
      }
    };
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
