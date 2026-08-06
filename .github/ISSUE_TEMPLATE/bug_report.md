---
name: "🐛 Bug Report"
about: Report a bug or unexpected API behavior in api.pphat.me
title: "[BUG] "
labels: ["bug", "triage"]
assignees: ""
---

## 🐛 Bug Description
A clear and concise description of what the bug is and where it occurs in the API.

## 🔄 Steps to Reproduce
Steps to reproduce the behavior:
1. **Endpoint**: `[GET / POST / PUT / DELETE]` `/api/v1/...`
2. **Headers**: `Authorization: Bearer <token>`, `Content-Type: application/json`
3. **Payload**:
   ```json
   {
     "key": "value"
   }
   ```
4. **Actual Response**: Status Code `500` / Error Payload:
   ```json
   {
     "error": "..."
   }
   ```

## 🎯 Expected Behavior
A clear and concise description of what you expected to happen according to the API spec.

## 🛠️ Affected Component / Subsystem
- [ ] API Endpoint (`apps/modules/...`)
- [ ] Middleware / Security Guard (`apps/middlewares/...`)
- [ ] Database / D1 Query (`migrations/` or repositories)
- [ ] Wrangler / Cloudflare Worker Runtime
- [ ] Feature Tests (`test/features/*.spec.ts`)

## 💻 Environment & Runtime
- **API Version**: 
- **Cloudflare Worker Runtime**: 
- **Wrangler Version**: 
- **Node.js Version**: 
- **OS**: [Windows / macOS / Linux]
- **Deployment**: [Local `wrangler dev` / Cloudflare Staging / Production]

## 📜 Logs & Stack Traces
```shell
# Paste console logs, wrangler dev output, or vitest failures here
```

## 📋 Checklist
- [ ] I have searched existing issues to ensure this is not a duplicate.
- [ ] I have included relevant logs and error tracebacks.
- [ ] I have verified this behavior abides by the project's [Code of Conduct](https://github.com/pphatdev/api.pphat.me/blob/main/CODE_OF_CONDUCT.md).

---
© 2026 [PPhat](https://pphat.me). All rights reserved.
