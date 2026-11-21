const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Determine target: CLI flag '--remote' / '--local', or env ADMIN_TARGET / SEED_TARGET
let target = 'local';
if (process.argv.includes('--remote') || process.env.ADMIN_TARGET === 'remote' || process.env.SEED_TARGET === 'remote') {
    target = 'remote';
} else if (process.argv.includes('--local')) {
    target = 'local';
}

const SEED_SQL = path.join(__dirname, 'seed.sql');
if (!fs.existsSync(SEED_SQL)) {
    console.error(`Seed SQL file not found at: ${SEED_SQL}`);
    process.exit(1);
}

const WRANGLER_BIN = path.join('node_modules', 'wrangler', 'bin', 'wrangler.js');
if (!fs.existsSync(WRANGLER_BIN)) {
    console.error(`Wrangler not installed at ${WRANGLER_BIN}. Run \`npm install\`.`);
    process.exit(1);
}

console.log(`Applying portfolio seed data to ${target} D1 database...`);

const args = [WRANGLER_BIN, 'd1', 'execute', 'api', `--${target}`, '--file', SEED_SQL];
const r = spawnSync(process.execPath, args, { stdio: 'inherit' });

if (r.status !== 0) {
    console.error('Failed to execute seed SQL on D1.');
    process.exit(r.status ?? 1);
}

console.log(`\nSeed data successfully applied to ${target} D1 database!`);
console.log('Entities seeded:');
console.log('  - tech_stacks (10 technologies)');
console.log('  - skills (8 proficiencies with levels & years)');
console.log('  - experiences (3 timeline entries with tech stack links)');
console.log('  - authors & author_details (Sophat L.)');
console.log('  - articles (3 published articles with stats & authors)');
console.log('  - projects & project_details (3 featured portfolio projects)');
console.log('  - tags (12 article and project scoped tags)');
