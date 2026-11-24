import { access, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const root=process.env.BACKUP_ROOT || '/opt/zetgaming-v2/backups';
const candidates=(await readdir(root)).filter(name=>name.startsWith('scheduled-')).sort().reverse();
if(!candidates.length) throw new Error('Chưa có backup scheduled nào.');
const latest=join(root,candidates[0]);
for(const file of ['zetgaming.dump','.env','compose.production.yml','release.tgz','uploads.tgz']) await access(join(latest,file));
const run=(command,args)=>new Promise((resolve,reject)=>{const child=spawn(command,args,{stdio:['ignore','pipe','pipe']});let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);child.on('error',reject);child.on('close',code=>code?reject(new Error(err||`${command} exited ${code}`)):resolve(out));});
await run('tar',['-tzf',join(latest,'release.tgz')]);
await run('tar',['-tzf',join(latest,'uploads.tgz')]);
console.log(JSON.stringify({backup:latest,bytes:(await stat(join(latest,'zetgaming.dump'))).size,verified:true}));
