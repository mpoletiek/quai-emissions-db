"use client";
import { cn } from "@/lib/utils";

export const WINDOW_OPTIONS = [500, 2000, 10_000] as const;
export type WindowSize = (typeof WINDOW_OPTIONS)[number];

export function WindowSelector({
  value,
  onChange,
}: {
  value: WindowSize;
  onChange: (v: WindowSize) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-slate-900/10 dark:border-white/10 bg-slate-900/[0.03] dark:bg-white/[0.03] p-1">
      {WINDOW_OPTIONS.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            "rounded px-3 py-1 text-xs font-medium transition",
            opt === value
              ? "bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white"
              : "text-slate-900/60 dark:text-white/60 hover:text-slate-900/90 dark:text-white/90",
          )}
          type="button"
        >
          {opt.toLocaleString()}
          <span className="ml-1 text-slate-900/40 dark:text-white/40">blocks</span>
        </button>
      ))}
    </div>
  );
}
