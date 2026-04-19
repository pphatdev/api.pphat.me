-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tag         TEXT NOT NULL,
    article_id TEXT NULL REFERENCES articles(id) ON DELETE CASCADE,
    project_id TEXT NULL REFERENCES projects(id) ON DELETE CASCADE,
    description   TEXT NOT NULL DEFAULT ''
);