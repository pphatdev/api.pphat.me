# Projects API

## Base Path
`/v1/api/projects`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/api/projects` | List projects (paginated) |
| `GET` | `/v1/api/projects/:slug` | Get project by slug (includes `details` if set) |
| `POST` | `/v1/api/projects` | Create project |
| `PATCH` | `/v1/api/projects/:slug` | Update project |
| `DELETE` | `/v1/api/projects/:slug` | Delete project |

### Sortable columns
`id`, `title`, `slug`, `description`, `published`, `created_at`, `updated_at`

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
