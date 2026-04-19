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
