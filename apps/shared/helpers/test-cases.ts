export const ARTICLE_ID = "00000000-0000-4000-8000-000000000001";
export const ARTICLE_SLUG = "test-article-slug";
export const PROJECT_SLUG = "test-project-slug";
const TEST_USER_ID = "test-user-id";

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
 * Generate a valid Admin Bearer token header for admin-only routes.
 */
export async function getAdminHeaders(jwtSecret: string): Promise<Record<string, string>> {
	const { createJwt } = await import("../../modules/auth/auth.service");
	const token = await createJwt(
		{ sub: "admin-user-id", provider: "email", email: "admin@example.com", name: "Admin User", role: "admin" },
		jwtSecret,
	);
	return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

/**
 * Creates all required tables and inserts seed data into the given D1 database.
 * Call this inside a `beforeAll` in each spec file.
 */
export async function seedDatabase(db: D1Database): Promise<void> {
	// Load and execute Migrations
	const migrations = (import.meta as any).glob('../../../migrations/*.sql', { query: '?raw', eager: true });
	await executeSqlGlob(db, migrations);

	// Load and execute Seeds
	const seeds = (import.meta as any).glob('../../../test/seeds/*.sql', { query: '?raw', eager: true });
	await executeSqlGlob(db, seeds);
}

/**
 * Helper to execute a glob of SQL files.
 */
async function executeSqlGlob(db: D1Database, glob: Record<string, any>): Promise<void> {
	const sortedKeys = Object.keys(glob).sort();

	for (const key of sortedKeys) {
		const sql = glob[key].default || glob[key];

		// Split by semicolon and strip comments to handle multiple statements
		const statements = sql
			.replace(/--.*$/gm, '') // Remove single-line comments
			.replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
			.split(";")
			.map((s: string) => s.trim())
			.filter((s: string) => s.length > 0);

		for (const stmt of statements) {
			await db.prepare(stmt).run();
		}
	}
}
