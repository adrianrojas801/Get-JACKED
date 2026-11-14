"use strict";
// Programs: the owner's original program, per-person programs, and the intake math that builds a new one.
// Loaded by index.html in a fixed order (see the <script> tags there). All files share one global scope.

// ---------- Pablo's original program ----------
// Only used once, to move his existing setup into his own settings (see ensureProgram).
// Everyone else gets a program built from their intake answers (buildProgram).
const LEGACY_PROGRAM={
 push:{t:'Push (chest priority)',ex:[
  {n:'Incline Smith press',s:4,r:'6-10',rest:150,note:'Bench on notch 4. Warm up 25s × 10 first (don’t log it). Log total: 55s a side = 135. When all 4 sets hit 10, go to 145.'},
  {n:'Seated DB shoulder press',s:3,r:'6-10',rest:150,note:'Bench on notch 7. Warm up with 30s first (don’t log it). Log per dumbbell.'},
  {n:'Chest press machine',s:3,r:'8-12',rest:120,note:'Pick one weight and stay on it until you hit 12 on every set.'},
  {n:'Dips',s:3,r:'10-15',rest:90,note:'Lean forward a bit for chest. Leave weight blank for bodyweight. Once you hit 15 on all 3 sets, hold a dumbbell between your feet.'},
  {n:'DB lateral raise',s:4,r:'12-20',rest:90,note:'Burnout: after the last set, grab 10–15s and go to failure.'},
  {n:'Low-to-high cable fly',s:3,r:'12-15',rest:90,note:'Upper chest. Last set to failure, drop set optional.'},
  {n:'Triceps pushdown',s:2,r:'8-12',rest:90,note:'Triangle handle. Only 2 sets, since dips already hit triceps.'},
  {n:'Overhead cable triceps extension',s:3,r:'10-15',rest:90,note:'Rope or W bar.'}]},
 pull:{t:'Pull',ex:[
  {n:'Pull-up',s:3,r:'6-10',rest:150,note:'Overhand, shoulder width, slow with a full stretch. Leave weight blank for bodyweight. Once you hit 10 on all 3 sets, hold a dumbbell between your feet.'},
  {n:'Smith bent-over row',s:3,r:'8-10',rest:150,note:'Warm up 35s × 10 first (don’t log it). Log total: 45s a side = 115.'},
  {n:'Lat pulldown',s:3,r:'6-10',rest:120,note:'Once you hit 10 on all 3 sets, go up a plate.'},
  {n:'Single-arm seated row',s:3,r:'10-12',rest:90,note:'Log weight per arm.'},
  {n:'Face pull',s:3,r:'12-20',rest:90,note:'Rear delts. Moved here from Sunday.'},
  {n:'Standing DB curl',s:3,r:'7-10',rest:90,note:'Alternating arms. Warm up with 30s first (don’t log it). Log per dumbbell.'},
  {n:'Bayesian cable curl',s:3,r:'10-12',rest:90,note:'Log weight per arm.'},
  {n:'Cable hammer curl',s:2,r:'10-12',rest:30,ss:'A',note:'Superset with the next exercise. Log weight per arm.'},
  {n:'W-bar reverse curl',s:2,r:'8-10',rest:90,ss:'A',note:'Overhand grip. Drop set on the last set is fine.'}]},
 legs:{t:'Legs',ex:[
  {n:'Smith squat',s:3,r:'6-10',rest:180,note:'Do a warm-up set first (don’t log it). Log total: 70s a side = 165. Smith taken? Tap Swap → Hack squat → Today only.'},
  {n:'Smith RDL',s:3,r:'8-10',rest:150,note:'Replaces hip thrusts: hits hamstrings and glutes. Start light (45s a side = 115) and feel the stretch. Smith taken? Use dumbbells.'},
  {n:'Leg extension',s:3,r:'10-15',rest:90,note:'Pick one weight (around 180) instead of going up each set.'},
  {n:'Leg curl',s:3,r:'8-12',rest:90},
  {n:'Calf raise',s:4,r:'12-20',rest:90,note:'Smith, toes on a plate. Pause at the bottom stretch.'},
  {n:'Cable crunch',s:3,r:'10-15',rest:90}]},
 upper:{t:'Chest + back',ex:[
  {n:'Smith bench press',s:3,r:'5-8',rest:90,ss:'A',note:'Warm up 25s × 10, then 70s × 3–5 (don’t log those). Log total: two 45s a side = 205. Alternate with pull-ups. Goal: 225×8.'},
  {n:'Pull-up',s:3,r:'6-10',rest:90,ss:'A',note:'Leave weight blank for bodyweight.'},
  {n:'Incline Smith press',s:3,r:'6-10',rest:90,ss:'B',note:'Bench on notch 4. 55s a side = 135. Alternate with seated rows.'},
  {n:'Seated cable row',s:3,r:'8-10',rest:90,ss:'B'},
  {n:'Pec deck',s:3,r:'8-12',rest:90,ss:'C',note:'Chest fly machine. Drop set on the last set is fine.'},
  {n:'Reverse pec deck',s:3,r:'10-15',rest:90,ss:'C',note:'Rear delts, same machine. Started around 90 then 100.'},
  {n:'Cable lateral raise',s:3,r:'12-20',rest:90,note:'Side delts. Don’t skip these.'},
  {n:'Single-arm cable row',s:2,r:'10-12',rest:90,note:'Optional, only if you have energy left. Or the high-to-low row. Log weight per arm.'}]},
 arms:{t:'Arms + shoulders',ex:[
  {n:'Single-arm cable lateral raise',s:4,r:'12-20',rest:90,note:'First, while you’re fresh: side delts are the priority. Log weight per arm. Last set to failure.'},
  {n:'Smith shoulder press',s:3,r:'6-10',rest:150,note:'Warm up with 25s a side (don’t log it), then do your working sets with 35s a side. Log total: 35s a side = 95. Once you hit 10 on all 3 sets, add a 5 each side.'},
  {n:'Single-arm cable rear delt fly',s:2,r:'10-15',rest:90,note:'Log weight per arm.'},
  {n:'Cable W-bar curl',s:3,r:'8-12',rest:45,ss:'A',note:'Superset with the next exercise.'},
  {n:'Triceps pushdown',s:3,r:'8-12',rest:90,ss:'A',note:'Triangle handle.'},
  {n:'Incline DB curl',s:3,r:'8-10',rest:45,ss:'B',note:'Bench on notch 5, arms hanging behind you. Log per dumbbell. Superset with the next exercise.'},
  {n:'Overhead cable triceps extension',s:3,r:'10-15',rest:90,ss:'B',note:'Rope or W bar.'},
  {n:'DB hammer curl',s:2,r:'8-12',rest:90,note:'Drop set on the last set is fine. Covers forearms.'}]}
};
const LEGACY_SCHED=['push','pull','legs','rest','upper','arms','rest']; // Sun..Sat
const DAYNAMES=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DEFAULT_PRESETS=[
 {g:'Breakfast & shakes',n:'Eggs (3)',c:215,p:19},
 {g:'Breakfast & shakes',n:'Greek yogurt (1 cup)',c:140,p:23},
 {g:'Breakfast & shakes',n:'Whey shake (1 scoop)',c:120,p:25},
 {g:'Breakfast & shakes',n:'Milk (1 cup, 2%)',c:120,p:8},
 {g:'Work orders',n:'Sweetgreen + double chicken',c:750,p:55},
 {g:'Work orders',n:'Cava bowl + double protein',c:850,p:60},
 {g:'Work orders',n:'CFA 12ct grilled nuggets',c:200,p:38},
 {g:'Work orders',n:'CFA grilled chicken sandwich',c:390,p:28},
 {g:'Work orders',n:'CFA spicy deluxe',c:550,p:30},
 {g:'Work orders',n:'CFA waffle fries (med)',c:420,p:5},
 {g:'Work orders',n:"Portillo's Italian beef",c:600,p:35},
 {g:'Work orders',n:"Portillo's chopped salad + chicken",c:800,p:40},
 {g:'Work orders',n:'Jamba smoothie (med)',c:350,p:8},
 {g:'Work orders',n:'Jamba + protein boost',c:420,p:22},
 {g:"Mom's food",n:'Meat portion (6–8 oz)',c:400,p:45},
 {g:"Mom's food",n:'Pozole (big bowl)',c:450,p:30},
 {g:"Mom's food",n:'Ceviche (1 cup)',c:200,p:25},
 {g:"Mom's food",n:'Rice (1 cup)',c:240,p:4},
 {g:"Mom's food",n:'Beans (1 cup)',c:240,p:14},
 {g:"Mom's food",n:'Corn tortilla',c:60,p:1.5},
 {g:"Mom's food",n:'Flour tortilla',c:140,p:4}
];
const LIFT_GOALS={'Smith bench press':'Started around 205×6–8. Goal: 225×8.','Smith squat':'Started at 165 × 8. Once you hit 10 on all 3 sets, add 5s on each side.','Hack squat':'Backup for when the Smith is taken. Log plates only.','Incline Smith press':'Started around 135. Goal: 155×8.','Incline DB press':'Goal: +5 lbs per hand every 2–4 weeks.','Lat pulldown':'Already strong. Keep adding reps.'};

// ---------- per-person program ----------
// settings.program = {days:{key:{t,ex:[{n,s,r,rest,ss?,note?}]}}, order:[keys], sched:[Sun..Sat key or 'rest']}
const LEGACY_ORDER=['push','pull','legs','upper','arms'];
const LEGACY_GROUPS=['Breakfast & shakes','Work orders',"Mom's food",'Snacks'];
const NEW_GROUPS=['Breakfast & shakes','Meals','Snacks'];
const STARTER_PRESETS=[
 {g:'Breakfast & shakes',n:'Eggs (3)',c:215,p:19},
 {g:'Breakfast & shakes',n:'Greek yogurt (1 cup)',c:140,p:23},
 {g:'Breakfast & shakes',n:'Whey shake (1 scoop)',c:120,p:25},
 {g:'Breakfast & shakes',n:'Milk (1 cup, 2%)',c:120,p:8},
 {g:'Meals',n:'Chicken breast (6 oz cooked)',c:280,p:53},
 {g:'Meals',n:'White rice (1 cup cooked)',c:205,p:4}
];
const EMPTY_PROGRAM={days:{},order:[],sched:['rest','rest','rest','rest','rest','rest','rest']};
const PROG=()=>{const p=cfg().program;return p&&p.days&&Array.isArray(p.order)&&Array.isArray(p.sched)?p:EMPTY_PROGRAM};
const dayOf=k=>PROG().days[k]||null;
const titleOf=k=>k==='rest'?'Rest day':(dayOf(k)?dayOf(k).t:'Workout');
const schedOn=dateKey=>{const k=PROG().sched[parseKey(dateKey).getDay()];return k&&dayOf(k)?k:'rest'};
const isLegacy=()=>!!cfg().legacy;
const goalOf=()=>(cfg().profile&&cfg().profile.goal)||'bulk';
const foodGroups=()=>Array.isArray(cfg().foodGroups)?cfg().foodGroups:NEW_GROUPS;

// Someone with history but no program is Pablo from before programs were per-person: move his setup in once.
// Someone with no history and no program is new: they get the intake form.
function ensureProgram(){
  if(!S.loaded||cfg().program)return;
  const hasHistory=Object.keys(S.days).length>0||Object.keys(S.workouts).length>0||cfg().cal!=null;
  if(!hasHistory)return;
  const sw=cfg().swaps||{},days={};
  for(const k of LEGACY_ORDER)days[k]={t:LEGACY_PROGRAM[k].t,ex:LEGACY_PROGRAM[k].ex.map((e,i)=>{const x=clone(e);if(sw[k+':'+i]){x.n=sw[k+':'+i];delete x.note}return x})};
  const s=clone(cfg());s.program={days,order:LEGACY_ORDER.slice(),sched:LEGACY_SCHED.slice()};s.legacy=true;
  if(!Array.isArray(s.foodGroups))s.foodGroups=LEGACY_GROUPS.slice();
  delete s.swaps;putSettings(s);
}
const needsIntake=()=>S.loaded&&!cfg().program;

// ---------- intake: targets ----------
const ACT={low:['Mostly sitting (desk, school, driving)',1.4],mid:['On my feet a good part of the day',1.55],high:['Physical job or very active',1.75]};
const GOALS={bulk:'Build muscle (lean bulk)',cut:'Lose fat (cut)',maintain:'Stay the same weight, get stronger'};
// Mifflin-St Jeor resting burn × activity (the multipliers include 3–6 lifting days), then the goal adjustment.
// Bulk +250 aims for 0.25–0.5 lb/week. Cut −400 aims for about 0.5–1% of body weight a week.
// Protein: 0.9 g per lb (about 2 g/kg), 1 g per lb on a cut to hold on to muscle.
function calcTargets(p){
  const kg=p.weight*0.4536,cm=(p.ft*12+(p.inch||0))*2.54;
  const bmr=10*kg+6.25*cm-5*p.age+(p.sex==='f'?-161:5);
  const tdee=bmr*(ACT[p.act]||ACT.mid)[1];
  let cal=Math.round((tdee+(GOAL_ADJ[p.goal]||0))/50)*50;
  cal=Math.max(cal,p.sex==='f'?1300:1600);
  const pro=Math.min(220,Math.round(p.weight*(p.goal==='cut'?1:0.9)/5)*5);
  const goal=p.gw||Math.round(p.weight+({bulk:8,cut:-10,maintain:0}[p.goal]||0));
  return {cal,pro,goal};
}

// ---------- intake: program ----------
// Planet Fitness equipment only (Smith machine, cables, machines, dumbbells; no free barbell rack).
// About 10–20 hard sets per muscle per week, compounds first, 2–3 min rest on compounds, 90 s on isolation.
const WU='Do 1–2 light warm-up sets first (don’t log them). ';
const SM='Log total weight: plates plus the bar.';
function X(n,s,r,rest,note){const e={n,s,r,rest};if(note)e.note=note;return e}
const DAYLIB={
 fbA:{t:'Full body A',ex:[X('Smith squat',3,'6-10',180,WU+SM),X('Smith bench press',3,'6-10',150,SM),X('Lat pulldown',3,'8-12',120),X('Leg curl',3,'10-15',90),X('DB lateral raise',3,'12-20',90),X('Triceps pushdown',2,'10-15',90)]},
 fbB:{t:'Full body B',ex:[X('Smith RDL',3,'8-10',150,WU+'Feel the stretch in your hamstrings. '+SM),X('Incline DB press',3,'8-12',120,'Log per dumbbell.'),X('Seated cable row',3,'8-12',120),X('Leg extension',3,'10-15',90),X('Cable curl',3,'10-15',90),X('Cable crunch',3,'10-15',90)]},
 fbC:{t:'Full body C',ex:[X('Leg press',3,'10-15',150,WU),X('Smith shoulder press',3,'6-10',150,SM),X('Pull-up',3,'6-10',150,'Use the assisted machine if you need to. Leave weight blank for bodyweight.'),X('Pec deck',3,'10-15',90),X('Face pull',3,'12-20',90),X('Calf raise',3,'12-20',90),X('DB hammer curl',2,'10-12',90,'Log per dumbbell.')]},
 upA:{t:'Upper A',ex:[X('Smith bench press',3,'6-10',150,WU+SM),X('Lat pulldown',3,'8-12',120),X('Incline DB press',3,'8-12',120,'Log per dumbbell.'),X('Seated cable row',3,'8-12',120),X('DB lateral raise',3,'12-20',90),X('Triceps pushdown',3,'10-15',90),X('Standing DB curl',3,'8-12',90,'Log per dumbbell.')]},
 loA:{t:'Lower A',ex:[X('Smith squat',3,'6-10',180,WU+SM),X('Smith RDL',3,'8-10',150,'Feel the stretch in your hamstrings. '+SM),X('Leg extension',3,'10-15',90),X('Leg curl',3,'10-15',90),X('Calf raise',4,'12-20',90,'Pause at the bottom stretch.'),X('Cable crunch',3,'10-15',90)]},
 upB:{t:'Upper B',ex:[X('Incline Smith press',3,'6-10',150,WU+SM),X('Pull-up',3,'6-10',150,'Use the assisted machine if you need to. Leave weight blank for bodyweight.'),X('Chest press machine',3,'8-12',120),X('Single-arm cable row',3,'10-12',90,'Log weight per arm.'),X('Cable lateral raise',3,'12-20',90),X('Reverse pec deck',3,'12-20',90),X('Overhead cable triceps extension',3,'10-15',90),X('Incline DB curl',3,'8-12',90,'Log per dumbbell.')]},
 loB:{t:'Lower B',ex:[X('Leg press',3,'10-15',150,WU),X('Smith hip thrust',3,'8-12',120,SM),X('DB Bulgarian split squat',3,'8-12',120,'Log per dumbbell, per leg.'),X('Leg curl',3,'10-15',90),X('Leg extension',3,'12-15',90),X('Calf raise',4,'12-20',90,'Pause at the bottom stretch.')]},
 push:{t:'Push',ex:[X('Incline Smith press',3,'6-10',150,WU+SM),X('Seated DB shoulder press',3,'8-12',120,'Log per dumbbell.'),X('Chest press machine',3,'8-12',120),X('DB lateral raise',4,'12-20',90),X('Low-to-high cable fly',3,'12-15',90),X('Triceps pushdown',3,'10-15',90),X('Overhead cable triceps extension',2,'10-15',90)]},
 pull:{t:'Pull',ex:[X('Pull-up',3,'6-10',150,'Use the assisted machine if you need to. Leave weight blank for bodyweight.'),X('Smith bent-over row',3,'8-10',150,WU+SM),X('Lat pulldown',3,'10-12',120),X('Face pull',3,'12-20',90),X('Standing DB curl',3,'8-12',90,'Log per dumbbell.'),X('Bayesian cable curl',2,'10-12',90,'Log weight per arm.'),X('DB hammer curl',2,'10-12',90,'Log per dumbbell.')]},
 push2:{t:'Push B',ex:[X('Smith bench press',3,'6-10',150,WU+SM),X('Incline DB press',3,'8-12',120,'Log per dumbbell.'),X('Smith shoulder press',3,'6-10',150,SM),X('Cable lateral raise',3,'12-20',90),X('Pec deck',3,'10-15',90),X('Dips',3,'8-12',90,'Use the assisted machine if you need to. Leave weight blank for bodyweight.')]},
 pull2:{t:'Pull B',ex:[X('Lat pulldown',3,'8-12',120,WU),X('Seated cable row',3,'8-12',120),X('Single-arm cable row',3,'10-12',90,'Log weight per arm.'),X('Reverse pec deck',3,'12-20',90),X('Incline DB curl',3,'8-12',90,'Log per dumbbell.'),X('Cable hammer curl',2,'10-12',90)]}
};
const SPLITS={
 3:{keys:['fbA','fbB','fbC'],sched:['rest','fbA','rest','fbB','rest','fbC','rest']},
 4:{keys:['upA','loA','upB','loB'],sched:['rest','upA','loA','rest','upB','loB','rest']},
 5:{keys:['upA','loA','push','pull','loB'],sched:['rest','upA','loA','rest','push','pull','loB'],titles:{upA:'Upper',loA:'Lower',loB:'Legs'}},
 6:{keys:['push','pull','loA','push2','pull2','loB'],sched:['rest','push','pull','loA','push2','pull2','loB'],titles:{push:'Push A',pull:'Pull A',loA:'Legs A',loB:'Legs B'}}
};
function buildProgram(p){
  const sp=SPLITS[p.days]||SPLITS[4],days={};
  for(const k of sp.keys){const d=clone(DAYLIB[k]);if(sp.titles&&sp.titles[k])d.t=sp.titles[k];
    // Newer lifters: 3 sets max and at most 7 exercises. Plenty to grow, easier to recover from.
    if(p.exp==='new'){d.ex=d.ex.slice(0,7);d.ex.forEach(e=>{e.s=Math.min(e.s,3)})}
    days[k]=d}
  return {days,order:sp.keys.slice(),sched:sp.sched.slice()};
}
