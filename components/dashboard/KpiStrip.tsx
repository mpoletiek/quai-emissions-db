"use client";
import { Card, CardTitle } from "@/components/ui/Card";
import { useStats } from "@/lib/hooks";
import {
  formatBigQi,
  formatBigTokens,
  formatSeconds,
  formatToken,
  weiToFloat,
} from "@/lib/format";
import { WEI_PER_TOKEN } from "@/lib/quai/constants";

function Placeholder({ title }: { title: string }) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <div className="mt-2 h-6 w-24 animate-pulse rounded bg-slate-900/10 dark:bg-white/10" />
      <div className="mt-1 h-4 w-32 animate-pulse rounded bg-slate-900/5 dark:bg-white/5" />
    </Card>
  );
}

export function KpiStrip() {
  const { data, isLoading, error } = useStats();
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {["QUAI Supply", "QI Supply", "SOAP Burned", "Block Reward", "Block Time"].map((t) => (
          <Placeholder key={t} title={t} />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <Card>
        <CardTitle>Stats error</CardTitle>
        <div className="mt-2 text-sm text-red-600 dark:text-red-300">{String(error)}</div>
      </Card>
    );
  }

  const { supply, info, analytics } = data;
  const quaiWei =
    analytics?.quaiSupplyTotal ??
    (info.quaiSupplyTotal > 0n ? info.quaiSupplyTotal : supply.quaiWhole * WEI_PER_TOKEN);
  const qiQits = analytics?.qiSupplyTotal ?? 0n;
  const soapBurn = analytics?.soapBurnBalance ?? null;

  // Observed: estimatedBlockReward = baseBlockReward + 2 × avgTxFees on every sample.
  // Label the subtitle accordingly instead of the misleading "base + fees".
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
      <Card>
        <CardTitle>Total QUAI Supply</CardTitle>
        <div className="mt-2 text-2xl font-semibold text-quai-700 dark:text-quai-100">
          {formatBigTokens(quaiWei, "QUAI")}
        </div>
        <div className="mt-1 text-xs text-slate-900/50 dark:text-white/50">
          via <code className="text-slate-900/70 dark:text-white/70">quai_getSupplyAnalyticsForBlock</code>
        </div>
      </Card>

      <Card>
        <CardTitle>Total QI Supply</CardTitle>
        <div className="mt-2 text-2xl font-semibold text-qi-700 dark:text-qi-100">
          {formatBigQi(qiQits)}
        </div>
        <div className="mt-1 text-xs text-slate-900/50 dark:text-white/50">
          3-decimal token · {qiQits.toLocaleString()} qits raw
        </div>
      </Card>

      <Card>
        <CardTitle>SOAP Burned</CardTitle>
        <div className="mt-2 text-2xl font-semibold text-red-600 dark:text-red-300">
          {soapBurn !== null ? formatBigTokens(soapBurn, "QUAI") : "—"}
        </div>
        <div className="mt-1 text-xs text-slate-900/50 dark:text-white/50">
          balance of <code className="text-slate-900/70 dark:text-white/70">0x0050AF…</code> · authoritative burn signal
        </div>
      </Card>

      <Card>
        <CardTitle>Estimated Block Reward</CardTitle>
        <div className="mt-2 text-2xl font-semibold text-quai-700 dark:text-quai-100">
          {formatToken(info.estimatedBlockReward, "QUAI", 4)}
        </div>
        <div className="mt-1 text-xs text-slate-900/50 dark:text-white/50">
          base {weiToFloat(info.baseBlockReward, 2)} + 2× avg fees (
          {weiToFloat(info.avgTxFees, 4)}) · workshare {weiToFloat(info.workshareReward, 4)} QUAI
        </div>
      </Card>

      <Card>
        <CardTitle>Avg Block Time</CardTitle>
        <div className="mt-2 text-2xl font-semibold text-quai-700 dark:text-quai-100">
          {formatSeconds(info.avgBlockTime)}
        </div>
        <div className="mt-1 text-xs text-slate-900/50 dark:text-white/50">
          over {info.blocksAnalyzed} blocks · head #{info.blockNumber.toLocaleString()}
        </div>
      </Card>
    </div>
  );
}
