# Phase 2 Frontend Overhaul Plan — QuaiEmissionsDB

Revision date: 2026-04-23. Supersedes `docs/phase2-frontend-plan.md` (kept as historical reference).

Companion: `docs/phase2-backend-plan.md`. Authoritative schema: `migrations/0001_init.sql`, `0002_rollups.sql`, `0003_reorg_log.sql`.

---

## TL;DR

- **Keep two routes**: `/live` (head-of-chain, block-window) and `/history` (time-navigated, rollups). Root `/` redirects to `/history` (new: historian-first landing, not live-first).
- **Ingest is ~98% done**; rollups are empty until the backfill→tail transition fires the full rebuild. Frontend work must start against a mocked `/api/rollups` until the backend route ships.
- **Controls are simplified**: period toggle (D/W/M), range presets, custom date range. That's it. Log toggle, token filter, protocol events, and deep-link routes are deferred/cut.
- **Chart inventory trims from 12 proposed to 6 shipped** on `/history` (supply totals, daily issuance, net issuance, cumulative burn, winner split, block time). OHLC deferred pending rate-direction verification. Conversion flow cut.
- **Field-name reconciliation done**: the old plan's `quaiMinted` / `quaiSupplyEnd` etc. don't exist; the shipped schema uses `quai_added_sum`, `quai_net_emitted`, `quai_total_end`, etc. Hook types are updated below to match SQL exactly.
- **Ship order**: PR1 route split + shell + mocked `/api/rollups`. PR2 real endpoint + 3 core charts. PR3 remaining charts + historical KPIs. PR4 polish.

---

## 1. Information architecture — decision: keep the split, flip the landing

### Options considered

| Option | Pro | Con |
|---|---|---|
| Single page, tabs | One URL | Control semantics clash (block-window vs date-range); state blows up |
| `/live` + `/history` (old plan) | Clean separation of data sources | Two pages to maintain |
| Three routes (add `/health`) | Ops visibility | Not an end-user surface; defer as a backend-only JSON route |

**Decision: keep `/live` and `/history`.** The control semantics are incompatible — block window vs date range — and trying to unify them under one page leads to mode-switches that are worse than two routes.

### Route map

| Route | Purpose | Data source |
|---|---|---|
| `/` | 307 redirect → `/history` | — |
| `/live` | Head-of-chain, block-window KPIs + intraday charts. Phase 1 dashboard, repackaged. | `/api/stats`, `/api/emissions`, `/api/blocks` (live-RPC until backend swap per `phase2-backend-plan §7e`, then Supabase-backed) |
| `/history` | Time-navigated view driven by D/W/M rollups. Default landing. | `/api/rollups`, `/api/rollups/meta` |

**Change vs old plan**: the old plan redirected `/` to `/live`. Flipping to `/history` because (a) a year of history is now the point of the dashboard, (b) `/live` remains one click away in the top nav, and (c) bookmarks from Phase 1 will have been hitting `/`, which kept working. This is the biggest landing-page decision; flag if the user disagrees.

**`/history/[metric]`** (old plan §1 stretch): **cut**. Full-width-single-chart pages add routing + chart-prop surface area for no real payoff until a sharing/embedding use case exists. Revisit in Phase 3.

### Shared shell (`app/layout.tsx`)

Gains:
- Top nav with two tab-style links: `History` (default/primary) and `Live`. Active route pill.
- Right-aligned status cluster: **head block #N** (from `useHeadBlock`, 15s), **ingest lag** (head − `ingest_cursor.last_ingested_block` from `/api/health`, 30s) rendered as `· synced` / `· N blocks behind`, and a connection dot that goes amber when either query errors.
- No per-route controls in the shell. Controls live on the route.

---

## 2. Controls — `HistoryControls` (reduced from 6 to 3)

Old plan had 6 controls in one flex row. That's clutter for an info-dense dashboard. Cutting to the three that actually change what you see.

### Ratified

1. **Period toggle** — `D · W · M` segmented pill. Reuses `WindowSelector` visual language.
2. **Range presets** — `7D · 30D · 90D · YTD · 1Y · All`. Preset-aware:
   - `period=week` disables `7D` (auto-promotes to `30D`); `30D` is 4 points — still OK, keep it.
   - `period=month` disables `7D`/`30D`/`90D` (auto-promotes to `1Y`).
3. **Custom range** — icon button → `Popover` + `react-day-picker`. Unsets preset when a custom range is chosen.

### Cut

| Control | Verdict | Why |
|---|---|---|
| Scale toggle (linear/log) | **Cut from v1.** | Scan-first dashboard users don't expect non-linear Y axes. Individual charts that need log (supply totals) can ship a per-chart toggle later. Don't add a global control for one chart. |
| Token filter (QUAI/QI pills) | **Cut.** | Dual-token is mandated by `memory/project_decisions.md`. Hiding a series defeats the purpose of the dashboard. |
| Protocol events toggle | **Cut as a toggle; fold into charts.** | Just render the three reference lines (SOAP 2025-12-17, cliff 2026-02-03, Singularity 2026-03-19) unconditionally on charts whose X-axis is time, gated by the visible range crossing the event date. No toggle. |
| CSV download | **Cut.** Defer. |

### Landing state

`?period=day&range=30d` on the first visit. First-visit detection = no query params. If the user types `/history` bare, we navigate to `/history?period=day&range=30d` with `router.replace()` so back-button doesn't yo-yo.

**Open-plan §10.2 decision**: `day + 30D` beats `month + All` because 30D is the one a daily user wants; `All` is one click away via the preset.

---

## 3. Chart inventory — dispositions and new charts

### Existing Phase 1 charts

| Component | `/live` | `/history` | Notes |
|---|---|---|---|
| `KpiStrip` | **Keep as-is** | Replaced by `HistoricalKpiStrip` (new) | `/live` KPI strip still uses `/api/stats`. Do NOT add a "Burned QUAI" card client-side yet — requires `soap_burn_balance` to be exposed on `/api/stats` (backend ask, confirmed in §8 below). Add once available; until then, the existing 4-card strip stands. |
| `AlgorithmPanel` | **Keep** | — | Hash-rate / shares are point-in-time `/mininginfo` fields; not rolled up. |
| `CumulativeEmissionsChart` | **Keep** (renamed internally; visible label already "Authoritative Supply Totals") | **Rewrite** → `SupplyTotalsChart` (time-axis from rollups) | Live variant keeps per-block; history variant uses `quai_total_end` / `qi_total_end`. |
| `NetSupplyChart` | **Keep** | **Rewrite** → `NetDailyIssuanceChart` | See "New charts" below. |
| `MintActivityChart` | **Keep** | **Retire — replaced by `WinnerTokenSplitChart`** | At D/W/M grain, the delta-based bucketing the live chart does becomes trivial ("every period has mints"). The rollup-level analog is the winner-token split. |
| `EmissionsPerBlockChart` | **Keep** | — | Per-block granularity, not rolled up. No Phase 2 rollup equivalent planned. |
| `ExchangeRateChart` | **Keep** | **Rewrite** → see §3 "ExchangeRateHistoryChart" | OHLC deferred; ship a simple close-price line until rate-direction is verified. |

### New `/history` charts (6 shipped, 2 cut vs old plan)

All charts sit on a `grid-cols-1 xl:grid-cols-2` grid. Fields are canonical SQL column names from `migrations/0002_rollups.sql`.

| # | Component | Purpose | Rollup fields consumed | Recharts primitives | Caveats |
|---|---|---|---|---|---|
| 1 | `SupplyTotalsChart` | End-of-period QUAI and QI supply | `quai_total_end`, `qi_total_end`, `period_start` | `LineChart` dual-axis | Already net of SOAP burn server-side (`quai_api.go:290-292`); no client-side subtraction. Log toggle is per-chart, ship in PR3. |
| 2 | `DailyIssuanceChart` | Gross QUAI + QI credited per period | `quai_added_sum`, `qi_added_sum` | `ComposedChart` with two grouped `Bar`s, dual-axis | **Label copy must say "credited", not "minted".** `quai_added_sum` is gross credit flow (per `phase2-backend-plan §Supply Reconciliation`), which includes things like conversion credits — NOT pure block-reward issuance. Add `ⓘ` popover. |
| 3 | `NetDailyIssuanceChart` | Net change per period per token | `quai_net_emitted`, `qi_net_emitted` | `ComposedChart` two `Bar`s, `ReferenceLine` y=0 | Signed. `quai_net_emitted = quai_added_sum − quai_removed_sum`. **This is NOT net issuance after burn** — it's net gross-flow. For "true" net issuance incl. SOAP burn, use `quai_added_sum − burn_delta`, which we derive client-side for the KPI strip only (not as a third chart — too confusable). |
| 4 | `CumulativeBurnChart` | Authoritative SOAP burn history | `burn_close` (primary), `burn_delta` (secondary) | `AreaChart` for `burn_close`, overlay `Bar` for `burn_delta` | Single red/amber palette. The only authoritative burn signal on the dashboard. Add big `ⓘ` popover explaining why `quai_removed_sum` is NOT burn. |
| 5 | `WinnerTokenSplitChart` | Share of blocks where QUAI vs QI coinbase won | `winner_quai_count`, `winner_qi_count`, derived `block_count − (quai+qi)` for any unclassified | Stacked `BarChart`, 100% normalized (`stackOffset="expand"`) | **Schema drift caught**: old plan asked for `blocksQuaiOnly` / `blocksQiOnly` / `blocksBoth` / `blocksInactive`. Shipped schema has only `winner_quai_count` and `winner_qi_count`. Two-way split is all we get from the current rollup. Add `ⓘ` popover linking to `emissions.ts` comment on the coinbase-derived-winner caveat (Qi mints can be misclassified when coinbase is QUAI-ledger). If we want the 4-way split, that's a **backend ask** (see §8). |
| 6 | `BlockTimeChart` | Period-average block time in seconds | `avg_block_time`, `period_start` | `LineChart` single-series | Column shipped in `migrations/0004_avg_block_time.sql`. Computed at rollup time as `EXTRACT(EPOCH FROM (MAX(ts) − MIN(ts))) / NULLIF(block_count − 1, 0)`. Expected values ~5.8–6.2 s on cyprus1. |

### Deferred / cut

| # | Component | Disposition |
|---|---|---|
| — | `ExchangeRateOHLCChart` | **Defer from PR3; ship `ExchangeRateHistoryChart` (close-only line) in PR3 instead.** Schema has `rate_open/high/low/close` (good!) but the Phase 1 caveat in `ExchangeRateChart.tsx` ("Qi/Quai vs Quai/Qi not yet verified") still stands. Open-plan §10.4: **decision — don't ship OHLC until direction is verified**. Close-only line shows the directional signal safely. OHLC is a stretch goal for Phase 3. |
| — | `ConversionFlowChart` | **Cut.** Rollup has `conversion_flow_sum` (the summed `header.conversionFlowAmount` field). Not the same as indexed conversion events; the aggregate doesn't distinguish Quai→Qi from Qi→Quai direction. Don't ship a chart that misrepresents the signal. Revisit in Phase 3 if conversion events get indexed. |

### Historical KPI strip (`HistoricalKpiStrip`)

Sits above the chart grid on `/history`. Derived client-side from the same `useRollups` response — no extra query.

| KPI | Formula | Field(s) |
|---|---|---|
| QUAI credited in range | `Σ quai_added_sum` | rollups |
| QI credited in range | `Σ qi_added_sum` | rollups |
| SOAP burn in range | `burn_close[last] − burn_close[first]` (or `Σ burn_delta`, equivalent) | rollups |
| Net QUAI issuance | `Σ quai_net_emitted − (burn_close[last] − burn_close[first])` | rollups |
| Peak daily QUAI credit | `max(quai_added_sum)` when `period=day` ; otherwise hide | rollups |

Copy in the strip uses **"credited"** not **"minted"** to keep the vocabulary honest with the shipped schema. Subtitle: small-caps "d/w/m over 30d" (whatever the range is).

---

## 4. Hooks + TanStack Query layout

### Hook signatures (in `lib/hooks.ts`)

```ts
// New
export type Period = "day" | "week" | "month";
export type Rollup = {
  periodStart: string;              // ISO date (UTC midnight/week-start/month-start)
  firstBlock: number;
  lastBlock: number;
  blockCount: number;
  partial: boolean;
  quaiAddedSum: bigint;
  quaiRemovedSum: bigint;
  qiAddedSum: bigint;
  qiRemovedSum: bigint;
  quaiNetEmitted: bigint;
  qiNetEmitted: bigint;
  quaiTotalEnd: bigint;
  qiTotalEnd: bigint;
  burnClose: bigint;
  burnDelta: bigint;
  winnerQuaiCount: number;
  winnerQiCount: number;
  workshareTotal: number;
  workshareAvg: number;
  conversionFlowSum: bigint;
  rateOpen: bigint;
  rateHigh: bigint;
  rateLow: bigint;
  rateClose: bigint;
};

export function useRollups(args: {
  period: Period;
  from: string;                     // ISO date
  to: string;                       // ISO date
}): UseQueryResult<Rollup[]>;

export function useRollupsMeta(): UseQueryResult<{
  earliestRollup: string;           // ISO date
  latestRollup: string;
}>;

export function useHeadBlock(): UseQueryResult<{
  headBlock: number;
  ingestCursor: number;
  lagBlocks: number;
  lastTailedAt: string;
}>;

// Derived selector (pure, no network) — powers the historical KPI strip.
export function useRollupSummary(args: {
  period: Period;
  from: string;
  to: string;
}): {
  quaiCredited: bigint;
  qiCredited: bigint;
  burnInRange: bigint;
  netQuaiIssuance: bigint;
  peakDailyQuaiCredit: bigint | null;
};
```

### Query keys

| Key | TTL | Refetch | Notes |
|---|---|---|---|
| `["rollups", period, fromISO, toISO]` | `staleTime: Infinity`, `gcTime: 24h` | off | Past periods are immutable. `placeholderData: keepPreviousData` to avoid skeleton churn on range changes. |
| `["rollups-tail", period]` | `staleTime: 60s` | 60s interval | Fetches last 2 periods only. `useRollups` internally merges tail over range so the current partial period updates. |
| `["rollups-meta"]` | `staleTime: 1h` | off | |
| `["head-block"]` | `staleTime: 15s` | 15s interval | Used by shell status cluster. |
| `["stats"]` (existing) | unchanged | 30s | |
| `["emissions", limit]` (existing) | unchanged | 60s | |
| `["blocks", limit]` (existing) | unchanged | 60s | |

**Merging strategy for `useRollups`**: pull the immutable range; if today's period (first-of-day / ISO-Monday / 1st-of-month) falls inside [from, to], overlay the `rollups-tail` row for that period. One hook, two queries under the hood; consumers see one sorted array.

### `lib/bucket.ts`

**Keep**, used only by `/live` charts. Do not import into `/history` code. Add a JSDoc comment to that effect to prevent drift.

---

## 5. URL-as-state for `/history`

### Canonical query shape

```
/history?period=day&range=30d
/history?period=week&from=2025-01-01&to=2025-06-30
```

- `period` ∈ `day|week|month` (required; default `day`)
- Either `range` ∈ `7d|30d|90d|ytd|1y|all` **OR** both `from` and `to` as `YYYY-MM-DD` (custom)
- Custom range takes precedence if both present; prefer `range` when only preset is set

### Parser hook

```ts
// lib/useHistoryParams.ts
export type HistoryParams = {
  period: Period;
  from: string;   // ISO date (resolved from preset if needed)
  to: string;     // ISO date
  preset: "7d" | "30d" | "90d" | "ytd" | "1y" | "all" | "custom";
};

export function useHistoryParams(): {
  params: HistoryParams;
  setParams: (next: Partial<HistoryParams>) => void;
};
```

- Uses `useSearchParams` + `useRouter().replace()` (never `push` — back button shouldn't walk through every toggle).
- Resolves `range=all` to `[meta.earliestRollup, today]` by reading the `useRollupsMeta` cache. If meta hasn't loaded, renders a skeleton until it does.
- Resolves `range=ytd` to `[Jan 1 current year UTC, today]`.
- On invalid params, replaces URL with defaults; doesn't crash.

### Why URL-as-state

- Deep-linkable / shareable chart views.
- Back button resets to the previous view, not the previous toggle press.
- Survives hard reloads.

---

## 6. Performance

| Scenario | Point count | Verdict |
|---|---|---|
| `day` × 1Y | 365 | Fine |
| `day` × 5Y | 1825 | Fine |
| `day` × "All" at 10Y | 3650 | Add dismissible banner: "Switch to weekly for faster rendering?" — no silent downsample. |
| `week` × 10Y | 520 | Fine |
| `month` × 10Y | 120 | Fine |

- **Lazy-load** `/history` chart bundle via `next/dynamic({ ssr: false })` per chart card. Recharts is ~100 KB gzipped; splitting keeps the initial history-page payload small. `/live` stays eager (already loading Recharts).
- **Bigints** converted to float only at `data={rows}` build step, not in the query function, so tooltips can show raw.
- OHLC custom shapes are NOT a concern — we're not shipping OHLC in Phase 2.

---

## 7. Bigint handling

Unchanged from old plan §7 — the approach is right.

- Wire format: decimal strings tagged `{ __big: "..." }` by existing `serializeBig` / `reviveBig`.
- Backend must tag with the same sentinel. The existing `/api/rollups` route (to be built) should call `serializeBig(rows)` before responding. **Backend ask.**
- `weiToFloat`, `qitsToFloat` from `lib/format.ts` reused. For 10^25-range cumulative sums, `weiToFloat(..., 0)` returns a plain JS number that loses precision past 15 digits but renders "1.2M QUAI" fine. Document in chart subtitles if values exceed 10^24 (far future).

---

## 8. Backend asks — reconciled against shipped schema

Cross-referenced against `migrations/0002_rollups.sql` and `phase2-backend-plan.md §5`.

### Routes that must exist

| Route | Status | Shape |
|---|---|---|
| `GET /api/rollups?period={day\|week\|month}&from=YYYY-MM-DD&to=YYYY-MM-DD` | **Not built** | `{ period, rows: Rollup[] }`. Bigints tagged via `serializeBig`. Camel-case keys (match TypeScript hook type above); backend maps from `snake_case` SQL. |
| `GET /api/rollups/meta` | **Not built** | `{ earliestRollup: ISO, latestRollup: ISO, grains: { day: {rows, latestPeriod}, week:..., month:... } }` |
| `GET /api/health` | **Not built** | `{ headBlock, lastIngestedBlock, lagBlocks, lastTailedAt, backfillDone, partialDays }` |
| `GET /api/stats` | **Works, data-source-swap pending** (`phase2-backend-plan §7e`) | Add `analytics.soapBurnBalance` passthrough so `KpiStrip` can add the burn card without a second call. |

### Rollup row — fields present in schema (good, no ask)

`period_start`, `first_block`, `last_block`, `block_count`, `partial`, `quai_added_sum`, `quai_removed_sum`, `qi_added_sum`, `qi_removed_sum`, `quai_net_emitted`, `qi_net_emitted`, `quai_total_end`, `qi_total_end`, `burn_close`, `burn_delta`, `winner_quai_count`, `winner_qi_count`, `workshare_total`, `workshare_avg`, `avg_block_time`, `conversion_flow_sum`, `rate_open`, `rate_high`, `rate_low`, `rate_close`.

### Fields the frontend plan wants that are NOT in schema

| Field | Chart that needs it | Path forward |
|---|---|---|
| 4-way winner split (`blocksBoth`, `blocksInactive`) | `WinnerTokenSplitChart` 4-way variant | **Ship 2-way in PR3 with what exists** (`winner_quai_count`, `winner_qi_count`, unknown = `block_count − sum`). 4-way is a Phase 3 enhancement — requires per-block delta-based classification as in live `MintActivityChart`, which needs extra rollup columns. Not on Phase 2 critical path. |
| Per-block `soap_burn_balance` exposed via `/api/stats` | `KpiStrip` burn card | **Approved; part of PR3.** Surface `analytics.soapBurnBalance` in the `/api/stats` response shape. Data exists in `supply_analytics.soap_burn_balance`. Pure response-shape addition; no DB change. |

### Fields in schema that the frontend does NOT consume

Currently nothing to surface for: `workshare_total`, `workshare_avg`, `conversion_flow_sum`. These get stored but no chart consumes them in PR2/PR3. Leave in the hook type for completeness; ignore in charts. Phase 3 can use `workshare_avg` for an efficiency chart if asked.

### Bigint serialization on new routes

`/api/rollups` and `/api/rollups/meta` must apply `serializeBig` to numeric(78,0) fields before JSON.stringify, per the Phase 1 contract. The hook `useRollups` applies `reviveBig` on the other side. No new machinery.

---

## 9. Open questions → decisions

Walking old plan §10, locking answers where we can.

| # | Question | Decision |
|---|---|---|
| 1 | UTC vs local time | **UTC for bucketing, render in user locale with a "UTC" subtitle on the X-axis title.** Backend already buckets via `date_trunc(... AT TIME ZONE 'UTC')` (`scripts/ingest/rollup.ts:30`). Frontend `Intl.DateTimeFormat` for labels. Locked. |
| 2 | Default landing | **`period=day&range=30d` on `/history`**, and `/` 307-redirects to `/history`. Locked. |
| 3 | "All"-range definition | **From `meta.earliestRollup`**, not genesis. Waits on `/api/rollups/meta` to load. Locked. |
| 4 | Exchange-rate OHLC | **Do NOT ship OHLC until rate direction is verified.** Ship a close-only line chart `ExchangeRateHistoryChart` in PR3. OHLC is Phase 3. Locked. |
| 5 | Conversion flow chart | **Cut from Phase 2.** `conversion_flow_sum` doesn't carry direction; not worth a chart. Revisit if conversion events get indexed. Locked. |
| 6 | Log-scale default | **Off. No global toggle.** If a single chart (supply totals) strongly benefits, add a per-chart toggle in PR4. Locked. |
| 7 | Empty-data states | When a range is fully before `earliestRollup`, each chart card renders an inline empty state with a "Jump to earliest data" button that sets `?from=earliestRollup&to=earliestRollup+30d`. Locked. |
| 8 | "Net minus burn" as a derived series on `DailyIssuanceChart` | **Cut.** The KPI strip already shows "Net QUAI issuance"; adding a third line on `DailyIssuanceChart` makes it a confusing 3-series 2-axis chart. One number in the KPI, one dedicated `NetDailyIssuanceChart` — that's clearer. Locked. |

### User decisions (locked 2026-04-23)

| # | Question | Decision |
|---|---|---|
| 1 | Landing redirect target | **`/` → 307 → `/history`**. `/live` stays one click away in the top nav. |
| 2 | Vocabulary on `/history` | **"credited" everywhere** (KPI strip, chart labels, tooltips, legends) to match `quai_added_sum` semantics. `/live` keeps its existing "mint/burn" phrasing — it's operating at a different granularity and the Phase 1 copy isn't misleading there. |
| 3 | `avg_block_time` column | **Shipped in `migrations/0004_avg_block_time.sql`** plus matching `scripts/ingest/rollup.ts` update. Column populated via `npm run rollup` full rebuild. `BlockTimeChart` lands in PR3, not PR4. |
| 4 | `analytics.soapBurnBalance` on `/api/stats` | **Approved.** Add to the existing `/api/stats` response shape; unlocks the 5th KPI tile (SOAP burn balance) on `/live`. Field already exists in `supply_analytics.soap_burn_balance` — pure response-shape addition. |

---

## 10. Non-goals — explicitly NOT building in Phase 2

- CSV / JSON export buttons
- OHLC candlesticks (deferred to Phase 3 pending rate-direction verification)
- Conversion flow chart (deferred to Phase 3 pending event indexing)
- Log-scale global toggle (per-chart may happen in PR4 for supply totals)
- Token-filter control (dual-token is mandatory per project decisions)
- Protocol-events toggle (lines render unconditionally when range covers event date)
- Deep-link `/history/[metric]` per-chart pages
- Dark/light theme toggle (dark-only)
- Hash-rate historical chart (requires `mining_info_snapshots` table — out of scope per `phase2-backend-plan §8.7`)
- 4-way winner split (`winnerBoth`, `winnerInactive`) — requires extra rollup columns, deferred
- Mobile-first redesign (responsive is required; redesign is not)
- Internationalization beyond `Intl.DateTimeFormat`/`toLocaleString()`
- Service worker / PWA shell
- Real-time push (WebSocket) updates — polling stays

---

## 11. Sequenced PR plan

Each PR is independently mergeable. Live view stays functional throughout. Feature flag: `NEXT_PUBLIC_ROLLUPS_ENABLED` (default `false`). When false, `/history` shows a "Historical data coming soon" card; `/live` works.

### PR 1 — Route split + shell + mocked history

**Scope:**
- Move `app/page.tsx` body into new `app/live/page.tsx` verbatim (Phase 1 pattern unchanged).
- Replace `app/page.tsx` with a 307 redirect to `/history`.
- New `app/history/page.tsx` with placeholder cards: `HistoryControls` (fully wired to URL state) + a "Coming soon — rollups backend not yet live" empty state.
- New `components/layout/TopNav.tsx` with two tabs. Wire `useHeadBlock` skeleton (errors on missing `/api/health` are silently suppressed until PR2).
- New `lib/useHistoryParams.ts`.
- New `components/dashboard/history/HistoryControls.tsx`, `PeriodToggle.tsx`, `RangePresets.tsx`, `DateRangePicker.tsx`.
- Install `react-day-picker` (new dep).

**No data:** zero new network calls. URL state works end-to-end.

**Exit criteria:** `/live` renders identically to Phase 1; `/` redirects to `/history`; `/history` shows controls and a placeholder; all three pages share a top nav.

### PR 2 — Real rollups + 3 core charts

**Depends on:** backend `/api/rollups`, `/api/rollups/meta`, `/api/health` shipped and serving. Confirm with backend agent before starting. If the ingest-backfill hasn't finished (`backfill_done=false`), rollup tables are empty — feature flag stays false and we merge behind it.

**Scope:**
- `lib/hooks.ts`: add `useRollups`, `useRollupsMeta`, `useHeadBlock`, `useRollupSummary`.
- `components/dashboard/history/`:
  - `SupplyTotalsChart.tsx`
  - `DailyIssuanceChart.tsx`
  - `NetDailyIssuanceChart.tsx`
- Wire chart grid in `app/history/page.tsx`.
- Reference-line component `ProtocolEventLines.tsx` (unconditional, gated by visible range).
- Flip `NEXT_PUBLIC_ROLLUPS_ENABLED=true` in `.env.local` / production env.

**Exit criteria:** `/history?period=day&range=30d` renders 3 charts from real data; tail-merge refreshes today's partial period on a 60s tick.

### PR 3 — Remaining charts + historical KPIs

**Scope:**
- `HistoricalKpiStrip.tsx` (5 tiles, derived client-side).
- `CumulativeBurnChart.tsx` (with big ⓘ popover on burn semantics).
- `WinnerTokenSplitChart.tsx` (2-way; documented caveat).
- `ExchangeRateHistoryChart.tsx` (close-only line; NOT OHLC).
- `BlockTimeChart.tsx` (consumes `avg_block_time` column, shipped in `migrations/0004_avg_block_time.sql`).
- `/live`: add the 5th KPI tile "SOAP burn balance" reading `analytics.soapBurnBalance` from `/api/stats`. Requires matching `/api/stats` response-shape update — bundle into this PR.
- Empty-state component for out-of-range requests.

**Exit criteria:** `/history` grid is complete at 6 charts + KPI strip; `/live` KPI strip has 5 tiles.

### PR 4 — Polish

**Scope:**
- Per-chart log-scale toggle on `SupplyTotalsChart` only.
- Per-chart `ⓘ` popover content across all history charts.
- "Switch to weekly?" banner when `day` range > 2000 days.
- Mobile control row refinements.
- Loading / error state consistency audit.
- Lighthouse pass: performance ≥ 90, accessibility ≥ 90.
- A11y: chart alt-text summaries via `aria-label` describing current visible range and headline number.

**Exit criteria:** no console errors; Lighthouse scores hit target; manual keyboard-only walkthrough passes on both routes.

---

## 12. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Backend `/api/rollups` slips past frontend PR2 readiness | Medium | High | Feature flag `NEXT_PUBLIC_ROLLUPS_ENABLED=false` + placeholder `/history` page from PR1. No hard dependency until PR2 is actually merged. |
| `avg_block_time` column rejected / delayed | **Resolved 2026-04-23** | — | Column shipped in `migrations/0004_avg_block_time.sql`; values populated via full rollup rebuild. No longer a risk. |
| Exchange-rate direction stays ambiguous | Medium | Medium | Ship close-only line; OHLC stays in Phase 3 queue. |
| Rollup table has gaps / `burn_delta` anomalies post-backfill | Low | Medium | Each chart renders empty state per missing period; tooltip shows raw values incl. `partial` flag so users can spot drift. |
| Bundle size creep past 300 KB on `/history` | Low | Low | Lazy-load charts; Recharts tree-shake; measure per PR. |

---

## 13. References

- `docs/phase2-frontend-plan.md` — prior plan (historical).
- `docs/phase2-backend-plan.md` — authoritative for API shapes & reconciliation.
- `docs/emissions-full-picture.md` — domain reference (burn semantics, SOAP, §8).
- `migrations/0001_init.sql`, `0002_rollups.sql` — authoritative schema.
- `scripts/ingest/run.ts`, `scripts/ingest/rollup.ts` — ingest + rollup worker.
- `app/page.tsx`, `components/dashboard/*`, `lib/hooks.ts` — current Phase 1 surface.
- Project memory: `memory/project_decisions.md`, `memory/quai_supply_reconciliation.md`.

---

**Author:** Frontend Developer agent
**Planning date:** 2026-04-23
**Depends on:** backend PRs for `/api/rollups`, `/api/rollups/meta`, `/api/health`, `soapBurnBalance` on `/api/stats` (PR3). `avg_block_time` rollup column already shipped (migration 0004).
**Migration strategy:** 4 PRs, feature-flagged; `/live` functional throughout
