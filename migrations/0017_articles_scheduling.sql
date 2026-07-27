-- Article publish scheduling.
-- `is_public` gates whether an article appears in the public list. It is set to 1
-- either explicitly by the author (immediate publish) or by the scheduled() cron
-- when `publish_at` (stored as UTC ISO) has elapsed. Times on the wire are Asia/Phnom_Penh
-- (+07:00, fixed offset, no DST) and are converted to UTC before storage.
ALTER TABLE articles ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
ALTER TABLE articles ADD COLUMN publish_at TEXT;

-- Backfill: any already-published article stays visible.
UPDATE articles SET is_public = 1 WHERE published = 1;

-- Composite index for the cron scan (`is_public = 0 AND publish_at <= now()`).
CREATE INDEX IF NOT EXISTS idx_articles_scheduling ON articles(is_public, publish_at);
