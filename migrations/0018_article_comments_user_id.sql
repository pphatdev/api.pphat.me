-- Add user_id to article_comments for ownership tracking.
-- Nullable so legacy rows are preserved; new rows must set it (enforced by application).
ALTER TABLE article_comments ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_article_comments_user_id ON article_comments(user_id);
