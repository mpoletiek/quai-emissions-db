"use client";
import { useState } from "react";
import { MiningHero } from "@/components/dashboard/mining/MiningHero";
import { AlgoCompositionChart } from "@/components/dashboard/mining/AlgoCompositionChart";
import { HashrateChart } from "@/components/dashboard/mining/HashrateChart";
import { DifficultyChart } from "@/components/dashboard/mining/DifficultyChart";
import { BlockRewardChart } from "@/components/dashboard/mining/BlockRewardChart";
import { UncledRatioChart } from "@/components/dashboard/mining/UncledRatioChart";
import { TopCoinbasesTable } from "@/components/dashboard/mining/TopCoinbasesTable";
import {
  TimeframeToggle,
  type Timeframe,
  timeframeToFromIso,
  todayIso,
} from "@/components/dashboard/shared/TimeframeToggle";
import { SOAP_ACTIVATION_DATE } from "@/lib/quai/protocol-constants";

// Default timeframe is 90d, which on 2026-04-25 fully covers the post-SOAP
// era (SOAP activated 2025-12-17). User can extend back via the toggle to
// see pre-SOAP context, where most per-algo columns will be empty.

export default function MiningPage() {
  const [tf, setTf] = useState<Timeframe>("90d");
  const flagshipFrom = timeframeToFromIso(tf) ?? SOAP_ACTIVATION_DATE;
  const flagshipTo = todayIso();

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Mining</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-900/60 dark:text-white/60">
          Per-algorithm hashrate, difficulty, and workshare composition
          under SOAP. KawPoW seals blocks (and merge-mines RVN); SHA
          contributes via merge-mining from BCH; Scrypt from LTC and DOGE.
        </p>
      </header>

      <div className="mb-5">
        <MiningHero from={flagshipFrom} to={flagshipTo} />
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-900/60 dark:text-white/60">
          Algorithm composition
        </h2>
        <TimeframeToggle value={tf} onChange={setTf} />
      </div>

      <div className="mb-6">
        <AlgoCompositionChart from={flagshipFrom} to={flagshipTo} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HashrateChart from={flagshipFrom} to={flagshipTo} />
        <DifficultyChart from={flagshipFrom} to={flagshipTo} />
        <BlockRewardChart from={flagshipFrom} to={flagshipTo} />
        <UncledRatioChart from={flagshipFrom} to={flagshipTo} />
      </div>

      <div className="mt-4">
        <TopCoinbasesTable days={7} limit={10} />
      </div>
    </main>
  );
}
