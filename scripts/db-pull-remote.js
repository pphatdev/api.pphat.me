const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

const WRANGLER_BIN = path.join('node_modules', 'wrangler', 'bin', 'wrangler.js');
const BACKUPS_DIR = path.join('backups');
const LOCAL_D1_STATE = path.join('.wrangler', 'state', 'v3', 'd1');

const FORCE = process.argv.includes('--force') || process.env.FORCE === '1';

if (!fs.existsSync(WRANGLER_BIN)) {
    console.error(`wrangler not installed at ${WRANGLER_BIN}. Run \`npm install\`.`);
    process.exit(1);
}

function runWrangler(args, opts = {}) {
    const r = spawnSync(process.execPath, [WRANGLER_BIN, ...args], { stdio: 'inherit', ...opts });
    if (r.status !== 0 && !opts.allowFailure) {
        console.error(`wrangler ${args.join(' ')} failed with exit code ${r.status}.`);
        process.exit(r.status ?? 1);
    }
    return r;
}

function confirm(question) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim().toLowerCase());
        });
    });
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function wipeLocalD1Files() {
    if (!fs.existsSync(LOCAL_D1_STATE)) {
        console.log('No local D1 state directory to wipe.');
        return;
    }
    console.log(`Wiping ${LOCAL_D1_STATE} ...`);
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            fs.rmSync(LOCAL_D1_STATE, { recursive: true, force: true });
            console.log('Wiped.');
            return;
        } catch (err) {
            if (err.code !== 'EBUSY' && err.code !== 'EPERM' && err.code !== 'ENOTEMPTY') throw err;
            if (attempt === maxAttempts) {
                console.error(`\nCould not delete ${LOCAL_D1_STATE} — file is locked by another process.`);
                console.error('Stop these processes and retry:');
                console.error('  • `wrangler dev` (npm run dev)');
                console.error('  • `drizzle-kit studio` (npm run db:studio)');
                console.error('  • any SQLite viewer that has the .sqlite file open');
                console.error(`\nUnderlying error: ${err.code} at ${err.path}`);
                throw err;
            }
            console.log(`  attempt ${attempt}/${maxAttempts} blocked (${err.code}), retrying in 1s ...`);
            await sleep(1000);
        }
    }
}

async function main() {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUPS_DIR, `d1-remote-${ts}.sql`);

    console.log(`Exporting remote D1 to ${backupFile} ...`);
    runWrangler(['d1', 'export', 'api', '--remote', '--output', backupFile]);

    const stat = fs.statSync(backupFile);
    if (stat.size === 0) {
        console.error('Backup file is empty. Aborting before touching local DB.');
        process.exit(1);
    }
    console.log(`Backup written: ${backupFile} (${stat.size} bytes)`);

    if (!FORCE) {
        const answer = await confirm(`\nAbout to REPLACE local D1 content with this backup.\nContinue? [y/N] `);
        if (answer !== 'y' && answer !== 'yes') {
            console.log('Aborted. Backup was still saved.');
            process.exit(0);
        }
    } else {
        console.log('\n--force / FORCE=1 set, skipping confirmation.');
    }

    await wipeLocalD1Files();

    console.log('Restoring backup into local D1 ...');
    runWrangler(['d1', 'execute', 'api', '--local', '--file', backupFile]);

    console.log(`\nDone. Local D1 now mirrors remote as of ${ts}.`);
    console.log(`Backup retained at: ${backupFile}`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
