-- Migration: 0001_create_articles
-- Articles table
CREATE TABLE IF NOT EXISTS articles (
    id          TEXT PRIMARY KEY CHECK(id GLOB '????????-????-4???-[89ab]???-????????????'),
    title       TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    thumbnail   TEXT NOT NULL DEFAULT '',
    published   INTEGER NOT NULL DEFAULT 0,  -- 0 = false, 1 = true
    owner_id TEXT REFERENCES users(id),
    content     TEXT NOT NULL DEFAULT '',
    file_path   TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

-- Junction table linking articles to authenticated users who can edit (contributors)
CREATE TABLE IF NOT EXISTS article_contributors (
    article_id  TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    user_id     TEXT NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    PRIMARY KEY (article_id, user_id)
);