"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { HistoryControls } from "@/components/dashboard/history/HistoryControls";
import { ProtocolEventsLegend } from "@/components/dashboard/history/ProtocolEventsLegend";
import { HistoricalKpiStrip } from "@/components/dashboard/history/HistoricalKpiStrip";
import { SupplyTotalsChart } from "@/components/dashboard/history/SupplyTotalsChart";
import { DailyIssuanceChart } from "@/components/dashboard/history/DailyIssuanceChart";
import { NetDailyIssuanceChart } from "@/components/dashboard/history/NetDailyIssuanceChart";
import { CumulativeBurnChart } from "@/components/dashboard/history/CumulativeBurnChart";
import { WinnerTokenSplitChart } from "@/components/dashboard/history/WinnerTokenSplitChart";
import { ExchangeRateHistoryChart } from "@/components/dashboard/history/ExchangeRateHistoryChart";
import { SupplyVsBurnChart } from "@/components/dashboard/history/SupplyVsBurnChart";
import { EmissionVsBurnChart } from "@/components/dashboard/history/EmissionVsBurnChart";

const ROLLUPS_ENABLED = process.env.NEXT_PUBLIC_ROLLUPS_ENABLED === "true";

// /dashboard/history — analyst surface. Reuses the existing v1 chart and
// control components; the only difference vs the legacy /history page is
// the header copy and the dashboard sub-nav context. Period × range is
// URL-state driven via useHistoryParams (shared with the v1 page, so query
// params are interchangeable).

export default function DashboardHistoryPage() {
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-900/60 dark:text-white/60">
          Slice rollups by period and range. Daily, weekly, and monthly
          aggregates of QUAI and Qi credit flow on{" "}
          <code className="text-slate-900/80 dark:text-white/80">cyprus1</code>,
          bucketed in UTC.
        </p>
      </header>

      <Suspense fallback={<ControlsSkeleton />}>
        <DefaultLandingEffect />
        <div className="mb-4">
          <HistoryControls />
        </div>
        {ROLLUPS_ENABLED ? <ChartGrid /> : <ComingSoonCard />}
      </Suspense>
    </main>
  );
}

function ChartGrid() {
  return (
    <div className="space-y-4">
      <HistoricalKpiStrip />
      <ProtocolEventsLegend />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SupplyTotalsChart />
        <SupplyVsBurnChart />
        <DailyIssuanceChart />
        <EmissionVsBurnChart />
        <NetDailyIssuanceChart />
        <CumulativeBurnChart />
        <WinnerTokenSplitChart />
        <ExchangeRateHistoryChart />
      </div>
    </div>
  );
}

function ComingSoonCard() {
  return (
    <Card>
      <CardTitle>Historical data coming soon</CardTitle>
      <div className="mt-2 text-sm text-slate-900/60 dark:text-white/60">
        Rollups backend is live; set{" "}
        <code className="text-slate-900/80 dark:text-white/80">
          NEXT_PUBLIC_ROLLUPS_ENABLED=true
        </code>{" "}
        in <code className="text-slate-900/80 dark:text-white/80">.env.local</code>{" "}
        and restart{" "}
        <code className="text-slate-900/80 dark:text-white/80">npm run dev</code>{" "}
        to enable the chart grid.
      </div>
    </Card>
  );
}

function ControlsSkeleton() {
  return <div className="mb-4 h-8 animate-pulse rounded bg-slate-900/5 dark:bg-white/5" />;
}

function DefaultLandingEffect() {
  const router = useRouter();
  const sp = useSearchParams();
  useEffect(() => {
    const hasAny =
      sp.get("period") || sp.get("range") || sp.get("from") || sp.get("to");
    if (!hasAny) {
      router.replace("/dashboard/history?period=day&range=30d");
    }
  }, [sp, router]);
  return null;
}
