"use client";
import { useMemo } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { useRollups } from "@/lib/hooks";
import {
  formatCompact,
  formatPeriodDate,
  weiToFloat,
} from "@/lib/format";
import { nz } from "@/lib/quai/types";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SamplingFootnote } from "@/components/dashboard/shared/SamplingFootnote";
import { ProtocolEventLines } from "@/components/dashboard/history/ProtocolEventLines";

// BlockRewardChart — daily averages of base block reward and per-share
// workshare reward. Two lines on a shared axis; both are QUAI wei.

export function BlockRewardChart({ from, to }: { from: string; to: string }) {
  const { data, isLoading, error } = useRollups({ period: "day", from, to });

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((r) => ({
      date: r.periodStart,
      base: weiToFloat(nz(r.baseBlockRewardAvg), 4),
      workshare: weiToFloat(nz(r.workshareRewardAvg), 4),
    }));
  }, [data]);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <CardTitle>Block reward</CardTitle>
        <SamplingFootnote kind="averaged" />
      </div>
      <p className="mt-1 text-xs text-slate-900/55 dark:text-white/55">
        Average base block reward and per-workshare reward, in QUAI.
      </p>

      <div className="mt-3 h-56">
        {isLoading || !data ? (
          <div className="h-full animate-pulse rounded bg-slate-900/5 dark:bg-white/5" />
        ) : error ? (
          <div className="text-sm text-red-600 dark:text-red-300">{String(error)}</div>
        ) : data.length === 0 ? (
          <div className="text-sm text-slate-900/50 dark:text-white/50">No rollup data.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                tickFormatter={formatPeriodDate}
                minTickGap={32}
              />
              <YAxis
                tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                tickFormatter={formatCompact}
                width={64}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--chart-tooltip-bg)",
                  color: "var(--chart-tooltip-text)",
                  border: "1px solid var(--chart-tooltip-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(v) => formatPeriodDate(String(v))}
                formatter={(v, name) => [`${Number(v).toLocaleString()} QUAI`, String(name)]}
              />
              <ProtocolEventLines visibleFrom={from} visibleTo={to} />
              <Line type="monotone" dataKey="base" name="Base block reward" stroke="#3b82f6" strokeWidth={1.6} dot={false} />
              <Line type="monotone" dataKey="workshare" name="Per-workshare reward" stroke="#a855f7" strokeWidth={1.4} dot={false} strokeDasharray="3 3" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
