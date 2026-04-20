import { env, exports } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import { seedDatabase, ARTICLE_SLUG, getAuthHeaders } from "../../apps/shared/helpers/test-cases";

const SELF = exports.default;
let authHeaders: Record<string, string>;

beforeAll(async () => {
	await seedDatabase(env.DB);
	authHeaders = await getAuthHeaders(env.JWT_SECRET);
});

describe("Articles API", () => {
	describe("Core", () => {
		it("GET /v1/api/articles returns paginated list", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles?page=1&limit=10");
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("data");
			expect(Array.isArray(body.data)).toBe(true);
			expect(body).toHaveProperty("pagination");
		});

        it("POST /v1/api/articles with valid body creates article (201)", async () => {
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

		it("GET /v1/api/articles with search param filters results", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles?search=Test&page=1&limit=10");
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("data");
		});

		it("GET /v1/api/articles with sort and order params succeeds", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles?sort=created_at&order=desc");
			expect(res.status).toBe(200);
		});

		it(`GET /v1/api/articles/${ARTICLE_SLUG} returns article by slug`, async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_SLUG}`);
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("slug", ARTICLE_SLUG);
			expect(body).toHaveProperty("title");
		});

		it("GET /v1/api/articles/non-existent-slug returns 404", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles/non-existent-slug");
			expect(res.status).toBe(404);
		});


		it("POST /v1/api/articles with missing required fields returns 422", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles", {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ title: "No Slug Article" }),
			});
			expect(res.status).toBe(422);
		});

		it("POST /v1/api/articles with duplicate slug returns 409", async () => {
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

		it("POST /v1/api/articles with invalid JSON returns 400", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles", {
				method: "POST",
				headers: authHeaders,
				body: "not-json",
			});
			expect(res.status).toBe(400);
		});

		it(`PATCH /v1/api/articles/${ARTICLE_SLUG} updates the article`, async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_SLUG}`, {
				method: "PATCH",
				headers: authHeaders,
				body: JSON.stringify({ description: "Updated description." }),
			});
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("slug", ARTICLE_SLUG);
		});

		it("PATCH /v1/api/articles/non-existent returns 404", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles/non-existent", {
				method: "PATCH",
				headers: authHeaders,
				body: JSON.stringify({ description: "Updated." }),
			});
			expect(res.status).toBe(404);
		});

		it("DELETE /v1/api/articles/new-test-article deletes article (204)", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles/new-test-article", {
				method: "DELETE",
                headers: authHeaders,
			});
			expect(res.status).toBe(204);
		});

		it("DELETE /v1/api/articles/non-existent returns 404", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles/non-existent", {
				method: "DELETE",
                headers: authHeaders
			});
			expect(res.status).toBe(404);
		});
	});

	describe("Stats", () => {
		it(`GET /v1/api/articles/${ARTICLE_SLUG}/stats returns stats`, async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_SLUG}/stats`);
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("views");
			expect(body).toHaveProperty("readingMins");
		});

		it("GET /v1/api/articles/non-existent/stats returns 404", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/articles/non-existent/stats");
			expect(res.status).toBe(404);
		});

		it(`POST /v1/api/articles/${ARTICLE_SLUG}/stats/view increments view count`, async () => {
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

	describe("Reactions", () => {
		it(`GET /v1/api/articles/${ARTICLE_SLUG}/reactions returns reaction list`, async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_SLUG}/reactions`);
			expect(res.status).toBe(200);
			const body = await res.json() as unknown[];
			expect(Array.isArray(body)).toBe(true);
		});

		it(`POST /v1/api/articles/${ARTICLE_SLUG}/reactions adds a reaction`, async () => {
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

		it(`POST /v1/api/articles/${ARTICLE_SLUG}/reactions with invalid type returns 422`, async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_SLUG}/reactions`, {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ type: "invalid-type" }),
			});
			expect(res.status).toBe(422);
		});

		it(`POST /v1/api/articles/${ARTICLE_SLUG}/reactions with missing type returns 422`, async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_SLUG}/reactions`, {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({}),
			});
			expect(res.status).toBe(422);
		});

		it(`DELETE /v1/api/articles/${ARTICLE_SLUG}/reactions/like decrements reaction`, async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/reactions/like`,
				{ method: "DELETE", headers: authHeaders }
			);
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("type", "like");
		});

		it(`DELETE /v1/api/articles/${ARTICLE_SLUG}/reactions/invalid-type returns 422`, async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/reactions/invalid-type`,
				{ method: "DELETE", headers: authHeaders }
			);
			expect(res.status).toBe(422);
		});
	});

	describe("Comments", () => {
		it(`GET /v1/api/articles/${ARTICLE_SLUG}/comments returns paginated comments`, async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments?page=1&limit=10`
			);
			expect(res.status).toBe(200);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("data");
			expect(Array.isArray(body.data)).toBe(true);
			expect(body).toHaveProperty("pagination");
		});

		it(`POST /v1/api/articles/${ARTICLE_SLUG}/comments creates a comment (201)`, async () => {
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

		it(`POST /v1/api/articles/${ARTICLE_SLUG}/comments missing authorName returns 422`, async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments`, {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ content: "Missing author." }),
			});
			expect(res.status).toBe(422);
		});

		it(`POST /v1/api/articles/${ARTICLE_SLUG}/comments missing content returns 422`, async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments`, {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ authorName: "John Doe" }),
			});
			expect(res.status).toBe(422);
		});

		it(`PATCH /v1/api/articles/${ARTICLE_SLUG}/comments/1 updates a comment`, async () => {
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

		it(`PATCH /v1/api/articles/${ARTICLE_SLUG}/comments/999 returns 404`, async () => {
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

		it(`DELETE /v1/api/articles/${ARTICLE_SLUG}/comments/1 deletes a comment (204)`, async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments/1`,
				{ method: "DELETE", headers: authHeaders }
			);
			expect(res.status).toBe(204);
		});

		it(`DELETE /v1/api/articles/${ARTICLE_SLUG}/comments/999 returns 404`, async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments/999`,
				{ method: "DELETE", headers: authHeaders }
			);
			expect(res.status).toBe(404);
		});

		it(`DELETE /v1/api/articles/${ARTICLE_SLUG}/comments/invalid-id returns 400`, async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments/abc`,
				{ method: "DELETE", headers: authHeaders }
			);
			expect(res.status).toBe(400);
		});
	});

	describe("Tags (by Article)", () => {
		it(`GET /v1/api/articles/${ARTICLE_SLUG}/tags returns tags for article`, async () => {
			const res = await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_SLUG}/tags`);
			expect(res.status).toBe(200);
			const body = await res.json() as unknown[];
			expect(Array.isArray(body)).toBe(true);
		});
	});
});
