import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const DEFAULT_EXECUTOR_MODE = "docker";
const DEFAULT_CPP_IMAGE = "gcc:13-bookworm";
const DEFAULT_PYTHON_IMAGE = "python:3.12-slim";
const DEFAULT_MEMORY_LIMIT = "256m";
const DEFAULT_CPU_LIMIT = "1.0";
const DEFAULT_PIDS_LIMIT = "64";
const DEFAULT_TMPFS_SIZE = "64m";
const DEFAULT_CONTAINER_USER = "65534:65534";
const DEFAULT_MAX_OUTPUT_LENGTH = 1024 * 1024;
const configuredMaxOutputLength = Number(process.env.JUDGE_MAX_OUTPUT_LENGTH ?? DEFAULT_MAX_OUTPUT_LENGTH);
const MAX_OUTPUT_LENGTH =
  Number.isFinite(configuredMaxOutputLength) && configuredMaxOutputLength > 0
    ? Math.floor(configuredMaxOutputLength)
    : DEFAULT_MAX_OUTPUT_LENGTH;
const verifiedDockerImages = new Set();
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(MODULE_DIR, "..", "..", "..");
const BUILTIN_SECCOMP_PROFILE = path.join(REPO_ROOT, "infra", "seccomp", "judge-seccomp.json");
const MEMORY_MARKER_PREFIX = "__LC_MEMORY_KB__=";
export const MEMORY_PROBE_VERSION = "2026-04-14.1";

function appendLimited(base, chunk) {
  if (base.length >= MAX_OUTPUT_LENGTH) {
    return base;
  }

  const remaining = MAX_OUTPUT_LENGTH - base.length;
  if (chunk.length <= remaining) {
    return base + chunk;
  }

  return `${base}${chunk.slice(0, remaining)}...<truncated>`;
}

function getExecutorMode() {
  const mode = (process.env.JUDGE_EXECUTOR_MODE ?? DEFAULT_EXECUTOR_MODE).trim().toLowerCase();

  if (mode === "local" || mode === "docker") {
    return mode;
  }

  return DEFAULT_EXECUTOR_MODE;
}

function getDockerImage(language) {
  if (language === "python") {
    return process.env.JUDGE_DOCKER_PYTHON_IMAGE ?? DEFAULT_PYTHON_IMAGE;
  }

  return process.env.JUDGE_DOCKER_CPP_IMAGE ?? DEFAULT_CPP_IMAGE;
}

function resolveSeccompProfilePath() {
  const configured = process.env.JUDGE_DOCKER_SECCOMP_PROFILE;
  const disabledValues = new Set(["off", "none", "false"]);

  if (configured !== undefined) {
    const trimmed = configured.trim();
    if (trimmed.length === 0) {
      return existsSync(BUILTIN_SECCOMP_PROFILE) ? BUILTIN_SECCOMP_PROFILE : null;
    }

    if (disabledValues.has(trimmed.toLowerCase())) {
      return null;
    }

    if (path.isAbsolute(trimmed)) {
      return trimmed;
    }

    return path.resolve(process.cwd(), trimmed);
  }

  return existsSync(BUILTIN_SECCOMP_PROFILE) ? BUILTIN_SECCOMP_PROFILE : null;
}

function buildDockerArgs(options, image) {
  const seccompProfile = resolveSeccompProfilePath();
  const memoryProbeScript = [
    "\"$@\"",
    "exit_code=$?",
    "mem_bytes=\"\"",
    "for mem_file in /sys/fs/cgroup/memory.peak /sys/fs/cgroup/memory.current /sys/fs/cgroup/memory.max_usage_in_bytes /sys/fs/cgroup/memory/memory.max_usage_in_bytes; do",
    "  if [ -r \"$mem_file\" ]; then",
    "    mem_bytes=$(cat \"$mem_file\" 2>/dev/null || true)",
    "    if [ -n \"$mem_bytes\" ]; then",
    "      break",
    "    fi",
    "  fi",
    "done",
    "if [ -n \"$mem_bytes\" ] && [ \"$mem_bytes\" != \"max\" ]; then",
    `  printf "${MEMORY_MARKER_PREFIX}%s\\n" "$((mem_bytes / 1024))" >&2`,
    "fi",
    "exit \"$exit_code\""
  ].join("\n");

  const args = [
    "run",
    "--rm",
    "-i",
    "--network",
    "none",
    "--read-only",
    "--tmpfs",
    `/tmp:size=${process.env.JUDGE_SANDBOX_TMPFS_SIZE ?? DEFAULT_TMPFS_SIZE},exec`,
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--pids-limit",
    process.env.JUDGE_SANDBOX_PIDS_LIMIT ?? DEFAULT_PIDS_LIMIT,
    "--memory",
    process.env.JUDGE_SANDBOX_MEMORY_LIMIT ?? DEFAULT_MEMORY_LIMIT,
    "--cpus",
    process.env.JUDGE_SANDBOX_CPU_LIMIT ?? DEFAULT_CPU_LIMIT,
    "--user",
    process.env.JUDGE_SANDBOX_CONTAINER_USER ?? DEFAULT_CONTAINER_USER,
    "-v",
    `${options.workDir}:/workspace:rw`,
    "-w",
    "/workspace"
  ];

  if (seccompProfile && seccompProfile.trim().length > 0) {
    args.push("--security-opt", `seccomp=${seccompProfile.trim()}`);
  }

  args.push(image, "sh", "-lc", memoryProbeScript, "judge-entry", options.docker.command, ...options.docker.args);

  return args;
}

function normalizeMaxRssToKb(maxRss) {
  if (!Number.isFinite(maxRss) || maxRss <= 0) {
    return null;
  }

  // Node reports maxRSS in KB on Linux. On macOS it may be bytes, so normalize by heuristic.
  if (process.platform === "darwin" && maxRss > 1024 * 1024) {
    return Math.max(1, Math.round(maxRss / 1024));
  }

  return Math.max(1, Math.round(maxRss));
}

function readChildMemoryKb(child) {
  if (!child || typeof child.resourceUsage !== "function") {
    return null;
  }

  try {
    const usage = child.resourceUsage();
    if (!usage || typeof usage.maxRSS !== "number") {
      return null;
    }

    return normalizeMaxRssToKb(usage.maxRSS);
  } catch {
    return null;
  }
}

export function extractMemoryMarker(stderr) {
  if (stderr.length === 0 || !stderr.includes(MEMORY_MARKER_PREFIX)) {
    return { stderr, memoryKb: null };
  }

  const lines = stderr.split(/\r?\n/);
  const keptLines = [];
  let memoryKb = null;

  for (const line of lines) {
    const markerIndex = line.indexOf(MEMORY_MARKER_PREFIX);
    if (markerIndex < 0) {
      keptLines.push(line);
      continue;
    }

    const prefixText = line.slice(0, markerIndex).trim();
    if (prefixText.length > 0) {
      keptLines.push(prefixText);
    }

    const markerPayload = line.slice(markerIndex + MEMORY_MARKER_PREFIX.length);
    const numericMatch = markerPayload.match(/^\s*(\d+)/);
    if (numericMatch) {
      const parsed = Number(numericMatch[1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        memoryKb = Math.max(1, Math.round(parsed));
      }

      const suffixText = markerPayload.slice(numericMatch[0].length).trim();
      if (suffixText.length > 0) {
        keptLines.push(suffixText);
      }
      continue;
    }

    const unresolvedPayload = markerPayload.trim();
    if (unresolvedPayload.length > 0) {
      keptLines.push(unresolvedPayload);
    }
  }

  return {
    stderr: keptLines.join("\n").trim(),
    memoryKb
  };
}

async function inspectDockerImage(image) {
  return await new Promise((resolve) => {
    const child = spawn("docker", ["image", "inspect", image], {
      env: process.env,
      stdio: ["ignore", "ignore", "pipe"],
      shell: false
    });

    let stderr = "";
    let finished = false;

    const timeoutTimer = setTimeout(() => {
      if (finished) {
        return;
      }

      finished = true;
      child.kill("SIGKILL");
      resolve({
        ok: false,
        stderr: "docker image inspect timed out"
      });
    }, 3000);

    child.stderr.on("data", (chunk) => {
      stderr = appendLimited(stderr, String(chunk));
    });

    child.on("close", (code) => {
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(timeoutTimer);
      resolve({
        ok: code === 0,
        stderr
      });
    });

    child.on("error", (error) => {
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(timeoutTimer);
      resolve({
        ok: false,
        stderr: `docker image inspect error: ${error.message}`
      });
    });
  });
}

async function ensureDockerImageAvailable(image) {
  if (verifiedDockerImages.has(image)) {
    return {
      ok: true,
      stderr: ""
    };
  }

  const inspected = await inspectDockerImage(image);
  if (inspected.ok) {
    verifiedDockerImages.add(image);
  }

  return inspected;
}

async function runLocalProcess(command, args, options) {
  return await new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command, args, {
      cwd: options.workDir,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let finished = false;

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, options.timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout = appendLimited(stdout, String(chunk));
    });

    child.stderr.on("data", (chunk) => {
      stderr = appendLimited(stderr, String(chunk));
    });

    child.on("error", (error) => {
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(timeoutTimer);
      const extracted = extractMemoryMarker(appendLimited(stderr, `Process spawn error: ${error.message}`));
      const fallbackMemoryKb = command === "docker" ? null : readChildMemoryKb(child);
      resolve({
        exitCode: null,
        signal: null,
        timedOut,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr: extracted.stderr,
        memoryKb: extracted.memoryKb ?? fallbackMemoryKb
      });
    });

    child.on("close", (exitCode, signal) => {
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(timeoutTimer);
      const extracted = extractMemoryMarker(stderr);
      const fallbackMemoryKb = command === "docker" ? null : readChildMemoryKb(child);
      resolve({
        exitCode,
        signal,
        timedOut,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr: extracted.stderr,
        memoryKb: extracted.memoryKb ?? fallbackMemoryKb
      });
    });

    if (options.stdin) {
      child.stdin.write(options.stdin);
    }

    child.stdin.end();
  });
}

export async function runSandboxCommand(options) {
  const mode = getExecutorMode();

  if (mode === "docker") {
    const image = getDockerImage(options.language);
    const available = await ensureDockerImageAvailable(image);

    if (!available.ok) {
      return {
        exitCode: 127,
        signal: null,
        timedOut: false,
        durationMs: 0,
        stdout: "",
        stderr: `${available.stderr}. Pull it first: docker pull ${image}`,
        memoryKb: null
      };
    }

    return await runLocalProcess("docker", buildDockerArgs(options, image), options);
  }

  return await runLocalProcess(options.local.command, options.local.args, options);
}

export function getSandboxExecutionMode() {
  return getExecutorMode();
}

export function getSandboxSeccompProfile() {
  return resolveSeccompProfilePath();
}
