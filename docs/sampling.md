# Ingest Sampling Model

This document records which columns are populated **per-block (dense)** vs
**every Nth block (sampled)** by the unified ingest (`scripts/ingest/run.ts`).

**Sampling cadence:** `BACKFILL_SAMPLE_EVERY = 60` zone blocks (≈ 5 minutes
at ~5 s/block), so roughly 288 samples per UTC day.

Tail mode (cursor at chain head) **disables sampling** — every tip block is
fetched at full resolution so `/live` and real-time dashboards are always
dense. Sampling only affects the backfill range.

---

## blocks

| column | coverage | source |
|---|---|---|
| `block_number`, `hash`, `parent_hash`, `ts`, `primary_coinbase`, `winner_token` | **dense** | `quai_getHeaderByNumber` |
| `exchange_rate`, `k_quai_discount`, `conversion_flow_amount`, `miner_difficulty` | **dense** | header fields |
| `difficulty`, `workshare_count`, `finalized` | **dense** | header |
| `prime_terminus_number` | **dense** | `woHeader.primeTerminusNumber` (null pre-SOAP) |
| `sha_count_ema`, `sha_uncled_ema` | **dense** | `woHeader.shaDiffAndCount` — EMA-smoothed (×2^32) |
| `scrypt_count_ema`, `scrypt_uncled_ema` | **dense** | `woHeader.scryptDiffAndCount` |
| `base_block_reward` | **dense** | `CalculateQuaiReward(difficulty, exchangeRate, primeTerminusNumber, shaCountEma, scryptCountEma)` — client-side port verified bit-exact against `quai_getMiningInfo.baseBlockReward` |
| `ws_kawpow_count`, `ws_progpow_count`, `ws_sha_count`, `ws_scrypt_count` | **SAMPLED** | `quai_getBlockByNumber` → `workshares[].auxpow.powId`. `NULL` for non-sampled blocks (distinguishes from "sampled, zero shares"). |

## supply_analytics

| column | coverage | source |
|---|---|---|
| `quai_added`, `quai_removed`, `quai_total` | **dense** | `quai_getSupplyAnalyticsForBlock` |
| `qi_added`, `qi_removed`, `qi_total` | **dense** | same |
| `soap_burn_balance` | **dense** | `quai_getBalance(0x0050AF…)` per block |

## mining_info

All columns are **SAMPLED** — one row per sampled post-SOAP block. Pre-SOAP
blocks are skipped entirely (the RPC rejects them with error -32000).

| column | source |
|---|---|
| `blocks_analyzed`, `avg_block_time_s`, `avg_tx_fees` | `quai_getMiningInfo` |
| `kawpow_difficulty`, `sha_difficulty`, `scrypt_difficulty` | same |
| `kawpow_hashrate`, `sha_hashrate`, `scrypt_hashrate` | same (trailing-15-min, server-computed) |
| `avg_kawpow_share_s`, `avg_sha_share_s`, `avg_scrypt_share_s` | same |
| `estimated_block_reward`, `workshare_reward` | same |

## rollups_daily / rollups_weekly / rollups_monthly

Aggregate semantics by column class:

### Dense → exact aggregates
- `quai_added_sum`, `quai_removed_sum`, `qi_added_sum`, `qi_removed_sum`
- `quai_net_emitted`, `qi_net_emitted`
- `quai_total_end`, `qi_total_end` (last-of-period snapshot)
- `burn_close` (last-of-period snapshot), `burn_delta` (period delta)
- `winner_quai_count`, `winner_qi_count`
- `rate_open`, `rate_high`, `rate_low`, `rate_close`
- `conversion_flow_sum`
- `sha_count_ema_sum`, `sha_uncled_ema_sum`, `scrypt_count_ema_sum`, `scrypt_uncled_ema_sum`
- `base_block_reward_avg`, `base_block_reward_sum`
- `avg_block_time`, `workshare_total`, `workshare_avg`

### Sampled → scaled estimates
- `ws_kawpow_sum`, `ws_progpow_sum`, `ws_sha_sum`, `ws_scrypt_sum`
  - Computed as `ROUND(AVG(non-null per-block count) × block_count)`
  - Unbiased estimator of the true period sum
  - Statistical noise: with 288 samples/day, relative stddev < 2% for any
    reasonable workshare process

### Sampled → exact averages (no extrapolation needed)
- `kawpow_hashrate_avg`, `sha_hashrate_avg`, `scrypt_hashrate_avg`
- `kawpow_difficulty_avg`, `sha_difficulty_avg`, `scrypt_difficulty_avg`
- `workshare_reward_avg`, `avg_tx_fees_avg`
- The RPC already returns 15-minute trailing averages internally, so
  sampling at 5-minute cadence gives 288 near-independent samples per day
  of what are already smoothed values

### Sample-count telemetry
- `mining_block_count` — how many blocks in the period had a `mining_info`
  row. Tells dashboards "this is a zero because no samples" vs "this is
  a real zero from fully-sampled data." Zero for pre-SOAP periods.

---

## What users see on the dashboards

| Chart | Columns used | Accuracy |
|---|---|---|
| `SupplyTotalsChart` | `quai_total_end`, `qi_total_end` | **exact** (dense snapshot) |
| `SupplyVsBurnChart` | `quai_total_end`, `burn_close` | **exact** |
| `CumulativeBurnChart` | `burn_close`, `burn_delta` | **exact** |
| `DailyIssuanceChart` | `quai_added_sum`, `qi_added_sum` | **exact** (dense sum) |
| `EmissionVsBurnChart` | `quai_added_sum`, `burn_delta` | **exact** |
| `NetDailyIssuanceChart` | `quai_net_emitted`, `qi_net_emitted` | **exact** |
| `WinnerTokenSplitChart` heatmap | `winner_quai_count`, `winner_qi_count` + per-algo EMAs | **exact** (dense) |
| `ExchangeRateHistoryChart` | `rate_close` | **exact** |
| Per-algo hashrate curves (SOAP page) | `*_hashrate_avg` | sample-averaged, lossless in practice |
| Per-algo difficulty curves (SOAP page) | `*_difficulty_avg` | same |
| Per-algo workshare composition (SOAP page) | `ws_*_sum` | ±1-2% stddev on period sums; composition percentages are tight |
| Uncled ratio (SOAP page) | `*_uncled_ema_sum / *_count_ema_sum` | **exact** (both numerator and denominator are dense) |
| Reward over time (SOAP page) | `base_block_reward_avg` / `_sum` | **exact** (dense, bit-verified vs server) |
| Workshare-reward curve | `workshare_reward_avg` | sample-averaged, lossless |
