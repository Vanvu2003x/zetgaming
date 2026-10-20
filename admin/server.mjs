import 'dotenv/config';
import { createFrontend } from '../server.mjs';

if (process.env.NODE_ENV === 'production') {
  for (const key of ['ADMIN_ORIGIN', 'STOREFRONT_ORIGIN']) {
    if (!process.env[key]?.startsWith('https://')) throw new Error(`${key} phải là origin HTTPS khi chạy production`);
  }
}
const server = createFrontend({ adminOnly: true }).listen(Number(process.env.ADMIN_PORT || 4174), '127.0.0.1', () => {
  console.log(`ZetGaming Admin listening at http://localhost:${server.address().port}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
