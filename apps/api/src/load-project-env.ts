import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";

function stripWrappingQuotes(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

function parseEnvFile(content: string): Map<string, string> {
  const entries = new Map<string, string>();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }

    const value = stripWrappingQuotes(line.slice(separatorIndex + 1).trim());
    entries.set(key, value);
  }

  return entries;
}

function findProjectEnvFile(): string | null {
  const candidates = new Set<string>();
  const cwd = process.cwd();
  candidates.add(path.resolve(cwd, ".env"));
  candidates.add(path.resolve(__dirname, "../../../.env"));

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function loadProjectEnv(): string | null {
  const envFilePath = findProjectEnvFile();
  if (!envFilePath) {
    return null;
  }

  const parsed = parseEnvFile(readFileSync(envFilePath, "utf8"));
  for (const [key, value] of parsed.entries()) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return envFilePath;
}

loadProjectEnv();
