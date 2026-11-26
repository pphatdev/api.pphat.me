/**
 * Database driver selection: the single integration point for the D1 → Turso
 * migration (docs/turso-migration-plan.md).
 *
 * The Worker entry (apps/app.ts) passes every request's and cron tick's `env`
 * through `resolveEnv`. With `DB_DRIVER` unset or `d1` the env is returned
 * untouched. With `DB_DRIVER=turso`, `env.DB` is replaced by a D1-compatible
 * libSQL adapter, so all modules keep calling `env.DB.prepare(...)` unchanged.
 */
import { createClient } from '@libsql/client/web';
import { LibsqlD1Database, asD1Database } from './libsql-d1';

export type DbDriver = 'd1' | 'turso';

// One adapter per (url, token) for the isolate's lifetime. The web client is
// stateless HTTP (a fetch per query), so sharing it across requests is safe.
const adapters = new Map<string, D1Database>();

/** @description The configured driver; anything other than 'turso' means D1. */
export function dbDriver(env: Pick<Env, 'DB_DRIVER'>): DbDriver {
	return env.DB_DRIVER === 'turso' ? 'turso' : 'd1';
}

function tursoDatabase(url: string, authToken: string): D1Database {
	const key = `${url}\n${authToken}`;
	let db = adapters.get(key);
	if (!db) {
		db = asD1Database(new LibsqlD1Database(createClient({ url, authToken, intMode: 'number' })));
		adapters.set(key, db);
	}
	return db;
}

/**
 * @description Return the env the app should use. Fails closed: selecting
 * Turso without credentials throws instead of silently falling back to D1.
 * @param { Env } env The raw Worker env
 * @returns { Env } The same env (D1), or one whose `DB` is the Turso adapter
 */
export function resolveEnv(env: Env): Env {
	if (dbDriver(env) !== 'turso') return env;

	const url = env.TURSO_DATABASE_URL;
	const token = env.TURSO_AUTH_TOKEN;
	if (!url || !token) {
		throw new Error('DB_DRIVER=turso requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.');
	}
	// Prototype-chain override: every other binding (AI, rate limiters,
	// secrets) is still read from the original env object.
	return Object.create(env, { DB: { value: tursoDatabase(url, token), enumerable: true } }) as Env;
}
