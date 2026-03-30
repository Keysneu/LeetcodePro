"use client";

import { type ChangeEvent, useCallback, useState } from "react";

type UploadMatchItem = {
  problemSlug: string;
  problemTitle: string;
  matchedHeading: string;
};

type UploadNotesResponse = {
  item: {
    noteId: string;
    filename: string;
    totalSections: number;
    matchedCount: number;
    unmatchedSectionCount: number;
    matches: UploadMatchItem[];
  };
};

type Props = {
  apiBaseUrl: string;
};

function parseErrorMessage(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }

  if (typeof payload !== "object" || payload === null) {
    return "请求失败，请稍后重试。";
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.message === "string") {
    return record.message;
  }

  if (Array.isArray(record.message) && typeof record.message[0] === "string") {
    return record.message[0];
  }

  return "请求失败，请稍后重试。";
}

export default function NoteUploadCard({ apiBaseUrl }: Props) {
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSummary, setUploadSummary] = useState<UploadNotesResponse["item"] | null>(null);

  const handleUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0] ?? null;
      event.target.value = "";

      if (!selectedFile) {
        return;
      }

      setUploadError(null);
      setUploadSummary(null);

      if (!selectedFile.name.toLowerCase().endsWith(".md")) {
        setUploadError("仅支持 .md 文件，请重新选择。");
        return;
      }

      let markdownContent = "";
      try {
        markdownContent = (await selectedFile.text()).trim();
      } catch {
        setUploadError("读取文件失败，请重试。");
        return;
      }

      if (markdownContent.length === 0) {
        setUploadError("笔记内容为空，请检查文件内容。");
        return;
      }

      setUploadLoading(true);

      try {
        const response = await fetch(`${apiBaseUrl}/api/notes/upload`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            filename: selectedFile.name,
            markdownContent
          })
        });

        const payload = (await response.json()) as unknown;
        if (!response.ok) {
          throw new Error(parseErrorMessage(payload));
        }

        const data = payload as UploadNotesResponse;
        setUploadSummary(data.item);
      } catch (error) {
        const message = error instanceof Error ? error.message : "笔记上传失败，请稍后重试。";
        setUploadError(message);
      } finally {
        setUploadLoading(false);
      }
    },
    [apiBaseUrl]
  );

  return (
    <section className="lc-card overflow-hidden">
      <div className="border-b bg-[var(--lc-surface-soft)] px-5 py-4">
        <h2 className="text-base font-semibold text-[var(--lc-text)]">上传刷题笔记（全局）</h2>
        <p className="mt-1 text-xs text-[var(--lc-text-muted)]">上传一次即可。系统会自动按题目提取内容，你在任意题目的“题解”标签都能看到个人笔记。</p>
      </div>

      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="lc-btn-secondary h-9 cursor-pointer px-4 text-sm">
            {uploadLoading ? "上传中..." : "选择 Markdown 文件"}
            <input
              type="file"
              accept=".md,text/markdown"
              className="hidden"
              onChange={(event) => {
                void handleUpload(event);
              }}
              disabled={uploadLoading}
            />
          </label>
          <span className="text-xs text-[var(--lc-text-muted)]">建议文件包含明确的题目标题/slug（例如 `# Two Sum`、`# two-sum`）以提升匹配准确率。</span>
        </div>

        {uploadSummary ? (
          <div className="space-y-2 rounded-lg border bg-[var(--lc-surface-soft)] p-3 text-xs">
            <p className="font-semibold text-[var(--lc-success)]">上传成功：{uploadSummary.filename}</p>
            <p className="text-[var(--lc-text-muted)]">
              解析段落 {uploadSummary.totalSections}，匹配题目 {uploadSummary.matchedCount}，未匹配段落 {uploadSummary.unmatchedSectionCount}
            </p>
            <div className="max-h-36 overflow-y-auto rounded border bg-[var(--lc-surface)] p-2">
              {uploadSummary.matches.length > 0 ? (
                <ul className="space-y-1">
                  {uploadSummary.matches.map((entry, index) => (
                    <li key={`${entry.problemSlug}-${index}`} className="text-[var(--lc-text-muted)]">
                      <span className="font-semibold text-[var(--lc-text)]">{entry.problemTitle}</span>
                      <span className="ml-1">({entry.problemSlug})</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[var(--lc-text-muted)]">暂无可匹配题目，请检查 Markdown 标题格式。</p>
              )}
            </div>
          </div>
        ) : null}

        {uploadError ? <p className="text-sm text-[var(--lc-danger)]">{uploadError}</p> : null}
      </div>
    </section>
  );
}
