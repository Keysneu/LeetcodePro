"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { fetchProgressOverview, ProgressOverviewResponse } from "@/lib/progress-api";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

type Props = {
  apiBaseUrl: string;
};

function heatmapLevel(acCount: number): string {
  if (acCount <= 0) {
    return "未打卡";
  }
  if (acCount <= 2) {
    return "轻量";
  }
  if (acCount <= 4) {
    return "稳定";
  }
  if (acCount <= 7) {
    return "高强度";
  }
  return "冲刺";
}

function buildHeatmapOption(data: ProgressOverviewResponse): EChartsOption {
  const points = data.heatmap.days.map((item) => [item.date, item.acCount]);
  const maxCount = Math.max(1, ...data.heatmap.days.map((item) => item.acCount));

  return {
    backgroundColor: "transparent",
    tooltip: {
      formatter: (params) => {
        const rawValue = (params as unknown as { value?: unknown }).value;
        const tuple = Array.isArray(rawValue) ? rawValue : ["", 0];
        const date = String(tuple[0] ?? "");
        const acCount = Number(tuple[1] ?? 0);
        return `${date}<br/>AC 提交：${acCount}（${heatmapLevel(acCount)}）`;
      }
    },
    visualMap: {
      min: 0,
      max: maxCount,
      calculable: false,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      text: ["高", "低"],
      inRange: {
        color: ["#1f2937", "#254f31", "#2f7b45", "#3faa5b", "#84e3a3"]
      },
      textStyle: {
        color: "#a4adbf"
      }
    },
    calendar: {
      top: 24,
      left: 24,
      right: 24,
      range: [data.heatmap.startDate, data.heatmap.endDate],
      cellSize: ["auto", 16],
      splitLine: {
        show: true,
        lineStyle: {
          color: "#353a49",
          width: 1
        }
      },
      itemStyle: {
        color: "#1d212b",
        borderColor: "#353a49"
      },
      yearLabel: { show: false },
      dayLabel: {
        firstDay: 1,
        nameMap: "cn",
        color: "#a4adbf"
      },
      monthLabel: {
        nameMap: "cn",
        color: "#a4adbf"
      }
    },
    series: [
      {
        type: "heatmap",
        coordinateSystem: "calendar",
        data: points
      }
    ]
  };
}

function buildRadarOption(data: ProgressOverviewResponse): EChartsOption {
  return {
    backgroundColor: "transparent",
    tooltip: {
      formatter: () =>
        data.radar.tags
          .map((item) => `${item.tag}: ${item.coverageRate.toFixed(2)}%（${item.solvedProblems}/${item.totalProblems}）`)
          .join("<br/>")
    },
    radar: {
      center: ["50%", "52%"],
      radius: "68%",
      splitNumber: 5,
      axisName: {
        color: "#eff1f6",
        fontSize: 12
      },
      splitLine: {
        lineStyle: {
          color: "#434a5f"
        }
      },
      splitArea: {
        areaStyle: {
          color: ["rgba(255,255,255,0.02)", "rgba(255,255,255,0.01)"]
        }
      },
      axisLine: {
        lineStyle: {
          color: "#434a5f"
        }
      },
      indicator: data.radar.tags.map((item) => ({
        name: `${item.tag} (${item.solvedProblems}/${item.totalProblems})`,
        max: 100
      }))
    },
    series: [
      {
        type: "radar",
        symbol: "circle",
        symbolSize: 6,
        lineStyle: {
          width: 2,
          color: "#ffa116"
        },
        itemStyle: {
          color: "#ffa116"
        },
        areaStyle: {
          color: "rgba(255, 161, 22, 0.2)"
        },
        data: [
          {
            value: data.radar.tags.map((item) => Number(item.coverageRate.toFixed(2))),
            name: "标签覆盖率"
          }
        ]
      }
    ]
  };
}

function dueModeLabel(mode: "core" | "acm"): string {
  return mode === "core" ? "核心" : "ACM";
}

function formatDateTime(iso: string | null): string {
  if (!iso) {
    return "-";
  }
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) {
    return iso;
  }
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

export default function ProgressDashboard({ apiBaseUrl }: Props) {
  const [timezone, setTimezone] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<ProgressOverviewResponse | null>(null);

  useEffect(() => {
    try {
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTimezone(browserTz && browserTz.trim().length > 0 ? browserTz : "UTC");
    } catch {
      setTimezone("UTC");
    }
  }, []);

  const loadOverview = useCallback(
    async (nextTimezone: string, signal?: AbortSignal) => {
      setLoading(true);
      setError(null);

      try {
        const payload = await fetchProgressOverview(apiBaseUrl, nextTimezone, signal);
        setOverview(payload);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "进度数据加载失败，请稍后重试。";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl]
  );

  useEffect(() => {
    if (!timezone) {
      return;
    }

    const controller = new AbortController();
    void loadOverview(timezone, controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadOverview, timezone]);

  const heatmapOption = useMemo(() => {
    if (!overview) {
      return null;
    }
    return buildHeatmapOption(overview);
  }, [overview]);

  const radarOption = useMemo(() => {
    if (!overview || overview.radar.tags.length === 0) {
      return null;
    }
    return buildRadarOption(overview);
  }, [overview]);

  const coreCompletionText = useMemo(() => {
    if (!overview) {
      return "--";
    }
    const total = overview.mastery.modeCompletion.core.supportedProblems;
    if (total <= 0) {
      return "0 / 0";
    }
    return `${overview.mastery.modeCompletion.core.masteredProblems} / ${total}`;
  }, [overview]);

  const acmCompletionText = useMemo(() => {
    if (!overview) {
      return "--";
    }
    const total = overview.mastery.modeCompletion.acm.supportedProblems;
    if (total <= 0) {
      return "0 / 0";
    }
    return `${overview.mastery.modeCompletion.acm.masteredProblems} / ${total}`;
  }, [overview]);

  return (
    <section className="lc-page-wide lc-page-section">
      <div className="lc-page-header">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--lc-text)]">学习进度</h1>
        <p className="mt-1 text-sm text-[var(--lc-text-muted)]">近 90 天打卡热力图与 Top8 标签能力雷达图（按浏览器时区统计）。</p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="lc-card p-4 xl:col-span-3">
          <p className="text-xs text-[var(--lc-text-muted)]">90 天 AC 提交总数</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--lc-text)]">
            {loading ? "--" : (overview?.summary.totalAcSubmissions90d ?? 0)}
          </p>
        </div>
        <div className="lc-card p-4 xl:col-span-3">
          <p className="text-xs text-[var(--lc-text-muted)]">90 天活跃打卡天数</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--lc-text)]">{loading ? "--" : (overview?.summary.activeDays90d ?? 0)}</p>
        </div>
        <div className="lc-card p-4 xl:col-span-3">
          <p className="text-xs text-[var(--lc-text-muted)]">统计时区</p>
          <p className="mt-2 text-sm font-medium text-[var(--lc-text)]">{timezone || "解析中"}</p>
        </div>
        <div className="lc-card p-4 xl:col-span-3">
          <p className="text-xs text-[var(--lc-text-muted)]">已熟练题数（仅 C++）</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--lc-text)]">{loading ? "--" : (overview?.mastery.masteredProblems ?? 0)}</p>
          <p className="mt-1 text-xs text-[var(--lc-text-muted)]">双模式都熟练：{loading ? "--" : (overview?.mastery.bothModesMasteredProblems ?? 0)}</p>
        </div>
        <div className="lc-card p-4 xl:col-span-3">
          <p className="text-xs text-[var(--lc-text-muted)]">待复习题数</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--lc-danger)]">{loading ? "--" : (overview?.mastery.dueReviewProblems ?? 0)}</p>
          <p className="mt-1 text-xs text-[var(--lc-text-muted)]">按逾期优先展示 Top10</p>
        </div>
        <div className="lc-card p-4 xl:col-span-6">
          <p className="text-xs text-[var(--lc-text-muted)]">双模式熟练进度</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-[var(--lc-surface-soft)] px-3 py-3">
              <p className="text-xs text-[var(--lc-text-muted)]">Core</p>
              <p className="mt-2 text-lg font-semibold text-[var(--lc-text)]">{coreCompletionText}</p>
            </div>
            <div className="rounded-lg border bg-[var(--lc-surface-soft)] px-3 py-3">
              <p className="text-xs text-[var(--lc-text-muted)]">ACM</p>
              <p className="mt-2 text-lg font-semibold text-[var(--lc-text)]">{acmCompletionText}</p>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="lc-card flex flex-col gap-3 p-5">
          <p className="text-sm text-[var(--lc-danger)]">{error}</p>
          <div>
            <button className="lc-btn-secondary" onClick={() => void loadOverview(timezone)} type="button" disabled={!timezone || loading}>
              重新加载
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="lc-card p-4 xl:col-span-7">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-[var(--lc-text)]">打卡热力图</h2>
            <p className="text-xs text-[var(--lc-text-muted)]">按日累计 AC 提交次数，同题同日多次 AC 会累计。</p>
          </div>
          {loading || !heatmapOption ? (
            <div className="h-[340px] animate-pulse rounded-lg bg-[var(--lc-surface-soft)] sm:h-[360px]" />
          ) : (
            <div className="h-[340px] sm:h-[360px]">
              <ReactECharts option={heatmapOption} style={{ height: "100%", width: "100%" }} notMerge lazyUpdate />
            </div>
          )}
        </div>

        <div className="lc-card p-4 xl:col-span-5">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-[var(--lc-text)]">能力雷达图</h2>
            <p className="text-xs text-[var(--lc-text-muted)]">Top8 高频标签，覆盖率 = 近90天已 AC 题数 / 标签全库总题数。</p>
          </div>
          {loading ? (
            <div className="h-[340px] animate-pulse rounded-lg bg-[var(--lc-surface-soft)] sm:h-[360px]" />
          ) : !radarOption ? (
            <div className="flex h-[340px] items-center justify-center rounded-lg border border-dashed text-sm text-[var(--lc-text-muted)] sm:h-[360px]">
              当前暂无可展示的标签数据
            </div>
          ) : (
            <div className="h-[340px] sm:h-[360px]">
              <ReactECharts option={radarOption} style={{ height: "100%", width: "100%" }} notMerge lazyUpdate />
            </div>
          )}
        </div>
      </div>

      <div className="lc-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-[var(--lc-text)]">待复习题目（Top10）</h2>
            <p className="text-xs text-[var(--lc-text-muted)]">{overview?.mastery.note ?? "掌握度仅统计 C++ 提交"}</p>
          </div>
          <div className="text-xs text-[var(--lc-text-muted)]">
            状态分布：
            {loading
              ? " --"
              : ` 未做题 ${overview?.mastery.statusCounts.UNTOUCHED ?? 0} / 学习中 ${overview?.mastery.statusCounts.LEARNING ?? 0} / 巩固中 ${overview?.mastery.statusCounts.REINFORCING ?? 0} / 已熟练 ${overview?.mastery.statusCounts.MASTERED ?? 0} / 待复习 ${overview?.mastery.statusCounts.REVIEW_DUE ?? 0}`}
          </div>
        </div>

        {loading ? (
          <div className="h-[220px] animate-pulse rounded-lg bg-[var(--lc-surface-soft)]" />
        ) : (overview?.mastery.dueReviewItems.length ?? 0) === 0 ? (
          <div className="flex h-[180px] items-center justify-center rounded-lg border border-dashed text-sm text-[var(--lc-text-muted)]">
            当前没有到期复习的题目
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-[var(--lc-text-muted)]">
                  <th className="px-2 py-2 font-medium">题目</th>
                  <th className="px-2 py-2 font-medium">待复习模式</th>
                  <th className="px-2 py-2 font-medium">建议复习时间</th>
                  <th className="px-2 py-2 font-medium">逾期天数</th>
                </tr>
              </thead>
              <tbody>
                {overview?.mastery.dueReviewItems.map((item) => (
                  <tr key={item.problemId} className="border-b last:border-b-0">
                    <td className="px-2 py-2">
                      <Link className="text-[var(--lc-accent)] hover:underline" href={`/problems/${item.problemSlug}`}>
                        {item.leetcodeId ? `${item.leetcodeId}. ` : ""}
                        {item.problemTitle}
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-[var(--lc-text)]">{item.dueModes.map((mode) => dueModeLabel(mode)).join("/")}</td>
                    <td className="px-2 py-2 text-[var(--lc-text-muted)]">{formatDateTime(item.nextReviewAt)}</td>
                    <td className="px-2 py-2 font-semibold text-[var(--lc-danger)]">{item.overdueDays <= 0 ? "今天" : `${item.overdueDays} 天`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
