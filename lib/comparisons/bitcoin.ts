// Bitcoin emission schedule. Static; computed from known halving timestamps.
//
// Halvings happen every 210,000 blocks. The first four are historical and
// hardcoded with their actual on-chain timestamps. Future halvings are
// projected at a 4-year cadence — close enough for a multi-decade chart.
//
// Used by EmissionsComparisonChart to overlay Quai's emission curve on
// Bitcoin's. Numbers are absolute BTC, not satoshis; the chart converts
// to "% of cap" for the comparison axis.

const BTC_GENESIS_DATE = new Date("2009-01-03T18:15:05Z");
const BTC_INITIAL_REWARD = 50; // BTC per block
const BLOCKS_PER_HALVING = 210_000; // protocol constant
const APPROX_HALVING_INTERVAL_MS = 4 * 365.25 * 24 * 3600 * 1000;

export const BTC_CAP = 21_000_000;

// Actual block timestamps for blocks 210000, 420000, 630000, 840000.
// These are wall-clock confirmation times — not exactly 4 years apart in
// practice, but very close.
const KNOWN_HALVING_DATES = [
  new Date("2012-11-28T15:24:38Z"), // halving 1: → 25 BTC/block
  new Date("2016-07-09T16:46:13Z"), // halving 2: → 12.5
  new Date("2020-05-11T19:23:43Z"), // halving 3: → 6.25
  new Date("2024-04-19T20:09:27Z"), // halving 4: → 3.125
];

/** Date at which epoch N begins (epoch 0 = genesis). Past halvings use real
 *  timestamps; future halvings are projected at 4 years from the previous. */
function epochStartDate(epoch: number): Date {
  if (epoch === 0) return BTC_GENESIS_DATE;
  if (epoch <= KNOWN_HALVING_DATES.length) {
    return KNOWN_HALVING_DATES[epoch - 1];
  }
  const last = KNOWN_HALVING_DATES[KNOWN_HALVING_DATES.length - 1].getTime();
  const futureEpochs = epoch - KNOWN_HALVING_DATES.length;
  return new Date(last + futureEpochs * APPROX_HALVING_INTERVAL_MS);
}

/** Cumulative BTC supply at the given date. Walks epoch-by-epoch:
 *   • Each completed epoch adds exactly 210,000 × reward BTC. This is the
 *     protocol budget and is independent of how long that epoch took
 *     wall-clock — early Bitcoin issued blocks slightly faster than the
 *     10-min target, so a time × rate calculation undercounts.
 *   • The current (partial) epoch is interpolated by the fraction of its
 *     time-window elapsed, applied to its 210,000-block budget. Slightly
 *     imprecise vs. real block production, but well under 1% drift on a
 *     multi-year chart.
 *   • Capped at BTC_CAP. */
export function bitcoinSupplyAt(date: Date): number {
  if (date <= BTC_GENESIS_DATE) return 0;

  let supply = 0;
  let reward = BTC_INITIAL_REWARD;
  let cursor = BTC_GENESIS_DATE;

  // 64 epochs covers ~256 years from genesis — well past the 2140 cap.
  for (let epoch = 1; epoch < 64; epoch++) {
    const next = epochStartDate(epoch);
    if (date < next) {
      const fraction =
        (date.getTime() - cursor.getTime()) /
        (next.getTime() - cursor.getTime());
      supply += fraction * BLOCKS_PER_HALVING * reward;
      break;
    }
    supply += BLOCKS_PER_HALVING * reward;
    cursor = next;
    reward /= 2;
    if (reward < 1e-12) break;
  }

  return Math.min(supply, BTC_CAP);
}

/** ISO month strings ("YYYY-MM") for past halvings, used to draw chart
 *  reference lines. */
export const KNOWN_HALVING_MONTHS: string[] = KNOWN_HALVING_DATES.map((d) =>
  d.toISOString().slice(0, 7),
);
