// Test-only static server: exercise the same subdirectory path as GitHub Pages.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve('dist'),prefix='/finance-plan-beta/';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
export function createPreviewServer() { return http.createServer((req,res)=>{
  let url;try{url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
  if(!url.startsWith(prefix)){res.writeHead(404).end();return;}
  let file=path.resolve(root,url.slice(prefix.length)||'index.html');
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()){
    if(path.extname(file)){res.writeHead(404).end();return;}
    file=path.join(root,'index.html');
  }
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});fs.createReadStream(file).pipe(res);
}); }
if(process.argv[1]===fileURLToPath(import.meta.url))createPreviewServer().listen(4173,'127.0.0.1',()=>console.log('Pages-path preview: http://127.0.0.1:4173/finance-plan-beta/'));
