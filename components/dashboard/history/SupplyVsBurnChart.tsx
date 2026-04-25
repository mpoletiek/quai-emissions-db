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

export function SupplyVsBurnChart() {
  const { params } = useHistoryParams();
  const { data: rows, isLoading, error } = useRollups({
    period: params.period,
    from: params.from,
    to: params.to,
  });
  const rebased = params.rebaseAt !== null;

  if (isLoading || !rows) {
    return (
      <Card>
        <CardTitle>
          {rebased
            ? `QUAI supply vs cumulative burn · since ${params.rebaseLabel}`
            : "QUAI supply vs cumulative burn"}
        </CardTitle>
        <div className="mt-4 h-64 animate-pulse rounded bg-slate-900/5 dark:bg-white/5" />
      </Card>
    );
  }
  if (error) {
    return (
      <Card>
        <CardTitle>
          {rebased
            ? `QUAI supply vs cumulative burn · since ${params.rebaseLabel}`
            : "QUAI supply vs cumulative burn"}
        </CardTitle>
        <div className="mt-4 text-sm text-red-600 dark:text-red-300">{String(error)}</div>
      </Card>
    );
  }
  if (rows.length === 0) {
    return (
      <Card>
        <CardTitle>
          {rebased
            ? `QUAI supply vs cumulative burn · since ${params.rebaseLabel}`
            : "QUAI supply vs cumulative burn"}
        </CardTitle>
        <div className="mt-4 text-sm text-slate-900/50 dark:text-white/50">
          No rollup data in this range.
        </div>
      </Card>
    );
  }

  const rawData = rows.map((r) => ({
    date: r.periodStart,
    supply: weiToFloat(r.quaiTotalEnd, 0),
    burn: weiToFloat(r.burnClose, 0),
  }));
  const baseSupply = rebased ? rawData[0].supply : 0;
  const baseBurn = rebased ? rawData[0].burn : 0;
  const data = rebased
    ? rawData.map((d) => ({
        date: d.date,
        supply: d.supply - baseSupply,
        burn: d.burn - baseBurn,
      }))
    : rawData;

  const last = data[data.length - 1];
  const first = data[0];
  const supplyDelta = last.supply - first.supply;
  const burnDelta = last.burn - first.burn;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>
          {rebased
            ? `QUAI supply vs cumulative burn · since ${params.rebaseLabel}`
            : "QUAI supply vs cumulative burn"}
        </CardTitle>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-900/40 dark:text-white/40">
            range Δ: supply {supplyDelta >= 0 ? "+" : ""}
            {formatCompact(supplyDelta)} · burn +{formatCompact(burnDelta)}
          </span>
          <InfoPopover label="About supply vs burn">
            <p className="mb-2">
              <strong className="text-slate-900/90 dark:text-white/90">Dual-axis.</strong> Blue (left)
              = circulating{" "}
              <code className="text-slate-900/60 dark:text-white/60">quai_total_end</code>. Red (right)
              = cumulative{" "}
              <code className="text-slate-900/60 dark:text-white/60">burn_close</code>.
            </p>
            <p className="mb-2">
              Each series has its own scale, so slope = rate of change.
              Supply trajectory and burn trajectory are independently comparable;
              the absolute magnitudes differ (~980M vs ~73M QUAI currently).
            </p>
            <p>
              Gross emission is continuous (~100–150K QUAI/day from rewards).
              SOAP burns are lumpy foundation events. In windows with a burn
              event, cumulative burn can step up faster than{" "}
              <code className="text-slate-900/60 dark:text-white/60">quai_total_end</code> grows —{" "}
              <code className="text-slate-900/60 dark:text-white/60">quai_total_end</code> is already
              net of burn, so it can dip when a burn exceeds the period&apos;s
              emission.
            </p>
          </InfoPopover>
        </div>
      </div>
      <div
        className="mt-3 h-64"
        role="img"
        aria-label={`Dual-axis line chart of circulating QUAI supply and cumulative SOAP burn from ${params.from} to ${params.to}. Supply changed by ${formatCompact(supplyDelta)} QUAI, burn grew by ${formatCompact(burnDelta)} QUAI.`}
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
            {rebased ? (
              // In rebased mode both series are QUAI-denominated deltas and
              // directly comparable, so a single shared axis is honest and
              // avoids the visual artifact where supply's negative range
              // makes burn appear to "start below zero" on the opposite axis.
              <YAxis
                yAxisId="supply"
                tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                width={64}
                tickFormatter={formatCompact}
                domain={["auto", "auto"]}
              />
            ) : (
              <>
                <YAxis
                  yAxisId="supply"
                  tick={{ fill: "rgba(59,130,246,0.9)", fontSize: 11 }}
                  width={64}
                  tickFormatter={formatCompact}
                  domain={["auto", "auto"]}
                />
                <YAxis
                  yAxisId="burn"
                  orientation="right"
                  tick={{ fill: "rgba(239,68,68,0.9)", fontSize: 11 }}
                  width={64}
                  tickFormatter={formatCompact}
                  domain={["auto", "auto"]}
                />
              </>
            )}
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
            <ProtocolEventLines
              visibleFrom={params.from}
              visibleTo={params.to}
              yAxisId="supply"
            />
            <Line
              yAxisId="supply"
              type="monotone"
              dataKey="supply"
              name={rebased ? "Δ circulating QUAI" : "Circulating QUAI (left)"}
              stroke="#3b82f6"
              dot={false}
              strokeWidth={1.75}
            />
            <Line
              yAxisId={rebased ? "supply" : "burn"}
              type="monotone"
              dataKey="burn"
              name={rebased ? "Cumulative SOAP burn" : "Cumulative SOAP burn (right)"}
              stroke="#ef4444"
              dot={false}
              strokeWidth={1.75}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-xs text-slate-900/40 dark:text-white/40">
        {rebased
          ? `Rebased to 0 at ${params.rebaseLabel} (${params.rebaseAt}). Single shared Y-axis — both series are QUAI-denominated deltas. Blue = net Δ circulating QUAI since that date (${formatCompact(last.supply)}). Red = cumulative SOAP burn since that date (${formatCompact(last.burn)}). If burn > emission over the window, blue dips below zero.`
          : `Left axis (blue) is circulating QUAI on the order of ${formatCompact(last.supply)}. Right axis (red) is cumulative SOAP burn on the order of ${formatCompact(last.burn)}. Axes are independent — compare slopes, not bar heights.`}
      </div>
    </Card>
  );
}
