-- Article Reactions table
CREATE TABLE IF NOT EXISTS article_reactions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id TEXT    NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    type       TEXT    NOT NULL,
    count      INTEGER NOT NULL DEFAULT 0,
    UNIQUE (article_id, type)
);
