# Tags API

## Base Path
`/v1/api/tags`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/api/tags` | List tags (paginated) |
| `GET` | `/v1/api/tags/:id` | Get tag by ID |
| `POST` | `/v1/api/tags` | Create tag |
| `PATCH` | `/v1/api/tags/:id` | Update tag |
| `DELETE` | `/v1/api/tags/:id` | Delete tag |

### Sortable columns
`id`, `tag`, `description`

### Search fields
`tag`, `description`

## Request Body (Create / Update)

```json
{
  "tag": "javascript",
  "description": "Articles about JavaScript."
}
```
