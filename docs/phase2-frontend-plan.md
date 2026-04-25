# Phase 2 Frontend Plan — QuaiEmissionsDB

Planning document for the Phase 2 UI/UX overhaul. Backend plan (rollups, Supabase) is the companion doc at `docs/phase2-backend-plan.md`; where this plan assumes a field or endpoint shape, that is flagged as a backend ask.

---

## 1. Information architecture

Split from the current single-page dashboard into two routes, plus a shared shell. Both routes live under the App Router in `app/`.

- `/` — **redirect** to `/live` (keeps muscle memory working for bookmarks from Phase 1).
- `/live` — head-of-chain view. KPI strip, algorithm panel, intra-day charts driven by `/api/stats` and `/api/emissions?limit=N`. This is Phase 1 repackaged: block-window semantics survive here because 10k blocks ≈ 16h is a legitimate "recent activity" lens.
- `/history` — time-navigated view. Driven by the new rollups API. Date range + period granularity control everything below it.

**Data sourcing split.** Historical + ingest-backed APIs (`/api/rollups`, the store-backed `/api/emissions`, store-backed `/api/blocks`) are sourced from the local node `http://10.0.0.12:9200` via the backend store. The live KPI row (`KpiStrip`) still calls `/api/stats`, which the backend continues to back with public-RPC `/mininginfo` + `/supply` (these two endpoints don't exist on the local node). Frontend doesn't care about the split — still calls `/api/*` uniformly. This is the agreed "tier 1" choice for Phase 2; no self-hosting of mininginfo is planned.
- `/history/[metric]` (optional, stretch) — deep-link a single chart at full width (e.g. `/history/daily-issuance?from=2024-01-01&to=2025-01-01&period=day`). Useful for sharing; same components as the grid cards, one per page.

Shared shell (`app/layout.tsx`) gains a top nav with two tabs (Live / History), a connection indicator, and a chain-head block number pulled from `useLiveStats` so users always know how fresh the data is. Tab state is the route; no local state.

Rationale for splitting: the controls for live (block window, seconds-scale refresh) and history (date range, periods, immutable cache) are incompatible. Putting them on one page forces either a mode-switch (confusing) or cramming both into the header (cluttered). Two routes keep each surface honest.

---

## 2. Controls — replacement for `WindowSelector`

On `/live`, keep `WindowSelector` (500 / 2000 / 10000 blocks). It is correct for what that page does.

On `/history`, build a `HistoryControls` component that sits directly under the page title and spans full width on desktop, stacks on mobile. Props:

```
{
  period: 'day' | 'week' | 'month';
  range: { from: Date; to: Date };
  scale: 'linear' | 'log';
  onChange(next): void;
}
```

Layout (left to right):

1. **Period toggle** — segmented control: `D · W · M`. Reuses the visual language of `WindowSelector` (rounded pill, `bg-white/10` active). Component: `PeriodToggle`.
2. **Quick range presets** — segmented: `7D · 30D · 90D · YTD · 1Y · All`. Default landing = `30D` on `period=day`. When `period=week`, disable `7D` / `30D` and auto-promote to `90D`. When `period=month`, disable everything below `1Y`. Component: `RangePresets`.
3. **Custom range picker** — icon button that opens a two-calendar popover (shadcn `Popover` + `react-day-picker`). Selecting a custom range unsets the preset pill. Component: `DateRangePicker`.
4. **Scale toggle** — `Linear / Log` for charts where log is meaningful (cumulative supply, exchange rate). Global toggle; individual charts opt in via a prop `allowLog`. Component: `ScaleToggle`.
5. **Token filter** (subtle, right-aligned) — two small pill checkboxes `QUAI` / `QI`. Both on by default. Hides the corresponding series in dual-token charts without refetching. Component: `TokenFilter`. No effect on single-token charts.
6. **Show protocol events** (toggle, dimmer styling) — when enabled, every time-series chart on `/history` renders Recharts `ReferenceLine` annotations for:
   - SOAP activation: **2025-12-17**
   - 1-year cliff (Team / Seed / Strategic unlocks): **~2026-02-03**
   - Singularity Fork: **2026-03-19**
   Vertical lines with short labels at the top of the plot area. Toggle defaults to **off** for the 30D default view (noise) and **on** when the range spans > 90 days. Component: `ProtocolEventsToggle`. Charts opt in via a shared `<ProtocolEventLines period={period} />` subcomponent so they all render identically.

All six controls are in one flex row with wrap. The period toggle and range presets are the "primary" pair; scale, token, and events toggle are tertiary and styled dimmer (`text-white/60`).

No download / CSV button in v1 — defer unless asked.

---

## 3. Charts — disposition

Current chart files and what happens to each:

| File | Disposition | Notes |
| --- | --- | --- |
| `KpiStrip.tsx` | **Live only, add one card.** | Stays on `/live`. Add a fifth card: **Burned QUAI (SOAP)** — latest cumulative balance of the `0x0050AF…` burn address (source: `analytics.soapBurnBalance`, **backend ask**; see §10). "Total QUAI Supply" stays sourced from `analytics.quaiSupplyTotal` **unchanged** — that field is already net of the SOAP burn server-side (node subtracts `balanceOf(0x0050AF…)` in `internal/quaiapi/quai_api.go:290-292`, equality verified against `/supply`). **Do NOT add a client-side subtraction.** A variant `HistoricalKpiStrip` on `/history` shows period-anchored values: "QUAI minted in range", "QI minted in range", "Net issuance", "Burned in range" (= `burn_close_end − burn_close_start`), "Peak daily issuance". |
| `AlgorithmPanel.tsx` | **Live only.** | Algo stats are point-in-time; no backend rollup planned. |
| `CumulativeEmissionsChart.tsx` | **Rewrite for historical.** | Rename to `SupplyTotalsChart`. X-axis becomes `periodStart` (date). Keep dual-axis dual-line. Data = `rollups.quaiSupplyEnd` / `qiSupplyEnd` (last-in-period snapshot). Recharts: `LineChart` unchanged. Keep a thin live variant on `/live` using existing per-block data. |
| `NetSupplyChart.tsx` | **Rewrite for historical.** | Becomes `NetDailyIssuanceChart` (daily / weekly / monthly). X = date, Y1 = QUAI `mint_delta − burn_delta` (SOAP burn only), Y2 = QI `mint_delta` (Qi has no burn sink). Recharts: `ComposedChart` with two `Bar`s on a shared zero baseline (positive up, negative down). **Do NOT source "burned" from `quaiSupplyRemoved`** — that field is gross transfer outflow and will wildly overstate destruction. |
| `MintActivityChart.tsx` | **Retire on history, keep on live.** | "Mint activity by block-count bucket" stops being useful at day/week resolution — rolled up it just says "every period has mints". Replace on history with `WinnerTokenSplitChart` (see below). |
| `EmissionsPerBlockChart.tsx` | **Live only.** | Per-block granularity. Not rolled up. |
| `ExchangeRateChart.tsx` | **Both.** | On live: keep current per-block line. On history: replace with `ExchangeRateOHLCChart` — OHLC candlesticks per period. Requires backend to expose `open/high/low/close` of `header.exchangeRate` per day. Recharts: `ComposedChart` + custom `Bar` (wick) + `Rectangle` shape for body. |

### New historical charts

All charts below read from the rollups endpoint. Each is a Card on the `/history` grid (`grid-cols-1 xl:grid-cols-2`, full-width for flow chart).

1. **`DailyIssuanceChart`** — "QUAI minted per period, dual-axis with Qi". X = `periodStart`, Y1 (left, blue) = `quaiMinted`, Y2 (right, green) = `qiMinted`. Recharts `ComposedChart` with two `Bar`s (grouped, not stacked — the scales differ). Token filter hides bars.
2. **`NetDailyIssuanceChart`** — signed issuance (mint − burn) per period, per token. `ComposedChart` with two `Bar`s; negative values render below axis in red/orange shade. Zero reference line via `ReferenceLine`.
3. **`CumulativeBurnChart`** — authoritative SOAP-burn history. X = `periodStart`, Y = cumulative burn-address balance (`burn_close` from rollups = end-of-period snapshot of `balanceOf(0x0050AF…)`). `AreaChart`, single series, red/amber fill. Data source: **`rollups.burn_close`** (cumulative) with an optional secondary `Bar` layer showing `rollups.burn_delta` (per-period burn rate). **Not** `quaiSupplyRemoved` — that is gross transfer churn (e.g. block #7598181: added=2657, removed=2660, net ≈ −3 QUAI from ordinary user-to-user transfers, not burn). The `0x0050AF…` balance delta is the only authoritative SOAP-burn signal.
4. **`WinnerTokenSplitChart`** — per period, share of blocks where QUAI-only / QI-only / both / inactive won. Stacked `BarChart`, 100% normalized (`stackOffset="expand"`). Fields: `blocksQuaiOnly`, `blocksQiOnly`, `blocksBoth`, `blocksInactive` — **backend ask** (these already exist per block; backend just counts them).
5. **`ExchangeRateOHLCChart`** — candlesticks. `ComposedChart` + custom `Bar shape` for body, `ErrorBar` or second invisible Bar for wick. Option to overlay a 7-period SMA `Line`.
6. **`ConversionFlowChart`** (stretch) — monthly bar pair of Quai→Qi vs Qi→Quai conversion volume. Requires conversion event indexing — **backend ask**; skip from v1 if not ready.
7. **`SupplyTotalsChart`** (the rewritten cumulative chart) — end-of-period QUAI and QI supply, dual-axis, `LineChart`. Log scale toggleable.
8. **`BlockTimeChart`** (bonus) — period-average block time. Single-series `LineChart`. Useful to anchor "why did issuance drop this month" to "blocks were slower".

Each chart card has title, subtitle (data source field), and a small "ⓘ" popover explaining semantics — we already burned time on `MintActivityChart`'s "election vs delta" confusion; lean into documenting.

---

## 4. State management

**URL as source of truth** for history view. Query params:

```
/history?period=day&from=2025-01-01&to=2025-04-18&scale=linear&tokens=quai,qi
```

Use `next/navigation`'s `useSearchParams` + `useRouter().replace()` for updates (no push — back button should not step through every toggle). A `useHistoryParams()` hook parses/validates and returns typed values with defaults.

**TanStack Query keys**:

- `['rollups', period, fromISO, toISO]` for the main range fetch. The query function hits `/api/rollups?period=…&from=…&to=…` and returns an array, reviving bigints via `reviveBig`.
- `['rollups-latest', period]` — small tail-of-range query (last 2 periods) used to refresh only the current, in-progress period every 60s. Prevents refetching 365 points every minute.
- `['live-stats']`, `['live-emissions', limit]` — unchanged from Phase 1.

**Caching**:

- Past-period rollups are immutable. `staleTime: Infinity`, `gcTime: 24h`. Set `refetchOnWindowFocus: false`.
- Current-period rollup is the exception. Split the range: render N-1 periods from the long-lived cache, last period from `rollups-latest` with `refetchInterval: 60_000`. The hook merges them before returning to components.
- Navigating between ranges that overlap an existing cache should hit the cache. Use `placeholderData: keepPreviousData` to avoid skeletons during range changes.

---

## 5. Data hooks

New in `lib/hooks.ts`:

- `useRollups({ period, from, to })` → `{ rows: Rollup[]; isLoading; error }`. Internally composes `rollups-range` (immutable) + `rollups-latest` (refreshing). Returns already-sorted rows with bigints revived.
- `useLiveStats()` — rename from existing `useStats` on `/live` context; wrapper around the same underlying query to signal intent.
- `useHeadBlock()` — tiny query used by the layout shell's "latest block #N" indicator; 15s refresh; shared across routes.
- `useRollupSummary({ period, from, to })` — derived client-side selector over `useRollups` output that computes the historical KPI strip values (total minted, total burned, net, peak day). No extra network call.

Keep `useEmissions` and `useBlocks` unchanged for `/live`.

Expected rollup row shape (backend ask — confirm before coding):

```
Rollup {
  period: 'day' | 'week' | 'month';
  periodStart: string;            // ISO UTC
  blockFirst: number;
  blockLast: number;
  quaiMinted: string;             // wei as decimal string (net mint from block rewards)
  qiMinted: string;               // qits as decimal string
  quaiSupplyEnd: string;          // already burn-adjusted by the node
  qiSupplyEnd: string;
  // SOAP burn — the only authoritative burn signal. Sourced from balanceOf(0x0050AF…).
  burn_close: string;             // wei, cumulative burn-address balance at period end
  burn_delta: string;             // wei, burn_close(t) − burn_close(t-1); per-period burn
  soap_burn_balance: string;      // alias of burn_close for clarity where it's exposed per-block
  exchangeRateOpen: string;       // wei
  exchangeRateHigh: string;
  exchangeRateLow: string;
  exchangeRateClose: string;
  blocksQuaiOnly: number;
  blocksQiOnly: number;
  blocksBoth: number;
  blocksInactive: number;
  avgBlockTime: number;           // seconds
}
```

---

## 6. Performance

Point counts per chart at each granularity:

- `period=day` over 1Y = 365 points — trivial for Recharts.
- `period=day` over 5Y = 1825 — still fine (<2k). No bucketing needed.
- `period=day` "All" over 10Y = 3650 — starting to feel it. Solution: when range > 2000 days, auto-prompt "switch to weekly?" via a dismissible banner. Don't silently downsample; users asked for daily.
- `period=week` over 10Y = 520 — trivial.
- `period=month` over 10Y = 120 — trivial.

Since rollups are server-side, `lib/bucket.ts` is **not needed** for the historical view. Keep it — `/live` still benefits from `bucketAvg`/`bucketLast`/`bucketSum` at 10k blocks. Do not import it on the history page.

OHLC candlestick rendering is the one hot spot. Custom shapes in Recharts get expensive past ~1000 candles. For `period=day` over 5Y+, cap visible candles at 1000 by forcing weekly aggregation at that range.

Lazy-load the `/history` route's chart bundle via dynamic imports (`next/dynamic({ ssr: false })`) per chart card. Recharts is ~100KB gzipped; splitting each chart keeps the initial history-page payload sane. Live charts stay eager (they're already loading).

---

## 7. Bigint handling

Rollup sums will exceed `Number.MAX_SAFE_INTEGER` — 1 QUAI = 10^18 wei, and a year of issuance is ~10^25 wei. Mandatory:

- Wire format: decimal strings for every `wei`/`qits` field. JSON numbers are off the table.
- Client-side: existing `reviveBig` in `lib/quai/serialize.ts` already converts tagged strings back to `bigint`. Reuse it. Backend should tag with the same sentinel Phase 1 uses (confirm with backend agent).
- Chart-time conversion: keep using `weiToFloat` / `qitsToFloat` from `lib/format.ts` at the last possible moment — in the `data={rows}` build step, not in the query. This preserves precision for tooltips that want raw values.
- For cumulative / log-scale axes with 10^25 values, `weiToFloat(..., 0)` coerces to a JS number that's fine for display (loses precision past 15 digits, but the Y-axis label rounds to "1.2M QUAI" anyway). Document this as acceptable.

No new bigint machinery needed. Confirmed approach.

---

## 8. Migration plan

Ship in 4 PRs, each independently releasable:

1. **PR 1 — Route split (no feature change).** Introduce `app/live/page.tsx` containing the current `app/page.tsx` body verbatim. Add `app/history/page.tsx` with a "Coming soon" placeholder and the new `HistoryControls` wired to URL state but no data. Add layout-level nav tabs. Redirect `/` → `/live`. Ship.
2. **PR 2 — Rollups hook + first 3 charts.** Build `useRollups`, `useHistoryParams`, and ship `SupplyTotalsChart`, `DailyIssuanceChart`, `NetDailyIssuanceChart` behind the new controls. Requires backend rollups endpoint to exist; feature-flag via `NEXT_PUBLIC_ROLLUPS_ENABLED` so we can merge/deploy before the backend cut-over.
3. **PR 3 — Remaining charts.** `WinnerTokenSplitChart`, `ExchangeRateOHLCChart`, `CumulativeBurnChart`, `BlockTimeChart`, historical KPI strip.
4. **PR 4 — Polish.** Log-scale toggle wiring, token filter, deep-link `/history/[metric]` pages, per-chart info popovers, mobile refinement.

Live and history coexist the entire time. `/live` is untouched until PR 4, which may reuse new primitives (e.g. `TokenFilter`) but doesn't need to.

---

## 9. Backend asks (consolidated)

Frontend depends on the following fields/endpoints from the Phase 2 backend. All other requirements are covered by existing Phase 1 APIs.

- **Rollups endpoint** `/api/rollups?period=…&from=…&to=…` returning the row shape defined in §5.
- **Rollups meta** `/api/rollups/meta` returning `{ earliestRollup: ISOString, latestRollup: ISOString }` for the "All" range lower bound.
- **SOAP burn series on rollups** — `burn_close` (cumulative, wei decimal string) and `burn_delta` (per-period, wei decimal string) derived from `quai_getBalance("0x0050AF0000000000000000000000000000000000", blockNumber)` at each period boundary. These replace the previously-proposed `quaiBurnedCumulative` (which was going to sum `quaiSupplyRemoved` — incorrect; that's gross outflow, not burn).
- **Per-block SOAP balance on `/api/emissions`** — `analytics.soapBurnBalance` (wei decimal string), same source, exposed per-block so `KpiStrip` can show the latest value without a separate RPC call.
- **Winner token counts on rollups** — `blocksQuaiOnly`, `blocksQiOnly`, `blocksBoth`, `blocksInactive` (already computed per block; rollup just counts).
- **Exchange rate OHLC on rollups** — `exchangeRateOpen/High/Low/Close` per period; blocked on Phase 1 direction verification (open question 4).
- **`/api/stats` continues to proxy public-RPC `/mininginfo` + `/supply`** — unchanged; local node does not expose those two endpoints, so the existing arrangement stands.

Explicitly **not** asked: base-fee-burn series, SOAP staking-vault balance, any "burn vs. vault split" breakdown. Source verification (`docs/emissions-full-picture.md` §8) confirms 100% of confirmed QUAI destruction flows through the single `0x0050AF…` address; there is no base-fee burn (entire `gasPrice * gasUsed` is recycled to miners), no protocol-level vault, and no other on-chain sinks. Any earlier references in this doc to those have been removed.

---

## 10. Open questions

1. **UTC vs local time for "day"** — rollups should be UTC midnight–midnight on the backend (deterministic, cache-friendly). The frontend should render with `Intl.DateTimeFormat` in user locale and label the axis "UTC" in a subtitle to avoid confusion when a US user sees a "day" that starts at 7pm local. Confirm.
2. **Default landing range** — proposing `period=day, range=last 30D`. Alternative: `period=month, range=All` for the "historian" first impression. Pick before PR 2.
3. **"All"-range definition** — from genesis block's timestamp, or from first block the backend has ingested? Prefer the latter — the UI fetches `meta.earliestRollup` once and uses that as the All lower bound. Requires a small `/api/rollups/meta` endpoint — backend ask.
4. **Exchange rate semantics** — Phase 1 explicitly flags "directional signal, Qi/Quai vs Quai/Qi not yet verified." Do not build OHLC until this is nailed down; ship the OHLC chart in PR 3 only if the direction is known, otherwise keep the rewritten line-chart variant.
5. **Conversion flow chart** — depends on whether conversion events are indexed in Phase 2. If not, drop `ConversionFlowChart` entirely; don't leave a stub.
6. **Log scale default** — off for everything. Add as a global toggle only; do not force log on cumulative supply charts. Users scanning a dashboard don't expect non-linear Y axes.
7. **Empty-data states** — when a range is fully before the backend's earliest rollup, render an empty-state card with a "jump to earliest data" button. Confirm copy/design direction.
8. **Net issuance minus burn as a derived series** — should `DailyIssuanceChart` render an optional third series (`quaiMinted − burn_delta`) as a thin overlay line, so viewers can see net supply change per period at a glance? Leaning yes, gated behind the "Show protocol events" or a dedicated chart-level toggle. Decide before PR 2.

---

**Frontend Developer**: Phase 2 plan author
**Planning Date**: 2026-04-18
**Depends on**: `docs/phase2-backend-plan.md` — rollup endpoint shape, conversion events, earliest-rollup meta
**Migration strategy**: Ship in 4 PRs, feature-flagged; live view untouched until final polish
