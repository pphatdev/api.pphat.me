import { env, exports } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import { seedDatabase, ARTICLE_SLUG, getAuthHeaders } from "../../apps/shared/helpers/test-cases";

const SELF = exports.default;
let authHeaders: Record<string, string>;

beforeAll(async () => {
	await seedDatabase(env.DB);
	authHeaders = await getAuthHeaders(env.JWT_SECRET);
});

describe("Article Stats API", () => {
	/**
	 * GET /v1/api/articles/:slug/stats
	 */
	describe("GET /v1/api/articles/:slug/stats", () => {
		it("returns stats (public)", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/stats`,
			);
			expect(res.status).toBe(200);
			const body = (await res.json()) as Record<string, unknown>;
			expect(body).toHaveProperty("views");
			expect(body).toHaveProperty("readingMins");
			expect(typeof body.views).toBe("number");
		});

		it("returns 404 for non-existent article", async () => {
			const res = await SELF.fetch(
				"http://example.com/v1/api/articles/non-existent/stats",
			);
			expect(res.status).toBe(404);
		});
	});

	/**
	 * POST /v1/api/articles/:slug/stats/view
	 */
	describe("POST /v1/api/articles/:slug/stats/view", () => {
		it("without auth returns 401", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/stats/view`,
				{ method: "POST" },
			);
			expect(res.status).toBe(401);
		});

		it("increments view count", async () => {
			const before = await (
				await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_SLUG}/stats`)
			).json() as { views: number };

			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/stats/view`,
				{ method: "POST", headers: authHeaders },
			);
			expect(res.status).toBe(200);
			const body = (await res.json()) as Record<string, unknown>;
			expect(body).toHaveProperty("views");
			expect(typeof body.views).toBe("number");
			expect(body.views as number).toBeGreaterThan(before.views);
		});
	});
});
