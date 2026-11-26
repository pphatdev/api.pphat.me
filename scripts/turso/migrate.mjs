// Apply pending migrations/*.sql to the Turso database in .env.
//
//   node scripts/turso/migrate.mjs            # apply
//   node scripts/turso/migrate.mjs --dry-run  # list pending only
//
// History lives in the same `d1_migrations` table wrangler uses, so a database
// seeded from a D1 export already knows what has been applied. Files are
// applied in filename order, like `wrangler d1 migrations apply`.
import { readdirSync, readFileSync } from 'node:fs';
import { tursoClient } from './env.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const { client, host } = tursoClient();

await client.execute(`CREATE TABLE IF NOT EXISTS d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
)`);

const applied = new Set((await client.execute('SELECT name FROM d1_migrations')).rows.map((r) => r.name));
const files = readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort();
const pending = files.filter((f) => !applied.has(f));

console.log(`${host}: ${applied.size} applied, ${pending.length} pending${pending.length ? `: ${pending.join(', ')}` : ''}`);
if (DRY_RUN || pending.length === 0) {
    client.close();
    process.exit(0);
}

for (const file of pending) {
    const sql = readFileSync(`migrations/${file}`, 'utf8');
    try {
        await client.executeMultiple(sql);
        await client.execute({ sql: 'INSERT INTO d1_migrations (name) VALUES (?)', args: [file] });
        console.log(`  applied ${file}`);
    } catch (err) {
        console.error(`  FAILED ${file}: ${err instanceof Error ? err.message : err}`);
        console.error('  Stopped. Statements before the failure may have been applied; fix and re-run.');
        client.close();
        process.exit(1);
    }
}
client.close();
