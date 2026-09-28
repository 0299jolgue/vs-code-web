'use strict';

const $=id=>document.getElementById(id);
const state={tree:[],open:[],active:null,models:new Map(),editor:null,previewId:null,terminal:null,ws:null};

async function api(url,opts={}){
  const r=await fetch(url,Object.assign({},opts,{headers:Object.assign({'content-type':'application/json'},opts.headers||{})}));
  const data=await r.json(); if(!r.ok)throw Error(data.error||('HTTP '+r.status)); return data;
}
function toast(s){const e=$('toast');e.textContent=s;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),1700)}
function lang(p){const x=p.split('.').pop().toLowerCase();return({js:'javascript',mjs:'javascript',cjs:'javascript',ts:'typescript',json:'json',html:'html',htm:'html',css:'css',py:'python',go:'go',php:'php',rb:'ruby',md:'markdown',sh:'shell'}[x]||'plaintext')}
function flat(nodes,out=[]){for(const n of nodes)n.type==='file'?out.push(n.path):flat(n.children,out);return out}
function renderTree(nodes,parent=document.getElementById('tree'),depth=0){
  parent.innerHTML='';
  nodes.forEach(n=>{
    const row=document.createElement('div');row.className='tree-row '+n.type+(n.path===state.active?' active':'');row.style.paddingLeft=(8+depth*12)+'px';
    const i=document.createElement('span');i.className='tree-icon';i.textContent=n.type==='directory'?'▾':'•';row.appendChild(i);
    const t=document.createElement('span');t.textContent=n.name;row.appendChild(t);
    if(n.type==='file')row.onclick=()=>openFile(n.path);
    else {const kids=document.createElement('div');kids.className='tree-children';row.onclick=()=>kids.classList.toggle('hidden');parent.appendChild(row);parent.appendChild(kids);renderTree(n.children,kids,depth+1);return}
    parent.appendChild(row);
  });
}
async function refreshTree(){const d=await api('/api/tree');state.tree=d.tree;renderTree(state.tree)}
async function openFile(p){
  if(!state.models.has(p)){const d=await api('/api/file?path='+encodeURIComponent(p));state.models.set(p,monaco.editor.createModel(d.content,lang(p)))}
  if(!state.open.includes(p))state.open.push(p);state.active=p;state.editor.setModel(state.models.get(p));renderTabs();await refreshTree()
}
function renderTabs(){const e=$('tabs');e.innerHTML='';state.open.forEach(p=>{const t=document.createElement('div');t.className='tab '+(p===state.active?'active':'');const a=document.createElement('span');a.textContent=p.split('/').pop();const c=document.createElement('span');c.className='tab-close';c.textContent='×';c.onclick=x=>{x.stopPropagation();closeTab(p)};t.append(a,c);t.onclick=()=>openFile(p);e.appendChild(t)})}
function closeTab(p){state.open=state.open.filter(x=>x!==p);if(state.active===p){state.active=state.open[state.open.length-1]||null;state.editor.setModel(state.active?state.models.get(state.active):null)}renderTabs()}
async function save(){
  if(!state.active)return toast('Open a file first');
  await api('/api/file',{method:'PUT',body:JSON.stringify({path:state.active,content:state.models.get(state.active).getValue()})});
  $('statusPill').textContent='Saved';toast('Saved '+state.active);
  if(state.previewId)refreshPreview();
}
async function run(){
  if(!state.active)return toast('Open a runnable file first');
  await save();
  $('statusPill').textContent='Running…';
  try{const d=await api('/api/run',{method:'POST',body:JSON.stringify({path:state.active})});state.terminal.write('\r\n[run exit='+d.code+']\r\n'+d.output.replaceAll('\n','\r\n'));$('statusPill').textContent=d.code===0?'Done':'Error'}catch(e){state.terminal.write('\r\n'+e.message+'\r\n');$('statusPill').textContent='Error'}
}
async function live(){
  if(state.previewId){await api('/api/preview/stop',{method:'POST',body:JSON.stringify({id:state.previewId})});state.previewId=null;$('preview').style.display='none';$('previewEmpty').style.display='grid';$('liveBtn').textContent='Go Live';return}
  await startLive()
}
async function startLive(){
  const entry=state.active&&/\.html?$/i.test(state.active)?state.active:'index.html';
  const d=await api('/api/preview/start',{method:'POST',body:JSON.stringify({entry})});
  state.previewId=d.id;$('preview').src=d.url;$('preview').style.display='block';$('previewEmpty').style.display='none';$('liveBtn').textContent='Stop';toast('Live preview started')
}
function refreshPreview(){if(state.previewId){const s=$('preview').src.split('?')[0];$('preview').src=s+'?t='+Date.now()}}
function dialog(title,placeholder,fn){
  $('dialogTitle').textContent=title;$('dialogInput').placeholder=placeholder;$('dialogInput').value='';$('dialog').classList.remove('hidden');
  const done=async()=>{const v=$('dialogInput').value;$('dialog').classList.add('hidden');if(v)await fn(v)};
  $('dialogOk').onclick=done;$('dialogCancel').onclick=()=>$('dialog').classList.add('hidden');$('dialogInput').onkeydown=e=>{if(e.key==='Enter')done();if(e.key==='Escape')$('dialog').classList.add('hidden')};$('dialogInput').focus()
}
function newFile(){dialog('New file','src/app.js',async p=>{await api('/api/fs',{method:'POST',body:JSON.stringify({type:'file',path:p})});await refreshTree();await openFile(p)})}
function newFolder(){dialog('New folder','src/components',async p=>{await api('/api/fs',{method:'POST',body:JSON.stringify({type:'directory',path:p})});await refreshTree()})}
function commands(){dialog('Command palette','save, run, live, file, folder, search, extensions',async v=>{const x=v.toLowerCase();if(x.includes('save'))return save();if(x.includes('run'))return run();if(x.includes('live'))return live();if(x.includes('folder'))return newFolder();if(x.includes('file'))return newFile();if(x.includes('search'))return panel('search');if(x.includes('extension'))return panel('extensions')})}
function panel(name){document.querySelectorAll('.activity').forEach(x=>x.classList.toggle('active',x.dataset.panel===name));document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));$('panel-'+name).classList.add('active');$('sidebarTitle').textContent=name.toUpperCase()}
async function searchFiles(q){const box=$('searchResults');box.replaceChildren();if(!q){box.textContent='Type to search.';return}const hits=[];for(const p of flat(state.tree)){if(p.toLowerCase().includes(q.toLowerCase())){hits.push(p);continue}try{const d=await api('/api/file?path='+encodeURIComponent(p));if(d.content.toLowerCase().includes(q.toLowerCase()))hits.push(p)}catch{}}if(!hits.length){box.textContent='No matches.';return}hits.forEach(p=>{const row=document.createElement('div');row.className='tree-row file';row.textContent=p;row.onclick=()=>openFile(p);box.appendChild(row)})}
async function searchExtensions(q){const box=$('extensionResults');box.replaceChildren();if(!q)return;try{const d=await api('/api/extensions/search?q='+encodeURIComponent(q));const xs=d.extensions||[];if(!xs.length){box.textContent='No results.';return}xs.forEach(x=>{const card=document.createElement('div');card.className='extension';const title=document.createElement('div');title.className='extension-title';title.textContent=String(x.displayName||x.name||x.id);const meta=document.createElement('div');meta.className='extension-meta';meta.textContent=String(x.namespace||'')+'/'+String(x.name||'');card.append(title,meta);box.appendChild(card)})}catch(e){box.textContent=e.message}}
function initEditor(){
  require.config({paths:{vs:'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs'}});
  require(['vs/editor/editor.main'],async()=>{
    state.editor=monaco.editor.create($('editor'),{theme:'vs-dark',automaticLayout:true,minimap:{enabled:true},fontSize:13,wordWrap:'on',scrollBeyondLastLine:false});
    state.editor.addCommand(monaco.KeyMod.CtrlCmd|monaco.KeyCode.KeyS,save);
    state.editor.addCommand(monaco.KeyMod.CtrlCmd|monaco.KeyCode.KeyP,()=>dialog('Quick Open','file name',async v=>{const p=flat(state.tree).find(x=>x===v||x.endsWith('/'+v));if(p)await openFile(p);else toast('File not found')}));
    await refreshTree();await openFile('index.html');
  })
}
function initTerminal(){
  state.terminal=new Terminal({convertEol:true,cursorBlink:true,scrollback:4000,fontSize:12,theme:{background:'#0d1117'}});
  state.terminal.open($('terminal'));
  connectTerminal();
}
function connectTerminal(){
  const proto=location.protocol==='https:'?'wss':'ws';const ws=new WebSocket(proto+'://'+location.host+'/ws?kind=terminal');state.ws=ws;
  ws.onopen=()=>{$('terminalState').textContent='connected';state.terminal.write('[terminal connected]\r\n')};
  ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.type==='output')state.terminal.write(d.data.replaceAll('\n','\r\n'));if(d.type==='exit')setTimeout(connectTerminal,800)};
  ws.onclose=()=>{$('terminalState').textContent='disconnected'};ws.onerror=()=>{$('terminalState').textContent='error'};
  state.terminal.onData(s=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'input',data:s}))})
}
async function runtime(){try{const d=await api('/api/processes');$('runtimeInfo').textContent=d.running+' process(es), '+d.previews.length+' preview(s).'}catch{}}

$('saveBtn').onclick=save;$('runBtn').onclick=run;$('liveBtn').onclick=live;$('newFileBtn').onclick=newFile;$('newFolderBtn').onclick=newFolder;$('commandBtn').onclick=commands;$('refreshPreview').onclick=refreshPreview;$('openPreview').onclick=()=>{if($('preview').src)window.open($('preview').src,'_blank','noopener,noreferrer')};$('stopBtn').onclick=async()=>{if(state.previewId)await live();runtime()};
document.querySelectorAll('.activity').forEach(x=>x.onclick=()=>panel(x.dataset.panel));$('searchInput').oninput=e=>searchFiles(e.target.value);$('extensionInput').oninput=e=>searchExtensions(e.target.value);
window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();save()}});
setInterval(runtime,5000);initEditor();initTerminal();runtime();
