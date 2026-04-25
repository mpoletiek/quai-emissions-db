-- 0006_supply_views.sql
-- Realized-circulating supply math, materialized as views over the rollup
-- tables. Single source of truth: prevents the double-subtract footgun
-- (RPC already nets quaiSupplyTotal of the SOAP burn balance — see
-- docs/emissions-full-picture.md §8.7).
--
-- Inputs:
--   quai_total_end  — gross QUAI minted, already net of SOAP burn at RPC layer
--   qi_total_end    — gross QI minted (QI has no sinks)
--   burn_close      — balanceOf(0x0050AF…) at period end (authoritative burn)
--
-- Output:
--   realized_circulating_quai = quai_total_end
--                             + 3,000,000,000 × 10^18 (genesis premine)
--                             − 1,667,159,984 × 10^18 (Singularity skip, post-2026-03-19)
--
-- The Singularity skip is "1.67 B QUAI of future unlocks never minted." It's
-- not a burn; the supply curve simply stops growing for those allocations
-- post-fork. We model it as a step subtraction at the fork date so the
-- realized-supply line drops on 2026-03-19 to reflect that those allocations
-- are no longer counted toward eventual circulating.
--
-- Constants below MUST stay in sync with lib/quai/protocol-constants.ts.
-- A value drift here silently breaks every supply chart.

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
  -- realized circulating = gross + genesis − Singularity skip (post-fork)
  (
    quai_total_end
    + (3000000000::numeric * power(10::numeric, 18))
    - CASE
        WHEN period_start >= DATE '2026-03-19'
          THEN (1667159984::numeric * power(10::numeric, 18))
        ELSE 0::numeric
      END
  ) AS realized_circulating_quai
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
  (
    quai_total_end
    + (3000000000::numeric * power(10::numeric, 18))
    - CASE
        WHEN period_start >= DATE '2026-03-19'
          THEN (1667159984::numeric * power(10::numeric, 18))
        ELSE 0::numeric
      END
  ) AS realized_circulating_quai
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
  (
    quai_total_end
    + (3000000000::numeric * power(10::numeric, 18))
    - CASE
        WHEN period_start >= DATE '2026-03-19'
          THEN (1667159984::numeric * power(10::numeric, 18))
        ELSE 0::numeric
      END
  ) AS realized_circulating_quai
FROM rollups_monthly;
