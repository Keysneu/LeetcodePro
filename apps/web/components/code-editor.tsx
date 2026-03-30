"use client";

import Editor from "@monaco-editor/react";
import { useEffect, useMemo, useState } from "react";

export type EditorMode = "core" | "acm";
export type EditorLanguage = "cpp" | "python";
type ModeSupport = "CORE" | "ACM" | "BOTH";

export type EditorState = {
  mode: EditorMode;
  language: EditorLanguage;
  code: string;
};

type Props = {
  initialCoreCodes: Record<EditorLanguage, string>;
  initialMode?: EditorMode;
  modeSupport?: ModeSupport;
  initialLanguage?: EditorLanguage;
  onStateChange?: (state: EditorState) => void;
};

function toMode(value: string): EditorMode {
  return value === "acm" ? "acm" : "core";
}

function toLanguage(value: string): EditorLanguage {
  return value === "python" ? "python" : "cpp";
}

function isModeAllowed(mode: EditorMode, modeSupport: ModeSupport): boolean {
  if (modeSupport === "BOTH") {
    return true;
  }
  if (modeSupport === "CORE") {
    return mode === "core";
  }
  return mode === "acm";
}

export default function CodeEditor({
  initialCoreCodes,
  initialMode = "core",
  modeSupport = "BOTH",
  initialLanguage = "cpp",
  onStateChange
}: Props) {
  const resolvedInitialMode = isModeAllowed(initialMode, modeSupport) ? initialMode : modeSupport === "ACM" ? "acm" : "core";
  const [mode, setMode] = useState<EditorMode>(resolvedInitialMode);
  const [language, setLanguage] = useState<EditorLanguage>(initialLanguage);
  const [coreCodeByLanguage, setCoreCodeByLanguage] = useState<Record<EditorLanguage, string>>(initialCoreCodes);
  const [code, setCode] = useState(() => (resolvedInitialMode === "core" ? initialCoreCodes[initialLanguage] ?? "" : ""));
  const [editorTheme, setEditorTheme] = useState<"vs-dark" | "vs">("vs-dark");

  const monacoLanguage = useMemo(() => {
    if (language === "cpp") {
      return "cpp";
    }

    return "python";
  }, [language]);

  useEffect(() => {
    onStateChange?.({
      mode,
      language,
      code
    });
  }, [code, language, mode, onStateChange]);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => {
      const currentTheme = root.getAttribute("data-theme");
      setEditorTheme(currentTheme === "light" ? "vs" : "vs-dark");
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isModeAllowed(mode, modeSupport)) {
      return;
    }

    const nextMode: EditorMode = modeSupport === "ACM" ? "acm" : "core";
    setMode(nextMode);
    setCode(nextMode === "core" ? coreCodeByLanguage[language] ?? "" : "");
  }, [coreCodeByLanguage, language, mode, modeSupport]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 border-b pb-3 text-sm">
        <label className="text-[var(--lc-text-muted)]">模式</label>
        <select
          className="lc-select"
          value={mode}
          onChange={(event) => {
            const nextMode = toMode(event.target.value);
            if (!isModeAllowed(nextMode, modeSupport)) {
              return;
            }
            if (nextMode === mode) {
              return;
            }

            setMode(nextMode);
            if (nextMode === "acm") {
              setCode("");
              return;
            }

            setCode(coreCodeByLanguage[language] ?? "");
          }}
        >
          <option value="core" disabled={!isModeAllowed("core", modeSupport)}>
            核心代码模式
          </option>
          <option value="acm" disabled={!isModeAllowed("acm", modeSupport)}>
            ACM 模式
          </option>
        </select>

        <label className="text-[var(--lc-text-muted)] md:ml-2">语言</label>
        <select
          className="lc-select"
          value={language}
          onChange={(event) => {
            const nextLanguage = toLanguage(event.target.value);
            if (nextLanguage === language) {
              return;
            }

            setLanguage(nextLanguage);
            if (mode === "core") {
              setCode(coreCodeByLanguage[nextLanguage] ?? "");
              return;
            }

            setCode("");
          }}
        >
          <option value="cpp">C++</option>
          <option value="python">Python</option>
        </select>
      </div>

      <div className="h-[52vh] min-h-[430px] overflow-hidden rounded-lg border">
        <Editor
          height="100%"
          language={monacoLanguage}
          value={code}
          onChange={(value) => {
            const nextCode = value ?? "";
            setCode(nextCode);
            if (mode === "core") {
              setCoreCodeByLanguage((previous) => ({
                ...previous,
                [language]: nextCode
              }));
            }
          }}
          theme={editorTheme}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineHeight: 21,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            fontFamily: "Menlo, Monaco, Consolas, 'Courier New', monospace",
            smoothScrolling: true
          }}
        />
      </div>

      <div className="rounded-lg border bg-[var(--lc-surface-soft)] p-3 text-xs text-[var(--lc-text-muted)]">
        当前模式：<span className="font-medium text-[var(--lc-text)]">{mode}</span> | 当前语言：
        <span className="font-medium text-[var(--lc-text)]"> {language}</span>
      </div>
    </div>
  );
}
