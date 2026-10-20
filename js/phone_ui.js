/* ---------- 휴대폰 (RP 보조 도구): 연락처(파티원 시트) · 협력자(관계도의 관계 랭크·쇼크) · 캘린더(오늘 · 시간대 기록 · 회복 · 메모)
   인터넷 · LINE · YouTube · 문자는 아직 비워 둔다.
   상태: 협력자 = state.graph.edges (a,b,rank,label,shock) · 캘린더 = state.calendar (today, phase, weather) · 내 기록 = state.pub[tid].phone = {log:{'YYYY-MM-DD':[{slot,kind,who,note,at}]}, memo}
   회복은 OM_SKILL_UI.applyRest(kind,[tid]) — 단계 내용은 GM 의 스킬 체크 「휴식」 탭에서 정한다. */
"use strict";
window.OM_PHONE_UI=(()=>{
 const A=()=>window.OM_APP;
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const $=(s,r)=>(r||document).querySelector(s);
 const WD=['일','월','화','수','목','금','토'];
 const SLOTS=['아침','점심','오후','방과 후','저녁','밤','심야'];
 const KINDS=[['commu','의미 있는 시간 (관계)'],['study','학업 · 수련'],['free','개인 시간'],['out','나가다 · 조사'],['memo','메모']];
 const RESTS=[['breath','가벼움','숨돌리기'],['short','상담함','짧은 휴식'],['long','대대적','긴 휴식']];
 const gm=()=>A().ST.role==='gm';
 const trs=()=>(A().ST.state.roster||{}).trainers||{};
 const mons=()=>(A().ST.state.roster||{}).mons||{};
 const G=()=>A().ST.state.graph||{nodes:{},edges:{}};
 const cal=()=>A().ST.state.calendar||{};
 const PH={screen:'home',tid:'',tab:''};
 /* 이 휴대폰의 주인: 좌석이면 내 트레이너, GM 이면 고른 트레이너 */
 function owner(){const T=trs();if(gm()){if(!PH.tid||!T[PH.tid])PH.tid=Object.keys(T)[0]||'';return T[PH.tid]||null}PH.tid=A().ST.seat;return T[PH.tid]||null}
 const canWrite=()=>gm()||(A().ST.seat&&A().ST.seat===PH.tid);
 const phoneData=tid=>(((A().ST.state.pub||{})[tid]||{}).phone)||{log:{},memo:''};
 async function savePhone(tid,patch){const cur=Object.assign({log:{},memo:''},phoneData(tid));Object.assign(cur,patch);await A().set(['pub',tid,'phone'],cur)}
 const today=()=>cal().today||new Date().toISOString().slice(0,10);
 const dateKo=d=>{const x=new Date(d+'T00:00:00');return isNaN(x)?d:`${x.getMonth()+1}월 ${x.getDate()}일 ${WD[x.getDay()]}요일`};
 /* 트레이너 ↔ 관계도 노드: 이름이 같은 pc 노드 */
 function nodeOfTrainer(t){if(!t)return null;const ns=Object.values(G().nodes||{});return ns.find(n=>n.kind==='pc'&&n.name===t.name)||ns.find(n=>n.name===t.name)||null}

 function open(screen){if(screen)PH.screen=screen;const t=owner();
  const md=A().openModal(`<div class="phone-shell"><div class="phone-dev"><div class="ph-status"><span>${esc(t?t.name:'—')}</span><span class="sp"></span><span>${esc(today().slice(5).replace('-','/'))}</span><span class="ph-bat">▮▮▮</span></div><div class="ph-screen" id="phScreen"></div><div class="ph-home"><button class="ph-hb" data-ph="home" title="홈"></button></div></div><button class="btn ghost ph-close" data-x>닫기</button></div>`);
  md.classList.add('phone-modal');draw(md)}
 function draw(md){md=md||$('.modal');const el=$('#phScreen',md);if(!el)return;const t=owner();
  el.innerHTML=PH.screen==='contacts'?contacts(t):PH.screen==='conf'?confidants(t):PH.screen==='cal'?calendar(t):PH.screen==='sms'?smsRooms(t):PH.screen==='smsroom'?smsRoom(t):home(t);
  bind(md);if(PH.screen==='smsroom'){const lg=$('.ph-sms',md);if(lg)lg.scrollTop=lg.scrollHeight;markSeen(PH.room)}}
 const re=()=>draw();
 /* ----- 홈 ----- */
 function home(t){const T=trs();const un=unreadAll();const apps=[['contacts','📞','연락처',1],['sms','💬','문자',1,un],['conf','🤝','협력자',1],['cal','📅','캘린더',1],['web','🌐','인터넷',0],['tube','▶','영상',0]];
  return `<div class="ph-wall"><div class="ph-clock"><b>${esc(dateKo(today()))}</b><small>${esc(cal().phase||'')}${cal().weather?' '+esc(cal().weather):''}</small></div>
   ${gm()?`<div class="ph-owner"><span class="small dim">누구의 휴대폰</span><select id="phOwner">${Object.values(T).map(x=>`<option value="${x.id}" ${x.id===PH.tid?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div>`:''}
   <div class="ph-apps">${apps.map(([k,ic,n,on,bd])=>`<button class="ph-app ${on?'':'off'}" data-ph="${on?k:''}" ${on?'':'title="아직 준비 중"'}><i>${ic}${bd?`<em class="ph-badge">${bd}</em>`:''}</i><span>${n}</span></button>`).join('')}</div></div>`}
 /* ----- 문자: 캐릭터끼리의 톡 (로그 kind chat + data.sms=방). 방은 rp.sms.rooms (GM) + 기본 「파티」 ----- */
 const SEEN_KEY='om_sms_seen';
 function rooms(){const r=((A().ST.state.rp||{}).sms||{}).rooms||[];return [{id:'party',name:'파티',members:[]},...r.filter(x=>x&&x.id)]}
 function smsLogs(room){return (A().ST.log||[]).filter(r=>r.kind==='chat'&&r.data&&r.data.sms&&(!room||r.data.sms===room))}
 function seen(){try{return JSON.parse(localStorage.getItem(SEEN_KEY)||'{}')}catch(e){return {}}}
 function markSeen(room){const l=smsLogs(room);if(!l.length)return;const s=seen();s[room]=l[l.length-1].id;try{localStorage.setItem(SEEN_KEY,JSON.stringify(s))}catch(e){}}
 function unread(room){const s=seen();const last=+s[room]||0;return smsLogs(room).filter(r=>r.id>last).length}
 function unreadAll(){return rooms().reduce((a,r)=>a+unread(r.id),0)}
 function spk(){const R=window.OM_RP_UI;if(R&&R.curSpeaker)return R.curSpeaker();const ST=A().ST;return gm()?{key:'gm',name:'GM',img:''}:{key:'me',name:ST.name||'',img:''}}
 function smsRooms(t){const rs=rooms();return `<div class="ph-head green"><button class="ph-back" data-ph="home">‹</button><div><b>문자</b><small>캐릭터끼리의 톡 · 로그에는 안 보인다</small></div>${gm()?'<button class="btn xs" data-ph="smsnew">＋ 방</button>':''}</div>
   <div class="ph-list">${rs.map(r=>{const L=smsLogs(r.id);const last=L[L.length-1];const u=unread(r.id);return `<div class="ph-item" data-ph="smsopen" data-room="${esc(r.id)}"><i class="ph-av ph-room">${r.id==='party'?'👥':'💬'}</i><div class="ph-it"><b>${esc(r.name)}${u?` <em class="ph-badge inline">${u}</em>`:''}</b><small>${last?esc((last.data.as||last.who)+': '+String(last.data.t||'').slice(0,40)):'아직 대화가 없다'}</small></div>${gm()&&r.id!=='party'?`<button class="btn xs ghost" data-ph="smsdel" data-room="${esc(r.id)}">✕</button>`:''}</div>`}).join('')}</div>`}
 function smsRoom(t){const r=rooms().find(x=>x.id===PH.room)||rooms()[0];PH.room=r.id;const L=smsLogs(r.id);const meKey=spk().key;const R=window.OM_RP_UI;let lastDay='';
  const rows=L.map(x=>{const d=x.data;const at=new Date(x.at);const day=isNaN(at)?'':`${at.getMonth()+1}/${at.getDate()}`;const hm=isNaN(at)?'':`${String(at.getHours()).padStart(2,'0')}:${String(at.getMinutes()).padStart(2,'0')}`;let head='';if(day&&day!==lastDay){lastDay=day;head=`<div class="ph-day">${day}</div>`}
   const mine=d.k===meKey;const img=d.k&&R&&R.imgOfKey?R.imgOfKey(d.k):'';const name=d.as||x.who;
   const txt=esc(d.t||'').replace(/@([^\s@]+)/g,'<span class="ph-at">@$1</span>');
   return head+`<div class="ph-msg ${mine?'me':''}">${mine?'':`<i class="ph-av sm" style="${img?`background-image:url('${esc(img)}')`:''}"></i>`}<div class="ph-mb"><small class="ph-mn">${esc(name)}</small><div class="ph-bub">${txt}</div><small class="ph-mt">${hm}</small></div></div>`}).join('');
  const S=spk();
  return `<div class="ph-head green"><button class="ph-back" data-ph="sms">‹</button><div><b>${esc(r.name)}</b><small>${L.length}개의 메시지</small></div></div>
   <div class="ph-sms">${rows||'<div class="ph-empty">첫 메시지를 보내 봐</div>'}</div>
   ${A().ST.role?`<div class="ph-smsin"><i class="ph-av sm" title="${esc(S.name)}" style="${S.img?`background-image:url('${esc(S.img)}')`:''}"></i><input type="text" id="smsIn" placeholder="${esc(S.name)} 으로 보내기 · @이름"><button class="btn pri sm" data-ph="smssend">➤</button></div>`:''}`}
 async function smsSend(md){const inp=$('#smsIn',md);if(!inp)return;const t=inp.value.trim();if(!t)return;inp.value='';const S=spk();const ST=A().ST;
  try{await window.OM_STORE.addLog(ST.room,ST.secret,'chat',S.name||ST.name||'',{t,sms:PH.room,as:S.name,k:S.key})}catch(e){A().toast('보내지 못했다: '+e.message)}}
 /* 새 문자가 오면 (내 것이 아니면) 알림을 띄우고, 열려 있으면 다시 그린다 */
 function onSms(row){const d=row.data||{};const md=$('.modal.phone-modal');const openHere=md&&PH.screen==='smsroom'&&PH.room===d.sms;
  if(openHere){draw(md);return}
  const mine=d.k===spk().key;if(!mine)A().toast(`💬 ${d.as||row.who}: ${String(d.t||'').slice(0,60)}`);
  try{if(!mine&&window.OM_RP_UI)window.OM_RP_UI.playSe('Ping')}catch(e){}
  if(md&&PH.screen==='sms')draw(md);A().renderScene()}
 function newRoom(){const name=prompt('방 이름');if(name==null||!name.trim())return;const rs=(((A().ST.state.rp||{}).sms||{}).rooms||[]).slice();rs.push({id:'r'+Date.now().toString(36),name:name.trim()});return A().set(['rp','sms','rooms'],rs).then(()=>{PH.screen='sms';draw()})}
 /* ----- 연락처: 파티원 (로스터 트레이너) ----- */
 function contacts(t){const T=trs();const seats=A().ST.state.seats||{};
  return `<div class="ph-head"><button class="ph-back" data-ph="home">‹</button><div><b>연락처</b><small>같은 방 파티원 · 누르면 시트를 본다</small></div></div>
   <div class="ph-list">${Object.values(T).map(x=>{const o=seats[x.id];const n=Object.values(mons()).filter(m=>m.tid===x.id).length;return `<div class="ph-item" data-ph="sheet" data-tid="${x.id}"><i class="ph-av" style="${x.image?`background-image:url('${esc(x.image)}')`:''}"></i><div class="ph-it"><b>${esc(x.name)}${x.id===PH.tid?' <span class="ph-tag">나</span>':''}</b><small>${o?'🟢 '+esc(o.name):'빈 자리'} · 포켓몬 ${n}</small></div><span class="ph-arrow">›</span></div>`}).join('')||'<div class="ph-empty">파티원이 없다</div>'}</div>`}
 /* ----- 협력자: 관계도의 선 ----- */
 function confidants(t){const g=G();const node=nodeOfTrainer(t);if(!node)return `<div class="ph-head"><button class="ph-back" data-ph="home">‹</button><div><b>협력자</b><small>${esc(t?t.name:'')}</small></div></div><div class="ph-empty">관계도에 「${esc(t?t.name:'')}」 노드가 없다${gm()?' — 관계도 탭에서 같은 이름의 PC 노드를 만들어 줘':''}</div>`;
  const edges=Object.values(g.edges||{}).filter(e=>e.a===node.id||e.b===node.id).map(e=>Object.assign({},e,{o:g.nodes[e.a===node.id?e.b:e.a]})).filter(e=>e.o).sort((x,y)=>(+y.rank||0)-(+x.rank||0));
  const MAX=10;
  return `<div class="ph-head red"><button class="ph-back" data-ph="home">‹</button><div><b>협력자</b><small>${esc(node.name)} · ${edges.length}명과의 유대</small></div>${gm()?`<button class="btn xs" data-ph="confadd">＋ 관계</button>`:''}</div>
   <div class="ph-list">${edges.map(e=>{const r=Math.max(0,Math.min(MAX,+e.rank||0));return `<div class="ph-item conf ${e.shock?'shock':''}" data-ph="conf1" data-e="${e.id}"><i class="ph-av" style="${e.o.img?`background-image:url('${esc(e.o.img)}')`:''}"></i><div class="ph-it"><b>${esc(e.o.name)}</b><small>${esc(e.label||e.o.kind||'')}${e.shock?' · <span class="ph-shock">⚡ 쇼크</span>':''}</small><div class="ph-rank">${Array.from({length:MAX},(_,i)=>`<i class="${i<r?'on':''}"></i>`).join('')}<em>${r}</em></div>${e.o.note?`<small class="ph-note">${esc(e.o.note)}</small>`:''}</div></div>`}).join('')||'<div class="ph-empty">아직 이어진 사람이 없다</div>'}</div>
   ${gm()?'<div class="ph-foot small dim">GM: 항목을 누르면 레벨 · 강화 · 쇼크 · 관계 이름을 고친다</div>':'<div class="ph-foot small dim">관계는 GM 이 올린다</div>'}`}
 function editConf(eid){const g=G();const e=g.edges[eid];if(!e)return;const node=nodeOfTrainer(owner());const o=g.nodes[e.a===(node||{}).id?e.b:e.a]||{};const MAX=10;
  const md=A().openModal(`<div class="mhead"><h2>${esc(o.name)} <span class="small dim">관계 편집</span></h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="fr"><span class="lbl" style="width:70px">레벨</span><input type="number" class="n xs" id="ce_rank" min="0" max="${MAX}" value="${+e.rank||0}"><button class="btn xs" id="ce_up">강화 +1</button><button class="btn xs ghost" id="ce_dn">−1</button></div>
   <div class="fr"><span class="lbl" style="width:70px">관계 이름</span><input type="text" id="ce_label" value="${esc(e.label||'')}" placeholder="예) 교황 · 친구 · 보호자" style="flex:1"></div>
   <div class="fr"><span class="lbl" style="width:70px">쇼크</span><label class="small"><input type="checkbox" id="ce_shock" ${e.shock?'checked':''}> 관계가 흔들리고 있다 (⚡)</label></div>
   <div class="row" style="margin-top:10px"><button class="btn ghost danger" id="ce_del">관계 끊기</button><span class="sp"></span><button class="btn pri" id="ce_ok">저장</button></div>`);
  const r=$('#ce_rank',md);$('#ce_up',md).onclick=()=>{r.value=Math.min(MAX,(+r.value||0)+1)};$('#ce_dn',md).onclick=()=>{r.value=Math.max(0,(+r.value||0)-1)};
  $('#ce_ok',md).onclick=async()=>{const ne=Object.assign({},e,{rank:Math.max(0,Math.min(MAX,+r.value||0)),label:$('#ce_label',md).value.trim(),shock:$('#ce_shock',md).checked});A().closeModal();await A().set(['graph','edges',eid],ne);if(ne.rank!==(+e.rank||0))A().sysLog(`【협력자】 ${o.name} 관계 ${+e.rank||0} → ${ne.rank}${ne.shock&&!e.shock?' · ⚡ 쇼크':!ne.shock&&e.shock?' · 쇼크 해소':''}`,'battle',{});open('conf')};
  $('#ce_del',md).onclick=async()=>{if(!confirm('관계를 끊을까?'))return;A().closeModal();await A().set(['graph','edges',eid],null);open('conf')}}
 function addConf(){const g=G();const node=nodeOfTrainer(owner());if(!node)return;const others=Object.values(g.nodes).filter(n=>n.id!==node.id);
  const md=A().openModal(`<div class="mhead"><h2>새 관계</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="fr"><span class="lbl" style="width:70px">상대</span><select id="ca_o">${others.map(n=>`<option value="${n.id}">${esc(n.name)}</option>`).join('')}</select></div><div class="fr"><span class="lbl" style="width:70px">관계 이름</span><input type="text" id="ca_l" style="flex:1" placeholder="예) 친구"></div><div class="fr"><span class="lbl" style="width:70px">레벨</span><input type="number" class="n xs" id="ca_r" value="1"></div><div class="row" style="margin-top:10px"><span class="sp"></span><button class="btn pri" id="ca_ok">만들기</button></div>`);
  $('#ca_ok',md).onclick=async()=>{const id='e'+Math.random().toString(36).slice(2,8);A().closeModal();await A().set(['graph','edges',id],{id,a:node.id,b:$('#ca_o',md).value,rank:+$('#ca_r',md).value||0,label:$('#ca_l',md).value.trim(),shock:false});open('conf')}}
 /* ----- 캘린더 ----- */
 function calendar(t){const c=cal();const tid=PH.tid;const pd=phoneData(tid);const day=today();const log=(pd.log||{})[day]||[];const node=nodeOfTrainer(t);const g=G();
  const partners=node?Object.values(g.edges||{}).filter(e=>e.a===node.id||e.b===node.id).map(e=>g.nodes[e.a===node.id?e.b:e.a]).filter(Boolean):[];
  const K=window.OM_SKILL_UI;const k=K?K.tsk(tid):{};const tired=(k.tired||[]).length;
  return `<div class="ph-head yel"><button class="ph-back" data-ph="home">‹</button><div><b>캘린더</b><small>${esc(dateKo(day))}${c.phase?' · '+esc(c.phase):''}${c.weather?' '+esc(c.weather):''}</small></div><button class="btn xs ghost" data-ph="calfull">전체 보기</button></div>
   <div class="ph-sec">시간 슬롯 <span class="sp"></span>${canWrite()?'<button class="btn xs" data-ph="calrec">＋ 기록</button>':''}</div>
   <div class="ph-slot">${canWrite()?`<select id="cs_slot">${SLOTS.map(s=>`<option ${s===(c.phase||'')?'selected':''}>${s}</option>`).join('')}</select><select id="cs_kind">${KINDS.map(([v,n])=>`<option value="${v}">${n}</option>`).join('')}</select><select id="cs_who" ${partners.length?'':'disabled'}><option value="">${partners.length?'누구와':'(관계 없음)'}</option>${partners.map(p=>`<option>${esc(p.name)}</option>`).join('')}</select><input type="text" id="cs_note" placeholder="단서, 약속, 일정…">`:''}
    <div class="ph-log">${log.map((x,i)=>`<div class="ph-logrow"><b>${esc(x.slot)}</b><span>${esc((KINDS.find(z=>z[0]===x.kind)||[])[1]||x.kind)}${x.who?' · '+esc(x.who):''}</span>${x.note?`<small>${esc(x.note)}</small>`:''}${canWrite()?`<button class="btn xs ghost" data-ph="caldel" data-i="${i}">✕</button>`:''}</div>`).join('')||'<div class="ph-empty small">오늘 기록이 없다</div>'}</div></div>
   <div class="ph-sec">가장 좋아하는 것으로 회복 <span class="sp"></span><span class="small dim">${k.inj>=2?'중상':k.inj===1?'부상':'건강'}${tired?' · 지침 '+tired:''}</span></div>
   <div class="ph-rest">${RESTS.map(([kd,n,full])=>{const R=K?K.restCfg(kd):{};return `<button class="btn sm ${kd==='long'?'pri':''}" data-ph="rest" data-k="${kd}" ${canWrite()?'':'disabled'} title="${esc(full)} — HP ${esc(R.hp||'0')}${+R.revive?' · 부활':''}${+R.cure_ab?' · 상태 이상 치유':''}${+R.inj_n?' · 부상 '+R.inj_n+'단계':''}">${n}</button>`}).join('')}</div>
   <div class="small dim" style="padding:0 12px 6px">단계 내용은 GM 의 스킬 체크 「휴식」 탭에서 정한다 · 나와 내 포켓몬에게만</div>
   <div class="ph-sec">메모</div><div class="ph-memo"><textarea id="cs_memo" rows="4" placeholder="단서, 약속, 일정…" ${canWrite()?'':'readonly'}>${esc(pd.memo||'')}</textarea>${canWrite()?'<button class="btn xs" data-ph="memosave">저장</button>':''}</div>`}
 /* ----- 묶기 ----- */
 function bind(md){const t=owner();
  md.querySelectorAll('[data-ph]').forEach(b=>b.onclick=async()=>{const k=b.dataset.ph;if(!k)return;
   if(['home','contacts','conf','cal','sms'].includes(k)){PH.screen=k;return re()}
   if(k==='smsopen'){PH.room=b.dataset.room;PH.screen='smsroom';return re()}
   if(k==='smssend')return smsSend(md);
   if(k==='smsnew')return newRoom();
   if(k==='smsdel'){if(!confirm('이 방을 지울까? (메시지는 로그에 남는다)'))return;const rs=(((A().ST.state.rp||{}).sms||{}).rooms||[]).filter(x=>x.id!==b.dataset.room);await A().set(['rp','sms','rooms'],rs);return re()}
   if(k==='sheet'){A().closeModal();if(window.OM_SHEET_UI)window.OM_SHEET_UI.UI.tid=b.dataset.tid;A().view='sheet';return A().renderScene()}
   if(k==='conf1'){if(gm())return editConf(b.dataset.e);const g=G();const e=g.edges[b.dataset.e];return A().toast(e?`${esc(e.label||'관계')} · 레벨 ${+e.rank||0}${e.shock?' · ⚡ 쇼크':''}`:'')}
   if(k==='confadd')return addConf();
   if(k==='calfull'){A().closeModal();A().view='calendar';return A().renderScene()}
   if(k==='calrec'){const tid=PH.tid;const pd=phoneData(tid);const day=today();const rec={slot:$('#cs_slot',md).value,kind:$('#cs_kind',md).value,who:$('#cs_who',md).value||'',note:$('#cs_note',md).value.trim(),at:Date.now()};const log=Object.assign({},pd.log||{});log[day]=[...(log[day]||[]),rec];await savePhone(tid,{log});A().sysLog(`【캘린더】 ${t?t.name:''} · ${day} ${rec.slot} — ${(KINDS.find(z=>z[0]===rec.kind)||[])[1]||rec.kind}${rec.who?' · '+rec.who:''}${rec.note?'\n'+rec.note:''}`,'battle',{});return re()}
   if(k==='caldel'){const tid=PH.tid;const pd=phoneData(tid);const day=today();const log=Object.assign({},pd.log||{});log[day]=(log[day]||[]).filter((x,i)=>i!==+b.dataset.i);await savePhone(tid,{log});return re()}
   if(k==='memosave'){await savePhone(PH.tid,{memo:$('#cs_memo',md).value});return A().toast('저장했다')}
   if(k==='rest'){const K=window.OM_SKILL_UI;if(!K)return;const kd=b.dataset.k;const nm=RESTS.find(x=>x[0]===kd);if(!confirm(`「${nm[1]} (${nm[2]})」 회복을 할까? — ${t?t.name:''} 와 소지 포켓몬`))return;A().closeModal();await K.applyRest(kd,[PH.tid],{by:(t?t.name:'')+' · 휴대폰'});return open('cal')}});
  const own=$('#phOwner',md);if(own)own.onchange=()=>{PH.tid=own.value;re()};
  const si=$('#smsIn',md);if(si){si.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing)smsSend(md)};si.focus()}}
 return {open,onSms,unreadAll};
})();
