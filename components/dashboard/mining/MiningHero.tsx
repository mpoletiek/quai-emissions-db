"use client";
import { useMemo } from "react";
import { HeroStrip, type HeroCard } from "@/components/dashboard/shared/HeroStrip";
import { useRollups, useStats } from "@/lib/hooks";
import {
  formatHashrate,
  formatBigTokens,
  formatSeconds,
  weiToFloat,
} from "@/lib/format";
import { nz, nzn } from "@/lib/quai/types";

// MiningHero — 4 KPIs for /dashboard/mining.
// Live hashrate + reward + block time come from /api/stats (current 15-min
// trailing averages). SHA workshare share comes from the most recent
// post-SOAP rollup row in the displayed window. The dominant sparkline shows
// the per-day total hashrate trend across the displayed window.

export function MiningHero({ from, to }: { from: string; to: string }) {
  const { data: stats } = useStats();
  const { data: rollups } = useRollups({ period: "day", from, to });

  const totalHashrate = useMemo(() => {
    if (!stats?.info?.perAlgo) return null;
    const p = stats.info.perAlgo;
    return p.kawpow.hashRate + p.sha.hashRate + p.scrypt.hashRate;
  }, [stats]);

  const hashrateSpark = useMemo(() => {
    if (!rollups || rollups.length === 0) return [] as number[];
    // Sum per-day per-algo hashrate averages (NULL → 0). Drop leading rows
    // that are all zero so the sparkline doesn't get squashed by pre-SOAP
    // empty space.
    const series: number[] = [];
    let started = false;
    for (const r of rollups) {
      const total =
        Number(nz(r.kawpowHashrateAvg)) +
        Number(nz(r.shaHashrateAvg)) +
        Number(nz(r.scryptHashrateAvg));
      if (!started && total === 0) continue;
      started = true;
      series.push(total);
    }
    return series;
  }, [rollups]);

  const shaShare = useMemo(() => {
    if (!rollups || rollups.length === 0) return null;
    // Walk back from the most recent row to find one with SOAP data populated.
    for (let i = rollups.length - 1; i >= 0; i--) {
      const r = rollups[i];
      const kaw = nz(r.wsKawpowSum);
      const sha = nz(r.wsShaSum);
      const scr = nz(r.wsScryptSum);
      const total = kaw + sha + scr;
      if (total > 0n) {
        return Number((sha * 10000n) / total) / 100; // pct, 2 decimals
      }
    }
    return null;
  }, [rollups]);

  const loading = !stats;

  const dominant: HeroCard = {
    id: "hashrate",
    label: "Combined network hashrate",
    value: totalHashrate != null ? formatHashrate(totalHashrate) : "—",
    numericValue:
      totalHashrate != null ? Number(totalHashrate) : undefined,
    sub: stats?.info?.perAlgo
      ? `KawPoW ${formatHashrate(stats.info.perAlgo.kawpow.hashRate)} · SHA ${formatHashrate(stats.info.perAlgo.sha.hashRate)} · Scrypt ${formatHashrate(stats.info.perAlgo.scrypt.hashRate)}`
      : "Trailing 15-minute average across all SOAP algorithms.",
    loading,
    accent: "blue",
    sparkline: hashrateSpark.length >= 2 ? { data: hashrateSpark } : undefined,
  };

  const reward: HeroCard = {
    id: "reward",
    label: "Base block reward",
    value: stats?.info ? formatBigTokens(stats.info.baseBlockReward, "QUAI") : "—",
    numericValue: stats?.info
      ? weiToFloat(stats.info.baseBlockReward, 4)
      : undefined,
    sub: "Per-block subsidy before workshare distribution.",
    loading,
  };

  const blockTime: HeroCard = {
    id: "blocktime",
    label: "Avg block time",
    value: stats?.info?.avgBlockTime
      ? formatSeconds(stats.info.avgBlockTime)
      : "—",
    numericValue: stats?.info?.avgBlockTime ?? undefined,
    sub: `${nzn(stats?.info?.blocksAnalyzed) || 0} blocks analyzed.`,
    loading,
  };

  const sha: HeroCard = {
    id: "sha-share",
    label: "SHA workshare share",
    value:
      shaShare == null
        ? "—"
        : `${shaShare.toFixed(1)}%`,
    numericValue: shaShare ?? undefined,
    sub: "Of recent workshares; merge-mined BCH contribution.",
    loading,
  };

  return <HeroStrip dominant={dominant} cards={[reward, blockTime, sha]} />;
}
