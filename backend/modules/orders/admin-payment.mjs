import { Router } from 'express';
import { requireRole } from '../../middleware/auth.mjs';
import { env } from '../../config/env.mjs';

export const adminPaymentRouter = Router();
adminPaymentRouter.get('/admin/payment-settings', requireRole('admin'), (_req, res) => {
  const configured = /^\d{6}$/.test(env.bank.bin) && /^\d{6,30}$/.test(env.bank.account) && Boolean(env.bank.name.trim());
  res.set('Cache-Control','no-store').json({ bank: { configured, label: env.bank.label, account_masked: configured ? `${env.bank.account.slice(0,3)}••••${env.bank.account.slice(-3)}` : '', name: configured ? env.bank.name : '' }, qr: { provider: configured ? 'VietQR' : null }, reconciliation: { mode: env.emailWebhookUrl ? 'manual + webhook-ready' : 'manual', webhook_configured: Boolean(env.emailWebhookUrl) } });
});
