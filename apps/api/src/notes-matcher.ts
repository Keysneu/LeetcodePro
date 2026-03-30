export type ProblemRow = {
  id: string;
  leetcodeId?: number | null;
  slug: string;
  title: string;
};

type PreparedProblem = ProblemRow & {
  leetcodeIdText: string;
  slugNorm: string;
  slugCompact: string;
  titleNorm: string;
  titleCompact: string;
};

type MarkdownSection = {
  heading: string;
  content: string;
  markdown: string;
};

type AggregatedMatch = {
  problem: PreparedProblem;
  headings: string[];
  sectionMarkdownList: string[];
};

type ProblemBoundarySection = {
  problem: PreparedProblem;
  heading: string;
  markdown: string;
};

export type MatchedProblemNote = {
  problem: ProblemRow;
  matchedHeading: string;
  contentMd: string;
  headingList: string[];
};

export type MarkdownMatchResult = {
  totalSections: number;
  unmatchedSectionCount: number;
  matchedNotes: MatchedProblemNote[];
};

const MIN_MATCH_SCORE = 70;

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[`*_~\[\](){}<>:;"'.,!?/\\|\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(text: string): string {
  return normalizeText(text).replace(/\s+/g, "");
}

export function stripExt(filename: string): string {
  const index = filename.lastIndexOf(".");
  if (index <= 0) {
    return filename;
  }
  return filename.slice(0, index);
}

function buildSection(heading: string, bodyLines: string[]): MarkdownSection {
  const content = bodyLines.join("\n").trim();
  const markdown = content.length > 0 ? `## ${heading}\n\n${content}` : `## ${heading}`;

  return {
    heading,
    content,
    markdown
  };
}

function splitMarkdownSections(markdownContent: string, fallbackHeading: string): MarkdownSection[] {
  const lines = markdownContent.replace(/\r\n/g, "\n").split("\n");
  const sections: MarkdownSection[] = [];
  let inCodeFence = false;
  let currentHeading: string | null = null;
  let currentBodyLines: string[] = [];

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(```|~~~)/);
    if (fenceMatch) {
      inCodeFence = !inCodeFence;
    }

    if (!inCodeFence) {
      const headingMatch = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*$/);
      if (headingMatch) {
        if (currentHeading !== null) {
          sections.push(buildSection(currentHeading, currentBodyLines));
        }

        currentHeading = headingMatch[2].trim();
        currentBodyLines = [];
        continue;
      }
    }

    if (currentHeading !== null) {
      currentBodyLines.push(line);
    }
  }

  if (currentHeading !== null) {
    sections.push(buildSection(currentHeading, currentBodyLines));
  }

  if (sections.length > 0) {
    return sections;
  }

  const fallbackContent = markdownContent.trim();
  if (fallbackContent.length === 0) {
    return [];
  }

  return [
    {
      heading: fallbackHeading,
      content: fallbackContent,
      markdown: fallbackContent
    }
  ];
}

function prepareProblems(problems: ProblemRow[]): PreparedProblem[] {
  return problems.map((problem) => ({
    ...problem,
    leetcodeIdText: typeof problem.leetcodeId === "number" ? String(problem.leetcodeId) : "",
    slugNorm: normalizeText(problem.slug),
    slugCompact: compactText(problem.slug),
    titleNorm: normalizeText(problem.title),
    titleCompact: compactText(problem.title)
  }));
}

function buildProblemIdIndex(problems: PreparedProblem[]): Map<number, PreparedProblem[]> {
  const map = new Map<number, PreparedProblem[]>();

  for (const problem of problems) {
    const leetcodeId = Number(problem.leetcodeIdText);
    if (!Number.isInteger(leetcodeId) || leetcodeId <= 0) {
      continue;
    }

    const bucket = map.get(leetcodeId);
    if (bucket) {
      bucket.push(problem);
      continue;
    }

    map.set(leetcodeId, [problem]);
  }

  return map;
}

function stripTrailingParenthetical(text: string): string {
  return text.replace(/\s*[（(][^）)]*[）)]\s*$/g, "").trim();
}

function parseProblemBoundaryLine(
  line: string,
  problemsById: Map<number, PreparedProblem[]>
): { heading: string; problem: PreparedProblem } | null {
  const heading = line
    .trim()
    .replace(/^\s{0,3}#{1,6}\s+/, "")
    .trim();
  if (heading.length === 0) {
    return null;
  }

  const marker = heading.match(/^(\d{1,4})\s*[.、．]\s*(.+?)\s*$/);
  if (!marker) {
    return null;
  }

  const problemId = Number(marker[1]);
  if (!Number.isInteger(problemId) || problemId <= 0) {
    return null;
  }

  const titlePart = stripTrailingParenthetical(marker[2]);
  if (titlePart.length === 0) {
    return null;
  }

  const titleNorm = normalizeText(titlePart);
  const titleCompact = compactText(titlePart);
  const candidates = problemsById.get(problemId) ?? [];

  for (const candidate of candidates) {
    if (
      titleNorm.includes(candidate.titleNorm) ||
      candidate.titleNorm.includes(titleNorm) ||
      titleCompact.includes(candidate.titleCompact) ||
      candidate.titleCompact.includes(titleCompact)
    ) {
      return { heading, problem: candidate };
    }
  }

  return null;
}

function splitSectionsByProblemBoundaries(
  markdownContent: string,
  problems: PreparedProblem[]
): {
  totalSections: number;
  unmatchedSectionCount: number;
  matchedSections: ProblemBoundarySection[];
} | null {
  const lines = markdownContent.replace(/\r\n/g, "\n").split("\n");
  const problemsById = buildProblemIdIndex(problems);
  const markers: Array<{ index: number; heading: string; problem: PreparedProblem }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const parsed = parseProblemBoundaryLine(lines[index], problemsById);
    if (parsed) {
      markers.push({ index, heading: parsed.heading, problem: parsed.problem });
    }
  }

  if (markers.length === 0) {
    return null;
  }

  const hasLeadingUnmatched = lines.slice(0, markers[0].index).join("\n").trim().length > 0;
  const matchedSections: ProblemBoundarySection[] = [];

  for (let markerIndex = 0; markerIndex < markers.length; markerIndex += 1) {
    const marker = markers[markerIndex];
    const nextLineIndex = markerIndex + 1 < markers.length ? markers[markerIndex + 1].index : lines.length;
    const body = lines.slice(marker.index + 1, nextLineIndex).join("\n").trim();
    const markdown = body.length > 0 ? `## ${marker.heading}\n\n${body}` : `## ${marker.heading}`;

    matchedSections.push({
      problem: marker.problem,
      heading: marker.heading,
      markdown
    });
  }

  return {
    totalSections: matchedSections.length + (hasLeadingUnmatched ? 1 : 0),
    unmatchedSectionCount: hasLeadingUnmatched ? 1 : 0,
    matchedSections
  };
}

function toMatchedNotes(aggregateMap: Map<string, AggregatedMatch>): MatchedProblemNote[] {
  return [...aggregateMap.values()].map((entry) => ({
    problem: {
      id: entry.problem.id,
      slug: entry.problem.slug,
      title: entry.problem.title
    },
    headingList: entry.headings,
    matchedHeading: entry.headings.join(" | ").slice(0, 300),
    contentMd: entry.sectionMarkdownList.join("\n\n---\n\n")
  }));
}

function computeMatchScore(section: MarkdownSection, problem: PreparedProblem): number {
  const headingNorm = normalizeText(section.heading);
  const headingCompact = compactText(section.heading);
  const searchNorm = normalizeText(`${section.heading}\n${section.content.slice(0, 1200)}`);
  const searchCompact = searchNorm.replace(/\s+/g, "");
  const idAndTitle = problem.leetcodeIdText.length > 0 ? `${problem.leetcodeIdText} ${problem.titleNorm}` : "";

  if (headingNorm === problem.slugNorm || headingNorm === problem.titleNorm) {
    return 100;
  }

  if (idAndTitle.length > 0 && (headingNorm === idAndTitle || headingNorm.startsWith(`${idAndTitle} `))) {
    return 99;
  }

  if (headingNorm.includes(problem.titleNorm) || headingNorm.includes(problem.slugNorm)) {
    return 92;
  }

  if (idAndTitle.length > 0 && (headingNorm.includes(idAndTitle) || searchNorm.includes(idAndTitle))) {
    return 91;
  }

  if (headingCompact.includes(problem.titleCompact) || headingCompact.includes(problem.slugCompact)) {
    return 88;
  }

  if (searchNorm.includes(problem.titleNorm) || searchNorm.includes(problem.slugNorm)) {
    return 78;
  }

  if (searchCompact.includes(problem.titleCompact) || searchCompact.includes(problem.slugCompact)) {
    return 72;
  }

  return 0;
}

function findBestProblem(section: MarkdownSection, problems: PreparedProblem[]): PreparedProblem | null {
  let best: PreparedProblem | null = null;
  let bestScore = 0;

  for (const problem of problems) {
    const score = computeMatchScore(section, problem);
    if (score > bestScore) {
      bestScore = score;
      best = problem;
    }
  }

  if (bestScore < MIN_MATCH_SCORE) {
    return null;
  }

  return best;
}

export function matchMarkdownToProblems(
  markdownContent: string,
  fallbackHeading: string,
  problems: ProblemRow[]
): MarkdownMatchResult {
  const preparedProblems = prepareProblems(problems);
  const boundaryResult = splitSectionsByProblemBoundaries(markdownContent, preparedProblems);

  if (boundaryResult) {
    const aggregateMap = new Map<string, AggregatedMatch>();

    for (const section of boundaryResult.matchedSections) {
      const aggregated = aggregateMap.get(section.problem.id);
      if (!aggregated) {
        aggregateMap.set(section.problem.id, {
          problem: section.problem,
          headings: [section.heading],
          sectionMarkdownList: [section.markdown]
        });
        continue;
      }

      aggregated.headings.push(section.heading);
      aggregated.sectionMarkdownList.push(section.markdown);
    }

    return {
      totalSections: boundaryResult.totalSections,
      unmatchedSectionCount: boundaryResult.unmatchedSectionCount,
      matchedNotes: toMatchedNotes(aggregateMap)
    };
  }

  const sections = splitMarkdownSections(markdownContent, fallbackHeading);
  const aggregateMap = new Map<string, AggregatedMatch>();
  let unmatchedSectionCount = 0;

  for (const section of sections) {
    const matchedProblem = findBestProblem(section, preparedProblems);
    if (!matchedProblem) {
      unmatchedSectionCount += 1;
      continue;
    }

    const aggregated = aggregateMap.get(matchedProblem.id);
    if (!aggregated) {
      aggregateMap.set(matchedProblem.id, {
        problem: matchedProblem,
        headings: [section.heading],
        sectionMarkdownList: [section.markdown]
      });
      continue;
    }

    aggregated.headings.push(section.heading);
    aggregated.sectionMarkdownList.push(section.markdown);
  }

  const matchedNotes = toMatchedNotes(aggregateMap);

  return {
    totalSections: sections.length,
    unmatchedSectionCount,
    matchedNotes
  };
}
