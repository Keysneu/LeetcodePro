"use client";

import { useEffect, useMemo, useState } from "react";
import { buildCharDiffSegments, DiffSegment } from "@/lib/char-diff";
import { normalizeDisplayText } from "@/lib/output-display";

type SubmissionStatus = "QUEUED" | "RUNNING" | "AC" | "WA" | "TLE" | "RE" | "CE";

export type SubmissionFailureCase = {
  status: SubmissionStatus;
  isHidden: boolean;
  inputData: string;
  actualOutput: string | null;
  expectedOutput: string;
  stderr: string | null;
};

type Props = {
  failureCase: SubmissionFailureCase;
};

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

function failureStatusClass(status: SubmissionStatus): string {
  if (status === "WA" || status === "RE" || status === "CE" || status === "TLE") {
    return "lc-status-fail";
  }
  return "lc-status-ac";
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

export default function SubmissionFailureCasePanel({ failureCase }: Props) {
  const [showHiddenCase, setShowHiddenCase] = useState(false);
  const actualText = normalizeDisplayText(failureCase.actualOutput ?? inferActualOutputFromStderr(failureCase.stderr) ?? "");
  const expectedText = normalizeDisplayText(failureCase.expectedOutput ?? "");

  const diff = useMemo(() => buildCharDiffSegments(actualText, expectedText), [actualText, expectedText]);

  useEffect(() => {
    setShowHiddenCase(false);
  }, [failureCase.isHidden, failureCase.inputData, failureCase.expectedOutput, failureCase.actualOutput, failureCase.stderr, failureCase.status]);

  if (failureCase.isHidden && !showHiddenCase) {
    return (
      <div className="mt-3 space-y-2 rounded-lg border bg-[var(--lc-surface)] p-3 text-xs">
        <p className="text-[var(--lc-text-muted)]">失败样例来自隐藏用例，默认不展示详细内容。</p>
        <button type="button" className="lc-btn-secondary h-8 px-3 text-xs" onClick={() => setShowHiddenCase(true)}>
          展开查看失败样例
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border bg-[var(--lc-surface)] p-3 text-xs">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-[var(--lc-text)]">失败样例</span>
        <span className={`lc-badge border ${failureStatusClass(failureCase.status)}`}>{failureCase.status}</span>
        {failureCase.isHidden ? <span className="lc-badge border">隐藏用例</span> : <span className="lc-badge border">公开用例</span>}
      </div>

      <div>
        <p className="mb-1 text-[var(--lc-text-muted)]">输入</p>
        <pre className="max-h-[180px] overflow-auto whitespace-pre-wrap break-all rounded border border-[var(--lc-border)] bg-[var(--lc-surface)] p-2 text-xs leading-6 text-[var(--lc-text)]">
          {normalizeDisplayText(failureCase.inputData) || "(空)"}
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

      {failureCase.stderr ? (
        <div>
          <p className="mb-1 text-[var(--lc-text-muted)]">错误信息</p>
          <pre className="max-h-[180px] overflow-auto whitespace-pre-wrap break-all rounded border border-[var(--lc-border)] bg-[var(--lc-surface)] p-2 text-xs leading-6 text-[var(--lc-danger)]">
            {failureCase.stderr}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
