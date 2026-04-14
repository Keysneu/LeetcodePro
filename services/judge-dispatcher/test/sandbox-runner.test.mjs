import test from "node:test";
import assert from "node:assert/strict";

import { extractMemoryMarker } from "../src/sandbox-runner.mjs";

test("extractMemoryMarker parses standalone marker line", () => {
  const extracted = extractMemoryMarker("stderr line\n__LC_MEMORY_KB__=1234\n");
  assert.equal(extracted.memoryKb, 1234);
  assert.equal(extracted.stderr, "stderr line");
});

test("extractMemoryMarker parses marker appended to stderr line", () => {
  const extracted = extractMemoryMarker("Traceback...__LC_MEMORY_KB__=2048");
  assert.equal(extracted.memoryKb, 2048);
  assert.equal(extracted.stderr, "Traceback...");
});

test("extractMemoryMarker keeps suffix text after marker value", () => {
  const extracted = extractMemoryMarker("__LC_MEMORY_KB__=4096panic");
  assert.equal(extracted.memoryKb, 4096);
  assert.equal(extracted.stderr, "panic");
});

test("extractMemoryMarker keeps original stderr when marker missing", () => {
  const extracted = extractMemoryMarker("only stderr");
  assert.equal(extracted.memoryKb, null);
  assert.equal(extracted.stderr, "only stderr");
});
