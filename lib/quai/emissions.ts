import { quaiWeiToQiWei } from "./conversion";
import type {
  Emission,
  MiningInfo,
  NormalizedBlock,
  SupplyAnalytics,
} from "./types";

const ZERO_ANALYTICS: SupplyAnalytics = {
  quaiSupplyAdded: 0n,
  quaiSupplyRemoved: 0n,
  quaiSupplyTotal: 0n,
  qiSupplyAdded: 0n,
  qiSupplyRemoved: 0n,
  qiSupplyTotal: 0n,
};

/**
 * Build an analytics-only emission row — used for blocks outside the detail window.
 * Block-level fields (exchangeRate, coinbase, workshareCount) are left as zeros.
 *
 * NOTE: The `winnerToken` field is a coinbase-derived placeholder from
 * `NormalizedBlock`. In practice, recent mainnet blocks never have a Qi-ledger
 * coinbase, yet Qi still mints regularly via protocol-level flows independent
 * of the miner's coinbase. Don't rely on `winnerToken` to classify per-block
 * token payouts — use analytics deltas instead.
 */
export function analyticsOnlyEmission(
  blockNumber: number,
  analytics: SupplyAnalytics,
): Emission {
  return {
    blockNumber,
    timestamp: 0,
    hasBlockDetail: false,
    winnerToken: "QUAI",
    exchangeRate: 0n,
    difficulty: 0n,
    workshareCount: 0,
    nativeEmittedWei: 0n,
    blockRewardWei: 0n,
    workshareRewardWei: 0n,
    quaiEmittedWei: 0n,
    qiEmittedWei: 0n,
    analytics,
  };
}

/**
 * Per-block derived emission.
 *
 * Estimate fields (`blockRewardWei`, `workshareRewardWei`, `nativeEmittedWei`)
 * are the *theoretical* reward a miner earns for sealing a block, computed as
 * `estimatedBlockReward + workshareReward × workshareCount`. These model
 * earned-but-not-yet-settled QUAI; they do NOT equal per-block supply changes,
 * which appear in `analytics` after vesting/settlement.
 *
 * We always model the reward as QUAI-denominated because (a) every observed
 * block has a Quai-ledger `primaryCoinbase`, and (b) Qi mints are driven by
 * protocol flows we have not yet characterized. See `analytics.qiSupplyAdded`
 * for the realized Qi signal.
 */
export function deriveEmission(
  block: NormalizedBlock,
  info: MiningInfo,
  analytics: SupplyAnalytics = ZERO_ANALYTICS,
): Emission {
  const workshareCount = BigInt(block.workshareCount);
  const workshareTotal = info.workshareReward * workshareCount;
  const blockReward = info.estimatedBlockReward;
  const nativeEmittedWei = blockReward + workshareTotal;

  return {
    blockNumber: block.number,
    timestamp: block.timestamp,
    hasBlockDetail: true,
    winnerToken: "QUAI",
    exchangeRate: block.exchangeRate,
    difficulty: block.difficulty,
    workshareCount: block.workshareCount,
    nativeEmittedWei,
    blockRewardWei: blockReward,
    workshareRewardWei: workshareTotal,
    quaiEmittedWei: nativeEmittedWei,
    qiEmittedWei: quaiWeiToQiWei(nativeEmittedWei, block.exchangeRate),
    analytics,
  };
}

export function deriveEmissions(
  blocks: NormalizedBlock[],
  info: MiningInfo,
  analytics: Map<number, SupplyAnalytics> = new Map(),
): Emission[] {
  return blocks.map((b) =>
    deriveEmission(b, info, analytics.get(b.number) ?? ZERO_ANALYTICS),
  );
}
