import { env, exports } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import { seedDatabase, ARTICLE_SLUG, getAuthHeaders, getAdminHeaders } from "../../apps/shared/helpers/test-cases";
import { createJwt } from "../../apps/modules/auth/auth.service";

const SELF = exports.default;
let authHeaders: Record<string, string>;
let adminHeaders: Record<string, string>;
let otherUserHeaders: Record<string, string>;

beforeAll(async () => {
	await seedDatabase(env.DB);
	authHeaders = await getAuthHeaders(env.JWT_SECRET);
	adminHeaders = await getAdminHeaders(env.JWT_SECRET);
	const otherToken = await createJwt(
		{ sub: "other-user-id", provider: "email", email: "other@example.com", name: "Other User", role: "user" },
		env.JWT_SECRET,
	);
	otherUserHeaders = { Authorization: `Bearer ${otherToken}`, "Content-Type": "application/json" };
});

describe("Article Comments API", () => {
	/**
	 * GET /v1/api/articles/:slug/comments
	 */
	describe("GET /v1/api/articles/:slug/comments", () => {
		it("returns paginated comments (public)", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments?page=1&limit=10`,
			);
			expect(res.status).toBe(200);
			const body = (await res.json()) as Record<string, unknown>;
			expect(body).toHaveProperty("data");
			expect(Array.isArray(body.data)).toBe(true);
			expect(body).toHaveProperty("pagination");
		});

		it("returns 404 for non-existent article slug", async () => {
			const res = await SELF.fetch(
				"http://example.com/v1/api/articles/non-existent/comments?page=1&limit=10",
			);
			expect(res.status).toBe(404);
		});
	});

	/**
	 * POST /v1/api/articles/:slug/comments
	 */
	describe("POST /v1/api/articles/:slug/comments", () => {
		it("without auth returns 401", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ authorName: "Anon", content: "Hi" }),
				},
			);
			expect(res.status).toBe(401);
		});

		it("creates a comment (201)", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments`,
				{
					method: "POST",
					headers: authHeaders,
					body: JSON.stringify({ authorName: "John Doe", content: "Great article!" }),
				},
			);
			expect(res.status).toBe(201);
			const body = (await res.json()) as Record<string, unknown>;
			expect(body).toHaveProperty("content", "Great article!");
			expect(body).toHaveProperty("id");
		});

		it("ignores client-supplied authorName (uses JWT identity)", async () => {
			// A malicious client cannot impersonate another user via authorName —
			// the server always writes the authenticated user's name/id.
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments`,
				{
					method: "POST",
					headers: authHeaders,
					body: JSON.stringify({ authorName: "Impersonation Attempt", content: "hi" }),
				},
			);
			expect(res.status).toBe(201);
			const body = (await res.json()) as Record<string, unknown>;
			expect(body).toHaveProperty("authorName", "Test User");
			expect(body).toHaveProperty("userId", "test-user-id");
		});

		it("missing content returns 422", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments`,
				{
					method: "POST",
					headers: authHeaders,
					body: JSON.stringify({ authorName: "John Doe" }),
				},
			);
			expect(res.status).toBe(422);
		});

		it("invalid JSON body returns 400", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments`,
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
				},
			);
			expect(res.status).toBe(200);
			const body = (await res.json()) as Record<string, unknown>;
			expect(body).toHaveProperty("content", "Updated comment text.");
		});

		it("returns 400 for invalid comment id", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments/abc`,
				{
					method: "PATCH",
					headers: authHeaders,
					body: JSON.stringify({ content: "Updated." }),
				},
			);
			expect(res.status).toBe(400);
		});

		it("returns 404 for non-existent comment", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments/999`,
				{
					method: "PATCH",
					headers: authHeaders,
					body: JSON.stringify({ content: "Updated." }),
				},
			);
			expect(res.status).toBe(404);
		});

		it("missing content returns 422", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments/1`,
				{
					method: "PATCH",
					headers: authHeaders,
					body: JSON.stringify({}),
				},
			);
			expect(res.status).toBe(422);
		});
	});

	/**
	 * DELETE /v1/api/articles/:slug/comments/:id
	 */
	describe("DELETE /v1/api/articles/:slug/comments/:id", () => {
		it("deletes a comment (204)", async () => {
			// Create a fresh comment so this test doesn't rely on ordering.
			const createRes = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments`,
				{
					method: "POST",
					headers: authHeaders,
					body: JSON.stringify({ authorName: "Temp", content: "To delete." }),
				},
			);
			expect(createRes.status).toBe(201);
			const created = (await createRes.json()) as { id: number };

			const deleteRes = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments/${created.id}`,
				{ method: "DELETE", headers: authHeaders },
			);
			expect(deleteRes.status).toBe(204);
		});

		it("returns 400 for invalid comment ID", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments/abc`,
				{ method: "DELETE", headers: authHeaders },
			);
			expect(res.status).toBe(400);
		});

		it("returns 404 for non-existent comment", async () => {
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments/999`,
				{ method: "DELETE", headers: authHeaders },
			);
			expect(res.status).toBe(404);
		});
	});

	/**
	 * Ownership / IDOR protection
	 */
	describe("ownership enforcement (C2)", () => {
		it("prevents another user from patching a comment (403)", async () => {
			// Test user creates a comment
			const create = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments`,
				{ method: "POST", headers: authHeaders, body: JSON.stringify({ content: "mine" }) },
			);
			const { id } = (await create.json()) as { id: number };

			// A different user tries to edit it
			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments/${id}`,
				{ method: "PATCH", headers: otherUserHeaders, body: JSON.stringify({ content: "hacked" }) },
			);
			expect(res.status).toBe(403);
		});

		it("prevents another user from deleting a comment (403)", async () => {
			const create = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments`,
				{ method: "POST", headers: authHeaders, body: JSON.stringify({ content: "keep me" }) },
			);
			const { id } = (await create.json()) as { id: number };

			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments/${id}`,
				{ method: "DELETE", headers: otherUserHeaders },
			);
			expect(res.status).toBe(403);
		});

		it("admin can edit any comment", async () => {
			const create = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments`,
				{ method: "POST", headers: authHeaders, body: JSON.stringify({ content: "original" }) },
			);
			const { id } = (await create.json()) as { id: number };

			const res = await SELF.fetch(
				`http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments/${id}`,
				{ method: "PATCH", headers: adminHeaders, body: JSON.stringify({ content: "moderated" }) },
			);
			expect(res.status).toBe(200);
			const body = (await res.json()) as Record<string, unknown>;
			expect(body).toHaveProperty("content", "moderated");
		});
	});
});
