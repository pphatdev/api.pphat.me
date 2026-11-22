-- Migration: 0029_projects_order_sequence
-- Admin-controlled display order / sequence for the project list.
-- Lower `position` sorts first; ties fall back to `created_at DESC`.
--
-- Backfill assigns each row the index it would occupy if the current
-- `created_at DESC` order were materialised, so nothing visibly moves until
-- an admin reorders projects.
ALTER TABLE projects ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

UPDATE projects
SET position = (
    SELECT COUNT(*) FROM projects p2 WHERE p2.created_at > projects.created_at
);

CREATE INDEX IF NOT EXISTS idx_projects_position ON projects(position);
