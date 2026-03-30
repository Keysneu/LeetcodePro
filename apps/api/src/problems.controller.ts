import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { query } from "./db";
import { ModeSupport } from "./types";

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
};

type PublicCaseRow = {
  sampleInput: string;
  sampleOutput: string;
};

@Controller("problems")
export class ProblemsController {
  @Get()
  async listProblems() {
    const result = await query<ProblemListRow>(
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
        ORDER BY COALESCE(leetcode_id, 2147483647) ASC, created_at ASC;
      `
    );

    return {
      items: result.rows
    };
  }

  @Get(":slug")
  async getProblem(@Param("slug") slug: string) {
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
          output_spec AS "outputSpec"
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

    return {
      item: {
        ...problem,
        sampleInput: publicCase?.sampleInput ?? "",
        sampleOutput: publicCase?.sampleOutput ?? ""
      }
    };
  }
}
