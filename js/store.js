/* ---------- 오레마스 공유 DB 어댑터 (Supabase) ----------
   방(om_rooms) · 상태(om_state) · 로그(om_log) · 비밀(om_secret) 을 다룬다.
   쓰기는 전부 RPC(schema.sql 의 om_* 함수)로 간다. 비밀값(GM 또는 좌석)은 호출 때마다 같이 보낸다. */
"use strict";
/* 그림 주소를 style="background-image:url('…')" 에 넣을 때 쓰는 전역 도우미: 따옴표·괄호·꺾쇠·역슬래시·공백을 %XX 로 바꿔 속성·CSS 문자열을 못 깨게 한다 (주소로서는 같은 뜻) */
function cssu(s){return String(s??'').replace(/[\s"'()\\<>]/g,c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0').toUpperCase())}
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
 /* 계정 (2026-10-23): 아이디 · 비밀번호 로그인 → 로그인 표(token). 방에서는 비밀값 자리에 'u:'+token 을 쓴다 (supabase/patch_2026-10-23_계정.sql) */
 const acct={signup:(id,pw,name)=>rpc('om_signup',{p_id:id,p_pw:pw,p_name:name||''}),login:(id,pw,dev)=>rpc('om_login',{p_id:id,p_pw:pw,p_device:dev||''}),logout:t=>rpc('om_logout',{p_token:t}),
  me:t=>rpc('om_me',{p_token:t}),meUpdate:(t,name,oldPw,newPw)=>rpc('om_me_update',{p_token:t,p_name:name??null,p_old:oldPw??null,p_new:newPw??null}),roomNew:(t,name)=>rpc('om_room_new',{p_token:t,p_name:name}),join:(t,room)=>rpc('om_room_join',{p_token:t,p_room:room}),
  adminList:t=>rpc('om_admin_list',{p_token:t}),adminMember:(t,uid,room,role,seat)=>rpc('om_admin_member',{p_token:t,p_uid:uid,p_room:room,p_role:role??null,p_seat:seat??null}),
  adminUser:(t,uid,o)=>rpc('om_admin_user',{p_token:t,p_uid:uid,p_admin:o.admin??null,p_pw:o.pw??null,p_delete:!!o.del}),
  /* 10-22: 관리자 설정 (방 기본값 등) — supabase/patch_2026-10-22_방기본값.sql */
  configGet:(t,k)=>rpc('om_config_get',{p_token:t,p_key:k}),configSet:(t,k,v)=>rpc('om_config_set',{p_token:t,p_key:k,p_v:v??null})};
 async function claimSeat(room,seat,secret,name){return rpc('om_claim_seat',{p_room:room,p_seat:seat,p_secret:secret,p_name:name})}
 async function roomUpdate(room,secret,name,settings){return rpc('om_room_update',{p_room:room,p_secret:secret,p_name:name??null,p_settings:settings??null})}
 async function roomDel(room,secret){return rpc('om_room_del',{p_room:room,p_secret:secret})}   /* 10-24: supabase/patch_2026-10-24_방삭제.sql */

 /* ----- 상태 ----- */
 async function getState(room){const r=await sb().from('om_state').select('data,v').eq('room',room).maybeSingle();if(r.error)throw err(r.error);return r.data}
 /* 10-23 이그레스: 버전만 (가볍게 확인하고, 앞서 있을 때만 전체를 읽는다) */
 async function getStateV(room){const r=await sb().from('om_state').select('v').eq('room',room).maybeSingle();if(r.error)throw err(r.error);return r.data}
 /* 10-22 로비 방 카드: 방마다 배경 · 첫 화면 · 마지막 변경만 (상태 전체는 무겁다) */
 async function roomsPeek(ids){if(!ids.length)return [];const r=await sb().from('om_state').select('room,updated_at,bg:data->rp->bg,scene:data->scene').in('room',ids);if(r.error)throw err(r.error);return r.data||[]}
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
 async function logClear(room,secret,keepSms){return rpc('om_log_clear',{p_room:room,p_secret:secret,p_keep_sms:!!keepSms})}
 async function whispers(room,secret,after){return rpc('om_whispers',{p_room:room,p_secret:secret,p_after:after||0})}

 /* ----- 비밀 ----- */
 async function secretPut(room,secret,kind,id,data){return rpc('om_secret_put',{p_room:room,p_secret:secret,p_kind:kind,p_id:id,p_data:data||{}})}
 async function secretGet(room,secret,kind){return rpc('om_secret_get',{p_room:room,p_secret:secret,p_kind:kind})}

 /* ----- 실시간 ----- */
 let CH=null;
 function subscribe(room,{onState,onPatch,onLog,onStatus,onEvent}){
  const ch=sb().channel('om:'+room)
   /* 10-23 이그레스: om_state 는 실시간 목록에서 빠졌다 — 없는 표를 구독하면 채널 전체(채팅 포함)가 실패하므로 구독하지 않는다. 상태는 아래 'st' 신호로 */
   .on('broadcast',{event:'st'},p=>{if(onPatch&&p.payload)onPatch(p.payload)})   /* 10-23 이그레스: 바뀐 칸만 (supabase/patch_2026-10-23_이그레스.sql) */
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'om_log',filter:'room=eq.'+room},p=>{if(onLog&&p.new)onLog(p.new)})
   .on('broadcast',{event:'ev'},p=>{if(onEvent&&p.payload)onEvent(p.payload)})
   .subscribe(st=>{if(onStatus)onStatus(st)});
  CH=ch;return ()=>{try{sb().removeChannel(ch)}catch(e){}if(CH===ch)CH=null}}
 /* 저장하지 않는 신호 (입력 중 표시 등): 같은 방의 모두에게 바로 */
 function broadcast(payload){if(!CH)return;try{CH.send({type:'broadcast',event:'ev',payload})}catch(e){}}

 /* ----- 제작기 시트 (읽기) ----- */
 async function makerDocs(kind){
  const out=[];let from=0;const PAGE=1000;
  for(;;){const r=await sb().from(cfg().makerTable||'docs').select('id,data').eq('kind',kind).order('id').range(from,from+PAGE-1);
   if(r.error)throw err(r.error);const rows=r.data||[];out.push(...rows);if(rows.length<PAGE)break;from+=PAGE}
  return out}


 /* ----- 이미지 올리기 (Storage 버킷 oremas). dataUrl(base64) 또는 Blob → 공개 주소 ----- */
 async function uploadImage(path,src){
  let blob=src;
  if(typeof src==='string'){const r=await fetch(src);blob=await r.blob()}
  const ext=(blob.type||'').includes('png')?'png':(blob.type||'').includes('webp')?'webp':(blob.type||'').includes('gif')?'gif':'jpg';
  /* 10-23 이그레스: 올릴 때마다 새 이름 → 브라우저가 1년 동안 다시 받지 않아도 된다 */
  const full=path+'_'+Date.now().toString(36)+'.'+ext;
  const r=await sb().storage.from('oremas').upload(full,blob,{upsert:true,contentType:blob.type||'image/jpeg',cacheControl:'31536000'});
  if(r.error){const m=String(r.error.message||r.error);if(/bucket not found|NoSuchBucket/i.test(m))throw new Error('그림 저장소(버킷 oremas)가 아직 없다 — Supabase SQL Editor 에서 supabase/schema.sql 을 다시 실행해 줘');throw err(r.error)}
  return sb().storage.from('oremas').getPublicUrl(full).data.publicUrl}

 return {getStateV,roomsPeek,acct,logClear,broadcast,uploadImage,createRoom,getRoom,whoami,claimSeat,roomUpdate,roomDel,getState,setState,getLog,getLogTail,addLog,whispers,secretPut,secretGet,subscribe,makerDocs};
})();
