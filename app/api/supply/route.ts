// /api/supply — supply curves with realized-circulating math.
//
// Backed by v_supply_{daily,weekly,monthly} (migrations/0006). The view does
// the genesis-premine + Singularity-skip math so the route handler is a pure
// projection. Single source of truth: never replicate the formula client-side.
//
// Query params:
//   period   day | week | month   (required)
//   from     YYYY-MM-DD (required, UTC)
//   to       YYYY-MM-DD (required, UTC)
//   include  comma-separated subset of: qi, burn, genesis
//            (defaults to "qi,burn"; "genesis" adds the cumulative-genesis
//             baseline as a separate column for the supply-decomposition page)
//
// Response (JSON, bigints serialized as { __big: "..." } via serializeBig):
//   { period, rows: [{
//       periodStart, firstBlock, lastBlock, blockCount, partial,
//       quaiTotalEnd, realizedCirculatingQuai,
//       qiTotalEnd?, burnClose?, burnDelta?, genesisBaselineQuai?
//     }] }
//
// Caching mirrors /api/rollups (60s s-maxage / 300s SWR). Past periods are
// immutable; today's partial row updates as the tail-mode rollup rebuilder
// re-aggregates.

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { serializeBig } from "@/lib/quai/serialize";
import {
  GENESIS_PREMINE_QUAI,
  SINGULARITY_FORK_DATE,
  SINGULARITY_SKIP_QUAI,
} from "@/lib/quai/protocol-constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const GRAIN_TO_VIEW: Record<string, string> = {
  day: "v_supply_daily",
  week: "v_supply_weekly",
  month: "v_supply_monthly",
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ROWS = 3000;

type SupplyRow = {
  period_start: string;
  first_block: string;
  last_block: string;
  block_count: number;
  partial: boolean;
  quai_total_end: string;
  qi_total_end: string;
  burn_close: string;
  burn_delta: string;
  realized_circulating_quai: string;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const period = url.searchParams.get("period") ?? "day";
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const includeRaw = url.searchParams.get("include") ?? "qi,burn";
    const include = new Set(includeRaw.split(",").map((s) => s.trim()).filter(Boolean));

    const view = GRAIN_TO_VIEW[period];
    if (!view) {
      return NextResponse.json(
        { error: `invalid period: ${period} (expected day|week|month)` },
        { status: 400 },
      );
    }
    if (!from || !ISO_DATE_RE.test(from) || !to || !ISO_DATE_RE.test(to)) {
      return NextResponse.json(
        { error: "from and to are required as YYYY-MM-DD" },
        { status: 400 },
      );
    }

    const { rows } = await pool.query<SupplyRow>(
      `SELECT
         to_char(period_start, 'YYYY-MM-DD') AS period_start,
         first_block::text, last_block::text, block_count, partial,
         quai_total_end::text,
         qi_total_end::text,
         burn_close::text, burn_delta::text,
         realized_circulating_quai::text
       FROM ${view}
       WHERE period_start >= $1::date AND period_start <= $2::date
       ORDER BY period_start ASC
       LIMIT ${MAX_ROWS}`,
      [from, to],
    );

    // Genesis baseline is a step function — flat 3 B QUAI before Singularity,
    // (3 B − 1.667 B) = 1.333 B after. We expose it as a column so charts can
    // render the genesis-unlocks layer without re-deriving the math client-side.
    const genesisPre = GENESIS_PREMINE_QUAI;
    const genesisPost = GENESIS_PREMINE_QUAI - SINGULARITY_SKIP_QUAI;

    const data = rows.map((r) => {
      const out: Record<string, unknown> = {
        periodStart: r.period_start,
        firstBlock: Number(r.first_block),
        lastBlock: Number(r.last_block),
        blockCount: r.block_count,
        partial: r.partial,
        quaiTotalEnd: BigInt(r.quai_total_end),
        realizedCirculatingQuai: BigInt(r.realized_circulating_quai),
      };
      if (include.has("qi")) {
        out.qiTotalEnd = BigInt(r.qi_total_end);
      }
      if (include.has("burn")) {
        out.burnClose = BigInt(r.burn_close);
        out.burnDelta = BigInt(r.burn_delta);
      }
      if (include.has("genesis")) {
        out.genesisBaselineQuai =
          r.period_start >= SINGULARITY_FORK_DATE ? genesisPost : genesisPre;
      }
      return out;
    });

    return NextResponse.json(
      { period, rows: serializeBig(data) },
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
