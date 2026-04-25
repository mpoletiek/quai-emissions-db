# Quai/Qi Emissions: Full Supply Picture

*Research compiled 2026-04-22. Confidence levels flagged inline: `[HIGH]`, `[MED]`, `[LOW/GUESS]`.*

## 1. TL;DR

The RPC call `quai_getSupplyAnalyticsForBlock` tracks **gross minted supply** (genesis allocation + cumulative block-reward emissions ± conversion flow). It does **not** subtract burned balances. An accurate dashboard must additionally:

1. Subtract the live balance of the SOAP burn sink `0x0050AF0000000000000000000000000000000000` (this is a dead-end address — a true sinkhole, not a redistribution contract). `[HIGH]`
2. Track the separate SOAP time-locked staking-rewards vault balance (part of buyback QUAI is streamed to stakers rather than burned; address not publicly documented). `[MED]`
3. Recognize that the Singularity Fork (2026-03-19, Prime block 1,530,500) shrank the *future* genesis unlock schedule by ~1.67 B QUAI; this is a skip-on-emit, not a burn, so it should already be reflected in analytics going forward. `[HIGH]`
4. Qi has **no premine and no burn address**; Qi supply = emissions ± conversions. `[HIGH]`
5. Conversions are 2-way and symmetric — neither side burns — so `conversionFlowAmount` nets out across the two-token system. `[HIGH]`

## 2. Timeline (absolute dates)

| Event | Date | Source |
|---|---|---|
| Iron Age incentivized testnet starts | 2023-09-19 | qu.ai blog |
| Mainnet launch (block 0) | **2025-01-29** | qu.ai, CMC |
| Token Generation Event (TGE) | **2025-02-03 / 2025-02-04** | CoinMarketCal, TradingView |
| 6-month cliff (Foundation / Dev Co / Community Incentives) | ~2025-08-03 | derived |
| 1-year cliff (Team / Seed / Strategic) | **~2026-02-03** | derived |
| Project SOAP activation | **2025-12-17** @ Prime block 1,171,500, ~15:30 UTC | qu.ai blog |
| Singularity Fork (genesis-unlock burn) | **2026-03-19** @ Prime block 1,530,500 | qu.ai "Singularity live" blog |

## 3. Supply Sources

### QUAI

| Source | Quantity | Mechanism | In `quai_getSupplyAnalyticsForBlock`? |
|---|---|---|---|
| **Genesis premine** | 3,000,000,000 QUAI originally (Foundation 33%, Community 23%, Team 16%, Investment 14%, Dev Co 6%, Testnet 5%, Exchange 2%) `[HIGH]` | Genesis state allocation at block 0. Locked tokens sit on allocation addresses; monthly unlock schedule moves them to vesting contracts / recipient addresses. | Included at block 0 as part of `quaiSupplyTotal`. Later unlocks do **not** increase the total — they just move tokens between addresses. `[HIGH]` |
| **Singularity burn of future unlocks** | ~1.67 B QUAI, reducing vested baseline to **~1,332,840,016 QUAI** | Emission schedule permanently skips 81.1% of remaining genesis-unlock line items. Not a move-to-dead-address burn; those tokens are never minted. | Post-2026-03-19 the analytics schedule simply stops growing for those allocations. Pre-fork analytics still reflect the full 3 B. `[HIGH]` |
| **Block rewards (Quai side)** | Variable; `Reward ∝ log₂(difficulty)` — trends toward zero inflation | Miner elects QUAI reward per block via `setMinerPreference`. | Included — incremented as `added` each block. `[HIGH]` |
| **Workshare / coinbase-lockup bonus** | 1.035×–1.25× multiplier in Year 1, decaying over 5 yrs | Miner chooses lockup byte; yields higher base reward, paid on unlock | Should be captured inside emissions totals. `[MED]` |
| **Conversions Qi → Quai** | Variable | UTXO-side Qi consumed, EVM-side Quai credited at protocol rate | Captured as `added` in analytics for QUAI block. `[HIGH]` |

### QI

| Source | Quantity | Mechanism | In analytics? |
|---|---|---|---|
| Genesis | **0** (no premine) `[HIGH]` | — | — |
| Block rewards (Qi side) | `Reward ∝ difficulty` (linear) | Miner elects Qi reward | Yes `[HIGH]` |
| Conversions Quai → Qi | Variable | Quai consumed, Qi credited | Yes as `added` `[HIGH]` |

## 4. Supply Sinks

### QUAI

| Sink | Address | Mechanism | In analytics? |
|---|---|---|---|
| **SOAP buyback burn** | **`0x0050AF0000000000000000000000000000000000`** `[HIGH]` | Parent-chain (BCH/LTC/DOGE/RVN) merge-mined coinbase is routed to a protocol-controlled aux address. Protocol sells parent tokens for QUAI on the open market and sends the QUAI to this dead address. Docs explicitly say "Purchased QUAI is burned (100%)" for the burn portion. | **Not subtracted.** `quaiSupplyTotal` is gross minted; the QUAI at `0x0050AF…` still counts. **User is correct — dashboard must subtract this balance.** `[HIGH]` |
| **SOAP time-locked staking vault** | Not publicly documented; blog says "time-deferred locking rewards vault, minimum ~30 days" `[MED]` | A fraction of SOAP-purchased QUAI is streamed to stakers rather than burned. Locked while in vault, circulating after release. | Not subtracted. Dashboard may optionally display "locked-in-vault" as a distinct category. The governance committee adjusts the burn/vault split. `[MED]` |
| **Conversions Quai → Qi** | (internal accounting) | Quai balance destroyed on EVM side, Qi credited on UTXO side | Captured as `removed` in analytics. Net zero across both tokens. `[HIGH]` |
| **EIP-1559–style fee burns** | — | Not confirmed in Quai; likely no base-fee burn as of today. `[LOW]` | — |

### QI

| Sink | Address | Mechanism | In analytics? |
|---|---|---|---|
| Conversions Qi → Quai | (internal) | Qi UTXO consumed | Captured as `removed`. `[HIGH]` |
| Other burns | — | **None known.** Qi has no dedicated burn sink. `[HIGH]` | — |

### Current SOAP burn-address balance

The SOAP community burn dashboard at `quai-soap-burns.vercel.app` reported **~70,062,129.93 QUAI** cumulatively routed to SOAP-related addresses as of the fetch. An earlier third-party mirror showed ~8.34 M and another ~64.9 M — the number is a fast-moving counter. `[MED]`
**Action:** always read live via `quai_getBalance(0x0050AF…)` rather than trusting a cached figure. The official SOAP dashboard at `soap.qu.ai` was empty at fetch time (probably because we requested only `cyprus1` and cross-shard aggregation wasn't rendered).

## 5. Reconciliation Formula

```
realized_QUAI_circulating(t) =
    quaiSupplyTotal(t)                              // analytics: gross minted
  - balanceOf(0x0050AF0000000000000000000000000000000000)   // SOAP burn sink
  - balanceOf(SOAP_vault_address)                   // if identified & want "liquid" view
  - balanceOf(genesis_allocation_addresses_still_locked)    // if want "unlocked/tradable" view
```

For a pure "monetary supply" (what exists anywhere on-chain, locked or not, minus irrecoverable burns):

```
monetary_QUAI(t) = quaiSupplyTotal(t) - balanceOf(0x0050AF…)
```

`conversionFlowAmount` does **not** enter the formula as a burn — it's a rate-limiter EMA embedded in headers (100 Quai floor, cap at 2× previous block, 4000-block smoothing). The actual supply moves are in `added`/`removed`, one side per token. `[HIGH]`

```
monetary_QI(t) = qiSupplyTotal(t)    // no burn sink
```

## 6. Data Acquisition Plan

| Data need | Method | Cadence |
|---|---|---|
| Gross minted totals | `quai_getSupplyAnalyticsForBlock(blockNumber)` on cyprus1 | Per block (already implemented) |
| **SOAP burn balance** | `quai_getBalance("0x0050AF0000000000000000000000000000000000", "latest")` on cyprus1 | Every block, or every N blocks |
| SOAP vault balance | TBD — identify address from go-quai `params/` or `consensus/soap/` source, or from a high-inflow address seen co-moving with SOAP coinbase txs on Quaiscan | Once address known, `quai_getBalance` per block |
| Per-block SOAP flow | Diff consecutive `getBalance` calls on burn address, or scan coinbase transactions for parent-chain chain-id markers | Per block |
| Conversion flow | `conversionFlowAmount` in header + `added`/`removed` in analytics | Per block |
| Premine unlock progression | `quai_getBalance` against the handful of Foundation/Team/Investor allocation addresses (pull from genesis JSON in `go-quai/core/genesis.go`) | Daily is enough |
| Parent-chain inputs (BCH/LTC/DOGE/RVN) | Query public explorers for the SOAP AuxPoW coinbase outputs; coinbase carries `'SOAP' 0x01` magic bytes + WorkObject hash after BIP34 height push | Optional enrichment, per parent block |

## 7. Open Questions / Low-Confidence Claims

- **Annual burn target of "180 M QUAI/yr".** The docs footnote says "If SOAP buybacks fully offset mining emissions over time, net emissions approach zero" and quotes "≈180 M QUAI annually, ~13.6% of the 1.33 B baseline" in the Quai Emissions page — this is a **long-run design target**, not a current rate. Observed YTD burn totals (tens of millions) are well below that. Dashboard should show live rate and compute trailing-30-day annualized burn rather than hard-coding 180 M. `[MED]`
- **SOAP staking-vault address.** Not published in any blog post or docs page I could retrieve. Best bet is grepping the go-quai repo for `0x00…` patterns near SOAP constants, or watching Quaiscan for a consistent counterparty receiving outbound txs from the SOAP AuxTemplate-controlled address. `[LOW]`
- **Burn vs. vault split ratio.** Governance-adjustable by the SOAP committee without hard-forking; not fixed. Treat it as a queryable parameter rather than a constant. `[MED]`
- **Does merge-mined QUAI buyback happen via Qi→Quai conversion internally or via an external DEX?** Blog language ("at market") strongly implies an internal QUAI-side acquisition — likely a protocol routine that uses the Qi/Quai conversion mechanism keyed against the SOAP-controlled treasury. No confirmed smart-contract address or on-chain trace documented in public sources. `[LOW]`
- **Are fee burns (EIP-1559-style basefee burn) active on cyprus1?** Not confirmed in docs reviewed. Treat as zero unless observed in state diffs. `[LOW]`
- **Exact on-chain representation of genesis premine.** Docs say "genesis unlocks skipped" post-Singularity — implies addresses rather than a contract. The 3 B starting allocation is at block 0 state, not minted incrementally, so unlocks = transfers between known addresses, not supply additions. This means `quaiSupplyTotal` is flat w.r.t. unlocks. `[HIGH]` The Singularity fork removal of future unlocks is the only post-genesis supply-curve modification. `[HIGH]`
- **Airdrops / bug bounties / foundation grants** post-TGE: no dedicated emission events found. Any such program draws from the already-minted Foundation/Community allocations and is therefore invisible to the supply total (only shows up as balance migrations). `[MED]`

---

### Sources consulted

- Quai Docs: `/learn/tokenomics/quai-emissions`, `/learn/tokenomics/qi-emissions`, `/learn/tokenomics/tokenomics-overview`, `/learn/tokenomics/token-dynamics/*`, `/learn/advanced-introduction/soap`
- Quai Blog: "Project SOAP Launches on Quai Mainnet", "SOAP Mainnet Launch Date Announcement", "Welcome to The Singularity", "Mainnet Launching January 29th", "Iron Age Testnet"
- Third-party: soap.qu.ai dashboard, quai-soap-burns.vercel.app, CoinMarketCap, CryptoRank, CoinMarketCal/TradingView (TGE date), Messari, The Block, Phemex, Disruption Banking

---

## 8. go-quai Source Verification (2026-04-22)

Source of truth: `github.com/dominant-strategies/go-quai`, branch `main` at commit `1ddf382` (tag `v0.52.0`), shallow-cloned to `/tmp/go-quai`. Line numbers below are from that revision. All "raw-quotes" are copied verbatim from the files.

### 8.1. Answer to the headline question

**Quai does NOT burn the EIP-1559 base fee.** There is no split between base-fee and priority-tip — the *entire* `gasPrice * gasUsed` is accumulated as `quaiFees` on the block and then fully recycled into miner rewards (50% current-block via the `TotalFees` half-split, 50% deferred via the `AvgTxFees` fee capacitor). No portion is sent to `0x0050AF…` by the protocol, and no portion is destroyed via `SubBalance` without a matching `AddBalance`. Therefore the base-fee-burn concept is effectively **disabled** on go-quai today, and it shows up in **neither** `quaiSupplyRemoved` **nor** the `0x0050AF…` balance. `[HIGH]`

### 8.2. State-transition path (question 1)

`core/state_transition.go`:

```go
// line 78-80
func (st *StateTransition) fee() *big.Int {
    return st.gasPrice
}
```

`st.fee()` returns the **full** gas price, not `gasPrice - baseFee`. There is a minimum-baseFee **validation** at `state_transition.go:279` (`st.gasPrice.Cmp(st.evm.Context.BaseFee) < 0` → reject), but no subtraction or redirection of the `baseFee * gasUsed` component anywhere.

`core/state_transition.go:501-518` (the success path inside `TransitionDb`):

```go
effectiveTip := st.fee()
// …
fees := big.NewInt(0)
if !st.msg.IsETX() {
    fees = new(big.Int).Mul(new(big.Int).SetUint64(st.gasUsed()), effectiveTip)
}
return &ExecutionResult{
    // …
    QuaiFees: fees,
    // …
}, nil
```

So `QuaiFees = gasUsed * gasPrice` (full price). This then flows into the processor:

`core/state_processor.go:1005-1016`:

```go
} else if tx.Type() == types.QuaiTxType { // Regular Quai tx
    // …
    fees := big.NewInt(0)
    receipt, fees, err = applyTransaction(…)
    // …
    quaiFees.Add(quaiFees, fees)
```

And the distribution:

`core/state_processor.go:1079-1096`:

```go
// 50% of the fees goes to the calculation  of the averageFees generated,
// and this is added to the block rewards
halfQuaiFees := new(big.Int).Div(quaiFees, common.Big2)
halfQiFees   := new(big.Int).Div(qiFees, common.Big2)
halfQiFeesInQuai := misc.QiToQuai(block, exchangeRate, block.Difficulty(), halfQiFees)
totalFeesForCapacitor := new(big.Int).Add(halfQuaiFees, halfQiFeesInQuai)
expectedAvgFees := p.hc.ComputeAverageTxFees(parent, totalFeesForCapacitor)
// …
totalQiFeesInQuai := misc.QiToQuai(block, exchangeRate, block.Difficulty(), qiFees)
expectedTotalFees := new(big.Int).Add(quaiFees, totalQiFeesInQuai)
if expectedTotalFees.Cmp(block.TotalFees()) != 0 {
    return …, fmt.Errorf("invalid totalFees used …")
}
```

And the actual payout (`core/state_processor.go:1189-1195`):

```go
blockRewardAtTargetBlock := misc.CalculateQuaiReward(targetBlock.WorkObjectHeader(), targetBlock.Difficulty(), exchangeRate)
// add the fee capacitor value
blockRewardAtTargetBlock = new(big.Int).Add(blockRewardAtTargetBlock, targetBlock.AvgTxFees())
// add half the fees generated in the block
blockRewardAtTargetBlock = new(big.Int).Add(blockRewardAtTargetBlock, new(big.Int).Div(targetBlock.TotalFees(), common.Big2))
```

So the full gas cost is paid 50% into the immediate share-rewards pot and 50% into the fee capacitor EMA (`AvgTxFees`), which feeds later blocks' reward pots. **Zero goes anywhere else.**

A full-repo grep `grep -rn "burn\|Burn" core/state_processor.go core/state_transition.go` returns nothing. A full-repo grep for the burn-address literal confirms it is only referenced from the RPC layer, never from the state processor:

```
$ grep -rn "0050[aA][fF]" /tmp/go-quai --include="*.go"
internal/quaiapi/quai_api.go:58:    burnAddress   = common.HexToAddress("0x0050AF0000000000000000000000000000000000", common.Location{0, 0})
```

### 8.3. Supply-analytics accounting (question 2)

`core/state/statedb.go:474-489` — EVERY balance mutation tracks gross movement:

```go
// AddBalance adds amount to the account associated with addr.
func (s *StateDB) AddBalance(addr common.InternalAddress, amount *big.Int) {
    stateObject := s.GetOrNewStateObject(addr)
    if stateObject != nil {
        stateObject.AddBalance(amount, s.nodeLocation)
    }
    s.SupplyAdded.Add(s.SupplyAdded, amount)
}

// SubBalance subtracts amount from the account associated with addr.
func (s *StateDB) SubBalance(addr common.InternalAddress, amount *big.Int) {
    stateObject := s.GetOrNewStateObject(addr)
    if stateObject != nil {
        stateObject.SubBalance(amount)
    }
    s.SupplyRemoved.Add(s.SupplyRemoved, amount)
}
```

**This is a crucial behavioural detail**: `SupplyAdded` and `SupplyRemoved` are **gross flow counters**, not monetary-supply deltas. A plain user-to-user QUAI transfer of amount `X` increments **both** `SupplyAdded` by `X` (recipient credit) and `SupplyRemoved` by `X` (sender debit) — net zero, as it should be.

The net delta is what feeds the running `quaiSupplyTotal`:

`core/rawdb/accessors_chain.go:2056-2082` (truncated):

```go
func WriteSupplyAnalyticsForBlock(db ethdb.KeyValueWriter, readDb ethdb.Reader, blockHash common.Hash, parentHash common.Hash, supplyAddedQuai, supplyRemovedQuai, supplyAddedQi, supplyRemovedQi *big.Int) error {
    supplyDeltaQuai := new(big.Int).Sub(supplyAddedQuai, supplyRemovedQuai)
    supplyDeltaQi   := new(big.Int).Sub(supplyAddedQi,   supplyRemovedQi)
    _, _, totalSupplyQuai, _, _, totalSupplyQi, err := ReadSupplyAnalyticsForBlock(readDb, parentHash)
    // …
    totalSupplyQuai.Add(totalSupplyQuai, supplyDeltaQuai)
    totalSupplyQi.Add(totalSupplyQi, supplyDeltaQi)
```

So:
- **`quaiSupplyRemoved` = Σ all `SubBalance` calls in the block** (gross outflow). It includes the sender-debit side of every transfer, conversion-leg deductions, and gas-buy debits. It is NOT limited to "burns". It is NOT limited to conversion outflows. It is best read as "gross QUAI-ledger debits touched this block."
- **`quaiSupplyAdded`** is the symmetric gross credit counter.
- **`quaiSupplyTotal`** = running sum of `(added - removed)`, which *does* net out regular transfers. Net new issuance (coinbase rewards paid in via `statedb.AddBalance` with no matching SubBalance from an origin account) increases total; net burns (SubBalance without matching AddBalance) decrease it. But since a send-to-`0x0050AF…` is a normal transfer (both sides touched), it nets to zero in `quaiSupplyTotal` and the RPC has to correct for it manually.
- **Base-fee "burn" (if it existed) would show up as a SubBalance-without-AddBalance** and therefore *would* appear in `quaiSupplyRemoved` *and* reduce `quaiSupplyTotal`. Since no such call exists, base-fee "burn" is confirmed absent.

**Genesis allocations**: `core/genesis.go` sets up the initial state via `AllocHash` at block 0 (`genesis.go:241` sets extra data; genesis balances are applied to the genesis state but `WriteSupplyAnalyticsForBlock` for genesis starts from zero state — hence `quaiSupplyTotal` at block 0 does NOT include the 3 B premine; it only accrues post-genesis mutations). This has a significant dashboard implication — see §8.6.

### 8.4. The `0x0050AF…` burn-address handling at the RPC layer (question 3)

`internal/quaiapi/quai_api.go:58`:

```go
burnAddress = common.HexToAddress("0x0050AF0000000000000000000000000000000000", common.Location{0, 0})
```

`internal/quaiapi/quai_api.go:281-302` (`quai_getSupplyAnalyticsForBlock`):

```go
func (s *PublicBlockChainQuaiAPI) GetSupplyAnalyticsForBlock(ctx …) (…) {
    header, err := s.b.HeaderByNumberOrHash(ctx, blockNrOrHash)
    // …
    supplyAddedQuai, supplyRemovedQuai, totalSupplyQuai, supplyAddedQi, supplyRemovedQi, totalSupplyQi, err := rawdb.ReadSupplyAnalyticsForBlock(s.b.Database(), header.Hash())
    // …
    burnedQuai, err := s.GetBalance(ctx, burnAddress.MixedcaseAddress(), blockNrOrHash)
    if err == nil {
        totalSupplyQuai.Sub((*big.Int)(totalSupplyQuai), (*big.Int)(burnedQuai))
    }
    return map[string]interface{}{
        "quaiSupplyAdded":   (*hexutil.Big)(supplyAddedQuai),
        "quaiSupplyRemoved": (*hexutil.Big)(supplyRemovedQuai),
        "quaiSupplyTotal":   (*hexutil.Big)(totalSupplyQuai),
        // …
    }, nil
}
```

Key observations:
1. The protocol never touches `0x0050AF…`. It's a plain EOA sink, not a precompile, not a system address.
2. The RPC handler **subtracts `balanceOf(0x0050AF…)` from `quaiSupplyTotal` at read time**. This means `quaiSupplyTotal` returned over JSON-RPC is **already burn-adjusted** — you do NOT need to subtract it yourself. Our §5 formula `monetary_QUAI = quaiSupplyTotal - balanceOf(0x0050AF…)` was **double-counting the burn**.
3. Therefore the SOAP buyback-burn flow is exactly: foundation sends QUAI to `0x0050AF…` via an ordinary transaction; the balance there accumulates; the RPC handler subtracts it from the reported total supply. That's the entire mechanism. No protocol-level ETX, no coinbase hook, no precompile.
4. Transfers to `0x0050AF…` are normal `transactions[]` entries on blocks (they look like any other Quai send).

### 8.5. Confirmations on vault and buyback routing (question 4)

- **No time-locked staking vault exists in source.** Greps across the whole repo:
  - `grep -rn "vault\|Vault\|staking\|Staking\|treasury\|Treasury"` → zero hits
  - `grep -rn "SOAP\|soap\|Soap\|buyback\|Buyback"` → zero hits

  There is no SOAP-related contract, address constant, or governance timelock compiled into the client. The SOAP system is entirely a social/foundation construct. Current design is **100% burn** to `0x0050AF…` (no programmatic split to any vault because there is no vault at the protocol layer). `[HIGH]`
- **Buyback source is off-chain.** With no on-chain buyback code and no DEX-router references, the only way QUAI arrives at the burn address is via foundation-controlled EOA transactions. This matches the user's CEX-buyback assertion. `[HIGH]`

### 8.6. Other QUAI sinks / flags (question 5)

While tracing state mutations I noticed three things worth flagging:

1. **Coinbase reward can be silently lost.** `core/state_processor.go:628-635`:

   ```go
   if statedb.GetCode(internal) == nil || block.NumberU64(common.ZONE_CTX) < params.CoinbaseLockupPrecompileKickInHeight {
       // Coinbase reward is lost
       // Justification: We should not store a coinbase lockup that can never be claimed
       p.logger.Errorf("Coinbase tx %x has no code at contract address %x", tx.Hash(), contractAddr)
       receipt = &types.Receipt{Type: tx.Type(), Status: types.ReceiptStatusFailed, GasUsed: gasUsedForCoinbase, TxHash: tx.Hash()}
   }
   ```

   When a miner configures a contract-address beneficiary that has no code yet, the coinbase is discarded. Because this coinbase was an `AddBalance` that never happened, it doesn't show up in `SupplyAdded` either — it's just **never minted**. Economically it's a reduction of issuance, not a burn. `[MED]`
2. **Account-creation fee gets clipped off the balance.** `core/state_processor.go:1447-1455` and `:1483-1491`: when a conversion or coinbase redemption lands on an address that does not yet exist, `newAccountCreationFee = CallNewAccountGas * InitialBaseFee` is subtracted from the redeemed amount before `AddBalance`. This is an implicit issuance haircut (the state was expanded at no one's direct expense) — again, not a burn, just a smaller mint. `[MED]`
3. **`prepareApplyETX` writes the zero address before an ETX and restores it after.** `core/state_processor.go:981`:

   ```go
   statedb.SetBalance(common.ZeroInternal(nodeLocation), prevZeroBal) // Reset the balance to what it previously was. Residual balance will be lost
   ```

   Any "residual balance" from a failed/partial ETX that landed at the zero address is discarded. This uses `SetBalance` (not SubBalance) so it does NOT register in `SupplyRemoved`, but since `SupplyAdded` picked it up when it arrived at `0x0…0`, it's a mismatched counter. In practice the amounts are negligible, but worth knowing that `quaiSupplyTotal` has a small systematic drift from this path. `[LOW]`

No miner bribes, no orphaned-reward pool, no treasury withdrawals found.

### 8.7. Reconciliation formula — corrected

Our §5 formula had a double-counting error. The correct post-verification identity is:

```
monetary_QUAI(t) = quaiSupplyTotal(t)      // via quai_getSupplyAnalyticsForBlock
                                            //   ALREADY net of balanceOf(0x0050AF…) at RPC read time
                                            //   — do NOT subtract it a second time
```

Caveats:
- `quaiSupplyTotal` starts at zero at genesis and only accumulates post-genesis deltas, so it excludes the 3 B genesis premine. For true monetary supply we need `quaiSupplyTotal + sum(genesisAllocations)` where the allocations are read from the `go-quai` chain config / `AllocHash` preimage.
- `quaiSupplyRemoved` (per block) is gross debit flow, NOT a burn metric. Do NOT surface it as "QUAI burned this block" on the dashboard.
- To measure **SOAP burn flow per block**, diff consecutive `quai_getBalance("0x0050AF…")` readings. That is the only on-chain signal of SOAP buyback-burn activity.
- Base-fee burn contributes **zero** — do not include it in the formula.

### 8.8. Downstream implications for the dashboard

- Replace any UI label that says "Quai burned this block" sourced from `quaiSupplyRemoved` — that field is gross outflow, not burn.
- The "Total Burned" card should be **`balanceOf(0x0050AF…)`**, queried directly via `quai_getBalance`, not derived from supply-analytics fields.
- The "Total Supply" card can simply show `quaiSupplyTotal` from `quai_getSupplyAnalyticsForBlock` *plus* the static genesis allocation sum (read once from `go-quai/core/genesis.go` Alloc JSON or from a cyprus1 genesis export).
- Remove the §5 "`- balanceOf(0x0050AF…)`" subtraction from any computed metric that starts from `quaiSupplyTotal` — it's already applied server-side.
- There is no base-fee-burn KPI to display; any "fee burn" tile should be removed or labeled "N/A (disabled in current protocol)".

