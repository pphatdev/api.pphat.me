# Authors API

## Base Path
`/v1/api/authors`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/api/authors` | List authors (paginated) |
| `GET` | `/v1/api/authors/:id` | Get author by ID |
| `POST` | `/v1/api/authors` | Create author |
| `PATCH` | `/v1/api/authors/:id` | Update author |
| `DELETE` | `/v1/api/authors/:id` | Delete author |

### Sortable columns
`id`, `name`, `profile`, `url`

### Search fields
`name`

## Request Body (Create / Update)

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
