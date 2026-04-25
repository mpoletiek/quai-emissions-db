import { ZONE_RPC } from "./constants";
import type { MiningInfo } from "./types";

const hexToBigInt = (h: string | undefined): bigint =>
  h && h.startsWith("0x") ? BigInt(h) : 0n;

const hexToNumber = (h: string | undefined): number =>
  h && h.startsWith("0x") ? Number(BigInt(h)) : 0;

type MiningInfoRaw = {
  result: {
    blockNumber: string;
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
    baseBlockReward: string;
    estimatedBlockReward: string;
    workshareReward: string;
    avgTxFees: string;
    quaiSupplyTotal: string;
  };
};

const toBigIntHashRate = (v: string | number): bigint => {
  if (typeof v === "number") return BigInt(Math.trunc(v));
  if (v.startsWith("0x")) return BigInt(v);
  return BigInt(v);
};

/**
 * Live mining/supply snapshot via `quai_getMiningInfo(latest, decimal=false)`.
 *
 * Uses the 2-arg signature from go-quai PR 2696. Requires ZONE_RPC to point
 * at a node carrying that patch (e.g. debug.rpc.quai.network/cyprus1). Stock
 * mainnet nodes still on the 1-arg signature will 400; when the PR merges
 * upstream, all nodes will accept this shape.
 */
export async function fetchMiningInfo(
  signal?: AbortSignal,
): Promise<MiningInfo> {
  const res = await fetch(ZONE_RPC, {
    method: "POST",
    signal,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "quai_getMiningInfo",
      params: ["latest", false],
    }),
  });
  if (!res.ok) throw new Error(`getMiningInfo ${res.status}`);
  const payload = (await res.json()) as { result?: MiningInfoRaw["result"]; error?: { message?: string } };
  if (!payload.result) {
    throw new Error(`getMiningInfo: ${payload.error?.message ?? "no result"}`);
  }
  const r = payload.result;

  const mk = (diffHex: string, hash: string | number, shareTime: number) => {
    const diff = hexToBigInt(diffHex);
    const shares = shareTime > 0 ? r.avgBlockTime / shareTime : 0;
    return {
      difficulty: diff,
      hashRate: toBigIntHashRate(hash),
      avgShareTime: shareTime,
      sharesPerBlock: shares,
    };
  };

  return {
    blockNumber: hexToNumber(r.blockNumber),
    blockHash: r.blockHash,
    blocksAnalyzed: r.blocksAnalyzed,
    avgBlockTime: r.avgBlockTime,
    perAlgo: {
      kawpow: mk(r.kawpowDifficulty, r.kawpowHashRate, r.avgKawpowShareTime),
      sha: mk(r.shaDifficulty, r.shaHashRate, r.avgShaShareTime),
      scrypt: mk(r.scryptDifficulty, r.scryptHashRate, r.avgScryptShareTime),
    },
    baseBlockReward: hexToBigInt(r.baseBlockReward),
    estimatedBlockReward: hexToBigInt(r.estimatedBlockReward),
    workshareReward: hexToBigInt(r.workshareReward),
    avgTxFees: hexToBigInt(r.avgTxFees),
    quaiSupplyTotal: hexToBigInt(r.quaiSupplyTotal),
  };
}
