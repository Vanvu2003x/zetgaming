import { assertProductionConfig, env } from './config/env.mjs';
import { pool } from './db/pool.mjs';
import { createApp } from './app.mjs';

assertProductionConfig();
const app = createApp();
const server = app.listen(env.port, '127.0.0.1', () => console.log(`ZetGaming API listening at http://localhost:${env.port}`));
const shutdown = async () => { server.close(async () => { await pool.end(); process.exit(0); }); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
