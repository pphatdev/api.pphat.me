# api-pphat-me

> Version 0.3.0

A RESTful API built with **Cloudflare Workers** and **D1 (SQLite)** for managing articles, authors, and tags.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| Language | TypeScript |
| Testing | Vitest + `@cloudflare/vitest-pool-workers` |
| Tooling | Wrangler v4 |

---

## Project Structure

```
src/
├── index.ts                        # Worker entry point
├── apps/
│   └── modules/                    # Modules Feature
├── routes/                         # Route matchers
└── shared/
    ├── helpers/                    # json(), response helpers
    └── interfaces/                 # Shared types (PaginationParams, PaginatedResult, …)
migrations/                         # D1 SQL migrations
doc/collections/                    # Postman collection
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Cloudflare account with D1 enabled

### Install

```bash
npm install
```

### Local Development

```bash
npm run dev
# or
npx wrangler dev
```

The API will be available at `http://localhost:8787`.

### Run Tests

```bash
npm test
```

### Generate TypeScript Types (after changing bindings)

```bash
npm run cf-typegen
# or
npx wrangler types
```

### Deploy

```bash
npm run deploy
# or
npx wrangler deploy
```

---

## Database Migrations

Apply migrations to your D1 database:

```bash
# Local (dev)
npx wrangler d1 migrations apply api-pphat-me-db --local

# Remote (production)
npx wrangler d1 migrations apply api-pphat-me-db --remote
```

---

## API Reference

Base URL: `http://localhost:8787` (local) / your deployed worker URL (production)

All list endpoints support the following query parameters:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | `1` | Page number |
| `limit` | number | `10` | Items per page (max 100) |
| `search` | string | — | Keyword search |
| `sort` | string | varies | Column to sort by |
| `order` | `asc` \| `desc` | varies | Sort direction |

---

### Articles — `/v1/api/articles`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/api/articles` | List articles (paginated) |
| `GET` | `/v1/api/articles/:slug` | Get article by slug |
| `POST` | `/v1/api/articles` | Create article |
| `PATCH` | `/v1/api/articles/:slug` | Update article |
| `DELETE` | `/v1/api/articles/:slug` | Delete article |

**Sortable columns:** `id`, `title`, `slug`, `description`, `published`, `created_at`, `updated_at`  
**Search fields:** `title`, `slug`, `description`

**Create / Update body:**

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

### Authors — `/v1/api/authors`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/api/authors` | List authors (paginated) |
| `GET` | `/v1/api/authors/:id` | Get author by ID |
| `POST` | `/v1/api/authors` | Create author |
| `PATCH` | `/v1/api/authors/:id` | Update author |
| `DELETE` | `/v1/api/authors/:id` | Delete author |

**Sortable columns:** `id`, `name`, `profile`, `url`  
**Search fields:** `name`

**Create / Update body:**

```json
{
  "name": "PPhat Dev",
  "profile": "Front-End Developer",
  "url": "https://pphat.me",
  "bio": "A passionate writer and developer.",
  "avatar_url": "https://example.com/avatar.png",
  "social_links": ["https://pphat.me"],
  "status": 1
}
```

---

### Tags — `/v1/api/tags`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/api/tags` | List tags (paginated) |
| `GET` | `/v1/api/tags/:id` | Get tag by ID |
| `POST` | `/v1/api/tags` | Create tag |
| `PATCH` | `/v1/api/tags/:id` | Update tag |
| `DELETE` | `/v1/api/tags/:id` | Delete tag |

**Sortable columns:** `id`, `tag`, `description`  
**Search fields:** `tag`, `description`

**Create / Update body:**

```json
{
  "tag": "javascript",
  "description": "Articles about JavaScript."
}
```

---

## Postman Collection

Import the collection from [`doc/collections/api-pphat-me.postman_collection.json`](doc/collections/api-pphat-me.postman_collection.json).

Set the `baseUrl` variable to your local or production URL.

---

## Error Responses

| Status | Description |
|--------|-------------|
| `400` | Bad request / invalid ID |
| `404` | Resource not found |
| `405` | Method not allowed |
| `409` | Slug already exists (articles) |
| `422` | Validation error (missing required fields / invalid tag IDs) |
