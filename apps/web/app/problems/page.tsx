import Link from "next/link";
import ProblemKnowledgeTags from "@/components/problem-knowledge-tags";
import ProblemSearchBox from "@/components/problem-search-box";
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

type Props = {
  searchParams?: Promise<{ q?: string | string[] }>;
};

type SubmissionStatus = "QUEUED" | "RUNNING" | "AC" | "WA" | "TLE" | "RE" | "CE";
type MasterySummaryStatus = "UNTOUCHED" | "LEARNING" | "REINFORCING" | "MASTERED" | "REVIEW_DUE";

type ProblemMasterySummary = {
  overallStatus: MasterySummaryStatus;
  isSolved: boolean;
  totalAttempts: number;
  latestStatus: SubmissionStatus | null;
  dueModes: Array<"core" | "acm">;
  consecutiveAc: number;
  reviewIntervalDays: number | null;
  nextReviewAt: string | null;
  overdueDays: number | null;
};

const DEFAULT_MASTERY_SUMMARY: ProblemMasterySummary = {
  overallStatus: "UNTOUCHED",
  isSolved: false,
  totalAttempts: 0,
  latestStatus: null,
  dueModes: [],
  consecutiveAc: 0,
  reviewIntervalDays: null,
  nextReviewAt: null,
  overdueDays: null
};

function normalizeSearchQuery(rawQuery: string | string[] | undefined): string | null {
  const query = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery;

  if (typeof query !== "string") {
    return null;
  }

  const normalized = query.trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

async function getProblems(searchQuery: string | null): Promise<ProblemListResult> {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
  const searchSuffix = searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : "";

  try {
    const response = await fetch(`${apiBaseUrl}/api/problems${searchSuffix}`, {
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
  if (status === "LEARNING") {
    return "学习中";
  }
  if (status === "REINFORCING") {
    return "巩固中";
  }
  if (status === "MASTERED") {
    return "已熟练";
  }
  return "待复习";
}

function masteryStatusClass(status: MasterySummaryStatus): string {
  if (status === "UNTOUCHED") {
    return "border-[var(--lc-border-soft)] bg-transparent text-[var(--lc-text-muted)]";
  }

  if (status === "LEARNING" || status === "REINFORCING") {
    return "lc-status-pending";
  }

  if (status === "MASTERED") {
    return "lc-status-ac";
  }

  return "lc-status-fail";
}

function dueModeLabel(mode: "core" | "acm"): string {
  return mode === "core" ? "核心" : "ACM";
}

function reviewSignal(summary: ProblemMasterySummary): string {
  if (summary.dueModes.length > 0 && summary.overdueDays !== null) {
    const modes = summary.dueModes.map((mode) => dueModeLabel(mode)).join("/");
    if (summary.overdueDays <= 0) {
      return `今天复习：${modes}`;
    }
    return `已逾期 ${summary.overdueDays} 天：${modes}`;
  }

  if (summary.nextReviewAt) {
    const nextTs = Date.parse(summary.nextReviewAt);
    if (Number.isFinite(nextTs)) {
      const diffDays = Math.ceil((nextTs - Date.now()) / (24 * 60 * 60 * 1000));
      if (diffDays <= 0) {
        return "今天复习";
      }
      return `${diffDays} 天后复习`;
    }
  }

  if (summary.overallStatus === "UNTOUCHED") {
    return "先完成首题";
  }

  return `近期连 AC：${summary.consecutiveAc}`;
}

export default async function ProblemsPage({ searchParams }: Props) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const activeQuery = normalizeSearchQuery(resolvedSearchParams?.q);
  const { items: problems, error } = await getProblems(activeQuery);
  const groupedProblems = groupAndSortProblems(problems);

  return (
    <section className="lc-page-wide lc-page-section">
      <div className="lc-page-header">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--lc-text)]">题库</h1>
        <p className="mt-1 text-sm text-[var(--lc-text-muted)]">按 LeetCode 风格展示题单，点击任意题目进入做题工作区。</p>
      </div>

      <div className="lc-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b bg-[var(--lc-surface-soft)] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--lc-text-muted)]">
              <span className="lc-badge border bg-[var(--lc-surface)]">{problems.length} 题</span>
              <span>{activeQuery ? `命中结果 · 关键词「${activeQuery}」` : "Hot 100 · 全量题单"}</span>
            </div>
            <div className="text-xs text-[var(--lc-text-muted)]">
              {activeQuery ? "支持刷新与分享搜索链接" : "桌面端保留列表密度，移动端压缩为信息卡片"}
            </div>
          </div>
          <ProblemSearchBox initialQuery={activeQuery ?? ""} />
        </div>

        <div className="hidden grid-cols-[minmax(0,1.7fr)_110px_92px_260px] items-center border-b px-4 py-2 text-xs uppercase tracking-wide text-[var(--lc-text-muted)] md:grid">
          <span>标题与状态</span>
          <span>复习信号</span>
          <span>难度</span>
          <span>知识点</span>
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
                const problemTitle = resolveProblemTitle(problem);
                return (
                  <Link
                    key={problem.slug}
                    href={`/problems/${problem.slug}`}
                    className="block border-b px-4 py-3 transition hover:bg-[var(--lc-row-hover)] last:border-b-0"
                  >
                    <div className="flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,1.7fr)_110px_92px_260px] md:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`lc-badge border ${masteryStatusClass(masterySummary.overallStatus)}`}>
                            {masteryStatusLabel(masterySummary.overallStatus)}
                          </span>
                          <span className={`text-sm font-semibold ${difficultyClass(problem.difficulty)} md:hidden`}>
                            {difficultyLabel(problem.difficulty)}
                          </span>
                          <span className="text-xs text-[var(--lc-text-muted)] md:hidden">{acceptanceRate(problem, index)}</span>
                        </div>
                        <p className="mt-2 truncate text-sm font-medium text-[var(--lc-text)] sm:text-base">
                          {problem.leetcodeId ? `${problem.leetcodeId}. ` : ""}
                          {problemTitle}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--lc-text-muted)] md:hidden">
                          <span>{reviewSignal(masterySummary)}</span>
                          <span>尝试 {masterySummary.totalAttempts}</span>
                          <span>{problem.tags.slice(0, 2).join(" / ") || "未分类"}</span>
                        </div>
                      </div>

                      <div className="hidden text-xs text-[var(--lc-text-muted)] md:block">{reviewSignal(masterySummary)}</div>
                      <div className={`hidden text-sm font-semibold md:block ${difficultyClass(problem.difficulty)}`}>
                        {difficultyLabel(problem.difficulty)}
                      </div>
                      <div className="hidden items-center justify-between gap-3 md:flex">
                        <ProblemKnowledgeTags tags={problem.tags} className="min-w-0 flex-1" />
                        <span className="shrink-0 text-xs text-[var(--lc-text-muted)]">{acceptanceRate(problem, index)}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
          {!error && problems.length === 0 ? (
            activeQuery ? (
              <div className="flex flex-col items-start gap-3 px-4 py-5 text-sm text-[var(--lc-text-muted)]">
                <p>未找到与 “{activeQuery}” 匹配的题目，请尝试更短关键词或切换题号 / slug / 标签搜索。</p>
                <Link href="/problems" className="lc-btn-secondary h-8 px-3 text-xs">
                  清空搜索
                </Link>
              </div>
            ) : (
              <p className="px-4 py-3 text-sm text-[var(--lc-text-muted)]">当前题库为空，请先执行 `npm run db:seed -w @leetcodepro/api`。</p>
            )
          ) : null}
        </div>
      </div>
    </section>
  );
}
