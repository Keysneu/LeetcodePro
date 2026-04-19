"use client";

import { useEffect, useMemo, useState } from "react";
import type { EditorMode } from "@/components/code-editor";
import { normalizeDisplayText } from "@/lib/output-display";

type Props = {
  problemSlug: string;
  mode: EditorMode;
  sampleInput: string;
  sampleOutput: string;
  onCasesChange?: (cases: WorkspaceTestCase[]) => void;
};

export type WorkspaceTestCase = {
  id: string;
  title: string;
  input: string;
  output: string;
};

type NamedInputBlock = {
  label: string;
  value: string;
};

const STORAGE_VERSION = "v1";

function createCaseId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `case-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createDefaultCase(sampleInput: string, sampleOutput: string): WorkspaceTestCase {
  return {
    id: createCaseId(),
    title: "Case 1",
    input: normalizeDisplayText(sampleInput),
    output: normalizeDisplayText(sampleOutput)
  };
}

function buildStorageKey(problemSlug: string, mode: EditorMode): string {
  return `leetcodepro.workspace.test-cases.${STORAGE_VERSION}:${problemSlug}:${mode}`;
}

function splitTopLevelSegments(raw: string): string[] {
  const segments: string[] = [];
  let current = "";
  let roundDepth = 0;
  let squareDepth = 0;
  let curlyDepth = 0;
  let activeQuote: "\"" | "'" | null = null;
  let escaped = false;

  for (const char of raw) {
    current += char;

    if (activeQuote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === activeQuote) {
        activeQuote = null;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      activeQuote = char;
      continue;
    }

    if (char === "(") {
      roundDepth += 1;
      continue;
    }
    if (char === ")") {
      roundDepth = Math.max(0, roundDepth - 1);
      continue;
    }
    if (char === "[") {
      squareDepth += 1;
      continue;
    }
    if (char === "]") {
      squareDepth = Math.max(0, squareDepth - 1);
      continue;
    }
    if (char === "{") {
      curlyDepth += 1;
      continue;
    }
    if (char === "}") {
      curlyDepth = Math.max(0, curlyDepth - 1);
      continue;
    }

    if (char === "," && roundDepth === 0 && squareDepth === 0 && curlyDepth === 0) {
      segments.push(current.slice(0, -1).trim());
      current = "";
    }
  }

  const tail = current.trim();
  if (tail.length > 0) {
    segments.push(tail);
  }

  return segments.filter((segment) => segment.length > 0);
}

function parseNamedInputBlocks(raw: string): NamedInputBlock[] | null {
  const normalized = raw.trim();
  if (!normalized.includes("=")) {
    return null;
  }

  const lineCandidates = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const segments = lineCandidates.length > 1 ? lineCandidates : splitTopLevelSegments(normalized);

  const blocks = segments
    .map((segment) => {
      const separatorIndex = segment.indexOf("=");
      if (separatorIndex <= 0) {
        return null;
      }

      const label = segment.slice(0, separatorIndex).trim();
      const value = segment.slice(separatorIndex + 1).trim();
      if (label.length === 0) {
        return null;
      }

      return {
        label,
        value
      };
    })
    .filter((item): item is NamedInputBlock => item !== null);

  if (blocks.length !== segments.length || blocks.length === 0) {
    return null;
  }

  return blocks;
}

function serializeNamedInputBlocks(blocks: NamedInputBlock[]): string {
  return blocks.map((block) => `${block.label} = ${block.value}`).join(", ");
}

function TestCaseField({
  label,
  value,
  rows,
  minHeightClass,
  onChange
}: {
  label: string;
  value: string;
  rows: number;
  minHeightClass: string;
  onChange: (nextValue: string) => void;
}) {
  const isSingleLine = !value.includes("\n") && rows <= 2;

  return (
    <div className="rounded-lg border bg-[var(--lc-surface-soft)]/55 p-2.5">
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--lc-text-muted)]">{label}</label>
      {isSingleLine ? (
        <input
          className="h-10 w-full rounded-md border border-transparent bg-[var(--lc-surface)]/46 px-3 font-mono text-sm text-[var(--lc-text)] outline-none transition focus:border-[var(--lc-accent)]"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <textarea
          rows={rows}
          className={`w-full resize-none rounded-md border border-transparent bg-[var(--lc-surface)]/46 px-3 py-2 font-mono text-sm text-[var(--lc-text)] outline-none transition focus:border-[var(--lc-accent)] ${minHeightClass}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

function readStoredCases(storageKey: string, sampleInput: string, sampleOutput: string): WorkspaceTestCase[] {
  if (typeof window === "undefined") {
    return [createDefaultCase(sampleInput, sampleOutput)];
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return [createDefaultCase(sampleInput, sampleOutput)];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [createDefaultCase(sampleInput, sampleOutput)];
    }

    const restored = parsed
      .map((item, index) => {
        if (typeof item !== "object" || item === null) {
          return null;
        }

        const record = item as Record<string, unknown>;
        const input = typeof record.input === "string" ? normalizeDisplayText(record.input) : "";
        const output = typeof record.output === "string" ? normalizeDisplayText(record.output) : "";
        const title = typeof record.title === "string" && record.title.trim().length > 0 ? record.title.trim() : `Case ${index + 1}`;

        return {
          id: typeof record.id === "string" && record.id.trim().length > 0 ? record.id : createCaseId(),
          title,
          input,
          output
        };
      })
      .filter((item): item is WorkspaceTestCase => item !== null);

    return restored.length > 0 ? restored : [createDefaultCase(sampleInput, sampleOutput)];
  } catch {
    return [createDefaultCase(sampleInput, sampleOutput)];
  }
}

export default function WorkspaceTestCasePanel({ problemSlug, mode, sampleInput, sampleOutput, onCasesChange }: Props) {
  const storageKey = useMemo(() => buildStorageKey(problemSlug, mode), [mode, problemSlug]);
  const [cases, setCases] = useState<WorkspaceTestCase[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);

  useEffect(() => {
    const restoredCases = readStoredCases(storageKey, sampleInput, sampleOutput);
    setCases(restoredCases);
    setActiveCaseId(restoredCases[0]?.id ?? null);
  }, [sampleInput, sampleOutput, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || cases.length === 0) {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(cases));
  }, [cases, storageKey]);

  useEffect(() => {
    onCasesChange?.(cases);
  }, [cases, onCasesChange]);

  useEffect(() => {
    if (cases.length === 0) {
      setActiveCaseId(null);
      return;
    }

    if (!cases.some((item) => item.id === activeCaseId)) {
      setActiveCaseId(cases[0].id);
    }
  }, [activeCaseId, cases]);

  const activeCase = cases.find((item) => item.id === activeCaseId) ?? cases[0] ?? null;
  const namedInputBlocks = useMemo(() => parseNamedInputBlocks(activeCase?.input ?? ""), [activeCase?.input]);

  const updateActiveCase = (patch: Partial<WorkspaceTestCase>) => {
    if (!activeCase) {
      return;
    }

    setCases((previous) =>
      previous.map((item) =>
        item.id === activeCase.id
          ? {
              ...item,
              ...patch
            }
          : item
      )
    );
  };

  const addCase = () => {
    const nextCase: WorkspaceTestCase = {
      id: createCaseId(),
      title: `Case ${cases.length + 1}`,
      input: activeCase?.input ?? normalizeDisplayText(sampleInput),
      output: activeCase?.output ?? normalizeDisplayText(sampleOutput)
    };

    setCases((previous) => [...previous, nextCase]);
    setActiveCaseId(nextCase.id);
  };

  const removeActiveCase = () => {
    if (!activeCase || cases.length <= 1) {
      return;
    }

    const currentIndex = cases.findIndex((item) => item.id === activeCase.id);
    const nextCases = cases.filter((item) => item.id !== activeCase.id);
    setCases(nextCases);
    const fallbackIndex = Math.max(0, currentIndex - 1);
    setActiveCaseId(nextCases[fallbackIndex]?.id ?? nextCases[0]?.id ?? null);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {cases.map((item) => {
            const isActive = item.id === activeCase?.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-[var(--lc-surface-soft)] text-[var(--lc-text)] shadow-[inset_0_0_0_1px_var(--lc-border)]"
                    : "text-[var(--lc-text-muted)] hover:bg-[var(--lc-surface-soft)] hover:text-[var(--lc-text)]"
                }`}
                onClick={() => setActiveCaseId(item.id)}
              >
                {item.title}
              </button>
            );
          })}
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-2xl text-[var(--lc-text-muted)] transition hover:bg-[var(--lc-surface-soft)] hover:text-[var(--lc-text)]"
            onClick={addCase}
            aria-label="添加测试用例"
            title="添加测试用例"
          >
            +
          </button>
        </div>

        {cases.length > 1 ? (
          <button type="button" className="lc-btn-secondary h-8 px-3 text-xs" onClick={removeActiveCase}>
            删除当前用例
          </button>
        ) : null}
      </div>

      {activeCase ? (
        <div className="grid gap-2.5 lg:grid-cols-2">
          {namedInputBlocks ? (
            namedInputBlocks.map((block, index) => (
              <TestCaseField
                key={`${block.label}-${index}`}
                label={`${block.label} =`}
                value={block.value}
                rows={Math.max(1, Math.min(3, block.value.split(/\r?\n/).length))}
                minHeightClass="min-h-[48px]"
                onChange={(nextValue) => {
                  if (!activeCase) {
                    return;
                  }

                  const nextBlocks = namedInputBlocks.map((item, itemIndex) =>
                    itemIndex === index
                      ? {
                          ...item,
                          value: nextValue
                        }
                      : item
                  );
                  updateActiveCase({ input: serializeNamedInputBlocks(nextBlocks) });
                }}
              />
            ))
          ) : (
            <TestCaseField
              label={mode === "acm" ? "标准输入" : "输入"}
              value={activeCase.input}
              rows={Math.max(1, Math.min(4, (activeCase.input || "").split(/\r?\n/).length))}
              minHeightClass="min-h-[64px]"
              onChange={(nextValue) => updateActiveCase({ input: nextValue })}
            />
          )}

          <TestCaseField
            label="期望输出"
            value={activeCase.output}
            rows={Math.max(1, Math.min(3, (activeCase.output || "").split(/\r?\n/).length))}
            minHeightClass="min-h-[52px]"
            onChange={(nextValue) => updateActiveCase({ output: nextValue })}
          />
        </div>
      ) : null}
    </div>
  );
}
