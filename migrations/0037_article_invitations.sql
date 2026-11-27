-- An article owner (or admin) invites someone by email to contribute. The
-- invitee sees it in their workspace once signed in with that email and
-- accepts (becoming a row in article_contributors) or declines. Rows are kept
-- for history; `status` moves pending -> accepted | declined | revoked, and a
-- new invite to the same address reopens the row.
CREATE TABLE IF NOT EXISTS article_invitations (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id   TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    email        TEXT NOT NULL,                -- stored lower-cased
    invited_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
    status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'accepted', 'declined', 'revoked')),
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    responded_at TEXT,
    UNIQUE (article_id, email)
);

-- "My invitations": pending rows for the signed-in user's email.
CREATE INDEX IF NOT EXISTS idx_article_invitations_email_status ON article_invitations(email, status);
