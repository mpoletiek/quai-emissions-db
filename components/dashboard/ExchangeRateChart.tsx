"use client";
import { Card, CardTitle } from "@/components/ui/Card";
import { useEmissions } from "@/lib/hooks";
import { weiToFloat } from "@/lib/format";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function ExchangeRateChart({ limit = 500 }: { limit?: number }) {
  const { data, isLoading } = useEmissions(limit);

  if (isLoading || !data) {
    return (
      <Card>
        <CardTitle>Exchange Rate</CardTitle>
        <div className="mt-4 h-56 animate-pulse rounded bg-slate-900/5 dark:bg-white/5" />
      </Card>
    );
  }

  const raw = data.emissions
    .filter((e) => e.hasBlockDetail)
    .map((e) => ({
      block: e.blockNumber,
      rate: weiToFloat(e.exchangeRate, 6),
    }));
  const TARGET = 400;
  const bucket = Math.max(1, Math.ceil(raw.length / TARGET));
  const rows: typeof raw = [];
  for (let i = 0; i < raw.length; i += bucket) {
    const slice = raw.slice(i, i + bucket);
    const mid = slice[Math.floor(slice.length / 2)].block;
    const avg = slice.reduce((s, r) => s + r.rate, 0) / slice.length;
    rows.push({ block: mid, rate: avg });
  }

  return (
    <Card>
      <CardTitle>Quai ↔ Qi Exchange Rate (per block)</CardTitle>
      <div
        className="mt-3 h-56"
        role="img"
        aria-label="Per-block raw exchange rate line over the live window"
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
              tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
              width={64}
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
              labelFormatter={(v) => `Block #${Number(v).toLocaleString()}`}
            />
            <Line
              type="monotone"
              dataKey="rate"
              stroke="#a855f7"
              dot={false}
              strokeWidth={1.5}
              name="exchangeRate"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-xs text-slate-900/40 dark:text-white/40">
        Raw <code className="text-slate-900/60 dark:text-white/60">header.exchangeRate</code> ÷ 10¹⁸. Directional signal
        for kQuai rebalancing and conversion pricing — exact semantic (Qi/Quai vs Quai/Qi) not yet
        verified against a clean conversion event.
      </div>
    </Card>
  );
}
