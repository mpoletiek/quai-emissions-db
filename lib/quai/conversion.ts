import { WEI_PER_TOKEN } from "./constants";

/**
 * UNVERIFIED: The exact semantic of `header.exchangeRate` is not yet confirmed
 * against go-quai source or a clean Qi↔Quai conversion event. Observed on cyprus1
 * (Apr 2026): rate is a 1e18-scaled big-int, stable around 6.6323.
 *
 * Conversion-flow blocks visible in the data have a capped
 * `conversionFlowAmount` (~100.27 QUAI/block), suggesting the rate governs a
 * throttled protocol-level conversion rather than a free-floating market price.
 *
 * These helpers assume "Qi-wei per Quai-wei, scaled to 1e18". Treat outputs
 * as directional, not authoritative. Do NOT surface them as dollar-equivalent
 * values until verified.
 */

export const quaiWeiToQiWei = (quaiWei: bigint, rate: bigint): bigint => {
  if (rate === 0n) return 0n;
  return (quaiWei * rate) / WEI_PER_TOKEN;
};

export const qiWeiToQuaiWei = (qiWei: bigint, rate: bigint): bigint => {
  if (rate === 0n) return 0n;
  return (qiWei * WEI_PER_TOKEN) / rate;
};
