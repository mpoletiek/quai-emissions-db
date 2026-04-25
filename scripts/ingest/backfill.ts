#!/usr/bin/env tsx
// Backfill worker — advances `ingest_cursor` from its current position toward
// (head - FINALITY_BUFFER). Writes `blocks` + `supply_analytics` in chunks.
//
// CLI flags:
//   --limit=N     only ingest at most N blocks this run (useful for first-run smoke tests)
//   --chunk=N     blocks per chunk (default 1000; matches BLOCK_BATCH_SIZE)
//
// Designed to be safe to re-run: upserts are idempotent; cursor advances only
// after a chunk's blocks + analytics both land.

import { getLatestBlockNumber } from "../../lib/quai/blocks";
import { walkSupplyAnalytics } from "../../lib/quai/supply";
import { ZONE_RPC } from "../../lib/quai/constants";
import { walkHeaders } from "./headers";
import { batchBurnBalances } from "./burn";
import {
  close,
  getCursor,
  setCursor,
  upsertAnalytics,
  upsertBlocks,
  type AnalyticsRow,
  type BlockRow,
} from "./db";

const FINALITY_BUFFER = 32;
const DEFAULT_CHUNK_SIZE = 2000;

function parseFlag(name: string): number | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return undefined;
  const v = parseInt(arg.split("=")[1], 10);
  if (!Number.isFinite(v) || v <= 0) return undefined;
  return v;
}

async function main(): Promise<void> {
  const chunkSize = parseFlag("chunk") ?? DEFAULT_CHUNK_SIZE;
  const limit = parseFlag("limit") ?? Infinity;

  console.log(`[backfill] rpc=${ZONE_RPC}`);
  const [cursor, head] = await Promise.all([
    getCursor(),
    getLatestBlockNumber(),
  ]);
  const safeHead = head - FINALITY_BUFFER;
  console.log(
    `[backfill] cursor=${cursor.last_ingested_block} head=${head} safe=${safeHead} (finality_buffer=${FINALITY_BUFFER})`,
  );

  let from = cursor.last_ingested_block + 1;
  if (from > safeHead) {
    console.log(`[backfill] up to date. nothing to do.`);
    return;
  }

  const to = Math.min(safeHead, from - 1 + limit);
  const total = to - from + 1;
  console.log(
    `[backfill] ingesting #${from}..#${to} (${total.toLocaleString()} blocks, chunk=${chunkSize})`,
  );

  const startedAt = Date.now();
  let done = 0;

  while (from <= to) {
    const chunkTo = Math.min(to, from + chunkSize - 1);
    const chunkStart = Date.now();
    const blockNums: number[] = [];
    for (let n = from; n <= chunkTo; n++) blockNums.push(n);

    const [blocks, analyticsMap, burnMap] = await Promise.all([
      walkHeaders(from, chunkTo),
      walkSupplyAnalytics(from, chunkTo),
      batchBurnBalances(blockNums),
    ]);

    if (blocks.length === 0) {
      console.warn(
        `[backfill] empty block range #${from}..#${chunkTo} (RPC returned 0 rows); skipping forward`,
      );
      from = chunkTo + 1;
      continue;
    }

    const blockRows: BlockRow[] = blocks.map((b) => ({
      block_number: b.number,
      hash: b.hash,
      parent_hash: b.parentHash ?? null,
      ts: b.timestamp,
      primary_coinbase: b.primaryCoinbase,
      winner_token: b.winnerToken === "QUAI" ? 0 : 1,
      exchange_rate: b.exchangeRate,
      k_quai_discount: b.kQuaiDiscount,
      conversion_flow_amount: b.conversionFlowAmount,
      difficulty: b.difficulty,
      miner_difficulty: b.minerDifficulty,
      workshare_count: b.workshareCount,
      finalized: b.number <= safeHead,
      ws_kawpow_count: b.wsKawpowCount,
      ws_progpow_count: b.wsProgpowCount,
      ws_sha_count: b.wsShaCount,
      ws_scrypt_count: b.wsScryptCount,
      sha_count_ema: b.shaCountEma,
      sha_uncled_ema: b.shaUncledEma,
      scrypt_count_ema: b.scryptCountEma,
      scrypt_uncled_ema: b.scryptUncledEma,
      base_block_reward: b.baseBlockReward,
    }));

    const analyticsRows: AnalyticsRow[] = [];
    for (const b of blocks) {
      const a = analyticsMap.get(b.number);
      if (!a) continue;
      analyticsRows.push({
        block_number: b.number,
        quai_added: a.quaiSupplyAdded,
        quai_removed: a.quaiSupplyRemoved,
        quai_total: a.quaiSupplyTotal,
        qi_added: a.qiSupplyAdded,
        qi_removed: a.qiSupplyRemoved,
        qi_total: a.qiSupplyTotal,
        soap_burn_balance: burnMap.get(b.number) ?? 0n,
        ts: b.timestamp,
      });
    }

    // Blocks first (FK target), then analytics. Cursor updates last.
    await upsertBlocks(blockRows);
    await upsertAnalytics(analyticsRows);
    const highest = blocks[blocks.length - 1].number;
    await setCursor(highest, highest);

    done += blocks.length;
    const elapsed = (Date.now() - chunkStart) / 1000;
    const rate = blocks.length / Math.max(elapsed, 0.001);
    const pct = ((done / total) * 100).toFixed(1);
    console.log(
      `[backfill] #${from}..#${chunkTo}  ${blocks.length} blocks in ${elapsed.toFixed(1)}s  ${rate.toFixed(0)}/s  ${done.toLocaleString()}/${total.toLocaleString()} (${pct}%)`,
    );

    from = chunkTo + 1;
  }

  const totalElapsed = (Date.now() - startedAt) / 1000;
  console.log(
    `[backfill] done. ${done.toLocaleString()} blocks in ${totalElapsed.toFixed(1)}s (${(done / Math.max(totalElapsed, 0.001)).toFixed(0)}/s avg)`,
  );
}

main()
  .then(() => close())
  .catch(async (err) => {
    console.error("[backfill] fatal:", err);
    await close().catch(() => {});
    process.exit(1);
  });
