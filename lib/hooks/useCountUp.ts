"use client";
import { useEffect, useRef, useState } from "react";

// useCountUp — tweens a numeric display value toward `value` over `durationMs`.
// Uses requestAnimationFrame with an ease-out cubic curve. Respects
// prefers-reduced-motion (returns the target instantly). Skips animation
// entirely when `value` does not change between renders, avoiding pointless
// retriggers on parent re-renders.

export type UseCountUpOptions = {
  durationMs?: number;
  precision?: number;
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useCountUp(
  value: number,
  opts: UseCountUpOptions = {},
): number {
  const { durationMs = 250, precision } = opts;
  const [display, setDisplay] = useState<number>(value);
  const prevTargetRef = useRef<number>(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevTargetRef.current === value) return;

    if (prefersReducedMotion() || !Number.isFinite(value)) {
      prevTargetRef.current = value;
      setDisplay(value);
      return;
    }

    const start = prevTargetRef.current;
    const delta = value - start;
    const startTs =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    prevTargetRef.current = value;

    const tick = (now: number) => {
      const elapsed = now - startTs;
      const t = Math.min(1, elapsed / durationMs);
      const eased = easeOutCubic(t);
      let next = start + delta * eased;
      if (precision != null) {
        const p = Math.pow(10, precision);
        next = Math.round(next * p) / p;
      }
      setDisplay(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [value, durationMs, precision]);

  return display;
}
