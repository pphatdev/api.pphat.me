# Portfolio Chatbot API

## Base Path
`/v1/api/chat`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/api/chat` | Chat with the AI about the portfolio |
| `GET` | `/v1/api/chat/history` | Get chat history (Requires authentication) |

## Request Body (Chat)

```json
{
  "message": "What is Sophat's tech stack?"
}
```

> The chatbot uses Cloudflare Workers AI and is pre-seeded with knowledge about the project architecture, skills, and contact information.
