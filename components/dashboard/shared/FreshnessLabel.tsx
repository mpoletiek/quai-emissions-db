"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// FreshnessLabel — small "Updated Ns ago" with a color dot. Used inline on
// chart cards and in the dashboard nav.
//
// Color rules:
//   < 30s  green
//   < 5m   amber
//   else   red
//
// `at` is the wall-clock timestamp the data was fetched (typically the
// react-query `dataUpdatedAt`). The component re-renders every second so the
// counter ticks. ARIA-live is off — screen readers shouldn't announce on every
// tick. The color dot has aria-hidden; full semantics in the visible text.

export function FreshnessLabel({
  at,
  prefix = "Updated",
  className,
}: {
  /** Epoch ms of last data update. null/undefined → "—". */
  at: number | null | undefined;
  /** Override the leading word (e.g. "Last block"). */
  prefix?: string;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!at) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-white/40",
          className,
        )}
      >
        <span
          className="inline-block h-2 w-2 rounded-full bg-slate-400 dark:bg-white/20"
          aria-hidden
        />
        <span>{prefix} —</span>
      </span>
    );
  }

  const ageMs = Math.max(0, now - at);
  const ageS = Math.floor(ageMs / 1000);

  let dot = "bg-emerald-400";
  if (ageS >= 300) dot = "bg-rose-400";
  else if (ageS >= 30) dot = "bg-amber-400";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-white/55",
        className,
      )}
    >
      <span className={cn("inline-block h-2 w-2 rounded-full", dot)} aria-hidden />
      <span>
        {prefix} {formatAge(ageS)} ago
      </span>
    </span>
  );
}

function formatAge(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}
