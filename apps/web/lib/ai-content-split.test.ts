import * as assert from "node:assert/strict";
import { test } from "node:test";

import { splitAssistantDisplayContent } from "./ai-content-split";

test("semantic reasoning stream has priority and strips explicit think tags from answer", () => {
  const result = splitAssistantDisplayContent(
    "语义思考流",
    "<think>模型正文中的思考</think>\n\n最终回答"
  );

  assert.equal(result.reasoning, "语义思考流");
  assert.equal(result.answer, "最终回答");
});

test("explicit think tags are used when semantic reasoning is absent", () => {
  const result = splitAssistantDisplayContent(
    "",
    "<think>先定位失败样例</think>\n\n主要问题：窗口没有收缩"
  );

  assert.equal(result.reasoning, "先定位失败样例");
  assert.equal(result.answer, "主要问题：窗口没有收缩");
});

test("thought-prefixed content falls back to heuristic split", () => {
  const result = splitAssistantDisplayContent(
    "",
    "Thought 1. inspect failure case\n2. compare output and expected\n3. locate boundary branch\n\n最终回答：优先检查空数组分支。"
  );

  assert.match(result.reasoning, /inspect failure case/);
  assert.equal(result.answer, "优先检查空数组分支。");
});

test("reasoning can render before the answer starts streaming", () => {
  const result = splitAssistantDisplayContent("正在分析失败样例", "");

  assert.equal(result.reasoning, "正在分析失败样例");
  assert.equal(result.answer, "");
});

test("plain answer remains content when no reasoning signal exists", () => {
  const result = splitAssistantDisplayContent("", "主要问题：哈希表写入时机过晚。");

  assert.equal(result.reasoning, "");
  assert.equal(result.answer, "主要问题：哈希表写入时机过晚。");
});
