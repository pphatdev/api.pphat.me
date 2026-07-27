# Articles API

## Base Path
`/v1/api/articles`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/api/articles` | List articles (paginated) — **requires auth** (Bearer JWT or SSO API key) |
| `GET` | `/v1/api/articles/:slug` | Get article by slug (includes `stats` and `reactions`) |
| `POST` | `/v1/api/articles` | Create article |
| `PATCH` | `/v1/api/articles/:slug` | Update article |
| `DELETE` | `/v1/api/articles/:slug` | Delete article |

### Sortable columns
`id`, `title`, `slug`, `description`, `published`, `created_at`, `updated_at`

### Search fields
`title`, `slug`, `description`

## Request Body (Create / Update)

```json
{
  "title": "My Article",
  "slug": "my-article",
  "description": "A short description.",
  "thumbnail": "https://example.com/thumbnail.png",
  "content": "Full article content.",
  "file_path": "",
  "published": false,
  "isPublic": false,
  "publishAt": "2026-08-15 09:00",
  "author_ids": [1],
  "tag_ids": []
}
```

> `tag_ids` is optional. If provided, all IDs must exist in the `tags` table — otherwise a `422` error is returned.

### Publish scheduling (Asia/Phnom_Penh)

- `isPublic` (boolean) — direct control of the public-list visibility. Defaults to `false`.
- `publishAt` (string, optional) — when the article should become public. Two accepted formats, both interpreted in **Asia/Phnom_Penh (+07:00, no DST)**:
  - Bare local: `YYYY-MM-DD HH:mm` or `YYYY-MM-DDTHH:mm:ss` (no offset)
  - Full ISO with any offset: `2026-08-15T02:00:00Z`, `2026-08-15T09:00:00+07:00`

Persisted internally as UTC ISO. On the way out, `publishAt` is always formatted with the `+07:00` offset.

**Auto-promote flow**
1. `POST /v1/api/articles` with `published: true` + `publishAt` in the future → article is stored with `is_public = 0` and stays out of the public list.
2. A Cloudflare Cron Trigger (`*/5 * * * *`, see `wrangler.jsonc → triggers.crons`) invokes `scheduled()` in `apps/app.ts`, which calls `ArticleRepository.promoteScheduled()`. Any row where `published = 1 AND is_public = 0 AND publish_at <= now()` flips to `is_public = 1`.
3. A `publishAt` in the past on create is auto-promoted immediately (no wait for cron).

**Filtering**
- Public list endpoint (`GET /v1/api/articles`) requires `authGuard` (unchanged) and additionally filters `is_public = 1 AND published = 1`.
- Direct-by-slug/id reads (`GET /v1/api/articles/:slug`) bypass the `is_public` filter so owners and admins can preview scheduled content.

---

## Article Stats

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/api/articles/:slug/stats` | Get stats (views, reading_mins) |
| `POST` | `/v1/api/articles/:slug/stats/view` | Increment view counter |

> Stats are auto-initialized when an article is created. `reading_mins` is recalculated whenever `content` is updated (~200 words/min).

---

## Article Reactions

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/api/articles/:slug/reactions` | List all reactions |
| `POST` | `/v1/api/articles/:slug/reactions` | Add / increment a reaction |
| `DELETE` | `/v1/api/articles/:slug/reactions/:type` | Decrement a reaction (deletes when count reaches 0) |

**Allowed reaction types:** `like`, `heart`, `fire`, `clap`, `wow`

**Add Reaction body:**

```json
{ "type": "like" }
```

---

## Article Comments

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/api/articles/:slug/comments` | List comments (paginated) |
| `POST` | `/v1/api/articles/:slug/comments` | Create comment |
| `PATCH` | `/v1/api/articles/:slug/comments/:id` | Update comment |
| `DELETE` | `/v1/api/articles/:slug/comments/:id` | Delete comment |

**Create body:**

```json
{
  "authorName": "John Doe",
  "content": "Great article!"
}
```

**Update body:**

```json
{ "content": "Updated comment text." }
```
