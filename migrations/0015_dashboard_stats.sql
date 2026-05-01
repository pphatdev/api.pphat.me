-- Migration: 0015_dashboard_stats
-- Project Stats table
CREATE TABLE IF NOT EXISTS project_stats (
    project_id   TEXT    PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    views        INTEGER NOT NULL DEFAULT 0
);

-- Visitor Logs for live traffic tracking
CREATE TABLE IF NOT EXISTS visitor_logs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp    TEXT    NOT NULL,
    ip_hash      TEXT    NOT NULL,
    path         TEXT    NOT NULL
);
