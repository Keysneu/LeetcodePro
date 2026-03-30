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

test("cpp core mode accepts leetcode style solution class", async () => {
  const submission = {
    problemSlug: "two-sum",
    language: "cpp",
    mode: "core",
    code: `class Solution {
public:
  vector<int> twoSum(vector<int>& nums, int target) {
    unordered_map<int, int> seen;
    for (int i = 0; i < static_cast<int>(nums.size()); ++i) {
      const int need = target - nums[i];
      auto it = seen.find(need);
      if (it != seen.end()) {
        return {it->second, i};
      }
      seen[nums[i]] = i;
    }
    return {};
  }
};`
  };

  const result = await judgeSubmissionWithCases(submission, testCasesTwoSum);

  assert.equal(result.status, "AC");
  assert.equal(result.passedCount, 2);
  assert.ok(result.caseResults.every((item) => item.status === "AC"));
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

test("python core mode supports non-legacy hot100 slug", async () => {
  const submission = {
    problemSlug: "jump-game-ii",
    language: "python",
    mode: "core",
    code: `class Solution:
    def jump(self, nums):
        steps = 0
        end = 0
        farthest = 0
        for i in range(len(nums) - 1):
            farthest = max(farthest, i + nums[i])
            if i == end:
                steps += 1
                end = farthest
        return steps
`
  };
  const testCases = [
    { id: "case-1", inputData: "nums = [2,3,1,1,4]", expectedOutput: "2" },
    { id: "case-2", inputData: "nums = [2,3,0,1,4]", expectedOutput: "2" }
  ];

  const result = await judgeSubmissionWithCases(submission, testCases);

  assert.equal(result.status, "AC");
  assert.equal(result.passedCount, 2);
  assert.ok(result.caseResults.every((item) => item.status === "AC"));
});

test("python core mode supports design problems", async () => {
  const submission = {
    problemSlug: "min-stack",
    language: "python",
    mode: "core",
    code: `class MinStack:
    def __init__(self):
        self.stack = []
        self.min_stack = []

    def push(self, val: int) -> None:
        self.stack.append(val)
        if not self.min_stack:
            self.min_stack.append(val)
        else:
            self.min_stack.append(min(val, self.min_stack[-1]))

    def pop(self) -> None:
        self.stack.pop()
        self.min_stack.pop()

    def top(self) -> int:
        return self.stack[-1]

    def getMin(self) -> int:
        return self.min_stack[-1]
`
  };
  const testCases = [
    {
      id: "case-1",
      inputData: "[\"MinStack\",\"push\",\"push\",\"push\",\"getMin\",\"pop\",\"top\",\"getMin\"]\n[[],[-2],[0],[-3],[],[],[],[]]",
      expectedOutput: "[null, null, null, null, -3, null, 0, -2]"
    }
  ];

  const result = await judgeSubmissionWithCases(submission, testCases);

  assert.equal(result.status, "AC");
  assert.equal(result.passedCount, 1);
  assert.ok(result.caseResults.every((item) => item.status === "AC"));
});

test("cpp core mode supports design problems", async () => {
  const submission = {
    problemSlug: "min-stack",
    language: "cpp",
    mode: "core",
    code: `class MinStack {
 private:
  vector<int> st;
  vector<int> mn;

 public:
  MinStack() {}

  void push(int val) {
    st.push_back(val);
    if (mn.empty()) {
      mn.push_back(val);
    } else {
      mn.push_back(min(val, mn.back()));
    }
  }

  void pop() {
    st.pop_back();
    mn.pop_back();
  }

  int top() {
    return st.back();
  }

  int getMin() {
    return mn.back();
  }
};`
  };
  const testCases = [
    {
      id: "case-1",
      inputData: "[\"MinStack\",\"push\",\"push\",\"push\",\"getMin\",\"pop\",\"top\",\"getMin\"]\n[[],[-2],[0],[-3],[],[],[],[]]",
      expectedOutput: "[null, null, null, null, -3, null, 0, -2]"
    }
  ];

  const result = await judgeSubmissionWithCases(submission, testCases);

  assert.equal(result.status, "AC");
  assert.equal(result.passedCount, 1);
  assert.ok(result.caseResults.every((item) => item.status === "AC"));
});
