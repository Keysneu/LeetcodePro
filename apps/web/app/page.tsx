import Link from "next/link";
import AiConfigCard from "@/components/ai-config-card";
import NoteUploadCard from "@/components/note-upload-card";

export default function HomePage() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

  return (
    <section className="lc-page-wide lc-page-section">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <div className="lc-card overflow-hidden">
          <div
            className="border-b px-5 py-6 sm:px-6"
            style={{ background: "linear-gradient(120deg, var(--lc-accent-soft), transparent 65%)" }}
          >
            <p className="lc-page-header-kicker">Daily Practice</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--lc-text)] sm:text-4xl">LeetCodePro 前端工作台</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--lc-text-muted)] sm:text-base">
              把题库、做题、判题、AI 导师和复习追踪放进一套连续的训练流里，减少切页和信息断层。
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/problems" className="lc-btn-primary">
                进入题库
              </Link>
              <Link href="/progress" className="lc-btn-secondary">
                查看学习进度
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-3 sm:px-6">
            <div className="rounded-lg border bg-[var(--lc-surface-soft)] px-4 py-3">
              <p className="text-xs text-[var(--lc-text-muted)]">题库</p>
              <p className="mt-1 text-sm font-medium">Hot 100 题单与掌握度状态联动</p>
            </div>
            <div className="rounded-lg border bg-[var(--lc-surface-soft)] px-4 py-3">
              <p className="text-xs text-[var(--lc-text-muted)]">判题</p>
              <p className="mt-1 text-sm font-medium">支持 C++ / Python 的核心与 ACM 双模式</p>
            </div>
            <div className="rounded-lg border bg-[var(--lc-surface-soft)] px-4 py-3">
              <p className="text-xs text-[var(--lc-text-muted)]">AI 导师</p>
              <p className="mt-1 text-sm font-medium">SSE 流式定位错误并提供引导式反馈</p>
            </div>
          </div>
        </div>

        <div className="lc-card flex flex-col justify-between overflow-hidden">
          <div className="border-b bg-[var(--lc-surface-soft)] px-5 py-4 sm:px-6">
            <p className="text-sm font-semibold text-[var(--lc-text)]">本轮工作流</p>
            <p className="mt-2 text-sm leading-6 text-[var(--lc-text-muted)]">
              推荐先进入题库选择题目，再在做题页完成提交，最后到进度页查看复习信号。
            </p>
          </div>
          <div className="space-y-3 px-5 py-4 sm:px-6">
            <div className="rounded-lg border bg-[var(--lc-surface-soft)] p-4">
              <p className="text-xs text-[var(--lc-text-muted)]">Step 1</p>
              <p className="mt-1 text-sm font-medium text-[var(--lc-text)]">选择当前训练题</p>
            </div>
            <div className="rounded-lg border bg-[var(--lc-surface-soft)] p-4">
              <p className="text-xs text-[var(--lc-text-muted)]">Step 2</p>
              <p className="mt-1 text-sm font-medium text-[var(--lc-text)]">提交判题并查看失败用例</p>
            </div>
            <div className="rounded-lg border bg-[var(--lc-surface-soft)] p-4">
              <p className="text-xs text-[var(--lc-text-muted)]">Step 3</p>
              <p className="mt-1 text-sm font-medium text-[var(--lc-text)]">结合 AI 反馈与复习节奏继续巩固</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <AiConfigCard apiBaseUrl={apiBaseUrl} />
        <NoteUploadCard apiBaseUrl={apiBaseUrl} />
      </div>
    </section>
  );
}
