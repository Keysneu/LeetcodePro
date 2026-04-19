"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CodeEditor, { EditorState } from "@/components/code-editor";
import ProblemResizableLayout from "@/components/problem-resizable-layout";
import SubmissionFailureCasePanel, { SubmissionFailureCase } from "@/components/submission-failure-case";
import WorkspaceAnalysisTabs from "@/components/workspace-analysis-tabs";
import WorkspaceTestCasePanel, { type WorkspaceTestCase } from "@/components/workspace-test-case-panel";
import WorkspaceTestRunResultPanel, { type WorkspaceTestRunResult } from "@/components/workspace-test-run-result-panel";
import {
  emitEditorSync,
  emitSubmissionSync,
  SUBMISSION_REPLAY_EVENT,
  type SubmissionReplayEventDetail,
  type SubmissionFailureCase as SubmissionSyncFailureCase,
  type SubmissionFailureSignal,
  type SubmissionSyncSnapshot
} from "@/lib/submission-replay";
import {
  emitWorkspaceToolbarState,
  WORKSPACE_REFRESH_REQUEST_EVENT,
  WORKSPACE_RUN_TESTS_REQUEST_EVENT,
  WORKSPACE_SUBMIT_REQUEST_EVENT,
  type WorkspaceToolbarRequestDetail
} from "@/lib/workspace-toolbar";

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

type ResultSource = "submission" | "run-tests" | null;

type TestRunCaseResult = WorkspaceTestRunResult["caseResults"][number];

type Props = {
  apiBaseUrl: string;
  problemSlug: string;
  modeSupport: "CORE" | "ACM" | "BOTH";
  initialCoreCodes: Record<"cpp" | "python", string>;
  sampleInput: string;
  sampleOutput: string;
  acmSampleInput: string;
  acmSampleOutput: string;
};

const TERMINAL_STATUSES = new Set<SubmissionStatus>(["AC", "WA", "TLE", "RE", "CE"]);
const WORKSPACE_VERTICAL_STORAGE_KEY = "leetcodepro-workspace-vertical-ratio-v5";
const RESULT_PANEL_COLLAPSED_STORAGE_KEY = "leetcodepro-workspace-result-collapsed";
type AnalysisTab = "cases" | "results";

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
    source: "submission",
    id: item.id,
    submissionId: item.id,
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
    failureCase: item.failureCase ?? null,
    failureSignals: item.failureCase?.stderr
      ? [
          {
            status: item.failureCase.status,
            runtimeMs: null,
            memoryKb: null,
            signal: item.failureCase.stderr
          }
        ]
      : []
  };
}

function summarizeRunTestSignal(item: TestRunCaseResult): string {
  if (item.stderr && item.stderr.trim().length > 0) {
    return item.stderr.trim().replace(/\s+/g, " ").slice(0, 220);
  }

  if (item.status === "WA") {
    return "自定义测试用例未通过，输出与期望不一致。";
  }
  if (item.status === "TLE") {
    return "自定义测试用例触发超时，请检查复杂度或死循环。";
  }
  if (item.status === "RE") {
    return "自定义测试用例运行异常，请检查边界条件和运行时错误。";
  }
  if (item.status === "CE") {
    return "代码编译失败，请先修复编译错误。";
  }

  return "自定义测试用例未通过。";
}

function findRunTestFailureCase(result: WorkspaceTestRunResult): SubmissionSyncFailureCase | null {
  const firstFailure = result.caseResults.find((item) => item.status !== "AC");
  if (!firstFailure) {
    return null;
  }

  return {
    status: firstFailure.status,
    isHidden: false,
    inputData: firstFailure.inputData,
    actualOutput: firstFailure.actualOutput,
    expectedOutput: firstFailure.expectedOutput,
    stderr: firstFailure.stderr
  };
}

function buildRunTestFailureSignals(result: WorkspaceTestRunResult): SubmissionFailureSignal[] {
  return result.caseResults
    .filter((item) => item.status !== "AC")
    .slice(0, 5)
    .map((item) => ({
      status: item.status,
      runtimeMs: item.runtimeMs,
      memoryKb: item.memoryKb,
      signal: summarizeRunTestSignal(item)
    }));
}

function toRunTestSyncSnapshot(
  problemSlug: string,
  code: string,
  result: WorkspaceTestRunResult
): SubmissionSyncSnapshot {
  return {
    source: "run-tests",
    id: `run-tests:${result.executedAt}`,
    submissionId: null,
    problemSlug,
    language: result.language,
    mode: result.mode,
    code,
    status: result.status,
    runtimeMs: result.runtimeMs,
    memoryKb: result.memoryKb,
    passedCount: result.passedCount,
    totalCount: result.totalCount,
    errorMessage: result.errorMessage,
    failureCase: findRunTestFailureCase(result),
    failureSignals: buildRunTestFailureSignals(result)
  };
}

export default function ProblemWorkspace({
  apiBaseUrl,
  problemSlug,
  modeSupport,
  initialCoreCodes,
  sampleInput,
  sampleOutput,
  acmSampleInput,
  acmSampleOutput
}: Props) {
  const [editorState, setEditorState] = useState<EditorState>({
    mode: "core",
    language: "cpp",
    code: initialCoreCodes.cpp
  });
  const [submission, setSubmission] = useState<SubmissionItem | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [runTestResult, setRunTestResult] = useState<WorkspaceTestRunResult | null>(null);
  const [runTestLoading, setRunTestLoading] = useState(false);
  const [runTestError, setRunTestError] = useState<string | null>(null);
  const [workspaceCases, setWorkspaceCases] = useState<WorkspaceTestCase[]>([]);
  const [editorOverrideState, setEditorOverrideState] = useState<EditorState | null>(null);
  const [editorOverrideVersion, setEditorOverrideVersion] = useState(0);
  const [isResultPanelCollapsed, setIsResultPanelCollapsed] = useState(false);
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<AnalysisTab>("cases");
  const [latestResultSource, setLatestResultSource] = useState<ResultSource>(null);
  const latestSubmissionIdRef = useRef<string | null>(null);
  const isBusy = submitLoading || runTestLoading;

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
    emitWorkspaceToolbarState({
      problemSlug,
      submitLoading,
      runLoading: runTestLoading,
      canRefresh: Boolean(submission)
    });
  }, [problemSlug, runTestLoading, submitLoading, submission]);

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
      setActiveAnalysisTab("results");
      setLatestResultSource("submission");
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

        setActiveAnalysisTab("results");
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
    setLatestResultSource("submission");
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
      setActiveAnalysisTab("results");
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
    setLatestResultSource("submission");
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

  const handleRunTests = useCallback(async () => {
    if (workspaceCases.length === 0) {
      setLatestResultSource("run-tests");
      setRunTestResult(null);
      setRunTestError("请先至少配置 1 条测试用例。");
      setActiveAnalysisTab("results");
      return;
    }

    setRunTestError(null);
    setRunTestLoading(true);
    setLatestResultSource("run-tests");
    setActiveAnalysisTab("results");

    try {
      const result = await fetchJson<{ item: WorkspaceTestRunResult }>(`${apiBaseUrl}/api/submissions/run-tests`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          problemSlug,
          language: editorState.language,
          mode: editorState.mode,
          code: editorState.code,
          testCases: workspaceCases.map((item) => ({
            id: item.id,
            title: item.title,
            input: item.input,
            output: item.output
          }))
        })
      });

      setRunTestResult(result.item);
      emitSubmissionSync({
        problemSlug,
        submission: toRunTestSyncSnapshot(problemSlug, editorState.code, result.item)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "运行测试失败，请稍后重试。";
      setRunTestResult(null);
      setRunTestError(message);
    } finally {
      setRunTestLoading(false);
    }
  }, [apiBaseUrl, editorState.code, editorState.language, editorState.mode, problemSlug, workspaceCases]);

  useEffect(() => {
    const onSubmitRequest = (event: Event) => {
      const { detail } = event as CustomEvent<WorkspaceToolbarRequestDetail>;
      if (!detail || detail.problemSlug !== problemSlug || isBusy) {
        return;
      }
      void handleSubmit();
    };

    const onRunTestsRequest = (event: Event) => {
      const { detail } = event as CustomEvent<WorkspaceToolbarRequestDetail>;
      if (!detail || detail.problemSlug !== problemSlug || isBusy) {
        return;
      }
      void handleRunTests();
    };

    const onRefreshRequest = (event: Event) => {
      const { detail } = event as CustomEvent<WorkspaceToolbarRequestDetail>;
      if (!detail || detail.problemSlug !== problemSlug || isBusy || !submission) {
        return;
      }
      void refreshSubmission();
    };

    window.addEventListener(WORKSPACE_SUBMIT_REQUEST_EVENT, onSubmitRequest as EventListener);
    window.addEventListener(WORKSPACE_RUN_TESTS_REQUEST_EVENT, onRunTestsRequest as EventListener);
    window.addEventListener(WORKSPACE_REFRESH_REQUEST_EVENT, onRefreshRequest as EventListener);
    return () => {
      window.removeEventListener(WORKSPACE_SUBMIT_REQUEST_EVENT, onSubmitRequest as EventListener);
      window.removeEventListener(WORKSPACE_RUN_TESTS_REQUEST_EVENT, onRunTestsRequest as EventListener);
      window.removeEventListener(WORKSPACE_REFRESH_REQUEST_EVENT, onRefreshRequest as EventListener);
    };
  }, [handleRunTests, handleSubmit, isBusy, problemSlug, refreshSubmission, submission]);

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
            <p className="text-sm font-semibold text-[var(--lc-text)]">代码工作区</p>
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
          <div className="flex items-center justify-between gap-3 rounded-xl border bg-[var(--lc-surface-soft)]/72 px-3 py-2">
            <WorkspaceAnalysisTabs activeTab={activeAnalysisTab} onChange={setActiveAnalysisTab} />
            <button
              type="button"
              className="lc-btn-secondary h-7 shrink-0 px-2.5 text-xs"
              onClick={() => setIsResultPanelCollapsed((previous) => !previous)}
            >
              {isResultPanelCollapsed ? "展开" : "收起"}
            </button>
          </div>
          <div
            data-testid="workspace-result-panel"
            className="mt-3 flex min-h-0 flex-1 flex-col rounded-xl border bg-[var(--lc-surface)] p-3 text-sm text-[var(--lc-text)]"
          >
            {!isResultPanelCollapsed ? (
              <div className="lc-scrollbar-hidden min-h-0 flex-1 overflow-y-auto pr-1 lg:max-h-none">
                {activeAnalysisTab === "cases" ? (
                  <WorkspaceTestCasePanel
                    problemSlug={problemSlug}
                    mode={editorState.mode}
                    sampleInput={editorState.mode === "acm" ? acmSampleInput : sampleInput}
                    sampleOutput={editorState.mode === "acm" ? acmSampleOutput : sampleOutput}
                    onCasesChange={setWorkspaceCases}
                  />
                ) : latestResultSource === "run-tests" && runTestResult ? (
                  <WorkspaceTestRunResultPanel result={runTestResult} errorMessage={runTestError} />
                ) : submission ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded border border-[var(--lc-border)] bg-[var(--lc-surface-soft)] px-2 py-0.5 font-semibold text-[var(--lc-text)]">
                        提交结果
                      </span>
                      <span className={`rounded border px-2 py-0.5 font-semibold ${statusClass(submission.status)}`}>{submission.status}</span>
                      <span className="rounded border bg-[var(--lc-surface-soft)] px-2 py-0.5 text-[var(--lc-text-muted)]">
                        运行时间 {submission.runtimeMs ?? "-"} ms
                      </span>
                      <span className="rounded border bg-[var(--lc-surface-soft)] px-2 py-0.5 text-[var(--lc-text-muted)]">
                        内存 {submission.memoryKb ?? "-"} KB
                      </span>
                      <span className="rounded border bg-[var(--lc-surface-soft)] px-2 py-0.5 text-[var(--lc-text-muted)]">
                        通过 {submission.passedCount ?? "-"} / {submission.totalCount ?? "-"}
                      </span>
                    </div>
                    {submission.errorMessage ? (
                      <div className="space-y-1">
                        <p className="text-[var(--lc-danger)]">错误信息：</p>
                        <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap break-all rounded border border-[var(--lc-border)] bg-[var(--lc-surface-soft)] p-2 text-xs text-[var(--lc-danger)]">
                          {submission.errorMessage}
                        </pre>
                      </div>
                    ) : null}
                    {submission.failureCase ? <SubmissionFailureCasePanel failureCase={submission.failureCase} /> : null}
                    {submitError ? <p className="mt-2 text-[var(--lc-danger)]">{submitError}</p> : null}
                  </div>
                ) : latestResultSource === "run-tests" && runTestError ? (
                  <div className="flex h-full min-h-[180px] items-center justify-center rounded-xl border border-dashed border-[var(--lc-border)] px-4 text-center text-sm font-medium text-[var(--lc-danger)]">
                    {runTestError}
                  </div>
                ) : (
                  <div className="flex h-full min-h-[180px] items-center justify-center rounded-xl border border-dashed border-[var(--lc-border)] text-base font-medium text-[var(--lc-text-muted)]">
                    请先运行测试或提交代码
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-[var(--lc-text-muted)]">已折叠运行与分析区域</p>
            )}
          </div>
        </div>
      </ProblemResizableLayout>
    </section>
  );
}
