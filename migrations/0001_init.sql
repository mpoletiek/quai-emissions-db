-- Initial schema: blocks, supply_analytics, ingest_cursor.
-- See docs/phase2-backend-plan.md §1 for field rationale and supply reconciliation notes.

CREATE TABLE blocks (
    block_number            bigint PRIMARY KEY,
    hash                    bytea NOT NULL,
    parent_hash             bytea,
    ts                      timestamptz NOT NULL,
    primary_coinbase        bytea NOT NULL,
    winner_token            smallint NOT NULL,           -- 0=QUAI, 1=QI; coinbase-derived, see emissions.ts caveat
    exchange_rate           numeric(78,0) NOT NULL,
    k_quai_discount         numeric(78,0),
    conversion_flow_amount  numeric(78,0),
    difficulty              numeric(78,0),
    miner_difficulty        numeric(78,0),
    workshare_count         int NOT NULL,
    finalized               boolean NOT NULL DEFAULT false,
    ingested_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX blocks_ts_idx        ON blocks (ts DESC);
CREATE INDEX blocks_winner_idx    ON blocks (winner_token, ts DESC);
CREATE INDEX blocks_finalized_idx ON blocks (finalized) WHERE finalized = false;


CREATE TABLE supply_analytics (
    block_number       bigint PRIMARY KEY REFERENCES blocks(block_number) ON DELETE CASCADE,
    quai_added         numeric(78,0) NOT NULL,  -- gross credit counter; NOT "minted"
    quai_removed       numeric(78,0) NOT NULL,  -- gross debit counter; NOT "burned" (see reconciliation)
    quai_total         numeric(78,0) NOT NULL,  -- already net of balanceOf(0x0050AF…) per go-quai RPC
    qi_added           numeric(78,0) NOT NULL,
    qi_removed         numeric(78,0) NOT NULL,
    qi_total           numeric(78,0) NOT NULL,
    soap_burn_balance  numeric(78,0) NOT NULL,  -- sole authoritative burn signal: balanceOf(0x0050AF…) at this block
    ts                 timestamptz NOT NULL,    -- denormalized from blocks.ts for fast range scans
    ingested_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sa_ts_idx ON supply_analytics (ts DESC);


CREATE TABLE ingest_cursor (
    id                    smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    last_ingested_block   bigint NOT NULL DEFAULT 0,
    last_finalized_block  bigint NOT NULL DEFAULT 0,
    last_tailed_at        timestamptz,
    backfill_done         boolean NOT NULL DEFAULT false
);

INSERT INTO ingest_cursor (id) VALUES (1);
