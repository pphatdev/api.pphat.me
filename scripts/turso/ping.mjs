// Connectivity check: prints host, SQLite version, FK setting and existing tables.
import { tursoClient } from './env.mjs';

const { client, host } = tursoClient();
const version = (await client.execute('SELECT sqlite_version() AS v')).rows[0].v;
const fk = (await client.execute('PRAGMA foreign_keys')).rows[0]?.foreign_keys;
const tables = (await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).rows.map((r) => r.name);
console.log(JSON.stringify({ host, sqliteVersion: version, foreignKeys: fk, tables }, null, 2));
client.close();
