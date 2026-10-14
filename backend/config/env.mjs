import 'dotenv/config';

const bool = (value, fallback = false) => value === undefined ? fallback : value === 'true' || value === '1';

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.BACKEND_PORT || 4180),
  databaseUrl: process.env.DATABASE_URL || '',
  databaseSsl: bool(process.env.DATABASE_SSL),
  sessionSecret: process.env.SESSION_SECRET || '',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:4173',
  allowedOrigins: (process.env.FRONTEND_ORIGIN || 'http://localhost:4173').split(',').map(value => value.trim()).filter(Boolean),
  seedDemo: bool(process.env.SEED_DEMO),
  resetDelivery: process.env.RESET_DELIVERY || 'disabled',
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
