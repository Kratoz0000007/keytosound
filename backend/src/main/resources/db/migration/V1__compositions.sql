CREATE TABLE compositions (
    id         UUID         PRIMARY KEY,
    -- Nullable until Plan 3 introduces accounts; adding the FK later is then
    -- a pure ALTER with no data migration.
    user_id    UUID,
    title      VARCHAR(120) NOT NULL,
    genre_id   VARCHAR(32)  NOT NULL,
    seed       BIGINT       NOT NULL,
    settings   JSONB        NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- A dedicated sequence rather than BIGSERIAL: Hibernate silently disables JDBC
-- batching for IDENTITY columns, and a composition can carry thousands of
-- keystrokes. allocationSize in the entity must match INCREMENT BY here.
CREATE SEQUENCE keystroke_seq START WITH 1 INCREMENT BY 50;

CREATE TABLE keystrokes (
    id             BIGINT           PRIMARY KEY,
    composition_id UUID             NOT NULL REFERENCES compositions (id) ON DELETE CASCADE,
    ordinal        INTEGER          NOT NULL,
    -- "key" is reserved in SQL, hence key_value.
    key_value      VARCHAR(16)      NOT NULL,
    timestamp_ms   DOUBLE PRECISION NOT NULL,
    CONSTRAINT uq_keystroke_order UNIQUE (composition_id, ordinal)
);

CREATE INDEX idx_keystrokes_composition ON keystrokes (composition_id, ordinal);
CREATE INDEX idx_compositions_created ON compositions (created_at DESC);
