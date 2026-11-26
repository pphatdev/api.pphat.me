# Plan: migrate api.pphat.me from Cloudflare D1 to Turso

Status: **in progress**: data seeded and adapter implemented, not deployed ·
Branch: `feat/turso-migration` · Drafted 2026-11-26

## Progress (2026-11-26)

| Step | State |
|---|---|
| Backup of production D1 | done, verified (see below) |
| Phase 0 (visitor_logs index) | implemented on `fix/visitor-logs-row-reads`, uncommitted, stashed as `stash@{0}` |
| Turso database | `blog-pphatdev`, region `aws-ap-northeast-1` (Tokyo) |
| Seed from backup | done: 32 tables / 8,782 rows, per-table SHA-256 match, `integrity_check` ok, 0 FK violations |
| Pending migrations on Turso | `0033` applied (34 recorded in `d1_migrations`, same history table as D1) |
| D1-compatible adapter + `DB_DRIVER` switch | done (`apps/shared/db`), default `d1` |
| Tests | 9 adapter/driver tests in CI; 9 live checks against Turso (`npm run db:turso:check`) all pass |
| End-to-end | `npm run dev:turso` serves real endpoints from Turso (≈100–250 ms per query to Tokyo) |
| Cutover | not started |

Findings that changed the plan:
- **Turso enforces foreign keys** (`PRAGMA foreign_keys = 1`), the same as D1. A
  raw `turso db shell < dump.sql` fails on the dump's child-before-parent
  order, so seeding restores the dump in memory and copies tables
  parent-first (`npm run db:turso:seed`).
- **The design is simpler than Phase 3 originally proposed.** Instead of
  refactoring 131 `env.DB` call sites, the adapter implements Cloudflare's
  `D1Database` interface, and the Worker entry swaps `env.DB` once per request
  or cron tick. Modules are untouched.
- **Region:** Tokyo was chosen at creation. For users in Cambodia, a Singapore
  region would likely cut latency; measure before cutover.

## Tooling

| Command | What it does |
|---|---|
| `npm run db:turso:ping` | host, SQLite version, FK setting, tables |
| `npm run db:turso:seed [dump.sql]` | seed an **empty** Turso database from a D1 export (refuses if it has tables) |
| `npm run db:turso:migrate [-- --dry-run]` | apply pending `migrations/*.sql`, tracked in `d1_migrations` |
| `npm run db:turso:check` | live D1-parity checks of the adapter (temporary `_conf_*` tables only) |
| `npm run dev:turso` | local API with `DB_DRIVER=turso` |

## TL;DR

1. **Fix the row-read hotspot first (Phase 0).** Production hit D1's free-tier
   limit of 5M rows read/day on 2026-11-26 and every DB read returned 500 until
   midnight UTC. The cause is a missing index, not D1. Turso also bills rows
   read, so it would hit the same wall later.
2. **Then decide** (Phase 1). Turso Free gives ~500M rows read/month
   (≈16.6M/day). D1 on Workers Paid ($5/month) gives 25B/month with zero code
   change. Moving to Turso only makes sense if we want Turso-specific features
   or to stay on a free plan.
3. **If we go ahead,** put a thin `Db` adapter in front of the existing
   D1-style calls, back it by `@libsql/client/web`, and cut over with a short
   read-only window. D1 stays intact as the rollback target.

## Backup and rollback point

Taken 2026-11-26 13:10 UTC, before any change. The files live in `backups/`
(git-ignored, mode 600 because they contain emails and password hashes).

| File | Contents |
|---|---|
| `backups/d1-remote-2026-11-26T13-10-01Z.sql` | full dump (schema + data) |
| `backups/d1-remote-2026-11-26T13-10-01Z.data-only.sql` | data only, for importing into a pre-created schema |
| `backups/d1-remote-2026-11-26T13-10-01Z.manifest.json` | SHA-256s, row counts, bookmarks |

- **Verified:** the full dump restores into a fresh SQLite database with
  `integrity_check = ok` and 0 foreign-key violations (32 tables, 8,782 rows).
  A per-table comparison with live production could not run because the daily
  read limit was already exceeded. Re-run it after the reset.
- **D1 Time Travel bookmarks** (point-in-time restore, kept for 30 days on
  Paid and 7 on Free):
  - at the export: `00009048-00000000-0000512f-79f67491c103a355b5af7de63d6d8a47`
  - recorded by Sophat: `00009048-00000002-0000512f-68c1734a23765e9dba2206c5c58909a0`
  - restore with: `npx wrangler d1 time-travel restore api --bookmark=<id>`
- **Restore gotcha:** the dump inserts child rows before their parent tables
  exist (for example `article_contributors` before `users`). Load it with
  foreign keys **OFF**, then run `PRAGMA foreign_key_check`. The same applies
  to `turso db shell < dump.sql`.
- **Production schema drift:** migration `0033_article_view_visitor` is **not**
  applied in production yet. Apply it before the final export.

## Phase 0: stop the row-read bleed (do now, independent of Turso)

`wrangler d1 insights` (last 24h) shows:

| Rows read | Runs | Query | Source |
|---|---|---|---|
| 5,012,890 | 631 | `SELECT COUNT(DISTINCT ip_hash) FROM visitor_logs WHERE timestamp > ?` | `dashboard.repo.ts:74`, polled every 5s by the live-traffic SSE stream |
| 1,511,900 | 275 | `DELETE FROM visitor_logs WHERE timestamp < datetime('now', ?)` | 5-minute cron in `app.ts` |
| < 70,000 | n/a | everything else | n/a |

`visitor_logs` has **no index**, so both queries scan the whole table (~8k
rows) on every run.

- [ ] Migration `0034`: `CREATE INDEX idx_visitor_logs_ts_ip ON visitor_logs(timestamp, ip_hash);`
      This covering index makes the live count read only the rows in its
      window, and lets the sweep seek instead of scan.
- [ ] Cut the poll cost further: poll every 15–30s instead of 5s, and/or cache
      the count for the poll interval so concurrent dashboards share one query.
- [ ] Stop logging scanner noise (`/xor_create.php`, `/.env`, `wp-*`) into
      `visitor_logs`: only log known API paths.
- [ ] Optionally run the sweep hourly instead of every 5 minutes.
- [ ] Add a test that runs `EXPLAIN QUERY PLAN` on the live-count query and
      asserts it uses the index, so this regression can't recur unnoticed.

**Expected effect:** about 6.5M rows/day drops to tens of thousands.

**Applying it:** building the index reads the table, so either wait until
after 00:00 UTC or move the account to Workers Paid first.

## Phase 1: decision gate

| | D1 Free | D1 on Workers Paid | Turso Free |
|---|---|---|---|
| Rows read | 5M/day (hard stop) | 25B/month incl., then $0.001/M | ~500M/month incl. |
| Rows written | 100k/day | 50M/month incl. | ~10M/month incl. |
| Code change | none | none | adapter + config + migrations tooling |
| Latency from Worker | same network | same network | HTTP round trip to a Turso region |
| Point-in-time restore | Time Travel (7d) | Time Travel (30d) | depends on plan (verify) |
| Cost | $0 | $5/month (also unlocks Workers Paid limits) | $0 (Developer $4.99/month) |

Turso's figures come from its Developer-plan announcement and secondary 2026
sources. **Re-check [turso.tech/pricing](https://turso.tech/pricing) before
deciding**: its site currently says "Turso is joining Supabase", so plans may
change.

**Recommendation:** do Phase 0, watch `wrangler d1 insights` for a week, then
decide. If reads stay well under 5M/day, staying on D1 is the cheapest option
operationally. Go ahead with Turso only for a concrete Turso advantage, for
example embedded replicas outside Workers, many per-tenant databases, or
staying vendor-neutral from Cloudflare.

## Phase 2: current D1 coupling (inventory)

| Item | Count | Notes |
|---|---|---|
| Files touching `env.DB` / `D1Database` | 47 | repos, middlewares, cron, tests |
| `.prepare(` calls | 257 | portable SQL |
| `.first<T>()` | 98 | no `first('column')` form, so it's easy to map |
| `.batch(` | 15 | in 7 repos (articles, projects, faqs, services, gallery, experiences, article-stats) |
| `meta.changes` / `changes()` | 30 | `changes()` is used **inside a batch** in `article-stats.repo.ts` |
| `meta.last_row_id` | 11 | libSQL returns `lastInsertRowid` (bigint) |
| `D1Database` / `D1Result` type refs | 58 | replace with the adapter types |
| `.raw()`, `.dump()`, `withSession`, `RETURNING`, JSON1 | 0 | nothing exotic |
| SQL migrations | 34 files | applied via `wrangler d1 migrations` and the `d1_migrations` table |
| Feature tests | 30 files | miniflare D1 via `@cloudflare/vitest-pool-workers` |
| Scripts | `db-pull-remote`, `db-studio`, `create-admin`, `seed-data` | all call wrangler d1 |

`@libsql/client` and `drizzle-orm`/`drizzle-kit` are already in
`devDependencies`.

## Phase 3: target design

> **Implemented differently (simpler):** `apps/shared/db/libsql-d1.ts`
> implements `D1Database` itself, and `resolveEnv(env)` in the Worker entry
> swaps `env.DB` when `DB_DRIVER=turso`. No call sites changed. The sketch
> below is kept for reference.

Keep the SQL. Swap only the transport.

```ts
// apps/shared/db/db.ts
export interface DbStatement {
    bind(...values: unknown[]): DbStatement;
    first<T>(): Promise<T | null>;
    all<T>(): Promise<{ results: T[] }>;
    run(): Promise<{ meta: { changes: number; last_row_id: number } }>;
}
export interface Db {
    prepare(sql: string): DbStatement;
    batch(statements: DbStatement[]): Promise<Array<{ meta: { changes: number; last_row_id: number } }>>;
}
export function getDb(env: Env): Db; // DB_DRIVER = 'd1' | 'turso'
```

- **`D1Db`** is a pass-through over `env.DB` (the shape already matches), so
  the refactor can land and ship on D1 first with zero behaviour change.
- **`LibsqlDb`** uses `createClient({ url, authToken })` from
  `@libsql/client/web`, the only entry point that works in Workers:
  - `all` maps to `execute()` then `rows`
  - `first` maps to `rows[0] ?? null`
  - `run` maps to `{ changes: rowsAffected, last_row_id: Number(lastInsertRowid) }`
  - `batch` maps to `client.batch(stmts, 'write')`, which runs as one
    transaction
- **Create a client per request.** Don't share it across requests in module
  scope.
- **Config:** secrets `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` (via
  `wrangler secret put`), plus var `DB_DRIVER`. Run `wrangler types` afterwards.
- **Checks needed for libSQL parity** (each gets a conformance test):
  - [ ] `changes()` inside `batch` still refers to the previous statement
        (view dedupe in `article-stats.repo.ts`)
  - [ ] foreign keys are enforced: D1 enforces them; confirm Turso does, or
        send `PRAGMA foreign_keys=ON` per connection
  - [ ] integers come back as `number`, not `bigint` (use `intMode: 'number'`)
  - [ ] `datetime('now')` and `date('now')` agree in format (16 call sites)
  - [ ] `ON CONFLICT … DO UPDATE` and `INSERT OR IGNORE` behave the same
  - [ ] Turso's newer `@tursodatabase/*` packages: prefer them only if they
        support the Workers runtime without native bindings; otherwise stay on
        `@libsql/client/web`

## Phase 4: migrations and tooling

- Keep `migrations/*.sql` as the source of truth.
- Add `scripts/migrate-turso.mjs`. It applies files in order against libSQL and
  records them in a table named **`d1_migrations`**, so history carries over
  from D1 unchanged.
- Add npm scripts `db:turso:migrate` and `db:turso:shell`. Keep the D1 scripts
  until cutover is final.
- Local dev: `turso dev` (local libSQL server) or a `file:` database. Tests:
  keep the D1 suite, and add an adapter conformance suite that runs against
  both drivers.

## Phase 5: data import (rehearse at least twice)

> **Rehearsal 1 done (2026-11-26)** with `npm run db:turso:seed`, which
> restores the full dump in memory, then copies tables parent-first and
> verifies SHA-256 per table. For the final cutover, seed a fresh, empty Turso
> database from the final export, or create one with `turso db create`.

1. Create the database in the region closest to users (for example
   `aws-ap-southeast-1`) and measure Worker-to-Turso latency first.
2. Apply the schema (all migrations, including 0033 and 0034) to an empty
   Turso database.
3. Load `*.data-only.sql` with foreign keys off. Skip the `d1_migrations`
   rows, because the migrator recreates them.
4. Run `PRAGMA foreign_key_check` and `PRAGMA integrity_check`, then compare
   per-table `COUNT(*)` against D1 (script it from the manifest).
5. Spot-check checksums on hot tables (`articles`, `users`, `api_keys`,
   `article_stats`).

## Phase 6: cutover and rollback

1. Ship the adapter with `DB_DRIVER=d1` and let it soak for a few days.
2. Announce a short read-only window. Block writes with a maintenance flag
   (non-GET requests return 503) and pause the cron.
3. Take a final D1 export and note its Time Travel bookmark.
4. Import into Turso and run the Phase 5 checks.
5. Set `DB_DRIVER=turso`, deploy, and smoke-test login, article read/write,
   view count, and dashboard SSE.
6. Lift read-only and watch errors, latency and Turso rows-read for 48h.

**Rollback:** set `DB_DRIVER=d1` and redeploy. D1 still holds the
pre-cutover data. Writes made after cutover must be replayed or accepted as
lost, which is why the cutover window should be short and done during low
traffic.

## Risks

| Risk | Mitigation |
|---|---|
| Extra network hop on every query (D1 is in-network) | measure in Phase 5; use `batch` for multi-query paths; pick the nearest region |
| Full scans still cost rows-read on Turso | Phase 0 indexes, plus the `EXPLAIN QUERY PLAN` test |
| Behaviour drift (`changes()`, foreign keys, bigint) | conformance suite against both drivers |
| Vendor or pricing change ("Turso is joining Supabase") | re-verify pricing and roadmap at the decision gate |
| Losing writes during cutover | read-only window, final export, rollback flag |

## Rough effort

| Phase | Effort |
|---|---|
| 0 | ~0.5 day |
| 1 | 1 week of observation |
| 2–3 | 2–3 days (mechanical type changes across 47 files, plus the adapter and tests) |
| 4 | 1 day |
| 5 | 1 day, including rehearsals |
| 6 | about 1 hour of window, plus monitoring |
