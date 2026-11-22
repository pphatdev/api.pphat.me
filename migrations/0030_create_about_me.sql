-- Migration: 0030_create_about_me
-- About Me profile and hero section configuration for portfolio.
CREATE TABLE IF NOT EXISTS about_me (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    badge         TEXT NOT NULL DEFAULT 'About me!',
    title         TEXT NOT NULL,
    description   TEXT NOT NULL,
    button_text   TEXT NOT NULL DEFAULT 'Gallery',
    button_url    TEXT NOT NULL DEFAULT '',
    images        TEXT NOT NULL DEFAULT '[]',
    name          TEXT NOT NULL DEFAULT '',
    nickname      TEXT NOT NULL DEFAULT '',
    role          TEXT NOT NULL DEFAULT '',
    location      TEXT NOT NULL DEFAULT '',
    sort_order    INTEGER NOT NULL DEFAULT 0,
    status        INTEGER NOT NULL DEFAULT 1 CHECK(status IN (0, 1)),
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_about_me_status ON about_me(status);
CREATE INDEX IF NOT EXISTS idx_about_me_sort_order ON about_me(sort_order);
