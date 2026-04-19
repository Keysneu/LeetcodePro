"use client";

import { useEffect, useRef } from "react";
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

function formatElapsedMs(elapsedMs: number): string {
  if (elapsedMs < 1000) {
    return `${elapsedMs}ms`;
  }

  const seconds = elapsedMs / 1000;
  if (seconds < 10) {
    return `${seconds.toFixed(1)}s`;
  }

  return `${Math.round(seconds)}s`;
}

export default function AiStreamPanel({
  title,
  subtitle,
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
  const statusLabel = isLoading ? "生成中" : hasContent ? "回答完成" : "等待生成";
  const statusToneClass = isLoading
    ? "border-[var(--lc-info)]/28 bg-[var(--lc-info)]/8 text-[var(--lc-info)]"
    : hasContent
      ? "border-[var(--lc-success)]/28 bg-[var(--lc-success)]/8 text-[var(--lc-success)]"
      : "border-[var(--lc-border)] bg-[var(--lc-surface)] text-[var(--lc-text-muted)]";
  const thinkingHeightClass = isThinkingExpanded ? "max-h-[20rem]" : "max-h-32";
  const thinkingDurationText = phaseStatus ? `${Math.max(1, Math.round(phaseStatus.elapsedMs / 1000))}s` : "";
  const compactStageText = phaseStatus?.message?.trim() ?? "";
  const answerSectionClass = shouldRenderThinkingPanel ? "pt-3" : "";

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
      className="rounded-[28px] border px-5 py-4 shadow-[0_14px_40px_rgba(15,23,42,0.05)]"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in oklab, var(--lc-surface) 97%, white), color-mix(in oklab, var(--lc-surface-soft) 98%, white))"
      }}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f2f0ff,#eef4ff)] shadow-[0_6px_16px_rgba(99,102,241,0.12)]">
                <span className="text-base text-[#7c6cff]">✦</span>
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[17px] font-semibold tracking-[-0.02em] text-[#6e63ff]">leetPro</span>
                  {compactStageText ? (
                    <span className="truncate text-xs text-[var(--lc-text-muted)]">
                      {compactStageText}
                      {isLoading ? ` · ${formatElapsedMs(phaseStatus?.elapsedMs ?? 0)}` : ""}
                    </span>
                  ) : null}
                </div>
                {title ? <p className="mt-0.5 text-xs font-medium text-[var(--lc-text-muted)]">{title}</p> : null}
                {subtitle ? <p className="mt-0.5 text-xs leading-5 text-[var(--lc-text-muted)]">{subtitle}</p> : null}
              </div>
            </div>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusToneClass}`}>{statusLabel}</span>
        </div>

        <section className="rounded-[22px] border border-[var(--lc-border)] bg-[var(--lc-surface)] px-4 py-4">
          {shouldRenderThinkingPanel ? (
            <div className="mb-3 rounded-[16px] border border-[#ddd8ff] bg-[linear-gradient(180deg,rgba(124,108,255,0.08),rgba(124,108,255,0.025))] px-3 py-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[linear-gradient(180deg,#f7f7f8,#efefef)] px-3.5 py-2 text-xs font-semibold text-[var(--lc-text)] shadow-[0_8px_18px_rgba(15,23,42,0.05)] transition-colors hover:bg-[var(--lc-border)]/60"
                  onClick={() => onThinkingCollapsedChange(!isThinkingCollapsed)}
                >
                  <span>{`思考${thinkingDurationText ? ` ${thinkingDurationText}` : ""}`}</span>
                  <span className={`inline-block text-xs transition-transform ${isThinkingCollapsed ? "-rotate-90" : "rotate-0"}`}>⌃</span>
                </button>
                <span className="rounded-full border border-[#d8d1ff] bg-white/70 px-2.5 py-1.5 text-[11px] font-medium text-[#6e63ff]">
                  推理摘要
                </span>
                <button
                  type="button"
                  className="rounded-full border border-[var(--lc-border)] px-2.5 py-1.5 text-[11px] text-[var(--lc-text-muted)] transition-colors hover:bg-[var(--lc-surface-soft)]"
                  onClick={() => onThinkingExpandedChange(!isThinkingExpanded)}
                  disabled={isThinkingCollapsed}
                >
                  {isThinkingExpanded ? "标准视图" : "放大"}
                </button>
              </div>

              {!isThinkingCollapsed ? (
                <div
                  ref={thinkingViewportRef}
                  className={`mt-3 overflow-y-auto rounded-[14px] border border-white/70 bg-white/45 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] transition-[max-height] duration-200 ${thinkingHeightClass}`}
                >
                  <div className="lc-markdown lc-ai-markdown text-[13px] leading-7 text-[var(--lc-text-muted)]">
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

          <div className={answerSectionClass}>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--lc-success)]" />
              <span className="text-sm font-semibold text-[var(--lc-text)]">正式回答</span>
              {isLoading ? <span className="text-xs text-[var(--lc-text-muted)]">持续生成中</span> : null}
            </div>
            {hasContent ? (
              <div ref={answerViewportRef} className="max-h-[40rem] overflow-y-auto">
                <div className="lc-markdown lc-ai-markdown text-sm leading-8 text-[var(--lc-text)] [&>p:first-of-type]:text-[18px] [&>p:first-of-type]:font-semibold [&>p:first-of-type]:leading-10 [&>p:first-of-type]:tracking-[-0.015em]">
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
