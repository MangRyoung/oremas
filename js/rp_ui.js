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
 let rpFold=false,mapUnfold=false;/* 11-03 망령 「2번으로」: 휴대폰에서 지도가 열려 있으면 무대 버튼을 ⋯ 하나(와 지도 닫기)로 접는다. ⋯ 를 누르면 펼침, 지도를 닫으면 다시 접힘 상태로 */try{rpFold=!!localStorage.getItem('om_rpfold')}catch(e){}   // 무대 우상단 탭(배경·BGM·기록·지도·덱·휴대폰·표정) 접기 — 내 브라우저에만
 /* 무대 위 화자 자리: 로그를 차례로 먹여서 모두 같은 결과가 나온다 */
 const STAGE={slots:{left:null,center:null,right:null},last:{},active:null,seen:0};
 function R(){return A().ST.state.rp||{}}
 function gm(){return A().ST.role==='gm'}
 function bgmOk(){if(gm())return true;const ST=A().ST;const rp=ST.state.rp||{};return ST.role==='seat'&&rp.plBattle!==false&&rp.seatOwn!==true}
 /* GM(나레이션) 칩 · 로그 아바타 그림: rp.gmImg */
 const gmImg=()=>((A().ST.state.rp||{}).gmImg)||'';
 /* 10-26 망령: GM 닉네임마다 따로 쓰는 프로필 rp.gmProf[닉] = {img,stands,standActive,standScale}. 키 'gm' = 공용(rp.gmImg · rp.gmSt), 'gm@닉' = 그 닉 전용. 전용이 없는 닉은 공용을 쓴다 */
 const gmProfs=()=>((A().ST.state.rp||{}).gmProf)||{};
 const isGmK=k=>k==='gm'||(typeof k==='string'&&k.startsWith('gm@'));
 const gmKeyOf=n=>n&&gmProfs()[n]?'gm@'+n:'gm';
 const myGmKey=()=>gm()?gmKeyOf(A().ST.gmNick):'gm';
 const gmPath=k=>k&&k.startsWith('gm@')?['rp','gmProf',k.slice(3)]:['rp','gmSt'];
 const myGmImg=()=>{const c=charOf(myGmKey());return c&&c.img||''};
 /* 지도 그림: 방에서 올린 그림(rp.map.img) → 「무진」 기본(preset 'mujin') → 없음. 예전 방(그림 설정 없이 지도를 쓰던 방)은 그대로 무진 기본을 쓴다 */
 function mapImg(){const m=R().map||{};if(m.img&&m.img.src)return m.img;if(m.preset==='mujin')return MAP_IMG;if(m.preset==='none')return null;const legacy=!!(m.vis||m.party||m.routes||m.npcs||(m.locs&&m.locs.length));return legacy?MAP_IMG:null}
 function mapIsMujin(){const m=R().map||{};return !(m.img&&m.img.src)&&m.preset!=='none'&&mapImg()===MAP_IMG}
 function mapS(){const m=R().map||{};const locs=m.locs&&m.locs.length?m.locs:(mapIsMujin()?DEFAULT_LOCS:[]);return {locs,vis:m.vis||{},party:m.party||{n:0,vis:1},routes:m.routes||[],npcs:npcsEff(m.npcs||[]).L,ann:m.ann==null?1:m.ann,reveal:m.reveal==null?1:m.reveal,img:mapImg()}}
 /* 10-30 망령 「웹툴에도 인물 추가 기능 세션 노트랑 비슷하게 넣어서 보낼 수 있어야지」: 지도 인물 상태(감정 이모지 + 한 줄) — 노트 지도의 st={e,m,at} 와 같은 모양.
    GM 은 rp.map.npcs[].st 를 쓰고, 플레이어는 자기 트레이너와 같은 이름의 인물만 pub.<좌석>.mapSt 로 쓴다. 더 최근(at) 쪽이 보인다. 노트 지도와는 지도 연동(notes_link)이 주고받는다 */
 const MEMO=[['surprise','❗','놀람'],['question','❓','의문'],['angry','💢','화남'],['happy','🎵','기쁨'],['heart','💗','하트'],['sweat','💦','당황'],['sad','💧','슬픔'],['shy','☺️','부끄'],['think','💭','생각'],['idea','💡','번뜩'],['sigh','😮‍💨','한숨'],['sleepy','💤','졸림'],['sparkle','✨','반짝'],['fear','😱','오싹'],['nod','👍','끄덕'],['no','🙅','도리도리']];
 const emoOf=k=>(MEMO.find(x=>x[0]===k)||[])[1]||'';
 const trName=id=>{const ST=A().ST;const t=((ST.state.battle||{}).trainers||{})[id]||((ST.state.roster||{}).trainers||{})[id];return t&&t.name||''};
 const seatOfNpc=n=>{const pub=A().ST.state.pub||{};return n&&n.name?Object.keys(pub).find(id=>pub[id]&&pub[id].mapSt&&trName(id)===n.name)||'':''};
 function stRaw(n){let s=n&&n.st||null;const sid=seatOfNpc(n);const p=sid?A().ST.state.pub[sid].mapSt:null;if(p&&(+p.at||0)>(+(s&&s.at)||0))s=p;return s}
 const effSt=n=>{const s=stRaw(n);return s&&(s.e||s.m)?s:null};
 window.OM_MAP_ST=stRaw;
 const myNpc=n=>A().ST.role==='seat'&&!!(n&&n.name)&&trName(A().ST.seat)===n.name;
 /* 10-31 망령 「웹툴 · 세션 노트 둘 다 지도에 PL 도 자기 권한 있는 캐릭터를 배치 · 이동 · 빼기」: 플레이어는 방 상태 중 pub.<좌석> 만 쓸 수 있어서
    자리 = pub.<좌석>.mapPos {n(장소 번호, 0 = 뺌), at}. 보일 때는 rp.map.npcs 와 합친다 — 그 좌석 트레이너와 같은 이름의 인물 자리를 더 최근(at) 쪽으로,
    지도에 없으면 그 트레이너 얼굴을 새로 세운다. GM 이 옮기면 npc.at 이 새로 붙어 GM 쪽이 이긴다.
    GM 화면이 열려 있으면 합친 결과를 rp.map.npcs 에 굳히고 pub 값은 비운다 → 지도 연동(notes_link)으로 노트 지도에도 넘어간다 */
 function npcsEff(raw){const ST=A().ST;const pub=ST.state.pub||{};const L=raw.slice();const used=[];
  for(const sid of Object.keys(pub)){const mp=pub[sid]&&pub[sid].mapPos;if(!mp||!mp.at)continue;const nm=trName(sid);if(!nm)continue;used.push(sid);
   const i=L.findIndex(x=>x&&x.name===nm);
   if(i>=0){if(+mp.at<=(+L[i].at||0))continue;if(+mp.n>0)L[i]=Object.assign({},L[i],{n:+mp.n,at:+mp.at,fx:mp.fx!=null?+mp.fx:null,fy:mp.fy!=null?+mp.fy:null});else L.splice(i,1)}
   else if(+mp.n>0){const t=((ST.state.roster||{}).trainers||{})[sid]||((ST.state.battle||{}).trainers||{})[sid]||{};L.push(Object.assign({id:'seat:'+sid,name:nm,img:t.image||'',n:+mp.n,size:'s',vis:1,at:+mp.at},mp.fx!=null?{fx:+mp.fx,fy:+mp.fy}:{}))}}
  return {L,used}}
 const MAPBAKE={busy:false};
 async function mapBake(){if(!gm()||MAPBAKE.busy)return;const m=R().map||{};const E=npcsEff(m.npcs||[]);if(!E.used.length)return;MAPBAKE.busy=true;
  try{await A().set(['rp','map'],Object.assign({},R().map||{},{npcs:E.L}));for(const sid of E.used)await A().set(['pub',sid,'mapPos'],null)}catch(e){console.warn('mapBake',e)}finally{MAPBAKE.busy=false}}
 async function myMapPos(n,fx,fy){const ST=A().ST;if(ST.role!=='seat'||!ST.seat)return;await A().set(['pub',ST.seat,'mapPos'],Object.assign({n:+n||0,at:Date.now()},fx!=null?{fx,fy}:{}));if(fx!=null)return;const l=mapS().locs.find(x=>x.n===+n);A().toast(+n?`${trName(ST.seat)} → ${n}. ${(l||{}).name||''}`:`${trName(ST.seat)} — 지도에서 뺐다`)}
 const myOnMap=()=>{const nm=A().ST.role==='seat'?trName(A().ST.seat):'';return nm?mapS().npcs.find(x=>x.name===nm)||null:null};
 /* 플레이어: 내 캐릭터를 놓을 장소 고르기 (가린 장소는 빼고) */
 function myPlacePick(){const M=mapS();const me=myOnMap();const nm=trName(A().ST.seat);const L=M.locs.filter(l=>M.vis[l.n]!=1);if(!L.length)return A().toast('놓을 수 있는 장소가 아직 없다');
  const md=A().openModal(`<div class="mhead"><h2>📍 ${esc(nm||'내 캐릭터')} 놓기</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="small dim" style="margin-bottom:6px">${me?`지금 ${me.n}. ${esc((M.locs.find(l=>l.n===me.n)||{}).name||'')} — 다른 장소를 누르면 옮겨진다`:'누른 장소에 내 캐릭터 얼굴이 선다'}</div>
   <div class="lgrid">${L.map(l=>`<button class="lb ${me&&l.n===me.n?'cur':''}" data-myp="${l.n}"><span class="no">${l.n}</span>${esc(l.name)}</button>`).join('')}</div>
   ${me?'<div class="row" style="margin-top:10px"><span class="sp"></span><button class="btn sm ghost danger" data-myp="0">지도에서 빼기</button></div>':''}`);
  md.querySelectorAll('[data-myp]').forEach(b=>b.onclick=async()=>{A().closeModal();await myMapPos(+b.dataset.myp)})}
 const npKey=(n,i)=>n.id||('#'+i);
 const npFind=key=>{const L=mapS().npcs;return L.find((x,i)=>npKey(x,i)===key)};
 const stBub=st=>st?`<b class="mnst">${st.e?`<span>${emoOf(st.e)}</span>`:''}${st.m?esc(st.m):''}</b>`:'';
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
  if(key==='gm'){const g=R().gmSt||{};return {key,name:'GM',img:gmImg(),stands:g.stands||[],active:g.standActive||0,scale:g.standScale||0,kind:'gm',id:'gm'}}
  if(key.startsWith('gm@')){const n=key.slice(3);const g=gmProfs()[n];if(!g)return charOf('gm');return {key,name:'GM · '+n,img:g.img||'',stands:g.stands||[],active:g.standActive||0,scale:g.standScale||0,kind:'gm',id:key,nick:n}}
  if(key.startsWith('pm:')){const mid=key.slice(3);const m=((ST.state.roster||{}).mons||{})[mid];if(!m)return null;return {key,name:m.name,img:m.image||'',stands:m.stands||[],active:m.standActive||0,scale:m.standScale||0,kind:'pm',id:mid,tid:m.tid}}
  if(key.startsWith('as:')){const t=Object.values((ST.state.roster||{}).trainers||{}).find(x=>x.name===key.slice(3));return t?charOf(t.id):null}
  if(key.startsWith('npc:')){const name=key.slice(4);const n=Object.values((ST.state.graph||{}).nodes||{}).find(x=>x.name===name);return n?{key,name:n.name,img:A().portraitOf(n.name,n.img),stands:n.stands||[],active:n.standActive||0,scale:n.standScale||0,kind:'npc',id:n.id}:{key,name,img:A().portraitOf(name,''),stands:[],active:0,kind:'npc',id:''}}
  const t=((ST.state.roster||{}).trainers||{})[key];if(!t)return null;return {key,name:t.name,img:t.image,stands:t.stands||[],active:t.standActive||0,scale:t.standScale||0,kind:'pc',id:key}}
 function standSrc(c){if(!c)return '';const s=(c.stands||[])[c.active]||(c.stands||[])[0];return (s&&s.src)||c.img||''}
 function standKind(c){if(!c)return '';const st=(c.stands||[])[c.active]||(c.stands||[])[0];return st&&st.kind?st.kind:''}
 /* 10-27 망령: 방 설정 「상반신」 — 허리 높이(그림 맨 위에서 %). 그림마다 waist 로 따로 */
 function standWaist(c){const sc=R().standCrop||{};if(sc.mode!=='bust')return 0;const s=(c.stands||[])[c.active]||(c.stands||[])[0];return Math.max(30,Math.min(80,+(s&&s.waist)||+sc.waist||52))}
 function standPoint(c){const s=(c.stands||[])[c.active]||(c.stands||[])[0];return s&&+s.point||0}
 function speakerKey(row){const d=row.data||{};if(d.k&&d.k!=='me'){const c=charOf(d.k);if(c&&c.key)return c.key}   /* 10-25 망령: 고른 화자 키(d.k)가 먼저 — 포켓몬 · 별명으로 말하면 이름으로 찾다가 관계도 인물로 잘못 잡아 초상이 섰다 */
  if(d.as){const t=Object.values((A().ST.state.roster||{}).trainers||{}).find(x=>x.name===d.as);return t?t.id:'npc:'+d.as}if(d.from&&d.from!=='gm')return d.from;if(d.from==='gm'){const gk=gmKeyOf(d.gmn);return ((charOf(gk)||{}).stands||[]).length?gk:''}return ''}
 /* 화자 자리: 첫 화자는 가운데, 다음 화자는 왼쪽·오른쪽을 채운다. 마지막 대사 뒤 STAND_TTL 이 지나면 사라진다 (로그 시각 기준이라 모두 같은 결과) */
 const STAND_TTL=40000;let EXP_T=0;
 function feedLog(rows){for(const r of rows){if(r.id<=STAGE.seen)continue;STAGE.seen=r.id;if(r.kind!=='chat')continue;const d=r.data||{};if(d.sms||d.bat||d.ch==='ooc')continue;const at=Date.parse(r.at)||Date.now();
   if(d.clear){STAGE.slots={left:null,center:null,right:null};STAGE.active=null;continue}
   const k=speakerKey(r);if(!k||!d.t)continue;if(isGmK(k)&&window.OM_LINE&&window.OM_LINE(d).narr)continue;expire(at);STAGE.last[k]=at;STAGE.active=k;
   if(Object.values(STAGE.slots).includes(k))continue;
   const DS=!!R().dsplit;const free=(DS?['left','right']:['center','left','right']).find(s=>!STAGE.slots[s]);if(free){STAGE.slots[free]=k;continue}   /* 11-02 좌우 분리: 가운데 자리는 안 쓴다 */
   const oldest=(DS?['left','right']:SLOTS).slice().sort((a,b)=>(STAGE.last[STAGE.slots[a]]||0)-(STAGE.last[STAGE.slots[b]]||0))[0];STAGE.slots[oldest]=k}}
 /* 대사 없이 무대에 올린다 (감정 연출 「!한숨」 등) — 대사가 들어온 것처럼 빈 자리 · 가장 오래된 자리에 */
 /* opt.brief(ms): 대사 없는 감정 연출 — 새로 올린 인물은 그만큼만 섰다가 내려간다 (10-26 망령: 애니메이션은 금방 끝나는데 스탠딩이 한참 남았다). 이미 서 있던 인물은 시간을 건드리지 않는다 */
 function stageEnter(k,opt){if(!k)return;opt=opt||{};const now=Date.now();expire(now);const was=Object.values(STAGE.slots).includes(k);if(opt.brief){if(!was)STAGE.last[k]=now-STAND_TTL+opt.brief}else STAGE.last[k]=now;STAGE.active=k;if(!was){const DS=!!R().dsplit;const free=(DS?['left','right']:['center','left','right']).find(s=>!STAGE.slots[s]);if(free)STAGE.slots[free]=k;else{const oldest=(DS?['left','right']:SLOTS).slice().sort((a,b)=>(STAGE.last[STAGE.slots[a]]||0)-(STAGE.last[STAGE.slots[b]]||0))[0];STAGE.slots[oldest]=k}}if(A().view==='rp')A().renderScene()}
 function expire(now){now=now||Date.now();for(const s of SLOTS){const k=STAGE.slots[s];if(k&&now-(STAGE.last[k]||0)>STAND_TTL){STAGE.slots[s]=null;if(STAGE.active===k)STAGE.active=null}}}
 let expT=null;
 function scheduleExpire(){clearTimeout(expT);const keys=Object.values(STAGE.slots).filter(Boolean);if(!keys.length)return;const next=Math.min(...keys.map(k=>(STAGE.last[k]||0)+STAND_TTL))-Date.now();expT=setTimeout(()=>{if(A().view==='rp')A().renderScene()},Math.max(200,next+50))}
 /* ----- 대사 큐 + 타자기 (10-23 벨벳 참고) -----
    빠르게 여러 줄이 올라와도 무대 대사 상자는 한 줄씩: 한 글자씩 찍고 → 잠깐 머물렀다 → 다음 줄. 들어올 때 이미 있던 줄은 연출 없이 마지막 줄만.
    줄이 쌓이면 빨리 넘기고(3줄 이상), 아주 많이 쌓이면(8줄 이상) 마지막 3줄만 남긴다. 대사 상자를 누르면 다 찍기 → 한 번 더 누르면 다음 줄.
    설정은 「내 설정 › 대사 연출」(om_prefs tw · twSpeed · twHold · twFast) — 이 브라우저에서만 */
 const DQ={init:false,seen:0,q:[],cur:null,phase:'done',t:null,cut:0,arr:{}};
 const TW_MS=[70,50,35,22,12];
 function twCfg(){const p=(window.OM_PREFS&&window.OM_PREFS.get())||{};return {on:p.tw==null?1:+p.tw,ms:TW_MS[Math.max(0,Math.min(4,(+p.twSpeed||3)-1))],hold:(p.twHold==null?1.5:+p.twHold)*1000,fast:p.twFast==null?1:+p.twFast}}
 const dqOk=(x,cut)=>x.id>cut&&x.kind==='chat'&&x.data&&x.data.t&&!x.data.sms&&!x.data.bat&&x.data.ch!=='ooc';
 /* 새 줄을 큐에 넣는다. 처음(방에 들어올 때)과 1분 넘게 지난 줄은 연출 없이 지나간다 */
 function dqFeed(rows,cut){if(DQ.cut!==cut){DQ.cut=cut;DQ.q=DQ.q.filter(x=>x.id>cut);if(DQ.cur&&DQ.cur.id<=cut){DQ.cur=null;DQ.phase='done'}}
  const fresh=rows.filter(x=>x.id>DQ.seen);if(!fresh.length)return;DQ.seen=Math.max(DQ.seen,...fresh.map(x=>x.id));
  const cand=fresh.filter(x=>dqOk(x,cut));if(!DQ.init){DQ.init=true;return}
  /* 방금 실시간으로 온 줄만 찍는다: 받은 시각(onChat)이 8초 안 · 받은 시각이 없으면 줄 시각이 20초 안. 다른 화면에 있다 돌아오면 밀린 줄은 연출 없이 */
  const now=Date.now(),live=r=>{const a=DQ.arr[r.id];return a?now-a<8000:Math.abs(now-(Date.parse(r.at)||now))<20000};
  const c=twCfg();for(const r of cand){if(!c.on||!live(r)){DQ.q=[];clearTimeout(DQ.t);DQ.cur=r;DQ.phase='done';continue}DQ.q.push(r)}
  if(DQ.q.length>=8){DQ.q=DQ.q.slice(-3)}
  if(DQ.q.length&&DQ.phase==='done'){DQ.cur=DQ.q.shift();DQ.phase='typing'}}
 /* 지금 무대에 올릴 줄: 큐가 돌고 있으면 그 줄, 아니면 null (예전처럼 마지막 줄) */
 function dqRow(){return DQ.cur&&DQ.phase!=='done'?DQ.cur:null}
 function dqNext(){clearTimeout(DQ.t);if(DQ.q.length){DQ.cur=DQ.q.shift();DQ.phase='typing'}else DQ.phase='done';if(A().view==='rp')A().renderScene()}
 /* 대사 상자의 글자를 찍는다. 아직 안 찍은 글자는 투명하게 자리를 잡아 두어서 상자 크기가 흔들리지 않는다 */
 function dqType(dlg){const on=dlg.querySelector('.tw-on'),off=dlg.querySelector('.tw-off');if(!on||!off)return;clearTimeout(DQ.t);
  const c=twCfg();const busy=c.fast&&DQ.q.length>=3;const ms=busy?Math.max(6,c.ms/2.5):c.ms;const hold=busy?Math.min(c.hold,600):c.hold;
  const step=()=>{if(!off.isConnected)return;const rest=off.textContent;if(!rest){DQ.phase='hold';dlg.classList.remove('twing');DQ.t=setTimeout(dqNext,hold);return}
   const ch=Array.from(rest)[0];on.textContent+=ch;off.textContent=rest.slice(ch.length);DQ.t=setTimeout(step,/[.!?…。,，、~]/.test(ch)?ms*4:ms)};
  dlg.classList.add('twing');step()}
 /* 말풍선 칸에 대사가 넘치면(긴 대사·띄어쓰기 없는 긴 말) 글자를 조금씩 줄여 칸 안에 다 들어가게 — 최소 50%.
    타자 중엔 남은 글자가 자리만 차지하고 있어서(.tw-off) 처음 그릴 때 한 번 맞추면 끝까지 그대로다 */
 function fitDlg(dlg){const t=dlg.querySelector('.dtext');if(!t||dlg.style.display==='none')return;const sig=dlg.dataset.k+'|'+dlg.className.replace(/\b(pop|twing|dqable)\b/g,'')+'|'+dlg.clientWidth+'x'+dlg.clientHeight;if(dlg._fit===sig)return;dlg._fit=sig;
  t.style.removeProperty('--fit');let f=1;   /* 10-24 망령: 기본 검은 띠도 (휴대폰에서 높이가 막혀 있어) 넘치면 줄인다 */
  while(f>.5&&(t.scrollHeight>t.clientHeight+1||t.scrollWidth>t.clientWidth+1)){f=Math.round((f-.05)*100)/100;t.style.setProperty('--fit',f)}
  /* 10-30 망령 「폰트 화질이 자글거린다」: 기울인 말풍선 글자 칸이 스크롤 칸(overflow:auto)이면 브라우저가 글자를 그림으로 한 번 찍은 뒤 돌려서 계단이 진다.
     평소엔 스크롤 칸이 아니게(overflow:hidden) 두고, 50% 까지 줄여도 넘칠 때만 .ovf 로 스크롤을 켠다 */
  t.classList.toggle('ovf',t.scrollHeight>t.clientHeight+1)}
 addEventListener('resize',()=>{const d=document.getElementById('dlg');if(d&&d.isConnected)fitDlg(d)});
 function dqSkip(dlg){if(DQ.phase==='typing'){const on=dlg.querySelector('.tw-on'),off=dlg.querySelector('.tw-off');if(on&&off){on.textContent+=off.textContent;off.textContent=''}clearTimeout(DQ.t);dlg.classList.remove('twing');DQ.phase='hold';DQ.t=setTimeout(dqNext,Math.min(twCfg().hold,900))}else if(DQ.phase==='hold')dqNext()}

 /* 11-03 감우 (검토 20-1): 배경 크로스페이드 — .rpstage 의 background-image 는 transition 이 안 먹는다(--stbg 교체).
    배경이 바뀌면 이전 그림을 .stbgold 한 장으로 덧대어 0.5초 동안 투명하게(씬 프리셋 · 장소 배경 · 지도 배경 모두 rp.bg 로 오니 한 길). 무대를 새로 그린 첫 번째는 페이드 없이.
    10-24 망령: VELVET 테마(P3·P4·P5)의 .rpstage{background:…!important} 가 그림을 덮어 배경이 안 보였다 — 변수 + hasbg 로 테마보다 앞에 깐다 (css/vtheme.css 끝). 변수 속 상대 주소는 css/ 기준으로 풀리니 절대 주소로 */
 function setStageBg(stage,src){let au='';if(src){au=src;try{au=new URL(src,location.href).href}catch(e){}}
  const prev=stage._bg===undefined?null:stage._bg;stage._bg=au;
  stage.style.backgroundImage=au?`url('${cssu(au)}')`:'';if(au)stage.style.setProperty('--stbg',`url('${cssu(au)}')`);else stage.style.removeProperty('--stbg');stage.classList.toggle('hasbg',!!au);
  if(prev===null||prev===au)return;
  let old=stage.querySelector(':scope>.stbgold');if(!old){old=document.createElement('div');old.className='stbgold';stage.prepend(old)}
  old.style.backgroundImage=prev?`url('${cssu(prev)}')`:'';clearTimeout(old._t);old.classList.remove('fade');void old.offsetWidth;old.classList.add('fade');old._t=setTimeout(()=>old.remove(),560)}
 /* ----- 무대 ----- */
 function render(el){
  feedLog(A().ST.log||[]);expire();if(gm())mapBake();
  const r=R();const bg=r.bg||{};const cap=r.caption||{};const manual=r.stage||{};
  const slots={};for(const s of SLOTS){const m=manual[s];slots[s]=m&&m.key?m.key:STAGE.slots[s]}
  const cutId=+((A().ST.state.rp||{}).logClearAt)||0;dqFeed(A().ST.log||[],cutId);const qRow=dqRow();const lastChat=qRow||[...(A().ST.log||[])].reverse().find(x=>dqOk(x,cutId));const anim=!!qRow&&DQ.phase==='typing';
  const LF=window.OM_LINE||(d=>({narr:false,text:String(d.t||''),q:true}));
  /* 10-26 망령: 세 자리를 모두 고정해 두면 자리에 없는 사람이 말해도 스탠딩이 안 섰다 — 그 사람이 말하는 동안만 가운데에 잠깐 끼어든다 */
  {const sk0=lastChat&&!LF(lastChat.data||{}).narr?speakerKey(lastChat):'';if(sk0&&!isGmK(sk0)&&!SLOTS.some(x=>slots[x]===sk0)&&SLOTS.every(x=>manual[x]&&manual[x].key))slots.center=sk0}
  /* 11-02 망령 「좌우 분리 했을 때도 가운데가 여전히 나온다」: 이 모드에선 가운데 자리를 아예 비운다 — 가운데 사람은 빈 쪽으로,
     양쪽이 다 차 있으면 말하는 사람이면 양쪽 중 오래 말 안 한 쪽을 대신하고, 말하는 사람이 아니면 내려간다 (좁은 화면 · 던전은 그대로) */
  if(r.dsplit&&!(window.OM_DG_UI&&window.OM_DG_UI.cur&&window.OM_DG_UI.cur())&&innerWidth>=761&&slots.center){const c=slots.center;slots.center=null;
   const spk=lastChat&&!LF(lastChat.data||{}).narr?speakerKey(lastChat):'';
   if(!slots.left)slots.left=c;else if(!slots.right)slots.right=c;else if(c===spk){const v=['left','right'].filter(x=>slots[x]!==spk).sort((a,b)=>(STAGE.last[slots[a]]||0)-(STAGE.last[slots[b]]||0))[0];if(v)slots[v]=c}}
  const line=(name,d,tw)=>{const f=LF(d);const tx=f.narr?esc(f.text):(f.q?esc(f.text.trim()):'"'+esc(f.text)+'"');return `<div class="dname"><span>${esc(name)}</span></div><div class="dtext ${f.narr?'narr':''}">${tw?`<span class="tw-on"></span><span class="tw-off">${tx}</span>`:tx}</div>`};
  /* 10-23 망령: 무대를 비웠거나(clear 줄) 말한 인물이 무대에서 사라졌으면 대사 상자도 내린다 (지문은 그대로) */
  const clearAfter=!!lastChat&&(A().ST.log||[]).some(x=>x.id>lastChat.id&&x.kind==='chat'&&x.data&&x.data.clear);
  const lk=lastChat?speakerKey(lastChat):'';const gone=!qRow&&!!lk&&!LF(lastChat.data||{}).narr&&!Object.values(slots).includes(lk)&&!Object.values(STAGE.slots).includes(lk);
  /* 10-24 망령: 스탠딩이 시간이 다 돼 내려가면 대사 상자도 같이 내린다 (예전엔 2배 시간 동안 대사만 남았다) — 다음 만료 때 다시 그린다 */
  const showDlg=cap.text||(lastChat&&!clearAfter&&!gone&&(DQ.phase!=='done'||Date.now()-(Date.parse(lastChat.at)||0)<STAND_TTL));
  {clearTimeout(EXP_T);const now=Date.now();let nx=Infinity;for(const s of SLOTS){const k=STAGE.slots[s];if(k)nx=Math.min(nx,(STAGE.last[k]||0)+STAND_TTL-now)}if(lastChat)nx=Math.min(nx,(Date.parse(lastChat.at)||0)+STAND_TTL-now);if(nx<Infinity&&nx>-1000)EXP_T=setTimeout(()=>{if(A().view==='rp')A().renderScene()},Math.max(200,nx+80))}
  const dnm=showDlg&&!cap.text?(lastChat.data.as||(charOf(speakerKey(lastChat))||{}).name||lastChat.who):'';
  const dlgHtml=cap.text?line(cap.name||'',{t:cap.text}):(showDlg?line(dnm,lastChat.data,anim):'');
  /* 열쇠는 타자 span 을 뺀 모양으로 — 타자가 끝나 평문으로 바뀔 때 상자를 다시 그려 「한 번 더 튀는」 일이 없게 */
  const dlgKey=cap.text?'cap|'+dlgHtml:(showDlg?'r'+lastChat.id+'|'+line(dnm,lastChat.data,false):'');
  const ST=A().ST;const speakers=gm()?allSpeakers():(ST.seat?[{key:'me',name:(charOf(ST.seat)||{}).name||ST.name},...Object.values((ST.state.roster||{}).mons||{}).filter(m=>m.tid===ST.seat).map(m=>({key:'pm:'+m.id,name:m.name+' (포켓몬)'}))]:[]);
  if(gm()&&!SPK.key)SPK.key='gm';if(!gm()&&(!SPK.key||SPK.key==='gm'))SPK.key='me';
  /* 뼈대는 한 번만 — 스탠딩이 매번 다시 그려져 애니메이션이 되풀이되지 않게 */
  let stage=$('#rpstage',el);
  if(!stage){el.innerHTML=`<div class="rpwrap"><div class="rpstage" id="rpstage"><div class="stands" id="stands"></div><div class="dlg" id="dlg"></div><div class="typing" id="typing"></div><div id="bgname"></div><div id="centerimg"></div><div class="rpbtns" id="rpbtns"></div><div id="mapov"></div><div id="voteov"></div></div><div id="rpunder"></div></div>`;stage=$('#rpstage',el)}
  setStageBg(stage,bg.src||'');
  const cal=ST.state.calendar||{};/* 10-24 망령: 캘린더 「RP 에 날짜 표기」 — 켜면 오늘(정한 날이 없으면 실제 날짜)을 배경명 위에, 끄면 숨김. 안 정했으면 예전처럼 날짜를 정했을 때만 */const tdy=cal.rpDate===0?'':(cal.today||(cal.rpDate?(()=>{const n=new Date();return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0')})():''));const dt=tdy?(()=>{const d=new Date(tdy+'T00:00:00');return {md:tdy.slice(5).replace('-','/'),wd:['일','월','화','수','목','금','토'][d.getDay()]}})():null;
  $('#bgname',el).innerHTML=`<div class="stagetags">${dt?`<div class="daytag" ${gm()?'data-rp="phase" title="눌러서 시간대 바꾸기"':''}><b>${esc(dt.md)}</b><i>${dt.wd}</i>${cal.weather?`<em>${esc(cal.weather)}</em>`:''}${cal.phase?`<span class="phase ${({아침:'morning',저녁:'evening',밤:'night',심야:'night'})[cal.phase]||''}">${esc(cal.phase)}</span>`:''}</div>`:''}${bg.name?`<div class="bgname">${esc(bg.name)}</div>`:''}${(()=>{const CU=window.OM_CAL_UI;const nx=CU&&CU.next&&cal.today?CU.next(cal,14):null;return nx?`<div class="ddaytag ${nx.n===0?'on':''}" data-rp="calview" title="${esc(nx.date)} ${esc(nx.t)} — 눌러서 캘린더">${CU.ddL(nx.n)}<span>${esc(nx.t)}</span></div>`:''})()}</div>`;
  $('#centerimg',el).innerHTML=r.center&&r.center.src?`<div class="centerimg"><img src="${esc(r.center.src)}" alt="">${gm()?'<button class="btn xs" data-rp="centerx">닫기</button>':''}</div>`:'';
  /* 11-03 13:46 망령 「BGM 이랑 GM 콘솔이 오른쪽 스탠딩을 가린다 — 채팅창 위 여백으로」 · 14:01 「여기에 배경 · 씬 · 지도 · 단서, 나머지는 더보기」:
     넓은 화면은 무대 위 버튼 줄 대신 채팅창 머리 한 줄(psSync)에 — 왼쪽 배경 · 씬 · 지도 · 단서 · ⋯ 더보기(투표 · 기록 · 덱 · 휴대폰), 오른쪽 BGM · GM 콘솔. 모바일은 예전처럼 무대 위 */
  const PSLOT=innerWidth>760&&!!document.querySelector('.side .phone .ptitle .plogs');const RPX=`<span class="rpbgmw">${bgmWidgetHtml()}</span>${gm()?`<button class="btn sm pri" data-rp="gm">GM 콘솔</button>`:''}`;
  const PSX=PSLOT?`<span class="prpl">${gm()?`<button class="btn xs ghost plog" data-rp="qbg" title="배경 바꾸기">🖼<span class="prl"> 배경</span></button><button class="btn xs ghost plog" data-rp="scene" title="씬 프리셋 — 배경 · BGM · 자리 · 자막을 한 번에">🎬<span class="prl"> 씬</span></button>`:''}<button class="btn xs ghost plog ${mapOpen?'on':''}" data-rp="map" title="${mapOpen?'지도 닫기':'지도 열기'}">🗺<span class="prl"> 지도</span></button><button class="btn xs ghost plog" data-rp="cluebox" title="받은 단서 목록">🔍<span class="prl"> 단서</span></button><span class="prpmw"><button class="btn xs ghost plog" data-prpmore title="투표 · 기록 · 덱 · 휴대폰">⋯<span class="prl"> 더보기</span></button><span class="prpmore">${gm()?'<button class="btn xs ghost plog" data-rp="vote">🗳 투표</button>':''}<button class="btn xs ghost plog" data-rp="log">📜 기록</button><button class="btn xs ghost plog" data-rp="deck">🃏 덱</button><button class="btn xs ghost plog" data-rp="phone">📱 휴대폰</button></span></span></span><span class="prpr"><span class="rpbgmw">${bgmWidgetHtml()}</span>${gm()?'<button class="btn xs ghost plog" data-rp="gm"><span class="pl2">GM </span>콘솔</button>':''}</span>`:'';
  if(!mapOpen)mapUnfold=false;$('#rpbtns',el).classList.toggle('fold',rpFold);$('#rpbtns',el).classList.toggle('mapon',!!mapOpen);$('#rpbtns',el).classList.toggle('mfold',!!mapOpen&&!mapUnfold);$('#rpbtns',el).innerHTML=`<span id="typingRp" class="typingslot ${TYPING_HTML?'on':''}">${TYPING_HTML}</span><button class="btn sm rpmfb" data-rp="mfold" title="${mapUnfold?'버튼 접기':'무대 버튼 펼치기'}">${mapUnfold?'▴ 접기':'⋯'}</button><button class="btn sm rpspkbtn" data-rp="spkpop" title="화자 · 인물 · 표정">🎭 화자</button>${PSLOT?'':`<button class="btn sm rpfoldb" data-rp="fold" title="${rpFold?'탭 펼치기 (배경 · BGM · 기록 · 지도 …)':'탭 접기'}">${rpFold?'☰':'›'}</button>${gm()?`<button class="btn sm rpt" data-rp="qbg" title="배경 바꾸기">🖼 배경</button><button class="btn sm rpt" data-rp="scene" title="씬 프리셋 — 배경 · BGM · 자리 · 자막을 한 번에">🎬 씬</button><button class="btn sm rpt" data-rp="vote" title="투표 열기 — 파티 분기 · 작전 고르기">🗳 투표</button>`:''}<button class="btn sm rpt" data-rp="log" title="대화 기록">📜 기록</button><button class="btn sm rpt" data-rp="cluebox" title="받은 단서 목록">🔍 단서</button><button class="btn sm ${mapOpen?'pri':'rpt'}" data-rp="map">${mapOpen?'🗺 지도 닫기':'🗺 지도'}</button><button class="btn sm rpt" data-rp="deck" title="덱">🃏 덱</button><button class="btn sm rpt" data-rp="phone" title="휴대폰 — 연락처 · 협력자 · 캘린더">📱 휴대폰</button>${RPX}`}`;bindBgmWidget($('#rpbtns',el));$('#rpbtns',el).classList.toggle('pslot',PSLOT);psSync(PSLOT,PSX);   /* 10-24 망령: RP 도 배틀처럼 BGM 위젯 (곡 · 음량 · ⟳ · ■ · BGM) */
  $('#mapov',el).innerHTML=mapOpen?mapOverlay():'';drawVote(el);oocTick();
  /* 그림 말풍선 (rp.bubble) — 대사 전용: 말하는 사람이 왼쪽 자리면 꼬리 왼쪽 그림을 그 오른편에, 오른쪽이면 반대, 가운데·무대 밖이면 꼬리 왼쪽 그림을 화면 가운데 오른편에(mid).
     지문(비문)·고정 자막은 꼬리 없는 그림 — 그게 없으면 기본 검은 띠 */
  /* 11-02 망령 「스탠딩 일러 절반을 대사창이 가린다 — 모드를 켜면 대사 · 스탠딩을 좌우로 떼되 가운데를 비우고 서로 붙여서」:
     21:07 망령 「개인 보기 말고 방 토글로 — GM 줄 오른쪽 여백에」: 방 상태 rp.dsplit (GM 이 무대 아래 GM 줄 「◧ 좌우 분리」로 켜고 끔, 모두에게 같이).
     21:10 망령 「반반 나누지 말고 스탠딩 옆에 말풍선을 붙이는 정도 — 대신 이 모드에선 가운데 자리를 쓰지 말고 좌우를 조금 가깝게」:
     가운데 자리 스탠딩은 빈 쪽(왼쪽 먼저) 자리로 서고(ds-l · ds-r), 좌우 자리는 안쪽으로 조금. 말풍선은 말하는 스탠딩 그림 바로 옆에 (꼬리는 그 사람 쪽).
     좁은 화면(760px 미만) · 던전 탐사 중에는 쓰지 않는다 (CSS 도 막음) */
  const dsOn=!!r.dsplit&&!(window.OM_DG_UI&&window.OM_DG_UI.cur&&window.OM_DG_UI.cur());
  const dsSide=(()=>{const sk=!cap.text&&lastChat?speakerKey(lastChat):'';const sl=sk?SLOTS.find(x=>slots[x]===sk):'';return sl==='right'?'r':sl==='center'?(!slots.left?'l':!slots.right?'r':'l'):'l'})();
  {const stg0=$('#rpstage',el);if(stg0){stg0.classList.toggle('dsplit',dsOn);stg0.dataset.dside=dsSide}}
  const bub=r.bubble||{};let skin=null;if(bub.on&&dlgHtml){const narr=!!cap.text||!lastChat||LF(lastChat.data||{}).narr;
   /* 10-23 망령: 칸을 비우면 오레마스 기본 그림(img/bubble/*.svg — 직접 그린 것). 절대 주소로 — CSS 변수 안의 상대 주소는 css/ 기준으로 풀려 버린다 */
   const DEF=k=>new URL('img/bubble/'+({c:'plain',l:'left',m:'mid'})[k]+'.svg?v=3',location.href).href;
   if(narr){skin={v:'c',src:bub.c||DEF('c')};   /* 10-23 망령: 인물이 친 지문은 그 인물이 선 쪽으로 조금 붙는다 */
    const sk=!cap.text&&lastChat?speakerKey(lastChat):'';const sl=sk?SLOTS.find(x=>slots[x]===sk):'';if(sl==='left'||sl==='right')skin.side=sl[0]}
   else{const sk=speakerKey(lastChat);const sl=sk?SLOTS.find(x=>slots[x]===sk):'';const want=sl==='right'?'r':'l';const alt=want==='l'?'r':'l';
    /* 10-21 망령: 가운데(·무대 밖) 화자는 「꼬리 가운데」 그림이 있으면 그걸로 */
    /* 10-26 망령: 던전 탐사 중엔 HUD 때문에 좌우 대사칸이 좁아져 쓰기 어렵다 — 모두 가운데 대사칸 */const inDg=!!(window.OM_DG_UI&&window.OM_DG_UI.cur&&window.OM_DG_UI.cur());
    if(dsOn){const w2=dsSide;skin=bub[w2]?{v:w2,src:bub[w2]}:bub[w2==='l'?'r':'l']?{v:w2,src:bub[w2==='l'?'r':'l'],flip:1}:{v:w2,src:DEF('l'),flip:w2==='r'?1:0}}   /* 좌우 분리: 가운데 화자도 한쪽 꼬리 그림으로 */
    else if(inDg||(sl!=='left'&&sl!=='right')){skin={v:'m',src:bub.m||DEF('m')};if(inDg&&(sl==='left'||sl==='right'))skin.at=sl}   /* 10-26 망령: 던전에선 가운데 말풍선 그림을 쓰되 자리는 말하는 사람 위로 (skin.at → 아래에서 스탠딩 가운데에 맞춘다) */else if(bub[want])skin={v:want,src:bub[want]};else if(bub[alt])skin={v:want,src:bub[alt],flip:1};else skin={v:want,src:DEF('l'),flip:want==='r'?1:0};
    if(!dsOn&&skin.v!=='c'&&skin.v!=='m'&&sl!=='left'&&sl!=='right')skin.mid=1}}
  const dlg=$('#dlg',el);if(dlgHtml){if(dlg.dataset.k!==dlgKey){dlg.innerHTML=dlgHtml;dlg.dataset.k=dlgKey;dlg.classList.remove('pop');void dlg.offsetWidth;dlg.classList.add('pop');if(anim&&!cap.text)dqType(dlg)}dlg.style.display=''}else{dlg.style.display='none';dlg.dataset.k=''}
  {let mo=dlg.querySelector('.dq-more');const n=cap.text?0:DQ.q.length;if(n){if(!mo){mo=document.createElement('i');mo.className='dq-more';dlg.appendChild(mo)}mo.textContent=`+${n}줄`}else if(mo)mo.remove()}
  dlg.onclick=()=>{if(!cap.text)dqSkip(dlg)};dlg.classList.toggle('dqable',!cap.text&&DQ.phase!=='done');
  dlg.classList.toggle('skin',!!skin);for(const v of ['c','l','r','m'])dlg.classList.toggle('s'+v,!!skin&&skin.v===v);dlg.classList.toggle('flip',!!(skin&&skin.flip));dlg.classList.toggle('mid',!!(skin&&skin.mid));dlg.classList.toggle('nl',!!(skin&&skin.side==='l'));dlg.classList.toggle('nr',!!(skin&&skin.side==='r'));dlg.style.setProperty('--bub',skin?`url('${cssu(skin.src)}')`:'');bubStyle(dlg,stOf(bub.st));fitDlg(dlg);
  syncStands($('#stands',el),slots,manual);
  {const sb=$('#stands',el);if(sb){const hasL=!!slots.left,hasR=!!slots.right;sb.querySelectorAll('.stand.center').forEach(c=>{c.classList.toggle('ds-l',dsOn&&!hasL);c.classList.toggle('ds-r',dsOn&&hasL&&!hasR)})}}   /* 좌우 분리: 가운데 자리 → 빈 쪽 */
  try{if(window.OM_DG_UI)window.OM_DG_UI.rpSync($('#rpstage',el))}catch(e){console.warn('dungeon',e)}   /* 10-26: 던전 PT 칸 높이(--dlgh)가 rpSync 에서 정해진 뒤에 말풍선 자리를 잡는다 — 먼저 잡으면 PT 를 피하느라 왼쪽에 떴다가 다음 그리기에 오른쪽으로 튀었다 */
  {const sat=skin&&skin.at;const stg=$('#rpstage',el);const pos=()=>{const se=sat?$('#stands',el).querySelector('.stand.'+sat):null;if(se&&stg&&dlgHtml&&se.offsetWidth){const W=stg.clientWidth,w=dlg.offsetWidth||W*.42;const cx=se.offsetLeft+se.offsetWidth/2;/* 왼쪽 HUD · 오른쪽 지도/PT 와 겹치는 높이면 그 사이로만 (이름표가 HUD 밑에 깔리던 것) */let lo=W*.01,hi=W*.99;const sr=stg.getBoundingClientRect(),dr=dlg.getBoundingClientRect();const vo=e=>{if(!e||!e.offsetWidth)return null;/* HUD 는 칸이 넘쳐 자식이 바깥으로 나오니 자식들까지 합쳐 본다 · 이름표가 상자 위로 솟으니 위로 40px 더 */let L=1e9,R=-1e9,T=1e9,B=-1e9;for(const x of [e,...e.children]){if(!x.offsetWidth)continue;const q=x.getBoundingClientRect();L=Math.min(L,q.left);R=Math.max(R,q.right);T=Math.min(T,q.top);B=Math.max(B,q.bottom)}return B>dr.top-18&&T<dr.bottom?{left:L,right:R}:null};const hr=vo(stg.querySelector(':scope>.dgrp-hud')),kr=vo(stg.querySelector(':scope>.dgrp-dock'));if(hr)lo=Math.max(lo,hr.right-sr.left+8);if(kr)hi=Math.min(hi,kr.left-sr.left-8);let x=cx-w/2;if(hi-lo>=w)x=Math.max(lo,Math.min(hi-w,x));else x=Math.max(W*.01,Math.min(W*.99-w,lo+(hi-lo-w)/2));dlg.style.left=Math.round(x)+'px';dlg.style.right='auto';return true}if(!sat){dlg.style.left='';dlg.style.right=''}return false};if(!pos()&&sat){setTimeout(pos,120);setTimeout(pos,500);const im=$('#stands',el).querySelector('.stand.'+sat+' img');if(im&&!im.complete)im.addEventListener('load',pos,{once:true})}}/* 10-26 망령: 말풍선이 말하는 쪽 얼굴을 가렸다(사진 액자 · 세로가 짧은 카드 그림 모두). ① 말풍선을 맨 아래로 ② 액자 · 카드는 말풍선 위에 세움(위 버튼 줄 밑까지, 모자라면 조금 줄여서) ③ 무대가 낮아 위에 설 자리가 없으면 그림은 바닥에, 말풍선은 그 옆에 */{const adj=()=>{const stg=$('#rpstage',el),sb=$('#stands',el);if(!stg||!sb)return;if(dlg.hasAttribute('data-adj')){dlg.style.bottom='';dlg.style.top='';if(dlg.getAttribute('data-adj')==='x'){dlg.style.left='';dlg.style.right=''}dlg.removeAttribute('data-adj')}sb.querySelectorAll('.stand[data-adj-b]').forEach(x=>{x.style.bottom='';x.removeAttribute('data-adj-b')});sb.querySelectorAll('.stand img[data-adj-h]').forEach(x=>{x.style.maxHeight='';x.removeAttribute('data-adj-h')});const sp=sb.querySelector('.stand.on.portrait')||sb.querySelector('.stand.on');if(!sp||!dlgHtml||dlg.style.display==='none'||!dlg.classList.contains('skin')||!dlg.offsetWidth)return;const im=sp.querySelector('img');if(!im)return;const S=stg.getBoundingClientRect();let D=dlg.getBoundingClientRect();let P=im.getBoundingClientRect();if(!P.height)return;/* 스탠딩은 크기를 절대 건드리지 않는다(832×1216 같은 전신 그림이 비율만 보고 카드로 몰려 줄어들었다) — 줄이고 올리는 건 사진 액자만 */const short=sp.classList.contains('portrait');const h0=P.height;const cur=parseFloat(getComputedStyle(sp).bottom)||0;const T0=(()=>{let t=S.top;for(const e of stg.querySelectorAll(':scope>#rpbtns,:scope>.rpbtns,:scope>.stagetags')){const q=e.getBoundingClientRect();if(q.height&&q.left<P.right&&q.right>P.left)t=Math.max(t,q.bottom)}return t})();const setH=h=>{h=Math.round(h);if(h<h0-1){im.style.maxHeight=h+'px';im.setAttribute('data-adj-h','1')}P=im.getBoundingClientRect()};const putBottom=y=>{sp.style.bottom=Math.round(cur+(P.bottom-y))+'px';sp.setAttribute('data-adj-b','1');P=im.getBoundingClientRect()};const face=()=>P.top+P.height*(short?.62:.32);const hit=()=>D.left<P.right-6&&D.right>P.left+6&&D.top<face()&&D.bottom>P.top+4;const under=()=>short&&P.top<T0-2;if(!hit()&&!under())return;dlg.style.top='auto';dlg.style.bottom='4px';dlg.setAttribute('data-adj','b');D=dlg.getBoundingClientRect();if(!hit()&&!under())return;if(short){const roomV=D.top-6-T0;if(roomV>=Math.min(h0,96)){setH(Math.min(h0,roomV));putBottom(D.top-6);return}setH(Math.min(h0,S.bottom-4-T0));putBottom(S.bottom-4)}const w=D.width,W=S.width,pl=P.left-S.left,pr=P.right-S.left,mid=(pl+pr)/2;const rx=pr+8,lx=pl-8-w;let x=null;if(mid<W/2){if(rx+w<=W-4)x=rx;else if(lx>=4)x=lx}else{if(lx>=4)x=lx;else if(rx+w<=W-4)x=rx}if(x==null)x=mid<W/2?W-4-w:4;dlg.style.left=Math.round(x)+'px';dlg.style.right='auto';dlg.setAttribute('data-adj','x')};adj();setTimeout(adj,160);setTimeout(adj,600)}try{emoTick(qRow||lastChat)}catch(e){console.warn('emo',e)}try{clueRp($('#rpstage',el))}catch(e){console.warn('clue',e)}
  /* 11-02 좌우 분리: 말풍선을 말하는 스탠딩 그림 바로 옆에 붙인다 (그림이 늦게 뜨면 다시) */
  if(dsOn&&dlgHtml){const place=()=>{const stg=$('#rpstage',el),sb=$('#stands',el);if(!stg||!sb||dlg.style.display==='none'||innerWidth<761)return;const sp=sb.querySelector('.stand.on:not(.out)');const im=sp&&sp.querySelector('img');if(!im||!im.offsetWidth)return;
    const sr=stg.getBoundingClientRect(),r=im.getBoundingClientRect(),W=stg.clientWidth,w=dlg.offsetWidth;if(!w)return;const ov=W*.015;const left=((r.left+r.right)/2-sr.left)<W/2;
    let x=left?r.right-sr.left-ov:r.left-sr.left+ov-w;x=Math.max(W*.01,Math.min(W*.99-w,x));dlg.style.left=Math.round(x)+'px';dlg.style.right='auto';dlg.setAttribute('data-ds','1')};
   place();setTimeout(place,160);const im=$('#stands',el).querySelector('.stand.on img');if(im&&!im.complete)im.addEventListener('load',place,{once:true})}
  else if(dlg.hasAttribute('data-ds')){dlg.removeAttribute('data-ds');if(!(skin&&skin.at)){dlg.style.left='';dlg.style.right=''}}
  /* 무대 아래: 칸마다 바뀐 것만 다시 그린다 — 대사 입력칸은 그대로 두어야 치는 중에 끊기지 않는다 (한글 조합·포커스 유지) */
  const barH=`${gm()?spkBarHtml(speakers):(speakers.length>1?`<div class="spkbar">${speakers.map(x=>{const c=x.key==='me'?charOf(ST.seat):charOf(x.key);const av=c?(standSrc(c)||c.img):'';return spkChip(x.key,x.name,av,SPK.key===x.key||(!SPK.key&&x.key==='me'))}).join('')}<button class="spk add" data-rp="spkedit" title="고른 인물의 표정·스탠딩"><i>✎</i><span>표정</span></button></div>`:'')}`;
  const MD=MODES[SPK.mode]||MODES.auto;
  const inH=speakers.length?`<div class="rpinput"><button type="button" class="spkpbtn" id="rpspk" title="누구로 말할지 — 눌러서 고르기 (찾기 · 배틀 중 · 최근 · 폴더)"></button><span id="rpexpbox" class="rpexpbox"></span>${window.OM_EMO?window.OM_EMO.btnHtml():''}<button type="button" class="btn rpmode m-${SPK.mode}" id="rpmode" title="${esc(MD.tip)} — 누르면 자동 → 대사 → 지문">${MD.lb}</button><input type="text" id="rpline" placeholder="${esc(MD.ph)}" autocomplete="off"><button class="btn pri" id="rpsend">보내기</button></div><div class="small dim rphint">${gm()?'그냥 치면 지문, "…" 「…」 로 감싸면 대사 · 고른 인물로 말하면 그 인물의 스탠딩이 선다 · 「@웃음 "대사"」처럼 @등록명으로 표정을 바꾸며 말한다':'그냥 치면 지문, "…" 「…」 로 감싸면 대사 · 스탠딩 그림이 아직 없으면 시트 그림(초상)으로 선다 — 「표정」에서 전신 그림을 넣고, 「@웃음 "대사"」로 표정을 바꾸며 말한다'}</div>`:'<div class="small dim rphint">자리에 앉으면 여기서 대사를 칠 수 있다</div>';
  const under=$('#rpunder',el);if(!$('#rpu_in',under)){under.innerHTML='<div id="rpu_bar"></div><div class="rpfabbg" id="rpu_fabbg"></div><div id="rpu_in"></div><div id="rpu_fold"></div><div id="rpu_me"></div>';bindSpkPop(under)}
  const setH=(id,h)=>{const bx=$('#'+id,under);if(bx._h===h)return false;bx.innerHTML=h;bx._h=h;return true};
  const hadFocus=!!(document.activeElement&&document.activeElement.id==='rpline');setH('rpu_bar',barH);const inNew=setH('rpu_in',inH);if(inNew&&hadFocus)SPK.focus=true;setH('rpu_me',meBarHtml());setH('rpu_fold',gm()?spkFoldRowHtml(speakers):'');
  {const sb=$('.rpspkbtn',el);if(sb)sb.style.display=$('#rpu_bar',under).innerHTML.trim()?'':'none'}
  {const s=$('#rpspk',el);if(s)spkBtnFill(s,curSpk(speakers))}
  const bindRp=root=>root.querySelectorAll('[data-rp]').forEach(b=>b.onclick=e=>{if(b.dataset.rp==='spkpop'){e.stopPropagation();$('#rpunder',el).classList.toggle('spkpop');return}if(b.dataset.rp==='mdet'){e.stopPropagation();if(window.OM_RPMON)window.OM_RPMON.open(b.dataset.mid);return}if(b.dataset.rp==='comp'){e.stopPropagation();const t=meTrainer();const K=window.OM_SKILL_UI;if(t&&K&&K.setComp)K.setComp(t.id,b.dataset.mid);return}if(b.dataset.rp==='mon'){const ST=A().ST;const bm=((ST.state.battle||{}).mons||{})[b.dataset.mid];if(bm)return A().openMon(b.dataset.mid);const m=((ST.state.roster||{}).mons||{})[b.dataset.mid];if(m&&window.OM_SHEET_UI){window.OM_SHEET_UI.UI.tid=m.tid;window.OM_SHEET_UI.UI.mid=m.id;window.OM_SHEET_UI.UI.tab='poke';A().view='sheet';A().renderScene()}return}act(b.dataset.rp)});bindRp(el);{const sl=document.getElementById('prpslot');if(sl&&sl._bound!==sl._h){sl._bound=sl._h;bindRp(sl)}}
  const refreshMeBar=()=>{const old=el.querySelector('.mebar');if(!old)return;const tmp=document.createElement('div');tmp.innerHTML=meBarHtml();const nw=tmp.firstElementChild;if(nw){old.replaceWith(nw);bindRp(nw)}};
  const spk=$('#rpspk',el);if(spk)spk.onclick=()=>openSpkPick(spk,{cur:curSpk(speakers),onPick:k=>{SPK.key=k;pushRecent(k);spkBtnFill(spk,k);el.querySelectorAll('.spk[data-spk]').forEach(b=>b.classList.toggle('on',b.dataset.spk===SPK.key));refreshMeBar();refreshExp(el);const inp=$('#rpline',el);if(inp)inp.focus()}});
  el.querySelectorAll('.spk[data-spk]').forEach(b=>b.onclick=()=>{SPK.key=b.dataset.spk;pushRecent(SPK.key);if(spk)spkBtnFill(spk,SPK.key);el.querySelectorAll('.spk[data-spk]').forEach(x=>x.classList.toggle('on',x===b));refreshMeBar();refreshExp(el);const inp=$('#rpline',el);if(inp)inp.focus()});
  {const mb=$('#rpmode',el);if(mb)mb.onclick=()=>{const ks=Object.keys(MODES);SPK.mode=ks[(ks.indexOf(SPK.mode)+1)%ks.length];try{localStorage.setItem('om_rpmode',SPK.mode)}catch(e){}SPK.focus=true;A().renderScene();A().toast(MODES[SPK.mode].tip)}}
  refreshExp(el);
  if(window.OM_EMO)window.OM_EMO.bind($('#rpemo',el),emoNow);
  el.querySelectorAll('.spk[data-fold]').forEach(b=>b.onclick=()=>{const id=b.dataset.fold,i=SPK.fo.indexOf(id);if(i>=0)SPK.fo.splice(i,1);else{SPK.fo.push(id);if(SPK.fo.length>3)SPK.fo.shift()}A().renderScene()});el.querySelectorAll('[data-fclose]').forEach(fc=>fc.onclick=()=>{SPK.fo=SPK.fo.filter(x=>x!==fc.dataset.fclose);A().renderScene()});
  bindSpkDrag(el);
  const inp=$('#rpline',el);if(inp&&inNew){inp.value=SPK.draft||'';inp.oninput=()=>{SPK.draft=inp.value;typingPing()};inp.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing)sendLine()};$('#rpsend',el).onclick=sendLine;acBind(inp,()=>speakerChar())}if(inp&&SPK.focus){inp.focus();SPK.focus=false}
  bindMap(el);tickBanner();syncBgm();scheduleExpire();drawTyping()}
 /* 스탠딩 DOM 을 키로 맞춘다: 새로 선 것만 등장 애니메이션, 자리 바뀜·표정 바뀜은 제자리에서 */
 /* 스탠딩 크기 (인물마다 standScale %, 10-23 망령) — 발밑 기준으로 키우고 줄인다 */
 function standTf(img,flip,scale){const k=scale&&+scale!==100?+scale/100:1;img.dataset.k=k;img.dataset.fl=flip?1:0;{const bu=img.closest('.stand.bust');img.style.transformOrigin=bu?`50% ${bu.style.getPropertyValue('--waist')||52}%`:'50% 100%'}standPut(img,k);
  if(!img.complete)img.addEventListener('load',()=>standFit(img),{once:true});requestAnimationFrame(()=>standFit(img))}
 function standPut(img,k){img.style.transform=(img.dataset.fl==='1'?'scaleX(-1) ':'')+(k!==1?`scale(${k})`:'')}
 /* 10-23 망령: 키운 스탠딩(인물 크기 × 내 설정 스탠딩 크기)이 무대 위로 넘치면 넘치지 않을 만큼만 키운다 (발밑 기준이라 머리가 잘리던 것) */
 function standFit(img){const ch=img.closest('.stand');if(!ch||!img.isConnected||!img.offsetHeight||ch.classList.contains('portrait'))return;if(ch.classList.contains('bust')){img.style.transformOrigin=`50% ${ch.style.getPropertyValue('--waist')||52}%`;return}   /* 상반신: 허리를 축으로 키운다 (무대 밑은 잘림) */
  const k=+img.dataset.k||1,g=parseFloat(getComputedStyle(img).scale)||1,room=img.getBoundingClientRect().bottom-ch.getBoundingClientRect().top;
  const kk=Math.min(k,room/(img.offsetHeight*g));standPut(img,Math.abs(kk-1)<.005?1:kk)}
 addEventListener('resize',()=>{clearTimeout(standFit.t);standFit.t=setTimeout(()=>document.querySelectorAll('#stands .stand img').forEach(standFit),120)});
 function syncStands(box,slots,manual){const want={};const pr=dqRow(),pk=pr?speakerKey(pr):'',psx=pr&&pr.data?pr.data.sx:null;
  for(const s of SLOTS){let c=charOf(slots[s]);if(c&&psx!=null&&c.key===pk&&(c.stands||[])[psx])c=Object.assign({},c,{active:psx});   /* 큐에서 찍는 줄은 보낼 때의 표정으로 */const src=standSrc(c);if(c&&src)want[s]={key:c.key,src,name:c.name,point:standPoint(c),waist:standWaist(c),kind:standKind(c),scale:+c.scale||0,flip:!!(manual[s]||{}).flip,on:((dqRow()?speakerKey(dqRow()):'')||STAGE.active)===c.key||!STAGE.active}}
  [...box.children].forEach(ch=>{const s=ch.dataset.slot;if(!want[s]||want[s].key!==ch.dataset.key){ch.classList.add('out');setTimeout(()=>ch.remove(),350)}});
  for(const s of SLOTS){const w=want[s];if(!w)continue;let ch=[...box.children].find(x=>x.dataset.slot===s&&x.dataset.key===w.key&&!x.classList.contains('out'));
   if(!ch){ch=document.createElement('div');ch.dataset.slot=s;ch.dataset.key=w.key;ch.className=`stand ${s} in`;ch.innerHTML=`<img alt=""><div class="stname"></div>`;box.appendChild(ch)}
   const img=ch.querySelector('img');if(img.getAttribute('src')!==w.src){img.src=w.src;ch.classList.remove('portrait');img.onload=()=>{const k=ch.dataset.kind||(img.naturalHeight/Math.max(1,img.naturalWidth)<1.45?'portrait':'stand');ch.classList.toggle('portrait',k==='portrait')}}
   ch.dataset.kind=w.kind||'';if(w.kind)ch.classList.toggle('portrait',w.kind==='portrait');else if(img.complete&&img.naturalWidth)ch.classList.toggle('portrait',img.naturalHeight/img.naturalWidth<1.45);{const bu=!!w.waist&&!ch.classList.contains('portrait');ch.classList.toggle('bust',bu);ch.style.setProperty('--waist',bu?w.waist:'')}standTf(img,w.flip,w.scale);ch.style.marginBottom=ch.classList.contains('portrait')||ch.classList.contains('bust')?'':(-w.point)+'px';ch.querySelector('.stname').textContent=w.name;
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
 const SPK={key:'',draft:'',focus:false,fo:[],mode:(()=>{try{const v=localStorage.getItem('om_rpmode');return ['auto','say','narr'].includes(v)?v:'auto'}catch(e){return 'auto'}})()};
 /* 입력줄 「자동 / 대사 / 지문」 (10-23 벨벳 참고): 따옴표 규칙을 몰라도 고른 대로 나간다 — 이 브라우저에서만 기억 */
 const MODES={auto:{lb:'자동',tip:'자동: 그냥 치면 지문, "…" 「…」 로 감싸면 대사',ph:'그냥 치면 지문 · "대사" 는 따옴표로 · @표정 "대사"'},
  say:{lb:'💬 대사',tip:'대사: 따옴표 없이 쳐도 대사로 나간다',ph:'대사로 보낸다 — 따옴표 없이 그냥 쳐도 돼'},
  narr:{lb:'✎ 지문',tip:'지문: 따옴표가 있어도 지문(행동·묘사)으로 나간다',ph:'지문으로 보낸다 — 행동 · 표정 · 상황 묘사'}};
 const QUOTED=/^["“「『].*["”」』]$/s;
 function modeText(t){if(SPK.mode==='say'&&!QUOTED.test(t)&&!/^\*.+\*$/s.test(t))return '"'+t+'"';if(SPK.mode==='narr'&&QUOTED.test(t))return '*'+t+'*';return t}
 /* 표정 고르기: 지금 화자의 표정(스탠딩)이 둘 이상이면 입력줄 옆에 뜬다. 고르면 「@표정」 과 같이 무대 그림이 바로 바뀐다 */
 /* 11-09 21:38 망령 「이것도 눌렀을 때 UI 보강」: 표정 select → 버튼(지금 표정 그림 + 이름 ▾) · 누르면 스탠딩 그림 격자 고르기 창(화자 고르기 창 .spkp 와 같은 꼴 · 바깥 누르기 · Esc 로 닫힘) */
 function refreshExp(el){const box=$('#rpexpbox',el);if(!box)return;const c=speakerChar();const st=c?(c.stands||[]):[];const cur=c?Math.min(st.length-1,Math.max(0,+c.active||0)):0;
  const lb=i=>(st[i]&&st[i].label)||('표정 '+(i+1));
  const h=st.length>=2?`<button type="button" class="expbtn" id="rpexp" title="${esc(c.name)} 표정 — 눌러서 고르기 (무대 그림이 바로 바뀐다 · 입력줄에 @${esc(lb(cur))} 처럼 써도 된다)"><i class="expbtn-im" style="${st[cur].src?`background-image:url('${cssu(st[cur].src)}')`:''}"></i><span class="expbtn-n">${esc(lb(cur))}</span><span class="spkpcar">▾</span></button>`:'';
  if(box._h!==h){box.innerHTML=h;box._h=h}box.classList.toggle('on',!!h);const se=$('#rpexp',box);
  if(se)se.onclick=()=>openExpPick(se,c,async i=>{if(await setStandIdx(c,i))A().toast(`표정: ${lb(i)}`);const inp=$('#rpline');if(inp)inp.focus({preventScroll:true})})}
 /* 11-09 21:52 망령 「@표정 칠 때 후보를 볼 수 없어 불편 — @ 치면 후보 · 자동완성 · ! 도 마찬가지」
    입력줄(RP #rpline · 옆 채팅 #chatIn)에서 맨 앞 「@…」 = 지금 화자의 표정(스탠딩) 후보, 낱말 첫머리 「!…」 = 감정 연출 후보.
    ↑↓ 고르기 · Tab / Enter 넣기 · Esc 닫기 · 누르기. getChar() 가 false 면 끔(잡담 탭 등), null 이면 표정만 없음 */
 function acCharOf(key){return key==='gm'?charOf(myGmKey()):charOf(key)}
 function acBind(inp,getChar){if(!inp||inp._ac)return;inp._ac=1;let pop=null,items=[],sel=0,tok=null;
  const close=()=>{if(pop){pop.remove();pop=null}items=[];tok=null};
  const curTok=()=>{const v=inp.value,p=inp.selectionStart==null?v.length:inp.selectionStart;if(inp.selectionEnd!=null&&inp.selectionEnd!==p)return null;
   let s=p;while(s>0&&!/\s/.test(v[s-1]))s--;let e=p;while(e<v.length&&!/\s/.test(v[e]))e++;const w=v.slice(s,p);if(!w)return null;
   if(w[0]==='@'&&s===0)return {kind:'@',s,e,q:w.slice(1)};
   if((w[0]==='!'||w[0]==='！')&&(s===0||/\s/.test(v[s-1])))return {kind:'!',s,e,q:w.slice(1)};return null};
  const rank=(q,names)=>{q=q.toLowerCase();if(!q)return 1;let best=0;for(const n of names){const x=String(n||'').toLowerCase();if(x===q)return 4;if(x.startsWith(q))best=Math.max(best,3);else if(x.includes(q))best=Math.max(best,2)}return best};
  const build=t=>{const out=[];
   if(t.kind==='@'){const c=getChar();if(!c)return out;const st=c.stands||[];const EMO=window.OM_EMO;
    st.forEach((x,i)=>{const lb=String(x.label||'').trim();if(!lb||/\s/.test(lb))return;const r=rank(t.q,[lb]);if(!r)return;const em=EMO&&EMO.fromLabel(lb);
     out.push({r,o:i,ins:'@'+lb,lb,img:x.src||'',sub:[i===(+c.active||0)?'지금':'',em&&EMO.E[em]?'감정 '+EMO.E[em].ko+' 같이':''].filter(Boolean).join(' · ')})})}
   else{const EMO=window.OM_EMO;if(!EMO)return out;Object.values(EMO.E).forEach((e,i)=>{const r=rank(t.q,[e.ko,e.k,...e.al]);if(!r)return;
     out.push({r,o:i,ins:'!'+e.ko,lb:e.ko,ic:e.ic,sub:e.al.filter(a=>a!==e.ko&&/[가-힣]/.test(a)).slice(0,3).join(' · ')})})}
   return out.sort((a,b)=>b.r-a.r||a.o-b.o).slice(0,40)};
  const paint=()=>{if(!pop){pop=document.createElement('div');pop.className='acpop';document.body.appendChild(pop);
    pop.addEventListener('mousedown',e=>e.preventDefault());pop.addEventListener('click',e=>{const b=e.target.closest('.ac-it');if(b){sel=+b.dataset.i;accept()}})}
   const EMO=window.OM_EMO;
   pop.innerHTML=`<div class="ac-h">${tok.kind==='@'?'표정':'감정 연출'} <small>↑↓ · Tab / Enter 로 넣기 · Esc</small></div>`+items.map((x,i)=>`<button type="button" tabindex="-1" class="ac-it ${i===sel?'on':''}" data-i="${i}">${x.ic!=null?`<span class="ac-ic">${(EMO&&x.ic&&EMO.svg(x.ic,'ac-svg'))||'·'}</span>`:`<i class="ac-im${x.img?'':' noimg'}" style="${x.img?`background-image:url('${cssu(x.img)}')`:''}"></i>`}<span class="ac-tx"><b>${esc(x.ins)}</b>${x.sub?`<small>${esc(x.sub)}</small>`:''}</span></button>`).join('');
   const r=inp.getBoundingClientRect();const W=Math.min(300,Math.max(220,r.width),innerWidth-16);pop.style.width=W+'px';pop.style.left=Math.max(8,Math.min(innerWidth-W-8,r.left))+'px';
   const above=r.top-8,below=innerHeight-r.bottom-8;if(above>=180||above>below){pop.style.top='';pop.style.bottom=(innerHeight-r.top+4)+'px';pop.style.maxHeight=Math.max(120,Math.min(320,above))+'px'}else{pop.style.bottom='';pop.style.top=(r.bottom+4)+'px';pop.style.maxHeight=Math.max(120,Math.min(320,below))+'px'}
   const on=pop.querySelector('.ac-it.on');if(on)on.scrollIntoView({block:'nearest'})};
  const update=()=>{if(getChar()===false)return close();const t=curTok();if(!t)return close();const L=build(t);if(!L.length)return close();
   const same=tok&&tok.kind===t.kind&&tok.q===t.q;tok=t;if(!same)sel=0;items=L;if(sel>=L.length)sel=0;paint()};
  const accept=()=>{const x=items[sel];if(!x||!tok)return close();const v=inp.value;const tail=v.slice(tok.e).replace(/^\s+/,'');const head=v.slice(0,tok.s)+x.ins+' ';inp.value=head+tail;const p=head.length;try{inp.setSelectionRange(p,p)}catch(e){}close();inp.dispatchEvent(new Event('input',{bubbles:true}));inp.focus({preventScroll:true})};
  inp.addEventListener('keydown',e=>{if(!pop||!items.length||e.isComposing)return;
   if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();e.stopImmediatePropagation();sel=(sel+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;paint();return}
   if(e.key==='Tab'||e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();accept();return}
   if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close()}},true);
  inp.addEventListener('input',update);inp.addEventListener('click',update);inp.addEventListener('keyup',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'||e.key==='Home'||e.key==='End')update()});
  inp.addEventListener('compositionend',()=>setTimeout(update,0));inp.addEventListener('blur',()=>setTimeout(close,120));addEventListener('resize',()=>{if(pop)paint()})}
 function openExpPick(anchor,c,onPick){if(document.querySelector('.spkp')&&document.querySelector('.spkp')._anchor===anchor)return closeSpkPick();closeSpkPick();
  const st=c.stands||[];const cur=+c.active||0;const many=st.length>12;const lb=i=>(st[i].label)||('표정 '+(i+1));
  const pop=document.createElement('div');pop.className='spkp expp';pop._anchor=anchor;
  pop.innerHTML=`<div class="spkp-h expp-h"><b>${esc(c.name)}</b><small>표정 ${st.length}</small>${many?'<input type="search" class="spkp-q" placeholder="표정 이름으로 찾기" autocomplete="off">':''}</div><div class="spkp-b"><div class="expp-g">${st.map((x,i)=>`<button type="button" class="expp-it ${i===cur?'on':''}" data-i="${i}" data-q="${esc(lb(i).toLowerCase())}" title="${esc(lb(i))}"><i class="expp-im${x.src?'':' noimg'}" style="${x.src?`background-image:url('${cssu(x.src)}')`:''}"></i><span>${esc(lb(i))}</span></button>`).join('')}</div></div><div class="expp-f small dim">입력줄에 <code>@표정 "대사"</code> 로 써도 바뀐다</div>`;
  document.body.appendChild(pop);
  const place=()=>{const r=anchor.getBoundingClientRect();const W=Math.min(440,innerWidth-16);pop.style.width=W+'px';const below=innerHeight-r.bottom-10,above=r.top-10;const up=below<320&&above>below;const mh=Math.max(200,Math.min(560,(up?above:below)));pop.style.maxHeight=mh+'px';pop.style.left=Math.max(8,Math.min(innerWidth-W-8,r.left))+'px';if(up){pop.style.top='';pop.style.bottom=(innerHeight-r.top+6)+'px'}else{pop.style.bottom='';pop.style.top=(r.bottom+6)+'px'}};place();
  const its=[...pop.querySelectorAll('.expp-it')];const pick=i=>{closeSpkPick();onPick&&onPick(i)};
  its.forEach(b=>b.onclick=()=>pick(+b.dataset.i));
  const q=pop.querySelector('.spkp-q');if(q){q.oninput=()=>{const v=q.value.trim().toLowerCase();its.forEach(b=>b.style.display=!v||b.dataset.q.includes(v)?'':'none')};if(matchMedia('(pointer:fine)').matches)setTimeout(()=>q.focus(),20)}
  const vis=()=>its.filter(b=>b.style.display!=='none');const cols=()=>{const g=pop.querySelector('.expp-g');return Math.max(1,getComputedStyle(g).gridTemplateColumns.split(' ').length)};
  pop.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeSpkPick();anchor.focus();return}
   if(e.key==='Enter'&&e.target===q&&!e.isComposing){e.preventDefault();const f=vis()[0];if(f)pick(+f.dataset.i);return}
   const mv={ArrowRight:1,ArrowLeft:-1,ArrowDown:cols(),ArrowUp:-cols()}[e.key];if(mv&&e.target!==q){e.preventDefault();const L=vis();const k=L.indexOf(document.activeElement);const n=L[Math.max(0,Math.min(L.length-1,(k<0?L.findIndex(b=>b.classList.contains('on')):k)+mv))];if(n)n.focus()}});
  {const on=pop.querySelector('.expp-it.on');if(on){on.scrollIntoView({block:'nearest'});if(!q&&matchMedia('(pointer:fine)').matches)on.focus({preventScroll:true})}}
  setTimeout(()=>document.addEventListener('pointerdown',spkPickOut,true),0)}
 /* ----- 화자 목록: 토큰이 있는 모든 개체 (GM · NPC(관계도) · PC(로스터) · 포켓몬(로스터)). 정리는 rp.spk = {order:[키|'f:폴더id'], folders:{id:{name,keys:[],hid?}}, hidden:{키:1}} — 폴더 hid:1 이면 폴더째 화자 칸 · 고르기 창에서 숨긴다 (10-28) ----- */
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
  /* 11-04 망령 「야생들 안 난잡하게 폴더 관리 좀 자동으로」: 던전 야생 시트(t.wild)는 방마다 폴더를 만들지 않고 그 던전 폴더 하나(「야생 · 던전 이름」, wd = 던전 id)에 모은다 */
  const wd=t.wild?(()=>{const L=((ST.state.dg||{}).list)||{};if(t.wdg&&L[t.wdg])return [t.wdg,L[t.wdg].n||'던전'];for(const [did,d] of Object.entries(L))if(Object.values((d&&d.r)||{}).some(r=>r&&r.e===t.id))return [did,d.n||'던전'];return ['_','던전']})():null;
  let id=wd?Object.keys(C.folders).find(x=>C.folders[x].wd===wd[0]):Object.keys(C.folders).find(x=>C.folders[x].tid===t.id);
  const loose=keys.filter(k=>!fOf(k)&&!C.hidden[k]);if(!loose.length)return 0;
  if(!id){id='f'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);C.folders[id]=wd?{name:'야생 · '+wd[1],keys:[],wd:wd[0],hid:1}:{name:t.name||'트레이너',keys:[],tid:t.id};
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
 /* 10-25 망령: 휴대폰 RP — 입력칸 바로 아래에 폴더 칩만 한 줄 (가로로 밀어 보기). 폴더를 누르면 그 안 사람들이 아래 줄에 펼쳐진다 (화자 줄의 폴더 열기 SPK.fo 와 같은 값) */
 function spkFoldRowHtml(speakers){const C=spkConf();const byKey={};speakers.forEach(x=>byKey[x.key]=x);const ids=[];for(const k of C.order||[])if(String(k).startsWith('f:')&&C.folders[k.slice(2)])ids.push(k.slice(2));for(const id of Object.keys(C.folders))if(!ids.includes(id))ids.push(id);
  ids.splice(0,ids.length,...ids.filter(id=>!C.folders[id].hid));
  if(!ids.length)return '';const open=ids.filter(id=>SPK.fo.includes(id));
  const fc=id=>{const f=C.folders[id];const n=(f.keys||[]).filter(k=>byKey[k]&&!C.hidden[k]).length;return `<button class="spk folder fr ${SPK.fo.includes(id)?'on':''}" data-fold="${esc(id)}" title="${esc(f.name)} — ${n}명"><i>📁</i><span>${esc(f.name)} <small>${n}</small></span></button>`};
  const mem=open.map(id=>(C.folders[id].keys||[]).filter(k=>byKey[k]&&!C.hidden[k]).map(k=>{const c=charOf(k);const av=c?(standSrc(c)||c.img):'';return spkChip(k,byKey[k].name,av,SPK.key===k)}).join('')).join('');
  return `<div class="spkfold-row">${ids.map(fc).join('')}</div>${mem?`<div class="spkfold-mem">${mem}</div>`:''}`}
 function spkBarHtml(speakers){const C=spkConf();const byKey={};speakers.forEach(x=>byKey[x.key]=x);const inFolder=new Set();for(const f of Object.values(C.folders))for(const k of f.keys||[])inFolder.add(k);
  const chipOf=k=>{const x=byKey[k];if(!x)return '';const c=k==='gm'?null:charOf(k);const av=k==='gm'?myGmImg():c?(standSrc(c)||c.img):'';return spkChip(k,x.name,av,SPK.key===k,{drag:k!=='gm'})};
  const fchip=(id,f)=>`<button class="spk folder ${SPK.fo.includes(id)?'on':''}" data-fold="${esc(id)}" title="${esc(f.name)} — ${(f.keys||[]).length}명 · 눌러서 열기 · 칩을 끌어다 놓으면 넣는다" draggable="true"><i>📁</i><span>${esc(f.name)} <small>${(f.keys||[]).filter(k=>byKey[k]).length}</small></span></button>`;
  const seen=new Set(['gm']);let top='';
  /* 10-24 망령: 연 폴더는 아래 새 줄이 아니라 같은 줄에서 칸을 나눠 펼친다 (폴더 칩 + 안의 칩 + ⤴) */
  SPK.fo=SPK.fo.filter(id=>C.folders[id]&&!C.folders[id].hid);
  const fgrp=(id,f)=>f.hid?'':!SPK.fo.includes(id)?fchip(id,f):`<span class="spkbar sub inl" data-fzone="${esc(id)}">${fchip(id,f)}${(f.keys||[]).filter(k=>byKey[k]&&!C.hidden[k]).map(chipOf).join('')||'<span class="dim small spke">비어 있다 — 칩을 끌어 놓아</span>'}<span class="spkdrop" data-fout title="여기에 끌어다 놓으면 폴더에서 뺀다">⤴</span></span>`;
  for(const it of C.order){if(it.startsWith('f:')){const id=it.slice(2);if(C.folders[id]){top+=fgrp(id,C.folders[id]);seen.add(it)}continue}if(byKey[it]&&!inFolder.has(it)&&!C.hidden[it]){top+=chipOf(it);seen.add(it)}}
  for(const id in C.folders)if(!seen.has('f:'+id))top+=fgrp(id,C.folders[id]);
  for(const x of speakers)if(!seen.has(x.key)&&!inFolder.has(x.key)&&!C.hidden[x.key])top+=chipOf(x.key);
  const sub='';
  return `<div class="spkbar top" data-fzone="">${chipOf('gm')}<button class="spk add" data-rp="people" title="인물 — 새 인물 추가 · 모든 인물 · PC · 포켓몬의 이름 · 초상 · 스탠딩 · 메모 · 폴더"><i>👥</i><span>인물</span></button><button class="spk add" data-rp="spkedit" title="고른 인물의 표정·스탠딩"><i>✎</i><span>표정</span></button><button class="spk add" data-rp="spkmgr" title="화자 정리: 숨기기 · 폴더 이름 · 순서"><i>☰</i><span>정리</span></button><span class="spkdrop" data-fnew title="칩을 여기 끌어다 놓으면 새 폴더가 생긴다">＋📁</span>${top}</div>${sub}`}
 /* 끌어서 순서 바꾸기 · 폴더에 넣기 (GM) */
 function bindSpkDrag(el){if(!gm())return;let dragKey='',dragFold='';
  el.querySelectorAll('.spk[data-spk]').forEach(ch=>{const k=ch.dataset.spk;if(!k||k==='gm')return;ch.addEventListener('contextmenu',e=>spkMenu(e,k));let lt=0;ch.addEventListener('touchstart',e=>{const t=e.touches[0];lt=setTimeout(()=>spkMenu({preventDefault(){},stopPropagation(){},clientX:t.clientX,clientY:t.clientY},k),550)},{passive:true});ch.addEventListener('touchend',()=>clearTimeout(lt));ch.addEventListener('touchmove',()=>clearTimeout(lt))});
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
 /* 11-04 망령 「화자 정리에서도 폴더를 접고 이동시키고」: 폴더 카드 접기(이 브라우저 · 방마다, 정하지 않은 야생 폴더는 처음부터 접힘) · 폴더 머리를 끌어서 순서 바꾸기 */
 const SGK=()=>'om_sgcl_'+(A().ST.room||'');let SGC=null;
 const sgCl=()=>{if(!SGC){try{SGC=JSON.parse(localStorage.getItem(SGK())||'null')}catch(e){}if(!SGC||typeof SGC!=='object')SGC={}}return SGC};
 const sgIs=(id,f)=>{const o=sgCl();return o[id]!=null?!!o[id]:!!(f&&(f.wd||f.hid))};
 const sgSet=(id,v)=>{const o=sgCl();o[id]=v?1:0;try{localStorage.setItem(SGK(),JSON.stringify(o))}catch(e){}};
 function openSpkMgr(){const C=spkConf();const sp=allSpeakers().filter(x=>x.key!=='gm');const fOf=k=>Object.keys(C.folders).find(id=>(C.folders[id].keys||[]).includes(k))||'';
  const byKey={};sp.forEach(x=>byKey[x.key]=x);if(SM.sel&&!byKey[SM.sel])SM.sel='';
  const KIND={pc:'PC',pm:'포켓몬',npc:'인물'};
  const tile=x=>{const c=charOf(x.key);const av=c?(standSrc(c)||c.img):'';const h=!!C.hidden[x.key];
   return `<div class="sgt ${h?'hid':''} ${SM.sel===x.key?'sel':''}" draggable="true" data-key="${esc(x.key)}" data-kind="${esc(x.kind||'')}" data-q="${esc((x.name||'').toLowerCase())}" title="${esc(x.name)}"><i style="${av?`background-image:url('${cssu(av)}')`:''}">${av?'':esc([...(x.name||'?')][0]||'?')}</i><span class="sgn">${esc(x.name.replace(/ \(PC\)$/,''))}</span><small>${KIND[x.kind]||''}</small><button class="sgb" data-eye="${esc(x.key)}" title="${h?'숨김 — 눌러서 화자 칸에 보이기':'화자 칸에 보임 — 눌러서 숨기기'}">${h?'🙈':'👁'}</button>${x.kind==='npc'?`<button class="sgb del" data-ndel="${esc(x.key)}" title="이 인물을 없앤다 — 관계도에서도 빠진다">×</button>`:''}</div>`};
  const fids=[...C.order.filter(o=>o.startsWith('f:')).map(o=>o.slice(2)).filter(id=>C.folders[id]),...Object.keys(C.folders).filter(id=>!C.order.includes('f:'+id))];
  const outside=sp.filter(x=>!fOf(x.key));
  const card=(id,title,list)=>{const fh=!!(id&&C.folders[id].hid);const cl=sgIs(id||'_out',id?C.folders[id]:null);return `<div class="sgc ${fh?'hid':''} ${cl?'cl':''}" data-drop="${id}"><div class="sgh" ${id?`draggable="true" data-fdrag="${id}"`:''}><button class="sgb sgtog" data-fcl="${id||'_out'}" title="${cl?'펼치기':'접기'}">${cl?'▸':'▾'}</button>${id?`<span class="sgi" title="끌어서 폴더 순서 바꾸기">📁</span><input type="text" class="sgname" data-fren="${id}" value="${esc(title)}" title="고치면 바로 저장"><small>${list.length}</small><button class="sgb" data-feye="${id}" title="${fh?'폴더째 숨김 — 눌러서 화자 칸에 보이기':'폴더가 화자 칸에 보임 — 눌러서 폴더째 숨기기'}">${fh?'🙈':'👁'}</button><button class="btn xs ghost danger" data-fdel="${id}" title="폴더만 없애고 안의 칩은 바깥으로">풀기</button>`:`<span class="sgi">◇</span><b>${title}</b><small>${list.length}</small>`}<span class="sgmv">여기로 옮기기</span></div><div class="sgl">${list.map(tile).join('')||'<div class="sge">비어 있다 — 칩을 끌어 놓아 줘</div>'}</div></div>`};
  const md=A().openModal(`<div class="mhead"><h2>화자 정리</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="sgtool"><input type="search" id="sg_q" placeholder="이름으로 찾기" value="${esc(SM.q)}"><label class="small"><input type="checkbox" id="sg_pm" ${SM.pm?'checked':''}> 포켓몬 보이기</label><span class="sp"></span><button class="btn sm ghost" data-smk="clall" title="모든 폴더 접기">모두 접기</button><button class="btn sm ghost" data-smk="opall" title="모든 폴더 펴기">모두 펴기</button><button class="btn sm" data-smk="fadd">＋ 폴더</button><button class="btn sm ghost" data-smk="fauto" title="아직 폴더에 없는 트레이너·포켓몬을 트레이너 이름 폴더로 묶는다 (손으로 넣은 건 그대로)">트레이너별로 묶기</button></div>
   <div class="small dim" style="margin:4px 0 8px">칩을 끌어 다른 칸에 놓거나, 칩을 누르고 옮길 칸을 누른다. 👁 은 화자 칸에 보이기/숨기기 — 폴더 이름 옆 👁 은 폴더째. 「＋ 인물」로 넣은 인물만 × 로 지운다 — PC·포켓몬은 캐릭터 시트에서.</div>
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
  md.querySelectorAll('[data-fcl]').forEach(b=>b.onclick=e=>{e.stopPropagation();const id=b.dataset.fcl;const f=id==='_out'?null:spkConf().folders[id];sgSet(id,!sgIs(id,f));re()});
  md.querySelectorAll('[data-smk="clall"],[data-smk="opall"]').forEach(b=>b.onclick=e=>{e.stopPropagation();const v=b.dataset.smk==='clall';sgSet('_out',v);for(const id of Object.keys(spkConf().folders))sgSet(id,v);re()});
  md.querySelectorAll('[data-fdrag]').forEach(h=>{h.addEventListener('dragstart',e=>{if(e.target.closest('input'))return e.preventDefault();e.dataTransfer.setData('text/om-sgf',h.dataset.fdrag);e.dataTransfer.effectAllowed='move';h.closest('.sgc').classList.add('dragging')});h.addEventListener('dragend',()=>h.closest('.sgc').classList.remove('dragging'))});
  md.querySelectorAll('.sgc').forEach(cd=>{const isF=e=>[...e.dataTransfer.types].includes('text/om-sgf');
   cd.addEventListener('dragover',e=>{if(isF(e)&&cd.dataset.drop){e.preventDefault();cd.classList.add('fover')}});cd.addEventListener('dragleave',()=>cd.classList.remove('fover'));
   cd.addEventListener('drop',async e=>{if(!isF(e))return;e.preventDefault();cd.classList.remove('fover');const src=e.dataTransfer.getData('text/om-sgf'),dst=cd.dataset.drop;if(!src||!dst||src===dst)return;
    const C=spkConf();const fl=[...C.order.filter(o=>o.startsWith('f:')).map(o=>o.slice(2)).filter(id=>C.folders[id]),...Object.keys(C.folders).filter(id=>!C.order.includes('f:'+id))].filter(id=>id!==src);
    const r=cd.getBoundingClientRect();const after=e.clientX>r.left+r.width/2;fl.splice(fl.indexOf(dst)+(after?1:0),0,src);
    /* 화자 줄의 자리는 그대로 두고, 폴더가 있던 자리들에 새 순서로 다시 끼운다 */const slots=[];C.order.forEach((o,i)=>{if(o.startsWith('f:')&&C.folders[o.slice(2)])slots.push(i)});const seq=fl.map(id=>'f:'+id);const nx=C.order.slice();slots.forEach((i,j)=>{nx[i]=seq[j]});nx.push(...seq.slice(slots.length));C.order=nx.filter((o,i)=>!(o.startsWith('f:')&&!C.folders[o.slice(2)])&&nx.indexOf(o)===i);
    await saveSpk(C);re()})});
  md.querySelectorAll('[data-eye]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const C=spkConf();const key=b.dataset.eye;if(C.hidden[key])delete C.hidden[key];else C.hidden[key]=1;await saveSpk(C);re()});
  md.querySelectorAll('[data-feye]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const C=spkConf();const id=b.dataset.feye;const f=C.folders[id];if(!f)return;const g=Object.assign({},f);if(g.hid)delete g.hid;else g.hid=1;C.folders[id]=g;if(g.hid)SPK.fo=SPK.fo.filter(x=>x!==id);await saveSpk(C);re()});
  md.querySelectorAll('[data-fren]').forEach(inp=>{inp.onchange=async()=>{const C=spkConf();const f=C.folders[inp.dataset.fren];if(!f||!inp.value.trim())return;f.name=inp.value.trim();await saveSpk(C)};inp.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing)inp.blur()}});
  md.querySelectorAll('[data-fdel]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const C=spkConf();const id=b.dataset.fdel;const f=C.folders[id];if(!f||!confirm(`「${f.name}」 폴더를 풀까? (안의 칩은 바깥으로)`))return;C.order=C.order.filter(x=>x!=='f:'+id);C.order.push(...(f.keys||[]));delete C.folders[id];SPK.fo=SPK.fo.filter(x=>x!==id);await saveSpk(C);re()});
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
 function openGmImg(key){key=isGmK(key)?key:myGmKey();const gc=charOf(key)||{};const cur=gc.img||'';const ipath=key==='gm'?['rp','gmImg']:[...gmPath(key),'img'];
  const md=A().openModal(`<div class="mhead"><h2>${esc(gc.name||'GM')} 그림</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><p class="small muted">화자 칸의 GM 칩과 GM 이 쓴 로그 줄의 아바타로 쓴다.</p>
   <div class="row" style="gap:14px;align-items:stretch;flex-wrap:nowrap"><i class="gmimgpv" style="${cur?`background-image:url('${cssu(cur)}')`:''}"></i><div style="flex:1;display:flex;flex-direction:column;gap:8px;min-width:0">${dzHtml('gi_dz')}
    <input type="text" id="gi_url" value="${esc(cur)}" placeholder="또는 그림 주소 https://…"><div class="row">${cur?'<button class="btn sm ghost danger" id="gi_del">지우기</button>':''}<span class="sp"></span><button class="btn sm pri" id="gi_ok">저장</button></div></div></div>`);
  const pv=u=>{const i=$('.gmimgpv',md);if(i)i.style.backgroundImage=u?`url('${cssu(u)}')`:''};$('#gi_url',md).oninput=e=>pv(e.target.value.trim());
  const save=async u=>{A().closeModal();if(await A().set(ipath,u||null)){A().toast(u?'GM 그림을 바꿨다':'GM 그림을 지웠다');A().renderScene()}};
  bindDz(md,'#gi_dz',async fs=>{const u=await upImg(fs[0],'gm');$('#gi_url',md).value=u;pv(u);await save(u)});
  $('#gi_ok',md).onclick=()=>save($('#gi_url',md).value.trim());const d=$('#gi_del',md);if(d)d.onclick=()=>save('')}
 function speakerChar(){const ST=A().ST;const k=SPK.key;if(ST.role!=='gm'){if(k&&k.startsWith('pm:'))return charOf(k);return charOf(ST.seat)}if(!k)return null;return charOf(k==='gm'?myGmKey():k)}
 /* @등록명 → 그 표정으로 바꾼다 (뒤에 대사가 있으면 바꾸고 바로 말한다) */
 async function setStandByLabel(c,label){if(!c)return false;const i=(c.stands||[]).findIndex(s=>(s.label||'')===label);if(i<0){A().toast(`「${label}」 표정이 없다${c.stands.length?': '+c.stands.map(s=>s.label).join(', '):' — 「표정」에서 먼저 넣어 줘'}`);return false}return setStandIdx(c,i)}
 async function setStandIdx(c,i){if(!c)return false;
  if(c.kind==='gm')await A().set([...gmPath(c.id),'standActive'],i);else if(c.kind==='pc')await A().set(['roster','trainers',c.id,'standActive'],i);else if(c.kind==='pm')await A().set(['roster','mons',c.id,'standActive'],i);else{if(!c.id)return false;await A().set(['graph','nodes',c.id,'standActive'],i)}return true}
 /* 감정 연출: 대사 없이 지금 바로 (모두에게 신호 · 내 화면은 바로) */
 function emoKeyNow(){const c=speakerChar();return c&&c.key?c.key:''}
 function emoNow(k){const key=emoKeyNow();if(!window.OM_EMO||!k)return;window.OM_EMO.playKey(key,k,{enter:true});try{DBS().broadcast({t:'emo',key,em:k,at:Date.now()})}catch(e){}}   /* 무대에 없으면 올리고 나서 연출 (10-26 망령) */
 /* 무대에 올라온 줄에 감정(data.em)이 있으면 한 번만 — 방금 받은 줄만 (방에 들어올 때 지난 줄은 안 움직인다) */
 const EMO_SEEN=new Set();
 function emoTick(row){if(!row||!row.id||!row.data||!row.data.em||!window.OM_EMO||EMO_SEEN.has(row.id))return;EMO_SEEN.add(row.id);if(EMO_SEEN.size>300)[...EMO_SEEN].slice(0,150).forEach(x=>EMO_SEEN.delete(x));
  const a=DQ.arr[row.id];if(!a||Date.now()-a>20000)return;const key=speakerKey(row);window.OM_EMO.playKey(key,row.data.em)}
 async function sendLine(){const ST=A().ST;const inp=$('#rpline');if(!inp)return;let t=inp.value.trim();if(!t)return;inp.value='';SPK.draft='';SPK.focus=true;typingStop();
  try{if(t.startsWith('/')){const ci=$('#chatIn');if(ci){ci.value=t;$('#chatSend').click()}return}
   const EMO=window.OM_EMO;let EM='';   /* 감정 연출 (js/emote.js): !감정 · 😮 버튼으로 붙인 것 · 표정 이름이 감정 이름이면 저절로 */
   let m;if((m=t.match(/^@(\S+)\s*([\s\S]*)$/))){const ok=await setStandByLabel(speakerChar(),m[1]);if(!ok)return;if(EMO)EM=EMO.fromLabel(m[1]);t=m[2].trim();if(!t&&!(EMO&&EMO.parse(t).em)){A().toast(`표정: ${m[1]}`);if(EM)setTimeout(()=>emoNow(EM),120);return}}
   if(EMO){const pe=EMO.parse(t);if(pe.em){EM=pe.em;t=pe.text}const pd=EMO.takePending();if(!EM&&pd)EM=pd;if(!t){if(EM)emoNow(EM);return}}
   t=modeText(t);
   const sxc=speakerChar();const SX=sxc&&(sxc.stands||[]).length>=2?{sx:+sxc.active||0}:{};if(EM)SX.em=EM;
    {const SY=A().chatSty?A().chatSty():{};if(Object.keys(SY).length)SX.sty=SY}   /* 11-09 망령 「채팅 설정 왜 적용 안 돼?」: RP 무대 입력줄로 보낸 줄에도 내 말 색(글자 · 닉네임 · 말풍선) */
   if(ST.role==='gm'){if(SPK.key==='gm')await DBS().addLog(ST.room,ST.secret,'chat',ST.name,Object.assign({t,nf:1},ST.gmNick?{gmn:ST.gmNick}:{},SX));else{const c=charOf(SPK.key);const name=c?c.name:SPK.key.replace(/^(npc|as|pm):/,'');await DBS().addLog(ST.room,ST.secret,'chat',name,Object.assign({t,as:name,k:SPK.key,nf:1},SX))}}
   else if(SPK.key&&SPK.key.startsWith('pm:')){const c=charOf(SPK.key);await DBS().addLog(ST.room,ST.secret,'chat',c?c.name:ST.name,Object.assign({t,as:c?c.name:'',k:SPK.key,nf:1},SX))}
   else{const c=charOf(ST.seat);const nm=c?c.name:ST.name;await DBS().addLog(ST.room,ST.secret,'chat',nm,Object.assign(c?{t,as:nm,k:ST.seat,nf:1}:{t,nf:1},SX))}}catch(e)   /* 좌석이 자기 캐릭터로 말하면 캐릭터 이름으로 남긴다 (플레이어 닉 X) */{A().toast('보내지 못했다: '+e.message)}}
 function act(k){
  if(k==='dsplit'){if(!gm())return;const on=!R().dsplit;(async()=>{await A().set(['rp','dsplit'],on?true:null);A().toast(on?'좌우 분리 — 모두의 무대에서 대사 상자를 스탠딩 옆으로':'좌우 분리 끔')})();return}
  if(k==='fold'){rpFold=!rpFold;try{localStorage.setItem('om_rpfold',rpFold?'1':'')}catch(e){}return A().renderScene()}
  if(k==='map'){mapOpen=!mapOpen;return A().renderScene()}
  if(k==='mfold'){mapUnfold=!mapUnfold;return A().renderScene()}
  if(k==='deck')return window.OM_SK3R?window.OM_SK3R.open():window.OM_DECK_UI.open();   /* 11-04 망령: 덱 = 은열쇠 카드 관리 창 (예전 덱 창은 그 안 「예전 덱 창」) */
  if(k==='phone'){const t=gm()?meTrainer():null;if(!window.OM_PHONE_UI)return A().ensure('phone').then(()=>act('phone')).catch(()=>{});return window.OM_PHONE_UI.open(null,t?{tid:t.id}:null)}
  if(k==='roll'){const K=window.OM_SKILL_UI;if(!K)return;const t=gm()?meTrainer():null;return t?K.openPlayer(t.id):K.open()}   /* 10-29 망령: GM 이 화자로 PC 를 골랐으면 그 트레이너 굴림 창 */
  if(k==='talk'){const ST=A().ST;if(ST.role==='seat'){SPK.key='me'}else{const t=meTrainer();if(t)SPK.key='as:'+t.name}A().renderScene();const inp=$('#rpline');if(inp)inp.focus();return}
  if(k==='sound'){userMuted=false;unlocked=true;syncBgm(true);A().renderScene();return}
  if(k==='bgmstop'){(async()=>{if(!(await askOk('BGM 을 모두에게 정지할까?','정지','그만')))return;A().set(['rp','bgm'],null)})();return}
  if(k==='mute'){userMuted=true;unlocked=false;if(audio){audio.pause();audio=null}lastBgm='';A().renderScene();return}
  if(k==='gm')return openConsole();
  if(k==='centerx')return A().set(['rp','center'],null);
  if(k==='stand')return openMyStand();
  if(k==='qbg'){QB.con=false;return quickBg()}
  if(k==='calview'){A().view='calendar';return A().renderScene()}
  if(k==='phase'){const PH=['아침','점심','오후','저녁','밤','심야'];const cur=(A().ST.state.calendar||{}).phase||'';const n=PH[(PH.indexOf(cur)+1)%PH.length];return A().set(['calendar','phase'],n).then(()=>A().sysLog(`시간대: ${n}`))}
  if(k==='npcadd')return openPeople('new');
  if(k==='people')return openPeople();
  if(k==='spkedit'){const key=SPK.key;if(key==='gm'&&gm())return openStands(myGmKey());if(!key||key==='gm'||key==='me')return A().toast('먼저 인물을 골라 줘');return openStands(key)}
  if(k==='spkmgr')return openSpkMgr();
  if(k==='notice')return openConsole('notice');
  if(k==='scene')return openConsole('scene');
  if(k==='clues')return gcGoClue();
  if(k==='qbgm')return quickBgm();
  if(k==='log')return openLog();
  if(k==='cluebox')return openClueBox();
  if(k==='vote')return openVote()}
 /* ----- 10-24 망령: 인물 관리 창 — 화자로 쓰는 모든 개체(인물 · PC · 포켓몬)를 카드로 한눈에 보고, 오른쪽에서 고친다 -----
    인물(NPC)은 관계도 노드(graph.nodes)에 산다: 이름 · 초상(img) · 스탠딩(stands) · 메모(note). 화자 칸의 폴더 · 숨김은 rp.spk.
    PC · 포켓몬은 시트가 원본이라 이름은 여기서 안 바꾸고, 표정 · 폴더 · 숨김 · 말하기만 */
 const PP={q:'',f:'all',sel:'',top:0,more:false,draft:null,multi:new Set()};
 /* 10-24 망령: 폴더별로 접고 편다 — 접힌 폴더는 이 브라우저에 기억 */
 let PPC={};try{PPC=JSON.parse(localStorage.getItem('om_pp_fold')||'{}')||{}}catch(e){}
 const ppSaveC=()=>{try{localStorage.setItem('om_pp_fold',JSON.stringify(PPC))}catch(e){}};
 const PPK={npc:'인물',pc:'PC',pm:'포켓몬'};
 function ppList(){const C=spkConf();const fOf=k=>Object.keys(C.folders).find(id=>(C.folders[id].keys||[]).includes(k))||'';const g=(A().ST.state.graph||{}).nodes||{};
  return allSpeakers().filter(x=>x.key!=='gm').map(x=>{const c=charOf(x.key)||{};const node=x.kind==='npc'?Object.values(g).find(n=>n.name===c.name):null;const fid=fOf(x.key);
   return {key:x.key,kind:x.kind,name:c.name||x.name,sub:x.kind==='pm'?String(x.name).replace(/^.*? · /,''):'',c,node,fid,fname:fid?(C.folders[fid]||{}).name:'',hid:!!C.hidden[x.key]}})}
 async function ppMoveFolder(key,fid){const C=spkConf();C.order=C.order.filter(x=>x!==key);for(const f of Object.values(C.folders))f.keys=(f.keys||[]).filter(x=>x!==key);if(fid&&C.folders[fid])C.folders[fid].keys.push(key);else C.order.push(key);await saveSpk(C)}
 async function ppNewFolder(){const name=prompt('새 폴더 이름','새 폴더');if(name==null||!name.trim())return '';const C=spkConf();const id='f'+Date.now().toString(36);C.folders[id]={name:name.trim(),keys:[]};C.order.push('f:'+id);await saveSpk(C);return id}
 function ppFolderSel(id,cur){const C=spkConf();return `<select id="${id}"><option value="">폴더 없음</option>${Object.entries(C.folders).map(([k,f])=>`<option value="${esc(k)}" ${k===cur?'selected':''}>📁 ${esc(f.name)}</option>`).join('')}<option value="__new">＋ 새 폴더…</option></select>`}
 const ppThumb=(src,cls,txt)=>`<i class="${cls||'ppth'}${src?'':' noimg'}" style="${src?`background-image:url('${cssu(src)}')`:''}">${src?'':esc([...(txt||'')].slice(0,2).join(''))}</i>`;
 /* 10-25 망령: 폴더 머리에 ✎ 이름 · 🗑 지우기, 머리를 끌어 순서 바꾸기. 빈 폴더 · 「폴더 없음」도 끌어 놓을 자리로 보인다 */
 function ppGroups(vis,card,showEmpty){const C=spkConf();const ids=[];for(const k of C.order||[])if(String(k).startsWith('f:')&&C.folders[k.slice(2)])ids.push(k.slice(2));for(const id of Object.keys(C.folders))if(!ids.includes(id))ids.push(id);ids.push('');
  if(!vis.length&&!showEmpty)return '';const q=PP.q.trim();
  return ids.map(id=>{const xs=vis.filter(x=>(x.fid||'')===id);if(!xs.length&&!(showEmpty&&(id||ids.length>1)))return '';const shut=!q&&PPC[id]&&xs.length;const nm=id?(C.folders[id]||{}).name||'':'';
   return `<div class="ppgrp${shut?' shut':''}${xs.length?'':' empty'}" data-ppg="${esc(id)}"><div class="ppghr"${id?` draggable="true" data-ppfd="${esc(id)}" title="끌어서 폴더 순서 바꾸기"`:''}><button type="button" class="ppgh" data-ppgh><span class="ppar">▾</span> ${id?'📁 <span class="ppfn">'+esc(nm)+'</span>'+((C.folders[id]||{}).hid?' <em class="pphid" title="화자 정리에서 폴더째 숨김">숨김</em>':''):'📂 폴더 없음'} <small>${xs.length}</small></button>${id?`<span class="ppgact"><button type="button" data-ppren="${esc(id)}" title="폴더 이름 바꾸기">✎</button><button type="button" data-ppfdel="${esc(id)}" title="폴더 지우기 (안의 인물은 「폴더 없음」으로)">🗑</button></span>`:''}</div><div class="ppgc">${xs.map(card).join('')||'<div class="ppdrop">여기로 카드를 끌어 놓는다</div>'}</div></div>`}).join('')}
 async function ppMoveMany(keys,fid){const C=spkConf();for(const key of keys){C.order=C.order.filter(x=>x!==key);for(const f of Object.values(C.folders))f.keys=(f.keys||[]).filter(x=>x!==key);if(fid&&C.folders[fid])C.folders[fid].keys.push(key);else C.order.push(key)}await saveSpk(C)}
 function openPeople(sel){if(!gm())return A().toast('인물 관리는 GM 만');if(sel!==undefined)PP.sel=sel;
  const L=ppList();const q=PP.q.trim().toLowerCase();const cnt={all:L.length,npc:0,pc:0,pm:0,hid:0};L.forEach(x=>{cnt[x.kind]=(cnt[x.kind]||0)+1;if(x.hid)cnt.hid++});
  const vis=L.filter(x=>(PP.f==='all'?true:PP.f==='hid'?x.hid:x.kind===PP.f)&&(!q||x.name.toLowerCase().includes(q)||x.sub.toLowerCase().includes(q)||(x.fname||'').toLowerCase().includes(q)));
  if(PP.sel&&PP.sel!=='new'&&!L.some(x=>x.key===PP.sel))PP.sel='';
  const card=x=>{const av=x.c.img||'';const st=(x.c.stands||[]).length;return `<div role="button" tabindex="0" draggable="true" class="ppc ${PP.sel===x.key?'on':''} ${x.hid?'hid':''} ${PP.multi.has(x.key)?'pick':''}" data-pp="${esc(x.key)}">${ppThumb(standSrc(x.c)||av,'ppst',x.name)}${ppThumb(av,'ppth',x.name)}<span class="ppn"><b>${esc(x.name)}</b><small><em class="ppk k-${x.kind}">${PPK[x.kind]||''}</em>${[x.sub?esc(x.sub):'',x.fname?'📁 '+esc(x.fname):'',st?`표정 ${st}`:''].filter(Boolean).join(' · ')}</small></span>${x.hid?'<span class="pphid" title="화자 칸에서 숨김">🙈</span>':''}</div>`};
  const chip=(k,n)=>`<button type="button" class="chip ${PP.f===k?'on':''}" data-ppf="${k}">${n} <small>${cnt[k]||0}</small></button>`;
  const md=A().openModal(`<div class="mhead"><h2>인물 관리</h2><span class="small dim pphint" style="margin-left:8px">관계도 NPC · PC · 포켓몬 — 화자로 쓰는 모두</span><span class="sp"></span><button class="btn sm pri" data-ppa="new">＋ 새 인물</button><button class="btn sm ghost" data-ppa="fadd" title="새 폴더 — 카드를 끌어 넣는다">＋ 폴더</button><button class="btn sm ghost" data-ppa="spkmgr" title="화자 줄의 칩 순서 · 숨김을 칸별로 정리">화자 줄 정리</button><button class="btn ghost" data-x>닫기</button></div>
   <div class="pptool"><input type="search" id="pp_q" placeholder="이름 · 트레이너 · 폴더로 찾기" value="${esc(PP.q)}"><span class="chips">${chip('all','전체')}${chip('npc','인물')}${chip('pc','PC')}${chip('pm','포켓몬')}${cnt.hid?chip('hid','숨김'):''}</span></div>
   <div class="pphelp small dim">카드를 끌어 폴더에 놓으면 옮겨진다 · Ctrl(⌘)·Shift+클릭으로 여러 장을 골라 한꺼번에 · 폴더 머리를 끌면 순서가 바뀐다</div>
   <div class="ppwrap"><div class="ppgrid" id="pp_g">${ppGroups(vis,card,!q&&PP.f==='all')||`<div class="empty small">${L.length?'찾는 인물이 없다':'아직 인물이 없다 — 「＋ 새 인물」'}</div>`}</div><div class="ppdet" id="pp_d">${ppDetail(L)}</div></div>`);
  md.classList.add('wide','ppmodal');const g=$('#pp_g',md);g.scrollTop=PP.top||0;
  const re=s=>{PP.top=g.scrollTop;openPeople(s)};
  const qi=$('#pp_q',md);qi.oninput=()=>{PP.q=qi.value;const qq=qi.value.trim().toLowerCase();md.querySelectorAll('.ppc').forEach(b=>{const x=L.find(y=>y.key===b.dataset.pp);b.style.display=!qq||(x&&(x.name.toLowerCase().includes(qq)||x.sub.toLowerCase().includes(qq)||(x.fname||'').toLowerCase().includes(qq)))?'':'none'});md.querySelectorAll('.ppgrp').forEach(gp=>{const any=[...gp.querySelectorAll('.ppc')].some(b=>b.style.display!=='none');gp.style.display=any?'':'none';gp.classList.toggle('shut',!qq&&!!PPC[gp.dataset.ppg])})};
  md.querySelectorAll('[data-ppgh]').forEach(b=>b.onclick=()=>{const gp=b.closest('.ppgrp');const f=gp.dataset.ppg;if(PPC[f])delete PPC[f];else PPC[f]=1;ppSaveC();gp.classList.toggle('shut',!!PPC[f])});
  md.querySelectorAll('[data-ppf]').forEach(b=>b.onclick=()=>{PP.f=b.dataset.ppf;re()});
  md.querySelectorAll('[data-pp]').forEach(b=>b.onclick=e=>{const k=b.dataset.pp;if(e.ctrlKey||e.metaKey||e.shiftKey){if(PP.multi.has(k))PP.multi.delete(k);else PP.multi.add(k);b.classList.toggle('pick',PP.multi.has(k));ppMultiBar(md);return}PP.multi.clear();re(k)});
  ppDnD(md,re);ppMultiBar(md);
  md.querySelectorAll('[data-ppa]').forEach(b=>b.onclick=async()=>{if(b.dataset.ppa==='new'){PP.draft=null;return re('new')}if(b.dataset.ppa==='fadd'){const id=await ppNewFolder();if(id){delete PPC[id];if(PP.multi.size){await ppMoveMany([...PP.multi],id);PP.multi.clear()}}return re()}if(b.dataset.ppa==='spkmgr'){A().closeModal();return openSpkMgr()}});
  ppBind(md,L,re)}
 /* 여러 장 골랐을 때 아래 띠 — 폴더로 옮기기 · 고르기 풀기 */
 function ppMultiBar(md){let bar=$('.ppmulti',md);const n=PP.multi.size;if(!n){if(bar)bar.remove();return}
  if(!bar){bar=document.createElement('div');bar.className='ppmulti';$('.ppwrap',md).before(bar)}
  bar.innerHTML=`<b>${n}장 고름</b><span class="small dim">폴더에 끌어 놓거나 고른다</span>${ppFolderSel('pp_mf','').replace('<option value="">폴더 없음</option>','<option value="" disabled selected>폴더로 옮기기…</option><option value="__none">폴더 없음</option>')}<span class="sp"></span><button class="btn xs ghost" data-ppmx>고르기 풀기</button>`;
  $('[data-ppmx]',bar).onclick=()=>{PP.multi.clear();md.querySelectorAll('.ppc.pick').forEach(c=>c.classList.remove('pick'));ppMultiBar(md)};
  const sel=$('#pp_mf',bar);sel.onchange=async()=>{let fid=sel.value;if(fid==='__new'){fid=await ppNewFolder();if(!fid)return}const keys=[...PP.multi];PP.multi.clear();await ppMoveMany(keys,fid==='__none'?'':fid);A().toast(`${keys.length}장을 옮겼다`);const g=$('#pp_g',md);PP.top=g?g.scrollTop:0;openPeople()}}
 /* 끌어 놓기: 카드 → 폴더(빈 폴더 · 폴더 없음 포함), 폴더 머리 → 다른 폴더 머리(순서) · 머리 ✎ 이름 · 🗑 지우기 */
 function ppDnD(md,re){let drag=null;
  md.querySelectorAll('.ppc[data-pp]').forEach(c=>{c.addEventListener('dragstart',e=>{const k=c.dataset.pp;const keys=PP.multi.has(k)?[...PP.multi]:[k];drag={t:'card',keys};e.dataTransfer.setData('text/om-pp',k);e.dataTransfer.effectAllowed='move';c.classList.add('dragging');md.classList.add('ppdragging');if(keys.length>1){const g=document.createElement('div');g.className='ppghost';g.textContent=keys.length+'장';document.body.appendChild(g);e.dataTransfer.setDragImage(g,20,20);setTimeout(()=>g.remove(),0)}});
   c.addEventListener('dragend',()=>{c.classList.remove('dragging');md.classList.remove('ppdragging');md.querySelectorAll('.ppgrp.over').forEach(x=>x.classList.remove('over'));drag=null})});
  md.querySelectorAll('[data-ppfd]').forEach(h=>{h.addEventListener('dragstart',e=>{if(e.target.closest('input'))return e.preventDefault();drag={t:'folder',id:h.dataset.ppfd};e.dataTransfer.setData('text/om-ppf',h.dataset.ppfd);e.dataTransfer.effectAllowed='move';md.classList.add('ppdragging')});h.addEventListener('dragend',()=>{md.classList.remove('ppdragging');md.querySelectorAll('.ppgrp.over,.ppgrp.before').forEach(x=>x.classList.remove('over','before'));drag=null})});
  md.querySelectorAll('.ppgrp').forEach(gp=>{let d=0;const ok=()=>drag&&(drag.t==='card'||(drag.t==='folder'&&gp.dataset.ppg&&gp.dataset.ppg!==drag.id));
   gp.addEventListener('dragenter',e=>{if(!ok())return;e.preventDefault();d++;gp.classList.add(drag.t==='card'?'over':'before')});
   gp.addEventListener('dragover',e=>{if(ok()){e.preventDefault();e.dataTransfer.dropEffect='move'}});
   gp.addEventListener('dragleave',()=>{if(--d<=0){d=0;gp.classList.remove('over','before')}});
   gp.addEventListener('drop',async e=>{if(!ok())return;e.preventDefault();d=0;gp.classList.remove('over','before');const fid=gp.dataset.ppg||'';const dr=drag;drag=null;
    if(dr.t==='card'){const keys=dr.keys.filter(k=>{const it=md.querySelector(`.ppc[data-pp="${CSS.escape(k)}"]`);return !it||it.closest('.ppgrp')!==gp});if(!keys.length)return;PP.multi.clear();await ppMoveMany(keys,fid);if(fid)delete PPC[fid];A().toast(keys.length>1?`${keys.length}장을 옮겼다`:fid?'폴더로 옮겼다':'폴더에서 뺐다');return re()}
    if(dr.t==='folder'){const C=spkConf();const a='f:'+dr.id,b='f:'+fid;C.order=C.order.filter(x=>x!==a);const i=C.order.indexOf(b);C.order.splice(i<0?C.order.length:i,0,a);await saveSpk(C);return re()}})});
  md.querySelectorAll('[data-ppren]').forEach(b=>b.onclick=e=>{e.stopPropagation();const id=b.dataset.ppren;const C=spkConf();const f=C.folders[id];if(!f)return;const sp=b.closest('.ppghr').querySelector('.ppfn');if(!sp)return;
   const inp=document.createElement('input');inp.type='text';inp.value=f.name;inp.className='ppfin';sp.replaceWith(inp);inp.focus();inp.select();inp.onclick=ev=>ev.stopPropagation();let done=false;
   const fin=async save=>{if(done)return;done=true;const v=inp.value.trim();if(save&&v&&v!==f.name){const C2=spkConf();if(C2.folders[id]){C2.folders[id].name=v;await saveSpk(C2)}}re()};
   inp.onkeydown=ev=>{if(ev.key==='Enter'&&!ev.isComposing){ev.preventDefault();fin(true)}if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation();fin(false)}};inp.onblur=()=>fin(true)});
  md.querySelectorAll('[data-ppfdel]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const id=b.dataset.ppfdel;const C=spkConf();const f=C.folders[id];if(!f)return;const n=(f.keys||[]).length;
   if(!confirm(`「${f.name}」 폴더를 지울까?${n?`\n안의 ${n}명은 「폴더 없음」으로 나온다 (인물은 지워지지 않는다).`:''}`))return;
   C.order=C.order.filter(x=>x!=='f:'+id);C.order.push(...(f.keys||[]));delete C.folders[id];if(typeof SPK!=='undefined'&&SPK.fo)SPK.fo=SPK.fo.filter(x=>x!==id);await saveSpk(C);A().toast('폴더를 지웠다');re()})}
 /* 10-26 망령: 인물 지우기 — 인물 관리 · 화자 칩 우클릭 둘 다에서. confirm() 이 막히는 창도 있어 askYes 로 묻는다 */
 /* 11-03 감우 (검토 20-13): 진행류 확인(정지 · 되돌리기 · 덮어쓰기 · 취소 …)은 app.js 의 askYes 창으로 — 없으면 battle_ui 의 것, 그것도 없으면 confirm. 지우기(삭제)류만 confirm 그대로.
    askYes 는 열려 있던 창(콘솔 등)을 닫으니, 부르는 쪽은 예/아니요 뒤에 창을 다시 연다 */
 async function askOk(q,yes,no){const Ap=A();const Y=(Ap&&Ap.askYes)||((window.OM_BATTLE_UI||{}).askYes);if(Y)return Y(q,yes||'지운다',no||'그만');return confirm(q)}
 async function ppDelNpc(key){const ST=A().ST;const name=String(key).replace(/^npc:/,'');const g=ST.state.graph||{};const ids=Object.keys(g.nodes||{}).filter(id=>(g.nodes[id]||{}).name===name&&g.nodes[id].kind!=='org');const lines=Object.entries(g.edges||{}).filter(([,ed])=>ids.includes(ed.a)||ids.includes(ed.b));
  if(!(await askOk(`「${name}」 인물을 지울까?\n관계도에서도 빠지고${lines.length?` 이어진 선 ${lines.length}개도 지워진다`:''}. 되돌릴 수 없다.`)))return false;
  for(const [eid] of lines)await A().set(['graph','edges',eid],null);for(const id of ids)await A().set(['graph','nodes',id],null);
  const C=spkConf();C.order=C.order.filter(y=>y!==key);for(const f of Object.values(C.folders))f.keys=(f.keys||[]).filter(y=>y!==key);delete C.hidden[key];await saveSpk(C);if(SPK.key===key)SPK.key='gm';A().toast(`${name} 를 지웠다`);return true}
 /* 화자 칩 우클릭(폰은 길게 누르기) 메뉴 — GM */
 function spkMenu(e,key,extra){extra=extra||[];e.preventDefault();e.stopPropagation();document.querySelectorAll('.spkctx').forEach(m=>m.remove());const c=charOf(key);if(!c)return;const npc=key.startsWith('npc:');
  const m=document.createElement('div');m.className='spkctx';m.innerHTML=`<b>${esc(c.name)}</b>${extra.map((x,i)=>`<button data-sx="${i}">${x.label}</button>`).join('')}<button data-sm="open">👥 인물 관리에서 열기</button><button data-sm="stand">✎ 표정 · 스탠딩</button><button data-sm="hide">🙈 화자 줄에서 숨기기</button>${npc?'<button data-sm="del" class="danger">🗑 인물 지우기</button>':'<small>PC · 포켓몬은 시트를 지우면 빠진다</small>'}`;
  document.body.appendChild(m);const W=m.offsetWidth,H=m.offsetHeight;m.style.left=Math.max(4,Math.min(innerWidth-W-4,e.clientX))+'px';m.style.top=Math.max(4,Math.min(innerHeight-H-4,e.clientY))+'px';
  const off=ev=>{if(!m.contains(ev.target)){m.remove();document.removeEventListener('pointerdown',off,true)}};setTimeout(()=>document.addEventListener('pointerdown',off,true),0);
  m.onclick=async ev=>{const bx=ev.target.closest('[data-sx]');if(bx){m.remove();document.removeEventListener('pointerdown',off,true);return extra[+bx.dataset.sx].fn()}const b=ev.target.closest('[data-sm]');if(!b)return;m.remove();document.removeEventListener('pointerdown',off,true);const a=b.dataset.sm;
   if(a==='open')return openPeople(key);if(a==='stand')return openStands(key);
   if(a==='hide'){const C=spkConf();C.hidden[key]=1;await saveSpk(C);A().toast(`${c.name} — 화자 줄에서 숨겼다 (인물 관리 「숨김」에서 되돌린다)`);return}
   if(a==='del')await ppDelNpc(key)}}
 function ppDetail(L){
  if(PP.sel==='new'){const D=PP.draft=PP.draft||{name:'',img:'',stands:[],fid:'',note:''};
   return `<div class="ppdh"><b>새 인물</b><span class="small dim">관계도에 NPC 로 들어가고 화자 칸에 바로 뜬다</span></div>
    <div class="ppform"><label class="ppf"><span>이름</span><input type="text" id="pn_name" value="${esc(D.name)}" placeholder="예) 유현" autocomplete="off"></label>
     <div class="ppimgs"><div class="ppimg"><span class="pplab">초상 <small>채팅 아바타 · 지도 칩</small></span><div class="pppv por" id="pn_pv">${D.img?`<img src="${esc(D.img)}" alt="">`:'<span>없음</span>'}</div>${dzHtml('pn_idz','초상 끌어 놓기','클릭 · Ctrl+V')}<input type="text" id="pn_img" value="${esc(D.img)}" placeholder="또는 그림 주소"></div>
      <div class="ppimg"><span class="pplab">스탠딩 <small>여러 장 · 파일 이름이 표정 이름</small></span><div class="ppstrip" id="pn_st">${D.stands.map((s,i)=>`<span class="ppsti">${ppThumb(s.src,'ppsth')}<small>${esc(s.label)}</small><u data-pnx="${i}" title="빼기">×</u></span>`).join('')||'<span class="small dim">없으면 초상으로 선다</span>'}</div><div class="updz" id="pn_sdz"><b>스탠딩 끌어 놓기</b><span>여러 장 · 폴더째 · 클릭 · Ctrl+V</span><input type="file" accept="image/*" multiple hidden></div></div></div>
     <label class="ppf"><span>폴더</span>${ppFolderSel('pn_f',D.fid)}</label>
     <label class="ppf ppt"><span>메모</span><textarea id="pn_note" rows="3" placeholder="관계도 노드 메모 (모두가 본다)">${esc(D.note)}</textarea></label>
     <div class="row" style="margin-top:6px"><label class="small"><input type="checkbox" id="pn_more" ${PP.more?'checked':''}> 추가하고 바로 다음 인물</label><span class="sp"></span><button class="btn" data-ppd="cancel">취소</button><button class="btn pri" data-ppd="add">추가</button></div></div>`}
  const x=L.find(y=>y.key===PP.sel);
  if(!x)return `<div class="ppempty"><b>왼쪽에서 인물을 고른다</b><span class="small dim">카드를 누르면 여기서 이름 · 초상 · 스탠딩 · 메모 · 폴더를 고친다.<br>새 인물은 위 「＋ 새 인물」.</span></div>`;
  const c=x.c;const st=c.stands||[];const npc=x.kind==='npc';const node=x.node||{};
  const strip=`<div class="ppstrip big">${st.map((s,i)=>`<div role="button" tabindex="0" class="ppsti ${i===(+c.active||0)?'on':''}" data-pps="${i}" title="눌러서 이 표정으로">${ppThumb(s.src,'ppsth')}<small>${esc(s.label||'표정 '+(i+1))}</small></div>`).join('')||'<span class="small dim">스탠딩이 없다 — 초상으로 선다</span>'}</div>`;
  return `<div class="ppdh">${ppThumb(standSrc(c)||c.img,'ppbig',x.name)}<div><b>${esc(x.name)}</b><span class="small dim"><em class="ppk k-${x.kind}">${PPK[x.kind]}</em>${x.sub?esc(x.sub)+' · ':''}${st.length?'표정 '+st.length+'장':'스탠딩 없음'}</span></div></div>
   <div class="ppform">${npc?`<label class="ppf"><span>이름</span><input type="text" id="pe_name" value="${esc(x.name)}" autocomplete="off"></label>
    <div class="ppimgs one"><div class="ppimg"><span class="pplab">초상</span><div class="row" style="gap:10px;align-items:stretch;flex-wrap:nowrap"><div class="pppv por" id="pe_pv">${c.img?`<img src="${esc(node.img||c.img)}" alt="">`:'<span>없음</span>'}</div><div style="flex:1;display:flex;flex-direction:column;gap:6px;min-width:0">${dzHtml('pe_idz','초상 바꾸기','끌어 놓기 · 클릭 · Ctrl+V')}<input type="text" id="pe_img" value="${esc(node.img||'')}" placeholder="그림 주소 (비우면 같은 이름 초상)"></div></div></div></div>`
    :`<div class="small dim" style="margin-bottom:6px">${x.kind==='pc'?'PC':'포켓몬'}의 이름 · 그림은 캐릭터 시트에서 고친다.</div>`}
    <div class="ppf ppt"><span>스탠딩</span><div style="flex:1;min-width:0">${strip}<div class="row" style="margin-top:6px;gap:6px"><button class="btn sm" data-ppd="stands">✎ 표정 · 스탠딩 편집</button>${npc?'<div class="updz mini" id="pe_sdz"><b>스탠딩 더하기</b><span>끌어 놓기 · 여러 장</span><input type="file" accept="image/*" multiple hidden></div>':''}</div></div></div>
    <label class="ppf"><span>폴더</span>${ppFolderSel('pe_f',x.fid)}</label>
    <label class="ppf"><span>화자 칸</span><span class="row" style="gap:8px"><label class="small"><input type="checkbox" id="pe_vis" ${x.hid?'':'checked'}> 화자 줄에 보이기</label></span></label>
    ${npc?`<label class="ppf ppt"><span>메모</span><textarea id="pe_note" rows="4" placeholder="관계도 노드 메모 (모두가 본다)">${esc(node.note||'')}</textarea></label>`:''}
    <div class="row ppact"><button class="btn sm" data-ppd="talk" title="화자로 고르고 창을 닫는다">💬 이 인물로 말하기</button>${npc?'<button class="btn sm ghost" data-ppd="graph" title="관계도 탭으로">관계도</button><button class="btn sm danger" data-ppd="del" title="관계도 노드와 이어진 선까지 지운다">🗑 인물 지우기</button>':`<button class="btn sm ghost" data-ppd="hide" title="PC · 포켓몬은 시트가 원본이라 지우지 않고 화자 줄에서만 뺀다">🙈 화자 줄에서 빼기</button>`}<span class="sp"></span>${npc?'<button class="btn pri" data-ppd="save">저장</button>':''}</div></div>`}
 function ppBind(md,L,re){const D=PP.draft;const x=L.find(y=>y.key===PP.sel);const ST=A().ST;
  const fsel=async s=>{if(!s||s.value!=='__new')return;const id=await ppNewFolder();if(D&&PP.sel==='new'){D.fid=id;grabNew()}re()};
  const grabNew=()=>{if(!D)return;const v=id=>{const e=$('#'+id,md);return e?e.value:''};D.name=v('pn_name').trim();D.img=v('pn_img').trim();D.note=v('pn_note');const f=v('pn_f');if(f!=='__new')D.fid=f;const m=$('#pn_more',md);if(m)PP.more=m.checked};
  if(PP.sel==='new'){
   const pv=()=>{const p=$('#pn_pv',md);if(p)p.innerHTML=D.img?`<img src="${esc(D.img)}" alt="">`:'<span>없음</span>'};
   $('#pn_img',md).oninput=e=>{D.img=e.target.value.trim();pv()};
   bindDz(md,'#pn_idz',async fs=>{D.img=await upImg(fs[0],'npc');$('#pn_img',md).value=D.img;pv();A().toast('초상을 올렸다')});
   bindDz(md,'#pn_sdz',async fs=>{grabNew();for(const f of fs){const u=await upImg(f,'st_npc');D.stands.push({label:stLabel(f.name&&f.name!=='image.png'?f.name:'표정'+(D.stands.length+1)),src:u,point:0})}re('new')},true);
   md.querySelectorAll('[data-pnx]').forEach(u=>u.onclick=()=>{grabNew();D.stands.splice(+u.dataset.pnx,1);re('new')});
   const fs=$('#pn_f',md);fs.onchange=()=>{grabNew();fsel(fs)};
   const nm=$('#pn_name',md);setTimeout(()=>nm.focus(),30);nm.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();md.querySelector('[data-ppd="add"]').click()}}}
  else if(x&&x.kind==='npc'){const pv=u=>{const p=$('#pe_pv',md);if(p)p.innerHTML=u?`<img src="${esc(u)}" alt="">`:'<span>없음</span>'};$('#pe_img',md).oninput=e=>pv(e.target.value.trim());
   bindDz(md,'#pe_idz',async fs=>{const u=await upImg(fs[0],'npc');$('#pe_img',md).value=u;pv(u);if(x.node)await A().set(['graph','nodes',x.node.id,'img'],u);A().toast('초상을 바꿨다')});
   bindDz(md,'#pe_sdz',async fs=>{if(!x.node)return;const cur=(x.node.stands||[]).slice();let add=0;for(const f of fs){const u=await upImg(f,'st_npc');const label=stLabel(f.name&&f.name!=='image.png'?f.name:'표정'+(cur.length+1));const j=cur.findIndex(s=>(s.label||'')===label);if(j>=0)cur[j]=Object.assign({},cur[j],{src:u});else{cur.push({label,src:u,point:0});add++}}await A().set(['graph','nodes',x.node.id,'stands'],cur);A().toast(`스탠딩 ${fs.length}장을 넣었다`);re()},true)}
  if(x){const fs=$('#pe_f',md);if(fs)fs.onchange=async()=>{if(fs.value==='__new'){const id=await ppNewFolder();if(id)await ppMoveFolder(x.key,id);return re()}await ppMoveFolder(x.key,fs.value);A().toast(fs.value?'폴더로 옮겼다':'폴더에서 뺐다');re()};
   const vs=$('#pe_vis',md);if(vs)vs.onchange=async()=>{const C=spkConf();if(vs.checked)delete C.hidden[x.key];else C.hidden[x.key]=1;await saveSpk(C);re()};
   md.querySelectorAll('[data-pps]').forEach(b=>b.onclick=async()=>{if(await setStandIdx(x.c,+b.dataset.pps))re()})}
  md.querySelectorAll('[data-ppd]').forEach(b=>b.onclick=async()=>{const k=b.dataset.ppd;
   if(k==='cancel'){PP.draft=null;return re('')}
   if(k==='add'){grabNew();const n=D.name;if(!n)return A().toast('이름이 필요해');const nodes=(ST.state.graph||{}).nodes||{};if(Object.values(nodes).some(y=>y.name===n)||Object.values((ST.state.roster||{}).trainers||{}).some(t=>t.name===n))return A().toast('같은 이름이 이미 있다');
    const id='n'+Date.now().toString(36);const i=Object.keys(nodes).length;
    await A().set(['graph','nodes',id],{id,name:n,kind:'npc',img:D.img,note:D.note||'',x:120+(i%6)*140,y:120+Math.floor(i/6)*140,stands:D.stands.slice(),standActive:0});
    if(D.fid)await ppMoveFolder('npc:'+n,D.fid);SPK.key='npc:'+n;A().toast(`${n} 추가 — 관계도에도 들어갔다`);
    if(PP.more){PP.draft={name:'',img:'',stands:[],fid:D.fid,note:''};return re('new')}PP.draft=null;return re('npc:'+n)}
   if(!x)return;
   if(k==='stands'){A().closeModal();return openStands(x.key)}
   if(k==='talk'){SPK.key=x.key;A().closeModal();A().renderScene();const l=document.getElementById('rpline');if(l)l.focus();return}
   if(k==='graph'){A().closeModal();A().view='graph';return A().renderScene()}
   if(k==='del'){if(await ppDelNpc(x.key))return re('');return}
   if(k==='hide'){const C=spkConf();C.hidden[x.key]=1;await saveSpk(C);A().toast(`${x.name} — 화자 줄에서 뺐다 (「숨김」 칸에서 되돌린다)`);return re()}
   if(k==='save'){if(!x.node)return A().toast('관계도 노드를 찾지 못했다');const n=$('#pe_name',md).value.trim();if(!n)return A().toast('이름이 필요해');
    if(n!==x.name&&(Object.values((ST.state.graph||{}).nodes||{}).some(y=>y.name===n)||Object.values((ST.state.roster||{}).trainers||{}).some(t=>t.name===n)))return A().toast('같은 이름이 이미 있다');
    const nn=Object.assign({},x.node,{name:n,img:$('#pe_img',md).value.trim(),note:$('#pe_note',md).value});await A().set(['graph','nodes',x.node.id],nn);
    if(n!==x.name){const ok='npc:'+x.name,nk='npc:'+n;const C=spkConf();C.order=C.order.map(y=>y===ok?nk:y);for(const f of Object.values(C.folders))f.keys=(f.keys||[]).map(y=>y===ok?nk:y);if(C.hidden[ok]){delete C.hidden[ok];C.hidden[nk]=1}await saveSpk(C);if(SPK.key===ok)SPK.key=nk;PP.sel=nk}
    A().toast('저장했다');return re()}})}
 /* (예전) 인물 빠른 추가 — 이제 「인물 관리」의 새 인물 칸을 쓴다 */
 function addNpcQuick(){return openPeople('new')}
 function addNpcQuickOld(){const ST=A().ST;
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
    <div class="qbmain">${isGm&&G&&!QB.q?`<div class="qbgh"><b>${esc(G.n)}</b><span class="dim small">${G.i.length}장</span><span class="sp"></span><button class="btn xs ghost" data-q="gren">이름</button><button class="btn xs ghost" data-q="gtop" title="그룹 맨 위로">⤒</button><button class="btn xs ghost" data-q="gup" title="그룹 위로">↑</button><button class="btn xs ghost" data-q="gdn" title="그룹 아래로">↓</button><button class="btn xs ghost danger" data-q="gdel">그룹 삭제</button></div>`:''}<div class="qbgrid" id="qbgrid"></div></div></div>
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
   if(k==='g'){if(Date.now()-(QB.dragAt||0)<400)return;QB.g=b.dataset.g;QB.q='';return quickBg()}
   if(k==='bgx'){if(!QB.con)A().closeModal();await A().set(['rp','bg'],null);if(QB.con)quickBg();return}
   if(k==='url')return useUrl($('#qbgu',md).value.trim(),$('#qbgn',md).value.trim());
   if(k==='reset'){const ok=await askOk('방에서 고친 배경 목록을 버리고 기본 목록으로 돌릴까?','기본 목록으로','그만');if(ok)await A().set(['rp','bgList'],null);return quickBg()}
   if(k==='gadd'){const n=prompt('새 그룹 이름');if(!n||!n.trim())return;if(groups.some(x=>x.n===n.trim()))return A().toast('같은 이름의 그룹이 있다');groups.push({n:n.trim(),i:[]});QB.g=n.trim();QB.q='';return saveGs()}
   if(!G)return;
   if(k==='gren'){const n=prompt('그룹 이름',G.n);if(!n||!n.trim()||n.trim()===G.n)return;if(groups.some(x=>x.n===n.trim()))return A().toast('같은 이름의 그룹이 있다');G.n=n.trim();QB.g=G.n;return saveGs()}
   if(k==='gdel'){if(!confirm(`「${G.n}」 그룹(${G.i.length}장)을 지울까?`))return;groups.splice(gi,1);QB.g='';return saveGs()}
   if(k==='gtop'&&gi>0){const [mv]=groups.splice(gi,1);groups.unshift(mv);return saveGs()}
   if(k==='gup'&&gi>0){[groups[gi-1],groups[gi]]=[groups[gi],groups[gi-1]];return saveGs()}
   if(k==='gdn'&&gi<groups.length-1){[groups[gi+1],groups[gi]]=[groups[gi],groups[gi+1]];return saveGs()}})
  /* 10-30 망령 「배경 그룹을 끌어서 순서 조정」: GM 은 왼쪽 그룹 목록을 마우스로 끌어 옮긴다 (터치는 그룹 머리의 ⤒ ↑ ↓) */
  if(isGm){const nav=md.querySelector('.qbnav');let drag=null;
   const clr=()=>nav.querySelectorAll('.qbn').forEach(x=>x.classList.remove('dropb','dropa','dragging'));
   const tgt=e=>{const row=getComputedStyle(nav).flexDirection==='row';let best=null;nav.querySelectorAll('.qbn[data-g]').forEach(x=>{if(x.dataset.g===RC)return;const rc=x.getBoundingClientRect();const inn=row?(e.clientX>=rc.left&&e.clientX<=rc.right):(e.clientY>=rc.top&&e.clientY<=rc.bottom);if(inn)best={x,after:row?e.clientX>rc.left+rc.width/2:e.clientY>rc.top+rc.height/2}});return best};
   nav.querySelectorAll('.qbn[data-g]').forEach(b=>{if(b.dataset.g===RC)return;b.classList.add('qbdrag');b.title='끌어서 순서 바꾸기';
    b.addEventListener('pointerdown',e=>{if(e.button!==0||e.pointerType==='touch')return;drag={b,g:b.dataset.g,x:e.clientX,y:e.clientY,on:false,id:e.pointerId,t:null}})});
   nav.addEventListener('pointermove',e=>{if(!drag)return;if(!drag.on){if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6)return;drag.on=true;try{drag.b.setPointerCapture(drag.id)}catch(er){}}
    e.preventDefault();clr();drag.b.classList.add('dragging');const t=tgt(e);drag.t=t&&t.x!==drag.b?t:null;if(drag.t)drag.t.x.classList.add(drag.t.after?'dropa':'dropb')});
   nav.addEventListener('pointerup',async()=>{if(!drag)return;const d=drag;drag=null;clr();if(!d.on||!d.t)return;QB.dragAt=Date.now();
    const from=groups.findIndex(x=>x.n===d.g);if(from<0)return;const [mv]=groups.splice(from,1);let to=groups.findIndex(x=>x.n===d.t.x.dataset.g);if(to<0)to=groups.length;if(d.t.after)to++;groups.splice(to,0,mv);await saveGs();A().toast(`「${mv.n}」 그룹을 옮겼다`)});
   nav.addEventListener('pointercancel',()=>{drag=null;clr()})}}
 function quickBgm(){const md=A().openModal(`<div class="mhead"><h2>BGM</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div id="bgmpanel">${bgmPanelHtml()}</div>`);md.classList.add('wide');const re=()=>{const el=$('#bgmpanel');if(!el)return;el.innerHTML=bgmPanelHtml();bindBgmPanel(md,re)};bindBgmPanel(md,re)}
 /* ----- 대화 기록 ----- */
 /* 11-03: 화면에 받아 둔 로그(처음 200줄)만 보여 줘서 새로고침하면 이전 대화가 빠졌다 — 뒤에서부터 한 쪽(500줄)씩 더 읽고 「전부 불러오기」, 화자 · 글 검색(강조), 날짜로 건너뛰기 */
 let logOoc=false;
 const LG={rows:[],room:'',oldest:0,done:false,busy:false,q:'',who:'',day:''};
 function lgChatRow(x){return x.kind==='chat'&&x.data&&!x.data.bat&&!x.data.sms&&!x.data.clear&&(x.data.t||x.data.img)}
 function lgMerge(rows){const have=new Set(LG.rows.map(r=>r.id));for(const r of rows||[])if(!have.has(r.id)){LG.rows.push(r);have.add(r.id)}LG.rows.sort((a,b)=>a.id-b.id);
  /* GM 이 서버에서 완전히 지웠으면(「GM 이 로그를 지웠다.」 줄) 그 앞은 버린다 */const wipe=LG.rows.reduce((a,r)=>r.kind==='sys'&&r.data&&r.data.t==='GM 이 로그를 지웠다.'&&r.id>a?r.id:a,0);if(wipe){LG.rows=LG.rows.filter(r=>r.id>=wipe);LG.done=true}
  if(LG.rows.length)LG.oldest=LG.rows[0].id}
 async function lgMore(all,onStep){if(LG.busy||LG.done)return;LG.busy=true;const room=LG.room;try{
   for(let i=0;i<(all?200:1);i++){const rows=await DBS().getLogBefore(room,LG.oldest,500);if(LG.room!==room)return;if(!rows.length){LG.done=true;break}lgMerge(rows);if(rows.length<500){LG.done=true;break}if(onStep)onStep()}
  }catch(e){A().toast('기록을 읽지 못했다: '+e.message)}finally{LG.busy=false}}
 function lgHl(t,q){t=String(t||'');if(!q)return esc(t);const L=t.toLowerCase(),out=[];let i=0;while(true){const j=L.indexOf(q,i);if(j<0){out.push(esc(t.slice(i)));break}out.push(esc(t.slice(i,j)),'<mark>',esc(t.slice(j,j+q.length)),'</mark>');i=j+q.length}return out.join('')}
 function openLog(){const ST=A().ST;const isO=x=>x.data.ch==='ooc';
  if(LG.room!==ST.room){LG.rows=[];LG.room=ST.room;LG.oldest=0;LG.done=false;LG.busy=false;LG.q='';LG.who='';LG.day=''}
  lgMerge(ST.log||[]);const cut=+(R().logClearAt)||0;
  const name=x=>x.data.as||(charOf(speakerKey(x))||{}).name||x.who;const tm=x=>{const d=new Date(x.at);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
  const day=x=>{const d=new Date(x.at);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  const dayL=k=>{const d=new Date(k+'T00:00:00');return `${d.getMonth()+1}/${d.getDate()} (${['일','월','화','수','목','금','토'][d.getDay()]})`};
  const md=A().openModal(`<div class="mhead"><h2>대화 기록</h2><span class="small dim" id="lgcnt"></span><span class="sp"></span><label class="small" title="잡담 탭에서 한 말도 같이 보이고, 복사·파일에도 들어간다"><input type="checkbox" id="lgooc" ${logOoc?'checked':''}> 잡담 포함</label><button class="btn sm ghost" id="lgcopy" title="보이는 줄을 글로">글로 복사</button><button class="btn sm ghost" id="lgdl" title="보이는 줄을 txt 파일로">파일로</button><button class="btn ghost" data-x>닫기</button></div>
   <div class="row lgtools"><input type="search" id="lgq" placeholder="찾기 — 대사 · 지문" value="${esc(LG.q)}" style="flex:1;min-width:120px"><select id="lgwho" title="화자"></select><select id="lgday" title="날짜로 건너뛰기"><option value="">날짜…</option></select><button class="btn sm ghost" id="lgprev" title="더 오래된 기록을 500줄 더 읽는다">↑ 이전 500줄</button><button class="btn sm" id="lgall" title="이 방의 대화를 처음부터 전부 읽는다">전부 불러오기</button></div>
   <div class="rplog" id="lgbox"></div>`);
  md.classList.add('wide');md.classList.add('lgm');
  const box=$('#lgbox',md);let lastRows=[];
  const rowsNow=()=>LG.rows.filter(x=>x.id>cut&&lgChatRow(x)&&(logOoc||!isO(x)));
  const draw=(keepTop)=>{const all=rowsNow();const q=LG.q.trim().toLowerCase();const who=LG.who;
   const rows=all.filter(x=>(!who||name(x)===who)&&(!q||String(x.data.t||'').toLowerCase().includes(q)||name(x).toLowerCase().includes(q)));lastRows=rows;
   const top=box.scrollTop,h0=box.scrollHeight;let lastDay='';
   box.innerHTML=(rows.map(x=>{const f=isO(x)?{narr:false,text:String(x.data.t||'')}:(window.OM_LINE?window.OM_LINE(x.data):{narr:false,text:String(x.data.t||'')});const dk=day(x);const head=dk!==lastDay?`<div class="rlday" data-day="${dk}">${esc(dayL(dk))}</div>`:'';lastDay=dk;
    return `${head}<div class="rl ${f.narr?'narr':''}"><span class="rt">${tm(x)}</span><b class="rn">${lgHl(name(x),q)}${isO(x)?' <small class="dim">· 잡담</small>':''}</b><span class="rx">${x.data.img?`<a href="${esc(x.data.img)}" target="_blank" rel="noopener">[그림]</a> `:''}${lgHl(f.text,q)}</span></div>`}).join(''))||`<div class="empty">${q||who?'맞는 줄이 없다':'아직 대화가 없다'}</div>`;
   if(!LG.done)box.insertAdjacentHTML('afterbegin',`<div class="rlmore small dim">${LG.busy?'읽는 중…':'더 오래된 기록이 있을 수 있다 — 「↑ 이전 500줄」 또는 「전부 불러오기」'}</div>`);
   $('#lgcnt',md).textContent=`${rows.length}줄${rows.length!==all.length?' / '+all.length:''}${LG.done?' · 전부':''}`;
   /* 화자 · 날짜 목록 */
   {const ws=[...new Set(all.map(name))].sort((a,b)=>a.localeCompare(b,'ko'));const sel=$('#lgwho',md);sel.innerHTML=`<option value="">화자 전체</option>${ws.map(w=>`<option value="${esc(w)}" ${w===who?'selected':''}>${esc(w)}</option>`).join('')}`;
    const ds=[...new Set(all.map(day))];const dsel=$('#lgday',md);dsel.innerHTML=`<option value="">날짜…</option>${ds.map(d=>`<option value="${d}">${esc(dayL(d))}</option>`).join('')}`}
   $('#lgprev',md).disabled=LG.done||LG.busy;$('#lgall',md).disabled=LG.done||LG.busy;$('#lgall',md).textContent=LG.busy?'읽는 중…':LG.done?'전부 읽었다':'전부 불러오기';
   if(keepTop==='keep')box.scrollTop=top+(box.scrollHeight-h0);else if(keepTop==='top')box.scrollTop=0;else box.scrollTop=box.scrollHeight};
  draw();
  $('#lgooc',md).onchange=e=>{logOoc=e.target.checked;draw()};
  let qt=null;$('#lgq',md).oninput=e=>{LG.q=e.target.value;clearTimeout(qt);qt=setTimeout(async()=>{draw('top');if(LG.q.trim()&&!LG.done){await lgMore(true,()=>draw('top'));draw('top')}},250)};
  $('#lgwho',md).onchange=e=>{LG.who=e.target.value;draw('top')};
  $('#lgday',md).onchange=e=>{const d=e.target.value;if(!d)return;const el=box.querySelector(`.rlday[data-day="${d}"]`);if(el)box.scrollTop=el.offsetTop-box.offsetTop-4;e.target.value=''};
  $('#lgprev',md).onclick=async()=>{draw('keep');await lgMore(false);draw('keep')};
  $('#lgall',md).onclick=async()=>{draw('keep');await lgMore(true,()=>draw('keep'));draw('keep');A().toast(LG.done?'전부 읽었다':'읽기를 멈췄다')};
  box.addEventListener('scroll',()=>{if(box.scrollTop<40&&!LG.busy&&!LG.done&&!LG.q.trim()){const h0=box.scrollHeight;lgMore(false).then(()=>{draw('keep')})}});
  const text=()=>lastRows.map(x=>`[${day(x)} ${tm(x)}] ${isO(x)?'[잡담] ':''}${name(x)}: ${x.data.t||x.data.img||''}`).join('\n');
  $('#lgcopy',md).onclick=()=>{const t=text();navigator.clipboard.writeText(t).then(()=>A().toast('복사했다'),()=>prompt('복사해서 쓰기',t))};
  $('#lgdl',md).onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text()],{type:'text/plain'}));a.download=`대화기록_${ST.room}_${new Date().toISOString().slice(0,10)}.txt`;a.click()};
  /* 처음 열 때 200줄도 안 되면 자동으로 한 쪽 더 */
  if(!LG.done&&rowsNow().length<60)lgMore(false).then(()=>draw())}

 /* ----- 지도 ----- */
 function mapOverlay(){const M=mapS();const isGm=gm();if(!M.img)return `<div class="mapov"><div class="mapempty"><b>지도가 없다</b><div class="small dim">${isGm?'「지도 관리」에서 그림을 올리고 핀을 꽂아 줘':'GM 이 아직 지도를 올리지 않았다'}</div>${isGm?'<button class="btn sm pri" data-mapmgr data-t="img">지도 관리</button>':''}</div></div>`;
  const W=M.img.w||1000,H=M.img.h||700;const px=(x,y)=>`left:${x/W*100}%;top:${y/H*100}%`;const hid=n=>M.vis[n]==1;
  const locHtml=M.locs.map(l=>{const h=hid(l.n);if(h&&!isGm)return `<div class="cover" style="${px(l.x,l.y)}" title="?"><span>?</span></div>`;
   const dgn=l.dg&&window.OM_DG_UI?window.OM_DG_UI.nameOf(l.dg):'';const dgNow=dgn&&window.OM_DG_UI.on()&&(window.OM_DG_UI.cur()||{}).id===l.dg;
   return `<div class="loc ${h?'hid':''} ${M.party.n===l.n&&(M.party.vis||isGm)?'party':''} ${dgn?'dgl':''} ${dgNow?'dgon':''}" data-loc="${l.n}" style="${px(l.x,l.y)}" title="${esc(l.name)}${dgn?' — 던전: '+esc(dgn):''}"><span class="ln">${l.n}</span><span class="lt">${esc(l.name)}${h?' (가림)':''}</span>${dgn?`<span class="ldg" title="던전: ${esc(dgn)}">⚔</span>`:''}</div>`}).join('');
  const pin=(()=>{const l=M.locs.find(x=>x.n===M.party.n);if(!l||(!M.party.vis&&!isGm))return '';return `<div class="ppin ${M.party.vis?'':'hid'}" style="${px(l.x,l.y)}" title="파티"><span>PC</span></div>`})();
  const routes=`<svg class="routes" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${M.routes.filter(rt=>rt.vis||isGm).map(rt=>{const pts=rt.seq.map(n=>M.locs.find(x=>x.n===n)).filter(Boolean);if(pts.length<2)return '';const d=pts.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ');const c=RCOL[rt.color]||rt.color||'#d63f4f';return `<path d="${d}" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${rt.vis?.85:.35}" stroke-dasharray="${rt.vis?'':'18 14'}"/>${pts.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="11" fill="${c}" stroke="#fff" stroke-width="3"/>`).join('')}<text x="${(pts[0].x+pts[1].x)/2+14}" y="${(pts[0].y+pts[1].y)/2-10}" font-size="28" fill="${c}" stroke="#000" stroke-width="4" paint-order="stroke" font-weight="bold">${esc(rt.name||rt.seq.join('→'))}</text>`}).join('')}</svg>`;
  const npcs=M.npcs.map((n,i)=>[n,i]).filter(([n])=>n.vis||isGm).map(([n,i],_,all)=>{/* 11-03 14:24 망령 「지도 인물을 드래그로 자유롭게」: 핀 가까이 놓으면 핀에 붙고, 아무 데나 놓으면 그 자리(fx · fy, 지도 좌표). n 은 가장 가까운 핀으로 남겨 노트 지도 연동은 그대로 */const free=n.fx!=null&&n.fy!=null;const l=free?{x:+n.fx-30,y:+n.fy+10}:M.locs.find(x=>x.n===n.n);if(!l)return '';const sz={s:34,m:48,l:64}[n.size||'s'];const grp=free?[[n]]:all.filter(([x])=>x.n===n.n&&!(x.fx!=null&&x.fy!=null));const cnt=grp.length;const idx=grp.findIndex(([x])=>x===n);const can=isGm||myNpc(n);
   /* 11-03 14:13 망령 「여전히 이상하다」: 한 핀에 둘 이상이면 핀 오른쪽에 세로 목록 — 한 줄에 얼굴 · 이름 · 상태 말풍선(꼬리 없음). 혼자면 예전 모양 */
   const many=cnt>1;const off=many?`margin-top:${Math.round((idx-(cnt-1)/2)*(sz+6))}px;`:'';
   return `<div class="mnpc ${many?'grp':''} ${MPEEK.has(npKey(n,i))?'peek':''} ${n.vis?'':'hid'} ${can?'can':''} ${n.img?'':'noimg'}" data-np="${esc(npKey(n,i))}" style="${px(l.x+30,l.y-10)};${off}${free?'transform:translate(-50%,-50%);':''}width:${sz}px;height:${sz}px;z-index:${3+idx};${n.img?`background-image:url('${cssu(n.img)}')`:''}" title="${esc(n.name)}${n.vis?'':' (숨김)'}${isGm?' — 누르면 메뉴 · 끌어서 아무 데나(핀 가까이면 핀에 붙음)':can?' — 눌러서 상태 말풍선':''}">${n.img?'':`<u>${esc([...(n.name||'?')][0]||'?')}</u>`}${many?`<span class="mnr"><i>${esc(n.name)}</i>${stBub(effSt(n))}</span>`:`${stBub(effSt(n))}<i>${esc(n.name)}</i>`}</div>`}).join('');
  const shown=M.locs.filter(l=>!hid(l.n)).length;
  return `<div class="mapov"><div class="mapwrap ${isGm&&MM.pin?'pinmode':''} ${MPALL?'peekall':''}" data-mapw><img src="${esc(M.img.src)}" alt="" draggable="false">${routes}${locHtml}${npcs}${pin}</div>
   <div class="maplist">${isGm?`<button class="btn xs ${MM.pin?'pri':''}" data-pinmode title="켜면 지도를 눌러 그 자리에 핀을 꽂는다">${MM.pin?'핀 찍기 중 — 지도를 눌러':'📍 핀 찍기'}</button>`:''}<button class="btn xs ${MPALL?'pri':''} mpeekb" data-mappeek title="폰: 지도 인물의 이름 · 상태 말풍선을 모두 보이기 / 숨기기 (얼굴을 누르면 하나씩)">${MPALL?'이름 숨기기':'이름 보기'}</button><span class="chip">${shown}/${M.locs.length} 공개</span>${M.party.n?`<span class="chip on">파티: ${M.party.n}. ${esc((M.locs.find(x=>x.n===M.party.n)||{}).name||'')}${M.party.vis?'':' (핀 숨김)'}</span>`:''}${M.routes.filter(r=>r.vis).map(r=>`<span class="chip" style="border-color:${RCOL[r.color]||'#888'}">${esc(r.name||r.seq.join('→'))}</span>`).join('')}${!isGm&&A().ST.role==='seat'&&trName(A().ST.seat)?`<span class="sp"></span><button class="btn sm" data-myplace title="내 캐릭터 얼굴을 지도 장소에 놓거나 옮기거나 뺀다 (지도에서 내 얼굴을 끌어 다른 핀에 놓아도 된다)">📍 내 캐릭터 ${myOnMap()?'옮기기':'놓기'}</button>`:''}${isGm?'<span class="sp"></span><button class="btn sm" data-mppl title="관계도 · 트레이너 · 세션 노트 인물을 핀에 놓는다">👤 인물 놓기</button><button class="btn sm pri" data-mapmgr>지도 관리</button><span class="dim small">핀 · 얼굴 클릭 = 메뉴 · 끌면 이동</span>':''}</div></div>`}
 function bindMap(el){const isGm=gm();const wrap=el.querySelector('[data-mapw]');const M=mapS();const W=(M.img||{}).w||1000,H=(M.img||{}).h||700;
  {const pb=el.querySelector('[data-mappeek]');if(pb)pb.onclick=()=>{MPALL=!MPALL;MPEEK.clear();A().renderScene()};if(wrap)wrap.addEventListener('click',e=>{if(e.target.closest('.mnpc')||!MPEEK.size)return;MPEEK.clear();wrap.querySelectorAll('.mnpc.peek').forEach(x=>x.classList.remove('peek'))})}
  const toXY=e=>{const r=wrap.getBoundingClientRect();return {x:Math.round(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*W),y:Math.round(Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))*H)}};
  el.querySelectorAll('[data-loc]').forEach(b=>{const n=+b.dataset.loc;
   if(!isGm){b.onclick=()=>{const l=mapS().locs.find(x=>x.n===n);if(!l)return;const DGU=window.OM_DG_UI;const dgn=l.dg&&DGU?DGU.nameOf(l.dg):'';
     if(dgn&&DGU.on()&&(DGU.cur()||{}).id===l.dg){mapOpen=false;return A().renderScene()}   /* 탐색 중인 던전이면 지도를 닫고 무대(방 화면)로 */
     A().toast(dgn?`${l.n}. ${l.name} — 던전 「${dgn}」 · GM 이 진입하면 열린다`:`${l.n}. ${l.name}`)};return}
   /* GM: 누르면 메뉴, 끌면 이동 (맵툴 토큰 끌기) */
   let st=null,moved=false;b.onpointerdown=e=>{if(e.button!==0)return;st={x:e.clientX,y:e.clientY};moved=false;b.setPointerCapture(e.pointerId);e.preventDefault()};
   b.onpointermove=e=>{if(!st)return;if(!moved&&Math.hypot(e.clientX-st.x,e.clientY-st.y)<5)return;moved=true;const p=toXY(e);b.style.marginLeft='0';b.style.marginTop='0';b.style.left=(p.x/W*100)+'%';b.style.top=(p.y/H*100)+'%';b.classList.add('drag')};
   b.onpointerup=async e=>{if(!st)return;const was=moved;st=null;b.classList.remove('drag');if(!was){locMenu(n);return}const p=toXY(e);const cur=mapS();await saveMap({locs:cur.locs.map(x=>x.n===n?Object.assign({},x,{x:p.x,y:p.y}):x)})};
   b.onpointercancel=()=>{st=null;b.classList.remove('drag');A().renderScene()}});
  if(wrap&&isGm&&MM.pin){wrap.onclick=async e=>{if(e.target.closest('[data-loc],.mnpc,.ppin'))return;const p=toXY(e);const nm=prompt('새 장소 이름');if(nm==null||!nm.trim())return;const cur=mapS();const n=Math.max(0,...cur.locs.map(x=>x.n))+1;await saveMap({locs:[...cur.locs,{n,name:nm.trim(),x:p.x,y:p.y}]});if(cur.ann)A().sysLog(`지도: ${n}. ${nm.trim()} 추가`)}}
  const pm=el.querySelector('[data-pinmode]');if(pm)pm.onclick=()=>{MM.pin=!MM.pin;A().renderScene()};
  el.querySelectorAll('[data-mapmgr]').forEach(mg=>mg.onclick=()=>openMapMgr(mg.dataset.t||'loc'));
  {const pp=el.querySelector('[data-mppl]');if(pp)pp.onclick=()=>peoplePick(0)}
  {const mp=el.querySelector('[data-myplace]');if(mp)mp.onclick=()=>myPlacePick()}
  /* 인물 얼굴: GM 은 누르면 메뉴, 끌어서 다른 핀 근처에 놓으면 그 장소로. 플레이어는 자기 캐릭터 얼굴을 눌러 상태 말풍선 */
  el.querySelectorAll('[data-np]').forEach(f=>{const key=f.dataset.np;
   const own=!isGm&&myNpc(npFind(key));
   if(!isGm&&!own){f.onclick=e=>{e.stopPropagation();if(mapMob()&&!MPALL){if(MPEEK.has(key))MPEEK.delete(key);else MPEEK.add(key);f.classList.toggle('peek',MPEEK.has(key));return}const n=npFind(key);if(!n)return;const st=effSt(n);A().toast(n.name+(st?' — '+(st.e?emoOf(st.e)+' ':'')+(st.m||''):''))};return}
   let s0=null,mv=false,tg=null;const near=p=>{const r=wrap.getBoundingClientRect();const lim=W*30/Math.max(1,r.width);/* 11-03 자유 배치가 생겨 핀에 붙는 거리 56→30px */let best=null,bd=1e9;for(const l of mapS().locs){const d=Math.hypot(l.x-p.x,l.y-p.y);if(d<bd){bd=d;best=l}}return best&&bd<=lim?best:null};
   const hl=l=>{el.querySelectorAll('.loc.droptgt').forEach(x=>x.classList.remove('droptgt'));if(l){const d=el.querySelector(`[data-loc="${l.n}"]`);if(d)d.classList.add('droptgt')}};
   f.onpointerdown=e=>{if(e.button!==0)return;s0={x:e.clientX,y:e.clientY};mv=false;tg=null;try{f.setPointerCapture(e.pointerId)}catch(er){}e.preventDefault();e.stopPropagation()};
   f.onpointermove=e=>{if(!s0)return;if(!mv&&Math.hypot(e.clientX-s0.x,e.clientY-s0.y)<5)return;mv=true;const p=toXY(e);f.style.marginLeft='0';f.style.marginTop='0';f.style.transform='translate(-50%,-50%)';f.style.left=(p.x/W*100)+'%';f.style.top=(p.y/H*100)+'%';f.classList.add('drag');tg=near(p);hl(tg)};
   f.onpointerup=async e=>{if(!s0)return;const was=mv;s0=null;f.classList.remove('drag');hl(null);e.stopPropagation();if(!was){if(mapMob()&&!MPALL&&!MPEEK.has(key)){MPEEK.add(key);f.classList.add('peek');return}return npcMenu(key)}const n=npFind(key);
    if(!n)return A().renderScene();const p=toXY(e);
    if(!tg){/* 핀에서 먼 곳 — 그 자리에 자유롭게. n 은 가장 가까운 핀 */const L=mapS().locs.filter(l=>!own||mapS().vis[l.n]!=1);let nb=null,bd=1e9;for(const l of L){const d=Math.hypot(l.x-p.x,l.y-p.y);if(d<bd){bd=d;nb=l}}const nn=nb?nb.n:(n.n||0);
     if(own)return myMapPos(nn,Math.round(p.x),Math.round(p.y));await npcPatch(key,{n:nn,fx:Math.round(p.x),fy:Math.round(p.y)});return}
    if(tg.n===n.n&&n.fx==null)return A().renderScene();
    if(own){if(mapS().vis[tg.n]==1){A().toast('가린 장소에는 놓을 수 없다');return A().renderScene()}return myMapPos(tg.n)}
    await npcPatch(key,{n:tg.n,fx:null,fy:null});A().toast(`${n.name} → ${tg.n}. ${tg.name}`)};
   f.onpointercancel=()=>{s0=null;hl(null);A().renderScene()};f.onclick=e=>e.stopPropagation()})}
 /* 인물 하나 고치기 (patch=null 이면 빼기). 예전 인물에 id 가 없으면 이참에 붙인다 */
 async function npcPatch(key,patch){const src=mapS().npcs;const i=src.findIndex((x,j)=>npKey(x,j)===key);if(i<0)return;const L=src.map((x,j)=>x.id?x:Object.assign({},x,{id:'p'+j+Date.now().toString(36)}));if(patch===null)L.splice(i,1);else L[i]=Object.assign({},L[i],patch,patch&&'n' in patch?{at:Date.now()}:{});await saveMap({npcs:L})}
 const NPM={e:''};
 function npcMenu(key){const M=mapS();const n=npFind(key);if(!n)return;const isGm=gm();const st=effSt(n)||{};NPM.e=st.e||'';const nt=String(n.id||'').startsWith('nt:');const ln=(M.locs.find(l=>l.n===n.n)||{}).name||'';
  const md=A().openModal(`<div class="mhead"><i class="tpic" style="${n.img?`background-image:url('${cssu(n.img)}')`:''}"></i><h2>${esc(n.name)}</h2>${nt?'<span class="chip" title="세션 노트 인물 — 옮기거나 상태를 바꾸면 노트 지도에도 간다 (지도 연동이 켜져 있을 때)">📓 노트 인물</span>':''}<span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="sec">상태 말풍선 <span class="note">지도 얼굴 위에 뜬다${nt?' · 노트 지도와 같이':''}</span></div>
   <div class="npemo">${MEMO.map(([k,e,t])=>`<button class="btn xs ${NPM.e===k?'pri':'ghost'}" data-npe="${k}" title="${t}">${e}</button>`).join('')}</div>
   <div class="row"><input type="text" id="npstm" maxlength="40" placeholder="한 줄 상태 (예: 도서관에서 리포트 마감 중)" value="${esc(st.m||'')}" style="flex:1"><button class="btn sm pri" data-npa="st">올리기</button><button class="btn sm ghost" data-npa="stx">내리기</button></div>
   ${!isGm&&myNpc(n)?`<div class="sec" style="margin-top:12px">자리 <span class="note">지금 ${n.n}. ${esc(ln)} · 지도에서 얼굴을 끌어 다른 핀에 놓아도 된다</span></div>
   <div class="lgrid">${M.locs.filter(l=>M.vis[l.n]!=1).map(l=>`<button class="lb ${l.n===n.n?'cur':''}" data-npa="mv" data-n="${l.n}"><span class="no">${l.n}</span>${esc(l.name)}</button>`).join('')}</div>
   <div class="row" style="margin-top:10px"><span class="sp"></span><button class="btn sm ghost danger" data-npa="del">지도에서 빼기</button></div>`:''}
   ${isGm?`<div class="sec" style="margin-top:12px">자리 <span class="note">지금 ${n.n}. ${esc(ln)} · 지도에서 얼굴을 끌어 다른 핀에 놓아도 된다</span></div>
   <div class="lgrid">${M.locs.map(l=>`<button class="lb ${l.n===n.n?'cur':''} ${M.vis[l.n]==1?'hid':''}" data-npa="mv" data-n="${l.n}"><span class="no">${l.n}</span>${esc(l.name)}</button>`).join('')}</div>
   <div class="row" style="margin-top:10px"><select id="npsz"><option value="s" ${(n.size||'s')==='s'?'selected':''}>작게</option><option value="m" ${n.size==='m'?'selected':''}>보통</option><option value="l" ${n.size==='l'?'selected':''}>크게</option></select><button class="btn sm ${n.vis?'':'pri'}" data-npa="vis">${n.vis?'🙈 숨기기':'👁 공개'}</button><span class="sp"></span><button class="btn sm ghost danger" data-npa="del">지도에서 빼기</button></div>`:''}`);
  md.querySelectorAll('[data-npe]').forEach(b=>b.onclick=()=>{NPM.e=NPM.e===b.dataset.npe?'':b.dataset.npe;md.querySelectorAll('[data-npe]').forEach(x=>{x.classList.toggle('pri',x.dataset.npe===NPM.e);x.classList.toggle('ghost',x.dataset.npe!==NPM.e)})});
  const inp=$('#npstm',md);inp.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();md.querySelector('[data-npa="st"]').click()}};
  const putSt=async(e,m)=>{const v={e,m,at:Date.now()};if(isGm)await npcPatch(key,{st:v});else await A().set(['pub',A().ST.seat,'mapSt'],v)};
  const sz=$('#npsz',md);if(sz)sz.onchange=()=>npcPatch(key,{size:sz.value});
  md.querySelectorAll('[data-npa]').forEach(b=>b.onclick=async()=>{const k=b.dataset.npa;
   if(k==='st'){const m=inp.value.trim().slice(0,40);A().closeModal();await putSt(m||NPM.e?NPM.e:'',m);return A().toast(m||NPM.e?'말풍선을 올렸다':'말풍선을 내렸다')}
   if(k==='stx'){A().closeModal();await putSt('','');return A().toast('말풍선을 내렸다')}
   if(!isGm){if(!myNpc(n))return;if(k==='mv'){A().closeModal();return myMapPos(+b.dataset.n)}if(k==='del'){if(!confirm(`「${n.name}」을(를) 지도에서 뺄까?`))return;A().closeModal();return myMapPos(0)}return}
   if(k==='mv'){const to=+b.dataset.n;A().closeModal();await npcPatch(key,{n:to,fx:null,fy:null});return A().toast(`${n.name} → ${to}. ${(M.locs.find(l=>l.n===to)||{}).name||''}`)}
   if(k==='vis'){A().closeModal();return npcPatch(key,{vis:n.vis?0:1})}
   if(k==='del'){if(!confirm(`「${n.name}」을(를) 지도에서 뺄까?${nt?'\n(지도 연동이 켜져 있으면 노트 지도에서도 이 장소에서 빠진다)':''}`))return;A().closeModal();return npcPatch(key,null)}})}
 /* 인물 고르기: 세션 노트 인물(이어진 캠페인) · 관계도 · 트레이너 · 포켓몬 → 고른 장소 핀에 놓는다 (이미 놓인 인물은 옮긴다) */
 const MPK={q:'',n:0,sz:'s',vis:1};
 async function peoplePick(n0){const M0=mapS();if(!M0.locs.length)return A().toast('먼저 장소 핀을 찍어 줘');const ST=A().ST;
  MPK.n=n0||MPK.n||M0.party.n||M0.locs[0].n;if(!M0.locs.some(l=>l.n===MPK.n))MPK.n=M0.locs[0].n;
  let nt=[];try{if(window.OM_NOTES&&OM_NOTES.people)nt=await OM_NOTES.people()}catch(e){}
  const local=[...Object.values((ST.state.graph||{}).nodes||{}).map(n=>({name:n.name,img:A().portraitOf(n.name,n.img),tag:'관계도'})),...Object.values((ST.state.roster||{}).trainers||{}).map(t=>({name:t.name,img:t.image||'',tag:'트레이너'})),...Object.values((ST.state.roster||{}).mons||{}).map(m=>({name:m.name,img:m.image||'',tag:'포켓몬'}))].filter(p=>p.name);
  const all=[...nt.map(p=>({id:p.id,name:p.name,img:p.img||A().portraitOf(p.name,''),tag:'📓 노트 '+({pc:'PC',npc:'NPC',ents:'인물'}[p.kind]||''),nvis:p.vis})),...local.filter(p=>!nt.some(q=>q.name===p.name))].filter((p,i,a)=>a.findIndex(q=>(q.id||q.name)===(p.id||p.name))===i);
  const md=A().openModal(`<div class="mhead"><h2>👤 인물 놓기</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="row"><select id="ppk_loc" style="flex:1">${M0.locs.map(l=>`<option value="${l.n}" ${l.n===MPK.n?'selected':''}>${l.n}. ${esc(l.name)}${M0.vis[l.n]==1?' (가림)':''}</option>`).join('')}</select><select id="ppk_sz"><option value="s">작게</option><option value="m">보통</option><option value="l">크게</option></select><label class="small"><input type="checkbox" id="ppk_vis" ${MPK.vis?'checked':''}> 바로 공개</label></div>
   <div class="row"><input type="text" id="ppk_q" placeholder="이름 찾기" value="${esc(MPK.q)}" style="flex:1"><button class="btn sm ghost" id="ppk_new" title="목록에 없는 인물을 이름으로">＋ 이름 직접</button></div>
   <div class="small dim">${nt.length?`세션 노트 인물 ${nt.length}명 — 지도 연동이 켜져 있으면 노트 지도에도 같은 장소로 간다`:'세션 노트 인물은 노트와 이어진 방(📓)에서 보인다'} · 누르면 고른 장소에 놓이고, 이미 있는 인물은 그리로 옮긴다</div>
   <div class="pplist" id="ppk_list"></div>`);
  $('#ppk_sz',md).value=MPK.sz;
  const draw=()=>{const M=mapS();const q=MPK.q.trim().toLowerCase();const at=p=>M.npcs.find(x=>p.id?x.id===p.id:(!String(x.id||'').startsWith('nt:')&&x.name===p.name));
   $('#ppk_list',md).innerHTML=all.filter(p=>!q||p.name.toLowerCase().includes(q)).map((p,i)=>{const h=at(p);const l=h&&M.locs.find(x=>x.n===h.n);return `<button type="button" class="ppc ${h?'on':''}" data-ppi="${all.indexOf(p)}"><i style="${p.img?`background-image:url('${cssu(p.img)}')`:''}">${p.img?'':esc([...p.name][0]||'?')}</i><span><b>${esc(p.name)}</b><small>${esc(p.tag||'')}${h?` · 📍 ${l?l.n+'. '+esc(l.name):'?'}`:''}</small></span></button>`}).join('')||'<div class="empty small">맞는 인물이 없다</div>';
   md.querySelectorAll('[data-ppi]').forEach(b=>b.onclick=()=>place(all[+b.dataset.ppi]))};
  const place=async p=>{const M=mapS();const n=+$('#ppk_loc',md).value;MPK.n=n;MPK.sz=$('#ppk_sz',md).value;MPK.vis=$('#ppk_vis',md).checked?1:0;const ln=(M.locs.find(l=>l.n===n)||{}).name||'';
   const i=M.npcs.findIndex(x=>p.id?x.id===p.id:(!String(x.id||'').startsWith('nt:')&&x.name===p.name));
   if(i>=0){if(M.npcs[i].n===n)return A().toast(`${p.name} — 이미 ${n}. ${ln}`);await npcPatch(npKey(M.npcs[i],i),{n})}
   else await saveMap({npcs:[...M.npcs,{id:p.id||'p'+Date.now().toString(36),name:p.name,img:p.img||'',n,size:MPK.sz,vis:MPK.vis,at:Date.now()}]});
   A().toast(`${p.name} → ${n}. ${ln}`);draw()};
  $('#ppk_q',md).oninput=e=>{MPK.q=e.target.value;draw()};
  $('#ppk_new',md).onclick=()=>{const nm=prompt('인물 이름');if(!nm||!nm.trim())return;place({name:nm.trim(),img:A().portraitOf(nm.trim(),'')})};
  draw()}
 async function saveMap(patch){const m=Object.assign({},R().map||{},patch);await A().set(['rp','map'],m)}
 async function toggleLoc(n){const M=mapS();const vis=Object.assign({},M.vis);const wasHidden=vis[n]==1;if(wasHidden)delete vis[n];else vis[n]=1;await saveMap({vis});const l=M.locs.find(x=>x.n===n);if(M.ann&&l)A().sysLog(`지도: ${l.name} ${wasHidden?'공개':'가림'}`)}
 async function partyMove(n){const M=mapS();const vis=Object.assign({},M.vis);let rev=false;if(M.reveal&&vis[n]==1){delete vis[n];rev=true}await saveMap({party:{n,vis:M.party.vis==null?1:M.party.vis},vis});const l=M.locs.find(x=>x.n===n);if(l&&(R().map||{}).autoBg!==0)await useLocBg(l,true);if(M.ann&&l)A().sysLog(`파티가 ${l.n}. ${l.name}(으)로 이동했습니다.${rev?' (장소 공개)':''}`)}
 /* 10-30 망령 「웹툴도 장소마다 배경 이미지」: loc.bg={src,name}. 장소 메뉴 · 지도 관리 · GM 콘솔에서 고르고 쓴다.
    파티를 옮기면(map.autoBg, 기본 켬) 그 장소 배경으로 바뀐다. 세션 노트 장소의 「웹툴 배경」(spot.bg)은 「지도 가져오기」 때 따라온다 */
 const locBg=l=>l&&l.bg&&l.bg.src?l.bg:null;
 async function useLocBg(l,quiet){const b=locBg(l);if(!b)return false;const cur=R().bg;if(cur&&cur.src===b.src)return false;await A().set(['rp','bg'],{src:b.src,name:b.name||l.name,at:Date.now()});if(!quiet)A().toast(`배경: ${b.name||l.name}`);return true}
 /* 10-30 망령 「(노트의) 지도 배경 한번에 넣기를 웹툴 지도 기능에도」: 파일 이름 앞 번호(01_정문…) = 장소 번호, 아니면 이름으로 맞춘다 */
 const lbKey=x=>String(x||'').replace(/\.[a-z0-9]+$/i,'').replace(/^\d+[_\s.-]*/,'').replace(/^미사그[_\s]*/,'').replace(/[\s_·・()（）\-]/g,'').toLowerCase();
 async function bulkLocBg(files){const cur=mapS();const locs=cur.locs.map(l=>Object.assign({},l));let ok=0;const miss=[];
  const match=f=>{const mm=/^(\d+)[_\s.-]/.exec(f.name||'');if(mm){const l=locs.find(x=>x.n===+mm[1]);if(l)return l}const k=lbKey(f.name);if(!k)return null;return locs.find(x=>lbKey(x.name)===k)||locs.find(x=>{const n=lbKey(x.name);return n&&(n.includes(k)||k.includes(n))})||null};
  A().toast(`배경 ${files.length}장 올리는 중…`);for(const f of files){const l=match(f);if(!l){miss.push(f.name);continue}try{l.bg={src:await upImg(f,'locbg'),name:l.name};ok++}catch(e){miss.push(f.name)}}
  if(ok)await saveMap({locs});A().toast(`장소 배경 ${ok}곳 넣었다${miss.length?` · 못 맞춘 것 ${miss.length}장: ${miss.slice(0,3).join(', ')}${miss.length>3?' …':''}`:''}`);openMapMgr('loc')}
 async function setLocBg(n,bg){const cur=mapS();await saveMap({locs:cur.locs.map(x=>x.n===n?Object.assign({},x,{bg:bg||null}):x)})}
 function pickLocBg(n,back){const M=mapS();const l=M.locs.find(x=>x.n===n);if(!l)return;const cur=locBg(l);
  const G=bgGroups().map(g=>({n:g.n,i:(g.i||[]).filter(i=>i.src)})).filter(g=>g.i.length);const hit=g=>g.i.some(i=>cur&&i.src===cur.src)||g.i.some(i=>l.name&&(l.name.includes(i.l)||i.l.includes(l.name)));G.sort((a,b)=>hit(b)-hit(a));
  const md=A().openModal(`<div class="mhead"><h2>🖼 ${n}. ${esc(l.name)} — 장소 배경</h2><span class="sp"></span>${cur?'<button class="btn sm ghost danger" data-lb="clr">배경 빼기</button>':''}<button class="btn ghost" data-x>닫기</button></div>
   <p class="small dim" style="margin-top:0">고른 그림이 이 장소의 배경이 된다. 장소 메뉴의 「이 배경으로」를 누르거나, 파티를 이 장소로 옮기면 무대 배경이 바뀐다 (지도 관리 「파티」 탭에서 끌 수 있다).</p>
   ${cur?`<div class="locbg cur"><i class="lbthumb" style="background-image:url('${cssu(cur.src)}')"></i><span class="small">지금: <b>${esc(cur.name||'')}</b></span></div>`:''}
   <div class="row" style="gap:6px;margin:8px 0"><input type="text" id="lb_url" placeholder="그림 주소 (https://…)" style="flex:1"><button class="btn sm" data-lb="url">주소로</button><label class="btn sm" style="cursor:pointer">⬆ 올리기<input type="file" accept="image/*" id="lb_file" style="display:none"></label></div>
   <div class="lbxgrid">${G.map(g=>`<div class="lbg"><div class="sec">${esc(g.n)}</div><div class="lbitems">${g.i.map(i=>`<button type="button" class="lbi ${cur&&cur.src===i.src?'on':''}" data-lbk="${esc(i.k)}" title="${esc(i.l)}"><i style="background-image:url('${cssu(i.src)}')"></i><span>${esc(i.l)}</span></button>`).join('')}</div></div>`).join('')}</div>`);
  md.classList.add('wide');
  const done=async bg=>{await setLocBg(n,bg);A().closeModal();A().toast(bg?`${l.name} 배경: ${bg.name}`:`${l.name} 배경을 뺐다`);if(back)back();else locMenu(n)};
  md.querySelectorAll('[data-lbk]').forEach(b=>b.onclick=()=>{const it=bgOf(b.dataset.lbk);if(it)done({src:it.src,name:it.l})});
  const cl=md.querySelector('[data-lb="clr"]');if(cl)cl.onclick=()=>done(null);
  md.querySelector('[data-lb="url"]').onclick=()=>{const u=$('#lb_url',md).value.trim();if(!u)return A().toast('주소를 적어 줘');done({src:u,name:l.name})};
  $('#lb_file',md).onchange=async e=>{const f=e.target.files[0];if(!f)return;A().toast('올리는 중…');try{done({src:await upImg(f,'locbg'),name:l.name})}catch(er){A().toast('올리기 실패: '+er.message)}}}
 function locMenu(n){const M=mapS();const l=M.locs.find(x=>x.n===n);if(!l)return;const h=M.vis[n]==1;
  const md=A().openModal(`<div class="mhead"><h2>${n}. ${esc(l.name)}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="row"><button class="btn ${h?'pri':''}" id="lopen">${h?'공개하기':'가리기'}</button><button class="btn" id="lparty">파티를 여기로</button><button class="btn ghost" id="lfocus">자막으로 알리기</button><button class="btn" id="lppl">👤 인물 놓기</button><button class="btn ghost" id="lmgr">지도 관리</button></div>
   ${(()=>{const ps=M.npcs.map((x,i)=>[x,i]).filter(([x])=>x.n===n);return ps.length?`<div class="locppl"><span class="small"><b>👤 여기 있는 인물</b></span>${ps.map(([x,i])=>`<button class="btn xs ${x.vis?'':'ghost'}" data-lnp="${esc(npKey(x,i))}">${esc(x.name)}${effSt(x)?' 💬':''}</button>`).join('')}</div>`:''})()}
   ${(()=>{const b=locBg(l);return `<div class="locbg">${b?`<i class="lbthumb" style="background-image:url('${cssu(b.src)}')"></i><span class="small"><b>🖼 배경</b> ${esc(b.name||'')}</span><button class="btn pri" id="lbuse">이 배경으로</button>`:'<span class="small"><b>🖼 배경</b> <span class="dim">없음 — 파티가 와도 무대 배경은 그대로</span></span>'}<button class="btn ghost" id="lbpick">${b?'바꾸기':'배경 고르기'}</button></div>`})()}
   ${(()=>{const DGU=window.OM_DG_UI;if(!DGU)return '';const L=DGU.list();const dn=l.dg?DGU.nameOf(l.dg):'';const now=dn&&DGU.on()&&(DGU.cur()||{}).id===l.dg;
    return `<div class="locdg"><span class="small"><b>⚔ 던전</b> 이 장소를 던전 입구로</span><select id="ldg"><option value="">연결 안 함</option>${L.map(d=>`<option value="${esc(d.id)}" ${l.dg===d.id?'selected':''}>${esc(d.n)} (방 ${d.rooms}개)</option>`).join('')}</select>${dn?(now?'<button class="btn pri" id="ldggo">던전 탭으로</button>':`<button class="btn pri" id="ldgin" title="파티를 여기로 옮기고 던전에 들어간다 — 모두의 화면이 던전 탭으로">⚔ 던전 진입</button>`):''}${L.length?'':'<span class="small dim">준비한 던전이 없다 — 위 탭 「던전」 → 던전 관리</span>'}</div>`})()}`);
  {const sel=$('#ldg',md);if(sel)sel.onchange=async()=>{const v=sel.value;const cur=mapS();await saveMap({locs:cur.locs.map(x=>x.n===n?Object.assign({},x,{dg:v||undefined}):x)});A().closeModal();locMenu(n);A().toast(v?`${l.name} = 던전 「${window.OM_DG_UI.nameOf(v)}」`:'던전 연결을 풀었다')}}
  {const bi=$('#ldgin',md);if(bi)bi.onclick=async()=>{A().closeModal();await partyMove(n);await window.OM_DG_UI.enter(l.dg,'',`지도 ${n}. ${l.name}`)}}
  {const bg=$('#ldggo',md);if(bg)bg.onclick=()=>{A().closeModal();A().goView('dungeon')}}
  $('#lopen',md).onclick=async()=>{A().closeModal();await toggleLoc(n)};
  $('#lparty',md).onclick=async()=>{A().closeModal();await partyMove(n)};
  $('#lfocus',md).onclick=async()=>{A().closeModal();await A().set(['rp','caption'],{name:'장소',text:l.name,at:Date.now(),fixed:false})};
  $('#lmgr',md).onclick=()=>openMapMgr('loc');
  $('#lppl',md).onclick=()=>{A().closeModal();peoplePick(n)};
  md.querySelectorAll('[data-lnp]').forEach(b=>b.onclick=()=>{A().closeModal();npcMenu(b.dataset.lnp)});
  {const u=$('#lbuse',md);if(u)u.onclick=async()=>{A().closeModal();await useLocBg(l)}}
  $('#lbpick',md).onclick=()=>{A().closeModal();pickLocBg(n)}}
 /* 지도 관리 창 (맵툴 Lib:map 의 두 탭) */
 /* 11-05 망령 「모바일에선 지도 아이콘만 뜨고 이름/메세지는 클릭하면 보이게」: 폰(≤760px)에선 인물 이름 · 상태 말풍선을 숨기고, 얼굴을 한 번 누르면 그 사람만(peek) · 「이름 보기」는 전부 */
 let MPEEK=new Set(),MPALL=false;const mapMob=()=>window.matchMedia&&matchMedia('(max-width:760px)').matches;
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
    <div class="row lbbulk"><span class="small dim">장소 배경 ${M.locs.filter(locBg).length}/${M.locs.length}</span><span class="sp"></span><label class="btn xs" title="파일 이름 앞 번호(01_정문 …)나 장소 이름으로 알아서 맞춰 넣는다 (세션 노트 지도와 같은 방식)" style="cursor:pointer">🖼 배경 여러 장 한꺼번에<input type="file" accept="image/*" multiple data-mmbulk style="display:none"></label><button class="btn xs ghost" data-mm="lbgmatch" title="이 방 배경 목록(빠른 배경)에서 장소 이름과 같은 그림을 찾아 비어 있는 장소에 넣는다">배경 목록에서 이름 맞추기</button></div>
    <div class="mmlist mmlocs">${M.locs.map(l=>{const h=M.vis[l.n]==1;return `<div class="mml ${h?'hid':''} ${MM.hl===l.n?'hl':''}" data-row="${l.n}"><span class="no">${l.n}</span><input type="text" class="mmname" data-mmren="${l.n}" value="${esc(l.name)}" title="고치면 바로 저장">${M.party.n===l.n?'<span class="tag me">파티</span>':''}<button class="btn xs ${locBg(l)?'':'ghost'} lbbtn" data-mm="lbg" data-n="${l.n}" title="${locBg(l)?'배경: '+esc(l.bg.name||'')+' — 눌러서 바꾸기':'장소 배경 고르기'}">${locBg(l)?`<i class="lbmini" style="background-image:url('${cssu(l.bg.src)}')"></i>`:'🖼'}</button><button class="btn xs ${h?'pri':'ghost'}" data-mm="t" data-n="${l.n}" title="${h?'지금 가림 — 눌러서 공개':'지금 공개 — 눌러서 가리기'}">${h?'🙈 가림':'👁 공개'}</button><button class="btn xs ghost danger" data-mm="del" data-n="${l.n}">×</button></div>`}).join('')||'<div class="empty small">장소가 없다 — 왼쪽에서 「＋ 장소 찍기」</div>'}</div>
    <div class="sec" style="margin-top:12px">루트 <span class="sp"></span>${M.routes.length?'<button class="btn xs ghost danger" data-mm="wipe">모두 지우기</button>':''}</div>
    <div class="seq">${MM.seq.length?MM.seq.map((n,i)=>`${i?' → ':''}<b>${n}</b> ${esc(locName(n))}`).join(''):`<span class="dim small">${MM.mode==='route'?'지도에서 핀을 차례로 눌러 줘':'「〰 루트 그리기」를 켜고 핀을 차례로 누른다'}</span>`}</div>
    <div class="row"><button class="btn xs ghost" data-mm="undo" ${MM.seq.length?'':'disabled'}>하나 빼기</button><button class="btn xs ghost" data-mm="clr" ${MM.seq.length?'':'disabled'}>비우기</button><span class="sp"></span>${Object.entries(RCOL).map(([k,c])=>`<span class="sw ${MM.col===k?'on':''}" data-mm="col" data-c="${k}" style="background:${c}"></span>`).join('')}</div>
    <div class="row"><input type="text" id="mm_rname" placeholder="루트 이름 (비우면 번호 순서)" value="${esc(MM.rname)}" style="flex:1"><button class="btn sm pri" data-mm="draw" ${MM.seq.length<2?'disabled':''}>루트 그리기</button></div>
    ${M.routes.map((r,i)=>`<div class="mml ${r.vis?'':'hid'}"><i class="sw" style="background:${RCOL[r.color]||'#888'}"></i><span class="nm">${esc(r.name||'')}<small class="dim"> ${r.seq.map(n=>n+'.'+locName(n)).join(' → ')}</small></span><button class="btn xs ghost" data-mm="rvis" data-i="${i}">${r.vis?'숨기기':'보이기'}</button><button class="btn xs ghost danger" data-mm="rdel" data-i="${i}">×</button></div>`).join('')}</div></div>`;
  const pics=[...Object.values((ST.state.graph||{}).nodes||{}).map(n=>({name:n.name,img:A().portraitOf(n.name,n.img)})),...Object.values((ST.state.roster||{}).trainers||{}).map(t=>({name:t.name,img:t.image||''})),...Object.values((ST.state.roster||{}).mons||{}).map(m=>({name:m.name,img:m.image||''}))].filter((p,i,a)=>a.findIndex(q=>q.name===p.name)===i);
  const pcTab=`<div class="mmcols"><div><div class="sec">파티 현재 위치</div>
    <div class="partycard"><div class="ppin static"><span>PC</span></div><div style="flex:1"><small class="dim">지금 있는 곳</small><br><b>${M.party.n?M.party.n+'. '+esc(locName(M.party.n)):'—'}</b> ${M.party.vis?'<span class="chip on">플레이어에게 보임</span>':'<span class="chip">핀 숨김 (GM만)</span>'}</div><button class="btn sm ${M.party.vis?'':'pri'}" data-mm="pvis">${M.party.vis?'핀 숨기기':'핀 보이기'}</button></div>
    <label class="small"><input type="checkbox" data-mm="reveal" ${M.reveal?'checked':''}> 가려진 장소로 이동하면 그 장소도 함께 공개</label>
    <label class="small"><input type="checkbox" data-mm="autobg" ${(R().map||{}).autoBg!==0?'checked':''}> 이동하면 그 장소 배경으로 무대 배경도 바꾸기 (배경을 넣은 장소만)</label>
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
    <div class="sec" style="margin-top:14px">정리</div><div class="row" style="flex-wrap:wrap;gap:6px"><button class="btn sm" data-mm="notes" title="세션 노트(mangketmon-notes)의 지도 · 장소 · 루트를 이 방으로">📓 세션 노트에서 가져오기</button><button class="btn sm ghost danger" data-mm="noimg">지도 비우기</button><button class="btn sm ghost danger" data-mm="wipeall">핀·루트·인물 모두 지우기</button></div></div></div>`;
  const md=A().openModal(`<div class="mhead"><h2>지도 관리</h2><span class="tabs2" style="margin:0 0 0 14px;flex:0 1 520px"><button class="tab2 ${MM.tab==='img'?'on':''}" data-mm="tab" data-t="img">지도 그림 <small>${M.img?(isMujin?'무진':'올린 그림'):'없음'}</small></button><button class="tab2 ${MM.tab==='loc'?'on':''}" data-mm="tab" data-t="loc">장소 · 루트 <small>${M.locs.filter(l=>M.vis[l.n]!=1).length}/${M.locs.length} 공개</small></button><button class="tab2 ${MM.tab==='pc'?'on':''}" data-mm="tab" data-t="pc">파티 위치 · 인물 <small>${M.party.n?M.party.n+'. '+esc(locName(M.party.n)):''}</small></button></span><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>${MM.tab==='pc'?pcTab:MM.tab==='img'?imgTab:locTab}`);
  const applyImg=async src=>{A().toast('그림 크기를 재는 중…');const im=new Image();im.onload=async()=>{const nw=im.naturalWidth||1000,nh=im.naturalHeight||700;const ow=(M.img||{}).w,oh=(M.img||{}).h;let locs=M.locs;if(ow&&oh&&(ow!==nw||oh!==nh))locs=locs.map(l=>Object.assign({},l,{x:Math.round(l.x/ow*nw),y:Math.round(l.y/oh*nh)}));await saveMap({img:{src,w:nw,h:nh},preset:'',locs});const H=[...(M.img&&M.img.src&&M.img.src!==src?[M.img]:[]),...((R().mapHist)||[])].filter((h,i,arr)=>h&&h.src&&h.src!==src&&arr.findIndex(x=>x.src===h.src)===i).slice(0,8);await A().set(['rp','mapHist'],H);A().toast('지도를 바꿨다');openMapMgr('img')};im.onerror=()=>A().toast('그림을 불러오지 못했다');im.src=src};
  if($('#mm_dz',md))bindDz(md,'#mm_dz',async fs=>{await applyImg(await upImg(fs[0],'map'))});
  md.classList.add('wide');
  const re=()=>openMapMgr();
  if(MM.tab==='loc'){const mp=$('#mm_map',md);
   {const bk=md.querySelector('[data-mmbulk]');if(bk)bk.onchange=()=>{const fs=[...bk.files];if(fs.length){A().closeModal();bulkLocBg(fs)}}}
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
   if(k==='mujin'){if(!(await askOk('무진 기본 지도를 쓸까? (핀이 없으면 기본 장소 목록이 들어간다)','쓴다','그만')))return re();await saveMap({img:null,preset:'mujin',locs:M.locs.length&&!isMujin?M.locs:[]});return re()}
   if(k==='notes'){A().closeModal();return window.OM_NOTES&&OM_NOTES.importMap()}
   if(k==='noimg'){if(!(await askOk('지도를 비울까? (핀·루트·인물은 남는다)','비운다','그만')))return re();await saveMap({img:null,preset:'none'});return re()}
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
   if(k==='autobg'){await saveMap({autoBg:b.checked?1:0});return}
   if(k==='lbg'){A().closeModal();return pickLocBg(+b.dataset.n,()=>openMapMgr('loc'))}
   if(k==='lbgmatch'){const cur=mapS();const items=bgGroups().flatMap(g=>(g.i||[]).filter(i=>i&&i.src).map(i=>({src:i.src,name:i.l||i.n||''})));const hits=[];
    const locs=cur.locs.map(l=>{if(locBg(l))return l;const k=lbKey(l.name);if(!k)return l;const it=items.find(i=>lbKey(i.name)===k)||items.find(i=>{const q=lbKey(i.name);return q&&(q.includes(k)||k.includes(q))});if(!it)return l;hits.push(l.n+'. '+l.name);return Object.assign({},l,{bg:{src:it.src,name:it.name||l.name}})});
    if(!hits.length)return A().toast('이름이 맞는 배경이 없다 (이미 배경이 있는 장소는 건너뛴다)');if(!(await askOk(`배경 목록에서 ${hits.length}곳을 찾았다. 넣을까?\n${hits.slice(0,12).join('\n')}${hits.length>12?'\n…':''}`,'넣는다','그만')))return openMapMgr('loc');await saveMap({locs});A().toast(`장소 배경 ${hits.length}곳`);return openMapMgr('loc')}
   if(k==='pmove'){await partyMove(+b.dataset.n);return re()}
   if(k==='nadd'){const sel=$('#mm_np',md);const opt=sel.options[sel.selectedIndex];const name=$('#mm_npn',md).value.trim()||sel.value;if(!name)return A().toast('인물을 고르거나 이름을 적어 줘');const img=(opt&&opt.dataset.img)||(pics.find(p=>p.name===name)||{}).img||'';
    await saveMap({npcs:[...M.npcs,{id:'p'+Date.now().toString(36),name,img,n:+$('#mm_nploc',md).value,size:$('#mm_npsz',md).value,vis:$('#mm_npvis',md).checked?1:0,at:Date.now()}]});return re()}
   if(k==='nmove'){const ns=M.npcs.map((x,i)=>i===+b.dataset.i?Object.assign({},x,{n:+b.value,at:Date.now()}):x);await saveMap({npcs:ns});return re()}
   if(k==='nvis'){const ns=M.npcs.map((x,i)=>i===+b.dataset.i?Object.assign({},x,{vis:x.vis?0:1}):x);await saveMap({npcs:ns});return re()}
   if(k==='ndel'){await saveMap({npcs:M.npcs.filter((x,i)=>i!==+b.dataset.i)});return re()}
   if(k==='nclr'){await saveMap({npcs:[]});return re()}};
   if(b.tagName==='SELECT'||b.type==='checkbox')b.onchange=h;else b.onclick=h})}

 /* ----- GM 콘솔 (맵툴 Lib:GM 콘솔 = 배경 · 음악 · 공지 · 지도 · 무대 · 연출) -----
    왼쪽 탭 + 위 「지금」 띠(배경 · BGM · 자막 · 중앙 그림 · 파티 위치, 눌러 그 탭으로 · × 로 바로 끄기). 배경 탭은 배경 창(quickBg)을 그대로 안에 띄운다.
    설정 칸은 고치면 바로 저장(저장 버튼 없음). 창을 닫지 않고 계속 쓴다 */
 /* 11-03 감우 (검토 20-12): 콘솔은 마지막에 쓴 탭으로 열린다 (이 브라우저 om_gctab) · 맨 위 「최근」 띠 (배경 3 · 곡 3 · 공지 2 — rp.recentBg · rp.recentBgm · rp.recentNt) */
 const GC={tab:(()=>{try{return localStorage.getItem('om_gctab')||'bg'}catch(e){return 'bg'}})(),nEdit:false,seQ:''};
 /* 연출 탭 카드: 제목 띠(눌러 접기) + 오른쪽 바로 쓰는 단추. 접은 칸은 이 브라우저에 기억 (om_gcfold = {칸:1}) — 11-03 망령 「연출 · 단서 UI 개선」 */
 const GCF=(()=>{try{return JSON.parse(localStorage.getItem('om_gcfold')||'{}')||{}}catch(e){return {}}})();
 function gcFold(k,v){if(v)GCF[k]=1;else delete GCF[k];try{localStorage.setItem('om_gcfold',JSON.stringify(GCF))}catch(e){}}
 function gcCard(k,title,note,acts,inner,cls){return `<section class="gcard ${cls||''} ${GCF[k]?'fold':''}" data-gcard="${k}"><header class="gcard-h"><button type="button" class="gcard-tg" data-gfold="${k}" title="접기 · 펴기"><i aria-hidden="true">▾</i><b>${title}</b></button>${note?`<span class="note">${note}</span>`:''}<span class="sp"></span>${acts?`<div class="gcard-go">${acts}</div>`:''}</header><div class="gcard-b">${inner}</div></section>`}
 /* 「단서 카드」 칸으로 — 접혀 있으면 편다 (단서 버튼 · 보관함 「보내기」) */
 function gcGoClue(){gcFold('clue',0);openConsole('etc');setTimeout(()=>{const g=document.querySelector('.gcclue');if(g){g.classList.remove('fold');g.scrollIntoView({block:'start'})}},60)}
 const GC_TABS=[['bg','🖼','배경'],['bgm','♪','음악'],['notice','📢','공지'],['map','🗺','지도'],['stage','🎭','무대'],['scene','🎬','씬'],['etc','✨','연출'],['se','🔊','효과음'],['misc','✉','귓속말 · 명령']];
 function gcShell(tab,inner){const r=R();const M=mapS();const loc=M.locs.find(x=>x.n===M.party.n);const cap=r.caption||{};
  const now=[`<button class="gcn ${r.bg&&r.bg.src?'':'off'}" data-gnow="bg"><i class="th" style="${r.bg&&r.bg.src?`background-image:url('${cssu(r.bg.src)}')`:''}"></i><span><small>배경</small><b>${esc(r.bg&&r.bg.src?(r.bg.name||'이름 없음'):'없음')}</b></span>${r.bg&&r.bg.src?'<u data-gx="bgx" title="배경 지우기">×</u>':''}</button>`,
   `<button class="gcn ${r.bgm&&r.bgm.src?'':'off'}" data-gnow="bgm"><i class="ic">♪</i><span><small>BGM</small><b>${esc(r.bgm&&r.bgm.src?(r.bgm.title||'곡'):'없음')}</b></span>${r.bgm&&r.bgm.src?'<u data-gx="bgmx" title="모두에게 정지">■</u>':''}</button>`,
   cap.fixed&&cap.text?`<button class="gcn" data-gnow="stage"><i class="ic">💬</i><span><small>고정 자막</small><b>${esc(cap.text)}</b></span><u data-gx="capx" title="자막 풀기">×</u></button>`:'',
   r.center&&r.center.src?`<button class="gcn" data-gnow="etc"><i class="th" style="background-image:url('${cssu(r.center.src)}')"></i><span><small>중앙 그림</small><b>띄우는 중</b></span><u data-gx="centerx" title="내리기">×</u></button>`:'',
   M.img&&M.locs.length?`<button class="gcn ${loc?'':'off'}" data-gnow="map"><i class="ic">📍</i><span><small>파티</small><b>${loc?loc.n+'. '+esc(loc.name):'—'}</b></span></button>`:''].join('');
  const rb=(r.recentBg||[]).map(bgOf).filter(x=>x&&x.src).slice(0,3),rm=(r.recentBgm||[]).filter(x=>x&&bgmUrl(x.g,x.s)).slice(0,3),rn=(r.recentNt||[]).map(id=>notices().find(n=>n.id===id)).filter(Boolean).slice(0,2);
  const recent=rb.length+rm.length+rn.length?`<div class="gcrecent"><small>최근</small>${rb.map(x=>`<button class="gcr ${r.bg&&r.bg.src===x.src?'on':''}" data-grb="${esc(x.k)}" title="배경 「${esc(x.l)}」 — 바로 적용"><i style="background-image:url('${cssu(x.src)}')"></i>${esc(x.l)}</button>`).join('')}${rm.map(x=>`<button class="gcr ${r.bgm&&r.bgm.title===x.s&&r.bgm.group===x.g?'on':''}" data-grm="${esc(x.g)}\u0001${esc(x.s)}" title="${esc(gshort(x.g))} — 모두에게 재생">♪ ${esc(x.s)}</button>`).join('')}${rn.map(n=>`<button class="gcr nt" data-grn="${esc(n.id)}" style="--c:${esc(n.color||'#d9243f')}" title="공지 「${esc(n.title||n.name)}」 — 바로 띄우기">📢 ${esc(n.name)}</button>`).join('')}</div>`:'';
  const md=A().openModal(`<div class="gcx"><div class="gchead"><h2>GM 콘솔</h2><div class="gcnow">${now}</div><button class="btn ghost" data-x>닫기</button></div>${recent}
   <div class="gccols"><nav class="gcnav">${GC_TABS.map(([k,ic,n])=>`<button class="gct ${tab===k?'on':''}" data-gcn="${k}"><i>${ic}</i><span>${n}</span></button>`).join('')}</nav><div class="gcmain" id="gcmain">${inner}</div></div></div>`);
  md.classList.add('gcmodal');
  md.querySelectorAll('[data-gcn]').forEach(b=>b.onclick=()=>openConsole(b.dataset.gcn));
  md.querySelectorAll('[data-grb]').forEach(b=>b.onclick=async()=>{const it=bgOf(b.dataset.grb);if(!it)return;await A().set(['rp','bg'],{src:it.src,name:it.l,at:Date.now()});await A().set(['rp','recentBg'],[it.k,...(R().recentBg||[]).filter(x=>x!==it.k)].slice(0,12));A().toast(`배경: ${it.l}`);openConsole()});
  md.querySelectorAll('[data-grm]').forEach(b=>b.onclick=()=>{const [g,sn]=b.dataset.grm.split('\u0001');playAll(g,sn,()=>openConsole())});
  md.querySelectorAll('[data-grn]').forEach(b=>b.onclick=async()=>{const n=notices().find(x=>x.id===b.dataset.grn);if(!n)return;await fireNotice(n);A().toast(`공지: ${n.name}`);openConsole()});
  md.querySelectorAll('[data-gnow]').forEach(b=>b.onclick=async e=>{const x=e.target.closest('[data-gx]');if(!x)return openConsole(b.dataset.gnow);e.stopPropagation();const k=x.dataset.gx;
   if(k==='bgx')await A().set(['rp','bg'],null);else if(k==='bgmx')await A().set(['rp','bgm'],null);else if(k==='capx')await A().set(['rp','caption'],null);else if(k==='centerx')await A().set(['rp','center'],null);openConsole()});
  const mn=$('#gcmain',md);if(mn)mn.scrollTop=GC.top&&GC.top.t===tab?GC.top.y:0;if(mn)mn.addEventListener('scroll',()=>{GC.top={t:tab,y:mn.scrollTop}});
  return md}
 function openConsole(tab){if(!GC_TABS.some(x=>x[0]===GC.tab))GC.tab='bg';if(tab&&tab!==GC.tab){GC.tab=tab;GC.top=null;try{localStorage.setItem('om_gctab',tab)}catch(e){}}const r=R();const ST=A().ST;
  if(GC.tab==='bg'){QB.con=true;return quickBg()}
  const re=()=>openConsole();let body='';
  const sec=(t,note)=>`<div class="gcsec"><h3>${t}</h3>${note?`<span class="note">${note}</span>`:''}</div>`;
  if(GC.tab==='bgm')body=`<div id="bgmpanel">${bgmPanelHtml()}</div>`;
  else if(GC.tab==='notice'){const ns=notices();
   body=`${sec('공지 띄우기','누르면 모두에게 배너 + 로그')}<input type="text" id="gsub" class="gcwide" placeholder="멘트를 바꿔 보내기 — 비우면 저장된 멘트">
    <div class="gcnot">${ns.map((n,i)=>`<button class="gno" data-gc="note" data-i="${i}" style="--c:${esc(n.color)}"><b>${esc(n.name)}</b><span>${esc(n.title&&n.title!==n.name?n.title:'')}${n.ment?`${n.title&&n.title!==n.name?' · ':''}${esc(n.ment)}`:''}</span>${n.bgm==='stop'?'<em>BGM 정지</em>':''}</button>`).join('')}<button class="gno cut" data-gc="cut" style="--c:#5b6278"><b>절취선</b><span>로그에 가로줄</span></button></div>
    <details class="gcdet" id="gnd" ${GC.nEdit?'open':''}><summary>공지 고치기 <span class="note">고치면 바로 저장</span></summary>
     <div class="gnrows" id="ntab">${ns.map((n,i)=>`<div class="gnr"><input type="color" data-nc value="${esc(n.color)}" title="색"><input type="text" data-nn value="${esc(n.name)}" placeholder="버튼 이름"><input type="text" data-nt value="${esc(n.title)}" placeholder="배너 제목"><input type="text" data-nm value="${esc(n.ment)}" placeholder="멘트"><select data-nb><option value="" ${!n.bgm?'selected':''}>BGM 그대로</option><option value="stop" ${n.bgm==='stop'?'selected':''}>BGM 정지</option></select><select data-ns title="효과음"><option value="" ${!n.se?'selected':''}>효과음 자동</option>${[['none','소리 없음'],['Ping2','Ping2 (띵)'],['Draw','Draw (공개)'],['Ping','Ping (경고)'],['dice','dice (주사위)'],['Blow','Blow (타격)']].map(([v,l])=>`<option value="${v}" ${n.se===v?'selected':''}>${l}</option>`).join('')}</select><button class="btn xs ghost danger" data-gc="ndel" data-i="${i}" title="지우기">×</button></div>`).join('')}</div>
     <div class="row" style="margin-top:8px"><button class="btn xs" data-gc="nadd">＋ 공지</button><span class="sp"></span><button class="btn xs ghost" data-gc="nreset">기본값으로</button></div></details>`}
  else if(GC.tab==='map'){const M=mapS();const W=(M.img||{}).w||1000,H=(M.img||{}).h||700;
   const pins=M.img?M.locs.map(l=>{const h=M.vis[l.n]==1;return `<button class="gmp ${h?'hid':''} ${M.party.n===l.n?'pc':''}" data-gc="pgo" data-n="${l.n}" style="left:${l.x/W*100}%;top:${l.y/H*100}%" title="${esc(l.name)}${h?' (가림)':''} — 눌러서 파티 이동"><b>${M.party.n===l.n?'PC':l.n}</b></button>`}).join(''):'';
   body=`<div class="gcmap"><div>${M.img?`<div class="gmmini" style="aspect-ratio:${W}/${H};background-image:url('${cssu(M.img.src)}')">${pins}</div><div class="small dim" style="margin-top:4px">번호를 누르면 파티가 그곳으로 간다${M.reveal?' (가린 곳이면 함께 공개)':''}. 흐린 번호는 가린 장소.</div>`:`<div class="gcempty">지도 그림이 없다<br><button class="btn sm" data-gc="mapmgr" data-t="img">지도 그림 올리기</button></div>`}</div>
    <div>${sec('파티')}<div class="row"><button class="btn sm ${M.party.vis?'':'pri'}" data-gc="pvis">${M.party.vis?'👁 핀 보임':'🙈 핀 숨김'}</button><label class="small"><input type="checkbox" data-gc="reveal" ${M.reveal?'checked':''}> 가린 곳으로 가면 함께 공개</label></div>
     ${sec('장소',`${M.locs.filter(l=>M.vis[l.n]!=1).length}/${M.locs.length} 공개`)}<div class="gmlocs">${M.locs.map(l=>{const h=M.vis[l.n]==1;return `<div class="gml ${h?'hid':''} ${M.party.n===l.n?'pc':''}"><span class="no">${l.n}</span><span class="nm">${esc(l.name)}</span>${M.party.n===l.n?'<span class="tag me">파티</span>':`<button class="btn xs ghost" data-gc="pgo" data-n="${l.n}">이동</button>`}${locBg(l)?`<button class="btn xs ghost lbbtn" data-gc="lbguse" data-n="${l.n}" title="무대 배경을 「${esc(l.bg.name||'')}」 로"><i class="lbmini" style="background-image:url('${cssu(l.bg.src)}')"></i></button>`:''}<button class="btn xs ${h?'pri':'ghost'}" data-gc="lvis" data-n="${l.n}">${h?'🙈':'👁'}</button></div>`}).join('')||'<div class="small dim">장소가 없다</div>'}</div>
     <div class="row" style="margin-top:10px"><button class="btn sm" data-gc="mapmgr" data-t="loc">지도 관리 (장소 · 루트 · 인물)</button><button class="btn sm ghost" data-gc="mapopen">${mapOpen?'무대 지도 닫기':'무대에 지도 열기'}</button></div></div></div>`}
  else if(GC.tab==='stage'){const manual=r.stage||{};const chars=[{key:'gm',name:'GM'},...Object.keys(gmProfs()).filter(n=>gmProfs()[n]).map(n=>({key:'gm@'+n,name:'GM · '+n})),...Object.values((ST.state.roster||{}).trainers||{}).map(t=>({key:t.id,name:t.name})),...Object.values((ST.state.graph||{}).nodes||{}).filter(n=>n.kind!=='org').map(n=>({key:'npc:'+n.name,name:n.name+' (NPC)'}))];
   const slotCard=s=>{const m=manual[s]||{};const c=m.key?charOf(m.key):null;const src=c?standSrc(c):'';return `<div class="gss ${m.key?'set':''}"><div class="gssp ${m.flip?'flip':''}" style="${src?`background-image:url('${cssu(src)}')`:''}">${src?'':`<span>${m.key?'그림 없음':'자동'}</span>`}</div><b>${{left:'왼쪽',center:'가운데',right:'오른쪽'}[s]}</b><select data-slot="${s}"><option value="">(자동 — 말하는 사람)</option>${chars.map(x=>`<option value="${esc(x.key)}" ${m.key===x.key?'selected':''}>${esc(x.name)}</option>`).join('')}</select><label class="small"><input type="checkbox" data-flip="${s}" ${m.flip?'checked':''} ${m.key?'':'disabled'}> 좌우 반전</label></div>`};
   const bb=r.bubble||{};const bslot=(k,l)=>`<div class="gbs">${bb[k]?`<div class="gbpv" style="background-image:url('${cssu(bb[k])}')"><u data-gc="bubx" data-v="${k}" title="지우기">×</u></div>`:`<div class="updz mini gbdz ${k==='r'?'fx':''}" id="bub_${k}" style="--defbub:url('${new URL('img/bubble/'+({c:'plain',l:'left',m:'mid',r:'left'})[k]+'.svg?v=3',location.href).href}')"><b>＋ 올리기</b><span>비우면 기본 그림</span><input type="file" accept="image/*" hidden></div>`}<small>${l}</small></div>`;
   body=`${sec('자리 고정','고르면 바로 무대에 반영 · 비우면 말하는 사람이 자동으로 선다')}<div class="gslots">${SLOTS.map(slotCard).join('')}</div>
    <div class="row" style="margin-top:8px"><button class="btn sm ghost" data-gc="stageclear" title="자리 고정을 풀고 서 있는 스탠딩도 내린다">무대 비우기</button><span class="sp"></span><select id="gsc">${chars.map(c=>`<option value="${esc(c.key)}">${esc(c.name)}</option>`).join('')}</select><button class="btn sm" data-gc="stands">표정·스탠딩 편집</button></div>
    ${sec('고정 자막',(r.caption||{}).fixed?'<b style="color:var(--ok)">고정 중</b>':'비우면 채팅이 그대로 자막')}<div class="row"><input type="text" id="gcn" value="${esc((r.caption||{}).name||'')}" placeholder="이름" style="width:130px"><input type="text" id="gct" value="${esc((r.caption||{}).fixed?(r.caption.text||''):'')}" placeholder="무대에 계속 띄워 둘 대사" style="flex:1"><button class="btn sm" data-gc="cap">고정</button>${(r.caption||{}).fixed?'<button class="btn sm ghost" data-gc="capx">풀기</button>':''}</div>
    ${sec('대사 상자 모양','그림 말풍선은 대사에만 — 꼬리는 말하는 사람 자리 쪽, 지문은 꼬리 없는 나레이션')}<div class="row gbm"><button class="btn sm ${bb.on?'ghost':'pri'}" data-gc="bubon" data-v="">기본 (검은 띠)</button><button class="btn sm ${bb.on?'pri':'ghost'}" data-gc="bubon" data-v="1">그림 말풍선</button></div>
    <div class="gbslots">${bslot('c','꼬리 없음 · 지문·자막')}${bslot('l','꼬리 왼쪽 · 왼쪽 화자')}${bslot('m','꼬리 가운데 · 가운데 화자')}${bslot('r','꼬리 오른쪽 · 오른쪽 화자')}</div><div class="small dim">900×400 가로 말풍선 기준 (움직이는 APNG 그대로). 한쪽 꼬리만 있으면 반대쪽은 뒤집어 쓴다. 비운 칸은 오레마스 기본 그림(검은 상자 · 흰 테두리)을 쓴다. 그림은 이 방 저장소에만.</div>
    ${(()=>{const st=stOf(bb.st);return `<div class="gbst"><label>글꼴 <select id="gbf">${BUB_FONTS.map(([v,l])=>`<option value="${v}" ${(st.font||'')===v?'selected':''}>${esc(l)}</option>`).join('')}</select></label>
     <label>글자 크기 <input type="range" id="gbs" min="60" max="170" step="5" value="${st.fs}"><b id="gbs_v">${st.fs}%</b></label>
     <label>상자 크기 <input type="range" id="gbw" min="30" max="85" step="1" value="${st.w}"><b id="gbw_v">${st.w}%</b></label>
     <label>굵기 <select id="gbb">${[['','굵게 (기본)'],['400','보통'],['500','중간'],['900','아주 굵게']].map(([v,l])=>`<option value="${v}" ${String(st.wt||'')===v?'selected':''}>${l}</option>`).join('')}</select></label>
     <button class="btn xs ghost" data-gc="bubst0">원래대로</button><button class="btn xs ghost" data-gc="bubstcp" title="지금 무대 설정 값을 글자로 복사 (반디에게 보내면 코드 기본값으로 넣는다)">값 복사</button></div>
     ${(()=>{/* 10-23 망령: 예시 무대에서 가운데 · 왼쪽 · 오른쪽 대사창과 지문 상자를 끌어서 옮긴다 (st.dx/dy · lx/ly · rx/ry · nx/ny = 무대 폭·높이의 %) */const bgs=(r.bg||{}).src;const w=(+st.w||52)*BUB_PC;const u=k=>new URL('img/bubble/'+k+'.svg?v=3',location.href).href;
      const box=g=>{const x=st[g.kx]||0,y=st[g.ky]||0;return `<div class="gbpbox ${g.k}" id="gbp_${g.k}" style="width:${w}%;left:calc(${g.base(w)}% + ${x}%);bottom:calc(${g.b0}% + ${y}%)"><i class="gbpbg" style="background-image:url('${cssu(g.src)}')${g.flip?';transform:scaleX(-1)':''}"></i><span class="gbpn">${g.lab}</span><span class="gbpt">${g.txt}</span></div>`};
      const G=GBP.map(g=>Object.assign({},g,{src:g.k==='d'?((bb.on&&bb.m)||u('mid')):g.k==='l'?((bb.on&&bb.l)||u('left')):g.k==='r'?((bb.on&&bb.r)||u('left')):((bb.on&&bb.c)||u('plain')),flip:g.k==='r'&&!(bb.on&&bb.r)}));
      return `<div class="gbpos"><div class="gbph"><b>대사창 · 지문 상자 위치</b><span class="small dim">고를 상자를 누르고 예시 상자를 끌어서 옮기면 무대에 바로 보이고, 손을 떼면 저장</span><span class="sp"></span><span class="gbpsel">${GBP.map((g,n)=>`<button class="btn xs ${n?'ghost':'pri'}" data-gbp="${g.k}">${g.btn}</button>`).join('')}</span><button class="btn xs ghost" id="gbp0">위치만 원래대로</button></div>
       <div class="gbpst" data-sel="d" id="gbpst" style="${bgs?`background-image:url('${cssu(bgs)}')`:''}">${G.map(box).join('')}</div></div>`})()}<div class="small dim">글꼴 · 글자 크기 · 굵기는 기본 띠와 그림 말풍선 모두에, 상자 크기는 그림 말풍선에, 대사창 · 지문 상자 높이는 둘 다에 (무대 높이의 %, + 는 위로). 움직이면 무대에 바로 미리 보이고 손을 떼면 모두에게 저장된다.</div>`})()}`}
  else if(GC.tab==='scene'){const L=scenes();const cal=ST.state.calendar||{};
   const card=(sc,i)=>{const bgs=sc.bg&&sc.bg.src;const st=sc.stage||{};const names=SLOTS.map(k=>st[k]&&st[k].key?(charOf(st[k].key)||{}).name||st[k].key:'').filter(Boolean);const id=esc(sc.id);const sub=sc.sub?String(sc.sub).trim().replace(/\s+/g,' '):'';
    return `<div class="gsc ${sc.from==='notes'?'ntsc':''}"><div class="gscth" style="${bgs?`background-image:url('${cssu(bgs)}')`:''}">${bgs?'':'<span>배경 없음</span>'}</div><div class="gscbd"><b>${esc(sc.name||'(이름 없음)')}${sc.from==='notes'?' <small class="gscfrom" title="세션 노트 「▶ 웹툴로」 가 보낸 장면">노트에서</small>':''}</b>
     <div class="gscl"><span>🖼 ${esc(sc.bg&&sc.bg.src?(sc.bg.name||'이름 없는 배경'):'없음')}</span><span>♪ ${esc(sc.bgm&&sc.bgm.src?sc.bgm.title||'곡':'정지')}</span><span>🎭 ${names.length?esc(names.join(' · ')):'자동'}</span><span>💬 ${sc.cap&&sc.cap.text?esc(sc.cap.text):'없음'}</span>${sc.wx||sc.ph?`<span>☀ ${esc([sc.wx,sc.ph].filter(Boolean).join(' · '))}</span>`:''}${sub?`<span class="gscsub" title="${esc(sub)}">📖 ${esc(sub.length>60?sub.slice(0,60)+'…':sub)}</span>`:''}</div>
     <div class="gsca"><button class="btn xs pri" data-gc="scuse" data-id="${id}" title="배경 · BGM · 자리 · 자막을 한 번에${sub?' (노트 낭독문은 나레이션 줄로)':''}">적용</button><button class="btn xs" data-gc="scren" data-id="${id}" title="이름 바꾸기">이름</button><button class="btn xs ghost" data-gc="scover" data-id="${id}" title="지금 무대 모습으로 이 프리셋을 덮어쓴다">지금 무대로</button><span class="sp"></span><button class="btn xs ghost" data-gc="scmv" data-id="${id}" data-d="-1" ${i<=0?'disabled':''}>▲</button><button class="btn xs ghost" data-gc="scmv" data-id="${id}" data-d="1" ${i>=L.length-1?'disabled':''}>▼</button><button class="btn xs ghost danger" data-gc="scdel" data-id="${id}">×</button></div></div></div>`};
   body=`${sec('씬 프리셋','배경 + BGM + 스탠딩 자리 + 고정 자막(+ 날씨 · 시간대)을 이름 붙여 두고 한 번에 적용 — 플레이어에겐 보이지 않는다')}
    <div class="row gscnew"><input type="text" id="gscn" placeholder="프리셋 이름 (예: 1화 교실 · 아침)" style="flex:1"><label class="small" title="캘린더의 날씨 · 시간대도 함께 저장한다"><input type="checkbox" id="gscwx" ${GC.scWx?'checked':''}> 날씨 · 시간대 포함</label><button class="btn sm pri" data-gc="scsave">지금 무대를 프리셋으로</button></div>
    <div class="small dim" style="margin:-2px 0 8px">지금: 🖼 ${esc(r.bg&&r.bg.src?(r.bg.name||'이름 없는 배경'):'없음')} · ♪ ${esc(r.bgm&&r.bgm.src?r.bgm.title:'정지')} · 🎭 ${esc(SLOTS.map(k=>(r.stage||{})[k]&&r.stage[k].key?(charOf(r.stage[k].key)||{}).name||r.stage[k].key:'').filter(Boolean).join(' · ')||'자동')} · 💬 ${esc((r.caption||{}).fixed&&r.caption.text?r.caption.text:'없음')}${cal.weather||cal.phase?' · ☀ '+esc([cal.weather,cal.phase].filter(Boolean).join(' · ')):''}</div>
    <div class="gscs">${L.map(card).join('')||'<div class="gcempty">아직 프리셋이 없다 — 무대를 꾸민 뒤 위 칸에 이름을 적고 「지금 무대를 프리셋으로」</div>'}</div>`}
  else if(GC.tab==='etc'){const CI=R().cutin||{};const sel=(id,cur,opts)=>`<select id="${id}" data-ci>${opts.map(([v,l])=>`<option value="${v}" ${String(cur)===v?'selected':''}>${l}</option>`).join('')}</select>`;
   /* 11-03 14:01 망령 「연출이랑 단서카드 보관소 UI 개선」: 섹션을 카드(제목 띠)로 묶고, 바로 쓰는 단추는 제목 띠 오른쪽에 크게 · 설정은 접기(이 브라우저 om_gcfold) — 저장 키 · 함수는 그대로 */
   const row=(l,ctl)=>`<label class="gfrow"><span>${l}</span>${ctl}</label>`;const on=r.center&&r.center.src;
   body=`<div class="gcfx">${gcCard('cut','컷인 · 연출','설정은 고치면 바로 저장',`<button class="btn pri" data-gc="cutvs" title="VS 컷인 — 지금 모두에게">▶ VS</button><button class="btn" data-gc="cutwarn" title="경고 연출 — 지금 모두에게">▶ 경고</button><button class="btn ghost" data-gc="cuttest" title="컷인 시험 (GM 컷인 한 번)">시험</button>`,
     `<div class="gfgrid"><div class="gfcol"><small>켜고 끄기</small>${row('시합 개시',sel('gci_start',CI.start||'vs',[['vs','일반 (VS 컷인)'],['warn','경고 (위험 등장)'],['off','끄기']]))}${row('컷인 전체',sel('gci_on',String(CI.on)==='0'?'0':'1',[['1','켜기'],['0','끄기']]))}${row('지령·명령 컷인',sel('gci_ord',String(CI.ord)==='0'?'0':'1',[['1','켜기'],['0','끄기']]))}${row('포텐셜 컷인',sel('gci_pot',CI.pot||'excl',[['excl','전용·고유만'],['all','모두'],['none','끄기']]))}</div>
      <div class="gfcol"><small>모양</small>${row('크기 %',`<input type="number" class="n" id="gci_sc" data-ci value="${CI.sc||70}" min="40" max="120">`)}${row('위치',sel('gci_pos',CI.pos||'mid',[['mid','가운데'],['top','위'],['bot','아래']]))}${row('경고 제목',`<input type="text" id="gci_wt" data-ci value="${esc(CI.warnTitle||'')}" placeholder="강적 출현">`)}</div></div>`)}
    ${gcCard('center','중앙 그림','무대 한가운데 크게 — 증거 · 편지 · 장면 컷',`${on?'<button class="btn ghost" data-gc="centerx" title="모두의 무대에서 내리기">내리기</button>':''}<button class="btn pri" data-gc="center" title="아래 주소의 그림을 모두에게">띄우기</button>`,
     `<div class="gcctr"><div class="gcpv ${on?'on':''}" style="${on?`background-image:url('${cssu(r.center.src)}')`:''}">${on?'<i>띄우는 중</i>':'<span>없음</span>'}</div>
      <div class="gcctr-r"><input type="text" id="gci" placeholder="그림 주소 https://… — 적고 「띄우기」"><div class="updz mini" id="gcidz"><b>＋ 그림 올리기</b><span>끌어 놓기 · 클릭 · Ctrl+V — 올리면 바로 띄운다</span><input type="file" accept="image/*" hidden></div></div></div>`)}
    ${clueConsoleHtml(r)}</div>`}
  else if(GC.tab==='se'){const SG=seList();
   body=`${sec('효과음','누르면 모두에게 한 번 · 배틀의 명중/급소/빗나감/빈사/주사위/공개는 자동')}<div class="row"><input type="search" id="gseq" placeholder="효과음 이름으로 찾기" value="${esc(GC.seQ)}" style="flex:1"></div>
    <div class="gsel">${Object.keys(SG).sort().map(g=>`<div class="gseg" data-seg><div class="small dim">${esc(g.replace(/^\d+\.\s*/,''))}</div><div class="gsec">${Object.keys(SG[g]).map(n=>`<button class="chip" data-gc="se" data-n="${esc(n)}" data-q="${esc(n.toLowerCase())}">${esc(n)}</button>`).join('')}</div></div>`).join('')}</div>
    <div class="row" style="margin-top:8px"><input type="text" id="gseu" placeholder="목록에 없는 효과음 — 직링크 (mp3/wav)" style="flex:1"><button class="btn sm" data-gc="seurl">울리기</button></div>`}
  else{const seats=Object.entries(ST.state.seats||{});
   body=`${sec('귓속말','받는 사람과 GM 만 본다')}${seats.length?`<div class="row"><select id="gwto">${seats.map(([k,v])=>`<option value="${esc(k)}">${esc((((ST.state.roster||{}).trainers||{})[k]||{}).name||k)} (${esc(v.name)})</option>`).join('')}</select><input type="text" id="gwt" placeholder="메시지 — 엔터로 보내기" style="flex:1"><button class="btn sm pri" data-gc="whisper">보내기</button></div>`:'<div class="small dim">아직 자리에 앉은 플레이어가 없다</div>'}
    ${sec('채팅 명령')}<table class="t small gccmd"><tr><td><code>/as 이름 말</code></td><td>그 인물로 말하기 (관계도의 NPC 면 스탠딩·아바타가 따라온다)</td></tr><tr><td><code>@표정 말</code></td><td>표정(스탠딩)을 바꾸며 말하기</td></tr><tr><td><code>/s 라벨</code></td><td>표정만 바꾸기</td></tr><tr><td><code>*지문*</code></td><td>따옴표 없는 기울임 지문</td></tr><tr><td><code>/img 주소</code></td><td>채팅에 그림</td></tr><tr><td><code>/r 1d100</code></td><td>주사위</td></tr><tr><td><code>/gr 1d100</code></td><td>GM 비밀 굴림 — 나만 보이는 줄로, 줄의 「공개」를 누르면 같은 결과를 모두에게</td></tr><tr><td><code>/w 이름 말</code></td><td>귓속말 (GM 에게는 /w GM)</td></tr><tr><td><code>/clear</code></td><td>무대의 스탠딩 모두 내리기</td></tr></table>`}
  const md=gcShell(GC.tab,body);
  /* 공지 고치기: 칸을 고치면 바로 저장 */
  const saveN=async()=>{const rows=[...md.querySelectorAll('#ntab .gnr')].map((tr,i)=>({id:'n'+i,name:tr.querySelector('[data-nn]').value.trim(),title:tr.querySelector('[data-nt]').value.trim(),ment:tr.querySelector('[data-nm]').value,color:tr.querySelector('[data-nc]').value,bgm:tr.querySelector('[data-nb]').value,se:tr.querySelector('[data-ns]').value})).filter(x=>x.name);await A().set(['rp','notices'],rows);A().toast('공지를 저장했다')};
  md.querySelectorAll('#ntab input,#ntab select').forEach(x=>x.addEventListener('change',saveN));
  const nd=$('#gnd',md);if(nd)nd.ontoggle=()=>{GC.nEdit=nd.open};
  md.querySelectorAll('[data-gfold]').forEach(b=>b.onclick=()=>{const cd=b.closest('.gcard');if(cd)gcFold(b.dataset.gfold,cd.classList.toggle('fold'))});
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
   if(k==='nreset'){if(!(await askOk('공지를 기본 8개로 되돌릴까?','되돌린다','그만')))return re();await A().set(['rp','notices'],null);return re()}
   if(k==='pgo'){await partyMove(+b.dataset.n);return re()}
   if(k==='lvis'){await toggleLoc(+b.dataset.n);return re()}
   if(k==='lbguse'){const l=mapS().locs.find(x=>x.n===+b.dataset.n);if(l)await useLocBg(l);return re()}
   if(k==='pvis'){const M=mapS();await saveMap({party:Object.assign({},M.party,{vis:M.party.vis?0:1})});return re()}
   if(k==='reveal'){await saveMap({reveal:b.checked?1:0});return re()}
   if(k==='mapmgr')return openMapMgr(b.dataset.t||'loc');
   if(k==='mapopen'){mapOpen=!mapOpen;A().renderScene();return re()}
   if(k==='scsave'){const n=$('#gscn',md).value.trim();if(!n)return A().toast('프리셋 이름을 적어 줘');GC.scWx=$('#gscwx',md).checked;const sc=sceneNow(n,GC.scWx);await sceneWrite(sc.id,sc);A().toast(`「${n}」 프리셋을 저장했다`);return re()}
   if(k==='scuse'){const sc=sceneOf(b.dataset.id);if(sc)await sceneApply(sc);return re()}
   if(k==='scren'){const sc=sceneOf(b.dataset.id);if(!sc)return;const n=prompt('프리셋 이름',sc.name||'');if(n==null||!n.trim())return;sc.name=n.trim();await sceneWrite(sc.id,sc);return re()}
   if(k==='scover'){const sc=sceneOf(b.dataset.id);if(!sc)return;if(!(await askOk(`「${sc.name}」 을 지금 무대 모습으로 덮어쓸까?`,'덮어쓴다','그만')))return re();const nv=Object.assign(sceneNow(sc.name,!!(sc.wx||sc.ph)),{id:sc.id,_k:sc._k,ord:scOrd(sc),at:sc.at||Date.now()});if(sc.from)nv.from=sc.from;await sceneWrite(sc.id,nv);A().toast('덮어썼다');return re()}
   if(k==='scmv'){const L=scenes();const j=L.findIndex(x=>x.id===b.dataset.id),t=j+(+b.dataset.d);if(j<0||t<0||t>=L.length)return;[L[j],L[t]]=[L[t],L[j]];await sceneReorder(L);return re()}
   if(k==='scdel'){const sc=sceneOf(b.dataset.id);if(!sc||!confirm(`「${sc.name}」 프리셋을 지울까?`))return;await sceneWrite(sc.id,null);return re()}
   if(k==='stageclear'){await A().set(['rp','stage'],null);await DBS().addLog(ST.room,ST.secret,'chat',ST.name,{t:'',clear:1});return re()}
   if(k==='stands')return openStands($('#gsc',md).value);
   if(k==='cap'){const t=$('#gct',md).value.trim();if(!t)return A().toast('자막을 적어 줘');await A().set(['rp','caption'],{name:$('#gcn',md).value.trim(),text:t,at:Date.now(),fixed:true});return re()}
   if(k==='capx'){await A().set(['rp','caption'],null);return re()}
   if(k==='bubon'){await A().set(['rp','bubble','on'],b.dataset.v?true:null);return re()}
   if(k==='bubx'){await A().set(['rp','bubble',b.dataset.v],null);return re()}
   if(k==='bubst0'){await A().set(['rp','bubble','st'],null);return re()}
   if(k==='bubstcp'){const t='무대설정 '+JSON.stringify(stOf((R().bubble||{}).st));let ok=false;try{await navigator.clipboard.writeText(t);ok=true}catch(e){}if(ok)A().toast('복사했다 — 반디에게 붙여 넣어 줘');else prompt('이 글을 길게 눌러 복사',t);return}
   if(k==='center'){const u=$('#gci',md).value.trim();if(!u){const cd=b.closest('.gcard');if(cd){cd.classList.remove('fold');gcFold('center',0)}const f=$('#gci',md);if(f)f.focus();return A().toast('그림 주소를 적거나 그림을 올려 줘')}await A().set(['rp','center'],{src:u,at:Date.now()});return re()}
   if(k==='centerx'){await A().set(['rp','center'],null);return re()}
   if(['clue','cluesave','clueupd'].includes(k)){const c={t:$('#gclt',md).value.trim().slice(0,60),d:$('#gcld',md).value.trim().slice(0,1200),img:$('#gcli',md).value.trim().slice(0,600),g:$('#gclg',md).value.trim().slice(0,30)};GC.clT=c.t;GC.clD=c.d;GC.clI=c.img;GC.clGr=c.g;if(!c.t&&!c.d&&!c.img)return A().toast('제목 · 설명 · 그림 중 하나는 있어야 한다');
    const L=(Array.isArray(R().clueLib)?R().clueLib:[]).slice();
    if(k==='cluesave'){const it=Object.assign({id:'c'+Date.now().toString(36)},c);L.unshift(it);await A().set(['rp','clueLib'],L.slice(0,120));GC.clEdit=it.id;A().toast('단서 목록에 저장했다');return re()}
    if(k==='clueupd'){const j=L.findIndex(x=>x.id===GC.clEdit);if(j<0)return A().toast('고치던 단서가 목록에 없다');L[j]=Object.assign({},L[j],c);await A().set(['rp','clueLib'],L);A().toast('고친 내용을 저장했다');return re()}
    await showClueRp(Object.assign({},c,GC.clEdit?{id:GC.clEdit}:{}),GC.clTo&&GC.clTo.length?GC.clTo:'all');return re()}
   if(k==='clueto'){const id=b.dataset.id;if(!id)GC.clTo=[];else{const T=(GC.clTo||[]).slice();const i=T.indexOf(id);if(i>=0)T.splice(i,1);else T.push(id);GC.clTo=T}return re()}
   if(k==='cluebox')return openClueBox();
   if(k==='cluelib'){const c=(R().clueLib||[]).find(x=>x.id===b.dataset.id);if(c)await showClueRp(c,GC.clTo&&GC.clTo.length?GC.clTo:'all');return re()}
   if(k==='clueed'){const c=(R().clueLib||[]).find(x=>x.id===b.dataset.id);if(c){GC.clT=c.t||'';GC.clD=c.d||'';GC.clI=c.img||'';GC.clGr=c.g||'';GC.clEdit=c.id}gcFold('clue',0);re();setTimeout(()=>{const f=document.getElementById('gclt');if(f){f.scrollIntoView({block:'center'});f.focus()}},50);return}
   if(k==='cluenew'){GC.clT='';GC.clD='';GC.clI='';GC.clEdit='';return re()}
   if(k==='cluedel'){const c=(R().clueLib||[]).find(x=>x.id===b.dataset.id);if(!c||!confirm(`「${c.t||'단서'}」 를 목록에서 지울까?`))return;const L=(R().clueLib||[]).filter(x=>x.id!==c.id);if(GC.clEdit===c.id)GC.clEdit='';await A().set(['rp','clueLib'],L.length?L:null);return re()}
   if(k==='cluegrp'){GC.clG=b.dataset.g||'';return re()}
   if(k==='cluemv'){const L=(R().clueLib||[]).slice();const j=L.findIndex(x=>x.id===b.dataset.id),t=j+(+b.dataset.d);if(j<0||t<0||t>=L.length)return;[L[j],L[t]]=[L[t],L[j]];await A().set(['rp','clueLib'],L);return re()}
   if(k==='cluex'){await A().set(['rp','clue'],null);return re()}
   if(k==='se'){unlocked=true;return playSe(b.dataset.n)}
   if(k==='seurl'){const u=$('#gseu',md).value.trim();if(!u)return;unlocked=true;return playSe(u)}
   if(k==='cutvs'||k==='cutwarn'){const B=window.OM_BATTLE_UI;if(!B||!B.startCut)return;unlocked=true;return B.startCut(k==='cutvs'?'vs':'warn')}
   if(k==='cuttest'){unlocked=true;return window.OM_CUTIN&&window.OM_CUTIN.fire({tok:'gm',src:'',tag:'GM',ment:'『컷인 시험』'})}
   if(k==='whisper'){const to=$('#gwto',md).value,t=$('#gwt',md).value.trim();if(!to||!t)return;await DBS().addLog(ST.room,ST.secret,'whisper',ST.name,{t,to,toName:(((ST.state.roster||{}).trainers||{})[to]||{}).name||to});$('#gwt',md).value='';A().toast('보냈다');return}};
   if(b.type==='checkbox')b.onchange=h;else b.onclick=h});
  if(GC.tab==='bgm')bindBgmPanel(md,re);
  if($('#gbf',md)){const st0=stOf((R().bubble||{}).st);const POS={};for(const k of BUB_POS)POS[k]=+st0[k]||0;const dif=(k,v)=>v===BUB_DEF[k]?null:v;/* 기본값(BUB_DEF)과 다른 것만 저장 */
   const rd=()=>({font:dif('font',$('#gbf',md).value),fs:dif('fs',+$('#gbs',md).value),w:dif('w',+$('#gbw',md).value),...Object.fromEntries(BUB_POS.map(k=>[k,dif(k,POS[k])])),wt:dif('wt',$('#gbb',md).value)});
   const live=()=>{const v=stOf(rd());$('#gbs_v',md).textContent=v.fs+'%';$('#gbw_v',md).textContent=v.w+'%';const d=document.getElementById('dlg');if(d)bubStyle(d,v);const p=$('#gbpst',md);if(p)bubStyle(p,v)};
   const save=async()=>{live();const v=rd();for(const k in v)if(v[k]==null)delete v[k];await A().set(['rp','bubble','st'],Object.keys(v).length?v:null)};
   ['#gbs','#gbw'].forEach(q=>{const e=$(q,md);e.oninput=live;e.onchange=save});
   /* 예시 무대 끌기 */
   const pst=$('#gbpst',md);const drag=g=>{const el=$('#gbp_'+g.k,md);const kx=g.kx,ky=g.ky,b0=g.b0;if(!el)return;el.onpointerdown=e=>{e.preventDefault();el.setPointerCapture(e.pointerId);const R=pst.getBoundingClientRect();const sx=e.clientX,sy=e.clientY,x0=POS[kx]||0,y0=POS[ky]||0;el.classList.add('drag');
     const clamp=(v,a,b)=>Math.max(a,Math.min(b,Math.round(v*2)/2));const w=(+$('#gbw',md).value||52)*BUB_PC;
     const bx=g.base(w);el.onpointermove=ev=>{POS[kx]=clamp(x0+(ev.clientX-sx)/R.width*100,-bx-2,100-w-bx+2);POS[ky]=clamp(y0-(ev.clientY-sy)/R.height*100,-b0-6,80);el.style.left=`calc(${bx}% + ${POS[kx]}%)`;el.style.bottom=`calc(${b0}% + ${POS[ky]}%)`;live()};
     el.onpointerup=el.onpointercancel=()=>{el.onpointermove=null;el.onpointerup=null;el.classList.remove('drag');save()}}};
   GBP.forEach(drag);
   md.querySelectorAll('[data-gbp]').forEach(b=>b.onclick=()=>{const k=b.dataset.gbp;pst.dataset.sel=k;md.querySelectorAll('[data-gbp]').forEach(x=>{x.classList.toggle('pri',x===b);x.classList.toggle('ghost',x!==b)})});
   $('#gbp0',md).onclick=()=>{for(const k of BUB_POS)POS[k]=BUB_DEF[k];save().then(re)};
   $('#gbw',md).addEventListener('input',()=>{const w=(+$('#gbw',md).value||52)*BUB_PC;GBP.forEach(g=>{const el=$('#gbp_'+g.k,md);if(el){el.style.width=w+'%';el.style.left=`calc(${g.base(w)}% + ${POS[g.kx]||0}%)`}})});['#gbf','#gbb'].forEach(q=>$(q,md).onchange=save);live()}
  for(const k of ['c','l','m','r'])if($('#bub_'+k,md))bindDz(md,'#bub_'+k,async fs=>{const u=await upImg(fs[0],'bub_'+k);await A().set(['rp','bubble',k],u);if(!(R().bubble||{}).on)await A().set(['rp','bubble','on'],true);re()});
  if($('#gcidz',md))bindDz(md,'#gcidz',async fs=>{const u=await upImg(fs[0],'rp');await A().set(['rp','center'],{src:u,at:Date.now()});re()});
  [['#gclt','clT'],['#gcld','clD'],['#gcli','clI'],['#gclg','clGr']].forEach(([id,k])=>{const x=$(id,md);if(x)x.addEventListener('input',()=>{GC[k]=x.value;if(k==='clI'){const p=md.querySelector('.gccl-pv');if(p){p.classList.toggle('none',!x.value.trim());p.style.backgroundImage=x.value.trim()?`url('${cssu(x.value.trim())}')`:'';p.textContent=x.value.trim()?'':'그림 없음'}}})});
  {const q=$('#gclq',md);if(q){const f=()=>{GC.clQ=q.value;const w=q.value.trim().toLowerCase();md.querySelectorAll('.gccl-card').forEach(c=>c.hidden=!!w&&!c.dataset.q.includes(w))};q.oninput=f;f()}}
  if($('#gclz',md))bindDz(md,'#gclz',async fs=>{A().toast('올리는 중…');GC.clT=$('#gclt',md).value;GC.clD=$('#gcld',md).value;const u=await upImg(await shrinkPic(fs[0],1600,1600),'clue');GC.clI=u||'';GC.clGr=$('#gclg',md).value;re()})}
 /* 11-03 망령: 씬 프리셋 — rp.scenes.<id> = {id,name,bg:{src,name},bgm,stage,cap,wx,ph,ord,at} (객체 — 서버 om_jset 이 경로 단위로 쓰므로 세션 노트 「▶ 웹툴로」 가 rp.scenes.nt_<루트>_<번호> 에 {…,sub,from:'notes'} 를 끼워 넣어도 서로 안 덮는다).
    예전 배열 [{…}] 이 와도 읽고, 다음 저장 때 객체로 바꿔 쓴다. 차례는 ord(없으면 at). 노트가 보낸 것은 sub(낭독문) 를 자막 대신 보여 주고 「노트에서」 표시. GM 콘솔 「씬」 탭. 적용하면 한 번에 바뀌고 로그 한 줄 */
 function scenesRaw(){const L=R().scenes;if(Array.isArray(L))return L.filter(x=>x&&typeof x==='object').map((x,i)=>Object.assign({ord:(x.ord!=null?x.ord:i)},x,{id:x.id||('sc'+i)}));
  if(L&&typeof L==='object')return Object.keys(L).filter(k=>L[k]&&typeof L[k]==='object').map(k=>Object.assign({},L[k],{id:L[k].id||k,_k:k}));return []}
 const scOrd=x=>x.ord!=null&&isFinite(+x.ord)?+x.ord:(+x.at||0)/1000;
 function scenes(){return scenesRaw().sort((a,b)=>scOrd(a)-scOrd(b)||String(a.name||'').localeCompare(String(b.name||''),'ko'))}
 const sceneOf=id=>scenes().find(x=>x.id===id||x._k===id)||null;
 const scClean=x=>{const o=Object.assign({},x);delete o._k;return o};
 /* 쓰기: 객체 칸 하나만. 아직 배열이면(옛 모양) 통째를 객체로 바꿔 한 번에 쓴다 */
 async function sceneWrite(id,val){const L=R().scenes;if(Array.isArray(L)){const o={};for(const x of scenesRaw()){if(x.id===id)continue;o[x.id]=scClean(x)}if(val)o[id]=scClean(val);return A().set(['rp','scenes'],Object.keys(o).length?o:null)}
  const key=(val&&val._k)||(sceneOf(id)||{})._k||id;return A().set(['rp','scenes',key],val?scClean(val):null)}
 async function sceneReorder(list){const L=R().scenes;const o={};list.forEach((x,i)=>{x.ord=(i+1)*10;o[x._k||x.id]=scClean(x)});if(Array.isArray(L))return A().set(['rp','scenes'],o);return A().setMany(list.map(x=>[['rp','scenes',x._k||x.id,'ord'],x.ord]))}
 function sceneNow(name,withWx){const r=R();const cal=A().ST.state.calendar||{};const L=scenes();const o={id:'sc'+Date.now().toString(36),at:Date.now(),ord:(L.length?Math.max(...L.map(scOrd)):0)+10,name:String(name||'').slice(0,40),bg:r.bg&&r.bg.src?{src:r.bg.src,name:r.bg.name||''}:null,bgm:r.bgm&&r.bgm.src?{src:r.bgm.src,title:r.bgm.title||'',group:r.bgm.group||''}:null,stage:r.stage&&Object.keys(r.stage).length?JSON.parse(JSON.stringify(r.stage)):null,cap:(r.caption||{}).fixed&&r.caption.text?{name:r.caption.name||'',text:r.caption.text}:null};
  if(withWx){o.wx=cal.weather||'';o.ph=cal.phase||''}return o}
 async function sceneApply(sc){const ops=[[['rp','bg'],sc.bg&&sc.bg.src?{src:sc.bg.src,name:sc.bg.name||'',at:Date.now()}:null],[['rp','stage'],sc.stage&&Object.keys(sc.stage).length?sc.stage:null],[['rp','caption'],sc.cap&&sc.cap.text?{name:sc.cap.name||'',text:sc.cap.text,at:Date.now(),fixed:true}:null]];
  const cur=R().bgm||{};if(sc.bgm&&sc.bgm.src){if(cur.src!==sc.bgm.src){const v={src:sc.bgm.src,title:sc.bgm.title||'',group:sc.bgm.group||'',at:Date.now()};const qm=bgmMode();if(qm)v.q=qm;ops.push([['rp','bgm'],v]);unlocked=true}}else if(cur.src)ops.push([['rp','bgm'],null]);
  if(sc.wx!=null||sc.ph!=null){if(sc.wx!=null)ops.push([['calendar','weather'],sc.wx||null]);if(sc.ph!=null)ops.push([['calendar','phase'],sc.ph||null])}
  const ok=await A().setMany(ops);if(ok&&sc.sub&&String(sc.sub).trim()){try{await DBS().addLog(A().ST.room,A().ST.secret,'chat',A().ST.name,{t:'*'+String(sc.sub).trim()+'*',nf:1})}catch(e){console.warn('scene sub',e)}}
  if(ok){syncBgm();const bits=[sc.bg&&sc.bg.src?'배경 '+(sc.bg.name||''):'',sc.bgm&&sc.bgm.src?'♪ '+(sc.bgm.title||''):'',sc.cap&&sc.cap.text?'자막':'',sc.wx||sc.ph?[sc.wx,sc.ph].filter(Boolean).join(' · '):''].filter(Boolean);await A().sysLog(`🎬 씬 — ${sc.name}${bits.length?' ('+bits.join(' · ')+')':''}`);A().toast(`「${sc.name}」 적용`)}return ok}
 /* 단서 카드 칸 (GM 콘솔 「연출」): 위 = 쓰기(새로 · 고치기), 아래 = 저장한 단서 카드 격자(그림 · 제목 · 묶음 · 설명, 찾기 · 묶음 거르기 · 순서) — 10-26 망령 「목록 좀 더 개선」 */
 function clueConsoleHtml(r){const C=r.clue||null,L=Array.isArray(r.clueLib)?r.clueLib:[];const groups=[...new Set(L.map(c=>c.g).filter(Boolean))];if(GC.clG&&!groups.includes(GC.clG))GC.clG='';
  const ed=GC.clEdit&&L.find(c=>c.id===GC.clEdit);if(GC.clEdit&&!ed)GC.clEdit='';
  /* 11-03 망령 「단서 카드 UI 개선」: 왼쪽 그림 칸 + 오른쪽 입력 · 받는 사람은 줄바꿈되는 큰 칩 · 보내기 단추는 폼 아래 고정 줄 */
  const T=clueTargets(),to=(GC.clTo||[]).filter(id=>T.some(x=>x.id===id)),all=!to.length;
  const pv=GC.clI?`<div class="gccl-pv" style="background-image:url('${cssu(GC.clI)}')"></div>`:'<div class="gccl-pv none">그림 없음</div>';
  const form=`${C?`<div class="gccl-live"><i aria-hidden="true">●</i><span>무대에 「${esc(C.t||'단서')}」</span><span class="sp"></span><button class="btn xs ghost" data-gc="cluex" title="모두의 무대에서 내리기">내리기</button></div>`:''}
   <div class="gccl-form ${ed?'editing':''}">${ed?`<div class="gccl-edbar"><span>✎ 「${esc(ed.t||'단서')}」 고치는 중</span><span class="sp"></span><button class="btn xs ghost" data-gc="cluenew">새로 쓰기</button></div>`:''}
   <div class="gccl-fgrid"><div class="updz mini gccl-dz" id="gclz" title="그림 올리기 — 끌어 놓기 · 클릭 · Ctrl+V">${pv}<b>＋ 그림</b><span>끌어 놓기 · 클릭 · Ctrl+V</span><input type="file" accept="image/*" hidden></div>
    <div class="gccl-fl"><div class="gccl-r1"><input type="text" id="gclt" placeholder="제목 (예: 찢어진 작업 일지)" value="${esc(GC.clT||'')}"><input type="text" id="gclg" list="gclgl" placeholder="묶음 (예: 무진 3화)" value="${esc(GC.clGr||GC.clG||'')}"><datalist id="gclgl">${groups.map(g=>`<option value="${esc(g)}">`).join('')}</datalist></div>
     <textarea id="gcld" rows="3" placeholder="설명 — 줄바꿈 그대로">${esc(GC.clD||'')}</textarea><input type="text" id="gcli" placeholder="그림 주소 (비워도 된다 · 왼쪽 칸에 올려도 된다)" value="${esc(GC.clI||'')}"></div></div>
   <div class="gccl-to"><span class="gccl-tol">받는 사람</span><div class="gccl-tos"><button type="button" class="gcto ${all?'on':''}" data-gc="clueto" data-id="" aria-pressed="${all}"><i aria-hidden="true">${all?'✓':''}</i>모두</button>${T.map(x=>{const o=to.includes(x.id);return `<button type="button" class="gcto ${o?'on':''}" data-gc="clueto" data-id="${esc(x.id)}" aria-pressed="${o}" title="${esc(x.name)} 에게만"><i aria-hidden="true">${o?'✓':''}</i>${esc(x.name)}</button>`}).join('')}${T.length?'':'<span class="small dim">자리에 앉은 플레이어가 없다 — 모두에게만</span>'}</div></div>
   <div class="gccl-foot"><button class="btn pri gccl-send" data-gc="clue" title="${all?'모두의 무대에 띄운다':esc(clueToLabel(to))+' 에게만 보낸다 (남은 못 본다)'}">${all?'🔍 모두에게 띄우기':`🔍 보내기 · ${to.length}명`}</button>${all?'':`<span class="gccl-tow" title="${esc(clueToLabel(to))}">${esc(clueToLabel(to))}</span>`}<span class="sp"></span>${ed?'<button class="btn" data-gc="clueupd" title="고친 내용을 이 항목에 저장">✓ 저장</button><button class="btn ghost" data-gc="cluesave" title="새 항목으로 하나 더 저장">＋ 새로</button>':'<button class="btn" data-gc="cluesave" title="아래 「저장한 단서」 목록에 저장">＋ 저장</button>'}</div></div>`;
  const shown=L.filter(c=>!GC.clG||c.g===GC.clG);
  const lib=L.length?`${L.length>4?`<div class="gccl-libh"><input type="search" id="gclq" placeholder="찾기 — 제목 · 설명 · 묶음" value="${esc(GC.clQ||'')}"></div>`:''}${groups.length?`<div class="gccl-grps"><button class="chip ${!GC.clG?'on':''}" data-gc="cluegrp" data-g="">전체 ${L.length}</button>${groups.map(g=>`<button class="chip ${GC.clG===g?'on':''}" data-gc="cluegrp" data-g="${esc(g)}">${esc(g)} ${L.filter(c=>c.g===g).length}</button>`).join('')}</div>`:''}
   <div class="gccl-grid">${shown.map(c=>{const live=C&&(C.id?C.id===c.id:(C.t===c.t&&C.img===c.img));const i=L.indexOf(c);return `<div class="gccl-card ${live?'live':''} ${GC.clEdit===c.id?'ed':''}" data-q="${esc(((c.t||'')+' '+(c.d||'')+' '+(c.g||'')).toLowerCase())}">
    <button class="gccl-th" data-gc="cluelib" data-id="${esc(c.id)}" title="눌러서 ${all?'모두에게 띄우기':esc(clueToLabel(to))+' 에게 보내기'}" style="${c.img?`background-image:url('${cssu(c.img)}')`:''}">${c.img?'':'<span>🔍</span>'}${live?'<i>무대에</i>':''}</button>
    <div class="gccl-bd"><b title="${esc(c.t||'')}">${esc(c.t||'(제목 없음)')}</b>${c.g?`<em>${esc(c.g)}</em>`:''}<p>${esc(c.d||'')}</p></div>
    <div class="gccl-ac"><button class="btn xs pri" data-gc="cluelib" data-id="${esc(c.id)}">${all?'띄우기':'보내기'}</button><button class="btn xs" data-gc="clueed" data-id="${esc(c.id)}" title="위 칸에 불러와 고치기">고치기</button><span class="sp"></span><button class="btn xs ghost" data-gc="cluemv" data-id="${esc(c.id)}" data-d="-1" title="앞으로" ${i<=0?'disabled':''}>◀</button><button class="btn xs ghost" data-gc="cluemv" data-id="${esc(c.id)}" data-d="1" title="뒤로" ${i>=L.length-1?'disabled':''}>▶</button><button class="btn xs ghost danger" data-gc="cluedel" data-id="${esc(c.id)}" title="지우기">×</button></div></div>`}).join('')||'<div class="small dim">이 묶음에 단서가 없다</div>'}</div>`:'<div class="gccl-empty small dim">저장한 단서가 없다 — 위에 쓰고 「＋ 저장」을 누르면 여기에 카드로 모인다. 세션 전에 미리 만들어 두고 한 번에 띄우면 된다.</div>';
  return gcCard('clue','단서 카드','받는 사람을 고르면 그 사람에게만 (남은 못 본다)','<button class="btn ghost" data-gc="cluebox" title="보낸 단서 전체 · 좌석별 · 회수">보관함</button>',form,'gcclue')+gcCard('lib',`저장한 단서 <small>${L.length}</small>`,L.length?'카드 그림을 누르면 바로 띄운다':'','<button class="btn ghost" data-gc="cluebox" title="단서 보관함 「📚 단서 목록」에서 만들기 · 고치기 · 복제 · 삭제">보관함에서 관리 ›</button>',lib,'gcclib')}
 /* 10-26 망령 「던전 단서 출력 기능을 RP 쪽에도」: rp.clue = {t,d,img,at} — 모두의 무대에 카드. 플레이어는 ✕ 로 내 화면에서만 닫고 「🔍 단서」로 다시 연다. GM 의 「모두 닫기」는 모두에게서 내린다
    11-03 망령 「개인 단서 · 단서 보관함」: 대상이 「모두」면 예전처럼 rp.clue (+ rp.clueLog 에 기록), 특정 좌석이면 서버 비밀 칸 om_secret(kind 'clue', id = 좌석) 에 그 사람 목록으로 — 남은 못 읽는다 (schema 그대로, SQL 추가 없음).
    받은 사람은 'clue' 신호(없으면 30초 폴링)로 읽어 무대 카드 + 토스트, 「🔍 단서」 창에서 받은 것을 다시 본다. GM 은 전체 목록 · 회수 */
 const PCL={list:[],at:0,room:'',show:null,t:null,gmAll:null};
 const clueKey=()=>'k'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
 function clueTargets(){const ST=A().ST;const T=(ST.state.roster||{}).trainers||{};return Object.keys(ST.state.seats||{}).map(k=>({id:k,name:(T[k]||{}).name||((ST.state.seats||{})[k]||{}).name||k}))}
 function clueToLabel(to){if(!to||to==='all')return '모두';const N=Object.fromEntries(clueTargets().map(x=>[x.id,x.name]));return to.map(k=>N[k]||k).join(' · ')}
 async function showClueRp(c,to){const v={t:c.t||'',d:c.d||'',img:c.img||'',at:Date.now(),k:clueKey(),scene:(R().bg||{}).name||''};if(c.id)v.id=c.id;
  if(Array.isArray(to)&&to.length){const ok=new Set(clueTargets().map(x=>x.id));to=to.filter(id=>ok.has(id));if(!to.length)return A().toast('받는 사람이 자리에 없다 — 다시 골라 줘')}const all=!to||to==='all'||!to.length;
  if(all){const L=[v,...(Array.isArray(R().clueLog)?R().clueLog:[])].slice(0,60);if(await A().setMany([[['rp','clue'],v],[['rp','clueLog'],L]])){CLUE.hide=0;A().sysLog(`🔍 단서 — ${v.t||'단서'}${v.d?'\n'+v.d:''}`);try{playSe('Draw',true)}catch(e){}}return}
  const ST=A().ST;let rows=[];try{rows=await DBS().secretGet(ST.room,ST.secret,'clue')||[]}catch(e){return A().toast('단서 칸을 읽지 못했다: '+e.message)}
  let n=0;for(const sid of to){const row=rows.find(r=>r.id===sid);const L=(row&&row.data&&Array.isArray(row.data.list)?row.data.list:[]).slice(-80);L.push(Object.assign({},v,{to:sid}));try{await DBS().secretPut(ST.room,ST.secret,'clue',sid,{list:L});n++}catch(e){A().toast(`${clueToLabel([sid])} 에게 보내지 못했다: ${e.message}`)}}
  if(!n)return;try{DBS().broadcast({t:'clue',to,at:v.at})}catch(e){}
  if(A().selfLog)A().selfLog(`🔍 단서 「${v.t||'단서'}」 → ${clueToLabel(to)} (그 사람에게만)`);A().toast(`${clueToLabel(to)} 에게만 보냈다`);PCL.gmAll=null}
 /* 좌석: 내 단서 읽기 (처음 읽을 때는 조용히, 그 뒤 새로 온 것만 카드 + 토스트) */
 async function clueFetch(quiet){const ST=A().ST;if(!ST.role||!ST.secret||!ST.room)return;if(gm())return;const room=ST.room;PCL.tried=room;let rows;try{rows=await DBS().secretGet(room,ST.secret,'clue')||[]}catch(e){console.warn('[오레마스] 단서 읽기 실패',e);return}if(A().ST.room!==room)return;
  const me=rows.find(r=>r.id===ST.seat);const L=me&&me.data&&Array.isArray(me.data.list)?me.data.list:[];const first=PCL.room!==room;const had=new Set(PCL.list.map(x=>x.k));PCL.list=L;PCL.room=room;
  if(PCL.show&&!L.some(x=>x.k===PCL.show.k)){PCL.show=null;CLUE.sig='';A().renderScene()}   /* GM 이 회수했다 */
  const fresh=first?[]:L.filter(x=>!had.has(x.k));
  if(fresh.length&&!quiet){const c=fresh[fresh.length-1];PCL.show=c;CLUE.hide=0;CLUE.sig='';A().toast(`🔍 단서 — ${c.t||'단서'} (나에게만)`);try{playSe('Draw',true)}catch(e){}A().renderScene()}
  else if(fresh.length){CLUE.sig='';A().renderScene()}}
 function onClueEv(p){const ST=A().ST;if(!p)return;if(gm()){PCL.gmAll=null;return}if(ST.role==='seat'&&(!Array.isArray(p.to)||p.to.includes(ST.seat)))clueFetch()}
 setInterval(()=>{try{if(document.visibilityState==='visible'&&A()&&A().ST.role==='seat')clueFetch()}catch(e){}},30000);
 const CLUE={hide:0,sig:''};
 function clueCur(){const c=R().clue;const p=PCL.show;if(p&&(!c||(p.at||0)>=(c.at||0)))return p;return c&&(c.t||c.d||c.img)?c:null}
 function clueRp(stage){if(!stage)return;if(!gm()&&PCL.tried!==A().ST.room&&A().ST.role==='seat')clueFetch(true);const c=clueCur();let box=stage.querySelector(':scope>.rpclue');
  if(!c){if(box)box.remove();CLUE.sig='';return}
  const hidden=CLUE.hide===c.at;const sig=JSON.stringify([c,hidden]);if(box&&CLUE.sig===sig)return;CLUE.sig=sig;
  if(!box){box=document.createElement('div');box.className='rpclue';stage.append(box);box.addEventListener('click',e=>{const b=e.target.closest('[data-rcl]');if(!b)return;e.stopPropagation();const k=b.dataset.rcl;const cc=clueCur();if(!cc)return;
   if(k==='all'&&gm()){A().set(['rp','clue'],null);return}if(k==='me'){CLUE.hide=cc.at;if(cc.to)PCL.show=null}if(k==='open')CLUE.hide=0;if(k==='box')return openClueBox();CLUE.sig='';clueRp(stage)})}
  box.classList.toggle('mini',hidden);const mine=!!c.to;
  box.innerHTML=hidden?`<button type="button" class="rpclue-pill" data-rcl="open" title="단서 다시 보기">🔍 단서 · ${esc(c.t||'')}</button>`:`<div class="dgcl-card ${mine?'mine':''}"><div class="dgcl-h"><div><small>CLUE${mine?' · 나에게만':''}</small><b>🔍 ${esc(c.t||'단서')}</b></div><span class="sp"></span><button type="button" data-rcl="box" title="받은 단서 목록">목록</button>${gm()&&!mine?'<button type="button" data-rcl="all" title="모두의 화면에서 내리기">모두 닫기</button>':''}<button type="button" data-rcl="me" title="내 화면에서 닫기">✕</button></div>${c.img?`<img src="${esc(c.img)}" alt="${esc(c.t||'단서')}">`:''}${c.d?`<p>${esc(c.d).replace(/\n/g,'<br>')}</p>`:''}</div>`}
 /* 「🔍 단서」 창: 받은 단서 목록 (나에게만 + 모두). GM 은 좌석별 전체 목록 · 회수
    11-03 14:01 망령 「단서카드 보관소 UI 개선」: 카드 격자(썸네일 · 제목 · 묶음 · 시간 · 받는 사람 배지) · 묶음별로 접는 머리 · 찾기 · 누르면 크게 보기.
    GM 은 위 탭 「모두 단서 / 좌석별」(이 브라우저 om_cbtab), 회수 · 지우기는 카드 ⋯ 메뉴 안 (실수 방지). 데이터(rp.clueLog · om_secret 'clue')는 그대로 */
 const CBX={q:'',fold:{},ed:null,dirty:false,to:[],tab:(()=>{try{return localStorage.getItem('om_cbtab')||'pub'}catch(e){return 'pub'}})()};
 /* 11-03 14:22 망령 「단서 누르면 이 보관함에서 추가/수정/삭제 관리도」: GM 은 맨 앞 탭 「📚 단서 목록」(rp.clueLib — 연출 탭 「저장한 단서」와 같은 데이터)이 기본.
    카드를 누르면 오른쪽(모바일은 전체) 편집 패널 — 그림 · 제목 · 설명 · 묶음 · 받는 사람 → 띄우기/보내기(showClueRp 그대로) · 저장 · 복제 · 삭제. 항목 필드 {id,t,d,img,g} 그대로 */
 async function openClueBox(keep){const ST=A().ST;if(!keep){CBX.ed=null;CBX.dirty=false;if(gm())CBX.tab='lib'}const tm=x=>{const d=new Date(x.at||0);return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};
  const pub=(Array.isArray(R().clueLog)?R().clueLog:[]).map(x=>Object.assign({},x,{pub:true}));
  const lib=Array.isArray(R().clueLib)?R().clueLib:[];const grpOf=c=>c.g||((c.id&&lib.find(x=>x.id===c.id))||{}).g||'';
  const isGm=gm();let per=[],L=[];
  if(isGm){const seats=clueTargets();let rows=PCL.gmAll;if(!rows){try{rows=await DBS().secretGet(ST.room,ST.secret,'clue')||[]}catch(e){rows=[];A().toast('단서 칸을 읽지 못했다: '+e.message)}PCL.gmAll=rows}
   per=seats.map(sx=>{const row=rows.find(r=>r.id===sx.id);const l=row&&row.data&&Array.isArray(row.data.list)?row.data.list:[];return {seat:sx,L:l.slice().sort((a,b)=>(b.at||0)-(a.at||0))}})}
  else{if(ST.role==='seat')await clueFetch(true);L=[...PCL.list.map(x=>Object.assign({},x)),...pub].sort((a,b)=>(b.at||0)-(a.at||0))}
  const nSeat=per.reduce((n,x)=>n+x.L.length,0);const tab=isGm?(['seat','pub','lib'].includes(CBX.tab)?CBX.tab:'lib'):'me';
  const seatName=id=>(per.find(x=>x.seat.id===id)||{seat:{name:id}}).seat.name||id;
  /* 카드 하나 — 같은 모양을 GM 콘솔 「저장한 단서」(gccl-card)에서 빌린다 */
  const card=(c,ref)=>{const g=grpOf(c);const badge=c.pub?'<span class="clc-b all">모두</span>':isGm?`<span class="clc-b me">${esc(seatName(c.to))}</span>`:'<span class="clc-b me">나에게만</span>';
   const acts=isGm?(c.pub?`<button class="btn xs pri" data-cb="reshow" data-ref="${ref}" title="다시 모두에게 띄우기">다시 띄우기</button>`:`<button class="btn xs" data-cb="show" data-ref="${ref}" title="내 화면에 미리보기">보기</button>`):`<button class="btn xs pri" data-cb="show" data-ref="${ref}">무대에 보기</button>`;
   const menu=isGm?`<details class="clc-menu"><summary title="더보기" aria-label="더보기">⋯</summary><div>${c.pub?`<button type="button" data-cb="show" data-ref="${ref}">내 화면에 보기</button><button type="button" class="danger" data-cb="pubdel" data-ref="${ref}" title="기록에서 지우기 (무대에 떠 있으면 내린다)">기록 지우기</button>`:`<button type="button" class="danger" data-cb="recall" data-ref="${ref}" title="그 사람의 목록에서 거둔다">회수</button>`}</div></details>`:'';
   return `<div class="gccl-card clc ${c.pub?'':'mine'}" data-q="${esc(((c.t||'')+' '+(c.d||'')+' '+g+' '+(c.scene||'')).toLowerCase())}"><button type="button" class="gccl-th clc-th" data-cb="zoom" data-ref="${ref}" title="크게 보기" style="${c.img?`background-image:url('${cssu(c.img)}')`:''}">${c.img?'':'<span>🔍</span>'}${badge}</button>
    <div class="gccl-bd"><button type="button" class="clc-t" data-cb="zoom" data-ref="${ref}" title="${esc(c.t||'')}">${esc(c.t||'(제목 없음)')}</button>${g?`<em>${esc(g)}</em>`:''}<small class="clc-m">${esc(tm(c))}${c.scene?' · '+esc(c.scene):''}</small></div>
    <div class="gccl-ac">${acts}<span class="sp"></span>${menu}</div></div>`};
  /* 묶음(또는 좌석)마다 접는 머리 */
  const REF=[];const put=(c,seat)=>{REF.push({c,seat});return REF.length-1};
  const fold=(key,title,n,inner)=>`<details class="clg" data-clg="${esc(key)}" ${CBX.fold[key]?'':'open'}><summary><i aria-hidden="true">▸</i><b>${title}</b><small>${n}</small></summary><div class="gccl-grid clgrid">${inner}</div></details>`;
  const byGroup=(list,seat,pre)=>{const G=new Map();for(const c of list){const g=grpOf(c);if(!G.has(g))G.set(g,[]);G.get(g).push(c)}const ks=[...G.keys()].sort((a,b)=>(a===''?1:0)-(b===''?1:0));return ks.map(g=>fold(pre+'g:'+g,g?esc(g):'묶음 없음',G.get(g).length,G.get(g).map(c=>card(c,put(c,seat))).join(''))).join('')};
  let inner='';
  /* 📚 단서 목록 — 띄운 횟수 · 마지막 시각은 띄운 기록(rp.clueLog) + 좌석 단서에서 id 로 */
  const use={};if(isGm){for(const c of [...pub,...per.flatMap(x=>x.L)]){if(!c.id)continue;const u=use[c.id]||(use[c.id]={n:0,at:0});u.n++;u.at=Math.max(u.at,c.at||0)}}
  const libCard=c=>{const u=use[c.id];const on=CBX.ed&&CBX.ed.id===c.id;return `<div class="gccl-card clc cll ${on?'sel':''}" data-q="${esc(((c.t||'')+' '+(c.d||'')+' '+(c.g||'')).toLowerCase())}"><button type="button" class="gccl-th clc-th" data-cbl="edit" data-id="${esc(c.id)}" title="눌러서 고치기" style="${c.img?`background-image:url('${cssu(c.img)}')`:''}">${c.img?'':'<span>🔍</span>'}${u?`<span class="clc-b use" title="띄운 적 있음 — ${u.n}번, 마지막 ${esc(tm(u))}">띄움 ${u.n}</span>`:''}</button>
    <div class="gccl-bd"><button type="button" class="clc-t" data-cbl="edit" data-id="${esc(c.id)}" title="${esc(c.t||'')}">${esc(c.t||'(제목 없음)')}</button>${c.g?`<em>${esc(c.g)}</em>`:''}<small class="clc-m">${u?`마지막 ${esc(tm(u))}`:'아직 안 띄움'}</small></div>
    <div class="gccl-ac"><button class="btn xs pri" data-cbl="fire" data-id="${esc(c.id)}" title="모두에게 바로 띄우기">띄우기</button><button class="btn xs" data-cbl="edit" data-id="${esc(c.id)}">고치기</button></div></div>`};
  const newCard=`<button type="button" class="cll-new ${CBX.ed&&!CBX.ed.id?'sel':''}" data-cbl="new"><b>＋</b><span>새 단서</span></button>`;
  const panel=()=>{const e=CBX.ed;if(!e)return '';const T=clueTargets(),to=(CBX.to||[]).filter(id=>T.some(x=>x.id===id)),all=!to.length;const groups=[...new Set(lib.map(c=>c.g).filter(Boolean))];
   return `<aside class="cled"><div class="cled-h"><b>${e.id?'단서 고치기':'새 단서'}</b>${CBX.dirty?'<span class="cled-dirty">고침 · 저장 안 함</span>':''}<span class="sp"></span><button type="button" class="btn xs ghost" data-cbl="close" title="편집 닫기">✕</button></div>
    <div class="cled-b"><div class="updz mini gccl-dz cled-dz" id="cbz" title="그림 올리기 — 끌어 놓기 · 클릭 · Ctrl+V">${e.img?`<div class="gccl-pv" style="background-image:url('${cssu(e.img)}')"></div>`:'<div class="gccl-pv none">그림 없음</div>'}<b>＋ 그림</b><span>끌어 놓기 · 클릭 · Ctrl+V</span><input type="file" accept="image/*" hidden></div>
     <label class="cled-f"><span>제목</span><input type="text" data-cef="t" maxlength="60" placeholder="예: 찢어진 작업 일지" value="${esc(e.t||'')}"></label>
     <label class="cled-f"><span>설명</span><textarea data-cef="d" rows="4" maxlength="1200" placeholder="줄바꿈 그대로">${esc(e.d||'')}</textarea></label>
     <label class="cled-f"><span>묶음</span><input type="text" data-cef="g" maxlength="30" list="cbgl" placeholder="고르거나 새로 입력 (예: 무진 3화)" value="${esc(e.g||'')}"><datalist id="cbgl">${groups.map(g=>`<option value="${esc(g)}">`).join('')}</datalist></label>
     ${groups.length?`<div class="cled-gs">${groups.map(g=>`<button type="button" class="chip ${e.g===g?'on':''}" data-cbl="grp" data-g="${esc(g)}">${esc(g)}</button>`).join('')}</div>`:''}
     <label class="cled-f"><span>그림 주소</span><input type="text" data-cef="img" maxlength="600" placeholder="비워도 된다 · 위 칸에 올려도 된다" value="${esc(e.img||'')}"></label>
     <div class="cled-f"><span>받는 사람</span><div class="gccl-tos"><button type="button" class="gcto ${all?'on':''}" data-cbl="to" data-id="" aria-pressed="${all}"><i aria-hidden="true">${all?'✓':''}</i>모두</button>${T.map(x=>{const o=to.includes(x.id);return `<button type="button" class="gcto ${o?'on':''}" data-cbl="to" data-id="${esc(x.id)}" aria-pressed="${o}" title="${esc(x.name)} 에게만"><i aria-hidden="true">${o?'✓':''}</i>${esc(x.name)}</button>`}).join('')}${T.length?'':'<span class="small dim">자리에 앉은 플레이어가 없다 — 모두에게만</span>'}</div></div></div>
    <div class="cled-foot"><button class="btn pri" data-cbl="send" title="${all?'모두의 무대에 띄운다':esc(clueToLabel(to))+' 에게만 보낸다'}">${all?'🔍 모두에게 띄우기':`🔍 보내기 · ${to.length}명`}</button><span class="sp"></span><button class="btn" data-cbl="save" title="단서 목록에 저장">저장</button>${e.id?`<details class="clc-menu up"><summary title="더보기" aria-label="더보기">⋯</summary><div><button type="button" data-cbl="dup">복제</button><button type="button" class="danger" data-cbl="del">삭제</button></div></details>`:''}</div></aside>`};
  if(tab==='lib'){const G=new Map();for(const c of lib){const g=c.g||'';if(!G.has(g))G.set(g,[]);G.get(g).push(c)}const ks=[...G.keys()].sort((a,b)=>(a===''?1:0)-(b===''?1:0));
   const list=`<div class="cll-top">${newCard}${lib.length?'':'<div class="cll-hint">저장한 단서가 없다 — 「＋ 새 단서」로 만들어 두면 세션 중에 바로 띄울 수 있다. 연출 탭 「저장한 단서」와 같은 목록.</div>'}</div>${ks.map(g=>fold('lg:'+g,g?esc(g):'묶음 없음',G.get(g).length,G.get(g).map(libCard).join(''))).join('')}`;
   inner=`<div class="cllw ${CBX.ed?'editing':''}"><div class="cll-list">${list}<div class="clbx-empty clbx-nohit" hidden>찾는 단서가 없다</div></div>${panel()}</div>`}
  else if(tab==='seat')inner=per.map(({seat,L:l})=>l.length?fold('s:'+seat.id,'👤 '+esc(seat.name),l.length,l.map(c=>card(c,put(c,seat))).join('')):`<div class="clg-none"><b>👤 ${esc(seat.name)}</b><span class="small dim">받은 개인 단서가 없다</span></div>`).join('')||'<div class="clbx-empty">자리에 앉은 플레이어가 없다</div>';
  else if(tab==='pub')inner=pub.length?byGroup(pub,null,'p'):'<div class="clbx-empty">아직 모두에게 띄운 단서가 없다<br><span class="small dim">「📚 단서 목록」에서 단서를 골라 「🔍 모두에게 띄우기」</span></div>';
  else inner=L.length?byGroup(L,null,'m'):'<div class="clbx-empty">아직 받은 단서가 없다<br><span class="small dim">GM 이 띄우거나 나에게 보내면 여기에 모인다</span></div>';
  const total=isGm?(tab==='seat'?nSeat:tab==='lib'?lib.length:pub.length):L.length;
  const md=A().openModal(`<div class="mhead clbx-h"><h2>🔍 단서 보관함</h2>${isGm?'<span class="clbx-gm">GM</span>':`<span class="small dim">${L.length}개</span>`}<span class="sp"></span>${isGm?'<button class="btn sm ghost" data-cb="refresh" title="좌석 단서를 서버에서 새로 읽기">⟳</button><button class="btn sm" data-cb="send" title="📚 단서 목록에 새 단서 쓰기">＋ 새로</button>':''}<button class="btn sm ghost" data-x>닫기</button></div>
   ${isGm?`<div class="clbx-tabs" role="tablist"><button type="button" role="tab" class="${tab==='lib'?'on':''}" data-cbt="lib" aria-selected="${tab==='lib'}">📚 단서 목록 <small>${lib.length}</small></button><button type="button" role="tab" class="${tab==='pub'?'on':''}" data-cbt="pub" aria-selected="${tab==='pub'}">띄운 기록 <small>${pub.length}</small></button><button type="button" role="tab" class="${tab==='seat'?'on':''}" data-cbt="seat" aria-selected="${tab==='seat'}">좌석별 <small>${nSeat}</small></button></div>`:''}
   ${total>3?`<div class="clbx-bar"><input type="search" id="cbq" placeholder="찾기 — 제목 · 설명 · 묶음 · 장소" value="${esc(CBX.q)}"></div>`:''}
   <div class="clbx2 ${tab==='lib'?'lib':''}">${inner}${tab==='lib'?'':'<div class="clbx-empty clbx-nohit" hidden>찾는 단서가 없다</div>'}</div>`);
  md.classList.add('wide','clbxm');md.classList.toggle('cled-on',tab==='lib'&&!!CBX.ed);
  md.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>{if(!leaveOk())return;A().closeModal()});
  /* 찾기: 다시 그리지 않고 숨기기만 */
  const q=$('#cbq',md);const flt=()=>{const w=CBX.q.trim().toLowerCase();let hit=0;md.querySelectorAll('.clg').forEach(g=>{let n=0;g.querySelectorAll('.clc').forEach(c=>{const on=!w||c.dataset.q.includes(w);c.hidden=!on;if(on)n++});g.hidden=!n;hit+=n;if(w&&n)g.open=true});md.querySelectorAll('.clg-none').forEach(x=>x.hidden=!!w);const nh=md.querySelector('.clbx-nohit');if(nh)nh.hidden=!(w&&!hit)};
  if(q){q.oninput=()=>{CBX.q=q.value;flt()};flt()}
  md.querySelectorAll('.clg').forEach(g=>g.addEventListener('toggle',()=>{if(!CBX.q.trim()){if(g.open)delete CBX.fold[g.dataset.clg];else CBX.fold[g.dataset.clg]=1}}));
  md.querySelectorAll('[data-cbt]').forEach(b=>b.onclick=()=>{if(b.dataset.cbt!=='lib'&&!leaveOk())return;CBX.tab=b.dataset.cbt;try{localStorage.setItem('om_cbtab',CBX.tab)}catch(e){}openClueBox(true)});
  /* ⋯ 메뉴는 하나만 열리게 */
  md.addEventListener('click',e=>{const open=md.querySelectorAll('.clc-menu[open]');open.forEach(d=>{if(!d.contains(e.target))d.open=false})});
  const stageShow=c=>{const cc=Object.assign({},c);delete cc.pub;PCL.show=cc;CLUE.hide=0;CLUE.sig='';A().closeModal();A().renderScene()};
  const act=async(k,it)=>{const c=it&&it.c;
   if(k==='show'){if(c)stageShow(c);return}
   if(k==='reshow'){if(!c)return;await showClueRp({t:c.t,d:c.d,img:c.img,id:c.id},'all');return openClueBox(true)}
   if(k==='recall'){const row=it&&per.find(x=>x.seat.id===(it.seat||{}).id);if(!c||!row||!confirm(`「${c.t||'단서'}」 를 ${row.seat.name} 에게서 거둘까?`))return;const nl=row.L.filter(x=>x.k!==c.k).sort((a,b)=>(a.at||0)-(b.at||0));try{await DBS().secretPut(ST.room,ST.secret,'clue',row.seat.id,{list:nl});DBS().broadcast({t:'clue',to:[row.seat.id],rm:c.k,at:Date.now()});PCL.gmAll=null;A().toast('거뒀다');return openClueBox(true)}catch(e){return A().toast('거두지 못했다: '+e.message)}}
   if(k==='pubdel'){if(!c||!confirm(`「${c.t||'단서'}」 기록을 지울까?`))return;const nl=pub.filter(x=>x.k!==c.k).map(x=>{const y=Object.assign({},x);delete y.pub;return y});const ops=[[['rp','clueLog'],nl.length?nl:null]];if((R().clue||{}).k===c.k)ops.push([['rp','clue'],null]);await A().setMany(ops);return openClueBox(true)}};
  /* ---- 📚 단서 목록 편집 ---- */
  function leaveOk(){if(!CBX.ed||!CBX.dirty)return true;if(!confirm('고친 내용을 저장하지 않았다 — 버리고 넘어갈까?'))return false;CBX.dirty=false;return true}
  const edRead=()=>{if(!CBX.ed)return;md.querySelectorAll('[data-cef]').forEach(x=>{CBX.ed[x.dataset.cef]=x.value})};
  const edVal=()=>{const e=CBX.ed;return {t:String(e.t||'').trim().slice(0,60),d:String(e.d||'').trim().slice(0,1200),img:String(e.img||'').trim().slice(0,600),g:String(e.g||'').trim().slice(0,30)}};
  md.querySelectorAll('[data-cef]').forEach(x=>x.addEventListener('input',()=>{CBX.ed[x.dataset.cef]=x.value;if(!CBX.dirty){CBX.dirty=true;const h=md.querySelector('.cled-h b');if(h&&!md.querySelector('.cled-dirty'))h.insertAdjacentHTML('afterend','<span class="cled-dirty">고침 · 저장 안 함</span>')}if(x.dataset.cef==='img'){const pv=md.querySelector('.cled-dz .gccl-pv');if(pv){const v=x.value.trim();pv.classList.toggle('none',!v);pv.style.backgroundImage=v?`url('${cssu(v)}')`:'';pv.textContent=v?'':'그림 없음'}}}));
  if($('#cbz',md))bindDz(md,'#cbz',async fs=>{edRead();A().toast('올리는 중…');const u=await upImg(await shrinkPic(fs[0],1600,1600),'clue');if(!u)return A().toast('그림을 올리지 못했다');CBX.ed.img=u;CBX.dirty=true;openClueBox(true)});
  const libAct=async(k,b)=>{const LB=(Array.isArray(R().clueLib)?R().clueLib:[]).slice();const id=b.dataset.id;
   if(k==='new'){if(CBX.ed&&!CBX.ed.id&&!CBX.dirty)return;if(!leaveOk())return;CBX.ed={id:'',t:'',d:'',img:'',g:''};CBX.dirty=false;openClueBox(true);setTimeout(()=>{const f=document.querySelector('[data-cef=t]');if(f)f.focus()},40);return}
   if(k==='edit'){if(CBX.ed&&CBX.ed.id===id)return;const c=LB.find(x=>x.id===id);if(!c||!leaveOk())return;CBX.ed={id:c.id,t:c.t||'',d:c.d||'',img:c.img||'',g:c.g||''};CBX.dirty=false;return openClueBox(true)}
   if(k==='fire'){const c=LB.find(x=>x.id===id);if(c){await showClueRp(c,'all');A().toast(`「${c.t||'단서'}」 모두에게 띄움`)}return openClueBox(true)}
   if(k==='close'){if(!leaveOk())return;CBX.ed=null;return openClueBox(true)}
   if(!CBX.ed)return;edRead();
   if(k==='grp'){CBX.ed.g=b.dataset.g||'';CBX.dirty=true;return openClueBox(true)}
   if(k==='to'){if(!id)CBX.to=[];else{const T=(CBX.to||[]).slice();const i=T.indexOf(id);if(i>=0)T.splice(i,1);else T.push(id);CBX.to=T}return openClueBox(true)}
   const v=edVal();
   if(k==='save'){if(!v.t&&!v.d&&!v.img)return A().toast('제목 · 설명 · 그림 중 하나는 있어야 한다');
    if(CBX.ed.id){const j=LB.findIndex(x=>x.id===CBX.ed.id);if(j<0){CBX.ed.id=''}else{LB[j]=Object.assign({},LB[j],v)}}
    if(!CBX.ed.id){const it=Object.assign({id:'c'+Date.now().toString(36)},v);LB.unshift(it);CBX.ed.id=it.id}
    await A().set(['rp','clueLib'],LB.slice(0,120));CBX.dirty=false;A().toast('단서 목록에 저장했다');return openClueBox(true)}
   if(k==='dup'){const j=LB.findIndex(x=>x.id===CBX.ed.id);const it=Object.assign({},j>=0?LB[j]:{},v,{id:'c'+Date.now().toString(36),t:((v.t||'단서')+' (사본)').slice(0,60)});LB.splice(j>=0?j+1:0,0,it);await A().set(['rp','clueLib'],LB.slice(0,120));CBX.ed=Object.assign({id:it.id},{t:it.t,d:it.d||'',img:it.img||'',g:it.g||''});CBX.dirty=false;A().toast('복제했다 — 사본을 고치는 중');return openClueBox(true)}
   if(k==='del'){const c=LB.find(x=>x.id===CBX.ed.id);if(!c||!confirm(`「${c.t||'단서'}」 를 단서 목록에서 지울까? (띄운 기록 · 받은 사람 목록은 남는다)`))return;const nl=LB.filter(x=>x.id!==c.id);if(GC.clEdit===c.id)GC.clEdit='';await A().set(['rp','clueLib'],nl.length?nl:null);CBX.ed=null;CBX.dirty=false;A().toast('지웠다');return openClueBox(true)}
   if(k==='send'){if(!v.t&&!v.d&&!v.img)return A().toast('제목 · 설명 · 그림 중 하나는 있어야 한다');const to=(CBX.to||[]).length?CBX.to:'all';await showClueRp(Object.assign({},v,CBX.ed.id?{id:CBX.ed.id}:{}),to);return openClueBox(true)}};
  md.querySelectorAll('[data-cbl]').forEach(b=>{if(b.tagName==='SUMMARY')return;b.onclick=e=>{e.stopPropagation();const d=b.closest('details.clc-menu');if(d)d.open=false;libAct(b.dataset.cbl,b)}});
  /* 크게 보기 — 같은 창 안에서 바꿔 그리고 「← 목록」으로 돌아온다 */
  const zoom=it=>{const c=it.c;const g=grpOf(c);const badge=c.pub?'<span class="clc-b all">모두</span>':`<span class="clc-b me">${isGm?esc(seatName(c.to)):'나에게만'}</span>`;
   const z=A().openModal(`<div class="mhead clbx-h"><button class="btn sm ghost" data-cz="back" title="목록으로">← 목록</button><h2 class="clz-t" title="${esc(c.t||'')}">${esc(c.t||'(제목 없음)')}</h2><span class="sp"></span><button class="btn sm ghost" data-x>닫기</button></div>
    <div class="clz">${c.img?`<img class="clz-img" src="${esc(c.img)}" alt="${esc(c.t||'단서')}">`:'<div class="clz-noimg">🔍 그림 없는 단서</div>'}<div class="clz-bd"><div class="clz-meta">${badge}${g?`<em>${esc(g)}</em>`:''}<small>${esc(tm(c))}${c.scene?' · '+esc(c.scene):''}</small></div>${c.d?`<p>${esc(c.d).replace(/\n/g,'<br>')}</p>`:'<p class="dim">설명 없음</p>'}</div></div>
    <div class="clz-foot">${isGm&&c.pub?'<button class="btn pri" data-cz="reshow">다시 띄우기</button><button class="btn" data-cz="show">내 화면에 보기</button>':`<button class="btn pri" data-cz="show">${isGm?'내 화면에 보기':'무대에 보기'}</button>`}<span class="sp"></span>${isGm?`<details class="clc-menu up"><summary title="더보기" aria-label="더보기">⋯</summary><div>${c.pub?'<button type="button" class="danger" data-cz="pubdel">기록 지우기</button>':'<button type="button" class="danger" data-cz="recall">회수</button>'}</div></details>`:''}</div>`);
   z.classList.add('wide','clbxm','clzm');z.querySelectorAll('[data-cz]').forEach(b=>b.onclick=()=>{const k=b.dataset.cz;if(k==='back')return openClueBox(true);act(k,it)})};
  md.querySelectorAll('[data-cb]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const k=b.dataset.cb;
   if(k==='refresh'){PCL.gmAll=null;return openClueBox(true)}
   if(k==='send'){if(!leaveOk())return;CBX.tab='lib';CBX.ed={id:'',t:'',d:'',img:'',g:''};CBX.dirty=false;openClueBox(true);setTimeout(()=>{const f=document.querySelector('[data-cef=t]');if(f)f.focus()},40);return}
   const it=REF[+b.dataset.ref];if(!it)return;if(k==='zoom')return zoom(it);const d=b.closest('details');if(d)d.open=false;return act(k,it)});
  return md}
 /* 올리기 전에 줄인다 (Supabase 전송량) */
 async function shrinkPic(f,W,Hh){try{if(!/^image\/(png|jpe?g|webp|bmp)$/i.test(f.type||''))return f;const bmp=await createImageBitmap(f);const sc=Math.min(1,W/bmp.width,Hh/bmp.height);const cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(bmp.width*sc));cv.height=Math.max(1,Math.round(bmp.height*sc));cv.getContext('2d').drawImage(bmp,0,0,cv.width,cv.height);const bl=await new Promise(r=>cv.toBlob(r,'image/webp',.85));return bl&&bl.size<f.size?bl:f}catch(e){return f}}
 /* 대사 상자 글꼴 · 글자 크기 · 상자 크기 · 굵기 · 대사창/지문 상자 높이 (rp.bubble.st, GM 콘솔 무대 탭, 10-21 · 10-23 망령: 글자 위치 대신 상자 위치) */
 const BUB_FONTS=[['','기본 (화면 글꼴)'],['bhs','Black Han Sans'],['dohyeon','Do Hyeon'],['jua','주아'],['gugi','구기'],['plex','IBM Plex Sans KR'],['noto','Noto Sans KR'],['nanum','나눔고딕'],['gothica1','Gothic A1'],['gowun','고운돋움'],['pretendard','Pretendard'],['myeongjo','나눔명조']];
 /* 무대 기본값 — 방에 저장된 st 는 이것과 다른 값만 담는다 (10-23 망령: 그랜드 오더 방 설정을 기본값으로) */
 /* PC 보정 (10-23 망령: 같은 설정이면 폰은 딱 맞고 PC 는 조금 크다) — PC 무대에서 상자 폭 · 글자에 곱한다. 글자 쪽은 css 의 --bubpc */
 const BUB_PC=.88;
 const BUB_DEF={font:'nanum',fs:105,w:47,wt:'500',dx:0,dy:0,lx:0,ly:0,rx:0,ry:0,nx:0,ny:0};
 const BUB_POS=['dx','dy','lx','ly','rx','ry','nx','ny'];
 /* 예시 무대의 상자들: 무대(PC)의 기본 자리와 같게 — 가운데 50-w/2 · 왼쪽 21% · 오른쪽 79%-w · 바닥 9%(지문 1%) */
 const GBP=[{k:'d',btn:'가운데 대사',lab:'가운데',txt:'"가운데 화자 대사"',kx:'dx',ky:'dy',b0:9,base:w=>50-w/2},{k:'l',btn:'왼쪽 대사',lab:'왼쪽',txt:'"왼쪽 화자 대사"',kx:'lx',ky:'ly',b0:9,base:()=>21},{k:'r',btn:'오른쪽 대사',lab:'오른쪽',txt:'"오른쪽 화자 대사"',kx:'rx',ky:'ry',b0:9,base:w=>79-w},{k:'n',btn:'지문',lab:'지문',txt:'이건 지문 상자',kx:'nx',ky:'ny',b0:1,base:w=>50-w/2}];
 function stOf(st){const o=Object.assign({},BUB_DEF);if(st)for(const k in BUB_DEF)if(st[k]!=null)o[k]=st[k];return o}
 function bubStyle(el,st){st=st||{};const S=(k,v)=>{if(v===''||v==null)el.style.removeProperty(k);else el.style.setProperty(k,v)};
  S('--bubfont',st.font&&A().fontCss?A().fontCss(st.font):'');S('--bubfs',st.fs&&+st.fs!==100?String(st.fs/100):'');S('--bubw',st.w?(st.w*BUB_PC)+'%':'');S('--bubwt',st.wt||'');for(const k of BUB_POS)S('--dlg'+k,st[k]?String(+st[k]):'')}
 /* ----- BGM 패널 (맵툴 Lib:bgm 정리판과 같은 꼴): 홈 = 띠(장면/배틀/분위기)별 그룹 타일 → 그룹 = 곡 줄 · 검색 · ▶ 미리듣기 · 모두에게 재생 · ⟳ 다른 곡 ----- */
 const BG={g:'',q:''};
 const gshort=g=>String(g).replace(/^[0-9.]+\s*/,'');
 function bgmMeta(g){const M=(DB().bgm||{}).meta||{};return M[g]||{b:'',d:''}}
 function bgmPanelHtml(){const r=R();const G=bgmGroups();const gs=Object.keys(G).sort();if(BG.g&&!gs.includes(BG.g))BG.g='';const now=r.bgm||{};const q=BG.q.trim().toLowerCase();const bands=((DB().bgm||{}).bands||['장면','배틀','분위기']).concat(['']);
  const row=(g,sn,withGroup)=>{const on=now.title===sn&&now.group===g;const bad=BGMBAD[bgmUrl(g,sn)];const ck=BGCK.res[bgmUrl(g,sn)];return `<div class="song ${on?'cur':''} ${bad?'bad':''}"><button class="pv ${PV.g===g&&PV.s===sn?'on':''}" data-bq="pv" data-g="${esc(g)}" data-s="${esc(sn)}" title="나만 미리듣기">▶</button><span class="sn" data-bq="play" data-g="${esc(g)}" data-s="${esc(sn)}">${bad?`<i class="bgmbad" title="재생 실패: ${esc(bad.m)}">⚠</i>`:ck==='ok'?'<i class="bgmok" title="링크 확인됨">✓</i>':ck==='?'?'<i class="bgmbad dim" title="응답이 없다 (시간 초과)">?</i>':''}<b>${esc(sn)}</b>${withGroup?`<small class="dim"> ${esc(gshort(g))}</small>`:''}${on?'<em class="nowtag">재생 중</em>':''}</span><span class="sp"></span><button class="btn xs pri" data-bq="play" data-g="${esc(g)}" data-s="${esc(sn)}">모두에게 재생</button>${withGroup?'':`<button class="btn xs ghost" data-bq="sedit" data-g="${esc(g)}" data-s="${esc(sn)}" title="곡 수정">✎</button><button class="btn xs ghost danger" data-bq="sdel" data-g="${esc(g)}" data-s="${esc(sn)}" title="곡 삭제">✕</button>`}</div>`};
  let head='',list='';
  const bar=`<div class="np"><div class="eq ${now.src?'':'off'}">♪</div><div style="flex:1;min-width:0"><small class="dim">지금 재생 (모두에게)</small><br><b>${esc(now.title?(now.group?gshort(now.group)+' - ':'')+now.title:'재생 중인 곡 없음')}</b>${PV.title?`<br><small style="color:var(--yel2)">미리듣기: ${esc(PV.title)}</small>`:''}</div><label class="small">내 음량 <input type="range" min="0" max="1" step="0.05" value="${vol}" id="gvol"></label>${now.group&&G[now.group]?`<button class="btn sm" data-bq="rand" data-g="${esc(now.group)}" title="같은 그룹에서 다른 곡">⟳ 다른 곡</button>`:''}${now.q&&now.group&&G[now.group]?`<button class="btn sm" data-bq="next" title="이어 재생 — 다음 곡으로">⏭ 다음</button>`:''}${PV.audio?'<button class="btn sm ghost" data-bq="pvstop">미리듣기 정지</button>':''}<button class="btn sm ghost danger" data-bq="stop">■ 정지</button></div>
  ${gm()?`<div class="row bgmmode"><span class="small dim">재생 방식</span><select id="gbmode" title="곡이 끝났을 때">${[['','한 곡 반복'],['seq','그룹 이어 재생 (순서)'],['shuf','그룹 이어 재생 (섞기)']].map(([v,l])=>`<option value="${v}" ${bgmMode()===v?'selected':''}>${l}</option>`).join('')}</select><span class="small dim">${now.q?`이어 재생 중 (${now.q==='shuf'?'섞기':'순서'}) — 곡이 끝나면 GM 화면이 다음 곡을 모두에게 건다`:'곡 하나를 반복한다'}</span>${Object.keys(BGMBAD).length?`<span class="sp"></span><span class="small" style="color:var(--yel2)">⚠ 실패한 곡 ${Object.keys(BGMBAD).length}</span><button class="btn xs ghost" data-bq="badclr" title="⚠ 표시를 모두 지운다">표시 지우기</button>`:''}</div>`:''}`;
  if(!BG.g){const tot=gs.reduce((a,g)=>a+Object.keys(G[g]).length,0);
   head=`<div class="sec"><b>그룹 ${gs.length}개 · ${tot}곡</b><span class="note">▶ 랜덤은 그 그룹에서 아무 곡이나 모두에게</span><span class="sp"></span>${Object.keys((r.bgmX||{}).del||{}).length?'<button class="btn xs ghost" data-bq="undel">지운 것 되살리기</button>':''}<button class="btn xs" data-bq="gadd">＋ 그룹 추가</button></div><div class="row" style="margin-bottom:6px"><input type="text" id="bgq" placeholder="전체 곡 검색 (곡 이름 일부나 그룹 이름)" value="${esc(BG.q)}" style="flex:1"></div>`;
   if(q){let n=0;for(const g of gs){const gm=gshort(g).toLowerCase().includes(q);for(const sn of Object.keys(G[g]).sort()){if(n>=150)break;if(gm||sn.toLowerCase().includes(q)){list+=row(g,sn,true);n++}}}list=`<div class="songlist" style="max-height:56vh">${list||'<div class="empty small">찾는 곡이 없다</div>'}${n>=150?'<div class="small dim">150곡까지만 — 검색어를 더 적어 줘</div>':''}</div>`}
   else{for(const b of bands){const tiles=gs.filter(g=>bgmMeta(g).b===b).map(g=>{const m=bgmMeta(g);const on=now.group===g;return `<div class="btile ${on?'on':''}"><a class="tn" data-bq="open" data-g="${esc(g)}">${esc(gshort(g))}</a><div class="td">${esc(m.d||'')}</div><div class="ta"><button class="btn xs pri" data-bq="rand" data-g="${esc(g)}">▶ 랜덤 재생</button><a class="tc" data-bq="open" data-g="${esc(g)}">${Object.keys(G[g]).length}곡 ▸</a><span class="sp"></span><button class="btn xs ghost" data-bq="gren" data-g="${esc(g)}" title="그룹 이름 변경">✎</button><button class="btn xs ghost danger" data-bq="gdel" data-g="${esc(g)}" title="그룹 삭제">✕</button></div></div>`}).join('');if(tiles)list+=`<div class="band b_${{장면:'scene',배틀:'battle',분위기:'mood'}[b]||'etc'}"><h4>${esc(b||'그 밖의 그룹')}</h4><div class="bgrid">${tiles}</div></div>`}
    if(!gs.length)list='<div class="empty">아직 그룹이 없다 — ＋ 그룹 추가</div>'}}
  else{const g=BG.g;const S=Object.keys(G[g]||{}).sort();const m=bgmMeta(g);
   head=`<div class="sec gh"><a class="back" data-bq="home">◂ 그룹 목록</a><div style="flex:1;min-width:0"><b>${esc(gshort(g))} <span class="small dim">${S.length}곡</span></b><div class="small dim">${esc(m.d||'')}</div></div><button class="btn sm pri" data-bq="rand" data-g="${esc(g)}">▶ 랜덤 재생</button>${gm()?`<button class="btn sm" data-bq="sadd" data-g="${esc(g)}">＋ 곡 추가</button><button class="btn sm ghost" data-bq="check" data-g="${esc(g)}" title="그룹의 곡을 차례로 불러 보며 죽은 링크를 찾는다 (재생은 안 한다)">${BGCK.g===g&&BGCK.busy?'■ 점검 중단':'🔗 링크 점검'}</button>`:''}</div>${BGCK.g===g&&(BGCK.busy||BGCK.msg)?`<div class="small bgck">${esc(BGCK.msg)}</div>`:''}<div class="row" style="margin-bottom:6px"><input type="text" id="bgq" placeholder="이 그룹에서 곡 검색" value="${esc(BG.q)}" style="flex:1"></div>`;
   const rows=S.filter(sn=>!q||sn.toLowerCase().includes(q)).map(sn=>row(g,sn,false)).join('');list=`<div class="songlist" style="max-height:56vh">${rows||'<div class="empty small">'+(S.length?'찾는 곡이 없다':'이 그룹엔 아직 곡이 없다')+'</div>'}</div>`}
  if(!gm())return `<div class="bgmro">${bar+head+list}</div><div class="small dim" style="margin-top:6px">방 설정 「플레이어도 배틀 진행」이라 플레이어도 BGM 을 고를 수 있다 (모두에게). 목록 고치기는 GM 만.</div>`;
  return bar+head+list+`<div class="small dim" style="margin-top:6px">플레이어 화면에서는 「소리 켜기」를 한 번 눌러야 들린다. 음량은 각자. 기본 목록은 파일에 있고 여기서 더하거나 지운 것만 방에 저장된다.</div>`}
 function bindBgmPanel(md,re){const G=bgmGroups();
  const vr=$('#gvol',md);if(vr)vr.oninput=()=>{vol=+vr.value;try{localStorage.setItem('om_vol',vol)}catch(e){}if(audio)audio.volume=vol;if(PV.audio)PV.audio.volume=vol};
  const mo=$('#gbmode',md);if(mo)mo.onchange=async()=>{const m=mo.value||null;await A().set(['rp','bgmMode'],m);const now=R().bgm;if(now&&now.src){await A().set(['rp','bgm'],Object.assign({},now,m?{q:m}:{q:undefined}))}A().toast(m?'이어 재생 — 지금 곡이 끝나면 다음 곡으로':'한 곡 반복');re()};
  const qi=$('#bgq',md);if(qi)qi.oninput=()=>{BG.q=qi.value;const pos=qi.selectionStart;re();const n=$('#bgq');if(n){n.focus();n.setSelectionRange(pos,pos)}};
  md.querySelectorAll('[data-bq]').forEach(b=>b.onclick=async()=>{const k=b.dataset.bq;const g=b.dataset.g,sn=b.dataset.s;
   if(k==='home'){BG.g='';BG.q='';return re()}
   if(k==='open'){BG.g=g;BG.q='';return re()}
   if(k==='play'){pvStop();await playAll(g,sn);return re()}
   if(k==='rand'){const ss=Object.keys(G[g]||{});if(!ss.length)return;const now=R().bgm||{};let pick=ss[Math.floor(Math.random()*ss.length)];if(ss.length>1&&pick===now.title)pick=ss[(ss.indexOf(pick)+1)%ss.length];pvStop();await playAll(g,pick);return re()}
   if(k==='pv'){if(PV.g===g&&PV.s===sn){pvStop();syncBgm(true);return re()}pvStop();const u=bgmUrl(g,sn);if(!u)return;PV.audio=new Audio(u);PV.audio.volume=vol;PV.audio.play().catch(()=>A().toast('재생하지 못했다'));PV.g=g;PV.s=sn;PV.title=sn;if(audio)audio.pause();return re()}
   if(k==='pvstop'){pvStop();syncBgm(true);return re()}
   if(k==='stop'){pvStop();await A().set(['rp','bgm'],null);return re()}
   if(k==='next'){const now=R().bgm||{};if(!now.q)return;BGQ.busy=false;const pick=bgmNextPick(now);if(pick){pvStop();await playAll(now.group,pick,null,now.q)}return re()}
   if(k==='badclr'){for(const u of Object.keys(BGMBAD))bgmBadSet(u,null);return re()}
   if(k==='check'){if(BGCK.busy&&BGCK.g===g){BGCK.stop=true;return}bgmCheck(g,re);return re()}
   if(k==='sadd'){const t=prompt('곡 제목');if(!t||!t.trim())return;const u=prompt('주소 (Dropbox 공유 링크도 됨)');if(!u||!u.trim())return;const X=bgmX();X.add[g]=X.add[g]||{};X.add[g][t.trim()]=direct(u);delete X.del[g+'\u0001'+t.trim()];await A().set(['rp','bgmX'],X);return re()}
   if(k==='sedit'){const t=prompt('곡 제목',sn);if(t==null||!t.trim())return;const u=prompt('주소',G[g][sn]);if(u==null||!u.trim())return;const X=bgmX();if(X.add[g]&&X.add[g][sn])delete X.add[g][sn];else X.del[g+'\u0001'+sn]=1;X.add[g]=X.add[g]||{};X.add[g][t.trim()]=direct(u);delete X.del[g+'\u0001'+t.trim()];await A().set(['rp','bgmX'],X);return re()}
   if(k==='sdel'){if(!confirm(`「${sn}」 곡을 지울까?`))return;const X=bgmX();if(X.add[g]&&X.add[g][sn])delete X.add[g][sn];else X.del[g+'\u0001'+sn]=1;await A().set(['rp','bgmX'],X);return re()}
   if(k==='gadd'){const n=prompt('새 그룹 이름 (예: 20. 무진 · 항구)');if(!n||!n.trim())return;const X=bgmX();X.add[n.trim()]=X.add[n.trim()]||{};delete X.del[n.trim()];await A().set(['rp','bgmX'],X);return re()}
   if(k==='gren'){const n=prompt('그룹 이름',g);if(!n||!n.trim()||n.trim()===g)return;const X=bgmX();X.add[n.trim()]=Object.assign({},X.add[n.trim()]||{},G[g]);X.del[g]=1;await A().set(['rp','bgmX'],X);return re()}
   if(k==='gdel'){if(!confirm(`「${gshort(g)}」 그룹(${Object.keys(G[g]||{}).length}곡)을 목록에서 지울까?`))return;const X=bgmX();X.del[g]=1;delete X.add[g];if(BG.g===g)BG.g='';await A().set(['rp','bgmX'],X);return re()}
   if(k==='undel'){const X=bgmX();X.del={};await A().set(['rp','bgmX'],X);return re()}})}
 /* 11-03: 링크 점검 — 그룹의 곡을 하나씩 audio 요소로 메타데이터만 받아 본다 (HEAD 는 CORS 에 막히니 audio 의 error 이벤트로). 10초 넘으면 ? */
 const BGCK={g:'',busy:false,stop:false,msg:'',res:{}};
 function bgmProbe(u){return new Promise(res=>{const a=new Audio();a.preload='metadata';a.muted=true;let done=false;const fin=v=>{if(done)return;done=true;clearTimeout(tm);try{a.src='';a.load()}catch(e){}res(v)};
  const tm=setTimeout(()=>fin({r:'?'}),10000);a.onloadedmetadata=()=>fin({r:'ok'});a.oncanplay=()=>fin({r:'ok'});a.onerror=()=>fin({r:'bad',m:bgmErrMsg(a)});a.src=u;try{a.load()}catch(e){fin({r:'bad',m:'불러오지 못함'})}})}
 async function bgmCheck(g,re){if(BGCK.busy)return;const G=bgmGroups();const S=Object.keys(G[g]||{}).sort();if(!S.length)return;BGCK.g=g;BGCK.busy=true;BGCK.stop=false;let bad=0,unk=0;
  for(let i=0;i<S.length;i++){if(BGCK.stop)break;const sn=S[i];const u=bgmUrl(g,sn);BGCK.msg=`점검 중 ${i+1}/${S.length} — ${sn}`;if(re)re();
   const r=u?await bgmProbe(u):{r:'bad',m:'주소가 없다'};BGCK.res[u]=r.r;if(r.r==='bad'){bad++;bgmBadSet(u,r.m)}else if(r.r==='?')unk++;else bgmBadSet(u,null)}
  BGCK.busy=false;BGCK.msg=BGCK.stop?'점검을 멈췄다':`점검 끝 — ${S.length}곡 중 실패 ${bad}${unk?' · 응답 없음 '+unk:''}`;if(re)re();if(bad)A().toast(`⚠ 「${gshort(g)}」 에 재생 못 하는 곡 ${bad}개`)}
 /* 브금 미리듣기(나만) · 모두에게 재생 · 방 차이 저장 */
 const PV={audio:null,g:'',s:'',title:''};
 function pvStop(){if(PV.audio){PV.audio.pause();PV.audio=null}PV.g='';PV.s='';PV.title=''}
 function bgmX(){const X=JSON.parse(JSON.stringify(R().bgmX||{}));X.add=X.add||{};X.del=X.del||{};return X}
 function direct(u){u=String(u||'').trim();const m=u.match(/^https?:\/\/(?:www\.)?dropbox\.com\/(scl\/fi\/[^?]+|s\/[^?]+)(\?.*)?$/);if(m){const q=(m[2]||'').replace(/[?&]dl=\d/,'').replace(/^&/,'?');return 'https://dl.dropboxusercontent.com/'+m[1]+(q==='?'?'':q)}return u}
 function bgmMode(){const m=R().bgmMode;return m==='seq'||m==='shuf'?m:''}
 async function playAll(g,s,re,q){const u=bgmUrl(g,s);if(!u)return A().toast('주소가 없다');unlocked=true;const v={src:u,title:s,group:g,at:Date.now()};const qm=q===undefined?bgmMode():q;if(qm)v.q=qm;await A().set(['rp','bgm'],v);const rec=[{g,s},...(R().recentBgm||[]).filter(x=>!(x.g===g&&x.s===s))].slice(0,10);await A().set(['rp','recentBgm'],rec);syncBgm(true);if(re)re()}
 /* 공지 효과음: 공지마다 고른 것(se) 이 없으면 이름으로 — 배틀 → Draw, 경고 · 출석 → Ping, 그 밖(씬 오픈 · 전환 · 종료) → Ping2 (모두 기존 효과음 재사용). 'none' 은 소리 없음 */
 function noticeSe(n){if(n.se)return n.se;const t=String(n.name||'')+' '+String(n.title||'');return /배틀/.test(t)?'Draw':/경고|출석|주의/.test(t)?'Ping':'Ping2'}
 async function fireNotice(n,sub){const ment=sub||n.ment||'';await A().set(['rp','banner'],{title:n.title||n.name,text:ment,color:n.color||'#d9243f',se:noticeSe(n),at:Date.now()});
  if(n.id){const rec=[n.id,...(R().recentNt||[]).filter(x=>x!==n.id)].slice(0,4);try{await A().set(['rp','recentNt'],rec)}catch(e){}}   /* 11-03: 콘솔 「최근」 띠 */await A().sysLog(`[${n.title||n.name}]${ment?' '+ment.replace(/\n/g,' '):''}`);if(n.bgm==='stop')await A().set(['rp','bgm'],null)}

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
 /* GM 닉 전용 프로필 줄 — 닉이 있을 때만. 공용을 보는 중이면 「전용 만들기」, 전용을 보는 중이면 「공용 편집 · 공용으로 돌아가기」 */
 function gmProfRow(c){const n=A().ST.gmNick;if(!n)return '<div class="small dim" style="margin:-4px 0 8px">닉네임(이름 칸)을 정하면 그 닉 전용 GM 프로필을 따로 만들 수 있다.</div>';const own=c.id==='gm@'+n;const has=!!gmProfs()[n];
  return `<div class="row small" style="margin:-4px 0 8px;gap:6px;align-items:center"><span class="tag">${own?`「${esc(n)}」 전용`:'공용 GM'}</span><span class="dim">${own?'이 닉으로 쓴 줄만 이 그림 · 스탠딩을 쓴다':has?`「${esc(n)}」 전용 프로필이 따로 있다`:'닉이 다른 GM 끼리 같은 프로필을 쓰는 중'}</span><span class="sp"></span>${own?'<button class="btn xs ghost" data-gmprof="shared">공용 편집</button><button class="btn xs ghost danger" data-gmprof="drop">공용으로 돌아가기</button>':has?`<button class="btn xs ghost" data-gmpgo>「${esc(n)}」 전용 열기</button>`:`<button class="btn xs" data-gmprof="make">「${esc(n)}」 전용 프로필 만들기</button>`}</div>`}
 function openStands(key){const c=charOf(key);if(!c)return A().toast('그 인물이 없다');const ST=A().ST;const canEdit=gm()||(c.kind==='pc'&&c.id===ST.seat)||(c.kind==='pm'&&c.tid===ST.seat);
  const KINDS=[['','모양 자동'],['stand','스탠딩'],['portrait','초상']];const kindSel=(attr,v)=>`<select ${attr}>${KINDS.map(([k,n])=>`<option value="${k}" ${(v||'')===k?'selected':''}>${n}</option>`).join('')}</select>`;
  const cur=c.stands.map(s=>Object.assign({},s));let act=Math.max(0,Math.min(c.active||0,cur.length-1));
  const card=(s,i)=>`<div class="stxc ${i===act?'on':''}">
    <div class="stxp" ${canEdit?`data-st="use" data-i="${i}" title="눌러서 이 표정으로"`:''}>${s.src?`<img src="${esc(s.src)}" alt="" loading="lazy">`:'<span class="small dim">그림 없음</span>'}${i===act?'<span class="stxon">사용 중</span>':''}${s.kind?`<span class="stxk">${s.kind==='stand'?'스탠딩':'초상'}</span>`:''}</div>
    ${canEdit?`<div class="stxf"><input type="text" class="stxl" data-sl="${i}" value="${esc(s.label||'')}" placeholder="라벨"><input type="number" class="n stxn" data-sp="${i}" value="${+s.point||0}" title="보정 — 위로 올릴 px (음수면 내림)"><input type="number" class="n stxn" data-swa="${i}" value="${+s.waist||''}" min="30" max="80" placeholder="허리%" title="상반신(방 설정)일 때 이 그림의 허리 높이 % — 그림 맨 위에서 허리까지. 비우면 방 설정 값"></div>
    <div class="stxf">${kindSel(`data-stk="${i}"`,s.kind)}<label class="btn xs ghost" title="그림만 바꾸기">교체<input type="file" accept="image/*" data-srep="${i}" hidden></label><button class="btn xs ghost danger" data-st="del" data-i="${i}" title="지우기">×</button></div>`
    :`<div class="stxf"><b class="stxb">${esc(s.label||'기본')}</b></div>`}</div>`;
  const md=A().openModal(`<div class="mhead"><h2>${esc(c.name)} — 표정·스탠딩</h2><span class="sp"></span><span class="tag">${cur.length}장</span><button class="btn ghost" data-x>닫기</button></div>${c.kind==='gm'?`<div class="row small dim" style="margin:-4px 0 8px">GM 도 스탠딩을 쓴다 — 「GM」으로 따옴표 대사("…")를 칠 때 무대에 서고, 따옴표 없는 지문은 그대로 나레이션.<span class="sp"></span><button class="btn xs ghost" data-gmimg>칩·로그 그림</button></div>${gm()?gmProfRow(c):''}`:''}
   ${canEdit?`<div class="stdz" id="st_dz"><div class="stdzt"><b>그림을 여기로 끌어 놓기</b><span class="small dim">여러 장·폴더째로 된다 · 파일 이름이 라벨 · 같은 라벨은 그림만 바뀐다 · Ctrl+V 로 붙여넣기도</span></div>
    <div class="row stdzb"><label class="btn sm pri">파일 고르기<input type="file" accept="image/*" multiple id="st_f" hidden></label><label class="btn sm">폴더 올리기<input type="file" webkitdirectory directory multiple id="st_d" hidden></label><span class="sp"></span>${kindSel('id="st_k" title="새로 올리는 그림의 모양"','')}</div>
    <div class="stprog" id="st_pg" hidden><i></i><span></span></div></div>`:''}
   ${canEdit?`<div class="row stscale"><b>스탠딩 크기</b><input type="range" id="st_sc" min="40" max="200" step="5" value="${c.scale||100}" style="flex:1"><b id="st_sc_v">${c.scale||100}%</b><button class="btn xs ghost" id="st_sc0">원래대로</button></div><div class="small dim" style="margin:-4px 0 8px">이 인물의 모든 표정에 같이 적용 · 발밑 기준 · 움직이면 무대에 바로 보이고 손을 떼면 저장</div>`:''}
   <div class="stxg">${cur.map(card).join('')||'<div class="empty small">아직 스탠딩이 없다 — 시트 그림(초상)을 쓴다</div>'}</div>
   ${canEdit?`<details class="stmore"><summary>그림 주소로 추가</summary><div class="row"><input type="text" id="st_l" placeholder="라벨" style="width:120px"><input type="text" id="st_u" placeholder="그림 주소 (투명 PNG 전신 권장)" style="flex:1"><button class="btn sm" data-st="add">추가</button></div></details>`:''}
   <details class="stmore"><summary>도움말</summary><div class="small dim">채팅할 때 「사용 중」인 스탠딩이 무대에 선다. 없으면 초상(시트 그림)을 쓴다. 그림을 누르면 그 표정으로 바뀌고, 채팅에서 <code>/s 라벨</code> 로도 바꿀 수 있다. 숫자 칸은 보정 — 위로 올릴 px (음수면 내림). 모양: 「스탠딩」은 틀 없이 전신으로, 「초상」은 네모 틀 안에 선다 (「자동」은 그림 비율로 정한다).</div></details>`);
  md.classList.add('stmodal2');
  {const gi=$('[data-gmimg]',md);if(gi)gi.onclick=()=>{A().closeModal();openGmImg(c.id)}}
  {const gp=$('[data-gmprof]',md);if(gp)gp.onclick=async()=>{const n=A().ST.gmNick;if(!n)return;const how=gp.dataset.gmprof;
    if(how==='make'){const g=R().gmSt||{};if(!await A().set(['rp','gmProf',n],{img:gmImg()||null,stands:(g.stands||[]).map(x=>Object.assign({},x)),standActive:g.standActive||0,standScale:g.standScale||null}))return;A().toast(`「${n}」 전용 프로필을 만들었다 — 지금부터 고치는 건 이 닉에만`);A().closeModal();A().renderScene();openStands('gm@'+n)}
    else if(how==='drop'){if(!await askOk(`「${n}」 전용 프로필을 지우고 공용 GM 프로필로 돌아갈까?\n전용으로 올린 그림 · 스탠딩은 사라진다.`,'돌아간다'))return;if(!await A().set(['rp','gmProf',n],null))return;A().toast('공용 GM 프로필로 돌아갔다');A().closeModal();A().renderScene();openStands('gm')}
    else if(how==='shared'){A().closeModal();openStands('gm')}}}
  {const go=$('[data-gmpgo]',md);if(go)go.onclick=()=>{A().closeModal();openStands('gm@'+A().ST.gmNick)}}
  const path=c.kind==='gm'?gmPath(c.id):c.kind==='pc'?['roster','trainers',c.id]:c.kind==='pm'?['roster','mons',c.id]:['graph','nodes',c.id];
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
   {const sc=$('#st_sc',md),sv=$('#st_sc_v',md);const live=v=>{sv.textContent=v+'%';document.querySelectorAll('#stands .stand').forEach(ch=>{if(ch.dataset.key===c.key){const im=ch.querySelector('img');if(im)standTf(im,/scaleX\(-1\)/.test(im.style.transform),v)}})};
    const put=async v=>{if(!okPath())return;await A().set([...path,'standScale'],+v===100?null:+v)};
    sc.oninput=()=>live(+sc.value);sc.onchange=()=>put(+sc.value);$('#st_sc0',md).onclick=()=>{sc.value=100;live(100);put(100)}}
   md.querySelectorAll('[data-sl]').forEach(inp=>inp.onchange=()=>{const i=+inp.dataset.sl;cur[i]=Object.assign({},cur[i],{label:inp.value.trim()||'기본'});save(false)});
   md.querySelectorAll('[data-sp]').forEach(inp=>inp.onchange=()=>{const i=+inp.dataset.sp;cur[i]=Object.assign({},cur[i],{point:+inp.value||0});save(false)});
   md.querySelectorAll('[data-swa]').forEach(inp=>inp.onchange=()=>{const i=+inp.dataset.swa;const w=Math.round(+inp.value||0);const o=Object.assign({},cur[i]);if(w>=30&&w<=80)o.waist=w;else delete o.waist;cur[i]=o;save(false)});
   md.querySelectorAll('[data-stk]').forEach(sel=>sel.onchange=()=>{const i=+sel.dataset.stk;const s=Object.assign({},cur[i]);if(sel.value)s.kind=sel.value;else delete s.kind;cur[i]=s;save(true)});
   md.querySelectorAll('[data-srep]').forEach(fi=>fi.onchange=async()=>{const i=+fi.dataset.srep,f=fi.files[0];if(!f)return;A().toast('올리는 중…');try{const url=await upOne(f);cur[i]=Object.assign({},cur[i],{src:url});await save(true)}catch(e){A().toast(e.message)}});
   md.querySelectorAll('[data-st]').forEach(b=>b.onclick=async()=>{const k=b.dataset.st;const i=+b.dataset.i;
    if(k==='use'){act=i;return save(true)}
    if(k==='del'){if(!confirm(`「${cur[i].label||'기본'}」 스탠딩을 지울까?`))return;cur.splice(i,1);if(act>i||act>=cur.length)act=Math.max(0,act-1);return save(true)}
    if(k==='add'){const u=$('#st_u',md).value.trim();if(!u)return A().toast('그림 주소가 필요해');const kd=$('#st_k',md).value;cur.push(Object.assign({label:$('#st_l',md).value.trim()||stLabel(u.split('?')[0])||'기본',src:u,point:0},kd?{kind:kd}:{}));act=cur.length-1;return save(true)}})}}
 function openMyStand(){const ST=A().ST;if(gm()){const chars=[{key:'gm',name:'GM'},...Object.keys(gmProfs()).filter(n=>gmProfs()[n]).map(n=>({key:'gm@'+n,name:'GM · '+n})),...Object.values((ST.state.roster||{}).trainers||{}).map(t=>({key:t.id,name:t.name})),...Object.values((ST.state.graph||{}).nodes||{}).map(n=>({key:'npc:'+n.name,name:n.name+' (NPC)'}))];
   const md=A().openModal(`<div class="mhead"><h2>표정·스탠딩</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="row"><select id="gsc2" style="flex:1">${chars.map(c=>`<option value="${esc(c.key)}">${esc(c.name)}</option>`).join('')}</select><button class="btn sm pri" id="gsc2ok">열기</button></div>`);$('#gsc2ok',md).onclick=()=>openStands($('#gsc2',md).value);return}
  if(!ST.seat)return A().toast('자리에 앉아야 한다');openStands(ST.seat)}
 /* 채팅 /s 라벨 */
 async function setMyStand(label){const ST=A().ST;if(ST.role==='gm')return A().toast('GM 은 콘솔 → 무대·스탠딩에서 바꿔');const c=charOf(ST.seat);if(!c)return;const i=c.stands.findIndex(s=>(s.label||'')===label);if(i<0)return A().toast('그런 표정이 없다: '+c.stands.map(s=>s.label).join(', '));await A().set(['roster','trainers',c.id,'standActive'],i);A().toast(`표정: ${label}`)}

 /* ----- 효과음: rp.se={name,src,at} 가 바뀌면 모두 한 번 울린다. 음량은 각자 (om_vol_se) ----- */
 let volSe=0.7,lastSe=0;try{volSe=+(localStorage.getItem('om_vol_se')??0.7)}catch(e){}
 function seUrl(name){const G=(DB().se||{}).groups||{};for(const g in G)if(G[g][name])return G[g][name];return ''}
 function seList(){const G=(DB().se||{}).groups||{};return G}
 const seOff=()=>!!(window.OM_PREFS&&window.OM_PREFS.get().seMute);
 /* 10-24 망령: 같은 소리는 한 번 받아 둔 걸 다시 쓴다 (매번 새로 받느라 컷인보다 늦게 울리던 것). 배틀 기본 효과음은 첫 클릭 뒤 미리 받아 둔다 */
 const SEC=new Map();
 /* 효과음별 손질: vol 크기 배수 · end 초에서 끊기(fade 초 동안 줄이며) */
 const SE_TUNE={ball_open:{vol:.65,end:1.9,fade:1}};
 function seAudio(u,tn){try{let b=SEC.get(u);if(!b){b=new Audio(u);b.preload='auto';SEC.set(u,b)}const a=(b.paused||b.ended)?b:b.cloneNode();a.currentTime=0;const v0=Math.min(1,volSe*((tn&&tn.vol)||1));a.volume=v0;a.play().catch(()=>{});
  if(tn&&tn.end){const fd=tn.fade||.15,st=Date.now();clearInterval(a._tn);a._tn=setInterval(()=>{const t=(Date.now()-st)/1000;if(t>=tn.end){clearInterval(a._tn);a.pause();a.volume=v0;return}if(t>tn.end-fd){const q=Math.max(0,(tn.end-t)/fd);a.volume=v0*q*q}},25)}}catch(e){}}
 document.addEventListener('pointerdown',()=>setTimeout(()=>{try{const g=seList()['00. 기본 (배틀)']||{};for(const n of ['Blow','Draw','Ping','fail','Ping2','cut','cut_critical','dice','evasion','Dead','raid_warning','ball_open']){const u=g[n];if(u&&!SEC.has(u)){const b=new Audio(u);b.preload='auto';SEC.set(u,b)}}}catch(e){}},1500),{once:true});
 function playSe(name,localOnly){if(seOff()&&localOnly!=='force')return;const u=/^https?:/.test(name)?name:seUrl(name);if(!u)return;if(!gm())localOnly=true;/* 좌석은 rp 를 못 쓰니 내 쪽에서만 울린다 */if(localOnly){seAudio(u,SE_TUNE[name]);return}A().set(['rp','se'],{name,src:u,at:Date.now()})}
 /* 로그를 보고 자동 효과음: 주사위 → dice, 지시 공개 → Draw, 턴 개시 → Ping2, 공격 명중 → Blow, 급소 → cut_critical, 빗나감 → evasion, 빈사 → Dead */
 let seenLog=new Set(),lastBall=0;
 function autoSe(row){if(!row||!row.id||seenLog.has(row.id))return;seenLog.add(row.id);if(seenLog.size>500)seenLog=new Set([...seenLog].slice(-200));if(row.at&&Date.now()-new Date(row.at).getTime()>15000)return;
  try{if(window.OM_BATTLE_UI&&window.OM_BATTLE_UI.logFx)window.OM_BATTLE_UI.logFx(row)}catch(e){}   /* 11-03 감우 (검토 6 · 7): 피해 · 급소 · 빈사 · 턴 종료 순차 — 카드 연출은 소리 설정과 상관없이 (battle_ui logFx) */
  if(!unlocked)return;
  const t=String((row.data||{}).t||'');let n='';if(row.kind==='dice')n='dice';else if(row.kind==='battle'){if(/^【공개】/.test(t))n='Draw';else if(/^턴 개시/.test(t))n='Ping2';else if(/급소!/.test(t))n='cut_critical';else if(/명중\(|필중/.test(t))n='Blow';else if(/빗나감/.test(t))n='evasion';else if(/풀이 죽어|잠자고|저려서|얼어붙어|홀딱 반해|스스로를 공격/.test(t))n=seUrl('fail')?'fail':'Ping'}
  /* 10-24 망령: 파일 없이 브라우저에서 만드는 소리 — 등장(볼 열림) · 랭크 상승/하강 · 회복 · 양측 지시 준비 완료 */
  if(!n&&row.kind==='battle'){const sy=k=>{try{if(window.OM_CUTIN&&window.OM_CUTIN.synth)window.OM_CUTIN.synth(k)}catch(e){}};const h=(row.data||{}).hp;
   if(/^【준비 완료】/.test(t))return sy('ready');
   if(/ 등장 \((좌측|우측) /.test(t)){const now=Date.now();const ball=()=>{if(seUrl('ball_open'))playSe('ball_open',true);else sy('ball')};if(now-lastBall>90){lastBall=now;ball()}else setTimeout(ball,140);return}
   if(h&&+h.cur>+h.prev&&+h.prev>0)return sy('heal');
   if(h&&+h.cur<+h.prev||/^【피해】/.test(t)){const em=t.match(/상성 ×([\d.]+)/),e=em?+em[1]:1;sy(e>1?'dmg_big':e<1?'dmg_weak':'dmg');if(/빈사!|쓰러졌다!/.test(t))setTimeout(()=>playSe('Dead',true),650);return}
   let d=0;t.replace(/배율 ×([\d.]+) → ×([\d.]+)/g,(_,x,y)=>{d+=Math.sign((+y)-(+x))});if(/^【랭크·배율】/.test(t))t.replace(/랭크 ([+-]?\d+) → ([+-]?\d+)/g,(_,x,y)=>{d+=(+y)-(+x)});else if(!d){const mm=t.match(/(?:공격|방어|특공|특방|스피드|명중|회피)\s*(?:랭크\s*)?([+-])\d/);if(mm)d=mm[1]==='+'?1:-1;else{const mx=t.match(/(?:공격|방어|특공|특방|스피드|명중|회피) ×([\d.]+)/);if(mx&&+mx[1]!==1)d=+mx[1]>1?1:-1}}
   if(d)return sy(d>0?'up':'down')}
  const dead=/빈사!|쓰러졌다!/.test(t);if(!n&&!dead)return;if(n)playSe(n,true);if(dead)setTimeout(()=>playSe('Dead',true),n?700:0)}
 function syncSe(){const se=R().se;if(!se||!se.at||se.at===lastSe)return;lastSe=se.at;if(Date.now()-se.at>8000)return;if(seOff())return;if(!unlocked&&!gm())return;seAudio(se.src)}
 function setVolume(kind,v){if(kind==='se'){volSe=v;try{localStorage.setItem('om_vol_se',v)}catch(e){}}else{vol=v;try{localStorage.setItem('om_vol',v)}catch(e){}if(audio)audio.volume=v;if(PV.audio)PV.audio.volume=v}}
 /* ----- 배너 / BGM / 상태 변화 ----- */
 /* 11-03 감우 (검토 20-2): 배너는 무대 영역 폭에 맞추고(채팅 열 · 모달을 안 덮게 — 무대가 없는 화면이면 예전처럼 화면 폭), 5.6초 뒤 0.4초 퇴장 애니메이션, 공지에 담긴 효과음(se)을 각자 소리 설정대로 */
 function tickBanner(){const b=R().banner;if(!b||!b.at||b.at===lastBanner||Date.now()-b.at>15000)return;lastBanner=b.at;
  const el=document.createElement('div');el.className='banner';el.style.setProperty('--bc',b.color||'#d9243f');el.innerHTML=`<div class="bt">${esc(b.title||'')}</div>${b.text?`<div class="bm">${esc(b.text).replace(/\n/g,'<br>')}</div>`:''}`;
  const st=document.getElementById('rpstage');const q=st&&st.offsetWidth?st.getBoundingClientRect():null;
  if(q&&q.width>=280&&q.bottom>0&&q.top<innerHeight){el.classList.add('instage');el.style.left=Math.round(q.left)+'px';el.style.width=Math.round(q.width)+'px';el.style.top=Math.round(q.top+q.height*.16)+'px'}
  /* 6초 안에 새 공지가 오면 앞 배너를 바로 치운다 (예전엔 앞 배너의 타이머만 지워서 영영 남았다 · 점검 3-13) */
  document.querySelectorAll('body > .banner').forEach(x=>x.remove());document.body.appendChild(el);
  if(b.se&&b.se!=='none'&&Date.now()-b.at<8000){try{playSe(b.se,true)}catch(e){}}
  clearTimeout(bannerT);bannerT=setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),420)},5600)}
 const bgmOff=()=>!!(window.OM_PREFS&&window.OM_PREFS.get().bgmMute);
 function bgmMuted(on){if(on&&!(gm()&&(R().bgm||{}).q)){if(audio){fadeOut(audio);audio=null}lastBgm=''}else syncBgm(true)}
 /* 11-03 망령: ① 그룹 「이어 재생」(rp.bgm.q = seq 순서 · shuf 섞기) — 곡이 끝나면 GM 화면이 다음 곡을 모두에게 건다 (GM 이 소리를 꺼 두었어도 소리 없이 재생해 끝을 잰다)
    ② 곡이 바뀔 때 0.8초 페이드(각자 브라우저) ③ 재생 실패(죽은 링크 · 디코딩 오류)는 GM 에게 토스트 + 콘솔 목록 ⚠, 이어 재생 중이면 다음 곡으로 */
 const FADE_MS=800;
 function fadeOut(a){if(!a)return;try{a.loop=false;a.onended=null;a.onerror=null}catch(e){}const v0=a.volume,t0=Date.now();const iv=setInterval(()=>{const k=1-(Date.now()-t0)/FADE_MS;if(k<=0){clearInterval(iv);try{a.pause();a.src='';a.load()}catch(e){}return}try{a.volume=Math.max(0,v0*k)}catch(e){}},50)}
 function fadeIn(a){if(!a)return;const t0=Date.now();a._fading=true;try{a.volume=0}catch(e){}const iv=setInterval(()=>{if(audio!==a){clearInterval(iv);return}const k=(Date.now()-t0)/FADE_MS;if(k>=1){clearInterval(iv);a._fading=false;try{a.volume=vol}catch(e){}return}try{a.volume=vol*k}catch(e){}},50)}
 const BGMBAD=(()=>{try{return JSON.parse(localStorage.getItem('om_bgmbad')||'{}')||{}}catch(e){return {}}})();
 function bgmBadSet(src,msg){if(!src)return;if(msg===null)delete BGMBAD[src];else BGMBAD[src]={m:String(msg||'재생 실패').slice(0,80),at:Date.now()};try{localStorage.setItem('om_bgmbad',JSON.stringify(BGMBAD))}catch(e){}}
 function bgmErrMsg(a){const e=a&&a.error;if(!e)return '재생 실패';return ({1:'중단됨',2:'받지 못함 (주소 · 네트워크)',3:'디코딩 오류 (파일이 깨졌거나 형식)',4:'지원하지 않는 형식 · 없는 주소'})[e.code]||'재생 실패'}
 function bgmNextPick(b){const G=bgmGroups();const ss=Object.keys(G[b.group]||{}).sort();if(!ss.length)return null;const i=ss.indexOf(b.title);
  if(b.q==='shuf'){if(ss.length===1)return ss[0];let p=ss[Math.floor(Math.random()*ss.length)];if(p===b.title)p=ss[(ss.indexOf(p)+1)%ss.length];return p}
  return ss[(i+1)%ss.length]}
 const BGQ={busy:false};
 async function bgmAdvance(b,why){if(!gm()||!b||!b.q||BGQ.busy)return;BGQ.busy=true;try{
   await new Promise(r=>setTimeout(r,200+Math.random()*500));   /* GM 창이 둘이면 한쪽만 — 잠깐 기다렸다가 아직 그 곡이면 */
   const cur=R().bgm||{};if(cur.src!==b.src||cur.at!==b.at)return;
   const G=bgmGroups();const ss=Object.keys(G[b.group]||{});const tried=new Set([b.title]);let pick=bgmNextPick(b);
   while(pick&&BGMBAD[bgmUrl(b.group,pick)]&&tried.size<ss.length){tried.add(pick);pick=bgmNextPick(Object.assign({},b,{title:pick}))}   /* 실패로 표시된 곡은 건너뛴다 */
   if(!pick||(ss.length>1&&pick===b.title&&why==='error'))return;
   await playAll(b.group,pick,null,b.q)}finally{BGQ.busy=false}}
 function bgmHook(a,b){a.loop=!b.q;a.onended=()=>{if(audio!==a||!b.q)return;bgmAdvance(b,'ended')};a.onplaying=()=>{if(audio===a)BGQ.errs=0};
  a.onerror=()=>{if(audio!==a)return;const msg=bgmErrMsg(a);bgmBadSet(b.src,msg);console.warn('[오레마스] BGM 재생 실패',b.title,msg);if(gm()){A().toast(`⚠ BGM 재생 실패 — ${b.title||'곡'}: ${msg}`);if(b.q){BGQ.errs=(BGQ.errs||0)+1;if(BGQ.errs>=3){A().toast('⚠ 곡이 연달아 실패해서 이어 재생을 멈춘다 — 「링크 점검」으로 확인해 줘');return}bgmAdvance(b,'error')}}}}
 function syncBgm(force){const b=R().bgm;const src=b&&b.src||'';const drive=!!(gm()&&b&&b.q&&src);   /* drive: 소리를 못 내도 끝을 재야 한다 */
  const stop=()=>{if(audio){fadeOut(audio);audio=null}lastBgm=''};
  if(bgmOff()&&!drive){stop();return}   /* 내 설정에서 BGM 정지 */
  if(!src){stop();return}
  if(!unlocked&&!drive)return;
  const silent=bgmOff()||!unlocked;
  if(src===lastBgm&&!force&&audio){if(audio.muted!==silent){audio.muted=silent;if(!silent&&!audio._fading)audio.volume=vol}bgmHook(audio,b);return}
  if(src!==lastBgm||force){if(audio)fadeOut(audio);const a=new Audio(src);a.preload='auto';a.muted=silent;bgmBadSet(src,null);bgmHook(a,b);audio=a;lastBgm=src;a.play().catch(e=>{if(audio===a&&!/NotAllowed|NotSupported|Abort/.test(String(e&&e.name)))console.warn('[오레마스] BGM',e)});if(!silent)fadeIn(a)}}
 /* ----- 10-25 망령: 화자 고르기 창 — RP 입력줄 · 채팅 입력칸 공용. 긴 select 목록 대신 찾기 · 배틀 중 · 최근 · 폴더별 묶음을 그림과 함께 -----
    고른 화자는 이 브라우저의 최근 목록(om_spk_recent, 8명)에 남는다. 폴더 접힘은 om_spkp_fold */
 const SPKR_LS='om_spk_recent';
 const recentSpk=()=>{try{const v=JSON.parse(localStorage.getItem(SPKR_LS)||'[]');return Array.isArray(v)?v:[]}catch(e){return []}};
 function pushRecent(k){if(!k||k==='gm'||k==='me')return;try{const L=recentSpk().filter(x=>x!==k);L.unshift(k);localStorage.setItem(SPKR_LS,JSON.stringify(L.slice(0,8)))}catch(e){}}
 let SPKF={};try{SPKF=JSON.parse(localStorage.getItem('om_spkp_fold')||'{}')||{}}catch(e){}
 function curSpk(speakers){const k=SPK.key;if(k&&(!speakers||speakers.some(x=>x.key===k)))return k;return gm()?'gm':'me'}
 function spkInfo(key){const ST=A().ST;
  if(key==='gm'){const g=charOf(myGmKey());return {key,name:'GM',sub:A().ST.gmNick&&g.nick?A().ST.gmNick+' 전용 · 나레이션':'나레이션',av:g.img||standSrc(g),kind:'gm'}}
  if(key==='me'){const c=charOf(ST.seat);return {key,name:c?c.name:(ST.name||'나'),sub:'내 트레이너',av:c?(c.img||standSrc(c)):'',kind:'pc'}}
  const c=charOf(key);if(!c)return {key,name:key.replace(/^(npc|as|pm):/,''),sub:'',av:'',kind:''};
  let sub=c.kind==='pm'?'포켓몬':c.kind==='pc'?'PC':'인물';if(c.kind==='pm'){const t=((ST.state.roster||{}).trainers||{})[c.tid];if(t)sub='포켓몬 · '+t.name}
  return {key,name:c.name,sub,av:c.img||standSrc(c),kind:c.kind}}
 const spkAv=(i,cls)=>`<i class="${cls||'spkp-av'}${i.av?'':' noimg'}" style="${i.av?`background-image:url('${cssu(i.av)}')`:''}">${i.av?'':esc(i.key==='gm'?'GM':[...(i.name||'')].slice(0,2).join(''))}</i>`;
 function spkBtnFill(btn,key){const i=spkInfo(key);const h=`${spkAv(i,'spkp-av sm')}<span class="spkpbn">${esc(i.name)}</span><span class="spkpcar">▾</span>`;if(btn._h!==h){btn.innerHTML=h;btn._h=h}btn.dataset.k=key}
 /* 배틀 중인 트레이너 · 포켓몬 (필드에 나온 포켓몬 먼저) — 화자 키로 */
 function battleSpkKeys(have){const b=A().ST.state.battle||{};const out=[];const field=new Set();
  for(const side of ['left','right'])for(const tid of (((b.sides||{})[side]||{}).trainers||[])){const t=(b.trainers||{})[tid];if(!t)continue;
   const tk=have.has('as:'+t.name)?'as:'+t.name:have.has('npc:'+t.name)?'npc:'+t.name:'';if(tk)out.push(tk);
   const ms=Object.values(b.mons||{}).filter(m=>m.tid===tid).sort((x,y)=>(y.entry&&y.hp&&y.hp.cur>0?1:0)-(x.entry&&x.hp&&x.hp.cur>0?1:0));
   for(const m of ms){const k='pm:'+(m.rid||m.id);if(!have.has(k))continue;out.push(k);if(m.entry&&m.hp&&m.hp.cur>0)field.add(k)}}
  return {keys:[...new Set(out)],field}}
 function pickSections(){const ST=A().ST;
  if(!gm()){const keys=['me',...Object.values((ST.state.roster||{}).mons||{}).filter(m=>m.tid===ST.seat).map(m=>'pm:'+m.id)];const bs=battleSpkKeys(new Set(keys));return {secs:[{id:'mine',name:'내 캐릭터',keys}],field:bs.field}}
  const all=allSpeakers();const have=new Set(all.map(x=>x.key));const C=spkConf();const secs=[{id:'gm',name:'',keys:['gm']}];
  const bs=battleSpkKeys(have);if(bs.keys.length)secs.push({id:'bat',name:'⚔ 배틀 중',keys:bs.keys});
  const rc=recentSpk().filter(k=>have.has(k));if(rc.length)secs.push({id:'rec',name:'🕘 최근',keys:rc});
  const inF=new Set();const fids=[];for(const k of C.order||[])if(String(k).startsWith('f:')&&C.folders[k.slice(2)])fids.push(k.slice(2));for(const id of Object.keys(C.folders))if(!fids.includes(id))fids.push(id);
  for(const id of fids){const f=C.folders[id];const keys=(f.keys||[]).filter(k=>have.has(k)&&!C.hidden[k]);keys.forEach(k=>inF.add(k));if(keys.length&&!f.hid)secs.push({id:'f:'+id,name:'📁 '+f.name,keys,fold:true})}
  const loose=all.map(x=>x.key).filter(k=>k!=='gm'&&!inF.has(k)&&!C.hidden[k]);if(loose.length)secs.push({id:'loose',name:fids.length?'📂 폴더 밖':'인물',keys:loose,fold:true});
  return {secs,field:bs.field}}
 function closeSpkPick(){const p=document.querySelector('.spkp');if(p){p.remove();document.removeEventListener('pointerdown',spkPickOut,true)}}
 function spkPickOut(e){const p=document.querySelector('.spkp');if(!p)return;if(p.contains(e.target)||(p._anchor&&p._anchor.contains(e.target)))return;closeSpkPick()}
 function openSpkPick(anchor,opt){if(document.querySelector('.spkp')&&document.querySelector('.spkp')._anchor===anchor)return closeSpkPick();closeSpkPick();
  const {secs,field}=pickSections();const cur=opt.cur;const many=secs.reduce((n,s)=>n+s.keys.length,0)>8;
  const it=k=>{const i=spkInfo(k);return `<button type="button" class="spkp-it ${k===cur?'on':''}" data-k="${esc(k)}" data-q="${esc((i.name+' '+i.sub).toLowerCase())}">${spkAv(i)}<span class="spkp-tx"><b>${esc(i.name)}</b><small>${esc(i.sub)}${field.has(k)?' <em class="spkp-fd">필드</em>':''}</small></span></button>`};
  const pop=document.createElement('div');pop.className='spkp';pop._anchor=anchor;
  pop.innerHTML=`${many?'<div class="spkp-h"><input type="search" class="spkp-q" placeholder="이름 · 트레이너로 찾기" autocomplete="off"></div>':''}<div class="spkp-b">${secs.map(s=>`<div class="spkp-sec ${s.fold&&SPKF[s.id]?'shut':''}" data-s="${esc(s.id)}">${s.name?`<button type="button" class="spkp-sh" ${s.fold?'data-fold':''}>${s.fold?'<span class="spkp-ar">▾</span> ':''}${esc(s.name)} <small>${s.keys.length}</small></button>`:''}<div class="spkp-g">${s.keys.map(it).join('')}</div></div>`).join('')}</div>`;
  document.body.appendChild(pop);
  const place=()=>{const r=anchor.getBoundingClientRect();const W=Math.min(380,innerWidth-16);pop.style.width=W+'px';const below=innerHeight-r.bottom-10,above=r.top-10;const up=below<320&&above>below;const mh=Math.max(180,Math.min(520,(up?above:below)));pop.style.maxHeight=mh+'px';pop.style.left=Math.max(8,Math.min(innerWidth-W-8,r.left))+'px';if(up){pop.style.top='';pop.style.bottom=(innerHeight-r.top+6)+'px'}else{pop.style.bottom='';pop.style.top=(r.bottom+6)+'px'}};place();
  const pick=k=>{closeSpkPick();opt.onPick&&opt.onPick(k)};
  pop.querySelectorAll('.spkp-it').forEach(b=>b.onclick=()=>pick(b.dataset.k));
  pop.querySelectorAll('[data-fold]').forEach(b=>b.onclick=()=>{const sec=b.closest('.spkp-sec');const id=sec.dataset.s;if(SPKF[id])delete SPKF[id];else SPKF[id]=1;try{localStorage.setItem('om_spkp_fold',JSON.stringify(SPKF))}catch(e){}sec.classList.toggle('shut',!!SPKF[id])});
  const q=pop.querySelector('.spkp-q');
  const filt=()=>{const v=(q?q.value:'').trim().toLowerCase();pop.classList.toggle('qing',!!v);pop.querySelectorAll('.spkp-sec').forEach(sec=>{let any=0;sec.querySelectorAll('.spkp-it').forEach(b=>{const ok=!v||b.dataset.q.includes(v);b.style.display=ok?'':'none';if(ok)any++});sec.style.display=any?'':'none'})};
  if(q){q.oninput=filt;if(matchMedia('(pointer:fine)').matches)setTimeout(()=>q.focus(),20)}   /* 휴대폰은 자판이 올라와 창을 가리니 바로 포커스하지 않는다 */
  pop.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeSpkPick();anchor.focus()}if(e.key==='Enter'&&e.target===q&&!e.isComposing){e.preventDefault();const f=[...pop.querySelectorAll('.spkp-it')].find(b=>b.style.display!=='none'&&b.offsetParent);if(f)pick(f.dataset.k)}});
  {const on=pop.querySelector('.spkp-it.on');if(on&&!on.closest('.shut'))on.scrollIntoView({block:'nearest'})}
  setTimeout(()=>document.addEventListener('pointerdown',spkPickOut,true),0)}
 /* ----- 10-25 망령: 배틀 화자 줄 (GM) — 「시합 개시 · 턴 진행」 줄 아래. GM · 배틀 중 트레이너/포켓몬(필드 먼저) · 인물(NPC)로 채팅 화자를 바꾼다.
    접기 · 대사창(배틀 말풍선) 켜기/끄기 · 스탠딩 크기는 이 브라우저에만 (om_bspk_open · om_bsay_on · om_bsay_scale) */
 const LSg=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:v}catch(e){return d}};const LSs=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
 const BSP={open:LSg('om_bspk_open','1')!=='0',on:LSg('om_bsay_on','1')!=='0',sc:Math.max(60,Math.min(200,+LSg('om_bsay_scale','150')||150))};
 /* 📌 고정: GM 이 배틀 화자 줄에 늘 둘 화자 (방에 저장 rp.bspkPin) — 아직 한 번도 안 정했으면 숨기지 않은 인물(NPC) 전부 */
 function bspkPins(){const v=R().bspkPin;if(Array.isArray(v))return v.slice();const C=spkConf();return allSpeakers().filter(x=>x.kind==='npc'&&!C.hidden[x.key]).map(x=>x.key)}
 async function bspkPinSave(L){await A().set(['rp','bspkPin'],[...new Set(L)])}
 function bsayToggleHtml(){return `<button type="button" class="btn sm ${BSP.on?'pri':'ghost'} bsaytog" data-bspk="on" title="배틀 말풍선(대사창) 켜기 · 끄기 — 이 브라우저에서만">💬<span class="lbl"> 대사창</span> ${BSP.on?'ON':'OFF'}</button>`}
 function bspkHtml(){const ST=A().ST;const all=allSpeakers();const have=new Set(all.map(x=>x.key));const C=spkConf();
  const bs=battleSpkKeys(have);const pins=bspkPins().filter(k=>have.has(k));const cur=ST.chatAs||'gm';
  const chip=(k,pin)=>{const i=spkInfo(k);return `<button type="button" class="spk ${k===cur?'on':''}${pin?' pin':''}" data-bspk-k="${esc(k)}" title="${esc(i.name)}${i.sub?' — '+esc(i.sub):''}${pin?' · × 로 이 줄에서 빼기':''}">${pin?`<u class="bspk-x" data-bspk-x="${esc(k)}" title="이 줄에서 빼기">×</u>`:''}<i style="${i.av?`background-image:url('${cssu(i.av)}')`:''}">${i.av?'':esc(k==='gm'?'GM':[...i.name].slice(0,2).join(''))}</i><span>${esc(k==='gm'?'GM (나레이션)':i.name)}</span>${bs.field.has(k)?'<em class="bspk-fd">필드</em>':''}</button>`};
  const sep=t=>`<span class="bspk-sep">${t}</span>`;
  return `<div class="bspk ${BSP.open?'':'shut'}"><div class="bspk-h"><button type="button" class="btn sm ghost" data-bspk="fold" title="화자 줄 접기 · 펴기">🎭 화자 ${BSP.open?'▴':'▾'}</button>${BSP.open?`<span class="bspk-opt"><label title="배틀 말풍선의 스탠딩 크기 — 이 브라우저에만">스탠딩 크기 <input type="range" min="60" max="200" step="10" value="${BSP.sc}" data-bspk="sc"><b data-bspk-v>${BSP.sc}%</b></label><button type="button" class="btn xs ghost" data-bspk="test" title="지금 화자로 말풍선 미리보기 (나만 보인다)">미리보기</button></span>`:`<span class="small dim bspk-now">지금 화자: <b>${esc(spkInfo(cur).name)}</b></span>`}</div>
   ${BSP.open?`<div class="spkbar bspk-row">${chip('gm')}${bs.keys.length?sep('⚔ 배틀')+bs.keys.map(k=>chip(k)).join(''):''}${sep('📌 고정')}${pins.map(k=>chip(k,true)).join('')}<button type="button" class="spk add" data-bspk="pin" title="이 줄에 늘 둘 인물 고르기 (방 전체 · GM)"><i>＋</i><span>인물 추가</span></button><button type="button" class="spk add" data-bspk="more" title="모든 화자에서 찾아 이번만 말하기"><i>⋯</i><span>더 찾기</span></button></div>`:''}</div>`}
 function bspkSet(k,el){const ST=A().ST;ST.chatAs=k;pushRecent(k);const ca=document.getElementById('chatAs');if(ca&&ca._fill)ca._fill();
  if(el)el.querySelectorAll('[data-bspk-k]').forEach(b=>b.classList.toggle('on',b.dataset.bspkK===k));
  if(matchMedia('(max-width:760px)').matches){if(A().bchOpen)A().bchOpen(true)}const ci=document.getElementById('chatIn');if(ci)setTimeout(()=>ci.focus({preventScroll:true}),60)}
 function bspkBind(el){const box=el.querySelector('.bspk');
  el.querySelectorAll('[data-bspk="on"]').forEach(b=>b.onclick=()=>{BSP.on=!BSP.on;LSs('om_bsay_on',BSP.on?'1':'0');if(!BSP.on&&BSAY.el)BSAY.el.innerHTML='';A().toast(BSP.on?'배틀 말풍선을 켰다':'배틀 말풍선을 껐다 (이 브라우저)');A().renderScene()});
  if(!box)return;
  if(gm())box.querySelectorAll('[data-bspk-k]').forEach(b=>{const k=b.dataset.bspkK;if(!k||k==='gm')return;const pin=b.classList.contains('pin');const ex=pin?[{label:'📌 이 줄에서 빼기',fn:async()=>{await bspkPinSave(bspkPins().filter(x=>x!==k));A().toast('배틀 화자 줄에서 뺐다')}}]:[];
   b.addEventListener('contextmenu',e=>spkMenu(e,k,ex));let lt=0;b.addEventListener('touchstart',e=>{const t=e.touches[0];lt=setTimeout(()=>spkMenu({preventDefault(){},stopPropagation(){},clientX:t.clientX,clientY:t.clientY},k,ex),550)},{passive:true});b.addEventListener('touchend',()=>clearTimeout(lt));b.addEventListener('touchmove',()=>clearTimeout(lt))});
  box.querySelectorAll('[data-bspk-k]').forEach(b=>b.onclick=async e=>{const x=e.target.closest('[data-bspk-x]');if(x){e.stopPropagation();const L=bspkPins().filter(k=>k!==x.dataset.bspkX);await bspkPinSave(L);return}bspkSet(b.dataset.bspkK,box)});
  box.querySelectorAll('[data-bspk]').forEach(b=>{const k=b.dataset.bspk;
   if(k==='fold')b.onclick=()=>{BSP.open=!BSP.open;LSs('om_bspk_open',BSP.open?'1':'0');A().renderScene()};
   if(k==='more')b.onclick=()=>openSpkPick(b,{cur:A().ST.chatAs||'gm',onPick:x=>{bspkSet(x,box);A().renderScene()}});
   if(k==='pin')b.onclick=()=>openSpkPick(b,{cur:'',onPick:async x=>{if(x==='gm')return;const L=bspkPins();if(L.includes(x))return A().toast('이미 줄에 있다');L.push(x);await bspkPinSave(L);bspkSet(x,box);A().toast(`${spkInfo(x).name} 를 화자 줄에 고정했다`)}});
   if(k==='sc')b.oninput=()=>{BSP.sc=+b.value;LSs('om_bsay_scale',String(BSP.sc));const v=box.querySelector('[data-bspk-v]');if(v)v.textContent=BSP.sc+'%';if(BSAY.el)BSAY.el.style.setProperty('--bs',BSP.sc/100)};
   if(k==='test')b.onclick=()=>{const ST=A().ST;let key=ST.chatAs||'gm';if(key==='gm'){const bk=battleSpkKeys(new Set(allSpeakers().map(x=>x.key))).keys;key=bk[0]||'gm'}
    const c=key!=='gm'?charOf(key):null;battleSay({id:0,kind:'chat',who:c?c.name:'GM',data:Object.assign({t:'"스탠딩 크기 미리보기예요. 슬라이더로 맞춰 보세요."'},key==='gm'?{from:'gm'}:{k:key,as:c?c.name:''})},true)}})}
 /* ----- 10-25 망령: 배틀 화면에서 채팅(세션)을 치면, 말한 사람 진영 쪽에 스탠딩 + 말풍선이 잠깐 뜬다 -----
    진영: 포켓몬은 배틀 칸의 side, 트레이너 · 인물은 배틀 트레이너 이름으로 찾는다. 배틀에 없는 사람 · GM 나레이션은 가운데 위. 화면에만 그리는 연출이라 저장하지 않는다 */
 const BSAY={el:null,t:{}};
 function bsayKey(row){const d=row.data||{};const ST=A().ST;if(d.k)return d.k==='me'?(d.from||ST.seat||''):d.k;
  if(d.as){const t=Object.values((ST.state.roster||{}).trainers||{}).find(x=>x.name===d.as);return t?t.id:'npc:'+d.as}
  if(d.from==='gm')return gmKeyOf(d.gmn);return d.from||''}
 function bsaySide(key,name){const b=A().ST.state.battle||{};const T=b.trainers||{};
  if(key&&key.startsWith('pm:')){const rid=key.slice(3);const m=Object.values(b.mons||{}).find(x=>(x.rid||x.id)===rid);if(m)return m.side||(T[m.tid]||{}).side||'center'}
  const t=Object.values(T).find(x=>(x.srcTid||x.id)===key||x.name===name);if(t&&t.side)return t.side;
  if(key&&key.startsWith('pm:'))return 'center';return 'center'}
 function bsayPlace(){const L=BSAY.el;if(!L)return;const f=matchMedia('(max-width:760px)').matches?document.getElementById('scene'):document.querySelector('#scene .stadium');if(!f||A().view!=='battle'){L.style.display='none';return}const r=f.getBoundingClientRect();const mb=document.getElementById('mbar');const mbH=mb&&getComputedStyle(mb).display!=='none'?mb.getBoundingClientRect().height:0;const top=Math.max(r.top,0),bot=Math.min(r.bottom,innerHeight-mbH);L.style.display=bot-top>80?'':'none';Object.assign(L.style,{left:r.left+'px',top:top+'px',width:r.width+'px',height:Math.max(0,bot-top)+'px'})}
 function battleSay(row,force){try{if(A().view!=='battle'||!row||row.kind!=='chat')return;if(!BSP.on&&!force)return;const d=row.data||{};if(!d.t||d.ch==='ooc'||d.sms||d.bat||d.clear)return;
  const key0=bsayKey(row);const gk=isGmK(key0);const SXo=c0=>c0&&d.sx!=null&&(c0.stands||[])[+d.sx]?Object.assign({},c0,{active:+d.sx}):c0;   /* 11-08 망령 「배틀 때도 스탠딩 표정 · 감정 아이콘」: 보낼 때의 표정(sx)으로 */const gc=gk?SXo(charOf(key0)):null;const key=gk?'gm':key0;const c=key&&key!=='gm'?SXo(charOf(key)):null;const name=c?c.name:(d.as||(d.from==='gm'?(d.gmn||'GM'):row.who||''));
  const narr=window.OM_LINE?!!window.OM_LINE(d).narr:false;const side=key==='gm'||!key?'center':bsaySide(key,name);
  const img=key==='gm'?standSrc(gc):c?(standSrc(c)||c.img):'';
  if(!BSAY.el){BSAY.el=document.createElement('div');BSAY.el.className='bsayL';document.body.appendChild(BSAY.el);addEventListener('resize',bsayPlace);document.addEventListener('scroll',()=>{if(BSAY.el&&BSAY.el.childElementCount)bsayPlace()},true)}
  const txt0=String(d.t);
  /* 10-25 망령: 휴대폰은 화면이 좁아 큰 스탠딩이 겹친다 — 위에서부터 한 줄씩 쌓는 작은 말풍선(얼굴 + 대사), 최대 3개. 나레이션은 늘 맨 위 */
  if(BSAY.mob=matchMedia('(max-width:760px)').matches){bsayPlace();const L=BSAY.el;let st=L.querySelector('.bsm-stack');if(!st){L.innerHTML='';st=document.createElement('div');st.className='bsm-stack';L.appendChild(st)}
   /* 10-25 망령 A안: 휴대폰은 스탠딩을 하나만 — 가장 최근에 말한 사람이 아래에 크게 서고(오른쪽 진영이면 오른쪽) 큰 대사창. 바로 전 대사는 위에 얼굴 칩(최대 2), 나레이션은 늘 맨 위 */
   const av=key==='gm'?((gc&&gc.img)||img):c?(c.img||standSrc(c)):'';const top=side==='center'&&(narr||key==='gm'||!key);
   const bodyH=esc(txt0).replace(/\*(.+?)\*/g,'<i>$1</i>').replace(/\n/g,'<br>');
   const chipOf=(o)=>{const it=document.createElement('div');it.className=`bsm ${o.side}${o.narr?' narr':''}${o.top?' top':''}`;
    it.innerHTML=`${o.top?'':`<i class="bsm-av${o.av?'':' noimg'}" style="${o.av?`background-image:url('${cssu(o.av)}')`:''}">${o.av?'':esc([...o.name].slice(0,2).join(''))}</i>`}<div class="bsm-bub"><b>${esc(o.name)}</b><p>${o.body}</p></div>`;
    const kill=()=>{it.classList.add('out');setTimeout(()=>it.remove(),260)};it.onclick=kill;setTimeout(kill,o.ms);return it};
   const trim=()=>{let n=[...st.children].filter(x=>!x.classList.contains('top'));while(n.length>2){n[0].remove();n=n.slice(1)}};
   const ms=Math.min(12000,4000+txt0.length*80);
   if(top){const it=chipOf({side,narr,top:true,av:'',name,body:bodyH,ms});const firstNon=[...st.children].find(x=>!x.classList.contains('top'));st.insertBefore(it,firstNon||null);return}
   const old=L.querySelector('.bsvn');if(old){const o=old._o;old.remove();clearTimeout(BSAY.t.vn);if(o){st.appendChild(chipOf(Object.assign({},o,{ms:Math.max(2500,o.end-Date.now())})));trim()}}
   const vimg=key==='gm'?standSrc(gc):c?(standSrc(c)||c.img):'';const vs=side==='right'?'right':'left';
   const vn=document.createElement('div');vn.className=`bsvn ${vs}${vimg?' hasimg':''}${narr?' narr':''}`;vn._o={side,narr,top:false,av,name,body:bodyH,end:Date.now()+ms};
   vn.innerHTML=`<div class="bsvn-band"></div>${vimg?`<i class="bsvn-st" style="background-image:url('${cssu(vimg)}')"></i>`:''}<div class="bsvn-bub"><b>${esc(name)}</b><p>${bodyH}</p></div>`;
   vn.querySelector('.bsvn-bub').onclick=()=>{vn.classList.add('out');setTimeout(()=>vn.remove(),260)};L.appendChild(vn);bsayEmo(vn,d.em);
   BSAY.t.vn=setTimeout(()=>{vn.classList.add('out');setTimeout(()=>vn.remove(),300)},ms);return}
  BSAY.el.style.setProperty('--bs',BSP.sc/100);bsayPlace();const L=BSAY.el;{const st=L.querySelector('.bsm-stack');if(st)st.remove()}const old=L.querySelector(`.bsay.${side}`);if(old)old.remove();clearTimeout(BSAY.t[side]);
  const txt=String(d.t);const body=esc(txt).replace(/\*(.+?)\*/g,'<i>$1</i>').replace(/\n/g,'<br>');
  const showImg=!!img&&!(key==='gm'&&narr);const el=document.createElement('div');el.className=`bsay ${side}${narr?' narr':''}${showImg?' hasimg':''}`;
  el.innerHTML=`${showImg?`<i class="bsay-st" style="background-image:url('${cssu(img)}')"></i>`:''}<div class="bsay-bub"><b>${esc(name)}</b><p>${body}</p></div>`;
  el.querySelector('.bsay-bub').onclick=()=>{el.classList.add('out');setTimeout(()=>el.remove(),250)};L.appendChild(el);bsayEmo(el,d.em);
  const ms=Math.min(14000,4200+txt.length*90);BSAY.t[side]=setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),300)},ms)}catch(e){console.warn('battleSay',e)}}
 /* 11-08 망령 「배틀 때도 감정 아이콘」: 말풍선 스탠딩이 움직이고(emote.js 의 움직임) 말풍선 머리에 아이콘 + 소리 */
 function bsayEmo(box,em){try{const EMO=window.OM_EMO;if(!box||!em||!EMO||!EMO.E[em])return;const e=EMO.E[em];const st=box.querySelector('.bsay-st,.bsvn-st');
  if(st&&e.mo){st.classList.remove('emo-mo');void st.offsetWidth;st.dataset.emo=e.mo;st.classList.add('emo-mo');setTimeout(()=>{st.classList.remove('emo-mo');st.removeAttribute('data-emo')},2200)}
  const bub=box.querySelector('.bsay-bub,.bsvn-bub');if(bub)setTimeout(()=>EMO.play(bub,em),120)}catch(e){}}
 /* 11-08 망령: 배틀 탭(오른쪽 채팅) 입력줄도 세션 무대 입력줄처럼 「@표정 "대사"」 · 「!감정 대사」 — 표정을 바꾸고, 줄에 sx(보낼 때 표정) · em(감정)을 붙인다.
    돌려줌 null = 보낼 줄 없음(표정만 바꿈 · 감정만 연출 · 없는 표정) / {t, X} */
 async function linePrep(t,key){const EMO=window.OM_EMO;let EM='';const c=key==='gm'?charOf(myGmKey()):charOf(key);let m;
  if((m=t.match(/^@(\S+)\s*([\s\S]*)$/))&&c&&(c.stands||[]).length){const ok=await setStandByLabel(c,m[1]);if(!ok)return null;if(EMO)EM=EMO.fromLabel(m[1]);t=m[2].trim();if(!t){A().toast(`표정: ${m[1]}`);if(EM&&c&&c.key)setTimeout(()=>emoKey(c.key,EM),120);return null}}
  if(EMO){const pe=EMO.parse(t);if(pe.em){EM=pe.em;t=pe.text}if(!t){if(EM&&c&&c.key)emoKey(c.key,EM);return null}}
  const c2=key==='gm'?charOf(myGmKey()):charOf(key);const X=c2&&(c2.stands||[]).length>=2?{sx:+c2.active||0}:{};if(EM)X.em=EM;return {t,X}}
 function emoKey(key,k){if(!window.OM_EMO||!k)return;window.OM_EMO.playKey(key,k,{enter:true});try{DBS().broadcast({t:'emo',key,em:k,at:Date.now()})}catch(e){}}
 function bsayClear(){if(BSAY.el&&A().view!=='battle')BSAY.el.innerHTML=''}
 function onChat(row){if(row&&row.id)DQ.arr[row.id]=Date.now();if(row.kind==='chat'&&row.data&&row.data.bat){autoSe(Object.assign({},row,{kind:row.data.bat}));return}if(row.kind==='chat'&&row.data&&row.data.sms){if(window.OM_PHONE_UI)window.OM_PHONE_UI.onSms(row);return}autoSe(row);feedLog([row]);battleSay(row);if(row.kind==='chat'&&row.data){const nm=row.data.as||row.who;for(const k in TYPING.who)if(TYPING.who[k].from===row.data.from&&(!nm||TYPING.who[k].who===nm))delete TYPING.who[k];}if(A().view==='rp'&&row.kind==='chat'&&row.data&&row.data.ch!=='ooc'&&(row.data.t||row.data.clear))A().renderScene();oocTick()}
 function onState(){tickBanner();syncBgm();syncSe();voteNotice()}
 /* ----- GM 투표 (10-23 벨벳 참고) -----
    rp.vote = {id,q,opts:[{id,t}],anon,blind,open,at,res?:{n:{opt:표},win:[opt],total}}
    표는 각 좌석이 자기 칸 pub/<좌석>/vote = {id,opt,at} 에 넣는다 (좌석이 쓸 수 있는 곳). 같은 단추를 다시 누르면 취소, 다른 단추면 바꾸기.
    GM 이 마감하면 그때 표를 세어 rp.vote.res 에 박고 로그에 결과 한 줄. 「닫기」로 무대에서 내린다. 접기·펴기는 내 화면에서만 */
 const VOTE={fold:false,seen:''};
 function voteSeats(){const ST=A().ST;return Object.keys(ST.state.seats||{})}
 function seatName(id){const ST=A().ST;const t=((ST.state.roster||{}).trainers||{})[id]||(((ST.state.battle||{}).trainers||{})[id]);return (t&&t.name)||((ST.state.seats||{})[id]||{}).name||id}
 function tally(v){const pub=A().ST.state.pub||{};const n={},who={};for(const o of v.opts)n[o.id]=0,who[o.id]=[];let total=0;
  for(const sid in pub){const pv=(pub[sid]||{}).vote;if(!pv||pv.id!==v.id||!(pv.opt in n))continue;n[pv.opt]++;who[pv.opt].push(sid);total++}return {n,who,total}}
 function drawVote(el){const box=$('#voteov',el);if(!box)return;const v=R().vote;if(!v||!v.id){box.innerHTML='';box._h='';return}
  const ST=A().ST;const g=gm();const t=v.open?tally(v):Object.assign({who:{}},v.res||{n:{},total:0});if(!v.open){const live=tally(v);t.who=live.who}
  const mine=ST.role==='seat'?(((ST.state.pub||{})[ST.seat]||{}).vote||{}):{};const myOpt=mine.id===v.id?mine.opt:'';
  const hide=v.open&&v.blind&&!g;const max=Math.max(1,...Object.values(t.n||{}));const seats=voteSeats();const win=v.res?v.res.win||[]:[];
  const opt=o=>{const c=(t.n||{})[o.id]||0;const pct=hide?0:Math.round(c/Math.max(1,v.open?Math.max(t.total,1):Math.max(t.total,1))*100);const ws=(t.who||{})[o.id]||[];
   return `<button class="vo ${myOpt===o.id?'mine':''} ${win.includes(o.id)?'win':''}" data-vote="${esc(o.id)}" ${v.open&&ST.role==='seat'?'':'disabled'}><span class="vbar" style="width:${pct}%"></span><span class="vt">${win.includes(o.id)?'👑 ':''}${esc(o.t)}</span>${!v.anon&&!hide&&ws.length?`<span class="vwho">${ws.map(s=>`<i title="${esc(seatName(s))}">${esc(seatName(s).slice(0,2))}</i>`).join('')}</span>`:''}<b class="vc">${hide?'?':c}</b></button>`};
  const status=v.open?`${t.total}/${seats.length||'?'}명 투표${v.blind?' · 결과는 마감 뒤':''}${v.anon?' · 익명':''}`:`마감 · ${t.total}표`;
  const h=`<div class="vote ${VOTE.fold?'fold':''} ${v.open?'':'done'}"><div class="vhead" data-vf="1"><b>🗳 ${v.open?'투표':'투표 결과'}</b><span class="vq">${esc(v.q)}</span><span class="vfold">${VOTE.fold?'▾':'▴'}</span></div>
   ${VOTE.fold?'':`<div class="vopts">${v.opts.map(opt).join('')}</div><div class="vfoot"><span>${status}</span>${ST.role==='seat'&&v.open?`<small>${myOpt?'다시 누르면 취소 · 다른 걸 누르면 바꾸기':'골라 줘'}</small>`:''}${!ST.role||(!g&&ST.role!=='seat')?'<small>자리에 앉으면 투표할 수 있다</small>':''}<span class="sp"></span>${g?(v.open?`<button class="btn xs pri" data-vact="close">마감</button><button class="btn xs ghost" data-vact="cancel">취소</button>`:`<button class="btn xs" data-vact="again">다시 열기</button><button class="btn xs ghost" data-vact="dismiss">닫기</button>`):''}</div>`}</div>`;
  if(box._h!==h){box.innerHTML=h;box._h=h}
  box.querySelectorAll('[data-vf]').forEach(b=>b.onclick=()=>{VOTE.fold=!VOTE.fold;box._h='';drawVote(el)});
  box.querySelectorAll('[data-vote]').forEach(b=>b.onclick=async()=>{const o=b.dataset.vote;const cur=(((A().ST.state.pub||{})[A().ST.seat]||{}).vote)||{};const same=cur.id===v.id&&cur.opt===o;
   if(await A().set(['pub',A().ST.seat,'vote'],same?null:{id:v.id,opt:o,at:Date.now()}))A().toast(same?'표를 거뒀다':'투표했다: '+(v.opts.find(x=>x.id===o)||{}).t)});
  box.querySelectorAll('[data-vact]').forEach(b=>b.onclick=()=>voteAct(b.dataset.vact))}
 async function voteAct(k){const v=R().vote;if(!v)return;
  if(k==='close'){const t=tally(v);const top=Math.max(0,...Object.values(t.n));const win=top>0?v.opts.filter(o=>t.n[o.id]===top).map(o=>o.id):[];
   await A().set(['rp','vote'],Object.assign({},v,{open:false,res:{n:t.n,win,total:t.total},end:Date.now()}));
   const line=v.opts.map(o=>`${o.t} ${t.n[o.id]}`).join(' · ');A().sysLog(`🗳 투표 결과 「${v.q}」 — ${line}${win.length?` → ${win.map(id=>(v.opts.find(o=>o.id===id)||{}).t).join(', ')}${win.length>1?' (동점)':''}`:' (표 없음)'}`);return}
  if(k==='cancel'){if(!(await askOk('이 투표를 취소할까? 결과를 남기지 않고 내린다.','취소한다','그만')))return;await A().set(['rp','vote'],null);A().sysLog(`🗳 투표 취소 「${v.q}」`);return}
  if(k==='again'){await A().set(['rp','vote'],Object.assign({},v,{id:Date.now().toString(36),open:true,res:null,at:Date.now()}));A().sysLog(`🗳 다시 투표 「${v.q}」`);return}
  if(k==='dismiss')return A().set(['rp','vote'],null)}
 /* 새 투표가 열리면 한 번 알림 (내가 연 건 빼고) */
 function voteNotice(){const v=R().vote;const id=v&&v.open?v.id:'';if(id&&id!==VOTE.seen){const first=VOTE.seen==='';VOTE.seen=id;VOTE.fold=false;if(!first&&!gm()){A().toast('🗳 GM 이 투표를 열었다 — RP 무대에서 골라 줘');try{if(window.OM_PREFS)window.OM_PREFS.notify('vote')}catch(e){}}}else if(!id&&VOTE.seen)VOTE.seen=v?VOTE.seen:'-'}
 function openVote(){const v=R().vote;if(v&&v.open){VOTE.fold=false;A().renderScene();return A().toast('이미 투표 중 — 무대의 투표 칸에서 마감하거나 취소해 줘')}
  const md=A().openModal(`<div class="mhead"><h2>🗳 투표 열기</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="row" style="margin-bottom:8px"><b style="width:64px">질문</b><input type="text" id="vo_q" style="flex:1" placeholder="예: 어느 길로 갈까?" maxlength="80"></div>
   <div class="vo-ed" id="vo_opts"></div><button class="btn xs ghost" id="vo_add" style="margin:4px 0 10px">+ 보기 더하기</button>
   <label class="small" style="display:flex;gap:6px;align-items:center;margin-bottom:4px"><input type="checkbox" id="vo_anon"> 익명 — 누가 뭘 골랐는지 안 보인다 (수만 보인다)</label>
   <label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="vo_blind"> 결과는 마감 뒤에 — 그 전엔 플레이어에게 수가 「?」로 보인다</label>
   <div class="small dim" style="margin-top:8px">자리에 앉은 플레이어가 무대 위 투표 칸에서 고른다. 마감하면 결과가 로그에 한 줄 남는다.</div>
   <div class="row" style="margin-top:12px"><span class="sp"></span><button class="btn pri" id="vo_ok">투표 열기</button></div>`);
  const opts=['',''];const draw=()=>{$('#vo_opts',md).innerHTML=opts.map((o,i)=>`<div class="row" style="margin-bottom:4px"><b style="width:64px" class="small">보기 ${i+1}</b><input type="text" data-oi="${i}" value="${esc(o)}" style="flex:1" maxlength="40" placeholder="${['예: 숲길','예: 해안길','예: 그냥 여기 남는다'][i]||''}">${opts.length>2?`<button class="btn xs ghost" data-od="${i}" title="빼기">✕</button>`:''}</div>`).join('');
   md.querySelectorAll('[data-oi]').forEach(x=>x.oninput=()=>{opts[+x.dataset.oi]=x.value});md.querySelectorAll('[data-od]').forEach(x=>x.onclick=()=>{opts.splice(+x.dataset.od,1);draw()})};draw();
  $('#vo_add',md).onclick=()=>{if(opts.length>=6)return A().toast('보기는 6개까지');opts.push('');draw();const l=md.querySelector(`[data-oi="${opts.length-1}"]`);if(l)l.focus()};
  $('#vo_ok',md).onclick=async()=>{const q=$('#vo_q',md).value.trim();const os=opts.map(x=>x.trim()).filter(Boolean);if(!q)return A().toast('질문을 적어 줘');if(os.length<2)return A().toast('보기가 둘은 있어야 해');
   const vote={id:Date.now().toString(36),q,opts:os.map((t,i)=>({id:'o'+i,t})),anon:$('#vo_anon',md).checked?1:0,blind:$('#vo_blind',md).checked?1:0,open:true,at:Date.now()};
   if(await A().set(['rp','vote'],vote)){A().closeModal();VOTE.fold=false;A().sysLog(`🗳 투표 「${q}」 — ${os.join(' / ')}`);A().renderScene()}};
  setTimeout(()=>{const q=$('#vo_q',md);if(q)q.focus()},30)}
 /* 배틀 상단용 작은 BGM 위젯: 지금 곡 · 내 음량 · (GM) 다른 곡/BGM 창 · (플레이어) 소리 켜기 */
 let bgmOpen=false;   /* 10-26 망령: 폰에서는 BGM 위젯을 작게 — ♪ 를 누르면 음량 · ⟳ · ■ 가 펼쳐진다 */
 const bgmNarrow=()=>{try{return matchMedia('(max-width:760px)').matches}catch(e){return false}};
 function bgmWidgetHtml(){const now=R().bgm||{};const G=bgmGroups();const ok=bgmOk();return `<div class="bgmw ${bgmOpen?'open':''}"><span class="eq ${now.src?'':'off'} ${ok?'lk':''}" data-bw="${ok?'open':'fold'}" title="${ok?'BGM 고르기 (폰: 음량 펼치기)':'폰: 음량 펼치기'}">♪</span><span class="bt ${ok?'lk':''}" ${ok?'data-bw="open"':''} title="${esc(now.title?(now.group?gshort(now.group)+' - ':'')+now.title:'재생 중인 곡 없음')}${ok?' — 누르면 BGM 고르기':''}">${esc(now.title||'BGM 없음')}</span><input type="range" min="0" max="1" step="0.05" value="${vol}" data-bw="vol" title="내 음량">${!unlocked&&now.src?'<button class="btn xs pri" data-bw="sound" title="브라우저가 소리를 막아서 한 번 눌러야 들린다">소리 켜기</button>':''}${ok?`${now.group&&G[now.group]?`<button class="btn xs ghost" data-bw="rand" title="같은 그룹에서 다른 곡">⟳</button>`:''}${now.q&&now.group&&G[now.group]?`<button class="btn xs ghost" data-bw="next" title="이어 재생 — 다음 곡">⏭</button>`:''}${now.src?'<button class="btn xs ghost" data-bw="stop" title="모두에게 정지">■</button>':''}<button class="btn xs" data-bw="open" title="BGM 고르기 (모두에게)">BGM</button>`:''}</div>`}
 function psSync(on,html){let sl=document.getElementById('prpslot');if(!on){psClear();return}
  const pt=document.querySelector('.side .phone .ptitle'),pl=pt&&pt.querySelector('.plogs');if(!pl)return;if(!sl){sl=document.createElement('span');sl.id='prpslot';sl.className='prpslot'}
  if(sl._h!==html){sl.innerHTML=html;sl._h=html;sl._bound=null;bindBgmWidget(sl);const mb=sl.querySelector('[data-prpmore]');if(mb)mb.onclick=e=>{e.stopPropagation();sl.querySelector('.prpmw').classList.toggle('open')}}
  /* 방 이름 줄 빈 곳(이름과 아이콘 사이)에 들어가면 거기, 모자라면 그 아래 한 줄(.prprow)에 */
  if(sl.nextSibling!==pl)pt.insertBefore(sl,pl);const nm=pt.querySelector('.pname');
  const fits=pt.scrollWidth<=pt.clientWidth&&(!nm||nm.scrollWidth<=nm.clientWidth);
  let row=document.getElementById('prprow');
  if(!fits){if(!row){row=document.createElement('div');row.id='prprow';row.className='prprow'}if(row.previousSibling!==pt)pt.after(row);row.appendChild(sl)}else if(row)row.remove()
  if(!PSR.t){PSR.t=setTimeout(()=>{PSR.t=0;const s2=document.getElementById('prpslot');if(s2&&s2.parentNode&&s2.parentNode.id!=='prprow')psSync(true,s2._h)},400)}}   /* 글꼴이 늦게 들어와 이름이 길어지면 다시 잰다 */
 const PSR={t:0};document.addEventListener('click',e=>{const w=document.querySelector('#prpslot .prpmw.open');if(w&&!e.target.closest('.prpmw'))w.classList.remove('open');else if(w&&e.target.closest('.prpmore'))w.classList.remove('open')});addEventListener('resize',()=>{const s2=document.getElementById('prpslot');if(s2){const r=document.getElementById('prprow');if(r){const pt=r.previousSibling;if(pt&&pt.classList&&pt.classList.contains('ptitle')){pt.insertBefore(s2,pt.querySelector('.plogs'));r.remove()}}psSync(true,s2._h)}});
 /* RP 를 떠나면 채팅창 머리의 BGM · 콘솔 칸도 치운다 */
 function psClear(){for(const id of ['prpslot','prprow']){const e=document.getElementById(id);if(e)e.remove()}}
 function bindBgmWidget(root){root.querySelectorAll('[data-bw]').forEach(el=>{const k=el.dataset.bw;
  if(k==='vol'){el.oninput=()=>setVolume('bgm',+el.value);return}
  el.onclick=async()=>{if(k==='sound'){userMuted=false;unlocked=true;syncBgm(true);return A().renderScene()}if((k==='open'||k==='fold')&&el.classList.contains('eq')&&bgmNarrow()){bgmOpen=!bgmOpen;root.querySelectorAll('.bgmw').forEach(w=>w.classList.toggle('open',bgmOpen));return}if(k==='fold')return;if(k==='open')return quickBgm();
   if(k==='stop'){await A().set(['rp','bgm'],null);return}
   if(k==='next'){const now=R().bgm||{};if(!now.q)return;const pick=bgmNextPick(now);if(pick){pvStop();await playAll(now.group,pick,null,now.q)}return}
   if(k==='rand'){const now=R().bgm||{};const G=bgmGroups();const ss=Object.keys(G[now.group]||{});if(!ss.length)return;let pick=ss[Math.floor(Math.random()*ss.length)];if(ss.length>1&&pick===now.title)pick=ss[(ss.indexOf(pick)+1)%ss.length];pvStop();await playAll(now.group,pick)}}})}
 /* ----- 아래 띠: 내 캐릭터 · 굴림(스킬 체크) · 폰 · 대화(장면 등장) · 소지 포켓몬 현황 ----- */
 function meTrainer(){const ST=A().ST;const T=(ST.state.roster||{}).trainers||{};if(ST.role==='seat')return T[ST.seat]||null;if(gm()){const c=speakerChar();if(c&&c.kind==='pc')return T[c.id]||null;if(c&&c.kind==='pm'){const m=((ST.state.roster||{}).mons||{})[c.id];return m?T[m.tid]||null:null}}return null}
 /* 10-24 망령: 아래 띠 오른쪽 빈 곳에 지금 제시된 스킬 체크 — 상황 · 자질 · 목표와 대상별 결과. 누르면 스킬 체크 창 */
 function meCheck(O){if(!O)return '';const ST=A().ST;const T=(ST.state.roster||{}).trainers||{};const R=(ST.state.skill||{}).res||{};const RES=['실패','실패','성공','성공','대성공'];/* 10-29 스킬 체크 v4 결과 이름 (skill_ui RES 와 같게 — 예전 「대실패 · 대가」 이름이 남아 있었다) */
  const ids=(O.ids||[]).filter(id=>T[id]);const done=ids.filter(id=>R[id]&&R[id].offerId===O.id);const mine=ST.role==='seat'&&ids.includes(ST.seat)&&!done.includes(ST.seat);
  const chip=id=>{const r=R[id]&&R[id].offerId===O.id?R[id]:null;return `<span class="mck mk-${r?[1,1,3,3,4][r.ri]:'w'}${ST.role==='seat'&&id===ST.seat?' self':''}" title="${esc(T[id].name)} — ${r?RES[r.ri]:'아직 안 굴림'}"><b>${esc(T[id].name)}</b>${r?`<em>${RES[r.ri]}</em>`:''}</span>`};
  /* 10-29 망령 「대기 칸도 일렬이 아니라 위아래를 다 쓰는 사각형으로」: 4줄까지 세로로 채우고 열을 늘린다 (9명 3×3 · 13명 4×4) */
  const cols=Math.max(1,Math.ceil(ids.length/4));
  return `<div class="mecheck ${mine?'me':''}" data-rp="roll" title="스킬 체크 창 열기"><div class="mcq"><small>스킬 체크${mine?' · <b>내 차례</b>':''} · ${done.length}/${ids.length}</small><b>${esc(O.label||'판정')}</b><span>${esc(O.stat||'')}${O.mode==='inou'?' · 이능':''} · 목표 ${esc(O.target)}${O.npc?' · 대항 '+esc(O.npc):''}</span></div><div class="mcks" style="--mc:${cols}">${ids.map(chip).join('')}</div></div>`}
 /* 10-29 망령 「늘린 공간으로 파티 현황을 더 보기 좋게」: 포켓몬 한 체 = 가로 카드 (그림 · 이름 · HP 막대 · HP 숫자 · 상태 · 동행/상세).
    배틀 밖 HP · 상태는 시트 값(sheetHp · sheetStates — 상세 창 · 던전 · 휴식이 고치는 칸), 배틀 중이면 배틀 값 */
 const stKo=k=>((((window.OM_DB||{}).states||{}).st||{})[k]||{}).ko||k;
 function memonHtml(m,b,comp){let cur,max,sts;
  if(b){max=Math.max(1,b.hp.max);cur=Math.max(0,b.hp.cur);sts=b.states||{}}
  else{max=Math.max(1,(m.hp&&m.hp.max)||(m.stats||[])[0]||1);sts=m.sheetStates||{};cur=sts.Dead?0:m.sheetHp==null?max:Math.max(0,Math.min(max,+m.sheetHp||0))}
  const ko=cur<=0,pct=ko?0:Math.max(1,Math.min(100,Math.round(cur/max*100)));const st=Object.keys(sts).filter(k=>k!=='Dead'&&sts[k]);const ent=b&&b.entry?String(b.entry).toUpperCase():'';
  return `<div class="memon ${ko?'ko':''} ${comp?'comp':''}" title="${esc(m.name)} HP ${cur}/${max}${st.length?' · '+esc(st.map(stKo).join(' ')):''}${ent?' · 무대 '+ent:''}${comp?' · 동행':''}"><i data-rp="comp" data-mid="${m.id}" title="${comp?'동행 중 — 눌러서 빼기':'눌러서 동행으로 지정 (스킬 체크에 함께 굴린다)'}" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}">${ent?`<u>${esc(ent)}</u>`:''}${comp?'<u class="cp">동행</u>':''}</i><div class="mei"><small>${esc(m.name)}</small><div class="mhp ${pct<=25?'low':pct<=50?'mid':''}"><b style="width:${pct}%"></b></div><div class="meft"><span class="mhpt">${ko?'빈사':cur+'/'+max}${st.length?` <s>${esc(st.map(stKo).join(' '))}</s>`:''}</span><span class="mepills"><em class="medet" data-rp="mdet" data-mid="${m.id}" title="상세 — 데이터 · 능력 변화 · 대미지 · 효과 출력">상세</em></span></div></div></div>`}
 const DICE_TTL=20000;
 function meBarHtml(){const ST=A().ST;if(!ST.role)return '';const t=meTrainer();const K=window.OM_SKILL_UI;const k=t&&K?K.tsk(t.id):{};const O=K&&(ST.state.skill||{}).offer;const pend=K&&K.pending();
  const mons=t?Object.values((ST.state.roster||{}).mons||{}).filter(m=>m.tid===t.id):[];const bm=(ST.state.battle||{}).mons||{};
  /* 10-30 망령 「굴림 결과는 시간 지나면 내려가도록 — 언제까지 띄워 놓네」: 마지막 굴림은 DICE_TTL 동안만 보이고, 남은 시간 뒤에 스르륵 사라진다 */
  const lastDice0=[...(ST.log||[])].reverse().find(r=>r.kind==='dice');const diceLeft=lastDice0?DICE_TTL-(Date.now()-(Date.parse(lastDice0.at)||0)):0;const lastDice=diceLeft>0?lastDice0:null;
  return `<div class="mebar">${t?`<div class="meid"><i class="ph-av" style="${t.image?`background-image:url('${cssu(t.image)}')`:''}"></i><div><b>${esc(t.name)}</b><small>${k.inj>=3?'<span class="bad">빈사</span>':k.inj>=2?'<span class="bad">중상</span>':k.inj===1?'<span class="bad">부상</span>':'건강'}${k.tired&&k.tired.length?' · 지침 '+k.tired.length:''}${O&&(O.ids||[]).includes(t.id)?' · <span class="warn">체크 대기</span>':''}</small></div></div>`:`<div class="meid"><div><b>${gm()?'GM':esc(ST.name||'')}</b><small>${gm()?'화자로 PC 를 고르면 그 캐릭터가 여기 선다':'자리 없음'}</small></div></div>`}
   <div class="mebtns"><button class="btn sm ${pend?'pri':''}" data-rp="roll" title="스킬 체크 창">🎲 굴림${pend?' !':''}</button><button class="btn sm" data-rp="phone" title="휴대폰">📱 폰</button><button class="btn sm ghost" data-rp="talk" title="${t?t.name+' (으)로 말하기 — 무대에 선다':'대사 입력'}">💬 대화</button>${gm()?`<button class="btn sm ghost" data-rp="notice" title="공지 띄우기 (GM 콘솔 「공지」)">📢 공지</button><button class="btn sm ghost ${mapOpen?'on':''}" data-rp="map" title="지도 펴기 / 접기">🗺 지도</button><button class="btn sm ghost ${(R().clue)?'on':''}" data-rp="cluebox" title="단서 보관함 — 보낸 단서 전체 (새 단서 카드는 보관함 · GM 콘솔 「연출」에서)">🔍 단서</button>`:''}</div>
   ${gm()?`<label class="medsplit ${R().dsplit?'on':''}" title="방 전체 — 켜면 모두의 무대에서 대사 상자를 말하는 사람 스탠딩 반대쪽으로 떼어 일러를 가리지 않는다 (좁은 화면 · 던전은 그대로)"><input type="checkbox" data-rp="dsplit" ${R().dsplit?'checked':''}><i aria-hidden="true"></i><span><b>◧ 좌우 분리</b><small>스탠딩 다 보이기 · 방 전체</small></span></label>`:''}
   ${meCheck(O)}
   <div class="memons">${mons.map(m=>memonHtml(m,bm[m.id],!!(t&&K&&(K.tsk(t.id).comp||[]).includes(m.id)))).join('')}</div>
   ${lastDice?`<div class="melast" style="--left:${Math.round(diceLeft)}ms" title="${esc(lastDice.data.t||'')}">🎲 ${esc((lastDice.who||'')+' · '+String(lastDice.data.t||'').split('\n').slice(-2).join(' · '))}</div>`:''}</div>`}
 /* ----- 잡담 서랍 (10-24 벨벳 참고) -----
    휴대폰처럼 옆 채팅창이 안 보이는 화면에서, 무대 오른쪽 끝 「잡담」 세로 탭을 누르면 잡담만 담긴 서랍이 미끄러져 나온다.
    채팅 탭으로 넘어가지 않고 무대를 보면서 「밥 먹고 옴」을 주고받는 용도. 보내기는 채팅창의 잡담 탭 보내기를 그대로 빌려 쓴다
    (/r 주사위 · 채팅 꾸미기 · GM 닉 같은 규칙이 한곳에만 있게). 옆 채팅창이 보이는 PC 화면에선 탭을 숨긴다 */
 const OOC={open:false,seen:-1,room:'',key:''};
 function oocRows(){const ST=A().ST;const cut=+((ST.state.rp||{}).logClearAt)||0;return (ST.log||[]).filter(r=>r.id>cut&&r.data&&r.data.ch==='ooc'&&(r.kind==='chat'||r.kind==='dice'))}
 function sideShown(){const s=document.getElementById('side');return !!(s&&s.offsetWidth>0&&getComputedStyle(s).display!=='none')}
 function oocEl(){let d=document.getElementById('oocdr');if(d)return d;d=document.createElement('div');d.id='oocdr';d.className='oocdr';d.setAttribute('aria-hidden','true');
  d.innerHTML=`<div class="oochd"><b>💬 잡담</b><small>세션 로그 · 무대에 안 남는 이야기</small><span class="sp"></span><button class="btn xs ghost" data-oc="x" title="닫기">✕</button></div><div class="ooclog" id="ooclog"></div><div class="oocin"><input type="text" id="oocIn" autocomplete="off" placeholder="잡담 · /r 1d100"><button class="btn pri" id="oocSend">보내기</button></div>`;
  document.body.appendChild(d);d.querySelector('[data-oc="x"]').onclick=()=>oocOpen(false);$('#oocSend',d).onclick=oocSend;
  $('#oocIn',d).onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();oocSend()}else if(e.key==='Escape')oocOpen(false)};return d}
 function oocOpen(on){OOC.open=!!on;const d=oocEl();d.classList.toggle('on',OOC.open);d.setAttribute('aria-hidden',OOC.open?'false':'true');OOC.key='';oocTick();if(OOC.open){const i=$('#oocIn',d);if(i&&A().ST.role&&!matchMedia('(hover:none)').matches)i.focus({preventScroll:true})}}
 function oocSend(){const d=oocEl();const inp=$('#oocIn',d);const t=inp.value.trim();if(!t)return;const ci=$('#chatIn'),tabs=$('#ctabs'),send=$('#chatSend');
  if(!ci||!tabs||!send||!A().ST.role)return A().toast('자리에 앉아야 말할 수 있다');
  const prev=((tabs.querySelector('[data-ch].on')||{}).dataset||{}).ch||'s';const keep=ci.value;const to=tabs.querySelector('[data-ch="o"]');if(!to)return;
  /* sendChat 은 첫 await 전에 채널을 읽어 두므로, 잡담 탭으로 잠깐 돌려 보내고 바로 원래 탭으로 */
  to.click();ci.value=t;send.click();ci.value=keep;if(prev!=='o'){const b=tabs.querySelector(`[data-ch="${prev}"]`);if(b)b.click()}inp.value='';inp.focus()}
 function oocTick(){const ST=A().ST;if(OOC.room!==ST.room){OOC.room=ST.room;const r=oocRows();OOC.seen=r.length?r[r.length-1].id:0;OOC.key=''}
  const stage=document.getElementById('rpstage');const show=!!(ST.room&&stage&&stage.isConnected&&A().view==='rp'&&!sideShown()&&!matchMedia('(max-width:760px)').matches);   /* 11-04: 휴대폰은 배틀과 같은 채팅 서랍(app.js bchTick)을 쓴다 — 잡담만 서랍은 그보다 넓은 화면에서만 */
  let tab=document.getElementById('ooctab');if(show&&!tab){tab=document.createElement('button');tab.id='ooctab';tab.className='ooctab';tab.title='잡담 서랍';tab.onclick=()=>oocOpen(!OOC.open)}
  if(show&&tab.parentNode!==stage)stage.appendChild(tab);if(!show){if(tab)tab.remove();if(OOC.open){OOC.open=false;const d=document.getElementById('oocdr');if(d)d.classList.remove('on')}return}
  const rows=oocRows();const last=rows.length?rows[rows.length-1].id:0;if(OOC.open)OOC.seen=Math.max(OOC.seen,last);
  const unread=rows.filter(r=>r.id>OOC.seen&&!A().isMineLog(r)).length;const th=`<span>잡담</span>${unread?`<em>${unread>9?'9+':unread}</em>`:''}`;if(tab._h!==th){tab.innerHTML=th;tab._h=th}tab.classList.toggle('on',OOC.open);tab.classList.toggle('new',!!unread);
  if(!OOC.open)return;const d=oocEl();const box=$('#ooclog',d);const key=ST.room+'|'+last+'|'+rows.length;if(OOC.key===key)return;OOC.key=key;
  const near=box.scrollHeight-box.scrollTop-box.clientHeight<60;
  box.innerHTML=rows.length?rows.slice(-60).map(r=>{const dd=r.data||{};const mine=A().isMineLog(r);const nm=dd.gmn||r.who||'';const tm=(()=>{const x=new Date(r.at);return isNaN(x)?'':String(x.getHours()).padStart(2,'0')+':'+String(x.getMinutes()).padStart(2,'0')})();
   const body=r.kind==='dice'?`🎲 ${esc(dd.t||'')}`:(dd.img?`<img src="${esc(dd.img)}" alt="" loading="lazy">`:esc(dd.t||''));
   return `<div class="oor ${mine?'me':''} ${r.kind==='dice'?'dice':''}"><div class="oorm"><b>${esc(nm)}</b><time>${tm}</time></div><div class="oorb">${body}</div></div>`}).join(''):'<div class="oornone">아직 잡담이 없어. 여기서 한 말은 세션 로그 · 무대에 나오지 않아.</div>';
  if(near||box._first!==ST.room){box.scrollTop=box.scrollHeight;box._first=ST.room}
  const inp=$('#oocIn',d);if(inp){inp.disabled=!ST.role;inp.placeholder=ST.role?'잡담 · /r 1d100':'자리에 앉으면 말할 수 있다'}}
 addEventListener('resize',()=>{try{oocTick()}catch(e){}});
 /* 11-03 감우 (검토 20-14): 단축키 — GM 만, 칸에 치는 중 · 창이 떠 있을 때는 무시. B = 배경 창, / = 채팅 입력칸.
    prefs_ui 의 등록 표 window.OM_KEYS.add({id,label,key,grp:'r',run}) 에 넣는다(한 번만 · grp 'r' = RP 화면에서만 · 입력칸 포커스는 표가 거른다 · run 이 false 를 돌려주면 preventDefault 안 함).
    표의 일반 묶음에 같은 키가 이미 있으면(예: '/' = chat) 그쪽이 먼저 받으니 겹쳐 넣지 않는다. 표가 없으면(prefs_ui 가 빠졌을 때) 여기 keydown 이 직접 본다 — 표가 있으면 이 fallback 은 꺼진다 */
 const KEYS=[{id:'rBg',key:'b',label:'배경 창 (GM)',gm:true,fn:()=>{QB.con=false;quickBg()}},{id:'rChat',key:'/',label:'채팅 입력칸으로 (GM)',gm:true,fn:()=>{const c=document.getElementById('chatIn');if(c){c.focus();c.scrollIntoView&&c.scrollIntoView({block:'nearest'})}}}];
 const keyFree=e=>{const t=e.target;if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName||'')))return false;return !e.isComposing&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!document.querySelector('.modalbg')};
 const keyOk=()=>{const Ap=A();return !!(Ap&&Ap.ST&&Ap.ST.room)&&gm()};
 let keysReg=false;
 function regKeys(){if(keysReg)return true;const K=window.OM_KEYS;if(!K||typeof K.add!=='function')return false;keysReg=true;
  let taken=[];try{taken=(K.list?K.list():[]).filter(x=>!x.grp).map(x=>x.key)}catch(e){}
  for(const k of KEYS){if(taken.includes(k.key))continue;try{K.add({id:k.id,label:k.label,key:k.key,grp:'r',run:()=>{if(!keyOk()||document.querySelector('.modalbg'))return false;k.fn();return true}})}catch(e){console.warn('OM_KEYS',e)}}return true}
 setTimeout(regKeys,0);
 document.addEventListener('keydown',e=>{if(regKeys())return;if(!keyFree(e)||!keyOk())return;const key=(e.key||'').toLowerCase();const k=KEYS.find(x=>x.key===key);if(!k)return;e.preventDefault();k.fn()});
 return {acBind,acCharOf,linePrep,psClear,onClueEv,openClueBox,stageEnter,bspkHtml,bspkBind,bsayToggleHtml,openSpkPick,spkBtnFill,spkInfo,pushRecent,curSpk,battleSay,bsayPlace,bsayClear,typingHtml,autoFolder,bgmMuted,seUrlOf:seUrl,render,allSpeakers,onChat,feedLog,onState,onTyping,typingPing,typingStop,drawTyping,mapData:mapS,openConsole,openStands,openPeople,setMyStand,charOf,playSe,setVolume,bgmWidgetHtml,bindBgmWidget,gmKeyOf,imgOfKey:k=>{if(k==='gm')return gmImg();const c=charOf(k);return c?(c.img||standSrc(c)):''},curSpeaker:()=>{const ST=A().ST;const c=speakerChar();if(c)return {key:c.key,name:c.name,img:c.img||standSrc(c)};return gm()?{key:'gm',name:'GM',img:myGmImg()}:{key:'me',name:ST.name||'',img:''}}};
})();
