CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin', 'contributor', 'author')),
    provider TEXT NOT NULL CHECK(provider IN ('github', 'google', 'email')),
    provider_id TEXT NOT NULL,
    password_hash TEXT,
    email TEXT,
    name TEXT,
    email_verified INTEGER NOT NULL DEFAULT 0,
    avatar TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(provider, provider_id)
);
