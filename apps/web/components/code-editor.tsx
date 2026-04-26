"use client";

import Editor from "@monaco-editor/react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_ACM_CODES, getDefaultTemplate } from "@/lib/code-format";

export type EditorMode = "core" | "acm";
export type EditorLanguage = "cpp" | "python";
type ModeSupport = "CORE" | "ACM" | "BOTH";
type MonacoThemeName = "leetcodepro-editor-dark" | "leetcodepro-editor-light";

export type EditorState = {
  mode: EditorMode;
  language: EditorLanguage;
  code: string;
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

type RestoreTemplateDialogProps = {
  currentMode: EditorMode;
  currentLanguage: EditorLanguage;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function RestoreTemplateDialog({ currentMode, currentLanguage, open, onCancel, onConfirm }: RestoreTemplateDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="lc-modal-backdrop"
      onClick={onCancel}
      aria-hidden="true"
    >
      <div
        className="lc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="restore-template-title"
        aria-describedby="restore-template-description"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="restore-template-title" className="text-base font-semibold text-[var(--lc-text)]">
          确认还原默认模板
        </h3>
        <p id="restore-template-description" className="mt-2 text-sm leading-6 text-[var(--lc-text-muted)]">
          这会覆盖当前编辑器中的代码内容，但不会影响该题其它模式或语言的缓存。是否继续？
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--lc-text-muted)]">
          <span className="rounded border bg-[var(--lc-surface-soft)] px-2 py-0.5">
            {currentMode === "core" ? "核心模式" : "ACM 模式"}
          </span>
          <span className="rounded border bg-[var(--lc-surface-soft)] px-2 py-0.5">
            {currentLanguage === "cpp" ? "C++" : "Python"}
          </span>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="lc-btn-secondary h-9 px-4" onClick={onCancel} autoFocus>
            取消
          </button>
          <button type="button" className="lc-btn-primary h-9 px-4" onClick={onConfirm}>
            确认还原
          </button>
        </div>
      </div>
    </div>
  );
}

function RestoreTemplateIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7V3.75L3.75 7 7 10.25V7h6.25a5 5 0 1 1-4.48 7.22" />
    </svg>
  );
}

type ToolbarIconButtonProps = {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
};

function ToolbarIconButton({ icon, label, disabled = false, onClick }: ToolbarIconButtonProps) {
  return (
    <button
      type="button"
      className="inline-flex h-7 w-7 items-center justify-center rounded-[10px] border bg-[var(--lc-surface-soft)] text-[var(--lc-text-muted)] transition hover:border-[var(--lc-accent)] hover:text-[var(--lc-text)] disabled:cursor-not-allowed disabled:opacity-45"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      <span>{icon}</span>
      <span className="sr-only">{label}</span>
    </button>
  );
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
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const editorInstanceKey = `${mode}:${language}:${overrideVersion}`;

  const monacoLanguage = useMemo(() => {
    if (language === "cpp") {
      return "cpp";
    }

    return "python";
  }, [language]);
  const defaultTemplate = useMemo(
    () => getDefaultTemplate(mode, language, initialCoreCodes),
    [initialCoreCodes, language, mode]
  );
  const canRestoreTemplate = code !== defaultTemplate;

  const applyCodeChange = useCallback(
    (nextCode: string, nextMode: EditorMode = mode, nextLanguage: EditorLanguage = language) => {
      setCode(nextCode);
      if (nextMode === "core") {
        setCoreCodeByLanguage((previous) => ({
          ...previous,
          [nextLanguage]: nextCode
        }));
        return;
      }

      setAcmCodeByLanguage((previous) => ({
        ...previous,
        [nextLanguage]: nextCode
      }));
    },
    [language, mode]
  );

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
    applyCodeChange(
      nextMode === "core" ? coreCodeByLanguage[language] ?? "" : acmCodeByLanguage[language] ?? DEFAULT_ACM_CODES[language],
      nextMode,
      language
    );
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
    applyCodeChange(nextCode, nextMode, nextLanguage);
  }, [applyCodeChange, overrideState, overrideVersion, safeModeSupport]);

  useEffect(() => {
    if (!isRestoreDialogOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      setIsRestoreDialogOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isRestoreDialogOpen]);

  const handleRestoreTemplate = useCallback(() => {
    if (!canRestoreTemplate) {
      return;
    }

    setIsRestoreDialogOpen(false);
    applyCodeChange(defaultTemplate);
  }, [applyCodeChange, canRestoreTemplate, defaultTemplate]);

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
    <div className="flex h-full min-h-[320px] flex-col gap-2 overflow-hidden lg:min-h-0">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--lc-border-soft)] pb-2 text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <label className="shrink-0 text-[11px] font-medium text-[var(--lc-text-muted)]">模式</label>
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
                applyCodeChange(acmCodeByLanguage[language] ?? DEFAULT_ACM_CODES[language], nextMode, language);
                return;
              }

              applyCodeChange(coreCodeByLanguage[language] ?? "", nextMode, language);
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

        <div className="flex min-w-0 items-center gap-2">
          <label className="shrink-0 text-[11px] font-medium text-[var(--lc-text-muted)]">语言</label>
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
                applyCodeChange(coreCodeByLanguage[nextLanguage] ?? "", mode, nextLanguage);
                return;
              }

              applyCodeChange(acmCodeByLanguage[nextLanguage] ?? DEFAULT_ACM_CODES[nextLanguage], mode, nextLanguage);
            }}
          >
            <option value="cpp">C++</option>
            <option value="python">Python</option>
          </select>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <ToolbarIconButton
            icon={<RestoreTemplateIcon />}
            label="还原默认模板"
            disabled={!canRestoreTemplate}
            onClick={() => setIsRestoreDialogOpen(true)}
          />
          <span className="rounded-[10px] border bg-[var(--lc-surface-soft)] px-2 py-0.5 text-[11px] font-medium">
            {mode === "core" ? "核心模式" : "ACM 模式"}
          </span>
          <span className="rounded-[10px] border bg-[var(--lc-surface-soft)] px-2 py-0.5 text-[11px] font-medium">
            {language === "cpp" ? "C++" : "Python"}
          </span>
        </div>
      </div>

      <div ref={editorContainerRef} className="min-h-[300px] flex-1 overflow-hidden rounded-[12px] border border-[var(--lc-code-editor-border)] lg:min-h-0">
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
            applyCodeChange(nextCode);
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
              top: 6,
              bottom: 6
            },
            readOnly: false,
            domReadOnly: false
          }}
        />
      </div>

      <RestoreTemplateDialog
        currentMode={mode}
        currentLanguage={language}
        open={isRestoreDialogOpen}
        onCancel={() => setIsRestoreDialogOpen(false)}
        onConfirm={handleRestoreTemplate}
      />
    </div>
  );
}
