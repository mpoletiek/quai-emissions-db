"use client";
import { useMemo } from "react";
import { HeroStrip, type HeroCard } from "@/components/dashboard/shared/HeroStrip";
import { useSupply } from "@/lib/hooks";
import { formatCompact, qitsToFloat, weiToFloat } from "@/lib/format";
import {
  GENESIS_PREMINE_QUAI,
  SINGULARITY_SKIP_QUAI,
} from "@/lib/quai/protocol-constants";

// HomeHero — five KPI cards leading the dashboard home page.
//
//   [DOMINANT] Realized circulating QUAI    (live, from /api/supply)
//   • Total SOAP burn                       (live)
//   • Net issuance · 7d                     (derived from 14d window)
//   • Genesis premine                       (static constant)
//   • Singularity skip                      (static constant)
//
// The two static constants moved here from the now-removed /tokenomics
// page so the dashboard surfaces them in one place. They never change but
// they're load-bearing context for any reader trying to reconcile
// quaiSupplyTotal with eventual maximum supply.

export function HomeHero({ from, to }: { from: string; to: string }) {
  const { data } = useSupply({
    period: "day",
    from,
    to,
    include: ["qi", "burn"],
  });

  const { latest, sevenDayDelta } = useMemo(() => {
    if (!data || data.length === 0) {
      return { latest: null, sevenDayDelta: null };
    }
    const latest = data[data.length - 1];
    const sevenBackIdx = Math.max(0, data.length - 1 - 7);
    const baseline = data[sevenBackIdx];
    const sevenDayDelta =
      latest.realizedCirculatingQuai - baseline.realizedCirculatingQuai;
    return { latest, sevenDayDelta };
  }, [data]);

  const loading = !latest;

  const dominant: HeroCard = {
    id: "realized",
    label: "Realized circulating QUAI",
    value: latest ? (
      <>
        {formatCompact(weiToFloat(latest.realizedCirculatingQuai, 0))}
        <span className="ml-1 text-base font-normal text-slate-900/55 dark:text-white/55">
          QUAI
        </span>
      </>
    ) : (
      "—"
    ),
    sub: "On-chain quaiSupplyTotal for cyprus1, already net of SOAP burn.",
    loading,
  };

  const qi: HeroCard = {
    id: "qi-realized",
    label: "Realized circulating Qi",
    value: latest?.qiTotalEnd != null ? (
      <>
        {formatCompact(qitsToFloat(latest.qiTotalEnd, 0))}
        <span className="ml-1 text-sm font-normal text-slate-900/55 dark:text-white/55">
          QI
        </span>
      </>
    ) : (
      "—"
    ),
    sub: "Cumulative Qi minted on cyprus1.",
    loading,
  };

  const burn: HeroCard = {
    id: "burn",
    label: "Total SOAP burn",
    value: latest ? (
      <>
        {formatCompact(weiToFloat(latest.burnClose ?? 0n, 0))}
        <span className="ml-1 text-sm font-normal text-slate-900/55 dark:text-white/55">
          QUAI
        </span>
      </>
    ) : (
      "—"
    ),
    sub: "balanceOf(0x0050AF…) at last close.",
    loading,
  };

  const netSign =
    sevenDayDelta == null
      ? null
      : sevenDayDelta > 0n
        ? "up"
        : sevenDayDelta < 0n
          ? "down"
          : "flat";

  const net: HeroCard = {
    id: "net7d",
    label: "Net issuance · 7d",
    value:
      sevenDayDelta == null ? (
        "—"
      ) : (
        <>
          {sevenDayDelta >= 0n ? "+" : "−"}
          {formatCompact(Math.abs(weiToFloat(sevenDayDelta, 0)))}
          <span className="ml-1 text-sm font-normal text-slate-900/55 dark:text-white/55">
            QUAI
          </span>
        </>
      ),
    sub: "Change in realized circulating over the last 7 days.",
    delta:
      netSign == null
        ? undefined
        : { sign: netSign as "up" | "down" | "flat", text: "7d" },
    loading,
  };

  const premine: HeroCard = {
    id: "premine",
    label: "Genesis premine",
    value: (
      <>
        {formatCompact(weiToFloat(GENESIS_PREMINE_QUAI, 0))}
        <span className="ml-1 text-sm font-normal text-slate-900/55 dark:text-white/55">
          QUAI
        </span>
      </>
    ),
    sub: "Allocated at block 0; vests over time.",
  };

  const skip: HeroCard = {
    id: "skip",
    label: "Singularity skip",
    value: (
      <>
        −{formatCompact(weiToFloat(SINGULARITY_SKIP_QUAI, 0))}
        <span className="ml-1 text-sm font-normal text-slate-900/55 dark:text-white/55">
          QUAI
        </span>
      </>
    ),
    sub: "Future unlocks eliminated 2026-03-19.",
  };

  return (
    <HeroStrip dominant={dominant} cards={[qi, burn, net, premine, skip]} />
  );
}
