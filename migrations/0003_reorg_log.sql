-- Audit log for reorg detections and chunk-continuity mismatches.
-- Rows are append-only. Cheap. Operator review only — not queried by the app.

CREATE TABLE reorg_log (
    id             bigserial PRIMARY KEY,
    detected_at    timestamptz NOT NULL DEFAULT now(),
    detection_mode text NOT NULL,       -- 'tail' | 'backfill_continuity'
    diverge_from   bigint NOT NULL,     -- block number where chain diverged
    cursor_before  bigint NOT NULL,     -- cursor.last_ingested_block prior to fix
    old_hash       bytea,               -- our stored hash at diverge_from (pre-fix)
    new_hash       bytea,               -- RPC's hash at diverge_from
    note           text
);

CREATE INDEX reorg_log_detected_at_idx ON reorg_log (detected_at DESC);
