import * as assert from "node:assert/strict";
import { test } from "node:test";

import { assertValidIanaTimeZone, buildProgressOverview } from "./progress-metrics";

test("heatmap counts daily AC submissions and fills continuous window days", () => {
  const result = buildProgressOverview({
    problems: [
      { id: "p1", tags: ["数组"] },
      { id: "p2", tags: ["数组", "动态规划"] },
      { id: "p3", tags: ["动态规划"] }
    ],
    acSubmissions: [
      { problemId: "p1", createdAt: "2026-04-13T01:00:00.000Z" },
      { problemId: "p1", createdAt: "2026-04-13T06:00:00.000Z" },
      { problemId: "p2", createdAt: "2026-04-12T16:30:00.000Z" },
      { problemId: "p2", createdAt: "2026-04-10T02:00:00.000Z" }
    ],
    timeZone: "Asia/Shanghai",
    now: new Date("2026-04-14T12:00:00.000Z"),
    windowDays: 5,
    topTagCount: 2
  });

  assert.equal(result.heatmap.startDate, "2026-04-10");
  assert.equal(result.heatmap.endDate, "2026-04-14");
  assert.equal(result.heatmap.days.length, 5);
  assert.deepEqual(result.heatmap.days, [
    { date: "2026-04-10", acCount: 1 },
    { date: "2026-04-11", acCount: 0 },
    { date: "2026-04-12", acCount: 0 },
    { date: "2026-04-13", acCount: 3 },
    { date: "2026-04-14", acCount: 0 }
  ]);

  assert.equal(result.summary.totalAcSubmissions90d, 4);
  assert.equal(result.summary.activeDays90d, 2);
});

test("radar coverage uses distinct solved problems in window and global tag totals as denominator", () => {
  const result = buildProgressOverview({
    problems: [
      { id: "p1", tags: ["数组", "哈希表"] },
      { id: "p2", tags: ["数组", "动态规划"] },
      { id: "p3", tags: ["动态规划"] },
      { id: "p4", tags: ["字符串"] }
    ],
    acSubmissions: [
      { problemId: "p1", createdAt: "2026-04-12T01:00:00.000Z" },
      { problemId: "p1", createdAt: "2026-04-12T02:00:00.000Z" },
      { problemId: "p2", createdAt: "2026-04-13T02:00:00.000Z" },
      { problemId: "p3", createdAt: "2026-01-01T02:00:00.000Z" }
    ],
    timeZone: "Asia/Shanghai",
    now: new Date("2026-04-14T12:00:00.000Z"),
    windowDays: 90,
    topTagCount: 4
  });

  const tagMap = new Map(result.radar.tags.map((item) => [item.tag, item]));

  const arrayTag = tagMap.get("数组");
  assert.ok(arrayTag);
  assert.equal(arrayTag.totalProblems, 2);
  assert.equal(arrayTag.solvedProblems, 2);
  assert.equal(arrayTag.coverageRate, 100);

  const dpTag = tagMap.get("动态规划");
  assert.ok(dpTag);
  assert.equal(dpTag.totalProblems, 2);
  assert.equal(dpTag.solvedProblems, 1);
  assert.equal(dpTag.coverageRate, 50);

  const hashTag = tagMap.get("哈希表");
  assert.ok(hashTag);
  assert.equal(hashTag.totalProblems, 1);
  assert.equal(hashTag.solvedProblems, 1);
  assert.equal(hashTag.coverageRate, 100);
});

test("timezone bucketing differs across timezones for the same UTC timestamp", () => {
  const inputs = {
    problems: [{ id: "p1", tags: ["数组"] }],
    acSubmissions: [{ problemId: "p1", createdAt: "2026-04-14T00:30:00.000Z" }],
    now: new Date("2026-04-14T12:00:00.000Z"),
    windowDays: 1,
    topTagCount: 1
  };

  const shanghai = buildProgressOverview({ ...inputs, timeZone: "Asia/Shanghai" });
  const losAngeles = buildProgressOverview({ ...inputs, timeZone: "America/Los_Angeles" });

  assert.equal(shanghai.heatmap.days[0].date, "2026-04-14");
  assert.equal(shanghai.heatmap.days[0].acCount, 1);

  assert.equal(losAngeles.heatmap.days[0].date, "2026-04-14");
  assert.equal(losAngeles.heatmap.days[0].acCount, 0);
});

test("assertValidIanaTimeZone rejects malformed and unsupported timezone", () => {
  assert.throws(() => assertValidIanaTimeZone(""), /Invalid timezone format/);
  assert.throws(() => assertValidIanaTimeZone("../../etc/passwd"), /Invalid timezone format/);
  assert.throws(() => assertValidIanaTimeZone("Mars/OlympusMons"), /Unsupported timezone/);
  assert.doesNotThrow(() => assertValidIanaTimeZone("Asia/Shanghai"));
});
