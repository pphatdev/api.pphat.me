-- Article Comments table
CREATE TABLE IF NOT EXISTS article_comments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id  TEXT    NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    author_name TEXT    NOT NULL,
    content     TEXT    NOT NULL,
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
);
