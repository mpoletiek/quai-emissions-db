-- Daily / weekly / monthly rollups. Identical shape; period_start semantics differ per grain:
--   daily   = UTC midnight of the day
--   weekly  = ISO Monday (UTC) of the week
--   monthly = 1st of the month (UTC)
--
-- burn_close / burn_delta are the SOLE authoritative burn metric (0x0050AF… balance flow).
-- quai_removed_sum / qi_removed_sum are gross debit flow — do NOT chart as burn.

CREATE TABLE rollups_daily (
    period_start         date PRIMARY KEY,
    first_block          bigint NOT NULL,
    last_block           bigint NOT NULL,
    block_count          int NOT NULL,
    partial              boolean NOT NULL,

    quai_added_sum       numeric(78,0) NOT NULL,
    quai_removed_sum     numeric(78,0) NOT NULL,
    qi_added_sum         numeric(78,0) NOT NULL,
    qi_removed_sum       numeric(78,0) NOT NULL,
    quai_net_emitted     numeric(78,0) NOT NULL,
    qi_net_emitted       numeric(78,0) NOT NULL,

    quai_total_end       numeric(78,0) NOT NULL,
    qi_total_end         numeric(78,0) NOT NULL,

    burn_close           numeric(78,0) NOT NULL,
    burn_delta           numeric(78,0) NOT NULL,

    winner_quai_count    int NOT NULL,
    winner_qi_count      int NOT NULL,

    workshare_total      bigint NOT NULL,
    workshare_avg        numeric(10,4) NOT NULL,

    conversion_flow_sum  numeric(78,0) NOT NULL,

    rate_open            numeric(78,0) NOT NULL,
    rate_high            numeric(78,0) NOT NULL,
    rate_low             numeric(78,0) NOT NULL,
    rate_close           numeric(78,0) NOT NULL,

    computed_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rollups_daily_last_block_idx ON rollups_daily (last_block);


CREATE TABLE rollups_weekly (
    period_start         date PRIMARY KEY,
    first_block          bigint NOT NULL,
    last_block           bigint NOT NULL,
    block_count          int NOT NULL,
    partial              boolean NOT NULL,

    quai_added_sum       numeric(78,0) NOT NULL,
    quai_removed_sum     numeric(78,0) NOT NULL,
    qi_added_sum         numeric(78,0) NOT NULL,
    qi_removed_sum       numeric(78,0) NOT NULL,
    quai_net_emitted     numeric(78,0) NOT NULL,
    qi_net_emitted       numeric(78,0) NOT NULL,

    quai_total_end       numeric(78,0) NOT NULL,
    qi_total_end         numeric(78,0) NOT NULL,

    burn_close           numeric(78,0) NOT NULL,
    burn_delta           numeric(78,0) NOT NULL,

    winner_quai_count    int NOT NULL,
    winner_qi_count      int NOT NULL,

    workshare_total      bigint NOT NULL,
    workshare_avg        numeric(10,4) NOT NULL,

    conversion_flow_sum  numeric(78,0) NOT NULL,

    rate_open            numeric(78,0) NOT NULL,
    rate_high            numeric(78,0) NOT NULL,
    rate_low             numeric(78,0) NOT NULL,
    rate_close           numeric(78,0) NOT NULL,

    computed_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rollups_weekly_last_block_idx ON rollups_weekly (last_block);


CREATE TABLE rollups_monthly (
    period_start         date PRIMARY KEY,
    first_block          bigint NOT NULL,
    last_block           bigint NOT NULL,
    block_count          int NOT NULL,
    partial              boolean NOT NULL,

    quai_added_sum       numeric(78,0) NOT NULL,
    quai_removed_sum     numeric(78,0) NOT NULL,
    qi_added_sum         numeric(78,0) NOT NULL,
    qi_removed_sum       numeric(78,0) NOT NULL,
    quai_net_emitted     numeric(78,0) NOT NULL,
    qi_net_emitted       numeric(78,0) NOT NULL,

    quai_total_end       numeric(78,0) NOT NULL,
    qi_total_end         numeric(78,0) NOT NULL,

    burn_close           numeric(78,0) NOT NULL,
    burn_delta           numeric(78,0) NOT NULL,

    winner_quai_count    int NOT NULL,
    winner_qi_count      int NOT NULL,

    workshare_total      bigint NOT NULL,
    workshare_avg        numeric(10,4) NOT NULL,

    conversion_flow_sum  numeric(78,0) NOT NULL,

    rate_open            numeric(78,0) NOT NULL,
    rate_high            numeric(78,0) NOT NULL,
    rate_low             numeric(78,0) NOT NULL,
    rate_close           numeric(78,0) NOT NULL,

    computed_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rollups_monthly_last_block_idx ON rollups_monthly (last_block);
