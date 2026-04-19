import { existsSync } from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

type ProblemAdapter = {
  parseInput: (text: string) => unknown;
  toAcmStdin: (input: unknown) => string;
};

type AdapterModule = {
  getProblemAdapter: (problemSlug: string) => ProblemAdapter;
};

let adapterModulePromise: Promise<AdapterModule> | null = null;
const runtimeDynamicImport = new Function("moduleUrl", "return import(moduleUrl);") as (moduleUrl: string) => Promise<unknown>;

function resolveAdapterModulePath(): string {
  const candidates = [
    path.resolve(__dirname, "../../../services/judge-dispatcher/src/problem-adapters.mjs"),
    path.resolve(process.cwd(), "services/judge-dispatcher/src/problem-adapters.mjs"),
    path.resolve(process.cwd(), "../services/judge-dispatcher/src/problem-adapters.mjs")
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("Unable to resolve judge problem adapter module path.");
}

async function loadAdapterModule(): Promise<AdapterModule> {
  if (!adapterModulePromise) {
    const modulePath = resolveAdapterModulePath();
    adapterModulePromise = runtimeDynamicImport(pathToFileURL(modulePath).href) as Promise<AdapterModule>;
  }

  return adapterModulePromise;
}

function ensureTrailingNewline(text: string): string {
  return text.endsWith("\n") ? text : `${text}\n`;
}

export async function toAcmStdin(problemSlug: string, coreInput: string): Promise<string | null> {
  try {
    const module = await loadAdapterModule();
    const adapter = module.getProblemAdapter(problemSlug);
    const parsed = adapter.parseInput(coreInput);
    const stdin = adapter.toAcmStdin(parsed);
    return ensureTrailingNewline(String(stdin ?? ""));
  } catch {
    return null;
  }
}

export function buildAcmInputSpec(acmStdin: string): string {
  const normalized = acmStdin.trimEnd();
  if (!normalized) {
    return "ACM 输入为标准输入（stdin），请按题意自行解析。";
  }

  return `ACM 输入为标准输入（stdin）。每一行按如下顺序读取：\n${normalized}`;
}

export function buildAcmOutputSpec(coreOutputSpec: string): string {
  const normalized = coreOutputSpec.trim();
  if (!normalized) {
    return "ACM 输出为标准输出（stdout），请按题意输出答案。";
  }

  return `ACM 输出为标准输出（stdout）。${normalized}`;
}
