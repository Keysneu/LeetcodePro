"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AI_PROVIDER_SYNC_EVENT,
  AiProvider,
  aiProviderLabel,
  getDefaultAiProvider,
  readPreferredAiProvider,
  savePreferredAiProvider
} from "@/lib/ai-provider";

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

type SolutionResponse = {
  editorial?: string;
  source?: string;
  provider?: string;
  sessionId?: string | null;
};

type SolutionSsePayload = {
  sessionId?: string;
  source?: string;
  provider?: string;
  delta?: string;
  editorial?: string;
  error?: string;
  message?: string;
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

type TabKey = "description" | "submissions" | "solution";

type Props = {
  apiBaseUrl: string;
  problem: ProblemDetail;
};

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

function normalizeSolutionErrorMessage(message: string, provider: AiProvider): string {
  const providerLabel = aiProviderLabel(provider);
  const fallback = `${providerLabel} 题解生成失败，请稍后重试。`;
  const timeoutMessage = `${providerLabel} 题解请求超时，请稍后重试。`;
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

  return { event, data: dataLines.join("\n") };
}

function parseSsePayload(raw: string): SolutionSsePayload {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as SolutionSsePayload;
    }
  } catch {
    // fallback to raw text
  }

  return { delta: raw };
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

function normalizeProblemMarkdown(markdown: string): string {
  return markdown
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/^\s*[\t ]+-\s+/gm, "- ");
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

export default function ProblemSidePanel({ apiBaseUrl, problem }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("description");

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<SubmissionHistoryItem[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

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
  const [aiProvider, setAiProvider] = useState<AiProvider>(() => getDefaultAiProvider());
  const descriptionMarkdown = useMemo(() => normalizeProblemMarkdown(problem.description), [problem.description]);

  const tabTitle = useMemo(() => {
    if (activeTab === "description") {
      return "题目描述";
    }
    if (activeTab === "submissions") {
      return "提交记录";
    }
    return "题解";
  }, [activeTab]);

  useEffect(() => {
    setActiveTab("description");
    setHistoryLoading(false);
    setHistoryError(null);
    setHistoryItems([]);
    setHistoryLoaded(false);

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
    setAiProvider(readPreferredAiProvider());
  }, [problem.slug]);

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

  const handleProviderChange = useCallback((nextProvider: AiProvider) => {
    setAiProvider(nextProvider);
    savePreferredAiProvider(nextProvider);
  }, []);

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

  const generateSolution = useCallback(async () => {
    setSolutionLoading(true);
    setSolutionLoaded(false);
    setSolutionError(null);
    setSolutionText("");
    setSolutionSource("");
    setSolutionResolvedProvider("");
    setSolutionSessionId("");

    try {
      const response = await fetch(`${apiBaseUrl}/api/ai/solution/stream`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          problemSlug: problem.slug,
          problemTitle: problem.title,
          modeSupport: problem.modeSupport,
          provider: aiProvider,
          preferredLanguage: "cpp",
          description: problem.description,
          sampleInput: problem.sampleInput,
          sampleOutput: problem.sampleOutput
        })
      });

      if (!response.ok || !response.body) {
        const fallbackPayload = (await response.json().catch(() => null)) as unknown;
        throw new Error(normalizeSolutionErrorMessage(parseErrorMessage(fallbackPayload), aiProvider));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let editorial = "";
      let doneReceived = false;
      let streamError = "";

      const applyFrame = (event: string, payload: SolutionSsePayload) => {
        if (event === "meta") {
          if (typeof payload.source === "string" && payload.source.length > 0) {
            setSolutionSource(payload.source);
          }
          if (typeof payload.provider === "string" && payload.provider.length > 0) {
            setSolutionResolvedProvider(payload.provider);
          }
          if (typeof payload.sessionId === "string" && payload.sessionId.length > 0) {
            setSolutionSessionId(payload.sessionId);
          }
          return;
        }

        if (event === "delta") {
          const delta = typeof payload.delta === "string" ? payload.delta : "";
          if (delta.length > 0) {
            editorial += delta;
            setSolutionText(editorial);
          }
          return;
        }

        if (event === "error") {
          const rawMessage =
            (typeof payload.message === "string" && payload.message.length > 0
              ? payload.message
              : typeof payload.error === "string" && payload.error.length > 0
              ? payload.error
              : "题解生成失败，请稍后重试。");
          const message = normalizeSolutionErrorMessage(rawMessage, aiProvider);
          streamError = message;
          setSolutionError(message);
          if (typeof payload.source === "string" && payload.source.length > 0) {
            setSolutionSource(payload.source);
          }
          if (typeof payload.provider === "string" && payload.provider.length > 0) {
            setSolutionResolvedProvider(payload.provider);
          }
          if (typeof payload.sessionId === "string" && payload.sessionId.length > 0) {
            setSolutionSessionId(payload.sessionId);
          }
          return;
        }

        if (event === "done") {
          doneReceived = true;
          if (typeof payload.editorial === "string" && payload.editorial.length > 0) {
            editorial = payload.editorial;
            setSolutionText(editorial);
          }
          if (typeof payload.error === "string" && payload.error.length > 0) {
            const message = normalizeSolutionErrorMessage(payload.error, aiProvider);
            streamError = message;
            setSolutionError(message);
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

      const shouldFetchFallback = (editorial.length === 0 || !doneReceived) && streamError.length === 0;
      if (shouldFetchFallback) {
        const fallback = await fetch(`${apiBaseUrl}/api/ai/solution`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            problemSlug: problem.slug,
            problemTitle: problem.title,
            modeSupport: problem.modeSupport,
            provider: aiProvider,
            preferredLanguage: "cpp",
            description: problem.description,
            sampleInput: problem.sampleInput,
            sampleOutput: problem.sampleOutput
          })
        });
        const fallbackPayload = (await fallback.json()) as unknown;
        if (!fallback.ok) {
          throw new Error(normalizeSolutionErrorMessage(parseErrorMessage(fallbackPayload), aiProvider));
        }
        const data = fallbackPayload as SolutionResponse;
        const fallbackEditorial = data.editorial ?? "";
        let replacedWithFallback = false;
        if (fallbackEditorial.length > editorial.length) {
          editorial = fallbackEditorial;
          setSolutionText(editorial);
          replacedWithFallback = true;
        } else if (editorial.length === 0) {
          setSolutionText("暂未生成题解，请稍后重试。");
        }

        if (replacedWithFallback && data.source && data.source.length > 0) {
          setSolutionSource(data.source);
        }
        if (replacedWithFallback && data.provider && data.provider.length > 0) {
          setSolutionResolvedProvider(data.provider);
        }
        if (replacedWithFallback && data.sessionId && data.sessionId.length > 0) {
          setSolutionSessionId(data.sessionId);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "题解生成失败，请稍后重试。";
      setSolutionError(normalizeSolutionErrorMessage(message, aiProvider));
    } finally {
      setSolutionLoading(false);
      setSolutionLoaded(true);
    }
  }, [aiProvider, apiBaseUrl, problem.description, problem.modeSupport, problem.sampleInput, problem.sampleOutput, problem.slug, problem.title]);

  useEffect(() => {
    if (activeTab === "submissions" && !historyLoaded && !historyLoading) {
      void loadHistory();
    }
  }, [activeTab, historyLoaded, historyLoading, loadHistory]);

  useEffect(() => {
    if (activeTab !== "solution") {
      return;
    }

    if (!noteLoaded && !noteLoading) {
      void loadProblemNote();
      return;
    }

    if (noteLoaded && !problemNote && !solutionLoaded && !solutionLoading) {
      void generateSolution();
    }
  }, [activeTab, generateSolution, loadProblemNote, noteLoaded, noteLoading, problemNote, solutionLoaded, solutionLoading]);

  return (
    <section className="lc-card overflow-hidden">
      <div className="border-b bg-[var(--lc-surface-soft)] px-4">
        <div className="flex items-center gap-1">
          <button type="button" className={`lc-tab ${activeTab === "description" ? "lc-tab-active" : ""}`} onClick={() => setActiveTab("description")}>
            描述
          </button>
          <button type="button" className={`lc-tab ${activeTab === "submissions" ? "lc-tab-active" : ""}`} onClick={() => setActiveTab("submissions")}>
            提交记录
          </button>
          <button type="button" className={`lc-tab ${activeTab === "solution" ? "lc-tab-active" : ""}`} onClick={() => setActiveTab("solution")}>
            题解
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4 text-sm">
        <div className="space-y-2 border-b pb-4">
          <h1 className="text-lg font-semibold text-[var(--lc-text)]">
            {problem.leetcodeId ? `${problem.leetcodeId}. ` : ""}
            {problem.titleZh ?? problem.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="lc-badge border bg-[var(--lc-surface-soft)] text-[var(--lc-text-muted)]">{problem.slug}</span>
            <span className="lc-badge border bg-[var(--lc-surface-soft)] text-[var(--lc-accent)]">{modeSupportLabel(problem.modeSupport)}</span>
            <span className="lc-badge border bg-[var(--lc-surface-soft)] text-[var(--lc-text-muted)]">{difficultyLabel(problem.difficulty)}</span>
            <span className="lc-badge border bg-[var(--lc-surface-soft)] text-[var(--lc-text-muted)]">{tabTitle}</span>
            {problem.tags.map((tag) => (
              <span key={tag} className="lc-badge border bg-[var(--lc-surface-soft)] text-[var(--lc-text-muted)]">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {activeTab === "description" ? (
          <div className="space-y-4">
            <div className="max-h-[44vh] overflow-y-auto pr-1">
              <div className="lc-markdown leading-7 text-[var(--lc-text)]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{descriptionMarkdown}</ReactMarkdown>
              </div>
            </div>
            <div className="rounded-lg border bg-[var(--lc-surface-soft)] p-3 text-xs">
              <p className="mb-1.5 font-semibold text-[var(--lc-text)]">输入说明</p>
              <pre className="whitespace-pre-wrap leading-6 text-[var(--lc-text-muted)]">{problem.inputSpec || "(无)"}</pre>
            </div>
            <div className="rounded-lg border bg-[var(--lc-surface-soft)] p-3 text-xs">
              <p className="mb-1.5 font-semibold text-[var(--lc-text)]">输出说明</p>
              <pre className="whitespace-pre-wrap leading-6 text-[var(--lc-text-muted)]">{problem.outputSpec || "(无)"}</pre>
            </div>
            <div className="rounded-lg border bg-[var(--lc-surface-soft)] p-3 text-xs">
              <p className="mb-1.5 font-semibold text-[var(--lc-text)]">示例输入</p>
              <pre className="whitespace-pre-wrap leading-6 text-[var(--lc-text-muted)]">{problem.sampleInput || "(无)"}</pre>
            </div>
            <div className="rounded-lg border bg-[var(--lc-surface-soft)] p-3 text-xs">
              <p className="mb-1.5 font-semibold text-[var(--lc-text)]">示例输出</p>
              <pre className="whitespace-pre-wrap leading-6 text-[var(--lc-text-muted)]">{problem.sampleOutput || "(无)"}</pre>
            </div>
          </div>
        ) : null}

        {activeTab === "submissions" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--lc-text-muted)]">最近 30 条提交记录</p>
              <button type="button" className="lc-btn-secondary h-8 px-3 text-xs" onClick={() => void loadHistory()} disabled={historyLoading}>
                {historyLoading ? "刷新中..." : "刷新"}
              </button>
            </div>

            <div className="max-h-[48vh] overflow-y-auto rounded-lg border">
              {historyItems.length === 0 ? (
                <p className="p-3 text-sm text-[var(--lc-text-muted)]">暂无提交记录。</p>
              ) : (
                <div className="divide-y">
                  {historyItems.map((item) => (
                    <div key={item.id} className="space-y-1 p-3 text-xs">
                      <p className="font-mono text-[var(--lc-text-muted)]">{item.id}</p>
                      <p className="flex flex-wrap items-center gap-2">
                        <span className={`rounded border px-2 py-0.5 font-semibold ${statusClass(item.status)}`}>{item.status}</span>
                        <span className="text-[var(--lc-text-muted)]">
                          {item.language} / {item.mode}
                        </span>
                        <span className="text-[var(--lc-text-muted)]">
                          {item.passedCount}/{item.totalCount} 用例
                        </span>
                      </p>
                      <p className="text-[var(--lc-text-muted)]">
                        {formatTime(item.createdAt)} · {item.runtimeMs ?? "-"} ms · {item.memoryKb ?? "-"} KB
                      </p>
                      {item.errorMessage ? (
                        <div className="space-y-1">
                          <p className="text-[var(--lc-danger)]">错误：</p>
                          <pre className="max-h-[160px] overflow-auto whitespace-pre-wrap break-all rounded border border-[var(--lc-border)] bg-[var(--lc-surface)] p-2 text-[11px] text-[var(--lc-danger)]">
                            {item.errorMessage}
                          </pre>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {historyError ? <p className="text-sm text-[var(--lc-danger)]">{historyError}</p> : null}
          </div>
        ) : null}

        {activeTab === "solution" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--lc-text)]">我的题解笔记</p>
                <button type="button" className="lc-btn-secondary h-8 px-3 text-xs" onClick={() => void loadProblemNote()} disabled={noteLoading}>
                  {noteLoading ? "刷新中..." : "刷新笔记"}
                </button>
              </div>

              <div className="max-h-[34vh] overflow-y-auto rounded-lg border bg-[var(--lc-surface-soft)] p-3">
                {noteLoading ? (
                  <p className="text-sm text-[var(--lc-text-muted)]">正在加载笔记...</p>
                ) : problemNote ? (
                  <div className="lc-markdown text-sm text-[var(--lc-text)]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{problemNote.contentMd}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--lc-text-muted)]">当前题目还没有匹配到个人笔记。请先到首页上传 Markdown 笔记，然后回到这里查看。</p>
                )}
              </div>

              {problemNote ? (
                <p className="text-xs text-[var(--lc-text-muted)]">
                  来源：{problemNote.sourceFilename} · 匹配段落：{problemNote.matchedHeading} · 更新时间：{formatTime(problemNote.updatedAt)}
                </p>
              ) : null}
              {noteError ? <p className="text-sm text-[var(--lc-danger)]">{noteError}</p> : null}
            </div>

            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--lc-text-muted)]">AI 题解补充（无个人笔记时自动生成，可手动重生成）</p>
                <div className="flex items-center gap-2">
                  <select className="lc-select h-8 min-w-[130px] text-xs" value={aiProvider} onChange={(event) => handleProviderChange(event.target.value as AiProvider)}>
                    <option value="vllm">vLLM（远程）</option>
                    <option value="minimax">MiniMax（远程）</option>
                  </select>
                  <button type="button" className="lc-btn-info h-8 px-3 text-xs" onClick={() => void generateSolution()} disabled={solutionLoading}>
                    {solutionLoading ? "生成中..." : solutionLoaded ? "重新生成" : "生成题解"}
                  </button>
                </div>
              </div>

              <div className="max-h-[34vh] overflow-y-auto rounded-lg border bg-[var(--lc-surface-soft)] p-3">
                {solutionText ? (
                  <div className="lc-markdown text-sm text-[var(--lc-text)]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{solutionText}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--lc-text-muted)]">点击“生成题解”后可查看 AI 补充讲解。</p>
                )}
              </div>

              <p className="text-xs text-[var(--lc-text-muted)]">模型：{aiProviderLabel(aiProvider)}</p>
              {solutionResolvedProvider ? <p className="text-xs text-[var(--lc-text-muted)]">实际 Provider：{solutionResolvedProvider}</p> : null}
              {solutionSource ? <p className="text-xs text-[var(--lc-text-muted)]">来源：{solutionSource}</p> : null}
              {solutionSessionId ? <p className="font-mono text-xs text-[var(--lc-text-muted)]">会话：{solutionSessionId}</p> : null}
              {solutionError ? <p className="text-sm text-[var(--lc-danger)]">{solutionError}</p> : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
