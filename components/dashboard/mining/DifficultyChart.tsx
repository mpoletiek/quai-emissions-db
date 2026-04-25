"use client";
import { useMemo } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { useRollups } from "@/lib/hooks";
import { formatDifficulty, formatPeriodDate } from "@/lib/format";
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

export function DifficultyChart({ from, to }: { from: string; to: string }) {
  const { data, isLoading, error } = useRollups({ period: "day", from, to });

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((r) => ({
      date: r.periodStart,
      kawpow: Number(nz(r.kawpowDifficultyAvg)),
      sha: Number(nz(r.shaDifficultyAvg)),
      scrypt: Number(nz(r.scryptDifficultyAvg)),
    }));
  }, [data]);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <CardTitle>Per-algorithm difficulty</CardTitle>
        <SamplingFootnote kind="averaged" />
      </div>
      <p className="mt-1 text-xs text-slate-900/55 dark:text-white/55">
        Daily averages of the per-algorithm difficulty target.
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
                tickFormatter={(v) => formatDifficulty(BigInt(Math.floor(Number(v))))}
                width={80}
                scale="log"
                domain={["auto", "auto"]}
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
                formatter={(v, name) => [
                  formatDifficulty(BigInt(Math.floor(Number(v)))),
                  String(name),
                ]}
              />
              <ProtocolEventLines visibleFrom={from} visibleTo={to} />
              <Line type="monotone" dataKey="kawpow" name="KawPoW" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="sha" name="SHA" stroke="#f97316" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="scrypt" name="Scrypt" stroke="#10b981" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-2 text-xs text-slate-900/40 dark:text-white/40">
        Log scale.
      </div>
    </Card>
  );
}
