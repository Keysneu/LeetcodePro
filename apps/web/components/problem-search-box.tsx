"use client";

import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  initialQuery: string;
};

const SEARCH_URL_SYNC_DELAY_MS = 450;

function normalizeSearchQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function buildSearchHref(pathname: string, searchParamsText: string, query: string): string {
  const nextParams = new URLSearchParams(searchParamsText);

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
  const [isComposing, setIsComposing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const searchParamsText = searchParams.toString();
  const normalizedDraft = normalizeSearchQuery(draft);
  const currentQuery = normalizeSearchQuery(searchParams.get("q") ?? "");

  useEffect(() => {
    const inputIsActive = document.activeElement === inputRef.current;

    if (inputIsActive && normalizedDraft !== currentQuery) {
      return;
    }

    setDraft(currentQuery);
  }, [currentQuery, normalizedDraft]);

  useEffect(() => {
    if (isComposing || normalizedDraft === currentQuery) {
      return;
    }

    const timer = window.setTimeout(() => {
      const href = buildSearchHref(pathname, searchParamsText, normalizedDraft);
      startTransition(() => {
        router.replace(href, { scroll: false });
      });
    }, SEARCH_URL_SYNC_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [currentQuery, isComposing, normalizedDraft, pathname, router, searchParamsText, startTransition]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (normalizedDraft === currentQuery) {
      return;
    }

    const href = buildSearchHref(pathname, searchParamsText, normalizedDraft);
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  function handleClear(): void {
    setDraft("");
    setIsComposing(false);

    if (currentQuery.length === 0) {
      return;
    }

    const href = buildSearchHref(pathname, searchParamsText, "");
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  return (
    <form className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[20rem]" onSubmit={handleSubmit}>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={(event) => {
            setIsComposing(false);
            setDraft(event.currentTarget.value);
          }}
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
