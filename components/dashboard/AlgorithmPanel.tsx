"use client";
import { Card, CardTitle } from "@/components/ui/Card";
import { useStats } from "@/lib/hooks";
import { formatDifficulty, formatHashrate, formatSeconds } from "@/lib/format";
import type { AlgoStats } from "@/lib/quai/types";

function Tile({
  label,
  stats,
  accent,
}: {
  label: string;
  stats: AlgoStats;
  accent: string;
}) {
  return (
    <Card className="flex-1">
      <div className="flex items-center justify-between">
        <CardTitle>{label}</CardTitle>
        <span className={`inline-block h-2 w-2 rounded-full ${accent}`} />
      </div>
      <div className="mt-2 text-lg font-semibold">
        {formatHashrate(stats.hashRate)}
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-y-1 text-xs text-slate-900/60 dark:text-white/60">
        <dt>Difficulty</dt>
        <dd className="text-right text-slate-900/80 dark:text-white/80">{formatDifficulty(stats.difficulty)}</dd>
        <dt>Avg share</dt>
        <dd className="text-right text-slate-900/80 dark:text-white/80">{formatSeconds(stats.avgShareTime)}</dd>
        <dt>Shares / block</dt>
        <dd className="text-right text-slate-900/80 dark:text-white/80">{stats.sharesPerBlock.toFixed(2)}</dd>
      </dl>
    </Card>
  );
}

export function AlgorithmPanel() {
  const { data, isLoading } = useStats();
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {["KawPoW", "SHA-256", "Scrypt"].map((n) => (
          <Card key={n}>
            <CardTitle>{n}</CardTitle>
            <div className="mt-2 h-6 w-28 animate-pulse rounded bg-slate-900/10 dark:bg-white/10" />
          </Card>
        ))}
      </div>
    );
  }
  const { info } = data;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Tile label="KawPoW (seals blocks)" stats={info.perAlgo.kawpow} accent="bg-fuchsia-400" />
      <Tile label="SHA-256 (workshares)" stats={info.perAlgo.sha} accent="bg-amber-400" />
      <Tile label="Scrypt (workshares)" stats={info.perAlgo.scrypt} accent="bg-cyan-400" />
    </div>
  );
}
