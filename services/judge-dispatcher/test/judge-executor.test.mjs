import test from "node:test";
import assert from "node:assert/strict";

import { judgeSubmissionWithCases } from "../src/judge-executor.mjs";

const testCasesTwoSum = [
  {
    id: "case-1",
    inputData: "nums = [2,7,11,15], target = 9",
    expectedOutput: "[0,1]"
  },
  {
    id: "case-2",
    inputData: "nums = [3,2,4], target = 6",
    expectedOutput: "[1,2]"
  }
];

test("python core mode accepts correct two-sum function", async () => {
  const submission = {
    problemSlug: "two-sum",
    language: "python",
    mode: "core",
    code: `def twoSum(nums, target):\n    seen = {}\n    for i, value in enumerate(nums):\n        need = target - value\n        if need in seen:\n            return [seen[need], i]\n        seen[value] = i\n    return []\n`
  };

  const result = await judgeSubmissionWithCases(submission, testCasesTwoSum);

  assert.equal(result.status, "AC");
  assert.equal(result.passedCount, 2);
  assert.equal(result.caseResults.length, 2);
  assert.ok(result.caseResults.every((item) => item.status === "AC"));
});

test("python acm mode reports WA for wrong output", async () => {
  const submission = {
    problemSlug: "two-sum",
    language: "python",
    mode: "acm",
    code: `import sys\n_ = sys.stdin.read()\nprint("0 0")\n`
  };

  const result = await judgeSubmissionWithCases(submission, testCasesTwoSum);

  assert.equal(result.status, "WA");
  assert.equal(result.passedCount, 0);
  assert.ok(result.caseResults.every((item) => item.status === "WA"));
});

test("cpp core mode reports CE on compilation error", async () => {
  const submission = {
    problemSlug: "two-sum",
    language: "cpp",
    mode: "core",
    code: "vector<int> twoSum(vector<int>& nums, int target) { return [; }"
  };

  const result = await judgeSubmissionWithCases(submission, testCasesTwoSum);

  assert.equal(result.status, "CE");
  assert.equal(result.passedCount, 0);
  assert.ok(result.caseResults.every((item) => item.status === "CE"));
});
