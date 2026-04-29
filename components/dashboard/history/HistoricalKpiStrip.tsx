"use client";
import { useMemo } from "react";
import { HeroStrip, type HeroCard } from "@/components/dashboard/shared/HeroStrip";
import { useRollups, computeRollupSummary } from "@/lib/hooks";
import { useHistoryParams } from "@/lib/useHistoryParams";
import {
  formatBigQi,
  formatBigTokens,
  formatCompact,
  qitsToFloat,
  weiToFloat,
} from "@/lib/format";

// HistoricalKpiStrip — bento KPI lead-in for /dashboard/history. Dominant
// card: QUAI issued in the selected range, with a per-period sparkline of
// quai_added_sum. Supporting cards: Qi issued, SOAP burn, net QUAI issuance,
// and (for daily period) peak daily QUAI.

export function HistoricalKpiStrip() {
  const { params } = useHistoryParams();
  const { data: rows, isLoading } = useRollups({
    period: params.period,
    from: params.from,
    to: params.to,
  });

  const summary = computeRollupSummary(rows, params.period);

  const sparkData = useMemo(() => {
    if (!rows || rows.length === 0) return [] as number[];
    return rows.map((r) => weiToFloat(r.quaiAddedSum, 0));
  }, [rows]);

  const rangeLabel = `${params.period} · ${params.preset === "custom" ? `${params.from} → ${params.to}` : params.preset}`;

  const loading = isLoading || !summary;

  const dominant: HeroCard = {
    id: "quai-issued",
    label: "QUAI issued in range",
    value: summary ? (
      <>
        {formatCompact(weiToFloat(summary.quaiIssued, 0))}
        <span className="ml-1 text-base font-normal text-slate-900/55 dark:text-white/55">
          QUAI
        </span>
      </>
    ) : (
      "—"
    ),
    numericValue: summary ? weiToFloat(summary.quaiIssued, 0) : undefined,
    sub: `Σ quai_added_sum · ${rangeLabel}`,
    loading,
    accent: "blue",
    sparkline: sparkData.length >= 2 ? { data: sparkData } : undefined,
  };

  const qi: HeroCard = {
    id: "qi-issued",
    label: "QI issued in range",
    value: summary ? formatBigQi(summary.qiIssued) : "—",
    numericValue: summary ? qitsToFloat(summary.qiIssued, 0) : undefined,
    sub: "Σ qi_added_sum",
    loading,
    accent: "emerald",
  };

  const burn: HeroCard = {
    id: "burn",
    label: "SOAP burn in range",
    value: summary ? formatBigTokens(summary.burnInRange, "QUAI") : "—",
    numericValue: summary ? weiToFloat(summary.burnInRange, 0) : undefined,
    sub: "burn_close[last] − burn_close[first]",
    loading,
    accent: "orange",
  };

  const net: HeroCard = {
    id: "net",
    label: "Net QUAI issuance",
    value: summary ? formatBigTokens(summary.netQuaiIssuance, "QUAI") : "—",
    numericValue: summary
      ? weiToFloat(summary.netQuaiIssuance, 0)
      : undefined,
    sub: "net_emitted − burn_in_range",
    loading,
    accent: "emerald",
  };

  const cards: HeroCard[] = [qi, burn, net];

  if (params.period === "day") {
    cards.push({
      id: "peak",
      label: "Peak daily QUAI issued",
      value:
        summary?.peakDailyQuaiIssued != null
          ? formatBigTokens(summary.peakDailyQuaiIssued, "QUAI")
          : "—",
      numericValue:
        summary?.peakDailyQuaiIssued != null
          ? weiToFloat(summary.peakDailyQuaiIssued, 0)
          : undefined,
      sub: "max(quai_added_sum) across range",
      loading,
      accent: "amber",
    });
  }

  return <HeroStrip dominant={dominant} cards={cards} />;
}
