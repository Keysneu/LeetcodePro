import {
  consumeAiSemanticStream,
  createStreamTextBatcher,
  type AiSemanticPayload
} from "@/lib/ai-stream";

export type AiStreamPhaseStatus = {
  stage: string;
  message: string;
  elapsedMs: number;
};

type RunAiStreamRequestOptions = {
  url: string;
  body: Record<string, unknown>;
  contentField: "guidance" | "editorial";
  parseErrorPayload: (payload: unknown) => string;
  normalizeResponseError?: (message: string) => string;
  onReasoningChange: (next: string) => void;
  onContentChange: (next: string) => void;
  onMeta?: (payload: AiSemanticPayload) => void;
  onPhase?: (payload: AiSemanticPayload) => void;
  onCompleted?: (payload: AiSemanticPayload) => void;
  onError?: (message: string, payload: AiSemanticPayload) => void;
};

export type RunAiStreamRequestResult = {
  doneReceived: boolean;
  content: string;
  reasoningSummary: string;
  error: string;
};

export function readPhaseStatusPayload(payload: AiSemanticPayload, previous: AiStreamPhaseStatus | null): AiStreamPhaseStatus {
  return {
    stage: typeof payload.stage === "string" && payload.stage.length > 0 ? payload.stage : "progress",
    message: typeof payload.message === "string" && payload.message.length > 0 ? payload.message : "正在处理中。",
    elapsedMs: typeof payload.elapsedMs === "number" ? payload.elapsedMs : previous?.elapsedMs ?? 0
  };
}

export async function runAiStreamRequest(options: RunAiStreamRequestOptions): Promise<RunAiStreamRequestResult> {
  const streamTextBatcher = createStreamTextBatcher({
    onReasoningChange: options.onReasoningChange,
    onContentChange: options.onContentChange
  });

  try {
    const response = await fetch(options.url, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(options.body)
    });

    if (!response.ok || !response.body) {
      const fallbackPayload = (await response.json().catch(() => null)) as unknown;
      const parsedMessage = options.parseErrorPayload(fallbackPayload);
      throw new Error(options.normalizeResponseError?.(parsedMessage) ?? parsedMessage);
    }

    const streamResult = await consumeAiSemanticStream({
      response,
      contentField: options.contentField,
      onMeta: options.onMeta,
      onPhase: options.onPhase,
      onReasoningDelta(delta) {
        streamTextBatcher.appendReasoning(delta);
      },
      onReasoningReplace(text) {
        streamTextBatcher.replaceReasoning(text);
      },
      onContentDelta(delta) {
        streamTextBatcher.appendContent(delta);
      },
      onContentReplace(text) {
        streamTextBatcher.replaceContent(text);
      },
      onCompleted(payload) {
        streamTextBatcher.flushNow();
        options.onCompleted?.(payload);
      },
      onError(message, payload) {
        options.onError?.(message, payload);
      }
    });

    streamTextBatcher.flushNow();
    return streamResult;
  } finally {
    streamTextBatcher.flushNow();
    streamTextBatcher.dispose();
  }
}
