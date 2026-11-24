# Gallery API

## Base Path
`/v1/api/gallery` (alias: `/v1/api/galleries`)

## Overview
The Gallery API powers the curated public photography, setup showcases, design portfolios, and visual album displays on both `pphat.me` and `admin.pphat.me`. It allows visitors to view public photos filtered by category, and provides administrators with full CRUD capabilities, bulk imports, toggle switches for public/featured visibility, and drag-and-drop order sequence reordering.

---

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/v1/api/gallery/public` *(alias: `/v1/api/galleries/public`)* | None (Public) | List only published (`is_public = 1`) gallery items |
| `GET` | `/v1/api/gallery/featured` *(alias: `/v1/api/galleries/featured`)* | None (Public) | Get published featured showcase items |
| `GET` | `/v1/api/gallery/stats` *(alias: `/v1/api/galleries/stats`)* | None (Public) | Overview statistics (`total`, `publicCount`, `hiddenCount`, `featuredCount`, `categories`) |
| `GET` | `/v1/api/gallery` *(alias: `/v1/api/galleries`)* | Optional | List gallery items with pagination, search, category, and visibility filtering |
| `GET` | `/v1/api/gallery/order-sequence` | **Bearer auth** | Get items in their current sequence order |
| `PUT` / `PATCH` | `/v1/api/gallery/order-sequence` | **Admin only** | Update item order sequence (reordering) |
| `GET` | `/v1/api/gallery/:id` *(alias: `/v1/api/galleries/:id`)* | Optional | Get item by ID (public sees active; admin sees hidden) |
| `POST` | `/v1/api/gallery` *(alias: `/v1/api/galleries`)* | **Admin only** | Create single item or bulk items array (`201 Created`) |
| `PUT` / `PATCH` | `/v1/api/gallery/:id` *(alias: `/v1/api/galleries/:id`)* | **Admin only** | Update gallery item (`200 OK`) |
| `PATCH` | `/v1/api/gallery/:id/toggle-public` | **Admin only** | Quick toggle public visibility between 0 and 1 |
| `PATCH` | `/v1/api/gallery/:id/toggle-featured` | **Admin only** | Quick toggle featured showcase status between 0 and 1 |
| `DELETE` | `/v1/api/gallery/:id` *(alias: `/v1/api/galleries/:id`)* | **Admin only** | Delete gallery item (`204 No Content`) |

---

## Data Model

| Field | Type | Required (Create) | Default | Description |
|---|---|---|---|---|
| `id` | `INTEGER` | Auto | Auto | Primary key autoincrement |
| `title` | `TEXT` | **Yes** | - | Item title |
| `caption` | `TEXT` | No | `''` | Descriptive caption or narrative |
| `alt_text` | `TEXT` | No | `''` | Accessible image alt text (alias: `altText`, `alt`) |
| `media_path` | `TEXT` | **Yes** | - | Media asset path / URL (aliases: `mediaPath`, `url`, `image`, `src`) |
| `category` | `TEXT` | No | `'photography'` | Category (`photography`, `projects`, `setup`, `travel`, `design`, `architecture`) |
| `tags` | `TEXT` (JSON) | No | `'[]'` | JSON array of tags (e.g., `["cambodia", "sunset"]`) |
| `is_public` | `INTEGER` | No | `1` | `1` = published / public, `0` = hidden / draft (aliases: `isPublic`, `published`, `status`) |
| `is_featured` | `INTEGER` | No | `0` | `1` = featured showcase, `0` = standard (aliases: `isFeatured`, `featured`) |
| `sort_order` | `INTEGER` | No | `0` | Sequence rank for ordering (aliases: `sortOrder`, `position`, `sequence`) |
| `aspect_ratio` | `TEXT` | No | `'16/9'` | Display ratio (`16/9`, `4/3`, `1/1`, `3/4`, `9/16`, `auto`, alias: `aspectRatio`) |
| `created_at` | `TEXT` | Auto | ISO string | Timestamp of record creation |
| `updated_at` | `TEXT` | Auto | ISO string | Timestamp of last modification |

---

## Query Parameters (`GET /v1/api/gallery`)

- `page`: Page number (default: `1`)
- `limit`: Items per page (default: `10`, pass `-1` for all)
- `search`: Search filter matching `title`, `caption`, `alt_text`, `media_path`, `category`, or `tags`
- `category`: Filter by category (e.g., `photography`, `setup`, `all`)
- `visibility`: Filter by visibility (`all`, `public`, `hidden`, `featured`)
- `sort`: Sort column (`sort_order`, `id`, `title`, `category`, `created_at`, `updated_at`)
- `order`: Sort direction (`asc` or `desc`)

---

## Example Responses

### 1. Public Featured Showcase (`GET /v1/api/gallery/featured`)
```json
{
  "data": [
    {
      "id": 1,
      "title": "Phnom Penh Skyline Dusk",
      "caption": "Sunset panorama over the Mekong river and urban landscape of Phnom Penh.",
      "altText": "Phnom Penh skyline at twilight",
      "alt_text": "Phnom Penh skyline at twilight",
      "mediaPath": "blogs/media/cover-phnom-penh.webp",
      "media_path": "blogs/media/cover-phnom-penh.webp",
      "category": "photography",
      "tags": ["cambodia", "cityscape", "sunset"],
      "isPublic": true,
      "is_public": 1,
      "isFeatured": true,
      "is_featured": 1,
      "sortOrder": 1,
      "sort_order": 1,
      "aspectRatio": "16/9",
      "aspect_ratio": "16/9",
      "createdAt": "2026-11-20T10:00:00.000Z",
      "updatedAt": "2026-11-20T10:00:00.000Z"
    }
  ],
  "total": 1
}
```

### 2. Gallery Statistics (`GET /v1/api/gallery/stats`)
```json
{
  "total": 6,
  "publicCount": 5,
  "hiddenCount": 1,
  "featuredCount": 3,
  "categoriesCount": 4,
  "categories": ["design", "photography", "projects", "setup"]
}
```
