import { createWriteStream } from 'node:fs';
import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const root = process.env.BACKUP_ROOT || '/opt/zetgaming-v2/backups';
const source = process.env.APP_ROOT || '/opt/zetgaming-v2';
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 14);
const stamp = new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
const destination = join(root, 'scheduled-' + stamp);
const runToFile = (command, args, file) => new Promise((resolve, reject) => { const output=createWriteStream(file,{mode:0o600}); const child=spawn(command,args,{stdio:['ignore',output,'pipe']}); let error=''; child.stderr.on('data',chunk=>{error+=chunk.toString();}); child.on('error',reject); child.on('close',code=>code===0?resolve():reject(new Error(error||`${command} exited ${code}`))); });
await mkdir(destination,{recursive:true,mode:0o700});
await runToFile('docker',['exec','zetgaming-postgres','pg_dump','-U','postgres','-d','zetgaming','--format=custom'],join(destination,'zetgaming.dump'));
await copyFile(join(source,'.env'),join(destination,'.env'));
await copyFile(join(source,'compose.production.yml'),join(destination,'compose.production.yml'));
await runToFile('tar',['-czf',join(destination,'release.tgz'),'-C',join(source,'release'),'.'],join(destination,'tar.log'));
await runToFile('tar',['-czf',join(destination,'uploads.tgz'),'-C',join(source,'uploads'),'.'],join(destination,'uploads.log'));
for (const name of await readdir(root)) {
  if (!name.startsWith('scheduled-') || name === 'scheduled-' + stamp) continue;
  const path=join(root,name); const age=(Date.now()-(await stat(path)).mtimeMs)/86400000;
  if(age>retentionDays) await rm(path,{recursive:true,force:true});
}
console.log(destination);
