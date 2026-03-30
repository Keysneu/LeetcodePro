import Link from "next/link";
import NoteUploadCard from "@/components/note-upload-card";

export default function HomePage() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

  return (
    <section className="space-y-4">
      <div className="lc-card overflow-hidden">
        <div className="border-b px-5 py-5" style={{ background: "linear-gradient(120deg, var(--lc-accent-soft), transparent 65%)" }}>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--lc-text)]">MVP 第一阶段</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--lc-text-muted)]">
            目标是完整跑通做题、判题、AI 点评闭环，并提供接近 LeetCode 的交互布局和深色编辑体验。
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-3">
          <div className="rounded-lg border bg-[var(--lc-surface-soft)] px-4 py-3">
            <p className="text-xs text-[var(--lc-text-muted)]">题库</p>
            <p className="mt-1 text-sm font-medium">MVP 最小题集已接入 API</p>
          </div>
          <div className="rounded-lg border bg-[var(--lc-surface-soft)] px-4 py-3">
            <p className="text-xs text-[var(--lc-text-muted)]">判题</p>
            <p className="mt-1 text-sm font-medium">支持 C++ / Python 双模式</p>
          </div>
          <div className="rounded-lg border bg-[var(--lc-surface-soft)] px-4 py-3">
            <p className="text-xs text-[var(--lc-text-muted)]">AI 导师</p>
            <p className="mt-1 text-sm font-medium">SSE 流式引导点评</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Link href="/problems" className="lc-btn-primary">
          进入题库
        </Link>
      </div>

      <NoteUploadCard apiBaseUrl={apiBaseUrl} />
    </section>
  );
}
