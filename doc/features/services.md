# Services API

## Base Path
`/v1/api/services` (alias: `/v1/api/service`)

## Overview
The Services API powers the portfolio's "Feature / What I can do for you" offerings showcase. It provides:
1. **Section Header Configuration**: Manage the top badge (e.g. `'Feature'`), headline (`'What I can do for you'`), and introductory narrative.
2. **Service Cards (Offerings)**: Manage individual service offerings (e.g., `'Web Development'`, `'Web Hosting'`, `'UI/UX Design'`), including icons, bullet feature points, links, sort order sequence, and publishing status.
3. **Overview Endpoint**: Returns both the active section header and active services list in a single fast query for front-end hero/services sections.

---

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/v1/api/services/overview` *(alias: `/service/overview`)* | None (Public) | Returns section header + list of active services |
| `GET` | `/v1/api/services/public` *(alias: `/service/public`)* | None (Public) | Returns active (`status = 1`) services list |
| `GET` | `/v1/api/services/section` *(alias: `/service/section`)* | None (Public) | Get active section header configuration |
| `PUT` / `PATCH` | `/v1/api/services/section` *(alias: `/service/section`)* | **Admin only** | Update section header (badge, title, description) |
| `GET` | `/v1/api/services` *(alias: `/service`)* | Optional | List services (public sees active; admin sees all) |
| `GET` | `/v1/api/services/order-sequence` | **Bearer auth** | Get service items in sequence order |
| `PUT` / `PATCH` | `/v1/api/services/order-sequence` | **Admin only** | Update service order sequence (reordering) |
| `GET` | `/v1/api/services/:id` *(alias: `/service/:id`)* | Optional | Get service by numeric ID |
| `POST` | `/v1/api/services` *(alias: `/service`)* | **Admin only** | Create a new service card (`201 Created`) |
| `PUT` / `PATCH` | `/v1/api/services/:id` *(alias: `/service/:id`)* | **Admin only** | Update service (`200 OK`) |
| `DELETE` | `/v1/api/services/:id` *(alias: `/service/:id`)* | **Admin only** | Delete service (`204 No Content`) |

---

## Data Models

### 1. Service Section Header (`service_sections`)
| Field | Type | Description |
|---|---|---|
| `id` | `INTEGER` | Primary key |
| `badge` | `TEXT` | Section pill/badge (default: `'Feature'`, alias: `label`) |
| `title` | `TEXT` | Main headline (default: `'What I can do for you'`) |
| `description` | `TEXT` | Section introduction / narrative |
| `status` | `INTEGER` | `1` = active, `0` = inactive |

### 2. Service Item (`services`)
| Field | Type | Required (Create) | Default | Description |
|---|---|---|---|---|
| `id` | `INTEGER` | Auto | Auto | Primary key autoincrement |
| `title` | `TEXT` | **Yes** | - | Service title (e.g. `"Web Development"`) |
| `description` | `TEXT` | **Yes** | - | Card description (aliases: `content`, `summary`) |
| `icon` | `TEXT` | No | `''` | Icon identifier or URL (e.g., `"terminal"`, `"cloud"`, alias: `iconName`) |
| `category` | `TEXT` | No | `'General'` | Category grouping (e.g., `"Development"`, `"Infrastructure"`) |
| `features` | `TEXT` (JSON) | No | `'[]'` | JSON array of feature highlights |
| `link_url` | `TEXT` | No | `''` | Optional link destination (aliases: `linkUrl`, `url`) |
| `sort_order` | `INTEGER` | No | `0` | Order sequence rank (aliases: `sortOrder`, `position`, `sequence`) |
| `status` | `INTEGER` | No | `1` | `1` = active, `0` = inactive (aliases: `isActive`, `is_active`) |
| `created_at` | `TEXT` | Auto | ISO string | Creation timestamp |
| `updated_at` | `TEXT` | Auto | ISO string | Last update timestamp |

---

## Example Responses

### 1. Section & Services Overview (`GET /v1/api/services/overview`)
```json
{
  "section": {
    "id": 1,
    "badge": "Feature",
    "title": "What I can do for you",
    "description": "I can help you build your next project from scratch. I have experience in web development, design, and cloud hosting. I can help you with everything from the initial design to the final deployment.",
    "status": 1,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "services": [
    {
      "id": 1,
      "title": "Web Development",
      "description": "Built with the latest and greatest technologies.",
      "content": "Built with the latest and greatest technologies.",
      "icon": "terminal",
      "iconName": "terminal",
      "category": "Development",
      "features": ["Full-Stack Web Apps", "High Performance APIs", "Edge Computing"],
      "linkUrl": "",
      "sortOrder": 1,
      "status": 1,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    },
    {
      "id": 2,
      "title": "Web Hosting",
      "description": "Hosted on the cloud with 99.9% uptime.",
      "content": "Hosted on the cloud with 99.9% uptime.",
      "icon": "cloud",
      "iconName": "cloud",
      "category": "Infrastructure",
      "features": ["Cloudflare Edge Workers", "D1 SQLite Database", "SSL & DDoS Protection"],
      "linkUrl": "",
      "sortOrder": 2,
      "status": 1,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "total": 2
}
```
