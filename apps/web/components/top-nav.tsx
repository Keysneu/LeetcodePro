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
      <nav className="flex h-14 w-full items-center justify-between px-3 md:px-5 xl:px-8 2xl:px-10">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-block h-5 w-5 rounded-sm bg-[var(--lc-accent)]" />
            <span className="text-base font-semibold tracking-tight text-[var(--lc-text)]">LeetCodePro</span>
          </Link>
          <div className="flex items-center gap-1">
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

        <div className="flex items-center gap-2 text-xs">
          <ThemeToggle />
          <span className="hidden rounded border bg-[var(--lc-surface-soft)] px-2 py-1 text-[var(--lc-text-muted)] sm:inline-flex">
            MVP
          </span>
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border bg-[var(--lc-surface-soft)] text-[11px] font-semibold text-[var(--lc-text-muted)]">
            G
          </span>
        </div>
      </nav>
    </header>
  );
}
