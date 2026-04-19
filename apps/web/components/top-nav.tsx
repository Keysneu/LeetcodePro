"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/theme-toggle";

const navItems = [
  { href: "/problems", label: "题库" },
  { href: "/progress", label: "进度" },
  { href: "/admin/problems", label: "后台" }
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b backdrop-blur" style={{ background: "var(--lc-nav-bg)" }}>
      <nav className="mx-auto flex h-[var(--lc-nav-height)] w-full max-w-[var(--lc-shell-max-width)] items-center justify-between gap-3 px-[var(--lc-shell-gutter-inline)]">
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

        <div className="flex shrink-0 items-center gap-2 text-xs">
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
