import { env, exports } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { getAdminHeaders, seedDatabase } from "../../apps/shared/helpers/test-cases";
import { createJwt } from "../../apps/modules/auth/auth.service";
import { MAX_INVITES_PER_DAY, MAX_PENDING_INVITATIONS } from "../../apps/modules/article-invitations/article-invitations.controller";
import { renderInvitationEmail } from "../../apps/modules/auth/email.service";

const SELF = exports.default;
const BASE = "http://example.com/v1/api";

const OWNER = { id: "inv-owner", email: "owner@invite.test" };
const INVITEE = { id: "inv-invitee", email: "Invitee@Invite.test" }; // mixed case on purpose
const STRANGER = { id: "inv-stranger", email: "stranger@invite.test" };

let ownerH: Record<string, string>;
let inviteeH: Record<string, string>;
let strangerH: Record<string, string>;
let adminH: Record<string, string>;
let articleId: string;

async function headersFor(user: { id: string; email: string }): Promise<Record<string, string>> {
	const token = await createJwt({ sub: user.id, provider: "email", email: user.email, name: user.id, role: "user" }, env.JWT_SECRET);
	return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

const invite = (headers: Record<string, string>, email: string, id = articleId) =>
	SELF.fetch(`${BASE}/articles/${id}/invitations`, { method: "POST", headers, body: JSON.stringify({ email }) });

const received = async (headers: Record<string, string>) =>
	((await (await SELF.fetch(`${BASE}/invitations`, { headers })).json()) as any).data as any[];

beforeAll(async () => {
	await seedDatabase(env.DB);
	for (const u of [OWNER, INVITEE, STRANGER]) {
		await env.DB.prepare(
			"INSERT OR IGNORE INTO users (id, provider, provider_id, email, name, role, email_verified) VALUES (?1, 'email', ?2, ?2, ?1, 'user', 1)",
		).bind(u.id, u.email).run();
	}
	[ownerH, inviteeH, strangerH, adminH] = await Promise.all([
		headersFor(OWNER),
		headersFor(INVITEE),
		headersFor(STRANGER),
		getAdminHeaders(env.JWT_SECRET),
	]);
	const res = await SELF.fetch(`${BASE}/articles`, {
		method: "POST",
		headers: ownerH,
		body: JSON.stringify({ title: "Shared draft", slug: `shared-draft-${Date.now()}`, description: "x", content: "# a" }),
	});
	articleId = ((await res.json()) as any).id;
});

describe("Inviting contributors", () => {
	it("requires sign-in", async () => {
		const res = await SELF.fetch(`${BASE}/articles/${articleId}/invitations`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "a@b.co" }),
		});
		expect(res.status).toBe(401);
	});

	it("only the owner or an admin can invite or see the list", async () => {
		expect((await invite(strangerH, "x@invite.test")).status).toBe(403);
		expect((await SELF.fetch(`${BASE}/articles/${articleId}/contributors`, { headers: strangerH })).status).toBe(403);
	});

	it.each(["", "not-an-email", "a@b", `${"x".repeat(250)}@a.co`])("rejects invalid email %j (422)", async (email) => {
		expect((await invite(ownerH, email)).status).toBe(422);
	});

	it("can't invite the owner", async () => {
		expect((await invite(ownerH, "OWNER@invite.test")).status).toBe(422);
	});

	it("owner invites by email (normalised to lower case)", async () => {
		const res = await invite(ownerH, "  Invitee@Invite.TEST ");
		expect(res.status).toBe(201);
		const body = (await res.json()) as any;
		expect(body).toMatchObject({ email: "invitee@invite.test", status: "pending" });

		const list = (await (await SELF.fetch(`${BASE}/articles/${articleId}/contributors`, { headers: ownerH })).json()) as any;
		expect(list.invitations.map((i: any) => i.email)).toEqual(["invitee@invite.test"]);
		expect(list.contributors).toEqual([]);
	});

	it("re-inviting the same address keeps one invitation", async () => {
		expect((await invite(ownerH, "invitee@invite.test")).status).toBe(201);
		const list = (await (await SELF.fetch(`${BASE}/articles/${articleId}/contributors`, { headers: ownerH })).json()) as any;
		expect(list.invitations).toHaveLength(1);
	});

	it("an admin can invite on someone else's article", async () => {
		expect((await invite(adminH, "someone@invite.test")).status).toBe(201);
	});
});

describe("Responding to an invitation", () => {
	it("the invitee sees it; nobody else does", async () => {
		const mine = await received(inviteeH);
		expect(mine).toHaveLength(1);
		expect(mine[0].article.id).toBe(articleId);
		expect(mine[0].invitedBy.name).toBeTruthy();
		expect(await received(strangerH)).toEqual([]);
	});

	it("someone else can't accept or decline it (404)", async () => {
		const [inv] = await received(inviteeH);
		expect((await SELF.fetch(`${BASE}/invitations/${inv.id}/accept`, { method: "POST", headers: strangerH })).status).toBe(404);
		expect((await SELF.fetch(`${BASE}/invitations/${inv.id}/decline`, { method: "POST", headers: strangerH })).status).toBe(404);
	});

	it("accepting makes the invitee a contributor who can edit content only", async () => {
		const [inv] = await received(inviteeH);
		const res = await SELF.fetch(`${BASE}/invitations/${inv.id}/accept`, { method: "POST", headers: inviteeH });
		expect(res.status).toBe(200);
		expect(((await res.json()) as any).articleId).toBe(articleId);

		expect(await received(inviteeH)).toEqual([]);
		const contributing = (await (await SELF.fetch(`${BASE}/articles/mine?scope=contributing`, { headers: inviteeH })).json()) as any;
		expect(contributing.data.map((a: any) => a.id)).toContain(articleId);

		const edit = (body: unknown) =>
			SELF.fetch(`${BASE}/articles/${articleId}`, { method: "PATCH", headers: inviteeH, body: JSON.stringify(body) });
		expect((await edit({ content: "# better" })).status).toBe(200);
		expect((await edit({ title: "Hijacked" })).status).toBe(403);
	});

	it("an accepted invitation can't be used again", async () => {
		const row = await env.DB.prepare("SELECT id FROM article_invitations WHERE article_id = ?1 AND email = ?2").bind(articleId, "invitee@invite.test").first<any>();
		expect((await SELF.fetch(`${BASE}/invitations/${row.id}/accept`, { method: "POST", headers: inviteeH })).status).toBe(404);
	});

	it("inviting an existing contributor is a conflict (409)", async () => {
		expect((await invite(ownerH, "invitee@invite.test")).status).toBe(409);
	});

	it("owner sees the contributor (without an email) and can remove them", async () => {
		const list = (await (await SELF.fetch(`${BASE}/articles/${articleId}/contributors`, { headers: ownerH })).json()) as any;
		expect(list.contributors).toEqual([{ id: INVITEE.id, name: INVITEE.id, avatar: null }]);

		const res = await SELF.fetch(`${BASE}/articles/${articleId}/contributors/${INVITEE.id}`, { method: "DELETE", headers: ownerH });
		expect(res.status).toBe(204);
		expect((await SELF.fetch(`${BASE}/articles/${articleId}`, {
			method: "PATCH", headers: inviteeH, body: JSON.stringify({ content: "# again" }),
		})).status).toBe(403);
	});

	it("declining closes the invitation without adding a contributor", async () => {
		await invite(ownerH, STRANGER.email);
		const [inv] = await received(strangerH);
		expect((await SELF.fetch(`${BASE}/invitations/${inv.id}/decline`, { method: "POST", headers: strangerH })).status).toBe(204);
		expect(await received(strangerH)).toEqual([]);
		const list = (await (await SELF.fetch(`${BASE}/articles/${articleId}/contributors`, { headers: ownerH })).json()) as any;
		expect(list.contributors.map((c: any) => c.id)).not.toContain(STRANGER.id);
	});
});

describe("Revoking and limits", () => {
	it("owner revokes a pending invitation; the invitee no longer sees it", async () => {
		const created = (await (await invite(ownerH, STRANGER.email)).json()) as any;
		expect(await received(strangerH)).toHaveLength(1);
		const res = await SELF.fetch(`${BASE}/articles/${articleId}/invitations/${created.id}`, { method: "DELETE", headers: ownerH });
		expect(res.status).toBe(204);
		expect(await received(strangerH)).toEqual([]);
		expect((await SELF.fetch(`${BASE}/articles/${articleId}/invitations/${created.id}`, { method: "DELETE", headers: ownerH })).status).toBe(404);
	});

	it("a stranger can't revoke", async () => {
		const created = (await (await invite(ownerH, "revoke-me@invite.test")).json()) as any;
		expect((await SELF.fetch(`${BASE}/articles/${articleId}/invitations/${created.id}`, { method: "DELETE", headers: strangerH })).status).toBe(403);
	});

	it(`caps pending invitations per article at ${MAX_PENDING_INVITATIONS}`, async () => {
		const res = await SELF.fetch(`${BASE}/articles`, {
			method: "POST",
			headers: ownerH,
			body: JSON.stringify({ title: "Busy", slug: `busy-${Date.now()}`, description: "x" }),
		});
		const busyId = ((await res.json()) as any).id;
		// An admin sends these: admins aren't subject to the per-user daily cap,
		// so this isolates the per-article limit.
		for (let i = 0; i < MAX_PENDING_INVITATIONS; i++) {
			expect((await invite(adminH, `fan${i}@invite.test`, busyId)).status).toBe(201);
		}
		expect((await invite(adminH, "one-too-many@invite.test", busyId)).status).toBe(422);
	});

	it(`caps a non-admin at ${MAX_INVITES_PER_DAY} invitations a day, across articles`, async () => {
		const SENDER = { id: "inv-daily", email: "daily@invite.test" };
		await env.DB.prepare(
			"INSERT OR IGNORE INTO users (id, provider, provider_id, email, name, role, email_verified) VALUES (?1, 'email', ?2, ?2, 'Daily', 'user', 1)",
		).bind(SENDER.id, SENDER.email).run();
		const senderH = await headersFor(SENDER);
		const ids: string[] = [];
		for (const n of [1, 2]) {
			const res = await SELF.fetch(`${BASE}/articles`, {
				method: "POST",
				headers: senderH,
				body: JSON.stringify({ title: `Daily ${n}`, slug: `daily-${n}-${Date.now()}`, description: "x" }),
			});
			ids.push(((await res.json()) as any).id);
		}
		// Split across two articles so the per-article cap never applies.
		for (let i = 0; i < MAX_INVITES_PER_DAY; i++) {
			expect((await invite(senderH, `d${i}@invite.test`, ids[i % 2])).status).toBe(201);
		}
		const res = await invite(senderH, "over@invite.test", ids[0]);
		expect(res.status).toBe(422);
		expect(((await res.json()) as any).error ?? "").toMatch(/a day/);
	});
});

describe("Invitation email", () => {
	it("is skipped when SMTP isn't configured (emailed: false)", async () => {
		const created = (await (await invite(ownerH, "no-smtp@invite.test")).json()) as any;
		expect(created.emailed).toBe(false);
	});

	it("uses a fixed subject and escapes user-written text", () => {
		const mail = renderInvitationEmail({
			inviterName: 'Eve <script>alert(1)</script>\r\nBcc: x@evil.test',
			articleTitle: '"><img src=x onerror=alert(1)>',
			url: "https://admin.pphat.me/articles",
		});
		expect(mail.subject).toBe("You're invited to contribute on pphat.me");
		expect(mail.html).not.toContain("<script>");
		expect(mail.html).not.toContain("<img");
		expect(mail.html).toContain("&lt;script&gt;");
		expect(mail.text).not.toMatch(/\r|\nBcc:/);
		expect(mail.html).toContain('href="https://admin.pphat.me/articles"');
	});
});

describe("Invitation timestamps", () => {
	it("are ISO 8601 UTC", async () => {
		const created = (await (await invite(ownerH, "iso@invite.test")).json()) as any;
		expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
	});
});
