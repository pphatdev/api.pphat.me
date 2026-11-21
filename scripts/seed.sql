-- =============================================================================
-- Portfolio Seed Data for api.pphat.me
-- Entities: tech_stacks, skills, experiences, experience_tech_stacks,
--           articles, authors, author_details, article_authors, article_stats,
--           projects, project_details, tags
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tech Stacks
-- -----------------------------------------------------------------------------
INSERT INTO tech_stacks (id, name, description, url, logo_url, cover, status, created_at, updated_at)
VALUES
    (1, 'TypeScript', 'Typed superset of JavaScript that compiles to plain JavaScript.', 'https://www.typescriptlang.org', 'devicon-typescript-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (2, 'Cloudflare Workers', 'Serverless execution environment running on Cloudflare global edge network.', 'https://workers.cloudflare.com', 'devicon-cloudflare-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (3, 'Cloudflare D1', 'Serverless distributed SQLite database with zero-latency edge access.', 'https://developers.cloudflare.com/d1', 'devicon-sqlite-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (4, 'Hono', 'Fast, lightweight web framework built on Web Standards for Cloudflare Workers and the edge.', 'https://hono.dev', 'devicon-hono-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (5, 'React', 'The library for web and native user interfaces.', 'https://react.dev', 'devicon-react-original', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (6, 'Next.js', 'The React Framework for the Web with hybrid static & server rendering.', 'https://nextjs.org', 'devicon-nextjs-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (7, 'Node.js', 'Asynchronous event-driven JavaScript runtime environment.', 'https://nodejs.org', 'devicon-nodejs-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (8, 'PostgreSQL', 'Powerful, open-source object-relational database system.', 'https://www.postgresql.org', 'devicon-postgresql-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (9, 'Docker', 'Platform for developing, shipping, and running applications in isolated containers.', 'https://www.docker.com', 'devicon-docker-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (10, 'Tailwind CSS', 'Utility-first CSS framework for rapid UI and design system development.', 'https://tailwindcss.com', 'devicon-tailwindcss-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (11, 'Figma', 'Collaborative interface design and prototyping tool.', 'https://www.figma.com', 'devicon-figma-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (12, 'Laravel', 'Web application framework with expressive, elegant syntax for PHP.', 'https://laravel.com', 'devicon-laravel-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (13, 'Express.js', 'Fast, unopinionated, minimalist web framework for Node.js.', 'https://expressjs.com', 'devicon-express-original', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (14, 'MySQL', 'Widely adopted open-source relational database management system.', 'https://www.mysql.com', 'devicon-mysql-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (15, 'JavaScript', 'High-level, interpreted programming language conforming to the ECMAScript specification.', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript', 'devicon-javascript-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (16, 'jQuery', 'Fast, small, and feature-rich JavaScript library.', 'https://jquery.com', 'devicon-jquery-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (17, 'HTML', 'Standard markup language for documents designed to be displayed in a web browser.', 'https://developer.mozilla.org/en-US/docs/Web/HTML', 'devicon-html5-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (18, 'CSS', 'Style sheet language used for describing the presentation of a document.', 'https://developer.mozilla.org/en-US/docs/Web/CSS', 'devicon-css3-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (19, 'Sass', 'CSS extension language with variables, nested rules, and mixins.', 'https://sass-lang.com', 'devicon-sass-original', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (20, 'Bootstrap', 'Powerful, extensible, and feature-packed frontend toolkit.', 'https://getbootstrap.com', 'devicon-bootstrap-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (21, 'PHP', 'General-purpose scripting language especially suited to web development.', 'https://www.php.net', 'devicon-php-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (22, 'Ms.Word', 'Microsoft Word document processor for technical writing and reports.', 'https://www.microsoft.com/word', 'devicon-microsoft-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (23, 'Ms.Excel', 'Microsoft Excel spreadsheet tool for data modeling and calculations.', 'https://www.microsoft.com/excel', 'devicon-microsoft-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (24, 'Ms.Powerpoint', 'Microsoft PowerPoint presentation tool for slide decks and design assets.', 'https://www.microsoft.com/powerpoint', 'devicon-microsoft-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (25, 'Adobe XD', 'Vector-based design tool for web apps and mobile interfaces.', 'https://www.adobe.com/products/xd.html', 'devicon-xd-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (26, 'Nuxt.js', 'The Intuitive Vue Framework for full-stack web applications.', 'https://nuxt.com', 'devicon-nuxtjs-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (27, 'EJS', 'Embedded JavaScript templating engine for Node.js.', 'https://ejs.co', 'devicon-javascript-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (28, 'Vercel', 'Frontend cloud platform for developing, previewing, and shipping web apps.', 'https://vercel.com', 'devicon-vercel-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (29, 'Netlify', 'Cloud platform for building, deploying, and scaling modern web projects.', 'https://www.netlify.com', 'devicon-netlify-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (30, 'GitHub', 'Development platform for version control, collaboration, and CI/CD actions.', 'https://github.com', 'devicon-github-original', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (31, 'Ubuntu', 'Open-source Linux operating system for server infrastructure.', 'https://ubuntu.com', 'devicon-ubuntu-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (32, 'Nginx', 'High-performance HTTP server, reverse proxy, and load balancer.', 'https://nginx.org', 'devicon-nginx-original', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (33, 'C#', 'Modern, innovative, open-source programming language for .NET applications.', 'https://learn.microsoft.com/dotnet/csharp/', 'devicon-csharp-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (34, 'C++', 'High-performance general-purpose systems programming language.', 'https://isocpp.org', 'devicon-cplusplus-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (35, 'Python', 'Versatile programming language suited for scripting, backend, and data science.', 'https://www.python.org', 'devicon-python-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (36, 'Git', 'Distributed version control system for tracking source code changes.', 'https://git-scm.com', 'devicon-git-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (37, 'GitLab', 'DevOps platform delivering software development and source code management.', 'https://about.gitlab.com', 'devicon-gitlab-plain', NULL, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')
ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    description = excluded.description,
    url = excluded.url,
    logo_url = excluded.logo_url,
    status = excluded.status,
    updated_at = excluded.updated_at;

-- -----------------------------------------------------------------------------
-- 2. Skills (Linked to Tech Stacks)
-- -----------------------------------------------------------------------------
INSERT INTO skills (id, tech_stack_id, level, years_of_experience, description, sort_order, status, created_at, updated_at)
VALUES
    (1, 1, 'expert', 5.0, 'Type-safe architecture, generics, strict compiler configs, and library design.', 1, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (2, 2, 'advanced', 4.0, 'Serverless edge services, KV, D1, R2 storage, Queues, and Workers AI integration.', 2, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (3, 4, 'expert', 3.5, 'Modular routing, middleware pipelines, RPC client generation, and streaming responses.', 3, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (4, 5, 'expert', 5.0, 'Component architecture, custom hooks, performance tuning, and state management.', 4, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (5, 3, 'advanced', 3.0, 'Schema design, migration strategies, indexing, and SQLite query optimization.', 5, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (6, 6, 'advanced', 4.0, 'App router, server actions, SSR/SSG caching, and SEO optimization.', 6, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (7, 9, 'intermediate', 4.0, 'Multi-stage Dockerfiles, Docker Compose environments, and CI container workflows.', 7, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (8, 10, 'expert', 4.0, 'Responsive layouts, dark-mode styling, component abstraction, and animation.', 8, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (9, 11, 'advanced', 4.5, 'UI/UX prototyping, design systems, vector assets, and design-to-code handoff.', 9, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (10, 12, 'advanced', 4.0, 'Backend API development, Eloquent ORM, authentication, and MVC patterns.', 10, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (11, 7, 'advanced', 5.0, 'Backend services, async pipelines, REST APIs, and CLI tooling.', 11, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (12, 13, 'advanced', 4.0, 'Microservices, routing, middleware architecture, and HTTP security.', 12, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (13, 8, 'intermediate', 3.5, 'Relational database modeling, complex queries, indexing, and joins.', 13, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (14, 14, 'advanced', 4.0, 'Database normalization, transactions, query optimization, and backups.', 14, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'),
    (15, 15, 'expert', 6.0, 'Core modern JavaScript, DOM manipulation, asynchronous patterns, and ESNext.', 15, 1, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z')
ON CONFLICT(id) DO UPDATE SET
    tech_stack_id = excluded.tech_stack_id,
    level = excluded.level,
    years_of_experience = excluded.years_of_experience,
    description = excluded.description,
    sort_order = excluded.sort_order,
    status = excluded.status,
    updated_at = excluded.updated_at;

-- -----------------------------------------------------------------------------
-- 3. Experiences (TURBOTECH CO., LTD & Nintrea Labs)
-- -----------------------------------------------------------------------------
INSERT INTO experiences (id, title, company, description, start_date, end_date, location, employment_type, company_url, logo_url, cover, status, created_at, updated_at)
VALUES
    (
        1,
        'Senior Frontend Developer',
        'TURBOTECH CO., LTD',
        'Leading frontend architecture and web development across key enterprise platforms. Building modern responsive user interfaces with Next.js, React, and TypeScript. Integrating backend APIs built with Laravel, Node.js, and Express, with PostgreSQL and MySQL database management.',
        '2022-10-01',
        NULL,
        'Phnom Penh, Cambodia',
        'full-time',
        'https://turbotech.com.kh',
        '/images/companies/turbotech.png',
        NULL,
        1,
        '2022-10-01T00:00:00.000Z',
        '2024-01-01T00:00:00.000Z'
    ),
    (
        2,
        'Junior Frontend Developer',
        'TURBOTECH CO., LTD',
        'Developed client-facing web portals and UI components with modern HTML5, CSS3, Sass, Tailwind CSS, and Bootstrap. Built interactive dynamic features with JavaScript and jQuery, and integrated with PHP and Laravel backend services backed by MySQL.',
        '2020-10-01',
        '2022-10-01',
        'Phnom Penh, Cambodia',
        'full-time',
        'https://turbotech.com.kh',
        '/images/companies/turbotech.png',
        NULL,
        1,
        '2020-10-01T00:00:00.000Z',
        '2024-01-01T00:00:00.000Z'
    ),
    (
        3,
        'Content Writing Officer & UI/UX Designer',
        'TURBOTECH CO., LTD',
        'Created wireframes, interactive user interface prototypes, and UX flows using Figma and Adobe XD. Authored technical documentation, marketing content, and executive presentations with Microsoft Office suite (Word, Excel, PowerPoint).',
        '2019-11-01',
        '2020-10-01',
        'Phnom Penh, Cambodia',
        'full-time',
        'https://turbotech.com.kh',
        '/images/companies/turbotech.png',
        NULL,
        1,
        '2019-11-01T00:00:00.000Z',
        '2024-01-01T00:00:00.000Z'
    ),
    (
        4,
        'Creator & Developer of Nintrea',
        'Nintrea Labs',
        'Creator and lead engineer of Nintrea open-source projects, developer tools, and full-stack edge web applications. Architected distributed cloud infrastructure and web solutions using TypeScript, React, Next.js, Nuxt.js, Hono, Node.js, PHP, Laravel, and Cloudflare Workers, deployed on Ubuntu, Vercel, and Netlify.',
        '2021-01-01',
        NULL,
        'Phnom Penh, Cambodia',
        'freelance',
        'https://github.com/nintrea',
        '/images/companies/nintrea.png',
        NULL,
        1,
        '2021-01-01T00:00:00.000Z',
        '2024-01-01T00:00:00.000Z'
    )
ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    company = excluded.company,
    description = excluded.description,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    location = excluded.location,
    employment_type = excluded.employment_type,
    company_url = excluded.company_url,
    logo_url = excluded.logo_url,
    cover = excluded.cover,
    status = excluded.status,
    updated_at = excluded.updated_at;

-- Junction: Experiences to Tech Stacks
-- Experience 1: TURBOTECH - Senior Frontend Developer
INSERT OR IGNORE INTO experience_tech_stacks (experience_id, tech_stack_id)
VALUES
    (1, 11), -- Figma
    (1, 12), -- Laravel
    (1, 5),  -- React
    (1, 6),  -- Next.js
    (1, 10), -- Tailwind CSS
    (1, 1),  -- TypeScript
    (1, 7),  -- Node.js
    (1, 13), -- Express.js
    (1, 8),  -- PostgreSQL
    (1, 14); -- MySQL

-- Experience 2: TURBOTECH - Junior Frontend Developer
INSERT OR IGNORE INTO experience_tech_stacks (experience_id, tech_stack_id)
VALUES
    (2, 15), -- JavaScript
    (2, 16), -- jQuery
    (2, 17), -- HTML
    (2, 18), -- CSS
    (2, 19), -- Sass
    (2, 10), -- Tailwind CSS
    (2, 20), -- Bootstrap
    (2, 21), -- PHP
    (2, 14), -- MySQL
    (2, 12); -- Laravel

-- Experience 3: TURBOTECH - Content Writing Officer & UI/UX Designer
INSERT OR IGNORE INTO experience_tech_stacks (experience_id, tech_stack_id)
VALUES
    (3, 22), -- Ms.Word
    (3, 23), -- Ms.Excel
    (3, 24), -- Ms.Powerpoint
    (3, 11), -- Figma
    (3, 25); -- Adobe XD

-- Experience 4: Nintrea Labs - Creator & Developer of Nintrea
INSERT OR IGNORE INTO experience_tech_stacks (experience_id, tech_stack_id)
VALUES
    (4, 11), -- Figma
    (4, 17), -- HTML
    (4, 18), -- CSS
    (4, 15), -- JavaScript
    (4, 1),  -- TypeScript
    (4, 16), -- jQuery
    (4, 10), -- Tailwind CSS
    (4, 19), -- Sass
    (4, 20), -- Bootstrap
    (4, 5),  -- React
    (4, 6),  -- Next.js
    (4, 26), -- Nuxt.js
    (4, 27), -- EJS
    (4, 21), -- PHP
    (4, 12), -- Laravel
    (4, 7),  -- Node.js
    (4, 13), -- Express.js
    (4, 4),  -- Hono
    (4, 8),  -- PostgreSQL
    (4, 14), -- MySQL
    (4, 28), -- Vercel
    (4, 29), -- Netlify
    (4, 2),  -- Cloudflare Workers
    (4, 30), -- GitHub
    (4, 31), -- Ubuntu
    (4, 32), -- Nginx
    (4, 33), -- C#
    (4, 34), -- C++
    (4, 35), -- Python
    (4, 36), -- Git
    (4, 37); -- GitLab

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
