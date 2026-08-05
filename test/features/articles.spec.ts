import { env, exports } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import { seedDatabase, ARTICLE_SLUG, ARTICLE_ID, getAuthHeaders, getAdminHeaders } from "../../apps/shared/helpers/test-cases";

const NONEXISTENT_UUID = "00000000-0000-4000-8000-000000000099";

const SELF = exports.default;
let authHeaders: Record<string, string>;
let adminHeaders: Record<string, string>;

beforeAll(async () => {
	await seedDatabase(env.DB);
	authHeaders = await getAuthHeaders(env.JWT_SECRET);
	adminHeaders = await getAdminHeaders(env.JWT_SECRET);
});

describe("Articles API", () => {

	/**
	 * GET /v1/api/articles
	 */
	describe("GET /v1/api/articles", () => {
		it("without auth returns 401", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles?page=1&limit=10");
			expect(res.status).toBe(401);
		});

		it("returns paginated list", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles?page=1&limit=10", { headers: authHeaders });
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("data");
			expect(Array.isArray(body.data)).toBe(true);
			expect(body).toHaveProperty("pagination");
		});

		it("with search param filters results", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles?search=Test&page=1&limit=10", { headers: authHeaders });
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("data");
		});

		it("excludes content field from list results", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles?page=1&limit=10", { headers: authHeaders });
			expect(res.status).toBe(200);
			const body = await res.json() as { data: any[] };
			expect(body.data.length).toBeGreaterThan(0);
			body.data.forEach(article => {
				expect(article).not.toHaveProperty("content");
			});
		});
	});

	/**
	 * POST /v1/api/articles
	 */
	describe("POST /v1/api/articles", () => {
		it("with valid body creates article (201)", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles", {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({
					title: "New Test Article",
					slug: "new-test-article",
					description: "A newly created article.",
					thumbnail: "https://example.com/new-thumb.png",
					content: "# New content",
					published: false,
					author_ids: [1],
					tag_ids: [],
				}),
			});
			expect(res.status).toBe(201);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("slug", "new-test-article");
		});

		it("with missing required fields returns 422", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles", {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ title: "No Slug Article" }),
			});
			expect(res.status).toBe(422);
		});

		it("with duplicate slug returns 409", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles", {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({
					title: "Duplicate Slug",
					slug: ARTICLE_SLUG,
					description: "Duplicate.",
				}),
			});
			expect(res.status).toBe(409);
		});

		it("with invalid JSON returns 400", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles", {
				method: "POST",
				headers: authHeaders,
				body: "not-json",
			});
			expect(res.status).toBe(400);
		});
	});

	/**
	 * GET /v1/api/articles/:slug
	 */
	describe("GET /v1/api/articles/:slug", () => {
		it("returns article by slug", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_SLUG}`);
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body.data).toHaveProperty("slug", ARTICLE_SLUG);
			expect(body.data).toHaveProperty("title");
			expect(body.data).toHaveProperty("content");
		});

		it("includes navigation next/prev URLs in response", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_SLUG}`);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("navigation");
			expect(body.navigation).toHaveProperty("next");
			expect(body.navigation).toHaveProperty("prev");
		});

		it("returns 404 for non-existent slug", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles/non-existent-slug");
			expect(res.status).toBe(404);
		});
	});

	/**
	 * PUT|PATCH /v1/api/articles/:id
	 */
	describe("PATCH /v1/api/articles/:id", () => {
		it("updates the article", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_ID}`, {
				method: "PATCH",
				headers: authHeaders,
				body: JSON.stringify({ description: "Updated description." }),
			});
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("slug", ARTICLE_SLUG);
		});

		it("returns 400 for invalid UUID", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles/non-existent", {
				method: "PATCH",
				headers: authHeaders,
				body: JSON.stringify({ description: "Updated." }),
			});
			expect(res.status).toBe(400);
		});

		it("returns 404 for non-existent UUID", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${NONEXISTENT_UUID}`, {
				method: "PATCH",
				headers: authHeaders,
				body: JSON.stringify({ description: "Updated." }),
			});
			expect(res.status).toBe(404);
		});
	});

	/**
	 * DELETE /v1/api/articles/:id
	 */
	describe("DELETE /v1/api/articles/:id", () => {
		it("deletes article by UUID (204)", async () => {
			const createRes = await SELF.fetch("http://example.com/v1/api/articles", {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({
					title: "To Delete",
					slug: "to-delete-article",
					description: "Will be deleted.",
				}),
			});
			expect(createRes.status).toBe(201);
			const created = await createRes.json() as Record<string, unknown>;
			const deleteRes = await SELF.fetch(`http://example.com/v1/api/articles/${created.id}`, {
				method: "DELETE",
				headers: authHeaders,
			});
			expect(deleteRes.status).toBe(204);
		});

		it("returns 400 for invalid UUID", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles/non-existent", {
				method: "DELETE",
				headers: authHeaders,
			});
			expect(res.status).toBe(400);
		});

		it("returns 404 for non-existent UUID", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${NONEXISTENT_UUID}`, {
				method: "DELETE",
				headers: authHeaders,
			});
			expect(res.status).toBe(404);
		});
	});

	/**
	 * GET /v1/api/articles/:slug/tags
	 */
	describe("GET /v1/api/articles/:slug/tags", () => {
		it("returns tags for article", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_SLUG}/tags`);
			expect(res.status).toBe(200);
			const body = await res.json() as unknown[];
			expect(Array.isArray(body)).toBe(true);
		});

		it("returns 404 for non-existent article slug", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles/non-existent/tags");
			expect(res.status).toBe(404);
		});
	});

	/**
	 * POST /v1/api/articles/:id/contributors
	 * DELETE /v1/api/articles/:id/contributors/me
	 */
	describe("Contributors", () => {
		it("owner can add a contributor", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_ID}/contributors`, {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ user_id: "contributor-user-1" }),
			});
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("message");
		});

		it("adding the same contributor twice is idempotent (still 200)", async () => {
			// Repo uses INSERT OR IGNORE, so duplicate adds succeed silently.
			// The controller's 409 branch is unreachable dead code today; if
			// that repo behavior ever changes, flip this expectation to 409.
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_ID}/contributors`, {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ user_id: "contributor-user-1" }),
			});
			expect(res.status).toBe(200);
		});

		it("missing user_id returns 422", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_ID}/contributors`, {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({}),
			});
			expect(res.status).toBe(422);
		});

		it("returns 400 for invalid UUID", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/not-a-uuid/contributors`, {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ user_id: "some-user" }),
			});
			expect(res.status).toBe(400);
		});

		it("non-owner non-admin cannot add contributors (403)", async () => {
			// Create an article owned by admin, then have the non-admin user try to add a contributor.
			const slug = `owned-by-admin-${Date.now()}`;
			const createRes = await SELF.fetch("http://example.com/v1/api/articles", {
				method: "POST",
				headers: adminHeaders,
				body: JSON.stringify({ title: "Admin Owned", slug, description: "Owned by admin." }),
			});
			expect(createRes.status).toBe(201);
			const created = await createRes.json() as { id: string };

			const res = await SELF.fetch(`http://example.com/v1/api/articles/${created.id}/contributors`, {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ user_id: "other-user" }),
			});
			expect(res.status).toBe(403);
		});

		it("returns 404 when adding contributor to non-existent article", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${NONEXISTENT_UUID}/contributors`, {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ user_id: "some-user" }),
			});
			expect(res.status).toBe(404);
		});

		it("contributor can remove themself (204)", async () => {
			// Seed a contributor row directly for the test user so DELETE /me finds a match.
			await env.DB.prepare(
				`INSERT OR IGNORE INTO article_contributors (article_id, user_id) VALUES (?1, ?2)`,
			).bind(ARTICLE_ID, "test-user-id").run();

			const res = await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_ID}/contributors/me`, {
				method: "DELETE",
				headers: authHeaders,
			});
			expect(res.status).toBe(204);
		});

		it("returns 404 when removing self and not a contributor", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${NONEXISTENT_UUID}/contributors/me`, {
				method: "DELETE",
				headers: authHeaders,
			});
			expect(res.status).toBe(404);
		});

		it("returns 400 for invalid UUID on remove-self", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/not-a-uuid/contributors/me`, {
				method: "DELETE",
				headers: authHeaders,
			});
			expect(res.status).toBe(400);
		});
	});

	/**
	 * Scheduling (publishAt / isPublic)
	 */
	describe("Scheduling", () => {
		it("with publishAt in the future creates a queued article (status=queue) hidden from non-admin list", async () => {
			const future = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // +1h UTC
			const slug = `scheduled-future-${Date.now()}`;
			const createRes = await SELF.fetch("http://example.com/v1/api/articles", {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({
					title: "Scheduled Future",
					slug,
					description: "Not yet public.",
					published: true,
					publishAt: future,
				}),
			});
			expect(createRes.status).toBe(201);
			const created = await createRes.json() as any;
			expect(created.isPublic).toBe(false);
			expect(created.publishAt).toMatch(/\+07:00$/);
			expect(created.status).toBe('queue');

			// Non-admin only sees public articles.
			const listRes = await SELF.fetch("http://example.com/v1/api/articles?limit=100", { headers: authHeaders });
			const list = await listRes.json() as { data: any[] };
			expect(list.data.find((a) => a.slug === slug)).toBeUndefined();
		});

		it("with publishAt in the past auto-promotes to public", async () => {
			const past = new Date(Date.now() - 60 * 1000).toISOString(); // 1 min ago
			const slug = `scheduled-past-${Date.now()}`;
			const res = await SELF.fetch("http://example.com/v1/api/articles", {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({
					title: "Scheduled Past",
					slug,
					description: "Already visible.",
					published: true,
					publishAt: past,
				}),
			});
			expect(res.status).toBe(201);
			const body = await res.json() as any;
			expect(body.isPublic).toBe(true);
		});

		it("accepts a bare Phnom_Penh local timestamp (YYYY-MM-DD HH:mm)", async () => {
			const y = new Date().getUTCFullYear() + 1;
			const slug = `scheduled-local-${Date.now()}`;
			const res = await SELF.fetch("http://example.com/v1/api/articles", {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({
					title: "Scheduled Local",
					slug,
					description: "Local time input.",
					published: true,
					publishAt: `${y}-06-15 09:30`,
				}),
			});
			expect(res.status).toBe(201);
			const body = await res.json() as any;
			expect(body.publishAt).toMatch(new RegExp(`^${y}-06-15T09:30:00\\+07:00$`));
		});

		it("rejects a malformed publishAt with 422", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles", {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({
					title: "Bad TS",
					slug: `bad-ts-${Date.now()}`,
					description: "Bad timestamp.",
					published: true,
					publishAt: "not-a-date",
				}),
			});
			expect(res.status).toBe(422);
		});

		it("admin sees the queued article; ?status=public still hides it", async () => {
			const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
			const slug = `admin-queue-${Date.now()}`;
			const createRes = await SELF.fetch("http://example.com/v1/api/articles", {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({
					title: "Admin Queue View",
					slug,
					description: "Queued for admin.",
					published: true,
					publishAt: future,
				}),
			});
			expect(createRes.status).toBe(201);

			// Admin, no filter → sees all including queued.
			const listAll = await (await SELF.fetch("http://example.com/v1/api/articles?limit=100", { headers: adminHeaders })).json() as { data: any[] };
			expect(listAll.data.find((a) => a.slug === slug)).toBeDefined();

			// Admin with ?status=public → queued article is hidden.
			const listPublic = await (await SELF.fetch("http://example.com/v1/api/articles?limit=100&status=public", { headers: adminHeaders })).json() as { data: any[] };
			expect(listPublic.data.find((a) => a.slug === slug)).toBeUndefined();

			// Admin with ?status=queue → queued article is visible.
			const listQueue = await (await SELF.fetch("http://example.com/v1/api/articles?limit=100&status=queue", { headers: adminHeaders })).json() as { data: any[] };
			const queueRow = listQueue.data.find((a) => a.slug === slug);
			expect(queueRow).toBeDefined();
			expect(queueRow!.status).toBe('queue');
		});

		it("admin ?status=draft returns only drafts (status=draft on each row)", async () => {
			const slug = `admin-draft-${Date.now()}`;
			await SELF.fetch("http://example.com/v1/api/articles", {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ title: "Draft Doc", slug, description: "Draft only.", published: false }),
			});

			const list = await (await SELF.fetch("http://example.com/v1/api/articles?limit=100&status=draft", { headers: adminHeaders })).json() as { data: any[] };
			expect(list.data.length).toBeGreaterThan(0);
			list.data.forEach((a) => expect(a.status).toBe('draft'));
			expect(list.data.find((a) => a.slug === slug)).toBeDefined();
		});

		it("non-admin passing ?status=draft is ignored (still only public rows)", async () => {
			const list = await (await SELF.fetch("http://example.com/v1/api/articles?limit=100&status=draft", { headers: authHeaders })).json() as { data: any[] };
			list.data.forEach((a) => expect(a.status).toBe('public'));
		});

		it("promotes scheduled articles when publish_at has elapsed (repo.promoteScheduled)", async () => {
			// Insert a scheduled article whose publish_at is already in the past.
			const past = new Date(Date.now() - 5 * 60 * 1000).toISOString();
			const slug = `promote-${Date.now()}`;
			await env.DB.prepare(
				`INSERT INTO articles (id, title, slug, description, thumbnail, content, file_path, published, is_public, publish_at, owner_id, created_at, updated_at)
				 VALUES (?1, ?2, ?3, ?4, '', '', '', 1, 0, ?5, 'test-user-id', datetime('now'), datetime('now'))`
			).bind(
				'00000000-0000-4000-8000-00000000abcd',
				'Promote Me',
				slug,
				'Ready to be promoted.',
				past,
			).run();

			const { ArticleRepository } = await import('../../apps/modules/articles/articles.repo');
			const promoted = await new ArticleRepository(env.DB).promoteScheduled();
			expect(promoted).toBeGreaterThan(0);

			const row = await env.DB.prepare('SELECT is_public FROM articles WHERE slug = ?1').bind(slug).first<{ is_public: number }>();
			expect(row?.is_public).toBe(1);
		});
	});
});
