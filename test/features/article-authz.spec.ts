import { env, exports } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { getAdminHeaders, getAuthHeaders, seedDatabase } from "../../apps/shared/helpers/test-cases";
import { createJwt } from "../../apps/modules/auth/auth.service";

const SELF = exports.default;
let authHeaders: Record<string, string>; // test-user-id, role=user
let adminHeaders: Record<string, string>; // admin-user-id, role=admin
let contribHeaders: Record<string, string>; // contributor-user-1, role=user

// A draft article co-authored by contributor-user-1 but OWNED by test-user-id.
const DRAFT_ARTICLE_ID = "00000000-0000-4000-8000-00000000d001";
const CONTRIB_AUTHOR_ID = 42; // authors.id linked to contributor-user-1

beforeAll(async () => {
	await seedDatabase(env.DB);
	authHeaders = await getAuthHeaders(env.JWT_SECRET);
	adminHeaders = await getAdminHeaders(env.JWT_SECRET);

	const contribToken = await createJwt(
		{ sub: "contributor-user-1", provider: "email", email: "contrib@example.com", name: "Contributor One", role: "user" },
		env.JWT_SECRET,
	);
	contribHeaders = { Authorization: `Bearer ${contribToken}`, "Content-Type": "application/json" };

	// Author record linked to the contributor.
	await env.DB.prepare(
		"INSERT OR IGNORE INTO authors (id, name, profile, url, user_id) VALUES (?1, ?2, ?3, ?4, ?5)",
	).bind(CONTRIB_AUTHOR_ID, "Contributor One", "Contributor", "", "contributor-user-1").run();

	// Draft article: owned by test-user-id, NOT public, NOT published.
	await env.DB.prepare(
		"INSERT OR REPLACE INTO articles (id, title, slug, description, thumbnail, published, is_public, content, file_path, owner_id, created_at, updated_at) " +
		"VALUES (?1, ?2, ?3, ?4, ?5, 0, 0, ?6, '', ?7, ?8, ?8)",
	).bind(
		DRAFT_ARTICLE_ID,
		"Secret Draft",
		"secret-draft-slug",
		"A draft only test-user-id should see.",
		"https://example.com/draft.png",
		"# Draft body",
		"test-user-id",
		"2026-01-02T00:00:00.000Z",
	).run();

	// Link the draft to the contributor's author record — this is the setup
	// that triggered the old leak.
	await env.DB.prepare(
		"INSERT OR IGNORE INTO article_authors (article_id, author_id) VALUES (?1, ?2)",
	).bind(DRAFT_ARTICLE_ID, CONTRIB_AUTHOR_ID).run();

	// Register the contributor on the article so field-level ACL (#20) applies.
	await env.DB.prepare(
		"INSERT OR IGNORE INTO article_contributors (article_id, user_id) VALUES (?1, ?2)",
	).bind(DRAFT_ARTICLE_ID, "contributor-user-1").run();
});

describe("Article draft visibility (#19)", () => {
	it("a co-author querying by their authorId does NOT see another owner's draft", async () => {
		const res = await SELF.fetch(
			`http://example.com/v1/api/articles/author/${CONTRIB_AUTHOR_ID}`,
			{ headers: contribHeaders },
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: Array<{ id: string }> };
		const ids = body.data.map((row) => row.id);
		expect(ids).not.toContain(DRAFT_ARTICLE_ID);
	});

	it("the article owner still sees their own draft when listing by their authorId", async () => {
		// Attach the owner (test-user-id) to a second author record so the
		// query has a joined row to return.
		const OWNER_AUTHOR_ID = 43;
		await env.DB.prepare(
			"INSERT OR IGNORE INTO authors (id, name, profile, url, user_id) VALUES (?1, ?2, ?3, ?4, ?5)",
		).bind(OWNER_AUTHOR_ID, "Test User", "Owner", "", "test-user-id").run();
		await env.DB.prepare(
			"INSERT OR IGNORE INTO article_authors (article_id, author_id) VALUES (?1, ?2)",
		).bind(DRAFT_ARTICLE_ID, OWNER_AUTHOR_ID).run();

		const res = await SELF.fetch(
			`http://example.com/v1/api/articles/author/${OWNER_AUTHOR_ID}`,
			{ headers: authHeaders },
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: Array<{ id: string }> };
		const ids = body.data.map((row) => row.id);
		expect(ids).toContain(DRAFT_ARTICLE_ID);
	});

	it("admin sees all articles for the author (including drafts)", async () => {
		const res = await SELF.fetch(
			`http://example.com/v1/api/articles/author/${CONTRIB_AUTHOR_ID}`,
			{ headers: adminHeaders },
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: Array<{ id: string }> };
		expect(body.data.map((r) => r.id)).toContain(DRAFT_ARTICLE_ID);
	});
});

describe("Article field-level ACL (#20)", () => {
	it("contributor PATCH is rejected when it touches a reserved field", async () => {
		const res = await SELF.fetch(`http://example.com/v1/api/articles/${DRAFT_ARTICLE_ID}`, {
			method: "PATCH",
			headers: contribHeaders,
			body: JSON.stringify({ published: true, is_public: true }),
		});
		expect(res.status).toBe(403);
		const body = (await res.json()) as { error: string };
		expect(body.error).toMatch(/Contributors may only update/);
		// Sanity check: the DB row was not flipped.
		const row = await env.DB.prepare(
			"SELECT published, is_public FROM articles WHERE id = ?1",
		).bind(DRAFT_ARTICLE_ID).first<{ published: number; is_public: number }>();
		expect(row?.published).toBe(0);
		expect(row?.is_public).toBe(0);
	});

	it("contributor PATCH of allowed fields still succeeds", async () => {
		const res = await SELF.fetch(`http://example.com/v1/api/articles/${DRAFT_ARTICLE_ID}`, {
			method: "PATCH",
			headers: contribHeaders,
			body: JSON.stringify({ description: "Updated by contributor." }),
		});
		expect(res.status).toBe(200);
	});

	it("owner PATCH of published= is unaffected by contributor ACL", async () => {
		const res = await SELF.fetch(`http://example.com/v1/api/articles/${DRAFT_ARTICLE_ID}`, {
			method: "PATCH",
			headers: authHeaders,
			body: JSON.stringify({ description: "Updated by owner." }),
		});
		expect(res.status).toBe(200);
	});
});

describe("Comment authorName sanitisation (#21)", () => {
	it("ignores client-supplied authorName and uses JWT name", async () => {
		const attackerToken = await createJwt(
			{
				sub: "test-user-id", provider: "email", email: "test@example.com",
				name: "Real Name From JWT", role: "user",
			},
			env.JWT_SECRET,
		);
		const res = await SELF.fetch("http://example.com/v1/api/articles/test-article-slug/comments", {
			method: "POST",
			headers: { Authorization: `Bearer ${attackerToken}`, "Content-Type": "application/json" },
			body: JSON.stringify({
				content: "hi from a client that tried to spoof",
				authorName: "Impostor Bob <script>alert(1)</script>",
			}),
		});
		expect(res.status).toBe(201);
		const body = (await res.json()) as { authorName?: string; author_name?: string };
		const stored = body.authorName ?? body.author_name;
		expect(stored).toBe("Real Name From JWT");
	});

	it("HTML in the JWT name is stripped before storage", async () => {
		const evilToken = await createJwt(
			{
				sub: "test-user-id", provider: "email", email: "test@example.com",
				name: "<script>alert(1)</script>Bob", role: "user",
			},
			env.JWT_SECRET,
		);
		const res = await SELF.fetch("http://example.com/v1/api/articles/test-article-slug/comments", {
			method: "POST",
			headers: { Authorization: `Bearer ${evilToken}`, "Content-Type": "application/json" },
			body: JSON.stringify({ content: "test" }),
		});
		expect(res.status).toBe(201);
		const body = (await res.json()) as { authorName?: string; author_name?: string };
		const stored = body.authorName ?? body.author_name ?? "";
		expect(stored).not.toContain("<script>");
		expect(stored).not.toContain("<");
		expect(stored).toContain("Bob");
	});
});
