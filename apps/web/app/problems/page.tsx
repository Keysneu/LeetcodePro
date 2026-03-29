import Link from "next/link";

type ProblemListItem = {
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
};

type ProblemListResponse = {
  items: ProblemListItem[];
};

const fallbackProblems: ProblemListItem[] = [
  { slug: "two-sum", title: "Two Sum", difficulty: "Easy" },
  { slug: "valid-parentheses", title: "Valid Parentheses", difficulty: "Easy" },
  { slug: "container-with-most-water", title: "Container With Most Water", difficulty: "Medium" }
];

async function getProblems(): Promise<ProblemListItem[]> {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

  try {
    const response = await fetch(`${apiBaseUrl}/api/problems`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Failed to load problems: ${response.status}`);
    }

    const payload = (await response.json()) as ProblemListResponse;
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      return fallbackProblems;
    }

    return payload.items;
  } catch {
    return fallbackProblems;
  }
}

export default async function ProblemsPage() {
  const problems = await getProblems();

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-white">题库（MVP 最小集）</h1>
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80">
        {problems.map((problem) => (
          <Link
            key={problem.slug}
            href={`/problems/${problem.slug}`}
            className="flex items-center justify-between border-b border-slate-800 px-4 py-3 last:border-b-0 hover:bg-slate-900"
          >
            <span className="text-slate-100">{problem.title}</span>
            <span className="text-xs text-slate-400">{problem.difficulty}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
