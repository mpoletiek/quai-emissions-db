"use client";
import { useMemo } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { useRollups } from "@/lib/hooks";
import {
  formatCompact,
  formatPeriodDate,
  weiToFloat,
} from "@/lib/format";
import { nz } from "@/lib/quai/types";
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
import { ProtocolEventLines } from "@/components/dashboard/history/ProtocolEventLines";
import { SamplingFootnote } from "@/components/dashboard/shared/SamplingFootnote";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { SOAP_ACTIVATION_DATE } from "@/lib/quai/protocol-constants";

// SoapMiningChart — cumulative QUAI mined and cumulative SOAP burn since
// SOAP activation, both zero-anchored at the launch date so the gap
// between the two lines is "net mining contribution to circulating since
// SOAP."
//
// Why this needs its own chart: the supply-story chart on top uses
// quai_total_end (RPC's quaiSupplyTotal), which mixes mining issuance with
// conversions and genesis unlocks. This chart isolates mining-only
// emissions to QUAI-winner blocks alongside the SOAP-burn rebased to the
// same start date.
//
// Per-period math (rollup columns):
//
//   total_mining_wei = base_block_reward_sum + workshare_total × workshare_reward_avg
//   quai_paid_wei    = total_mining_wei × (winner_quai_count / block_count)
//   burn_since_soap  = burn_close[t] − burn_close[first row]
//   net              = cumulative_mined − burn_since_soap
//
// Notes:
//   • Pre-SOAP rows are filtered out for mining (NULL columns).
//   • Qi-winner blocks pay miners in Qi, not QUAI — so they don't add to
//     the mined curve.
//   • Burn anchor is the first row's burn_close in the response (the row
//     covering SOAP activation day). Subsequent rows subtract that anchor
//     to give cumulative-burn-since-SOAP.
//   • Uncled workshares get redistributed within a block, not removed from
//     the per-block reward — so workshare_total × workshare_reward_avg is
//     an unbiased estimate of total workshare payout, not an over-count.

export function SoapMiningChart({ to }: { to: string }) {
  const from = SOAP_ACTIVATION_DATE;
  const { data, isLoading, error } = useRollups({ period: "day", from, to });

  const chartData = useMemo(() => {
    if (!data) return [];
    let cumMined = 0n;
    let burnAnchor: bigint | null = null;
    // Anchor the curve at zero on SOAP launch date so the y-axis baseline
    // is unambiguous.
    const out: {
      date: string;
      mined: number;
      burned: number;
      net: number;
    }[] = [
      { date: SOAP_ACTIVATION_DATE, mined: 0, burned: 0, net: 0 },
    ];
    for (const r of data) {
      // Capture the burn anchor on the very first row regardless of mining
      // data. burn_close is dense across all rollup rows.
      if (burnAnchor === null) burnAnchor = r.burnClose;

      // Skip rows where the SOAP-era reward columns aren't populated. This
      // catches both pre-SOAP rows and any tail-mode rows where the rollup
      // hasn't yet picked up mining_info samples for the period.
      if (
        r.baseBlockRewardSum == null ||
        r.workshareRewardAvg == null ||
        r.blockCount === 0
      ) {
        continue;
      }
      const baseSum = nz(r.baseBlockRewardSum);
      const wsReward = nz(r.workshareRewardAvg);
      const wsTotal = BigInt(r.workshareTotal);
      const totalMiningWei = baseSum + wsReward * wsTotal;
      const winnerQuai = BigInt(r.winnerQuaiCount);
      const blocks = BigInt(r.blockCount);
      const quaiEmitWei =
        blocks > 0n ? (totalMiningWei * winnerQuai) / blocks : 0n;
      cumMined += quaiEmitWei;

      const burnSinceSoap = r.burnClose - (burnAnchor ?? 0n);
      const netWei = cumMined - burnSinceSoap;

      out.push({
        date: r.periodStart,
        mined: weiToFloat(cumMined, 0),
        burned: weiToFloat(burnSinceSoap, 0),
        net: weiToFloat(netWei, 0),
      });
    }
    return out;
  }, [data]);

  const last = chartData[chartData.length - 1];

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>QUAI mining vs SOAP burn since SOAP</CardTitle>
          <p className="mt-1 max-w-xl text-xs text-slate-900/55 dark:text-white/55">
            Cumulative QUAI paid out via mining (blue) and cumulative SOAP
            burn (orange), both zero-anchored at SOAP activation (
            {SOAP_ACTIVATION_DATE}). The gap between them is the net
            mining contribution to circulating supply.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <SamplingFootnote kind="averaged" />
          <InfoPopover label="About SOAP mining vs burn">
            <p>
              <span className="font-medium">Mined per period</span>:{" "}
              <code>
                base_block_reward_sum + workshare_total ×
                workshare_reward_avg
              </code>
              , gated to QUAI payout via{" "}
              <code>winner_quai_count / block_count</code>.
            </p>
            <p className="mt-2">
              <span className="font-medium">Burned since SOAP</span>:{" "}
              <code>burn_close[t] − burn_close[first row]</code>. The
              anchor is the first SOAP-day rollup row, so the orange line
              starts at zero and accumulates only burns post-activation.
            </p>
            <p className="mt-2">
              The supply-story chart above uses{" "}
              <code>quaiSupplyTotal</code>, which folds in conversions and
              genesis unlocks. This chart strips those out so the lines
              track pure miner issuance and pure SOAP-burn flow since the
              activation moment.
            </p>
            <p className="mt-2 text-slate-900/55 dark:text-white/55">
              Qi-winner blocks pay their reward in Qi (not QUAI), so they
              don't add to the mined line.
            </p>
          </InfoPopover>
        </div>
      </div>

      <div className="mt-4 h-72 sm:h-80">
        {isLoading || !data ? (
          <div className="h-full animate-pulse rounded bg-slate-900/5 dark:bg-white/5" />
        ) : error ? (
          <div className="text-sm text-red-600 dark:text-red-300">
            {String(error)}
          </div>
        ) : chartData.length <= 1 ? (
          <div className="text-sm text-slate-900/50 dark:text-white/50">
            No SOAP-era rollups in this range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                tickFormatter={formatPeriodDate}
                minTickGap={48}
              />
              <YAxis
                tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                tickFormatter={formatCompact}
                width={64}
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
              <Legend wrapperStyle={{ fontSize: 11, color: "var(--chart-axis)" }} />
              <ProtocolEventLines visibleFrom={from} visibleTo={to} />
              <Line
                type="monotone"
                dataKey="mined"
                name="Cumulative QUAI mined"
                stroke="#3b82f6"
                strokeWidth={1.6}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="burned"
                name="Cumulative SOAP burn"
                stroke="#f97316"
                strokeWidth={1.6}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="net"
                name="Net (mined − burned)"
                stroke="#10b981"
                strokeWidth={1.2}
                strokeDasharray="3 3"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {last && (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-slate-900/50 dark:text-white/50">
          <span>Latest {formatPeriodDate(last.date)}:</span>
          <span>
            mined{" "}
            <span className="font-mono text-blue-600 dark:text-blue-300">
              {formatCompact(last.mined)} QUAI
            </span>
          </span>
          <span>
            burned{" "}
            <span className="font-mono text-orange-600 dark:text-orange-300">
              {formatCompact(last.burned)} QUAI
            </span>
          </span>
          <span>
            net{" "}
            <span className="font-mono text-emerald-600 dark:text-emerald-300">
              {last.net >= 0 ? "+" : ""}
              {formatCompact(last.net)} QUAI
            </span>
          </span>
        </div>
      )}
    </Card>
  );
}
