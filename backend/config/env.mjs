import 'dotenv/config';

const bool = (value, fallback = false) => value === undefined ? fallback : value === 'true' || value === '1';

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.BACKEND_PORT || 4180),
  databaseUrl: process.env.DATABASE_URL || '',
  databaseSsl: bool(process.env.DATABASE_SSL),
  sessionSecret: process.env.SESSION_SECRET || '',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:4173',
  allowedOrigins: [...new Set([
    ...(process.env.FRONTEND_ORIGIN || 'http://localhost:4173').split(','),
    process.env.ADMIN_ORIGIN || (process.env.NODE_ENV !== 'production' ? 'http://localhost:4174' : ''),
  ].map(value => value.trim()).filter(Boolean))],
  seedDemo: bool(process.env.SEED_DEMO),
  resetDelivery: process.env.RESET_DELIVERY || 'disabled',
  emailDelivery: process.env.EMAIL_DELIVERY || 'disabled',
  emailFrom: process.env.EMAIL_FROM || 'no-reply@localhost',
  emailWebhookUrl: process.env.EMAIL_WEBHOOK_URL || '',
  emailWebhookToken: process.env.EMAIL_WEBHOOK_TOKEN || '',
  emailVerificationRequired: bool(process.env.EMAIL_VERIFICATION_REQUIRED),
  notificationEmailEvents: new Set((process.env.NOTIFICATION_EMAIL_EVENTS || 'order.created,order.payment_confirmed,order.admin_completed,order.cancelled,order.refund_paid').split(',').map(value => value.trim()).filter(Boolean)),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  zalo: {
    enabled: bool(process.env.ZALO_ENABLED),
    webhookUrl: process.env.ZALO_WEBHOOK_URL || '',
    accessToken: process.env.ZALO_ACCESS_TOKEN || '',
    groupId: process.env.ZALO_GROUP_ID || '',
  },
  bank: { bin: process.env.BANK_BIN || '', label: process.env.BANK_LABEL || '', account: process.env.BANK_ACCOUNT || '', name: process.env.BANK_ACCOUNT_NAME || '' },
  reconciliationProvider: process.env.RECONCILIATION_PROVIDER || 'manual',
  web2mWebhookToken: process.env.WEB2M_WEBHOOK_TOKEN || '',
  web2mApiBaseUrl: process.env.WEB2M_API_BASE_URL || '',
  web2mApiToken: process.env.WEB2M_API_TOKEN || '',
  gmail: {
    enabled: bool(process.env.GMAIL_RECONCILIATION_ENABLED),
    userEmail: process.env.GMAIL_RECEIVING_EMAIL || '',
    clientId: process.env.GMAIL_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.GMAIL_OAUTH_CLIENT_SECRET || '',
    refreshToken: process.env.GMAIL_REFRESH_TOKEN || '',
    pubsubTopic: process.env.GMAIL_PUBSUB_TOPIC || '',
    pubsubAudience: process.env.GMAIL_PUBSUB_AUDIENCE || '',
    pubsubServiceAccount: process.env.GMAIL_PUBSUB_SERVICE_ACCOUNT || '',
    sender: process.env.ACB_SENDER_EMAIL || '',
    watchLabel: process.env.GMAIL_WATCH_LABEL || 'INBOX',
  },
  khoablack: {
    baseUrl: (process.env.KHOABLACK_BASE_URL || 'https://khoablacktopup.com/agent').replace(/\/$/, ''),
    apiKey: process.env.KHOABLACK_API_KEY || '',
    callbackUrl: process.env.KHOABLACK_CALLBACK_URL || '',
    timeoutMs: Number(process.env.KHOABLACK_TIMEOUT_MS || 15000),
    enabled: bool(process.env.KHOABLACK_ENABLED),
    autoFulfill: bool(process.env.KHOABLACK_AUTO_FULFILL),
  },
  oauth: {
    google: { clientId: process.env.GOOGLE_CLIENT_ID || '', clientSecret: process.env.GOOGLE_CLIENT_SECRET || '', callbackUrl: process.env.GOOGLE_CALLBACK_URL || '' },
    facebook: { clientId: process.env.FACEBOOK_CLIENT_ID || '', clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '', callbackUrl: process.env.FACEBOOK_CALLBACK_URL || '' },
  },
};

export function assertProductionConfig() {
  if (!env.databaseUrl || env.sessionSecret.length < 32) {
    throw new Error('DATABASE_URL và SESSION_SECRET (>=32 ký tự) là bắt buộc');
  }
  if (!env.databaseUrl) throw new Error('Thiếu DATABASE_URL cho backend PostgreSQL');
}
