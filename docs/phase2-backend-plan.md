# Phase 2 Backend Plan — Persistent Store, Rollups, Tailing

Target: move QuaiEmissionsDB from live-RPC-per-request to a Supabase-backed store fed by a local `go-quai` node, with pre-aggregated D/W/M rollups and an incremental tailer. Cyprus1 only, dual-token (QUAI + QI).

## 1. Data model (Supabase / Postgres)

All wei/qits values use `numeric(78,0)` — exact, unbounded-enough for 2^256, no float64 anywhere. Block numbers are `bigint` (sufficient for centuries). Timestamps are `timestamptz` (UTC). Primary keys are block number where natural; rollup PKs are the period-start date.

### `blocks` — one row per canonical block, detail-window data

```
block_number        bigint PK
hash                bytea NOT NULL
parent_hash         bytea
ts                  timestamptz NOT NULL        -- from woHeader.timestamp
primary_coinbase    bytea NOT NULL
winner_token        smallint NOT NULL            -- 0=QUAI, 1=QI (coinbase-derived, see emissions.ts caveat)
exchange_rate       numeric(78,0) NOT NULL
k_quai_discount     numeric(78,0)
conversion_flow_amount numeric(78,0)
difficulty          numeric(78,0)
miner_difficulty    numeric(78,0)
workshare_count     int NOT NULL
finalized           boolean NOT NULL DEFAULT false
ingested_at         timestamptz NOT NULL DEFAULT now()

INDEX blocks_ts_idx          (ts DESC)
INDEX blocks_winner_idx      (winner_token, ts DESC)
INDEX blocks_finalized_idx   (finalized) WHERE finalized = false
```

### `supply_analytics` — authoritative per-block deltas, full history

```
block_number        bigint PK REFERENCES blocks(block_number) ON DELETE CASCADE
quai_added          numeric(78,0) NOT NULL        -- gross credit counter (NOT "minted")
quai_removed        numeric(78,0) NOT NULL        -- gross debit counter (NOT "burned" — see §Supply Reconciliation)
quai_total          numeric(78,0) NOT NULL        -- already net of balanceOf(0x0050AF…); see §Supply Reconciliation
qi_added            numeric(78,0) NOT NULL
qi_removed          numeric(78,0) NOT NULL
qi_total            numeric(78,0) NOT NULL
soap_burn_balance   numeric(78,0) NOT NULL        -- balanceOf(0x0050AF…) at this block; sole authoritative burn signal
ts                  timestamptz NOT NULL          -- denormalized from blocks.ts for fast range scans
ingested_at         timestamptz NOT NULL DEFAULT now()

INDEX sa_ts_idx (ts DESC)
```

Note: we persist analytics for every block (cheap — six numerics), but `blocks` can be populated lazily for older ranges if disk becomes a concern. For Phase 2 assume both are fully populated.

### `rollups_daily`, `rollups_weekly`, `rollups_monthly` — identical shape, different grain

```
period_start        date PK                       -- UTC midnight; week = ISO Monday; month = 1st
first_block         bigint NOT NULL
last_block          bigint NOT NULL
block_count         int NOT NULL
partial             boolean NOT NULL              -- true if period is still open or inside finality buffer

-- Emissions (summed from supply_analytics over the period)
quai_added_sum      numeric(78,0) NOT NULL        -- gross credit flow, NOT minted issuance
quai_removed_sum    numeric(78,0) NOT NULL        -- gross debit flow, NOT burn (do not chart as burn)
qi_added_sum        numeric(78,0) NOT NULL
qi_removed_sum      numeric(78,0) NOT NULL
quai_net_emitted    numeric(78,0) NOT NULL        -- added - removed
qi_net_emitted      numeric(78,0) NOT NULL

-- Supply totals at period end (snapshot = supply_total of last_block)
quai_total_end      numeric(78,0) NOT NULL
qi_total_end        numeric(78,0) NOT NULL

-- SOAP burn (authoritative) — balance of 0x0050AF… sampled from block states
burn_close          numeric(78,0) NOT NULL        -- soap_burn_balance at last_block (end-of-period snapshot)
burn_delta          numeric(78,0) NOT NULL        -- burn_close - burn_open; signed; normally ≥ 0
                                                  -- a negative value would signal a foundation reversal (flag it)

-- Winner-token split (coinbase-derived counts)
winner_quai_count   int NOT NULL
winner_qi_count     int NOT NULL

-- Workshare
workshare_total     bigint NOT NULL
workshare_avg       numeric(10,4) NOT NULL

-- Conversion flows (sum of header.conversionFlowAmount)
conversion_flow_sum numeric(78,0) NOT NULL

-- Exchange rate OHLC (from blocks.exchange_rate within the period)
rate_open           numeric(78,0) NOT NULL
rate_high           numeric(78,0) NOT NULL
rate_low            numeric(78,0) NOT NULL
rate_close          numeric(78,0) NOT NULL

computed_at         timestamptz NOT NULL DEFAULT now()

INDEX <grain>_last_block_idx (last_block)
```

### `ingest_cursor` — single-row checkpoint table

```
id                  smallint PK DEFAULT 1 CHECK (id=1)
last_ingested_block bigint NOT NULL
last_finalized_block bigint NOT NULL
last_tailed_at      timestamptz
backfill_done       boolean NOT NULL DEFAULT false
```

### Storage sizing

Per block: `blocks` ~250 B + `supply_analytics` ~210 B (now includes `soap_burn_balance`) ≈ ~460 B logical, ~750 B on disk with indexes. Assuming cyprus1 has ~5M blocks today and grows ~5.3M/yr: **~3.8 GB at launch, ~+4.0 GB/yr**. Rollups are negligible (<10 MB/decade). Well within Supabase's 8 GB Pro tier; comfortably in 50 GB Team.

### Supply Reconciliation

Source-verified against `go-quai v0.52.0` (see `docs/emissions-full-picture.md` §8 and memory note `quai_supply_reconciliation.md`). The correct identities the backend must implement:

```
monetary_QUAI(t) = quai_total(t) + genesis_alloc_sum         // quai_total is ALREADY net of SOAP burn at RPC layer
monetary_QI(t)   = qi_total(t)                               // no burn sink, no premine

soap_burn_total(t)      = soap_burn_balance(t)               // balance of 0x0050AF… at block t
soap_burn_delta(a→b)    = soap_burn_balance(b) - soap_burn_balance(a)   // period flow
```

Key invariants that govern API semantics:

1. `quai_getSupplyAnalyticsForBlock` subtracts `balanceOf(0x0050AF…)` from `quaiSupplyTotal` **server-side** (`internal/quaiapi/quai_api.go:290-292`). Do NOT subtract it again.
2. `quai_removed` is a **gross debit counter** (every `SubBalance`, including transfer sender-side). It is NOT a burn metric. Never surface it as "QUAI burned."
3. The ONLY authoritative burn signal is `soap_burn_balance` and its deltas. "Burn rate" KPIs must be derived from `burn_delta`, not `quai_removed`.
4. No EIP-1559 base-fee burn exists: full `gasPrice × gasUsed` is recycled 50/50 into `AvgTxFees` EMA and the block's share-reward pot. No "fee burn" column.
5. No on-chain SOAP vault exists. SOAP is 100% burn today; buyback happens off-chain on a CEX, purchased QUAI is sent from a foundation EOA to `0x0050AF…` as a normal transfer. No vault balance to track.
6. Genesis premine (3 B QUAI) lives in block-0 state but is NOT in `quai_total` (analytics accrues only post-genesis deltas). Read it once from the `go-quai` chain config / `AllocHash` preimage and treat it as a constant. Monthly unlocks are wallet-to-wallet transfers — no analytics impact. Singularity Fork (2026-03-19) skipped ~1.67 B of future unlocks; never minted, so the post-fork schedule is automatically correct.

## 2. Ingest architecture (backfill)

**Runs as a standalone Node process**, not a Next.js route. Next.js serverless routes have wall-clock limits and are a poor fit for a multi-hour job. Package as `scripts/backfill.ts` invoked by `node --experimental-strip-types` or `tsx`, run under `systemd`/`pm2`/`tmux` on the same host as the local node. Uses `@supabase/supabase-js` with a service-role key (ingest-only, never shipped to the browser).

### Strategy

Two parallel pipelines keyed off `block_number`, working from `last_ingested_block` forward to `head - FINALITY_BUFFER`. Strict coverage is asserted after each fetch — any missing block, analytics row, or burn balance throws and holds the cursor; the outer loop retries after a 5s backoff. No silent gaps.

1. **Analytics pipeline** — batches of **10,000** via `quai_getSupplyAnalyticsForBlock`, 4-way parallel (same constants as Phase 1). Piggybacks a `quai_getBalance("0x0050AF…", hex(N))` call for each block in the **same batched JSON-RPC POST** as the analytics request, so each block fetch is one round-trip for two results. Writes `soap_burn_balance` alongside the supply fields to `supply_analytics` via `COPY` or `INSERT … ON CONFLICT DO UPDATE`.
2. **Block-detail pipeline** — batches of **1,000** via `quai_getBlockByNumber`, 4-way parallel. Writes to `blocks`.

Both pipelines advance independently but are checkpointed together: `ingest_cursor.last_ingested_block` is the **minimum** of the two frontiers. Each chunk is written in a single transaction; the cursor is updated last. Crash-resume = restart from `last_ingested_block + 1`.

**Burn-balance sampling cadence tradeoff.** Per-block sampling is cheap (a single account state read) and gives sub-block-granular burn visibility, but doubles the analytics request count. If ingest throughput becomes a bottleneck, an acceptable fallback is to sample `quai_getBalance("0x0050AF…")` **only at rollup boundaries** (start and end of each day/week/month, plus the current head) and store `NULL` for non-boundary rows. Default is per-block; document the choice in `QUAI_BURN_SAMPLE_MODE=per_block|boundary` env var. Per-block is recommended because (a) the local node reads are cheap, (b) it enables future ad-hoc burn-rate charts at any grain without re-ingesting, and (c) the storage cost is one extra numeric per block (~32 B).

### Throughput estimates (local node, unthrottled)

Public RPC tops out near ~5k blocks/sec on analytics batches. A local node should hit **15k–30k blocks/sec** for analytics and **3k–6k blocks/sec** for full blocks — block detail is the bottleneck. At 4k blocks/sec end-to-end:
- 5M blocks → **~21 min**
- +10M (~2 yrs of growth) → **~70 min**

Budget **2–3 hours** for a fresh backfill on a mid-tier machine; most of the wall-clock is Postgres insert throughput, not RPC. Use `COPY` via `pg-copy-streams` if `INSERT` falls below 50k rows/sec.

### Reorg handling during backfill

Only ingest up to `head - FINALITY_BUFFER` (default **15 blocks**, ~75s of wall time). Blocks at or behind this depth mark `finalized = true`. The tailer (below) handles the mutable tip. The buffer sits 5 blocks past `REORG_DEPTH = 10` so a reorg of maximum expected depth can't retroactively touch a finalized row.

### Error handling

- Transient RPC errors → exponential backoff up to 5 retries, then halve the batch (same bisect strategy as `walkBlocks`).
- Gaps detected via `NOT EXISTS` scan at end of each chunk; filled synchronously before advancing the cursor.
- Fatal: abort with non-zero exit; `systemd` restarts after 30s.

## 3. Rollup strategy

**Incremental upserts**, not periodic rebuild. A rollup row is the reduction of a `period_start`'s blocks; we rebuild that single row whenever its member set changes.

### Build process

A `rollup_worker` runs after every ingest chunk completes (or at the end of the tailer's cycle). Steps:

1. Find distinct `period_start` values (via `date_trunc('day'|'week'|'month', ts AT TIME ZONE 'UTC')`) touched since `computed_at`.
2. For each dirty period, run one SQL aggregation over `blocks` ⋈ `supply_analytics` with `GROUP BY period_start`. For rate_open/rate_close use `MIN/MAX(block_number)` subselects; for OHLC high/low use `MIN/MAX(exchange_rate)`.
3. `INSERT … ON CONFLICT (period_start) DO UPDATE SET …` in one transaction per grain.
4. Mark `partial = (last_block_of_period > last_finalized_block)`.

All three grains are computed from the same source tables, so a single pass over the dirty block range produces D/W/M in sequence — no chaining.

### "Today's partial day"

Always present as a row with `partial = true` and `period_start = current UTC date`. The rollup worker recomputes it on every tailer tick. Consumers filtering out partial rows get stable historical series; those that want a live value read it explicitly.

### Timezone

All bucketing is UTC. Frontend converts to user TZ at render time only. No DST ambiguity.

## 4. Tailing worker

Runs as a separate long-lived process (or the same process as backfill, in "tail mode" after `backfill_done = true`).

- **Poll cadence**: every **3 s** (~half of avg 5.9 s block time). Calls `quai_blockNumber`; if head advanced, fetches new blocks + analytics via the same batched paths.
- **Finality buffer**: keeps the last `FINALITY_BUFFER = 15` blocks as `finalized = false`. On each tick, re-fetches the top `REORG_DEPTH = 10` block hashes (one cheap `walkHeaders` call) and compares against stored rows. Any mismatch → delete the divergent suffix (CASCADE drops `supply_analytics`), rewind cursor, log to `reorg_log`, re-ingest on next tick.
- **Chunk-boundary continuity**: on every ingest (backfill and tail), before writing the new chunk we verify `blocks[first].parentHash == stored_hash(first - 1)`. This catches deep reorgs the top-10 scan would miss. Mismatch → rewind cursor by `REORG_DEPTH`, log to `reorg_log` with `detection_mode='backfill_continuity'`, throw; outer loop retries after 5s.
- **Strict coverage**: every ingest asserts that the requested range returned a matching count of blocks, analytics, and burn balances. Any shortfall throws; cursor does not advance. No silent gaps.
- **Audit log**: `reorg_log` table (append-only) records every divergence event with `detection_mode`, `diverge_from`, old/new hashes, and cursor position for post-hoc review.
- **Rollup extension**: after each tick, invoke `rollup_worker` for the day/week/month containing the new head. The current day's row stays `partial = true` until a block dated on a later day finalizes it.

## 5. API surface changes

All existing routes keep their URLs and response shapes — swap the data source only, so the frontend doesn't change in this phase.

- `GET /api/stats` — read `ingest_cursor`, latest `supply_analytics` row (including `soap_burn_balance`), latest `blocks` row. For the live-stats KPI strip only (hash rates, share times, difficulty trio — fields that don't exist on the local node), fall back to the **public gateway** `https://rpc.quai.network` via `/mininginfo` + `/supply`. This is the only production code path that ever dials the public RPC. `s-maxage` unchanged.
- `GET /api/emissions?limit=N` — straight SQL: `supply_analytics` ⋈ `blocks` over the tail window. `limit` caps at 10k (unchanged). `MAX_DETAIL_WINDOW` logic becomes moot since all blocks have detail.
- `GET /api/blocks?limit=N` — straight SQL against `blocks`.

**New routes**:

- `GET /api/rollups?period={day|week|month}&from=YYYY-MM-DD&to=YYYY-MM-DD` — returns rollup rows in the range. This is what enables multi-year charts from a single query (<20 ms for 365 daily rows).
- `GET /api/health` — `ingest_cursor` snapshot, head lag (blocks behind RPC `quai_blockNumber`), last tail tick. Used for ops dashboards.

The frontend should stop fetching live RPC entirely except via these routes. Emission calculations happen server-side against the store; client receives only serialized values. In-process LRUs (`lib/cache.ts`) are retired — Postgres + Supabase's connection pooler is the cache.

## 6. Local node assumptions

The user runs `go-quai` with cyprus1 zone enabled on `10.0.0.12`, reachable from the app host on the private network. Ingest + tailer point **directly at the zone RPC** — no pathing prefix, no `usePathing: true` construction, no `/cyprus1` suffix. The URL is literally `http://10.0.0.12:9200`.

- `--http --http.addr 0.0.0.0 --http.port 9200 --http.api quai` (bind to the private interface, not the public one). Default go-quai zone RPC port is 9200 for cyprus1.
- No auth on the private network is fine. If exposed beyond LAN, put it behind WireGuard or an Nginx with basic auth — do not run unauthenticated RPC on the public internet.
- `--syncmode full` to guarantee historical `quai_getSupplyAnalyticsForBlock` answers all the way to genesis.

**Important:** the local node does NOT serve `/mininginfo` or `/supply` — those 404 because they're bolted on by the public gateway sidecar, not by core go-quai. The public gateway at `https://rpc.quai.network` remains the only source for those two endpoints.

App config adds two env vars:

- `QUAI_LOCAL_RPC=http://10.0.0.12:9200` — ingest + tail pipelines + all rollup computation. Direct zone endpoint, no pathing.
- `QUAI_PUBLIC_RPC=https://rpc.quai.network` — reserved exclusively for the **live-stats KPI strip** (`/mininginfo`, `/supply`) because those endpoints don't exist on the local node. **Never** used for ingest, backfill, or rollup reads.

`lib/quai/constants.ts` grows a `RPC_MODE` switch with a narrower meaning than before: ingest and historical reads are always local; the public RPC is dialed only for the two gateway-only KPI endpoints. If the local node is down, the KPI strip degrades gracefully; bulk routes continue to serve from Supabase.

## 7. Migration path

Each step ships and runs independently; none requires the next to be useful.

- **a. Schema + Supabase project** — create tables, indexes, RLS policies (anon = read-only on rollups + most-recent 10k blocks; service role = all). No app changes.
- **b. Backfill worker** — standalone script, populates `blocks` + `supply_analytics` + `ingest_cursor`. Dashboard still on live RPC. Can run overnight. Verify row counts and spot-check supply totals against `/supply`.
- **c. Rollup worker** — builds D/W/M tables once backfill is done. Pure SQL job, minutes to run initial build. Nothing user-facing changes yet.
- **d. Tailing worker** — bring `ingest_cursor` to head and keep it there. Dashboard still on live RPC but store is now usable.
- **e. Swap API routes** — flip `/api/stats`, `/api/emissions`, `/api/blocks` to read from Supabase; add `/api/rollups` and `/api/health`. Gate behind a `DATA_SOURCE=store` env var with `live` as the fallback, so rollback is one env flip.
- **f. Retire live-RPC fallback** — after a week of clean tailer uptime, remove `DATA_SOURCE=live` code paths and the `lib/cache.ts` LRU.

## 8. Open questions / risks

Previously listed concerns about SOAP vault tracking, burn-vs-vault split ratio, and base-fee burn status are **resolved** by source verification in `docs/emissions-full-picture.md` §8 — there is no vault, the split is 100% burn, and base-fee burn does not exist. Remaining items:

1. **Qi mint classification.** `emissions.ts` already warns that coinbase-derived `winnerToken` misclassifies Qi mints. Do we want a second winner-split metric based on `qi_added > 0` in analytics? Needs a user decision on which definition the dashboard surfaces.
2. **Genesis depth.** Does `quai_getSupplyAnalyticsForBlock` actually answer for block 1 on a full local node, or only from some later height? Needs a smoke test before committing to "full history." If there's a floor, the rollup for that initial period will carry a caveat flag.
3. **Reorg depth observed in practice.** Operator expectation is ≤10 block reorgs. Current settings: `REORG_DEPTH = 10`, `FINALITY_BUFFER = 15`. Validate with a review of `reorg_log` after a week of tail uptime — if max observed `cursor_before - diverge_from` stays well under 10, we're fine. If any event shows ≥10, raise both constants.
4. **Exchange-rate OHLC semantics.** `header.exchangeRate` is a point sample per block, not a traded rate. High/low over a day is meaningful; open/close is just first/last block's rate. Confirm the dashboard treats it as "protocol rate series," not "market OHLC."
5. **`workshareReward` is a global field from `/mininginfo`, not per-block.** The Phase 1 emission derivation multiplies today's reward by historical workshare counts, which is only correct near the tip. For historical rollups, do we (a) store `workshareReward` snapshots over time, (b) use analytics as the only emission signal and drop `nativeEmittedWei` from rollups, or (c) fetch a per-block workshare reward from the block header if one exists? Option (b) is simplest and preserves authoritativeness — recommend unless the user wants the estimate preserved.
6. **Service-role key handling.** Backfill + tailer need the Supabase service key. Plan: keep it only in the ingest host's env, never in `.env.local` that ships to Vercel. Worth confirming the deployment story (Vercel for UI, separate VM for workers) before coding.
7. **Hash rate / difficulty history.** `/mininginfo` is not per-block historical — it's a rolling window. If the dashboard wants historical hash-rate charts, we need a separate `mining_info_snapshots` table fed by the tailer on each tick (1 row per ~6 s = ~5M rows/yr, ~1 GB/yr). Out of scope for Phase 2 unless the user asks.

### Minor edge cases (flag, not load-bearing)

These create small systematic drift in `quai_total` vs. true monetary supply. None affect the burn signal (which comes from `soap_burn_balance`). Worth noting but not worth a code path in Phase 2:

- **Contract-without-code coinbase drops** (`core/state_processor.go:628-635`): when a miner configures a beneficiary contract that has no code yet, the coinbase reward is silently discarded — unminted, not burned. Reduces issuance, invisible to analytics.
- **New-account creation-fee haircut** (`core/state_processor.go:1447-1455, 1483-1491`): conversions or coinbase redemptions landing on non-existent addresses subtract `CallNewAccountGas * InitialBaseFee` from the redeemed amount before `AddBalance`. Implicit issuance reduction.
- **ETX dust at zero-address** (`core/state_processor.go:981`): residual balance from failed/partial ETXs at `0x0…0` is reset via `SetBalance`, which does NOT register in `SupplyRemoved` while its arrival did register in `SupplyAdded`. Causes a small counter drift in `quai_total` (amounts are negligible in practice).

File: `/home/mpoletiek/Devspace/QuaiEmissionsDB/docs/phase2-backend-plan.md`
