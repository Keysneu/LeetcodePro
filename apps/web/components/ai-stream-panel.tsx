"use client";

import { type ReactNode, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type PhaseStatus = {
  stage: string;
  message: string;
  elapsedMs: number;
};

type Props = {
  title?: string;
  subtitle?: string;
  headerActions?: ReactNode;
  phaseStatus: PhaseStatus | null;
  isLoading: boolean;
  reasoningSummary: string;
  reasoningMarkdown: string;
  isThinkingCollapsed: boolean;
  onThinkingCollapsedChange: (collapsed: boolean) => void;
  isThinkingExpanded: boolean;
  onThinkingExpandedChange: (expanded: boolean) => void;
  content: string;
  contentMarkdown: string;
  emptyText: string;
};

export default function AiStreamPanel({
  title,
  subtitle,
  headerActions,
  phaseStatus,
  isLoading,
  reasoningSummary,
  reasoningMarkdown,
  isThinkingCollapsed,
  onThinkingCollapsedChange,
  isThinkingExpanded,
  onThinkingExpandedChange,
  content,
  contentMarkdown,
  emptyText
}: Props) {
  const thinkingViewportRef = useRef<HTMLDivElement | null>(null);
  const answerViewportRef = useRef<HTMLDivElement | null>(null);
  const hasReasoning = reasoningSummary.trim().length > 0;
  const hasContent = content.trim().length > 0;
  const shouldRenderThinkingPanel = hasReasoning || isLoading;
  const thinkingHeightClass = isThinkingExpanded ? "max-h-[20rem]" : "max-h-32";
  const thinkingDurationText = phaseStatus ? `${Math.max(1, Math.round(phaseStatus.elapsedMs / 1000))}s` : "";
  const hasHeaderSummary = Boolean(title || subtitle);

  useEffect(() => {
    if (!isLoading || isThinkingCollapsed) {
      return;
    }

    const viewport = thinkingViewportRef.current;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [isLoading, isThinkingCollapsed, reasoningSummary]);

  useEffect(() => {
    if (!isLoading) {
      return;
    }

    const viewport = answerViewportRef.current;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [content, isLoading]);

  return (
    <div
      className="flex h-full min-h-0 flex-col rounded-[22px] border border-[var(--lc-border)] bg-[var(--lc-surface)] px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in oklab, var(--lc-surface) 99%, white), color-mix(in oklab, var(--lc-surface-soft) 46%, var(--lc-surface) 54%))"
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--lc-border-soft)] pb-3">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--lc-accent)]" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-base font-semibold tracking-[-0.02em] text-[var(--lc-text)]">leetPro AI</span>
                </div>
                {hasHeaderSummary ? (
                  <div className="mt-2 space-y-1">
                    {title ? <p className="text-sm font-semibold text-[var(--lc-text)]">{title}</p> : null}
                    {subtitle ? <p className="text-xs leading-5 text-[var(--lc-text-muted)]">{subtitle}</p> : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
            {headerActions ? <div className="lc-ai-toolbar">{headerActions}</div> : null}
          </div>
        </div>

        <section className="flex min-h-0 flex-1 flex-col">
          {shouldRenderThinkingPanel ? (
            <div className="mb-3 shrink-0 rounded-[14px] border border-[var(--lc-border-soft)] bg-[var(--lc-surface-soft)] px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--lc-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--lc-text)] transition-colors hover:bg-[var(--lc-border)]/50"
                  onClick={() => onThinkingCollapsedChange(!isThinkingCollapsed)}
                >
                  <span>{`思考${thinkingDurationText ? ` ${thinkingDurationText}` : ""}`}</span>
                  <span className={`inline-block text-xs transition-transform ${isThinkingCollapsed ? "-rotate-90" : "rotate-0"}`}>⌃</span>
                </button>
                <span className="text-[11px] font-medium text-[var(--lc-text-muted)]">推理摘要</span>
                <button
                  type="button"
                  className="ml-auto rounded-full border border-[var(--lc-border)] bg-[var(--lc-surface)] px-2.5 py-1.5 text-[11px] text-[var(--lc-text-muted)] transition-colors hover:bg-[var(--lc-surface-soft)] disabled:opacity-50"
                  onClick={() => onThinkingExpandedChange(!isThinkingExpanded)}
                  disabled={isThinkingCollapsed}
                >
                  {isThinkingExpanded ? "标准视图" : "放大"}
                </button>
              </div>

              {!isThinkingCollapsed ? (
                <div
                  ref={thinkingViewportRef}
                  className={`mt-2.5 overflow-y-auto rounded-[12px] border border-[var(--lc-border-soft)] bg-[var(--lc-surface)] px-3 py-2.5 transition-[max-height] duration-200 ${thinkingHeightClass}`}
                >
                  <div className="lc-markdown lc-ai-markdown text-[13px] leading-6 text-[var(--lc-text-muted)]">
                    {hasReasoning ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{reasoningMarkdown}</ReactMarkdown>
                    ) : (
                      <p className="animate-pulse">正在接收思考内容...</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--lc-success)]" />
              <span className="text-sm font-semibold text-[var(--lc-text)]">回答</span>
              {isLoading ? <span className="text-xs text-[var(--lc-text-muted)]">持续生成中</span> : null}
            </div>
            {hasContent ? (
              <div ref={answerViewportRef} className="lc-scrollbar-hidden min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="lc-markdown lc-ai-markdown text-[15px] leading-7 text-[var(--lc-text)] [&>p:first-of-type]:text-base [&>p:first-of-type]:font-semibold [&>p:first-of-type]:leading-8 [&>p:first-of-type]:tracking-[-0.01em]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{contentMarkdown}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="text-sm leading-7 text-[var(--lc-text-muted)]">
                {isLoading ? "正在实时整理回答..." : emptyText}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
