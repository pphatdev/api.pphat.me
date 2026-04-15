-- Migration: 0001_create_articles
-- Articles table
CREATE TABLE IF NOT EXISTS articles (
    id          TEXT PRIMARY KEY CHECK(id GLOB '????????-????-4???-[89ab]???-????????????'),
    title       TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    thumbnail   TEXT NOT NULL DEFAULT '',
    published   INTEGER NOT NULL DEFAULT 0,  -- 0 = false, 1 = true
    content     TEXT NOT NULL DEFAULT '',
    file_path   TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);