import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import { createHash, randomBytes } from 'node:crypto';
import { safeNext } from '../../../storefront/shared.mjs';

const random = () => randomBytes(32).toString('base64url');
const digest = value => createHash('sha256').update(value).digest('hex');
const fail = (res, reason) => res.redirect(303, '/dang-nhap?oauth_error=' + reason);

export function validateGoogleClaims(claims, nonce) {
  if (!claims || typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255 || claims.nonce !== nonce || claims.email_verified !== true || typeof claims.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email) || claims.email.length > 254) throw new Error('Invalid Google identity');
  const email = claims.email.toLowerCase();
  return { subject: claims.sub, email, authoritativeEmail: email.endsWith('@gmail.com') || (typeof claims.hd === 'string' && claims.hd.length > 0) };
}

export async function exchangeGoogleCode(config, code, attempt) {
  const client = new OAuth2Client({ clientId: config.clientId, clientSecret: config.clientSecret, redirectUri: config.callbackUrl });
  const { tokens } = await client.getToken({ code, codeVerifier: attempt.code_verifier, redirect_uri: config.callbackUrl });
  if (!tokens.id_token) throw new Error('Missing Google ID token');
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: config.clientId });
  return ticket.getPayload();
}

export function createGoogleOAuthRouter({ config, store, sessionName, cookieOptions, exchange = exchangeGoogleCode }) {
  const router = Router();
  const flowName = cookieOptions.secure ? '__Host-google-flow' : 'google_flow';
  const flowCookie = { ...cookieOptions, path: '/', maxAge: 10 * 60_000 };
  const clear = res => res.clearCookie(flowName, { ...cookieOptions, path: '/' });
  router.use(rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }));
  router.use((_req, res, next) => { res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); next(); });
  router.get('/', async (req, res) => {
    try {
      if (!config.clientId || !config.clientSecret || !config.callbackUrl) return fail(res, 'unavailable');
      const callback = new URL(config.callbackUrl);
      if (callback.protocol !== 'https:' && !(callback.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(callback.hostname))) return fail(res, 'unavailable');
      const state = random(), browser = random(), nonce = random(), verifier = random();
      await store.saveAttempt(req.db, { state_hash: digest(state), browser_hash: digest(browser), nonce, code_verifier: verifier, next_path: safeNext(req.query.next) });
      const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      auth.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.callbackUrl, response_type: 'code', scope: 'openid email', state, nonce, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', prompt: 'select_account' }).toString();
      res.cookie(flowName, browser, flowCookie).redirect(302, auth.href);
    } catch { console.error(JSON.stringify({ event: 'oauth.google.start_failed' })); fail(res, 'failed'); }
  });
  router.get('/callback', async (req, res) => {
    clear(res);
    try {
      const state = req.query.state, browser = req.cookies?.[flowName];
      if (typeof state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(state) || typeof browser !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(browser)) return fail(res, 'invalid_state');
      const attempt = await store.consumeAttempt(req.db, digest(state), digest(browser));
      if (!attempt) return fail(res, 'invalid_state');
      if (req.query.error) return fail(res, 'cancelled');
      if (typeof req.query.code !== 'string' || req.query.code.length > 4096 || !req.query.code) return fail(res, 'failed');
      const identity = validateGoogleClaims(await exchange(config, req.query.code, attempt), attempt.nonce);
      const session = await store.signIn(req.db, identity, req.cookies?.[sessionName]);
      res.cookie(sessionName, session.raw, { ...cookieOptions, maxAge: 86_400_000 }).redirect(303, safeNext(attempt.next_path));
    } catch (error) {
      // Never log Google responses, authorization codes, tokens or credentials.
      console.error(JSON.stringify({ event: 'oauth.google.callback_failed', reason: error.code === 'OAUTH_LINK_REQUIRED' ? 'link_required' : 'verification_failed' }));
      fail(res, error.code === 'OAUTH_LINK_REQUIRED' ? 'link_required' : 'failed');
    }
  });
  return router;
}
