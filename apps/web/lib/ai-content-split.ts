export type AssistantContentSplitResult = {
  reasoning: string;
  answer: string;
};

interface SplitBoundary {
  start: number;
  end: number;
}

const THOUGHT_PREFIX = /^thought\s*/i;
const STEP_LIKE_PATTERN = /(?:^|\n)\s*(?:\d{1,2}[.)]|(?:step|步骤)\s*\d+[:.)]?)\s+/gim;
const DIRECT_MARKERS: RegExp[] = [
  /this leads(?: directly)? to the detailed response provided below\.\)?/i,
  /final output generation\.?\)?/i,
  /(?:final answer|===\s*answer\s*===|最终回答|下面是(?:正式)?回答|以下是(?:详细)?回答)[:：]?/i
];
const ANSWER_LEAD_PATTERN =
  /(?:\n|^)\s*(?:这是|下面|以下|综上|总结|结论|Sure[,，]?|Okay[,，]?|当然[,，]?|好的[,，]?|Now[,，]?|Here(?:'s| is))/m;
const HANDOFF_PATTERN =
  /\((?:self-correction|the final output structure looks good|final output generation)[^)]+\)\s*/i;
const CJK_CHAR = /[\u3400-\u9fff]/;
const REASONING_HINT_PATTERN =
  /(thinking process|analyze the request|execution\s*-?\s*target|self-correction|review and formatting|determine the|strategy|fulfilling specific requirements|core concept|develop the model structure|target \d)/i;
const ANSWER_HINT_PATTERN =
  /^(?:#{1,4}\s+|原句|第一部分|第二部分|第三部分|总结|结论|最终答案|终极答案)|(?:这是一个|以下是|下面是|原句[:：]|终极答案|第一部分|第二部分|第三部分)/m;
const TABLE_HINT_PATTERN = /\|[^|\n]+\|[^|\n]+\|/;

function isCjk(char: string): boolean {
  return CJK_CHAR.test(char);
}

function cjkRatio(text: string): number {
  if (!text) {
    return 0;
  }
  const chars = Array.from(text);
  const cjkCount = chars.filter((char) => isCjk(char)).length;
  return cjkCount / chars.length;
}

function sanitizeAnswer(text: string): string {
  return text.replace(/^[\s:：)\].-]+/, "").trim();
}

function sanitizeText(text: string): string {
  return text.replace(/<\/?think>/gi, "").trim();
}

function extractThinkTagContent(content: string): AssistantContentSplitResult | null {
  const openTagMatch = /<think>/i.exec(content);
  if (!openTagMatch || typeof openTagMatch.index !== "number") {
    return null;
  }

  const openTagEnd = openTagMatch.index + openTagMatch[0].length;
  const closeTagMatch = /<\/think>/i.exec(content.slice(openTagEnd));
  if (!closeTagMatch || typeof closeTagMatch.index !== "number") {
    return {
      reasoning: sanitizeText(content.slice(openTagEnd)),
      answer: sanitizeText(content.slice(0, openTagMatch.index))
    };
  }

  const reasoningStart = openTagEnd;
  const reasoningEnd = openTagEnd + closeTagMatch.index;
  const reasoning = sanitizeText(content.slice(reasoningStart, reasoningEnd));
  const answer = sanitizeText(`${content.slice(0, openTagMatch.index)}${content.slice(reasoningEnd + closeTagMatch[0].length)}`);

  return { reasoning, answer };
}

function findDirectMarkerBoundary(raw: string): SplitBoundary | null {
  for (const pattern of DIRECT_MARKERS) {
    const match = pattern.exec(raw);
    if (match && typeof match.index === "number") {
      return { start: match.index, end: match.index + match[0].length };
    }
  }
  return null;
}

function findStructuredStepBoundary(raw: string): SplitBoundary | null {
  const matches = Array.from(raw.matchAll(STEP_LIKE_PATTERN));
  if (matches.length < 3) {
    return null;
  }

  const last = matches[matches.length - 1];
  const stepEnd = (last.index ?? 0) + last[0].length;
  const tail = raw.slice(stepEnd);
  const paragraphMatch = /\n{2,}([^\n-*\d][\s\S]*)$/m.exec(tail);
  const answerCandidate = (paragraphMatch?.[1] ?? tail).trim();

  if (answerCandidate.length < 24) {
    return null;
  }

  const answerStart = raw.indexOf(answerCandidate, stepEnd);
  if (answerStart <= 0) {
    return null;
  }

  return { start: answerStart, end: answerStart };
}

function findAnswerLeadBoundary(raw: string): SplitBoundary | null {
  const leadMatch = ANSWER_LEAD_PATTERN.exec(raw);
  if (!leadMatch || typeof leadMatch.index !== "number" || leadMatch.index <= 30) {
    return null;
  }
  const answer = raw.slice(leadMatch.index).trim();
  if (answer.length < 16) {
    return null;
  }
  return { start: leadMatch.index, end: leadMatch.index };
}

function findHandoffBoundary(raw: string): SplitBoundary | null {
  const match = HANDOFF_PATTERN.exec(raw);
  if (!match || typeof match.index !== "number") {
    return null;
  }
  const answerStart = match.index + match[0].length;
  const answer = raw.slice(answerStart).trim();
  if (answer.length < 16) {
    return null;
  }
  return { start: answerStart, end: answerStart };
}

interface ParagraphSpan {
  text: string;
  start: number;
}

function splitParagraphs(raw: string): ParagraphSpan[] {
  const spans: ParagraphSpan[] = [];
  let index = 0;

  while (index < raw.length) {
    while (index < raw.length && raw[index] === "\n") {
      index += 1;
    }
    if (index >= raw.length) {
      break;
    }

    const start = index;
    let end = index;
    while (end < raw.length) {
      if (raw[end] !== "\n") {
        end += 1;
        continue;
      }

      let next = end;
      while (next < raw.length && raw[next] === "\n") {
        next += 1;
      }
      if (next - end >= 2) {
        break;
      }
      end += 1;
    }

    const text = raw.slice(start, end).trim();
    if (text) {
      spans.push({ text, start });
    }

    index = end;
    while (index < raw.length && raw[index] === "\n") {
      index += 1;
    }
  }

  return spans;
}

function asciiLetterCount(text: string): number {
  return (text.match(/[A-Za-z]/g) || []).length;
}

function reasoningScore(paragraph: string): number {
  let score = 0;
  const trimmed = paragraph.trim();
  const cjk = cjkRatio(trimmed);

  if (REASONING_HINT_PATTERN.test(trimmed)) {
    score += 4;
  }
  if (/^(?:\d{1,2}[.)]|(?:step|步骤)\s*\d+[:.)]?)/i.test(trimmed)) {
    score += 3;
  }
  if (/\((?:self-correction|review|thinking)\b/i.test(trimmed)) {
    score += 2;
  }
  if (cjk < 0.05 && asciiLetterCount(trimmed) > 40) {
    score += 1;
  }

  return score;
}

function answerScore(paragraph: string): number {
  let score = 0;
  const trimmed = paragraph.trim();
  const cjk = cjkRatio(trimmed);

  if (ANSWER_HINT_PATTERN.test(trimmed)) {
    score += 4;
  }
  if (TABLE_HINT_PATTERN.test(trimmed)) {
    score += 2;
  }
  if (cjk > 0.2 && trimmed.length > 24) {
    score += 2;
  }
  if (/。|！|？/.test(trimmed) && !REASONING_HINT_PATTERN.test(trimmed)) {
    score += 1;
  }

  return score;
}

function findScoredParagraphBoundary(raw: string): SplitBoundary | null {
  const paragraphs = splitParagraphs(raw);
  if (paragraphs.length < 3) {
    return null;
  }

  const reasonScores = paragraphs.map((paragraph) => reasoningScore(paragraph.text));
  const answerScores = paragraphs.map((paragraph) => answerScore(paragraph.text));
  const prefixReason: number[] = [];
  const prefixAnswer: number[] = [];
  let reasoningAcc = 0;
  let answerAcc = 0;

  for (let index = 0; index < paragraphs.length; index += 1) {
    reasoningAcc += reasonScores[index];
    answerAcc += answerScores[index];
    prefixReason[index] = reasoningAcc;
    prefixAnswer[index] = answerAcc;
  }

  const suffixReason = new Array(paragraphs.length).fill(0);
  const suffixAnswer = new Array(paragraphs.length).fill(0);
  reasoningAcc = 0;
  answerAcc = 0;
  for (let index = paragraphs.length - 1; index >= 0; index -= 1) {
    reasoningAcc += reasonScores[index];
    answerAcc += answerScores[index];
    suffixReason[index] = reasoningAcc;
    suffixAnswer[index] = answerAcc;
  }

  let bestIndex = -1;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < paragraphs.length - 1; index += 1) {
    const candidate =
      prefixReason[index] +
      suffixAnswer[index + 1] -
      prefixAnswer[index] * 0.9 -
      suffixReason[index + 1] * 0.6;
    if (candidate > bestScore) {
      bestScore = candidate;
      bestIndex = index;
    }
  }

  if (bestIndex < 0) {
    return null;
  }

  const answerStart = paragraphs[bestIndex + 1].start;
  const answer = raw.slice(answerStart).trim();
  if (bestScore < 3.2 || answer.length < 20) {
    return null;
  }

  return { start: answerStart, end: answerStart };
}

function parseThoughtPrefixedContent(content: string): AssistantContentSplitResult | null {
  const trimmed = content.trim();
  if (!THOUGHT_PREFIX.test(trimmed)) {
    return null;
  }

  const raw = trimmed.replace(THOUGHT_PREFIX, "").trimStart();
  if (!raw) {
    return { reasoning: "", answer: "" };
  }

  const boundary =
    findDirectMarkerBoundary(raw) ??
    findStructuredStepBoundary(raw) ??
    findAnswerLeadBoundary(raw) ??
    findHandoffBoundary(raw) ??
    findScoredParagraphBoundary(raw);

  if (!boundary) {
    return { reasoning: raw.trim(), answer: "" };
  }

  return {
    reasoning: raw.slice(0, boundary.start).trim(),
    answer: sanitizeAnswer(raw.slice(boundary.end))
  };
}

export function splitAssistantDisplayContent(
  reasoningSummary: string,
  content: string,
  fallbackReasoning = ""
): AssistantContentSplitResult {
  const normalizedReasoning = reasoningSummary.trim();
  const normalizedContent = content.trim();
  const normalizedFallbackReasoning = fallbackReasoning.trim();
  const thinkTagSplit = normalizedContent ? extractThinkTagContent(normalizedContent) : null;
  const thoughtSplit = normalizedContent ? parseThoughtPrefixedContent(normalizedContent) : null;

  if (!normalizedContent) {
    return {
      reasoning: normalizedReasoning || normalizedFallbackReasoning,
      answer: ""
    };
  }

  if (normalizedReasoning) {
    return {
      reasoning: normalizedReasoning,
      answer: thinkTagSplit ? thinkTagSplit.answer : normalizedContent.replace(/<\/?think>/gi, "").trim()
    };
  }

  if (thinkTagSplit) {
    return thinkTagSplit;
  }

  if (thoughtSplit) {
    return thoughtSplit;
  }

  return {
    reasoning: normalizedFallbackReasoning,
    answer: normalizedContent.replace(/<\/?think>/gi, "").trim()
  };
}
