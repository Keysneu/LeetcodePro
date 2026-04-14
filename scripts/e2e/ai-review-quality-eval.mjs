#!/usr/bin/env node

const EXIT_CODES = {
  SUCCESS: 0,
  ARGUMENT_ERROR: 11,
  FLOW_ERROR: 50,
  QUALITY_GATE_FAILED: 51
};

class FlowError extends Error {
  constructor(message, exitCode, extras = {}) {
    super(message);
    this.exitCode = exitCode;
    Object.assign(this, extras);
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

function toPositiveNumber(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new FlowError(`Invalid positive number: ${value}`, EXIT_CODES.ARGUMENT_ERROR);
  }
  return parsed;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function trimUrl(url) {
  return String(url || "").replace(/\/+$/, "");
}

async function requestJson({ url, method = "GET", body, timeoutMs = 20_000 }) {
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
    let payload = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { raw };
    }

    if (!response.ok) {
      throw new FlowError(`HTTP ${response.status} ${response.statusText} @ ${url}`, EXIT_CODES.FLOW_ERROR, {
        responsePayload: payload
      });
    }

    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function buildScenarios() {
  return [
    {
      id: "wa-empty-return",
      expectedStatus: "WA",
      body: {
        problemSlug: "two-sum",
        language: "python",
        mode: "core",
        status: "WA",
        runtimeMs: 5,
        memoryKb: 960,
        passedCount: 1,
        totalCount: 4,
        errorMessage: "Expected [0,1], got []",
        failureSignals: [
          {
            status: "WA",
            runtimeMs: 5,
            memoryKb: 960,
            signal: "expected [0,1], got []"
          }
        ],
        code: [
          "def twoSum(nums, target):",
          "    seen = {}",
          "    for i, x in enumerate(nums):",
          "        y = target - x",
          "        if y in seen:",
          "            return [seen[y], i]",
          "        seen[x] = i",
          "    return []"
        ].join("\n")
      }
    },
    {
      id: "tle-double-loop",
      expectedStatus: "TLE",
      body: {
        problemSlug: "two-sum",
        language: "python",
        mode: "core",
        status: "TLE",
        runtimeMs: 1200,
        memoryKb: 2048,
        passedCount: 6,
        totalCount: 20,
        errorMessage: "Time limit exceeded",
        failureSignals: [
          {
            status: "TLE",
            runtimeMs: 1200,
            memoryKb: 2048,
            signal: "public case timeout"
          }
        ],
        code: [
          "def twoSum(nums, target):",
          "    for i in range(len(nums)):",
          "        for j in range(i + 1, len(nums)):",
          "            if nums[i] + nums[j] == target:",
          "                return [i, j]",
          "    return []"
        ].join("\n")
      }
    },
    {
      id: "ce-line-number",
      expectedStatus: "CE",
      body: {
        problemSlug: "two-sum",
        language: "cpp",
        mode: "core",
        status: "CE",
        runtimeMs: null,
        memoryKb: null,
        passedCount: 0,
        totalCount: 1,
        errorMessage: "main.cpp:6:10: error: expected ';' before 'return'",
        failureSignals: [
          {
            status: "CE",
            runtimeMs: null,
            memoryKb: null,
            signal: "compile failed"
          }
        ],
        code: [
          "class Solution {",
          "public:",
          "  vector<int> twoSum(vector<int>& nums, int target) {",
          "    unordered_map<int,int> seen",
          "    return {};",
          "  }",
          "};"
        ].join("\n")
      }
    },
    {
      id: "ac-optimization-review",
      expectedStatus: "AC",
      body: {
        problemSlug: "two-sum",
        language: "python",
        mode: "core",
        status: "AC",
        runtimeMs: 8,
        memoryKb: 1024,
        passedCount: 20,
        totalCount: 20,
        errorMessage: null,
        failureSignals: [],
        code: [
          "def twoSum(nums, target):",
          "    seen = {}",
          "    for i, x in enumerate(nums):",
          "        y = target - x",
          "        if y in seen:",
          "            return [seen[y], i]",
          "        seen[x] = i",
          "    return []"
        ].join("\n")
      }
    }
  ];
}

function scoreNonAcResponse(guidance, body) {
  const structure =
    hasAny(guidance, [/主要问题/]) &&
    hasAny(guidance, [/具体修改建议|具体修改/]) &&
    hasAny(guidance, [/证据与快速验证|证据/]);

  const actionable = hasAny(guidance, [/1\./, /2\./, /修改/, /修复/]);
  const evidence =
    hasAny(guidance, [
      new RegExp(`${body.passedCount ?? ""}/${body.totalCount ?? ""}`),
      /错误信息|runtime|memory|通过=/i,
      /failure|失败信号/
    ]) || (typeof body.errorMessage === "string" && body.errorMessage.length > 0 && guidance.includes("error"));

  const localized = hasAny(guidance, [/第\s*\d+\s*行/, /return \[\]/, /循环/, /边界/, /状态更新/]);

  let score = 0;
  if (structure) score += 35;
  if (actionable) score += 25;
  if (evidence) score += 20;
  if (localized) score += 20;

  return {
    score: clampScore(score),
    checks: {
      structure,
      actionable,
      evidence,
      localized
    }
  };
}

function scoreAcResponse(guidance, body) {
  const structure =
    hasAny(guidance, [/通过后优化评审/]) &&
    hasAny(guidance, [/性能与复杂度/]) &&
    hasAny(guidance, [/代码规范|可维护性/]) &&
    hasAny(guidance, [/稳定性|边界/]);

  const actionable = hasAny(guidance, [/优先改进清单/, /1\./, /2\./]);
  const evidence = hasAny(guidance, [
    new RegExp(`${body.passedCount ?? ""}/${body.totalCount ?? ""}`),
    /判题指标|runtime|memory|通过=/i,
    /代码信号|代码片段信号/
  ]);

  let score = 0;
  if (structure) score += 40;
  if (actionable) score += 30;
  if (evidence) score += 30;

  return {
    score: clampScore(score),
    checks: {
      structure,
      actionable,
      evidence,
      localized: true
    }
  };
}

function evaluateCase({ scenario, response }) {
  const guidance = typeof response.guidance === "string" ? response.guidance : "";

  if (guidance.trim().length === 0) {
    return {
      score: 0,
      checks: {
        structure: false,
        actionable: false,
        evidence: false,
        localized: false
      },
      guidancePreview: ""
    };
  }

  const result = scenario.expectedStatus === "AC"
    ? scoreAcResponse(guidance, scenario.body)
    : scoreNonAcResponse(guidance, scenario.body);

  return {
    ...result,
    guidancePreview: guidance.slice(0, 220)
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiBaseUrl = trimUrl(args["api-base-url"] || "http://localhost:3001");
  const provider = String(args.provider || process.env.P1_AI_PROVIDER || "vllm").trim();

  const timeoutMs = toPositiveNumber(args["timeout-ms"], 30_000);
  const minCaseScore = toPositiveNumber(args["min-case-score"], 70);
  const minOverallScore = toPositiveNumber(args["min-overall-score"], 80);

  if (!apiBaseUrl.startsWith("http://") && !apiBaseUrl.startsWith("https://")) {
    throw new FlowError(`Invalid --api-base-url: ${apiBaseUrl}`, EXIT_CODES.ARGUMENT_ERROR);
  }

  const health = await requestJson({ url: `${apiBaseUrl}/api/health`, timeoutMs: 6_000 });
  if (!health || health.status !== "ok") {
    throw new FlowError("API health check failed before quality evaluation", EXIT_CODES.FLOW_ERROR, { health });
  }

  const scenarios = buildScenarios();
  const details = [];

  for (const scenario of scenarios) {
    const response = await requestJson({
      url: `${apiBaseUrl}/api/ai/bug-find`,
      method: "POST",
      body: {
        ...scenario.body,
        provider
      },
      timeoutMs
    });

    const evaluation = evaluateCase({ scenario, response });

    details.push({
      id: scenario.id,
      expectedStatus: scenario.expectedStatus,
      source: response.source ?? "unknown",
      provider: response.provider ?? provider,
      sessionId: response.sessionId ?? "",
      score: evaluation.score,
      checks: evaluation.checks,
      guidancePreview: evaluation.guidancePreview
    });
  }

  const total = details.reduce((acc, item) => acc + item.score, 0);
  const overallScore = clampScore(total / details.length);
  const failedCases = details.filter((item) => item.score < minCaseScore).map((item) => item.id);

  const report = {
    summary: failedCases.length === 0 && overallScore >= minOverallScore
      ? "ai review quality gate passed"
      : "ai review quality gate failed",
    provider,
    minCaseScore,
    minOverallScore,
    overallScore,
    failedCases,
    details
  };

  console.log(JSON.stringify(report, null, 2));

  if (failedCases.length > 0 || overallScore < minOverallScore) {
    process.exit(EXIT_CODES.QUALITY_GATE_FAILED);
  }

  process.exit(EXIT_CODES.SUCCESS);
}

main().catch((error) => {
  if (error instanceof FlowError) {
    console.error(
      JSON.stringify(
        {
          summary: "ai review quality flow error",
          message: error.message,
          ...(error.responsePayload ? { responsePayload: error.responsePayload } : {}),
          ...(error.health ? { health: error.health } : {})
        },
        null,
        2
      )
    );
    process.exit(error.exitCode);
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ summary: "unexpected error", message }, null, 2));
  process.exit(EXIT_CODES.FLOW_ERROR);
});
