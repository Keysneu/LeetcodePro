export const DEFAULT_ADMIN_API_KEY = "leetcodepro-admin-key";

const DEFAULT_API_BASE_URL = "http://localhost:3001";

export type AdminProblemSummary = {
  id: string;
  leetcodeId: number | null;
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  modeSupport: "CORE" | "ACM" | "BOTH";
  totalCases: number;
  publicCases: number;
  hiddenCases: number;
  totalWeight: number;
};

export type AdminTestCase = {
  id: string;
  inputData: string;
  expectedOutput: string;
  isHidden: boolean;
  weight: number;
  createdAt: string;
};

export type AdminProblemJudgeData = AdminProblemSummary & {
  description: string;
  inputSpec: string;
  outputSpec: string;
  testCases: AdminTestCase[];
};

type ProblemListResponse = {
  items: AdminProblemSummary[];
};

type ProblemJudgeDataResponse = {
  item: AdminProblemJudgeData;
};

function getApiBaseUrl(): string {
  const envValue = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  return envValue && envValue.length > 0 ? envValue : DEFAULT_API_BASE_URL;
}

function getAdminApiKey(): string {
  const envValue = process.env.ADMIN_API_KEY?.trim();
  return envValue && envValue.length > 0 ? envValue : DEFAULT_ADMIN_API_KEY;
}

function getAdminHeaders(): HeadersInit {
  return {
    "x-admin-key": getAdminApiKey()
  };
}

export async function fetchAdminProblemList(): Promise<ProblemListResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/admin/problems`, {
    cache: "no-store",
    headers: getAdminHeaders()
  });

  if (!response.ok) {
    throw new Error(`后台题目列表加载失败: ${response.status}`);
  }

  return (await response.json()) as ProblemListResponse;
}

export async function fetchAdminProblemJudgeData(slug: string): Promise<ProblemJudgeDataResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/admin/problems/${slug}/judge-data`, {
    cache: "no-store",
    headers: getAdminHeaders()
  });

  if (response.status === 404) {
    throw new Error("题目不存在或已被删除。");
  }

  if (!response.ok) {
    throw new Error(`后台判题数据加载失败: ${response.status}`);
  }

  return (await response.json()) as ProblemJudgeDataResponse;
}
