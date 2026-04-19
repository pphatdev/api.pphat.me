-- Migration: 0010_create_project_contributors
-- Project contributors (many-to-many with authors table)
CREATE TABLE IF NOT EXISTS project_contributors (
    project_id  TEXT    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    author_id   INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, author_id)
);
