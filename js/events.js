"use strict";
// Every tap, change and input in the app is handled here, plus drag to reorder.
// Loaded by index.html in a fixed order (see the <script> tags there). All files share one global scope.

// ---------- events ----------
$('#nav').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S.tab=b.dataset.tab;S.swap=null;S.flash=null;S.redo=false;try{localStorage.setItem('gt_tab',S.tab)}catch(x){}render();window.scrollTo(0,0);const m=$('#app');m.classList.remove('enter');void m.offsetWidth;m.classList.add('enter');clearTimeout(m._et);m._et=setTimeout(()=>m.classList.remove('enter'),450)});
const app=$('#app');
app.addEventListener('input',e=>{
  const el=e.target,ds=el.dataset;
  if(el.id==='snaptxt'){S.snapTxt=el.value;return}
  if(el.id==='fsearch'){const q=el.value.trim().toLowerCase();app.querySelectorAll('.sheet .fgroup').forEach(g=>{let any=false;g.querySelectorAll('.chips button').forEach(b=>{const on=!q||b.textContent.toLowerCase().includes(q);b.hidden=!on;any=any||on});g.hidden=!any});return}
  if(el.id&&el.id.startsWith('in_')){S.draft=Object.assign({},S.draft,{[el.id]:el.value});return}
  if(el.id==='reqplan'){S.reqDraft=el.value;return}
  if(ds.sched!=null){const s=clone(cfg());if(!s.program)return;s.program.sched[+ds.sched]=el.value;putSettings(s);render();return}
  if(ds.pd!=null){const s=clone(cfg());const d=s.program&&s.program.days[ds.pd];if(!d)return;S.openDay=ds.pd;
    if(ds.pe==null)d.t=el.value;
    else{const x=d.ex[+ds.pe];if(!x)return;
      if(ds.pf==='n'){if(x.n!==el.value){x.n=el.value;delete x.note}}
      else if(ds.pf==='r')x.r=el.value;
      else if(ds.pf==='inc'){const v=num(el.value);if(v>0)x.inc=Math.min(50,v);else delete x.inc}
      else{const v=num(el.value);if(v==null)return;x[ds.pf]=ds.pf==='s'?Math.max(1,Math.min(10,Math.round(v))):Math.max(0,Math.min(600,Math.round(v)))}}
    putSettings(s,700);return}
  if(ds.sn!=null&&S.snap&&S.snap.items){const x=S.snap.items[+ds.sn];if(x){x[ds.sf]=ds.sf==='n'?el.value:(num(el.value)||0)}return}
  if(ds.day){const d=dayDoc(S.dk);d[ds.day]=el.type==='checkbox'?el.checked:(ds.day==='note'?el.value:num(el.value));putDay(S.dk,d,el.type==='checkbox'?0:700);if(el.type==='checkbox')render();else if(ds.day==='steps')S.needRender=true}
  else if(ds.w!=null&&ds.f){const w=curWorkout();const s=w.ex[+ds.w].sets[+ds.s];s[ds.f]=el.value===''?'':+el.value;putWorkout(w,700)}
  else if(ds.wnote){const w=curWorkout();w.note=el.value;putWorkout(w,700)}
  else if(ds.pre!=null){const s=clone(cfg());const ps=clone(presets());const p=ps[+ds.pre];p[ds.pf]=ds.pf==='n'||ds.pf==='g'?el.value:(num(el.value)||0);s.presets=ps;putSettings(s,700)}
});
app.addEventListener('change',e=>{
  const el=e.target,ds=el.dataset;
  if(el.id==='photofile'){const f=el.files&&el.files[0];if(f)addPhoto(f,POSES.some(p=>p[0]===S.pose)?S.pose:'front');return}
  if(el.id==='snapfile'){const f=el.files&&el.files[0];if(f){if(S.snapUrl){try{URL.revokeObjectURL(S.snapUrl)}catch(x){}}S.snapFile=f;try{S.snapUrl=URL.createObjectURL(f)}catch(x){S.snapUrl=null}S.snap=null;render()}return}
  if(ds.push){pushHour(ds.push,+el.value);return}
  if(el.id==='acboard'){setSharing(el.checked);return}
  if(el.id==='wdate'){if(el.value){S.reorder=false;S.wd=el.value;S.wp=schedOn(S.wd);S.swap=null;S.exOpen=null;render()}}
  else if(el.id==='wprog'){S.reorder=false;S.wp=el.value;S.swap=null;S.exOpen=null;render()}
  else if(el.id==='liftsel'){S.lift=el.value;render()}
  else if(el.id==='goalsel'){const s=clone(cfg());s.profile=Object.assign({},s.profile,{goal:el.value});s.phaseStart=today();putSettings(s);render()}
  else if(ds.set){const s=clone(cfg());s[ds.set]=ds.set==='block'?(el.value||null):num(el.value);putSettings(s);render()}
  else if(ds.pre!=null&&ds.pf==='g')render();
});
app.addEventListener('click',e=>{
  {const m=e.target.closest('[data-mus]');if(m){S.mus=S.mus===m.dataset.mus?null:m.dataset.mus;render();return}}
  const b=e.target.closest('button');if(!b||!b.dataset.act)return;const ds=b.dataset,act=ds.act,i=+ds.i;
  if(act==='day'){S.dk=addDays(S.dk,+ds.v);if(S.dk>today())S.dk=today();render()}
  else if(act==='gotoday'){S.dk=today();render()}
  else if(act==='startw'){S.wd=S.dk;S.wp=schedOn(S.dk);S.exOpen=null;S.tab='workout';render();window.scrollTo(0,0)}
  else if(act==='qedit'){S.qedit=!S.qedit;render()}
  else if(act==='foods'){S.sheet='foods';S.qedit=false;render();probeEstimates()}
  else if(act==='sheetx'){S.sheet=null;S.qedit=false;render()}
  else if(act==='bodymore'){S.bodyMore=!S.bodyMore;render()}
  else if(act==='intake')submitIntake();
  else if(act==='meback')toggleAccount();
  else if(act==='reqload'){S.reqs=null;S.reqErr=null;render()}
  else if(act==='reqopen'){const id=ds.id;if(S.reqOpen===id){S.reqOpen=null}else{S.reqOpen=id;S.reqDraft=''}S.reqMsg=null;render();if(S.reqOpen){const t=$('#reqplan');if(t)t.focus()}}
  else if(act==='reqsend')sendPlan(ds.id);
  else if(act==='reqcopy'){const r=(S.reqs||[]).find(x=>x.id===ds.id);if(!r)return;const txt=reqPrompt(r,S.reqNames[r.user_id]);S.reqCopyText=null;
    Promise.resolve().then(()=>navigator.clipboard.writeText(txt)).then(()=>{S.reqCopied=r.id;render();setTimeout(()=>{S.reqCopied=null;render()},2500)}).catch(()=>{S.reqCopyText={id:r.id,t:txt};render()})}
  else if(act==='reqresend'){S.reqSendMsg='Sending…';render();sendIntake()}
  else if(act==='planuse')applyPlan();
  else if(act==='planlater'){S.planLater=true;render()}
  else if(act==='redo'){S.redo=true;S.draft=null;render();window.scrollTo(0,0)}
  else if(act==='redox'){S.redo=false;S.draft=null;render()}
  else if(act==='pexmv'||act==='pexdel'||act==='pexadd'){const s=clone(cfg());const d=s.program&&s.program.days[ds.k];if(!d)return;S.openDay=ds.k;
    if(act==='pexmv'){const j=i+(+ds.v);if(j<0||j>=d.ex.length)return;[d.ex[i],d.ex[j]]=[d.ex[j],d.ex[i]]}
    else if(act==='pexdel'){const before=clone(cfg()),gone=d.ex.splice(i,1)[0];putSettings(s);render();if(gone)undoSettings(before,gone.n);return}
    else d.ex.push({n:'New exercise',s:3,r:'8-12',rest:90});
    putSettings(s);render()}
  else if(act==='pdayadd'){const s=clone(cfg());if(!s.program)return;let n=1,k;do{k='day'+n++}while(s.program.days[k]);s.program.days[k]={t:'New day',ex:[]};s.program.order.push(k);S.openDay=k;putSettings(s);render()}
  else if(act==='pdaydel'){if(S.delDay!==ds.k){S.delDay=ds.k;S.openDay=ds.k;render();return}
    const s=clone(cfg());if(!s.program)return;delete s.program.days[ds.k];s.program.order=s.program.order.filter(x=>x!==ds.k);s.program.sched=s.program.sched.map(x=>x===ds.k?'rest':x);S.delDay=null;putSettings(s);render()}
  else if(act==='qmove'){const ps=clone(presets());const p=ps[i];if(!p)return;const g=p.g||'Other';const dir=+ds.v;let j=i+dir;while(j>=0&&j<ps.length&&(ps[j].g||'Other')!==g)j+=dir;if(j<0||j>=ps.length)return;[ps[i],ps[j]]=[ps[j],ps[i]];const s=clone(cfg());s.presets=ps;putSettings(s);render()}
  else if(act==='qdel'){const p=presets()[i];if(!p)return;const before=clone(cfg()),s=clone(cfg());const ps=clone(presets());ps.splice(i,1);s.presets=ps;putSettings(s);render();undoSettings(before,p.n)}
  else if(FOOD_SRC[act]){const p=FOOD_SRC[act]()[i];if(!p)return;const d=addFood(dayDoc(S.dk),p);putDay(S.dk,d);refreshFood(d,p.n);
    const sp=b.querySelector('.qn');if(sp){sp.classList.remove('pop');void sp.offsetWidth;sp.classList.add('pop')}b.classList.remove('ring');void b.offsetWidth;b.classList.add('ring');
    try{navigator.vibrate&&navigator.vibrate(15)}catch(x){}}
  else if(act==='rckeep'){const p=recentFoods(S.dk)[i];if(!p)return;const s=clone(cfg());const ps=clone(presets());const gs=foodGroups();ps.push(Object.assign({g:gs.includes('Snacks')?'Snacks':gs[0]||'Other'},p));s.presets=ps;putSettings(s);render()}
  else if(act==='copyday'){const y=S.days[addDays(S.dk,-1)];if(!y)return;const d=dayDoc(S.dk);for(const f of y.food||[])addFood(d,f,f.q||1);putDay(S.dk,d);render()}
  else if(act==='fq'){const before=dayDoc(S.dk),d=dayDoc(S.dk);const f=d.food[i];if(!f)return;f.q=(f.q||1)+(+ds.v);const gone=f.q<=0;if(gone)d.food.splice(i,1);putDay(S.dk,d);refreshFood(d,gone?null:f.n);if(gone)undoDay(S.dk,before,f.n)}
  else if(act==='snap'){if(!(S.snap&&S.snap.busy))runSnap()}
  else if(act==='snapclear'){if(S.snapUrl){try{URL.revokeObjectURL(S.snapUrl)}catch(x){}}S.snapUrl=null;S.snapFile=null;render()}
  else if(act==='snapdel'){if(S.snap&&S.snap.items){S.snap.items.splice(i,1);render()}}
  else if(act==='snapcancel'){clearSnap();render()}
  else if(act==='snapadd'){const items=(S.snap&&S.snap.items||[]).filter(x=>String(x.n).trim());if(!items.length)return;
    const d=dayDoc(S.dk);for(const x of items)addFood(d,x,Math.max(1,Math.round(+x.q||1)));
    putDay(S.dk,d);
    const sv=$('#snapsave');if(sv&&sv.checked){const st=clone(cfg());const ps=clone(presets());for(const x of items){const n=String(x.n).trim();if(!ps.some(y=>y.n===n))ps.push({g:'Snapped',n,c:+x.c||0,p:+x.p||0})}st.presets=ps;putSettings(st)}
    clearSnap();render()}
  else if(act==='custom'){const n=$('#cn').value.trim(),c=num($('#cc').value),p=num($('#cp').value);if(!n||(c==null&&p==null))return;const d=addFood(dayDoc(S.dk),{n,c,p});putDay(S.dk,d);render()}
  else if(act==='setdone'){const w=curWorkout(),ex=w.ex[i],s=ex.sets[+ds.j];
    if(!s.d){const df=setDefault(w,i,+ds.j);if(s.w==='')s.w=df.w;if(s.r==='')s.r=df.r;
      if(s.r===''){const inp=app.querySelector(`input[data-w="${i}"][data-s="${ds.j}"][data-f="r"]`);inp&&inp.focus();return}
      s.d=true;if(!w.t0)w.t0=Date.now();
      const b=bestSet({sets:[s]}),before=bestSet({sets:ex.sets.filter(x=>x!==s)});
      const pr=b&&(!before||before.bw!==b.bw||b.v>before.v)&&isBest(b,ex.n,w.date,wid(w.date,w.prog));
      const nx=nextOpen(w,i);S.exOpen=nx;
      putWorkout(w);render();startTimer(ex.rest||90);
      if(nx!==i){const c=$('.exopen');if(c)c.scrollIntoView({block:'start',behavior:'smooth'})}
      if(pr){toast(`New best: ${ex.n} ${b.top}`);try{navigator.vibrate&&navigator.vibrate([60,40,120])}catch(x){}}}
    else{s.d=false;putWorkout(w);render()}}
  else if(act==='exopen'){S.exOpen=i;S.swap=null;render()}
  // − / + on the set you're on. An empty field starts from today's target, so one tap means "one more (or less) than planned".
  else if(act==='step'){const w=curWorkout(),j=+ds.j,s=w.ex[i].sets[j],f=ds.f;if(!s)return;
    const cur=s[f]===''?(num(setDefault(w,i,j)[f])||0):+s[f];s[f]=Math.max(f==='r'?1:0,cur+(+ds.v));putWorkout(w,700);
    const el=app.querySelector(`input[data-w="${i}"][data-s="${j}"][data-f="${f}"]`);if(el)el.value=s[f]}
  else if(act==='setadd'){const w=curWorkout();const st=w.ex[i].sets;const l=st[st.length-1];st.push({w:l?l.w:'',r:'',d:false});putWorkout(w);render()}
  else if(act==='setdel'){const w=curWorkout();const st=w.ex[i].sets;if(st.length>1&&!st[st.length-1].d){st.pop();putWorkout(w);render()}}
  else if(act==='rest')startTimer(+ds.v);
  else if(act==='swap'){S.swap=S.swap===i?null:i;render()}
  else if(act==='reorder'){S.reorder=!S.reorder;S.swap=null;S.exOpen=null;render()}
  else if(act==='mv'){const w=curWorkout();const j=i+(+ds.v);if(j<0||j>=w.ex.length)return;const t=w.ex[i];w.ex[i]=w.ex[j];w.ex[j]=t;S.exOpen=null;putWorkout(w);render()}
  else if(act==='swapx'){S.swap=null;render()}
  else if(act==='swapone'||act==='swapall'){const n=($('#swapname').value||'').trim();if(!n)return;const w=curWorkout();const ex=w.ex[i];
    if(act==='swapall'&&ex.ti!=null){const s=clone(cfg());const pe=s.program&&s.program.days[w.prog]&&s.program.days[w.prog].ex[ex.ti];if(pe){pe.n=n;delete pe.note;putSettings(s)}}
    ex.n=n;ex.note='';putWorkout(w);S.swap=null;render()}
  else if(act==='exdel'){const before=curWorkout(),w=curWorkout(),gone=w.ex.splice(i,1)[0];putWorkout(w);S.swap=null;S.exOpen=null;render();if(gone)undoWorkout(before,gone.n)}
  else if(act==='axclose'){S.addEx=false;render()}
  else if(act==='axopen'){S.addEx=true;render();const x=$('#axn');x&&x.focus()}
  else if(act==='axadd'){const n=$('#axn').value.trim();if(!n)return;const sets=Math.max(1,Math.min(10,num($('#axs').value)||3));const r=($('#axr').value||'8-12').replace(/[–—]/g,'-');const w=curWorkout();
    w.ex.push({n,s:sets,r:/^\d+-\d+$/.test(r)?r:'8-12',rest:90,ss:'',note:'',ti:null,sets:Array.from({length:sets},()=>({w:'',r:'',d:false}))});putWorkout(w);S.addEx=false;S.exOpen=w.ex.length-1;render()}
  else if(act==='finish'){const w=curWorkout();if(!w.done)w.t1=Date.now();w.done=true;putWorkout(w);flushAll();stopTimer();render();window.scrollTo(0,0)}
  else if(act==='pushon')pushOn();
  else if(act==='pushoff')pushOff();
  else if(act==='stepnew')newStepLink();
  else if(act==='stepoff')stopStepLink();
  else if(act==='stepdone'){S.stepTok=null;render()}
  else if(act==='cp'){Promise.resolve().then(()=>navigator.clipboard.writeText(ds.cp)).then(()=>toast('Copied'),()=>toast('Press and hold the text to copy it'))}
  else if(act==='boardwk'){S.boardWeek=ds.v;render()}
  else if(act==='psec'){S.psec=ds.v;S.showCheckin=false;render();window.scrollTo(0,0)}
  else if(act==='recall'){S.recAll=!S.recAll;render()}
  else if(act==='adjcal'){const s=clone(cfg());s.cal=T().cal+(+ds.v);s.calAdj=weekStart(today());putSettings(s);render()}
  else if(act==='focus'){const s=clone(cfg()),f=focusList();s.focus=f.includes(ds.k)?f.filter(k=>k!==ds.k):[...f,ds.k];putSettings(s);render()}
  else if(act==='pose'){S.pose=ds.v;S.photoDel=null;render()}
  else if(act==='photoall'){S.photoAll=!S.photoAll;S.photoDel=null;render()}
  // Deleting a photo is permanent, so it takes a second tap on the same button.
  else if(act==='photodel'){if(S.photoDel===ds.p)delPhoto(ds.p);else{S.photoDel=ds.p;render()}}
  else if(act==='sugdo'){const sg=suggestions().find(x=>x.id===ds.id);if(!sg)return;const before=clone(cfg()),s=clone(cfg());sg.apply(s);putSettings(s);render();toast('Plan updated: '+sg.text,()=>putSettings(before))}
  else if(act==='gosug'){S.tab='plan';render();window.scrollTo(0,0)}
  else if(act==='sugskip'){const s=clone(cfg());s.skipSug=Object.assign({},s.skipSug,{[ds.id]:weekStart(today())});putSettings(s);render()}
  else if(act==='checkok'){const s=clone(cfg());s.checkin=weekStart(today());putSettings(s);render()}
  else if(act==='checkshow'||act==='checkhide'){S.showCheckin=act==='checkshow';render()}
  else if(act==='phase'){const p=nextPhases()[i];if(!p||!goalReached())return;const s=clone(cfg());s.profile=Object.assign({},s.profile,{goal:p.goal});s.cal=p.cal;s.pro=p.pro;s.goal=p.gw;s.phaseStart=today();putSettings(s);toast(p.label+': targets updated');render()}
  else if(act==='newblock'){const s=clone(cfg());s.block=today();putSettings(s);render()}
  else if(act==='preadd'){const s=clone(cfg());const ps=clone(presets());ps.push({g:'Snacks',n:'New food',c:100,p:10});s.presets=ps;putSettings(s);render()}
  else if(act==='prereset'){const s=clone(cfg());delete s.presets;putSettings(s);render()}
  else if(act==='signout'){signOut()}
  else if(act==='pwchange'){changePassword()}
  else if(act==='namesave'){saveName()}
  else if(act==='copy'){const txt=JSON.stringify({settings:S.settings,days:S.days,workouts:S.workouts});S.copyText=null;
    Promise.resolve().then(()=>navigator.clipboard.writeText(txt)).then(()=>{S.copied=true;render();setTimeout(()=>{S.copied=false;render()},2500)}).catch(()=>{S.copyText=txt;render()})}
});

// ---------- drag to reorder ----------
let DR=null;
app.addEventListener('pointerdown',e=>{const h=e.target.closest('.handle');if(!h)return;const li=h.closest('.ritem');if(!li)return;e.preventDefault();DR={li,list:li.parentElement,id:e.pointerId};li.classList.add('dragging');try{h.setPointerCapture(e.pointerId)}catch(x){}});
app.addEventListener('pointermove',e=>{if(!DR||e.pointerId!==DR.id)return;e.preventDefault();const y=e.clientY;let before=null;
  for(const it of DR.list.children){if(it===DR.li)continue;const r=it.getBoundingClientRect();if(y<r.top+r.height/2){before=it;break}}
  if(before){if(before!==DR.li.nextElementSibling)DR.list.insertBefore(DR.li,before)}else if(DR.list.lastElementChild!==DR.li)DR.list.appendChild(DR.li)});
function endDrag(e){if(!DR||e.pointerId!==DR.id)return;const order=[...DR.list.children].map(x=>+x.dataset.ri);DR.li.classList.remove('dragging');DR=null;
  const w=curWorkout();if(order.length===w.ex.length&&!order.every((v,k)=>v===k)){w.ex=order.map(k=>w.ex[k]);putWorkout(w)}render()}
app.addEventListener('pointerup',endDrag);app.addEventListener('pointercancel',endDrag);
