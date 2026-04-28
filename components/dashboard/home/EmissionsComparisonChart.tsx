"use client";
import { useMemo } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { useSupply } from "@/lib/hooks";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompact, weiToFloat } from "@/lib/format";
import { InfoPopover } from "@/components/ui/InfoPopover";
import {
  BTC_CAP,
  bitcoinSupplyAt,
} from "@/lib/comparisons/bitcoin";
import {
  QUAI_CAP_DATE,
  QUAI_CAP_WEI,
  QUAI_MAINNET_DATE,
  quaiProjectedSupplyAt,
} from "@/lib/comparisons/quai-projection";

// EmissionsComparisonChart — overlays QUAI on Bitcoin's emission curve,
// both aligned to their own genesis. X-axis is "Years since genesis," so
// year 0 is BTC's 2009 launch on the BTC line and Quai's 2025 launch on
// the Quai line. This makes the early-emission shape directly comparable
// at the same x position. Each network gets its own "Now" reference line
// (BTC at ~17, QUAI at ~1) since they're at very different points in
// their respective lifecycles.
//
// Data sources:
//   • Bitcoin: static schedule (lib/comparisons/bitcoin.ts).
//   • Quai historical: anchor pulled from /api/supply (most recent
//     realized circulating). Pre-anchor we ramp linearly from genesis —
//     at the multi-decade scale the actual daily curve and a linear ramp
//     are visually indistinguishable.
//   • Quai projection: linear from anchor to QUAI_CAP_WEI at QUAI_CAP_DATE.

const BTC_GENESIS_DATE = new Date("2009-01-03T18:15:05Z");
const CHART_YEARS = 41; // chart length in years-since-genesis
const STEP_PER_YEAR = 12; // monthly samples
const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;
const QUAI_CAP_QUAI = weiToFloat(QUAI_CAP_WEI, 0);

function offsetDate(base: Date, years: number): Date {
  return new Date(base.getTime() + years * MS_PER_YEAR);
}

function yearsBetween(later: Date, earlier: Date): number {
  return (later.getTime() - earlier.getTime()) / MS_PER_YEAR;
}

export function EmissionsComparisonChart() {
  // Pull Quai realized supply from the last 14 days; we just need a fresh
  // anchor — a single row works.
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const lookbackIso = new Date(today.getTime() - 14 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const { data } = useSupply({
    period: "day",
    from: lookbackIso,
    to: todayIso,
  });

  const anchor = useMemo(() => {
    if (!data || data.length === 0) return null;
    const last = data[data.length - 1];
    return {
      date: new Date(last.periodStart + "T00:00:00Z"),
      supply: last.realizedCirculatingQuai,
    };
  }, [data]);

  const chartData = useMemo(() => {
    const out: {
      year: number;
      btc: number;
      btcPct: number;
      quai: number;
      quaiPct: number;
      btcDate: string;
      quaiDate: string;
    }[] = [];
    const totalSteps = CHART_YEARS * STEP_PER_YEAR;
    for (let i = 0; i <= totalSteps; i++) {
      const year = i / STEP_PER_YEAR;
      const btcAt = offsetDate(BTC_GENESIS_DATE, year);
      const quaiAt = offsetDate(QUAI_MAINNET_DATE, year);

      const btc = bitcoinSupplyAt(btcAt);
      const btcPct = (btc / BTC_CAP) * 100;

      let quaiSupplyWei: bigint;
      if (!anchor) {
        quaiSupplyWei = 0n;
      } else if (quaiAt <= anchor.date) {
        // Linear ramp from QUAI genesis → anchor.
        const totalMs = anchor.date.getTime() - QUAI_MAINNET_DATE.getTime();
        const elapsedMs = quaiAt.getTime() - QUAI_MAINNET_DATE.getTime();
        const ppm = BigInt(
          Math.floor(Math.max(0, Math.min(1, elapsedMs / totalMs)) * 1_000_000),
        );
        quaiSupplyWei = (anchor.supply * ppm) / 1_000_000n;
      } else {
        quaiSupplyWei = quaiProjectedSupplyAt(quaiAt, anchor);
      }
      const quai = weiToFloat(quaiSupplyWei, 0);
      const quaiPct = (quai / QUAI_CAP_QUAI) * 100;

      out.push({
        year,
        btc,
        btcPct,
        quai,
        quaiPct,
        btcDate: btcAt.toISOString().slice(0, 7),
        quaiDate: quaiAt.toISOString().slice(0, 7),
      });
    }
    return out;
  }, [anchor]);

  // Each network's "now" expressed as years-since-its-own-genesis.
  const btcYearsNow = useMemo(
    () => yearsBetween(today, BTC_GENESIS_DATE),
    [today],
  );
  const quaiYearsNow = useMemo(
    () => yearsBetween(today, QUAI_MAINNET_DATE),
    [today],
  );

  // QUAI cap reached at year (CAP_DATE - QUAI_GENESIS).
  const quaiCapYear = yearsBetween(QUAI_CAP_DATE, QUAI_MAINNET_DATE);

  // BTC halving years (relative to BTC genesis).
  const btcHalvingYears = useMemo(
    () =>
      [
        new Date("2012-11-28T15:24:38Z"),
        new Date("2016-07-09T16:46:13Z"),
        new Date("2020-05-11T19:23:43Z"),
        new Date("2024-04-19T20:09:27Z"),
      ].map((d) => yearsBetween(d, BTC_GENESIS_DATE)),
    [],
  );

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>QUAI vs Bitcoin emission curves</CardTitle>
          <div className="mt-1 max-w-xl text-xs text-slate-900/55 dark:text-white/55">
            <p>
              Cumulative supply as % of each network's cap, aligned from
              each genesis (year 0 = launch).
            </p>
            <ul className="mt-1 space-y-0.5">
              <li>
                <span className="font-medium text-blue-600 dark:text-blue-300">
                  QUAI
                </span>
                {" "}— launched 2025; "Now" line at year ~1; caps at 1.4 B by
                year ~4.
              </li>
              <li>
                <span className="font-medium text-orange-600 dark:text-orange-300">
                  Bitcoin
                </span>
                {" "}— launched 2009; "Now" line at year ~17; approaches 21 M
                asymptotically by year ~131.
              </li>
            </ul>
            <p className="mt-1">
              Same x position = same network age, not same calendar date —
              that's how the early-emission shapes line up to compare.
            </p>
          </div>
        </div>
        <InfoPopover label="About the comparison">
          <p>
            <span className="font-medium">X-axis</span>: years since each
            network's genesis. BTC genesis = 2009-01-03; QUAI genesis =
            2025-01-29. Same x position means same age, not same calendar
            date — that's how the early-emission shapes line up to compare.
          </p>
          <p className="mt-2">
            <span className="font-medium">Bitcoin</span> uses real halving
            timestamps for the four halvings to date and projects subsequent
            halvings at 4-year intervals. Cumulative supply per epoch is
            <code> blocks_per_day × days_in_epoch × reward</code>.
          </p>
          <p className="mt-2">
            <span className="font-medium">QUAI historical</span> is anchored
            on the most recent <code>quaiSupplyTotal</code> row from{" "}
            <code>/api/supply</code>. Pre-anchor history is linearly ramped
            from QUAI genesis — at the multi-decade scale this is visually
            indistinguishable from the daily curve.
          </p>
          <p className="mt-2">
            <span className="font-medium">QUAI projection</span> is linear
            from today's anchor to 1.4 B QUAI at {QUAI_CAP_DATE.toISOString().slice(0, 10)}.
            Real Quai emissions decay as log(difficulty) rather than
            linearly; this projection tracks the foundation's published cap
            target rather than modelling the underlying decay.
          </p>
        </InfoPopover>
      </div>

      <div className="mt-4 h-72 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              type="number"
              dataKey="year"
              domain={[0, CHART_YEARS]}
              tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
              tickFormatter={(v) => `Y${Math.round(Number(v))}`}
              ticks={[0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40]}
              minTickGap={32}
            />
            <YAxis
              tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
              domain={[0, 105]}
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
              labelFormatter={(v) => `Year ${Number(v).toFixed(2)} since genesis`}
              formatter={(v, name, item) => {
                const row = item.payload as {
                  btc: number;
                  quai: number;
                  btcPct: number;
                  quaiPct: number;
                  btcDate: string;
                  quaiDate: string;
                };
                if (name === "QUAI % of cap") {
                  return [
                    `${Number(v).toFixed(2)}% — ${formatCompact(row.quai)} QUAI (${row.quaiDate})`,
                    name,
                  ];
                }
                if (name === "BTC % of cap") {
                  return [
                    `${Number(v).toFixed(2)}% — ${formatCompact(row.btc)} BTC (${row.btcDate})`,
                    name,
                  ];
                }
                return [v, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "var(--chart-axis)" }} />

            {/* "Now" lines — one per network, at their respective year-since-genesis. */}
            <ReferenceLine
              x={btcYearsNow}
              stroke="#f97316"
              strokeOpacity={0.7}
              label={{
                value: `BTC now · Y${btcYearsNow.toFixed(1)}`,
                position: "insideTopRight",
                fill: "#f97316",
                fontSize: 10,
              }}
            />
            <ReferenceLine
              x={quaiYearsNow}
              stroke="#3b82f6"
              strokeOpacity={0.7}
              label={{
                value: `QUAI now · Y${quaiYearsNow.toFixed(1)}`,
                position: "insideTopRight",
                fill: "#3b82f6",
                fontSize: 10,
              }}
            />

            {/* QUAI cap target — end of QUAI projection (year ~4). */}
            <ReferenceLine
              x={quaiCapYear}
              stroke="#3b82f6"
              strokeOpacity={0.4}
              strokeDasharray="2 2"
              label={{
                value: "QUAI cap",
                position: "insideTopRight",
                fill: "#3b82f6",
                fontSize: 10,
              }}
            />

            {/* BTC halving events at years ~3.9, 7.5, 11.4, 15.3 since BTC genesis. */}
            {btcHalvingYears.map((y, i) => (
              <ReferenceLine
                key={y}
                x={y}
                stroke="#f97316"
                strokeOpacity={0.35}
                strokeDasharray="2 2"
                label={
                  i === 0
                    ? {
                        value: "BTC halvings",
                        position: "insideTopLeft",
                        fill: "#f97316",
                        fontSize: 10,
                      }
                    : undefined
                }
              />
            ))}

            <Line
              type="monotone"
              dataKey="quaiPct"
              name="QUAI % of cap"
              stroke="#3b82f6"
              strokeWidth={1.6}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="btcPct"
              name="BTC % of cap"
              stroke="#f97316"
              strokeWidth={1.6}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-slate-900/50 dark:text-white/50">
        <span>
          QUAI cap:{" "}
          <span className="font-mono text-slate-900/80 dark:text-white/80">
            {formatCompact(QUAI_CAP_QUAI)} QUAI
          </span>{" "}
          by {QUAI_CAP_DATE.toISOString().slice(0, 10)}
        </span>
        <span>
          BTC cap:{" "}
          <span className="font-mono text-slate-900/80 dark:text-white/80">
            {formatCompact(BTC_CAP)} BTC
          </span>{" "}
          (~2140)
        </span>
      </div>
    </Card>
  );
}
