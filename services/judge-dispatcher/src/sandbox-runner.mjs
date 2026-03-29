import { spawn } from "node:child_process";

const DEFAULT_EXECUTOR_MODE = "docker";
const DEFAULT_CPP_IMAGE = "gcc:13-bookworm";
const DEFAULT_PYTHON_IMAGE = "python:3.12-slim";
const DEFAULT_MEMORY_LIMIT = "256m";
const DEFAULT_CPU_LIMIT = "1.0";
const DEFAULT_PIDS_LIMIT = "64";
const DEFAULT_TMPFS_SIZE = "64m";
const DEFAULT_CONTAINER_USER = "65534:65534";
const MAX_OUTPUT_LENGTH = 16 * 1024;
const verifiedDockerImages = new Set();

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

function buildDockerArgs(options, image) {
  const seccompProfile = process.env.JUDGE_DOCKER_SECCOMP_PROFILE;

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

  args.push(image);
  args.push(options.docker.command);
  args.push(...options.docker.args);

  return args;
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
      resolve({
        exitCode: null,
        signal: null,
        timedOut,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr: appendLimited(stderr, `Process spawn error: ${error.message}`)
      });
    });

    child.on("close", (exitCode, signal) => {
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(timeoutTimer);
      resolve({
        exitCode,
        signal,
        timedOut,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr
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
        stderr: `${available.stderr}. Pull it first: docker pull ${image}`
      };
    }

    return await runLocalProcess("docker", buildDockerArgs(options, image), options);
  }

  return await runLocalProcess(options.local.command, options.local.args, options);
}

export function getSandboxExecutionMode() {
  return getExecutorMode();
}
