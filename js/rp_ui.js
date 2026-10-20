/* ---------- RP 씬 + GM 콘솔 (맵툴 Lib:GM · Lib:map · 스탠딩을 옮긴 것) ----------
   state.rp = {
     bg:{src,name,at}                                 배경 (data/bg.js 목록 또는 주소·올린 파일)
     caption:{name,text,at,fixed}                     GM 고정 자막 (없으면 채팅이 자막)
     banner:{title,text,color,at}                     공지 배너
     bgm:{src,title,at}                               BGM (data/bgm.js 목록 또는 주소)
     center:{src,at}                                  중앙 이미지
     stage:{left:{key,flip},center,right}             자리 고정 (없으면 말하는 사람이 자동으로 선다)
     notices:[{id,name,title,ment,color,bgm}]         공지 프리셋 (없으면 기본 8개)
     recentBg:[k], recentBgm:[{g,s}]
     map:{locs:[{n,name,x,y}], vis:{n:1=가림}, party:{n,vis}, routes:[{rid,name,color,seq,vis}], npcs:[{id,name,img,n,size,vis}], ann, reveal}
   }
   스탠딩: roster.trainers[tid].stands=[{label,src,point}], standActive / graph.nodes[id].stands, standActive
   채팅: 좌석이 말하면 그 트레이너의 스탠딩이 무대에 서고, GM 은 「/as 이름 말」로 NPC 로 말한다. 「/s 라벨」 표정, 「/img 주소」 채팅 그림, 「/clear」 무대 비우기 */
"use strict";
window.OM_RP_UI=(()=>{
 const A=()=>window.OM_APP, DBS=()=>window.OM_STORE, DB=()=>window.OM_DB||{};
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const $=(s,r)=>(r||document).querySelector(s);
 const SLOTS=['left','center','right'];
 const RCOL={red:'#d63f4f',blue:'#2e86de',gold:'#f0aa1e',green:'#28a064',purple:'#8e5bd6'};
 const MAP_IMG={src:'img/map/mujin.webp',w:1800,h:1104};
 const DEFAULT_LOCS=[{"n":1,"name":"무진 중고등학교","x":591,"y":162},{"n":2,"name":"무연고 묘지","x":213,"y":145},{"n":3,"name":"숲 속의 폐가","x":313,"y":294},{"n":4,"name":"등불 교회","x":74,"y":867},{"n":5,"name":"무진포 (어선·항구)","x":349,"y":996},{"n":6,"name":"철물점 겸 고물상","x":378,"y":886},{"n":7,"name":"무진 경찰서","x":557,"y":778},{"n":8,"name":"마을회관 (대피소)","x":679,"y":629},{"n":9,"name":"무진 요양병원","x":511,"y":552},{"n":10,"name":"구(舊) 도서관","x":650,"y":389},{"n":11,"name":"흑익단 사무소","x":981,"y":316},{"n":12,"name":"무진 대학교","x":1157,"y":98},{"n":13,"name":"연구소","x":1562,"y":105},{"n":14,"name":"허수아비 헛간","x":1688,"y":466},{"n":15,"name":"자경단 초소","x":1398,"y":467},{"n":16,"name":"고문서 번역소","x":1108,"y":644},{"n":17,"name":"눈먼 갈매기 술집","x":1005,"y":749},{"n":18,"name":"수렵 총포사","x":1313,"y":752},{"n":19,"name":"검은모래 해변 (낡은 매점)","x":1723,"y":1014}];
 const DEFAULT_NOTICES=[{id:'n_open',name:'씬 오픈',title:'씬 오픈',ment:'',color:'#5fd38d'},{id:'n_change',name:'씬 전환',title:'씬 전환',ment:'',color:'#6cb6ff'},{id:'n_soon',name:'씬 종료 예고',title:'곧 씬이 종료됩니다',ment:'',color:'#f2a65a'},{id:'n_end',name:'씬 종료',title:'씬 종료',ment:'',color:'#ff6b6b',bgm:'stop'},{id:'n_bstart',name:'배틀 개시',title:'배틀 개시',ment:'',color:'#ff4f6d'},{id:'n_bend',name:'배틀 종료',title:'배틀 종료',ment:'',color:'#9aa4b8'},{id:'n_warn',name:'플레이 시작 경고',title:'플레이 시작',ment:'플레이가 곧 시작됩니다\n채팅을 잠시 멈춰 주세요.',color:'#f1c75b'},{id:'n_attend',name:'출석 체크',title:'출석 체크',ment:'출석,,,체크핢...',color:'#7ee0d8'}];
 let audio=null,lastBgm='',unlocked=false,bannerT=null,lastBanner=0,mapOpen=false,vol=0.5;
 try{vol=+(localStorage.getItem('om_vol')||0.5)}catch(e){}
 /* 무대 위 화자 자리: 로그를 차례로 먹여서 모두 같은 결과가 나온다 */
 const STAGE={slots:{left:null,center:null,right:null},last:{},active:null,seen:0};
 function R(){return A().ST.state.rp||{}}
 function gm(){return A().ST.role==='gm'}
 function mapS(){const m=R().map||{};return {locs:m.locs&&m.locs.length?m.locs:DEFAULT_LOCS,vis:m.vis||{},party:m.party||{n:0,vis:1},routes:m.routes||[],npcs:m.npcs||[],ann:m.ann==null?1:m.ann,reveal:m.reveal==null?1:m.reveal}}
 function notices(){return (R().notices&&R().notices.length)?R().notices:DEFAULT_NOTICES}
 function bgOf(k){for(const g of DB().bg||[])for(const i of g.i)if(i.k===k)return Object.assign({g:g.n},i);return null}
 function bgmUrl(g,s){const b=DB().bgm||{};const p=((b.groups||{})[g]||{})[s];return p?(/^https?:/.test(p)?p:b.base+p):''}

 /* ----- 화자(스탠딩) ----- */
 function charOf(key){const ST=A().ST;if(!key)return null;
  if(key.startsWith('npc:')){const name=key.slice(4);const n=Object.values((ST.state.graph||{}).nodes||{}).find(x=>x.name===name);return n?{key,name:n.name,img:n.img,stands:n.stands||[],active:n.standActive||0,kind:'npc',id:n.id}:{key,name,img:'',stands:[],active:0,kind:'npc',id:''}}
  const t=((ST.state.roster||{}).trainers||{})[key];if(!t)return null;return {key,name:t.name,img:t.image,stands:t.stands||[],active:t.standActive||0,kind:'pc',id:key}}
 function standSrc(c){if(!c)return '';const s=(c.stands||[])[c.active]||(c.stands||[])[0];return (s&&s.src)||c.img||''}
 function standPoint(c){const s=(c.stands||[])[c.active]||(c.stands||[])[0];return s&&+s.point||0}
 function speakerKey(row){const d=row.data||{};if(d.as){const t=Object.values((A().ST.state.roster||{}).trainers||{}).find(x=>x.name===d.as);return t?t.id:'npc:'+d.as}if(d.from&&d.from!=='gm')return d.from;return ''}
 function feedLog(rows){for(const r of rows){if(r.id<=STAGE.seen)continue;STAGE.seen=r.id;if(r.kind!=='chat')continue;const d=r.data||{};if(d.clear){STAGE.slots={left:null,center:null,right:null};STAGE.active=null;continue}
   const k=speakerKey(r);if(!k||!d.t)continue;STAGE.last[k]=r.id;STAGE.active=k;
   if(Object.values(STAGE.slots).includes(k))continue;
   const free=['left','right','center'].find(s=>!STAGE.slots[s]);if(free){STAGE.slots[free]=k;continue}
   const oldest=SLOTS.slice().sort((a,b)=>(STAGE.last[STAGE.slots[a]]||0)-(STAGE.last[STAGE.slots[b]]||0))[0];STAGE.slots[oldest]=k}}

 /* ----- 무대 ----- */
 function render(el){
  feedLog(A().ST.log||[]);
  const r=R();const bg=r.bg||{};const cap=r.caption||{};const manual=r.stage||{};
  const slots={};for(const s of SLOTS){const m=manual[s];slots[s]=m&&m.key?m.key:STAGE.slots[s]}
  const stands=SLOTS.map(s=>{const c=charOf(slots[s]);const src=standSrc(c);if(!c||!src)return '';const on=STAGE.active===c.key||!STAGE.active;return `<div class="stand ${s} ${on?'on':'off'}" style="margin-bottom:${-standPoint(c)}px"><img src="${esc(src)}" alt="" style="${(manual[s]||{}).flip?'transform:scaleX(-1)':''}"><div class="stname">${esc(c.name)}</div></div>`}).join('');
  const lastChat=[...(A().ST.log||[])].reverse().find(x=>x.kind==='chat'&&x.data&&x.data.t);
  const line=(name,text)=>{const m=String(text).match(/^\*(.+)\*$/s);return `<div class="dlg"><div class="dname"><span>${esc(name)}</span></div><div class="dtext ${m?'narr':''}">${m?esc(m[1]):'"'+esc(text)+'"'}</div></div>`};
  const capHtml=cap.text?line(cap.name||'',cap.text):(lastChat?line(lastChat.data.as||(charOf(speakerKey(lastChat))||{}).name||lastChat.who,lastChat.data.t):'');
  const ST=A().ST;const speakers=gm()?[{key:'gm',name:'GM (나레이션)'},...Object.values((ST.state.graph||{}).nodes||{}).map(n=>({key:'npc:'+n.name,name:n.name})),...Object.values((ST.state.roster||{}).trainers||{}).map(t=>({key:'as:'+t.name,name:t.name+' (PC)'}))]:(ST.seat?[{key:'me',name:(charOf(ST.seat)||{}).name||ST.name}]:[]);
  if(gm()&&!SPK.key)SPK.key='gm';
  el.innerHTML=`<div class="rpwrap"><div class="rpstage" id="rpstage" style="${bg.src?`background-image:url('${esc(bg.src)}')`:''}">
   ${stands}${capHtml}
   ${bg.name?`<div class="bgname">${esc(bg.name)}</div>`:''}
   ${r.center&&r.center.src?`<div class="centerimg"><img src="${esc(r.center.src)}" alt="">${gm()?'<button class="btn xs" data-rp="centerx">닫기</button>':''}</div>`:''}
   <div class="rpbtns"><button class="btn sm ${mapOpen?'pri':''}" data-rp="map">${mapOpen?'지도 닫기':'지도'}</button><button class="btn sm" data-rp="deck">덱</button><button class="btn sm ghost" data-rp="stand">표정</button>${r.bgm&&r.bgm.src?`<button class="btn sm ghost" data-rp="sound" title="${esc(r.bgm.title||'')}">${unlocked?'♪ '+esc(r.bgm.title||'BGM'):'소리 켜기'}</button>`:''}${gm()?`<button class="btn sm pri" data-rp="gm">GM 콘솔</button>`:''}</div>
   ${mapOpen?mapOverlay():''}
  </div>
  ${speakers.length?`<div class="rpinput"><select id="rpspk">${speakers.map(x=>`<option value="${esc(x.key)}" ${SPK.key===x.key?'selected':''}>${esc(x.name)}</option>`).join('')}</select><input type="text" id="rpline" placeholder="대사 입력 후 Enter · *지문*" autocomplete="off"><button class="btn pri" id="rpsend">보내기</button></div><div class="small dim rphint">${gm()?'GM 이 고른 인물로 말하면 그 인물의 스탠딩이 선다 · 표정은 「표정」 또는 /s 라벨':'스탠딩 그림이 아직 없으면 시트 그림(초상)으로 선다 — 「표정」에서 전신 그림을 넣어 줘'}</div>`:'<div class="small dim rphint">자리에 앉으면 여기서 대사를 칠 수 있다</div>'}</div>`;
  el.querySelectorAll('[data-rp]').forEach(b=>b.onclick=()=>act(b.dataset.rp));
  const spk=$('#rpspk',el);if(spk)spk.onchange=()=>{SPK.key=spk.value};
  const inp=$('#rpline',el);if(inp){inp.value=SPK.draft||'';inp.oninput=()=>{SPK.draft=inp.value};inp.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing)sendLine()};$('#rpsend',el).onclick=sendLine;if(SPK.focus){inp.focus();SPK.focus=false}}
  bindMap(el);tickBanner();syncBgm()}
 const SPK={key:'',draft:'',focus:false};
 async function sendLine(){const ST=A().ST;const inp=$('#rpline');if(!inp)return;const t=inp.value.trim();if(!t)return;inp.value='';SPK.draft='';SPK.focus=true;
  try{if(t.startsWith('/')){const ci=$('#chatIn');if(ci){ci.value=t;$('#chatSend').click()}return}
   if(ST.role==='gm'){if(SPK.key==='gm')await DBS().addLog(ST.room,ST.secret,'chat',ST.name,{t});else{const name=SPK.key.replace(/^(npc|as):/,'');await DBS().addLog(ST.room,ST.secret,'chat',name,{t,as:name})}}
   else await DBS().addLog(ST.room,ST.secret,'chat',ST.name,{t})}catch(e){A().toast('보내지 못했다: '+e.message)}}
 function act(k){
  if(k==='map'){mapOpen=!mapOpen;return A().renderScene()}
  if(k==='deck')return window.OM_DECK_UI.open();
  if(k==='sound'){unlocked=true;syncBgm(true);A().renderScene();return}
  if(k==='gm')return openConsole();
  if(k==='centerx')return A().set(['rp','center'],null);
  if(k==='stand')return openMyStand()}

 /* ----- 지도 ----- */
 function mapOverlay(){const M=mapS();const W=MAP_IMG.w,H=MAP_IMG.h;const px=(x,y)=>`left:${x/W*100}%;top:${y/H*100}%`;const isGm=gm();const hid=n=>M.vis[n]==1;
  const locHtml=M.locs.map(l=>{const h=hid(l.n);if(h&&!isGm)return `<div class="cover" style="${px(l.x,l.y)}" title="?"><span>?</span></div>`;
   return `<div class="loc ${h?'hid':''} ${M.party.n===l.n&&(M.party.vis||isGm)?'party':''}" data-loc="${l.n}" style="${px(l.x,l.y)}" title="${esc(l.name)}"><span class="ln">${l.n}</span><span class="lt">${esc(l.name)}${h?' (가림)':''}</span></div>`}).join('');
  const pin=(()=>{const l=M.locs.find(x=>x.n===M.party.n);if(!l||(!M.party.vis&&!isGm))return '';return `<div class="ppin ${M.party.vis?'':'hid'}" style="${px(l.x,l.y)}" title="파티"><span>PC</span></div>`})();
  const routes=`<svg class="routes" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${M.routes.filter(rt=>rt.vis||isGm).map(rt=>{const pts=rt.seq.map(n=>M.locs.find(x=>x.n===n)).filter(Boolean);if(pts.length<2)return '';const d=pts.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ');const c=RCOL[rt.color]||rt.color||'#d63f4f';return `<path d="${d}" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${rt.vis?.85:.35}" stroke-dasharray="${rt.vis?'':'18 14'}"/>${pts.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="11" fill="${c}" stroke="#fff" stroke-width="3"/>`).join('')}<text x="${(pts[0].x+pts[1].x)/2+14}" y="${(pts[0].y+pts[1].y)/2-10}" font-size="28" fill="${c}" stroke="#000" stroke-width="4" paint-order="stroke" font-weight="bold">${esc(rt.name||rt.seq.join('→'))}</text>`}).join('')}</svg>`;
  const npcs=M.npcs.filter(n=>n.vis||isGm).map(n=>{const l=M.locs.find(x=>x.n===n.n);if(!l)return '';const sz={s:34,m:48,l:64}[n.size||'s'];const idx=M.npcs.filter(x=>x.n===n.n).indexOf(n);return `<div class="mnpc ${n.vis?'':'hid'}" style="${px(l.x+30+idx*(sz*0.8),l.y-10)};width:${sz}px;height:${sz}px;${n.img?`background-image:url('${esc(n.img)}')`:''}" title="${esc(n.name)}${n.vis?'':' (숨김)'}"><i>${esc(n.name)}</i></div>`}).join('');
  const shown=M.locs.filter(l=>!hid(l.n)).length;
  return `<div class="mapov"><div class="mapwrap"><img src="${MAP_IMG.src}" alt="">${routes}${locHtml}${npcs}${pin}</div>
   <div class="maplist"><span class="chip">${shown}/${M.locs.length} 공개</span>${M.party.n?`<span class="chip on">파티: ${M.party.n}. ${esc((M.locs.find(x=>x.n===M.party.n)||{}).name||'')}${M.party.vis?'':' (핀 숨김)'}</span>`:''}${M.routes.filter(r=>r.vis).map(r=>`<span class="chip" style="border-color:${RCOL[r.color]||'#888'}">${esc(r.name||r.seq.join('→'))}</span>`).join('')}${isGm?'<span class="sp"></span><button class="btn sm pri" data-mapmgr>지도 관리</button><span class="dim small">마커 클릭 = 공개/가리기 · 파티 이동</span>':''}</div></div>`}
 function bindMap(el){el.querySelectorAll('[data-loc]').forEach(b=>b.onclick=()=>{if(gm())locMenu(+b.dataset.loc);else{const l=mapS().locs.find(x=>x.n===+b.dataset.loc);if(l)A().toast(`${l.n}. ${l.name}`)}});const mg=el.querySelector('[data-mapmgr]');if(mg)mg.onclick=()=>openMapMgr('loc')}
 async function saveMap(patch){const m=Object.assign({},R().map||{},patch);await A().set(['rp','map'],m)}
 async function toggleLoc(n){const M=mapS();const vis=Object.assign({},M.vis);const wasHidden=vis[n]==1;if(wasHidden)delete vis[n];else vis[n]=1;await saveMap({vis});const l=M.locs.find(x=>x.n===n);if(M.ann&&l)A().sysLog(`지도: ${l.name} ${wasHidden?'공개':'가림'}`)}
 async function partyMove(n){const M=mapS();const vis=Object.assign({},M.vis);let rev=false;if(M.reveal&&vis[n]==1){delete vis[n];rev=true}await saveMap({party:{n,vis:M.party.vis==null?1:M.party.vis},vis});const l=M.locs.find(x=>x.n===n);if(M.ann&&l)A().sysLog(`파티가 ${l.n}. ${l.name}(으)로 이동했습니다.${rev?' (장소 공개)':''}`)}
 function locMenu(n){const M=mapS();const l=M.locs.find(x=>x.n===n);if(!l)return;const h=M.vis[n]==1;
  const md=A().openModal(`<div class="mhead"><h2>${n}. ${esc(l.name)}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="row"><button class="btn ${h?'pri':''}" id="lopen">${h?'공개하기':'가리기'}</button><button class="btn" id="lparty">파티를 여기로</button><button class="btn ghost" id="lfocus">자막으로 알리기</button><button class="btn ghost" id="lmgr">지도 관리</button></div>`);
  $('#lopen',md).onclick=async()=>{A().closeModal();await toggleLoc(n)};
  $('#lparty',md).onclick=async()=>{A().closeModal();await partyMove(n)};
  $('#lfocus',md).onclick=async()=>{A().closeModal();await A().set(['rp','caption'],{name:'장소',text:l.name,at:Date.now(),fixed:false})};
  $('#lmgr',md).onclick=()=>openMapMgr('loc')}
 /* 지도 관리 창 (맵툴 Lib:map 의 두 탭) */
 const MM={tab:'loc',seq:[],col:'red',rname:''};
 function openMapMgr(tab){if(tab)MM.tab=tab;const M=mapS();const ST=A().ST;const locName=n=>(M.locs.find(x=>x.n===n)||{}).name||'';
  const locTab=`<div class="mmcols"><div><div class="sec">장소 공개 / 가리기 <span class="sp"></span><button class="btn xs ${M.ann?'pri':'ghost'}" data-mm="ann">채팅 알림 ${M.ann?'켬':'끔'}</button></div>
    <div class="row small" style="margin-bottom:6px"><button class="btn xs" data-mm="all" data-v="0">모두 공개</button><button class="btn xs" data-mm="all" data-v="1">모두 가리기</button><span class="dim">가린 장소는 지도에서 「?」로 덮인다</span></div>
    <div class="mmlist">${M.locs.map(l=>{const h=M.vis[l.n]==1;return `<div class="mml ${h?'hid':''}"><span class="no">${l.n}</span><span class="nm">${esc(l.name)}${M.party.n===l.n?' <span class="tag me">파티</span>':''}</span><span class="chip ${h?'':'on'}">${h?'가림':'공개'}</span><button class="btn xs ${h?'pri':''}" data-mm="t" data-n="${l.n}">${h?'공개':'가리기'}</button><button class="btn xs ghost" data-mm="ren" data-n="${l.n}">이름</button><button class="btn xs ghost danger" data-mm="del" data-n="${l.n}">×</button></div>`}).join('')}</div>
    <div class="row" style="margin-top:8px"><input type="text" id="mm_new" placeholder="새 장소 이름" style="flex:1"><input type="number" class="n" id="mm_x" placeholder="x" value="900"><input type="number" class="n" id="mm_y" placeholder="y" value="650"><button class="btn sm" data-mm="add">추가</button></div><div class="small dim">좌표는 지도 그림 기준 (0~${MAP_IMG.w}, 0~${MAP_IMG.h})</div></div>
   <div><div class="sec">루트 그리기</div><div class="small dim">지나갈 순서대로 번호를 누른다 (예: 5 → 7 → 8)</div>
    <div class="picks">${M.locs.map(l=>`<button class="pk" data-mm="seq" data-n="${l.n}" title="${esc(l.name)}">${l.n}</button>`).join('')}</div>
    <div class="seq">${MM.seq.length?MM.seq.map((n,i)=>`${i?' → ':''}<b>${n}</b> ${esc(locName(n))}`).join(''):'<span class="dim small">아직 고른 장소가 없다</span>'}</div>
    <div class="row"><button class="btn xs ghost" data-mm="undo">하나 빼기</button><button class="btn xs ghost" data-mm="clr">비우기</button><span class="sp"></span>${Object.entries(RCOL).map(([k,c])=>`<span class="sw ${MM.col===k?'on':''}" data-mm="col" data-c="${k}" style="background:${c}"></span>`).join('')}</div>
    <div class="row"><input type="text" id="mm_rname" placeholder="루트 이름 (비우면 번호 순서)" value="${esc(MM.rname)}" style="flex:1"><button class="btn sm pri" data-mm="draw" ${MM.seq.length<2?'disabled':''}>루트 그리기</button></div>
    <div class="sec" style="margin-top:10px">그려진 루트 <span class="sp"></span>${M.routes.length?'<button class="btn xs ghost danger" data-mm="wipe">모두 지우기</button>':''}</div>
    ${M.routes.length?M.routes.map((r,i)=>`<div class="mml ${r.vis?'':'hid'}"><i class="sw" style="background:${RCOL[r.color]||'#888'}"></i><span class="nm">${esc(r.name||'')}<small class="dim"> ${r.seq.map(n=>n+'.'+locName(n)).join(' → ')}</small></span><button class="btn xs" data-mm="rvis" data-i="${i}">${r.vis?'숨기기':'보이기'}</button><button class="btn xs ghost danger" data-mm="rdel" data-i="${i}">×</button></div>`).join(''):'<div class="empty small">그려진 루트가 없다</div>'}</div></div>`;
  const pics=[...Object.values((ST.state.graph||{}).nodes||{}).map(n=>({name:n.name,img:n.img||''})),...Object.values((ST.state.roster||{}).trainers||{}).map(t=>({name:t.name,img:t.image||''}))];
  const pcTab=`<div class="mmcols"><div><div class="sec">파티 현재 위치</div>
    <div class="pcard"><div class="ppin static"><span>PC</span></div><div style="flex:1"><small class="dim">지금 있는 곳</small><br><b>${M.party.n?M.party.n+'. '+esc(locName(M.party.n)):'—'}</b> ${M.party.vis?'<span class="chip on">플레이어에게 보임</span>':'<span class="chip">핀 숨김 (GM만)</span>'}</div><button class="btn sm ${M.party.vis?'':'pri'}" data-mm="pvis">${M.party.vis?'핀 숨기기':'핀 보이기'}</button></div>
    <label class="small"><input type="checkbox" data-mm="reveal" ${M.reveal?'checked':''}> 가려진 장소로 이동하면 그 장소도 함께 공개</label>
    <div class="small dim" style="margin:6px 0">장소를 누르면 핀이 그곳으로 옮겨진다${M.ann?' (채팅에 알림)':''}</div>
    <div class="lgrid">${M.locs.map(l=>`<button class="lb ${M.party.n===l.n?'cur':''} ${M.vis[l.n]==1?'hid':''}" data-mm="pmove" data-n="${l.n}"><span class="no">${l.n}</span>${esc(l.name)}</button>`).join('')}</div></div>
   <div><div class="sec">주요 인물 배치</div>
    <div class="row"><select id="mm_np" style="flex:1"><option value="">인물 고르기 (관계도·로스터)</option>${pics.map(p=>`<option value="${esc(p.name)}" data-img="${esc(p.img)}">${esc(p.name)}</option>`).join('')}</select><input type="text" id="mm_npn" placeholder="또는 이름 직접" style="width:120px"></div>
    <div class="row"><select id="mm_nploc">${M.locs.map(l=>`<option value="${l.n}">${l.n}. ${esc(l.name)}${M.vis[l.n]==1?' (가림)':''}</option>`).join('')}</select><select id="mm_npsz"><option value="s">작게</option><option value="m">보통</option><option value="l">크게</option></select><label class="small"><input type="checkbox" id="mm_npvis" checked> 바로 공개</label><span class="sp"></span><button class="btn sm pri" data-mm="nadd">지도에 배치</button></div>
    <div class="sec" style="margin-top:10px">배치된 인물 <span class="dim small">${M.npcs.length}명</span><span class="sp"></span>${M.npcs.length?'<button class="btn xs ghost danger" data-mm="nclr">모두 빼기</button>':''}</div>
    ${M.npcs.length?M.npcs.map((n,i)=>`<div class="mml ${n.vis?'':'hid'}"><i class="tpic sm" style="${n.img?`background-image:url('${esc(n.img)}')`:''}"></i><span class="nm">${esc(n.name)}<small class="dim"> ${n.vis?'공개':'숨김'}</small></span><select data-mm="nmove" data-i="${i}">${M.locs.map(l=>`<option value="${l.n}" ${l.n===n.n?'selected':''}>${l.n}. ${esc(l.name)}</option>`).join('')}</select><button class="btn xs ${n.vis?'':'pri'}" data-mm="nvis" data-i="${i}">${n.vis?'숨기기':'공개'}</button><button class="btn xs ghost danger" data-mm="ndel" data-i="${i}">빼기</button></div>`).join(''):'<div class="empty small">배치된 인물이 없다</div>'}</div></div>`;
  const md=A().openModal(`<div class="mhead"><h2>지도 관리</h2><span class="tabs2" style="margin:0 0 0 14px;flex:0 1 380px"><button class="tab2 ${MM.tab==='loc'?'on':''}" data-mm="tab" data-t="loc">장소 · 루트 <small>${M.locs.filter(l=>M.vis[l.n]!=1).length}/${M.locs.length} 공개</small></button><button class="tab2 ${MM.tab==='pc'?'on':''}" data-mm="tab" data-t="pc">파티 위치 · 인물 <small>${M.party.n?M.party.n+'. '+esc(locName(M.party.n)):''}</small></button></span><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>${MM.tab==='pc'?pcTab:locTab}`);
  md.classList.add('wide');
  md.querySelectorAll('[data-mm]').forEach(b=>{const h=async()=>{const k=b.dataset.mm;const re=()=>openMapMgr();
   if(k==='tab'){MM.tab=b.dataset.t;return re()}
   if(k==='ann'){await saveMap({ann:M.ann?0:1});return re()}
   if(k==='all'){const vis={};if(b.dataset.v==='1')M.locs.forEach(l=>vis[l.n]=1);await saveMap({vis});if(M.ann)A().sysLog(b.dataset.v==='1'?'지도: 모든 장소 가림':'지도: 모든 장소 공개');return re()}
   if(k==='t'){await toggleLoc(+b.dataset.n);return re()}
   if(k==='ren'){const l=M.locs.find(x=>x.n===+b.dataset.n);const nm=prompt('장소 이름',l.name);if(nm==null||!nm.trim())return;await saveMap({locs:M.locs.map(x=>x.n===l.n?Object.assign({},x,{name:nm.trim()}):x)});return re()}
   if(k==='del'){const l=M.locs.find(x=>x.n===+b.dataset.n);if(!confirm(`${l.n}. ${l.name} 을 지도에서 지울까?`))return;await saveMap({locs:M.locs.filter(x=>x.n!==l.n)});return re()}
   if(k==='add'){const nm=$('#mm_new',md).value.trim();if(!nm)return;const n=Math.max(0,...M.locs.map(x=>x.n))+1;await saveMap({locs:[...M.locs,{n,name:nm,x:+$('#mm_x',md).value||900,y:+$('#mm_y',md).value||650}]});return re()}
   if(k==='seq'){const n=+b.dataset.n;if(MM.seq[MM.seq.length-1]!==n)MM.seq.push(n);MM.rname=$('#mm_rname',md).value;return re()}
   if(k==='undo'){MM.seq.pop();return re()}if(k==='clr'){MM.seq=[];return re()}
   if(k==='col'){MM.col=b.dataset.c;MM.rname=$('#mm_rname',md).value;return re()}
   if(k==='draw'){if(MM.seq.length<2)return;const name=$('#mm_rname',md).value.trim()||MM.seq.join(' → ');await saveMap({routes:[...M.routes,{rid:'r'+Date.now().toString(36),name,color:MM.col,seq:MM.seq.slice(),vis:1}]});if(M.ann)A().sysLog(`지도: 루트 「${name}」`);MM.seq=[];MM.rname='';return re()}
   if(k==='rvis'){const rs=M.routes.map((r,i)=>i===+b.dataset.i?Object.assign({},r,{vis:r.vis?0:1}):r);await saveMap({routes:rs});return re()}
   if(k==='rdel'){await saveMap({routes:M.routes.filter((r,i)=>i!==+b.dataset.i)});return re()}
   if(k==='wipe'){if(!confirm('루트를 모두 지울까?'))return;await saveMap({routes:[]});return re()}
   if(k==='pvis'){await saveMap({party:Object.assign({},M.party,{vis:M.party.vis?0:1})});return re()}
   if(k==='reveal'){await saveMap({reveal:b.checked?1:0});return}
   if(k==='pmove'){await partyMove(+b.dataset.n);return re()}
   if(k==='nadd'){const sel=$('#mm_np',md);const opt=sel.options[sel.selectedIndex];const name=$('#mm_npn',md).value.trim()||sel.value;if(!name)return A().toast('인물을 고르거나 이름을 적어 줘');const img=(opt&&opt.dataset.img)||(pics.find(p=>p.name===name)||{}).img||'';
    await saveMap({npcs:[...M.npcs,{id:'p'+Date.now().toString(36),name,img,n:+$('#mm_nploc',md).value,size:$('#mm_npsz',md).value,vis:$('#mm_npvis',md).checked?1:0}]});return re()}
   if(k==='nmove'){const ns=M.npcs.map((x,i)=>i===+b.dataset.i?Object.assign({},x,{n:+b.value}):x);await saveMap({npcs:ns});return re()}
   if(k==='nvis'){const ns=M.npcs.map((x,i)=>i===+b.dataset.i?Object.assign({},x,{vis:x.vis?0:1}):x);await saveMap({npcs:ns});return re()}
   if(k==='ndel'){await saveMap({npcs:M.npcs.filter((x,i)=>i!==+b.dataset.i)});return re()}
   if(k==='nclr'){await saveMap({npcs:[]});return re()}};
   if(b.tagName==='SELECT'||b.type==='checkbox')b.onchange=h;else b.onclick=h})}

 /* ----- GM 콘솔 (맵툴 Lib:GM 콘솔 = 배경 · 음악 · 공지 · 지도 · 무대 · 연출) ----- */
 const GC={tab:'bg',bgGroup:'',bgmGroup:'',bgmQ:''};
 function openConsole(tab){if(tab)GC.tab=tab;const r=R();const ST=A().ST;
  const TABS=[['bg','배경'],['bgm','음악'],['notice','공지'],['map','지도'],['stage','무대·스탠딩'],['etc','연출']];
  let body='';
  if(GC.tab==='bg'){const groups=DB().bg||[];if(!GC.bgGroup&&groups.length)GC.bgGroup=groups[0].n;const g=groups.find(x=>x.n===GC.bgGroup)||groups[0]||{i:[]};const cur=(r.bg||{}).src;
   body=`<div class="row" style="margin-bottom:8px"><div class="curbg" style="${cur?`background-image:url('${esc(cur)}')`:''}"></div><div><small class="dim">현재 배경</small><br><b>${esc((r.bg||{}).name||'없음')}</b></div><span class="sp"></span><button class="btn sm ghost" data-gc="bgx">배경 지우기</button></div>
    ${(r.recentBg||[]).length?`<div class="sec">최근</div><div class="bgchips">${r.recentBg.map(k=>{const b=bgOf(k);return b?`<div class="bgchip ${cur===b.src?'cur':''}" data-gc="bg" data-k="${esc(k)}"><i style="background-image:url('${b.src}')"></i>${esc(b.l)}</div>`:''}).join('')}</div>`:''}
    <div class="sec">그룹</div><div class="tabs2 wrap">${groups.map(x=>`<button class="tab2 ${x.n===g.n?'on':''}" data-gc="bgg" data-g="${esc(x.n)}">${esc(x.n)} <small>${x.i.filter(i=>i.src).length}</small></button>`).join('')}</div>
    <div class="bggrid">${g.i.map(it=>it.src?`<div class="bgt ${cur===it.src?'cur':''}" data-gc="bg" data-k="${esc(it.k)}"><img src="${it.src}" loading="lazy" alt=""><span>${esc(it.l)}</span></div>`:'').join('')}</div>
    <div class="sec">직접 넣기</div><div class="row"><input type="text" id="gbg" placeholder="그림 주소 https://…" style="flex:1"><input type="text" id="gbgn" placeholder="장소 이름" style="width:160px"><label class="btn sm">파일<input type="file" accept="image/*" id="gbgf" hidden></label><button class="btn sm" data-gc="bgurl">적용</button></div>`}
  else if(GC.tab==='bgm'){const B=DB().bgm||{groups:{}};const gs=Object.keys(B.groups).sort();if(!GC.bgmGroup)GC.bgmGroup=gs[0]||'';const q=GC.bgmQ.trim().toLowerCase();const now=r.bgm||{};
   const list=q?gs.flatMap(g=>Object.keys(B.groups[g]).filter(s=>(g+' '+s).toLowerCase().includes(q)).map(s=>({g,s}))):Object.keys(B.groups[GC.bgmGroup]||{}).map(s=>({g:GC.bgmGroup,s}));
   body=`<div class="row" style="margin-bottom:8px"><div class="eq ${now.src?'':'off'}">♪</div><div style="flex:1"><small class="dim">지금 재생</small><br><b>${esc(now.title||'재생 중인 곡 없음')}</b></div><label class="small">내 음량 <input type="range" min="0" max="1" step="0.05" value="${vol}" id="gvol"></label><button class="btn sm ghost danger" data-gc="stop">정지</button></div>
    ${(r.recentBgm||[]).length?`<div class="sec">최근</div><div class="row" style="flex-wrap:wrap">${r.recentBgm.map(x=>`<button class="chip ${now.title===x.s?'on':''}" data-gc="play" data-g="${esc(x.g)}" data-s="${esc(x.s)}">${esc(x.s)}</button>`).join('')}</div>`:''}
    <div class="row" style="margin-top:8px"><select id="gbmg" style="flex:1" ${q?'disabled':''}>${gs.map(g=>`<option value="${esc(g)}" ${g===GC.bgmGroup?'selected':''}>${esc(g)} (${Object.keys(B.groups[g]).length})</option>`).join('')}</select><input type="text" id="gbmq" placeholder="전체에서 찾기" value="${esc(GC.bgmQ)}" style="width:200px"></div>
    <div class="songlist">${list.slice(0,300).map(x=>`<div class="song ${now.title===x.s?'cur':''}" data-gc="play" data-g="${esc(x.g)}" data-s="${esc(x.s)}"><b>${esc(x.s)}</b>${q?`<small class="dim"> ${esc(x.g)}</small>`:''}</div>`).join('')||'<div class="empty small">없다</div>'}${list.length>300?`<div class="small dim">${list.length-300}곡 더 — 검색어를 좁혀 줘</div>`:''}</div>
    <div class="sec">직접 넣기</div><div class="row"><input type="text" id="gmu" placeholder="mp3 직링크 (Dropbox 는 dl.dropboxusercontent.com)" style="flex:1"><input type="text" id="gmt" placeholder="제목" style="width:160px"><button class="btn sm" data-gc="playurl">재생</button></div>
    <div class="small dim" style="margin-top:4px">플레이어 화면에서는 「소리 켜기」를 한 번 눌러야 들린다 (브라우저 자동재생 제한). 음량은 각자 조절.</div>`}
  else if(GC.tab==='notice'){const ns=notices();
   body=`<div class="row" style="margin-bottom:8px"><span class="small">멘트 바꿔 보내기</span><input type="text" id="gsub" placeholder="비우면 공지에 저장된 멘트" style="flex:1"></div>
    <div class="ngrid">${ns.map((n,i)=>`<button class="nact" data-gc="note" data-i="${i}"><i style="background:${esc(n.color)}"></i><span>${esc(n.name)}${n.bgm==='stop'?'<small>BGM 정지</small>':''}</span></button>`).join('')}<button class="nact" data-gc="cut"><i style="background:#5b6278"></i><span>절취선<small>가로줄</small></span></button></div>
    <div class="sec">공지 관리</div><table class="t" id="ntab">${ns.map((n,i)=>`<tr><td><input type="text" data-nn value="${esc(n.name)}" style="width:110px"></td><td><input type="text" data-nt value="${esc(n.title)}" style="width:130px"></td><td><input type="text" data-nm value="${esc(n.ment)}" style="width:100%" placeholder="멘트"></td><td><input type="color" data-nc value="${esc(n.color)}"></td><td><select data-nb><option value="" ${!n.bgm?'selected':''}>BGM 그대로</option><option value="stop" ${n.bgm==='stop'?'selected':''}>BGM 정지</option></select></td><td><button class="btn xs ghost danger" data-gc="ndel" data-i="${i}">×</button></td></tr>`).join('')}</table>
    <div class="row" style="margin-top:6px"><button class="btn xs ghost" data-gc="nadd">+ 공지</button><button class="btn xs ghost" data-gc="nreset">기본값</button><span class="sp"></span><button class="btn sm pri" data-gc="nsave">저장</button></div>`}
  else if(GC.tab==='map'){const M=mapS();const locName=n=>(M.locs.find(x=>x.n===n)||{}).name||'';
   body=`<div class="pcard"><div class="ppin static"><span>PC</span></div><div style="flex:1"><small class="dim">파티 현재 위치${M.party.vis?' · 플레이어에게 보임':' · 핀 숨김'}</small><br><b>${M.party.n?M.party.n+'. '+esc(locName(M.party.n)):'—'}</b></div></div>
    <div class="row" style="margin:8px 0"><select id="gml" style="flex:1">${M.locs.map(l=>`<option value="${l.n}" ${l.n===M.party.n?'selected':''}>${l.n}. ${esc(l.name)}${M.vis[l.n]==1?' (가림)':''}</option>`).join('')}</select><button class="btn sm pri" data-gc="pmove">파티 이동</button><button class="btn sm" data-gc="pvis">${M.party.vis?'핀 숨기기':'핀 보이기'}</button></div>
    <label class="small"><input type="checkbox" data-gc="reveal" ${M.reveal?'checked':''}> 가려진 장소면 함께 공개</label> · <span class="small dim">${M.locs.filter(l=>M.vis[l.n]!=1).length}/${M.locs.length} 장소 공개</span>
    <div class="row" style="margin-top:10px"><button class="btn sm" data-gc="mapmgr">지도 관리 열기</button><button class="btn sm ghost" data-gc="mapopen">${mapOpen?'지도 닫기':'무대에 지도 열기'}</button></div>`}
  else if(GC.tab==='stage'){const manual=r.stage||{};const chars=[...Object.values((ST.state.roster||{}).trainers||{}).map(t=>({key:t.id,name:t.name})),...Object.values((ST.state.graph||{}).nodes||{}).map(n=>({key:'npc:'+n.name,name:n.name+' (NPC)'}))];
   body=`<div class="sec">자리 고정 <span class="note">비우면 말하는 사람이 자동으로 선다</span></div>${SLOTS.map(s=>`<div class="row" style="margin-bottom:4px"><b style="width:60px">${{left:'왼쪽',center:'가운데',right:'오른쪽'}[s]}</b><select data-slot="${s}" style="flex:1"><option value="">(자동)</option>${chars.map(c=>`<option value="${esc(c.key)}" ${(manual[s]||{}).key===c.key?'selected':''}>${esc(c.name)}</option>`).join('')}</select><label class="small"><input type="checkbox" data-flip="${s}" ${(manual[s]||{}).flip?'checked':''}> 반전</label></div>`).join('')}
    <div class="row"><button class="btn sm" data-gc="stageok">자리 적용</button><button class="btn sm ghost" data-gc="stageclear">무대 비우기</button></div>
    <div class="sec">스탠딩 관리</div><div class="row"><select id="gsc" style="flex:1">${chars.map(c=>`<option value="${esc(c.key)}">${esc(c.name)}</option>`).join('')}</select><button class="btn sm" data-gc="stands">표정·스탠딩 편집</button></div>
    <div class="sec">자막</div><div class="row"><input type="text" id="gcn" value="${esc((r.caption||{}).name||'')}" placeholder="이름" style="width:120px"><input type="text" id="gct" value="${esc((r.caption||{}).fixed?(r.caption.text||''):'')}" placeholder="고정 자막 (비우면 채팅이 자막)" style="flex:1"><button class="btn sm" data-gc="cap">고정</button><button class="btn sm ghost" data-gc="capx">풀기</button></div>`}
  else{body=`<div class="sec">중앙 이미지</div><div class="row"><input type="text" id="gci" placeholder="그림 주소" style="flex:1"><label class="btn sm">파일<input type="file" accept="image/*" id="gcif" hidden></label><button class="btn sm" data-gc="center">띄우기</button><button class="btn sm ghost" data-gc="centerx">내리기</button></div>
    <div class="sec">채팅 명령</div><table class="t small"><tr><td><code>/as 이름 말</code></td><td>그 인물로 말하기 (관계도의 NPC 면 스탠딩·아바타가 따라온다)</td></tr><tr><td><code>/s 라벨</code></td><td>내 표정(스탠딩) 바꾸기</td></tr><tr><td><code>/img 주소</code></td><td>채팅에 그림</td></tr><tr><td><code>/r 1d100</code></td><td>주사위</td></tr><tr><td><code>/w 이름 말</code></td><td>귓속말 (GM 은 GM)</td></tr><tr><td><code>/clear</code></td><td>무대의 스탠딩 모두 내리기 (GM)</td></tr></table>
    <div class="sec">귓속말</div><div class="row"><select id="gwto">${Object.entries(ST.state.seats||{}).map(([k,v])=>`<option value="${esc(k)}">${esc((((ST.state.roster||{}).trainers||{})[k]||{}).name||k)} (${esc(v.name)})</option>`).join('')}</select><input type="text" id="gwt" placeholder="메시지" style="flex:1"><button class="btn sm" data-gc="whisper">보내기</button></div>`}
  const md=A().openModal(`<div class="mhead"><h2>GM 콘솔</h2><span class="tabs2" style="margin:0 0 0 14px;flex:0 1 560px">${TABS.map(([k,n])=>`<button class="tab2 ${GC.tab===k?'on':''}" data-gc="tab" data-t="${k}">${n}</button>`).join('')}</span><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="gcbody">${body}</div>`);
  md.classList.add('wide');
  const re=()=>openConsole();
  md.querySelectorAll('[data-gc]').forEach(b=>{const h=async()=>{const k=b.dataset.gc;
   if(k==='tab'){GC.tab=b.dataset.t;return re()}
   if(k==='bgg'){GC.bgGroup=b.dataset.g;return re()}
   if(k==='bg'){const it=bgOf(b.dataset.k);if(!it)return;await A().set(['rp','bg'],{src:it.src,name:it.l,at:Date.now()});const rec=[b.dataset.k,...(r.recentBg||[]).filter(x=>x!==b.dataset.k)].slice(0,8);await A().set(['rp','recentBg'],rec);return re()}
   if(k==='bgx'){await A().set(['rp','bg'],null);return re()}
   if(k==='bgurl'){const u=$('#gbg',md).value.trim();if(!u)return;await A().set(['rp','bg'],{src:u,name:$('#gbgn',md).value.trim(),at:Date.now()});return re()}
   if(k==='stop'){await A().set(['rp','bgm'],null);return re()}
   if(k==='play'){const g=b.dataset.g,s=b.dataset.s;const u=bgmUrl(g,s);if(!u)return;unlocked=true;await A().set(['rp','bgm'],{src:u,title:s,group:g,at:Date.now()});const rec=[{g,s},...(r.recentBgm||[]).filter(x=>!(x.g===g&&x.s===s))].slice(0,10);await A().set(['rp','recentBgm'],rec);syncBgm(true);return re()}
   if(k==='playurl'){const u=$('#gmu',md).value.trim();if(!u)return;unlocked=true;await A().set(['rp','bgm'],{src:u,title:$('#gmt',md).value.trim()||u.split('/').pop(),at:Date.now()});syncBgm(true);return re()}
   if(k==='note'){const n=notices()[+b.dataset.i];const sub=$('#gsub',md).value.trim();A().closeModal();await fireNotice(n,sub);return}
   if(k==='cut'){A().closeModal();await A().sysLog('────────────────────');return}
   if(k==='nsave'){const rows=[...md.querySelectorAll('#ntab tr')].map((tr,i)=>({id:'n'+i,name:tr.querySelector('[data-nn]').value.trim(),title:tr.querySelector('[data-nt]').value.trim(),ment:tr.querySelector('[data-nm]').value,color:tr.querySelector('[data-nc]').value,bgm:tr.querySelector('[data-nb]').value})).filter(x=>x.name);await A().set(['rp','notices'],rows);return re()}
   if(k==='nadd'){await A().set(['rp','notices'],[...notices(),{id:'n'+Date.now().toString(36),name:'새 공지',title:'',ment:'',color:'#d9243f'}]);return re()}
   if(k==='ndel'){await A().set(['rp','notices'],notices().filter((x,i)=>i!==+b.dataset.i));return re()}
   if(k==='nreset'){await A().set(['rp','notices'],null);return re()}
   if(k==='pmove'){await partyMove(+$('#gml',md).value);return re()}
   if(k==='pvis'){const M=mapS();await saveMap({party:Object.assign({},M.party,{vis:M.party.vis?0:1})});return re()}
   if(k==='reveal'){await saveMap({reveal:b.checked?1:0});return}
   if(k==='mapmgr')return openMapMgr('loc');
   if(k==='mapopen'){mapOpen=!mapOpen;A().closeModal();return A().renderScene()}
   if(k==='stageok'){const st={};for(const s of SLOTS){const v=md.querySelector(`[data-slot="${s}"]`).value;if(v)st[s]={key:v,flip:md.querySelector(`[data-flip="${s}"]`).checked}}await A().set(['rp','stage'],Object.keys(st).length?st:null);return re()}
   if(k==='stageclear'){await A().set(['rp','stage'],null);await DBS().addLog(ST.room,ST.secret,'chat',ST.name,{t:'',clear:1});return re()}
   if(k==='stands'){return openStands($('#gsc',md).value)}
   if(k==='cap'){await A().set(['rp','caption'],{name:$('#gcn',md).value.trim(),text:$('#gct',md).value.trim(),at:Date.now(),fixed:true});return re()}
   if(k==='capx'){await A().set(['rp','caption'],null);return re()}
   if(k==='center'){const u=$('#gci',md).value.trim();if(!u)return;await A().set(['rp','center'],{src:u,at:Date.now()});return re()}
   if(k==='centerx'){await A().set(['rp','center'],null);return re()}
   if(k==='whisper'){const to=$('#gwto',md).value,t=$('#gwt',md).value.trim();if(!to||!t)return;await DBS().addLog(ST.room,ST.secret,'whisper',ST.name,{t,to,toName:(((ST.state.roster||{}).trainers||{})[to]||{}).name||to});$('#gwt',md).value='';A().toast('보냈다');return}};
   if(b.type==='checkbox')b.onchange=h;else b.onclick=h});
  const vr=$('#gvol',md);if(vr)vr.oninput=()=>{vol=+vr.value;try{localStorage.setItem('om_vol',vol)}catch(e){}if(audio)audio.volume=vol};
  const bq=$('#gbmq',md);if(bq){bq.oninput=()=>{GC.bgmQ=bq.value;const pos=bq.selectionStart;re();const nb=$('#gbmq');if(nb){nb.focus();nb.setSelectionRange(pos,pos)}}}
  const bg=$('#gbmg',md);if(bg)bg.onchange=()=>{GC.bgmGroup=bg.value;re()};
  const up=async(inp,target)=>{const f=inp.files[0];if(!f)return;A().toast('올리는 중…');try{const url=await DBS().uploadImage(`rooms/${ST.room}/rp_${Date.now().toString(36)}`,f);$(target,md).value=url;A().toast('올렸다 — 적용/띄우기를 눌러')}catch(e){A().toast(e.message)}};
  const f1=$('#gbgf',md);if(f1)f1.onchange=()=>up(f1,'#gbg');const f2=$('#gcif',md);if(f2)f2.onchange=()=>up(f2,'#gci')}
 async function fireNotice(n,sub){const ment=sub||n.ment||'';await A().set(['rp','banner'],{title:n.title||n.name,text:ment,color:n.color||'#d9243f',at:Date.now()});await A().sysLog(`[${n.title||n.name}]${ment?' '+ment.replace(/\n/g,' '):''}`);if(n.bgm==='stop')await A().set(['rp','bgm'],null)}

 /* ----- 스탠딩(표정) 편집: 트레이너는 로스터에, NPC 는 관계도 노드에 ----- */
 function openStands(key){const c=charOf(key);if(!c)return A().toast('그 인물이 없다');const ST=A().ST;const canEdit=gm()||(c.kind==='pc'&&c.id===ST.seat);
  const md=A().openModal(`<div class="mhead"><h2>${esc(c.name)} — 표정·스탠딩</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="small dim" style="margin-bottom:8px">채팅할 때 「사용 중」인 스탠딩이 무대에 선다. 없으면 초상(시트 그림)을 쓴다. 보정 = 위로 올릴 px (음수면 내림). 채팅에서 <code>/s 라벨</code> 로도 바꿀 수 있다.</div>
   <div class="stgrid">${c.stands.map((s,i)=>`<div class="stcard ${i===c.active?'on':''}"><div class="sth" style="${s.src?`background-image:url('${esc(s.src)}')`:''}"></div><b>${esc(s.label||'기본')}</b>${i===c.active?'<span class="tag me">사용 중</span>':''}<div class="row">${canEdit?`<button class="btn xs" data-st="use" data-i="${i}">사용</button><button class="btn xs ghost" data-st="edit" data-i="${i}">수정</button><button class="btn xs ghost danger" data-st="del" data-i="${i}">×</button>`:''}</div></div>`).join('')||'<div class="empty small">아직 스탠딩이 없다 — 시트 그림(초상)을 쓴다</div>'}</div>
   ${canEdit?`<div class="sec">추가</div><div class="row"><input type="text" id="st_l" placeholder="라벨 (기본·웃음·놀람…)" style="width:140px"><input type="text" id="st_u" placeholder="그림 주소 (투명 PNG 전신 권장)" style="flex:1"><label class="btn sm">파일<input type="file" accept="image/*" id="st_f" hidden></label><input type="number" class="n" id="st_p" value="0" title="보정 px"><button class="btn sm pri" data-st="add">추가</button></div>`:''}`);
  const save=async(stands,active)=>{if(c.kind==='pc'){await A().set(['roster','trainers',c.id,'stands'],stands);if(active!=null)await A().set(['roster','trainers',c.id,'standActive'],active)}else{if(!c.id)return A().toast('관계도에 없는 인물이다 — 관계도에 먼저 넣어 줘');await A().set(['graph','nodes',c.id,'stands'],stands);if(active!=null)await A().set(['graph','nodes',c.id,'standActive'],active)}A().closeModal();openStands(key)};
  md.querySelectorAll('[data-st]').forEach(b=>b.onclick=async()=>{const k=b.dataset.st;const i=+b.dataset.i;const st=c.stands.slice();
   if(k==='use')return save(st,i);
   if(k==='del'){st.splice(i,1);return save(st,Math.max(0,Math.min(c.active,st.length-1)))}
   if(k==='edit'){const s=st[i];const l=prompt('라벨',s.label||'');if(l==null)return;const u=prompt('그림 주소',s.src||'');if(u==null)return;const p=prompt('보정 px',s.point||0);st[i]={label:l,src:u,point:+p||0};return save(st,null)}
   if(k==='add'){const u=$('#st_u',md).value.trim();if(!u)return A().toast('그림 주소가 필요해');st.push({label:$('#st_l',md).value.trim()||'기본',src:u,point:+$('#st_p',md).value||0});return save(st,st.length-1)}});
  const f=$('#st_f',md);if(f)f.onchange=async()=>{const file=f.files[0];if(!file)return;A().toast('올리는 중…');try{$('#st_u',md).value=await DBS().uploadImage(`rooms/${ST.room}/st_${c.kind}_${(c.id||c.name)}_${Date.now().toString(36)}`,file);A().toast('올렸다 — 추가를 눌러')}catch(e){A().toast(e.message)}}}
 function openMyStand(){const ST=A().ST;if(gm()){const chars=[...Object.values((ST.state.roster||{}).trainers||{}).map(t=>({key:t.id,name:t.name})),...Object.values((ST.state.graph||{}).nodes||{}).map(n=>({key:'npc:'+n.name,name:n.name+' (NPC)'}))];
   const md=A().openModal(`<div class="mhead"><h2>표정·스탠딩</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="row"><select id="gsc2" style="flex:1">${chars.map(c=>`<option value="${esc(c.key)}">${esc(c.name)}</option>`).join('')}</select><button class="btn sm pri" id="gsc2ok">열기</button></div>`);$('#gsc2ok',md).onclick=()=>openStands($('#gsc2',md).value);return}
  if(!ST.seat)return A().toast('자리에 앉아야 한다');openStands(ST.seat)}
 /* 채팅 /s 라벨 */
 async function setMyStand(label){const ST=A().ST;if(ST.role==='gm')return A().toast('GM 은 콘솔 → 무대·스탠딩에서 바꿔');const c=charOf(ST.seat);if(!c)return;const i=c.stands.findIndex(s=>(s.label||'')===label);if(i<0)return A().toast('그런 표정이 없다: '+c.stands.map(s=>s.label).join(', '));await A().set(['roster','trainers',c.id,'standActive'],i);A().toast(`표정: ${label}`)}

 /* ----- 배너 / BGM / 상태 변화 ----- */
 function tickBanner(){const b=R().banner;if(!b||!b.at||b.at===lastBanner||Date.now()-b.at>15000)return;lastBanner=b.at;
  const el=document.createElement('div');el.className='banner';el.style.setProperty('--bc',b.color||'#d9243f');el.innerHTML=`<div class="bt">${esc(b.title||'')}</div>${b.text?`<div class="bm">${esc(b.text).replace(/\n/g,'<br>')}</div>`:''}`;document.body.appendChild(el);
  clearTimeout(bannerT);bannerT=setTimeout(()=>el.remove(),6000)}
 function syncBgm(force){const b=R().bgm;const src=b&&b.src||'';
  if(!src){if(audio){audio.pause();audio=null}lastBgm='';return}
  if(!unlocked)return;
  if(src!==lastBgm||force){if(audio)audio.pause();audio=new Audio(src);audio.loop=true;audio.volume=vol;audio.play().catch(()=>{});lastBgm=src}}
 function onChat(row){feedLog([row]);if(A().view==='rp'&&row.kind==='chat'&&row.data&&(row.data.t||row.data.clear))A().renderScene()}
 function onState(){tickBanner();syncBgm()}
 return {render,onChat,onState,mapData:mapS,openConsole,openStands,setMyStand,charOf};
})();
