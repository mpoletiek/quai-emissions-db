"use client";
import { useState } from "react";
import { HomeHero } from "@/components/dashboard/home/HomeHero";
import { SupplyStoryChart } from "@/components/dashboard/home/SupplyStoryChart";
import { SoapMiningChart } from "@/components/dashboard/home/SoapMiningChart";
import { EmissionsComparisonChart } from "@/components/dashboard/home/EmissionsComparisonChart";
import { QiCumulativeChart } from "@/components/dashboard/home/QiCumulativeChart";
import { SingularityCallout } from "@/components/dashboard/home/SingularityCallout";
import { SoapCallout } from "@/components/dashboard/home/SoapCallout";
import {
  TimeframeToggle,
  type Timeframe,
  timeframeToFromIso,
  todayIso,
} from "@/components/dashboard/shared/TimeframeToggle";

// Mainnet date — earliest meaningful from-date when the user picks "all".
// Anything before this is empty rollup space.
const MAINNET_DATE = "2025-01-29";

// Hero strip pulls a small fixed window so the 7-day delta is always
// computable, regardless of the user's flagship-chart timeframe.
const HERO_FROM = (() => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 14);
  return d.toISOString().slice(0, 10);
})();

export default function DashboardHomePage() {
  // Flagship timeframe is independent from hero strip — user controls how
  // far back the supply story goes. Default "all" so every protocol-event
  // annotation (Qi launch, SOAP, 1Y Cliff, Singularity) is visible without
  // the user reaching for the toggle.
  const [tf, setTf] = useState<Timeframe>("all");
  const flagshipFrom = timeframeToFromIso(tf) ?? MAINNET_DATE;
  const flagshipTo = todayIso();

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Quai Emissions Dashboard
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-900/60 dark:text-white/60">
          What's actually circulating, what's been burned, and what miners are
          choosing right now. Data on{" "}
          <code className="text-slate-900/80 dark:text-white/80">cyprus1</code>,
          bucketed in UTC.
        </p>
      </header>

      <div className="mb-5">
        <HomeHero from={HERO_FROM} to={todayIso()} />
      </div>

      <div className="mb-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-900/60 dark:text-white/60">
          Latest events
        </h2>
        <p className="mt-1 text-xs text-slate-900/55 dark:text-white/55">
          Two recent protocol changes shaping QUAI's emissions and eventual
          supply.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SoapCallout />
        <SingularityCallout />
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-900/60 dark:text-white/60">
          Supply story
        </h2>
        <TimeframeToggle value={tf} onChange={setTf} />
      </div>

      <div className="mb-6">
        <SupplyStoryChart from={flagshipFrom} to={flagshipTo} />
      </div>

      <div className="mb-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-900/60 dark:text-white/60">
          Qi cumulative supply
        </h2>
      </div>

      <div className="mb-6">
        <QiCumulativeChart from={flagshipFrom} to={flagshipTo} />
      </div>

      <div className="mb-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-900/60 dark:text-white/60">
          Mining issuance since SOAP
        </h2>
      </div>

      <div className="mb-6">
        <SoapMiningChart to={flagshipTo} />
      </div>

      <div className="mb-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-slate-900/60 dark:text-white/60">
          Emission curve vs Bitcoin
        </h2>
      </div>

      <EmissionsComparisonChart />
    </main>
  );
}
