# Security Policy

## Supported Versions

The following versions of the API are currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| v0.17.x | :white_check_mark: |
| v0.16.x | :white_check_mark: |
| < v0.16 | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please send an e-mail to **info.sophat@gmail.com**. All security vulnerabilities will be promptly addressed.

Please include the following information in your report:

- **Type of issue** (e.g., SQL injection, XSS, Buffer overflow)
- **Component/Location** of the vulnerability
- **Steps to reproduce** the issue
- **Potential impact** if exploited

We appreciate your help in keeping this project secure.

## Security Practices

We follow industry best practices to ensure the security of our users and data:

- **JWT Authentication**: All sensitive endpoints require valid JWT tokens. Access tokens have a 15-minute TTL; a per-user `session_invalidated_at` floor makes logout effectively immediate.
- **Refresh Token Hygiene**: Refresh tokens are SHA-256 hashed at rest, rotated per use, delivered as HttpOnly cookies scoped to `/v1/api/auth`, and share a `family_id` so a replayed token revokes the whole family.
- **JWT Hardening**: Signature algorithm is pinned to `HS256`; `iss` (`pphat-api`) and `aud` (`pphat-web`) are checked on every verify.
- **OAuth CSRF Defence**: `state` nonce is bound to the initiating client via a JWT-signed HttpOnly cookie; PKCE (S256) is sent to both GitHub and Google.
- **Role-Based Access Control (RBAC)**: Fine-grained permissions. Contributors on an article can edit only `content` / `description` / `thumbnail`; owner + admin control everything else.
- **Secure Headers & CORS**: Explicit hostname allow-list for CORS (no wildcard preview domains); security headers via Hono middleware.
- **Rate Limiting**: Per-type Cloudflare Rate Limiting bindings (auth, read, write, engagement, contact) — atomic across isolates, no in-memory state.
- **Body Size Cap**: 100 KB `Content-Length` cap on POST/PUT/PATCH before any auth or DB work.
- **Anti-Inflation**: Reactions are keyed by `(article, type, user)` so repeat clicks are idempotent; view counts are deduped per `(article, user, UTC-day)`.
- **Environment Isolation**: Secrets are managed via Cloudflare Secrets Store (`wrangler secret put`) and never committed to version control. See `.env.example` for the full checklist.
- **Dependency Audits**: Regular monitoring for known vulnerabilities. See "Pinned Dependencies" below.
- **SQL Injection Prevention**: All database queries are parameterized via D1's binding system.

### Pinned Dependencies

Some transitive dependencies are pinned in `package.json` `overrides` to prevent silent downgrades that would reintroduce known vulnerabilities:

- **`undici` `^7.29.0`** — pinned to keep our transitive HTTP client above known-CVE versions. If npm resolves an older `undici` via a different dependency path, this override forces the safer floor. Do not remove without checking each dependency's transitive resolution.
- **`@esbuild-kit/core-utils` → `esbuild` `^0.25.12`** — pins esbuild used by drizzle-kit's runtime tsx loader; older esbuild versions in that path shipped a dev-server SSRF.

---
© 2026 [PPhat](https://pphat.me). All rights reserved.
