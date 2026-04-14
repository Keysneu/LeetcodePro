import Link from "next/link";
import ProblemKnowledgeTags from "@/components/problem-knowledge-tags";
import { HOT100_TITLE_ZH_BY_ID } from "@/lib/hot100-title-zh";

type ProblemListItem = {
  leetcodeId: number | null;
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string[];
  masterySummary?: ProblemMasterySummary | null;
};

type ProblemListResponse = {
  items: ProblemListItem[];
};

type ProblemListResult = {
  items: ProblemListItem[];
  error: string | null;
};

type ProblemGroup = {
  type: string;
  items: ProblemListItem[];
};

type SubmissionStatus = "QUEUED" | "RUNNING" | "AC" | "WA" | "TLE" | "RE" | "CE";
type MasterySummaryStatus = "UNTOUCHED" | "ATTEMPTING" | "SOLVED_ONCE" | "SOLVED_TWICE" | "SOLVED_MANY";

type ProblemMasterySummary = {
  overallStatus: MasterySummaryStatus;
  isSolved: boolean;
  totalAttempts: number;
  attemptsToFirstAc: number | null;
  latestStatus: SubmissionStatus | null;
};

const DEFAULT_MASTERY_SUMMARY: ProblemMasterySummary = {
  overallStatus: "UNTOUCHED",
  isSolved: false,
  totalAttempts: 0,
  attemptsToFirstAc: null,
  latestStatus: null
};

async function getProblems(): Promise<ProblemListResult> {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

  try {
    const response = await fetch(`${apiBaseUrl}/api/problems`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Failed to load problems: ${response.status}`);
    }

    const payload = (await response.json()) as ProblemListResponse;
    if (!Array.isArray(payload.items)) {
      throw new Error("Invalid problem list payload.");
    }

    return {
      items: payload.items,
      error: null
    };
  } catch {
    return {
      items: [],
      error: "题库加载失败。请先确认 API 服务正常，并已执行 db:migrate + db:seed。"
    };
  }
}

function difficultyClass(difficulty: ProblemListItem["difficulty"]): string {
  if (difficulty === "Easy") {
    return "text-[var(--lc-success)]";
  }
  if (difficulty === "Medium") {
    return "text-[var(--lc-accent)]";
  }
  return "text-[var(--lc-danger)]";
}

function difficultyLabel(difficulty: ProblemListItem["difficulty"]): string {
  if (difficulty === "Easy") {
    return "简单";
  }
  if (difficulty === "Medium") {
    return "中等";
  }
  return "困难";
}

function difficultyRank(difficulty: ProblemListItem["difficulty"]): number {
  if (difficulty === "Easy") {
    return 0;
  }
  if (difficulty === "Medium") {
    return 1;
  }
  return 2;
}

function resolveProblemTitle(problem: ProblemListItem): string {
  if (problem.leetcodeId && HOT100_TITLE_ZH_BY_ID[problem.leetcodeId]) {
    return HOT100_TITLE_ZH_BY_ID[problem.leetcodeId];
  }
  return problem.title;
}

function getPrimaryType(tags: string[]): string {
  for (const tag of tags) {
    const normalizedTag = tag.trim();
    if (normalizedTag.length > 0) {
      return normalizedTag;
    }
  }
  return "未分类";
}

function groupAndSortProblems(problems: ProblemListItem[]): ProblemGroup[] {
  const groupedMap = new Map<string, ProblemListItem[]>();

  for (const problem of problems) {
    const groupKey = getPrimaryType(problem.tags);
    const list = groupedMap.get(groupKey);
    if (list) {
      list.push(problem);
      continue;
    }
    groupedMap.set(groupKey, [problem]);
  }

  for (const list of groupedMap.values()) {
    list.sort((left, right) => {
      const difficultyDiff = difficultyRank(left.difficulty) - difficultyRank(right.difficulty);
      if (difficultyDiff !== 0) {
        return difficultyDiff;
      }

      const leftLeetcodeId = left.leetcodeId ?? Number.MAX_SAFE_INTEGER;
      const rightLeetcodeId = right.leetcodeId ?? Number.MAX_SAFE_INTEGER;
      if (leftLeetcodeId !== rightLeetcodeId) {
        return leftLeetcodeId - rightLeetcodeId;
      }

      return resolveProblemTitle(left).localeCompare(resolveProblemTitle(right), "zh-Hans-CN");
    });
  }

  return [...groupedMap.entries()]
    .sort((left, right) => left[0].localeCompare(right[0], "zh-Hans-CN"))
    .map(([type, items]) => ({ type, items }));
}

function acceptanceRate(problem: ProblemListItem, index: number): string {
  const seed = problem.leetcodeId ?? index + 1;
  const base = 61 + (seed % 7) * 3;
  return `${base}%`;
}

function resolveMasterySummary(problem: ProblemListItem): ProblemMasterySummary {
  if (!problem.masterySummary) {
    return DEFAULT_MASTERY_SUMMARY;
  }
  return problem.masterySummary;
}

function masteryStatusLabel(status: MasterySummaryStatus): string {
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
  return "多次过";
}

function masteryStatusClass(status: MasterySummaryStatus): string {
  if (status === "UNTOUCHED") {
    return "border-[var(--lc-border-soft)] bg-transparent text-[var(--lc-text-muted)]";
  }

  if (status === "ATTEMPTING") {
    return "lc-status-pending";
  }

  return "lc-status-ac";
}

export default async function ProblemsPage() {
  const { items: problems, error } = await getProblems();
  const groupedProblems = groupAndSortProblems(problems);

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--lc-text)]">题库</h1>
        <p className="mt-1 text-sm text-[var(--lc-text-muted)]">按 LeetCode 风格展示题单，点击任意题目进入做题工作区。</p>
      </div>

      <div className="lc-card overflow-hidden">
        <div className="flex items-center justify-between border-b bg-[var(--lc-surface-soft)] px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs text-[var(--lc-text-muted)]">
            <span className="lc-badge border bg-[var(--lc-surface)]">{problems.length} 题</span>
            <span>Hot 100 · 全量题单</span>
          </div>
          <div className="hidden text-xs text-[var(--lc-text-muted)] md:block">按题型分组（组内按难度）</div>
        </div>

        <div className="grid grid-cols-[106px_minmax(0,1fr)_90px] items-center border-b px-4 py-2 text-xs uppercase tracking-wide text-[var(--lc-text-muted)] md:grid-cols-[160px_minmax(0,1fr)_110px_110px_280px]">
          <span>状态</span>
          <span>标题</span>
          <span>难度</span>
          <span className="hidden md:block">通过率</span>
          <span className="hidden md:block">知识点</span>
        </div>

        <div>
          {error ? (
            <p className="border-b px-4 py-2.5 text-xs text-[var(--lc-danger)]">{error}</p>
          ) : null}
          {groupedProblems.map((group) => (
            <div key={group.type} className="border-b last:border-b-0">
              <div className="flex items-center justify-between border-b bg-[var(--lc-surface-soft)]/70 px-4 py-2 text-xs text-[var(--lc-text-muted)]">
                <span className="font-medium text-[var(--lc-text)]">{group.type}</span>
                <span>{group.items.length} 题</span>
              </div>
              {group.items.map((problem, index) => {
                const masterySummary = resolveMasterySummary(problem);
                return (
                  <Link
                    key={problem.slug}
                    href={`/problems/${problem.slug}`}
                    className="grid grid-cols-[106px_minmax(0,1fr)_90px] items-center border-b px-4 py-3 text-sm transition hover:bg-[var(--lc-row-hover)] last:border-b-0 md:grid-cols-[160px_minmax(0,1fr)_110px_110px_280px]"
                  >
                    <span className="inline-flex flex-col items-start gap-1">
                      <span className={`lc-badge border ${masteryStatusClass(masterySummary.overallStatus)}`}>
                        {masteryStatusLabel(masterySummary.overallStatus)}
                      </span>
                      <span className="hidden text-[11px] text-[var(--lc-text-muted)] md:block">
                        最近: {masterySummary.latestStatus ?? "-"}
                      </span>
                    </span>
                    <span className="truncate text-[var(--lc-text)]">
                      {problem.leetcodeId ? `${problem.leetcodeId}. ` : ""}
                      {resolveProblemTitle(problem)}
                    </span>
                    <span className={`font-medium ${difficultyClass(problem.difficulty)}`}>{difficultyLabel(problem.difficulty)}</span>
                    <span className="hidden text-xs text-[var(--lc-text-muted)] md:block">{acceptanceRate(problem, index)}</span>
                    <ProblemKnowledgeTags tags={problem.tags} className="hidden md:flex" />
                  </Link>
                );
              })}
            </div>
          ))}
          {!error && problems.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[var(--lc-text-muted)]">当前题库为空，请先执行 `npm run db:seed -w @leetcodepro/api`。</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
