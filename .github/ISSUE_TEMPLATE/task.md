---
name: "🛠️ Task / Chore"
about: Maintenance, refactoring, dependency updates, or documentation improvements
title: "[TASK] "
labels: ["chore"]
assignees: ""
---

## 📝 Task Description
A clear and concise description of the maintenance or refactoring task to be executed.

## 🎯 Rationale & Impact
Why is this task necessary? (e.g. technical debt reduction, Cloudflare runtime API compatibility, security patch, performance tuning).

## 🛠️ Affected Areas & Files
- Core logic: `apps/modules/...`
- Middlewares: `apps/middlewares/...`
- Database & Schemas: `migrations/...`, `drizzle/`
- Integration Tests: `test/features/...`
- Documentation: `README.md`, `.rules/`, `AGENTS.md`

## 📋 Action Items & Acceptance Criteria
- [ ] Implement required code/configuration changes.
- [ ] Update TypeScript bindings (`npm run cf-typegen` / `npx wrangler types`) if `wrangler.jsonc` changed.
- [ ] Create or update feature tests in `test/features/`.
- [ ] Verify test suite completes cleanly (`npm test`).
- [ ] Ensure compliance with project rules in `.rules/` and `AGENTS.md`.

---
© 2026 [PPhat](https://pphat.me). All rights reserved.
