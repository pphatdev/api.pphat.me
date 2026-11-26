-- Anonymous view dedupe for public readers (blog visitors are not signed in).
--
-- One row per (article, visitor, UTC day). `visitor_hash` is
-- HMAC-SHA-256(secret, day | article | ip | user-agent): the raw IP is never
-- stored, and because the day and article are part of the input the same
-- reader cannot be linked across days or across articles. Rows are only
-- needed for the current day; the cron sweeps anything older than 2 days.
CREATE TABLE IF NOT EXISTS article_view_visitor (
    article_id   TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    visitor_hash TEXT NOT NULL,
    day          TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (article_id, visitor_hash, day)
);

CREATE INDEX IF NOT EXISTS idx_view_visitor_day ON article_view_visitor(day);
