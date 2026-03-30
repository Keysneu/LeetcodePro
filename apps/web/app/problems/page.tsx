import Link from "next/link";
import { HOT100_TITLE_ZH_BY_ID } from "@/lib/hot100-title-zh";

type ProblemListItem = {
  leetcodeId: number | null;
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
};

type ProblemListResponse = {
  items: ProblemListItem[];
};

type ProblemListResult = {
  items: ProblemListItem[];
  error: string | null;
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

function acceptanceRate(index: number): string {
  const base = 61 + (index % 7) * 3;
  return `${base}%`;
}

export default async function ProblemsPage() {
  const { items: problems, error } = await getProblems();

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
          <div className="hidden text-xs text-[var(--lc-text-muted)] md:block">按题号排序</div>
        </div>

        <div className="grid grid-cols-[42px_minmax(0,1fr)_90px] items-center border-b px-4 py-2 text-xs uppercase tracking-wide text-[var(--lc-text-muted)] md:grid-cols-[56px_minmax(0,1fr)_110px_110px_170px]">
          <span>状态</span>
          <span>标题</span>
          <span>难度</span>
          <span className="hidden md:block">通过率</span>
          <span className="hidden md:block">题目标识</span>
        </div>

        <div>
          {error ? (
            <p className="border-b px-4 py-2.5 text-xs text-[var(--lc-danger)]">{error}</p>
          ) : null}
          {problems.map((problem, index) => (
            <Link
              key={problem.slug}
              href={`/problems/${problem.slug}`}
              className="grid grid-cols-[42px_minmax(0,1fr)_90px] items-center border-b px-4 py-3 text-sm transition hover:bg-[var(--lc-row-hover)] last:border-b-0 md:grid-cols-[56px_minmax(0,1fr)_110px_110px_170px]"
            >
              <span className="inline-flex items-center justify-start">
                <span className="inline-block h-2 w-2 rounded-full border border-[var(--lc-border-soft)] bg-transparent" />
              </span>
              <span className="truncate text-[var(--lc-text)]">
                {problem.leetcodeId ? `${problem.leetcodeId}. ` : ""}
                {problem.leetcodeId && HOT100_TITLE_ZH_BY_ID[problem.leetcodeId] ? HOT100_TITLE_ZH_BY_ID[problem.leetcodeId] : problem.title}
              </span>
              <span className={`font-medium ${difficultyClass(problem.difficulty)}`}>{difficultyLabel(problem.difficulty)}</span>
              <span className="hidden text-xs text-[var(--lc-text-muted)] md:block">{acceptanceRate(index)}</span>
              <span className="hidden truncate font-mono text-xs text-[var(--lc-text-muted)] md:block">{problem.slug}</span>
            </Link>
          ))}
          {!error && problems.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[var(--lc-text-muted)]">当前题库为空，请先执行 `npm run db:seed -w @leetcodepro/api`。</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
