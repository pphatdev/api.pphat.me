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
	 * GET /v1/api/articles/:slug/stats
	 */
	describe("GET /v1/api/articles/:slug/stats", () => {
		it("returns stats", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_SLUG}/stats`);
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("views");
			expect(body).toHaveProperty("readingMins");
		});

		it("returns 404 for non-existent article", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles/non-existent/stats");
			expect(res.status).toBe(404);
		});
	});

	/**
	 * POST /v1/api/articles/:slug/stats/view
	 */
	describe("POST /v1/api/articles/:slug/stats/view", () => {
		it("increments view count", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/stats/view`,
				{ method: "POST", headers: authHeaders }
			);
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("views");
			expect(typeof body.views).toBe("number");
		});
	});

	/**
	 * GET /v1/api/articles/:slug/reactions
	 */
	describe("GET /v1/api/articles/:slug/reactions", () => {
		it("returns reaction list", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_SLUG}/reactions`);
			expect(res.status).toBe(200);
			const body = await res.json() as unknown[];
			expect(Array.isArray(body)).toBe(true);
		});
	});

	/**
	 * POST /v1/api/articles/:slug/reactions
	 */
	describe("POST /v1/api/articles/:slug/reactions", () => {
		it("adds a reaction", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_SLUG}/reactions`, {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ type: "like" }),
			});
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("type", "like");
			expect(body).toHaveProperty("count");
		});

		it("with invalid type returns 422", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_SLUG}/reactions`, {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ type: "invalid-type" }),
			});
			expect(res.status).toBe(422);
		});

		it("with missing type returns 422", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_SLUG}/reactions`, {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({}),
			});
			expect(res.status).toBe(422);
		});
	});

	/**
	 * DELETE /v1/api/articles/:slug/reactions/:type
	 */
	describe("DELETE /v1/api/articles/:slug/reactions/:type", () => {
		it("decrements reaction", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/reactions/like`,
				{ method: "DELETE", headers: authHeaders }
			);
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("type", "like");
		});

		it("with invalid type returns 422", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/reactions/invalid-type`,
				{ method: "DELETE", headers: authHeaders }
			);
			expect(res.status).toBe(422);
		});
	});

	/**
	 * GET /v1/api/articles/:slug/comments
	 */
	describe("GET /v1/api/articles/:slug/comments", () => {
		it("returns paginated comments", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments?page=1&limit=10`
			);
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("data");
			expect(Array.isArray(body.data)).toBe(true);
			expect(body).toHaveProperty("pagination");
		});
	});

	/**
	 * POST /v1/api/articles/:slug/comments
	 */
	describe("POST /v1/api/articles/:slug/comments", () => {
		it("creates a comment (201)", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments`, {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ authorName: "John Doe", content: "Great article!" }),
			});
			expect(res.status).toBe(201);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("content", "Great article!");
			expect(body).toHaveProperty("id");
		});

		it("missing authorName returns 422", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments`, {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ content: "Missing author." }),
			});
			expect(res.status).toBe(422);
		});

		it("missing content returns 422", async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments`, {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ authorName: "John Doe" }),
			});
			expect(res.status).toBe(422);
		});
	});

	/**
	 * PATCH /v1/api/articles/:slug/comments/:id
	 */
	describe("PATCH /v1/api/articles/:slug/comments/:id", () => {
		it("updates a comment", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments/1`,
				{
					method: "PATCH",
					headers: authHeaders,
					body: JSON.stringify({ content: "Updated comment text." }),
				}
			);
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("content", "Updated comment text.");
		});

		it("returns 404 for non-existent comment", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments/999`,
				{
					method: "PATCH",
					headers: authHeaders,
					body: JSON.stringify({ content: "Updated." }),
				}
			);
			expect(res.status).toBe(404);
		});
	});

	/**
	 * DELETE /v1/api/articles/:slug/comments/:id
	 */
	describe("DELETE /v1/api/articles/:slug/comments/:id", () => {
		it("deletes a comment (204)", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments/1`,
				{ method: "DELETE", headers: authHeaders }
			);
			expect(res.status).toBe(204);
		});

		it("returns 404 for non-existent comment", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments/999`,
				{ method: "DELETE", headers: authHeaders }
			);
			expect(res.status).toBe(404);
		});

		it("returns 400 for invalid comment ID", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments/abc`,
				{ method: "DELETE", headers: authHeaders }
			);
			expect(res.status).toBe(400);
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
