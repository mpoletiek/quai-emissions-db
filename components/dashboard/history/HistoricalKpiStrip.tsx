"use client";
import { Card, CardTitle } from "@/components/ui/Card";
import { useRollups, computeRollupSummary } from "@/lib/hooks";
import { useHistoryParams } from "@/lib/useHistoryParams";
import { formatBigQi, formatBigTokens } from "@/lib/format";

function Placeholder({ title }: { title: string }) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <div className="mt-2 h-6 w-24 animate-pulse rounded bg-slate-900/10 dark:bg-white/10" />
      <div className="mt-1 h-4 w-32 animate-pulse rounded bg-slate-900/5 dark:bg-white/5" />
    </Card>
  );
}

export function HistoricalKpiStrip() {
  const { params } = useHistoryParams();
  const { data: rows, isLoading } = useRollups({
    period: params.period,
    from: params.from,
    to: params.to,
  });

  const summary = computeRollupSummary(rows, params.period);

  if (isLoading || !summary) {
    const titles =
      params.period === "day"
        ? ["QUAI issued", "QI issued", "SOAP burn", "Net QUAI", "Peak daily QUAI"]
        : ["QUAI issued", "QI issued", "SOAP burn", "Net QUAI"];
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {titles.map((t) => <Placeholder key={t} title={t} />)}
      </div>
    );
  }

  const rangeLabel = `${params.period} · ${params.preset === "custom" ? `${params.from} → ${params.to}` : params.preset}`;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
      <Card>
        <CardTitle>QUAI issued in range</CardTitle>
        <div className="mt-2 text-xl font-semibold text-quai-700 dark:text-quai-100">
          {formatBigTokens(summary.quaiIssued, "QUAI")}
        </div>
        <div className="mt-1 text-xs text-slate-900/50 dark:text-white/50">Σ quai_added_sum · {rangeLabel}</div>
      </Card>

      <Card>
        <CardTitle>QI issued in range</CardTitle>
        <div className="mt-2 text-xl font-semibold text-qi-700 dark:text-qi-100">
          {formatBigQi(summary.qiIssued)}
        </div>
        <div className="mt-1 text-xs text-slate-900/50 dark:text-white/50">Σ qi_added_sum</div>
      </Card>

      <Card>
        <CardTitle>SOAP burn in range</CardTitle>
        <div className="mt-2 text-xl font-semibold text-red-600 dark:text-red-300">
          {formatBigTokens(summary.burnInRange, "QUAI")}
        </div>
        <div className="mt-1 text-xs text-slate-900/50 dark:text-white/50">
          burn_close[last] − burn_close[first]
        </div>
      </Card>

      <Card>
        <CardTitle>Net QUAI issuance</CardTitle>
        <div className="mt-2 text-xl font-semibold text-quai-700 dark:text-quai-100">
          {formatBigTokens(summary.netQuaiIssuance, "QUAI")}
        </div>
        <div className="mt-1 text-xs text-slate-900/50 dark:text-white/50">
          net_emitted − burn_in_range
        </div>
      </Card>

      {summary.peakDailyQuaiIssued !== null && (
        <Card>
          <CardTitle>Peak daily QUAI issued</CardTitle>
          <div className="mt-2 text-xl font-semibold text-quai-700 dark:text-quai-100">
            {formatBigTokens(summary.peakDailyQuaiIssued, "QUAI")}
          </div>
          <div className="mt-1 text-xs text-slate-900/50 dark:text-white/50">
            max(quai_added_sum) across range
          </div>
        </Card>
      )}
    </div>
  );
}
