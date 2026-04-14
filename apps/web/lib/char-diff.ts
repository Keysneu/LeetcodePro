export type DiffSegment = {
  text: string;
  isMatch: boolean;
};

const MAX_LCS_LENGTH = 1200;

function buildPrefixSuffixMatches(left: string, right: string): { leftMatch: boolean[]; rightMatch: boolean[] } {
  const leftMatch = new Array<boolean>(left.length).fill(false);
  const rightMatch = new Array<boolean>(right.length).fill(false);

  let prefix = 0;
  while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) {
    leftMatch[prefix] = true;
    rightMatch[prefix] = true;
    prefix += 1;
  }

  let leftIndex = left.length - 1;
  let rightIndex = right.length - 1;
  while (leftIndex >= prefix && rightIndex >= prefix && left[leftIndex] === right[rightIndex]) {
    leftMatch[leftIndex] = true;
    rightMatch[rightIndex] = true;
    leftIndex -= 1;
    rightIndex -= 1;
  }

  return { leftMatch, rightMatch };
}

function buildLcsMatches(left: string, right: string): { leftMatch: boolean[]; rightMatch: boolean[] } {
  if (left.length === 0 || right.length === 0) {
    return {
      leftMatch: new Array<boolean>(left.length).fill(false),
      rightMatch: new Array<boolean>(right.length).fill(false)
    };
  }

  if (left.length > MAX_LCS_LENGTH || right.length > MAX_LCS_LENGTH) {
    return buildPrefixSuffixMatches(left, right);
  }

  const rows: Uint32Array[] = Array.from({ length: left.length + 1 }, () => new Uint32Array(right.length + 1));
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      if (left[i] === right[j]) {
        rows[i][j] = rows[i + 1][j + 1] + 1;
      } else {
        rows[i][j] = Math.max(rows[i + 1][j], rows[i][j + 1]);
      }
    }
  }

  const leftMatch = new Array<boolean>(left.length).fill(false);
  const rightMatch = new Array<boolean>(right.length).fill(false);

  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      leftMatch[i] = true;
      rightMatch[j] = true;
      i += 1;
      j += 1;
      continue;
    }

    if (rows[i + 1][j] >= rows[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }

  return { leftMatch, rightMatch };
}

function buildSegments(text: string, matches: boolean[]): DiffSegment[] {
  if (text.length === 0) {
    return [{ text: "(空)", isMatch: true }];
  }

  const segments: DiffSegment[] = [];
  let start = 0;
  let current = matches[0];

  for (let index = 1; index < text.length; index += 1) {
    if (matches[index] === current) {
      continue;
    }

    segments.push({
      text: text.slice(start, index),
      isMatch: current
    });
    start = index;
    current = matches[index];
  }

  segments.push({
    text: text.slice(start),
    isMatch: current
  });

  return segments;
}

export function buildCharDiffSegments(left: string, right: string): { left: DiffSegment[]; right: DiffSegment[] } {
  const { leftMatch, rightMatch } = buildLcsMatches(left, right);
  return {
    left: buildSegments(left, leftMatch),
    right: buildSegments(right, rightMatch)
  };
}
