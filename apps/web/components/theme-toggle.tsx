"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "leetcodepro-theme";

function getSystemTheme(): Theme {
  if (typeof window === "undefined") {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initialTheme = stored === "light" || stored === "dark" ? stored : getSystemTheme();
    applyTheme(initialTheme);
    setTheme(initialTheme);
    setReady(true);
  }, []);

  const handleToggle = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setTheme(nextTheme);
  };

  if (!ready) {
    return (
      <button type="button" className="lc-btn-secondary h-8 px-3 text-xs" aria-label="切换主题" disabled>
        主题
      </button>
    );
  }

  return (
    <button type="button" className="lc-btn-secondary h-8 px-3 text-xs" onClick={handleToggle} aria-label="切换主题">
      {theme === "dark" ? "切到白天" : "切到夜间"}
    </button>
  );
}
