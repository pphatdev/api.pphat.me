-- Seed users
INSERT OR IGNORE INTO users (id, provider, provider_id, email, name, role) 
VALUES ('test-user-id', 'email', 'test-user-id', 'test@example.com', 'Test User', 'user');

-- Seed articles
INSERT OR IGNORE INTO articles (id, title, slug, description, thumbnail, published, content, file_path, owner_id, created_at, updated_at) 
VALUES ('00000000-0000-4000-8000-000000000001', 'Test Article', 'test-article-slug', 'A test article description.', 'https://example.com/thumb.png', 1, '# Hello World', '', 'test-user-id', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

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

-- Seed article comments
INSERT OR IGNORE INTO article_comments (article_id, author_name, content, created_at, updated_at) 
VALUES ('00000000-0000-4000-8000-000000000001', 'Jane Doe', 'Great article!', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- Seed projects
INSERT OR IGNORE INTO projects (id, title, slug, description, thumbnail, published, created_at, updated_at, languages) 
VALUES ('00000000-0000-4000-8000-000000000002', 'Test Project', 'test-project-slug', 'A test project description.', 'https://example.com/proj-thumb.png', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', '["TypeScript"]');

-- Seed project details
INSERT OR IGNORE INTO project_details (id, project_id, content, demo_url, repo_url, tech_stack, status, created_at, updated_at) 
VALUES ('pd-001', '00000000-0000-4000-8000-000000000002', '# Project content', 'https://demo.example.com', 'https://github.com/example/project', '["TypeScript"]', 'in-progress', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- Seed tags
INSERT OR IGNORE INTO tags (tag, article_id, description) 
VALUES ('javascript', '00000000-0000-4000-8000-000000000001', 'Articles about JavaScript.');

INSERT OR IGNORE INTO tags (tag, project_id, description) 
VALUES ('typescript', '00000000-0000-4000-8000-000000000002', 'Projects using TypeScript.');
