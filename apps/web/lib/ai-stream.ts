export type SseFrame = {
  event: string;
  data: string;
};

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

function parseAiSemanticPayload(raw: string): AiSemanticPayload {
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
  let doneReceived = false;
  let content = "";
  let reasoningSummary = "";
  let streamError = "";

  const applyFrame = (event: string, payload: AiSemanticPayload) => {
    if (event === "meta") {
      options.onMeta?.(payload);
      return;
    }

    if (event === "phase") {
      options.onPhase?.(payload);
      return;
    }

    if (event === "response.reasoning_summary_text.delta") {
      const delta = readString(payload.delta);
      if (delta) {
        reasoningSummary += delta;
        options.onReasoningDelta?.(delta, payload);
      }
      return;
    }

    if (event === "response.output_text.delta" || event === "delta") {
      const delta = readString(payload.delta);
      if (delta) {
        content += delta;
        options.onContentDelta?.(delta, payload);
      }
      return;
    }

    if (event === "response.output_text.replace") {
      const text = readString(payload.text);
      if (text) {
        content = text;
        options.onContentReplace?.(text, payload);
      }
      return;
    }

    if (event === "error") {
      const message = readString(payload.message) || readString(payload.error);
      streamError = message;
      options.onError?.(message, payload);
      return;
    }

    if (event === "response.completed" || event === "done") {
      doneReceived = true;
      const finalContent = readString(payload[contentField]);
      const finalReasoning = readString(payload.reasoningSummary);
      const finalError = readString(payload.error);
      if (finalContent) {
        content = finalContent;
        options.onContentReplace?.(finalContent, payload);
      }
      if (finalReasoning) {
        reasoningSummary = finalReasoning;
      }
      if (finalError) {
        streamError = finalError;
        options.onError?.(finalError, payload);
      }
      options.onCompleted?.(payload);
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
      applyFrame(frame.event, parseAiSemanticPayload(frame.data));
    }
  }

  buffer += decoder.decode();
  const parsed = consumeSseFrames(buffer);
  buffer = parsed.rest;
  for (const frame of parsed.frames) {
    applyFrame(frame.event, parseAiSemanticPayload(frame.data));
  }

  if (buffer.trim().length > 0) {
    const tailFrames = consumeSseFrames(`${buffer.trim()}\n\n`).frames;
    for (const frame of tailFrames) {
      applyFrame(frame.event, parseAiSemanticPayload(frame.data));
    }
  }

  return {
    doneReceived,
    content,
    reasoningSummary,
    error: streamError
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
