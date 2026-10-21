/* ---------- RP 씬 + GM 콘솔 (맵툴 Lib:GM · Lib:map · 스탠딩을 옮긴 것) ----------
   state.rp = {
     bg:{src,name,at}                                 배경 (data/bg.js 목록 또는 주소·올린 파일)
     caption:{name,text,at,fixed}                     GM 고정 자막 (없으면 채팅이 자막)
     bubble:{on,c,l,r}                                그림 말풍선 (꼬리 없음 · 왼쪽 · 오른쪽 그림 주소 — GM 이 방 저장소에 올린다)
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
 /* 브라우저는 사용자가 한 번 누르기 전엔 소리를 막는다 — 새로고침 뒤 화면 어디든 처음 누르면(키 입력 포함) 바로 소리를 켠다. 「끄기」를 누른 사람은 다시 켜지 않는다 */
 let userMuted=false;
 const autoUnlock=()=>{if(unlocked||userMuted)return;try{if(!A()||!A().ST||!A().ST.room)return;unlocked=true;if((R().bgm||{}).src){syncBgm(true);setTimeout(()=>{if(A().view==='rp')A().renderScene()},0)}}catch(e){}};
 document.addEventListener('click',autoUnlock,true);document.addEventListener('keydown',autoUnlock,true);
 try{vol=+(localStorage.getItem('om_vol')||0.5)}catch(e){}
 /* 무대 위 화자 자리: 로그를 차례로 먹여서 모두 같은 결과가 나온다 */
 const STAGE={slots:{left:null,center:null,right:null},last:{},active:null,seen:0};
 function R(){return A().ST.state.rp||{}}
 function gm(){return A().ST.role==='gm'}
 /* GM(나레이션) 칩 · 로그 아바타 그림: rp.gmImg */
 const gmImg=()=>((A().ST.state.rp||{}).gmImg)||'';
 /* 지도 그림: 방에서 올린 그림(rp.map.img) → 「무진」 기본(preset 'mujin') → 없음. 예전 방(그림 설정 없이 지도를 쓰던 방)은 그대로 무진 기본을 쓴다 */
 function mapImg(){const m=R().map||{};if(m.img&&m.img.src)return m.img;if(m.preset==='mujin')return MAP_IMG;if(m.preset==='none')return null;const legacy=!!(m.vis||m.party||m.routes||m.npcs||(m.locs&&m.locs.length));return legacy?MAP_IMG:null}
 function mapIsMujin(){const m=R().map||{};return !(m.img&&m.img.src)&&m.preset!=='none'&&mapImg()===MAP_IMG}
 function mapS(){const m=R().map||{};const locs=m.locs&&m.locs.length?m.locs:(mapIsMujin()?DEFAULT_LOCS:[]);return {locs,vis:m.vis||{},party:m.party||{n:0,vis:1},routes:m.routes||[],npcs:m.npcs||[],ann:m.ann==null?1:m.ann,reveal:m.reveal==null?1:m.reveal,img:mapImg()}}
 function notices(){return (R().notices&&R().notices.length)?R().notices:DEFAULT_NOTICES}
 function bgGroups(){return R().bgList||DB().bg||[]}
 function bgOf(k){for(const g of bgGroups())for(const i of g.i)if(i.k===k)return Object.assign({g:g.n},i);return null}
 /* 브금 목록 = 기본 목록 + 방에서 더한 것 − 방에서 지운 것 (rp.bgmX = {add:{g:{s:url}}, del:{"g":1, "g\u0001s":1}}) */
 function bgmGroups(){const b=DB().bgm||{groups:{}};const X=R().bgmX||{};const del=X.del||{};const out={};
  for(const g in b.groups){if(del[g])continue;out[g]={};for(const s in b.groups[g]){if(del[g+'\u0001'+s])continue;out[g][s]=b.groups[g][s]}}
  for(const g in X.add||{}){if(del[g])continue;out[g]=out[g]||{};for(const s in X.add[g]){if(del[g+'\u0001'+s])continue;out[g][s]=X.add[g][s]}}
  for(const g in out)if(!Object.keys(out[g]).length&&!(X.add||{})[g])delete out[g];return out}
 function bgmUrl(g,s){const b=DB().bgm||{};const p=(bgmGroups()[g]||{})[s];return p?(/^https?:/.test(p)?p:b.base+p):''}

 /* ----- 화자(스탠딩) ----- */
 function charOf(key){const ST=A().ST;if(!key)return null;
  if(key==='gm'){const g=R().gmSt||{};return {key,name:'GM',img:gmImg(),stands:g.stands||[],active:g.standActive||0,kind:'gm',id:'gm'}}
  if(key.startsWith('pm:')){const mid=key.slice(3);const m=((ST.state.roster||{}).mons||{})[mid];if(!m)return null;return {key,name:m.name,img:m.image||'',stands:m.stands||[],active:m.standActive||0,kind:'pm',id:mid,tid:m.tid}}
  if(key.startsWith('as:')){const t=Object.values((ST.state.roster||{}).trainers||{}).find(x=>x.name===key.slice(3));return t?charOf(t.id):null}
  if(key.startsWith('npc:')){const name=key.slice(4);const n=Object.values((ST.state.graph||{}).nodes||{}).find(x=>x.name===name);return n?{key,name:n.name,img:A().portraitOf(n.name,n.img),stands:n.stands||[],active:n.standActive||0,kind:'npc',id:n.id}:{key,name,img:A().portraitOf(name,''),stands:[],active:0,kind:'npc',id:''}}
  const t=((ST.state.roster||{}).trainers||{})[key];if(!t)return null;return {key,name:t.name,img:t.image,stands:t.stands||[],active:t.standActive||0,kind:'pc',id:key}}
 function standSrc(c){if(!c)return '';const s=(c.stands||[])[c.active]||(c.stands||[])[0];return (s&&s.src)||c.img||''}
 function standKind(c){if(!c)return '';const st=(c.stands||[])[c.active]||(c.stands||[])[0];return st&&st.kind?st.kind:''}
 function standPoint(c){const s=(c.stands||[])[c.active]||(c.stands||[])[0];return s&&+s.point||0}
 function speakerKey(row){const d=row.data||{};if(d.as){const t=Object.values((A().ST.state.roster||{}).trainers||{}).find(x=>x.name===d.as);return t?t.id:'npc:'+d.as}if(d.from&&d.from!=='gm')return d.from;if(d.from==='gm'&&((R().gmSt||{}).stands||[]).length)return 'gm';return ''}
 /* 화자 자리: 첫 화자는 가운데, 다음 화자는 왼쪽·오른쪽을 채운다. 마지막 대사 뒤 STAND_TTL 이 지나면 사라진다 (로그 시각 기준이라 모두 같은 결과) */
 const STAND_TTL=40000;
 function feedLog(rows){for(const r of rows){if(r.id<=STAGE.seen)continue;STAGE.seen=r.id;if(r.kind!=='chat')continue;const d=r.data||{};if(d.sms||d.bat||d.ch==='ooc')continue;const at=Date.parse(r.at)||Date.now();
   if(d.clear){STAGE.slots={left:null,center:null,right:null};STAGE.active=null;continue}
   const k=speakerKey(r);if(!k||!d.t)continue;if(k==='gm'&&window.OM_LINE&&window.OM_LINE(d).narr)continue;expire(at);STAGE.last[k]=at;STAGE.active=k;
   if(Object.values(STAGE.slots).includes(k))continue;
   const free=['center','left','right'].find(s=>!STAGE.slots[s]);if(free){STAGE.slots[free]=k;continue}
   const oldest=SLOTS.slice().sort((a,b)=>(STAGE.last[STAGE.slots[a]]||0)-(STAGE.last[STAGE.slots[b]]||0))[0];STAGE.slots[oldest]=k}}
 function expire(now){now=now||Date.now();for(const s of SLOTS){const k=STAGE.slots[s];if(k&&now-(STAGE.last[k]||0)>STAND_TTL){STAGE.slots[s]=null;if(STAGE.active===k)STAGE.active=null}}}
 let expT=null;
 function scheduleExpire(){clearTimeout(expT);const keys=Object.values(STAGE.slots).filter(Boolean);if(!keys.length)return;const next=Math.min(...keys.map(k=>(STAGE.last[k]||0)+STAND_TTL))-Date.now();expT=setTimeout(()=>{if(A().view==='rp')A().renderScene()},Math.max(200,next+50))}

 /* ----- 무대 ----- */
 function render(el){
  feedLog(A().ST.log||[]);expire();
  const r=R();const bg=r.bg||{};const cap=r.caption||{};const manual=r.stage||{};
  const slots={};for(const s of SLOTS){const m=manual[s];slots[s]=m&&m.key?m.key:STAGE.slots[s]}
  const cutId=+((A().ST.state.rp||{}).logClearAt)||0;const lastChat=[...(A().ST.log||[])].reverse().find(x=>x.id>cutId&&x.kind==='chat'&&x.data&&x.data.t&&!x.data.sms&&!x.data.bat&&x.data.ch!=='ooc');
  const LF=window.OM_LINE||(d=>({narr:false,text:String(d.t||''),q:true}));
  const line=(name,d)=>{const f=LF(d);return `<div class="dname"><span>${esc(name)}</span></div><div class="dtext ${f.narr?'narr':''}">${f.narr?esc(f.text):(f.q?esc(f.text.trim()):'"'+esc(f.text)+'"')}</div>`};
  const showDlg=cap.text||(lastChat&&Date.now()-(Date.parse(lastChat.at)||0)<STAND_TTL*2);
  const dlgHtml=cap.text?line(cap.name||'',{t:cap.text}):(showDlg?line(lastChat.data.as||(charOf(speakerKey(lastChat))||{}).name||lastChat.who,lastChat.data):'');
  const ST=A().ST;const speakers=gm()?allSpeakers():(ST.seat?[{key:'me',name:(charOf(ST.seat)||{}).name||ST.name},...Object.values((ST.state.roster||{}).mons||{}).filter(m=>m.tid===ST.seat).map(m=>({key:'pm:'+m.id,name:m.name+' (포켓몬)'}))]:[]);
  if(gm()&&!SPK.key)SPK.key='gm';if(!gm()&&(!SPK.key||SPK.key==='gm'))SPK.key='me';
  /* 뼈대는 한 번만 — 스탠딩이 매번 다시 그려져 애니메이션이 되풀이되지 않게 */
  let stage=$('#rpstage',el);
  if(!stage){el.innerHTML=`<div class="rpwrap"><div class="rpstage" id="rpstage"><div class="stands" id="stands"></div><div class="dlg" id="dlg"></div><div class="typing" id="typing"></div><div id="bgname"></div><div id="centerimg"></div><div class="rpbtns" id="rpbtns"></div><div id="mapov"></div></div><div id="rpunder"></div></div>`;stage=$('#rpstage',el)}
  stage.style.backgroundImage=bg.src?`url('${cssu(bg.src)}')`:'';
  const cal=ST.state.calendar||{};const dt=cal.today?(()=>{const d=new Date(cal.today+'T00:00:00');return {md:cal.today.slice(5).replace('-','/'),wd:['일','월','화','수','목','금','토'][d.getDay()]}})():null;
  $('#bgname',el).innerHTML=`<div class="stagetags">${dt?`<div class="daytag" ${gm()?'data-rp="phase" title="눌러서 시간대 바꾸기"':''}><b>${esc(dt.md)}</b><i>${dt.wd}</i>${cal.weather?`<em>${esc(cal.weather)}</em>`:''}${cal.phase?`<span class="phase ${({아침:'morning',저녁:'evening',밤:'night',심야:'night'})[cal.phase]||''}">${esc(cal.phase)}</span>`:''}</div>`:''}${bg.name?`<div class="bgname">${esc(bg.name)}</div>`:''}</div>`;
  $('#centerimg',el).innerHTML=r.center&&r.center.src?`<div class="centerimg"><img src="${esc(r.center.src)}" alt="">${gm()?'<button class="btn xs" data-rp="centerx">닫기</button>':''}</div>`:'';
  $('#rpbtns',el).innerHTML=`<span id="typingRp" class="typingslot ${TYPING_HTML?'on':''}">${TYPING_HTML}</span><button class="btn sm rpspkbtn" data-rp="spkpop" title="화자 · 인물 · 표정">🎭 화자</button>${gm()?`<button class="btn sm" data-rp="qbg" title="배경 바꾸기">🖼 배경</button><button class="btn sm" data-rp="qbgm" title="BGM 바꾸기">♪ BGM</button>`:''}<button class="btn sm" data-rp="log" title="대화 기록">📜 기록</button><button class="btn sm ${mapOpen?'pri':''}" data-rp="map">${mapOpen?'지도 닫기':'지도'}</button><button class="btn sm" data-rp="deck">덱</button><button class="btn sm" data-rp="phone" title="휴대폰 — 연락처 · 협력자 · 캘린더">📱 휴대폰</button><button class="btn sm ghost" data-rp="stand">표정</button>${r.bgm&&r.bgm.src?(unlocked?`<button class="btn sm ghost" data-rp="${gm()?'bgmstop':'mute'}" title="${esc(r.bgm.title||'')}${gm()?' — 누르면 모두에게 정지':' — 누르면 내 소리만 끄기'}">♪ ${esc(r.bgm.title||'BGM')} ■</button>`:`<button class="btn sm ghost" data-rp="sound" title="${esc(r.bgm.title||'')}">소리 켜기</button>`):''}${gm()?`<button class="btn sm pri" data-rp="gm">GM 콘솔</button>`:''}`;
  $('#mapov',el).innerHTML=mapOpen?mapOverlay():'';
  /* 그림 말풍선 (rp.bubble) — 대사 전용: 말하는 사람이 왼쪽 자리면 꼬리 왼쪽 그림을 그 오른편에, 오른쪽이면 반대, 가운데·무대 밖이면 꼬리 왼쪽 그림을 화면 가운데 오른편에(mid).
     지문(비문)·고정 자막은 꼬리 없는 그림 — 그게 없으면 기본 검은 띠 */
  const bub=r.bubble||{};let skin=null;if(bub.on&&(bub.c||bub.l||bub.r||bub.m)&&dlgHtml){const narr=!!cap.text||!lastChat||LF(lastChat.data||{}).narr;
   if(narr){if(bub.c)skin={v:'c',src:bub.c}}
   else{const sk=speakerKey(lastChat);const sl=sk?SLOTS.find(x=>slots[x]===sk):'';const want=sl==='right'?'r':'l';const alt=want==='l'?'r':'l';
    /* 10-21 망령: 가운데(·무대 밖) 화자는 「꼬리 가운데」 그림이 있으면 그걸로 */
    if(sl!=='left'&&sl!=='right'&&bub.m)skin={v:'m',src:bub.m};else if(bub[want])skin={v:want,src:bub[want]};else if(bub[alt])skin={v:want,src:bub[alt],flip:1};else skin={v:'c',src:bub.c};
    if(skin.v!=='c'&&skin.v!=='m'&&sl!=='left'&&sl!=='right')skin.mid=1}}
  const dlg=$('#dlg',el);if(dlgHtml){if(dlg.dataset.k!==dlgHtml){dlg.innerHTML=dlgHtml;dlg.dataset.k=dlgHtml;dlg.classList.remove('pop');void dlg.offsetWidth;dlg.classList.add('pop')}dlg.style.display=''}else{dlg.style.display='none';dlg.dataset.k=''}
  dlg.classList.toggle('skin',!!skin);for(const v of ['c','l','r','m'])dlg.classList.toggle('s'+v,!!skin&&skin.v===v);dlg.classList.toggle('flip',!!(skin&&skin.flip));dlg.classList.toggle('mid',!!(skin&&skin.mid));dlg.style.setProperty('--bub',skin?`url('${cssu(skin.src)}')`:'');bubStyle(dlg,bub.st);
  syncStands($('#stands',el),slots,manual);
  /* 무대 아래: 칸마다 바뀐 것만 다시 그린다 — 대사 입력칸은 그대로 두어야 치는 중에 끊기지 않는다 (한글 조합·포커스 유지) */
  const barH=`${gm()?spkBarHtml(speakers):(speakers.length>1?`<div class="spkbar">${speakers.map(x=>{const c=x.key==='me'?charOf(ST.seat):charOf(x.key);const av=c?(standSrc(c)||c.img):'';return spkChip(x.key,x.name,av,SPK.key===x.key||(!SPK.key&&x.key==='me'))}).join('')}<button class="spk add" data-rp="spkedit" title="고른 인물의 표정·스탠딩"><i>✎</i><span>표정</span></button></div>`:'')}`;
  const inH=speakers.length?`<div class="rpinput"><select id="rpspk">${speakers.map(x=>`<option value="${esc(x.key)}">${esc(x.name)}</option>`).join('')}</select><input type="text" id="rpline" placeholder="그냥 치면 지문 · &quot;대사&quot; 는 따옴표로 · @표정 &quot;대사&quot;" autocomplete="off"><button class="btn pri" id="rpsend">보내기</button></div><div class="small dim rphint">${gm()?'그냥 치면 지문, "…" 「…」 로 감싸면 대사 · 고른 인물로 말하면 그 인물의 스탠딩이 선다 · 「@웃음 "대사"」처럼 @등록명으로 표정을 바꾸며 말한다':'그냥 치면 지문, "…" 「…」 로 감싸면 대사 · 스탠딩 그림이 아직 없으면 시트 그림(초상)으로 선다 — 「표정」에서 전신 그림을 넣고, 「@웃음 "대사"」로 표정을 바꾸며 말한다'}</div>`:'<div class="small dim rphint">자리에 앉으면 여기서 대사를 칠 수 있다</div>';
  const under=$('#rpunder',el);if(!$('#rpu_in',under)){under.innerHTML='<div id="rpu_bar"></div><div class="rpfabbg" id="rpu_fabbg"></div><div id="rpu_in"></div><div id="rpu_me"></div>';bindSpkPop(under)}
  const setH=(id,h)=>{const bx=$('#'+id,under);if(bx._h===h)return false;bx.innerHTML=h;bx._h=h;return true};
  const hadFocus=!!(document.activeElement&&document.activeElement.id==='rpline');setH('rpu_bar',barH);const inNew=setH('rpu_in',inH);if(inNew&&hadFocus)SPK.focus=true;setH('rpu_me',meBarHtml());
  {const sb=$('.rpspkbtn',el);if(sb)sb.style.display=$('#rpu_bar',under).innerHTML.trim()?'':'none'}
  {const s=$('#rpspk',el);if(s&&SPK.key&&[...s.options].some(o=>o.value===SPK.key)&&s.value!==SPK.key)s.value=SPK.key}
  const bindRp=root=>root.querySelectorAll('[data-rp]').forEach(b=>b.onclick=e=>{if(b.dataset.rp==='spkpop'){e.stopPropagation();$('#rpunder',el).classList.toggle('spkpop');return}if(b.dataset.rp==='mon'){const ST=A().ST;const bm=((ST.state.battle||{}).mons||{})[b.dataset.mid];if(bm)return A().openMon(b.dataset.mid);const m=((ST.state.roster||{}).mons||{})[b.dataset.mid];if(m&&window.OM_SHEET_UI){window.OM_SHEET_UI.UI.tid=m.tid;window.OM_SHEET_UI.UI.mid=m.id;window.OM_SHEET_UI.UI.tab='poke';A().view='sheet';A().renderScene()}return}act(b.dataset.rp)});bindRp(el);
  const refreshMeBar=()=>{const old=el.querySelector('.mebar');if(!old)return;const tmp=document.createElement('div');tmp.innerHTML=meBarHtml();const nw=tmp.firstElementChild;if(nw){old.replaceWith(nw);bindRp(nw)}};
  const spk=$('#rpspk',el);if(spk)spk.onchange=()=>{SPK.key=spk.value;el.querySelectorAll('.spk[data-spk]').forEach(b=>b.classList.toggle('on',b.dataset.spk===SPK.key))};
  el.querySelectorAll('.spk[data-spk]').forEach(b=>b.onclick=()=>{SPK.key=b.dataset.spk;if(spk)spk.value=SPK.key;el.querySelectorAll('.spk[data-spk]').forEach(x=>x.classList.toggle('on',x===b));refreshMeBar();const inp=$('#rpline',el);if(inp)inp.focus()});
  if(spk){const o=spk.onchange;spk.onchange=()=>{o&&o();refreshMeBar()}}
  el.querySelectorAll('.spk[data-fold]').forEach(b=>b.onclick=()=>{SPK.folder=SPK.folder===b.dataset.fold?'':b.dataset.fold;A().renderScene()});const fc=el.querySelector('[data-fclose]');if(fc)fc.onclick=()=>{SPK.folder='';A().renderScene()};
  bindSpkDrag(el);
  const inp=$('#rpline',el);if(inp&&inNew){inp.value=SPK.draft||'';inp.oninput=()=>{SPK.draft=inp.value;typingPing()};inp.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing)sendLine()};$('#rpsend',el).onclick=sendLine}if(inp&&SPK.focus){inp.focus();SPK.focus=false}
  bindMap(el);tickBanner();syncBgm();scheduleExpire();drawTyping()}
 /* 스탠딩 DOM 을 키로 맞춘다: 새로 선 것만 등장 애니메이션, 자리 바뀜·표정 바뀜은 제자리에서 */
 function syncStands(box,slots,manual){const want={};for(const s of SLOTS){const c=charOf(slots[s]);const src=standSrc(c);if(c&&src)want[s]={key:c.key,src,name:c.name,point:standPoint(c),kind:standKind(c),flip:!!(manual[s]||{}).flip,on:STAGE.active===c.key||!STAGE.active}}
  [...box.children].forEach(ch=>{const s=ch.dataset.slot;if(!want[s]||want[s].key!==ch.dataset.key){ch.classList.add('out');setTimeout(()=>ch.remove(),350)}});
  for(const s of SLOTS){const w=want[s];if(!w)continue;let ch=[...box.children].find(x=>x.dataset.slot===s&&x.dataset.key===w.key&&!x.classList.contains('out'));
   if(!ch){ch=document.createElement('div');ch.dataset.slot=s;ch.dataset.key=w.key;ch.className=`stand ${s} in`;ch.innerHTML=`<img alt=""><div class="stname"></div>`;box.appendChild(ch)}
   const img=ch.querySelector('img');if(img.getAttribute('src')!==w.src){img.src=w.src;ch.classList.remove('portrait');img.onload=()=>{const k=ch.dataset.kind||(img.naturalHeight/Math.max(1,img.naturalWidth)<1.45?'portrait':'stand');ch.classList.toggle('portrait',k==='portrait')}}
   ch.dataset.kind=w.kind||'';if(w.kind)ch.classList.toggle('portrait',w.kind==='portrait');else if(img.complete&&img.naturalWidth)ch.classList.toggle('portrait',img.naturalHeight/img.naturalWidth<1.45);img.style.transform=w.flip?'scaleX(-1)':'';ch.style.marginBottom=ch.classList.contains('portrait')?'':(-w.point)+'px';ch.querySelector('.stname').textContent=w.name;
   ch.classList.toggle('on',w.on);ch.classList.toggle('off',!w.on)}}
 /* ----- 입력 중 표시: 저장 없이 방송 ----- */
 const TYPING={last:0,who:{},t:null};
 /* 입력 중: 내 것은 바로 화면에(브로드캐스트는 나한테 안 돌아오니까), 남에게는 2.5초에 한 번 보낸다 */
 /* ooc: 잡담 탭에서 치는 중 — 위쪽 표시에만 나오고 무대에는 안 나온다 */
 function typingPing(ooc){ooc=ooc===true;const now=Date.now();const c=ooc?null:speakerChar();const who=c&&c.kind!=='gm'?c.name:(A().ST.role==='gm'?'GM'+(A().ST.gmNick?' · '+A().ST.gmNick:''):A().ST.name);const me=A().ST.role==='gm'?'gm':A().ST.seat;if(!me)return;TYPING.who[me+'|'+who+(ooc?'|o':'')]={who,at:now,me:true,from:me,ooc};drawTyping();clearTimeout(TYPING.t);TYPING.t=setTimeout(drawTyping,4200);if(now-TYPING.last<2500)return;TYPING.last=now;DBS().broadcast({t:'typing',who,from:me,at:now,ooc})}
 function typingStop(){const me=A().ST.role==='gm'?'gm':A().ST.seat;for(const k in TYPING.who)if(TYPING.who[k].me)delete TYPING.who[k];TYPING.last=0;drawTyping()}
 /* 남의 입력 중: 같은 사람이 창 두 개나 다른 인물로 치면 따로 보인다 (from|who 로 키) */
 function onTyping(p){if(!p||!p.from)return;const me=A().ST.role==='gm'?'gm':A().ST.seat;const key=p.from+'|'+(p.who||'')+(p.ooc?'|o':'');if(p.from===me&&TYPING.who[key]&&TYPING.who[key].me)return;TYPING.who[key]={who:p.who,at:Date.now(),from:p.from,ooc:!!p.ooc};drawTyping();clearTimeout(TYPING.t);TYPING.t=setTimeout(drawTyping,4200)}
 /* 입력 중 표시 자리: 배틀 화면은 턴 바 가운데(#typingBat), RP 무대는 버튼 줄 왼쪽(#typingRp), 그 밖의 화면은 위 바 아래(#typingTop) — 모두 떠 있어서 화면을 밀지 않는다 */
 let TYPING_HTML='';
 function typingHtml(){return TYPING_HTML}
 function drawTyping(){const now=Date.now();const on=!A().alarm||A().alarm().typing;const live=on?Object.values(TYPING.who).filter(x=>now-x.at<4000).sort((a,b)=>(a.me?1:0)-(b.me?1:0)):[];{const st=document.getElementById('typing');if(st){st.innerHTML='';st.style.display='none'}}
  const names=[...new Set(live.map(x=>(x.me?x.who+' (나)':x.who)+(x.ooc?' · 잡담':'')))];TYPING_HTML=names.length?`<span class="dots"><i></i><i></i><i></i></span> ${esc(names.join(', '))} 입력 중…`:'';
  const slots=['typingBat','typingRp'].map(id=>document.getElementById(id)).filter(Boolean);
  for(const el of slots){el.innerHTML=TYPING_HTML;el.classList.toggle('on',!!names.length)}
  const top=document.getElementById('typingTop');if(top){const use=!slots.length;top.innerHTML=use?TYPING_HTML:'';top.style.display=use&&names.length?'inline-block':'none'}}
 const SPK={key:'',draft:'',focus:false,folder:''};
 /* ----- 화자 목록: 토큰이 있는 모든 개체 (GM · NPC(관계도) · PC(로스터) · 포켓몬(로스터)). 정리는 rp.spk = {order:[키|'f:폴더id'], folders:{id:{name,keys:[]}}, hidden:{키:1}} ----- */
 function allSpeakers(){const ST=A().ST;const out=[{key:'gm',name:'GM (나레이션)'}];
  const trNames=new Set(Object.values((ST.state.roster||{}).trainers||{}).map(t=>t.name));
  for(const n of Object.values((ST.state.graph||{}).nodes||{})){if(trNames.has(n.name)||n.kind==='org')continue;out.push({key:'npc:'+n.name,name:n.name,kind:'npc'})}
  for(const t of Object.values((ST.state.roster||{}).trainers||{}))out.push({key:'as:'+t.name,name:t.name+' (PC)',kind:'pc'});
  for(const m of Object.values((ST.state.roster||{}).mons||{})){const t=((ST.state.roster||{}).trainers||{})[m.tid];out.push({key:'pm:'+m.id,name:m.name+(t?' · '+t.name:''),kind:'pm'})}
  return out}
 function spkConf(){const c=R().spk||{};return {order:Array.isArray(c.order)?c.order.slice():[],folders:Object.assign({},c.folders||{}),hidden:Object.assign({},c.hidden||{})}}
 async function saveSpk(c){await A().set(['rp','spk'],c)}
 /* 트레이너별 폴더: 트레이너(as:이름) + 그 포켓몬(pm:id) 을 트레이너 이름 폴더에 담는다. 폴더에는 tid 를 남겨 다음 불러오기 때 같은 폴더를 다시 쓴다.
    이미 다른 폴더에 넣어 둔 칩·숨긴 칩은 건드리지 않는다 (손으로 정리한 건 그대로). 돌려줌: 옮긴 칩 수 */
 function folderTrainer(C,t){const ST=A().ST;const mons=Object.values((ST.state.roster||{}).mons||{}).filter(m=>m.tid===t.id);
  const keys=['as:'+t.name,...mons.map(m=>'pm:'+m.id)];
  const fOf=k=>Object.keys(C.folders).find(id=>(C.folders[id].keys||[]).includes(k));
  let id=Object.keys(C.folders).find(x=>C.folders[x].tid===t.id);
  const loose=keys.filter(k=>!fOf(k)&&!C.hidden[k]);if(!loose.length)return 0;
  if(!id){id='f'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);C.folders[id]={name:t.name||'트레이너',keys:[],tid:t.id};
   const at=C.order.indexOf(loose[0]);if(at>=0)C.order.splice(at,0,'f:'+id);else C.order.push('f:'+id)}
  else C.folders[id]=Object.assign({},C.folders[id],{keys:[...(C.folders[id].keys||[])]});
  C.order=C.order.filter(x=>!loose.includes(x));C.folders[id].keys.push(...loose);return loose.length}
 async function autoFolder(tid){if(A().ST.role!=='gm')return;const t=((A().ST.state.roster||{}).trainers||{})[tid];if(!t)return;const C=spkConf();if(folderTrainer(C,t))await saveSpk(C)}
 async function autoFolderAll(){const C=spkConf();let n=0;for(const t of Object.values((A().ST.state.roster||{}).trainers||{}))n+=folderTrainer(C,t);if(n)await saveSpk(C);return n}
 /* 모바일(760px 이하): 화자 칩 줄은 무대 아래에 깔지 않고 무대 버튼 줄 맨 앞(배경 왼쪽) 「🎭 화자」 버튼으로 여는 팝업에 담는다 (css .rpspkbtn · #rpunder.spkpop).
   칩 줄(#rpu_bar)은 그대로 다시 그려지고, 팝업은 #rpunder 의 클래스만 바꾼다. 화자 칩을 누르면 닫는다 */
function bindSpkPop(under){const MQ=matchMedia('(max-width:760px)');const close=()=>under.classList.remove('spkpop');
 $('#rpu_fabbg',under).onclick=close;
 $('#rpu_bar',under).addEventListener('click',e=>{if(!MQ.matches||!under.classList.contains('spkpop'))return;const b=e.target.closest('.spk');if(!b)return;
  if(b.dataset.spk!=null)setTimeout(()=>{close();const l=document.getElementById('rpline');if(l)l.focus({preventScroll:true})},60);else setTimeout(close,60)});
 MQ.addEventListener&&MQ.addEventListener('change',()=>{if(!MQ.matches)close()})}
function spkChip(key,name,av,on,extra){return `<button class="spk ${on?'on':''}" data-spk="${esc(key)}" title="${esc(name)}" draggable="${extra&&extra.drag?'true':'false'}"><i style="${av?`background-image:url('${cssu(av)}')`:''}">${av?'':(key==='gm'?'GM':esc(name.slice(0,2)))}</i><span>${esc(name.replace(/ \((PC|NPC|포켓몬)\)$/,'').replace(/ · .*$/,''))}</span></button>`}
 function spkBarHtml(speakers){const C=spkConf();const byKey={};speakers.forEach(x=>byKey[x.key]=x);const inFolder=new Set();for(const f of Object.values(C.folders))for(const k of f.keys||[])inFolder.add(k);
  const chipOf=k=>{const x=byKey[k];if(!x)return '';const c=k==='gm'?null:charOf(k);const av=k==='gm'?gmImg():c?(standSrc(c)||c.img):'';return spkChip(k,x.name,av,SPK.key===k,{drag:k!=='gm'})};
  const fchip=(id,f)=>`<button class="spk folder ${SPK.folder===id?'on':''}" data-fold="${esc(id)}" title="${esc(f.name)} — ${(f.keys||[]).length}명 · 눌러서 열기 · 칩을 끌어다 놓으면 넣는다" draggable="true"><i>📁</i><span>${esc(f.name)} <small>${(f.keys||[]).filter(k=>byKey[k]).length}</small></span></button>`;
  const seen=new Set(['gm']);let top='';
  for(const it of C.order){if(it.startsWith('f:')){const id=it.slice(2);if(C.folders[id]){top+=fchip(id,C.folders[id]);seen.add(it)}continue}if(byKey[it]&&!inFolder.has(it)&&!C.hidden[it]){top+=chipOf(it);seen.add(it)}}
  for(const id in C.folders)if(!seen.has('f:'+id))top+=fchip(id,C.folders[id]);
  for(const x of speakers)if(!seen.has(x.key)&&!inFolder.has(x.key)&&!C.hidden[x.key])top+=chipOf(x.key);
  let sub='';if(SPK.folder&&C.folders[SPK.folder]){const f=C.folders[SPK.folder];sub=`<div class="spkbar sub" data-fzone="${esc(SPK.folder)}"><span class="fname">📁 ${esc(f.name)}</span>${(f.keys||[]).filter(k=>byKey[k]&&!C.hidden[k]).map(chipOf).join('')||'<span class="dim small">비어 있다 — 위 칩을 끌어다 놓아</span>'}<span class="sp"></span><span class="spkdrop" data-fout title="여기에 끌어다 놓으면 폴더에서 뺀다">⤴ 밖으로</span><button class="btn xs ghost" data-fclose>닫기</button></div>`}
  return `<div class="spkbar top" data-fzone="">${chipOf('gm')}<button class="spk add" data-rp="npcadd" title="인물 추가 (관계도에 NPC 로 들어간다)"><i>＋</i><span>인물</span></button><button class="spk add" data-rp="spkedit" title="고른 인물의 표정·스탠딩"><i>✎</i><span>표정</span></button><button class="spk add" data-rp="spkmgr" title="화자 정리: 숨기기 · 폴더 이름 · 순서"><i>☰</i><span>정리</span></button><span class="spkdrop" data-fnew title="칩을 여기 끌어다 놓으면 새 폴더가 생긴다">＋📁</span>${top}</div>${sub}`}
 /* 끌어서 순서 바꾸기 · 폴더에 넣기 (GM) */
 function bindSpkDrag(el){if(!gm())return;let dragKey='',dragFold='';
  el.querySelectorAll('.spk[draggable="true"]').forEach(ch=>{ch.ondragstart=e=>{dragKey=ch.dataset.spk||'';dragFold=ch.dataset.fold||'';e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',dragKey||('f:'+dragFold))}catch(x){}ch.classList.add('dragging')};ch.ondragend=()=>ch.classList.remove('dragging')});
  const zones=el.querySelectorAll('.spk[data-spk],.spk[data-fold],[data-fnew],[data-fout],.spkbar');
  zones.forEach(z=>{z.ondragover=e=>{if(!dragKey&&!dragFold)return;e.preventDefault();z.classList.add('over')};z.ondragleave=()=>z.classList.remove('over');
   z.ondrop=async e=>{e.preventDefault();e.stopPropagation();z.classList.remove('over');const C=spkConf();const item=dragKey||('f:'+dragFold);if(!dragKey&&!dragFold)return;
    const removeEverywhere=k=>{C.order=C.order.filter(x=>x!==k);for(const f of Object.values(C.folders))f.keys=(f.keys||[]).filter(x=>x!==k)};
    const zoneF=z.closest('[data-fzone]')?z.closest('[data-fzone]').dataset.fzone:'';
    if(z.hasAttribute('data-fnew')){if(!dragKey)return;const id='f'+Date.now().toString(36);const name=prompt('새 폴더 이름','새 폴더');if(name==null)return;removeEverywhere(dragKey);C.folders[id]={name:name.trim()||'폴더',keys:[dragKey]};C.order.push('f:'+id);await saveSpk(C);return}
    if(z.hasAttribute('data-fout')){if(!dragKey)return;removeEverywhere(dragKey);C.order.push(dragKey);await saveSpk(C);return}
    if(z.dataset.fold&&dragKey){const id=z.dataset.fold;removeEverywhere(dragKey);C.folders[id].keys=[...(C.folders[id].keys||[]),dragKey];await saveSpk(C);return}
    if(z.dataset.spk&&z.dataset.spk!==dragKey){const tk=z.dataset.spk;if(tk==='gm')return;const tF=Object.keys(C.folders).find(id=>(C.folders[id].keys||[]).includes(tk))||'';
     if(dragKey){removeEverywhere(dragKey);if(tF){const ks=C.folders[tF].keys;ks.splice(ks.indexOf(tk),0,dragKey)}else{if(!C.order.includes(tk))C.order.push(tk);C.order.splice(C.order.indexOf(tk),0,dragKey)}}
     else{const fi='f:'+dragFold;C.order=C.order.filter(x=>x!==fi);if(!C.order.includes(tk))C.order.push(tk);C.order.splice(C.order.indexOf(tk),0,fi)}
     await saveSpk(C);return}
    if(z.dataset.fold&&dragFold&&z.dataset.fold!==dragFold){const a='f:'+dragFold,b='f:'+z.dataset.fold;C.order=C.order.filter(x=>x!==a);if(!C.order.includes(b))C.order.push(b);C.order.splice(C.order.indexOf(b),0,a);await saveSpk(C);return}
    if(z.classList.contains('spkbar')){if(dragKey){removeEverywhere(dragKey);if(zoneF&&C.folders[zoneF])C.folders[zoneF].keys.push(dragKey);else C.order.push(dragKey)}else{const fi='f:'+dragFold;C.order=C.order.filter(x=>x!==fi);C.order.push(fi)}await saveSpk(C)}}})}
 /* 화자 정리 창: 폴더마다 카드 하나 — 칩을 끌어 다른 카드에 놓거나, 칩을 누른 뒤 옮길 카드를 누른다. 폴더 이름은 그 자리에서 고친다 */
 const SM={q:'',pm:true,sel:'',top:0};
 function openSpkMgr(){const C=spkConf();const sp=allSpeakers().filter(x=>x.key!=='gm');const fOf=k=>Object.keys(C.folders).find(id=>(C.folders[id].keys||[]).includes(k))||'';
  const byKey={};sp.forEach(x=>byKey[x.key]=x);if(SM.sel&&!byKey[SM.sel])SM.sel='';
  const KIND={pc:'PC',pm:'포켓몬',npc:'인물'};
  const tile=x=>{const c=charOf(x.key);const av=c?(standSrc(c)||c.img):'';const h=!!C.hidden[x.key];
   return `<div class="sgt ${h?'hid':''} ${SM.sel===x.key?'sel':''}" draggable="true" data-key="${esc(x.key)}" data-kind="${esc(x.kind||'')}" data-q="${esc((x.name||'').toLowerCase())}" title="${esc(x.name)}"><i style="${av?`background-image:url('${cssu(av)}')`:''}">${av?'':esc([...(x.name||'?')][0]||'?')}</i><span class="sgn">${esc(x.name.replace(/ \(PC\)$/,''))}</span><small>${KIND[x.kind]||''}</small><button class="sgb" data-eye="${esc(x.key)}" title="${h?'숨김 — 눌러서 화자 칸에 보이기':'화자 칸에 보임 — 눌러서 숨기기'}">${h?'🙈':'👁'}</button>${x.kind==='npc'?`<button class="sgb del" data-ndel="${esc(x.key)}" title="이 인물을 없앤다 — 관계도에서도 빠진다">×</button>`:''}</div>`};
  const fids=[...C.order.filter(o=>o.startsWith('f:')).map(o=>o.slice(2)).filter(id=>C.folders[id]),...Object.keys(C.folders).filter(id=>!C.order.includes('f:'+id))];
  const outside=sp.filter(x=>!fOf(x.key));
  const card=(id,title,list)=>`<div class="sgc" data-drop="${id}"><div class="sgh">${id?`<span class="sgi">📁</span><input type="text" class="sgname" data-fren="${id}" value="${esc(title)}" title="고치면 바로 저장"><small>${list.length}</small><button class="btn xs ghost danger" data-fdel="${id}" title="폴더만 없애고 안의 칩은 바깥으로">풀기</button>`:`<span class="sgi">◇</span><b>${title}</b><small>${list.length}</small>`}<span class="sgmv">여기로 옮기기</span></div><div class="sgl">${list.map(tile).join('')||'<div class="sge">비어 있다 — 칩을 끌어 놓아 줘</div>'}</div></div>`;
  const md=A().openModal(`<div class="mhead"><h2>화자 정리</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="sgtool"><input type="search" id="sg_q" placeholder="이름으로 찾기" value="${esc(SM.q)}"><label class="small"><input type="checkbox" id="sg_pm" ${SM.pm?'checked':''}> 포켓몬 보이기</label><span class="sp"></span><button class="btn sm" data-smk="fadd">＋ 폴더</button><button class="btn sm ghost" data-smk="fauto" title="아직 폴더에 없는 트레이너·포켓몬을 트레이너 이름 폴더로 묶는다 (손으로 넣은 건 그대로)">트레이너별로 묶기</button></div>
   <div class="small dim" style="margin:4px 0 8px">칩을 끌어 다른 칸에 놓거나, 칩을 누르고 옮길 칸을 누른다. 👁 은 화자 칸에 보이기/숨기기. 「＋ 인물」로 넣은 인물만 × 로 지운다 — PC·포켓몬은 캐릭터 시트에서.</div>
   <div class="sgboard ${SM.sel?'moving':''}" id="sg_b">${card('','바깥 (폴더 없음)',outside)}${fids.map(id=>card(id,C.folders[id].name,(C.folders[id].keys||[]).map(k=>byKey[k]).filter(Boolean))).join('')}</div>`);
  md.classList.add('wide','sgmodal');const bd=$('#sg_b',md);bd.scrollTop=SM.top||0;
  const re=()=>{SM.top=bd.scrollTop;A().closeModal();openSpkMgr()};
  const filt=()=>{const q=SM.q.trim().toLowerCase();md.querySelectorAll('.sgt').forEach(t=>{t.style.display=(!SM.pm&&t.dataset.kind==='pm')||(q&&!t.dataset.q.includes(q))?'none':''})};filt();
  const qi=$('#sg_q',md);qi.oninput=()=>{SM.q=qi.value;filt()};$('#sg_pm',md).onchange=e=>{SM.pm=e.target.checked;filt()};
  const move=async(key,fid)=>{const C=spkConf();if((fOf(key)||'')===(fid||''))return;C.order=C.order.filter(x=>x!==key);for(const f of Object.values(C.folders))f.keys=(f.keys||[]).filter(x=>x!==key);if(fid&&C.folders[fid])C.folders[fid].keys.push(key);else C.order.push(key);await saveSpk(C)};
  md.querySelectorAll('.sgt').forEach(t=>{t.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/om-spk',t.dataset.key);e.dataTransfer.effectAllowed='move';t.classList.add('dragging')});t.addEventListener('dragend',()=>t.classList.remove('dragging'));
   t.onclick=e=>{if(e.target.closest('button'))return;e.stopPropagation();SM.sel=SM.sel===t.dataset.key?'':t.dataset.key;md.querySelectorAll('.sgt').forEach(x=>x.classList.toggle('sel',x.dataset.key===SM.sel));bd.classList.toggle('moving',!!SM.sel)}});
  md.querySelectorAll('.sgc').forEach(cd=>{let d=0;const isSpk=e=>[...e.dataTransfer.types].includes('text/om-spk');
   cd.addEventListener('dragenter',e=>{if(!isSpk(e))return;e.preventDefault();d++;cd.classList.add('over')});cd.addEventListener('dragover',e=>{if(isSpk(e)){e.preventDefault();e.dataTransfer.dropEffect='move'}});
   cd.addEventListener('dragleave',()=>{if(--d<=0){d=0;cd.classList.remove('over')}});
   cd.addEventListener('drop',async e=>{if(!isSpk(e))return;e.preventDefault();d=0;cd.classList.remove('over');await move(e.dataTransfer.getData('text/om-spk'),cd.dataset.drop);re()});
   cd.onclick=async e=>{if(!SM.sel||e.target.closest('.sgt,button,input'))return;const k=SM.sel;SM.sel='';await move(k,cd.dataset.drop);re()}});
  md.querySelectorAll('[data-eye]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const C=spkConf();const key=b.dataset.eye;if(C.hidden[key])delete C.hidden[key];else C.hidden[key]=1;await saveSpk(C);re()});
  md.querySelectorAll('[data-fren]').forEach(inp=>{inp.onchange=async()=>{const C=spkConf();const f=C.folders[inp.dataset.fren];if(!f||!inp.value.trim())return;f.name=inp.value.trim();await saveSpk(C)};inp.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing)inp.blur()}});
  md.querySelectorAll('[data-fdel]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const C=spkConf();const id=b.dataset.fdel;const f=C.folders[id];if(!f||!confirm(`「${f.name}」 폴더를 풀까? (안의 칩은 바깥으로)`))return;C.order=C.order.filter(x=>x!=='f:'+id);C.order.push(...(f.keys||[]));delete C.folders[id];if(SPK.folder===id)SPK.folder='';await saveSpk(C);re()});
  md.querySelectorAll('[data-ndel]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const key=b.dataset.ndel;const name=key.slice(4);const g=A().ST.state.graph||{};const ids=Object.keys(g.nodes||{}).filter(id=>(g.nodes[id]||{}).name===name&&g.nodes[id].kind!=='org');if(!ids.length)return A().toast('지울 인물을 찾지 못했다');
   const lines=Object.entries(g.edges||{}).filter(([,ed])=>ids.includes(ed.a)||ids.includes(ed.b));
   if(!confirm(`「${name}」 인물을 지울까?${ids.length>1?` (같은 이름 ${ids.length}명 모두)`:''}\n관계도에서도 빠지고${lines.length?` 이어진 선 ${lines.length}개도 지워진다`:''}. 되돌릴 수 없다.`))return;
   for(const [eid] of lines)await A().set(['graph','edges',eid],null);
   for(const id of ids)await A().set(['graph','nodes',id],null);
   const C=spkConf();C.order=C.order.filter(x=>x!==key);for(const f of Object.values(C.folders))f.keys=(f.keys||[]).filter(x=>x!==key);delete C.hidden[key];await saveSpk(C);
   if(SPK.key===key)SPK.key='gm';A().toast(`${name} 를 지웠다`);re()});
  md.querySelectorAll('[data-smk]').forEach(b=>b.onclick=async()=>{const k=b.dataset.smk;const C=spkConf();
   if(k==='fauto'){const n=await autoFolderAll();A().toast(n?`${n}개를 트레이너 폴더로 묶었다`:'묶을 칩이 없다');return re()}
   if(k==='fadd'){const name=prompt('폴더 이름','새 폴더');if(name==null)return;const id='f'+Date.now().toString(36);C.folders[id]={name:name.trim()||'폴더',keys:[]};C.order.push('f:'+id);await saveSpk(C);return re()}})}
 function openGmImg(){const cur=gmImg();
  const md=A().openModal(`<div class="mhead"><h2>GM 그림</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><p class="small muted">화자 칸의 GM 칩과 GM 이 쓴 로그 줄의 아바타로 쓴다.</p>
   <div class="row" style="gap:14px;align-items:stretch;flex-wrap:nowrap"><i class="gmimgpv" style="${cur?`background-image:url('${cssu(cur)}')`:''}"></i><div style="flex:1;display:flex;flex-direction:column;gap:8px;min-width:0">${dzHtml('gi_dz')}
    <input type="text" id="gi_url" value="${esc(cur)}" placeholder="또는 그림 주소 https://…"><div class="row">${cur?'<button class="btn sm ghost danger" id="gi_del">지우기</button>':''}<span class="sp"></span><button class="btn sm pri" id="gi_ok">저장</button></div></div></div>`);
  const pv=u=>{const i=$('.gmimgpv',md);if(i)i.style.backgroundImage=u?`url('${cssu(u)}')`:''};$('#gi_url',md).oninput=e=>pv(e.target.value.trim());
  const save=async u=>{A().closeModal();if(await A().set(['rp','gmImg'],u||null)){A().toast(u?'GM 그림을 바꿨다':'GM 그림을 지웠다');A().renderScene()}};
  bindDz(md,'#gi_dz',async fs=>{const u=await upImg(fs[0],'gm');$('#gi_url',md).value=u;pv(u);await save(u)});
  $('#gi_ok',md).onclick=()=>save($('#gi_url',md).value.trim());const d=$('#gi_del',md);if(d)d.onclick=()=>save('')}
 function speakerChar(){const ST=A().ST;const k=SPK.key;if(ST.role!=='gm'){if(k&&k.startsWith('pm:'))return charOf(k);return charOf(ST.seat)}if(!k)return null;return charOf(k)}
 /* @등록명 → 그 표정으로 바꾼다 (뒤에 대사가 있으면 바꾸고 바로 말한다) */
 async function setStandByLabel(c,label){if(!c)return false;const i=(c.stands||[]).findIndex(s=>(s.label||'')===label);if(i<0){A().toast(`「${label}」 표정이 없다${c.stands.length?': '+c.stands.map(s=>s.label).join(', '):' — 「표정」에서 먼저 넣어 줘'}`);return false}
  if(c.kind==='gm')await A().set(['rp','gmSt','standActive'],i);else if(c.kind==='pc')await A().set(['roster','trainers',c.id,'standActive'],i);else if(c.kind==='pm')await A().set(['roster','mons',c.id,'standActive'],i);else{if(!c.id)return false;await A().set(['graph','nodes',c.id,'standActive'],i)}return true}
 async function sendLine(){const ST=A().ST;const inp=$('#rpline');if(!inp)return;let t=inp.value.trim();if(!t)return;inp.value='';SPK.draft='';SPK.focus=true;typingStop();
  try{if(t.startsWith('/')){const ci=$('#chatIn');if(ci){ci.value=t;$('#chatSend').click()}return}
   let m;if((m=t.match(/^@(\S+)\s*([\s\S]*)$/))){const ok=await setStandByLabel(speakerChar(),m[1]);if(!ok)return;t=m[2].trim();if(!t){A().toast(`표정: ${m[1]}`);return}}
   if(ST.role==='gm'){if(SPK.key==='gm')await DBS().addLog(ST.room,ST.secret,'chat',ST.name,Object.assign({t,nf:1},ST.gmNick?{gmn:ST.gmNick}:{}));else{const c=charOf(SPK.key);const name=c?c.name:SPK.key.replace(/^(npc|as|pm):/,'');await DBS().addLog(ST.room,ST.secret,'chat',name,{t,as:name,k:SPK.key,nf:1})}}
   else if(SPK.key&&SPK.key.startsWith('pm:')){const c=charOf(SPK.key);await DBS().addLog(ST.room,ST.secret,'chat',c?c.name:ST.name,{t,as:c?c.name:'',k:SPK.key,nf:1})}
   else{const c=charOf(ST.seat);const nm=c?c.name:ST.name;await DBS().addLog(ST.room,ST.secret,'chat',nm,c?{t,as:nm,k:ST.seat,nf:1}:{t,nf:1})}}catch(e)   /* 좌석이 자기 캐릭터로 말하면 캐릭터 이름으로 남긴다 (플레이어 닉 X) */{A().toast('보내지 못했다: '+e.message)}}
 function act(k){
  if(k==='map'){mapOpen=!mapOpen;return A().renderScene()}
  if(k==='deck')return window.OM_DECK_UI.open();
  if(k==='phone')return window.OM_PHONE_UI&&window.OM_PHONE_UI.open();
  if(k==='roll')return window.OM_SKILL_UI&&window.OM_SKILL_UI.open();
  if(k==='talk'){const ST=A().ST;if(ST.role==='seat'){SPK.key='me'}else{const t=meTrainer();if(t)SPK.key='as:'+t.name}A().renderScene();const inp=$('#rpline');if(inp)inp.focus();return}
  if(k==='sound'){userMuted=false;unlocked=true;syncBgm(true);A().renderScene();return}
  if(k==='bgmstop'){if(!confirm('BGM 을 모두에게 정지할까?'))return;A().set(['rp','bgm'],null);return}
  if(k==='mute'){userMuted=true;unlocked=false;if(audio){audio.pause();audio=null}lastBgm='';A().renderScene();return}
  if(k==='gm')return openConsole();
  if(k==='centerx')return A().set(['rp','center'],null);
  if(k==='stand')return openMyStand();
  if(k==='qbg'){QB.con=false;return quickBg()}
  if(k==='phase'){const PH=['아침','점심','오후','저녁','밤','심야'];const cur=(A().ST.state.calendar||{}).phase||'';const n=PH[(PH.indexOf(cur)+1)%PH.length];return A().set(['calendar','phase'],n).then(()=>A().sysLog(`시간대: ${n}`))}
  if(k==='npcadd')return addNpcQuick();
  if(k==='spkedit'){const key=SPK.key;if(key==='gm'&&gm())return openStands('gm');if(!key||key==='gm'||key==='me')return A().toast('먼저 인물을 골라 줘');return openStands(key)}
  if(k==='spkmgr')return openSpkMgr();
  if(k==='qbgm')return quickBgm();
  if(k==='log')return openLog()}
 /* 인물 빠른 추가: 관계도에 NPC 노드로 들어간다 (이름 · 초상 · 스탠딩) */
 function addNpcQuick(){const ST=A().ST;
  const md=A().openModal(`<div class="mhead"><h2>인물 추가</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="row" style="margin-bottom:6px"><b style="width:80px">이름</b><input type="text" id="na_n" style="flex:1" placeholder="예: 유현"></div>
   <div class="row" style="margin-bottom:6px"><b style="width:80px">초상</b><input type="text" id="na_i" style="flex:1" placeholder="그림 주소 (채팅 아바타·지도 칩)"><div class="updz mini" id="na_idz"><b>끌어 놓기</b><span>클릭 · Ctrl+V</span><input type="file" accept="image/*" hidden></div></div>
   <div class="row" style="margin-bottom:6px"><b style="width:80px">스탠딩</b><input type="text" id="na_s" style="flex:1" placeholder="전신 그림 주소 (비우면 초상으로 선다)"><div class="updz mini" id="na_sdz"><b>끌어 놓기</b><span>클릭 · Ctrl+V</span><input type="file" accept="image/*" hidden></div></div>
   <div class="small dim">관계도 탭에 NPC 로 들어가고, 여기 화자 줄에 바로 뜬다. 표정을 더 넣으려면 「✎ 표정」.</div>
   <div class="row" style="margin-top:10px"><span class="sp"></span><button class="btn pri" id="na_ok">추가</button></div>`);
  bindDz(md,'#na_idz',async fs=>{$('#na_i',md).value=await upImg(fs[0],'npc');A().toast('올렸다')});bindDz(md,'#na_sdz',async fs=>{$('#na_s',md).value=await upImg(fs[0],'st_npc');A().toast('올렸다')});
  $('#na_ok',md).onclick=async()=>{const n=$('#na_n',md).value.trim();if(!n)return A().toast('이름이 필요해');const nodes=(ST.state.graph||{}).nodes||{};if(Object.values(nodes).some(x=>x.name===n))return A().toast('같은 이름의 인물이 이미 있다');
   const id='n'+Date.now().toString(36);const i=Object.keys(nodes).length;const st=$('#na_s',md).value.trim();
   await A().set(['graph','nodes',id],{id,name:n,kind:'npc',img:$('#na_i',md).value.trim(),x:120+(i%6)*140,y:120+Math.floor(i/6)*140,stands:st?[{label:'기본',src:st,point:0}]:[],standActive:0});
   SPK.key='npc:'+n;A().closeModal();A().renderScene();A().toast(`${n} 추가 — 관계도에도 들어갔다`)}}
 /* ----- 빠른 배경 / BGM 고르기 (무대 위 버튼) ----- */
 const QB={g:''};
 /* 배경 창 하나에서 고르기 + (GM) 목록 고치기: 그룹 추가·이름·순서·삭제, 썸네일 위 ✎ ◀ ▶ ×, 끌어 놓은 그림은 지금 그룹에 들어간다 */
 function quickBg(){const r=R();const groups=JSON.parse(JSON.stringify(bgGroups()));const isGm=gm();
  const recent=(r.recentBg||[]).map(bgOf).filter(x=>x&&x.src);const RC='★최근';
  if(!QB.g||(QB.g===RC&&!recent.length)||(QB.g!==RC&&!groups.find(x=>x.n===QB.g)))QB.g=recent.length?RC:(groups[0]?groups[0].n:'');
  const cur=r.bg||null;const gi=groups.findIndex(x=>x.n===QB.g);const G=gi>=0?groups[gi]:null;
  const nav=[...(recent.length?[{n:RC,c:recent.length,l:'최근'}]:[]),...groups.map(x=>({n:x.n,c:x.i.filter(i=>i.src).length,l:x.n}))];
  const qbOpen=h=>QB.con?gcShell('bg',h):A().openModal(`<div class="mhead"><h2>배경</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>`+h);
  const md=qbOpen(`<div class="qbtop"><div class="qbcur" style="${cur&&cur.src?`background-image:url('${cssu(cur.src)}')`:''}"><span><small>지금</small><b>${esc(cur&&cur.src?(cur.name||'이름 없는 배경'):'배경 없음')}</b></span></div>
    <div class="qbtopr"><input type="search" id="qbq" placeholder="배경 이름으로 찾기 (모든 그룹)" value="${esc(QB.q||'')}"><div class="row" style="justify-content:flex-end">${isGm&&r.bgList?'<button class="btn xs ghost" data-q="reset" title="방에서 고친 목록을 버리고 기본 목록으로">기본 목록으로</button>':''}<button class="btn sm ghost" data-q="bgx" ${cur?'':'disabled'}>배경 없애기</button></div></div></div>
   <div class="qbcols"><nav class="qbnav">${nav.map(x=>`<button class="qbn ${x.n===QB.g&&!QB.q?'on':''}" data-q="g" data-g="${esc(x.n)}"><span>${esc(x.l)}</span><em>${x.c}</em></button>`).join('')}${isGm?'<button class="qbn add" data-q="gadd"><span>＋ 그룹</span></button>':''}</nav>
    <div class="qbmain">${isGm&&G&&!QB.q?`<div class="qbgh"><b>${esc(G.n)}</b><span class="dim small">${G.i.length}장</span><span class="sp"></span><button class="btn xs ghost" data-q="gren">이름</button><button class="btn xs ghost" data-q="gup" title="그룹 위로">↑</button><button class="btn xs ghost" data-q="gdn" title="그룹 아래로">↓</button><button class="btn xs ghost danger" data-q="gdel">그룹 삭제</button></div>`:''}<div class="qbgrid" id="qbgrid"></div></div></div>
   <div class="qbadd"><div class="updz sm" id="qb_dz"><b>새 그림 끌어 놓기</b><span>여러 장 · 클릭 · Ctrl+V</span><input type="file" accept="image/*" multiple hidden></div>
    <div class="qbaddr"><div class="row"><input type="text" id="qbgu" placeholder="또는 그림 주소 https://…" style="flex:1"><input type="text" id="qbgn" placeholder="장소 이름" style="width:130px"><button class="btn sm pri" data-q="url">적용</button></div>
    <div class="small dim">${isGm&&G?`새 그림은 「${esc(G.n)}」 그룹에 들어가고, 한 장이면 바로 배경이 된다. 썸네일에 마우스를 올리면 ✎ 이름 · ◀ ▶ 순서 · × 삭제.`:'한 장이면 바로 배경이 된다.'}</div></div></div>`);
  md.classList.add(...(QB.con?['qbmodal','qbin']:['wide','qbmodal']));
  const saveGs=async()=>{await A().set(['rp','bgList'],groups);quickBg()};
  const items=()=>{const q=(QB.q||'').trim().toLowerCase();if(q){const out=[];for(const g of groups)for(const it of g.i)if(it.src&&(it.l||'').toLowerCase().includes(q))out.push(Object.assign({g:g.n},it));return out}
   if(QB.g===RC)return recent;return G?G.i.filter(i=>i.src):[]};
  const draw=()=>{const xs=items();const q=(QB.q||'').trim();const ed=isGm&&G&&QB.g!==RC&&!q;
   $('#qbgrid',md).innerHTML=xs.map(it=>{const on=cur&&cur.src===it.src;return `<div class="qbt ${on?'on':''}" data-k="${esc(it.k)}" title="${esc(it.l)}" role="button" tabindex="0"><img src="${esc(it.src)}" loading="lazy" alt=""><span class="qbl">${esc(it.l)}${q&&it.g?`<small>${esc(it.g)}</small>`:''}</span>${on?'<em>사용 중</em>':''}${ed?`<span class="qbx"><i data-e="ren" title="이름">✎</i><i data-e="l" title="앞으로">◀</i><i data-e="r" title="뒤로">▶</i><i data-e="del" title="지우기">×</i></span>`:''}</div>`}).join('')||`<div class="empty small">${q?'찾는 배경이 없다':'이 그룹에 그림이 없다 — 아래에 끌어 놓아 줘'}</div>`;
   $('#qbgrid',md).querySelectorAll('.qbt').forEach(b=>{b.onclick=e=>{const x=e.target.closest('[data-e]');if(x){e.stopPropagation();return editIt(b.dataset.k,x.dataset.e)}useBg(b.dataset.k)};b.onkeydown=e=>{if(e.key==='Enter')useBg(b.dataset.k)}})};
  const editIt=async(k,op)=>{if(!G)return;const i=G.i.findIndex(x=>x.k===k);if(i<0)return;const it=G.i[i];
   if(op==='ren'){const l=prompt('배경 이름',it.l);if(l==null||!l.trim())return;it.l=l.trim();return saveGs()}
   if(op==='del'){if(!confirm(`「${it.l}」 배경을 목록에서 지울까?`))return;G.i.splice(i,1);return saveGs()}
   const j=op==='l'?i-1:i+1;if(j<0||j>=G.i.length)return;[G.i[i],G.i[j]]=[G.i[j],G.i[i]];return saveGs()};
  const useBg=async k=>{const it=bgOf(k);if(!it)return;if(!QB.con)A().closeModal();await A().set(['rp','bg'],{src:it.src,name:it.l,at:Date.now()});await A().set(['rp','recentBg'],[k,...(r.recentBg||[]).filter(x=>x!==k)].slice(0,12));if(QB.con)quickBg()};
  const addTo=(src,l)=>{if(!isGm||!G||QB.g===RC)return '';const key=(G.n+'_'+l+'_'+Date.now().toString(36)+Math.random().toString(36).slice(2,4)).replace(/\s+/g,'_');G.i.push({k:key,l:l||'새 배경',src});return key};
  const useUrl=async(u,name)=>{if(!u)return;const key=addTo(u,name);if(key)await A().set(['rp','bgList'],groups);if(!QB.con)A().closeModal();await A().set(['rp','bg'],{src:u,name,at:Date.now()});if(key)await A().set(['rp','recentBg'],[key,...(r.recentBg||[])].slice(0,12));if(QB.con)quickBg()};
  draw();
  const qi=$('#qbq',md);qi.oninput=()=>{QB.q=qi.value;md.querySelectorAll('.qbn[data-g]').forEach(b=>b.classList.toggle('on',!QB.q.trim()&&b.dataset.g===QB.g));draw()};
  bindDz(md,'#qb_dz',async fs=>{const nm0=$('#qbgn',md).value.trim();const lab=f=>nm0&&fs.length===1?nm0:(f.name&&f.name!=='image.png'?stLabel(f.name):'새 배경');
   if(fs.length===1){const u=await upImg(fs[0],'bg');return useUrl(u,lab(fs[0]))}
   if(!isGm||!G||QB.g===RC)return A().toast('여러 장은 그룹을 고른 뒤에 넣어 줘');for(const f of fs){const u=await upImg(f,'bg');addTo(u,lab(f))}A().toast(`배경 ${fs.length}장 추가`);return saveGs()},true);
  md.querySelectorAll('[data-q]').forEach(b=>b.onclick=async()=>{const k=b.dataset.q;
   if(k==='g'){QB.g=b.dataset.g;QB.q='';return quickBg()}
   if(k==='bgx'){if(!QB.con)A().closeModal();await A().set(['rp','bg'],null);if(QB.con)quickBg();return}
   if(k==='url')return useUrl($('#qbgu',md).value.trim(),$('#qbgn',md).value.trim());
   if(k==='reset'){if(!confirm('방에서 고친 배경 목록을 버리고 기본 목록으로 돌릴까?'))return;await A().set(['rp','bgList'],null);return quickBg()}
   if(k==='gadd'){const n=prompt('새 그룹 이름');if(!n||!n.trim())return;if(groups.some(x=>x.n===n.trim()))return A().toast('같은 이름의 그룹이 있다');groups.push({n:n.trim(),i:[]});QB.g=n.trim();QB.q='';return saveGs()}
   if(!G)return;
   if(k==='gren'){const n=prompt('그룹 이름',G.n);if(!n||!n.trim()||n.trim()===G.n)return;if(groups.some(x=>x.n===n.trim()))return A().toast('같은 이름의 그룹이 있다');G.n=n.trim();QB.g=G.n;return saveGs()}
   if(k==='gdel'){if(!confirm(`「${G.n}」 그룹(${G.i.length}장)을 지울까?`))return;groups.splice(gi,1);QB.g='';return saveGs()}
   if(k==='gup'&&gi>0){[groups[gi-1],groups[gi]]=[groups[gi],groups[gi-1]];return saveGs()}
   if(k==='gdn'&&gi<groups.length-1){[groups[gi+1],groups[gi]]=[groups[gi],groups[gi+1]];return saveGs()}})}
 function quickBgm(){const md=A().openModal(`<div class="mhead"><h2>BGM</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div id="bgmpanel">${bgmPanelHtml()}</div>`);md.classList.add('wide');const re=()=>{const el=$('#bgmpanel');if(!el)return;el.innerHTML=bgmPanelHtml();bindBgmPanel(md,re)};bindBgmPanel(md,re)}
 /* ----- 대화 기록 ----- */
 let logOoc=false;
 function openLog(){const ST=A().ST;const isO=x=>x.data.ch==='ooc';const rows=(ST.log||[]).filter(x=>x.kind==='chat'&&x.data&&!x.data.bat&&!x.data.sms&&(x.data.t||x.data.img)&&(logOoc||!isO(x)));
  const name=x=>x.data.as||(charOf(speakerKey(x))||{}).name||x.who;const tm=x=>{const d=new Date(x.at);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
  const md=A().openModal(`<div class="mhead"><h2>대화 기록</h2><span class="small dim">${rows.length}줄</span><span class="sp"></span><label class="small" title="잡담 탭에서 한 말도 같이 보이고, 복사·파일에도 들어간다"><input type="checkbox" id="lgooc" ${logOoc?'checked':''}> 잡담 포함</label><button class="btn sm ghost" id="lgcopy">글로 복사</button><button class="btn sm ghost" id="lgdl">파일로</button><button class="btn ghost" data-x>닫기</button></div>
   <div class="rplog">${rows.map(x=>{const f=isO(x)?{narr:false,text:String(x.data.t||'')}:(window.OM_LINE?window.OM_LINE(x.data):{narr:false,text:String(x.data.t||'')});return `<div class="rl ${f.narr?'narr':''}"><span class="rt">${tm(x)}</span><b class="rn">${esc(name(x))}${isO(x)?' <small class="dim">· 잡담</small>':''}</b><span class="rx">${x.data.img?`<a href="${esc(x.data.img)}" target="_blank" rel="noopener">[그림]</a> `:''}${esc(f.text)}</span></div>`}).join('')||'<div class="empty">아직 대화가 없다</div>'}</div>`);
  md.classList.add('wide');$('#lgooc',md).onchange=e=>{logOoc=e.target.checked;A().closeModal();openLog()};const text=rows.map(x=>`[${tm(x)}] ${isO(x)?'[잡담] ':''}${name(x)}: ${x.data.t||x.data.img||''}`).join('\n');
  $('#lgcopy',md).onclick=()=>navigator.clipboard.writeText(text).then(()=>A().toast('복사했다'),()=>prompt('복사해서 쓰기',text));
  $('#lgdl',md).onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'}));a.download=`대화기록_${ST.room}_${new Date().toISOString().slice(0,10)}.txt`;a.click()};
  const lg=md.querySelector('.rplog');lg.scrollTop=lg.scrollHeight}

 /* ----- 지도 ----- */
 function mapOverlay(){const M=mapS();const isGm=gm();if(!M.img)return `<div class="mapov"><div class="mapempty"><b>지도가 없다</b><div class="small dim">${isGm?'「지도 관리」에서 그림을 올리고 핀을 꽂아 줘':'GM 이 아직 지도를 올리지 않았다'}</div>${isGm?'<button class="btn sm pri" data-mapmgr data-t="img">지도 관리</button>':''}</div></div>`;
  const W=M.img.w||1000,H=M.img.h||700;const px=(x,y)=>`left:${x/W*100}%;top:${y/H*100}%`;const hid=n=>M.vis[n]==1;
  const locHtml=M.locs.map(l=>{const h=hid(l.n);if(h&&!isGm)return `<div class="cover" style="${px(l.x,l.y)}" title="?"><span>?</span></div>`;
   return `<div class="loc ${h?'hid':''} ${M.party.n===l.n&&(M.party.vis||isGm)?'party':''}" data-loc="${l.n}" style="${px(l.x,l.y)}" title="${esc(l.name)}"><span class="ln">${l.n}</span><span class="lt">${esc(l.name)}${h?' (가림)':''}</span></div>`}).join('');
  const pin=(()=>{const l=M.locs.find(x=>x.n===M.party.n);if(!l||(!M.party.vis&&!isGm))return '';return `<div class="ppin ${M.party.vis?'':'hid'}" style="${px(l.x,l.y)}" title="파티"><span>PC</span></div>`})();
  const routes=`<svg class="routes" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${M.routes.filter(rt=>rt.vis||isGm).map(rt=>{const pts=rt.seq.map(n=>M.locs.find(x=>x.n===n)).filter(Boolean);if(pts.length<2)return '';const d=pts.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ');const c=RCOL[rt.color]||rt.color||'#d63f4f';return `<path d="${d}" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${rt.vis?.85:.35}" stroke-dasharray="${rt.vis?'':'18 14'}"/>${pts.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="11" fill="${c}" stroke="#fff" stroke-width="3"/>`).join('')}<text x="${(pts[0].x+pts[1].x)/2+14}" y="${(pts[0].y+pts[1].y)/2-10}" font-size="28" fill="${c}" stroke="#000" stroke-width="4" paint-order="stroke" font-weight="bold">${esc(rt.name||rt.seq.join('→'))}</text>`}).join('')}</svg>`;
  const npcs=M.npcs.filter(n=>n.vis||isGm).map(n=>{const l=M.locs.find(x=>x.n===n.n);if(!l)return '';const sz={s:34,m:48,l:64}[n.size||'s'];const idx=M.npcs.filter(x=>x.n===n.n).indexOf(n);return `<div class="mnpc ${n.vis?'':'hid'}" style="${px(l.x+30+idx*(sz*0.8),l.y-10)};width:${sz}px;height:${sz}px;${n.img?`background-image:url('${cssu(n.img)}')`:''}" title="${esc(n.name)}${n.vis?'':' (숨김)'}"><i>${esc(n.name)}</i></div>`}).join('');
  const shown=M.locs.filter(l=>!hid(l.n)).length;
  return `<div class="mapov"><div class="mapwrap ${isGm&&MM.pin?'pinmode':''}" data-mapw><img src="${esc(M.img.src)}" alt="" draggable="false">${routes}${locHtml}${npcs}${pin}</div>
   <div class="maplist">${isGm?`<button class="btn xs ${MM.pin?'pri':''}" data-pinmode title="켜면 지도를 눌러 그 자리에 핀을 꽂는다">${MM.pin?'핀 찍기 중 — 지도를 눌러':'📍 핀 찍기'}</button>`:''}<span class="chip">${shown}/${M.locs.length} 공개</span>${M.party.n?`<span class="chip on">파티: ${M.party.n}. ${esc((M.locs.find(x=>x.n===M.party.n)||{}).name||'')}${M.party.vis?'':' (핀 숨김)'}</span>`:''}${M.routes.filter(r=>r.vis).map(r=>`<span class="chip" style="border-color:${RCOL[r.color]||'#888'}">${esc(r.name||r.seq.join('→'))}</span>`).join('')}${isGm?'<span class="sp"></span><button class="btn sm pri" data-mapmgr>지도 관리</button><span class="dim small">핀 클릭 = 메뉴 · 끌면 이동</span>':''}</div></div>`}
 function bindMap(el){const isGm=gm();const wrap=el.querySelector('[data-mapw]');const M=mapS();const W=(M.img||{}).w||1000,H=(M.img||{}).h||700;
  const toXY=e=>{const r=wrap.getBoundingClientRect();return {x:Math.round(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*W),y:Math.round(Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))*H)}};
  el.querySelectorAll('[data-loc]').forEach(b=>{const n=+b.dataset.loc;
   if(!isGm){b.onclick=()=>{const l=mapS().locs.find(x=>x.n===n);if(l)A().toast(`${l.n}. ${l.name}`)};return}
   /* GM: 누르면 메뉴, 끌면 이동 (맵툴 토큰 끌기) */
   let st=null,moved=false;b.onpointerdown=e=>{if(e.button!==0)return;st={x:e.clientX,y:e.clientY};moved=false;b.setPointerCapture(e.pointerId);e.preventDefault()};
   b.onpointermove=e=>{if(!st)return;if(!moved&&Math.hypot(e.clientX-st.x,e.clientY-st.y)<5)return;moved=true;const p=toXY(e);b.style.left=(p.x/W*100)+'%';b.style.top=(p.y/H*100)+'%';b.classList.add('drag')};
   b.onpointerup=async e=>{if(!st)return;const was=moved;st=null;b.classList.remove('drag');if(!was){locMenu(n);return}const p=toXY(e);const cur=mapS();await saveMap({locs:cur.locs.map(x=>x.n===n?Object.assign({},x,{x:p.x,y:p.y}):x)})};
   b.onpointercancel=()=>{st=null;b.classList.remove('drag');A().renderScene()}});
  if(wrap&&isGm&&MM.pin){wrap.onclick=async e=>{if(e.target.closest('[data-loc],.mnpc,.ppin'))return;const p=toXY(e);const nm=prompt('새 장소 이름');if(nm==null||!nm.trim())return;const cur=mapS();const n=Math.max(0,...cur.locs.map(x=>x.n))+1;await saveMap({locs:[...cur.locs,{n,name:nm.trim(),x:p.x,y:p.y}]});if(cur.ann)A().sysLog(`지도: ${n}. ${nm.trim()} 추가`)}}
  const pm=el.querySelector('[data-pinmode]');if(pm)pm.onclick=()=>{MM.pin=!MM.pin;A().renderScene()};
  el.querySelectorAll('[data-mapmgr]').forEach(mg=>mg.onclick=()=>openMapMgr(mg.dataset.t||'loc'))}
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
 const MM={tab:'loc',seq:[],col:'red',rname:'',pin:false,mode:'sel',hl:0};
 function openMapMgr(tab){if(tab)MM.tab=tab;const M=mapS();const ST=A().ST;const locName=n=>(M.locs.find(x=>x.n===n)||{}).name||'';
  /* 장소 · 루트: 왼쪽 미니 지도에서 바로 — 「선택」은 핀을 끌어 옮기고 누르면 목록에서 찾아 준다, 「＋ 장소 찍기」는 누른 자리에 새 장소, 「루트 그리기」는 핀을 차례로 누른다 */
  const W0=(M.img||{}).w||1000,H0=(M.img||{}).h||700;const pc=(x,y)=>`left:${x/W0*100}%;top:${y/H0*100}%`;
  const seqPath=MM.seq.map(n=>M.locs.find(x=>x.n===n)).filter(Boolean);
  const mini=M.img?`<div class="mmtools"><button class="btn xs ${MM.mode==='sel'?'pri':'ghost'}" data-mm="mode" data-v="sel">✥ 선택 · 옮기기</button><button class="btn xs ${MM.mode==='add'?'pri':'ghost'}" data-mm="mode" data-v="add">＋ 장소 찍기</button><button class="btn xs ${MM.mode==='route'?'pri':'ghost'}" data-mm="mode" data-v="route">〰 루트 그리기</button>${MM.mode==='add'?`<input type="text" id="mm_new" placeholder="새 장소 이름 (비우면 「장소 N」)" style="flex:1;min-width:120px">`:''}</div>
    <div class="mmmap m-${MM.mode}" id="mm_map" style="aspect-ratio:${W0}/${H0};background-image:url('${cssu(M.img.src)}')">
     <svg class="routes" viewBox="0 0 ${W0} ${H0}" preserveAspectRatio="none">${M.routes.map(rt=>{const pts=rt.seq.map(n=>M.locs.find(x=>x.n===n)).filter(Boolean);if(pts.length<2)return '';return `<path d="${pts.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ')}" stroke="${RCOL[rt.color]||'#d63f4f'}" stroke-width="${W0/180}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${rt.vis?.85:.3}"/>`}).join('')}${seqPath.length>1?`<path d="${seqPath.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ')}" stroke="${RCOL[MM.col]||'#d63f4f'}" stroke-width="${W0/150}" stroke-dasharray="${W0/60} ${W0/90}" fill="none" stroke-linecap="round"/>`:''}</svg>
     ${M.locs.map(l=>{const h=M.vis[l.n]==1;const si=MM.seq.indexOf(l.n);return `<div class="mmp ${h?'hid':''} ${MM.hl===l.n?'hl':''} ${si>=0?'inseq':''}" data-pin="${l.n}" style="${pc(l.x,l.y)}" title="${esc(l.name)}${h?' (가림)':''}"><b>${l.n}</b><span>${esc(l.name)}</span>${M.party.n===l.n?'<em>PC</em>':''}</div>`}).join('')}
    </div><div class="small dim" style="margin-top:4px">${MM.mode==='add'?'지도를 누르면 그 자리에 장소가 생긴다 (이름은 위 칸, 여러 번 연달아 찍을 수 있다)':MM.mode==='route'?'지나갈 순서대로 핀을 누른다 → 오른쪽에서 이름·색을 고르고 「루트 그리기」':'핀을 끌면 자리가 옮겨지고, 누르면 오른쪽 목록에서 그 장소를 찾아 준다. 흐린 핀은 가린 장소'}</div>`
   :`<div class="mapprev big"><span class="dim">지도 그림이 없다 — 「지도 그림」 탭에서 먼저 올려 줘</span></div>`;
  const locTab=`<div class="mmcols mmloc"><div>${mini}</div>
   <div><div class="sec">장소 <span class="note">${M.locs.filter(l=>M.vis[l.n]!=1).length}/${M.locs.length} 공개</span><span class="sp"></span><button class="btn xs" data-mm="all" data-v="0">모두 공개</button><button class="btn xs ghost" data-mm="all" data-v="1">모두 가리기</button><button class="btn xs ${M.ann?'pri':'ghost'}" data-mm="ann" title="공개·가림·루트를 채팅에 알린다">알림 ${M.ann?'켬':'끔'}</button></div>
    <div class="mmlist mmlocs">${M.locs.map(l=>{const h=M.vis[l.n]==1;return `<div class="mml ${h?'hid':''} ${MM.hl===l.n?'hl':''}" data-row="${l.n}"><span class="no">${l.n}</span><input type="text" class="mmname" data-mmren="${l.n}" value="${esc(l.name)}" title="고치면 바로 저장">${M.party.n===l.n?'<span class="tag me">파티</span>':''}<button class="btn xs ${h?'pri':'ghost'}" data-mm="t" data-n="${l.n}" title="${h?'지금 가림 — 눌러서 공개':'지금 공개 — 눌러서 가리기'}">${h?'🙈 가림':'👁 공개'}</button><button class="btn xs ghost danger" data-mm="del" data-n="${l.n}">×</button></div>`}).join('')||'<div class="empty small">장소가 없다 — 왼쪽에서 「＋ 장소 찍기」</div>'}</div>
    <div class="sec" style="margin-top:12px">루트 <span class="sp"></span>${M.routes.length?'<button class="btn xs ghost danger" data-mm="wipe">모두 지우기</button>':''}</div>
    <div class="seq">${MM.seq.length?MM.seq.map((n,i)=>`${i?' → ':''}<b>${n}</b> ${esc(locName(n))}`).join(''):`<span class="dim small">${MM.mode==='route'?'지도에서 핀을 차례로 눌러 줘':'「〰 루트 그리기」를 켜고 핀을 차례로 누른다'}</span>`}</div>
    <div class="row"><button class="btn xs ghost" data-mm="undo" ${MM.seq.length?'':'disabled'}>하나 빼기</button><button class="btn xs ghost" data-mm="clr" ${MM.seq.length?'':'disabled'}>비우기</button><span class="sp"></span>${Object.entries(RCOL).map(([k,c])=>`<span class="sw ${MM.col===k?'on':''}" data-mm="col" data-c="${k}" style="background:${c}"></span>`).join('')}</div>
    <div class="row"><input type="text" id="mm_rname" placeholder="루트 이름 (비우면 번호 순서)" value="${esc(MM.rname)}" style="flex:1"><button class="btn sm pri" data-mm="draw" ${MM.seq.length<2?'disabled':''}>루트 그리기</button></div>
    ${M.routes.map((r,i)=>`<div class="mml ${r.vis?'':'hid'}"><i class="sw" style="background:${RCOL[r.color]||'#888'}"></i><span class="nm">${esc(r.name||'')}<small class="dim"> ${r.seq.map(n=>n+'.'+locName(n)).join(' → ')}</small></span><button class="btn xs ghost" data-mm="rvis" data-i="${i}">${r.vis?'숨기기':'보이기'}</button><button class="btn xs ghost danger" data-mm="rdel" data-i="${i}">×</button></div>`).join('')}</div></div>`;
  const pics=[...Object.values((ST.state.graph||{}).nodes||{}).map(n=>({name:n.name,img:A().portraitOf(n.name,n.img)})),...Object.values((ST.state.roster||{}).trainers||{}).map(t=>({name:t.name,img:t.image||''})),...Object.values((ST.state.roster||{}).mons||{}).map(m=>({name:m.name,img:m.image||''}))].filter((p,i,a)=>a.findIndex(q=>q.name===p.name)===i);
  const pcTab=`<div class="mmcols"><div><div class="sec">파티 현재 위치</div>
    <div class="partycard"><div class="ppin static"><span>PC</span></div><div style="flex:1"><small class="dim">지금 있는 곳</small><br><b>${M.party.n?M.party.n+'. '+esc(locName(M.party.n)):'—'}</b> ${M.party.vis?'<span class="chip on">플레이어에게 보임</span>':'<span class="chip">핀 숨김 (GM만)</span>'}</div><button class="btn sm ${M.party.vis?'':'pri'}" data-mm="pvis">${M.party.vis?'핀 숨기기':'핀 보이기'}</button></div>
    <label class="small"><input type="checkbox" data-mm="reveal" ${M.reveal?'checked':''}> 가려진 장소로 이동하면 그 장소도 함께 공개</label>
    <div class="small dim" style="margin:6px 0">장소를 누르면 핀이 그곳으로 옮겨진다${M.ann?' (채팅에 알림)':''}</div>
    <div class="lgrid">${M.locs.map(l=>`<button class="lb ${M.party.n===l.n?'cur':''} ${M.vis[l.n]==1?'hid':''}" data-mm="pmove" data-n="${l.n}"><span class="no">${l.n}</span>${esc(l.name)}</button>`).join('')}</div></div>
   <div><div class="sec">주요 인물 배치</div>
    <div class="row"><select id="mm_np" style="flex:1"><option value="">인물 고르기 (관계도·로스터)</option>${pics.map(p=>`<option value="${esc(p.name)}" data-img="${esc(p.img)}">${esc(p.name)}</option>`).join('')}</select><input type="text" id="mm_npn" placeholder="또는 이름 직접" style="width:120px"></div>
    <div class="row"><select id="mm_nploc">${M.locs.map(l=>`<option value="${l.n}">${l.n}. ${esc(l.name)}${M.vis[l.n]==1?' (가림)':''}</option>`).join('')}</select><select id="mm_npsz"><option value="s">작게</option><option value="m">보통</option><option value="l">크게</option></select><label class="small"><input type="checkbox" id="mm_npvis" checked> 바로 공개</label><span class="sp"></span><button class="btn sm pri" data-mm="nadd">지도에 배치</button></div>
    <div class="sec" style="margin-top:10px">배치된 인물 <span class="dim small">${M.npcs.length}명</span><span class="sp"></span>${M.npcs.length?'<button class="btn xs ghost danger" data-mm="nclr">모두 빼기</button>':''}</div>
    ${M.npcs.length?M.npcs.map((n,i)=>`<div class="mml ${n.vis?'':'hid'}"><i class="tpic sm" style="${n.img?`background-image:url('${cssu(n.img)}')`:''}"></i><span class="nm">${esc(n.name)}<small class="dim"> ${n.vis?'공개':'숨김'}</small></span><select data-mm="nmove" data-i="${i}">${M.locs.map(l=>`<option value="${l.n}" ${l.n===n.n?'selected':''}>${l.n}. ${esc(l.name)}</option>`).join('')}</select><button class="btn xs ${n.vis?'':'pri'}" data-mm="nvis" data-i="${i}">${n.vis?'숨기기':'공개'}</button><button class="btn xs ghost danger" data-mm="ndel" data-i="${i}">빼기</button></div>`).join(''):'<div class="empty small">배치된 인물이 없다</div>'}</div></div>`;
  const mi=(R().map||{}).img;const isMujin=mapIsMujin();
  const hist=((R().mapHist)||[]).filter(h=>h&&h.src&&!(M.img&&M.img.src===h.src));
  const imgTab=`<div class="mmcols mmimg"><div><div class="sec">지금 지도 <span class="dim small">${M.img?`${isMujin?'무진 기본 지도':'올린 지도'} · ${M.img.w}×${M.img.h} · 장소 ${M.locs.length}곳`:''}</span></div>
    <div class="mapprev big" style="${M.img?`background-image:url('${cssu(M.img.src)}')`:''}">${M.img?'':'<span class="dim">지도가 없다 — 오른쪽에 그림을 끌어 놓아 줘</span>'}</div>
    <div class="small dim" style="margin-top:8px">핀은 무대 지도에서 「📍 핀 찍기」를 켜고 그림을 누르면 꽂히고, 핀을 끌면 옮겨진다. 지도를 바꾸면 핀 좌표는 새 그림 크기에 맞춰 비율로 남는다.</div></div>
   <div><div class="sec">지도 바꾸기</div>
    <div class="updz" id="mm_dz" style="min-height:110px"><b>지도 그림을 끌어 놓기</b><span>클릭해서 고르기 · Ctrl+V 붙여넣기 · 올리면 바로 적용</span><input type="file" accept="image/*" hidden></div>
    <div class="row" style="margin-top:8px"><input type="text" id="mm_url" placeholder="또는 그림 주소 (https://…)" style="flex:1"><button class="btn sm" data-mm="url">적용</button></div>
    ${hist.length?`<div class="sec" style="margin-top:12px">전에 쓴 지도 <span class="dim small">눌러서 되돌리기</span></div><div class="mmhist">${hist.map((h,i)=>`<button class="mmh" data-mm="hist" data-i="${i}" title="${h.w}×${h.h}"><i style="background-image:url('${cssu(h.src)}')"></i><small>${h.w}×${h.h}</small></button>`).join('')}</div>`:''}
    <div class="sec" style="margin-top:14px">정리</div><div class="row" style="flex-wrap:wrap;gap:6px"><button class="btn sm ghost danger" data-mm="noimg">지도 비우기</button><button class="btn sm ghost danger" data-mm="wipeall">핀·루트·인물 모두 지우기</button></div></div></div>`;
  const md=A().openModal(`<div class="mhead"><h2>지도 관리</h2><span class="tabs2" style="margin:0 0 0 14px;flex:0 1 520px"><button class="tab2 ${MM.tab==='img'?'on':''}" data-mm="tab" data-t="img">지도 그림 <small>${M.img?(isMujin?'무진':'올린 그림'):'없음'}</small></button><button class="tab2 ${MM.tab==='loc'?'on':''}" data-mm="tab" data-t="loc">장소 · 루트 <small>${M.locs.filter(l=>M.vis[l.n]!=1).length}/${M.locs.length} 공개</small></button><button class="tab2 ${MM.tab==='pc'?'on':''}" data-mm="tab" data-t="pc">파티 위치 · 인물 <small>${M.party.n?M.party.n+'. '+esc(locName(M.party.n)):''}</small></button></span><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>${MM.tab==='pc'?pcTab:MM.tab==='img'?imgTab:locTab}`);
  const applyImg=async src=>{A().toast('그림 크기를 재는 중…');const im=new Image();im.onload=async()=>{const nw=im.naturalWidth||1000,nh=im.naturalHeight||700;const ow=(M.img||{}).w,oh=(M.img||{}).h;let locs=M.locs;if(ow&&oh&&(ow!==nw||oh!==nh))locs=locs.map(l=>Object.assign({},l,{x:Math.round(l.x/ow*nw),y:Math.round(l.y/oh*nh)}));await saveMap({img:{src,w:nw,h:nh},preset:'',locs});const H=[...(M.img&&M.img.src&&M.img.src!==src?[M.img]:[]),...((R().mapHist)||[])].filter((h,i,arr)=>h&&h.src&&h.src!==src&&arr.findIndex(x=>x.src===h.src)===i).slice(0,8);await A().set(['rp','mapHist'],H);A().toast('지도를 바꿨다');openMapMgr('img')};im.onerror=()=>A().toast('그림을 불러오지 못했다');im.src=src};
  if($('#mm_dz',md))bindDz(md,'#mm_dz',async fs=>{await applyImg(await upImg(fs[0],'map'))});
  md.classList.add('wide');
  const re=()=>openMapMgr();
  if(MM.tab==='loc'){const mp=$('#mm_map',md);
   md.querySelectorAll('[data-mmren]').forEach(inp=>inp.onchange=async()=>{const n=+inp.dataset.mmren;const v=inp.value.trim();if(!v)return;const M2=mapS();await saveMap({locs:M2.locs.map(x=>x.n===n?Object.assign({},x,{name:v}):x)})});
   const hl=n=>{MM.hl=n;md.querySelectorAll('[data-row]').forEach(r=>r.classList.toggle('hl',+r.dataset.row===n));md.querySelectorAll('[data-pin]').forEach(p=>p.classList.toggle('hl',+p.dataset.pin===n));const r=md.querySelector(`[data-row="${n}"]`);if(r)r.scrollIntoView({block:'nearest'})};
   md.querySelectorAll('[data-row]').forEach(r=>r.onclick=e=>{if(e.target.closest('button,input'))return;hl(+r.dataset.row)});
   if(mp){const at=e=>{const rc=mp.getBoundingClientRect();return {x:Math.round(Math.max(0,Math.min(1,(e.clientX-rc.left)/rc.width))*W0),y:Math.round(Math.max(0,Math.min(1,(e.clientY-rc.top)/rc.height))*H0)}};
    mp.addEventListener('click',async e=>{if(MM.mode!=='add'||e.target.closest('[data-pin]'))return;const p=at(e);const M2=mapS();const n=Math.max(0,...M2.locs.map(x=>x.n))+1;const ni=$('#mm_new',md);const name=(ni&&ni.value.trim())||'장소 '+n;
     await saveMap({locs:[...M2.locs,{n,name,x:p.x,y:p.y}]});MM.hl=n;A().toast(`${n}. ${name} 추가`);re()});
    mp.querySelectorAll('[data-pin]').forEach(pin=>{const n=+pin.dataset.pin;
     pin.addEventListener('pointerdown',e=>{if(MM.mode==='route'){e.preventDefault();if(MM.seq[MM.seq.length-1]!==n)MM.seq.push(n);const rn=$('#mm_rname',md);if(rn)MM.rname=rn.value;return re()}
      if(MM.mode!=='sel')return;e.preventDefault();pin.setPointerCapture(e.pointerId);const sx=e.clientX,sy=e.clientY;let moved=false;
      const mv=ev=>{if(!moved&&Math.hypot(ev.clientX-sx,ev.clientY-sy)<4)return;moved=true;const p=at(ev);pin.style.left=p.x/W0*100+'%';pin.style.top=p.y/H0*100+'%';pin.classList.add('drag')};
      const up=async ev=>{pin.removeEventListener('pointermove',mv);pin.removeEventListener('pointerup',up);pin.classList.remove('drag');if(!moved)return hl(n);const p=at(ev);const M2=mapS();await saveMap({locs:M2.locs.map(x=>x.n===n?Object.assign({},x,{x:p.x,y:p.y}):x)});re()};
      pin.addEventListener('pointermove',mv);pin.addEventListener('pointerup',up)})})}}
  md.querySelectorAll('[data-mm]').forEach(b=>{const h=async()=>{const k=b.dataset.mm;const re=()=>openMapMgr();
   if(k==='tab'){MM.tab=b.dataset.t;return re()}
   if(k==='mode'){MM.mode=b.dataset.v;const rn=$('#mm_rname',md);if(rn)MM.rname=rn.value;return re()}
   if(k==='url'){const u=$('#mm_url',md).value.trim();if(!u)return;return applyImg(u)}
   if(k==='hist'){const h=hist[+b.dataset.i];if(h)return applyImg(h.src);return}
   if(k==='mujin'){if(!confirm('무진 기본 지도를 쓸까? (핀이 없으면 기본 장소 목록이 들어간다)'))return;await saveMap({img:null,preset:'mujin',locs:M.locs.length&&!isMujin?M.locs:[]});return re()}
   if(k==='noimg'){if(!confirm('지도를 비울까? (핀·루트·인물은 남는다)'))return;await saveMap({img:null,preset:'none'});return re()}
   if(k==='wipeall'){if(!confirm('핀·루트·인물을 모두 지울까?'))return;await saveMap({locs:[],vis:{},routes:[],npcs:[],party:{n:0,vis:1},preset:(R().map||{}).preset||((R().map||{}).img?'':'none')});return re()}
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

 /* ----- GM 콘솔 (맵툴 Lib:GM 콘솔 = 배경 · 음악 · 공지 · 지도 · 무대 · 연출) -----
    왼쪽 탭 + 위 「지금」 띠(배경 · BGM · 자막 · 중앙 그림 · 파티 위치, 눌러 그 탭으로 · × 로 바로 끄기). 배경 탭은 배경 창(quickBg)을 그대로 안에 띄운다.
    설정 칸은 고치면 바로 저장(저장 버튼 없음). 창을 닫지 않고 계속 쓴다 */
 const GC={tab:'bg',nEdit:false,seQ:''};
 const GC_TABS=[['bg','🖼','배경'],['bgm','♪','음악'],['notice','📢','공지'],['map','🗺','지도'],['stage','🎭','무대'],['etc','✨','연출'],['se','🔊','효과음'],['misc','✉','귓속말 · 명령']];
 function gcShell(tab,inner){const r=R();const M=mapS();const loc=M.locs.find(x=>x.n===M.party.n);const cap=r.caption||{};
  const now=[`<button class="gcn ${r.bg&&r.bg.src?'':'off'}" data-gnow="bg"><i class="th" style="${r.bg&&r.bg.src?`background-image:url('${cssu(r.bg.src)}')`:''}"></i><span><small>배경</small><b>${esc(r.bg&&r.bg.src?(r.bg.name||'이름 없음'):'없음')}</b></span>${r.bg&&r.bg.src?'<u data-gx="bgx" title="배경 지우기">×</u>':''}</button>`,
   `<button class="gcn ${r.bgm&&r.bgm.src?'':'off'}" data-gnow="bgm"><i class="ic">♪</i><span><small>BGM</small><b>${esc(r.bgm&&r.bgm.src?(r.bgm.title||'곡'):'없음')}</b></span>${r.bgm&&r.bgm.src?'<u data-gx="bgmx" title="모두에게 정지">■</u>':''}</button>`,
   cap.fixed&&cap.text?`<button class="gcn" data-gnow="stage"><i class="ic">💬</i><span><small>고정 자막</small><b>${esc(cap.text)}</b></span><u data-gx="capx" title="자막 풀기">×</u></button>`:'',
   r.center&&r.center.src?`<button class="gcn" data-gnow="etc"><i class="th" style="background-image:url('${cssu(r.center.src)}')"></i><span><small>중앙 그림</small><b>띄우는 중</b></span><u data-gx="centerx" title="내리기">×</u></button>`:'',
   M.img&&M.locs.length?`<button class="gcn ${loc?'':'off'}" data-gnow="map"><i class="ic">📍</i><span><small>파티</small><b>${loc?loc.n+'. '+esc(loc.name):'—'}</b></span></button>`:''].join('');
  const md=A().openModal(`<div class="gcx"><div class="gchead"><h2>GM 콘솔</h2><div class="gcnow">${now}</div><button class="btn ghost" data-x>닫기</button></div>
   <div class="gccols"><nav class="gcnav">${GC_TABS.map(([k,ic,n])=>`<button class="gct ${tab===k?'on':''}" data-gcn="${k}"><i>${ic}</i><span>${n}</span></button>`).join('')}</nav><div class="gcmain" id="gcmain">${inner}</div></div></div>`);
  md.classList.add('gcmodal');
  md.querySelectorAll('[data-gcn]').forEach(b=>b.onclick=()=>openConsole(b.dataset.gcn));
  md.querySelectorAll('[data-gnow]').forEach(b=>b.onclick=async e=>{const x=e.target.closest('[data-gx]');if(!x)return openConsole(b.dataset.gnow);e.stopPropagation();const k=x.dataset.gx;
   if(k==='bgx')await A().set(['rp','bg'],null);else if(k==='bgmx')await A().set(['rp','bgm'],null);else if(k==='capx')await A().set(['rp','caption'],null);else if(k==='centerx')await A().set(['rp','center'],null);openConsole()});
  const mn=$('#gcmain',md);if(mn)mn.scrollTop=GC.top&&GC.top.t===tab?GC.top.y:0;if(mn)mn.addEventListener('scroll',()=>{GC.top={t:tab,y:mn.scrollTop}});
  return md}
 function openConsole(tab){if(tab&&tab!==GC.tab){GC.tab=tab;GC.top=null}const r=R();const ST=A().ST;
  if(GC.tab==='bg'){QB.con=true;return quickBg()}
  const re=()=>openConsole();let body='';
  const sec=(t,note)=>`<div class="gcsec"><h3>${t}</h3>${note?`<span class="note">${note}</span>`:''}</div>`;
  if(GC.tab==='bgm')body=`<div id="bgmpanel">${bgmPanelHtml()}</div>`;
  else if(GC.tab==='notice'){const ns=notices();
   body=`${sec('공지 띄우기','누르면 모두에게 배너 + 로그')}<input type="text" id="gsub" class="gcwide" placeholder="멘트를 바꿔 보내기 — 비우면 저장된 멘트">
    <div class="gcnot">${ns.map((n,i)=>`<button class="gno" data-gc="note" data-i="${i}" style="--c:${esc(n.color)}"><b>${esc(n.name)}</b><span>${esc(n.title&&n.title!==n.name?n.title:'')}${n.ment?`${n.title&&n.title!==n.name?' · ':''}${esc(n.ment)}`:''}</span>${n.bgm==='stop'?'<em>BGM 정지</em>':''}</button>`).join('')}<button class="gno cut" data-gc="cut" style="--c:#5b6278"><b>절취선</b><span>로그에 가로줄</span></button></div>
    <details class="gcdet" id="gnd" ${GC.nEdit?'open':''}><summary>공지 고치기 <span class="note">고치면 바로 저장</span></summary>
     <div class="gnrows" id="ntab">${ns.map((n,i)=>`<div class="gnr"><input type="color" data-nc value="${esc(n.color)}" title="색"><input type="text" data-nn value="${esc(n.name)}" placeholder="버튼 이름"><input type="text" data-nt value="${esc(n.title)}" placeholder="배너 제목"><input type="text" data-nm value="${esc(n.ment)}" placeholder="멘트"><select data-nb><option value="" ${!n.bgm?'selected':''}>BGM 그대로</option><option value="stop" ${n.bgm==='stop'?'selected':''}>BGM 정지</option></select><button class="btn xs ghost danger" data-gc="ndel" data-i="${i}" title="지우기">×</button></div>`).join('')}</div>
     <div class="row" style="margin-top:8px"><button class="btn xs" data-gc="nadd">＋ 공지</button><span class="sp"></span><button class="btn xs ghost" data-gc="nreset">기본값으로</button></div></details>`}
  else if(GC.tab==='map'){const M=mapS();const W=(M.img||{}).w||1000,H=(M.img||{}).h||700;
   const pins=M.img?M.locs.map(l=>{const h=M.vis[l.n]==1;return `<button class="gmp ${h?'hid':''} ${M.party.n===l.n?'pc':''}" data-gc="pgo" data-n="${l.n}" style="left:${l.x/W*100}%;top:${l.y/H*100}%" title="${esc(l.name)}${h?' (가림)':''} — 눌러서 파티 이동"><b>${M.party.n===l.n?'PC':l.n}</b></button>`}).join(''):'';
   body=`<div class="gcmap"><div>${M.img?`<div class="gmmini" style="aspect-ratio:${W}/${H};background-image:url('${cssu(M.img.src)}')">${pins}</div><div class="small dim" style="margin-top:4px">번호를 누르면 파티가 그곳으로 간다${M.reveal?' (가린 곳이면 함께 공개)':''}. 흐린 번호는 가린 장소.</div>`:`<div class="gcempty">지도 그림이 없다<br><button class="btn sm" data-gc="mapmgr" data-t="img">지도 그림 올리기</button></div>`}</div>
    <div>${sec('파티')}<div class="row"><button class="btn sm ${M.party.vis?'':'pri'}" data-gc="pvis">${M.party.vis?'👁 핀 보임':'🙈 핀 숨김'}</button><label class="small"><input type="checkbox" data-gc="reveal" ${M.reveal?'checked':''}> 가린 곳으로 가면 함께 공개</label></div>
     ${sec('장소',`${M.locs.filter(l=>M.vis[l.n]!=1).length}/${M.locs.length} 공개`)}<div class="gmlocs">${M.locs.map(l=>{const h=M.vis[l.n]==1;return `<div class="gml ${h?'hid':''} ${M.party.n===l.n?'pc':''}"><span class="no">${l.n}</span><span class="nm">${esc(l.name)}</span>${M.party.n===l.n?'<span class="tag me">파티</span>':`<button class="btn xs ghost" data-gc="pgo" data-n="${l.n}">이동</button>`}<button class="btn xs ${h?'pri':'ghost'}" data-gc="lvis" data-n="${l.n}">${h?'🙈':'👁'}</button></div>`}).join('')||'<div class="small dim">장소가 없다</div>'}</div>
     <div class="row" style="margin-top:10px"><button class="btn sm" data-gc="mapmgr" data-t="loc">지도 관리 (장소 · 루트 · 인물)</button><button class="btn sm ghost" data-gc="mapopen">${mapOpen?'무대 지도 닫기':'무대에 지도 열기'}</button></div></div></div>`}
  else if(GC.tab==='stage'){const manual=r.stage||{};const chars=[{key:'gm',name:'GM'},...Object.values((ST.state.roster||{}).trainers||{}).map(t=>({key:t.id,name:t.name})),...Object.values((ST.state.graph||{}).nodes||{}).filter(n=>n.kind!=='org').map(n=>({key:'npc:'+n.name,name:n.name+' (NPC)'}))];
   const slotCard=s=>{const m=manual[s]||{};const c=m.key?charOf(m.key):null;const src=c?standSrc(c):'';return `<div class="gss ${m.key?'set':''}"><div class="gssp ${m.flip?'flip':''}" style="${src?`background-image:url('${cssu(src)}')`:''}">${src?'':`<span>${m.key?'그림 없음':'자동'}</span>`}</div><b>${{left:'왼쪽',center:'가운데',right:'오른쪽'}[s]}</b><select data-slot="${s}"><option value="">(자동 — 말하는 사람)</option>${chars.map(x=>`<option value="${esc(x.key)}" ${m.key===x.key?'selected':''}>${esc(x.name)}</option>`).join('')}</select><label class="small"><input type="checkbox" data-flip="${s}" ${m.flip?'checked':''} ${m.key?'':'disabled'}> 좌우 반전</label></div>`};
   const bb=r.bubble||{};const bslot=(k,l)=>`<div class="gbs">${bb[k]?`<div class="gbpv" style="background-image:url('${cssu(bb[k])}')"><u data-gc="bubx" data-v="${k}" title="지우기">×</u></div>`:`<div class="updz mini gbdz" id="bub_${k}"><b>＋ 올리기</b><span>끌어 놓기 · 클릭</span><input type="file" accept="image/*" hidden></div>`}<small>${l}</small></div>`;
   body=`${sec('자리 고정','고르면 바로 무대에 반영 · 비우면 말하는 사람이 자동으로 선다')}<div class="gslots">${SLOTS.map(slotCard).join('')}</div>
    <div class="row" style="margin-top:8px"><button class="btn sm ghost" data-gc="stageclear" title="자리 고정을 풀고 서 있는 스탠딩도 내린다">무대 비우기</button><span class="sp"></span><select id="gsc">${chars.map(c=>`<option value="${esc(c.key)}">${esc(c.name)}</option>`).join('')}</select><button class="btn sm" data-gc="stands">표정·스탠딩 편집</button></div>
    ${sec('고정 자막',(r.caption||{}).fixed?'<b style="color:var(--ok)">고정 중</b>':'비우면 채팅이 그대로 자막')}<div class="row"><input type="text" id="gcn" value="${esc((r.caption||{}).name||'')}" placeholder="이름" style="width:130px"><input type="text" id="gct" value="${esc((r.caption||{}).fixed?(r.caption.text||''):'')}" placeholder="무대에 계속 띄워 둘 대사" style="flex:1"><button class="btn sm" data-gc="cap">고정</button>${(r.caption||{}).fixed?'<button class="btn sm ghost" data-gc="capx">풀기</button>':''}</div>
    ${sec('대사 상자 모양','그림 말풍선은 대사에만 — 꼬리는 말하는 사람 자리 쪽, 지문은 꼬리 없는 나레이션')}<div class="row gbm"><button class="btn sm ${bb.on?'ghost':'pri'}" data-gc="bubon" data-v="">기본 (검은 띠)</button><button class="btn sm ${bb.on?'pri':'ghost'}" data-gc="bubon" data-v="1">그림 말풍선</button></div>
    <div class="gbslots">${bslot('c','꼬리 없음 · 지문·자막')}${bslot('l','꼬리 왼쪽 · 왼쪽 화자')}${bslot('m','꼬리 가운데 · 가운데 화자')}${bslot('r','꼬리 오른쪽 · 오른쪽 화자')}</div><div class="small dim">900×400 가로 말풍선 기준 (움직이는 APNG 그대로). 한쪽 꼬리만 있으면 반대쪽은 뒤집어 쓴다. 꼬리 가운데가 없으면 가운데 화자는 꼬리 왼쪽 그림을 가운데 오른편에. 그림은 이 방 저장소에만.</div>
    ${(()=>{const st=bb.st||{};return `<div class="gbst"><label>글꼴 <select id="gbf">${BUB_FONTS.map(([v,l])=>`<option value="${v}" ${(st.font||'')===v?'selected':''}>${esc(l)}</option>`).join('')}</select></label>
     <label>글자 크기 <input type="range" id="gbs" min="60" max="170" step="5" value="${st.fs||100}"><b id="gbs_v">${st.fs||100}%</b></label>
     <label>상자 크기 <input type="range" id="gbw" min="30" max="85" step="1" value="${st.w||52}"><b id="gbw_v">${st.w||52}%</b></label>
     <label>글자 위치 <input type="range" id="gby" min="-12" max="12" step="1" value="${st.y||0}"><b id="gby_v">${st.y>0?'+':''}${st.y||0}</b></label>
     <label>굵기 <select id="gbb">${[['','굵게 (기본)'],['400','보통'],['500','중간'],['900','아주 굵게']].map(([v,l])=>`<option value="${v}" ${String(st.wt||'')===v?'selected':''}>${l}</option>`).join('')}</select></label>
     <button class="btn xs ghost" data-gc="bubst0">원래대로</button></div><div class="small dim">글꼴 · 글자 크기 · 굵기는 기본 띠와 그림 말풍선 모두에, 상자 크기 · 글자 위치는 그림 말풍선에. 움직이면 무대에 바로 미리 보이고 손을 떼면 모두에게 저장된다.</div>`})()}`}
  else if(GC.tab==='etc'){const CI=R().cutin||{};const sel=(id,cur,opts)=>`<select id="${id}" data-ci>${opts.map(([v,l])=>`<option value="${v}" ${String(cur)===v?'selected':''}>${l}</option>`).join('')}</select>`;
   body=`${sec('컷인 · 연출','고치면 바로 저장')}<div class="gcform">
     <label><span>시합 개시</span>${sel('gci_start',CI.start||'vs',[['vs','일반 (VS 컷인)'],['warn','경고 (위험 등장)'],['off','끄기']])}</label>
     <label><span>컷인 전체</span>${sel('gci_on',String(CI.on)==='0'?'0':'1',[['1','켜기'],['0','끄기']])}</label>
     <label><span>지령·명령 컷인</span>${sel('gci_ord',String(CI.ord)==='0'?'0':'1',[['1','켜기'],['0','끄기']])}</label>
     <label><span>포텐셜 컷인</span>${sel('gci_pot',CI.pot||'excl',[['excl','전용·고유만'],['all','모두'],['none','끄기']])}</label>
     <label><span>크기 %</span><input type="number" class="n" id="gci_sc" data-ci value="${CI.sc||70}" min="40" max="120"></label>
     <label><span>위치</span>${sel('gci_pos',CI.pos||'mid',[['mid','가운데'],['top','위'],['bot','아래']])}</label>
     <label class="wide"><span>경고 제목</span><input type="text" id="gci_wt" data-ci value="${esc(CI.warnTitle||'')}" placeholder="강적 출현"></label></div>
    <div class="row" style="margin-top:8px"><span class="small dim">지금 띄우기</span><button class="btn sm" data-gc="cutvs">VS 컷인</button><button class="btn sm" data-gc="cutwarn">경고 연출</button><button class="btn sm ghost" data-gc="cuttest">컷인 시험</button></div>
    ${sec('중앙 그림','무대 한가운데 크게 — 증거 · 편지 · 장면 컷')}<div class="gcctr"><div class="gcpv" style="${r.center&&r.center.src?`background-image:url('${cssu(r.center.src)}')`:''}">${r.center&&r.center.src?'':'<span>없음</span>'}</div>
     <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px"><div class="row"><input type="text" id="gci" placeholder="그림 주소 https://…" style="flex:1"><button class="btn sm" data-gc="center">띄우기</button>${r.center&&r.center.src?'<button class="btn sm ghost" data-gc="centerx">내리기</button>':''}</div><div class="updz mini" id="gcidz"><b>＋ 그림 올리기</b><span>끌어 놓기 · 클릭 · Ctrl+V — 올리면 바로 띄운다</span><input type="file" accept="image/*" hidden></div></div></div>`}
  else if(GC.tab==='se'){const SG=seList();
   body=`${sec('효과음','누르면 모두에게 한 번 · 배틀의 명중/급소/빗나감/빈사/주사위/공개는 자동')}<div class="row"><input type="search" id="gseq" placeholder="효과음 이름으로 찾기" value="${esc(GC.seQ)}" style="flex:1"></div>
    <div class="gsel">${Object.keys(SG).sort().map(g=>`<div class="gseg" data-seg><div class="small dim">${esc(g.replace(/^\d+\.\s*/,''))}</div><div class="gsec">${Object.keys(SG[g]).map(n=>`<button class="chip" data-gc="se" data-n="${esc(n)}" data-q="${esc(n.toLowerCase())}">${esc(n)}</button>`).join('')}</div></div>`).join('')}</div>
    <div class="row" style="margin-top:8px"><input type="text" id="gseu" placeholder="목록에 없는 효과음 — 직링크 (mp3/wav)" style="flex:1"><button class="btn sm" data-gc="seurl">울리기</button></div>`}
  else{const seats=Object.entries(ST.state.seats||{});
   body=`${sec('귓속말','받는 사람과 GM 만 본다')}${seats.length?`<div class="row"><select id="gwto">${seats.map(([k,v])=>`<option value="${esc(k)}">${esc((((ST.state.roster||{}).trainers||{})[k]||{}).name||k)} (${esc(v.name)})</option>`).join('')}</select><input type="text" id="gwt" placeholder="메시지 — 엔터로 보내기" style="flex:1"><button class="btn sm pri" data-gc="whisper">보내기</button></div>`:'<div class="small dim">아직 자리에 앉은 플레이어가 없다</div>'}
    ${sec('채팅 명령')}<table class="t small gccmd"><tr><td><code>/as 이름 말</code></td><td>그 인물로 말하기 (관계도의 NPC 면 스탠딩·아바타가 따라온다)</td></tr><tr><td><code>@표정 말</code></td><td>표정(스탠딩)을 바꾸며 말하기</td></tr><tr><td><code>/s 라벨</code></td><td>표정만 바꾸기</td></tr><tr><td><code>*지문*</code></td><td>따옴표 없는 기울임 지문</td></tr><tr><td><code>/img 주소</code></td><td>채팅에 그림</td></tr><tr><td><code>/r 1d100</code></td><td>주사위</td></tr><tr><td><code>/w 이름 말</code></td><td>귓속말 (GM 에게는 /w GM)</td></tr><tr><td><code>/clear</code></td><td>무대의 스탠딩 모두 내리기</td></tr></table>`}
  const md=gcShell(GC.tab,body);
  /* 공지 고치기: 칸을 고치면 바로 저장 */
  const saveN=async()=>{const rows=[...md.querySelectorAll('#ntab .gnr')].map((tr,i)=>({id:'n'+i,name:tr.querySelector('[data-nn]').value.trim(),title:tr.querySelector('[data-nt]').value.trim(),ment:tr.querySelector('[data-nm]').value,color:tr.querySelector('[data-nc]').value,bgm:tr.querySelector('[data-nb]').value})).filter(x=>x.name);await A().set(['rp','notices'],rows);A().toast('공지를 저장했다')};
  md.querySelectorAll('#ntab input,#ntab select').forEach(x=>x.addEventListener('change',saveN));
  const nd=$('#gnd',md);if(nd)nd.ontoggle=()=>{GC.nEdit=nd.open};
  /* 연출 설정: 고치면 바로 저장 */
  md.querySelectorAll('[data-ci]').forEach(x=>x.addEventListener('change',async()=>{const v=id=>$('#'+id,md).value;const ci=Object.assign({},R().cutin||{},{start:v('gci_start'),on:v('gci_on'),ord:v('gci_ord'),pot:v('gci_pot'),sc:+v('gci_sc')||70,pos:v('gci_pos'),warnTitle:v('gci_wt').trim()});await A().set(['rp','cutin'],ci);A().toast('연출 설정 저장')}));
  /* 자리 고정: 고르면 바로 */
  const saveSlots=async()=>{const st={};for(const s of SLOTS){const v=md.querySelector(`[data-slot="${s}"]`).value;if(v)st[s]={key:v,flip:md.querySelector(`[data-flip="${s}"]`).checked}}await A().set(['rp','stage'],Object.keys(st).length?st:null);re()};
  md.querySelectorAll('[data-slot],[data-flip]').forEach(x=>x.addEventListener('change',saveSlots));
  const sq=$('#gseq',md);if(sq){const f=()=>{const q=GC.seQ.trim().toLowerCase();md.querySelectorAll('[data-seg]').forEach(g=>{let n=0;g.querySelectorAll('[data-q]').forEach(b=>{const on=!q||b.dataset.q.includes(q);b.style.display=on?'':'none';if(on)n++});g.style.display=n?'':'none'})};sq.oninput=()=>{GC.seQ=sq.value;f()};f()}
  const wt=$('#gwt',md);if(wt)wt.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();md.querySelector('[data-gc="whisper"]').click()}};
  md.querySelectorAll('[data-gc]').forEach(b=>{const h=async()=>{const k=b.dataset.gc;
   if(k==='note'){const n=notices()[+b.dataset.i];const sub=$('#gsub',md).value.trim();await fireNotice(n,sub);return A().toast(`「${n.name}」 공지를 띄웠다`)}
   if(k==='cut'){await A().sysLog('────────────────────');return A().toast('절취선')}
   if(k==='nadd'){GC.nEdit=true;await A().set(['rp','notices'],[...notices(),{id:'n'+Date.now().toString(36),name:'새 공지',title:'',ment:'',color:'#d9243f'}]);return re()}
   if(k==='ndel'){await A().set(['rp','notices'],notices().filter((x,i)=>i!==+b.dataset.i));return re()}
   if(k==='nreset'){if(!confirm('공지를 기본 8개로 되돌릴까?'))return;await A().set(['rp','notices'],null);return re()}
   if(k==='pgo'){await partyMove(+b.dataset.n);return re()}
   if(k==='lvis'){await toggleLoc(+b.dataset.n);return re()}
   if(k==='pvis'){const M=mapS();await saveMap({party:Object.assign({},M.party,{vis:M.party.vis?0:1})});return re()}
   if(k==='reveal'){await saveMap({reveal:b.checked?1:0});return re()}
   if(k==='mapmgr')return openMapMgr(b.dataset.t||'loc');
   if(k==='mapopen'){mapOpen=!mapOpen;A().renderScene();return re()}
   if(k==='stageclear'){await A().set(['rp','stage'],null);await DBS().addLog(ST.room,ST.secret,'chat',ST.name,{t:'',clear:1});return re()}
   if(k==='stands')return openStands($('#gsc',md).value);
   if(k==='cap'){const t=$('#gct',md).value.trim();if(!t)return A().toast('자막을 적어 줘');await A().set(['rp','caption'],{name:$('#gcn',md).value.trim(),text:t,at:Date.now(),fixed:true});return re()}
   if(k==='capx'){await A().set(['rp','caption'],null);return re()}
   if(k==='bubon'){await A().set(['rp','bubble','on'],b.dataset.v?true:null);return re()}
   if(k==='bubx'){await A().set(['rp','bubble',b.dataset.v],null);return re()}
   if(k==='bubst0'){await A().set(['rp','bubble','st'],null);return re()}
   if(k==='center'){const u=$('#gci',md).value.trim();if(!u)return;await A().set(['rp','center'],{src:u,at:Date.now()});return re()}
   if(k==='centerx'){await A().set(['rp','center'],null);return re()}
   if(k==='se'){unlocked=true;return playSe(b.dataset.n)}
   if(k==='seurl'){const u=$('#gseu',md).value.trim();if(!u)return;unlocked=true;return playSe(u)}
   if(k==='cutvs'||k==='cutwarn'){const B=window.OM_BATTLE_UI;if(!B||!B.startCut)return;unlocked=true;return B.startCut(k==='cutvs'?'vs':'warn')}
   if(k==='cuttest'){unlocked=true;return window.OM_CUTIN&&window.OM_CUTIN.fire({tok:'gm',src:'',tag:'GM',ment:'『컷인 시험』'})}
   if(k==='whisper'){const to=$('#gwto',md).value,t=$('#gwt',md).value.trim();if(!to||!t)return;await DBS().addLog(ST.room,ST.secret,'whisper',ST.name,{t,to,toName:(((ST.state.roster||{}).trainers||{})[to]||{}).name||to});$('#gwt',md).value='';A().toast('보냈다');return}};
   if(b.type==='checkbox')b.onchange=h;else b.onclick=h});
  if(GC.tab==='bgm')bindBgmPanel(md,re);
  if($('#gbf',md)){const rd=()=>({font:$('#gbf',md).value||null,fs:+$('#gbs',md).value===100?null:+$('#gbs',md).value,w:+$('#gbw',md).value===52?null:+$('#gbw',md).value,y:+$('#gby',md).value||null,wt:$('#gbb',md).value||null});
   const live=()=>{const v=rd();$('#gbs_v',md).textContent=(v.fs||100)+'%';$('#gbw_v',md).textContent=(v.w||52)+'%';$('#gby_v',md).textContent=(v.y>0?'+':'')+(v.y||0);const d=document.getElementById('dlg');if(d)bubStyle(d,v)};
   const save=async()=>{live();const v=rd();for(const k in v)if(v[k]==null)delete v[k];await A().set(['rp','bubble','st'],Object.keys(v).length?v:null)};
   ['#gbs','#gbw','#gby'].forEach(q=>{const e=$(q,md);e.oninput=live;e.onchange=save});['#gbf','#gbb'].forEach(q=>$(q,md).onchange=save)}
  for(const k of ['c','l','m','r'])if($('#bub_'+k,md))bindDz(md,'#bub_'+k,async fs=>{const u=await upImg(fs[0],'bub_'+k);await A().set(['rp','bubble',k],u);if(!(R().bubble||{}).on)await A().set(['rp','bubble','on'],true);re()});
  if($('#gcidz',md))bindDz(md,'#gcidz',async fs=>{const u=await upImg(fs[0],'rp');await A().set(['rp','center'],{src:u,at:Date.now()});re()})}
 /* 대사 상자 글꼴 · 글자 크기 · 상자 크기 · 굵기 · 글자 위치 (rp.bubble.st, GM 콘솔 무대 탭, 10-21 망령) */
 const BUB_FONTS=[['','기본 (화면 글꼴)'],['bhs','Black Han Sans'],['dohyeon','Do Hyeon'],['jua','주아'],['gugi','구기'],['plex','IBM Plex Sans KR'],['noto','Noto Sans KR'],['nanum','나눔고딕'],['gothica1','Gothic A1'],['gowun','고운돋움'],['pretendard','Pretendard'],['myeongjo','나눔명조']];
 function bubStyle(el,st){st=st||{};const S=(k,v)=>{if(v===''||v==null)el.style.removeProperty(k);else el.style.setProperty(k,v)};
  S('--bubfont',st.font&&A().fontCss?A().fontCss(st.font):'');S('--bubfs',st.fs&&+st.fs!==100?String(st.fs/100):'');S('--bubw',st.w?st.w+'%':'');S('--bubwt',st.wt||'');S('--buby',st.y?st.y+'%':'')}
 /* ----- BGM 패널 (맵툴 Lib:bgm 정리판과 같은 꼴): 홈 = 띠(장면/배틀/분위기)별 그룹 타일 → 그룹 = 곡 줄 · 검색 · ▶ 미리듣기 · 모두에게 재생 · ⟳ 다른 곡 ----- */
 const BG={g:'',q:''};
 const gshort=g=>String(g).replace(/^[0-9.]+\s*/,'');
 function bgmMeta(g){const M=(DB().bgm||{}).meta||{};return M[g]||{b:'',d:''}}
 function bgmPanelHtml(){const r=R();const G=bgmGroups();const gs=Object.keys(G).sort();if(BG.g&&!gs.includes(BG.g))BG.g='';const now=r.bgm||{};const q=BG.q.trim().toLowerCase();const bands=((DB().bgm||{}).bands||['장면','배틀','분위기']).concat(['']);
  const row=(g,sn,withGroup)=>{const on=now.title===sn&&now.group===g;return `<div class="song ${on?'cur':''}"><button class="pv ${PV.g===g&&PV.s===sn?'on':''}" data-bq="pv" data-g="${esc(g)}" data-s="${esc(sn)}" title="나만 미리듣기">▶</button><span class="sn" data-bq="play" data-g="${esc(g)}" data-s="${esc(sn)}"><b>${esc(sn)}</b>${withGroup?`<small class="dim"> ${esc(gshort(g))}</small>`:''}${on?'<em class="nowtag">재생 중</em>':''}</span><span class="sp"></span><button class="btn xs pri" data-bq="play" data-g="${esc(g)}" data-s="${esc(sn)}">모두에게 재생</button>${withGroup?'':`<button class="btn xs ghost" data-bq="sedit" data-g="${esc(g)}" data-s="${esc(sn)}" title="곡 수정">✎</button><button class="btn xs ghost danger" data-bq="sdel" data-g="${esc(g)}" data-s="${esc(sn)}" title="곡 삭제">✕</button>`}</div>`};
  let head='',list='';
  const bar=`<div class="np"><div class="eq ${now.src?'':'off'}">♪</div><div style="flex:1;min-width:0"><small class="dim">지금 재생 (모두에게)</small><br><b>${esc(now.title?(now.group?gshort(now.group)+' - ':'')+now.title:'재생 중인 곡 없음')}</b>${PV.title?`<br><small style="color:var(--yel2)">미리듣기: ${esc(PV.title)}</small>`:''}</div><label class="small">내 음량 <input type="range" min="0" max="1" step="0.05" value="${vol}" id="gvol"></label>${now.group&&G[now.group]?`<button class="btn sm" data-bq="rand" data-g="${esc(now.group)}" title="같은 그룹에서 다른 곡">⟳ 다른 곡</button>`:''}${PV.audio?'<button class="btn sm ghost" data-bq="pvstop">미리듣기 정지</button>':''}<button class="btn sm ghost danger" data-bq="stop">■ 정지</button></div>`;
  if(!BG.g){const tot=gs.reduce((a,g)=>a+Object.keys(G[g]).length,0);
   head=`<div class="sec"><b>그룹 ${gs.length}개 · ${tot}곡</b><span class="note">▶ 랜덤은 그 그룹에서 아무 곡이나 모두에게</span><span class="sp"></span>${Object.keys((r.bgmX||{}).del||{}).length?'<button class="btn xs ghost" data-bq="undel">지운 것 되살리기</button>':''}<button class="btn xs" data-bq="gadd">＋ 그룹 추가</button></div><div class="row" style="margin-bottom:6px"><input type="text" id="bgq" placeholder="전체 곡 검색 (곡 이름 일부나 그룹 이름)" value="${esc(BG.q)}" style="flex:1"></div>`;
   if(q){let n=0;for(const g of gs){const gm=gshort(g).toLowerCase().includes(q);for(const sn of Object.keys(G[g]).sort()){if(n>=150)break;if(gm||sn.toLowerCase().includes(q)){list+=row(g,sn,true);n++}}}list=`<div class="songlist" style="max-height:56vh">${list||'<div class="empty small">찾는 곡이 없다</div>'}${n>=150?'<div class="small dim">150곡까지만 — 검색어를 더 적어 줘</div>':''}</div>`}
   else{for(const b of bands){const tiles=gs.filter(g=>bgmMeta(g).b===b).map(g=>{const m=bgmMeta(g);const on=now.group===g;return `<div class="btile ${on?'on':''}"><a class="tn" data-bq="open" data-g="${esc(g)}">${esc(gshort(g))}</a><div class="td">${esc(m.d||'')}</div><div class="ta"><button class="btn xs pri" data-bq="rand" data-g="${esc(g)}">▶ 랜덤 재생</button><a class="tc" data-bq="open" data-g="${esc(g)}">${Object.keys(G[g]).length}곡 ▸</a><span class="sp"></span><button class="btn xs ghost" data-bq="gren" data-g="${esc(g)}" title="그룹 이름 변경">✎</button><button class="btn xs ghost danger" data-bq="gdel" data-g="${esc(g)}" title="그룹 삭제">✕</button></div></div>`}).join('');if(tiles)list+=`<div class="band b_${{장면:'scene',배틀:'battle',분위기:'mood'}[b]||'etc'}"><h4>${esc(b||'그 밖의 그룹')}</h4><div class="bgrid">${tiles}</div></div>`}
    if(!gs.length)list='<div class="empty">아직 그룹이 없다 — ＋ 그룹 추가</div>'}}
  else{const g=BG.g;const S=Object.keys(G[g]||{}).sort();const m=bgmMeta(g);
   head=`<div class="sec gh"><a class="back" data-bq="home">◂ 그룹 목록</a><div style="flex:1;min-width:0"><b>${esc(gshort(g))} <span class="small dim">${S.length}곡</span></b><div class="small dim">${esc(m.d||'')}</div></div><button class="btn sm pri" data-bq="rand" data-g="${esc(g)}">▶ 랜덤 재생</button><button class="btn sm" data-bq="sadd" data-g="${esc(g)}">＋ 곡 추가</button></div><div class="row" style="margin-bottom:6px"><input type="text" id="bgq" placeholder="이 그룹에서 곡 검색" value="${esc(BG.q)}" style="flex:1"></div>`;
   const rows=S.filter(sn=>!q||sn.toLowerCase().includes(q)).map(sn=>row(g,sn,false)).join('');list=`<div class="songlist" style="max-height:56vh">${rows||'<div class="empty small">'+(S.length?'찾는 곡이 없다':'이 그룹엔 아직 곡이 없다')+'</div>'}</div>`}
  return bar+head+list+`<div class="small dim" style="margin-top:6px">플레이어 화면에서는 「소리 켜기」를 한 번 눌러야 들린다. 음량은 각자. 기본 목록은 파일에 있고 여기서 더하거나 지운 것만 방에 저장된다.</div>`}
 function bindBgmPanel(md,re){const G=bgmGroups();
  const vr=$('#gvol',md);if(vr)vr.oninput=()=>{vol=+vr.value;try{localStorage.setItem('om_vol',vol)}catch(e){}if(audio)audio.volume=vol;if(PV.audio)PV.audio.volume=vol};
  const qi=$('#bgq',md);if(qi)qi.oninput=()=>{BG.q=qi.value;const pos=qi.selectionStart;re();const n=$('#bgq');if(n){n.focus();n.setSelectionRange(pos,pos)}};
  md.querySelectorAll('[data-bq]').forEach(b=>b.onclick=async()=>{const k=b.dataset.bq;const g=b.dataset.g,sn=b.dataset.s;
   if(k==='home'){BG.g='';BG.q='';return re()}
   if(k==='open'){BG.g=g;BG.q='';return re()}
   if(k==='play'){pvStop();await playAll(g,sn);return re()}
   if(k==='rand'){const ss=Object.keys(G[g]||{});if(!ss.length)return;const now=R().bgm||{};let pick=ss[Math.floor(Math.random()*ss.length)];if(ss.length>1&&pick===now.title)pick=ss[(ss.indexOf(pick)+1)%ss.length];pvStop();await playAll(g,pick);return re()}
   if(k==='pv'){if(PV.g===g&&PV.s===sn){pvStop();syncBgm(true);return re()}pvStop();const u=bgmUrl(g,sn);if(!u)return;PV.audio=new Audio(u);PV.audio.volume=vol;PV.audio.play().catch(()=>A().toast('재생하지 못했다'));PV.g=g;PV.s=sn;PV.title=sn;if(audio)audio.pause();return re()}
   if(k==='pvstop'){pvStop();syncBgm(true);return re()}
   if(k==='stop'){pvStop();await A().set(['rp','bgm'],null);return re()}
   if(k==='sadd'){const t=prompt('곡 제목');if(!t||!t.trim())return;const u=prompt('주소 (Dropbox 공유 링크도 됨)');if(!u||!u.trim())return;const X=bgmX();X.add[g]=X.add[g]||{};X.add[g][t.trim()]=direct(u);delete X.del[g+'\u0001'+t.trim()];await A().set(['rp','bgmX'],X);return re()}
   if(k==='sedit'){const t=prompt('곡 제목',sn);if(t==null||!t.trim())return;const u=prompt('주소',G[g][sn]);if(u==null||!u.trim())return;const X=bgmX();if(X.add[g]&&X.add[g][sn])delete X.add[g][sn];else X.del[g+'\u0001'+sn]=1;X.add[g]=X.add[g]||{};X.add[g][t.trim()]=direct(u);delete X.del[g+'\u0001'+t.trim()];await A().set(['rp','bgmX'],X);return re()}
   if(k==='sdel'){if(!confirm(`「${sn}」 곡을 지울까?`))return;const X=bgmX();if(X.add[g]&&X.add[g][sn])delete X.add[g][sn];else X.del[g+'\u0001'+sn]=1;await A().set(['rp','bgmX'],X);return re()}
   if(k==='gadd'){const n=prompt('새 그룹 이름 (예: 20. 무진 · 항구)');if(!n||!n.trim())return;const X=bgmX();X.add[n.trim()]=X.add[n.trim()]||{};delete X.del[n.trim()];await A().set(['rp','bgmX'],X);return re()}
   if(k==='gren'){const n=prompt('그룹 이름',g);if(!n||!n.trim()||n.trim()===g)return;const X=bgmX();X.add[n.trim()]=Object.assign({},X.add[n.trim()]||{},G[g]);X.del[g]=1;await A().set(['rp','bgmX'],X);return re()}
   if(k==='gdel'){if(!confirm(`「${gshort(g)}」 그룹(${Object.keys(G[g]||{}).length}곡)을 목록에서 지울까?`))return;const X=bgmX();X.del[g]=1;delete X.add[g];if(BG.g===g)BG.g='';await A().set(['rp','bgmX'],X);return re()}
   if(k==='undel'){const X=bgmX();X.del={};await A().set(['rp','bgmX'],X);return re()}})}
 /* 브금 미리듣기(나만) · 모두에게 재생 · 방 차이 저장 */
 const PV={audio:null,g:'',s:'',title:''};
 function pvStop(){if(PV.audio){PV.audio.pause();PV.audio=null}PV.g='';PV.s='';PV.title=''}
 function bgmX(){const X=JSON.parse(JSON.stringify(R().bgmX||{}));X.add=X.add||{};X.del=X.del||{};return X}
 function direct(u){u=String(u||'').trim();const m=u.match(/^https?:\/\/(?:www\.)?dropbox\.com\/(scl\/fi\/[^?]+|s\/[^?]+)(\?.*)?$/);if(m){const q=(m[2]||'').replace(/[?&]dl=\d/,'').replace(/^&/,'?');return 'https://dl.dropboxusercontent.com/'+m[1]+(q==='?'?'':q)}return u}
 async function playAll(g,s,re){const u=bgmUrl(g,s);if(!u)return A().toast('주소가 없다');unlocked=true;await A().set(['rp','bgm'],{src:u,title:s,group:g,at:Date.now()});const rec=[{g,s},...(R().recentBgm||[]).filter(x=>!(x.g===g&&x.s===s))].slice(0,10);await A().set(['rp','recentBgm'],rec);syncBgm(true);if(re)re()}
 async function fireNotice(n,sub){const ment=sub||n.ment||'';await A().set(['rp','banner'],{title:n.title||n.name,text:ment,color:n.color||'#d9243f',at:Date.now()});await A().sysLog(`[${n.title||n.name}]${ment?' '+ment.replace(/\n/g,' '):''}`);if(n.bgm==='stop')await A().set(['rp','bgm'],null)}

 /* ----- 스탠딩(표정) 편집: 트레이너는 로스터에, NPC 는 관계도 노드에 ----- */
 const ST_IMG=/\.(png|jpe?g|webp|gif|avif|bmp)$/i, isImg=f=>f&&(/^image\//.test(f.type||'')||ST_IMG.test(f.name||''));
 const stLabel=n=>String(n||'').split(/[\\/]/).pop().replace(/\.[^.]+$/,'').trim()||'기본';
 /* 끌어 놓은 파일·폴더 → 그림 파일 목록 (폴더는 안까지 다 훑는다). items 는 drop 순간에만 읽을 수 있어서 await 전에 entry 로 바꿔 둔다 */
 async function dropImgs(dt){const ents=[...(dt.items||[])].map(it=>it.kind==='file'&&it.webkitGetAsEntry&&it.webkitGetAsEntry()).filter(Boolean);const plain=[...(dt.files||[])];
  if(!ents.length)return plain.filter(isImg);const out=[];
  const walk=async e=>{if(e.isFile){const f=await new Promise((r,j)=>e.file(r,j));if(isImg(f))out.push(f)}else if(e.isDirectory){const rd=e.createReader();for(;;){const xs=await new Promise((r,j)=>rd.readEntries(r,j));if(!xs.length)break;for(const x of xs)await walk(x)}}};
  for(const e of ents)await walk(e);return out}
 if(!window.__omDropGuard){window.__omDropGuard=1;const g=e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files'))e.preventDefault()};addEventListener('dragover',g);addEventListener('drop',g)}
 /* 그림 올리기 칸 (스탠딩 창과 같은 방식): 끌어 놓기 · 클릭해서 고르기 · Ctrl+V. 한 창에 여러 칸이면 마지막으로 마우스를 올린 칸이 붙여넣기를 받는다 */
 const upImg=(f,tag)=>DBS().uploadImage(`rooms/${A().ST.room}/${tag||'img'}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,5)}`,f);
 function bindDz(md,sel,onFiles,multi){const z=typeof sel==='string'?$(sel,md):sel;if(!z)return;const fi=z.querySelector('input[type=file]');const hasF=e=>e.dataTransfer&&[...e.dataTransfer.types].includes('Files');
  const run=async fs=>{fs=(fs||[]).filter(isImg);if(!fs.length)return A().toast('그림 파일이 없다');if(z.classList.contains('busy'))return;z.classList.add('busy');const t=z.querySelector('b'),t0=t?t.textContent:'';if(t)t.textContent='올리는 중…';
   try{await onFiles(multi?fs:[fs[0]])}catch(e){A().toast('올리지 못했다: '+e.message)}finally{if(z.isConnected){z.classList.remove('busy');if(t)t.textContent=t0}}};
  if(fi){z.onclick=e=>{if(e.target!==fi)fi.click()};fi.onchange=()=>{const fs=[...fi.files];fi.value='';run(fs)}}
  let d=0;z.addEventListener('dragenter',e=>{if(!hasF(e))return;e.preventDefault();d++;z.classList.add('over')});z.addEventListener('dragover',e=>{if(hasF(e)){e.preventDefault();e.dataTransfer.dropEffect='copy'}});
  z.addEventListener('dragleave',()=>{if(--d<=0){d=0;z.classList.remove('over')}});z.addEventListener('drop',async e=>{e.preventDefault();e.stopPropagation();d=0;z.classList.remove('over');run(await dropImgs(e.dataTransfer))});
  z.addEventListener('mouseenter',()=>{md._dzAct=z});z._run=run;
  if(!md._dzPaste){md._dzPaste=1;const onPaste=e=>{if(!md.isConnected)return document.removeEventListener('paste',onPaste);const fs=[...((e.clipboardData||{}).files||[])].filter(isImg);if(!fs.length)return;const tz=md._dzAct&&md._dzAct.isConnected?md._dzAct:md.querySelector('.updz');if(!tz||!tz._run)return;e.preventDefault();tz._run(fs)};document.addEventListener('paste',onPaste)}}
 const dzHtml=(id,label,sub)=>`<div class="updz" id="${id}"><b>${label||'그림을 끌어 놓기'}</b><span>${sub||'클릭해서 고르기 · Ctrl+V 붙여넣기'}</span><input type="file" accept="image/*" hidden></div>`;
 function openStands(key){const c=charOf(key);if(!c)return A().toast('그 인물이 없다');const ST=A().ST;const canEdit=gm()||(c.kind==='pc'&&c.id===ST.seat)||(c.kind==='pm'&&c.tid===ST.seat);
  const KINDS=[['','모양 자동'],['stand','스탠딩'],['portrait','초상']];const kindSel=(attr,v)=>`<select ${attr}>${KINDS.map(([k,n])=>`<option value="${k}" ${(v||'')===k?'selected':''}>${n}</option>`).join('')}</select>`;
  const cur=c.stands.map(s=>Object.assign({},s));let act=Math.max(0,Math.min(c.active||0,cur.length-1));
  const card=(s,i)=>`<div class="stxc ${i===act?'on':''}">
    <div class="stxp" ${canEdit?`data-st="use" data-i="${i}" title="눌러서 이 표정으로"`:''}>${s.src?`<img src="${esc(s.src)}" alt="" loading="lazy">`:'<span class="small dim">그림 없음</span>'}${i===act?'<span class="stxon">사용 중</span>':''}${s.kind?`<span class="stxk">${s.kind==='stand'?'스탠딩':'초상'}</span>`:''}</div>
    ${canEdit?`<div class="stxf"><input type="text" class="stxl" data-sl="${i}" value="${esc(s.label||'')}" placeholder="라벨"><input type="number" class="n stxn" data-sp="${i}" value="${+s.point||0}" title="보정 — 위로 올릴 px (음수면 내림)"></div>
    <div class="stxf">${kindSel(`data-stk="${i}"`,s.kind)}<label class="btn xs ghost" title="그림만 바꾸기">교체<input type="file" accept="image/*" data-srep="${i}" hidden></label><button class="btn xs ghost danger" data-st="del" data-i="${i}" title="지우기">×</button></div>`
    :`<div class="stxf"><b class="stxb">${esc(s.label||'기본')}</b></div>`}</div>`;
  const md=A().openModal(`<div class="mhead"><h2>${esc(c.name)} — 표정·스탠딩</h2><span class="sp"></span><span class="tag">${cur.length}장</span><button class="btn ghost" data-x>닫기</button></div>${c.kind==='gm'?`<div class="row small dim" style="margin:-4px 0 8px">GM 도 스탠딩을 쓴다 — 「GM」으로 따옴표 대사("…")를 칠 때 무대에 서고, 따옴표 없는 지문은 그대로 나레이션.<span class="sp"></span><button class="btn xs ghost" data-gmimg>칩·로그 그림</button></div>`:''}
   ${canEdit?`<div class="stdz" id="st_dz"><div class="stdzt"><b>그림을 여기로 끌어 놓기</b><span class="small dim">여러 장·폴더째로 된다 · 파일 이름이 라벨 · 같은 라벨은 그림만 바뀐다 · Ctrl+V 로 붙여넣기도</span></div>
    <div class="row stdzb"><label class="btn sm pri">파일 고르기<input type="file" accept="image/*" multiple id="st_f" hidden></label><label class="btn sm">폴더 올리기<input type="file" webkitdirectory directory multiple id="st_d" hidden></label><span class="sp"></span>${kindSel('id="st_k" title="새로 올리는 그림의 모양"','')}</div>
    <div class="stprog" id="st_pg" hidden><i></i><span></span></div></div>`:''}
   <div class="stxg">${cur.map(card).join('')||'<div class="empty small">아직 스탠딩이 없다 — 시트 그림(초상)을 쓴다</div>'}</div>
   ${canEdit?`<details class="stmore"><summary>그림 주소로 추가</summary><div class="row"><input type="text" id="st_l" placeholder="라벨" style="width:120px"><input type="text" id="st_u" placeholder="그림 주소 (투명 PNG 전신 권장)" style="flex:1"><button class="btn sm" data-st="add">추가</button></div></details>`:''}
   <details class="stmore"><summary>도움말</summary><div class="small dim">채팅할 때 「사용 중」인 스탠딩이 무대에 선다. 없으면 초상(시트 그림)을 쓴다. 그림을 누르면 그 표정으로 바뀌고, 채팅에서 <code>/s 라벨</code> 로도 바꿀 수 있다. 숫자 칸은 보정 — 위로 올릴 px (음수면 내림). 모양: 「스탠딩」은 틀 없이 전신으로, 「초상」은 네모 틀 안에 선다 (「자동」은 그림 비율로 정한다).</div></details>`);
  md.classList.add('stmodal2');
  {const gi=$('[data-gmimg]',md);if(gi)gi.onclick=()=>{A().closeModal();openGmImg()}}
  const path=c.kind==='gm'?['rp','gmSt']:c.kind==='pc'?['roster','trainers',c.id]:c.kind==='pm'?['roster','mons',c.id]:['graph','nodes',c.id];
  const okPath=()=>{if(c.kind!=='pc'&&c.kind!=='pm'&&!c.id){A().toast('관계도에 없는 인물이다 — 관계도에 먼저 넣어 줘');return false}return true};
  const save=async re=>{if(!okPath())return;act=Math.max(0,Math.min(act,cur.length-1));await A().set([...path,'stands'],cur.slice());await A().set([...path,'standActive'],act);if(re){A().closeModal();openStands(key)}};
  const upOne=f=>DBS().uploadImage(`rooms/${ST.room}/st_${c.kind}_${(c.id||c.name)}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`,f);
  let busy=false;
  const addFiles=async files=>{if(!canEdit||busy)return;files=files.filter(isImg).sort((a,b)=>(a.webkitRelativePath||a.name).localeCompare(b.webkitRelativePath||b.name,'ko',{numeric:true}));if(!files.length)return A().toast('그림 파일이 없다');if(!okPath())return;
   busy=true;const pg=$('#st_pg',md),bar=pg.querySelector('i'),txt=pg.querySelector('span');pg.hidden=false;const kd=$('#st_k',md).value;const urls=new Array(files.length);let done=0,fail=0,nx=0;
   const tick=()=>{bar.style.width=(done/files.length*100)+'%';txt.textContent=`올리는 중 ${done}/${files.length}${fail?` · 실패 ${fail}`:''}`};tick();
   const worker=async()=>{while(nx<files.length){const k=nx++;try{urls[k]=await upOne(files[k])}catch(e){fail++;A().toast(e.message)}done++;tick()}};
   await Promise.all([worker(),worker(),worker()]);let add=0,rep=0;
   files.forEach((f,k)=>{const url=urls[k];if(!url)return;const label=stLabel(f.name);const j=cur.findIndex(s=>(s.label||'')===label);if(j>=0){cur[j]=Object.assign({},cur[j],{src:url});rep++}else{cur.push(Object.assign({label,src:url,point:0},kd?{kind:kd}:{}));add++}});
   busy=false;if(!add&&!rep){pg.hidden=true;return}await save(true);A().toast(`스탠딩 ${add}장 추가${rep?` · ${rep}장 교체`:''}${fail?` · ${fail}장 실패`:''}`)};
  if(canEdit){const dz=$('#st_dz',md);let depth=0;
   md.addEventListener('dragenter',e=>{if(![...e.dataTransfer.types].includes('Files'))return;e.preventDefault();depth++;dz.classList.add('over')});
   md.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='copy'}});
   md.addEventListener('dragleave',()=>{if(--depth<=0){depth=0;dz.classList.remove('over')}});
   md.addEventListener('drop',async e=>{e.preventDefault();depth=0;dz.classList.remove('over');addFiles(await dropImgs(e.dataTransfer))});
   $('#st_f',md).onchange=e=>addFiles([...e.target.files]);$('#st_d',md).onchange=e=>addFiles([...e.target.files]);
   const onPaste=e=>{if(!md.isConnected)return document.removeEventListener('paste',onPaste);const fs=[...((e.clipboardData||{}).files||[])].filter(isImg);if(!fs.length)return;e.preventDefault();addFiles(fs.map((f,k)=>new File([f],(f.name&&f.name!=='image.png'?f.name:`붙여넣기${cur.length+k+1}.png`),{type:f.type})))};document.addEventListener('paste',onPaste);
   md.querySelectorAll('[data-sl]').forEach(inp=>inp.onchange=()=>{const i=+inp.dataset.sl;cur[i]=Object.assign({},cur[i],{label:inp.value.trim()||'기본'});save(false)});
   md.querySelectorAll('[data-sp]').forEach(inp=>inp.onchange=()=>{const i=+inp.dataset.sp;cur[i]=Object.assign({},cur[i],{point:+inp.value||0});save(false)});
   md.querySelectorAll('[data-stk]').forEach(sel=>sel.onchange=()=>{const i=+sel.dataset.stk;const s=Object.assign({},cur[i]);if(sel.value)s.kind=sel.value;else delete s.kind;cur[i]=s;save(true)});
   md.querySelectorAll('[data-srep]').forEach(fi=>fi.onchange=async()=>{const i=+fi.dataset.srep,f=fi.files[0];if(!f)return;A().toast('올리는 중…');try{const url=await upOne(f);cur[i]=Object.assign({},cur[i],{src:url});await save(true)}catch(e){A().toast(e.message)}});
   md.querySelectorAll('[data-st]').forEach(b=>b.onclick=async()=>{const k=b.dataset.st;const i=+b.dataset.i;
    if(k==='use'){act=i;return save(true)}
    if(k==='del'){if(!confirm(`「${cur[i].label||'기본'}」 스탠딩을 지울까?`))return;cur.splice(i,1);if(act>i||act>=cur.length)act=Math.max(0,act-1);return save(true)}
    if(k==='add'){const u=$('#st_u',md).value.trim();if(!u)return A().toast('그림 주소가 필요해');const kd=$('#st_k',md).value;cur.push(Object.assign({label:$('#st_l',md).value.trim()||stLabel(u.split('?')[0])||'기본',src:u,point:0},kd?{kind:kd}:{}));act=cur.length-1;return save(true)}})}}
 function openMyStand(){const ST=A().ST;if(gm()){const chars=[{key:'gm',name:'GM'},...Object.values((ST.state.roster||{}).trainers||{}).map(t=>({key:t.id,name:t.name})),...Object.values((ST.state.graph||{}).nodes||{}).map(n=>({key:'npc:'+n.name,name:n.name+' (NPC)'}))];
   const md=A().openModal(`<div class="mhead"><h2>표정·스탠딩</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="row"><select id="gsc2" style="flex:1">${chars.map(c=>`<option value="${esc(c.key)}">${esc(c.name)}</option>`).join('')}</select><button class="btn sm pri" id="gsc2ok">열기</button></div>`);$('#gsc2ok',md).onclick=()=>openStands($('#gsc2',md).value);return}
  if(!ST.seat)return A().toast('자리에 앉아야 한다');openStands(ST.seat)}
 /* 채팅 /s 라벨 */
 async function setMyStand(label){const ST=A().ST;if(ST.role==='gm')return A().toast('GM 은 콘솔 → 무대·스탠딩에서 바꿔');const c=charOf(ST.seat);if(!c)return;const i=c.stands.findIndex(s=>(s.label||'')===label);if(i<0)return A().toast('그런 표정이 없다: '+c.stands.map(s=>s.label).join(', '));await A().set(['roster','trainers',c.id,'standActive'],i);A().toast(`표정: ${label}`)}

 /* ----- 효과음: rp.se={name,src,at} 가 바뀌면 모두 한 번 울린다. 음량은 각자 (om_vol_se) ----- */
 let volSe=0.7,lastSe=0;try{volSe=+(localStorage.getItem('om_vol_se')??0.7)}catch(e){}
 function seUrl(name){const G=(DB().se||{}).groups||{};for(const g in G)if(G[g][name])return G[g][name];return ''}
 function seList(){const G=(DB().se||{}).groups||{};return G}
 const seOff=()=>!!(window.OM_PREFS&&window.OM_PREFS.get().seMute);
 function playSe(name,localOnly){if(seOff()&&localOnly!=='force')return;const u=/^https?:/.test(name)?name:seUrl(name);if(!u)return;if(!gm())localOnly=true;/* 좌석은 rp 를 못 쓰니 내 쪽에서만 울린다 */if(localOnly){const a=new Audio(u);a.volume=volSe;a.play().catch(()=>{});return}A().set(['rp','se'],{name,src:u,at:Date.now()})}
 /* 로그를 보고 자동 효과음: 주사위 → dice, 지시 공개 → Draw, 턴 개시 → Ping2, 공격 명중 → Blow, 급소 → cut_critical, 빗나감 → evasion, 빈사 → Dead */
 let seenLog=new Set();
 function autoSe(row){if(!row||!row.id||seenLog.has(row.id))return;seenLog.add(row.id);if(seenLog.size>500)seenLog=new Set([...seenLog].slice(-200));if(row.at&&Date.now()-new Date(row.at).getTime()>15000)return;if(!unlocked)return;
  const t=String((row.data||{}).t||'');let n='';if(row.kind==='dice')n='dice';else if(row.kind==='battle'){if(/^【공개】/.test(t))n='Draw';else if(/^턴 개시/.test(t))n='Ping2';else if(/급소!/.test(t))n='cut_critical';else if(/명중\(|필중/.test(t))n='Blow';else if(/빗나감/.test(t))n='evasion';else if(/풀이 죽어|잠자고|저려서|얼어붙어|홀딱 반해|스스로를 공격/.test(t))n='Ping'}
  const dead=/빈사!|쓰러졌다!/.test(t);if(!n&&!dead)return;if(n)playSe(n,true);if(dead)setTimeout(()=>playSe('Dead',true),n?700:0)}
 function syncSe(){const se=R().se;if(!se||!se.at||se.at===lastSe)return;lastSe=se.at;if(Date.now()-se.at>8000)return;if(seOff())return;if(!unlocked&&!gm())return;try{const a=new Audio(se.src);a.volume=volSe;a.play().catch(()=>{})}catch(e){}}
 function setVolume(kind,v){if(kind==='se'){volSe=v;try{localStorage.setItem('om_vol_se',v)}catch(e){}}else{vol=v;try{localStorage.setItem('om_vol',v)}catch(e){}if(audio)audio.volume=v;if(PV.audio)PV.audio.volume=v}}
 /* ----- 배너 / BGM / 상태 변화 ----- */
 function tickBanner(){const b=R().banner;if(!b||!b.at||b.at===lastBanner||Date.now()-b.at>15000)return;lastBanner=b.at;
  const el=document.createElement('div');el.className='banner';el.style.setProperty('--bc',b.color||'#d9243f');el.innerHTML=`<div class="bt">${esc(b.title||'')}</div>${b.text?`<div class="bm">${esc(b.text).replace(/\n/g,'<br>')}</div>`:''}`;
  /* 6초 안에 새 공지가 오면 앞 배너를 바로 치운다 (예전엔 앞 배너의 타이머만 지워서 영영 남았다 · 점검 3-13) */
  document.querySelectorAll('body > .banner').forEach(x=>x.remove());document.body.appendChild(el);
  clearTimeout(bannerT);bannerT=setTimeout(()=>el.remove(),6000)}
 const bgmOff=()=>!!(window.OM_PREFS&&window.OM_PREFS.get().bgmMute);
 function bgmMuted(on){if(on){if(audio){audio.pause();audio=null}lastBgm=''}else syncBgm(true)}
 function syncBgm(force){const b=R().bgm;const src=b&&b.src||'';
  if(bgmOff()){if(audio){audio.pause();audio=null}lastBgm='';return}   /* 내 설정에서 BGM 정지 */
  if(!src){if(audio){audio.pause();audio=null}lastBgm='';return}
  if(!unlocked)return;
  if(src!==lastBgm||force){if(audio)audio.pause();audio=new Audio(src);audio.loop=true;audio.volume=vol;audio.play().catch(()=>{});lastBgm=src}}
 function onChat(row){if(row.kind==='chat'&&row.data&&row.data.bat){autoSe(Object.assign({},row,{kind:row.data.bat}));return}if(row.kind==='chat'&&row.data&&row.data.sms){if(window.OM_PHONE_UI)window.OM_PHONE_UI.onSms(row);return}autoSe(row);feedLog([row]);if(row.kind==='chat'&&row.data){const nm=row.data.as||row.who;for(const k in TYPING.who)if(TYPING.who[k].from===row.data.from&&(!nm||TYPING.who[k].who===nm))delete TYPING.who[k];}if(A().view==='rp'&&row.kind==='chat'&&row.data&&row.data.ch!=='ooc'&&(row.data.t||row.data.clear))A().renderScene()}
 function onState(){tickBanner();syncBgm();syncSe()}
 /* 배틀 상단용 작은 BGM 위젯: 지금 곡 · 내 음량 · (GM) 다른 곡/BGM 창 · (플레이어) 소리 켜기 */
 function bgmWidgetHtml(){const now=R().bgm||{};const G=bgmGroups();return `<div class="bgmw"><span class="eq ${now.src?'':'off'} ${gm()?'lk':''}" ${gm()?'data-bw="open"':''}>♪</span><span class="bt ${gm()?'lk':''}" ${gm()?'data-bw="open"':''} title="${esc(now.title?(now.group?gshort(now.group)+' - ':'')+now.title:'재생 중인 곡 없음')}${gm()?' — 누르면 BGM 고르기':''}">${esc(now.title||'BGM 없음')}</span><input type="range" min="0" max="1" step="0.05" value="${vol}" data-bw="vol" title="내 음량">${!unlocked&&now.src?'<button class="btn xs pri" data-bw="sound" title="브라우저가 소리를 막아서 한 번 눌러야 들린다">소리 켜기</button>':''}${gm()?`${now.group&&G[now.group]?`<button class="btn xs ghost" data-bw="rand" title="같은 그룹에서 다른 곡">⟳</button>`:''}${now.src?'<button class="btn xs ghost" data-bw="stop" title="모두에게 정지">■</button>':''}<button class="btn xs" data-bw="open" title="BGM 고르기 (모두에게)">BGM</button>`:''}</div>`}
 function bindBgmWidget(root){root.querySelectorAll('[data-bw]').forEach(el=>{const k=el.dataset.bw;
  if(k==='vol'){el.oninput=()=>setVolume('bgm',+el.value);return}
  el.onclick=async()=>{if(k==='sound'){userMuted=false;unlocked=true;syncBgm(true);return A().renderScene()}if(k==='open')return quickBgm();
   if(k==='stop'){await A().set(['rp','bgm'],null);return}
   if(k==='rand'){const now=R().bgm||{};const G=bgmGroups();const ss=Object.keys(G[now.group]||{});if(!ss.length)return;let pick=ss[Math.floor(Math.random()*ss.length)];if(ss.length>1&&pick===now.title)pick=ss[(ss.indexOf(pick)+1)%ss.length];pvStop();await playAll(now.group,pick)}}})}
 /* ----- 아래 띠: 내 캐릭터 · 굴림(스킬 체크) · 폰 · 대화(장면 등장) · 소지 포켓몬 현황 ----- */
 function meTrainer(){const ST=A().ST;const T=(ST.state.roster||{}).trainers||{};if(ST.role==='seat')return T[ST.seat]||null;if(gm()){const c=speakerChar();if(c&&c.kind==='pc')return T[c.id]||null;if(c&&c.kind==='pm'){const m=((ST.state.roster||{}).mons||{})[c.id];return m?T[m.tid]||null:null}}return null}
 function meBarHtml(){const ST=A().ST;if(!ST.role)return '';const t=meTrainer();const K=window.OM_SKILL_UI;const k=t&&K?K.tsk(t.id):{};const O=K&&(ST.state.skill||{}).offer;const pend=K&&K.pending();
  const mons=t?Object.values((ST.state.roster||{}).mons||{}).filter(m=>m.tid===t.id):[];const bm=(ST.state.battle||{}).mons||{};
  const lastDice=[...(ST.log||[])].reverse().find(r=>r.kind==='dice');
  return `<div class="mebar">${t?`<div class="meid"><i class="ph-av" style="${t.image?`background-image:url('${cssu(t.image)}')`:''}"></i><div><b>${esc(t.name)}</b><small>${k.inj>=2?'<span class="bad">중상</span>':k.inj===1?'<span class="bad">부상</span>':'건강'}${k.tired&&k.tired.length?' · 지침 '+k.tired.length:''}${O&&(O.ids||[]).includes(t.id)?' · <span class="warn">체크 대기</span>':''}</small></div></div>`:`<div class="meid"><div><b>${gm()?'GM':esc(ST.name||'')}</b><small>${gm()?'화자로 PC 를 고르면 그 캐릭터가 여기 선다':'자리 없음'}</small></div></div>`}
   <div class="mebtns"><button class="btn sm ${pend?'pri':''}" data-rp="roll" title="스킬 체크 창">🎲 굴림${pend?' !':''}</button><button class="btn sm" data-rp="phone" title="휴대폰">📱 폰</button><button class="btn sm ghost" data-rp="talk" title="${t?t.name+' (으)로 말하기 — 무대에 선다':'대사 입력'}">💬 대화</button></div>
   <div class="memons">${mons.map(m=>{const b=bm[m.id];const hp=b?b.hp:m.hp;const pct=Math.max(0,Math.min(100,(hp.cur>0?Math.max(1,Math.round(hp.cur/hp.max*100)):0)));const tired=t&&K&&(K.tsk(t.id).tired||[]).includes(m.id);return `<div class="memon ${hp.cur<=0?'ko':''} ${tired?'tired':''}" data-rp="mon" data-mid="${m.id}" title="${esc(m.name)} HP ${hp.cur}/${hp.max}${b&&b.entry?' · 무대 '+String(b.entry).toUpperCase():''}${tired?' · 지침':''}"><i style="${m.image?`background-image:url('${cssu(m.image)}')`:''}"></i><div class="mhp ${pct<=25?'low':pct<=50?'mid':''}"><b style="width:${pct}%"></b></div><small>${esc(m.name)}</small></div>`}).join('')}</div>
   ${lastDice?`<div class="melast" title="${esc(lastDice.data.t||'')}">🎲 ${esc((lastDice.who||'')+' · '+String(lastDice.data.t||'').split('\n').slice(-2).join(' · '))}</div>`:''}</div>`}
 return {typingHtml,autoFolder,bgmMuted,seUrlOf:seUrl,render,allSpeakers,onChat,feedLog,onState,onTyping,typingPing,typingStop,drawTyping,mapData:mapS,openConsole,openStands,setMyStand,charOf,playSe,setVolume,bgmWidgetHtml,bindBgmWidget,imgOfKey:k=>{if(k==='gm')return gmImg();const c=charOf(k);return c?(c.img||standSrc(c)):''},curSpeaker:()=>{const ST=A().ST;const c=speakerChar();if(c)return {key:c.key,name:c.name,img:c.img||standSrc(c)};return gm()?{key:'gm',name:'GM',img:gmImg()}:{key:'me',name:ST.name||'',img:''}}};
})();
