import { env, exports } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { ARTICLE_SLUG, getAdminHeaders, getAuthHeaders, seedDatabase } from "../../apps/shared/helpers/test-cases";
import { createJwt } from "../../apps/modules/auth/auth.service";

const SELF = exports.default;
const COMMENTS = `http://example.com/v1/api/articles/${ARTICLE_SLUG}/comments`;
const OTHER_SLUG = "reply-other-article";

let authH: Record<string, string>;
let otherH: Record<string, string>;
let adminH: Record<string, string>;

const post = async (headers: Record<string, string>, body: unknown, url = COMMENTS) =>
	SELF.fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
const list = async () => ((await (await SELF.fetch(`${COMMENTS}?limit=50`)).json()) as any);

beforeAll(async () => {
	await seedDatabase(env.DB);
	authH = await getAuthHeaders(env.JWT_SECRET);
	adminH = await getAdminHeaders(env.JWT_SECRET);
	const token = await createJwt({ sub: "reply-other", provider: "email", email: "r@example.com", name: "Replier", role: "user" }, env.JWT_SECRET);
	otherH = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
	await env.DB.prepare("INSERT OR IGNORE INTO users (id, provider, provider_id, email, name, role) VALUES ('reply-other', 'email', 'r@example.com', 'r@example.com', 'Replier', 'user')").run();
	await env.DB.prepare(
		"INSERT OR IGNORE INTO articles (id, title, slug, description, thumbnail, published, is_public, content, file_path, owner_id, created_at, updated_at) VALUES ('00000000-0000-4000-8000-0000000000aa', 'Other', ?1, 'x', '', 1, 1, '', '', 'admin-user-id', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
	).bind(OTHER_SLUG).run();
});

describe("Comment replies", () => {
	let root: any;

	it("a top-level comment has parentId null and an empty replies list", async () => {
		const res = await post(authH, { content: "Root comment" });
		expect(res.status).toBe(201);
		root = await res.json();
		expect(root.parentId).toBeNull();
		const thread = (await list()).data.find((c: any) => c.id === root.id);
		expect(thread.replies).toEqual([]);
	});

	it("replies nest under their comment, oldest first, and aren't listed at the top level", async () => {
		const first = (await (await post(otherH, { content: "First reply", parentId: root.id })).json()) as any;
		expect(first.parentId).toBe(root.id);
		await post(authH, { content: "Second reply", parentId: root.id });

		const body = await list();
		const thread = body.data.find((c: any) => c.id === root.id);
		expect(thread.replies.map((r: any) => r.content)).toEqual(["First reply", "Second reply"]);
		expect(body.data.map((c: any) => c.id)).not.toContain(first.id);
	});

	it("replying to a reply joins the same thread (one level deep)", async () => {
		const thread = (await list()).data.find((c: any) => c.id === root.id);
		const res = await post(adminH, { content: "Reply to a reply", parentId: thread.replies[0].id });
		expect(res.status).toBe(201);
		expect(((await res.json()) as any).parentId).toBe(root.id);
	});

	it("pagination counts threads, not replies", async () => {
		const body = await list();
		expect(body.pagination.total).toBe(body.data.length);
	});

	it("rejects a bad parentId (422) and a comment from another article (404)", async () => {
		expect((await post(authH, { content: "x", parentId: "1" })).status).toBe(422);
		expect((await post(authH, { content: "x", parentId: -3 })).status).toBe(422);
		expect((await post(authH, { content: "x", parentId: 99999999 })).status).toBe(404);
		const foreign = (await (await post(authH, { content: "elsewhere" }, `http://example.com/v1/api/articles/${OTHER_SLUG}/comments`)).json()) as any;
		expect((await post(authH, { content: "cross", parentId: foreign.id })).status).toBe(404);
	});

	it("requires sign-in to reply", async () => {
		const res = await SELF.fetch(COMMENTS, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: "x", parentId: root.id }) });
		expect(res.status).toBe(401);
	});

	it("deleting a comment removes its replies", async () => {
		const res = await SELF.fetch(`${COMMENTS}/${root.id}`, { method: "DELETE", headers: authH });
		expect(res.status).toBe(204);
		const left = await env.DB.prepare("SELECT COUNT(*) AS n FROM article_comments WHERE parent_id = ?1").bind(root.id).first<{ n: number }>();
		expect(left?.n).toBe(0);
	});
});
