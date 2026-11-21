-- Migration: 0028_create_faqs
-- Frequently Asked Questions (FAQ) catalog.
-- The answer field supports rich markdown / article content (headers, lists,
-- code blocks, formatting). An optional article_id links the FAQ directly
-- to an existing article in the catalog.
CREATE TABLE IF NOT EXISTS faqs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    question    TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    answer      TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'General',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    status      INTEGER NOT NULL DEFAULT 1 CHECK(status IN (0, 1)),
    article_id  TEXT REFERENCES articles(id) ON DELETE SET NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_faqs_category ON faqs(category);
CREATE INDEX IF NOT EXISTS idx_faqs_status ON faqs(status);
CREATE INDEX IF NOT EXISTS idx_faqs_sort_order ON faqs(sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_faqs_slug ON faqs(slug);
