# Contact API

## Base Path
`/v1/api/contact`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/api/contact` | Submit contact form (Public) |
| `GET` | `/v1/api/contact` | List messages (Admin only) |
| `GET` | `/v1/api/contact/:id` | Get message by ID (Admin only) |

## Request Body (Submit)

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "subject": "Inquiry",
  "message": "Hello!"
}
```
