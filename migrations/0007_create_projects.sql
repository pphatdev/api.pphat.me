-- Migration: 0007_create_projects
-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY CHECK(id GLOB '????????-????-4???-[89ab]???-????????????'),
    title       TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    thumbnail   TEXT NOT NULL DEFAULT '',
    published   INTEGER NOT NULL DEFAULT 0,  -- 0 = false, 1 = true
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    languages   TEXT NOT NULL DEFAULT '[]'  -- JSON array of languages
);
