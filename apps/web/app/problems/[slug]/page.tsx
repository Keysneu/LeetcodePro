import { notFound } from "next/navigation";
import ProblemResizableLayout from "@/components/problem-resizable-layout";
import ProblemSidePanel from "@/components/problem-side-panel";
import ProblemWorkspace from "@/components/problem-workspace";
import { HOT100_TITLE_ZH_BY_ID } from "@/lib/hot100-title-zh";
import { HOT100_CORE_STARTER } from "@/lib/hot100-core-starter";

type Props = {
  params: Promise<{ slug: string }>;
};

type ProblemDetail = {
  leetcodeId: number | null;
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string[];
  modeSupport: "CORE" | "ACM" | "BOTH";
  description: string;
  inputSpec: string;
  outputSpec: string;
  sampleInput: string;
  sampleOutput: string;
  acmInputSpec: string;
  acmOutputSpec: string;
  acmSampleInput: string;
  acmSampleOutput: string;
};

type ProblemDetailResponse = {
  item: ProblemDetail;
};

type StarterLanguage = "cpp" | "python";
type StarterCode = Record<StarterLanguage, string>;

const genericCoreStarterCode: StarterCode = {
  cpp: `class Solution {
public:
    // TODO: 请根据题面补全函数签名与实现
};`,
  python: `class Solution:
    # TODO: 请根据题面补全函数签名与实现
    pass`
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

  const initialCoreCodes = HOT100_CORE_STARTER[slug] ?? genericCoreStarterCode;
  const titleZh = problem.leetcodeId ? HOT100_TITLE_ZH_BY_ID[problem.leetcodeId] ?? null : null;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

  return (
    <section className="lc-workbench-page">
      <ProblemResizableLayout className="h-full min-h-0">
        <ProblemSidePanel apiBaseUrl={apiBaseUrl} problem={{ ...problem, titleZh }} />

        <ProblemWorkspace
          apiBaseUrl={apiBaseUrl}
          problemSlug={problem.slug}
          modeSupport={problem.modeSupport}
          initialCoreCodes={initialCoreCodes}
        />
      </ProblemResizableLayout>
    </section>
  );
}
