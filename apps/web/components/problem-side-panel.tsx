"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AiStreamPanel from "@/components/ai-stream-panel";
import { splitAssistantDisplayContent } from "@/lib/ai-content-split";
import { AI_PROVIDER_SYNC_EVENT, AiProvider, aiProviderLabel, getDefaultAiProvider, readPreferredAiProvider } from "@/lib/ai-provider";
import { AI_CONFIG_SYNC_EVENT, listAiConfigs, type AiConfigDefaults, type AiConfigItem } from "@/lib/ai-config";
import { consumeAiSemanticStream, createStreamTextBatcher } from "@/lib/ai-stream";
import { normalizeDisplayText, normalizeProblemStatementMarkdown } from "@/lib/output-display";
import {
  EDITOR_SYNC_EVENT,
  emitSubmissionReplay,
  type EditorSyncEventDetail,
  SUBMISSION_SYNC_EVENT,
  type SubmissionReplayResponse,
  type SubmissionSyncEventDetail,
  type SubmissionSyncSnapshot
} from "@/lib/submission-replay";

type ProblemDetail = {
  leetcodeId: number | null;
  slug: string;
  title: string;
  titleZh?: string | null;
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string[];
  modeSupport: "CORE" | "ACM" | "BOTH";
  description: string;
  inputSpec: string;
  outputSpec: string;
  sampleInput: string;
  sampleOutput: string;
  acmInputSpec: string;
  acmOutputSpec: string;
  acmSampleInput: string;
  acmSampleOutput: string;
};

type SubmissionStatus = "QUEUED" | "RUNNING" | "AC" | "WA" | "TLE" | "RE" | "CE";

type SubmissionHistoryItem = {
  id: string;
  problemSlug: string;
  language: "cpp" | "python";
  mode: "core" | "acm";
  status: SubmissionStatus;
  runtimeMs: number | null;
  memoryKb: number | null;
  passedCount: number;
  totalCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type SubmissionHistoryResponse = {
  items: SubmissionHistoryItem[];
};

type ProblemNoteItem = {
  problemSlug: string;
  problemTitle: string;
  sourceFilename: string;
  matchedHeading: string;
  contentMd: string;
  updatedAt: string;
};

type ProblemNoteResponse = {
  item: ProblemNoteItem | null;
};

type TabKey = "description" | "submissions" | "note-solution" | "ai-solution" | "ai-review";

type PhaseStatus = {
  stage: string;
  message: string;
  elapsedMs: number;
};

type Props = {
  apiBaseUrl: string;
  problem: ProblemDetail;
};

const TERMINAL_STATUSES = new Set<SubmissionStatus>(["AC", "WA", "TLE", "RE", "CE"]);
const AI_SOLUTION_PROVIDER_STORAGE_KEY = "leetcodepro.ai.solution-provider";
const AI_REVIEW_PROVIDER_STORAGE_KEY = "leetcodepro.ai.review-provider";

type AiSelection = {
  mode: "provider" | "config";
  value: string;
};

type SideTabDefinition = {
  key: TabKey;
  label: string;
  icon: ReactNode;
};

function DescriptionTabIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] fill-none stroke-current stroke-[1.9]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 4.75h7.75L18.5 8.5v10.75a1.5 1.5 0 0 1-1.5 1.5h-10a1.5 1.5 0 0 1-1.5-1.5v-13a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 4.75V8.5H18.5M8.25 12h7.5M8.25 15.75h5.25" />
    </svg>
  );
}

function SubmissionTabIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] fill-none stroke-current stroke-[1.9]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5.25a6.75 6.75 0 1 1-6.75 6.75" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 1.75v3.5M4.25 3.75l2.25 2.25M12 8.25V12l2.75 1.5" />
    </svg>
  );
}

function NoteSolutionTabIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] fill-none stroke-current stroke-[1.9]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 4.75h11a1.75 1.75 0 0 1 1.75 1.75v11a1.75 1.75 0 0 1-1.75 1.75h-11a1.75 1.75 0 0 1-1.75-1.75v-11A1.75 1.75 0 0 1 6.5 4.75Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 9h7M8.5 12h7M8.5 15h4" />
    </svg>
  );
}

function AiSolutionTabIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] fill-none stroke-current stroke-[1.9]">
      <path strokeLinecap="round" strokeLinejoin="round" d="m12 3.5 1.6 3.92 3.9 1.58-3.9 1.58L12 14.5l-1.58-3.92-3.92-1.58 3.92-1.58L12 3.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m17.5 13.5.97 2.28 2.28.97-2.28.97-.97 2.28-.97-2.28-2.28-.97 2.28-.97.97-2.28ZM6 14.25l.65 1.6 1.6.65-1.6.65L6 18.75l-.65-1.6-1.6-.65 1.6-.65.65-1.6Z" />
    </svg>
  );
}

function AiReviewTabIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] fill-none stroke-current stroke-[1.9]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 4.75a5.75 5.75 0 1 1 0 11.5 5.75 5.75 0 0 1 0-11.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m15 14.5 4.25 4.25M8.4 10.5l1.5 1.5 2.7-3.15" />
    </svg>
  );
}

const SIDE_TABS: ReadonlyArray<SideTabDefinition> = [
  { key: "description", label: "描述", icon: <DescriptionTabIcon /> },
  { key: "submissions", label: "提交记录", icon: <SubmissionTabIcon /> },
  { key: "note-solution", label: "笔记题解", icon: <NoteSolutionTabIcon /> },
  { key: "ai-solution", label: "AI题解", icon: <AiSolutionTabIcon /> },
  { key: "ai-review", label: "AI判题", icon: <AiReviewTabIcon /> }
] as const;

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

function normalizeAiProvider(raw: unknown): AiProvider {
  if (typeof raw !== "string") {
    return getDefaultAiProvider();
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "minimax") {
    return "minimax";
  }
  if (normalized === "deepseek") {
    return "deepseek";
  }

  return "vllm";
}

function parseAiSelection(raw: unknown): AiSelection {
  if (typeof raw !== "string") {
    return { mode: "provider", value: readPreferredAiProvider() };
  }

  const normalized = raw.trim();
  if (normalized.startsWith("config:")) {
    const configId = normalized.slice("config:".length).trim();
    if (configId.length > 0) {
      return { mode: "config", value: configId };
    }
  }

  if (normalized.startsWith("provider:")) {
    const provider = normalizeAiProvider(normalized.slice("provider:".length));
    return { mode: "provider", value: provider };
  }

  return { mode: "provider", value: normalizeAiProvider(normalized) };
}

function serializeAiSelection(selection: AiSelection): string {
  if (selection.mode === "config") {
    return `config:${selection.value}`;
  }

  return `provider:${normalizeAiProvider(selection.value)}`;
}

function readScopedAiSelection(storageKey: string): AiSelection {
  if (typeof window === "undefined") {
    return { mode: "provider", value: getDefaultAiProvider() };
  }

  const scoped = window.localStorage.getItem(storageKey);
  if (scoped) {
    return parseAiSelection(scoped);
  }

  return { mode: "provider", value: readPreferredAiProvider() };
}

function saveScopedAiSelection(storageKey: string, selection: AiSelection): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, serializeAiSelection(selection));
  window.dispatchEvent(new Event(AI_PROVIDER_SYNC_EVENT));
}

function normalizeSolutionErrorMessage(message: string, selectionLabel: string): string {
  const fallback = `${selectionLabel} 题解生成失败，请稍后重试。`;
  const timeoutMessage = `${selectionLabel} 题解请求超时，请稍后重试。`;
  const normalized = message.trim().toLowerCase();

  if (normalized.length === 0) {
    return fallback;
  }

  const timeoutSignals = [
    "aborterror",
    "aborted",
    "operation was aborted",
    "timeout",
    "timed out",
    "etimedout",
    "deadline exceeded"
  ];

  if (timeoutSignals.some((item) => normalized.includes(item))) {
    return timeoutMessage;
  }

  if (message.includes("题解") || message.includes("超时") || message.includes("稍后重试")) {
    return message;
  }

  return fallback;
}

function resolveSelectionLabel(selection: AiSelection, configItems: AiConfigItem[]): string {
  if (selection.mode === "provider") {
    return aiProviderLabel(normalizeAiProvider(selection.value));
  }

  const target = configItems.find((item) => item.id === selection.value);
  return target?.name ?? "当前 AI 配置";
}

function buildAiRequestPayload(selection: AiSelection): { aiConfigId?: string; provider?: AiProvider } {
  if (selection.mode === "config") {
    return { aiConfigId: selection.value };
  }

  return { provider: normalizeAiProvider(selection.value) };
}

function normalizeProblemMarkdown(markdown: string): string {
  return normalizeProblemStatementMarkdown(markdown).replace(/^\s*[\t ]+-\s+/gm, "- ");
}

function normalizeStreamingMarkdown(markdown: string): string {
  const normalized = normalizeProblemMarkdown(markdown);
  const fenceCount = (normalized.match(/(^|\n)```/g) ?? []).length;

  if (fenceCount % 2 === 0) {
    return normalized;
  }

  return `${normalized}\n\`\`\``;
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

function formatTime(raw: string): string {
  const time = new Date(raw);
  if (Number.isNaN(time.getTime())) {
    return raw;
  }
  return time.toLocaleString("zh-CN", { hour12: false });
}

function difficultyLabel(difficulty: ProblemDetail["difficulty"]): string {
  if (difficulty === "Easy") {
    return "简单";
  }
  if (difficulty === "Medium") {
    return "中等";
  }
  return "困难";
}

function modeSupportLabel(modeSupport: ProblemDetail["modeSupport"]): string {
  if (modeSupport === "BOTH") {
    return "核心/ACM 判题";
  }
  if (modeSupport === "CORE") {
    return "核心判题";
  }
  return "ACM 判题";
}

function toCurrentSubmissionSnapshot(submission: SubmissionReplayResponse["submission"]): SubmissionSyncSnapshot {
  return {
    source: "submission",
    id: submission.id,
    submissionId: submission.id,
    problemSlug: submission.problemSlug,
    language: submission.language,
    mode: submission.mode,
    code: submission.code,
    status: submission.status,
    runtimeMs: submission.runtimeMs,
    memoryKb: submission.memoryKb,
    passedCount: submission.passedCount,
    totalCount: submission.totalCount,
    errorMessage: submission.errorMessage,
    failureCase: submission.failureCase ?? null,
    failureSignals: submission.failureCase?.stderr
      ? [
          {
            status: submission.failureCase.status,
            runtimeMs: null,
            memoryKb: null,
            signal: submission.failureCase.stderr
          }
        ]
      : []
  };
}

type ConfirmReplayDialogProps = {
  open: boolean;
  item: SubmissionHistoryItem | null;
  isLoading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function ConfirmReplayDialog({ open, item, isLoading, onCancel, onConfirm }: ConfirmReplayDialogProps) {
  if (!open || !item) {
    return null;
  }

  return (
    <div
      className="lc-modal-backdrop"
      onClick={() => {
        if (!isLoading) {
          onCancel();
        }
      }}
      aria-hidden="true"
    >
      <div
        className="lc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="replay-confirm-title"
        aria-describedby="replay-confirm-description"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="replay-confirm-title" className="text-base font-semibold text-[var(--lc-text)]">
          确认回放历史提交
        </h3>
        <p id="replay-confirm-description" className="mt-2 text-sm leading-6 text-[var(--lc-text-muted)]">
          将覆盖当前编辑器代码、判题结果与 AI 分析。是否继续？
        </p>
        <div className="mt-3 rounded-lg border bg-[var(--lc-surface-soft)] px-3 py-2 text-xs text-[var(--lc-text-muted)]">
          <p>
            目标提交：<span className="font-mono">{item.id}</span>
          </p>
          <p className="mt-1">
            状态：{item.status} · 提交时间：{formatTime(item.createdAt)}
          </p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="lc-btn-secondary h-9 px-4" onClick={onCancel} disabled={isLoading} autoFocus>
            取消
          </button>
          <button type="button" className="lc-btn-primary h-9 px-4" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? "回放中..." : "确认覆盖并回放"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProblemSidePanel({ apiBaseUrl, problem }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("description");

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<SubmissionHistoryItem[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [replayLoadingId, setReplayLoadingId] = useState<string | null>(null);
  const [pendingReplayItem, setPendingReplayItem] = useState<SubmissionHistoryItem | null>(null);
  const [isReplayDialogOpen, setIsReplayDialogOpen] = useState(false);
  const [selectedReplaySubmissionId, setSelectedReplaySubmissionId] = useState<string | null>(null);
  const [currentSubmission, setCurrentSubmission] = useState<SubmissionSyncSnapshot | null>(null);
  const [activeEditorMode, setActiveEditorMode] = useState<"core" | "acm">("core");

  const [noteLoading, setNoteLoading] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteLoaded, setNoteLoaded] = useState(false);
  const [problemNote, setProblemNote] = useState<ProblemNoteItem | null>(null);

  const [solutionLoading, setSolutionLoading] = useState(false);
  const [solutionError, setSolutionError] = useState<string | null>(null);
  const [solutionText, setSolutionText] = useState("");
  const [solutionSource, setSolutionSource] = useState("");
  const [solutionResolvedProvider, setSolutionResolvedProvider] = useState("");
  const [solutionSessionId, setSolutionSessionId] = useState("");
  const [solutionLoaded, setSolutionLoaded] = useState(false);
  const [solutionPhaseStatus, setSolutionPhaseStatus] = useState<PhaseStatus | null>(null);
  const [solutionReasoningSummary, setSolutionReasoningSummary] = useState("");
  const [isSolutionThinkingCollapsed, setIsSolutionThinkingCollapsed] = useState(false);
  const [isSolutionThinkingExpanded, setIsSolutionThinkingExpanded] = useState(false);
  const [solutionDisplay, setSolutionDisplay] = useState(() => ({ reasoning: "", answer: "" }));

  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewGuidance, setReviewGuidance] = useState("");
  const [reviewPhaseStatus, setReviewPhaseStatus] = useState<PhaseStatus | null>(null);
  const [reviewReasoningSummary, setReviewReasoningSummary] = useState("");
  const [isReviewThinkingCollapsed, setIsReviewThinkingCollapsed] = useState(false);
  const [isReviewThinkingExpanded, setIsReviewThinkingExpanded] = useState(false);
  const [reviewDisplay, setReviewDisplay] = useState(() => ({ reasoning: "", answer: "" }));

  const [aiConfigItems, setAiConfigItems] = useState<AiConfigItem[]>([]);
  const [aiConfigDefaults, setAiConfigDefaults] = useState<AiConfigDefaults>({
    reviewConfigId: null,
    solutionConfigId: null
  });
  const [aiConfigError, setAiConfigError] = useState<string | null>(null);
  const [solutionSelection, setSolutionSelection] = useState<AiSelection>(() =>
    readScopedAiSelection(AI_SOLUTION_PROVIDER_STORAGE_KEY)
  );
  const [reviewSelection, setReviewSelection] = useState<AiSelection>(() =>
    readScopedAiSelection(AI_REVIEW_PROVIDER_STORAGE_KEY)
  );

  const descriptionMarkdown = useMemo(() => normalizeProblemMarkdown(problem.description), [problem.description]);
  const solutionMarkdown = useMemo(() => normalizeStreamingMarkdown(solutionDisplay.answer), [solutionDisplay.answer]);
  const solutionReasoningMarkdown = useMemo(
    () => normalizeStreamingMarkdown(solutionDisplay.reasoning),
    [solutionDisplay.reasoning]
  );
  const reviewMarkdown = useMemo(() => normalizeStreamingMarkdown(reviewDisplay.answer), [reviewDisplay.answer]);
  const reviewReasoningMarkdown = useMemo(
    () => normalizeStreamingMarkdown(reviewDisplay.reasoning),
    [reviewDisplay.reasoning]
  );
  const canRunAiReview = useMemo(
    () => currentSubmission !== null && TERMINAL_STATUSES.has(currentSubmission.status),
    [currentSubmission]
  );

  useEffect(() => {
    setSolutionDisplay((previous) =>
      splitAssistantDisplayContent(solutionReasoningSummary, solutionText, previous.reasoning)
    );
  }, [solutionReasoningSummary, solutionText]);

  useEffect(() => {
    setReviewDisplay((previous) =>
      splitAssistantDisplayContent(reviewReasoningSummary, reviewGuidance, previous.reasoning)
    );
  }, [reviewGuidance, reviewReasoningSummary]);

  useEffect(() => {
    setActiveTab("description");
    setHistoryLoading(false);
    setHistoryError(null);
    setHistoryItems([]);
    setHistoryLoaded(false);
    setReplayLoadingId(null);
    setPendingReplayItem(null);
    setIsReplayDialogOpen(false);
    setSelectedReplaySubmissionId(null);
    setCurrentSubmission(null);
    setActiveEditorMode("core");

    setNoteLoading(false);
    setNoteError(null);
    setNoteLoaded(false);
    setProblemNote(null);

    setSolutionLoading(false);
    setSolutionError(null);
    setSolutionText("");
    setSolutionSource("");
    setSolutionResolvedProvider("");
    setSolutionSessionId("");
    setSolutionLoaded(false);
    setSolutionPhaseStatus(null);
    setSolutionReasoningSummary("");
    setIsSolutionThinkingCollapsed(false);
    setIsSolutionThinkingExpanded(false);
    setSolutionDisplay({ reasoning: "", answer: "" });

    setReviewLoading(false);
    setReviewError(null);
    setReviewGuidance("");
    setReviewPhaseStatus(null);
    setReviewReasoningSummary("");
    setIsReviewThinkingCollapsed(false);
    setIsReviewThinkingExpanded(false);
    setReviewDisplay({ reasoning: "", answer: "" });

    setSolutionSelection(readScopedAiSelection(AI_SOLUTION_PROVIDER_STORAGE_KEY));
    setReviewSelection(readScopedAiSelection(AI_REVIEW_PROVIDER_STORAGE_KEY));
  }, [problem.slug]);

  useEffect(() => {
    const syncProvider = () => {
      setSolutionSelection(readScopedAiSelection(AI_SOLUTION_PROVIDER_STORAGE_KEY));
      setReviewSelection(readScopedAiSelection(AI_REVIEW_PROVIDER_STORAGE_KEY));
    };

    syncProvider();
    window.addEventListener(AI_PROVIDER_SYNC_EVENT, syncProvider);
    return () => {
      window.removeEventListener(AI_PROVIDER_SYNC_EVENT, syncProvider);
    };
  }, []);

  useEffect(() => {
    const onSubmissionSync = (event: Event) => {
      const { detail } = event as CustomEvent<SubmissionSyncEventDetail>;
      if (!detail || detail.problemSlug !== problem.slug) {
        return;
      }

      setCurrentSubmission(detail.submission);
    };

    window.addEventListener(SUBMISSION_SYNC_EVENT, onSubmissionSync as EventListener);
    return () => {
      window.removeEventListener(SUBMISSION_SYNC_EVENT, onSubmissionSync as EventListener);
    };
  }, [problem.slug]);

  useEffect(() => {
    const onEditorSync = (event: Event) => {
      const { detail } = event as CustomEvent<EditorSyncEventDetail>;
      if (!detail || detail.problemSlug !== problem.slug) {
        return;
      }

      setActiveEditorMode(detail.editor.mode);
    };

    window.addEventListener(EDITOR_SYNC_EVENT, onEditorSync as EventListener);
    return () => {
      window.removeEventListener(EDITOR_SYNC_EVENT, onEditorSync as EventListener);
    };
  }, [problem.slug]);

  const loadAiConfigOptions = useCallback(async () => {
    try {
      const data = await listAiConfigs(apiBaseUrl);
      setAiConfigItems(data.items);
      setAiConfigDefaults(data.defaults);
      setAiConfigError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载 AI 配置失败。";
      setAiConfigError(message);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void loadAiConfigOptions();
  }, [loadAiConfigOptions]);

  useEffect(() => {
    const onConfigSync = () => {
      void loadAiConfigOptions();
    };

    window.addEventListener(AI_CONFIG_SYNC_EVENT, onConfigSync);
    return () => {
      window.removeEventListener(AI_CONFIG_SYNC_EVENT, onConfigSync);
    };
  }, [loadAiConfigOptions]);

  useEffect(() => {
    const availableConfigIds = new Set(aiConfigItems.map((item) => item.id));

    const normalizeSelection = (
      storageKey: string,
      currentSelection: AiSelection,
      fallbackConfigId: string | null
    ): AiSelection => {
      const persistedValue = typeof window === "undefined" ? null : window.localStorage.getItem(storageKey);
      if (!persistedValue && fallbackConfigId && availableConfigIds.has(fallbackConfigId)) {
        const fallbackSelection: AiSelection = {
          mode: "config",
          value: fallbackConfigId
        };
        saveScopedAiSelection(storageKey, fallbackSelection);
        return fallbackSelection;
      }

      if (currentSelection.mode === "provider") {
        return {
          mode: "provider",
          value: normalizeAiProvider(currentSelection.value)
        };
      }

      if (availableConfigIds.has(currentSelection.value)) {
        return currentSelection;
      }

      if (fallbackConfigId && availableConfigIds.has(fallbackConfigId)) {
        const fallbackSelection: AiSelection = {
          mode: "config",
          value: fallbackConfigId
        };
        saveScopedAiSelection(storageKey, fallbackSelection);
        return fallbackSelection;
      }

      const providerSelection: AiSelection = {
        mode: "provider",
        value: getDefaultAiProvider()
      };
      saveScopedAiSelection(storageKey, providerSelection);
      return providerSelection;
    };

    setSolutionSelection((previous) =>
      normalizeSelection(AI_SOLUTION_PROVIDER_STORAGE_KEY, previous, aiConfigDefaults.solutionConfigId)
    );
    setReviewSelection((previous) =>
      normalizeSelection(AI_REVIEW_PROVIDER_STORAGE_KEY, previous, aiConfigDefaults.reviewConfigId)
    );
  }, [aiConfigDefaults.reviewConfigId, aiConfigDefaults.solutionConfigId, aiConfigItems]);

  const handleSolutionSelectionChange = useCallback((nextSelection: AiSelection) => {
    setSolutionSelection(nextSelection);
    saveScopedAiSelection(AI_SOLUTION_PROVIDER_STORAGE_KEY, nextSelection);
  }, []);

  const handleReviewSelectionChange = useCallback((nextSelection: AiSelection) => {
    setReviewSelection(nextSelection);
    saveScopedAiSelection(AI_REVIEW_PROVIDER_STORAGE_KEY, nextSelection);
  }, []);

  useEffect(() => {
    if (!solutionLoading) {
      return;
    }

    const timer = window.setInterval(() => {
      setSolutionPhaseStatus((previous) =>
        previous
          ? {
              ...previous,
              elapsedMs: previous.elapsedMs + 250
            }
          : previous
      );
    }, 250);

    return () => {
      window.clearInterval(timer);
    };
  }, [solutionLoading]);

  useEffect(() => {
    if (!reviewLoading) {
      return;
    }

    const timer = window.setInterval(() => {
      setReviewPhaseStatus((previous) =>
        previous
          ? {
              ...previous,
              elapsedMs: previous.elapsedMs + 250
            }
          : previous
      );
    }, 250);

    return () => {
      window.clearInterval(timer);
    };
  }, [reviewLoading]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/submissions/history/by-problem/${problem.slug}`, {
        cache: "no-store"
      });
      const payload = (await response.json()) as unknown;
      if (!response.ok) {
        throw new Error(parseErrorMessage(payload));
      }

      const data = payload as SubmissionHistoryResponse;
      setHistoryItems(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载提交记录失败。";
      setHistoryError(message);
    } finally {
      setHistoryLoading(false);
      setHistoryLoaded(true);
    }
  }, [apiBaseUrl, problem.slug]);

  const loadProblemNote = useCallback(async () => {
    setNoteLoading(true);
    setNoteError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/notes/problem/${problem.slug}`, {
        cache: "no-store"
      });
      const payload = (await response.json()) as unknown;
      if (!response.ok) {
        throw new Error(parseErrorMessage(payload));
      }

      const data = payload as ProblemNoteResponse;
      setProblemNote(data.item ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载题解笔记失败。";
      setNoteError(message);
    } finally {
      setNoteLoading(false);
      setNoteLoaded(true);
    }
  }, [apiBaseUrl, problem.slug]);

  const applyReplayData = useCallback((payload: SubmissionReplayResponse) => {
    const replaySolution = payload.ai.solution;
    const replayReview = payload.ai.review;
    const solutionContent = replaySolution?.content?.trim() ?? "";

    setSelectedReplaySubmissionId(payload.submission.id);
    setCurrentSubmission(toCurrentSubmissionSnapshot(payload.submission));

    setReviewLoading(false);
    setReviewError(null);
    setReviewGuidance(replayReview?.content ?? "");
    setReviewPhaseStatus(null);
    setReviewReasoningSummary("");
    setIsReviewThinkingCollapsed(false);
    setIsReviewThinkingExpanded(false);
    setReviewDisplay({ reasoning: "", answer: "" });

    setSolutionLoading(false);
    setSolutionError(null);
    setSolutionText(solutionContent.length > 0 ? replaySolution?.content ?? "" : "");
    setSolutionSource(replaySolution?.source ?? "");
    setSolutionResolvedProvider(replaySolution?.provider ?? "");
    setSolutionSessionId(replaySolution?.sessionId ?? "");
    setSolutionLoaded(true);
    setSolutionPhaseStatus(null);
    setSolutionReasoningSummary("");
    setIsSolutionThinkingCollapsed(false);
    setIsSolutionThinkingExpanded(false);
    setSolutionDisplay({ reasoning: "", answer: "" });
  }, []);

  const replaySubmission = useCallback(
    async (item: SubmissionHistoryItem) => {
      setHistoryError(null);
      setReplayLoadingId(item.id);

      try {
        const response = await fetch(`${apiBaseUrl}/api/submissions/${item.id}/replay`, {
          cache: "no-store"
        });
        const payload = (await response.json()) as unknown;
        if (!response.ok) {
          throw new Error(parseErrorMessage(payload));
        }

        const data = payload as SubmissionReplayResponse;
        emitSubmissionReplay({
          problemSlug: problem.slug,
          replay: data
        });
        applyReplayData(data);
      } catch (error) {
        const message = error instanceof Error ? error.message : "加载提交回放失败。";
        setHistoryError(message);
      } finally {
        setReplayLoadingId(null);
        setPendingReplayItem(null);
        setIsReplayDialogOpen(false);
      }
    },
    [apiBaseUrl, applyReplayData, problem.slug]
  );

  const closeReplayDialog = useCallback(() => {
    if (replayLoadingId !== null) {
      return;
    }
    setPendingReplayItem(null);
    setIsReplayDialogOpen(false);
  }, [replayLoadingId]);

  const confirmReplayDialog = useCallback(() => {
    if (!pendingReplayItem || replayLoadingId !== null) {
      return;
    }
    void replaySubmission(pendingReplayItem);
  }, [pendingReplayItem, replayLoadingId, replaySubmission]);

  useEffect(() => {
    if (!isReplayDialogOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || replayLoadingId !== null) {
        return;
      }
      event.preventDefault();
      setPendingReplayItem(null);
      setIsReplayDialogOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isReplayDialogOpen, replayLoadingId]);

  const generateSolution = useCallback(async () => {
    const selectionLabel = resolveSelectionLabel(solutionSelection, aiConfigItems);
    const aiRequestPayload = buildAiRequestPayload(solutionSelection);
    setSolutionLoading(true);
    setSolutionLoaded(false);
    setSolutionError(null);
    setSolutionText("");
    setSolutionSource("");
    setSolutionResolvedProvider("");
    setSolutionSessionId("");
    setSolutionReasoningSummary("");
    setIsSolutionThinkingCollapsed(false);
    setIsSolutionThinkingExpanded(false);
    setSolutionDisplay({ reasoning: "", answer: "" });
    setSolutionPhaseStatus({
      stage: "prepare",
      message: "已发送 AI 题解请求，正在准备题面上下文。",
      elapsedMs: 0
    });
    const streamTextBatcher = createStreamTextBatcher({
      onReasoningChange: setSolutionReasoningSummary,
      onContentChange: setSolutionText
    });

    try {
      const response = await fetch(`${apiBaseUrl}/api/ai/solution/stream`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          problemSlug: problem.slug,
          ...(selectedReplaySubmissionId ? { submissionId: selectedReplaySubmissionId } : {}),
          problemTitle: problem.title,
          modeSupport: problem.modeSupport,
          ...aiRequestPayload,
          preferredLanguage: "cpp",
          description: problem.description,
          sampleInput: problem.sampleInput,
          sampleOutput: problem.sampleOutput
        })
      });

      if (!response.ok || !response.body) {
        const fallbackPayload = (await response.json().catch(() => null)) as unknown;
        throw new Error(normalizeSolutionErrorMessage(parseErrorMessage(fallbackPayload), selectionLabel));
      }

      const streamResult = await consumeAiSemanticStream({
        response,
        contentField: "editorial",
        onMeta(payload) {
          if (typeof payload.source === "string" && payload.source.length > 0) {
            setSolutionSource(payload.source);
          }
          if (typeof payload.provider === "string" && payload.provider.length > 0) {
            setSolutionResolvedProvider(payload.provider);
          }
          if (typeof payload.sessionId === "string" && payload.sessionId.length > 0) {
            setSolutionSessionId(payload.sessionId);
          }
        },
        onPhase(payload) {
          const message = typeof payload.message === "string" && payload.message.length > 0 ? payload.message : "正在处理中。";
          setSolutionPhaseStatus((previous) => ({
            stage: typeof payload.stage === "string" && payload.stage.length > 0 ? payload.stage : "progress",
            message,
            elapsedMs: typeof payload.elapsedMs === "number" ? payload.elapsedMs : previous?.elapsedMs ?? 0
          }));
        },
        onReasoningDelta(delta) {
          streamTextBatcher.appendReasoning(delta);
        },
        onContentDelta(delta) {
          streamTextBatcher.appendContent(delta);
        },
        onContentReplace(text) {
          streamTextBatcher.replaceContent(text);
        },
        onCompleted(payload) {
          setSolutionPhaseStatus((previous) => ({
            stage: "done",
            message: "题解结果已整理完成。",
            elapsedMs: previous?.elapsedMs ?? 0
          }));
          if (typeof payload.reasoningSummary === "string" && payload.reasoningSummary.length > 0) {
            streamTextBatcher.replaceReasoning(payload.reasoningSummary);
          }
          if (typeof payload.source === "string" && payload.source.length > 0) {
            setSolutionSource(payload.source);
          }
          if (typeof payload.provider === "string" && payload.provider.length > 0) {
            setSolutionResolvedProvider(payload.provider);
          }
          if (typeof payload.sessionId === "string" && payload.sessionId.length > 0) {
            setSolutionSessionId(payload.sessionId);
          }
          streamTextBatcher.flushNow();
        },
        onError(message, payload) {
          const normalized = normalizeSolutionErrorMessage(message || "题解生成失败，请稍后重试。", selectionLabel);
          setSolutionError(normalized);
          if (typeof payload.source === "string" && payload.source.length > 0) {
            setSolutionSource(payload.source);
          }
          if (typeof payload.provider === "string" && payload.provider.length > 0) {
            setSolutionResolvedProvider(payload.provider);
          }
          if (typeof payload.sessionId === "string" && payload.sessionId.length > 0) {
            setSolutionSessionId(payload.sessionId);
          }
        }
      });

      streamTextBatcher.flushNow();
      if (streamResult.error) {
        setSolutionError(normalizeSolutionErrorMessage(streamResult.error, selectionLabel));
      } else if (!streamResult.doneReceived || streamResult.content.length === 0) {
        setSolutionError("题解生成失败，请稍后重试。");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "题解生成失败，请稍后重试。";
      setSolutionError(normalizeSolutionErrorMessage(message, selectionLabel));
      setSolutionPhaseStatus(null);
    } finally {
      streamTextBatcher.flushNow();
      streamTextBatcher.dispose();
      setSolutionLoading(false);
      setSolutionLoaded(true);
    }
  }, [
    apiBaseUrl,
    problem.description,
    problem.modeSupport,
    problem.sampleInput,
    problem.sampleOutput,
    problem.slug,
    problem.title,
    selectedReplaySubmissionId,
    solutionSelection,
    aiConfigItems
  ]);

  const handleAiReview = useCallback(async () => {
    if (!currentSubmission) {
      setReviewError("暂无可分析结果，请先运行测试、提交代码，或回放一条提交记录。");
      return;
    }

    if (!TERMINAL_STATUSES.has(currentSubmission.status)) {
      setReviewError("当前结果仍在处理中，请等待完成后再进行 AI 判题。");
      return;
    }

    setReviewLoading(true);
    setReviewError(null);
    setReviewGuidance("");
    setReviewReasoningSummary("");
    setIsReviewThinkingCollapsed(false);
    setIsReviewThinkingExpanded(false);
    setReviewDisplay({ reasoning: "", answer: "" });
    setReviewPhaseStatus({
      stage: "prepare",
      message: "已发送 AI 判题请求，正在准备代码与判题上下文。",
      elapsedMs: 0
    });
    const aiRequestPayload = buildAiRequestPayload(reviewSelection);
    const streamTextBatcher = createStreamTextBatcher({
      onReasoningChange: setReviewReasoningSummary,
      onContentChange: setReviewGuidance
    });

    try {
      const response = await fetch(`${apiBaseUrl}/api/ai/bug-find/stream`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          problemSlug: problem.slug,
          ...(currentSubmission.source === "submission" && currentSubmission.submissionId
            ? { submissionId: currentSubmission.submissionId }
            : {}),
          ...aiRequestPayload,
          language: currentSubmission.language,
          mode: currentSubmission.mode,
          code: currentSubmission.code,
          status: currentSubmission.status,
          runtimeMs: currentSubmission.runtimeMs,
          memoryKb: currentSubmission.memoryKb,
          passedCount: currentSubmission.passedCount,
          totalCount: currentSubmission.totalCount,
          errorMessage: currentSubmission.errorMessage,
          failureCase: currentSubmission.failureCase ?? null,
          failureSignals: currentSubmission.failureSignals ?? []
        })
      });

      if (!response.ok || !response.body) {
        const fallbackPayload = (await response.json().catch(() => null)) as unknown;
        throw new Error(parseErrorMessage(fallbackPayload));
      }

      const streamResult = await consumeAiSemanticStream({
        response,
        contentField: "guidance",
        onPhase(payload) {
          const message = typeof payload.message === "string" && payload.message.length > 0 ? payload.message : "正在处理中。";
          setReviewPhaseStatus((previous) => ({
            stage: typeof payload.stage === "string" && payload.stage.length > 0 ? payload.stage : "progress",
            message,
            elapsedMs: typeof payload.elapsedMs === "number" ? payload.elapsedMs : previous?.elapsedMs ?? 0
          }));
        },
        onReasoningDelta(delta) {
          streamTextBatcher.appendReasoning(delta);
        },
        onContentDelta(delta) {
          streamTextBatcher.appendContent(delta);
        },
        onContentReplace(text) {
          streamTextBatcher.replaceContent(text);
        },
        onCompleted(payload) {
          setReviewPhaseStatus((previous) => ({
            stage: "done",
            message: "判题结果已整理完成。",
            elapsedMs: previous?.elapsedMs ?? 0
          }));
          if (typeof payload.reasoningSummary === "string" && payload.reasoningSummary.length > 0) {
            streamTextBatcher.replaceReasoning(payload.reasoningSummary);
          }
          streamTextBatcher.flushNow();
        },
        onError(message) {
          setReviewError(message || "AI 判题失败，请稍后重试。");
        }
      });

      streamTextBatcher.flushNow();
      if (streamResult.error) {
        setReviewError(streamResult.error);
      } else if (!streamResult.doneReceived || streamResult.content.length === 0) {
        setReviewError("AI 暂未返回建议，请稍后重试。");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 判题失败，请稍后重试。";
      setReviewError(message);
      setReviewPhaseStatus(null);
    } finally {
      streamTextBatcher.flushNow();
      streamTextBatcher.dispose();
      setReviewLoading(false);
    }
  }, [apiBaseUrl, currentSubmission, problem.slug, reviewSelection]);

  useEffect(() => {
    if (activeTab === "submissions" && !historyLoaded && !historyLoading) {
      void loadHistory();
    }
  }, [activeTab, historyLoaded, historyLoading, loadHistory]);

  useEffect(() => {
    if (activeTab === "note-solution" && !noteLoaded && !noteLoading) {
      void loadProblemNote();
    }
  }, [activeTab, loadProblemNote, noteLoaded, noteLoading]);

  return (
    <section className="lc-card flex h-full min-h-[360px] flex-col overflow-hidden lg:min-h-0">
      <div className="border-b border-[var(--lc-border-soft)] px-3 py-2.5 sm:px-4">
        <div className="lc-scrollbar-hidden overflow-x-auto">
          <div className="lc-side-tabs-shell">
            {SIDE_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`lc-side-tab ${activeTab === tab.key ? "lc-side-tab-active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
                aria-pressed={activeTab === tab.key}
              >
                <span className="lc-side-tab-icon">{tab.icon}</span>
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2.5 text-sm sm:px-4 sm:pb-4">
        {activeTab === "description" ? (
          <div className="lc-scrollbar-hidden min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="space-y-3 pb-1">
              <div className="rounded-[16px] border bg-[var(--lc-surface-soft)] px-3.5 py-3">
                <h1 className="text-base font-semibold leading-7 text-[var(--lc-text)] sm:text-[1.1rem]">
                  {problem.leetcodeId ? `${problem.leetcodeId}. ` : ""}
                  {problem.titleZh ?? problem.title}
                </h1>
                <div data-testid="problem-meta-badges" className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="lc-badge border bg-[var(--lc-surface-soft)] text-[var(--lc-text-muted)]">{problem.slug}</span>
                  <span className="lc-badge border bg-[var(--lc-surface-soft)] text-[var(--lc-accent)]">{modeSupportLabel(problem.modeSupport)}</span>
                  <span className="lc-badge border bg-[var(--lc-surface-soft)] text-[var(--lc-text-muted)]">{difficultyLabel(problem.difficulty)}</span>
                  {problem.tags.map((tag) => (
                    <span key={tag} className="lc-badge border bg-[var(--lc-surface-soft)] text-[var(--lc-text-muted)]">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

                <div className="lc-markdown rounded-[16px] border bg-[var(--lc-surface)] px-3.5 py-3 text-[14px] leading-6 text-[var(--lc-text)]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{descriptionMarkdown}</ReactMarkdown>
                </div>
                <div className="rounded-[14px] border bg-[var(--lc-surface-soft)] px-3.5 py-3 text-[11px]">
                  <p className="mb-1 font-semibold text-[var(--lc-text)]">输入说明</p>
                  <pre className="whitespace-pre-wrap leading-5 text-[var(--lc-text-muted)]">
                    {normalizeDisplayText(activeEditorMode === "acm" ? problem.acmInputSpec || "(无)" : problem.inputSpec || "(无)")}
                  </pre>
                </div>
                <div className="rounded-[14px] border bg-[var(--lc-surface-soft)] px-3.5 py-3 text-[11px]">
                  <p className="mb-1 font-semibold text-[var(--lc-text)]">输出说明</p>
                  <pre className="whitespace-pre-wrap leading-5 text-[var(--lc-text-muted)]">
                    {normalizeDisplayText(activeEditorMode === "acm" ? problem.acmOutputSpec || "(无)" : problem.outputSpec || "(无)")}
                  </pre>
                </div>
                <div className="rounded-[14px] border bg-[var(--lc-surface-soft)] px-3.5 py-3 text-[11px]">
                  <p className="mb-1 font-semibold text-[var(--lc-text)]">示例输入</p>
                  <pre className="whitespace-pre-wrap leading-5 text-[var(--lc-text-muted)]">
                    {normalizeDisplayText(activeEditorMode === "acm" ? problem.acmSampleInput || "(无)" : problem.sampleInput || "(无)")}
                  </pre>
                </div>
                <div className="rounded-[14px] border bg-[var(--lc-surface-soft)] px-3.5 py-3 text-[11px]">
                  <p className="mb-1 font-semibold text-[var(--lc-text)]">示例输出</p>
                  <pre className="whitespace-pre-wrap leading-5 text-[var(--lc-text-muted)]">
                    {normalizeDisplayText(activeEditorMode === "acm" ? problem.acmSampleOutput || "(无)" : problem.sampleOutput || "(无)")}
                  </pre>
                </div>
              </div>
            </div>
        ) : null}

        {activeTab === "submissions" ? (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border bg-[var(--lc-surface-soft)] px-3.5 py-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[var(--lc-text)]">提交记录</p>
                  <p className="text-xs text-[var(--lc-text-muted)]">最近 30 条提交，点击任意一条即可回放当时代码与结果。</p>
                </div>
                <button type="button" className="lc-btn-secondary h-8 px-3 text-xs" onClick={() => void loadHistory()} disabled={historyLoading}>
                  {historyLoading ? "刷新中..." : "刷新"}
                </button>
              </div>

              <div className="space-y-3">
                {historyItems.length === 0 ? (
                  <div className="rounded-[14px] border bg-[var(--lc-surface-soft)] px-3.5 py-3 text-sm text-[var(--lc-text-muted)]">暂无提交记录。</div>
                ) : (
                  historyItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`block w-full rounded-[14px] border px-3.5 py-3 text-left text-xs transition duration-200 hover:-translate-y-[1px] ${
                        selectedReplaySubmissionId === item.id
                          ? "border-[var(--lc-accent)] bg-[var(--lc-surface-soft)]"
                          : "border-[var(--lc-border)] bg-[var(--lc-surface)] hover:bg-[var(--lc-surface-soft)]"
                      }`}
                      onClick={() => {
                        setPendingReplayItem(item);
                        setIsReplayDialogOpen(true);
                      }}
                      disabled={replayLoadingId !== null}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <p className="font-mono text-[10px] text-[var(--lc-text-muted)]">{item.id}</p>
                          <p className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-[10px] border px-2 py-0.5 font-semibold ${statusClass(item.status)}`}>{item.status}</span>
                            <span className="rounded-[10px] border border-[var(--lc-border-soft)] bg-[var(--lc-surface-soft)] px-2 py-0.5 text-[10px] text-[var(--lc-text-muted)]">
                              {item.language} / {item.mode}
                            </span>
                            <span className="rounded-[10px] border border-[var(--lc-border-soft)] bg-[var(--lc-surface-soft)] px-2 py-0.5 text-[10px] text-[var(--lc-text-muted)]">
                              {item.passedCount}/{item.totalCount} 用例
                            </span>
                          </p>
                        </div>
                        <span className="rounded-[10px] border border-[var(--lc-border-soft)] bg-[var(--lc-surface-soft)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--lc-text-muted)]">
                          {replayLoadingId === item.id ? "回放加载中..." : selectedReplaySubmissionId === item.id ? "当前回放记录" : "点击回放"}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] text-[var(--lc-text-muted)]">
                        {formatTime(item.createdAt)} · {item.runtimeMs ?? "-"} ms · {item.memoryKb ?? "-"} KB
                      </p>
                      {item.errorMessage ? (
                        <div className="mt-2 space-y-1">
                          <p className="text-[var(--lc-danger)]">错误：</p>
                          <pre className="max-h-[160px] overflow-auto whitespace-pre-wrap break-all rounded-[12px] border border-[var(--lc-border)] bg-[var(--lc-surface-soft)] p-2 text-[11px] leading-5 text-[var(--lc-danger)]">
                            {item.errorMessage}
                          </pre>
                        </div>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
              {historyError ? <p className="text-sm text-[var(--lc-danger)]">{historyError}</p> : null}
            </div>
          </div>
        ) : null}

        {activeTab === "note-solution" ? (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="space-y-3 pb-1">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border bg-[var(--lc-surface-soft)] px-3.5 py-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[var(--lc-text)]">我的题解笔记</p>
                  <p className="text-xs text-[var(--lc-text-muted)]">优先展示你上传并自动匹配到当前题目的 Markdown 笔记。</p>
                </div>
                <button type="button" className="lc-btn-secondary h-8 px-3 text-xs" onClick={() => void loadProblemNote()} disabled={noteLoading}>
                  {noteLoading ? "刷新中..." : "刷新笔记"}
                </button>
              </div>

              <div className="rounded-[16px] border bg-[var(--lc-surface)] px-3.5 py-3">
                {noteLoading ? (
                  <p className="text-sm text-[var(--lc-text-muted)]">正在加载笔记...</p>
                ) : problemNote ? (
                  <div className="lc-markdown text-sm leading-6 text-[var(--lc-text)]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{problemNote.contentMd}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--lc-text-muted)]">当前题目还没有匹配到个人笔记。请先到首页上传 Markdown 笔记，然后回到这里查看。</p>
                )}
              </div>

              {problemNote ? (
                <p className="rounded-[12px] border bg-[var(--lc-surface-soft)] px-3 py-2 text-[11px] text-[var(--lc-text-muted)]">
                  来源：{problemNote.sourceFilename} · 匹配段落：{problemNote.matchedHeading} · 更新时间：{formatTime(problemNote.updatedAt)}
                </p>
              ) : null}
              {noteError ? <p className="text-sm text-[var(--lc-danger)]">{noteError}</p> : null}
            </div>
          </div>
        ) : null}

        {activeTab === "ai-solution" ? (
          <div className="flex min-h-0 flex-1 flex-col pr-1">
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <AiStreamPanel
                headerActions={
                  <>
                    <select
                      className="lc-ai-select flex-1 sm:flex-none"
                      value={serializeAiSelection(solutionSelection)}
                      onChange={(event) => handleSolutionSelectionChange(parseAiSelection(event.target.value))}
                    >
                      {aiConfigItems.map((item) => (
                        <option key={`solution-config-${item.id}`} value={`config:${item.id}`}>
                          {item.name}
                        </option>
                      ))}
                      <option value="provider:vllm">系统 vLLM（兼容）</option>
                      <option value="provider:minimax">系统 MiniMax（兼容）</option>
                    </select>
                    <button type="button" className="lc-ai-action min-w-[88px]" onClick={() => void generateSolution()} disabled={solutionLoading}>
                      {solutionLoading ? "生成中..." : solutionLoaded ? "重新生成" : "生成题解"}
                    </button>
                  </>
                }
                phaseStatus={solutionPhaseStatus}
                isLoading={solutionLoading}
                reasoningSummary={solutionDisplay.reasoning}
                reasoningMarkdown={solutionReasoningMarkdown}
                isThinkingCollapsed={isSolutionThinkingCollapsed}
                onThinkingCollapsedChange={setIsSolutionThinkingCollapsed}
                isThinkingExpanded={isSolutionThinkingExpanded}
                onThinkingExpandedChange={setIsSolutionThinkingExpanded}
                content={solutionDisplay.answer}
                contentMarkdown={solutionMarkdown}
                emptyText={selectedReplaySubmissionId ? "该提交暂无 AI 题解，点击“生成题解”手动生成。" : "点击“生成题解”后可查看 AI 补充讲解。"}
              />

              {solutionError ? <p className="text-sm text-[var(--lc-danger)]">{solutionError}</p> : null}
              {aiConfigError ? <p className="text-xs text-[var(--lc-danger)]">{aiConfigError}</p> : null}
            </div>
          </div>
        ) : null}

        {activeTab === "ai-review" ? (
          <div className="flex min-h-0 flex-1 flex-col pr-1">
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <AiStreamPanel
                headerActions={
                  <>
                    <select
                      className="lc-ai-select flex-1 sm:flex-none"
                      value={serializeAiSelection(reviewSelection)}
                      onChange={(event) => handleReviewSelectionChange(parseAiSelection(event.target.value))}
                    >
                      {aiConfigItems.map((item) => (
                        <option key={`review-config-${item.id}`} value={`config:${item.id}`}>
                          {item.name}
                        </option>
                      ))}
                      <option value="provider:vllm">系统 vLLM（兼容）</option>
                      <option value="provider:minimax">系统 MiniMax（兼容）</option>
                    </select>
                    <button type="button" className="lc-ai-action min-w-[88px]" onClick={() => void handleAiReview()} disabled={reviewLoading || !canRunAiReview}>
                      {reviewLoading ? "分析中..." : "AI判题"}
                    </button>
                  </>
                }
                phaseStatus={reviewPhaseStatus}
                isLoading={reviewLoading}
                reasoningSummary={reviewDisplay.reasoning}
                reasoningMarkdown={reviewReasoningMarkdown}
                isThinkingCollapsed={isReviewThinkingCollapsed}
                onThinkingCollapsedChange={setIsReviewThinkingCollapsed}
                isThinkingExpanded={isReviewThinkingExpanded}
                onThinkingExpandedChange={setIsReviewThinkingExpanded}
                content={reviewDisplay.answer}
                contentMarkdown={reviewMarkdown}
                emptyText={
                  canRunAiReview
                    ? "点击“AI判题”后可查看错误定位与改进建议。"
                    : "暂无可分析结果，请先在右侧运行测试/提交代码，或在“提交记录”中回放一条提交。"
                }
              />

              {reviewError ? <p className="text-sm text-[var(--lc-danger)]">{reviewError}</p> : null}
              {aiConfigError ? <p className="text-xs text-[var(--lc-danger)]">{aiConfigError}</p> : null}
            </div>
          </div>
        ) : null}
      </div>

      <ConfirmReplayDialog
        open={isReplayDialogOpen}
        item={pendingReplayItem}
        isLoading={replayLoadingId !== null}
        onCancel={closeReplayDialog}
        onConfirm={confirmReplayDialog}
      />
    </section>
  );
}
