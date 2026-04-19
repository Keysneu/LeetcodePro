import { BadRequestException } from "@nestjs/common";
import { existsSync } from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { CodeMode, Language, SubmissionStatus } from "./types";

export type CustomTestCaseInput = {
  id?: string;
  title?: string;
  input?: string;
  output?: string;
  expectedOutput?: string;
};

export type NormalizedCustomTestCase = {
  id: string;
  title: string;
  inputData: string;
  expectedOutput: string;
};

export type CustomTestRunCaseResult = {
  caseId: string;
  title: string;
  inputData: string;
  expectedOutput: string;
  status: SubmissionStatus;
  runtimeMs: number | null;
  memoryKb: number | null;
  stderr: string | null;
  actualOutput: string | null;
};

export type CustomTestRunResult = {
  status: SubmissionStatus;
  runtimeMs: number | null;
  memoryKb: number | null;
  passedCount: number;
  totalCount: number;
  errorMessage: string | null;
  caseResults: CustomTestRunCaseResult[];
};

type JudgeCaseResult = {
  caseId: string;
  status: SubmissionStatus;
  runtimeMs: number | null;
  memoryKb: number | null;
  stderr: string | null;
  actualOutput: string | null;
};

type JudgeSubmissionResult = {
  status: SubmissionStatus;
  runtimeMs: number | null;
  memoryKb: number | null;
  passedCount: number;
  errorMessage: string | null;
  caseResults: JudgeCaseResult[];
};

type JudgeSubmissionInput = {
  problemSlug: string;
  language: Language;
  mode: CodeMode;
  code: string;
};

type JudgeExecutorModule = {
  judgeSubmissionWithCases: (
    submission: JudgeSubmissionInput,
    testCases: Array<{ id: string; inputData: string; expectedOutput: string }>,
    options?: { caseInputFormat?: "problem" | "stdin" }
  ) => Promise<JudgeSubmissionResult>;
};

const runtimeDynamicImport = new Function("moduleUrl", "return import(moduleUrl);") as (moduleUrl: string) => Promise<unknown>;
const MAX_CUSTOM_TEST_CASES = 20;
let judgeExecutorModulePromise: Promise<JudgeExecutorModule> | null = null;

function resolveJudgeExecutorModulePath(): string {
  const candidates = [
    path.resolve(__dirname, "../../../services/judge-dispatcher/src/judge-executor.mjs"),
    path.resolve(process.cwd(), "services/judge-dispatcher/src/judge-executor.mjs"),
    path.resolve(process.cwd(), "../services/judge-dispatcher/src/judge-executor.mjs")
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("Unable to resolve judge executor module path.");
}

async function loadJudgeExecutorModule(): Promise<JudgeExecutorModule> {
  if (!judgeExecutorModulePromise) {
    const modulePath = resolveJudgeExecutorModulePath();
    judgeExecutorModulePromise = runtimeDynamicImport(pathToFileURL(modulePath).href) as Promise<JudgeExecutorModule>;
  }

  return judgeExecutorModulePromise;
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  return value;
}

export function normalizeCustomTestCases(rawCases: unknown): NormalizedCustomTestCase[] {
  if (!Array.isArray(rawCases) || rawCases.length === 0) {
    throw new BadRequestException("至少需要提供 1 条测试用例。");
  }

  if (rawCases.length > MAX_CUSTOM_TEST_CASES) {
    throw new BadRequestException(`单次最多运行 ${MAX_CUSTOM_TEST_CASES} 条测试用例。`);
  }

  return rawCases.map((item, index) => {
    if (typeof item !== "object" || item === null) {
      throw new BadRequestException(`第 ${index + 1} 条测试用例格式不正确。`);
    }

    const record = item as CustomTestCaseInput;
    const input = normalizeOptionalText(record.input);
    const expectedOutput = normalizeOptionalText(record.output) ?? normalizeOptionalText(record.expectedOutput);
    const title = normalizeOptionalText(record.title);
    const providedId = normalizeOptionalText(record.id)?.trim();

    if (input === null) {
      throw new BadRequestException(`第 ${index + 1} 条测试用例缺少 input。`);
    }

    if (expectedOutput === null) {
      throw new BadRequestException(`第 ${index + 1} 条测试用例缺少 output。`);
    }

    return {
      id: providedId && providedId.length > 0 ? providedId : `custom-case-${index + 1}`,
      title: title && title.trim().length > 0 ? title.trim() : `Case ${index + 1}`,
      inputData: input,
      expectedOutput
    };
  });
}

export async function runCustomTestCases(
  submission: JudgeSubmissionInput,
  testCases: NormalizedCustomTestCase[]
): Promise<CustomTestRunResult> {
  const judgeExecutorModule = await loadJudgeExecutorModule();
  const judged = await judgeExecutorModule.judgeSubmissionWithCases(submission, testCases, {
    caseInputFormat: submission.mode === "acm" ? "stdin" : "problem"
  });
  const testCaseById = new Map(testCases.map((item) => [item.id, item]));

  return {
    status: judged.status,
    runtimeMs: judged.runtimeMs,
    memoryKb: judged.memoryKb,
    passedCount: judged.passedCount,
    totalCount: judged.caseResults.length,
    errorMessage: judged.errorMessage,
    caseResults: judged.caseResults.map((item) => {
      const source = testCaseById.get(item.caseId);
      return {
        caseId: item.caseId,
        title: source?.title ?? item.caseId,
        inputData: source?.inputData ?? "",
        expectedOutput: source?.expectedOutput ?? "",
        status: item.status,
        runtimeMs: item.runtimeMs,
        memoryKb: item.memoryKb,
        stderr: item.stderr,
        actualOutput: item.actualOutput
      };
    })
  };
}
