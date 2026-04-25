-- Add avg_block_time (seconds per block) to all rollup grains.
--
-- Derivation at rollup time:
--   (MAX(ts) - MIN(ts)) / NULLIF(COUNT(*) - 1, 0)
-- i.e. elapsed wall-clock over the period divided by the number of block-to-block
-- gaps within it. A strict per-gap mean (AVG of consecutive LAG deltas) would be
-- ~2x the cost on multi-million-row scans; the endpoint approximation is
-- indistinguishable at daily granularity and cheaper.
--
-- New rows default to 0 until the rollup worker repopulates them. Run a full
-- rebuild (`npm run rollup`) after deploying the matching rollup.ts change.

ALTER TABLE rollups_daily   ADD COLUMN avg_block_time numeric(10,4) NOT NULL DEFAULT 0;
ALTER TABLE rollups_weekly  ADD COLUMN avg_block_time numeric(10,4) NOT NULL DEFAULT 0;
ALTER TABLE rollups_monthly ADD COLUMN avg_block_time numeric(10,4) NOT NULL DEFAULT 0;
