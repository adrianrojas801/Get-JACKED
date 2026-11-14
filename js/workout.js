"use strict";
// The muscle figure and the Workout tab.
// Loaded by index.html in a fixed order (see the <script> tags there). All files share one global scope.

// ---------- muscle map (cosmetic) ----------
const MUS_NAME={chest:'Chest',uchest:'Upper chest',fdelt:'Front delts',sdelt:'Side delts',rdelt:'Rear delts',biceps:'Biceps',triceps:'Triceps',forearms:'Forearms',abs:'Abs',obliques:'Obliques',traps:'Traps',uback:'Upper back',lats:'Lats',lback:'Lower back',glutes:'Glutes',abductors:'Outer hips',adductors:'Inner thighs',quads:'Quads',hams:'Hamstrings',calves:'Calves'};
// First match wins, so the specific names come before the general ones. [pattern, main muscles, helping muscles]
const MUS_RULES=[
 [/leg curl|hamstring curl/,['hams'],[]],
 [/leg extension/,['quads'],[]],
 [/back extension|hyperextension/,['lback','glutes'],['hams']],
 [/adduct/,['adductors'],[]],
 [/abduct|clamshell/,['abductors'],['glutes']],
 [/leg press|squat|hack/,['quads','glutes'],['hams','adductors']],
 [/lunge|step-?up/,['quads','glutes'],['hams','adductors']],
 [/\brdl\b|romanian|deadlift|good morning/,['hams','glutes'],['lback','forearms']],
 [/hip thrust|glute/,['glutes'],['hams']],
 [/calf/,['calves'],[]],
 [/oblique|twist|woodchop|side bend|pallof/,['obliques'],['abs']],
 [/plank|ab wheel|rollout/,['abs'],['obliques']],
 [/crunch|\babs?\b|leg raise|knee raise|sit-?up/,['abs'],['obliques']],
 [/farmer|carry/,['forearms','traps'],['abs']],
 [/shrug/,['traps'],[]],
 [/upright row/,['sdelt','traps'],['biceps']],
 [/rear delt|reverse pec|face pull/,['rdelt'],['uback','traps']],
 [/lateral raise|side raise/,['sdelt'],[]],
 [/front raise/,['fdelt'],[]],
 [/shoulder press|overhead press|military|arnold/,['fdelt','sdelt'],['triceps']],
 [/pullover/,['lats'],['chest','triceps']],
 [/pull-?up|chin-?up|pulldown/,['lats'],['biceps','uback','forearms']],
 [/bent-?over row/,['uback','lats'],['rdelt','biceps','lback']],
 [/row/,['uback','lats'],['rdelt','biceps']],
 [/close-?grip.*(bench|press)/,['triceps'],['chest','fdelt']],
 [/incline.*(press|bench)/,['uchest'],['fdelt','triceps']],
 [/low-to-high/,['uchest'],['chest','fdelt']],
 [/fly|pec deck/,['chest'],['uchest','fdelt']],
 [/\bdips?\b/,['chest','triceps'],['fdelt']],
 [/bench|chest press|push-?up/,['chest'],['uchest','fdelt','triceps']],
 [/pushdown|tricep|skull|kickback/,['triceps'],[]],
 [/reverse curl|wrist/,['forearms'],['biceps']],
 [/hammer/,['biceps','forearms'],[]],
 [/curl/,['biceps'],['forearms']]
];
function musFor(name){const n=String(name||'').toLowerCase();for(const [re,p,s] of MUS_RULES)if(re.test(n))return {p,s};return null}
// Front and back figure. lv: {muscle: 0..3} sets how strongly each muscle is lit.
// Each half is drawn once (x 0–50) and mirrored. opts.tap makes muscles tappable (data-mus); opts.sel outlines one.
function bodySVG(lv,cls,opts={}){
  const f=k=>{const v=lv[k]||0;return v>=3?'var(--hot)':v===2?'var(--hot2)':v===1?'var(--hot1)':'var(--mus)'};
  const P=(k,d)=>`<path d="${d}" fill="${f(k)}"${opts.tap?` data-mus="${k}"`:''}${opts.sel===k?' class="msel"':''}/>`;
  const side=g=>`<g>${g}</g><g transform="matrix(-1 0 0 1 100 0)">${g}</g>`;
  const outline='M50 27 L46 27 Q40 29.5 33 31 Q24.5 32.5 22 40 Q20.5 46 20 53 Q18.5 60 18.3 66 Q15.2 73 15 80 L14.4 91 Q12.2 95 12.4 100 Q12.6 106 15 108 Q18 108.5 18.8 105 Q19.8 99 19.6 92.5 Q22.5 84 24 76 Q25.5 70 25.4 66 Q27.5 60 28.6 53 Q29.8 58 30.6 64 Q32.4 74 33.2 82 Q32 89 31.4 96 Q29.4 104 29.4 113 Q29.2 128 31 137 Q32.2 142 33 147 Q30.8 158 32.2 168 Q33.6 177 35.6 184 Q33.4 189 33.4 191.5 Q33.6 194 36 194 L43.6 194 Q45.4 193.5 45 190.5 Q44.2 187 43.6 184 Q45.6 172 45.6 162 Q45.4 153 45.6 147 Q47.2 132 48.4 118 Q49.2 110 50 104 Z';
  const base=`<ellipse cx="50" cy="13" rx="7.4" ry="9.2"/><path d="M45.6 19 L45.2 28 L54.8 28 L54.4 19 Z"/>`+side(`<path d="${outline}"/>`);
  const arms=P('sdelt','M28.5 32.2 Q22.8 34 22 41 Q21.8 46 23.4 50 Q23 42.5 26.8 36.5 Z')
    +P('forearms','M22.6 70 Q17.6 73.5 16.2 82 L15.6 90.6 L19 91 Q22.4 82 24.4 71.4 Z');
  const front=side(arms
    +P('traps','M45.4 23.5 Q41 28.5 35 30.6 L45.4 30.6 Z')
    +P('fdelt','M33 32.4 Q27 33 24.4 38.6 Q23.6 44.6 25.4 49 Q28.6 45.6 32.6 40.4 Z')
    +P('uchest','M49.5 33 L40.4 32.4 Q35.2 33.4 33.4 38 L33.8 41 Q41 38.6 49.5 39.6 Z')
    +P('chest','M49.5 40.6 Q41 39.6 33.8 42 Q31.4 48 33.8 52.6 Q41 56.6 49.5 54 Z')
    +P('biceps','M26 50.4 Q21.6 54.4 20.8 61 Q21 66 22.6 68.4 Q26 64 27 58 Q27.6 53.4 26 50.4 Z')
    +P('obliques','M34.2 54.6 Q32.8 64 34.2 76 Q36.2 86 42.4 92.4 L42.4 58.4 Q38.4 56.4 34.2 54.6 Z')
    +P('abs','M43.6 56.6 h5.9 v6.6 h-5.9 Z')+P('abs','M43.6 64.6 h5.9 v6.8 h-5.9 Z')+P('abs','M43.6 72.8 h5.9 v7.2 h-5.9 Z')+P('abs','M43.6 81.4 L49.5 81.4 L49.5 98 Q46 96 44.4 89.6 Z')
    +P('quads','M32.2 104 Q30 118 31.6 134 Q33.6 143 36.6 146.4 Q36.2 126 38.2 105 Z')
    +P('quads','M39.2 104.4 Q37.2 124 39.6 145.8 L43.2 145.8 Q44.8 124 44 104.4 Z')
    +P('quads','M44.6 126.6 Q47.2 134 46.2 144.6 Q44.4 147 44.2 142.4 Q43.8 134 44.6 126.6 Z')
    +P('adductors','M45.2 104.6 L49.2 106 L48.2 124.6 Q46.2 120.6 45.2 114 Z')
    +P('calves','M34.6 152 Q33 164 35.6 178 L37.8 178 Q38.8 164 37.6 152 Z')
    +P('calves','M40.2 150.6 Q44.6 158 44.6 170 L42.6 176 Q40 164 40.2 150.6 Z'));
  const back=side(arms
    +P('traps','M50 21.6 L45.4 27 Q39 30 33.6 32 Q40 36 44.6 43 L50 60 Z')
    +P('rdelt','M33 33 Q26.4 33.4 23.8 39 Q23.2 45 25.6 49 Q28 42.4 32.6 38.4 Z')
    +P('uback','M44 44 Q38 39.4 33.2 39.4 Q30.8 44 32.6 49 Q39 51.6 46 51 Z')
    +P('lats','M32.6 50.6 Q30.8 58 32.2 66 Q35.6 77 42.6 83 L45.8 72 Q44.8 60 46.4 52.6 Q39 53 32.6 50.6 Z')
    +P('lback','M46.6 62 L49.5 62 L49.5 91.6 L45.4 91.6 Q44.6 78 46.6 62 Z')
    +P('triceps','M26 49.4 Q21.6 53.4 20.8 60 Q21.2 66 23 69 Q26.6 63 27.6 56 Q27.6 51.4 26 49.4 Z')
    +P('abductors','M33.6 84.6 Q31.6 90 32.4 96.4 Q38 92.6 44.6 92.2 Q43 87 43.6 84 Q38 85.6 33.6 84.6 Z')
    +P('glutes','M32.4 98 Q31.4 106 34.4 112.6 Q42 116.6 49.5 112.6 L49.5 93.4 Q40 93 32.4 98 Z')
    +P('hams','M33.6 115 Q32 129 35 144 L39.8 146 Q38.8 130 40 116 Z')
    +P('hams','M41 116 Q40 130 41 146 L45.4 146 Q47.6 130 48 115.6 Z')
    +P('calves','M35 151 Q32.8 160 35.6 171 Q38.8 173.6 40 167 Q40.2 157 39.2 151 Z')
    +P('calves','M40.8 151 Q40.6 158 41.6 168 Q44.4 170.6 45.2 164 Q46 156 44.6 151 Z'));
  const fig=g=>`<g fill="var(--body)">${base}</g><g stroke="var(--card)" stroke-width=".7" stroke-linejoin="round">${g}</g>`;
  return `<svg class="${cls}" viewBox="10 2 180 194" aria-hidden="true">${fig(front)}<g transform="translate(100 0)">${fig(back)}</g></svg>`;
}
function exFig(name){const mm=musFor(name);if(!mm)return '';const lv={};mm.s.forEach(k=>lv[k]=1);mm.p.forEach(k=>lv[k]=3);return bodySVG(lv,'mfig')}
function sessionFig(w){
  const sc={},pc={};
  for(const e of w.ex){const mm=musFor(e.n);if(!mm)continue;const n=e.sets.length;mm.p.forEach(k=>{sc[k]=(sc[k]||0)+n;pc[k]=(pc[k]||0)+n});mm.s.forEach(k=>{sc[k]=(sc[k]||0)+n*.5})}
  const mx=Math.max(0,...Object.values(sc));if(!mx)return '';
  const lv={};for(const k in sc){const r=sc[k]/mx;lv[k]=r>=.6?3:r>=.3?2:1}
  const top=Object.entries(pc).sort((a,b)=>b[1]-a[1]);
  return `<div class="card mcard">${bodySVG(lv,'mfig-lg')}<div class="grow"><h3 style="margin:0 0 6px">Muscles today</h3><ul class="mlist">${top.map(([k,n])=>`<li><span>${MUS_NAME[k]}</span><span class="muted">${n} sets</span></li>`).join('')}</ul><div class="muted mleg"><i style="background:var(--hot)"></i>main <i style="background:var(--hot1)"></i>helping</div></div></div>`;
}

function viewWorkout(){
  if(!S.wp)S.wp=schedOn(S.wd);
  const P=PROG(),lbl=k=>{const dn=P.sched.map((x,i)=>x===k?DAYNAMES[i]:null).filter(Boolean);return P.days[k].t+(dn.length?` (${dn.join(', ')})`:'')};
  const opts=[...P.order.filter(k=>P.days[k]).map(k=>[k,lbl(k)]),['rest','Rest day']];
  if(S.wp!=='rest'&&!P.days[S.wp]){const lw=S.workouts[wid(S.wd,S.wp)];if(lw)opts.unshift([S.wp,lw.title||'Logged workout']);else S.wp='rest'}
  let h=`<div class="card"><div class="grid2 wsel"><label class="f">Date<input type="date" id="wdate" value="${S.wd}" max="${today()}"></label>
    <label class="f">Session<select id="wprog">${opts.map(([v,l])=>`<option value="${v}" ${S.wp===v?'selected':''}>${l}</option>`).join('')}</select></label></div></div>`;
  const bw=blockWeek();
  if(bw)h+=`<div class="muted" style="margin:0 4px">Block week ${bw} of 8</div>`;
  if(S.wp==='rest')return h+`<div class="card"><h2>Rest day</h2><p>Recovery is when you grow. Get a walk in or hit 8–10k steps, eat your protein, and sleep 7.5+ hours.</p><p class="muted">Want to train anyway? Pick a session above.</p></div>`;
  const w=curWorkout(),id=wid(w.date,w.prog);
  const doneSets=w.ex.reduce((a,e)=>a+e.sets.filter(s=>s.d).length,0),allSets=w.ex.reduce((a,e)=>a+e.sets.length,0);
  h+=`<div class="row between" style="margin:8px 4px"><div><b>${esc(w.title)}</b><div class="muted">${doneSets}/${allSets} sets${w.done?' · finished ✓':''}</div></div>${S.reorder?'':'<button class="small" data-act="reorder"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4v16M8 4 4.5 7.5M8 4l3.5 3.5M16 20V4M16 20l-3.5-3.5M16 20l3.5-3.5"/></svg>Reorder</button>'}</div>`;
  if(S.reorder){
    h+=`<div class="card"><div class="row between"><h2 style="margin:0">Drag ⠿ to match your order</h2><button class="small primary" data-act="reorder">Done</button></div>
      <ul class="list" id="rlist" style="margin-top:6px">${w.ex.map((e,i)=>{const d=e.sets.filter(x=>x.d).length;return `<li class="ritem" data-ri="${i}"><span class="handle" aria-label="drag">⠿</span><div class="grow">${esc(e.n)}<div class="muted">${d}/${e.sets.length} sets</div></div><button class="small" data-act="mv" data-i="${i}" data-v="-1" ${i===0?'disabled':''}>↑</button><button class="small" data-act="mv" data-i="${i}" data-v="1" ${i===w.ex.length-1?'disabled':''}>↓</button></li>`}).join('')}</ul>
      <div class="muted" style="margin-top:6px">Only changes today’s workout. Next week starts in the planned order again.</div></div>`;
    return h;
  }
  h+=`<div style="margin:0 4px">${bar(doneSets,allSets||1)}</div>`;
  h+=sessionFig(w);
  if(w.done)h+=summary(w,id);
  // One exercise is open at a time; the rest fold to a line. It follows you: the first one with sets left, unless you tap another.
  const open=S.exOpen!=null&&w.ex[S.exOpen]?S.exOpen:w.ex.findIndex(setsLeft);
  w.ex.forEach((e,i)=>{h+=exCard(w,id,i,i===open)});
  if(S.addEx)h+=`<div class="card"><div class="row between" style="margin-bottom:10px"><h2 style="margin:0">Add exercise</h2><button class="small" data-act="axclose">Cancel</button></div><div class="grid3"><input id="axn" placeholder="Name" style="grid-column:1/4"><input id="axs" type="number" inputmode="numeric" value="3" placeholder="sets"><input id="axr" value="8-12" placeholder="reps (8-12)"><button class="primary" data-act="axadd">Add</button></div></div>`;
  else h+=`<button data-act="axopen" style="width:100%;margin:4px 0">+ Add exercise</button>`;
  h+=`<div class="card"><label class="f">Session notes<textarea data-wnote="1" placeholder="How it felt, what to change…">${esc(w.note||'')}</textarea></label></div>`;
  h+=`<button class="primary" data-act="finish" style="width:100%;padding:12px">${w.done?'Update finished workout':'Finish workout'}</button>`;
  return h;
}
const setsLeft=e=>e.sets.some(s=>!s.d);
const targetOf=(w,id,e)=>{const last=lastFor(e.n,w.date,id),stall=stallOf(liftHistory(e.n,w.date,id));return {last,stall,tg:targetFor(last,withJump(e,w.prog),stall)}};
// What a blank set gets logged as: today's target, or the weight you used on the set before if you changed it.
function setDefault(w,i,j){
  const ex=w.ex[i],t=(targetOf(w,wid(w.date,w.prog),ex).tg||[])[j],prev=j>0?ex.sets[j-1]:null,pw=prev&&prev.d&&num(prev.w)!=null?num(prev.w):null;
  return {w:pw!=null?pw:(t&&t.w?t.w:''),r:t?t.r:(prev&&prev.d?num(prev.r):'')};
}
// Which exercise to open after finishing a set: the superset partner, else stay until it's done, else the next one with sets left.
function nextOpen(w,i){
  const ex=w.ex[i],n=w.ex.length;
  if(ex.ss)for(let k=1;k<n;k++){const j=(i+k)%n;if(w.ex[j].ss===ex.ss&&setsLeft(w.ex[j]))return j}
  if(setsLeft(ex))return i;
  const after=w.ex.findIndex((e,k)=>k>i&&setsLeft(e));return after>=0?after:w.ex.findIndex(setsLeft);
}
function exCard(w,id,i,open){
  const e=w.ex[i],{last,stall,tg}=targetOf(w,id,e),done=e.sets.filter(s=>s.d).length,tag=e.ss?`<span class="tag">${esc(e.ss)}${w.ex.filter((x,j)=>x.ss===e.ss&&j<=i).length}</span>`:'';
  if(!open)return `<button class="card exrow ${done===e.sets.length?'exdone':''}" data-act="exopen" data-i="${i}"><span class="grow"><b>${tag}${esc(e.n)}</b><span class="muted">${done===e.sets.length?setsDone(e).map(s=>`${num(s.w)||'BW'}×${s.r}`).join(' · '):tg?'Today: '+targetText(tg):`${e.sets.length} × ${esc(e.r)}`}</span></span><span class="excount">${done}/${e.sets.length}${done===e.sets.length?' ✓':''}</span></button>`;
  const now=e.sets.findIndex(s=>!s.d),inp=(j,f,s,cls='')=>{const t=tg&&tg[j];return `<input class="${cls}" type="number" inputmode="${f==='w'?'decimal':'numeric'}" ${f==='w'?'step="2.5"':''} data-w="${i}" data-s="${j}" data-f="${f}" value="${s[f]}" placeholder="${f==='w'?(t?(t.w||'BW'):'lbs'):(t?t.r:'reps')}" aria-label="Set ${j+1} ${f==='w'?'weight':'reps'}">`};
  const stepper=(j,f,s,unit,by)=>`<div class="stp"><button data-act="step" data-i="${i}" data-j="${j}" data-f="${f}" data-v="-${by}" aria-label="${by} less">−</button><label>${inp(j,f,s)}<span>${unit}</span></label><button data-act="step" data-i="${i}" data-j="${j}" data-f="${f}" data-v="${by}" aria-label="${by} more">+</button></div>`;
  let h=`<div class="card exopen ${done===e.sets.length?'exdone':''}"><div class="row between"><div class="grow"><b>${tag}${esc(e.n)}</b><div class="muted">${e.sets.length} × ${esc(e.r)} · rest ${Math.floor(e.rest/60)}:${pad(e.rest%60)}</div></div>${exFig(e.n)}<button class="small" data-act="swap" data-i="${i}">Swap</button></div>`;
  {const te=e.ti!=null&&dayOf(w.prog)&&dayOf(w.prog).ex[e.ti];const nt=(te&&te.n===e.n)?(te.note||''):e.note;if(nt)h+=`<div class="muted" style="margin-top:4px">${esc(nt)}</div>`}
  if(S.swap===i)h+=`<div class="banner"><label class="f">Replace with<input id="swapname" value="${esc(e.n)}"></label><div class="row wrap" style="margin-top:8px"><button class="small" data-act="swapone" data-i="${i}">Today only</button>${e.ti!=null?`<button class="small primary" data-act="swapall" data-i="${i}">Always</button>`:''}<button class="small" data-act="exdel" data-i="${i}">Remove exercise</button><button class="small link" data-act="swapx">Cancel</button></div></div>`;
  h+=`<div class="muted" style="margin-top:6px">${last?`Last (${short(last.date)}): `+last.sets.map(s=>`${num(s.w)??'BW'}×${s.r}`).join(' · '):'No history yet.'}</div><div class="hint">${hint(last,withJump(e,w.prog),stall)}</div>${tg?`<div class="target">Today: <b>${targetText(tg)}</b></div>`:''}<div class="setlist">`;
  e.sets.forEach((s,j)=>{
    // The set you're on gets big − / + controls and a wide Done button. The others stay as compact rows you can still edit.
    if(j===now)h+=`<div class="setnow"><div class="setlabel">Set ${j+1} of ${e.sets.length}</div><div class="stps">${stepper(j,'w',s,'lbs',5)}${stepper(j,'r',s,'reps',1)}</div><button class="primary big" data-act="setdone" data-i="${i}" data-j="${j}">Done</button></div>`;
    else h+=`<div class="setrow ${s.d?'isdone':''}"><span>${j+1}</span>${inp(j,'w',s)}${inp(j,'r',s)}<button data-act="setdone" data-i="${i}" data-j="${j}">${s.d?'✓':'Done'}</button></div>`});
  return h+`</div><div class="row" style="margin-top:8px"><button class="small" data-act="setadd" data-i="${i}">+ Set</button><button class="small" data-act="setdel" data-i="${i}">− Set</button><button class="small" data-act="rest" data-v="${e.rest}">Rest timer</button></div></div>`;
}
// True when this exercise entry beats every earlier session of the same lift (same kind: weighted or bodyweight).
function isBest(b,name,date,id){const prev=bestOf(liftHistory(name,date,id).filter(x=>x.bw===b.bw));return !!prev&&b.v>prev.v+0.01}
function summary(w,id){
  const vol=volumeOf(w),prs=[];
  for(const e of w.ex){const b=bestSet(e);if(b&&isBest(b,e.n,w.date,id))prs.push(`${e.n} ${b.top}`)}
  const prev=Object.entries(S.workouts).filter(([oid,o])=>oid!==id&&o.prog===w.prog&&o.date<w.date&&trained(o)).sort((a,b)=>b[1].date.localeCompare(a[1].date))[0];
  const pv=prev?volumeOf(prev[1]):0,dv=pv?Math.round((vol/pv-1)*100):null;
  const mins=w.t0&&w.t1&&w.t1>w.t0?Math.round((w.t1-w.t0)/6e4):null;
  return `<div class="banner"><b>Workout finished ✓</b><div>Total volume: ${fmt(vol)} lbs${dv!=null?` (${dv>=0?'+':''}${dv}% vs ${short(prev[1].date)})`:''}${mins&&mins<300?` · ${mins} min`:''}</div>${prs.length?`<div class="good">New bests: ${prs.map(esc).join(', ')}</div>`:''}</div>`;
}

function weightSeries(){
  const end=today(),start=addDays(end,-89),dots=[],avgp=[];
  for(let i=0;i<90;i++){const k=addDays(start,i),w=num(S.days[k]&&S.days[k].weight);if(w)dots.push([i,w]);
    const win=[];for(let j=0;j<7;j++){const v=num(S.days[addDays(k,-j)]&&S.days[addDays(k,-j)].weight);if(v)win.push(v)}if(win.length>=3&&w)avgp.push([i,avg(win)])}
  return {dots,avgp,start,end};
}
function win(endKey,n,f){const out=[];for(let i=0;i<n;i++){const d=S.days[addDays(endKey,-i)];if(!d)continue;const v=f(d);if(v!=null&&!isNaN(v))out.push(v)}return out}
// Calories added to (or taken off) maintenance for each goal. Used by the intake and when switching phase.
const GOAL_ADJ={bulk:250,cut:-400,maintain:0};
// The 7-day average up to `end` against the 7 days before it, and what that means for the current goal.
// Returns {A,B,ch,ok,text,adj}: adj is the calorie change to suggest (+150, −150 or 0).
function weightTrend(end){
  const wv=d=>num(d.weight),a=win(end,7,wv),b=win(addDays(end,-7),7,wv),A=avg(a),B=avg(b),g=goalOf();
  const o={A,B,ch:null,ok:null,adj:0,text:'Weigh in at least 3 mornings a week (after the bathroom, before eating) to see your trend.'};
  if(a.length<3||b.length<3)return o;
  const ch=o.ch=A-B,say=(ok,text,adj=0)=>Object.assign(o,{ok,text,adj});
  if(g==='cut'){const loss=-ch,lo=A*0.005,hi=A*0.01;
    if(loss<lo*0.6)return say(false,`${ch>0?'Gaining':'Losing'} ${r1(Math.abs(ch))} lbs/wk. The target is ${r1(lo)}–${r1(hi)} lbs/wk. Eat about 150 cal less a day.`,-150);
    if(loss>hi*1.25)return say(false,`Losing ${r1(loss)} lbs/wk. That’s too fast, so you’ll lose more muscle. Eat about 150 cal more a day.`,150);
    return say(true,`Losing ${r1(loss)} lbs/wk. You’re on track.`)}
  if(g==='maintain'){
    if(ch>0.3)return say(false,`Up ${r1(ch)} lbs this week. Eat about 150 cal less a day if it keeps climbing.`,-150);
    if(ch<-0.3)return say(false,`Down ${r1(-ch)} lbs this week. Eat about 150 cal more a day if it keeps dropping.`,150);
    return say(true,`Weight is steady (${ch>=0?'+':''}${r1(ch)} lbs). You’re on track.`)}
  if(ch<0.15)return say(false,`Gaining ${r1(ch)} lbs/wk. That’s below the 0.25–0.5 target. Add about 150 cal a day.`,150);
  if(ch>0.6)return say(false,`Gaining ${r1(ch)} lbs/wk. That’s too fast, so more of it will be fat. Cut about 150 cal a day.`,-150);
  return say(true,`Gaining ${r1(ch)} lbs/wk. You’re on track.`);
}
const trendText=tr=>tr.ok==null?tr.text:`<span class="${tr.ok?'good':'warn'}">${tr.text}</span>`;
// One calorie change a week is enough: after you take it, the button turns into a note until next Sunday.
function calButton(adj){
  if(!adj)return '';
  if(cfg().calAdj===weekStart(today()))return '<div class="muted">Calorie target changed this week ✓ Give it a week before changing it again.</div>';
  return `<button class="small" data-act="adjcal" data-v="${adj}">${adj>0?'Raise':'Lower'} target to ${fmt(T().cal+adj)}</button>`;
}
