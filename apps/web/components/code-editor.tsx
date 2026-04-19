"use client";

import Editor from "@monaco-editor/react";
import { useEffect, useMemo, useRef, useState } from "react";

export type EditorMode = "core" | "acm";
export type EditorLanguage = "cpp" | "python";
type ModeSupport = "CORE" | "ACM" | "BOTH";
type MonacoThemeName = "leetcodepro-editor-dark" | "leetcodepro-editor-light";

export type EditorState = {
  mode: EditorMode;
  language: EditorLanguage;
  code: string;
};

const DEFAULT_ACM_CODES: Record<EditorLanguage, string> = {
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    // TODO: 按 ACM 输入规范读取 stdin
    // TODO: 输出答案到 stdout

    return 0;
}`,
  python: `import sys


def main() -> None:
    # TODO: 按 ACM 输入规范读取 stdin
    # TODO: 输出答案到 stdout
    pass


if __name__ == "__main__":
    main()
`
};
const MONACO_THEME_DARK: MonacoThemeName = "leetcodepro-editor-dark";
const MONACO_THEME_LIGHT: MonacoThemeName = "leetcodepro-editor-light";

type Props = {
  initialCoreCodes: Record<EditorLanguage, string>;
  initialMode?: EditorMode;
  modeSupport?: ModeSupport;
  initialLanguage?: EditorLanguage;
  overrideState?: EditorState | null;
  overrideVersion?: number;
  onStateChange?: (state: EditorState) => void;
};

function normalizeModeSupport(value: string | undefined): ModeSupport {
  if (value === "CORE" || value === "ACM" || value === "BOTH") {
    return value;
  }
  return "BOTH";
}

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
  overrideState = null,
  overrideVersion = 0,
  onStateChange
}: Props) {
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<{
    layout: () => void;
    setScrollTop: (value: number) => void;
    setScrollLeft: (value: number) => void;
    updateOptions: (options: { readOnly: boolean; domReadOnly: boolean }) => void;
  } | null>(null);
  const safeModeSupport = normalizeModeSupport(modeSupport);
  const resolvedInitialMode = isModeAllowed(initialMode, safeModeSupport) ? initialMode : safeModeSupport === "ACM" ? "acm" : "core";
  const [mode, setMode] = useState<EditorMode>(resolvedInitialMode);
  const [language, setLanguage] = useState<EditorLanguage>(initialLanguage);
  const [coreCodeByLanguage, setCoreCodeByLanguage] = useState<Record<EditorLanguage, string>>(initialCoreCodes);
  const [acmCodeByLanguage, setAcmCodeByLanguage] = useState<Record<EditorLanguage, string>>(DEFAULT_ACM_CODES);
  const [code, setCode] = useState(() =>
    resolvedInitialMode === "core" ? initialCoreCodes[initialLanguage] ?? "" : DEFAULT_ACM_CODES[initialLanguage]
  );
  const [editorTheme, setEditorTheme] = useState<MonacoThemeName>(MONACO_THEME_DARK);
  const editorInstanceKey = `${mode}:${language}:${overrideVersion}`;

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
      setEditorTheme(currentTheme === "light" ? MONACO_THEME_LIGHT : MONACO_THEME_DARK);
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isModeAllowed(mode, safeModeSupport)) {
      return;
    }

    const nextMode: EditorMode = safeModeSupport === "ACM" ? "acm" : "core";
    setMode(nextMode);
    setCode(nextMode === "core" ? coreCodeByLanguage[language] ?? "" : acmCodeByLanguage[language] ?? DEFAULT_ACM_CODES[language]);
  }, [acmCodeByLanguage, coreCodeByLanguage, language, mode, safeModeSupport]);

  useEffect(() => {
    if (!overrideState) {
      return;
    }

    const nextLanguage = overrideState.language;
    const nextMode = isModeAllowed(overrideState.mode, safeModeSupport)
      ? overrideState.mode
      : safeModeSupport === "ACM"
        ? "acm"
        : "core";
    const nextCode = overrideState.code ?? "";

    setLanguage(nextLanguage);
    setMode(nextMode);
    setCode(nextCode);

    if (nextMode === "core") {
      setCoreCodeByLanguage((previous) => ({
        ...previous,
        [nextLanguage]: nextCode
      }));
    } else {
      setAcmCodeByLanguage((previous) => ({
        ...previous,
        [nextLanguage]: nextCode
      }));
    }
  }, [overrideState, overrideVersion, safeModeSupport]);

  useEffect(() => {
    const editor = editorRef.current;
    const container = editorContainerRef.current;
    if (!editor || !container) {
      return;
    }

    const layoutEditor = () => {
      editor.layout();
      editor.setScrollTop(0);
      editor.setScrollLeft(0);
    };

    const raf = window.requestAnimationFrame(layoutEditor);
    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(layoutEditor);
    });
    observer.observe(container);

    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [mode, language, overrideVersion]);

  return (
    <div className="flex h-full min-h-[360px] flex-col gap-3 overflow-hidden lg:min-h-0">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b pb-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[var(--lc-text-muted)]">模式</label>
          <select
            className="lc-select"
            value={mode}
            onChange={(event) => {
              const nextMode = toMode(event.target.value);
              if (!isModeAllowed(nextMode, safeModeSupport)) {
                return;
              }
              if (nextMode === mode) {
                return;
              }

              setMode(nextMode);
              if (nextMode === "acm") {
                setCode(acmCodeByLanguage[language] ?? DEFAULT_ACM_CODES[language]);
                return;
              }

              setCode(coreCodeByLanguage[language] ?? "");
            }}
          >
            <option value="core" disabled={!isModeAllowed("core", safeModeSupport)}>
              核心代码模式
            </option>
            <option value="acm" disabled={!isModeAllowed("acm", safeModeSupport)}>
              ACM 模式
            </option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[var(--lc-text-muted)]">语言</label>
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

              setCode(acmCodeByLanguage[nextLanguage] ?? DEFAULT_ACM_CODES[nextLanguage]);
            }}
          >
            <option value="cpp">C++</option>
            <option value="python">Python</option>
          </select>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 text-xs text-[var(--lc-text-muted)] sm:ml-auto sm:w-auto sm:justify-end">
          <span className="rounded border bg-[var(--lc-surface-soft)] px-2 py-0.5">
            {mode === "core" ? "核心模式" : "ACM 模式"}
          </span>
          <span className="rounded border bg-[var(--lc-surface-soft)] px-2 py-0.5">
            {language === "cpp" ? "C++" : "Python"}
          </span>
        </div>
      </div>

      <div ref={editorContainerRef} className="min-h-[320px] flex-1 overflow-hidden rounded-lg border lg:min-h-0">
        <Editor
          key={editorInstanceKey}
          height="100%"
          saveViewState={false}
          language={monacoLanguage}
          value={code}
          beforeMount={(monaco) => {
            monaco.editor.defineTheme(MONACO_THEME_DARK, {
              base: "vs-dark",
              inherit: true,
              rules: [],
              colors: {
                "editor.background": "#1E1E1E",
                "editor.foreground": "#D4D4D4",
                "editorLineNumber.foreground": "#858585",
                "editorLineNumber.activeForeground": "#C6C6C6",
                "editorCursor.foreground": "#4D93FF",
                "editor.selectionBackground": "#264F78"
              }
            });
            monaco.editor.defineTheme(MONACO_THEME_LIGHT, {
              base: "vs",
              inherit: true,
              rules: [],
              colors: {
                "editor.background": "#FFFFFF",
                "editor.foreground": "#1F2430",
                "editorLineNumber.foreground": "#9AA3B2",
                "editorLineNumber.activeForeground": "#48556A",
                "editorCursor.foreground": "#1A73E8",
                "editor.selectionBackground": "#D7E8FF"
              }
            });
          }}
          onMount={(editor) => {
            editorRef.current = editor;
            editor.updateOptions({
              readOnly: false,
              domReadOnly: false
            });
            window.requestAnimationFrame(() => {
              editor.layout();
              editor.setScrollTop(0);
              editor.setScrollLeft(0);
            });
          }}
          onChange={(value) => {
            const nextCode = value ?? "";
            setCode(nextCode);
            if (mode === "core") {
              setCoreCodeByLanguage((previous) => ({
                ...previous,
                [language]: nextCode
              }));
            } else {
              setAcmCodeByLanguage((previous) => ({
                ...previous,
                [language]: nextCode
              }));
            }
          }}
          theme={editorTheme}
          options={{
            minimap: { enabled: false },
            lineNumbers: "on",
            fontSize: 13,
            lineHeight: 21,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            fontFamily: "Menlo, Monaco, Consolas, 'Courier New', monospace",
            smoothScrolling: false,
            padding: {
              top: 10,
              bottom: 10
            },
            readOnly: false,
            domReadOnly: false
          }}
        />
      </div>
    </div>
  );
}
