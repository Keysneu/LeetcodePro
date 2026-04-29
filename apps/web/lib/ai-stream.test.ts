import * as assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyAiStreamFrameToState,
  consumeSseFrames,
  createInitialAiStreamState,
  normalizeAiStreamFrame,
  parseSseBlock,
  type AiStreamState,
  type SseFrame
} from "./ai-stream";

function applyFrames(contentField: "guidance" | "editorial", frames: SseFrame[]): AiStreamState {
  let state = createInitialAiStreamState();
  for (const frame of frames) {
    state = applyAiStreamFrameToState(state, normalizeAiStreamFrame(frame), contentField).state;
  }
  return state;
}

test("consumeSseFrames supports LF, CRLF, and preserves incomplete tail", () => {
  const parsed = consumeSseFrames(
    [
      "event: meta\r\n",
      'data: {"source":"api-proxy"}\r\n',
      "\r\n",
      "event: response.output_text.delta\n",
      'data: {"delta":"hello"}\n',
      "\n",
      "event: phase\n",
      'data: {"stage":"prepare"}'
    ].join("")
  );

  assert.equal(parsed.frames.length, 2);
  assert.deepEqual(parsed.frames[0], {
    event: "meta",
    data: '{"source":"api-proxy"}'
  });
  assert.deepEqual(parsed.frames[1], {
    event: "response.output_text.delta",
    data: '{"delta":"hello"}'
  });
  assert.equal(parsed.rest, 'event: phase\ndata: {"stage":"prepare"}');
});

test("parseSseBlock joins multi-line data fields", () => {
  const parsed = parseSseBlock("event: delta\ndata: first\ndata: second");

  assert.deepEqual(parsed, {
    event: "delta",
    data: "first\nsecond"
  });
});

test("applyAiStreamFrameToState separates reasoning and content deltas", () => {
  const state = applyFrames("guidance", [
    {
      event: "response.reasoning_summary_text.delta",
      data: '{"delta":"先检查失败样例。"}'
    },
    {
      event: "response.output_text.delta",
      data: '{"delta":"主要问题"}'
    },
    {
      event: "delta",
      data: '{"delta":"：边界遗漏"}'
    }
  ]);

  assert.equal(state.reasoning, "先检查失败样例。");
  assert.equal(state.content, "主要问题：边界遗漏");
  assert.equal(state.doneReceived, false);
});

test("applyAiStreamFrameToState ignores duplicated legacy delta after semantic content delta", () => {
  const state = applyFrames("guidance", [
    {
      event: "response.output_text.delta",
      data: '{"delta":"```cpp\\n"}'
    },
    {
      event: "delta",
      data: '{"delta":"```cpp\\n"}'
    },
    {
      event: "response.output_text.delta",
      data: '{"delta":"int main() {}\\n```"}'
    },
    {
      event: "delta",
      data: '{"delta":"int main() {}\\n```"}'
    }
  ]);

  assert.equal(state.content, "```cpp\nint main() {}\n```");
});

test("applyAiStreamFrameToState keeps repeated legacy-only deltas", () => {
  const state = applyFrames("guidance", [
    {
      event: "delta",
      data: '{"delta":"a"}'
    },
    {
      event: "delta",
      data: '{"delta":"a"}'
    }
  ]);

  assert.equal(state.content, "aa");
});

test("applyAiStreamFrameToState applies replace snapshots and final done payload", () => {
  const state = applyFrames("editorial", [
    {
      event: "response.output_text.delta",
      data: '{"delta":"old"}'
    },
    {
      event: "response.output_text.replace",
      data: '{"text":"snapshot"}'
    },
    {
      event: "done",
      data: '{"editorial":"final answer","reasoningSummary":"final thinking"}'
    }
  ]);

  assert.equal(state.content, "final answer");
  assert.equal(state.reasoning, "final thinking");
  assert.equal(state.doneReceived, true);
  assert.equal(state.error, "");
});

test("applyAiStreamFrameToState keeps error while allowing completion metadata", () => {
  const state = applyFrames("guidance", [
    {
      event: "error",
      data: '{"message":"upstream failed"}'
    },
    {
      event: "response.completed",
      data: '{"guidance":"","error":"final error"}'
    }
  ]);

  assert.equal(state.doneReceived, true);
  assert.equal(state.error, "final error");
  assert.equal(state.content, "");
});
