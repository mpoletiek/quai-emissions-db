"use client";
import { useState } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { useRollups } from "@/lib/hooks";
import { useHistoryParams } from "@/lib/useHistoryParams";
import {
  formatCompact,
  formatPeriodDate,
  qitsToFloat,
  weiToFloat,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ProtocolEventLines } from "./ProtocolEventLines";

export function SupplyTotalsChart() {
  const { params } = useHistoryParams();
  const [logScale, setLogScale] = useState(false);
  const { data: rows, isLoading, error } = useRollups({
    period: params.period,
    from: params.from,
    to: params.to,
  });

  if (isLoading || !rows) {
    return (
      <Card>
        <CardTitle>Supply Totals</CardTitle>
        <div className="mt-4 h-64 animate-pulse rounded bg-slate-900/5 dark:bg-white/5" />
      </Card>
    );
  }
  if (error) {
    return (
      <Card>
        <CardTitle>Supply Totals</CardTitle>
        <div className="mt-4 text-sm text-red-600 dark:text-red-300">{String(error)}</div>
      </Card>
    );
  }
  if (rows.length === 0) {
    return (
      <Card>
        <CardTitle>Supply Totals</CardTitle>
        <div className="mt-4 text-sm text-slate-900/50 dark:text-white/50">
          No rollup data in this range.
        </div>
      </Card>
    );
  }

  const rawData = rows.map((r) => ({
    date: r.periodStart,
    quai: weiToFloat(r.quaiTotalEnd, 0),
    qi: qitsToFloat(r.qiTotalEnd, 0),
  }));
  const rebased = params.rebaseAt !== null;
  const baseQuai = rebased ? rawData[0].quai : 0;
  const baseQi = rebased ? rawData[0].qi : 0;
  const data = rebased
    ? rawData.map((d) => ({
        date: d.date,
        quai: d.quai - baseQuai,
        qi: d.qi - baseQi,
      }))
    : rawData;

  const last = rows[rows.length - 1];
  const ariaLabel = rebased
    ? `Line chart of QUAI and QI supply change since ${params.rebaseLabel} on ${params.rebaseAt}, through ${params.to}.`
    : `Line chart of QUAI and QI supply totals from ${params.from} to ${params.to}. Final QUAI supply ${formatCompact(weiToFloat(last.quaiTotalEnd, 0))}, QI ${formatCompact(qitsToFloat(last.qiTotalEnd, 0))}.`;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>
          {rebased
            ? `Supply change since ${params.rebaseLabel} (end of ${params.period})`
            : `Supply Totals (end of ${params.period})`}
        </CardTitle>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLogScale((s) => !s)}
            aria-pressed={logScale}
            className={cn(
              "rounded border px-2 py-0.5 text-xs transition",
              logScale
                ? "border-slate-900/30 dark:border-white/30 bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white"
                : "border-slate-900/10 dark:border-white/10 text-slate-900/60 dark:text-white/60 hover:text-slate-900/90 dark:text-white/90",
            )}
          >
            {logScale ? "log" : "linear"}
          </button>
          <InfoPopover label="About supply totals">
            <p className="mb-2">
              End-of-{params.period} snapshots of{" "}
              <code className="text-slate-900/60 dark:text-white/60">quai_total</code> and{" "}
              <code className="text-slate-900/60 dark:text-white/60">qi_total</code> from{" "}
              <code className="text-slate-900/60 dark:text-white/60">supply_analytics</code>.
            </p>
            <p>
              Already net of SOAP burn — the go-quai node subtracts{" "}
              <code className="text-slate-900/60 dark:text-white/60">balanceOf(0x0050AF…)</code> from{" "}
              <code className="text-slate-900/60 dark:text-white/60">quaiSupplyTotal</code>{" "}
              server-side. No client-side subtraction needed.
            </p>
          </InfoPopover>
        </div>
      </div>
      <div
        className="mt-3 h-64"
        role="img"
        aria-label={ariaLabel}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
              tickFormatter={formatPeriodDate}
              minTickGap={40}
            />
            <YAxis
              yAxisId="quai"
              scale={logScale ? "log" : "auto"}
              domain={logScale ? ["auto", "auto"] : undefined}
              tick={{ fill: "rgba(59,130,246,0.8)", fontSize: 11 }}
              width={64}
              tickFormatter={formatCompact}
              allowDataOverflow={logScale}
            />
            <YAxis
              yAxisId="qi"
              orientation="right"
              scale={logScale ? "log" : "auto"}
              domain={logScale ? ["auto", "auto"] : undefined}
              tick={{ fill: "rgba(16,185,129,0.9)", fontSize: 11 }}
              width={64}
              tickFormatter={formatCompact}
              allowDataOverflow={logScale}
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
              yAxisId="quai"
            />
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
        {rebased
          ? `Rebased to 0 at ${params.rebaseLabel} (${params.rebaseAt}). Lines show net change in circulating QUAI and QI since that date. Left axis QUAI, right axis QI. UTC.`
          : `End-of-${params.period} supply snapshot. Left axis QUAI, right axis QI. UTC.`}
      </div>
    </Card>
  );
}
