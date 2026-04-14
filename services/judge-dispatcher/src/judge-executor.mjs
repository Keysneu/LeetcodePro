import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildCppCoreProgram, buildPythonCoreProgram } from "./core-wrapper.mjs";
import { getProblemAdapter } from "./problem-adapters.mjs";
import { getSandboxExecutionMode, runSandboxCommand } from "./sandbox-runner.mjs";

const CASE_TIMEOUT_MS = Number(process.env.JUDGE_CASE_TIMEOUT_MS ?? 2000);
const COMPILE_TIMEOUT_MS = Number(process.env.JUDGE_COMPILE_TIMEOUT_MS ?? 6000);
const SANDBOX_STARTUP_GRACE_MS = Number(process.env.JUDGE_SANDBOX_STARTUP_GRACE_MS ?? 8000);
const JUDGE_DISPATCHER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JSON_HEADER_PATH = path.join(JUDGE_DISPATCHER_ROOT, "vendor", "nlohmann", "json.hpp");

function summarizeStderr(stderr) {
  const trimmed = stderr.trim();
  if (trimmed.length === 0) {
    return "No stderr output";
  }

  return trimmed;
}

function toSandboxTimeout(baseTimeoutMs) {
  if (getSandboxExecutionMode() === "docker") {
    return baseTimeoutMs + SANDBOX_STARTUP_GRACE_MS;
  }

  return baseTimeoutMs;
}

function buildCaseFailureResults(testCases, status, stderr) {
  return testCases.map((testCase) => ({
    caseId: testCase.id,
    status,
    runtimeMs: null,
    memoryKb: null,
    stderr,
    actualOutput: null
  }));
}

function aggregateSubmissionResult(caseResults) {
  const passedCount = caseResults.filter((item) => item.status === "AC").length;
  const firstFailure = caseResults.find((item) => item.status !== "AC");

  const status = firstFailure ? firstFailure.status : "AC";
  const runtimeMs = caseResults.reduce((sum, item) => sum + (item.runtimeMs ?? 0), 0);
  const memoryValues = caseResults
    .map((item) => item.memoryKb)
    .filter((value) => typeof value === "number" && Number.isFinite(value) && value > 0);
  const peakMemoryKb = memoryValues.length > 0 ? Math.max(...memoryValues) : null;

  return {
    status,
    passedCount,
    runtimeMs: runtimeMs > 0 ? runtimeMs : null,
    memoryKb: peakMemoryKb,
    errorMessage: firstFailure?.stderr ?? null,
    caseResults
  };
}

function ensureTrailingNewline(text) {
  const source = String(text ?? "");
  return source.endsWith("\n") ? source : `${source}\n`;
}

function buildCppCompileSpec(workDir, sourceName, outputName) {
  const sourcePath = path.join(workDir, sourceName);
  const outputPath = path.join(workDir, outputName);

  return {
    language: "cpp",
    local: {
      command: "g++",
      args: [sourcePath, "-std=c++17", "-O2", "-o", outputPath]
    },
    docker: {
      command: "g++",
      args: [`/workspace/${sourceName}`, "-std=c++17", "-O2", "-o", `/workspace/${outputName}`]
    }
  };
}

async function compileCpp(sourceCode, workDir, sourceName, outputName) {
  const sourcePath = path.join(workDir, sourceName);
  await fs.writeFile(sourcePath, sourceCode, "utf8");

  const compileSpec = buildCppCompileSpec(workDir, sourceName, outputName);
  const compileResult = await runSandboxCommand({
    language: compileSpec.language,
    workDir,
    timeoutMs: toSandboxTimeout(COMPILE_TIMEOUT_MS),
    stdin: "",
    local: compileSpec.local,
    docker: compileSpec.docker
  });

  if (compileResult.timedOut) {
    return {
      ok: false,
      status: "CE",
      errorMessage: "Compilation timed out."
    };
  }

  if (compileResult.exitCode !== 0) {
    return {
      ok: false,
      status: "CE",
      errorMessage: summarizeStderr(compileResult.stderr)
    };
  }

  return {
    ok: true,
    language: "cpp",
    local: {
      command: path.join(workDir, outputName),
      args: []
    },
    docker: {
      command: `/workspace/${outputName}`,
      args: []
    }
  };
}

async function ensureCoreCppDependencies(workDir) {
  const targetPath = path.join(workDir, "json.hpp");
  await fs.copyFile(JSON_HEADER_PATH, targetPath);
}

async function prepareExecutable(submission, workDir) {
  if (submission.mode === "core" && submission.language === "cpp") {
    await ensureCoreCppDependencies(workDir);
    const sourceCode = buildCppCoreProgram(submission.problemSlug, submission.code);
    return await compileCpp(sourceCode, workDir, "core_main.cpp", "core_main.out");
  }

  if (submission.mode === "core" && submission.language === "python") {
    const sourceName = "core_main.py";
    const sourcePath = path.join(workDir, sourceName);
    await fs.writeFile(sourcePath, buildPythonCoreProgram(submission.problemSlug, submission.code), "utf8");

    return {
      ok: true,
      language: "python",
      local: {
        command: "python3",
        args: [sourcePath]
      },
      docker: {
        command: "python3",
        args: [`/workspace/${sourceName}`]
      }
    };
  }

  if (submission.mode === "acm" && submission.language === "cpp") {
    return await compileCpp(submission.code, workDir, "main.cpp", "main.out");
  }

  if (submission.mode === "acm" && submission.language === "python") {
    const sourceName = "main.py";
    const sourcePath = path.join(workDir, sourceName);
    await fs.writeFile(sourcePath, submission.code, "utf8");

    return {
      ok: true,
      language: "python",
      local: {
        command: "python3",
        args: [sourcePath]
      },
      docker: {
        command: "python3",
        args: [`/workspace/${sourceName}`]
      }
    };
  }

  return {
    ok: false,
    status: "RE",
    errorMessage: `Unsupported submission language or mode: ${submission.language}/${submission.mode}`
  };
}

function judgeSingleCase(adapter, expectedNormalized, executionResult) {
  const normalizedActual = normalizeActualOutput(adapter, executionResult.stdout);

  if (executionResult.timedOut) {
    return {
      status: "TLE",
      stderr: `Time limit exceeded (${CASE_TIMEOUT_MS}ms).`,
      actualOutput: normalizedActual
    };
  }

  if (executionResult.exitCode !== 0) {
    return {
      status: "RE",
      stderr: summarizeStderr(executionResult.stderr),
      actualOutput: normalizedActual
    };
  }

  if (normalizedActual === expectedNormalized) {
    return {
      status: "AC",
      stderr: null,
      actualOutput: normalizedActual
    };
  }

  return {
    status: "WA",
    stderr: `Expected ${expectedNormalized}, got ${normalizedActual}`,
    actualOutput: normalizedActual
  };
}

function normalizeActualOutput(adapter, stdout) {
  try {
    return adapter.normalizeAcmOutput(stdout);
  } catch {
    const raw = String(stdout ?? "").trim();
    return raw.length > 0 ? raw : null;
  }
}

export async function judgeSubmissionWithCases(submission, testCases) {
  const adapter = getProblemAdapter(submission.problemSlug);
  if (!adapter) {
    const caseResults = buildCaseFailureResults(testCases, "RE", `Unsupported problem slug: ${submission.problemSlug}`);
    return aggregateSubmissionResult(caseResults);
  }

  let structuredCases;

  try {
    structuredCases = testCases.map((testCase) => {
      const expected = adapter.parseExpected(testCase.expectedOutput);
      const stdin =
        submission.mode === "core"
          ? ensureTrailingNewline(testCase.inputData)
          : adapter.toAcmStdin(adapter.parseInput(testCase.inputData));

      return {
        caseId: testCase.id,
        stdin,
        expectedNormalized: adapter.normalizeExpected(expected)
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const caseResults = buildCaseFailureResults(testCases, "RE", `Invalid test case config: ${message}`);
    return aggregateSubmissionResult(caseResults);
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "leetcodepro-judge-"));

  try {
    if (getSandboxExecutionMode() === "docker") {
      // Non-root container user requires writable mount permissions.
      await fs.chmod(tempDir, 0o777);
    }

    const executable = await prepareExecutable(submission, tempDir);

    if (!executable.ok) {
      const caseResults = buildCaseFailureResults(testCases, executable.status, executable.errorMessage);
      return aggregateSubmissionResult(caseResults);
    }

    const caseResults = [];

    for (const testCase of structuredCases) {
      const executionResult = await runSandboxCommand({
        language: executable.language,
        workDir: tempDir,
        timeoutMs: toSandboxTimeout(CASE_TIMEOUT_MS),
        stdin: testCase.stdin,
        local: executable.local,
        docker: executable.docker
      });

      const judged = judgeSingleCase(adapter, testCase.expectedNormalized, executionResult);

      caseResults.push({
        caseId: testCase.caseId,
        status: judged.status,
        runtimeMs: executionResult.timedOut ? CASE_TIMEOUT_MS : Math.max(1, executionResult.durationMs),
        memoryKb: executionResult.memoryKb ?? null,
        stderr: judged.stderr,
        actualOutput: judged.actualOutput
      });
    }

    return aggregateSubmissionResult(caseResults);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
