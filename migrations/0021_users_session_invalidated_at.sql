-- Access-token revocation on logout (SECURITY_FIX_PLAN.md #12).
-- authGuard rejects any access JWT whose `iat` is earlier than this
-- timestamp, so a stolen access token becomes unusable the moment the
-- legitimate owner logs out — without needing a per-token denylist.
--
-- Nullable: a user who has never logged out has no invalidation floor.

ALTER TABLE users ADD COLUMN session_invalidated_at TEXT;
