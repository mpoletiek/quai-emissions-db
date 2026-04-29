"use client";
import { cn } from "@/lib/utils";

// ChartSkeleton — loading placeholder for chart containers. Faint dashed
// gridlines plus a sweeping shimmer telegraph "data is loading" without
// the noise of a spinner or a flat grey box.
//
// The `height` prop accepts any Tailwind height utility (e.g. "h-72",
// "h-56", "h-full") so it can match the chart's exact placeholder size.
export function ChartSkeleton({
  height = "h-full",
  className,
}: {
  height?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "shimmer relative w-full overflow-hidden rounded",
        height,
        className,
      )}
      aria-hidden
    >
      {/* Faint horizontal gridlines so the skeleton reads as "a chart" */}
      <svg
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        {[20, 40, 60, 80].map((y) => (
          <line
            key={y}
            x1="0"
            x2="100"
            y1={y}
            y2={y}
            stroke="var(--chart-grid-soft)"
            strokeWidth="0.4"
            strokeDasharray="0.6 1.4"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
}
