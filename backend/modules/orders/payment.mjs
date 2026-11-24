import { env } from '../../config/env.mjs';

export function bankPayment(order, bank = env.bank) {
  if (order.payment_method !== 'direct' || order.status !== 'awaiting_payment') return null;
  if (!/^\d{6}$/.test(bank.bin) || !/^\d{6,30}$/.test(bank.account) || !bank.name.trim()) return null;
  const cents = Number(order.price_cents);
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents % 100 !== 0 || !/^[A-Z0-9]+$/.test(order.code)) return null;
  const content = `zet${order.code}zet`;
  const params = new URLSearchParams({ amount: String(cents / 100), addInfo: content, accountName: bank.name });
  return { bank: bank.label, account: bank.account, name: bank.name, content, amount_cents: cents,
    qr_url: `https://img.vietqr.io/image/${bank.bin}-${bank.account}-compact2.png?${params}` };
}
