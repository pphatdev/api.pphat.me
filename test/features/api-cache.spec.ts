import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { apiCacheMiddleware, cacheFreshSeconds, cacheScope } from "../../apps/middlewares/cache.middleware";

/**
 * The feature suite runs with API_CACHE_TTL=0 (cache off), so the middleware
 * is exercised here on a small app with a call-counting handler.
 */
function harness(opts: { ttl?: string; status?: () => number } = {}) {
	let calls = 0;
	const app = new Hono<{ Bindings: Env }>();
	app.use("/v1/api/*", apiCacheMiddleware);
	const handler = (c: any) => {
		calls++;
		const status = opts.status?.() ?? 200;
		return status >= 500 ? c.json({ error: "db down" }, status) : c.json({ calls }, status);
	};
	app.get("/v1/api/articles", handler);
	app.get("/v1/api/dashboard", handler);
	app.post("/v1/api/articles", (c) => c.json({ ok: true }, 201));

	const env = { API_CACHE_TTL: opts.ttl ?? "60" } as unknown as Env;
	const pending: Promise<unknown>[] = [];
	const ctx = { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException() {}, props: {} } as unknown as ExecutionContext;
	const request = async (path: string, init?: RequestInit) => {
		const res = await app.request(`http://api.test${path}`, init, env, ctx);
		await Promise.all(pending.splice(0));
		return res;
	};
	return { request, calls: () => calls };
}

let seq = 0;
const unique = () => `?t=${Date.now()}-${seq++}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("apiCacheMiddleware", () => {
	it("serves anonymous repeat reads from cache", async () => {
		const h = harness();
		const q = unique();
		const first = await h.request(`/v1/api/articles${q}`);
		const second = await h.request(`/v1/api/articles${q}`);
		expect(first.headers.get("X-Cache")).toBe("MISS");
		expect(second.headers.get("X-Cache")).toBe("HIT");
		expect(second.headers.get("Cache-Control")).toBe("public, max-age=60");
		expect(second.headers.get("x-api-cache-stored-at")).toBeNull();
		expect(await second.json()).toEqual({ calls: 1 });
		expect(h.calls()).toBe(1);
	});

	it("never caches Bearer (JWT) callers or ?token= requests", async () => {
		const h = harness();
		const q = unique();
		const bearer = { headers: { Authorization: "Bearer abc" } };
		await h.request(`/v1/api/articles${q}`, bearer);
		const again = await h.request(`/v1/api/articles${q}`, bearer);
		expect(again.headers.get("X-Cache")).toBeNull();
		await h.request(`/v1/api/articles${q}&token=x`);
		await h.request(`/v1/api/articles${q}&token=x`);
		expect(h.calls()).toBe(4);
	});

	it("isolates API-key callers from each other and from anonymous callers", async () => {
		const h = harness();
		const q = unique();
		await h.request(`/v1/api/articles${q}`, { headers: { "X-API-Key": "key-A" } });
		const sameKey = await h.request(`/v1/api/articles${q}`, { headers: { Authorization: "ApiKey key-A" } });
		const otherKey = await h.request(`/v1/api/articles${q}`, { headers: { "X-API-Key": "key-B" } });
		const anon = await h.request(`/v1/api/articles${q}`);
		expect(sameKey.headers.get("X-Cache")).toBe("HIT");
		expect(sameKey.headers.get("Cache-Control")).toBe("private, no-store");
		expect(otherKey.headers.get("X-Cache")).toBe("MISS");
		expect(anon.headers.get("X-Cache")).toBe("MISS");
		expect(h.calls()).toBe(3);
	});

	it("serves the stale copy when the database errors (stale-if-error)", async () => {
		let status = 200;
		const h = harness({ ttl: "0.001", status: () => status });
		const q = unique();
		await h.request(`/v1/api/articles${q}`);
		await sleep(10); // past the 1 ms fresh window
		status = 500;
		const res = await h.request(`/v1/api/articles${q}`);
		expect(res.status).toBe(200);
		expect(res.headers.get("X-Cache")).toBe("STALE-IF-ERROR");
		expect(await res.json()).toEqual({ calls: 1 });
	});

	it("passes errors through when there is no cached copy", async () => {
		const h = harness({ status: () => 500 });
		const res = await h.request(`/v1/api/articles${unique()}`);
		expect(res.status).toBe(500);
	});

	it("a successful write refreshes cached reads in this colo", async () => {
		const h = harness();
		const q = unique();
		await h.request(`/v1/api/articles${q}`);
		expect((await h.request(`/v1/api/articles${q}`)).headers.get("X-Cache")).toBe("HIT");
		await h.request("/v1/api/articles", { method: "POST" });
		const after = await h.request(`/v1/api/articles${q}`);
		expect(after.headers.get("X-Cache")).toBe("MISS");
		expect(h.calls()).toBe(2);
	});

	it("does not cache non-content routes", async () => {
		const h = harness();
		const q = unique();
		await h.request(`/v1/api/dashboard${q}`);
		const again = await h.request(`/v1/api/dashboard${q}`);
		expect(again.headers.get("X-Cache")).toBeNull();
		expect(h.calls()).toBe(2);
	});

	it("is disabled with API_CACHE_TTL=0", async () => {
		const h = harness({ ttl: "0" });
		const q = unique();
		await h.request(`/v1/api/articles${q}`);
		await h.request(`/v1/api/articles${q}`);
		expect(h.calls()).toBe(2);
		expect(cacheFreshSeconds({ API_CACHE_TTL: "0" })).toBe(0);
		expect(cacheFreshSeconds({})).toBe(60);
		expect(cacheFreshSeconds({ API_CACHE_TTL: "junk" })).toBe(60);
	});

	it("cacheScope distinguishes anon, API keys and bearer", async () => {
		const req = (h: Record<string, string>, q = "") => new Request(`http://api.test/v1/api/articles${q}`, { headers: h });
		expect(await cacheScope(req({}))).toBe("anon");
		expect(await cacheScope(req({ Authorization: "Bearer x" }))).toBeNull();
		expect(await cacheScope(req({}, "?token=x"))).toBeNull();
		const a = await cacheScope(req({ "X-API-Key": "secret" }));
		expect(a).toMatch(/^key-[0-9a-f]{32}$/);
		expect(a).not.toContain("secret");
		expect(await cacheScope(req({ Authorization: "ApiKey secret" }))).toBe(a);
	});
});
