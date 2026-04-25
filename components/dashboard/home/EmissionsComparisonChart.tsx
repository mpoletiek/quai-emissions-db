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
  KNOWN_HALVING_MONTHS,
  bitcoinSupplyAt,
} from "@/lib/comparisons/bitcoin";
import {
  QUAI_CAP_DATE,
  QUAI_CAP_MONTH,
  QUAI_CAP_WEI,
  QUAI_MAINNET_DATE,
  QUAI_MAINNET_MONTH,
  quaiProjectedSupplyAt,
} from "@/lib/comparisons/quai-projection";

// EmissionsComparisonChart — overlays QUAI on Bitcoin's emission curve as
// percentage of each network's cap. Shows historical + projection on one
// axis from BTC genesis (2009) to 2050. Vertical reference line marks
// today; everything to the right is projection.
//
// Data sources:
//   • Bitcoin: static schedule (lib/comparisons/bitcoin.ts).
//   • Quai historical: anchor pulled from /api/supply (most recent
//     realized circulating). Pre-anchor we ramp linearly from the mainnet
//     launch date — at the 41-year x-axis scale the actual daily curve and
//     a linear ramp are visually indistinguishable.
//   • Quai projection: linear from anchor to QUAI_CAP_WEI at QUAI_CAP_DATE.

const CHART_FROM_YEAR = 2009;
const CHART_TO_YEAR = 2050;
const QUAI_CAP_QUAI = weiToFloat(QUAI_CAP_WEI, 0);

function monthsRange(): Date[] {
  const out: Date[] = [];
  for (let y = CHART_FROM_YEAR; y <= CHART_TO_YEAR; y++) {
    for (let m = 0; m < 12; m++) {
      out.push(new Date(Date.UTC(y, m, 1)));
    }
  }
  return out;
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
    const months = monthsRange();
    return months.map((d) => {
      const btc = bitcoinSupplyAt(d);
      const btcPct = (btc / BTC_CAP) * 100;

      let quaiSupplyWei: bigint;
      if (!anchor || d < QUAI_MAINNET_DATE) {
        quaiSupplyWei = 0n;
      } else if (d <= anchor.date) {
        // Linear ramp from launch → anchor. Visually identical to the daily
        // curve at this zoom level.
        const totalMs = anchor.date.getTime() - QUAI_MAINNET_DATE.getTime();
        const elapsedMs = d.getTime() - QUAI_MAINNET_DATE.getTime();
        const ppm = BigInt(
          Math.floor(Math.max(0, Math.min(1, elapsedMs / totalMs)) * 1_000_000),
        );
        quaiSupplyWei = (anchor.supply * ppm) / 1_000_000n;
      } else {
        quaiSupplyWei = quaiProjectedSupplyAt(d, anchor);
      }
      const quai = weiToFloat(quaiSupplyWei, 0);
      const quaiPct = (quai / QUAI_CAP_QUAI) * 100;

      return {
        date: d.toISOString().slice(0, 7), // YYYY-MM
        btc,
        btcPct,
        quai,
        quaiPct,
      };
    });
  }, [anchor]);

  const todayMonth = todayIso.slice(0, 7);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>QUAI vs Bitcoin emission curves</CardTitle>
          <p className="mt-1 max-w-xl text-xs text-slate-900/55 dark:text-white/55">
            Cumulative supply as a percentage of each network's cap. Vertical
            line marks today — everything to the right is projection. QUAI
            caps at 1.4 B by Feb 2029; Bitcoin ~21 M asymptotically by ~2140.
          </p>
        </div>
        <InfoPopover label="About the comparison">
          <p>
            <span className="font-medium">Bitcoin</span> uses real halving
            timestamps for the four halvings to date and projects subsequent
            halvings at 4-year intervals. Cumulative supply per epoch is
            <code> blocks_per_day × days_in_epoch × reward</code>.
          </p>
          <p className="mt-2">
            <span className="font-medium">QUAI historical</span> is anchored
            on the most recent <code>quaiSupplyTotal</code> row from{" "}
            <code>/api/supply</code>. Pre-anchor history is linearly ramped
            from the mainnet launch date — at the 41-year scale this is
            visually indistinguishable from the daily curve.
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
              dataKey="date"
              tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
              tickFormatter={(v) => String(v).slice(0, 4)}
              minTickGap={48}
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
              labelFormatter={(v) => String(v)}
              formatter={(v, name, item) => {
                const row = item.payload as {
                  btc: number;
                  quai: number;
                  btcPct: number;
                  quaiPct: number;
                };
                if (name === "QUAI % of cap") {
                  return [
                    `${Number(v).toFixed(2)}% (${formatCompact(row.quai)} QUAI)`,
                    name,
                  ];
                }
                if (name === "BTC % of cap") {
                  return [
                    `${Number(v).toFixed(2)}% (${formatCompact(row.btc)} BTC)`,
                    name,
                  ];
                }
                return [v, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "var(--chart-axis)" }} />

            {/* "Now" — everything to the right is projection. */}
            <ReferenceLine
              x={todayMonth}
              stroke="var(--chart-axis)"
              strokeOpacity={0.6}
              label={{
                value: "Now",
                position: "insideTopRight",
                fill: "var(--chart-axis)",
                fontSize: 10,
              }}
            />

            {/* QUAI mainnet launch — start of QUAI line. */}
            <ReferenceLine
              x={QUAI_MAINNET_MONTH}
              stroke="#3b82f6"
              strokeOpacity={0.4}
              strokeDasharray="2 2"
              label={{
                value: "QUAI mainnet",
                position: "insideTopRight",
                fill: "#3b82f6",
                fontSize: 10,
              }}
            />

            {/* QUAI cap target — end of QUAI projection. */}
            <ReferenceLine
              x={QUAI_CAP_MONTH}
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

            {/* BTC halving events. */}
            {KNOWN_HALVING_MONTHS.map((m, i) => (
              <ReferenceLine
                key={m}
                x={m}
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
