import 'dotenv/config';
import { dispatchNotifications } from './dispatch-notifications.mjs';
import { pool } from '../backend/db/pool.mjs';

const intervalMs = Math.max(5000, Number(process.env.NOTIFICATION_WORKER_INTERVAL_MS || 10000));
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const processed = await dispatchNotifications();
    if (processed) console.log(`Processed ${processed} notification(s).`);
  } catch (error) {
    console.error(`Notification worker: ${error.message}`);
  } finally {
    running = false;
  }
}

await tick();
const timer = setInterval(tick, intervalMs);
const shutdown = async signal => {
  clearInterval(timer);
  console.log(`Notification worker stopping (${signal}).`);
  await pool.end();
  process.exit(0);
};
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
