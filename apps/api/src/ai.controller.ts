import { Body, Controller, Post, Res } from "@nestjs/common";
import { query } from "./db";

type ReviewBody = {
  problemSlug?: string;
  submissionId?: string;
  sessionId?: string;
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
};

type AiTutorResponse = {
  guidance?: string;
  source?: string;
};

type AiTutorSolutionResponse = {
  editorial?: string;
  source?: string;
};

type AiMessageRole = "user" | "assistant" | "system";

type UserRow = {
  id: string;
};

type IdRow = {
  id: string;
};

type SseFrame = {
  event: string;
  data: string;
};

type ParsedSsePayload = Record<string, unknown> | string;

const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL ?? "demo@leetcodepro.local";
const AI_TUTOR_TIMEOUT_MS = Number(process.env.AI_TUTOR_TIMEOUT_MS ?? 12000);

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

function readStringField(payload: ParsedSsePayload, field: string): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const value = payload[field];
  return typeof value === "string" ? value : null;
}

@Controller("ai")
export class AiController {
  @Post("review")
  async review(@Body() body: ReviewBody) {
    const fallbackMessage = this.buildFallbackGuidance(body);
    const aiTutorBaseUrl = process.env.AI_TUTOR_BASE_URL ?? "http://localhost:8000";
    const sessionId = await this.ensureReviewSession(body);
    await this.appendAiMessage(sessionId, "user", this.buildUserReviewContext(body));

    let guidance = fallbackMessage;
    let source = "api-fallback";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), AI_TUTOR_TIMEOUT_MS);

      const response = await fetch(`${aiTutorBaseUrl}/review`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          ...body,
          sessionId
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (response.ok) {
        const json = (await response.json()) as AiTutorResponse;
        guidance = json.guidance ?? fallbackMessage;
        source = json.source ?? "ai-tutor";
      }
    } catch {
      // Fallback below.
    }

    await this.appendAiMessage(sessionId, "assistant", guidance, { source });

    return {
      sessionId,
      guidance,
      source
    };
  }

  @Post("review/stream")
  async reviewStream(@Body() body: ReviewBody, @Res() res: SseResponse): Promise<void> {
    const fallbackMessage = this.buildFallbackGuidance(body);
    const aiTutorBaseUrl = process.env.AI_TUTOR_BASE_URL ?? "http://localhost:8000";
    const sessionId = await this.ensureReviewSession(body);
    await this.appendAiMessage(sessionId, "user", this.buildUserReviewContext(body));

    res.status(200);
    res.setHeader("content-type", "text/event-stream; charset=utf-8");
    res.setHeader("cache-control", "no-cache, no-transform");
    res.setHeader("connection", "keep-alive");
    res.setHeader("x-accel-buffering", "no");
    res.flushHeaders();

    writeSseEvent(res, "meta", {
      sessionId: sessionId ?? "",
      source: "api-proxy"
    });

    let source = "ai-tutor";
    let guidance = "";
    let doneSent = false;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TUTOR_TIMEOUT_MS);

    res.on("close", () => {
      controller.abort();
    });

    try {
      const upstream = await fetch(`${aiTutorBaseUrl}/review/stream`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          ...body,
          sessionId
        }),
        signal: controller.signal
      });

      if (!upstream.ok || !upstream.body) {
        throw new Error(`Upstream SSE unavailable: ${upstream.status}`);
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
            writeSseEvent(res, "meta", {
              sessionId: sessionId ?? "",
              source
            });
            continue;
          }

          if (frame.event === "delta") {
            const delta = readStringField(payload, "delta") ?? (typeof payload === "string" ? payload : "");
            if (delta.length > 0) {
              guidance += delta;
              writeSseEvent(res, "delta", { delta });
            }
            continue;
          }

          if (frame.event === "done") {
            source = readStringField(payload, "source") ?? source;
            const finalGuidance = readStringField(payload, "guidance");
            if (finalGuidance && finalGuidance.length > 0) {
              guidance = finalGuidance;
            }

            writeSseEvent(res, "done", {
              sessionId: sessionId ?? "",
              source,
              guidance
            });
            doneSent = true;
          }
        }
      }
    } catch {
      source = "api-fallback";
      guidance = fallbackMessage;
      writeSseEvent(res, "delta", { delta: guidance });
      writeSseEvent(res, "done", {
        sessionId: sessionId ?? "",
        source,
        guidance
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
        guidance
      });
    }

    await this.appendAiMessage(sessionId, "assistant", guidance, { source });
    res.end();
  }

  @Post("solution")
  async solution(@Body() body: SolutionBody) {
    const fallbackEditorial = this.buildFallbackEditorial(body);
    const aiTutorBaseUrl = process.env.AI_TUTOR_BASE_URL ?? "http://localhost:8000";
    const sessionId = await this.ensureSolutionSession(body);
    await this.appendAiMessage(sessionId, "user", this.buildUserSolutionContext(body));

    let editorial = fallbackEditorial;
    let source = "api-fallback";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), AI_TUTOR_TIMEOUT_MS);

      const response = await fetch(`${aiTutorBaseUrl}/solution`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          ...body,
          sessionId
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (response.ok) {
        const json = (await response.json()) as AiTutorSolutionResponse;
        editorial = json.editorial ?? fallbackEditorial;
        source = json.source ?? "ai-tutor";
      }
    } catch {
      // Fallback below.
    }

    await this.appendAiMessage(sessionId, "assistant", editorial, { source, type: "solution" });

    return {
      sessionId,
      editorial,
      source
    };
  }

  @Post("solution/stream")
  async solutionStream(@Body() body: SolutionBody, @Res() res: SseResponse): Promise<void> {
    const fallbackEditorial = this.buildFallbackEditorial(body);
    const aiTutorBaseUrl = process.env.AI_TUTOR_BASE_URL ?? "http://localhost:8000";
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
      source: "api-proxy"
    });

    let source = "ai-tutor";
    let editorial = "";
    let doneSent = false;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TUTOR_TIMEOUT_MS);

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
          sessionId
        }),
        signal: controller.signal
      });

      if (!upstream.ok || !upstream.body) {
        throw new Error(`Upstream SSE unavailable: ${upstream.status}`);
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
            writeSseEvent(res, "meta", {
              sessionId: sessionId ?? "",
              source
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

          if (frame.event === "done") {
            source = readStringField(payload, "source") ?? source;
            const finalEditorial = readStringField(payload, "editorial");
            if (finalEditorial && finalEditorial.length > 0) {
              editorial = finalEditorial;
            }

            writeSseEvent(res, "done", {
              sessionId: sessionId ?? "",
              source,
              editorial
            });
            doneSent = true;
          }
        }
      }
    } catch {
      source = "api-fallback";
      editorial = fallbackEditorial;
      writeSseEvent(res, "delta", { delta: editorial });
      writeSseEvent(res, "done", {
        sessionId: sessionId ?? "",
        source,
        editorial
      });
      doneSent = true;
    } finally {
      clearTimeout(timeout);
    }

    if (!doneSent) {
      if (editorial.length === 0) {
        source = "api-fallback";
        editorial = fallbackEditorial;
        writeSseEvent(res, "delta", { delta: editorial });
      }

      writeSseEvent(res, "done", {
        sessionId: sessionId ?? "",
        source,
        editorial
      });
    }

    await this.appendAiMessage(sessionId, "assistant", editorial, { source, type: "solution" });
    res.end();
  }

  private buildFallbackGuidance(body: ReviewBody): string {
    if (body.status === "AC") {
      return "代码已通过。下一步请尝试优化变量命名与边界条件表达，让思路更易读。";
    }

    const errorPart = body.errorMessage ? `错误信息：${body.errorMessage}。` : "";

    return `先不要急着重写。${errorPart}建议你先用最小反例手动推演一次，并重点检查边界处理与循环终止条件。`;
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
        status: body.status ?? null,
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
        preferredLanguage: body.preferredLanguage ?? "cpp",
        description: body.description?.slice(0, 12000) ?? null,
        sampleInput: body.sampleInput?.slice(0, 2000) ?? null,
        sampleOutput: body.sampleOutput?.slice(0, 2000) ?? null
      },
      null,
      2
    );
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
