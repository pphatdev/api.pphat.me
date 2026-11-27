-- `authors.profile` is the author's headline (admin form: "Front-End Developer").
-- Older rows stored the avatar image URL there (e.g. https://github.com/<user>.png),
-- which the blog used as the avatar. Move such URLs to author_details.avatar_url
-- (only where no avatar is set) and clear them from profile. Headline values are
-- untouched. Idempotent: re-running changes nothing.

-- 1. URL in profile, details row exists but has no avatar -> use the URL as avatar.
UPDATE author_details
SET avatar_url = (SELECT a.profile FROM authors a WHERE a.id = author_details.author_id),
    updated_at = datetime('now')
WHERE avatar_url = ''
  AND author_id IN (SELECT id FROM authors WHERE profile LIKE 'http://%' OR profile LIKE 'https://%');

-- 2. URL in profile, no details row yet -> create one with the URL as avatar.
INSERT INTO author_details (author_id, bio, avatar_url, social_links, status, created_at, updated_at)
SELECT a.id, '', a.profile, '[]', 1, datetime('now'), datetime('now')
FROM authors a
WHERE (a.profile LIKE 'http://%' OR a.profile LIKE 'https://%')
  AND NOT EXISTS (SELECT 1 FROM author_details d WHERE d.author_id = a.id);

-- 3. profile is a headline from now on: clear URL values.
UPDATE authors SET profile = '' WHERE profile LIKE 'http://%' OR profile LIKE 'https://%';
