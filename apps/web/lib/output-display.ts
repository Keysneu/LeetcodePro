function stripLegacyInlineArrayBackticks(text: string): string {
  return text
    .replace(/`(\[[^`\n]*\][,;:]?)`/g, "$1")
    .replace(/`(\{[^`\n]*\}[,;:]?)`/g, "$1")
    .replace(/\[`([^`\n]*\][,;:]?)`/g, "[$1")
    .replace(/\{`([^`\n]*\}[,;:]?)`/g, "{$1");
}

export function normalizeProblemStatementMarkdown(raw: string | null | undefined): string {
  if (typeof raw !== "string") {
    return "";
  }

  return stripLegacyInlineArrayBackticks(raw.replace(/\r\n/g, "\n").replace(/\u00a0/g, " "));
}

export function normalizeDisplayText(raw: string | null | undefined): string {
  if (typeof raw !== "string") {
    return "";
  }

  const trimmed = stripLegacyInlineArrayBackticks(raw).trim();
  if (trimmed.length < 2) {
    return trimmed;
  }

  const isWrappedByDoubleQuotes = trimmed.startsWith("\"") && trimmed.endsWith("\"");
  if (!isWrappedByDoubleQuotes) {
    return trimmed;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === "string") {
      return parsed;
    }
  } catch {
    // Fall through to a lightweight unwrap for legacy stored strings.
  }

  return trimmed.slice(1, -1);
}
