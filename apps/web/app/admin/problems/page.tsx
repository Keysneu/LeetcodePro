import Link from "next/link";
import {
  AdminProblemJudgeData,
  AdminProblemSummary,
  fetchAdminProblemJudgeData,
  fetchAdminProblemList
} from "@/lib/admin-api";

type Props = {
  searchParams?: Promise<{ slug?: string | string[] }>;
};

function resolveSearchSlug(searchSlug: string | string[] | undefined): string | null {
  if (typeof searchSlug === "string" && searchSlug.trim()) {
    return searchSlug.trim();
  }

  if (Array.isArray(searchSlug) && typeof searchSlug[0] === "string" && searchSlug[0].trim()) {
    return searchSlug[0].trim();
  }

  return null;
}

function difficultyClass(difficulty: AdminProblemSummary["difficulty"]): string {
  if (difficulty === "Easy") {
    return "text-[var(--lc-success)]";
  }
  if (difficulty === "Medium") {
    return "text-[var(--lc-accent)]";
  }
  return "text-[var(--lc-danger)]";
}

function difficultyLabel(difficulty: AdminProblemSummary["difficulty"]): string {
  if (difficulty === "Easy") {
    return "简单";
  }
  if (difficulty === "Medium") {
    return "中等";
  }
  return "困难";
}

function modeSupportLabel(modeSupport: AdminProblemSummary["modeSupport"]): string {
  if (modeSupport === "BOTH") {
    return "Core + ACM";
  }
  return modeSupport;
}

function safeCasePreview(content: string): string {
  const trimmed = content.trim();
  return trimmed.length > 0 ? trimmed : "(空)";
}

export default async function AdminProblemsPage({ searchParams }: Props) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedSlug = resolveSearchSlug(resolvedSearchParams?.slug);

  let problemList: AdminProblemSummary[] = [];
  let listError: string | null = null;
  try {
    const listPayload = await fetchAdminProblemList();
    problemList = listPayload.items;
  } catch (error) {
    listError = error instanceof Error ? error.message : "后台题目列表加载失败。";
  }

  const activeSlug = requestedSlug ?? problemList[0]?.slug ?? null;

  let judgeData: AdminProblemJudgeData | null = null;
  let detailError: string | null = null;
  if (!listError && activeSlug) {
    try {
      const detailPayload = await fetchAdminProblemJudgeData(activeSlug);
      judgeData = detailPayload.item;
    } catch (error) {
      detailError = error instanceof Error ? error.message : "后台判题数据加载失败。";
    }
  }

  return (
    <section className="lc-page-wide lc-page-section">
      <div className="lc-page-header">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--lc-text)]">后台 · 判题数据看板</h1>
        <p className="mt-1 text-sm text-[var(--lc-text-muted)]">
          查看每道题在判题链路中实际使用的测试数据（公开/隐藏用例、权重、输入输出样例）。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
        <div className="lc-card overflow-hidden xl:sticky xl:top-[calc(var(--lc-nav-height)+1rem)]">
          <div className="lc-card-header bg-[var(--lc-surface-soft)]">
            <span>题目列表</span>
            <span className="text-xs text-[var(--lc-text-muted)]">{problemList.length} 题</span>
          </div>
          {listError ? (
            <div className="px-4 py-3 text-sm text-[var(--lc-danger)]">{listError}</div>
          ) : (
            <div className="max-h-[min(70vh,52rem)] overflow-auto">
              {problemList.map((problem) => {
                const isActive = activeSlug === problem.slug;

                return (
                  <Link
                    key={problem.id}
                    href={`/admin/problems?slug=${problem.slug}`}
                    className="block border-b px-4 py-3 last:border-b-0 transition hover:bg-[var(--lc-row-hover)]"
                    style={isActive ? { background: "var(--lc-accent-soft)" } : undefined}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--lc-text)]">
                          {problem.leetcodeId ? `${problem.leetcodeId}. ` : ""}
                          {problem.title}
                        </p>
                        <p className="mt-1 truncate font-mono text-xs text-[var(--lc-text-muted)]">{problem.slug}</p>
                      </div>
                      <span className={`text-xs font-semibold ${difficultyClass(problem.difficulty)}`}>
                        {difficultyLabel(problem.difficulty)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-[var(--lc-text-muted)]">
                      <span className="lc-badge border">{modeSupportLabel(problem.modeSupport)}</span>
                      <span>用例 {problem.totalCases}</span>
                      <span>隐藏 {problem.hiddenCases}</span>
                    </div>
                  </Link>
                );
              })}
              {problemList.length === 0 ? (
                <p className="px-4 py-3 text-sm text-[var(--lc-text-muted)]">暂无题目数据，请先执行 seed。</p>
              ) : null}
            </div>
          )}
        </div>

        <div className="lc-card overflow-hidden">
          <div className="lc-card-header bg-[var(--lc-surface-soft)]">
            <span>判题数据详情</span>
            {judgeData ? <span className="text-xs text-[var(--lc-text-muted)]">{judgeData.slug}</span> : null}
          </div>

          {detailError ? (
            <div className="px-4 py-3 text-sm text-[var(--lc-danger)]">{detailError}</div>
          ) : null}

          {!detailError && !judgeData ? (
            <div className="px-4 py-5 text-sm text-[var(--lc-text-muted)]">请选择左侧题目查看判题数据。</div>
          ) : null}

          {judgeData ? (
            <div className="space-y-4 px-4 py-4 sm:px-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-[var(--lc-text)]">
                    {judgeData.leetcodeId ? `${judgeData.leetcodeId}. ` : ""}
                    {judgeData.title}
                  </h2>
                  <span className={`text-sm font-semibold ${difficultyClass(judgeData.difficulty)}`}>
                    {difficultyLabel(judgeData.difficulty)}
                  </span>
                  <span className="lc-badge border">{modeSupportLabel(judgeData.modeSupport)}</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-[var(--lc-text-muted)]">
                  <span className="lc-badge border">总用例 {judgeData.totalCases}</span>
                  <span className="lc-badge border">公开 {judgeData.publicCases}</span>
                  <span className="lc-badge border">隐藏 {judgeData.hiddenCases}</span>
                  <span className="lc-badge border">总权重 {judgeData.totalWeight}</span>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border bg-[var(--lc-surface-soft)] p-3">
                  <p className="text-xs text-[var(--lc-text-muted)]">输入规范</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--lc-text)]">{judgeData.inputSpec}</p>
                </div>
                <div className="rounded-lg border bg-[var(--lc-surface-soft)] p-3">
                  <p className="text-xs text-[var(--lc-text-muted)]">输出规范</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--lc-text)]">{judgeData.outputSpec}</p>
                </div>
                <div className="rounded-lg border bg-[var(--lc-surface-soft)] p-3">
                  <p className="text-xs text-[var(--lc-text-muted)]">ACM 输入规范</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--lc-text)]">{judgeData.acmInputSpec || "(无)"}</p>
                </div>
                <div className="rounded-lg border bg-[var(--lc-surface-soft)] p-3">
                  <p className="text-xs text-[var(--lc-text-muted)]">ACM 输出规范</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--lc-text)]">{judgeData.acmOutputSpec || "(无)"}</p>
                </div>
                <div className="rounded-lg border bg-[var(--lc-surface-soft)] p-3">
                  <p className="text-xs text-[var(--lc-text-muted)]">ACM 示例输入</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--lc-text)]">{judgeData.acmSampleInput || "(无)"}</p>
                </div>
                <div className="rounded-lg border bg-[var(--lc-surface-soft)] p-3">
                  <p className="text-xs text-[var(--lc-text-muted)]">ACM 示例输出</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--lc-text)]">{judgeData.acmSampleOutput || "(无)"}</p>
                </div>
              </div>

              <div className="rounded-lg border bg-[var(--lc-surface-soft)] p-3">
                <p className="text-xs text-[var(--lc-text-muted)]">判题测试用例（按创建顺序）</p>
                <div className="mt-3 space-y-3">
                  {judgeData.testCases.map((testCase, index) => (
                    <div key={testCase.id} className="rounded-md border bg-[var(--lc-surface)] p-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="lc-badge border">Case {index + 1}</span>
                        <span className="lc-badge border">权重 {testCase.weight}</span>
                        <span className={`lc-badge border ${testCase.isHidden ? "lc-status-fail" : "lc-status-ac"}`}>
                          {testCase.isHidden ? "隐藏" : "公开"}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <div>
                          <p className="text-xs text-[var(--lc-text-muted)]">Input</p>
                          <pre className="mt-1 max-h-56 overflow-auto rounded border bg-[var(--lc-page-bg)] p-2 text-xs leading-5 text-[var(--lc-text)]">
                            {safeCasePreview(testCase.inputData)}
                          </pre>
                        </div>
                        <div>
                          <p className="text-xs text-[var(--lc-text-muted)]">Expected Output</p>
                          <pre className="mt-1 max-h-56 overflow-auto rounded border bg-[var(--lc-page-bg)] p-2 text-xs leading-5 text-[var(--lc-text)]">
                            {safeCasePreview(testCase.expectedOutput)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                  {judgeData.testCases.length === 0 ? (
                    <p className="text-sm text-[var(--lc-text-muted)]">该题暂无测试用例。</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
