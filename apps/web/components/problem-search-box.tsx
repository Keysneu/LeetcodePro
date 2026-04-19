"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams, type ReadonlyURLSearchParams } from "next/navigation";

type Props = {
  initialQuery: string;
};

function normalizeSearchQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function buildSearchHref(pathname: string, searchParams: ReadonlyURLSearchParams, query: string): string {
  const nextParams = new URLSearchParams(searchParams.toString());

  if (query.length > 0) {
    nextParams.set("q", query);
  } else {
    nextParams.delete("q");
  }

  const serialized = nextParams.toString();
  return serialized.length > 0 ? `${pathname}?${serialized}` : pathname;
}

export default function ProblemSearchBox({ initialQuery }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();

  const normalizedDraft = normalizeSearchQuery(draft);
  const currentQuery = normalizeSearchQuery(searchParams.get("q") ?? "");

  useEffect(() => {
    setDraft(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (normalizedDraft === currentQuery) {
      return;
    }

    const timer = window.setTimeout(() => {
      const href = buildSearchHref(pathname, searchParams, normalizedDraft);
      startTransition(() => {
        router.replace(href, { scroll: false });
      });
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [currentQuery, normalizedDraft, pathname, router, searchParams, startTransition]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (normalizedDraft === currentQuery) {
      return;
    }

    const href = buildSearchHref(pathname, searchParams, normalizedDraft);
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  function handleClear(): void {
    setDraft("");

    if (currentQuery.length === 0) {
      return;
    }

    const href = buildSearchHref(pathname, searchParams, "");
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  return (
    <form className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[20rem]" onSubmit={handleSubmit}>
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="搜索题号、题名、slug、标签"
          aria-label="搜索题库"
          className="h-10 min-w-0 flex-1 rounded-md border bg-[var(--lc-surface)] px-3 text-sm text-[var(--lc-text)] outline-none transition placeholder:text-[var(--lc-text-muted)] focus:border-[var(--lc-accent)]"
        />
        {draft.length > 0 ? (
          <button type="button" className="lc-btn-secondary h-10 px-3 text-xs" onClick={handleClear}>
            清空
          </button>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-[var(--lc-text-muted)]">
        <span>支持按题号、题名、slug、标签模糊匹配</span>
        {isPending ? <span>搜索中...</span> : null}
      </div>
    </form>
  );
}
