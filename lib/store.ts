// Store-backed readers that replace the per-request RPC walkers for the
// live-view API routes. All reads hit Postgres tables (`blocks`,
// `supply_analytics`, `ingest_cursor`) populated by the ingest worker.
//
// Shapes returned here match the existing wire types (`NormalizedBlock`,
// `SupplyAnalytics`) so the routes and frontend hooks see no difference
// from the prior RPC implementation.

import { pool } from "@/lib/db";
import type { NormalizedBlock, SupplyAnalytics } from "@/lib/quai/types";

type BlockRow = {
  block_number: string;
  hash: Buffer;
  parent_hash: Buffer | null;
  ts: Date;
  primary_coinbase: Buffer;
  winner_token: number;
  exchange_rate: string;
  k_quai_discount: string | null;
  conversion_flow_amount: string | null;
  difficulty: string | null;
  miner_difficulty: string | null;
  workshare_count: number;
};

function toHex(buf: Buffer | null | undefined): string {
  if (!buf) return "0x";
  return "0x" + buf.toString("hex");
}

function rowToBlock(r: BlockRow): NormalizedBlock {
  return {
    number: Number(r.block_number),
    timestamp: Math.floor(r.ts.getTime() / 1000),
    hash: toHex(r.hash),
    parentHash: toHex(r.parent_hash),
    exchangeRate: BigInt(r.exchange_rate),
    kQuaiDiscount: BigInt(r.k_quai_discount ?? "0"),
    conversionFlowAmount: BigInt(r.conversion_flow_amount ?? "0"),
    primaryCoinbase: toHex(r.primary_coinbase),
    winnerToken: r.winner_token === 0 ? "QUAI" : "QI",
    difficulty: BigInt(r.difficulty ?? "0"),
    minerDifficulty: BigInt(r.miner_difficulty ?? "0"),
    workshareCount: r.workshare_count,
    // These new per-algo / mining fields aren't columns on the `blocks` row
    // type this helper reads; they're only produced by fresh RPC decoding.
    // Return zeros so the NormalizedBlock shape is satisfied for DB-sourced
    // rows. Consumers that need per-algo data should query the updated
    // columns directly.
    primeTerminusNumber: null,
    wsKawpowCount: 0,
    wsProgpowCount: 0,
    wsShaCount: 0,
    wsScryptCount: 0,
    shaCountEma: null,
    shaUncledEma: null,
    scryptCountEma: null,
    scryptUncledEma: null,
    baseBlockReward: 0n,
  };
}

export async function storeLatestBlockNumber(): Promise<number> {
  const { rows } = await pool.query<{ n: string | null }>(
    `SELECT MAX(block_number)::text AS n FROM blocks`,
  );
  const n = rows[0]?.n;
  if (!n) throw new Error("store: blocks table is empty");
  return Number(n);
}

export async function storeBlocks(
  from: number,
  to: number,
): Promise<NormalizedBlock[]> {
  // ORDER BY must reference the underlying bigint column, not the ::text
  // projection — otherwise Postgres resolves the name to the output column
  // and sorts lexicographically ("999999" > "7618905").
  const { rows } = await pool.query<BlockRow>(
    `SELECT block_number::text, hash, parent_hash, ts, primary_coinbase,
            winner_token,
            exchange_rate::text, k_quai_discount::text,
            conversion_flow_amount::text, difficulty::text,
            miner_difficulty::text, workshare_count
       FROM blocks
      WHERE block_number BETWEEN $1 AND $2
      ORDER BY blocks.block_number ASC`,
    [from, to],
  );
  return rows.map(rowToBlock);
}

type AnalyticsRow = {
  block_number: string;
  quai_added: string;
  quai_removed: string;
  quai_total: string;
  qi_added: string;
  qi_removed: string;
  qi_total: string;
  soap_burn_balance: string;
};

function rowToAnalytics(r: AnalyticsRow): SupplyAnalytics {
  return {
    quaiSupplyAdded: BigInt(r.quai_added),
    quaiSupplyRemoved: BigInt(r.quai_removed),
    quaiSupplyTotal: BigInt(r.quai_total),
    qiSupplyAdded: BigInt(r.qi_added),
    qiSupplyRemoved: BigInt(r.qi_removed),
    qiSupplyTotal: BigInt(r.qi_total),
    soapBurnBalance: BigInt(r.soap_burn_balance),
  };
}

export async function storeAnalyticsRange(
  from: number,
  to: number,
): Promise<Map<number, SupplyAnalytics>> {
  const { rows } = await pool.query<AnalyticsRow>(
    `SELECT block_number::text,
            quai_added::text, quai_removed::text, quai_total::text,
            qi_added::text, qi_removed::text, qi_total::text,
            soap_burn_balance::text
       FROM supply_analytics
      WHERE block_number BETWEEN $1 AND $2
      ORDER BY supply_analytics.block_number ASC`,
    [from, to],
  );
  const map = new Map<number, SupplyAnalytics>();
  for (const r of rows) {
    map.set(Number(r.block_number), rowToAnalytics(r));
  }
  return map;
}

export async function storeLatestAnalytics(): Promise<SupplyAnalytics | null> {
  const { rows } = await pool.query<AnalyticsRow>(
    `SELECT block_number::text,
            quai_added::text, quai_removed::text, quai_total::text,
            qi_added::text, qi_removed::text, qi_total::text,
            soap_burn_balance::text
       FROM supply_analytics
      ORDER BY supply_analytics.block_number DESC
      LIMIT 1`,
  );
  return rows[0] ? rowToAnalytics(rows[0]) : null;
}
