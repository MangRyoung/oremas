/* ---------- 오레마스 웹툴 본체 (0단계: 로비 · 방 · 좌석 · 실시간 상태 · 채팅 · 파티 불러오기) ---------- */
"use strict";
(()=>{
const ST={room:null,roomRow:null,state:{},v:0,role:null,secret:'',seat:'',name:'',log:[],lastLogId:0,unsub:null,wtimer:null,lastWhisper:0};
const S=()=>window.OM_STATS, I=()=>window.OM_IMPORT, DBS=()=>window.OM_STORE;
const $=(s,r)=>(r||document).querySelector(s);
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const rnd=n=>{const a=new Uint8Array(n||18);crypto.getRandomValues(a);return Array.from(a,b=>'abcdefghijklmnopqrstuvwxyz0123456789'[b%36]).join('')};
const LS={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
let toastT=null;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),2400)}
function fmtTime(s){const d=new Date(s);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}
function typeChip(en){const c=S().typeColor(en);return `<span class="type" style="background:${c.bg};color:${c.fg}">${esc(S().typeKo(en))}</span>`}

/* ---------- 라우팅 ---------- */
function params(){const h=location.hash.replace(/^#/,'');const o={};h.split('&').forEach(kv=>{const [k,v]=kv.split('=');if(k)o[decodeURIComponent(k)]=decodeURIComponent(v||'')});return o}
function roomLink(id){return location.origin+location.pathname+'#r='+id}
function gmLink(id,sec){return roomLink(id)+'&gm='+sec}
window.addEventListener('hashchange',()=>route());
async function route(){
 const p=params();
 if(ST.unsub){ST.unsub();ST.unsub=null}clearInterval(ST.wtimer);
 if(!p.r){renderLobby();return}
 await openRoom(p.r,p.gm||'')}

/* ---------- 로비 ---------- */
function renderLobby(){
 const app=$('#app');const mine=LS.get('om_rooms',[]);
 app.innerHTML=`<div class="lobby">
  <div class="brand">오레마스 <small>망켓몬 배틀 · 세션 툴</small></div>
  <div class="card"><h2>방 만들기 (GM)</h2>
   <div class="row"><input type="text" id="newName" placeholder="방 이름 (예: 무진)" style="flex:1"><button class="btn pri" id="mk">만들기</button></div>
   <p class="small muted">방을 만들면 플레이어용 링크와 GM용 링크가 나온다. GM 링크는 아무에게도 주지 말 것.</p></div>
  <div class="card"><h2>방 들어가기</h2>
   <div class="row"><input type="text" id="joinId" placeholder="방 링크 또는 방 id" style="flex:1"><button class="btn" id="join">입장</button></div></div>
  ${mine.length?`<div class="card"><h2>내 방</h2><ul class="rooms">${mine.map(r=>`<li><b>${esc(r.name||r.id)}</b><span class="mono small muted">${esc(r.id)}</span><span class="sp"></span>${r.gm?'<span class="badge gm">GM</span>':''}<a class="btn sm" href="${esc(r.gm?gmLink(r.id,r.gm):roomLink(r.id))}">열기</a></li>`).join('')}</ul></div>`:''}
 </div>`;
 $('#mk').onclick=async()=>{const name=$('#newName').value.trim()||'새 방';const sec=rnd(24);
  try{const id=await DBS().createRoom(name,sec);remember(id,name,sec);location.hash='r='+id+'&gm='+sec}catch(e){toast('방을 만들지 못했다: '+e.message)}};
 $('#join').onclick=()=>{const v=$('#joinId').value.trim();const m=v.match(/#?r=([a-z0-9]+)(?:&gm=([a-z0-9]+))?/)||[null,v];if(!m[1])return toast('방 id 를 넣어 줘');location.hash='r='+m[1]+(m[2]?'&gm='+m[2]:'')}}
function remember(id,name,gm){const L=LS.get('om_rooms',[]).filter(r=>r.id!==id);L.unshift({id,name,gm:gm||(LS.get('om_rooms',[]).find(r=>r.id===id)||{}).gm||''});LS.set('om_rooms',L.slice(0,20))}

/* ---------- 방 ---------- */
async function openRoom(id,gm){
 const app=$('#app');app.innerHTML='<div class="lobby muted">방에 들어가는 중…</div>';
 let row;try{row=await DBS().getRoom(id)}catch(e){app.innerHTML=`<div class="lobby">방을 읽지 못했다: ${esc(e.message)}<br><a href="#">로비로</a></div>`;return}
 if(!row){app.innerHTML='<div class="lobby">그런 방이 없다. <a href="#">로비로</a></div>';return}
 ST.room=id;ST.roomRow=row;if(window.OM_BATTLE_UI)window.OM_BATTLE_UI.resetLocal();ST.role=null;ST.secret='';ST.seat='';ST.name='';
 const seatInfo=LS.get('om_seat_'+id,null);
 if(gm){const w=await DBS().whoami(id,gm);if(w==='gm'){ST.role='gm';ST.secret=gm;ST.name='GM';remember(id,row.name,gm)}else toast('GM 비밀값이 맞지 않는다')}
 if(!ST.role&&seatInfo&&seatInfo.secret){const w=await DBS().whoami(id,seatInfo.secret);if(w&&w!=='gm'){ST.role='seat';ST.secret=seatInfo.secret;ST.seat=w;ST.name=seatInfo.name||w}}
 if(!ST.role)remember(id,row.name,'');
 const st=await DBS().getState(id);ST.state=(st&&st.data)||{};ST.v=(st&&st.v)||0;
 ST.log=await DBS().getLogTail(id,200);ST.lastLogId=ST.log.length?ST.log[ST.log.length-1].id:0;
 renderRoom();
 ST.unsub=DBS().subscribe(id,{onState:(d,v)=>{if(v>=ST.v){ST.state=d;ST.v=v;renderScene()}},onLog:r=>{if(r.id>ST.lastLogId){ST.log.push(r);ST.lastLogId=r.id;renderLog(true);if(window.OM_RP_UI)window.OM_RP_UI.onChat(r)}},
  onStatus:s=>{const el=$('#conn');if(el){el.textContent=s==='SUBSCRIBED'?'● 실시간':'○ '+s;el.style.color=s==='SUBSCRIBED'?'var(--acc2)':'var(--mute)'}}});
 if(ST.role){pollWhispers();ST.wtimer=setInterval(pollWhispers,4000)}
 if(!ST.role)openSeatPicker()}

async function pollWhispers(){try{const ws=await DBS().whispers(ST.room,ST.secret,ST.lastWhisper);if(!ws||!ws.length)return;ws.forEach(w=>{ST.lastWhisper=Math.max(ST.lastWhisper,w.id);if(!ST.log.find(x=>x.id===w.id))ST.log.push(w)});ST.log.sort((a,b)=>a.id-b.id);renderLog(true)}catch(e){}}

function renderRoom(){
 const app=$('#app');const r=ST.roomRow;
 app.innerHTML=`<div class="room">
  <div class="top">
   <a href="#" class="muted small" title="로비">오레마스</a><span class="name">${esc(r.name||r.id)}</span>
   ${ST.role==='gm'?'<span class="badge gm">GM</span>':ST.role==='seat'?`<span class="badge seat">${esc(ST.name)}</span>`:'<span class="badge">관전</span>'}
   <span class="tabs" id="sceneTabs"></span>
   <span class="sp"></span><span id="conn" class="small muted">○ 연결 중</span>
   ${ST.role?'<button class="btn sm" id="skillBtn">스킬 체크</button><button class="btn sm" id="deckBtn">덱</button>':''}<button class="btn sm" id="dbBtn">DB</button><button class="btn sm" id="copyLink">플레이어 링크</button>
   ${ST.role==='gm'?'<button class="btn sm" id="copyGm">GM 링크</button><button class="btn sm" id="roomSet">방 설정</button>':'<button class="btn sm" id="seatBtn">자리</button>'}
  </div>
  <div class="body"><div class="scene" id="scene"></div><div class="resizer" id="resizer" title="끌어서 채팅 창 너비 조절"></div>
   <div class="side" id="side"><div class="phone"><div class="pbar"><span>●●●</span><span class="ptime" id="pclock"></span></div><div class="ptitle">${esc(r.name||r.id)}<small>${ST.role==='gm'?'GM':ST.role==='seat'?esc(ST.name):'관전'} · 오레마스</small></div><div class="log" id="log"></div>
    <div class="inbox"><input type="text" id="chatIn" placeholder="${ST.role?'메시지 · /r 1d100 · /w 이름 메시지':'자리에 앉으면 말할 수 있다'}" ${ST.role?'':'disabled'}><button class="btn" id="chatSend" ${ST.role?'':'disabled'}>➤</button></div></div></div>
  </div></div>`;
 $('#copyLink').onclick=()=>copy(roomLink(ST.room),'플레이어 링크를 복사했다');
 const sk=$('#skillBtn');if(sk)sk.onclick=()=>window.OM_SKILL_UI.open();
 const dk=$('#deckBtn');if(dk)dk.onclick=()=>window.OM_DECK_UI.open();
 $('#dbBtn').onclick=()=>window.OM_DB_UI.open({kind:'trait'});
 const clock=()=>{const el=$('#pclock');if(el){const d=new Date();el.textContent=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}};clock();clearInterval(ST.clockT);ST.clockT=setInterval(clock,15000);
 if(ST.role==='gm'){$('#copyGm').onclick=()=>copy(gmLink(ST.room,ST.secret),'GM 링크를 복사했다 (아무에게도 주지 말 것)');$('#roomSet').onclick=openRoomSettings}
 else $('#seatBtn').onclick=openSeatPicker;
 $('#chatSend').onclick=sendChat;$('#chatIn').onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing)sendChat()};
 /* 채팅 창 너비: 끌어서 조절, 브라우저에 기억 */
 try{const w=+localStorage.getItem('om_sidew');if(w>=260)$('#side').style.width=w+'px'}catch(e){}
 $('#resizer').onpointerdown=e=>{const side=$('#side');const sx=e.clientX,sw=side.getBoundingClientRect().width;e.preventDefault();document.body.classList.add('resizing');
  const mv=ev=>{const w=Math.max(260,Math.min(window.innerWidth*0.7,sw+(sx-ev.clientX)));side.style.width=w+'px'};
  const up=()=>{document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);document.body.classList.remove('resizing');try{localStorage.setItem('om_sidew',Math.round(side.getBoundingClientRect().width))}catch(e){}};
  document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up)};
 renderScene();renderLog(false)}
function copy(t,msg){navigator.clipboard.writeText(t).then(()=>toast(msg),()=>prompt('복사해서 쓰기',t))}

/* ---------- 상태 쓰기 ---------- */
async function set(path,value){try{
  /* 서버의 jsonb_set 은 중간 키가 없으면 조용히 실패한다 — 옛 schema 를 쓰는 방이어도 되게 부모를 먼저 만든다 */
  if(path&&path.length>1&&ST.role==='gm'){let o=ST.state;for(let i=0;i<path.length-1;i++){if(typeof o[path[i]]!=='object'||o[path[i]]===null){await DBS().setState(ST.room,ST.secret,path.slice(0,i+1),{});o[path[i]]={}}o=o[path[i]]}}
  const v=await DBS().setState(ST.room,ST.secret,path,value);
  /* 낙관적 반영: 실시간이 오기 전에 화면부터 */
  if(path&&path.length){let o=ST.state;for(let i=0;i<path.length-1;i++){if(typeof o[path[i]]!=='object'||o[path[i]]==null)o[path[i]]={};o=o[path[i]]}
   if(value===null||value===undefined)delete o[path[path.length-1]];else o[path[path.length-1]]=value}else ST.state=value||{};
  ST.v=Math.max(ST.v,v||0);renderScene();return true}catch(e){toast('저장 실패: '+e.message);return false}}
async function sysLog(t,kind){try{await DBS().addLog(ST.room,ST.secret,kind||'sys',ST.name,{t})}catch(e){}}

/* ---------- 채팅 ---------- */
async function sendChat(){
 const inp=$('#chatIn');const t=inp.value.trim();if(!t)return;inp.value='';
 try{
  let m;
  if((m=t.match(/^\/r(?:oll)?\s+(.+)$/i))){const r=roll(m[1]);if(!r)return toast('주사위 식을 모르겠다 (예: 1d100, 2d6+3)');await DBS().addLog(ST.room,ST.secret,'dice',ST.name,{t:`${m[1]} → ${r.text} = ${r.total}`,total:r.total})}
  else if((m=t.match(/^\/w\s+(\S+)\s+(.+)$/))){const to=resolveSeat(m[1]);if(!to)return toast('그런 자리가 없다: '+m[1]);await DBS().addLog(ST.room,ST.secret,'whisper',ST.name,{t:m[2],to,toName:m[1]});pollWhispers()}
  else if((m=t.match(/^\/as\s+(\S+)\s+(.+)$/))){if(ST.role!=='gm')return toast('/as 는 GM 만');await DBS().addLog(ST.room,ST.secret,'chat',m[1],{t:m[2],as:m[1]})}
  else if((m=t.match(/^\/s\s+(.+)$/))){await window.OM_RP_UI.setMyStand(m[1].trim())}
  else if((m=t.match(/^\/img\s+(\S+)$/))){await DBS().addLog(ST.room,ST.secret,'chat',ST.name,{t:'',img:m[1]})}
  else if(/^\/clear$/.test(t)){if(ST.role!=='gm')return toast('/clear 는 GM 만');await DBS().addLog(ST.room,ST.secret,'chat',ST.name,{t:'',clear:1})}
  else if(t.startsWith('/'))return toast('모르는 명령이야: /r /w /as /s /img /clear');
  else await DBS().addLog(ST.room,ST.secret,'chat',ST.name,{t})
 }catch(e){toast('보내지 못했다: '+e.message)}}
function resolveSeat(n){if(n==='GM'||n==='gm')return 'gm';const seats=ST.state.seats||{};for(const k in seats)if(seats[k]&&(seats[k].name===n||k===n))return k;const trs=(ST.state.battle||{}).trainers||{};for(const k in trs)if(trs[k].name===n)return k;return null}
function roll(expr){const m=String(expr).replace(/\s/g,'').match(/^(\d*)d(\d+)([+-]\d+)?$/i);if(!m)return null;const n=Math.min(+m[1]||1,100),f=+m[2],mod=+(m[3]||0);if(f<1)return null;const rs=[];for(let i=0;i<n;i++)rs.push(1+Math.floor(Math.random()*f));const total=rs.reduce((a,b)=>a+b,0)+mod;return {total,text:'['+rs.join(',')+']'+(mod?(mod>0?'+':'')+mod:'')}}
function avatarOf(r){const d=r.data||{};if(d.as){const n=Object.values((ST.state.graph||{}).nodes||{}).find(x=>x.name===d.as);return n&&n.img||''}const from=d.from;const b=ST.state.battle||{};const ro=ST.state.roster||{trainers:{}};const t=(b.trainers||{})[from]||(ro.trainers||{})[from];if(t&&t.image)return t.image;return ''}
function renderLog(scroll){
 const el=$('#log');if(!el)return;
 el.innerHTML=ST.log.map(r=>{const d=r.data||{};const k=r.kind;const t=fmtTime(r.at);
  if(k==='sys')return `<div class="msg sys"><div class="bub">${esc(d.t)}</div></div>`;
  if(k==='chat'&&d.clear)return `<div class="msg sys"><div class="bub">무대를 비웠다</div></div>`;
  if(k==='chat'&&!d.t&&!d.img)return '';
  const mine=!d.as&&((ST.role==='gm'&&d.from==='gm')||(ST.role==='seat'&&d.from===ST.seat));
  const who=k==='whisper'?`${esc(r.who)} → ${esc(d.toName||d.to)}`:esc(r.who);
  const av=avatarOf(r);
  return `<div class="msg ${k} ${mine?'me':''}"><div class="av" style="${av?`background-image:url('${av}')`:''}"></div><div class="bub"><span class="who">${who}</span>${d.img?`<a href="${esc(d.img)}" target="_blank" rel="noopener"><img class="cimg" src="${esc(d.img)}" alt=""></a>`:''}${esc(d.t)}</div><span class="time">${t}</span></div>`}).join('');
 if(scroll!==false)el.scrollTop=el.scrollHeight}

/* ---------- 씬 ---------- */
function scene(){return ST.state.scene||'rp'}
let VIEW='';let lastScene='';
const VIEWS=[['rp','RP'],['battle','배틀'],['sheet','시트'],['graph','관계도'],['calendar','캘린더']];
function renderScene(){
 if(window.OM_DB_UI)window.OM_DB_UI.applyOverride(ST.state.dbx);
 /* GM 이 무대(RP/배틀)를 바꾸면 모두 그쪽으로 따라간다. 그 밖의 탭(시트·관계도·캘린더)은 각자 본다 */
 if(scene()!==lastScene){lastScene=scene();VIEW=scene()}
 if(!VIEW)VIEW=scene();
 const tabs=$('#sceneTabs');if(tabs){tabs.innerHTML=VIEWS.map(([k,n])=>`<button data-s="${k}" class="${VIEW===k?'on':''} ${scene()===k?'stage':''}" title="${scene()===k?'지금 무대':''}">${n}</button>`).join('')+(ST.role==='gm'?`<button class="btn xs ghost" id="stageBtn" title="모두를 이 탭으로 부른다">무대로</button>`:'');
  tabs.querySelectorAll('button[data-s]').forEach(b=>b.onclick=()=>{VIEW=b.dataset.s;renderScene()});
  const sb=$('#stageBtn');if(sb)sb.onclick=()=>{if(VIEW==='rp'||VIEW==='battle')set(['scene'],VIEW);else toast('무대는 RP 나 배틀만 될 수 있어')}}
 const el=$('#scene');if(!el)return;
 if(VIEW==='battle')renderBattle(el);
 else if(VIEW==='sheet')window.OM_SHEET_UI.render(el);
 else if(VIEW==='graph')window.OM_GRAPH_UI.render(el);
 else if(VIEW==='calendar')window.OM_CAL_UI.render(el);
 else window.OM_RP_UI.render(el);
 if(window.OM_RP_UI)window.OM_RP_UI.onState();
 if(window.OM_DECK_UI&&ST.role==='gm')window.OM_DECK_UI.absorb()}

/* ---------- 배틀 씬 → battle_ui.js ---------- */
function B(){return ST.state.battle||{}}
function renderBattle(el){window.OM_BATTLE_UI.render(el)}
async function unloadTrainer(tid){const b=B();if(!confirm('이 트레이너와 파티를 배틀에서 뺄까?'))return;const nb=JSON.parse(JSON.stringify(b));for(const s of ['left','right']){if(nb.sides&&nb.sides[s])nb.sides[s].trainers=(nb.sides[s].trainers||[]).filter(x=>x!==tid)}
 delete (nb.trainers||{})[tid];for(const k in nb.mons||{})if(nb.mons[k].tid===tid)delete nb.mons[k];if(nb.cmds)delete nb.cmds[tid];await set(['battle'],nb)}

/* ---------- 파티 불러오기: 로스터(시트) → 배틀 ---------- */
let MK=null;
async function loadMaker(force){if(MK&&!force)return MK;toast('제작기 시트를 읽는 중…');const [trs,pks,fos]=await Promise.all([DBS().makerDocs('trainers'),DBS().makerDocs('pokemon'),DBS().makerDocs('folders')]);
 MK={trainers:trs,pokemon:pks,folders:fos};return MK}
function roster(){return ST.state.roster||{trainers:{},mons:{}}}
async function openLoadParty(side){
 const r=roster();const ids=Object.keys(r.trainers).sort((a,b)=>(r.trainers[a].ord||0)-(r.trainers[b].ord||0));
 const inB=B().trainers||{};
 const m=openModal(`<div class="mhead"><h2>${side==='left'?'좌측':'우측'} 진영에 파티 불러오기</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
  ${ids.length?`<ul class="pick">${ids.map(id=>{const t=r.trainers[id];const n=(t.pids||[]).length;return `<li><b>${esc(t.name)}</b><span class="small muted">${esc(['육성','지시','통솔','능력'].map(k=>k+' '+((t.ranks||{})[k]||'-')).join(' · '))} · ${n}체</span><span class="sp"></span>${inB[id]?'<span class="tag">배틀에 있음</span>':''}<button class="btn sm pri" data-pick="${id}">불러오기</button></li>`}).join('')}</ul>`:'<div class="empty">로스터가 비어 있다.</div>'}
  <div class="row" style="margin-top:10px"><span class="small muted">트레이너는 「시트」 탭에서 제작기에서 가져오거나 새로 만든다.</span><span class="sp"></span><button class="btn sm" id="goSheet">시트 탭으로</button></div>`);
 $('#goSheet',m).onclick=()=>{closeModal();VIEW='sheet';renderScene()};
 m.querySelectorAll('[data-pick]').forEach(btn=>btn.onclick=async()=>{closeModal();await loadFromRoster(btn.dataset.pick,side)})}
async function loadFromRoster(tid,side){
 const r=roster();const t=r.trainers[tid];if(!t)return toast('로스터에 없는 트레이너다');
 const trainer=JSON.parse(JSON.stringify(t));const mons=(t.pids||[]).map(id=>r.mons[id]).filter(Boolean).map(x=>JSON.parse(JSON.stringify(x)));
 if(!mons.length&&!confirm('이 트레이너는 포켓몬이 없다. 그래도 불러올까?'))return;
 const nb=JSON.parse(JSON.stringify(B()));nb.sides=nb.sides||{left:{trainers:[]},right:{trainers:[]}};nb.sides.left=nb.sides.left||{trainers:[]};nb.sides.right=nb.sides.right||{trainers:[]};
 nb.trainers=nb.trainers||{};nb.mons=nb.mons||{};nb.turn=nb.turn||0;nb.phase=nb.phase||0;nb.mode=nb.mode||2;nb.field=nb.field||{};nb.cmds=nb.cmds||{};nb.order=nb.order||[];
 for(const s of ['left','right'])nb.sides[s].trainers=nb.sides[s].trainers.filter(x=>x!==trainer.id);
 nb.sides[side].trainers.push(trainer.id);trainer.side=side;nb.trainers[trainer.id]=trainer;
 for(const k in nb.mons)if(nb.mons[k].tid===trainer.id)delete nb.mons[k];
 mons.forEach((mon,i)=>{mon.side=side;mon.slot=i;mon.entry='';mon.started=false;mon.rank={attack:0,defense:0,specialattack:0,specialdefense:0,speed:0,accuracy:0,evasion:0,critical:0};mon.mod={};mon.states={};mon.teraActive=false;
  mon.hp={max:mon.stats[0],cur:mon.sheetHp==null?mon.stats[0]:Math.min(mon.sheetHp,mon.stats[0])};nb.mons[mon.id]=mon});
 if(await set(['battle'],nb)){toast(`${trainer.name} 파티 ${mons.length}체를 불러왔다`);sysLog(`${trainer.name} (${side==='left'?'좌측':'우측'}) 파티 등록 · ${mons.length}체`,'battle');VIEW='battle';renderScene()}}

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
 $('#ivApply',m).onclick=async()=>{const nb=JSON.parse(JSON.stringify(B()));let n=0;
  for(const mon of list){if(chosen[mon.id]==null)continue;const iv=mon._rolls[chosen[mon.id]];const t=nb.mons[mon.id];const full=t.hp.cur>=t.hp.max;t.iv=iv;t.stats=S().statsOf(t.base,iv,t.ev,t.lv);const oldMax=t.hp.max;t.hp.max=t.stats[0];t.hp.cur=full?t.hp.max:Math.max(1,Math.min(t.hp.max,t.hp.cur+t.hp.max-oldMax));n++}
  closeModal();if(n&&await set(['battle','mons'],nb.mons))toast(n+'체의 개체값을 적용했다')}}

/* ---------- 포켓몬 상세 ---------- */
function openMon(mid){
 const b=B();const m=(b.mons||{})[mid];if(!m)return;const tr=(b.trainers||{})[m.tid]||{name:''};
 const full=ST.role==='gm'||ST.seat===m.tid;
 const K=S().STATS_KO;
 const stat6=full?`<div class="stat6">${m.stats.map((v,i)=>`<div><b>${K[i]}</b><span class="v">${v}</span><div class="small muted">${esc(m.ranks[i])} · ${m.base[i]}</div></div>`).join('')}</div>`
  :`<div class="stat6">${m.ranks.map((v,i)=>`<div><b>${K[i]}</b><span class="v">${esc(v)}</span></div>`).join('')}</div>`;
 const hpRow=ST.role==='gm'?`<div class="row" style="margin:10px 0"><b>HP</b><input type="number" id="hpd" placeholder="±" style="width:90px"><button class="btn sm" id="hpDmg">대미지</button><button class="btn sm" id="hpHeal">회복</button><button class="btn sm ghost" id="hpFull">전부 회복</button><span class="small muted">(임시 조작. 계산은 1단계에서)</span></div>`:'';
 const md=openModal(`<div class="mhead"><div class="pic" style="width:56px;height:56px;border-radius:8px;background:#0e1118 center/cover no-repeat;${m.image?`background-image:url('${m.image}')`:''}"></div>
   <div><h2>${esc(m.name)} <span class="small muted">Lv.${m.lv} · ${esc(tr.name)}</span></h2><div>${m.types.filter(t=>t!=='-').map(typeChip).join(' ')} ${m.tera!=='-'?`<span class="small muted">테라스탈 ${esc(m.tera)}</span>`:''} ${m.role?`<span class="badge">${esc(m.role)}</span>`:''} ${m.pride?`<span class="badge">프라이드 ${esc(m.pride)}</span>`:''}</div></div>
   <span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
  <div class="row small muted" style="margin-bottom:8px">HP <b class="mono" style="color:var(--fg)">${full?m.hp.cur+' / '+m.hp.max:Math.round(m.hp.cur/m.hp.max*100)+'%'}</b></div>
  ${stat6}${hpRow}
  <table class="t" style="margin-top:10px"><tr><th style="width:80px">특성</th><td><b>${esc(m.ability||'-')}</b><div class="dbmini">${window.OM_DB_UI.effectHtml('trait',m.ability)||`<span class="small dim">${esc(m.abilityEff)}</span>`}</div></td></tr>
  <tr><th>소지품</th><td><b>${esc(m.item||'-')}</b><div class="dbmini">${window.OM_DB_UI.effectHtml('item',m.item)||`<span class="small dim">${esc(m.itemEff)}</span>`}</div></td></tr></table>
  <h3 style="margin:12px 0 6px;font-size:14px">기술 ${m.moves.length}</h3>
  <table class="t"><tr><th>이름</th><th>타입</th><th>분류</th><th>위력</th><th>명중</th><th>범위</th><th>우선</th><th>효과</th></tr>
   ${m.moves.map(mv=>`<tr><td class="nw"><b>${esc(mv.name)}</b>${mv.half?' <span class="small muted">½</span>':''}${mv.missing?' <span class="small" style="color:var(--red)">DB 없음</span>':''}</td><td class="nw">${typeChip(mv.typeEn)}</td><td class="nw">${esc(mv.cat)}</td><td class="mono">${mv.pow||'-'}</td><td class="mono">${mv.acc||'필중'}</td><td class="nw">${esc(mv.range)}</td><td class="mono">${mv.prio||0}</td><td class="pre small eff">${esc(mv.eff)}</td></tr>`).join('')}</table>
  ${m.pots.length?`<h3 style="margin:12px 0 6px;font-size:14px">포텐셜 ${m.pots.length}</h3><table class="t">${m.pots.map(p=>`<tr${p.ph?' style="opacity:.45"':''}><th style="width:140px;white-space:normal">${esc(p.name)}${p.ph?' <span class="small">(미정)</span>':''}<div class="small muted">${esc(p.kind)}</div></th><td class="pre small">${p.ph?'':esc(p.eff)}</td></tr>`).join('')}</table>`:''}
  ${m.excl?`<h3 style="margin:12px 0 6px;font-size:14px">전용 포텐셜</h3><table class="t"><tr><th style="width:140px">${esc(m.excl.name)}</th><td class="pre small">${esc(m.excl.eff)}</td></tr>${(m.exclX||[]).map(x=>`<tr><th>${esc(x.name)}</th><td class="pre small">${esc(x.eff)}</td></tr>`).join('')}</table>`:''}
  ${full&&m.memo?`<h3 style="margin:12px 0 6px;font-size:14px">메모</h3><div class="pre small muted">${esc(m.memo)}</div>`:''}`);
 if(ST.role==='gm'){const ap=async(cur,msg)=>{cur=Math.max(0,Math.min(m.hp.max,cur));closeModal();if(await set(['battle','mons',mid,'hp','cur'],cur))sysLog(`${m.name} ${msg} → HP ${cur}/${m.hp.max}`,'battle')};
  $('#hpDmg',md).onclick=()=>{const d=+$('#hpd',md).value||0;if(d)ap(m.hp.cur-d,`에게 ${d} 대미지`)};$('#hpHeal',md).onclick=()=>{const d=+$('#hpd',md).value||0;if(d)ap(m.hp.cur+d,`${d} 회복`)};$('#hpFull',md).onclick=()=>ap(m.hp.max,'전부 회복')}}

/* ---------- 좌석 ---------- */
function openSeatPicker(){
 const b=B();const trs=b.trainers||{};const seats=ST.state.seats||{};const ids=Object.keys(trs);
 const m=openModal(`<div class="mhead"><h2>자리 고르기</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
  <p class="small muted">GM 이 파티를 불러오면 트레이너마다 자리가 생긴다. 한 번 앉은 자리는 이 브라우저에 기억되고, 남이 앉을 수 없다. 자리를 옮기려면 GM 이 비워 줘야 한다.</p>
  <div class="row" style="margin-bottom:8px"><label>내 이름</label><input type="text" id="seatName" value="${esc(ST.name&&ST.name!=='GM'?ST.name:'')}" placeholder="플레이어 이름"></div>
  ${ids.length?`<ul class="pick">${ids.map(id=>{const t=trs[id];const o=seats[id];const mine=ST.seat===id;return `<li><b>${esc(t.name)}</b><span class="badge ${t.side}">${t.side==='left'?'좌측':'우측'}</span><span class="small muted">${o?(mine?'내 자리':'앉은 사람: '+esc(o.name)):'빈 자리'}</span><span class="sp"></span>${mine?'<span class="badge seat">나</span>':o?'':`<button class="btn sm pri" data-seat="${id}">앉기</button>`}${ST.role==='gm'&&o?`<button class="btn sm ghost danger" data-free="${id}">비우기</button>`:''}</li>`}).join('')}</ul>`:'<div class="empty">아직 자리가 없다. GM 이 파티를 불러오면 생긴다.</div>'}`);
 m.querySelectorAll('[data-seat]').forEach(bt=>bt.onclick=async()=>{const name=$('#seatName',m).value.trim();if(!name)return toast('이름을 적어 줘');
  const info=LS.get('om_seat_'+ST.room,null);const secret=(info&&info.secret)||rnd(24);
  try{const ok=await DBS().claimSeat(ST.room,bt.dataset.seat,secret,name);if(!ok)return toast('누군가 먼저 앉은 자리다');LS.set('om_seat_'+ST.room,{seat:bt.dataset.seat,secret,name});closeModal();location.reload()}catch(e){toast('앉지 못했다: '+e.message)}});
 m.querySelectorAll('[data-free]').forEach(bt=>bt.onclick=async()=>{try{await DBS().claimSeat(ST.room,bt.dataset.free,ST.secret,null);closeModal();toast('자리를 비웠다')}catch(e){toast(e.message)}})}

function openRoomSettings(){
 const r=ST.roomRow;const m=openModal(`<div class="mhead"><h2>방 설정</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
  <div class="row"><label>방 이름</label><input type="text" id="rn" value="${esc(r.name)}" style="flex:1"><button class="btn pri" id="rnSave">저장</button></div>
  <p class="small muted" style="margin-top:12px">방 id <span class="mono">${esc(r.id)}</span></p>
  <div class="row"><button class="btn sm" id="seatMgr">자리 관리</button></div>`);
 $('#rnSave',m).onclick=async()=>{try{await DBS().roomUpdate(ST.room,ST.secret,$('#rn',m).value.trim(),null);ST.roomRow.name=$('#rn',m).value.trim();remember(ST.room,ST.roomRow.name,ST.secret);closeModal();renderRoom()}catch(e){toast(e.message)}};
 $('#seatMgr',m).onclick=()=>{closeModal();openSeatPicker()}}

/* ---------- 모달 ---------- */
function openModal(html){closeModal();const bg=document.createElement('div');bg.className='modalbg';bg.innerHTML=`<div class="modal">${html}</div>`;document.body.appendChild(bg);
 bg.addEventListener('click',e=>{if(e.target===bg)closeModal()});bg.querySelectorAll('[data-x]').forEach(b=>b.onclick=closeModal);return bg.firstElementChild}
function closeModal(){document.querySelectorAll('.modalbg').forEach(x=>x.remove())}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});

window.OM_APP={ST,set,sysLog,openModal,closeModal,toast,typeChip,renderScene,openMon,openLoadParty,loadFromRoster,loadMaker,unloadTrainer,openHatch,esc,get view(){return VIEW},set view(v){VIEW=v}};
route();
})();
