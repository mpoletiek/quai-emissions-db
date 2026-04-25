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
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ProtocolEventLines } from "./ProtocolEventLines";

export function EmissionVsBurnChart() {
  const { params } = useHistoryParams();
  const { data: rows, isLoading, error } = useRollups({
    period: params.period,
    from: params.from,
    to: params.to,
  });

  if (isLoading || !rows) {
    return (
      <Card>
        <CardTitle>QUAI issued vs SOAP burn per {params.period}</CardTitle>
        <div className="mt-4 h-64 animate-pulse rounded bg-slate-900/5 dark:bg-white/5" />
      </Card>
    );
  }
  if (error) {
    return (
      <Card>
        <CardTitle>QUAI issued vs SOAP burn per {params.period}</CardTitle>
        <div className="mt-4 text-sm text-red-600 dark:text-red-300">{String(error)}</div>
      </Card>
    );
  }
  if (rows.length === 0) {
    return (
      <Card>
        <CardTitle>QUAI issued vs SOAP burn per {params.period}</CardTitle>
        <div className="mt-4 text-sm text-slate-900/50 dark:text-white/50">
          No rollup data in this range.
        </div>
      </Card>
    );
  }

  // Emission = gross QUAI credit flow (≈ block-reward issuance + conversion
  // credits). Burn = per-period Δ of balanceOf(0x0050AF…). Net = emission − burn.
  const data = rows.map((r) => {
    const emission = weiToFloat(r.quaiAddedSum, 2);
    const burn = weiToFloat(r.burnDelta, 2);
    return {
      date: r.periodStart,
      emission,
      burn,
      net: emission - burn,
      burnOutpaced: burn > emission,
    };
  });

  const outpacedCount = data.filter((d) => d.burnOutpaced).length;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>
          QUAI issued vs SOAP burn per {params.period}
        </CardTitle>
        <div className="flex items-center gap-3">
          <span
            className={
              outpacedCount > 0 ? "text-xs text-red-600 dark:text-red-300" : "text-xs text-slate-900/40 dark:text-white/40"
            }
          >
            {outpacedCount} / {data.length} {params.period}s burned {">"}{" "}
            issued
          </span>
          <InfoPopover label="About issued vs burn">
            <p className="mb-2">
              <strong className="text-slate-900/90 dark:text-white/90">Blue bars</strong>{" "}
              ={" "}
              <code className="text-slate-900/60 dark:text-white/60">quai_added_sum</code>{" "}
              — gross QUAI issued in the period (block rewards + conversion
              credits). This is what we colloquially call &quot;emission&quot;.
            </p>
            <p className="mb-2">
              <strong className="text-slate-900/90 dark:text-white/90">Red bars</strong>{" "}
              ={" "}
              <code className="text-slate-900/60 dark:text-white/60">burn_delta</code>{" "}
              — growth of{" "}
              <code className="text-slate-900/60 dark:text-white/60">balanceOf(0x0050AF…)</code>{" "}
              in the period. The authoritative burn signal.
            </p>
            <p>
              When red exceeds blue in a period, more QUAI flowed into the
              burn sink than was issued from rewards/conversions — a net
              deflationary period. Emission is continuous; burns are lumpy
              foundation events, so individual days can go either way even
              while cumulative emission still leads cumulative burn.
            </p>
          </InfoPopover>
        </div>
      </div>
      <div
        className="mt-3 h-64"
        role="img"
        aria-label={`Grouped bar chart of QUAI issued vs SOAP burned per ${params.period} from ${params.from} to ${params.to}. Burn exceeded emission in ${outpacedCount} of ${data.length} periods.`}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
              tickFormatter={formatPeriodDate}
              minTickGap={40}
            />
            <YAxis
              tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
              width={64}
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
              formatter={(v, name) => [
                `${Number(v).toLocaleString()} QUAI`,
                String(name),
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "var(--chart-axis)" }}
            />
            <ReferenceLine y={0} stroke="var(--chart-reference-line)" />
            <ProtocolEventLines
              visibleFrom={params.from}
              visibleTo={params.to}
            />
            {/* No stackId → Recharts groups the bars side-by-side per period.
                Same Y axis so heights are directly comparable. */}
            <Bar dataKey="emission" name="QUAI issued" fill="#3b82f6" />
            <Bar dataKey="burn" name="SOAP burn" fill="#ef4444" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-xs text-slate-900/40 dark:text-white/40">
        Same-axis grouped bars — compare heights directly. Red {">"} blue means
        the burn sink absorbed more QUAI than was issued that {params.period}
        . Expand the range to &quot;All&quot; to see every lumpy burn event
        against the steady emission baseline.
      </div>
    </Card>
  );
}
