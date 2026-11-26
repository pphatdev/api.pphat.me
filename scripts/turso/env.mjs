// Shared helpers for the Turso scripts: read credentials from .env (never log them).
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@libsql/client';

/** @description Parse KEY=VALUE pairs from .env (quotes stripped, comments ignored). */
export function loadEnvFile(path = '.env') {
    const out = {};
    if (!existsSync(path)) return out;
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
        const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
        if (!m) continue;
        let value = m[2];
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
        out[m[1]] = value;
    }
    return out;
}

/** @description libSQL client for the Turso database configured in env / .env. */
export function tursoClient() {
    const env = { ...loadEnvFile(), ...process.env };
    const url = env.TURSO_DATABASE_URL;
    const authToken = env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) {
        console.error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set (in .env or the environment).');
        process.exit(1);
    }
    return { client: createClient({ url, authToken, intMode: 'number' }), host: new URL(url).host };
}
