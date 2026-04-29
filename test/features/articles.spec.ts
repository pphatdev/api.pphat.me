import { env, exports } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import { seedDatabase, ARTICLE_SLUG, ARTICLE_ID, getAuthHeaders } from "../../apps/shared/helpers/test-cases";

const NONEXISTENT_UUID = "00000000-0000-4000-8000-000000000099";

const SELF = exports.default;
let authHeaders: Record<string, string>;

beforeAll(async () => {
	await seedDatabase(env.DB);
	authHeaders = await getAuthHeaders(env.JWT_SECRET);
});

describe("Articles API", () => {

	/**
	 * GET /v1/api/articles
	 */
	describe("GET /v1/api/articles", () => {
		it("returns paginated list", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles?page=1&limit=10");
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("data");
			expect(Array.isArray(body.data)).toBe(true);
			expect(body).toHaveProperty("pagination");
		});

		it("with search param filters results", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles?search=Test&page=1&limit=10");
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("data");
		});

		it("excludes content field from list results", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles?page=1&limit=10");
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
});
