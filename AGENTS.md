# Cloudflare Workers

STOP. Your knowledge of Cloudflare Workers APIs and limits may be outdated. Always retrieve current documentation before any Workers, KV, R2, D1, Durable Objects, Queues, Vectorize, AI, or Agents SDK task.

## Docs

- https://developers.cloudflare.com/workers/
- MCP: `https://docs.mcp.cloudflare.com/mcp`

For all limits and quotas, retrieve from the product's `/platform/limits/` page. eg. `/workers/platform/limits`

## Commands

| Command | Purpose |
|---------|---------|
| `npx wrangler dev` | Local development |
| `npx wrangler deploy` | Deploy to Cloudflare |
| `npx wrangler types` | Generate TypeScript types |

Run `wrangler types` after changing bindings in wrangler.jsonc.

## Node.js Compatibility

https://developers.cloudflare.com/workers/runtime-apis/nodejs/

## Errors

- **Error 1102** (CPU/Memory exceeded): Retrieve limits from `/workers/platform/limits/`
- **All errors**: https://developers.cloudflare.com/workers/observability/errors/

## Product Docs

Retrieve API references and limits from:
`/kv/` · `/r2/` · `/d1/` · `/durable-objects/` · `/queues/` · `/vectorize/` · `/workers-ai/` · `/agents/`

# Project Feature

Stop!, Before running any command, check if it exists in the `scripts` section of `package.json`. If it does, use it. If not, you can create it.

## Docs

- `./skill.md` - Core project skills overview.
- `./CONTRIBUTING.md` - Contribution guidelines.
- `./claude.md` - Detailed guide for Claude.
- `./.rules/database.md` - D1 Database and SQL patterns.
- `./.rules/testing.md` - Testing standards.
- `./.rules/features/*.md` - Module-specific business rules.
- `./.rules/skills/*.md` - Implementation patterns (e.g., Hono.js).

## Rules

1. Adhere to the architectural patterns and feature requirements defined in the `.rules` directory.
2. You MUST create feature tests (located in `test/features/*.spec.ts`) for every new feature implemented.
3. Follow Hono.js best practices and modular routing as defined in `.rules/skills/hono.md`.
4. **Data Safety**: You MUST NOT delete any production data, database records, or critical configuration files automatically. Always ask for explicit user permission before performing any destructive operations.
