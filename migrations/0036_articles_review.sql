-- Non-admin accounts write their own posts but cannot publish them: they submit
-- a draft for review and an admin publishes it. `review_requested_at` marks a
-- draft as awaiting review (NULL = plain draft or already published). It is
-- separate from `publish_at`, which the cron uses to auto-publish scheduled rows.
ALTER TABLE articles ADD COLUMN review_requested_at TEXT;

-- "My posts" (owner) and "Contributing" (article_contributors.user_id) lists.
-- The contributors primary key leads with article_id, so it can't serve a
-- lookup by user.
CREATE INDEX IF NOT EXISTS idx_articles_owner_id ON articles(owner_id);
CREATE INDEX IF NOT EXISTS idx_article_contributors_user_id ON article_contributors(user_id);
