import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
export function writeServiceWorker(directory='dist') {
  const files=[];
  function scan(dir){for(const file of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,file.name);if(file.isDirectory())scan(full);else if(file.name!=='sw.js')files.push(path.relative(directory,full).replaceAll('\\','/'));}}
  scan(directory);
  const digest=createHash('sha256');for(const file of files.sort())digest.update(fs.readFileSync(path.join(directory,file)));
  const version=digest.digest('hex').slice(0,16);
  fs.writeFileSync(path.join(directory,'sw.js'),`
const CACHE='finance-plan-${version}';
const BASE=new URL('./',self.location.href);
const ASSETS=${JSON.stringify(files)}.map(path=>new URL(path,BASE).href);
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('finance-plan-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==BASE.origin)return;
  if(!new URL(event.request.url).pathname.startsWith(BASE.pathname))return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const hit=await cache.match(event.request,{ignoreSearch:true});
    if(hit)return hit;
    if(event.request.mode==='navigate')return (await cache.match(new URL('index.html',BASE).href))||fetch(event.request);
    return fetch(event.request);
  }));
});
`);
}
