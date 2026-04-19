import { buildMasteryByProblem, MasteryProblemRow, MasterySubmissionRow, MasterySummaryStatus } from "./mastery-metrics";
import { CodeMode } from "./types";

export type ProgressProblemRow = {
  id: string;
  slug: string;
  title: string;
  leetcodeId: number | null;
  tags: string[];
  modeSupport: MasteryProblemRow["modeSupport"];
};

export type ProgressSubmissionRow = MasterySubmissionRow;

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
  mastery: {
    statusCounts: Record<MasterySummaryStatus, number>;
    masteredProblems: number;
    dueReviewProblems: number;
    bothModesMasteredProblems: number;
    modeCompletion: {
      core: {
        supportedProblems: number;
        masteredProblems: number;
      };
      acm: {
        supportedProblems: number;
        masteredProblems: number;
      };
    };
    dueReviewItems: Array<{
      problemId: string;
      problemSlug: string;
      problemTitle: string;
      leetcodeId: number | null;
      dueModes: CodeMode[];
      nextReviewAt: string | null;
      overdueDays: number;
      overallStatus: MasterySummaryStatus;
    }>;
    note: string;
  };
};

const DEFAULT_WINDOW_DAYS = 90;
const DEFAULT_TOP_TAG_COUNT = 8;
const DEFAULT_DUE_REVIEW_LIMIT = 10;

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
  submissions: ProgressSubmissionRow[];
  timeZone: string;
  now?: Date;
  windowDays?: number;
  topTagCount?: number;
  dueReviewLimit?: number;
};

export function buildProgressOverview(options: BuildProgressOptions): ProgressOverview {
  const {
    problems,
    submissions,
    timeZone,
    now = new Date(),
    windowDays = DEFAULT_WINDOW_DAYS,
    topTagCount = DEFAULT_TOP_TAG_COUNT,
    dueReviewLimit = DEFAULT_DUE_REVIEW_LIMIT
  } = options;

  assertValidIanaTimeZone(timeZone);

  const acSubmissions = submissions.filter((row) => row.status === "AC");

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

  const masteryByProblem = buildMasteryByProblem(
    problems.map((problem) => ({ id: problem.id, modeSupport: problem.modeSupport })),
    submissions,
    now
  );

  const statusCounts: Record<MasterySummaryStatus, number> = {
    UNTOUCHED: 0,
    LEARNING: 0,
    REINFORCING: 0,
    MASTERED: 0,
    REVIEW_DUE: 0
  };
  let masteredProblems = 0;
  let dueReviewProblems = 0;
  let bothModesMasteredProblems = 0;
  let coreSupportedProblems = 0;
  let coreMasteredProblems = 0;
  let acmSupportedProblems = 0;
  let acmMasteredProblems = 0;

  const dueReviewItems: ProgressOverview["mastery"]["dueReviewItems"] = [];
  for (const problem of problems) {
    const mastery = masteryByProblem.get(problem.id);
    if (!mastery) {
      continue;
    }

    statusCounts[mastery.summary.overallStatus] += 1;
    if (mastery.summary.overallStatus === "MASTERED") {
      masteredProblems += 1;
    }
    if (mastery.summary.dueModes.length > 0 && mastery.summary.overdueDays !== null) {
      dueReviewProblems += 1;
      dueReviewItems.push({
        problemId: problem.id,
        problemSlug: problem.slug,
        problemTitle: problem.title,
        leetcodeId: problem.leetcodeId,
        dueModes: mastery.summary.dueModes,
        nextReviewAt: mastery.summary.nextReviewAt,
        overdueDays: mastery.summary.overdueDays,
        overallStatus: mastery.summary.overallStatus
      });
    }

    const coreTrack = mastery.tracks.find((track) => track.mode === "core");
    if (coreTrack?.supported) {
      coreSupportedProblems += 1;
      if (coreTrack.status === "MASTERED") {
        coreMasteredProblems += 1;
      }
    }

    const acmTrack = mastery.tracks.find((track) => track.mode === "acm");
    if (acmTrack?.supported) {
      acmSupportedProblems += 1;
      if (acmTrack.status === "MASTERED") {
        acmMasteredProblems += 1;
      }
    }

    if (coreTrack?.supported && acmTrack?.supported && coreTrack.status === "MASTERED" && acmTrack.status === "MASTERED") {
      bothModesMasteredProblems += 1;
    }
  }

  dueReviewItems.sort((left, right) => {
    if (right.overdueDays !== left.overdueDays) {
      return right.overdueDays - left.overdueDays;
    }
    if (left.nextReviewAt && right.nextReviewAt && left.nextReviewAt !== right.nextReviewAt) {
      return left.nextReviewAt.localeCompare(right.nextReviewAt);
    }
    return left.problemSlug.localeCompare(right.problemSlug);
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
    },
    mastery: {
      statusCounts,
      masteredProblems,
      dueReviewProblems,
      bothModesMasteredProblems,
      modeCompletion: {
        core: {
          supportedProblems: coreSupportedProblems,
          masteredProblems: coreMasteredProblems
        },
        acm: {
          supportedProblems: acmSupportedProblems,
          masteredProblems: acmMasteredProblems
        }
      },
      dueReviewItems: dueReviewItems.slice(0, Math.max(0, dueReviewLimit)),
      note: "掌握度仅统计 C++ 提交"
    }
  };
}
