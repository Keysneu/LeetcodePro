"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import CodeEditor, { EditorState } from "@/components/code-editor";

type SubmissionStatus = "QUEUED" | "RUNNING" | "AC" | "WA" | "TLE" | "RE" | "CE";

type SubmissionItem = {
  id: string;
  problemSlug: string;
  language: "cpp" | "python";
  mode: "core" | "acm";
  code: string;
  status: SubmissionStatus;
  runtimeMs: number | null;
  memoryKb: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type AiReviewResponse = {
  guidance?: string;
  source?: string;
  sessionId?: string | null;
};

type AiStreamPayload = {
  sessionId?: string;
  source?: string;
  delta?: string;
  guidance?: string;
};

type Props = {
  apiBaseUrl: string;
  problemSlug: string;
  modeSupport: "CORE" | "ACM" | "BOTH";
  initialCoreCodes: Record<"cpp" | "python", string>;
};

const TERMINAL_STATUSES = new Set<SubmissionStatus>(["AC", "WA", "TLE", "RE", "CE"]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseErrorMessage(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }

  if (typeof payload !== "object" || payload === null) {
    return "请求失败，请稍后重试。";
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.message === "string") {
    return record.message;
  }

  if (Array.isArray(record.message) && typeof record.message[0] === "string") {
    return record.message[0];
  }

  return "请求失败，请稍后重试。";
}

function parseSseBlock(block: string): { event: string; data: string } | null {
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

function parseSsePayload(raw: string): AiStreamPayload {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as AiStreamPayload;
    }
  } catch {
    // Fallback below.
  }

  return {
    delta: raw
  };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error(parseErrorMessage(payload));
  }

  return payload as T;
}

function statusClass(status: SubmissionStatus): string {
  if (status === "AC") {
    return "lc-status-ac";
  }
  if (status === "QUEUED" || status === "RUNNING") {
    return "lc-status-pending";
  }
  return "lc-status-fail";
}

export default function ProblemWorkspace({ apiBaseUrl, problemSlug, modeSupport, initialCoreCodes }: Props) {
  const [editorState, setEditorState] = useState<EditorState>({
    mode: "core",
    language: "cpp",
    code: initialCoreCodes.cpp
  });
  const [submission, setSubmission] = useState<SubmissionItem | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiGuidance, setAiGuidance] = useState<string>("");
  const [aiSource, setAiSource] = useState<string>("");
  const [aiSessionId, setAiSessionId] = useState<string>("");
  const latestSubmissionIdRef = useRef<string | null>(null);

  const canAskAi = useMemo(() => submission !== null && TERMINAL_STATUSES.has(submission.status), [submission]);

  const pollSubmissionUntilTerminal = useCallback(
    async (submissionId: string) => {
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const result = await fetchJson<{ item: SubmissionItem }>(`${apiBaseUrl}/api/submissions/${submissionId}`);
        const item = result.item;

        if (latestSubmissionIdRef.current !== submissionId) {
          return;
        }

        setSubmission(item);

        if (TERMINAL_STATUSES.has(item.status)) {
          return;
        }

        await sleep(700);
      }

      setSubmitError("判题轮询超时，请稍后点击“刷新结果”继续查询。");
    },
    [apiBaseUrl]
  );

  const handleSubmit = useCallback(async () => {
    setSubmitError(null);
    setAiError(null);
    setAiGuidance("");
    setAiSource("");
    setAiSessionId("");
    setSubmitLoading(true);

    try {
      const result = await fetchJson<{ item: SubmissionItem }>(`${apiBaseUrl}/api/submissions`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          problemSlug,
          language: editorState.language,
          mode: editorState.mode,
          code: editorState.code
        })
      });

      latestSubmissionIdRef.current = result.item.id;
      setSubmission(result.item);
      await pollSubmissionUntilTerminal(result.item.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "提交失败，请稍后重试。";
      setSubmitError(message);
    } finally {
      setSubmitLoading(false);
    }
  }, [apiBaseUrl, editorState.code, editorState.language, editorState.mode, pollSubmissionUntilTerminal, problemSlug]);

  const refreshSubmission = useCallback(async () => {
    if (!submission?.id) {
      return;
    }

    setSubmitError(null);
    latestSubmissionIdRef.current = submission.id;
    setSubmitLoading(true);

    try {
      await pollSubmissionUntilTerminal(submission.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "刷新失败，请稍后重试。";
      setSubmitError(message);
    } finally {
      setSubmitLoading(false);
    }
  }, [pollSubmissionUntilTerminal, submission?.id]);

  const handleAiReview = useCallback(async () => {
    if (!submission) {
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiGuidance("");
    setAiSource("");
    setAiSessionId("");

    try {
      const response = await fetch(`${apiBaseUrl}/api/ai/review/stream`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          problemSlug,
          submissionId: submission.id,
          code: submission.code,
          status: submission.status,
          errorMessage: submission.errorMessage
        })
      });

      if (!response.ok || !response.body) {
        const fallbackPayload = (await response.json().catch(() => null)) as unknown;
        throw new Error(parseErrorMessage(fallbackPayload));
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
            if (typeof payload.source === "string" && payload.source.length > 0) {
              source = payload.source;
              setAiSource(source);
            }
            if (typeof payload.sessionId === "string" && payload.sessionId.length > 0) {
              sessionId = payload.sessionId;
              setAiSessionId(sessionId);
            }
            continue;
          }

          if (frame.event === "delta") {
            const delta = typeof payload.delta === "string" ? payload.delta : "";
            if (delta.length > 0) {
              guidance += delta;
              setAiGuidance(guidance);
            }
            continue;
          }

          if (frame.event === "done") {
            if (typeof payload.guidance === "string" && payload.guidance.length > 0) {
              guidance = payload.guidance;
              setAiGuidance(guidance);
            }
            if (typeof payload.source === "string" && payload.source.length > 0) {
              source = payload.source;
              setAiSource(source);
            }
            if (typeof payload.sessionId === "string" && payload.sessionId.length > 0) {
              sessionId = payload.sessionId;
              setAiSessionId(sessionId);
            }
          }
        }
      }

      if (guidance.length === 0) {
        const fallback = await fetchJson<AiReviewResponse>(`${apiBaseUrl}/api/ai/review`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            problemSlug,
            submissionId: submission.id,
            code: submission.code,
            status: submission.status,
            errorMessage: submission.errorMessage
          })
        });
        setAiGuidance(fallback.guidance ?? "AI 暂未返回建议，请稍后重试。");
        setAiSource(fallback.source ?? "");
        setAiSessionId(fallback.sessionId ?? "");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 点评失败，请稍后重试。";
      setAiError(message);
    } finally {
      setAiLoading(false);
    }
  }, [apiBaseUrl, problemSlug, submission]);

  return (
    <section className="space-y-4">
      <div className="lc-card overflow-hidden">
        <div className="border-b bg-[var(--lc-surface-soft)] px-4">
          <div className="flex items-center gap-1">
            <button type="button" className="lc-tab lc-tab-active">
              代码
            </button>
            <button type="button" className="lc-tab" disabled>
              控制台
            </button>
          </div>
        </div>
        <div className="p-4">
          <CodeEditor
            initialCoreCodes={initialCoreCodes}
            initialMode="core"
            modeSupport="BOTH"
            onStateChange={setEditorState}
          />
        </div>
      </div>

      <div className="lc-card p-4">
        <p className="mb-3 text-sm font-semibold text-[var(--lc-text)]">运行与分析</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="lc-btn-primary"
            onClick={() => void handleSubmit()}
            disabled={submitLoading}
          >
            {submitLoading ? "判题中..." : "提交判题"}
          </button>
          <button
            type="button"
            className="lc-btn-secondary"
            onClick={() => void refreshSubmission()}
            disabled={submitLoading || !submission}
          >
            刷新结果
          </button>
          <button
            type="button"
            className="lc-btn-info"
            onClick={() => void handleAiReview()}
            disabled={aiLoading || !canAskAi}
          >
            {aiLoading ? "AI 分析中..." : "求助 AI"}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
          <div className="rounded-lg border bg-[var(--lc-surface-soft)] p-3 text-sm text-[var(--lc-text)]">
            <p className="mb-3 text-sm font-semibold text-[var(--lc-text)]">判题结果</p>
            {submission ? (
              <div className="space-y-2 leading-6">
                <p>
                  Submission ID：<span className="font-mono text-xs text-[var(--lc-text-muted)]">{submission.id}</span>
                </p>
                <p>
                  状态：
                  <span className={`ml-2 rounded border px-2 py-0.5 text-xs font-semibold ${statusClass(submission.status)}`}>
                    {submission.status}
                  </span>
                </p>
                <p>运行时间：{submission.runtimeMs ?? "-"} ms</p>
                <p>内存：{submission.memoryKb ?? "-"} KB</p>
                {submission.errorMessage ? (
                  <div className="space-y-1">
                    <p className="text-[var(--lc-danger)]">错误信息：</p>
                    <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap break-all rounded border border-[var(--lc-border)] bg-[var(--lc-surface)] p-2 text-xs text-[var(--lc-danger)]">
                      {submission.errorMessage}
                    </pre>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-[var(--lc-text-muted)]">尚未提交。</p>
            )}
            {submitError ? <p className="mt-2 text-[var(--lc-danger)]">{submitError}</p> : null}
          </div>

          <div className="rounded-lg border bg-[var(--lc-surface-soft)] p-3 text-sm text-[var(--lc-text)]">
            <p className="mb-3 text-sm font-semibold text-[var(--lc-text)]">AI 点评</p>
            {aiGuidance ? (
              <p className="max-h-[220px] overflow-y-auto whitespace-pre-wrap leading-6">{aiGuidance}</p>
            ) : (
              <p className="text-[var(--lc-text-muted)]">暂无点评。</p>
            )}
            {aiSource ? <p className="mt-2 text-xs text-[var(--lc-text-muted)]">来源：{aiSource}</p> : null}
            {aiSessionId ? <p className="mt-1 font-mono text-xs text-[var(--lc-text-muted)]">会话：{aiSessionId}</p> : null}
            {aiError ? <p className="mt-2 text-[var(--lc-danger)]">{aiError}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
