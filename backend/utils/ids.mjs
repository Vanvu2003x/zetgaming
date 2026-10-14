import { createHash, randomBytes, randomUUID } from 'node:crypto';

export const id = () => randomUUID();
export const token = () => randomBytes(32).toString('hex');
export const hash = (value) => createHash('sha256').update(value).digest('hex');
export const payloadHash = (value) => hash(JSON.stringify(value));
export const orderCode = () => `GP${Date.now().toString(36).toUpperCase()}${randomBytes(3).toString('hex').toUpperCase()}`;
