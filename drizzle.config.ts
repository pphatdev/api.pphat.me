import { defineConfig } from 'drizzle-kit';
import fs from 'node:fs';
import path from 'node:path';

const D1_DIR = path.join('.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');

function resolveLocalD1(): string {
    if (!fs.existsSync(D1_DIR)) {
        throw new Error(`Local D1 directory not found: ${D1_DIR}. Run \`npm run migrate:local\` first.`);
    }
    const file = fs.readdirSync(D1_DIR).find((f) => f.endsWith('.sqlite'));
    if (!file) {
        throw new Error(`No .sqlite file in ${D1_DIR}. Run \`npm run migrate:local\`.`);
    }
    // @libsql/client expects a `file:` URL. Use forward slashes for cross-platform safety.
    const abs = path.resolve(D1_DIR, file).replace(/\\/g, '/');
    return `file:${abs}`;
}

export default defineConfig({
    dialect: 'sqlite',
    schema: './drizzle/schema.ts',
    out: './drizzle',
    dbCredentials: {
        url: resolveLocalD1(),
    },
    verbose: false,
    strict: false,
});
