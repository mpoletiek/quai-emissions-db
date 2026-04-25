"use client";
import { useMemo } from "react";
import { HeroStrip, type HeroCard } from "@/components/dashboard/shared/HeroStrip";
import { useRollups, useStats } from "@/lib/hooks";
import {
  formatHashrate,
  formatBigTokens,
  formatSeconds,
} from "@/lib/format";
import { nz, nzn } from "@/lib/quai/types";

// MiningHero — 4 KPIs for /dashboard/mining.
// Live hashrate + reward + block time come from /api/stats (current 15-min
// trailing averages). SHA workshare share comes from the most recent
// post-SOAP rollup row in the displayed window.

export function MiningHero({ from, to }: { from: string; to: string }) {
  const { data: stats } = useStats();
  const { data: rollups } = useRollups({ period: "day", from, to });

  const totalHashrate = useMemo(() => {
    if (!stats?.info?.perAlgo) return null;
    const p = stats.info.perAlgo;
    return p.kawpow.hashRate + p.sha.hashRate + p.scrypt.hashRate;
  }, [stats]);

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
    sub: stats?.info?.perAlgo
      ? `KawPoW ${formatHashrate(stats.info.perAlgo.kawpow.hashRate)} · SHA ${formatHashrate(stats.info.perAlgo.sha.hashRate)} · Scrypt ${formatHashrate(stats.info.perAlgo.scrypt.hashRate)}`
      : "Trailing 15-minute average across all SOAP algorithms.",
    loading,
  };

  const reward: HeroCard = {
    id: "reward",
    label: "Base block reward",
    value: stats?.info ? formatBigTokens(stats.info.baseBlockReward, "QUAI") : "—",
    sub: "Per-block subsidy before workshare distribution.",
    loading,
  };

  const blockTime: HeroCard = {
    id: "blocktime",
    label: "Avg block time",
    value: stats?.info?.avgBlockTime
      ? formatSeconds(stats.info.avgBlockTime)
      : "—",
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
    sub: "Of recent workshares; merge-mined BCH contribution.",
    loading,
  };

  return <HeroStrip dominant={dominant} cards={[reward, blockTime, sha]} />;
}
