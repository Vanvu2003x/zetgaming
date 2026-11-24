import { withTransaction } from '../../db/pool.mjs';
import { id, token } from '../../utils/ids.mjs';
import { hashPassword } from '../../utils/password.mjs';
import { audit } from '../../utils/audit.mjs';
import { createSession } from './sessions.mjs';

export function createPostgresGoogleStore(transaction = withTransaction) {
  return {
  async saveAttempt(db, attempt) {
    await db.query('DELETE FROM oauth_login_attempts WHERE expires_at<=now()');
    await db.query('INSERT INTO oauth_login_attempts(state_hash,browser_hash,nonce,code_verifier,next_path) VALUES($1,$2,$3,$4,$5)', [attempt.state_hash, attempt.browser_hash, attempt.nonce, attempt.code_verifier, attempt.next_path]);
  },
  async consumeAttempt(db, stateHash, browserHash) {
    return (await db.query('DELETE FROM oauth_login_attempts WHERE state_hash=$1 AND browser_hash=$2 AND expires_at>now() RETURNING *', [stateHash, browserHash])).rows[0] || null;
  },
  async signIn(_db, identity, previous) {
    // A random unguessable password keeps Google-only accounts out of password login.
    const passwordHash = await hashPassword(token());
    return transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['google:' + identity.email]);
      let user = (await client.query("SELECT u.* FROM oauth_identities i JOIN users u ON u.id=i.user_id WHERE i.provider='google' AND i.subject=$1", [identity.subject])).rows[0];
      if (user?.active === false) throw Object.assign(new Error('Tài khoản đang bị khóa. Vui lòng liên hệ hỗ trợ.'), { statusCode: 403 });
      if (!user) {
        user = (await client.query('SELECT * FROM users WHERE lower(email)=lower($1) FOR UPDATE', [identity.email])).rows[0];
        if (user?.active === false) throw Object.assign(new Error('Tài khoản đang bị khóa. Vui lòng liên hệ hỗ trợ.'), { statusCode: 403 });
        if (user && (!identity.authoritativeEmail || user.role !== 'customer')) { const error = new Error('Account linking requires password login'); error.code = 'OAUTH_LINK_REQUIRED'; throw error; }
        if (!user) user = (await client.query("INSERT INTO users(id,email,password_hash,role,tier,wallet_cents) VALUES($1,$2,$3,'customer','standard',0) RETURNING *", [id(), identity.email, passwordHash])).rows[0];
        await client.query("INSERT INTO oauth_identities(provider,subject,user_id) VALUES('google',$1,$2)", [identity.subject, user.id]);
      }
      const session = await createSession(client, user.id, previous);
      await audit(client, user.id, 'auth.login', user.id, { method: 'google' });
      return session;
    });
  },
  };
}
export const postgresGoogleStore = createPostgresGoogleStore();
