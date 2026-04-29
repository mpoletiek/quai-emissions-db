"use client";
import { useId } from "react";

// MiniSparkline — pure-SVG line+area sparkline. Designed for KPI cards,
// where Recharts would be massive overkill. No state, no animation, fully
// stretches via preserveAspectRatio="none".

export type MiniSparklineProps = {
  data: number[];
  color: string;
  height?: number;
  ariaLabel?: string;
  className?: string;
};

export function MiniSparkline({
  data,
  color,
  height = 56,
  ariaLabel,
  className,
}: MiniSparklineProps) {
  const gid = useId();
  const gradientId = `mini-spark-${gid}`;

  if (!data || data.length < 2) {
    return (
      <div
        style={{ height }}
        className={className}
        aria-hidden={ariaLabel ? undefined : true}
      />
    );
  }

  // Use a fixed viewBox so we can compute coordinates in a stable space and
  // let preserveAspectRatio="none" stretch us into the parent.
  const VW = 100;
  const VH = 30;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;

  const xStep = VW / (data.length - 1);

  let linePath = "";
  data.forEach((v, i) => {
    const x = i * xStep;
    const y = VH - ((v - min) / span) * VH;
    linePath += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  });

  // Area path: same line, but close down to baseline at end and back to start.
  const areaPath = `${linePath} L ${VW.toFixed(2)} ${VH} L 0 ${VH} Z`;

  return (
    <svg
      className={className}
      width="100%"
      height={height}
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="none"
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
