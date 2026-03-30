#!/usr/bin/env node
import { spawn } from "node:child_process";

const EXIT_CODES = {
  SUCCESS: 0,
  ARGUMENT_ERROR: 11,
  FLOW_FAILED: 30
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

function toPositiveNumber(raw, fallback) {
  if (raw === undefined || raw === null || raw === "") {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid number value: ${raw}`);
  }
  return parsed;
}

function runOnce({ index, total, extraArgs }) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const args = [
      "scripts/e2e/minimal-flow.mjs",
      "--ai-review-mode",
      "stream",
      "--health-check-deps",
      index === 1 ? "true" : "false",
      ...extraArgs
    ];

    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      stdout += text;
      process.stdout.write(`[run ${index}/${total}] ${text}`);
    });

    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      stderr += text;
      process.stderr.write(`[run ${index}/${total}] ${text}`);
    });

    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr
      });
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let runs;
  try {
    runs = toPositiveNumber(args.runs, 10);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[fatal] ${message}`);
    process.exit(EXIT_CODES.ARGUMENT_ERROR);
  }

  const passThroughArgs = [];
  for (const [key, value] of Object.entries(args)) {
    if (key === "runs") {
      continue;
    }
    passThroughArgs.push(`--${key}`, value);
  }

  const startedAt = Date.now();
  const details = [];

  for (let i = 1; i <= runs; i += 1) {
    const result = await runOnce({
      index: i,
      total: runs,
      extraArgs: passThroughArgs
    });
    details.push({
      run: i,
      exitCode: result.code,
      durationMs: result.durationMs
    });

    if (result.code !== 0) {
      console.error(
        JSON.stringify(
          {
            summary: "stability acceptance failed",
            targetRuns: runs,
            passedRuns: i - 1,
            failedRun: i,
            totalDurationMs: Date.now() - startedAt,
            details
          },
          null,
          2
        )
      );
      process.exit(EXIT_CODES.FLOW_FAILED);
    }
  }

  console.log(
    JSON.stringify(
      {
        summary: "stability acceptance passed",
        targetRuns: runs,
        passedRuns: runs,
        totalDurationMs: Date.now() - startedAt,
        details
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
  process.exit(EXIT_CODES.FLOW_FAILED);
});
