import { env, exports } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import { getAuthHeaders, seedDatabase } from "../../apps/shared/helpers/test-cases";

const SELF = exports.default;
let authHeaders: Record<string, string>;

beforeAll(async () => {
    await seedDatabase(env.DB);
    authHeaders = await getAuthHeaders(env.JWT_SECRET);
});

describe("Auth API", () => {
	describe("GitHub OAuth", () => {
		it("GET /v1/api/auth/github redirects to GitHub (302) with PKCE and state cookie", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/auth/github", { redirect: "manual" });
			expect(res.status).toBe(302);
			const location = res.headers.get("location") ?? "";
			expect(location).toContain("github.com/login/oauth/authorize");
			// PKCE parameters are present on the auth URL
			const locUrl = new URL(location);
			expect(locUrl.searchParams.get("code_challenge_method")).toBe("S256");
			expect(locUrl.searchParams.get("code_challenge")?.length ?? 0).toBeGreaterThan(0);
			expect(locUrl.searchParams.get("state")?.length ?? 0).toBeGreaterThan(0);
			// State-binding cookie is set (HttpOnly + SameSite=Lax + scoped path)
			const cookie = res.headers.get("set-cookie") ?? "";
			expect(cookie).toMatch(/oauth_state=/);
			expect(cookie).toMatch(/HttpOnly/i);
			expect(cookie).toMatch(/SameSite=Lax/i);
			expect(cookie).toMatch(/Path=\/v1\/api\/auth/i);
		});

		it("GET /v1/api/auth/github/callback without code returns 400", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/auth/github/callback");
			expect(res.status).toBe(400);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("error");
		});

		it("GET /v1/api/auth/github/callback without cookie returns 400 (state binding)", async () => {
			// Even a syntactically valid-looking state fails without the client cookie.
			const res = await SELF.fetch(
				"http://example.com/v1/api/auth/github/callback?code=FAKE_CODE&state=INVALID_STATE"
			);
			expect(res.status).toBe(400);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("error");
		});

		it("GET /v1/api/auth/github/callback with mismatched state vs cookie returns 400", async () => {
			// Start a real flow to capture a valid cookie
			const start = await SELF.fetch("http://example.com/v1/api/auth/github", { redirect: "manual" });
			const cookie = (start.headers.get("set-cookie") ?? "").split(";")[0]; // "oauth_state=<jwt>"
			expect(cookie).toMatch(/oauth_state=/);

			// Send the cookie but a state value the cookie doesn't attest to
			const res = await SELF.fetch(
				"http://example.com/v1/api/auth/github/callback?code=FAKE&state=SOMETHING_ELSE",
				{ headers: { Cookie: cookie } },
			);
			expect(res.status).toBe(400);
		});

		it("POST /v1/api/auth/github returns 404", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/auth/github", { method: "POST" });
			expect(res.status).toBe(404);
		});
	});

	describe("Google OAuth", () => {
		it("GET /v1/api/auth/google redirects to Google (302) with PKCE and state cookie", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/auth/google", { redirect: "manual" });
			expect(res.status).toBe(302);
			const location = res.headers.get("location") ?? "";
			expect(location).toContain("accounts.google.com");
			const locUrl = new URL(location);
			expect(locUrl.searchParams.get("code_challenge_method")).toBe("S256");
			expect(locUrl.searchParams.get("code_challenge")?.length ?? 0).toBeGreaterThan(0);
			expect(locUrl.searchParams.get("state")?.length ?? 0).toBeGreaterThan(0);
			const cookie = res.headers.get("set-cookie") ?? "";
			expect(cookie).toMatch(/oauth_state=/);
			expect(cookie).toMatch(/HttpOnly/i);
			expect(cookie).toMatch(/SameSite=Lax/i);
		});

		it("GET /v1/api/auth/google/callback without code returns 400", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/auth/google/callback");
			expect(res.status).toBe(400);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("error");
		});

		it("GET /v1/api/auth/google/callback without cookie returns 400 (state binding)", async () => {
			const res = await SELF.fetch(
				"http://example.com/v1/api/auth/google/callback?code=FAKE_CODE&state=INVALID_STATE"
			);
			expect(res.status).toBe(400);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("error");
		});

		it("GET /v1/api/auth/google/callback rejects a github-issued state cookie (provider binding)", async () => {
			// A cookie minted for the GitHub flow must not be usable for Google.
			const start = await SELF.fetch("http://example.com/v1/api/auth/github", { redirect: "manual" });
			const cookie = (start.headers.get("set-cookie") ?? "").split(";")[0];
			const state = new URL(start.headers.get("location") ?? "http://x").searchParams.get("state") ?? "";
			expect(state.length).toBeGreaterThan(0);

			const res = await SELF.fetch(
				`http://example.com/v1/api/auth/google/callback?code=FAKE&state=${encodeURIComponent(state)}`,
				{ headers: { Cookie: cookie } },
			);
			expect(res.status).toBe(400);
		});
	});

	describe("Email Auth", () => {
		it("POST /v1/api/auth/email/register with valid body returns 201", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/auth/email/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: "leatsophat01@gmail.com",
					name: "Leat Sophat",
					password: "securepassword123",
				}),
			});
			// 201 on success, 409 if user already exists from a prior run
			expect([201, 409]).toContain(res.status);
		});

		it("POST /v1/api/auth/email/register with missing fields returns 422", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/auth/email/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "missing@example.com" }),
			});
			expect(res.status).toBe(422);
		});

		it("POST /v1/api/auth/email/register with short password returns 422", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/auth/email/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "x@example.com", name: "X", password: "short" }),
			});
			expect(res.status).toBe(422);
		});

		it("POST /v1/api/auth/email/login with non-existent email returns 401 or 404", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/auth/email/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "nobody@example.com", password: "password123" }),
			});
			expect([401, 404]).toContain(res.status);
		});

		it("POST /v1/api/auth/email/login with missing fields returns 400 or 422", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/auth/email/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});
			expect([400, 422]).toContain(res.status);
		});

		it("POST /v1/api/auth/email/verify with invalid OTP returns 400, 401, or 404", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/auth/email/verify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "nobody@example.com", otp: "000000" }),
			});
			expect([400, 401, 404]).toContain(res.status);
		});
	});

	describe("Current User", () => {
		it("GET /v1/api/auth/me without token returns 401", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/auth/me");
			expect(res.status).toBe(401);
		});

		it("GET /v1/api/auth/me with invalid token returns 401", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/auth/me", {
				headers: { Authorization: "Bearer invalid.token.here" },
			});
			expect(res.status).toBe(401);
		});
	});

	describe("SSO API Keys", () => {
		it("POST /v1/api/auth/sso/keys without token returns 401", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/auth/sso/keys", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "unauth" }),
			});
			expect(res.status).toBe(401);
		});

		it("POST /v1/api/auth/sso/keys without name returns 422", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/auth/sso/keys", {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({}),
			});
			expect(res.status).toBe(422);
		});

		it("POST /v1/api/auth/sso/keys creates a key and returns plaintext once (201)", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/auth/sso/keys", {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ name: "Test CI Key", expiresInDays: 30 }),
			});
			expect(res.status).toBe(201);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("id");
			expect(body).toHaveProperty("key");
			expect(String(body.key)).toMatch(/^ppk_[a-f0-9]{48}$/);
			expect(body).toHaveProperty("prefix");
			expect(body).toHaveProperty("expires_at");
		});

		it("GET /v1/api/auth/sso/keys lists keys without plaintext", async () => {
			// Ensure at least one key exists
			await SELF.fetch("http://example.com/v1/api/auth/sso/keys", {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ name: "List Probe" }),
			});
			const res = await SELF.fetch("http://example.com/v1/api/auth/sso/keys", { headers: authHeaders });
			expect(res.status).toBe(200);
			const body = await res.json() as { keys: any[] };
			expect(Array.isArray(body.keys)).toBe(true);
			expect(body.keys.length).toBeGreaterThan(0);
			body.keys.forEach((k) => {
				expect(k).not.toHaveProperty("key_hash");
				expect(k).not.toHaveProperty("key");
			});
		});

		it("API key can authorize a locked list endpoint", async () => {
			const created = await SELF.fetch("http://example.com/v1/api/auth/sso/keys", {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ name: "Guard Probe" }),
			});
			const { key } = await created.json() as { key: string };

			const listRes = await SELF.fetch("http://example.com/v1/api/tags", {
				headers: { Authorization: `ApiKey ${key}` },
			});
			expect(listRes.status).toBe(200);
		});

		it("X-API-Key header also works", async () => {
			const created = await SELF.fetch("http://example.com/v1/api/auth/sso/keys", {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ name: "Header Probe" }),
			});
			const { key } = await created.json() as { key: string };

			const listRes = await SELF.fetch("http://example.com/v1/api/tags", {
				headers: { "X-API-Key": key },
			});
			expect(listRes.status).toBe(200);
		});

		it("revoked API key returns 401", async () => {
			const createRes = await SELF.fetch("http://example.com/v1/api/auth/sso/keys", {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ name: "Revoke Probe" }),
			});
			const { id, key } = await createRes.json() as { id: string; key: string };

			const revoke = await SELF.fetch(`http://example.com/v1/api/auth/sso/keys/${id}`, {
				method: "DELETE",
				headers: authHeaders,
			});
			expect(revoke.status).toBe(200);

			const listRes = await SELF.fetch("http://example.com/v1/api/tags", {
				headers: { Authorization: `ApiKey ${key}` },
			});
			expect(listRes.status).toBe(401);
		});

		it("invalid API key returns 401", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/tags", {
				headers: { Authorization: "ApiKey ppk_deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" },
			});
			expect(res.status).toBe(401);
		});

		it("DELETE /v1/api/auth/sso/keys/:id for unknown key returns 404", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/auth/sso/keys/00000000-0000-4000-8000-000000000099", {
				method: "DELETE",
				headers: authHeaders,
			});
			expect(res.status).toBe(404);
		});
	});
});
