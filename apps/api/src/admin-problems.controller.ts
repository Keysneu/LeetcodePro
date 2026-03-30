import { Controller, Get, Headers, NotFoundException, Param } from "@nestjs/common";
import { ensureAdminAuthorized } from "./admin-auth";
import { query } from "./db";
import { ModeSupport } from "./types";

type AdminProblemListRow = {
  id: string;
  leetcodeId: number | null;
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  modeSupport: ModeSupport;
  totalCases: number;
  publicCases: number;
  hiddenCases: number;
  totalWeight: number;
};

type AdminProblemDetailRow = {
  id: string;
  leetcodeId: number | null;
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  modeSupport: ModeSupport;
  description: string;
  inputSpec: string;
  outputSpec: string;
  totalCases: number;
  publicCases: number;
  hiddenCases: number;
  totalWeight: number;
};

type AdminTestCaseRow = {
  id: string;
  inputData: string;
  expectedOutput: string;
  isHidden: boolean;
  weight: number;
  createdAt: string;
};

@Controller("admin/problems")
export class AdminProblemsController {
  @Get()
  async listAdminProblems(@Headers("x-admin-key") adminKey: string | undefined) {
    this.ensureAuth(adminKey);

    const result = await query<AdminProblemListRow>(
      `
        SELECT
          problems.id,
          problems.leetcode_id AS "leetcodeId",
          problems.slug,
          problems.title,
          problems.difficulty,
          problems.mode_support AS "modeSupport",
          COUNT(test_cases.id)::int AS "totalCases",
          COUNT(test_cases.id) FILTER (WHERE test_cases.is_hidden = FALSE)::int AS "publicCases",
          COUNT(test_cases.id) FILTER (WHERE test_cases.is_hidden = TRUE)::int AS "hiddenCases",
          COALESCE(SUM(test_cases.weight), 0)::int AS "totalWeight"
        FROM problems
        LEFT JOIN test_cases
          ON test_cases.problem_id = problems.id
        GROUP BY problems.id
        ORDER BY COALESCE(problems.leetcode_id, 2147483647) ASC, problems.created_at ASC;
      `
    );

    return {
      items: result.rows
    };
  }

  @Get(":slug/judge-data")
  async getProblemJudgeData(@Param("slug") slug: string, @Headers("x-admin-key") adminKey: string | undefined) {
    this.ensureAuth(adminKey);

    const problemResult = await query<AdminProblemDetailRow>(
      `
        SELECT
          problems.id,
          problems.leetcode_id AS "leetcodeId",
          problems.slug,
          problems.title,
          problems.difficulty,
          problems.mode_support AS "modeSupport",
          problems.description_md AS description,
          problems.input_spec AS "inputSpec",
          problems.output_spec AS "outputSpec",
          COUNT(test_cases.id)::int AS "totalCases",
          COUNT(test_cases.id) FILTER (WHERE test_cases.is_hidden = FALSE)::int AS "publicCases",
          COUNT(test_cases.id) FILTER (WHERE test_cases.is_hidden = TRUE)::int AS "hiddenCases",
          COALESCE(SUM(test_cases.weight), 0)::int AS "totalWeight"
        FROM problems
        LEFT JOIN test_cases
          ON test_cases.problem_id = problems.id
        WHERE problems.slug = $1
        GROUP BY problems.id
        LIMIT 1;
      `,
      [slug]
    );

    const problem = problemResult.rows[0];
    if (!problem) {
      throw new NotFoundException("Problem not found");
    }

    const caseResult = await query<AdminTestCaseRow>(
      `
        SELECT
          id,
          input_data AS "inputData",
          expected_output AS "expectedOutput",
          is_hidden AS "isHidden",
          weight,
          created_at::text AS "createdAt"
        FROM test_cases
        WHERE problem_id = $1
        ORDER BY created_at ASC, id ASC;
      `,
      [problem.id]
    );

    return {
      item: {
        ...problem,
        testCases: caseResult.rows
      }
    };
  }

  private ensureAuth(adminKey: string | undefined): void {
    ensureAdminAuthorized(adminKey, process.env.ADMIN_API_KEY);
  }
}
