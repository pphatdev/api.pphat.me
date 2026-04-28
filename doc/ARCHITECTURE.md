# Architecture Flow — api.pphat.me

> Version 0.10.1 · Cloudflare Workers + D1

---

## Overview

```mermaid
flowchart TD
    Client([Client]) --> Edge[Cloudflare Edge\nWorkers Runtime]
    Edge --> App[app.ts\nHono Application]
    App --> RL[rateLimitMiddleware\nper-API-type · KV counters]
    RL --> R1[authRoutes]
    RL --> R2[articleRoutes]
    RL --> R3[projectRoutes]
    RL --> R4[authorRoutes]
    RL --> R5[tagRoutes]
    RL --> R6[aiRoutes]
    RL --> R7[chatRoutes]
    R1 & R2 & R3 & R4 & R5 & R6 & R7 --> Controller
    Controller --> Service
    Service --> Repository
    Repository --> D1[(D1 SQLite)]
```

---

## Request Lifecycle

```mermaid
flowchart TD
    Req([Incoming HTTP Request]) --> Fetch["app.ts\nHono app · export default app"]
    Fetch --> RL{rateLimitMiddleware\nper-API-type bucket}
    RL -->|429 exceeded| ErrRL([429 Too Many Requests\n+ X-RateLimit-* headers])
    RL -->|pass| Route[Hono Router\nmethod + path matching]
    Route -->|no match| R404([404 Not Found])
    Route --> Guard{authGuard\nrequired route?}
    Guard -->|missing / invalid JWT| R401([401 Unauthorized])
    Guard -->|pass / public| Controller[Controller\nbody parsing · dispatch]
    Controller --> Svc[Service\nBusiness Logic]
    Svc --> Repo[Repository\nparameterised SQL]
    Repo --> D1[(D1 Database\nSQLite)]
    D1 --> Resp([HTTP Response\n+ X-RateLimit-* headers])
```

---

## Layer Responsibilities

| Layer | Files | Responsibility |
|-------|-------|----------------|
| **Entry Point** | `apps/app.ts` | Mounts global `rateLimitMiddleware`, registers five Hono sub-routers, exports `default app` |
| **Route** | `*.route.ts` / `*.routes.ts` | Typed Hono sub-app — method-specific handlers, `resolveArticle`/`resolveProject` middleware, `authGuard` on write routes |
| **Middleware** | `middlewares/auth.middleware.ts` | `requireAuth` (raw Request) + `authGuard` (Hono) — validates `Authorization: Bearer <JWT>`, returns `401` on failure |
| **Middleware** | `middlewares/rate-limit.middleware.ts` | `rateLimitMiddleware` (Hono) — per-API-type sliding-window limit; attaches `X-RateLimit-*` headers; returns `429` when exceeded |
| **Controller** | `*.controller.ts` | HTTP method dispatch, request body parsing, calls service/use-case |
| **Service** | `*.service.ts` | Business logic, use-case classes, crypto helpers |
| **Repository** | `*.repo.ts` | SQL queries against D1, data mapping |
| **Shared** | `shared/helpers/`, `shared/interfaces/` | `json()` helper, `response()` helper, shared TypeScript types |

---

## Module Map

```mermaid
mindmap
  root((modules))
    auth
      Email OTP + PBKDF2
      GitHub OAuth 2.0
      Google OAuth 2.0
    articles
      article-stats\nviews · reading time
      article-reactions\nlike/heart/fire/clap/wow
      article-comments\nthreaded comments
    projects
      project-details\nmarkdown · tech stack
    authors
      profiles · social links
    tags
      shared by articles & projects
    ai
      Workers AI generator
      JSON schema output
    chat
      Portfolio chatbot
      Persistence in D1
      History retrieval/clearing
```

---

## Authentication Flow

### Email / Password

```mermaid
sequenceDiagram
    actor C as Client
    participant Ctrl as AuthController
    participant Svc as AuthService
    participant DB as D1
    participant Mail as SMTP

    C->>Ctrl: POST /email/register {email,name,password}
    Ctrl->>Svc: RegisterEmailUser.execute()
    Svc->>Svc: hashPassword() PBKDF2/SHA-256 100k iter
    Svc->>DB: INSERT user (unverified)
    Svc->>Svc: generateOtp() Web Crypto
    Svc->>Mail: sendOtpEmail(otp)
    Ctrl-->>C: 201 Verification code sent

    C->>Ctrl: POST /email/verify {email, code}
    Ctrl->>Svc: VerifyEmailOtp.execute()
    Svc->>DB: verifyAndConsumeOtp()
    Svc->>DB: markEmailVerified()
    Svc->>Svc: createJwt() HS256 7-day
    Ctrl-->>C: { token }

    C->>Ctrl: POST /email/login {email, password}
    Ctrl->>Svc: LoginWithPassword.execute()
    Svc->>DB: findEmailUser()
    Svc->>Svc: verifyPassword() PBKDF2
    Svc->>Svc: createJwt() HS256 7-day
    Ctrl-->>C: { token }
```

### OAuth (GitHub / Google)

```mermaid
sequenceDiagram
    actor C as Client
    participant Ctrl as AuthController
    participant Svc as AuthService
    participant P as GitHub / Google
    participant DB as D1

    C->>Ctrl: GET /auth/github
    Ctrl->>Svc: generateOAuthState() HMAC
    Ctrl-->>C: 302 Redirect to provider + state

    C->>P: Authorize
    P-->>C: Redirect /callback?code=&state=

    C->>Ctrl: GET /auth/github/callback
    Ctrl->>Svc: verifyOAuthState() HMAC check
    Ctrl->>P: exchangeCode() → access_token
    Ctrl->>P: fetchUser() profile + email
    Ctrl->>DB: findOrCreateUser()
    Ctrl->>Svc: createJwt() HS256 7-day
    Ctrl-->>C: { token }
```

### JWT Verification (protected routes)

```mermaid
flowchart LR
    Req([Request]) --> H{Authorization:\nBearer present?}
    H -->|No| R401([401 Unauthorized])
    H -->|Yes| V{verifyJwt\nHMAC-SHA256\n+ expiry}
    V -->|Invalid / expired| R401
    V -->|Valid| Pass([null — continue])
```

---

## Data Flow — Read Example (GET /v1/api/articles)

```mermaid
sequenceDiagram
    actor C as Client
    participant R as articleRoutes (Hono)
    participant Ctrl as ArticlesController
    participant Svc as ArticlesService
    participant Repo as ArticlesRepo
    participant DB as D1

    C->>R: GET /v1/api/articles?page=1&limit=10&search=cloudflare
    R->>Ctrl: handle(c.req.raw, c.env)
    Ctrl->>Ctrl: parse query params\npage · limit · search · sort · order
    Ctrl->>Svc: list(params)
    Svc->>Repo: list(params)
    Repo->>DB: SELECT ... FROM articles\nWHERE title LIKE ?\nORDER BY created_at DESC\nLIMIT ? OFFSET ?
    DB-->>Repo: rows + total count
    Repo-->>Svc: PaginatedResult
    Svc-->>Ctrl: PaginatedResult
    Ctrl-->>C: 200 { data, total, page, limit }
```

---

## Data Flow — Write Example (POST /v1/api/articles)

```mermaid
sequenceDiagram
    actor C as Client
    participant R as articleRoutes (Hono)
    participant Auth as authGuard
    participant Ctrl as ArticlesController
    participant Svc as ArticlesService
    participant Repo as ArticlesRepo
    participant DB as D1

    C->>R: POST /v1/api/articles\nAuthorization: Bearer <jwt>
    R->>Auth: authGuard middleware
    Auth-->>R: 401 or next()
    Ctrl->>Ctrl: request.json()\nvalidate required fields
    Ctrl->>Svc: create(body)
    Svc->>Repo: create(data)
    Repo->>DB: INSERT INTO articles
    Repo->>DB: INSERT INTO article_stats (auto-init)
    Repo->>DB: INSERT INTO article_tags (if tag_ids)
    DB-->>Repo: new row
    Repo-->>Svc: article
    Svc-->>Ctrl: article
    Ctrl-->>C: 201 { id, slug, ... }
```

---

## Database Schema (D1 / SQLite)

```mermaid
erDiagram
    users ||--o{ oauth_accounts : "has"
    users ||--o{ email_otps : "has"

    articles ||--o{ article_authors : "written by"
    authors  ||--o{ article_authors : "writes"

    articles ||--o{ article_tags : "tagged with"
    tags     ||--o{ article_tags : "tags"

    articles ||--|| article_stats : "has"
    articles ||--o{ article_reactions : "has"
    articles ||--o{ article_comments : "has"

    projects ||--o{ project_tags : "tagged with"
    tags     ||--o{ project_tags : "tags"

    projects ||--o{ project_contributors : "contributed by"
    authors  ||--o{ project_contributors : "contributes to"

    projects ||--o| project_details : "has"
    users    ||--o{ chat_history : "has"
```

---

## Environment Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `DB` | D1Database | Primary SQLite database |
| `JWT_SECRET` | Secret | HMAC key for JWT signing + OAuth CSRF state |
| `GITHUB_CLIENT_ID` | Var | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | Secret | GitHub OAuth app client secret |
| `GOOGLE_CLIENT_ID` | Var | Google OAuth app client ID |
| `GOOGLE_CLIENT_SECRET` | Secret | Google OAuth app client secret |
| `APP_URL` | Var | Canonical base URL (OAuth redirect URIs) |
| `SMTP_HOST` | Var | SMTP server hostname |
| `SMTP_PORT` | Var | SMTP server port |
| `SMTP_USER` | Var | SMTP sender display name + address |
| `SMTP_FROM` | Var | SMTP from address |
| `SMTP_PASS` | Secret | SMTP password |
| `AI` | Binding | Cloudflare Workers AI binding |

---

## Error Response Conventions

| Status | Meaning |
|--------|---------|
| `400` | Bad request / invalid body / invalid OTP |
| `401` | Missing or invalid JWT |
| `403` | Email not yet verified |
| `404` | Resource not found |
| `405` | HTTP method not allowed |
| `409` | Slug or email already exists |
| `422` | Validation error (missing fields / invalid tag IDs) |
| `429` | Rate limit exceeded — includes `Retry-After` + `X-RateLimit-*` headers |
| `502` | Upstream OAuth provider failure |
