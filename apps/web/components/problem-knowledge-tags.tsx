type Props = {
  tags: string[];
  emptyLabel?: string;
  className?: string;
};

function normalizeTags(tags: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const tag of tags) {
    const trimmed = tag.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

export default function ProblemKnowledgeTags({ tags, emptyLabel = "无标签", className }: Props) {
  const normalizedTags = normalizeTags(tags);
  const containerClassName = className ? `flex flex-wrap gap-1 ${className}` : "flex flex-wrap gap-1";

  if (normalizedTags.length === 0) {
    return (
      <span className={containerClassName}>
        <span className="lc-badge border bg-[var(--lc-surface-soft)] text-[var(--lc-text-muted)]">{emptyLabel}</span>
      </span>
    );
  }

  return (
    <span className={containerClassName}>
      {normalizedTags.map((tag) => (
        <span key={tag} className="lc-badge border bg-[var(--lc-surface-soft)] text-[var(--lc-text-muted)]">
          {tag}
        </span>
      ))}
    </span>
  );
}
