-- Authors table
CREATE TABLE IF NOT EXISTS authors (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    profile     TEXT NOT NULL DEFAULT '',
    url         TEXT NOT NULL DEFAULT ''
);

-- Author Details Separate table for additional author information
CREATE TABLE IF NOT EXISTS author_details (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id   INTEGER NOT NULL UNIQUE REFERENCES authors(id) ON DELETE CASCADE,
    bio         TEXT NOT NULL DEFAULT '',
    avatar_url  TEXT NOT NULL DEFAULT '',
    social_links TEXT NOT NULL DEFAULT '',  -- JSON string of social media links
    status      INTEGER NOT NULL DEFAULT 0,  -- 0 = inactive, 1 = active
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

-- Junction table linking articles to authors
CREATE TABLE IF NOT EXISTS article_authors (
    article_id  TEXT    NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    author_id   INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    PRIMARY KEY (article_id, author_id)
);