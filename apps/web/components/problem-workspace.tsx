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
};

type Props = {
  apiBaseUrl: string;
  problemSlug: string;
  initialCode: string;
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
    return "border-emerald-600/50 bg-emerald-500/15 text-emerald-300";
  }
  if (status === "QUEUED" || status === "RUNNING") {
    return "border-sky-600/40 bg-sky-500/15 text-sky-300";
  }
  return "border-rose-600/40 bg-rose-500/15 text-rose-300";
}

export default function ProblemWorkspace({ apiBaseUrl, problemSlug, initialCode }: Props) {
  const [editorState, setEditorState] = useState<EditorState>({
    mode: "core",
    language: "cpp",
    code: initialCode
  });
  const [submission, setSubmission] = useState<SubmissionItem | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiGuidance, setAiGuidance] = useState<string>("");
  const [aiSource, setAiSource] = useState<string>("");
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

    try {
      const result = await fetchJson<AiReviewResponse>(`${apiBaseUrl}/api/ai/review`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          problemSlug,
          code: submission.code,
          status: submission.status,
          errorMessage: submission.errorMessage
        })
      });

      setAiGuidance(result.guidance ?? "AI 暂未返回建议，请稍后重试。");
      setAiSource(result.source ?? "");
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 点评失败，请稍后重试。";
      setAiError(message);
    } finally {
      setAiLoading(false);
    }
  }, [apiBaseUrl, problemSlug, submission]);

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950 p-4 lg:col-span-2">
      <CodeEditor initialCode={initialCode} onStateChange={setEditorState} />
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void handleSubmit()}
          disabled={submitLoading}
        >
          {submitLoading ? "判题中..." : "提交判题"}
        </button>
        <button
          type="button"
          className="rounded border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void refreshSubmission()}
          disabled={submitLoading || !submission}
        >
          刷新结果
        </button>
        <button
          type="button"
          className="rounded border border-sky-700 px-4 py-2 text-sm text-sky-200 hover:bg-sky-900/30 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void handleAiReview()}
          disabled={aiLoading || !canAskAi}
        >
          {aiLoading ? "AI 分析中..." : "求助 AI"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded border border-slate-800 bg-slate-900 p-3 text-sm text-slate-300">
          <p className="mb-2 text-slate-100">判题结果</p>
          {submission ? (
            <div className="space-y-2">
              <p>
                Submission ID：<span className="font-mono text-xs">{submission.id}</span>
              </p>
              <p>
                状态：
                <span className={`ml-2 rounded border px-2 py-0.5 text-xs ${statusClass(submission.status)}`}>
                  {submission.status}
                </span>
              </p>
              <p>运行时间：{submission.runtimeMs ?? "-"} ms</p>
              <p>内存：{submission.memoryKb ?? "-"} KB</p>
              {submission.errorMessage ? <p className="text-rose-300">错误信息：{submission.errorMessage}</p> : null}
            </div>
          ) : (
            <p className="text-slate-400">尚未提交。</p>
          )}
          {submitError ? <p className="mt-2 text-rose-300">{submitError}</p> : null}
        </div>

        <div className="rounded border border-slate-800 bg-slate-900 p-3 text-sm text-slate-300">
          <p className="mb-2 text-slate-100">AI 点评</p>
          {aiGuidance ? <p className="whitespace-pre-wrap leading-6">{aiGuidance}</p> : <p className="text-slate-400">暂无点评。</p>}
          {aiSource ? <p className="mt-2 text-xs text-slate-500">来源：{aiSource}</p> : null}
          {aiError ? <p className="mt-2 text-rose-300">{aiError}</p> : null}
        </div>
      </div>
    </section>
  );
}
