"use strict";
// The Progress tab and the coaching around it: phases, check-in, focus, suggestions, photos, measurements, sets per muscle.
// Loaded by index.html in a fixed order (see the <script> tags there). All files share one global scope.

// ---------- goal phases ----------
// Pace in lbs/week over the last 3 weeks (steadier than one week), falling back to the last week.
function pace(){
  const td=today(),wv=d=>num(d.weight),now=win(td,7,wv),then=win(addDays(td,-21),7,wv);
  if(now.length>=3&&then.length>=3)return (avg(now)-avg(then))/3;
  return weightTrend(td).ch;
}
// "At this pace you reach 173 lbs around Feb 20", or '' when there's no goal to move toward or no clear pace.
function etaText(){
  const g=goalOf(),A=weightTrend(today()).A,goal=T().goal,rate=pace();
  if(g==='maintain'||!A||rate==null)return '';
  const gap=goal-A;if(g==='bulk'?gap<=0:gap>=0)return '';
  if(Math.sign(rate)!==Math.sign(gap)||Math.abs(rate)<0.05)return '';
  const wks=gap/rate;if(wks>78)return '';
  return `At this pace you reach ${goal} lbs around ${parseKey(addDays(today(),Math.round(wks*7))).toLocaleDateString(undefined,{month:'short',day:'numeric'})}.`;
}
const goalReached=()=>{const g=goalOf(),A=weightTrend(today()).A,goal=T().goal;return !!A&&(g==='bulk'?A>=goal:g==='cut'?A<=goal:false)};
// What can come next once the goal weight is reached, with targets worked out from the current ones.
function nextPhases(){
  const t=T(),A=Math.round(weightTrend(today()).A),g=goalOf(),maint=t.cal-GOAL_ADJ[g],r50=v=>Math.round(v/50)*50,pro=m=>Math.min(220,Math.round(A*m/5)*5);
  if(g==='bulk')return [
    {goal:'cut',label:'Start a mini-cut',why:'6–8 weeks to lean out, then bulk again.',cal:Math.max(1600,r50(maint+GOAL_ADJ.cut)),pro:pro(1),gw:Math.round(A*0.95)},
    {goal:'bulk',label:'Keep bulking',why:'Stay on the same calories and aim higher.',cal:t.cal,pro:t.pro,gw:t.goal+5}];
  return [
    {goal:'maintain',label:'Hold this weight',why:'Eat at maintenance and keep getting stronger.',cal:r50(maint),pro:pro(0.9),gw:A},
    {goal:'bulk',label:'Start a lean bulk',why:'Add muscle at 0.25–0.5 lb a week.',cal:r50(maint+GOAL_ADJ.bulk),pro:pro(0.9),gw:A+8}];
}
function phaseCard(){
  if(!goalReached())return '';
  return coachOpen(`You reached ${T().goal} lbs`)+`<p class="muted" style="margin-top:0">Pick what’s next. This changes your calorie, protein and goal-weight targets. Your program stays the same.</p>
    ${nextPhases().map((p,i)=>`<div class="row between" style="margin-top:10px"><div class="grow"><b>${p.label}</b><div class="muted">${p.why} ${fmt(p.cal)} cal · ${p.pro} g protein · goal ${p.gw} lbs</div></div><button class="small ${i?'':'primary'}" data-act="phase" data-i="${i}">Choose</button></div>`).join('')}</div>`;
}
const phaseLine=()=>{const ps=cfg().phaseStart,wk=ps?Math.floor(daysBetween(ps,today())/7)+1:null;return GOALS[goalOf()]+(wk>0?` · week ${wk}`:'')};

// ---------- weekly check-in ----------
// New bests set and lifts stalled between two dates. Shared by the check-in and "Lifts this week".
function liftsMoved(from,to){
  const up=[],stuck=[];
  for(const n of liftNames()){const hist=liftHistory(n,to),last=hist[hist.length-1];if(!last||last.date<addDays(to,-21))continue;
    const top=bestOf(hist);
    if(hist.length>1&&top.date>from)up.push(`${n} ${top.top}`);else if(stallOf(hist))stuck.push(n)}
  return {up,stuck};
}
const lastWeek=()=>addDays(weekStart(today()),-7);
const lastWeekLogged=()=>{const w=weekStats(lastWeek());return w.workouts>0||w.cal>0};
const checkinDue=()=>cfg().checkin!==weekStart(today())&&lastWeekLogged();
// Last week in one card: what happened, and the few things to change this week.
function checkinCard(canDismiss){
  const ws=lastWeek(),end=addDays(ws,6),w=weekStats(ws),plan=plannedPerWeek(),t=T(),tr=weightTrend(end),lm=liftsMoved(addDays(ws,-1),end);
  const line=(ok,txt)=>`<li><span class="${ok?'good':'warn'}">${ok?'✓':'!'}</span> ${txt}</li>`,todo=[];
  let h=coachOpen('Week check-in','id="checkin"')+`<div class="muted">${short(ws)} – ${short(end)}</div><ul class="plain ticks">`;
  h+=line(plan&&w.workouts>=plan,`${w.workouts} of ${plan||'–'} workouts`);
  if(plan&&w.workouts<plan)todo.push(`Get all ${plan} workouts in. If a day keeps getting missed, move it under Plan.`);
  if(w.cal){h+=line(w.proteinDays>=5,`Protein hit ${w.proteinDays} of 7 days · averaged ${fmt(w.cal)} cal`);
    if(w.proteinDays<5)todo.push(`Hit ${t.pro} g protein at least 5 days. Get some at every meal and add a shake when you’re behind.`)}
  else{h+=line(false,'No food logged');todo.push('Log your food most days, so the calorie advice is based on what you eat.')}
  if(tr.ch!=null)h+=line(tr.ok,tr.text);
  else todo.push('Weigh in at least 3 mornings, so the app can tell if your calories are right.');
  if(lm.up.length)h+=line(true,`New bests: ${lm.up.map(esc).join(', ')}`);
  if(lm.stuck.length){h+=line(false,`Stalled: ${lm.stuck.map(esc).join(', ')}`);todo.push('Stalled lifts have lighter targets next time. Hit the top of the rep range, then build back up.')}
  {const ms=muscleWork(end).sets,lowF=focusList().filter(k=>(ms[k]||0)<SETS_LO);
   if(focusList().length&&w.workouts){h+=line(!lowF.length,lowF.length?`Focus muscles under ${SETS_LO} sets: ${lowF.map(k=>`${MUS_NAME[k]} (${r1(ms[k]||0)})`).join(', ')}`:`Every focus muscle got ${SETS_LO}+ sets`);
     if(lowF.length)todo.push(`Add a few sets for ${lowF.slice(0,2).map(k=>MUS_NAME[k].toLowerCase()).join(' and ')} under Plan, or make sure you don’t skip the day that trains ${lowF.length>1?'them':'it'}.`)}}
  if(w.steps)h+=line(w.steps>=STEP_GOAL,`${fmt(w.steps)} steps a day`);
  h+=`</ul>`;
  if(tr.adj||todo.length)h+=`<h3>This week</h3>${tr.adj?`<div style="margin-bottom:8px">${calButton(tr.adj)}</div>`:''}<ul class="plain">${todo.slice(0,3).map(x=>`<li>${x}</li>`).join('')}</ul>`;
  else h+=`<p class="good" style="margin:8px 0 0">Everything’s on track. Keep doing what you’re doing.</p>`;
  if(suggestions().length)h+=`<p style="margin:8px 0 0">Your plan has ${suggestions().length} suggested change${suggestions().length>1?'s':''}. <button class="link" data-act="gosug">Review under Plan</button></p>`;
  return h+`<div class="row" style="margin-top:10px"><button class="small ${canDismiss?'primary':''}" data-act="${canDismiss?'checkok':'checkhide'}">${canDismiss?'Got it':'Close'}</button></div></div>`;
}

function viewProgress(){
  const t=T(),td=today(),wv=d=>num(d.weight);
  const tr=weightTrend(td),A=tr.A,B=tr.B,verdict=trendText(tr),adj=calButton(tr.adj),eta=etaText();
  const ws=weightSeries();
  let h=`<div class="card">${titled('bw','Bodyweight',`Dots are daily weigh-ins and the line is the 7-day average. ${goalOf()==='bulk'?'The goal for this bulk is':'Your goal weight is'} ${t.goal} lbs. Weigh in the morning, after the bathroom and before eating.`)}<div class="kpis" style="margin-top:10px"><div class="kpi"><b>${A?r1(A):'–'}</b><span>7-day avg (lbs)</span></div><div class="kpi"><b>${A&&B?(A-B>=0?'+':'')+r1(A-B):'–'}</b><span>vs previous week</span></div></div>
    <p style="margin:10px 0 6px">${verdict}</p>${adj}${eta?`<p class="muted" style="margin:8px 0 0">${eta}</p>`:''}
    ${chart([{pts:ws.dots,color:'var(--muted)',dots:true},{pts:ws.avgp,color:'var(--accent)'}],{goal:t.goal,xl:[short(ws.start),short(ws.end)]})}
    </div>`;
  h=(S.showCheckin?checkinCard(false):lastWeekLogged()?`<button class="small" data-act="checkshow" style="margin:4px 0">Last week’s check-in</button>`:'')+h+phaseCard();
  // nutrition & habits (last 7 full days)
  const y=addDays(td,-1);const fd=[];for(let i=0;i<7;i++){const d=S.days[addDays(y,-i)];if(d&&(d.food||[]).length)fd.push(foodTotals(d))}
  const pHit=fd.filter(x=>x.p>=t.pro).length;
  const cr=win(td,7,d=>d.creatine?1:null).length,sl=avg(win(td,7,d=>num(d.sleep))),st=avg(win(td,7,d=>num(d.steps))),cd=win(td,7,d=>num(d.cardio)).reduce((x,y)=>x+y,0);
  const wk=Object.values(S.workouts).filter(w=>w.date>addDays(td,-7)&&trained(w)).length,planned=plannedPerWeek();
  const l7=h.length;
  h+=`<div class="card"><h2>Last 7 days</h2><div class="kpis">
    <div class="kpi"><b>${fd.length?fmt(avg(fd.map(x=>x.c))):'–'}</b><span>avg cal (target ${fmt(t.cal)})</span></div>
    <div class="kpi"><b>${fd.length?fmt(avg(fd.map(x=>x.p)))+' g':'–'}</b><span>avg protein (target ${t.pro})</span></div>
    <div class="kpi"><b>${pHit}/${fd.length||7}</b><span>days protein hit</span></div>
    <div class="kpi"><b>${wk}/${planned||'–'}</b><span>workouts</span></div>
    <div class="kpi"><b>${cr}/7</b><span>creatine days</span></div>
    <div class="kpi"><b>${sl?r1(sl)+' h':'–'}</b><span>avg sleep (aim 7.5–8)</span></div>
    <div class="kpi"><b>${st?fmt(st):'–'}</b><span>avg steps</span></div>
    <div class="kpi"><b>${cd||0} min</b><span>cardio</span></div></div>
    <div class="muted" style="margin-top:6px">Food averages only count days you logged, and leave out today.</div></div>`;
  if(!fd.length&&!wk)h=h.slice(0,l7);   // nothing logged in the last week: leave the card out
  h+=measCard()+photosCard();
  const wl=h.length;
  // waist
  const waist=Object.values(S.days).filter(d=>num(d.waist)).sort((a,b)=>a.date.localeCompare(b.date));
  h+=`<div class="card"><h2>Waist</h2>`;
  if(waist.length<2)h+=`<p class="muted">Measure at your belly button every 2 weeks (log it on the Today tab). Once you have two entries, this checks that weight is going on as muscle.</p>`;
  else{const f=waist[0],l=waist[waist.length-1];const dw=num(l.waist)-num(f.waist);
    const wf=win(f.date,7,wv),wl=win(l.date,7,wv);const dWt=(wl.length&&wf.length)?avg(wl)-avg(wf):null;
    let msg='';if(goalOf()==='bulk'&&dWt!=null&&dWt>0.5){const ratio=dw/dWt;msg=ratio>0.12?`<span class="warn">Waist is up ${r1(dw)}" for ${r1(dWt)} lbs gained, which is faster than ideal. Pull calories back a bit.</span>`:`<span class="good">Waist +${r1(dw)}" for ${r1(dWt)} lbs gained. That’s a clean bulk.</span>`}
    h+=`<table class="simple"><tr><th>Date</th><th>Waist</th><th>Weight</th></tr>${waist.slice(-6).reverse().map(d=>`<tr><td>${short(d.date)}</td><td>${num(d.waist)}"</td><td>${num(d.weight)??'–'}</td></tr>`).join('')}</table><p>${msg}</p>`}
  h+=`</div>`;
  if(waist.length<2)h=h.slice(0,wl);     // the waist check needs two entries to say anything
  // lifts (a section of its own: this week, sets per muscle, the chart for one lift, and records)
  const body=h;h=liftsWeekCard(td)+musclesCard(td);
  const names=liftNames();
  h+=`<div class="card"><h2>Lifts</h2>`;
  if(!names.length)h+=`<p class="muted">Finish some sets on the Workout tab and your lift history shows up here.</p>`;
  else{if(!S.lift||!names.includes(S.lift))S.lift=names.includes('Smith bench press')?'Smith bench press':names[0];
    const sess=liftHistory(S.lift),bw=sess.length&&sess[0].bw,st=stallOf(sess);
    h+=`<select id="liftsel">${names.map(n=>`<option ${n===S.lift?'selected':''}>${esc(n)}</option>`).join('')}</select>`;
    if(isLegacy()&&LIFT_GOALS[S.lift])h+=`<div class="muted" style="margin-top:6px">${LIFT_GOALS[S.lift]}</div>`;
    if(st)h+=`<p class="warn" style="margin:8px 0 0">No new best in ${st.n} sessions (since ${short(st.since)}). Take about 10% off and build back up, or swap it for a similar move.</p>`;
    h+=chart([{pts:sess.map((x,i)=>[i,x.v]),color:'var(--accent)'}],{xl:sess.length>1?[short(sess[0].date),short(sess[sess.length-1].date)]:null});
    h+=`<div class="muted">${bw?'The line is your most reps in a set each session.':'The line is your estimated 1-rep max from your best set each session.'}</div><table class="simple" style="margin-top:6px"><tr><th>Date</th><th>Best set</th><th>${bw?'Reps':'Est. 1RM'}</th></tr>${sess.slice(-8).reverse().map(x=>`<tr><td>${short(x.date)}</td><td>${x.top}</td><td>${Math.round(x.v)}</td></tr>`).join('')}</table>`}
  h+=`</div>`;
  const sections={body:()=>body,lifts:()=>names.length?h+recordsCard(names):`<div class="card"><p class="muted" style="margin:0">Log a workout and your lifts, records and sets per muscle show up here.</p></div>`,friends:()=>h2hCard()+boardCard()},sec=sections[S.psec]?S.psec:'body';
  return `<div class="seg" role="tablist">${[['body','Body'],['lifts','Lifts'],['friends','Friends']].map(([v,l])=>`<button role="tab" aria-selected="${v===sec}" class="${v===sec?'on':''}" data-act="psec" data-v="${v}">${l}</button>`).join('')}</div>`+sections[sec]();
}
// Which lifts set a new best in the last 7 days, and which have stalled.
function liftsWeekCard(td){
  const {up,stuck}=liftsMoved(addDays(td,-7),td);
  if(!up.length&&!stuck.length)return '';
  return `<div class="card"><h2>Lifts this week</h2>${up.length?`<p style="margin:0 0 6px"><span class="good">New bests:</span> ${up.map(esc).join(', ')}</p>`:'<p class="muted" style="margin:0 0 6px">No new bests in the last 7 days.</p>'}
    ${stuck.length?`<p style="margin:0"><span class="warn">Stalled 2+ weeks:</span> ${stuck.map(esc).join(', ')}. Take about 10% off these and build back up.</p>`:''}</div>`;
}
// ---------- focus muscles (from the person's own goals) ----------
// The owner's stated goal was more chest, shoulders and arms. Front delts are left out: pressing already covers them.
const LEGACY_FOCUS=['uchest','chest','sdelt','rdelt','biceps','triceps'];
// Words people use for what they want to improve, and the muscles they mean. Every match counts.
const FOCUS_WORDS=[[/upper chest|incline/,['uchest']],[/chest|pec/,['chest','uchest']],[/rear delt/,['rdelt']],[/side delt|lateral|wider|broad|width/,['sdelt']],[/shoulder|delt/,['sdelt','rdelt']],
  [/bicep/,['biceps']],[/tricep/,['triceps']],[/forearm|grip/,['forearms']],[/\barms?\b/,['biceps','triceps']],[/\blats?\b|v[- ]?taper|wings/,['lats']],[/lower back/,['lback']],[/\bback\b/,['lats','uback']],[/trap/,['traps']],
  [/oblique|love handle/,['obliques']],[/\babs?\b|core|six[- ]?pack|stomach/,['abs']],[/glute|butt|booty/,['glutes']],[/quad|thigh/,['quads']],[/hamstring|\bhams?\b/,['hams']],[/cal(f|ves)/,['calves']],[/\blegs?\b|lower body/,['quads','hams','glutes']]];
// Specific phrases come first and are taken out once matched, so "side delts" doesn't also count as every delt.
function focusFrom(text){let t=String(text||'').toLowerCase();const out=[];for(const [re,ks] of FOCUS_WORDS){const g=new RegExp(re.source,'g');if(!g.test(t))continue;t=t.replace(g,' ');for(const k of ks)if(!out.includes(k))out.push(k)}return out}
// One time, for anyone whose focus was never set: the owner gets his stated goal, everyone else gets theirs from the
// "what do you want to improve" answer they sent at setup. After that the stars are theirs to change.
async function ensureFocus(){
  if(!S.synced||needsIntake()||cfg().focus!==undefined||ensureFocus.busy)return;
  ensureFocus.busy=true;let f;
  try{
    if(isLegacy())f=LEGACY_FOCUS.slice();
    else if(cfg().intakePending&&cfg().intakePending.focus)f=focusFrom(cfg().intakePending.focus);
    else{const {data,error}=await SB.from('intake_requests').select('answers').eq('user_id',ME.user.id).order('created_at',{ascending:false}).limit(1);
      if(error)throw error;f=focusFrom(data&&data[0]&&data[0].answers&&data[0].answers.focus)}
    if(cfg().focus===undefined){const s=clone(cfg());s.focus=f;putSettings(s);if(S.tab==='progress'||S.tab==='today')softRender()}
  }catch(e){}   // no connection: it runs again on the next load
  ensureFocus.busy=false;
}

// The research behind the main rules, shown under Plan > How this works. docs/EVIDENCE.md has the full list.
const SOURCES=[
  ['More weekly sets grow more muscle, with diminishing returns; helper lifts count as half a set.','Pelland 2025','https://doi.org/10.1007/s40279-025-02344-w'],
  ['Sets taken closer to failure grow more muscle.','Robinson 2024','https://doi.org/10.1007/s40279-024-02069-2'],
  ['Resting over a minute helps a little; past about 90 seconds there is no clear extra growth.','Singer 2024','https://doi.org/10.3389/fspor.2024.1429789'],
  ['Adding reps or adding weight both work as progression.','Plotkin 2022','https://pubmed.ncbi.nlm.nih.gov/36199287/'],
  ['A planned week off mid-program did not add muscle and cost some strength.','Coleman 2024','https://pubmed.ncbi.nlm.nih.gov/38274324/'],
  ['Gaining weight faster mostly adds fat, not muscle.','Helms 2023','https://pubmed.ncbi.nlm.nih.gov/37914977/'],
  ['On a cut, losing about 0.7% of body weight a week kept more muscle than twice that pace.','Garthe 2011','https://pubmed.ncbi.nlm.nih.gov/21558571/'],
  ['Light and heavy weights grow similar muscle when sets are hard; heavy is better for max strength.','Schoenfeld 2017','https://pubmed.ncbi.nlm.nih.gov/28834797/'],
  ['Protein helps up to about 1.6 g per kg (0.7 g per lb) a day; the targets here sit above that.','Morton 2018','https://pubmed.ncbi.nlm.nih.gov/28698222/']];

// ---------- program suggestions (the plan adapts; you approve each change) ----------
// Planned hard sets per muscle a week, from the program and the weekly split (same counting as muscleWork).
function plannedSets(){
  const out={};
  for(const k of PROG().sched){const d=k!=='rest'&&dayOf(k);if(!d)continue;
    for(const e of d.ex){const mm=musFor(e.n);if(!mm)continue;mm.p.forEach(m=>{out[m]=(out[m]||0)+e.s});mm.s.forEach(m=>{out[m]=(out[m]||0)+e.s*0.5})}}
  return out;
}
// Planet Fitness friendly moves for each muscle: [name, rep range, rest]. The first is what gets added when nothing
// trains the muscle; the rest are what a stalled lift can be swapped for.
const MOVES={
  uchest:[['Incline DB press','8-12',120],['Low-to-high cable fly','12-15',90],['Incline Smith press','6-10',150]],
  chest:[['Chest press machine','8-12',120],['Pec deck','10-15',90],['Cable fly','12-15',90]],
  fdelt:[['Seated DB shoulder press','8-12',120],['Smith shoulder press','6-10',150]],
  sdelt:[['Cable lateral raise','12-20',60],['DB lateral raise','12-20',60],['Machine lateral raise','12-20',60]],
  rdelt:[['Reverse pec deck','12-20',60],['Face pull','12-20',60],['Cable rear delt fly','12-20',60]],
  biceps:[['Cable curl','10-15',60],['DB incline curl','10-12',60],['Preacher curl machine','10-12',60]],
  triceps:[['Triceps pushdown','10-15',60],['Overhead cable triceps extension','10-15',60]],
  forearms:[['Wrist curl','12-20',60],['Reverse curl','10-15',60]],
  lats:[['Lat pulldown','8-12',120],['Neutral-grip lat pulldown','8-12',120],['Straight-arm pulldown','12-15',90]],
  uback:[['Seated cable row','8-12',120],['Machine row','8-12',120]],
  traps:[['DB shrug','10-15',90]],lback:[['Back extension','10-15',90]],
  abs:[['Cable crunch','10-15',60],['Hanging knee raise','10-15',60]],obliques:[['Cable woodchop','12-15',60]],
  glutes:[['Smith hip thrust','8-12',150],['Cable glute pull-through','12-15',90]],
  quads:[['Leg extension','10-15',90],['Hack squat','8-12',150],['Leg press','10-15',150]],
  hams:[['Seated leg curl','10-15',90],['Lying leg curl','10-15',90]],
  calves:[['Standing calf raise','10-15',60],['Seated calf raise','12-20',60]],
  adductors:[['Hip adduction machine','12-20',60]],abductors:[['Hip abduction machine','12-20',60]]};
const planNames=()=>new Set(Object.values(PROG().days).flatMap(d=>d.ex.map(e=>e.n.toLowerCase())));
// Up to four changes worth making to the program right now. Each has an id, what it does, why, and apply(settings).
//  - a focus muscle whose PLAN gives it under 10 sets: one more set on a lift that trains it, or a new lift if none does
//    (if the plan is fine and you just missed days, that's the check-in's job, not a program change)
//  - a lift with no new best for 4+ weeks, so the 10% back-off didn't fix it: swap it for a similar move
function suggestions(){
  const out=[],prog=PROG(),plan=plannedSets(),skip=cfg().skipSug||{},wk=weekStart(today()),active=prog.order.filter(k=>prog.sched.includes(k)&&dayOf(k));
  const add=s=>{if(skip[s.id]!==wk)out.push(s)};
  for(const m of focusList()){const have=plan[m]||0;if(have>=SETS_LO)continue;
    let best=null;for(const k of active)dayOf(k).ex.forEach((e,i)=>{if(mainLiftOf(m)(e.n)&&e.s<5&&(!best||e.s<best.e.s))best={k,i,e}});
    const why=`${MUS_NAME[m]} is a focus, but your plan gives it ${r1(have)} sets a week.`;
    if(best)add({id:'set:'+m,text:`Add a set of ${best.e.n} on ${titleOf(best.k)}`,why,apply:s=>{s.program.days[best.k].ex[best.i].s++}});
    else if(MOVES[m]&&active.length){const mv=MOVES[m].find(x=>!planNames().has(x[0].toLowerCase()))||MOVES[m][0],k=active.slice().sort((a,b)=>dayOf(a).ex.length-dayOf(b).ex.length)[0];
      add({id:'add:'+m,text:`Add ${mv[0]} (3 × ${mv[1]}) to ${titleOf(k)}`,why:`${MUS_NAME[m]} is a focus, but nothing in your plan trains it directly.`,apply:s=>{s.program.days[k].ex.push({n:mv[0],s:3,r:mv[1],rest:mv[2]})}})}}
  for(const n of new Set(active.flatMap(k=>dayOf(k).ex.map(e=>e.n)))){
    const st=stallOf(liftHistory(n)),mm=musFor(n);if(!st||!mm||daysBetween(st.since,today())<28)continue;
    const alt=(MOVES[mm.p[0]]||[]).find(x=>!planNames().has(x[0].toLowerCase()));if(!alt)continue;
    add({id:'swap:'+n,text:`Swap ${n} for ${alt[0]}`,why:`No new best since ${short(st.since)}, even after backing off. A similar move often gets it going again.`,
      apply:s=>{for(const d of Object.values(s.program.days))for(const e of d.ex)if(e.n===n){e.n=alt[0];delete e.note;delete e.inc}}})}
  return out.slice(0,4);
}
function suggestCard(){
  const sg=suggestions();if(!sg.length)return '';
  return coachOpen('Suggested changes','id="sugs"')+`<div class="muted">Nothing changes until you tap Do it.</div>
    ${sg.map(s=>`<div class="sug"><b>${esc(s.text)}</b><div class="muted">${esc(s.why)}</div><div class="row" style="margin-top:6px"><button class="small primary" data-act="sugdo" data-id="${esc(s.id)}">Do it</button><button class="small" data-act="sugskip" data-id="${esc(s.id)}">Not now</button></div></div>`).join('')}</div>`;
}

// ---------- progress photos (private storage: only you can open them) ----------
const PHOTO_BUCKET='progress',POSES=[['front','Front'],['side','Side'],['back','Back']];
// Shrinks a picked image to a JPEG no bigger than `max` on its long side, so uploads are small and quick. Returns a Blob.
function shrinkImage(file,max=1280,q=0.82){
  return new Promise((res,rej)=>{const img=new Image(),url=URL.createObjectURL(file);
    img.onload=()=>{const k=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*k));c.height=Math.max(1,Math.round(img.height*k));
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);c.toBlob(b=>b?res(b):rej(new Error('convert')),'image/jpeg',q)};
    img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('read'))};img.src=url});
}
// Files are named <date>_<pose>_<time>.jpg inside a folder named after your user id. Links are signed and last an hour.
async function loadPhotos(){
  if(S.photoBusy)return;S.photoBusy=true;
  try{const st=SB.storage.from(PHOTO_BUCKET),{data,error}=await st.list(ME.user.id,{limit:300,sortBy:{column:'name',order:'asc'}});if(error)throw error;
    const items=(data||[]).map(o=>{const m=/^(\d{4}-\d\d-\d\d)_(front|side|back)_/.exec(o.name);return m&&{path:ME.user.id+'/'+o.name,date:m[1],pose:m[2]}}).filter(Boolean);
    if(items.length){const r=await st.createSignedUrls(items.map(x=>x.path),3600);if(r.error)throw r.error;(r.data||[]).forEach((u,i)=>{if(items[i])items[i].url=u.signedUrl})}
    S.photos=items;S.photoErr=false}
  catch(e){S.photos=S.photos||[];S.photoErr=true}
  S.photoBusy=false;S.photoAt=Date.now();if(S.tab==='progress')softRender();
}
async function addPhoto(file,pose){
  S.photoMsg='Uploading…';render();
  try{const blob=await shrinkImage(file),{error}=await SB.storage.from(PHOTO_BUCKET).upload(`${ME.user.id}/${today()}_${pose}_${Date.now()}.jpg`,blob,{contentType:'image/jpeg'});if(error)throw error;S.photoMsg='';S.photos=null}
  catch(e){S.photoMsg='Couldn’t upload the photo. Check your connection and try again.'}
  render();
}
async function delPhoto(path){try{const {error}=await SB.storage.from(PHOTO_BUCKET).remove([path]);if(error)throw error}catch(e){S.photoMsg='Couldn’t delete the photo. Try again.'}S.photoDel=null;S.photos=null;render()}
function photosCard(){
  if(!SB||!ME.user)return '';
  if(S.photos==null||Date.now()-(S.photoAt||0)>50*60000)loadPhotos();
  const pose=POSES.some(p=>p[0]===S.pose)?S.pose:'front',mine=(S.photos||[]).filter(p=>p.pose===pose&&p.url),first=mine[0],last=mine[mine.length-1];
  const shot=(p,label)=>`<figure><img src="${esc(p.url)}" alt="${label} ${pose} photo, ${short(p.date)}" loading="lazy"><figcaption>${label} · ${short(p.date)}</figcaption></figure>`;
  const add=label=>`<label class="btn" for="photofile">${label}</label><input type="file" id="photofile" accept="image/*" hidden>`,note=S.photoMsg?`<div class="${S.photoMsg.endsWith('…')?'muted':'err'}" style="margin-top:6px">${esc(S.photoMsg)}</div>`:'';
  if(S.photos&&!S.photos.length&&!S.photoErr)return `<div class="card"><div class="row between"><div><b>Progress photos</b><div class="muted">Private. Only you can see them.</div></div>${add('Add photo')}</div>${note}</div>`;
  let h=`<div class="card">${titled('photos','Photos','Only you can see these. Use the same spot and the same light, stand relaxed, and take them every 2 weeks.')}
    <div class="seg" style="margin-top:10px">${POSES.map(([v,l])=>`<button class="${v===pose?'on':''}" data-act="pose" data-v="${v}">${l}</button>`).join('')}</div>`;
  if(S.photos==null)h+=`<div class="muted">Loading…</div>`;
  else if(S.photoErr&&!mine.length)h+=`<div class="muted">Photos aren’t available right now.</div>`;
  else if(!mine.length)h+=`<p class="muted" style="margin:0">No ${pose} photos yet.</p>`;
  else{h+=`<div class="pcompare">${mine.length>1?shot(first,'First')+shot(last,'Latest'):shot(last,'Latest')}</div>`;
    if(mine.length>1||S.photoAll)h+=`<button class="link" data-act="photoall" style="margin-top:6px">${S.photoAll?'Hide the list':`All ${mine.length} ${pose} photos`}</button>`;
    if(S.photoAll)h+=`<ul class="list">`+mine.slice().reverse().map(p=>`<li><img class="pthumb" src="${esc(p.url)}" alt=""><div class="grow">${nice(p.date)}</div><button class="small ${S.photoDel===p.path?'qx':''}" data-act="photodel" data-p="${esc(p.path)}">${S.photoDel===p.path?'Tap again to delete':'Delete'}</button></li>`).join('')+`</ul>`}
  return h+`<div class="row" style="margin-top:10px">${add(`Add a ${pose} photo`)}</div>${note}</div>`;
}

// ---------- measurements ----------
// Tape measurements every 2 weeks, kept on the day's log next to weight. Waist is the check on fat; the rest show where size is going.
const MEAS=[['chest','Chest','around the nipple line'],['shoulders','Shoulders','around the widest point'],['arm','Arm','flexed, around the peak'],['waist','Waist','at belly button']];
const measDays=()=>Object.values(S.days).filter(d=>d&&MEAS.some(([f])=>num(d[f]))).sort((a,b)=>a.date.localeCompare(b.date));
const measDue=()=>{const ds=measDays();return !ds.length||daysBetween(ds[ds.length-1].date,today())>=14};
function measCard(){
  const ds=measDays();
  if(!ds.length)return '';
  let h=`<div class="card"><h2>Measurements</h2>`;
  if(!ds.length)return h+`<p class="muted" style="margin:0">Measure your chest, shoulders, arm and waist every 2 weeks (on the Today tab, under Body). This shows whether the weight is going where you want it.</p></div>`;
  const rows=MEAS.map(([f,l])=>{const xs=ds.filter(d=>num(d[f]));if(!xs.length)return '';const a=num(xs[0][f]),b=num(xs[xs.length-1][f]),ch=r1(b-a);
    return `<tr><td>${l}</td><td>${a}"</td><td>${b}"</td><td class="${f==='waist'?'':ch>0?'good':''}">${xs.length>1?(ch>=0?'+':'')+ch+'"':'–'}</td></tr>`}).join('');
  h+=`<table class="simple"><tr><th></th><th>${short(ds[0].date)}</th><th>${short(ds[ds.length-1].date)}</th><th>Change</th></tr>${rows}</table>`;
  const up=MEAS.filter(([f])=>f!=='waist').map(([f,l])=>{const xs=ds.filter(d=>num(d[f]));return xs.length>1?[l,num(xs[xs.length-1][f])-num(xs[0][f])]:null}).filter(x=>x&&x[1]>=0.2);
  if(up.length)h+=`<p class="good" style="margin:8px 0 0">${up.map(x=>x[0]).join(', ')} ${up.length>1?'are':'is'} growing.</p>`;
  return h+`<div class="muted" style="margin-top:6px">${measDue()?'A new measurement is due. Log it on Today under Body.':'Next measurement: '+short(addDays(ds[ds.length-1].date,14))+'.'}</div></div>`;
}

// ---------- sets per muscle ----------
// Hard sets per muscle in the 7 days up to `end`. A lift's main muscles count a full set, helpers half.
// Returns {sets:{muscle:n}, by:{muscle:{exercise:n}}} so a muscle can also show which lifts fed it.
function muscleWork(end){
  const from=addDays(end,-7),sets={},by={};
  const add=(k,name,n)=>{sets[k]=(sets[k]||0)+n;(by[k]=by[k]||{})[name]=(by[k][name]||0)+n};
  for(const w of Object.values(S.workouts)){if(!w||w.date<=from||w.date>end)continue;
    for(const e of w.ex||[]){const mm=musFor(e.n),n=setsDone(e).length;if(!mm||!n)continue;
      mm.p.forEach(k=>add(k,e.n,n));mm.s.forEach(k=>add(k,e.n,n*0.5))}}
  return {sets,by};
}
// About 10–20 fractional sets a week is the working range for a muscle you want to grow. Growth still happens from
// about 4 sets, so only focus muscles are flagged under 10; the rest are flagged only when they get almost nothing.
const SETS_LO=10,SETS_HI=20,SETS_MIN=4;
const setsNote=(v,f)=>v>SETS_HI?['warn',' · a lot']:v<(f?SETS_LO:SETS_MIN)?['warn',' · low']:v<SETS_LO?['muted','']:['good',''];
const focusList=()=>Array.isArray(cfg().focus)?cfg().focus.filter(k=>MUS_NAME[k]):[];
const mainLiftOf=k=>n=>{const mm=musFor(n);return !!mm&&mm.p.includes(k)};
function musclesCard(td){
  if(!liftNames().length)return '';
  const {sets,by}=muscleWork(td),focus=focusList(),inPlan=new Set(Object.values(PROG().days).flatMap(d=>d.ex.flatMap(e=>(musFor(e.n)||{p:[]}).p)));
  const keys=Object.keys(MUS_NAME).filter(k=>sets[k]||inPlan.has(k)||focus.includes(k));
  if(!keys.length)return '';
  keys.sort((a,b)=>focus.includes(b)-focus.includes(a)||(sets[b]||0)-(sets[a]||0));
  const lv={};for(const k of keys){const v=sets[k]||0;lv[k]=v>=SETS_LO?3:v>=SETS_LO/2?2:v>0?1:0}
  const row=k=>{const v=r1(sets[k]||0),f=focus.includes(k),g=f?strengthGain(td,mainLiftOf(k)):null;
    return `<li><button class="link star ${f?'on':''}" data-act="focus" data-k="${k}" aria-pressed="${f}" aria-label="${f?'Remove':'Make'} ${MUS_NAME[k]} a focus">${f?'★':'☆'}</button><span class="grow">${MUS_NAME[k]}${g!=null?` <span class="muted">· lifts ${g>=0?'+':''}${g}%</span>`:''}</span><span class="${setsNote(v,f)[0]}">${v} sets${setsNote(v,f)[1]}</span></li>`};
  const low=focus.filter(k=>(sets[k]||0)<SETS_LO).map(k=>MUS_NAME[k]);
  // Tap a muscle on the figure to see what trained it this week and what in your plan is meant to.
  const sel=MUS_NAME[S.mus]?S.mus:null;let detail='';
  if(sel){const did=Object.entries(by[sel]||{}).sort((x,y)=>y[1]-x[1]),plan=[...new Set(Object.values(PROG().days).flatMap(d=>d.ex.map(e=>e.n)).filter(mainLiftOf(sel)))],f=focus.includes(sel);
    detail=`<div class="banner" style="margin:8px 0"><div class="row between"><b>${MUS_NAME[sel]} · ${r1(sets[sel]||0)} sets</b><button class="small" data-act="focus" data-k="${sel}">${f?'★ Focus':'☆ Make it a focus'}</button></div>
      <div class="muted" style="margin-top:4px">${did.length?'This week: '+did.map(([n,v])=>`${esc(n)} (${r1(v)})`).join(', '):'Nothing trained it in the last 7 days.'}</div>
      <div class="muted">${plan.length?'In your plan: '+plan.map(esc).join(', '):'Nothing in your plan targets it directly.'}</div></div>`}
  return `<div class="card">${titled('sets','Sets per muscle',`Hard sets in the last 7 days. Aim for about ${SETS_LO}–${SETS_HI} a week for your focus muscles (★). They start from the goals you gave at setup, and you can tap a star to change them. Other muscles keep growing on less. Brighter means more sets. Tap a muscle to see what trained it.`)}
    <div style="text-align:center;margin:10px 0 4px">${bodySVG(lv,'mfig-xl',{tap:true,sel})}</div>${sel?detail:''}<ul class="mlist">${keys.map(row).join('')}</ul>
    ${low.length?`<p class="warn" style="margin:8px 0 0">${low.join(' and ')} ${low.length>1?'are':'is'} a focus but under ${SETS_LO} sets. Add a few sets under Plan.</p>`:''}</div>`;
}
// Best set ever for each lift, newest record first.
function recordsCard(names){
  const rows=names.map(n=>{const b=bestOf(liftHistory(n));return b&&{n,b}}).filter(Boolean).sort((x,y)=>y.b.date.localeCompare(x.b.date));
  if(!rows.length)return '';
  const wk=addDays(today(),-7),show=S.recAll?rows:rows.slice(0,6);
  return `<div class="card"><h2>Records</h2><table class="simple"><tr><th>Lift</th><th>Best set</th><th>Date</th></tr>${show.map(({n,b})=>`<tr><td>${esc(n)}</td><td>${b.top}</td><td>${short(b.date)}${b.date>wk?' <span class="tag">new</span>':''}</td></tr>`).join('')}</table>
    ${rows.length>6?`<button class="small" data-act="recall" style="margin-top:8px">${S.recAll?'Show fewer':`Show all ${rows.length}`}</button>`:''}</div>`;
}

function goalNotes(){
  const g=goalOf();
  if(isLegacy()&&g==='bulk')return '<li>Gain 0.25–0.5 lbs a week, going by your 7-day average.</li><li>Bulk to about 173 lbs, then do a 6–8 week mini-cut at about 400–500 cal under maintenance.</li><li>Long-term target is about 175 lbs at your current leanness.</li>';
  if(g==='cut')return '<li>Lose about 0.5–1% of your body weight a week, going by your 7-day average.</li><li>Keep protein high and keep lifting heavy. That’s what holds on to muscle while you lose fat.</li><li>When you reach your goal weight, add calories back slowly (about 150 a week) to find maintenance.</li>';
  if(g==='maintain')return '<li>Keep your 7-day average within about a pound of where you started.</li><li>Hit your protein and keep beating your lifts. You can still build muscle at maintenance, just slower.</li>';
  return '<li>Gain 0.25–0.5 lbs a week, going by your 7-day average.</li><li>If your waist grows faster than about 1 inch per 8 lbs gained, pull calories back a bit.</li>';
}
function genericFood(){
  const g=goalOf();
  return '<li>Get protein at every meal: eggs, Greek yogurt, chicken, beef, fish or a shake.</li><li>Add a whey shake whenever you’re behind on protein.</li>'+
    (g==='cut'?'<li>Fill up on lean protein, vegetables and fruit. Watch drinks, sauces and snacks, since those calories add up fast.</li>':
     g==='maintain'?'<li>Eat about the same amount each day. Weigh in most mornings so you can see the trend.</li>':
     '<li>Rice, potatoes, oats, bread and pasta are easy bulking carbs. Eat them around your workouts.</li>')+
    '<li>Use the quick-add list for foods you eat a lot. Edit the numbers so they match your portions.</li>';
}
function viewIntake(redo){
  const p=Object.assign({},cfg().profile||{});const dr=S.draft||{};
  const val=(id,k)=>esc(dr[id]!=null?dr[id]:(p[k]??''));
  const ta=(id,label,ph,rows=2)=>`<label class="f">${label}<textarea id="${id}" rows="${rows}" maxlength="3000" placeholder="${esc(ph)}">${esc(dr[id]??'')}</textarea></label>`;
  const sel=(id,k,opts,def='')=>{const cur=dr[id]!=null?dr[id]:(p[k]??def);return `<select id="${id}">${opts.map(([v,l])=>`<option value="${v}" ${String(cur)===String(v)?'selected':''}>${esc(l)}</option>`).join('')}</select>`};
  return `<div class="card"><h2>${redo?'Rebuild your plan':'Let’s set up your plan'}</h2>
    <p class="muted">${redo?'This replaces your workout program and daily targets. Your logged workouts, food and weigh-ins stay.':'Answer a few questions and the app builds your workout program and daily targets for Planet Fitness. You can change any of it later under Plan.'}</p>
    <div class="grid2">
      <label class="f">Sex (for the calorie math)${sel('in_sex','sex',[['','Choose'],['m','Male'],['f','Female']])}</label>
      <label class="f">Age<input id="in_age" type="number" inputmode="numeric" value="${val('in_age','age')}"></label>
      <label class="f">Height (ft)<input id="in_ft" type="number" inputmode="numeric" value="${val('in_ft','ft')}"></label>
      <label class="f">Height (in)<input id="in_inch" type="number" inputmode="numeric" value="${val('in_inch','inch')}"></label>
      <label class="f">Weight (lbs)<input id="in_wt" type="number" inputmode="decimal" value="${val('in_wt','weight')}"></label>
      <label class="f">Goal weight (optional)<input id="in_gw" type="number" inputmode="decimal" value="${val('in_gw','gw')}"></label></div>
    <div class="intake-rest">
      <label class="f">Goal${sel('in_goal','goal',[['','Choose'],...Object.entries(GOALS)])}</label>
      <label class="f">Activity outside the gym${sel('in_act','act',Object.entries(ACT).map(([k,v])=>[k,v[0]]),'low')}</label>
      <label class="f">Days a week you can lift${sel('in_days','days',[[3,'3 days'],[4,'4 days'],[5,'5 days'],[6,'6 days']],4)}</label>
      <label class="f">How long you’ve been lifting${sel('in_exp','exp',[['new','Less than a year'],['exp','A year or more']],'new')}</label></div>
    <h3 style="margin:16px 0 4px">For a custom program</h3>
    <p class="muted" style="margin:0 0 6px">${redo?'Optional. Fill these in to ask for a new custom program.':'You’ll start on a standard program right away. These answers go to the app’s admin so a program can be written just for you. Only these answers are shared, never your logs.'}</p>
    <div class="intake-rest">
      ${ta('in_routine','Your current routine','Each day: exercises, sets × reps and weight. Rough is fine, or paste from your notes.',5)}
      ${ta('in_focus','What you want to improve','For example: bigger chest and arms, lose the gut, stronger legs')}
      ${ta('in_injury','Injuries or anything that hurts','Leave blank if none')}
      ${ta('in_when','Which days you can train, and for how long','For example: Mon–Fri after work, about an hour')}
      ${ta('in_foods','Foods you eat a lot (optional)','For example: Chipotle bowl, eggs, protein shakes')}</div>
    <div class="err" id="in_err"></div>
    <div class="row wrap" style="margin-top:10px"><button class="primary" data-act="intake">${redo?'Rebuild my plan':'Build my plan'}</button>${redo?'<button data-act="redox">Cancel</button>':''}</div></div>`;
}
function submitIntake(){
  const g=id=>{const el=$('#'+id);return el?el.value:''};
  const p={sex:g('in_sex'),age:num(g('in_age')),ft:num(g('in_ft')),inch:num(g('in_inch'))||0,weight:num(g('in_wt')),gw:num(g('in_gw'))||null,goal:g('in_goal'),act:g('in_act')||'low',days:+g('in_days')||4,exp:g('in_exp')||'new'};
  const err=m=>{const e=$('#in_err');if(e)e.textContent=m};
  if(!p.sex||!p.age||!p.ft||!p.weight||!p.goal)return err('Fill in sex, age, height, weight and goal.');
  if(p.age<13||p.age>90||p.ft<4||p.ft>7||p.inch>11||p.weight<80||p.weight>450)return err('Check your age, height and weight.');
  const t=calcTargets(p),s=clone(cfg()),redo=!!S.redo;
  Object.assign(s,{profile:p,program:buildProgram(p),cal:t.cal,pro:t.pro,goal:t.goal});
  if(!redo||!s.block)s.block=today();
  if(!Array.isArray(s.presets))s.presets=clone(STARTER_PRESETS);
  if(!Array.isArray(s.foodGroups))s.foodGroups=NEW_GROUPS.slice();
  const ext={};for(const [id,k] of [['in_routine','routine'],['in_focus','focus'],['in_injury','injuries'],['in_when','when'],['in_foods','foods']]){const v=g(id).trim();if(v)ext[k]=v.slice(0,3000)}
  if(ext.focus||!redo){const f=focusFrom(ext.focus);if(f.length||!Array.isArray(s.focus))s.focus=f}
  const share=!redo||Object.keys(ext).length>0;
  if(share)s.intakePending=Object.assign({name:(ME.profile&&ME.profile.display_name)||'',sex:p.sex,age:p.age,height:`${p.ft}'${p.inch}"`,weight:p.weight,goalWeight:t.goal,goal:GOALS[p.goal],activity:ACT[p.act][0],days:p.days,experience:p.exp==='new'?'Less than a year':'A year or more',targets:`${t.cal} cal, ${t.pro} g protein`},ext);
  delete s.swaps;putSettings(s);
  if(share)sendIntake();
  S.redo=false;S.draft=null;S.wp=null;S.flash=`Your plan is ready: ${fmt(t.cal)} calories and ${t.pro} g protein a day, ${p.days} lifting days a week. Change anything under Plan.`+(share?' Your answers were sent so a custom program can be written for you.':'');
  S.tab='today';render();window.scrollTo(0,0);
}
function viewProgramEditor(){
  const P=PROG(),keys=P.order.filter(k=>P.days[k]),opts=[...keys.map(k=>[k,P.days[k].t]),['rest','Rest']];
  let h=`<div class="card"><h2>Weekly split</h2><table class="simple">${DAYNAMES.map((dn,i)=>{const cur=P.days[P.sched[i]]?P.sched[i]:'rest';return `<tr><td>${dn}</td><td><select data-sched="${i}" aria-label="${dn}">${opts.map(([v,l])=>`<option value="${esc(v)}" ${cur===v?'selected':''}>${esc(l)}</option>`).join('')}</select></td></tr>`}).join('')}</table></div>`;
  h+=`<div class="card"><h2>Your program</h2><div class="muted">Tap a day to edit it. Changes apply to new workouts. Workouts you already logged stay the same.</div>`;
  for(const k of keys){const d=P.days[k];
    h+=`<details class="pday" ${S.openDay===k?'open':''}><summary><b>${esc(d.t)}</b><span class="muted">${d.ex.length} exercise${d.ex.length===1?'':'s'}</span></summary>
      <label class="f" style="margin-top:8px">Day name<input data-pd="${esc(k)}" data-pf="t" value="${esc(d.t)}"></label>
      <ul class="list pex">${d.ex.map((e,i)=>`<li><div class="grow"><input data-pd="${esc(k)}" data-pe="${i}" data-pf="n" value="${esc(e.n)}" aria-label="Exercise name">
        <div class="pnums"><label class="f">Sets<input type="number" inputmode="numeric" data-pd="${esc(k)}" data-pe="${i}" data-pf="s" value="${esc(e.s)}"></label><label class="f">Reps<input data-pd="${esc(k)}" data-pe="${i}" data-pf="r" value="${esc(e.r)}"></label><label class="f">Rest (sec)<input type="number" inputmode="numeric" data-pd="${esc(k)}" data-pe="${i}" data-pf="rest" value="${esc(e.rest)}"></label><label class="f">Jump (lbs)<input type="number" inputmode="decimal" step="2.5" data-pd="${esc(k)}" data-pe="${i}" data-pf="inc" value="${esc(e.inc??'')}" placeholder="${jumpFor(e)}"></label></div></div>
        <div class="pbtns"><button class="small" data-act="pexmv" data-k="${esc(k)}" data-i="${i}" data-v="-1" ${i?'':'disabled'} aria-label="Move up">↑</button><button class="small" data-act="pexmv" data-k="${esc(k)}" data-i="${i}" data-v="1" ${i<d.ex.length-1?'':'disabled'} aria-label="Move down">↓</button><button class="small qx" data-act="pexdel" data-k="${esc(k)}" data-i="${i}" aria-label="Remove">✕</button></div></li>`).join('')}</ul>
      <div class="row wrap" style="margin-top:8px"><button class="small" data-act="pexadd" data-k="${esc(k)}">+ Exercise</button><button class="small" data-act="pdaydel" data-k="${esc(k)}">${S.delDay===k?'Tap again to remove this day':'Remove day'}</button></div></details>`}
  h+=`<div class="row wrap" style="margin-top:10px"><button class="small" data-act="pdayadd">+ Add a day</button><button class="small" data-act="redo">Rebuild from questions</button></div></div>`;
  return h;
}
