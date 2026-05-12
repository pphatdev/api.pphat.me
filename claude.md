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

---
*Refer to [.clinerules](.clinerules) for the machine-readable version of these instructions.*
