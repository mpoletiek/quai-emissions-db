import { isQiAddress } from "quais";
import {
  ZONE_RPC,
  BLOCK_BATCH_SIZE,
  RPC_BATCH_PARALLELISM,
} from "./constants";
import { calculateQuaiReward } from "./rewards";
import type {
  BlockMiningInfo,
  NormalizedBlock,
  WinnerToken,
} from "./types";

type RawBlockHeader = {
  avgTxFees?: string;
  baseFeePerGas?: string;
  conversionFlowAmount?: string;
  exchangeRate: string;
  kQuaiDiscount?: string;
  minerDifficulty?: string;
  quaiStateSize?: string;
};

type RawPowShareDiffAndCount = {
  count?: string;
  difficulty?: string;
  uncled?: string;
};

type RawWoHeader = {
  difficulty: string;
  number: string;
  timestamp: string;
  primaryCoinbase: string;
  hash: string;
  parentHash: string;
  // Post-SOAP fields (absent on pre-SOAP blocks)
  primeTerminusNumber?: string;
  kawpowDifficulty?: string;
  shaDiffAndCount?: RawPowShareDiffAndCount;
  scryptDiffAndCount?: RawPowShareDiffAndCount;
};

type RawAuxPow = {
  powId?: string;
};

type RawWorkshare = {
  auxpow?: RawAuxPow | null;
};

type RawBlock = {
  hash: string;
  header: RawBlockHeader;
  woHeader: RawWoHeader;
  workshares?: RawWorkshare[];
};

const hexToBig = (h?: string): bigint =>
  h && h.startsWith("0x") ? BigInt(h) : 0n;

const hexToBigOrNull = (h?: string): bigint | null =>
  h && h.startsWith("0x") ? BigInt(h) : null;

const hexToNum = (h?: string): number =>
  h && h.startsWith("0x") ? Number(BigInt(h)) : 0;

const hexToNumOrNull = (h?: string): number | null =>
  h && h.startsWith("0x") ? Number(BigInt(h)) : null;

// Winner detection via the ledger flag (9th bit) of the block's primaryCoinbase.
// quais.isQiAddress inspects bit 9; Quai-ledger ↔ bit 9 = 0.
export const deriveWinnerToken = (coinbase: string): WinnerToken =>
  isQiAddress(coinbase) ? "QI" : "QUAI";

/**
 * Classify each workshare by its `auxpow.powId` and return counts per algo.
 * Enum values come from go-quai core/types/auxpow.go:
 *   auxpow = null → Progpow  (pre-SOAP: all; post-SOAP transition: stragglers)
 *   0x1           → KawPow
 *   0x2, 0x3      → SHA_BTC / SHA_BCH
 *   0x4           → Scrypt
 */
function countWorksharesByAlgo(
  workshares: RawWorkshare[] | undefined,
): { kawpow: number; progpow: number; sha: number; scrypt: number } {
  let kawpow = 0,
    progpow = 0,
    sha = 0,
    scrypt = 0;
  if (!workshares) return { kawpow, progpow, sha, scrypt };
  for (const ws of workshares) {
    const aux = ws?.auxpow;
    if (!aux) {
      progpow++;
      continue;
    }
    const id = hexToNum(aux.powId);
    if (id === 0x1) kawpow++;
    else if (id === 0x2 || id === 0x3) sha++;
    else if (id === 0x4) scrypt++;
    else progpow++; // defensive: 0x0 or unknown → treat as ProgPoW
  }
  return { kawpow, progpow, sha, scrypt };
}

export function normalizeBlock(raw: RawBlock): NormalizedBlock {
  const coinbase = raw.woHeader.primaryCoinbase;
  const ws = countWorksharesByAlgo(raw.workshares);
  const difficulty = hexToBig(raw.woHeader.difficulty);
  const exchangeRate = hexToBig(raw.header.exchangeRate);
  const primeTerminusNumber = hexToNumOrNull(raw.woHeader.primeTerminusNumber);
  const shaCountEma = hexToBigOrNull(raw.woHeader.shaDiffAndCount?.count);
  const shaUncledEma = hexToBigOrNull(raw.woHeader.shaDiffAndCount?.uncled);
  const scryptCountEma = hexToBigOrNull(
    raw.woHeader.scryptDiffAndCount?.count,
  );
  const scryptUncledEma = hexToBigOrNull(
    raw.woHeader.scryptDiffAndCount?.uncled,
  );

  // Client-side base block reward. For post-SOAP blocks this uses the same
  // KawPow-equivalent-difficulty adjustment the RPC applies server-side, so
  // the value matches quai_getMiningInfo.baseBlockReward modulo rounding.
  const baseBlockReward =
    difficulty > 0n && exchangeRate > 0n
      ? calculateQuaiReward({
          difficulty,
          exchangeRate,
          primeTerminusNumber: primeTerminusNumber ?? 0,
          shaShares: shaCountEma ?? 0n,
          scryptShares: scryptCountEma ?? 0n,
        })
      : 0n;

  return {
    number: hexToNum(raw.woHeader.number),
    timestamp: hexToNum(raw.woHeader.timestamp),
    hash: raw.hash,
    parentHash: raw.woHeader.parentHash,
    exchangeRate,
    kQuaiDiscount: hexToBig(raw.header.kQuaiDiscount),
    conversionFlowAmount: hexToBig(raw.header.conversionFlowAmount),
    primaryCoinbase: coinbase,
    winnerToken: deriveWinnerToken(coinbase),
    difficulty,
    minerDifficulty: hexToBig(raw.header.minerDifficulty),
    workshareCount: ws.kawpow + ws.progpow + ws.sha + ws.scrypt,
    primeTerminusNumber,
    wsKawpowCount: ws.kawpow,
    wsProgpowCount: ws.progpow,
    wsShaCount: ws.sha,
    wsScryptCount: ws.scrypt,
    shaCountEma,
    shaUncledEma,
    scryptCountEma,
    scryptUncledEma,
    baseBlockReward,
  };
}

async function rpc<T>(
  method: string,
  params: unknown[],
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(ZONE_RPC, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${method} ${res.status}`);
  const data = (await res.json()) as { result: T; error?: { message: string } };
  if (data.error) throw new Error(`${method} ${data.error.message}`);
  return data.result;
}

export async function getLatestBlockNumber(signal?: AbortSignal): Promise<number> {
  const hex = await rpc<string>("quai_blockNumber", [], signal);
  return Number(BigInt(hex));
}

type BatchResp<T> = { id: number; result?: T; error?: { message: string } };

async function batchGetBlocks(
  blockNumbers: number[],
  signal?: AbortSignal,
): Promise<Map<number, NormalizedBlock>> {
  if (blockNumbers.length === 0) return new Map();
  const payload = blockNumbers.map((n, i) => ({
    jsonrpc: "2.0",
    id: i,
    method: "quai_getBlockByNumber",
    params: ["0x" + n.toString(16), false],
  }));
  const res = await fetch(ZONE_RPC, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`batch blocks ${res.status}`);
  const raw = await res.json();
  // RPC can return a single error object (not an array) when the batch is rejected
  // wholesale. Treat that as a failure so the retry logic shrinks the payload.
  if (!Array.isArray(raw)) {
    throw new Error(
      `batch blocks non-array response: ${JSON.stringify(raw).slice(0, 160)}`,
    );
  }
  const out = new Map<number, NormalizedBlock>();
  for (const row of raw as BatchResp<RawBlock>[]) {
    if (row && row.result && typeof row.id === "number") {
      out.set(blockNumbers[row.id], normalizeBlock(row.result));
    }
  }
  return out;
}

/**
 * Fetch a set of blocks by number list using JSON-RPC batching. Full-block
 * fetch (not header-only) so we can parse the `workshares[]` array and the
 * per-algo diff-and-count fields on woHeader.
 *
 * Accepts a discrete list rather than a range so sampled backfill (every
 * Nth block) doesn't pull every intermediate block.
 */
export async function walkBlocksByNums(
  blockNumbers: number[],
  signal?: AbortSignal,
): Promise<NormalizedBlock[]> {
  if (blockNumbers.length === 0) return [];
  const chunks: number[][] = [];
  for (let i = 0; i < blockNumbers.length; i += BLOCK_BATCH_SIZE) {
    chunks.push(blockNumbers.slice(i, i + BLOCK_BATCH_SIZE));
  }

  const result = new Map<number, NormalizedBlock>();

  async function fetchWithRetry(nums: number[], depth = 0): Promise<void> {
    try {
      const m = await batchGetBlocks(nums, signal);
      for (const [k, v] of m) result.set(k, v);
      if (m.size < nums.length && depth < 2) {
        const missing = nums.filter((n) => !m.has(n));
        if (missing.length > 0) {
          const half = Math.max(1, Math.floor(missing.length / 2));
          await Promise.all([
            fetchWithRetry(missing.slice(0, half), depth + 1),
            fetchWithRetry(missing.slice(half), depth + 1),
          ]);
        }
      }
    } catch (e) {
      if (depth < 2 && nums.length > 1) {
        const half = Math.max(1, Math.floor(nums.length / 2));
        await Promise.all([
          fetchWithRetry(nums.slice(0, half), depth + 1),
          fetchWithRetry(nums.slice(half), depth + 1),
        ]);
      } else {
        console.warn(`[blocks] final failure for ${nums.length} blocks`, e);
      }
    }
  }

  let idx = 0;
  const worker = async () => {
    while (true) {
      const i = idx++;
      if (i >= chunks.length) break;
      await fetchWithRetry(chunks[i]);
    }
  };
  const workers = Array.from(
    { length: Math.min(RPC_BATCH_PARALLELISM, chunks.length) || 1 },
    () => worker(),
  );
  await Promise.all(workers);

  const out: NormalizedBlock[] = [];
  for (const n of blockNumbers) {
    const b = result.get(n);
    if (b) out.push(b);
  }
  return out;
}

/**
 * Contiguous-range convenience wrapper. Kept for tail mode, reorg check, and
 * ad-hoc debug scripts. Backfill uses walkBlocksByNums on a sampled subset.
 */
export async function walkBlocks(
  from: number,
  to: number,
  signal?: AbortSignal,
): Promise<NormalizedBlock[]> {
  if (from > to) return [];
  const nums: number[] = [];
  for (let n = from; n <= to; n++) nums.push(n);
  return walkBlocksByNums(nums, signal);
}

// ── quai_getMiningInfo batch fetcher ────────────────────────────────────────
//
// PR 2696 signature: quai_getMiningInfo(blockNrOrHash, decimal). Post-SOAP
// only — the RPC rejects blocks whose primeTerminusNumber < KawPowForkBlock
// with error -32000 "getMiningInfo is only available after the KawPow fork".
// Caller is expected to filter the input block list by primeTerminusNumber
// before invoking this.

type RawMiningInfo = {
  blockNumber: string | number;
  blockHash: string;
  blocksAnalyzed: number;
  avgBlockTime: number;
  avgKawpowShareTime: number;
  avgShaShareTime: number;
  avgScryptShareTime: number;
  kawpowDifficulty: string;
  shaDifficulty: string;
  scryptDifficulty: string;
  kawpowHashRate: string | number;
  shaHashRate: string | number;
  scryptHashRate: string | number;
  avgTxFees: string;
  baseBlockReward: string;
  estimatedBlockReward: string;
  workshareReward: string;
};

const hashrateToBig = (v: string | number): bigint => {
  if (typeof v === "number") return BigInt(Math.trunc(v));
  if (v.startsWith("0x")) return BigInt(v);
  return BigInt(v);
};

async function batchGetMiningInfo(
  blockNumbers: number[],
  signal?: AbortSignal,
): Promise<Map<number, BlockMiningInfo>> {
  if (blockNumbers.length === 0) return new Map();
  const payload = blockNumbers.map((n, i) => ({
    jsonrpc: "2.0",
    id: i,
    method: "quai_getMiningInfo",
    params: ["0x" + n.toString(16), false],
  }));
  const res = await fetch(ZONE_RPC, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`batch mining-info ${res.status}`);
  const raw = await res.json();
  if (!Array.isArray(raw)) {
    throw new Error(
      `batch mining-info non-array response: ${JSON.stringify(raw).slice(0, 160)}`,
    );
  }
  const out = new Map<number, BlockMiningInfo>();
  for (const row of raw as BatchResp<RawMiningInfo>[]) {
    if (row && row.result && typeof row.id === "number") {
      const r = row.result;
      out.set(blockNumbers[row.id], {
        blockNumber: hexToNum(String(r.blockNumber)),
        blocksAnalyzed: r.blocksAnalyzed,
        avgBlockTime: r.avgBlockTime,
        kawpowDifficulty: hexToBig(r.kawpowDifficulty),
        shaDifficulty: hexToBig(r.shaDifficulty),
        scryptDifficulty: hexToBig(r.scryptDifficulty),
        kawpowHashRate: hashrateToBig(r.kawpowHashRate),
        shaHashRate: hashrateToBig(r.shaHashRate),
        scryptHashRate: hashrateToBig(r.scryptHashRate),
        avgKawpowShareTime: r.avgKawpowShareTime,
        avgShaShareTime: r.avgShaShareTime,
        avgScryptShareTime: r.avgScryptShareTime,
        avgTxFees: hexToBig(r.avgTxFees),
        estimatedBlockReward: hexToBig(r.estimatedBlockReward),
        workshareReward: hexToBig(r.workshareReward),
      });
    }
  }
  return out;
}

/**
 * Walk mining-info for a contiguous post-SOAP block range. Fetches in batches
 * (MINING_INFO_BATCH_SIZE) with bounded parallelism. Callers should filter the
 * range to post-SOAP blocks first; pre-SOAP calls will surface as per-row
 * errors in the batch response (tolerated — those blocks just get no entry
 * in the returned map).
 */
const MINING_INFO_BATCH_SIZE = 250; // body-size and per-call-cost balanced
export async function walkMiningInfo(
  blockNumbers: number[],
  signal?: AbortSignal,
): Promise<Map<number, BlockMiningInfo>> {
  if (blockNumbers.length === 0) return new Map();
  const chunks: number[][] = [];
  for (let i = 0; i < blockNumbers.length; i += MINING_INFO_BATCH_SIZE) {
    chunks.push(blockNumbers.slice(i, i + MINING_INFO_BATCH_SIZE));
  }

  const result = new Map<number, BlockMiningInfo>();
  let idx = 0;
  const worker = async () => {
    while (true) {
      const i = idx++;
      if (i >= chunks.length) break;
      try {
        const m = await batchGetMiningInfo(chunks[i], signal);
        for (const [k, v] of m) result.set(k, v);
      } catch (e) {
        console.warn(
          `[mining-info] batch ${i} failed (${chunks[i].length} blocks): ${e instanceof Error ? e.message : e}`,
        );
      }
    }
  };
  const workers = Array.from(
    { length: Math.min(RPC_BATCH_PARALLELISM, chunks.length) || 1 },
    () => worker(),
  );
  await Promise.all(workers);
  return result;
}
