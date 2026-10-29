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
  me:t=>rpc('om_me',{p_token:t}),meUpdate:(t,name,oldPw,newPw)=>rpc('om_me_update',{p_token:t,p_name:name??null,p_old:oldPw??null,p_new:newPw??null}),roomNew:(t,name)=>rpc('om_room_new',{p_token:t,p_name:name}),roomCopy:(t,room,name,opts)=>rpc('om_room_copy',{p_token:t,p_room:room,p_name:name,p_opts:opts||{}}),join:(t,room)=>rpc('om_room_join',{p_token:t,p_room:room}),
  adminList:t=>rpc('om_admin_list',{p_token:t}),adminMember:(t,uid,room,role,seat)=>rpc('om_admin_member',{p_token:t,p_uid:uid,p_room:room,p_role:role??null,p_seat:seat??null}),
  adminUser:(t,uid,o)=>rpc('om_admin_user',{p_token:t,p_uid:uid,p_admin:o.admin??null,p_pw:o.pw??null,p_delete:!!o.del}),
  /* 10-22: 관리자 설정 (방 기본값 등) — supabase/patch_2026-10-22_방기본값.sql */
  configGet:(t,k)=>rpc('om_config_get',{p_token:t,p_key:k}),configSet:(t,k,v)=>rpc('om_config_set',{p_token:t,p_key:k,p_v:v??null})};
 async function claimSeat(room,seat,secret,name){return rpc('om_claim_seat',{p_room:room,p_seat:seat,p_secret:secret,p_name:name})}
 async function roomUpdate(room,secret,name,settings){return rpc('om_room_update',{p_room:room,p_secret:secret,p_name:name??null,p_settings:settings??null})}
 async function roomDel(room,secret){return rpc('om_room_del',{p_room:room,p_secret:secret})}   /* 10-24: supabase/patch_2026-10-24_방삭제.sql */

 /* ----- 상태 ----- */
 /* 10-26 상태 나누기 (supabase/patch_2026-10-26_상태나누기.sql): 배틀 · 포켓몬은 따로 담겨 있어 om_get_state 로 합쳐 읽고, 쓰기는 om_put.
    SQL 을 아직 안 돌린 DB 면 함수가 없다 — 그때는 예전 방식(om_state 표 · om_set_state)으로 */
 let SPLIT=null;   /* null 모름 · true 새 방식 · false 옛 방식 */
 const noFn=e=>{const m=String((e&&(e.message||e.details||e.code))||'');return /PGRST202|Could not find the function|function .* does not exist/i.test(m)||(e&&e.code==='PGRST202')};
 async function getState(room){
  if(SPLIT!==false){const r=await sb().rpc('om_get_state',{p_room:room});if(!r.error){SPLIT=true;return r.data&&r.data.data?r.data:null}if(!noFn(r.error))throw err(r.error);SPLIT=false}
  const r=await sb().from('om_state').select('data,v').eq('room',room).maybeSingle();if(r.error)throw err(r.error);return r.data}
 /* 10-23 이그레스: 버전만 (가볍게 확인하고, 앞서 있을 때만 전체를 읽는다) */
 async function getStateV(room){const r=await sb().from('om_state').select('v').eq('room',room).maybeSingle();if(r.error)throw err(r.error);return r.data}
 /* 10-28 이그레스 (supabase/patch_2026-10-28_이어받기.sql): after 다음 버전부터 놓친 신호들만. 이어 붙일 수 없으면 null — 그때는 전체를 읽는다.
    함수가 없는 DB 면 한 번 알고 나서는 묻지 않는다 */
 let PATCHES=null;
 async function patchesSince(room,after){if(PATCHES===false)return null;const r=await sb().rpc('om_patches',{p_room:room,p_after:after||0});
  if(r.error){if(noFn(r.error)){PATCHES=false;return null}throw err(r.error)}PATCHES=true;return Array.isArray(r.data)?r.data:null}
 /* 10-22 로비 방 카드: 방마다 배경 · 첫 화면 · 마지막 변경만 (상태 전체는 무겁다) */
 async function roomsPeek(ids){if(!ids.length)return [];const r=await sb().from('om_state').select('room,updated_at,bg:data->rp->bg,scene:data->scene').in('room',ids);if(r.error)throw err(r.error);return r.data||[]}
 async function setState(room,secret,path,value){const args={p_room:room,p_secret:secret,p_path:path||null,p_value:value===undefined?null:value};
  if(SPLIT!==false){const r=await sb().rpc('om_put',args);if(!r.error){SPLIT=true;return r.data}if(!noFn(r.error))throw err(r.error);SPLIT=false}
  return rpc('om_set_state',args)}

 /* ----- 로그 ----- */
 async function getLog(room,after,limit){
  let q=sb().from('om_log').select('*').eq('room',room).order('id',{ascending:true}).limit(limit||300);
  if(after)q=q.gt('id',after);
  const r=await q;if(r.error)throw err(r.error);return r.data||[]}
 async function getLogTail(room,limit){
  const r=await sb().from('om_log').select('*').eq('room',room).order('id',{ascending:false}).limit(limit||200);
  if(r.error)throw err(r.error);return (r.data||[]).reverse()}
 /* 10-26 덱 시험: 내가 쓴 로그가 실시간으로 되돌아오지 않아 화면에서 빠지는 일이 잦았다 — 쓰고 나면 2.5초 뒤 서버를 한 번 더 읽어 채운다 (app.logFill) */
 async function addLog(room,secret,kind,who,data){return rpc('om_log_add',{p_room:room,p_secret:secret,p_kind:kind,p_who:who,p_data:data||{}}).then(r=>{try{const A=window.OM_APP;if(A&&A.logFill)A.logFill()}catch(e){}return r})}
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
   .subscribe(st=>{if(CH===ch&&onStatus)onStatus(st)});   /* 10-25: 바꿔 붙인 뒤 옛 채널의 CLOSED 는 무시 */
  CH=ch;return ()=>{if(CH===ch)CH=null;try{return Promise.resolve(sb().removeChannel(ch)).catch(()=>{})}catch(e){return Promise.resolve()}}}
 /* 10-25 망령: 폰이 잠들었다 깨면 소켓이 열린 척 죽어 있을 수 있다 — 소켓을 끊고 다시 붙인다 (채널 subscribe 가 다시 연결한다) */
 function rtReset(){try{const rt=sb().realtime;if(rt&&rt.disconnect)rt.disconnect()}catch(e){}}
 /* 저장하지 않는 신호 (입력 중 표시 등): 같은 방의 모두에게 바로 */
 function broadcast(payload){if(!CH)return;try{CH.send({type:'broadcast',event:'ev',payload})}catch(e){}}

 /* ----- 제작기 시트 (읽기) ----- */
 async function makerDocs(kind){
  const out=[];let from=0;const PAGE=1000;
  for(;;){const r=await sb().from(cfg().makerTable||'docs').select('id,data').eq('kind',kind).order('id').range(from,from+PAGE-1);
   /* 10-23 망령: 서버가 한 번에 주는 줄 수(max rows)가 PAGE 보다 적으면 거기서 끊겨 뒤쪽 문서(포켓몬)가 빠졌다 — 빈 쪽이 올 때까지 받은 만큼씩 넘긴다 */
   if(r.error)throw err(r.error);const rows=r.data||[];out.push(...rows);if(!rows.length)break;from+=rows.length}
  return out}
 /* 10-24 망령: since 이후에 바뀐 문서만 (updated_at). 바뀐 게 없으면 빈 줄 하나 — 제작기 DB 자동 반영이 쓴다 */
 async function makerDocsSince(kind,since){const out=[];let from=0;
  for(;;){let q=sb().from(cfg().makerTable||'docs').select('id,data,updated_at').eq('kind',kind);if(since)q=q.gt('updated_at',since);const r=await q.order('updated_at').range(from,from+999);
   if(r.error)throw err(r.error);const rows=r.data||[];out.push(...rows);if(!rows.length)break;from+=rows.length}
  return out}
 /* 트레이너 하나와 그 포켓몬만 (pids + data.tid) — 고를 때 전체를 다시 받지 않게 (10-23 이그레스) */
 async function makerParty(tid){const T=cfg().makerTable||'docs';const t=await sb().from(T).select('id,data').eq('kind','trainers').eq('id',tid);if(t.error)throw err(t.error);const tr=(t.data||[])[0];if(!tr)return {trainer:null,pokemon:[]};
  const d=(tr.data&&tr.data.data)||tr.data||{};const pids=(Array.isArray(d.pids)?d.pids:[]).filter(x=>typeof x==='string'&&x);
  const [a,b]=await Promise.all([pids.length?sb().from(T).select('id,data').eq('kind','pokemon').in('id',pids):{data:[]},sb().from(T).select('id,data').eq('kind','pokemon').eq('data->>tid',tid)]);if(a.error)throw err(a.error);if(b.error)throw err(b.error);
  const m=new Map();for(const x of [...(a.data||[]),...(b.data||[])])m.set(x.id,x);return {trainer:tr,pokemon:[...m.values()]}}


 /* ----- 이미지 올리기 (Storage 버킷 oremas). dataUrl(base64) 또는 Blob → 공개 주소 ----- */
/* 10-26 용량 점검: 올리는 그림은 전부 webp 로 줄인다 (긴 변 2048 · 품질 .86 · 투명 배경 유지). gif · svg 는 그대로. 줄인 게 더 크면 원본 */
async function shrinkUpload(blob,maxSide){try{if(!/^image\/(png|jpe?g|webp|bmp)$/i.test(blob.type||''))return blob;const bmp=await createImageBitmap(blob);const sc=Math.min(1,(maxSide||2048)/Math.max(bmp.width,bmp.height));if(sc>=1&&blob.type==='image/webp')return blob;const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(bmp.width*sc));cv.height=Math.max(1,Math.round(bmp.height*sc));cv.getContext('2d').drawImage(bmp,0,0,cv.width,cv.height);const out=await new Promise(r=>cv.toBlob(r,'image/webp',.86));return out&&out.size<blob.size?out:blob}catch(e){return blob}}
 async function uploadImage(path,src){
  let blob=src;
  if(typeof src==='string'){const r=await fetch(src);blob=await r.blob()}
  blob=await shrinkUpload(blob,2048);   /* 10-26 용량 점검: 스탠딩 · 배경 PNG 원본(2~3MB)이 저장소의 8할이었다 */
  const ext=(blob.type||'').includes('png')?'png':(blob.type||'').includes('webp')?'webp':(blob.type||'').includes('gif')?'gif':'jpg';
  /* 10-23 이그레스: 올릴 때마다 새 이름 → 브라우저가 1년 동안 다시 받지 않아도 된다 */
  const full=path+'_'+Date.now().toString(36)+'.'+ext;
  const r=await sb().storage.from('oremas').upload(full,blob,{upsert:true,contentType:blob.type||'image/jpeg',cacheControl:'31536000'});
  if(r.error){const m=String(r.error.message||r.error);if(/bucket not found|NoSuchBucket/i.test(m))throw new Error('그림 저장소(버킷 oremas)가 아직 없다 — Supabase SQL Editor 에서 supabase/schema.sql 을 다시 실행해 줘');throw err(r.error)}
  return sb().storage.from('oremas').getPublicUrl(full).data.publicUrl}

 /* 10-26 망령: 세션 노트(nt_*) 읽기 — 공개 문서는 표에서, GM 비밀구가 있으면 nt_all 로 전부 */
 async function ntCampUpdate(camp,secret,data){return rpc('nt_camp_update',{p_camp:camp,p_secret:secret,p_name:null,p_data:data})}   /* 10-29: 방 ↔ 세션 노트 캠페인 잇기 (캠페인 data.om.room) */
 async function ntCamps(){const r=await sb().from('nt_camp').select('id,name,data,created_at').order('created_at');if(r.error)throw err(r.error);return r.data||[]}
 async function ntDocs(camp,secret,kinds){if(secret){const rows=await rpc('nt_all',{p_camp:camp,p_secret:secret,p_since:null});return (rows||[]).filter(x=>!kinds||kinds.includes(x.kind))}let q=sb().from('nt_docs').select('kind,id,data,vis').eq('camp',camp);if(kinds)q=q.in('kind',kinds);const r=await q;if(r.error)throw err(r.error);return r.data||[]}
 /* 10-27 망령: 전당 (supabase/patch_2026-10-27_전당.sql) — 방 상태 밖 om_hall 표. 목록은 요약만, 로그는 한 판을 열 때만 */
 const hall={list:(room,before,limit)=>rpc('om_hall_list',{p_room:room,p_before:before||null,p_limit:limit||60}),get:(room,id)=>rpc('om_hall_get',{p_room:room,p_id:id}),
  put:(room,secret,id,head,log)=>rpc('om_hall_put',{p_room:room,p_secret:secret,p_id:id,p_head:head,p_log:log??null}),
  del:(room,secret,id)=>rpc('om_hall_del',{p_room:room,p_secret:secret,p_id:id}),
  cm:(room,secret,id,by,t,del)=>rpc('om_hall_cm',{p_room:room,p_secret:secret,p_id:id,p_by:by||'',p_t:t??null,p_del:del??null}),noFn};
 return {patchesSince,hall,shrinkUpload,ntCamps,ntCampUpdate,ntDocs,rtReset,getStateV,roomsPeek,acct,logClear,broadcast,uploadImage,createRoom,getRoom,whoami,claimSeat,roomUpdate,roomDel,getState,setState,getLog,getLogTail,addLog,whispers,secretPut,secretGet,subscribe,makerDocs,makerDocsSince,makerParty};
})();
