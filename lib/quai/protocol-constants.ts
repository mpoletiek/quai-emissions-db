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
