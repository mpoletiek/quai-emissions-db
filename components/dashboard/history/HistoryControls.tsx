"use client";
import { PeriodToggle } from "./PeriodToggle";
import { RangePresets } from "./RangePresets";
import { DateRangePicker } from "./DateRangePicker";
import { useHistoryParams } from "@/lib/useHistoryParams";

export function HistoryControls() {
  const { params, setParams } = useHistoryParams();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <PeriodToggle
          value={params.period}
          onChange={(period) => setParams({ period })}
        />
        <RangePresets
          period={params.period}
          value={params.preset}
          onChange={(preset) => setParams({ preset })}
        />
        <DateRangePicker
          from={params.from}
          to={params.to}
          onChange={(from, to) => setParams({ preset: "custom", from, to })}
        />
        <span className="ml-auto text-xs text-slate-900/40 dark:text-white/40">
          UTC · {params.period} ·{" "}
          {params.preset === "custom" ? "custom" : params.preset}
        </span>
      </div>
      {params.rebaseAt && params.rebaseLabel && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs"
          style={{
            borderColor: params.rebaseColor ?? undefined,
            background: params.rebaseColor
              ? `${params.rebaseColor}12`
              : undefined,
          }}
          role="status"
        >
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: params.rebaseColor ?? undefined }}
          />
          <span className="font-medium" style={{ color: params.rebaseColor ?? undefined }}>
            Since {params.rebaseLabel} ({params.rebaseAt})
          </span>
          <span className="text-slate-900/60 dark:text-white/60">
            — cumulative charts (supply totals, supply vs burn, cumulative
            burn) are <strong>rebased to zero</strong> at this date, so every
            line starts at 0 and shows net change since the event. Per-period
            charts (bars, heatmap) are unchanged.
          </span>
        </div>
      )}
    </div>
  );
}
