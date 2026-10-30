/* ---------- 세션 노트 연동 (10-26 망령) ----------
   세션 노트(mangketmon-notes · 같은 Supabase 의 nt_* 표)에서 지도(장소 · 루트)와 관계도(인물 · 조직 · 관계)를 이 방으로 가져온다.
   공개(모두) 문서는 그냥 읽고, 세션 노트 GM 비밀구를 적으면 GM만 문서까지 읽는다. 가져온 것은 이 방의 것이 되어 따로 바뀐다(실시간 연동 아님).
   10-29 망령: 방 ↔ 캠페인 잇기. 이 방의 rp.notes = {camp, name} 이거나, 세션 노트 캠페인 설정의 「웹툴 방」(nt_camp.data.om.room)이 이 방이면 이어진 것.
   이어져 있으면 캠페인을 다시 묻지 않고, 세션 노트와 주소(mangryoung.github.io)가 같아 이 브라우저에 남은 세션 노트 GM 비밀구(nt_sec_<캠페인>)를 그대로 쓴다.
   세션 노트 시트의 「⚔ 웹툴로」 는 #r=<방>&add=<트레이너 id,…> 로 열리고, GM 이면 그 트레이너를 제작기에서 이 방 명단으로 가져온다. */
"use strict";
window.OM_NOTES=(()=>{
 const A=()=>window.OM_APP,S=()=>window.OM_STORE;const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const NOTES_URL=(window.OM_CONFIG&&OM_CONFIG.notesUrl)||'https://mangryoung.github.io/mangketmon-notes/';
 /* 캠페인 고르기 → {camp, secret, docs(kinds)} */
 const hp=()=>{const o={};location.hash.replace(/^#/,'').split('&').forEach(kv=>{const [k,v]=kv.split('=');if(k)o[decodeURIComponent(k)]=decodeURIComponent(v||'')});return o};
 /* 10-29 망령 「세션 노트랑 웹툴 로그인 체계를 같게」: 노트 비밀구가 없으면 웹툴 계정('u:'+로그인 표)으로 — 노트도 같은 계정 · 캠페인 권한을 쓴다 (노트 supabase/patch_2026-10-29_계정.sql) */
 const secOf=camp=>{try{const s=localStorage.getItem('nt_sec_'+camp);if(s)return s;const a=JSON.parse(localStorage.getItem('om_acct')||sessionStorage.getItem('om_acct')||'null');return a&&a.token?'u:'+a.token:''}catch(e){return ''}};
 const LINK={room:'',camp:null,camps:null};
 /* 이 방과 이어진 세션 노트 캠페인 {id,name,data} | null */
 async function linked(force){const room=A().ST.room;if(!force&&LINK.room===room&&LINK.camps)return LINK.camp;
  let camps=[];try{camps=await S().ntCamps()}catch(e){return null}const st=(A().ST.state.rp||{}).notes;
  const c=(st&&st.camp&&camps.find(x=>x.id===st.camp))||camps.find(x=>((x.data||{}).om||{}).room===room)||null;
  LINK.room=room;LINK.camps=camps;LINK.camp=c?{id:c.id,name:c.name,data:c.data||{}}:null;topBtn();return LINK.camp}
 const notesLink=camp=>NOTES_URL.replace(/[?#].*$/,'')+'?c='+encodeURIComponent(camp)+'#c='+encodeURIComponent(camp);
 /* 잇기: 방 쪽(rp.notes)에 적고, 세션 노트 GM 비밀구가 있으면 캠페인 쪽(data.om.room)에도 적는다 */
 async function linkTo(camp,secret){const c=(LINK.camps||[]).find(x=>x.id===camp);if(!c)return;await A().set(['rp','notes'],{camp,name:c.name||''});
  const sec=secret||secOf(camp);if(sec&&S().ntCampUpdate){try{const d=Object.assign({},c.data||{});d.om=Object.assign({},d.om||{},{room:A().ST.room});await S().ntCampUpdate(camp,sec,d);c.data=d}catch(e){console.warn('nt link',e)}}
  LINK.camp={id:c.id,name:c.name,data:c.data||{}};topBtn();A().sysLog(`세션 노트: 「${c.name}」 캠페인과 이었다`)}
 async function unlink(){await A().set(['rp','notes'],null);const L=LINK.camp;if(L){const sec=secOf(L.id);if(sec&&S().ntCampUpdate&&((L.data||{}).om||{}).room===A().ST.room){try{const d=Object.assign({},L.data);delete d.om;await S().ntCampUpdate(L.id,sec,d)}catch(e){}}}LINK.camp=null;LINK.camps=null;topBtn();A().toast('세션 노트 잇기를 풀었다')}
 /* 위 막대 「📓 노트」 단추: 이어져 있으면 캠페인 이름 */
 function topBtn(){const b=document.getElementById('ntBtn');if(!b)return;const L=LINK.room===A().ST.room?LINK.camp:null;b.textContent=L?'📓 '+(L.name||'노트'):'📓 노트';b.title=L?`세션 노트 「${L.name}」 — 열기 · 지도/관계도 가져오기`:'세션 노트와 잇기';b.classList.toggle('on',!!L)}
 async function menu(){const L=await linked(true);const gm=A().ST.role==='gm';
  if(!L&&!gm){A().toast('이 방은 세션 노트와 이어져 있지 않다');return}
  const md=A().openModal(`<div class="mhead"><h2>📓 세션 노트</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   ${L?`<p style="margin-top:0">이 방은 세션 노트의 <b>「${esc(L.name)}」</b> 캠페인과 이어져 있다.</p><div class="row" style="gap:6px;flex-wrap:wrap"><a class="btn pri" href="${esc(notesLink(L.id))}" target="mangketmon-notes" rel="noopener">세션 노트 열기 ↗</a>${gm?'<button class="btn" data-nt="map">지도 가져오기</button><button class="btn" data-nt="graph">관계도 가져오기</button><button class="btn" data-nt="dg">⛩ 던전 주고받기</button>':''}</div>${gm?`<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px"><span class="small dim" style="align-self:center">노트로 보내기</span><button class="btn sm" data-nt="mappush" title="노트에서 가져온 지도의 핀 중 옮기거나 이름 · 배경을 바꾼 것 · 새로 찍은 것만">📍 지도 핀</button>${(()=>{const s=srcOf(curMapS());return s&&s.camp===L.id?`<button class="btn sm ${curMapS().live==1?'pri':''}" data-nt="live" title="켜 두면 장소 핀 · 루트 · 인물 배치 · PC 위치가 노트 지도와 서로 따라간다 (GM 이 이 방을 열어 둔 동안)">🔗 지도 연동 ${curMapS().live==1?'켬':'끔'}</button>`:''})()}<button class="btn sm" data-nt="logpush" title="오늘 이 방 로그를 노트 「기록」에 (지난번 보낸 뒤만 · 귓속말 · 잡담 빼고)">📜 오늘 로그</button></div>`:''}
    ${gm?`<p class="small dim" style="margin-top:10px">${secOf(L.id)?'이 브라우저의 세션 노트 권한(계정 또는 GM 비밀구)으로 가져온다 — 노트에서 GM 이면 「GM만」 문서까지.':'이 브라우저에는 세션 노트 GM 비밀구가 없어 「모두」로 공개된 것만 가져온다. 세션 노트를 GM 으로 한 번 열면 다음부터 같이 쓴다.'}</p><div class="row" style="gap:6px;margin-top:6px"><button class="btn sm ghost" data-nt="other">다른 캠페인과 잇기</button><button class="btn sm ghost" data-nt="unlink">잇기 풀기</button></div>`:''}`
   :`<p style="margin-top:0">세션 노트 캠페인과 이으면, 지도 · 관계도를 캠페인을 다시 고르지 않고 한 번에 가져오고, 세션 노트 시트에서 「⚔ 웹툴로」 를 누르면 이 방으로 트레이너를 보낸다.</p><div class="row"><button class="btn pri" data-nt="other">캠페인 고르기</button></div>`}`);
  md.querySelectorAll('[data-nt]').forEach(b=>b.onclick=async()=>{const k=b.dataset.nt;A().closeModal();if(k==='map')return importMap();if(k==='graph')return importGraph();if(k==='dg')return dgPanel();if(k==='mappush')return mapPush();if(k==='logpush')return logPush();if(k==='live')return liveSet(curMapS().live!=1);if(k==='unlink')return unlink();
   if(k==='other'){const r=await pick([],'',{ask:true,linkOnly:true});if(r)A().toast(`「${r.campName}」 캠페인과 이었다`)}})}
 /* 세션 노트에서 보낸 트레이너 가져오기 (#…&add=t1,t2) — openRoom 끝에서 부른다 */
 async function afterOpen(){const p=hp();linked(true);
  /* 10-30 세션 노트 지도의 「🗺 웹툴로 · 연동」 (#…&map=<노트 지도 id>) — GM 이면 가져와서 연동을 켠다 */
  if(p.map){try{history.replaceState(null,'',location.pathname+location.search+'#'+Object.entries(p).filter(([k])=>k!=='map').map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&'))}catch(e){}
   if(A().ST.role!=='gm')A().toast('세션 노트에서 보낸 지도는 GM 만 가져올 수 있다');else{const L=await linked(true);if(!L)A().toast('먼저 📓 노트 메뉴에서 이 방을 세션 노트 캠페인과 이어 줘');else{const s=srcOf(curMapS());if(s&&s.camp===L.id&&s.mapId===p.map){if(curMapS().live!=1)await liveSet(true);else A().toast('이미 이 지도와 연동 중이다');}else await importMap({mapId:p.map,live:true});try{A().goView('rp')}catch(e){}}}
   if(!p.add&&!p.dg)return}
  if(!p.add&&!p.dg)return;const ids=String(p.add||'').split(',').map(x=>x.trim()).filter(Boolean);
  try{history.replaceState(null,'',location.pathname+location.search+'#'+Object.entries(p).filter(([k])=>k!=='add'&&k!=='dg').map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&'))}catch(e){}
  /* 10-29 세션 노트 던전의 「🎲 웹툴로」 (#…&dg=<노트 던전 id>) */
  if(p.dg){if(A().ST.role!=='gm')A().toast('세션 노트에서 보낸 던전은 GM 만 가져올 수 있다');else{await linked(true);const id=await dgPull(p.dg);if(id){try{A().goView('dungeon')}catch(e){}}}if(!ids.length)return}
  if(A().ST.role!=='gm'){if(ids.length)A().toast('세션 노트에서 보낸 트레이너는 GM 만 가져올 수 있다');return}
  const R=(A().ST.state.roster||{}).trainers||{};const fresh=ids.filter(id=>!Object.values(R).some(t=>t.id===id||t.mkId===id));
  if(!confirm(`세션 노트에서 트레이너 ${ids.length}명을 보냈다.\n제작기에서 지금 값으로 이 방 명단에 가져올까?${ids.length-fresh.length?`\n(이미 있는 ${ids.length-fresh.length}명은 새 값으로 덮어쓴다 · HP·랭크·메모는 새로 시작)`:''}`))return;
  const SU=window.OM_SHEET_UI;if(!SU||!SU.importTrainer)return A().toast('시트 화면이 아직 준비되지 않았다 — 새로 고친 뒤 다시');let n=0;
  for(const id of ids){try{const mk=await (A().loadMakerParty?A().loadMakerParty(id):A().loadMaker(true));const tdoc=mk.trainers.find(t=>t.id===id);if(!tdoc){A().toast('제작기에서 못 찾았다: '+id);continue}await SU.importTrainer(tdoc,mk.pokemon,false,'');n++}catch(e){A().toast('가져오지 못했다: '+(e.message||e))}}
  if(n){A().sysLog(`세션 노트에서 트레이너 ${n}명을 가져왔다`);A().toast(`트레이너 ${n}명을 가져왔다`);A().renderScene();
   /* 10-30 망령 「덱은 가져오는거 개선할 방법 없어?」: 가져온 트레이너에게 제작기 덱이 있으면 휴대폰 「📥 제작기 덱 가져오기」까지 이어서 한다 (다시 해도 카드 · 장수만 맞춘다) */
   const DU=window.OM_DECK_UI;if(DU&&DU.importMakerDecks){await new Promise(r=>setTimeout(r,800));const R2=(A().ST.state.roster||{}).trainers||{};if(Object.values(R2).some(t=>t&&(ids.includes(t.id)||ids.includes(t.mkId))&&Array.isArray(t.deck)&&t.deck.length)){try{await DU.importMakerDecks()}catch(e){A().toast('덱은 못 가져왔다: '+(e.message||e))}}}}}
 async function pick(kinds,what,opt){opt=opt||{};
  /* 이어진 캠페인이 있으면 묻지 않는다 */
  if(!opt.ask){const L=await linked();if(L){const secret=secOf(L.id);A().toast(`세션 노트 「${L.name}」에서 읽는 중…`);try{const docs=await S().ntDocs(L.id,secret||null,kinds);return {camp:L.id,secret,docs,campName:L.name}}catch(e){A().toast('못 읽었다: '+e.message);return null}}}
  let camps=[];try{camps=await S().ntCamps()}catch(e){A().toast('세션 노트 표를 못 읽었다: '+e.message+' (schema.sql 을 아직 안 돌렸나?)');return null}
  if(!camps.length){A().toast('세션 노트에 캠페인이 없다');return null}
  const last=(()=>{try{return localStorage.getItem('om_nt_camp')||''}catch(e){return ''}})();
  return new Promise(res=>{const md=A().openModal(`<div class="mhead"><h2>${opt.linkOnly?'세션 노트 캠페인과 잇기':`세션 노트에서 ${esc(what)} 가져오기`}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <label class="lbl">캠페인<select id="ntC">${camps.map(c=>`<option value="${esc(c.id)}" ${c.id===last?'selected':''}>${esc(c.name)}${c.data&&c.data.sub?' · '+esc(c.data.sub):''}</option>`).join('')}</select></label>
   <label class="lbl" style="margin-top:8px">세션 노트 GM 비밀구 <small class="dim">(비우면 「모두」로 공개된 것만 가져온다 · 이 브라우저에 있으면 저절로 채운다)</small><input id="ntS" type="password" autocomplete="off"></label>
   ${A().ST.role==='gm'?`<label class="chk" style="margin-top:8px;display:flex;gap:6px;align-items:center"><input type="checkbox" id="ntLk" checked> 이 방을 이 캠페인과 잇기 (다음부터 묻지 않는다)</label>`:''}
   <p class="small dim" style="margin-top:8px">가져온 것은 이 방의 것이 되어 세션 노트와 따로 바뀐다. 세션 노트: <a href="${esc(NOTES_URL)}" target="_blank" rel="noopener">${esc(NOTES_URL)}</a></p>
   <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn pri" id="ntOk">${opt.linkOnly?'잇기':'가져오기'}</button></div>`);
   const cs=md.querySelector('#ntC'),si=md.querySelector('#ntS');const fill=()=>{si.value=secOf(cs.value)};fill();cs.onchange=fill;
   md.parentElement.addEventListener('click',e=>{if(e.target===md.parentElement||e.target.closest('[data-x]'))res(null)});
   md.querySelector('#ntOk').onclick=async()=>{const camp=md.querySelector('#ntC').value,secret=md.querySelector('#ntS').value.trim();try{localStorage.setItem('om_nt_camp',camp)}catch(e){}
    const lk=md.querySelector('#ntLk');if((lk&&lk.checked)||opt.linkOnly){LINK.camps=camps;LINK.room=A().ST.room;try{await linkTo(camp,secret)}catch(e){A().toast('잇지 못했다: '+e.message)}}
    if(opt.linkOnly){A().closeModal();res({camp,secret,docs:[],campName:(camps.find(c=>c.id===camp)||{}).name});return}
    A().toast('세션 노트에서 읽는 중…');try{const docs=await S().ntDocs(camp,secret||null,kinds);A().closeModal();res({camp,secret,docs,campName:(camps.find(c=>c.id===camp)||{}).name})}catch(e){A().toast('못 읽었다: '+e.message+(secret?' (비밀구가 틀렸나?)':''));res(null)}}})}
 const byKind=(docs,k)=>docs.filter(d=>d.kind===k).map(d=>Object.assign({id:d.id,_vis:d.vis},d.data));
 /* 지도: maps(첫 지도 또는 고른 지도) → rp.map.img, spots → locs(픽셀), routes.steps → routes(seq) */
 async function importMap(opt){opt=opt||{};const r=await pick(['maps','spots','routes'],'지도');if(!r)return;const maps=byKind(r.docs,'maps').sort((a,b)=>(a.order||0)-(b.order||0));if(!maps.length)return A().toast('가져올 지도가 없다 (지도 문서가 공개돼 있지 않거나 비었다)');
  let m=maps[0];if(opt.mapId){m=maps.find(x=>x.id===opt.mapId);if(!m)return A().toast('세션 노트에서 보낸 지도를 찾지 못했다 (GM 만 보이는 지도라면 노트를 GM 으로 한 번 열어 줘)')}else if(maps.length>1){const i=prompt('어느 지도? 번호를 적어\n'+maps.map((x,i)=>`${i+1}. ${x.name}`).join('\n'),'1');if(i==null)return;m=maps[Math.max(0,Math.min(maps.length-1,(+i||1)-1))]}
  const W=+m.w||1000,H=+m.h||700;const spots=byKind(r.docs,'spots').filter(s=>s.map===m.id).sort((a,b)=>String(a.num||'').localeCompare(String(b.num||''),'ko',{numeric:true}));
  /* 10-30: 같은 노트 장소(nt)였던 핀의 던전 연결 · 배경은 남기고, 노트 장소에 「웹툴 배경」(bg)이 있으면 그걸 쓴다 */const oldBy={};(((A().ST.state.rp||{}).map||{}).locs||[]).forEach(l=>{if(l&&l.nt)oldBy[l.nt]=l});
  const locs=spots.map((s,i)=>{const o=oldBy[s.id]||{};const L={n:i+1,name:s.name||('장소 '+(i+1)),x:Math.round((+s.x||0)/100*W),y:Math.round((+s.y||0)/100*H),nt:s.id};if(o.dg)L.dg=o.dg;const bg=s.bg?{src:String(s.bg),name:s.bgName||s.name||''}:(o.bg&&o.bg.src?o.bg:null);if(bg)L.bg=bg;return L});const nOf=id=>{const l=locs.find(x=>x.nt===id);return l?l.n:0};
  const routes=byKind(r.docs,'routes').filter(rt=>(rt.steps||[]).some(st=>st.spot&&nOf(st.spot))).map((rt,i)=>({rid:'nt_'+rt.id,name:rt.name||('루트 '+(i+1)),color:rt.color||'#e4002b',seq:(rt.steps||[]).map(st=>nOf(st.spot)).filter(Boolean),vis:rt.visible!==false&&rt._vis==='pub'?1:0}));
  const vis={};spots.forEach((s,i)=>{if(s._vis!=='pub')vis[i+1]=1});
  if(!confirm(`「${r.campName}」의 지도 「${m.name}」를 가져올까?\n장소 ${locs.length}곳 · 루트 ${routes.length}개${m.img?' · 지도 그림':''}${locs.some(l=>l.bg)?` · 장소 배경 ${locs.filter(l=>l.bg).length}곳`:''}\n(이 방의 지도 핀·루트는 바뀐다. 인물(npcs)과 파티 위치는 남긴다)${opt.live?'\n\n가져온 뒤 「지도 연동」을 켠다 — 장소 핀 · 루트 · 인물 배치 · PC 위치가 노트와 서로 따라간다 (GM 이 이 방을 열어 둔 동안)':''}`))return;
  const cur=(A().ST.state.rp||{}).map||{};const patch=Object.assign({},cur,{locs,routes,vis,party:{n:0,vis:1},npcs:(cur.npcs||[]).filter(n=>locs.some(l=>l.n===n.n)),preset:m.img?'':cur.preset,src:'nt:'+r.camp+'/'+m.id,ntK:{r:routes.map(x=>x.rid),p:[],l:locs.map(l=>l.nt)},hideR:{},hideL:{}});if(opt.live)patch.live=1;
  if(m.img)patch.img={src:m.img,w:W,h:H};/* 10-29 바뀐 칸만 쓴다 */const ops=A().diffOps(['rp','map'],cur,patch,1);if(!ops.length){A().toast('노트 지도와 같다 — 바뀐 게 없다');return}await A().setMany(ops);A().sysLog(`지도: 세션 노트 「${r.campName}」에서 가져옴 (장소 ${locs.length} · 루트 ${routes.length})`);A().toast(opt.live?'지도를 가져오고 연동을 켰다':'지도를 가져왔다');A().renderScene();if(opt.live){LV.camp='';LV.last=null}}
 /* 관계도: ents(인물 · 조직) → graph.nodes(npc/org, 얼굴 사진), rels → edges */
 async function importGraph(){const r=await pick(['ents','rels'],'관계도');if(!r)return;const ents=byKind(r.docs,'ents').filter(e=>['인물','조직'].includes(e.type));if(!ents.length)return A().toast('가져올 인물 · 조직이 없다');
  const g=A().ST.state.graph||{nodes:{},edges:{}};const nodes=g.nodes||{},edges=g.edges||{};const byName={};for(const [id,n] of Object.entries(nodes))byName[n.name]=id;
  let add=0,upd=0;const ops=[];const idOf={};
  const xs=ents.map(e=>+e.gx).filter(Number.isFinite),ys=ents.map(e=>+e.gy).filter(Number.isFinite);const cx=xs.length?(Math.min(...xs)+Math.max(...xs))/2:800,cy=ys.length?(Math.min(...ys)+Math.max(...ys))/2:500;
  ents.forEach((e,i)=>{const kind=e.type==='조직'?'org':'npc';const ex=byName[e.title];const id=ex||('nt'+e.id.replace(/[^a-z0-9]/gi,'').slice(0,10)+Math.random().toString(36).slice(2,5));idOf[e.id]=id;
   const x=Number.isFinite(+e.gx)?Math.round((+e.gx-cx)*.9):Math.round(Math.cos(i/ents.length*6.283)*320),y=Number.isFinite(+e.gy)?Math.round((+e.gy-cy)*.9):Math.round(Math.sin(i/ents.length*6.283)*320);
   const base=ex?nodes[ex]:{id,x,y};const nn=Object.assign({},base,{name:e.title||'?',kind:base.kind==='pc'?'pc':kind,img:e.face||e.photo||base.img||'',note:[e.sub,e.body].filter(Boolean).join('\n').slice(0,600)||base.note||'',nt:e.id});
   if(e.color)nn.color=e.color;/* 10-29 바뀐 칸만 */if(ex){const d=A().diffOps(['graph','nodes',id],base,nn,1);if(d.length){upd++;ops.push(...d)}}else{add++;ops.push([['graph','nodes',id],nn])}});
  const rels=byKind(r.docs,'rels').filter(q=>idOf[q.a]&&idOf[q.b]);const has=new Set(Object.values(edges).map(x=>x.a+'|'+x.b).concat(Object.values(edges).map(x=>x.b+'|'+x.a)));let ae=0;
  for(const q of rels){const a=idOf[q.a],b=idOf[q.b];if(has.has(a+'|'+b))continue;has.add(a+'|'+b);ae++;ops.push([['graph','edges','nt'+Math.random().toString(36).slice(2,9)],{a,b,rank:q.kind==='love'?3:q.kind==='ally'?2:q.kind==='rival'?1:1,label:q.label||'',shock:0,nt:q.id}])}
  if(!add&&!upd&&!ae){A().toast('노트 관계도와 같다 — 바뀐 게 없다');return}
  if(!confirm(`「${r.campName}」의 관계도를 가져올까?\n새 인물 · 조직 ${add}명 · 이미 있는 ${upd}명은 바뀐 칸만 덧씌움 · 새 관계선 ${ae}개\n(이 방에 이미 있는 노드와 선은 지우지 않는다)`))return;
  A().toast('가져오는 중…');await A().setMany(ops);A().sysLog(`관계도: 세션 노트 「${r.campName}」에서 가져옴 (${add+upd}명 · 선 ${ae}개)`);A().toast('관계도를 가져왔다');A().renderScene()}
 /* ---------- 10-29 망령 「웹툴과 노트는 양방향으로 · 보내기 불러오기는 변동 사항만」 ----------
    던전: 노트 문서 kind 'dgs' ↔ 이 방 dg.list. 받은 던전에는 nt(노트 id) · ntC(캠페인) · ntAt(노트의 updated_at) · ntH(받은/보낸 때의 내용 지문)을 적어 둔다.
      노트 → 웹툴: ntAt 이 같으면 아무것도 안 쓴다. 다르면 바뀐 방 · 칸만 쓰고(setDiff) 플레이 기록(경계도 · 위치 · 탐색)은 남긴다.
      웹툴 → 노트: 지문(ntH)이 같으면 안 보낸다. 노트 몫(장소 · 판 그림 · 숨긴 방)은 그대로 두고 던전 문서 하나만 쓴다.
      양쪽 다 고쳤으면 덮어쓰기 전에 묻는다.
    지도 핀: 노트에서 가져온 지도의 핀 중 옮기거나 이름을 바꾼 것 · 새로 찍은 것만 노트 장소로 쓴다 (지운 핀은 노트에서 지우지 않는다).
    로그: 오늘 이 방 로그를 노트 「기록」 문서 하나(lg_om_<방>_<날짜>)에 쌓는다. 다음에는 지난번 마지막 줄 뒤만 덧붙인다 (귓속말 · 잡담 빼고). */
 const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().filter(k=>v[k]!==undefined&&v[k]!==null).map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
 const hsh=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)+'.'+s.length.toString(36)};
 const DGTOP=['n','st','o','a','wn','noal'],DGR=['n','t','x','y','m','b','sk','rk','rmany','cl','e','eh'],DGMETA=['r','l','nt','ntC','ntAt','ntH'];
 function dgCore(d){const o={};for(const k of DGTOP)if(d[k]!=null&&d[k]!=='')o[k]=d[k];o.r={};for(const [id,x] of Object.entries(d.r||{})){const q={};for(const k of DGR)if(x[k]!=null&&x[k]!=='')q[k]=x[k];o.r[id]=q}o.l={};for(const k of Object.keys(d.l||{}))o.l[k.split('~').sort().join('~')]=1;return o}
 const dgH=d=>hsh(stable(dgCore(d)));
 const DGU=()=>window.OM_DG_UI;
 async function ctx(needSecret){const L=await linked();if(!L){A().toast('먼저 📓 노트 메뉴에서 세션 노트 캠페인과 이어 줘');return null}const secret=secOf(L.id);
  if(needSecret&&!secret){A().toast('이 브라우저에 세션 노트 GM 비밀구가 없다 — 세션 노트를 GM 으로 한 번 열어 줘');return null}return {camp:L.id,secret,name:L.name}}
 function dgFromNotes(nd){const d=nd.data||{};const r={};for(const [id,x] of Object.entries(d.r||{})){const o={};for(const k of DGR)if(x[k]!=null&&x[k]!=='')o[k]=x[k];r[id]=o}
  const o={n:d.n||'',st:d.st,r,l:Object.assign({},d.l||{})};for(const k of ['o','a','wn','noal'])if(d[k]!=null&&d[k]!=='')o[k]=d[k];if(d.src&&d.src.tier)o.gen={tier:d.src.tier,seed:d.src.seed,theme:d.src.theme};return o}
 /* 노트 → 웹툴 (던전 하나) */
 async function dgPull(ntId,o){o=o||{};if(A().ST.role!=='gm'){A().toast('던전은 GM 만 가져올 수 있다');return}const c=await ctx(false);if(!c)return;const U=DGU();if(!U||!U.dgNorm){A().toast('던전 탭이 아직 준비되지 않았다 — 새로 고친 뒤 다시');return}
  let nd=o.nd||null;if(!nd){try{nd=await S().ntGet(c.camp,c.secret||null,'dgs',ntId)}catch(e){A().toast('노트 던전을 못 읽었다: '+e.message);return}}
  if(!nd){A().toast('노트에서 그 던전을 찾지 못했다 (GM만 던전이면 세션 노트를 GM 으로 한 번 열어 줘)');return}
  const list=U.dgAll();const exId=Object.keys(list).find(k=>list[k].nt===ntId&&list[k].ntC===c.camp);const ex=exId?list[exId]:null;
  if(ex&&ex.ntAt===nd.updated_at){if(!o.quiet)A().toast(`「${ex.n}」 는 노트와 같다 — 바뀐 게 없다`);return exId}
  if(ex&&ex.ntH&&dgH(ex)!==ex.ntH&&!confirm(`「${ex.n}」 를 웹툴에서도 고쳤다.\n노트 판으로 덮어쓸까? (웹툴에서 고친 방 · 통로는 노트 판으로 바뀐다)`))return;
  const warn=[];let d;try{d=U.dgNorm(dgFromNotes(nd),warn)}catch(e){A().toast('던전을 읽지 못했다: '+e.message);return}
  const id=exId||Math.random().toString(36).slice(2,8);
  if(ex){/* 플레이 기록(경계도 · 위치 · 탐색 · 클리어 등)은 남긴다 */if(ex.al!=null)d.al=ex.al;for(const k of Object.keys(ex))if(!(k in d)&&!DGTOP.includes(k)&&!DGMETA.includes(k))d[k]=ex[k];
   for(const [rid,x] of Object.entries(d.r)){const old=(ex.r||{})[rid];if(old)for(const k of Object.keys(old))if(!DGR.includes(k))x[k]=old[k]}if(d.at&&!d.r[d.at])delete d.at}
  d.nt=ntId;d.ntC=c.camp;d.ntAt=nd.updated_at;d.ntH=dgH(d);
  const ops=ex?A().diffOps(['dg','list',id],ex,d,3):[[['dg','list',id],d]];if(ops.length){const ok=await A().setMany(ops);if(ok===false)return}
  A().sysLog(`던전: 세션 노트에서 「${d.n}」 ${ex?'바뀐 것만 다시 받음':'가져옴'}`);if(!o.quiet)A().toast(ex?`「${d.n}」 의 바뀐 곳 ${ops.length}군데를 받았다`:`「${d.n}」 를 던전 탭에 넣었다`);if(warn.length)console.warn('dg import',warn);
  try{U.edOpen(id)}catch(e){}A().renderScene();return id}
 /* 웹툴 → 노트 (던전 하나) */
 async function dgPush(id,o){o=o||{};const c=await ctx(true);if(!c)return;const U=DGU();const d=U.dgAll()[id];if(!d)return;
  const h=dgH(d);const mine=d.nt&&d.ntC===c.camp;if(mine&&d.ntH===h){if(!o.quiet)A().toast(`「${d.n}」 는 노트와 같다 — 보낼 게 없다`);return}
  let nd=null;if(mine){try{nd=await S().ntGet(c.camp,c.secret,'dgs',d.nt)}catch(e){}}
  if(nd&&d.ntAt&&nd.updated_at>d.ntAt&&!confirm(`노트에서도 「${d.n}」 를 고쳤다.\n웹툴 판으로 덮어쓸까? (노트에서 고친 방 이름 · 그림 · 메모는 웹툴 판으로 바뀐다)`))return;
  const core=dgCore(d);const data=Object.assign(nd?Object.assign({},nd.data):{spot:'',src:{from:'om',room:A().ST.room}},core);for(const k of DGTOP)if(core[k]==null)delete data[k];if(Array.isArray(data.hide))data.hide=data.hide.filter(x=>core.r[x]);
  const nid=nd?d.nt:'d'+Math.random().toString(36).slice(2,10);let at;
  try{at=await S().ntPut(c.camp,c.secret,'dgs',nid,data,nd?nd.vis:'gm')}catch(e){A().toast('노트에 쓰지 못했다: '+e.message);return}
  if(typeof at!=='string'){try{const x=await S().ntGet(c.camp,c.secret,'dgs',nid);at=x&&x.updated_at}catch(e){}}
  await A().setMany([[['dg','list',id,'nt'],nid],[['dg','list',id,'ntC'],c.camp],[['dg','list',id,'ntAt'],at||''],[['dg','list',id,'ntH'],h]]);
  A().sysLog(`던전: 「${d.n}」 를 세션 노트로 보냄`);if(!o.quiet)A().toast(nd?`「${d.n}」 를 노트로 보냈다`:`「${d.n}」 를 노트에 새로 넣었다 — 세션 노트 지도에서 장소에 붙여 줘`);return nid}
 /* 던전 주고받기 창: 노트 던전 · 이 방 던전을 나란히, 어느 쪽이 바뀌었는지 */
 async function dgPanel(){if(A().ST.role!=='gm')return A().toast('던전은 GM 만');const c=await ctx(false);if(!c)return;const U=DGU();if(!U||!U.dgAll)return A().toast('던전 탭이 아직 준비되지 않았다');
  A().toast('세션 노트 던전을 맞추는 중…');let docs=[];try{docs=await S().ntDocs(c.camp,c.secret||null,['dgs','spots'])}catch(e){return A().toast('못 읽었다: '+e.message)}
  const spots=Object.fromEntries(docs.filter(x=>x.kind==='spots').map(x=>[x.id,x.data||{}]));const nds=docs.filter(x=>x.kind==='dgs');const list=U.dgAll();const byNt={};for(const [id,d] of Object.entries(list))if(d.nt&&d.ntC===c.camp)byNt[d.nt]=id;
  const st=nd=>{const id=byNt[nd.id];if(!id)return ['웹툴에 없음','pull','가져오기'];const ex=list[id];const wt=ex.ntH&&dgH(ex)!==ex.ntH,nt=ex.ntAt!==nd.updated_at;
   return nt&&wt?['양쪽 다 고침','both','']:nt?['노트가 더 새것','pull','받기']:wt?['웹툴에서 고침','push','보내기']:['같음','','']};
  const rowsN=nds.map(nd=>{const [t,k,b]=st(nd);const d=nd.data||{};const sp=spots[d.spot];return `<div class="ntdg"><b>⛩ ${esc(d.n||'던전')}</b><small>${sp?'📍 '+esc(sp.name||''):'장소 없음'} · 방 ${Object.keys(d.r||{}).length}${nd.vis!=='pub'?' · GM만':''}</small><span class="ntst ${k}">${t}</span>${k==='both'?`<button class="btn sm" data-dgp="${esc(nd.id)}">노트 판 받기</button><button class="btn sm" data-dgs="${esc(byNt[nd.id])}">웹툴 판 보내기</button>`:k==='pull'?`<button class="btn sm pri" data-dgp="${esc(nd.id)}">${b}</button>`:k==='push'?`<button class="btn sm pri" data-dgs="${esc(byNt[nd.id])}">${b}</button>`:''}</div>`}).join('');
  const only=Object.entries(list).filter(([id,d])=>!(d.nt&&d.ntC===c.camp&&nds.some(x=>x.id===d.nt)));
  const rowsW=only.map(([id,d])=>`<div class="ntdg"><b>${esc(d.n||'던전')}</b><small>방 ${Object.keys(d.r||{}).length}${d.nt&&d.ntC===c.camp?' · 노트에서 지워짐':''}</small><span class="ntst push">노트에 없음</span>${c.secret?`<button class="btn sm" data-dgs="${esc(id)}">노트로 보내기</button>`:''}</div>`).join('');
  const md=A().openModal(`<div class="mhead"><h2>⛩ 던전 주고받기 · 「${esc(c.name)}」</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <p class="small dim" style="margin-top:0">바뀐 던전만 오간다. 받을 때 이 방의 플레이 기록(경계도 · 일행 위치 · 탐색한 방)은 그대로 남는다.${c.secret?'':' 이 브라우저에 세션 노트 GM 비밀구가 없어 공개 던전만 보이고 보내기는 안 된다.'}</p>
   <h3 style="margin:10px 0 4px">세션 노트의 던전</h3>${rowsN||'<div class="small dim">노트에 던전이 없다 — 세션 노트 지도에서 장소를 고르고 「＋ 던전」</div>'}
   ${rowsW?`<h3 style="margin:14px 0 4px">이 방에만 있는 던전</h3>${rowsW}`:''}
   <style>.ntdg{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.08)}.ntdg small{opacity:.7;flex:1 1 160px}.ntst{font-size:12px;padding:1px 8px;border:1px solid currentColor;border-radius:10px;opacity:.85}.ntst.pull{color:#59b6ff}.ntst.push{color:#ffd84a}.ntst.both{color:#ff7a2f}</style>`);
  md.addEventListener('click',async e=>{const p=e.target.closest('[data-dgp]'),s=e.target.closest('[data-dgs]');if(!p&&!s)return;e.target.disabled=true;
   if(p)await dgPull(p.dataset.dgp,{nd:nds.find(x=>x.id===p.dataset.dgp)});else await dgPush(s.dataset.dgs);A().closeModal();dgPanel()})}
 /* 지도 핀 → 노트 장소 (바뀐 것만) */
 async function mapPush(){const c=await ctx(true);if(!c)return;const mp=(A().ST.state.rp||{}).map||{};const m=String(mp.src||'').match(/^nt:([^/]+)\/(.+)$/);
  if(!m||m[1]!==c.camp)return A().toast('이 방 지도는 이 캠페인 노트에서 가져온 지도가 아니다 — 먼저 「지도 가져오기」');const mapId=m[2];
  let docs;try{docs=await S().ntDocs(c.camp,c.secret,['maps','spots'])}catch(e){return A().toast('못 읽었다: '+e.message)}
  const md=docs.find(x=>x.kind==='maps'&&x.id===mapId);if(!md)return A().toast('노트에서 그 지도를 찾지 못했다');const W=+md.data.w||1000,H=+md.data.h||700;
  const spots=Object.fromEntries(docs.filter(x=>x.kind==='spots').map(x=>[x.id,x]));const rows=[],fresh=[];let nMv=0,nRn=0,nBg=0;const absU=u=>{try{return new URL(u,location.href).href}catch(e){return u}};
  for(const l of mp.locs||[]){const x=+(l.x/W*100).toFixed(2),y=+(l.y/H*100).toFixed(2);
   if(l.nt&&spots[l.nt]){const s=spots[l.nt];const d=Object.assign({},s.data);let ch=false;if(Math.abs((+d.x||0)-x)>0.05||Math.abs((+d.y||0)-y)>0.05){d.x=x;d.y=y;ch=true;nMv++}if(l.name&&l.name!==d.name){d.name=l.name;ch=true;nRn++}/* 10-30 장소 배경도 */const lb=l.bg&&l.bg.src?absU(l.bg.src):'';if(lb&&lb!==(d.bg||'')){d.bg=lb;d.bgName=l.bg.name||'';ch=true;nBg++}if(ch)rows.push({kind:'spots',id:l.nt,data:d,vis:s.vis})}
   else if(!l.nt){const id='s'+Math.random().toString(36).slice(2,10);const nd={map:mapId,x,y,name:l.name||'장소',num:String(l.n||''),kind:'기타',area:'',summary:'',items:'',img:'',imgs:[]};if(l.bg&&l.bg.src){nd.bg=absU(l.bg.src);nd.bgName=l.bg.name||''}rows.push({kind:'spots',id,data:nd,vis:'pub'});fresh.push([l.n,id])}}
  if(!rows.length)return A().toast('노트 지도와 같다 — 보낼 게 없다');
  if(!confirm(`세션 노트 지도 「${md.data.name||''}」 로 보낼까?\n옮긴 핀 ${nMv} · 이름 바뀐 핀 ${nRn} · 배경 바뀐 핀 ${nBg} · 새 핀 ${fresh.length}\n(바뀐 장소만 쓴다 · 웹툴에서 지운 핀은 노트에서 지우지 않는다)`))return;
  try{await S().ntPutMany(c.camp,c.secret,rows)}catch(e){return A().toast('노트에 쓰지 못했다: '+e.message)}
  if(fresh.length){const locs=(mp.locs||[]).map(l=>{const h=fresh.find(q=>q[0]===l.n);return h?Object.assign({},l,{nt:h[1]}):l});await A().set(['rp','map','locs'],locs)}
  A().sysLog(`지도: 세션 노트로 핀 ${rows.length}개를 보냄`);A().toast(`노트로 보냈다 — 장소 ${rows.length}곳`)}
 /* 오늘 로그 → 노트 기록 (지난번 뒤만) */
 const ymd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 async function logPush(){const c=await ctx(true);if(!c)return;const room=A().ST.room;const rn=(A().ST.roomRow&&A().ST.roomRow.name)||room;const today=ymd(new Date());const id='lg_om_'+String(room).replace(/[^\w]/g,'').slice(0,12)+'_'+today.replace(/-/g,'');
  let ex=null;try{ex=await S().ntGet(c.camp,c.secret,'logs',id)}catch(e){}const last=ex&&ex.data&&ex.data.om?+ex.data.om.last||0:0;
  let rows=[];try{if(last){for(let after=last,i=0;i<20;i++){const r=await S().getLog(room,after,1000);rows.push(...r);if(r.length<1000)break;after=r[r.length-1].id}}else rows=await S().getLogTail(room,1000)}catch(e){return A().toast('로그를 읽지 못했다: '+e.message)}
  const t0=new Date(today+'T00:00:00').getTime();rows=rows.filter(r=>r.id>last&&(last||Date.parse(r.at)>=t0));
  const tm=r=>{const d=new Date(r.at);return isNaN(d)?'':`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};
  const lines=rows.filter(r=>r.kind!=='whisper'&&!(r.data&&r.data.ch==='ooc')&&!(r.data&&r.data.sms)).map(r=>{const d=r.data||{};const t=d.clear?'무대를 비웠다':String(d.t||'')+(d.img?' [그림] '+d.img:'');if(!t.trim())return '';const who=d.as||r.who||'';return `[${tm(r)}] ${who?who+': ':''}${t}`}).filter(Boolean);
  if(!rows.length||!lines.length)return A().toast(last?'지난번 보낸 뒤로 새 로그가 없다':'오늘 로그가 없다');
  const maxId=rows.reduce((m,r)=>Math.max(m,r.id),last);const old=ex?ex.data:{title:`웹툴 · ${rn} · ${today}`,date:today,ep:'',players:'',tags:['웹툴'],summary:'',body:'',url:'',folder:'',sess:'',created:Date.now()};
  const body=(old.body?old.body+'\n':'')+lines.join('\n');const n=body.split('\n').filter(Boolean).length;
  const data=Object.assign({},old,{body,summary:old.summary&&!/^웹툴 방 「/.test(old.summary)?old.summary:`웹툴 방 「${rn}」 에서 보낸 로그 (${n}줄)`,om:{room,last:maxId}});
  try{await S().ntPut(c.camp,c.secret,'logs',id,data,ex?ex.vis:'gm')}catch(e){return A().toast('노트에 쓰지 못했다: '+e.message)}
  A().toast(`노트 「기록」에 ${lines.length}줄을 ${ex?'덧붙였다':'새로 남겼다'} (처음엔 GM만)`)}
 /* ---------- 10-30 망령 「지도 연동」: 노트 지도 ↔ 이 방 지도 — 장소 핀 · 루트 · 인물 배치 · 파티(PC) 위치 ----------
    켜기: 이 방 지도가 노트 지도에서 왔고(rp.map.src = nt:<캠페인>/<지도>) rp.map.live = 1. 노트 지도의 「🗺 웹툴로 · 연동」(#…&map=<지도>) 으로 열면 가져와서 켠다. 📓 메뉴에서 켜고 끈다.
    누가: 이 방에 들어와 있는 GM 브라우저(여럿이어도 바뀐 칸만 쓰니 같은 결과).
    노트 → 방: 노트 캠페인 실시간 신호(nt:<캠페인>)마다 1.2초 모아 다시 읽어 맞춘다(신호를 놓쳐도 30초마다 한 번).
    방 → 노트: 2초마다 이 방 지도를 보고, 지난번 맞춘 모양과 달라졌으면 노트에 쓴다(먼저 쓰고 나서 읽는다).
    지우기 (망령 10-30): 장소는 어느 쪽에서 지워도 다른 쪽은 남긴다. 루트 — 웹툴에서 그은 루트(노트 문서 om:1)는 양쪽에서 지워지고,
      노트 시나리오 루트는 웹툴에서 지우면 이 방 지도에서만 감춘다(map.hideR, 노트는 그대로). 인물 — 어느 쪽에서 빼도 다른 쪽에서 빠진다.
    map.ntK = {r:[루트 rid], p:[인물 id]} = 지난번 맞춘 목록 — 「지운 것」과 「새로 생긴 것」을 가른다. 인물 id = 'nt:'+(ents|pc|npc)+':'+문서 id */
 const LV={camp:'',mapId:'',w:null,t:null,busy:false,last:null,iv:null,pullAt:0,dirty:false,warned:''};
 const absU=u=>{try{return new URL(u,location.href).href}catch(e){return u}};
 const rid8=()=>Math.random().toString(36).slice(2,10);
 const RHEX={red:'#d63f4f',blue:'#2e86de',gold:'#f0aa1e',green:'#28a064',purple:'#8e5bd6'};
 const isPerson=(k,d)=>k!=='ents'||d.type==='인물'||!!d.face;
 const curMapS=()=>(A().ST.state.rp||{}).map||{};
 const srcOf=mp=>{const m=String((mp||{}).src||'').match(/^nt:([^/]+)\/(.+)$/);return m?{camp:m[1],mapId:m[2]}:null};
 /* 방 → 노트로 볼 모양 (보기 상태인 가림 · 루트 공개 · 웹툴만의 인물은 뺀다) */
 function shape(mp){return JSON.stringify({l:(mp.locs||[]).map(l=>[l.n,Math.round(l.x),Math.round(l.y),l.name||'',l.bg&&l.bg.src?absU(l.bg.src):'',l.nt||'']),
  r:(mp.routes||[]).map(r=>[r.rid,(r.seq||[]).join(','),r.name||'',r.color||'']),p:(mp.npcs||[]).filter(n=>String(n.id||'').startsWith('nt:')).map(n=>[n.id,n.n]),pt:(mp.party||{}).n||0})}
 const liveOn=()=>{const mp=curMapS();return A().ST.role==='gm'&&mp.live==1&&!!srcOf(mp)};
 function liveTick(){const ST=A().ST;const L=ST&&ST.room&&ST.role==='gm'&&LINK.room===ST.room?LINK.camp:null;
  if(!L){if(LV.w){LV.w.stop();LV.w=null}LV.camp='';LV.last=null;LV.calLast=null;return}
  if(LV.camp!==L.id){if(LV.w)LV.w.stop();LV.camp=L.id;LV.last=null;LV.calLast=null;
   LV.w=S().ntWatch?S().ntWatch(L.id,()=>{clearTimeout(LV.t);LV.t=setTimeout(()=>{liveRun('sig');calRun()},1200)}):null;liveRun('sig');calRun();return}
  const s=liveOn()?srcOf(curMapS()):null;const mapOn=s&&s.camp===L.id;if(!mapOn)LV.last=null;
  if(mapOn&&LV.mapId&&LV.mapId!==s.mapId)LV.last=null;   /* 다른 노트 지도로 바뀌면 처음부터 (읽기 먼저) */
  if(mapOn&&(LV.last==null||shape(curMapS())!==LV.last))return liveRun('push');
  if(LV.calLast!=null&&calShape()!==LV.calLast)return calRun();
  if(Date.now()-LV.pullAt>30000){LV.pullAt=Date.now();liveRun('sig');calRun()}}
 async function liveRun(why){if(LV.busy){LV.dirty=true;return}LV.busy=true;try{
   const mp=curMapS();const s=srcOf(mp);if(!s||!liveOn()||s.camp!==LV.camp)return;const secret=secOf(s.camp);if(!secret){if(LV.warned!==s.camp){LV.warned=s.camp;A().toast('지도 연동: 이 브라우저에 세션 노트 권한이 없어 쓰지 못한다 — 노트를 GM 으로 한 번 열어 줘')}return}
   if(LV.last!=null&&shape(curMapS())!==LV.last)await livePush(s,secret);   /* 이 방에서 바뀐 게 있으면 늘 먼저 보내고 읽는다 (읽기가 덮지 않게) */
   await livePull(s,secret);LV.pullAt=Date.now()}
  catch(e){console.warn('[지도 연동]',e);if(LV.warned!=='e'+e.message){LV.warned='e'+e.message;A().toast('지도 연동 실패: '+(e.message||e))}}
  finally{LV.busy=false;if(LV.dirty){LV.dirty=false;setTimeout(()=>liveRun('push'),300)}}}
 async function liveDocs(s,secret){const docs=await S().ntDocs(s.camp,secret,['maps','spots','routes','ents','pc','npc']);const md=docs.find(x=>x.kind==='maps'&&x.id===s.mapId);
  if(!md)throw new Error('노트에서 이 지도를 찾지 못했다');const sp=docs.filter(x=>x.kind==='spots'&&x.data.map===s.mapId);return {docs,md,sp,sid:new Set(sp.map(x=>x.id))}}
 /* 노트 → 방 */
 async function livePull(s,secret){const {docs,md,sp,sid}=await liveDocs(s,secret);const cur=curMapS();const W=+md.data.w||(cur.img&&cur.img.w)||1000,H=+md.data.h||(cur.img&&cur.img.h)||700;
  const K=Object.assign({r:[],p:[],l:[]},cur.ntK||{});const hide=Object.assign({},cur.hideR||{});const hideL=Object.assign({},cur.hideL||{});const vis=Object.assign({},cur.vis||{});
  const locs=(cur.locs||[]).map(l=>Object.assign({},l));const byNt={};locs.forEach(l=>{if(l.nt)byNt[l.nt]=l});let nMax=Math.max(0,...locs.map(l=>+l.n||0));
  for(const d of sp.slice().sort((a,b)=>String(a.data.num||'').localeCompare(String(b.data.num||''),'ko',{numeric:true}))){const x=Math.round((+d.data.x||0)/100*W),y=Math.round((+d.data.y||0)/100*H);let l=byNt[d.id];
   if(!l){if(hideL[d.id])continue;if(K.l.includes(d.id)){hideL[d.id]=1;continue}   /* 웹툴에서 지운 핀 — 노트 장소는 남기고 이 방에선 다시 안 꺼낸다 */
    l={n:++nMax,name:d.data.name||'장소',x,y,nt:d.id};locs.push(l);byNt[d.id]=l;if(d.vis!=='pub')vis[l.n]=1}
   else{if(Math.abs(l.x-x)>1||Math.abs(l.y-y)>1){l.x=x;l.y=y}if(d.data.name&&l.name!==d.data.name)l.name=d.data.name}
   if(d.data.bg&&(!l.bg||absU(l.bg.src)!==d.data.bg))l.bg={src:d.data.bg,name:d.data.bgName||d.data.name||''}}
  const nOf=id=>{const l=byNt[id];return l?l.n:0};
  /* 루트 */
  const nr={};docs.filter(x=>x.kind==='routes').forEach(x=>{const seq=(x.data.steps||[]).map(st=>st.spot&&sid.has(st.spot)?nOf(st.spot):0).filter(Boolean);if(seq.length>=1)nr['nt_'+x.id]={x,seq}});
  const routes=[];const seen=new Set();
  for(const r of cur.routes||[]){if(!String(r.rid||'').startsWith('nt_')){routes.push(r);continue}const h=nr[r.rid];seen.add(r.rid);
   if(h){const c=h.x.data.color||r.color;routes.push(Object.assign({},r,{name:h.x.data.name||r.name,seq:h.seq,color:c}))}
   else if(!K.r.includes(r.rid))routes.push(r)}   /* 노트에서 지워졌으면(지난번 맞춘 목록에 있었으면) 뺀다 */
  for(const [rid,h] of Object.entries(nr)){if(seen.has(rid)||hide[rid]||K.r.includes(rid))continue;if(h.seq.length<2)continue;routes.push({rid,name:h.x.data.name||'루트',color:h.x.data.color||'#e4002b',seq:h.seq,vis:h.x.data.visible!==false&&h.x.vis==='pub'?1:0})}
  /* 인물 */
  const pl={};for(const x of docs.filter(x=>x.kind==='ents'||x.kind==='pc'||x.kind==='npc')){if(!isPerson(x.kind,x.data))continue;const at=(x.data.at||[]).find(a=>sid.has(a));if(!at||!nOf(at))continue;
   if(x.kind==='ents'&&!x.data.face)continue;pl['nt:'+x.kind+':'+x.id]={x,n:nOf(at)}}
  const npcs=[];const pseen=new Set();
  for(const n of cur.npcs||[]){const id=String(n.id||'');if(!id.startsWith('nt:')){npcs.push(n);continue}pseen.add(id);const h=pl[id];if(!h)continue;
   npcs.push(Object.assign({},n,{n:h.n,name:h.x.data.title||h.x.data.name||n.name,img:h.x.data.face||h.x.data.image||n.img||''}))}
  for(const [id,h] of Object.entries(pl)){if(pseen.has(id))continue;npcs.push({id,name:h.x.data.title||h.x.data.name||'',img:h.x.data.face||h.x.data.image||'',n:h.n,size:'s',vis:h.x.vis==='pub'?1:0})}
  /* 파티(PC) 위치 */
  const pn=md.data.party&&sid.has(md.data.party)?nOf(md.data.party):0;const party=Object.assign({vis:1},cur.party||{},{n:pn});
  const ntK={r:routes.filter(r=>String(r.rid||'').startsWith('nt_')).map(r=>r.rid).concat(Object.keys(hide)),p:npcs.filter(n=>String(n.id||'').startsWith('nt:')).map(n=>n.id),l:locs.filter(l=>l.nt).map(l=>l.nt)};
  const patch=Object.assign({},cur,{locs,vis,routes,npcs,party,ntK,hideL});if(md.data.img&&(!cur.img||absU(cur.img.src)!==absU(md.data.img)))patch.img={src:md.data.img,w:W,h:H};
  const ops=A().diffOps(['rp','map'],cur,patch,1);if(ops.length)await A().setMany(ops);LV.last=shape(ops.length?patch:cur);LV.mapId=s.mapId;if(ops.length)A().renderScene()}
 /* 방 → 노트 */
 async function livePush(s,secret){const {docs,md,sp,sid}=await liveDocs(s,secret);const cur=curMapS();const W=+md.data.w||(cur.img&&cur.img.w)||1000,H=+md.data.h||(cur.img&&cur.img.h)||700;
  const K=Object.assign({r:[],p:[],l:[]},cur.ntK||{});const hide=Object.assign({},cur.hideR||{});const byId=k=>Object.fromEntries(docs.filter(x=>x.kind===k).map(x=>[x.id,x]));const SP=byId('spots'),RT=byId('routes');
  const rows=[],dels=[];const locs=(cur.locs||[]).map(l=>Object.assign({},l));
  for(const l of locs){const x=+(l.x/W*100).toFixed(2),y=+(l.y/H*100).toFixed(2);const lb=l.bg&&l.bg.src?absU(l.bg.src):'';
   if(l.nt&&SP[l.nt]){const d=Object.assign({},SP[l.nt].data);let ch=false;if(Math.abs((+d.x||0)-x)>0.05||Math.abs((+d.y||0)-y)>0.05){d.x=x;d.y=y;ch=true}if(l.name&&l.name!==d.name){d.name=l.name;ch=true}if(lb&&lb!==(d.bg||'')){d.bg=lb;d.bgName=l.bg.name||'';ch=true}if(ch)rows.push({kind:'spots',id:l.nt,data:d,vis:SP[l.nt].vis})}
   else if(!l.nt){const id='s'+rid8();const nd={map:s.mapId,x,y,name:l.name||'장소',num:String(l.n||''),kind:'기타',area:'',summary:'',items:'',img:'',imgs:[]};if(lb){nd.bg=lb;nd.bgName=l.bg.name||''}rows.push({kind:'spots',id,data:nd,vis:'pub'});l.nt=id}}
  const ntOf=n=>{const l=locs.find(x=>x.n===n);return l&&l.nt||''};const nmOf=n=>{const l=locs.find(x=>x.n===n);return l&&l.name||''};
  /* 루트: 웹툴에서 새로 그은 것 → 노트 루트(om:1) · 웹툴에서 그은 루트의 고침 · 지운 것 */
  const routes=(cur.routes||[]).map(r=>Object.assign({},r));const live=new Set();
  for(const r of routes){const rid=String(r.rid||'');const steps=(r.seq||[]).map(n=>ntOf(n)).filter(Boolean);
   if(!rid.startsWith('nt_')){if(steps.length<2)continue;const id='r'+rid8();rows.push({kind:'routes',id,data:{name:r.name||'웹툴 루트',group:'웹툴 지도',color:RHEX[r.color]||r.color||'#d63f4f',om:1,visible:true,order:999,steps:(r.seq||[]).map(n=>({sid:'st'+rid8(),spot:ntOf(n),title:nmOf(n)})).filter(x=>x.spot)},vis:r.vis?'pub':'gm'});r.rid='nt_'+id;live.add(r.rid);continue}
   live.add(rid);const doc=RT[rid.slice(3)];if(doc&&doc.data.om==1){const old=(doc.data.steps||[]).map(x=>x.spot).join(',');if(old!==steps.join(',')||(r.name&&r.name!==doc.data.name)){const d=Object.assign({},doc.data,{name:r.name||doc.data.name,steps:(r.seq||[]).map((n,i)=>{const o=(doc.data.steps||[])[i];return {sid:o&&o.spot===ntOf(n)?o.sid:'st'+rid8(),spot:ntOf(n),title:nmOf(n)}}).filter(x=>x.spot)});rows.push({kind:'routes',id:doc.id,data:d,vis:doc.vis})}}}
  for(const rid of K.r){if(live.has(rid)||hide[rid])continue;const doc=RT[rid.slice(3)];if(!doc)continue;if(doc.data.om==1)dels.push({kind:'routes',id:doc.id,vis:doc.vis});else hide[rid]=1}
  /* 인물: 웹툴에서 옮긴 · 뺀 노트 인물 → 그 문서의 at (이 지도의 장소만 바꾸고 다른 지도에 놓인 곳은 그대로) */
  const P=Object.fromEntries(docs.filter(x=>x.kind==='ents'||x.kind==='pc'||x.kind==='npc').map(x=>['nt:'+x.kind+':'+x.id,x]));const nowP=new Set();
  const setAt=(x,to)=>{const a=(x.data.at||[]).filter(q=>!sid.has(q));if(to)a.push(to);const old=(x.data.at||[]).join(',');if(a.join(',')!==old)rows.push({kind:x.kind,id:x.id,data:Object.assign({},x.data,{at:a}),vis:x.vis})};
  for(const n of cur.npcs||[]){const id=String(n.id||'');if(!id.startsWith('nt:'))continue;nowP.add(id);const x=P[id];if(!x)continue;const to=ntOf(n.n);const here=(x.data.at||[]).find(q=>sid.has(q))||'';if(to&&to!==here)setAt(x,to)}
  for(const id of K.p){if(nowP.has(id))continue;const x=P[id];if(x&&(x.data.at||[]).some(q=>sid.has(q)))setAt(x,'')}
  /* 파티 위치 */
  const pt=ntOf((cur.party||{}).n||0);if((md.data.party||'')!==pt)rows.push({kind:'maps',id:md.id,data:Object.assign({},md.data,{party:pt}),vis:md.vis});
  if(rows.length)await S().ntPutMany(s.camp,secret,rows.map(r=>({kind:r.kind,id:r.id,data:r.data,vis:r.vis||'pub'})));
  for(const d of dels)await S().ntDel(s.camp,secret,d.kind,d.id);
  if(LV.w){for(const r of rows)if(r.vis&&r.vis!=='pub')LV.w.ping({t:'doc',kind:r.kind,id:r.id});for(const d of dels)LV.w.ping({t:'del',kind:d.kind,id:d.id})}
  const patch=Object.assign({},cur,{locs,routes,hideR:hide});const ops=A().diffOps(['rp','map'],cur,patch,1);if(ops.length)await A().setMany(ops);
  if(rows.length||dels.length)A().sysLog(`지도 연동: 노트로 ${rows.length+dels.length}건 (장소 · 루트 · 인물 · 파티)`);LV.last=shape(patch)}
/* ---------- 10-30 망령 「캘린더도 연동」 (양쪽 다) — 이어진 캠페인이면 늘 (지도 연동 스위치와 따로) ----------
    노트 → 웹툴: 노트 「일정」의 세션(날짜가 있는 것) = 이 방 캘린더의 「세션」 일정(id nt_<문서>). 노트에서 지우거나 날짜를 빼면 빠진다.
    웹툴 → 노트: 이 방의 게임 속 오늘 · 날씨 · 일정(노트에서 온 것 빼고) = 노트 plan 문서 omcal_<방> {t:'omcal', room, name, today, weather, events}. 노트 「일정」 탭에 「웹툴 게임 달력」으로 보인다 */
 const calNow=()=>A().ST.state.calendar||{};
 function calShape(){const c=calNow();const ev={};for(const [d,L] of Object.entries(c.events||{})){const x=(L||[]).filter(e=>!String(e.id||'').startsWith('nt_'));if(x.length)ev[d]=x}return JSON.stringify({t:c.today||'',w:c.weather||'',ev})}
 async function calRun(){if(LV.cbusy)return;const L=LINK.camp;if(!L||A().ST.role!=='gm')return;const secret=secOf(L.id);if(!secret)return;LV.cbusy=true;try{
   const docs=await S().ntDocs(L.id,secret,['plan']);const room=A().ST.room;
   /* 노트 세션 → 이 방 캘린더 */
   const sess=docs.filter(x=>x.data&&x.data.t==='sess'&&/^\d{4}-\d{2}-\d{2}$/.test(x.data.date||''));const c=calNow();const ev={};
   for(const [d,Lst] of Object.entries(c.events||{})){const x=(Lst||[]).filter(e=>!String(e.id||'').startsWith('nt_'));if(x.length)ev[d]=x}
   for(const x of sess){const d=x.data;(ev[d.date]=ev[d.date]||[]).push({id:'nt_'+x.id,k:'session',t:`세션 ${d.label||''}${d.what?' · '+d.what:''}`.trim(),note:[d.time,d.where,'세션 노트 일정'].filter(Boolean).join(' · ')})}
   if(JSON.stringify(ev)!==JSON.stringify(c.events||{}))await A().set(['calendar','events'],ev);
   /* 이 방 게임 달력 → 노트 */
   const mine={};for(const [d,Lst] of Object.entries(ev)){const x=Lst.filter(e=>!String(e.id||'').startsWith('nt_')).map(e=>({id:e.id,t:e.t||'',k:e.k||'',note:e.note||''}));if(x.length)mine[d]=x}
   const id='omcal_'+room;const old=docs.find(x=>x.id===id);const data={t:'omcal',room,name:(A().ST.roomRow&&A().ST.roomRow.name)||room,today:c.today||'',weather:c.weather||'',events:mine};
   const cmp=o=>JSON.stringify({today:o.today||'',weather:o.weather||'',events:o.events||{}});
   if(!old||cmp(old.data)!==cmp(data)){await S().ntPutMany(L.id,secret,[{kind:'plan',id,data:Object.assign({},data,{at:new Date().toISOString()}),vis:'pub'}])}
   LV.calLast=calShape()}
  catch(e){console.warn('[캘린더 연동]',e)}finally{LV.cbusy=false}}
 async function liveSet(on){const mp=curMapS();if(on&&!srcOf(mp))return A().toast('이 방 지도가 노트 지도에서 온 게 아니다 — 먼저 「지도 가져오기」');await A().set(['rp','map','live'],on?1:0);LV.last=null;if(on){LV.camp='';liveTick()}A().toast(on?'지도 연동을 켰다 — 노트와 이 방 지도가 서로 따라간다':'지도 연동을 껐다')}
 LV.iv=setInterval(()=>{try{liveTick()}catch(e){}},2000);
 document.addEventListener('click',e=>{if(e.target.closest('[data-ntdg]')){e.preventDefault();dgPanel()}});
 return {importMap,importGraph,pick,NOTES_URL,linked,menu,afterOpen,topBtn,notesLink,dgPull,dgPush,dgPanel,mapPush,logPush,dgH,liveSet,liveRun,calRun,LV};
})();
