-- Migration: 0015_link_author_user
-- Link author profiles to authenticated user accounts (optional 1-to-1)
ALTER TABLE authors ADD COLUMN user_id TEXT UNIQUE REFERENCES users(id);
