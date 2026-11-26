// Seed an EMPTY Turso database from a D1 export (`wrangler d1 export`).
//
//   node scripts/turso/seed-from-backup.mjs [backups/d1-remote-<ts>.sql]
//
// Why not pipe the dump in directly: D1 exports insert child rows before their
// parent tables exist, and Turso enforces foreign keys. So the dump is first
// restored into an in-memory SQLite (FKs off, as verified for the backup), then
// copied to Turso table by table in parent-before-child order with FKs on.
//
// Safety: refuses to run unless the target has no tables. Never drops anything.
// Verification: integrity_check, foreign_key_check, per-table row counts vs the
// backup manifest, and a SHA-256 of every table's rows on both sides.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tursoClient } from './env.mjs';

const MAX_BATCH_STATEMENTS = 200;
const MAX_BATCH_BYTES = 512 * 1024;

function latestFullDump() {
    const files = readdirSync('backups')
        .filter((f) => /^d1-remote-.*\.sql$/.test(f) && !f.includes('data-only'))
        .sort();
    if (!files.length) throw new Error('No backups/d1-remote-*.sql found. Run `wrangler d1 export` first.');
    return `backups/${files.at(-1)}`;
}

const dumpPath = process.argv[2] ?? latestFullDump();
const manifestPath = dumpPath.replace(/\.sql$/, '.manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;

// ---- 1. Restore the dump locally (FKs off: the dump's order needs it) ------
const local = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false });
local.exec(readFileSync(dumpPath, 'utf8'));

const tables = local
    .prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name")
    .all();
const indexes = local
    .prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY name")
    .all();
const others = local.prepare("SELECT type, name FROM sqlite_master WHERE type IN ('trigger','view')").all();
if (others.length) throw new Error(`Unsupported objects in dump: ${others.map((o) => `${o.type} ${o.name}`).join(', ')}`);

// ---- 2. Parent-before-child order from the FK graph ------------------------
const names = new Set(tables.map((t) => t.name));
const deps = new Map(
    tables.map((t) => [
        t.name,
        new Set(
            local
                .prepare(`PRAGMA foreign_key_list("${t.name}")`)
                .all()
                .map((fk) => fk.table)
                .filter((p) => p !== t.name && names.has(p)),
        ),
    ]),
);
const order = [];
const visiting = new Set();
const visit = (name) => {
    if (order.includes(name)) return;
    if (visiting.has(name)) throw new Error(`Foreign-key cycle involving ${name}`);
    visiting.add(name);
    for (const parent of deps.get(name)) visit(parent);
    visiting.delete(name);
    order.push(name);
};
[...names].sort().forEach(visit);

// ---- 3. Target must be empty ------------------------------------------------
const { client, host } = tursoClient();
const existing = (await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")).rows;
if (existing.length) {
    console.error(`Refusing to seed ${host}: it already has ${existing.length} table(s). Use an empty database.`);
    process.exit(1);
}
console.log(`Seeding ${host} from ${dumpPath}`);
console.log(`  ${tables.length} tables, ${indexes.length} indexes; order: ${order.join(' → ')}\n`);

// ---- 4. Schema, data, indexes ------------------------------------------------
await client.batch(tables.map((t) => t.sql), 'write');

const toArg = (v) => (v instanceof Uint8Array ? v : v);
let totalRows = 0;
for (const table of order) {
    const cols = local.prepare(`PRAGMA table_info("${table}")`).all().map((c) => c.name);
    const insertSql = `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
    const rows = local.prepare(`SELECT * FROM "${table}" ORDER BY rowid`).all();

    let batch = [];
    let bytes = 0;
    const flush = async () => {
        if (!batch.length) return;
        await client.batch(batch, 'write');
        batch = [];
        bytes = 0;
    };
    for (const row of rows) {
        const args = cols.map((c) => toArg(row[c]));
        batch.push({ sql: insertSql, args });
        bytes += JSON.stringify(args).length;
        if (batch.length >= MAX_BATCH_STATEMENTS || bytes >= MAX_BATCH_BYTES) await flush();
    }
    await flush();
    totalRows += rows.length;
    console.log(`  ${table.padEnd(26)} ${String(rows.length).padStart(6)} rows`);
}

if (indexes.length) await client.batch(indexes.map((i) => i.sql), 'write');
console.log(`\nCopied ${totalRows} rows; created ${indexes.length} indexes.\n`);

// ---- 5. Verify ---------------------------------------------------------------
const canonical = (v) => {
    if (v === null || v === undefined) return null;
    if (v instanceof Uint8Array || v instanceof ArrayBuffer) return `hex:${Buffer.from(v instanceof ArrayBuffer ? new Uint8Array(v) : v).toString('hex')}`;
    if (typeof v === 'bigint') return Number(v);
    return v;
};
const hashRows = (cols, rows) => {
    const h = createHash('sha256');
    for (const row of rows) h.update(JSON.stringify(cols.map((c) => canonical(row[c]))) + '\n');
    return h.digest('hex');
};

const integrity = (await client.execute('PRAGMA integrity_check')).rows[0].integrity_check;
const fkViolations = (await client.execute('PRAGMA foreign_key_check')).rows.length;
let mismatches = 0;
console.log(`${'table'.padEnd(26)}${'backup'.padStart(8)}${'turso'.padStart(8)}  content`);
for (const table of [...names].sort()) {
    const cols = local.prepare(`PRAGMA table_info("${table}")`).all().map((c) => c.name);
    const select = `SELECT ${cols.map((c) => `"${c}"`).join(', ')} FROM "${table}" ORDER BY rowid`;
    const localRows = local.prepare(select).all();
    const remoteRows = (await client.execute(select)).rows;
    const sameHash = hashRows(cols, localRows) === hashRows(cols, remoteRows);
    const expected = manifest?.verification?.row_counts?.[table];
    const ok = sameHash && localRows.length === remoteRows.length && (expected === undefined || expected === remoteRows.length);
    if (!ok) mismatches++;
    console.log(`${table.padEnd(26)}${String(localRows.length).padStart(8)}${String(remoteRows.length).padStart(8)}  ${sameHash ? 'sha256 match' : 'SHA256 MISMATCH'}${ok ? '' : '  <--'}`);
}
console.log(`\nintegrity_check=${integrity}  foreign_key_check violations=${fkViolations}  table mismatches=${mismatches}`);
client.close();
process.exit(integrity === 'ok' && fkViolations === 0 && mismatches === 0 ? 0 : 1);
