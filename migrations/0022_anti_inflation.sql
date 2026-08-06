-- Anti-inflation controls (#25).
--
-- reaction_user: dedupe per (article, type, user). We keep the existing
-- `article_reactions` table (which stores aggregate counts per type) and
-- add a second table that records WHO reacted so a repeat click by the
-- same user is idempotent. Increment logic is now:
--   1. INSERT OR IGNORE into reaction_user
--   2. only if that insert created a row, bump the aggregate count
--
-- view_event: dedupe views by (article, user, calendar day). Same pattern:
-- INSERT OR IGNORE against a per-day marker, only bump article_stats.views
-- on the first insert of the day. Anonymous callers can't be deduped here
-- (they hit the view endpoint via authGuard so there's always a user_id).

CREATE TABLE IF NOT EXISTS article_reaction_user (
    article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    type       TEXT NOT NULL,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (article_id, type, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reaction_user_by_article ON article_reaction_user(article_id);
CREATE INDEX IF NOT EXISTS idx_reaction_user_by_user ON article_reaction_user(user_id);

CREATE TABLE IF NOT EXISTS article_view_event (
    article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Calendar day of the view (UTC), stored as `YYYY-MM-DD` so the UNIQUE
    -- key groups all views for that user+article within one day.
    day        TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (article_id, user_id, day)
);

CREATE INDEX IF NOT EXISTS idx_view_event_by_article ON article_view_event(article_id);
