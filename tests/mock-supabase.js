// Fake supabase-js used by tests/smoke.py. Served in place of vendor/supabase.js.
// Stores docs in window.__docs (kept in sessionStorage so they survive a reload) and accepts one password: pw12345678.
window.__docs=JSON.parse(sessionStorage.getItem('mockdocs')||'{}');window.__calls=[];
// intake_requests rows, also kept across reloads. Every user in the mock is the same admin.
window.__reqs=JSON.parse(sessionStorage.getItem('mockreqs')||'[]');
const persist=()=>{sessionStorage.setItem('mockdocs',JSON.stringify(__docs));sessionStorage.setItem('mockreqs',JSON.stringify(__reqs))};
window.supabase={createClient(){
  let session=JSON.parse(localStorage.getItem('mocksess')||'null');
  const key=(c,i)=>c+'/'+i;
  function qb(table){
    const f={};let mode='select',payload=null,single=false;
    const b={
      select(){mode=mode==='select'?'select':mode;return b},
      eq(k,v){f[k]=v;return b},limit(){return b},order(){return b},
      insert(rows){mode='insert';payload=Array.isArray(rows)?rows:[rows];return b},
      maybeSingle(){single=true;return b},
      upsert(rows){mode='upsert';payload=Array.isArray(rows)?rows:[rows];return b},
      update(p){mode='update';payload=p;return b},
      then(res,rej){return Promise.resolve(run()).then(res,rej)}
    };
    function run(){
      __calls.push([table,mode]);
      if(!session)return {data:null,error:{status:401,message:'no auth'}};
      if(table==='profiles'){if(mode==='update')return {error:null};const me={id:'u1',display_name:'pablo',is_admin:true};return {data:single?me:[me],error:null}}
      if(table==='intake_requests'){
        if(mode==='insert'&&window.__failInsert)return {error:{message:'Failed to fetch'}};
        if(mode==='insert'){for(const r of payload)__reqs.unshift({id:'r'+(__reqs.length+1),user_id:session.user.id,answers:r.answers,plan:null,status:'new',created_at:new Date().toISOString()});persist();return {error:null}}
        return {data:__reqs.filter(r=>(!f.user_id||r.user_id===f.user_id)&&(!f.status||r.status===f.status)).map(r=>JSON.parse(JSON.stringify(r))),error:null}}
      if(mode==='upsert'){for(const r of payload)__docs[key(r.coll,r.id)]=JSON.parse(JSON.stringify(r.data));persist();return {error:null}}
      const rows=Object.entries(__docs).filter(([k])=>!f.coll||k.startsWith(f.coll+'/')).map(([k,d])=>({id:k.split('/')[1],data:d})).filter(r=>!f.id||r.id===f.id);
      if(single)return {data:rows[0]||null,error:null};
      return {data:rows,error:null};
    }
    return b;
  }
  return {
    auth:{
      getSession:async()=>({data:{session}}),
      signInWithPassword:async({email,password})=>{if(password!=='pw12345678')return {error:{message:'Invalid login credentials'}};session={user:{id:'u1',email}};localStorage.setItem('mocksess',JSON.stringify(session));return {data:{session},error:null}},
      onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}},
      signOut:async()=>{session=null;localStorage.removeItem('mocksess')},
      updateUser:async()=>({error:null}),resetPasswordForEmail:async()=>({error:null})
    },
    from:qb,
    rpc:async(n,a)=>{__calls.push(['rpc',n]);
      if(n==='send_intake_plan'){const r=__reqs.find(x=>x.id===a.p_id);if(!r)return {error:{message:'Request not found'}};r.plan=JSON.parse(JSON.stringify(a.p_plan));r.status='sent';persist();return {error:null}}
      if(n==='mark_intake_applied'){const r=__reqs.find(x=>x.id===a.p_id&&x.status==='sent');if(r){r.status='applied';persist()}return {error:null}}
      const k=key(a.p_coll,a.p_id);__docs[k]=Object.assign(__docs[k]||{},JSON.parse(JSON.stringify(a.p_patch)));persist();return {error:null}},
    channel(){const c={on(){return c},subscribe(){return c}};return c}
  };
}};
