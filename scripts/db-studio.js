const fs = require('fs');
const path = require('path');
const { spawnSync, spawn } = require('child_process');

const D1_DIR = path.join('.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
const SCHEMA_FILE = path.join('drizzle', 'schema.ts');

if (!fs.existsSync(D1_DIR)) {
    console.error(`Local D1 directory not found: ${D1_DIR}`);
    console.error('Run `npm run migrate:local` first.');
    process.exit(1);
}

const sqliteFile = fs.readdirSync(D1_DIR).find((f) => f.endsWith('.sqlite'));
if (!sqliteFile) {
    console.error(`No .sqlite file found in ${D1_DIR}`);
    console.error('Run `npm run migrate:local` to initialize the database.');
    process.exit(1);
}

const DRIZZLE_BIN = path.join('node_modules', 'drizzle-kit', 'bin.cjs');

if (!fs.existsSync(DRIZZLE_BIN)) {
    console.error(`drizzle-kit not installed at ${DRIZZLE_BIN}. Run \`npm install\`.`);
    process.exit(1);
}

/**
 * drizzle-kit v0.31 introspection emits malformed check() calls for D1's inline
 * CHECK constraints (duplicated across tables, unbalanced parens, missing commas).
 * Strip every check(...) call and remove the `check` import so studio can parse.
 */
function sanitizeSchema(file) {
    if (!fs.existsSync(file)) return;
    const original = fs.readFileSync(file, 'utf8');
    let out = original.replace(/^\s*check\([^\n]*\n/gm, '');
    out = out.replace(/,\s*check,/g, ',').replace(/\{\s*check,\s*/g, '{ ').replace(/,\s*check\s*\}/g, ' }');
    out = out.replace(/\bcheck\s*,\s*/g, '');
    if (out !== original) {
        fs.writeFileSync(file, out);
        console.log('Sanitized drizzle/schema.ts (removed buggy check() calls).');
    }
}

if (!fs.existsSync(SCHEMA_FILE)) {
    console.log('No Drizzle schema found. Introspecting local D1 into ./drizzle ...');
    const pull = spawnSync(process.execPath, [DRIZZLE_BIN, 'pull'], { stdio: 'inherit' });
    if (pull.status !== 0) {
        console.error('drizzle-kit pull failed.');
        process.exit(pull.status ?? 1);
    }
}

sanitizeSchema(SCHEMA_FILE);

console.log('Launching Drizzle Studio (Ctrl+C to stop) ...');
const proc = spawn(process.execPath, [DRIZZLE_BIN, 'studio'], { stdio: 'inherit' });
proc.on('exit', (code) => process.exit(code ?? 0));
