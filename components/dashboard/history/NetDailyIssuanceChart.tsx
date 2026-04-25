"use client";
import { useState } from "react";
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
import { cn } from "@/lib/utils";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ProtocolEventLines } from "./ProtocolEventLines";

type TokenFilter = "both" | "quai" | "qi";

const TOKEN_OPTIONS: { value: TokenFilter; label: string }[] = [
  { value: "both", label: "Both" },
  { value: "quai", label: "QUAI" },
  { value: "qi", label: "QI" },
];

export function NetDailyIssuanceChart() {
  const { params } = useHistoryParams();
  const [tokenFilter, setTokenFilter] = useState<TokenFilter>("both");
  const { data: rows, isLoading, error } = useRollups({
    period: params.period,
    from: params.from,
    to: params.to,
  });
  const showQuai = tokenFilter !== "qi";
  const showQi = tokenFilter !== "quai";

  if (isLoading || !rows) {
    return (
      <Card>
        <CardTitle>Net issuance per {params.period}</CardTitle>
        <div className="mt-4 h-64 animate-pulse rounded bg-slate-900/5 dark:bg-white/5" />
      </Card>
    );
  }
  if (error) {
    return (
      <Card>
        <CardTitle>Net issuance per {params.period}</CardTitle>
        <div className="mt-4 text-sm text-red-600 dark:text-red-300">{String(error)}</div>
      </Card>
    );
  }
  if (rows.length === 0) {
    return (
      <Card>
        <CardTitle>Net issuance per {params.period}</CardTitle>
        <div className="mt-4 text-sm text-slate-900/50 dark:text-white/50">
          No rollup data in this range.
        </div>
      </Card>
    );
  }

  // Split each token into positive/negative series so each color is a real
  // Bar with its own Legend entry and hover target. `null` (not 0) keeps the
  // tooltip from showing "0" entries for the inactive sign each period.
  const data = rows.map((r) => {
    const quai = weiToFloat(r.quaiNetEmitted, 2);
    const qi = qitsToFloat(r.qiNetEmitted, 3);
    return {
      date: r.periodStart,
      quaiPos: quai >= 0 ? quai : null,
      quaiNeg: quai < 0 ? quai : null,
      qiPos: qi >= 0 ? qi : null,
      qiNeg: qi < 0 ? qi : null,
    };
  });

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <CardTitle>
          {tokenFilter === "both"
            ? `Net issuance per ${params.period}`
            : tokenFilter === "quai"
              ? `Net QUAI issuance per ${params.period}`
              : `Net QI issuance per ${params.period}`}
        </CardTitle>
        <div className="flex items-center gap-2">
          <div
            role="tablist"
            aria-label="Token filter"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-900/10 dark:border-white/10 bg-slate-900/[0.03] dark:bg-white/[0.03] p-1"
          >
            {TOKEN_OPTIONS.map((o) => {
              const active = tokenFilter === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTokenFilter(o.value)}
                  className={cn(
                    "rounded px-2.5 py-0.5 text-xs font-medium transition",
                    active &&
                      "bg-slate-900/10 dark:bg-white/10 text-slate-900 dark:text-white",
                    !active &&
                      "text-slate-900/60 dark:text-white/60 hover:text-slate-900/90 dark:text-white/90",
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          <InfoPopover label="About net issuance">
          <p className="mb-2">
            Net ={" "}
            <code className="text-slate-900/60 dark:text-white/60">quai_net_emitted</code> (issued −
            debited) per period.
          </p>
          <p>
            <strong className="text-slate-900/90 dark:text-white/90">Not</strong> adjusted for SOAP
            burn — that&apos;s a separate cumulative chart. For supply change
            after burn, use the KPI strip&apos;s &quot;Net QUAI issuance&quot;.
          </p>
          </InfoPopover>
        </div>
      </div>
      <div
        className="mt-3 h-64"
        role="img"
        aria-label={`Bar chart of net ${
          tokenFilter === "both"
            ? "QUAI and QI"
            : tokenFilter === "quai"
              ? "QUAI"
              : "QI"
        } issuance per ${params.period} from ${params.from} to ${params.to}, negative values in red/orange`}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
              tickFormatter={formatPeriodDate}
              minTickGap={40}
            />
            {showQuai && (
              <YAxis
                yAxisId="quai"
                tick={{ fill: "rgba(59,130,246,0.8)", fontSize: 11 }}
                width={60}
                tickFormatter={formatCompact}
              />
            )}
            {showQi && (
              <YAxis
                yAxisId="qi"
                orientation={showQuai ? "right" : "left"}
                tick={{ fill: "rgba(16,185,129,0.9)", fontSize: 11 }}
                width={60}
                tickFormatter={formatCompact}
              />
            )}
            <Tooltip
              contentStyle={{
                background: "var(--chart-tooltip-bg)",
                color: "var(--chart-tooltip-text)",
                border: "1px solid var(--chart-tooltip-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(v) => formatPeriodDate(String(v))}
              formatter={(v, name) => [Number(v).toLocaleString(), String(name)]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "var(--chart-axis)" }}
            />
            <ReferenceLine
              yAxisId={showQuai ? "quai" : "qi"}
              y={0}
              stroke="var(--chart-reference-line)"
            />
            <ProtocolEventLines
              visibleFrom={params.from}
              visibleTo={params.to}
              yAxisId={showQuai ? "quai" : "qi"}
            />
            {/* stackId makes positive/negative share the same x-slot per period
                (they're mutually exclusive via the null-gating in `data`). */}
            {showQuai && (
              <Bar
                yAxisId="quai"
                dataKey="quaiPos"
                name="QUAI net (positive)"
                fill="#3b82f6"
                stackId="quai"
              />
            )}
            {showQuai && (
              <Bar
                yAxisId="quai"
                dataKey="quaiNeg"
                name="QUAI net (negative)"
                fill="#ef4444"
                stackId="quai"
              />
            )}
            {showQi && (
              <Bar
                yAxisId="qi"
                dataKey="qiPos"
                name="QI net (positive)"
                fill="#10b981"
                stackId="qi"
              />
            )}
            {showQi && (
              <Bar
                yAxisId="qi"
                dataKey="qiNeg"
                name="QI net (negative)"
                fill="#f97316"
                stackId="qi"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-xs text-slate-900/40 dark:text-white/40">
        Net = issued − debited per period. <em>Not</em> adjusted for SOAP burn —
        that&apos;s a separate chart shipping in PR3. Red/orange bars indicate
        negative net flow.
      </div>
    </Card>
  );
}
