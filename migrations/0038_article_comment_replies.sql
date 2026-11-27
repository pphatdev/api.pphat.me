-- One level of replies: a reply points at the top-level comment it answers
-- (replying to a reply joins the same thread). NULL = top-level comment.
-- Deleting a comment removes its replies with it.
ALTER TABLE article_comments ADD COLUMN parent_id INTEGER REFERENCES article_comments(id) ON DELETE CASCADE;

-- Top-level listing (parent_id IS NULL, newest first) and loading the replies
-- of a page of comments both go through this index.
CREATE INDEX IF NOT EXISTS idx_article_comments_thread ON article_comments(article_id, parent_id, created_at);
