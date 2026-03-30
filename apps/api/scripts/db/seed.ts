import { readFileSync } from "node:fs";
import * as path from "node:path";
import { Pool, PoolClient } from "pg";

const DEFAULT_POSTGRES_URL = "postgresql://postgres:postgres@localhost:5432/leetcodepro";
const DEMO_USER_EMAIL = "demo@leetcodepro.local";

type Difficulty = "Easy" | "Medium" | "Hard";
type ModeSupport = "CORE" | "ACM" | "BOTH";

type SeedTestCase = {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  weight: number;
};

type SeedProblem = {
  leetcodeId: number;
  slug: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  modeSupport: ModeSupport;
  descriptionMd: string;
  inputSpec: string;
  outputSpec: string;
  testCases: SeedTestCase[];
};

type ProblemRow = {
  id: string;
};

type SeedDataFile = {
  count: number;
  missing: string[];
  problems: SeedProblem[];
};

function loadHot100Problems(): SeedProblem[] {
  const dataPath = path.resolve(__dirname, "data/hot100.json");
  const content = readFileSync(dataPath, "utf8");
  const parsed = JSON.parse(content) as SeedDataFile;

  if (!Array.isArray(parsed.problems) || parsed.problems.length !== 100) {
    throw new Error(`hot100 seed data invalid: expected 100 problems, got ${parsed.problems?.length ?? 0}`);
  }

  if (Array.isArray(parsed.missing) && parsed.missing.length > 0) {
    throw new Error(`hot100 seed data has missing entries: ${parsed.missing.join(", ")}`);
  }

  return parsed.problems;
}

const problems: SeedProblem[] = loadHot100Problems();

async function upsertDemoUser(client: PoolClient): Promise<void> {
  await client.query(
    `
      INSERT INTO users(email, password_hash, nickname)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) DO UPDATE
        SET nickname = EXCLUDED.nickname,
            updated_at = NOW();
    `,
    [DEMO_USER_EMAIL, "demo-password-not-used", "Demo User"]
  );
}

async function upsertProblem(client: PoolClient, problem: SeedProblem): Promise<string> {
  const result = await client.query<ProblemRow>(
    `
      INSERT INTO problems(
        leetcode_id, slug, title, difficulty, tags, mode_support, description_md, input_spec, output_spec
      )
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (slug) DO UPDATE
      SET
        leetcode_id = EXCLUDED.leetcode_id,
        title = EXCLUDED.title,
        difficulty = EXCLUDED.difficulty,
        tags = EXCLUDED.tags,
        mode_support = EXCLUDED.mode_support,
        description_md = EXCLUDED.description_md,
        input_spec = EXCLUDED.input_spec,
        output_spec = EXCLUDED.output_spec,
        updated_at = NOW()
      RETURNING id;
    `,
    [
      problem.leetcodeId,
      problem.slug,
      problem.title,
      problem.difficulty,
      problem.tags,
      problem.modeSupport,
      problem.descriptionMd,
      problem.inputSpec,
      problem.outputSpec
    ]
  );

  return result.rows[0].id;
}

async function replaceTestCases(client: PoolClient, problemId: string, testCases: SeedTestCase[]): Promise<void> {
  await client.query(
    `
      DELETE FROM submission_case_results scr
      USING test_cases tc
      WHERE scr.case_id = tc.id
        AND tc.problem_id = $1;
    `,
    [problemId]
  );

  await client.query("DELETE FROM test_cases WHERE problem_id = $1;", [problemId]);

  for (const testCase of testCases) {
    await client.query(
      `
        INSERT INTO test_cases(problem_id, input_data, expected_output, is_hidden, weight)
        VALUES($1, $2, $3, $4, $5);
      `,
      [problemId, testCase.input, testCase.expectedOutput, testCase.isHidden, testCase.weight]
    );
  }
}

async function main(): Promise<void> {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL ?? DEFAULT_POSTGRES_URL
  });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await upsertDemoUser(client);

    for (const problem of problems) {
      const problemId = await upsertProblem(client, problem);
      await replaceTestCases(client, problemId, problem.testCases);
    }

    await client.query("COMMIT");
    // eslint-disable-next-line no-console
    console.log(`seed completed: ${problems.length} problems, demo user ${DEMO_USER_EMAIL}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error("database seed failed:", error);
  process.exitCode = 1;
});
