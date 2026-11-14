"use strict";
// The Today tab: food logging, the food sheet, and photo food estimates.
// Loaded by index.html in a fixed order (see the <script> tags there). All files share one global scope.

// ---------- views ----------
function foodTotals(d){let c=0,p=0;for(const f of d.food||[]){c+=(f.c||0)*(f.q||1);p+=(f.p||0)*(f.q||1)}return {c,p}}
function bar(v,t){const pct=Math.min(100,Math.round(v/t*100));return `<div class="bar ${v>=t?'done':''}"><div style="width:${pct}%"></div></div>`}

// ---------- food log ----------
const sameFood=(f,p)=>f.n===p.n&&f.c===(+p.c||0)&&f.p===(+p.p||0);
// Adds q of a food to a day (bumps the count if it's already there). Every way of logging food goes through here.
// A new entry also notes the hour (h) when it's logged on the day itself, so topFoods() can learn what you eat when.
function addFood(d,p,q=1){const n=String(p.n).trim(),x={n,c:+p.c||0,p:+p.p||0};const ex=d.food.find(f=>sameFood(f,x));if(ex)ex.q=(ex.q||1)+q;else{const h=p.h!=null?p.h:(d.date===today()?new Date().getHours():null);d.food.push(Object.assign(x,{q},h!=null?{h}:{}))}return d}
// Foods logged in the last 3 weeks that aren't quick-add buttons yet, newest first.
function recentFoods(k){
  const ps=presets(),out=[];
  for(let i=1;i<=21&&out.length<8;i++)for(const f of (S.days[addDays(k,-i)]||{}).food||[])
    if(out.length<8&&!ps.some(p=>sameFood(f,p))&&!out.some(o=>sameFood(f,o)))out.push({n:f.n,c:f.c,p:f.p});
  return out;
}
// One quick-add food that closes the most of the protein gap without blowing the calories left.
function proteinIdea(d,t){
  const tot=foodTotals(d),gap=t.pro-tot.p,left=t.cal-tot.c;if(gap<15)return '';
  const fits=presets().filter(p=>p.p>=8&&p.c<=Math.max(left,0)+200);if(!fits.length)return '';
  const pick=fits.sort((a,b)=>Math.min(b.p,gap)-Math.min(a.p,gap)||a.c-b.c)[0];
  return `<div class="muted" style="margin-top:4px">Idea: ${esc(pick.n)} gets you ${fmt(Math.min(pick.p,gap))} g closer for ${fmt(pick.c)} cal.</div>`;
}
function pq(d,p){return ((d.food||[]).find(f=>sameFood(f,p))||{}).q||0}
function foodSum(d,t){const tot=foodTotals(d);return `<div class="fsum"><div class="muted">${tot.p>=t.pro?'<span class="good">Protein hit ✓</span>':`${fmt(t.pro-tot.p)} g protein to go`} · ${tot.c>=t.cal?'calories hit':fmt(t.cal-tot.c)+' cal left'}</div>${S.dk===today()?proteinIdea(d,t):''}</div>`}
function foodLog(d){return `<div id="flog">${(d.food||[]).length?`<h3>Logged</h3><ul class="list">`+d.food.map((f,i)=>`<li data-fn="${esc(f.n)}"><div class="grow">${esc(f.n)}${(f.q||1)>1?` <b>×${f.q}</b>`:''}<div class="muted">${fmt(f.c*(f.q||1))} cal · ${r1(f.p*(f.q||1))} g</div></div><button class="small" data-act="fq" data-i="${i}" data-v="-1">−</button><button class="small" data-act="fq" data-i="${i}" data-v="1">+</button></li>`).join('')+`</ul>`:''}</div>`}
// The foods you log most, with the ones you usually eat around this time of day first. Quick-add foods fill any gaps.
// Only earlier days count, so the buttons don't move while you're logging.
function topFoods(k,n=6){
  const hr=new Date().getHours(),score=new Map();
  for(let i=1;i<=30;i++)for(const f of (S.days[addDays(k,-i)]||{}).food||[]){
    const key=f.n+'|'+f.c+'|'+f.p,gap=f.h==null?99:Math.abs(f.h-hr),near=Math.min(gap,24-gap)<=3;
    const e=score.get(key)||{f:{n:f.n,c:f.c,p:f.p},s:0};e.s+=(near?3:1)*(i<=7?2:1);score.set(key,e)}
  const out=[...score.values()].sort((x,y)=>y.s-x.s||x.f.n.localeCompare(y.f.n)).map(e=>e.f);
  for(const p of presets()){if(out.length>=n)break;const x={n:p.n,c:+p.c||0,p:+p.p||0};if(!out.some(o=>sameFood(o,x)))out.push(x)}
  return out.slice(0,n);
}
// Where each kind of food button gets its list. The click handler and refreshFood both read from here.
const FOOD_SRC={preset:()=>presets(),recent:()=>recentFoods(S.dk),quick:()=>topFoods(S.dk)};
const chip=(act,i,p,d)=>{const q=pq(d,p);return `<button class="${q?'has':''}" data-act="${act}" data-i="${i}">${esc(p.n)}<br><span class="muted">${p.c} cal · ${p.p}g</span><span class="qn">×${q}</span></button>`};
// After a food tap: update the totals, rings, log and button counts in place, without redrawing the screen.
function refreshFood(d,changed){
  if(!$('.fsum')||!$('#flog')){render();return}
  app.querySelectorAll('.fsum').forEach(x=>{x.outerHTML=foodSum(d,T())});$('#flog').outerHTML=foodLog(d);
  {const hr=$('#hero');if(hr)hr.outerHTML=hero(d,T())}
  if(changed){const li=[...$('#flog').querySelectorAll('li')].find(l=>l.dataset.fn===changed);if(li)li.classList.add('pop')}
  app.querySelectorAll('.chips button[data-i]').forEach(c=>{const src=FOOD_SRC[c.dataset.act],p=src&&src()[+c.dataset.i];if(!p)return;const q=pq(d,p);c.classList.toggle('has',q>0);const sp=c.querySelector('.qn');if(sp)sp.textContent='×'+q});
}
// Weight, steps and creatine are always there. The rest only show if you've used them lately, or under More.
const BODY_MORE=[['sleep','Sleep (hrs)','7.5','0.1',14],['cardio','Cardio (min)','20','1',14]];
const usedLately=(f,days)=>{for(let i=0;i<days;i++){const d=S.days[addDays(today(),-i)];if(d&&num(d[f])!=null)return true}return false};
function bodyCard(k,d){
  const fld=(f,l,ph,step='0.1')=>`<label class="f">${l}<input type="number" inputmode="decimal" step="${step}" data-day="${f}" value="${d[f]??''}" placeholder="${ph}"></label>`;
  const lastW=(()=>{const ks=Object.keys(S.days).filter(x=>x<k&&num(S.days[x].weight)).sort();const lw=ks.length?num(S.days[ks[ks.length-1]].weight):(cfg().profile&&cfg().profile.weight);return lw?Number(lw).toFixed(1):'lbs'})();
  const measOn=S.bodyMore||MEAS.some(([f])=>num(d[f])!=null)||(k===today()&&measDue()&&measDays().length>0);
  const shown=BODY_MORE.filter(([f,,,,days])=>S.bodyMore||num(d[f])!=null||usedLately(f,days)),hidden=BODY_MORE.length-shown.length;
  return `<div class="card"><div class="row between"><h2 style="margin:0">Body</h2><label class="check"><input type="checkbox" data-day="creatine" ${d.creatine?'checked':''}> Creatine</label></div>
    <div class="grid2" style="margin-top:10px">${fld('weight',k===today()?'Weight this morning (lbs)':'Weight (lbs)',lastW)}${fld('steps','Steps','8000','1')}${shown.map(([f,l,ph,st])=>fld(f,l,ph,st)).join('')}</div>
    ${measOn?`<h3>${k===today()&&measDue()?'Measurement day (every 2 weeks)':'Measurements (in)'}</h3><div class="grid2">${MEAS.map(([f,l,ph])=>fld(f,l,ph)).join('')}</div>`:''}
    ${hidden||S.bodyMore||!measOn?`<button class="link" data-act="bodymore" style="margin-top:6px">${S.bodyMore?'Show less':'Sleep, cardio, measurements'}</button>`:''}</div>`;
}
// ---------- getting set up ----------
// A short checklist on Today for anyone who hasn't done the basics yet. It goes away when they're done, or on Hide.
const firstSteps=()=>[
  ['Log a workout',Object.values(S.workouts).some(trained),'Tap Open workout and log your sets.'],
  ['Weigh in',Object.values(S.days).some(d=>d&&num(d.weight)),'In the morning, before you eat. It goes under Body.'],
  ['Log a day of food',Object.values(S.days).some(d=>d&&(d.food||[]).length),'Tap a food under Food, or All foods for the full list.'],
  ['Take your starting measurements',measDays().length>0,'Under Body, tap Sleep, cardio, measurements.']];
function firstStepsCard(){
  if(cfg().welcomed)return '';
  const st=firstSteps(),done=st.filter(x=>x[1]).length;if(done===st.length)return '';
  return coachOpen('Getting set up','id="firststeps"')+`<div class="muted">${done} of ${st.length} done</div>${bar(done,st.length)}
    <ul class="plain ticks" style="margin-top:8px">${st.map(([t,ok,how])=>`<li><span class="${ok?'good':'muted'}">${ok?'✓':'○'}</span> ${ok?`<span class="muted">${t}</span>`:`<b>${t}</b><div class="muted" style="margin-left:22px">${how}</div>`}</li>`).join('')}</ul>
    <button class="link" data-act="welcomed">Hide this</button></div>`;
}
function viewToday(){
  const k=S.dk,d=dayDoc(k),t=T();
  const isToday=k===today();const prog=schedOn(k);
  let h=`<div class="row between"><button data-act="day" data-v="-1">◀</button><b>${isToday?'Today · ':''}${nice(k)}</b><div class="row"><button data-act="day" data-v="1" ${isToday?'disabled style="visibility:hidden" aria-hidden="true"':''}>▶</button></div></div>`;
  if(!isToday)h+=`<div style="text-align:center"><button class="link" data-act="gotoday">Jump to today</button></div>`;
  h+=newPlanCard();
  if(isToday)h+=firstStepsCard();
  if(isToday&&checkinDue())h+=checkinCard(true);
  h+=hero(d,t);
  {const sk=streaks(),plan=plannedPerWeek(),wk=weekStats(weekStart(k));
   h+=`<div class="card"><div class="row between"><h2 style="margin:0">${esc(titleOf(prog))}</h2>${prog==='rest'?'<span class="muted">Walk / 8–10k steps</span>':`<button class="small primary" data-act="startw">${trainedDates().has(k)?'Open workout ✓':'Open workout'}</button>`}</div>
    ${weekStrip(k)}<div class="muted">${wk.workouts}/${plan||'–'} workouts this week${sk.weeks>1?` · ${sk.weeks} weeks in a row on plan`:''}${sk.pro>1?` · protein hit ${sk.pro} days in a row`:''}</div>${isToday?buddyLine():''}</div>`}
  const yd=S.days[addDays(k,-1)],yt=yd&&(yd.food||[]).length?foodTotals(yd):null;
  h+=`<div class="card"><div class="row between"><h2 style="margin:0">Food</h2><button class="small primary" data-act="foods">All foods</button></div>
    <div style="margin-top:8px">${foodSum(d,t)}</div>
    <div class="chips" style="margin-top:8px">${topFoods(k).map((p,i)=>chip('quick',i,p,d)).join('')}</div>
    ${yt&&!(d.food||[]).length?`<button class="small" data-act="copyday" style="margin-top:12px">Log the same as yesterday (${fmt(yt.c)} cal · ${fmt(yt.p)} g)</button>`:''}${foodLog(d)}</div>`;
  h+=bodyCard(k,d);
  return h;
}
// The full food list, opened from Today: search, every quick-add group, recent foods, a custom entry, and Edit.
function foodSheet(){
  const k=S.dk,d=dayDoc(k),ps=presets(),groups={};
  foodGroups().forEach(g=>{groups[g]=[]});ps.forEach((p,i)=>{(groups[p.g||'Other']=groups[p.g||'Other']||[]).push([p,i])});
  const allGroups=Object.keys(groups),rc=recentFoods(k);
  let h=`<div class="sheet" role="dialog" aria-label="All foods"><div class="sheethead"><h2>${S.qedit?'Edit foods':'All foods'}</h2><div class="row"><button class="small" data-act="qedit">${S.qedit?'Back to list':'Edit'}</button><button class="small primary" data-act="sheetx">Done</button></div></div>`;
  if(S.qedit){
    h+=`<div class="muted">Change the numbers so they match what you actually eat. Changes save automatically.</div>`;
    for(const g of allGroups){const arr=groups[g];if(!arr.length)continue;h+=`<h3>${esc(g)}</h3><ul class="list qlist">`+arr.map(([p,i],j)=>`<li style="flex-wrap:wrap"><input data-pre="${i}" data-pf="n" value="${esc(p.n)}" style="flex:1 1 100%" aria-label="Name"><input data-pre="${i}" data-pf="c" type="number" inputmode="numeric" value="${p.c}" style="width:76px" aria-label="Calories"><span class="muted">cal</span><input data-pre="${i}" data-pf="p" type="number" inputmode="decimal" value="${p.p}" style="width:64px" aria-label="Protein"><span class="muted">g</span><select data-pre="${i}" data-pf="g" class="grow" aria-label="Group">${allGroups.map(x=>`<option ${x===(p.g||'Other')?'selected':''}>${esc(x)}</option>`).join('')}</select><button class="small" data-act="qmove" data-i="${i}" data-v="-1" ${j===0?'disabled':''} aria-label="Move up">↑</button><button class="small" data-act="qmove" data-i="${i}" data-v="1" ${j===arr.length-1?'disabled':''} aria-label="Move down">↓</button><button class="small qx" data-act="qdel" data-i="${i}" aria-label="Delete">✕</button></li>`).join('')+`</ul>`}
    if(rc.length)h+=`<h3>Recent</h3><ul class="list qlist">`+rc.map((p,i)=>`<li><div class="grow">${esc(p.n)}<div class="muted">${p.c} cal · ${p.p}g</div></div><button class="small" data-act="rckeep" data-i="${i}">Keep as quick add</button></li>`).join('')+`</ul>`;
    return h+`<div class="row wrap" style="margin-top:12px"><button class="small" data-act="preadd">+ Add food</button>${Array.isArray(cfg().presets)?`<button class="small" data-act="prereset">Reset to defaults</button>`:''}</div></div>`;
  }
  h+=`<div class="fsumrow">${foodSum(d,T())}</div><input id="fsearch" type="search" placeholder="Search foods" autocomplete="off" style="margin:10px 0 2px">`+snapUI();
  for(const g of allGroups){const arr=groups[g];if(!arr.length)continue;h+=`<div class="fgroup"><h3>${esc(g)}</h3><div class="chips">${arr.map(([p,i])=>chip('preset',i,p,d)).join('')}</div></div>`}
  if(rc.length)h+=`<div class="fgroup"><h3>Recent</h3><div class="chips">${rc.map((p,i)=>chip('recent',i,p,d)).join('')}</div></div>`;
  h+=`<h3>Something else</h3><div class="row"><input id="cn" placeholder="Food" class="grow"><input id="cc" type="number" inputmode="numeric" placeholder="cal" style="width:70px"><input id="cp" type="number" inputmode="decimal" placeholder="prot (g)" style="width:86px"><button data-act="custom">Add</button></div>
    <div class="muted" style="margin-top:8px">The numbers are estimates. Tap Edit to change them.</div></div>`;
  return h;
}

function snapUI(){
  if(!S.sample||S.sampleOff)return '';
  const sn=S.snap||{};
  let h=`<h3>Snap or describe</h3><div class="muted">${S.imgOK?'A photo of your plate, receipt, order screen or nutrition label, and/or a quick description. You review it before it’s added.':'Describe what you ate. You review it before it’s added.'}</div>`;
  if(S.imgOK)h+=`<div class="row" style="margin-top:8px"><label class="btn" for="snapfile"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>${S.snapFile?'Change photo':'Add photo'}</label><input type="file" id="snapfile" accept="image/*" hidden>${S.snapUrl?`<img class="snapimg" src="${S.snapUrl}" alt="food photo"><button class="small" data-act="snapclear">✕</button>`:''}</div>`;
  h+=`<textarea id="snaptxt" style="margin-top:8px" placeholder="e.g. Cava bowl, double chicken, brown rice, hummus · or: 2 plates, 6 corn tortillas">${esc(S.snapTxt||'')}</textarea>
   <button class="primary" data-act="snap" style="width:100%;margin-top:6px" ${sn.busy?'disabled':''}>${sn.busy?'Estimating… (can take ~30 sec)':'Estimate'}</button>`;
  if(sn.err)h+=`<div class="warn" style="margin-top:6px">${esc(sn.err)}</div>`;
  if(sn.items){
    if(!sn.items.length)h+=`<div class="muted" style="margin-top:6px">${esc(sn.note||'Nothing to add.')}</div>`;
    else{const tc=sn.items.reduce((a,x)=>a+x.c*x.q,0),tp=sn.items.reduce((a,x)=>a+x.p*x.q,0);
      h+=`<div class="banner" style="margin-top:8px"><div class="snaprow muted" style="margin-top:0"><span>Food</span><span>cal</span><span>prot g</span><span>qty</span><span></span></div>`+
      sn.items.map((x,i)=>`<div class="snaprow"><input data-sn="${i}" data-sf="n" value="${esc(x.n)}"><input data-sn="${i}" data-sf="c" type="number" inputmode="numeric" value="${x.c}"><input data-sn="${i}" data-sf="p" type="number" inputmode="decimal" value="${x.p}"><input data-sn="${i}" data-sf="q" type="number" inputmode="numeric" value="${x.q}"><button class="small" data-act="snapdel" data-i="${i}">✕</button></div>`).join('')+
      `<div class="muted" style="margin-top:6px">Total ≈ ${fmt(tc)} cal · ${fmt(tp)} g protein${sn.note?' · '+esc(sn.note):''}</div>
      <label class="check" style="margin-top:8px;font-size:14px"><input type="checkbox" id="snapsave"> Also save these as quick-add buttons</label>
      <div class="row" style="margin-top:8px"><button class="primary" data-act="snapadd">Add to log</button><button data-act="snapcancel">Discard</button></div></div>`}
  }
  return h;
}
// ---------- photo food estimates (off until the food-estimate function has its key; README, "Optional features") ----------
// Who is eating, so portions are judged for the right person. The estimating rules themselves live in the Edge Function.
function eaterLine(){
  if(isLegacy())return `A 5'8", 165 lb man near Chicago who mostly eats restaurant food (Sweetgreen, Cava, Chick-fil-A, Portillo's, Jamba) and home-cooked Mexican food.`;
  const p=cfg().profile||{};return `${p.sex==='f'?'A woman':p.sex==='m'?'A man':'An adult'}${p.weight?`, about ${p.weight} lb`:''}, ${GOALS[goalOf()].toLowerCase()}.`;
}
const blobToBase64=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]||'');r.onerror=()=>rej(new Error('read'));r.readAsDataURL(b)});
// Talks to the food-estimate Edge Function. Errors carry a short code that runSnap() turns into plain English.
const edgeSampler=()=>({async estimate({note,who,image}){
  const body={note,who};
  if(image){try{body.image=await blobToBase64(await shrinkImage(image,1024,0.8))}catch(e){throw {code:'image_rejected'}}}
  const {data,error}=await SB.functions.invoke('food-estimate',{body});
  if(error){let code='failed';try{code=(await error.context.json()).error||code}catch(e){}throw {code}}
  if(!data||data.error)throw {code:(data&&data.error)||'failed'};
  return data;
}});
// Asked once per visit, when the food sheet first opens: the feature only shows up if the function says it's ready.
async function probeEstimates(){
  if(S.estProbe||!SB||!SB.functions)return;S.estProbe=true;
  try{const {data,error}=await SB.functions.invoke('food-estimate',{body:{ping:true}});if(!error&&data&&data.ready){S.sample=edgeSampler();S.imgOK=true;if(S.sheet)softRender()}}catch(e){}
}
async function runSnap(){
  const txt=(S.snapTxt||'').trim();
  if(!S.snapFile&&!txt){S.snap={err:'Add a photo or a description first.'};render();return}
  S.snap={busy:true};render();
  try{
    const r=await S.sample.estimate({note:txt,who:eaterLine(),image:S.snapFile});
    const items=(r&&Array.isArray(r.items)?r.items:[]).slice(0,15).map(x=>({n:String((x&&x.n)||'Food').slice(0,60),c:Math.max(0,Math.round(+(x&&x.c)||0)),p:Math.max(0,r1(+(x&&x.p)||0)),q:Math.max(1,Math.round(+(x&&x.q)||1))}));
    S.snap={items,note:String((r&&r.note)||'').slice(0,200)};
  }catch(e){
    const c=e&&e.code;
    const m={rate_limited:'You’ve used today’s estimates. Try again tomorrow, or add it by hand below.',image_rejected:'That photo couldn’t be read. Try a different one.',session_expired:'Your sign-in ran out. Sign in again.',invalid_json:'Couldn’t read the estimate. Try again.',not_configured:'Photo estimates aren’t set up yet.'};
    if(c==='not_configured')S.sampleOff=true;
    S.snap={err:m[c]||'Estimate failed. Try again.'};
  }
  render();
}
function clearSnap(){if(S.snapUrl){try{URL.revokeObjectURL(S.snapUrl)}catch(e){}}S.snapUrl=null;S.snapFile=null;S.snapTxt='';S.snap=null}
