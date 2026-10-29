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
 const secOf=camp=>{try{return localStorage.getItem('nt_sec_'+camp)||''}catch(e){return ''}};
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
   ${L?`<p style="margin-top:0">이 방은 세션 노트의 <b>「${esc(L.name)}」</b> 캠페인과 이어져 있다.</p><div class="row" style="gap:6px;flex-wrap:wrap"><a class="btn pri" href="${esc(notesLink(L.id))}" target="mangketmon-notes" rel="noopener">세션 노트 열기 ↗</a>${gm?'<button class="btn" data-nt="map">지도 가져오기</button><button class="btn" data-nt="graph">관계도 가져오기</button><button class="btn" data-nt="dg">⛩ 던전 주고받기</button>':''}</div>${gm?`<div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px"><span class="small dim" style="align-self:center">노트로 보내기</span><button class="btn sm" data-nt="mappush" title="노트에서 가져온 지도의 핀 중 옮기거나 이름 · 배경을 바꾼 것 · 새로 찍은 것만">📍 지도 핀</button><button class="btn sm" data-nt="logpush" title="오늘 이 방 로그를 노트 「기록」에 (지난번 보낸 뒤만 · 귓속말 · 잡담 빼고)">📜 오늘 로그</button></div>`:''}
    ${gm?`<p class="small dim" style="margin-top:10px">${secOf(L.id)?'이 브라우저에 세션 노트 GM 비밀구가 있어 「GM만」 문서까지 가져온다.':'이 브라우저에는 세션 노트 GM 비밀구가 없어 「모두」로 공개된 것만 가져온다. 세션 노트를 GM 으로 한 번 열면 다음부터 같이 쓴다.'}</p><div class="row" style="gap:6px;margin-top:6px"><button class="btn sm ghost" data-nt="other">다른 캠페인과 잇기</button><button class="btn sm ghost" data-nt="unlink">잇기 풀기</button></div>`:''}`
   :`<p style="margin-top:0">세션 노트 캠페인과 이으면, 지도 · 관계도를 캠페인을 다시 고르지 않고 한 번에 가져오고, 세션 노트 시트에서 「⚔ 웹툴로」 를 누르면 이 방으로 트레이너를 보낸다.</p><div class="row"><button class="btn pri" data-nt="other">캠페인 고르기</button></div>`}`);
  md.querySelectorAll('[data-nt]').forEach(b=>b.onclick=async()=>{const k=b.dataset.nt;A().closeModal();if(k==='map')return importMap();if(k==='graph')return importGraph();if(k==='dg')return dgPanel();if(k==='mappush')return mapPush();if(k==='logpush')return logPush();if(k==='unlink')return unlink();
   if(k==='other'){const r=await pick([],'',{ask:true,linkOnly:true});if(r)A().toast(`「${r.campName}」 캠페인과 이었다`)}})}
 /* 세션 노트에서 보낸 트레이너 가져오기 (#…&add=t1,t2) — openRoom 끝에서 부른다 */
 async function afterOpen(){const p=hp();linked(true);if(!p.add&&!p.dg)return;const ids=String(p.add||'').split(',').map(x=>x.trim()).filter(Boolean);
  try{history.replaceState(null,'',location.pathname+location.search+'#'+Object.entries(p).filter(([k])=>k!=='add'&&k!=='dg').map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&'))}catch(e){}
  /* 10-29 세션 노트 던전의 「🎲 웹툴로」 (#…&dg=<노트 던전 id>) */
  if(p.dg){if(A().ST.role!=='gm')A().toast('세션 노트에서 보낸 던전은 GM 만 가져올 수 있다');else{await linked(true);const id=await dgPull(p.dg);if(id){try{A().goView('dungeon')}catch(e){}}}if(!ids.length)return}
  if(A().ST.role!=='gm'){if(ids.length)A().toast('세션 노트에서 보낸 트레이너는 GM 만 가져올 수 있다');return}
  const R=(A().ST.state.roster||{}).trainers||{};const fresh=ids.filter(id=>!Object.values(R).some(t=>t.id===id||t.mkId===id));
  if(!confirm(`세션 노트에서 트레이너 ${ids.length}명을 보냈다.\n제작기에서 지금 값으로 이 방 명단에 가져올까?${ids.length-fresh.length?`\n(이미 있는 ${ids.length-fresh.length}명은 새 값으로 덮어쓴다 · HP·랭크·메모는 새로 시작)`:''}`))return;
  const SU=window.OM_SHEET_UI;if(!SU||!SU.importTrainer)return A().toast('시트 화면이 아직 준비되지 않았다 — 새로 고친 뒤 다시');let n=0;
  for(const id of ids){try{const mk=await (A().loadMakerParty?A().loadMakerParty(id):A().loadMaker(true));const tdoc=mk.trainers.find(t=>t.id===id);if(!tdoc){A().toast('제작기에서 못 찾았다: '+id);continue}await SU.importTrainer(tdoc,mk.pokemon,false,'');n++}catch(e){A().toast('가져오지 못했다: '+(e.message||e))}}
  if(n){A().sysLog(`세션 노트에서 트레이너 ${n}명을 가져왔다`);A().toast(`트레이너 ${n}명을 가져왔다`);A().renderScene()}}
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
 async function importMap(){const r=await pick(['maps','spots','routes'],'지도');if(!r)return;const maps=byKind(r.docs,'maps').sort((a,b)=>(a.order||0)-(b.order||0));if(!maps.length)return A().toast('가져올 지도가 없다 (지도 문서가 공개돼 있지 않거나 비었다)');
  let m=maps[0];if(maps.length>1){const i=prompt('어느 지도? 번호를 적어\n'+maps.map((x,i)=>`${i+1}. ${x.name}`).join('\n'),'1');if(i==null)return;m=maps[Math.max(0,Math.min(maps.length-1,(+i||1)-1))]}
  const W=+m.w||1000,H=+m.h||700;const spots=byKind(r.docs,'spots').filter(s=>s.map===m.id).sort((a,b)=>String(a.num||'').localeCompare(String(b.num||''),'ko',{numeric:true}));
  /* 10-30: 같은 노트 장소(nt)였던 핀의 던전 연결 · 배경은 남기고, 노트 장소에 「웹툴 배경」(bg)이 있으면 그걸 쓴다 */const oldBy={};(((A().ST.state.rp||{}).map||{}).locs||[]).forEach(l=>{if(l&&l.nt)oldBy[l.nt]=l});
  const locs=spots.map((s,i)=>{const o=oldBy[s.id]||{};const L={n:i+1,name:s.name||('장소 '+(i+1)),x:Math.round((+s.x||0)/100*W),y:Math.round((+s.y||0)/100*H),nt:s.id};if(o.dg)L.dg=o.dg;const bg=s.bg?{src:String(s.bg),name:s.bgName||s.name||''}:(o.bg&&o.bg.src?o.bg:null);if(bg)L.bg=bg;return L});const nOf=id=>{const l=locs.find(x=>x.nt===id);return l?l.n:0};
  const routes=byKind(r.docs,'routes').filter(rt=>(rt.steps||[]).some(st=>st.spot&&nOf(st.spot))).map((rt,i)=>({rid:'nt_'+rt.id,name:rt.name||('루트 '+(i+1)),color:rt.color||'#e4002b',seq:(rt.steps||[]).map(st=>nOf(st.spot)).filter(Boolean),vis:rt.visible!==false&&rt._vis==='pub'?1:0}));
  const vis={};spots.forEach((s,i)=>{if(s._vis!=='pub')vis[i+1]=1});
  if(!confirm(`「${r.campName}」의 지도 「${m.name}」를 가져올까?\n장소 ${locs.length}곳 · 루트 ${routes.length}개${m.img?' · 지도 그림':''}${locs.some(l=>l.bg)?` · 장소 배경 ${locs.filter(l=>l.bg).length}곳`:''}\n(이 방의 지도 핀·루트는 바뀐다. 인물(npcs)과 파티 위치는 남긴다)`))return;
  const cur=(A().ST.state.rp||{}).map||{};const patch=Object.assign({},cur,{locs,routes,vis,party:{n:0,vis:1},npcs:(cur.npcs||[]).filter(n=>locs.some(l=>l.n===n.n)),preset:m.img?'':cur.preset,src:'nt:'+r.camp+'/'+m.id});
  if(m.img)patch.img={src:m.img,w:W,h:H};/* 10-29 바뀐 칸만 쓴다 */const ops=A().diffOps(['rp','map'],cur,patch,1);if(!ops.length){A().toast('노트 지도와 같다 — 바뀐 게 없다');return}await A().setMany(ops);A().sysLog(`지도: 세션 노트 「${r.campName}」에서 가져옴 (장소 ${locs.length} · 루트 ${routes.length})`);A().toast('지도를 가져왔다');A().renderScene()}
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
 document.addEventListener('click',e=>{if(e.target.closest('[data-ntdg]')){e.preventDefault();dgPanel()}});
 return {importMap,importGraph,pick,NOTES_URL,linked,menu,afterOpen,topBtn,notesLink,dgPull,dgPush,dgPanel,mapPush,logPush,dgH};
})();
