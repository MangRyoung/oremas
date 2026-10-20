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
  const g=G();const nodes=g.nodes||{},edges=g.edges||{};
  const nodeSvg=Object.values(nodes).map(n=>{const r=n.kind==='pc'?30:n.kind==='org'?26:22;const nimg=A().portraitOf(n.name,n.img);
   return `<g class="gn ${n.kind||'npc'}" data-n="${n.id}" transform="translate(${n.x||0},${n.y||0})" style="cursor:${gm()?'grab':'pointer'}">
    ${n.kind==='org'?`<rect x="${-r}" y="${-r}" width="${r*2}" height="${r*2}" transform="rotate(45)" fill="#111" stroke="${n.color||'#fff'}" stroke-width="3"/>`:`<circle r="${r+4}" fill="${n.kind==='pc'?'var(--red)':'#fff'}"/><circle r="${r}" fill="#222"/>`}
    ${nimg?`<clipPath id="cp_${n.id}"><circle r="${r-1}"/></clipPath><image href="${esc(nimg)}" x="${-r}" y="${-r}" width="${r*2}" height="${r*2}" clip-path="url(#cp_${n.id})" preserveAspectRatio="xMidYMid slice"/>`:`<text y="6" text-anchor="middle" font-size="16" fill="#fff" font-family="var(--lab)">${esc((n.name||'?').slice(0,2))}</text>`}
    <g transform="translate(0,${r+16})"><rect x="-60" y="-11" width="120" height="20" fill="#000" stroke="${n.kind==='pc'?'var(--red)':'#fff'}" stroke-width="2" transform="skewX(-8)"/><text y="4" text-anchor="middle" font-size="12" fill="#fff" font-family="var(--lab)">${esc(n.name||'')}</text></g></g>`}).join('');
  const edgeSvg=Object.values(edges).map(e=>{const a=nodes[e.a],b=nodes[e.b];if(!a||!b)return '';const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;const w=1+Math.min(5,+e.rank||0);
   return `<g class="ge" data-e="${e.id}"><line pointer-events="none" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${e.shock?'var(--red)':'#fff'}" stroke-width="${w}" ${e.shock?'stroke-dasharray="8 5"':''} opacity=".85"/>
    <g class="gel" transform="translate(${mx},${my})" style="cursor:pointer"><rect x="-16" y="-9" width="32" height="18" fill="${e.shock?'var(--red)':'#fff'}" transform="skewX(-10)"/><text y="4" text-anchor="middle" font-size="11" font-family="var(--lab)" fill="${e.shock?'#fff':'#000'}">${e.shock?'⚡':''}R${+e.rank||0}</text>${e.label?`<text y="22" text-anchor="middle" font-size="10" fill="#ccc">${esc(e.label)}</text>`:''}</g></g>`}).join('');
  el.innerHTML=`<div class="gtop"><button class="btn xs" data-z="in">＋</button><button class="btn xs" data-z="out">－</button><button class="btn xs ghost" data-z="fit">맞추기</button>
    <span class="small dim">끌어서 이동 · 휠로 확대 · 노드를 누르면 자세히${gm()?' · GM: 노드를 끌어서 배치':''}</span><span class="sp"></span>
    ${gm()?`<button class="btn sm" data-g="addn">+ 노드</button><button class="btn sm" data-g="adde">+ 선</button>`:''}</div>
   <div class="gwrap"><svg id="gsvg" width="100%" height="100%"><defs><pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#2a2a2a"/></pattern></defs>
    <rect width="100%" height="100%" fill="url(#dots)"/><g id="gview" transform="translate(${V.x},${V.y}) scale(${V.k})">${edgeSvg}${nodeSvg}</g></svg>
    <div class="glegend"><b>관계도</b><div class="small">빨간 테두리 = PC, 흰 테두리 = NPC, 마름모 = 조직. 선 굵기와 R 숫자가 관계 랭크, 빨간 점선과 ⚡가 쇼크.</div></div></div>`;
  const svg=$('#gsvg',el);
  el.querySelectorAll('[data-z]').forEach(b=>b.onclick=()=>{if(b.dataset.z==='in')V.k=Math.min(3,V.k*1.2);if(b.dataset.z==='out')V.k=Math.max(.3,V.k/1.2);if(b.dataset.z==='fit')fit(svg);render(el)});
  el.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>b.dataset.g==='addn'?editNode(null):editEdge(null));
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
 function editEdge(id){const g=G();const ns=Object.values(g.nodes||{});if(ns.length<2)return A().toast('노드가 둘 이상 있어야 한다');const e=id?g.edges[id]:{id:'e'+rnd(6),a:ns[0].id,b:ns[1].id,rank:1,label:'',shock:false};
  const sel=(idv,cur)=>`<select id="${idv}">${ns.map(n=>`<option value="${n.id}" ${n.id===cur?'selected':''}>${esc(n.name)}</option>`).join('')}</select>`;
  const md=A().openModal(`<div class="mhead"><h2>${id?'선 수정':'선 추가'}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="row">${sel('ea',e.a)} ↔ ${sel('eb',e.b)}</div>
   <div class="row" style="margin-top:6px"><label>랭크 <input type="number" class="n" id="er" value="${+e.rank||0}" min="0" max="10"></label><label>라벨 <input type="text" id="el" value="${esc(e.label||'')}"></label><label><input type="checkbox" id="es" ${e.shock?'checked':''}> 쇼크</label></div>
   <div class="row" style="margin-top:10px">${id?`<button class="btn sm ghost danger" id="edel">삭제</button>`:''}<span class="sp"></span><button class="btn pri" id="eok">저장</button></div>`);
  $('#eok',md).onclick=async()=>{const ne={id:e.id,a:$('#ea',md).value,b:$('#eb',md).value,rank:+$('#er',md).value||0,label:$('#el',md).value.trim(),shock:$('#es',md).checked};if(ne.a===ne.b)return A().toast('같은 노드끼리는 안 된다');A().closeModal();await A().set(['graph','edges',ne.id],ne)};
  const del=$('#edel',md);if(del)del.onclick=async()=>{if(!confirm('이 선을 지울까?'))return;A().closeModal();await A().set(['graph','edges',id],null);A().toast('선을 지웠다')}}

 return {render,editNode};
})();
