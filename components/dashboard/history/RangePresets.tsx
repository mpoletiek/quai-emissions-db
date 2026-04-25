"use client";
import { cn } from "@/lib/utils";
import type { Period, RangePreset } from "@/lib/useHistoryParams";
import { isPresetDisabled } from "@/lib/useHistoryParams";
import { PROTOCOL_EVENTS } from "./ProtocolEventLines";

const OPTIONS: { value: Exclude<RangePreset, "custom">; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "ytd", label: "YTD" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
];

export function RangePresets({
  period,
  value,
  onChange,
}: {
  period: Period;
  value: RangePreset;
  onChange: (p: RangePreset) => void;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-1 rounded-lg border border-slate-900/10 dark:border-white/10 bg-slate-900/[0.03] dark:bg-white/[0.03] p-1">
        {OPTIONS.map((o) => {
          const disabled = isPresetDisabled(period, o.value);
          const active = value === o.value && !disabled;
          return (
            <button
              key={o.value}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onChange(o.value)}
              aria-pressed={active}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition",
                active &&
                  "bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white",
                !active && !disabled && "text-slate-900/60 dark:text-white/60 hover:text-slate-900/90 dark:text-white/90",
                disabled && "cursor-not-allowed text-slate-900/20 dark:text-white/20",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      <div className="inline-flex items-center gap-1 rounded-lg border border-slate-900/10 dark:border-white/10 bg-slate-900/[0.03] dark:bg-white/[0.03] p-1">
        <span className="px-2 text-[10px] uppercase tracking-wide text-slate-900/40 dark:text-white/40">
          Since event
        </span>
        {PROTOCOL_EVENTS.map((ev) => {
          const presetVal: RangePreset = `since-${ev.slug}` as const;
          const disabled = isPresetDisabled(period, presetVal);
          const active = value === presetVal && !disabled;
          return (
            <button
              key={ev.slug}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onChange(presetVal)}
              aria-pressed={active}
              title={`Zero charts at ${ev.label} (${ev.date}) through today — cumulative series rebased`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition",
                active &&
                  "bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white",
                !active && !disabled && "text-slate-900/60 dark:text-white/60 hover:text-slate-900/90 dark:text-white/90",
                disabled && "cursor-not-allowed text-slate-900/20 dark:text-white/20",
              )}
            >
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: ev.color }}
              />
              {ev.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
