-- 0007_coinbase_index.sql
-- Index supporting the /api/coinbase-leaderboard query (top N
-- primary_coinbase addresses by blocks won within a time window).
-- Without this, every leaderboard hit is a sequential scan + sort over
-- the entire blocks table.
--
-- The leading column is primary_coinbase so the GROUP BY is index-driven;
-- ts DESC supports the "last 7d" window predicate used by the /mining page.
--
-- Created CONCURRENTLY-safe? No — CREATE INDEX in a transaction-wrapped
-- migration cannot be CONCURRENT. If this migration is applied while the
-- ingest worker is hot, the brief AccessExclusiveLock on blocks may stall
-- writes. blocks is large; consider applying during a tail-mode pause.

CREATE INDEX IF NOT EXISTS blocks_coinbase_ts_idx
  ON blocks (primary_coinbase, ts DESC);
