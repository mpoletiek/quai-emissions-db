"use client";
import { useMemo, useState } from "react";
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
  ReferenceArea,
  ReferenceLine,
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
import { cn } from "@/lib/utils";

const DECOMPOSITION_LEGEND = [
  { label: "Genesis (unlocked)", color: "#a855f7" },
  { label: "Mined", color: "#06b6d4" },
  { label: "SOAP burn (subtracted)", color: "#f97316", dasharray: "4 3" },
];

// Projection assumptions (locked-in user inputs):
//   • Mining: 800 000 QUAI / day, flat. Reasonable steady-state estimate;
//     in reality block reward decays log(diff) but the multi-year story
//     dominates over second-order curvature.
//   • Genesis: linear from today's residual to ~1.333 B (post-Singularity
//     vested baseline) by 2029-02-01, flat after. Real schedule is monthly
//     cliffs but linear is the right complexity for a 6-yr forecast.
//   • SOAP burn: trailing 4-week average burn velocity, projected linearly.
//     Foundation/governance can change this; documented in the popover.
const PROJECTION_YEARS = 6;
const MINING_PER_DAY_WEI = 800_000n * 10n ** 18n;
const GENESIS_TARGET_POST_SINGULARITY_WEI = 1_332_840_016n * 10n ** 18n;
const GENESIS_TARGET_NO_SINGULARITY_WEI = 3_000_000_000n * 10n ** 18n;
const VESTING_END_DATE = "2029-02-01";
const BURN_AVG_WINDOW_DAYS = 28;

// SupplyDecompositionChart — three-layer breakdown of the same silhouette
// drawn by SupplyStoryChart. Stacks bottom→top:
//   • Mined (cyan)            — cumulative block + workshare rewards from
//                                rollups_<grain> (window sum). Pre-SOAP this
//                                is just ProgPoW base_block_reward_sum;
//                                post-SOAP it's KawPoW seal reward + per-algo
//                                workshare reward.
//   • Genesis unlocked (violet)— quaiTotalEnd − cumulativeMinedQuai (clamped
//                                ≥ 0). Captures vesting-cliff unlocks as they
//                                enter the on-chain supply.
//   • SOAP burn (orange)      — burnClose. Stacked on top so the silhouette
//                                matches SupplyStoryChart exactly.
//
// Forecast toggle synthesizes daily projection rows from today through
// today + 6 yr using the assumptions documented above.

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const ms =
    new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime();
  return Math.round(ms / 86_400_000);
}

export function SupplyDecompositionChart({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  const [forecast, setForecast] = useState(false);
  const [noSingularity, setNoSingularity] = useState(false);

  const { data, isLoading, error } = useSupply({
    period: "day",
    from,
    to,
    include: ["burn", "mined"],
  });

  const lastRow = data?.[data.length - 1];

  // Trailing-window burn velocity in wei/day. Used only when forecasting.
  const burnPerDayWei = useMemo(() => {
    if (!data || data.length < 2) return 0n;
    const tail = data.slice(-BURN_AVG_WINDOW_DAYS);
    if (tail.length < 2) return 0n;
    const first = tail[0];
    const last = tail[tail.length - 1];
    const span = daysBetween(first.periodStart, last.periodStart);
    if (span <= 0) return 0n;
    const delta = (last.burnClose ?? 0n) - (first.burnClose ?? 0n);
    return delta > 0n ? delta / BigInt(span) : 0n;
  }, [data]);

  const chartData = useMemo(() => {
    if (!data) return [];

    const historical = data.map((r) => {
      const burn = r.burnClose ?? 0n;
      const mined = r.cumulativeMinedQuai ?? 0n;
      const genesisRaw = r.quaiTotalEnd - mined;
      const genesis = genesisRaw > 0n ? genesisRaw : 0n;
      return {
        date: r.periodStart,
        mined: weiToFloat(mined, 0),
        genesis: weiToFloat(genesis, 0),
        burn: weiToFloat(burn, 0),
      };
    });

    if (!forecast || !lastRow) return historical;

    // Anchor projection on the last observed row.
    const anchorDate = lastRow.periodStart;
    const anchorMined = lastRow.cumulativeMinedQuai ?? 0n;
    const anchorBurn = lastRow.burnClose ?? 0n;
    const anchorGenesisRaw = lastRow.quaiTotalEnd - anchorMined;
    const anchorGenesis = anchorGenesisRaw > 0n ? anchorGenesisRaw : 0n;

    const horizonDate = addDays(anchorDate, PROJECTION_YEARS * 365);
    const vestingDaysRemaining = Math.max(
      0,
      daysBetween(anchorDate, VESTING_END_DATE),
    );
    const genesisTargetWei = noSingularity
      ? GENESIS_TARGET_NO_SINGULARITY_WEI
      : GENESIS_TARGET_POST_SINGULARITY_WEI;
    const genesisGapWei =
      genesisTargetWei > anchorGenesis ? genesisTargetWei - anchorGenesis : 0n;
    const genesisPerDayWei =
      vestingDaysRemaining > 0 ? genesisGapWei / BigInt(vestingDaysRemaining) : 0n;

    const projection: typeof historical = [];
    const totalDays = daysBetween(anchorDate, horizonDate);
    // Step every ~7d to keep the path compact — daily would balloon the
    // payload to 2k+ extra points without changing the visual.
    for (let dayOffset = 7; dayOffset <= totalDays; dayOffset += 7) {
      const date = addDays(anchorDate, dayOffset);

      const minedWei = anchorMined + MINING_PER_DAY_WEI * BigInt(dayOffset);
      const burnWei = anchorBurn + burnPerDayWei * BigInt(dayOffset);

      // Genesis: linear ramp until vesting end, flat thereafter.
      const vestingDaysElapsed = Math.min(dayOffset, vestingDaysRemaining);
      const genesisWei =
        anchorGenesis + genesisPerDayWei * BigInt(vestingDaysElapsed);

      projection.push({
        date,
        mined: weiToFloat(minedWei, 0),
        genesis: weiToFloat(genesisWei, 0),
        burn: weiToFloat(burnWei, 0),
      });
    }

    return [...historical, ...projection];
  }, [data, forecast, lastRow, burnPerDayWei, noSingularity]);

  const projectionRange = useMemo(() => {
    if (!forecast || !lastRow) return null;
    return {
      from: lastRow.periodStart,
      to: addDays(lastRow.periodStart, PROJECTION_YEARS * 365),
    };
  }, [forecast, lastRow]);

  // First row where mined exceeds (genesis − burn). This is the moment
  // mining issuance overtakes the net premine pressure on supply — i.e.
  // when the chain becomes "mostly miner-issued" relative to what's left
  // of the genesis allocation after accounting for buyback burn.
  const crossoverDate = useMemo(() => {
    for (const r of chartData) {
      if (r.mined > r.genesis - r.burn) return r.date;
    }
    return null;
  }, [chartData]);

  const visibleTo = forecast && projectionRange ? projectionRange.to : to;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>QUAI supply decomposition</CardTitle>
          <ul className="mt-1 max-w-xl space-y-0.5 text-xs text-slate-900/80 dark:text-white/80">
            <li>
              <span className="font-medium text-cyan-600 dark:text-cyan-300">
                Mined
              </span>
              {" "}— cumulative block + workshare rewards.
            </li>
            <li>
              <span className="font-medium text-purple-600 dark:text-purple-300">
                Genesis
              </span>
              {" "}— vesting unlocks; visible jumps at the 6-month and 1-year cliffs.
            </li>
            <li>
              <span className="font-medium text-orange-600 dark:text-orange-300">
                SOAP burn
              </span>
              {" "}(hatched) — minted then sent to <code>0x0050AF…</code>.
            </li>
          </ul>
        </div>
        <div className="flex items-center gap-2">
          {forecast && (
            <button
              type="button"
              onClick={() => setNoSingularity((v) => !v)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition",
                noSingularity
                  ? "border-purple-500/60 bg-purple-500/10 text-purple-700 dark:border-purple-400/60 dark:bg-purple-400/10 dark:text-purple-200"
                  : "border-slate-300/70 text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-white/70 dark:hover:bg-white/5",
              )}
              aria-pressed={noSingularity}
              title="Project against the original 3 B genesis (no Singularity skip)"
            >
              {noSingularity ? "With Singularity" : "Without Singularity"}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setForecast((v) => {
                if (v) setNoSingularity(false);
                return !v;
              });
            }}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition",
              forecast
                ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-700 dark:border-cyan-400/60 dark:bg-cyan-400/10 dark:text-cyan-200"
                : "border-slate-300/70 text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-white/70 dark:hover:bg-white/5",
            )}
            aria-pressed={forecast}
          >
            {forecast ? "Hide forecast" : "Project 6 yr"}
          </button>
          <InfoPopover label="About the supply decomposition">
            <p className="font-medium">Same silhouette, three layers</p>
            <p className="mt-1 text-slate-900/70 dark:text-white/70">
              Decomposes <code>quaiSupplyTotal</code> (which already includes
              both mining issuance and vesting unlocks) into its two sources.
            </p>
            <ul className="mt-2 list-disc pl-4 text-slate-900/70 dark:text-white/70">
              <li>
                <span className="font-medium text-cyan-600 dark:text-cyan-300">
                  Mined
                </span>
                : window-sum of{" "}
                <code>base_block_reward_sum + workshare_reward_avg × workshare_total</code>{" "}
                across rollups.
              </li>
              <li>
                <span className="font-medium text-purple-600 dark:text-purple-300">
                  Genesis
                </span>
                : <code>quaiTotalEnd − cumulativeMinedQuai</code> (clamped ≥ 0).
                Captures vesting-cliff unlocks as they enter on-chain supply —
                TGE baseline (~478 M), 6-month cliff (~+30 M on 2025-08-04),
                1-year cliff (~+200 M on 2026-02-03).
              </li>
              <li>
                <span className="font-medium text-orange-600 dark:text-orange-300">
                  SOAP burn
                </span>
                : <code>balanceOf(0x0050AF…)</code>. Stacked above so the
                silhouette matches the chart above.
              </li>
            </ul>
            <p className="mt-2 font-medium">Forecast assumptions</p>
            <ul className="mt-1 list-disc pl-4 text-slate-900/70 dark:text-white/70">
              <li>Mining: <strong>800 000 QUAI/day</strong> flat for 6 yr.</li>
              <li>
                Genesis: linear ramp from today to{" "}
                <strong>1.333 B QUAI</strong> by{" "}
                <strong>{VESTING_END_DATE}</strong> (post-Singularity vested
                baseline), flat thereafter.
              </li>
              <li>
                SOAP burn: trailing {BURN_AVG_WINDOW_DAYS}-day average burn
                velocity, projected linearly. Foundation can change the
                burn/vault split at any time.
              </li>
            </ul>
            <p className="mt-2 font-medium">"Without Singularity" mode</p>
            <p className="mt-1 text-slate-900/70 dark:text-white/70">
              Replays the projection against the original{" "}
              <strong>3 B QUAI</strong> genesis target instead of the
              post-fork 1.333 B. Historical data is unchanged — we don't have
              the per-cohort vesting schedule needed to reconstruct the
              counterfactual past. Use it to see how much future supply
              pressure Singularity removed.
            </p>
            <p className="mt-2 text-slate-900/55 dark:text-white/55">
              Linear projections are illustrative — block rewards actually
              decay log(difficulty), genesis unlocks happen monthly, and burn
              velocity tracks parent-chain hashrate. Use the silhouette as a
              "first-order shape," not a forecast you'd trade on.
            </p>
          </InfoPopover>
        </div>
      </div>

      <ChartLegend items={DECOMPOSITION_LEGEND} className="mt-3" />

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
            <AreaChart data={chartData} syncId="home" margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <pattern
                  id="soap-burn-stripes-decomp"
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
              {projectionRange && (
                <ReferenceArea
                  x1={projectionRange.from}
                  x2={projectionRange.to}
                  fill="var(--chart-grid-soft)"
                  fillOpacity={0.35}
                  stroke="none"
                  ifOverflow="extendDomain"
                />
              )}
              <ProtocolEventLines visibleFrom={from} visibleTo={visibleTo} />
              {forecast && (
                <ReferenceLine
                  x={VESTING_END_DATE}
                  stroke="#a855f7"
                  strokeDasharray="3 3"
                  label={{
                    value: "Vesting complete",
                    position: "insideTop",
                    fill: "#a855f7",
                    fontSize: 11,
                    textAnchor: "end",
                    dx: -4,
                  }}
                />
              )}
              {crossoverDate && (
                <ReferenceLine
                  x={crossoverDate}
                  stroke="#06b6d4"
                  strokeDasharray="3 3"
                  label={{
                    value: "Mining > Unlocks − Burn",
                    position: "insideTop",
                    fill: "#06b6d4",
                    fontSize: 11,
                    textAnchor: "end",
                    dx: -4,
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey="genesis"
                name="Genesis (unlocked)"
                stackId="supply"
                stroke="#a855f7"
                fill="#a855f7"
                fillOpacity={0.45}
                isAnimationActive
                animationDuration={500}
                animationEasing="ease-out"
              />
              <Area
                type="monotone"
                dataKey="mined"
                name="Mined"
                stackId="supply"
                stroke="#06b6d4"
                fill="#06b6d4"
                fillOpacity={0.55}
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
                fill="url(#soap-burn-stripes-decomp)"
                isAnimationActive
                animationDuration={500}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {lastRow && (() => {
        const minedLast = lastRow.cumulativeMinedQuai ?? 0n;
        const genesisLast = lastRow.quaiTotalEnd > minedLast
          ? lastRow.quaiTotalEnd - minedLast
          : 0n;
        return (
          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-slate-900/50 dark:text-white/50">
            <span>
              Latest {formatPeriodDate(lastRow.periodStart)}: mined{" "}
              <span className="font-mono text-slate-900/80 dark:text-white/80">
                {formatCompact(weiToFloat(minedLast, 0))} QUAI
              </span>
            </span>
            <span>
              genesis{" "}
              <span className="font-mono text-slate-900/80 dark:text-white/80">
                {formatCompact(weiToFloat(genesisLast, 0))} QUAI
              </span>
            </span>
            <span>
              burned{" "}
              <span className="font-mono text-slate-900/80 dark:text-white/80">
                {formatCompact(weiToFloat(lastRow.burnClose ?? 0n, 0))} QUAI
              </span>
            </span>
            {forecast && (
              <span className="text-cyan-700 dark:text-cyan-300">
                Forecast: 800 K mined/day · burn ≈{" "}
                {formatCompact(weiToFloat(burnPerDayWei * 7n, 0))} QUAI/wk
                {noSingularity && (
                  <span className="ml-2 text-purple-700 dark:text-purple-300">
                    · genesis target 3 B (no Singularity)
                  </span>
                )}
              </span>
            )}
          </div>
        );
      })()}
    </Card>
  );
}
