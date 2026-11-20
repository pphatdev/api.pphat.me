-- Migration: 9999z_tags_unique
-- NB: suffixed with `z` so it sorts AFTER 9999_create_tags.sql (which was
-- itself named 9999 because the tags table depends on both articles and
-- projects — see that file). Wrangler and the test migration runner both
-- sort migrations alphabetically, and in ASCII `_` (95) > `9` (57), so
-- 99999_ would sort BEFORE 9999_ — using `9999z_` is the straightforward
-- way to extend the 9999 series while guaranteeing the tags table exists.
-- A single article (or project) should not carry the same tag twice. The
-- controllers/repos previously accepted duplicate tags and happily inserted
-- them as separate rows, leaking duplicates into article detail responses.
-- We dedupe any existing duplicates first (keeping the row with the lowest
-- id per scope) and then create partial unique indexes so the constraint is
-- enforced for future writes. Tags that aren't scoped to anything are left
-- alone — global tag uniqueness is a separate concern.

-- Remove article-scoped duplicates: for each (tag, article_id) pair keep the
-- earliest row.
DELETE FROM tags WHERE id IN (
    SELECT t.id FROM tags t
    WHERE t.article_id IS NOT NULL
    AND t.id > (
        SELECT MIN(t2.id) FROM tags t2
        WHERE t2.tag = t.tag AND t2.article_id = t.article_id
    )
);

-- Remove project-scoped duplicates: for each (tag, project_id) pair keep the
-- earliest row.
DELETE FROM tags WHERE id IN (
    SELECT t.id FROM tags t
    WHERE t.project_id IS NOT NULL
    AND t.id > (
        SELECT MIN(t2.id) FROM tags t2
        WHERE t2.tag = t.tag AND t2.project_id = t.project_id
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_unique_per_article
ON tags(tag, article_id) WHERE article_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_unique_per_project
ON tags(tag, project_id) WHERE project_id IS NOT NULL;
