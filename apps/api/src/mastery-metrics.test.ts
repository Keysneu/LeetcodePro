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

test("returns untouched when there is no submission", () => {
  const result = buildProblemMastery("BOTH", []);
  assert.equal(result.summary.overallStatus, "UNTOUCHED");
  assert.equal(result.summary.isSolved, false);
  assert.equal(result.summary.totalAttempts, 0);
  assert.equal(result.summary.attemptsToFirstAc, null);
  assert.equal(result.summary.latestStatus, null);
  assert.equal(result.tracks.filter((item) => item.status === "UNTOUCHED").length, 4);
});

test("returns attempting when only non-ac attempts exist", () => {
  const result = buildProblemMastery("BOTH", [
    submission("s1", "WA", "2026-04-14T00:00:00.000Z"),
    submission("s2", "TLE", "2026-04-14T00:01:00.000Z")
  ]);

  assert.equal(result.summary.overallStatus, "ATTEMPTING");
  assert.equal(result.summary.isSolved, false);
  assert.equal(result.summary.totalAttempts, 2);
  assert.equal(result.summary.latestStatus, "TLE");
});

test("classifies first-attempt ac as solved once", () => {
  const result = buildProblemMastery("BOTH", [submission("s1", "AC", "2026-04-14T00:00:00.000Z")]);

  assert.equal(result.summary.overallStatus, "SOLVED_ONCE");
  assert.equal(result.summary.attemptsToFirstAc, 1);
});

test("classifies second-attempt ac as solved twice", () => {
  const result = buildProblemMastery("BOTH", [
    submission("s1", "WA", "2026-04-14T00:00:00.000Z"),
    submission("s2", "AC", "2026-04-14T00:01:00.000Z")
  ]);

  assert.equal(result.summary.overallStatus, "SOLVED_TWICE");
  assert.equal(result.summary.attemptsToFirstAc, 2);
});

test("classifies third-attempt ac as solved many", () => {
  const result = buildProblemMastery("BOTH", [
    submission("s1", "WA", "2026-04-14T00:00:00.000Z"),
    submission("s2", "TLE", "2026-04-14T00:01:00.000Z"),
    submission("s3", "AC", "2026-04-14T00:02:00.000Z")
  ]);

  assert.equal(result.summary.overallStatus, "SOLVED_MANY");
  assert.equal(result.summary.attemptsToFirstAc, 3);
});

test("summary solved if any track solved while other tracks are still attempting", () => {
  const result = buildProblemMastery("BOTH", [
    submission("s1", "AC", "2026-04-14T00:00:00.000Z", "core", "cpp"),
    submission("s2", "WA", "2026-04-14T00:01:00.000Z", "acm", "python")
  ]);

  assert.equal(result.summary.isSolved, true);
  assert.equal(result.summary.overallStatus, "SOLVED_ONCE");
  const acmPython = result.tracks.find((item) => item.mode === "acm" && item.language === "python");
  assert.ok(acmPython);
  assert.equal(acmPython.status, "ATTEMPTING");
});

test("unsupported tracks are marked unsupported for CORE-only problems", () => {
  const result = buildProblemMastery("CORE", [
    submission("s1", "WA", "2026-04-14T00:00:00.000Z", "core", "cpp")
  ]);

  const acmCpp = result.tracks.find((item) => item.mode === "acm" && item.language === "cpp");
  const acmPython = result.tracks.find((item) => item.mode === "acm" && item.language === "python");
  assert.ok(acmCpp);
  assert.ok(acmPython);
  assert.equal(acmCpp.status, "UNSUPPORTED");
  assert.equal(acmPython.status, "UNSUPPORTED");
});

test("latest status can differ from solved status and queued/running are excluded from attempts", () => {
  const result = buildProblemMastery("BOTH", [
    submission("s1", "WA", "2026-04-14T00:00:00.000Z"),
    submission("s2", "AC", "2026-04-14T00:01:00.000Z"),
    submission("s3", "RUNNING", "2026-04-14T00:02:00.000Z")
  ]);

  assert.equal(result.summary.overallStatus, "SOLVED_TWICE");
  assert.equal(result.summary.attemptsToFirstAc, 2);
  assert.equal(result.summary.totalAttempts, 2);
  assert.equal(result.summary.latestStatus, "RUNNING");
});
