"use client";

type AnalysisTab = "cases" | "results";

type Props = {
  activeTab: AnalysisTab;
  onChange: (tab: AnalysisTab) => void;
};

function tabClass(isActive: boolean): string {
  return [
    "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition",
    isActive ? "bg-[var(--lc-surface-soft)] text-[var(--lc-text)]" : "text-[var(--lc-text-muted)] hover:text-[var(--lc-text)]"
  ].join(" ");
}

function iconClass(isActive: boolean): string {
  return [
    "inline-flex h-[18px] w-[18px] items-center justify-center rounded border text-[10px] font-bold",
    isActive
      ? "border-[var(--lc-success)] text-[var(--lc-success)]"
      : "border-[color-mix(in_oklab,var(--lc-success)_45%,transparent)] text-[color-mix(in_oklab,var(--lc-success)_68%,transparent)]"
  ].join(" ");
}

export default function WorkspaceAnalysisTabs({ activeTab, onChange }: Props) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto">
      <button type="button" className={tabClass(activeTab === "cases")} onClick={() => onChange("cases")}>
        <span className={iconClass(activeTab === "cases")}>✓</span>
        <span>测试用例</span>
      </button>
      <span className="text-[var(--lc-border-soft)]">|</span>
      <button type="button" className={tabClass(activeTab === "results")} onClick={() => onChange("results")}>
        <span className={iconClass(activeTab === "results")}>›</span>
        <span>测试结果</span>
      </button>
    </div>
  );
}
