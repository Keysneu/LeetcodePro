import { readFileSync } from "node:fs";

const CORE_METADATA = JSON.parse(readFileSync(new URL("./core-metadata.json", import.meta.url), "utf8"));

const ORDER_INSENSITIVE_NUMBER_ARRAY_SLUGS = new Set([
  "top-k-frequent-elements",
  "find-all-anagrams-in-a-string"
]);
const ORDER_INSENSITIVE_NUMBER_MATRIX_SLUGS = new Set([
  "3sum",
  "permutations",
  "subsets",
  "combination-sum",
  "merge-intervals"
]);
const ORDER_INSENSITIVE_STRING_ARRAY_SLUGS = new Set(["letter-combinations-of-a-phone-number"]);
const ORDER_INSENSITIVE_STRING_MATRIX_SLUGS = new Set(["group-anagrams", "n-queens"]);
const PARAM_NAME_ALIASES = {
  "merge-two-sorted-lists": {
    list1: ["l1"],
    list2: ["l2"]
  }
};

function normalizeCppType(type) {
  return String(type)
    .replace(/\s+/g, " ")
    .replace(/\s*\*\s*/g, "*")
    .replace(/\s*&\s*/g, "&")
    .trim();
}

function storageCppType(type) {
  return normalizeCppType(type).replace(/^const\s+/, "").replace(/&$/, "").trim();
}

function getProblemMeta(problemSlug) {
  return CORE_METADATA[problemSlug] ?? null;
}

function getSolutionMethod(meta) {
  return meta?.methods?.find((item) => item.returnType !== null) ?? null;
}

function stripMarkdownTicks(raw) {
  const text = String(raw ?? "").trim();
  if (text.length >= 2 && text.startsWith("`") && text.endsWith("`")) {
    return text.slice(1, -1).trim();
  }
  return text;
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeJsonLikeLiteral(rawText) {
  let text = stripMarkdownTicks(rawText).replaceAll("`", "").trim();
  if (text.endsWith(",")) {
    text = text.slice(0, -1).trim();
  }
  return text;
}

function convertSingleQuotedJsonLike(source) {
  let inSingle = false;
  let inDouble = false;
  let escaping = false;
  let converted = "";

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (escaping) {
      converted += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      converted += char;
      escaping = true;
      continue;
    }

    if (inSingle) {
      if (char === "'") {
        inSingle = false;
        converted += "\"";
      } else if (char === "\"") {
        converted += "\\\"";
      } else {
        converted += char;
      }
      continue;
    }

    if (inDouble) {
      if (char === "\"") {
        inDouble = false;
      }
      converted += char;
      continue;
    }

    if (char === "'") {
      inSingle = true;
      converted += "\"";
      continue;
    }

    if (char === "\"") {
      inDouble = true;
      converted += char;
      continue;
    }

    converted += char;
  }

  return converted;
}

function tryParseJsonLike(text) {
  const parsed = tryParseJson(text);
  if (parsed !== null) {
    return parsed;
  }

  if ((text.startsWith("[") && text.endsWith("]")) || (text.startsWith("{") && text.endsWith("}"))) {
    const converted = convertSingleQuotedJsonLike(text);
    if (converted !== text) {
      return tryParseJson(converted);
    }
  }

  return null;
}

function splitTopLevelByComma(source) {
  const parts = [];
  let start = 0;
  let depth = 0;
  let inDoubleQuote = false;
  let escaping = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inDoubleQuote) {
      if (escaping) {
        escaping = false;
      } else if (char === "\\") {
        escaping = true;
      } else if (char === "\"") {
        inDoubleQuote = false;
      }
      continue;
    }

    if (char === "\"") {
      inDoubleQuote = true;
      continue;
    }

    if (char === "[" || char === "{" || char === "(") {
      depth += 1;
      continue;
    }

    if (char === "]" || char === "}" || char === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (char === "," && depth === 0) {
      parts.push(source.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(source.slice(start));
  return parts.map((item) => item.trim()).filter((item) => item.length > 0);
}

function parseLooseLiteral(rawText) {
  const text = normalizeJsonLikeLiteral(rawText);
  if (text.length === 0) {
    return "";
  }

  if ((text.startsWith("[") && text.endsWith("]")) || (text.startsWith("{") && text.endsWith("}"))) {
    const parsedJson = tryParseJsonLike(text);
    if (parsedJson !== null) {
      return parsedJson;
    }
  }

  if (/^-?\d+$/.test(text)) {
    return Number(text);
  }

  if (/^-?\d+\.\d+$/.test(text)) {
    return Number(text);
  }

  if (/^(true|false)$/i.test(text)) {
    return text.toLowerCase() === "true";
  }

  if (/^null$/i.test(text)) {
    return null;
  }

  if (text.startsWith("\"") && text.endsWith("\"")) {
    const parsedString = tryParseJson(text);
    if (typeof parsedString === "string") {
      return parsedString;
    }
  }

  return text;
}

function parseKeyValueInput(text) {
  if (!text.includes("=")) {
    return null;
  }

  const parts = splitTopLevelByComma(text);
  if (parts.length === 0) {
    return null;
  }

  const result = {};
  for (const part of parts) {
    const equalIndex = part.indexOf("=");
    if (equalIndex <= 0) {
      return null;
    }

    const key = part.slice(0, equalIndex).trim();
    const rawValue = part.slice(equalIndex + 1).trim();
    if (!key) {
      return null;
    }

    result[key] = parseLooseLiteral(rawValue);
  }

  return result;
}

function parseDesignInput(text) {
  const source = String(text ?? "").trim();
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const parseDesignArrays = (opsSource, argsetsSource) => {
    const ops = tryParseJson(stripMarkdownTicks(opsSource));
    const argsets = tryParseJson(stripMarkdownTicks(argsetsSource));
    if (!Array.isArray(ops) || !Array.isArray(argsets)) {
      return null;
    }
    return { __designOps: ops, __designArgsets: argsets };
  };

  if (lines.length >= 2 && lines[0].startsWith("[") && lines[1].startsWith("[")) {
    return parseDesignArrays(lines[0], lines[1]);
  }

  if (!source.startsWith("[")) {
    return null;
  }

  let depth = 0;
  let inQuote = false;
  let escaping = false;
  let splitIndex = -1;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inQuote) {
      if (escaping) {
        escaping = false;
      } else if (char === "\\") {
        escaping = true;
      } else if (char === "\"") {
        inQuote = false;
      }
      continue;
    }

    if (char === "\"") {
      inQuote = true;
      continue;
    }

    if (char === "[") {
      depth += 1;
      continue;
    }

    if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        splitIndex = index + 1;
        break;
      }
    }
  }

  if (splitIndex <= 0) {
    return null;
  }

  const opsSource = source.slice(0, splitIndex).trim();
  const argsetsSource = source.slice(splitIndex).trim();
  if (!argsetsSource.startsWith("[")) {
    return null;
  }

  return parseDesignArrays(opsSource, argsetsSource);
}

function parseInputByMetadata(problemSlug, text) {
  const source = String(text ?? "").trim();
  const meta = getProblemMeta(problemSlug);
  if (!meta) {
    return source;
  }

  if (meta.kind === "design") {
    const designParsed = parseDesignInput(source);
    if (!designParsed) {
      throw new Error(`Invalid design input for ${problemSlug}`);
    }
    return designParsed;
  }

  const keyValueParsed = parseKeyValueInput(source);
  if (keyValueParsed) {
    return keyValueParsed;
  }

  const method = getSolutionMethod(meta);
  if (!method || method.params.length === 0) {
    return parseLooseLiteral(source);
  }

  const parts = splitTopLevelByComma(source);
  if (parts.length > 0) {
    const parsedByParamOrder = {};
    const paramNames = method.params.map((item) => item.name);
    const getNextUnassignedParam = () => paramNames.find((name) => !Object.prototype.hasOwnProperty.call(parsedByParamOrder, name));

    for (const part of parts) {
      const equalIndex = part.indexOf("=");
      if (equalIndex > 0) {
        const key = part.slice(0, equalIndex).trim();
        const rawValue = part.slice(equalIndex + 1).trim();
        if (paramNames.includes(key)) {
          parsedByParamOrder[key] = parseLooseLiteral(rawValue);
          continue;
        }
      }

      const nextParam = getNextUnassignedParam();
      if (!nextParam) {
        continue;
      }
      parsedByParamOrder[nextParam] = parseLooseLiteral(part);
    }

    if (paramNames.every((name) => Object.prototype.hasOwnProperty.call(parsedByParamOrder, name))) {
      return parsedByParamOrder;
    }
  }

  if (method.params.length === 1) {
    return { [method.params[0].name]: parseLooseLiteral(source) };
  }

  throw new Error(`Invalid ${problemSlug} input: ${text}`);
}

function ensureObjectInput(problemSlug, parsedInput) {
  if (typeof parsedInput !== "object" || parsedInput === null || Array.isArray(parsedInput)) {
    throw new Error(`Invalid ${problemSlug} input object`);
  }
}

function ensureNumber(value, errorMessage) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(errorMessage);
  }
  return value;
}

function ensureInteger(value, errorMessage) {
  const number = ensureNumber(value, errorMessage);
  if (!Number.isInteger(number)) {
    throw new Error(errorMessage);
  }
  return number;
}

function ensureIntegerArray(value, errorMessage) {
  if (!Array.isArray(value) || value.some((item) => !Number.isInteger(item))) {
    throw new Error(errorMessage);
  }
  return value;
}

function ensureStringArray(value, errorMessage) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(errorMessage);
  }
  return value;
}

function ensureIntegerMatrix(value, errorMessage) {
  if (!Array.isArray(value) || value.some((row) => !Array.isArray(row) || row.some((item) => !Number.isInteger(item)))) {
    throw new Error(errorMessage);
  }
  return value;
}

function ensureCharMatrix(value, errorMessage) {
  if (!Array.isArray(value)) {
    throw new Error(errorMessage);
  }

  return value.map((row) => {
    if (typeof row === "string") {
      return row.split("");
    }
    if (!Array.isArray(row) || row.some((item) => typeof item !== "string" || item.length === 0)) {
      throw new Error(errorMessage);
    }
    return row.map((item) => item[0]);
  });
}

function normalizeBooleanValue(value) {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    if (value === 1) {
      return "true";
    }
    if (value === 0) {
      return "false";
    }
  }

  if (typeof value === "string") {
    const token = value.trim().toLowerCase();
    if (token === "true" || token === "1" || token === "yes") {
      return "true";
    }
    if (token === "false" || token === "0" || token === "no") {
      return "false";
    }
  }

  return "invalid";
}

function normalizeIntegerValue(value) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return String(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^-?\d+$/.test(trimmed)) {
      return trimmed;
    }
  }

  return "invalid";
}

function normalizeIntegerFromText(outputText) {
  const match = String(outputText ?? "").match(/-?\d+/);
  return match ? match[0] : "invalid";
}

function normalizeJsonLikeText(value) {
  const text = normalizeJsonLikeLiteral(String(value ?? ""));
  if (text.length === 0) {
    return "";
  }

  const parsed = tryParseJsonLike(text);
  if (parsed !== null) {
    return JSON.stringify(parsed);
  }

  return text.replace(/\s+/g, " ").trim();
}

function normalizeIndexPairFromArray(value) {
  if (!Array.isArray(value) || value.some((item) => !Number.isInteger(item)) || value.length < 2) {
    return "invalid";
  }
  const sorted = [...value].sort((left, right) => left - right);
  return JSON.stringify([sorted[0], sorted[1]]);
}

function normalizeIndexPairFromText(outputText) {
  const matches = String(outputText ?? "").match(/-?\d+/g);
  if (!matches || matches.length < 2) {
    return "invalid";
  }
  return normalizeIndexPairFromArray(matches.slice(0, 2).map((part) => Number(part)));
}

function normalizeNestedNumberLists(value, sortInner = false) {
  if (!Array.isArray(value) || value.some((row) => !Array.isArray(row) || row.some((item) => !Number.isInteger(item)))) {
    return null;
  }

  const mapped = value.map((row) => (sortInner ? [...row].sort((a, b) => a - b) : [...row]));
  mapped.sort((left, right) => {
    const leftKey = left.join(",");
    const rightKey = right.join(",");
    return leftKey.localeCompare(rightKey);
  });
  return mapped;
}

function normalizeNestedStringLists(value, sortInner = false) {
  if (!Array.isArray(value) || value.some((row) => !Array.isArray(row) || row.some((item) => typeof item !== "string"))) {
    return null;
  }

  const mapped = value.map((row) => (sortInner ? [...row].sort((a, b) => a.localeCompare(b)) : [...row]));
  mapped.sort((left, right) => left.join("\u0001").localeCompare(right.join("\u0001")));
  return mapped;
}

function normalizeOrderInsensitiveJson(problemSlug, parsedJson) {
  if (ORDER_INSENSITIVE_NUMBER_ARRAY_SLUGS.has(problemSlug)) {
    if (!Array.isArray(parsedJson) || parsedJson.some((item) => !Number.isInteger(item))) {
      return null;
    }
    return [...parsedJson].sort((a, b) => a - b);
  }

  if (ORDER_INSENSITIVE_NUMBER_MATRIX_SLUGS.has(problemSlug)) {
    return normalizeNestedNumberLists(parsedJson, problemSlug === "3sum" || problemSlug === "combination-sum");
  }

  if (ORDER_INSENSITIVE_STRING_ARRAY_SLUGS.has(problemSlug)) {
    if (!Array.isArray(parsedJson) || parsedJson.some((item) => typeof item !== "string")) {
      return null;
    }
    return [...parsedJson].sort((left, right) => left.localeCompare(right));
  }

  if (problemSlug === "group-anagrams") {
    return normalizeNestedStringLists(parsedJson, true);
  }

  if (problemSlug === "n-queens") {
    if (!Array.isArray(parsedJson)) {
      return null;
    }
    const boards = parsedJson.map((board) => {
      if (!Array.isArray(board) || board.some((row) => typeof row !== "string")) {
        return null;
      }
      return [...board];
    });

    if (boards.some((board) => board === null)) {
      return null;
    }

    boards.sort((left, right) => left.join("\u0001").localeCompare(right.join("\u0001")));
    return boards;
  }

  return parsedJson;
}

function normalizeByProblem(problemSlug, value) {
  if (problemSlug === "two-sum") {
    if (Array.isArray(value)) {
      return normalizeIndexPairFromArray(value);
    }
    return normalizeIndexPairFromText(value);
  }

  const meta = getProblemMeta(problemSlug);
  if (meta?.kind === "design") {
    if (typeof value === "string") {
      const parsed = tryParseJsonLike(normalizeJsonLikeLiteral(value));
      return parsed !== null ? JSON.stringify(parsed) : normalizeJsonLikeText(value);
    }
    return JSON.stringify(value);
  }

  const returnType = storageCppType(getSolutionMethod(meta)?.returnType ?? "");

  if (returnType === "bool") {
    const normalized = normalizeBooleanValue(value);
    return normalized === "invalid" ? normalizeJsonLikeText(value) : normalized;
  }

  if (returnType === "int") {
    const normalized = normalizeIntegerValue(value);
    if (normalized !== "invalid") {
      return normalized;
    }
    const fromText = normalizeIntegerFromText(value);
    return fromText === "invalid" ? normalizeJsonLikeText(value) : fromText;
  }

  if (typeof value === "string") {
    const parsed = tryParseJsonLike(normalizeJsonLikeLiteral(value));
    if (parsed !== null) {
      const normalized = normalizeOrderInsensitiveJson(problemSlug, parsed);
      return JSON.stringify(normalized);
    }
    return normalizeJsonLikeText(value);
  }

  const normalized = normalizeOrderInsensitiveJson(problemSlug, value);
  return JSON.stringify(normalized);
}

function formatScalarLine(value, type, errorMessage) {
  if (type === "int") {
    return String(ensureInteger(value, errorMessage));
  }
  if (type === "double") {
    return String(ensureNumber(value, errorMessage));
  }
  if (type === "bool") {
    const normalized = normalizeBooleanValue(value);
    if (normalized === "invalid") {
      throw new Error(errorMessage);
    }
    return normalized;
  }
  if (type === "string") {
    return String(value ?? "");
  }
  throw new Error(errorMessage);
}

function encodeIntegerArrayLines(value, errorMessage) {
  const array = ensureIntegerArray(value, errorMessage);
  return [String(array.length), array.join(" ")];
}

function encodeStringArrayLines(value, errorMessage) {
  const array = ensureStringArray(value, errorMessage);
  return [String(array.length), ...array];
}

function encodeIntegerMatrixLines(value, errorMessage) {
  const matrix = ensureIntegerMatrix(value, errorMessage);
  const lines = [String(matrix.length)];
  for (const row of matrix) {
    lines.push(String(row.length));
    lines.push(row.join(" "));
  }
  return lines;
}

function encodeCharMatrixLines(value, errorMessage) {
  const matrix = ensureCharMatrix(value, errorMessage);
  const lines = [String(matrix.length)];
  for (const row of matrix) {
    lines.push(String(row.length));
    lines.push(row.join(" "));
  }
  return lines;
}

function encodeLinkedListLines(value, errorMessage) {
  const listValues = ensureIntegerArray(value, errorMessage);
  return [String(listValues.length), listValues.join(" ")];
}

function encodeVectorLinkedListLines(value, errorMessage) {
  if (!Array.isArray(value)) {
    throw new Error(errorMessage);
  }
  const lines = [String(value.length)];
  for (const item of value) {
    lines.push(...encodeLinkedListLines(item, errorMessage));
  }
  return lines;
}

function encodeRandomPointerLines(value, errorMessage) {
  if (!Array.isArray(value)) {
    throw new Error(errorMessage);
  }

  const lines = [String(value.length)];
  for (const item of value) {
    if (!Array.isArray(item) || item.length < 2) {
      throw new Error(errorMessage);
    }
    const val = ensureInteger(item[0], errorMessage);
    const random = item[1] === null ? -1 : ensureInteger(item[1], errorMessage);
    lines.push(`${val} ${random}`);
  }

  return lines;
}

function encodeTreeLines(value) {
  return [JSON.stringify(value)];
}

function encodeGenericJsonLines(value) {
  return [JSON.stringify(value)];
}

function resolveParamValue(problemSlug, parsedInput, paramName) {
  ensureObjectInput(problemSlug, parsedInput);

  if (Object.prototype.hasOwnProperty.call(parsedInput, paramName)) {
    return parsedInput[paramName];
  }

  if (problemSlug === "intersection-of-two-linked-lists" && paramName === "headA") {
    return parsedInput.listA;
  }
  if (problemSlug === "intersection-of-two-linked-lists" && paramName === "headB") {
    return parsedInput.listB;
  }

  const aliases = PARAM_NAME_ALIASES[problemSlug]?.[paramName] ?? [];
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(parsedInput, alias)) {
      return parsedInput[alias];
    }
  }

  return undefined;
}

function encodeParamLines(problemSlug, paramName, paramType, value) {
  const type = storageCppType(paramType);
  const errorMessage = `Invalid ${problemSlug} input for ${paramName}`;

  if (type === "int" || type === "double" || type === "bool" || type === "string") {
    return [formatScalarLine(value, type, errorMessage)];
  }
  if (type === "vector<int>") {
    return encodeIntegerArrayLines(value, errorMessage);
  }
  if (type === "vector<string>") {
    return encodeStringArrayLines(value, errorMessage);
  }
  if (type === "vector<vector<int>>") {
    return encodeIntegerMatrixLines(value, errorMessage);
  }
  if (type === "vector<vector<char>>") {
    return encodeCharMatrixLines(value, errorMessage);
  }
  if (type === "ListNode*") {
    return encodeLinkedListLines(value, errorMessage);
  }
  if (type === "vector<ListNode*>") {
    return encodeVectorLinkedListLines(value, errorMessage);
  }
  if (type === "TreeNode*") {
    return encodeTreeLines(value);
  }
  if (type === "Node*") {
    return encodeRandomPointerLines(value, errorMessage);
  }

  return encodeGenericJsonLines(value);
}

function buildIntersectionAcmLines(problemSlug, parsedInput) {
  ensureObjectInput(problemSlug, parsedInput);
  if (
    !Object.prototype.hasOwnProperty.call(parsedInput, "listA") ||
    !Object.prototype.hasOwnProperty.call(parsedInput, "listB") ||
    !Object.prototype.hasOwnProperty.call(parsedInput, "skipA") ||
    !Object.prototype.hasOwnProperty.call(parsedInput, "skipB") ||
    !Object.prototype.hasOwnProperty.call(parsedInput, "intersectVal")
  ) {
    throw new Error(`Invalid ${problemSlug} input: missing listA/listB/skipA/skipB/intersectVal`);
  }

  return [
    ...encodeLinkedListLines(parsedInput.listA, "Invalid intersection listA"),
    ...encodeLinkedListLines(parsedInput.listB, "Invalid intersection listB"),
    String(ensureInteger(parsedInput.skipA, "Invalid skipA")),
    String(ensureInteger(parsedInput.skipB, "Invalid skipB")),
    String(ensureInteger(parsedInput.intersectVal, "Invalid intersectVal"))
  ];
}

function buildAcmLines(problemSlug, parsedInput) {
  const meta = getProblemMeta(problemSlug);
  if (!meta) {
    return [String(parsedInput ?? "")];
  }

  if (meta.kind === "design") {
    ensureObjectInput(problemSlug, parsedInput);
    const ops = parsedInput.__designOps;
    const argsets = parsedInput.__designArgsets;
    if (!Array.isArray(ops) || !Array.isArray(argsets)) {
      throw new Error(`Invalid design input for ${problemSlug}`);
    }
    return [JSON.stringify(ops), JSON.stringify(argsets)];
  }

  if (problemSlug === "intersection-of-two-linked-lists") {
    return buildIntersectionAcmLines(problemSlug, parsedInput);
  }

  const method = getSolutionMethod(meta);
  if (!method) {
    return [String(parsedInput ?? "")];
  }

  const lines = [];
  for (const param of method.params) {
    const value = resolveParamValue(problemSlug, parsedInput, param.name);
    if (value === undefined) {
      throw new Error(`Invalid ${problemSlug} input: missing ${param.name}`);
    }
    lines.push(...encodeParamLines(problemSlug, param.name, param.type, value));
  }

  if (problemSlug === "linked-list-cycle" || problemSlug === "linked-list-cycle-ii") {
    ensureObjectInput(problemSlug, parsedInput);
    if (!Object.prototype.hasOwnProperty.call(parsedInput, "pos")) {
      throw new Error(`Invalid ${problemSlug} input: missing pos`);
    }
    lines.push(String(ensureInteger(parsedInput.pos, `Invalid ${problemSlug} pos`)));
  }

  return lines;
}

function validateParsedInput(problemSlug, parsedInput) {
  const meta = getProblemMeta(problemSlug);
  if (!meta || meta.kind === "design") {
    return parsedInput;
  }

  const method = getSolutionMethod(meta);
  if (!method) {
    return parsedInput;
  }

  if (problemSlug === "intersection-of-two-linked-lists") {
    ensureObjectInput(problemSlug, parsedInput);
    if (!Object.prototype.hasOwnProperty.call(parsedInput, "listA") || !Object.prototype.hasOwnProperty.call(parsedInput, "listB")) {
      throw new Error(`Invalid ${problemSlug} input`);
    }
    return parsedInput;
  }

  for (const param of method.params) {
    if (resolveParamValue(problemSlug, parsedInput, param.name) === undefined) {
      throw new Error(`Invalid ${problemSlug} input: missing ${param.name}`);
    }
  }

  if (problemSlug === "linked-list-cycle" || problemSlug === "linked-list-cycle-ii") {
    ensureObjectInput(problemSlug, parsedInput);
    if (!Object.prototype.hasOwnProperty.call(parsedInput, "pos")) {
      throw new Error(`Invalid ${problemSlug} input: missing pos`);
    }
  }

  return parsedInput;
}

function ensureTrailingNewline(text) {
  const source = String(text ?? "");
  return source.endsWith("\n") ? source : `${source}\n`;
}

export function formatAcmInputFromCoreInput(problemSlug, rawInput) {
  const parsedInput = validateParsedInput(problemSlug, parseInputByMetadata(problemSlug, rawInput));
  const lines = buildAcmLines(problemSlug, parsedInput);
  return ensureTrailingNewline(lines.join("\n"));
}

function createMetadataAdapter(problemSlug) {
  const meta = getProblemMeta(problemSlug);
  const method = getSolutionMethod(meta);

  return {
    slug: problemSlug,
    entryFunctionName: method?.name ?? "",
    parseInput: (text) => validateParsedInput(problemSlug, parseInputByMetadata(problemSlug, text)),
    parseExpected: (text) => stripMarkdownTicks(text),
    normalizeCoreResult: (value) => normalizeByProblem(problemSlug, value),
    normalizeAcmOutput: (text) => normalizeByProblem(problemSlug, text),
    normalizeExpected: (value) => normalizeByProblem(problemSlug, value),
    toAcmStdin: (input) => {
      const lines = buildAcmLines(problemSlug, input);
      return ensureTrailingNewline(lines.join("\n"));
    }
  };
}

function createGenericAcmAdapter(problemSlug) {
  return {
    slug: problemSlug,
    entryFunctionName: "",
    parseInput: (text) => String(text ?? ""),
    parseExpected: (text) => normalizeJsonLikeText(text),
    normalizeCoreResult: (value) => normalizeJsonLikeText(String(value ?? "")),
    normalizeAcmOutput: (text) => normalizeJsonLikeText(text),
    normalizeExpected: (value) => normalizeJsonLikeText(String(value ?? "")),
    toAcmStdin: (input) => ensureTrailingNewline(String(input ?? ""))
  };
}

export function getProblemAdapter(problemSlug) {
  if (getProblemMeta(problemSlug)) {
    return createMetadataAdapter(problemSlug);
  }

  return createGenericAcmAdapter(problemSlug);
}
