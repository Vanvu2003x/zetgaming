import { randomBytes, randomUUID, scryptSync } from 'node:crypto';

// Compatibility adapter for the existing production SQLite deployment.
// It only adds OAuth tables and reuses the deployed users/sessions formats.
export function createSqliteGoogleStore(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS oauth_identities(provider TEXT NOT NULL,subject TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),created_at TEXT NOT NULL,PRIMARY KEY(provider,subject),UNIQUE(provider,user_id));
    CREATE TABLE IF NOT EXISTS oauth_login_attempts(state_hash TEXT PRIMARY KEY,browser_hash TEXT NOT NULL,nonce TEXT NOT NULL,code_verifier TEXT NOT NULL,next_path TEXT NOT NULL,expires_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS oauth_login_attempts_expiry ON oauth_login_attempts(expires_at);`);
  return {
    async saveAttempt(_db, row) {
      db.prepare('DELETE FROM oauth_login_attempts WHERE expires_at<=?').run(new Date().toISOString());
      db.prepare('INSERT INTO oauth_login_attempts VALUES(?,?,?,?,?,?)').run(row.state_hash,row.browser_hash,row.nonce,row.code_verifier,row.next_path,new Date(Date.now()+600_000).toISOString());
    },
    async consumeAttempt(_db, state, browser) {
      return db.prepare('DELETE FROM oauth_login_attempts WHERE state_hash=? AND browser_hash=? AND expires_at>? RETURNING *').get(state,browser,new Date().toISOString()) || null;
    },
    async signIn(_db, identity, previous) {
      const now = new Date().toISOString();
      db.exec('BEGIN IMMEDIATE');
      try {
        let user = db.prepare("SELECT u.* FROM oauth_identities i JOIN users u ON u.id=i.user_id WHERE i.provider='google' AND i.subject=?").get(identity.subject);
        if (!user) {
          user = db.prepare('SELECT * FROM users WHERE lower(email)=lower(?)').get(identity.email);
          if (user && (!identity.authoritativeEmail || user.role !== 'customer')) { const error=new Error('Password login required'); error.code='OAUTH_LINK_REQUIRED'; throw error; }
          if (!user) {
            const salt=randomBytes(16).toString('hex');
            const passwordHash=salt+':'+scryptSync(randomBytes(32).toString('hex'),salt,64).toString('hex');
            user={id:randomUUID(),email:identity.email};
            db.prepare("INSERT INTO users(id,email,password_hash,role,tier,wallet_cents,created_at) VALUES(?,?,?,'customer','standard',0,?)").run(user.id,user.email,passwordHash,now);
          }
          db.prepare("INSERT INTO oauth_identities VALUES('google',?,?,?)").run(identity.subject,user.id,now);
        }
        if (previous) db.prepare('DELETE FROM sessions WHERE token=?').run(previous);
        const raw=randomBytes(32).toString('hex');
        db.prepare('INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)').run(raw,user.id,new Date(Date.now()+86_400_000).toISOString());
        db.prepare('INSERT INTO audit(id,actor_id,action,entity_id,metadata_json,created_at) VALUES(?,?,?,?,?,?)').run(randomUUID(),user.id,'auth.login',user.id,JSON.stringify({method:'google'}),now);
        db.exec('COMMIT');
        return {raw};
      } catch(error) { db.exec('ROLLBACK');throw error; }
    },
  };
}
