import { env } from "cloudflare:workers";
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { seedDatabase } from "../../apps/shared/helpers/test-cases";
import { withQueryLog, ROWS_READ_WARNING } from "../../apps/shared/db/query-log";

beforeAll(async () => {
	await seedDatabase(env.DB);
});

async function queryPlan(sql: string, ...binds: unknown[]): Promise<string> {
	const { results } = await env.DB.prepare(`EXPLAIN QUERY PLAN ${sql}`).bind(...binds).all<{ detail: string }>();
	return results.map((r) => r.detail).join(" | ");
}

describe("9999zz lookup indexes", () => {
	it("tags by article_id seek the index (was a full index scan)", async () => {
		const plan = await queryPlan("SELECT id, tag, description, article_id FROM tags WHERE article_id IN (?1, ?2)", "a", "b");
		expect(plan).toContain("idx_tags_article_id");
		expect(plan).toContain("SEARCH");
	});

	it("tags by project_id seek the index", async () => {
		const plan = await queryPlan("SELECT id, tag, description, project_id FROM tags WHERE project_id IN (?1)", "p");
		expect(plan).toContain("idx_tags_project_id");
	});

	it("expired refresh-token sweep seeks expires_at", async () => {
		const plan = await queryPlan("DELETE FROM refresh_tokens WHERE expires_at < datetime('now')");
		expect(plan).toContain("idx_refresh_tokens_expires_at");
	});
});

describe("withQueryLog (DB_QUERY_LOG=1)", () => {
	afterEach(() => vi.restoreAllMocks());

	it("is a no-op unless enabled", () => {
		const base = { DB: env.DB } as unknown as Env;
		expect(withQueryLog(base)).toBe(base);
	});

	it("logs rows read for first/all/run/batch and keeps results intact", async () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const db = withQueryLog({ DB: env.DB, DB_QUERY_LOG: "1" } as unknown as Env).DB;

		await db.exec("DROP TABLE IF EXISTS _qlog; CREATE TABLE _qlog (id INTEGER PRIMARY KEY, v TEXT);");
		expect((await db.prepare("INSERT INTO _qlog (v) VALUES (?1)").bind("a").run()).meta.changes).toBe(1);
		expect(await db.prepare("SELECT v FROM _qlog WHERE id = ?1").bind(1).first()).toEqual({ v: "a" });
		expect(await db.prepare("SELECT v FROM _qlog WHERE id = ?1").bind(1).first("v")).toBe("a");
		expect((await db.prepare("SELECT v FROM _qlog").all()).results).toEqual([{ v: "a" }]);
		const [b1, b2] = await db.batch([
			db.prepare("INSERT INTO _qlog (v) VALUES (?1)").bind("b"),
			db.prepare("SELECT COUNT(*) AS n FROM _qlog"),
		]);
		expect(b1!.meta.changes).toBe(1);
		expect(b2!.results).toEqual([{ n: 2 }]);

		const lines = log.mock.calls.map((c) => String(c[0]));
		expect(lines.some((l) => /^\[db\] \d+ rows read · .*SELECT v FROM _qlog WHERE id/.test(l))).toBe(true);
		expect(lines.some((l) => l.includes("SELECT COUNT(*) AS n FROM _qlog"))).toBe(true);
	});

	it(`warns when one statement reads more than ${ROWS_READ_WARNING} rows`, async () => {
		vi.spyOn(console, "log").mockImplementation(() => {});
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const db = withQueryLog({ DB: env.DB, DB_QUERY_LOG: "1" } as unknown as Env).DB;
		await env.DB.exec("DROP TABLE IF EXISTS _qbig; CREATE TABLE _qbig (id INTEGER PRIMARY KEY, v INTEGER);");
		await env.DB.prepare(
			`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${ROWS_READ_WARNING + 200}) INSERT INTO _qbig (v) SELECT i FROM n`,
		).run();

		await db.prepare("SELECT COUNT(*) AS c FROM _qbig WHERE v > 0").first();
		expect(warn).toHaveBeenCalledTimes(1);
		expect(String(warn.mock.calls[0]![0])).toMatch(/over 1000 rows/);
	});
});
