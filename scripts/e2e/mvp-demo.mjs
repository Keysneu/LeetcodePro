#!/usr/bin/env node
import { spawn } from "node:child_process";

const EXIT_CODES = {
  SUCCESS: 0,
  DEMO_FAILED: 40
};

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function runMinimalFlow(args, title) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    console.log(`\n=== ${title} ===`);
    console.log(`command: node scripts/e2e/minimal-flow.mjs ${args.join(" ")}`);

    const child = spawn(process.execPath, ["scripts/e2e/minimal-flow.mjs", ...args], {
      cwd: process.cwd(),
      stdio: "inherit"
    });

    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        durationMs: Date.now() - startedAt
      });
    });
  });
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  const shared = [];

  for (const [key, value] of Object.entries(cli)) {
    shared.push(`--${key}`, value);
  }

  const scenarios = [
    {
      title: "场景 1/2：Python Core 正常通过（AC）+ AI 流式点评",
      args: ["--language", "python", "--mode", "core", "--expected-status", "AC", "--ai-review-mode", "stream"]
    },
    {
      title: "场景 2/2：Python ACM 错误输出（WA）+ AI 流式定位",
      args: [
        "--language",
        "python",
        "--mode",
        "acm",
        "--expected-status",
        "WA",
        "--ai-review-mode",
        "stream",
        "--code",
        "import sys\n_ = sys.stdin.read()\nprint('0 0')"
      ]
    }
  ];

  const results = [];
  const startedAt = Date.now();

  for (let i = 0; i < scenarios.length; i += 1) {
    const scenario = scenarios[i];
    const args = [...scenario.args, ...(i === 0 ? ["--health-check-deps", "true"] : ["--health-check-deps", "false"]), ...shared];
    const result = await runMinimalFlow(args, scenario.title);
    results.push({
      scenario: scenario.title,
      exitCode: result.code,
      durationMs: result.durationMs
    });
    if (result.code !== 0) {
      console.error(
        JSON.stringify(
          {
            summary: "MVP demo failed",
            failedScenario: scenario.title,
            totalDurationMs: Date.now() - startedAt,
            results
          },
          null,
          2
        )
      );
      process.exit(EXIT_CODES.DEMO_FAILED);
    }
  }

  console.log(
    JSON.stringify(
      {
        summary: "MVP demo passed",
        totalDurationMs: Date.now() - startedAt,
        results
      },
      null,
      2
    )
  );
  process.exit(EXIT_CODES.SUCCESS);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[fatal] ${message}`);
  process.exit(EXIT_CODES.DEMO_FAILED);
});
