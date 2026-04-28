// Single source of truth for chain-level constants and protocol-event markers.
//
// Constants are sourced from go-quai (params/protocol_params.go) and the
// foundation's announcements. They must be kept in sync with the running
// chain config; a wrong value here makes every realized-supply chart wrong.
//
// VERIFY before Phase 1 ship (per docs/dashboard-proposal.md §9):
//   • GENESIS_PREMINE_QUAI — exact total + per-cohort breakdown.
//   • SINGULARITY_SKIP_QUAI — exact amount permanently skipped at the fork.
//   • SOAP_FORK_BLOCK — already a code constant, just confirm the cyprus1
//     timestamp at that block matches the announcement date.

import { KAWPOW_FORK_BLOCK } from "./rewards";

/** Total QUAI minted at genesis (block 0), in QUAI-wei. NOT reflected in
 *  `quaiSupplyTotal` — the RPC's running total accumulates only post-genesis
 *  mutations. Add this back when computing absolute realized circulating. */
export const GENESIS_PREMINE_QUAI: bigint = 3_000_000_000n * 10n ** 18n;

/** QUAI permanently skipped from future genesis unlocks at the Singularity
 *  Fork (Prime block 1,530,500, 2026-03-19). Never minted. Subtract from
 *  realized circulating for periods on/after the fork date. */
export const SINGULARITY_SKIP_QUAI: bigint = 1_667_159_984n * 10n ** 18n;

/** SOAP activation block on the Prime chain. Re-exported from rewards.ts
 *  so this file is the canonical lookup for protocol constants. */
export const SOAP_FORK_BLOCK = KAWPOW_FORK_BLOCK;

/** Singularity Fork — Prime block. Used both for chart annotations and to
 *  gate the genesis-skip subtraction in v_supply_*. */
export const SINGULARITY_FORK_BLOCK = 1_530_500n;

/** Calendar dates for protocol events. UTC. Used by ProtocolEventLines and
 *  the home page "days since X" badge. */
export const SINGULARITY_FORK_DATE = "2026-03-19";
export const SOAP_ACTIVATION_DATE = "2025-12-17";

/** Registry of protocol events for time-series annotation. Consumed by
 *  ProtocolEventLines and any chart that wants to mark milestones. */
export type ProtocolEvent = {
  id: string;
  label: string;
  date: string; // YYYY-MM-DD UTC
  blockNumber?: bigint;
  description: string;
};

export const PROTOCOL_EVENTS: ProtocolEvent[] = [
  {
    id: "mainnet",
    label: "Mainnet",
    date: "2025-01-29",
    description: "Quai mainnet launch.",
  },
  {
    id: "tge",
    label: "TGE",
    date: "2025-02-04",
    description: "Token generation event; QUAI public trading begins.",
  },
  {
    id: "qi-launch",
    label: "Qi launch",
    date: "2025-04-01",
    description: "Qi mining begins; the dual-token system goes live.",
  },
  {
    id: "soap",
    label: "SOAP",
    date: SOAP_ACTIVATION_DATE,
    blockNumber: SOAP_FORK_BLOCK,
    description:
      "SOAP activation — KawPoW seals + SHA/Scrypt merge-mined workshares.",
  },
  {
    id: "singularity",
    label: "Singularity",
    date: SINGULARITY_FORK_DATE,
    blockNumber: SINGULARITY_FORK_BLOCK,
    description:
      "Singularity Fork — ~1.67 B QUAI of future genesis unlocks permanently skipped.",
  },
  {
    id: "kraken",
    label: "Kraken",
    date: "2026-04-08",
    description: "QUAI listed on Kraken.",
  },
];

/** Look up an event by id. Returns null if absent. */
export function getProtocolEvent(id: string): ProtocolEvent | null {
  return PROTOCOL_EVENTS.find((e) => e.id === id) ?? null;
}

// ─── Coinbase lockup ─────────────────────────────────────────────────────
// Source: go-quai params/protocol_params.go
//   • LockupByteToBlockDepth, LockupByteToRewardsMultiple
//   • CalculateLockupByteRewardsMultiple, CalculateCoinbaseValueWithLockup
// Quai docs https://docs.qu.ai/guides/client/node confirm Y1/Y5 anchors but
// round Byte-3 duration to 360 days; source uses 365 × BlocksPerDay.

/** Cyprus1 target block time in seconds. `BlocksPerDay = 86400 / 5`. */
export const BLOCKS_PER_DAY = 17_280n;
export const BLOCKS_PER_WEEK = 7n * BLOCKS_PER_DAY;
export const BLOCKS_PER_MONTH = 30n * BLOCKS_PER_DAY;
export const BLOCKS_PER_YEAR = 365n * BLOCKS_PER_DAY;

/** Lockup byte → block depth before reward unlocks. Index = byte. */
export const LOCKUP_BLOCKS: readonly bigint[] = [
  2n * BLOCKS_PER_WEEK,   // byte 0: 2 weeks   = 241,920
  3n * BLOCKS_PER_MONTH,  // byte 1: 3 months  = 1,555,200
  6n * BLOCKS_PER_MONTH,  // byte 2: 6 months  = 3,110,400
  BLOCKS_PER_YEAR,        // byte 3: 12 months = 6,307,200
];

/** Reward multiplier anchors per byte: [Y1_anchor, Y5_floor], in 1/100,000.
 *  Byte 0 has no boost (the go-quai function errors on byte 0 — caller
 *  short-circuits to value × 1.0). */
export const LOCKUP_MULTIPLIER_ANCHORS: readonly [bigint, bigint][] = [
  [100_000n, 100_000n], // byte 0: 1.00× / 1.00× (placeholder; not used)
  [103_500n, 100_218n], // byte 1: 1.035× → 1.00218×
  [110_000n, 100_625n], // byte 2: 1.10×  → 1.00625×
  [125_000n, 101_562n], // byte 3: 1.25×  → 1.01562×
];

/** Multiplier returned in units of 1/100,000 (so 100,000 = 1.0×). Block
 *  number is the **zone block number** from cyprus1 genesis — same value
 *  go-quai's CalculateCoinbaseValueWithLockup receives via
 *  block.NumberU64(common.ZONE_CTX). */
export const LOCKUP_MULTIPLIER_UNIT = 100_000n;

/** Multiplier kicks in only at zone block ≥ 2 × BlocksPerMonth. Before that,
 *  every coinbase pays 1.0× regardless of byte (per go-quai
 *  CalculateCoinbaseValueWithLockup early-return). */
export const LOCKUP_MULTIPLIER_ACTIVATION_BLOCK = 2n * BLOCKS_PER_MONTH;

/** Compute the lockup multiplier for a given byte at a given zone block.
 *  Returns the multiplier in units of `LOCKUP_MULTIPLIER_UNIT` (1/100,000),
 *  matching go-quai's int representation so chart math stays bigint. */
export function lockupMultiplierMicros(
  lockupByte: 0 | 1 | 2 | 3,
  zoneBlockNumber: bigint,
): bigint {
  if (lockupByte === 0) return LOCKUP_MULTIPLIER_UNIT;
  if (zoneBlockNumber < LOCKUP_MULTIPLIER_ACTIVATION_BLOCK) {
    return LOCKUP_MULTIPLIER_UNIT;
  }
  const [y1, y5] = LOCKUP_MULTIPLIER_ANCHORS[lockupByte];
  const year = zoneBlockNumber / BLOCKS_PER_YEAR;
  if (year === 0n) return y1;
  if (year > 4n) return y5;
  // Linear interp: at block = BlocksPerYear → Y1, at block = 5×BlocksPerYear → Y5.
  const a = y5 - y1;
  const b = 4n * BLOCKS_PER_YEAR;
  const x = zoneBlockNumber - BLOCKS_PER_YEAR;
  return (a * x + b * y1) / b;
}

/** Apply a lockup-byte multiplier to a wei value. Mirrors go-quai's
 *  CalculateCoinbaseValueWithLockup. */
export function applyLockupMultiplier(
  valueWei: bigint,
  lockupByte: 0 | 1 | 2 | 3,
  zoneBlockNumber: bigint,
): bigint {
  const m = lockupMultiplierMicros(lockupByte, zoneBlockNumber);
  return (valueWei * m) / LOCKUP_MULTIPLIER_UNIT;
}

/** Lockup byte → unlock duration in days (rounded down). Convenience for UI
 *  copy and for shifting cumulative-issued curves into cumulative-unlocked
 *  space at daily rollup granularity. */
export function lockupDays(lockupByte: 0 | 1 | 2 | 3): number {
  return Number(LOCKUP_BLOCKS[lockupByte] / BLOCKS_PER_DAY);
}
