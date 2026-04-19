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
  assert.ok(result.caseResults.every((item) => typeof item.actualOutput === "string" && item.actualOutput.length > 0));

  const caseMemories = result.caseResults
    .map((item) => item.memoryKb)
    .filter((value) => typeof value === "number" && Number.isFinite(value) && value > 0);
  if (caseMemories.length > 0) {
    assert.equal(result.memoryKb, Math.max(...caseMemories));
  } else {
    assert.equal(result.memoryKb, null);
  }
});

test("python acm mode accepts raw stdin custom test cases", async () => {
  const submission = {
    problemSlug: "two-sum",
    language: "python",
    mode: "acm",
    code: `import sys

data = sys.stdin.read().strip().splitlines()
if len(data) < 3:
    print("[]")
    raise SystemExit(0)

nums = list(map(int, data[1].split()))
target = int(data[2])
seen = {}

for index, value in enumerate(nums):
    need = target - value
    if need in seen:
        print(f"[{seen[need]},{index}]")
        break
    seen[value] = index
else:
    print("[]")
`
  };

  const result = await judgeSubmissionWithCases(
    submission,
    [
      {
        id: "case-1",
        inputData: "4\n2 7 11 15\n9\n",
        expectedOutput: "[0,1]"
      }
    ],
    { caseInputFormat: "stdin" }
  );

  assert.equal(result.status, "AC");
  assert.equal(result.passedCount, 1);
  assert.equal(result.caseResults[0].status, "AC");
});

test("python core mode accepts positional array input for single-parameter problems", async () => {
  const submission = {
    problemSlug: "container-with-most-water",
    language: "python",
    mode: "core",
    code: `def maxArea(height):
    left = 0
    right = len(height) - 1
    best = 0
    while left < right:
      best = max(best, (right - left) * min(height[left], height[right]))
      if height[left] < height[right]:
        left += 1
      else:
        right -= 1
    return best
`
  };
  const testCases = [{ id: "case-1", inputData: "[1,8,6,2,5,4,8,3,7]", expectedOutput: "49" }];

  const result = await judgeSubmissionWithCases(submission, testCases);

  assert.equal(result.status, "AC");
  assert.equal(result.passedCount, 1);
  assert.ok(result.caseResults.every((item) => item.status === "AC"));
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

test("cpp core mode accepts positional array input for single-parameter problems", async () => {
  const submission = {
    problemSlug: "container-with-most-water",
    language: "cpp",
    mode: "core",
    code: `class Solution {
public:
  int maxArea(vector<int>& height) {
    int right = 0;
    int left = static_cast<int>(height.size()) - 1;
    int maxValue = 0;
    while (right < left) {
      const int currentValue = (left - right) * min(height[right], height[left]);
      maxValue = max(maxValue, currentValue);
      if (height[right] < height[left]) {
        right += 1;
      } else {
        left -= 1;
      }
    }
    return maxValue;
  }
};`
  };
  const testCases = [{ id: "case-1", inputData: "[1,8,6,2,5,4,8,3,7]", expectedOutput: "49" }];

  const result = await judgeSubmissionWithCases(submission, testCases);

  assert.equal(result.status, "AC");
  assert.equal(result.passedCount, 1);
  assert.ok(result.caseResults.every((item) => item.status === "AC"));
});

test("cpp core mode handles markdown-ticked vector input for move-zeroes", async () => {
  const submission = {
    problemSlug: "move-zeroes",
    language: "cpp",
    mode: "core",
    code: `class Solution {
public:
  void moveZeroes(vector<int>& nums) {
    int slow = 0;
    const int n = static_cast<int>(nums.size());
    for (int fast = 0; fast < n; ++fast) {
      if (nums[fast] != 0) {
        swap(nums[slow], nums[fast]);
        slow += 1;
      }
    }
  }
};`
  };
  const testCases = [
    {
      id: "case-1",
      inputData: "nums = `[0,1,0,3,12]`",
      expectedOutput: "[1,3,12,0,0]"
    }
  ];

  const result = await judgeSubmissionWithCases(submission, testCases);

  assert.equal(result.status, "AC");
  assert.equal(result.passedCount, 1);
  assert.ok(result.caseResults.every((item) => item.status === "AC"));
});

test("cpp acm mode remains isolated for move-zeroes", async () => {
  const submission = {
    problemSlug: "move-zeroes",
    language: "cpp",
    mode: "acm",
    code: `#include <algorithm>
#include <iostream>
#include <vector>
using namespace std;

int main() {
  ios::sync_with_stdio(false);
  cin.tie(nullptr);

  int n = 0;
  if (!(cin >> n)) return 0;
  vector<int> nums(n);
  for (int i = 0; i < n; ++i) cin >> nums[i];

  int slow = 0;
  for (int fast = 0; fast < n; ++fast) {
    if (nums[fast] != 0) {
      swap(nums[slow], nums[fast]);
      slow += 1;
    }
  }

  cout << "[";
  for (int i = 0; i < n; ++i) {
    if (i) cout << ",";
    cout << nums[i];
  }
  cout << "]";
  return 0;
}`
  };
  const testCases = [
    {
      id: "case-1",
      inputData: "nums = `[0,1,0,3,12]`",
      expectedOutput: "[1,3,12,0,0]"
    }
  ];

  const result = await judgeSubmissionWithCases(submission, testCases);

  assert.equal(result.status, "AC");
  assert.equal(result.passedCount, 1);
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

test("python acm mode accepts order-insensitive three-sum output", async () => {
  const submission = {
    problemSlug: "3sum",
    language: "python",
    mode: "acm",
    code: `import sys
_ = sys.stdin.read()
print([[-1,0,1],[-1,-1,2]])
`
  };
  const testCases = [
    { id: "case-1", inputData: "nums = [-1,0,1,2,-1,-4]", expectedOutput: "[[-1,-1,2],[-1,0,1]]" }
  ];

  const result = await judgeSubmissionWithCases(submission, testCases);

  assert.equal(result.status, "AC");
  assert.equal(result.passedCount, 1);
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

test("python core mode serializes empty linked-list result as []", async () => {
  const submission = {
    problemSlug: "remove-nth-node-from-end-of-list",
    language: "python",
    mode: "core",
    code: `def removeNthFromEnd(head, n):
    dummy = ListNode(0, head)
    fast = dummy
    slow = dummy
    for _ in range(n):
        fast = fast.next
    while fast.next:
        fast = fast.next
        slow = slow.next
    slow.next = slow.next.next
    return dummy.next
`
  };
  const testCases = [{ id: "case-1", inputData: "head = [1], n = 1", expectedOutput: "[]" }];

  const result = await judgeSubmissionWithCases(submission, testCases);

  assert.equal(result.status, "AC");
  assert.equal(result.passedCount, 1);
  assert.equal(result.caseResults[0].actualOutput, "[]");
});

test("cpp core mode accepts vector<vector<char>> input conversion", async () => {
  const submission = {
    problemSlug: "number-of-islands",
    language: "cpp",
    mode: "core",
    code: `class Solution {
public:
  int numIslands(vector<vector<char>>& grid) {
    return static_cast<int>(grid.size());
  }
};`
  };
  const testCases = [{ id: "case-1", inputData: "grid = [[\"1\"],[\"0\"]]", expectedOutput: "2" }];

  const result = await judgeSubmissionWithCases(submission, testCases);

  assert.notEqual(result.status, "CE");
  assert.equal(result.caseResults[0].status, "AC");
});

test("design problems do not treat scalar-only output as valid", async () => {
  const submission = {
    problemSlug: "lru-cache",
    language: "python",
    mode: "core",
    code: `class LRUCache:
    def __init__(self, capacity: int):
        pass

    def get(self, key: int) -> int:
        return 1

    def put(self, key: int, value: int) -> None:
        pass
`
  };
  const testCases = [
    {
      id: "case-1",
      inputData: "[\"LRUCache\", \"put\", \"put\", \"get\", \"put\", \"get\", \"put\", \"get\", \"get\", \"get\"] [[2], [1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]]",
      expectedOutput: "[null, null, null, 1, null, -1, null, -1, 3, 4]"
    }
  ];

  const result = await judgeSubmissionWithCases(submission, testCases);

  assert.equal(result.status, "WA");
  assert.equal(result.passedCount, 0);
  assert.equal(result.caseResults[0].actualOutput, "[null,null,null,1,null,1,null,1,1,1]");
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
