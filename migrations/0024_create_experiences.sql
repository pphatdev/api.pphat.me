-- Migration: 0024_create_experiences
-- Resume-style timeline. end_date is nullable — a NULL end_date means the
-- role is current and should sort to the top of the timeline. The default
-- order (see experiences.repo) coalesces NULL to a far-future date so SQLite
-- sorts current roles first without needing NULLS FIRST support.
CREATE TABLE IF NOT EXISTS experiences (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    company         TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    start_date      TEXT NOT NULL,
    -- NULL = current / ongoing
    end_date        TEXT,
    location        TEXT NOT NULL DEFAULT '',
    -- CHECK matches the client wire values exactly; add here when a new
    -- employment type is introduced rather than relying on application code.
    employment_type TEXT NOT NULL DEFAULT 'full-time'
        CHECK(employment_type IN ('full-time', 'part-time', 'contract', 'internship', 'freelance')),
    company_url     TEXT NOT NULL DEFAULT '',
    logo_url        TEXT NOT NULL DEFAULT '',
    -- Optional per the spec: cover image is nullable when none is uploaded.
    cover           TEXT,
    status          INTEGER NOT NULL DEFAULT 1 CHECK(status IN (0, 1)),
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);
