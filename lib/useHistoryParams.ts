"use client";
import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { EventPreset, Period, RangePreset } from "@/lib/quai/types";
import { useRollupsMeta } from "@/lib/hooks";
import {
  PROTOCOL_EVENTS,
  findProtocolEvent,
} from "@/components/dashboard/history/ProtocolEventLines";

export type { Period, RangePreset };

export type HistoryParams = {
  period: Period;
  preset: RangePreset;
  from: string; // ISO YYYY-MM-DD (UTC)
  to: string;   // ISO YYYY-MM-DD (UTC)
  /**
   * When non-null, cumulative charts should rebase their series to zero at
   * this ISO date. Set automatically by `since-<event>` presets; `null` for
   * date-range presets and custom ranges.
   */
  rebaseAt: string | null;
  rebaseLabel: string | null;
  rebaseColor: string | null;
};

function todayUtcIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function startOfYearIso(): string {
  return `${new Date().getUTCFullYear()}-01-01`;
}

function validPeriod(s: string | null): Period {
  return s === "day" || s === "week" || s === "month" ? s : "day";
}

function parseEventPreset(s: string | null): EventPreset | null {
  if (!s || !s.startsWith("since-")) return null;
  const slug = s.slice("since-".length);
  return findProtocolEvent(slug) ? (s as EventPreset) : null;
}

function validPreset(
  s: string | null,
): Exclude<RangePreset, "custom"> | null {
  switch (s) {
    case "7d":
    case "30d":
    case "90d":
    case "ytd":
    case "1y":
    case "all":
      return s;
  }
  const ev = parseEventPreset(s);
  return ev;
}

function validIsoDate(s: string | null): string | null {
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function disabledPresets(period: Period): Set<RangePreset> {
  if (period === "week") return new Set<RangePreset>(["7d"]);
  if (period === "month") return new Set<RangePreset>(["7d", "30d", "90d"]);
  return new Set();
}

export function isPresetDisabled(period: Period, preset: RangePreset): boolean {
  if (typeof preset === "string" && preset.startsWith("since-")) {
    const ev = findProtocolEvent(preset.slice("since-".length));
    if (!ev) return true;
    // Disable event presets whose date is in the future.
    return ev.date > todayUtcIso();
  }
  return disabledPresets(period).has(preset);
}

function promotePreset(period: Period, preset: RangePreset): RangePreset {
  if (!disabledPresets(period).has(preset)) return preset;
  if (period === "week") return "30d";
  if (period === "month") return "1y";
  return preset;
}

// Resolve a preset to concrete from/to dates. "all" needs rollups meta
// (`earliestRollup`); when it hasn't loaded yet we degrade to a 1-year window
// so charts render something coherent rather than a broken/empty range.
function resolvePreset(
  preset: Exclude<RangePreset, "custom">,
  earliestRollup?: string | null,
): { from: string; to: string } {
  const to = todayUtcIso();
  if (typeof preset === "string" && preset.startsWith("since-")) {
    const ev = findProtocolEvent(preset.slice("since-".length));
    return { from: ev?.date ?? addDaysIso(to, -365), to };
  }
  switch (preset) {
    case "7d":
      return { from: addDaysIso(to, -7), to };
    case "30d":
      return { from: addDaysIso(to, -30), to };
    case "90d":
      return { from: addDaysIso(to, -90), to };
    case "1y":
      return { from: addDaysIso(to, -365), to };
    case "ytd":
      return { from: startOfYearIso(), to };
    case "all":
      return { from: earliestRollup ?? addDaysIso(to, -365), to };
  }
  return { from: addDaysIso(to, -30), to };
}

function rebaseFromPreset(preset: RangePreset): {
  rebaseAt: string | null;
  rebaseLabel: string | null;
  rebaseColor: string | null;
} {
  if (typeof preset === "string" && preset.startsWith("since-")) {
    const ev = findProtocolEvent(preset.slice("since-".length));
    if (ev) {
      return {
        rebaseAt: ev.date,
        rebaseLabel: ev.label,
        rebaseColor: ev.color,
      };
    }
  }
  return { rebaseAt: null, rebaseLabel: null, rebaseColor: null };
}

export function useHistoryParams(): {
  params: HistoryParams;
  setParams: (next: Partial<HistoryParams>) => void;
  isPresetDisabled: (preset: RangePreset) => boolean;
} {
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();
  const { data: meta } = useRollupsMeta();
  const earliestRollup = meta?.earliestRollup ?? null;

  const params = useMemo<HistoryParams>(() => {
    const period = validPeriod(sp.get("period"));
    const from = validIsoDate(sp.get("from"));
    const to = validIsoDate(sp.get("to"));
    if (from && to) {
      return {
        period,
        preset: "custom",
        from,
        to,
        rebaseAt: null,
        rebaseLabel: null,
        rebaseColor: null,
      };
    }
    const preset = validPreset(sp.get("range")) ?? "30d";
    const promoted = promotePreset(period, preset);
    const resolved = resolvePreset(
      promoted as Exclude<RangePreset, "custom">,
      earliestRollup,
    );
    return {
      period,
      preset: promoted,
      ...resolved,
      ...rebaseFromPreset(promoted),
    };
  }, [sp, earliestRollup]);

  const setParams = useCallback(
    (next: Partial<HistoryParams>) => {
      const period = next.period ?? params.period;
      let preset = next.preset ?? params.preset;
      preset = promotePreset(period, preset);

      const q = new URLSearchParams();
      q.set("period", period);
      if (preset === "custom") {
        q.set("from", next.from ?? params.from);
        q.set("to", next.to ?? params.to);
      } else {
        q.set("range", preset);
      }
      router.replace(`${pathname}?${q.toString()}`);
    },
    [pathname, router, params],
  );

  const isDisabled = useCallback(
    (preset: RangePreset) => isPresetDisabled(params.period, preset),
    [params.period],
  );

  return { params, setParams, isPresetDisabled: isDisabled };
}

export { PROTOCOL_EVENTS };
