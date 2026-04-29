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
import { ProtocolEventLines } from "@/components/dashboard/history/ProtocolEventLines";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { ChartLegend } from "@/components/ui/ChartLegend";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";

const SUPPLY_STORY_LEGEND = [
  { label: "Realized circulating", color: "#3b82f6" },
  { label: "SOAP burn (subtracted)", color: "#f97316", dasharray: "4 3" },
];

// SupplyStoryChart — the home-page flagship.
// Two stacked areas:
//   • realized (blue)   — quai_total_end, what's actually circulating
//                          (already net of SOAP burn at the RPC layer)
//   • SOAP burn (orange) — balanceOf(0x0050AF…); the wedge represents QUAI
//                          that was minted then redirected away
//
// Top of the stack = gross minted (realized + burn). The visual story is
// "what was minted, and how much SOAP has redirected." Singularity Fork is
// an annotation only — it eliminated FUTURE unlocks that were never minted
// into the curve, so there's nothing to draw as a wedge.

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

  // Conditional y-axis floor: if realized stays above FLOOR across the whole
  // visible window, crop the y-axis so the variation isn't squashed against
  // the top. Falls back to a 0-baseline when any sample dips below FLOOR
  // (e.g. the "all" timeframe which includes the launch ramp from zero) so
  // the early curve still has room to render.
  const Y_FLOOR = 400_000_000;
  const yMin = useMemo(() => {
    if (!chartData.length) return 0;
    const minRealized = Math.min(...chartData.map((d) => d.realized));
    return minRealized >= Y_FLOOR ? Y_FLOOR : 0;
  }, [chartData]);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>QUAI supply story</CardTitle>
          <ul className="mt-1 max-w-xl space-y-0.5 text-xs text-slate-900/80 dark:text-white/80">
            <li>
              <span className="font-medium text-blue-600 dark:text-blue-300">
                Realized
              </span>
              {" "}— QUAI actually circulating on cyprus1.
            </li>
            <li>
              <span className="font-medium text-orange-600 dark:text-orange-300">
                SOAP burn
              </span>
              {" "}(hatched) — minted then sent to <code>0x0050AF…</code> and
              subtracted off the top.
            </li>
            <li>
              <span className="font-medium text-slate-900/80 dark:text-white/80">
                Top of stack
              </span>
              {" "}= gross minted (realized + burn).
            </li>
          </ul>
        </div>
        <InfoPopover label="About the supply story">
          <p className="font-medium">Two layers</p>
          <ul className="mt-1 list-disc pl-4 text-slate-900/70 dark:text-white/70">
            <li>
              <span className="font-medium text-blue-600 dark:text-blue-300">
                Realized
              </span>
              : <code>quaiSupplyTotal</code> from the RPC. Already net of SOAP
              burn server-side — no client-side subtraction.
            </li>
            <li>
              <span className="font-medium text-orange-600 dark:text-orange-300">
                SOAP burn
              </span>
              : <code>balanceOf(0x0050AF…)</code>. The sole authoritative burn
              signal. Stacked above realized so the top edge equals gross
              minted.
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
                domain={[yMin, "auto"]}
                allowDataOverflow={yMin > 0}
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
                name="SOAP burn (subtracted)"
                stackId="supply"
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
