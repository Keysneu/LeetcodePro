import { BadGatewayException, Body, Controller, Post, Res } from "@nestjs/common";
import { AiProvider, normalizeAiProvider } from "./ai-provider";
import { query } from "./db";

type ReviewBody = {
  problemSlug?: string;
  submissionId?: string;
  sessionId?: string;
  provider?: string;
  language?: "cpp" | "python";
  mode?: "core" | "acm";
  runtimeMs?: number | null;
  memoryKb?: number | null;
  passedCount?: number | null;
  totalCount?: number | null;
  failureSignals?: ReviewFailureSignal[];
  code?: string;
  status?: string;
  errorMessage?: string | null;
};

type SolutionBody = {
  problemSlug?: string;
  problemTitle?: string;
  modeSupport?: string;
  preferredLanguage?: "cpp" | "python";
  description?: string;
  sampleInput?: string;
  sampleOutput?: string;
  sessionId?: string;
  provider?: string;
};

type AiTutorResponse = {
  guidance?: string;
  source?: string;
  provider?: string;
};

type AiTutorSolutionResponse = {
  editorial?: string;
  source?: string;
  provider?: string;
};

type AiMessageRole = "user" | "assistant" | "system";

type ReviewFailureSignal = {
  status: string;
  runtimeMs: number | null;
  memoryKb: number | null;
  signal: string;
};

type UserRow = {
  id: string;
};

type IdRow = {
  id: string;
};

type SubmissionInsightRow = {
  id: string;
  problemSlug: string;
  language: "cpp" | "python";
  mode: "core" | "acm";
  code: string;
  status: string;
  runtimeMs: number | null;
  memoryKb: number | null;
  passedCount: number | null;
  totalCount: number | null;
  errorMessage: string | null;
};

type SubmissionFailureSignalRow = {
  status: string;
  runtimeMs: number | null;
  memoryKb: number | null;
  stderr: string | null;
  isHidden: boolean;
};

type SseFrame = {
  event: string;
  data: string;
};

type ParsedSsePayload = Record<string, unknown> | string;

const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL ?? "demo@leetcodepro.local";
const AI_TUTOR_TIMEOUT_MS = Number(process.env.AI_TUTOR_TIMEOUT_MS ?? 12000);
const AI_TUTOR_MINIMAX_TIMEOUT_MS = Number(process.env.AI_TUTOR_MINIMAX_TIMEOUT_MS ?? 90000);
const AI_TUTOR_REVIEW_TIMEOUT_MS = Number(process.env.AI_TUTOR_REVIEW_TIMEOUT_MS ?? 30000);
const AI_TUTOR_REVIEW_MINIMAX_TIMEOUT_MS = Number(
  process.env.AI_TUTOR_REVIEW_MINIMAX_TIMEOUT_MS ?? AI_TUTOR_MINIMAX_TIMEOUT_MS
);
const AI_TUTOR_SOLUTION_TIMEOUT_MS = Number(process.env.AI_TUTOR_SOLUTION_TIMEOUT_MS ?? AI_TUTOR_TIMEOUT_MS);
const AI_TUTOR_SOLUTION_MINIMAX_TIMEOUT_MS = Number(
  process.env.AI_TUTOR_SOLUTION_MINIMAX_TIMEOUT_MS ?? 210000
);

type SseResponse = {
  status(code: number): SseResponse;
  setHeader(name: string, value: string): void;
  flushHeaders(): void;
  write(chunk: string): void;
  end(): void;
  on(event: "close", listener: () => void): void;
  writableEnded: boolean;
  destroyed: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function writeSseEvent(res: SseResponse, event: string, payload: Record<string, unknown>): void {
  if (res.writableEnded || res.destroyed) {
    return;
  }

  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function parseSseFrame(rawBlock: string): SseFrame | null {
  const lines = rawBlock.split(/\r?\n/);
  let event = "message";
  const dataLines: string[] = [];

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

function parseSsePayload(raw: string): ParsedSsePayload {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isRecord(parsed)) {
      return parsed;
    }
  } catch {
    // Intentionally return raw text for non-JSON payload.
  }

  return raw;
}

function findSseBoundary(buffer: string): { index: number; separatorLength: number } | null {
  const lfBoundary = buffer.indexOf("\n\n");
  const crlfBoundary = buffer.indexOf("\r\n\r\n");

  if (lfBoundary < 0 && crlfBoundary < 0) {
    return null;
  }

  if (lfBoundary < 0) {
    return { index: crlfBoundary, separatorLength: 4 };
  }

  if (crlfBoundary < 0) {
    return { index: lfBoundary, separatorLength: 2 };
  }

  return lfBoundary < crlfBoundary
    ? { index: lfBoundary, separatorLength: 2 }
    : { index: crlfBoundary, separatorLength: 4 };
}

function readStringField(payload: ParsedSsePayload, field: string): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const value = payload[field];
  return typeof value === "string" ? value : null;
}

async function readUpstreamErrorMessage(response: Response, fallbackMessage: string): Promise<string> {
  try {
    const payload = (await response.json()) as unknown;
    if (isRecord(payload)) {
      if (typeof payload.detail === "string" && payload.detail.trim().length > 0) {
        return payload.detail;
      }
      if (typeof payload.message === "string" && payload.message.trim().length > 0) {
        return payload.message;
      }
      if (Array.isArray(payload.message) && typeof payload.message[0] === "string") {
        return payload.message[0];
      }
    }
  } catch {
    // Ignore and try text fallback.
  }

  try {
    const rawText = await response.text();
    if (rawText.trim().length > 0) {
      return rawText.slice(0, 240);
    }
  } catch {
    // Ignore text fallback failure.
  }

  return fallbackMessage;
}

function resolveAiTutorTimeoutMs(provider: AiProvider | null): number {
  if (provider === "minimax") {
    return AI_TUTOR_MINIMAX_TIMEOUT_MS;
  }
  return AI_TUTOR_TIMEOUT_MS;
}

function resolveAiTutorReviewTimeoutMs(provider: AiProvider | null): number {
  if (provider === "minimax") {
    return AI_TUTOR_REVIEW_MINIMAX_TIMEOUT_MS;
  }
  return AI_TUTOR_REVIEW_TIMEOUT_MS;
}

function resolveAiTutorSolutionTimeoutMs(provider: AiProvider | null): number {
  if (provider === "minimax") {
    return AI_TUTOR_SOLUTION_MINIMAX_TIMEOUT_MS;
  }
  return AI_TUTOR_SOLUTION_TIMEOUT_MS;
}

function normalizeSolutionErrorMessage(provider: AiProvider | null, rawMessage: string | null): string {
  const providerLabel = provider ?? "AI";
  const fallback = `${providerLabel} 题解生成失败，请稍后重试。`;
  const timeoutMessage = `${providerLabel} 题解请求超时，请稍后重试。`;
  const message = (rawMessage ?? "").trim();

  if (message.length === 0) {
    return fallback;
  }

  const normalized = message.toLowerCase();
  const timeoutSignals = [
    "aborterror",
    "aborted",
    "operation was aborted",
    "timeout",
    "timed out",
    "etimedout",
    "deadline exceeded"
  ];

  if (timeoutSignals.some((item) => normalized.includes(item))) {
    return timeoutMessage;
  }

  if (message.includes("题解") || message.includes("稍后重试") || message.includes("超时")) {
    return message.slice(0, 240);
  }

  return fallback;
}

@Controller("ai")
export class AiController {
  @Post("bug-find")
  async bugFind(@Body() body: ReviewBody) {
    return this.review(body);
  }

  @Post("review")
  async review(@Body() body: ReviewBody) {
    const aiTutorBaseUrl = process.env.AI_TUTOR_BASE_URL ?? "http://localhost:8000";
    let provider: AiProvider | null = normalizeAiProvider(body.provider);
    const sessionId = await this.ensureReviewSession(body);
    const tutorRequestBody = await this.buildAiTutorReviewPayload(body, sessionId, provider);
    const fallbackMessage = this.buildFallbackGuidance(tutorRequestBody);
    await this.appendAiMessage(sessionId, "user", this.buildUserReviewContext(tutorRequestBody));

    let guidance = fallbackMessage;
    let source = "api-fallback";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), resolveAiTutorReviewTimeoutMs(provider));

      const response = await fetch(`${aiTutorBaseUrl}/bug-find`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(tutorRequestBody),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (response.ok) {
        const json = (await response.json()) as AiTutorResponse;
        guidance = json.guidance ?? fallbackMessage;
        source = json.source ?? "ai-tutor";
        provider = normalizeAiProvider(json.provider) ?? provider;
      }
    } catch {
      // Fallback below.
    }

    await this.appendAiMessage(sessionId, "assistant", guidance, { source, provider });

    return {
      sessionId,
      guidance,
      source,
      provider
    };
  }

  @Post("bug-find/stream")
  async bugFindStream(@Body() body: ReviewBody, @Res() res: SseResponse): Promise<void> {
    return this.reviewStream(body, res);
  }

  @Post("review/stream")
  async reviewStream(@Body() body: ReviewBody, @Res() res: SseResponse): Promise<void> {
    const aiTutorBaseUrl = process.env.AI_TUTOR_BASE_URL ?? "http://localhost:8000";
    let provider: AiProvider | null = normalizeAiProvider(body.provider);
    const sessionId = await this.ensureReviewSession(body);
    const tutorRequestBody = await this.buildAiTutorReviewPayload(body, sessionId, provider);
    const fallbackMessage = this.buildFallbackGuidance(tutorRequestBody);
    await this.appendAiMessage(sessionId, "user", this.buildUserReviewContext(tutorRequestBody));

    res.status(200);
    res.setHeader("content-type", "text/event-stream; charset=utf-8");
    res.setHeader("cache-control", "no-cache, no-transform");
    res.setHeader("connection", "keep-alive");
    res.setHeader("x-accel-buffering", "no");
    res.flushHeaders();

    writeSseEvent(res, "meta", {
      sessionId: sessionId ?? "",
      source: "api-proxy",
      provider
    });

    let source = "ai-tutor";
    let guidance = "";
    let doneSent = false;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), resolveAiTutorReviewTimeoutMs(provider));

    res.on("close", () => {
      controller.abort();
    });

    try {
      const upstream = await fetch(`${aiTutorBaseUrl}/bug-find/stream`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(tutorRequestBody),
        signal: controller.signal
      });

      if (!upstream.ok || !upstream.body) {
        throw new Error(`Upstream SSE unavailable: ${upstream.status}`);
      }

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const handleFrame = (frame: SseFrame) => {
        const payload = parseSsePayload(frame.data);

        if (frame.event === "meta") {
          source = readStringField(payload, "source") ?? source;
          provider = normalizeAiProvider(readStringField(payload, "provider")) ?? provider;
          writeSseEvent(res, "meta", {
            sessionId: sessionId ?? "",
            source,
            provider
          });
          return;
        }

        if (frame.event === "delta") {
          const delta = readStringField(payload, "delta") ?? (typeof payload === "string" ? payload : "");
          if (delta.length > 0) {
            guidance += delta;
            writeSseEvent(res, "delta", { delta });
          }
          return;
        }

        if (frame.event === "done") {
          source = readStringField(payload, "source") ?? source;
          provider = normalizeAiProvider(readStringField(payload, "provider")) ?? provider;
          const finalGuidance = readStringField(payload, "guidance");
          if (finalGuidance && finalGuidance.length > 0) {
            guidance = finalGuidance;
          }

          writeSseEvent(res, "done", {
            sessionId: sessionId ?? "",
            source,
            guidance,
            provider
          });
          doneSent = true;
        }
      };

      const consumeBuffer = () => {
        while (true) {
          const boundary = findSseBoundary(buffer);
          if (!boundary) {
            break;
          }

          const rawFrame = buffer.slice(0, boundary.index);
          buffer = buffer.slice(boundary.index + boundary.separatorLength);
          const frame = parseSseFrame(rawFrame);
          if (!frame) {
            continue;
          }
          handleFrame(frame);
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        consumeBuffer();
      }

      buffer += decoder.decode();
      consumeBuffer();
      if (buffer.trim().length > 0) {
        const tailFrame = parseSseFrame(buffer.trim());
        if (tailFrame) {
          handleFrame(tailFrame);
        }
      }
    } catch {
      source = "api-fallback";
      guidance = fallbackMessage;
      writeSseEvent(res, "delta", { delta: guidance });
      writeSseEvent(res, "done", {
        sessionId: sessionId ?? "",
        source,
        guidance,
        provider
      });
      doneSent = true;
    } finally {
      clearTimeout(timeout);
    }

    if (!doneSent) {
      if (guidance.length === 0) {
        source = "api-fallback";
        guidance = fallbackMessage;
        writeSseEvent(res, "delta", { delta: guidance });
      }

      writeSseEvent(res, "done", {
        sessionId: sessionId ?? "",
        source,
        guidance,
        provider
      });
    }

    await this.appendAiMessage(sessionId, "assistant", guidance, { source, provider });
    res.end();
  }

  @Post("solution")
  async solution(@Body() body: SolutionBody) {
    const aiTutorBaseUrl = process.env.AI_TUTOR_BASE_URL ?? "http://localhost:8000";
    let provider: AiProvider | null = normalizeAiProvider(body.provider);
    const sessionId = await this.ensureSolutionSession(body);
    await this.appendAiMessage(sessionId, "user", this.buildUserSolutionContext(body));

    let editorial = "";
    let source = "ai-tutor";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), resolveAiTutorSolutionTimeoutMs(provider));

      const response = await fetch(`${aiTutorBaseUrl}/solution`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          ...body,
          sessionId,
          ...(provider ? { provider } : {})
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const upstreamMessage = await readUpstreamErrorMessage(
          response,
          `${provider ?? "AI"} 题解生成失败，请稍后重试。`
        );
        throw new BadGatewayException(normalizeSolutionErrorMessage(provider, upstreamMessage));
      }

      const json = (await response.json()) as AiTutorSolutionResponse;
      editorial = json.editorial ?? "";
      source = json.source ?? "ai-tutor";
      provider = normalizeAiProvider(json.provider) ?? provider;

      if (editorial.trim().length === 0) {
        throw new BadGatewayException(normalizeSolutionErrorMessage(provider, null));
      }
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      const message = error instanceof Error ? `${error.name}: ${error.message}` : null;
      throw new BadGatewayException(normalizeSolutionErrorMessage(provider, message));
    }

    await this.appendAiMessage(sessionId, "assistant", editorial, { source, provider, type: "solution" });

    return {
      sessionId,
      editorial,
      source,
      provider
    };
  }

  @Post("solution/stream")
  async solutionStream(@Body() body: SolutionBody, @Res() res: SseResponse): Promise<void> {
    const aiTutorBaseUrl = process.env.AI_TUTOR_BASE_URL ?? "http://localhost:8000";
    let provider: AiProvider | null = normalizeAiProvider(body.provider);
    const sessionId = await this.ensureSolutionSession(body);
    await this.appendAiMessage(sessionId, "user", this.buildUserSolutionContext(body));

    res.status(200);
    res.setHeader("content-type", "text/event-stream; charset=utf-8");
    res.setHeader("cache-control", "no-cache, no-transform");
    res.setHeader("connection", "keep-alive");
    res.setHeader("x-accel-buffering", "no");
    res.flushHeaders();

    writeSseEvent(res, "meta", {
      sessionId: sessionId ?? "",
      source: "api-proxy",
      provider
    });

    let source = "ai-tutor";
    let editorial = "";
    let streamError = "";
    let doneSent = false;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), resolveAiTutorSolutionTimeoutMs(provider));

    res.on("close", () => {
      controller.abort();
    });

    try {
      const upstream = await fetch(`${aiTutorBaseUrl}/solution/stream`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          ...body,
          sessionId,
          ...(provider ? { provider } : {})
        }),
        signal: controller.signal
      });

      if (!upstream.ok || !upstream.body) {
        const upstreamMessage = await readUpstreamErrorMessage(
          upstream,
          `${provider ?? "AI"} 题解生成失败，请稍后重试。`
        );
        throw new Error(normalizeSolutionErrorMessage(provider, upstreamMessage));
      }

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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

          const rawFrame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const frame = parseSseFrame(rawFrame);

          if (!frame) {
            continue;
          }

          const payload = parseSsePayload(frame.data);

          if (frame.event === "meta") {
            source = readStringField(payload, "source") ?? source;
            provider = normalizeAiProvider(readStringField(payload, "provider")) ?? provider;
            writeSseEvent(res, "meta", {
              sessionId: sessionId ?? "",
              source,
              provider
            });
            continue;
          }

          if (frame.event === "delta") {
            const delta = readStringField(payload, "delta") ?? (typeof payload === "string" ? payload : "");
            if (delta.length > 0) {
              editorial += delta;
              writeSseEvent(res, "delta", { delta });
            }
            continue;
          }

          if (frame.event === "error") {
            source = readStringField(payload, "source") ?? "ai-tutor-error";
            provider = normalizeAiProvider(readStringField(payload, "provider")) ?? provider;
            const message = normalizeSolutionErrorMessage(
              provider,
              readStringField(payload, "message") ?? readStringField(payload, "error")
            );
            streamError = message;
            writeSseEvent(res, "error", {
              sessionId: sessionId ?? "",
              source,
              provider,
              message
            });
            continue;
          }

          if (frame.event === "done") {
            source = readStringField(payload, "source") ?? source;
            provider = normalizeAiProvider(readStringField(payload, "provider")) ?? provider;
            const finalEditorial = readStringField(payload, "editorial");
            const finalError = readStringField(payload, "error");
            if (finalEditorial && finalEditorial.length > 0) {
              editorial = finalEditorial;
            }
            if (finalError && finalError.length > 0) {
              streamError = normalizeSolutionErrorMessage(provider, finalError);
            }

            writeSseEvent(res, "done", {
              sessionId: sessionId ?? "",
              source,
              editorial,
              provider,
              ...(streamError ? { error: streamError } : {})
            });
            doneSent = true;
          }
        }
      }
    } catch (error) {
      source = "api-error";
      const message = error instanceof Error ? `${error.name}: ${error.message}` : null;
      streamError = normalizeSolutionErrorMessage(provider, message);
      writeSseEvent(res, "error", {
        sessionId: sessionId ?? "",
        source,
        provider,
        message: streamError
      });
      writeSseEvent(res, "done", {
        sessionId: sessionId ?? "",
        source,
        editorial,
        provider,
        error: streamError
      });
      doneSent = true;
    } finally {
      clearTimeout(timeout);
    }

    if (!doneSent) {
      if (editorial.length === 0) {
        source = "api-error";
        if (streamError.length === 0) {
          streamError = normalizeSolutionErrorMessage(provider, null);
        }
        writeSseEvent(res, "error", {
          sessionId: sessionId ?? "",
          source,
          provider,
          message: streamError
        });
      }

      writeSseEvent(res, "done", {
        sessionId: sessionId ?? "",
        source,
        editorial,
        provider,
        ...(streamError ? { error: streamError } : {})
      });
    }

    if (editorial.length > 0) {
      await this.appendAiMessage(sessionId, "assistant", editorial, { source, provider, type: "solution" });
    } else if (streamError.length > 0) {
      await this.appendAiMessage(sessionId, "assistant", streamError, {
        source,
        provider,
        type: "solution-error"
      });
    }
    res.end();
  }

  private buildFallbackGuidance(body: ReviewBody): string {
    const codeSignals = this.extractCodeSignals(body.code ?? "");
    const codeFindings = this.extractCodeFindings(body.code ?? "", body.status, body.errorMessage);
    const metricLine = [
      `状态=${body.status ?? "unknown"}`,
      `通过=${body.passedCount ?? "?"}/${body.totalCount ?? "?"}`,
      `runtime=${body.runtimeMs ?? "?"}ms`,
      `memory=${body.memoryKb ?? "?"}KB`
    ].join("，");

    const failureLine = body.failureSignals?.length
      ? body.failureSignals.map((item) => `${item.status}:${item.signal}`).join(" | ")
      : "暂无逐用例失败信号";
    const findingsBlock = codeFindings.map((item) => `- ${item}`).join("\n");
    const normalizedStatus = (body.status ?? "").toUpperCase();

    if (normalizedStatus === "AC") {
      return [
        "通过后优化评审（当前已 AC）",
        "",
        "1) 性能与复杂度",
        "- 当前提交已通过，建议先确认复杂度量级是否达到该题常见最优解水平，再决定是否重构。",
        "",
        "2) 代码规范与可维护性",
        "- 优先审查状态更新顺序与关键分支可读性，必要时拆分为小函数并补充注释。",
        "",
        "3) 稳定性与边界覆盖",
        "- 针对空输入、单元素、重复值、极值做回归，确认优化后仍稳定 AC。",
        "",
        "优先改进清单",
        "1. 先做复杂度复核，再决定是否引入更优数据结构。",
        "2. 把关键状态变量和边界分支写得更显式，降低维护风险。",
        "3. 补齐边界回归 + 大输入压测。",
        "",
        "证据与验证",
        `- 判题指标：${metricLine}`,
        `- 错误信息：${body.errorMessage ?? "none"}`,
        `- 失败信号：${failureLine}`,
        `- 代码侧信号：${codeSignals.join("；")}`
      ].join("\n");
    }

    return [
      "主要问题（按优先级）",
      findingsBlock,
      `- 代码侧信号：${codeSignals.join("；")}`,
      "",
      "具体修改建议",
      "1. 优先修复第一条问题对应的可疑分支或语句，再重新提交观察状态变化。",
      "2. 对关键状态变量按执行顺序逐步核对，确认首次偏离预期的位置。",
      "3. 若涉及数组/哈希访问，补齐边界保护并验证空输入与极值场景。",
      "",
      "证据与快速验证",
      `- 判题指标：${metricLine}`,
      `- 错误信息：${body.errorMessage ?? "none"}`,
      `- 失败信号：${failureLine}`,
      "- 最小回归：失败样例 + 空输入/单元素/重复值/极值。"
    ].join("\n");
  }

  private buildFallbackEditorial(body: SolutionBody): string {
    const title = body.problemTitle ?? body.problemSlug ?? "当前题目";
    const language = body.preferredLanguage ?? "cpp";

    return [
      `题目：${title}`,
      "",
      "一、核心思路",
      "1) 先从题目约束反推出可接受复杂度，再选主算法。",
      "2) 明确循环不变式或状态定义，保证每一步推导可验证。",
      "3) 先覆盖最小样例与边界样例，再扩展到一般情况。",
      "",
      "二、复杂度分析",
      "- 时间复杂度：请根据你最终采用的主循环结构逐项计算。",
      "- 空间复杂度：统计辅助容器与递归栈开销。",
      "",
      `三、${language.toUpperCase()} 代码骨架`,
      "- 先写函数签名与输入校验。",
      "- 在主循环中维护关键状态，最后统一返回结果。",
      "",
      "四、易错点",
      "- 空输入/单元素/重复值/极值边界。",
      "- 下标越界与整数溢出。",
      "- 更新状态与判定顺序不一致。"
    ].join("\n");
  }

  private buildUserReviewContext(body: ReviewBody): string {
    return JSON.stringify(
      {
        problemSlug: body.problemSlug ?? null,
        submissionId: body.submissionId ?? null,
        provider: normalizeAiProvider(body.provider),
        language: body.language ?? null,
        mode: body.mode ?? null,
        status: body.status ?? null,
        runtimeMs: body.runtimeMs ?? null,
        memoryKb: body.memoryKb ?? null,
        passedCount: body.passedCount ?? null,
        totalCount: body.totalCount ?? null,
        failureSignals: body.failureSignals ?? [],
        errorMessage: body.errorMessage ?? null,
        code: body.code?.slice(0, 8000) ?? null
      },
      null,
      2
    );
  }

  private buildUserSolutionContext(body: SolutionBody): string {
    return JSON.stringify(
      {
        problemSlug: body.problemSlug ?? null,
        problemTitle: body.problemTitle ?? null,
        modeSupport: body.modeSupport ?? null,
        provider: normalizeAiProvider(body.provider),
        preferredLanguage: body.preferredLanguage ?? "cpp",
        description: body.description?.slice(0, 12000) ?? null,
        sampleInput: body.sampleInput?.slice(0, 2000) ?? null,
        sampleOutput: body.sampleOutput?.slice(0, 2000) ?? null
      },
      null,
      2
    );
  }

  private async buildAiTutorReviewPayload(
    body: ReviewBody,
    sessionId: string | null,
    provider: AiProvider | null
  ): Promise<ReviewBody> {
    const normalizedProvider = provider ?? normalizeAiProvider(body.provider);
    const basePayload: ReviewBody = {
      ...body,
      sessionId: sessionId ?? undefined,
      provider: normalizedProvider ?? undefined
    };

    if (!body.submissionId) {
      return basePayload;
    }

    try {
      const submissionResult = await query<SubmissionInsightRow>(
        `
          SELECT
            submissions.id,
            problems.slug AS "problemSlug",
            submissions.language,
            submissions.mode,
            submissions.code,
            submissions.status,
            submissions.runtime_ms AS "runtimeMs",
            submissions.memory_kb AS "memoryKb",
            submissions.passed_count AS "passedCount",
            submissions.total_count AS "totalCount",
            submissions.error_message AS "errorMessage"
          FROM submissions
          INNER JOIN problems ON problems.id = submissions.problem_id
          WHERE submissions.id = $1
          LIMIT 1;
        `,
        [body.submissionId]
      );

      const row = submissionResult.rows[0];
      if (!row) {
        return basePayload;
      }

      const failureSignals = await this.loadSubmissionFailureSignals(row.id);

      return {
        ...basePayload,
        problemSlug: basePayload.problemSlug ?? row.problemSlug,
        language: basePayload.language ?? row.language,
        mode: basePayload.mode ?? row.mode,
        code: basePayload.code ?? row.code,
        status: basePayload.status ?? row.status,
        runtimeMs: basePayload.runtimeMs ?? row.runtimeMs,
        memoryKb: basePayload.memoryKb ?? row.memoryKb,
        passedCount: basePayload.passedCount ?? row.passedCount,
        totalCount: basePayload.totalCount ?? row.totalCount,
        errorMessage: basePayload.errorMessage ?? row.errorMessage,
        failureSignals: basePayload.failureSignals?.length ? basePayload.failureSignals : failureSignals
      };
    } catch {
      return basePayload;
    }
  }

  private async loadSubmissionFailureSignals(submissionId: string): Promise<ReviewFailureSignal[]> {
    const result = await query<SubmissionFailureSignalRow>(
      `
        SELECT
          scr.status,
          scr.runtime_ms AS "runtimeMs",
          scr.memory_kb AS "memoryKb",
          LEFT(scr.stderr, 600) AS stderr,
          tc.is_hidden AS "isHidden"
        FROM submission_case_results scr
        INNER JOIN test_cases tc ON tc.id = scr.case_id
        WHERE scr.submission_id = $1
          AND scr.status <> 'AC'
        ORDER BY tc.is_hidden ASC, scr.id ASC
        LIMIT 5;
      `,
      [submissionId]
    );

    return result.rows.map((row) => ({
      status: row.status,
      runtimeMs: row.runtimeMs,
      memoryKb: row.memoryKb,
      signal: this.summarizeFailureSignal(row)
    }));
  }

  private summarizeFailureSignal(row: SubmissionFailureSignalRow): string {
    if (row.isHidden) {
      return "隐藏用例未通过，请重点复核边界条件、状态转移与复杂度。";
    }

    const stderr = row.stderr?.trim() ?? "";
    if (stderr.length === 0) {
      return "公开用例未通过，但暂无 stderr 细节。";
    }

    const oneLine = stderr.replace(/\s+/g, " ").slice(0, 220);
    return oneLine;
  }

  private extractCodeSignals(code: string): string[] {
    const trimmed = code.trim();
    if (trimmed.length === 0) {
      return ["代码为空"];
    }

    const signals: string[] = [];
    const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0);
    signals.push(`有效行数约 ${lines.length}`);

    if (/TODO|pass/i.test(trimmed)) {
      signals.push("存在占位实现（TODO/pass）");
    }
    if (/\bfor\b|\bwhile\b/i.test(trimmed)) {
      signals.push("包含循环逻辑");
    }
    if (/unordered_map|dict\(|map<|hash/i.test(trimmed)) {
      signals.push("使用哈希结构");
    }
    if (/return\s*\[\s*\]|return\s*\{\s*\}/i.test(trimmed)) {
      signals.push("包含空结果返回分支");
    }

    return signals.slice(0, 4);
  }

  private extractCodeFindings(code: string, status?: string, errorMessage?: string | null): string[] {
    const trimmed = code.trim();
    const findings: string[] = [];

    const runtimeLine = this.extractLineNumberFromError(errorMessage);
    if (runtimeLine !== null) {
      const line = this.getCodeLine(trimmed, runtimeLine);
      if (line) {
        findings.push(`第${runtimeLine}行附近直接触发报错：\`${line}\`。`);
      }
    }

    const placeholder = this.findPatternLine(trimmed, [/\bpass\b/i, /\bTODO\b/i]);
    if (placeholder) {
      findings.push(`第${placeholder.line}行仍是占位实现：\`${placeholder.text}\`。`);
    }

    const emptyReturn = this.findPatternLine(trimmed, [/return\s*\[\s*\]/i, /return\s*\{\s*\}/i]);
    if (status === "WA" && emptyReturn) {
      findings.push(`第${emptyReturn.line}行存在空结果返回：\`${emptyReturn.text}\`，可能导致错误答案。`);
    }

    const loop = this.findPatternLine(trimmed, [/\bwhile\b/i, /\bfor\b/i]);
    if (status === "TLE" && loop) {
      findings.push(`第${loop.line}行开始的循环是超时重点：\`${loop.text}\`。`);
    }

    if (findings.length > 0) {
      return findings.slice(0, 3);
    }

    if (status === "AC") {
      return ["代码功能已通过，本次无功能性 Bug，建议优化复杂度与可读性。"];
    }
    if (status === "CE") {
      return ["编译失败：请优先修复编译器首条 error 指向的语法或签名问题。"];
    }
    if (status === "RE") {
      return ["运行时错误：高概率是越界、空值访问或分支遗漏导致。"];
    }
    if (trimmed.length === 0) {
      return ["代码为空，当前无法进行有效定位。"];
    }
    return ["提交未通过，问题集中在条件分支与状态更新顺序。"];
  }

  private extractLineNumberFromError(errorMessage?: string | null): number | null {
    if (!errorMessage) {
      return null;
    }

    const patterns = [/第\s*(\d+)\s*行/i, /\bline\s+(\d+)\b/i, /:(\d+):\d+:\s*error/i];
    for (const pattern of patterns) {
      const match = errorMessage.match(pattern);
      if (!match?.[1]) {
        continue;
      }

      const value = Number(match[1]);
      if (Number.isInteger(value) && value > 0 && value <= 10000) {
        return value;
      }
    }

    return null;
  }

  private getCodeLine(code: string, lineNumber: number): string | null {
    if (lineNumber <= 0 || code.length === 0) {
      return null;
    }

    const lines = code.split(/\r?\n/);
    if (lineNumber > lines.length) {
      return null;
    }

    const text = lines[lineNumber - 1].trim();
    return text.length > 0 ? text.slice(0, 140) : "(空行)";
  }

  private findPatternLine(code: string, patterns: RegExp[]): { line: number; text: string } | null {
    if (!code) {
      return null;
    }

    const lines = code.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const text = lines[index]?.trim() ?? "";
      if (text.length === 0) {
        continue;
      }
      if (patterns.some((pattern) => pattern.test(text))) {
        return {
          line: index + 1,
          text: text.slice(0, 140)
        };
      }
    }

    return null;
  }

  private async ensureReviewSession(body: ReviewBody): Promise<string | null> {
    if (body.sessionId) {
      try {
        const existing = await query<IdRow>("SELECT id FROM ai_sessions WHERE id = $1 LIMIT 1;", [body.sessionId]);
        if (existing.rows[0]?.id) {
          return existing.rows[0].id;
        }
      } catch {
        // Continue with a new session attempt below.
      }
    }

    try {
      const [userId, problemId, submissionId] = await Promise.all([
        this.getOrCreateDemoUserId(),
        this.resolveProblemId(body.problemSlug),
        this.resolveSubmissionId(body.submissionId)
      ]);

      const inserted = await query<IdRow>(
        `
          INSERT INTO ai_sessions(
            user_id,
            problem_id,
            context_submission_id,
            session_type
          )
          VALUES($1, $2, $3, 'review')
          RETURNING id;
        `,
        [userId, problemId, submissionId]
      );

      return inserted.rows[0]?.id ?? null;
    } catch {
      return null;
    }
  }

  private async ensureSolutionSession(body: SolutionBody): Promise<string | null> {
    const reviewLikeBody: ReviewBody = {
      sessionId: body.sessionId,
      problemSlug: body.problemSlug,
      status: "AC",
      errorMessage: null
    };
    return this.ensureReviewSession(reviewLikeBody);
  }

  private async appendAiMessage(
    sessionId: string | null,
    role: AiMessageRole,
    content: string,
    tokenUsage: Record<string, unknown> = {}
  ): Promise<void> {
    if (!sessionId || content.trim().length === 0) {
      return;
    }

    try {
      await query(
        `
          INSERT INTO ai_messages(session_id, role, content, token_usage)
          VALUES($1, $2, $3, $4::jsonb);
        `,
        [sessionId, role, content, JSON.stringify(tokenUsage)]
      );
      await query("UPDATE ai_sessions SET updated_at = NOW() WHERE id = $1;", [sessionId]);
    } catch {
      // Keep AI response path resilient even when persistence is degraded.
    }
  }

  private async resolveProblemId(problemSlug?: string): Promise<string | null> {
    if (!problemSlug) {
      return null;
    }

    const result = await query<IdRow>("SELECT id FROM problems WHERE slug = $1 LIMIT 1;", [problemSlug]);
    return result.rows[0]?.id ?? null;
  }

  private async resolveSubmissionId(submissionId?: string): Promise<string | null> {
    if (!submissionId) {
      return null;
    }

    const result = await query<IdRow>("SELECT id FROM submissions WHERE id = $1 LIMIT 1;", [submissionId]);
    return result.rows[0]?.id ?? null;
  }

  private async getOrCreateDemoUserId(): Promise<string> {
    const userResult = await query<UserRow>(
      `
        INSERT INTO users(email, password_hash, nickname)
        VALUES ($1, $2, $3)
        ON CONFLICT (email) DO UPDATE
          SET updated_at = NOW()
        RETURNING id;
      `,
      [DEMO_USER_EMAIL, "demo-password-not-used", "Demo User"]
    );

    return userResult.rows[0].id;
  }
}
