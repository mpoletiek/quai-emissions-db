# Phase 3 — SOAP Dashboard (pickup doc)

Short context dump for resuming dashboard work after this ingest run completes.

## Where we left off

**Ingest**: unified dense/sampled model is live. Running a clean backfill
from genesis → tip, ETA ~6–7 hours. When it flips to tail mode you'll see:
```
[ingest] caught up to head #N (safe #M); entering tail mode
[ingest] running full rollup rebuild post-backfill…
```
After that, tail-mode ingest dense-every-block at 3 s poll.

**DB schema**: migrations `0001..0005` applied. `0005_soap_mining.sql` adds
per-algo workshare columns on `blocks`, the `mining_info` table, and per-algo
aggregates on all three `rollups_*` tables.

**Data-layer docs**: `docs/sampling.md` is the source of truth for which
columns are dense vs sampled, and maps each column back to the dashboard
chart(s) that consume it. Read it first when touching any chart that uses
`rollups_*` data.

**Dashboard status**:
- `/history` — shipped, works end-to-end against existing columns.
- `/live` — shipped.
- `/soap` — **not built yet** (this phase).

## SOAP page — proposed charts

All backed by `rollups_daily/weekly/monthly` via `/api/rollups`. Follow the
period/range preset UX already on `/history` (PeriodToggle, RangePresets,
since-event presets, rebase banner).

1. **Per-algo hashrate curves.** Three lines (blue=KawPoW, red=SHA, green=Scrypt).
   Columns: `kawpow_hashrate_avg`, `sha_hashrate_avg`, `scrypt_hashrate_avg`.
   Pre-SOAP: ProgPoW-only, derive from `difficulty_avg / avg_block_time`.
   Transition: ProtocolEventLines at SOAP (already wired).

2. **Per-algo workshare composition.** Stacked 100% bar per period.
   Columns: `ws_kawpow_sum`, `ws_progpow_sum`, `ws_sha_sum`, `ws_scrypt_sum`.
   Story arc: ProgPoW dominant → SOAP → transition decay → KawPoW/SHA/Scrypt mix.

3. **ProgPoW decay close-up.** Zoomed version of #2 for
   `2025-12-17 → 2026-01-14` (SOAP day + 4-week transition window).
   Single-metric view of `ws_progpow_sum` falling to 0.

4. **Block-reward curve.** Two lines: `base_block_reward_avg` (per block) and
   `workshare_reward_avg` (per share). Pre-SOAP has only base reward; at SOAP
   the per-share reward appears. Shows the Quai reward economics evolving.

5. **Uncled ratio (aux-PoW efficiency).** Two lines:
   `sha_uncled_ema_sum / sha_count_ema_sum`, scrypt equivalent.
   Narrative: cross-chain miners' reward-redistribution pressure.
   See `migrations/0005_soap_mining.sql` header comment for the full "what
   is uncled" explanation — it's NOT stale; it's non-native-coinbase.

6. **SOAP burn re-contextualized.** `CumulativeBurnChart` already exists on
   `/history`; link to it or embed a compact variant on `/soap`.

## Implementation order

1. Add a `/soap` route in `app/soap/page.tsx`, mirroring the `/history` layout
   shell (HistoryControls, ProtocolEventsLegend, chart grid).
2. New components under `components/dashboard/soap/` for each chart above.
3. Rollup type in `lib/quai/types.ts` — add the new columns to the `Rollup`
   type (not yet done; consumers currently work because existing `/history`
   charts don't reference the new columns).
4. `/api/rollups` already returns every column from the table; verify the
   new columns serialize correctly (BigInt values need `serializeBig`).
5. Build charts in the order above. Each is roughly 80-150 lines of Recharts
   and follows the patterns in `components/dashboard/history/`.

## Context / gotchas future-you should know

- **Debug-endpoint dependency.** `QUAI_ZONE_RPC=https://debug.rpc.quai.network/cyprus1`
  is required because `quai_getMiningInfo` takes `(blockNrOrHash, decimal)` per
  PR 2696. The stock gateway rejects the 2-arg signature. If the PR merges to
  mainline, we can point at `rpc.quai.network/cyprus1` without code changes.
- **`workshares` lives on the top-level block response, not `uncles`.** That
  naming confused us at first; `block.Uncles()` in go-quai is legacy
  Ethereum-style stale-block slots and is effectively empty post-SOAP.
- **KawPoW/ProgPoW uncled is structurally zero.** The protocol only tracks
  uncled for SHA/Scrypt (aux-PoW'd from foreign chains). Don't build charts
  around zero KawPoW uncled — there's nothing to show.
- **Reward math bit-verified.** `lib/quai/rewards.ts::calculateQuaiReward`
  matches `quai_getMiningInfo.baseBlockReward` exactly (see
  `scripts/smoke-rewards.ts`). Trust `blocks.base_block_reward`.
- **Backfill sampling**: `ws_*_count` on backfill-era rows is NULL for
  non-sampled blocks (every 60th block has real counts). Rollup extrapolates.
  Tail-mode rows are dense, so tail-only periods have exact sums. `/history`
  charts don't touch `ws_*_count` so this doesn't affect shipped pages.
- **Existing rebase feature** (event-preset filters like "Since SOAP" with
  implicit cumulative-series rebasing to zero) lives in
  `lib/useHistoryParams.ts` and should be honored on the SOAP page too — the
  "since SOAP" preset is particularly relevant here. `HistoryControls` can
  be reused verbatim.

## Known deferred work (not blocking SOAP page)

- **Managed Postgres swap.** `DATABASE_URL` still points at `10.0.0.13:5432`.
  `.env.local.example` has the Supabase/Neon/RDS placeholder. Before ship,
  move to a hosted PG, add `?sslmode=require`.
- **Per-block reward attribution / miner leaderboards.** Explicitly out of
  scope. Would require a `workshares` table (~30M rows post-SOAP).
- **KawPoW stale-share tracking.** Not possible from RPC alone; would need
  P2P-level instrumentation or a new go-quai endpoint.

## Relevant files index

- `docs/sampling.md` — dense-vs-sampled column ownership
- `migrations/0005_soap_mining.sql` — schema + inline rationale for every column
- `lib/quai/rewards.ts` — client-side `CalculateQuaiReward`, verified
- `scripts/ingest/run.ts` — unified ingest, hybrid sampling
- `scripts/ingest/rollup.ts` — aggregation SQL with sampling-aware formulas
- `scripts/smoke-rewards.ts` — regression test for the reward port
- `components/dashboard/history/ProtocolEventLines.tsx` — shared event markers
  + legend; the SOAP-page charts should reuse it
- `components/dashboard/history/HistoryControls.tsx` — period/range/event UI
