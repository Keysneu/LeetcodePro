import { BadGatewayException, BadRequestException, Body, Controller, Post, Res } from "@nestjs/common";
import { AiProvider, normalizeAiProvider } from "./ai-provider";
import { getOrCreateDemoUserId, resolveAiRuntimeConfigForRequest, type RuntimeAiConfig } from "./ai-config-store";
import { query } from "./db";

type ReviewBody = {
  problemSlug?: string;
  submissionId?: string;
  sessionId?: string;
  provider?: string;
  aiConfigId?: string;
  noteContext?: string;
  language?: "cpp" | "python";
  mode?: "core" | "acm";
  runtimeMs?: number | null;
  memoryKb?: number | null;
  passedCount?: number | null;
  totalCount?: number | null;
  failureSignals?: ReviewFailureSignal[];
  failureCase?: ReviewFailureCase | null;
  code?: string;
  status?: string;
  errorMessage?: string | null;
};

type SolutionBody = {
  problemSlug?: string;
  submissionId?: string;
  problemTitle?: string;
  modeSupport?: string;
  preferredLanguage?: "cpp" | "python";
  description?: string;
  sampleInput?: string;
  sampleOutput?: string;
  sessionId?: string;
  provider?: string;
  aiConfigId?: string;
  noteContext?: string;
};

type AiTutorResponse = {
  guidance?: string;
  source?: string;
  provider?: string;
  providerKind?: string;
  model?: string;
};

type AiTutorSolutionResponse = {
  editorial?: string;
  source?: string;
  provider?: string;
  providerKind?: string;
  model?: string;
};

type AiMessageRole = "user" | "assistant" | "system";

type ReviewFailureSignal = {
  status: string;
  runtimeMs: number | null;
  memoryKb: number | null;
  signal: string;
};

type ReviewFailureCase = {
  status: string;
  isHidden: boolean;
  inputData: string;
  actualOutput: string | null;
  expectedOutput: string;
  stderr: string | null;
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

type SubmissionFailureCaseRow = {
  status: string;
  isHidden: boolean;
  inputData: string;
  actualOutput: string | null;
  expectedOutput: string;
  stderr: string | null;
};

type ProblemNoteContextRow = {
  contentMd: string;
  matchedHeading: string;
  sourceFilename: string;
};

type SseFrame = {
  event: string;
  data: string;
};

type ParsedSsePayload = Record<string, unknown> | string;

type AiTutorReviewBody = ReviewBody & {
  runtimeConfig?: RuntimeAiConfig;
};

type AiTutorSolutionBody = SolutionBody & {
  runtimeConfig?: RuntimeAiConfig;
};

const AI_TUTOR_TIMEOUT_MS = Number(process.env.AI_TUTOR_TIMEOUT_MS ?? 12000);
const AI_TUTOR_REVIEW_TIMEOUT_MS = Number(process.env.AI_TUTOR_REVIEW_TIMEOUT_MS ?? 30000);
const AI_TUTOR_SOLUTION_TIMEOUT_MS = Number(
  process.env.AI_TUTOR_SOLUTION_TIMEOUT_MS ?? process.env.AI_TUTOR_SOLUTION_MINIMAX_TIMEOUT_MS ?? 300000
);
const AI_TUTOR_CUSTOM_CONFIG_TIMEOUT_MS = Number(
  process.env.AI_TUTOR_CUSTOM_CONFIG_TIMEOUT_MS ?? 90000
);
const AI_TUTOR_CUSTOM_CONFIG_REVIEW_TIMEOUT_MS = Number(
  process.env.AI_TUTOR_CUSTOM_CONFIG_REVIEW_TIMEOUT_MS ?? AI_TUTOR_CUSTOM_CONFIG_TIMEOUT_MS
);
const AI_TUTOR_CUSTOM_CONFIG_SOLUTION_TIMEOUT_MS = Number(
  process.env.AI_TUTOR_CUSTOM_CONFIG_SOLUTION_TIMEOUT_MS ?? 300000
);
const OPENAI_COMPATIBLE_PROVIDER_KIND = "openai_compatible";
const DEFAULT_AI_TUTOR_BASE_URL = "http://localhost:8001";

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

function resolveAiTutorTimeoutMs(_provider: AiProvider | null, hasCustomConfig = false): number {
  if (hasCustomConfig) {
    return AI_TUTOR_CUSTOM_CONFIG_TIMEOUT_MS;
  }
  return AI_TUTOR_TIMEOUT_MS;
}

function resolveAiTutorReviewTimeoutMs(_provider: AiProvider | null, hasCustomConfig = false): number {
  if (hasCustomConfig) {
    return AI_TUTOR_CUSTOM_CONFIG_REVIEW_TIMEOUT_MS;
  }
  return AI_TUTOR_REVIEW_TIMEOUT_MS;
}

function resolveAiTutorSolutionTimeoutMs(_provider: AiProvider | null, hasCustomConfig = false): number {
  if (hasCustomConfig) {
    return AI_TUTOR_CUSTOM_CONFIG_SOLUTION_TIMEOUT_MS;
  }
  return AI_TUTOR_SOLUTION_TIMEOUT_MS;
}

function normalizeSolutionErrorMessage(provider: AiProvider | null, rawMessage: string | null): string {
  const providerLabel = provider ?? "AI";
  const fallback = `${providerLabel} 题解生成失败，请稍后重试。`;
  const timeoutMessage = `${providerLabel} 题解请求超时，请稍后重试。`;
  const message = (rawMessage ?? "").trim().replace(/^(Error|BadGatewayException):\s*/i, "");

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

  const aiTutorUnavailableSignals = ["fetch failed", "failed to fetch"];
  if (aiTutorUnavailableSignals.some((item) => normalized.includes(item))) {
    return "AI Tutor 服务不可达，请确认 npm run dev:ai 已启动，且 AI_TUTOR_BASE_URL 指向当前 AI Tutor 端口。";
  }

  const modelConnectionSignals = [
    "connection refused",
    "all connection attempts failed",
    "connecterror",
    "econnrefused",
    "failed to establish a new connection"
  ];
  if (modelConnectionSignals.some((item) => normalized.includes(item))) {
    return `${providerLabel} 模型服务不可达，请检查 Base URL、端口和模型服务是否已启动。`;
  }

  const upstreamStatusMatch = message.match(/upstream HTTP\s+(\d{3}):\s*([\s\S]*)$/i);
  if (upstreamStatusMatch) {
    const status = upstreamStatusMatch[1];
    if (status === "401" || status === "403") {
      return `${providerLabel} 鉴权失败，请检查 API Key 是否正确或是否有模型权限。`;
    }
    if (status === "404") {
      return `${providerLabel} 请求地址或模型不存在，请检查 Base URL 与 Model。`;
    }
    if (status === "429") {
      return `${providerLabel} 触发限流或额度不足，请稍后重试或检查账户额度。`;
    }
    if (status.startsWith("5")) {
      return `${providerLabel} 上游服务暂时不可用，请稍后重试。`;
    }
  }

  const aiTutorRouteMissingSignals = [
    "cannot post /solution/stream",
    "cannot post /solution",
    "upstream sse unavailable: 404"
  ];
  if (normalized === "not found" || aiTutorRouteMissingSignals.some((item) => normalized.includes(item))) {
    return "AI Tutor 题解接口不存在，请确认 AI_TUTOR_BASE_URL 指向 services/ai-tutor 当前版本，并重启 AI/API 服务。";
  }

  if (
    message.includes("题解") ||
    message.includes("稍后重试") ||
    message.includes("超时") ||
    message.includes("AI Tutor") ||
    message.includes("模型服务不可达") ||
    message.includes("API Key") ||
    message.includes("鉴权") ||
    message.includes("限流") ||
    message.includes("额度") ||
    message.includes("Base URL") ||
    message.includes("Model")
  ) {
    return message.slice(0, 240);
  }

  return fallback;
}

function normalizeCustomConfigErrorMessage(rawMessage: string | null): string {
  const fallback = "当前 AI 配置调用失败，请检查首页中的 Base URL / API Key / Model 后重试。";
  const message = (rawMessage ?? "").trim().replace(/^(Error|BadGatewayException):\s*/i, "");
  if (message.length === 0) {
    return fallback;
  }

  if (message.includes("请先在首页配置")) {
    return message;
  }

  const normalized = message.toLowerCase();
  const timeoutSignals = ["aborterror", "timeout", "timed out", "deadline exceeded"];
  if (timeoutSignals.some((item) => normalized.includes(item))) {
    return "当前 AI 配置请求超时，请检查服务可达性或稍后重试。";
  }

  const aiTutorUnavailableSignals = ["fetch failed", "failed to fetch"];
  if (aiTutorUnavailableSignals.some((item) => normalized.includes(item))) {
    return "AI Tutor 服务不可达，请确认 npm run dev:ai 已启动，且 AI_TUTOR_BASE_URL 指向当前 AI Tutor 端口。";
  }

  const upstreamStatusMatch = message.match(/upstream HTTP\s+(\d{3}):\s*([\s\S]*)$/i);
  if (upstreamStatusMatch) {
    const status = upstreamStatusMatch[1];
    const detail = upstreamStatusMatch[2]?.trim() ?? "";
    if (status === "401" || status === "403") {
      return "当前 AI 配置鉴权失败，请检查 API Key 是否正确或是否有模型权限。";
    }
    if (status === "404") {
      return "当前 AI 配置请求地址或模型不存在，请检查 Base URL 不要填写完整 /chat/completions 路径，并确认 Model 名称。";
    }
    if (status === "429") {
      return "当前 AI 配置触发限流或额度不足，请稍后重试或检查账户额度。";
    }
    if (status === "400") {
      const safeDetail = detail.replace(/\s+/g, " ").slice(0, 180);
      return safeDetail
        ? `当前 AI 配置参数不被上游接受：${safeDetail}`
        : "当前 AI 配置参数不被上游接受，请检查 Model、Base URL 与请求参数。";
    }
    if (status.startsWith("5")) {
      return "上游 AI 服务暂时不可用，请稍后重试。";
    }
  }

  return fallback;
}

function inferActualOutputFromStderr(stderr: string | null): string | null {
  if (!stderr) {
    return null;
  }

  const trimmed = stderr.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const matched = trimmed.match(/^Expected\s+([\s\S]*?),\s+got\s+([\s\S]*)$/);
  if (!matched) {
    return null;
  }

  const got = matched[2]?.trim() ?? "";
  return got.length > 0 ? got : null;
}

@Controller("ai")
export class AiController {
  @Post("bug-find")
  async bugFind(@Body() body: ReviewBody) {
    return this.review(body);
  }

  @Post("review")
  async review(@Body() body: ReviewBody) {
    const aiTutorBaseUrl = process.env.AI_TUTOR_BASE_URL ?? DEFAULT_AI_TUTOR_BASE_URL;
    const userId = await getOrCreateDemoUserId();
    const requestedProvider = normalizeAiProvider(body.provider);
    const resolvedConfig = await resolveAiRuntimeConfigForRequest(
      userId,
      "review",
      body.aiConfigId,
      requestedProvider !== null
    );
    if (resolvedConfig.kind === "invalid") {
      throw new BadRequestException(resolvedConfig.message);
    }

    let provider: AiProvider | null = requestedProvider;
    let runtimeConfig: RuntimeAiConfig | null = null;
    if (resolvedConfig.kind === "configured") {
      runtimeConfig = resolvedConfig.runtimeConfig;
      provider = null;
    } else if (!provider) {
      throw new BadRequestException("未找到可用 AI 配置，请先在首页配置并选择 AI。");
    }

    const sessionId = await this.ensureReviewSession(body);
    const rawTutorRequestBody = await this.buildAiTutorReviewPayload(body, sessionId, provider, userId);
    const tutorRequestBody = this.sanitizeReviewBody(rawTutorRequestBody);
    const aiTutorRequestBody: AiTutorReviewBody = runtimeConfig
      ? { ...tutorRequestBody, runtimeConfig }
      : tutorRequestBody;
    const fallbackMessage = this.buildFallbackGuidance(tutorRequestBody);
    await this.appendAiMessage(sessionId, "user", this.buildUserReviewContext(tutorRequestBody));

    let guidance = fallbackMessage;
    let source = "api-fallback";
    let model = "";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), resolveAiTutorReviewTimeoutMs(provider, runtimeConfig !== null));

      const response = await fetch(`${aiTutorBaseUrl}/bug-find`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(aiTutorRequestBody),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (response.ok) {
        const json = (await response.json()) as AiTutorResponse;
        guidance = json.guidance ?? fallbackMessage;
        source = json.source ?? "ai-tutor";
        provider = normalizeAiProvider(json.provider) ?? provider;
        model = json.model ?? "";
      } else if (runtimeConfig) {
        const upstreamMessage = await readUpstreamErrorMessage(response, "runtime config request failed");
        throw new BadGatewayException(normalizeCustomConfigErrorMessage(upstreamMessage));
      }
    } catch (error) {
      if (runtimeConfig) {
        if (error instanceof BadGatewayException) {
          throw error;
        }
        const message = error instanceof Error ? `${error.name}: ${error.message}` : null;
        throw new BadGatewayException(normalizeCustomConfigErrorMessage(message));
      }
      // Fallback below.
    }

    await this.appendAiMessage(sessionId, "assistant", guidance, { source, provider });

    return {
      sessionId,
      guidance,
      source,
      provider,
      providerKind: OPENAI_COMPATIBLE_PROVIDER_KIND,
      ...(model ? { model } : {})
    };
  }

  @Post("bug-find/stream")
  async bugFindStream(@Body() body: ReviewBody, @Res() res: SseResponse): Promise<void> {
    return this.reviewStream(body, res);
  }

  @Post("review/stream")
  async reviewStream(@Body() body: ReviewBody, @Res() res: SseResponse): Promise<void> {
    const aiTutorBaseUrl = process.env.AI_TUTOR_BASE_URL ?? DEFAULT_AI_TUTOR_BASE_URL;
    const userId = await getOrCreateDemoUserId();
    const requestedProvider = normalizeAiProvider(body.provider);
    const resolvedConfig = await resolveAiRuntimeConfigForRequest(
      userId,
      "review",
      body.aiConfigId,
      requestedProvider !== null
    );
    if (resolvedConfig.kind === "invalid") {
      res.status(200);
      res.setHeader("content-type", "text/event-stream; charset=utf-8");
      res.setHeader("cache-control", "no-cache, no-transform");
      res.setHeader("connection", "keep-alive");
      res.setHeader("x-accel-buffering", "no");
      res.flushHeaders();
      writeSseEvent(res, "error", { message: resolvedConfig.message });
      writeSseEvent(res, "done", { error: resolvedConfig.message });
      res.end();
      return;
    }

    let provider: AiProvider | null = requestedProvider;
    let runtimeConfig: RuntimeAiConfig | null = null;
    if (resolvedConfig.kind === "configured") {
      runtimeConfig = resolvedConfig.runtimeConfig;
      provider = null;
    } else if (!provider) {
      const message = "未找到可用 AI 配置，请先在首页配置并选择 AI。";
      res.status(200);
      res.setHeader("content-type", "text/event-stream; charset=utf-8");
      res.setHeader("cache-control", "no-cache, no-transform");
      res.setHeader("connection", "keep-alive");
      res.setHeader("x-accel-buffering", "no");
      res.flushHeaders();
      writeSseEvent(res, "error", { message });
      writeSseEvent(res, "done", { error: message });
      res.end();
      return;
    }

    const sessionId = await this.ensureReviewSession(body);
    const rawTutorRequestBody = await this.buildAiTutorReviewPayload(body, sessionId, provider, userId);
    const tutorRequestBody = this.sanitizeReviewBody(rawTutorRequestBody);
    const aiTutorRequestBody: AiTutorReviewBody = runtimeConfig
      ? { ...tutorRequestBody, runtimeConfig }
      : tutorRequestBody;
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
      provider,
      providerKind: OPENAI_COMPATIBLE_PROVIDER_KIND
    });
    writeSseEvent(res, "phase", {
      sessionId: sessionId ?? "",
      stage: "prepare",
      message: "已发送 AI 判题请求，正在准备上下文。"
    });

    let source = "ai-tutor";
    let guidance = "";
    let reasoningSummary = "";
    let streamError = "";
    let doneSent = false;
    let providerKind = OPENAI_COMPATIBLE_PROVIDER_KIND;
    let model = "";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), resolveAiTutorReviewTimeoutMs(provider, runtimeConfig !== null));

    res.on("close", () => {
      controller.abort();
    });

    try {
      const upstream = await fetch(`${aiTutorBaseUrl}/bug-find/stream`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(aiTutorRequestBody),
        signal: controller.signal
      });

      if (!upstream.ok || !upstream.body) {
        if (runtimeConfig) {
          const upstreamMessage = await readUpstreamErrorMessage(upstream, "runtime config stream request failed");
          throw new Error(normalizeCustomConfigErrorMessage(upstreamMessage));
        }
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
          providerKind = readStringField(payload, "providerKind") ?? providerKind;
          model = readStringField(payload, "model") ?? model;
          writeSseEvent(res, "meta", {
            sessionId: sessionId ?? "",
            source,
            provider,
            providerKind,
            ...(model ? { model } : {})
          });
          return;
        }

        if (frame.event === "phase") {
          writeSseEvent(res, "phase", {
            sessionId: sessionId ?? "",
            ...(isRecord(payload) ? payload : { message: typeof payload === "string" ? payload : "正在处理中。" })
          });
          return;
        }

        if (frame.event === "response.created" || frame.event === "response.in_progress") {
          writeSseEvent(res, frame.event, {
            sessionId: sessionId ?? "",
            source,
            provider,
            providerKind,
            ...(model ? { model } : {})
          });
          return;
        }

        if (frame.event === "response.reasoning_summary_text.delta") {
          const delta = readStringField(payload, "delta") ?? (typeof payload === "string" ? payload : "");
          if (delta.length > 0) {
            reasoningSummary += delta;
            writeSseEvent(res, "response.reasoning_summary_text.delta", {
              sessionId: sessionId ?? "",
              source,
              provider,
              providerKind,
              ...(model ? { model } : {}),
              delta
            });
          }
          return;
        }

        if (frame.event === "response.output_text.delta") {
          const delta = readStringField(payload, "delta") ?? (typeof payload === "string" ? payload : "");
          if (delta.length > 0) {
            guidance += delta;
            writeSseEvent(res, "response.output_text.delta", {
              sessionId: sessionId ?? "",
              source,
              provider,
              providerKind,
              ...(model ? { model } : {}),
              delta
            });
            writeSseEvent(res, "delta", { delta });
          }
          return;
        }

        if (frame.event === "response.output_text.replace") {
          const text = readStringField(payload, "text") ?? (typeof payload === "string" ? payload : "");
          if (text.length > 0) {
            guidance = text;
            writeSseEvent(res, "response.output_text.replace", {
              sessionId: sessionId ?? "",
              source,
              provider,
              providerKind,
              ...(model ? { model } : {}),
              text
            });
          }
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

        if (frame.event === "response.completed") {
          source = readStringField(payload, "source") ?? source;
          provider = normalizeAiProvider(readStringField(payload, "provider")) ?? provider;
          providerKind = readStringField(payload, "providerKind") ?? providerKind;
          model = readStringField(payload, "model") ?? model;
          const finalGuidance = readStringField(payload, "guidance");
          const finalReasoningSummary = readStringField(payload, "reasoningSummary");
          if (finalGuidance && finalGuidance.length > 0) {
            guidance = finalGuidance;
          }
          if (finalReasoningSummary && finalReasoningSummary.length > 0) {
            reasoningSummary = finalReasoningSummary;
          }

          writeSseEvent(res, "response.completed", {
            sessionId: sessionId ?? "",
            source,
            guidance,
            provider,
            providerKind,
            ...(model ? { model } : {}),
            ...(reasoningSummary ? { reasoningSummary } : {})
          });
          return;
        }

        if (frame.event === "done") {
          source = readStringField(payload, "source") ?? source;
          provider = normalizeAiProvider(readStringField(payload, "provider")) ?? provider;
          providerKind = readStringField(payload, "providerKind") ?? providerKind;
          model = readStringField(payload, "model") ?? model;
          const finalGuidance = readStringField(payload, "guidance");
          const finalReasoningSummary = readStringField(payload, "reasoningSummary");
          if (finalGuidance && finalGuidance.length > 0) {
            guidance = finalGuidance;
          }
          if (finalReasoningSummary && finalReasoningSummary.length > 0) {
            reasoningSummary = finalReasoningSummary;
          }

          writeSseEvent(res, "done", {
            sessionId: sessionId ?? "",
            source,
            guidance,
            provider,
            providerKind,
            ...(model ? { model } : {}),
            ...(reasoningSummary ? { reasoningSummary } : {})
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
    } catch (error) {
      if (runtimeConfig) {
        source = "api-error";
        const message = error instanceof Error ? error.message : null;
        streamError = normalizeCustomConfigErrorMessage(message);
        writeSseEvent(res, "error", {
          sessionId: sessionId ?? "",
          source,
          provider,
          providerKind,
          ...(model ? { model } : {}),
          message: streamError
        });
        writeSseEvent(res, "done", {
          sessionId: sessionId ?? "",
          source,
          guidance,
          provider,
          providerKind,
          ...(model ? { model } : {}),
          ...(reasoningSummary ? { reasoningSummary } : {}),
          error: streamError
        });
        doneSent = true;
      } else {
        source = "api-fallback";
        guidance = fallbackMessage;
        reasoningSummary = "";
        writeSseEvent(res, "response.output_text.delta", {
          sessionId: sessionId ?? "",
          source,
          provider,
          providerKind,
          ...(model ? { model } : {}),
          delta: guidance
        });
        writeSseEvent(res, "delta", { delta: guidance });
        writeSseEvent(res, "done", {
          sessionId: sessionId ?? "",
          source,
          guidance,
          provider,
          providerKind,
          ...(model ? { model } : {}),
          ...(reasoningSummary ? { reasoningSummary } : {})
        });
        doneSent = true;
      }
    } finally {
      clearTimeout(timeout);
    }

    if (!doneSent) {
      if (runtimeConfig) {
        if (guidance.length === 0 && streamError.length === 0) {
          source = "api-error";
          streamError = normalizeCustomConfigErrorMessage(null);
          writeSseEvent(res, "error", {
            sessionId: sessionId ?? "",
            source,
            provider,
            providerKind,
            ...(model ? { model } : {}),
            message: streamError
          });
        }
        writeSseEvent(res, "done", {
          sessionId: sessionId ?? "",
          source,
          guidance,
          provider,
          providerKind,
          ...(model ? { model } : {}),
          ...(reasoningSummary ? { reasoningSummary } : {}),
          ...(streamError ? { error: streamError } : {})
        });
      } else {
        if (guidance.length === 0) {
          source = "api-fallback";
          guidance = fallbackMessage;
          writeSseEvent(res, "response.output_text.delta", {
            sessionId: sessionId ?? "",
            source,
            provider,
            providerKind,
            ...(model ? { model } : {}),
            delta: guidance
          });
          writeSseEvent(res, "delta", { delta: guidance });
        }

        writeSseEvent(res, "done", {
          sessionId: sessionId ?? "",
          source,
          guidance,
          provider,
          providerKind,
          ...(model ? { model } : {}),
          ...(reasoningSummary ? { reasoningSummary } : {})
        });
      }
    }

    if (guidance.length > 0) {
      await this.appendAiMessage(sessionId, "assistant", guidance, { source, provider });
    } else if (streamError.length > 0) {
      await this.appendAiMessage(sessionId, "assistant", streamError, { source, provider, type: "review-error" });
    }
    res.end();
  }

  @Post("solution")
  async solution(@Body() body: SolutionBody) {
    const aiTutorBaseUrl = process.env.AI_TUTOR_BASE_URL ?? DEFAULT_AI_TUTOR_BASE_URL;
    const userId = await getOrCreateDemoUserId();
    const requestedProvider = normalizeAiProvider(body.provider);
    const resolvedConfig = await resolveAiRuntimeConfigForRequest(
      userId,
      "solution",
      body.aiConfigId,
      requestedProvider !== null
    );
    if (resolvedConfig.kind === "invalid") {
      throw new BadRequestException(resolvedConfig.message);
    }

    let provider: AiProvider | null = requestedProvider;
    let runtimeConfig: RuntimeAiConfig | null = null;
    if (resolvedConfig.kind === "configured") {
      runtimeConfig = resolvedConfig.runtimeConfig;
      provider = null;
    } else if (!provider) {
      throw new BadRequestException("未找到可用 AI 配置，请先在首页配置并选择 AI。");
    }

    const sessionId = await this.ensureSolutionSession(body);
    const aiTutorSolutionPayload = await this.buildAiTutorSolutionPayload(body, sessionId, provider, userId);
    await this.appendAiMessage(sessionId, "user", this.buildUserSolutionContext(aiTutorSolutionPayload));

    let editorial = "";
    let source = "ai-tutor";
    let model = "";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), resolveAiTutorSolutionTimeoutMs(provider, runtimeConfig !== null));

      const response = await fetch(`${aiTutorBaseUrl}/solution`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          ...aiTutorSolutionPayload,
          ...(runtimeConfig ? { runtimeConfig } : {})
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const upstreamMessage = await readUpstreamErrorMessage(
          response,
          runtimeConfig
            ? "当前 AI 配置调用失败，请检查首页中的 Base URL / API Key / Model 后重试。"
            : `${provider ?? "AI"} 题解生成失败，请稍后重试。`
        );
        throw new BadGatewayException(
          runtimeConfig
            ? normalizeCustomConfigErrorMessage(upstreamMessage)
            : normalizeSolutionErrorMessage(provider, upstreamMessage)
        );
      }

      const json = (await response.json()) as AiTutorSolutionResponse;
      editorial = json.editorial ?? "";
      source = json.source ?? "ai-tutor";
      provider = normalizeAiProvider(json.provider) ?? provider;
      model = json.model ?? "";

      if (editorial.trim().length === 0) {
        throw new BadGatewayException(normalizeSolutionErrorMessage(provider, null));
      }
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      const message = error instanceof Error ? `${error.name}: ${error.message}` : null;
      throw new BadGatewayException(
        runtimeConfig ? normalizeCustomConfigErrorMessage(message) : normalizeSolutionErrorMessage(provider, message)
      );
    }

    await this.appendAiMessage(sessionId, "assistant", editorial, { source, provider, type: "solution" });

    return {
      sessionId,
      editorial,
      source,
      provider,
      providerKind: OPENAI_COMPATIBLE_PROVIDER_KIND,
      ...(model ? { model } : {})
    };
  }

  @Post("solution/stream")
  async solutionStream(@Body() body: SolutionBody, @Res() res: SseResponse): Promise<void> {
    const aiTutorBaseUrl = process.env.AI_TUTOR_BASE_URL ?? DEFAULT_AI_TUTOR_BASE_URL;
    const userId = await getOrCreateDemoUserId();
    const requestedProvider = normalizeAiProvider(body.provider);
    const resolvedConfig = await resolveAiRuntimeConfigForRequest(
      userId,
      "solution",
      body.aiConfigId,
      requestedProvider !== null
    );
    if (resolvedConfig.kind === "invalid") {
      res.status(200);
      res.setHeader("content-type", "text/event-stream; charset=utf-8");
      res.setHeader("cache-control", "no-cache, no-transform");
      res.setHeader("connection", "keep-alive");
      res.setHeader("x-accel-buffering", "no");
      res.flushHeaders();
      writeSseEvent(res, "error", { message: resolvedConfig.message });
      writeSseEvent(res, "done", { error: resolvedConfig.message });
      res.end();
      return;
    }

    let provider: AiProvider | null = requestedProvider;
    let runtimeConfig: RuntimeAiConfig | null = null;
    if (resolvedConfig.kind === "configured") {
      runtimeConfig = resolvedConfig.runtimeConfig;
      provider = null;
    } else if (!provider) {
      const message = "未找到可用 AI 配置，请先在首页配置并选择 AI。";
      res.status(200);
      res.setHeader("content-type", "text/event-stream; charset=utf-8");
      res.setHeader("cache-control", "no-cache, no-transform");
      res.setHeader("connection", "keep-alive");
      res.setHeader("x-accel-buffering", "no");
      res.flushHeaders();
      writeSseEvent(res, "error", { message });
      writeSseEvent(res, "done", { error: message });
      res.end();
      return;
    }

    const sessionId = await this.ensureSolutionSession(body);
    const aiTutorSolutionPayload = await this.buildAiTutorSolutionPayload(body, sessionId, provider, userId);
    await this.appendAiMessage(sessionId, "user", this.buildUserSolutionContext(aiTutorSolutionPayload));

    res.status(200);
    res.setHeader("content-type", "text/event-stream; charset=utf-8");
    res.setHeader("cache-control", "no-cache, no-transform");
    res.setHeader("connection", "keep-alive");
    res.setHeader("x-accel-buffering", "no");
    res.flushHeaders();

    writeSseEvent(res, "meta", {
      sessionId: sessionId ?? "",
      source: "api-proxy",
      provider,
      providerKind: OPENAI_COMPATIBLE_PROVIDER_KIND
    });

    let source = "ai-tutor";
    let editorial = "";
    let reasoningSummary = "";
    let streamError = "";
    let doneSent = false;
    let providerKind = OPENAI_COMPATIBLE_PROVIDER_KIND;
    let model = "";
    const normalizeStreamErrorMessage = (message: string | null) =>
      runtimeConfig ? normalizeCustomConfigErrorMessage(message) : normalizeSolutionErrorMessage(provider, message);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), resolveAiTutorSolutionTimeoutMs(provider, runtimeConfig !== null));

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
          ...aiTutorSolutionPayload,
          ...(runtimeConfig ? { runtimeConfig } : {})
        }),
        signal: controller.signal
      });

      if (!upstream.ok || !upstream.body) {
        const upstreamMessage = await readUpstreamErrorMessage(
          upstream,
          runtimeConfig
            ? "当前 AI 配置调用失败，请检查首页中的 Base URL / API Key / Model 后重试。"
            : `${provider ?? "AI"} 题解生成失败，请稍后重试。`
        );
        throw new Error(
          runtimeConfig
            ? normalizeCustomConfigErrorMessage(upstreamMessage)
            : normalizeSolutionErrorMessage(provider, upstreamMessage)
        );
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

          const payload = parseSsePayload(frame.data);

          if (frame.event === "meta") {
            source = readStringField(payload, "source") ?? source;
            provider = normalizeAiProvider(readStringField(payload, "provider")) ?? provider;
            providerKind = readStringField(payload, "providerKind") ?? providerKind;
            model = readStringField(payload, "model") ?? model;
            writeSseEvent(res, "meta", {
              sessionId: sessionId ?? "",
              source,
              provider,
              providerKind,
              ...(model ? { model } : {})
            });
            continue;
          }

          if (frame.event === "phase") {
            writeSseEvent(res, "phase", {
              sessionId: sessionId ?? "",
              ...(isRecord(payload) ? payload : { message: typeof payload === "string" ? payload : "正在处理中。" })
            });
            continue;
          }

          if (frame.event === "response.created" || frame.event === "response.in_progress") {
            writeSseEvent(res, frame.event, {
              sessionId: sessionId ?? "",
              source,
              provider,
              providerKind,
              ...(model ? { model } : {})
            });
            continue;
          }

          if (frame.event === "response.reasoning_summary_text.delta") {
            const delta = readStringField(payload, "delta") ?? (typeof payload === "string" ? payload : "");
            if (delta.length > 0) {
              reasoningSummary += delta;
              writeSseEvent(res, "response.reasoning_summary_text.delta", {
                sessionId: sessionId ?? "",
                source,
                provider,
                providerKind,
                ...(model ? { model } : {}),
                delta
              });
            }
            continue;
          }

          if (frame.event === "response.output_text.delta") {
            const delta = readStringField(payload, "delta") ?? (typeof payload === "string" ? payload : "");
            if (delta.length > 0) {
              editorial += delta;
              writeSseEvent(res, "response.output_text.delta", {
                sessionId: sessionId ?? "",
                source,
                provider,
                providerKind,
                ...(model ? { model } : {}),
                delta
              });
              writeSseEvent(res, "delta", { delta });
            }
            continue;
          }

          if (frame.event === "response.output_text.replace") {
            const text = readStringField(payload, "text") ?? (typeof payload === "string" ? payload : "");
            if (text.length > 0) {
              editorial = text;
              writeSseEvent(res, "response.output_text.replace", {
                sessionId: sessionId ?? "",
                source,
                provider,
                providerKind,
                ...(model ? { model } : {}),
                text
              });
            }
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
            providerKind = readStringField(payload, "providerKind") ?? providerKind;
            model = readStringField(payload, "model") ?? model;
            const message = normalizeStreamErrorMessage(
              readStringField(payload, "message") ?? readStringField(payload, "error")
            );
            streamError = message;
            writeSseEvent(res, "error", {
              sessionId: sessionId ?? "",
              source,
              provider,
              providerKind,
              ...(model ? { model } : {}),
              message
            });
            continue;
          }

          if (frame.event === "response.completed") {
            source = readStringField(payload, "source") ?? source;
            provider = normalizeAiProvider(readStringField(payload, "provider")) ?? provider;
            providerKind = readStringField(payload, "providerKind") ?? providerKind;
            model = readStringField(payload, "model") ?? model;
            const finalEditorial = readStringField(payload, "editorial");
            const finalReasoningSummary = readStringField(payload, "reasoningSummary");
            if (finalEditorial && finalEditorial.length > 0) {
              editorial = finalEditorial;
            }
            if (finalReasoningSummary && finalReasoningSummary.length > 0) {
              reasoningSummary = finalReasoningSummary;
            }

            writeSseEvent(res, "response.completed", {
              sessionId: sessionId ?? "",
              source,
              editorial,
              provider,
              providerKind,
              ...(model ? { model } : {}),
              ...(reasoningSummary ? { reasoningSummary } : {})
            });
            continue;
          }

          if (frame.event === "done") {
            source = readStringField(payload, "source") ?? source;
            provider = normalizeAiProvider(readStringField(payload, "provider")) ?? provider;
            providerKind = readStringField(payload, "providerKind") ?? providerKind;
            model = readStringField(payload, "model") ?? model;
            const finalEditorial = readStringField(payload, "editorial");
            const finalError = readStringField(payload, "error");
            const finalReasoningSummary = readStringField(payload, "reasoningSummary");
            if (finalEditorial && finalEditorial.length > 0) {
              editorial = finalEditorial;
            }
            if (finalError && finalError.length > 0) {
              streamError = normalizeStreamErrorMessage(finalError);
            }
            if (finalReasoningSummary && finalReasoningSummary.length > 0) {
              reasoningSummary = finalReasoningSummary;
            }

            writeSseEvent(res, "done", {
              sessionId: sessionId ?? "",
              source,
              editorial,
              provider,
              providerKind,
              ...(model ? { model } : {}),
              ...(reasoningSummary ? { reasoningSummary } : {}),
              ...(streamError ? { error: streamError } : {})
            });
            doneSent = true;
          }
        }
      }

      buffer += decoder.decode();
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

        const payload = parseSsePayload(frame.data);
        if (frame.event === "phase") {
          writeSseEvent(res, "phase", {
            sessionId: sessionId ?? "",
            ...(isRecord(payload) ? payload : { message: typeof payload === "string" ? payload : "正在处理中。" })
          });
          continue;
        }
        if (frame.event === "response.completed") {
          source = readStringField(payload, "source") ?? source;
          provider = normalizeAiProvider(readStringField(payload, "provider")) ?? provider;
          const finalEditorial = readStringField(payload, "editorial");
          const finalError = readStringField(payload, "error");
          const finalReasoningSummary = readStringField(payload, "reasoningSummary");
          if (finalEditorial && finalEditorial.length > 0) {
            editorial = finalEditorial;
          }
          if (finalError && finalError.length > 0) {
            streamError = normalizeStreamErrorMessage(finalError);
          }
          if (finalReasoningSummary && finalReasoningSummary.length > 0) {
            reasoningSummary = finalReasoningSummary;
          }

          writeSseEvent(res, "response.completed", {
            sessionId: sessionId ?? "",
            source,
            editorial,
            provider,
            ...(reasoningSummary ? { reasoningSummary } : {})
          });
          continue;
        }
        if (frame.event === "done") {
          source = readStringField(payload, "source") ?? source;
          provider = normalizeAiProvider(readStringField(payload, "provider")) ?? provider;
          const finalEditorial = readStringField(payload, "editorial");
          const finalError = readStringField(payload, "error");
          const finalReasoningSummary = readStringField(payload, "reasoningSummary");
          if (finalEditorial && finalEditorial.length > 0) {
            editorial = finalEditorial;
          }
          if (finalError && finalError.length > 0) {
            streamError = normalizeStreamErrorMessage(finalError);
          }
          if (finalReasoningSummary && finalReasoningSummary.length > 0) {
            reasoningSummary = finalReasoningSummary;
          }

          writeSseEvent(res, "done", {
            sessionId: sessionId ?? "",
            source,
            editorial,
            provider,
            ...(reasoningSummary ? { reasoningSummary } : {}),
            ...(streamError ? { error: streamError } : {})
          });
          doneSent = true;
        }
      }

      if (buffer.trim().length > 0) {
        const tailFrame = parseSseFrame(buffer.trim());
        if (tailFrame) {
          const payload = parseSsePayload(tailFrame.data);
          if (tailFrame.event === "phase") {
            writeSseEvent(res, "phase", {
              sessionId: sessionId ?? "",
              ...(isRecord(payload) ? payload : { message: typeof payload === "string" ? payload : "正在处理中。" })
            });
          }
          if (tailFrame.event === "response.completed") {
            source = readStringField(payload, "source") ?? source;
            provider = normalizeAiProvider(readStringField(payload, "provider")) ?? provider;
            const finalEditorial = readStringField(payload, "editorial");
            const finalError = readStringField(payload, "error");
            const finalReasoningSummary = readStringField(payload, "reasoningSummary");
            if (finalEditorial && finalEditorial.length > 0) {
              editorial = finalEditorial;
            }
            if (finalError && finalError.length > 0) {
              streamError = normalizeStreamErrorMessage(finalError);
            }
            if (finalReasoningSummary && finalReasoningSummary.length > 0) {
              reasoningSummary = finalReasoningSummary;
            }

            writeSseEvent(res, "response.completed", {
              sessionId: sessionId ?? "",
              source,
              editorial,
              provider,
              ...(reasoningSummary ? { reasoningSummary } : {})
            });
          }
          if (tailFrame.event === "done") {
            source = readStringField(payload, "source") ?? source;
            provider = normalizeAiProvider(readStringField(payload, "provider")) ?? provider;
            const finalEditorial = readStringField(payload, "editorial");
            const finalError = readStringField(payload, "error");
            const finalReasoningSummary = readStringField(payload, "reasoningSummary");
            if (finalEditorial && finalEditorial.length > 0) {
              editorial = finalEditorial;
            }
            if (finalError && finalError.length > 0) {
              streamError = normalizeStreamErrorMessage(finalError);
            }
            if (finalReasoningSummary && finalReasoningSummary.length > 0) {
              reasoningSummary = finalReasoningSummary;
            }

            writeSseEvent(res, "done", {
              sessionId: sessionId ?? "",
              source,
              editorial,
              provider,
              ...(reasoningSummary ? { reasoningSummary } : {}),
              ...(streamError ? { error: streamError } : {})
            });
            doneSent = true;
          }
        }
      }
    } catch (error) {
      source = "api-error";
      const message = error instanceof Error ? `${error.name}: ${error.message}` : null;
      streamError = normalizeStreamErrorMessage(message);
      writeSseEvent(res, "error", {
        sessionId: sessionId ?? "",
        source,
        provider,
        providerKind,
        ...(model ? { model } : {}),
        message: streamError
      });
      writeSseEvent(res, "done", {
        sessionId: sessionId ?? "",
        source,
        editorial,
        provider,
        providerKind,
        ...(model ? { model } : {}),
        ...(reasoningSummary ? { reasoningSummary } : {}),
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
          streamError = normalizeStreamErrorMessage(null);
        }
        writeSseEvent(res, "error", {
          sessionId: sessionId ?? "",
          source,
          provider,
          providerKind,
          ...(model ? { model } : {}),
          message: streamError
        });
      }

      writeSseEvent(res, "done", {
        sessionId: sessionId ?? "",
        source,
        editorial,
        provider,
        providerKind,
        ...(model ? { model } : {}),
        ...(reasoningSummary ? { reasoningSummary } : {}),
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
    const safeFailureSignals = this.sanitizeFailureSignals(body.failureSignals);
    const safeFailureCase = this.sanitizeFailureCase(body.failureCase);
    const safeErrorMessage = this.redactPromptInjection(body.errorMessage ?? "", 240);
    const codeSignals = this.extractCodeSignals(body.code ?? "");
    const failureCaseFindings = this.extractFailureCaseFindings(body, safeFailureCase);
    const codeFindings = this.extractCodeFindings(body.code ?? "", body.status, safeErrorMessage || body.errorMessage);
    const metricLine = [
      `状态=${body.status ?? "unknown"}`,
      `通过=${body.passedCount ?? "?"}/${body.totalCount ?? "?"}`,
      `runtime=${body.runtimeMs ?? "?"}ms`,
      `memory=${body.memoryKb ?? "?"}KB`
    ].join("，");

    const failureLine = safeFailureSignals.length
      ? safeFailureSignals.map((item) => `${item.status}:${item.signal}`).join(" | ")
      : "暂无逐用例失败信号";
    const failureCaseLine = this.describeFailureCase(safeFailureCase);
    const findings = [...failureCaseFindings, ...codeFindings].slice(0, 4);
    const findingsBlock = findings.map((item) => `- ${item}`).join("\n");
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
        `- 错误信息：${safeErrorMessage || "none"}`,
        `- 失败信号：${failureLine}`,
        `- 失败样例：${failureCaseLine}`,
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
      `- 错误信息：${safeErrorMessage || "none"}`,
      `- 失败信号：${failureLine}`,
      `- 失败样例：${failureCaseLine}`,
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
    const safeFailureSignals = this.sanitizeFailureSignals(body.failureSignals);
    const safeFailureCase = this.sanitizeFailureCase(body.failureCase);
    const safeErrorMessage = this.redactPromptInjection(body.errorMessage ?? "", 240);
    const safeNoteContext = this.redactPromptInjection(body.noteContext ?? "", 2400);

    return JSON.stringify(
      {
        problemSlug: body.problemSlug ?? null,
        submissionId: body.submissionId ?? null,
        provider: normalizeAiProvider(body.provider),
        aiConfigId: body.aiConfigId ?? null,
        language: body.language ?? null,
        mode: body.mode ?? null,
        status: body.status ?? null,
        runtimeMs: body.runtimeMs ?? null,
        memoryKb: body.memoryKb ?? null,
        passedCount: body.passedCount ?? null,
        totalCount: body.totalCount ?? null,
        failureSignals: safeFailureSignals,
        failureCase: safeFailureCase ?? null,
        errorMessage: safeErrorMessage || null,
        code: body.code?.slice(0, 8000) ?? null,
        noteContext: safeNoteContext || null
      },
      null,
      2
    );
  }


  private sanitizeReviewBody(body: ReviewBody): ReviewBody {
    return {
      ...body,
      errorMessage: this.redactPromptInjection(body.errorMessage ?? "", 240) || null,
      failureSignals: this.sanitizeFailureSignals(body.failureSignals),
      failureCase: this.sanitizeFailureCase(body.failureCase) ?? null,
      noteContext: this.redactPromptInjection(body.noteContext ?? "", 12000) || undefined
    };
  }

  private sanitizeFailureSignals(signals?: ReviewFailureSignal[]): ReviewFailureSignal[] {
    if (!signals?.length) {
      return [];
    }

    return signals.slice(0, 5).map((item) => ({
      ...item,
      signal: this.redactPromptInjection(item.signal ?? "", 220)
    }));
  }

  private sanitizeFailureCase(failureCase?: ReviewFailureCase | null): ReviewFailureCase | undefined {
    if (!failureCase) {
      return undefined;
    }

    return {
      status: failureCase.status,
      isHidden: Boolean(failureCase.isHidden),
      inputData: this.redactPromptInjection(failureCase.inputData ?? "", 400),
      actualOutput: this.redactPromptInjection(failureCase.actualOutput ?? "", 220) || null,
      expectedOutput: this.redactPromptInjection(failureCase.expectedOutput ?? "", 220),
      stderr: this.redactPromptInjection(failureCase.stderr ?? "", 220) || null
    };
  }

  private describeFailureCase(failureCase?: ReviewFailureCase | null): string {
    if (!failureCase) {
      return "暂无结构化失败样例";
    }

    const visibility = failureCase.isHidden ? "隐藏用例" : "公开用例";
    return `${visibility}：输出=${failureCase.actualOutput ?? "(none)"}，期望=${failureCase.expectedOutput || "(none)"}`;
  }

  private extractFailureCaseFindings(body: ReviewBody, failureCase?: ReviewFailureCase | null): string[] {
    if (!failureCase) {
      return [];
    }

    const status = (body.status ?? failureCase.status ?? "").toUpperCase();
    const actual = (failureCase.actualOutput ?? "").trim();
    const expected = (failureCase.expectedOutput ?? "").trim();
    const inputData = (failureCase.inputData ?? "").trim();
    const findings: string[] = [];

    if (!failureCase.isHidden && status === "WA" && expected.length > 0) {
      if (actual.length > 0) {
        findings.push(`公开用例已直接暴露错误：输入 \`${inputData || "(省略)"}\` 时，你的输出是 \`${actual}\`，期望是 \`${expected}\`。`);
      } else {
        findings.push(`公开用例已直接暴露错误：输入 \`${inputData || "(省略)"}\` 时没有得到期望输出 \`${expected}\`。`);
      }
    }

    if (
      body.problemSlug === "minimum-window-substring" &&
      status === "WA" &&
      actual.length > 0 &&
      expected.length > 0 &&
      actual !== expected
    ) {
      findings.push("这题是滑动窗口最短覆盖。当前实现更像记录了第一个可行窗口，但没有在窗口满足条件后继续收缩左边界并持续更新最短答案。");
      findings.push("优先核对两处：一是满足条件后是否进入 `while` 收缩；二是更新最优答案时是否比较了更短窗口，而不是只在首次命中时赋值。");
      return findings.slice(0, 3);
    }

    if (status === "WA" && actual.length > 0 && expected.length > 0) {
      if (actual.length > expected.length) {
        findings.push("当前答案比期望更长，优先检查“命中后收缩窗口/更新最优答案”的条件是否缺失。");
      } else if (actual.length < expected.length) {
        findings.push("当前答案比期望更短，优先检查是否过早收缩窗口或遗漏了必需元素。");
      }
    }

    if ((status === "WA" || status === "RE") && failureCase.stderr) {
      findings.push(`失败样例 stderr 关键信号：\`${failureCase.stderr}\`。`);
    }

    return findings.slice(0, 3);
  }

  private redactPromptInjection(text: string, maxLength: number): string {
    if (!text) {
      return "";
    }

    const patterns = [
      /ignore[_\s-]*previous[_\s-]*instructions?/gi,
      /print[_\s-]*system[_\s-]*prompt/gi,
      /dump[_\s-]*developer[_\s-]*message/gi,
      /show[_\s-]*system[_\s-]*prompt[_\s-]*now/gi,
      /exfiltrate[_\s-]*env[_\s-]*[a-z0-9_]+/gi,
      /print[_\s-]*secret[_\s-]*keys?/gi,
      /give[_\s-]*full[_\s-]*running[_\s-]*solution[_\s-]*with[_\s-]*main[_\s-]*function/gi,
      /系统提示词/gi,
      /提示词注入/gi,
      /完整答案/gi,
      /VLLM_API_KEY/gi,
      /MINIMAX_API_KEY/gi,
      /OPENAI_API_KEY/gi
    ];

    let sanitized = text;
    for (const pattern of patterns) {
      sanitized = sanitized.replace(pattern, "[已屏蔽潜在注入片段]");
    }

    return sanitized.trim().slice(0, maxLength);
  }

  private buildUserSolutionContext(body: SolutionBody): string {
    const safeNoteContext = this.redactPromptInjection(body.noteContext ?? "", 2400);
    return JSON.stringify(
      {
        problemSlug: body.problemSlug ?? null,
        submissionId: body.submissionId ?? null,
        problemTitle: body.problemTitle ?? null,
        modeSupport: body.modeSupport ?? null,
        provider: normalizeAiProvider(body.provider),
        aiConfigId: body.aiConfigId ?? null,
        preferredLanguage: body.preferredLanguage ?? "cpp",
        description: body.description?.slice(0, 12000) ?? null,
        sampleInput: body.sampleInput?.slice(0, 2000) ?? null,
        sampleOutput: body.sampleOutput?.slice(0, 2000) ?? null,
        noteContext: safeNoteContext || null
      },
      null,
      2
    );
  }

  private async buildAiTutorReviewPayload(
    body: ReviewBody,
    sessionId: string | null,
    provider: AiProvider | null,
    userId: string
  ): Promise<ReviewBody> {
    const normalizedProvider = provider ?? normalizeAiProvider(body.provider);
    const basePayload: ReviewBody = {
      ...body,
      sessionId: sessionId ?? undefined,
      provider: normalizedProvider ?? undefined,
      aiConfigId: body.aiConfigId ?? undefined
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

      const [failureSignals, failureCase] = await Promise.all([
        this.loadSubmissionFailureSignals(row.id),
        this.loadSubmissionFailureCase(row.id)
      ]);
      const resolvedProblemSlug = basePayload.problemSlug ?? row.problemSlug;
      const noteContext = await this.loadProblemNoteContext(userId, resolvedProblemSlug);

      return {
        ...basePayload,
        problemSlug: resolvedProblemSlug,
        language: basePayload.language ?? row.language,
        mode: basePayload.mode ?? row.mode,
        code: basePayload.code ?? row.code,
        status: basePayload.status ?? row.status,
        runtimeMs: basePayload.runtimeMs ?? row.runtimeMs,
        memoryKb: basePayload.memoryKb ?? row.memoryKb,
        passedCount: basePayload.passedCount ?? row.passedCount,
        totalCount: basePayload.totalCount ?? row.totalCount,
        errorMessage: basePayload.errorMessage ?? row.errorMessage,
        failureSignals: basePayload.failureSignals?.length ? basePayload.failureSignals : failureSignals,
        failureCase: basePayload.failureCase ?? failureCase,
        noteContext: basePayload.noteContext ?? noteContext ?? undefined
      };
    } catch {
      const noteContext = await this.loadProblemNoteContext(userId, basePayload.problemSlug);
      return {
        ...basePayload,
        noteContext: basePayload.noteContext ?? noteContext ?? undefined
      };
    }
  }

  private async buildAiTutorSolutionPayload(
    body: SolutionBody,
    sessionId: string | null,
    provider: AiProvider | null,
    userId: string
  ): Promise<SolutionBody> {
    const normalizedProvider = provider ?? normalizeAiProvider(body.provider);
    const noteContext = await this.loadProblemNoteContext(userId, body.problemSlug);
    return {
      ...body,
      sessionId: sessionId ?? undefined,
      provider: normalizedProvider ?? undefined,
      aiConfigId: body.aiConfigId ?? undefined,
      noteContext: body.noteContext ?? noteContext ?? undefined
    };
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

  private async loadSubmissionFailureCase(submissionId: string): Promise<ReviewFailureCase | null> {
    const result = await query<SubmissionFailureCaseRow>(
      `
        SELECT
          scr.status,
          tc.is_hidden AS "isHidden",
          tc.input_data AS "inputData",
          scr.actual_output AS "actualOutput",
          tc.expected_output AS "expectedOutput",
          scr.stderr
        FROM submission_case_results scr
        INNER JOIN test_cases tc ON tc.id = scr.case_id
        WHERE scr.submission_id = $1
          AND scr.status <> 'AC'
        ORDER BY tc.is_hidden ASC, scr.id ASC
        LIMIT 1;
      `,
      [submissionId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      ...row,
      actualOutput: row.actualOutput ?? inferActualOutputFromStderr(row.stderr)
    };
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

  private async loadProblemNoteContext(userId: string, problemSlug?: string): Promise<string | null> {
    if (!problemSlug) {
      return null;
    }

    try {
      const result = await query<ProblemNoteContextRow>(
        `
          SELECT
            user_problem_notes.content_md AS "contentMd",
            user_problem_notes.matched_heading AS "matchedHeading",
            user_problem_notes.source_filename AS "sourceFilename"
          FROM user_problem_notes
          INNER JOIN problems ON problems.id = user_problem_notes.problem_id
          WHERE user_problem_notes.user_id = $1
            AND problems.slug = $2
          LIMIT 1;
        `,
        [userId, problemSlug]
      );

      const row = result.rows[0];
      if (!row?.contentMd) {
        return null;
      }

      const header = `笔记来源: ${row.sourceFilename} | 匹配段落: ${row.matchedHeading}`;
      return `${header}\n\n${row.contentMd}`.slice(0, 12000);
    } catch {
      return null;
    }
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
        getOrCreateDemoUserId(),
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
      submissionId: body.submissionId,
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
}
