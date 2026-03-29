import Link from "next/link";

export default function HomePage() {
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold text-white">MVP 第一阶段：做题 -&gt; 判题 -&gt; AI 点评</h1>
      <p className="max-w-3xl text-slate-300">
        当前版本已打通题目页真实提交，支持从前端直接触发判题并查看 AI 点评。
      </p>
      <div className="flex gap-3">
        <Link
          href="/problems"
          className="rounded bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400"
        >
          开始做题
        </Link>
      </div>
    </section>
  );
}
