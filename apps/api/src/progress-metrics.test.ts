import * as assert from "node:assert/strict";
import { test } from "node:test";

import { assertValidIanaTimeZone, buildProgressOverview } from "./progress-metrics";

function submission(params: {
  id: string;
  problemId: string;
  status: "QUEUED" | "RUNNING" | "AC" | "WA" | "TLE" | "RE" | "CE";
  createdAt: string;
  mode?: "core" | "acm";
  language?: "cpp" | "python";
}) {
  return {
    id: params.id,
    problemId: params.problemId,
    mode: params.mode ?? "core",
    language: params.language ?? "cpp",
    status: params.status,
    createdAt: params.createdAt
  };
}

const BASE_PROBLEMS = [
  { id: "p1", slug: "two-sum", title: "Two Sum", leetcodeId: 1, tags: ["数组"], modeSupport: "BOTH" as const },
  { id: "p2", slug: "climbing-stairs", title: "Climbing Stairs", leetcodeId: 70, tags: ["动态规划", "数组"], modeSupport: "CORE" as const },
  { id: "p3", slug: "valid-parentheses", title: "Valid Parentheses", leetcodeId: 20, tags: ["栈"], modeSupport: "BOTH" as const }
];

test("heatmap and radar still work with all submissions input", () => {
  const result = buildProgressOverview({
    problems: BASE_PROBLEMS,
    submissions: [
      submission({ id: "s1", problemId: "p1", status: "AC", createdAt: "2026-04-13T01:00:00.000Z", language: "python" }),
      submission({ id: "s2", problemId: "p1", status: "AC", createdAt: "2026-04-13T06:00:00.000Z" }),
      submission({ id: "s3", problemId: "p2", status: "AC", createdAt: "2026-04-10T02:00:00.000Z" }),
      submission({ id: "s4", problemId: "p3", status: "WA", createdAt: "2026-04-12T02:00:00.000Z" })
    ],
    timeZone: "Asia/Shanghai",
    now: new Date("2026-04-14T12:00:00.000Z"),
    windowDays: 5,
    topTagCount: 3
  });

  assert.equal(result.heatmap.startDate, "2026-04-10");
  assert.equal(result.heatmap.endDate, "2026-04-14");
  assert.deepEqual(result.heatmap.days, [
    { date: "2026-04-10", acCount: 1 },
    { date: "2026-04-11", acCount: 0 },
    { date: "2026-04-12", acCount: 0 },
    { date: "2026-04-13", acCount: 2 },
    { date: "2026-04-14", acCount: 0 }
  ]);
  assert.equal(result.summary.totalAcSubmissions90d, 3);
  assert.equal(result.summary.activeDays90d, 2);
  assert.ok(result.radar.tags.length > 0);
});

test("mastery status counts and mode completion are aggregated from cpp-only logic", () => {
  const result = buildProgressOverview({
    problems: BASE_PROBLEMS,
    submissions: [
      submission({ id: "s1", problemId: "p1", status: "AC", createdAt: "2026-04-13T00:00:00.000Z", mode: "core" }),
      submission({ id: "s2", problemId: "p1", status: "AC", createdAt: "2026-04-14T00:00:00.000Z", mode: "core" }),
      submission({ id: "s3", problemId: "p1", status: "AC", createdAt: "2026-04-13T01:00:00.000Z", mode: "acm" }),
      submission({ id: "s4", problemId: "p1", status: "AC", createdAt: "2026-04-14T01:00:00.000Z", mode: "acm" }),
      submission({ id: "s5", problemId: "p2", status: "AC", createdAt: "2026-04-14T02:00:00.000Z", mode: "core", language: "python" })
    ],
    timeZone: "Asia/Shanghai",
    now: new Date("2026-04-15T00:00:00.000Z"),
    windowDays: 30
  });

  assert.equal(result.mastery.statusCounts.MASTERED, 1);
  assert.equal(result.mastery.statusCounts.UNTOUCHED, 2);
  assert.equal(result.mastery.masteredProblems, 1);
  assert.equal(result.mastery.bothModesMasteredProblems, 1);

  assert.equal(result.mastery.modeCompletion.core.supportedProblems, 3);
  assert.equal(result.mastery.modeCompletion.core.masteredProblems, 1);
  assert.equal(result.mastery.modeCompletion.acm.supportedProblems, 2);
  assert.equal(result.mastery.modeCompletion.acm.masteredProblems, 1);
});

test("due review items hide stale records that are overdue for 10 days or more", () => {
  const problems = Array.from({ length: 12 }).map((_, index) => ({
    id: `p${index + 1}`,
    slug: `problem-${index + 1}`,
    title: `Problem ${index + 1}`,
    leetcodeId: index + 1,
    tags: ["数组"],
    modeSupport: "CORE" as const
  }));

  const submissions = problems.map((problem, index) =>
    submission({
      id: `s-${problem.id}`,
      problemId: problem.id,
      status: "AC",
      createdAt: `2026-04-${String(2 + index).padStart(2, "0")}T00:00:00.000Z`,
      mode: "core"
    })
  );

  const result = buildProgressOverview({
    problems,
    submissions,
    timeZone: "Asia/Shanghai",
    now: new Date("2026-04-15T00:00:00.000Z"),
    dueReviewLimit: 10
  });

  assert.equal(result.mastery.dueReviewItems.length, 9);
  assert.equal(result.mastery.dueReviewProblems, 9);
  assert.deepEqual(
    result.mastery.dueReviewItems.map((item) => item.problemSlug),
    ["problem-4", "problem-5", "problem-6", "problem-7", "problem-8", "problem-9", "problem-10", "problem-11", "problem-12"]
  );

  for (let index = 1; index < result.mastery.dueReviewItems.length; index += 1) {
    const previous = result.mastery.dueReviewItems[index - 1];
    const current = result.mastery.dueReviewItems[index];
    assert.ok(previous.overdueDays >= current.overdueDays);
    assert.ok(previous.overdueDays < 10);
    assert.ok(current.overdueDays < 10);
  }
});

test("timezone bucketing differs across timezones for the same UTC timestamp", () => {
  const inputs = {
    problems: BASE_PROBLEMS.slice(0, 1),
    submissions: [submission({ id: "s1", problemId: "p1", status: "AC", createdAt: "2026-04-14T00:30:00.000Z" })],
    now: new Date("2026-04-14T12:00:00.000Z"),
    windowDays: 1
  };

  const shanghai = buildProgressOverview({ ...inputs, timeZone: "Asia/Shanghai" });
  const losAngeles = buildProgressOverview({ ...inputs, timeZone: "America/Los_Angeles" });

  assert.equal(shanghai.heatmap.days[0].acCount, 1);
  assert.equal(losAngeles.heatmap.days[0].acCount, 0);
});

test("assertValidIanaTimeZone rejects malformed and unsupported timezone", () => {
  assert.throws(() => assertValidIanaTimeZone(""), /Invalid timezone format/);
  assert.throws(() => assertValidIanaTimeZone("../../etc/passwd"), /Invalid timezone format/);
  assert.throws(() => assertValidIanaTimeZone("Mars/OlympusMons"), /Unsupported timezone/);
  assert.doesNotThrow(() => assertValidIanaTimeZone("Asia/Shanghai"));
});
