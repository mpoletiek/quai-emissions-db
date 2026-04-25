"use client";
import { useHistoryParams } from "@/lib/useHistoryParams";
import { PROTOCOL_EVENTS } from "./ProtocolEventLines";

/**
 * Page-level legend explaining the dashed reference lines drawn on every
 * history chart. Shows only events that fall inside the visible range so the
 * legend matches what's actually rendered.
 */
export function ProtocolEventsLegend() {
  const { params } = useHistoryParams();
  const visible = PROTOCOL_EVENTS.filter(
    (e) => e.date >= params.from && e.date <= params.to,
  );
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-900/5 dark:border-white/5 bg-slate-900/[0.02] dark:bg-white/[0.02] px-3 py-2 text-xs text-slate-900/50 dark:text-white/50">
      <span className="text-slate-900/40 dark:text-white/40">Protocol events:</span>
      {visible.map((e) => (
        <span key={e.date} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-0 w-4 border-t border-dashed"
            style={{ borderColor: e.color }}
            aria-hidden
          />
          <span style={{ color: e.color }}>{e.label}</span>
          <span className="text-slate-900/40 dark:text-white/40">{e.date}</span>
        </span>
      ))}
    </div>
  );
}
