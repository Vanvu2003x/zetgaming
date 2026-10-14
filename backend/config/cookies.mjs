import { env } from './env.mjs';
export const sessionName = env.nodeEnv === 'production' ? '__Host-session' : 'session';
export const csrfSeedName = env.nodeEnv === 'production' ? '__Host-csrf-seed' : 'csrf_seed';
export const cookieOptions = { httpOnly: true, secure: env.nodeEnv === 'production', sameSite: 'lax', path: '/' };
