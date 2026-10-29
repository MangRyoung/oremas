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
   ${L?`<p style="margin-top:0">이 방은 세션 노트의 <b>「${esc(L.name)}」</b> 캠페인과 이어져 있다.</p><div class="row" style="gap:6px;flex-wrap:wrap"><a class="btn pri" href="${esc(notesLink(L.id))}" target="mangketmon-notes" rel="noopener">세션 노트 열기 ↗</a>${gm?'<button class="btn" data-nt="map">지도 가져오기</button><button class="btn" data-nt="graph">관계도 가져오기</button>':''}</div>
    ${gm?`<p class="small dim" style="margin-top:10px">${secOf(L.id)?'이 브라우저에 세션 노트 GM 비밀구가 있어 「GM만」 문서까지 가져온다.':'이 브라우저에는 세션 노트 GM 비밀구가 없어 「모두」로 공개된 것만 가져온다. 세션 노트를 GM 으로 한 번 열면 다음부터 같이 쓴다.'}</p><div class="row" style="gap:6px;margin-top:6px"><button class="btn sm ghost" data-nt="other">다른 캠페인과 잇기</button><button class="btn sm ghost" data-nt="unlink">잇기 풀기</button></div>`:''}`
   :`<p style="margin-top:0">세션 노트 캠페인과 이으면, 지도 · 관계도를 캠페인을 다시 고르지 않고 한 번에 가져오고, 세션 노트 시트에서 「⚔ 웹툴로」 를 누르면 이 방으로 트레이너를 보낸다.</p><div class="row"><button class="btn pri" data-nt="other">캠페인 고르기</button></div>`}`);
  md.querySelectorAll('[data-nt]').forEach(b=>b.onclick=async()=>{const k=b.dataset.nt;A().closeModal();if(k==='map')return importMap();if(k==='graph')return importGraph();if(k==='unlink')return unlink();
   if(k==='other'){const r=await pick([],'',{ask:true,linkOnly:true});if(r)A().toast(`「${r.campName}」 캠페인과 이었다`)}})}
 /* 세션 노트에서 보낸 트레이너 가져오기 (#…&add=t1,t2) — openRoom 끝에서 부른다 */
 async function afterOpen(){const p=hp();linked(true);if(!p.add)return;const ids=p.add.split(',').map(x=>x.trim()).filter(Boolean);
  try{history.replaceState(null,'',location.pathname+location.search+'#'+Object.entries(p).filter(([k])=>k!=='add').map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&'))}catch(e){}
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
  const locs=spots.map((s,i)=>({n:i+1,name:s.name||('장소 '+(i+1)),x:Math.round((+s.x||0)/100*W),y:Math.round((+s.y||0)/100*H),nt:s.id}));const nOf=id=>{const l=locs.find(x=>x.nt===id);return l?l.n:0};
  const routes=byKind(r.docs,'routes').filter(rt=>(rt.steps||[]).some(st=>st.spot&&nOf(st.spot))).map((rt,i)=>({rid:'nt_'+rt.id,name:rt.name||('루트 '+(i+1)),color:rt.color||'#e4002b',seq:(rt.steps||[]).map(st=>nOf(st.spot)).filter(Boolean),vis:rt.visible!==false&&rt._vis==='pub'?1:0}));
  const vis={};spots.forEach((s,i)=>{if(s._vis!=='pub')vis[i+1]=1});
  if(!confirm(`「${r.campName}」의 지도 「${m.name}」를 가져올까?\n장소 ${locs.length}곳 · 루트 ${routes.length}개${m.img?' · 지도 그림':''}\n(이 방의 지도 핀·루트는 바뀐다. 인물(npcs)과 파티 위치는 남긴다)`))return;
  const cur=(A().ST.state.rp||{}).map||{};const patch=Object.assign({},cur,{locs,routes,vis,party:{n:0,vis:1},npcs:(cur.npcs||[]).filter(n=>locs.some(l=>l.n===n.n)),preset:m.img?'':cur.preset,src:'nt:'+r.camp+'/'+m.id});
  if(m.img)patch.img={src:m.img,w:W,h:H};await A().set(['rp','map'],patch);A().sysLog(`지도: 세션 노트 「${r.campName}」에서 가져옴 (장소 ${locs.length} · 루트 ${routes.length})`);A().toast('지도를 가져왔다');A().renderScene()}
 /* 관계도: ents(인물 · 조직) → graph.nodes(npc/org, 얼굴 사진), rels → edges */
 async function importGraph(){const r=await pick(['ents','rels'],'관계도');if(!r)return;const ents=byKind(r.docs,'ents').filter(e=>['인물','조직'].includes(e.type));if(!ents.length)return A().toast('가져올 인물 · 조직이 없다');
  const g=A().ST.state.graph||{nodes:{},edges:{}};const nodes=g.nodes||{},edges=g.edges||{};const byName={};for(const [id,n] of Object.entries(nodes))byName[n.name]=id;
  let add=0,upd=0;const ops=[];const idOf={};
  const xs=ents.map(e=>+e.gx).filter(Number.isFinite),ys=ents.map(e=>+e.gy).filter(Number.isFinite);const cx=xs.length?(Math.min(...xs)+Math.max(...xs))/2:800,cy=ys.length?(Math.min(...ys)+Math.max(...ys))/2:500;
  ents.forEach((e,i)=>{const kind=e.type==='조직'?'org':'npc';const ex=byName[e.title];const id=ex||('nt'+e.id.replace(/[^a-z0-9]/gi,'').slice(0,10)+Math.random().toString(36).slice(2,5));idOf[e.id]=id;
   const x=Number.isFinite(+e.gx)?Math.round((+e.gx-cx)*.9):Math.round(Math.cos(i/ents.length*6.283)*320),y=Number.isFinite(+e.gy)?Math.round((+e.gy-cy)*.9):Math.round(Math.sin(i/ents.length*6.283)*320);
   const base=ex?nodes[ex]:{id,x,y};const nn=Object.assign({},base,{name:e.title||'?',kind:base.kind==='pc'?'pc':kind,img:e.face||e.photo||base.img||'',note:[e.sub,e.body].filter(Boolean).join('\n').slice(0,600)||base.note||'',nt:e.id});
   if(e.color)nn.color=e.color;if(ex)upd++;else add++;ops.push([['graph','nodes',id],nn])});
  const rels=byKind(r.docs,'rels').filter(q=>idOf[q.a]&&idOf[q.b]);const has=new Set(Object.values(edges).map(x=>x.a+'|'+x.b).concat(Object.values(edges).map(x=>x.b+'|'+x.a)));let ae=0;
  for(const q of rels){const a=idOf[q.a],b=idOf[q.b];if(has.has(a+'|'+b))continue;has.add(a+'|'+b);ae++;ops.push([['graph','edges','nt'+Math.random().toString(36).slice(2,9)],{a,b,rank:q.kind==='love'?3:q.kind==='ally'?2:q.kind==='rival'?1:1,label:q.label||'',shock:0,nt:q.id}])}
  if(!confirm(`「${r.campName}」의 관계도를 가져올까?\n새 인물 · 조직 ${add}명 · 이름이 같은 ${upd}명은 사진 · 메모를 덧씌움 · 새 관계선 ${ae}개\n(이 방에 이미 있는 노드와 선은 지우지 않는다)`))return;
  A().toast('가져오는 중…');await A().setMany(ops);A().sysLog(`관계도: 세션 노트 「${r.campName}」에서 가져옴 (${add+upd}명 · 선 ${ae}개)`);A().toast('관계도를 가져왔다');A().renderScene()}
 return {importMap,importGraph,pick,NOTES_URL,linked,menu,afterOpen,topBtn,notesLink};
})();
