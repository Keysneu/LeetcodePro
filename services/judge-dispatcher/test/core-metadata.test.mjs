import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildCppCoreProgram, buildPythonCoreProgram } from "../src/core-wrapper.mjs";

const metadataPath = new URL("../src/core-metadata.json", import.meta.url);
const coreMetadata = JSON.parse(readFileSync(metadataPath, "utf8"));

test("all solution metadata entries define at least one callable method", () => {
  for (const [slug, meta] of Object.entries(coreMetadata)) {
    if (meta.kind !== "solution") {
      continue;
    }

    assert.ok(Array.isArray(meta.methods), `${slug}: methods should be an array`);
    assert.ok(
      meta.methods.some((item) => item.returnType !== null),
      `${slug}: should contain at least one executable solution method`
    );
  }
});

test("linked-list-cycle-ii metadata keeps LeetCode detectCycle signature", () => {
  const meta = coreMetadata["linked-list-cycle-ii"];
  assert.ok(meta);
  assert.equal(meta.className, "Solution");
  assert.deepEqual(meta.methods, [
    {
      name: "detectCycle",
      returnType: "ListNode*",
      params: [{ type: "ListNode*", name: "head" }]
    }
  ]);
});

test("intersection-of-two-linked-lists metadata keeps LeetCode getIntersectionNode signature", () => {
  const meta = coreMetadata["intersection-of-two-linked-lists"];
  assert.ok(meta);
  assert.equal(meta.className, "Solution");
  assert.deepEqual(meta.methods, [
    {
      name: "getIntersectionNode",
      returnType: "ListNode*",
      params: [
        { type: "ListNode*", name: "headA" },
        { type: "ListNode*", name: "headB" }
      ]
    }
  ]);
});

test("copy-list-with-random-pointer metadata keeps LeetCode solution signature", () => {
  const meta = coreMetadata["copy-list-with-random-pointer"];
  assert.ok(meta);
  assert.equal(meta.kind, "solution");
  assert.equal(meta.className, "Solution");
  assert.deepEqual(meta.methods, [
    {
      name: "copyRandomList",
      returnType: "Node*",
      params: [{ type: "Node*", name: "head" }]
    }
  ]);
});

test("core wrapper normalizes linked-list pointer return values to stable scalars", () => {
  const dummyCode = "class Solution {};";
  const cycleProgram = buildCppCoreProgram("linked-list-cycle-ii", dummyCode);
  const intersectionProgram = buildCppCoreProgram("intersection-of-two-linked-lists", dummyCode);
  const pythonProgram = buildPythonCoreProgram("linked-list-cycle-ii", "class Solution:\n    pass\n");

  assert.match(cycleProgram, /const int __entry_index = __list_index_of_node\(__head, __result\);/);
  assert.match(intersectionProgram, /__print_json\(__result->val\);/);
  assert.match(pythonProgram, /output = _list_index_of_node\(head_value, result\)/);
});
