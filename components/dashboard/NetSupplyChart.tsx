"use client";
import { Card, CardTitle } from "@/components/ui/Card";
import { useEmissions } from "@/lib/hooks";
import { qitsToFloat, weiToFloat } from "@/lib/format";
import { bucketSum } from "@/lib/bucket";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
        <div className="mt-4 h-64 animate-pulse rounded bg-slate-900/5 dark:bg-white/5" />
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
      <div
        className="mt-3 h-64"
        role="img"
        aria-label="Per-block mint and burn deltas for QUAI and QI"
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="block"
              tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
              tickFormatter={(v) => "#" + String(v).slice(-4)}
              minTickGap={40}
            />
            <YAxis
              yAxisId="q"
              tick={{ fill: "rgba(59,130,246,0.8)", fontSize: 11 }}
              width={60}
            />
            <YAxis
              yAxisId="qi"
              orientation="right"
              tick={{ fill: "rgba(16,185,129,0.9)", fontSize: 11 }}
              width={60}
            />
            <Tooltip
              contentStyle={{
                background: "var(--chart-tooltip-bg)",
                color: "var(--chart-tooltip-text)",
                border: "1px solid var(--chart-tooltip-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(v) => `Block #${Number(v).toLocaleString()}`}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "var(--chart-axis)" }} />
            <Bar yAxisId="q" dataKey="quaiMint" stackId="q" fill="#3b82f6" name="QUAI mint" />
            <Bar yAxisId="q" dataKey="quaiBurn" stackId="q" fill="#ef4444" name="QUAI burn" />
            <Bar yAxisId="qi" dataKey="qiMint" stackId="qi" fill="#10b981" name="QI mint" />
            <Bar yAxisId="qi" dataKey="qiBurn" stackId="qi" fill="#f97316" name="QI burn" />
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
