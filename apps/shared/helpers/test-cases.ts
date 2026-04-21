export const ARTICLE_ID   = "00000000-0000-4000-8000-000000000001";
export const ARTICLE_SLUG = "test-article-slug";
export const PROJECT_ID   = "00000000-0000-4000-8000-000000000002";
export const PROJECT_SLUG = "test-project-slug";
export const TEST_USER_ID = "test-user-id";

/**
 * Generate a valid Bearer token header for auth-guarded routes.
 */
export async function getAuthHeaders(jwtSecret: string): Promise<Record<string, string>> {
	const { createJwt } = await import("../../modules/auth/auth.service");
	const token = await createJwt(
		{ sub: TEST_USER_ID, provider: "email", email: "test@example.com", name: "Test User", role: "user" },
		jwtSecret,
	);
	return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

/**
 * Creates all required tables and inserts seed data into the given D1 database.
 * Call this inside a `beforeAll` in each spec file.
 */
export async function seedDatabase(db: D1Database): Promise<void> {
	await db.batch([
		/**
		 * Schema
		*/
		db.prepare(`CREATE TABLE IF NOT EXISTS articles (
			id TEXT PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
			description TEXT NOT NULL, thumbnail TEXT NOT NULL DEFAULT '',
			published INTEGER NOT NULL DEFAULT 0, content TEXT NOT NULL DEFAULT '',
			file_path TEXT NOT NULL DEFAULT '', owner_id TEXT NULL,
			created_at TEXT NOT NULL, updated_at TEXT NOT NULL
		)`),
		db.prepare(`CREATE TABLE IF NOT EXISTS authors (
			id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
			profile TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '',
			user_id TEXT NULL
		)`),
		db.prepare(`CREATE TABLE IF NOT EXISTS author_details (
			id INTEGER PRIMARY KEY AUTOINCREMENT, author_id INTEGER NOT NULL UNIQUE,
			bio TEXT NOT NULL DEFAULT '', avatar_url TEXT NOT NULL DEFAULT '',
			social_links TEXT NOT NULL DEFAULT '', status INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL, updated_at TEXT NOT NULL
		)`),
		db.prepare(`CREATE TABLE IF NOT EXISTS article_authors (
			article_id TEXT NOT NULL, author_id INTEGER NOT NULL,
			PRIMARY KEY (article_id, author_id)
		)`),
		db.prepare(`CREATE TABLE IF NOT EXISTS article_stats (
			article_id TEXT PRIMARY KEY, views INTEGER NOT NULL DEFAULT 0,
			reading_mins INTEGER NOT NULL DEFAULT 0
		)`),
		db.prepare(`CREATE TABLE IF NOT EXISTS article_reactions (
			id INTEGER PRIMARY KEY AUTOINCREMENT, article_id TEXT NOT NULL,
			type TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
			UNIQUE (article_id, type)
		)`),
		db.prepare(`CREATE TABLE IF NOT EXISTS article_comments (
			id INTEGER PRIMARY KEY AUTOINCREMENT, article_id TEXT NOT NULL,
			author_name TEXT NOT NULL, content TEXT NOT NULL,
			created_at TEXT NOT NULL, updated_at TEXT NOT NULL
		)`),
		db.prepare(`CREATE TABLE IF NOT EXISTS projects (
			id TEXT PRIMARY KEY, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
			description TEXT NOT NULL, thumbnail TEXT NOT NULL DEFAULT '',
			published INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL, languages TEXT NOT NULL DEFAULT '[]'
		)`),
		db.prepare(`CREATE TABLE IF NOT EXISTS project_details (
			id TEXT PRIMARY KEY, project_id TEXT NOT NULL UNIQUE,
			content TEXT NOT NULL DEFAULT '', demo_url TEXT NOT NULL DEFAULT '',
			repo_url TEXT NOT NULL DEFAULT '', tech_stack TEXT NOT NULL DEFAULT '[]',
			status TEXT NOT NULL DEFAULT 'in-progress',
			created_at TEXT NOT NULL, updated_at TEXT NOT NULL
		)`),
		db.prepare(`CREATE TABLE IF NOT EXISTS project_contributors (
			project_id TEXT NOT NULL, author_id INTEGER NOT NULL,
			PRIMARY KEY (project_id, author_id)
		)`),
		db.prepare(`CREATE TABLE IF NOT EXISTS tags (
			id INTEGER PRIMARY KEY AUTOINCREMENT, tag TEXT NOT NULL,
			article_id TEXT NULL, project_id TEXT NULL,
			description TEXT NOT NULL DEFAULT ''
		)`),
		db.prepare(`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY, provider TEXT NOT NULL, provider_id TEXT NOT NULL,
			password_hash TEXT, email TEXT, name TEXT,
			email_verified INTEGER NOT NULL DEFAULT 0, avatar TEXT,
			role TEXT NOT NULL DEFAULT 'user',
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now')),
			UNIQUE(provider, provider_id)
		)`),
		db.prepare(`CREATE TABLE IF NOT EXISTS email_otps (
			id TEXT PRIMARY KEY, email TEXT NOT NULL, code TEXT NOT NULL,
			expires_at TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`),
		db.prepare(`CREATE TABLE IF NOT EXISTS article_contributors (
			article_id TEXT NOT NULL, user_id TEXT NOT NULL,
			PRIMARY KEY (article_id, user_id)
		)`),

		/**
		 * Seed data
		*/
		db.prepare(`INSERT OR IGNORE INTO articles
			(id, title, slug, description, thumbnail, published, content, file_path, owner_id, created_at, updated_at)
			VALUES (?1, 'Test Article', ?2, 'A test article description.',
				'https://example.com/thumb.png', 1, '# Hello World', '', ?3,
				'2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`)
			.bind(ARTICLE_ID, ARTICLE_SLUG, TEST_USER_ID),

		db.prepare(`INSERT OR IGNORE INTO authors (id, name, profile, url)
			VALUES (1, 'Test Author', 'Developer', 'https://example.com')`),

		db.prepare(`INSERT OR IGNORE INTO author_details
			(author_id, bio, avatar_url, social_links, status, created_at, updated_at)
			VALUES (1, 'A test author.', 'https://example.com/avatar.png', '[]', 1,
				'2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`),

		db.prepare(`INSERT OR IGNORE INTO article_authors (article_id, author_id)
			VALUES (?1, 1)`).bind(ARTICLE_ID),

		db.prepare(`INSERT OR IGNORE INTO article_stats (article_id, views, reading_mins)
			VALUES (?1, 10, 3)`).bind(ARTICLE_ID),

		db.prepare(`INSERT OR IGNORE INTO article_reactions (article_id, type, count)
			VALUES (?1, 'like', 5)`).bind(ARTICLE_ID),

		db.prepare(`INSERT OR IGNORE INTO article_comments
			(article_id, author_name, content, created_at, updated_at)
			VALUES (?1, 'Jane Doe', 'Great article!',
				'2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`)
			.bind(ARTICLE_ID),

		db.prepare(`INSERT OR IGNORE INTO projects
			(id, title, slug, description, thumbnail, published, created_at, updated_at, languages)
			VALUES (?1, 'Test Project', ?2, 'A test project description.',
				'https://example.com/proj-thumb.png', 1,
				'2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', '["TypeScript"]')`)
			.bind(PROJECT_ID, PROJECT_SLUG),

		db.prepare(`INSERT OR IGNORE INTO project_details
			(id, project_id, content, demo_url, repo_url, tech_stack, status, created_at, updated_at)
			VALUES ('pd-001', ?1, '# Project content', 'https://demo.example.com',
				'https://github.com/example/project', '["TypeScript"]', 'in-progress',
				'2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`)
			.bind(PROJECT_ID),

		db.prepare(`INSERT OR IGNORE INTO tags (tag, article_id, description)
			VALUES ('javascript', ?1, 'Articles about JavaScript.')`)
			.bind(ARTICLE_ID),

		db.prepare(`INSERT OR IGNORE INTO tags (tag, project_id, description)
			VALUES ('typescript', ?1, 'Projects using TypeScript.')`)
			.bind(PROJECT_ID),
	]);
}
