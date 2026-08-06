import { env, exports } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { seedDatabase, getAdminHeaders } from "../../apps/shared/helpers/test-cases";
import { verifyJwt } from "../../apps/modules/auth/auth.service";
import { buildUpdateFields } from "../../apps/shared/helpers/repo";
import { sign } from "hono/jwt";

const SELF = exports.default;
let adminHeaders: Record<string, string>;

beforeAll(async () => {
	await seedDatabase(env.DB);
	adminHeaders = await getAdminHeaders(env.JWT_SECRET);
});

describe("HKDF per-context signing keys (#30)", () => {
	it("a token signed with the raw JWT_SECRET no longer verifies via authGuard", async () => {
		// Prior to #30 the same secret was used to sign access tokens AND the
		// oauth_state cookie. Now the auth JWT is signed with an HKDF-derived
		// sub-key; a token signed with the raw master secret must fail verify.
		const now = Math.floor(Date.now() / 1000);
		const rogue = await sign(
			{
				sub: "admin-user-id", provider: "email", email: "admin@example.com",
				name: "Admin", role: "admin", type: "access",
				iat: now, nbf: now, exp: now + 3600,
				iss: "pphat-api", aud: "pphat-web",
			},
			env.JWT_SECRET, // NOTE: raw master secret, not the derived key
			"HS256",
		);
		const decoded = await verifyJwt(rogue, env.JWT_SECRET);
		expect(decoded).toBeNull();
	});

	it("the oauth_state cookie (state-context key) does not verify as an access token", async () => {
		// Kick off a GitHub OAuth flow — this sets an oauth_state cookie that's
		// a JWT signed with the state-context HKDF key.
		const start = await SELF.fetch("http://example.com/v1/api/auth/github", { redirect: "manual" });
		const cookieHeader = start.headers.get("set-cookie") ?? "";
		const cookie = cookieHeader.split(";")[0]; // "oauth_state=<jwt>"
		const stateJwt = cookie.split("=")[1];
		expect(stateJwt.length).toBeGreaterThan(20);

		// That state JWT must not verify against the auth-context key. If it
		// did, an attacker who captured an oauth_state cookie could replay it
		// as an access token.
		const decoded = await verifyJwt(stateJwt, env.JWT_SECRET);
		expect(decoded).toBeNull();
	});
});

describe("buildUpdateFields safety (#29)", () => {
	it("throws when a mapping references an unsafe SQL column name", () => {
		expect(() =>
			buildUpdateFields(
				{ title: "x" } as any,
				// Semi-colon injection attempt in the DB column slot; the regex
				// guard must reject it before we ever build a SET clause.
				[["title" as any, "title; DROP TABLE users --" as any]],
			),
		).toThrow(/unsafe DB column name/);
	});

	it("accepts a normal identifier mapping and skips undefined DTO fields", () => {
		const result = buildUpdateFields(
			{ title: "Hello", description: undefined } as any,
			[
				["title" as any, "title"],
				["description" as any, "description"],
			],
		);
		expect(result.fields).toEqual(["title = ?1"]);
		expect(result.values).toEqual(["Hello"]);
		expect(result.nextIdx).toBe(2);
	});
});

describe("Batched hydration (#35)", () => {
	it("article list page returns each row with its tags + authors intact", async () => {
		const res = await SELF.fetch(
			"http://example.com/v1/api/articles?page=1&limit=10",
			{ headers: adminHeaders },
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: Array<{ id: string; tags: unknown[]; authors: unknown[] }> };
		expect(Array.isArray(body.data)).toBe(true);
		// Every row must have `tags` and `authors` arrays populated (arrays
		// may be empty for a given article, but the fields must exist so the
		// client renders consistently).
		for (const row of body.data) {
			expect(Array.isArray(row.tags)).toBe(true);
			expect(Array.isArray(row.authors)).toBe(true);
		}
		// The seed inserts a tag + author for the seeded article; the list
		// must include that row and hydrate it correctly.
		const seeded = body.data.find((r) => r.id === "00000000-0000-4000-8000-000000000001");
		expect(seeded).toBeTruthy();
		expect((seeded!.tags as any[]).length).toBeGreaterThan(0);
		expect((seeded!.authors as any[]).length).toBeGreaterThan(0);
	});
});
