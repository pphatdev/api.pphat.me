-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tag         TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT ''
);

-- Junction table linking articles to tags
CREATE TABLE IF NOT EXISTS article_tags (
    article_id  TEXT    NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (article_id, tag_id)
);