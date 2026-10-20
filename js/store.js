/* ---------- 오레마스 공유 DB 어댑터 (Supabase) ----------
   방(om_rooms) · 상태(om_state) · 로그(om_log) · 비밀(om_secret) 을 다룬다.
   쓰기는 전부 RPC(schema.sql 의 om_* 함수)로 간다. 비밀값(GM 또는 좌석)은 호출 때마다 같이 보낸다. */
"use strict";
window.OM_STORE=(()=>{
 const cfg=()=>window.OM_CONFIG||{};
 let client=null;
 function sb(){
  if(client)return client;
  if(!window.supabase||!window.supabase.createClient)throw new Error('supabase-js를 불러오지 못했습니다');
  client=window.supabase.createClient(cfg().supabaseUrl,cfg().supabaseKey,{realtime:{params:{eventsPerSecond:20}}});
  return client}
 function err(e){const m=(e&&(e.message||e.details))||String(e);const x=new Error(m.replace(/^.*?: /,''));x.raw=e;return x}
 async function rpc(fn,args){const r=await sb().rpc(fn,args);if(r.error)throw err(r.error);return r.data}

 /* ----- 방 ----- */
 async function createRoom(name,gmSecret){return rpc('om_create_room',{p_name:name,p_gm_secret:gmSecret})}
 async function getRoom(id){const r=await sb().from('om_rooms').select('*').eq('id',id).maybeSingle();if(r.error)throw err(r.error);return r.data}
 async function whoami(room,secret){return rpc('om_whoami',{p_room:room,p_secret:secret||''})}
 async function claimSeat(room,seat,secret,name){return rpc('om_claim_seat',{p_room:room,p_seat:seat,p_secret:secret,p_name:name})}
 async function roomUpdate(room,secret,name,settings){return rpc('om_room_update',{p_room:room,p_secret:secret,p_name:name??null,p_settings:settings??null})}

 /* ----- 상태 ----- */
 async function getState(room){const r=await sb().from('om_state').select('data,v').eq('room',room).maybeSingle();if(r.error)throw err(r.error);return r.data}
 async function setState(room,secret,path,value){return rpc('om_set_state',{p_room:room,p_secret:secret,p_path:path||null,p_value:value===undefined?null:value})}

 /* ----- 로그 ----- */
 async function getLog(room,after,limit){
  let q=sb().from('om_log').select('*').eq('room',room).order('id',{ascending:true}).limit(limit||300);
  if(after)q=q.gt('id',after);
  const r=await q;if(r.error)throw err(r.error);return r.data||[]}
 async function getLogTail(room,limit){
  const r=await sb().from('om_log').select('*').eq('room',room).order('id',{ascending:false}).limit(limit||200);
  if(r.error)throw err(r.error);return (r.data||[]).reverse()}
 async function addLog(room,secret,kind,who,data){return rpc('om_log_add',{p_room:room,p_secret:secret,p_kind:kind,p_who:who,p_data:data||{}})}
 async function whispers(room,secret,after){return rpc('om_whispers',{p_room:room,p_secret:secret,p_after:after||0})}

 /* ----- 비밀 ----- */
 async function secretPut(room,secret,kind,id,data){return rpc('om_secret_put',{p_room:room,p_secret:secret,p_kind:kind,p_id:id,p_data:data||{}})}
 async function secretGet(room,secret,kind){return rpc('om_secret_get',{p_room:room,p_secret:secret,p_kind:kind})}

 /* ----- 실시간 ----- */
 function subscribe(room,{onState,onLog,onStatus}){
  const ch=sb().channel('om:'+room)
   .on('postgres_changes',{event:'*',schema:'public',table:'om_state',filter:'room=eq.'+room},p=>{if(onState&&p.new)onState(p.new.data,p.new.v)})
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'om_log',filter:'room=eq.'+room},p=>{if(onLog&&p.new)onLog(p.new)})
   .subscribe(st=>{if(onStatus)onStatus(st)});
  return ()=>{try{sb().removeChannel(ch)}catch(e){}}}

 /* ----- 제작기 시트 (읽기) ----- */
 async function makerDocs(kind){
  const out=[];let from=0;const PAGE=1000;
  for(;;){const r=await sb().from(cfg().makerTable||'docs').select('id,data').eq('kind',kind).order('id').range(from,from+PAGE-1);
   if(r.error)throw err(r.error);const rows=r.data||[];out.push(...rows);if(rows.length<PAGE)break;from+=PAGE}
  return out}

 return {createRoom,getRoom,whoami,claimSeat,roomUpdate,getState,setState,getLog,getLogTail,addLog,whispers,secretPut,secretGet,subscribe,makerDocs};
})();
