"use client";
import { useMemo } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { useSupply } from "@/lib/hooks";
import {
  formatCompact,
  formatPeriodDate,
  qitsToFloat,
} from "@/lib/format";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ProtocolEventLines } from "@/components/dashboard/history/ProtocolEventLines";

// QiCumulativeChart — single-line cumulative Qi supply since Qi mining began.
// Qi has no sinks (no burn, no Singularity skip), so the line is monotonically
// non-decreasing. Companion to the SupplyStoryChart but without the wedges,
// which would be misleading visual cruft for Qi.

export function QiCumulativeChart({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  const { data, isLoading, error } = useSupply({
    period: "day",
    from,
    to,
    include: ["qi"],
  });

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((r) => ({
      date: r.periodStart,
      qi: qitsToFloat(r.qiTotalEnd ?? 0n, 0),
    }));
  }, [data]);

  const last = data?.[data.length - 1];

  return (
    <Card>
      <CardTitle>Qi cumulative supply</CardTitle>
      <p className="mt-1 max-w-md text-xs text-slate-900/55 dark:text-white/55">
        Qi has no burn or skip mechanism. The line is the running total of
        every Qi minted on cyprus1.
      </p>

      <div className="mt-3 h-56">
        {isLoading || !data ? (
          <div className="h-full animate-pulse rounded bg-slate-900/5 dark:bg-white/5" />
        ) : error ? (
          <div className="text-sm text-red-600 dark:text-red-300">{String(error)}</div>
        ) : data.length === 0 ? (
          <div className="text-sm text-slate-900/50 dark:text-white/50">
            No Qi supply data in this range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                tickFormatter={formatPeriodDate}
                minTickGap={48}
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
                formatter={(v) => [`${Number(v).toLocaleString()} QI`, "Qi supply"]}
              />
              <ProtocolEventLines visibleFrom={from} visibleTo={to} />
              <Line
                type="monotone"
                dataKey="qi"
                stroke="#10b981"
                strokeWidth={1.6}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {last && (
        <div className="mt-2 text-xs text-slate-900/50 dark:text-white/50">
          Latest {formatPeriodDate(last.periodStart)}:{" "}
          <span className="font-mono text-slate-900/80 dark:text-white/80">
            {formatCompact(qitsToFloat(last.qiTotalEnd ?? 0n, 0))} QI
          </span>
        </div>
      )}
    </Card>
  );
}
