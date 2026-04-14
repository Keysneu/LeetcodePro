export type ProgressProblemRow = {
  id: string;
  tags: string[];
};

export type ProgressSubmissionRow = {
  problemId: string;
  createdAt: string;
};

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

export type ProgressOverview = {
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

const DEFAULT_WINDOW_DAYS = 90;
const DEFAULT_TOP_TAG_COUNT = 8;

function toDateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to format date in timezone.");
  }

  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map((part) => Number(part));
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(dateKey: string, delta: number): string {
  const utcDate = parseDateKey(dateKey);
  utcDate.setUTCDate(utcDate.getUTCDate() + delta);
  const year = utcDate.getUTCFullYear();
  const month = String(utcDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(utcDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDateRange(endDate: string, dayCount: number): string[] {
  const dates: string[] = [];
  const startDate = addDays(endDate, -(dayCount - 1));
  for (let offset = 0; offset < dayCount; offset += 1) {
    dates.push(addDays(startDate, offset));
  }
  return dates;
}

export function assertValidIanaTimeZone(timeZone: string): void {
  const trimmed = timeZone.trim();
  const safeChars = /^[A-Za-z0-9_+\-\/]+$/;
  if (!trimmed || trimmed.length > 100 || !safeChars.test(trimmed)) {
    throw new Error("Invalid timezone format.");
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(new Date());
  } catch {
    throw new Error("Unsupported timezone.");
  }
}

type BuildProgressOptions = {
  problems: ProgressProblemRow[];
  acSubmissions: ProgressSubmissionRow[];
  timeZone: string;
  now?: Date;
  windowDays?: number;
  topTagCount?: number;
};

export function buildProgressOverview(options: BuildProgressOptions): ProgressOverview {
  const {
    problems,
    acSubmissions,
    timeZone,
    now = new Date(),
    windowDays = DEFAULT_WINDOW_DAYS,
    topTagCount = DEFAULT_TOP_TAG_COUNT
  } = options;

  assertValidIanaTimeZone(timeZone);

  const endDate = toDateKeyInTimeZone(now, timeZone);
  const rangeDates = buildDateRange(endDate, windowDays);
  const startDate = rangeDates[0];

  const rangeSet = new Set(rangeDates);
  const heatmapCounter = new Map<string, number>();
  const solvedProblemIds = new Set<string>();

  for (const row of acSubmissions) {
    const submissionTime = new Date(row.createdAt);
    if (Number.isNaN(submissionTime.getTime())) {
      continue;
    }

    const localDate = toDateKeyInTimeZone(submissionTime, timeZone);
    if (!rangeSet.has(localDate)) {
      continue;
    }

    heatmapCounter.set(localDate, (heatmapCounter.get(localDate) ?? 0) + 1);
    solvedProblemIds.add(row.problemId);
  }

  const heatmapDays = rangeDates.map((date) => ({
    date,
    acCount: heatmapCounter.get(date) ?? 0
  }));

  const totalAcSubmissions90d = heatmapDays.reduce((sum, item) => sum + item.acCount, 0);
  const activeDays90d = heatmapDays.reduce((sum, item) => sum + (item.acCount > 0 ? 1 : 0), 0);

  const tagTotals = new Map<string, number>();
  for (const problem of problems) {
    const uniqueTags = [...new Set(problem.tags.filter((tag) => tag.trim().length > 0))];
    for (const tag of uniqueTags) {
      tagTotals.set(tag, (tagTotals.get(tag) ?? 0) + 1);
    }
  }

  const topTags = [...tagTotals.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return a[0].localeCompare(b[0], "zh-Hans-CN");
    })
    .slice(0, topTagCount);

  const solvedCountByTag = new Map<string, number>();
  for (const [tag] of topTags) {
    solvedCountByTag.set(tag, 0);
  }

  const problemTagMap = new Map<string, Set<string>>();
  for (const problem of problems) {
    problemTagMap.set(problem.id, new Set(problem.tags));
  }

  for (const problemId of solvedProblemIds) {
    const tags = problemTagMap.get(problemId);
    if (!tags) {
      continue;
    }

    for (const [tag] of topTags) {
      if (tags.has(tag)) {
        solvedCountByTag.set(tag, (solvedCountByTag.get(tag) ?? 0) + 1);
      }
    }
  }

  const radarTags: RadarTagItem[] = topTags.map(([tag, totalProblems]) => {
    const solvedProblems = solvedCountByTag.get(tag) ?? 0;
    const coverageRateRaw = totalProblems > 0 ? (solvedProblems / totalProblems) * 100 : 0;

    return {
      tag,
      totalProblems,
      solvedProblems,
      coverageRate: Number(coverageRateRaw.toFixed(2))
    };
  });

  return {
    heatmap: {
      startDate,
      endDate,
      days: heatmapDays
    },
    radar: {
      tags: radarTags
    },
    summary: {
      totalAcSubmissions90d,
      activeDays90d
    }
  };
}
