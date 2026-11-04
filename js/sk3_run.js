/* 11-04 망령 「덱 누르면 휴대폰 연결이 아니라 정식적인 카드 관리 창으로 · 카드 관리창을 제대로 설계」 「지금 개수한 룰로 맞춰서」 (노트 27 은열쇠 세 칸)
   은열쇠 카드 관리 창 OM_SK3R.open().
   상태 state.sk3 = {
     on: 1 (세 칸 규칙 켜짐 — 부상 단계가 나빠지면 4식 · 6령 대신 카드 1장 버림),
     h: {tid: {c,d,b,r: {n 카드 이름, on 1 들고 있음 · 0 버림, mv 예비로 다른 사람 칸에 옮겨 감, from 'tid' 받은 예비 주인}}},
     owe: {tid: 버려야 할 장수}, log: [{at, t}] (최근 40) }
   규칙: 효과로 쓰면 버림 · 체크에 바치면(문양 맞으면 +1, 결과 뒤에도, 체크 하나에 일행 합쳐 1장) 버림 · 부상 한 단계마다 1장 버림(본인이 고름)
         휴식 때 빈 체크 · 던전 · 배틀 칸을 일행의 예비 칸 카드(같은 종류)로 채운다 · 배틀 카드는 자기 포켓몬에게만.
   GM 은 바로 쓰고, 좌석은 자기 줄만 pub[seat].sk3q 로 요청 → GM 화면이 처리 (덱 창과 같은 길). */
window.OM_SK3R=(()=>{
 const A=()=>window.OM_APP,ST=()=>window.OM_APP.ST;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const gm=()=>ST().role==='gm';
 const K=[['c','체크'],['d','던전'],['b','배틀'],['r','예비']];const KN={c:'체크',d:'던전',b:'배틀',r:'예비'};
 const STEP=['건강','부상','중상','빈사'];
 const S3=()=>ST().state.sk3||{};
 const trs=()=>((ST().state.roster||{}).trainers)||{};
 const clone=o=>JSON.parse(JSON.stringify(o||{}));
 const dbRow=n=>{const D=window.OM_SK3&&window.OM_SK3.db();return D&&D.get(n)};
 const kindsOf=n=>{const t=String((dbRow(n)||[])[2]||'');const o=[];if(/체크/.test(t))o.push('c');if(/던전/.test(t))o.push('d');if(/배틀/.test(t))o.push('b');return o};
 const card=(n,o)=>window.OM_SK3&&window.OM_SK3.cardHtml?window.OM_SK3.cardHtml(n,o):`<b>${esc(n)}</b>`;
 const injOf=tid=>{const x=(((ST().state.skill||{}).trainers)||{})[tid]||{};return Math.max(0,Math.min(3,+x.inj||0))};
 const nm=tid=>(trs()[tid]||{}).name||tid;
 const members=()=>{const h=S3().h||{};const T=trs();return Object.keys(h).filter(id=>T[id]).sort((a,b)=>(T[a].ord||0)-(T[b].ord||0))};
 /* 시트의 네 칸 → 손에 든 네 칸 */
 const fromSheet=tid=>{const s=(trs()[tid]||{}).sk3||{};const o={};for(const [k] of K)o[k]=s[k]?{n:s[k],on:1}:null;return o};
 /* 기본 참가자: 지금 던전 일행 → 없으면 네 칸이 있는 PL 시트 */
 function defaultParty(){const DG=window.OM_DG_UI;try{const d=DG&&DG.cur&&DG.cur();const p=d&&DG.party?DG.party(d):[];if(p&&p.length)return p.filter(id=>trs()[id])}catch(e){}
  return Object.values(trs()).filter(t=>t&&!t.wild&&t.kind!=='npc'&&t.sk3&&Object.keys(t.sk3).length).map(t=>t.id)}
 const reserve=h=>{const out=[];for(const id of Object.keys(h||{})){const r=(h[id]||{}).r;if(r&&r.on&&r.n)out.push({tid:id,n:r.n,ks:kindsOf(r.n)})}return out};

 /* ---------- 처리 (GM 화면에서만 쓴다) ---------- */
 function exec(s,p,who){const isGm=who==='gm';const by=isGm?'GM':nm(who);s.h=s.h||{};s.owe=s.owe||{};const lines=[];
  const own=tid=>isGm||tid===who;const slot=(tid,k)=>(s.h[tid]||{})[k];
  switch(p.op){
   case 'on':if(!isGm)return {err:'GM 만'};s.on=p.v?1:0;lines.push(`세 칸 규칙 ${s.on?'켬 — 부상 단계가 나빠지면 4식 · 6령 대신 카드 1장을 버린다':'끔'}`);break;
   case 'fill':{if(!isGm)return {err:'GM 만'};const ids=(p.tids||[]).filter(id=>trs()[id]);if(!ids.length)return {err:'채울 사람이 없다'};
    for(const id of ids){s.h[id]=fromSheet(id);delete s.owe[id]}lines.push(`시트대로 채움 — ${ids.map(nm).join(' · ')}`);break}
   case 'add':{if(!isGm)return {err:'GM 만'};if(!trs()[p.tid])return {err:'없는 시트'};s.h[p.tid]=fromSheet(p.tid);lines.push(`${nm(p.tid)} 참가 (시트대로)`);break}
   case 'remove':{if(!isGm)return {err:'GM 만'};delete s.h[p.tid];delete s.owe[p.tid];lines.push(`${nm(p.tid)} 빠짐`);break}
   case 'clear':{if(!isGm)return {err:'GM 만'};s.h={};s.owe={};lines.push('카드 칸을 모두 비웠다');break}
   case 'use':case 'commit':case 'drop':{if(!own(p.tid))return {err:'자기 카드만'};const x=slot(p.tid,p.k);if(!x||!x.on)return {err:'든 카드가 없다'};x.on=0;
    if(p.op==='drop'&&s.owe[p.tid]>0){s.owe[p.tid]--;if(!s.owe[p.tid])delete s.owe[p.tid]}
    lines.push(p.op==='use'?`${nm(p.tid)} — 「${x.n}」 사용 (${KN[p.k]} 칸 · 버림)`:p.op==='commit'?`${nm(p.tid)} — 「${x.n}」 바침${p.who&&p.who!==p.tid?` (${nm(p.who)} 의 체크)`:''} · 문양이 맞으면 +1 (버림)`:`${nm(p.tid)} — 「${x.n}」 버림${p.why?` (${p.why})`:''}`);break}
   case 'back':{if(!own(p.tid))return {err:'자기 카드만'};const x=slot(p.tid,p.k);if(!x||x.on)return {err:'되살릴 카드가 없다'};if(x.mv)return {err:'예비로 옮겨 간 카드는 되살리지 않는다'};x.on=1;lines.push(`${nm(p.tid)} — 「${x.n}」 되살림`);break}
   case 'refill':{if(!own(p.tid)&&!isGm)return {err:'자기 칸만'};if(!['c','d','b'].includes(p.k))return {err:'체크 · 던전 · 배틀 칸만 채운다'};const cur=slot(p.tid,p.k);if(cur&&cur.on)return {err:'칸이 비어 있지 않다'};
    const src=(s.h[p.from]||{}).r;if(!src||!src.on)return {err:'그 예비 카드는 이미 없다'};if(!kindsOf(src.n).includes(p.k))return {err:`「${src.n}」 은(는) ${KN[p.k]} 카드가 아니다`};
    s.h[p.tid]=s.h[p.tid]||{};s.h[p.tid][p.k]={n:src.n,on:1,from:p.from};src.on=0;src.mv=1;
    lines.push(`${nm(p.tid)} — 휴식 보충: ${KN[p.k]} 칸에 「${src.n}」 (${p.from===p.tid?'내':nm(p.from)+' 의'} 예비)`);break}
   case 'owe':{if(!isGm)return {err:'GM 만'};const n=Math.max(0,Math.min(4,Math.round(+p.n||0)));if(n)s.owe[p.tid]=n;else delete s.owe[p.tid];lines.push(`${nm(p.tid)} — 버려야 할 카드 ${n}장`);break}
   default:return {err:'모르는 요청'}}
  s.log=[...lines.map(t=>({at:Date.now(),t:(isGm?'':by+' · ')+t})),...(s.log||[])].slice(0,40);
  return {lines}}
 async function apply(p,who){const s0=S3();const s=clone(s0);const R=exec(s,p,who);if(R.err)return R;
  const ok=Object.keys(s0).length?await A().setDiff(['sk3'],s0,s,3):await A().set(['sk3'],s);if(!ok)return {err:'저장하지 못했다'};
  for(const t of R.lines)A().sysLog('🗝 '+(who==='gm'?'':nm(who)+' · ')+t,'sys');return R}
 async function run(p){if(gm()){const R=await apply(p,'gm');if(R.err)A().toast(R.err);draw();return R}
  const seat=ST().seat;if(!seat)return A().toast('자리에 앉아야 카드를 쓸 수 있다');
  const rid='q'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  if(await A().set(['pub',seat,'sk3q',rid],{p,at:Date.now()}))A().toast('GM 화면으로 보냈다');}
 let busy=false;
 async function absorb(){if(!gm()||busy)return;const pub=ST().state.pub||{};const todo=[];for(const sid of Object.keys(pub)){const q=(pub[sid]||{}).sk3q||{};for(const [rid,x] of Object.entries(q))if(x)todo.push({sid,rid,x})}
  if(!todo.length)return;busy=true;todo.sort((a,b)=>(+a.x.at||0)-(+b.x.at||0));
  try{for(const it of todo){if(!await A().set(['pub',it.sid,'sk3q',it.rid],null))continue;if(!it.x.p||Date.now()-(+it.x.at||0)>10*60000)continue;const R=await apply(it.x.p,it.sid);if(R.err)A().sysLog(`🗝 ${nm(it.sid)} 요청을 못 했다 — ${R.err}`,'sys')}}
  finally{busy=false;draw()}}
 /* 부상 단계가 나빠질 때(skill_ui stepUp) — 세 칸 규칙이 켜졌고 그 트레이너가 참가 중이면 버릴 카드 1장을 단다. 돌려줌: 쓴 줄(없으면 '') */
 async function onInjury(tid,n){const s=S3();if(!s.on||!gm()||!(s.h||{})[tid])return '';n=n||1;const held=K.filter(([k])=>((s.h[tid]||{})[k]||{}).on).length;if(!held)return `${nm(tid)} — 버릴 카드가 없다`;
  const want=Math.min(held,(+((s.owe||{})[tid])||0)+n);await A().set(['sk3','owe',tid],want);return `${nm(tid)} — 은열쇠 카드 ${n}장 버려야 한다 (본인이 고른다 · 🗝 카드 창)`}
 const ruleOn=()=>!!S3().on;

 /* ---------- 창 ---------- */
 const V={open:false,pick:null,hash:''};
 function rowHTML(tid){const s=S3();const h=(s.h||{})[tid]||{};const mine=gm()||tid===ST().seat;const owe=+((s.owe||{})[tid])||0;const inj=injOf(tid);const R=reserve(s.h);
  const cell=([k,lab])=>{const x=h[k];const on=x&&x.on;
   const btns=!mine?'':on?`<div class="s3b"><button class="btn xs" data-s3="use" data-t="${esc(tid)}" data-k="${k}" title="효과로 쓰고 버린다">사용</button>${k!=='b'?`<button class="btn xs" data-s3="commit" data-t="${esc(tid)}" data-k="${k}" title="체크에 바친다 — 문양이 자질과 맞으면 +1 (★ 는 어느 자질이나) · 결과를 보고 붙여도 된다 · 체크 하나에 일행 합쳐 1장">바치기</button>`:''}<button class="btn xs ${owe?'warn':'ghost'}" data-s3="drop" data-t="${esc(tid)}" data-k="${k}" title="그냥 버린다 (부상으로 버릴 때)">버리기</button></div>`
    :x&&!x.mv?`<div class="s3b"><button class="btn xs ghost" data-s3="back" data-t="${esc(tid)}" data-k="${k}">되살리기</button>${k!=='r'&&R.some(y=>y.ks.includes(k))?`<button class="btn xs" data-s3="refill" data-t="${esc(tid)}" data-k="${k}">휴식 보충</button>`:''}</div>`
    :k!=='r'&&R.some(y=>y.ks.includes(k))?`<div class="s3b"><button class="btn xs" data-s3="refill" data-t="${esc(tid)}" data-k="${k}" title="휴식 때 — 일행 예비 칸의 같은 종류 카드로">휴식 보충</button></div>`:'';
   return `<div class="s3c k-${k}${on?'':' off'}"><span class="s3k">${lab}${x&&x.from?` <small>← ${esc(x.from===tid?'내 예비':nm(x.from))}</small>`:''}</span>${x?`<button type="button" class="s3card" data-s3v="${esc(x.n)}">${card(x.n,{})}${on?'':`<em class="s3st">${x.mv?'예비로 보냄':'버림'}</em>`}</button>`:`<div class="s3card empty">${k==='r'?'비어 있음':'빈 칸'}</div>`}${btns}</div>`};
  return `<div class="s3row${tid===ST().seat?' me':''}"><div class="s3who"><b>${esc(nm(tid))}</b><span class="s3inj i${inj}">${STEP[inj]}</span><span class="small dim">${K.filter(([k])=>(h[k]||{}).on).length} / 4장</span>${owe?`<span class="s3owe">⚠ ${owe}장 버려야 함</span>`:''}${gm()?`<span class="sp"></span><button class="btn xs ghost" data-s3="refresh" data-t="${esc(tid)}" title="시트의 네 칸대로 다시">시트대로</button><button class="btn xs ghost" data-s3="remove" data-t="${esc(tid)}" title="이 사람을 카드 창에서 뺀다">빼기</button>`:''}</div>
   <div class="s3cells">${K.map(cell).join('')}</div></div>`}
 function bodyHTML(){const s=S3();const ids=members();const R=reserve(s.h);const T=trs();const G=gm();
  const others=Object.values(T).filter(t=>t&&!t.wild&&!ids.includes(t.id)).sort((a,b)=>(a.ord||0)-(b.ord||0));
  const cnt=k=>R.filter(x=>x.ks.includes(k)).length;
  const top=G?`<div class="s3top"><label class="s3sw"><input type="checkbox" data-s3on ${s.on?'checked':''}> 세 칸 규칙 <small>부상 단계 ↑ = 카드 1장 버림 (4식 · 6령은 안 잃는다)</small></label><span class="sp"></span>
    <button class="btn sm pri" data-s3="fill" title="던전 일행(없으면 네 칸이 있는 PL 시트)을 시트의 네 칸대로 채운다 — 던전에 들어설 때">시트대로 채우기</button>
    <select data-s3add><option value="">＋ 참가자</option>${others.map(t=>`<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select>
    ${ids.length?'<button class="btn sm ghost" data-s3="clear">모두 비우기</button>':''}</div>`:'';
  const res=`<div class="s3res"><b>예비 덱</b> <span class="small">일행 예비 칸 ${R.length}장 — 체크 ${cnt('c')} · 던전 ${cnt('d')} · 배틀 ${cnt('b')}</span>${R.length?`<span class="small dim"> · ${R.map(x=>`「${esc(x.n)}」(${esc(nm(x.tid))})`).join(' ')}</span>`:''}</div>`;
  const rule=`<details class="s3rule"><summary class="small">규칙 한눈에</summary><ul class="small">
    <li>트레이너마다 <b>체크 · 던전 · 배틀 한 장씩 + 예비 한 장</b>. 일행의 예비 칸을 모은 것이 예비 덱.</li>
    <li><b>사용</b>: 효과로 쓰면 버린다. <b>배틀 카드는 자기 포켓몬에게만.</b></li>
    <li><b>바치기</b>: 문양(아이콘)이 체크 자질과 같으면 <b>+1</b> (★ 는 어느 자질이나) · 결과를 보고 붙여도 된다 · <b>체크 하나에 일행 합쳐 1장</b>.</li>
    <li><b>부상</b>: 상태 단계가 한 단계 나빠질 때마다 카드 1장 버림(본인이 고름). 판정 −1 · 불리는 그대로.</li>
    <li><b>휴식</b>: 빈 체크 · 던전 · 배틀 칸을 예비 덱의 같은 종류 카드로 채운다.</li></ul></details>`;
  const log=(s.log||[]).slice(0,8);
  return `${top}${rule}${ids.length?ids.map(rowHTML).join(''):`<p class="dim" style="margin:14px 0">${G?'아직 참가자가 없다 — 「시트대로 채우기」를 누르면 던전 일행(없으면 네 칸이 있는 PL 시트)을 시트의 네 칸대로 채운다.':'GM 이 아직 카드를 나눠 주지 않았다.'}</p>`}
   ${ids.length?res:''}${log.length?`<div class="s3log"><b class="small">기록</b>${log.map(x=>`<div class="small"><span class="dim">${new Date(x.at).toTimeString().slice(0,5)}</span> ${esc(x.t)}</div>`).join('')}</div>`:''}`}
 function draw(){if(!V.open)return;const m=document.getElementById('s3m');if(!m){V.open=false;return}const b=m.querySelector('.s3body');if(!b)return;const sc=b.scrollTop;b.innerHTML=bodyHTML();b.scrollTop=sc;bind(m);V.hash=JSON.stringify([S3(),Object.keys(trs()).length,!!(window.OM_SK3&&window.OM_SK3.db())])}
 function bind(m){
  m.querySelectorAll('[data-s3v]').forEach(b=>b.onclick=()=>window.OM_SK3&&window.OM_SK3.big&&window.OM_SK3.big(b.dataset.s3v,()=>open()));
  const on=m.querySelector('[data-s3on]');if(on)on.onchange=()=>run({op:'on',v:on.checked?1:0});
  const ad=m.querySelector('[data-s3add]');if(ad)ad.onchange=()=>{if(ad.value)run({op:'add',tid:ad.value})};
  m.querySelectorAll('[data-s3]').forEach(b=>b.onclick=async()=>{const k=b.dataset.s3,tid=b.dataset.t,sk=b.dataset.k;
   if(k==='fill'){const ids=members().length?members():defaultParty();if(!ids.length)return A().toast('채울 사람이 없다 — 「＋ 참가자」로 넣어 줘');return run({op:'fill',tids:ids})}
   if(k==='clear'){if(b.dataset.arm!=='1'){b.dataset.arm='1';b.textContent='정말 비울까?';return}return run({op:'clear'})}
   if(k==='refresh')return run({op:'fill',tids:[tid]});
   if(k==='remove'){if(b.dataset.arm!=='1'){b.dataset.arm='1';b.textContent='뺄까?';return}return run({op:'remove',tid})}
   if(k==='refill')return pickRefill(tid,sk);
   if(k==='commit'){const ids=members();if(ids.length>1){return pickWho(tid,sk)}return run({op:'commit',tid,k:sk})}
   return run({op:k,tid,k:sk})})}
 /* 바치기: 누구의 체크에 */
 function pickWho(tid,k){const m=document.getElementById('s3m');const box=m&&m.querySelector('.s3body');if(!box)return;const x=((S3().h||{})[tid]||{})[k];
  box.insertAdjacentHTML('afterbegin',`<div class="s3ask"><b>「${esc(x&&x.n)}」 — 누구의 체크에 바칠까?</b><div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px">${members().map(id=>`<button class="btn sm" data-s3w="${esc(id)}">${esc(nm(id))}</button>`).join('')}<button class="btn sm ghost" data-s3w="">취소</button></div></div>`);
  box.scrollTop=0;box.querySelectorAll('[data-s3w]').forEach(b=>b.onclick=()=>{if(!b.dataset.s3w)return draw();run({op:'commit',tid,k,who:b.dataset.s3w})})}
 /* 휴식 보충: 예비 덱에서 그 종류 카드 고르기 */
 function pickRefill(tid,k){const m=document.getElementById('s3m');const box=m&&m.querySelector('.s3body');if(!box)return;const R=reserve(S3().h).filter(x=>x.ks.includes(k));
  box.insertAdjacentHTML('afterbegin',`<div class="s3ask"><b>${esc(nm(tid))} · ${KN[k]} 칸 휴식 보충 — 예비 덱에서 한 장</b><div class="s3pg">${R.map(x=>`<button type="button" class="s3pk" data-s3f="${esc(x.tid)}">${card(x.n,{badge:x.tid===tid?'내 예비':nm(x.tid)})}</button>`).join('')}</div><button class="btn sm ghost" data-s3f="" style="margin-top:6px">취소</button></div>`);
  box.scrollTop=0;box.querySelectorAll('[data-s3f]').forEach(b=>b.onclick=()=>{if(!b.dataset.s3f)return draw();run({op:'refill',tid,k,from:b.dataset.s3f})})}
 function open(){if(window.OM_SK3&&window.OM_SK3.db)window.OM_SK3.db();
  A().openModal(`<div id="s3m"><div class="mhead"><h2>🗝 은열쇠 카드</h2><span class="small dim">체크 · 던전 · 배틀 · 예비</span><span class="sp"></span>${window.OM_DECK_UI?'<button class="btn sm ghost" data-s3old title="예전 덱 · 드로우 방식 창 (휴대폰 덱 앱)">예전 덱 창</button>':''}<button class="btn ghost" data-x>닫기</button></div><div class="mbody s3body"></div></div>`);
  {const md=document.querySelector('.modalbg .modal');if(md)md.classList.add('wide')}
  V.open=true;const m=document.getElementById('s3m');const ob=m.querySelector('[data-s3old]');if(ob)ob.onclick=()=>{A().closeModal();V.open=false;window.OM_DECK_UI.open()};
  draw();clearInterval(V.iv);V.iv=setInterval(()=>{if(!document.getElementById('s3m')){V.open=false;clearInterval(V.iv);return}const h=JSON.stringify([S3(),Object.keys(trs()).length,!!(window.OM_SK3&&window.OM_SK3.db())]);if(h!==V.hash&&!document.querySelector('#s3m .s3ask'))draw()},700)}
 return {open,absorb,onInjury,ruleOn,run,members}})();
