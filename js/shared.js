"use strict";
// Shared pieces: week totals and streaks, the board, head to head, the toast, and charts.
// Loaded by index.html in a fixed order (see the <script> tags there). All files share one global scope.

// ---------- weeks and streaks (shared by Today, Progress and the board) ----------
const weekStart=k=>addDays(k,-parseKey(k).getDay());
const trainedDates=()=>new Set(Object.values(S.workouts).filter(trained).map(w=>w.date));
const plannedPerWeek=()=>PROG().sched.filter(k=>k!=='rest'&&dayOf(k)).length;
// Totals for the week starting on Sunday `ws`, up to today.
function weekStats(ws){
  const td=today(),tr=trainedDates(),t=T();let workouts=0,proteinDays=0;const steps=[],cal=[];
  for(let i=0;i<7;i++){const k=addDays(ws,i);if(k>td)break;if(tr.has(k))workouts++;const d=S.days[k];if(!d)continue;
    if((d.food||[]).length){const f=foodTotals(d);cal.push(f.c);if(f.p>=t.pro)proteinDays++}
    if(num(d.steps))steps.push(num(d.steps))}
  return {workouts,proteinDays,steps:steps.length?Math.round(avg(steps)):0,cal:cal.length?Math.round(avg(cal)):0};
}
// weeks: weeks in a row with every planned workout done (this week counts once it's complete).
// pro: days in a row hitting protein (today counts once it's hit).
function streaks(){
  const td=today(),plan=plannedPerWeek();let weeks=0,pro=0;
  if(plan)for(let i=0,ws=weekStart(td);i<52;i++,ws=addDays(ws,-7)){if(weekStats(ws).workouts>=plan)weeks++;else if(i>0)break}
  const hit=k=>{const d=S.days[k];return !!d&&foodTotals(d).p>=T().pro};
  for(let k=hit(td)?td:addDays(td,-1);hit(k);k=addDays(k,-1))pro++;
  return {weeks,pro};
}
function weekStrip(k){
  const ws=weekStart(k),td=today(),tr=trainedDates();
  return `<div class="wkstrip">`+DAYNAMES.map((n,i)=>{const x=addDays(ws,i),plan=schedOn(x)!=='rest';
    const st=tr.has(x)?'done':plan?(x<td?'miss':'plan'):'rest';
    return `<div class="wd ${st}${x===td?' now':''}" title="${n}: ${({done:'done',miss:'missed',plan:'planned',rest:'rest'})[st]}"><span>${n[0]}</span><i>${st==='done'?'✓':''}</i></div>`}).join('')+`</div>`;
}
function ring(v,t,label,unit=''){
  const C=2*Math.PI*26,pct=Math.max(0,Math.min(1,t?v/t:0));
  return `<div class="ring ${t&&v>=t?'done':''}"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" class="trk"/><circle cx="32" cy="32" r="26" class="arc" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C*(1-pct)).toFixed(1)}" transform="rotate(-90 32 32)"/></svg><b>${fmt(v)}</b><span>${label}</span><small>of ${fmt(t)}${unit}</small></div>`;
}
const STEP_GOAL=8000;
function hero(d,t){const tot=foodTotals(d);return `<div class="card" id="hero"><div class="rings">${ring(tot.c,t.cal,'Calories')}${ring(tot.p,t.pro,'Protein',' g')}${ring(num(d.steps)||0,STEP_GOAL,'Steps')}</div></div>`}

// ---------- board (weekly totals shared with everyone on the app) ----------
// Only these totals leave your private data. Turn it off under Account.
const sharing=()=>cfg().board!==false;
const myName=()=>((ME.profile&&ME.profile.display_name)||(ME.user&&ME.user.email||'').split('@')[0]||'Someone').trim().slice(0,40)||'Someone';
// Average % change in each lift's best: the 4 weeks up to `end` against the 4 weeks before.
function strengthGain(end,keep){
  const a=addDays(end,-28),b=addDays(end,-56),g=[];
  for(const n of liftNames()){if(keep&&!keep(n))continue;const h=liftHistory(n,end),now=bestOf(h.filter(x=>x.date>a)),was=bestOf(h.filter(x=>x.date>b&&x.date<=a));if(now&&was&&was.v>0)g.push((now.v/was.v-1)*100)}
  return g.length?Math.max(-100,Math.min(500,r1(avg(g)))):null;
}
function boardRow(ws){const w=weekStats(ws),end=addDays(ws,6)>today()?today():addDays(ws,6);
  const last=Object.values(S.workouts).filter(x=>trained(x)&&x.date>=ws&&x.date<=end).sort((a,b)=>b.date.localeCompare(a.date)||(b.updated||0)-(a.updated||0))[0];
  return {user_id:ME.user.id,week:ws,name:myName(),workouts:Math.min(14,w.workouts),protein_days:w.proteinDays,steps:Math.min(100000,w.steps),strength:strengthGain(end),
    planned:plannedPerWeek(),last_workout:last?last.date:null,last_title:last?String(last.title||titleOf(last.prog)).slice(0,40):null}}
async function publishBoard(){
  if(!SB||!ME.user||!S.loaded||!sharing()||needsIntake())return;
  const ws=weekStart(today()),rows=[boardRow(addDays(ws,-7)),boardRow(ws)],sig=JSON.stringify(rows);
  if(sig===S.boardSent)return;S.boardSent=sig;
  try{const {error}=await SB.from('board').upsert(rows.map(r=>Object.assign({updated_at:new Date().toISOString()},r)),{onConflict:'user_id,week'});if(error)S.boardSent=null;
    // Keep your own rows on screen in step with what was just sent, without waiting for the next reload of the board.
    else if(S.board){S.board=S.board.filter(r=>r.user_id!==ME.user.id).concat(rows);if(S.tab==='progress')softRender()}}catch(e){S.boardSent=null}
}
function queueBoard(){clearTimeout(queueBoard.t);queueBoard.t=setTimeout(publishBoard,3000)}
async function loadBoard(){
  if(S.boardBusy)return;S.boardBusy=true;
  try{await publishBoard();const {data,error}=await SB.from('board').select('user_id,week,name,workouts,protein_days,steps,strength,planned,last_workout,last_title').gte('week',addDays(weekStart(today()),-84));
    if(error)throw error;S.board=data||[];S.boardErr=null}catch(e){S.board=[];S.boardErr=true}
  S.boardBusy=false;S.boardAt=Date.now();if(S.tab==='progress'||S.tab==='today')softRender();
}
async function setSharing(on){
  const s=clone(cfg());s.board=on;putSettings(s);S.board=null;S.boardSent=null;
  if(!on){try{await SB.from('board').delete().eq('user_id',ME.user.id)}catch(e){}}
  render();
}
// Loads the board if it hasn't been loaded in the last minute. Returns the rows (null while the first load runs).
function boardRows(){if(!sharing()||!SB||!ME.user)return null;if(S.board==null||Date.now()-(S.boardAt||0)>60000)loadBoard();return S.board}
// "Sam finished Push today": friends who trained today or yesterday.
function buddyLine(){
  const td=today(),yd=addDays(td,-1),rows=(boardRows()||[]).filter(r=>r.user_id!==ME.user.id&&(r.last_workout===td||r.last_workout===yd));
  const seen=new Set(),out=[];
  for(const r of rows.sort((a,b)=>b.last_workout.localeCompare(a.last_workout))){if(seen.has(r.user_id))continue;seen.add(r.user_id);out.push(`${esc(r.name)} finished ${esc(r.last_title||'a workout')} ${r.last_workout===td?'today':'yesterday'}`)}
  return out.length?`<div class="buddy">${out.join(' · ')}</div>`:'';
}
// The shared goal: everyone finishes the workouts in their own plan that week.
function teamGoal(rows,past){
  const team=rows.filter(r=>r.planned>0);if(team.length<2)return '';
  const hit=team.every(r=>r.workouts>=r.planned),left=team.reduce((a,r)=>a+Math.max(0,r.planned-r.workouts),0);
  return `<div class="banner" style="margin:0 0 10px"><b>Team goal: everyone finishes their planned workouts</b><div>${team.map(r=>`${esc(r.name)} ${r.workouts}/${r.planned}${r.workouts>=r.planned?' ✓':''}`).join(' · ')}</div>
    <div class="${hit?'good':past?'warn':'muted'}">${hit?'Hit ✓':past?'Missed last week.':`${left} workout${left===1?'':'s'} to go.`}</div></div>`;
}
// ---------- head to head ----------
// Each week, one point per category to whoever is clearly ahead: share of planned workouts done, protein days, strength change.
// [label, score for comparing, how to show it, the score has to beat this to count]
const H2H=[['Workouts',r=>r.planned>0?Math.min(1,r.workouts/r.planned):0,r=>`${r.workouts}/${r.planned||'–'}`,0],
  ['Protein days',r=>r.protein_days,r=>String(r.protein_days),0],
  ['Strength',r=>r.strength==null?-999:+r.strength,r=>r.strength==null?'–':(r.strength>=0?'+':'')+r.strength+'%',-999]];
// Scores one week's rows: {pts:{user:points}, cats:[{label,lead}], winner}. A tie gives nobody the point or the week.
function weekScore(rows){
  const pts={};rows.forEach(r=>{pts[r.user_id]=0});
  const cats=H2H.map(([label,f,,min])=>{const vs=rows.map(r=>[r.user_id,f(r)]).sort((a,b)=>b[1]-a[1]),lead=vs.length>1&&vs[0][1]>vs[1][1]&&vs[0][1]>min?vs[0][0]:null;if(lead)pts[lead]++;return {label,lead}});
  const top=Object.entries(pts).sort((a,b)=>b[1]-a[1]);
  return {pts,cats,winner:top.length>1&&top[0][1]>top[1][1]?top[0][0]:null};
}
function h2hCard(){
  const all=boardRows();if(!all)return '';
  const ws=weekStart(today()),byWeek={},name={};
  for(const r of all.slice().sort((a,b)=>a.week.localeCompare(b.week))){(byWeek[r.week]=byWeek[r.week]||[]).push(r);name[r.user_id]=r.name}
  const now=byWeek[ws]||[];if(now.length<2)return '';
  const sc=weekScore(now),order=now.slice().sort((a,b)=>sc.pts[b.user_id]-sc.pts[a.user_id]),who=u=>u===ME.user.id?'You':esc(name[u]);
  const wins={};let ties=0,weeks=0;
  for(const [wk,rows] of Object.entries(byWeek)){if(wk>=ws||rows.length<2)continue;weeks++;const w=weekScore(rows).winner;if(w)wins[w]=(wins[w]||0)+1;else ties++}
  return `<div class="card">${titled('h2h','Head to head','One point for each line you’re clearly ahead on this week. Workouts counts the share of your own plan you’ve done, so different plans are fair. A tie gives nobody the point.')}<div class="h2h" style="margin-top:10px">${order.map(r=>`<div class="${sc.winner===r.user_id?'lead':''}"><b>${sc.pts[r.user_id]}</b><span>${who(r.user_id)}</span></div>`).join('')}</div>
    <table class="simple board"><tr><th></th>${order.map(r=>`<th>${who(r.user_id)}</th>`).join('')}</tr>${sc.cats.map((c,i)=>`<tr><td>${c.label}</td>${order.map(r=>`<td>${c.lead===r.user_id?'<b class="good">':''}${H2H[i][2](r)}${c.lead===r.user_id?'</b>':''}</td>`).join('')}</tr>`).join('')}</table>
    ${weeks?`<div class="banner" style="margin:10px 0 0"><b>Season · last ${weeks} week${weeks>1?'s':''}</b><div>${order.map(r=>`${who(r.user_id)} ${wins[r.user_id]||0}`).join(' · ')}${ties?` · ${ties} tied`:''}</div></div>`:'<div class="muted" style="margin-top:6px">The season score starts once a full week is in.</div>'}</div>`;
}
function boardCard(){
  const head=`<div class="card">${titled('board','The board','Strength is the average change in your best sets over the last 4 weeks. Only these totals and the name of your latest session are shared. You can turn sharing off under your account.')}<div style="height:10px"></div>`;
  if(!sharing())return head+`<p class="muted" style="margin:0">You’re not on the board. Turn on sharing under your account (top right) to compare weekly totals with your friends.</p></div>`;
  const pals=buddyLine();
  boardRows();
  if(S.board==null)return head+`<div class="muted">Loading…</div></div>`;
  if(S.boardErr)return head+`<div class="muted">The board isn’t available right now.</div></div>`;
  // Until a friend has logged something there's nothing to compare, so say that in one line.
  if(!S.board.some(r=>r.user_id!==ME.user.id))return `<div class="card"><b>Friends</b><div class="muted">You’re the only one here so far. Your friends show up once they log a workout.</div></div>`;
  const ws=weekStart(today()),wk=S.boardWeek==='last'?addDays(ws,-7):ws;
  const rows=S.board.filter(r=>r.week===wk).sort((a,b)=>b.workouts-a.workouts||b.protein_days-a.protein_days||b.steps-a.steps);
  const top=f=>Math.max(0,...rows.map(f)),cols=[['Workouts',r=>r.workouts,v=>v],['Protein days',r=>r.protein_days,v=>v],['Avg steps',r=>r.steps,v=>v?fmt(v):'–'],['Strength',r=>r.strength==null?-999:+r.strength,v=>v===-999?'–':(v>=0?'+':'')+v+'%']];
  const cell=([,f,show],r)=>{const v=f(r),lead=rows.length>1&&v>0&&v===top(f);return `<td>${lead?'<b class="good">':''}${show(v)}${lead?'</b>':''}</td>`};
  return head+`<div class="row" style="margin-bottom:8px"><button class="small ${wk===ws?'primary':''}" data-act="boardwk" data-v="this">This week</button><button class="small ${wk===ws?'':'primary'}" data-act="boardwk" data-v="last">Last week</button></div>
    ${pals}${teamGoal(rows,wk!==ws)}${rows.length?`<table class="simple board"><tr><th></th>${cols.map(c=>`<th>${c[0]}</th>`).join('')}</tr>${rows.map(r=>`<tr class="${r.user_id===ME.user.id?'me':''}"><td>${esc(r.name)}</td>${cols.map(c=>cell(c,r)).join('')}</tr>`).join('')}</table>`:'<p class="muted">Nobody logged anything that week.</p>'}</div>`;
}

// ---------- toast ----------
// A short message at the bottom. Pass `undo` (a function) to add an Undo button for a few seconds.
function toast(msg,undo){const el=$('#toast');if(!el)return;toast.undo=undo||null;el.innerHTML=esc(msg)+(undo?'<button type="button" id="undo">Undo</button>':'');el.classList.toggle('act',!!undo);el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>{el.classList.remove('show','act');toast.undo=null},undo?6000:2600)}
$('#toast').addEventListener('click',e=>{if(e.target.id!=='undo'||!toast.undo)return;const f=toast.undo;toast.undo=null;$('#toast').classList.remove('show','act');f();render()});
// "Removed X · Undo" helpers: each puts back the copy taken before the change.
const undoDay=(k,before,what)=>toast(`Removed ${what}`,()=>putDay(k,before));
const undoSettings=(before,what)=>toast(`Removed ${what}`,()=>putSettings(before));
const undoWorkout=(before,what)=>toast(`Removed ${what}`,()=>putWorkout(before));

// ---------- charts ----------
function chart(series,{h=150,goal=null,xl=null,yf=v=>Math.round(v)}={}){
  const all=series.flatMap(s=>s.pts);if(all.length<2)return '<p class="muted">Log a few more entries to see a chart.</p>';
  const xs=all.map(p=>p[0]),ys=all.map(p=>p[1]);if(goal!=null)ys.push(goal);
  let x0=Math.min(...xs),x1=Math.max(...xs);if(x1===x0)x1=x0+1;
  let y0=Math.min(...ys),y1=Math.max(...ys);const py=(y1-y0)*0.12||1;y0-=py;y1+=py;
  const W=320,H=h,L=36,R=8,Tp=8,B=xl?18:8;
  const X=x=>(L+(x-x0)/(x1-x0)*(W-L-R)).toFixed(1),Y=y=>(Tp+(1-(y-y0)/(y1-y0))*(H-Tp-B)).toFixed(1);
  let g='';
  for(let i=0;i<=3;i++){const v=y0+(y1-y0)*i/3;g+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${L-5}" y="${+Y(v)+4}" text-anchor="end" font-size="10" fill="var(--muted)">${yf(v)}</text>`}
  if(goal!=null)g+=`<line x1="${L}" x2="${W-R}" y1="${Y(goal)}" y2="${Y(goal)}" stroke="var(--good)" stroke-dasharray="4 3"/><text x="${W-R}" y="${+Y(goal)-3}" text-anchor="end" font-size="10" fill="var(--good)">goal ${goal}</text>`;
  for(const s of series){
    if(!s.pts.length)continue;
    if(s.dots)g+=s.pts.map(p=>`<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="2.6" fill="${s.color}" opacity=".55"/>`).join('');
    else g+=`<polyline fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round" points="${s.pts.map(p=>X(p[0])+','+Y(p[1])).join(' ')}"/>`+(s.pts.length<15?s.pts.map(p=>`<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="3" fill="${s.color}"/>`).join(''):'');
  }
  if(xl)g+=`<text x="${L}" y="${H-4}" font-size="10" fill="var(--muted)">${esc(xl[0])}</text><text x="${W-R}" y="${H-4}" text-anchor="end" font-size="10" fill="var(--muted)">${esc(xl[1])}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="chart">${g}</svg>`;
}
