/**
 * D1-compatible database backed by Turso / libSQL.
 *
 * Implements the subset of Cloudflare's `D1Database` API this codebase uses
 * (`prepare` → `bind` → `first` / `all` / `run` / `raw`, `batch`, `exec`) on
 * top of `@libsql/client/web`, so every repository keeps working unchanged
 * when `env.DB` is swapped for it (see `resolveEnv` in ./index.ts).
 *
 * Not implemented (unused here): `withSession` (Turso has one primary) and the
 * deprecated `dump` — calling them through the D1Database type fails loudly.
 *
 * Semantics kept identical to D1:
 * - `first()` → first row object or null; `first(col)` → that column or null.
 * - `run()` / `all()` → `{ success: true, results, meta: { changes, last_row_id, … } }`.
 * - `batch()` → one transaction ('write' mode); `changes()` inside a statement
 *   refers to the previous statement in the batch, as on D1.
 * - `bind(undefined)` throws, like D1's D1_TYPE_ERROR.
 *
 * Written without TS-only syntax (no parameter properties / enums) so Node can
 * load it with type stripping for the live conformance script.
 */
import type { Client, InStatement, InValue, ResultSet } from '@libsql/client/web';

type BindValue = InValue;

function toBindValue(value: unknown, index: number): BindValue {
	if (value === undefined) {
		throw new Error(`D1_TYPE_ERROR: Type 'undefined' not supported for value at index ${index}`);
	}
	if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
		return value;
	}
	if (value instanceof ArrayBuffer) return value;
	if (ArrayBuffer.isView(value)) {
		return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
	}
	if (value instanceof Date) return value.toISOString();
	throw new Error(`D1_TYPE_ERROR: Type '${typeof value}' not supported for value at index ${index}`);
}

/** Convert a libSQL row (array-like with column keys) into a plain object. */
function rowToObject(columns: string[], row: ArrayLike<unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (let i = 0; i < columns.length; i++) out[columns[i]!] = row[i];
	return out;
}

function toMeta(rs: ResultSet, durationMs: number): D1Meta & Record<string, unknown> {
	const changes = rs.rowsAffected ?? 0;
	return {
		duration: durationMs,
		size_after: 0,
		rows_read: 0,
		rows_written: changes,
		last_row_id: rs.lastInsertRowid === undefined ? 0 : Number(rs.lastInsertRowid),
		changed_db: changes > 0,
		changes,
		served_by: 'libsql',
	};
}

function toResult<T>(rs: ResultSet, durationMs: number): D1Result<T> {
	const columns = rs.columns;
	return {
		success: true,
		meta: toMeta(rs, durationMs),
		results: rs.rows.map((row) => rowToObject(columns, row) as T),
	};
}

class LibsqlPreparedStatement {
	readonly sql: string;
	readonly args: BindValue[];
	private readonly client: Client;

	constructor(client: Client, sql: string, args: BindValue[] = []) {
		this.client = client;
		this.sql = sql;
		this.args = args;
	}

	bind(...values: unknown[]): LibsqlPreparedStatement {
		return new LibsqlPreparedStatement(this.client, this.sql, values.map(toBindValue));
	}

	/** @internal Statement in the shape the libSQL client expects. */
	toInStatement(): InStatement {
		return { sql: this.sql, args: this.args };
	}

	private async execute(): Promise<{ rs: ResultSet; ms: number }> {
		const started = Date.now();
		const rs = await this.client.execute(this.toInStatement());
		return { rs, ms: Date.now() - started };
	}

	async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
		const { rs } = await this.execute();
		const row = rs.rows[0];
		if (!row) return null;
		if (colName === undefined) return rowToObject(rs.columns, row) as T;
		const index = rs.columns.indexOf(colName);
		if (index < 0) throw new Error(`D1_COLUMN_NOTFOUND: Column not found (${colName})`);
		return (row[index] ?? null) as T;
	}

	async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
		const { rs, ms } = await this.execute();
		return toResult<T>(rs, ms);
	}

	async run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
		return this.all<T>();
	}

	async raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[]> {
		const { rs } = await this.execute();
		const rows = rs.rows.map((row) => Array.from({ length: rs.columns.length }, (_, i) => row[i]) as T);
		return options?.columnNames ? ([rs.columns as unknown as T, ...rows]) : rows;
	}
}

export class LibsqlD1Database {
	private readonly client: Client;

	constructor(client: Client) {
		this.client = client;
	}

	prepare(query: string): LibsqlPreparedStatement {
		return new LibsqlPreparedStatement(this.client, query);
	}

	async batch<T = unknown>(statements: LibsqlPreparedStatement[]): Promise<D1Result<T>[]> {
		if (statements.length === 0) return [];
		const started = Date.now();
		const results = await this.client.batch(statements.map((s) => s.toInStatement()), 'write');
		const ms = Date.now() - started;
		return results.map((rs) => toResult<T>(rs, ms));
	}

	// Part of the D1Database contract (multi-statement SQL); no current caller.
	// fallow-ignore-next-line unused-class-member
	async exec(query: string): Promise<D1ExecResult> {
		const started = Date.now();
		await this.client.executeMultiple(query);
		const count = query.split(';').filter((part) => part.trim().length > 0).length;
		return { count, duration: Date.now() - started };
	}
}

/** Narrow helper so callers can treat the adapter as Cloudflare's `D1Database`. */
export function asD1Database(db: LibsqlD1Database): D1Database {
	return db as unknown as D1Database;
}
