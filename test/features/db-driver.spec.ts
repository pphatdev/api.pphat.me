import { env } from "cloudflare:workers";
import { describe, it, expect, beforeAll } from "vitest";
import type { Client, InStatement, ResultSet, Row } from "@libsql/client/web";
import { LibsqlD1Database, asD1Database } from "../../apps/shared/db/libsql-d1";
import { dbDriver, resolveEnv } from "../../apps/shared/db";

/**
 * Stand-in libSQL client that executes on the test D1 database, so the
 * adapter is exercised against a real SQLite engine offline. Live libSQL
 * behaviour is covered by `node scripts/turso/conformance.mjs`.
 */
function d1BackedClient(db: D1Database): Client {
	const toResultSet = (res: D1Result<Record<string, unknown>>): ResultSet => {
		const columns = res.results[0] ? Object.keys(res.results[0]) : [];
		const rows = res.results.map((obj) => {
			const row = columns.map((c) => obj[c]) as unknown as Row;
			columns.forEach((c) => Object.defineProperty(row, c, { value: obj[c], enumerable: false }));
			return row;
		});
		return {
			columns,
			columnTypes: columns.map(() => ""),
			rows,
			rowsAffected: res.meta.changes,
			lastInsertRowid: BigInt(res.meta.last_row_id ?? 0),
			toJSON: () => ({}),
		};
	};
	const prep = (s: InStatement) => {
		const stmt = typeof s === "string" ? { sql: s, args: [] } : s;
		return db.prepare(stmt.sql).bind(...((stmt.args as unknown[]) ?? []));
	};
	return {
		execute: async (s: InStatement) => toResultSet(await prep(s).all()),
		batch: async (stmts: InStatement[]) => (await db.batch(stmts.map(prep))).map((r) => toResultSet(r as D1Result<Record<string, unknown>>)),
		executeMultiple: async (sql: string) => {
			await db.exec(sql.replace(/\n/g, " "));
		},
	} as unknown as Client;
}

const adapter = () => asD1Database(new LibsqlD1Database(d1BackedClient(env.DB)));

beforeAll(async () => {
	await env.DB.exec("DROP TABLE IF EXISTS _adapter_t; CREATE TABLE _adapter_t (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, n INTEGER NOT NULL DEFAULT 0);");
});

describe("LibsqlD1Database adapter (D1 API parity)", () => {
	it("run() reports changes and last_row_id like D1", async () => {
		const res = await adapter().prepare("INSERT INTO _adapter_t (name, n) VALUES (?1, ?2)").bind("alpha", 1).run();
		expect(res.success).toBe(true);
		expect(res.meta.changes).toBe(1);
		expect(res.meta.last_row_id).toBeGreaterThan(0);
		expect(typeof res.meta.last_row_id).toBe("number");
	});

	it("first() returns an object, first(col) a value, null when no row", async () => {
		const db = adapter();
		expect(await db.prepare("SELECT name, n FROM _adapter_t WHERE name = ?1").bind("alpha").first()).toEqual({ name: "alpha", n: 1 });
		expect(await db.prepare("SELECT n FROM _adapter_t WHERE name = ?1").bind("alpha").first<number>("n")).toBe(1);
		expect(await db.prepare("SELECT n FROM _adapter_t WHERE name = ?1").bind("missing").first()).toBeNull();
	});

	it("all() matches what D1 returns for the same query", async () => {
		await env.DB.prepare("INSERT INTO _adapter_t (name, n) VALUES ('beta', 2), ('gamma', 3)").run();
		const sql = "SELECT id, name, n FROM _adapter_t ORDER BY id";
		const viaAdapter = await adapter().prepare(sql).all();
		const viaD1 = await env.DB.prepare(sql).all();
		expect(viaAdapter.results).toEqual(viaD1.results);
	});

	it("raw() returns arrays, optionally with column names", async () => {
		const rows = await adapter().prepare("SELECT name, n FROM _adapter_t WHERE name = 'alpha'").raw();
		expect(rows).toEqual([["alpha", 1]]);
		const withCols = await adapter().prepare("SELECT name, n FROM _adapter_t WHERE name = 'alpha'").raw({ columnNames: true });
		expect(withCols).toEqual([["name", "n"], ["alpha", 1]]);
	});

	it("batch() returns one D1Result per statement in order", async () => {
		const db = adapter();
		const [ins, upd, sel] = await db.batch([
			db.prepare("INSERT OR IGNORE INTO _adapter_t (name) VALUES (?1)").bind("delta"),
			db.prepare("UPDATE _adapter_t SET n = n + 1 WHERE name = ?1").bind("delta"),
			db.prepare("SELECT n FROM _adapter_t WHERE name = ?1").bind("delta"),
		]);
		expect(ins!.meta.changes).toBe(1);
		expect(upd!.meta.changes).toBe(1);
		expect(sel!.results).toEqual([{ n: 1 }]);
		expect(await db.batch([])).toEqual([]);
	});

	it("bind() rejects undefined like D1 and converts Date/booleans", async () => {
		expect(() => adapter().prepare("SELECT ?1").bind(undefined)).toThrow(/D1_TYPE_ERROR/);
		const row = await adapter().prepare("SELECT ?1 AS d").bind(new Date("2026-11-26T00:00:00.000Z")).first<{ d: string }>();
		expect(row?.d).toBe("2026-11-26T00:00:00.000Z");
	});
});

describe("resolveEnv / DB_DRIVER", () => {
	const base = { DB: env.DB, JWT_SECRET: "s" } as unknown as Env;

	it("defaults to D1 and returns the env untouched", () => {
		expect(dbDriver({})).toBe("d1");
		expect(dbDriver({ DB_DRIVER: "anything-else" })).toBe("d1");
		expect(resolveEnv(base)).toBe(base);
	});

	it("treats local as an alias of d1: env.DB untouched", () => {
		const local = { ...base, DB_DRIVER: "local" } as Env;
		expect(dbDriver(local)).toBe("local");
		expect(resolveEnv(local)).toBe(local);
	});

	it("fails closed when turso is selected without credentials", () => {
		expect(() => resolveEnv({ ...base, DB_DRIVER: "turso" } as Env)).toThrow(/TURSO_DATABASE_URL/);
	});

	it("swaps only DB for turso; other bindings stay reachable", () => {
		const raw = { ...base, DB_DRIVER: "turso", TURSO_DATABASE_URL: "libsql://example-org.turso.io", TURSO_AUTH_TOKEN: "t" } as Env;
		const resolved = resolveEnv(raw);
		expect(resolved.DB).not.toBe(env.DB);
		expect(typeof resolved.DB.prepare).toBe("function");
		expect(resolved.JWT_SECRET).toBe("s");
		expect(resolveEnv(raw).DB).toBe(resolved.DB); // adapter reused per isolate
	});
});
