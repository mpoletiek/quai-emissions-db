import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type GrainMeta = {
  rows: number;
  earliestPeriod: string | null;
  latestPeriod: string | null;
};

async function grainMeta(table: string): Promise<GrainMeta> {
  const { rows } = await pool.query<{
    n: string;
    min: string | null;
    max: string | null;
  }>(
    `SELECT COUNT(*)::text AS n,
            to_char(MIN(period_start), 'YYYY-MM-DD') AS min,
            to_char(MAX(period_start), 'YYYY-MM-DD') AS max
       FROM ${table}`,
  );
  return {
    rows: Number(rows[0].n),
    earliestPeriod: rows[0].min,
    latestPeriod: rows[0].max,
  };
}

export async function GET() {
  try {
    const [day, week, month] = await Promise.all([
      grainMeta("rollups_daily"),
      grainMeta("rollups_weekly"),
      grainMeta("rollups_monthly"),
    ]);

    const earliestCandidates = [
      day.earliestPeriod,
      week.earliestPeriod,
      month.earliestPeriod,
    ].filter((v): v is string => !!v);
    const latestCandidates = [
      day.latestPeriod,
      week.latestPeriod,
      month.latestPeriod,
    ].filter((v): v is string => !!v);

    const earliestRollup = earliestCandidates.length
      ? earliestCandidates.sort()[0]
      : null;
    const latestRollup = latestCandidates.length
      ? latestCandidates.sort().reverse()[0]
      : null;

    return NextResponse.json(
      {
        earliestRollup,
        latestRollup,
        grains: { day, week, month },
      },
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
