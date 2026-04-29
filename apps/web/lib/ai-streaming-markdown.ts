export type StreamingMarkdownOptions = {
  isStreaming: boolean;
};

type FenceState = {
  marker: string;
  length: number;
} | null;

function normalizeLineEndings(markdown: string): string {
  return markdown.replace(/\r\n?/g, "\n");
}

function readFenceState(markdown: string): FenceState {
  let openFence: FenceState = null;
  const fencePattern = /^( {0,3})(`{3,}|~{3,})/;

  for (const line of markdown.split("\n")) {
    const match = line.match(fencePattern);
    if (!match?.[2]) {
      continue;
    }

    const markerRun = match[2];
    const marker = markerRun[0] ?? "`";
    const length = markerRun.length;

    if (!openFence) {
      openFence = { marker, length };
      continue;
    }

    if (openFence.marker === marker && length >= openFence.length) {
      openFence = null;
    }
  }

  return openFence;
}

function closeOpenFence(markdown: string): string {
  const openFence = readFenceState(markdown);
  if (!openFence) {
    return markdown;
  }

  const closingFence = openFence.marker.repeat(openFence.length);
  return `${markdown}${markdown.endsWith("\n") ? "" : "\n"}${closingFence}`;
}

function stripFencedBlocks(markdown: string): string {
  let inFence: FenceState = null;
  const fencePattern = /^( {0,3})(`{3,}|~{3,})/;
  const output: string[] = [];

  for (const line of markdown.split("\n")) {
    const match = line.match(fencePattern);
    if (match?.[2]) {
      const markerRun = match[2];
      const marker = markerRun[0] ?? "`";
      const length = markerRun.length;
      if (!inFence) {
        inFence = { marker, length };
      } else if (inFence.marker === marker && length >= inFence.length) {
        inFence = null;
      }
      output.push("");
      continue;
    }

    output.push(inFence ? "" : line);
  }

  return output.join("\n");
}

function countUnescapedToken(markdown: string, token: string): number {
  let count = 0;
  let index = 0;

  while (index < markdown.length) {
    const nextIndex = markdown.indexOf(token, index);
    if (nextIndex < 0) {
      break;
    }

    const previous = markdown[nextIndex - 1];
    if (previous !== "\\") {
      count += 1;
    }
    index = nextIndex + token.length;
  }

  return count;
}

function closeInlineMarkdown(markdown: string): string {
  let next = markdown;
  const nonFenced = stripFencedBlocks(markdown);

  if (countUnescapedToken(nonFenced, "`") % 2 === 1) {
    next += "`";
  }

  for (const marker of ["**", "__", "~~"]) {
    if (countUnescapedToken(nonFenced, marker) % 2 === 1) {
      next += marker;
    }
  }

  return next;
}

function closeInlineLink(markdown: string): string {
  let next = markdown;
  const activeLine = next.slice(next.lastIndexOf("\n") + 1);
  const incompleteDestination = activeLine.match(/!?\[[^\]\n]{0,180}\]\([^\)\n]{0,500}$/);
  if (incompleteDestination) {
    next += ")";
    return next;
  }

  const lastOpenBracket = activeLine.lastIndexOf("[");
  const lastCloseBracket = activeLine.lastIndexOf("]");
  if (lastOpenBracket > lastCloseBracket) {
    const bracketPrefix = activeLine[lastOpenBracket - 1] === "!" ? "!" : "";
    const label = activeLine.slice(lastOpenBracket + 1);
    if (label.length <= 180 && !label.includes("\n")) {
      next += "]";
      if (bracketPrefix === "!" && label.length === 0) {
        return next;
      }
    }
  }

  return next;
}

function completeStreamingTableSeparator(markdown: string): string {
  const lastLineStart = markdown.lastIndexOf("\n") + 1;
  const activeLine = markdown.slice(lastLineStart);
  const trimmed = activeLine.trim();

  if (
    trimmed.length > 0 &&
    trimmed.includes("-") &&
    trimmed.includes("|") &&
    /^[|:\-\s]+$/.test(trimmed) &&
    !trimmed.endsWith("|")
  ) {
    return `${markdown} |`;
  }

  return markdown;
}

export function prepareStreamingMarkdown(
  markdown: string,
  options: StreamingMarkdownOptions = { isStreaming: false }
): string {
  const normalized = normalizeLineEndings(markdown);
  if (normalized.trim().length === 0) {
    return "";
  }

  const fenced = closeOpenFence(normalized);
  if (!options.isStreaming) {
    return fenced;
  }

  return completeStreamingTableSeparator(closeInlineMarkdown(closeInlineLink(fenced)));
}
