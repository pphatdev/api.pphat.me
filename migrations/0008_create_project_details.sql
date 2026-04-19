-- Migration: 0008_create_project_details
-- Project details (one-to-one with projects)
CREATE TABLE IF NOT EXISTS project_details (
    id          TEXT PRIMARY KEY CHECK(id GLOB '????????-????-4???-[89ab]???-????????????'),
    project_id  TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    content     TEXT NOT NULL DEFAULT '',
    demo_url    TEXT NOT NULL DEFAULT '',
    repo_url    TEXT NOT NULL DEFAULT '',
    tech_stack  TEXT NOT NULL DEFAULT '[]',  -- JSON array
    status      TEXT NOT NULL DEFAULT 'in-progress' CHECK(status IN ('in-progress', 'completed', 'archived')),
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
