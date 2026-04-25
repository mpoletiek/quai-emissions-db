// Quai supply projection. Linear from a runtime-supplied anchor (today's
// realized circulating, fetched from /api/supply) to the published cap of
// 1.4 B QUAI by Feb 2029.
//
// Linear is a simplification — Quai's actual emission decays as log(diff)
// rather than at a fixed rate — but it matches the foundation's headline
// claim ("1.4 B by Feb 2029") and is the right level of complexity for a
// multi-decade comparison chart.

/** Target total supply at the cap date, in QUAI wei. */
export const QUAI_CAP_WEI = 1_400_000_000n * 10n ** 18n;

/** Cap-out date — projection endpoint. */
export const QUAI_CAP_DATE = new Date("2029-02-01T00:00:00Z");

/** Quai mainnet launch — pre-this date supply is zero. */
export const QUAI_MAINNET_DATE = new Date("2025-01-29T00:00:00Z");

/** ISO month string of the cap date for chart annotation. */
export const QUAI_CAP_MONTH = QUAI_CAP_DATE.toISOString().slice(0, 7);
export const QUAI_MAINNET_MONTH = QUAI_MAINNET_DATE.toISOString().slice(0, 7);

/** Linearly interpolate from `anchor` to (QUAI_CAP_DATE, QUAI_CAP_WEI),
 *  flat at the cap thereafter. BigInt math throughout to preserve wei
 *  precision; the fraction is encoded as ppm (parts per million) so we
 *  don't drift through floating-point. */
export function quaiProjectedSupplyAt(
  date: Date,
  anchor: { date: Date; supply: bigint },
): bigint {
  if (date <= anchor.date) return anchor.supply;
  if (date >= QUAI_CAP_DATE) return QUAI_CAP_WEI;

  const totalMs = QUAI_CAP_DATE.getTime() - anchor.date.getTime();
  const elapsedMs = date.getTime() - anchor.date.getTime();
  // ppm fraction of the projection window elapsed.
  const ppm = BigInt(Math.floor((elapsedMs / totalMs) * 1_000_000));
  const remaining = QUAI_CAP_WEI - anchor.supply;
  return anchor.supply + (remaining * ppm) / 1_000_000n;
}
