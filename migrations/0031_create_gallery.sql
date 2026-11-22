-- Migration: 0031_create_gallery
-- Curated visual assets, photos, and showcase albums displayed on the public gallery.
CREATE TABLE IF NOT EXISTS gallery (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT NOT NULL,
    caption       TEXT NOT NULL DEFAULT '',
    alt_text      TEXT NOT NULL DEFAULT '',
    media_path    TEXT NOT NULL,
    category      TEXT NOT NULL DEFAULT 'photography',
    tags          TEXT NOT NULL DEFAULT '[]',
    is_public     INTEGER NOT NULL DEFAULT 1 CHECK(is_public IN (0, 1)),
    is_featured   INTEGER NOT NULL DEFAULT 0 CHECK(is_featured IN (0, 1)),
    sort_order    INTEGER NOT NULL DEFAULT 0,
    aspect_ratio  TEXT NOT NULL DEFAULT '16/9' CHECK(aspect_ratio IN ('16/9', '4/3', '1/1', '3/4', '9/16', 'auto')),
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gallery_category ON gallery(category);
CREATE INDEX IF NOT EXISTS idx_gallery_is_public ON gallery(is_public);
CREATE INDEX IF NOT EXISTS idx_gallery_is_featured ON gallery(is_featured);
CREATE INDEX IF NOT EXISTS idx_gallery_sort_order ON gallery(sort_order);
