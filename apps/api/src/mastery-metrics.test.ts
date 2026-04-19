import * as assert from "node:assert/strict";
import { test } from "node:test";

import { buildProblemMastery } from "./mastery-metrics";
import { MasterySubmissionRow } from "./mastery-metrics";

function submission(
  id: string,
  status: MasterySubmissionRow["status"],
  createdAt: string,
  mode: MasterySubmissionRow["mode"] = "core",
  language: MasterySubmissionRow["language"] = "cpp",
  problemId = "p1"
): MasterySubmissionRow {
  return {
    id,
    problemId,
    mode,
    language,
    status,
    createdAt
  };
}

test("returns untouched when there is no cpp submission", () => {
  const result = buildProblemMastery("BOTH", [], new Date("2026-04-15T00:00:00.000Z"));
  assert.equal(result.summary.overallStatus, "UNTOUCHED");
  assert.equal(result.summary.totalAttempts, 0);
  assert.equal(result.tracks.length, 2);
  assert.equal(result.tracks.filter((item) => item.status === "UNTOUCHED").length, 2);
});

test("python-only ac does not upgrade mastery", () => {
  const result = buildProblemMastery(
    "BOTH",
    [submission("s1", "AC", "2026-04-14T00:00:00.000Z", "core", "python")],
    new Date("2026-04-15T00:00:00.000Z")
  );

  assert.equal(result.summary.overallStatus, "UNTOUCHED");
  assert.equal(result.summary.totalAttempts, 0);
  assert.equal(result.tracks.every((track) => track.totalAttempts === 0), true);
});

test("two recent consecutive ac in same mode becomes mastered", () => {
  const result = buildProblemMastery(
    "CORE",
    [
      submission("s1", "AC", "2026-04-13T00:00:00.000Z", "core", "cpp"),
      submission("s2", "AC", "2026-04-14T00:00:00.000Z", "core", "cpp")
    ],
    new Date("2026-04-15T00:00:00.000Z")
  );

  assert.equal(result.summary.overallStatus, "MASTERED");
  assert.equal(result.summary.consecutiveAc, 2);
  assert.equal(result.summary.reviewIntervalDays, 3);
  assert.equal(result.summary.overdueDays, null);
});

test("review due when reinforcing interval expires", () => {
  const result = buildProblemMastery(
    "CORE",
    [submission("s1", "AC", "2026-04-10T00:00:00.000Z", "core", "cpp")],
    new Date("2026-04-15T00:00:00.000Z")
  );

  assert.equal(result.summary.overallStatus, "REVIEW_DUE");
  assert.deepEqual(result.summary.dueModes, ["core"]);
  assert.equal(result.summary.overdueDays, 4);
});

test("review due when mastered track passes review interval", () => {
  const result = buildProblemMastery(
    "CORE",
    [
      submission("s1", "AC", "2026-04-01T00:00:00.000Z", "core", "cpp"),
      submission("s2", "AC", "2026-04-02T00:00:00.000Z", "core", "cpp")
    ],
    new Date("2026-04-15T00:00:00.000Z")
  );

  assert.equal(result.tracks[0].consecutiveAc, 2);
  assert.equal(result.summary.overallStatus, "REVIEW_DUE");
  assert.equal(result.summary.overdueDays, 10);
});

test("overall status follows weaker mode when core is mastered but acm untouched", () => {
  const result = buildProblemMastery(
    "BOTH",
    [
      submission("s1", "AC", "2026-04-13T00:00:00.000Z", "core", "cpp"),
      submission("s2", "AC", "2026-04-14T00:00:00.000Z", "core", "cpp")
    ],
    new Date("2026-04-15T00:00:00.000Z")
  );

  const coreTrack = result.tracks.find((item) => item.mode === "core");
  const acmTrack = result.tracks.find((item) => item.mode === "acm");
  assert.ok(coreTrack);
  assert.ok(acmTrack);
  assert.equal(coreTrack.status, "MASTERED");
  assert.equal(acmTrack.status, "UNTOUCHED");
  assert.equal(result.summary.overallStatus, "UNTOUCHED");
});
