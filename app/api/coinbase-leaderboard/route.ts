// /api/coinbase-leaderboard — top N primary_coinbase addresses by blocks
// won within a configurable time window. Backed by the
// (primary_coinbase, ts DESC) index from migrations/0007.
//
// Query params:
//   days   how many days back to look (default 7, clamped 1..90)
//   limit  how many top addresses (default 10, clamped 1..100)
//
// Response:
//   { window: { days, since }, total, rows: [{ coinbase, blocks, pct }] }

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { apiServerError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Row = { primary_coinbase: Buffer; blocks: string };

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const days = clamp(Number(url.searchParams.get("days") ?? 7) || 7, 1, 90);
    const limit = clamp(Number(url.searchParams.get("limit") ?? 10) || 10, 1, 100);

    // Compute the window endpoints in UTC. Using NOW() AT TIME ZONE 'UTC'
    // would also work, but we want a stable ISO returned in the response.
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);

    const totalQ = await pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM blocks WHERE ts >= $1::timestamptz`,
      [since.toISOString()],
    );
    const total = Number(totalQ.rows[0]?.total ?? 0);

    const { rows } = await pool.query<Row>(
      `SELECT primary_coinbase, COUNT(*)::text AS blocks
         FROM blocks
        WHERE ts >= $1::timestamptz
        GROUP BY primary_coinbase
        ORDER BY COUNT(*) DESC
        LIMIT $2`,
      [since.toISOString(), limit],
    );

    const out = rows.map((r) => {
      const blocks = Number(r.blocks);
      return {
        coinbase: "0x" + Buffer.from(r.primary_coinbase).toString("hex"),
        blocks,
        pct: total > 0 ? (blocks / total) * 100 : 0,
      };
    });

    return NextResponse.json(
      {
        window: { days, since: since.toISOString() },
        total,
        rows: out,
      },
      {
        headers: {
          "cache-control": "s-maxage=300, stale-while-revalidate=900",
        },
      },
    );
  } catch (err) {
    return apiServerError("api/coinbase-leaderboard", err);
  }
}
