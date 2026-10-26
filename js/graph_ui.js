/* ---------- 관계도 탭 ----------
   state.graph = { nodes:{id:{name,kind:'pc'|'npc'|'org',x,y,img,note,color}}, edges:{id:{a,b,rank,label,shock}} }
   GM 이 편집(끌어서 배치, 노드·선 추가/수정), 모두가 본다. */
"use strict";
window.OM_GRAPH_UI=(()=>{
 const A=()=>window.OM_APP;
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const $=(s,r)=>(r||document).querySelector(s);
 const V={x:0,y:0,k:1};let drag=null,pan=null;
 const rnd=n=>{const a=new Uint8Array(n||6);crypto.getRandomValues(a);return Array.from(a,b=>'abcdefghijklmnopqrstuvwxyz0123456789'[b%36]).join('')};
 const KIND={pc:'PC',npc:'NPC',org:'조직'};
 function G(){return A().ST.state.graph||{nodes:{},edges:{}}}
 function gm(){return A().ST.role==='gm'}

 let pendingEl=null;
 function render(el){
  if(drag||pan){pendingEl=el;return}
  if(MODE.v==='mine')return renderMine(el);
  const g=G();const nodes=g.nodes||{},edges=g.edges||{};
  const nodeSvg=Object.values(nodes).map(n=>{const r=n.kind==='pc'?30:n.kind==='org'?26:22;const nimg=A().portraitOf(n.name,n.img);
   return `<g class="gn ${n.kind||'npc'}" data-n="${n.id}" transform="translate(${n.x||0},${n.y||0})" style="cursor:${gm()?'grab':'pointer'}">
    ${n.kind==='org'?`<rect x="${-r}" y="${-r}" width="${r*2}" height="${r*2}" transform="rotate(45)" fill="#111" stroke="${n.color||'#fff'}" stroke-width="3"/>`:`<circle r="${r+4}" fill="${n.kind==='pc'?'var(--red)':'#fff'}"/><circle r="${r}" fill="#222"/>`}
    ${nimg?`<clipPath id="cp_${n.id}"><circle r="${r-1}"/></clipPath><image href="${esc(nimg)}" x="${-r}" y="${-r}" width="${r*2}" height="${r*2}" clip-path="url(#cp_${n.id})" preserveAspectRatio="xMidYMid slice"/>`:`<text y="6" text-anchor="middle" font-size="16" fill="#fff" font-family="var(--lab)">${esc((n.name||'?').slice(0,2))}</text>`}
    <g transform="translate(0,${r+16})"><rect x="-60" y="-11" width="120" height="20" fill="#000" stroke="${n.kind==='pc'?'var(--red)':'#fff'}" stroke-width="2" transform="skewX(-8)"/><text y="4" text-anchor="middle" font-size="12" fill="#fff" font-family="var(--lab)">${esc(n.name||'')}</text></g></g>`}).join('');
  const edgeSvg=Object.values(edges).map(e=>{const a=nodes[e.a],b=nodes[e.b];if(!a||!b)return '';const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;const w=1+Math.min(5,+e.rank||0);
   return `<g class="ge" data-e="${e.id}"><line pointer-events="none" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${e.shock?'var(--red)':'#fff'}" stroke-width="${w}" ${e.shock?'stroke-dasharray="8 5"':''} opacity=".85"/>
    <g class="gel" transform="translate(${mx},${my})" style="cursor:pointer"><rect x="-16" y="-9" width="32" height="18" fill="${e.shock?'var(--red)':'#fff'}" transform="skewX(-10)"/><text y="4" text-anchor="middle" font-size="11" font-family="var(--lab)" fill="${e.shock?'#fff':'#000'}">${e.shock?'⚡':''}R${+e.rank||0}</text>${e.label?`<text y="22" text-anchor="middle" font-size="10" fill="#ccc">${esc(e.label)}</text>`:''}</g></g>`}).join('');
  el.innerHTML=`<div class="gtop">${modeBar()}<button class="btn xs" data-z="in">＋</button><button class="btn xs" data-z="out">－</button><button class="btn xs ghost" data-z="fit">맞추기</button>
    <span class="small dim">끌어서 이동 · 휠로 확대 · 노드를 누르면 자세히${gm()?' · GM: 노드를 끌어서 배치':''}</span><span class="sp"></span>
    ${gm()?`${UNDO?'<button class="btn sm ghost" data-g="undo" title="자동 정리 전 배치로 되돌린다">↶ 되돌리기</button>':''}<button class="btn sm" data-g="auto" title="선으로 이어진 사람끼리 가깝게, 랭크가 높을수록 더 가깝게, PC 는 가운데로 — 겹치지 않게 다시 놓는다">✦ 자동 정리</button><button class="btn sm" data-g="addn">+ 노드</button><button class="btn sm ghost" data-g="notes" title="세션 노트의 인물 · 조직 · 관계를 이 방 관계도로">📓 세션 노트에서</button><button class="btn sm" data-g="adde">+ 선</button>`:''}</div>
   <div class="gwrap"><svg id="gsvg" width="100%" height="100%"><defs><pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#2a2a2a"/></pattern></defs>
    <rect width="100%" height="100%" fill="url(#dots)"/><g id="gview" transform="translate(${V.x},${V.y}) scale(${V.k})">${edgeSvg}${nodeSvg}</g></svg>
    <div class="glegend"><b>관계도</b><div class="small">빨간 테두리 = PC, 흰 테두리 = NPC, 마름모 = 조직. 선 굵기와 R 숫자가 관계 랭크, 빨간 점선과 ⚡가 쇼크.</div></div></div>`;
  const svg=$('#gsvg',el);
  bindMode(el);
  el.querySelectorAll('[data-z]').forEach(b=>b.onclick=()=>{if(b.dataset.z==='in')V.k=Math.min(3,V.k*1.2);if(b.dataset.z==='out')V.k=Math.max(.3,V.k/1.2);if(b.dataset.z==='fit')fit(svg);render(el)});
  el.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{const k=b.dataset.g;if(k==='auto')return autoLayout(el,svg);if(k==='notes')return window.OM_NOTES&&OM_NOTES.importGraph();if(k==='undo')return undoLayout(el,svg);return k==='addn'?editNode(null):editEdge(null)});
  svg.addEventListener('wheel',e=>{e.preventDefault();const f=e.deltaY<0?1.1:1/1.1;const r=svg.getBoundingClientRect();const px=e.clientX-r.left,py=e.clientY-r.top;V.x=px-(px-V.x)*f;V.y=py-(py-V.y)*f;V.k*=f;$('#gview',el).setAttribute('transform',`translate(${V.x},${V.y}) scale(${V.k})`)},{passive:false});
  svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;const gn=e.target.closest('.gn');const gl=e.target.closest('.gel');
   if(gn){const id=gn.dataset.n;const n=G().nodes[id];if(!n)return;if(gm()){drag={id,sx:e.clientX,sy:e.clientY,ox:+n.x||0,oy:+n.y||0,x:+n.x||0,y:+n.y||0,moved:false,g:gn,edges:[...el.querySelectorAll('.ge')].map(ge=>({ge,ed:G().edges[ge.dataset.e]})).filter(o=>o.ed&&(o.ed.a===id||o.ed.b===id))};gn.parentNode.appendChild(gn);gn.classList.add('dragging');svg.setPointerCapture(e.pointerId)}else openNode(id);return}
   if(gl){const ge=gl.closest('.ge');if(gm())editEdge(ge.dataset.e);else openEdge(ge.dataset.e);return}
   pan={sx:e.clientX,sy:e.clientY,ox:V.x,oy:V.y};svg.setPointerCapture(e.pointerId);svg.classList.add('panning')});
  let raf=0;const paint=()=>{raf=0;if(drag){const d=drag;d.g.setAttribute('transform',`translate(${d.x},${d.y})`);
    for(const {ge,ed} of d.edges){const a=ed.a===d.id?d:G().nodes[ed.a];const b=ed.b===d.id?d:G().nodes[ed.b];if(!a||!b)continue;const ln=ge.querySelector('line');ln.setAttribute('x1',a.x);ln.setAttribute('y1',a.y);ln.setAttribute('x2',b.x);ln.setAttribute('y2',b.y);const lb=ge.querySelector('.gel');if(lb)lb.setAttribute('transform',`translate(${(a.x+b.x)/2},${(a.y+b.y)/2})`)}}
   if(pan){const v=$('#gview',el);if(v)v.setAttribute('transform',`translate(${V.x},${V.y}) scale(${V.k})`)}};
  svg.addEventListener('pointermove',e=>{if(drag){const dx=(e.clientX-drag.sx)/V.k,dy=(e.clientY-drag.sy)/V.k;if(Math.abs(dx)+Math.abs(dy)>3)drag.moved=true;drag.x=Math.round(drag.ox+dx);drag.y=Math.round(drag.oy+dy)}
   else if(pan){V.x=pan.ox+(e.clientX-pan.sx);V.y=pan.oy+(e.clientY-pan.sy)}else return;if(!raf)raf=requestAnimationFrame(paint)});
  const end=async e=>{svg.classList.remove('panning');if(drag){const d=drag;drag=null;d.g.classList.remove('dragging');
    if(d.moved){const n=G().nodes[d.id];if(n){const nn=Object.assign({},n,{x:d.x,y:d.y});await A().set(['graph','nodes',d.id],nn)}}else if(e.type==='pointerup')openNode(d.id)}
   pan=null;if(pendingEl){const p=pendingEl;pendingEl=null;render(p)}};
  svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end)}
 /* ---------- 「내 인연」 보드 (10-24 벨벳 참고) ----------
    나를 가운데 두고, 안쪽 고리에 내 포켓몬, 바깥에 랭크 1~10 고리. 랭크가 높을수록 가운데에 가깝다.
    플레이어는 자기 트레이너, GM 은 PC 노드를 골라 본다. 보기 방식은 이 브라우저에서만 기억 */
 const MODE={v:(()=>{try{return localStorage.getItem('om_gmode')==='mine'?'mine':'all'}catch(e){return 'all'}})(),me:''};
 function modeBar(){return `<span class="gmode"><button class="btn xs ${MODE.v==='all'?'pri':'ghost'}" data-gm="all">전체 관계도</button><button class="btn xs ${MODE.v==='mine'?'pri':'ghost'}" data-gm="mine">내 인연</button></span>`}
 function bindMode(el){el.querySelectorAll('[data-gm]').forEach(b=>b.onclick=()=>{MODE.v=b.dataset.gm;try{localStorage.setItem('om_gmode',MODE.v)}catch(e){}render(el)})}
 const TRS=()=>((A().ST.state.roster||{}).trainers)||{};
 function myNode(){const ns=Object.values(G().nodes||{});
  if(gm()){const pcs=ns.filter(n=>n.kind==='pc');if(MODE.me&&G().nodes[MODE.me])return G().nodes[MODE.me];return pcs[0]||null}
  const t=TRS()[A().ST.seat];if(!t)return null;return ns.find(n=>n.kind==='pc'&&n.name===t.name)||ns.find(n=>n.name===t.name)||null}
 const RR=rk=>150+(10-Math.max(0,Math.min(10,rk)))*20;   /* 랭크 10 → 150, 랭크 0 → 350 */
 function renderMine(el){const g=G();const nodes=g.nodes||{};const me=myNode();
  const pcs=Object.values(nodes).filter(n=>n.kind==='pc');
  const pick=gm()&&pcs.length?`<select id="gme" class="gme">${pcs.map(n=>`<option value="${n.id}" ${me&&me.id===n.id?'selected':''}>${esc(n.name)}</option>`).join('')}</select>`:'';
  const top=`<div class="gtop">${modeBar()}${pick}<span class="small dim gmhint">가운데가 나 · 가까울수록 랭크가 높다 · 누르면 자세히</span></div>`;
  if(!me){el.innerHTML=top+`<div class="gmine"><div class="empty">${gm()?'관계도에 PC 노드가 아직 없다':'관계도에 내 트레이너 노드가 아직 없다<br><span class="small dim">GM 이 접속해 있으면 저절로 생긴다</span>'}</div></div>`;bindMode(el);return}
  const tr=Object.values(TRS()).find(t=>t.name===me.name);
  const mons=tr?Object.values((A().ST.state.roster||{}).mons||{}).filter(m=>m.tid===tr.id):[];
  const links=Object.values(g.edges||{}).filter(e=>e.a===me.id||e.b===me.id).map(e=>({e,o:nodes[e.a===me.id?e.b:e.a]})).filter(x=>x.o).sort((x,y)=>(+y.e.rank||0)-(+x.e.rank||0)||String(x.o.name).localeCompare(String(y.o.name),'ko'));
  const por=n=>A().portraitOf(n.name,n.img||n.image);
  const disc=(id,r,img,name,ring)=>`<circle r="${r+3}" fill="${ring}"/><circle r="${r}" fill="#222"/>${img?`<clipPath id="mc_${id}"><circle r="${r-1}"/></clipPath><image href="${esc(img)}" x="${-r}" y="${-r}" width="${r*2}" height="${r*2}" clip-path="url(#mc_${id})" preserveAspectRatio="xMidYMid slice"/>`:`<text y="${Math.round(r/3)}" text-anchor="middle" font-size="${Math.round(r*.8)}" fill="#fff" font-family="var(--lab)">${esc((name||'?').slice(0,2))}</text>`}`;
  const rings=[...Array(10)].map((_,i)=>{const rk=i+1,r=RR(rk),mk=rk===1||rk===5||rk===10;return `<circle r="${r}" fill="none" stroke="${mk?'#3a3a3a':'#242424'}" stroke-width="${mk?1.6:1}"/>${mk?`<text class="gmrl" x="${Math.round(r*.7071)+4}" y="${-Math.round(r*.7071)-4}" font-size="16" fill="#666" font-family="var(--lab)">R${rk}</text>`:''}`}).join('');
  const n0=links.length;const pos=links.map((x,i)=>{const a=-Math.PI/2+(n0?i*2*Math.PI/n0:0)+(n0%2?0:Math.PI/n0/2);const r=RR(+x.e.rank||0);return {x:Math.round(Math.cos(a)*r),y:Math.round(Math.sin(a)*r)}});
  const lines=links.map((x,i)=>{const p=pos[i],e=x.e,w=1+Math.min(5,(+e.rank||0)/2);return `<line x1="0" y1="0" x2="${p.x}" y2="${p.y}" stroke="${e.shock?'var(--red)':'#fff'}" stroke-width="${w}" ${e.shock?'stroke-dasharray="10 7"':''} opacity="${e.shock?.95:.55}"/>`}).join('');
  const others=links.map((x,i)=>{const p=pos[i],e=x.e,o=x.o;return `<g class="gmo" data-o="${o.id}" data-e="${e.id}" transform="translate(${p.x},${p.y})" style="cursor:pointer">${disc('o'+o.id,32,por(o),o.name,e.shock?'var(--red)':o.kind==='pc'?'var(--red)':'#fff')}
    ${e.shock?`<g transform="translate(25,-25)"><circle r="13" fill="var(--red)" stroke="#fff" stroke-width="2"/><text y="5" text-anchor="middle" font-size="14">⚡</text></g>`:''}
    <g class="gmlb" transform="translate(0,52)"><rect x="-70" y="-14" width="140" height="27" fill="#000" stroke="${e.shock?'var(--red)':'#fff'}" stroke-width="2" transform="skewX(-8)"/><text y="6" text-anchor="middle" font-size="17" fill="#fff" font-family="var(--lab)">${esc(o.name||'')} <tspan fill="${e.shock?'#ff8a8a':'#ffd23f'}">R${+e.rank||0}</tspan></text></g><text class="gmrk" y="64" text-anchor="middle" font-size="28" fill="${e.shock?'#ff8a8a':'#ffd23f'}" font-family="var(--lab)">${e.shock?'⚡':''}R${+e.rank||0}</text></g>`}).join('');
  const mm=mons.length;const st=2*Math.PI/Math.max(1,mm);
  /* 내 포켓몬은 인연 선과 바로 아래(내 이름표 자리)를 피해서 돈다: 72 갈래 중 가장 멀리 떨어지는 각도 */
  const avoid=[...pos.map(p=>Math.atan2(p.y,p.x)),Math.PI/2,Math.PI/2-.45,Math.PI/2+.45];const gap=(x,y)=>{const d=Math.abs(((x-y)%(2*Math.PI)+3*Math.PI)%(2*Math.PI)-Math.PI);return d};
  let rot=0,best=-1;for(let k=0;k<72;k++){const r0=k*2*Math.PI/72;let m=9;for(let i=0;i<mm;i++)for(const v of avoid)m=Math.min(m,gap(-Math.PI/2+i*st+r0,v));if(m>best+1e-6){best=m;rot=r0}}
  const monSvg=mons.map((m,i)=>{const a=-Math.PI/2+i*st+rot;const r=114;const x=Math.round(Math.cos(a)*r),y=Math.round(Math.sin(a)*r);return `<g class="gmm" transform="translate(${x},${y})">${disc('m'+m.id,20,por(m),m.name,'#ffd23f')}<text class="gmmn" y="38" text-anchor="middle" font-size="14" fill="#ffd23f" font-family="var(--lab)">${esc(m.name||'')}</text></g>`}).join('');
  const center=`<g class="gme0" data-o="${me.id}" style="cursor:pointer">${disc('me',50,por(me),me.name,'var(--red)')}<g transform="translate(0,62)"><rect x="-58" y="-15" width="116" height="28" fill="var(--red)" stroke="#fff" stroke-width="2" transform="skewX(-8)"/><text y="6" text-anchor="middle" font-size="16" fill="#fff" font-family="var(--lab)">${esc(me.name||'')}</text></g></g>`;
  const L=RR(0)+72;
  const list=links.length?links.map(({e,o})=>{const rk=+e.rank||0;return `<button type="button" class="gml ${e.shock?'shock':''}" data-o="${o.id}" data-e="${e.id}"><span class="gmlp">${por(o)?`<img src="${esc(por(o))}" alt="">`:esc((o.name||'?').slice(0,1))}</span><span class="gmln"><b>${esc(o.name||'')}</b>${e.label?`<small>${esc(e.label)}</small>`:''}</span><span class="gmlk">${e.shock?'⚡':''}R${rk}</span><span class="gmlr">${[...Array(10)].map((_,i)=>`<i class="${i<rk?'on':''}"></i>`).join('')}</span></button>`}).join(''):`<div class="empty small">아직 이어진 인연이 없다${gm()?`<br><button class="btn sm pri" data-gadd style="margin-top:8px">+ 인연 잇기</button>`:''}</div>`;
  el.innerHTML=top+`<div class="gmine"><div class="gmsvgw"><svg class="gmsvg" viewBox="${-L} ${-L} ${L*2} ${L*2}" preserveAspectRatio="xMidYMid meet">${rings}<circle r="114" fill="none" stroke="#ffd23f" stroke-width="1.2" stroke-dasharray="3 6" opacity=".5"/>${lines}${monSvg}${others}${center}</svg></div>
   <div class="gmside"><div class="gmsh"><b>인연</b><span class="small dim">${links.length}명 · 포켓몬 ${mons.length}</span>${gm()?'<span class="sp"></span><button class="btn xs" data-gadd title="가운데 사람과 다른 노드를 선으로 잇는다">+ 선</button>':''}</div><div class="gmlist">${list}</div><div class="small dim gmleg">노란 고리 = 내 포켓몬 · 빨간 점선과 ⚡ = 쇼크 · 칸 수 = 랭크 (0~10)</div></div></div>`;
  bindMode(el);
  const sel=$('#gme',el);if(sel)sel.onchange=()=>{MODE.me=sel.value;render(el)};
  const open=(oid,eid)=>{if(gm()&&eid)return editEdge(eid);openNode(oid)};
  el.querySelectorAll('.gmo,.gml,.gme0').forEach(x=>x.onclick=()=>open(x.dataset.o,x.dataset.e));
  /* 10-22 망령: 「내 인연」에서도 바로 선을 잇는다 — 한쪽은 가운데 사람, 다른 쪽은 아직 안 이어진 노드부터 */
  el.querySelectorAll('[data-gadd]').forEach(x=>x.onclick=()=>editEdge(null,{a:me.id,skip:links.map(l=>l.o.id)}))}
 /* ---------- 10-24 망령: 자동 정리 ----------
    힘 배치(Fruchterman–Reingold): 모든 노드는 서로 밀고, 선으로 이어진 노드는 당긴다(랭크가 높을수록 더 세게 · 짧게).
    PC 는 가운데로 조금 더 당기고, 다 돌면 이름표가 겹치지 않게 벌린다. 정리 전 자리는 「↶ 되돌리기」로 한 번 돌릴 수 있다 */
 let UNDO=null;
 function layout(nodes,edges){const ids=Object.keys(nodes);const N=ids.length;if(!N)return {};
  const E=Object.values(edges||{}).filter(e=>nodes[e.a]&&nodes[e.b]&&e.a!==e.b);
  const deg={};for(const e of E){deg[e.a]=(deg[e.a]||0)+1;deg[e.b]=(deg[e.b]||0)+1}
  /* 처음 자리: 이어진 순서(너비 우선)로 고리에 — 교차가 덜 생긴다. PC 는 안쪽 고리 */
  const adj={};for(const e of E){(adj[e.a]=adj[e.a]||[]).push(e.b);(adj[e.b]=adj[e.b]||[]).push(e.a)}
  const seen=new Set(),ord=[];const start=ids.slice().sort((x,y)=>((nodes[y].kind==='pc')-(nodes[x].kind==='pc'))||((deg[y]||0)-(deg[x]||0)));
  for(const s of start){if(seen.has(s))continue;const q=[s];seen.add(s);while(q.length){const v=q.shift();ord.push(v);for(const w of (adj[v]||[]).slice().sort((x,y)=>(deg[y]||0)-(deg[x]||0)))if(!seen.has(w)){seen.add(w);q.push(w)}}}
  const pcs=ord.filter(id=>nodes[id].kind==='pc'),rest=ord.filter(id=>nodes[id].kind!=='pc');
  const P={};const K=170;
  pcs.forEach((id,i)=>{const a=-Math.PI/2+i*2*Math.PI/Math.max(1,pcs.length);const r=pcs.length>1?Math.max(90,pcs.length*40):0;P[id]={x:Math.cos(a)*r,y:Math.sin(a)*r}});
  const R2=Math.max(260,rest.length*28);rest.forEach((id,i)=>{const a=-Math.PI/2+(i+.5)*2*Math.PI/Math.max(1,rest.length);P[id]={x:Math.cos(a)*R2,y:Math.sin(a)*R2}});
  let T=K*1.5;const IT=500;
  for(let it=0;it<IT;it++){const D={};for(const id of ids)D[id]={x:0,y:0};
   for(let i=0;i<N;i++)for(let j=i+1;j<N;j++){const a=P[ids[i]],b=P[ids[j]];let dx=a.x-b.x,dy=a.y-b.y;let d=Math.hypot(dx,dy);if(d<0.01){dx=(i-j)*.1+.05;dy=.07;d=.1}
    if(d>K*3)continue;const f=K*K/d*(d<150?2:1)*(1-d/(K*3));D[ids[i]].x+=dx/d*f;D[ids[i]].y+=dy/d*f;D[ids[j]].x-=dx/d*f;D[ids[j]].y-=dy/d*f}
   for(const e of E){const a=P[e.a],b=P[e.b];const dx=a.x-b.x,dy=a.y-b.y;const d=Math.max(.01,Math.hypot(dx,dy));const w=.6+Math.min(10,Math.max(0,+e.rank||0))/8;const L=K*(1.15-Math.min(10,+e.rank||0)/25);
    const f=(d*d/L)*w;D[e.a].x-=dx/d*f;D[e.a].y-=dy/d*f;D[e.b].x+=dx/d*f;D[e.b].y+=dy/d*f}
   for(const id of ids){const p=P[id];const g=(nodes[id].kind==='pc'?.08:.04)*(deg[id]?1:1.6);D[id].x-=p.x*g;D[id].y-=p.y*g}
   for(const id of ids){const d=D[id];const l=Math.max(.01,Math.hypot(d.x,d.y));const m=Math.min(l,T);P[id].x+=d.x/l*m;P[id].y+=d.y/l*m}
   T=Math.max(1,T*0.985)}
  /* 이름표(폭 120) 겹침 풀기 */
  for(let pass=0;pass<80;pass++){let moved=false;for(let i=0;i<N;i++)for(let j=i+1;j<N;j++){const a=P[ids[i]],b=P[ids[j]];const dx=b.x-a.x,dy=b.y-a.y;const ox=140-Math.abs(dx),oy=96-Math.abs(dy);if(ox>0&&oy>0){moved=true;if(ox/140<oy/96){const s=(dx>=0?1:-1)*ox/2;a.x-=s;b.x+=s}else{const s=(dy>=0?1:-1)*oy/2;a.y-=s;b.y+=s}}}if(!moved)break}
  const out={};for(const id of ids)out[id]={x:Math.round(P[id].x),y:Math.round(P[id].y)};return out}
 async function applyPos(pos){const g=G();const ops=[];for(const id in pos){const n=(g.nodes||{})[id];if(!n)continue;if(+n.x===pos[id].x&&+n.y===pos[id].y)continue;ops.push([['graph','nodes',id],Object.assign({},n,{x:pos[id].x,y:pos[id].y})])}
  if(!ops.length)return true;return A().setMany(ops)}
 async function autoLayout(el,svg){if(!gm())return;const g=G();const nodes=g.nodes||{};const n=Object.keys(nodes).length;if(n<2)return A().toast('노드가 둘 이상 있어야 정리할 수 있다');
  const before={};for(const id in nodes)before[id]={x:+nodes[id].x||0,y:+nodes[id].y||0};
  const pos=layout(nodes,g.edges);A().toast('관계도를 정리하는 중…');
  if(await applyPos(pos)===false)return;UNDO=before;V.k=1;const s=$('#gsvg',el)||svg;render(el);const s2=$('#gsvg',el);if(s2){fit(s2);render(el)}A().toast(`노드 ${n}개를 다시 놓았다 — 마음에 안 들면 「↶ 되돌리기」`)}
 async function undoLayout(el){if(!gm()||!UNDO)return;const u=UNDO;UNDO=null;if(await applyPos(u)===false){UNDO=u;return}render(el);const s2=$('#gsvg',el);if(s2){fit(s2);render(el)}A().toast('정리 전 배치로 되돌렸다')}
 function fit(svg){const ns=Object.values(G().nodes||{});if(!ns.length){V.x=V.y=0;V.k=1;return}const xs=ns.map(n=>n.x),ys=ns.map(n=>n.y);const minx=Math.min(...xs)-80,maxx=Math.max(...xs)+80,miny=Math.min(...ys)-80,maxy=Math.max(...ys)+80;const r=svg.getBoundingClientRect();V.k=Math.min(3,Math.max(.3,Math.min(r.width/(maxx-minx),r.height/(maxy-miny))));V.x=(r.width-(maxx+minx)*V.k)/2;V.y=(r.height-(maxy+miny)*V.k)/2}

 function openNode(id){const n=G().nodes[id];if(!n)return;if(gm())return editNode(id);
  const links=Object.values(G().edges||{}).filter(e=>e.a===id||e.b===id).map(e=>{const o=G().nodes[e.a===id?e.b:e.a];return `<li>${esc(o?o.name:'?')} <span class="tag">R${+e.rank||0}</span> ${e.shock?'⚡':''} <span class="small dim">${esc(e.label||'')}</span></li>`}).join('');
  A().openModal(`<div class="mhead"><h2>${esc(n.name)} <span class="small dim">${KIND[n.kind]||''}</span></h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="row" style="align-items:flex-start">${A().portraitOf(n.name,n.img)?`<img src="${esc(A().portraitOf(n.name,n.img))}" style="width:96px;height:96px;object-fit:cover;border:2px solid #fff">`:''}<div class="pre small" style="flex:1">${esc(n.note||'')||'<span class="dim">메모 없음</span>'}</div></div>
   <div class="sh" style="margin-top:10px">관계</div><ul class="small">${links||'<li class="dim">없음</li>'}</ul>`)}
 function openEdge(eid){const g=G();const e=(g.edges||{})[eid];if(!e)return;const a=g.nodes[e.a]||{},b=g.nodes[e.b]||{};A().toast(`${a.name||'?'} ↔ ${b.name||'?'} · R${+e.rank||0}${e.label?' · '+e.label:''}${e.shock?' · ⚡ 쇼크'+(e.shockNote?' ('+e.shockNote+')':''):''}`)}
 function editNode(id){const g=G();const n=id?g.nodes[id]:{id:'n'+rnd(6),name:'',kind:'npc',x:Math.round((200-V.x)/V.k),y:Math.round((200-V.y)/V.k),img:'',note:''};
  const md=A().openModal(`<div class="mhead"><h2>${id?'노드 수정':'노드 추가'}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="row"><label>이름 <input type="text" id="nn" value="${esc(n.name)}"></label><label>종류 <select id="nk">${Object.entries(KIND).map(([k,v])=>`<option value="${k}" ${n.kind===k?'selected':''}>${v}</option>`).join('')}</select></label></div>
   <div class="row" style="margin-top:6px"><label style="flex:1">그림 주소 <input type="text" id="ni" value="${esc(n.img||'')}" style="flex:1" placeholder="비우면 같은 이름의 트레이너·포켓몬 초상을 쓴다"></label></div>
   <div style="margin-top:6px"><textarea id="nt" rows="5" style="width:100%" placeholder="메모 (모두가 본다)">${esc(n.note||'')}</textarea></div>
   <div class="row" style="margin-top:10px">${id?`<button class="btn sm ghost danger" id="ndel">삭제</button>`:''}<span class="sp"></span><button class="btn pri" id="nok">저장</button></div>`);
  $('#nok',md).onclick=async()=>{const nn=Object.assign({},n,{name:$('#nn',md).value.trim()||'?',kind:$('#nk',md).value,img:$('#ni',md).value.trim(),note:$('#nt',md).value});A().closeModal();await A().set(['graph','nodes',nn.id],nn)};
  const del=$('#ndel',md);if(del)del.onclick=async()=>{const cnt=Object.values(G().edges||{}).filter(x=>x.a===id||x.b===id).length;if(!confirm(`「${n.name}」를 지울까?${cnt?` 이어진 선 ${cnt}개도 같이 지운다.`:''}`))return;A().closeModal();
   /* 선 → 노드 순서로 하나씩 지운다 (통째로 덮어쓰면 그 사이 다른 변경을 날린다). 트레이너 노드는 지운 표시를 남겨 다시 자동으로 생기지 않게 */
   for(const [k,x] of Object.entries(G().edges||{}))if(x.a===id||x.b===id)await A().set(['graph','edges',k],null);
   const tr=Object.values(((A().ST.state.roster||{}).trainers)||{}).find(t=>t.name===n.name);if(tr)await A().set(['graph','auto',tr.id],-1);
   await A().set(['graph','nodes',id],null);A().toast(`${n.name} 를 지웠다`)}}
 function editEdge(id,pre){const g=G();const ns=Object.values(g.nodes||{});if(ns.length<2)return A().toast('노드가 둘 이상 있어야 한다');pre=pre||{};
  const pa=pre.a&&g.nodes[pre.a]?pre.a:ns[0].id;const pb=(ns.find(n=>n.id!==pa&&!(pre.skip||[]).includes(n.id))||ns.find(n=>n.id!==pa)).id;
  const e=id?g.edges[id]:{id:'e'+rnd(6),a:pa,b:pb,rank:1,label:'',shock:false};
  const sel=(idv,cur)=>`<select id="${idv}">${ns.map(n=>`<option value="${n.id}" ${n.id===cur?'selected':''}>${esc(n.name)}</option>`).join('')}</select>`;
  const md=A().openModal(`<div class="mhead"><h2>${id?'선 수정':'선 추가'}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="row">${sel('ea',e.a)} ↔ ${sel('eb',e.b)}</div>
   <div class="row" style="margin-top:6px"><label>랭크 <input type="number" class="n" id="er" value="${+e.rank||0}" min="0" max="10"></label><label>라벨 <input type="text" id="el" value="${esc(e.label||'')}"></label><label><input type="checkbox" id="es" ${e.shock?'checked':''}> 쇼크</label></div>
   <div class="row" style="margin-top:10px">${id?`<button class="btn sm ghost danger" id="edel">삭제</button>`:''}<span class="sp"></span><button class="btn pri" id="eok">저장</button></div>`);
  $('#eok',md).onclick=async()=>{const ne={id:e.id,a:$('#ea',md).value,b:$('#eb',md).value,rank:+$('#er',md).value||0,label:$('#el',md).value.trim(),shock:$('#es',md).checked};if(ne.a===ne.b)return A().toast('같은 노드끼리는 안 된다');A().closeModal();await A().set(['graph','edges',ne.id],ne)};
  const del=$('#edel',md);if(del)del.onclick=async()=>{if(!confirm('이 선을 지울까?'))return;A().closeModal();await A().set(['graph','edges',id],null);A().toast('선을 지웠다')}}

 return {render,editNode};
})();
