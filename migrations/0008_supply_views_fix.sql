-- 0008_supply_views_fix.sql
-- Corrects the realized-circulating math from 0006. Two adjustments were
-- wrong and produced a ~2.31 B figure when on-chain truth is ~980 M:
--
--   1. Adding the 3 B genesis premine. The RPC's quaiSupplyTotal is the
--      canonical circulating signal that markets, exchanges, and CoinGecko
--      already use. The premine allocations sit at addresses with vesting
--      schedules; they enter quaiSupplyTotal as they unlock, not at block 0.
--      Re-adding 3 B on top either double-counts unlocked premine or counts
--      not-yet-vested premine as circulating — both wrong.
--
--   2. Subtracting the 1.667 B Singularity skip. The Singularity Fork
--      eliminated FUTURE genesis unlocks that had never been minted into
--      quai_total_end. There is nothing in the historical curve to subtract.
--      The fork affects the eventual maximum supply, not the current line.
--
-- Correct formula: realized_circulating_quai = quai_total_end (already net
-- of SOAP burn at the RPC layer per docs/emissions-full-picture.md §8.7).
--
-- The Singularity Fork is now represented purely as an annotation event
-- (lib/quai/protocol-constants.ts PROTOCOL_EVENTS) — a ReferenceLine on
-- charts, with copy explaining the eliminated future supply, but no
-- mathematical change to realized circulating.

CREATE OR REPLACE VIEW v_supply_daily AS
SELECT
  period_start,
  first_block,
  last_block,
  block_count,
  partial,
  quai_total_end,
  qi_total_end,
  burn_close,
  burn_delta,
  -- ::numeric cast preserves the unconstrained-numeric column type from
  -- 0006; CREATE OR REPLACE VIEW refuses to change column types, so
  -- without this cast Postgres rejects with 42P16 because quai_total_end
  -- is declared numeric(78,0) on the underlying tables.
  quai_total_end::numeric AS realized_circulating_quai
FROM rollups_daily;

CREATE OR REPLACE VIEW v_supply_weekly AS
SELECT
  period_start,
  first_block,
  last_block,
  block_count,
  partial,
  quai_total_end,
  qi_total_end,
  burn_close,
  burn_delta,
  -- ::numeric cast preserves the unconstrained-numeric column type from
  -- 0006; CREATE OR REPLACE VIEW refuses to change column types, so
  -- without this cast Postgres rejects with 42P16 because quai_total_end
  -- is declared numeric(78,0) on the underlying tables.
  quai_total_end::numeric AS realized_circulating_quai
FROM rollups_weekly;

CREATE OR REPLACE VIEW v_supply_monthly AS
SELECT
  period_start,
  first_block,
  last_block,
  block_count,
  partial,
  quai_total_end,
  qi_total_end,
  burn_close,
  burn_delta,
  -- ::numeric cast preserves the unconstrained-numeric column type from
  -- 0006; CREATE OR REPLACE VIEW refuses to change column types, so
  -- without this cast Postgres rejects with 42P16 because quai_total_end
  -- is declared numeric(78,0) on the underlying tables.
  quai_total_end::numeric AS realized_circulating_quai
FROM rollups_monthly;
