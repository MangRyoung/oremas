/* 11-04 망령 「시트의 카드칸 = 크게 네 칸 · 카드 보관소 · GM 측에서 카드를 PL 에게 건네주기도 편해야」 (노트 27 은열쇠 세 칸)
   시트 탭 캐릭터 패널: 체크 · 던전 · 배틀 · 예비 네 칸(t.sk3 = {c,d,b,r} 카드 이름) + 카드 보관소(t.vault = [{n, src, at}]).
   칸 고르기는 제작기 트레이너 시트에서 (같은 칸 규칙). 여기서는 보기 + GM 「카드 건네주기」:
   카드 DB(제작기 dbedit kind cards)에서 한 장 → 얻은 곳 메모 → 방 시트(roster)와 제작기 트레이너 문서 둘 다의 보관소에 넣는다. */
window.OM_SK3=(()=>{
 const A=()=>window.OM_APP,S=()=>window.OM_STORE;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const SK3=[['c','스킬'],['d','던전'],['b','배틀'],['r','예비']];const N={c:'스킬',d:'던전',b:'배틀',r:'예비'};
 const COMMON='은열쇠 · 공통';
 const PAL={red:'#c8504a',orange:'#d9822b',gold:'#b8932a',green:'#4f9a5a',teal:'#2f948f',blue:'#4573c4',purple:'#8a5cc4',pink:'#c45c9a',gray:'#6b7286',black:'#30343f',빨강:'#c8504a',주황:'#d9822b',금색:'#b8932a',초록:'#4f9a5a',청록:'#2f948f',파랑:'#4573c4',보라:'#8a5cc4',분홍:'#c45c9a',회색:'#6b7286',검정:'#30343f'};
 const kinds=r=>{const t=String((r&&r[2])||'');const o=[];if(/체크|스킬/.test(t))o.push('c');if(/던전/.test(t))o.push('d');if(/배틀/.test(t))o.push('b');return o};
 /* 카드 DB — 처음 그릴 때 한 번 읽고 10분 둔다 */
 let DB=null,DBat=0,loading=null;
 function db(){if(DB&&Date.now()-DBat<600000)return DB;if(!loading&&S()&&S().makerDocs)loading=S().makerDocs('dbedit').then(rows=>{const m=new Map();for(const x of rows||[]){const d=x.data||{};if(d.kind!=='cards'||d.deleted)continue;const r=d.row||[];if(r[1])m.set(r[1],r)}DB=m;DBat=Date.now();loading=null;try{A().renderScene()}catch(e){}}).catch(e=>{loading=null;console.warn('sk3 카드 DB',e)});return DB}
 const cardObj=(n,r)=>r?{n,t:String(r[2]||''),c:r[3]==null?'':String(r[3]),x:String(r[4]||'').replace(/<br\s*\/?>/g,'\n'),img:/^https?:\/\//.test(String(r[6]||''))?String(r[6]):'',col:PAL[String(r[5]||'').trim()]||(/^#[0-9a-f]{3,8}$/i.test(String(r[5]||'').trim())?String(r[5]).trim():'#6b7286'),ic:String(r[10]||''),src:String(r[11]||''),auto:!!String(r[9]||'').trim()}:{n,t:'카드 DB 에 없음',col:'#6b7286'};
 const card=(n,o)=>{const D=db();const r=D&&D.get(n);return window.SKCARD?window.SKCARD.html(cardObj(n,r),o||{}):`<b>${esc(n)}</b>`};
 const vaultOf=t=>(Array.isArray(t&&t.vault)?t.vault:[]).filter(x=>x&&x.n);
 /* 시트 패널 */
 function sec(t,gm){const s=(t&&t.sk3)||{};const V=vaultOf(t);const used=new Set(Object.values(s));
  if(!Object.keys(s).length&&!V.length&&!gm)return '';
  const slot=([k,lab])=>`<div class="sk3s k-${k}"><b>${lab}</b>${s[k]?`<button type="button" class="sk3c" data-sk3v="${esc(s[k])}" title="${esc(s[k])} — 크게 보기">${card(s[k],{})}</button>`:`<div class="sk3c empty">비어 있음</div>`}</div>`;
  return `<div class="spanel sk3p"><div class="sh">은열쇠 카드 <span class="note">네 칸은 제작기 트레이너 시트에서 고른다 · 「제작기 동기화」로 따라온다</span><span class="sp"></span>${gm?`<button class="btn sm pri" data-sk3give="${esc(t.id)}">🎁 카드 건네주기</button>`:''}</div>
   <div class="sk3g">${SK3.map(slot).join('')}</div>
   <div class="sh" style="margin-top:12px">카드 보관소 ${V.length} <span class="note">시나리오 · 호감도 보상으로 얻은 이 트레이너만의 카드 — 같은 종류 칸에 넣어 쓴다</span></div>
   ${V.length?`<div class="sk3v">${V.map((v,i)=>`<div class="sk3vi"><button type="button" class="sk3c" data-sk3v="${esc(v.n)}" title="${esc(v.n)}">${card(v.n,{cls:'skc-mini',badge:used.has(v.n)?'칸':''})}</button><span class="small">${esc(v.src||'—')}</span>${v.at?`<span class="small dim">${esc(v.at)}</span>`:''}${gm?`<button type="button" class="btn xs ghost" data-sk3del="${i}" data-tid="${esc(t.id)}" title="보관소에서 빼기">✕</button>`:''}</div>`).join('')}</div>`:'<div class="small dim">아직 없다</div>'}</div>`}
 function bind(el){if(!el)return;
  el.querySelectorAll('[data-sk3v]').forEach(b=>b.onclick=e=>{e.stopPropagation();big(b.dataset.sk3v)});
  el.querySelectorAll('[data-sk3give]').forEach(b=>b.onclick=e=>{e.stopPropagation();give(b.dataset.sk3give)});
  el.querySelectorAll('[data-sk3del]').forEach(b=>b.onclick=async e=>{e.stopPropagation();await take(b.dataset.tid,+b.dataset.sk3del)})}
 function big(n,back){A().openModal(`<div class="mhead"><h2>${esc(n)}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="mbody" style="display:flex;justify-content:center"><div style="width:260px">${card(n,{})}</div></div>`);
  document.querySelectorAll('.modalbg [data-x]').forEach(b=>b.onclick=()=>{A().closeModal();if(back)back()})}
 /* 방 시트와 제작기 문서의 보관소를 같이 고친다. 제작기는 쓰기 직전에 다시 읽는다 */
 async function write(tid,fn,what){const tr=(((A().ST.state.roster||{}).trainers)||{})[tid];if(!tr)return A().toast('시트에 그 트레이너가 없다');
  const nv=fn(vaultOf(tr).map(x=>Object.assign({},x)));if(!nv)return;
  if(!await A().set(['roster','trainers',tid,'vault'],nv.length?nv:null))return A().toast('방 시트에 쓰지 못했다');
  let mk='';try{const d=await S().makerOne('trainers',tid);if(d&&d.data){const data=JSON.parse(JSON.stringify(d.data));const inner=data.data&&typeof data.data==='object'&&!Array.isArray(data.data)&&data.data.name!=null?data.data:data;
    inner.vault=fn(vaultOf(inner).map(x=>Object.assign({},x)))||vaultOf(inner);
    /* 보관소에서 뺀 카드가 칸에 있고 공통 카드가 아니면 칸도 비운다 (제작기와 같은 규칙) */
    if(inner.sk3&&typeof inner.sk3==='object'){const D=db();const keep=new Set(inner.vault.map(x=>x.n));for(const k of Object.keys(inner.sk3)){const n=inner.sk3[k];const r=D&&D.get(n);if(n&&!keep.has(n)&&!(r&&r[0]===COMMON))delete inner.sk3[k]}}
    await S().makerPut('trainers',tid,data);mk=' · 제작기 시트에도'}else mk=' (제작기 시트에는 없는 트레이너 — 방 시트에만)'}catch(e){mk=' (제작기 시트에는 못 썼다: '+e.message+')'}
  A().toast(what+mk);try{A().renderScene()}catch(e){}}
 async function take(tid,i){const tr=(((A().ST.state.roster||{}).trainers)||{})[tid];const v=vaultOf(tr)[i];if(!v)return;
  const b=document.querySelector(`[data-sk3del="${i}"][data-tid="${CSS.escape(tid)}"]`);if(b&&!b.dataset.arm){b.dataset.arm='1';b.textContent='빼기?';b.classList.add('warn');setTimeout(()=>{if(b.isConnected){delete b.dataset.arm;b.textContent='✕';b.classList.remove('warn')}},2500);return}
  await write(tid,L=>L.filter(x=>x.n!==v.n),`「${v.n}」 을(를) ${tr.name||'트레이너'}의 보관소에서 뺐다`)}
 /* GM 카드 건네주기 창: 검색 · 종류 · 덱 거르기 → 카드를 누르고 얻은 곳을 적어 건넨다 */
 const G={q:'',k:'',deck:'',sel:'',src:'',all:false};   /* 11-04: 건네주기 = 특수 카드 — 공통 · 광기는 「공통 카드도」를 켰을 때만 */
 function give(tid){if(A().ST.role!=='gm')return A().toast('GM 만 건넬 수 있다');const tr=(((A().ST.state.roster||{}).trainers)||{})[tid];if(!tr)return;
  G.sel='';G.src='';const D=db();
  const draw=()=>{const m=document.getElementById('sk3Give');if(!m)return;const D2=db();const have=new Set(vaultOf((((A().ST.state.roster||{}).trainers)||{})[tid]).map(x=>x.n));
   const rows=D2?[...D2.values()].filter(r=>r&&r[1]):[];const decks=[...new Set(rows.map(r=>String(r[0]||'')).filter(Boolean))];
   const q=G.q.trim().toLowerCase();const L=rows.filter(r=>(G.all||(String(r[0]||'')!==COMMON&&!/광기/.test(String(r[0]||''))&&kinds(r).length))&&(!G.k||kinds(r).includes(G.k))&&(!G.deck||String(r[0]||'')===G.deck)&&(!q||(String(r[1])+' '+String(r[4]||'')).toLowerCase().includes(q)));
   m.querySelector('[data-gdecks]').innerHTML=`<option value="">덱 전부</option>${decks.map(d=>`<option ${d===G.deck?'selected':''}>${esc(d)}</option>`).join('')}`;
   m.querySelector('[data-glist]').innerHTML=!D2?'<p class="small dim">카드 DB 를 읽는 중…</p>':L.length?L.slice(0,120).map(r=>`<button type="button" class="sk3pk${G.sel===r[1]?' on':''}${have.has(r[1])?' has':''}" data-gpk="${esc(r[1])}" title="${esc(r[1])}${have.has(r[1])?' — 이미 보관소에 있다':''}">${card(r[1],{badge:have.has(r[1])?'있음':''})}</button>`).join(''):`<p class="small dim">${G.all?'맞는 카드가 없다':'특수 카드가 없다 — 제작기 카드 DB 에 덱 「은열쇠 · 특수」 카드를 만들거나(트레이너 시트 「＋ 특수 카드」 → 새로 만들기), 「공통 카드도」를 켠다'}</p>`;
   const go=m.querySelector('[data-ggo]');go.disabled=!G.sel||have.has(G.sel);go.textContent=G.sel?(have.has(G.sel)?`「${G.sel}」 이미 있다`:`「${G.sel}」 건네주기`):'카드를 고르세요';
   m.querySelectorAll('[data-gpk]').forEach(b=>b.onclick=()=>{G.sel=b.dataset.gpk;draw()})};
  A().openModal(`<div id="sk3Give"><div class="mhead"><h2>🎁 카드 건네주기 — ${esc(tr.name||'')}</h2><span class="sp"></span><button class="btn ghost" data-gx>닫기</button></div>
   <div class="mbody"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:end"><label class="small">찾기<input type="text" data-gq placeholder="이름 · 효과" value="${esc(G.q)}" style="width:160px"></label>
    <label class="small">종류<select data-gk><option value="">전부</option>${SK3.slice(0,3).map(([k,l])=>`<option value="${k}" ${G.k===k?'selected':''}>${l}</option>`).join('')}</select></label>
    <label class="small">덱<select data-gdecks></select></label><label class="small row" style="gap:4px"><input type="checkbox" data-gall> 공통 카드도</label></div>
    <div class="sk3pg" data-glist></div>
    <label class="small" style="display:block;margin-top:10px">얻은 곳 <input type="text" data-gsrc placeholder="예: 3화 인질 구출 보상 · 레오노라 호감도 3" style="width:100%"></label>
    <p class="small dim" style="margin:6px 0 0">건넨 카드는 이 방 시트와 제작기 트레이너 시트의 「카드 보관소」에 들어간다. 어느 칸에 넣을지는 PL 이 제작기에서 고른다.</p></div>
   <div class="mfoot"><span class="sp"></span><button class="btn ghost" data-gx>취소</button><button class="btn pri" data-ggo disabled>카드를 고르세요</button></div></div>`);
  {const md=document.querySelector('.modalbg .modal');if(md)md.classList.add('wide')}
  const m=document.getElementById('sk3Give');if(!m)return;
  m.querySelectorAll('[data-gx]').forEach(b=>b.onclick=()=>A().closeModal());
  const qi=m.querySelector('[data-gq]');qi.oninput=()=>{G.q=qi.value;draw()};
  const ki=m.querySelector('[data-gk]');ki.onchange=()=>{G.k=ki.value;draw()};
  m.querySelector('[data-gdecks]').onchange=e=>{G.deck=e.target.value;draw()};
  {const ga=m.querySelector('[data-gall]');ga.checked=G.all;ga.onchange=()=>{G.all=ga.checked;draw()}}
  m.querySelector('[data-ggo]').onclick=async()=>{const n=G.sel;if(!n)return;const src=m.querySelector('[data-gsrc]').value.trim().slice(0,80);A().closeModal();
   const at=new Date(Date.now()+9*3600e3).toISOString().slice(0,10);
   await write(tid,L=>L.some(x=>x.n===n)?null:L.concat([{n,src,at}]),`「${n}」 을(를) ${tr.name||'트레이너'}에게 건넸다`)};
  draw();if(!D){const iv=setInterval(()=>{if(!document.getElementById('sk3Give')){clearInterval(iv);return}if(DB){clearInterval(iv);draw()}},300)}}
 return {sec,bind,give,db,big,cardHtml:card}})();
