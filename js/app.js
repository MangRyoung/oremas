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
 ST.room=id;ST.roomRow=row;ST.role=null;ST.secret='';ST.seat='';ST.name='';
 const seatInfo=LS.get('om_seat_'+id,null);
 if(gm){const w=await DBS().whoami(id,gm);if(w==='gm'){ST.role='gm';ST.secret=gm;ST.name='GM';remember(id,row.name,gm)}else toast('GM 비밀값이 맞지 않는다')}
 if(!ST.role&&seatInfo&&seatInfo.secret){const w=await DBS().whoami(id,seatInfo.secret);if(w&&w!=='gm'){ST.role='seat';ST.secret=seatInfo.secret;ST.seat=w;ST.name=seatInfo.name||w}}
 if(!ST.role)remember(id,row.name,'');
 const st=await DBS().getState(id);ST.state=(st&&st.data)||{};ST.v=(st&&st.v)||0;
 ST.log=await DBS().getLogTail(id,200);ST.lastLogId=ST.log.length?ST.log[ST.log.length-1].id:0;
 renderRoom();
 ST.unsub=DBS().subscribe(id,{onState:(d,v)=>{if(v>=ST.v){ST.state=d;ST.v=v;renderScene()}},onLog:r=>{if(r.id>ST.lastLogId){ST.log.push(r);ST.lastLogId=r.id;renderLog(true)}},
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
   <button class="btn sm" id="copyLink">플레이어 링크</button>
   ${ST.role==='gm'?'<button class="btn sm" id="copyGm">GM 링크</button><button class="btn sm" id="roomSet">방 설정</button>':'<button class="btn sm" id="seatBtn">자리</button>'}
  </div>
  <div class="body"><div class="scene" id="scene"></div>
   <div class="side"><div class="log" id="log"></div>
    <div class="inbox"><input type="text" id="chatIn" placeholder="${ST.role?'메시지 · /r 1d100 · /w 이름 메시지':'자리에 앉으면 말할 수 있다'}" ${ST.role?'':'disabled'}><button class="btn" id="chatSend" ${ST.role?'':'disabled'}>보내기</button></div></div>
  </div></div>`;
 $('#copyLink').onclick=()=>copy(roomLink(ST.room),'플레이어 링크를 복사했다');
 if(ST.role==='gm'){$('#copyGm').onclick=()=>copy(gmLink(ST.room,ST.secret),'GM 링크를 복사했다 (아무에게도 주지 말 것)');$('#roomSet').onclick=openRoomSettings}
 else $('#seatBtn').onclick=openSeatPicker;
 $('#chatSend').onclick=sendChat;$('#chatIn').onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing)sendChat()};
 renderScene();renderLog(false)}
function copy(t,msg){navigator.clipboard.writeText(t).then(()=>toast(msg),()=>prompt('복사해서 쓰기',t))}

/* ---------- 상태 쓰기 ---------- */
async function set(path,value){try{const v=await DBS().setState(ST.room,ST.secret,path,value);
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
  else await DBS().addLog(ST.room,ST.secret,'chat',ST.name,{t})
 }catch(e){toast('보내지 못했다: '+e.message)}}
function resolveSeat(n){if(n==='GM'||n==='gm')return 'gm';const seats=ST.state.seats||{};for(const k in seats)if(seats[k]&&(seats[k].name===n||k===n))return k;const trs=(ST.state.battle||{}).trainers||{};for(const k in trs)if(trs[k].name===n)return k;return null}
function roll(expr){const m=String(expr).replace(/\s/g,'').match(/^(\d*)d(\d+)([+-]\d+)?$/i);if(!m)return null;const n=Math.min(+m[1]||1,100),f=+m[2],mod=+(m[3]||0);if(f<1)return null;const rs=[];for(let i=0;i<n;i++)rs.push(1+Math.floor(Math.random()*f));const total=rs.reduce((a,b)=>a+b,0)+mod;return {total,text:'['+rs.join(',')+']'+(mod?(mod>0?'+':'')+mod:'')}}
function renderLog(scroll){
 const el=$('#log');if(!el)return;
 el.innerHTML=ST.log.map(r=>{const d=r.data||{};const k=r.kind;
  if(k==='sys')return `<div class="msg sys"><span class="time">${fmtTime(r.at)}</span>${esc(d.t)}</div>`;
  const who=k==='whisper'?`${esc(r.who)} → ${esc(d.toName||d.to)}`:esc(r.who);
  return `<div class="msg ${k}"><span class="time">${fmtTime(r.at)}</span><span class="who">${who}</span>${esc(d.t)}</div>`}).join('');
 if(scroll!==false)el.scrollTop=el.scrollHeight}

/* ---------- 씬 ---------- */
function scene(){return ST.state.scene||'rp'}
function renderScene(){
 const tabs=$('#sceneTabs');if(tabs){const cur=scene();tabs.innerHTML=[['rp','RP'],['battle','배틀']].map(([k,n])=>`<button data-s="${k}" class="${cur===k?'on':''}" ${ST.role==='gm'?'':'disabled'}>${n}</button>`).join('');
  tabs.querySelectorAll('button').forEach(b=>b.onclick=()=>set(['scene'],b.dataset.s))}
 const el=$('#scene');if(!el)return;
 if(scene()==='battle')renderBattle(el);else el.innerHTML=`<div class="rp"><div style="text-align:center">RP 씬<br><span class="small">배경·스탠딩·BGM·지도·덱 창은 3단계에서 들어온다</span></div></div>`}

/* ---------- 배틀 씬 (0단계: 파티 표시 · HP · 좌석) ---------- */
function B(){return ST.state.battle||{}}
function renderBattle(el){
 const b=B();const trs=b.trainers||{};const mons=b.mons||{};const seats=ST.state.seats||{};
 const sideHtml=side=>{const ids=((b.sides||{})[side]||{}).trainers||[];
  return `<div class="sideBox ${side}"><h3>${side==='left'?'좌측':'우측'} 진영 <span class="badge ${side}">${ids.length}명</span><span class="sp"></span>${ST.role==='gm'?`<button class="btn sm" data-act="load" data-side="${side}">+ 파티 불러오기</button>`:''}</h3>
   ${ids.length?ids.map(tid=>{const t=trs[tid]||{name:'?'};const owner=seats[tid];const mine=ST.seat===tid;
    const list=Object.values(mons).filter(m=>m.tid===tid).sort((a,b)=>(a.slot||0)-(b.slot||0));
    return `<div class="trainer">${t.image?`<img src="${t.image}" alt="">`:'<div class="noimg"></div>'}<div><div class="tn">${esc(t.name)} ${mine?'<span class="badge seat">나</span>':''}</div>
     <div class="tr">육성 ${esc(t.ranks.육성||'-')} · 지시 ${esc(t.ranks.지시||'-')} · 통솔 ${esc(t.ranks.통솔||'-')} · 능력 ${esc(t.ranks.능력||'-')} ${owner?`· <span style="color:var(--acc2)">${esc(owner.name)}</span>`:'· <span class="muted">빈 자리</span>'}</div></div><span class="sp"></span>
     ${ST.role==='gm'?`<button class="btn sm ghost" data-act="iv" data-tid="${tid}" title="개체값 알까기">알까기</button><button class="btn sm ghost danger" data-act="unload" data-tid="${tid}">빼기</button>`:''}</div>
     <div class="mons">${list.map(m=>monCard(m,mine||ST.role==='gm')).join('')||'<div class="empty small">포켓몬 없음</div>'}</div>`}).join(''):'<div class="empty">아직 트레이너가 없다'+(ST.role==='gm'?'. 「파티 불러오기」로 제작기 시트에서 가져온다':'')+'</div>'}</div>`};
 el.innerHTML=`<div class="bstat"><span class="turn">턴 ${b.turn||0}</span><span class="muted">페이즈: ${esc(phaseName(b.phase))}</span><span class="sp"></span>
   ${ST.role==='gm'?`<button class="btn sm" data-act="turn+">턴 +1</button><button class="btn sm ghost" data-act="turn0">턴 초기화</button><button class="btn sm ghost danger" data-act="clear">배틀 비우기</button>`:''}</div>
  <div class="sides">${sideHtml('left')}${sideHtml('right')}</div>`;
 el.querySelectorAll('[data-act]').forEach(btn=>btn.onclick=()=>action(btn.dataset));
 el.querySelectorAll('.mon').forEach(c=>c.onclick=()=>openMon(c.dataset.mid))}
function phaseName(p){return ({0:'지시 준비',1:'턴 개시',1.5:'지령 공개',2:'행동 순서',3:'가장 마지막',4:'턴 종료 준비',5:'턴 종료 이후'})[p??0]||'-'}
function monCard(m,full){
 const hp=m.hp||{max:1,cur:1};const pct=Math.max(0,Math.min(100,Math.round(hp.cur/hp.max*100)));const cls=pct<=25?'low':pct<=50?'mid':'';
 const sts=Object.keys(m.states||{}).filter(k=>m.states[k]);
 return `<div class="mon ${hp.cur<=0?'fainted':''}" data-mid="${m.id}"><div class="pic" style="${m.image?`background-image:url('${m.image}')`:''}">${m.image?'':'●'}</div>
  <div class="nm">${esc(m.name)}</div><div class="lv">Lv.${m.lv} ${m.types.filter(t=>t!=='-').map(typeChip).join(' ')}</div>
  <div class="hpbar ${cls}"><i style="width:${pct}%"></i></div><div class="hpnum">${full?`${hp.cur} / ${hp.max}`:pct+'%'}</div>
  ${sts.length?`<div class="states">${sts.map(s=>`<span>${esc(s)}</span>`).join('')}</div>`:''}</div>`}

async function action(d){
 const b=B();
 if(d.act==='load')return openLoadParty(d.side);
 if(d.act==='unload'){if(!confirm('이 트레이너와 파티를 배틀에서 뺄까?'))return;const nb=JSON.parse(JSON.stringify(b));for(const s of ['left','right']){if(nb.sides&&nb.sides[s])nb.sides[s].trainers=(nb.sides[s].trainers||[]).filter(x=>x!==d.tid)}
  delete (nb.trainers||{})[d.tid];for(const k in nb.mons||{})if(nb.mons[k].tid===d.tid)delete nb.mons[k];await set(['battle'],nb);return}
 if(d.act==='clear'){if(!confirm('배틀 상태를 전부 비울까? (좌석은 남는다)'))return;await set(['battle'],{turn:0,phase:0,sides:{left:{trainers:[]},right:{trainers:[]}},trainers:{},mons:{}});return}
 if(d.act==='turn+'){await set(['battle','turn'],(b.turn||0)+1);sysLog(`턴 ${(b.turn||0)+1} 개시`,'battle');return}
 if(d.act==='turn0'){await set(['battle','turn'],0);return}
 if(d.act==='iv')return openHatch(d.tid)}

/* ---------- 파티 불러오기 (제작기 docs) ---------- */
let MK=null;
async function loadMaker(force){if(MK&&!force)return MK;toast('제작기 시트를 읽는 중…');const [trs,pks,fos]=await Promise.all([DBS().makerDocs('trainers'),DBS().makerDocs('pokemon'),DBS().makerDocs('folders')]);
 MK={trainers:trs,pokemon:pks,folders:fos};return MK}
async function openLoadParty(side){
 let mk;try{mk=await loadMaker()}catch(e){return toast('제작기 DB를 읽지 못했다: '+e.message)}
 const fold=new Map(mk.folders.map(f=>[f.id,(f.data||{}).name||f.id]));
 const list=mk.trainers.map(t=>({id:t.id,d:(t.data&&t.data.data)||{},ord:(t.data||{}).ord||0})).sort((a,b)=>(fold.get(a.d.folder)||'').localeCompare(fold.get(b.d.folder)||'')||a.ord-b.ord);
 const m=openModal(`<div class="mhead"><h2>${side==='left'?'좌측':'우측'} 진영에 파티 불러오기</h2><span class="sp"></span><button class="btn sm ghost" id="mkRefresh">새로 읽기</button><button class="btn ghost" data-x>닫기</button></div>
  <input type="text" id="tq" placeholder="트레이너 이름으로 찾기" style="width:100%;margin-bottom:8px">
  <ul class="pick" id="tl">${list.map(t=>`<li data-id="${t.id}"><span class="small muted" style="min-width:90px">${esc(fold.get(t.d.folder)||'-')}</span><b>${esc(t.d.name||'(이름 없음)')}</b><span class="small muted">${esc(['육성','지시','통솔','능력'].map(k=>k+' '+((t.d.ranks||{})[k]||'-')).join(' · '))} · ${(t.d.pids||[]).length}체</span><span class="sp"></span><button class="btn sm pri" data-pick="${t.id}">불러오기</button></li>`).join('')}</ul>`);
 $('#mkRefresh',m).onclick=async()=>{await loadMaker(true);closeModal();openLoadParty(side)};
 $('#tq',m).oninput=e=>{const q=e.target.value.trim();m.querySelectorAll('#tl li').forEach(li=>li.style.display=!q||li.textContent.includes(q)?'':'none')};
 m.querySelectorAll('[data-pick]').forEach(btn=>btn.onclick=async()=>{
  const tdoc=mk.trainers.find(t=>t.id===btn.dataset.pick);const {trainer,mons}=I().party(tdoc,mk.pokemon);
  if(!mons.length&&!confirm('이 트레이너는 포켓몬이 없다. 그래도 불러올까?'))return;
  const nb=JSON.parse(JSON.stringify(B()));nb.sides=nb.sides||{left:{trainers:[]},right:{trainers:[]}};nb.sides.left=nb.sides.left||{trainers:[]};nb.sides.right=nb.sides.right||{trainers:[]};
  nb.trainers=nb.trainers||{};nb.mons=nb.mons||{};nb.turn=nb.turn||0;nb.phase=nb.phase||0;
  for(const s of ['left','right'])nb.sides[s].trainers=nb.sides[s].trainers.filter(x=>x!==trainer.id);
  nb.sides[side].trainers.push(trainer.id);trainer.side=side;nb.trainers[trainer.id]=trainer;
  for(const k in nb.mons)if(nb.mons[k].tid===trainer.id)delete nb.mons[k];
  mons.forEach((mon,i)=>{mon.side=side;mon.slot=i;nb.mons[mon.id]=mon});
  closeModal();if(await set(['battle'],nb)){toast(`${trainer.name} 파티 ${mons.length}체를 불러왔다`);sysLog(`${trainer.name} (${side==='left'?'좌측':'우측'}) 파티 등록 · ${mons.length}체`,'battle')}})}

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
  <table class="t" style="margin-top:10px"><tr><th style="width:80px">특성</th><td><b>${esc(m.ability||'-')}</b><div class="pre small">${esc(m.abilityEff)}</div></td></tr>
  <tr><th>소지품</th><td><b>${esc(m.item||'-')}</b><div class="pre small">${esc(m.itemEff)}</div></td></tr></table>
  <h3 style="margin:12px 0 6px;font-size:14px">기술 ${m.moves.length}</h3>
  <table class="t"><tr><th>이름</th><th>타입</th><th>분류</th><th>위력</th><th>명중</th><th>범위</th><th>우선</th><th>효과</th></tr>
   ${m.moves.map(mv=>`<tr><td><b>${esc(mv.name)}</b>${mv.half?' <span class="small muted">½</span>':''}${mv.missing?' <span class="small" style="color:var(--red)">DB 없음</span>':''}</td><td>${typeChip(mv.typeEn)}</td><td>${esc(mv.cat)}</td><td class="mono">${mv.pow||'-'}</td><td class="mono">${mv.acc||'필중'}</td><td>${esc(mv.range)}</td><td class="mono">${mv.prio||0}</td><td class="pre small">${esc(mv.eff)}</td></tr>`).join('')}</table>
  ${m.pots.length?`<h3 style="margin:12px 0 6px;font-size:14px">포텐셜 ${m.pots.length}</h3><table class="t">${m.pots.map(p=>`<tr${p.ph?' style="opacity:.45"':''}><th style="width:140px">${esc(p.name)}${p.ph?' <span class="small">(미정)</span>':''}<div class="small muted">${esc(p.kind)}</div></th><td class="pre small">${p.ph?'':esc(p.eff)}</td></tr>`).join('')}</table>`:''}
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

route();
})();
