/* ---------- 세션 노트 연동 (10-26 망령) ----------
   세션 노트(mangketmon-notes · 같은 Supabase 의 nt_* 표)에서 지도(장소 · 루트)와 관계도(인물 · 조직 · 관계)를 이 방으로 가져온다.
   공개(모두) 문서는 그냥 읽고, 세션 노트 GM 비밀구를 적으면 GM만 문서까지 읽는다. 가져온 것은 이 방의 것이 되어 따로 바뀐다(실시간 연동 아님). */
"use strict";
window.OM_NOTES=(()=>{
 const A=()=>window.OM_APP,S=()=>window.OM_STORE;const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const NOTES_URL=(window.OM_CONFIG&&OM_CONFIG.notesUrl)||'https://mangryoung.github.io/mangketmon-notes/';
 /* 캠페인 고르기 → {camp, secret, docs(kinds)} */
 async function pick(kinds,what){let camps=[];try{camps=await S().ntCamps()}catch(e){A().toast('세션 노트 표를 못 읽었다: '+e.message+' (schema.sql 을 아직 안 돌렸나?)');return null}
  if(!camps.length){A().toast('세션 노트에 캠페인이 없다');return null}
  const last=(()=>{try{return localStorage.getItem('om_nt_camp')||''}catch(e){return ''}})();
  return new Promise(res=>{const md=A().openModal(`<div class="mhead"><h2>세션 노트에서 ${esc(what)} 가져오기</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <label class="lbl">캠페인<select id="ntC">${camps.map(c=>`<option value="${esc(c.id)}" ${c.id===last?'selected':''}>${esc(c.name)}${c.data&&c.data.sub?' · '+esc(c.data.sub):''}</option>`).join('')}</select></label>
   <label class="lbl" style="margin-top:8px">세션 노트 GM 비밀구 <small class="dim">(비우면 「모두」로 공개된 것만 가져온다)</small><input id="ntS" type="password" autocomplete="off"></label>
   <p class="small dim" style="margin-top:8px">가져온 것은 이 방의 것이 되어 세션 노트와 따로 바뀐다. 세션 노트: <a href="${esc(NOTES_URL)}" target="_blank" rel="noopener">${esc(NOTES_URL)}</a></p>
   <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn pri" id="ntOk">가져오기</button></div>`);
   md.parentElement.addEventListener('click',e=>{if(e.target===md.parentElement||e.target.closest('[data-x]'))res(null)});
   md.querySelector('#ntOk').onclick=async()=>{const camp=md.querySelector('#ntC').value,secret=md.querySelector('#ntS').value.trim();try{localStorage.setItem('om_nt_camp',camp)}catch(e){}
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
 return {importMap,importGraph,pick,NOTES_URL};
})();
