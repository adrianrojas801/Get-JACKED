"use strict";
// The Plan tab, the intake form, the program editor, and custom program requests.
// Loaded by index.html in a fixed order (see the <script> tags there). All files share one global scope.

// ---------- intake requests (custom programs written outside the app) ----------
// The person's answers go to public.intake_requests, the one place an admin can read anything of theirs.
// The admin pastes a written program back; the person chooses to switch to it.
async function sendIntake(){
  const a=cfg().intakePending;if(!a||!SB)return false;
  let error=null;try{({error}=await SB.from('intake_requests').insert({answers:a}))}catch(e){error=e}
  if(error){S.reqSendMsg='Couldn’t send your answers. Check your connection and try again.';render();return false}
  const s=clone(cfg());delete s.intakePending;putSettings(s);S.reqSendMsg='Sent ✓';render();return true;
}
function stripToJson(txt){const t=String(txt||'');const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a<0||b<a)throw 'Paste the program text, starting with { and ending with }.';return JSON.parse(t.slice(a,b+1))}
// Checks and cleans a written program before it's sent or applied. Throws a message for the admin.
function normPlan(raw){
  let x=raw;if(x&&x.days&&!x.program)x={program:x};
  if(!x||typeof x!=='object'||!x.program||!x.program.days||typeof x.program.days!=='object'||Array.isArray(x.program.days))throw 'It needs a "program" with "days".';
  const P=x.program,days={};
  for(const [k,d] of Object.entries(P.days)){
    if(!/^[A-Za-z0-9_-]{1,20}$/.test(k)||k==='rest')throw `"${k}" can’t be a day key. Use short letters or numbers, like "upA".`;
    if(!d||!Array.isArray(d.ex)||!d.ex.length)throw `Day "${k}" needs an "ex" list of exercises.`;
    days[k]={t:String(d.t||k).slice(0,40),ex:d.ex.slice(0,15).map((e,i)=>{
      if(!e||!String(e.n||'').trim())throw `Day "${k}", exercise ${i+1} needs a name ("n").`;
      const o={n:String(e.n).trim().slice(0,60),s:Math.max(1,Math.min(10,Math.round(num(e.s)||3))),r:String(e.r||'8-12').slice(0,12),rest:Math.max(0,Math.min(600,Math.round(num(e.rest)||90)))};
      if(num(e.inc)>0)o.inc=Math.min(50,num(e.inc));if(e.ss)o.ss=String(e.ss).slice(0,3);if(e.note)o.note=String(e.note).slice(0,300);return o})};
  }
  const keys=Object.keys(days);if(!keys.length)throw 'The program has no days.';if(keys.length>10)throw 'That’s more than 10 days.';
  const order=(Array.isArray(P.order)?P.order:[]).filter((k,i,a)=>days[k]&&a.indexOf(k)===i);for(const k of keys)if(!order.includes(k))order.push(k);
  if(!Array.isArray(P.sched)||P.sched.length!==7)throw '"sched" needs 7 entries, Sunday to Saturday.';
  const sched=P.sched.map(v=>{if(v==='rest'||days[v])return v;throw `"sched" has "${v}", which isn’t one of the days.`});
  const out={program:{days,order,sched}};
  if(Array.isArray(x.presets))out.presets=x.presets.filter(q=>q&&String(q.n||'').trim()).slice(0,60).map(q=>({g:String(q.g||'Meals').slice(0,30),n:String(q.n).trim().slice(0,60),c:Math.max(0,Math.round(num(q.c)||0)),p:Math.max(0,Math.round((num(q.p)||0)*10)/10)}));
  if(Array.isArray(x.focus)){const f=[...new Set(x.focus.filter(k=>MUS_NAME[k]))].slice(0,8);if(f.length)out.focus=f}
  if(num(x.cal)>=1200&&num(x.cal)<=5000)out.cal=Math.round(num(x.cal));
  if(num(x.pro)>=50&&num(x.pro)<=300)out.pro=Math.round(num(x.pro));
  return out;
}
const PLAN_FORMAT=`{"program":{"days":{"upA":{"t":"Upper A","ex":[{"n":"Smith bench press","s":3,"r":"6-10","rest":150,"note":"optional tip"},{"n":"Cable curl","s":3,"r":"10-12","rest":45,"ss":"A"}]}},"order":["upA"],"sched":["rest","upA","rest","rest","rest","rest","rest"]},"focus":["uchest","sdelt"],"presets":[{"g":"Meals","n":"Chipotle chicken bowl","c":650,"p":45}],"cal":2400,"pro":160}`;
function reqPrompt(r,name){
  const a=r.answers||{},line=(l,v)=>v!=null&&v!==''?`- ${l}: ${v}\n`:'';
  return `Write a Get Jacked workout program for ${name||a.name||'this person'}, the same way you wrote Pablo’s: keep what works from their routine, fix what doesn’t, and fit their goal.

About them
${line('Sex',a.sex==='f'?'Female':a.sex==='m'?'Male':'')}${line('Age',a.age)}${line('Height',a.height)}${line('Weight',a.weight?a.weight+' lbs':'')}${line('Goal',a.goal)}${line('Goal weight',a.goalWeight?a.goalWeight+' lbs':'')}${line('Activity outside the gym',a.activity)}${line('Days a week they can lift',a.days)}${line('Lifting for',a.experience)}${line('Targets the app set',a.targets)}
Current routine
${a.routine||'(not given)'}

What they want to improve
${a.focus||'(not given)'}

Injuries or anything that hurts
${a.injuries||'None given'}

When they can train
${a.when||'(not given)'}

Foods they eat a lot
${a.foods||'(not given)'}

Rules
- Planet Fitness only: Smith machine, cable crossover, hack squat, leg press, dumbbells, machines. No free barbell rack.
- Double progression: when every set hits the top of the rep range, add weight.
- Most sets 0–2 reps short of failure. Isolation can go to failure; a drop set on the last isolation set is fine. Heavy Smith lifts stay 1–2 reps short.
- Rest 2–3 min on compounds, at least 90 s on isolation. Supersets can rest less between the paired moves.
- "focus" lists the muscles they most want to improve, taken from their answers, using these keys: ${Object.keys(MUS_NAME).join(', ')}. Give each focus muscle about 12–20 hard sets a week (a lift's main muscles count a full set, helping muscles half) and put its lifts early in the session.
- Optional "inc" on an exercise is how many lbs to add when they hit the top of the rep range on every set. Leave it out for the defaults (10 on Smith lifts, 5 on everything else). Use 2.5 for small moves on machines that have add-on weights.
- About 10–20 hard sets per muscle per week. Compounds first. No scheduled deloads.
- Short notes only where they help (setup, what to log, when to go up).

Reply with one JSON block in exactly this shape (ss = superset letter, optional; presets, cal and pro are optional; sched is Sunday to Saturday):
${PLAN_FORMAT}`;
}
async function loadReqs(){
  if(!SB||!(ME.profile&&ME.profile.is_admin))return;
  S.reqErr=null;
  try{
    const [r,n]=await Promise.all([SB.from('intake_requests').select('id,user_id,answers,status,created_at').order('created_at',{ascending:false}).limit(50),SB.from('profiles').select('id,display_name')]);
    if(r.error)throw r.error;S.reqs=r.data||[];S.reqNames={};for(const x of (n.data||[]))S.reqNames[x.id]=x.display_name;
  }catch(e){S.reqErr='Couldn’t load requests. Tap Refresh to try again.'}
  if(S.tab==='account')render();
}
async function sendPlan(id){
  const box=$('#reqplan');let plan;
  try{plan=normPlan(stripToJson(box&&box.value))}catch(e){S.reqMsg={id,t:'That program has a problem: '+(e&&e.message||e)};return render()}
  S.reqDraft=box.value;
  const {error}=await SB.rpc('send_intake_plan',{p_id:id,p_plan:plan});
  if(error){S.reqMsg={id,t:'Couldn’t send it: '+(error.message||'try again.')};return render()}
  S.reqMsg={id,t:'Sent ✓ They’ll see it next time they open the app.'};S.reqOpen=null;S.reqDraft='';loadReqs();
}
function viewRequests(){
  if(!(ME.profile&&ME.profile.is_admin))return '';
  if(S.reqs==null&&!S.reqErr){loadReqs();return `<div class="card"><h2>Intake requests</h2><div class="muted">Loading…</div></div>`}
  const label={new:'New',sent:'Sent, waiting for them to switch',applied:'Using it ✓'};
  let h=`<div class="card"><div class="row between"><h2 style="margin:0">Intake requests</h2><button class="small" data-act="reqload">Refresh</button></div>`;
  if(S.reqErr)h+=`<div class="warn" style="margin-top:8px">${esc(S.reqErr)}</div>`;
  else if(!S.reqs.length)h+=`<div class="muted" style="margin-top:8px">No requests yet. When someone finishes setup, their answers show up here.</div>`;
  else h+=`<div class="muted" style="margin-top:6px">Tap <b>Copy for Claude</b>, paste it into Claude, then paste Claude’s program back with <b>Send program</b>.</div><ul class="list" style="margin-top:6px">`+S.reqs.map(r=>{
    const nm=S.reqNames[r.user_id]||(r.answers&&r.answers.name)||'Someone',open=S.reqOpen===r.id,msg=S.reqMsg&&S.reqMsg.id===r.id?S.reqMsg.t:'';
    return `<li style="flex-wrap:wrap"><div class="grow"><b>${esc(nm)}</b><div class="muted">${esc(new Date(r.created_at).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}))} · ${esc(label[r.status]||r.status)}</div></div>
      <button class="small" data-act="reqcopy" data-id="${esc(r.id)}">${S.reqCopied===r.id?'Copied ✓':'Copy for Claude'}</button><button class="small${open?' primary':''}" data-act="reqopen" data-id="${esc(r.id)}">Send program</button>
      ${S.reqCopyText&&S.reqCopyText.id===r.id?`<textarea readonly style="width:100%;height:120px;margin-top:6px">${esc(S.reqCopyText.t)}</textarea><div class="muted" style="width:100%">Couldn’t copy automatically. Select all and copy.</div>`:''}
      ${open?`<div style="width:100%;margin-top:8px"><textarea id="reqplan" rows="6" placeholder="Paste the program Claude wrote">${esc(S.reqDraft||'')}</textarea><div class="row wrap" style="margin-top:6px"><button class="small primary" data-act="reqsend" data-id="${esc(r.id)}">Send to ${esc(nm)}</button><button class="small" data-act="reqopen" data-id="${esc(r.id)}">Cancel</button></div></div>`:''}
      ${msg?`<div class="${/^Sent/.test(msg)?'good':'warn'}" style="width:100%;margin-top:6px">${esc(msg)}</div>`:''}</li>`}).join('')+`</ul>`;
  return h+`</div>`;
}
function pendingCard(){
  if(!cfg().intakePending)return '';
  return `<div class="card"><h2>Setup answers</h2><p class="muted">Your answers for a custom program haven’t been sent yet.</p><div class="row wrap"><button class="small primary" data-act="reqresend">Send now</button><span class="muted">${esc(S.reqSendMsg||'')}</span></div></div>`;
}
// The person's side: is a written program waiting for them?
async function checkPlan(){
  if(!SB||!ME.user)return;
  try{const {data,error}=await SB.from('intake_requests').select('id,plan,status').eq('user_id',ME.user.id).eq('status','sent').order('created_at',{ascending:false}).limit(1);
    if(error)return;const r=data&&data[0];let ok=null;if(r){try{ok={id:r.id,plan:normPlan(r.plan)}}catch(e){}}
    const had=!!S.newPlan;S.newPlan=ok;if(had!==!!ok)softRender();
  }catch(e){}
}
function newPlanCard(){
  const np=S.newPlan;if(!np||(S.planLater&&S.tab==='today'))return '';
  const P=np.plan.program,days=P.order.map(k=>P.days[k].t);
  return coachOpen('Your new program is ready')+`<p>${days.length} days: ${esc(days.join(', '))}.</p><p class="muted">Switching replaces your current program${np.plan.cal||np.plan.pro?' and targets':''}. Your logged workouts, food and weigh-ins stay.</p><div class="row wrap"><button class="primary" data-act="planuse">Use it</button>${S.tab==='today'?'<button data-act="planlater">Not now</button>':''}</div></div>`;
}
async function applyPlan(){
  const np=S.newPlan;if(!np)return;
  const s=clone(cfg());s.program=clone(np.plan.program);
  if(np.plan.presets&&np.plan.presets.length){const ps=Array.isArray(s.presets)?s.presets:clone(presets());for(const q of np.plan.presets)if(!ps.some(y=>y.n===q.n))ps.push(q);s.presets=ps;
    const gs=Array.isArray(s.foodGroups)?s.foodGroups:foodGroups().slice();for(const q of np.plan.presets)if(!gs.includes(q.g))gs.push(q.g);s.foodGroups=gs}
  if(np.plan.cal)s.cal=np.plan.cal;if(np.plan.pro)s.pro=np.plan.pro;if(np.plan.focus)s.focus=np.plan.focus;
  putSettings(s);S.newPlan=null;S.wp=null;S.flash='You’re on your new program. You can still change it under Plan.';render();window.scrollTo(0,0);
  try{await SB.rpc('mark_intake_applied',{p_id:np.id})}catch(e){}
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&S.loaded){checkPlan();if(S.tab==='account')loadReqs()}});
function viewAccount(){
  let h=`<div class="backrow"><button class="small" data-act="meback">← Back</button></div>`;
  h+=viewRequests();
  h+=pendingCard();
  h+=accountUI()+remindersCard()+stepsCard();
  h+=`<div class="card"><h2>Backup</h2><p class="muted">Your data saves to your account automatically. This copies all of it as text, if you ever want a backup.</p><button class="small" data-act="copy">${S.copied?'Copied ✓':'Copy all data'}</button>${S.copyText?`<textarea readonly style="margin-top:8px;height:120px">${esc(S.copyText)}</textarea>`:''}</div>`;
  return h;
}
function viewPlan(){
  if(S.redo)return viewIntake(true);
  const t=T(),c=cfg(),bw=blockWeek();
  let h=suggestCard()+`<div class="card"><h2>Targets</h2><div class="grid2">
    <label class="f">Calories / day<input type="number" inputmode="numeric" data-set="cal" value="${t.cal}"></label>
    <label class="f">Protein (g) / day<input type="number" inputmode="numeric" data-set="pro" value="${t.pro}"></label>
    <label class="f">Goal weight (lbs)<input type="number" inputmode="decimal" data-set="goal" value="${t.goal}"></label>
    <label class="f">Block start date<input type="date" data-set="block" value="${t.block||''}"></label>
    <label class="f" style="grid-column:1/3">Goal<select id="goalsel">${Object.entries(GOALS).map(([v,l])=>`<option value="${v}" ${goalOf()===v?'selected':''}>${esc(l)}</option>`).join('')}</select></label></div>
    <div class="muted" style="margin-top:6px">${esc(phaseLine())}. Changing the goal changes the weekly advice, not your targets, so update those too.</div>
    <div class="row wrap" style="margin-top:8px"><button class="small" data-act="newblock">Start new 8-week block today</button><span class="muted">${bw?'Currently week '+bw+' of 8':'No block started'}</span></div>
    <ul class="plain muted" style="margin-top:8px">${goalNotes()}</ul></div>`;
  h+=newPlanCard()+viewProgramEditor();
  // The training rules and food tips are reference material, so they stay folded away until asked for.
  h+=`<details class="card how" ${S.howOpen?'open':''}><summary><h2>How this works</h2><span class="muted">Training rules and food tips</span></summary>
    <h3>Training</h3><ul class="plain">
    <li>Keep the same main lifts for 6–8 weeks. Only swap isolation moves.</li>
    <li><b>Double progression:</b> once you hit the top of the rep range on every set, add weight and start again at the bottom of the range.</li>
    <li>Take most sets to 0–2 reps short of failure. Isolation moves can go all the way to failure, and a drop set on the last set is fine. Keep heavy Smith lifts at 1–2 reps left.</li>
    <li>Rest 2–3 min on compounds and at least 90 sec on isolation. Supersets let you rest less without losing quality.</li>
    <li>No scheduled deloads. Take an easier week only if your lifts stall for 2+ weeks or your joints and energy feel beat up.</li>
    <li>Take creatine 3–5 g daily, sleep 7.5–8 h, get 8–10k steps or 2–3 incline walks a week.</li></ul>
    <h3>Food</h3><ul class="plain">${isLegacy()?`
    <li>Get protein at every meal: eggs or yogurt for breakfast, double protein at work, a real meat portion at dinner.</li>
    <li>Add a whey shake whenever you’re behind on protein.</li>
    <li>Six corn tortillas is about 350 cal. Six flour tortillas is about 850. Corn helps you stay lean.</li>
    <li>Jamba is mostly sugar unless you add the protein boost.</li>
    <li>Pozole, ceviche, chicken and beef are great. Rice and beans are your bulking carbs.</li>`:genericFood()}</ul>
    <p class="muted">To change your quick-add foods, tap <b>All foods</b> on Today, then <b>Edit</b>.</p>
    <h3>Where the rules come from</h3><ul class="plain src">${SOURCES.map(([what,who,url])=>`<li>${what} <a href="${url}" target="_blank" rel="noopener">${who}</a></li>`).join('')}</ul>
    <p class="muted" style="margin-bottom:0">The 10% back-off after a stall, the ±150 calorie steps and the 6–8 week mini-cut are common coaching practice, not tested rules.</p></details>`;
  return h;
}

function render(){
  {const td=today(),pg=schedOn(td);const hs=$('#hsub');if(hs)hs.textContent=parseKey(td).toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})+' · '+titleOf(pg)}
  S.needRender=false;
  let h=S.note?`<div class="banner warn">${esc(S.note)}</div>`:'';
  if(S.boot||(S.db&&!S.loaded&&!S.timedOut)){$('#app').innerHTML=h+`<div class="card" style="text-align:center;padding:28px 12px"><b>Loading your data…</b><div class="muted" style="margin-top:6px">Pulling your saved logs and workouts.</div></div>`;document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.tab===S.tab));return}
  ensureProgram();
  meBadge();
  if(needsIntake()&&S.tab!=='account'){document.body.classList.add('setup');$('#app').innerHTML=h+viewIntake(false);return}
  document.body.classList.remove('setup');
  if(S.flash)h+=`<div class="banner">${esc(S.flash)}</div>`;
  h+=({today:viewToday,workout:viewWorkout,progress:viewProgress,plan:viewPlan,account:viewAccount}[S.tab]||viewToday)();
  if(S.tab!=='today')S.sheet=null;
  const keep=S.sheet&&$('.sheet')?$('.sheet').scrollTop:0;
  if(S.sheet==='foods')h+=foodSheet();
  document.body.classList.toggle('sheeton',!!S.sheet);
  $('#app').innerHTML=h;
  if(keep){const sh=$('.sheet');if(sh){sh.style.animation='none';sh.scrollTop=keep}}
  document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.tab===S.tab));
}
function meBadge(){const b=$('#me');if(!b)return;const n=((ME.profile&&ME.profile.display_name)||(ME.user&&ME.user.email)||'').trim();b.textContent=n?n[0]:'?';b.classList.toggle('on',S.tab==='account')}
function toggleAccount(){if(S.tab==='account'){S.tab=S.prevTab||'today'}else{S.prevTab=S.tab==='account'?'today':S.tab;S.tab='account';S.reqs=null;S.reqMsg=null;S.stepLink=undefined;S.push=undefined}S.swap=null;S.redo=false;render();window.scrollTo(0,0)}
$('#me').addEventListener('click',toggleAccount);
function softRender(){const a=document.activeElement;if(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)&&$('#app').contains(a)){S.needRender=true;return}render()}
document.addEventListener('focusout',()=>setTimeout(()=>{if(S.needRender){const a=document.activeElement;if(!(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)))render()}},50));
