import { env, exports } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import { seedDatabase, ARTICLE_SLUG, getAuthHeaders } from "../../apps/shared/helpers/test-cases";

const SELF = exports.default;
let authHeaders: Record<string, string>;

beforeAll(async () => {
	await seedDatabase(env.DB);
	authHeaders = await getAuthHeaders(env.JWT_SECRET);
});

describe("Article Reactions API", () => {
	/**
	 * GET /v1/api/articles/:slug/reactions
	 */
	describe("GET /v1/api/articles/:slug/reactions", () => {
		it("returns reaction list (public)", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/reactions`,
			);
			expect(res.status).toBe(200);
			const body = (await res.json()) as unknown[];
			expect(Array.isArray(body)).toBe(true);
		});

		it("returns 404 for non-existent article slug", async () => {
			const res = await SELF.fetch(
				"http://example.com/v1/api/articles/non-existent/reactions",
			);
			expect(res.status).toBe(404);
		});
	});

	/**
	 * POST /v1/api/articles/:slug/reactions
	 */
	describe("POST /v1/api/articles/:slug/reactions", () => {
		it("without auth returns 401", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/reactions`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ type: "like" }),
				},
			);
			expect(res.status).toBe(401);
		});

		it("increments reaction and returns full reaction row", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/reactions`,
				{
					method: "POST",
					headers: authHeaders,
					body: JSON.stringify({ type: "like" }),
				},
			);
			expect(res.status).toBe(200);
			const body = (await res.json()) as Record<string, unknown>;
			expect(body).toHaveProperty("type", "like");
			expect(body).toHaveProperty("count");
			expect(typeof body.count).toBe("number");
		});

		it("with invalid type returns 422", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/reactions`,
				{
					method: "POST",
					headers: authHeaders,
					body: JSON.stringify({ type: "invalid-type" }),
				},
			);
			expect(res.status).toBe(422);
		});

		it("with missing type returns 422", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/reactions`,
				{
					method: "POST",
					headers: authHeaders,
					body: JSON.stringify({}),
				},
			);
			expect(res.status).toBe(422);
		});

		it("with invalid JSON body returns 400", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/reactions`,
				{
					method: "POST",
					headers: authHeaders,
					body: "not-json",
				},
			);
			expect(res.status).toBe(400);
		});
	});

	/**
	 * POST /v1/api/articles/:slug/reactions/:type
	 */
	describe("POST /v1/api/articles/:slug/reactions/:type", () => {
		it("increments a specific type", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/reactions/heart`,
				{ method: "POST", headers: authHeaders },
			);
			expect(res.status).toBe(200);
			const body = (await res.json()) as Record<string, unknown>;
			expect(body).toHaveProperty("type", "heart");
			expect(body).toHaveProperty("count");
		});

		it("returns 422 for invalid reaction type", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/reactions/nope`,
				{ method: "POST", headers: authHeaders },
			);
			expect(res.status).toBe(422);
		});
	});

	/**
	 * DELETE /v1/api/articles/:slug/reactions/:type
	 */
	describe("DELETE /v1/api/articles/:slug/reactions/:type", () => {
		it("decrements a reaction and reports removal status", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/reactions/like`,
				{ method: "DELETE", headers: authHeaders },
			);
			expect(res.status).toBe(200);
			const body = (await res.json()) as Record<string, unknown>;
			expect(body).toHaveProperty("type", "like");
			expect(body).toHaveProperty("removed");
			expect(typeof body.removed).toBe("boolean");
		});

		it("returns 422 for invalid reaction type", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/reactions/invalid-type`,
				{ method: "DELETE", headers: authHeaders },
			);
			expect(res.status).toBe(422);
		});
	});
});
