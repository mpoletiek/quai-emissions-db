"use client";
import { Card, CardTitle } from "@/components/ui/Card";
import { useEmissions } from "@/lib/hooks";
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
 * Replaces the "miner election via coinbase" concept — which was broken because
 * recent mainnet shows 100% Quai-ledger coinbases yet Qi still mints regularly.
 *
 * Instead: bucket blocks by their authoritative supply-delta activity.
 *   - QUAI-only: quaiSupplyAdded > 0, qiSupplyAdded == 0
 *   - QI-only:   qiSupplyAdded   > 0, quaiSupplyAdded == 0
 *   - Both:      both > 0
 *   - Burn:      any SupplyRemoved > 0 (overlays on top)
 *   - Inactive:  all deltas == 0 (most blocks)
 */
export function MintActivityChart({ limit = 500 }: { limit?: number }) {
  const { data, isLoading } = useEmissions(limit);

  if (isLoading || !data) {
    return (
      <Card>
        <CardTitle>Per-Block Mint Activity</CardTitle>
        <div className="mt-4 h-64 animate-pulse rounded bg-slate-900/5 dark:bg-white/5" />
      </Card>
    );
  }

  const span = data.emissions.length;
  const bucketSize = Math.max(50, Math.ceil(span / 100));
  const buckets = new Map<
    number,
    { start: number; quaiOnly: number; qiOnly: number; both: number; burn: number; inactive: number }
  >();
  let totals = { quaiOnly: 0, qiOnly: 0, both: 0, burn: 0, inactive: 0 };
  for (const e of data.emissions) {
    const a = e.analytics;
    const qMint = a.quaiSupplyAdded > 0n;
    const qiMint = a.qiSupplyAdded > 0n;
    const anyBurn = a.quaiSupplyRemoved > 0n || a.qiSupplyRemoved > 0n;

    const key = Math.floor(e.blockNumber / bucketSize) * bucketSize;
    const b =
      buckets.get(key) ??
      { start: key, quaiOnly: 0, qiOnly: 0, both: 0, burn: 0, inactive: 0 };

    if (qMint && qiMint) {
      b.both += 1;
      totals.both += 1;
    } else if (qMint) {
      b.quaiOnly += 1;
      totals.quaiOnly += 1;
    } else if (qiMint) {
      b.qiOnly += 1;
      totals.qiOnly += 1;
    } else {
      b.inactive += 1;
      totals.inactive += 1;
    }
    if (anyBurn) {
      b.burn += 1;
      totals.burn += 1;
    }
    buckets.set(key, b);
  }
  const rows = Array.from(buckets.values()).sort((a, b) => a.start - b.start);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>Per-Block Mint Activity</CardTitle>
        <div className="text-xs text-slate-900/50 dark:text-white/50">{bucketSize}-block buckets</div>
      </div>
      <div
        className="mt-3 h-64"
        role="img"
        aria-label="Per-block mint activity bucketed by token (QUAI-only, QI-only, both, inactive, burn)"
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="start"
              tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
              tickFormatter={(v) => "#" + String(v).slice(-5)}
              minTickGap={30}
            />
            <YAxis tick={{ fill: "var(--chart-axis)", fontSize: 11 }} width={32} />
            <Tooltip
              contentStyle={{
                background: "var(--chart-tooltip-bg)",
                color: "var(--chart-tooltip-text)",
                border: "1px solid var(--chart-tooltip-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "var(--chart-axis)" }} />
            <Bar dataKey="quaiOnly" stackId="m" fill="#3b82f6" name="QUAI mint" />
            <Bar dataKey="qiOnly" stackId="m" fill="#10b981" name="QI mint" />
            <Bar dataKey="both" stackId="m" fill="#a855f7" name="both mint" />
            <Bar dataKey="inactive" stackId="m" fill="#27272a" name="no delta" />
            <Bar dataKey="burn" stackId="b" fill="#ef4444" name="burn event" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-900/50 dark:text-white/50">
        <span>Σ QUAI-only blocks: <span className="text-slate-900/80 dark:text-white/80">{totals.quaiOnly}</span></span>
        <span>Σ QI-only: <span className="text-slate-900/80 dark:text-white/80">{totals.qiOnly}</span></span>
        <span>Σ both: <span className="text-slate-900/80 dark:text-white/80">{totals.both}</span></span>
        <span>Σ with burn: <span className="text-slate-900/80 dark:text-white/80">{totals.burn}</span></span>
        <span>Σ inactive: <span className="text-slate-900/80 dark:text-white/80">{totals.inactive}</span></span>
      </div>
      <div className="mt-1 text-xs text-slate-900/40 dark:text-white/40">
        Source: <code className="text-slate-900/60 dark:text-white/60">quai_getSupplyAnalyticsForBlock</code> per-block deltas.
        Most blocks have zero supply delta (rewards vest before landing in supply).
      </div>
    </Card>
  );
}
