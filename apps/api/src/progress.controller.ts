import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { query } from "./db";
import { assertValidIanaTimeZone, buildProgressOverview } from "./progress-metrics";

type ProblemRow = {
  id: string;
  slug: string;
  title: string;
  leetcodeId: number | null;
  tags: string[];
  modeSupport: "CORE" | "ACM" | "BOTH";
};

type SubmissionRow = {
  id: string;
  problemId: string;
  mode: "core" | "acm";
  language: "cpp" | "python";
  status: "QUEUED" | "RUNNING" | "AC" | "WA" | "TLE" | "RE" | "CE";
  createdAt: string;
};

type UserRow = {
  id: string;
};

const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL ?? "demo@leetcodepro.local";

@Controller("progress")
export class ProgressController {
  @Get("overview")
  async getOverview(@Query("timezone") timezone?: string) {
    const resolvedTimeZone = timezone?.trim();
    if (!resolvedTimeZone) {
      throw new BadRequestException("Query param timezone is required.");
    }

    try {
      assertValidIanaTimeZone(resolvedTimeZone);
    } catch {
      throw new BadRequestException("Invalid timezone. Please pass a valid IANA timezone, e.g. Asia/Shanghai.");
    }

    const userId = await this.getOrCreateDemoUserId();

    const [problemsResult, submissionsResult] = await Promise.all([
      query<ProblemRow>(
        `
          SELECT
            id,
            slug,
            title,
            leetcode_id AS "leetcodeId",
            tags,
            mode_support AS "modeSupport"
          FROM problems;
        `
      ),
      query<SubmissionRow>(
        `
          SELECT
            id,
            problem_id AS "problemId",
            mode,
            language,
            status,
            created_at::text AS "createdAt"
          FROM submissions
          WHERE user_id = $1;
        `,
        [userId]
      )
    ]);

    return buildProgressOverview({
      problems: problemsResult.rows,
      submissions: submissionsResult.rows,
      timeZone: resolvedTimeZone
    });
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
