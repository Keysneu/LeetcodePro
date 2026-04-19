export type ProblemSearchableFields = {
  leetcodeId: number | null;
  title: string;
  slug: string;
  tags: string[];
};

function normalizeSearchText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("zh-Hans-CN");
}

export function normalizeProblemSearchQuery(rawQuery: string | string[] | undefined | null): string | null {
  const query = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery;

  if (typeof query !== "string") {
    return null;
  }

  const normalized = query.trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

export function toProblemSearchPattern(normalizedQuery: string): string {
  return `%${normalizedQuery}%`;
}

export function problemMatchesSearch(problem: ProblemSearchableFields, normalizedQuery: string | null): boolean {
  if (!normalizedQuery) {
    return true;
  }

  const searchNeedle = normalizeSearchText(normalizedQuery);
  const haystacks = [
    problem.leetcodeId?.toString() ?? "",
    problem.title,
    problem.slug,
    ...problem.tags
  ];

  return haystacks.some((value) => normalizeSearchText(value).includes(searchNeedle));
}
