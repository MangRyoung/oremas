/* ---------- 덱 창: 은열쇠 · 광기 · 마음 칸 (무진 룰 플랜 2026-10-19 기준, 확정 전이라 설정으로 바꿀 수 있다) ----------
   state.deck = { cfg:{scope:'party'|'pc', keyStart, keyMax, madMax, thresholds:[{t,x}]},
                  cards:[{id,name,tag,kind,eff,q}], uses:{cardId:n},            // 부마다 카드 5종 × q장, 파티 공용
                  party:{keys},                                                 // scope party 일 때
                  pcs:{tid:{keys,mad,hearts:{npc:n}}}, npcs:[이름] }
   좌석(플레이어)은 deck 에 직접 못 쓰니 pub/<tid>/deck 에 요청을 적고, GM 화면이 받아 적는다 (absorb). */
"use strict";
window.OM_DECK_UI=(()=>{
 const A=()=>window.OM_APP;
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const $=(s,r)=>(r||document).querySelector(s);
 const DEFAULT_CARDS=[
  {id:'k1',name:'실타래 되감기',tag:'소진',kind:'battle',q:2,eff:'아군 기술이 명중 굴림으로 빗나갔을 때, 명중을 다시 굴린다.'},
  {id:'k2',name:'안개의 환영',tag:'방호',kind:'battle',q:2,eff:'상대의 C:+1 이하 기술이 급소에 맞았을 때, 급소가 아닌 것으로 한다.'},
  {id:'k3',name:'소금기 어린 부적',tag:'방호',kind:'battle',q:2,eff:'상대 기술의 30% 이하 추가 효과를 무시한다.'},
  {id:'k4',name:'은은한 등불',tag:'받치기',kind:'skill',q:2,eff:'스킬 체크 결과를 한 칸 올린다 (같은 판정에 겹치지 않는다).'},
  {id:'k5',name:'숨 고르기',tag:'회복',kind:'rest',q:2,eff:'배틀 밖에서 지침 1체를 회복하거나 부상을 한 단계 줄인다.'}];
 const DEFAULT_CFG={scope:'party',keyStart:0,keyMax:3,madMax:9,thresholds:[{t:3,x:'정보 수집 불리'},{t:5,x:'통솔·능력 체크 불리'},{t:7,x:'12세션 거절에 통솔 11 판정'},{t:9,x:'거절 불가 · 개인 End 1'}]};
 const HEART_X=['','① 안면 — 큰 사건의 의뢰와 함께','② 속내 — 광기 −1 또는 하이라이트 1칸 커버','③ 결말 — 비용 0 전용 은열쇠'];
 function D(){return A().ST.state.deck||{}}
 function gm(){return A().ST.role==='gm'}
 function cards(){return (D().cards&&D().cards.length)?D().cards:DEFAULT_CARDS}
 function cfg(){return Object.assign({},DEFAULT_CFG,D().cfg||{})}
 function pcOf(id){const c=cfg();return Object.assign({keys:c.keyStart,mad:0,hearts:{}},(D().pcs||{})[id]||{})}
 function partyKeys(){const c=cfg();const p=D().party||{};return p.keys==null?c.keyStart:p.keys}
 function keysOf(id){return cfg().scope==='party'?partyKeys():pcOf(id).keys}
 function left(cd){return Math.max(0,(cd.q||1)-((D().uses||{})[cd.id]||0))}
 function pcIds(){const ST=A().ST;const trs=(ST.state.roster||{}).trainers||{};const seats=ST.state.seats||{};return Object.keys(trs).filter(id=>seats[id]||id===ST.seat||((D().pcs||{})[id])||(trs[id].pc))}
 function npcList(){const ST=A().ST;return D().npcs||Object.values((ST.state.graph||{}).nodes||{}).filter(n=>n.kind==='npc').map(n=>n.name)}

 function open(){if(window.OM_PHONE_UI)return window.OM_PHONE_UI.open('deck');return openOld()}
 function openOld(){
  const ST=A().ST;const trs=(ST.state.roster||{}).trainers||{};const ids=pcIds();const c=cfg();const npcs=npcList();const party=c.scope==='party';
  const keyRow=(k,who)=>`<div class="dkr"><span>은열쇠</span><div class="keys">${Array.from({length:c.keyMax},(_,i)=>`<i class="${i<k?'on':''}"></i>`).join('')}</div><b>${k}/${c.keyMax}</b>${gm()?`<button class="btn xs ghost" data-dk="keys" data-id="${who}" data-d="-1">−</button><button class="btn xs ghost" data-dk="keys" data-id="${who}" data-d="1">＋</button>`:''}</div>`;
  const md=A().openModal(`<div class="mhead"><h2>덱 — 은열쇠 · 광기 · 마음 칸</h2><span class="sp"></span>${gm()?'<button class="btn sm ghost" id="dkreset">새 부 (카드 리셋)</button><button class="btn sm ghost" id="dkcfg">설정</button>':''}<button class="btn ghost" data-x>닫기</button></div>
   ${party?`<div class="dkparty"><b>파티 공용</b>${keyRow(partyKeys(),'party')}<span class="small dim">카드를 쓰면 파티 은열쇠 −1, 없으면 쓴 사람 광기 +1</span></div>`:''}
   <div class="dkcards row">${cards().map(cd=>{const n=left(cd);return `<div class="dkc ${cd.kind} ${n?'':'out'}"><div class="dkn">${esc(cd.name)} <span class="tag">${esc(cd.tag)}</span> <span class="small dim">${n}/${cd.q||1}</span></div>${gm()?`<button class="btn xs ghost" data-cq="${cd.id}" data-d="1">＋</button><button class="btn xs ghost" data-cq="${cd.id}" data-d="-1">−</button>`:''}<div class="dke">${esc(cd.eff)}</div></div>`}).join('')}</div>
   ${ids.length?`<div class="dkgrid">${ids.map(id=>{const t=trs[id];const p=pcOf(id);const mine=gm()||id===ST.seat;const hit=c.thresholds.filter(x=>p.mad>=x.t);
    return `<div class="dkpc ${mine?'mine':''}"><div class="dkh"><div class="tpic" style="${t.image?`background-image:url('${cssu(t.image)}')`:''}"></div><b>${esc(t.name)}</b>${id===ST.seat?' <span class="tag me">ME</span>':''}</div>
     <div class="dkres">${party?'':keyRow(p.keys,id)}
      <div class="dkr"><span>광기</span><div class="mad">${Array.from({length:c.madMax},(_,i)=>`<i class="${i<p.mad?'on':''} ${c.thresholds.some(x=>x.t===i+1)?'th':''}"></i>`).join('')}</div><b>${p.mad}/${c.madMax}</b>${gm()?`<button class="btn xs ghost" data-dk="mad" data-id="${id}" data-d="-1">−</button><button class="btn xs ghost" data-dk="mad" data-id="${id}" data-d="1">＋</button>`:''}</div>
      ${hit.length?`<div class="small" style="color:var(--red2)">광기 ${hit[hit.length-1].t}: ${esc(hit[hit.length-1].x)}</div>`:''}</div>
     ${mine?`<div class="dkuse">${cards().map(cd=>`<button class="btn xs ${left(cd)?'':'ghost'}" data-use="${cd.id}" data-id="${id}" ${left(cd)?'':'disabled'}>${esc(cd.name)}</button>`).join('')}</div>`:''}
     <div class="dkhearts"><div class="small dim">마음 칸</div>${npcs.length?npcs.map(n=>{const v=+(p.hearts||{})[n]||0;return `<div class="dkr"><span>${esc(n)}</span><div class="hearts" title="${esc(HEART_X[v]||'')}">${[1,2,3].map(i=>`<i class="${i<=v?'on':''}">${['①','②','③'][i-1]}</i>`).join('')}</div>${gm()?`<button class="btn xs ghost" data-dkh="${esc(n)}" data-id="${id}" data-d="-1">−</button><button class="btn xs ghost" data-dkh="${esc(n)}" data-id="${id}" data-d="1">＋</button>`:''}</div>`}).join(''):'<div class="small dim">관계도에 NPC 를 넣거나 설정에서 적으면 여기 나온다</div>'}</div></div>`}).join('')}</div>`:'<div class="empty">아직 PC 가 없다. 플레이어가 자리에 앉으면 생긴다.</div>'}`);
  md.querySelectorAll('[data-dk]').forEach(b=>b.onclick=async()=>{const id=b.dataset.id;const k=b.dataset.dk;const d=+b.dataset.d;
   if(id==='party'){await A().set(['deck','party','keys'],clamp(partyKeys()+d,c.keyMax));return reopen()}
   const p=pcOf(id);p[k]=clamp((+p[k]||0)+d,k==='keys'?c.keyMax:c.madMax);await A().set(['deck','pcs',id],p);
   if(k==='mad'&&d>0){const th=c.thresholds.find(x=>x.t===p.mad);if(th)A().sysLog(`${trs[id].name} 광기 ${p.mad} — ${th.x}`)}reopen()});
  md.querySelectorAll('[data-cq]').forEach(b=>b.onclick=async()=>{const u=Object.assign({},D().uses||{});const cd=cards().find(x=>x.id===b.dataset.cq);u[cd.id]=clamp((u[cd.id]||0)-(+b.dataset.d),cd.q||1);await A().set(['deck','uses'],u);reopen()});
  md.querySelectorAll('[data-dkh]').forEach(b=>b.onclick=async()=>{const id=b.dataset.id;const p=pcOf(id);p.hearts=p.hearts||{};const n=b.dataset.dkh;p.hearts[n]=clamp((+p.hearts[n]||0)+(+b.dataset.d),3);await A().set(['deck','pcs',id],p);reopen();if(+b.dataset.d>0)A().sysLog(`${trs[id].name} ↔ ${n} 마음 칸 ${HEART_X[p.hearts[n]]||''}`)});
  md.querySelectorAll('[data-use]').forEach(b=>b.onclick=async()=>{const id=b.dataset.id;const cd=cards().find(x=>x.id===b.dataset.use);if(!cd||!left(cd))return;
   const k=keysOf(id);const msg=k>0?`은열쇠 −1 (남은 ${k-1})`:`은열쇠가 없어 광기 +1`;
   if(!confirm(`『${cd.name}』을 쓸까? ${msg}`))return;
   if(gm()){await applyUse(id,cd);reopen()}
   else{const ok=await A().set(['pub',id,'deck'],{card:cd.id,at:Date.now()});if(ok){A().sysLog(`${trs[id].name} 『${cd.name}』 사용 선언 — ${msg}`,'dice');A().toast('GM 화면에서 반영된다');A().closeModal()}}});
  const cf=$('#dkcfg',md);if(cf)cf.onclick=()=>openCfg();
  const rs=$('#dkreset',md);if(rs)rs.onclick=async()=>{if(!confirm('새 부: 카드 사용 횟수를 모두 되돌릴까? (은열쇠·광기는 그대로)'))return;await A().set(['deck','uses'],null);A().sysLog('덱: 새 부 — 카드 리셋');reopen()}}
 function clamp(v,mx){return Math.max(0,Math.min(mx,v))}
 function reopen(){A().closeModal();open()}
 function back(ph){A().closeModal();if(ph&&window.OM_PHONE_UI)window.OM_PHONE_UI.open('deck');else open()}
 /* GM 이 실제로 반영: 은열쇠 또는 광기, 카드 횟수, 로그 */
 async function applyUse(id,cd){const c=cfg();const trs=(A().ST.state.roster||{}).trainers||{};const name=(trs[id]||{}).name||id;let msg;
  if(c.scope==='party'){const k=partyKeys();if(k>0){await A().set(['deck','party','keys'],k-1);msg=`파티 은열쇠 −1 (남은 ${k-1})`}}
  else{const p=pcOf(id);if(p.keys>0){p.keys--;await A().set(['deck','pcs',id,'keys'],p.keys);msg=`은열쇠 −1 (남은 ${p.keys})`}}
  if(!msg){const p=pcOf(id);p.mad=clamp(p.mad+1,c.madMax);await A().set(['deck','pcs',id,'mad'],p.mad);const th=c.thresholds.find(x=>x.t===p.mad);msg=`은열쇠가 없어 광기 +1 (${p.mad})${th?' — '+th.x:''}`}
  await A().set(['deck','uses',cd.id],((D().uses||{})[cd.id]||0)+1);
  A().sysLog(`${name} 『${cd.name}』 사용 — ${msg} · 카드 남은 ${left(cd)}/${cd.q||1}`,'battle')}
 function openCfg(ph){const c=cfg();const d=D();
  const md=A().openModal(`<div class="mhead"><h2>덱 설정</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="row"><label>은열쇠 단위 <select id="csc"><option value="party" ${c.scope==='party'?'selected':''}>파티 공용</option><option value="pc" ${c.scope==='pc'?'selected':''}>PC 개인</option></select></label><label>시작 <input type="number" class="n" id="cks" value="${c.keyStart}"></label><label>최대 <input type="number" class="n" id="ckm" value="${c.keyMax}"></label><label>광기 최대 <input type="number" class="n" id="cmm" value="${c.madMax}"></label></div>
   <div class="sec">광기 단계 <span class="note">숫자 = 설명, 한 줄에 하나</span></div><textarea id="cth" rows="4" style="width:100%">${esc(c.thresholds.map(x=>x.t+' = '+x.x).join('\n'))}</textarea>
   <div class="sec">NPC (마음 칸 대상) <span class="note">비우면 관계도의 NPC 를 쓴다</span></div><input type="text" id="cnp" value="${esc((d.npcs||[]).join(', '))}" placeholder="쉼표로 구분" style="width:100%">
   <div class="sec">카드 <span class="note">부마다 장수만큼 쓸 수 있다</span></div><table class="t" id="ctab">${cards().map(cd=>`<tr><td><input type="text" data-cn value="${esc(cd.name)}" style="width:130px"></td><td><input type="text" data-ct value="${esc(cd.tag)}" style="width:60px"></td><td><select data-ck><option value="battle" ${cd.kind==='battle'?'selected':''}>배틀</option><option value="skill" ${cd.kind==='skill'?'selected':''}>판정</option><option value="rest" ${cd.kind==='rest'?'selected':''}>회복</option></select></td><td><input type="number" class="n" data-cqn value="${cd.q||1}" style="width:50px"></td><td><input type="text" data-ce value="${esc(cd.eff)}" style="width:100%"></td></tr>`).join('')}</table>
   <div class="row" style="margin-top:10px"><button class="btn sm ghost" id="creset">기본값으로</button><span class="sp"></span><button class="btn pri" id="cok">저장</button></div>`);
  $('#cok',md).onclick=async()=>{const th=$('#cth',md).value.split('\n').map(l=>{const m=l.match(/^\s*(\d+)\s*[=:：]\s*(.*)$/);return m?{t:+m[1],x:m[2].trim()}:null}).filter(Boolean).sort((a,b)=>a.t-b.t);
   const nc={scope:$('#csc',md).value,keyStart:+$('#cks',md).value||0,keyMax:+$('#ckm',md).value||3,madMax:+$('#cmm',md).value||9,thresholds:th.length?th:DEFAULT_CFG.thresholds};
   const rows=[...md.querySelectorAll('#ctab tr')].map((tr,i)=>({id:'k'+(i+1),name:tr.querySelector('[data-cn]').value.trim(),tag:tr.querySelector('[data-ct]').value.trim(),kind:tr.querySelector('[data-ck]').value,q:+tr.querySelector('[data-cqn]').value||1,eff:tr.querySelector('[data-ce]').value.trim()})).filter(x=>x.name);
   const npcs=$('#cnp',md).value.split(',').map(x=>x.trim()).filter(Boolean);A().closeModal();await A().setMany([[['deck','cfg'],nc],[['deck','cards'],rows],[['deck','npcs'],npcs.length?npcs:null]]);back(ph)};
  $('#creset',md).onclick=async()=>{if(!confirm('카드 · 설정을 기본값으로 되돌릴까?'))return;A().closeModal();await A().setMany([[['deck','cards'],null],[['deck','cfg'],null]]);back(ph)};
  const x=md.querySelector('[data-x]');if(x&&ph)x.onclick=()=>back(true)}
 /* GM 화면: 좌석이 pub 에 적어 둔 사용 선언을 받아 적는다 */
 let busy=false;
 async function absorb(){if(!gm()||busy)return;const pub=A().ST.state.pub||{};const todo=[];
  for(const id of Object.keys(pub)){const p=pub[id]||{};if(p.deck&&p.deck.card)todo.push({id,path:['pub',id,'deck'],req:p.deck});for(const [rid,q] of Object.entries(p.deckq||{}))if(q&&q.card)todo.push({id,path:['pub',id,'deckq',rid],req:q})}
  if(!todo.length)return;busy=true;todo.sort((a,b)=>(a.req.at||0)-(b.req.at||0));
  try{for(const x of todo){if(!await A().set(x.path,null))continue;const cd=cards().find(c=>c.id===x.req.card);if(cd&&left(cd))await applyUse(x.id,cd);else A().sysLog(`${(((A().ST.state.roster||{}).trainers||{})[x.id]||{}).name||x.id} 사용 선언 무시 — 카드가 없거나 다 썼다`,'battle')}}finally{busy=false}
  if(document.querySelector('.dkgrid'))reopen()}
 /* ---------- 휴대폰 「덱」 앱 (2026-10-21 망령: 덱은 휴대폰 안으로) ----------
   휴대폰 주인(tid)의 은열쇠 · 광기 · 손패(카드) · 마음 칸 + 「파티」 탭(모두의 광기 · 은열쇠 한눈에).
   좌석의 사용 선언은 pub/<tid>/deckq/<요청 id> 에 줄을 세운다 — 예전 한 칸(pub/<tid>/deck)은 연달아 쓰면 앞 선언이 덮였다. GM 화면이 순서대로 받아 적는다 (absorb).
   쓰기는 바뀐 칸만 (deck/pcs/<tid>/mad 처럼). */
 const PV={tab:'me'};
 function pending(id){const p=((A().ST.state.pub||{})[id])||{};const q=Object.values(p.deckq||{}).filter(x=>x&&x.card);if(p.deck&&p.deck.card)q.push(p.deck);return q}
 const pips=(n,mx,cls,th)=>`<div class="${cls}">${Array.from({length:mx},(_,i)=>`<i class="${i<n?'on':''} ${th&&th.some(x=>x.t===i+1)?'th':''}"></i>`).join('')}</div>`;
 const pm=(act,id,extra)=>gm()?`<span class="pdpm"><button class="btn xs ghost" data-pd="${act}" data-id="${esc(id)}" data-d="-1" ${extra||''}>−</button><button class="btn xs ghost" data-pd="${act}" data-id="${esc(id)}" data-d="1" ${extra||''}>＋</button></span>`:'';
 function phone(t,canWrite){const c=cfg();const party=c.scope==='party';
  const head=`<div class="ph-head deck"><button class="ph-back" data-ph="home">‹</button><div><b>덱</b><small>${esc(t?t.name:'')} · 은열쇠 ${party?'파티 공용':'개인'}</small></div>${gm()?'<button class="btn xs" data-pd="cfg" title="카드 · 은열쇠 · 광기 단계 · NPC">설정</button><button class="btn xs ghost" data-pd="reset" title="카드 사용 횟수를 모두 되돌린다">새 부</button>':''}</div>`;
  if(!t||t.npc)return head+`<div class="ph-empty">덱은 PC 전용이다${gm()?'<br><span class="small">홈에서 「누구의 휴대폰」을 PC 로 바꿔 줘</span>':''}</div>`;
  const tabs=`<div class="ph-dtabs">${[['me','내 덱'],['party','파티']].map(([k,n])=>`<button class="${PV.tab===k?'on':''}" data-pd="tab" data-v="${k}">${n}</button>`).join('')}</div>`;
  if(PV.tab==='party')return head+tabs+partyView(c);
  const id=t.id,p=pcOf(id),k=keysOf(id),hit=c.thresholds.filter(x=>p.mad>=x.t),cur=hit[hit.length-1],nx=c.thresholds.find(x=>x.t>p.mad);
  const pend=pending(id);const npcs=npcList();const mine=canWrite;
  return head+tabs+`<div class="ph-dk">
   <div class="pdstat">
    <div class="pdr"><span class="pdl">🔑 은열쇠${party?'<small>파티</small>':''}</span>${pips(k,c.keyMax,'keys')}<b>${k}/${c.keyMax}</b>${pm('keys',party?'party':id)}</div>
    <div class="pdr"><span class="pdl">🌀 광기</span>${pips(p.mad,c.madMax,'mad',c.thresholds)}<b>${p.mad}/${c.madMax}</b>${pm('mad',id)}</div>
    ${cur?`<div class="pdth on"><b>광기 ${cur.t}</b> ${esc(cur.x)}</div>`:''}${nx?`<div class="pdth"><span class="dim">다음 ${nx.t}</span> ${esc(nx.x)}</div>`:''}
   </div>
   <div class="ph-sec">손패 <small>이번 부 · 쓰면 ${k>0?'은열쇠 −1':'<b class="red">은열쇠가 없어 광기 +1</b>'}</small></div>
   <div class="pdcards">${cards().map(cd=>{const n=left(cd),q=cd.q||1,w=pend.filter(x=>x.card===cd.id).length;
    return `<div class="pdc ${esc(cd.kind)} ${n?'':'out'}"><div class="pdch"><b>${esc(cd.name)}</b>${cd.tag?`<span class="tag">${esc(cd.tag)}</span>`:''}<span class="sp"></span><span class="pdq" title="이번 부 남은 장수">${Array.from({length:q},(_,i)=>`<i class="${i<n?'on':''}"></i>`).join('')}<em>${n}/${q}</em></span></div>
     <div class="pdce">${esc(cd.eff)}</div>
     <div class="pdcf">${w?`<small class="pdw">⏳ GM 반영 대기 ${w}</small>`:''}<span class="sp"></span>${gm()?`<button class="btn xs ghost" data-pd="cq" data-c="${esc(cd.id)}" data-d="-1" title="남은 장수 −1">−</button><button class="btn xs ghost" data-pd="cq" data-c="${esc(cd.id)}" data-d="1" title="남은 장수 +1">＋</button>`:''}${mine?`<button class="btn xs ${n?'pri':'ghost'}" data-pd="use" data-c="${esc(cd.id)}" ${n?'':'disabled'}>${n?'사용':'다 씀'}</button>`:''}</div></div>`}).join('')}</div>
   <div class="ph-sec">마음 칸 <small>${esc(t.name)} ↔ NPC</small></div>
   <div class="pdhearts">${npcs.length?npcs.map(nm=>{const v=+(p.hearts||{})[nm]||0;return `<div class="pdh"><div class="pdhn"><b>${esc(nm)}</b><small>${esc(HEART_X[v]||'아직 없음')}</small></div><div class="hearts">${[1,2,3].map(i=>`<i class="${i<=v?'on':''}">${['①','②','③'][i-1]}</i>`).join('')}</div>${pm('heart',id,`data-n="${esc(nm)}"`)}</div>`}).join(''):'<div class="ph-empty small">관계도에 NPC 를 넣거나 덱 설정에서 적으면 여기 나온다</div>'}</div>
  </div>`}
 function partyView(c){const ST=A().ST;const T=(ST.state.roster||{}).trainers||{};const ids=pcIds();const party=c.scope==='party';
  return `<div class="ph-dk">${party?`<div class="pdstat"><div class="pdr"><span class="pdl">🔑 파티 은열쇠</span>${pips(partyKeys(),c.keyMax,'keys')}<b>${partyKeys()}/${c.keyMax}</b>${pm('keys','party')}</div></div>`:''}
   <div class="ph-sec">카드 <small>파티 공용 · 이번 부 남은 장수</small></div>
   <div class="pdmini">${cards().map(cd=>`<span class="pdmc ${esc(cd.kind)} ${left(cd)?'':'out'}" title="${esc(cd.eff)}">${esc(cd.name)} <b>${left(cd)}/${cd.q||1}</b></span>`).join('')}</div>
   <div class="ph-sec">PC</div>
   <div class="ph-list">${ids.map(id=>{const t=T[id];const p=pcOf(id);const hit=c.thresholds.filter(x=>p.mad>=x.t);const cur=hit[hit.length-1];const w=pending(id).length;
    return `<div class="ph-item pdpc ${id===ST.seat?'me':''}">${av(t.name,t.image)}<div class="ph-it"><b>${esc(t.name)}${id===ST.seat?' <span class="tag me">ME</span>':''}${w?` <small class="pdw">⏳${w}</small>`:''}</b>
     ${party?'':`<div class="pdr sm"><span class="pdl">🔑</span>${pips(p.keys,c.keyMax,'keys')}<b>${p.keys}</b></div>`}
     <div class="pdr sm"><span class="pdl">🌀</span>${pips(p.mad,c.madMax,'mad',c.thresholds)}<b>${p.mad}</b></div>${cur?`<small class="pdth on">광기 ${cur.t} · ${esc(cur.x)}</small>`:''}</div></div>`}).join('')||'<div class="ph-empty">아직 PC 가 없다</div>'}</div></div>`}
 function av(name,img){const u=A().portraitOf?A().portraitOf(name,img):(img||'');return `<i class="ph-av" style="${u?`background-image:url('${cssu(u)}')`:''}"></i>`}
 function bindPhone(md,redraw,t){const c=cfg();const T=(A().ST.state.roster||{}).trainers||{};const nm=id=>(T[id]||{}).name||id;
  md.querySelectorAll('[data-pd]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const a=b.dataset.pd,id=b.dataset.id,d=+b.dataset.d;
   if(a==='tab'){PV.tab=b.dataset.v;return redraw()}
   if(a==='cfg')return openCfg(true);
   if(a==='reset'){if(!confirm('새 부: 카드 사용 횟수를 모두 되돌릴까? (은열쇠 · 광기 · 마음 칸은 그대로)'))return;if(await A().set(['deck','uses'],null))A().sysLog('덱: 새 부 — 카드 리셋');return redraw()}
   if(a==='keys'){if(id==='party')await A().set(['deck','party','keys'],clamp(partyKeys()+d,c.keyMax));else await A().set(['deck','pcs',id,'keys'],clamp(pcOf(id).keys+d,c.keyMax));return redraw()}
   if(a==='mad'){const v=clamp(pcOf(id).mad+d,c.madMax);if(await A().set(['deck','pcs',id,'mad'],v)&&d>0){const th=c.thresholds.find(x=>x.t===v);if(th)A().sysLog(`${nm(id)} 광기 ${v} — ${th.x}`)}return redraw()}
   if(a==='heart'){const n=b.dataset.n;const v=clamp((+(pcOf(id).hearts||{})[n]||0)+d,3);if(await A().set(['deck','pcs',id,'hearts',n],v)&&d>0)A().sysLog(`${nm(id)} ↔ ${n} 마음 칸 ${HEART_X[v]||''}`);return redraw()}
   if(a==='cq'){const cd=cards().find(x=>x.id===b.dataset.c);if(!cd)return;const u=(D().uses||{})[cd.id]||0;await A().set(['deck','uses',cd.id],clamp(u-d,cd.q||1));return redraw()}
   if(a==='use'){const tid=t&&t.id;const cd=cards().find(x=>x.id===b.dataset.c);if(!tid||!cd||!left(cd))return;
    const k=keysOf(tid);const msg=k>0?`은열쇠 −1 (남은 ${k-1})`:'은열쇠가 없어 광기 +1';
    if(!confirm(`『${cd.name}』을 쓸까?\n${msg}`))return;
    if(gm()){await applyUse(tid,cd);return redraw()}
    const rid='q'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    if(await A().set(['pub',tid,'deckq',rid],{card:cd.id,at:Date.now()})){A().sysLog(`${nm(tid)} 『${cd.name}』 사용 선언 — ${msg}`,'dice');A().toast('GM 화면에서 반영된다')}return redraw()}})}
 return {open,absorb,phone,bindPhone};
})();
