import { createDecipheriv, scryptSync } from 'node:crypto';

export function decryptLegacyTarget(value, secrets) {
  for(const secret of [...new Set(secrets.filter(value=>typeof value==='string'&&value.length))]){
    try{
      const [iv,tag,body]=String(value).split('.').map(part=>Buffer.from(part,'base64'));
      const decipher=createDecipheriv('aes-256-gcm',scryptSync(secret,'topup-key',32),iv);decipher.setAuthTag(tag);
      const result=JSON.parse(Buffer.concat([decipher.update(body),decipher.final()]).toString('utf8'));
      if(result&&typeof result==='object'&&!Array.isArray(result))return result;
    }catch{ /* Try only explicitly supplied keys; never return undeciphered data. */ }
  }
  throw new Error('Cannot decrypt legacy order target');
}
