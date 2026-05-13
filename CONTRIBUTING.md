# Contributing to this project

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please be respectful and professional in all interactions.

## How to Contribute

### 1. Reporting Bugs
- Check the [Issues](https://github.com/pphatdev/api.pphat.me/issues) to see if the bug has already been reported.
- If not, create a new issue with a clear title and detailed description (including steps to reproduce).

### 2. Suggesting Features
- Open an issue with the "Feature Request" label.
- Describe the feature, why it’s needed, and how it should work.

### 3. Pull Requests
- Fork the repository and create your branch from `develop`.
- Ensure your code adheres to the project's [Coding Rules](.rules/).
- **Testing**: Every new feature MUST include integration tests in `test/features/*.spec.ts`.
- Run `npm test` to ensure all tests pass before submitting.
- Link your PR to a relevant issue.

## Development Workflow

1.  **Install Dependencies**: `npm install`
2.  **Local Dev**: `npm run dev`
3.  **Type Generation**: `npm run cf-typegen` if you change `wrangler.jsonc`.
4.  **Database**: Apply migrations locally using `npx wrangler d1 migrations apply api --local`.

## Technical Standards

We use a strict modular architecture. Please refer to these documents before implementation:
- [Testing Guidelines](.rules/testing.md)
- [Hono.js Best Practices](.rules/skills/hono.md)
- [Database Patterns](.rules/database.md)

For a full list of skills and module-specific rules, see [skill.md](skill.md).

## Security

Do NOT report security vulnerabilities via public issues. Please follow our [Security Policy](SECURITY.md).

---
© 2026 PPhat Dev
