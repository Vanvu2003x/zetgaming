import { hash, token } from '../../utils/ids.mjs';

export async function createSession(client, userId, previous, remember = false) {
  if (previous) await client.query('DELETE FROM sessions WHERE token_hash=$1', [hash(previous)]);
  const raw = token();
  const maxAge = remember ? 7 * 86_400_000 : 86_400_000;
  await client.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+($3::int * interval \'1 second\'))', [hash(raw), userId, maxAge / 1000]);
  return { raw, maxAge };
}
