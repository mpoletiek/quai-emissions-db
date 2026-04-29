"use client";
import { Card, CardTitle } from "@/components/ui/Card";
import { useReorgs } from "@/lib/hooks";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { ChartSkeleton } from "@/components/ui/ChartSkeleton";

// ReorgLogTable — append-only audit of detected reorgs from migrations/0003.
// Surfacing this builds trust ("we tracked these and recovered"); hiding it
// would just look like the chain never reorgs, which is false.

export function ReorgLogTable({ limit = 25 }: { limit?: number }) {
  const { data, isLoading, error } = useReorgs({ limit });

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>Reorg log</CardTitle>
          <p className="mt-1 text-xs text-slate-900/80 dark:text-white/80">
            Detected during tail polling and backfill continuity checks.
            Routine on a live PoW chain — surfaced here for transparency.
          </p>
        </div>
        <InfoPopover label="About reorgs">
          <p>
            <span className="font-medium">tail</span>: hash mismatch on the
            last 10 blocks during the 3-second polling tick. We rewind and
            re-ingest.
          </p>
          <p className="mt-2">
            <span className="font-medium">backfill_continuity</span>: the
            first block of a backfill chunk's parent hash didn't match what
            we'd stored for the previous block. We rewind, log, and continue.
          </p>
          <p className="mt-2 text-slate-900/55 dark:text-white/55">
            See <code>reorg_log</code> in <code>migrations/0003</code>.
          </p>
        </InfoPopover>
      </div>

      <div className="mt-3 overflow-x-auto">
        {isLoading ? (
          <ChartSkeleton height="h-32" />
        ) : error ? (
          <div className="text-sm text-red-600 dark:text-red-300">{String(error)}</div>
        ) : !data || data.rows.length === 0 ? (
          <div className="text-sm text-slate-900/50 dark:text-white/50">
            No reorgs logged.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-900/55 dark:text-white/55">
              <tr>
                <th className="py-2 font-medium">Detected at</th>
                <th className="py-2 font-medium">Mode</th>
                <th className="py-2 font-medium">Diverge from</th>
                <th className="py-2 font-medium">Cursor before</th>
                <th className="py-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-slate-900/5 dark:border-white/5"
                >
                  <td className="py-1.5 font-mono text-xs">
                    {new Date(r.detectedAt).toISOString().replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="py-1.5 text-xs">{r.detectionMode}</td>
                  <td className="py-1.5 font-mono">
                    #{r.divergeFrom.toLocaleString()}
                  </td>
                  <td className="py-1.5 font-mono text-slate-900/55 dark:text-white/55">
                    #{r.cursorBefore.toLocaleString()}
                  </td>
                  <td className="py-1.5 text-xs text-slate-900/65 dark:text-white/65">
                    {r.note ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
