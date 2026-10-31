/* ---------- 휴대폰 (RP 보조 도구): 연락처(10-30 건네받아 넣는 내 연락처 · 등록 이름) · 문자 · 협력자(관계도의 관계 랭크·쇼크) · 캘린더(오늘 · 시간대 기록 · 회복 · 메모) · 메모장
   상태: 협력자 = state.graph.edges (a,b,rank,label,shock) · 캘린더 = state.calendar (today, phase, weather)
   내 기록 = state.pub[tid].phone = {log:{'YYYY-MM-DD':[{slot,kind,who,note,at}]}, memo, contacts:[nodeId|'t:'+tid], notes:[{id,title,body,at}]}
   그림은 따로 없으면 A().portraitOf(이름) — 같은 이름의 트레이너·포켓몬·관계도 노드의 기본 초상을 쓴다.
   회복은 OM_SKILL_UI.applyRest(kind,[tid]) — 단계 내용은 GM 의 스킬 체크 「휴식」 탭에서 정한다. */
"use strict";
window.OM_PHONE_UI=(()=>{
 const A=()=>window.OM_APP;
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const $=(s,r)=>(r||document).querySelector(s);
 const WD=['일','월','화','수','목','금','토'];
 const SLOTS=['아침','점심','오후','방과 후','저녁','밤','심야'];
 const KINDS=[['commu','의미 있는 시간 (관계)','관계'],['study','학업 · 수련','학업'],['free','개인 시간','개인'],['work','노가다 · 아르바이트','노가다'],['out','나가다 · 조사','조사'],['memo','메모','메모']];
 const RESTS=[['breath','가벼움','숨돌리기'],['short','상담함','짧은 휴식'],['mid','반쯤','중간 휴식'],['long','대대적','긴 휴식']];   /* 10-28 중간 휴식 */
 const gm=()=>A().ST.role==='gm';
 const trs=()=>(A().ST.state.roster||{}).trainers||{};
 const mons=()=>(A().ST.state.roster||{}).mons||{};
 const G=()=>A().ST.state.graph||{nodes:{},edges:{}};
 const cal=()=>A().ST.state.calendar||{};
 const PH={screen:'home',tid:'',tab:'',draft:{},cq:''};
 /* 이 휴대폰의 주인: 좌석이면 내 트레이너, GM 이면 고른 트레이너 */
 function owner(){const T=trs();if(gm()){if(PH.tid&&PH.tid.startsWith('n:')){const n=(G().nodes||{})[PH.tid.slice(2)];if(n)return {id:PH.tid,name:n.name,image:por(n.name,n.img),npc:true,nid:n.id,kind:n.kind}}if(!PH.tid||!T[PH.tid])PH.tid=Object.keys(T)[0]||'';return T[PH.tid]||null}PH.tid=A().ST.seat;return T[PH.tid]||null}
 const canWrite=()=>gm()||(A().ST.seat&&A().ST.seat===PH.tid);
 const phoneData=tid=>(((A().ST.state.pub||{})[tid]||{}).phone)||{log:{},memo:'',contacts:[],notes:[]};
 /* 바뀐 칸만 쓴다 (점검 3-18) — 휴대폰 전체를 쓰면 다른 창에서 동시에 고친 메모·연락처·일정이 지워진다. 처음이면 통째로 */
 async function savePhone(tid,patch){const old=((A().ST.state.pub||{})[tid]||{}).phone;const cur=Object.assign({log:{},memo:'',contacts:[],notes:[]},JSON.parse(JSON.stringify(old||{})));const before=JSON.parse(JSON.stringify(cur));Object.assign(cur,patch);
  if(!old)return A().set(['pub',tid,'phone'],cur);return A().setDiff(['pub',tid,'phone'],before,cur,2)}
 const por=(name,img)=>A().portraitOf?A().portraitOf(name,img):(img||'');
 const av=(name,img,cls)=>{const u=por(name,img);return `<i class="ph-av ${cls||''}" style="${u?`background-image:url('${cssu(u)}')`:''}"></i>`};
 const today=()=>cal().today||new Date().toISOString().slice(0,10);
 const dateKo=d=>{const x=new Date(d+'T00:00:00');return isNaN(x)?d:`${x.getMonth()+1}월 ${x.getDate()}일 ${WD[x.getDay()]}요일`};
 /* 트레이너 ↔ 관계도 노드: 이름이 같은 pc 노드 */
 function nodeOfTrainer(t){if(!t)return null;const ns=Object.values(G().nodes||{});return ns.find(n=>n.kind==='pc'&&n.name===t.name)||ns.find(n=>n.name===t.name)||null}

 /* opt.tid: GM 이 아래 띠의 인물(지금 화자의 트레이너)로 연다 — 10-26 망령 「명운 상태에서 폰 누르면 명운의 휴대폰」 */
 function open(screen,opt){if(screen)PH.screen=screen;if(opt&&opt.tid&&gm()){if(PH.tid!==opt.tid){PH.tid=opt.tid;PH.screen=screen||'home'}}const t=owner();
  const md=A().openModal(`<div class="phone-shell"><div class="phone-dev"><div class="ph-status"><span>${esc(t?t.name:'—')}</span><span class="sp"></span><span>${esc(today().slice(5).replace('-','/'))}</span><span class="ph-bat">▮▮▮</span><button class="ph-x" data-x title="닫기 (Esc 는 한 칸 뒤로)">✕</button></div><div class="ph-screen" id="phScreen"></div><div class="ph-sheetwrap" id="phSheet" hidden></div><div class="ph-home"><button class="btn ghost ph-close" data-x>닫기</button><button class="ph-hb" data-ph="home" title="홈"></button></div></div></div>`);   /* 10-24 망령: 닫기는 폰 화면 안 아래 가운데(홈 막대 위) — PC · 모바일 같은 자리 */
  md.classList.add('phone-modal');draw(md);
  if(!window.__omPhEsc){window.__omPhEsc=1;document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const pm=$('.modal.phone-modal');if(!pm)return;
   if(closeSheet()){e.stopImmediatePropagation();e.preventDefault();return}
   const up={smsroom:'sms',note1:'notes',callog:'cal'}[PH.screen]||(PH.screen!=='home'?'home':'');if(!up)return;e.stopImmediatePropagation();e.preventDefault();backTo(up,pm)},true)}}
 /* 휴대폰 안에서 뜨는 아래 시트 — 연락처 추가 · 새 문자 · 관계 편집 같은 작은 창이 휴대폰을 닫지 않고 위에 뜬다 */
 function sheet(title,body){const w=$('#phSheet');if(!w)return A().openModal('<div class="mhead"><h2>'+title+'</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>'+body);
  w.hidden=false;w.innerHTML=`<div class="ph-sheetbg" data-shx></div><div class="ph-sheet"><div class="ph-sheeth"><b>${title}</b><span class="sp"></span><button class="ph-shx" data-shx title="닫기">✕</button></div><div class="ph-sheetb">${body}</div></div>`;
  w.querySelectorAll('[data-shx]').forEach(b=>b.onclick=()=>closeSheet());const sh=w.querySelector('.ph-sheet');requestAnimationFrame(()=>sh.classList.add('in'));return sh}
 function closeSheet(){const w=$('#phSheet');if(!w||w.hidden)return false;w.hidden=true;w.innerHTML='';return true}
 const go=s=>{closeSheet();PH.screen=s;re()};
 /* 뒤로 가기: 메모를 고치던 중이면 저장부터 */
 async function backTo(s,md){md=md||$('.modal.phone-modal');if(PH.screen==='note1'&&md&&canWrite()&&noteDirty(md))await saveNote(md,true);PH.screen=s;re()}
 function draw(md){md=md||$('.modal');const el=$('#phScreen',md);if(!el)return;const t=owner();
  el.innerHTML=PH.screen==='contacts'?contacts(t):PH.screen==='party'&&window.OM_PPOOL?partyScr(t):PH.screen==='conf'?confidants(t):PH.screen==='cal'?calendar(t):PH.screen==='sms'?smsRooms(t):PH.screen==='smsroom'?smsRoom(t):PH.screen==='notes'?notes(t):PH.screen==='sns'?sns(t):PH.screen==='note1'?noteEdit(t):PH.screen==='callog'?calLog(t):PH.screen==='set'?settings():PH.screen==='deck'&&window.OM_DECK_UI?window.OM_DECK_UI.phone(t,canWrite()):home(t);
  bind(md);if(PH.screen==='deck'&&window.OM_DECK_UI)window.OM_DECK_UI.bindPhone(md,re,t);if(PH.screen==='set'){const r=$('#phPrefs',md);if(r&&window.OM_PREFS)window.OM_PREFS.bind(r)}if(PH.screen==='sns')snsSeen();if(PH.screen==='smsroom'){const lg=$('.ph-sms',md);if(lg){lg.scrollTop=lg.scrollHeight;lg.querySelectorAll('img').forEach(im=>im.addEventListener('load',()=>{lg.scrollTop=lg.scrollHeight},{once:true}))}markSeen(PH.room)}}
 const re=()=>draw();
 const hmOf=at=>{const d=new Date(at);if(isNaN(d))return '';const n=new Date();return d.toDateString()===n.toDateString()?`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`:`${d.getMonth()+1}/${d.getDate()}`};
 /* ----- 설정: 내 환경 설정 (OM_PREFS 판을 휴대폰 크기로) ----- */
 function settings(){return `<div class="ph-head set"><button class="ph-back" data-ph="home">‹</button><div><b>설정</b><small>이 기기에서만 · 나만 적용</small></div></div><div class="ph-setwrap"><div id="phPrefs" class="pf-host cmp">${window.OM_PREFS?window.OM_PREFS.html({compact:true}):'<div class="dim">설정을 불러오지 못했다</div>'}</div></div>`}
 /* ----- 홈 ----- */
 /* 10-31 망령 「제작기(세션 노트) 폰 UI 이쁘네, 웹툴도 이런 느낌으로」: 프로필 머리(초상 · 이름 · 파티 코드) → 둥근 앱 4칸 → 최근 문자 줄. 모양은 css/phone3.css */
 function home(t){const T=trs();const un=unreadAll();const apps=[['contacts','📞','연락처',1],['party','👥','파티',!!window.OM_PPOOL],['sms','💬','문자',1,un],['conf','🤝','협력자',1],['cal','📅','캘린더',1],['notes','📝','메모장',1],['sns','📸','SNS',1,snsUnread()],['deck','🃏','덱',!!window.OM_DECK_UI],['set','⚙️','설정',1]];
  const code=t&&!t.npc?roomOf2(t.id):'';const when=[dateKo(today()),cal().phase||'',cal().weather||''].filter(Boolean).join(' · ');
  const rs=rooms().map(r=>({r,L:smsLogs(r.id)})).filter(x=>x.L.length).sort((a,b)=>b.L[b.L.length-1].id-a.L[a.L.length-1].id).slice(0,3);
  return `<div class="ph-wall ph-wall3">
   <div class="ph-me">${av(t?t.name:'',t&&t.image,'big')}<div class="ph-mei"><b>${esc(t?t.name:'—')}</b><small>${t&&t.npc?esc(KINDN[t.kind]||'NPC')+' · 관계도':code?'파티 코드 '+esc(code):'파티 코드 없음'}</small><small class="ph-when">${esc(when)}</small></div></div>
   ${gm()?`<div class="ph-owner"><span>누구의 휴대폰</span><select id="phOwner">${Object.values(T).map(x=>`<option value="${x.id}" ${x.id===PH.tid?'selected':''}>${esc(x.name)}</option>`).join('')}${Object.values(G().nodes||{}).filter(n=>!Object.values(T).some(x=>x.name===n.name)).map(n=>`<option value="n:${esc(n.id)}" ${'n:'+n.id===PH.tid?'selected':''}>${esc(n.name)} (관계도)</option>`).join('')}</select></div>`:''}
   <div class="ph-apps">${apps.map(([k,ic,n,on,bd])=>`<button class="ph-app ${on?'':'off'}" data-ph="${on?k:''}" ${on?'':'title="아직 준비 중"'}><i>${ic}${bd?`<em class="ph-badge">${bd}</em>`:''}</i><span>${n}</span></button>`).join('')}</div>
   ${rs.length?`<div class="ph-sec3">최근 문자</div><div class="ph-recent">${rs.map(({r,L})=>{const l=L[L.length-1];const u=unread(r.id);return `<div class="ph-rc" data-ph="smsopen" data-room="${esc(r.id)}">${roomIcon(r)}<div class="ph-it"><b>${esc(r.name)}${u?` <em class="ph-badge inline">${u}</em>`:''}</b><small>${esc((l.data.as||l.who)+': '+preview(l.data).slice(0,40))}</small></div><small class="ph-rtm">${esc(hmOf(l.at))}</small></div>`}).join('')}</div>`:''}</div>`}
/* ----- 문자: 캐릭터끼리의 톡 (로그 kind chat + data.sms=방 id).
   방 종류: 「파티」(모두) · GM 이 만든 방(rp.sms.rooms) · 누구나 만드는 방(로그에 data.room={name,members} 정의 한 줄) · 1:1(dm:a|b — 정의 없이 두 사람의 cid 로 정해진다)
   cid(문자 쪽 신분) = 트레이너 id · 'n:'+관계도 노드 id · 'gm'. 휴대폰 주인이 곧 보내는 사람. ----- */
 const SEEN_KEY='om_sms_seen',OPEN_KEY='om_sms_open';
 const KINDN={pc:'PC',npc:'NPC',org:'조직'};
 /* 휴대폰 주인의 cid: 좌석은 내 트레이너, GM 은 고른 주인(트레이너 또는 NPC 노드) */
 function myCid(){const t=owner();if(t&&t.npc)return 'n:'+t.nid;return PH.tid||(gm()?'gm':'')}
 function cidName(cid){if(!cid)return '';if(cid==='gm')return 'GM';if(cid.startsWith('n:')){const n=(G().nodes||{})[cid.slice(2)];return n?n.name:'(사라진 사람)'}const t=trs()[cid];if(t)return t.name;const st=(A().ST.state.seats||{})[cid];return st&&st.name?st.name:'(사라진 사람)'}
 function cidImg(cid){if(!cid||cid==='gm')return '';if(cid.startsWith('n:')){const n=(G().nodes||{})[cid.slice(2)];return n?por(n.name,n.img):''}const t=trs()[cid];return t?por(t.name,t.image):''}
 function cidKey(cid){if(cid.startsWith('n:')){const n=(G().nodes||{})[cid.slice(2)];return n?'npc:'+n.name:''}return cid}
 /* 관계도 노드가 트레이너와 같은 이름이면 트레이너 cid 로 (휴대폰은 트레이너 것이니까) */
 function cidOfNode(n){const t=Object.values(trs()).find(x=>x.name===n.name);return t?t.id:'n:'+n.id}
 /* 10-30 망령 「PC 와 NPC 가 각자 자기 연락처를 건네줘서 등록하고, 그걸 통해 연락하고 단톡방 파고 · 추가 · 등록 이름 수정 · 삭제」
    내 연락처 = pub[주인].phone.book = [{cid, n(등록 이름 · 비면 본명), at}] — 관계도 선과 상관없다. 예전 contacts(관계도 노드 id)는 book 이 없을 때 그대로 옮겨 보인다.
    건네기 = 1:1 문자에 연락처 카드 한 줄(data.card={cid,name}) → 받은 사람이 「저장」하면 그쪽 연락처에 들어간다.
    파티 초대 = 단톡방에 초대 카드(data.inv={code}) → 「참가」하면 내 파티 코드(phone.room)가 그 코드가 된다 */
 function bookOf(tid){const pd=phoneData(tid);if(Array.isArray(pd.book))return pd.book.filter(x=>x&&x.cid);const g=G();return (pd.contacts||[]).map(id=>(g.nodes||{})[id]).filter(Boolean).map(n=>({cid:cidOfNode(n),n:''}))}
 const inBook=(cid,tid)=>bookOf(tid||PH.tid).some(x=>x.cid===cid);
 function nm(cid){const e=bookOf(PH.tid).find(x=>x.cid===cid);return (e&&e.n)||cidName(cid)}
 async function saveBook(list){const u=new Set();list=list.filter(x=>x&&x.cid&&!u.has(x.cid)&&u.add(x.cid));return savePhone(PH.tid,{book:list})}
 function cidSub(cid){if(cid==='gm')return 'GM';if(cid.startsWith('n:')){const n=(G().nodes||{})[cid.slice(2)];return n?(KINDN[n.kind]||'NPC'):''}const t=trs()[cid];return t?(t.kind==='npc'?'NPC':'PC'):''}
 /* 연락처를 건네거나 넣을 수 있는 사람: 이 방의 트레이너(비공개 시트 빼고) + 관계도의 NPC · 조직 */
 function people(){const me=myCid();const out=new Map();const put=(cid,name,img)=>{if(cid&&cid!==me&&!out.has(cid))out.set(cid,{cid,name,img,sub:cidSub(cid)})};
  /* 10-30 망령 「숨김 · NPC 는 연락처 건네기를 받기 전엔 추가 목록에 안 떠야」: 숨김(share=false · 비공개 시트) · NPC 트레이너 · 관계도의 NPC/조직 노드는 GM 이 아니면 이미 내 연락처에 있을 때만.
     (관계도 노드가 같은 이름의 트레이너로 이어질 때도 그 트레이너 기준으로 거른다 — 예전엔 숨긴 트레이너가 관계도 노드로 새어 나왔다) */
  const okT=x=>gm()||inBook(x.id)||(shared(x.id)&&x.kind!=='npc');
  for(const x of Object.values(trs()))if(okT(x))put(x.id,x.name,por(x.name,x.image));
  for(const n of Object.values(G().nodes||{})){const t=Object.values(trs()).find(x=>x.name===n.name);if(t?okT(t):(gm()||n.kind==='pc'||inBook('n:'+n.id)))put(cidOfNode(n),n.name,por(n.name,n.img))}
  return [...out.values()].sort((a,b)=>String(a.name).localeCompare(String(b.name),'ko'))}
 /* 이 휴대폰 주인이 들어가 있는 방인가 (GM 이 남의 휴대폰을 볼 때도 주인 기준) */
 const memberOf=r=>!!r&&(r.kind==='party'?r.id==='party:'+roomOf2(PH.tid):r.kind==='gm'?true:(r.members||[]).includes(myCid()));
 /* 받은 연락처 카드 중 아직 안 넣은 것 */
 function cardsIn(){const me=myCid();const no=new Set(phoneData(PH.tid).cardx||[]);const out=new Map();
  for(const r of allSmsRows()){const c=r.data.card;if(!c||!c.cid||c.cid===me||r.data.cid===me||no.has(r.id)||inBook(c.cid))continue;if(!memberOf(roomOf(r.data.sms)))continue;out.set(c.cid,{row:r,cid:c.cid,name:c.name||cidName(c.cid)})}
  return [...out.values()]}
 /* 받은 파티 초대 중 아직 안 들어간 것 */
 function invitesIn(){const my=roomOf2(PH.tid);const out=new Map();
  for(const r of allSmsRows()){const v=r.data.inv;if(!v||!v.code||v.code===my||r.data.cid===myCid())continue;const room=roomOf(r.data.sms);if(!memberOf(room))continue;out.set(v.code,{row:r,code:v.code,rname:room.name})}
  return [...out.values()]}
 const preview=d=>d.card?'📇 '+(d.card.name||'')+' 연락처':d.inv?'👥 파티 초대 · '+(d.inv.code||''):d.t?String(d.t):d.img?'[사진]':'';
 async function sendCard(roomId){const S=spk();const ST=A().ST;await window.OM_STORE.addLog(ST.room,ST.secret,'chat',S.name||ST.name||'',{t:'',sms:roomId,as:S.name,k:S.key,cid:S.cid,card:{cid:S.cid,name:S.name}})}
 /* 고르기 창 (건네기 · 추가 · 단톡방 초대) */
 function pickSheet(title,hint,L,okLabel,extra,cb){const md=sheet(title,`<div class="small dim" style="margin-bottom:6px">${hint}</div><input type="search" class="sn-frq ph-pq" placeholder="이름으로 찾기">
   <div class="ph-list" style="max-height:42vh;overflow:auto;padding:0">${L.map(c=>`<label class="ph-item" data-q="${esc(String(c.name).toLowerCase())}" style="cursor:pointer"><input type="checkbox" value="${esc(c.cid)}" data-pk>${av(c.name,c.img,'sm')}<div class="ph-it"><b>${esc(c.name)}</b><small>${esc(c.sub||'')}${c.cid!==myCid()&&inBook(c.cid)?' · 내 연락처':''}</small></div></label>`).join('')||'<div class="ph-empty sm">고를 사람이 없다</div>'}</div>
   ${extra||''}<div class="row" style="margin-top:8px"><span class="sp"></span><button class="btn pri" data-pkok>${okLabel}</button></div>`);
  const q=md.querySelector('.ph-pq');q.oninput=()=>{const v=q.value.trim().toLowerCase();md.querySelectorAll('[data-q]').forEach(l=>l.style.display=!v||l.dataset.q.includes(v)?'':'none')};
  md.querySelector('[data-pkok]').onclick=async()=>{const cids=[...md.querySelectorAll('[data-pk]:checked')].map(x=>x.value);if(!cids.length)return A().toast('사람을 골라 줘');const opt={};md.querySelectorAll('[data-opt]').forEach(x=>opt[x.dataset.opt]=x.type==='checkbox'?x.checked:x.value);closeSheet();await cb(cids,opt)};return md}
 function giveCard(roomId){const S=spk();if(roomId){return sendCard(roomId).then(()=>A().toast('연락처 카드를 보냈다')).catch(e=>A().toast('보내지 못했다: '+e.message))}
  pickSheet('📇 내 연락처 건네기',`「${esc(S.name)}」의 연락처 카드를 1:1 문자로 보낸다. 받은 사람이 「저장」을 누르면 그쪽 연락처에 들어간다.`,people(),'건네기',
   '<label class="small" style="display:block;margin-top:8px"><input type="checkbox" data-opt="back" checked> 받는 사람도 내 연락처에 넣기 (서로 주고받기)</label>',
   async(cids,opt)=>{try{for(const c of cids){const id=dmId(myCid(),c);rememberOpen(id);await sendCard(id)}if(opt.back){const b=bookOf(PH.tid);await saveBook([...b,...cids.filter(c=>!b.some(x=>x.cid===c)).map(c=>({cid:c,n:'',at:Date.now()}))])}A().toast(`연락처를 ${cids.length}명에게 건넸다`)}catch(e){A().toast('건네지 못했다: '+e.message)}re()})}
 function renameContact(cid){const e=bookOf(PH.tid).find(x=>x.cid===cid);if(!e)return;const real=cidName(cid);
  const md=sheet('등록 이름',`<div class="small dim" style="margin-bottom:6px">「${esc(real)}」을(를) 내 휴대폰에 어떤 이름으로 둘까? 비우면 본명.</div><input type="text" id="cn_n" value="${esc(e.n||'')}" placeholder="${esc(real)}" maxlength="30" style="width:100%"><div class="row" style="margin-top:8px"><span class="sp"></span><button class="btn pri" id="cn_ok">저장</button></div>`);
  const inp=$('#cn_n',md);inp.focus();inp.onkeydown=ev=>{if(ev.key==='Enter'&&!ev.isComposing)$('#cn_ok',md).click()};
  $('#cn_ok',md).onclick=async()=>{const v=inp.value.trim().slice(0,30);closeSheet();await saveBook(bookOf(PH.tid).map(x=>x.cid===cid?Object.assign({},x,{n:v===real?'':v}):x));re()}}
 /* 10-30 받침에 맞는 「로 / 으로」 (감우로 · 반디로 · 시온으로 · 서울로) */
 const ro=w=>{const c=String(w||'').trim().slice(-1).charCodeAt(0)-0xAC00;if(!(c>=0&&c<11172))return '(으)로';const j=c%28;return j===0||j===8?'로':'으로'};
 const dmId=(a,b)=>'dm:'+[a,b].sort().join('|');
 const dmMembers=id=>id.startsWith('dm:')?id.slice(3).split('|'):null;
 function openedRooms(){try{return JSON.parse(localStorage.getItem(OPEN_KEY)||'[]')}catch(e){return []}}
 function rememberOpen(id){const o=openedRooms();if(!o.includes(id)){o.push(id);try{localStorage.setItem(OPEN_KEY,JSON.stringify(o.slice(-50)))}catch(e){}}}
 function allSmsRows(){return (A().ST.log||[]).filter(r=>r.kind==='chat'&&r.data&&r.data.sms&&r.data.sms!=='sns')}   /* SNS 줄은 문자 방이 아니다 */
 function rooms(){const me=myCid();const out=new Map();const put=r=>{if(r&&r.id&&!out.has(r.id))out.set(r.id,r)};
  /* 자리도 파티도 없으면(관전 · 아직 파티 안 불러온 자리) 방이 하나도 없다 */
  const t=owner();if(!gm()&&(!A().ST.role||!t))return [];
  /* 「파티」 방은 방 코드마다 하나(party:코드). 코드가 없으면 파티 방도 없다. 옛 'party' 방은 GM 만 본다 */
  const myCode=roomOf2(PH.tid);if(myCode)put({id:'party:'+myCode,name:'파티 · '+myCode,members:[],kind:'party'});
  if(gm()){put({id:'party',name:'파티 (옛 방)',members:[],kind:'party'});for(const row of allSmsRows()){const id=row.data.sms;if(id.startsWith('party:'))put({id,name:'파티 · '+id.slice(6),members:[],kind:'party'})}}
  for(const r of (((A().ST.state.rp||{}).sms||{}).rooms||[]))if(r&&r.id)put(Object.assign({kind:'gm',members:[]},r));
  /* 10-30 단체방 정의는 나중 줄이 이긴다 — 사람 초대 · 나가기는 새 정의 한 줄 */
  for(const row of allSmsRows()){const d=row.data;if(d.room&&d.room.name){const o=out.get(d.sms);if(!o||o.kind==='group')out.set(d.sms,{id:d.sms,name:d.room.name,members:d.room.members||[],kind:'group',by:(o&&o.by)||d.cid||''})}}
  for(const row of allSmsRows()){const m=dmMembers(row.data.sms);if(m)put({id:row.data.sms,members:m,kind:'dm'})}
  for(const id of openedRooms()){const m=dmMembers(id);if(m)put({id,members:m,kind:'dm'})}
  const list=[...out.values()].filter(r=>gm()||r.kind==='party'||r.kind==='gm'||(r.members||[]).includes(me));
  for(const r of list)if(r.kind==='dm'){const other=(r.members||[]).find(x=>x!==me)||(r.members||[])[0];r.name=gm()&&!(r.members||[]).includes(me)?r.members.map(cidName).join(' · '):nm(other);r.other=other}
  const LAST={};for(const row of allSmsRows()){const k=row.data.sms;if(!LAST[k]||row.id>LAST[k])LAST[k]=row.id}const lastId=id=>LAST[id]||0;list.sort((a,b)=>lastId(b.id)-lastId(a.id));   /* 10-30 방 정의 줄(단톡방 만들기 · 초대)도 순서에 넣는다 */
  return list}
 function roomOf(id){return rooms().find(x=>x.id===id)}
 function smsLogs(room){return allSmsRows().filter(r=>!r.data.room&&(!room||r.data.sms===room))}
 function seen(){try{return JSON.parse(localStorage.getItem(SEEN_KEY)||'{}')}catch(e){return {}}}
 function markSeen(room){const l=smsLogs(room);if(!l.length)return;const s=seen();s[room]=l[l.length-1].id;try{localStorage.setItem(SEEN_KEY,JSON.stringify(s))}catch(e){}}
 function unread(room){const s=seen();const last=+s[room]||0;return smsLogs(room).filter(r=>r.id>last).length}
 function unreadAll(){return rooms().reduce((a,r)=>a+unread(r.id),0)}
 function spk(){const me=myCid();return {key:cidKey(me),cid:me,name:cidName(me)||A().ST.name||'',img:cidImg(me)}}
 function roomIcon(r){if(r.kind==='party')return '<i class="ph-av ph-room">👥</i>';if(r.kind==='dm'){const u=cidImg(r.other);return `<i class="ph-av" style="${u?`background-image:url('${cssu(u)}')`:''}"></i>`}return '<i class="ph-av ph-room">💬</i>'}
 function smsRooms(t){const rs=rooms();return `<div class="ph-head green"><button class="ph-back" data-ph="home">‹</button><div><b>문자</b><small>${esc(spk().name)} · 로그에는 안 보인다</small></div>${A().ST.role?'<button class="btn xs" data-ph="smsnew" title="1:1 · 단톡방">＋ 새 문자</button>':''}</div>
   <div class="ph-list">${rs.length?'':`<div class="ph-empty">${!A().ST.role?'자리에 앉아야 문자를 쓸 수 있다':!owner()?'아직 내 파티가 없다 — 시트 탭에서 「내 파티 불러오기」':'연락처에서 사람을 누르면 1:1, 「＋ 새 문자」에서 여럿을 고르면 단톡방이 생긴다.'}</div>`}${rs.map(r=>{const L=smsLogs(r.id);const last=L[L.length-1];const u=unread(r.id);const sub=last?esc((last.data.as||last.who)+': '+preview(last.data).slice(0,40)):(r.kind==='dm'?'아직 대화가 없다 — 첫 문자를 보내 봐':'아직 대화가 없다');const mem=r.kind==='group'?` <span class="small dim">· ${(r.members||[]).length}명</span>`:'';return `<div class="ph-item" data-ph="smsopen" data-room="${esc(r.id)}">${roomIcon(r)}<div class="ph-it"><b>${esc(r.name)}${u?` <em class="ph-badge inline">${u}</em>`:''}${mem}</b><small>${sub}</small></div>${last?`<small class="ph-when">${hmOf(last.at)}</small>`:''}${gm()&&r.kind==='gm'?`<button class="btn xs ghost" data-ph="smsdel" data-room="${esc(r.id)}">✕</button>`:''}</div>`}).join('')}</div>`}
 function cardBub(d,mine){const c=d.card;const have=c.cid===myCid()||inBook(c.cid);const img=cidImg(c.cid);
  return `<div class="ph-bub ph-cardb"><i class="ph-av sm" style="${img?`background-image:url('${cssu(img)}')`:''}"></i><div><small>📇 연락처</small><b>${esc(c.name||cidName(c.cid))}</b></div>${!mine&&canWrite()?(have?'<span class="ph-cardok">저장됨</span>':`<button class="btn xs pri" data-ph="cardsave" data-cid="${esc(c.cid)}">저장</button>`):''}</div>`}
 function invBub(d,mine){const v=d.inv;const my=roomOf2(PH.tid)===v.code;
  return `<div class="ph-bub ph-cardb inv"><i class="ph-av sm ph-room">👥</i><div><small>파티 초대</small><b>${esc(v.code)}</b></div>${canWrite()?(my?'<span class="ph-cardok">참가 중</span>':mine?'':`<button class="btn xs pri" data-ph="invjoin" data-code="${esc(v.code)}">참가</button>`):''}</div>`}
 function smsRoom(t){const rs=rooms();const r=rs.find(x=>x.id===PH.room)||rs[0];if(!r){PH.screen='sms';return smsRooms(t)}PH.room=r.id;const L=smsLogs(r.id);const me=myCid();const R=window.OM_RP_UI;let lastDay='';
  let prevK='',prevAt=0;const rows=L.map(x=>{const d=x.data;const at=new Date(x.at);const day=isNaN(at)?'':`${at.getMonth()+1}/${at.getDate()}`;const hm=isNaN(at)?'':`${String(at.getHours()).padStart(2,'0')}:${String(at.getMinutes()).padStart(2,'0')}`;let head='';if(day&&day!==lastDay){lastDay=day;head=`<div class="ph-day">${day}</div>`}
   const mine=d.cid?d.cid===me:d.k===spk().key;const img=d.cid?cidImg(d.cid):(d.k&&R&&R.imgOfKey?R.imgOfKey(d.k):'');const name=(d.cid&&!mine&&inBook(d.cid)?nm(d.cid):'')||d.as||x.who;
   /* 같은 사람이 3분 안에 이어 보내면 이름·얼굴을 한 번만 */
   const who=d.cid||d.k||name;const t0=+at||0;const cont=!head&&who===prevK&&t0-prevAt<180000;prevK=who;prevAt=t0;
   const txt=esc(d.t||'').replace(/@([^\s@]+)/g,'<span class="ph-at">@$1</span>');
   const pic=d.img?`<a class="ph-pic" href="${esc(d.img)}" target="_blank" rel="noopener"><img src="${esc(d.img)}" alt="" loading="lazy"></a>`:'';
   return head+`<div class="ph-msg ${mine?'me':''} ${cont?'cont':''}">${mine?'':`<i class="ph-av sm" style="${img?`background-image:url('${cssu(img)}')`:''}"></i>`}<div class="ph-mb">${cont?'':`<small class="ph-mn">${esc(name)}</small>`}${pic?`<div class="ph-bub pic">${pic}</div>`:''}${d.t?`<div class="ph-bub">${txt}</div>`:''}${d.card?cardBub(d,mine):''}${d.inv?invBub(d,mine):''}<small class="ph-mt">${hm}</small></div></div>`}).join('');
  const S=spk();const memLine=r.kind==='group'?(r.members||[]).map(nm).join(' · '):r.kind==='dm'?'1:1':'모두';const can=!!A().ST.role&&memberOf(r);
  const tools=can?`${r.kind!=='party'?'<button class="btn xs ghost" data-ph="cardsend" title="이 방에 내 연락처 카드를 보낸다">📇</button>':''}${r.kind==='group'?'<button class="btn xs ghost" data-ph="ginv" title="사람 초대">＋👤</button><button class="btn xs ghost" data-ph="pinv" title="이 단톡방 사람들과 파티를 맺는다">👥 파티</button><button class="btn xs ghost" data-ph="gleave" title="방에서 나간다">나가기</button>':''}`:'';
  return `<div class="ph-head green"><button class="ph-back" data-ph="sms">‹</button><div><b>${esc(r.name)}</b><small>${esc(memLine)} · ${L.length}개</small></div>${tools}</div>
   <div class="ph-sms">${rows||'<div class="ph-empty">첫 메시지를 보내 봐</div>'}</div>
   ${A().ST.role?`<div class="ph-smsin"><i class="ph-av sm" title="${esc(S.name)}" style="${S.img?`background-image:url('${cssu(S.img)}')`:''}"></i><label class="ph-clip" title="그림 보내기 (끌어 놓기 · Ctrl+V 도 된다)">📎<input type="file" accept="image/*" id="smsFile" hidden></label><input type="text" id="smsIn" placeholder="${esc(S.name)}${ro(S.name)} 보내기 · @이름" value="${esc(PH.draft[r.id]||'')}"><button class="btn pri sm" data-ph="smssend">➤</button></div>`:''}`}
 /* ----- SNS (10-24 벨벳 NyangStar 참고): 방 모두가 보는 타임라인. 로그 kind chat + data.sms='sns' — 문자처럼 채팅 · 무대 · 세션 로그에서 빠진다.
    글 {t,img?} · 댓글 {re:글 id} · 좋아요 {like:글 id} (같은 사람이 다시 누르면 취소) · 지우기 {del:글 id, 쓴 사람 · GM}.
    올리는 이름은 휴대폰 주인 — GM 은 홈에서 「누구의 휴대폰」으로 NPC · 조직(체육관 · 로켓단 계정)을 골라 올린다 ----- */
 const SNS_SEEN='om_sns_seen';
 const isSns=d=>!!d&&d.sms==='sns';
 function snsRows(){return (A().ST.log||[]).filter(r=>r.kind==='chat'&&isSns(r.data))}
 /* 10-24 망령: 친구 공개 — 글에 fo:1 이 붙으면 쓴 계정의 친구 목록(pub.<계정>.phone.snsFriends)에 든 사람과 쓴 사람, GM 만 본다 (뒷계 · 비밀글).
    화면에서 가리는 방식이라 로그 자체는 방 안에 남는다 */
 const snsFriends=cid=>((phoneData(cid)||{}).snsFriends)||[];
 function snsVisible(d){if(!d||!d.fo)return true;if(gm())return true;const me=myCid();return d.cid===me||snsFriends(d.cid).includes(me)}
 function snsAccounts(){const out=Object.values(trs()).map(t=>({cid:t.id,name:t.name,kind:'트레이너'}));const tn=new Set(out.map(x=>x.name));for(const n of Object.values(G().nodes||{}))if(!tn.has(n.name))out.push({cid:'n:'+n.id,name:n.name,kind:KINDN[n.kind]||'NPC'});return out}
 function snsModel(){const posts=new Map(),dels=new Set(),likes={},cms={};
  for(const r of snsRows()){const d=r.data;if(d.del){dels.add(+d.del);continue}
   if(d.like){const L=likes[d.like]||(likes[d.like]=new Map());const c=d.cid||r.who;L.has(c)?L.delete(c):L.set(c,d.as||r.who);continue}
   if(d.re){(cms[d.re]||(cms[d.re]=[])).push(r);continue}if(d.t||d.img)posts.set(r.id,r)}
  return [...posts.values()].filter(r=>!dels.has(r.id)&&snsVisible(r.data)).reverse().map(r=>({r,likes:likes[r.id]||new Map(),cms:(cms[r.id]||[]).filter(c=>!dels.has(c.id))}))}
 function snsLast(){try{return +localStorage.getItem(SNS_SEEN)||0}catch(e){return 0}}
 function snsUnread(){const s=snsLast();const me=myCid();return snsRows().filter(r=>r.id>s&&!r.data.like&&!r.data.del&&!r.data.re&&(r.data.t||r.data.img)&&r.data.cid!==me&&snsVisible(r.data)).length}
 function snsSeen(){const L=snsRows();if(L.length)try{localStorage.setItem(SNS_SEEN,String(L[L.length-1].id))}catch(e){}}
 function snsHandle(cid){if(!cid)return '';if(cid==='gm')return 'GM';if(cid.startsWith('n:')){const n=(G().nodes||{})[cid.slice(2)];return n?(KINDN[n.kind]||'NPC'):''}return '트레이너'}
 const snsFmt=t=>esc(t).replace(/(^|\s)#([^\s#@]+)/g,'$1<span class="sn-tag">#$2</span>').replace(/@([^\s@]+)/g,'<span class="ph-at">@$1</span>');
 const snsAgo=at=>{const d=new Date(at);if(isNaN(d))return '';const s=(Date.now()-d)/1000;return s<60?'방금':s<3600?Math.floor(s/60)+'분 전':s<86400?Math.floor(s/3600)+'시간 전':`${d.getMonth()+1}/${d.getDate()}`};
 function snsCan(){return !!A().ST.role&&(gm()||!!owner())}
 function sns(t){const S=spk();const M=snsModel();const me=myCid();
  const avs=(cid,cls)=>{const u=cidImg(cid);return `<i class="ph-av ${cls||'sm'}" style="${u?`background-image:url('${cssu(u)}')`:''}"></i>`};
  const compose=snsCan()?`<div class="sn-new">${avs(S.cid)}<div class="sn-nb"><textarea id="snIn" rows="2" placeholder="${esc(S.name)} 으로 올리기 · #태그 · @이름">${esc(PH.snDraft||'')}</textarea>
    <div class="sn-nr">${PH.snImg?`<span class="sn-att"><img src="${esc(PH.snImg)}" alt=""><button type="button" data-ph="snimgx" title="그림 빼기">✕</button></span>`:''}<label class="ph-clip" title="그림 붙이기 (붙여넣기도 된다)">📷<input type="file" accept="image/*" id="snFile" hidden></label><button type="button" class="sn-vis ${PH.snFo?'on':''}" data-ph="snvis" title="${PH.snFo?'친구만 본다 — 누르면 전체 공개':'모두가 본다 — 누르면 친구만'}">${PH.snFo?'🔒 친구만':'🌐 전체'}</button><span class="sp"></span><button class="btn xs pri" data-ph="snpost">올리기</button></div></div></div>`
   :`<div class="ph-empty sm">${!A().ST.role?'자리에 앉으면 글을 올릴 수 있다':'시트 탭에서 「내 파티 불러오기」를 하면 글을 올릴 수 있다'}</div>`;
  const cards=M.map(({r,likes,cms})=>{const d=r.data;const liked=likes.has(me);const open=PH.snOpen===r.id;const shown=open?cms:cms.slice(-2);
   const lk=[...likes.values()];
   return `<article class="sn-card" data-sn="${r.id}"><div class="sn-h">${avs(d.cid)}<div class="sn-who"><b>${esc(d.as||r.who)}</b><small>${esc(snsHandle(d.cid))} · ${esc(snsAgo(r.at))}${d.fo?' · <span class="sn-fo" title="친구만 보는 글">🔒 친구만</span>':''}</small></div><span class="sp"></span>${gm()||d.cid===me?`<button type="button" class="sn-x" data-ph="sndel" data-id="${r.id}" title="지우기">✕</button>`:''}</div>
    ${d.img?`<a class="sn-pic" href="${esc(d.img)}" target="_blank" rel="noopener"><img src="${esc(d.img)}" alt="" loading="lazy"></a>`:''}${d.t?`<div class="sn-t">${snsFmt(d.t)}</div>`:''}
    <div class="sn-act"><button type="button" class="sn-b sn-like ${liked?'on':''}" data-ph="snlike" data-id="${r.id}" ${snsCan()?'':'disabled'}>${liked?'♥':'♡'}<span>${likes.size||''}</span></button><button type="button" class="sn-b" data-ph="sncm" data-id="${r.id}">💬<span>${cms.length||''}</span></button>${lk.length?`<small class="sn-lw">${esc(lk.slice(0,2).join(', '))}${lk.length>2?` 외 ${lk.length-2}명`:''} 님이 좋아한다</small>`:''}</div>
    ${cms.length>shown.length?`<button type="button" class="sn-more" data-ph="sncm" data-id="${r.id}">댓글 ${cms.length}개 모두 보기</button>`:''}
    ${shown.length?`<div class="sn-cms">${shown.map(c=>`<div class="sn-c"><b>${esc(c.data.as||c.who)}</b> ${snsFmt(c.data.t||'')}${gm()||c.data.cid===me?`<button type="button" class="sn-cx" data-ph="sndel" data-id="${c.id}" title="지우기">✕</button>`:''}</div>`).join('')}</div>`:''}
    ${open&&snsCan()?`<div class="sn-cin">${avs(S.cid,'xs')}<input type="text" id="snCm" placeholder="${esc(S.name)} 으로 댓글" autocomplete="off"><button type="button" class="btn xs" data-ph="sncmsend" data-id="${r.id}">게시</button></div>`:''}</article>`}).join('');
  return `<div class="ph-head pink"><button class="ph-back" data-ph="home">‹</button><div><b>SNS</b><small>${esc(S.name)} · 글 ${M.length}개</small></div>${snsCan()?`<span class="sp"></span><button type="button" class="sn-frb" data-ph="snfr" title="「🔒 친구만」 글을 볼 수 있는 사람">👥 친구 ${snsFriends(S.cid).length}</button>`:''}</div>
   <div class="sn-feed">${compose}${cards||'<div class="ph-empty">아직 올라온 글이 없다</div>'}</div>`}
 async function snsAdd(data){const S=spk();const ST=A().ST;await window.OM_STORE.addLog(ST.room,ST.secret,'chat',S.name||ST.name||'',Object.assign({t:'',sms:'sns',as:S.name,k:S.key,cid:S.cid},data))}
 async function snsPost(md){const inp=$('#snIn',md);const t=(inp?inp.value:'').trim();const img=PH.snImg||'';if(!t&&!img)return A().toast('쓸 말이나 그림을 넣어 줘');
  try{await snsAdd(Object.assign({t},img?{img}:{},PH.snFo?{fo:1}:{}));PH.snDraft='';PH.snImg='';PH.snOpen=0;re()}catch(e){A().toast('올리지 못했다: '+e.message)}}
 async function snsImg(f){if(!f||!/^image\//.test(f.type||''))return;if(f.size>5*1024*1024)return A().toast('5MB 이하만');const ST=A().ST;A().toast('그림을 올리는 중…');
  try{PH.snImg=await window.OM_STORE.uploadImage(`rooms/${ST.room}/sns_${Date.now().toString(36)}`,f);re()}catch(e){A().toast('그림을 올리지 못했다: '+e.message)}}
 async function smsSend(md){const inp=$('#smsIn',md);if(!inp)return;const t=inp.value.trim();if(!t)return;inp.value='';const S=spk();const ST=A().ST;
  delete PH.draft[PH.room];
  try{await window.OM_STORE.addLog(ST.room,ST.secret,'chat',S.name||ST.name||'',{t,sms:PH.room,as:S.name,k:S.key,cid:S.cid})}catch(e){A().toast('보내지 못했다: '+e.message)}}
 /* 문자로 그림 보내기: 📎 · 끌어 놓기 · 붙여넣기 → 저장소에 올리고 data.img 로 한 줄 */
 async function smsImg(f){if(!f||!/^image\//.test(f.type||''))return;if(f.size>5*1024*1024)return A().toast('5MB 이하만');const S=spk();const ST=A().ST;A().toast('그림을 보내는 중…');
  try{const url=await window.OM_STORE.uploadImage(`rooms/${ST.room}/sms_${Date.now().toString(36)}`,f);await window.OM_STORE.addLog(ST.room,ST.secret,'chat',S.name||ST.name||'',{t:'',img:url,sms:PH.room,as:S.name,k:S.key,cid:S.cid})}catch(e){A().toast('보내지 못했다: '+e.message)}}
 /* 새 문자가 오면 (내 방이고 내 것이 아니면) 알림을 띄우고, 열려 있으면 다시 그린다 */
 function onSms(row){const d=row.data||{};const md=$('.modal.phone-modal');
  if(isSns(d)){if(md&&(PH.screen==='sns'||PH.screen==='home')){const a=document.activeElement;if(!(a&&md.contains(a)&&a.matches('input,textarea'))||PH.screen==='home')draw(md)}A().renderScene();return}
 const openHere=md&&PH.screen==='smsroom'&&PH.room===d.sms;
  if(openHere){draw(md);try{const mine=A().isMineLog?A().isMineLog(row):d.cid===myCid();if(!mine&&(d.t||d.img)&&(!A().alarm||A().alarm().sms)&&window.OM_PREFS)window.OM_PREFS.alert('smsin')}catch(e){}return}   /* 10-26: 그 방을 보고 있어도 짧게 */
  const isMine=A().isMineLog?A().isMineLog(row):d.cid===myCid();const room=roomOf(d.sms);const al=A().alarm?A().alarm().sms:1;
  /* 10-26 망령 「문자 왔을 때 알림음」: 문자 전용 소리(띠링띠링 · 효과음 목록에 sms 가 있으면 그 파일). 단체방 첫 메시지(d.room)도 울린다 */
  if(!isMine&&room&&al&&(d.t||d.img||d.card||d.inv)){popSms(row,room);try{if(window.OM_PREFS)window.OM_PREFS.alert('sms');else if(window.OM_RP_UI)window.OM_RP_UI.playSe('Ping',true)}catch(e){}}
  if(md&&PH.screen==='sms')draw(md);A().renderScene()}
 /* 문자 알림: 왼쪽 아래에서 휴대폰이 올라오고 알림 카드가 뜬다. 여러 개면 위로 쌓이고(최대 3), 누르면 그 방이 열린다. 6초 뒤 내려간다 */
 const POP={list:[],t:null};
 function popSms(row,room){const d=row.data||{};const name=d.as||row.who||'';const img=d.cid?cidImg(d.cid):'';
  POP.list.unshift({id:row.id,room:room.id,rname:room.kind==='dm'?'':room.name,name,img,t:preview(d),at:Date.now()});POP.list=POP.list.slice(0,3);
  let el=document.getElementById('smsPop');if(!el){el=document.createElement('div');el.id='smsPop';el.className='smspop';document.body.appendChild(el)}
  const now=new Date();const hm=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  el.innerHTML=`<div class="sp-phone"><div class="sp-notch"></div><div class="sp-clock">${hm}</div>
   <div class="sp-cards">${POP.list.map((x,i)=>`<button class="sp-card ${i?'old':''}" data-room="${esc(x.room)}"><div class="sp-app"><i>💬</i><span>문자${x.rname?' · '+esc(x.rname):''}</span><em>${(Date.now()-x.at)<60000?'지금':Math.round((Date.now()-x.at)/60000)+'분 전'}</em></div><div class="sp-body"><i class="sp-av" style="${x.img?`background-image:url('${cssu(x.img)}')`:''}">${x.img?'':esc((x.name||'?').slice(0,1))}</i><div><b>${esc(x.name)}</b><p>${esc(x.t.length>70?x.t.slice(0,70)+'…':x.t)}</p></div></div></button>`).join('')}</div>
   <div class="sp-dock"><span>📞</span><span>💬</span><span>🤝</span><span>📅</span></div></div><button class="sp-x" title="닫기">✕</button>`;
  el.classList.remove('show','buzz');void el.offsetWidth;el.classList.add('show','buzz');
  el.querySelectorAll('.sp-card').forEach(b=>b.onclick=()=>{hidePop(true);PH.room=b.dataset.room;PH.screen='smsroom';open('smsroom')});
  el.querySelector('.sp-x').onclick=e=>{e.stopPropagation();hidePop(true)};
  el.onmouseenter=()=>clearTimeout(POP.t);el.onmouseleave=()=>{clearTimeout(POP.t);POP.t=setTimeout(hidePop,2500)};
  clearTimeout(POP.t);POP.t=setTimeout(hidePop,6000)}
 function hidePop(clear){const el=document.getElementById('smsPop');if(el)el.classList.remove('show','buzz');if(clear)POP.list=[];else setTimeout(()=>{if(!(el&&el.classList.contains('show')))POP.list=[]},500)}
 /* 새 문자: 연락처에서 한 사람 고르면 1:1, 여럿 고르고 이름을 적으면 새 방 */
 function contactsForSms(){const me=myCid();const out=new Map();const put=(cid,name,sub)=>{if(cid&&cid!==me&&!out.has(cid))out.set(cid,{cid,name,sub})};
  const my=roomOf2(PH.tid);for(const e of bookOf(PH.tid))put(e.cid,e.n||cidName(e.cid),'내 연락처'+(e.n&&e.n!==cidName(e.cid)?' · '+cidName(e.cid):''));
  for(const x of Object.values(trs())){if(gm()||(my&&roomOf2(x.id)===my&&shared(x.id)))put(x.id,x.name,(my&&roomOf2(x.id)===my?'파티원':'트레이너')+(x.kind==='npc'?' · NPC':''))}
  if(gm())for(const n of Object.values(G().nodes||{}))put(cidOfNode(n),n.name,KINDN[n.kind]||'');
  return [...out.values()]}
 function openDm(cid){const id=dmId(myCid(),cid);rememberOpen(id);PH.room=id;PH.screen='smsroom';return re()}
 function newSms(pre){const list=contactsForSms();if(!list.length)return A().toast('문자할 사람이 없다 — 연락처에 먼저 넣어 줘 (📇 건네기 · ＋ 추가)');
  const md=sheet(`새 문자 · 단톡방`,`
   <div class="small dim" style="margin-bottom:6px">한 사람만 고르고 이름을 비우면 1:1 문자. 단톡방 이름을 적으면 (한 사람이어도) 단톡방이 생긴다 — 나도 들어간다.</div>
   <div class="ph-list" style="max-height:45vh;overflow:auto;padding:0">${list.map(c=>`<label class="ph-item" style="cursor:pointer"><input type="checkbox" value="${esc(c.cid)}" data-sc ${pre===c.cid?'checked':''}>${av(c.name,cidImg(c.cid),'sm')}<div class="ph-it"><b>${esc(c.name)}</b><small>${esc(c.sub)}</small></div></label>`).join('')}</div>
   <div class="row" style="margin-top:10px"><input type="text" id="ns_name" placeholder="단톡방 이름 (여럿일 때)" style="flex:1"><button class="btn pri" id="ns_ok">보내러 가기</button></div>`);
  $('#ns_ok',md).onclick=async()=>{const cids=[...md.querySelectorAll('[data-sc]:checked')].map(x=>x.value);if(!cids.length)return A().toast('받을 사람을 골라 줘');
   const name=$('#ns_name',md).value.trim();if(cids.length===1&&!name){closeSheet();return openDm(cids[0])}if(!name)return A().toast('단톡방 이름을 적어 줘');const id='g'+Date.now().toString(36);const S=spk();const ST=A().ST;closeSheet();
   try{await window.OM_STORE.addLog(ST.room,ST.secret,'chat',S.name||ST.name||'',{t:'',sms:id,as:S.name,k:S.key,cid:S.cid,room:{name,members:[...new Set([S.cid,...cids])]}})}catch(e){return A().toast('방을 만들지 못했다: '+e.message)}
   let tries=0;const go=()=>{if(roomOf(id)||++tries>25){PH.room=id;PH.screen='smsroom';re()}else setTimeout(go,200)};setTimeout(go,150)}}
 /* ----- 연락처: 파티원은 로스터(시트 → 제작기에서 가져오기)에서 저절로 · 그 밖의 사람은 「＋ 추가」로 관계도 노드를 내 연락처에 넣는다 ----- */
 /* 방 코드: pub[tid].phone.room — 같은 코드를 넣은 사람끼리 파티원으로 보인다 (코드가 비어 있으면 코드 없는 사람들끼리). share=false 면 남의 목록에 안 뜬다. GM 은 코드별로 전부 본다 */
 const roomOf2=tid=>String((phoneData(tid).room||'')).trim();
 const shared=tid=>phoneData(tid).share!==false&&!(trs()[tid]||{}).priv;   /* 10-22 망령: 시트를 비공개로 두면 남의 연락처에도 안 뜬다 */
 /* 10-28 망령: 「파티」 앱 (js/ppool.js) — 같은 방 코드 파티원의 4식 · 6령을 합친 목록과 포켓몬 현황 */
 function roomForm(my){return `<div class="ph-room"><div class="row"><input type="text" id="ph_room" value="${esc(my)}" placeholder="파티 코드 (예: velvet-01)" ${canWrite()?'':'readonly'}>${canWrite()?`<button class="btn sm pri" data-ph="roomgo">${my?'바꾸기':'맺기'}</button>`:''}${my&&canWrite()?'<button class="btn sm ghost" data-ph="roomout" title="파티에서 나간다">나가기</button>':''}</div>
   ${canWrite()?`<label class="small"><input type="checkbox" id="ph_share" ${shared(PH.tid)?'checked':''}> 파티원 목록에 나를 보이기</label>`:''}<div class="small dim">같은 코드를 넣은 사람끼리 파티가 된다. 단톡방에서 「👥 파티」를 누르면 방 사람들에게 초대가 가고, 받은 사람은 「참가」 한 번이면 된다.</div></div>`}
 function partyScr(t){const my=roomOf2(PH.tid);const PP=window.OM_PPOOL;const tab=PH.ptab||'all';const IV=invitesIn();
  const inv=IV.length?`<div class="ph-sec">받은 초대 <span class="sp"></span><span class="small dim">${IV.length}</span></div><div class="ph-list">${IV.map(x=>`<div class="ph-item"><i class="ph-av ph-room">👥</i><div class="ph-it"><b>${esc(x.code)}</b><small>${esc(x.row.data.as||x.row.who||'')} · ${esc(x.rname||'')}</small></div>${canWrite()?`<button class="btn xs pri" data-ph="invjoin" data-code="${esc(x.code)}">참가</button>`:''}</div>`).join('')}</div>`:'';
  const head=`<div class="ph-head"><button class="ph-back" data-ph="home">‹</button><div><b>파티</b><small>${my?'코드 '+esc(my):'아직 파티가 없다'}</small></div></div>`;
  if(!my)return head+inv+`<div class="ph-sec">파티 맺기</div>`+roomForm(my);
  const tabs=[['all','전체'],['ord','4식 · 6령'],['mon','포켓몬']];
  return head+inv+`<div class="ph-pp">${PP.chip(my,PH.tid)}</div><div class="ph-ptab">${tabs.map(([k,n])=>`<button class="${tab===k?'on':''}" data-ph="ptab" data-v="${k}">${n}</button>`).join('')}</div><div class="ph-ppbody">${PP.html(my,{me:PH.tid,only:tab==='all'?'':tab})}</div><details class="ph-roomd"><summary>파티 코드 · 나가기</summary>${roomForm(my)}</details>`}
 function contacts(t){const B=bookOf(PH.tid);const P=cardsIn();const S=spk();
  const item=e=>{const real=cidName(e.cid);const isT=!!trs()[e.cid];const sub=[e.n&&e.n!==real?real:'',cidSub(e.cid)].filter(Boolean).join(' · ');
   return `<div class="ph-item" data-ph="dm" data-cid="${esc(e.cid)}">${av(real,cidImg(e.cid))}<div class="ph-it"><b>${esc(e.n||real)}</b><small>${esc(sub)}</small></div>${isT?`<button class="btn xs ghost" data-ph="sheet" data-tid="${esc(e.cid)}" title="시트 보기">시트</button>`:''}${canWrite()?`<button class="btn xs ghost" data-ph="ctname" data-cid="${esc(e.cid)}" title="등록 이름 바꾸기">✎</button><button class="btn xs ghost" data-ph="ctdel" data-cid="${esc(e.cid)}" title="연락처에서 지우기">✕</button>`:''}<span class="ph-arrow" title="문자">💬</span></div>`};
  return `<div class="ph-head"><button class="ph-back" data-ph="home">‹</button><div><b>연락처</b><small>${esc(S.name||'')} · ${B.length}명 · 누르면 문자</small></div>${canWrite()?'<button class="btn xs" data-ph="ctgive" title="내 연락처 카드를 건넨다">📇 건네기</button><button class="btn xs" data-ph="ctadd">＋ 추가</button>':''}</div>
   <div class="ph-cq"><input type="search" id="ph_cq" placeholder="🔍 이름으로 찾기" value="${esc(PH.cq||'')}"></div>
   ${P.length?`<div class="ph-sec">받은 연락처 <span class="sp"></span><span class="small dim">${P.length}</span></div><div class="ph-list">${P.map(c=>`<div class="ph-item ph-cardin">${av(c.name,cidImg(c.cid))}<div class="ph-it"><b>📇 ${esc(c.name)}</b><small>${esc(c.row.data.as||c.row.who||'')} 이(가) 건넨 연락처</small></div>${canWrite()?`<button class="btn xs pri" data-ph="cardsave" data-cid="${esc(c.cid)}">저장</button><button class="btn xs ghost" data-ph="cardx" data-id="${c.row.id}" title="넣지 않고 치운다">✕</button>`:''}</div>`).join('')}</div>`:''}
   <div class="ph-sec">내 연락처 <span class="sp"></span><span class="small dim">${B.length}</span></div>
   <div class="ph-list">${B.map(item).join('')||'<div class="ph-empty small">아직 아무도 없다.<br>「📇 건네기」로 내 연락처를 주거나, 받은 카드를 저장하거나, 「＋ 추가」로 넣어 둬.</div>'}</div>
   ${window.OM_PPOOL?`<div class="ph-sec">파티 <span class="sp"></span><span class="small dim">${roomOf2(PH.tid)?'코드 '+esc(roomOf2(PH.tid)):'없음'}</span><button class="btn xs ghost" data-ph="party">👥 파티</button></div>`:''}`}
 function addContact(){const L=people().filter(c=>!inBook(c.cid));if(!L.length)return A().toast('더 넣을 사람이 없다');
  pickSheet('연락처에 추가','이 방의 사람 중에서 고른다. 등록 이름은 넣은 뒤 ✎ 로 바꿀 수 있다.',L,'추가','',async cids=>{await saveBook([...bookOf(PH.tid),...cids.map(c=>({cid:c,n:'',at:Date.now()}))]);go('contacts')})}
 /* ----- 협력자: 관계도의 선 ----- */
 function confidants(t){const g=G();if(!t)return `<div class="ph-head red"><button class="ph-back" data-ph="home">‹</button><div><b>협력자</b><small>${esc(A().ST.name||'')}</small></div></div><div class="ph-empty">아직 내 파티가 없다<br><span class="small">시트 탭에서 「내 파티 불러오기」를 하면 내 캐릭터의 협력자가 여기 보인다</span></div>`;const node=nodeOfTrainer(t);if(!node)return `<div class="ph-head red"><button class="ph-back" data-ph="home">‹</button><div><b>협력자</b><small>${esc(t?t.name:'')}</small></div>${gm()?'<button class="btn xs" data-ph="nodeadd">＋ 노드</button>':''}</div><div class="ph-empty">관계도에 「${esc(t?t.name:'')}」 노드가 아직 없다${gm()?'<br><br><button class="btn sm pri" data-ph="mynode">「'+esc(t?t.name:'')+'」 노드 만들기</button>':'<br><span class="small">GM 이 접속해 있으면 저절로 생긴다</span>'}</div>`;
  const edges=Object.values(g.edges||{}).filter(e=>e.a===node.id||e.b===node.id).map(e=>Object.assign({},e,{o:g.nodes[e.a===node.id?e.b:e.a]})).filter(e=>e.o).sort((x,y)=>(+y.rank||0)-(+x.rank||0));
  const MAX=10;
  return `<div class="ph-head red"><button class="ph-back" data-ph="home">‹</button><div><b>협력자</b><small>${esc(node.name)} · ${edges.length}명과의 유대</small></div>${gm()?`<button class="btn xs" data-ph="nodeadd" title="관계도에 새 사람(노드)을 만든다">＋ 노드</button><button class="btn xs" data-ph="confadd">＋ 관계</button>`:''}</div>
   <div class="ph-list">${edges.map(e=>{const r=Math.max(0,Math.min(MAX,+e.rank||0));return `<div class="ph-item conf ${e.shock?'shock':''} ${PH.confEdit?'editing':''}" data-ph="conf1" data-e="${e.id}">${av(e.o.name,e.o.img)}<div class="ph-it"><b>${esc(e.o.name)}</b><small>${esc(e.label||({pc:'PC',npc:'NPC',org:'조직'})[e.o.kind]||'')}</small><div class="ph-rank">${Array.from({length:MAX},(_,i)=>`<i class="${i<r?'on':''}"></i>`).join('')}<em>${r}</em></div>${e.shock?`<small class="ph-shock">⚡ 쇼크${e.shockNote?' · '+esc(e.shockNote):''}</small>`:''}${e.o.note?`<small class="ph-note">${esc(String(e.o.note).split('\n')[0])}</small>`:''}</div>${PH.confEdit&&gm()?`<div class="ph-ced"><button class="btn xs" data-ph="cup" data-e="${e.id}" title="강화 +1">＋</button><button class="btn xs ghost" data-ph="cdn" data-e="${e.id}" title="−1">－</button><button class="btn xs ${e.shock?'pri':'ghost'}" data-ph="cshock" data-e="${e.id}" title="쇼크 켜기/끄기">⚡</button></div>`:''}</div>`}).join('')||'<div class="ph-empty">아직 이어진 사람이 없다'+(gm()?' — 「＋ 노드」로 사람을 만들고 「＋ 관계」로 이어 줘':'')+'</div>'}</div>
   ${gm()?`<div class="ph-foot"><button class="btn sm ${PH.confEdit?'pri':''}" data-ph="confedit" style="width:100%">${PH.confEdit?'✓ 편집 끝':'✎ 관계 편집하기'}</button><div class="small dim" style="margin-top:4px">${PH.confEdit?'＋ － ⚡ 로 바로 고치고, 항목을 누르면 관계 이름 · 쇼크 사유까지':'관계도(그래프 탭)와 같은 데이터'}</div></div>`:'<div class="ph-foot small dim">관계는 GM 이 올린다 · 항목을 누르면 자세히</div>'}`}
 /* 관계도 노드 만들기 (휴대폰에서): 이름 · 종류 · 그림(비우면 기본 초상) · 메모. 만든 뒤 바로 관계를 이을 수 있다 */
 function addNode(preset){const g=G();const nodes=g.nodes||{};preset=preset||{};
  const md=sheet(`관계도에 새 사람`,`
   <div class="fr"><span class="lbl" style="width:70px">이름</span><input type="text" id="nd_n" style="flex:1" value="${esc(preset.name||'')}" placeholder="예) 담임 선생님"></div>
   <div class="fr"><span class="lbl" style="width:70px">종류</span><select id="nd_k"><option value="npc" ${preset.kind==='npc'?'selected':''}>NPC</option><option value="pc" ${preset.kind==='pc'?'selected':''}>PC</option><option value="org" ${preset.kind==='org'?'selected':''}>조직</option></select></div>
   <div class="fr"><span class="lbl" style="width:70px">그림</span><input type="text" id="nd_i" style="flex:1" value="${esc(preset.img||'')}" placeholder="비우면 같은 이름의 트레이너·포켓몬 초상을 쓴다"></div>
   <div class="fr"><span class="lbl" style="width:70px">메모</span><textarea id="nd_t" rows="3" style="flex:1" placeholder="모두가 본다"></textarea></div>
   <div class="row" style="margin-top:10px"><label class="small"><input type="checkbox" id="nd_link" ${preset.kind==='pc'?'':'checked'}> 만든 뒤 바로 나와 관계 잇기</label><span class="sp"></span><button class="btn pri" id="nd_ok">만들기</button></div>`);
  $('#nd_ok',md).onclick=async()=>{const name=$('#nd_n',md).value.trim();if(!name)return A().toast('이름이 필요해');if(Object.values(nodes).some(x=>x.name===name))return A().toast('같은 이름의 사람이 이미 있다');
   const id='n'+Date.now().toString(36);const i=Object.keys(nodes).length;const link=$('#nd_link',md).checked;closeSheet();
   await A().set(['graph','nodes',id],{id,name,kind:$('#nd_k',md).value,img:$('#nd_i',md).value.trim(),note:$('#nd_t',md).value,x:120+(i%6)*140,y:120+Math.floor(i/6)*140,stands:[],standActive:0});
   A().toast(`${name} — 관계도에 들어갔다`);const me=nodeOfTrainer(owner());if(link&&me&&me.id!==id){const eid='e'+Math.random().toString(36).slice(2,8);await A().set(['graph','edges',eid],{id:eid,a:me.id,b:id,rank:1,label:'',shock:false})}go('conf')}}
 function editConf(eid){const g=G();const e=g.edges[eid];if(!e)return;const node=nodeOfTrainer(owner());const o=g.nodes[e.a===(node||{}).id?e.b:e.a]||{};const MAX=10;
  const md=sheet(`${esc(o.name)} <span class="small dim">관계 편집</span>`,`
   <div class="fr"><span class="lbl" style="width:70px">레벨</span><input type="number" class="n xs" id="ce_rank" min="0" max="${MAX}" value="${+e.rank||0}"><button class="btn xs" id="ce_up">강화 +1</button><button class="btn xs ghost" id="ce_dn">−1</button></div>
   <div class="fr"><span class="lbl" style="width:70px">관계 이름</span><input type="text" id="ce_label" value="${esc(e.label||'')}" placeholder="예) 교황 · 친구 · 보호자" style="flex:1"></div>
   <div class="fr"><span class="lbl" style="width:70px">쇼크</span><label class="small"><input type="checkbox" id="ce_shock" ${e.shock?'checked':''}> 관계가 흔들리고 있다 (⚡)</label><input type="text" id="ce_sn" value="${esc(e.shockNote||'')}" placeholder="사유 (예: 육상부 문제)" style="flex:1"></div>
   <div class="row" style="margin-top:10px"><button class="btn ghost danger" id="ce_del">관계 끊기</button><span class="sp"></span><button class="btn pri" id="ce_ok">저장</button></div>`);
  const r=$('#ce_rank',md);$('#ce_up',md).onclick=()=>{r.value=Math.min(MAX,(+r.value||0)+1)};$('#ce_dn',md).onclick=()=>{r.value=Math.max(0,(+r.value||0)-1)};
  $('#ce_ok',md).onclick=async()=>{const ne=Object.assign({},e,{rank:Math.max(0,Math.min(MAX,+r.value||0)),label:$('#ce_label',md).value.trim(),shock:$('#ce_shock',md).checked,shockNote:$('#ce_sn',md).value.trim()});closeSheet();await A().set(['graph','edges',eid],ne);if(ne.rank!==(+e.rank||0))A().sysLog(`【협력자】 ${o.name} 관계 ${+e.rank||0} → ${ne.rank}${ne.shock&&!e.shock?' · ⚡ 쇼크':!ne.shock&&e.shock?' · 쇼크 해소':''}`,'battle',{});go('conf')};
  $('#ce_del',md).onclick=async()=>{if(!confirm('관계를 끊을까?'))return;closeSheet();await A().set(['graph','edges',eid],null);go('conf')}}
 function addConf(){const g=G();const node=nodeOfTrainer(owner());if(!node)return;const others=Object.values(g.nodes).filter(n=>n.id!==node.id);
  const md=sheet(`새 관계`,`<div class="fr"><span class="lbl" style="width:70px">상대</span><select id="ca_o">${others.map(n=>`<option value="${n.id}">${esc(n.name)}</option>`).join('')}</select></div><div class="fr"><span class="lbl" style="width:70px">관계 이름</span><input type="text" id="ca_l" style="flex:1" placeholder="예) 친구"></div><div class="fr"><span class="lbl" style="width:70px">레벨</span><input type="number" class="n xs" id="ca_r" value="1"></div><div class="row" style="margin-top:10px"><span class="sp"></span><button class="btn pri" id="ca_ok">만들기</button></div>`);
  $('#ca_ok',md).onclick=async()=>{const id='e'+Math.random().toString(36).slice(2,8);closeSheet();await A().set(['graph','edges',id],{id,a:node.id,b:$('#ca_o',md).value,rank:+$('#ca_r',md).value||0,label:$('#ca_l',md).value.trim(),shock:false});go('conf')}}
 /* ----- 캘린더 ----- */
 function calendar(t){const c=cal();const tid=PH.tid;if(!t)return `<div class="ph-head yel"><button class="ph-back" data-ph="home">‹</button><div><b>캘린더</b><small>${esc(dateKo(today()))}</small></div></div><div class="ph-empty">아직 내 파티가 없다<br><span class="small">시트 탭에서 「내 파티 불러오기」를 하면 기록 · 회복을 쓸 수 있다</span></div>`;const pd=phoneData(tid);const day=today();const log=(pd.log||{})[day]||[];const node=nodeOfTrainer(t);const g=G();
  const partners=node?Object.values(g.edges||{}).filter(e=>e.a===node.id||e.b===node.id).map(e=>g.nodes[e.a===node.id?e.b:e.a]).filter(Boolean):[];
  const K=window.OM_SKILL_UI;const k=K?K.tsk(tid):{};const tired=(k.tired||[]).length;
  return `<div class="ph-head yel"><button class="ph-back" data-ph="home">‹</button><div><b>캘린더</b><small>${esc(dateKo(day))}${c.phase?' · '+esc(c.phase):''}${c.weather?' '+esc(c.weather):''}</small></div><button class="btn xs ghost" data-ph="calfull">전체 보기</button></div>
   <div class="ph-sec">시간 슬롯 <span class="sp"></span>${canWrite()?'<button class="btn xs" data-ph="calrec">＋ 기록</button>':''}</div>
   <div class="ph-slot">${canWrite()?`<select id="cs_slot">${SLOTS.map(s=>`<option ${s===(c.phase||'')?'selected':''}>${s}</option>`).join('')}</select><select id="cs_kind">${KINDS.map(([v,n])=>`<option value="${v}">${n}</option>`).join('')}</select><select id="cs_who" ${partners.length?'':'disabled'}><option value="">${partners.length?'누구와':'(관계 없음)'}</option>${partners.map(p=>`<option>${esc(p.name)}</option>`).join('')}</select><input type="text" id="cs_note" placeholder="단서, 약속, 일정…">`:''}
    <div class="ph-log">${log.map((x,i)=>`<div class="ph-logrow"><b>${esc(x.slot)}</b><span>${esc((KINDS.find(z=>z[0]===x.kind)||[])[1]||x.kind)}${x.who?' · '+esc(x.who):''}</span>${x.note?`<small>${esc(x.note)}</small>`:''}${canWrite()?`<button class="btn xs ghost" data-ph="caldel" data-i="${i}">✕</button>`:''}</div>`).join('')||'<div class="ph-empty small">오늘 기록이 없다</div>'}</div></div>
   <div class="ph-sec">가장 좋아하는 것으로 회복 <span class="sp"></span><span class="small dim">${k.inj>=3?'빈사':k.inj>=2?'중상':k.inj===1?'부상':'건강'}${tired?' · 지침 '+tired:''}</span></div>
   <div class="ph-rest">${RESTS.map(([kd,n,full])=>{const R=K?K.restCfg(kd):{};return `<button class="btn sm ${kd==='long'?'pri':''}" data-ph="rest" data-k="${kd}" ${canWrite()?'':'disabled'} title="${esc(full)} — HP ${esc(R.hp||'0')}${+R.revive?' · 부활':''}${+R.cure_ab?' · 상태 이상 치유':''}${+R.inj_n?' · 부상 '+R.inj_n+'단계':''}">${n}</button>`}).join('')}</div>
   <div class="small dim" style="padding:0 12px 6px">단계 내용은 GM 의 스킬 체크 「휴식」 탭에서 정한다 · 나와 내 포켓몬에게만</div>
   <div class="ph-sec">메모</div><div class="ph-memo"><textarea id="cs_memo" rows="4" placeholder="단서, 약속, 일정…" ${canWrite()?'':'readonly'}>${esc(pd.memo||'')}</textarea>${canWrite()?'<button class="btn xs" data-ph="memosave">저장</button>':''}</div>
   <div class="ph-foot"><button class="btn sm" data-ph="callog" style="width:100%">📅 일상 전체 보기 (학업 · 개인 시간 · 노가다)</button></div>`}
 /* 일상 전체 보기: 모든 날의 기록을 날짜별로, 종류별 합계와 함께 */
 function calLog(t){const pd=phoneData(PH.tid);const log=pd.log||{};const days=Object.keys(log).filter(d=>(log[d]||[]).length).sort().reverse();const tot={};let n=0;for(const d of days)for(const x of log[d]){tot[x.kind]=(tot[x.kind]||0)+1;n++}
  const kn=k=>(KINDS.find(z=>z[0]===k)||[])[1]||k;
  return `<div class="ph-head yel"><button class="ph-back" data-ph="cal">‹</button><div><b>일상 전체</b><small>${esc(t?t.name:'')} · ${days.length}일 · ${n}건</small></div></div>
   <div class="ph-tots">${KINDS.map(([k,nm,sh])=>`<span class="ph-tot ${tot[k]?'':'z'}"><b>${tot[k]||0}</b>${esc(sh||nm)}</span>`).join('')}</div>
   <div class="ph-list">${days.map(d=>`<div class="ph-dayblk"><div class="ph-dayh"><b>${esc(dateKo(d))}</b><small>${log[d].length}건</small></div>${log[d].map((x,i)=>`<div class="ph-logrow"><b>${esc(x.slot)}</b><span>${esc(kn(x.kind))}${x.who?' · '+esc(x.who):''}</span>${x.note?`<small>${esc(x.note)}</small>`:''}${canWrite()?`<button class="btn xs ghost" data-ph="caldel2" data-d="${esc(d)}" data-i="${i}">✕</button>`:''}</div>`).join('')}</div>`).join('')||'<div class="ph-empty">아직 기록이 없다 — 캘린더에서 「＋ 기록」</div>'}</div>`}
 /* ----- 메모장: pub[tid].phone.notes = [{id,title,body,at}] · 주인(또는 GM)만 쓴다 · 모두가 본다 ----- */
 function notes(t){const pd=phoneData(PH.tid);const L=(pd.notes||[]).slice().sort((a,b)=>(b.at||0)-(a.at||0));
  return `<div class="ph-head"><button class="ph-back" data-ph="home">‹</button><div><b>메모장</b><small>${esc(t?t.name:'')} · ${L.length}개</small></div>${canWrite()?'<button class="btn xs" data-ph="noteadd">＋ 새 메모</button>':''}</div>
   <div class="ph-list">${L.map(n=>{const d=new Date(n.at||0);const when=isNaN(d)||!n.at?'':`${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;return `<div class="ph-item ph-noteit" data-ph="note1" data-id="${esc(n.id)}"><div class="ph-it"><b>${esc(n.title||(String(n.body||'').split('\n')[0].slice(0,24))||'(제목 없음)')}</b><small>${when}${n.body?' · '+esc(String(n.body).replace(/\s+/g,' ').slice(0,40)):''}</small></div><span class="ph-arrow">›</span></div>`}).join('')||'<div class="ph-empty">아직 메모가 없다'+(canWrite()?' — 「＋ 새 메모」':'')+'</div>'}</div>`}
 function noteEdit(t){const pd=phoneData(PH.tid);const n=(pd.notes||[]).find(x=>x.id===PH.note)||{id:'',title:'',body:''};const ro=!canWrite();
  return `<div class="ph-head"><button class="ph-back" data-ph="notes">‹</button><div><b>${n.id?'메모':'새 메모'}</b><small>${esc(t?t.name:'')}</small></div>${!ro&&n.id?`<button class="btn xs ghost danger" data-ph="notedel" data-id="${esc(n.id)}">삭제</button>`:''}</div>
   <div class="ph-note"><input type="text" id="nt_t" placeholder="제목" value="${esc(n.title||'')}" ${ro?'readonly':''}><textarea id="nt_b" rows="12" placeholder="단서, 약속, 떠오른 것…" ${ro?'readonly':''}>${esc(n.body||'')}</textarea>${ro?'':'<div class="row"><span class="sp"></span><button class="btn pri sm" data-ph="notesave">저장</button></div>'}</div>`}
 function noteDirty(md){const ti=$('#nt_t',md),bo=$('#nt_b',md);if(!ti||!bo)return false;const n=((phoneData(PH.tid).notes||[]).find(x=>x.id===PH.note))||{title:'',body:''};return ti.value.trim()!==(n.title||'')||bo.value!==(n.body||'')}
 async function saveNote(md,quiet){const pd=phoneData(PH.tid);const L=(pd.notes||[]).slice();const title=$('#nt_t',md).value.trim();const body=$('#nt_b',md).value;if(!title&&!body.trim())return quiet?null:A().toast('내용이 비어 있다');
  const i=L.findIndex(x=>x.id===PH.note);const n={id:PH.note||('m'+Date.now().toString(36)),title,body,at:Date.now()};if(i>=0)L[i]=n;else L.push(n);await savePhone(PH.tid,{notes:L});PH.note=n.id;A().toast(quiet?'메모를 저장했다':'저장했다');if(quiet)return;PH.screen='notes';return re()}
 /* ----- 묶기 ----- */
 function bind(md){const t=owner();
  md.querySelectorAll('[data-ph]').forEach(b=>b.onclick=async(e)=>{if(e&&e.stopPropagation)e.stopPropagation();const k=b.dataset.ph;if(!k)return;
   if(['home','contacts','conf','cal','sms','notes','callog','set','deck','sns','party'].includes(k))return backTo(k,md);
   if(k==='ptab'){PH.ptab=b.dataset.v||'all';return re()}
   if(k==='snpost')return snsPost(md);
   if(k==='snimgx'){PH.snImg='';return re()}
   if(k==='snvis'){const ta=$('#snIn',md);if(ta)PH.snDraft=ta.value;PH.snFo=!PH.snFo;return re()}
   if(k==='snfr'){const me=myCid();const cur=new Set(snsFriends(me));const L=snsAccounts().filter(x=>x.cid!==me);
    const sh=sheet('친구 — 「🔒 친구만」 글을 보는 사람',`<div class="small dim" style="margin-bottom:8px">${esc(cidName(me))} 계정이 「🔒 친구만」 으로 올린 글은 여기서 고른 사람과 GM 만 본다.</div><input type="search" class="sn-frq" placeholder="이름으로 찾기"><div class="sn-frl">${L.map(x=>`<label class="sn-fri" data-q="${esc(String(x.name).toLowerCase())}"><input type="checkbox" value="${esc(x.cid)}" ${cur.has(x.cid)?'checked':''}>${av(x.name,x.cid.startsWith('n:')?(G().nodes[x.cid.slice(2)]||{}).img:(trs()[x.cid]||{}).image,'xs')}<b>${esc(x.name)}</b><small>${esc(x.kind)}</small></label>`).join('')||'<div class="ph-empty sm">고를 사람이 없다</div>'}</div><div class="row" style="margin-top:10px"><span class="sp"></span><button class="btn sm pri" data-frsave>저장</button></div>`);
    const q=sh.querySelector('.sn-frq');q.oninput=()=>{const v=q.value.trim().toLowerCase();sh.querySelectorAll('.sn-fri').forEach(l=>l.style.display=!v||l.dataset.q.includes(v)?'':'none')};
    sh.querySelector('[data-frsave]').onclick=async()=>{const pick=[...sh.querySelectorAll('.sn-fri input:checked')].map(i=>i.value);await savePhone(me,{snsFriends:pick});closeSheet();A().toast(`친구 ${pick.length}명`);re()};return}
   if(k==='snlike'){if(!snsCan())return;try{await snsAdd({like:+b.dataset.id})}catch(er){A().toast('누르지 못했다: '+er.message)}return re()}
   if(k==='sncm'){const id=+b.dataset.id;PH.snOpen=PH.snOpen===id&&!b.classList.contains('sn-more')?0:id;re();const ci=$('#snCm',md);if(ci)ci.focus();return}
   if(k==='sncmsend'){const ci=$('#snCm',md);const v=ci?ci.value.trim():'';if(!v)return;try{await snsAdd({t:v,re:+b.dataset.id})}catch(er){return A().toast('보내지 못했다: '+er.message)}return re()}
   if(k==='sndel'){if(!confirm('이 글을 지울까? (로그에는 지운 표시가 남는다)'))return;try{await snsAdd({del:+b.dataset.id})}catch(er){A().toast('지우지 못했다: '+er.message)}return re()}
   if(k==='caldel2'){const pd=phoneData(PH.tid);const log=Object.assign({},pd.log||{});log[b.dataset.d]=(log[b.dataset.d]||[]).filter((x,i)=>i!==+b.dataset.i);if(!log[b.dataset.d].length)delete log[b.dataset.d];await savePhone(PH.tid,{log});return re()}
   if(k==='noteadd'){PH.note='';PH.screen='note1';return re()}
   if(k==='note1'){PH.note=b.dataset.id;PH.screen='note1';return re()}
   if(k==='notesave')return saveNote(md);
   if(k==='notedel'){if(!confirm('이 메모를 지울까?'))return;const pd=phoneData(PH.tid);await savePhone(PH.tid,{notes:(pd.notes||[]).filter(x=>x.id!==b.dataset.id)});PH.screen='notes';return re()}
   if(k==='ctadd')return addContact();
   if(k==='ctgive')return giveCard();
   if(k==='cardsend')return giveCard(PH.room);
   if(k==='ctname')return renameContact(b.dataset.cid);
   if(k==='cardsave'){const c=b.dataset.cid;if(inBook(c))return A().toast('이미 내 연락처에 있다');await saveBook([...bookOf(PH.tid),{cid:c,n:'',at:Date.now()}]);A().toast(`「${cidName(c)}」을(를) 연락처에 넣었다`);return re()}
   if(k==='cardx'){const pd=phoneData(PH.tid);await savePhone(PH.tid,{cardx:[...(pd.cardx||[]),+b.dataset.id].slice(-100)});return re()}
   if(k==='invjoin'){const code=b.dataset.code;await savePhone(PH.tid,{room:code});A().toast(`파티 「${code}」에 들어갔다`);return re()}
   if(k==='pinv'||k==='ginv'||k==='gleave'){const r=roomOf(PH.room);if(!r||r.kind!=='group')return;const S=spk();const ST=A().ST;const add=d=>window.OM_STORE.addLog(ST.room,ST.secret,'chat',S.name||ST.name||'',Object.assign({t:'',sms:r.id,as:S.name,k:S.key,cid:S.cid},d));
    if(k==='gleave'){if(!confirm(`「${r.name}」 단톡방에서 나갈까?`))return;await add({room:{name:r.name,members:(r.members||[]).filter(x=>x!==S.cid)}});PH.screen='sms';return re()}
    if(k==='ginv'){const L=[...new Map([...bookOf(PH.tid).map(e=>({cid:e.cid,name:e.n||cidName(e.cid),img:cidImg(e.cid),sub:cidSub(e.cid)})),...(gm()?people():[])].map(x=>[x.cid,x])).values()].filter(x=>!(r.members||[]).includes(x.cid));
     return pickSheet(`「${esc(r.name)}」에 초대`,'내 연락처에서 고른다.',L,'초대',`<label class="small" style="display:block;margin-top:8px"><input type="checkbox" data-opt="card" checked> 들어온 사람에게 내 연락처 카드도 보내기</label>`,async(cids,opt)=>{await add({room:{name:r.name,members:[...new Set([...(r.members||[]),...cids])]}});if(opt.card)await sendCard(r.id);A().toast(`${cids.length}명을 초대했다`);re()})}
    let code=roomOf2(PH.tid);if(!code)code=(String(r.name).replace(/[^\w가-힣]+/g,'-').replace(/^-|-$/g,'').slice(0,14)||'party')+'-'+Math.random().toString(36).slice(2,5);
    if(!confirm(`이 단톡방 사람들에게 파티 「${code}」 초대를 보낼까?${roomOf2(PH.tid)?'':'\n(나도 이 코드로 들어간다)'}`))return;
    if(!roomOf2(PH.tid))await savePhone(PH.tid,{room:code});await add({inv:{code}});
    if(gm()){const ts=(r.members||[]).filter(x=>trs()[x]&&roomOf2(x)!==code);if(ts.length&&confirm(`GM: 방 안의 트레이너 ${ts.length}명을 지금 바로 파티에 넣을까?`))for(const x of ts)await savePhone(x,{room:code})}
    return re()}
   if(k==='roomgo'){const code=$('#ph_room',md).value.trim();await savePhone(PH.tid,{room:code,share:$('#ph_share',md)?$('#ph_share',md).checked:true});A().toast(code?`파티 「${code}」 에 들어갔다`:'파티 코드를 비웠다');return re()}
   if(k==='roomout'){await savePhone(PH.tid,{room:''});return re()}
   if(k==='ctdel'){const c=b.dataset.cid;if(!confirm(`「${nm(c)}」을(를) 연락처에서 지울까? (주고받은 문자는 남는다)`))return;await saveBook(bookOf(PH.tid).filter(x=>x.cid!==c));return re()}
   if(k==='ct1'){const n=G().nodes[b.dataset.id];if(!n)return;if(gm()&&window.OM_GRAPH_UI&&window.OM_GRAPH_UI.editNode)return window.OM_GRAPH_UI.editNode(n.id);return}
   if(k==='nodeadd')return addNode();
   if(k==='mynode'){const t0=owner();if(!t0)return;return addNode({name:t0.name,kind:'pc',img:''})}
   if(k==='smsopen'){PH.room=b.dataset.room;PH.screen='smsroom';return re()}
   if(k==='smssend')return smsSend(md);
   if(k==='smsnew')return newSms();
   if(k==='dm'){if(!A().ST.role)return A().toast('자리에 앉아야 문자를 보낼 수 있다');return openDm(b.dataset.cid)}
   if(k==='smsdel'){if(!confirm('이 방을 지울까? (메시지는 로그에 남는다)'))return;const rs=(((A().ST.state.rp||{}).sms||{}).rooms||[]).filter(x=>x.id!==b.dataset.room);await A().set(['rp','sms','rooms'],rs);return re()}
   if(k==='sheet'){A().closeModal();if(window.OM_SHEET_UI)window.OM_SHEET_UI.UI.tid=b.dataset.tid;A().view='sheet';return A().renderScene()}
   if(k==='conf1'){if(gm())return editConf(b.dataset.e);const g=G();const e=g.edges[b.dataset.e];return A().toast(e?`${e.label||'관계'} · 레벨 ${+e.rank||0}${e.shock?' · ⚡ 쇼크'+(e.shockNote?' ('+e.shockNote+')':''):''}`:'')}
   if(k==='confedit'){PH.confEdit=!PH.confEdit;return re()}
   if(k==='cup'||k==='cdn'||k==='cshock'){const g=G();const e=g.edges[b.dataset.e];if(!e)return;const MAX=10;const ne=Object.assign({},e);if(k==='cup')ne.rank=Math.min(MAX,(+e.rank||0)+1);if(k==='cdn')ne.rank=Math.max(0,(+e.rank||0)-1);if(k==='cshock')ne.shock=!e.shock;await A().set(['graph','edges',e.id],ne);const o=g.nodes[e.a===(nodeOfTrainer(owner())||{}).id?e.b:e.a]||{};if(ne.rank!==(+e.rank||0))A().sysLog(`【협력자】 ${o.name} 관계 ${+e.rank||0} → ${ne.rank}`,'battle',{});if(ne.shock!==!!e.shock)A().sysLog(`【협력자】 ${o.name} ${ne.shock?'⚡ 쇼크':'쇼크 해소'}`,'battle',{});return re()}
   if(k==='confadd')return addConf();
   if(k==='calfull'){A().closeModal();A().view='calendar';return A().renderScene()}
   if(k==='calrec'){const tid=PH.tid;const pd=phoneData(tid);const day=today();const rec={slot:$('#cs_slot',md).value,kind:$('#cs_kind',md).value,who:$('#cs_who',md).value||'',note:$('#cs_note',md).value.trim(),at:Date.now()};const log=Object.assign({},pd.log||{});log[day]=[...(log[day]||[]),rec];await savePhone(tid,{log});A().sysLog(`【캘린더】 ${t?t.name:''} · ${day} ${rec.slot} — ${(KINDS.find(z=>z[0]===rec.kind)||[])[1]||rec.kind}${rec.who?' · '+rec.who:''}${rec.note?'\n'+rec.note:''}`,'battle',{});return re()}
   if(k==='caldel'){const tid=PH.tid;const pd=phoneData(tid);const day=today();const log=Object.assign({},pd.log||{});log[day]=(log[day]||[]).filter((x,i)=>i!==+b.dataset.i);await savePhone(tid,{log});return re()}
   if(k==='memosave'){await savePhone(PH.tid,{memo:$('#cs_memo',md).value});return A().toast('저장했다')}
   if(k==='rest'){const K=window.OM_SKILL_UI;if(!K)return;const kd=b.dataset.k;const nm=RESTS.find(x=>x[0]===kd);if(!confirm(`「${nm[1]} (${nm[2]})」 회복을 할까? — ${t?t.name:''} 와 소지 포켓몬`))return;A().closeModal();await K.applyRest(kd,[PH.tid],{by:(t?t.name:'')+' · 휴대폰'});return open('cal')}});
  const own=$('#phOwner',md);if(own)own.onchange=()=>{PH.tid=own.value;re();const st=md.querySelector('.ph-status span');if(st){const o=owner();st.textContent=o?o.name:'—'}};
  const sh=$('#ph_share',md);if(sh)sh.onchange=async()=>{await savePhone(PH.tid,{share:sh.checked});A().toast(sh.checked?'방에 공유한다':'비공개로 바꿨다')};
  const rin=$('#ph_room',md);if(rin)rin.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){const b=md.querySelector('[data-ph=roomgo]');if(b)b.click()}};
  const si=$('#smsIn',md);if(si){si.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing)smsSend(md)};si.oninput=()=>{PH.draft[PH.room]=si.value};
   si.onpaste=e=>{const f=[...((e.clipboardData||{}).files||[])].find(x=>/^image\//.test(x.type));if(f){e.preventDefault();smsImg(f)}};
   if(!(window.matchMedia&&matchMedia('(hover:none)').matches))si.focus()}
  const sn=$('#snIn',md);if(sn){sn.oninput=()=>{PH.snDraft=sn.value};sn.onpaste=e=>{const f=[...((e.clipboardData||{}).files||[])].find(x=>/^image\//.test(x.type));if(f){e.preventDefault();snsImg(f)}};sn.onkeydown=e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();snsPost(md)}}}
  const snf=$('#snFile',md);if(snf)snf.onchange=()=>{const f=snf.files[0];snf.value='';snsImg(f)};
  const scm=$('#snCm',md);if(scm)scm.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){const bb=md.querySelector('[data-ph=sncmsend]');if(bb)bb.click()}};
  const sf=$('#smsFile',md);if(sf)sf.onchange=()=>{const f=sf.files[0];sf.value='';smsImg(f)};
  const lg=$('.ph-sms',md);if(lg&&A().ST.role){lg.ondragover=e=>{if([...e.dataTransfer.types].includes('Files')){e.preventDefault();lg.classList.add('over')}};lg.ondragleave=()=>lg.classList.remove('over');lg.ondrop=e=>{e.preventDefault();lg.classList.remove('over');const f=[...(e.dataTransfer.files||[])].find(x=>/^image\//.test(x.type));if(f)smsImg(f)}}
  const mm=$('#cs_memo',md);if(mm&&canWrite())mm.onblur=async()=>{if(mm.value!==(phoneData(PH.tid).memo||''))await savePhone(PH.tid,{memo:mm.value})};
  const cq=$('#ph_cq',md);if(cq){const f=()=>{const q=cq.value.trim().toLowerCase();PH.cq=cq.value;md.querySelectorAll('#phScreen .ph-list .ph-item').forEach(it=>{it.style.display=!q||it.textContent.toLowerCase().includes(q)?'':'none'})};cq.oninput=f;if(cq.value)f()}}
 /* 상태가 바뀌면 열린 화면 중 남이 바꾸는 것(덱)만 다시 그린다 — 입력 중이면 건드리지 않는다 */
 let rfT=0;function refresh(){if(PH.screen!=='deck'&&PH.screen!=='party')return;clearTimeout(rfT);rfT=setTimeout(()=>{const md=$('.modal.phone-modal');if(!md)return;const a=document.activeElement;if(a&&md.contains(a)&&a.matches('input,textarea,select'))return;draw(md)},60)}
 return {open,onSms,unreadAll,popSms,refresh};
})();
