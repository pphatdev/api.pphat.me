# FAQs API

## Base Path
`/v1/api/faqs`

## Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/v1/api/faqs` | List FAQs (paginated, searchable) | **Bearer token required** (admin sees all; user sees active) |
| `GET` | `/v1/api/faqs/public` | Public list of active (`status = 1`) FAQs | None (Public) |
| `GET` | `/v1/api/faqs/:idOrSlug` | Get FAQ by numeric ID or string slug | None (Public; inactive FAQs require admin) |
| `POST` | `/v1/api/faqs` | Create FAQ | **Admin only** |
| `PUT` / `PATCH` | `/v1/api/faqs/:id` | Update FAQ (by ID or slug) | **Admin only** |
| `DELETE` | `/v1/api/faqs/:id` | Delete FAQ (by ID or slug) | **Admin only** (returns 204) |

---

## Article Content Support in Answers

The FAQ entity treats its `answer` as full-fledged **article content**:
- **Rich Markdown Formatting**: Headings (`#`, `##`), bullet lists, code blocks with syntax highlighting, and links.
- **Content Alias**: Both `answer` and `content` are accepted on write and returned on read.
- **Reading Time & Word Count**: Every FAQ response automatically calculates `readingMins` and `wordCount` based on the answer body.
- **Article Linking**: Optional `article_id` links the FAQ to an article in the catalog. If `answer` is omitted on create, it automatically inherits its body from the referenced article.

---

## List FAQs

`GET /v1/api/faqs?page=1&limit=10&search=security&category=Security&status=1&sort=sort_order&order=asc`

### Query Parameters
- `page` (number, default: 1): Page number.
- `limit` (number, default: 10): Items per page (`-1` to fetch all items).
- `search` (string, optional): Matches against `question`, `answer`, or `category`.
- `category` (string, optional): Filter by category name (e.g. `General`, `Technical`).
- `status` (string, optional): Filter by `0` (inactive), `1` (active), or `all` (admin only).
- `sort` (string, default: `sort_order`): Sort column (`id`, `question`, `slug`, `category`, `sort_order`, `status`, `created_at`, `updated_at`).
- `order` (`asc` | `desc`, default: `asc`).

---

## Create FAQ

`POST /v1/api/faqs`

**Headers:**
```http
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "question": "What tech stack powers api.pphat.me?",
  "answer": "# Technology Stack Overview\n\napi.pphat.me is engineered for extreme edge performance.\n\n### Core Architecture\n- **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com)\n- **Framework**: [Hono.js](https://hono.dev)\n- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1)",
  "category": "Technical",
  "sort_order": 1,
  "status": 1,
  "article_id": "c1000000-0000-4000-8000-000000000001"
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "question": "What tech stack powers api.pphat.me?",
  "slug": "what-tech-stack-powers-api-pphat-me",
  "answer": "# Technology Stack Overview\n\napi.pphat.me is engineered for extreme edge performance.\n\n### Core Architecture\n- **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com)\n- **Framework**: [Hono.js](https://hono.dev)\n- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1)",
  "content": "# Technology Stack Overview\n\napi.pphat.me is engineered for extreme edge performance.\n\n### Core Architecture\n- **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com)\n- **Framework**: [Hono.js](https://hono.dev)\n- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1)",
  "category": "Technical",
  "sortOrder": 1,
  "status": 1,
  "articleId": "c1000000-0000-4000-8000-000000000001",
  "article": {
    "id": "c1000000-0000-4000-8000-000000000001",
    "title": "Building a Serverless API with Cloudflare Workers and Hono",
    "slug": "building-serverless-api-cloudflare-workers-hono",
    "description": "Deep dive into designing ultra-low latency REST APIs at the edge."
  },
  "readingMins": 1,
  "wordCount": 24,
  "createdAt": "2026-11-21T14:35:00.000Z",
  "updatedAt": "2026-11-21T14:35:00.000Z"
}
```
