"use client";
import { Card, CardTitle } from "@/components/ui/Card";
import { useEmissions } from "@/lib/hooks";
import { qitsToFloat, weiToFloat } from "@/lib/format";
import { bucketLast } from "@/lib/bucket";
import {
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function CumulativeEmissionsChart({ limit = 500 }: { limit?: number }) {
  const { data, isLoading } = useEmissions(limit);

  if (isLoading || !data) {
    return (
      <Card>
        <CardTitle>Authoritative Supply Totals</CardTitle>
        <div className="mt-4 h-64 animate-pulse rounded bg-slate-900/5 dark:bg-white/5" />
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
      <div
        className="mt-3 h-64"
        role="img"
        aria-label="Per-block QUAI and QI supply totals over the live window"
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="block"
              tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
              tickFormatter={(v) => "#" + String(v).slice(-4)}
              minTickGap={40}
            />
            <YAxis
              yAxisId="quai"
              tick={{ fill: "rgba(59,130,246,0.8)", fontSize: 11 }}
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
              width={68}
              tickFormatter={(v) => {
                const n = Number(v);
                if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
                if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
                return n.toLocaleString();
              }}
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
              formatter={(v, name) => [Number(v).toLocaleString(), String(name)]}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "var(--chart-axis)" }} />
            <Line
              yAxisId="quai"
              type="monotone"
              dataKey="quai"
              name="QUAI supply"
              stroke="#3b82f6"
              dot={false}
              strokeWidth={1.5}
            />
            <Line
              yAxisId="qi"
              type="monotone"
              dataKey="qi"
              name="QI supply"
              stroke="#10b981"
              dot={false}
              strokeWidth={1.5}
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
