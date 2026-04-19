"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/theme-toggle";
import {
  emitWorkspaceRefreshRequest,
  emitWorkspaceRunTestsRequest,
  emitWorkspaceSubmitRequest,
  WORKSPACE_TOOLBAR_STATE_EVENT,
  type WorkspaceToolbarState
} from "@/lib/workspace-toolbar";

const navItems = [
  { href: "/problems", label: "题库" },
  { href: "/progress", label: "进度" },
  { href: "/admin/problems", label: "后台" }
];

export default function TopNav() {
  const pathname = usePathname();
  const [toolbarState, setToolbarState] = useState<WorkspaceToolbarState | null>(null);
  const problemSlug = useMemo(() => {
    const matched = pathname.match(/^\/problems\/([^/]+)$/);
    return matched?.[1] ?? null;
  }, [pathname]);
  const showWorkspaceActions = Boolean(problemSlug);

  useEffect(() => {
    if (!problemSlug) {
      setToolbarState(null);
      return;
    }

    const onToolbarState = (event: Event) => {
      const { detail } = event as CustomEvent<WorkspaceToolbarState>;
      if (!detail || detail.problemSlug !== problemSlug) {
        return;
      }
      setToolbarState(detail);
    };

    setToolbarState({
      problemSlug,
      submitLoading: false,
      runLoading: false,
      canRefresh: false
    });
    window.addEventListener(WORKSPACE_TOOLBAR_STATE_EVENT, onToolbarState as EventListener);
    return () => {
      window.removeEventListener(WORKSPACE_TOOLBAR_STATE_EVENT, onToolbarState as EventListener);
    };
  }, [problemSlug]);

  return (
    <header className="sticky top-0 z-40 border-b backdrop-blur" style={{ background: "var(--lc-nav-bg)" }}>
      <nav className="mx-auto grid h-[var(--lc-nav-height)] w-full max-w-[var(--lc-shell-max-width)] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-[var(--lc-shell-gutter-inline)] lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="flex min-w-0 items-center gap-3 sm:gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="inline-block h-5 w-5 rounded-sm bg-[var(--lc-accent)]" />
            <span className="text-base font-semibold tracking-tight text-[var(--lc-text)]">LeetCodePro</span>
          </Link>
          <div className="hidden min-w-0 items-center gap-1 sm:flex">
            {navItems.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-1.5 text-sm transition ${
                    active
                      ? "text-[var(--lc-accent)]"
                      : "text-[var(--lc-text-muted)] hover:bg-[var(--lc-nav-link-hover)] hover:text-[var(--lc-text)]"
                  }`}
                  style={active ? { background: "var(--lc-accent-soft)" } : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="hidden items-center justify-center lg:flex">
          {showWorkspaceActions && problemSlug ? (
            <div className="inline-flex items-center rounded-[16px] border bg-[var(--lc-surface-soft)]/72 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-[12px] px-4 text-sm font-semibold text-[var(--lc-text-muted)] transition hover:bg-[var(--lc-surface)] hover:text-[var(--lc-text)] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => emitWorkspaceRefreshRequest({ problemSlug })}
                disabled={toolbarState?.submitLoading || toolbarState?.runLoading || !toolbarState?.canRefresh}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
                  <path
                    d="M10 3.25a6.75 6.75 0 0 1 5.3 2.57V4.5a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-.75.75h-3.5a.75.75 0 0 1 0-1.5h1.8A5.25 5.25 0 1 0 15.2 12a.75.75 0 0 1 1.46.3A6.75 6.75 0 1 1 10 3.25Z"
                    fill="currentColor"
                  />
                </svg>
                <span>刷新结果</span>
              </button>
              <div className="mx-1 h-6 w-px bg-[var(--lc-border)]" />
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center text-[#68707d] transition duration-150 hover:text-[#1f2937] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => emitWorkspaceRunTestsRequest({ problemSlug })}
                disabled={toolbarState?.submitLoading || toolbarState?.runLoading}
                aria-label="运行测试"
                title="运行测试"
              >
                {toolbarState?.runLoading ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
                    <path
                      d="M7.25 5.4c0-1.1 1.2-1.78 2.14-1.22l8.97 5.28c.92.54.92 1.86 0 2.4l-8.97 5.28c-.94.56-2.14-.12-2.14-1.22V5.4Z"
                      fill="currentColor"
                    />
                  </svg>
                )}
              </button>
              <div className="mx-1 h-6 w-px bg-[var(--lc-border)]" />
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-[12px] px-4 text-sm font-semibold text-[#19c15f] transition hover:bg-[var(--lc-surface)] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => emitWorkspaceSubmitRequest({ problemSlug })}
                disabled={toolbarState?.submitLoading || toolbarState?.runLoading}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
                  <path
                    d="M10 2.5a.75.75 0 0 1 .75.75v6.19l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06l2.22 2.22V3.25A.75.75 0 0 1 10 2.5Z"
                    fill="currentColor"
                  />
                  <path
                    d="M4 12.75A2.75 2.75 0 0 1 6.75 10h.5a.75.75 0 0 1 0 1.5h-.5c-.69 0-1.25.56-1.25 1.25v1.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25v-1.5c0-.69-.56-1.25-1.25-1.25h-.5a.75.75 0 0 1 0-1.5h.5A2.75 2.75 0 0 1 16 12.75v1.5A2.75 2.75 0 0 1 13.25 17h-6.5A2.75 2.75 0 0 1 4 14.25v-1.5Z"
                    fill="currentColor"
                  />
                </svg>
                <span>{toolbarState?.submitLoading ? "提交中..." : "提交"}</span>
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 text-xs">
          <ThemeToggle />
          <span className="hidden rounded border bg-[var(--lc-surface-soft)] px-2 py-1 text-[var(--lc-text-muted)] sm:inline-flex">
            MVP
          </span>
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border bg-[var(--lc-surface-soft)] text-[11px] font-semibold text-[var(--lc-text-muted)]">
            G
          </span>
        </div>
      </nav>
      <div className="mx-auto flex w-full max-w-[var(--lc-shell-max-width)] gap-1 overflow-x-auto px-[var(--lc-shell-gutter-inline)] pb-2 sm:hidden">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition ${
                active
                  ? "text-[var(--lc-accent)]"
                  : "text-[var(--lc-text-muted)] hover:bg-[var(--lc-nav-link-hover)] hover:text-[var(--lc-text)]"
              }`}
              style={active ? { background: "var(--lc-accent-soft)" } : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
