// Batched quai_getBalance fetch for the SOAP burn sink.
// Returns a Map<blockNumber, balance_wei>. Uses the same zone RPC as blocks/analytics.

import { ZONE_RPC, RPC_BATCH_PARALLELISM } from "../../lib/quai/constants";

export const SOAP_BURN_ADDR = "0x0050AF0000000000000000000000000000000000";

// Each getBalance JSON-RPC call is ~130 bytes; an 8k batch request body is
// ~1 MB, safely under typical nginx `client_max_body_size` defaults. Chunk
// larger inputs internally so callers can pass arbitrary block lists.
const BURN_BATCH_SIZE = 2000;

type RpcResp = { id: number; result?: string; error?: { message: string } };

async function batchOnce(
  blockNumbers: number[],
  signal?: AbortSignal,
): Promise<Map<number, bigint>> {
  const payload = blockNumbers.map((n, i) => ({
    jsonrpc: "2.0",
    id: i,
    method: "quai_getBalance",
    params: [SOAP_BURN_ADDR, "0x" + n.toString(16)],
  }));
  const res = await fetch(ZONE_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) throw new Error(`batch burn balance ${res.status}`);
  const raw = await res.json();
  if (!Array.isArray(raw)) {
    throw new Error(
      `burn-balance non-array response: ${JSON.stringify(raw).slice(0, 160)}`,
    );
  }
  const out = new Map<number, bigint>();
  for (const row of raw as RpcResp[]) {
    if (row && typeof row.id === "number" && row.result) {
      out.set(blockNumbers[row.id], BigInt(row.result));
    }
  }
  return out;
}

export async function batchBurnBalances(
  blockNumbers: number[],
  signal?: AbortSignal,
): Promise<Map<number, bigint>> {
  if (blockNumbers.length === 0) return new Map();

  // Split into sub-batches to stay under the gateway's request-body cap.
  const chunks: number[][] = [];
  for (let i = 0; i < blockNumbers.length; i += BURN_BATCH_SIZE) {
    chunks.push(blockNumbers.slice(i, i + BURN_BATCH_SIZE));
  }

  const out = new Map<number, bigint>();
  let cursor = 0;
  await Promise.all(
    Array.from(
      { length: Math.min(RPC_BATCH_PARALLELISM, chunks.length) || 1 },
      async () => {
        while (true) {
          const i = cursor++;
          if (i >= chunks.length) break;
          const m = await batchOnce(chunks[i], signal);
          for (const [k, v] of m) out.set(k, v);
        }
      },
    ),
  );

  return out;
}
