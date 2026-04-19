-- Article Stats table (one-to-one with articles)
CREATE TABLE IF NOT EXISTS article_stats (
    article_id   TEXT    PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
    views        INTEGER NOT NULL DEFAULT 0,
    reading_mins INTEGER NOT NULL DEFAULT 0
);
