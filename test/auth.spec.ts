import { env, exports } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import { getAuthHeaders, seedDatabase } from "./helpers/setup";

const SELF = exports.default;
let authHeaders: Record<string, string>;

beforeAll(async () => {
    await seedDatabase(env.DB);
    authHeaders = await getAuthHeaders(env.JWT_SECRET);
});

describe("Auth API", () => {
	describe("GitHub OAuth", () => {
		it("GET /v1/api/auth/github redirects to GitHub (302)", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/auth/github", { redirect: "manual" });
			expect(res.status).toBe(302);
			const location = res.headers.get("location") ?? "";
			expect(location).toContain("github.com/login/oauth/authorize");
		});

		it("GET /v1/api/auth/github/callback without code returns 400", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/auth/github/callback");
			expect(res.status).toBe(400);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("error");
		});

		it("GET /v1/api/auth/github/callback with invalid state returns 400", async () => {
			const res = await SELF.fetch(
				"http://example.com/v1/api/auth/github/callback?code=FAKE_CODE&state=INVALID_STATE"
			);
			expect(res.status).toBe(400);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("error");
		});

		it("POST /v1/api/auth/github returns 404", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/auth/github", { method: "POST" });
			expect(res.status).toBe(404);
		});
	});

	describe("Google OAuth", () => {
		it("GET /v1/api/auth/google redirects to Google (302)", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/auth/google", { redirect: "manual" });
			expect(res.status).toBe(302);
			const location = res.headers.get("location") ?? "";
			expect(location).toContain("accounts.google.com");
		});

		it("GET /v1/api/auth/google/callback without code returns 400", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/auth/google/callback");
			expect(res.status).toBe(400);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("error");
		});

		it("GET /v1/api/auth/google/callback with invalid state returns 400", async () => {
			const res = await SELF.fetch(
				"http://example.com/v1/api/auth/google/callback?code=FAKE_CODE&state=INVALID_STATE"
			);
			expect(res.status).toBe(400);
			const body = await res.json() as Record<string, unknown>;
			expect(body).toHaveProperty("error");
		});
	});

	describe("Email Auth", () => {
		it("POST /v1/api/auth/email/register with valid body returns 201", async () => {
			const res = await SELF.fetch("http://example.com/v1/api/auth/email/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: "newuser@example.com",
					name: "New User",
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
});
