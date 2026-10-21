/* ---------- 오레마스 웹툴 본체 (0단계: 로비 · 방 · 좌석 · 실시간 상태 · 채팅 · 파티 불러오기) ---------- */
"use strict";
(()=>{
const ST={room:null,roomRow:null,state:{},v:0,role:null,secret:'',seat:'',name:'',log:[],lastLogId:0,unsub:null,wtimer:null,lastWhisper:0};
const S=()=>window.OM_STATS, I=()=>window.OM_IMPORT, DBS=()=>window.OM_STORE;
const $=(s,r)=>(r||document).querySelector(s);
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const rnd=n=>{const a=new Uint8Array(n||18);crypto.getRandomValues(a);return Array.from(a,b=>'abcdefghijklmnopqrstuvwxyz0123456789'[b%36]).join('')};
const LS={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
/* 계정 로그인 (2026-10-23): 로그인 표(token)는 「로그인 유지」면 localStorage, 아니면 sessionStorage(창을 닫으면 로그아웃). 방에서는 비밀값 자리에 'u:'+token */
const ACCT={get(){try{return JSON.parse(localStorage.getItem('om_acct')||sessionStorage.getItem('om_acct')||'null')}catch(e){return null}},
 kept(){try{return !!localStorage.getItem('om_acct')}catch(e){return false}},
 set(a,keep){try{localStorage.removeItem('om_acct');sessionStorage.removeItem('om_acct');if(a)(keep?localStorage:sessionStorage).setItem('om_acct',JSON.stringify(a))}catch(e){}},
 tok(){const a=ACCT.get();return (a&&a.token)||''}};
const acctErr=e=>{const m=String((e&&e.message)||e||'');return /om_(login|signup|me|admin|room_new|logout)|Could not find the function|PGRST202|schema cache/i.test(m)?'서버에 계정 기능이 아직 없다 — Supabase SQL Editor 에서 supabase/patch_2026-10-23_계정.sql 을 실행해 줘':m};
/* 알림 (이 브라우저에서만): 채팅 소리 · 문자 소리 · 입력 중 표시 — 방 설정에서 켜고 끈다 */
const ALARM_KEY='om_alarm';function alarm(){const d={chat:1,sms:1,typing:1};try{return Object.assign(d,JSON.parse(localStorage.getItem(ALARM_KEY)||'{}'))}catch(e){return d}}
function setAlarm(k,v){const a=alarm();a[k]=v?1:0;try{localStorage.setItem(ALARM_KEY,JSON.stringify(a))}catch(e){}if(!a.typing&&window.OM_RP_UI&&window.OM_RP_UI.drawTyping)window.OM_RP_UI.drawTyping()}
const isMineLog=r=>{const d=(r&&r.data)||{};return d.from===(ST.role==='gm'?'gm':ST.seat)};
let titleT=null;function flashTitle(msg){if(!document.hidden)return;const base=document.title.replace(/^\(.*?\) /,'');document.title=`(${msg}) ${base}`;clearTimeout(titleT);const back=()=>{document.title=base;document.removeEventListener('visibilitychange',back)};document.addEventListener('visibilitychange',back);titleT=setTimeout(back,60000)}
function notifyLog(r){if(!r||r.kind!=='chat'||!r.data||r.data.sms||!(r.data.t))return;if(isMineLog(r))return;if(r.at&&Date.now()-new Date(r.at).getTime()>15000)return;if(!alarm().chat)return;try{if(window.OM_PREFS)window.OM_PREFS.notify('chat');else if(window.OM_RP_UI)window.OM_RP_UI.playSe('Ping',true)}catch(e){}flashTitle('새 메시지')}   /* 부드러운 알림음 · 화면을 보고 있으면 울리지 않는다 (내 설정) */
let toastT=null;function toast(m){if(window.OM_REPORT_UI)window.OM_REPORT_UI.note('toast',m);const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),2400)}
function fmtTime(s){const d=new Date(s);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}
function contactOf(mv){const c=mv&&mv.contact;if(c==='O'||c==='X')return c;const d=((window.OM_DB||{}).moves||{})[mv&&mv.name];return d&&d.contact||'-'}
function typeChip(en){const c=S().typeColor(en);return `<span class="type" style="background:${c.bg};color:${c.fg}">${esc(S().typeKo(en))}</span>`}

/* ---------- 라우팅 ---------- */
function params(){const h=location.hash.replace(/^#/,'');const o={};h.split('&').forEach(kv=>{const [k,v]=kv.split('=');if(k)o[decodeURIComponent(k)]=decodeURIComponent(v||'')});return o}
function roomLink(id){return location.origin+location.pathname+'#r='+id}
function gmLink(id,sec){return roomLink(id)+'&gm='+sec}
window.addEventListener('hashchange',()=>route());
async function route(){
 const p=params();
 if(ST.unsub){ST.unsub();ST.unsub=null}clearInterval(ST.wtimer);
 if(!p.r){if(p.lobby!=null)renderLobby();else if(ACCT.tok())renderHome();else renderLogin();return}
 await openRoom(p.r,p.pl?'':(p.gm||''),!!p.pl)}

/* ---------- 로그인 · 내 계정 홈 · 계정 관리 ---------- */
function renderLogin(msg,o){
 o=o||{};const app=$('#app');let mode='in';
 const draw=()=>{app.innerHTML=`<div class="lobby">
  <div class="brand">오레마스 <small>망켓몬 배틀 · 세션 툴</small></div>
  <div class="card login"><div class="lgtabs"><button type="button" data-lm="in" class="${mode==='in'?'on':''}">로그인</button><button type="button" data-lm="up" class="${mode==='up'?'on':''}">가입</button></div>
   ${msg?`<p class="lgmsg">${esc(msg)}</p>`:''}
   <form id="lgForm" autocomplete="on">
   <label class="lgf"><span>아이디</span><input type="text" id="lgId" name="username" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="영문 소문자 · 숫자 3~20자"></label>
   ${mode==='up'?'<label class="lgf"><span>이름</span><input type="text" id="lgName" placeholder="방에서 보일 이름 (나중에 바꿀 수 있다)"></label>':''}
   <label class="lgf"><span>비밀번호</span><input type="password" id="lgPw" name="password" autocomplete="${mode==='up'?'new-password':'current-password'}" placeholder="4자 이상"></label>
   ${mode==='up'?'<label class="lgf"><span>비밀번호 확인</span><input type="password" id="lgPw2" autocomplete="new-password"></label>':''}
   <label class="lgkeep"><input type="checkbox" id="lgKeep" ${LS.get('om_keep',true)?'checked':''}> 이 기기에서 로그인 유지</label>
   <button class="btn pri lgok" id="lgOk" type="submit">${mode==='up'?'가입하고 들어가기':'로그인'}</button></form>
   <p class="small muted">${mode==='up'?'처음 가입한 계정이 관리자가 된다. 관리자는 계정 목록을 보고 방마다 GM · PL 권한을 준다.':'공용 PC 라면 「로그인 유지」를 끄고 들어가자 — 창을 닫으면 로그아웃된다.'}</p></div>
  ${o.room?(o.noGuest?'':`<p class="hint"><a href="#" id="lgGuest">로그인 없이 이 방으로 (예전 방식)</a></p>`):'<p class="hint"><a href="#lobby">예전 방식(방 링크 · GM 링크)으로 들어가기</a></p>'}
 </div>`;
  app.querySelectorAll('[data-lm]').forEach(b=>b.onclick=()=>{mode=b.dataset.lm;draw()});
  const g=$('#lgGuest');if(g)g.onclick=e=>{e.preventDefault();try{sessionStorage.setItem('om_guest_'+o.room,'1')}catch(x){}route()};
  $('#lgForm').onsubmit=async e=>{e.preventDefault();const id=$('#lgId').value.trim().toLowerCase(),pw=$('#lgPw').value,keep=$('#lgKeep').checked;LS.set('om_keep',keep);
   if(!id||!pw)return toast('아이디와 비밀번호를 적어 줘');
   const bt=$('#lgOk');bt.disabled=true;
   try{if(mode==='up'){if(pw!==$('#lgPw2').value){bt.disabled=false;return toast('비밀번호 확인이 다르다')}await DBS().acct.signup(id,pw,$('#lgName').value.trim()||id)}
    const dev=((navigator.userAgentData&&navigator.userAgentData.platform)||navigator.platform||'')+' · '+(/Mobi/i.test(navigator.userAgent)?'모바일':'PC');
    const token=await DBS().acct.login(id,pw,dev);if(!token){bt.disabled=false;return toast('아이디나 비밀번호가 맞지 않는다')}
    let me=null;try{me=await DBS().acct.me(token)}catch(x){}
    ACCT.set({token,uid:id,name:(me&&me.name)||id,admin:!!(me&&me.admin)},keep);toast(`${(me&&me.name)||id} 로 로그인했다`);route()}
   catch(x){bt.disabled=false;toast(acctErr(x))}}};
 draw()}
async function renderHome(){
 const app=$('#app');app.innerHTML='<div class="lobby muted">내 계정을 불러오는 중…</div>';
 const a=ACCT.get();let me;
 try{me=await DBS().acct.me(a.token)}catch(e){app.innerHTML=`<div class="lobby"><p>계정 정보를 읽지 못했다: ${esc(acctErr(e))}</p><p><a href="#lobby">예전 방식으로 들어가기</a> · <a href="#" id="hmOut">로그아웃</a></p></div>`;$('#hmOut').onclick=e=>{e.preventDefault();ACCT.set(null);route()};return}
 if(!me){ACCT.set(null);return renderLogin('로그인이 끝났다 (30일 동안 안 들어왔거나 비밀번호가 바뀌었다) — 다시 로그인해 줘')}
 ACCT.set(Object.assign(a,{uid:me.uid,name:me.name,admin:!!me.admin}),ACCT.kept());
 const rooms=me.rooms||[],mine=LS.get('om_rooms',[]).filter(r=>!rooms.some(x=>x.id===r.id));
 app.innerHTML=`<div class="lobby">
  <div class="brand">오레마스 <small>망켓몬 배틀 · 세션 툴</small></div>
  <div class="card acct"><div class="row"><b class="anm">${esc(me.name)}</b><span class="mono small muted">@${esc(me.uid)}</span>${me.admin?'<span class="badge gm">관리자</span>':''}<span class="sp"></span>${me.admin?'<button class="btn sm pri" id="hmAdmin">계정 관리</button>':''}<button class="btn sm" id="hmMe">내 계정</button><button class="btn sm ghost" id="hmOut">로그아웃</button></div>
   <p class="small muted">${ACCT.kept()?'이 기기에서 로그인 유지 중 (30일 동안 안 들어오면 끝난다)':'창을 닫으면 로그아웃된다'}</p></div>
  <div class="card"><h2>내 방</h2>${rooms.length?`<ul class="rooms">${rooms.map(r=>`<li><b>${esc(r.name||r.id)}</b><span class="badge ${r.role==='gm'?'gm':'seat'}">${r.role==='gm'?'GM':'PL'}</span>${r.role==='pl'&&!r.seat?'<span class="small muted">자리 아직</span>':''}<span class="sp"></span>${r.role==='gm'?`<button class="btn sm ghost rmb" data-rmren="${esc(r.id)}" title="방 이름 바꾸기">✎</button><button class="btn sm ghost rmb" data-rmkill="${esc(r.id)}" title="방 지우기">🗑</button>`:''}<a class="btn sm pri" href="#r=${esc(r.id)}">들어가기</a></li>`).join('')}</ul>`:'<div class="empty">아직 권한이 있는 방이 없다. 방 링크로 들어가 자리에 앉거나, 관리자에게 방 권한을 받으면 여기 생긴다.</div>'}</div>
  <div class="card"><h2>방 만들기 (GM)</h2>
   <div class="row"><input type="text" id="newName" placeholder="방 이름 (예: 무진)" style="flex:1"><button class="btn pri" id="mk">만들기</button></div>
   <p class="small muted">만든 계정이 그 방의 GM 이 된다. 플레이어에게는 방 링크만 주면 된다 — 들어와서 로그인하고 자리에 앉는다.</p></div>
  <div class="card"><h2>방 들어가기</h2>
   <div class="row"><input type="text" id="joinId" placeholder="방 링크 또는 방 id" style="flex:1"><button class="btn" id="join">입장</button></div></div>
  ${mine.length?recent(mine).replace('<h2>최근 방</h2>','<h2>이 기기의 최근 방 <small class="muted">(예전 링크)</small></h2>'):''}
 </div>`;
 $('#hmOut').onclick=async e=>{e.preventDefault();if(!confirm('이 기기에서 로그아웃할까?'))return;try{await DBS().acct.logout(a.token)}catch(x){}ACCT.set(null);route()};
 $('#hmMe').onclick=()=>openMe(me);const ad=$('#hmAdmin');if(ad)ad.onclick=()=>openAdmin();
 app.querySelectorAll('[data-rmdel]').forEach(b=>b.onclick=e=>{e.preventDefault();const id=b.dataset.rmdel;if(!confirm('이 기기의 최근 방 목록에서 뺄까? (방은 그대로 있다)'))return;LS.set('om_rooms',LS.get('om_rooms',[]).filter(r=>r.id!==id));renderHome()});
 /* 10-24 망령: 내 방 이름 바꾸기 · 지우기 (GM 인 방만) — 이름은 om_room_update, 지우기는 om_room_del */
 const rmOf=id=>rooms.find(r=>r.id===id)||{};
 app.querySelectorAll('[data-rmren]').forEach(b=>b.onclick=async()=>{const r=rmOf(b.dataset.rmren);const n=prompt('새 방 이름',r.name||'');if(n==null)return;const nm=n.trim();if(!nm)return toast('이름을 적어 줘');if(nm===r.name)return;
  try{await DBS().roomUpdate(r.id,'u:'+a.token,nm,null);toast('방 이름을 바꿨다');renderHome()}catch(e){toast('이름을 못 바꿨다: '+acctErr(e))}});
 app.querySelectorAll('[data-rmkill]').forEach(b=>b.onclick=async()=>{const r=rmOf(b.dataset.rmkill);const nm=r.name||r.id;
  const typed=prompt(`「${nm}」 방을 지운다. 대화 기록 · 배틀 · 시트 · 좌석이 모두 사라지고 되돌릴 수 없다.\n지우려면 방 이름을 그대로 적어 줘.`,'');if(typed==null)return;if(typed.trim()!==nm)return toast('방 이름이 달라서 안 지웠다');
  try{await DBS().roomDel(r.id,'u:'+a.token);LS.set('om_rooms',LS.get('om_rooms',[]).filter(x=>x.id!==r.id));toast(`「${nm}」 방을 지웠다`);renderHome()}
  catch(e){const raw=String((e&&e.message)||e||'');toast(/om_room_del|PGRST202|Could not find the function|schema cache/i.test(raw)?'서버에 방 지우기 함수가 아직 없다 — supabase/patch_2026-10-24_방삭제.sql 을 SQL Editor 에서 실행해 줘':'못 지웠다: '+acctErr(e))}});
 $('#mk').onclick=async()=>{const name=$('#newName').value.trim()||'새 방';try{const id=await DBS().acct.roomNew(a.token,name);location.hash='r='+id}catch(e){toast('방을 만들지 못했다: '+acctErr(e))}};
 $('#join').onclick=()=>{const v=$('#joinId').value.trim();const m=v.match(/#?r=([a-z0-9]+)(?:&gm=([a-z0-9]+))?/)||[null,v];if(!m[1])return toast('방 id 를 넣어 줘');location.hash='r='+m[1]+(m[2]?'&gm='+m[2]:'')}}
function openMe(me){
 const a=ACCT.get();
 const m=openModal(`<div class="mhead"><h2>내 계정</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
  <div class="pf"><section class="pf-card"><header><i>👤</i><b>이름</b><small>방에 들어갔을 때 기본 이름</small></header><div class="pf-sel"><input type="text" id="meName" value="${esc(me.name)}"><button class="btn xs pri" id="meNameOk">저장</button></div><div class="pf-note">아이디 <span class="mono">${esc(me.uid)}</span> 는 바꿀 수 없다</div></section>
  <section class="pf-card"><header><i>🔑</i><b>비밀번호 바꾸기</b><small>바꾸면 다른 기기의 로그인은 끊긴다</small></header>
   <label class="lgf"><span>지금 비밀번호</span><input type="password" id="meOld" autocomplete="current-password"></label><label class="lgf"><span>새 비밀번호</span><input type="password" id="meNew" autocomplete="new-password"></label><label class="lgf"><span>새 비밀번호 확인</span><input type="password" id="meNew2" autocomplete="new-password"></label>
   <button class="btn sm pri" id="mePwOk">바꾸기</button></section></div>`);
 $('#meNameOk',m).onclick=async()=>{const n=$('#meName',m).value.trim();if(!n)return toast('이름을 적어 줘');try{await DBS().acct.meUpdate(a.token,n,null,null);closeModal();toast('이름을 바꿨다');renderHome()}catch(e){toast(acctErr(e))}};
 $('#mePwOk',m).onclick=async()=>{const o=$('#meOld',m).value,n=$('#meNew',m).value;if(n!==$('#meNew2',m).value)return toast('새 비밀번호 확인이 다르다');if(n.length<4)return toast('비밀번호는 4자 이상');try{await DBS().acct.meUpdate(a.token,null,o,n);closeModal();toast('비밀번호를 바꿨다')}catch(e){toast(acctErr(e))}}}
/* 관리자: 계정 목록 · 방마다 GM/PL 권한 · 관리자 · 비밀번호 초기화 · 지우기 · 방의 「계정 전용」 */
let ADM={sel:'',tab:'users'};
async function openAdmin(){
 const t=ACCT.tok();let d;try{d=await DBS().acct.adminList(t)}catch(e){return toast(acctErr(e))}
 const users=d.users||[],rooms=d.rooms||[],me=(ACCT.get()||{}).uid;if(!users.some(u=>u.uid===ADM.sel))ADM.sel=(users[0]||{}).uid||'';
 const u=users.find(x=>x.uid===ADM.sel);const roleOf=rid=>((u&&u.rooms)||[]).find(x=>x.room===rid)||null;
 const when=s=>s?ago(new Date(s).getTime()):'—';
 const m=openModal(`<div class="mhead"><h2>계정 관리</h2><span class="small muted">${users.length}명 · 방 ${rooms.length}개</span><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
  <div class="pf-tabs"><button data-atab="users" class="${ADM.tab==='users'?'on':''}"><span>계정 · 권한</span></button><button data-atab="rooms" class="${ADM.tab==='rooms'?'on':''}"><span>방</span></button></div>
  ${ADM.tab==='users'?`<div class="adm"><ul class="admu">${users.map(x=>`<li data-u="${esc(x.uid)}" class="${x.uid===ADM.sel?'on':''}"><b>${esc(x.name)}</b><span class="mono small muted">@${esc(x.uid)}</span>${x.admin?'<span class="badge gm">관리자</span>':''}<span class="sp"></span><span class="admr">${(x.rooms||[]).map(r=>`<span class="badge ${r.role==='gm'?'gm':'seat'}">${esc(r.name||r.room)} ${r.role==='gm'?'GM':'PL'}</span>`).join('')}</span><span class="when">${esc(when(x.last_at))}</span></li>`).join('')}</ul>
   ${u?`<div class="adme"><div class="row"><b>${esc(u.name)}</b><span class="mono small muted">@${esc(u.uid)} · 가입 ${esc(when(u.created_at))}</span><span class="sp"></span>
     <label class="lgkeep"><input type="checkbox" id="admAdm" ${u.admin?'checked':''} ${u.uid===me?'disabled title="자기 관리자 권한은 뺄 수 없다"':''}> 관리자</label></div>
    <table class="admt"><thead><tr><th>방</th><th>권한</th><th>자리</th></tr></thead><tbody>${rooms.map(r=>{const x=roleOf(r.id);return `<tr><td>${esc(r.name||r.id)}${r.accountOnly?' <span class="badge">계정 전용</span>':''}</td><td><select data-arole="${esc(r.id)}"><option value="">없음${u.admin?' (관리자라 GM)':''}</option><option value="gm" ${x&&x.role==='gm'?'selected':''}>GM</option><option value="pl" ${x&&x.role==='pl'?'selected':''}>PL</option></select></td><td class="small muted">${x&&x.role==='pl'?(x.seat?esc(x.seat):'아직'):''}</td></tr>`}).join('')||'<tr><td colspan="3" class="muted">방이 없다</td></tr>'}</tbody></table>
    <div class="pf-note">PL 권한만 주면 그 사람이 방에 들어와 자리를 고른다. 자리를 옮기게 하려면 방의 「자리 관리」에서 비운다.</div>
    <div class="row" style="margin-top:10px"><button class="btn sm" id="admPw">비밀번호 초기화</button>${u.uid===me?'':'<button class="btn sm ghost danger" id="admDel">계정 지우기</button>'}</div></div>`:'<div class="empty">아직 계정이 없다</div>'}</div>`
  :`<div class="adm"><table class="admt"><thead><tr><th>방</th><th>계정 전용</th><th></th></tr></thead><tbody>${rooms.map(r=>`<tr><td><b>${esc(r.name||r.id)}</b> <span class="mono small muted">${esc(r.id)}</span></td><td><label class="lgkeep"><input type="checkbox" data-aonly="${esc(r.id)}" ${r.accountOnly?'checked':''}> 로그인해야 들어간다</label></td><td><a class="btn xs" href="#r=${esc(r.id)}">들어가기</a></td></tr>`).join('')}</tbody></table>
   <div class="pf-note">「계정 전용」을 켜면 로그인해야 들어오고, 「계정 · 권한」에서 PL 을 준 계정만 자리에 앉는다. 예전 방 링크 · GM 링크 · 이 기기에 기억된 자리로는 권한이 안 생긴다 (관리자는 언제나 GM). 끈 방은 로그인한 누구나 앉을 수 있다.</div></div>`}`);
 m.classList.add('setmodal');
 m.querySelectorAll('[data-atab]').forEach(b=>b.onclick=()=>{ADM.tab=b.dataset.atab;openAdmin()});
 m.querySelectorAll('[data-u]').forEach(li=>li.onclick=()=>{ADM.sel=li.dataset.u;openAdmin()});
 const run=async(f,ok)=>{try{await f();if(ok)toast(ok)}catch(e){toast(acctErr(e))}openAdmin()};
 m.querySelectorAll('[data-arole]').forEach(s=>s.onchange=()=>run(()=>DBS().acct.adminMember(t,u.uid,s.dataset.arole,s.value||null,null),`${u.name} — ${s.selectedOptions[0].textContent}`));
 const aa=$('#admAdm',m);if(aa)aa.onchange=()=>run(()=>DBS().acct.adminUser(t,u.uid,{admin:aa.checked}),aa.checked?`${u.name} 에게 관리자를 줬다`:`${u.name} 의 관리자를 뺐다`);
 const ap=$('#admPw',m);if(ap)ap.onclick=()=>{const pw=prompt(`${u.name} (@${u.uid}) 의 새 비밀번호 (4자 이상) — 그 계정의 모든 기기 로그인이 끊긴다`);if(pw==null)return;if(pw.length<4)return toast('비밀번호는 4자 이상');run(()=>DBS().acct.adminUser(t,u.uid,{pw}),'비밀번호를 바꿨다 — 본인에게 알려 줘')};
 const ad=$('#admDel',m);if(ad)ad.onclick=()=>{if(!confirm(`${u.name} (@${u.uid}) 계정을 지울까? 방 권한도 같이 사라진다 (방에 남은 트레이너 · 로그는 그대로).`))return;ADM.sel='';run(()=>DBS().acct.adminUser(t,u.uid,{del:true}),'계정을 지웠다')};
 m.querySelectorAll('[data-aonly]').forEach(c=>c.onchange=()=>run(async()=>{const row=await DBS().getRoom(c.dataset.aonly);const s=Object.assign({},(row&&row.settings)||{},{accountOnly:c.checked});await DBS().roomUpdate(c.dataset.aonly,'u:'+t,null,s)},c.checked?'계정 전용으로 바꿨다':'예전 링크도 다시 된다'))}

/* ---------- 로비 ---------- */
function renderLobby(){
 const app=$('#app');const mine=LS.get('om_rooms',[]);
 app.innerHTML=`<div class="lobby">
  <div class="brand">오레마스 <small>망켓몬 배틀 · 세션 툴</small></div>
  <div class="card lbnick"><h2>내 닉네임</h2><div class="row"><input type="text" id="lbNick" value="${esc(LS.get('om_nick',''))}" placeholder="접속자 칸 · 입력 중 표시에 보일 이름" style="flex:1"><button class="btn" id="lbNickOk">저장</button></div>
   <p class="small muted">GM 으로 들어가면 「GM · 닉」, PL 로 들어가면 이 닉으로 자리에 앉는다. GM 링크를 가진 사람이 여럿이면 다 같이 GM 으로 들어와도 된다 — 닉으로 구분된다.</p></div>
  ${recent(mine)}
  <div class="card"><h2>방 만들기 (GM)</h2>
   <div class="row"><input type="text" id="newName" placeholder="방 이름 (예: 무진)" style="flex:1"><button class="btn pri" id="mk">만들기</button></div>
   <p class="small muted">방을 만들면 플레이어용 링크와 GM용 링크가 나온다. GM 링크는 아무에게도 주지 말 것.</p></div>
  <div class="card"><h2>방 들어가기</h2>
   <div class="row"><input type="text" id="joinId" placeholder="방 링크 또는 방 id" style="flex:1"><button class="btn" id="join">입장</button></div></div>
  ${mine.length?'':'<p class="hint">들어간 방은 이 기기에 기억해 두고 맨 위에 「최근 방」으로 보여 준다.</p>'}
  <p class="hint"><a href="#">← 계정으로 로그인</a></p>
 </div>`;
 {const ni=$('#lbNick'),save=()=>{LS.set('om_nick',ni.value.trim());toast(ni.value.trim()?`닉네임: ${ni.value.trim()}`:'닉네임을 비웠다')};$('#lbNickOk').onclick=save;ni.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing)save()}}
 app.querySelectorAll('[data-rmdel]').forEach(b=>b.onclick=e=>{e.preventDefault();const id=b.dataset.rmdel;if(!confirm('이 기기의 최근 방 목록에서 뺄까? (방은 그대로 있다)'))return;LS.set('om_rooms',LS.get('om_rooms',[]).filter(r=>r.id!==id));renderLobby()});
 $('#mk').onclick=async()=>{const name=$('#newName').value.trim()||'새 방';const sec=rnd(24);
  try{const id=await DBS().createRoom(name,sec);remember(id,name,sec);location.hash='r='+id+'&gm='+sec}catch(e){toast('방을 만들지 못했다: '+e.message)}};
 $('#join').onclick=()=>{const v=$('#joinId').value.trim();const m=v.match(/#?r=([a-z0-9]+)(?:&gm=([a-z0-9]+))?/)||[null,v];if(!m[1])return toast('방 id 를 넣어 줘');location.hash='r='+m[1]+(m[2]?'&gm='+m[2]:'')}}
function remember(id,name,gm){const L=LS.get('om_rooms',[]).filter(r=>r.id!==id);L.unshift({id,name,gm:gm||(LS.get('om_rooms',[]).find(r=>r.id===id)||{}).gm||'',at:Date.now()});LS.set('om_rooms',L.slice(0,20))}
/* 로비 맨 위: 최근 들어간 방 (이 기기에만 기억) */
function ago(t){if(!t)return '';const m=Math.floor((Date.now()-t)/60000);if(m<1)return '방금';if(m<60)return m+'분 전';const h=Math.floor(m/60);if(h<24)return h+'시간 전';const d=Math.floor(h/24);return d<7?d+'일 전':new Date(t).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'})}
function recent(mine){if(!mine.length)return '';return `<div class="card"><h2>최근 방</h2><ul class="rooms">${mine.map(r=>`<li><b>${esc(r.name||r.id)}</b>${r.at?`<span class="when">${esc(ago(r.at))}</span>`:''}<span class="sp"></span>${r.gm?`<a class="btn sm ${r===mine[0]?'pri':''}" href="${esc(gmLink(r.id,r.gm))}" title="GM 권한으로 들어간다">GM 으로</a><a class="btn sm ghost" href="${esc(roomLink(r.id)+'&pl=1')}" title="GM 링크가 있어도 플레이어로 — 자리에 앉아 PL 닉으로 논다">PL 로</a>`:`<a class="btn sm ${r===mine[0]?'pri':''}" href="${esc(roomLink(r.id))}">들어가기</a>`}<button class="rmdel" type="button" data-rmdel="${esc(r.id)}" title="목록에서 빼기" aria-label="목록에서 빼기">✕</button></li>`).join('')}</ul></div>`}

/* ---------- 방 ---------- */
async function openRoom(id,gm,asPl){
 const app=$('#app');app.innerHTML='<div class="lobby muted">방에 들어가는 중…</div>';
 let row;try{row=await DBS().getRoom(id)}catch(e){app.innerHTML=`<div class="lobby">방을 읽지 못했다: ${esc(e.message)}<br><a href="#">로비로</a></div>`;return}
 if(!row){app.innerHTML='<div class="lobby">그런 방이 없다. <a href="#">로비로</a></div>';return}
 ST.room=id;ST.roomRow=row;ST._sub=false;if(window.OM_BATTLE_UI)window.OM_BATTLE_UI.resetLocal();ST.role=null;ST.secret='';ST.seat='';ST.name='';
 const seatInfo=LS.get('om_seat_'+id,null);const tok=ACCT.tok();
 /* 계정으로: 방 권한(GM · PL 자리)을 서버가 정한다. 「PL 로」(asPl) 는 예전 방식으로 */
 if(!gm&&tok&&!asPl){let w=null;try{await DBS().acct.join(tok,id)}catch(e){}/* 10-24 망령: 로그인해서 들어오면 기본 PL 권한 (patch_2026-10-24_PL기본.sql) */try{w=await DBS().whoami(id,'u:'+tok)}catch(e){}
  if(w==='gm'){ST.role='gm';ST.secret='u:'+tok;ST.name='GM';ST.gmNick=LS.get('om_gmnick_'+id,'')||(ACCT.get()||{}).name||LS.get('om_nick','')||'';remember(id,row.name,'')}
  else if(w){ST.role='seat';ST.secret='u:'+tok;ST.seat=w;ST.name=LS.get('om_name_'+id,'')||(ACCT.get()||{}).name||w}}
 if(gm){const w=await DBS().whoami(id,gm);if(w==='gm'){ST.role='gm';ST.secret=gm;ST.name='GM';ST.gmNick=LS.get('om_gmnick_'+id,'')||LS.get('om_nick','')||'';remember(id,row.name,gm)}else toast('GM 비밀값이 맞지 않는다')}
 if(!ST.role&&seatInfo&&seatInfo.secret){const w=await DBS().whoami(id,seatInfo.secret);if(w&&w!=='gm'){ST.role='seat';ST.secret=seatInfo.secret;ST.seat=w;ST.name=seatInfo.name||w}}
 if(!ST.role&&!tok&&!gm){const only=!!((row.settings||{}).accountOnly);let guest=false;try{guest=!!sessionStorage.getItem('om_guest_'+id)}catch(e){}
  if(only||!guest){renderLogin(only?`「${row.name||id}」 은 계정 전용 방이다 — 로그인해야 들어갈 수 있다`:`「${row.name||id}」 에 들어가려면 로그인`,{room:id,noGuest:only});return}}
 if(!ST.role){remember(id,row.name,'');ST.name=LS.get('om_name_'+id,'')||(tok&&!asPl&&(ACCT.get()||{}).name)||LS.get('om_nick','')||''}
 const st=await DBS().getState(id);ST.state=(st&&st.data)||{};ST.v=(st&&st.v)||0;
 /* GM 이 방을 열면 좌석이 쓸 상자(roster · pub · graph · skill · dex)를 먼저 만들어 둔다 — 서버의 jsonb_set 은 부모가 없으면 조용히 실패하니까 */
 if(ST.role==='gm'){const need={roster:{trainers:{},mons:{}},pub:{},ready:{},graph:{nodes:{},edges:{}},skill:{},dex:{},rp:{},battle:{}};for(const k in need){if(typeof ST.state[k]!=='object'||ST.state[k]===null){try{const v=await DBS().setState(id,ST.secret,[k],need[k]);ST.state[k]=need[k];ST.v=Math.max(ST.v,v||0)}catch(e){}}else if(k==='roster'){for(const kk of ['trainers','mons'])if(typeof ST.state.roster[kk]!=='object'||ST.state.roster[kk]===null){try{const v=await DBS().setState(id,ST.secret,['roster',kk],{});ST.state.roster[kk]={};ST.v=Math.max(ST.v,v||0)}catch(e){}}}}}
 ST.log=await DBS().getLogTail(id,200);ST.lastLogId=ST.log.length?ST.log[ST.log.length-1].id:0;
 CHAN.cur='s';ST._toBottom=true;renderRoom();
 ST.unsub=DBS().subscribe(id,{onEvent:p=>{if(p&&p.t==='hello')onHello(p);if(window.OM_RP_UI&&p&&p.t==='typing')window.OM_RP_UI.onTyping(p);if(window.OM_CUTIN&&p&&p.t==='cutin')window.OM_CUTIN.onEvent(p)},onState:(d,v)=>{if(v>=ST.v){ST.state=d;ST.v=v;renderScene();if(window.OM_BATTLE_UI&&window.OM_BATTLE_UI.watch)window.OM_BATTLE_UI.watch().catch(e=>console.warn(e))}},onLog:r=>{if(r.id>ST.lastLogId){ST.log.push(r);ST.lastLogId=r.id;renderLog(true);notifyLog(r);mobNote(r);if(window.OM_RP_UI)window.OM_RP_UI.onChat(r)}},
  onStatus:s=>{const el=$('#conn');if(el){el.textContent=s==='SUBSCRIBED'?'● 실시간':'○ '+s;el.style.color=s==='SUBSCRIBED'?'var(--acc2)':'var(--mute)'}if(s==='SUBSCRIBED'){startPresence();if(ST._sub)resync('재연결');ST._sub=true}}});
 if(ST.role){pollWhispers();ST.wtimer=setInterval(pollWhispers,4000)}
 if(!ST.role)openSeatPicker()}

/* 실시간이 끊겼다 다시 붙거나(노트북 절전 · 폰 백그라운드) 창이 다시 보이면, 그사이 놓친 로그와 상태를 다시 읽는다 (점검 3-9) */
let RESYNC=null;
function resync(why){if(!ST.room)return Promise.resolve();if(RESYNC)return RESYNC;const room=ST.room;
 RESYNC=(async()=>{try{
  const fresh=[];for(let i=0;i<20;i++){const rows=await DBS().getLog(room,ST.lastLogId,500);if(ST.room!==room)return;
   for(const r of rows)if(r.id>ST.lastLogId){ST.log.push(r);ST.lastLogId=r.id;fresh.push(r)}
   if(rows.length<500)break}
  const got=fresh.length;
  if(got){renderLog(true);
   /* 놓친 줄은 무대 기록에만 넣고, 무대 자막·효과음은 마지막 한 줄만 (한꺼번에 울리지 않게) */
   const R=window.OM_RP_UI;if(R){if(got>1&&R.feedLog)R.feedLog(fresh.slice(0,-1));R.onChat(fresh[got-1])}}
  const st=await DBS().getState(room);if(ST.room!==room)return;
  const newer=!!(st&&(st.v||0)>ST.v);if(newer){ST.state=st.data||{};ST.v=st.v;renderScene();if(window.OM_BATTLE_UI&&window.OM_BATTLE_UI.watch)window.OM_BATTLE_UI.watch().catch(e=>console.warn(e))}
  if(ST.role)pollWhispers();
  if(got||newer)console.info('[오레마스] 다시 맞춤',why,got+'줄')}
 catch(e){console.warn('[오레마스] 다시 맞추기 실패',e)}finally{RESYNC=null}})();return RESYNC}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&ST.room)resync('다시 보임')});
window.addEventListener('online',()=>{if(ST.room)resync('온라인')});

async function pollWhispers(){try{const ws=await DBS().whispers(ST.room,ST.secret,ST.lastWhisper);if(!ws||!ws.length)return;ws.forEach(w=>{ST.lastWhisper=Math.max(ST.lastWhisper,w.id);if(!ST.log.find(x=>x.id===w.id))ST.log.push(w)});ST.log.sort((a,b)=>a.id-b.id);renderLog(true)}catch(e){}}

/* ---------- 보기 설정: 글씨 크기·채팅/대사 글씨·폰트 (브라우저마다) ---------- */
const UI_FONTS=[['plex','IBM Plex Sans KR (기본)'],['noto','Noto Sans KR'],['nanum','나눔고딕'],['gothica1','Gothic A1'],['gowun','고운돋움'],['pretendard','Pretendard'],['myeongjo','나눔명조'],['system','시스템 기본']];
const UI_HEADS=[['bhs','Black Han Sans (기본)'],['dohyeon','Do Hyeon'],['jua','주아'],['gugi','구기'],['same','본문과 같게']];
const UI_FONT_CSS={plex:"'IBM Plex Sans KR','Noto Sans KR',system-ui,sans-serif",noto:"'Noto Sans KR',system-ui,sans-serif",nanum:"'Nanum Gothic','나눔고딕',system-ui,sans-serif",gothica1:"'Gothic A1',system-ui,sans-serif",gowun:"'Gowun Dodum',system-ui,sans-serif",pretendard:"Pretendard,'Pretendard Variable',system-ui,sans-serif",myeongjo:"'Nanum Myeongjo','나눔명조',serif",system:"system-ui,'Malgun Gothic','Apple SD Gothic Neo',sans-serif"};
const UI_HEAD_CSS={bhs:"'Black Han Sans','Do Hyeon'",dohyeon:"'Do Hyeon'",jua:"'Jua'",gugi:"'Gugi'"};
const UI_GFONT={noto:'Noto+Sans+KR:wght@400;500;700',nanum:'Nanum+Gothic:wght@400;700',gothica1:'Gothic+A1:wght@400;500;700',gowun:'Gowun+Dodum',myeongjo:'Nanum+Myeongjo:wght@400;700',jua:'Jua',gugi:'Gugi'};
const UI_DEF={scale:100,chat:13,dlg:22,av:40,font:'plex',head:'bhs'};
const UI=Object.assign({},UI_DEF,(()=>{try{return JSON.parse(localStorage.getItem('om_ui')||'{}')}catch(e){return {}}})());
function loadFont(key){const g=UI_GFONT[key];if(!g)return;const id='gf_'+key;if(document.getElementById(id))return;if(key==='pretendard'){return}const l=document.createElement('link');l.id=id;l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?family='+g+'&display=swap';document.head.appendChild(l)}
/* 글꼴 열쇠 → CSS font-family (필요하면 웹 글꼴을 불러온다). 대사 상자 글꼴(rp.bubble.st.font) 등 */
function fontCss(k){if(!k)return '';if(UI_FONT_CSS[k]){loadFont(k);if(k==='pretendard'&&!document.getElementById('gf_pretendard')){const l=document.createElement('link');l.id='gf_pretendard';l.rel='stylesheet';l.href='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css';document.head.appendChild(l)}return UI_FONT_CSS[k]}if(UI_HEAD_CSS[k]){loadFont(k);return UI_HEAD_CSS[k]+',var(--font)'}return ''}
function applyUi(){const r=document.documentElement.style;loadFont(UI.font);loadFont(UI.head);if(UI.font==='pretendard'&&!document.getElementById('gf_pretendard')){const l=document.createElement('link');l.id='gf_pretendard';l.rel='stylesheet';l.href='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css';document.head.appendChild(l)}
 r.setProperty('--font',UI_FONT_CSS[UI.font]||UI_FONT_CSS.plex);const h=UI.head==='same'?'var(--font)':(UI_HEAD_CSS[UI.head]||UI_HEAD_CSS.bhs)+',var(--font)';r.setProperty('--head',h);r.setProperty('--lab',UI.head==='same'?'var(--font)':"'Do Hyeon',var(--font)");
 r.setProperty('--chatfs',UI.chat+'px');r.setProperty('--chatav',(UI.av||40)+'px');r.setProperty('--dlgfs',UI.dlg+'px');document.body.style.zoom=window.matchMedia('(max-width:760px)').matches?1:UI.scale/100}
applyUi();
/* ---------- 모바일 (폭 760px 이하): 무대/채팅을 아래 바로 오가고, 위쪽 버튼들은 ☰ 메뉴에 모은다 ---------- */
const MOB={mode:'scene',unread:0,prev:'scene',sTop:0};
const isMobile=()=>window.matchMedia('(max-width:760px)').matches;
function mobMode(m){const sc=$('#scene');if(MOB.mode==='scene'&&m!=='scene'&&sc)MOB.sTop=sc.scrollTop;if(m==='chat'&&MOB.mode!=='chat')MOB.prev=MOB.mode;const back=m==='scene'&&MOB.mode!=='scene';MOB.mode=m;if(back&&sc)requestAnimationFrame(()=>{sc.scrollTop=MOB.sTop});document.body.classList.toggle('m-chat',m==='chat');document.querySelectorAll('#mbar [data-m]').forEach(b=>b.classList.toggle('on',b.dataset.m===m));if(m==='chat'){MOB.unread=0;mobBadge();const l=$('#log');if(l)l.scrollTop=l.scrollHeight}}
function mobBadge(){const e=$('#mUnread');if(!e)return;e.textContent=MOB.unread>99?'99+':MOB.unread;e.style.display=MOB.unread?'':'none'}
function mobNote(r){if(!isMobile()||MOB.mode==='chat')return;const d=(r&&r.data)||{};if(r.kind==='chat'&&(d.sms||(!d.t&&!d.img)))return;if(isMineLog(r))return;MOB.unread++;mobBadge()}
function openMobMenu(){const items=[['skillBtn','스킬 체크'],['dexBtn','도감'],['dbBtn','DB'],['rmBtn','레디메이드'],['copyLink','플레이어 링크'],['copyGm','GM 링크'],['seatBtn','자리'],['roomSet','⚙ 설정'],['saveLog','로그 저장'],['presence','내 이름'],['toLobby','← 로비로']].filter(([id])=>$('#'+id));
 const m=openModal(`<div class="mhead"><h2>메뉴</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="mmenu">${items.map(([id,l])=>`<button class="btn" data-mm="${id}">${esc(l)}</button>`).join('')}</div><div class="small dim" style="margin-top:10px">접속 중: ${esc(($('#presence')||{}).textContent||'')}</div>`);
 m.querySelectorAll('[data-mm]').forEach(b=>b.onclick=()=>{closeModal();const t=$('#'+b.dataset.mm);if(t)t.click()})}
function bindMobile(){const bar=$('#mbar');if(!bar)return;bar.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{const k=b.dataset.m;if(k==='menu')return openMobMenu();if(k==='phone'){if(window.OM_PHONE_UI)window.OM_PHONE_UI.open('home');return}if(k==='top'){const el=MOB.mode==='chat'?$('#log'):$('#scene');if(el)el.scrollTo({top:0,behavior:'smooth'});return}if(k==='chat'&&MOB.mode==='chat')return mobMode(MOB.prev||'scene');mobMode(k)});mobMode(MOB.mode)}
function renderRoom(){
 const app=$('#app');const r=ST.roomRow;
 app.innerHTML=`<div class="room">
  <div class="top">
   <a href="${ACCT.tok()?'#':'#lobby'}" class="btn sm ghost tolobby" id="toLobby" title="로비로 — 내 방 목록">← 로비</a><span class="name">${esc(r.name||r.id)}</span>
   ${ST.role==='gm'?'<span class="badge gm">GM</span>':ST.role==='seat'?`<span class="badge seat">${esc(ST.name)}</span>`:'<span class="badge">관전</span>'}
   <span class="tabs" id="sceneTabs"></span>
   <span class="sp"></span><span id="typingTop" class="typingtop"></span><span id="presence" class="presence" title="지금 접속 중인 사람 · 누르면 내 이름"></span><span id="conn" class="small muted">○ 연결 중</span>
   ${ST.role?`<button class="btn sm ${window.OM_SKILL_UI&&window.OM_SKILL_UI.pending()?'pri':''}" id="skillBtn">스킬 체크${window.OM_SKILL_UI&&window.OM_SKILL_UI.pending()?' !':''}</button>${ST.role==='seat'?'<button class="btn sm" id="dexBtn" title="포켓몬 도감 · 해석 관리">도감</button>':''}`:''}<button class="btn sm" id="dbBtn">DB</button><button class="btn sm" id="rmBtn" title="레디메이드 (자동화 효과 사전)">레디메이드</button><button class="btn sm" id="copyLink">플레이어 링크</button>
   ${ST.role==='gm'?`<a class="btn sm ghost" href="${esc(roomLink(ST.room)+'&pl=1')}" title="이 방에 플레이어로 다시 들어간다 (자리·PL 닉)">PL 로</a>`:((LS.get('om_rooms',[]).find(x=>x.id===ST.room)||{}).gm?`<a class="btn sm ghost" href="${esc(gmLink(ST.room,(LS.get('om_rooms',[]).find(x=>x.id===ST.room)||{}).gm))}" title="이 기기에 GM 링크가 있다 — GM 으로 다시 들어간다">GM 으로</a>`:'')}${ST.role==='gm'?(String(ST.secret).startsWith('u:')?'':'<button class="btn sm" id="copyGm">GM 링크</button>')+'<button class="btn sm" id="roomSet">⚙ 설정</button>':'<button class="btn sm" id="seatBtn">자리</button><button class="btn sm ghost" id="roomSet" title="내 설정 — 소리·알림·글자·이미지·단축키">⚙ 설정</button>'}
  </div>
  <div class="body"><div class="scene" id="scene"></div><div class="resizer" id="resizer" title="끌어서 채팅 창 너비 조절"></div>
   <div class="side" id="side"><div class="phone"><div class="pbar"><span>●●●</span><span class="ptime" id="pclock"></span></div><div class="ptitle"><span class="plogs">${ST.role==='gm'?'<button class="btn xs ghost plog" id="clearLog" title="로그 비우기">🧹 비우기</button>':''}<button class="btn xs ghost plog" id="saveLog" title="채팅 로그를 파일로 저장">💾 로그</button><button class="btn xs ghost plog" id="chatPrefs" title="채팅 설정 — 글자 크기 · 내 글자색 · 닉네임 색">⚙ 채팅 설정</button></span>${esc(r.name||r.id)}<small>${ST.role==='gm'?'GM':ST.role==='seat'?esc(ST.name):'관전'} · 오레마스</small></div><div class="ctabs" id="ctabs"><button type="button" data-ch="s">세션</button><button type="button" data-ch="o">잡담<i class="cdot"></i></button></div><div class="log" id="log"></div>
    <div class="inbox">${ST.role==='gm'?'<select id="chatAs" title="누구로 말할지 (세션 탭) — 배틀 화면에서도 인물로 말할 수 있다"><option value="gm">GM</option></select>':''}<input type="text" id="chatIn" placeholder="${ST.role?'메시지 · /r 1d100 · /w 이름 메시지':'자리에 앉으면 말할 수 있다'}" ${ST.role?'':'disabled'}><button class="btn" id="chatSend" ${ST.role?'':'disabled'}>➤</button></div></div></div>
  </div>
  <div class="mbar" id="mbar"><button data-m="scene" class="on"><i>🎭</i><span>무대</span></button><button data-m="chat"><i>💬</i><span>채팅</span><em id="mUnread" class="mbadge" style="display:none"></em></button><button data-m="phone"><i>📱</i><span>휴대폰</span></button><button data-m="top" title="맨 위로"><i>▲</i><span>맨 위</span></button><button data-m="menu"><i>☰</i><span>메뉴</span></button></div></div>`;
 $('#copyLink').onclick=()=>copy(roomLink(ST.room),'플레이어 링크를 복사했다');
 bindMobile();
 const sl=$('#saveLog');if(sl)sl.onclick=openSaveLog;const cpf=$('#chatPrefs');if(cpf)cpf.onclick=openChatPrefs;const cl=$('#clearLog');if(cl)cl.onclick=openClearLog;const pr=$('#presence');if(pr)pr.onclick=()=>{openNick()};
 const sk=$('#skillBtn');if(sk)sk.onclick=()=>window.OM_SKILL_UI.open();const dxb=$('#dexBtn');if(dxb)dxb.onclick=()=>window.OM_DEX_UI.openMgr(ST.seat);
 const dk=$('#deckBtn');if(dk)dk.onclick=()=>window.OM_DECK_UI.open();
 $('#dbBtn').onclick=()=>window.OM_DB_UI.open({kind:'trait'});if($('#rmBtn'))$('#rmBtn').onclick=()=>window.OM_FX_UI.openRm('');
 const clock=()=>{const el=$('#pclock');if(el){const d=new Date();el.textContent=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}};clock();clearInterval(ST.clockT);ST.clockT=setInterval(clock,15000);
 if(ST.role==='gm'){if($('#copyGm'))$('#copyGm').onclick=()=>copy(gmLink(ST.room,ST.secret),'GM 링크를 복사했다 (아무에게도 주지 말 것)');$('#roomSet').onclick=()=>openRoomSettings()}
 else {$('#seatBtn').onclick=openSeatPicker;$('#roomSet').onclick=()=>openRoomSettings()}
 $('#chatSend').onclick=sendChat;bindChatAs();$('#ctabs').querySelectorAll('[data-ch]').forEach(b=>b.onclick=()=>setChan(b.dataset.ch));setChan(CHAN.cur,true);$('#chatIn').onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing)sendChat()};$('#chatIn').oninput=()=>{if(window.OM_RP_UI&&window.OM_RP_UI.typingPing)window.OM_RP_UI.typingPing(CHAN.cur==='o')};
 /* 채팅 창 너비: 끌어서 조절, 브라우저에 기억 */
 try{const w=+localStorage.getItem('om_sidew');if(w>=260)$('#side').style.width=w+'px'}catch(e){}
 $('#resizer').onpointerdown=e=>{const side=$('#side');const sx=e.clientX,sw=side.getBoundingClientRect().width;e.preventDefault();document.body.classList.add('resizing');
  const mv=ev=>{const w=Math.max(260,Math.min(window.innerWidth*0.7,sw+(sx-ev.clientX)));side.style.width=w+'px'};
  const up=()=>{document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);document.body.classList.remove('resizing');try{localStorage.setItem('om_sidew',Math.round(side.getBoundingClientRect().width))}catch(e){}};
  document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up)};
 renderScene();
 /* 방에 막 들어왔을 때: 세션 탭 · 로그 맨 아래 (그림이 늦게 불려 와 길어져도 따라 내려간다) */
 if(ST._toBottom){ST._toBottom=false;renderLog(true);const lg=$('#log');if(lg)[150,600,1500,3000].forEach(t=>setTimeout(()=>{if(lg.isConnected)lg.scrollTop=lg.scrollHeight},t))}else renderLog(false)}
function copy(t,msg){navigator.clipboard.writeText(t).then(()=>toast(msg),()=>prompt('복사해서 쓰기',t))}

/* ---------- 상태 쓰기 ---------- */
async function setRaw(path,value){
  /* 서버의 jsonb_set 은 중간 키가 없으면 조용히 실패한다 — 옛 schema 를 쓰는 방이어도 되게 부모를 먼저 만든다 */
  if(path&&path.length>1&&ST.role==='gm'){let o=ST.state;for(let i=0;i<path.length-1;i++){if(typeof o[path[i]]!=='object'||o[path[i]]===null){await DBS().setState(ST.room,ST.secret,path.slice(0,i+1),{});o[path[i]]={}}o=o[path[i]]}}
  /* 좌석도 경로 그대로 쓴다 — 중간 상자는 서버 om_jset 이 만들어 준다. (2026-10-20: 예전엔 부모까지 올라가 통째로 썼는데, 서버에 이미 있던 칸을 덮을 수 있고 권한 검사의 NULL 구멍에 기대고 있어서 뺐다) */
  let wpath=path,wval=value;
  const v=await DBS().setState(ST.room,ST.secret,wpath,wval);
  /* 낙관적 반영: 실시간이 오기 전에 화면부터 */
  if(path&&path.length){let o=ST.state;for(let i=0;i<path.length-1;i++){if(typeof o[path[i]]!=='object'||o[path[i]]==null)o[path[i]]={};o=o[path[i]]}
   if(value===null||value===undefined)delete o[path[path.length-1]];else o[path[path.length-1]]=value}else ST.state=value||{};
  ST.v=Math.max(ST.v,v||0)}
async function set(path,value){try{await setRaw(path,value);renderScene();return true}catch(e){toast('저장 실패: '+e.message);return false}}
/* 바뀐 칸만 쓴다 (점검 2-4 · 3-18) — 읽어서 고친 사본을 통째로 쓰면, 그 사이 남이 바꾼 칸이 지워진다.
   before = 사본을 뜰 때의 모습, after = 고친 사본. depth 단계까지 내려가 바뀐 칸만 쓰고, 그 아래(배열 포함)는 통째로 */
const sameJ=(a,b)=>JSON.stringify(a===undefined?null:a)===JSON.stringify(b===undefined?null:b);
const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
function diffOps(path,before,after,depth,out){out=out||[];if(sameJ(before,after))return out;
 if(!(depth>0)||!isObj(before)||!isObj(after)){out.push([path,after===undefined?null:after]);return out}
 for(const k of new Set([...Object.keys(before),...Object.keys(after)]))diffOps(path.concat(k),before[k],after[k],depth-1,out);
 return out}
/* 여러 칸을 차례로 쓰고 화면은 한 번만. 하나가 막혀도 나머지는 쓴다 (실패 알림은 첫 번째 것만) */
async function setMany(ops){let ok=true,msg='';for(const [p,v] of ops){try{await setRaw(p,v)}catch(e){ok=false;if(!msg)msg=e.message}}
 if(ops.length)renderScene();if(msg)toast('저장 실패: '+msg);return ok}
function setDiff(path,before,after,depth){return setMany(diffOps(path,before,after,depth==null?1:depth))}
/* 좌석은 서버가 'battle' 로그를 막을 수 있다(옛 schema) — 그러면 'chat' + bat 표시로 다시 써서 채팅 창에는 배틀 카드로 보이게 한다 */
async function sysLog(t,kind,extra){const k=kind||'sys';const data=Object.assign({t},extra||{});try{await DBS().addLog(ST.room,ST.secret,k,ST.name,data)}catch(e){if(ST.role==='seat'&&k!=='chat'){try{await DBS().addLog(ST.room,ST.secret,'chat',ST.name,Object.assign({},data,{bat:k}));return}catch(e2){}}console.warn('로그를 남기지 못했다',e);toast('로그를 남기지 못했다: '+e.message)}}
/* 배틀 로그 카드: 「【포텐셜】 이름 『효과』」 꼴의 글은 머리띠 + 본문 카드로 */
const TAGCOL={'고유':'#7b4fd6','전용':'#1f6fd1','포텐셜':'#7b4fd6','특성':'#2f8f5b','소지품':'#c7651a','지령':'#1f6fd1','명령':'#e3101f','공개':'#d6a23b','스킬 체크':'#2b8fa8','모두 공개':'#d6a23b','공격':'#c8362b','전달':'#8a4b2a','효과':'#555','따라가때리기':'#b3261e','피해':'#d23a3a','회복':'#2f9a5b','HP':'#777','교대 알림':'#d6a23b','『지령』 & 『포텐셜』 발동':'#7b4fd6'};
/* 【공격】 카드 본문: 「→ 대상: 명중 34/80 · 급소 3/24 · 대미지 120 · 상성 ×2」 줄을 대상마다 배지로, 들여쓴 줄(판정·부가효과)은 아래 작은 글씨로 */
function atkLines(body){const out=[];for(const raw of body.split('\n')){if(!raw.trim())continue;
  if(/^\s{2,}/.test(raw)){const t=raw.trim();out.push(`<div class="atsub ${/발동!|확정/.test(t)?'ok':/불발|받지 않음/.test(t)?'no':''}">${esc(t)}</div>`);continue}
  const m=raw.match(/^→\s*([^:]+):\s*(.*)$/);if(!m){out.push(`<div class="bl">${esc(raw)}</div>`);continue}
  const parts=m[2].split(' · ');const chips=[];let dmg='';
  for(const p of parts){let x;
   if((x=p.match(/^명중\s+(\d+)\/(\d+)/)))chips.push(`<span class="atc hit">명중 <small>${x[1]}/${x[2]}</small></span>`);
   else if((x=p.match(/^빗나감\s+(\d+)\/(\d+)/)))chips.push(`<span class="atc miss">빗나감 <small>${x[1]}/${x[2]}</small></span>`);
   else if(p==='필중')chips.push(`<span class="atc hit">필중</span>`);
   else if(/^급소 /.test(p)){const isC=/급소!/.test(p.slice(3));chips.push(`<span class="atc ${isC?'crit':'nocrit'}">${isC?'급소!':'급소 X'} <small>${esc(p.slice(3).replace(/급소!/g,'').replace(/[()]/g,''))}</small></span>`)}
   else if((x=p.match(/^대미지\s+(\d+)(.*)$/)))dmg=`<span class="atdmg">${x[1]}<small>${esc(x[2].trim())}</small></span>`;
   else if((x=p.match(/^상성\s+×([\d.]+)/))){const v=+x[1];chips.push(`<span class="atc ${v>1?'sup':v===0?'imm':v<1?'weak':''}">상성 ×${x[1]}</span>`)}
   else chips.push(`<span class="atc">${esc(p)}</span>`)}
  out.push(`<div class="atrow"><b class="attg">${esc(m[1].trim())}</b><span class="atchips">${chips.join('')}</span>${dmg}</div>`)}
 return out.join('')}
/* 10-21 망령: HP 가 바뀐 줄 (data.hp = {prev,cur,max,d,why,faint}) — 큰 숫자 · 깎인 만큼 빗금 친 HP 바 */
function hpCard(d){const h=d.hp;const P=v=>v>0?Math.max(1,Math.round(v/h.max*100)):0;const a=P(h.prev),b=P(h.cur);const dmg=h.cur<h.prev;const col=dmg?'#d23a3a':'#2f9a5b';const lo=Math.min(a,b),hi=Math.max(a,b);const cls=b<=25?'low':b<=50?'mid':'';
 return `<div class="bcard hpc ${dmg?'dmg':'heal'} ${h.faint?'faint':''}" style="--tc:${col}"><div class="hpcr">${d.img?`<span class="hpcav" style="background-image:url('${cssu(d.img)}')"></span>`:''}<div class="hpcm"><div class="hpct"><b>${esc(h.name||'')}</b><span class="hpcn">${dmg?'−':'+'}${Math.abs(h.cur-h.prev)}</span></div><div class="hpcbar ${cls}"><i style="width:${lo}%"></i><em class="${dmg?'cut':'gain'}" style="left:${lo}%;width:${hi-lo}%"></em></div><div class="hpcs"><span>HP ${h.prev} → <b>${h.cur}</b> / ${h.max}</span><span class="hpcp">${b}%</span></div>${h.why?`<div class="hpcw">${esc(h.why)}</div>`:''}${String(d.t||'').split('\n').slice(2).filter(l=>l&&!/쓰러졌다!$/.test(l)).map(l=>`<div class="hpcw x">${esc(l)}</div>`).join('')}</div></div>${h.faint?`<div class="hpcf">${esc(h.name||'')}은(는) 쓰러졌다!</div>`:''}</div>`}
/* 10-21 망령: 【…】 꼴이 아닌 배틀 알림도 모양을 갖춘다 — 페이즈 띠 · 행동 순서 표 · 차례 표시 · 한 줄 알림 */
const PH_RE=[[/^시합 개시!\s*—\s*(TURN \d+)\s*\n?([\s\S]*)$/,'시합 개시'],[/^턴 개시\s*—\s*(TURN \d+)\s*\n?([\s\S]*)$/,'턴 개시'],[/^턴 개시\s*—\s*()([\s\S]*)$/,'턴 개시'],[/^페이즈: 지시 준비\s*—\s*()([\s\S]*)$/,'지시 준비'],[/^행동 처리\s*—\s*()([\s\S]*)$/,'행동 처리'],[/^행동 순서 끝\s*—\s*()([\s\S]*)$/,'행동 순서 끝'],[/^동시 내밀기!\s*()([\s\S]*)$/,'동시 내밀기!']];
function sysCard(d){const t=String(d.t||'');if(!t)return '';
 for(const [re,lab] of PH_RE){const m=t.match(re);if(m)return `<div class="sysph"><span class="sphl">${esc(lab)}</span>${m[1]?`<b class="spht">${esc(m[1])}</b>`:''}${m[2].trim()?`<small>${esc(m[2].trim()).replace(/\n/g,'<br>')}</small>`:''}</div>`}
 if(/^행동 순서\n/.test(t)){const rows=(d.ord&&d.ord.length)?d.ord:t.split('\n').slice(1).map(l=>{const m=l.match(/^(\d+)\.\s*(.+?)\s*\((.*)\)\s*$/);if(!m)return null;const sp=(m[3].match(/스피드\s*(\d+)/)||[])[1];return {n:m[2],cap:m[3].replace(/\s*·?\s*스피드\s*\d+/,'').replace(/\s*·?\s*d\d+/,'').replace(/·\s*$/,'').trim(),s:sp}}).filter(Boolean);
  return `<div class="sysord"><div class="sysoh">행동 순서</div>${rows.map((r,i)=>`<div class="sysor ${r.side||''}"><i>${i+1}</i>${r.img?`<span class="soav" style="background-image:url('${cssu(r.img)}')"></span>`:''}<b>${esc(r.n)}</b>${r.cap?`<span class="socap">${esc(r.cap)}</span>`:''}<span class="sp"></span>${r.s!=null&&r.s!==''?`<span class="sosp">S ${esc(r.s)}</span>`:''}</div>`).join('')}</div>`}
 const mt=t.match(/^▶\s*(.+?)의 행동\s*$/);if(mt)return `<div class="systurn">▶ <b>${esc(mt[1])}</b>의 차례</div>`;
 if(!/\n/.test(t))return `<div class="syspill">${esc(t)}</div>`;
 const L=t.split('\n');return `<div class="bcard"><div class="bch"><b>${esc(L[0])}</b></div><div class="bcb">${L.slice(1).filter(Boolean).map(l=>`<div class="bl">${esc(l)}</div>`).join('')}</div></div>`}
function battleCard(d){if(d.hp&&d.hp.max)return hpCard(d);const t=String(d.t||'');const m=t.match(/^【([^】]+)】\s*([^\n]*)\n?([\s\S]*)$/);if(!m)return '';const tag=m[1],title=m[2],body=m[3].trim();const col=TAGCOL[tag]||(/^턴 \d+ 종료$/.test(tag)?'#3b6fb0':'#555');
 const lines=tag==='공격'?atkLines(body):body.split('\n').filter(Boolean).map(l=>/^▸ /.test(l)?`<div class="bsec">${esc(l.slice(2))}</div>`:`<div class="bl ${/실패|차단|없|않/.test(l)?'neg':/\+\d|회복|성공|→/.test(l)?'pos':''}">${esc(l)}</div>`).join('');
 return `<div class="bcard" style="--tc:${col}"><div class="bch">${d.img?`<span class="bcav" style="background-image:url('${cssu(d.img)}')"></span>`:''}<span class="bctag">${esc(tag)}</span><b>${esc(title)}</b>${d.mid?`<span class="sp"></span><button class="btn xs ghost bcfx" data-lmid="${esc(d.mid)}" title="이 포켓몬의 포텐셜 창 — 발동 중인 효과를 ✕ 로 해제">효과</button>`:''}</div>${d.eff?`<div class="bceff">${esc(d.eff)}</div>`:''}${lines?`<div class="bcb">${lines}</div>`:''}</div>`}

/* 대사 화자 이름: as 가 있으면 그것, 좌석의 세션 대사(예전 줄)는 그 좌석 캐릭터 이름, 잡담·그 밖은 남긴 이름 그대로 */
function chatName(r){const d=r.data||{};if(d.as)return d.as;if(d.gmn&&d.from==='gm')return 'GM · '+d.gmn;if(r.kind==='chat'&&!isOoc(r)&&!d.sms&&d.from&&d.from!=='gm'){const t=((ST.state.roster||{}).trainers||{})[d.from];if(t&&t.name)return t.name}return r.who||''}
/* ---------- 대사 / 지문 판정 ----------
   새 규칙(nf:1 이 붙은 줄): 그냥 치면 지문, "…" “…” 「…」 『…』 로 감싸면 대사. *…* 도 여전히 지문.
   옛 줄(nf 없음): 예전처럼 *…* 만 지문, 나머지는 대사 (따옴표가 없으면 무대에서 붙여 준다) */
function lineFmt(d){d=d||{};const raw=String(d.t||'');const t=raw.trim();const m=t.match(/^\*(.+)\*$/s);if(m)return {narr:true,text:m[1]};
 if(/^["“「『].*["”」』]$/s.test(t))return {narr:false,text:t,q:true};if(d.nf)return {narr:true,text:raw};return {narr:false,text:raw,q:false}}
window.OM_LINE=lineFmt;
/* ---------- 채팅 ---------- */
/* 세션 / 잡담 대화창: 잡담 탭에서 보낸 말은 data.ch='ooc' 로 남고 세션 탭 · 무대 · 로그 정리기의 세션 로그에서 빠진다 (정리기에서는 OOC) */
const CHAN={cur:(()=>{try{return localStorage.getItem('om_chan')==='o'?'o':'s'}catch(e){return 's'}})(),seen:{s:0,o:0}};
const isOoc=r=>!!(r&&r.data&&r.data.ch==='ooc');
function setChan(ch,quiet){CHAN.cur=ch==='o'?'o':'s';try{localStorage.setItem('om_chan',CHAN.cur)}catch(e){}const tb=$('#ctabs');if(tb)tb.querySelectorAll('[data-ch]').forEach(b=>b.classList.toggle('on',b.dataset.ch===CHAN.cur));
 const inp=$('#chatIn');if(inp&&ST.role)inp.placeholder=CHAN.cur==='o'?'잡담 · 세션 로그에 남지 않는다':'메시지 · /r 1d100 · /w 이름 메시지';const side=$('#side');if(side)side.classList.toggle('ooc',CHAN.cur==='o');if(!quiet)renderLog(true)}
function chanDots(){const tb=$('#ctabs');if(!tb)return;const last={s:0,o:0};for(const r of ST.log){if(r.kind!=='chat'&&r.kind!=='dice')continue;if(r.data&&(r.data.sms||r.data.bat))continue;const c=isOoc(r)?'o':'s';last[c]=Math.max(last[c],r.id)}
 if(CHAN.room!==ST.room){CHAN.room=ST.room;CHAN.seen={s:last.s,o:last.o}}   /* 방에 들어올 때까지의 줄은 읽은 것으로 */
 CHAN.seen[CHAN.cur]=Math.max(CHAN.seen[CHAN.cur],last[CHAN.cur]);tb.querySelectorAll('[data-ch]').forEach(b=>b.classList.toggle('new',b.dataset.ch!==CHAN.cur&&last[b.dataset.ch]>CHAN.seen[b.dataset.ch]))}
/* GM 채팅 화자: RP 무대의 화자 목록(GM · NPC · PC · 포켓몬)을 그대로 쓴다. 열 때마다 목록을 새로 채운다 */
function bindChatAs(){const s=$('#chatAs');if(!s)return;
 const fill=()=>{const R=window.OM_RP_UI;const list=R&&R.allSpeakers?R.allSpeakers():[{key:'gm',name:'GM'}];const cur=ST.chatAs||'gm';
  s.innerHTML=list.map(x=>`<option value="${esc(x.key)}">${esc(x.key==='gm'?'GM':x.name)}</option>`).join('');s.value=list.some(x=>x.key===cur)?cur:'gm';ST.chatAs=s.value};
 fill();s.addEventListener('pointerdown',fill);s.addEventListener('focus',fill);s.onchange=()=>{ST.chatAs=s.value;const i=$('#chatIn');if(i)i.focus()}}
/* ---------- 채팅 설정 (10-21 망령): 글자 크기 · 프로필 크기는 내 화면만, 내 글자색 · 닉네임 색 · 말풍선 색은 보내는 줄에 실려 모두에게 ---------- */
const HEX=v=>/^#[0-9a-f]{6}$/i.test(String(v||''))?String(v):'';
function chatSty(){try{const o=JSON.parse(localStorage.getItem('om_chatsty')||'{}');const x={};for(const k of ['tc','nc','bc'])if(HEX(o[k]))x[k]=o[k];return x}catch(e){return {}}}
function styAttr(d){const y=d&&d.sty;if(!y)return {bub:'',who:''};const tc=HEX(y.tc),nc=HEX(y.nc),bc=HEX(y.bc);return {bub:(tc?`color:${tc};`:'')+(bc?`background:${bc};`:''),who:nc?`color:${nc};border-left-color:${nc};`:''}}
function openChatPrefs(){const y=chatSty();const md=openModal(`<div class="mhead"><h2>채팅 설정</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
 <div class="cpf"><div class="sec">내 화면</div>
  <label>글자 크기 <input type="range" id="cp_fs" min="11" max="22" step="1" value="${UI.chat}"><b id="cp_fs_v">${UI.chat}px</b></label>
  <label>프로필 크기 <input type="range" id="cp_av" min="24" max="72" step="2" value="${UI.av||40}"><b id="cp_av_v">${UI.av||40}px</b></label>
  <div class="sec">내 말 (모두에게 보인다 · 이제부터 보내는 줄에)</div>
  ${[['tc','글자색','#111111'],['nc','닉네임 색','#ffffff'],['bc','말풍선 색','#ffffff']].map(([k,l,dv])=>`<label>${l} <input type="color" id="cp_${k}" value="${y[k]||dv}"><label class="small"><input type="checkbox" id="cp_${k}_on" ${y[k]?'checked':''}> 쓰기</label></label>`).join('')}
  <div class="cpv"><div class="msg chat"><div class="av"></div><div class="bub" id="cp_pv"><span class="who" id="cp_pvw">${esc(ST.name||'나')}</span>미리보기 — 이렇게 보인다</div></div></div>
  <div class="row"><button class="btn sm ghost" id="cp_reset">원래대로</button><span class="sp"></span><button class="btn sm pri" id="cp_ok">저장</button></div></div>`);
 const g=id=>$('#'+id,md);
 const rd=()=>{const o={};for(const k of ['tc','nc','bc'])if(g('cp_'+k+'_on').checked)o[k]=g('cp_'+k).value;return o};
 const pv=()=>{const a=styAttr({sty:rd()});g('cp_pv').setAttribute('style',a.bub);g('cp_pvw').setAttribute('style',a.who);g('cp_fs_v').textContent=g('cp_fs').value+'px';g('cp_av_v').textContent=g('cp_av').value+'px';UI.chat=+g('cp_fs').value;UI.av=+g('cp_av').value;applyUi()};
 md.querySelectorAll('input').forEach(i=>{i.oninput=pv;i.onchange=pv});['tc','nc','bc'].forEach(k=>g('cp_'+k).addEventListener('input',()=>{g('cp_'+k+'_on').checked=true;pv()}));pv();
 g('cp_reset').onclick=()=>{for(const k of ['tc','nc','bc'])g('cp_'+k+'_on').checked=false;g('cp_fs').value=UI_DEF.chat;g('cp_av').value=UI_DEF.av;pv()};
 g('cp_ok').onclick=()=>{try{localStorage.setItem('om_chatsty',JSON.stringify(rd()));localStorage.setItem('om_ui',JSON.stringify(UI))}catch(e){}closeModal();toast('채팅 설정을 저장했다');renderLog&&renderLog()}}
async function sendChat(){
 const inp=$('#chatIn');const t=inp.value.trim();if(!t)return;const SY=chatSty();const ch=Object.assign(CHAN.cur==='o'?{ch:'ooc'}:{},Object.keys(SY).length?{sty:SY}:{});const nf=CHAN.cur==='o'?{}:{nf:1};inp.value='';if(window.OM_RP_UI&&window.OM_RP_UI.typingStop)window.OM_RP_UI.typingStop();
 try{
  let m;
  if((m=t.match(/^\/r(?:oll)?\s+(.+)$/i))){const r=roll(m[1]);if(!r)return toast('주사위 식을 모르겠다 (예: 1d100, 2d6+3)');await DBS().addLog(ST.room,ST.secret,'dice',ST.name,Object.assign({t:`${m[1]} → ${r.text} = ${r.total}`,total:r.total},ch))}
  else if((m=t.match(/^\/w\s+(\S+)\s+(.+)$/))){const to=resolveSeat(m[1]);if(!to)return toast('그런 자리가 없다: '+m[1]);await DBS().addLog(ST.room,ST.secret,'whisper',ST.name,{t:m[2],to,toName:m[1]});pollWhispers()}
  else if((m=t.match(/^\/as\s+(\S+)\s+(.+)$/))){if(ST.role!=='gm')return toast('/as 는 GM 만');await DBS().addLog(ST.room,ST.secret,'chat',m[1],{t:m[2],as:m[1],nf:1})}
  else if((m=t.match(/^\/s\s+(.+)$/))){await window.OM_RP_UI.setMyStand(m[1].trim())}
  else if((m=t.match(/^\/img\s+(\S+)$/))){await DBS().addLog(ST.room,ST.secret,'chat',ST.name,Object.assign({t:'',img:m[1]},ch))}
  else if(/^\/clear$/.test(t)){if(ST.role!=='gm')return toast('/clear 는 GM 만');await DBS().addLog(ST.room,ST.secret,'chat',ST.name,{t:'',clear:1})}
  else if(t.startsWith('/'))return toast('모르는 명령이야: /r /w /as /s /img /clear');
  else if(ST.role==='gm'&&CHAN.cur!=='o'&&ST.chatAs&&ST.chatAs!=='gm'){const R=window.OM_RP_UI;const c=R&&R.charOf?R.charOf(ST.chatAs):null;const nm=c?c.name:ST.chatAs.replace(/^(npc|as|pm):/,'');await DBS().addLog(ST.room,ST.secret,'chat',nm,Object.assign({t,as:nm,k:ST.chatAs},nf))}   /* GM 이 고른 인물로 */
  else{const tr=CHAN.cur!=='o'&&ST.role==='seat'?((ST.state.roster||{}).trainers||{})[ST.seat]:null;const nm=tr&&tr.name?tr.name:ST.name;await DBS().addLog(ST.room,ST.secret,'chat',nm,Object.assign({t},ch,nf,tr&&tr.name?{as:nm,k:ST.seat}:{},ST.role==='gm'&&ST.gmNick?{gmn:ST.gmNick}:{}))}   /* 세션 탭: 좌석은 캐릭터 이름으로 · 잡담 탭은 플레이어 닉 */
 }catch(e){toast('보내지 못했다: '+e.message)}}
function resolveSeat(n){if(n==='GM'||n==='gm')return 'gm';const seats=ST.state.seats||{};for(const k in seats)if(seats[k]&&(seats[k].name===n||k===n))return k;const trs=(ST.state.battle||{}).trainers||{};for(const k in trs)if(trs[k].name===n)return k;return null}
function roll(expr){const m=String(expr).replace(/\s/g,'').match(/^(\d*)d(\d+)([+-]\d+)?$/i);if(!m)return null;const n=Math.min(+m[1]||1,100),f=+m[2],mod=+(m[3]||0);if(f<1)return null;const rs=[];for(let i=0;i<n;i++)rs.push(1+Math.floor(Math.random()*f));const total=rs.reduce((a,b)=>a+b,0)+mod;return {total,text:'['+rs.join(',')+']'+(mod?(mod>0?'+':'')+mod:'')}}
function avatarOf(r){const d=r.data||{};if(d.k&&window.OM_RP_UI&&window.OM_RP_UI.imgOfKey){const u=window.OM_RP_UI.imgOfKey(d.k);if(u)return u}if(d.as){const tr=Object.values((ST.state.roster||{}).trainers||{}).find(x=>x.name===d.as);if(tr&&tr.image)return tr.image;const n=Object.values((ST.state.graph||{}).nodes||{}).find(x=>x.name===d.as);return n&&n.img||''}const from=d.from;if(from==='gm')return (ST.state.rp||{}).gmImg||'';const b=ST.state.battle||{};const ro=ST.state.roster||{trainers:{}};const t=(b.trainers||{})[from]||(ro.trainers||{})[from];if(t&&t.image)return t.image;return ''}
function renderLog(scroll){
 const el=$('#log');if(!el)return;
 const cut=+((ST.state.rp||{}).logClearAt)||0;
 el.innerHTML=ST.log.filter(r=>r.id>cut&&(CHAN.cur==='o'?isOoc(r):!isOoc(r))).map(r=>{const d=r.data||{};const k=(r.kind==='chat'&&d.bat)?d.bat:r.kind;const t=fmtTime(r.at);
  if(k==='sys')return `<div class="msg sys"><div class="bub">${esc(d.t)}</div></div>`;
  if(k==='chat'&&d.clear)return `<div class="msg sys"><div class="bub">무대를 비웠다</div></div>`;
  if(k==='chat'&&d.sms)return '';
  if(k==='chat'&&!d.t&&!d.img)return '';
  if(k==='battle'){const card=battleCard(d);if(card)return `<div class="msg battle card">${card}<span class="time">${t}</span></div>`;const sc=sysCard(d);if(sc)return `<div class="msg battle sysc">${sc}<span class="time">${t}</span></div>`}
  const mine=(ST.role==='gm'&&d.from==='gm'&&!d.as&&(!d.gmn||d.gmn===ST.gmNick))||(ST.role==='seat'&&d.from===ST.seat&&(!d.as||d.k===ST.seat));
  const who=k==='whisper'?`${esc(r.who)} → ${esc(d.toName||d.to)}`:esc(chatName(r));
  const av=avatarOf(r);
  const lf=k==='chat'&&!isOoc(r)?lineFmt(d):{narr:false,text:String(d.t||'')};
  const sa=styAttr(d);
  return `<div class="msg ${k} ${mine?'me':''} ${lf.narr?'narr':''}"><div class="av" style="${av?`background-image:url('${cssu(av)}')`:''}"></div><div class="bub" style="${sa.bub}"><span class="who" style="${sa.who}">${who}</span>${d.img?`<a href="${esc(d.img)}" target="_blank" rel="noopener"><img class="cimg" src="${esc(d.img)}" alt=""></a>`:''}${esc(lf.text)}</div><span class="time">${t}</span></div>`}).join('');
 el.querySelectorAll('[data-lmid]').forEach(bt=>bt.onclick=()=>{if(window.OM_BATTLE_UI&&window.OM_BATTLE_UI.action)window.OM_BATTLE_UI.action({act:'pots',mid:bt.dataset.lmid})});
 if(!el.innerHTML&&CHAN.cur==='o')el.innerHTML='<div class="msg sys"><div class="bub">잡담 창 — 여기서 한 말은 세션 로그·무대에 나오지 않는다</div></div>';chanDots();
 if(scroll!==false)el.scrollTop=el.scrollHeight}

/* ---------- 씬 ---------- */
function scene(){return ST.state.scene||'rp'}
let VIEW='';let lastScene='';
const VIEWS=[['rp','RP'],['battle','배틀'],['sheet','시트'],['graph','관계도'],['calendar','캘린더'],['report','제보'],['guide','튜토리얼']];
/* ---------- 접속 중인 사람 (브로드캐스트 인사: 25초마다 · 새로 온 사람에게 답인사) ---------- */
const PRES={who:{},t:null,last:0};
function myId(){return ST.role==='gm'?('gm:'+(ST.vid||(ST.vid=Math.random().toString(36).slice(2,8)))):ST.role==='seat'?('s:'+ST.seat):('v:'+(ST.vid||(ST.vid=Math.random().toString(36).slice(2,8))))}
function sayHello(force){const now=Date.now();if(!force&&now-PRES.last<20000)return;PRES.last=now;try{DBS().broadcast({t:'hello',id:myId(),name:ST.role==='gm'?(ST.gmNick||''):(ST.name||'관전'),role:ST.role||'view',seat:ST.seat||'',at:now})}catch(e){}}
function onHello(p){if(!p||!p.id||p.id===myId())return;const isNew=!PRES.who[p.id];PRES.who[String(p.id).slice(0,40)]={name:String(p.name||'').slice(0,40),role:['gm','seat','view'].includes(p.role)?p.role:'view',seat:String(p.seat||'').slice(0,40),at:Date.now()};drawPresence();if(isNew)setTimeout(()=>sayHello(true),300+Math.random()*700)}
function drawPresence(){const el=$('#presence');if(!el)return;const now=Date.now();const list=[{id:myId(),name:ST.role==='gm'?(ST.gmNick||''):(ST.name||'관전'),role:ST.role||'view',seat:ST.seat||'',me:true},...Object.entries(PRES.who).filter(([k,v])=>now-v.at<70000).map(([k,v])=>Object.assign({id:k},v))];
 const trs=(ST.state.roster||{}).trainers||{};const nm=x=>x.role==='gm'?`GM${x.name?' <small>'+esc(x.name)+'</small>':''}`:x.role==='seat'?`${esc(x.name)}${trs[x.seat]?' <small>'+esc(trs[x.seat].name)+'</small>':''}`:esc(x.name||'관전');
 el.innerHTML=`<span class="pcount" title="${esc(list.map(x=>x.role==='gm'?'GM'+(x.name?' '+x.name:''):x.name).join(', '))}">● ${list.length}</span>${list.map(x=>`<span class="pwho ${x.role} ${x.me?'me':''}">${nm(x)}</span>`).join('')}`}
function startPresence(){sayHello(true);clearInterval(PRES.t);PRES.t=setInterval(()=>{sayHello(false);drawPresence()},25000)}
/* GM 이 보고 있으면 로스터 트레이너마다 관계도 노드가 있게 맞춘다 (좌석이 제 파티를 가져왔을 때 — 좌석은 graph 를 못 쓰니까) */
/* 트레이너마다 한 번만 (graph.auto[tid]) — GM 이 지운 노드는 다시 만들지 않는다 */
let reconT=null;function reconcileNodes(){if(ST.role!=='gm')return;clearTimeout(reconT);reconT=setTimeout(async()=>{const trs=(ST.state.roster||{}).trainers||{};const g=ST.state.graph;if(!g)return;const nodes=g.nodes||{};const auto=g.auto||{};const have=new Set(Object.values(nodes).map(n=>n.name));let i=Object.keys(nodes).length;
 for(const t of Object.values(trs)){if(!t||!t.name||auto[t.id])continue;if(!have.has(t.name)){have.add(t.name);const id='t_'+t.id;await set(['graph','nodes',id],{id,name:t.name,kind:t.kind==='npc'?'npc':'pc',img:'',note:'',x:120+(i%6)*140,y:120+Math.floor(i/6)*140,stands:[],standActive:0});i++}
  if(!g.auto)await set(['graph','auto'],{});await set(['graph','auto',t.id],1)}},800)}
function renderScene(){reconcileNodes();
 try{drawPresence()}catch(e){}
 try{const skb=$('#skillBtn');if(skb&&window.OM_SKILL_UI){const p=window.OM_SKILL_UI.pending();skb.classList.toggle('pri',p);skb.textContent='스킬 체크'+(p?' !':'')}}catch(e){}
 if(window.OM_DB_UI)window.OM_DB_UI.applyOverride(ST.state.dbx);
 /* GM 이 무대(RP/배틀)를 바꾸면 모두 그쪽으로 따라간다. 그 밖의 탭(시트·관계도·캘린더·제보)은 각자 본다 */
 if(scene()!==lastScene){lastScene=scene();VIEW=scene()}
 if(!VIEW)VIEW=scene();
 const tabs=$('#sceneTabs');if(tabs){tabs.innerHTML=VIEWS.map(([k,n])=>`<button data-s="${k}" class="${VIEW===k?'on':''} ${scene()===k?'stage':''}" title="${scene()===k?'지금 무대':''}">${n}</button>`).join('')+(ST.role==='gm'?`<button class="btn xs ghost" id="stageBtn" title="모두를 이 탭으로 부른다">무대로</button>`:'');
  tabs.querySelectorAll('button[data-s]').forEach(b=>b.onclick=()=>{VIEW=b.dataset.s;renderScene()});
  const sb=$('#stageBtn');if(sb)sb.onclick=()=>{if(VIEW==='rp'||VIEW==='battle')set(['scene'],VIEW);else toast('무대는 RP 나 배틀만 될 수 있어')}}
 const el=$('#scene');if(!el)return;
 if(VIEW!=='report'&&VIEW!=='guide')ST.lastView=VIEW;
 if(VIEW==='battle')renderBattle(el);
 else if(VIEW==='sheet')window.OM_SHEET_UI.render(el);
 else if(VIEW==='graph')window.OM_GRAPH_UI.render(el);
 else if(VIEW==='calendar')window.OM_CAL_UI.render(el);
 else if(VIEW==='report')window.OM_REPORT_UI.render(el);
 else if(VIEW==='guide'){if(window.OM_GUIDE_UI)window.OM_GUIDE_UI.render(el)}
 else window.OM_RP_UI.render(el);
 if(window.OM_RP_UI)window.OM_RP_UI.onState();
 if(window.OM_DECK_UI){if(ST.role==='gm')window.OM_DECK_UI.absorb();else if(window.OM_DECK_UI.onAck)window.OM_DECK_UI.onAck()}
 if(window.OM_PHONE_UI&&window.OM_PHONE_UI.refresh)window.OM_PHONE_UI.refresh();
 if(window.OM_STAGE_UI)window.OM_STAGE_UI.onState()}

/* ---------- 배틀 씬 → battle_ui.js ---------- */
function B(){return ST.state.battle||{}}
function renderBattle(el){window.OM_BATTLE_UI.render(el)}
async function unloadTrainer(tid){const b=B();if(!confirm('이 트레이너와 파티를 배틀에서 뺄까?'))return;const b0=JSON.parse(JSON.stringify(b)),nb=JSON.parse(JSON.stringify(b0));for(const s of ['left','right']){if(nb.sides&&nb.sides[s])nb.sides[s].trainers=(nb.sides[s].trainers||[]).filter(x=>x!==tid)}
 delete (nb.trainers||{})[tid];for(const k in nb.mons||{})if(nb.mons[k].tid===tid)delete nb.mons[k];if(nb.cmds)delete nb.cmds[tid];await setDiff(['battle'],b0,nb,3)}

/* ---------- 파티 불러오기: 로스터(시트) → 배틀 ---------- */
let MK=null;
async function loadMaker(force){if(MK&&!force)return MK;toast('제작기 시트를 읽는 중…');const [trs,pks,fos]=await Promise.all([DBS().makerDocs('trainers'),DBS().makerDocs('pokemon'),DBS().makerDocs('folders')]);
 MK={trainers:trs,pokemon:pks,folders:fos};return MK}
function roster(){return ST.state.roster||{trainers:{},mons:{}}}
async function openLoadParty(side){
 const r=roster();const ids=Object.keys(r.trainers).sort((a,b)=>(r.trainers[a].ord||0)-(r.trainers[b].ord||0));
 const inB=B().trainers||{};
 const m=openModal(`<div class="mhead"><h2>${side==='left'?'좌측':'우측'} 진영에 파티 불러오기</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
  ${ids.length?`<ul class="pick">${ids.map(id=>{const t=r.trainers[id];const n=(t.pids||[]).length;return `<li><b>${esc(t.name)}</b><span class="small muted">${esc(['육성','지시','통솔','능력'].map(k=>k+' '+((t.ranks||{})[k]||'-')).join(' · '))} · ${n}체</span><span class="sp"></span>${inB[id]||Object.values(inB).some(x=>x&&x.srcTid===id)?'<span class="tag">배틀에 있음</span>':''}${(ST.role!=='gm'&&id!==ST.seat)?'<span class="tag" title="불러온 사람이 지시한다 (내 몫으로 올림)">빌려 쓰기</span>':''}<button class="btn sm pri" data-pick="${id}">불러오기</button></li>`}).join('')}</ul>`:'<div class="empty">로스터가 비어 있다.</div>'}
  <div class="row" style="margin-top:10px"><span class="small muted">트레이너는 「시트」 탭에서 제작기에서 가져오거나 새로 만든다.</span><span class="sp"></span><button class="btn sm" id="goSheet">시트 탭으로</button></div>`);
 $('#goSheet',m).onclick=()=>{closeModal();VIEW='sheet';renderScene()};
 m.querySelectorAll('[data-pick]').forEach(btn=>btn.onclick=async()=>{closeModal();await loadFromRoster(btn.dataset.pick,side)})}
async function loadFromRoster(tid,side){
 const r=roster();const t=r.trainers[tid];if(!t)return toast('로스터에 없는 트레이너다');
 const trainer=JSON.parse(JSON.stringify(t));const mons=(t.pids||[]).map(id=>r.mons[id]).filter(Boolean).map(x=>JSON.parse(JSON.stringify(x)));
 /* 비어 있는 특성·포텐셜 효과 글 채우기 (제작기 DB 에 새로 넣은 것) */
 {const DU=window.OM_DB_UI;if(DU&&DU.fillEff&&mons.some(m=>(m.ability&&!m.abilityEff)||(m.pots||[]).some(p=>!p.eff))){if(DU.ensureMaker)await DU.ensureMaker();for(const m of mons)DU.fillEff(m)}}
 if(!mons.length&&!confirm('이 트레이너는 포켓몬이 없다. 그래도 불러올까?'))return;
 /* 지시 권한 = 배틀에 불러온 사람 (망령 2026-10-22: 덱 빌려 쓰기). 좌석이 남의 파티를 불러오면 내 자리 id 로 올린다 —
    트레이너 id = 내 좌석, 포켓몬 id = 좌석~원래id (rid 에 시트 id). 서버 권한·비밀 지시가 좌석 id 기준이라 그대로 맞는다. 결과 정리는 rid 로 시트에 돌려준다 */
 const borrowAs=nid=>{trainer.srcTid=tid;trainer.id=nid;const map={};for(const mon of mons){mon.rid=mon.id;mon.id=nid+'~'+mon.id;mon.tid=nid;map[mon.rid]=mon.id}trainer.pids=(trainer.pids||[]).map(id=>map[id]||id)};
 if(ST.role!=='gm'&&tid!==ST.seat){const mine=(B().trainers||{})[ST.seat];
  if(mine&&!confirm(`내 자리로 「${mine.name}」가 이미 배틀에 있다. 「${t.name}」 파티로 바꿀까?`))return;borrowAs(ST.seat)}
 /* 불러온 사람 = 지시하는 사람 (by). GM 이 불러온 파티는 PL 권한(GM 불간섭) 중에도 GM 이 지시·진행한다 */
 trainer.by=ST.role==='gm'?'gm':ST.seat;
 const b0=JSON.parse(JSON.stringify(B())),nb=JSON.parse(JSON.stringify(b0));nb.sides=nb.sides||{left:{trainers:[]},right:{trainers:[]}};nb.sides.left=nb.sides.left||{trainers:[]};nb.sides.right=nb.sides.right||{trainers:[]};
 nb.trainers=nb.trainers||{};nb.mons=nb.mons||{};nb.turn=nb.turn||0;nb.phase=nb.phase||0;nb.mode=nb.mode||2;nb.field=nb.field||{};nb.cmds=nb.cmds||{};nb.order=nb.order||[];
 for(const s of ['left','right'])nb.sides[s].trainers=nb.sides[s].trainers.filter(x=>x!==trainer.id);
 nb.sides[side].trainers.push(trainer.id);trainer.side=side;nb.trainers[trainer.id]=trainer;
 for(const k in nb.mons)if(nb.mons[k].tid===trainer.id)delete nb.mons[k];
 mons.forEach((mon,i)=>{mon.side=side;mon.slot=i;mon.entry='';mon.started=false;mon.rank={attack:0,defense:0,specialattack:0,specialdefense:0,speed:0,accuracy:0,evasion:0,critical:0};mon.mod={};mon.states=Object.assign({},mon.sheetStates||{});mon.teraActive=false;delete mon.itemUsed;delete mon.form0;delete mon.formIdx;
  mon.hp={max:mon.stats[0],cur:mon.states.Dead?0:mon.sheetHp==null?mon.stats[0]:Math.min(mon.sheetHp,mon.stats[0])};nb.mons[mon.id]=mon});   /* 시트의 남은 HP·상태 이상·빈사(결과 정리로 돌려받은 것)로 시작 */
 /* 바뀐 칸만 쓴다 (점검 3-18) — 트레이너 → 진영 → 포켓몬 순. 좌석은 자기 트레이너·포켓몬·진영 칸만 (턴·필드 같은 기본값은 GM 만) */
 const rk={trainers:0,sides:1,mons:2};let ops=diffOps(['battle'],b0,nb,3);if(ST.role!=='gm')ops=ops.filter(o=>o[0][1] in rk);
 ops.sort((x,y)=>(rk[x[0][1]]??3)-(rk[y[0][1]]??3));const ok=await setMany(ops);
 if(ok){toast(`${trainer.name} 파티 ${mons.length}체를 불러왔다`);sysLog(`${trainer.name} (${side==='left'?'좌측':'우측'}) 파티 등록 · ${mons.length}체`,'battle');VIEW='battle';renderScene()}}

/* ---------- 알까기 (개체값) ---------- */
function openHatch(tid){
 const b=B();const tr=(b.trainers||{})[tid];const list=Object.values(b.mons||{}).filter(m=>m.tid===tid).sort((a,b)=>a.slot-b.slot);
 if(!list.length)return toast('포켓몬이 없다');
 const count=S().hatchCount(tr);
 const m=openModal(`<div class="mhead"><h2>알까기 — ${esc(tr.name)}</h2><span class="small muted">육성 ${esc(tr.ranks.육성||'-')} → ${count}회 굴림. 포켓몬마다 하나를 고른다 (맵툴 reroll_iv 와 같음)</span><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
  ${list.map(mon=>{const rolls=S().hatch(count);mon._rolls=rolls;const cur=mon.iv&&S().ivSum(mon.iv)?mon.iv:null;
   return `<div class="card" data-mid="${mon.id}"><div class="row"><b>${esc(mon.name)}</b><span class="small muted">지금: ${cur?cur.join('/')+' (합 '+S().ivSum(cur)+')':'없음 (전부 0)'}</span><span class="sp"></span><button class="btn sm" data-re="${mon.id}">다시 굴림</button></div>
    <div class="ivs" style="margin-top:6px">${rolls.map((r,i)=>`<button class="btn" data-iv="${i}">${r.join('/')} <span class="muted">합 ${S().ivSum(r)}</span></button>`).join('')}</div></div>`}).join('')}
  <div class="row" style="margin-top:12px"><span class="sp"></span><button class="btn pri" id="ivApply">고른 것 적용</button></div>`);
 const chosen={};
 m.querySelectorAll('.card').forEach(c=>{c.querySelectorAll('[data-iv]').forEach(bt=>bt.onclick=()=>{c.querySelectorAll('[data-iv]').forEach(x=>x.classList.remove('on'));bt.classList.add('on');chosen[c.dataset.mid]=+bt.dataset.iv});
  $('[data-re]',c).onclick=()=>{const mon=list.find(x=>x.id===c.dataset.mid);mon._rolls=S().hatch(count);delete chosen[mon.id];const box=$('.ivs',c);box.innerHTML=mon._rolls.map((r,i)=>`<button class="btn" data-iv="${i}">${r.join('/')} <span class="muted">합 ${S().ivSum(r)}</span></button>`).join('');box.querySelectorAll('[data-iv]').forEach(bt=>bt.onclick=()=>{box.querySelectorAll('[data-iv]').forEach(x=>x.classList.remove('on'));bt.classList.add('on');chosen[mon.id]=+bt.dataset.iv})}});
 $('#ivApply',m).onclick=async()=>{const b0=JSON.parse(JSON.stringify(B())),nb=JSON.parse(JSON.stringify(b0));let n=0;
  for(const mon of list){if(chosen[mon.id]==null)continue;const iv=mon._rolls[chosen[mon.id]];const t=nb.mons[mon.id];const full=t.hp.cur>=t.hp.max;t.iv=iv;t.stats=S().statsOf(t.base,iv,t.ev,t.lv);const oldMax=t.hp.max;t.hp.max=t.stats[0];t.hp.cur=full?t.hp.max:Math.max(1,Math.min(t.hp.max,t.hp.cur+t.hp.max-oldMax));n++}
  closeModal();if(n&&await setDiff(['battle','mons'],b0.mons,nb.mons,2))toast(n+'체의 개체값을 적용했다')}}

/* ---------- 포켓몬 상세 ---------- */
/* 상성 칩 묶음 (도감과 같은 꼴) */
function weakHtml(m){const TYPES=['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];const Bt=window.OM_BATTLE;if(!Bt)return '';
 const rows=TYPES.map(t=>{const e=Bt.effectiveness([t],m,{});return [t,e&&typeof e==='object'?+e.value:+e]}).filter(x=>x[1]!==1);
 const G=[[4,'×4','w4'],[2,'×2','w2'],[0.5,'×½','r2'],[0.25,'×¼','r4'],[0,'×0','r0']].map(([v,l,c])=>{const ch=rows.filter(x=>x[1]===v).map(x=>typeChip(x[0])).join('');return ch?`<div class="dxw ${c}"><i>${l}</i>${ch}</div>`:''}).join('');
 return `<div class="dxweak">${G||'<span class="dim small">약점·내성 없음</span>'}</div>`}
/* 상세 창용 큰 상성판: 약점 · 내성 두 칸, 배율 띠 + 큰 타입 칩 */
function affHtml(m){const TYPES=['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];const Bt=window.OM_BATTLE;if(!Bt)return '';
 const rows=TYPES.map(t=>{const e=Bt.effectiveness([t],m,{});return [t,e&&typeof e==='object'?+e.value:+e]}).filter(x=>x[1]!==1);
 const grp=list=>list.map(([v,l,c])=>{const ch=rows.filter(x=>x[1]===v).map(x=>typeChip(x[0])).join('');return ch?`<div class="afr ${c}"><i>${l}</i><div class="afc">${ch}</div></div>`:''}).join('');
 const W=grp([[4,'×4','w4'],[2,'×2','w2']]),R=grp([[0.5,'×½','r2'],[0.25,'×¼','r4'],[0,'×0','r0']]);
 return `<div class="aff"><div class="afcol wk"><div class="afh">약점</div>${W||'<div class="afnone">없음</div>'}</div><div class="afcol rs"><div class="afh">내성 · 무효</div>${R||'<div class="afnone">없음</div>'}</div></div>`}
function openMon(mid){
 const b=B();const m=(b.mons||{})[mid];if(!m)return;const tr=(b.trainers||{})[m.tid]||{name:''};
 const full=ST.role==='gm'||ST.seat===m.tid;
 /* 내 것이 아니면 상세 창 대신 도감 — 해석한 만큼만 보인다 (같은 편은 도감 규칙대로 전부) */
 if(!full&&window.OM_DEX_UI)return window.OM_DEX_UI.open(mid,ST.seat||'_view');
 const K=S().STATS_KO;const pct=(m.hp.cur>0?Math.max(1,Math.round(m.hp.cur/m.hp.max*100)):0);
 const stat6=`<div class="dxst wide">${m.ranks.map((r,i)=>`<div><small>${K[i]}</small><b>${esc(r)}</b>${full?`<em title="종족치 · 실수치">${m.base[i]} · ${m.stats[i]}</em>`:''}</div>`).join('')}</div>`;
 const an=(kind,name)=>(full&&name&&name!=='-')?` <button class="btn xs ghost anb" data-an="${esc(kind)}" data-ann="${esc(name)}" title="로그에 출력">📢 출력</button>`:'';
 const hpRow=full?`<div class="hpq"><span class="k">HP 조작</span><input type="text" id="hpd" placeholder="숫자 · 1/8" title="숫자 또는 분수(최대 HP 기준)"><button class="btn sm hpdmg" id="hpDmg">대미지</button><button class="btn sm hpheal" id="hpHeal">회복</button><button class="btn sm ghost hpheal2" id="hpFull">전부 회복</button>${(()=>{const l=m.hp.latest;const ok=l!=null&&+l!==+m.hp.cur;return `<button class="btn sm ghost hpundo" id="hpUndo" ${ok?'':'disabled'} title="${ok?`가장 최근의 피해·회복을 취소 — HP ${m.hp.cur} → ${l} (한 번 더 누르면 다시 적용)`:'되돌릴 피해·회복이 없다'}">↶ 되돌리기${ok?` <small>${+l>+m.hp.cur?'+':'−'}${Math.abs(l-m.hp.cur)}</small>`:''}</button>`})()}
  <span class="qs">${['1/16','1/8','1/4','1/3','1/2'].map(f=>`<button class="btn xs" data-hpf="${f}" title="최대 HP 의 ${f} 대미지">−${f}</button>`).join('')}</span><span class="qs qh">${['1/16','1/8','1/4','1/3','1/2'].map(f=>`<button class="btn xs" data-hph="${f}" title="최대 HP 의 ${f} 회복">+${f}</button>`).join('')}</span><span class="sp"></span><button class="btn xs ghost" id="hpWin" title="완화 배율·반동·드레인 계산 창">「HP」 창</button></div>`:'';
 const effHtml=(kind,name,fallback)=>window.OM_DB_UI.effectHtml(kind,name)||`<span class="small dim">${esc(fallback||'')}</span>`;
 /* 10-21 망령: 시트와 같은 카드 — 포텐셜은 분류 꼬리표 · 「」【】 강조 · ① ② 줄 나눔, 기술은 타입 색 띠 카드 */
 const SH=window.OM_SHEET_UI||{};const pf=SH.potFmt||(t=>esc(t||''));const pk=SH.potKind||(k=>({no:'',lab:k||''}));const HUE=SH.POT_HUE||{};
 const potCard=(p,kind)=>{const k=pk(kind||p.kind);const hue=kind==='전용'?'#ffd84a':(HUE[k.lab]||'#3fc7c0');return `<div class="potc${p.ph?' ph':''}${kind==='전용'?' ex':''}" style="--ph:${hue}"><div class="poth"><span class="potk">${k.no?`<em>${esc(k.no)}</em>`:''}${k.lab?`<span>${esc(k.lab)}</span>`:''}</span><b class="potn">${esc(p.name)}${p.ph?' <small>(미정)</small>':''}</b><span class="sp"></span>${p.ph?'':an('pot',p.name)}</div>${p.ph?'':`<div class="pote">${pf(String(p.eff||'').replace(/<br\s*\/?>/gi,'\n'))}</div>`}</div>`};
 const tcol=en=>{try{return S().typeColor(en).bg}catch(e){return '#666'}};
 const ctSpan=mv=>{const c=contactOf(mv);return c==='O'?'<span class="mvct" title="접촉 기술">접촉</span>':c==='X'?'<span class="mvct no" title="비접촉 기술">비접촉</span>':''};
 const mvCard=mv=>{const pr=+mv.prio||0;return `<div class="mvc" style="--tc:${tcol(mv.typeEn)}"><div class="mvh">${typeChip(mv.typeEn)}<b class="mvn">${esc(mv.name)}</b>${mv.half?'<span class="small muted">½</span>':''}${mv.missing?'<span class="small" style="color:var(--red)">DB 없음</span>':''}${mv.adj?'<span class="mvadj" title="이 포켓몬만 조정한 기술">조정됨</span>':''}<span class="sp"></span><span class="mvcat c-${({물리:'p',특수:'s',변화:'x'})[mv.cat]||'x'}">${esc(mv.cat||'-')}</span>${ctSpan(mv)}</div><div class="mvs"><span><small>위력</small><b>${mv.pow||'-'}</b></span><span><small>명중</small><b>${mv.acc||'필중'}</b></span><span><small>범위</small><b>${esc(mv.range||'-')}</b></span><span class="${pr?'hot':''}"><small>우선</small><b>${pr>0?'+'+pr:pr}</b></span></div>${mv.eff?`<div class="mve">${pf(mv.eff)}</div>`:''}</div>`};
 const pots=(m.pots||[]).filter(p=>p&&p.name);const uniq=(tr.unique||[]).filter(u=>u&&u.name);
 const md=openModal(`<div class="mhead"><h2>${esc(m.name)} <span class="small muted">상세</span></h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
  <div class="dxhead"><div class="dxpic" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}"></div>
   <div class="dxinfo"><div class="dxname">${esc(m.name)}<span class="lv">Lv.${m.lv}</span><span class="small muted">${esc(tr.name)}</span><span class="row ${full?'dxed':''}" ${full?'data-ed="types" title="눌러서 타입 바꾸기"':''} style="gap:4px;display:inline-flex">${m.types.filter(t=>t!=='-').map(typeChip).join('')}</span>${full?`<button class="btn xs ghost" data-ed="types" title="18 타입 단추로 타입 바꾸기">타입 변경</button>${m.typesOrig?'<button class="btn xs ghost" data-ed="types0" title="원래 타입으로">원래대로</button>':''}`:''}${m.tera&&m.tera!=='-'?`<span class="badge">테라 ${esc(m.tera)}</span>`:''}${m.role?`<span class="badge">${esc(m.role)}</span>`:''}${m.pride?`<span class="badge">프라이드 ${esc(m.pride)}</span>`:''}</div>
    <div class="dxhp"><div class="hpbar ${pct<=25?'low':pct<=50?'mid':''}"><i style="width:${pct}%"></i></div><span class="mono">${full?m.hp.cur+' / '+m.hp.max:pct+'%'}</span></div>
    <div class="dxrow"><span class="k">특성</span><span><b class="${full?'dxed':''}" ${full?'data-ed="ability" title="눌러서 특성 바꾸기"':''}>${esc(m.ability||'-')}</b>${m.abilityOrig!=null?`<span class="small dim"> (원래 ${esc(m.abilityOrig||'없음')})</span>`:''}${full?`<button class="btn xs ghost" data-ed="ability" title="특성 DB 에서 골라 바꾸기">특성 변경</button>${m.abilityOrig!=null?'<button class="btn xs ghost" data-ed="ability0">원래대로</button>':''}`:''}${an('trait',m.ability)}<div class="dbmini">${effHtml('trait',m.ability,m.abilityEff)}</div></span></div>
    <div class="dxrow"><span class="k">소지품</span><span><b class="${full?'dxed':''}" ${full?'data-ed="item" title="눌러서 소지품 바꾸기"':''}>${esc(m.item||'-')}</b>${full?`<button class="btn xs ghost" data-ed="item" title="소지품 DB 에서 골라 지니게 하기">착용</button>${m.item?'<button class="btn xs ghost" data-ed="item0" title="소지품 떼기">떼기</button>':''}`:''}${an('item',m.item)}<div class="dbmini">${effHtml('item',m.item,m.itemEff)}</div></span></div>
   </div><div class="dxside dxaffs"><div class="k">상성</div>${affHtml(m)}</div></div>
  <div class="dxlow"><div class="dxabil ${full?'dxed':''}" ${full?'data-ed="base" title="눌러서 종족치 바꾸기"':''}><div class="k">능력${full?' <button class="btn xs ghost" data-ed="base" title="랭크 한 단계씩 ▲▼ 또는 수치 입력">종족치 변경</button>':''}</div>${stat6}</div><div class="dxnowc">${(()=>{const U=window.OM_BATTLE_UI;if(U&&U.nowEditHtml)return U.nowEditHtml(m,full);if(!U||!U.nowParts||!m.entry)return '<div class="k">랭크 · 상태</div><div class="small dim">필드에 나와 있지 않다</div>';const P=U.nowParts(m);const row=(k,h)=>`<div class="dxnow"><div class="k">${k}</div><div class="rks">${h||'<span class="small dim">없음</span>'}</div></div>`;return row('랭크 · 배율',P.rank)+row('상태',P.state)+row('효과',P.fx)})()}</div></div>
  ${hpRow}
  <div class="sec">기술 <span class="note">${m.moves.length}개</span></div>
  <div class="smvg dxmvg">${m.moves.map(mvCard).join('')}</div>
  ${pots.length?`<div class="sec">포텐셜 <span class="note">${pots.filter(p=>!p.ph).length}</span></div><div class="dxpots dxpc">${pots.map(p=>potCard(p)).join('')}</div>`:''}
  <div class="sec">전용 포텐셜 <span class="note">${esc(m.name)}</span></div>${m.excl||(m.exclX||[]).length?`<div class="dxpots dxpc">${[...(m.excl?[m.excl]:[]),...(m.exclX||[])].map(p=>potCard(p,'전용')).join('')}</div>`:'<div class="small dim" style="padding:4px 2px">전용 포텐셜이 없다</div>'}
  ${full&&m.memo?`<div class="sec">메모</div><div class="pre small muted">${esc(m.memo)}</div>`:''}`);
 md.classList.add('wide');
 if(full&&window.OM_BATTLE_UI&&window.OM_BATTLE_UI.bindNowEdit)window.OM_BATTLE_UI.bindNowEdit($('.dxnowc',md),mid);
 md.querySelectorAll('[data-ed]').forEach(el=>el.onclick=e=>{e.stopPropagation();monChange(mid,el.dataset.ed)});
 if(ST.role==='gm'||full){const amt=v=>{v=String(v||'').trim();const f=v.match(/^(\d+)\s*\/\s*(\d+)$/);if(f)return Math.max(1,Math.floor(m.hp.max*+f[1]/+f[2]));return Math.max(0,Math.floor(+v||0))};
  const ap=async(cur,msg)=>{cur=Math.max(0,Math.min(m.hp.max,cur));closeModal();const nh=Object.assign({},m.hp,{cur,latest:m.hp.cur});const dl=cur-m.hp.cur;if(await set(['battle','mons',mid,'hp'],nh))sysLog(`【${dl<0?'피해':'회복'}】 ${m.name} ${dl<0?'−':'+'}${Math.abs(dl)}  ·  HP ${m.hp.cur} → ${cur}/${m.hp.max}\n${msg}${cur<=0?`\n${m.name}은(는) 쓰러졌다!`:''}`,'battle',{mid,img:m.image||'',hp:{name:m.name,prev:m.hp.cur,cur,max:m.hp.max,why:String(msg).replace(/^에게 /,''),faint:cur<=0}})};
  $('#hpDmg',md).onclick=()=>{const v=$('#hpd',md).value;const d=amt(v);if(d)ap(m.hp.cur-d,`에게 ${d} 대미지${/\//.test(v)?' ('+v.trim()+')':''}`)};$('#hpHeal',md).onclick=()=>{const v=$('#hpd',md).value;const d=amt(v);if(d)ap(m.hp.cur+d,`${d} 회복${/\//.test(v)?' ('+v.trim()+')':''}`)};$('#hpFull',md).onclick=()=>ap(m.hp.max,'전부 회복');
  /* 10-21 망령: 되돌리기 — hp.latest(맵툴 HP_latest)로 가장 최근 피해·회복을 취소. 바꾼 값은 다시 latest 에 두어 한 번 더 누르면 다시 적용 */
  const hu=$('#hpUndo',md);if(hu)hu.onclick=async()=>{const cm=((ST.state.battle||{}).mons||{})[mid]||m;const l=cm.hp.latest;if(l==null||+l===+cm.hp.cur)return;const cur=Math.max(0,Math.min(cm.hp.max,+l)),was=+cm.hp.cur,mx=cm.hp.max,nm=cm.name,ent=cm.entry;closeModal();const nh=Object.assign({},cm.hp,{cur,latest:was});if(await set(['battle','mons',mid,'hp'],nh))sysLog(`${nm} HP 되돌리기 ${was} → ${cur}/${mx}${was<=0&&cur>0&&!ent?' · 빈사에서 되돌렸다 (필드에 다시 내려면 「등장」)':''}${cur<=0?' · 빈사!':''}`,'battle')};
  md.querySelectorAll('[data-an]').forEach(bt=>bt.onclick=()=>{if(window.OM_BATTLE_UI&&window.OM_BATTLE_UI.action){window.OM_BATTLE_UI.action({act:'announce',mid,kind:bt.dataset.an,pot:bt.dataset.ann});bt.textContent='📢 출력됨';bt.disabled=true}});
  md.querySelectorAll('[data-hpf]').forEach(bt=>bt.onclick=()=>{const f=bt.dataset.hpf;ap(m.hp.cur-amt(f),`비례 대미지 ${f} (−${amt(f)})`)});
  md.querySelectorAll('[data-hph]').forEach(bt=>bt.onclick=()=>{const f=bt.dataset.hph;ap(m.hp.cur+amt(f),`비례 회복 ${f} (+${amt(f)})`)});
  const hw=$('#hpWin',md);if(hw)hw.onclick=()=>{closeModal();if(window.OM_BATTLE_UI&&window.OM_BATTLE_UI.openHp)window.OM_BATTLE_UI.openHp(mid)}}}

/* 배틀 중 포켓몬 바꾸기: 타입 · 종족치 · 특성 · 소지품. 타입·특성은 효과(fx)의 「변경」과 같은 꼴(typesOrig · abilityOrig)로 남겨 효과 칸에서 원래대로 돌릴 수 있다 */
function openMonEdit(mid,focus){
 const m=(B().mons||{})[mid];if(!m)return;const D=window.OM_DB||{};const kor=((D.types||{}).kor||[]).filter(x=>x!=='-');const K=S().STATS_KO;
 const ko=t=>t&&t!=='-'?S().typeKo(t):'-';const tk=[0,1,2].map(i=>ko(m.types[i]));
 const sel=i=>`<select data-et="${i}">${['-',...kor].map(x=>`<option ${tk[i]===x?'selected':''}>${x}</option>`).join('')}</select>`;
 const md=openModal(`<div class="mhead"><h2>${esc(m.name)} <span class="small muted">바꾸기</span></h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
  <div class="small dim" style="margin-bottom:8px">지금 배틀의 이 포켓몬만 바뀐다 (시트는 그대로). 타입·특성은 효과 칸에 「변경」으로 남아 원래대로 돌릴 수 있다.</div>
  <table class="t mved">
   <tr><th>타입</th><td><div class="row">${sel(0)}${sel(1)}${sel(2)}${m.typesOrig?`<span class="small dim">원래 ${m.typesOrig.filter(t=>t!=='-').map(ko).join('/')}</span><button class="btn xs ghost" data-er="types">원래대로</button>`:''}</div></td></tr>
   <tr><th>종족치</th><td><div class="row mvbase">${m.base.map((v,i)=>`<label class="small">${K[i]}<input type="number" class="n" data-eb="${i}" value="${v}"></label>`).join('')}</div></td></tr>
   <tr><th>특성</th><td><div class="row"><input type="text" id="edAb" list="edAbL" value="${esc(m.ability||'')}" style="flex:1"><button class="btn sm" data-edb="trait">DB</button>${m.abilityOrig!=null?`<span class="small dim">원래 ${esc(m.abilityOrig||'없음')}</span><button class="btn xs ghost" data-er="ability">원래대로</button>`:''}</div><datalist id="edAbL">${Object.keys(D.traits||{}).map(n=>`<option value="${esc(n)}">`).join('')}</datalist></td></tr>
   <tr><th>소지품</th><td><div class="row"><input type="text" id="edIt" list="edItL" value="${esc(m.item||'')}" style="flex:1"><button class="btn sm" data-edb="item">DB</button><button class="btn xs ghost" id="edItClr">비우기</button></div><datalist id="edItL">${Object.keys(D.items||{}).map(n=>`<option value="${esc(n)}">`).join('')}</datalist></td></tr>
  </table>
  <div class="row" style="margin-top:12px"><span class="sp"></span><button class="btn pri" id="edOk">적용</button></div>`);
 const ab=$('#edAb',md),it=$('#edIt',md);
 md.querySelectorAll('[data-edb]').forEach(bt=>bt.onclick=()=>{const k=bt.dataset.edb;const cur={types:[0,1,2].map(i=>$(`[data-et="${i}"]`,md).value),base:[...md.querySelectorAll('[data-eb]')].map(x=>x.value),ab:ab.value,it:it.value};
  /* DB 창이 이 창을 덮으니, 고른 뒤 적던 값 그대로 다시 연다 */
  window.OM_DB_UI.open({kind:k,sel:k==='trait'?ab.value:it.value,pick:n=>{openMonEdit(mid);const m2=$('.modal');[0,1,2].forEach(i=>$(`[data-et="${i}"]`,m2).value=cur.types[i]);m2.querySelectorAll('[data-eb]').forEach((x,i)=>x.value=cur.base[i]);$('#edAb',m2).value=k==='trait'?n:cur.ab;$('#edIt',m2).value=k==='item'?n:cur.it}})});
 $('#edItClr',md).onclick=()=>{it.value='';it.focus()};
 const save=async(fn)=>{const m0=JSON.parse(JSON.stringify(B().mons[mid])),x=JSON.parse(JSON.stringify(m0));const L=fn(x);if(!L.length){closeModal();return openMon(mid)}
  if(await setDiff(['battle','mons',mid],m0,x)){sysLog(`${m0.name} ${L.join(' · ')}`,'battle');toast('바꿨다')}closeModal();openMon(mid)};
 md.querySelectorAll('[data-er]').forEach(bt=>bt.onclick=()=>save(x=>{if(bt.dataset.er==='types'&&x.typesOrig){x.types=x.typesOrig;x.typesKo=x.types.map(ko);delete x.typesOrig;delete x.typesBy;return ['타입 원래대로']}
  if(bt.dataset.er==='ability'&&x.abilityOrig!=null){if(window.OM_FX&&x.ability)window.OM_FX.removeByName(x,x.ability);x.ability=x.abilityOrig;const a=((D.traits||{})[x.ability])||{};x.abilityEff=String(a.multi||a.single||'').replace(/<br\s*\/?>/gi,'\n');delete x.abilityOrig;delete x.abilityBy;return [`특성 원래대로 「${x.ability||'없음'}」`]}return []}));
 $('#edOk',md).onclick=()=>save(x=>{const L=[];
  const nt=[0,1,2].map(i=>{const v=$(`[data-et="${i}"]`,md).value;return v==='-'?'-':S().typeEn(v)});
  if(nt.join()!==x.types.slice(0,3).concat(['-','-','-']).slice(0,3).join()){if(!x.typesOrig){x.typesOrig=x.types.slice();x.typesBy='직접 변경'}x.types=nt;x.typesKo=nt.map(ko);if(x.typesOrig.join()===nt.join()){delete x.typesOrig;delete x.typesBy}L.push('타입 → '+(nt.filter(t=>t!=='-').map(ko).join('/')||'없음'))}
  const nb=[...md.querySelectorAll('[data-eb]')].map(e=>Math.max(1,+e.value||0));
  if(nb.join()!==x.base.join()){const full=x.hp.cur>=x.hp.max,oldMax=x.hp.max;x.base=nb;x.ranks=nb.map(S().gradeOf);x.stats=S().statsOf(nb,x.iv,x.ev,x.lv);x.hp.max=x.stats[0];x.hp.cur=x.hp.cur<=0?0:full?x.hp.max:Math.max(1,Math.min(x.hp.max,x.hp.cur+x.hp.max-oldMax));L.push('종족치 → '+nb.join('/'))}
  const na=ab.value.trim();if(na!==(x.ability||'')){const FX=window.OM_FX;if(FX&&x.ability)FX.removeByName(x,x.ability);if(x.abilityOrig==null){x.abilityOrig=x.ability||'';x.abilityBy='직접 변경'}x.ability=na;const a=((D.traits||{})[na])||{};x.abilityEff=String(a.multi||a.single||'').replace(/<br\s*\/?>/gi,'\n');if(x.abilityOrig===na){delete x.abilityOrig;delete x.abilityBy}L.push(`특성 → 「${na||'없음'}」`)}
  const ni=it.value.trim();if(ni!==(x.item||'')){const FX=window.OM_FX;if(FX&&x.item)FX.removeByName(x,x.item);x.item=ni;x.itemEff=String((((D.items||{})[ni])||{}).eff||'');L.push(ni?`소지품 → 「${ni}」`:'소지품 비움')}
  return L});
 const f={types:'[data-et="0"]',base:'[data-eb="0"]',ability:'#edAb',item:'#edIt'}[focus];const fe=f&&$(f,md);if(fe){fe.focus();if(fe.select)fe.select()}}

/* 배틀 상세의 바꾸기 (망령 10-21): 타입 = 18 타입 단추 창 · 종족치 = 랭크 ▲▼ 창 · 특성 · 소지품 = DB 창. 지금 배틀의 이 포켓몬만 (시트는 그대로).
   타입 · 특성은 효과(fx)의 「변경」과 같은 꼴(typesOrig · abilityOrig)로 남겨 원래대로 돌릴 수 있다 */
function monChange(mid,kind){const m=(B().mons||{})[mid];if(!m)return;const D=window.OM_DB||{};const P=window.OM_PICK;const ko=t=>t&&t!=='-'?S().typeKo(t):'-';
 const save=async fn=>{const m0=JSON.parse(JSON.stringify(B().mons[mid])),x=JSON.parse(JSON.stringify(m0));const L=fn(x);if(L.length&&await setDiff(['battle','mons',mid],m0,x)){sysLog(`${m0.name} ${L.join(' · ')}`,'battle');toast('바꿨다')}openMon(mid)};
 const setTypes=(x,nt)=>{if(!x.typesOrig){x.typesOrig=x.types.slice();x.typesBy='직접 변경'}x.types=nt;x.typesKo=nt.map(ko);if(x.typesOrig.join()===nt.join()){delete x.typesOrig;delete x.typesBy}return '타입 → '+(nt.filter(t=>t!=='-').map(ko).join('/')||'없음')};
 const setAb=(x,na)=>{const FX=window.OM_FX;if(FX&&x.ability)FX.removeByName(x,x.ability);if(x.abilityOrig==null){x.abilityOrig=x.ability||'';x.abilityBy='직접 변경'}x.ability=na;const a=((D.traits||{})[na])||{};x.abilityEff=String(a.multi||a.single||'').replace(/<br\s*\/?>/gi,'\n');if(x.abilityOrig===na){delete x.abilityOrig;delete x.abilityBy}return `특성 → 「${na||'없음'}」`};
 const setIt=(x,ni)=>{const FX=window.OM_FX;if(FX&&x.item)FX.removeByName(x,x.item);x.item=ni;x.itemEff=String((((D.items||{})[ni])||{}).eff||'');return ni?`소지품 → 「${ni}」`:'소지품 뗌'};
 if(!P)return openMonEdit(mid,kind);
 switch(kind){
  case 'types':return P.types(m.types,{title:m.name+' — 타입 변경',orig:m.typesOrig,note:'지금 배틀의 이 포켓몬만 바뀐다 (시트는 그대로). 효과 칸에 「변경」으로 남는다.'},nt=>save(x=>nt.join()===x.types.slice(0,3).concat(['-','-','-']).slice(0,3).join()?[]:[setTypes(x,nt)]));
  case 'types0':return save(x=>{if(!x.typesOrig)return [];x.types=x.typesOrig;x.typesKo=x.types.map(ko);delete x.typesOrig;delete x.typesBy;return ['타입 원래대로']});
  case 'base':return P.base(m.base,{title:m.name+' — 종족치 변경',lv:m.lv,iv:m.iv,ev:m.ev,note:'지금 배틀의 이 포켓몬만 (시트는 그대로). 최대 HP 가 바뀌면 그 차이만큼 지금 HP 도.'},nb=>save(x=>{if(nb.join()===x.base.join())return [];const full=x.hp.cur>=x.hp.max,oldMax=x.hp.max;x.base=nb;x.ranks=nb.map(S().gradeOf);x.stats=S().statsOf(nb,x.iv,x.ev,x.lv);x.hp.max=x.stats[0];x.hp.cur=x.hp.cur<=0?0:full?x.hp.max:Math.max(1,Math.min(x.hp.max,x.hp.cur+x.hp.max-oldMax));return ['종족치 → '+nb.join('/')]}));
  case 'ability':return window.OM_DB_UI.open({kind:'trait',sel:m.ability||'',pick:n=>save(x=>n===(x.ability||'')?[]:[setAb(x,n)])});
  case 'ability0':return save(x=>{if(x.abilityOrig==null)return [];const o=x.abilityOrig;const L=setAb(x,o);delete x.abilityOrig;delete x.abilityBy;return [`특성 원래대로 「${o||'없음'}」`]});
  case 'item':return window.OM_DB_UI.open({kind:'item',sel:m.item||'',pick:n=>save(x=>n===(x.item||'')?[]:[setIt(x,n)])});
  case 'item0':if(!confirm(`「${m.item}」을(를) 뗄까?`))return;return save(x=>x.item?[setIt(x,'')]:[]);
  default:return openMonEdit(mid,kind)}}

/* ---------- 좌석 ---------- */
/* 관전자도 이름을 정해 접속자 칸에 보이게 */
function openNick(){const isG=ST.role==='gm';const m=openModal(`<div class="mhead"><h2>${isG?'GM 닉네임':'내 이름'}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><p class="small muted">${isG?'GM 이 여럿일 때 접속자 칸 · 입력 중 표시 · 채팅에 「GM · 닉」으로 보인다.':'접속자 칸과 입력 중 표시에 이 이름이 보인다. 자리에 앉으면 그 자리 이름을 따른다.'}</p><div class="row"><input type="text" id="nickIn" value="${esc(isG?(ST.gmNick||''):(ST.name||''))}" placeholder="닉네임" style="flex:1"><button class="btn pri" id="nickOk">저장</button></div>${ST.role?'':'<div class="row" style="margin-top:8px"><button class="btn sm" id="nickSeat">자리에 앉기</button></div>'}`);
 const ok=async()=>{const n=$('#nickIn',m).value.trim();if(isG){ST.gmNick=n;LS.set('om_gmnick_'+ST.room,n);closeModal();sayHello(true);drawPresence();return toast(n?`이제 「GM · ${n}」로 보인다`:'GM 닉을 비웠다')}if(!n)return toast('이름을 적어 줘');ST.name=n;LS.set('om_name_'+ST.room,n);if(ST.role==='seat'){const info=LS.get('om_seat_'+ST.room,null);if(String(ST.secret).startsWith('u:')){try{await DBS().claimSeat(ST.room,ST.seat,ST.secret,n)}catch(e){}}else if(info){info.name=n;LS.set('om_seat_'+ST.room,info);try{await DBS().claimSeat(ST.room,ST.seat,ST.secret,n)}catch(e){}}}closeModal();sayHello(true);drawPresence();renderRoom();toast(`이제 「${n}」로 보인다`)};
 $('#nickOk',m).onclick=ok;$('#nickIn',m).onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing)ok()};const ns=$('#nickSeat',m);if(ns)ns.onclick=()=>{closeModal();openSeatPicker()}}
/* 로그 저장: 방의 전체 로그를 HTML(아바타 · 그림 · 배틀 카드 · 날짜 구분) 또는 TXT 로. 설정은 om_logsave 에 기억 */
async function fetchAllLog(){const out=[];let after=0;for(let i=0;i<200;i++){const rows=await DBS().getLog(ST.room,after,1000);if(!rows||!rows.length)break;out.push(...rows);after=rows[rows.length-1].id;if(rows.length<1000)break}return out}
function logKind(r){const d=r.data||{};if(r.kind==='chat'&&d.bat)return d.bat==='battle'?'battle':'sys';if(r.kind==='chat'&&d.sms)return 'sms';if(r.kind==='whisper')return 'whisper';if(r.kind==='dice')return 'dice';if(r.kind==='chat')return 'chat';if(r.kind==='battle')return 'battle';return 'sys'}
const LOGSAVE_KEY='om_logsave';function logSaveCfg(){const d={chat:1,dice:1,battle:1,sms:0,whisper:0,ooc:0,av:1,img:1,days:1,theme:'dark',size:15,narr:1,pav:36,pshape:'round',pside:'left'};let c=d;try{c=Object.assign(d,JSON.parse(localStorage.getItem(LOGSAVE_KEY)||'{}'))}catch(e){}if(!['off','with','only'].includes(c.oocm))c.oocm=c.ooc?'with':'off';return c}
function buildLogHtml(rows,o){const esc2=x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const name=(ST.roomRow&&ST.roomRow.name)||ST.room;const stamp=new Date().toISOString().slice(0,10);
 const dark=o.theme!=='light';const C=dark?{bg:'#101114',card:'#17181d',line:'#2a2b31',fg:'#ececec',mute:'#8a8f99',me:'#2a1d1f',sys:'#1c1d22'}:{bg:'#f6f3ec',card:'#ffffff',line:'#d9d4c8',fg:'#1a1a1f',mute:'#6a7179',me:'#fff1f1',sys:'#efece4'};
 const css=`body{background:${C.bg};color:${C.fg};font-family:"Noto Sans KR","Malgun Gothic",sans-serif;font-size:${+o.size||15}px;margin:0;padding:24px 16px 60px}
 .wrap{max-width:860px;margin:auto}h1{font-size:22px;margin:0 0 4px;border-bottom:3px solid #d9243f;padding-bottom:8px}h1 small{font-size:12px;color:${C.mute};font-weight:400;margin-left:8px}
 .day{text-align:center;margin:22px 0 10px;color:${C.mute};font-size:12px;letter-spacing:.08em}.day span{background:${C.card};border:1px solid ${C.line};padding:3px 12px;border-radius:999px}
 .m{display:flex;gap:10px;align-items:flex-start;margin:8px 0}.m.me{flex-direction:row-reverse}.av{width:${+o.pav||36}px;height:${+o.pav||36}px;border-radius:${o.pshape==='square'?'6px':'50%'};flex:none;background:${C.line} center/cover no-repeat;border:2px solid ${C.line}}.av.none{${o.pav>0?'visibility:hidden':'display:none'}}${o.pside==='none'?'.av{display:none}':''}
 .bub{background:${C.card};border:1px solid ${C.line};padding:8px 12px;border-radius:4px 14px 14px 14px;max-width:78%;white-space:pre-wrap;line-height:1.55}.me .bub{border-radius:14px 4px 14px 14px;background:${C.me}}
 .who{display:block;font-size:12px;color:#f5d000;font-weight:700;margin-bottom:2px}.tm{font-size:11px;color:${C.mute};align-self:flex-end;white-space:nowrap}
 .bub img{display:block;max-width:360px;max-height:360px;border-radius:8px;margin:4px 0}
 .narr .bub{font-style:italic;color:${C.mute};background:transparent;border-style:dashed}
 .sys{justify-content:center}.sys .bub{font-size:12px;color:${C.mute};background:${C.sys};border-radius:999px;padding:3px 12px}
 .ooc .bub{opacity:.75;border-style:dashed}.ooc .who::after{content:" · 잡담";font-weight:400;color:${C.mute}}.dice .bub{border-left:4px solid #3b8bd6}.whisper .bub{border-left:4px solid #9b6bd6;opacity:.9}.sms .bub{border-left:4px solid #2f8f5b}.sms .who::before{content:"📱 "}
 .card{border:1px solid ${C.line};border-left:5px solid var(--tc);background:${C.card};padding:8px 12px;border-radius:6px;max-width:78%;line-height:1.5}.card .tag{display:inline-block;font-size:11px;background:var(--tc);color:#fff;padding:1px 7px;border-radius:3px;margin-right:6px}.card b{font-size:14px}.card .eff{color:${C.mute};font-size:12px;margin-top:4px;white-space:pre-wrap}.card .bl{font-size:13px}.card .bl.pos{color:#3aa65d}.card .bl.neg{color:#d9243f}`;
 let lastDay='';const out=[];
 for(const r of rows){const d=r.data||{};const k=logKind(r);const at=new Date(r.at);const dayKey=isNaN(at)?'':`${at.getFullYear()}.${String(at.getMonth()+1).padStart(2,'0')}.${String(at.getDate()).padStart(2,'0')}`;const hm=isNaN(at)?'':`${String(at.getHours()).padStart(2,'0')}:${String(at.getMinutes()).padStart(2,'0')}`;
  if(o.days&&dayKey&&dayKey!==lastDay){lastDay=dayKey;out.push(`<div class="day"><span>${dayKey}</span></div>`)}
  if(k==='sys'||(k==='chat'&&d.clear)){out.push(`<div class="m sys"><div class="bub">${esc2(d.clear?'무대를 비웠다':d.t)}</div></div>`);continue}
  if(k==='battle'){const t=String(d.t||'');const m=t.match(/^【([^】]+)】\s*([^\n]*)\n?([\s\S]*)$/);
   if(m){const col=TAGCOL[m[1]]||'#555';const lines=m[3].trim().split('\n').filter(Boolean).map(l=>`<div class="bl ${/실패|차단|없|않/.test(l)?'neg':/\+\d|회복|성공|→/.test(l)?'pos':''}">${esc2(l)}</div>`).join('');
    out.push(`<div class="m"><div class="av ${(+o.pav>0)&&d.img?'':'none'}" style="${(+o.pav>0)&&d.img?`background-image:url('${cssu(d.img)}')`:''}"></div><div class="card" style="--tc:${col}"><span class="tag">${esc2(m[1])}</span><b>${esc2(m[2])}</b>${d.eff?`<div class="eff">${esc2(d.eff)}</div>`:''}${lines}</div><span class="tm">${hm}</span></div>`);continue}
   out.push(`<div class="m sys"><div class="bub">${esc2(t)}</div></div>`);continue}
  if(!d.t&&!d.img)continue;
  const lf=k==='chat'&&!isOoc(r)?lineFmt(d):{narr:false,text:String(d.t||'')};const narr=o.narr&&lf.narr;const text=lf.narr?lf.text:String(d.t||'');
  const who=k==='whisper'?`${r.who} → ${d.toName||d.to||''}`:chatName(r);const av=(+o.pav>0)?avatarOf(r):'';
  out.push(`<div class="m ${k} ${narr?'narr':''} ${isOoc(r)&&o.oocm!=='only'?'ooc':''}"><div class="av ${av?'':'none'}" style="${av?`background-image:url('${cssu(av)}')`:''}"></div><div class="bub"><span class="who">${esc2(who)}</span>${o.img&&d.img?`<a href="${esc2(d.img)}" target="_blank"><img src="${esc2(d.img)}" alt=""></a>`:''}${esc2(text)}</div><span class="tm">${hm}</span></div>`)}
 /* 다른 도구(맵툴 로그 정리기)가 그대로 읽을 수 있게 원본 줄 · 초상 · 트레이너 이름을 JSON 으로 함께 넣는다 */
 const por={};for(const r of rows){const d=r.data||{};const nm=String(chatName(r)).trim();if(nm&&por[nm]===undefined){const u=avatarOf(r);por[nm]=u||''}}
 const tn={};for(const t of Object.values((ST.state.roster||{}).trainers||{}))if(t&&t.id)tn[t.id]=t.name;
 const pack=JSON.stringify({v:1,room:ST.room,name,exported:new Date().toISOString(),por,trainers:tn,rows:rows.map(r=>{let data=r.data;if(r.kind==='chat'&&data&&!data.as&&!isOoc(r)){const cn=chatName(r);if(cn&&cn!==r.who)data=Object.assign({},data,{as:cn})}if(r.kind==='chat'&&data&&data.nf&&data.t&&!isOoc(r)){const f=lineFmt(data);if(f.narr&&!/^\*.+\*$/s.test(String(data.t).trim()))data=Object.assign({},data,{t:'*'+String(data.t).trim()+'*'})}return {id:r.id,at:r.at,kind:r.kind,who:r.who,data}})}).replace(/</g,'\\u003c');
 return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="generator" content="oremas"><title>${esc2(name)} 로그</title><style>${css}</style></head><body><div class="wrap"><h1>${esc2(name)}${o.oocm==='only'?' · 잡담':''}<small>${stamp} · ${rows.length}줄 · 오레마스</small></h1>${out.join('\n')}</div><script type="application/json" id="oremas-log">${pack}</script></body></html>`}
function openSaveLog(){const o=logSaveCfg();const ck=(id,l,on)=>`<label class="small" style="display:inline-flex;align-items:center;gap:5px"><input type="checkbox" data-ls="${id}" ${on?'checked':''}> ${l}</label>`;
 const m=openModal(`<div class="mhead"><h2>로그 저장</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
 <p class="small muted">방의 전체 로그를 파일로 내려받는다. 설정은 이 브라우저에 기억된다.</p>
 <div class="sec">넣을 것</div>
 <div class="row" style="flex-wrap:wrap;gap:12px">${ck('chat','대화',o.chat)}${ck('dice','주사위',o.dice)}${ck('battle','배틀 · 시스템',o.battle)}${ck('sms','문자',o.sms)}${ck('whisper','귓속말 (내 것만)',o.whisper)}</div>
 <div class="sec" style="margin-top:10px">잡담 탭</div>
 <div class="row" style="flex-wrap:wrap;gap:12px">${[['off','넣지 않기 (세션만)'],['with','함께 넣기'],['only','잡담만 따로']].map(([v,l])=>`<label class="small" style="display:inline-flex;align-items:center;gap:5px"><input type="radio" name="lg_oocm" value="${v}" ${o.oocm===v?'checked':''}> ${l}</label>`).join('')}</div>
 <p class="small muted" style="margin:4px 0 0">「함께 넣기」는 잡담 줄을 점선 말풍선 · [잡담] 표시로 구분한다. 「잡담만 따로」는 위의 「넣을 것」과 상관없이 잡담 탭 줄만 모은다.</p>
 <div class="sec" style="margin-top:10px">보기 (HTML)</div>
 <div class="row" style="flex-wrap:wrap;gap:12px">${ck('img','올린 그림',o.img)}${ck('days','날짜 구분선',o.days)}${ck('narr','지문은 기울임',o.narr)}</div>
 <div class="row" style="flex-wrap:wrap;gap:12px;margin-top:6px"><label class="small">포트레이트 <select data-lsv="pav"><option value="0" ${+o.pav===0?'selected':''}>없음</option><option value="28" ${+o.pav===28?'selected':''}>작게</option><option value="36" ${+o.pav===36?'selected':''}>보통</option><option value="52" ${+o.pav===52?'selected':''}>크게</option><option value="72" ${+o.pav===72?'selected':''}>아주 크게</option></select></label><label class="small">모양 <select data-lsv="pshape"><option value="round" ${o.pshape!=='square'?'selected':''}>둥글게</option><option value="square" ${o.pshape==='square'?'selected':''}>네모</option></select></label></div>
 <div class="row" style="flex-wrap:wrap;gap:12px;margin-top:6px"><label class="small">테마 <select data-lsv="theme"><option value="dark" ${o.theme!=='light'?'selected':''}>어둡게</option><option value="light" ${o.theme==='light'?'selected':''}>밝게</option></select></label><label class="small">글씨 <select data-lsv="size">${[13,14,15,16,17,18,20].map(v=>`<option value="${v}" ${+o.size===v?'selected':''}>${v}px</option>`).join('')}</select></label></div>
 <div class="row" style="margin-top:12px">${(window.OM_CONFIG||{}).organizerUrl?`<a class="btn" id="lg_org" target="_blank" rel="noopener" href="${esc((window.OM_CONFIG||{}).organizerUrl)}?oremas=${encodeURIComponent(ST.room)}" title="맵툴 로그 정리기에서 이 방 로그를 바로 연다 (초상·주사위·배틀 카드 그대로)">정리기에서 열기 ↗</a>`:''}<span class="sp"></span><button class="btn" id="lg_txt">TXT 로</button><button class="btn pri" id="lg_html">HTML 로</button></div>`);
 const read=()=>{const c=logSaveCfg();m.querySelectorAll('[data-ls]').forEach(x=>c[x.dataset.ls]=x.checked?1:0);m.querySelectorAll('[data-lsv]').forEach(x=>c[x.dataset.lsv]=x.value);const om=m.querySelector('input[name="lg_oocm"]:checked');c.oocm=om?om.value:'off';c.ooc=c.oocm==='off'?0:1;try{localStorage.setItem(LOGSAVE_KEY,JSON.stringify(c))}catch(e){}return c};
 const go=async fmt=>{const c=read();toast('로그를 읽는 중…');let rows;try{rows=await fetchAllLog()}catch(e){return toast('읽지 못했다: '+e.message)}
  const keep=rows.filter(r=>{const k=logKind(r);if(c.oocm==='only')return isOoc(r);if(isOoc(r))return c.oocm==='with';if(k==='chat')return c.chat;if(k==='dice')return c.dice;if(k==='sms')return c.sms;if(k==='whisper')return c.whisper;return c.battle});
  const name=((ST.roomRow&&ST.roomRow.name)||ST.room).replace(/[\\/:*?"<>|]/g,'_');const stamp=new Date().toISOString().slice(0,10);let blob,fn;
  if(fmt==='txt'){const tm=r=>{const d=new Date(r.at);return isNaN(d)?'':`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};
   const lines=keep.map(r=>{const d=r.data||{};const k=logKind(r);const who=k==='whisper'?`${r.who} → ${d.toName||d.to||''}`:chatName(r);const t=d.clear?'무대를 비웠다':String(d.t||'')+(d.img?' [그림] '+d.img:'');if(!t.trim())return '';return `[${tm(r)}] ${isOoc(r)&&c.oocm!=='only'?'[잡담] ':''}${k==='sms'?'[문자] ':k==='whisper'?'[귓속말] ':''}${who?who+': ':''}${t}`}).filter(Boolean);
   blob=new Blob(['﻿'+lines.join('\n')],{type:'text/plain;charset=utf-8'});fn=`${name}_${c.oocm==='only'?'잡담':'로그'}_${stamp}.txt`}
  else{blob=new Blob([buildLogHtml(keep,c)],{type:'text/html;charset=utf-8'});fn=`${name}_${c.oocm==='only'?'잡담':'로그'}_${stamp}.html`}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fn;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000);closeModal();toast(keep.length?`${keep.length}줄을 저장했다`:'저장할 줄이 없다 (빈 파일)')};
 $('#lg_txt',m).onclick=()=>go('txt');$('#lg_html',m).onclick=()=>go('html')}
/* 로그 비우기 (GM): 「화면 비우기」는 모두의 채팅 창에서 지금까지를 숨긴다 (기록은 남아 로그 저장으로 받을 수 있다). 「완전히 지우기」는 서버에서 지운다 */
function openClearLog(){if(ST.role!=='gm')return;const cut=+((ST.state.rp||{}).logClearAt)||0;
 const m=openModal(`<div class="mhead"><h2>로그 비우기</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
  <div class="row" style="align-items:flex-start;gap:12px;flex-wrap:wrap"><div style="flex:1;min-width:240px"><div class="sec">화면 비우기</div><p class="small muted">모두의 채팅 창에서 지금까지의 로그를 숨긴다. 기록은 남아서 「💾 로그」로 받을 수 있고, 되돌릴 수 있다. 휴대폰 문자는 그대로.</p><div class="row"><button class="btn pri" id="lc_view">화면 비우기</button>${cut?'<button class="btn ghost" id="lc_undo">다시 보이기</button>':''}</div></div>
  <div style="flex:1;min-width:240px"><div class="sec">완전히 지우기</div><p class="small muted">서버에서 로그를 지운다. <b>되돌릴 수 없다.</b> 먼저 로그를 저장해 두길.</p><label class="small"><input type="checkbox" id="lc_sms" checked> 휴대폰 문자는 남기기</label><div class="row" style="margin-top:6px"><button class="btn" id="lc_save">💾 먼저 저장</button><button class="btn danger" id="lc_hard">완전히 지우기</button></div></div></div>`);
 $('#lc_view',m).onclick=async()=>{await set(['rp','logClearAt'],ST.lastLogId||0);closeModal();renderLog(true);toast('채팅 창을 비웠다 — 기록은 남아 있다')};
 const un=$('#lc_undo',m);if(un)un.onclick=async()=>{await set(['rp','logClearAt'],0);closeModal();renderLog(true);toast('지난 로그를 다시 보인다')};
 $('#lc_save',m).onclick=()=>{closeModal();openSaveLog()};
 $('#lc_hard',m).onclick=async()=>{if(!confirm('서버에서 로그를 완전히 지울까? 되돌릴 수 없다.'))return;const before=ST.lastLogId||0;try{const keep=$('#lc_sms',m).checked;const n=await DBS().logClear(ST.room,ST.secret,keep);ST.log=ST.log.filter(r=>r.id>before||(keep&&r.kind==='chat'&&r.data&&r.data.sms));await set(['rp','logClearAt'],0);closeModal();renderLog(true);toast(`로그 ${n||0}줄을 지웠다`)}catch(e){toast('지우지 못했다: '+e.message+' — supabase/schema.sql 을 다시 실행했는지 확인')}}}
function openSeatPicker(){
 const b=B();const ro=(ST.state.roster||{}).trainers||{};const trs=Object.assign({},ro,b.trainers||{});const seats=ST.state.seats||{};const ids=Object.keys(trs);const free=Object.keys(seats).filter(id=>!trs[id]);
 const m=openModal(`<div class="mhead"><h2>자리 고르기</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
  <p class="small muted">이름을 적고 앉으면 된다. 앉은 뒤 시트 탭에서 「내 파티 불러오기」로 제작기의 트레이너를 가져온다. GM 이 먼저 불러온 트레이너가 있으면 그 자리에 바로 앉을 수도 있다. 한 번 앉은 자리는 로그인했으면 계정에(어느 기기에서든 같은 자리), 아니면 이 브라우저에 기억되고, 남이 앉을 수 없다 (옮기려면 GM 이 비워 준다).</p>
  <div class="row" style="margin-bottom:8px"><label>내 이름</label><input type="text" id="seatName" value="${esc(ST.name&&ST.name!=='GM'?ST.name:'')}" placeholder="플레이어 이름" style="flex:1">${ST.role==='seat'?'':'<button class="btn pri" data-seat="new">새 자리에 앉기</button>'}</div>
  ${ST.role==='gm'&&Object.keys(seats).length?`<div class="row fbulk"><button class="btn sm ghost" id="fAll">모두 선택</button>${free.length?`<button class="btn sm ghost" id="fNop">파티 없는 자리만 (${free.length})</button>`:''}<button class="btn sm ghost" id="fNone">선택 해제</button><span class="sp"></span><button class="btn sm danger" id="fGo" disabled>선택한 자리 비우기</button></div>`:''}
  ${ids.length||free.length?`<ul class="pick">${ids.map(id=>{const t=trs[id];const o=seats[id];const mine=ST.seat===id;return `<li>${ST.role==='gm'&&o?`<input type="checkbox" class="fsel" data-fsel="${id}" title="여러 자리 한 번에 비우기">`:''}<b>${esc(t.name)}</b>${t.side?`<span class="badge ${t.side}">${t.side==='left'?'좌측':'우측'}</span>`:''}<span class="small muted">${o?(mine?'내 자리':'앉은 사람: '+esc(o.name)):'빈 자리'}</span><span class="sp"></span>${mine?'<span class="badge seat">나</span>':o?'':(ST.role==='seat'?'':`<button class="btn sm pri" data-seat="${id}">앉기</button>`)}${ST.role==='gm'&&o?`<button class="btn sm ghost danger" data-free="${id}">비우기</button>`:''}</li>`}).join('')}${free.map(id=>{const o=seats[id];const mine=ST.seat===id;return `<li>${ST.role==='gm'?`<input type="checkbox" class="fsel" data-fsel="${id}" data-nop="1" title="여러 자리 한 번에 비우기">`:''}<b>${esc(o.name||id)}</b><span class="small muted">${mine?'내 자리 · 아직 파티 없음':'아직 파티 없음'}</span><span class="sp"></span>${mine?'<span class="badge seat">나</span>':''}${ST.role==='gm'?`<button class="btn sm ghost danger" data-free="${id}">비우기</button>`:''}</li>`}).join('')}</ul>`:'<div class="empty">아직 아무도 없다. 이름을 적고 「새 자리에 앉기」.</div>'}`);
 m.querySelectorAll('[data-seat]').forEach(bt=>bt.onclick=async()=>{const name=$('#seatName',m).value.trim();if(!name)return toast('이름을 적어 줘');
  LS.set('om_name_'+ST.room,name);const info=LS.get('om_seat_'+ST.room,null);const tok=!params().pl&&ACCT.tok();const secret=tok?'u:'+tok:((info&&info.secret)||rnd(24));const seatId=bt.dataset.seat==='new'?('p'+rnd(8).toLowerCase()):bt.dataset.seat;bt.dataset.seat=seatId;
  try{const ok=await DBS().claimSeat(ST.room,seatId,secret,name);if(!ok)return toast('누군가 먼저 앉은 자리다');if(!tok)LS.set("om_seat_"+ST.room,{seat:bt.dataset.seat,secret,name});closeModal();route()}catch(e){toast('앉지 못했다: '+e.message)}});
 m.querySelectorAll('[data-free]').forEach(bt=>bt.onclick=async()=>{try{await DBS().claimSeat(ST.room,bt.dataset.free,ST.secret,null);closeModal();toast('자리를 비웠다')}catch(e){toast(e.message)}});
 /* 여러 자리 한 번에 비우기 (GM) */
 const fs=()=>[...m.querySelectorAll('[data-fsel]')],fGo=$('#fGo',m);
 const fUpd=()=>{if(!fGo)return;const n=fs().filter(x=>x.checked).length;fGo.disabled=!n;fGo.textContent=n?`선택한 자리 비우기 (${n})`:'선택한 자리 비우기'};
 fs().forEach(x=>x.onchange=fUpd);
 const fSet=f=>{fs().forEach(x=>x.checked=f(x));fUpd()};
 if($('#fAll',m))$('#fAll',m).onclick=()=>fSet(()=>true);if($('#fNop',m))$('#fNop',m).onclick=()=>fSet(x=>!!x.dataset.nop);if($('#fNone',m))$('#fNone',m).onclick=()=>fSet(()=>false);
 if(fGo)fGo.onclick=async()=>{const sel=fs().filter(x=>x.checked).map(x=>x.dataset.fsel);if(!sel.length)return;if(!confirm(`자리 ${sel.length}개를 비울까? 앉아 있던 사람은 다시 자리를 골라야 한다 (트레이너 · 파티는 그대로).`))return;
  fGo.disabled=true;let ok=0,bad='';for(const id of sel){fGo.textContent=`비우는 중… ${ok}/${sel.length}`;try{await DBS().claimSeat(ST.room,id,ST.secret,null);ok++;if(ST.state.seats)delete ST.state.seats[id]}catch(e){bad=e.message}}
  toast(bad?`${ok}개 비움 · 실패: ${bad}`:`자리 ${ok}개를 비웠다`);openSeatPicker()}}

const PCT_LABELS=['드물게','저확률','중확률','고확률'];
function pctBase(l){const F=window.OM_FX;return F&&F.percentBase?Math.round(F.percentBase(l)):({드물게:10,저확률:30,중확률:50,고확률:60}[l]||100)}
/* 설정 창: 「내 설정」(OM_PREFS — 소리·알림·글자·이미지·단축키, 이 기기에서만) · 「방 설정」(GM — 방 이름·배틀·확률·자리) */
let SET_TAB='me';
function openRoomSettings(tab){
 const r=ST.roomRow;const isGm=ST.role==='gm';if(typeof tab==='string')SET_TAB=tab;if(!isGm)SET_TAB='me';const rp=ST.state.rp||{};
 const card=(ic,ttl,body,sub)=>`<section class="pf-card"><header><i>${ic}</i><b>${ttl}</b>${sub?`<small>${sub}</small>`:''}</header>${body}</section>`;
 const sw=(id,on,label,sub)=>`<label class="pf-sw"><input type="checkbox" id="${id}" ${on?'checked':''}><i></i><span><b>${label}</b>${sub?`<small>${sub}</small>`:''}</span></label>`;
 const room=isGm?`<div class="pf">
  ${card('🏠','방',`<div class="pf-sel"><span class="pf-lb">방 이름</span><input type="text" id="rn" value="${esc(r.name)}"><button class="btn xs pri" id="rnSave">저장</button></div><div class="pf-note">방 id <span class="mono">${esc(r.id)}</span></div>`)}
  ${(()=>{const own=rp.seatOwn===true,run=!own&&rp.plBattle!==false;return card('⚔','배틀',`<div class="pf-note" style="margin:0 0 6px">플레이어가 배틀에서 어디까지 누를 수 있나 — 위 두 칸은 둘 중 하나만 켠다 (둘 다 끄면 배틀 올리기·진행은 GM 만, 플레이어는 자기 지시만 입력)</div>
   ${sw('plBattle',run,'① 플레이어도 배틀 진행 (모의전)','플레이어도 파티 불러오기 · 시합 개시 · 턴 진행 · 필드를 누른다. GM 없이 플레이어끼리 붙을 때. 엿보기 · 강제 · 모두 공개는 GM 만')}
   ${sw('seatOwn',own,'② 플레이어는 자기 것만 (세션)','플레이어는 자기 트레이너를 배틀에 올리고 자기 포켓몬 · 지시 · 스킬만 만진다. 턴 진행 · 필드 · 남의 HP 는 GM 이')}
   ${sw('gmHands',rp.gmHands===false,'GM 불간섭 (GM 도 플레이어처럼)','플레이어가 배틀에 올린 트레이너의 지시 · 준비 · HP · 랭크 · 상태는 그 플레이어만. GM 이 직접 불러온 파티와 NPC 는 GM 이 그대로 지시하고 턴도 진행한다 (자동 처리는 그대로)')}`)})()}
  ${card('🎲','확률 표식',`<div class="pf-pct">${PCT_LABELS.map(l=>{const base=pctBase(l);const cur=(rp.pct||{})[l];return `<label><span>${l}</span><input type="number" min="0" max="100" step="1" data-pct="${l}" value="${cur!=null&&cur!==''?esc(String(cur)):''}" placeholder="${base}"><em>%</em></label>`}).join('')}</div>
   <div class="row" style="margin-top:8px"><button class="btn xs pri" id="pctSave">저장</button><button class="btn xs ghost" id="pctReset">기본값으로</button></div><div class="pf-note">효과 글의 「드물게·저확률·중확률·고확률」 판정 %. 비운 칸은 흐린 기본값. 이 방에만.</div>`)}
  ${card('🪑','자리',`<div class="row"><button class="btn sm" id="seatMgr">자리 관리</button></div>`)}
  ${card('🔐','입장',`${sw('acctOnly',!!((r.settings||{}).accountOnly),'계정 전용 방','켜면 로그인해야 들어오고, 관리자가 PL 권한을 준 계정만 자리에 앉는다. 예전 방 링크 · GM 링크 · 기기에 기억된 자리는 안 먹힌다 (관리자는 언제나 GM)')}<div class="pf-note">GM · PL 권한은 로비의 「계정 관리」(관리자)에서 준다. 끈 방에서는 로그인한 누구나 들어와 자리에 앉을 수 있고, 앉으면 그 자리가 계정에 붙는다 (PL 권한이 저절로 생긴다).</div>`)}</div>`:'';
 const m=openModal(`<div class="mhead"><h2>설정</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
  <div class="pf-tabs"><button data-stab="me" class="${SET_TAB==='me'?'on':''}"><span>내 설정</span></button>${isGm?`<button data-stab="room" class="${SET_TAB==='room'?'on':''}"><span>방 설정</span></button>`:`<button class="ghost" id="seatMgr2"><span>자리 바꾸기</span></button>`}</div>
  <div id="setBody" class="pf-host">${SET_TAB==='room'&&isGm?room:(window.OM_PREFS?window.OM_PREFS.html():'')}</div>`);
 m.classList.add('setmodal');
 m.querySelectorAll('[data-stab]').forEach(b=>b.onclick=()=>{SET_TAB=b.dataset.stab;openRoomSettings()});
 const s2=$('#seatMgr2',m);if(s2)s2.onclick=()=>{closeModal();openSeatPicker()};
 if(SET_TAB==='me'||!isGm){const host=$('#setBody',m);if(window.OM_PREFS)window.OM_PREFS.bind(host);return}
 const pb=$('#plBattle',m),so=$('#seatOwn',m);
 /* ①·② 는 둘 중 하나만 — 하나가 켜져 있으면 다른 칸은 막아 둔다 */
 const lockPair=()=>{if(!pb||!so)return;pb.disabled=so.checked;so.disabled=pb.checked;for(const x of [pb,so]){const l=x.closest('.pf-sw');if(l){l.classList.toggle('off',x.disabled);l.title=x.disabled?'다른 쪽을 끄면 고를 수 있다':''}}};lockPair();
 if(pb)pb.onchange=async()=>{lockPair();await set(['rp','plBattle'],pb.checked);if(pb.checked&&rp.seatOwn)await set(['rp','seatOwn'],false);sysLog(pb.checked?'방 설정: 플레이어도 배틀을 진행한다 (모의전)':'방 설정: 배틀 진행은 GM 만');toast(pb.checked?'플레이어도 배틀 진행':'배틀 진행은 GM 만')};
 if(so)so.onchange=async()=>{lockPair();await set(['rp','seatOwn'],so.checked);if(so.checked)await set(['rp','plBattle'],false);sysLog(so.checked?'방 설정: 플레이어는 자기 것만 (턴 진행·필드는 GM)':'방 설정: 「자기 것만」을 껐다');toast(so.checked?'플레이어는 자기 것만':'「자기 것만」 끔')};
 const ps=$('#pctSave',m);if(ps)ps.onclick=async()=>{const o={};let bad='';m.querySelectorAll('[data-pct]').forEach(x=>{const v=x.value.trim();if(v==='')return;const n=+v;if(!isFinite(n)||n<0||n>100){bad=x.dataset.pct;return}o[x.dataset.pct]=Math.round(n)});if(bad)return toast(`「${bad}」 은 0~100 사이 숫자로 적어 줘`);
  const has=Object.keys(o).length;if(!await set(['rp','pct'],has?o:null))return;sysLog('방 설정: 확률 — '+PCT_LABELS.map(l=>`${l} ${o[l]!=null?o[l]:pctBase(l)}%`).join(' · '));toast('확률을 저장했다')};
 const pr=$('#pctReset',m);if(pr)pr.onclick=async()=>{if(!await set(['rp','pct'],null))return;m.querySelectorAll('[data-pct]').forEach(x=>x.value='');sysLog('방 설정: 확률을 기본값으로 — '+PCT_LABELS.map(l=>`${l} ${pctBase(l)}%`).join(' · '));toast('기본값으로 돌렸다')};
 const gh=$('#gmHands',m);if(gh)gh.onchange=async()=>{await set(['rp','gmHands'],gh.checked?false:null);sysLog(gh.checked?'방 설정: GM 도 플레이어의 지시·상태를 건드리지 않는다':'방 설정: 「GM 불간섭」을 껐다');toast(gh.checked?'GM 불간섭 켬':'GM 불간섭 끔')};
 const ao=$('#acctOnly',m);if(ao)ao.onchange=async()=>{if(ao.checked&&!String(ST.secret).startsWith('u:')&&!confirm('지금 GM 링크(예전 방식)로 들어와 있다. 켜면 이 링크로는 GM 이 안 된다 — 관리자 계정이나 이 방 GM 권한이 있는 계정으로 다시 들어와야 한다. 켤까?')){ao.checked=false;return}
  const s=Object.assign({},r.settings||{},{accountOnly:ao.checked});try{await DBS().roomUpdate(ST.room,ST.secret,null,s);r.settings=s;sysLog(ao.checked?'방 설정: 계정 전용 방 (로그인한 계정만)':'방 설정: 「계정 전용」을 껐다');toast(ao.checked?'계정 전용 방':'예전 링크도 다시 된다')}catch(e){ao.checked=!ao.checked;toast(e.message)}};
 const rs=$('#rnSave',m);if(rs)rs.onclick=async()=>{try{await DBS().roomUpdate(ST.room,ST.secret,$('#rn',m).value.trim(),null);ST.roomRow.name=$('#rn',m).value.trim();remember(ST.room,ST.roomRow.name,ST.secret);closeModal();renderRoom()}catch(e){toast(e.message)}};
 $('#seatMgr',m).onclick=()=>{closeModal();openSeatPicker()}}

/* ---------- 모달 ---------- */
function openModal(html){closeModal();const bg=document.createElement('div');bg.className='modalbg';bg.innerHTML=`<div class="modal">${html}</div>`;document.body.appendChild(bg);
 bg.addEventListener('click',e=>{if(e.target===bg)closeModal()});bg.querySelectorAll('[data-x]').forEach(b=>b.onclick=closeModal);return bg.firstElementChild}
function closeModal(){document.querySelectorAll('.modalbg').forEach(x=>x.remove())}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});

/* 이름으로 기본 초상 찾기: 그림이 따로 없으면 같은 이름의 로스터 트레이너 → 포켓몬 → 관계도 노드의 그림을 쓴다 */
function portraitOf(name,img){if(img)return img;if(!name)return '';const ro=ST.state.roster||{};const t=Object.values(ro.trainers||{}).find(x=>x.name===name);if(t&&t.image)return t.image;const m=Object.values(ro.mons||{}).find(x=>x.name===name&&x.image);if(m)return m.image;const n=Object.values((ST.state.graph||{}).nodes||{}).find(x=>x.name===name&&x.img);return n?n.img:''}
window.OM_APP={contactOf,fontCss,UI,UI_DEF,UI_FONTS,UI_HEADS,applyUi,setAlarm,openRoomSettings,ST,set,setMany,setDiff,diffOps,sysLog,openModal,closeModal,toast,typeChip,renderScene,openMon,openLoadParty,loadFromRoster,loadMaker,unloadTrainer,openHatch,esc,portraitOf,alarm,isMineLog,get view(){return VIEW},set view(v){VIEW=v}};
route();
})();
