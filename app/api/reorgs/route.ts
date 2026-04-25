// /api/reorgs — paginated reorg log for the /dashboard/live page.
// Append-only audit table from migrations/0003. Reads are cheap.
//
// Query params:
//   limit   page size (default 50, clamped 1..200)
//   before  bigint cursor (id < before); omit for newest page

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Row = {
  id: string;
  detected_at: string;
  detection_mode: string;
  diverge_from: string;
  cursor_before: string;
  old_hash: Buffer | null;
  new_hash: Buffer | null;
  note: string | null;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = clamp(Number(url.searchParams.get("limit") ?? 50) || 50, 1, 200);
    const beforeRaw = url.searchParams.get("before");
    const before = beforeRaw && /^\d+$/.test(beforeRaw) ? beforeRaw : null;

    // Also surface the 24h count so the live hero can show a single number
    // without a second roundtrip.
    const dayQ = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM reorg_log WHERE detected_at >= now() - interval '24 hours'`,
    );
    const last24h = Number(dayQ.rows[0]?.count ?? 0);

    const params: unknown[] = [];
    let where = "";
    if (before) {
      params.push(before);
      where = `WHERE id < $${params.length}`;
    }
    params.push(limit);

    const { rows } = await pool.query<Row>(
      `SELECT
         id::text, detected_at,
         detection_mode,
         diverge_from::text,
         cursor_before::text,
         old_hash, new_hash, note
       FROM reorg_log
       ${where}
       ORDER BY id DESC
       LIMIT $${params.length}`,
      params,
    );

    const out = rows.map((r) => ({
      id: r.id,
      detectedAt: r.detected_at,
      detectionMode: r.detection_mode,
      divergeFrom: Number(r.diverge_from),
      cursorBefore: Number(r.cursor_before),
      oldHash: r.old_hash ? "0x" + Buffer.from(r.old_hash).toString("hex") : null,
      newHash: r.new_hash ? "0x" + Buffer.from(r.new_hash).toString("hex") : null,
      note: r.note,
    }));

    const nextCursor = out.length === limit ? out[out.length - 1].id : null;

    return NextResponse.json(
      { last24h, rows: out, nextCursor },
      {
        headers: {
          "cache-control": "s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
