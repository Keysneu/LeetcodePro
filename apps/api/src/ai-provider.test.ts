import * as assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeAiProvider } from "./ai-provider";

test("normalizeAiProvider returns null when value is missing or unsupported", () => {
  assert.equal(normalizeAiProvider(undefined), null);
  assert.equal(normalizeAiProvider(null), null);
  assert.equal(normalizeAiProvider(""), null);
  assert.equal(normalizeAiProvider("mock"), null);
  assert.equal(normalizeAiProvider("openai"), null);
});

test("normalizeAiProvider normalizes valid providers", () => {
  assert.equal(normalizeAiProvider("vllm"), "vllm");
  assert.equal(normalizeAiProvider("VLLM"), "vllm");
  assert.equal(normalizeAiProvider(" minimax "), "minimax");
  assert.equal(normalizeAiProvider("DeepSeek"), "deepseek");
});
