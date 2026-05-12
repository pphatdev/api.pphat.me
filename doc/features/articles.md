# Articles API

## Base Path
`/v1/api/articles`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/api/articles` | List articles (paginated) |
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
  "author_ids": [1],
  "tag_ids": []
}
```

> `tag_ids` is optional. If provided, all IDs must exist in the `tags` table — otherwise a `422` error is returned.

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
