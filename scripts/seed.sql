-- =============================================================================
-- Portfolio Seed Data for api.pphat.me
-- Entities: tech_stacks, skills, experiences, experience_tech_stacks,
--           articles, authors, author_details, article_authors, article_stats,
--           projects, project_details, tags
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tech Stacks
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO tech_stacks (id, name, description, url, logo_url, cover, status, created_at, updated_at)
VALUES
    (1, 'TypeScript', 'Typed superset of JavaScript that compiles to plain JavaScript.', 'https://www.typescriptlang.org', 'devicon-typescript-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (2, 'Cloudflare Workers', 'Serverless execution environment running on Cloudflares global edge network.', 'https://workers.cloudflare.com', 'devicon-cloudflare-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (3, 'Cloudflare D1', 'Serverless distributed SQLite database with zero-latency edge access.', 'https://developers.cloudflare.com/d1', 'devicon-sqlite-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (4, 'Hono', 'Fast, lightweight web framework built on Web Standards for Cloudflare Workers and the edge.', 'https://hono.dev', 'devicon-hono-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (5, 'React', 'The library for web and native user interfaces.', 'https://react.dev', 'devicon-react-original', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (6, 'Next.js', 'The React Framework for the Web with hybrid static & server rendering.', 'https://nextjs.org', 'devicon-nextjs-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (7, 'Node.js', 'Asynchronous event-driven JavaScript runtime environment.', 'https://nodejs.org', 'devicon-nodejs-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (8, 'PostgreSQL', 'Powerful, open-source object-relational database system.', 'https://www.postgresql.org', 'devicon-postgresql-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (9, 'Docker', 'Platform for developing, shipping, and running applications in isolated containers.', 'https://www.docker.com', 'devicon-docker-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (10, 'Tailwind CSS', 'Utility-first CSS framework for rapid UI and design system development.', 'https://tailwindcss.com', 'devicon-tailwindcss-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z');

-- -----------------------------------------------------------------------------
-- 2. Skills (Linked to Tech Stacks)
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO skills (id, tech_stack_id, level, years_of_experience, description, sort_order, status, created_at, updated_at)
VALUES
    (1, 1, 'expert', 5.0, 'Type-safe architecture, generics, strict compiler configs, and library design.', 1, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (2, 2, 'advanced', 4.0, 'Serverless edge services, KV, D1, R2 storage, Queues, and Workers AI integration.', 2, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (3, 4, 'expert', 3.5, 'Modular routing, middleware pipelines, RPC client generation, and streaming responses.', 3, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (4, 5, 'advanced', 5.0, 'Component architecture, custom hooks, performance tuning, and state management.', 4, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (5, 3, 'advanced', 3.0, 'Schema design, migration strategies, indexing, and SQLite query optimization.', 5, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (6, 6, 'advanced', 4.0, 'App router, server actions, SSR/SSG caching, and SEO optimization.', 6, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (7, 9, 'intermediate', 4.0, 'Multi-stage Dockerfiles, Docker Compose environments, and CI container workflows.', 7, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (8, 10, 'expert', 4.0, 'Responsive layouts, dark-mode styling, component abstraction, and animation.', 8, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z');

-- -----------------------------------------------------------------------------
-- 3. Experiences
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO experiences (id, title, company, description, start_date, end_date, location, employment_type, company_url, logo_url, cover, status, created_at, updated_at)
VALUES
    (1, 'Senior Full-Stack Engineer', 'TechCorp Solutions', 'Architected and built scalable edge microservices and developer platforms using Cloudflare Workers, Hono, and TypeScript. Improved global API response times by 45%.', '2023-03-01', NULL, 'Phnom Penh, Cambodia (Remote)', 'full-time', 'https://example.com', 'https://cdn-icons-png.flaticon.com/512/3061/3061341.png', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (2, 'Full-Stack Developer', 'Digital Agency Asia', 'Developed high-traffic ecommerce portals and client web apps. Designed performant React/Next.js interfaces backed by Node.js and PostgreSQL databases.', '2021-06-01', '2023-02-28', 'Phnom Penh, Cambodia', 'full-time', 'https://example.com', 'https://cdn-icons-png.flaticon.com/512/2942/2942821.png', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (3, 'Frontend Developer', 'StartUp Lab', 'Engineered interactive dashboards and client-side applications with React and TypeScript. Collaborated closely with UI/UX designers to implement design system tokens.', '2019-09-01', '2021-05-31', 'Phnom Penh, Cambodia', 'full-time', 'https://example.com', 'https://cdn-icons-png.flaticon.com/512/1006/1006771.png', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z');

-- Junction: Experiences to Tech Stacks
INSERT OR IGNORE INTO experience_tech_stacks (experience_id, tech_stack_id)
VALUES
    (1, 1), -- TechCorp -> TypeScript
    (1, 2), -- TechCorp -> Cloudflare Workers
    (1, 3), -- TechCorp -> Cloudflare D1
    (1, 4), -- TechCorp -> Hono
    (1, 5), -- TechCorp -> React
    (2, 5), -- Digital Agency -> React
    (2, 6), -- Digital Agency -> Next.js
    (2, 7), -- Digital Agency -> Node.js
    (2, 8), -- Digital Agency -> PostgreSQL
    (2, 10), -- Digital Agency -> Tailwind CSS
    (3, 1), -- StartUp Lab -> TypeScript
    (3, 5), -- StartUp Lab -> React
    (3, 10); -- StartUp Lab -> Tailwind CSS

-- -----------------------------------------------------------------------------
-- 4. Authors and Author Details
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO authors (id, name, profile, url, user_id)
VALUES
    (1, 'Sophat L.', 'Full-Stack Engineer & Cloud Architect', 'https://pphat.me', NULL);

INSERT OR IGNORE INTO author_details (id, author_id, bio, avatar_url, social_links, status, created_at, updated_at)
VALUES
    (1, 1, 'Full-stack software engineer building high-performance applications on Cloudflare Workers, Hono, and TypeScript.', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400', '[{"platform":"github","url":"https://github.com/pphat"},{"platform":"linkedin","url":"https://linkedin.com/in/pphat"}]', 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z');

-- -----------------------------------------------------------------------------
-- 5. Articles (Blog)
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO articles (id, title, slug, description, thumbnail, published, is_public, publish_at, position, content, file_path, owner_id, created_at, updated_at)
VALUES
    (
        'c1000000-0000-4000-8000-000000000001',
        'Building Scalable Edge APIs with Hono and Cloudflare Workers',
        'building-scalable-edge-apis-hono-cloudflare-workers',
        'Learn how to architect ultra-low latency RESTful services using Hono v4, Cloudflare D1 SQLite, and type-safe middleware.',
        'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800',
        1,
        1,
        '2024-01-01T00:00:00.000Z',
        1,
        '# Building Scalable Edge APIs with Hono and Cloudflare Workers

Edge computing has transformed how modern web APIs are designed and deployed. By moving computation closer to users around the globe, Cloudflare Workers eliminate cold starts and slash round-trip latency.

## Why Hono?

Hono is a lightweight, ultrafast web framework built on modern Web Standards (`Request`, `Response`, `fetch`). It provides:
- Zero dependencies with sub-millisecond overhead
- Type-safe route parameters and request body schemas with Zod
- First-class bindings for Cloudflare Workers (KV, D1, R2, AI)

## Database at the Edge with D1

Cloudflare D1 brings SQLite to edge workers with native replication and instant query execution.

```typescript
import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default app;
```

## Conclusion

Building on the edge offers unparalleled performance and simplified infrastructure maintenance.',
        '',
        NULL,
        '2024-01-01T00:00:00.000Z',
        '2024-01-01T00:00:00.000Z'
    ),
    (
        'c2000000-0000-4000-8000-000000000002',
        'Mastering TypeScript Strict Mode in Production',
        'mastering-typescript-strict-mode-production',
        'Best practices for writing bulletproof TypeScript code with strict null checks, discriminated unions, and utility types.',
        'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800',
        1,
        1,
        '2024-01-10T00:00:00.000Z',
        2,
        '# Mastering TypeScript Strict Mode in Production

TypeScript in strict mode turns subtle runtime pitfalls into early compile-time errors. Here are essential patterns for production codebases.

## Discriminated Unions

Use explicit type tags to model state machines cleanly:

```typescript
type ApiResponse<T> =
  | { status: "success"; data: T }
  | { status: "error"; message: string; code: number };
```

## Branded Types

Prevent parameter mixing with branded nominal primitives:

```typescript
type UserId = string & { readonly __brand: unique symbol };
```',
        '',
        NULL,
        '2024-01-10T00:00:00.000Z',
        '2024-01-10T00:00:00.000Z'
    ),
    (
        'c3000000-0000-4000-8000-000000000003',
        'Docker Compose for Modern Full-Stack Development',
        'docker-compose-full-stack-development',
        'Setting up reproducible, isolated multi-service development environments with live reload and database persistence.',
        'https://images.unsplash.com/photo-1605379399642-870262d3d051?w=800',
        1,
        1,
        '2024-01-20T00:00:00.000Z',
        3,
        '# Docker Compose for Modern Full-Stack Development

A streamlined local development workflow is key to engineering productivity. Docker Compose orchestrates containers so team members can run the entire backend and UI with a single command.

## Key Features

1. Volume persistence for SQLite and cache stores
2. Instant hot module reloading with source bind mounts
3. Parity between development and production setups',
        '',
        NULL,
        '2024-01-20T00:00:00.000Z',
        '2024-01-20T00:00:00.000Z'
    );

-- Article Authors
INSERT OR IGNORE INTO article_authors (article_id, author_id)
VALUES
    ('c1000000-0000-4000-8000-000000000001', 1),
    ('c2000000-0000-4000-8000-000000000002', 1),
    ('c3000000-0000-4000-8000-000000000003', 1);

-- Article Stats
INSERT OR IGNORE INTO article_stats (article_id, views, reading_mins)
VALUES
    ('c1000000-0000-4000-8000-000000000001', 1420, 5),
    ('c2000000-0000-4000-8000-000000000002', 890, 4),
    ('c3000000-0000-4000-8000-000000000003', 645, 6);

-- -----------------------------------------------------------------------------
-- 6. Projects & Project Details
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO projects (id, title, slug, description, thumbnail, published, languages, created_at, updated_at)
VALUES
    (
        'a1000000-0000-4000-8000-000000000001',
        'Portfolio API & Edge Gateway',
        'portfolio-api-edge-gateway',
        'High-performance RESTful API powering personal portfolio, blog, and project showcase built on Cloudflare Workers and Hono.',
        'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800',
        1,
        '["TypeScript", "SQL", "Shell"]',
        '2024-01-01T00:00:00.000Z',
        '2024-01-01T00:00:00.000Z'
    ),
    (
        'a2000000-0000-4000-8000-000000000002',
        'DevPulse - Edge Analytics Dashboard',
        'devpulse-analytics-dashboard',
        'Real-time developer metrics and application telemetry dashboard built with Next.js and Tailwind CSS.',
        'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
        1,
        '["TypeScript", "CSS"]',
        '2024-01-15T00:00:00.000Z',
        '2024-01-15T00:00:00.000Z'
    ),
    (
        'a3000000-0000-4000-8000-000000000003',
        'TaskFlow - Collaborative KanBan',
        'taskflow-kanban-board',
        'Modern drag-and-drop project management workspace designed for agile development teams.',
        'https://images.unsplash.com/photo-1618401471353-b98aedd04e11?w=800',
        1,
        '["TypeScript", "HTML"]',
        '2024-02-01T00:00:00.000Z',
        '2024-02-01T00:00:00.000Z'
    );

INSERT OR IGNORE INTO project_details (id, project_id, content, demo_url, repo_url, tech_stack, status, created_at, updated_at)
VALUES
    (
        'b1000000-0000-4000-8000-000000000001',
        'a1000000-0000-4000-8000-000000000001',
        '## Overview
A serverless edge API leveraging Cloudflare Workers, D1 database, and Hono v4. Features comprehensive role-based access control, article scheduling, full-text search, and AI assistant integration.',
        'https://api.pphat.me',
        'https://github.com/pphat/api.pphat.me',
        '["Cloudflare Workers", "Hono", "Cloudflare D1", "TypeScript", "Docker"]',
        'completed',
        '2024-01-01T00:00:00.000Z',
        '2024-01-01T00:00:00.000Z'
    ),
    (
        'b2000000-0000-4000-8000-000000000002',
        'a2000000-0000-4000-8000-000000000002',
        '## DevPulse
Aggregates API usage, endpoint health, and error rates in real-time with customizable widgets and export capabilities.',
        'https://devpulse.pphat.me',
        'https://github.com/pphat/devpulse',
        '["Next.js", "React", "Tailwind CSS", "TypeScript"]',
        'completed',
        '2024-01-15T00:00:00.000Z',
        '2024-01-15T00:00:00.000Z'
    ),
    (
        'b3000000-0000-4000-8000-000000000003',
        'a3000000-0000-4000-8000-000000000003',
        '## TaskFlow
Interactive task management system with real-time websocket synchronization, sprint tracking, and markdown comments.',
        'https://taskflow.pphat.me',
        'https://github.com/pphat/taskflow',
        '["React", "Node.js", "TypeScript", "Tailwind CSS"]',
        'in-progress',
        '2024-02-01T00:00:00.000Z',
        '2024-02-01T00:00:00.000Z'
    );

-- -----------------------------------------------------------------------------
-- 7. Tags (Article and Project scoped)
-- -----------------------------------------------------------------------------
-- Article Tags
INSERT OR IGNORE INTO tags (tag, article_id, description)
VALUES
    ('typescript', 'c1000000-0000-4000-8000-000000000001', 'TypeScript development articles'),
    ('cloudflare', 'c1000000-0000-4000-8000-000000000001', 'Cloudflare Workers and edge computing'),
    ('hono', 'c1000000-0000-4000-8000-000000000001', 'Hono framework and routing'),
    ('typescript', 'c2000000-0000-4000-8000-000000000002', 'Type-safety and compiler options'),
    ('architecture', 'c2000000-0000-4000-8000-000000000002', 'Software architecture principles'),
    ('docker', 'c3000000-0000-4000-8000-000000000003', 'Containerization and Compose'),
    ('devops', 'c3000000-0000-4000-8000-000000000003', 'Developer operations and tooling');

-- Project Tags
INSERT OR IGNORE INTO tags (tag, project_id, description)
VALUES
    ('api', 'a1000000-0000-4000-8000-000000000001', 'RESTful API service'),
    ('cloudflare', 'a1000000-0000-4000-8000-000000000001', 'Cloudflare Workers & D1'),
    ('dashboard', 'a2000000-0000-4000-8000-000000000002', 'Analytics and metrics UI'),
    ('react', 'a2000000-0000-4000-8000-000000000002', 'React components and hooks'),
    ('productivity', 'a3000000-0000-4000-8000-000000000003', 'Task and project management');
