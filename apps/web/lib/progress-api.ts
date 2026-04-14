export type HeatmapDayItem = {
  date: string;
  acCount: number;
};

export type RadarTagItem = {
  tag: string;
  totalProblems: number;
  solvedProblems: number;
  coverageRate: number;
};

export type ProgressOverviewResponse = {
  heatmap: {
    startDate: string;
    endDate: string;
    days: HeatmapDayItem[];
  };
  radar: {
    tags: RadarTagItem[];
  };
  summary: {
    totalAcSubmissions90d: number;
    activeDays90d: number;
  };
};

function parseErrorMessage(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }

  if (typeof payload !== "object" || payload === null) {
    return "进度数据加载失败，请稍后重试。";
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.message === "string") {
    return record.message;
  }

  if (Array.isArray(record.message) && typeof record.message[0] === "string") {
    return record.message[0];
  }

  return "进度数据加载失败，请稍后重试。";
}

export async function fetchProgressOverview(
  apiBaseUrl: string,
  timezone: string,
  signal?: AbortSignal
): Promise<ProgressOverviewResponse> {
  const response = await fetch(`${apiBaseUrl}/api/progress/overview?timezone=${encodeURIComponent(timezone)}`, {
    cache: "no-store",
    signal
  });

  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error(parseErrorMessage(payload));
  }

  return payload as ProgressOverviewResponse;
}
