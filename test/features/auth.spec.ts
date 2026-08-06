import { env, exports } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import { getAuthHeaders, seedDatabase } from "../../apps/shared/helpers/test-cases";
import { createJwt } from "../../apps/modules/auth/auth.service";

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

	describe("Refresh Token", () => {
		/** Compute SHA-256 hex of an ASCII string (mirrors the service helper). */
		async function sha256Hex(value: string): Promise<string> {
			const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
			return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
		}

		it("POST /v1/api/auth/refresh rejects a token whose DB row has expired", async () => {
			const userId = "test-user-id";
			const refreshToken = await createJwt(
				{ sub: userId, type: "refresh" },
				env.JWT_SECRET,
				60 * 30,
			);
			const rowId = crypto.randomUUID();
			const familyId = crypto.randomUUID();
			const tokenHash = await sha256Hex(refreshToken);
			const pastExpiry = new Date(Date.now() - 60 * 60 * 1000).toISOString();
			await env.DB.prepare(
				"INSERT INTO refresh_tokens (id, user_id, family_id, token_hash, expires_at) VALUES (?1, ?2, ?3, ?4, ?5)",
			).bind(rowId, userId, familyId, tokenHash, pastExpiry).run();

			const res = await SELF.fetch("http://example.com/v1/api/auth/refresh", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ refreshToken }),
			});
			expect(res.status).toBe(401);
			const body = (await res.json()) as { error?: string };
			expect(body.error).toMatch(/expired/i);

			const still = await env.DB.prepare(
				"SELECT 1 as one FROM refresh_tokens WHERE token_hash = ?1",
			).bind(tokenHash).first<{ one: number }>();
			expect(still).toBeNull();
		});

		it("refresh_tokens rows store the SHA-256 hash, not the raw token", async () => {
			// Sanity-check the migration: the raw JWT must not be present in the
			// column that used to hold it. A stolen DB dump should therefore not
			// let an attacker replay any refresh token.
			const userId = "test-user-id";
			const refreshToken = await createJwt(
				{ sub: userId, type: "refresh" },
				env.JWT_SECRET,
				60 * 30,
			);
			const familyId = crypto.randomUUID();
			const tokenHash = await sha256Hex(refreshToken);
			const rowId = crypto.randomUUID();
			await env.DB.prepare(
				"INSERT INTO refresh_tokens (id, user_id, family_id, token_hash, expires_at) VALUES (?1, ?2, ?3, ?4, ?5)",
			).bind(rowId, userId, familyId, tokenHash, new Date(Date.now() + 3600_000).toISOString()).run();

			const row = await env.DB.prepare(
				"SELECT token_hash FROM refresh_tokens WHERE id = ?1",
			).bind(rowId).first<{ token_hash: string }>();
			expect(row?.token_hash).toBe(tokenHash);
			expect(row?.token_hash).not.toBe(refreshToken);
			// Hex-hash is exactly 64 chars, JWT is far longer.
			expect(row?.token_hash?.length).toBe(64);
		});

		it("replaying a consumed refresh token revokes the whole family (reuse detection)", async () => {
			const userId = "test-user-id";
			// `jti` differentiates JWTs minted in the same second — without it,
			// hono/jwt would produce identical strings and hit UNIQUE.
			const refreshToken = await createJwt(
				{ sub: userId, type: "refresh", jti: "consumed" },
				env.JWT_SECRET,
				60 * 60 * 24,
			);
			const familyId = crypto.randomUUID();
			const tokenHash = await sha256Hex(refreshToken);
			const goodRowId = crypto.randomUUID();
			// A second row in the SAME family — represents a valid rotated
			// token that a legitimate client currently holds.
			const siblingRowId = crypto.randomUUID();
			const siblingToken = await createJwt(
				{ sub: userId, type: "refresh", jti: "sibling" },
				env.JWT_SECRET,
				60 * 60 * 24,
			);
			const siblingHash = await sha256Hex(siblingToken);
			const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
			const oneDayOut = new Date(Date.now() + 86_400_000).toISOString();
			// Original token is already consumed (simulates a prior rotation).
			await env.DB.prepare(
				"INSERT INTO refresh_tokens (id, user_id, family_id, token_hash, expires_at, consumed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
			).bind(goodRowId, userId, familyId, tokenHash, oneDayOut, oneHourAgo).run();
			await env.DB.prepare(
				"INSERT INTO refresh_tokens (id, user_id, family_id, token_hash, expires_at) VALUES (?1, ?2, ?3, ?4, ?5)",
			).bind(siblingRowId, userId, familyId, siblingHash, oneDayOut).run();

			const res = await SELF.fetch("http://example.com/v1/api/auth/refresh", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ refreshToken }),
			});
			expect(res.status).toBe(401);
			const body = (await res.json()) as { error?: string };
			expect(body.error).toMatch(/replay|revoked/i);

			// Both family members must be gone — including the sibling that was
			// never itself replayed.
			const remaining = await env.DB.prepare(
				"SELECT COUNT(*) as n FROM refresh_tokens WHERE family_id = ?1",
			).bind(familyId).first<{ n: number }>();
			expect(remaining?.n).toBe(0);
		});
	});

	describe("Refresh Cookie (#14)", () => {
		async function registerAndLogin(email: string, password: string, name: string) {
			// Register (or ignore-if-exists), then verify with the OTP straight
			// from the DB so we can log in without touching SMTP.
			await SELF.fetch("http://example.com/v1/api/auth/email/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, name, password }),
			});
			const otpRow = await env.DB.prepare(
				"SELECT code FROM email_otps WHERE email = ?1 AND used = 0 ORDER BY created_at DESC LIMIT 1",
			).bind(email).first<{ code: string }>();
			if (otpRow?.code) {
				await SELF.fetch("http://example.com/v1/api/auth/email/verify", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ email, otp: otpRow.code }),
				});
			}
			return SELF.fetch("http://example.com/v1/api/auth/email/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, password }),
			});
		}

		it("POST /v1/api/auth/email/login sets an HttpOnly refreshToken cookie", async () => {
			const res = await registerAndLogin("cookie-user@example.com", "correcthorse42", "Cookie User");
			expect(res.status).toBe(200);
			const cookie = res.headers.get("set-cookie") ?? "";
			expect(cookie).toMatch(/refreshToken=/);
			expect(cookie).toMatch(/HttpOnly/i);
			expect(cookie).toMatch(/SameSite=Lax/i);
			expect(cookie).toMatch(/Path=\/v1\/api\/auth/i);
			// Body still includes refreshToken during the migration window.
			const body = (await res.json()) as { accessToken: string; refreshToken: string };
			expect(body.accessToken).toBeTruthy();
			expect(body.refreshToken).toBeTruthy();
		});

		it("POST /v1/api/auth/refresh works via cookie with no JSON body", async () => {
			const loginRes = await registerAndLogin("cookie-refresh@example.com", "correcthorse42", "Cookie Refresh");
			// Set-Cookie values contain commas (Expires=...). Use the Web API
			// method that returns each Set-Cookie header as its own string.
			const cookies = (loginRes.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
			const cookie = cookies.find((s) => s.startsWith("refreshToken="));
			expect(cookie).toBeTruthy();
			const refreshCookieHeader = cookie!.split(";")[0]; // "refreshToken=<jwt>"

			const res = await SELF.fetch("http://example.com/v1/api/auth/refresh", {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: refreshCookieHeader },
				// Note: NO body — the cookie should be sufficient.
				body: "{}",
			});
			expect(res.status).toBe(200);
			const body = (await res.json()) as { accessToken: string; refreshToken: string };
			expect(body.accessToken).toBeTruthy();
			expect(body.refreshToken).toBeTruthy();
			// The new refresh token should also be reissued as a cookie.
			expect(res.headers.get("set-cookie") ?? "").toMatch(/refreshToken=/);
		});

		it("POST /v1/api/auth/logout clears the refreshToken cookie", async () => {
			const loginRes = await registerAndLogin("cookie-logout@example.com", "correcthorse42", "Cookie Logout");
			const loginBody = (await loginRes.json()) as { refreshToken: string };

			const res = await SELF.fetch("http://example.com/v1/api/auth/logout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ refreshToken: loginBody.refreshToken }),
			});
			expect(res.status).toBe(200);
			const clearCookie = res.headers.get("set-cookie") ?? "";
			expect(clearCookie).toMatch(/refreshToken=;/);
			expect(clearCookie).toMatch(/Max-Age=0/i);
		});
	});

	describe("Session invalidation on logout (#12)", () => {
		it("access tokens have a 15-minute TTL", async () => {
			// Register + verify a fresh user so we get a real access token from
			// the service (not a hand-crafted JWT).
			const email = "ttl-user@example.com";
			await SELF.fetch("http://example.com/v1/api/auth/email/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, name: "TTL", password: "correcthorse42" }),
			});
			const otp = await env.DB.prepare(
				"SELECT code FROM email_otps WHERE email = ?1 AND used = 0 ORDER BY created_at DESC LIMIT 1",
			).bind(email).first<{ code: string }>();
			const verifyRes = await SELF.fetch("http://example.com/v1/api/auth/email/verify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, otp: otp!.code }),
			});
			const body = (await verifyRes.json()) as { accessToken: string };
			const [, payloadB64] = body.accessToken.split(".");
			const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
			expect(payload.exp - payload.iat).toBe(60 * 15);
		});

		it("authGuard rejects an access token whose iat is before session_invalidated_at", async () => {
			const userId = "test-user-id";
			// Mint an access token with iat = now. `JwtService` overwrites any
			// `iat` supplied in the payload, so instead of a stale token we set
			// the invalidation floor to a future timestamp and rely on the
			// same `iat < floor` comparison to fire.
			const token = await createJwt(
				{ sub: userId, provider: "email", email: "test@example.com", name: "Test", role: "user", type: "access" },
				env.JWT_SECRET,
				60 * 15,
			);
			await env.DB.prepare(
				"UPDATE users SET session_invalidated_at = datetime('now', '+2 minutes') WHERE id = ?1",
			).bind(userId).run();

			const res = await SELF.fetch("http://example.com/v1/api/auth/sso/keys", {
				headers: { Authorization: `Bearer ${token}` },
			});
			expect(res.status).toBe(401);
			const errBody = (await res.json()) as { error?: string };
			expect(errBody.error).toMatch(/invalidated/i);

			// Reset so later tests using test-user-id do not inherit the floor.
			await env.DB.prepare("UPDATE users SET session_invalidated_at = NULL WHERE id = ?1").bind(userId).run();
		});

		it("logout writes session_invalidated_at for the token owner", async () => {
			const email = "logout-floor@example.com";
			await SELF.fetch("http://example.com/v1/api/auth/email/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, name: "Logout", password: "correcthorse42" }),
			});
			const otp = await env.DB.prepare(
				"SELECT code FROM email_otps WHERE email = ?1 AND used = 0 ORDER BY created_at DESC LIMIT 1",
			).bind(email).first<{ code: string }>();
			const verifyRes = await SELF.fetch("http://example.com/v1/api/auth/email/verify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, otp: otp!.code }),
			});
			const { refreshToken } = (await verifyRes.json()) as { refreshToken: string };

			// Sanity: no invalidation floor yet.
			const before = await env.DB.prepare(
				"SELECT session_invalidated_at as t FROM users WHERE provider_id = ?1",
			).bind(email).first<{ t: string | null }>();
			expect(before?.t).toBeNull();

			await SELF.fetch("http://example.com/v1/api/auth/logout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ refreshToken }),
			});

			const after = await env.DB.prepare(
				"SELECT session_invalidated_at as t FROM users WHERE provider_id = ?1",
			).bind(email).first<{ t: string | null }>();
			expect(after?.t).toBeTruthy();
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
