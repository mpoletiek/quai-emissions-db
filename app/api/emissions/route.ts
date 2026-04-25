import { NextResponse } from "next/server";
import { fetchMiningInfo } from "@/lib/quai/endpoints";
import { deriveEmission, analyticsOnlyEmission } from "@/lib/quai/emissions";
import { serializeBig } from "@/lib/quai/serialize";
import {
  storeAnalyticsRange,
  storeBlocks,
  storeLatestBlockNumber,
} from "@/lib/store";
import type { Emission } from "@/lib/quai/types";
import { DEFAULT_WINDOW, MAX_WINDOW } from "@/lib/quai/constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(
      MAX_WINDOW,
      Math.max(
        10,
        Number(url.searchParams.get("limit") ?? DEFAULT_WINDOW),
      ),
    );

    const [info, latest] = await Promise.all([
      fetchMiningInfo(),
      storeLatestBlockNumber(),
    ]);
    const from = Math.max(1, latest - limit + 1);

    // With the store, every block has full detail — the MAX_DETAIL_WINDOW
    // split from the RPC-backed implementation is no longer needed. Fetch
    // blocks and analytics for the full window in parallel.
    const [blocks, analyticsMap] = await Promise.all([
      storeBlocks(from, latest),
      storeAnalyticsRange(from, latest),
    ]);

    const blockByNumber = new Map(blocks.map((b) => [b.number, b]));
    const emissions: Emission[] = [];
    for (let n = from; n <= latest; n++) {
      const a = analyticsMap.get(n);
      if (!a) continue;
      const b = blockByNumber.get(n);
      emissions.push(b ? deriveEmission(b, info, a) : analyticsOnlyEmission(n, a));
    }
    const latestAnalytics = analyticsMap.get(latest) ?? null;

    return NextResponse.json(
      {
        latest,
        window: { requested: limit, returned: emissions.length },
        info: serializeBig(info),
        emissions: serializeBig(emissions),
        latestAnalytics: latestAnalytics ? serializeBig(latestAnalytics) : null,
      },
      {
        headers: {
          "cache-control": "s-maxage=15, stale-while-revalidate=60",
        },
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
