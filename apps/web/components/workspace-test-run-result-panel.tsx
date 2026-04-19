"use client";

import { buildCharDiffSegments, type DiffSegment } from "@/lib/char-diff";
import { normalizeDisplayText } from "@/lib/output-display";

type SubmissionStatus = "QUEUED" | "RUNNING" | "AC" | "WA" | "TLE" | "RE" | "CE";

export type WorkspaceTestRunCaseResult = {
  caseId: string;
  title: string;
  inputData: string;
  expectedOutput: string;
  status: SubmissionStatus;
  runtimeMs: number | null;
  memoryKb: number | null;
  stderr: string | null;
  actualOutput: string | null;
};

export type WorkspaceTestRunResult = {
  problemSlug: string;
  language: "cpp" | "python";
  mode: "core" | "acm";
  status: SubmissionStatus;
  runtimeMs: number | null;
  memoryKb: number | null;
  passedCount: number;
  totalCount: number;
  errorMessage: string | null;
  executedAt: string;
  caseResults: WorkspaceTestRunCaseResult[];
};

type Props = {
  result: WorkspaceTestRunResult;
  errorMessage?: string | null;
};

function statusClass(status: SubmissionStatus): string {
  if (status === "AC") {
    return "lc-status-ac";
  }
  if (status === "QUEUED" || status === "RUNNING") {
    return "lc-status-pending";
  }
  return "lc-status-fail";
}

function inferActualOutputFromStderr(stderr: string | null): string | null {
  if (!stderr) {
    return null;
  }

  const trimmed = stderr.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const matched = trimmed.match(/^Expected\s+([\s\S]*?),\s+got\s+([\s\S]*)$/);
  if (!matched) {
    return null;
  }

  const got = matched[2]?.trim() ?? "";
  return got.length > 0 ? got : null;
}

function DiffText({ segments }: { segments: DiffSegment[] }) {
  return (
    <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap break-all rounded border border-[var(--lc-border)] bg-[var(--lc-surface)] p-2 text-xs leading-6">
      {segments.map((segment, index) => (
        <span key={`${segment.isMatch ? "m" : "d"}-${index}`} className={segment.isMatch ? "text-[var(--lc-success)]" : "text-[var(--lc-danger)]"}>
          {segment.text}
        </span>
      ))}
    </pre>
  );
}

function TestRunCaseCard({ item, index }: { item: WorkspaceTestRunCaseResult; index: number }) {
  const actualText = normalizeDisplayText(item.actualOutput ?? inferActualOutputFromStderr(item.stderr) ?? "");
  const expectedText = normalizeDisplayText(item.expectedOutput ?? "");
  const diff = buildCharDiffSegments(actualText, expectedText);

  return (
    <div className="space-y-3 rounded-xl border bg-[var(--lc-surface)] p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-[var(--lc-text)]">
          {index + 1}. {item.title}
        </span>
        <span className={`rounded border px-2 py-0.5 font-semibold ${statusClass(item.status)}`}>{item.status}</span>
        <span className="rounded border bg-[var(--lc-surface-soft)] px-2 py-0.5 text-[var(--lc-text-muted)]">
          {item.runtimeMs ?? "-"} ms
        </span>
        <span className="rounded border bg-[var(--lc-surface-soft)] px-2 py-0.5 text-[var(--lc-text-muted)]">
          {item.memoryKb ?? "-"} KB
        </span>
      </div>

      <div>
        <p className="mb-1 text-[var(--lc-text-muted)]">输入</p>
        <pre className="max-h-[180px] overflow-auto whitespace-pre-wrap break-all rounded border border-[var(--lc-border)] bg-[var(--lc-surface-soft)] p-2 text-xs leading-6 text-[var(--lc-text)]">
          {normalizeDisplayText(item.inputData) || "(空)"}
        </pre>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <p className="mb-1 text-[var(--lc-text-muted)]">你的输出</p>
          <DiffText segments={diff.left} />
        </div>
        <div>
          <p className="mb-1 text-[var(--lc-text-muted)]">期望输出</p>
          <DiffText segments={diff.right} />
        </div>
      </div>

      {item.stderr ? (
        <div>
          <p className="mb-1 text-[var(--lc-text-muted)]">错误信息</p>
          <pre className="max-h-[180px] overflow-auto whitespace-pre-wrap break-all rounded border border-[var(--lc-border)] bg-[var(--lc-surface-soft)] p-2 text-xs leading-6 text-[var(--lc-danger)]">
            {item.stderr}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

export default function WorkspaceTestRunResultPanel({ result, errorMessage }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded border border-[var(--lc-border)] bg-[var(--lc-surface-soft)] px-2 py-0.5 font-semibold text-[var(--lc-text)]">
          运行测试
        </span>
        <span className={`rounded border px-2 py-0.5 font-semibold ${statusClass(result.status)}`}>{result.status}</span>
        <span className="rounded border bg-[var(--lc-surface-soft)] px-2 py-0.5 text-[var(--lc-text-muted)]">
          运行时间 {result.runtimeMs ?? "-"} ms
        </span>
        <span className="rounded border bg-[var(--lc-surface-soft)] px-2 py-0.5 text-[var(--lc-text-muted)]">
          内存 {result.memoryKb ?? "-"} KB
        </span>
        <span className="rounded border bg-[var(--lc-surface-soft)] px-2 py-0.5 text-[var(--lc-text-muted)]">
          通过 {result.passedCount} / {result.totalCount}
        </span>
      </div>

      {result.errorMessage ? (
        <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap break-all rounded border border-[var(--lc-border)] bg-[var(--lc-surface-soft)] p-2 text-xs leading-6 text-[var(--lc-danger)]">
          {result.errorMessage}
        </pre>
      ) : null}

      {errorMessage ? <p className="text-sm text-[var(--lc-danger)]">{errorMessage}</p> : null}

      <div className="space-y-3">
        {result.caseResults.map((item, index) => (
          <TestRunCaseCard key={item.caseId} item={item} index={index} />
        ))}
      </div>
    </div>
  );
}
