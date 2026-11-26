// Live D1-parity check of the libSQL adapter against the Turso database in .env.
//
//   node scripts/turso/conformance.mjs
//
// Uses only temporary `_conf_*` tables, always dropped in `finally`. Exits 1 on
// any failed check. Covers the libSQL behaviours this codebase relies on.
import { createClient } from '@libsql/client/web';
import { LibsqlD1Database } from '../../apps/shared/db/libsql-d1.ts';
import { loadEnvFile } from './env.mjs';

const env = { ...loadEnvFile(), ...process.env };
if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
    console.error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set.');
    process.exit(1);
}
const db = new LibsqlD1Database(createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN, intMode: 'number' }));

let failed = 0;
const check = async (name, fn) => {
    try {
        await fn();
        console.log(`PASS  ${name}`);
    } catch (err) {
        failed++;
        console.log(`FAIL  ${name}\n      ${err instanceof Error ? err.message : err}`);
    }
};
const assert = (cond, msg) => {
    if (!cond) throw new Error(msg);
};
const errorOf = async (p) => {
    try {
        await p;
    } catch (e) {
        return e instanceof Error ? e.message : String(e);
    }
    throw new Error('expected an error, got success');
};

const SETUP = [
    'CREATE TABLE _conf_parent (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE)',
    'CREATE TABLE _conf_child (id INTEGER PRIMARY KEY, parent_id INTEGER NOT NULL REFERENCES _conf_parent(id))',
    'CREATE TABLE _conf_marker (k TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (k, day))',
    'CREATE TABLE _conf_counter (id TEXT PRIMARY KEY, views INTEGER NOT NULL DEFAULT 0)',
];
const TEARDOWN = ['_conf_child', '_conf_parent', '_conf_marker', '_conf_counter'].map((t) => `DROP TABLE IF EXISTS ${t}`);

try {
    for (const sql of TEARDOWN) await db.prepare(sql).run();
    for (const sql of SETUP) await db.prepare(sql).run();

    await check('run(): changes + numeric last_row_id', async () => {
        const res = await db.prepare('INSERT INTO _conf_parent (name) VALUES (?1)').bind('p1').run();
        assert(res.meta.changes === 1, `changes=${res.meta.changes}`);
        assert(typeof res.meta.last_row_id === 'number' && res.meta.last_row_id > 0, `last_row_id=${res.meta.last_row_id}`);
    });

    await check('integers come back as number', async () => {
        const row = await db.prepare('SELECT id, 9007199254740991 AS big, COUNT(*) AS c FROM _conf_parent').first();
        assert(typeof row.id === 'number' && typeof row.c === 'number', JSON.stringify(row));
    });

    await check("changes() inside batch refers to the previous statement (view dedupe)", async () => {
        const visit = () =>
            db.batch([
                db.prepare("INSERT OR IGNORE INTO _conf_marker (k, day) VALUES ('v1', date('now'))"),
                db.prepare("INSERT INTO _conf_counter (id, views) SELECT 'a', 1 WHERE changes() > 0 ON CONFLICT(id) DO UPDATE SET views = views + 1"),
            ]);
        const [first] = await visit();
        const [second] = await visit();
        const views = await db.prepare("SELECT views FROM _conf_counter WHERE id = 'a'").first('views');
        assert(first.meta.changes === 1 && second.meta.changes === 0, `marker changes ${first.meta.changes}/${second.meta.changes}`);
        assert(views === 1, `views=${views} (expected 1: second visit must not count)`);
    });

    await check('foreign keys are enforced', async () => {
        const msg = await errorOf(db.prepare('INSERT INTO _conf_child (id, parent_id) VALUES (1, 999)').run());
        assert(msg.includes('FOREIGN KEY constraint failed'), msg);
    });

    await check("UNIQUE error message keeps 'UNIQUE constraint failed: <table>.<col>'", async () => {
        const msg = await errorOf(db.prepare('INSERT INTO _conf_parent (name) VALUES (?1)').bind('p1').run());
        assert(msg.includes('UNIQUE constraint failed: _conf_parent.name'), msg);
    });

    await check('batch is atomic (failure rolls back earlier statements)', async () => {
        await errorOf(
            db.batch([
                db.prepare("INSERT INTO _conf_parent (name) VALUES ('rolled-back')"),
                db.prepare('INSERT INTO _conf_child (id, parent_id) VALUES (2, 999)'),
            ]),
        );
        const n = await db.prepare("SELECT COUNT(*) AS n FROM _conf_parent WHERE name = 'rolled-back'").first('n');
        assert(n === 0, `rolled-back row present (n=${n})`);
    });

    await check("datetime('now') / date('now') formats match D1", async () => {
        const row = await db.prepare("SELECT datetime('now') AS dt, date('now') AS d").first();
        assert(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(row.dt), row.dt);
        assert(/^\d{4}-\d{2}-\d{2}$/.test(row.d), row.d);
    });

    await check('first(col) and raw() shapes', async () => {
        assert((await db.prepare("SELECT name FROM _conf_parent WHERE name='p1'").first('name')) === 'p1', 'first(col)');
        const raw = await db.prepare("SELECT id, name FROM _conf_parent WHERE name='p1'").raw({ columnNames: true });
        assert(JSON.stringify(raw[0]) === '["id","name"]' && raw[1][1] === 'p1', JSON.stringify(raw));
    });

    await check('seeded data readable through the adapter', async () => {
        const { results } = await db.prepare('SELECT COUNT(*) AS n FROM articles').all();
        assert(results[0].n > 0, `articles=${results[0].n}`);
    });
} finally {
    for (const sql of TEARDOWN) await db.prepare(sql).run().catch(() => {});
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
