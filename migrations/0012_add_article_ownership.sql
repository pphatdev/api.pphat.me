-- Migration: 0012_add_article_ownership
-- Add owner_id to articles (the authenticated user who created it)
ALTER TABLE articles ADD COLUMN owner_id TEXT REFERENCES users(id);

-- Junction table linking articles to authenticated users who can edit (contributors)
CREATE TABLE IF NOT EXISTS article_contributors (
    article_id  TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    user_id     TEXT NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    PRIMARY KEY (article_id, user_id)
);
