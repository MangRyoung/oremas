/* ---------- 그림 줄이기 (2026-10-30 감우, 망령 「저장소 PNG 를 webp 로」) ----------
   관리자 패널 「방」 탭의 「🗜 그림 줄이기」. 10-26 전에 올린 PNG · JPG 원본(장당 2~3MB)이 방에 들어올 때마다 전송량을 먹는다.
   ① 찾기: 모든 방 상태(getState · 관리자 = GM) + 제작기 문서(trainers · pokemon)에서 저장소(oremas 버킷) 그림 주소 중 webp · gif · svg 가 아닌 것
   ② 줄이기: 받아서 shrinkUpload(긴 변 2048 webp) → slim/… 로 새로 올림. 200KB 보다 작거나, 줄여도 15% 넘게 안 작아지면 그대로
   ③ 바꿔 끼우기: 방은 그 자리(path) 값이 아직 옛 주소일 때만 setState, 제작기 문서는 쓰기 직전에 다시 읽어 옛 주소만 바꿔 upsert
   원본은 지우지 않는다(저장소에 지우기 정책이 없다 · 되돌릴 수 있게). 옛 → 새 주소 표는 JSON 으로 내려받고 이 브라우저(om_slim_last)에도 남긴다 */
"use strict";
window.OM_SLIM=(()=>{
 const A=()=>window.OM_APP,S=()=>window.OM_STORE;
 const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const $=(s,r)=>(r||document).querySelector(s);
 const tok=()=>{try{const a=JSON.parse(localStorage.getItem('om_acct')||sessionStorage.getItem('om_acct')||'null');return (a&&a.token)||''}catch(e){return ''}};
 const MIN=200*1024;
 const heavy=u=>typeof u==='string'&&/\/storage\/v1\/object\/public\/oremas\//.test(u)&&!/\.(webp|gif|svg)(\?|$)/i.test(u);
 const short=u=>String(u).split('/public/oremas/').pop().split('?')[0];
 const mb=n=>(n/1048576).toFixed(n<1048576*10?2:1)+'MB';
 /* 문자열 칸만 훑어 [경로, 주소] */
 function scan(o,path,out){if(typeof o==='string'){if(heavy(o))out.push([path.slice(),o]);return}if(!o||typeof o!=='object')return;
  if(Array.isArray(o)){o.forEach((v,i)=>{path.push(String(i));scan(v,path,out);path.pop()});return}for(const k in o){path.push(k);scan(o[k],path,out);path.pop()}}
 const at=(o,p)=>p.reduce((x,k)=>x==null?x:x[k],o);
 const X={rooms:[],U:new Map(),map:{},busy:false,log:[]};
 const say=t=>{X.log.push(t);const el=$('#slLog');if(el){el.textContent=X.log.slice(-300).join('\n');el.scrollTop=el.scrollHeight}};
 function open(rooms){X.rooms=(rooms||[]).map(r=>({id:r.id,name:r.name||r.id}));X.U=new Map();X.map={};X.log=[];
  const m=A().openModal(`<div class="mhead"><h2>🗜 그림 줄이기</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <p class="small muted" style="margin-top:0">방 ${X.rooms.length}개와 제작기(트레이너 · 포켓몬)에 걸린 PNG · JPG 를 찾아 webp(긴 변 2048)로 줄여 다시 올리고 주소를 바꿔 끼운다. 200KB 보다 작은 그림은 그대로 둔다. 원본은 저장소에 남아 있어서 되돌릴 수 있다(옛 → 새 주소 표를 내려받는다).</p>
   <p class="small muted">돌리는 동안 제작기 창은 닫아 두는 게 좋다 — 제작기가 옛 사본으로 다시 저장하면 옛 주소가 돌아올 수 있다(그때는 한 번 더 돌리면 된다).</p>
   <div class="row" style="gap:6px"><button class="btn sm pri" id="slFind">① 찾기</button><button class="btn sm" id="slGo" disabled>② 줄이고 바꿔 끼우기</button><span class="sp"></span><span class="small muted" id="slSum"></span></div>
   <pre id="slLog" class="sllog" style="margin-top:10px;max-height:46vh;overflow:auto;white-space:pre-wrap;font-size:12px;background:rgba(0,0,0,.35);padding:8px;border:1px solid rgba(255,255,255,.12)"></pre>`);
  m.classList.add('setmodal');
  $('#slFind',m).onclick=()=>find(m);$('#slGo',m).onclick=()=>run(m)}
 async function find(m){if(X.busy)return;X.busy=true;X.U=new Map();X.log=[];const add=(url,use)=>{if(!X.U.has(url))X.U.set(url,{url,uses:[]});X.U.get(url).uses.push(use)};
  try{for(const r of X.rooms){let st=null;try{st=await S().getState(r.id)}catch(e){say(`방 「${r.name}」 읽기 실패: ${e.message}`);continue}
    const out=[];scan((st&&st.data)||{},[],out);out.forEach(([p,u])=>add(u,{t:'room',room:r.id,name:r.name,path:p}));say(`방 「${r.name}」 — ${out.length}곳`)}
   for(const kind of ['trainers','pokemon']){let L=[];try{L=await S().makerDocs(kind)}catch(e){say(`제작기 ${kind} 읽기 실패: ${e.message}`);continue}
    let n=0;for(const d of L){const out=[];scan(d.data,[],out);n+=out.length;for(const [,u] of out)add(u,{t:'mk',kind,id:d.id})}say(`제작기 ${kind} — ${n}곳`)}
   say(`\n줄일 후보 주소 ${X.U.size}개 (크기는 받아 보면서 잰다)`);const s=$('#slSum',m);if(s)s.textContent=`후보 ${X.U.size}개`;$('#slGo',m).disabled=!X.U.size}
  catch(e){say('찾기 실패: '+e.message)}finally{X.busy=false}}
 async function run(m){if(X.busy)return;const t=tok();if(!t)return A().toast('관리자 계정으로 로그인해야 한다');if(!confirm(`후보 ${X.U.size}개를 줄여 다시 올리고, 방 · 제작기의 주소를 새 그림으로 바꾼다. 원본은 남는다. 시작할까?`))return;
  X.busy=true;$('#slGo',m).disabled=true;$('#slFind',m).disabled=true;let before=0,after=0,done=0,skip=0,fail=0;
  try{say('\n— 줄이기 —');
   for(const v of X.U.values()){try{const r=await fetch(v.url,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const b=await r.blob();
     if(b.size<MIN){skip++;continue}
     const sm=await S().shrinkUpload(b,2048);if(!sm||!/webp/.test(sm.type||'')||sm.size>b.size*0.85){skip++;say(`그대로 ${short(v.url)} (${mb(b.size)} — 더 안 줄어든다)`);continue}
     const nu=await S().uploadImage('slim/'+short(v.url).replace(/\.[a-z0-9]+$/i,'').replace(/[^a-zA-Z0-9_\/-]/g,'_'),sm);
     X.map[v.url]=nu;before+=b.size;after+=sm.size;done++;say(`${mb(b.size)} → ${mb(sm.size)}  ${short(v.url)}`)}
    catch(e){fail++;say(`실패 ${short(v.url)}: ${e.message}`)}}
   say(`\n줄인 것 ${done}개 · ${mb(before)} → ${mb(after)} (그대로 ${skip} · 실패 ${fail})`);
   if(done){save();say('\n— 바꿔 끼우기 —');await swap(t)}
   const s=$('#slSum',m);if(s)s.textContent=`${done}개 · ${mb(before)} → ${mb(after)}`;A().toast(done?`그림 ${done}개를 줄였다 — ${mb(before)} → ${mb(after)}`:'줄일 그림이 없다')}
  finally{X.busy=false;$('#slFind',m).disabled=false}}
 /* 방: 그 자리 값이 아직 옛 주소일 때만. 제작기: 쓰기 직전에 다시 읽어 옛 주소 문자열만 바꾼다 */
 async function swap(t){const byRoom=new Map(),byDoc=new Map();
  for(const v of X.U.values()){if(!X.map[v.url])continue;for(const u of v.uses){if(u.t==='room'){if(!byRoom.has(u.room))byRoom.set(u.room,{name:u.name,list:[]});byRoom.get(u.room).list.push([u.path,v.url])}else byDoc.set(u.kind+'/'+u.id,{kind:u.kind,id:u.id})}}
  for(const [room,g] of byRoom){let st=null;try{st=await S().getState(room)}catch(e){say(`방 「${g.name}」 다시 읽기 실패: ${e.message}`);continue}let n=0;
   for(const [p,old] of g.list){if(at((st&&st.data)||{},p)!==old)continue;try{await S().setState(room,'u:'+t,p,X.map[old]);n++}catch(e){say(`방 「${g.name}」 ${p.join('.')} 실패: ${e.message}`)}}
   say(`방 「${g.name}」 ${n}곳 바꿈`)}
  let nd=0;for(const {kind,id} of byDoc.values()){try{const d=await S().makerOne(kind,id);if(!d)continue;let j=JSON.stringify(d.data);const j0=j;
    for(const old in X.map){const a=JSON.stringify(old).slice(1,-1),b=JSON.stringify(X.map[old]).slice(1,-1);if(j.includes(a))j=j.split(a).join(b)}
    if(j!==j0){await S().makerPut(kind,id,JSON.parse(j));nd++}}catch(e){say(`제작기 ${kind}/${id} 실패: ${e.message}`)}}
  say(`제작기 문서 ${nd}장 바꿈\n끝. 옛 → 새 주소 표를 내려받았다 (되돌릴 때 쓴다).`)}
 function save(){const out={at:new Date().toISOString(),map:X.map};try{localStorage.setItem('om_slim_last',JSON.stringify(out))}catch(e){}
  try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,1)],{type:'application/json'}));a.download=`그림줄이기_${out.at.slice(0,10)}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000)}catch(e){}}
 return {open,scan};
})();
