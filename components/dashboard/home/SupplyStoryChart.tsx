"use client";
import { useMemo } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { useSupply } from "@/lib/hooks";
import {
  formatCompact,
  formatPeriodDate,
  weiToFloat,
} from "@/lib/format";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ProtocolEventLines } from "@/components/dashboard/shared/ProtocolEventLines";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { ChartLegend } from "@/components/ui/ChartLegend";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";

const SUPPLY_STORY_LEGEND = [
  { label: "Realized circulating", color: "#3b82f6" },
  { label: "SOAP burn (overlay)", color: "#f97316", dasharray: "4 3" },
];

// SupplyStoryChart — the home-page flagship.
//   • realized (blue)   — quai_total_end, what's actually circulating
//                          (already net of SOAP burn at the RPC layer)
//   • SOAP burn (orange) — balanceOf(0x0050AF…). Rendered as a separate
//                          stack so it overlays the bottom of realized
//                          rather than lifting it; visually subtractive,
//                          matching SupplyDecompositionChart's treatment.
//
// Top of the supply stack = realized circulating. The hatched orange wedge
// at the floor marks "this much was minted then retired." Singularity Fork
// is an annotation only — it eliminated FUTURE unlocks that were never
// minted, so there's nothing to draw as a wedge.

export function SupplyStoryChart({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  const { data, isLoading, error } = useSupply({
    period: "day",
    from,
    to,
    include: ["qi", "burn"],
  });

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((r) => ({
      date: r.periodStart,
      realized: weiToFloat(r.realizedCirculatingQuai, 0),
      burn: weiToFloat(r.burnClose ?? 0n, 0),
    }));
  }, [data]);

  const last = data?.[data.length - 1];

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <CardTitle>QUAI supply story</CardTitle>
        <InfoPopover label="About the supply story">
          <p className="font-medium">Two layers</p>
          <ul className="mt-1 list-disc pl-4 text-slate-900/70 dark:text-white/70">
            <li>
              <span className="font-medium text-blue-600 dark:text-blue-300">
                Realized
              </span>
              : <code>quaiSupplyTotal</code> from the RPC. Already net of SOAP
              burn server-side — no client-side subtraction. Top of the blue
              area is what's actually circulating today.
            </li>
            <li>
              <span className="font-medium text-orange-600 dark:text-orange-300">
                SOAP burn
              </span>
              : <code>balanceOf(0x0050AF…)</code>. The sole authoritative burn
              signal. Drawn as a hatched overlay starting at the floor (y=0)
              — visually subtractive, marking the slice of supply that's been
              retired without lifting the realized line.
            </li>
          </ul>
          <p className="mt-2">
            <span className="font-medium">Singularity Fork (2026-03-19)</span>:
            shown as an annotation only. The fork eliminated ~1.67 B QUAI of
            future genesis unlocks; those allocations were never minted into
            this curve, so there's nothing to subtract here. The effect lands
            on eventual maximum supply, not on what's circulating today.
          </p>
        </InfoPopover>
      </div>

      <ChartLegend items={SUPPLY_STORY_LEGEND} className="mt-3" />

      <div className="mt-3 h-72 sm:h-80">
        {isLoading || !data ? (
          <ChartSkeleton />
        ) : error ? (
          <div className="text-sm text-red-600 dark:text-red-300">{String(error)}</div>
        ) : data.length === 0 ? (
          <div className="text-sm text-slate-900/50 dark:text-white/50">
            No supply data in this range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} syncId="home" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                {/* Diagonal-stripe pattern used as the SOAP-burn area fill.
                    Visually signals "this would be circulating supply but
                    has been subtracted off the top via burn" — the stripes
                    read as "removed/voided" vs the solid blue realized
                    circulating fill below. */}
                <pattern
                  id="soap-burn-stripes"
                  patternUnits="userSpaceOnUse"
                  width="6"
                  height="6"
                  patternTransform="rotate(45)"
                >
                  <rect width="6" height="6" fill="#f97316" fillOpacity={0.18} />
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="6"
                    stroke="#f97316"
                    strokeWidth="2.5"
                    strokeOpacity={0.85}
                  />
                </pattern>
              </defs>
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
                minTickGap={48}
              />
              <YAxis
                tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                tickFormatter={formatCompact}
                tickLine={false}
                axisLine={false}
                width={64}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    labelFormatter={(v) => formatPeriodDate(String(v))}
                    formatter={(v, name) => [
                      `${Number(v).toLocaleString()} QUAI`,
                      name,
                    ]}
                  />
                }
              />
              <ProtocolEventLines visibleFrom={from} visibleTo={to} />
              <Area
                type="monotone"
                dataKey="realized"
                name="Realized circulating"
                stackId="supply"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.5}
                isAnimationActive
                animationDuration={500}
                animationEasing="ease-out"
              />
              <Area
                type="monotone"
                dataKey="burn"
                name="SOAP burn (overlay)"
                stackId="burn"
                stroke="#f97316"
                strokeWidth={1.4}
                strokeDasharray="4 3"
                fill="url(#soap-burn-stripes)"
                isAnimationActive
                animationDuration={500}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {last && (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-slate-900/50 dark:text-white/50">
          <span>
            Latest {formatPeriodDate(last.periodStart)}: realized{" "}
            <span className="font-mono text-slate-900/80 dark:text-white/80">
              {formatCompact(weiToFloat(last.realizedCirculatingQuai, 0))} QUAI
            </span>
          </span>
          <span>
            burned{" "}
            <span className="font-mono text-slate-900/80 dark:text-white/80">
              {formatCompact(weiToFloat(last.burnClose ?? 0n, 0))} QUAI
            </span>
          </span>
          <span>
            gross{" "}
            <span className="font-mono text-slate-900/80 dark:text-white/80">
              {formatCompact(
                weiToFloat(
                  last.realizedCirculatingQuai + (last.burnClose ?? 0n),
                  0,
                ),
              )}{" "}
              QUAI
            </span>
          </span>
        </div>
      )}
    </Card>
  );
}
