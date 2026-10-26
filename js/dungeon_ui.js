/* ---------- 던전 탭 (2026-10-26 망령: 「페르소나 플레이 툴(VELVET PLAY)에 던전 기능이 있으면 추출해서 넣고 싶다」) ----------
   VELVET PLAY 의 「VELVET DUNGEON」(타운맵 탭의 던전 모드)을 오레마스 구조로 옮겼다 — 방 연결 지도 · 안개 · 경계도 · 진입/귀환 컷인 · 편집기.
   달라진 점: Firebase → 방 상태(state.dg) · 페르소나 규칙 문구(섀도 · 아르카나 · +1d) → 망켓몬에 맞춘 중립 문구 · 조우 버튼은 배틀 무대로 넘긴다.
   데이터 (GM 만 쓴다 — 좌석은 dg 를 쓸 수 없다)
     state.dg.field = {mode:'dungeon'|'', did, t}          지금 들어가 있는 던전
     state.dg.list[did] = {n 이름, o 주인, a 테마, d 기한, al 경계도 0~100, at 일행 위치, st 시작 방,
                           r:{rid:{n 이름, t 종류, x, y, s 공개(1), c 클리어(1), b 배경 그림 주소, m GM 메모}}, l:{'a~b':1} 통로}
   화면: 던전이 열리면 모두의 화면이 「던전」 탭으로 넘어가고(컷인), 닫히면 원래 무대로 돌아간다. GM 에게는 늘 탭이 보인다(관리). */
"use strict";
window.OM_DG_UI=(()=>{
 const A=()=>window.OM_APP, DBS=()=>window.OM_STORE;
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const H=esc;const $=(s,r)=>(r||document).querySelector(s);
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const TY={
  entry:{k:'입구',en:'ENTRANCE',ic:'⛩',c:'#59b6ff',h:16,r:'던전으로 들어오고 나가는 곳. 여기서 돌아가면 이번 탐색이 끝난다.'},
  room:{k:'통로',en:'PASSAGE',ic:'◇',c:'#8fa3bf',h:10,r:'특별한 것은 보이지 않는다. 스킬 체크로 살피면 숨은 것을 찾을 수도 있다.'},
  battle:{k:'조우 구역',en:'ENCOUNTER',ic:'☠',c:'#ff4d5e',h:18,r:'적이 배회한다. 몰래 지나가거나 맞서 싸운다. 들키면 경계도가 오른다.'},
  trap:{k:'함정·기믹',en:'GIMMICK',ic:'⚙',c:'#ffa53a',h:14,r:'장치가 길을 막는다. 스킬 체크나 포켓몬의 기술로 돌파한다. 실패하면 피해나 경계도 상승.'},
  puzzle:{k:'수수께끼',en:'PUZZLE',ic:'✦',c:'#c58bff',h:14,r:'머리를 쓰는 시험. 단서를 모아 풀어 낸다.'},
  treasure:{k:'보물',en:'TREASURE',ic:'◆',c:'#ffd84a',h:12,r:'보물이나 단서가 있다. 무엇이 들었는지는 GM 이 알려 준다.'},
  safe:{k:'세이프룸',en:'SAFE ROOM',ic:'☗',c:'#3ee0a1',h:16,r:'경계도가 오르지 않는 안전한 곳. 숨을 고를 수 있고, 다음 진입 때 여기서 시작할 수 있다.'},
  boss:{k:'심층부',en:'DEPTHS',ic:'♛',c:'#ff2a6d',h:30,r:'던전의 주인이 기다리는 곳. 결전이 벌어진다.'}};
 const TORDER=Object.keys(TY);
 const LV=[[0,'평온','CALM','아직 아무도 눈치채지 못했다.'],[30,'경계','ALERT','무언가 낌새를 챘다. 조우가 늘어날 수 있다.'],[70,'위험','DANGER','적이 경계 태세다. 세이프룸 밖에서는 쉴 수 없다.'],[100,'퇴출','LOCKDOWN','더 버틸 수 없다! 일행은 던전 밖으로 밀려난다.']];
 const lvOf=a=>LV.reduce((r,l,i)=>a>=l[0]?i:r,0);
 const LVC=['#3ee0a1','#ffd84a','#ff7a2f','#ff2a3d'];
 const DG={prev:null,sel:'',frame:'',ed:'',edSel:'',edMode:'move',edFrom:'',drag:null,mapSig:'',tiltRaf:0,edOpen:false};
 const ST=()=>A().ST;const gm=()=>ST().role==='gm';
 const ty=t=>TY[t]||TY.room;
 const D0=()=>ST().state.dg||{};
 const field=()=>D0().field||{};
 const all=()=>D0().list||{};
 const cur=()=>{const f=field(),d=f.mode==='dungeon'&&all()[f.did];return d?Object.assign({},d,{id:f.did}):null};
 const on=()=>!!cur();
 const R=d=>(d&&d.r)||{};
 const lk=(a,b)=>a<b?a+'~'+b:b+'~'+a;
 const links=d=>Object.keys((d&&d.l)||{}).map(k=>k.split('~')).filter(([a,b])=>R(d)[a]&&R(d)[b]);
 const nbrs=(d,id)=>links(d).flatMap(([a,b])=>a===id?[b]:b===id?[a]:[]);
 const rid=d=>{let k;do k=Math.random().toString(36).slice(2,7);while(R(d)[k]);return k};
 const shade=(hex,f)=>{const n=parseInt(String(hex).slice(1),16),m=x=>Math.round(f<0?x*(1+f):x+(255-x)*f);return`rgb(${m(n>>16)},${m(n>>8&255)},${m(n&255)})`};
 const rng=s=>{let h=2166136261;for(const ch of String(s))h=Math.imul(h^ch.charCodeAt(0),16777619);return()=>{h=Math.imul(h^h>>>15,2246822507);h=Math.imul(h^h>>>13,3266489909);return((h^=h>>>16)>>>0)/4294967296}};
 const setH=(el,h)=>{if(el&&el._h!==h){el.innerHTML=h;el._h=h}};

 /* ---------- 쓰기 (GM 만) — {'list/<id>/at': v} 꼴을 경로 배열로 바꿔 한꺼번에 ---------- */
 async function upd(o){if(!gm()){A().toast('던전은 GM 만 바꿀 수 있어');return false}
  const ops=Object.entries(o).map(([k,v])=>[['dg',...k.split('/')],v===undefined?null:v]);
  try{const ok=await A().setMany(ops);return ok!==false}catch(e){A().toast('던전 저장 실패: '+e.message);return false}}
 const P0=id=>'list/'+id+'/';
 const notice=t=>{try{A().sysLog(t)}catch(e){}};
 const whoosh=()=>{try{if(window.OM_CUTIN&&window.OM_CUTIN.synth)window.OM_CUTIN.synth('slam')}catch(e){}};

 /* ---------- 아이소메트릭 지도 (VELVET 그대로) ---------- */
 const K=.866,RW=54;
 const P=(u,v,z=0)=>[(u-v)*K,(u+v)*.5-z];
 const pts=a=>a.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
 const hOf=r=>ty(r.t).h*1.5;
 function prism(u,v,h){const q=[[u-RW,v-RW],[u+RW,v-RW],[u+RW,v+RW],[u-RW,v+RW]],f=(p,z)=>P(p[0],p[1],z);
  return{top:q.map(p=>f(p,h)),inset:[[u-RW+9,v-RW+9],[u+RW-9,v-RW+9],[u+RW-9,v+RW-9],[u-RW+9,v+RW-9]].map(p=>f(p,h)),left:[f(q[3],0),f(q[2],0),f(q[2],h),f(q[3],h)],right:[f(q[2],0),f(q[1],0),f(q[1],h),f(q[2],h)],base:q.map(p=>f(p,0)),c:f([u,v],h),f0:f([u,v],0)}}
 function strip(a,b,w,z){const du=b[0]-a[0],dv=b[1]-a[1],L=Math.hypot(du,dv)||1,nu=-dv/L*w,nv=du/L*w;return[P(a[0]+nu,a[1]+nv,z),P(b[0]+nu,b[1]+nv,z),P(b[0]-nu,b[1]-nv,z),P(a[0]-nu,a[1]-nv,z)]}
 function mapBuild(d,isGm){
  const rs=R(d),at=d.at,vis=id=>isGm||(rs[id]&&rs[id].s)||id===at,ids=Object.keys(rs).filter(vis),xs=[],ys=[],add=p=>{xs.push(p[0]);ys.push(p[1])};
  const uv=id=>[+rs[id].x||0,+rs[id].y||0];
  let defs='',floor='',cor='',body='',lab='',party='';const used=new Set,holes=[],asks=[];
  links(d).forEach(([a,b],i)=>{const va=vis(a),vb=vis(b);if(!va&&!vb)return;let A1=uv(a),B1=uv(b),stub=false;
   if(!va||!vb){if(!va)[A1,B1]=[B1,A1];B1=[A1[0]+(B1[0]-A1[0])*.8,A1[1]+(B1[1]-A1[1])*.8];stub=true;asks.push(P(B1[0],B1[1],10))}
   const sh=strip([A1[0]+6,A1[1]+6],[B1[0]+6,B1[1]+6],15,0),tp=strip(A1,B1,14,4);sh.concat(tp).forEach(add);
   let fill='#26304a';if(stub){const p1=P(A1[0],A1[1]),p2=P(B1[0],B1[1]);defs+=`<linearGradient id="dgS${i}" gradientUnits="userSpaceOnUse" x1="${p1[0].toFixed(1)}" y1="${p1[1].toFixed(1)}" x2="${p2[0].toFixed(1)}" y2="${p2[1].toFixed(1)}"><stop offset="0" stop-color="#2c3756"/><stop offset=".55" stop-color="#2c3756"/><stop offset="1" stop-color="#2c3756" stop-opacity="0"/></linearGradient>`;fill=`url(#dgS${i})`}
   cor+=`<polygon points="${pts(sh)}" fill="#000" opacity=".45"/><polygon points="${pts(tp)}" fill="${fill}" stroke="${stub?'none':'rgba(140,170,230,.35)'}" stroke-width="1.5"/>`});
  ids.sort((a,b)=>(uv(a)[0]+uv(a)[1])-(uv(b)[0]+uv(b)[1])).forEach(id=>{const r=rs[id],t=ty(r.t),[u,v]=uv(id),h=hOf(r),pr=prism(u,v,h),here=id===at,fog=isGm&&!r.s&&!here;const tk=r.t in TY?r.t:'room';
   used.add(tk);[...pr.base,...pr.top].forEach(add);holes.push([pr.f0[0],pr.f0[1]-h/2,here?150:120]);
   const sh=prism(u+10,v+8,0).base;
   lab+=`<text class="nm${fog?' fogged':''}" x="${pr.c[0].toFixed(1)}" y="${(pr.f0[1]+RW*.9).toFixed(1)}">${H(fog?'(안개) '+(r.n||t.k):r.n||t.k)}</text>`;
   body+=`${here?`<ellipse class="dg-pulse" cx="${pr.f0[0].toFixed(1)}" cy="${pr.f0[1].toFixed(1)}" rx="${RW*1.9}" ry="${RW*1.1}"/>`:''}<g class="dg-node${id===DG.sel?' sel':''}${fog?' fogged':''}" data-a="pick" data-v="${H(id)}"><polygon points="${pts(sh)}" fill="#000" opacity=".4"/><polygon points="${pts(pr.left)}" fill="${shade(t.c,-.48)}"/><polygon points="${pts(pr.right)}" fill="${shade(t.c,-.68)}"/><polygon class="tp" points="${pts(pr.top)}" fill="url(#dgT_${tk})"/><polygon points="${pts(pr.inset)}" fill="none" stroke="rgba(255,255,255,.38)" stroke-width="1.2"/>${r.c?`<polygon points="${pts(pr.top)}" fill="#000" opacity=".38"/>`:''}<text class="ic" x="${pr.c[0].toFixed(1)}" y="${pr.c[1].toFixed(1)}">${r.c?'✓':t.ic}</text></g>`;
   if(here)party=`<g class="dg-party" transform="translate(${pr.c[0].toFixed(1)} ${(pr.c[1]-34).toFixed(1)})"><g class="bob"><ellipse cx="0" cy="30" rx="12" ry="5" fill="#000" opacity=".35"/><polygon points="0,-24 12,-2 0,20 -12,-2" fill="var(--dg-acc)" stroke="#fff" stroke-width="2"/><polygon points="0,-24 12,-2 0,0" fill="#fff" opacity=".45"/></g></g>`});
  used.forEach(k=>{const c=TY[k].c;defs+=`<linearGradient id="dgT_${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(c,.35)}"/><stop offset="1" stop-color="${c}"/></linearGradient>`});
  if(!xs.length){xs.push(-300,300);ys.push(-150,250)}
  let x0=Math.min(...xs)-70,x1=Math.max(...xs)+70,y0=Math.min(...ys)-80,y1=Math.max(...ys)+60;
  const cx=(x0+x1)/2,cy=(y0+y1)/2,w=Math.max(x1-x0,620,(y1-y0)*1.6),hh=Math.max(y1-y0,w/1.6);x0=cx-w/2;y0=cy-hh/2;
  const grid=[];for(let k=-2000;k<=3000;k+=100){grid.push(`M${pts([P(k,-2000)])}L${pts([P(k,3000)])}M${pts([P(-2000,k)])}L${pts([P(3000,k)])}`)}
  floor=`<path d="${grid.join('')}" stroke="rgba(120,150,220,.09)" stroke-width="1.5" fill="none"/>`;
  return{vb:`${x0.toFixed(0)} ${y0.toFixed(0)} ${w.toFixed(0)} ${hh.toFixed(0)}`,box:[x0,y0,w,hh],svg:`<defs>${defs}</defs>${floor}${cor}${body}${party}`,lab,holes,asks:isGm?[]:asks}}
 function fogBuild(box,holes,seed,isGm,asks,lab){asks=asks||[];
  const[x,y,w,h]=box,r=rng(seed),cl=[];for(let i=0;i<26;i++){const cr=w*(.08+r()*.14);cl.push(`<circle cx="${(x+r()*w).toFixed(0)}" cy="${(y+r()*h).toFixed(0)}" r="${cr.toFixed(0)}" fill="url(#dgCl)" opacity="${(.25+r()*.4).toFixed(2)}"/>`)}
  return`<defs><radialGradient id="dgHo"><stop offset="0" stop-color="#000"/><stop offset=".5" stop-color="#000"/><stop offset="1" stop-color="#fff"/></radialGradient><radialGradient id="dgCl"><stop offset="0" stop-color="#9aa8c8"/><stop offset="1" stop-color="#9aa8c8" stop-opacity="0"/></radialGradient><mask id="dgFm" maskUnits="userSpaceOnUse" x="${x-50}" y="${y-50}" width="${w+100}" height="${h+100}"><rect x="${x-50}" y="${y-50}" width="${w+100}" height="${h+100}" fill="#fff"/>${holes.map(([hx,hy,hr])=>`<circle cx="${hx.toFixed(0)}" cy="${hy.toFixed(0)}" r="${hr}" fill="url(#dgHo)"/>`).join('')}</mask></defs><g mask="url(#dgFm)" opacity="${isGm?.32:1}"><rect x="${x-50}" y="${y-50}" width="${w+100}" height="${h+100}" fill="#06080f" opacity=".9"/>${cl.join('')}</g>${asks.map(([ax,ay])=>`<text class="dg-ask" x="${ax.toFixed(0)}" y="${ay.toFixed(0)}">?</text>`).join('')}<g class="dg-labels">${lab}</g>`}

 /* ---------- 화면 ---------- */
 const mapMode=()=>{try{return localStorage.getItem('om_dg_map')||''}catch(e){return''}};
 function shell(){return`<div class="dg" id="dgRoot"><div class="dg-layout"><div class="dg-stage" id="dgStage"><div class="dg-planes"></div><div class="dg-hud" id="dgHud"></div>
  <div class="dg-dock ${mapMode()}" id="dgDock"><div class="dg-dock-tools"><button type="button" data-a="mapMode" data-v="big" title="지도 크게 보기 / 원래대로">⤢</button><button type="button" data-a="mapMode" data-v="min" title="지도 접기 / 펴기">▾</button></div>
  <div class="dg-map3d" id="dgMap"><div class="dg-tilt"><svg id="dgIso" preserveAspectRatio="xMidYMid meet"></svg><svg class="dg-fog" id="dgFog" preserveAspectRatio="xMidYMid meet"></svg></div><div class="dg-haze"></div><div class="dg-map-cap" id="dgCap"></div></div></div></div>
  <div class="dg-sidewrap"><div class="dg-side" id="dgSide"></div><div class="dg-legend" id="dgLegend"></div></div></div></div>`}
 function frameHTML(d){const r=R(d)[d.at],t=ty(r&&r.t),src=r&&r.b?String(r.b):'';
  if(src)return[`img:${d.at}|${src}`,`<img src="${H(src)}" alt="${H((r&&r.n)||t.k)}" decoding="async">`];
  return[`fb:${d.at}|${r&&r.t}`,`<div class="dg-fb-room"><i class="dg-fb-ceil"></i><i class="dg-fb-wall l"></i><i class="dg-fb-wall r"></i><i class="dg-fb-back"></i><i class="dg-fb-floor"></i></div><b class="dg-fb-ic">${t.ic}</b><span class="dg-fb-en">${t.en}</span>`]}
 /* 던전이 꺼져 있을 때 (GM 만 보는 화면): 준비한 던전 목록 · 진입 · 관리 */
 function idleHTML(){const ds=Object.entries(all());
  return `<div class="dg dg-idle"><div class="dg-idle-head"><div><small>DUNGEON</small><h2>던전</h2><p>방을 이어 붙인 지도 위를 일행이 한 칸씩 나아간다. 안개 속 방은 GM 이 공개하거나 일행이 들어가야 보인다. 진입하면 모두의 화면이 이 탭으로 넘어온다.</p></div><div class="dg-acts"><button class="btn sm pri" data-a="manage">🛠 던전 관리</button></div></div>
   ${ds.length?`<div class="dg-idle-list">${ds.map(([id,d])=>{const o=startOptions(d);const n=Object.keys(R(d)).length;return `<div class="dg-card"><h4>${H(d.n||'이름 없는 던전')} <small>방 ${n}개</small></h4>${d.o?`<span class="dg-chip">주인 · ${H(d.o)}</span>`:''}${d.a?`<span class="dg-chip">${H(d.a)}</span>`:''}${d.d?`<span class="dg-chip on">기한 · ${H(d.d)}</span>`:''}<div class="dg-acts">${o.map(([r,l])=>`<button class="btn sm pri" data-a="enter" data-v="${H(id)}" data-s="${H(r)}">⚔ ${H(l)}</button>`).join('')||'<span class="small dim">방이 없다 — 던전 관리에서 만든다</span>'}</div></div>`}).join('')}</div>`:`<div class="dg-card"><p>아직 던전이 없다. <b>던전 관리</b>에서 새로 만들거나 <b>샘플 던전</b>으로 시작해 봐.</p></div>`}</div>`}
 function render(el){if(!el)return;
  const d=cur();
  if(!d){DG.frame='';DG.mapSig='';if(!gm()){el.innerHTML='<div class="empty">지금은 던전에 들어가 있지 않다.</div>';return}const h=idleHTML();if(el._dgIdle!==h||!$('.dg-idle',el)){el.innerHTML=h;el._dgIdle=h}el._dgRoot=null;bindRoot(el);return}
  el._dgIdle=null;
  if(!$('#dgRoot',el)){el.innerHTML=shell();DG.frame='';DG.mapSig=''}
  bindRoot(el);paint(el,d)}
 function paint(el,d){
  const isGm=gm(),rs=R(d);
  if(!rs[d.at]){const s=d.st&&rs[d.st]?d.st:Object.keys(rs)[0];d.at=s||''}
  const room=rs[d.at],t=ty(room&&room.t),al=clamp(+d.al||0,0,100),lv=lvOf(al);
  if(!DG.sel||!rs[DG.sel]||!isGm&&!rs[DG.sel].s&&DG.sel!==d.at)DG.sel=d.at;
  const planes=$('#dgStage .dg-planes',el),[key,inner]=room?frameHTML(d):['none','<div class="dg-empty"><strong>DUNGEON</strong><small>GM 이 던전 관리에서 방을 만들면 여기에 보인다.</small></div>'];
  if(planes&&DG.frame!==key){const old=planes.lastElementChild,next=document.createElement('div');next.className='dg-frame'+(key.startsWith('fb:')?' dg-fb':'');next.style.setProperty('--c',t.c);next.innerHTML=inner;
   const anim=!!old&&!matchMedia('(prefers-reduced-motion:reduce)').matches;planes.replaceChildren();if(anim){old.className=old.className.replace(/\b(in|out)\b/g,'')+' out';planes.append(old);setTimeout(()=>old.remove(),620)}
   if(anim)next.classList.add('in');planes.append(next);DG.frame=key}
  setH($('#dgHud',el),`${room?`<div class="dg-loc"><span>${H(t.en)}</span><b>${H(room.n||t.k)}</b></div><div class="dg-type" style="--c:${t.c}">${t.ic} ${H(t.k)} · ${H(d.n||'이름 없는 던전')}</div>`:''}<div class="dg-meter lv${lv}" style="--p:${al/100}"><small>SECURITY</small><b>${al}<em>%</em></b><i></i><span>${LV[lv][1]} · ${LV[lv][2]}</span></div>${lv===3?'<div class="dg-lock"><strong>LOCKDOWN</strong><span>강제 퇴출</span></div>':''}`);
  const sig=JSON.stringify([d.id,isGm,d.at,DG.sel,rs,d.l]);
  if(DG.mapSig!==sig){DG.mapSig=sig;const m=mapBuild(d,isGm),iso=$('#dgIso',el),fog=$('#dgFog',el);if(iso&&fog){const w=m.box[2],tl=iso.parentElement;tl.style.setProperty('--nm',Math.max(15,w*.026).toFixed(0)+'px');tl.style.setProperty('--ic',Math.max(24,w*.034).toFixed(0)+'px');iso.setAttribute('viewBox',m.vb);fog.setAttribute('viewBox',m.vb);iso.innerHTML=m.svg;fog.innerHTML=fogBuild(m.box,m.holes,d.id,isGm,m.asks,m.lab)}
   const seen=Object.values(rs).filter(r=>r.s).length;setH($('#dgCap',el),`<b>MAP</b>${isGm?`방 ${Object.keys(rs).length}개 · 공개 ${seen}개`:`탐색한 방 ${seen}개`}`);
   const types=[...new Set(Object.entries(rs).filter(([id,r])=>isGm||r.s||id===d.at).map(([,r])=>r.t in TY?r.t:'room'))];
   setH($('#dgLegend',el),types.map(k=>`<span style="--c:${TY[k].c}"><i>${TY[k].ic}</i> ${TY[k].k}</span>`).join('')+'<span>◆ 일행 위치</span>')}
  tiltBind(el);
  setH($('#dgSide',el),side(d,isGm,al,lv))}
 function side(d,isGm,al,lv){
  const rs=R(d),id=DG.sel,r=rs[id],t=ty(r&&r.t),here=id===d.at;
  const meta=`<div class="dg-card"><h4>${H(d.n||'이름 없는 던전')} <small>DUNGEON</small></h4>${d.o?`<span class="dg-chip">주인 · ${H(d.o)}</span>`:''}${d.a?`<span class="dg-chip">${H(d.a)}</span>`:''}${d.d?`<span class="dg-chip on">기한 · ${H(d.d)}</span>`:''}
   <div class="dg-mini-meter" style="--p:${al/100};--lc:${LVC[lv]}"></div><p><b style="color:${LVC[lv]}">경계도 ${al}% · ${LV[lv][1]}</b> — ${LV[lv][3]}</p>
   ${isGm?`<div class="dg-acts"><button class="btn sm" data-a="al" data-v="20" data-w="발각">발각 +20</button><button class="btn sm" data-a="al" data-v="10" data-w="소란·도주">소란 +10</button><button class="btn sm" data-a="al" data-v="-10" data-w="몰래 통과">몰래 통과 −10</button><button class="btn sm ghost" data-a="al" data-v="5" data-w="">+5</button><button class="btn sm ghost" data-a="al" data-v="-5" data-w="">−5</button></div>${lv===3?'<div class="dg-acts"><button class="btn sm danger" data-a="kick">강제 퇴출 처리 (던전에서 나가기)</button></div>':''}`:''}</div>`;
  const card=r?`<div class="dg-card" style="--c:${t.c}"><h4><span class="dg-ico">${t.ic}</span>${H(r.n||t.k)} <small>${t.en}</small></h4><span class="dg-chip on">${H(t.k)}</span>${here?'<span class="dg-chip on">◆ 일행 위치</span>':''}${r.c?'<span class="dg-chip">✓ 클리어</span>':''}${isGm&&!r.s&&!here?'<span class="dg-chip">안개 속 (플레이어에게 안 보임)</span>':''}<p>${t.r}</p>${isGm&&r.m?`<p class="dg-memo">GM 메모 · ${H(r.m)}</p>`:''}
   ${isGm?`<div class="dg-acts">${here?'':`<button class="btn sm pri" data-a="move" data-v="${H(id)}">▶ 일행 이동</button>`}<button class="btn sm" data-a="seen" data-v="${H(id)}">${r.s?'안개로 숨기기':'👁 공개'}</button><button class="btn sm" data-a="clear" data-v="${H(id)}">${r.c?'클리어 취소':'✓ 클리어'}</button>${here?'<button class="btn sm" data-a="nav">📡 주변 방 밝히기</button>':''}</div>
   ${here?`<div class="dg-acts"><button class="btn sm pri" data-a="enc" data-v="battle">⚔ 조우 — 배틀 무대로</button><button class="btn sm danger" data-a="enc" data-v="spot">⚠ 들켰다 (경계도 +10)</button></div>`:''}`:''}</div>`:'';
  const foot=isGm?`<div class="dg-acts"><button class="btn sm" data-a="exit">🏠 던전에서 나가기</button><button class="btn sm" data-a="manage">🛠 던전 관리</button></div><p class="dg-help">지도에서 방을 눌러 고르고 이동 · 공개 · 조우를 처리한다. 플레이어에게는 공개한 방과 지나온 방만 보인다.</p>`:'<p class="dg-help">지도에서 방을 누르면 정보를 볼 수 있다. 안개 너머는 아직 아무도 모른다.</p>';
  return meta+card+foot}
 function tiltBind(el){const m=$('#dgMap',el);if(!m||m._tilt)return;m._tilt=1;const tilt=m.querySelector('.dg-tilt');
  m.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const b=m.getBoundingClientRect(),dx=(e.clientX-b.left)/b.width-.5,dy=(e.clientY-b.top)/b.height-.5;cancelAnimationFrame(DG.tiltRaf);DG.tiltRaf=requestAnimationFrame(()=>{tilt.style.setProperty('--rx',(9-dy*8).toFixed(2)+'deg');tilt.style.setProperty('--ry',(dx*10).toFixed(2)+'deg')})});
  m.addEventListener('pointerleave',()=>{cancelAnimationFrame(DG.tiltRaf);tilt.style.removeProperty('--rx');tilt.style.removeProperty('--ry')})}
 function cut(en,ko,sub,cls){const el=document.createElement('div');el.className='dg-cut '+(cls||'');el.setAttribute('role','status');el.innerHTML=`<div class="dg-cut-band"><small>${H(en)}</small><strong>${H(ko)}</strong>${sub?`<span>${H(sub)}</span>`:''}</div>`;document.body.append(el);whoosh();setTimeout(()=>el.remove(),2400)}

 /* ---------- 상태가 바뀔 때 (모든 탭에서 불린다): 진입 · 귀환 · 경계 단계 컷인, 화면 넘기기 ---------- */
 function onState(){const d=cur(),s={room:ST().room,mode:d?'dungeon':'',did:d?d.id:'',al:d?clamp(+d.al||0,0,100):0},p=DG.prev;DG.prev=s;
  {const sg=JSON.stringify(D0());if(DG.edOpen&&sg!==DG.edSig&&!DG.drag&&!typingInModal())edDraw();DG.edSig=sg}
  if(!p||p.room!==s.room)return;   /* 방에 막 들어온 첫 상태: 컷인 없음 */
  if(p.mode!==s.mode||p.did!==s.did){DG.sel='';
   if(s.mode==='dungeon'){cut('INFILTRATION','던전 진입',d.n||'','');try{A().goView('dungeon')}catch(e){}}
   else{cut('ESCAPE','던전 귀환','무대로 돌아왔다','out');try{if(A().view==='dungeon'&&!gm())A().goView('')}catch(e){}}
   return}
  if(s.mode==='dungeon'){const a=lvOf(p.al),b=lvOf(s.al);if(b>a)cut('SECURITY',b===3?'강제 퇴출':'경계도 '+LV[b][1],`${s.al}% · ${LV[b][3]}`,b===3?'lock':'warn')}}
 const typingInModal=()=>{const a=document.activeElement;return !!(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&a.closest('.dg-ed'))};

 /* ---------- 클릭 (탭 화면) ---------- */
 function startOptions(d){const rs=R(d),o=[];if(d.st&&rs[d.st])o.push([d.st,'입구에서 시작']);Object.entries(rs).forEach(([id,r])=>{if(r.t==='safe'&&r.s&&id!==d.st)o.push([id,'세이프룸 · '+(r.n||'')])});if(d.at&&rs[d.at]&&!o.some(x=>x[0]===d.at))o.push([d.at,'지난 위치에서 이어서']);if(!o.length){const f=Object.keys(rs)[0];if(f)o.push([f,'첫 방에서 시작'])}return o}
 function bindRoot(el){if(el._dgBound)return;el._dgBound=1;el.addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(!b||!el.contains(b)||!b.closest('#dgRoot,.dg-idle'))return;act(b.dataset.a,b)})}
 async function act(k,b){const d=cur();const v=b.dataset.v;
  if(k==='pick'){DG.sel=v;return A().renderScene()}
  if(k==='mapMode'){const m=mapMode()===v?'':v;try{localStorage.setItem('om_dg_map',m)}catch(err){}const dock=$('#dgDock');if(dock)dock.className='dg-dock '+m;return}
  if(!gm())return;
  if(k==='manage'){if(d)DG.ed=d.id;return openEd()}
  if(k==='enter'){const id=v,s=b.dataset.s,dd=all()[id];if(!dd||!R(dd)[s])return;const p=P0(id);if(await upd({field:{mode:'dungeon',did:id,t:Date.now()},[p+'at']:s,[p+'r/'+s+'/s']:1,[p+'al']:0})){notice(`⚔ 던전 진입 — ${dd.n||'던전'}`)}return}
  if(!d)return;
  if(k==='exit'){if(confirm('던전에서 나와 모두를 무대로 돌려보낼까?')&&await upd({'field/mode':'','field/t':Date.now()}))notice(`🏠 던전에서 나왔다 — ${d.n||'던전'}`);return}
  if(k==='kick'){if(await upd({'field/mode':'','field/t':Date.now()}))notice(`[${d.n||'던전'}] 경계도 100% — 강제 퇴출. 이번 탐색은 여기까지.`);return}
  if(k==='move'){if(!R(d)[v])return;const p=P0(d.id);if(await upd({[p+'at']:v,[p+'r/'+v+'/s']:1})){DG.sel=v;notice(`[${d.n||'던전'}] ▶ ${(R(d)[v].n||ty(R(d)[v].t).k)} (으)로 이동`)}return}
  if(k==='seen'){const r=R(d)[v];if(r)upd({[P0(d.id)+'r/'+v+'/s']:r.s?null:1});return}
  if(k==='clear'){const r=R(d)[v];if(r)upd({[P0(d.id)+'r/'+v+'/c']:r.c?null:1});return}
  if(k==='nav'){const n=nbrs(d,d.at).filter(id=>!R(d)[id].s);if(!n.length)return A().toast('주변에 새로 밝힐 방이 없다');const o={};n.forEach(id=>o[P0(d.id)+'r/'+id+'/s']=1);if(await upd(o))notice(`[${d.n||'던전'}] 📡 주변 방 ${n.length}곳이 지도에 드러났다`);return}
  if(k==='al'){const delta=+v||0,why=b.dataset.w||'';const before=clamp(+d.al||0,0,100),after=clamp(before+delta,0,100);if(after===before)return;if(await upd({[P0(d.id)+'al']:after}))notice(`[${d.n||'던전'}] 경계도 ${after>before?'+':''}${after-before}${why?' ('+why+')':''} → ${after}%`);return}
  if(k==='enc'){const r=R(d)[d.at]||{},head=`[${d.n||'던전'} · ${r.n||ty(r.t).k}] `;
   if(v==='spot'){const after=clamp((+d.al||0)+10,0,100);if(await upd({[P0(d.id)+'al']:after}))notice(head+`⚠ 들켰다! 경계도 +10 → ${after}%`);return}
   if(v==='battle'){notice(head+'⚔ 조우! 배틀을 시작한다.');await A().set(['scene'],'battle');try{A().goView('battle')}catch(e){}return}}}

 /* ---------- 편집기 (위에서 본 배치 · 플레이 화면에서는 입체로) ---------- */
 const edD=()=>{const d=all()[DG.ed];return d?Object.assign({},d,{id:DG.ed}):null};
 function edSVG(d){const rs=R(d);
  const ln=links(d).map(([a,b])=>`<line class="dg-ed-ln" data-a1="${H(a)}" data-b1="${H(b)}" x1="${+rs[a].x||0}" y1="${+rs[a].y||0}" x2="${+rs[b].x||0}" y2="${+rs[b].y||0}"/>`).join('');
  const nd=Object.entries(rs).map(([id,r])=>{const t=ty(r.t);return`<g class="dg-ed-node${id===DG.edSel?' on':''}${id===DG.edFrom?' lf':''}${r.s?'':' hid'}" data-r="${H(id)}" transform="translate(${+r.x||0} ${+r.y||0})"><circle r="28" fill="${t.c}"/><text>${t.ic}</text><text class="nm" y="46">${H(r.n||t.k)}</text>${id===d.st?'<text class="st" y="-40">START</text>':''}</g>`}).join('');
  let grid='';for(let x=50;x<1000;x+=50)grid+=`M${x} 0V640`;for(let y=50;y<640;y+=50)grid+=`M0 ${y}H1000`;
  return`<svg class="dg-ed-svg${DG.edMode==='link'?' link':''}" id="dgEdSvg" viewBox="0 0 1000 640"><path d="${grid}" stroke="rgba(120,150,220,.08)"/>${ln}${nd}</svg>`}
 function edHTML(){const ds=all(),ids=Object.keys(ds);if(!ds[DG.ed])DG.ed=ids[0]||'';const d=edD();if(d&&!R(d)[DG.edSel])DG.edSel='';
  const r=d&&R(d)[DG.edSel],t=ty(r&&r.t);
  const head=`<div class="mhead"><h2>던전 관리</h2><span class="sp"></span><button class="btn ghost" data-e="close">닫기</button></div>`;
  const top=`<div class="dg-ed-top"><select data-dgsel>${ids.map(id=>`<option value="${H(id)}" ${id===DG.ed?'selected':''}>${H(ds[id].n||'이름 없는 던전')}</option>`).join('')||'<option>던전 없음</option>'}</select><button class="btn sm pri" data-e="new">＋ 새 던전</button><button class="btn sm" data-e="sample">샘플 던전</button>${d?'<button class="btn sm danger" data-e="del">던전 삭제</button>':''}</div>`;
  if(!d)return head+top+'<p class="small dim">새 던전을 만들거나 샘플 던전으로 시작해 봐.</p>';
  const meta=`<div class="dg-ed-meta"><label>이름<input data-dgm="n" value="${H(d.n||'')}"></label><label>주인 (던전을 만든 인물 · 보스)<input data-dgm="o" value="${H(d.o||'')}"></label><label>테마<input data-dgm="a" value="${H(d.a||'')}" placeholder="예: 안개 · 폐허"></label><label>기한<input data-dgm="d" value="${H(d.d||'')}" placeholder="예: 7세션까지"></label></div>`;
  const tool=`<div class="dg-acts" style="margin:0 0 8px"><button class="btn sm ${DG.edMode==='move'?'pri':''}" data-e="mode" data-v="move">✥ 배치 · 이동</button><button class="btn sm ${DG.edMode==='link'?'pri':''}" data-e="mode" data-v="link">⟷ 통로 연결</button></div>`;
  const sideHTML=r?`<div class="dg-ed-side"><b style="font-size:15px">${t.ic} 방 편집</b><label>이름<input data-dgr="n" value="${H(r.n||'')}"></label><label>종류<select data-dgr="t">${TORDER.map(k=>`<option value="${k}" ${k===(r.t in TY?r.t:'room')?'selected':''}>${TY[k].ic} ${TY[k].k}</option>`).join('')}</select></label><p class="dg-help" style="margin:0">${t.r}</p><label>GM 메모 (GM 화면에만)<textarea data-dgr="m" rows="3">${H(r.m||'')}</textarea></label>
   <label>배경 그림 주소<input data-dgr="b" value="${H(r.b||'')}" placeholder="https://… (비우면 종류에 맞는 입체 공간)"></label>
   <div class="dg-acts"><label class="btn sm">그림 올리기<input type="file" accept="image/*" data-e="img" hidden></label>${r.b?'<button class="btn sm" data-e="imgdel">배경 빼기</button>':''}<button class="btn sm" data-e="start" ${d.st===DG.edSel?'disabled':''}>시작 방으로</button><button class="btn sm" data-e="seen">${r.s?'안개로 숨기기':'미리 공개'}</button><button class="btn sm danger" data-e="rdel">방 삭제</button></div></div>`
   :`<div class="dg-ed-side"><b>사용법</b><p class="dg-help" style="margin:0">• <b>배치 · 이동</b>: 빈 곳을 누르면 방 추가(고른 방에 통로로 이어 붙는다), 방을 끌어 옮기기, 누르면 편집.<br>• <b>통로 연결</b>: 방 두 개를 차례로 누르면 통로가 생기고, 다시 누르면 끊긴다.<br>• START 표시가 있는 방이 입구.<br>• 흐린 방은 안개 속(플레이어에게 안 보임). 일행이 들어가면 저절로 공개된다.<br>• 플레이 화면에서는 이 배치가 입체 지도로 보인다.</p></div>`;
  return head+top+meta+tool+`<div class="dg-ed-grid"><div>${edSVG(d)}</div>${sideHTML}</div>`}
 function openEd(){const m=A().openModal(`<div class="dg-ed" id="dgEd">${edHTML()}</div>`);if(m)m.classList.add('dg-ed-dialog');DG.edOpen=true;edBind()}
 function edDraw(){const box=$('#dgEd');if(!box){DG.edOpen=false;return}box.innerHTML=edHTML();edBind()}
 function edBind(){const box=$('#dgEd');if(!box)return;
  box.querySelectorAll('[data-e]').forEach(b=>{if(b.type==='file'){b.onchange=()=>edAct('img',b);return}b.onclick=()=>edAct(b.dataset.e,b)});
  box.querySelectorAll('[data-dgsel]').forEach(s=>s.onchange=()=>{DG.ed=s.value;DG.edSel='';DG.edFrom='';edDraw()});
  box.querySelectorAll('[data-dgm]').forEach(i=>i.onchange=()=>{const d=edD();if(d)upd({[P0(d.id)+i.dataset.dgm]:i.value.trim().slice(0,60)||null})});
  box.querySelectorAll('[data-dgr]').forEach(i=>i.onchange=()=>{const d=edD();if(d&&R(d)[DG.edSel]){const f=i.dataset.dgr;upd({[P0(d.id)+'r/'+DG.edSel+'/'+f]:i.value.trim().slice(0,f==='m'?400:f==='b'?600:40)||null})}});
  const svg=$('#dgEdSvg',box);if(svg)svgBind(svg);
  const bg=box.closest('.modalbg');if(bg&&!bg._dg){bg._dg=1;new MutationObserver((ms,ob)=>{if(!bg.isConnected){DG.edOpen=false;ob.disconnect();A().renderScene()}}).observe(document.body,{childList:true})}}
 function svgPt(svg,e){const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());return{x:Math.round(clamp(p.x,30,970)),y:Math.round(clamp(p.y,30,600))}}
 async function edAdd(pt){const d=edD();if(!d)return;const id=rid(d),first=!Object.keys(R(d)).length,o={[P0(d.id)+'r/'+id]:{n:first?'입구':'방 '+(Object.keys(R(d)).length+1),t:first?'entry':'room',x:pt.x,y:pt.y}};if(first)o[P0(d.id)+'st']=id;
  if(DG.edSel&&R(d)[DG.edSel])o[P0(d.id)+'l/'+lk(DG.edSel,id)]=1;   /* 새 방은 고른 방에 이어 붙는다 */
  DG.edSel=id;await upd(o);edDraw()}
 async function edLink(id){const d=edD();if(!d)return;if(!DG.edFrom||DG.edFrom===id){DG.edFrom=DG.edFrom===id?'':id;edDraw();return}const k=lk(DG.edFrom,id);DG.edFrom='';await upd({[P0(d.id)+'l/'+k]:(d.l||{})[k]?null:1});edDraw()}
 function svgBind(svg){
  svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;const node=e.target.closest('.dg-ed-node'),pt=svgPt(svg,e);DG.drag={rid:node?node.dataset.r:'',x:pt.x,y:pt.y,moved:false,svg,node};try{svg.setPointerCapture(e.pointerId)}catch(err){}e.preventDefault()});
  svg.addEventListener('pointermove',e=>{const g=DG.drag;if(!g||!g.rid||DG.edMode!=='move')return;const pt=svgPt(g.svg,e);if(!g.moved&&Math.hypot(pt.x-g.x,pt.y-g.y)<6)return;g.moved=true;g.pt=pt;g.node.setAttribute('transform',`translate(${pt.x} ${pt.y})`);
   g.svg.querySelectorAll('.dg-ed-ln').forEach(l=>{if(l.dataset.a1===g.rid){l.setAttribute('x1',pt.x);l.setAttribute('y1',pt.y)}if(l.dataset.b1===g.rid){l.setAttribute('x2',pt.x);l.setAttribute('y2',pt.y)}})});
  svg.addEventListener('pointerup',async()=>{const g=DG.drag;if(!g)return;DG.drag=null;const d=edD();if(!d)return;
   if(g.moved&&g.pt){DG.edSel=g.rid;await upd({[P0(d.id)+'r/'+g.rid+'/x']:g.pt.x,[P0(d.id)+'r/'+g.rid+'/y']:g.pt.y});return edDraw()}
   if(g.rid){if(DG.edMode==='link')return edLink(g.rid);DG.edSel=DG.edSel===g.rid?'':g.rid;return edDraw()}
   if(DG.edMode==='move')return edAdd({x:g.x,y:g.y});DG.edFrom='';edDraw()});
  svg.addEventListener('pointercancel',()=>{DG.drag=null})}
 async function edAct(k,b){const d=edD();
  if(k==='close'){A().closeModal();DG.edOpen=false;return A().renderScene()}
  if(k==='mode'){DG.edMode=b.dataset.v;DG.edFrom='';return edDraw()}
  if(k==='new'){const n=prompt('던전 이름','');if(n===null)return;const id=Math.random().toString(36).slice(2,8),e=Math.random().toString(36).slice(2,7);
   if(await upd({['list/'+id]:{n:n.trim()||'이름 없는 던전',al:0,st:e,r:{[e]:{n:'입구',t:'entry',x:120,y:320}}}})){DG.ed=id;DG.edSel=e;edDraw()}return}
  if(k==='sample'){const id=Math.random().toString(36).slice(2,8);
   const r={e:['정문','entry',110,520],a:['녹슨 복도','room',270,520],b:['터빈실','battle',440,520],s:['관리실','safe',440,350],c:['감전 복도','trap',620,350],p:['배전반 퍼즐','puzzle',440,170],t:['잠긴 창고','treasure',260,170],f:['고압 통로','battle',790,350],z:['제어실','boss',890,150]},o={};
   Object.entries(r).forEach(([k2,[n,t,x,y]])=>o[k2]={n,t,x,y});
   if(await upd({['list/'+id]:{n:'샘플: 버려진 발전소',o:'(예시) 발전소의 주인',a:'전기 · 폐허',al:0,st:'e',r:o,l:Object.fromEntries(['e~a','a~b','b~s','s~c','p~s','p~t','c~f','f~z'].map(x=>[x,1]))}})){DG.ed=id;DG.edSel='';edDraw();A().toast('샘플 던전을 만들었다 — 마음대로 고쳐 써')}return}
  if(!d)return;
  if(k==='del'){if(!confirm(`「${d.n||'이름 없는 던전'}」 던전을 지울까? 방과 통로가 모두 지워진다.`))return;const o={['list/'+d.id]:null};if(field().did===d.id&&field().mode==='dungeon'){o['field/mode']='';o['field/t']=Date.now()}if(await upd(o)){DG.ed='';DG.edSel='';edDraw()}return}
  const id=DG.edSel,r=R(d)[id];if(!r)return;
  if(k==='rdel'){if(!confirm(`「${r.n||'방'}」 방을 지울까?`))return;const p=P0(d.id),o={[p+'r/'+id]:null};Object.keys(d.l||{}).forEach(x=>{if(x.split('~').includes(id))o[p+'l/'+x]=null});
   const rest=Object.keys(R(d)).filter(x=>x!==id);if(d.st===id)o[p+'st']=rest[0]||null;if(d.at===id)o[p+'at']=(d.st!==id&&d.st)||rest[0]||null;if(await upd(o)){DG.edSel='';edDraw()}return}
  if(k==='start'){await upd({[P0(d.id)+'st']:id});return edDraw()}
  if(k==='seen'){await upd({[P0(d.id)+'r/'+id+'/s']:r.s?null:1});return edDraw()}
  if(k==='imgdel'){await upd({[P0(d.id)+'r/'+id+'/b']:null});return edDraw()}
  if(k==='img'){const f=b.files&&b.files[0];if(!f)return;A().toast('올리는 중…');try{const u=await DBS().uploadImage(`rooms/${ST().room}/dg_${d.id}_${id}_${Date.now().toString(36)}`,f);if(u&&await upd({[P0(d.id)+'r/'+id+'/b']:u}))A().toast('방 배경을 바꿨다');edDraw()}catch(e){A().toast('그림을 올리지 못했다: '+e.message)}}}

 return {render,onState,on,cur,TY,LV,lvOf};
})();
