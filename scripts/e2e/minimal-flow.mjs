#!/usr/bin/env node
const TERMINAL_STATUSES = new Set(["AC", "WA", "TLE", "RE", "CE"]);
const EXIT_CODES = { SUCCESS: 0, ARGUMENT_ERROR: 11, FLOW_ERROR: 20, UNEXPECTED_STATUS: 21 };

class FlowError extends Error {
  constructor(message, exitCode, extras = {}) {
    super(message);
    this.exitCode = exitCode;
    Object.assign(this, extras);
  }
}

function log(step, message, data) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${step}] ${message}`);
  if (data !== undefined) {
    console.log(JSON.stringify(data, null, 2));
  }
}

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

function mustPositiveNumber(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new FlowError(`Invalid number value: ${value}`, EXIT_CODES.ARGUMENT_ERROR);
  }
  return parsed;
}

function mustBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  throw new FlowError(`Invalid boolean value: ${value}`, EXIT_CODES.ARGUMENT_ERROR);
}

function trimUrl(url) {
  return url.replace(/\/+$/, "");
}

function parseSseBlock(block) {
  const lines = block.split(/\r?\n/);
  let event = "message";
  const dataLines = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return {
    event,
    data: dataLines.join("\n")
  };
}

function parseSsePayload(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
  } catch {
    // Fallback below.
  }

  return { delta: raw };
}

function getDefaultCode(language, problemSlug) {
  if (problemSlug !== "two-sum") {
    return language === "python" ? "print('todo')" : "int main(){return 0;}";
  }
  if (language === "python") {
    return [
      "def twoSum(nums, target):",
      "    seen = {}",
      "    for i, x in enumerate(nums):",
      "        y = target - x",
      "        if y in seen:",
      "            return [seen[y], i]",
      "        seen[x] = i",
      "    return []"
    ].join("\n");
  }
  return [
    "#include <vector>",
    "#include <unordered_map>",
    "using namespace std;",
    "class Solution {",
    " public:",
    "  vector<int> twoSum(vector<int>& nums, int target) {",
    "    unordered_map<int, int> seen;",
    "    for (int i = 0; i < static_cast<int>(nums.size()); ++i) {",
    "      int y = target - nums[i];",
    "      auto it = seen.find(y);",
    "      if (it != seen.end()) return {it->second, i};",
    "      seen[nums[i]] = i;",
    "    }",
    "    return {};",
    "  }",
    "};"
  ].join("\n");
}

async function requestJson({ method = "GET", url, body, timeoutMs = 10_000 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response;
    try {
      response = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new FlowError(`Request failed @ ${url}: ${message}`, EXIT_CODES.FLOW_ERROR);
    }

    const raw = await response.text();
    const json = (() => {
      try {
        return raw ? JSON.parse(raw) : {};
      } catch {
        return { raw };
      }
    })();

    if (!response.ok) {
      throw new FlowError(`HTTP ${response.status} ${response.statusText} @ ${url}`, EXIT_CODES.FLOW_ERROR, {
        responsePayload: json
      });
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

async function requestAiReviewBySse({ url, body, timeoutMs = 12_000 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new FlowError(`SSE request failed @ ${url}: ${message}`, EXIT_CODES.FLOW_ERROR);
    }

    if (!response.ok) {
      const raw = await response.text();
      let parsed;
      try {
        parsed = raw ? JSON.parse(raw) : {};
      } catch {
        parsed = { raw };
      }
      throw new FlowError(`HTTP ${response.status} ${response.statusText} @ ${url}`, EXIT_CODES.FLOW_ERROR, {
        responsePayload: parsed
      });
    }

    if (!response.body) {
      throw new FlowError(`SSE response body missing @ ${url}`, EXIT_CODES.FLOW_ERROR);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    let guidance = "";
    let source = "";
    let sessionId = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const boundary = buffer.indexOf("\n\n");
        if (boundary < 0) {
          break;
        }

        const rawBlock = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const frame = parseSseBlock(rawBlock);
        if (!frame) {
          continue;
        }

        const payload = parseSsePayload(frame.data);
        if (frame.event === "meta") {
          if (typeof payload.source === "string") {
            source = payload.source;
          }
          if (typeof payload.sessionId === "string") {
            sessionId = payload.sessionId;
          }
          continue;
        }

        if (frame.event === "delta") {
          if (typeof payload.delta === "string" && payload.delta.length > 0) {
            guidance += payload.delta;
          }
          continue;
        }

        if (frame.event === "done") {
          if (typeof payload.guidance === "string" && payload.guidance.length > 0) {
            guidance = payload.guidance;
          }
          if (typeof payload.source === "string" && payload.source.length > 0) {
            source = payload.source;
          }
          if (typeof payload.sessionId === "string" && payload.sessionId.length > 0) {
            sessionId = payload.sessionId;
          }
        }
      }
    }

    if (guidance.length === 0) {
      throw new FlowError("SSE completed but guidance is empty", EXIT_CODES.FLOW_ERROR);
    }

    return {
      guidance,
      source: source || "unknown",
      sessionId
    };
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForTerminalSubmission({ apiBaseUrl, submissionId, pollIntervalMs, pollTimeoutMs }) {
  const deadline = Date.now() + pollTimeoutMs;
  let lastSubmission = null;

  while (Date.now() < deadline) {
    const result = await requestJson({
      url: `${apiBaseUrl}/api/submissions/${submissionId}`,
      timeoutMs: Math.min(5000, pollIntervalMs + 2000)
    });
    lastSubmission = result.item ?? null;
    if (lastSubmission && TERMINAL_STATUSES.has(lastSubmission.status)) {
      return lastSubmission;
    }
    await sleep(pollIntervalMs);
  }

  throw new FlowError(`Polling timeout after ${pollTimeoutMs}ms`, EXIT_CODES.FLOW_ERROR, { lastSubmission });
}

async function fetchDependencySnapshot({ judgeBaseUrl, aiBaseUrl }) {
  const [judge, ai] = await Promise.all([
    requestJson({ url: `${judgeBaseUrl}/health`, timeoutMs: 3000 }),
    requestJson({ url: `${aiBaseUrl}/health`, timeoutMs: 3000 })
  ]);
  return { judge, ai };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = {
    apiBaseUrl: trimUrl(args["api-base-url"] ?? process.env.E2E_API_BASE_URL ?? "http://localhost:3001"),
    aiBaseUrl: trimUrl(args["ai-base-url"] ?? process.env.E2E_AI_BASE_URL ?? "http://localhost:8001"),
    judgeBaseUrl: trimUrl(args["judge-base-url"] ?? process.env.E2E_JUDGE_BASE_URL ?? "http://localhost:8080"),
    problemSlug: args["problem-slug"] ?? process.env.E2E_PROBLEM_SLUG ?? "two-sum",
    language: args.language ?? process.env.E2E_LANGUAGE ?? "python",
    mode: args.mode ?? process.env.E2E_MODE ?? "core",
    expectedStatus: args["expected-status"] ?? process.env.E2E_EXPECTED_STATUS ?? "AC",
    aiReviewMode: args["ai-review-mode"] ?? process.env.E2E_AI_REVIEW_MODE ?? "stream",
    aiProvider: args["ai-provider"] ?? process.env.E2E_AI_PROVIDER ?? "vllm",
    pollIntervalMs: mustPositiveNumber(args["poll-interval-ms"] ?? process.env.E2E_POLL_INTERVAL_MS, 500),
    pollTimeoutMs: mustPositiveNumber(args["poll-timeout-ms"] ?? process.env.E2E_POLL_TIMEOUT_MS, 25_000),
    healthCheckDeps: mustBoolean(args["health-check-deps"] ?? process.env.E2E_HEALTH_CHECK_DEPS, true)
  };
  const code = args.code ?? process.env.E2E_CODE ?? getDefaultCode(config.language, config.problemSlug);

  if (!["python", "cpp"].includes(config.language)) {
    throw new FlowError(`Unsupported language: ${config.language}`, EXIT_CODES.ARGUMENT_ERROR);
  }
  if (!["core", "acm"].includes(config.mode)) {
    throw new FlowError(`Unsupported mode: ${config.mode}`, EXIT_CODES.ARGUMENT_ERROR);
  }
  if (!TERMINAL_STATUSES.has(config.expectedStatus)) {
    throw new FlowError(`Unsupported expected status: ${config.expectedStatus}`, EXIT_CODES.ARGUMENT_ERROR);
  }
  if (!["sync", "stream"].includes(config.aiReviewMode)) {
    throw new FlowError(`Unsupported ai review mode: ${config.aiReviewMode}`, EXIT_CODES.ARGUMENT_ERROR);
  }
  if (!["vllm", "minimax"].includes(config.aiProvider)) {
    throw new FlowError(`Unsupported ai provider: ${config.aiProvider}`, EXIT_CODES.ARGUMENT_ERROR);
  }

  log("config", "Running minimal E2E flow with config", config);
  const apiHealth = await requestJson({ url: `${config.apiBaseUrl}/api/health` });
  log("health", "API health check passed", apiHealth);

  if (config.healthCheckDeps) {
    log("health", "Dependency health check passed", await fetchDependencySnapshot(config));
  }

  const problems = await requestJson({ url: `${config.apiBaseUrl}/api/problems` });
  const hasProblem = Array.isArray(problems.items) && problems.items.some((item) => item.slug === config.problemSlug);
  if (!hasProblem) {
    throw new FlowError(`Problem slug not found in /api/problems: ${config.problemSlug}`, EXIT_CODES.FLOW_ERROR);
  }
  log("problem-list", "Problem found in list", { problemSlug: config.problemSlug });

  const detail = await requestJson({ url: `${config.apiBaseUrl}/api/problems/${config.problemSlug}` });
  log("problem-detail", "Problem detail loaded", {
    slug: detail.item?.slug,
    modeSupport: detail.item?.modeSupport
  });

  const created = await requestJson({
    method: "POST",
    url: `${config.apiBaseUrl}/api/submissions`,
    body: { problemSlug: config.problemSlug, language: config.language, mode: config.mode, code }
  });
  const submissionId = created.item?.id;
  if (!submissionId) {
    throw new FlowError("Submission id missing in create response", EXIT_CODES.FLOW_ERROR, {
      responsePayload: created
    });
  }
  log("submit", "Submission created", { submissionId, status: created.item?.status });

  let finalSubmission;
  try {
    finalSubmission = await waitForTerminalSubmission({ ...config, submissionId });
  } catch (error) {
    if (config.healthCheckDeps) {
      try {
        log("diagnostic", "Dependency snapshot on poll timeout", await fetchDependencySnapshot(config));
      } catch (snapshotError) {
        const message = snapshotError instanceof Error ? snapshotError.message : String(snapshotError);
        log("diagnostic", "Failed to capture dependency snapshot", { message });
      }
    }
    throw error;
  }
  log("judge", "Submission reached terminal status", {
    submissionId,
    status: finalSubmission.status,
    runtimeMs: finalSubmission.runtimeMs,
    memoryKb: finalSubmission.memoryKb,
    errorMessage: finalSubmission.errorMessage
  });

  const aiReviewBody = {
    problemSlug: config.problemSlug,
    submissionId,
    provider: config.aiProvider,
    code,
    status: finalSubmission.status,
    errorMessage: finalSubmission.errorMessage
  };
  const aiReview =
    config.aiReviewMode === "stream"
      ? await requestAiReviewBySse({
          url: `${config.apiBaseUrl}/api/ai/bug-find/stream`,
          body: aiReviewBody
        })
      : await requestJson({
          method: "POST",
          url: `${config.apiBaseUrl}/api/ai/bug-find`,
          body: aiReviewBody
        });
  log("ai-review", "AI review completed", {
    mode: config.aiReviewMode,
    source: aiReview.source,
    sessionId: aiReview.sessionId,
    guidance: aiReview.guidance
  });

  if (finalSubmission.status !== config.expectedStatus) {
    throw new FlowError("Unexpected submission status", EXIT_CODES.UNEXPECTED_STATUS, {
      expectedStatus: config.expectedStatus,
      actualStatus: finalSubmission.status
    });
  }

  log("result", "Minimal E2E flow passed", {
    submissionId,
    finalStatus: finalSubmission.status,
    expectedStatus: config.expectedStatus
  });
  process.exit(EXIT_CODES.SUCCESS);
}

main().catch((error) => {
  const known = error instanceof FlowError;
  const exitCode = known ? error.exitCode : EXIT_CODES.FLOW_ERROR;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[fatal] ${message}`);
  if (known && error.responsePayload) {
    console.error("[fatal] response payload:");
    console.error(JSON.stringify(error.responsePayload, null, 2));
  }
  if (known && error.lastSubmission) {
    console.error("[fatal] last polled submission:");
    console.error(JSON.stringify(error.lastSubmission, null, 2));
  }
  if (known && error.expectedStatus && error.actualStatus) {
    console.error("[fatal] status mismatch:");
    console.error(JSON.stringify({ expected: error.expectedStatus, actual: error.actualStatus }, null, 2));
  }
  process.exit(exitCode);
});
