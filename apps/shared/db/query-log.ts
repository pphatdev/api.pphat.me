/**
 * Development-only query logging: prints rows read for every statement and
 * warns when one statement reads more than ROWS_READ_WARNING rows.
 *
 * Enabled with `DB_QUERY_LOG=1` (e.g. in .env for `wrangler dev`). Off in
 * production. Uses D1's `meta.rows_read`, which is what D1 and Turso bill on.
 */

export const ROWS_READ_WARNING = 1000;

type Meta = { rows_read?: number; duration?: number };

/** Logged statement proxy -> the real D1 statement and its SQL. */
const registry = new WeakMap<object, { target: D1PreparedStatement; sql: string }>();

function logQuery(sql: string, meta: Meta | undefined): void {
	const rows = meta?.rows_read ?? 0;
	const line = `[db] ${rows} rows read · ${Math.round(meta?.duration ?? 0)}ms · ${sql.replace(/\s+/g, ' ').trim().slice(0, 160)}`;
	if (rows > ROWS_READ_WARNING) console.warn(`${line}  <-- over ${ROWS_READ_WARNING} rows: missing index?`);
	else console.log(line);
}

function wrapStatement(target: D1PreparedStatement, sql: string): D1PreparedStatement {
	const proxy = new Proxy(target, {
		get(t, prop) {
			if (prop === 'bind') return (...values: unknown[]) => wrapStatement(t.bind(...values), sql);
			if (prop === 'all' || prop === 'run') {
				return async () => {
					const res = await t[prop]();
					logQuery(sql, res.meta);
					return res;
				};
			}
			if (prop === 'first') {
				// first() exposes no meta; run all() (same rows read) and take row 0.
				return async (column?: string) => {
					const res = await t.all<Record<string, unknown>>();
					logQuery(sql, res.meta);
					const row = res.results[0];
					if (!row) return null;
					return column === undefined ? row : (row[column] ?? null);
				};
			}
			const value = Reflect.get(t, prop, t);
			return typeof value === 'function' ? value.bind(t) : value;
		},
	});
	registry.set(proxy, { target, sql });
	return proxy;
}

/**
 * @description Wrap `env.DB` with query logging when `DB_QUERY_LOG=1`.
 * @param { Env } env The Worker env
 * @returns { Env } The same env, or one whose DB logs rows read per query
 */
export function withQueryLog(env: Env): Env {
	if (env.DB_QUERY_LOG !== '1') return env;
	const logged = new Proxy(env.DB, {
		get(db, prop) {
			if (prop === 'prepare') return (sql: string) => wrapStatement(db.prepare(sql), sql);
			if (prop === 'batch') {
				return async (stmts: D1PreparedStatement[]) => {
					// D1 needs its own statement objects: unwrap the proxies.
					const entries = stmts.map((s) => registry.get(s) ?? { target: s, sql: '(unlogged statement)' });
					const results = await db.batch(entries.map((e) => e.target));
					results.forEach((res, i) => logQuery(entries[i]!.sql, res.meta));
					return results;
				};
			}
			const value = Reflect.get(db, prop, db);
			return typeof value === 'function' ? value.bind(db) : value;
		},
	});
	return Object.create(env, { DB: { value: logged, enumerable: true } }) as Env;
}
