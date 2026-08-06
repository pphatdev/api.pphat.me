import { env, exports } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { getAuthHeaders, seedDatabase, ARTICLE_SLUG, ARTICLE_ID } from "../../apps/shared/helpers/test-cases";
import { createJwt } from "../../apps/modules/auth/auth.service";

const SELF = exports.default;
let authHeaders: Record<string, string>;
let secondUserHeaders: Record<string, string>;

beforeAll(async () => {
	await seedDatabase(env.DB);
	authHeaders = await getAuthHeaders(env.JWT_SECRET);
	// A second user for the "different users → separate votes" scenarios.
	const token = await createJwt(
		{ sub: "contributor-user-1", provider: "email", email: "contrib@example.com", name: "Contributor One", role: "user" },
		env.JWT_SECRET,
	);
	secondUserHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
});

describe("Reaction anti-inflation (#25)", () => {
	it("second click by the same user does not double-count", async () => {
		// Start from a clean slate for this article/type.
		await env.DB.prepare(
			"DELETE FROM article_reaction_user WHERE article_id = ?1 AND type = ?2",
		).bind(ARTICLE_ID, "fire").run();
		await env.DB.prepare(
			"DELETE FROM article_reactions WHERE article_id = ?1 AND type = ?2",
		).bind(ARTICLE_ID, "fire").run();

		const first = await SELF.fetch(
			`http://example.com/v1/api/articles/${ARTICLE_SLUG}/reactions/fire`,
			{ method: "POST", headers: authHeaders },
		);
		expect(first.status).toBe(200);
		const firstBody = (await first.json()) as { count: number };
		expect(firstBody.count).toBe(1);

		const second = await SELF.fetch(
			`http://example.com/v1/api/articles/${ARTICLE_SLUG}/reactions/fire`,
			{ method: "POST", headers: authHeaders },
		);
		expect(second.status).toBe(200);
		const secondBody = (await second.json()) as { count: number };
		// SAME user, SAME article, SAME type → count must not move.
		expect(secondBody.count).toBe(1);
	});

	it("a second user reacting the same way advances the count", async () => {
		await env.DB.prepare(
			"DELETE FROM article_reaction_user WHERE article_id = ?1 AND type = ?2",
		).bind(ARTICLE_ID, "clap").run();
		await env.DB.prepare(
			"DELETE FROM article_reactions WHERE article_id = ?1 AND type = ?2",
		).bind(ARTICLE_ID, "clap").run();

		await SELF.fetch(
			`http://example.com/v1/api/articles/${ARTICLE_SLUG}/reactions/clap`,
			{ method: "POST", headers: authHeaders },
		);
		const res = await SELF.fetch(
			`http://example.com/v1/api/articles/${ARTICLE_SLUG}/reactions/clap`,
			{ method: "POST", headers: secondUserHeaders },
		);
		const body = (await res.json()) as { count: number };
		expect(body.count).toBe(2);
	});

	it("DELETE by a user who never voted is a no-op (does not underflow)", async () => {
		await env.DB.prepare(
			"DELETE FROM article_reaction_user WHERE article_id = ?1 AND type = ?2",
		).bind(ARTICLE_ID, "wow").run();
		await env.DB.prepare(
			"INSERT OR REPLACE INTO article_reactions (article_id, type, count) VALUES (?1, ?2, 5)",
		).bind(ARTICLE_ID, "wow").run();

		const res = await SELF.fetch(
			`http://example.com/v1/api/articles/${ARTICLE_SLUG}/reactions/wow`,
			{ method: "DELETE", headers: authHeaders },
		);
		expect(res.status).toBe(200);
		const row = await env.DB.prepare(
			"SELECT count FROM article_reactions WHERE article_id = ?1 AND type = ?2",
		).bind(ARTICLE_ID, "wow").first<{ count: number }>();
		expect(row?.count).toBe(5);
	});
});

describe("View anti-inflation (#25)", () => {
	it("second view by the same user on the same day does not double-count", async () => {
		// Reset both the aggregate and today's marker for this article.
		await env.DB.prepare(
			"DELETE FROM article_view_event WHERE article_id = ?1",
		).bind(ARTICLE_ID).run();
		await env.DB.prepare(
			"INSERT OR REPLACE INTO article_stats (article_id, views, reading_mins) VALUES (?1, 0, 0)",
		).bind(ARTICLE_ID).run();

		const first = await SELF.fetch(
			`http://example.com/v1/api/articles/${ARTICLE_SLUG}/stats/view`,
			{ method: "POST", headers: authHeaders },
		);
		expect(first.status).toBe(200);
		const firstBody = (await first.json()) as { views: number };
		expect(firstBody.views).toBe(1);

		const second = await SELF.fetch(
			`http://example.com/v1/api/articles/${ARTICLE_SLUG}/stats/view`,
			{ method: "POST", headers: authHeaders },
		);
		expect(second.status).toBe(200);
		const secondBody = (await second.json()) as { views: number };
		expect(secondBody.views).toBe(1);
	});

	it("a different user viewing the same article advances the count", async () => {
		await env.DB.prepare(
			"DELETE FROM article_view_event WHERE article_id = ?1",
		).bind(ARTICLE_ID).run();
		await env.DB.prepare(
			"INSERT OR REPLACE INTO article_stats (article_id, views, reading_mins) VALUES (?1, 0, 0)",
		).bind(ARTICLE_ID).run();

		await SELF.fetch(
			`http://example.com/v1/api/articles/${ARTICLE_SLUG}/stats/view`,
			{ method: "POST", headers: authHeaders },
		);
		const res = await SELF.fetch(
			`http://example.com/v1/api/articles/${ARTICLE_SLUG}/stats/view`,
			{ method: "POST", headers: secondUserHeaders },
		);
		const body = (await res.json()) as { views: number };
		expect(body.views).toBe(2);
	});
});

describe("Request body size cap (#27)", () => {
	it("rejects a POST with Content-Length above the 100 KB cap (413)", async () => {
		// Build a 101 KB JSON body and set an explicit Content-Length so the
		// middleware can trip on the header alone (no body parsing needed).
		const huge = "x".repeat(101 * 1024);
		const payload = JSON.stringify({ blob: huge });
		const res = await SELF.fetch("http://example.com/v1/api/contact", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Content-Length": String(payload.length),
			},
			body: payload,
		});
		expect(res.status).toBe(413);
		const body = (await res.json()) as { error: string };
		expect(body.error).toMatch(/exceeds/i);
	});

	it("a normal-sized POST is unaffected", async () => {
		const res = await SELF.fetch("http://example.com/v1/api/contact", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Body Cap OK",
				email: "cap@example.com",
				message: "Well within the 100 KB body-size limit.",
			}),
		});
		expect([201, 400, 422]).toContain(res.status);
		// The middleware must not be responsible for whatever status we see.
		expect(res.status).not.toBe(413);
	});
});
