import { NextResponse } from "next/server";
import { serializeBig } from "@/lib/quai/serialize";
import { storeBlocks, storeLatestBlockNumber } from "@/lib/store";
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
    const latest = await storeLatestBlockNumber();
    const from = Math.max(1, latest - limit + 1);
    const blocks = await storeBlocks(from, latest);
    return NextResponse.json(
      { latest, count: blocks.length, blocks: serializeBig(blocks) },
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
