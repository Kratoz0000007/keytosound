CREATE TABLE users (
    id            UUID         PRIMARY KEY,
    email         VARCHAR(254) NOT NULL,
    -- 100, not bcrypt's 60: the hash carries its algorithm prefix
    -- ({bcrypt}$2a$10$...), which lets a later algorithm change happen
    -- without a data migration.
    password_hash VARCHAR(100) NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
-- The service lowercases emails before storing them; this is the second line
-- of defence against a code path that skips that step.
CREATE UNIQUE INDEX uq_users_email ON users (lower(email));

-- Throwaway dev saves from before accounts existed. Keeping them would leave
-- a nullable column and a dead code path forever.
DELETE FROM compositions WHERE user_id IS NULL;
ALTER TABLE compositions ALTER COLUMN user_id SET NOT NULL;
-- Deleting a user cascades to their compositions, which already cascade to keystrokes.
ALTER TABLE compositions ADD CONSTRAINT fk_compositions_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
CREATE INDEX idx_compositions_user_created ON compositions (user_id, created_at DESC);
