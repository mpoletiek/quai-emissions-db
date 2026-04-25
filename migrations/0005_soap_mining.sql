-- 0005_soap_mining.sql
-- Adds the data model needed for the SOAP page: per-algorithm workshare
-- counts per block, uncled-rate EMAs from the woHeader, a per-block
-- mining_info row from quai_getMiningInfo (post-SOAP), and a base block
-- reward column populated pre-SOAP from first-principles math and
-- post-SOAP from RPC.
--
-- All ADDs are NULLable and non-blocking; safe to apply while ingest is
-- running. Existing ingest code continues to work unchanged — new columns
-- just stay NULL until the ingest is updated to populate them.

-- ── blocks: per-algorithm workshare data + base block reward ─────────────
-- Actual workshare counts are derived at ingest time from the top-level
-- `workshares` array of the RPC block response (NOT the `uncles` array —
-- uncles is for stale block-candidates in the Ethereum sense and is
-- effectively dead post-SOAP). Each workshare carries an `auxpow` object
-- whose `powId` identifies the algorithm:
--
--     auxpow = null     → ProgPoW  (pre-SOAP: all; post-SOAP transition-only)
--     auxpow.powId 0x1  → KawPoW
--     auxpow.powId 0x2  → SHA_BTC
--     auxpow.powId 0x3  → SHA_BCH
--     auxpow.powId 0x4  → Scrypt
--
-- EMA-smoothed share and uncled rates come from woHeader.shaDiffAndCount
-- and woHeader.scryptDiffAndCount. Values are in go-quai's internal units:
-- `shares_per_block × 2^32`. Consumer formula for "uncled ratio" over a
-- period is Σ(uncled_ema) / Σ(count_ema).
--
-- "Uncled" is NOT "stale share." In go-quai, a workshare is uncled when
-- its PrimaryCoinbase cannot resolve to an InternalAddress on the current
-- zone (core/headerchain.go:546,551). Those shares' rewards are
-- redistributed pro-rata to shares whose coinbases are zone-internal
-- (state_processor.go:1214-1236). This state only applies to SHA and
-- Scrypt (aux-PoW'd from BTC/BCH/DOGE, where coinbases can be foreign
-- to the Quai zone). KawPoW and ProgPoW coinbases are zone-internal by
-- construction, so they cannot be uncled and are not tracked on the
-- header. These columns therefore measure cross-chain miner drift and
-- reward-redistribution pressure for aux-PoW'd algorithms — a useful
-- efficiency/adoption signal, not a stale-share metric.
--
-- base_block_reward is the CalculateQuaiReward output (QUAI wei). Populated
-- for every block:
--   • Pre-SOAP: computed client-side from difficulty + exchange_rate
--     using the go-quai formula in consensus/misc/rewards.go.
--   • Post-SOAP: pulled directly from quai_getMiningInfo.baseBlockReward.
ALTER TABLE blocks
  ADD COLUMN ws_kawpow_count     smallint,
  ADD COLUMN ws_progpow_count    smallint,
  ADD COLUMN ws_sha_count        smallint,
  ADD COLUMN ws_scrypt_count     smallint,
  ADD COLUMN sha_count_ema       numeric(78,0),
  ADD COLUMN sha_uncled_ema      numeric(78,0),
  ADD COLUMN scrypt_count_ema    numeric(78,0),
  ADD COLUMN scrypt_uncled_ema   numeric(78,0),
  ADD COLUMN base_block_reward   numeric(78,0);

-- ── mining_info: per-block snapshot from quai_getMiningInfo ──────────────
-- One row per post-SOAP block (RPC rejects pre-SOAP). Values represent a
-- trailing-15-minute rolling average anchored at the block. 1:1 with blocks
-- via FK; rollups compute averages by joining blocks → mining_info in the
-- target period.
CREATE TABLE mining_info (
  block_number            bigint           PRIMARY KEY
    REFERENCES blocks(block_number) ON DELETE CASCADE,
  blocks_analyzed         int              NOT NULL,
  avg_block_time_s        double precision NOT NULL,

  -- Per-algorithm difficulty anchored at this block (post-SOAP only)
  kawpow_difficulty       numeric(78,0)    NOT NULL,
  sha_difficulty          numeric(78,0)    NOT NULL,
  scrypt_difficulty       numeric(78,0)    NOT NULL,

  -- Per-algorithm hashrate, H/s, server-computed over the 15-minute window
  kawpow_hashrate         numeric(78,0)    NOT NULL,
  sha_hashrate            numeric(78,0)    NOT NULL,
  scrypt_hashrate         numeric(78,0)    NOT NULL,

  -- Per-algorithm average time between workshares, seconds
  avg_kawpow_share_s      double precision NOT NULL,
  avg_sha_share_s         double precision NOT NULL,
  avg_scrypt_share_s      double precision NOT NULL,

  -- Reward math (QUAI wei). base_block_reward is NOT here — it lives on
  -- blocks so it's populated for every block, pre- and post-SOAP.
  avg_tx_fees             numeric(78,0)    NOT NULL,
  estimated_block_reward  numeric(78,0)    NOT NULL,   -- baseBlockReward + 2 * avgTxFees
  workshare_reward        numeric(78,0)    NOT NULL    -- estimatedBlockReward / (expectedWorksharesPerBlock + 1)
);

-- ── rollups_*: per-algorithm aggregates ──────────────────────────────────
-- Sums come from blocks.ws_*_count and the EMA columns. Averages come from
-- mining_info via join on block_number. mining_block_count records how many
-- blocks in the period had a mining_info row (i.e., post-SOAP blocks), so
-- consumers can tell "no samples" apart from "zero activity."
ALTER TABLE rollups_daily
  ADD COLUMN ws_kawpow_sum          bigint,
  ADD COLUMN ws_progpow_sum         bigint,
  ADD COLUMN ws_sha_sum             bigint,
  ADD COLUMN ws_scrypt_sum          bigint,
  ADD COLUMN sha_count_ema_sum      numeric(78,0),
  ADD COLUMN sha_uncled_ema_sum     numeric(78,0),
  ADD COLUMN scrypt_count_ema_sum   numeric(78,0),
  ADD COLUMN scrypt_uncled_ema_sum  numeric(78,0),
  ADD COLUMN base_block_reward_avg  numeric(78,0),
  ADD COLUMN base_block_reward_sum  numeric(78,0),
  ADD COLUMN workshare_reward_avg   numeric(78,0),
  ADD COLUMN avg_tx_fees_avg        numeric(78,0),
  ADD COLUMN kawpow_hashrate_avg    numeric(78,0),
  ADD COLUMN sha_hashrate_avg       numeric(78,0),
  ADD COLUMN scrypt_hashrate_avg    numeric(78,0),
  ADD COLUMN kawpow_difficulty_avg  numeric(78,0),
  ADD COLUMN sha_difficulty_avg     numeric(78,0),
  ADD COLUMN scrypt_difficulty_avg  numeric(78,0),
  ADD COLUMN mining_block_count     int;

ALTER TABLE rollups_weekly
  ADD COLUMN ws_kawpow_sum          bigint,
  ADD COLUMN ws_progpow_sum         bigint,
  ADD COLUMN ws_sha_sum             bigint,
  ADD COLUMN ws_scrypt_sum          bigint,
  ADD COLUMN sha_count_ema_sum      numeric(78,0),
  ADD COLUMN sha_uncled_ema_sum     numeric(78,0),
  ADD COLUMN scrypt_count_ema_sum   numeric(78,0),
  ADD COLUMN scrypt_uncled_ema_sum  numeric(78,0),
  ADD COLUMN base_block_reward_avg  numeric(78,0),
  ADD COLUMN base_block_reward_sum  numeric(78,0),
  ADD COLUMN workshare_reward_avg   numeric(78,0),
  ADD COLUMN avg_tx_fees_avg        numeric(78,0),
  ADD COLUMN kawpow_hashrate_avg    numeric(78,0),
  ADD COLUMN sha_hashrate_avg       numeric(78,0),
  ADD COLUMN scrypt_hashrate_avg    numeric(78,0),
  ADD COLUMN kawpow_difficulty_avg  numeric(78,0),
  ADD COLUMN sha_difficulty_avg     numeric(78,0),
  ADD COLUMN scrypt_difficulty_avg  numeric(78,0),
  ADD COLUMN mining_block_count     int;

ALTER TABLE rollups_monthly
  ADD COLUMN ws_kawpow_sum          bigint,
  ADD COLUMN ws_progpow_sum         bigint,
  ADD COLUMN ws_sha_sum             bigint,
  ADD COLUMN ws_scrypt_sum          bigint,
  ADD COLUMN sha_count_ema_sum      numeric(78,0),
  ADD COLUMN sha_uncled_ema_sum     numeric(78,0),
  ADD COLUMN scrypt_count_ema_sum   numeric(78,0),
  ADD COLUMN scrypt_uncled_ema_sum  numeric(78,0),
  ADD COLUMN base_block_reward_avg  numeric(78,0),
  ADD COLUMN base_block_reward_sum  numeric(78,0),
  ADD COLUMN workshare_reward_avg   numeric(78,0),
  ADD COLUMN avg_tx_fees_avg        numeric(78,0),
  ADD COLUMN kawpow_hashrate_avg    numeric(78,0),
  ADD COLUMN sha_hashrate_avg       numeric(78,0),
  ADD COLUMN scrypt_hashrate_avg    numeric(78,0),
  ADD COLUMN kawpow_difficulty_avg  numeric(78,0),
  ADD COLUMN sha_difficulty_avg     numeric(78,0),
  ADD COLUMN scrypt_difficulty_avg  numeric(78,0),
  ADD COLUMN mining_block_count     int;
