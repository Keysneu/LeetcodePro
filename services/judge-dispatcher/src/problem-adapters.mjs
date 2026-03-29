function parseIntegerArrayLiteral(text) {
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Invalid array literal: ${text}`);
  }

  if (!Array.isArray(parsed) || parsed.some((item) => !Number.isInteger(item))) {
    throw new Error(`Invalid integer array literal: ${text}`);
  }

  return parsed;
}

function asInt(value, errorMessage) {
  if (!Number.isInteger(value)) {
    throw new Error(errorMessage);
  }

  return value;
}

function normalizeIndexPairFromArray(value) {
  if (!Array.isArray(value) || value.some((item) => !Number.isInteger(item))) {
    return "invalid";
  }

  if (value.length < 2) {
    return "invalid";
  }

  const sorted = [...value].sort((left, right) => left - right);
  return `[${sorted[0]},${sorted[1]}]`;
}

function normalizeIndexPairFromText(outputText) {
  const matches = outputText.match(/-?\d+/g);
  if (!matches || matches.length < 2) {
    return "invalid";
  }

  const values = matches.slice(0, 2).map((part) => Number(part));
  if (values.some((value) => !Number.isInteger(value))) {
    return "invalid";
  }

  return normalizeIndexPairFromArray(values);
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

function normalizeBooleanFromText(outputText) {
  const token = outputText.trim().split(/\s+/)[0] ?? "";
  return normalizeBooleanValue(token);
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
  const match = outputText.match(/-?\d+/);
  return match ? match[0] : "invalid";
}

function parseTwoSumInput(text) {
  const match = text.match(/^\s*nums\s*=\s*(\[[^\]]*\])\s*,\s*target\s*=\s*(-?\d+)\s*$/i);
  if (!match) {
    throw new Error(`Invalid two-sum input: ${text}`);
  }

  return {
    nums: parseIntegerArrayLiteral(match[1]),
    target: Number(match[2])
  };
}

function parseTwoSumExpected(text) {
  const value = normalizeIndexPairFromText(text);
  if (value === "invalid") {
    throw new Error(`Invalid two-sum expected output: ${text}`);
  }

  const match = value.match(/-?\d+/g);
  return [Number(match[0]), Number(match[1])];
}

function parseValidParenthesesInput(text) {
  const match = text.match(/^\s*s\s*=\s*"([\s\S]*)"\s*$/i);
  if (!match) {
    throw new Error(`Invalid valid-parentheses input: ${text}`);
  }

  return {
    s: match[1]
  };
}

function parseValidParenthesesExpected(text) {
  const value = normalizeBooleanValue(text);
  if (value === "invalid") {
    throw new Error(`Invalid valid-parentheses expected output: ${text}`);
  }

  return value === "true";
}

function parseContainerInput(text) {
  const match = text.match(/^\s*height\s*=\s*(\[[^\]]*\])\s*$/i);
  if (!match) {
    throw new Error(`Invalid container input: ${text}`);
  }

  return {
    height: parseIntegerArrayLiteral(match[1])
  };
}

function parseContainerExpected(text) {
  const value = normalizeIntegerFromText(text);
  if (value === "invalid") {
    throw new Error(`Invalid container expected output: ${text}`);
  }

  return Number(value);
}

const adapters = {
  "two-sum": {
    slug: "two-sum",
    entryFunctionName: "twoSum",
    parseInput: parseTwoSumInput,
    parseExpected: parseTwoSumExpected,
    normalizeCoreResult: normalizeIndexPairFromArray,
    normalizeAcmOutput: normalizeIndexPairFromText,
    normalizeExpected: normalizeIndexPairFromArray,
    toAcmStdin: (input) => {
      const nums = input.nums.map((item) => asInt(item, "Invalid two-sum nums value"));
      const target = asInt(input.target, "Invalid two-sum target value");

      return `${nums.length}\n${nums.join(" ")}\n${target}\n`;
    }
  },
  "valid-parentheses": {
    slug: "valid-parentheses",
    entryFunctionName: "isValid",
    parseInput: parseValidParenthesesInput,
    parseExpected: parseValidParenthesesExpected,
    normalizeCoreResult: normalizeBooleanValue,
    normalizeAcmOutput: normalizeBooleanFromText,
    normalizeExpected: (value) => normalizeBooleanValue(value),
    toAcmStdin: (input) => `${String(input.s)}\n`
  },
  "container-with-most-water": {
    slug: "container-with-most-water",
    entryFunctionName: "maxArea",
    parseInput: parseContainerInput,
    parseExpected: parseContainerExpected,
    normalizeCoreResult: normalizeIntegerValue,
    normalizeAcmOutput: normalizeIntegerFromText,
    normalizeExpected: (value) => normalizeIntegerValue(value),
    toAcmStdin: (input) => {
      const height = input.height.map((item) => asInt(item, "Invalid height value"));
      return `${height.length}\n${height.join(" ")}\n`;
    }
  }
};

export function getProblemAdapter(problemSlug) {
  return adapters[problemSlug] ?? null;
}
