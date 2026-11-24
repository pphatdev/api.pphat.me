-- Migration: 0032_create_services
-- Service offerings and feature section configuration.

CREATE TABLE IF NOT EXISTS service_sections (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    badge       TEXT NOT NULL DEFAULT 'Feature',
    title       TEXT NOT NULL DEFAULT 'What I can do for you',
    description TEXT NOT NULL DEFAULT 'I can help you build your next project from scratch. I have experience in web development, design, and cloud hosting. I can help you with everything from the initial design to the final deployment.',
    status      INTEGER NOT NULL DEFAULT 1 CHECK(status IN (0, 1)),
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT NOT NULL,
    icon        TEXT NOT NULL DEFAULT '',
    category    TEXT NOT NULL DEFAULT 'General',
    features    TEXT NOT NULL DEFAULT '[]',
    link_url    TEXT NOT NULL DEFAULT '',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    status      INTEGER NOT NULL DEFAULT 1 CHECK(status IN (0, 1)),
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);
CREATE INDEX IF NOT EXISTS idx_services_sort_order ON services(sort_order);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_service_sections_status ON service_sections(status);
