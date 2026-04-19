import type { Metadata } from "next";
import "./globals.css";
import TopNav from "@/components/top-nav";

const themeInitScript = `
(() => {
  try {
    const key = "leetcodepro-theme";
    const stored = localStorage.getItem(key);
    const theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.style.colorScheme = "dark";
  }
})();
`;

export const metadata: Metadata = {
  title: "LeetCodePro",
  description: "AI-driven coding practice platform"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="lc-app text-[var(--lc-text)] antialiased">
        <TopNav />
        <main className="lc-shell flex-1">{children}</main>
      </body>
    </html>
  );
}
