# Projects API

## Base Path
`/v1/api/projects`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/api/projects` | List projects (paginated) — **requires auth** (Bearer JWT or SSO API key) |
| `GET` | `/v1/api/projects/order-sequence` | Get project order sequence list — **requires auth** |
| `PUT` | `/v1/api/projects/order-sequence` | Update project order sequence — **requires admin** |
| `PATCH` | `/v1/api/projects/order-sequence` | Update project order sequence — **requires admin** |
| `GET` | `/v1/api/projects/:slug` | Get project by slug (includes `details` if set) |
| `POST` | `/v1/api/projects` | Create project |
| `PATCH` | `/v1/api/projects/:slug` | Update project |
| `DELETE` | `/v1/api/projects/:slug` | Delete project |

### Sortable columns
`id`, `title`, `slug`, `description`, `published`, `position`, `sequence`, `created_at`, `updated_at`

### Default Order
When `sort` is omitted, projects sort by `position ASC, created_at DESC`.

### Project Order Sequence Endpoints & Aliases
- `GET /v1/api/projects/order-sequence` (alias: `GET /v1/api/projects/sequence`)
- `PUT /v1/api/projects/order-sequence` (aliases: `/v1/api/projects/sequence`, `/v1/api/projects/reorder`)
- `PATCH /v1/api/projects/order-sequence` (aliases: `/v1/api/projects/sequence`, `/v1/api/projects/reorder`)

**Reorder Request Body Formats:**
1. UUID list:
```json
{
  "ids": ["00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000003"]
}
```
or
```json
{
  "sequence": ["00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000003"]
}
```
or bare array `["00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000003"]`.

2. Explicit sequence assignments:
```json
{
  "sequence": [
    { "id": "00000000-0000-4000-8000-000000000002", "sequence": 0 },
    { "id": "00000000-0000-4000-8000-000000000003", "sequence": 1 }
  ]
}
```

### Search fields
`title`, `slug`, `description`

## Request Body (Create / Update)

```json
{
  "title": "My Project",
  "slug": "my-project",
  "description": "A short description.",
  "thumbnail": "https://example.com/thumbnail.png",
  "published": false,
  "tag_ids": [1],
  "contributor_ids": [1],
  "languages": ["TypeScript", "SQL"]
}
```

> `tags` in the response are full objects `{ id, tag, description }` from the `tags` table.
> `contributor_ids` references existing author IDs.

---

## Project Details

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/api/projects/:slug/details` | Get project details |
| `POST` | `/v1/api/projects/:slug/details` | Create project details |
| `PATCH` | `/v1/api/projects/:slug/details` | Update project details (partial) |
| `DELETE` | `/v1/api/projects/:slug/details` | Delete project details |

**Create / Update body:**

```json
{
  "content": "Full project description in markdown.",
  "demoUrl": "https://demo.example.com",
  "repoUrl": "https://github.com/example/project",
  "techStack": ["TypeScript", "Cloudflare Workers", "D1"],
  "status": "in-progress"
}
```

**Allowed status values:** `in-progress`, `completed`, `archived`

> `POST` and `PATCH` both upsert — creating the record if it does not exist yet.
