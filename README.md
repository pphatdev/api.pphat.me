# API.PPHAT.ME

> Version 0.14.0

A RESTful API built with **Cloudflare Workers** and **D1 (SQLite)** for managing articles, projects, authors, and tags.

---

## 🛡️ Security

We take security seriously. Please refer to our [Security Policy](SECURITY.md) for information on reporting vulnerabilities.

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) to get started.

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
| `0013_create_contact_messages.sql` | `contact_messages` table |
| `0015_dashboard_stats.sql` | `visitor_logs` table for traffic tracking |
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
| `contact` | 5 requests / 3600s (1h) |

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

### API Modules

For detailed documentation on specific API modules, please refer to the following guides:

- [Articles & Engagement](doc/features/articles.md)
- [Projects & Details](doc/features/projects.md)
- [Authors & Profiles](doc/features/authors.md)
- [Tags & Taxonomy](doc/features/tags.md)
- [AI Content Generator](doc/features/ai.md)
- [Portfolio Chatbot](doc/features/chatbot.md)
- [Contact Management](doc/features/contact.md)
- [Dashboard & Traffic](doc/features/dashboard.md)

---

## 🧪 Testing

The project uses **Vitest** for integration testing. Tests run against a local D1 instance.

```bash
# Run all tests
npm test

# Run contact tests specifically
npm test test/features/contact.spec.ts
```

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
| `contactId` | `...` | Contact Message UUID |

---

## Error Responses

| Status | Description |
|--------|-------------|
| `400` | Bad request / invalid body |
| `404` | Resource not found |
| `405` | Method not allowed |
| `409` | Slug already exists |
| `422` | Validation error (missing required fields / invalid tag IDs) |

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

© 2026 [PPhat](https://pphat.me). All rights reserved.
