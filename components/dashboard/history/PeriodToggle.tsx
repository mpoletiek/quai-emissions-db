"use client";
import { cn } from "@/lib/utils";
import type { Period } from "@/lib/useHistoryParams";

const OPTIONS: { value: Period; label: string; title: string }[] = [
  { value: "day", label: "D", title: "Daily" },
  { value: "week", label: "W", title: "Weekly" },
  { value: "month", label: "M", title: "Monthly" },
];

export function PeriodToggle({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-slate-900/10 dark:border-white/10 bg-slate-900/[0.03] dark:bg-white/[0.03] p-1">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          title={o.title}
          aria-label={o.title}
          aria-pressed={value === o.value}
          className={cn(
            "w-8 rounded px-2 py-1 text-xs font-medium transition",
            value === o.value
              ? "bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white"
              : "text-slate-900/60 dark:text-white/60 hover:text-slate-900/90 dark:text-white/90",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
