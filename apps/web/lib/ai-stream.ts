export type SseFrame = {
  event: string;
  data: string;
};

export type AiStreamContentKind = "reasoning" | "content";

export type AiStreamFrame = {
  event: string;
  payload: AiSemanticPayload;
};

export type AiStreamState = {
  doneReceived: boolean;
  content: string;
  reasoning: string;
  error: string;
  lastContentDeltaEvent: "response.output_text.delta" | "delta" | "";
  lastContentDelta: string;
};

export type AiStreamFrameEffect =
  | { kind: "none" }
  | { kind: "meta"; payload: AiSemanticPayload }
  | { kind: "phase"; payload: AiSemanticPayload }
  | { kind: "reasoning-delta"; delta: string; payload: AiSemanticPayload }
  | { kind: "reasoning-replace"; text: string; payload: AiSemanticPayload }
  | { kind: "content-delta"; delta: string; payload: AiSemanticPayload }
  | { kind: "content-replace"; text: string; payload: AiSemanticPayload }
  | { kind: "error"; message: string; payload: AiSemanticPayload }
  | { kind: "completed"; payload: AiSemanticPayload };

type SseBoundary = {
  index: number;
  separatorLength: number;
};

type StreamTextBatcherOptions = {
  onReasoningChange: (next: string) => void;
  onContentChange: (next: string) => void;
};

export type StreamTextBatcher = {
  appendReasoning: (delta: string) => void;
  appendContent: (delta: string) => void;
  replaceReasoning: (next: string) => void;
  replaceContent: (next: string) => void;
  flushNow: () => void;
  dispose: () => void;
  getReasoning: () => string;
  getContent: () => string;
};

export type AiSemanticPayload = Record<string, unknown> & {
  sessionId?: string;
  source?: string;
  provider?: string;
  providerKind?: string;
  model?: string;
  stage?: string;
  elapsedMs?: number;
  reasoningSummary?: string;
  delta?: string;
  text?: string;
  guidance?: string;
  editorial?: string;
  error?: string;
  message?: string;
};

export type AiSemanticStreamOptions = {
  response: Response;
  contentField: "guidance" | "editorial";
  onMeta?: (payload: AiSemanticPayload) => void;
  onPhase?: (payload: AiSemanticPayload) => void;
  onReasoningDelta?: (delta: string, payload: AiSemanticPayload) => void;
  onReasoningReplace?: (text: string, payload: AiSemanticPayload) => void;
  onContentDelta?: (delta: string, payload: AiSemanticPayload) => void;
  onContentReplace?: (text: string, payload: AiSemanticPayload) => void;
  onCompleted?: (payload: AiSemanticPayload) => void;
  onError?: (message: string, payload: AiSemanticPayload) => void;
};

function findSseBoundary(buffer: string): SseBoundary | null {
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

export function parseSseBlock(block: string): SseFrame | null {
  const lines = block.split(/\r?\n/);
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

export function consumeSseFrames(buffer: string): {
  frames: SseFrame[];
  rest: string;
} {
  const frames: SseFrame[] = [];
  let rest = buffer;

  while (true) {
    const boundary = findSseBoundary(rest);
    if (!boundary) {
      break;
    }

    const rawBlock = rest.slice(0, boundary.index);
    rest = rest.slice(boundary.index + boundary.separatorLength);
    const frame = parseSseBlock(rawBlock);
    if (frame) {
      frames.push(frame);
    }
  }

  return { frames, rest };
}

export function parseAiSemanticPayload(raw: string): AiSemanticPayload {
  if (raw.trim() === "[DONE]") {
    return { type: "done" };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as AiSemanticPayload;
    }
  } catch {
    // Treat non-JSON SSE data as a text delta.
  }

  return { delta: raw };
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function createInitialAiStreamState(): AiStreamState {
  return {
    doneReceived: false,
    content: "",
    reasoning: "",
    error: "",
    lastContentDeltaEvent: "",
    lastContentDelta: ""
  };
}

function rememberContentDelta(
  state: AiStreamState,
  event: "response.output_text.delta" | "delta",
  delta: string
): void {
  state.lastContentDeltaEvent = event;
  state.lastContentDelta = delta;
}

function clearContentDeltaMemory(state: AiStreamState): void {
  state.lastContentDeltaEvent = "";
  state.lastContentDelta = "";
}

export function normalizeAiStreamFrame(frame: SseFrame): AiStreamFrame {
  const payload = parseAiSemanticPayload(frame.data);
  const payloadType = typeof payload.type === "string" ? payload.type : "";
  return {
    event: payloadType && frame.event === "message" ? payloadType : frame.event,
    payload
  };
}

export function applyAiStreamFrameToState(
  previous: AiStreamState,
  frame: AiStreamFrame,
  contentField: "guidance" | "editorial"
): { state: AiStreamState; effect: AiStreamFrameEffect } {
  const state: AiStreamState = { ...previous };
  const { event, payload } = frame;

  if (event === "meta") {
    return { state, effect: { kind: "meta", payload } };
  }

  if (event === "phase") {
    return { state, effect: { kind: "phase", payload } };
  }

  if (
    event === "response.reasoning_summary_text.delta" ||
    event === "response.reasoning_text.delta" ||
    event === "response.thinking.delta" ||
    event === "thinking_delta"
  ) {
    const delta = readString(payload.delta) || readString(payload.text);
    if (!delta) {
      return { state, effect: { kind: "none" } };
    }
    state.reasoning += delta;
    return { state, effect: { kind: "reasoning-delta", delta, payload } };
  }

  if (
    event === "response.reasoning_summary_text.done" ||
    event === "response.reasoning_text.done" ||
    event === "response.thinking.done"
  ) {
    const text = readOptionalString(payload.text) ?? readOptionalString(payload.reasoningSummary);
    if (text === null) {
      return { state, effect: { kind: "none" } };
    }
    state.reasoning = text;
    return { state, effect: { kind: "reasoning-replace", text, payload } };
  }

  if (event === "response.output_text.delta" || event === "delta") {
    const delta = readString(payload.delta) || readString(payload.text);
    if (!delta) {
      return { state, effect: { kind: "none" } };
    }
    if (
      event === "delta" &&
      state.lastContentDeltaEvent === "response.output_text.delta" &&
      state.lastContentDelta === delta
    ) {
      rememberContentDelta(state, "delta", delta);
      return { state, effect: { kind: "none" } };
    }
    state.content += delta;
    rememberContentDelta(state, event, delta);
    return { state, effect: { kind: "content-delta", delta, payload } };
  }

  if (event === "response.output_text.replace" || event === "response.output_text.done") {
    const text = readOptionalString(payload.text) ?? readOptionalString(payload[contentField]);
    if (text === null) {
      return { state, effect: { kind: "none" } };
    }
    state.content = text;
    clearContentDeltaMemory(state);
    return { state, effect: { kind: "content-replace", text, payload } };
  }

  if (event === "error") {
    const message = readString(payload.message) || readString(payload.error);
    state.error = message;
    return { state, effect: { kind: "error", message, payload } };
  }

  if (event === "response.completed" || event === "done" || payload.type === "done") {
    state.doneReceived = true;
    const finalContent = readOptionalString(payload[contentField]);
    const finalReasoning = readOptionalString(payload.reasoningSummary);
    const finalError = readOptionalString(payload.error);

    if (finalContent !== null) {
      state.content = finalContent;
      clearContentDeltaMemory(state);
    }
    if (finalReasoning !== null) {
      state.reasoning = finalReasoning;
    }
    if (finalError !== null) {
      state.error = finalError;
    }

    return { state, effect: { kind: "completed", payload } };
  }

  return { state, effect: { kind: "none" } };
}

export async function consumeAiSemanticStream(options: AiSemanticStreamOptions): Promise<{
  doneReceived: boolean;
  content: string;
  reasoningSummary: string;
  error: string;
}> {
  const { response, contentField } = options;
  if (!response.body) {
    throw new Error("SSE response body missing");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamState = createInitialAiStreamState();

  const applyFrame = (frame: SseFrame) => {
    const applied = applyAiStreamFrameToState(streamState, normalizeAiStreamFrame(frame), contentField);
    streamState = applied.state;

    switch (applied.effect.kind) {
      case "meta":
        options.onMeta?.(applied.effect.payload);
        break;
      case "phase":
        options.onPhase?.(applied.effect.payload);
        break;
      case "reasoning-delta":
        options.onReasoningDelta?.(applied.effect.delta, applied.effect.payload);
        break;
      case "reasoning-replace":
        options.onReasoningReplace?.(applied.effect.text, applied.effect.payload);
        break;
      case "content-delta":
        options.onContentDelta?.(applied.effect.delta, applied.effect.payload);
        break;
      case "content-replace":
        options.onContentReplace?.(applied.effect.text, applied.effect.payload);
        break;
      case "error":
        options.onError?.(applied.effect.message, applied.effect.payload);
        break;
      case "completed": {
        const finalContent = readOptionalString(applied.effect.payload[contentField]);
        const finalReasoning = readOptionalString(applied.effect.payload.reasoningSummary);
        const finalError = readOptionalString(applied.effect.payload.error);
        if (finalContent !== null) {
          options.onContentReplace?.(finalContent, applied.effect.payload);
        }
        if (finalReasoning !== null) {
          options.onReasoningReplace?.(finalReasoning, applied.effect.payload);
        }
        if (finalError !== null) {
          options.onError?.(finalError, applied.effect.payload);
        }
        options.onCompleted?.(applied.effect.payload);
        break;
      }
      case "none":
        break;
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parsed = consumeSseFrames(buffer);
    buffer = parsed.rest;
    for (const frame of parsed.frames) {
      applyFrame(frame);
    }
  }

  buffer += decoder.decode();
  const parsed = consumeSseFrames(buffer);
  buffer = parsed.rest;
  for (const frame of parsed.frames) {
    applyFrame(frame);
  }

  if (buffer.trim().length > 0) {
    const tailFrames = consumeSseFrames(`${buffer.trim()}\n\n`).frames;
    for (const frame of tailFrames) {
      applyFrame(frame);
    }
  }

  return {
    doneReceived: streamState.doneReceived,
    content: streamState.content,
    reasoningSummary: streamState.reasoning,
    error: streamState.error
  };
}

export function createStreamTextBatcher(options: StreamTextBatcherOptions): StreamTextBatcher {
  let reasoningText = "";
  let contentText = "";
  let flushedReasoningText = "";
  let flushedContentText = "";
  let animationFrameId: number | null = null;
  let timeoutId: number | null = null;
  let scheduled = false;

  const flush = () => {
    scheduled = false;
    animationFrameId = null;
    timeoutId = null;

    if (flushedReasoningText !== reasoningText) {
      flushedReasoningText = reasoningText;
      options.onReasoningChange(reasoningText);
    }

    if (flushedContentText !== contentText) {
      flushedContentText = contentText;
      options.onContentChange(contentText);
    }
  };

  const scheduleFlush = () => {
    if (scheduled) {
      return;
    }

    scheduled = true;
    if (typeof window === "undefined") {
      flush();
      return;
    }

    if (typeof window.requestAnimationFrame === "function") {
      animationFrameId = window.requestAnimationFrame(() => {
        flush();
      });
      return;
    }

    timeoutId = window.setTimeout(() => {
      flush();
    }, 16);
  };

  const cancelScheduledFlush = () => {
    if (typeof window === "undefined") {
      return;
    }

    if (animationFrameId !== null) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }

    scheduled = false;
  };

  return {
    appendReasoning(delta: string) {
      if (!delta) {
        return;
      }
      reasoningText += delta;
      scheduleFlush();
    },
    appendContent(delta: string) {
      if (!delta) {
        return;
      }
      contentText += delta;
      scheduleFlush();
    },
    replaceReasoning(next: string) {
      reasoningText = next;
      scheduleFlush();
    },
    replaceContent(next: string) {
      contentText = next;
      scheduleFlush();
    },
    flushNow() {
      cancelScheduledFlush();
      flush();
    },
    dispose() {
      cancelScheduledFlush();
    },
    getReasoning() {
      return reasoningText;
    },
    getContent() {
      return contentText;
    }
  };
}
