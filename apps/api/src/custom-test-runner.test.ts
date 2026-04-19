import * as assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { normalizeCustomTestCases } from "./custom-test-runner";

test("normalizeCustomTestCases accepts output alias and preserves input text", () => {
  const cases = normalizeCustomTestCases([
    {
      id: "case-a",
      title: "样例 1",
      input: "nums = [2,7,11,15], target = 9",
      output: "[0,1]"
    }
  ]);

  assert.deepEqual(cases, [
    {
      id: "case-a",
      title: "样例 1",
      inputData: "nums = [2,7,11,15], target = 9",
      expectedOutput: "[0,1]"
    }
  ]);
});

test("normalizeCustomTestCases fills fallback id and title", () => {
  const cases = normalizeCustomTestCases([
    {
      input: "nums = [1,2], target = 3",
      expectedOutput: "[0,1]"
    }
  ]);

  assert.deepEqual(cases, [
    {
      id: "custom-case-1",
      title: "Case 1",
      inputData: "nums = [1,2], target = 3",
      expectedOutput: "[0,1]"
    }
  ]);
});

test("normalizeCustomTestCases rejects empty list", () => {
  assert.throws(() => normalizeCustomTestCases([]), BadRequestException);
});

test("normalizeCustomTestCases rejects missing output", () => {
  assert.throws(
    () =>
      normalizeCustomTestCases([
        {
          input: "nums = [1,2]"
        }
      ]),
    BadRequestException
  );
});
