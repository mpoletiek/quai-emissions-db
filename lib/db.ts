// pg connection pool for Next.js route handlers. Kept separate from
// scripts/ingest/db.ts so lifecycles don't collide (route handlers vs the
// long-running ingest worker).

import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set — check .env.local");

// Next.js dev mode HMR can re-execute module init; cache the pool on globalThis
// to prevent accumulating connections on every save.
declare global {
  // eslint-disable-next-line no-var
  var __quaiPgPool: Pool | undefined;
}

// `statement_timeout` (ms) — server-enforced cap so a single slow query
// can't hold a connection forever and starve the pool. Pair with the
// app-level date-range cap in lib/api-helpers.ts. `query_timeout` is the
// client-side counterpart; `connectionTimeoutMillis` bounds connect.
export const pool: Pool =
  globalThis.__quaiPgPool ??
  (globalThis.__quaiPgPool = new Pool({
    connectionString: url,
    max: 10,
    statement_timeout: 10_000,
    query_timeout: 12_000,
    connectionTimeoutMillis: 5_000,
  }));
