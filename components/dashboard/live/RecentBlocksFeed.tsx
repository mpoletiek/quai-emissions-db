"use client";
import { useEffect, useMemo, useRef } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { useBlocks } from "@/lib/hooks";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";

// RecentBlocksFeed — table of the last N blocks. Auto-refreshes via the
// existing useBlocks hook (60s). Column set is intentionally narrow: block
// number, age, winner token, coinbase short, workshare count. Anything
// richer (full hash, parent hash) belongs in a per-block detail page.

export function RecentBlocksFeed({ limit = 20 }: { limit?: number }) {
  const { data, isLoading, error } = useBlocks(limit);

  // Track the previous max block number across renders so we can mark
  // freshly arrived rows. The "first run" guard ensures the initial mount
  // doesn't flash every row — we capture the max on the first useEffect
  // tick before any flash logic considers them fresh.
  const prevMaxRef = useRef<number>(0);
  const hasInitRef = useRef<boolean>(false);

  const rows = useMemo(() => {
    if (!data?.blocks) return [];
    // Newest first, capped at `limit`.
    return [...data.blocks].sort((a, b) => b.number - a.number).slice(0, limit);
  }, [data, limit]);

  // Snapshot the previous max at render time (for this render's freshness
  // decisions). On initial mount we treat everything as not-fresh.
  const prevMaxAtRender = hasInitRef.current ? prevMaxRef.current : Infinity;

  useEffect(() => {
    if (!data?.blocks || data.blocks.length === 0) return;
    const maxNow = data.blocks.reduce(
      (acc, b) => (b.number > acc ? b.number : acc),
      0,
    );
    prevMaxRef.current = maxNow;
    hasInitRef.current = true;
  }, [data?.blocks]);

  return (
    <Card>
      <CardTitle>Recent blocks</CardTitle>
      <p className="mt-1 text-xs text-slate-900/80 dark:text-white/80">
        Last {limit} blocks on cyprus1. Refreshes every minute.
      </p>

      <div className="mt-3 overflow-x-auto">
        {isLoading ? (
          <ChartSkeleton height="h-32" />
        ) : error ? (
          <div className="text-sm text-red-600 dark:text-red-300">{String(error)}</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-slate-900/50 dark:text-white/50">
            No blocks yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-900/55 dark:text-white/55">
              <tr>
                <th className="py-2 font-medium">Block</th>
                <th className="py-2 font-medium">Age</th>
                <th className="py-2 font-medium">Winner</th>
                <th className="py-2 font-medium">Coinbase</th>
                <th className="py-2 text-right font-medium">Workshares</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const ageS = Math.max(0, Math.floor(Date.now() / 1000 - b.timestamp));
                const isFresh = b.number > prevMaxAtRender;
                return (
                  <tr
                    key={b.number}
                    data-fresh={isFresh ? "true" : undefined}
                    className="border-t border-slate-900/5 dark:border-white/5"
                  >
                    <td className="py-1.5 font-mono">
                      #{b.number.toLocaleString()}
                    </td>
                    <td className="py-1.5 text-slate-900/65 dark:text-white/65">
                      {formatAge(ageS)}
                    </td>
                    <td className="py-1.5">
                      <WinnerBadge token={b.winnerToken} />
                    </td>
                    <td className="py-1.5 font-mono text-xs">
                      {shortenAddress(b.primaryCoinbase)}
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      {b.workshareCount.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}

function WinnerBadge({ token }: { token: "QUAI" | "QI" }) {
  const isQuai = token === "QUAI";
  return (
    <span
      className={
        isQuai
          ? "inline-flex items-center rounded-full bg-blue-500/15 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-200"
          : "inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-200"
      }
    >
      {token}
    </span>
  );
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length <= 12) return addr || "—";
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function formatAge(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d`;
}
