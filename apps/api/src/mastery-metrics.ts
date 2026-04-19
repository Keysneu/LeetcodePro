import { CodeMode, Language, ModeSupport, SubmissionStatus } from "./types";

export type MasteryStatus = "UNTOUCHED" | "LEARNING" | "REINFORCING" | "MASTERED" | "REVIEW_DUE" | "UNSUPPORTED";
export type MasterySummaryStatus = Exclude<MasteryStatus, "UNSUPPORTED">;

export type MasterySubmissionRow = {
  problemId: string;
  mode: CodeMode;
  language: Language;
  status: SubmissionStatus;
  createdAt: string;
  id: string;
};

export type MasteryProblemRow = {
  id: string;
  modeSupport: ModeSupport;
};

export type MasteryTrack = {
  mode: CodeMode;
  language: Language;
  supported: boolean;
  status: MasteryStatus;
  totalAttempts: number;
  latestStatus: SubmissionStatus | null;
  isSolved: boolean;
  totalAcCount: number;
  consecutiveAc: number;
  recentConsecutiveAc: number;
  reviewIntervalDays: number | null;
  lastAcAt: string | null;
  nextReviewAt: string | null;
  overdueDays: number | null;
};

export type MasterySummary = {
  overallStatus: MasterySummaryStatus;
  isSolved: boolean;
  totalAttempts: number;
  latestStatus: SubmissionStatus | null;
  dueModes: CodeMode[];
  consecutiveAc: number;
  reviewIntervalDays: number | null;
  nextReviewAt: string | null;
  overdueDays: number | null;
};

export type ProblemMastery = {
  summary: MasterySummary;
  tracks: MasteryTrack[];
};

const TRACK_DEFINITIONS: ReadonlyArray<{ mode: CodeMode; language: Language }> = [
  { mode: "core", language: "cpp" },
  { mode: "acm", language: "cpp" }
];
const RECENT_WINDOW_DAYS = 7;
const REVIEW_INTERVALS_DAYS: ReadonlyArray<number> = [1, 3, 7, 14, 30];
const DAY_MS = 24 * 60 * 60 * 1000;

function isAttemptStatus(status: SubmissionStatus): boolean {
  return status !== "QUEUED" && status !== "RUNNING";
}

function isTrackSupported(modeSupport: ModeSupport, mode: CodeMode): boolean {
  if (modeSupport === "BOTH") {
    return true;
  }

  if (modeSupport === "CORE") {
    return mode === "core";
  }

  return mode === "acm";
}

function compareSubmissionOrder(left: MasterySubmissionRow, right: MasterySubmissionRow): number {
  const leftTs = Date.parse(left.createdAt);
  const rightTs = Date.parse(right.createdAt);

  const leftValid = Number.isFinite(leftTs);
  const rightValid = Number.isFinite(rightTs);

  if (leftValid && rightValid && leftTs !== rightTs) {
    return leftTs - rightTs;
  }

  if (left.createdAt !== right.createdAt) {
    return left.createdAt.localeCompare(right.createdAt);
  }

  return left.id.localeCompare(right.id);
}

function toTimestamp(value: string): number | null {
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) {
    return null;
  }
  return ts;
}

function toIsoString(ts: number): string {
  return new Date(ts).toISOString();
}

function pickReviewIntervalDays(consecutiveAc: number): number {
  const normalized = Math.max(1, consecutiveAc);
  const index = Math.min(normalized, REVIEW_INTERVALS_DAYS.length) - 1;
  return REVIEW_INTERVALS_DAYS[index];
}

function deriveTrackStatus(params: {
  hasAnySubmission: boolean;
  totalAcCount: number;
  recentConsecutiveAc: number;
  overdueDays: number | null;
}): MasterySummaryStatus {
  const { hasAnySubmission, totalAcCount, recentConsecutiveAc, overdueDays } = params;
  if (!hasAnySubmission) {
    return "UNTOUCHED";
  }
  if (totalAcCount === 0) {
    return "LEARNING";
  }
  if (overdueDays !== null) {
    return "REVIEW_DUE";
  }
  if (recentConsecutiveAc >= 2) {
    return "MASTERED";
  }
  return "REINFORCING";
}

function summaryStatusRank(status: MasterySummaryStatus): number {
  if (status === "UNTOUCHED") {
    return 0;
  }
  if (status === "LEARNING") {
    return 1;
  }
  if (status === "REVIEW_DUE") {
    return 2;
  }
  if (status === "REINFORCING") {
    return 3;
  }
  return 4;
}

type DerivedTrackStats = {
  totalAttempts: number;
  latestStatus: SubmissionStatus | null;
  hasAnySubmission: boolean;
  totalAcCount: number;
  consecutiveAc: number;
  recentConsecutiveAc: number;
  reviewIntervalDays: number | null;
  lastAcAt: string | null;
  nextReviewAt: string | null;
  overdueDays: number | null;
};

function deriveTrackStats(submissions: MasterySubmissionRow[], now: Date): DerivedTrackStats {
  const sorted = [...submissions].sort(compareSubmissionOrder);
  const latestStatus = sorted.length > 0 ? sorted[sorted.length - 1].status : null;
  const recentThresholdTs = now.getTime() - RECENT_WINDOW_DAYS * DAY_MS;

  let totalAttempts = 0;
  let totalAcCount = 0;
  let consecutiveAc = 0;
  let lastAcAt: string | null = null;

  for (const submission of sorted) {
    if (!isAttemptStatus(submission.status)) {
      continue;
    }

    totalAttempts += 1;
    if (submission.status === "AC") {
      totalAcCount += 1;
      consecutiveAc += 1;
      lastAcAt = submission.createdAt;
      continue;
    }

    consecutiveAc = 0;
  }

  let recentConsecutiveAc = 0;
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const submission = sorted[index];
    if (!isAttemptStatus(submission.status)) {
      continue;
    }
    if (submission.status !== "AC") {
      break;
    }
    const ts = toTimestamp(submission.createdAt);
    if (ts === null || ts < recentThresholdTs) {
      break;
    }
    recentConsecutiveAc += 1;
  }

  let reviewIntervalDays: number | null = null;
  let nextReviewAt: string | null = null;
  let overdueDays: number | null = null;

  if (totalAcCount > 0 && lastAcAt) {
    reviewIntervalDays = pickReviewIntervalDays(consecutiveAc);
    const lastAcTs = toTimestamp(lastAcAt);
    if (lastAcTs !== null) {
      const nextReviewTs = lastAcTs + reviewIntervalDays * DAY_MS;
      nextReviewAt = toIsoString(nextReviewTs);
      if (now.getTime() >= nextReviewTs) {
        overdueDays = Math.floor((now.getTime() - nextReviewTs) / DAY_MS);
      }
    }
  }

  return {
    totalAttempts,
    latestStatus,
    hasAnySubmission: sorted.length > 0,
    totalAcCount,
    consecutiveAc,
    recentConsecutiveAc,
    reviewIntervalDays,
    lastAcAt,
    nextReviewAt,
    overdueDays
  };
}

export function buildProblemMastery(
  modeSupport: ModeSupport,
  submissions: MasterySubmissionRow[],
  now = new Date()
): ProblemMastery {
  const cppSubmissions = submissions.filter((item) => item.language === "cpp");
  const tracks: MasteryTrack[] = TRACK_DEFINITIONS.map((definition) => {
    const supported = isTrackSupported(modeSupport, definition.mode);
    const scoped = cppSubmissions.filter(
      (item) => item.mode === definition.mode && item.language === definition.language
    );

    if (!supported) {
      return {
        ...definition,
        supported: false,
        status: "UNSUPPORTED",
        totalAttempts: 0,
        latestStatus: null,
        isSolved: false,
        totalAcCount: 0,
        consecutiveAc: 0,
        recentConsecutiveAc: 0,
        reviewIntervalDays: null,
        lastAcAt: null,
        nextReviewAt: null,
        overdueDays: null
      };
    }

    const derived = deriveTrackStats(scoped, now);
    const status = deriveTrackStatus({
      hasAnySubmission: derived.hasAnySubmission,
      totalAcCount: derived.totalAcCount,
      recentConsecutiveAc: derived.recentConsecutiveAc,
      overdueDays: derived.overdueDays
    });

    return {
      ...definition,
      supported: true,
      status,
      totalAttempts: derived.totalAttempts,
      latestStatus: derived.latestStatus,
      isSolved: derived.totalAcCount > 0,
      totalAcCount: derived.totalAcCount,
      consecutiveAc: derived.consecutiveAc,
      recentConsecutiveAc: derived.recentConsecutiveAc,
      reviewIntervalDays: derived.reviewIntervalDays,
      lastAcAt: derived.lastAcAt,
      nextReviewAt: derived.nextReviewAt,
      overdueDays: derived.overdueDays
    };
  });

  const supportedTracks = tracks.filter((item) => item.supported);
  const weakestTrack = supportedTracks.reduce<MasteryTrack | null>((current, next) => {
    if (!current) {
      return next;
    }
    const currentRank = summaryStatusRank(current.status as MasterySummaryStatus);
    const nextRank = summaryStatusRank(next.status as MasterySummaryStatus);
    if (nextRank < currentRank) {
      return next;
    }
    if (nextRank > currentRank) {
      return current;
    }
    const currentNextReviewTs = current.nextReviewAt ? toTimestamp(current.nextReviewAt) : null;
    const nextNextReviewTs = next.nextReviewAt ? toTimestamp(next.nextReviewAt) : null;
    if (currentNextReviewTs !== null && nextNextReviewTs !== null) {
      return nextNextReviewTs < currentNextReviewTs ? next : current;
    }
    if (currentNextReviewTs === null && nextNextReviewTs !== null) {
      return next;
    }
    return current;
  }, null);

  const latestSupportedSubmission = cppSubmissions
    .filter((item) => isTrackSupported(modeSupport, item.mode))
    .sort(compareSubmissionOrder)
    .at(-1);

  const dueTracks = supportedTracks.filter((track) => track.status === "REVIEW_DUE");
  const earliestNextReviewTs = supportedTracks
    .map((track) => (track.nextReviewAt ? toTimestamp(track.nextReviewAt) : null))
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right)[0];
  const maxOverdueDays = dueTracks.reduce<number | null>((max, track) => {
    if (track.overdueDays === null) {
      return max;
    }
    if (max === null) {
      return track.overdueDays;
    }
    return Math.max(max, track.overdueDays);
  }, null);

  return {
    summary: {
      overallStatus: weakestTrack ? (weakestTrack.status as MasterySummaryStatus) : "UNTOUCHED",
      isSolved: supportedTracks.length > 0 && supportedTracks.every((track) => track.isSolved),
      totalAttempts: supportedTracks.reduce((sum, track) => sum + track.totalAttempts, 0),
      latestStatus: latestSupportedSubmission?.status ?? null,
      dueModes: dueTracks.map((track) => track.mode),
      consecutiveAc: weakestTrack?.consecutiveAc ?? 0,
      reviewIntervalDays: weakestTrack?.reviewIntervalDays ?? null,
      nextReviewAt: earliestNextReviewTs ? toIsoString(earliestNextReviewTs) : null,
      overdueDays: maxOverdueDays
    },
    tracks
  };
}

export function buildMasteryByProblem(
  problems: MasteryProblemRow[],
  submissions: MasterySubmissionRow[],
  now = new Date()
): Map<string, ProblemMastery> {
  const grouped = new Map<string, MasterySubmissionRow[]>();

  for (const submission of submissions) {
    const list = grouped.get(submission.problemId);
    if (list) {
      list.push(submission);
      continue;
    }
    grouped.set(submission.problemId, [submission]);
  }

  const masteryByProblem = new Map<string, ProblemMastery>();
  for (const problem of problems) {
    masteryByProblem.set(problem.id, buildProblemMastery(problem.modeSupport, grouped.get(problem.id) ?? [], now));
  }

  return masteryByProblem;
}
