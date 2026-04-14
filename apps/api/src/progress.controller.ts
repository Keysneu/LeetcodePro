import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { query } from "./db";
import { assertValidIanaTimeZone, buildProgressOverview } from "./progress-metrics";

type ProblemRow = {
  id: string;
  tags: string[];
};

type AcSubmissionRow = {
  problemId: string;
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

    const [problemsResult, acSubmissionsResult] = await Promise.all([
      query<ProblemRow>(
        `
          SELECT
            id,
            tags
          FROM problems;
        `
      ),
      query<AcSubmissionRow>(
        `
          SELECT
            problem_id AS "problemId",
            created_at::text AS "createdAt"
          FROM submissions
          WHERE user_id = $1
            AND status = 'AC';
        `,
        [userId]
      )
    ]);

    return buildProgressOverview({
      problems: problemsResult.rows,
      acSubmissions: acSubmissionsResult.rows,
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
