import test from "node:test";
import assert from "node:assert/strict";

import { formatAcmInputFromCoreInput, getProblemAdapter } from "../src/problem-adapters.mjs";

test("two-sum adapter parses input and normalizes output", () => {
  const adapter = getProblemAdapter("two-sum");
  assert.ok(adapter);

  const parsedInput = adapter.parseInput("nums = [2,7,11,15], target = 9");
  assert.deepEqual(parsedInput, { nums: [2, 7, 11, 15], target: 9 });

  const parsedExpected = adapter.parseExpected("[0,1]");
  assert.equal(parsedExpected, "[0,1]");

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
  assert.equal(parsedExpected, "true");

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
  assert.equal(parsedExpected, "49");

  const stdin = adapter.toAcmStdin(parsedInput);
  assert.equal(stdin, "9\n1 8 6 2 5 4 8 3 7\n");

  assert.equal(adapter.normalizeAcmOutput("49\n"), "49");
  assert.equal(adapter.normalizeCoreResult(49), "49");
  assert.equal(adapter.normalizeExpected(parsedExpected), "49");
});

test("unknown problem falls back to generic acm adapter", () => {
  const adapter = getProblemAdapter("unknown-problem");
  assert.ok(adapter);

  const parsedInput = adapter.parseInput("hello\nworld");
  const stdin = adapter.toAcmStdin(parsedInput);
  const normalizedExpected = adapter.normalizeExpected(adapter.parseExpected("foo   bar"));
  const normalizedActual = adapter.normalizeAcmOutput("foo\nbar");

  assert.equal(stdin, "hello\nworld\n");
  assert.equal(normalizedExpected, "foo bar");
  assert.equal(normalizedActual, "foo bar");
});

test("metadata adapter converts key-value input to acm stdin", () => {
  const stdin = formatAcmInputFromCoreInput("subarray-sum-equals-k", "nums = [1,2,3], k = 3");
  assert.equal(stdin, "3\n1 2 3\n3\n");
});

test("three-sum output normalization is order-insensitive", () => {
  const adapter = getProblemAdapter("3sum");
  const expected = adapter.normalizeExpected("[[-1,-1,2],[-1,0,1]]");
  const actual = adapter.normalizeAcmOutput("[[-1,0,1],[-1,-1,2]]\n");

  assert.equal(expected, actual);
});

test("group-anagrams output normalization ignores group and item order", () => {
  const adapter = getProblemAdapter("group-anagrams");
  const expected = adapter.normalizeExpected('[[\"eat\",\"tea\",\"ate\"],[\"tan\",\"nat\"],[\"bat\"]]');
  const actual = adapter.normalizeAcmOutput('[[\"bat\"],[\"nat\",\"tan\"],[\"ate\",\"eat\",\"tea\"]]');

  assert.equal(expected, actual);
});

test("design problem supports one-line dual-array input in acm conversion", () => {
  const adapter = getProblemAdapter("lru-cache");
  assert.ok(adapter);

  const parsedInput = adapter.parseInput(
    '["LRUCache","put","put","get"] [[2],[1,1],[2,2],[1]]'
  );
  const stdin = adapter.toAcmStdin(parsedInput);

  assert.equal(stdin, '["LRUCache","put","put","get"]\n[[2],[1,1],[2,2],[1]]\n');
});

test("design problem output normalization keeps full JSON array shape", () => {
  const adapter = getProblemAdapter("lru-cache");
  assert.ok(adapter);

  const expected = adapter.normalizeExpected("[null,null,null,1,null,-1,null,-1,3,4]");
  const actual = adapter.normalizeAcmOutput("[null,null,null,1,null,-1,null,-1,3,4]\n");
  const wrong = adapter.normalizeAcmOutput("1\n");

  assert.equal(expected, "[null,null,null,1,null,-1,null,-1,3,4]");
  assert.equal(actual, expected);
  assert.notEqual(wrong, expected);
});

test("adapter accepts legacy list parameter aliases for merge-two-sorted-lists", () => {
  const stdin = formatAcmInputFromCoreInput("merge-two-sorted-lists", "l1 = [1,2,4], l2 = [1,3,4]");
  assert.equal(stdin, "3\n1 2 4\n3\n1 3 4\n");
});

test("adapter parses single-quoted char matrix inputs", () => {
  const stdin = formatAcmInputFromCoreInput(
    "number-of-islands",
    "grid = [['1','1','1'],['1','0','1'],['1','1','1']]"
  );
  assert.equal(stdin, "3\n3\n1 1 1\n3\n1 0 1\n3\n1 1 1\n");
});

test("adapter parses positional first argument for malformed key-value input", () => {
  const stdin = formatAcmInputFromCoreInput("kth-largest-element-in-an-array", "[3,2,1,5,6,4], k = 2");
  assert.equal(stdin, "6\n3 2 1 5 6 4\n2\n");
});

test("generic adapter normalizes JSON whitespace differences", () => {
  const adapter = getProblemAdapter("another-unknown-problem");
  assert.ok(adapter);

  const expected = adapter.normalizeExpected(adapter.parseExpected("[null, null, 1, [2, 3]]"));
  const actual = adapter.normalizeAcmOutput("[null,null,1,[2,3]]\n");

  assert.equal(expected, "[null,null,1,[2,3]]");
  assert.equal(actual, "[null,null,1,[2,3]]");
});

test("adapter rejects malformed test case input", () => {
  const adapter = getProblemAdapter("two-sum");
  assert.ok(adapter);

  assert.throws(() => adapter.parseInput("nums=[1,2,3]"), /Invalid two-sum input/i);
});
