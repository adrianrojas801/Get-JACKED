"use strict";
// Core: small helpers, app state, the save pipeline, the offline copy, and reading the day/workout/settings docs.
// Loaded by index.html in a fixed order (see the <script> tags there). All files share one global scope.

// ---------- helpers ----------
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const keyOf=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseKey=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(k,n)=>{const d=parseKey(k);d.setDate(d.getDate()+n);return keyOf(d)};
const today=()=>keyOf(new Date());
const nice=k=>parseKey(k).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
const short=k=>parseKey(k).toLocaleDateString(undefined,{month:'numeric',day:'numeric'});
const clone=x=>JSON.parse(JSON.stringify(x));
const num=v=>(v===''||v==null||isNaN(+v))?null:+v;
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const r1=v=>Math.round(v*10)/10;
const fmt=v=>Math.round(v).toLocaleString();
const e1rm=(w,r)=>w*(1+r/30);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// ---------- shared card pieces ----------
// Advice always looks the same wherever it shows up: a "Coach" label, a title, then the advice and its buttons.
const coachOpen=(title,attrs='')=>`<div class="card coach" ${attrs}><div class="eyebrow">Coach</div><h2>${title}</h2>`;
// A card title with an (i) button. The explanation stays out of the way until it's tapped.
function titled(id,title,text){const on=!!(S.info&&S.info[id]);return `<div class="row between"><h2 style="margin:0">${title}</h2><button class="ibtn ${on?'on':''}" data-act="info" data-id="${id}" aria-expanded="${on}" aria-label="About ${title}">i</button></div>${on?`<div class="muted infotext">${text}</div>`:''}`}

// ---------- state ----------
const S={db:null,days:{},workouts:{},settings:{},tab:'today',dk:today(),wd:today(),wp:null,note:null,lift:null,swap:null,addEx:false,copied:false,needRender:false,known:{},ready:{},boot:true,loaded:false};
try{const t=localStorage.getItem('gt_tab');if(t)S.tab=t}catch(e){}
const cfg=()=>S.settings||{};
const T=()=>({cal:num(cfg().cal)||2600,pro:num(cfg().pro)||160,goal:num(cfg().goal)||173,block:cfg().block||null});
const presets=()=>Array.isArray(cfg().presets)?cfg().presets:(isLegacy()?DEFAULT_PRESETS:STARTER_PRESETS);

// ---------- saving ----------
const pending={};
function setStatus(t){const el=$('#status');el.textContent=t;el.classList.toggle('off',/^(Not|Offline)/.test(t));el.classList.toggle('busy',/…$/.test(t))}
function save(path,data,delay=0,patch=null){
  if(!S.db){setStatus('Not saving');return}
  const p=pending[path]||(pending[path]={});
  p.data=clone(data);p.dirty=true;p.since=p.since||Date.now();
  if(patch&&!p.full)p.patch=Object.assign(p.patch||{},clone(patch));else{p.full=true;p.patch=null}
  clearTimeout(p.timer);p.timer=setTimeout(()=>flush(path),delay);
  setStatus('Saving…');keepOutbox();keepCopy();
}
function mapFor(path){const c=path.split('/')[0];return c==='days'?S.days:c==='workouts'?S.workouts:null}
async function writeDoc(path,data,patch){
  const ref=S.db.doc(path);
  if(patch&&S.known[path]){try{await ref.update(patch);return}catch(e){if(!(e&&e.code==='invalid_argument'))throw e}}
  await ref.set(data);S.known[path]=true;
}
async function refresh(path){try{const snap=await S.db.doc(path).get();if(pending[path]||!snap.exists)return;const v=snap.data();
  if(path==='settings/main'){if(JSON.stringify(v)!==JSON.stringify(S.settings)){S.settings=clone(v);softRender()}return}
  const m=mapFor(path),id=path.split('/')[1];if(m&&JSON.stringify(m[id])!==JSON.stringify(v)){m[id]=clone(v);softRender()}}catch(e){}}
async function flush(path){
  const p=pending[path];if(!p||!p.dirty)return;
  if(p.inflight){p.again=true;return}
  clearTimeout(p.timer);
  p.inflight=true;p.dirty=false;p.held=false;const data=p.data,patch=p.full?null:p.patch;p.patch=null;p.full=false;let err=null;
  try{await writeDoc(path,data,patch)}
  catch(e){err=e;
    if(e&&e.code==='unavailable'){await sleep(700+Math.random()*900);try{await writeDoc(path,data,patch);err=null}catch(e2){err=e2}}}
  p.inflight=false;
  if(err&&err.code==='offline')return hold(path,p,patch);
  if(err)fail(err);
  if(p.dirty||p.again){p.again=false;flush(path)}
  else{delete pending[path];keepOutbox();if(!err){refresh(path);if(!Object.keys(pending).length){setStatus('Saved ✓');queueBoard()}}}
}
// No connection: keep the write (it's also stored on the phone) and try again later or when the phone is back online.
function hold(path,p,patch){
  if(patch&&!p.full)p.patch=Object.assign({},patch,p.patch||{});else{p.full=true;p.patch=null}
  p.dirty=true;p.again=false;p.held=true;setStatus(OFFLINE_SAVED);
  clearTimeout(p.timer);p.timer=setTimeout(()=>flush(path),20000);
}

// ---------- offline copy ----------
// The last synced data and any writes still waiting are kept in localStorage, per person,
// so the app opens and logs with no signal. Supabase stays the source of truth: whatever it sends replaces the copy.
const OFFLINE_SAVED='Offline · saved on this phone';
const LS={get(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
const lsKey=n=>'gj_'+n+'_'+(ME.user?ME.user.id:'');
function keepCopy(){if(!ME.user||!S.loaded)return;clearTimeout(keepCopy.t);keepCopy.t=setTimeout(()=>LS.set(lsKey('copy'),{days:S.days,workouts:S.workouts,settings:S.settings,profile:ME.profile}),800)}
function keepOutbox(){if(!ME.user)return;const out={};for(const [k,p] of Object.entries(pending))out[k]={data:p.data,patch:p.patch,full:!!p.full};if(Object.keys(out).length)LS.set(lsKey('out'),out);else LS.del(lsKey('out'))}
// Opens from the copy on the phone, if there is one, and lines up any writes that never got sent.
function openCopy(){
  const c=LS.get(lsKey('copy'));if(!c||!c.settings)return false;
  S.days=c.days||{};S.workouts=c.workouts||{};S.settings=c.settings;if(!ME.profile)ME.profile=c.profile||null;S.loaded=true;
  const out=LS.get(lsKey('out'))||{};
  for(const [path,o] of Object.entries(out)){const m=mapFor(path),id=path.split('/')[1];if(m)m[id]=clone(o.data);else if(path==='settings/main')S.settings=clone(o.data);
    save(path,o.data,2500,o.full?null:o.patch)}
  return true;
}
function forgetCopy(){LS.del(lsKey('copy'));LS.del(lsKey('out'));LS.del('gj_last')}
function flushAll(){for(const k of Object.keys(pending))flush(k)}
function fail(e){
  const c=e&&e.code;
  if(c==='quota_exceeded')S.note='Storage is full, so new entries can’t be saved.';
  else if(c==='invalid_argument')S.note='Couldn’t save. Make sure you’re signed in as the tracker’s owner.';
  else if(c==='revoked'||c==='not_granted'||c==='capability_disabled')S.note='Saving stopped working in this view. Reopen the tracker.';
  else S.note='Couldn’t save just now. Check your connection.';
  setStatus('Not saved');render();
}
document.addEventListener('visibilitychange',()=>flushAll());
// Say so when the phone is offline, and send anything waiting as soon as it's back.
window.addEventListener('offline',()=>setStatus('Offline'));
// Coming back online: the data layer refetches first (so edits merge instead of overwriting), then waiting writes go out.
window.addEventListener('online',()=>{if(Object.keys(pending).length){setStatus('Saving…');setTimeout(flushAll,1500)}else setStatus('Saved ✓')});
window.addEventListener('pagehide',()=>flushAll());
setInterval(()=>{const ps=Object.values(pending);if(ps.some(p=>p.held))return;if(ps.some(p=>p.since&&Date.now()-p.since>5000))setStatus('Not saved yet…')},2000);

// ---------- data access ----------
function dayDoc(k){return S.days[k]?clone(S.days[k]):{date:k,food:[]}}
function putDay(k,d,delay=0){d.date=k;if(!Array.isArray(d.food))d.food=[];const prev=S.days[k]||{};const patch={};
  for(const key of new Set([...Object.keys(d),...Object.keys(prev)]))if(JSON.stringify(d[key])!==JSON.stringify(prev[key]))patch[key]=d[key]===undefined?null:d[key];
  S.days[k]=d;if(Object.keys(patch).length)save('days/'+k,d,delay,patch)}
function putSettings(s,delay=0){S.settings=s;save('settings/main',s,delay)}
const wid=(date,prog)=>date+'_'+prog;
// A logged exercise plus the "jump" set for it in the program (if it's still the same exercise there).
function withJump(e,prog){const d=dayOf(prog),te=e.ti!=null&&d&&d.ex[e.ti];return te&&te.n===e.n&&num(te.inc)>0?Object.assign({},e,{inc:num(te.inc)}):e}
function template(prog){const d=dayOf(prog);return d?d.ex.map((e,i)=>({n:e.n||'Exercise',s:Math.max(1,num(e.s)||3),r:e.r||'8-12',rest:num(e.rest)||90,ss:e.ss||'',note:e.note||'',i})):[]}
function getWorkout(date,prog){
  const id=wid(date,prog);if(S.workouts[id])return clone(S.workouts[id]);
  return {date,prog,title:titleOf(prog),note:'',done:false,ex:template(prog).map(e=>({n:e.n,s:e.s,r:e.r,rest:e.rest,ss:e.ss||'',note:e.note||'',ti:e.i,sets:Array.from({length:e.s},()=>({w:'',r:'',d:false}))}))};
}
function putWorkout(w,delay=0){w.updated=Date.now();const id=wid(w.date,w.prog);S.workouts[id]=w;save('workouts/'+id,w,delay)}
function curWorkout(){return getWorkout(S.wd,S.wp)}
function lastFor(name,date,excludeId){
  const list=Object.entries(S.workouts).filter(([id,w])=>id!==excludeId&&w&&w.date<=date)
    .sort((a,b)=>b[1].date.localeCompare(a[1].date)||(b[1].updated||0)-(a[1].updated||0));
  for(const [,w] of list){const e=(w.ex||[]).find(x=>x.n===name);if(e){const sets=(e.sets||[]).filter(s=>s.d&&num(s.r));if(sets.length)return {date:w.date,sets};}}
  return null;
}
