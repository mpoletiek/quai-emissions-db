"use client";
import { Card, CardTitle } from "@/components/ui/Card";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { useRollups } from "@/lib/hooks";
import { useHistoryParams } from "@/lib/useHistoryParams";
import { formatPeriodDate, weiToFloat } from "@/lib/format";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ProtocolEventLines } from "./ProtocolEventLines";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";

export function ExchangeRateHistoryChart() {
  const { params } = useHistoryParams();
  const { data: rows, isLoading, error } = useRollups({
    period: params.period,
    from: params.from,
    to: params.to,
  });

  if (isLoading || !rows) {
    return (
      <Card>
        <CardTitle>Exchange rate</CardTitle>
        <ChartSkeleton height="h-64" className="mt-4" />
      </Card>
    );
  }
  if (error) {
    return (
      <Card>
        <CardTitle>Exchange rate</CardTitle>
        <div className="mt-4 text-sm text-red-600 dark:text-red-300">{String(error)}</div>
      </Card>
    );
  }
  if (rows.length === 0) {
    return (
      <Card>
        <CardTitle>Exchange rate</CardTitle>
        <div className="mt-4 text-sm text-slate-900/50 dark:text-white/50">
          No rollup data in this range.
        </div>
      </Card>
    );
  }

  const data = rows.map((r) => ({
    date: r.periodStart,
    rate: weiToFloat(r.rateClose, 6),
  }));

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>Exchange rate ({params.period}, close)</CardTitle>
        <InfoPopover label="About exchange rate">
          <p className="mb-2">
            Period close of{" "}
            <code className="text-slate-900/60 dark:text-white/60">header.exchangeRate</code>{" "}
            ÷ 10¹⁸. Directional signal for kQuai rebalancing and conversion
            pricing.
          </p>
          <p>
            Semantic (Qi/Quai vs Quai/Qi) still unverified against a clean
            conversion event; OHLC candlesticks deferred to Phase 3 until
            direction is locked.
          </p>
        </InfoPopover>
      </div>
      <div
        className="mt-3 h-64"
        role="img"
        aria-label={`Line chart of period-close exchange rate per ${params.period}, ${params.from} to ${params.to}`}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              stroke="var(--chart-grid-soft)"
              strokeDasharray="2 4"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
              tickFormatter={formatPeriodDate}
              tickLine={false}
              axisLine={false}
              minTickGap={40}
            />
            <YAxis
              tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={64}
              domain={["auto", "auto"]}
            />
            <Tooltip
              content={
                <ChartTooltip
                  labelFormatter={(v) => formatPeriodDate(String(v))}
                  formatter={(v) => [Number(v).toLocaleString(), "exchangeRate"]}
                />
              }
            />
            <ProtocolEventLines
              visibleFrom={params.from}
              visibleTo={params.to}
            />
            <Line
              type="monotone"
              dataKey="rate"
              stroke="#a855f7"
              dot={false}
              strokeWidth={1.5}
              name="exchangeRate close"
              isAnimationActive
              animationDuration={500}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-xs text-slate-900/40 dark:text-white/40">
        Close of <code className="text-slate-900/60 dark:text-white/60">header.exchangeRate</code>{" "}
        per {params.period}, ÷ 10¹⁸. Directional signal for kQuai rebalancing;
        Qi/Quai vs Quai/Qi semantics still unverified, so OHLC candlesticks are
        deferred to Phase 3.
      </div>
    </Card>
  );
}
