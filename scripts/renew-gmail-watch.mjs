import { env } from '../backend/config/env.mjs';
import { pool } from '../backend/db/pool.mjs';
import { renewGmailWatch } from '../backend/modules/orders/gmail-reconciliation.mjs';

try {
  if (!env.gmail.enabled) throw new Error('Gmail đối soát đang tắt. Bật GMAIL_RECONCILIATION_ENABLED sau khi đã điền đủ cấu hình.');
  const result = await renewGmailWatch();
  console.log(JSON.stringify(result));
} finally {
  await pool.end();
}
