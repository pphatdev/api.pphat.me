-- Refresh tokens: switch from storing the raw JWT to storing a SHA-256 hash,
-- and add a `family_id` for reuse-detection (rotate on refresh; if a consumed
-- token is presented again, revoke every row that shares its family).
--
-- Live refresh tokens issued before this migration are invalidated (users
-- must log in again). Acceptable because this is a labs project; a
-- production rollout would backfill by hashing the existing `token` column
-- in-place before dropping it.

DROP TABLE IF EXISTS refresh_tokens;

CREATE TABLE refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    family_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    consumed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_family_id ON refresh_tokens(family_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
