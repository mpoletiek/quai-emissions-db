"use client";
import { Card, CardTitle } from "@/components/ui/Card";
import { useEmissions } from "@/lib/hooks";
import { qitsToFloat, weiToFloat } from "@/lib/format";
import { bucketLast } from "@/lib/bucket";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { ChartLegend, type ChartLegendItem } from "@/components/ui/ChartLegend";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";

const CUMULATIVE_EMISSIONS_LEGEND: ChartLegendItem[] = [
  { label: "QUAI supply", color: "#3b82f6" },
  { label: "QI supply", color: "#10b981" },
];

export function CumulativeEmissionsChart({ limit = 500 }: { limit?: number }) {
  const { data, isLoading } = useEmissions(limit);

  if (isLoading || !data) {
    return (
      <Card>
        <CardTitle>Authoritative Supply Totals</CardTitle>
        <ChartSkeleton height="h-64" className="mt-4" />
      </Card>
    );
  }

  const raw = data.emissions.map((e) => ({
    block: e.blockNumber,
    quai: weiToFloat(e.analytics.quaiSupplyTotal, 0),
    qi: qitsToFloat(e.analytics.qiSupplyTotal, 3),
  }));
  const TARGET = 400;
  const qSeries = bucketLast(raw, TARGET, (r) => ({ x: r.block, y: r.quai }));
  const qiSeries = bucketLast(raw, TARGET, (r) => ({ x: r.block, y: r.qi }));
  const rows = qSeries.map((p, i) => ({ block: p.x, quai: p.y, qi: qiSeries[i].y }));

  return (
    <Card>
      <CardTitle>Authoritative Supply Totals (per block)</CardTitle>
      <ChartLegend items={CUMULATIVE_EMISSIONS_LEGEND} className="mt-2" />
      <div
        className="mt-3 h-64"
        role="img"
        aria-label="Per-block QUAI and QI supply totals over the live window"
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid
              stroke="var(--chart-grid-soft)"
              strokeDasharray="2 4"
              vertical={false}
            />
            <XAxis
              dataKey="block"
              tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
              tickFormatter={(v) => "#" + String(v).slice(-4)}
              tickLine={false}
              axisLine={false}
              minTickGap={40}
            />
            <YAxis
              yAxisId="quai"
              tick={{ fill: "rgba(59,130,246,0.8)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={68}
              tickFormatter={(v) => {
                const n = Number(v);
                if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
                if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
                return n.toFixed(0);
              }}
            />
            <YAxis
              yAxisId="qi"
              orientation="right"
              tick={{ fill: "rgba(16,185,129,0.9)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={68}
              tickFormatter={(v) => {
                const n = Number(v);
                if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
                if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
                return n.toLocaleString();
              }}
            />
            <Tooltip
              content={
                <ChartTooltip
                  labelFormatter={(v) => `Block #${Number(v).toLocaleString()}`}
                  formatter={(v, name) => [Number(v).toLocaleString(), String(name)]}
                />
              }
            />
            <Line
              yAxisId="quai"
              type="monotone"
              dataKey="quai"
              name="QUAI supply"
              stroke="#3b82f6"
              dot={false}
              strokeWidth={1.5}
              isAnimationActive
              animationDuration={500}
              animationEasing="ease-out"
            />
            <Line
              yAxisId="qi"
              type="monotone"
              dataKey="qi"
              name="QI supply"
              stroke="#10b981"
              dot={false}
              strokeWidth={1.5}
              isAnimationActive
              animationDuration={500}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-xs text-slate-900/40 dark:text-white/40">
        From <code className="text-slate-900/60 dark:text-white/60">quai_getSupplyAnalyticsForBlock</code> — authoritative
        on-chain totals. Left axis: QUAI. Right axis: QI. Both in whole tokens.
      </div>
    </Card>
  );
}
