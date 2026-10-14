import 'dotenv/config';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import EmbeddedPostgres from 'embedded-postgres';

const databaseDir = process.env.LOCAL_PG_DATA_DIR || './data/postgres';
const port = Number(process.env.LOCAL_PG_PORT || 5432);
const user = process.env.LOCAL_PG_USER || 'postgres';
const password = process.env.LOCAL_PG_PASSWORD || 'postgres';
const database = process.env.LOCAL_PG_DATABASE || 'zetgaming';
const pg = new EmbeddedPostgres({
  databaseDir,
  port,
  user,
  password,
  persistent: true,
  authMethod: 'scram-sha-256',
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: message => console.log(`[postgres] ${message}`),
  onError: error => console.error('[postgres]', error),
});

try {
  try { await access(`${databaseDir}/PG_VERSION`, constants.F_OK); }
  catch { await pg.initialise(); }
  await pg.start();
  try { await pg.createDatabase(database); }
  catch (error) {
    if (!String(error?.message || error).includes('already exists')) throw error;
  }
  console.log(`Local PostgreSQL ready on 127.0.0.1:${port}/${database}`);
} catch (error) {
  console.error('Cannot start local PostgreSQL:', error);
  process.exitCode = 1;
}

const shutdown = async () => {
  try { await pg.stop(); }
  finally { process.exit(0); }
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
await new Promise(() => {});
