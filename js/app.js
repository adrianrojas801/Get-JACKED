"use strict";
// Start-up: the Supabase data layer, account, automatic steps, reminders, sign-in, and loading.
// Loaded by index.html in a fixed order (see the <script> tags there). All files share one global scope.

// ---------- Supabase data layer (same interface the tracker already uses) ----------
const CFG=window.GJ_CONFIG||{};
const SB=(window.supabase&&CFG.url&&CFG.key)?window.supabase.createClient(CFG.url,CFG.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
const AUTH_HASH=location.hash||'';
const NEEDS_PW=/type=(invite|recovery)/.test(AUTH_HASH);
const ME={user:null,profile:null};
function dbErr(e){const st=e&&(e.status||e.code);if(st===401||st==='401'||st==='PGRST301'||st==='42501')return {code:'invalid_argument',message:String(e.message||e)};
  const msg=String((e&&e.message)||e);return {code:navigator.onLine===false||/failed to fetch|networkerror|load failed|network request failed/i.test(msg)?'offline':'unavailable',message:msg}}
function makeDb(uid){
  const L={days:[],workouts:[],settings:[]},timers={};
  const snapOf=rows=>{const docs=rows.map(r=>({id:r.id,exists:true,data:()=>r.data,metadata:{fromCache:false,hasPendingWrites:false}}));return {docs,size:docs.length,empty:!docs.length,metadata:{fromCache:false,hasPendingWrites:false},docChanges:()=>[]}};
  async function pull(coll){
    const {data,error}=await SB.from('docs').select('id,data').eq('coll',coll).limit(5000);
    if(error){for(const f of L[coll])f.err&&f.err(dbErr(error));return}
    const qs=snapOf(data||[]);for(const f of L[coll])f.next(qs);
  }
  const later=coll=>{clearTimeout(timers[coll]);timers[coll]=setTimeout(()=>pull(coll),250)};
  const pullAll=()=>{for(const c of Object.keys(L))if(L[c].length)later(c)};
  try{SB.channel('docs-'+uid).on('postgres_changes',{event:'*',schema:'public',table:'docs',filter:'user_id=eq.'+uid},p=>{const c=(p.new&&p.new.coll)||(p.old&&p.old.coll);if(c&&L[c])later(c);else pullAll()}).subscribe()}catch(e){}
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')pullAll()});
  window.addEventListener('online',pullAll);
  const doc=path=>{const [coll,id]=path.split('/');return {
    id,path,
    async get(){const {data,error}=await SB.from('docs').select('data').eq('coll',coll).eq('id',id).maybeSingle();if(error)throw dbErr(error);return {id,exists:!!data,data:()=>data?data.data:undefined,metadata:{fromCache:false,hasPendingWrites:false}}},
    async set(d){const {error}=await SB.from('docs').upsert({user_id:uid,coll,id,data:d,updated_at:new Date().toISOString()},{onConflict:'user_id,coll,id'});if(error)throw dbErr(error)},
    async update(p){const {error}=await SB.rpc('patch_doc',{p_coll:coll,p_id:id,p_patch:p});if(error)throw dbErr(error)},
    onSnapshot(next,err){L[coll].push({next:qs=>{const d=qs.docs.find(x=>x.id===id);next(d?{id,exists:true,data:d.data,metadata:qs.metadata}:{id,exists:false,data:()=>undefined,metadata:qs.metadata})},err});pull(coll);return ()=>{}}
  }};
  const collection=coll=>{const q={where:()=>q,orderBy:()=>q,limit:()=>q,doc:id=>doc(coll+'/'+id),onSnapshot(next,err){L[coll].push({next,err});pull(coll);return ()=>{}}};return q};
  return {doc,collection,pullAll};
}

// ---------- account ----------
function accountUI(){
  if(!ME.user)return '';
  const nm=(ME.profile&&ME.profile.display_name)||'';
  return `<div class="card"><h2>Account</h2><div class="muted">Signed in as ${esc(ME.user.email||'')}${ME.profile&&ME.profile.is_admin?' · admin':''}</div>
   <label class="f" style="margin-top:10px">Display name<input id="acname" value="${esc(nm)}" maxlength="40"></label>
   <div class="row" style="margin-top:8px"><button class="small" data-act="namesave">Save name</button><span class="muted">${esc(S.nameMsg||'')}</span></div>
   <label class="f" style="margin-top:12px">New password<input id="acpw" type="password" autocomplete="new-password" placeholder="at least 8 characters"></label>
   <div class="row" style="margin-top:8px"><button class="small" data-act="pwchange">Change password</button><span class="muted">${esc(S.pwMsg||'')}</span></div>
   <label class="check" style="margin-top:14px"><input type="checkbox" id="acboard" ${sharing()?'checked':''}> Show me on the board</label>
   <div class="muted" style="margin-top:4px">Shares weekly totals with the other people on this app: workouts done and planned, protein days, average steps, strength change, and the name and day of your latest session. Never your food, weight or lifts.</div>
   <button class="small" data-act="signout" style="margin-top:14px">Sign out</button></div>`;
}
async function saveName(){const v=($('#acname').value||'').trim().slice(0,40);const {error}=await SB.from('profiles').update({display_name:v}).eq('id',ME.user.id);S.nameMsg=error?'Couldn’t save the name.':'Saved ✓';if(!error&&ME.profile)ME.profile.display_name=v;render()}
async function changePassword(){const v=$('#acpw').value||'';if(v.length<8){S.pwMsg='Use at least 8 characters.';return render()}const {error}=await SB.auth.updateUser({password:v});S.pwMsg=error?(error.message||'Couldn’t change it.'):'Password changed ✓';render()}
async function signOut(){flushAll();await sleep(300);forgetCopy();try{await SB.auth.signOut()}catch(e){}location.replace(location.pathname)}

// ---------- automatic steps (an iOS Shortcut posts to log_steps with a personal token) ----------
async function loadStepLink(){try{const {data}=await SB.from('step_tokens').select('created_at,last_used').maybeSingle();S.stepLink=data||false}catch(e){S.stepLink=false}if(S.tab==='account')softRender()}
async function newStepLink(){const {data,error}=await SB.rpc('new_steps_token');if(error||!data){S.stepMsg='Couldn’t make the link. Try again in a minute.';return render()}S.stepMsg='';S.stepTok=data;S.stepLink={created_at:new Date().toISOString(),last_used:null};render()}
async function stopStepLink(){try{await SB.from('step_tokens').delete().eq('user_id',ME.user.id)}catch(e){}S.stepTok=null;S.stepLink=false;render()}
const copyRow=(label,v)=>`<label class="f" style="margin-top:8px">${label}<span class="row"><input readonly value="${esc(v)}" class="grow"><button class="small" type="button" data-act="cp" data-cp="${esc(v)}">Copy</button></span></label>`;
function stepsCard(){
  if(!ME.user)return '';
  if(S.stepLink===undefined){loadStepLink();return ''}
  let h=`<div class="card"><h2>Automatic steps</h2>`;
  if(S.stepTok)h+=`<p class="muted" style="margin-top:0">Set this up once on your iPhone. The token below is only shown now, so finish before you leave this page.</p>
    <ol class="plain" style="padding-left:20px">
     <li>Open the <b>Shortcuts</b> app, tap <b>+</b> and name the shortcut “Send steps”.</li>
     <li>Add <b>Find Health Samples</b>. Set the type to <b>Steps</b> and add the filter <b>Start Date is today</b>.</li>
     <li>Add <b>Calculate Statistics</b> and choose <b>Sum</b>.</li>
     <li>Add <b>Format Date</b> for the <b>Current Date</b>. Set Date Format to <b>Custom</b> and type <code>yyyy-MM-dd</code>.</li>
     <li>Add <b>Get Contents of URL</b>. Paste the URL below, set Method to <b>POST</b>, add a header named <code>apikey</code> with the key below, and set Request Body to <b>JSON</b> with three fields:
       <code>p_token</code> (Text, the token below), <code>p_steps</code> (Number, the Statistics result) and <code>p_date</code> (Text, the Formatted Date).</li>
     <li>Tap ▶ to test it. Your steps show up on Today within a few seconds.</li>
     <li>In the <b>Automation</b> tab, add a <b>Time of Day</b> automation (9:00 PM, daily, Run Immediately) that runs “Send steps”.</li>
    </ol>${copyRow('URL',CFG.url+'/rest/v1/rpc/log_steps')}${copyRow('apikey header',CFG.key)}${copyRow('p_token',S.stepTok)}
    <div class="row" style="margin-top:10px"><button class="small" data-act="stepdone">Done</button></div>`;
  else if(S.stepLink)h+=`<p class="muted" style="margin-top:0">Automatic steps are on. ${S.stepLink.last_used?'Last received '+new Date(S.stepLink.last_used).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+'.':'Nothing received yet.'}</p>
    <div class="row wrap"><button class="small" data-act="stepnew">Make a new link</button><button class="small" data-act="stepoff">Turn off</button></div>
    <div class="muted" style="margin-top:6px">A new link stops the old Shortcut until you paste the new token into it.</div>`;
  else h+=`<p class="muted" style="margin-top:0">Have your iPhone send your Apple Health steps to the app every day, so you don’t have to type them. It takes about 5 minutes to set up in the Shortcuts app.</p><button class="small primary" data-act="stepnew">Set up automatic steps</button>`;
  if(S.stepMsg)h+=`<div class="err">${esc(S.stepMsg)}</div>`;
  return h+`</div>`;
}

// ---------- reminders (off until config.js has vapidPublicKey; README, "Optional features") ----------
// A morning weigh-in nudge and an evening workout nudge, sent as push notifications by the send-reminders function.
const pushReady=()=>!!CFG.vapidPublicKey&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
const keyBytes=b64=>Uint8Array.from(atob((b64+'='.repeat((4-b64.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const hourLabel=h=>`${h%12||12} ${h<12?'AM':'PM'}`;
async function loadPush(){
  try{const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();
    if(!sub){S.push={on:false};return softRender()}
    const {data}=await SB.from('push_subs').select('morning,evening').eq('endpoint',sub.endpoint).maybeSingle();
    S.push=data?{on:true,endpoint:sub.endpoint,morning:data.morning,evening:data.evening}:{on:false}}
  catch(e){S.push={on:false}}
  if(S.tab==='account')softRender();
}
async function pushOn(){
  try{if(await Notification.requestPermission()!=='granted'){S.pushMsg='Notifications are blocked for this app. Allow them in your phone’s settings, then try again.';return render()}
    const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(CFG.vapidPublicKey)}),j=sub.toJSON();
    const row={endpoint:j.endpoint,p256dh:j.keys.p256dh,auth:j.keys.auth,tz:Intl.DateTimeFormat().resolvedOptions().timeZone||'America/Chicago',morning:8,evening:18};
    const {error}=await SB.from('push_subs').upsert(row,{onConflict:'endpoint'});if(error)throw error;
    S.pushMsg='';S.push={on:true,endpoint:row.endpoint,morning:8,evening:18}}
  catch(e){S.pushMsg='Couldn’t turn reminders on. On an iPhone, add the app to your home screen first and open it from there.'}
  render();
}
async function pushOff(){
  try{const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();
    if(sub){await SB.from('push_subs').delete().eq('endpoint',sub.endpoint);await sub.unsubscribe()}}catch(e){}
  S.push={on:false};render();
}
async function pushHour(field,h){if(!S.push||!S.push.on)return;S.push[field]=h;try{await SB.from('push_subs').update({[field]:h}).eq('endpoint',S.push.endpoint)}catch(e){}render()}
function remindersCard(){
  if(!ME.user||!pushReady())return '';
  if(S.push===undefined){loadPush();return ''}
  const hours=(f,v)=>`<label class="f">${f==='morning'?'Weigh-in nudge':'Workout nudge'}<select data-push="${f}">${Array.from({length:24},(_,h)=>`<option value="${h}" ${h===v?'selected':''}>${hourLabel(h)}</option>`).join('')}</select></label>`;
  let h=`<div class="card"><h2>Reminders</h2>`;
  if(S.push.on)h+=`<p class="muted" style="margin-top:0">On for this phone. You get a weigh-in nudge if you haven’t logged your weight, and a workout nudge if it’s a training day and nothing’s logged.</p>
    <div class="grid2">${hours('morning',S.push.morning)}${hours('evening',S.push.evening)}</div><button class="small" data-act="pushoff" style="margin-top:10px">Turn off</button>`;
  else h+=`<p class="muted" style="margin-top:0">Get a morning weigh-in nudge and an evening nudge on training days you haven’t logged. On an iPhone this works from the home-screen app.</p><button class="small primary" data-act="pushon">Turn on reminders</button>`;
  if(S.pushMsg)h+=`<div class="err">${esc(S.pushMsg)}</div>`;
  return h+`</div>`;
}

// ---------- sign-in screens ----------
function authScreen(mode,msg){
  document.body.classList.add('signedout');
  const box=$('#auth');
  if(mode==='setpw'){
    box.innerHTML=`<div class="card"><h2>Set your password</h2><div class="muted">Pick a password you’ll use to sign in on your phone.</div>
     <form id="pwform"><label class="f">New password<input id="np1" type="password" autocomplete="new-password" required minlength="8"></label>
     <label class="f">Confirm password<input id="np2" type="password" autocomplete="new-password" required minlength="8"></label>
     <div class="err" id="aerr">${esc(msg||'')}</div><button class="primary" type="submit">Save password</button></form></div>`;
    $('#pwform').onsubmit=async e=>{e.preventDefault();const a=$('#np1').value,b=$('#np2').value;if(a!==b){$('#aerr').textContent='Passwords don’t match.';return}
      const {error}=await SB.auth.updateUser({password:a});if(error){$('#aerr').textContent=error.message||'Couldn’t save it.';return}
      history.replaceState(null,'',location.pathname);start()};
    return;
  }
  if(mode==='forgot'){
    box.innerHTML=`<div class="card"><h2>Reset password</h2><div class="muted">We’ll email you a link to set a new password.</div>
     <form id="fform"><label class="f">Email<input id="fem" type="email" autocomplete="email" required></label><div class="err" id="aerr">${esc(msg||'')}</div>
     <button class="primary" type="submit">Send link</button><button type="button" class="link" id="back">Back to sign in</button></form></div>`;
    $('#back').onclick=()=>authScreen('login');
    $('#fform').onsubmit=async e=>{e.preventDefault();const {error}=await SB.auth.resetPasswordForEmail($('#fem').value.trim(),{redirectTo:location.origin+location.pathname});
      $('#aerr').className=error?'err':'ok';$('#aerr').textContent=error?(error.message||'Couldn’t send it.'):'Check your email for the link.'};
    return;
  }
  box.innerHTML=`<div class="card"><h2>Get Jacked</h2><div class="muted">Sign in with the account you were given.</div>
   <form id="lform"><label class="f">Email<input id="lem" type="email" autocomplete="email" required></label>
   <label class="f">Password<input id="lpw" type="password" autocomplete="current-password" required></label>
   <div class="err" id="aerr">${esc(msg||'')}</div><button class="primary" type="submit" id="lbtn">Sign in</button>
   <button type="button" class="link" id="forgot">Forgot password?</button></form></div>`;
  $('#forgot').onclick=()=>authScreen('forgot');
  $('#lform').onsubmit=async e=>{e.preventDefault();$('#lbtn').disabled=true;$('#aerr').textContent='';
    const {error}=await SB.auth.signInWithPassword({email:$('#lem').value.trim(),password:$('#lpw').value});
    $('#lbtn').disabled=false;if(error){$('#aerr').textContent=error.message==='Invalid login credentials'?'Wrong email or password.':(error.message||'Couldn’t sign in.');return}
    start()};
}

// ---------- load ----------
function applySnap(snap,col,map){let ch=false;for(const d of snap.docs){S.known[col+'/'+d.id]=true;if(pending[col+'/'+d.id])continue;const s=JSON.stringify(d.data());if(JSON.stringify(map[d.id])!==s){map[d.id]=JSON.parse(s);ch=true}}return ch}
function onErr(e){if(S.loaded&&e&&e.code==='offline'){setStatus(Object.keys(pending).length?OFFLINE_SAVED:'Offline');return}S.note='Lost the connection to your saved data. It will retry when the app comes back into view.';setStatus('Offline');render()}
let STARTED=false;
async function start(){
  if(STARTED)return;
  let session=null,netErr=false;
  try{const r=await SB.auth.getSession();session=r.data&&r.data.session;netErr=!!r.error&&/fetch|network/i.test((r.error.name||'')+(r.error.message||''))}catch(e){netErr=true}
  // With no signal the sign-in can't be refreshed. If this phone was signed in, open its saved copy; nothing sends until it's back online.
  const user=session?session.user:((navigator.onLine===false||netErr)?LS.get('gj_last'):null);
  if(!user){S.boot=false;return authScreen('login')}
  if(NEEDS_PW&&!S.pwDone){S.pwDone=true;return authScreen('setpw')}
  STARTED=true;
  document.body.classList.remove('signedout');$('#auth').innerHTML='';
  ME.user=user;LS.set('gj_last',{id:user.id,email:user.email});
  S.sample=null;S.boot=false;
  const db=makeDb(ME.user.id);S.db=db;
  if(openCopy())setStatus(navigator.onLine===false?'Offline':'Syncing…');
  render();
  SB.from('profiles').select('display_name,is_admin').eq('id',ME.user.id).maybeSingle().then(({data})=>{if(data){ME.profile=data;keepCopy();meBadge()}},()=>{});
  const timer=setTimeout(()=>{if(!S.loaded){S.timedOut=true;S.note='Still connecting, so some saved data may be missing. Check your connection; it will fill in once it connects.';setStatus('Connecting…');render()}},10000);
  const got=k=>{S.ready[k]=true;keepCopy();if(!S.synced&&S.ready.days&&S.ready.workouts&&S.ready.settings){S.synced=S.loaded=true;clearTimeout(timer);if(S.note&&S.note.startsWith('Still'))S.note=null;if(!Object.keys(pending).length)setStatus('Saved ✓');keepCopy();render();checkPlan();queueBoard();ensureFocus();return true}return false};
  db.collection('days').onSnapshot(s=>{const ch=applySnap(s,'days',S.days);if(!got('days')&&ch)softRender()},onErr);
  db.collection('workouts').onSnapshot(s=>{const ch=applySnap(s,'workouts',S.workouts);if(!got('workouts')&&ch)softRender()},onErr);
  db.doc('settings/main').onSnapshot(s=>{if(s.exists)S.known['settings/main']=true;let ch=false;if(!pending['settings/main']){const v=s.exists?s.data():{};if(JSON.stringify(v)!==JSON.stringify(S.settings)){S.settings=clone(v);ch=true}}if(!got('settings')&&ch)softRender()},onErr);
}
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('sw.js').catch(()=>{});
render();
if(!SB){S.boot=false;S.note='App isn’t configured: check config.js.';render()}
else{
  SB.auth.onAuthStateChange((ev,session)=>{if(ev==='SIGNED_OUT'&&STARTED)location.replace(location.pathname)});
  start();
}
