import { notFound } from "next/navigation";
import ProblemWorkspace from "@/components/problem-workspace";

type Props = {
  params: Promise<{ slug: string }>;
};

type ProblemDetail = {
  slug: string;
  title: string;
  modeSupport: "CORE" | "ACM" | "BOTH";
  description: string;
  sampleInput: string;
  sampleOutput: string;
};

type ProblemDetailResponse = {
  item: ProblemDetail;
};

const starterCodeMap: Record<string, string> = {
  "two-sum": `#include <bits/stdc++.h>
using namespace std;

vector<int> twoSum(vector<int>& nums, int target) {
  // TODO: implement
  return {};
}`,
  "valid-parentheses": `#include <bits/stdc++.h>
using namespace std;

bool isValid(string s) {
  // TODO: implement
  return false;
}`,
  "container-with-most-water": `#include <bits/stdc++.h>
using namespace std;

int maxArea(vector<int>& height) {
  // TODO: implement
  return 0;
}`
};

async function getProblemDetail(slug: string): Promise<ProblemDetail | null> {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

  try {
    const response = await fetch(`${apiBaseUrl}/api/problems/${slug}`, {
      cache: "no-store"
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to load problem detail: ${response.status}`);
    }

    const payload = (await response.json()) as ProblemDetailResponse;
    return payload.item;
  } catch {
    return null;
  }
}

export default async function ProblemDetailPage({ params }: Props) {
  const { slug } = await params;
  const problem = await getProblemDetail(slug);
  if (!problem) {
    notFound();
  }

  const initialCode = starterCodeMap[slug] ?? starterCodeMap["two-sum"];
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <section className="rounded-lg border border-slate-800 bg-slate-950 p-4 lg:col-span-1">
        <h1 className="mb-2 text-lg font-semibold text-white">{problem.title}</h1>
        <p className="mb-3 text-xs text-slate-400">
          slug: {problem.slug} | 支持模式：{problem.modeSupport}
        </p>
        <div className="space-y-3 text-sm text-slate-300">
          <p className="whitespace-pre-wrap leading-6">{problem.description}</p>
          <div className="rounded border border-slate-800 bg-slate-900 p-3 text-xs">
            <p className="mb-1 text-slate-200">示例输入</p>
            <pre className="whitespace-pre-wrap text-slate-400">{problem.sampleInput || "(无)"}</pre>
          </div>
          <div className="rounded border border-slate-800 bg-slate-900 p-3 text-xs">
            <p className="mb-1 text-slate-200">示例输出</p>
            <pre className="whitespace-pre-wrap text-slate-400">{problem.sampleOutput || "(无)"}</pre>
          </div>
        </div>
      </section>

      <ProblemWorkspace apiBaseUrl={apiBaseUrl} problemSlug={problem.slug} initialCode={initialCode} />
    </div>
  );
}
