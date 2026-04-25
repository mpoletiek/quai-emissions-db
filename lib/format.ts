import { WEI_PER_TOKEN } from "./quai/constants";

// Qi uses 3 decimals per quais.formatQi() — 1 Qi = 1000 qits.
const QITS_PER_QI = 1000;

export function weiToFloat(wei: bigint, decimals = 4): number {
  if (wei === 0n) return 0;
  const negative = wei < 0n;
  const abs = negative ? -wei : wei;
  const whole = abs / WEI_PER_TOKEN;
  const frac = abs % WEI_PER_TOKEN;
  const combined = Number(whole) + Number(frac) / 1e18;
  const rounded = Number(combined.toFixed(decimals));
  return negative ? -rounded : rounded;
}

/**
 * Convert Qi base units (qits) to a float Qi value.
 * Qi uses 3 decimals: 1 QI = 1000 qits.
 */
export function qitsToFloat(qits: bigint, decimals = 3): number {
  if (qits === 0n) return 0;
  const negative = qits < 0n;
  const abs = negative ? -qits : qits;
  const whole = abs / BigInt(QITS_PER_QI);
  const frac = abs % BigInt(QITS_PER_QI);
  const combined = Number(whole) + Number(frac) / QITS_PER_QI;
  const rounded = Number(combined.toFixed(decimals));
  return negative ? -rounded : rounded;
}

export function formatQi(qits: bigint, decimals = 3): string {
  const v = qitsToFloat(qits, decimals);
  return `${v.toLocaleString(undefined, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: Math.min(2, decimals),
  })} QI`;
}

export function formatBigQi(qits: bigint): string {
  const v = qitsToFloat(qits, 0);
  return `${v.toLocaleString()} QI`;
}

export function formatToken(
  wei: bigint,
  symbol: string,
  decimals = 4,
): string {
  const v = weiToFloat(wei, decimals);
  return `${v.toLocaleString(undefined, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: Math.min(2, decimals),
  })} ${symbol}`;
}

export function formatBigTokens(wei: bigint, symbol: string): string {
  const v = weiToFloat(wei, 0);
  return `${v.toLocaleString()} ${symbol}`;
}

export function formatHashrate(hps: bigint): string {
  const n = Number(hps);
  const units = ["H/s", "KH/s", "MH/s", "GH/s", "TH/s", "PH/s", "EH/s"];
  let i = 0;
  let v = n;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${units[i]}`;
}

export function formatDifficulty(d: bigint): string {
  const n = Number(d);
  if (n < 1e6) return n.toLocaleString();
  const units = ["", "K", "M", "G", "T", "P", "E"];
  let i = 0;
  let v = n;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}${units[i]}`;
}

export function formatBlockNumber(n: number): string {
  return "#" + n.toLocaleString();
}

export function formatSeconds(s: number): string {
  return `${s.toFixed(2)}s`;
}

/** Display a YYYY-MM-DD period-start in user locale, labeled as a UTC calendar date. */
export function formatPeriodDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "2-digit",
    timeZone: "UTC",
  });
}

/** Compact human number: 12,345 → 12.3K; 1.2M; 1.23B. For axis ticks. */
export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(abs < 10 ? 2 : 0);
}
