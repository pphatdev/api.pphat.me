import { env, exports } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { getAuthHeaders, seedDatabase } from "../../apps/shared/helpers/test-cases";
import { verifyJwt } from "../../apps/modules/auth/auth.service";
import { resolveAllowedOrigin } from "../../apps/shared/config/cors";
import { sign } from "hono/jwt";

const SELF = exports.default;
let authHeaders: Record<string, string>;

beforeAll(async () => {
	await seedDatabase(env.DB);
	authHeaders = await getAuthHeaders(env.JWT_SECRET);
});

describe("JWT hardening (#18)", () => {
	it("mints access tokens with pinned iss + aud", async () => {
		const token = authHeaders.Authorization.split(" ")[1];
		const [, payloadB64] = token.split(".");
		const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
		expect(payload.iss).toBe("pphat-api");
		expect(payload.aud).toBe("pphat-web");
	});

	it("verifyJwt rejects a token minted with a different aud", async () => {
		// Hand-craft a token that verifies (same secret, HS256) but claims a
		// different audience. The pinned check in JwtService.verify should
		// return null.
		const now = Math.floor(Date.now() / 1000);
		const rogue = await sign(
			{
				sub: "test-user-id", provider: "email", email: "x@y.z", name: "x",
				role: "user", type: "access",
				iat: now, nbf: now, exp: now + 3600,
				iss: "pphat-api", aud: "someone-else",
			},
			env.JWT_SECRET,
			"HS256",
		);
		const payload = await verifyJwt(rogue, env.JWT_SECRET);
		expect(payload).toBeNull();
	});

	it("verifyJwt rejects a token minted with a different iss", async () => {
		const now = Math.floor(Date.now() / 1000);
		const rogue = await sign(
			{
				sub: "test-user-id", provider: "email", email: "x@y.z", name: "x",
				role: "user", type: "access",
				iat: now, nbf: now, exp: now + 3600,
				iss: "another-service", aud: "pphat-web",
			},
			env.JWT_SECRET,
			"HS256",
		);
		const payload = await verifyJwt(rogue, env.JWT_SECRET);
		expect(payload).toBeNull();
	});

	it("verifyJwt rejects a header alg other than HS256 (alg confusion)", async () => {
		// Hand-forge a token with header {alg:"none"} and no signature. Even
		// though hono/jwt would also reject this, the explicit header check in
		// JwtService.verify makes the guarantee independent of the underlying
		// library's defaults.
		const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
		const now = Math.floor(Date.now() / 1000);
		const payloadJson = JSON.stringify({
			sub: "test-user-id", type: "access", role: "user",
			iat: now, exp: now + 3600, iss: "pphat-api", aud: "pphat-web",
		});
		const payload = btoa(payloadJson).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
		const forged = `${header}.${payload}.`;
		expect(await verifyJwt(forged, env.JWT_SECRET)).toBeNull();
	});
});

describe("CORS allow-list (#23)", () => {
	it("allows an explicitly listed hostname", () => {
		expect(resolveAllowedOrigin("https://pphat.me")).toBe("https://pphat.me");
	});

	it("rejects a random Vercel preview (no more wildcard)", () => {
		expect(resolveAllowedOrigin("https://random-app-abc123.vercel.app")).toBeNull();
	});

	it("rejects an evil origin that superficially looks like ours", () => {
		expect(resolveAllowedOrigin("https://pphat.me.evil.example")).toBeNull();
	});

	it("allows any localhost port for dev", () => {
		expect(resolveAllowedOrigin("http://localhost:5173")).toBe("http://localhost:5173");
		expect(resolveAllowedOrigin("http://127.0.0.1:8080")).toBe("http://127.0.0.1:8080");
	});

	it("returns null when no Origin header is present", () => {
		expect(resolveAllowedOrigin(null)).toBeNull();
	});
});

describe("Traffic middleware IP hashing (#22)", () => {
	it("stores hex hashes, not raw IPs, in visitor_logs", async () => {
		await env.DB.prepare("DELETE FROM visitor_logs").run();
		const res = await SELF.fetch("http://example.com/v1/api/authors/1", {
			headers: { "CF-Connecting-IP": "203.0.113.42" },
		});
		expect(res.status).toBe(200);

		// waitUntil is not awaited, so poll briefly. Under vitest-pool-workers
		// waitUntil callbacks resolve by the next await tick.
		let logged: { ip_hash: string | null } | null = null;
		for (let i = 0; i < 10; i++) {
			logged = await env.DB.prepare(
				"SELECT ip_hash FROM visitor_logs ORDER BY timestamp DESC LIMIT 1",
			).first<{ ip_hash: string | null }>();
			if (logged?.ip_hash) break;
			await new Promise((r) => setTimeout(r, 20));
		}
		expect(logged?.ip_hash).toBeTruthy();
		// SHA-256 hex = 64 chars (was SHA-1 = 40 before #22).
		expect(logged!.ip_hash!.length).toBe(64);
		// The raw IP must not appear in the stored value.
		expect(logged!.ip_hash).not.toContain("203.0.113.42");
	});
});

describe("Generic error messages (#26)", () => {
	it("POST /v1/api/chat surfaces a generic error, not the exception text, on AI failure", async () => {
		// Force the AI binding to throw with a distinctive message.
		const previousAI = (env as any).AI;
		(env as any).AI = { run: () => { throw new Error("upstream-token-abc123-leaked"); } };
		try {
			const res = await SELF.fetch("http://example.com/v1/api/chat", {
				method: "POST",
				headers: authHeaders,
				body: JSON.stringify({ message: "hi" }),
			});
			expect(res.status).toBe(500);
			const body = (await res.json()) as { error: string };
			expect(body.error).not.toContain("upstream-token-abc123-leaked");
			expect(body.error).toBe("Chat request failed");
		} finally {
			if (previousAI === undefined) delete (env as any).AI;
			else (env as any).AI = previousAI;
		}
	});
});
