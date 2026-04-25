/**
 * Downsample a series to ~targetPoints by averaging (or last-value for totals).
 * Recharts starts to stutter well below 5k points; bucketing keeps render fast.
 */
export function bucketAvg<T>(
  rows: T[],
  targetPoints: number,
  pick: (r: T) => { x: number; y: number },
): { x: number; y: number }[] {
  if (rows.length <= targetPoints) return rows.map(pick);
  const bucket = Math.ceil(rows.length / targetPoints);
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < rows.length; i += bucket) {
    const slice = rows.slice(i, i + bucket);
    const xy = slice.map(pick);
    const xAvg = xy[Math.floor(xy.length / 2)].x;
    const ySum = xy.reduce((a, b) => a + b.y, 0);
    out.push({ x: xAvg, y: ySum / xy.length });
  }
  return out;
}

// For cumulative/total series, use the last sample in each bucket rather than the mean.
export function bucketLast<T>(
  rows: T[],
  targetPoints: number,
  pick: (r: T) => { x: number; y: number },
): { x: number; y: number }[] {
  if (rows.length <= targetPoints) return rows.map(pick);
  const bucket = Math.ceil(rows.length / targetPoints);
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < rows.length; i += bucket) {
    const last = rows[Math.min(i + bucket, rows.length) - 1];
    out.push(pick(last));
  }
  return out;
}

// For sparse event streams (like mint/burn deltas), sum per bucket.
export function bucketSum<T, K extends string>(
  rows: T[],
  targetPoints: number,
  pick: (r: T) => { x: number } & { [P in K]: number },
  keys: readonly K[],
): ({ x: number } & { [P in K]: number })[] {
  if (rows.length <= targetPoints) return rows.map(pick);
  const bucket = Math.ceil(rows.length / targetPoints);
  const out: ({ x: number } & { [P in K]: number })[] = [];
  for (let i = 0; i < rows.length; i += bucket) {
    const slice = rows.slice(i, i + bucket);
    const picks = slice.map(pick);
    const x = picks[Math.floor(picks.length / 2)].x;
    const acc = { x } as { x: number } & { [P in K]: number };
    for (const k of keys) {
      let s = 0;
      for (const p of picks) s += p[k];
      acc[k] = s as never;
    }
    out.push(acc);
  }
  return out;
}
