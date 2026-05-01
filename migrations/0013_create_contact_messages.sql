-- Migration: 0013_create_contact_messages
-- Contact messages table for "Get in touch" feature
CREATE TABLE IF NOT EXISTS contact_messages (
    id          TEXT PRIMARY KEY CHECK(id GLOB '????????-????-4???-[89ab]???-????????????'),
    name        TEXT NOT NULL,
    email       TEXT NOT NULL,
    subject     TEXT NOT NULL DEFAULT '',
    message     TEXT NOT NULL,
    ip_address  TEXT NOT NULL DEFAULT '',
    user_agent  TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
