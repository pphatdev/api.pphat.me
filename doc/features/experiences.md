# Experiences & Resume Timeline API

## Base Path
`/v1/api/experiences`

---

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/api/experiences` | **User / Admin** | List flat experiences (paginated, searchable, sorted) |
| `GET` | `/v1/api/experiences/:id` | **Public** | Get single experience entry by ID |
| `GET` | `/v1/api/experiences/timeline` | **Public** | Get resume timeline grouped by company with nested roles & skills |
| `POST` | `/v1/api/experiences` | **Admin** | Create new experience entry |
| `PATCH` | `/v1/api/experiences/:id` | **Admin** | Update experience entry |
| `DELETE` | `/v1/api/experiences/:id` | **Admin** | Delete experience entry |
| `PUT` | `/v1/api/experiences/:id/skills` | **Admin** | Replace all linked tech stack skills for an experience |
| `POST` | `/v1/api/experiences/:id/skills/:techStackId` | **Admin** | Attach a single tech stack skill to an experience |
| `DELETE` | `/v1/api/experiences/:id/skills/:techStackId` | **Admin** | Detach a single tech stack skill from an experience |

---

## Get Resume Timeline (Public)

### `GET /v1/api/experiences/timeline`

Returns active experiences (`status = 1`) grouped by company, with roles ordered current-first and tech-stack links mapped to skills. Designed specifically for CV and portfolio timeline visualizations.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | 1-based page number |
| `limit` | integer | `10` | Number of **companies** per page (max: 100) |

> **Note on Pagination**: The pagination unit is **company**, not individual experience rows. This guarantees that all roles held at a given company are returned together in the same response page without being split across page boundaries.

#### Response Format (`200 OK`)

```json
{
  "data": [
    {
      "company": "TechCorp Solutions",
      "url": "https://example.com",
      "logo": "https://example.com/logo.png",
      "roles": [
        {
          "title": "Senior Full-Stack Engineer",
          "period": {
            "from": "2023, Mar",
            "isCurrent": true,
            "to": "2026, Nov"
          },
          "skills": [
            {
              "name": "TypeScript",
              "icon": "devicon-typescript-plain",
              "url": "https://www.typescriptlang.org"
            },
            {
              "name": "Cloudflare Workers",
              "icon": "devicon-cloudflare-plain",
              "url": "https://workers.cloudflare.com"
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

#### Field Explanations

- `period.from`: Role start date formatted as `"YYYY, Mmm"` (e.g., `"2023, Mar"`).
- `period.to`: Role end date formatted as `"YYYY, Mmm"`. When `isCurrent` is `true`, this automatically reflects the current month and year so client applications can display a live date badge or timeline range.
- `period.isCurrent`: Boolean flag indicating whether the role is ongoing (`end_date IS NULL`).
- `skills`: Array of `{ name, icon, url }` populated from the `tech_stacks` table via the `experience_tech_stacks` junction table.

---

## Experience Management (Admin)

### Create Experience (`POST /v1/api/experiences`)

#### Request Body
```json
{
  "title": "Senior Software Engineer",
  "company": "TechCorp Solutions",
  "description": "Led backend architecture and edge services.",
  "start_date": "2023-03-01",
  "end_date": null,
  "location": "Phnom Penh, Cambodia (Remote)",
  "employment_type": "full-time",
  "company_url": "https://example.com",
  "logo_url": "https://example.com/logo.png",
  "cover": null,
  "status": 1
}
```

- **Required**: `title`, `company`, `start_date`
- **Optional**: `description`, `end_date` (`null` = current role), `location`, `employment_type` (`full-time`, `part-time`, `contract`, `internship`, `freelance`), `company_url`, `logo_url`, `cover`, `status` (`0` inactive, `1` active — default `1`)
- CamelCase aliases accepted (`startDate`, `endDate`, `employmentType`, `companyUrl`, `logoUrl`).
