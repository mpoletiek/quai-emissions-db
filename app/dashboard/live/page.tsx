"use client";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    document.title = "Quai · Live";
  }, []);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-10">
      <div className="mb-5">
        <LiveHero />
      </div>

      <div className="mb-3 flex items-center justify-end gap-2">
        <span className="text-[0.7rem] uppercase tracking-wider text-slate-900/55 dark:text-white/55">
          Window
        </span>
        <WindowSelector value={window} onChange={setWindow} />
      </div>

      <div className="fade-in-stagger space-y-6">
        <BlockIntervalScatter window={Math.min(window, 1000)} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <RecentBlocksFeed limit={20} />
          <ReorgLogTable limit={25} />
        </div>

        {/* Quarantined v1 grid — pre-Phase-1 visualizations kept for parity
            but collapsed by default to keep the new design surface clean.
            Slate accent (vs amber for "important callout") signals "older /
            less prominent" rather than "needs attention". */}
        <details className="group rounded-lg border border-slate-900/10 bg-slate-900/[0.02] dark:border-white/10 dark:bg-white/[0.02]">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-slate-900/80 hover:text-slate-900 dark:text-white/80 dark:hover:text-white">
            <span className="mr-2 inline-block transition-transform group-open:rotate-90">
              ›
            </span>
            Legacy v1 charts
            <span className="ml-2 text-xs font-normal text-slate-900/55 dark:text-white/55">
              Pre-Phase-1 visualizations, kept for parity
            </span>
          </summary>
          <div className="space-y-4 px-4 pb-4 pt-2">
            <AlgorithmPanel />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <CumulativeEmissionsChart limit={window} />
              <NetSupplyChart limit={window} />
              <MintActivityChart limit={window} />
              <ExchangeRateChart limit={window} />
              <EmissionsPerBlockChart limit={window} />
            </div>
          </div>
        </details>
      </div>
    </main>
  );
}
