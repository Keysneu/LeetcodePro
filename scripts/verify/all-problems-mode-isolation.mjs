import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { judgeSubmissionWithCases } from "../../services/judge-dispatcher/src/judge-executor.mjs";
import { getProblemAdapter } from "../../services/judge-dispatcher/src/problem-adapters.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const hot100Path = path.join(repoRoot, "apps/api/scripts/db/data/hot100.json");
const metadataPath = path.join(repoRoot, "services/judge-dispatcher/src/core-metadata.json");
const artifactsDir = path.join(repoRoot, "artifacts");
const reportPath = path.join(artifactsDir, "judge-mode-isolation-report.json");

// Force local sandbox mode for deterministic CI/dev scans.
process.env.JUDGE_EXECUTOR_MODE = "local";

function normalizeCppType(typeName) {
  return String(typeName ?? "").replace(/\s+/g, " ").trim();
}

function pythonDefaultByType(typeName) {
  const t = normalizeCppType(typeName);
  if (t === "void") {
    return null;
  }
  if (t.endsWith("*")) {
    return "None";
  }
  if (t.startsWith("vector<")) {
    return "[]";
  }
  if (t === "bool") {
    return "False";
  }
  if (t === "int") {
    return "0";
  }
  if (t === "double") {
    return "0.0";
  }
  if (t === "string") {
    return "\"\"";
  }
  return "None";
}

function cppDefaultByType(typeName) {
  const t = normalizeCppType(typeName);
  if (t === "void") {
    return null;
  }
  if (t.endsWith("*")) {
    return "nullptr";
  }
  if (t.startsWith("vector<")) {
    return "{}";
  }
  if (t === "bool") {
    return "false";
  }
  if (t === "int") {
    return "0";
  }
  if (t === "double") {
    return "0.0";
  }
  if (t === "string") {
    return "\"\"";
  }
  return "{}";
}

function getSolutionMethod(meta) {
  const methods = Array.isArray(meta?.methods) ? meta.methods.filter((item) => item.returnType !== null) : [];
  if (methods.length < 1) {
    throw new Error("No callable solution method found");
  }
  return methods[0];
}

function buildPythonCoreStub(meta) {
  if (meta.kind === "design") {
    const constructor = meta.methods.find((item) => item.returnType === null && item.name === meta.className) ?? {
      params: []
    };
    const methods = meta.methods.filter((item) => item.returnType !== null);
    const lines = [];
    lines.push(`class ${meta.className}:`);
    const ctorParams = ["self", ...constructor.params.map((param) => param.name)].join(", ");
    lines.push(`    def __init__(${ctorParams}):`);
    lines.push("        pass");
    lines.push("");

    for (const method of methods) {
      const params = ["self", ...method.params.map((param) => param.name)].join(", ");
      lines.push(`    def ${method.name}(${params}):`);
      const defaultValue = pythonDefaultByType(method.returnType);
      if (defaultValue === null) {
        lines.push("        pass");
      } else {
        lines.push(`        return ${defaultValue}`);
      }
      lines.push("");
    }

    return `${lines.join("\n").trim()}\n`;
  }

  const method = getSolutionMethod(meta);
  const params = method.params.map((param) => param.name).join(", ");
  const defaultValue = pythonDefaultByType(method.returnType);
  const lines = [];
  lines.push(`def ${method.name}(${params}):`);
  if (defaultValue === null) {
    lines.push("    pass");
  } else {
    lines.push(`    return ${defaultValue}`);
  }
  lines.push("");
  return lines.join("\n");
}

function buildCppMethodStub(method, isConstructor = false) {
  const params = method.params.map((param) => `${param.type} ${param.name}`).join(", ");

  if (isConstructor) {
    return `  ${method.name}(${params}) {}`;
  }

  const returnType = normalizeCppType(method.returnType);
  const defaultValue = cppDefaultByType(returnType);
  if (defaultValue === null) {
    return `  ${returnType} ${method.name}(${params}) {}`;
  }
  return `  ${returnType} ${method.name}(${params}) { return ${defaultValue}; }`;
}

function buildCppCoreStub(meta) {
  if (meta.kind === "design") {
    const constructor = meta.methods.find((item) => item.returnType === null && item.name === meta.className) ?? {
      name: meta.className,
      params: []
    };
    const methods = meta.methods.filter((item) => item.returnType !== null);
    const lines = [];
    lines.push(`class ${meta.className} {`);
    lines.push(" public:");
    lines.push(buildCppMethodStub({ ...constructor, name: meta.className }, true));
    for (const method of methods) {
      lines.push(buildCppMethodStub(method));
    }
    lines.push("};");
    lines.push("");
    return lines.join("\n");
  }

  const method = getSolutionMethod(meta);
  const lines = [];
  lines.push("class Solution {");
  lines.push(" public:");
  lines.push(buildCppMethodStub(method));
  lines.push("};");
  lines.push("");
  return lines.join("\n");
}

function mapCases(problem) {
  return (problem.testCases ?? []).map((testCase, index) => ({
    id: `${problem.slug}-case-${index + 1}`,
    inputData: testCase.input,
    expectedOutput: testCase.expectedOutput
  }));
}

function isHealthyJudgeStatus(status) {
  return status === "WA" || status === "AC";
}

async function main() {
  const hot100Raw = JSON.parse(await readFile(hot100Path, "utf8"));
  const problems = hot100Raw.problems ?? [];
  const coreMetadata = JSON.parse(await readFile(metadataPath, "utf8"));
  const issues = [];
  const results = [];

  for (let index = 0; index < problems.length; index += 1) {
    const problem = problems[index];
    const slug = problem.slug;
    const mappedCases = mapCases(problem);
    const adapter = getProblemAdapter(slug);
    const problemResult = {
      slug,
      checks: []
    };

    if (index % 10 === 0 || index === problems.length - 1) {
      console.log(`[scan] ${index + 1}/${problems.length} ${slug}`);
    }

    for (const [caseIndex, testCase] of mappedCases.entries()) {
      try {
        const parsed = adapter.parseInput(testCase.inputData);
        const stdin = adapter.toAcmStdin(parsed);
        const parsedExpected = adapter.parseExpected(testCase.expectedOutput);
        adapter.normalizeExpected(parsedExpected);

        if (typeof stdin !== "string" || stdin.trim().length === 0) {
          throw new Error("Empty ACM stdin generated");
        }
      } catch (error) {
        issues.push({
          slug,
          mode: "acm",
          language: "adapter",
          stage: "parse",
          caseIndex: caseIndex + 1,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const acmSubmission = {
      problemSlug: slug,
      language: "python",
      mode: "acm",
      code: "import sys\n_ = sys.stdin.read()\nprint(0)\n"
    };
    const acmResult = await judgeSubmissionWithCases(acmSubmission, mappedCases);
    problemResult.checks.push({
      mode: "acm",
      language: "python",
      status: acmResult.status
    });
    if (!isHealthyJudgeStatus(acmResult.status)) {
      issues.push({
        slug,
        mode: "acm",
        language: "python",
        stage: "judge",
        message: acmResult.errorMessage ?? `Unexpected status: ${acmResult.status}`
      });
    }

    const meta = coreMetadata[slug];
    if (!meta) {
      issues.push({
        slug,
        mode: "core",
        language: "metadata",
        stage: "load",
        message: "Missing core metadata"
      });
      results.push(problemResult);
      continue;
    }

    const pythonCoreSubmission = {
      problemSlug: slug,
      language: "python",
      mode: "core",
      code: buildPythonCoreStub(meta)
    };
    const pythonCoreResult = await judgeSubmissionWithCases(pythonCoreSubmission, mappedCases);
    problemResult.checks.push({
      mode: "core",
      language: "python",
      status: pythonCoreResult.status
    });
    if (!isHealthyJudgeStatus(pythonCoreResult.status)) {
      issues.push({
        slug,
        mode: "core",
        language: "python",
        stage: "judge",
        message: pythonCoreResult.errorMessage ?? `Unexpected status: ${pythonCoreResult.status}`
      });
    }

    const cppCoreSubmission = {
      problemSlug: slug,
      language: "cpp",
      mode: "core",
      code: buildCppCoreStub(meta)
    };
    const cppCoreResult = await judgeSubmissionWithCases(cppCoreSubmission, mappedCases);
    problemResult.checks.push({
      mode: "core",
      language: "cpp",
      status: cppCoreResult.status
    });
    if (!isHealthyJudgeStatus(cppCoreResult.status)) {
      issues.push({
        slug,
        mode: "core",
        language: "cpp",
        stage: "judge",
        message: cppCoreResult.errorMessage ?? `Unexpected status: ${cppCoreResult.status}`
      });
    }

    results.push(problemResult);
  }

  await mkdir(artifactsDir, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    totalProblems: problems.length,
    issueCount: issues.length,
    issues,
    results
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (issues.length > 0) {
    console.log(`[done] Found ${issues.length} issue(s). Report: ${reportPath}`);
    process.exitCode = 1;
    return;
  }

  console.log(`[done] All ${problems.length} problems passed mode-isolation checks. Report: ${reportPath}`);
}

await main();
