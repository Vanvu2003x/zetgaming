import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const files = ['server.mjs', 'public/app.js', 'public/navigation.js', ...(await readdir('storefront')).filter(file => file.endsWith('.mjs')).map(file => 'storefront/' + file)];
const backendFiles = [];
async function collectBackend(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await collectBackend(path);
    else if (entry.name.endsWith('.mjs')) backendFiles.push(path);
  }
}
await collectBackend('backend');
files.push(...backendFiles);
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Checked ${files.length} server and browser modules.`);
