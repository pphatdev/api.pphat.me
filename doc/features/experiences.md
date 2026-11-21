# Experiences API

## Base Path
`/v1/api/experiences`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/api/experiences` | List experiences (paginated, timeline-ordered) — **requires auth** |
| `GET` | `/v1/api/experiences/timeline` | **Get Resume Timeline (public)** — grouped by company |
| `GET` | `/v1/api/experiences/:id` | Get experience by ID (public) |
| `POST` | `/v1/api/experiences` | Create experience — **admin only** |
| `PUT` / `PATCH` | `/v1/api/experiences/:id` | Update experience — **admin only** |
| `DELETE` | `/v1/api/experiences/:id` | Delete experience — **admin only** |
| `PUT` | `/v1/api/experiences/:id/skills` | Replace all linked skills/tech stacks — **admin only** |
| `POST` | `/v1/api/experiences/:id/skills/:techStackId` | Attach single skill — **admin only** |
| `DELETE` | `/v1/api/experiences/:id/skills/:techStackId` | Detach single skill — **admin only** |

### Sortable columns
`id`, `title`, `company`, `start_date`, `end_date`, `status`, `created_at`, `updated_at`

### Search fields
`title`, `company`, `description`

---

## Get Resume Timeline (Public)

`GET /v1/api/experiences/timeline?page=1&limit=10`

Returns active experiences (`status = 1`) grouped by company in timeline order (current/ongoing roles bubble to the top).

### Query Parameters
- `page` (number, default: 1): Page number.
- `limit` (number, default: 10): Companies per page (max: 100).

### Response Schema

```json
{
  "data": [
    {
      "company": "TechCorp Solutions",
      "url": "https://example.com",
      "logo": "https://cdn-icons-png.flaticon.com/512/3061/3061341.png",
      "roles": [
        {
          "title": "Senior Full-Stack Engineer",
          "description": "Architected and built scalable edge microservices and developer platforms using Cloudflare Workers, Hono, and TypeScript.",
          "period": {
            "from": "2023, Mar",
            "isCurrent": true,
            "to": "2026, Nov"
          },
          "skills": [
            {
              "name": "Cloudflare Workers",
              "icon": "devicon-cloudflare-plain",
              "url": "https://workers.cloudflare.com"
            },
            {
              "name": "TypeScript",
              "icon": "devicon-typescript-plain",
              "url": "https://www.typescriptlang.org"
            }
          ]
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

> **Note**: Each role object inside `roles` contains:
> - `title` (string): Job title / role name.
> - `description` (string): Responsibilities and achievements for that role.
> - `period` (object): Formatted timeline range `{ from, isCurrent, to }`.
> - `skills` (array): Associated tech stacks `{ name, icon, url }`.

---

## Request Body (Create / Update Experience)

```json
{
  "title": "Senior Engineer",
  "company": "Acme Co",
  "description": "Built scalable cloud services.",
  "start_date": "2023-01-01",
  "end_date": null,
  "location": "Remote",
  "employment_type": "full-time",
  "company_url": "https://acme.com",
  "logo_url": "https://acme.com/logo.png",
  "cover": null,
  "status": 1
}
```

**Allowed `employment_type` values:** `full-time`, `part-time`, `contract`, `internship`, `freelance`
