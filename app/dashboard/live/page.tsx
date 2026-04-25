"use client";
import { useState } from "react";
import { LiveHero } from "@/components/dashboard/live/LiveHero";
import { BlockIntervalScatter } from "@/components/dashboard/live/BlockIntervalScatter";
import { RecentBlocksFeed } from "@/components/dashboard/live/RecentBlocksFeed";
import { ReorgLogTable } from "@/components/dashboard/live/ReorgLogTable";
import { AlgorithmPanel } from "@/components/dashboard/AlgorithmPanel";
import { CumulativeEmissionsChart } from "@/components/dashboard/CumulativeEmissionsChart";
import { NetSupplyChart } from "@/components/dashboard/NetSupplyChart";
import { MintActivityChart } from "@/components/dashboard/MintActivityChart";
import { ExchangeRateChart } from "@/components/dashboard/ExchangeRateChart";
import { EmissionsPerBlockChart } from "@/components/dashboard/EmissionsPerBlockChart";
import {
  WindowSelector,
  type WindowSize,
} from "@/components/dashboard/WindowSelector";

// /dashboard/live — devs / chain integrators surface.
// Hero → block-interval scatter (flagship) → recent blocks + reorg log →
// the existing v1 live charts demoted into a 2-column grid below the fold.
// The old /live page is unchanged and continues to serve.

export default function DashboardLivePage() {
  const [window, setWindow] = useState<WindowSize>(2000);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Live</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-900/60 dark:text-white/60">
            Chain head, block cadence, and the reorg log on{" "}
            <code className="text-slate-900/80 dark:text-white/80">cyprus1</code>.
            Refreshes every 30–60 seconds.
          </p>
        </div>
        <WindowSelector value={window} onChange={setWindow} />
      </header>

      <div className="mb-5">
        <LiveHero />
      </div>

      <div className="mb-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-900/60 dark:text-white/60">
          Block cadence
        </h2>
      </div>

      <div className="mb-6">
        <BlockIntervalScatter window={Math.min(window, 1000)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecentBlocksFeed limit={20} />
        <ReorgLogTable limit={25} />
      </div>

      <div className="mt-8 mb-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-900/60 dark:text-white/60">
          Live emissions
        </h2>
      </div>

      <div className="space-y-4">
        <AlgorithmPanel />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <CumulativeEmissionsChart limit={window} />
          <NetSupplyChart limit={window} />
          <MintActivityChart limit={window} />
          <ExchangeRateChart limit={window} />
          <EmissionsPerBlockChart limit={window} />
        </div>
      </div>
    </main>
  );
}
