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

	/**
	 * Anonymous readers (public blog): counted once per visitor per day.
	 */
	describe("POST /v1/api/articles/:slug/stats/view (anonymous)", () => {
		const BROWSER_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
		const view = (ip: string, ua = BROWSER_UA, slug = ARTICLE_SLUG) =>
			SELF.fetch(`http://example.com/v1/api/articles/${slug}/stats/view`, {
				method: "POST",
				headers: { "cf-connecting-ip": ip, "user-agent": ua },
			});

		beforeAll(async () => {
			await env.DB.prepare("DELETE FROM article_view_visitor").run();
		});

		it("counts a new anonymous reader without auth", async () => {
			const before = (await (await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_SLUG}/stats`)).json()) as { views: number };
			const res = await view("203.0.113.10");
			expect(res.status).toBe(200);
			const body = (await res.json()) as { views: number; counted: boolean };
			expect(body.counted).toBe(true);
			expect(body.views).toBe(before.views + 1);
		});

		it("does not double-count the same reader on the same day", async () => {
			const first = (await (await view("203.0.113.11")).json()) as { views: number; counted: boolean };
			const second = (await (await view("203.0.113.11")).json()) as { views: number; counted: boolean };
			expect(first.counted).toBe(true);
			expect(second.counted).toBe(false);
			expect(second.views).toBe(first.views);
		});

		it("counts a different reader separately", async () => {
			const a = (await (await view("203.0.113.12")).json()) as { views: number };
			const b = (await (await view("203.0.113.13")).json()) as { views: number; counted: boolean };
			expect(b.counted).toBe(true);
			expect(b.views).toBe(a.views + 1);
		});

		it("does not store the raw IP", async () => {
			const rows = await env.DB.prepare("SELECT visitor_hash FROM article_view_visitor").all<{ visitor_hash: string }>();
			expect(rows.results.length).toBeGreaterThan(0);
			for (const row of rows.results) {
				expect(row.visitor_hash).toMatch(/^[0-9a-f]{64}$/);
				expect(row.visitor_hash).not.toContain("203.0.113");
			}
		});

		it("ignores bots and requests without a user agent", async () => {
			const bot = (await (await view("203.0.113.20", "Googlebot/2.1 (+http://www.google.com/bot.html)")).json()) as { views: number; counted: boolean };
			expect(bot.counted).toBe(false);
			const noUa = await SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_SLUG}/stats/view`, {
				method: "POST",
				headers: { "cf-connecting-ip": "203.0.113.21", "user-agent": "" },
			});
			expect(((await noUa.json()) as { counted: boolean }).counted).toBe(false);
		});

		it("counts readers without a client IP (local dev) once per user agent per day", async () => {
			const send = () => SELF.fetch(`http://example.com/v1/api/articles/${ARTICLE_SLUG}/stats/view`, {
				method: "POST",
				headers: { "user-agent": `${BROWSER_UA} no-ip-test` },
			});
			const first = (await (await send()).json()) as { views: number; counted: boolean };
			const second = (await (await send()).json()) as { views: number; counted: boolean };
			expect(first.counted).toBe(true);
			expect(second.counted).toBe(false);
			expect(second.views).toBe(first.views);
		});

		it("returns 404 for unpublished articles", async () => {
			await env.DB.prepare(
				"INSERT OR IGNORE INTO articles (id, title, slug, description, thumbnail, published, is_public, content, file_path, owner_id, created_at, updated_at) VALUES ('00000000-0000-4000-8000-00000000d1af', 'Draft', 'stats-draft-slug', '', '', 0, 0, '', '', 'test-user-id', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')",
			).run();
			const res = await view("203.0.113.30", BROWSER_UA, "stats-draft-slug");
			expect(res.status).toBe(404);
		});

		it("returns 404 for unknown articles", async () => {
			const res = await view("203.0.113.31", BROWSER_UA, "non-existent");
			expect(res.status).toBe(404);
		});
	});
});
