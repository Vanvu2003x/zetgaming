import { readFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertProductionConfig } from '../config/env.mjs';
import { pool } from './pool.mjs';

assertProductionConfig();
const dir = fileURLToPath(new URL('./migrations', import.meta.url));
await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
for (const file of (await readdir(dir)).filter(name => name.endsWith('.sql')).sort()) {
  const exists = await pool.query('SELECT 1 FROM schema_migrations WHERE version=$1', [file]);
  if (exists.rowCount) continue;
  const sql = await readFile(join(dir, file), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations(version) VALUES($1)', [file]);
    await client.query('COMMIT');
    console.log(`Applied ${file}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
await pool.end();
