import { id } from './ids.mjs';

export async function audit(client, actorId, action, entityId, metadata = {}) {
  await client.query('INSERT INTO audit_events(id,actor_id,action,entity_id,metadata) VALUES($1,$2,$3,$4,$5)', [id(), actorId || null, action, entityId || null, metadata]);
}
