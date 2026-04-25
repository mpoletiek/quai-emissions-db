// Batched `quai_getHeaderByNumber` fetch. Fast dense path for backfill.
//
// Header responses include the full woHeader, which carries every post-SOAP
// mining field we need EXCEPT the per-block `workshares[]` array:
//   - difficulty, kawpowDifficulty
//   - primeTerminusNumber (gate for SOAP-era reward math + getMiningInfo)
//   - shaDiffAndCount, scryptDiffAndCount (EMA-smoothed count + uncled)
//
// So header-only fetch populates everything except `ws_*_count` (which
// requires counting the workshares[] array from a full-block fetch).
// Those four columns are left NULL here; they're populated for a sampled
// subset of blocks by walkBlocks, then overlaid by run.ts before upsert.

import { isQiAddress } from "quais";
import { ZONE_RPC } from "../../lib/quai/constants";
import { calculateQuaiReward } from "../../lib/quai/rewards";
import type { NormalizedBlock } from "../../lib/quai/types";

export const HEADER_BATCH_SIZE = 2000;
export const HEADER_PARALLELISM = 4;

const hexToBig = (h?: string): bigint =>
  h && h.startsWith("0x") ? BigInt(h) : 0n;

const hexToBigOrNull = (h?: string): bigint | null =>
  h && h.startsWith("0x") ? BigInt(h) : null;

const hexToNum = (h?: string): number =>
  h && h.startsWith("0x") ? Number(BigInt(h)) : 0;

const hexToNumOrNull = (h?: string): number | null =>
  h && h.startsWith("0x") ? Number(BigInt(h)) : null;

type RawPowShareDiffAndCount = {
  count?: string;
  difficulty?: string;
  uncled?: string;
};

type RawHeader = {
  avgTxFees?: string;
  baseFeePerGas?: string;
  conversionFlowAmount?: string;
  exchangeRate?: string;
  kQuaiDiscount?: string;
  minerDifficulty?: string;
  woHeader: {
    hash: string;
    parentHash: string;
    number: string;
    timestamp: string;
    primaryCoinbase: string;
    difficulty: string;
    // Post-SOAP fields (absent on very old headers)
    primeTerminusNumber?: string;
    kawpowDifficulty?: string;
    shaDiffAndCount?: RawPowShareDiffAndCount;
    scryptDiffAndCount?: RawPowShareDiffAndCount;
  };
};

export function normalizeHeader(raw: RawHeader): NormalizedBlock {
  const coinbase = raw.woHeader.primaryCoinbase;
  const difficulty = hexToBig(raw.woHeader.difficulty);
  const exchangeRate = hexToBig(raw.exchangeRate);
  const primeTerminusNumber = hexToNumOrNull(
    raw.woHeader.primeTerminusNumber,
  );
  const shaCountEma = hexToBigOrNull(raw.woHeader.shaDiffAndCount?.count);
  const shaUncledEma = hexToBigOrNull(raw.woHeader.shaDiffAndCount?.uncled);
  const scryptCountEma = hexToBigOrNull(
    raw.woHeader.scryptDiffAndCount?.count,
  );
  const scryptUncledEma = hexToBigOrNull(
    raw.woHeader.scryptDiffAndCount?.uncled,
  );

  // Client-side base block reward using the same formula quai_getMiningInfo
  // applies server-side. For post-SOAP blocks the KawPow-equivalent-difficulty
  // adjustment needs the EMA counts (present here on woHeader). For pre-SOAP,
  // the adjustment is skipped. Either way: exact match to go-quai's math,
  // populated densely for every block.
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
    hash: raw.woHeader.hash,
    parentHash: raw.woHeader.parentHash,
    exchangeRate,
    kQuaiDiscount: hexToBig(raw.kQuaiDiscount),
    conversionFlowAmount: hexToBig(raw.conversionFlowAmount),
    primaryCoinbase: coinbase,
    winnerToken: isQiAddress(coinbase) ? "QI" : "QUAI",
    difficulty,
    minerDifficulty: hexToBig(raw.minerDifficulty),
    workshareCount: 0, // filled in by sampled walkBlocks overlay
    primeTerminusNumber,
    // Per-algo actual counts require the full `workshares[]` array — only the
    // sampled walkBlocks path populates these. Null here means "not sampled."
    wsKawpowCount: null,
    wsProgpowCount: null,
    wsShaCount: null,
    wsScryptCount: null,
    // EMAs ARE on the header — populated densely.
    shaCountEma,
    shaUncledEma,
    scryptCountEma,
    scryptUncledEma,
    baseBlockReward,
  };
}

type BatchResp<T> = { id: number; result?: T; error?: { message: string } };

async function batchGetHeaders(
  blockNumbers: number[],
  signal?: AbortSignal,
): Promise<Map<number, NormalizedBlock>> {
  if (blockNumbers.length === 0) return new Map();
  const payload = blockNumbers.map((n, i) => ({
    jsonrpc: "2.0",
    id: i,
    method: "quai_getHeaderByNumber",
    params: ["0x" + n.toString(16)],
  }));
  const res = await fetch(ZONE_RPC, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`batch headers ${res.status}`);
  const raw = await res.json();
  if (!Array.isArray(raw)) {
    throw new Error(
      `batch headers non-array response: ${JSON.stringify(raw).slice(0, 160)}`,
    );
  }
  const out = new Map<number, NormalizedBlock>();
  for (const row of raw as BatchResp<RawHeader>[]) {
    if (row && row.result && typeof row.id === "number") {
      out.set(blockNumbers[row.id], normalizeHeader(row.result));
    }
  }
  return out;
}

export async function walkHeaders(
  from: number,
  to: number,
  signal?: AbortSignal,
): Promise<NormalizedBlock[]> {
  if (from > to) return [];
  const all: number[] = [];
  for (let n = from; n <= to; n++) all.push(n);

  const chunks: number[][] = [];
  for (let i = 0; i < all.length; i += HEADER_BATCH_SIZE) {
    chunks.push(all.slice(i, i + HEADER_BATCH_SIZE));
  }

  const result = new Map<number, NormalizedBlock>();

  async function fetchWithRetry(nums: number[], depth = 0): Promise<void> {
    try {
      const m = await batchGetHeaders(nums, signal);
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
        console.warn(`[headers] final failure for ${nums.length} headers`, e);
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
    { length: Math.min(HEADER_PARALLELISM, chunks.length) || 1 },
    () => worker(),
  );
  await Promise.all(workers);

  const out: NormalizedBlock[] = [];
  for (let n = from; n <= to; n++) {
    const b = result.get(n);
    if (b) out.push(b);
  }
  return out;
}
