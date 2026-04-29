# API.PPHAT.ME

> Version 0.10.2

A RESTful API built with **Cloudflare Workers** and **D1 (SQLite)** for managing articles, projects, authors, and tags.

---

## 🛡️ Security

We take security seriously. Please refer to our [Security Policy](SECURITY.md) for information on reporting vulnerabilities.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Cloudflare Workers |
| Router | Hono v4 |
| Database | Cloudflare D1 (SQLite) |
| Language | TypeScript |
| Testing | Vitest + `@cloudflare/vitest-pool-workers` |
| AI | Cloudflare Workers AI |
| Tooling | Wrangler v4 |

---

## Project Structure

```
apps/
├── app.ts                           # Worker entry point (Hono app)
├── middlewares/
│   ├── auth.middleware.ts           # JWT auth guard (requireAuth + authGuard)
│   └── rate-limit.middleware.ts     # Per-API-type rate limiting
├── modules/
│   ├── articles/                    # Article CRUD
│   ├── article-stats/               # View counter & reading time
│   ├── article-reactions/           # Emoji reactions per article
│   ├── article-comments/            # Comments per article
│   ├── projects/                    # Project CRUD
│   ├── project-details/             # Extended project details
│   ├── authors/                     # Author management
│   ├── tags/                        # Tag management
│   ├── auth/                        # Authentication (email-based)
│   └── chat/                        # Portfolio Chatbot API
└── shared/                          # Utility helpers and common interfaces
migrations/                          # D1 SQL migrations
doc/collections/                     # Postman collection
test/                                # Vitest integration tests
```

---

## CI/CD Workflow

This project uses **GitHub Actions** for continuous integration. Every push and pull request to `master` triggers:

- **Multi-Node Testing**: Parallel tests on Node.js 20, 22, and 24.
- **Type Generation**: Automated Wrangler type generation to ensure binding consistency.
- **Job Summaries**: Detailed test status reports directly in the GitHub Actions run overview.

---

## Getting Started

### Prerequisites

- Node.js 20+
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

### Generate TypeScript Types
If you change your `wrangler.jsonc` bindings, you should regenerate the TypeScript types:
```bash
npm run cf-typegen
```

### Run Tests
```bash
npm test
```

### Deploy

```bash
npx wrangler deploy
```

### Deployment Secrets

After deployment, you **must** set the following secrets in Cloudflare for the production API to function correctly:

```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put SMTP_PASS
```

---

## Environment Variables & Secrets

The API requires several environment variables for full functionality. Configure these in `wrangler.jsonc` or as secrets.

| Name | Type | Description |
|------|------|-------------|
| `APP_URL` | Var | The canonical base URL of the API |
| `JWT_SECRET` | Secret | Secret key for JWT signing |
| `GITHUB_CLIENT_ID` | Var | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | Secret | GitHub OAuth App Client Secret |
| `SMTP_HOST` | Var | SMTP server hostname |
| `SMTP_PORT` | Var | SMTP server port |
| `SMTP_USER` | Var | SMTP username / sender email |
| `SMTP_PASS` | Secret | SMTP password |

---

## Database Migrations

```bash
# Local (dev)
npx wrangler d1 migrations apply api --local

# Remote (production)
npx wrangler d1 migrations apply api --remote
```

| File | Description |
|------|-------------|
| `0001_create_articles.sql` | `articles` table |
| `0002_create_authors.sql` | `authors`, `author_details`, `article_authors` |
| `0004_create_article_stats.sql` | `article_stats` (views, reading_mins) |
| `0005_create_article_reactions.sql` | `article_reactions` |
| `0006_create_article_comments.sql` | `article_comments` |
| `0007_create_projects.sql` | `projects`, `project_tags` |
| `0008_create_project_details.sql` | `project_details` |
| `0009_create_project_contributors.sql` | `project_contributors` |
| `0010_create_users.sql` | `users` table |
| `0011_email_auth.sql` | Email authentication setup |
| `0012_create_chat_history.sql` | `chat_history` table |
| `9999_create_tags.sql` | `tags`, `article_tags` |

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

### API Type Rate Limits

Requests are rate-limited by API type in a 60-second window. Limits are tracked per client IP.

| API Type | Rule |
|---------|------|
| `auth` | 20 requests / 60s |
| `read` | 300 requests / 60s |
| `write` | 60 requests / 60s |
| `engagement` | 120 requests / 60s |

Classification summary:

- `auth`: paths under `/v1/api/auth/*`
- `read`: `GET`/`HEAD` requests (except auth)
- `engagement`: non-GET reactions/comments/stats-view endpoints
- `write`: all other non-GET API requests

When a limit is exceeded, the API returns `429 Too Many Requests` and includes:

- `Retry-After`
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

---

### Articles — `/v1/api/articles`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/api/articles` | List articles (paginated) |
| `GET` | `/v1/api/articles/:slug` | Get article by slug (includes `stats` and `reactions`) |
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

### Article Stats — `/v1/api/articles/:slug/stats`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/api/articles/:slug/stats` | Get stats (views, reading_mins) |
| `POST` | `/v1/api/articles/:slug/stats/view` | Increment view counter |

> Stats are auto-initialized when an article is created. `reading_mins` is recalculated whenever `content` is updated (~200 words/min).

---

### Article Reactions — `/v1/api/articles/:slug/reactions`

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

### Article Comments — `/v1/api/articles/:slug/comments`

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

---

### Projects — `/v1/api/projects`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/api/projects` | List projects (paginated) |
| `GET` | `/v1/api/projects/:slug` | Get project by slug (includes `details` if set) |
| `POST` | `/v1/api/projects` | Create project |
| `PATCH` | `/v1/api/projects/:slug` | Update project |
| `DELETE` | `/v1/api/projects/:slug` | Delete project |

**Sortable columns:** `id`, `title`, `slug`, `description`, `published`, `created_at`, `updated_at`
**Search fields:** `title`, `slug`, `description`

**Create / Update body:**

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

### Project Details — `/v1/api/projects/:slug/details`

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

### AI Content Generator — `/v1/api/ai/generate`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/api/ai/generate` | Generate structured description/content using Cloudflare Workers AI with JSON schema validation |

> Requires authentication (`Authorization: Bearer <token>`).

**Body:**

```json
{
  "title": "Building a Cloudflare Worker API",
  "context": "API for blog and project management.",
  "tone": "professional and friendly",
  "language": "English",
  "mode": "both",
  "model": "@cf/meta/llama-3.1-8b-instruct"
}
```

**Mode values:** `description`, `content`, `both`

> **Note:** The AI now uses optimized prompt engineering and `response_format: json_schema` for highly reliable structured output. Mode-specific token limits are applied (400 for description, 1200 for content, 1800 for both).

---

### Portfolio Chatbot — `/v1/api/chat`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/api/chat` | Chat with the AI about the portfolio |
| `GET` | `/v1/api/chat/history` | Get chat history (Requires authentication) |

**Chat Body:**

```json
{
  "message": "What is Sophat's tech stack?"
}
```

> The chatbot uses Cloudflare Workers AI and is pre-seeded with knowledge about the project architecture, skills, and contact information.

---

## Postman Collection

Import the collection from [`doc/collections/api-pphat-me.postman_collection.json`](doc/collections/api-pphat-me.postman_collection.json).

Set the `baseUrl` variable to your local or production URL.

**Collection variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `baseUrl` | `http://localhost:8787` | API base URL |
| `slug` | `my-article-slug` | Article slug |
| `projectSlug` | `my-project` | Project slug |
| `authorId` | `1` | Author ID |
| `tagId` | `1` | Tag ID |
| `commentId` | `1` | Comment ID |

---

## Error Responses

| Status | Description |
|--------|-------------|
| `400` | Bad request / invalid body |
| `404` | Resource not found |
| `405` | Method not allowed |
| `409` | Slug already exists |
| `422` | Validation error (missing required fields / invalid tag IDs) |
