# About Me API

## Base Path
`/v1/api/about-me` (alias: `/v1/api/about`)

## Overview
The About Me module powers the hero and profile introduction section of the portfolio. It provides dynamic control over the headline badge, title, biographical narrative, call-to-action button, multi-image collage, profile metadata (name, nickname, role, location), and publishing status.

---

## Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/v1/api/about-me/active` | Get active profile for public presentation | None (Public) |
| `GET` | `/v1/api/about/active` | Alias for active profile | None (Public) |
| `GET` | `/v1/api/about-me` | List profiles (paginated, searchable) | Optional (public sees active; admin sees all) |
| `GET` | `/v1/api/about` | Alias for listing profiles | Optional |
| `GET` | `/v1/api/about-me/:id` | Get profile by numeric ID | Optional (public sees active; admin sees inactive) |
| `GET` | `/v1/api/about/:id` | Alias for profile by ID | Optional |
| `POST` | `/v1/api/about-me` | Create a profile | **Admin only** (201 Created) |
| `POST` | `/v1/api/about` | Alias for creating profile | **Admin only** (201 Created) |
| `PUT` / `PATCH` | `/v1/api/about-me/:id` | Update profile | **Admin only** (200 OK) |
| `PUT` / `PATCH` | `/v1/api/about/:id` | Alias for updating profile | **Admin only** (200 OK) |
| `DELETE` | `/v1/api/about-me/:id` | Delete profile | **Admin only** (204 No Content) |
| `DELETE` | `/v1/api/about/:id` | Alias for deleting profile | **Admin only** (204 No Content) |

---

## Data Model

| Field | Type | Required (Create) | Default | Description |
|---|---|---|---|---|
| `id` | `INTEGER` | Auto | Auto | Primary key autoincrement |
| `badge` | `TEXT` | No | `'About me!'` | Small pill/badge label above the title (alias: `label`) |
| `title` | `TEXT` | **Yes** | - | Main hero headline (e.g., `"Who the hell am I ?"`) |
| `description` | `TEXT` | **Yes** | - | Biographical text narrative (aliases: `content`, `bio`, `about`) |
| `button_text` | `TEXT` | No | `'Gallery'` | CTA button label (aliases: `buttonText`, `actionText`) |
| `button_url` | `TEXT` | No | `''` | CTA button link destination (aliases: `buttonUrl`, `actionUrl`) |
| `images` | `TEXT` (JSON) | No | `'[]'` | Array of image URLs for photo collage |
| `name` | `TEXT` | No | `''` | Full legal or display name (e.g., `"Leat Sophat"`) |
| `nickname` | `TEXT` | No | `''` | Handle or online nickname (e.g., `"PPhat"`) |
| `role` | `TEXT` | No | `''` | Professional title (e.g., `"Senior Front-end Developer"`) |
| `location` | `TEXT` | No | `''` | Geographic base (e.g., `"Phnom Penh, Cambodia"`) |
| `sort_order` | `INTEGER` | No | `0` | Order sequence (aliases: `sortOrder`, `position`, `sequence`) |
| `status` | `INTEGER` | No | `1` | `0` (inactive) or `1` (active) |
| `created_at` | `TEXT` | Auto | ISO string | Timestamp of record creation |
| `updated_at` | `TEXT` | Auto | ISO string | Timestamp of last modification |

---

## Field Aliases & Developer Ergonomics

The API automatically accepts both snake_case and camelCase parameters on write operations, as well as common intuitive aliases:
- `buttonText` / `actionText` -> `button_text`
- `buttonUrl` / `actionUrl` -> `button_url`
- `sortOrder` / `position` / `sequence` -> `sort_order`
- `label` -> `badge`
- `bio` / `content` / `about` -> `description`

Response payloads include both canonical fields and convenient mirrors (`content`, `bio`, `buttonText`, `buttonUrl`, `sortOrder`, `createdAt`, `updatedAt`).

---

## Example Requests & Responses

### 1. Get Active Profile
`GET /v1/api/about-me/active`

**Response (`200 OK`):**
```json
{
  "id": 1,
  "badge": "About me!",
  "title": "Who the hell am I ?",
  "description": "My name is Leat Sophat, my relegien name is LEAT Sophat, and I'm known online as PPhat. I'm a Senior Front-end Developer at TURBOTECH CO., LTD, and as a Freelance UI/UX Designer. I'm from Phnom Penh, Cambodia.\nI started my career as a Front-end Developer in 2021, and I have a passion for creating beautiful and functional user interfaces. I love to learn new technologies and improve my skills every day. I am also a big fan of open-source projects and I enjoy contributing to the community. I believe that sharing knowledge is the key to success in this field.",
  "content": "My name is Leat Sophat, my relegien name is LEAT Sophat, and I'm known online as PPhat. I'm a Senior Front-end Developer at TURBOTECH CO., LTD, and as a Freelance UI/UX Designer. I'm from Phnom Penh, Cambodia.\nI started my career as a Front-end Developer in 2021, and I have a passion for creating beautiful and functional user interfaces. I love to learn new technologies and improve my skills every day. I am also a big fan of open-source projects and I enjoy contributing to the community. I believe that sharing knowledge is the key to success in this field.",
  "bio": "My name is Leat Sophat, my relegien name is LEAT Sophat, and I'm known online as PPhat. I'm a Senior Front-end Developer at TURBOTECH CO., LTD, and as a Freelance UI/UX Designer. I'm from Phnom Penh, Cambodia.\nI started my career as a Front-end Developer in 2021, and I have a passion for creating beautiful and functional user interfaces. I love to learn new technologies and improve my skills every day. I am also a big fan of open-source projects and I enjoy contributing to the community. I believe that sharing knowledge is the key to success in this field.",
  "buttonText": "Gallery",
  "button_text": "Gallery",
  "buttonUrl": "https://pphat.me/gallery",
  "button_url": "https://pphat.me/gallery",
  "images": [
    "https://example.com/about-1.jpg",
    "https://example.com/about-2.jpg",
    "https://example.com/about-3.jpg"
  ],
  "name": "Leat Sophat",
  "nickname": "PPhat",
  "role": "Senior Front-end Developer",
  "location": "Phnom Penh, Cambodia",
  "sortOrder": 0,
  "sort_order": 0,
  "status": 1,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "created_at": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z",
  "updated_at": "2026-01-01T00:00:00.000Z"
}
```

### 2. Create Profile
`POST /v1/api/about-me`
Headers: `Authorization: Bearer <admin-token>`, `Content-Type: application/json`

**Request Body:**
```json
{
  "badge": "About me!",
  "title": "Who the hell am I ?",
  "bio": "Senior Front-end Developer & Freelance UI/UX Designer...",
  "buttonText": "Gallery",
  "buttonUrl": "https://pphat.me/gallery",
  "images": [
    "https://example.com/pic1.jpg",
    "https://example.com/pic2.jpg"
  ],
  "name": "Leat Sophat",
  "nickname": "PPhat",
  "role": "Senior Front-end Developer",
  "location": "Phnom Penh, Cambodia",
  "sortOrder": 0,
  "status": 1
}
```

**Response (`201 Created`):** Returns the created entity.
