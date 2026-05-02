// Shared helpers for app/api/*/route.ts. Two responsibilities:
//   1. Centralize the error response so route handlers stop returning raw pg
//      / RPC error messages to clients (which leak schema, internal IPs,
//      query text, and pg pool internals).
//   2. Enforce a date-range cap on user-supplied from/to windows so a single
//      request can't trigger a multi-decade scan against the rollup tables.
//
// All routes here read a `period` (day/week/month) and a `from`/`to` date
// pair. The cap is grain-aware: a 5-year window of daily rows is fine
// (~1,800 rows), but a 50-year window would be a DoS vector.
import { NextResponse } from "next/server";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MS_PER_DAY = 86_400_000;
const MAX_DAYS = 5 * 366; // ~5 years (leap-tolerant)

/** Generic 5xx response. Logs the error server-side for ops; the client
 *  only ever sees a fixed string so we don't leak Postgres details. */
export function apiServerError(scope: string, err: unknown): NextResponse {
  // eslint-disable-next-line no-console
  console.error(`[${scope}]`, err);
  return NextResponse.json({ error: "internal error" }, { status: 500 });
}

/** Validates period/from/to query params and enforces the date-range cap.
 *  On success returns the parsed values; on failure returns a 400 with a
 *  short, non-leaky message. */
export function parseRangeParams(url: URL): {
  period: "day" | "week" | "month";
  from: string;
  to: string;
} | NextResponse {
  const period = url.searchParams.get("period") ?? "day";
  if (period !== "day" && period !== "week" && period !== "month") {
    return NextResponse.json(
      { error: "invalid period (expected day|week|month)" },
      { status: 400 },
    );
  }
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !ISO_DATE_RE.test(from) || !to || !ISO_DATE_RE.test(to)) {
    return NextResponse.json(
      { error: "from and to are required as YYYY-MM-DD" },
      { status: 400 },
    );
  }
  const fromTs = Date.parse(from + "T00:00:00Z");
  const toTs = Date.parse(to + "T00:00:00Z");
  if (!Number.isFinite(fromTs) || !Number.isFinite(toTs)) {
    return NextResponse.json(
      { error: "from/to must be real calendar dates" },
      { status: 400 },
    );
  }
  if (fromTs > toTs) {
    return NextResponse.json(
      { error: "from must be on or before to" },
      { status: 400 },
    );
  }
  if ((toTs - fromTs) / MS_PER_DAY > MAX_DAYS) {
    return NextResponse.json(
      { error: `date range too large (max ${MAX_DAYS} days)` },
      { status: 400 },
    );
  }
  return { period, from, to };
}

export { ISO_DATE_RE };
