import { env, exports } from "cloudflare:workers";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { seedDatabase } from "../../apps/shared/helpers/test-cases";
import { shouldLogVisit } from "../../apps/middlewares/traffic.middleware";
import { DashboardRepository, resetLiveTrafficCache } from "../../apps/modules/dashboard/dashboard.repo";
import { isHourlyTick } from "../../apps/app";

const SELF = exports.default;

beforeAll(async () => {
	await seedDatabase(env.DB);
});

/** EXPLAIN QUERY PLAN details for a statement, joined for easy matching. */
async function queryPlan(sql: string, ...binds: unknown[]): Promise<string> {
	const { results } = await env.DB.prepare(`EXPLAIN QUERY PLAN ${sql}`).bind(...binds).all<{ detail: string }>();
	return results.map((r) => r.detail).join(" | ");
}

/** waitUntil inserts are not awaited by fetch; poll briefly for them. */
async function loggedPaths(expectAtLeast: number): Promise<string[]> {
	let paths: string[] = [];
	for (let i = 0; i < 15; i++) {
		const { results } = await env.DB.prepare("SELECT path FROM visitor_logs").all<{ path: string }>();
		paths = results.map((r) => r.path);
		if (paths.length >= expectAtLeast) break;
		await new Promise((r) => setTimeout(r, 20));
	}
	return paths;
}

describe("visitor_logs row-read hotspot (Phase 0)", () => {
	describe("index usage", () => {
		it("live-traffic count is served by the covering index, not a table scan", async () => {
			const plan = await queryPlan(
				"SELECT COUNT(DISTINCT ip_hash) as count FROM visitor_logs WHERE timestamp > ?1",
				new Date().toISOString(),
			);
			expect(plan).toContain("idx_visitor_logs_ts_ip");
			expect(plan).toMatch(/COVERING INDEX/);
			expect(plan).not.toMatch(/SCAN visitor_logs(?! USING)/);
		});

		it("retention sweep seeks on the index", async () => {
			const plan = await queryPlan("DELETE FROM visitor_logs WHERE timestamp < datetime('now', ?1)", "-30 days");
			expect(plan).toContain("idx_visitor_logs_ts_ip");
		});
	});

	describe("shouldLogVisit", () => {
		it.each([
			["GET", "/", 200, true],
			["GET", "/v1/api/articles", 200, true],
			["GET", "/v1/api/authors/1", 304, true],
			["GET", "/v1/api/does-not-exist", 404, false],
			["GET", "/xor_create.php", 404, false],
			["GET", "/.env", 200, false],
			["GET", "/wp-login.php", 200, false],
			["GET", "/v1/api/dashboard/live-traffic", 200, false],
			["POST", "/v1/api/contact", 200, false],
		])("%s %s (%i) -> %s", (method, path, status, expected) => {
			expect(shouldLogVisit(method, path, status)).toBe(expected);
		});
	});

	describe("traffic middleware", () => {
		beforeEach(async () => {
			await env.DB.prepare("DELETE FROM visitor_logs").run();
		});

		it("records real API hits and skips scanner noise and unknown routes", async () => {
			const ip = { "CF-Connecting-IP": "203.0.113.77" };
			await SELF.fetch("http://example.com/xor_create.php", { headers: ip });
			await SELF.fetch("http://example.com/v1/api/does-not-exist", { headers: ip });
			const ok = await SELF.fetch("http://example.com/v1/api/authors/1", { headers: ip });
			expect(ok.status).toBe(200);

			const paths = await loggedPaths(1);
			expect(paths).toEqual(["/v1/api/authors/1"]);
		});
	});

	describe("live traffic cache", () => {
		const repo = () => new DashboardRepository(env.DB, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
		const insertVisit = (ipHash: string) =>
			env.DB.prepare("INSERT INTO visitor_logs (timestamp, ip_hash, path) VALUES (?1, ?2, '/')")
				.bind(new Date().toISOString(), ipHash)
				.run();

		beforeEach(async () => {
			await env.DB.prepare("DELETE FROM visitor_logs").run();
			resetLiveTrafficCache();
		});

		it("reuses one count across callers within the TTL", async () => {
			await insertVisit("a".repeat(64));
			const first = await repo().getLiveTraffic();
			expect(first).toBe(1);

			// A new visitor arrives, but a second dashboard within the TTL shares the cached count.
			await insertVisit("b".repeat(64));
			expect(await repo().getLiveTraffic()).toBe(1);

			resetLiveTrafficCache();
			expect(await repo().getLiveTraffic()).toBe(2);
		});

		it("de-duplicates concurrent refreshes", async () => {
			await insertVisit("c".repeat(64));
			const results = await Promise.all([repo().getLiveTraffic(), repo().getLiveTraffic(), repo().getLiveTraffic()]);
			expect(results).toEqual([1, 1, 1]);
		});
	});

	describe("isHourlyTick", () => {
		it("is true only for the first 5-minute tick of each UTC hour", () => {
			expect(isHourlyTick(Date.UTC(2026, 10, 26, 13, 0, 3))).toBe(true);
			expect(isHourlyTick(Date.UTC(2026, 10, 26, 13, 4, 59))).toBe(true);
			expect(isHourlyTick(Date.UTC(2026, 10, 26, 13, 5, 0))).toBe(false);
			expect(isHourlyTick(Date.UTC(2026, 10, 26, 13, 55, 0))).toBe(false);
		});
	});
});
