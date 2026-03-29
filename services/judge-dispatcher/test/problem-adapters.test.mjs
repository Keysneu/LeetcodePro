import test from "node:test";
import assert from "node:assert/strict";

import { getProblemAdapter } from "../src/problem-adapters.mjs";

test("two-sum adapter parses input and normalizes output", () => {
  const adapter = getProblemAdapter("two-sum");
  assert.ok(adapter);

  const parsedInput = adapter.parseInput("nums = [2,7,11,15], target = 9");
  assert.deepEqual(parsedInput, { nums: [2, 7, 11, 15], target: 9 });

  const parsedExpected = adapter.parseExpected("[0,1]");
  assert.deepEqual(parsedExpected, [0, 1]);

  const stdin = adapter.toAcmStdin(parsedInput);
  assert.equal(stdin, "4\n2 7 11 15\n9\n");

  assert.equal(adapter.normalizeAcmOutput("1 0\n"), "[0,1]");
  assert.equal(adapter.normalizeCoreResult([1, 0]), "[0,1]");
  assert.equal(adapter.normalizeExpected(parsedExpected), "[0,1]");
});

test("valid-parentheses adapter parses input and bool outputs", () => {
  const adapter = getProblemAdapter("valid-parentheses");
  assert.ok(adapter);

  const parsedInput = adapter.parseInput('s = "()[]{}"');
  assert.deepEqual(parsedInput, { s: "()[]{}" });

  const parsedExpected = adapter.parseExpected("true");
  assert.equal(parsedExpected, true);

  const stdin = adapter.toAcmStdin(parsedInput);
  assert.equal(stdin, "()[]{}\n");

  assert.equal(adapter.normalizeAcmOutput("TRUE\n"), "true");
  assert.equal(adapter.normalizeCoreResult(false), "false");
  assert.equal(adapter.normalizeExpected(parsedExpected), "true");
});

test("container adapter parses input and integer outputs", () => {
  const adapter = getProblemAdapter("container-with-most-water");
  assert.ok(adapter);

  const parsedInput = adapter.parseInput("height = [1,8,6,2,5,4,8,3,7]");
  assert.deepEqual(parsedInput, { height: [1, 8, 6, 2, 5, 4, 8, 3, 7] });

  const parsedExpected = adapter.parseExpected("49");
  assert.equal(parsedExpected, 49);

  const stdin = adapter.toAcmStdin(parsedInput);
  assert.equal(stdin, "9\n1 8 6 2 5 4 8 3 7\n");

  assert.equal(adapter.normalizeAcmOutput("49\n"), "49");
  assert.equal(adapter.normalizeCoreResult(49), "49");
  assert.equal(adapter.normalizeExpected(parsedExpected), "49");
});

test("unsupported problem returns null adapter", () => {
  assert.equal(getProblemAdapter("unknown-problem"), null);
});

test("adapter rejects malformed test case input", () => {
  const adapter = getProblemAdapter("two-sum");
  assert.ok(adapter);

  assert.throws(() => adapter.parseInput("nums=[1,2,3]"), /Invalid two-sum input/i);
});
