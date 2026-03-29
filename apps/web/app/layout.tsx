import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeetCodePro",
  description: "AI-driven coding practice platform"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
          <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-bold text-white">
              LeetCodePro
            </Link>
            <div className="flex items-center gap-6 text-sm text-slate-300">
              <Link href="/problems">题库</Link>
              <Link href="/progress">进度（预留）</Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
