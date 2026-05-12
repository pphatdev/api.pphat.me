# Project Skills & Guidelines

This document outlines the core skills and architectural patterns required for contributing to this project. Detailed guidelines for each module are located in the [/.rules/skills](.rules/skills) directory.

## Core Technical Skills

### 1. Hono.js & Cloudflare Workers
Expertise in building lightweight, type-safe APIs on the Cloudflare Workers runtime.
- **Rules**: [hono.md](.rules/skills/hono.md)
- **Key Concepts**: Context handling, Bindings, Modular Routing.

### 2. Database & Persistence
Proficiency in working with D1 databases, handling migrations, and complex SQL relationships.
- **Rules**: [database.md](.rules/database.md)

### 3. Automated Testing
Requirement to maintain high test coverage using Vitest and Cloudflare testing pools.
- **Rules**: [testing.md](.rules/testing.md)
- **Location**: `test/features/*.spec.ts`

## Functional Module Skills

The following modules have specific business logic and implementation requirements:

- **AI Assistant**: Guidelines for generating content and managing AI interactions. ([manage-ai-assistant.md](.rules/skills/manage-ai-assistant.md))
- **Articles & Content**: Managing blog posts, stats, reactions, and comments. ([manage-articles.md](.rules/skills/manage-articles.md))
- **Authentication**: Secure JWT-based auth flow and session management. ([manage-authentication.md](.rules/skills/manage-authentication.md))
- **Authors & Profiles**: Managing author data and permissions. ([manage-authors.md](.rules/skills/manage-authors.md))
- **Contact & CRM**: Handling "Get in Touch" submissions and admin management. ([manage-get-in-touch.md](.rules/skills/manage-get-in-touch.md))
- **Portfolio Chatbot**: Logic for the interactive portfolio assistant. ([manage-portfolio-chatbot.md](.rules/skills/manage-portfolio-chatbot.md))
- **Projects**: Portfolio project showcase and technical details. ([manage-projects.md](.rules/skills/manage-projects.md))
- **Tags & Taxonomy**: Organizing content via reusable tags. ([manage-tags.md](.rules/skills/manage-tags.md))

## Workflow Rule
Before starting any task, verify if there are relevant scripts in `package.json`. If you implement a new feature, you **MUST** include a corresponding feature test.
