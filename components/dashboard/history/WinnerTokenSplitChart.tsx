"use client";
import { useMemo, useState } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { useRollups } from "@/lib/hooks";
import { useHistoryParams } from "@/lib/useHistoryParams";
import {
  formatCompact,
  formatPeriodDate,
  qitsToFloat,
  weiToFloat,
} from "@/lib/format";
import { PROTOCOL_EVENTS } from "./ProtocolEventLines";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";

const CELL = 14;
const GAP = 3;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type ProtocolEvent = (typeof PROTOCOL_EVENTS)[number];

type Cell = {
  date: string;
  row: number;
  col: number;
  quaiWinCount: number;
  qiWinCount: number;
  blockCount: number;
  quaiReward: number;
  qiReward: number;
  dominant: "quai" | "qi" | null;
  intensity: number;
  event?: ProtocolEvent;
};

function isoToUTC(iso: string): number {
  return Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)),
  );
}

function weekdayIndex(iso: string): number {
  return new Date(isoToUTC(iso)).getUTCDay();
}

function daysBetween(a: string, b: string): number {
  return Math.floor((isoToUTC(a) - isoToUTC(b)) / 86_400_000);
}

function cellBg(c: Cell): string {
  if (c.dominant === null) return "rgba(148, 163, 184, 0.12)";
  const alpha = 0.15 + c.intensity * 0.85;
  return c.dominant === "quai"
    ? `rgba(59, 130, 246, ${alpha})`
    : `rgba(16, 185, 129, ${alpha})`;
}

export function WinnerTokenSplitChart() {
  const { params } = useHistoryParams();
  const { data: rows, isLoading, error } = useRollups({
    period: params.period,
    from: params.from,
    to: params.to,
  });
  const [hover, setHover] = useState<
    { cell: Cell; x: number; y: number } | null
  >(null);

  const { cells, gridRows, gridCols, colLabels } = useMemo(() => {
    if (!rows || rows.length === 0) {
      return {
        cells: [] as Cell[],
        gridRows: params.period === "day" ? 7 : 1,
        gridCols: 0,
        colLabels: [] as { col: number; label: string }[],
      };
    }

    let quaiMax = 0;
    let qiMax = 0;
    for (const r of rows) {
      const q = weiToFloat(r.quaiAddedSum, 2);
      const qi = qitsToFloat(r.qiAddedSum, 3);
      if (q > quaiMax) quaiMax = q;
      if (qi > qiMax) qiMax = qi;
    }

    const firstDate = rows[0].periodStart;
    const firstWeekday = weekdayIndex(firstDate);
    let gridRows = params.period === "day" ? 7 : 1;
    let gridCols = 0;

    const cells: Cell[] = rows.map((r, idx) => {
      const q = weiToFloat(r.quaiAddedSum, 2);
      const qi = qitsToFloat(r.qiAddedSum, 3);
      const qWin = r.winnerQuaiCount;
      const qiWin = r.winnerQiCount;
      const bc = r.blockCount;

      let dominant: Cell["dominant"] = null;
      if (bc > 0) {
        if (qWin > qiWin) dominant = "quai";
        else if (qiWin > qWin) dominant = "qi";
        else dominant = q >= qi ? "quai" : "qi";
      }

      const intensity =
        dominant === "quai"
          ? quaiMax > 0 ? q / quaiMax : 0
          : dominant === "qi"
            ? qiMax > 0 ? qi / qiMax : 0
            : 0;

      let row = 0;
      let col = idx;
      if (params.period === "day") {
        row = weekdayIndex(r.periodStart);
        const offset = daysBetween(r.periodStart, firstDate) + firstWeekday;
        col = Math.floor(offset / 7);
      }
      if (col + 1 > gridCols) gridCols = col + 1;

      const event = PROTOCOL_EVENTS.find((e) => {
        if (params.period === "day") return e.date === r.periodStart;
        if (params.period === "week") {
          const d = daysBetween(e.date, r.periodStart);
          return d >= 0 && d < 7;
        }
        return e.date.slice(0, 7) === r.periodStart.slice(0, 7);
      });

      return {
        date: r.periodStart,
        row,
        col,
        quaiWinCount: qWin,
        qiWinCount: qiWin,
        blockCount: bc,
        quaiReward: q,
        qiReward: qi,
        dominant,
        intensity,
        event,
      };
    });

    // Column labels — one per month boundary for day/week, one per year boundary for month.
    const colLabels: { col: number; label: string }[] = [];
    let lastLabel = "";
    for (const c of cells) {
      const key =
        params.period === "month"
          ? c.date.slice(0, 4)
          : c.date.slice(0, 7);
      if (key !== lastLabel) {
        lastLabel = key;
        const label =
          params.period === "month"
            ? c.date.slice(0, 4)
            : new Date(isoToUTC(c.date)).toLocaleDateString(undefined, {
                month: "short",
                timeZone: "UTC",
              });
        // Deduplicate: only keep first sighting per column.
        if (!colLabels.some((l) => l.col === c.col)) {
          colLabels.push({ col: c.col, label });
        }
      }
    }

    return { cells, gridRows, gridCols, colLabels };
  }, [rows, params.period]);

  if (isLoading || !rows) {
    return (
      <Card>
        <CardTitle>Blocks won by token · reward heatmap</CardTitle>
        <ChartSkeleton height="h-64" className="mt-4" />
      </Card>
    );
  }
  if (error) {
    return (
      <Card>
        <CardTitle>Blocks won by token · reward heatmap</CardTitle>
        <div className="mt-4 text-sm text-red-600 dark:text-red-300">
          {String(error)}
        </div>
      </Card>
    );
  }
  if (rows.length === 0) {
    return (
      <Card>
        <CardTitle>Blocks won by token · reward heatmap</CardTitle>
        <div className="mt-4 text-sm text-slate-900/50 dark:text-white/50">
          No rollup data in this range.
        </div>
      </Card>
    );
  }

  const gridWidth = gridCols * CELL + (gridCols - 1) * GAP;
  const gridHeight = gridRows * CELL + (gridRows - 1) * GAP;
  const weekdayColWidth = params.period === "day" ? 28 : 0;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>
          Blocks won by token · reward heatmap ({params.period})
        </CardTitle>
        <InfoPopover label="About the reward heatmap">
          <p className="mb-2">
            Each cell is one {params.period}. Hue encodes the winner majority
            (blue = QUAI, green = QI). Shade encodes the dominant token&apos;s
            reward that period, normalized to its max in the visible range.
          </p>
          <p className="mb-2">
            Protocol events are drawn as colored outlines on the cells whose
            period contains them.
          </p>
          <p>
            Winner is inferred from the primary-coinbase ledger — QUAI-ledger
            coinbases that receive QI-minting blocks show up as QUAI winners,
            which undercounts QI.
          </p>
        </InfoPopover>
      </div>

      <div
        className="relative mt-3 overflow-x-auto"
        onMouseLeave={() => setHover(null)}
      >
        {/* Column labels */}
        {colLabels.length > 0 && (
          <div
            className="relative text-[10px] text-slate-900/50 dark:text-white/50"
            style={{
              marginLeft: weekdayColWidth,
              width: gridWidth,
              height: 14,
            }}
          >
            {colLabels.map((l) => (
              <span
                key={l.col}
                className="absolute whitespace-nowrap"
                style={{ left: l.col * (CELL + GAP) }}
              >
                {l.label}
              </span>
            ))}
          </div>
        )}

        <div className="flex">
          {/* Weekday labels (daily only) */}
          {params.period === "day" && (
            <div
              className="flex flex-col text-[10px] text-slate-900/50 dark:text-white/50"
              style={{
                width: weekdayColWidth,
                gap: GAP,
                paddingTop: 0,
              }}
            >
              {WEEKDAY_LABELS.map((w, i) => (
                <div
                  key={w}
                  style={{
                    height: CELL,
                    lineHeight: `${CELL}px`,
                    visibility: i % 2 === 1 ? "visible" : "hidden",
                  }}
                >
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* Grid */}
          <div
            role="img"
            aria-label={`Reward heatmap of blocks won per ${params.period} from ${params.from} to ${params.to}. Blue = QUAI-winner majority, green = QI-winner majority, shade = dominant token reward.`}
            style={{
              display: "grid",
              gridTemplateRows: `repeat(${gridRows}, ${CELL}px)`,
              gridTemplateColumns: `repeat(${gridCols}, ${CELL}px)`,
              gap: GAP,
              width: gridWidth,
              height: gridHeight,
              gridAutoFlow: "column",
            }}
          >
            {cells.map((c) => (
              <button
                key={c.date}
                type="button"
                aria-label={`${formatPeriodDate(c.date)} — ${c.blockCount} blocks`}
                onMouseEnter={(e) => {
                  const r = (e.target as HTMLElement).getBoundingClientRect();
                  setHover({ cell: c, x: r.left + r.width / 2, y: r.top });
                }}
                onFocus={(e) => {
                  const r = (e.target as HTMLElement).getBoundingClientRect();
                  setHover({ cell: c, x: r.left + r.width / 2, y: r.top });
                }}
                onBlur={() => setHover(null)}
                style={{
                  gridRow: c.row + 1,
                  gridColumn: c.col + 1,
                  width: CELL,
                  height: CELL,
                  borderRadius: 2,
                  backgroundColor: cellBg(c),
                  outline: c.event ? `2px solid ${c.event.color}` : undefined,
                  outlineOffset: c.event ? -1 : undefined,
                  border: 0,
                  padding: 0,
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-900/60 dark:text-white/60">
          <LegendGradient
            label="QUAI winner"
            from="rgba(59, 130, 246, 0.15)"
            to="rgba(59, 130, 246, 1)"
          />
          <LegendGradient
            label="QI winner"
            from="rgba(16, 185, 129, 0.15)"
            to="rgba(16, 185, 129, 1)"
          />
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: "rgba(148, 163, 184, 0.12)" }}
              aria-hidden
            />
            No data
          </span>
          {cells.some((c) => c.event) && (
            <span className="text-slate-900/40 dark:text-white/40">
              Outlined cells mark protocol events.
            </span>
          )}
        </div>
      </div>

      {hover && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border px-3 py-2 text-xs shadow-xl"
          style={{
            left: hover.x,
            top: hover.y - 8,
            transform: "translate(-50%, -100%)",
            background: "var(--chart-tooltip-bg)",
            color: "var(--chart-tooltip-text)",
            borderColor: "var(--chart-tooltip-border)",
          }}
        >
          <div className="font-medium">{formatPeriodDate(hover.cell.date)}</div>
          <div className="mt-1 tabular-nums">
            QUAI issued: {formatCompact(hover.cell.quaiReward)}
          </div>
          <div className="tabular-nums">
            QI issued: {formatCompact(hover.cell.qiReward)}
          </div>
          <div className="mt-1 tabular-nums">
            Blocks: {hover.cell.blockCount.toLocaleString()} (QUAI{" "}
            {hover.cell.quaiWinCount.toLocaleString()} / QI{" "}
            {hover.cell.qiWinCount.toLocaleString()})
          </div>
          {hover.cell.event && (
            <div className="mt-1" style={{ color: hover.cell.event.color }}>
              Event: {hover.cell.event.label}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 text-xs text-slate-900/40 dark:text-white/40">
        Hue = winner-majority token (blue QUAI / green QI, tiebreak by reward
        size). Shade = dominant token&apos;s reward (
        <code className="text-slate-900/60 dark:text-white/60">quai_added_sum</code>
        /
        <code className="text-slate-900/60 dark:text-white/60">qi_added_sum</code>
        ) normalized to its max in the visible range. Protocol events appear as
        colored outlines on their containing period.
      </div>
    </Card>
  );
}

function LegendGradient({
  label,
  from,
  to,
}: {
  label: string;
  from: string;
  to: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-3 w-16 rounded-sm"
        style={{ background: `linear-gradient(to right, ${from}, ${to})` }}
        aria-hidden
      />
      {label}
    </span>
  );
}
