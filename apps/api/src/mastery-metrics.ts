import { CodeMode, Language, ModeSupport, SubmissionStatus } from "./types";

export type MasteryStatus = "UNTOUCHED" | "ATTEMPTING" | "SOLVED_ONCE" | "SOLVED_TWICE" | "SOLVED_MANY" | "UNSUPPORTED";
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
  attemptsToFirstAc: number | null;
  latestStatus: SubmissionStatus | null;
  isSolved: boolean;
};

export type MasterySummary = {
  overallStatus: MasterySummaryStatus;
  isSolved: boolean;
  totalAttempts: number;
  attemptsToFirstAc: number | null;
  latestStatus: SubmissionStatus | null;
};

export type ProblemMastery = {
  summary: MasterySummary;
  tracks: MasteryTrack[];
};

const TRACK_DEFINITIONS: ReadonlyArray<{ mode: CodeMode; language: Language }> = [
  { mode: "core", language: "cpp" },
  { mode: "core", language: "python" },
  { mode: "acm", language: "cpp" },
  { mode: "acm", language: "python" }
];

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

function deriveSolvedStatus(attemptsToFirstAc: number | null): MasterySummaryStatus | null {
  if (attemptsToFirstAc === null) {
    return null;
  }
  if (attemptsToFirstAc <= 1) {
    return "SOLVED_ONCE";
  }
  if (attemptsToFirstAc === 2) {
    return "SOLVED_TWICE";
  }
  return "SOLVED_MANY";
}

type DerivedTrackStats = {
  totalAttempts: number;
  attemptsToFirstAc: number | null;
  latestStatus: SubmissionStatus | null;
  hasAnySubmission: boolean;
};

function deriveTrackStats(submissions: MasterySubmissionRow[]): DerivedTrackStats {
  const sorted = [...submissions].sort(compareSubmissionOrder);
  const latestStatus = sorted.length > 0 ? sorted[sorted.length - 1].status : null;

  let totalAttempts = 0;
  let attemptsToFirstAc: number | null = null;

  for (const submission of sorted) {
    if (!isAttemptStatus(submission.status)) {
      continue;
    }

    totalAttempts += 1;
    if (submission.status === "AC" && attemptsToFirstAc === null) {
      attemptsToFirstAc = totalAttempts;
    }
  }

  return {
    totalAttempts,
    attemptsToFirstAc,
    latestStatus,
    hasAnySubmission: sorted.length > 0
  };
}

export function buildProblemMastery(modeSupport: ModeSupport, submissions: MasterySubmissionRow[]): ProblemMastery {
  const tracks: MasteryTrack[] = TRACK_DEFINITIONS.map((definition) => {
    const supported = isTrackSupported(modeSupport, definition.mode);
    const scoped = submissions.filter(
      (item) => item.mode === definition.mode && item.language === definition.language
    );

    if (!supported) {
      return {
        ...definition,
        supported: false,
        status: "UNSUPPORTED",
        totalAttempts: 0,
        attemptsToFirstAc: null,
        latestStatus: null,
        isSolved: false
      };
    }

    const derived = deriveTrackStats(scoped);
    const solvedStatus = deriveSolvedStatus(derived.attemptsToFirstAc);

    return {
      ...definition,
      supported: true,
      status: solvedStatus ?? (derived.hasAnySubmission ? "ATTEMPTING" : "UNTOUCHED"),
      totalAttempts: derived.totalAttempts,
      attemptsToFirstAc: derived.attemptsToFirstAc,
      latestStatus: derived.latestStatus,
      isSolved: derived.attemptsToFirstAc !== null
    };
  });

  const supportedSubmissions = submissions.filter((item) => isTrackSupported(modeSupport, item.mode));
  const summaryStats = deriveTrackStats(supportedSubmissions);
  const solvedStatus = deriveSolvedStatus(summaryStats.attemptsToFirstAc);

  return {
    summary: {
      overallStatus: solvedStatus ?? (summaryStats.hasAnySubmission ? "ATTEMPTING" : "UNTOUCHED"),
      isSolved: summaryStats.attemptsToFirstAc !== null,
      totalAttempts: summaryStats.totalAttempts,
      attemptsToFirstAc: summaryStats.attemptsToFirstAc,
      latestStatus: summaryStats.latestStatus
    },
    tracks
  };
}

export function buildMasteryByProblem(
  problems: MasteryProblemRow[],
  submissions: MasterySubmissionRow[]
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
    masteryByProblem.set(problem.id, buildProblemMastery(problem.modeSupport, grouped.get(problem.id) ?? []));
  }

  return masteryByProblem;
}
