// Fake supabase-js used by tests/smoke.py. Served in place of vendor/supabase.js.
// Stores docs in window.__docs (kept in sessionStorage so they survive a reload) and accepts one password: pw12345678.
window.__docs=JSON.parse(sessionStorage.getItem('mockdocs')||'{}');window.__calls=[];
const persist=()=>sessionStorage.setItem('mockdocs',JSON.stringify(__docs));
window.supabase={createClient(){
  let session=JSON.parse(localStorage.getItem('mocksess')||'null');
  const key=(c,i)=>c+'/'+i;
  function qb(table){
    const f={};let mode='select',payload=null,single=false;
    const b={
      select(){mode=mode==='select'?'select':mode;return b},
      eq(k,v){f[k]=v;return b},limit(){return b},
      maybeSingle(){single=true;return b},
      upsert(rows){mode='upsert';payload=Array.isArray(rows)?rows:[rows];return b},
      update(p){mode='update';payload=p;return b},
      then(res,rej){return Promise.resolve(run()).then(res,rej)}
    };
    function run(){
      __calls.push([table,mode]);
      if(!session)return {data:null,error:{status:401,message:'no auth'}};
      if(table==='profiles'){if(mode==='update')return {error:null};return {data:{display_name:'pablo',is_admin:true},error:null}}
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
    rpc:async(n,a)=>{__calls.push(['rpc',n]);const k=key(a.p_coll,a.p_id);__docs[k]=Object.assign(__docs[k]||{},JSON.parse(JSON.stringify(a.p_patch)));persist();return {error:null}},
    channel(){const c={on(){return c},subscribe(){return c}};return c}
  };
}};
