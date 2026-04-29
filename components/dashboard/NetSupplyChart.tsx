"use client";
import { Card, CardTitle } from "@/components/ui/Card";
import { useEmissions } from "@/lib/hooks";
import { qitsToFloat, weiToFloat } from "@/lib/format";
import { bucketSum } from "@/lib/bucket";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { ChartLegend, type ChartLegendItem } from "@/components/ui/ChartLegend";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";

const NET_SUPPLY_LEGEND: ChartLegendItem[] = [
  { label: "QUAI mint", color: "#3b82f6" },
  { label: "QUAI burn", color: "#ef4444" },
  { label: "QI mint", color: "#10b981" },
  { label: "QI burn", color: "#f97316" },
];

/**
 * Shows per-block net mint (added - removed) for both tokens.
 * Most blocks are 0; settlement/burn blocks spike.
 */
export function NetSupplyChart({ limit = 500 }: { limit?: number }) {
  const { data, isLoading } = useEmissions(limit);

  if (isLoading || !data) {
    return (
      <Card>
        <CardTitle>Per-Block Net Mint / Burn</CardTitle>
        <ChartSkeleton height="h-64" className="mt-4" />
      </Card>
    );
  }

  const raw = data.emissions.map((e) => {
    const a = e.analytics;
    return {
      block: e.blockNumber,
      quaiMint: weiToFloat(a.quaiSupplyAdded, 4),
      quaiBurn: -weiToFloat(a.quaiSupplyRemoved, 4),
      qiMint: qitsToFloat(a.qiSupplyAdded, 3),
      qiBurn: -qitsToFloat(a.qiSupplyRemoved, 3),
    };
  });
  const TARGET = 300;
  const rows = bucketSum(
    raw,
    TARGET,
    (r) => ({ x: r.block, quaiMint: r.quaiMint, quaiBurn: r.quaiBurn, qiMint: r.qiMint, qiBurn: r.qiBurn }),
    ["quaiMint", "quaiBurn", "qiMint", "qiBurn"] as const,
  ).map((r) => ({ block: r.x, ...r }));

  const totals = raw.reduce(
    (acc, r) => {
      acc.qMint += r.quaiMint;
      acc.qBurn += r.quaiBurn;
      acc.qiMint += r.qiMint;
      acc.qiBurn += r.qiBurn;
      return acc;
    },
    { qMint: 0, qBurn: 0, qiMint: 0, qiBurn: 0 },
  );

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>Per-Block Mint / Burn (both tokens)</CardTitle>
        <div className="text-xs text-slate-900/50 dark:text-white/50">
          Σ QUAI +{totals.qMint.toFixed(2)} / {totals.qBurn.toFixed(2)} ·
          Σ QI +{totals.qiMint.toFixed(3)} / {totals.qiBurn.toFixed(3)}
        </div>
      </div>
      <ChartLegend items={NET_SUPPLY_LEGEND} className="mt-2" />
      <div
        className="mt-3 h-64"
        role="img"
        aria-label="Per-block mint and burn deltas for QUAI and QI"
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
              yAxisId="q"
              tick={{ fill: "rgba(59,130,246,0.8)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={60}
            />
            <YAxis
              yAxisId="qi"
              orientation="right"
              tick={{ fill: "rgba(16,185,129,0.9)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={60}
            />
            <Tooltip
              content={
                <ChartTooltip
                  labelFormatter={(v) => `Block #${Number(v).toLocaleString()}`}
                />
              }
            />
            <Bar yAxisId="q" dataKey="quaiMint" stackId="q" fill="#3b82f6" name="QUAI mint" isAnimationActive animationDuration={500} animationEasing="ease-out" />
            <Bar yAxisId="q" dataKey="quaiBurn" stackId="q" fill="#ef4444" name="QUAI burn" isAnimationActive animationDuration={500} animationEasing="ease-out" />
            <Bar yAxisId="qi" dataKey="qiMint" stackId="qi" fill="#10b981" name="QI mint" isAnimationActive animationDuration={500} animationEasing="ease-out" />
            <Bar yAxisId="qi" dataKey="qiBurn" stackId="qi" fill="#f97316" name="QI burn" isAnimationActive animationDuration={500} animationEasing="ease-out" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-xs text-slate-900/40 dark:text-white/40">
        Deltas are sparse — settlement/conversion/burn events show as spikes.
        Mint values positive; burn values plotted negative for visual clarity.
      </div>
    </Card>
  );
}
