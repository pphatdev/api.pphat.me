const { webcrypto } = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

// Load environment variables from .env or .dev.vars if present
try {
    require('dotenv').config();
} catch {}
if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    const envFile = fs.existsSync('.env') ? '.env' : (fs.existsSync('.dev.vars') ? '.dev.vars' : null);
    if (envFile) {
        const lines = fs.readFileSync(envFile, 'utf8').split('\n');
        for (const line of lines) {
            const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (m && !process.env[m[1]]) {
                let v = (m[2] || '').trim();
                if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
                    v = v.slice(1, -1);
                }
                process.env[m[1]] = v;
            }
        }
    }
}

const email = process.env.ADMIN_EMAIL || process.env.SMTP_USER || process.argv[2];
const password = process.env.ADMIN_PASSWORD || process.argv[3];
/**
 * Display name from a "from" address: `"Pphat" <hi@pphat.me>` -> `Pphat`.
 * Takes the text before the first `<` rather than regex-stripping `<...>`,
 * which CodeQL flags (js/incomplete-multi-character-sanitization).
 * @param { string } from The SMTP_FROM value
 * @returns { string | null } The display name, or null if there is none
 */
function displayNameFrom(from) {
    const lt = from.indexOf('<');
    const display = (lt === -1 ? from : from.slice(0, lt)).replace(/["']/g, '').trim();
    return display || null;
}

const name = process.env.ADMIN_NAME || process.argv[4] || (process.env.SMTP_FROM && displayNameFrom(process.env.SMTP_FROM)) || 'Admin';
const target = (process.env.ADMIN_TARGET || 'local').toLowerCase();

if (!email || !password) {
    console.error('Usage:');
    console.error('  ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=secretpass npm run db:create-admin');
    console.error('  # or');
    console.error('  node scripts/create-admin.js <email> <password> [name]');
    console.error('  # target remote D1: ADMIN_TARGET=remote npm run db:create-admin');
    process.exit(1);
}

if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
}

if (target !== 'local' && target !== 'remote') {
    console.error(`Invalid ADMIN_TARGET: ${target}. Use "local" or "remote".`);
    process.exit(1);
}

async function hashPassword(pw) {
    const salt = webcrypto.getRandomValues(new Uint8Array(16));
    const km = await webcrypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(pw),
        'PBKDF2',
        false,
        ['deriveBits'],
    );
    const bits = await webcrypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 },
        km,
        256,
    );
    const hex = (buf) => Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex(salt)}:${hex(new Uint8Array(bits))}`;
}

const sqlQuote = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

async function main() {
    const id = webcrypto.randomUUID();
    const hash = await hashPassword(password);
    const sql = [
        'INSERT INTO users (id, provider, provider_id, email, name, avatar, email_verified, password_hash, role)',
        `VALUES (${sqlQuote(id)}, 'email', ${sqlQuote(email)}, ${sqlQuote(email)}, ${sqlQuote(name)}, NULL, 1, ${sqlQuote(hash)}, 'admin')`,
        'ON CONFLICT(provider, provider_id) DO UPDATE SET',
        '  password_hash = excluded.password_hash,',
        "  role = 'admin',",
        '  email_verified = 1,',
        '  name = excluded.name,',
        "  updated_at = datetime('now');",
    ].join('\n');

    const tmp = path.join(os.tmpdir(), `create-admin-${Date.now()}.sql`);
    fs.writeFileSync(tmp, sql);

    const WRANGLER_BIN = path.join('node_modules', 'wrangler', 'bin', 'wrangler.js');
    if (!fs.existsSync(WRANGLER_BIN)) {
        console.error(`wrangler not installed at ${WRANGLER_BIN}. Run \`npm install\`.`);
        try { fs.unlinkSync(tmp); } catch {}
        process.exit(1);
    }
    const args = [WRANGLER_BIN, 'd1', 'execute', 'api', `--${target}`, '--file', tmp];
    const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
    try { fs.unlinkSync(tmp); } catch {}

    if (r.status !== 0) {
        console.error('wrangler d1 execute failed.');
        process.exit(r.status ?? 1);
    }
    console.log(`\nAdmin user upserted on ${target} D1:`);
    console.log(`  email:          ${email}`);
    console.log(`  name:           ${name}`);
    console.log(`  role:           admin`);
    console.log(`  email_verified: 1`);
}

main().catch((e) => { console.error(e); process.exit(1); });
