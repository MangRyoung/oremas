/* ---------- RP 씬: 배경 · 스탠딩 · 자막 · 공지 배너 · BGM · 지도 ----------
   state.rp = { bg:{src,name}, stands:{left:{src,name,flip}, center:{…}, right:{…}}, caption:{name,text,at},
                banner:{title,text,color,at}, bgm:{src,title,at}, map:{src,w,h,locs:[{n,name,x,y}],open:{n:true},party:n,show:bool} } */
"use strict";
window.OM_RP_UI=(()=>{
 const A=()=>window.OM_APP, DBS=()=>window.OM_STORE;
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const $=(s,r)=>(r||document).querySelector(s);
 const SLOTS=[['left','왼쪽'],['center','가운데'],['right','오른쪽']];
 const DEFAULT_MAP={src:'img/map/mujin.webp',w:1800,h:1296,locs:[{"n":1,"name":"무진 중고등학교","x":591,"y":162},{"n":2,"name":"무연고 묘지","x":213,"y":145},{"n":3,"name":"숲 속의 폐가","x":313,"y":294},{"n":4,"name":"등불 교회","x":74,"y":867},{"n":5,"name":"무진포 (어선·항구)","x":349,"y":996},{"n":6,"name":"철물점 겸 고물상","x":378,"y":886},{"n":7,"name":"무진 경찰서","x":557,"y":778},{"n":8,"name":"마을회관 (대피소)","x":679,"y":629},{"n":9,"name":"무진 요양병원","x":511,"y":552},{"n":10,"name":"구(舊) 도서관","x":650,"y":389},{"n":11,"name":"흑익단 사무소","x":981,"y":316},{"n":12,"name":"무진 대학교","x":1157,"y":98},{"n":13,"name":"연구소","x":1562,"y":105},{"n":14,"name":"허수아비 헛간","x":1688,"y":466},{"n":15,"name":"자경단 초소","x":1398,"y":467},{"n":16,"name":"고문서 번역소","x":1108,"y":644},{"n":17,"name":"눈먼 갈매기 술집","x":1005,"y":749},{"n":18,"name":"수렵 총포사","x":1313,"y":752},{"n":19,"name":"검은모래 해변 (낡은 매점)","x":1723,"y":1014}],open:{},party:0,show:false};
 let audio=null,lastBgm='',unlocked=false,bannerT=null,lastBanner=0,mapOpen=false;
 function R(){return A().ST.state.rp||{}}
 function gm(){return A().ST.role==='gm'}
 function mapData(){return Object.assign({},DEFAULT_MAP,R().map||{})}

 function render(el){
  const r=R();const bg=r.bg||{};const st=r.stands||{};const cap=r.caption||{};const mp=mapData();
  el.innerHTML=`<div class="rpstage" style="${bg.src?`background-image:url('${esc(bg.src)}')`:''}">
   ${SLOTS.map(([k,n])=>{const s=st[k];if(!s||!s.src)return '';return `<div class="stand ${k}"><img src="${esc(s.src)}" alt="" style="${s.flip?'transform:scaleX(-1)':''}"><div class="stname">${esc(s.name||'')}</div></div>`}).join('')}
   ${cap.text?`<div class="caption"><div class="cname">${esc(cap.name||'')}</div><div class="ctext">${esc(cap.text)}</div></div>`:''}
   ${bg.name?`<div class="bgname">${esc(bg.name)}</div>`:''}
   <div class="rpbtns"><button class="btn sm ${mapOpen?'pri':''}" data-rp="map">${mapOpen?'지도 닫기':'지도'}</button><button class="btn sm" data-rp="deck">덱</button>${r.bgm&&r.bgm.src?`<button class="btn sm ghost" data-rp="sound">${unlocked?'♪ '+esc(r.bgm.title||'BGM'):'소리 켜기'}</button>`:''}${gm()?`<button class="btn sm pri" data-rp="gm">연출</button>`:''}</div>
   ${mapOpen?mapOverlay(mp):''}
  </div>`;
  el.querySelectorAll('[data-rp]').forEach(b=>b.onclick=()=>act(b.dataset.rp));
  el.querySelectorAll('[data-loc]').forEach(b=>b.onclick=()=>{if(gm())locMenu(+b.dataset.loc)});
  tickBanner();syncBgm()}

 function mapOverlay(mp){const open=mp.open||{};
  return `<div class="mapov"><div class="mapwrap" style="aspect-ratio:${mp.w}/${mp.h}"><img src="${esc(mp.src)}" alt="">
   ${(mp.locs||[]).map(l=>{const on=gm()||open[l.n];return `<div class="loc ${on?'':'hid'} ${mp.party===l.n?'party':''}" data-loc="${l.n}" style="left:${l.x/mp.w*100}%;top:${l.y/mp.h*100}%" title="${esc(l.name)}"><span class="ln">${l.n}</span><span class="lt">${esc(on?l.name:'?')}</span></div>`}).join('')}</div>
   <div class="maplist">${(mp.locs||[]).filter(l=>gm()||open[l.n]).map(l=>`<span class="chip ${mp.party===l.n?'on':''}">${l.n}. ${esc(l.name)}</span>`).join('')||'<span class="dim small">아직 알려진 장소가 없다</span>'}${gm()?'<span class="dim small"> · 마커를 누르면 공개/파티 이동</span>':''}</div></div>`}

 function act(k){
  if(k==='map'){mapOpen=!mapOpen;return A().renderScene()}
  if(k==='deck')return window.OM_DECK_UI.open();
  if(k==='sound'){unlocked=true;syncBgm(true);A().renderScene();return}
  if(k==='gm')return openGm()}
 async function locMenu(n){const mp=mapData();const l=(mp.locs||[]).find(x=>x.n===n);if(!l)return;const open=!!(mp.open||{})[n];
  const md=A().openModal(`<div class="mhead"><h2>${n}. ${esc(l.name)}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="row"><button class="btn" id="lopen">${open?'숨기기':'공개하기'}</button><button class="btn pri" id="lparty">파티를 여기로</button><button class="btn ghost" id="lfocus">자막으로 알리기</button></div>`);
  $('#lopen',md).onclick=async()=>{A().closeModal();await A().set(['rp','map','open',String(n)],open?null:true);if(!open)A().sysLog(`지도: ${l.name} 공개`)};
  $('#lparty',md).onclick=async()=>{A().closeModal();await A().set(['rp','map','party'],n);A().sysLog(`파티 이동 → ${l.name}`)};
  $('#lfocus',md).onclick=async()=>{A().closeModal();await A().set(['rp','caption'],{name:'장소',text:l.name,at:Date.now()})}}

 /* ----- 연출 패널 (GM) ----- */
 function openGm(){const r=R();const st=r.stands||{};const roster=A().ST.state.roster||{trainers:{},mons:{}};const graph=A().ST.state.graph||{nodes:{}};
  const pics=[...Object.values(roster.trainers||{}).map(t=>({n:t.name,src:t.image})),...Object.values(roster.mons||{}).map(m=>({n:m.name,src:m.image})),...Object.values(graph.nodes||{}).map(x=>({n:x.name,src:x.img}))].filter(p=>p.src);
  const md=A().openModal(`<div class="mhead"><h2>연출</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="sec">배경</div><div class="row"><input type="text" id="gbg" value="${esc((r.bg||{}).src||'')}" placeholder="그림 주소 https://…" style="flex:1"><input type="text" id="gbgn" value="${esc((r.bg||{}).name||'')}" placeholder="장소 이름" style="width:160px"><label class="btn sm">파일<input type="file" accept="image/*" id="gbgf" hidden></label><button class="btn sm" id="gbgok">적용</button><button class="btn sm ghost" id="gbgx">지우기</button></div>
   <div class="sec">스탠딩</div>${SLOTS.map(([k,n])=>`<div class="row" style="margin-bottom:4px"><b style="width:56px">${n}</b><select data-st="${k}" style="flex:1"><option value="">(없음)</option>${pics.map(p=>`<option value="${esc(p.src)}" ${(st[k]||{}).src===p.src?'selected':''}>${esc(p.n)}</option>`).join('')}</select><input type="text" data-stu="${k}" placeholder="또는 주소" style="width:160px"><input type="text" data-stn="${k}" value="${esc((st[k]||{}).name||'')}" placeholder="이름표" style="width:100px"><label><input type="checkbox" data-stf="${k}" ${(st[k]||{}).flip?'checked':''}> 반전</label></div>`).join('')}<div class="row"><button class="btn sm" id="gstok">스탠딩 적용</button></div>
   <div class="sec">자막</div><div class="row"><input type="text" id="gcn" value="${esc((r.caption||{}).name||'')}" placeholder="이름" style="width:120px"><input type="text" id="gct" value="${esc((r.caption||{}).text||'')}" placeholder="자막 (비우면 채팅이 자막이 된다)" style="flex:1"><button class="btn sm" id="gcok">띄우기</button><button class="btn sm ghost" id="gcx">지우기</button></div>
   <div class="sec">공지 배너</div><div class="row"><input type="text" id="gbt" placeholder="제목 (씬 오픈 / 씬 전환 …)" style="width:200px"><input type="text" id="gbm" placeholder="한 줄" style="flex:1"><select id="gbc"><option value="#d9243f">빨강</option><option value="#3ddc84">초록</option><option value="#4aa3ff">파랑</option><option value="#f0c84a">노랑</option></select><button class="btn sm" id="gbok">띄우기</button></div>
   <div class="sec">BGM</div><div class="row"><input type="text" id="gmu" value="${esc((r.bgm||{}).src||'')}" placeholder="mp3 직링크 (Dropbox 는 dl=1)" style="flex:1"><input type="text" id="gmt" value="${esc((r.bgm||{}).title||'')}" placeholder="제목" style="width:160px"><button class="btn sm" id="gmok">재생</button><button class="btn sm ghost" id="gmx">끄기</button></div>
   <div class="small dim" style="margin-top:4px">플레이어 화면에서는 「소리 켜기」를 한 번 눌러야 들린다 (브라우저 자동재생 제한).</div>`);
  $('#gbgok',md).onclick=async()=>{A().closeModal();await A().set(['rp','bg'],{src:$('#gbg',md).value.trim(),name:$('#gbgn',md).value.trim()})};
  $('#gbgx',md).onclick=async()=>{A().closeModal();await A().set(['rp','bg'],null)};
  $('#gbgf',md).onchange=async()=>{const f=$('#gbgf',md).files[0];if(!f)return;A().toast('올리는 중…');try{const url=await DBS().uploadImage(`rooms/${A().ST.room}/bg_${Date.now().toString(36)}`,f);$('#gbg',md).value=url;A().toast('올렸다. 적용을 눌러')}catch(e){A().toast(e.message)}};
  $('#gstok',md).onclick=async()=>{const ns={};for(const [k] of SLOTS){const u=md.querySelector(`[data-stu="${k}"]`).value.trim()||md.querySelector(`[data-st="${k}"]`).value;if(u)ns[k]={src:u,name:md.querySelector(`[data-stn="${k}"]`).value.trim(),flip:md.querySelector(`[data-stf="${k}"]`).checked}}A().closeModal();await A().set(['rp','stands'],ns)};
  $('#gcok',md).onclick=async()=>{A().closeModal();await A().set(['rp','caption'],{name:$('#gcn',md).value.trim(),text:$('#gct',md).value.trim(),at:Date.now(),fixed:true})};
  $('#gcx',md).onclick=async()=>{A().closeModal();await A().set(['rp','caption'],null)};
  $('#gbok',md).onclick=async()=>{const t=$('#gbt',md).value.trim(),m=$('#gbm',md).value.trim();if(!t&&!m)return;A().closeModal();await A().set(['rp','banner'],{title:t,text:m,color:$('#gbc',md).value,at:Date.now()});A().sysLog(`[공지] ${t}${m?' — '+m:''}`)};
  $('#gmok',md).onclick=async()=>{const u=$('#gmu',md).value.trim();A().closeModal();await A().set(['rp','bgm'],u?{src:u,title:$('#gmt',md).value.trim(),at:Date.now()}:null);unlocked=true;syncBgm(true)};
  $('#gmx',md).onclick=async()=>{A().closeModal();await A().set(['rp','bgm'],null)}}

 /* ----- 배너 (모든 화면, 6초) ----- */
 function tickBanner(){const b=R().banner;if(!b||!b.at||b.at===lastBanner||Date.now()-b.at>15000)return;lastBanner=b.at;
  const el=document.createElement('div');el.className='banner';el.style.setProperty('--bc',b.color||'#d9243f');el.innerHTML=`<div class="bt">${esc(b.title||'')}</div>${b.text?`<div class="bm">${esc(b.text)}</div>`:''}`;document.body.appendChild(el);
  clearTimeout(bannerT);bannerT=setTimeout(()=>el.remove(),6000)}
 /* ----- BGM ----- */
 function syncBgm(force){const b=R().bgm;const src=b&&b.src||'';
  if(!src){if(audio){audio.pause();audio=null}lastBgm='';return}
  if(!unlocked)return;
  if(src!==lastBgm||force){if(audio)audio.pause();audio=new Audio(src);audio.loop=true;audio.volume=0.5;audio.play().catch(()=>{});lastBgm=src}}
 /* 채팅이 오면 자막으로 (GM 이 고정 자막을 띄운 게 아닐 때) */
 function onChat(row){const cap=R().caption;if(cap&&cap.fixed)return;if(A().view!=='rp')return;const d=row.data||{};if(row.kind!=='chat')return;
  const el=document.querySelector('.rpstage');if(!el)return;let c=el.querySelector('.caption');if(!c){c=document.createElement('div');c.className='caption';el.appendChild(c)}
  c.innerHTML=`<div class="cname">${esc(row.who)}</div><div class="ctext">${esc(d.t)}</div>`}
 function onState(){tickBanner();syncBgm()}
 return {render,onChat,onState,mapData};
})();
