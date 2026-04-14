"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeEditor, { EditorState } from "@/components/code-editor";
import ProblemResizableLayout from "@/components/problem-resizable-layout";
import SubmissionFailureCasePanel, { SubmissionFailureCase } from "@/components/submission-failure-case";
import {
  AI_PROVIDER_SYNC_EVENT,
  AiProvider,
  getDefaultAiProvider,
  readPreferredAiProvider,
  savePreferredAiProvider
} from "@/lib/ai-provider";
import { SUBMISSION_REPLAY_EVENT, type SubmissionReplayEventDetail } from "@/lib/submission-replay";

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

type AiReviewResponse = {
  guidance?: string;
};

type AiStreamPayload = {
  delta?: string;
  guidance?: string;
};

type MasteryStatus = "UNTOUCHED" | "ATTEMPTING" | "SOLVED_ONCE" | "SOLVED_TWICE" | "SOLVED_MANY" | "UNSUPPORTED";

type ProblemMasteryResponse = {
  summary: {
    overallStatus: Exclude<MasteryStatus, "UNSUPPORTED">;
    isSolved: boolean;
    totalAttempts: number;
    attemptsToFirstAc: number | null;
    latestStatus: SubmissionStatus | null;
  };
  tracks: Array<{
    mode: "core" | "acm";
    language: "cpp" | "python";
    supported: boolean;
    status: MasteryStatus;
    totalAttempts: number;
    attemptsToFirstAc: number | null;
    latestStatus: SubmissionStatus | null;
    isSolved: boolean;
  }>;
};

type Props = {
  apiBaseUrl: string;
  problemSlug: string;
  modeSupport: "CORE" | "ACM" | "BOTH";
  initialCoreCodes: Record<"cpp" | "python", string>;
};

const TERMINAL_STATUSES = new Set<SubmissionStatus>(["AC", "WA", "TLE", "RE", "CE"]);
const WORKSPACE_VERTICAL_STORAGE_KEY = "leetcodepro-workspace-vertical-ratio";

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

function looksIncompleteAiText(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return true;
  }

  if (trimmed.endsWith("```")) {
    return false;
  }

  if (trimmed.split("```").length % 2 === 0) {
    return true;
  }

  return !/[。！？.!?)）\]】`]\s*$/u.test(trimmed);
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

function masteryStatusLabel(status: MasteryStatus): string {
  if (status === "UNTOUCHED") {
    return "未做题";
  }
  if (status === "ATTEMPTING") {
    return "尝试中";
  }
  if (status === "SOLVED_ONCE") {
    return "一遍过";
  }
  if (status === "SOLVED_TWICE") {
    return "两次过";
  }
  if (status === "SOLVED_MANY") {
    return "多次过";
  }
  return "不支持";
}

function masteryStatusClass(status: MasteryStatus): string {
  if (status === "UNSUPPORTED" || status === "UNTOUCHED") {
    return "border-[var(--lc-border-soft)] bg-transparent text-[var(--lc-text-muted)]";
  }

  if (status === "ATTEMPTING") {
    return "lc-status-pending";
  }

  return "lc-status-ac";
}

function trackLabel(mode: "core" | "acm", language: "cpp" | "python"): string {
  const modeLabel = mode === "core" ? "核心" : "ACM";
  const languageLabel = language === "cpp" ? "C++" : "Python";
  return `${modeLabel} · ${languageLabel}`;
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
  const [editorOverrideState, setEditorOverrideState] = useState<EditorState | null>(null);
  const [editorOverrideVersion, setEditorOverrideVersion] = useState(0);
  const [aiProvider, setAiProvider] = useState<AiProvider>(() => getDefaultAiProvider());
  const [mastery, setMastery] = useState<ProblemMasteryResponse | null>(null);
  const [masteryLoading, setMasteryLoading] = useState(false);
  const [masteryError, setMasteryError] = useState<string | null>(null);
  const latestSubmissionIdRef = useRef<string | null>(null);

  const canAskAi = useMemo(() => submission !== null && TERMINAL_STATUSES.has(submission.status), [submission]);

  useEffect(() => {
    const syncProvider = () => {
      setAiProvider(readPreferredAiProvider());
    };

    syncProvider();
    window.addEventListener(AI_PROVIDER_SYNC_EVENT, syncProvider);
    return () => {
      window.removeEventListener(AI_PROVIDER_SYNC_EVENT, syncProvider);
    };
  }, []);

  const loadMastery = useCallback(
    async (silent = false) => {
      if (!silent) {
        setMasteryLoading(true);
      }
      setMasteryError(null);

      try {
        const result = await fetchJson<ProblemMasteryResponse>(`${apiBaseUrl}/api/problems/${problemSlug}/mastery`);
        setMastery(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "掌握度加载失败，请稍后重试。";
        setMasteryError(message);
      } finally {
        if (!silent) {
          setMasteryLoading(false);
        }
      }
    },
    [apiBaseUrl, problemSlug]
  );

  useEffect(() => {
    void loadMastery();
  }, [loadMastery]);

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
      setAiLoading(false);
      setAiError(null);
      setAiGuidance(detail.replay.ai.review?.content ?? "");
      setSubmission({
        ...replaySubmission,
        failureCase: replaySubmission.failureCase ?? null
      });
      setEditorOverrideState({
        mode: replaySubmission.mode,
        language: replaySubmission.language,
        code: replaySubmission.code
      });
      setEditorOverrideVersion((previous) => previous + 1);
      void loadMastery(true);
    };

    window.addEventListener(SUBMISSION_REPLAY_EVENT, handleReplay as EventListener);
    return () => {
      window.removeEventListener(SUBMISSION_REPLAY_EVENT, handleReplay as EventListener);
    };
  }, [loadMastery, problemSlug]);

  const handleProviderChange = useCallback((nextProvider: AiProvider) => {
    setAiProvider(nextProvider);
    savePreferredAiProvider(nextProvider);
  }, []);

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
          await loadMastery(true);
          return;
        }

        await sleep(700);
      }

      setSubmitError("判题轮询超时，请稍后点击“刷新结果”继续查询。");
    },
    [apiBaseUrl, loadMastery]
  );

  const handleSubmit = useCallback(async () => {
    setSubmitError(null);
    setAiError(null);
    setAiGuidance("");
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
      void loadMastery(true);
      await pollSubmissionUntilTerminal(result.item.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "提交失败，请稍后重试。";
      setSubmitError(message);
    } finally {
      setSubmitLoading(false);
    }
  }, [apiBaseUrl, editorState.code, editorState.language, editorState.mode, loadMastery, pollSubmissionUntilTerminal, problemSlug]);

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

    try {
      const response = await fetch(`${apiBaseUrl}/api/ai/bug-find/stream`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          problemSlug,
          submissionId: submission.id,
          provider: aiProvider,
          language: submission.language,
          mode: submission.mode,
          code: submission.code,
          status: submission.status,
          runtimeMs: submission.runtimeMs,
          memoryKb: submission.memoryKb,
          passedCount: submission.passedCount,
          totalCount: submission.totalCount,
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
      let doneReceived = false;

      const applyFrame = (frameEvent: string, payload: AiStreamPayload) => {
        if (frameEvent === "meta") {
          return;
        }

        if (frameEvent === "delta") {
          const delta = typeof payload.delta === "string" ? payload.delta : "";
          if (delta.length > 0) {
            guidance += delta;
            setAiGuidance(guidance);
          }
          return;
        }

        if (frameEvent === "done") {
          doneReceived = true;
          if (typeof payload.guidance === "string" && payload.guidance.length > 0) {
            guidance = payload.guidance;
            setAiGuidance(guidance);
          }
        }
      };

      const consumeBuffer = () => {
        while (true) {
          const boundary = findSseBoundary(buffer);
          if (!boundary) {
            break;
          }

          const rawBlock = buffer.slice(0, boundary.index);
          buffer = buffer.slice(boundary.index + boundary.separatorLength);

          const frame = parseSseBlock(rawBlock);
          if (!frame) {
            continue;
          }

          applyFrame(frame.event, parseSsePayload(frame.data));
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
        const tailFrame = parseSseBlock(buffer.trim());
        if (tailFrame) {
          applyFrame(tailFrame.event, parseSsePayload(tailFrame.data));
        }
      }

      const shouldFetchSyncFallback =
        aiProvider === "minimax" || guidance.length === 0 || !doneReceived || looksIncompleteAiText(guidance);

      if (shouldFetchSyncFallback) {
        try {
          const fallback = await fetchJson<AiReviewResponse>(`${apiBaseUrl}/api/ai/bug-find`, {
            method: "POST",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify({
              problemSlug,
              submissionId: submission.id,
              provider: aiProvider,
              language: submission.language,
              mode: submission.mode,
              code: submission.code,
              status: submission.status,
              runtimeMs: submission.runtimeMs,
              memoryKb: submission.memoryKb,
              passedCount: submission.passedCount,
              totalCount: submission.totalCount,
              errorMessage: submission.errorMessage
            })
          });

          const fallbackGuidance = fallback.guidance ?? "";
          const shouldReplaceWithFallback =
            fallbackGuidance.length > guidance.length ||
            (looksIncompleteAiText(guidance) && !looksIncompleteAiText(fallbackGuidance));

          if (shouldReplaceWithFallback) {
            guidance = fallbackGuidance;
            setAiGuidance(guidance);
          } else if (guidance.length === 0) {
            setAiGuidance("AI 暂未返回建议，请稍后重试。");
          }

        } catch {
          if (guidance.length === 0) {
            setAiGuidance("AI 暂未返回建议，请稍后重试。");
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 找 Bug 失败，请稍后重试。";
      setAiError(message);
    } finally {
      setAiLoading(false);
    }
  }, [aiProvider, apiBaseUrl, problemSlug, submission]);

  return (
    <section>
      <ProblemResizableLayout
        direction="vertical"
        storageKey={WORKSPACE_VERTICAL_STORAGE_KEY}
        defaultRatio={0.65}
        minPrimaryPx={380}
        minSecondaryPx={240}
        minRatio={0.35}
        maxRatio={0.78}
        dividerAriaLabel="拖拽调整代码区与运行分析区域高度"
        className="h-auto lg:h-[calc(100vh-8.5rem)]"
      >
        <div className="lc-card flex h-full min-h-0 flex-col overflow-hidden">
          <div className="border-b bg-[var(--lc-surface-soft)] px-4 py-2.5">
            <p className="text-sm font-semibold text-[var(--lc-text)]">代码</p>
          </div>
          <div className="min-h-0 flex-1 p-4">
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

        <div className="lc-card flex h-full min-h-0 flex-col p-4">
          <p className="mb-3 text-sm font-semibold text-[var(--lc-text)]">运行与分析</p>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="mb-3 rounded-lg border bg-[var(--lc-surface-soft)] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--lc-text)]">题目掌握度</p>
                <button
                  type="button"
                  className="lc-btn-secondary h-8 px-3 text-xs"
                  onClick={() => void loadMastery()}
                  disabled={masteryLoading}
                >
                  {masteryLoading ? "刷新中..." : "刷新掌握度"}
                </button>
              </div>

              {mastery ? (
                <div className="mt-3 space-y-3">
                  <div className="rounded border bg-[var(--lc-surface)] p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`lc-badge border ${masteryStatusClass(mastery.summary.overallStatus)}`}>
                        {masteryStatusLabel(mastery.summary.overallStatus)}
                      </span>
                      <span className="text-xs text-[var(--lc-text-muted)]">
                        总尝试：{mastery.summary.totalAttempts} · 首 AC：{mastery.summary.attemptsToFirstAc ?? "-"} · 最近：{mastery.summary.latestStatus ?? "-"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {mastery.tracks.map((track) => (
                      <div key={`${track.mode}-${track.language}`} className="rounded border bg-[var(--lc-surface)] p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-[var(--lc-text)]">{trackLabel(track.mode, track.language)}</span>
                          <span className={`lc-badge border ${masteryStatusClass(track.status)}`}>{masteryStatusLabel(track.status)}</span>
                        </div>
                        <p className="mt-2 text-xs text-[var(--lc-text-muted)]">
                          尝试：{track.totalAttempts} · 首 AC：{track.attemptsToFirstAc ?? "-"} · 最近：{track.latestStatus ?? "-"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-[var(--lc-text-muted)]">
                  {masteryLoading ? "掌握度加载中..." : "暂无掌握度数据。"}
                </p>
              )}

              {masteryError ? <p className="mt-2 text-sm text-[var(--lc-danger)]">{masteryError}</p> : null}
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-[var(--lc-text-muted)]">AI 模型</span>
              <select className="lc-select h-9 min-w-[150px]" value={aiProvider} onChange={(event) => handleProviderChange(event.target.value as AiProvider)}>
                <option value="vllm">vLLM（远程）</option>
                <option value="minimax">MiniMax（远程）</option>
              </select>
            </div>
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
                {aiLoading ? "AI 找 Bug 中..." : "AI 找 Bug"}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-12">
              <div className="rounded-lg border bg-[var(--lc-surface-soft)] p-3 text-sm text-[var(--lc-text)] xl:col-span-4">
                <p className="mb-3 text-sm font-semibold text-[var(--lc-text)]">判题结果</p>
                {submission ? (
                  <div className="space-y-2 leading-6">
                    <p>
                      状态：
                      <span className={`ml-2 rounded border px-2 py-0.5 text-xs font-semibold ${statusClass(submission.status)}`}>
                        {submission.status}
                      </span>
                    </p>
                    <p>运行时间：{submission.runtimeMs ?? "-"} ms</p>
                    <p>内存：{submission.memoryKb ?? "-"} KB</p>
                    <p>通过数：{submission.passedCount ?? "-"} / {submission.totalCount ?? "-"}</p>
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

              <div className="rounded-lg border bg-[var(--lc-surface-soft)] p-3 text-sm text-[var(--lc-text)] xl:col-span-8">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--lc-text)]">AI 找 Bug</p>
                  <span className="text-xs text-[var(--lc-text-muted)]">模型：{aiProvider === "minimax" ? "MiniMax（远程）" : "vLLM（远程）"}</span>
                </div>
                <div className="max-h-[34vh] overflow-y-auto rounded-lg border bg-[var(--lc-surface-soft)] p-3">
                  {aiGuidance ? (
                    <div className="lc-markdown text-sm text-[var(--lc-text)]">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiGuidance}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--lc-text-muted)]">暂无 Bug 分析。</p>
                  )}
                </div>
                {aiError ? <p className="mt-2 text-[var(--lc-danger)]">{aiError}</p> : null}
              </div>
            </div>
          </div>
        </div>
      </ProblemResizableLayout>
    </section>
  );
}
