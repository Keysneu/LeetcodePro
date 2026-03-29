"use client";

import Editor from "@monaco-editor/react";
import { useEffect, useMemo, useState } from "react";

export type EditorMode = "core" | "acm";
export type EditorLanguage = "cpp" | "python";

export type EditorState = {
  mode: EditorMode;
  language: EditorLanguage;
  code: string;
};

type Props = {
  initialCode: string;
  initialMode?: EditorMode;
  initialLanguage?: EditorLanguage;
  onStateChange?: (state: EditorState) => void;
};

function toMode(value: string): EditorMode {
  return value === "acm" ? "acm" : "core";
}

function toLanguage(value: string): EditorLanguage {
  return value === "python" ? "python" : "cpp";
}

export default function CodeEditor({
  initialCode,
  initialMode = "core",
  initialLanguage = "cpp",
  onStateChange
}: Props) {
  const [mode, setMode] = useState<EditorMode>(initialMode);
  const [language, setLanguage] = useState<EditorLanguage>(initialLanguage);
  const [code, setCode] = useState(initialCode);

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

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="text-slate-300">模式</label>
        <select
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1"
          value={mode}
          onChange={(event) => setMode(toMode(event.target.value))}
        >
          <option value="core">核心代码模式</option>
          <option value="acm">ACM 模式</option>
        </select>

        <label className="ml-2 text-slate-300">语言</label>
        <select
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1"
          value={language}
          onChange={(event) => setLanguage(toLanguage(event.target.value))}
        >
          <option value="cpp">C++</option>
          <option value="python">Python</option>
        </select>
      </div>

      <div className="min-h-[420px] overflow-hidden rounded-lg border border-slate-800">
        <Editor
          height="420px"
          language={monacoLanguage}
          value={code}
          onChange={(value) => setCode(value ?? "")}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            automaticLayout: true
          }}
        />
      </div>

      <div className="rounded border border-slate-800 bg-slate-900 p-3 text-xs text-slate-300">
        当前模式：{mode} | 当前语言：{language}
      </div>
    </div>
  );
}
