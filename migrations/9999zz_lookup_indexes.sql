-- Lookup indexes found by the 2026-11-26 query audit.
--
-- Named `9999zz_` so it sorts AFTER 9999_create_tags.sql / 9999z_tags_unique.sql:
-- a `0035_` name would run before the tags table exists on fresh databases
-- (tests, db:reset, Turso built from migrations).
--
-- tags: the existing unique indexes lead with `tag` (tags(tag, article_id) /
-- tags(tag, project_id)), so SQLite cannot seek by owner. Every article/project
-- list and detail view ran `... FROM tags WHERE article_id|project_id IN (...)`
-- as a full index scan (~60-100 rows per call, ~10k rows/day).
CREATE INDEX IF NOT EXISTS idx_tags_article_id ON tags(article_id);
CREATE INDEX IF NOT EXISTS idx_tags_project_id ON tags(project_id);

-- refresh_tokens: `DELETE ... WHERE expires_at < datetime('now')` scanned the
-- whole table on every sweep.
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
