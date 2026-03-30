import { test } from "node:test";
import * as assert from "node:assert/strict";

import { matchMarkdownToProblems, ProblemRow } from "./notes-matcher";

const mockProblems: ProblemRow[] = [
  {
    id: "p-24",
    leetcodeId: 24,
    slug: "swap-nodes-in-pairs",
    title: "两两交换链表中的节点"
  },
  {
    id: "p-25",
    leetcodeId: 25,
    slug: "reverse-nodes-in-k-group",
    title: "K 个一组翻转链表"
  }
];

test("matches note sections by boundary lines between problem markers", () => {
  const markdown = `
24. 两两交换链表中的节点（递归）
思路A
代码A

25.K个一组翻转链表（困难）
思路B
代码B
`.trim();

  const result = matchMarkdownToProblems(markdown, "notes", mockProblems);

  assert.equal(result.totalSections, 2);
  assert.equal(result.unmatchedSectionCount, 0);
  assert.equal(result.matchedNotes.length, 2);

  const note24 = result.matchedNotes.find((item) => item.problem.slug === "swap-nodes-in-pairs");
  const note25 = result.matchedNotes.find((item) => item.problem.slug === "reverse-nodes-in-k-group");

  assert.ok(note24);
  assert.ok(note25);

  assert.match(note24.contentMd, /思路A/);
  assert.doesNotMatch(note24.contentMd, /思路B/);
  assert.match(note25.contentMd, /思路B/);
  assert.doesNotMatch(note25.contentMd, /思路A/);
});

test("supports markdown heading style marker lines", () => {
  const markdown = `
# 24. 两两交换链表中的节点（我的做法）
内容1

## 25. K 个一组翻转链表（迭代）
内容2
`.trim();

  const result = matchMarkdownToProblems(markdown, "notes", mockProblems);

  assert.equal(result.matchedNotes.length, 2);
  assert.equal(result.unmatchedSectionCount, 0);
});
