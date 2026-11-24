-- Migration: 0026_create_skills
-- Standalone skills catalog for the resume/profile view. Each skill is backed
-- by a tech_stacks row — the icon and image come from there so the catalog
-- stays the single source of truth for a technology's branding, and skills
-- only hold the ownership metadata (level, years, free-text description).
-- The unique index on tech_stack_id prevents duplicate "React" skills.
CREATE TABLE IF NOT EXISTS skills (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    tech_stack_id       INTEGER NOT NULL REFERENCES tech_stacks(id) ON DELETE CASCADE,
    level               TEXT NOT NULL DEFAULT 'intermediate'
                            CHECK(level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    years_of_experience REAL,
    description         TEXT NOT NULL DEFAULT '',
    sort_order          INTEGER NOT NULL DEFAULT 0,
    status              INTEGER NOT NULL DEFAULT 1 CHECK(status IN (0, 1)),
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_tech_stack_unique
ON skills(tech_stack_id);
