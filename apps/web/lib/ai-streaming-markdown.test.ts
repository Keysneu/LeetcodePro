import * as assert from "node:assert/strict";
import { test } from "node:test";

import { prepareStreamingMarkdown } from "./ai-streaming-markdown";

test("prepareStreamingMarkdown closes an unfinished backtick fence while streaming", () => {
  const markdown = prepareStreamingMarkdown("```cpp\nint main() {", { isStreaming: true });

  assert.equal(markdown, "```cpp\nint main() {\n```");
});

test("prepareStreamingMarkdown closes an unfinished tilde fence while preserving marker length", () => {
  const markdown = prepareStreamingMarkdown("~~~~python\nprint(1)", { isStreaming: true });

  assert.equal(markdown, "~~~~python\nprint(1)\n~~~~");
});

test("prepareStreamingMarkdown closes inline code and strong markers only while streaming", () => {
  const streaming = prepareStreamingMarkdown("这里是 `nums 和 **target", { isStreaming: true });
  const final = prepareStreamingMarkdown("这里是 `nums 和 **target", { isStreaming: false });

  assert.equal(streaming, "这里是 `nums 和 **target`**");
  assert.equal(final, "这里是 `nums 和 **target");
});

test("prepareStreamingMarkdown ignores inline markers inside fenced code", () => {
  const markdown = prepareStreamingMarkdown("```md\n**not closed\n```", { isStreaming: true });

  assert.equal(markdown, "```md\n**not closed\n```");
});

test("prepareStreamingMarkdown normalizes CRLF while keeping completed markdown stable", () => {
  const markdown = prepareStreamingMarkdown("## 标题\r\n\r\n- A\r\n- B", { isStreaming: true });

  assert.equal(markdown, "## 标题\n\n- A\n- B");
});

test("prepareStreamingMarkdown preserves meaningful trailing newlines while streaming", () => {
  const markdown = prepareStreamingMarkdown("## 标题\n\n", { isStreaming: true });

  assert.equal(markdown, "## 标题\n\n");
});

test("prepareStreamingMarkdown closes incomplete links and images while streaming", () => {
  const link = prepareStreamingMarkdown("参考 [官方文档](https://api-docs.deepseek.com", {
    isStreaming: true
  });
  const image = prepareStreamingMarkdown("示意图 ![复杂度", { isStreaming: true });

  assert.equal(link, "参考 [官方文档](https://api-docs.deepseek.com)");
  assert.equal(image, "示意图 ![复杂度]");
});

test("prepareStreamingMarkdown completes a partial GFM table separator line", () => {
  const markdown = prepareStreamingMarkdown("| 状态 | 含义 |\n| --- | ---", {
    isStreaming: true
  });

  assert.equal(markdown, "| 状态 | 含义 |\n| --- | --- |");
});
