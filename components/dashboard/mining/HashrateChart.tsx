"use client";
import { useMemo } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { useRollups } from "@/lib/hooks";
import { formatHashrate, formatPeriodDate } from "@/lib/format";
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
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { ChartLegend } from "@/components/ui/ChartLegend";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";

const HASHRATE_LEGEND = [
  { label: "KawPoW", color: "#3b82f6" },
  { label: "SHA", color: "#f97316" },
  { label: "Scrypt", color: "#10b981" },
];

// HashrateChart — three lines, one per SOAP algorithm. Sourced from the
// rollup `*_hashrate_avg` columns, which are themselves period-averages of
// the trailing-15-minute hashrates reported by quai_getMiningInfo.

export function HashrateChart({ from, to }: { from: string; to: string }) {
  const { data, isLoading, error } = useRollups({ period: "day", from, to });

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((r) => ({
      date: r.periodStart,
      kawpow: r.kawpowHashrateAvg == null ? null : Number(r.kawpowHashrateAvg),
      sha: r.shaHashrateAvg == null ? null : Number(r.shaHashrateAvg),
      scrypt: r.scryptHashrateAvg == null ? null : Number(r.scryptHashrateAvg),
    }));
  }, [data]);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <CardTitle>Per-algorithm hashrate</CardTitle>
        <SamplingFootnote kind="averaged" />
      </div>
      <p className="mt-1 text-xs text-slate-900/80 dark:text-white/80">
        Daily averages of the 15-minute trailing hashrate per algorithm.
      </p>

      <ChartLegend items={HASHRATE_LEGEND} className="mt-2" />

      <div className="mt-3 h-56">
        {isLoading || !data ? (
          <ChartSkeleton />
        ) : error ? (
          <div className="text-sm text-red-600 dark:text-red-300">{String(error)}</div>
        ) : data.length === 0 ? (
          <div className="text-sm text-slate-900/50 dark:text-white/50">
            No rollup data.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid
                stroke="var(--chart-grid-soft)"
                strokeDasharray="2 4"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                tickFormatter={formatPeriodDate}
                tickLine={false}
                axisLine={false}
                minTickGap={32}
              />
              <YAxis
                tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                tickFormatter={(v) => formatHashrate(BigInt(Math.floor(Number(v))))}
                tickLine={false}
                axisLine={false}
                width={80}
                scale="log"
                domain={["auto", "auto"]}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    labelFormatter={(v) => formatPeriodDate(String(v))}
                    formatter={(v, name) =>
                      v == null
                        ? ["—", name]
                        : [formatHashrate(BigInt(Math.floor(Number(v)))), name]
                    }
                  />
                }
              />
              <ProtocolEventLines visibleFrom={from} visibleTo={to} />
              <Line type="monotone" dataKey="kawpow" name="KawPoW" stroke="#3b82f6" strokeWidth={1.5} dot={false} isAnimationActive animationDuration={500} animationEasing="ease-out" />
              <Line type="monotone" dataKey="sha" name="SHA" stroke="#f97316" strokeWidth={1.5} dot={false} isAnimationActive animationDuration={500} animationEasing="ease-out" />
              <Line type="monotone" dataKey="scrypt" name="Scrypt" stroke="#10b981" strokeWidth={1.5} dot={false} isAnimationActive animationDuration={500} animationEasing="ease-out" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-2 text-xs text-slate-900/40 dark:text-white/40">
        Log scale; algorithms differ by orders of magnitude.
      </div>
    </Card>
  );
}
