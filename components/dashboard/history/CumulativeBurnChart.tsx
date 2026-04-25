"use client";
import { Card, CardTitle } from "@/components/ui/Card";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { useRollups } from "@/lib/hooks";
import { useHistoryParams } from "@/lib/useHistoryParams";
import {
  formatCompact,
  formatPeriodDate,
  weiToFloat,
} from "@/lib/format";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ProtocolEventLines } from "./ProtocolEventLines";

export function CumulativeBurnChart() {
  const { params } = useHistoryParams();
  const { data: rows, isLoading, error } = useRollups({
    period: params.period,
    from: params.from,
    to: params.to,
  });
  const rebased = params.rebaseAt !== null;
  const titleBase = rebased
    ? `SOAP burn · since ${params.rebaseLabel}`
    : "SOAP Burn";

  if (isLoading || !rows) {
    return (
      <Card>
        <CardTitle>{titleBase}</CardTitle>
        <div className="mt-4 h-64 animate-pulse rounded bg-slate-900/5 dark:bg-white/5" />
      </Card>
    );
  }
  if (error) {
    return (
      <Card>
        <CardTitle>{titleBase}</CardTitle>
        <div className="mt-4 text-sm text-red-600 dark:text-red-300">{String(error)}</div>
      </Card>
    );
  }
  if (rows.length === 0) {
    return (
      <Card>
        <CardTitle>{titleBase}</CardTitle>
        <div className="mt-4 text-sm text-slate-900/50 dark:text-white/50">
          No rollup data in this range.
        </div>
      </Card>
    );
  }

  const rawData = rows.map((r) => ({
    date: r.periodStart,
    close: weiToFloat(r.burnClose, 0),
    delta: weiToFloat(r.burnDelta, 0),
  }));
  const baseClose = rebased ? rawData[0].close - rawData[0].delta : 0;
  const data = rebased
    ? rawData.map((d) => ({
        date: d.date,
        close: d.close - baseClose,
        delta: d.delta,
      }))
    : rawData;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>
          {rebased
            ? `SOAP burn since ${params.rebaseLabel} — cumulative & per ${params.period}`
            : `SOAP burn — cumulative & per ${params.period}`}
        </CardTitle>
        <InfoPopover label="About SOAP burn">
          <p className="mb-2">
            Cumulative area ={" "}
            <code className="text-slate-900/60 dark:text-white/60">balanceOf(0x0050AF…)</code>{" "}
            snapshot at period end. Bars ={" "}
            <code className="text-slate-900/60 dark:text-white/60">burn_delta</code> for the period.
          </p>
          <p className="mb-2">
            This is the <strong className="text-slate-900/90 dark:text-white/90">only</strong>{" "}
            authoritative burn signal on Quai.
          </p>
          <p>
            <strong className="text-slate-900/90 dark:text-white/90">Not</strong>{" "}
            <code className="text-slate-900/60 dark:text-white/60">quai_removed_sum</code> — that&apos;s
            a gross debit counter including sender sides of ordinary transfers,
            which massively overstates destruction.
          </p>
        </InfoPopover>
      </div>
      <div
        className="mt-3 h-64"
        role="img"
        aria-label={`Area chart of cumulative SOAP burn with per-${params.period} delta bars, from ${params.from} to ${params.to}`}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="burnFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
              tickFormatter={formatPeriodDate}
              minTickGap={40}
            />
            <YAxis
              yAxisId="close"
              tick={{ fill: "rgba(239,68,68,0.9)", fontSize: 11 }}
              width={64}
              tickFormatter={formatCompact}
            />
            <YAxis
              yAxisId="delta"
              orientation="right"
              tick={{ fill: "rgba(249,115,22,0.9)", fontSize: 11 }}
              width={60}
              tickFormatter={formatCompact}
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
              formatter={(v, name) => [Number(v).toLocaleString(), String(name)]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "var(--chart-axis)" }}
            />
            <ProtocolEventLines
              visibleFrom={params.from}
              visibleTo={params.to}
              yAxisId="close"
            />
            <Area
              yAxisId="close"
              type="monotone"
              dataKey="close"
              name={rebased ? `Cumulative burn since ${params.rebaseLabel} (QUAI)` : "Cumulative burn (QUAI)"}
              stroke="#ef4444"
              strokeWidth={1.5}
              fill="url(#burnFill)"
            />
            <Bar
              yAxisId="delta"
              dataKey="delta"
              name={`Burn per ${params.period}`}
              fill="#f97316"
              fillOpacity={0.7}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-xs text-slate-900/40 dark:text-white/40">
        <strong className="text-slate-900/70 dark:text-white/70">Why not quai_removed_sum?</strong>{" "}
        <code className="text-slate-900/60 dark:text-white/60">quai_removed_sum</code> is a gross debit
        counter — includes every{" "}
        <code className="text-slate-900/60 dark:text-white/60">SubBalance</code> call including the
        sender side of ordinary transfers. Using it as &quot;burn&quot; massively
        overstates destruction. The only on-chain burn sink on Quai is{" "}
        <code className="text-slate-900/60 dark:text-white/60">0x0050AF…</code>, so its balance delta
        is what we chart here.
      </div>
    </Card>
  );
}
