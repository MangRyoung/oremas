/* ---------- 코르크보드 관계도 (칼데아 「마슈의 인물 관계도」에서 옮겨 옴 · 세션 노트와 오레마스가 같은 파일을 쓴다) ----------
   NT_BOARD.mount(el, opt)
     opt.nodes  [{id, name, short, role, img, group, x, y, gmOnly, memo}]   x · y 는 보드 좌표(0~W, 0~H)
     opt.edges  [{id, a, b, kind:'tie'|'doubt'|'secret', label, glabel, gmOnly, redacted}]
     opt.groups {id:{name,color}}   핀 색 · 필터 칩
     opt.W, opt.H (기본 2200×1400) · opt.key (화면 상태 localStorage 키) · opt.notes [{x,y,kind:'sticky'|'quote',html}]
     opt.canEdit · opt.onMove(id,x,y) · opt.dossier(id)→html · opt.onEdge(id) · opt.onLink(a,b) · opt.onNew(x,y) · opt.onEmpty()→html
   반환 {select(id), relayout(), destroy()} */
"use strict";
window.NT_BOARD=(()=>{
 const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const NS='http://www.w3.org/2000/svg';
 const hash=s=>{let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return h};
 const SIL='<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="34" r="20"/><path d="M12 100c2-26 18-40 38-40s36 14 38 40z"/></svg>';
 const PAL=['#d22a2a','#2f6fd0','#e3b51e','#2f9a52','#8a4fc4','#e07a2f','#1b9aaa','#b5438c','#6b7280','#1b1b1b'];
 function mount(el,opt){const W=opt.W||2200,H=opt.H||1400;const key=opt.key||'nt-board';const D={nodes:opt.nodes||[],edges:opt.edges||[],groups:opt.groups||{}};const byId={};D.nodes.forEach(n=>byId[n.id]=n);
  let scale=1,sel=null,linkFrom=null,labels=false;const hidden={};try{const s=JSON.parse(localStorage.getItem(key+':ui')||'{}');labels=!!s.labels;Object.assign(hidden,s.hidden||{})}catch(e){}
  const saveUi=()=>{try{localStorage.setItem(key+':ui',JSON.stringify({labels,hidden}))}catch(e){}};
  const gcol=g=>(D.groups[g]&&D.groups[g].color)||PAL[Math.abs(hash(String(g||'')))%PAL.length];
  el.innerHTML=`<div class="cb-top"><div class="cb-groups"></div><span class="cb-sp"></span>${opt.canEdit?`<button type="button" class="cb-btn" data-cb="link">🧵 실 잇기</button><button type="button" class="cb-btn" data-cb="new">＋ 인물</button>`:''}<button type="button" class="cb-btn" data-cb="labels" aria-pressed="${labels}">${labels?'실 메모 숨기기':'실 메모 보기'}</button><span class="cb-sep"></span><button type="button" class="cb-btn" data-cb="out" title="축소">−</button><button type="button" class="cb-btn" data-cb="fit">맞춤</button><button type="button" class="cb-btn" data-cb="in" title="확대">+</button></div>
   <div class="cb-wrap"><div class="cb-vp"><div class="cb-sizer"><div class="cb-frame"><span class="cap1"></span><span class="cap2"></span><div class="cb-board ${labels?'labels':''}" style="width:${W}px;height:${H}px"><svg class="cb-strings"></svg></div></div></div></div>
   <aside class="cb-dossier" data-tab="CASE FILE"></aside></div>`;
  const vp=el.querySelector('.cb-vp'),sizer=el.querySelector('.cb-sizer'),frame=el.querySelector('.cb-frame'),board=el.querySelector('.cb-board'),svg=el.querySelector('.cb-strings'),dos=el.querySelector('.cb-dossier'),gbox=el.querySelector('.cb-groups');
  frame.style.width=(W+40)+'px';frame.style.height=(H+40)+'px';
  /* 그룹 칩 */
  const gs=[...new Set(D.nodes.map(n=>n.group||''))];gs.forEach(g=>{const b=document.createElement('button');b.type='button';b.className='cb-chip';b.setAttribute('aria-pressed',hidden[g]?'false':'true');b.innerHTML=`<i style="background:${gcol(g)}"></i>${esc((D.groups[g]&&D.groups[g].name)||g||'기타')}`;b.onclick=()=>{hidden[g]=!hidden[g];b.setAttribute('aria-pressed',hidden[g]?'false':'true');saveUi();applyHidden()};gbox.appendChild(b)});
  /* 카드 */
  const cards={},pins={},pos={};
  D.nodes.forEach(n=>{pos[n.id]={x:+n.x||W/2,y:+n.y||H/2};const c=document.createElement('div');c.className='cb-card'+(n.img?'':' memo')+(n.gmOnly?' gmonly':'');c.tabIndex=0;c.dataset.id=n.id;const r=((hash(n.id)%9)-4)*.8;c.style.transform=`rotate(${r}deg)`;
   c.innerHTML=(n.img?`<div class="ph"><div class="tok" style="background-image:url('${String(n.img).replace(/'/g,'%27')}')"></div></div>`:`<div class="ph">${SIL}</div>`)+`<p class="nm">${esc(n.short||n.name)}</p><p class="rl">${esc(n.role||'')}</p>`;
   board.appendChild(c);cards[n.id]=c;const p=document.createElement('i');p.className='cb-pin';p.style.setProperty('--pc',gcol(n.group));board.appendChild(p);pins[n.id]=p;drag(c,n.id);
   c.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(n.id)}})});
  const anchor=id=>({x:pos[id].x,y:pos[id].y-82});
  const place=id=>{const p=pos[id],c=cards[id];if(!c)return;c.style.left=(p.x-68)+'px';c.style.top=(p.y-88)+'px';const a=anchor(id);pins[id].style.left=a.x+'px';pins[id].style.top=a.y+'px'};
  /* 실 */
  const pairCount={};D.edges=D.edges.filter(e=>byId[e.a]&&byId[e.b]);
  D.edges.forEach(e=>{const k=[e.a,e.b].sort().join('|');e.k=pairCount[k]=(pairCount[k]||0)+1;
   e.sh=document.createElementNS(NS,'path');e.sh.setAttribute('class','sh');e.el=document.createElementNS(NS,'path');e.el.setAttribute('class','str '+(e.kind||'tie')+(e.gmOnly?' gm':''));e.hit=document.createElementNS(NS,'path');e.hit.setAttribute('class','hit');e.hit.setAttribute('stroke','transparent');e.hit.setAttribute('stroke-width','16');e.hit.setAttribute('fill','none');
   svg.appendChild(e.sh);svg.appendChild(e.el);svg.appendChild(e.hit);
   const t=document.createElement('div');t.className='cb-tag '+(e.kind||'tie');t.style.setProperty('--r',(((hash(e.a+e.b)%7)-3)*1.2)+'deg');t.innerHTML=(e.redacted?'<span class="bar">██████</span>':esc(e.label||''))+(e.glabel?`<span class="g">· ${esc(e.glabel)}</span>`:'')+(e.gmOnly?'<span class="g">🔒</span>':'');board.appendChild(t);e.tag=t;
   e.hit.addEventListener('mouseenter',()=>t.classList.add('on'));e.hit.addEventListener('mouseleave',()=>t.classList.remove('on'));e.hit.addEventListener('click',ev=>{ev.stopPropagation();if(opt.onEdge)opt.onEdge(e.id)})});
  function route(e){const A=anchor(e.a),B=anchor(e.b),dx=B.x-A.x,dy=B.y-A.y,L=Math.hypot(dx,dy)||1;const sag=Math.min(90,L*.1)+(e.k-1)*34;let mx=(A.x+B.x)/2,my=(A.y+B.y)/2+sag;if(e.k>1)mx+=-dy/L*(e.k-1)*26;const d=`M${A.x} ${A.y} Q${mx} ${my} ${B.x} ${B.y}`;e.el.setAttribute('d',d);e.sh.setAttribute('d',d);e.hit.setAttribute('d',d);e.tag.style.left=(.25*A.x+.5*mx+.25*B.x)+'px';e.tag.style.top=(.25*A.y+.5*my+.25*B.y)+'px'}
  function layoutAll(){D.nodes.forEach(n=>place(n.id));D.edges.forEach(route)}
  /* 메모지 */
  (opt.notes||[]).forEach(nt=>{const d=document.createElement('div');d.className='cb-note '+(nt.kind||'sticky');d.style.left=nt.x+'px';d.style.top=nt.y+'px';d.innerHTML='<span class="tape"></span>'+nt.html;board.appendChild(d)});
  function applyHidden(){D.nodes.forEach(n=>{const h=!!hidden[n.group||''];cards[n.id].classList.toggle('hide',h);pins[n.id].classList.toggle('hide',h)});D.edges.forEach(e=>{const h=hidden[byId[e.a].group||'']||hidden[byId[e.b].group||''];[e.el,e.sh,e.hit].forEach(x=>x.style.display=h?'none':'');e.tag.classList.toggle('hide',!!h)});if(sel&&hidden[byId[sel].group||''])select(null)}
  function select(id,keep){sel=(id===sel&&!keep)?null:id;board.classList.toggle('focus',!!sel);D.nodes.forEach(n=>cards[n.id].classList.remove('rel','sel'));
   D.edges.forEach(e=>{const on=sel&&(e.a===sel||e.b===sel);[e.el,e.sh].forEach(x=>x.classList.toggle('rel',!!on));e.tag.classList.toggle('rel',!!on);if(on){cards[e.a].classList.add('rel');cards[e.b].classList.add('rel')}});
   if(!sel){dos.dataset.tab='CASE FILE';dos.innerHTML=opt.onEmpty?opt.onEmpty():'<p class="empty">보드에서 인물 한 명을 골라 주세요.</p>';return}
   cards[sel].classList.add('rel','sel');const n=byId[sel];dos.dataset.tab='CASE FILE No.'+('0'+(D.nodes.indexOf(n)+1)).slice(-2)+(n.group?' · '+esc((D.groups[n.group]||{}).name||n.group):'');
   dos.innerHTML=opt.dossier?opt.dossier(sel,{edges:D.edges.filter(e=>e.a===sel||e.b===sel),byId}):`<h2>${esc(n.name)}</h2>`;
   dos.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{const t=b.dataset.go;sel=null;select(t);scrollTo(t)})}
  function scrollTo(id){const p=pos[id];if(!p)return;vp.scrollTo({left:(p.x+20)*scale-vp.clientWidth/2,top:(p.y+20)*scale-vp.clientHeight/2,behavior:'smooth'})}
  board.addEventListener('click',e=>{if(e.target===board||e.target===svg){if(linkFrom){linkFrom=null;el.querySelectorAll('.cb-card.from').forEach(c=>c.classList.remove('from'));return}select(null)}});
  board.addEventListener('dblclick',e=>{if(!opt.canEdit||!opt.onNew)return;if(e.target!==board&&e.target!==svg)return;const r=board.getBoundingClientRect();opt.onNew((e.clientX-r.left)/scale,(e.clientY-r.top)/scale)});
  function drag(c,id){let sx,sy,ox,oy,moved=false,pid=null;
   c.addEventListener('pointerdown',e=>{if(e.button!==0)return;pid=e.pointerId;c.setPointerCapture(pid);sx=e.clientX;sy=e.clientY;ox=pos[id].x;oy=pos[id].y;moved=false});
   c.addEventListener('pointermove',e=>{if(pid!==e.pointerId)return;const dx=(e.clientX-sx)/scale,dy=(e.clientY-sy)/scale;if(!moved&&Math.hypot(dx,dy)<4)return;moved=true;pos[id]={x:Math.max(70,Math.min(W-70,ox+dx)),y:Math.max(95,Math.min(H-95,oy+dy))};place(id);D.edges.forEach(ed=>{if(ed.a===id||ed.b===id)route(ed)})});
   c.addEventListener('pointerup',e=>{if(pid!==e.pointerId)return;pid=null;if(moved){if(opt.canEdit&&opt.onMove)opt.onMove(id,Math.round(pos[id].x),Math.round(pos[id].y));else{try{const o=JSON.parse(localStorage.getItem(key+':pos')||'{}');o[id]=[Math.round(pos[id].x),Math.round(pos[id].y)];localStorage.setItem(key+':pos',JSON.stringify(o))}catch(x){}}return}
    if(board.classList.contains('linkmode')){if(!linkFrom){linkFrom=id;c.classList.add('from')}else if(linkFrom!==id){if(opt.onLink)opt.onLink(linkFrom,id);linkFrom=null;el.querySelectorAll('.cb-card.from').forEach(x=>x.classList.remove('from'))}return}
    select(id)})}
  /* PL(편집 못 하는 쪽)은 자기 브라우저에 둔 자리로 */
  if(!opt.canEdit){try{const o=JSON.parse(localStorage.getItem(key+':pos')||'{}');for(const id in o)if(pos[id])pos[id]={x:o[id][0],y:o[id][1]}}catch(e){}}
  function setScale(s){scale=Math.max(.15,Math.min(1.4,s));frame.style.transform=`scale(${scale})`;sizer.style.width=((W+40)*scale)+'px';sizer.style.height=((H+40)*scale)+'px'}
  const fit=()=>setScale(Math.min(vp.clientWidth/(W+40),1));
  el.querySelector('.cb-top').addEventListener('click',e=>{const b=e.target.closest('[data-cb]');if(!b)return;const k=b.dataset.cb;
   if(k==='in')setScale(scale*1.2);else if(k==='out')setScale(scale/1.2);else if(k==='fit')fit();
   else if(k==='labels'){labels=!labels;board.classList.toggle('labels',labels);b.setAttribute('aria-pressed',labels);b.textContent=labels?'실 메모 숨기기':'실 메모 보기';saveUi()}
   else if(k==='new'&&opt.onNew){opt.onNew(vp.scrollLeft/scale+vp.clientWidth/scale/2,vp.scrollTop/scale+vp.clientHeight/scale/2)}
   else if(k==='link'){linkFrom=null;el.querySelectorAll('.cb-card.from').forEach(x=>x.classList.remove('from'));b.classList.toggle('on');board.classList.toggle('linkmode',b.classList.contains('on'));b.textContent=b.classList.contains('on')?'🧵 실 잇기 중 — 두 사람을 차례로':'🧵 실 잇기'}});
  layoutAll();applyHidden();fit();select(null);
  const ro=window.ResizeObserver?new ResizeObserver(()=>{if(scale>vp.clientWidth/(W+40))fit()}):null;if(ro)ro.observe(vp);
  return {select:id=>{select(id,true);scrollTo(id)},relayout:layoutAll,destroy:()=>{if(ro)ro.disconnect()}}}
 return {mount};
})();
