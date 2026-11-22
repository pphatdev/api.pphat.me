-- Seed users
INSERT OR IGNORE INTO users (id, provider, provider_id, email, name, role)
VALUES ('test-user-id', 'email', 'test-user-id', 'test@example.com', 'Test User', 'admin');

-- The auth test helper (getAdminHeaders) signs JWTs with sub='admin-user-id' and
-- role='admin'. Any endpoint that writes rows with an FK back to users(id) needs
-- this user to exist, e.g. inserting articles with owner_id = 'admin-user-id'.
INSERT OR IGNORE INTO users (id, provider, provider_id, email, name, role)
VALUES ('admin-user-id', 'email', 'admin-user-id', 'admin@example.com', 'Admin User', 'admin');

-- Generic secondary user for tests that add a contributor / secondary actor.
INSERT OR IGNORE INTO users (id, provider, provider_id, email, name, role)
VALUES ('contributor-user-1', 'email', 'contributor-user-1', 'contrib@example.com', 'Contributor One', 'user');

-- Seed articles
INSERT OR IGNORE INTO articles (id, title, slug, description, thumbnail, published, is_public, content, file_path, owner_id, created_at, updated_at)
VALUES ('00000000-0000-4000-8000-000000000001', 'Test Article', 'test-article-slug', 'A test article description.', 'https://example.com/thumb.png', 1, 1, '# Hello World', '', 'test-user-id', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- Seed authors
INSERT OR IGNORE INTO authors (id, name, profile, url) 
VALUES (1, 'Test Author', 'Developer', 'https://example.com');

-- Seed author details
INSERT OR IGNORE INTO author_details (author_id, bio, avatar_url, social_links, status, created_at, updated_at) 
VALUES (1, 'A test author.', 'https://example.com/avatar.png', '[]', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- Seed article authors
INSERT OR IGNORE INTO article_authors (article_id, author_id) 
VALUES ('00000000-0000-4000-8000-000000000001', 1);

-- Seed article stats
INSERT OR IGNORE INTO article_stats (article_id, views, reading_mins) 
VALUES ('00000000-0000-4000-8000-000000000001', 10, 3);

-- Seed article reactions
INSERT OR IGNORE INTO article_reactions (article_id, type, count) 
VALUES ('00000000-0000-4000-8000-000000000001', 'like', 5);

-- Seed test users referenced by owner/ownership checks. Must be inserted
-- before article_comments (FK constraint via user_id) and before any seed row
-- that references users.id.
INSERT OR IGNORE INTO users (id, role, provider, provider_id, email, name, email_verified)
VALUES
    ('test-user-id', 'user', 'email', 'test@example.com', 'test@example.com', 'Test User', 1),
    ('admin-user-id', 'admin', 'email', 'admin@example.com', 'admin@example.com', 'Admin User', 1);

-- Seed article comments. user_id is populated so ownership checks succeed for
-- the test user; a NULL user_id is treated as legacy/admin-only.
INSERT OR IGNORE INTO article_comments (article_id, user_id, author_name, content, created_at, updated_at)
VALUES ('00000000-0000-4000-8000-000000000001', 'test-user-id', 'Test User', 'Great article!', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- Seed projects
INSERT OR IGNORE INTO projects (id, title, slug, description, thumbnail, published, created_at, updated_at, languages) 
VALUES ('00000000-0000-4000-8000-000000000002', 'Test Project', 'test-project-slug', 'A test project description.', 'https://example.com/proj-thumb.png', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', '["TypeScript"]');

-- Seed project details. The id column has a CHECK constraint requiring a UUID v4
-- pattern (see migrations/0008_create_project_details.sql), so a plain 'pd-001'
-- would be silently rejected under INSERT OR IGNORE.
INSERT OR IGNORE INTO project_details (id, project_id, content, demo_url, repo_url, tech_stack, status, created_at, updated_at)
VALUES ('00000000-0000-4000-8000-0000000000d0', '00000000-0000-4000-8000-000000000002', '# Project content', 'https://demo.example.com', 'https://github.com/example/project', '["TypeScript"]', 'in-progress', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- Seed tags
INSERT OR IGNORE INTO tags (tag, article_id, description) 
VALUES ('javascript', '00000000-0000-4000-8000-000000000001', 'Articles about JavaScript.');

INSERT OR IGNORE INTO tags (tag, project_id, description) 
VALUES ('typescript', '00000000-0000-4000-8000-000000000002', 'Projects using TypeScript.');

-- Seed FAQs
INSERT OR IGNORE INTO faqs (id, question, slug, answer, category, sort_order, status, article_id, created_at, updated_at)
VALUES (1, 'What is api.pphat.me?', 'what-is-api-pphat-me', '# What is api.pphat.me?\n\nIt is a high-performance portfolio and blog API built with Cloudflare Workers and Hono.js.', 'General', 1, 1, '00000000-0000-4000-8000-000000000001', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- Seed About Me
INSERT OR IGNORE INTO about_me (
    id, badge, title, description, button_text, button_url, images,
    name, nickname, role, location, sort_order, status, created_at, updated_at
) VALUES (
    1,
    'About me!',
    'Who the hell am I ?',
    'My name is Leat Sophat, my relegien name is LEAT Sophat, and I''m known online as PPhat. I''m a Senior Front-end Developer at TURBOTECH CO., LTD, and as a Freelance UI/UX Designer. I''m from Phnom Penh, Cambodia.
I started my career as a Front-end Developer in 2021, and I have a passion for creating beautiful and functional user interfaces. I love to learn new technologies and improve my skills every day. I am also a big fan of open-source projects and I enjoy contributing to the community. I believe that sharing knowledge is the key to success in this field.',
    'Gallery',
    'https://pphat.me/gallery',
    '["https://example.com/about-1.jpg","https://example.com/about-2.jpg","https://example.com/about-3.jpg"]',
    'Leat Sophat',
    'PPhat',
    'Senior Front-end Developer',
    'Phnom Penh, Cambodia',
    0,
    1,
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z'
);

-- Seed Gallery Items
INSERT OR IGNORE INTO gallery (
    id, title, caption, alt_text, media_path, category, tags,
    is_public, is_featured, sort_order, aspect_ratio, created_at, updated_at
) VALUES 
(
    1,
    'Phnom Penh Skyline Dusk',
    'Sunset panorama over the Mekong river and urban landscape of Phnom Penh.',
    'Phnom Penh skyline at twilight',
    'blogs/media/cover-phnom-penh.webp',
    'photography',
    '["cambodia", "cityscape", "sunset"]',
    1,
    1,
    1,
    '16/9',
    '2026-11-20T10:00:00.000Z',
    '2026-11-20T10:00:00.000Z'
),
(
    2,
    'Developer Workspace & Desk Setup',
    'Minimalist dual-monitor workstation with ambient warm lighting.',
    'Clean workstation desk setup',
    'blogs/media/workspace-setup.webp',
    'setup',
    '["workspace", "minimalism", "productivity"]',
    1,
    1,
    2,
    '16/9',
    '2026-11-21T08:30:00.000Z',
    '2026-11-21T08:30:00.000Z'
),
(
    3,
    'Admin Console Design System',
    'Color tokens, typography scale, and dark mode interface elements.',
    'Design system components preview',
    'blogs/media/design-system-preview.webp',
    'design',
    '["design-system", "ui", "dark-mode"]',
    1,
    0,
    3,
    '4/3',
    '2026-11-21T12:00:00.000Z',
    '2026-11-21T12:00:00.000Z'
),
(
    4,
    'Cloudflare Edge Infrastructure',
    'Distributed network routing and edge worker latency benchmarks.',
    'Global edge network architecture map',
    'blogs/media/cloudflare-architecture.webp',
    'projects',
    '["cloud", "architecture", "edge"]',
    1,
    0,
    4,
    '16/9',
    '2026-11-22T09:15:00.000Z',
    '2026-11-22T09:15:00.000Z'
),
(
    5,
    'Khmer Typography & Font Pairings',
    'Exploring contemporary digital typefaces for Khmer and Latin scripts.',
    'Khmer typography specimen board',
    'blogs/media/khmer-typography-showcase.webp',
    'design',
    '["typography", "khmer", "branding"]',
    0,
    0,
    5,
    '1/1',
    '2026-11-22T14:20:00.000Z',
    '2026-11-22T14:20:00.000Z'
);


