-- Migration: 0027_articles_position
-- Admin-controlled display order for the article list. Lower `position`
-- sorts first; ties fall back to `created_at DESC` (the pre-existing default).
--
-- Backfill assigns each row the index it would occupy if the current
-- `created_at DESC` order were materialised, so nothing visibly moves until
-- an admin drags something in the dashboard.
ALTER TABLE articles ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

UPDATE articles
SET position = (
    SELECT COUNT(*) FROM articles a2 WHERE a2.created_at > articles.created_at
);

CREATE INDEX IF NOT EXISTS idx_articles_position ON articles(position);
