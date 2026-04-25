import {
  ZONE_RPC,
  ANALYTICS_BATCH_SIZE,
  RPC_BATCH_PARALLELISM,
} from "./constants";
import type { SupplyAnalytics } from "./types";

type RawAnalytics = {
  quaiSupplyAdded: string;
  quaiSupplyRemoved: string;
  quaiSupplyTotal: string;
  qiSupplyAdded: string;
  qiSupplyRemoved: string;
  qiSupplyTotal: string;
};

const hexToBig = (h?: string): bigint =>
  h && h.startsWith("0x") ? BigInt(h) : 0n;

function normalizeAnalytics(r: RawAnalytics): SupplyAnalytics {
  return {
    quaiSupplyAdded: hexToBig(r.quaiSupplyAdded),
    quaiSupplyRemoved: hexToBig(r.quaiSupplyRemoved),
    quaiSupplyTotal: hexToBig(r.quaiSupplyTotal),
    qiSupplyAdded: hexToBig(r.qiSupplyAdded),
    qiSupplyRemoved: hexToBig(r.qiSupplyRemoved),
    qiSupplyTotal: hexToBig(r.qiSupplyTotal),
  };
}

type RpcResp<T> = { id: number; result?: T; error?: { message: string } };

/**
 * Batch RPC: sends an array payload. go-quai honors JSON-RPC batches.
 * Falls back to single requests if the server rejects the batch.
 */
async function batchGetAnalytics(
  blockNumbers: number[],
  signal?: AbortSignal,
): Promise<Map<number, SupplyAnalytics>> {
  if (blockNumbers.length === 0) return new Map();

  const payload = blockNumbers.map((n, i) => ({
    jsonrpc: "2.0",
    id: i,
    method: "quai_getSupplyAnalyticsForBlock",
    params: ["0x" + n.toString(16)],
  }));

  const res = await fetch(ZONE_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(`batch analytics ${res.status}`);
  const raw = await res.json();
  if (!Array.isArray(raw)) {
    throw new Error(
      `batch analytics non-array response: ${JSON.stringify(raw).slice(0, 160)}`,
    );
  }
  const out = new Map<number, SupplyAnalytics>();
  for (const row of raw as RpcResp<RawAnalytics>[]) {
    if (row && row.result && typeof row.id === "number") {
      out.set(blockNumbers[row.id], normalizeAnalytics(row.result));
    }
  }
  return out;
}

/**
 * Fetch supply analytics for a contiguous range. Chunks into parallel batches
 * to keep request size bounded.
 */
export async function walkSupplyAnalytics(
  from: number,
  to: number,
  signal?: AbortSignal,
): Promise<Map<number, SupplyAnalytics>> {
  if (from > to) return new Map();
  const all: number[] = [];
  for (let n = from; n <= to; n++) all.push(n);

  // Analytics tolerates up to 10k entries per batch on mainnet.
  const chunks: number[][] = [];
  for (let i = 0; i < all.length; i += ANALYTICS_BATCH_SIZE) {
    chunks.push(all.slice(i, i + ANALYTICS_BATCH_SIZE));
  }

  const result = new Map<number, SupplyAnalytics>();
  let idx = 0;
  const worker = async () => {
    while (true) {
      const i = idx++;
      if (i >= chunks.length) break;
      try {
        const m = await batchGetAnalytics(chunks[i], signal);
        for (const [k, v] of m) result.set(k, v);
      } catch (e) {
        console.warn(`[supply] batch ${i} failed`, e);
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

export async function fetchLatestSupplyAnalytics(
  signal?: AbortSignal,
): Promise<SupplyAnalytics> {
  const res = await fetch(ZONE_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "quai_getSupplyAnalyticsForBlock",
      params: ["latest"],
    }),
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(`analytics latest ${res.status}`);
  const { result } = (await res.json()) as { result: RawAnalytics };
  return normalizeAnalytics(result);
}
