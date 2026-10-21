# Google sign-in

Implemented 2026-10-21 using `google-auth-library` and authorization code flow.

## Configuration

Configure these three variables in an ignored `.env` file, then restart the backend:

```dotenv
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:4173/api/auth/oauth/google/callback
```

Production uses `https://zetgaming.vanvucoder.id.vn/api/auth/oauth/google/callback` instead. Register both URLs exactly in Google Cloud's authorized redirect URIs. Origins are `http://localhost:4173` and `https://zetgaming.vanvucoder.id.vn`.

Run `npm ci --ignore-scripts`, `npm run db:migrate`, then `npm run backend` and `npm run dev` for the current PostgreSQL application. Migration 007 only creates OAuth tables. Frontend proxies must preserve 302/303 and every Set-Cookie header.

## Behavior and security

- Login and registration use native links to `/api/auth/oauth/google?next=...`. A new Google user receives the customer role and zero wallet balance.
- Random state is bound to an HttpOnly SameSite=Lax browser cookie, stored hashed, expires after ten minutes and is consumed atomically. PKCE S256 and a nonce bind the Google response to the original request.
- Google library validates ID token signatures, issuer, audience and expiry. The application also checks the nonce, verified email and stable subject. Google access/refresh tokens are not persisted or returned to the browser.
- Repeat logins use Google subject rather than email. Automatic matching to an existing email is restricted to customer accounts with Google-authoritative Gmail or Workspace identity. Admin/CTV and non-authoritative email matches require password login; no existing role, password, tier or wallet balance is overwritten.
- Successful login rotates the session. Unsafe next URLs fall back to `/tai-khoan`. Denial, expiry and verification errors show a safe message on the login form. Google errors and credentials are not logged; callback query strings are excluded from request logging.
- `GET /api/auth/providers` advertises Google only when configuration is present. Facebook remains unimplemented.

## Existing production deployment

The VPS currently runs the older SQLite storefront in Docker. Its database was preserved, rather than replacing it with the local PostgreSQL database.

- Storefront: existing container `zetgaming`, source `/opt/zetgaming`.
- Patched storefront image snapshot: `zetgaming:97a822c-google-oauth`; use this image rather than the pre-OAuth image when recreating that legacy container.
- OAuth service: `zetgaming-google-oauth`, image `zetgaming-oauth:20261021-v1`, restart policy `unless-stopped`, host networking, binds **127.0.0.1:4181 only**.
- Configuration: `/opt/zetgaming-oauth/.env`, mode 0600. Never copy this file to Git or the build context.
- Build context: `/opt/zetgaming-oauth/release-v1`, reproducible using `Dockerfile.oauth-legacy`.
- Shared persistent database: `/opt/zetgaming/data/topup.sqlite`; only OAuth tables are added. The SQLite adapter issues sessions in the existing storefront's format.
- Nginx proxies `/api/auth/oauth/google` and its callback to port 4181, with OAuth access logging disabled. `/api/auth/providers` also goes to that service. `/google-oauth.css` and `/google-g.png` are served from `/opt/zetgaming/public`.
- `scripts/patch-legacy-google.mjs /opt/zetgaming` adds the Google button and error messages to the old login page. It is intentionally separate from the current PostgreSQL application; it must not run against this checkout.

Snapshot before deployment: `/opt/zetgaming/data/backups/google-oauth-before-20261021-v1/` contains an online SQLite backup plus the prior account page, renderer, HTML layout and Nginx site configuration. Before and after deploy there were 3 users and 2 orders, with no financial rows altered by deployment.

For code rollback, restore the three storefront files and Nginx site from that snapshot, copy those files into their original `/app/` paths in the `zetgaming` container, restart it, validate Nginx and reload, then stop the OAuth service. Keep the database and additive OAuth tables; do not restore a database snapshot after new orders have arrived. The original storefront image remains available as `zetgaming:97a822c`.

## Verification

Automated tests cover callback browser binding, one-time state/replay protection, nonce and verified-email checks, cancellation, proxy redirect/cookie handling, real PostgreSQL and SQLite account/session persistence, balances, stable-subject identity and protected-role linking. Both public origins reach Google's account selection with matching callbacks. Completing consent with a real Google account requires the user; no automated test signs into the user's Google account.

## Consent-screen public URLs

- Application home: `https://zetgaming.vanvucoder.id.vn/`
- Privacy policy: `https://zetgaming.vanvucoder.id.vn/chinh-sach-bao-mat`
- Terms: `https://zetgaming.vanvucoder.id.vn/dieu-khoan-dich-vu`
- Published support and data-request contact, selected by the owner: `zetgaming.net@gmail.com`. It can be overridden with `SUPPORT_EMAIL` when configured.

The policy pages are SSR documents available without authentication. They describe current `openid email` access, account/transaction data, cookie use, retention, request-based deletion and Google-access revocation separately. Footer, registration consent and Google sign-in notices link to the documents.

Legacy deployment uses `scripts/patch-legacy-legal.mjs /opt/zetgaming`, with `storefront/legal-pages.mjs` copied into the old release and `/legal.css` served by Nginx. Snapshot before that change is `/opt/zetgaming/data/backups/legal-before-20261021-v1/` (renderer, layout, Google UI module/CSS and Nginx configuration). Restoring those files and restarting the storefront rolls back the policy UI without touching account or order data.
