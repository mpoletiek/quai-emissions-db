# Quai Emissions Dashboard — Design Spec

**Status:** design spec
**Date:** 2026-04-24 (revised)
**Scope:** cyprus1-only. Design-level guidance for pages, metrics, layout, and copy. No user research phase. No public API. No multi-zone. No growth/distribution strategy.
**Companions:** [`emissions-full-picture.md`](./emissions-full-picture.md), [`sampling.md`](./sampling.md), [`phase3-soap-dashboard.md`](./phase3-soap-dashboard.md)

---

## 1. Intent

Five pages, each with a clear primary audience, one flagship chart, and 3–4 supporting widgets. The project's data layer is strong; this spec is about surfacing the right metrics in the right order with copy that makes them legible. Everything proposed here is buildable from data already in Postgres.

---

## 2. Target audiences

Four audiences, each mapped to exactly one primary page.

| Audience | Primary page | Their question |
|---|---|---|
| **Holders** — retail QUAI/Qi holders tracking dilution, burn, and net emissions | `/` | Is QUAI becoming more or less scarce, and by how much? |
| **Miners** — GPU operators, BTC/LTC merge-mining pool operators | `/mining` | What am I earning (per algo), and is the mix shifting? |
| **Researchers / analysts** — people writing reports or comparing chains | `/tokenomics`, `/history` | How does Quai's supply decompose, and what's the curve over time? |
| **Developers / ops** — integrators watching chain health | `/live` | Is the chain healthy, what's the tip, how recent are reorgs? |

A single visitor may belong to multiple audiences; each page still has one *primary* to resolve design conflicts.

---

## 3. Site map

```
/              → Home — realized supply story (holders)
/mining        → SOAP mining (miners)
/tokenomics    → Supply decomposition (researchers)
/history       → Rollup analytics (analysts / existing page refined)
/live          → Block stream + chain health (devs / existing page refined)
```

Nav: **Home · Mining · Tokenomics · History · Live**. A persistent freshness pill on the right ("last block N · 12s ago") serves as the trust signal across all pages.

---

## 4. Shared components

Build these once; used everywhere.

| Component | Purpose |
|---|---|
| `<HeroStrip>` | 3–4 KPI cards at the top of every page. One card is visually dominant (larger type, accent color); others are supporting. |
| `<FreshnessLabel>` | "Updated Ns ago" with a color dot: green < 30s, amber < 5m, red otherwise. Persistent in nav. |
| `<ProtocolEventLines>` | Vertical reference lines on time-series charts: TGE, Qi launch, SOAP activation, Singularity Fork, Kraken listing. Single registry. (Already partially shipped.) |
| `<SamplingFootnote>` | Small info icon with tooltip on charts that use sampled columns. Links to `docs/sampling.md`. |
| `<TimeframeToggle>` | Per-chart time window (1d / 7d / 30d / 90d / all). URL-state driven. |
| `<RebaseToggle>` | Already shipped in history; reuse where cumulative charts benefit from rebasing to an event. |

**Hero strip layout rule:** **one dominant card (~40% of the strip width), three supporting cards of equal weight.** 6 equal-weight KPIs is cognitively flat and reads as "wall of numbers." Users need to know what to look at first.

**Accessibility baseline (non-negotiable):**

- Every chart series has both a color and a direct label or pattern — no color-only encoding.
- Avoid red for high-frequency signals; reserve for true alerts (reorg events).
- Every interactive element (toggles, share buttons, chart legends) is keyboard-reachable with a visible focus ring.
- Live counters throttle screen-reader announcements to ≤1 per 30s.
- Dual-axis charts avoided. If unavoidable, axes are color-coded *and* labeled inline.

**Mobile baseline (non-negotiable):**

- Hero strip collapses to 2 cards visible above the fold on 375px (dominant + one supporting); the rest swipeable.
- Flagship charts: legends become a bottom drawer, not a side panel. Tooltips triggered on tap.
- No side-by-side panels at < 768px — stack vertically.

---

## 5. Page specs

Each page: *audience → job → hero strip → flagship chart → supporting → copy → layout notes.*

### 5.1 `/` — Home

**Audience:** holders (primary). Also the default landing page for anyone clicking a link.

**Job:** in 15 seconds, show whether QUAI is becoming more or less scarce, and how much has been burned.

**Hero strip (3 cards):**

1. **[Dominant] Realized circulating QUAI** — value, with sub-line "gross minted X · SOAP burned Y." Pulled from `/api/supply` (see §6). This is the headline number.
2. **Cumulative SOAP burn** — with 🔥, since SOAP activation at block 1,171,500. Subtitle: "X QUAI removed from circulation."
3. **Net issuance (7d)** — signed number ("+N QUAI" green / "−N QUAI" dimmed). Subtitle: "added − SOAP burn, last 7 days."

Price is *not* a hero card on `/`. It's in the persistent nav pill alongside freshness. (Rationale: coupling the hero to spot price makes every bear-market visit feel like a tombstone.)

**Flagship chart — "QUAI supply: gross vs realized"**

Line chart, TGE → today.

- Light area: `quai_total_end` (gross minted, from rollups).
- Wedge beneath: cumulative SOAP burn (`burn_close`).
- Solid top line: realized circulating = gross + genesis premine constant − pre-Singularity unlock skip at the fork.
- Reference lines (via `<ProtocolEventLines>`): SOAP activation, Singularity Fork.
- Hover: all three values, delta vs. 7 days ago.
- Timeframe toggle: 30d / 90d / 1y / all.

Copy: chart title **"QUAI supply story."** Caption below: *"The gap between gross minted and realized circulating is the cumulative SOAP burn. The step at Singularity (2026-03-19) shows ~1.67 B QUAI of future unlocks permanently skipped."*

**Supporting widgets (below flagship):**

- **Qi cumulative supply** — single line. No burn (Qi has no sinks). Caption explains Qi started mining in April 2025.
- **Miner token election (last 4 000 blocks)** — donut: % won by QUAI, % won by Qi. Caption: *"Miners elect per block based on the live conversion ratio. The K-Quai controller adjusts that ratio over a rolling 4 000-block window."*
- **Net daily issuance (last 30 days)** — small bar chart. Bars colored by sign. Click-through to `/history` preselected to 30d net issuance.

**Layout:**

- Desktop: hero strip → flagship (full-width) → 3-column supporting grid.
- Mobile: hero (2 visible, swipe) → flagship (height reduced, legend drawer) → supporting stacked.

**Copy principles for this page:**

- Avoid "tokenomics," "deflationary," "ultra sound." Say what the chart shows.
- Every number has a unit. QUAI, Qi, %, days, blocks. No bare integers.
- Footnote on realized circulating: *"gross minted already net of SOAP burn at RPC layer; this chart adds back the genesis baseline."* (Prevents the double-subtract footgun.)

---

### 5.2 `/tokenomics` — Supply decomposition

**Audience:** researchers (primary). Analysts writing reports.

**Job:** decompose the supply into sources and sinks with every term sourced and traceable.

**Hero strip (4 cards):**

1. **[Dominant] Realized circulating QUAI** — same number as `/` for consistency.
2. **Genesis premine** — 3 B QUAI (constant, with footnote citing source).
3. **Singularity skip** — −1.667 B QUAI (constant, with date and block).
4. **Cumulative mining emissions** — running sum since TGE.

**Flagship chart — "Supply equation decomposition"**

Stacked area, TGE → today, four series:

- Base: Genesis unlocks (per the vesting schedule; drops by ~1.67 B at Singularity).
- Layer 2: Cumulative QUAI mining emissions.
- Layer 3 (tab to show/hide): Cumulative Qi mining emissions (separate scale).
- Wedge below: cumulative SOAP burn.

X-axis annotations for every `<ProtocolEventLines>` event.

Copy: *"Total supply = Genesis unlocks + Mining emissions − SOAP burns. This chart shows each term independently."*

**Supporting widgets:**

- **Conversion flow + slippage** — `conversion_flow_sum` per period from rollups. Side panel: illustration of the cubic slippage curve. Caption: *"The K-Quai controller imposes a minimum 20 bps slippage, scaling cubically with conversion volume relative to the network average."*
- **Exchange rate OHLC** — already shipped in `/history`; reuse component.
- **Genesis vesting schedule** — static chart from committed JSON. Per-cohort unlocks over time, with Singularity skip shown as missing area. Caption names cohorts (team, investors, foundation, ecosystem).
- **Comparison table** — one honest row per chain: Quai, BTC, Kaspa, Monero, ETH. Columns: max supply policy, current annual emission %, halving model, burn mechanism. Plain text; no ranking.

**Layout:**

- Desktop: hero → flagship full-width → 2×2 supporting grid.
- Mobile: hero → flagship → supporting stacked; comparison table becomes horizontally scrollable.

**Copy principles:**

- Every constant cites its source in a footnote.
- SOAP, Singularity, TGE are linked to short inline definitions (popovers).
- No marketing adjectives.

---

### 5.3 `/mining` — SOAP mining dashboard

**Audience:** miners (primary). Both GPU operators and merge-mining pool operators.

**Job:** show what miners are currently earning per algo and how the algo mix is evolving.

**Hero strip (4 cards):**

1. **[Dominant] Combined network hashrate** — KawPoW H/s + SHA equivalent + Scrypt equivalent. Sub-line: per-algo split.
2. **Avg block reward (last 1h)** — base reward + expected workshare rewards. Subtitle: "per block, in QUAI."
3. **Avg block time** — in seconds, last 1h trailing.
4. **% blocks won by KawPoW (last 1 000)** — single number. Subtitle: "SHA and Scrypt contribute via workshares, not seals."

**Flagship chart — "SOAP algorithm composition over time"**

Stacked area, 100%-normalized, three series (KawPoW seals, SHA workshares, Scrypt workshares). Range: SOAP activation → today.

- Reference line at Singularity Fork (workshare inclusion limit doubled 16→32).
- Hover: absolute counts per algo.
- Caption: *"After SOAP activation on 2025-12-17, KawPoW finds blocks; SHA and Scrypt workshares are merge-mined from BTC and LTC/DOGE and count toward the block reward distribution."*

**Supporting widgets:**

- **Per-algo hashrate** — three-line chart from `*_hashrate_avg` rollup columns. `<SamplingFootnote>` applies.
- **Per-algo difficulty** — same shape, from `*_difficulty_avg`.
- **Block reward decomposition** — per-period bars: base reward (solid) + total workshare rewards (stacked on top). From `base_block_reward_avg` and `workshare_reward_avg × workshare_total`. Caption: *"Each workshare earns `workshare_reward = estimated_block_reward / (expected_workshares_per_block + 1)`."*
- **Uncled ratio** — two lines (SHA, Scrypt): `*_uncled_ema_sum / *_count_ema_sum`. Caption: *"Uncled workshares are non-native coinbase shares that still counted for reward distribution. Not the same as stale."* (Per `docs/soap_mining_data_model.md`.)
- **ProgPoW decay close-up** — already in `docs/phase3-soap-dashboard.md` plan; keep as-is.
- **Top coinbases (last 7d)** — table of top 10 `primary_coinbase` addresses by blocks won. Columns: short address, blocks won, % of window. Caption: *"Coinbase addresses; may represent pools or solo miners."*

**Layout:**

- Desktop: hero → flagship full-width → 3-column grid of supporting charts, then coinbase table full-width at bottom.
- Mobile: hero → flagship → supporting stacked → coinbase table with sticky header.

**Copy principles:**

- Miner audience knows the terms — don't define hashrate, difficulty, uncle. Do define SOAP-specific terms (workshare, KawPoW seal, uncled) once near the flagship.
- Every sampled metric explicitly footnoted. Miners care about precision.
- No marketing framing ("Bitcoin's hashrate redirected!"); just show the data.

---

### 5.4 `/history` — Rollup analytics (refined)

**Audience:** analysts (primary). The existing page audience.

**Job:** let someone arbitrarily slice period × range × metric and export what they see.

**Changes from today's page:**

1. **Add a hero strip** (4 cards, one dominant). Cards show KPIs *for the selected range*, not live: total QUAI emitted in range, total SOAP burn in range, KawPoW share in range, avg block time in range. Each card shows delta vs. the prior equal-length range.
2. **Promote one chart to flagship, rotate by preset:**
   - "Since SOAP" preset → flagship is SOAP algo composition.
   - "Since Singularity" preset → flagship is realized-supply curve.
   - Default / "All" / "1y" → flagship is dual-token cumulative supply.
3. **Demote the other charts to a 3-column grid** below the flagship, unchanged otherwise.
4. **Add `<SamplingFootnote>`** on every chart using sampled columns (per-algo workshares extrapolated, per-algo hashrates/difficulties averaged).
5. **Rename nav label** from "History" to "History" but ensure landing copy says *"analyst view — slice by period and range"* so researchers know this isn't the supply-decomposition page.

No new data work. Pure UX restructure.

**Layout unchanged** otherwise.

---

### 5.5 `/live` — Block stream + chain health (refined)

**Audience:** developers / ops (primary). Secondary: anyone who wants "real-time" feel.

**Job:** show the chain is alive, healthy, and producing blocks; surface reorg events.

**Changes from today's page:**

1. **Hero strip (4 cards):**
   - **[Dominant] Block height** — cyprus1, with age in seconds since last block.
   - **Sync state** — "synced" / "N blocks behind," from `/api/health`.
   - **Reorgs (last 24h)** — count, linked to a log table below.
   - **Workshares per block (1h avg)** — from live stats.

2. **Flagship chart: block interval scatter with reorg markers** — each block a dot (y-axis: seconds since previous block); reorg events overlaid as red triangles. Tooltip on triangle shows the reorg-log row (diverge_from, old_hash → new_hash, depth).

3. **Existing live charts demoted** to a 3-column grid: cumulative emissions, per-block reward, mint activity, exchange rate, algorithm panel. Keep as supporting; add `<ShareChart>` nothing — we're not doing share-as-image (see §7).

4. **New widget: recent blocks feed** — live-updating table, last 20 blocks. Columns: block #, age, winner (QUAI/Qi), coinbase short, exchange rate, workshare count. Celenium-style.

5. **New widget: reorg log** — paginated table from `reorg_log`. Columns: logged_at, detection_mode, diverge_from, cursor_before, note.

**Layout:**

- Desktop: hero → flagship (full-width, height ~300px) → 2-column split (recent blocks feed | existing 3-card algorithm/emissions panel) → reorg log full-width.
- Mobile: hero → flagship → recent blocks → algorithm panel → reorg log (all stacked).

**Copy principles:**

- "Block #" not "block number." Analyst shorthand.
- Reorg UI copy is factual, not alarming: *"A reorg is a routine consensus event. Tracked here for transparency."*

---

## 6. Data contract

What exists, what to add. Nothing here requires new ingest — all data is already landed.

### 6.1 Reuse (no change)

- `/api/rollups` — period aggregates (but see 6.3 below for SELECT expansion).
- `/api/rollups/meta` — date bounds.
- `/api/health` — sync state.
- `/api/stats` — live stats.
- `/api/blocks`, `/api/emissions` — live block-window data.

### 6.2 Extend `Rollup` TypeScript type

The existing `Rollup` type in `lib/quai/types.ts` lacks the 18 SOAP columns added in `migrations/0005_soap_mining.sql`. Also, `/api/rollups` currently doesn't SELECT them.

- Expand the SELECT in `app/api/rollups/route.ts` to include all columns.
- Extend the `Rollup` type with new fields typed as `bigint | null` / `number | null` (the SOAP columns are NULL for pre-SOAP periods).
- Add a small helper `nz(v: bigint | null): bigint => v ?? 0n` for chart consumers.
- Update existing chart consumers to null-guard anywhere they reference new columns.

Realistic estimate: 2–3 PRs over 2–3 days. (Not "one PR" as the prior revision implied.)

### 6.3 Add Postgres views

Put the realized-supply math in the database, not in route handlers. Single source of truth; prevents the double-subtract footgun being reintroduced.

```sql
-- migrations/0006_supply_views.sql
CREATE VIEW v_supply_daily AS
SELECT
  period_start,
  quai_total_end,
  qi_total_end,
  burn_close,
  burn_delta,
  -- realized circulating adds back the genesis premine constant
  -- and (for period_start >= 2026-03-19) subtracts the Singularity skip
  (quai_total_end + 3000000000::numeric
    - CASE WHEN period_start >= DATE '2026-03-19'
           THEN 1667159984::numeric
           ELSE 0 END) AS realized_circulating
FROM rollups_daily;

-- similarly for weekly, monthly
```

Endpoint: `/api/supply?period=day|week|month&from=YYYY-MM-DD&to=YYYY-MM-DD&include=qi,burn,genesis` — one endpoint, composable flags. Replaces the two endpoints in the prior revision.

Caching: `s-maxage=60, stale-while-revalidate=300`. Matches existing rollup cache behavior.

### 6.4 Protocol constants module

One file, `lib/quai/protocol-constants.ts`, exporting:

- `GENESIS_PREMINE_QUAI = 3_000_000_000n` (with source note: go-quai chain config)
- `SINGULARITY_SKIP_QUAI = 1_667_159_984n` (with source note: Singularity Fork announcement, Prime block 1,530,500)
- `KAWPOW_FORK_BLOCK = 1_171_500n` (already exists in `lib/quai/rewards.ts`; re-export from here)
- `PROTOCOL_EVENTS` — registry: `{ id, label, date, blockNumber, description }[]`. Consumed by `<ProtocolEventLines>`.

No automated drift validator (out of scope). Add a source comment next to each constant with the reference.

### 6.5 New small endpoints

| Endpoint | Purpose | Source | Cache |
|---|---|---|---|
| `/api/supply` | supply curves (day/week/month, composable `include`) | `v_supply_*` views | 60s s-maxage / 300s SWR |
| `/api/reorgs` | paginated reorg log | `reorg_log` | 60s |
| `/api/coinbase-leaderboard` | top N coinbases, configurable window | `blocks` aggregation | 5 min |

`/api/coinbase-leaderboard` needs a supporting index:

```sql
-- migrations/0007_coinbase_index.sql
CREATE INDEX IF NOT EXISTS blocks_coinbase_ts_idx
  ON blocks (primary_coinbase, ts DESC);
```

No off-chain price feed (price lives in the nav pill sourced from a single CoinGecko call, cached in-memory in the route handler for 60s; if it fails, display "—"). No server-rendered chart images. No public `/api/v1/*`.

---

## 7. Out of scope (explicit)

To prevent future scope creep, these are **not** part of this work:

- Multi-zone ingest or UI scaffolding. cyprus1-only.
- Public `/api/v1/*`. Existing `/api/*` routes are dashboard-internal.
- Server-rendered chart images (`/api/share/chart.png`), OG images, `<ShareChart>`.
- Press / embed / screenshot surfaces.
- User-research phase.
- Newsletter, growth tracking, analytics instrumentation beyond basic pageview stats.
- USD-denominated panels beyond the single nav-pill price indicator.
- Mining profitability calculator.
- Cross-chain comparison panels beyond the one static table in `/tokenomics`.

---

## 8. Build sequence

Four phases. Each is independently shippable. Estimates are one-engineer working days; double-engineer scenarios cut ~40%.

### Phase 1 — Foundations (8–12 days)

- `lib/quai/protocol-constants.ts` with all constants and event registry.
- Extend `Rollup` type + `/api/rollups` SELECT to include SOAP columns. Null-guard existing consumers.
- Commit genesis vesting JSON (per-cohort schedule).
- Add migrations `0006_supply_views.sql` and `0007_coinbase_index.sql`.
- Build shared components: `<HeroStrip>`, `<FreshnessLabel>`, `<ProtocolEventLines>` (consolidate existing), `<SamplingFootnote>`, `<TimeframeToggle>`.
- Build `/api/supply` endpoint.
- Integration test: render a throwaway page that composes all shared components.

**Exit criteria:** shared components render on a test page against real data; `/api/supply?period=day&from=...&to=...` returns correct realized-circulating values matching a hand-computed reference.

### Phase 2 — Home + Tokenomics (10–14 days)

- `/` page: hero strip + flagship + three supporting widgets.
- `/tokenomics` page: hero strip + flagship + four supporting widgets.
- Nav update: add Tokenomics link; freshness pill persists.
- QA pass on mobile (375px) and a11y baseline (keyboard + screen reader).

**Exit criteria:** both pages render correctly at 375px and 1440px; flagship charts match hand-computed values at three sampled dates.

### Phase 3 — Mining (10–14 days)

- `/mining` page: hero + flagship + 5 supporting widgets + coinbase table.
- `/api/coinbase-leaderboard` endpoint.
- Verify all sampled-column charts carry `<SamplingFootnote>`.

**Exit criteria:** per-algo charts reconcile with the `mining_info` raw rows at three sampled blocks; coinbase table loads in < 1s for 7d window.

### Phase 4 — History & Live refinement (5–7 days)

- `/history` hero strip + flagship rotation by preset.
- `/live` hero restructure + flagship block-interval scatter + recent-blocks feed + reorg log widget.
- `/api/reorgs` endpoint.

**Exit criteria:** reorg log renders live when a synthetic reorg is injected in dev; block-interval scatter correctly places markers from `reorg_log`.

**Total: ~33–47 engineering days for one engineer, ~20–28 days for two.**

---

## 9. Open items to verify before Phase 1

Three constants that must be correct. A wrong number in any of these makes every chart wrong.

1. **Genesis premine** (3 B QUAI total) — confirm against the go-quai chain config the exact amount and per-cohort breakdown for the vesting chart.
2. **Singularity skip** (1,667,159,984 QUAI) — confirm against the Singularity Fork announcement or go-quai diff at Prime block 1,530,500.
3. **SOAP activation block** — already a code constant (`KAWPOW_FORK_BLOCK = 1,171,500`). Confirm the block's timestamp on cyprus1 for the event-line date; don't hardcode a date.

Resolve by reading go-quai source and the foundation's announcement posts. Budget half a day.

---

**End of spec.** This document replaces the prior growth-strategy-focused proposal. Everything above is buildable on the existing data layer with the additions in §6.
