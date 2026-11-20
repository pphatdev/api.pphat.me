-- Migration: 0023_create_tech_stacks
-- Reference catalog of technologies. Standalone for now — can later be joined
-- into projects via a project_tech_stacks table if we want strong-typed refs
-- instead of the current JSON `project_details.tech_stack` array.
CREATE TABLE IF NOT EXISTS tech_stacks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    url         TEXT NOT NULL DEFAULT '',
    logo_url    TEXT NOT NULL DEFAULT '',
    -- Optional per the spec: cover image is nullable when none is uploaded.
    cover       TEXT,
    status      INTEGER NOT NULL DEFAULT 1 CHECK(status IN (0, 1)),
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
