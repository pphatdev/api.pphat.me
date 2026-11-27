import { env, exports } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { getAdminHeaders, seedDatabase } from "../../apps/shared/helpers/test-cases";
import { createJwt } from "../../apps/modules/auth/auth.service";

/**
 * Role-scoped access: admins control every module; any other account works
 * only on its own posts (drafts + review), posts it contributes to, and its
 * own profile. Publishing is admin-only.
 */

const SELF = exports.default;
const BASE = "http://example.com/v1/api";
const WRITER_ID = "writer-user-1";
const OTHER_ID = "contributor-user-1"; // seeded, role=user

let adminHeaders: Record<string, string>;
let writerHeaders: Record<string, string>;
let otherHeaders: Record<string, string>;

async function headersFor(sub: string, name: string): Promise<Record<string, string>> {
	const token = await createJwt({ sub, provider: "email", email: `${sub}@example.com`, name, role: "user" }, env.JWT_SECRET);
	return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function createDraft(headers: Record<string, string>, slug: string): Promise<any> {
	const res = await SELF.fetch(`${BASE}/articles`, {
		method: "POST",
		headers,
		body: JSON.stringify({ title: `Post ${slug}`, slug, description: "A post.", content: "# Hello" }),
	});
	expect(res.status).toBe(201);
	return res.json();
}

async function patch(id: string, headers: Record<string, string>, body: unknown): Promise<Response> {
	return SELF.fetch(`${BASE}/articles/${id}`, { method: "PATCH", headers, body: JSON.stringify(body) });
}

beforeAll(async () => {
	await seedDatabase(env.DB);
	await env.DB.prepare(
		"INSERT OR IGNORE INTO users (id, provider, provider_id, email, name, avatar, role, email_verified) VALUES (?1, 'email', ?2, ?2, 'Writer One', 'https://example.com/old.png', 'user', 1)",
	).bind(WRITER_ID, `${WRITER_ID}@example.com`).run();
	adminHeaders = await getAdminHeaders(env.JWT_SECRET);
	writerHeaders = await headersFor(WRITER_ID, "Writer One");
	otherHeaders = await headersFor(OTHER_ID, "Contributor One");
});

describe("Non-admin publishing", () => {
	it("creates a draft owned by the caller", async () => {
		const article = await createDraft(writerHeaders, `writer-draft-${Date.now()}`);
		expect(article.status).toBe("draft");
		expect(article.ownerId).toBe(WRITER_ID);
		expect(article.isPublic).toBe(false);
	});

	it.each([
		["published", { published: true }],
		["isPublic", { isPublic: true }],
		["publishAt", { published: true, publishAt: new Date(Date.now() + 3_600_000).toISOString() }],
		["authorIds", { authorIds: [1] }],
	])("rejects creating with %s (403)", async (_field, extra) => {
		const res = await SELF.fetch(`${BASE}/articles`, {
			method: "POST",
			headers: writerHeaders,
			body: JSON.stringify({ title: "Sneaky", slug: `sneaky-${Date.now()}-${Math.random()}`, description: "x", ...extra }),
		});
		expect(res.status).toBe(403);
	});

	it("cannot publish their own draft by PATCH", async () => {
		const article = await createDraft(writerHeaders, `writer-patch-${Date.now()}`);
		expect((await patch(article.id, writerHeaders, { published: true, isPublic: true })).status).toBe(403);
		expect((await patch(article.id, writerHeaders, { authorIds: [] })).status).toBe(403);
	});

	it("admin can still create a public article", async () => {
		const res = await SELF.fetch(`${BASE}/articles`, {
			method: "POST",
			headers: adminHeaders,
			body: JSON.stringify({ title: "Admin Post", slug: `admin-post-${Date.now()}`, description: "x", published: true, isPublic: true }),
		});
		expect(res.status).toBe(201);
		expect(((await res.json()) as any).status).toBe("public");
	});
});

describe("Review flow", () => {
	let article: any;

	beforeAll(async () => {
		article = await createDraft(writerHeaders, `writer-review-${Date.now()}`);
	});

	it("only the owner (or an admin) can submit for review", async () => {
		const res = await SELF.fetch(`${BASE}/articles/${article.id}/review`, { method: "POST", headers: otherHeaders });
		expect(res.status).toBe(403);
	});

	it("owner submits the draft; it shows as review, not draft, in the admin list", async () => {
		const res = await SELF.fetch(`${BASE}/articles/${article.id}/review`, { method: "POST", headers: writerHeaders });
		expect(res.status).toBe(200);
		expect(((await res.json()) as any).status).toBe("review");

		const review = (await (await SELF.fetch(`${BASE}/articles?status=review&limit=100`, { headers: adminHeaders })).json()) as any;
		expect(review.data.map((a: any) => a.id)).toContain(article.id);
		const drafts = (await (await SELF.fetch(`${BASE}/articles?status=draft&limit=100`, { headers: adminHeaders })).json()) as any;
		expect(drafts.data.map((a: any) => a.id)).not.toContain(article.id);
	});

	it("is hidden from the public and other users, by slug or id, while unpublished", async () => {
		expect((await SELF.fetch(`${BASE}/articles/${article.slug}`)).status).toBe(404);
		expect((await SELF.fetch(`${BASE}/articles/${article.id}`)).status).toBe(404);
		expect((await SELF.fetch(`${BASE}/articles/${article.slug}`, { headers: otherHeaders })).status).toBe(404);
	});

	it("the owner and admins can preview it", async () => {
		expect((await SELF.fetch(`${BASE}/articles/${article.slug}`, { headers: writerHeaders })).status).toBe(200);
		expect((await SELF.fetch(`${BASE}/articles/${article.id}`, { headers: adminHeaders })).status).toBe(200);
	});

	it("owner can withdraw the request", async () => {
		const res = await SELF.fetch(`${BASE}/articles/${article.id}/review`, { method: "DELETE", headers: writerHeaders });
		expect(res.status).toBe(200);
		expect(((await res.json()) as any).status).toBe("draft");
	});

	it("admin publishing clears the review request", async () => {
		await SELF.fetch(`${BASE}/articles/${article.id}/review`, { method: "POST", headers: writerHeaders });
		const res = await patch(article.id, adminHeaders, { published: true, isPublic: true });
		expect(res.status).toBe(200);
		expect(((await res.json()) as any).status).toBe("public");
		const row = await env.DB.prepare("SELECT review_requested_at FROM articles WHERE id = ?1").bind(article.id).first<any>();
		expect(row.review_requested_at).toBeNull();
	});

	it("a published post cannot be submitted again (409)", async () => {
		const res = await SELF.fetch(`${BASE}/articles/${article.id}/review`, { method: "POST", headers: writerHeaders });
		expect(res.status).toBe(409);
	});

	it("owner can re-save the approved post with unchanged publish fields", async () => {
		const res = await patch(article.id, writerHeaders, { content: "# Updated", published: true, isPublic: true });
		expect(res.status).toBe(200);
	});

	it("owner can take their own post down", async () => {
		const res = await patch(article.id, writerHeaders, { published: false });
		expect(res.status).toBe(200);
		expect(((await res.json()) as any).status).toBe("draft");
	});
});

describe("GET /v1/api/articles/mine", () => {
	let owned: any;
	let contributed: any;

	beforeAll(async () => {
		owned = await createDraft(writerHeaders, `writer-mine-${Date.now()}`);
		contributed = await createDraft(otherHeaders, `other-shared-${Date.now()}`);
		await env.DB.prepare("INSERT OR IGNORE INTO article_contributors (article_id, user_id) VALUES (?1, ?2)").bind(contributed.id, WRITER_ID).run();
	});

	it("requires sign-in", async () => {
		expect((await SELF.fetch(`${BASE}/articles/mine`)).status).toBe(401);
	});

	it("lists the caller's own posts, drafts included, and nobody else's", async () => {
		const body = (await (await SELF.fetch(`${BASE}/articles/mine?limit=100`, { headers: writerHeaders })).json()) as any;
		const ids = body.data.map((a: any) => a.id);
		expect(ids).toContain(owned.id);
		expect(ids).not.toContain(contributed.id);
		expect(body.data.every((a: any) => a.ownerId === WRITER_ID)).toBe(true);
	});

	it("scope=contributing lists posts they were added to but don't own", async () => {
		const body = (await (await SELF.fetch(`${BASE}/articles/mine?scope=contributing&limit=100`, { headers: writerHeaders })).json()) as any;
		const ids = body.data.map((a: any) => a.id);
		expect(ids).toContain(contributed.id);
		expect(ids).not.toContain(owned.id);
	});

	it("filters by status", async () => {
		const body = (await (await SELF.fetch(`${BASE}/articles/mine?status=public&limit=100`, { headers: writerHeaders })).json()) as any;
		expect(body.data.map((a: any) => a.id)).not.toContain(owned.id);
	});

	it("rejects an unknown scope (400)", async () => {
		expect((await SELF.fetch(`${BASE}/articles/mine?scope=all`, { headers: writerHeaders })).status).toBe(400);
	});

	it("contributors still cannot publish (field-level ACL)", async () => {
		expect((await patch(contributed.id, writerHeaders, { published: true })).status).toBe(403);
		expect((await patch(contributed.id, writerHeaders, { content: "# Improved" })).status).toBe(200);
	});
});

describe("PATCH /v1/api/auth/me", () => {
	const update = (headers: Record<string, string>, body: unknown) =>
		SELF.fetch(`${BASE}/auth/me`, { method: "PATCH", headers, body: JSON.stringify(body) });

	it("requires sign-in", async () => {
		const res = await SELF.fetch(`${BASE}/auth/me`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" });
		expect(res.status).toBe(401);
	});

	it("updates the caller's name and avatar", async () => {
		const res = await update(writerHeaders, { name: "  Writer Renamed  ", avatar: "https://example.com/new.png" });
		expect(res.status).toBe(200);
		const user = (await res.json()) as any;
		expect(user.name).toBe("Writer Renamed");
		expect(user.avatar).toBe("https://example.com/new.png");
		expect(user.role).toBe("user");
		expect(user).not.toHaveProperty("password_hash");
	});

	it("clears the avatar with null", async () => {
		const res = await update(writerHeaders, { avatar: null });
		expect(((await res.json()) as any).avatar).toBeNull();
	});

	it.each([
		["role", { role: "admin" }],
		["email", { email: "new@example.com" }],
		["empty name", { name: "   " }],
		["long name", { name: "x".repeat(81) }],
		["http avatar", { avatar: "http://example.com/a.png" }],
		["javascript avatar", { avatar: "javascript:alert(1)" }],
		["nothing", {}],
	])("rejects %s (422)", async (_label, body) => {
		expect((await update(writerHeaders, body)).status).toBe(422);
		const row = await env.DB.prepare("SELECT role, email FROM users WHERE id = ?1").bind(WRITER_ID).first<any>();
		expect(row.role).toBe("user");
	});
});

describe("OAuth sign-in keeps profile edits", () => {
	it("fills name/avatar from the provider only when the user has none", async () => {
		const { AuthRepository } = await import("../../apps/modules/auth/auth.repo");
		const repo = new AuthRepository(env.DB);
		const first = await repo.findOrCreateUser("github", "gh-profile-1", { email: "gh@example.com", name: "GitHub Name", avatar: "https://avatars.example.com/1" });
		await repo.updateProfile(first.id, { name: "Chosen Name" });

		const again = await repo.findOrCreateUser("github", "gh-profile-1", { email: "gh2@example.com", name: "GitHub Name", avatar: "https://avatars.example.com/2" });
		expect(again.name).toBe("Chosen Name");
		expect(again.avatar).toBe("https://avatars.example.com/1");
		expect(again.email).toBe("gh2@example.com");
		const row = await env.DB.prepare("SELECT name, avatar FROM users WHERE id = ?1").bind(first.id).first<any>();
		expect(row).toEqual({ name: "Chosen Name", avatar: "https://avatars.example.com/1" });
	});
});
