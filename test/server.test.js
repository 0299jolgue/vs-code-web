const test=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs/promises');
const path=require('node:path');

async function waitFor(url){for(let i=0;i<100;i++){try{const r=await fetch(url);if(r.ok)return}catch{}await new Promise(r=>setTimeout(r,50))}throw Error('Server did not start')}

test('health, workspace API and live preview',async()=>{
  const port=18765;
  const dir=await fs.mkdtemp('/tmp/vs-code-web-');
  const p=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',WORKSPACE_DIR:dir},stdio:'ignore'});
  try{
    await waitFor('http://127.0.0.1:'+port+'/api/health');
    const tree=await (await fetch('http://127.0.0.1:'+port+'/api/tree')).json();
    assert.ok(tree.tree.some(x=>x.path==='index.html'));
    const u=await fetch('http://127.0.0.1:'+port+'/api/file',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({path:'hello.txt',content:'hello'})});
    assert.equal(u.ok,true);
    const f=await (await fetch('http://127.0.0.1:'+port+'/api/file?path=hello.txt')).json();
    assert.equal(f.content,'hello');
    const preview=await (await fetch('http://127.0.0.1:'+port+'/api/preview/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({entry:'index.html'})})).json();
    assert.ok(preview.url.startsWith('/preview/'));
    const html=await (await fetch('http://127.0.0.1:'+port+preview.url)).text();
    assert.match(html,/Shard VS Code Web/);
  }finally{
    p.kill('SIGTERM');await new Promise(r=>p.on('exit',r));await fs.rm(dir,{recursive:true,force:true});
  }
});
