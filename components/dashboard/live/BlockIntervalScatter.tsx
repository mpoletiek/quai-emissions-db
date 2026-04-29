"use client";
import { useMemo } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { useBlocks, useReorgs } from "@/lib/hooks";
import {
  Brush,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";

// BlockIntervalScatter — flagship for /dashboard/live.
// X axis is block number, Y axis is interval-since-prev (seconds). Reorg
// events from /api/reorgs are overlaid as red ReferenceDots at the
// diverge_from block. The scatter answers "is the chain ticking steadily?
// when did things look weird?"

export function BlockIntervalScatter({ window = 1000 }: { window?: number }) {
  const { data: blocks, isLoading, error } = useBlocks(window);
  const { data: reorgs } = useReorgs({ limit: 50 });

  const { points, range } = useMemo(() => {
    if (!blocks?.blocks || blocks.blocks.length < 2)
      return { points: [], range: { min: 0, max: 0 } };
    // Blocks are returned newest-first by the existing API; sort ascending
    // by number for the interval calculation.
    const sorted = [...blocks.blocks].sort((a, b) => a.number - b.number);
    const out: { number: number; interval: number }[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const dt = sorted[i].timestamp - sorted[i - 1].timestamp;
      out.push({ number: sorted[i].number, interval: Math.max(0, dt) });
    }
    return {
      points: out,
      range: { min: sorted[0].number, max: sorted[sorted.length - 1].number },
    };
  }, [blocks]);

  const reorgMarkers = useMemo(() => {
    if (!reorgs?.rows || range.max === 0) return [];
    return reorgs.rows
      .filter((r) => r.divergeFrom >= range.min && r.divergeFrom <= range.max)
      .map((r) => ({ x: r.divergeFrom, y: 0, note: r.note ?? r.detectionMode }));
  }, [reorgs, range]);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>Block intervals · last {window.toLocaleString()}</CardTitle>
          <p className="mt-1 max-w-md text-xs text-slate-900/80 dark:text-white/80">
            Seconds between consecutive blocks on cyprus1. Red dots mark
            reorg events at the diverging block.
          </p>
        </div>
        <InfoPopover label="About block intervals">
          <p>
            Each point is one block; <span className="font-mono">y</span> is
            seconds since the previous block.
          </p>
          <p className="mt-2">
            Steady-state cyprus1 cadence is ~5–6 s. Spikes mean a slow
            block; clusters of zeros mean rapid succession (still natural
            under PoW variance).
          </p>
          <p className="mt-2">
            Reorg markers are drawn from{" "}
            <code>reorg_log.diverge_from</code>; they sit on the time axis at
            the block where an inconsistency was detected.
          </p>
        </InfoPopover>
      </div>

      <div className="mt-4 h-72 sm:h-80">
        {isLoading || !blocks ? (
          <ChartSkeleton />
        ) : error ? (
          <div className="text-sm text-red-600 dark:text-red-300">{String(error)}</div>
        ) : points.length === 0 ? (
          <div className="text-sm text-slate-900/50 dark:text-white/50">
            Need at least 2 blocks to compute intervals.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid
                stroke="var(--chart-grid-soft)"
                strokeDasharray="2 4"
                vertical={false}
              />
              <XAxis
                type="number"
                dataKey="number"
                domain={[range.min, range.max]}
                tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                tickFormatter={(v) => `#${Number(v).toLocaleString()}`}
                tickLine={false}
                axisLine={false}
                width={80}
              />
              <YAxis
                type="number"
                dataKey="interval"
                tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                tickFormatter={(v) => `${v}s`}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <ZAxis range={[12, 12]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={
                  <ChartTooltip
                    formatter={(v, name) => {
                      if (name === "interval") return [`${v}s`, "interval"];
                      if (name === "number")
                        return [`#${Number(v).toLocaleString()}`, "block"];
                      return [v, name];
                    }}
                  />
                }
              />
              <Scatter
                name="block"
                data={points}
                fill="#3b82f6"
                fillOpacity={0.55}
              />
              {reorgMarkers.map((m) => (
                <ReferenceDot
                  key={m.x}
                  x={m.x}
                  y={m.y}
                  r={6}
                  fill="#ef4444"
                  stroke="#fff"
                  strokeWidth={1}
                  ifOverflow="extendDomain"
                />
              ))}
              <Brush
                dataKey="number"
                height={24}
                stroke="var(--chart-axis-muted)"
                travellerWidth={8}
                fill="var(--card-bg)"
                tickFormatter={(v) => "#" + Number(v).toLocaleString()}
              />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
