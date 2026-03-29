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

const problems: SeedProblem[] = [
  {
    slug: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    tags: ["array", "hash-table"],
    modeSupport: "BOTH",
    descriptionMd:
      "给定整数数组 nums 和目标值 target，请返回两个下标 i, j，使得 nums[i] + nums[j] == target，且 i != j。",
    inputSpec: "输入：nums（整数数组），target（整数）",
    outputSpec: "输出：满足条件的两个下标，顺序不限。",
    testCases: [
      {
        input: "nums = [2,7,11,15], target = 9",
        expectedOutput: "[0,1]",
        isHidden: false,
        weight: 1
      },
      {
        input: "nums = [3,2,4], target = 6",
        expectedOutput: "[1,2]",
        isHidden: true,
        weight: 1
      }
    ]
  },
  {
    slug: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "Easy",
    tags: ["stack", "string"],
    modeSupport: "BOTH",
    descriptionMd:
      "给定只包含 ()[]{} 的字符串 s，判断括号是否有效。有效要求：同类型匹配且顺序正确。",
    inputSpec: "输入：s（字符串）",
    outputSpec: "输出：布尔值 true/false。",
    testCases: [
      {
        input: "s = \"()[]{}\"",
        expectedOutput: "true",
        isHidden: false,
        weight: 1
      },
      {
        input: "s = \"([)]\"",
        expectedOutput: "false",
        isHidden: true,
        weight: 1
      }
    ]
  },
  {
    slug: "container-with-most-water",
    title: "Container With Most Water",
    difficulty: "Medium",
    tags: ["array", "two-pointers"],
    modeSupport: "BOTH",
    descriptionMd:
      "给定长度为 n 的数组 height，第 i 条线的高度为 height[i]。找出两条线使其与 x 轴组成容器并容纳最多的水。",
    inputSpec: "输入：height（非负整数数组）",
    outputSpec: "输出：容器可容纳的最大水量（整数）。",
    testCases: [
      {
        input: "height = [1,8,6,2,5,4,8,3,7]",
        expectedOutput: "49",
        isHidden: false,
        weight: 1
      },
      {
        input: "height = [1,1]",
        expectedOutput: "1",
        isHidden: true,
        weight: 1
      }
    ]
  }
];

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
        slug, title, difficulty, tags, mode_support, description_md, input_spec, output_spec
      )
      VALUES($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (slug) DO UPDATE
      SET
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
