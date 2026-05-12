# AI Content Generator API

## Base Path
`/v1/api/ai/generate`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/api/ai/generate` | Generate structured description/content using Cloudflare Workers AI with JSON schema validation |

> Requires authentication (`Authorization: Bearer <token>`).

## Request Body

```json
{
  "title": "Building a Cloudflare Worker API",
  "context": "API for blog and project management.",
  "tone": "professional and friendly",
  "language": "English",
  "mode": "both",
  "model": "@cf/meta/llama-3.1-8b-instruct"
}
```

**Mode values:** `description`, `content`, `both`

> **Note:** The AI now uses optimized prompt engineering and `response_format: json_schema` for highly reliable structured output. Mode-specific token limits are applied (400 for description, 1200 for content, 1800 for both).
