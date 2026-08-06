import { env, exports } from "cloudflare:workers";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getAuthHeaders, seedDatabase } from "../../apps/shared/helpers/test-cases";

const SELF = exports.default;
let authHeaders: Record<string, string>;

beforeAll(async () => {
	await seedDatabase(env.DB);
	authHeaders = await getAuthHeaders(env.JWT_SECRET);
});

afterEach(() => {
	vi.restoreAllMocks();
	// Peel any binding stubs we attached during a test so the next test does
	// not inherit an under-limit or over-limit binding.
	for (const name of [
		"RATE_LIMITER_AUTH",
		"RATE_LIMITER_READ",
		"RATE_LIMITER_WRITE",
		"RATE_LIMITER_ENGAGEMENT",
		"RATE_LIMITER_CONTACT",
	] as const) {
		delete (env as any)[name];
	}
});

describe("Rate limit middleware", () => {
	it("fails open when the RATE_LIMITER_READ binding is missing", async () => {
		// No binding attached — request should reach the handler (200), not 429.
		const res = await SELF.fetch("http://example.com/v1/api/articles", { headers: authHeaders });
		expect(res.status).toBe(200);
	});

	it("delegates to the RATE_LIMITER_READ binding when configured", async () => {
		const limit = vi.fn().mockResolvedValue({ success: true });
		(env as any).RATE_LIMITER_READ = { limit };

		const res = await SELF.fetch("http://example.com/v1/api/articles", { headers: authHeaders });
		expect(res.status).toBe(200);
		expect(limit).toHaveBeenCalledTimes(1);
		expect(limit).toHaveBeenCalledWith({ key: expect.any(String) });
	});

	it("returns 429 with Retry-After when the binding rejects", async () => {
		const limit = vi.fn().mockResolvedValue({ success: false });
		(env as any).RATE_LIMITER_READ = { limit };

		const res = await SELF.fetch("http://example.com/v1/api/articles", { headers: authHeaders });
		expect(res.status).toBe(429);
		expect(res.headers.get("Retry-After")).toBe("60");
		expect(res.headers.get("X-RateLimit-Policy")).toBe("read");
		const body = (await res.json()) as { error: string };
		expect(body.error).toMatch(/Too Many Requests/);
	});

	it("routes /v1/api/auth/* to RATE_LIMITER_AUTH, not RATE_LIMITER_READ", async () => {
		const authLimit = vi.fn().mockResolvedValue({ success: true });
		const readLimit = vi.fn().mockResolvedValue({ success: true });
		(env as any).RATE_LIMITER_AUTH = { limit: authLimit };
		(env as any).RATE_LIMITER_READ = { limit: readLimit };

		await SELF.fetch("http://example.com/v1/api/auth/github", { redirect: "manual" });
		expect(authLimit).toHaveBeenCalledTimes(1);
		expect(readLimit).not.toHaveBeenCalled();
	});

	it("routes POST /v1/api/contact to RATE_LIMITER_CONTACT", async () => {
		const contactLimit = vi.fn().mockResolvedValue({ success: false });
		(env as any).RATE_LIMITER_CONTACT = { limit: contactLimit };

		const res = await SELF.fetch("http://example.com/v1/api/contact", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "John Doe",
				email: "john@example.com",
				message: "This is a test message that is long enough.",
			}),
		});
		expect(res.status).toBe(429);
		expect(contactLimit).toHaveBeenCalledTimes(1);
	});
});
