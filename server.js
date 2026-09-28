'use strict';

const http=require('node:http');
const https=require('node:https');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {WebSocketServer}=require('ws');

const PORT=Number(process.env.PORT||80);
const HOST=process.env.HOST||'0.0.0.0';
const ROOT=path.resolve(process.env.WORKSPACE_DIR||path.join(process.cwd(),'workspace'));
const running=new Set();
const previews=new Map();
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.txt':'text/plain; charset=utf-8','.md':'text/markdown; charset=utf-8'};

function json(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));}
function rel(p){const s=path.posix.normalize(String(p||'').replaceAll('\\','/')).replace(/^\/+/,'');if(!s||s==='.')return '';if(s.split('/').includes('..'))throw Error('Invalid path');return s;}
function file(p){const r=path.resolve(ROOT,rel(p));if(r!==ROOT&&!r.startsWith(ROOT+path.sep))throw Error('Invalid path');return r;}
function readBody(req){return new Promise((resolve,reject)=>{const a=[];let n=0;req.on('data',c=>{n+=c.length;if(n>4*1024*1024){reject(Error('Body too large'));req.destroy();return}a.push(c)});req.on('end',()=>resolve(Buffer.concat(a).toString('utf8')));req.on('error',reject)});}
function serve(res,p){fs.stat(p,(e,s)=>{if(e||!s.isFile())return json(res,404,{error:'Not found'});res.writeHead(200,{'content-type':MIME[path.extname(p).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(p).pipe(res);});}

async function makeStarter(){
  await fsp.mkdir(ROOT,{recursive:true});
  const files={
    'index.html':'<!doctype html>\\n<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shard VS Code Web</title><link rel="stylesheet" href="styles.css"></head><body><main class="card"><h1>Hello from Shard VS Code Web</h1><p>Edit <code>index.html</code>, save, then press Go Live.</p><button id="hello">Click me</button><output id="output"></output></main><script src="app.js"></script></body></html>\\n',
    'styles.css':':root{font-family:Inter,system-ui,sans-serif;background:#0b0d11;color:#f5f7fb}body{min-height:100vh;margin:0;display:grid;place-items:center}.card{width:min(720px,calc(100vw - 40px));padding:32px;border:1px solid #313949;border-radius:18px;background:#11151d}button{padding:10px 14px;border-radius:10px;border:1px solid #48556c;background:#1d2532;color:inherit}output{display:block;margin-top:16px;color:#8fe1a8}',
    'app.js':"document.getElementById('hello').addEventListener('click',()=>document.getElementById('output').textContent='Live preview is running.');\\n",
    'main.py':"print('Python runtime is connected to the web IDE.')\\n",
    'README.md':'# Shard VS Code Web\\n\\nBrowser IDE workspace.\\n'
  };
  for(const [name,data] of Object.entries(files)){const p=path.join(ROOT,name);try{await fsp.access(p)}catch{await fsp.writeFile(p,data,'utf8')}}
}
async function listTree(dir=ROOT,prefix=''){
  const out=[];const es=await fsp.readdir(dir,{withFileTypes:true});es.sort((a,b)=>a.isDirectory()===b.isDirectory()?a.name.localeCompare(b.name):(a.isDirectory()?-1:1));
  for(const e of es){if(e.name==='.extensions')continue;const r=prefix?prefix+'/'+e.name:e.name; if(e.isDirectory())out.push({type:'directory',path:r,name:e.name,children:await listTree(path.join(dir,e.name),r)});else out.push({type:'file',path:r,name:e.name});}
  return out;
}
function child(command,args,opts={}){const p=spawn(command,args,{cwd:opts.cwd||ROOT,env:{...process.env,TERM:'xterm-256color',FORCE_COLOR:'1',...(opts.env||{})},stdio:['pipe','pipe','pipe']});running.add(p);p.on('close',()=>running.delete(p));p.on('error',()=>running.delete(p));return p;}
function runner(p){const x=path.extname(p).toLowerCase();if(x==='.py')return ['python3',[p]];if(['.js','.mjs','.cjs'].includes(x))return ['node',[p]];if(x==='.ts')return ['npx',['tsx',p]];if(x==='.php')return ['php',[p]];if(x==='.rb')return ['ruby',[p]];if(x==='.go')return ['go',['run',p]];if(x==='.sh')return ['sh',[p]];return null;}

async function api(req,res){
  const u=new URL(req.url,'http://'+(req.headers.host||'localhost'));
  try{
    if(req.method==='GET'&&u.pathname==='/api/health')return json(res,200,{ok:true,port:PORT});
    if(req.method==='GET'&&u.pathname==='/api/tree')return json(res,200,{tree:await listTree()});
    if(req.method==='GET'&&u.pathname==='/api/file'){const r=rel(u.searchParams.get('path'));const p=file(r);const s=await fsp.stat(p);if(!s.isFile())throw Error('File not found');return json(res,200,{path:r,content:await fsp.readFile(p,'utf8')});}
    if(req.method==='PUT'&&u.pathname==='/api/file'){const d=JSON.parse(await readBody(req));const r=rel(d.path);if(!r)throw Error('File path required');const p=file(r);await fsp.mkdir(path.dirname(p),{recursive:true});await fsp.writeFile(p,String(d.content||''),'utf8');return json(res,200,{ok:true});}
    if(req.method==='POST'&&u.pathname==='/api/fs'){const d=JSON.parse(await readBody(req));const p=file(d.path);if(d.type==='directory')await fsp.mkdir(p,{recursive:true});else{await fsp.mkdir(path.dirname(p),{recursive:true});await fsp.writeFile(p,'','utf8')}return json(res,200,{ok:true});}
    if(req.method==='DELETE'&&u.pathname==='/api/fs'){const d=JSON.parse(await readBody(req));const p=file(d.path);if(p===ROOT)throw Error('Cannot delete root');await fsp.rm(p,{recursive:true,force:true});return json(res,200,{ok:true});}
    if(req.method==='POST'&&u.pathname==='/api/run'){const d=JSON.parse(await readBody(req));const p=file(d.path);const r=runner(p);if(!r)throw Error('No runner for this file type');const c=child(r[0],r[1]);const a=[];let n=0;const add=x=>{if(n>=1048576)return;const b=Buffer.from(x);a.push(b.subarray(0,Math.min(b.length,1048576-n)));n=Math.min(1048576,n+b.length)};c.stdout.on('data',add);c.stderr.on('data',add);return await new Promise(ok=>c.on('close',code=>ok(json(res,200,{ok:true,code,output:Buffer.concat(a).toString('utf8')}))));}
    if(req.method==='POST'&&u.pathname==='/api/preview/start'){const d=JSON.parse(await readBody(req));const id=crypto.randomUUID();const entry=rel(d.entry||'index.html')||'index.html';previews.set(id,{id,entry,createdAt:Date.now()});return json(res,200,{id,url:'/preview/'+id+'/'+entry,mode:'static'});}
    if(req.method==='POST'&&u.pathname==='/api/preview/stop'){const d=JSON.parse(await readBody(req));return json(res,200,{ok:previews.delete(d.id)});}
    if(req.method==='GET'&&u.pathname==='/api/processes')return json(res,200,{running:running.size,previews:Array.from(previews.values())});
    if(req.method==='GET'&&u.pathname==='/api/extensions/search'){const q=u.searchParams.get('q')||'python';const remote='https://open-vsx.org/api/-/search?query='+encodeURIComponent(q)+'&size=20';return json(res,200,await remoteJson(remote));}
    return json(res,404,{error:'API route not found'});
  }catch(e){return json(res,500,{error:e.message||'Internal error'});}
}
function remoteJson(url){return new Promise((resolve,reject)=>{https.get(url,{headers:{'user-agent':'vs-code-web'}},r=>{let s='';r.setEncoding('utf8');r.on('data',x=>s+=x);r.on('end',()=>{try{resolve(JSON.parse(s))}catch(e){reject(e)}})}).on('error',reject)});}

const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://'+(req.headers.host||'localhost'));
  if(u.pathname.startsWith('/api/'))return api(req,res);
  const m=u.pathname.match(/^\/preview\/([^/]+)(?:\/(.*))?$/);
  if(m){const s=previews.get(m[1]);if(!s)return json(res,404,{error:'Preview not found'});let r=rel(m[2]||s.entry)||'index.html';if(r.endsWith('/'))r+='index.html';return serve(res,file(r));}
  if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed'});
  const root=path.resolve(path.join(process.cwd(),'public'));let p=decodeURIComponent(u.pathname);if(p==='/')p='/index.html';const target=path.resolve(path.join(root,'.'+p));if(target!==root&&!target.startsWith(root+path.sep))return json(res,400,{error:'Invalid path'});return serve(res,fs.existsSync(target)?target:path.join(root,'index.html'));
});

const wss=new WebSocketServer({noServer:true});
server.on('upgrade',(req,socket,head)=>{const u=new URL(req.url,'http://'+(req.headers.host||'localhost'));if(u.pathname!=='/ws')return socket.destroy();wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req,u));});
wss.on('connection',(ws,req,u)=>{
  const sh=process.platform==='win32'?'cmd.exe':'/bin/sh';const c=child(sh,process.platform==='win32'?[]:['-i']);
  ws.send(JSON.stringify({type:'ready',kind:u.searchParams.get('kind')||'terminal'}));
  const out=x=>{if(ws.readyState===ws.OPEN)ws.send(JSON.stringify({type:'output',data:String(x)}))};c.stdout.on('data',out);c.stderr.on('data',out);
  c.on('close',code=>{if(ws.readyState===ws.OPEN)ws.send(JSON.stringify({type:'exit',code}));try{ws.close()}catch{}});
  ws.on('message',m=>{try{const d=JSON.parse(String(m));if(d.type==='input')c.stdin.write(String(d.data||''));else if(d.type==='signal'&&d.signal)c.kill(d.signal)}catch{}});
  ws.on('close',()=>{try{c.kill('SIGTERM')}catch{}});
});
function stop(){for(const c of running)try{c.kill('SIGTERM')}catch{}setTimeout(()=>process.exit(0),100)}
process.on('SIGTERM',stop);process.on('SIGINT',stop);

makeStarter().then(()=>server.listen(PORT,HOST,()=>console.log('[vs-code-web] listening on '+HOST+':'+PORT))).catch(e=>{console.error(e);process.exit(1)});
