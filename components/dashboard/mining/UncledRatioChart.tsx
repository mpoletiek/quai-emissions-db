"use client";
import { useMemo } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { useRollups } from "@/lib/hooks";
import { formatPeriodDate } from "@/lib/format";
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
import { InfoPopover } from "@/components/ui/InfoPopover";
import { ProtocolEventLines } from "@/components/dashboard/history/ProtocolEventLines";

// UncledRatioChart — Σ(uncled_ema) / Σ(count_ema) per period, for SHA and
// Scrypt. Uncled ≠ stale; in go-quai it means "the workshare's coinbase
// can't be resolved as a zone-internal address," which only happens for
// merge-mined SHA/Scrypt where coinbases are foreign-chain (BTC/BCH/DOGE).
// Higher uncled ratio → more cross-chain miner drift.

export function UncledRatioChart({ from, to }: { from: string; to: string }) {
  const { data, isLoading, error } = useRollups({ period: "day", from, to });

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((r) => {
      const shaCount = nz(r.shaCountEmaSum);
      const shaUncled = nz(r.shaUncledEmaSum);
      const scrCount = nz(r.scryptCountEmaSum);
      const scrUncled = nz(r.scryptUncledEmaSum);
      return {
        date: r.periodStart,
        sha: shaCount > 0n ? Number((shaUncled * 10000n) / shaCount) / 100 : null,
        scrypt:
          scrCount > 0n ? Number((scrUncled * 10000n) / scrCount) / 100 : null,
      };
    });
  }, [data]);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <CardTitle>Uncled ratio</CardTitle>
        <InfoPopover label="About uncled workshares">
          <p>
            Uncled rate = Σ(<code>uncled_ema</code>) / Σ(<code>count_ema</code>),
            both EMA values from the woHeader.
          </p>
          <p className="mt-2">
            "Uncled" in go-quai means the workshare's coinbase didn't resolve
            to a zone-internal address. This applies to SHA and Scrypt because
            those algorithms aux-PoW from BTC/BCH/DOGE chains where coinbases
            are foreign. Higher uncled = more cross-chain miner drift, with
            rewards redistributed to internal-coinbase shares.
          </p>
          <p className="mt-2 text-slate-900/55 dark:text-white/55">
            Not the same as "stale." KawPoW workshares cannot be uncled and
            aren't shown here.
          </p>
        </InfoPopover>
      </div>
      <p className="mt-1 text-xs text-slate-900/55 dark:text-white/55">
        Share of merge-mined workshares with foreign coinbases.
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
                tickFormatter={(v) => `${v}%`}
                width={48}
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
                formatter={(v, name) =>
                  v == null ? ["—", String(name)] : [`${Number(v).toFixed(2)}%`, String(name)]
                }
              />
              <ProtocolEventLines visibleFrom={from} visibleTo={to} />
              <Line type="monotone" dataKey="sha" name="SHA" stroke="#f97316" strokeWidth={1.5} dot={false} connectNulls />
              <Line type="monotone" dataKey="scrypt" name="Scrypt" stroke="#10b981" strokeWidth={1.5} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
