/* eslint-disable no-console */
// Smoke test: fetch a recent block + getMiningInfo for it, and verify our
// TS port of CalculateQuaiReward produces the same baseBlockReward the RPC
// computes server-side. Run: `npx tsx scripts/smoke-rewards.ts`
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { ZONE_RPC } = await import("../lib/quai/constants");
  const { walkBlocks, walkMiningInfo } = await import("../lib/quai/blocks");
  const { calculateQuaiReward } = await import("../lib/quai/rewards");

  const tip = await fetch(ZONE_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "quai_blockNumber",
      params: [],
    }),
  })
    .then((r) => r.json())
    .then((d: { result: string }) => Number(BigInt(d.result)));

  const targets = [tip - 100, tip - 50, tip - 10];
  console.log(`[smoke] probing blocks ${targets.join(", ")}`);

  const blocks = await walkBlocks(Math.min(...targets), Math.max(...targets));
  const mi = await walkMiningInfo(targets);

  let mismatches = 0;
  for (const n of targets) {
    const b = blocks.find((x) => x.number === n);
    const m = mi.get(n);
    if (!b || !m) {
      console.error(`[smoke] missing data for #${n}`);
      mismatches++;
      continue;
    }
    // Recompute using our port
    const ours = calculateQuaiReward({
      difficulty: b.difficulty,
      exchangeRate: b.exchangeRate,
      primeTerminusNumber: b.primeTerminusNumber ?? 0,
      shaShares: b.shaCountEma ?? 0n,
      scryptShares: b.scryptCountEma ?? 0n,
    });
    // The RPC's baseBlockReward from getMiningInfo — we didn't store it on
    // BlockMiningInfo, but we can re-fetch to compare. For now, compare
    // against b.baseBlockReward which went through normalizeBlock → our port.
    const fromBlock = b.baseBlockReward;

    // Fetch RPC's own baseBlockReward for comparison.
    const rpcResp = await fetch(ZONE_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "quai_getMiningInfo",
        params: ["0x" + n.toString(16), false],
      }),
    })
      .then((r) => r.json())
      .then(
        (d: { result?: { baseBlockReward?: string } }) => d.result?.baseBlockReward,
      );
    const rpcReward = rpcResp ? BigInt(rpcResp) : null;

    const diff = rpcReward !== null ? ours - rpcReward : 0n;
    const pct =
      rpcReward && rpcReward > 0n
        ? Number((diff < 0n ? -diff : diff) * 10_000n / rpcReward) / 100
        : 0;

    console.log(
      `[smoke] #${n}  primeT=${b.primeTerminusNumber}` +
        `\n  ours:    ${ours}` +
        `\n  inBlock: ${fromBlock}` +
        `\n  rpc:     ${rpcReward}` +
        `\n  drift:   ${diff} (${pct}%)`,
    );
    if (rpcReward !== null && pct > 0.01) mismatches++;
  }

  if (mismatches > 0) {
    console.error(`[smoke] ${mismatches} mismatches — TS port needs review`);
    process.exit(1);
  }
  console.log(`[smoke] OK`);
}

main().catch((e) => {
  console.error("[smoke] ERROR", e);
  process.exit(1);
});
