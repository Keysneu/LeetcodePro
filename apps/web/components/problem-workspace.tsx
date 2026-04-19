"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CodeEditor, { EditorState } from "@/components/code-editor";
import ProblemResizableLayout from "@/components/problem-resizable-layout";
import SubmissionFailureCasePanel, { SubmissionFailureCase } from "@/components/submission-failure-case";
import {
  emitEditorSync,
  emitSubmissionSync,
  SUBMISSION_REPLAY_EVENT,
  type SubmissionReplayEventDetail,
  type SubmissionSyncSnapshot
} from "@/lib/submission-replay";

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
  passedCount: number;
  totalCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  failureCase?: SubmissionFailureCase | null;
};

type Props = {
  apiBaseUrl: string;
  problemSlug: string;
  modeSupport: "CORE" | "ACM" | "BOTH";
  initialCoreCodes: Record<"cpp" | "python", string>;
};

const TERMINAL_STATUSES = new Set<SubmissionStatus>(["AC", "WA", "TLE", "RE", "CE"]);
const WORKSPACE_VERTICAL_STORAGE_KEY = "leetcodepro-workspace-vertical-ratio-v5";
const RESULT_PANEL_COLLAPSED_STORAGE_KEY = "leetcodepro-workspace-result-collapsed";

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
    return "lc-status-ac";
  }
  if (status === "QUEUED" || status === "RUNNING") {
    return "lc-status-pending";
  }
  return "lc-status-fail";
}

function toSubmissionSyncSnapshot(item: SubmissionItem): SubmissionSyncSnapshot {
  return {
    id: item.id,
    problemSlug: item.problemSlug,
    language: item.language,
    mode: item.mode,
    code: item.code,
    status: item.status,
    runtimeMs: item.runtimeMs,
    memoryKb: item.memoryKb,
    passedCount: item.passedCount,
    totalCount: item.totalCount,
    errorMessage: item.errorMessage,
    failureCase: item.failureCase ?? null
  };
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
  const [editorOverrideState, setEditorOverrideState] = useState<EditorState | null>(null);
  const [editorOverrideVersion, setEditorOverrideVersion] = useState(0);
  const [isResultPanelCollapsed, setIsResultPanelCollapsed] = useState(false);
  const latestSubmissionIdRef = useRef<string | null>(null);

  useEffect(() => {
    emitEditorSync({
      problemSlug,
      editor: {
        mode: editorState.mode,
        language: editorState.language
      }
    });
  }, [editorState.language, editorState.mode, problemSlug]);

  const syncSubmission = useCallback(
    (item: SubmissionItem) => {
      emitSubmissionSync({
        problemSlug,
        submission: toSubmissionSyncSnapshot(item)
      });
    },
    [problemSlug]
  );

  useEffect(() => {
    try {
      const resultCollapsedRaw = window.localStorage.getItem(RESULT_PANEL_COLLAPSED_STORAGE_KEY);
      if (resultCollapsedRaw === "1" || resultCollapsedRaw === "0") {
        setIsResultPanelCollapsed(resultCollapsedRaw === "1");
      }
    } catch {
      // Ignore storage failures.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(RESULT_PANEL_COLLAPSED_STORAGE_KEY, isResultPanelCollapsed ? "1" : "0");
    } catch {
      // Ignore storage failures.
    }
  }, [isResultPanelCollapsed]);

  useEffect(() => {
    const handleReplay = (event: Event) => {
      const { detail } = event as CustomEvent<SubmissionReplayEventDetail>;
      if (!detail || detail.problemSlug !== problemSlug) {
        return;
      }

      const replaySubmission = detail.replay.submission;
      latestSubmissionIdRef.current = replaySubmission.id;
      setSubmitLoading(false);
      setSubmitError(null);
      const normalizedSubmission: SubmissionItem = {
        ...replaySubmission,
        failureCase: replaySubmission.failureCase ?? null,
        createdAt: replaySubmission.createdAt,
        updatedAt: replaySubmission.updatedAt
      };
      setSubmission(normalizedSubmission);
      syncSubmission(normalizedSubmission);
      setEditorOverrideState({
        mode: replaySubmission.mode,
        language: replaySubmission.language,
        code: replaySubmission.code
      });
      setEditorOverrideVersion((previous) => previous + 1);
    };

    window.addEventListener(SUBMISSION_REPLAY_EVENT, handleReplay as EventListener);
    return () => {
      window.removeEventListener(SUBMISSION_REPLAY_EVENT, handleReplay as EventListener);
    };
  }, [problemSlug, syncSubmission]);

  const pollSubmissionUntilTerminal = useCallback(
    async (submissionId: string) => {
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const result = await fetchJson<{ item: SubmissionItem }>(`${apiBaseUrl}/api/submissions/${submissionId}`);
        const item = result.item;

        if (latestSubmissionIdRef.current !== submissionId) {
          return;
        }

        setSubmission(item);
        syncSubmission(item);

        if (TERMINAL_STATUSES.has(item.status)) {
          return;
        }

        await sleep(700);
      }

      setSubmitError("判题轮询超时，请稍后点击“刷新结果”继续查询。");
    },
    [apiBaseUrl, syncSubmission]
  );

  const handleSubmit = useCallback(async () => {
    setSubmitError(null);
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
      syncSubmission(result.item);
      await pollSubmissionUntilTerminal(result.item.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "提交失败，请稍后重试。";
      setSubmitError(message);
    } finally {
      setSubmitLoading(false);
    }
  }, [apiBaseUrl, editorState.code, editorState.language, editorState.mode, pollSubmissionUntilTerminal, problemSlug, syncSubmission]);

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

  return (
    <section className="flex min-h-0 flex-col lg:h-full">
      <ProblemResizableLayout
        direction="vertical"
        storageKey={WORKSPACE_VERTICAL_STORAGE_KEY}
        defaultRatio={0.72}
        minPrimaryPx={320}
        minSecondaryPx={200}
        minRatio={0.45}
        maxRatio={0.84}
        dividerAriaLabel="拖拽调整代码区与运行分析区域高度"
        className="min-h-0 flex-1"
      >
        <div className="lc-card flex h-full min-h-[430px] flex-col overflow-hidden lg:min-h-0">
          <div className="flex items-center justify-between gap-3 border-b bg-[var(--lc-surface-soft)] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[var(--lc-text)]">代码工作区</p>
              <p className="mt-1 text-xs text-[var(--lc-text-muted)]">桌面端固定工作台，平板和手机端自动切换为顺序布局。</p>
            </div>
          </div>
          <div className="min-h-0 flex-1 p-3 lg:p-4">
            <CodeEditor
              initialCoreCodes={initialCoreCodes}
              initialMode="core"
              modeSupport={modeSupport}
              overrideState={editorOverrideState}
              overrideVersion={editorOverrideVersion}
              onStateChange={setEditorState}
            />
          </div>
        </div>

        <div
          data-testid="workspace-analysis-card"
          className="lc-card flex h-full min-h-[260px] flex-col overflow-hidden p-3 lg:min-h-0 lg:p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--lc-text)]">运行与分析</p>
              <p className="mt-1 text-xs text-[var(--lc-text-muted)]">提交判题、刷新状态，并在失败时查看关键用例与错误输出。</p>
            </div>
          </div>
          <div className="mt-3 flex shrink-0 flex-wrap gap-2">
            <button type="button" className="lc-btn-primary" onClick={() => void handleSubmit()} disabled={submitLoading}>
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
          </div>

          <div
            data-testid="workspace-result-panel"
            className="mt-3 flex min-h-0 flex-1 flex-col rounded-lg border bg-[var(--lc-surface-soft)] p-3 text-sm text-[var(--lc-text)]"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--lc-text)]">判题结果</p>
              <button
                type="button"
                className="lc-btn-secondary h-7 px-2.5 text-xs"
                onClick={() => setIsResultPanelCollapsed((previous) => !previous)}
              >
                {isResultPanelCollapsed ? "展开" : "收起"}
              </button>
            </div>
            {!isResultPanelCollapsed ? (
              <div className="lc-scrollbar-hidden mt-3 min-h-0 flex-1 overflow-y-auto pr-1 lg:max-h-none">
                {submission ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={`rounded border px-2 py-0.5 font-semibold ${statusClass(submission.status)}`}>{submission.status}</span>
                      <span className="rounded border bg-[var(--lc-surface)] px-2 py-0.5 text-[var(--lc-text-muted)]">
                        运行时间 {submission.runtimeMs ?? "-"} ms
                      </span>
                      <span className="rounded border bg-[var(--lc-surface)] px-2 py-0.5 text-[var(--lc-text-muted)]">
                        内存 {submission.memoryKb ?? "-"} KB
                      </span>
                      <span className="rounded border bg-[var(--lc-surface)] px-2 py-0.5 text-[var(--lc-text-muted)]">
                        通过 {submission.passedCount ?? "-"} / {submission.totalCount ?? "-"}
                      </span>
                    </div>
                    {submission.errorMessage ? (
                      <div className="space-y-1">
                        <p className="text-[var(--lc-danger)]">错误信息：</p>
                        <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap break-all rounded border border-[var(--lc-border)] bg-[var(--lc-surface)] p-2 text-xs text-[var(--lc-danger)]">
                          {submission.errorMessage}
                        </pre>
                      </div>
                    ) : null}
                    {submission.failureCase ? <SubmissionFailureCasePanel failureCase={submission.failureCase} /> : null}
                  </div>
                ) : (
                  <p className="text-[var(--lc-text-muted)]">尚未提交。</p>
                )}
                {submitError ? <p className="mt-2 text-[var(--lc-danger)]">{submitError}</p> : null}
              </div>
            ) : (
              <p className="mt-2 text-xs text-[var(--lc-text-muted)]">已折叠判题结果区域</p>
            )}
          </div>
        </div>
      </ProblemResizableLayout>
    </section>
  );
}
