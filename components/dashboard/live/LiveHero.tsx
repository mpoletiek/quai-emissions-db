"use client";
import { useMemo } from "react";
import { HeroStrip, type HeroCard } from "@/components/dashboard/shared/HeroStrip";
import { useHeadBlock, useReorgs, useStats } from "@/lib/hooks";

// LiveHero — 4 KPIs for /dashboard/live.
// Block height + sync state come from /api/health. Reorgs (24h) from
// /api/reorgs. Workshares per block from /api/stats. No sparkline on the
// dominant card — none of the live endpoints expose a windowed time-series
// without introducing a new data source (out of Phase 2 scope).

export function LiveHero() {
  const { data: head } = useHeadBlock();
  const { data: reorgs } = useReorgs({ limit: 1 });
  const { data: stats } = useStats();

  const dominant: HeroCard = useMemo(() => {
    const blockNum = head?.headBlock;
    return {
      id: "head",
      label: "Latest block",
      value: blockNum != null ? `#${blockNum.toLocaleString()}` : "—",
      numericValue: blockNum ?? undefined,
      sub: head
        ? head.lagBlocks === 0
          ? "Synced with chain head."
          : `${head.lagBlocks.toLocaleString()} blocks behind head.`
        : "Awaiting /api/health.",
      loading: !head,
      accent: "blue",
    };
  }, [head]);

  const sync: HeroCard = {
    id: "sync",
    label: "Backfill state",
    value: head ? (head.backfillDone ? "complete" : "in progress") : "—",
    sub: head?.lastIngestedBlock
      ? `Cursor at #${head.lastIngestedBlock.toLocaleString()}.`
      : undefined,
    loading: !head,
  };

  const reorg: HeroCard = {
    id: "reorgs",
    label: "Reorgs · 24h",
    value: reorgs ? reorgs.last24h.toLocaleString() : "—",
    numericValue: reorgs?.last24h ?? undefined,
    sub:
      reorgs && reorgs.last24h === 0
        ? "Chain stable in last 24 hours."
        : "Detected by tail-mode hash check.",
    loading: !reorgs,
  };

  const workshares: HeroCard = {
    id: "workshares",
    label: "Workshares per block",
    value: stats?.info?.estimatedBlockReward
      ? // Use the workshareReward + estimatedBlockReward to back out the share
        // count? Simpler: just surface the count from the live blocks. For now,
        // show the estimated block reward as a stand-in — workshare count
        // varies per block and a single live number isn't meaningful here.
        "—"
      : "—",
    sub: stats?.info?.avgBlockTime
      ? `Avg block time ${stats.info.avgBlockTime.toFixed(2)}s.`
      : undefined,
    loading: !stats,
  };

  return <HeroStrip dominant={dominant} cards={[sync, reorg, workshares]} />;
}
