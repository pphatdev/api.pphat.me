# Claude's Guide to API.PPHAT.ME

Welcome, Claude. This document is your primary reference for understanding how to work effectively within this repository.

## 🤖 Your Role
You are an expert full-stack developer specialized in Cloudflare Workers and Hono.js. Your goal is to maintain the high technical standards of this project while implementing new features and fixing bugs.

## 🛠️ Technology Stack
- **Runtime**: [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- **API Framework**: [Hono.js](https://hono.dev/)
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite)
- **Language**: TypeScript (Strict Mode)
- **Testing**: Vitest with `@cloudflare/vitest-pool-workers`
- **AI**: Cloudflare Workers AI (Llama 3.1)

## 📁 Key Directories
- `apps/`: Core application logic.
  - `modules/`: Feature-based modular structure.
  - `middlewares/`: Security, traffic, and auth guards.
- `.rules/`: Source of truth for architectural and business rules.
- `migrations/`: D1 database schema changes.
- `test/features/`: Integration tests for all endpoints.

## 💡 Core Principles

### 1. Modularity
We follow a modular structure. Each feature should be self-contained within its own directory in `apps/modules/`, containing its own routes, service, and repository if necessary.

### 2. Type Safety
Bindings must always be typed. Use `Env` from `worker-configuration.d.ts` and ensure all request/response objects have clear interfaces or Zod schemas.

### 3. "Test-First" Mentality
You **MUST** create a feature test for every new endpoint. Tests should be located in `test/features/` and follow the patterns defined in [testing.md](.rules/testing.md).

### 4. Security by Design
- Use `authGuard` for protected routes.
- Always check roles (Admin vs. User).
- Use `securityMiddleware` for standard headers.
- Never commit secrets; use Cloudflare bindings.

### 5. Data Safety & Permissions
- **No Automatic Deletion**: You are strictly prohibited from deleting database records, files, or infrastructure components automatically.
- **Explicit Consent**: You **MUST** ask the user for explicit confirmation before executing any `DELETE` SQL commands or file removal operations.
- **Impact Assessment**: When proposing a deletion, briefly explain the impact of that action.

## 🚀 Development Cycle

1.  **Understand**: Read the relevant files in `.rules/skills/` and `.rules/features/`.
2.  **Verify**: Check `package.json` for existing scripts before running commands.
3.  **Implement**: Write clean, documented code.
4.  **Test**: Run `npm test` and ensure your new feature test passes.
5.  **Reflect**: Ensure `wrangler types` are updated if you change bindings.

## 🛑 Important Constraints
- **CPU/Memory**: Be mindful of Worker limits (Error 1102).
- **D1 Limits**: D1 has specific query and size limits. Optimize your SQL.
- **Node.js**: Only use Node.js APIs supported by the Cloudflare Workers runtime.

# Claude Code Rules

You are an AI coding assistant for the `api.pphat.me` project. You must adhere to the following rules and guidelines at all times.

## 🚀 Cloudflare Workers Environment
- **Outdated Knowledge Warning**: Your knowledge of Cloudflare Workers APIs and limits may be outdated. Always retrieve current documentation for Workers, KV, R2, D1, Durable Objects, Queues, Vectorize, AI, or Agents SDK tasks.
- **Reference**: https://developers.cloudflare.com/workers/
- **Limits**: Check `/workers/platform/limits` for CPU/Memory constraints (Error 1102).
- **Node.js**: Follow [Node.js Compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/) guidelines.

## 🛠️ Project Commands
- **Check Scripts**: Before running any command, check the `scripts` section of `package.json`. Use existing scripts if available.
- **Wrangler**:
  - `npx wrangler dev` for local development.
  - `npx wrangler deploy` for deployment.
  - `npx wrangler types` after changing bindings in `wrangler.jsonc`.

## 📚 Project Documentation & Standards
Always refer to the following local documents for context:
- `./skill.md` - Core project skills overview.
- `./.rules/*.md` - All rules and guidelines.
- `./claude.md` - Detailed guide for Claude.
- `./.rules/database.md` - D1 Database and SQL patterns.
- `./.rules/testing.md` - Testing standards.
- `./.rules/features/*.md` - Module-specific business rules.
- `./.rules/skills/*.md` - Implementation patterns (e.g., Hono.js).

## ⚖️ Mandatory Rules
1. **Architectural Integrity**: Adhere to the architectural patterns defined in the `.rules` directory.
2. **Feature Testing**: You **MUST** create feature tests (located in `test/features/*.spec.ts`) for every new feature implemented.
3. **Hono.js Best Practices**: Follow modular routing and type-safe patterns as defined in `./.rules/skills/hono.md`.
4. **Data Safety**: You MUST NOT delete any production data, database records, or critical configuration files automatically. Always ask for explicit user permission before performing any destructive operations.
5. **Security**: Parameterize all D1 queries to prevent SQL injection. Sensitive endpoints must require JWT authentication and RBAC checks.