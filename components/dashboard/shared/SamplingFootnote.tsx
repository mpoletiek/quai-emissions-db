"use client";
import { InfoPopover } from "@/components/ui/InfoPopover";

// SamplingFootnote — info icon next to a chart title, opens a popover that
// explains the sampling regime for the metric being shown. Honest-by-default:
// every chart that uses sampled rollup columns should carry this so users
// can audit whether the number is exact or extrapolated.
//
// Variants map to the column-accuracy classes from docs/sampling.md:
//   dense        — every block ingested; sums are exact
//   extrapolated — backfill samples 1:60; ws_*_sum = avg(sample) × block_count
//   averaged     — backfill samples 1:60; mining_info already a 15-min
//                  rolling avg server-side, so per-row averages are unbiased

export type SamplingKind = "dense" | "extrapolated" | "averaged";

const COPY: Record<SamplingKind, { title: string; body: string }> = {
  dense: {
    title: "Dense data",
    body:
      "Every block in the period is ingested. Sums and counts are exact; no sampling correction applied.",
  },
  extrapolated: {
    title: "Extrapolated from samples",
    body:
      "During backfill, per-algorithm workshare counts are sampled every ~60 blocks (≈ 5 min). The period sum is the sample average × the period block count. Stable to ±1–2% with ~288 samples/day. In tail mode, every block is sampled (exact).",
  },
  averaged: {
    title: "Averaged across samples",
    body:
      "Hashrate, difficulty, and reward fields come from quai_getMiningInfo, which is itself a 15-minute trailing average. Sampling at ~5-min cadence gives near-independent samples; the period average is unbiased.",
  },
};

export function SamplingFootnote({ kind }: { kind: SamplingKind }) {
  const c = COPY[kind];
  return (
    <InfoPopover label={`Sampling: ${c.title}`}>
      <p className="font-medium">{c.title}</p>
      <p className="mt-1 text-slate-900/70 dark:text-white/70">{c.body}</p>
      <p className="mt-2 text-slate-900/50 dark:text-white/50">
        See <code>docs/sampling.md</code> for the full accuracy matrix.
      </p>
    </InfoPopover>
  );
}
