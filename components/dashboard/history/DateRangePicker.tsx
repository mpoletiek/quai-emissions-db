"use client";
import { useEffect, useRef, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

function parseIso(iso: string): Date {
  return new Date(iso + "T00:00:00Z");
}

function toIso(d: Date): string {
  // Treat calendar date as UTC date — DayPicker passes Date objects in local
  // TZ at 00:00:00, so read local Y-M-D.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const selected: DateRange = {
    from: parseIso(from),
    to: parseIso(to),
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-900/10 dark:border-white/10 bg-slate-900/[0.03] dark:bg-white/[0.03] px-2.5 text-xs text-slate-900/70 dark:text-white/70 transition hover:text-slate-900/90 dark:text-white/90",
        )}
      >
        <Calendar className="h-3.5 w-3.5" />
        <span className="hidden md:inline">
          {from} → {to}
        </span>
        <span className="inline md:hidden">Custom</span>
      </button>
      {open && (
        <div
          role="dialog"
          className="absolute right-0 top-9 z-20 rounded-xl border p-2 text-sm shadow-xl"
          style={{
            background: "var(--popover-bg)",
            borderColor: "var(--popover-border)",
            color: "var(--popover-text)",
          }}
        >
          <DayPicker
            mode="range"
            defaultMonth={selected.from}
            selected={selected}
            onSelect={(range: DateRange | undefined) => {
              if (range?.from && range?.to) {
                onChange(toIso(range.from), toIso(range.to));
                setOpen(false);
              }
            }}
            numberOfMonths={2}
            pagedNavigation
            showOutsideDays
          />
        </div>
      )}
    </div>
  );
}
