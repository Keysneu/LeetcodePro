import * as assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeProblemSearchQuery, problemMatchesSearch } from "./problems-search";

const problemFixture = {
  leetcodeId: 1,
  title: "两数之和",
  slug: "two-sum",
  tags: ["数组", "哈希表"]
};

test("normalizeProblemSearchQuery returns null for empty input", () => {
  assert.equal(normalizeProblemSearchQuery(undefined), null);
  assert.equal(normalizeProblemSearchQuery(""), null);
  assert.equal(normalizeProblemSearchQuery("   \n\t  "), null);
});

test("normalizeProblemSearchQuery trims and collapses whitespace", () => {
  assert.equal(normalizeProblemSearchQuery("  两数   之和  "), "两数 之和");
});

test("problemMatchesSearch matches chinese title", () => {
  assert.equal(problemMatchesSearch(problemFixture, "两数"), true);
});

test("problemMatchesSearch matches english slug", () => {
  assert.equal(problemMatchesSearch(problemFixture, "two"), true);
});

test("problemMatchesSearch matches leetcode id", () => {
  assert.equal(problemMatchesSearch(problemFixture, "1"), true);
});

test("problemMatchesSearch matches tags", () => {
  assert.equal(problemMatchesSearch(problemFixture, "哈希"), true);
});

test("problemMatchesSearch returns false when there is no match", () => {
  assert.equal(problemMatchesSearch(problemFixture, "动态规划"), false);
});
