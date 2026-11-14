"use strict";
// Training logic: today's targets, lift history and bests, stalls, and the rest timer.
// Loaded by index.html in a fixed order (see the <script> tags there). All files share one global scope.

// ---------- today's targets (double progression) ----------
// How much to add when it's time to go up: the exercise's own "jump" if set in the program,
// otherwise 10 lbs on the Smith (a 5 on each side) and 5 lbs on everything else.
const jumpFor=ex=>num(ex.inc)>0?num(ex.inc):(/smith/i.test(ex.n)?10:5);
const repRange=ex=>{const m=String(ex.r||'').match(/(\d+)\D+(\d+)/);return m?[+m[1],+m[2]]:[8,12]};
// What to aim for today, one {w,r} per set, or null with no history.
//  - hit the top of the range on every set last time: add the jump and start again at the bottom of the range
//  - stalled: about 10% off, top of the range
//  - otherwise: same weight, one more rep on the first set that isn't at the top yet
function targetFor(last,ex,stall){
  if(!last)return null;
  const [lo,hi]=repRange(ex),n=ex.sets?ex.sets.length:ex.s;
  const base=Array.from({length:n},(_,j)=>last.sets[Math.min(j,last.sets.length-1)]);
  const top=Math.max(...last.sets.map(s=>num(s.w)||0));
  const all=last.sets.length>=ex.s&&last.sets.every(s=>num(s.r)>=hi);
  if(all)return base.map(()=>({w:top+jumpFor(ex),r:lo}));
  if(stall&&top>0)return base.map(()=>({w:Math.round(top*0.9/5)*5,r:hi}));
  let bumped=false;
  return base.map(s=>{let r=num(s.r);if(!bumped&&r<hi){r++;bumped=true}return {w:num(s.w)||0,r}});
}
const targetText=t=>{const same=t.every(x=>x.w===t[0].w);return same?`${t[0].w||'BW'} × ${t.map(x=>x.r).join(', ')}`:t.map(x=>`${x.w||'BW'}×${x.r}`).join(' · ')};
function hint(last,ex,stall){
  if(!last)return 'First time: pick a weight you can do for '+ex.r.split('-')[0]+' reps with 1–2 left in the tank.';
  const hi=+ex.r.split('-')[1];const top=Math.max(...last.sets.map(s=>num(s.w)||0));
  const all=last.sets.length>=ex.s&&last.sets.every(s=>num(s.r)>=hi);
  if(stall&&!all&&top>0)return `<span class="warn">No new best in ${stall.n} sessions (since ${short(stall.since)}). Take about 10% off (try ${Math.round(top*0.9/5)*5} lbs), hit ${hi} reps on every set, then build back up.</span>`;
  if(all)return `<span class="good">↑ You hit ${hi} reps on every set last time. Add weight (try ${top+jumpFor(ex)} lbs).</span>`;
  return `Beat last time: keep ${top} lbs and add a rep to any set.`;
}
// ---------- lift stats (shared by the workout hints, finish summary, Progress and records) ----------
const setsDone=e=>(e.sets||[]).filter(s=>s.d&&num(s.r));
// Best finished set of one exercise. Weighted sets rank by estimated 1-rep max; bodyweight-only sets rank by reps.
function bestSet(e){
  const sets=setsDone(e),wt=sets.filter(s=>num(s.w)>0);let b=null;
  for(const s of (wt.length?wt:sets)){const W=num(s.w)||0,R=num(s.r),v=W?e1rm(W,R):R;if(!b||v>b.v)b={v,bw:!W,top:`${W||'BW'}×${R}`}}
  return b;
}
// One entry per session the lift was done in, oldest first: {id,date,v,bw,top}.
// Once a lift has weighted sessions, bodyweight-only ones are left out so the numbers stay comparable.
function liftHistory(name,upTo,excludeId){
  const out=[];
  for(const [id,w] of Object.entries(S.workouts)){
    if(!w||id===excludeId||(upTo&&w.date>upTo))continue;
    let b=null;for(const e of w.ex||[])if(e.n===name){const x=bestSet(e);if(x&&(!b||x.v>b.v))b=x}
    if(b)out.push(Object.assign({id,date:w.date},b));
  }
  out.sort((a,b)=>a.date.localeCompare(b.date));
  return out.some(x=>!x.bw)?out.filter(x=>!x.bw):out;
}
const bestOf=hist=>hist.reduce((m,x)=>!m||x.v>m.v?x:m,null);
const daysBetween=(a,b)=>Math.round((parseKey(b)-parseKey(a))/864e5);
// A stall is 3+ sessions and 2+ weeks without beating the best. Returns {n,since} or null.
function stallOf(hist){
  const top=bestOf(hist);if(!top)return null;
  const after=hist.filter(x=>x.date>top.date);
  return after.length>=3&&daysBetween(top.date,after[after.length-1].date)>=14?{n:after.length,since:top.date}:null;
}
const liftNames=()=>[...new Set(Object.values(S.workouts).flatMap(w=>(w.ex||[]).filter(e=>setsDone(e).length).map(e=>e.n)))].sort();
const volumeOf=w=>(w.ex||[]).reduce((a,e)=>a+setsDone(e).reduce((x,s)=>x+(num(s.w)||0)*num(s.r),0),0);
const trained=w=>!!w&&(w.ex||[]).some(e=>setsDone(e).length);
function blockWeek(){const b=T().block;if(!b)return null;const d=Math.floor((parseKey(today())-parseKey(b))/864e5);if(d<0)return null;return (Math.floor(d/7)%8)+1}

// ---------- timer ----------
const TM={end:0,iv:null};
function startTimer(sec){TM.end=Date.now()+sec*1000;TM.buzzed=false;$('#timer').classList.add('show');$('#timer').classList.remove('over');clearInterval(TM.iv);TM.iv=setInterval(tick,250);tick()}
function tick(){const left=Math.round((TM.end-Date.now())/1000);const el=$('#tleft');
  if(left<=0){el.textContent='Rest done. Go!';$('#timer').classList.add('over');if(!TM.buzzed){TM.buzzed=true;try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch(e){}}if(left<-90)stopTimer();return}
  el.textContent=Math.floor(left/60)+':'+pad(left%60)}
function stopTimer(){clearInterval(TM.iv);$('#timer').classList.remove('show','over')}
$('#timer').addEventListener('click',e=>{const t=e.target.dataset.t;if(!t)return;if(t==='stop')return stopTimer();TM.end+= +t*1000;if(TM.end-Date.now()>0)$('#timer').classList.remove('over');tick()});
