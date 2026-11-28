// Local dev launcher: `npm run dev` / `npm run dev:turso` / `npm run db:setup`.
//
// For DB_DRIVER=local|d1 it prepares the local D1 (the SQLite copy in
// .wrangler/) before starting the Worker:
//   1. apply pending migrations (wrangler tracks which ran; no-op when current)
//   2. on a fresh database (no tech_stacks rows): load scripts/seed.sql
//   3. on a fresh database: upsert the admin user when ADMIN_EMAIL and
//      ADMIN_PASSWORD are set (scripts/create-admin.js)
// Turso is never touched here; use the db:turso:* scripts for it.
//
// Driver: CLI arg (local | d1 | turso) > $DB_DRIVER > DB_DRIVER in the env
// file wrangler reads (.dev.vars, else .env) > local.
//
// Flags: --setup-only  prepare the local DB and exit (no server)
//        --no-setup    skip DB preparation
// Any other args are passed to `wrangler dev` (e.g. --port 8788).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { loadEnvFile } from './turso/env.mjs';

const DRIVERS = new Set(['local', 'd1', 'turso']);
const WRANGLER_BIN = join('node_modules', 'wrangler', 'bin', 'wrangler.js');

const argv = process.argv.slice(2);
const setupOnly = argv.includes('--setup-only');
const noSetup = argv.includes('--no-setup');
const driverArg = argv.find((a) => DRIVERS.has(a));
const wranglerArgs = argv.filter((a) => a !== '--setup-only' && a !== '--no-setup' && a !== driverArg);

// The Worker's DB_DRIVER: wrangler loads .dev.vars and ignores .env when both
// exist, so mirror that. Script-only settings (ADMIN_*) may live in either.
const workerEnvFile = existsSync('.dev.vars') ? '.dev.vars' : '.env';
const workerDriver = process.env.DB_DRIVER ?? loadEnvFile(workerEnvFile).DB_DRIVER;
const env = { ...loadEnvFile('.env'), ...loadEnvFile('.dev.vars'), ...process.env };

const driver = driverArg ?? (DRIVERS.has(workerDriver) ? workerDriver : 'local');

if (!existsSync(WRANGLER_BIN)) {
    console.error(`wrangler not installed at ${WRANGLER_BIN}. Run \`npm install\`.`);
    process.exit(1);
}

/** @description Run wrangler synchronously, non-interactive (no confirm prompts). */
function wrangler(args, { capture = false } = {}) {
    const r = spawnSync(process.execPath, [WRANGLER_BIN, ...args], {
        stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
        encoding: 'utf8',
        env: { ...process.env, CI: '1' },
    });
    if (r.status !== 0) {
        console.error(`\n[dev] wrangler ${args.slice(0, 3).join(' ')} failed.`);
        process.exit(r.status ?? 1);
    }
    return r.stdout;
}

/** @description Rows in tech_stacks on the local D1; 0 means a fresh database. */
function seededRowCount() {
    const out = wrangler(['d1', 'execute', 'api', '--local', '--json', '--command', 'SELECT COUNT(*) AS n FROM tech_stacks'], { capture: true });
    try {
        return JSON.parse(out)[0].results[0].n;
    } catch {
        console.error('[dev] could not read tech_stacks row count:\n' + out);
        process.exit(1);
    }
}

function prepareLocalDb() {
    console.log('[dev] local D1: applying migrations...');
    wrangler(['d1', 'migrations', 'apply', 'api', '--local']);

    if (seededRowCount() > 0) {
        console.log('[dev] local D1: already seeded, skipping seed.');
        return;
    }

    console.log('[dev] local D1: fresh database, loading scripts/seed.sql...');
    wrangler(['d1', 'execute', 'api', '--local', '--file', join('scripts', 'seed.sql')]);

    if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
        console.log('[dev] local D1: creating admin user...');
        const r = spawnSync(process.execPath, [join('scripts', 'create-admin.js')], {
            stdio: 'inherit',
            env: { ...process.env, ADMIN_EMAIL: env.ADMIN_EMAIL, ADMIN_PASSWORD: env.ADMIN_PASSWORD, ADMIN_NAME: env.ADMIN_NAME ?? '', ADMIN_TARGET: 'local', CI: '1' },
        });
        if (r.status !== 0) process.exit(r.status ?? 1);
    } else {
        console.log(`[dev] local D1: no admin user (set ADMIN_EMAIL and ADMIN_PASSWORD in .env, then \`npm run db:create-admin\`).`);
    }
}

if (driver !== 'turso' && !noSetup) prepareLocalDb();
if (setupOnly) process.exit(0);

console.log(`[dev] starting wrangler dev with DB_DRIVER=${driver}`);
const child = spawn(process.execPath, [WRANGLER_BIN, 'dev', '--var', `DB_DRIVER:${driver}`, ...wranglerArgs], { stdio: 'inherit' });
child.on('exit', (code, signal) => process.exit(signal ? 1 : code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
