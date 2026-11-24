import { readFile } from 'node:fs/promises';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { pool, withTransaction } from '../backend/db/pool.mjs';
import { hashPassword, verifyPassword } from '../backend/utils/password.mjs';
import { audit } from '../backend/utils/audit.mjs';

if (process.env.NODE_ENV!=='production' || !process.env.ROTATED_CREDENTIALS_FILE) throw new Error('Production credentials file required');
const credentials=JSON.parse(await readFile(process.env.ROTATED_CREDENTIALS_FILE,'utf8'));
const defaults=[['admin@example.com','admin12345'],['ctv@example.com','ctv12345'],['customer@example.com','customer123']];
const matches=async(password,stored)=>{
  if(!/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(stored||''))return verifyPassword(password,stored);
  const [salt,digest]=stored.split(':');return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(digest,'hex'));
};
try{
  const changed=[];
  for(const [email,password]of defaults){
    const user=(await pool.query('SELECT id,password_hash FROM users WHERE email=$1',[email])).rows[0];
    if(!user||!await matches(password,user.password_hash))continue;
    const replacement=credentials[email];
    if(typeof replacement!=='string'||replacement.length<24)throw new Error('Missing strong replacement credential');
    const passwordHash=await hashPassword(replacement);
    await withTransaction(async client=>{
      await client.query('UPDATE users SET password_hash=$1 WHERE id=$2',[passwordHash,user.id]);
      await client.query('DELETE FROM sessions WHERE user_id=$1',[user.id]);
      await audit(client,user.id,'auth.deployment_default_password_replaced',user.id);
    });
    changed.push(email);
  }
  console.log(JSON.stringify({replaced_default_passwords:changed}));
}finally{await pool.end();}
