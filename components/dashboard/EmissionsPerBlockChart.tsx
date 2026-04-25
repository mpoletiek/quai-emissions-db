"use client";
import { Card, CardTitle } from "@/components/ui/Card";
import { useEmissions } from "@/lib/hooks";
import { weiToFloat } from "@/lib/format";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

export function EmissionsPerBlockChart({ limit = 500 }: { limit?: number }) {
  const { data, isLoading, error } = useEmissions(limit);

  if (isLoading || !data) {
    return (
      <Card className="col-span-2">
        <CardTitle>Estimated Miner Reward per Block</CardTitle>
        <div className="mt-4 h-64 animate-pulse rounded bg-slate-900/5 dark:bg-white/5" />
      </Card>
    );
  }
  if (error) {
    return (
      <Card className="col-span-2">
        <CardTitle>Estimated Miner Reward per Block</CardTitle>
        <div className="mt-4 text-sm text-red-600 dark:text-red-300">{String(error)}</div>
      </Card>
    );
  }

  const detailed = data.emissions.filter((e) => e.hasBlockDetail);
  const raw = detailed.map((e) => ({
    block: e.blockNumber,
    blockReward: weiToFloat(e.blockRewardWei, 6),
    workshareReward: weiToFloat(e.workshareRewardWei, 6),
  }));
  const TARGET = 300;
  const bucket = Math.max(1, Math.ceil(raw.length / TARGET));
  const rows: typeof raw = [];
  for (let i = 0; i < raw.length; i += bucket) {
    const slice = raw.slice(i, i + bucket);
    const mid = slice[Math.floor(slice.length / 2)].block;
    const br = slice.reduce((s, r) => s + r.blockReward, 0) / slice.length;
    const wr = slice.reduce((s, r) => s + r.workshareReward, 0) / slice.length;
    rows.push({ block: mid, blockReward: br, workshareReward: wr });
  }

  return (
    <Card className="col-span-2">
      <div className="flex items-center justify-between">
        <CardTitle>Estimated Miner Reward per Block (QUAI)</CardTitle>
        <div className="text-xs text-slate-900/50 dark:text-white/50">
          detail window {detailed.length.toLocaleString()} blocks · head #{data.latest.toLocaleString()}
        </div>
      </div>
      <div
        className="mt-3 h-72"
        role="img"
        aria-label="Estimated per-block miner reward (block reward plus workshare reward) in QUAI"
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
              tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
              width={52}
            />
            <Tooltip
              contentStyle={{
                background: "var(--chart-tooltip-bg)",
                color: "var(--chart-tooltip-text)",
                border: "1px solid var(--chart-tooltip-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v, name) => [Number(v).toFixed(4), String(name)]}
              labelFormatter={(v) => `Block #${Number(v).toLocaleString()}`}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "var(--chart-axis)" }} />
            <Bar dataKey="blockReward" stackId="a" fill="#3b82f6" name="Block reward" />
            <Bar dataKey="workshareReward" stackId="a" fill="#10b981" name="Workshare reward" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-xs text-slate-900/40 dark:text-white/40">
        Theoretical reward a miner earns for sealing each block, from{" "}
        <code className="text-slate-900/60 dark:text-white/60">/mininginfo.estimatedBlockReward</code> plus{" "}
        <code className="text-slate-900/60 dark:text-white/60">workshareReward × block.workshares.length</code>.
        This is the earned-but-not-yet-settled amount — actual supply changes appear in the mint/burn chart.
      </div>
    </Card>
  );
}
