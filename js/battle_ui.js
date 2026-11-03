/* ---------- 배틀 씬 UI (1단계: 엔트리 · 지시 입력 · 준비 · 공개 · 행동 순서 · 공격/대미지 · 랭크/상태 · 필드 · 턴 종료) ----------
   상태 모양:
   battle = { turn, phase, mode(에리어 수 1~3), sides:{left:{trainers}, right:{trainers}}, trainers:{tid:{…,side}},
              mons:{mid:{…, side, slot, entry:'a'|'b'|'c'|'', started, hp, rank, mod, states, item}},
              field:{weather:{type,count}, terrain:{type,count}, rooms:{트릭룸..}, etc:{중력..}, objects:{left:{리플렉터:n}, right:{}}},
              cmds:{tid:{mons:{mid:{…}}, order, command, detail}}  (공개된 지시), order:[{slot,mid,name}] }
   ready = {tid:true}   비밀 지시 = om_secret(kind 'cmd', id = tid) */
"use strict";
/* 10-24 망령: 개인전 — 트레이너에 solo 가 켜져 있으면 같은 진영에 서 있어도 그 트레이너 혼자 한 편이다 (정보 비공유 · 서로 적).
   팀 = solo 면 'solo:<트레이너 id>', 아니면 진영(left/right). x = 트레이너 id 문자열 · 포켓몬(tid) · 트레이너 객체(id) */
window.OM_TEAM=function(b,x){b=b||{};const trs=b.trainers||{};let tid,side;if(typeof x==='string'){tid=x;side=(trs[x]||{}).side}else if(x){tid=x.tid!=null?x.tid:x.id;side=x.side}else return '';const t=trs[tid];if(t&&t.solo)return 'solo:'+tid;return side||(t&&t.side)||''};
window.OM_BATTLE_UI=(()=>{
 /* 모바일(760px 이하) 배틀 상단 조작판: 기본은 접어서 TURN · 지금 단계 · 「턴 진행」만 보이고, 「펼치기」로 전부 연다 (css .bstat.fold). 펼친 상태는 브라우저마다 기억 */
 const BFOLD={open:(()=>{try{return localStorage.getItem('om_bfold')==='1'}catch(e){return false}})()};
 /* 11-03 감우 (검토 15-②): 배틀 탭의 화자 칩 줄(rp_ui bspkHtml)은 기본 접힘 — 토글은 브라우저마다 기억 */
 const BSPKF={open:(()=>{try{return localStorage.getItem('om_bspkfold')==='1'}catch(e){return false}})()};
 /* 11-03 감우 (검토 15-①): 조작판(.bstat)이 스크롤로 화면 밖에 나가면 얇은 sticky 바(#bsticky)를 보인다 */
 let STKIO=null;
 function stickyWatch(el){const bs=el.querySelector('.bstat'),st=el.querySelector('#bsticky');if(STKIO){STKIO.disconnect();STKIO=null}if(!bs||!st)return;
  STKIO=new IntersectionObserver(es=>{for(const e of es)st.classList.toggle('on',!e.isIntersecting&&e.boundingClientRect.top<(e.rootBounds?e.rootBounds.top:0))},{root:el.closest('.scene')||null,threshold:0});STKIO.observe(bs)}
 const OI=()=>window.OM_ITEMS;   /* 소지품 자동화 (js/engine/items.js) */
 const A=()=>window.OM_APP, S=()=>window.OM_STATS, B=()=>window.OM_BATTLE, DB=()=>window.OM_DB||{}, DBS=()=>window.OM_STORE;
 const APLOG=()=>{try{return localStorage.getItem('om_aplog')!=='0'}catch(e){return true}};   /* 【보정】 나만 보는 로그 켜기 (이 브라우저) */
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const $=(s,r)=>(r||document).querySelector(s);
 const AREAS=['a','b','c'];const SIDES=['left','right'];
 const SIDE_KO={left:'좌측',right:'우측'};
 const STAT_KO={attack:'공격',defense:'방어',specialattack:'특공',specialdefense:'특방',speed:'스피드',accuracy:'명중',evasion:'회피',critical:'급소'};
 const ORDER_KEYS=['retreat','dodge','endure','return','snipe'];const COMMAND_KEYS=['attack','defense','specialattack','specialdefense','speed','heal','snipe','evasion'];
 const WEATHER=['','맑음','비','모래바람','싸라기눈','눈','짙은안개','밤','별하늘','큰가뭄','폭우','난기류','극한','깊은밤'];
 const WEATHER_MUL={극한:{Fire:0.25},맑음:{Fire:1.5,Water:0.5},큰가뭄:{Fire:1.5,Water:0},비:{Water:1.5,Fire:0.5},폭우:{Water:1.5,Fire:0},밤:{Ghost:1.33,Dark:1.33},깊은밤:{Ghost:1.33,Dark:1.33},별하늘:{Normal:1.33,Dragon:1.33},짙은안개:{Poison:1.33,Fairy:1.33}};/* 10-24 제보: 밤 · 별하늘 · 짙은안개(깊은밤 포함)는 ×1.33 — 맑음 · 비만 ×1.5 */
 const TERRAIN=['','그래스필드','일렉트릭필드','미스트필드','사이코필드'];
 const ROOMS=['트릭룸','매직룸','원더룸','블랙룸'];const ETC=['중력','물놀이','흙놀이'];
 const OBJECTS=()=>String(((DB().const||{}).lists||{}).list_object_kor||'').split(',').map(x=>x.trim()).filter(Boolean);
 /* 설치기 분류 (맵툴 레디메이드 생성기의 나눔): 이름, 기본 지속, 설명 */
 const OBJ_CAT=[['wall','벽·장막',5,'5턴',['리플렉터','빛의장막','오로라베일','신비의부적','흰안개','주술','검은숲']],['aid','진영 효과',4,'4턴',['얼음의장벽','신기루','순풍','무지개','습원','불바다','돌격']],['hazA','설치기 A',1000,'땅 위 포켓몬만 · 등장 때',['압정뿌리기','독압정','지뢰원','끈적끈적네트','기뢰']],['hazB','설치기 B',1000,'모든 포켓몬 · 등장 때',['트램펄린','스텔스록','불기둥','장미원','가시원','얼음꼬챙이','전기발판','아이스번','저주의묘','악의소굴','전파탑']],['etc','기타',2,'',['희망사항','이때다!']],['guard','방어',1,'이번 턴',['와이드가드']]];   /* 10-25 망령: 와이드가드 = 자진 「전체기 방어」 (턴 종료까지) */
 const objCat=name=>OBJ_CAT.find(c=>c[4].includes(name))||OBJ_CAT[4];
 const WALLS={리플렉터:'reflector',빛의장막:'lightscreen',얼음의장벽:'icewall',오로라베일:'aurora'};
 /* 10-25 망령: 지금 걸리는 벽 이름 (물리 · 특수 · 불꽃이면 얼음의장벽 빠짐) */
 const wallNames=(objs,cat,ty)=>Object.keys(WALLS).filter(k=>(objs||{})[k]>0&&(k==='리플렉터'?cat==='physical':k==='빛의장막'?cat==='special':k==='얼음의장벽'?ty!=='Fire':true));
 const catEn=c=>/물리|physical/.test(String(c||''))?'physical':/특수|special/.test(String(c||''))?'special':'';
 const slotOf=(side,area)=>side+'_'+area;
 /* 11-02 망령 「에리어 바꾸면 자신 대상과 아군 대상이 섞인다」: 지시의 대상은 자리(left_a …)로 적혀 있어, 지시한 뒤 에리어 교대를 하면 「자신」이 옆 아군 자리를 가리켰다.
    지시를 저장할 때 자리마다 그때 있던 포켓몬(tm)을 함께 적고, 쓸 때 같은 편 대상은 그 포켓몬이 지금 있는 자리로 바꾼다(자신 · 아군은 포켓몬을 따라간다).
    상대 대상은 예전처럼 자리 그대로 — 상대가 자리를 바꾸면 그 자리에 온 포켓몬이 맞는다(사이드체인지와 같은 방식). 교대로 들어간 포켓몬이면 자리 그대로 */
 function tmOf(b,targets){const o={};for(const s of targets||[]){const i=String(s).indexOf('_');if(i<0)continue;const m=Object.values(b.mons||{}).find(q=>q.side===s.slice(0,i)&&q.entry===s.slice(i+1));if(m)o[s]=m.id}return o}
 function tgNow(b,x,me){const L=(x&&x.targets)||[];const tm=(x&&x.tm)||{};const out=[];for(const s of L){let r=s;const mid=tm[s];const m=mid&&(b.mons||{})[mid];if(m&&m.entry&&m.hp&&(!me||m.side===me.side)&&String(s).startsWith(m.side+'_'))r=slotOf(m.side,m.entry);if(!out.includes(r))out.push(r)}return out}
 const TM=(x,b)=>window.OM_TEAM(b||ctx().b,x);const sameT=(x,y,b)=>{const p=TM(x,b);return !!p&&p===TM(y,b)};   /* 같은 편인가 (개인전 반영) */
 const lists=()=>((DB().const||{}).lists||{});
 const csv=s=>String(s||'').split(',').map(x=>x.trim()).filter(Boolean);
 const IMG=()=>((DB().img)||{state:{},field:{}});
 const W_IMG={맑음:'weather_Sunny',비:'weather_Rainy',모래바람:'weather_Sandstorm',싸라기눈:'weather_Snowstorm',눈:'weather_Snow',짙은안개:'weather_FoggyMist',밤:'weather_Night',별하늘:'weather_StarryNight',큰가뭄:'weather_Sunny_extreme',폭우:'weather_Rainy_extreme',난기류:'weather_StrongWinds',극한:'weather_Snow_extreme',깊은밤:'weather_Night_extreme'};
 const T_IMG={그래스필드:'field_object_grass',일렉트릭필드:'field_object_electric',미스트필드:'field_object_mist',사이코필드:'field_object_psycho',트릭룸:'room_trick',매직룸:'room_magic',원더룸:'room_wonder',블랙룸:'room_black',중력:'object_gravity',물놀이:'object_watersport',흙놀이:'object_mudsport'};
 const fimg=k=>IMG().field[k]?`img/field/${IMG().field[k]}`:'';const simg=k=>{const v=((((DB().states||{}).st||{})[k])||{}).img||IMG().state[k];return !v?'':/^(https?:|data:image\/)/.test(v)?v:`img/state/${v}`};/* 제작기 상태 변화 DB 의 아이콘이 먼저 */

 /* ---------- 상태 읽기 도우미 ---------- */
 /* mgr: 배틀 진행 권한 — GM, 그리고 방 설정 「플레이어도 배틀 진행」이 켜져 있으면 자리에 앉은 사람 모두 (모의전). 비밀(상대 지시 엿보기·강제·모두 공개)은 여전히 GM 만 */
 function plBattle(){const rp=A().ST.state.rp||{};return rp.plBattle!==false}
 /* 방 설정 (GM 이 rp 에 둔다, 서버 om_set_state 가 같은 값으로 막는다)
    strict = rp.seatOwn  : 플레이어는 자기 트레이너·포켓몬·지시만 바꾼다 → 배틀 진행(턴·페이즈·필드)은 GM 만
    fair   = rp.gmHands===false : GM 도 플레이어의 지시·준비를 바꾸지 않고, 플레이어 포켓몬의 HP·랭크·상태 창을 열지 않는다 (자동 처리는 그대로) */
 function ctx(){const ST=A().ST;const b=ST.state.battle||{};const gm=ST.role==='gm';const rp=ST.state.rp||{};const strict=rp.seatOwn===true,fair=rp.gmHands===false;
  return {ST,b,role:ST.role,seat:ST.seat,gm,strict,fair,mgr:gm||(ST.role==='seat'&&plBattle()&&!strict)}}
 /* 바뀐 칸만 쓴다 (점검 2-4) — 배틀을 통째로 쓰면 그 사이 남이 바꾼 칸(다른 포켓몬의 피해, 지시 공개 …)이 지워진다.
    nb0 = 사본을 뜰 때의 배틀, nb = 고친 사본 (f 를 주면 필드도 그걸로). 포켓몬은 칸(hp · states …) 하나 단위로, 턴·페이즈는 맨 끝에 쓴다 */
 const snap=x=>JSON.parse(JSON.stringify(x===undefined?ctx().b:x));
 function saveBattle(nb0,nb,f,by,extra){if(f!==undefined)nb.field=f;const FL=faintSweep(nb0,nb);const ops=A().diffOps(['battle'],nb0,nb,3);const last=p=>(p[1]==='turn'||p[1]==='phase')?1:0;ops.sort((x,y)=>last(x[0])-last(y[0]));if(extra&&extra.length)ops.push(...extra);   /* 11-03: extra = 배틀 밖 칸(ready …)도 같은 묶음에 */const fa=snap(nb0.field||{}),fz=snap(nb.field||{});   /* 11-01 망령: by = 전개한 쪽 {n,s,img} — 필드가 바뀌었으면 전개 카드 (fieldLog) */const sa=stSnap(nb0),sz=stSnap(nb);   /* 11-01 망령 「상태 변화도 효과 로그」: 상태가 걸리거나 풀렸으면 상태 카드 (stLogAll) */
  return A().setMany(ops).then(r=>{if(r&&ops.length)itemKick();if(r&&FL.length)A().sysLog(FL.join('\n'),'battle');if(r&&ops.length){fieldLog(fa,fz,by,nb,350);stLogAll(sa,sz,by,350)}return r})}
 const stSnap=b=>{const o={};for(const id in (b||{}).mons||{}){const m=b.mons[id];if(m)o[id]={id,name:m.name,image:m.image,side:m.side,entry:m.entry,hp:{cur:(m.hp||{}).cur},states:Object.assign({},m.states||{})}}return {mons:o}};
 /* 10-23 망령: 쓰러진 포켓몬이 다른 포켓몬에게 건 포텐셜 · 특성 효과(옵저버 …)와 「필드 위에 있는 한」 효과도 퇴장처럼 푼다 */
 function faintSweep(nb0,nb){const L=[];if(!FX()||!nb0||!nb)return L;for(const id in nb.mons||{}){const m=nb.mons[id],o=(nb0.mons||{})[id];if(!o||!o.entry||!m||m.entry||m.hp.cur>0)continue;L.push(...auraOff(nb,m).L);if(FX().release)L.push(...FX().release(nb,m))}return L}
 async function faintOff(mid){const nb0=snap(),nb=snap(nb0);const m=nb.mons[mid];if(!m||m.hp.cur>0||!FX())return;const L=[...auraOff(nb,m).L,...(FX().release?FX().release(nb,m):[])];if(!L.length)return;if(await A().setMany(A().diffOps(['battle'],nb0,nb,3)))A().sysLog(L.join('\n'),'battle')}
 /* 11-03 감우: 1단계 비교라 states · rank · mod · fx 같은 묶음이 통째로 쓰여, 같은 포켓몬을 둘이 동시에 고치면 한쪽 잎이 사라졌다 — 2단계까지 내려가 바뀐 잎만 (지운 키는 null) */
 function saveMon(m0,mid,nm){return A().setDiff(['battle','mons',mid],m0,nm,2).then(r=>{if(r)itemKick();return r})}
 /* 소지품 저장 뒤 점검 (2026-10-23): 내가 저장한 뒤에만, 내가 고칠 수 있는 포켓몬의 HP 열매 · 치유 열매 · 시드 · 룸서비스 · 하양허브 … 를 터트린다 */
 let ITK=0;function itemKick(){clearTimeout(ITK);ITK=setTimeout(itemSweep,150)}
 /* 11-03 20:54 (PL 「저번 판엔 자동이던 시드가 이번엔 자동이 아니다」): 저장 뒤 점검은 「내가 저장한 뒤」에만 돌아서, 상대 화면이 필드를 바꾸면(일렉트릭메이커 …) 내 포켓몬의 시드가 안 터졌다.
    남이 바꾼 상태가 들어와도 점검한다 — 둘이 같은 포켓몬을 두 번 터트리지 않게 이때는 주인 몫만: GM 은 GM 이 올린 파티 · NPC, 좌석은 자기 트레이너 */
 let ITR=0;function itemKickRemote(){clearTimeout(ITR);ITR=setTimeout(()=>itemSweep(m=>{const c=ctx();return c.gm?!seatOwned(c,m.tid)&&canEdit(c,m):ownT(c,m.tid)&&canEdit(c,m)}),400)}
 async function itemSweep(own){if(!OI())return;const c=ctx();if(!c||!c.b||!c.b.mons)return;const b0=snap(c.b),b=snap(b0);const f=fieldOf(b);let out=[];try{out=OI().sweep(b,f,typeof own==='function'?own:m=>canEdit(c,m))}catch(e){console.warn(e);return}if(!out.length)return;
  if(!await saveBattle(b0,b,f))return;for(const x of out){const m=b.mons[x.mid]||{};A().sysLog(`【소지품】 ${m.name} 『${x.name}』\n${x.lines.join('\n')}`,'battle',{mid:x.mid,img:m.image||'',eff:String(x.eff||'').slice(0,300)})}}
 /* 플레이어 몫인 트레이너 = 플레이어가 배틀에 올린 것 (trainers[tid].by = 좌석 id). GM 이 불러온 파티(by:'gm')는 PL 권한 중에도 GM 이 그대로 지시·진행한다.
    by 가 없는 예전 배틀은 예전처럼 「주인이 앉아 있는 자리」로 본다 (gmTake 도 GM 몫) */
 function seatOwned(c,tid){if(!tid)return false;const t=((c.b||{}).trainers||{})[tid]||{};if(t.by)return t.by!=='gm';return !!((c.ST.state.seats||{})[tid])&&!t.gmTake}
 const turnKey=b=>String(+b.turn||0);
 function mode(b){return Math.max(1,Math.min(3,+b.mode||2))}  /* 기본 더블(2:2) */
 function entered(b,side){const out={};for(const a of AREAS.slice(0,mode(b))){const m=Object.values(b.mons||{}).find(x=>x.side===side&&x.entry===a&&x.hp.cur>0);out[a]=m||null}return out}
 function allEntered(b){const out=[];for(const s of SIDES){const e=entered(b,s);for(const a in e)if(e[a])out.push({slot:slotOf(s,a),side:s,area:a,mon:e[a]})}return out}
 /* 내 지시 칸 · 내 포켓몬 편집은 GM 과 그 자리의 주인만 — 모의전 권한(mgr)과는 별개 */
 /* 파티 불러오기: 진행하는 사람(mgr) + 「자기 것만」 방의 플레이어(자기 자리로) */
 function canLoad(c){return c.mgr||(c.role==='seat'&&!!c.seat&&c.strict)}
 /* 함께 지시하기 (10-25 망령): 트레이너 시트(roster.trainers.<id>.co)에 적힌 좌석은 그 트레이너를 제 것처럼 다룬다 — 지시 창 · 준비 · 공개 · 포켓몬 조작.
    co 는 시트 주인과 GM 만 쓸 수 있는 칸이고, 서버(om_own)가 같은 칸을 보고 숨긴 지시 읽기 · 저장을 허락한다 */
 function coOf(c,tid){const t=(((c.ST.state.roster||{}).trainers)||{})[tid];const L=t&&Array.isArray(t.co)?t.co.filter(s=>s&&s!==tid):[];const bt=((c.b||(c.ST.state.battle||{})).trainers||{})[tid];for(const x of ((bt&&bt.mates)||[]))if(x&&x.seat&&x.seat!==tid&&!L.includes(x.seat))L.push(x.seat);return L}   /* 10-25: 함께 지시하기로 합쳐진 손님 좌석(mates.seat)도 */
 function ownT(c,tid){return c.role==='seat'&&!!c.seat&&!!tid&&(tid===c.seat||coOf(c,tid).includes(c.seat))}
 /* 차례 자동 처리(선입력 차감 · 준비 꼴 · 공개)를 누가 맡나: 주인 화면, 주인이 없으면 함께 지시하는 좌석 중 접속한 첫 자리 — 같은 일을 두 화면이 하지 않게 */
 const coHtml=(c,tid)=>{const L=coOf(c,tid);if(!L.length)return '';const S=c.ST.state.seats||{};return ` <span class="cow" title="이 트레이너를 함께 지시하는 플레이어">👥 ${esc(L.map(s=>(S[s]||{}).name||s).join(' · '))}</span>`};
 const coBtn=(c,tid)=>(c.gm||c.seat===tid)&&(((c.ST.state.roster||{}).trainers||{})[tid])?`<button class="btn xs ghost" data-act="co" data-tid="${tid}" title="여러 플레이어가 이 트레이너의 지시 창 · 조작권을 함께 쓴다">함께 지시</button>`:'';
 function lead(c,tid){if(!ownT(c,tid))return false;if(tid===c.seat)return true;if(!((c.ST.state.seats||{})[tid])||A().online(tid))return false;return coOf(c,tid).filter(s=>s===c.seat||A().online(s)).sort()[0]===c.seat}
 /* 10-27 망령: PL 권한(c.fair) 중의 GM 은 자기가 불러온 트레이너만 — byAcct 가 다른 GM 것이면 지시 · 편집 · 수동 공개를 가린다 (자동 진행은 그대로). byAcct 가 없는 예전 트레이너는 어느 GM 이든 */
 function gmMine(c,tid){const t=((c.b||{}).trainers||{})[tid]||{};if(!t.byAcct)return true;const k=A().acctKey?A().acctKey():'';return !k||t.byAcct===k}
 function fairOff(c,tid){return !!(c.gm&&c.fair&&(seatOwned(c,tid)||!gmMine(c,tid)))}
 function myTrainers(c){const trs=c.b.trainers||{};if(c.gm)return Object.keys(trs).filter(t=>!fairOff(c,t));return Object.keys(trs).filter(t=>ownT(c,t)).sort((x,y)=>(y===c.seat)-(x===c.seat))}
 /* 10-27 망령: 요약 창은 그 트레이너를 다루는 사람만 — 좌석 주인 · 함께 지시, GM 은 PL 권한 중이면 자기가 불러온 트레이너만 (관전 · 상대는 못 본다) */
 function stxOk(c,tid){return !!tid&&!!((c.b.trainers||{})[tid])&&(ownT(c,tid)||(c.gm&&!fairOff(c,tid)))}
 function canEdit(c,mon){if(mon&&ownT(c,mon.tid))return true;return c.gm&&!(mon&&fairOff(c,mon.tid))}
 function skPend(c,tid){try{const K=c.ST.state.skill||{};const O=K.offer;if(!O)return false;const R=(K.res||{})[tid];return !(R&&R.offerId===O.id)}catch(e){return false}}
 function fieldOf(b){return Object.assign({weather:{type:'',count:0},terrain:{type:'',count:0},rooms:{},etc:{},objects:{left:{},right:{}}},b.field||{})}
 function typeChip(en){return A().typeChip(en)}
 function monName(b,mid){const m=(b.mons||{})[mid];return m?m.name:'?'}

 /* ---------- 렌더 ---------- */
 /* 상태 설명의 %campaign:키% (맵툴 룰 상수) 를 값으로 — DB 가 바뀔 때마다 한 번 */
 let DESC_FIX=null;function fixStDesc(){const st=(DB().states||{}).st;if(!st||DESC_FIX===st)return;DESC_FIX=st;const C=((DB().const||{}).campaign)||{};const rp=s=>String(s).replace(/%campaign:([^%]+)%/g,(a,k)=>C[k]!=null?String(C[k]):a);for(const k in st){const d=st[k];if(d&&Array.isArray(d.desc))d.desc=d.desc.map(rp)}}
 function render(el){fixStDesc();setTimeout(()=>{try{dupWatch(ctx(),ctx().b)}catch(e){}delayWatch(ctx(),ctx().b).catch(()=>{})},0);
  const c=ctx();const b=c.b;const f=fieldOf(b);const ready=c.ST.state.ready||{};
  const phases=[[0,'지시 준비'],[1,'턴 개시'],[2,'행동 순서'],[3,'행동 처리'],[5,'턴 종료']];
  const chips=[f.weather.type?`날씨 ${f.weather.type}${f.weather.count?' '+f.weather.count+'T':''}`:'',f.terrain.type?`${f.terrain.type}${f.terrain.count?' '+f.terrain.count+'T':''}`:'',...ROOMS.filter(r=>(f.rooms||{})[r]>0).map(r=>`${r} ${f.rooms[r]}T`),...ETC.filter(r=>(f.etc||{})[r]>0).map(r=>`${r} ${f.etc[r]}T`)].filter(Boolean);
  const mySide=c.mgr?'left':((b.trainers||{})[myTrainers(c)[0]]||{}).side||'left';const top=mySide==='left'?'right':'left';
  /* 11-03 감우: #scene 을 통째로 다시 그리면 치고 있던 입력칸(지시 상세 · 우선도 · 제한 시간)의 포커스가 빠졌다 — rp_ui 처럼 어느 칸이었는지(id 또는 data 열쇠) 와 커서를 기억했다가 그린 뒤 되찾는다.
     지시 입력 영역(#cmdForm)은 HTML 이 지난번과 같으면 옛 요소를 그대로 다시 붙인다 (접힌 칸 · 스크롤 유지) */
  const FK=x=>x?(x.id?'#'+x.id:x.dataset&&x.dataset.f?`[data-f="${x.dataset.f}"]${x.dataset.mid?`[data-mid="${x.dataset.mid}"]`:''}${x.dataset.slot?`[data-slot="${x.dataset.slot}"]`:''}`:''):'';
  const ae=document.activeElement;const keep=ae&&el.contains(ae)&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)?{sel:FK(ae),v:ae.value,s:ae.selectionStart,e:ae.selectionEnd}:null;
  const oldForm=$('#cmdForm',el);const cmdH=cmdPanel(c,ready);const sameCmd=!!(oldForm&&oldForm._h===cmdH);
  /* 11-03 감우 (검토 15-①): 얇은 sticky 바 — 조작판(.bstat)이 화면 밖으로 나가면 보인다 (stickyWatch). 턴 진행 · 지금 페이즈 · 필드 칩 · 다음 행동 · 되돌리기만 */
  const phN=(phases.find(([p])=>p===(+b.phase||0))||[,''])[1]+((+b.phase||0)===1&&b.tstep?(+b.tstep===1?' · 교대':' · 포텐셜 발동'):'');
  const nxt=(+b.phase||0)===1?(+b.tstep===2?'행동 순서':'다음'):['턴 개시','행동 순서','행동 처리','','','턴 종료'][+b.phase||0]||'';
  const ordOn=(b.order||[]).length&&(+b.phase||0)>=2&&(+b.phase||0)<5;const oi=Math.min((+b.orderIdx||0)+1,(b.order||[]).length);
  const pvpChip=b.pvp?'<span class="chip pvpc" title="PVP 모드 — 양쪽 도감 · 벤치가 모두에게 공개된다">PVP</span>':'';
  const sticky=`<div class="bsticky" id="bsticky"><span class="bstk"><b>TURN ${b.turn||0}</b><i>${esc(phN)}</i></span>${pvpChip}${c.mgr?`<button class="btn xs pri" data-act="progress" title="다음 단계로">턴 진행 ▶${nxt?' '+esc(nxt):''}</button>`:''}${ordOn?(c.mgr?`<button class="btn xs" data-act="onext" title="행동 순서의 다음 차례">다음 행동 ▶ <small>${oi}/${(b.order||[]).length}</small></button>`:`<span class="chip" title="행동 순서">행동 ${oi}/${(b.order||[]).length}</span>`):''}<span class="bstf ${c.mgr?'clickable':''}" ${c.mgr?'data-act="field" title="날씨 · 필드 · 룸"':''}>${chips.length?chips.map(x=>`<span class="chip">${esc(x)}</span>`).join(''):'<span class="dim small">날씨·필드 없음</span>'}</span><span class="sp"></span>${canRewind(c)?`<button class="btn xs ghost" data-act="rewind" title="이 턴의 턴 개시 직후로 되돌린다">↶ 되돌리기</button>`:''}</div>`;
  el.innerHTML=`${sticky}<div class="bstat ${BFOLD.open?'':'fold'}">
   <div class="turn ${c.mgr?'clickable':''}" ${c.mgr?'data-act="turnset" title="눌러서 턴 번호 조정"':''}><span class="tlab">TURN</span><span class="tnum">${b.turn||0}</span></div>${!c.mgr&&(c.gm||(c.role==='seat'&&c.seat))?`<button class="btn sm ghost aihandb" data-aihand title="AI 에게 맡기기 — 지침 주소 · 이 방 · 정해 둔 것을 한 번에 복사해 아무 AI 대화창에 붙여 넣어요${c.gm?'':' (PL: 내 트레이너 지시 · 대사)'} (js/ai_ui.js)">🤖 AI</button>`:''}
   <span class="phnow">${esc((phases.find(([p])=>p===(+b.phase||0))||[,''])[1])}${(+b.phase||0)===1&&b.tstep?(+b.tstep===1?' · 교대':' · 포텐셜 발동'):''}</span>${pvpChip}<span id="bdl" class="bdl">${dlHtml(c,b)}</span><button class="btn sm ghost bfold" data-bfold title="조작판 펼치기 · 접기">${BFOLD.open?'접기 ▴':'펼치기 ▾'}</button>
   <div class="phases">${phases.map(([p,n])=>{const ph0=+b.phase||0,ts=+b.tstep||0;const on=ph0===p&&(p!==1||ts<1);const btn=`<button class="ph ${on?'on':''}" data-phase="${p}" ${c.mgr?'':'disabled'}>${n}</button>`;
     /* 11-03 21:00 망령 「교대와 선행 입력 발동 타이밍은 다르니 페이즈를 나누자 — 교대 뒤 선행 포텐셜」: 턴 개시 안의 두 단계를 따로 보인다 (누르면 다음 단계로) */
     return p!==1?btn:btn+`<button class="ph sub ${ph0===1&&ts===1?'on':''}" data-tstepb="1" ${c.mgr?'':'disabled'} title="교대 — 교대 지시가 있으면 여기서 바꾼다">교대</button><button class="ph sub ${ph0===1&&ts===2?'on':''}" data-tstepb="2" ${c.mgr?'':'disabled'} title="선행 발동 — 지령 · 선행 포텐셜 (턴 개시에 쓰는 것은 저절로)">선행 발동</button>`}).join('')}</div>${(c.mgr||c.seat)?'<button class="btn sm autock" data-act="autock" title="내 트레이너 · 필드 위 내 포켓몬에서 자동으로 처리되는 것 (포텐셜 · 특성 · 소지품 · 기술 · 지령)">⚙ 자동화 확인</button>':''}
   <span class="sp"></span>${c.mgr?'':`<span id="typingBat" class="typingslot">${window.OM_RP_UI&&window.OM_RP_UI.typingHtml?window.OM_RP_UI.typingHtml():''}</span><span class="sp"></span>`}${window.OM_RP_UI&&window.OM_RP_UI.bgmWidgetHtml?window.OM_RP_UI.bgmWidgetHtml():''}   <!-- 11-03 20:47 망령 「BGM 을 오른쪽 위로 올려 한 줄로 · 입력 중은 PVP · PL 권한 줄 오른쪽에」: 진행자(mgr)는 입력 중 칸이 GM 줄 아랫줄 끝으로 -->
   ${c.mgr?`<div class="gmrow"><label title="${b.started?'시합 중에는 바꿀 수 없다 — 「배틀 비우기」 뒤에':'싱글 1 · 더블 2 · 트리플 3 에리어'}">에리어 <select data-act="mode" ${b.started?'disabled':''}>${[[1,'싱글'],[2,'더블'],[3,'트리플']].map(([n,l])=>`<option value="${n}" ${mode(b)===n?'selected':''}>${l}</option>`).join('')}</select>${b.started?' 🔒':''}</label>
    ${!b.started?`<button class="btn sm pri" data-act="start" title="연출(VS/경고)과 함께 시합을 시작한다. 동시 내밀기가 켜져 있으면 예약한 포켓몬이 한꺼번에 나온다">시합 개시</button>`:''}
    <button class="btn sm pri" data-act="progress" title="지시 준비 → 턴 개시 → 행동 순서 → 행동 처리 → 턴 종료 → 다음 턴">턴 진행 ▶ ${(+b.phase||0)===1?(+b.tstep===2?'행동 순서':'다음'):['턴 개시','행동 순서','행동 처리','','','턴 종료'][+b.phase||0]||''}</button>${simAny(b)?(()=>{const np=Object.values(b.mons||{}).filter(m=>m.pend).length;return `<button class="btn sm ${np?'pri':'ghost'}" data-act="pendgo" ${np?'':'disabled'} title="예약한 포켓몬을 양쪽 동시에 내보낸다">동시 내밀기 실행${np?' ('+np+')':''}</button>`})():''}${c.gm&&(+b.phase||0)===1?'<button class="btn sm ghost" data-act="reveal" title="아직 안 연 지시를 한꺼번에">모두 공개</button>':''}<button class="btn sm" data-act="field" title="날씨 · 그래스필드 등 · 룸 · 필드의 상태">필드</button>
    <button class="btn sm ghost" data-act="resetcmd" title="모든 지시 · 준비 완료 · 행동 순서를 지운다">초기화</button>${(+b.phase||0)===0?`<label class="dlset" title="지시 입력 제한 시간(분) — 비우면 제한 없음. 시간이 지나면 「준비 안 된 자리를 행동 없음으로 두고 진행」 단추가 뜬다">⏱ <input type="number" id="dlmin" min="0" max="180" data-act="deadline" value="${+b.deadline>Date.now()?Math.max(1,Math.ceil((+b.deadline-Date.now())/60000)):''}" placeholder="분"></label>`:''}<span class="snapbtns">${canRewind(c)?`<button class="btn sm ghost" data-act="rewind" title="이 턴의 턴 개시 직후(체크포인트)로 배틀을 되돌린다 — 턴 개시 때마다 남는다 (최근 3턴)">↶ 턴 처음</button>`:''}<button class="btn sm ghost" data-act="bresume" title="배틀 저장 · 이어서 하기 — 지금 배틀을 이름 붙여 저장하거나, 저장한 배틀을 불러온다">저장 ▾</button></span><span class="gmbr" aria-hidden="true"></span>${c.gm?'<button class="btn sm" data-act="result" title="HP·빈사·상태 이상·포텐셜 횟수·쓴 소지품을 시트에 돌려준다">결과 정리</button>':''}<button class="btn sm ghost danger" data-act="clear" title="배틀을 비운다 (전당에 남길지 먼저 묻는다)">비우기</button>${c.gm&&window.OM_RP_UI&&window.OM_RP_UI.bsayToggleHtml?window.OM_RP_UI.bsayToggleHtml():''}${c.mgr?`<button class="btn sm pvpb ${b.pvp?'pri':'ghost'}" data-act="pvp" title="${b.pvp?'PVP 모드 중 — 양쪽 도감 · 비공개 벤치가 모두에게 공개된다. 누르면 해제(해석한 만큼만 보이게)':'PVP 설정 — 켜면 서로의 도감 정보(타입 · 약점 · 종족치 · 기술 · 특성 · 포텐셜)와 비공개 벤치가 모두에게 공개된다 (해석 횟수는 안 쓴다)'}">PVP</button>`:''}${c.gm?`<button class="btn sm gmh ${c.fair?'pri':'ghost'}" data-act="gmhands" title="켜면 GM 도 플레이어처럼 — 플레이어가 올린 트레이너의 지시·준비·HP·상태는 그 플레이어만. GM 이 불러온 파티·NPC 는 GM 이 그대로 지시하고 진행한다 (방 설정 「GM 불간섭」과 같음)"><span class="lbl">${c.fair?'↩ GM 권한':'PL 권한'}</span><span class="sh">${c.fair?'↩ GM':'PL'}</span></button>`:''}${(c.gm||(c.role==='seat'&&c.seat))?`<button class="btn sm ghost aihandb gmai" data-aihand title="AI 에게 맡기기 — 지침 주소 · 이 방 · 정해 둔 것을 한 번에 복사해 아무 AI 대화창에 붙여 넣어요${c.gm?'':' (PL: 내 트레이너 지시 · 대사)'} (js/ai_ui.js)">🤖 AI</button>`:''}
    <span class="gmty"><span id="typingBat" class="typingslot">${window.OM_RP_UI&&window.OM_RP_UI.typingHtml?window.OM_RP_UI.typingHtml():''}</span></span>
    ${Object.entries(c.ST.state.pub||{}).filter(([k,v])=>v&&v.time).map(([k,v])=>`<span class="chip" style="border-color:var(--yel)">타임 요청: ${esc((b.trainers[k]||{}).name||k)} → ${esc(monName(b,v.time.mid))} <button class="btn xs pri" data-act="timeok" data-seat="${k}">허가</button></span>`).join('')}</div>`:''}
   ${c.gm&&window.OM_RP_UI&&window.OM_RP_UI.bspkHtml?`<details class="bspkfold" data-bspkfold ${BSPKF.open?'open':''}><summary title="배틀 탭에서는 화자 칩 줄을 접어 둔다 — 열고 닫은 건 이 브라우저에 기억">화자 · 스탠딩 ${BSPKF.open?'▾':'▸'}</summary>${window.OM_RP_UI.bspkHtml()}</details>`:''}
  </div>
  ${revealStrip(c,ready)}${endPanel(c)}
  <div class="stadium">
   ${benchRow(c,'left',ready)}
   <div class="fieldcol ${f.stage&&f.stage.name?'staged':''} ${fieldBg(f).cls}" style="${fieldBg(f).st}">${areaGrid(c)}${window.OM_STAGE_UI?window.OM_STAGE_UI.chip(c,f):''}${fieldStrip(c,f)}</div>
   ${benchRow(c,'right',ready)}
  </div>
  ${orderBox(c)}
  ${sameCmd?'<form id="cmdForm" class="cmdpanel"></form>':cmdH}`;
  if(sameCmd){const ph=$('#cmdForm',el);if(ph)ph.replaceWith(oldForm)}else{const nf=$('#cmdForm',el);if(nf)nf._h=cmdH}
  stickyWatch(el);{const d=el.querySelector('[data-bspkfold]');if(d)d.addEventListener('toggle',()=>{BSPKF.open=d.open;try{localStorage.setItem('om_bspkfold',d.open?'1':'0')}catch(e){}const sm=d.querySelector('summary');if(sm)sm.textContent='화자 · 스탠딩 '+(d.open?'▾':'▸')})}
  el.querySelectorAll('[data-phase]').forEach(bt=>bt.onclick=()=>setPhase(+bt.dataset.phase));el.querySelectorAll('[data-tstepb]').forEach(bt=>bt.onclick=()=>{const b2=ctx().b;if((+b2.phase||0)!==1)return A().toast('턴 개시 뒤에 — 「턴 진행 ▶」으로 들어간다');if((+b2.tstep||0)>=+bt.dataset.tstepb)return;return stepTurn()});autoAdvance();
  try{if(window.OM_RP_UI&&window.OM_RP_UI.bspkBind)window.OM_RP_UI.bspkBind(el)}catch(e){console.warn(e)}
  if(window.OM_RP_UI&&window.OM_RP_UI.bindBgmWidget)window.OM_RP_UI.bindBgmWidget(el);
  {const fb=el.querySelector('[data-bfold]');if(fb)fb.onclick=()=>{BFOLD.open=!BFOLD.open;try{localStorage.setItem('om_bfold',BFOLD.open?'1':'0')}catch(e){}const bs=fb.closest('.bstat');bs.classList.toggle('fold',!BFOLD.open);fb.textContent=BFOLD.open?'접기 ▴':'펼치기 ▾'}}
  el.querySelectorAll('[data-act]').forEach(bt=>{if(bt.tagName==='SELECT')bt.onchange=()=>action(bt.dataset,bt.value);else if(bt.type==='checkbox')bt.onchange=()=>action(bt.dataset,bt.checked);else if(bt.tagName==='INPUT')bt.onchange=()=>action(bt.dataset,bt.value);else bt.onclick=()=>action(bt.dataset)});
  el.querySelectorAll('[data-mon]').forEach(cd=>cd.onclick=e=>{if(e.target.closest('[data-act]'))return;A().openMon(cd.dataset.mon)});
  const form=$('#cmdForm',el);if(form)bindCmdForm(form,c);cmdFab(form);refreshSide(c);try{hitWatch(c);reflash()}catch(e){console.warn('hitWatch',e)}
  if(keep&&keep.sel){try{const t=el.querySelector(keep.sel);if(t&&!t.disabled){if(t.value!==keep.v&&/^(INPUT|TEXTAREA)$/.test(t.tagName)&&t.type!=='number')t.value=keep.v;t.focus({preventScroll:true});if(keep.s!=null&&t.setSelectionRange)try{t.setSelectionRange(keep.s,keep.e)}catch(e){}}}catch(e){}}}
 /* 폰: 카드 「⋯」로 나머지 버튼 펼치기 */
 document.addEventListener('click',e=>{const h=e.target.closest('[data-bfold]');if(!h||e.target.closest('button,label,input,select,a,.chip')||!matchMedia('(max-width:760px)').matches)return;const sd=h.dataset.bfold;UIC.bfold=UIC.bfold||{};UIC.bfold[sd]=!UIC.bfold[sd];const col=h.closest('.bcol');if(col)col.classList.toggle('fold',UIC.bfold[sd])});
 document.addEventListener('click',e=>{const t=e.target.closest('[data-mmore]');if(!t)return;e.stopPropagation();const box=t.closest('.mbtns');const on=box.classList.toggle('open');{const nx=box.nextElementSibling;if(nx&&nx.classList.contains('mbtns2'))nx.classList.toggle('open',on)}t.setAttribute('aria-expanded',on?'true':'false')},true);
 /* 폰: 지시 입력 칸이 화면 밖이면 아래에 「지시 입력」 버튼을 띄워 바로 내려간다 */
 let FAB=null,FABIO=null;
 function cmdFab(form){if(!FAB||!FAB.isConnected){FAB=document.createElement('button');FAB.type='button';FAB.className='cmdfab';FAB.innerHTML='✎ 지시 입력';FAB.onclick=()=>{const f=document.getElementById('cmdForm');if(f)f.scrollIntoView({behavior:'smooth',block:'start'})};document.body.appendChild(FAB)}
  if(FABIO){FABIO.disconnect();FABIO=null}if(!form){FAB.classList.remove('on');return}
  FABIO=new IntersectionObserver(es=>{for(const e of es)FAB.classList.toggle('on',!e.isIntersecting&&e.boundingClientRect.top>0)},{threshold:0});FABIO.observe(form)}
 document.addEventListener('click',e=>{const t=e.target.closest('.mvdb');if(!t)return;e.stopPropagation();e.preventDefault();if(document.querySelector('.modalbg')&&!document.querySelector('.dbmodal'))return;window.OM_DB_UI.open({kind:'move',sel:t.dataset.mvdb})},true);
 /* ---------- 11-03 감우 (검토 18): 피해 받는 쪽 알림 — 내 포켓몬에 lastHit 이 새로 생기면 토스트 「○○ 피해 판정 받음 — 적용」(누르면 HP 창) + 효과음, 휴대폰 cmdfab 에 숫자 뱃지. 같은 lastHit(mid + at)에 한 번만 ---------- */
 const HITSEEN=new Set();let HITT=null;
 function myHits(c){const mine=myTrainers(c);return Object.values(c.b.mons||{}).filter(m=>m&&m.lastHit&&m.entry&&m.hp.cur>0&&mine.includes(m.tid)&&canEdit(c,m))}
 function hitBadge(){const c=ctx();const n=c.b&&c.b.mons?myHits(c).length:0;if(FAB&&FAB.isConnected){FAB.dataset.badge=n?String(n):'';FAB.classList.toggle('hit',n>0)}return n}
 function hitWatch(c){const L=myHits(c);hitBadge();const fresh=L.filter(m=>{const k=m.id+':'+(+m.lastHit.at||0);if(HITSEEN.has(k))return false;HITSEEN.add(k);return Date.now()-(+m.lastHit.at||0)<60000});if(!fresh.length)return;
  const m=fresh[fresh.length-1];let el=document.querySelector('.hittoast');if(!el){el=document.createElement('button');el.type='button';el.className='hittoast';document.body.appendChild(el)}
  el.innerHTML=`<b>${esc(m.name)}</b> 피해 판정 받음${fresh.length>1?` 외 ${fresh.length-1}`:''} <span class="hta">— 적용</span>`;el.onclick=()=>{el.remove();openHp(m.id,'dmg')};el.classList.add('on');clearTimeout(HITT);HITT=setTimeout(()=>{el.classList.remove('on');setTimeout(()=>{if(!el.classList.contains('on'))el.remove()},300)},8000);
  try{const U=window.OM_RP_UI;if(U&&U.seUrlOf&&U.seUrlOf('Ping'))U.playSe('Ping',true);else if(CUT()&&CUT().synth)CUT().synth('ready')}catch(e){}}

 /* 턴 개시 뒤 맨 위: 지시 공개 UI (맵툴 open_command). 자기 것(GM 은 모두)은 버튼, 남의 것은 현황. 지령·명령은 공개하지 않고 「4식 6령」 창에서 발동한다 */
 /* 급소 소지품: 초점렌즈·예리한손톱 C+1, 럭키펀치(럭키) C+2, 받는 쪽 방검조끼 C-2 — 맵툴처럼 자동 */
 function itemCrit(atk,def){if(OI())return OI().crit(atk,def);let v=0;const ai=IT(atk),di=IT(def);if(ai==='초점렌즈'||ai==='예리한손톱')v+=1;if(ai==='럭키펀치'&&/럭키/.test(atk.species||atk.name||''))v+=2;if(di==='방검조끼')v-=2;return v}
 /* 기술 부가효과 굴림: 효과 글의 「N할 …」마다 1d10 ≤ N 이면 발동. 10할은 굴리지 않고 확정. 하늘의은총 ×2, 받는 쪽 은밀망토면 없음. 적용은 손으로 */
 /* 10-27 제보: 부가효과 확률을 공격 창에서 바꿀 수 있게 — SECADJ = {add:%p, sure} (공격 창 「부가효과」 칸). 보정이 있으면 %로 굴린다 */
 let SECADJ={add:0,sure:false};
 function secRoll(n){const A0=SECADJ||{};if(A0.sure)return {ok:true,txt:' — 확정 (손으로)'};if(!A0.add){if(n>=10)return {ok:true,txt:' — 확정'};const r=1+Math.floor(Math.random()*10);const ok=r<=n;return {ok,txt:` — 굴림 ${r}/${n} ${ok?'발동!':'불발'}`}}
  const p=Math.max(0,Math.min(100,n*10+(+A0.add||0)));if(p>=100)return {ok:true,txt:` → ${p}% (보정 ${A0.add>0?'+':''}${A0.add}%p) — 확정`};const r=1+Math.floor(Math.random()*100);const ok=r<=p;return {ok,txt:` → ${p}% (보정 ${A0.add>0?'+':''}${A0.add}%p) — 굴림 ${r}/${p} ${ok?'발동!':'불발'}`}}
 function secRolls(atk,def,mv){const t=String(mv.eff||'');const out=[];const re=/(\d+)할\s*(?:의\s*확률로\s*|로\s*)?([^.。\n]*)/g;let m;
  while((m=re.exec(t))){let n=+m[1];const what=m[2].trim()||'추가 효과';if(atk.ability==='하늘의은총')n=Math.min(10,n*2);
   if(IT(def)==='은밀망토'){out.push({ok:false,line:`부가효과 ${m[1]}할 ${what} — 은밀망토로 받지 않음`});continue}
   const R=secRoll(n);out.push({ok:R.ok,line:`부가효과 ${n}할 ${what}${R.txt}`})}
  return out}
 /* 기술 자동화 (제작기 js/fx/moveauto.js): 효과 글 → 굴림 + 적용할 op. 맞은 대상마다(target) / 한 번만(once) */
 const MA=()=>window.OM_MOVEAUTO;
 const CHARGE_ST={Charge:'Electric',Heat:'Fire',Cool:'Ice',Load:'Steel'};   /* 다음 그 타입 기술 대미지 2배 (공격 창 「충전계 ×2」를 자동으로 켠다) */
 function moveAuto(mv){if(!MA()||!FX())return null;try{return MA().parse(mv)}catch(e){return null}}
 /* 10-22 망령: 발버둥 — 기술 목록 끝에 늘 붙는 칸 (「망각」 · 쓸 기술이 없을 때). 번호 = 원래 기술 수 다음 */
 let STRUG=null;const XMV={};   /* 11-03 「기술사용」 구문: 공격 창을 연 동안만 그 기술을 기술 목록 끝에 붙인다 */
 function MVS(m){const a=teraBlastL(m,(m&&m.moves)||[]);const X=extMoves(m).concat(m&&XMV[m.id]?[XMV[m.id]]:[]);if(a.some(x=>x&&x.name==='발버둥'))return X.length?[...a,...X]:a;if(!STRUG)STRUG=Object.assign(window.OM_IMPORT?window.OM_IMPORT.move('발버둥',false):{name:'발버둥',cat:'물리',pow:50,acc:0,range:'1체',type:'-',typeEn:'-'},{virt:1});return [...a,STRUG,...X]}
 /* 10-27 망령: 트레이너가 주는 「기능 확장 : 기술」 — 제작기 트레이너 시트 「기능 확장」(t.ext). 기술 목록 맨 뒤(발버둥 다음)에 붙어 지시 · 공격 창에서 고른다.
    횟수는 배틀 트레이너 extUse[번호] (공격 창 「적용」 때 1 씩). who 가 있으면 그 포켓몬만, 없으면 PT 전원 */
 /* 11-02 망령: 테라스탈 · 테라버스트 — 「테라스탈」 상태면 테라 타입이 되고 「공격」「특공」(랭크 · 배율 포함) 중 높은 쪽 분류. 원본 기술은 건드리지 않고 사본만 */
 function teraOn(m){return !!(m&&m.teraActive&&m.teraEn&&m.teraEn!=='-')}
 function teraSame(m){return teraOn(m)&&(m.types||[]).includes(m.teraEn)}   /* 타입 1~3 에 타입 4 와 같은 타입 → 「적응력」 */
 function hasTera(m){return !!(m&&m.teraEn&&m.teraEn!=='-')}
 function teraBlastL(m,a){if(!teraOn(m)||!a.some(x=>x&&/^테라버스트/.test(String(x.name||''))))return a;let ph=false;try{ph=B().statValue(m,'attack').value>B().statValue(m,'specialattack').value}catch(e){}
  return a.map(x=>x&&/^테라버스트/.test(String(x.name||''))?Object.assign({},x,{type:S().typeKo(m.teraEn),typeEn:m.teraEn,cat:ph?'물리':'특수',atk:ph?'공격':'특공',def:ph?'방어':'특방',teraB:1}):x)}
 function extMoves(m){if(!m||!m.tid)return [];const b=(A().ST.state||{}).battle||{};const t=(b.trainers||{})[m.tid];const L=t&&Array.isArray(t.ext)?t.ext:[];if(!L.length)return [];const U=t.extUse||{};const out=[];
  L.forEach((e,i)=>{if(!e||!e.mv||(e.who&&e.who!==m.id))return;const base=window.OM_IMPORT?window.OM_IMPORT.move(e.mv,false):{name:e.mv,cat:'',pow:0,acc:0,range:'1체',type:'-',typeEn:'-'};const lim=+e.lim||0,used=+U[i]||0;
   out.push(Object.assign({},base,{ext:{i,lim,used,left:lim?Math.max(0,lim-used):null,kind:e.kind==='extra'?'extra':'act',src:e.src||'',tid:m.tid}}))});return out}
 function extGone(mv){return !!(mv&&mv.ext&&mv.ext.lim&&mv.ext.left<=0)}
 let SECX=1;   /* 11-03 「추가효과 ×N」: 공격 창이 지금 기술에 맞춰 정한다 */
 function rollGroup(atk,def,g){let n=g.n;if(g.sec&&atk.ability==='하늘의은총')n=Math.min(10,n*2);if(g.sec&&SECX!==1)n=Math.min(10,Math.round(n*SECX*10)/10);const what=g.label;
  if(g.sec&&def&&def.id!==atk.id&&IT(def)==='은밀망토')return {g,ok:false,line:`${what} — 은밀망토로 받지 않음`};
  const pick=g.oneOf?g.oneOf[Math.floor(Math.random()*g.oneOf.length)]:null;const pk=pick?' → '+FX().unparse(pick).join(' ').replace(/^상태 /,'').replace(/ target.*$/,''):'';
  if(!((SECADJ||{}).add||(SECADJ||{}).sure)||n>=10){if(n>=10)return {g,ok:true,ops:pick||g.ops,line:`${what}${pk}${g.sec?' — 확정':''}`};
   const r=1+Math.floor(Math.random()*10);const ok=r<=n;return {g,ok,ops:pick||g.ops,line:`${what} — 굴림 ${r}/${n} ${ok?'발동!'+pk:'불발'}`}}
  const R=secRoll(n);return {g,ok:R.ok,ops:pick||g.ops,line:`${what}${R.txt}${R.ok?pk:''}`}}
 const tgtFor=(atk,def)=>op=>op.tgt!=='target'?op:Object.assign({},op,{tgt:def.id===atk.id?'self':!sameT(def,atk)?'enemy1':'ally1'});
 /* 변칙 위력 기술 (맵툴 get_special_move_power 를 옮김): 이름 → (def)=>{pow, note, fixed} */
 const SPMAP={테라클러스터:'tclu',헤비봄버:'heavy',머슬봄버:'heavy',때려부수기:'heavy',메테오퍼니셔:'heavy',아쿠아스탬프:'heavy',록스탬프:'heavy',히트스탬프:'heavy',질주:'ball',마하비행:'ball',앞지르기:'ball',일렉트릭볼:'ball',드래곤에너지:'spout',해수스파우팅:'spout',분화:'spout',기사회생:'flail',바둥바둥:'flail',플레임블래스트:'flail',스완송:'flail',하드프레스:'press',묵사발:'crush',쥐어짜기:'crush',안다리걸기:'grass',풀묶기:'grass',자이로볼:'gyro',매그니튜드:'mag',엘렉키슬롯:'mag',프레젠트:'present',사이코웨이브:'psywave'};
 /* 10-27 망령: 「명중할 때 마다 위력이 「N」씩 증가」(트리플악셀 20 · 트리플킥 10) — 타마다 위력 +N. 0 = 해당 없음 */
 function powStepOf(mv){const m=String((mv||{}).eff||'').match(/명중할\s*때\s*마다\s*위력이\s*「?\s*(\d+)\s*」?\s*씩\s*증가/);return m?+m[1]:0}
 function specialPowFor(name,atk){const k=SPMAP[String(name||'').trim()];if(!k)return null;
  const sv=(m,k)=>+B().statValue(m,k).value||0;   /* statValue 는 {value,rank,…} 를 돌려준다 — 숫자만 */
  const spd=m=>{let v=sv(m,'speed');if((m.states||{}).Paralysis)v=v/2;return v};const ladder=(x,steps,start)=>{let p=start;for(const [t,v] of steps)if(x>t)p=v;return p};
  const hpR=m=>m.hp.max>0?m.hp.cur/m.hp.max:0;
  if(k==='mag'){const r=1+Math.floor(Math.random()*256);let p=10;for(const [t,v] of [[25,30],[76,50],[153,70],[204,90],[229,110],[242,150]])if(r>=t)p=v;return ()=>({pow:p,note:`변칙 위력 ${name}: 판정 ${r}/256 → 위력 ${p}`})}
  if(k==='present'){const r=1+Math.floor(Math.random()*100);const p=r>90?120:r>60?80:r>20?40:null;return ()=>p?{pow:p,note:`변칙 위력 ${name}: 판정 ${r} → 위력 ${p}`}:{pow:0,fixed:1,note:`변칙 위력 ${name}: 판정 ${r} → 대상 HP 1/2 회복 (손으로)`}}
  if(k==='psywave'){const r=Math.floor(Math.random()*11)+5;const v=Math.max(1,Math.floor((+atk.lv||1)*r/10));return ()=>({pow:0,fixed:1,note:`${name}: 고정 대미지 ${v} (Lv ${atk.lv} × ${r/10}) — HP 조작으로 적용`})}
  return def=>{let p,why='';
   if(k==='heavy'){const a=sv(atk,'defense'),d=sv(def,'defense');const x=d>0?a/d:0;p=ladder(x,[[1,60],[1.5,80],[2,100],[2.5,120]],40);why=`방어 ${Math.floor(a)}/${Math.floor(d)}`}
   else if(k==='ball'){const a=spd(atk),d=spd(def);const x=d>0?a/d:0;p=ladder(x,[[1,60],[2,80],[3,120],[4,150]],40);why=`스피드 ${Math.floor(a)}/${Math.floor(d)}`}
   else if(k==='gyro'){const a=spd(atk),d=spd(def);p=a>0?Math.floor(Math.max(1,Math.min(150,25*d/a+1))):1;why=`스피드 ${Math.floor(a)} vs ${Math.floor(d)}`}
   else if(k==='spout'){p=Math.max(1,Math.floor(150*hpR(atk)));why=`자신 HP ${atk.hp.cur}/${atk.hp.max}`}
   else if(k==='flail'){const x=atk.hp.max>0?Math.floor(atk.hp.cur*48/atk.hp.max):0;p=20;for(const [t,v] of [[32,40],[16,80],[9,100],[4,150],[1,200]])if(x<t)p=v;why=`자신 HP ${atk.hp.cur}/${atk.hp.max}`}
   else if(k==='press'){p=def.hp.cur>0?Math.max(1,Math.floor(100*hpR(def))):1;why=`대상 HP ${def.hp.cur}/${def.hp.max}`}
   else if(k==='crush'){p=def.hp.cur>0?Math.max(1,Math.floor(120*hpR(def))):1;why=`대상 HP ${def.hp.cur}/${def.hp.max}`}
   else if(k==='tclu'){const on=teraOn(def);p=on?240:120;why=on?'대상이 「테라스탈」 상태 — 위력 2배':'대상이 테라스탈 아님'}   /* 11-02 망령 */
   else if(k==='grass'){const bh=+((def.base||[])[0])||0;p=20;for(const [t,v] of [[60,40],[90,80],[120,100],[150,120]])if(bh>=t)p=v;why=`대상 HP 종족치 ${bh}`}
   return {pow:p,note:`변칙 위력 ${name}: ${why} → 위력 ${p}`}}}
 /* 동시 내밀기는 트레이너마다 (2026-10-23 망령: 각자 자기가 켠다 — 누가 켜도 상대 것은 안 바뀐다). 예전 배틀의 b.simul 은 안 정한 트레이너의 기본값 */
 const simOn=(b,tid)=>{const t=(b.trainers||{})[tid]||{};return t.simul!=null?!!t.simul:!!b.simul};
 const simAny=b=>Object.keys(b.trainers||{}).some(t=>simOn(b,t))||Object.values(b.mons||{}).some(m=>m.pend);
 const simSide=(b,side)=>(((b.sides||{})[side]||{}).trainers||[]).some(t=>simOn(b,t));
 /* 동시 내밀기 현황: 진영마다 예약 수 / 에리어 수. 양쪽 다 차면 「완료」 */
 function pendCount(b,side){const ids=((b.sides||{})[side]||{}).trainers||[];const ms=Object.values(b.mons||{}).filter(m=>ids.includes(m.tid));const need=Math.min(mode(b),ms.filter(m=>m.hp.cur>0).length);return {n:ms.filter(m=>m.pend).length,need}}
 function pendStatus(b){const L=pendCount(b,'left'),R=pendCount(b,'right');const done=L.need>0&&R.need>0&&L.n>=L.need&&R.n>=R.need;return `<span class="chip ${done?'on':''}" title="동시 내밀기 예약">예약 좌 ${L.n}/${L.need} · 우 ${R.n}/${R.need}${done?' — 완료!':''}</span>`}
 function revealStrip(c,ready){const b=c.b;const ph=+b.phase||0;if(ph<1)return '';const mine=myTrainers(c);
  const rows=Object.keys(b.trainers||{}).map(tid=>{const t=b.trainers[tid];const mons=Object.values(b.mons||{}).filter(m=>m.tid===tid&&m.entry&&m.hp.cur>0).sort((x,y)=>x.entry.localeCompare(y.entry));if(!mons.length)return '';const my=mine.includes(tid);
   return `<span class="rs ${my?'my':''}"><b>${esc(t.name)}</b>${mons.map(m=>revealed(b,tid,m.id)?`<i class="ok" title="${esc(m.name)}">${String(m.entry).toUpperCase()} ✓</i>`:my&&ph>=2&&turnReached(b,m)?`<button class="btn xs pri" data-act="revealmon" data-tid="${tid}" data-mid="${m.id}" title="${esc(m.name)} 의 지시를 공개">${String(m.entry).toUpperCase()} 공개</button>`:`<i title="${esc(m.name)}">${String(m.entry).toUpperCase()}</i>`).join('')}${my?`<button class="btn xs" data-act="fire" data-tid="${tid}" title="선행 입력한 지령·명령 · 고유·전용 포텐셜을 발동">포텐셜 발동</button>`:''}</span>`}).join('');
  return `<div class="revealstat"><span class="olab">지시 공개</span>${rows}<span class="sp"></span><span class="small dim">${ph===1?'턴 개시 — 지령 · 턴 개시 포텐셜은 「포텐셜 발동」. 지시(기술·교대)는 행동 순서가 오면 그 포켓몬부터 공개된다':'지시는 자기 차례에 공개 · 지령·명령·고유·전용은 「포텐셜 발동」에서 그때그때'}</span></div>`}
 /* 좌측 A | 우측 A / 좌측 B | 우측 B … 열 = 진영, 행 = 에리어 */
 function areaGrid(c){const b=c.b;const ent={left:entered(b,'left'),right:entered(b,'right')};const ids={left:((b.sides||{}).left||{}).trainers||[],right:((b.sides||{}).right||{}).trainers||[]};
  const cell=(side,a)=>{const m=ent[side][a];const slot=slotOf(side,a);return `<div class="area ${side} ${m?'':'empty'}" data-slot="${slot}"><div class="alab ${side}">${SIDE_KO[side]} ${a.toUpperCase()}</div>${m?bigCard(c,m,slot):`<div class="aempty">빈 자리${c.mgr||ids[side].includes(c.seat)?'<br><span class="small">벤치에서 「등장」</span>':''}</div>`}</div>`};
  return `<div class="fgrid"><div class="ahead left">${SIDE_KO.left}</div><div class="ahead right">${SIDE_KO.right}</div>${AREAS.slice(0,mode(b)).map(a=>cell('left',a)+cell('right',a)).join('')}</div>`}
 function areaRow(c,side){const b=c.b;const ent=entered(b,side);const ids=((b.sides||{})[side]||{}).trainers||[];
  return `<div class="arow ${side}"><div class="alabel ${side}">${SIDE_KO[side]}</div>${AREAS.slice(0,mode(b)).map(a=>{const m=ent[a];const slot=slotOf(side,a);
   return `<div class="area ${m?'':'empty'}" data-slot="${slot}"><div class="alab">${a.toUpperCase()}</div>${m?bigCard(c,m,slot):`<div class="aempty">빈 자리${c.mgr||ids.includes(c.seat)?'<br><span class="small">벤치에서 「등장」</span>':''}</div>`}</div>`}).join('')}</div>`}
 function benchRow(c,side,ready){const b=c.b;const ids=((b.sides||{})[side]||{}).trainers||[];const trs=b.trainers||{};const seats=c.ST.state.seats||{};
  const feB=window.OM_STAGE_UI&&(c.mgr?ids.length:ids.some(t=>ownT(c,t)))?`<button class="btn xs" data-act="stagemgr" data-side="${side}" title="${c.mgr?'트레이너 · 포켓몬이 각자 가진':'내 트레이너 · 포켓몬의'} 필드 · 스타디움 · 이계를 펼친다">필드 전개</button>`:'';
  /* 10-25 망령: 한 진영에 트레이너가 둘 이상이면(개인전 · 따로 세우기) 함께 지시 · 필드 전개 · 동시 내밀기를 머리 줄에 이름 붙여 늘어놓지 않고, 각 트레이너 칸 안에 따로 단다 */
  const multi=ids.length>1;
  const perT=tid=>{if(!multi)return '';const t=trs[tid];if(!t)return '';const own=c.gm||ownT(c,tid);
   const fe=window.OM_STAGE_UI&&(c.mgr||ownT(c,tid))?`<button class="btn xs" data-act="stagemgr" data-side="${side}" data-tid="${tid}" title="${esc(t.name||'')}의 트레이너 · 포켓몬이 가진 필드 · 스타디움 · 이계를 펼친다">필드 전개</button>`:'';
   const sm=own?`<label class="btn xs ${simOn(b,tid)?'pri':'ghost'} simtg" title="켜면 ${esc(t.name||'')}은(는) 「등장」 대신 「내밀기 예약」 — 「시합 개시」·「내밀기 실행」 때 예약한 포켓몬이 양쪽 동시에 나온다"><input type="checkbox" data-act="simul" data-tid="${tid}" ${simOn(b,tid)?'checked':''}> 동시 내밀기</label>`:'';
   const spb=window.OM_SP_UI&&window.OM_SP_UI.canOpen('',tid)?`<button class="btn xs spbtn" data-act="spmgr" data-side="${side}" data-tid="${tid}" title="SP (서포터) — 밖에서 돕는 조력자의 한 수">SP</button>`:'';
   const sb=stxOk(c,tid)&&window.OM_STATUS_UI?`<button class="btn xs ghost" data-act="stx" data-tid="${tid}" title="PT 요약 — 포켓몬 · 소지품 착용 · 소지품 소켓">요약</button>`:'';   /* 10-27 망령: 「현황」 → 「요약」, 카드 옆으로 */
   const cb=cardBtn(c,tid);return cb||sm||sb?`<div class="tbtns tbtns-own">${cb}${sb}<span class="sp"></span>${sm}</div>`:''};
  const items=ids.map((tid,ti)=>{const t=trs[tid]||{name:'?',ranks:{}};const o=seats[tid];const mons=Object.values(b.mons||{}).filter(m=>m.tid===tid).sort((x,y)=>(x.slot||0)-(y.slot||0));const cmdDone=!!(b.cmds||{})[tid];const rd=!!ready[tid];
   return `<div class="tblock"><div class="trainer"><div class="tpic" style="${t.image?`background-image:url('${cssu(t.image)}')`:''}"></div><div class="tinfo"><div class="tn">${esc(t.name)}${tid===c.seat?' <span class="tag me">ME</span>':ownT(c,tid)?' <span class="tag me co" title="함께 지시하는 트레이너">함께</span>':''}${rd?' <span class="tag ok">READY</span>':cmdDone?' <span class="tag">공개됨</span>':''}${soloTag(c,tid,ids)}${(()=>{/* 10-26 망령: 필드 전개 · SP 는 자주 안 쓰니 이름 줄 빈 곳으로 작게 올리고, 그 자리(아래 줄)엔 카드 */const own=c.gm||tid===c.seat||ownT(c,tid);if(!own)return '';const fe=window.OM_STAGE_UI&&(c.mgr||ownT(c,tid))?`<button class="btn xs ghost tnmini" data-act="stagemgr" data-side="${side}" data-tid="${tid}" title="필드 · 스타디움 · 이계를 펼친다">필드</button>`:'';const sp=window.OM_SP_UI&&window.OM_SP_UI.canOpen('',tid)?`<button class="btn xs ghost tnmini spbtn" data-act="spmgr" data-side="${side}" data-tid="${tid}" title="SP (서포터) — 밖에서 돕는 조력자의 한 수">SP</button>`:'';return fe||sp?`<span class="tnmore">${fe}${sp}</span>`:''})()}</div>
     <div class="rk4">${['지시','육성','통솔','능력'].map(k=>`<span><small>${k}</small><b>${esc(t.ranks[k]||'-')}</b></span>`).join('')}</div>${o||coOf(c,tid).length?`<div class="tr">${o?`<span class="who">${esc(o.name)}</span>`:''}${coHtml(c,tid)}</div>`:''}</div>
     </div>${perT(tid)}${(()=>{const U=uniqList(t);const own=c.gm||tid===c.seat||ownT(c,tid);/* 10-25 망령: 상대 트레이너의 고유는 좌석 화면에 안 보인다 (같은 편 · GM 만) */if(!c.gm&&!own){const mineT=myTrainers(c);if(!mineT.some(x=>window.OM_TEAM(c.b,x)===window.OM_TEAM(c.b,tid)))return ''}return U.length?`<div class="tuq">${U.map(x=>`<span class="pot sp uq" title="${esc(x.p.name)} — ${esc(String(x.p.eff||'').replace(/<br\s*\/?>/g,' ').slice(0,300))}"><em>고유</em><span class="potn">${esc(x.p.name)}</span>${x.max!=null?pips(x.left,x.max):''}${own?(x.left!==null&&x.left<=0?'<small class="dim">다 씀</small>':`<button class="btn xs pri" data-act="ufire" data-tid="${tid}" data-pot="${esc(x.p.name)}" title="고유 포텐셜 발동 — 대상 포켓몬을 고른다">발동</button>`):''}</span>`).join('')}</div>`:''})()}<div class="tbtns">${((c.gm||ownT(c,tid))&&mons.some(m=>m.entry))?`<button class="btn xs" data-act="fire" data-tid="${tid}" title="지령·명령 · 고유·전용 포텐셜 발동 창">포텐셜 발동</button>`:''}${(c.gm||ownT(c,tid))?`<button class="btn xs ghost" data-act="dexmgr" data-tid="${tid}" title="도감 · 데이터 해석">해석</button><button class="btn xs ghost ${myosuGlow(c,tid)?'pri':''}" data-act="skillp" data-tid="${tid}" title="「타임」 — 상대가 준비를 마치면 지시의 꼴(교대/기술)을 엿본다">묘수</button>`:''}${(c.gm||ownT(c,tid))?`<button class="btn xs ghost" data-act="orders" data-tid="${tid}" title="지령·명령 · 고유·전용 포텐셜 횟수 설정 · 빼기">설정</button>`:''}</div>
    <div class="bench">${mons.map(m=>benchCard(c,m)).join('')||'<div class="dim small">포켓몬 없음</div>'}</div></div>`}).join('');
  /* 10-21 망령: 폰에서 벤치 머리를 누르면 접는다 (접으면 트레이너별 남은 포켓몬 수만) */
  /* 10-22 망령: 동시 내밀기 켜기는 벤치 머리(「+ 파티」 옆)로. 내 트레이너만, 여럿이면 이름을 붙인다 */
  const simIds=ids.filter(tid=>trs[tid]&&(c.gm||ownT(c,tid)));
  const simTg=simIds.map(tid=>`<label class="btn xs ${simOn(b,tid)?'pri':'ghost'} simtg" title="켜면 ${esc(trs[tid].name||'')}은(는) 「등장」 대신 「내밀기 예약」 — 「시합 개시」·「내밀기 실행」 때 예약한 포켓몬이 양쪽 동시에 나온다. 내 것만 바뀐다"><input type="checkbox" data-act="simul" data-tid="${tid}" ${simOn(b,tid)?'checked':''}> 동시 내밀기${simIds.length>1?' · '+esc(String(trs[tid].name||'').slice(0,6)):''}</label>`).join('');
  const bfs=ids.map(tid=>{const ms=Object.values(b.mons||{}).filter(m=>m.tid===tid);return `${esc((trs[tid]||{}).name||'?')} ${ms.filter(m=>m.hp.cur>0).length}/${ms.length}`}).join(' · ');
  return `<div class="bcol ${side} ${(UIC.bfold||{})[side]?'fold':''}"><div class="shead" data-bfold="${side}"><i class="bfc" aria-hidden="true"></i><span class="sname">${SIDE_KO[side]} 벤치</span>${bfs?`<small class="bfs">${bfs}</small>`:''}${simSide(b,side)?(()=>{const P=pendCount(b,side);return `<span class="chip simpc ${P.need>0&&P.n>=P.need?'on':''}" title="동시 내밀기 예약">예약 ${P.n}/${P.need}</span>`})():''}<span class="sp"></span>${(()=>{/* 10-25 망령: 함께 지시는 「+ 파티」 왼쪽으로 — 아래 줄(필드 전개 · 동시 내밀기)이 두 줄로 넘치지 않게. 트레이너가 여럿이면 눌러서 고른다 */const co=ids.filter(tid=>coBtn(c,tid));return co.length===1?coBtn(c,co[0]).replace('>함께 지시</button>','>👥 함께</button>'):co.length>1?`<button class="btn xs ghost" data-act="copick" data-side="${side}" title="여러 플레이어가 한 트레이너의 지시 창 · 조작권을 함께 쓴다 — 트레이너를 고른다">👥 함께</button>`:''})()}${canLoad(c)?`<button class="btn xs" data-act="load" data-side="${side}" title="${c.mgr?'이 진영에 파티를 불러온다':'내 자리로 파티를 불러온다 (불러온 사람이 지시)'}">+ 파티</button>`:''}</div>${(()=>{
    /* 10-21 망령: 좌측 벤치 아래 줄 — 왼쪽 필드 전개, 오른쪽(+ 파티 밑) 동시 내밀기 · 내밀기 실행 */
    const fe=window.OM_STAGE_UI&&(c.mgr?ids.length:ids.some(t=>ownT(c,t)))?`<button class="btn xs" data-act="stagemgr" data-side="${side}" title="${c.mgr?'트레이너 · 포켓몬이 각자 가진':'내 트레이너 · 포켓몬의'} 필드 · 스타디움 · 이계를 펼친다">필드 전개</button>`:'';
    const cos='';   /* 함께 지시는 머리 줄 「+ 파티」 왼쪽으로 옮겼다 (10-25) */   /* 10-24 망령: 함께 지시 · 필드 전개도 이 줄 왼쪽으로 (벤치 맨 아래에 있으면 밀려 안 보였다) */
    const sm=simTg;   /* 10-25 망령: 동시 내밀기는 제목줄 대신 이 줄 오른쪽(+ 파티 밑 빈 곳) — 제목줄에 두면 「+ 파티」가 밀려 칸이 하나 더 생겼다 */
    if(multi)return '';   /* 여럿이면 각 트레이너 칸에 (perT) */
    const spb=window.OM_SP_UI&&window.OM_SP_UI.canOpen(side,'')?`<button class="btn xs spbtn" data-act="spmgr" data-side="${side}" title="SP (서포터) — 밖에서 돕는 조력자의 한 수">SP</button>`:'';   /* 10-25 망령: SP(서포터) — 필드 전개 옆 */
    const cb=ids.length===1?cardBtn(c,ids[0]):'';const sb=ids.length===1&&stxOk(c,ids[0])&&window.OM_STATUS_UI?`<button class="btn xs ghost" data-act="stx" data-tid="${ids[0]}" title="PT 요약 — 포켓몬 · 소지품 착용 · 소지품 소켓">요약</button>`:'';return sm||cb||sb?`<div class="shead2">${cb}${sb}<span class="sp"></span>${sm}</div>`:''})()}${items||'<div class="aempty small">트레이너 없음'+(canLoad(c)?` — <button class="btn xs pri" data-act="load" data-side="${side}">+ 파티 불러오기</button>`:' — 진행하는 사람이 파티를 불러온다')+'</div>'}${sidePanel(c,side,ready)}</div>`}
 /* 벤치 아래 빈 곳: 그 진영이 입력해 둔 지시 현황. 내 트레이너(GM 은 볼 수 있는 것 전부)는 편집 중인 지시를, 남의 것은 공개된 만큼만 */
 function cardBtn(c,tid){const D=window.OM_DECK_UI;if(!D||!D.handCount)return '';const own=c.gm||tid===c.seat||ownT(c,tid);if(!own)return '';const n=D.handCount(tid);const t=((c.b.trainers||{})[tid])||{};
  return `<button class="btn xs ghost cardtg ${n?'':'empty'}" data-act="cards" data-tid="${tid}" title="손패에서 카드를 쓴다 · 무덤(버린 카드)에서 되돌리기도 여기서">🃏 카드 <b>${n}</b></button>`}
 function sidePanel(c,side,ready){const b=c.b;const trs=b.trainers||{};const ids=(((b.sides||{})[side]||{}).trainers||[]).filter(t=>trs[t]);if(!ids.length)return '';
  const mine=myTrainers(c);const ph=+b.phase||0;
  const blocks=ids.map(tid=>{const t=trs[tid];const mons=Object.values(b.mons||{}).filter(m=>m.tid===tid&&m.entry&&m.hp.cur>0).sort((x,y)=>x.entry.localeCompare(y.entry));
   const rd=!!ready[tid];const pub=(b.cmds||{})[tid];const own=mine.includes(tid);const cur=own?cmdNow(tid,b):null;
   const tag=pub?'<span class="tag ok">공개됨</span>':rd?'<span class="tag ok">READY</span>':'<span class="tag">입력 중</span>';
   const row=m=>{let body;
    if(own&&cur){const xx=(cur.mons||{})[m.id]||{};const pre=[xx.order?OO().orderName(t,xx.order):'',xx.command?OO().commandName(t,xx.command):''].filter(Boolean);
     let act;if(xx.move==='switch')act=`<b>교대</b> → ${esc(monName(b,xx.switch)||'?')}`;else if(xx.move===''||xx.move==null)act='<span class="warn">행동 없음</span>';else{const mv=MVS(m)[+xx.move];act=`<b>${mv?esc(mv.name):'?'}</b>${mv?typeChip(mv.typeEn):''}${(xx.targets||[]).length?`<span class="bct">→ ${xx.targets.map(sl=>esc(slotName(b,sl))).join(', ')}</span>`:'<span class="warn"> 대상 없음</span>'}`}
     body=`<div class="bca">${act}</div>${pre.length||(xx.pots||[]).length?`<div class="bcp">${pre.map(n=>`<span class="rk up">선행 『${esc(n)}』</span>`).join('')}${(xx.pots||[]).map(n=>`<span class="rk fxc">『${esc(n)}』</span>`).join('')}</div>`:''}`}
    else if(pub&&pub.mons&&pub.mons[m.id])body=`<div class="bca">${cmdOf(b,m)}</div>`;
    else body=`<div class="bca dim">${rd?'입력 완료 · 비공개':'입력 중'}</div>`;
    return `<div class="bc"><span class="bop" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}"></span><div class="bcb"><div class="bcn"><i>${String(m.entry).toUpperCase()}</i>${esc(m.name)}</div>${body}</div></div>`};
   const up=own&&cur&&(cur.upots||[]).length?`<div class="bcp bcu">${cur.upots.map(n=>`<span class="rk fxc">고유 『${esc(n)}』</span>`).join('')}</div>`:'';
   /* 10-21 망령: A·B(·C) 칸은 늘 같은 자리에 (비거나 쓰러져도 줄이 빠져서 밀리지 않게). 같은 진영의 다른 트레이너가 쓰는 칸만 뺀다 */
   const ent=entered(b,side);const slotsT=AREAS.slice(0,mode(b)).filter(a=>!ent[a]||ent[a].tid===tid||ids.length===1);
   const rows=slotsT.map(a=>{const m=mons.find(x=>x.entry===a);return m?row(m):`<div class="bc empty"><span class="bop"></span><div class="bcb"><div class="bcn"><i>${a.toUpperCase()}</i>빈 자리</div><div class="bca dim">—</div></div></div>`});
   return `<div class="bct1"><div class="bth"><b>${esc(t.name)}</b><span class="sp"></span>${tag}</div>${rows.join('')}${up}</div>`}).join('');
  /* 폰: 벤치와 배틀 칸 사이를 밀어내지 않게 접어 두고 요약만 (열고 닫은 건 기억) */
  const ph1=window.matchMedia&&matchMedia('(max-width:760px)').matches;UIC.bside=UIC.bside||{};const open=!ph1||UIC.bside[side];
  const sum=ids.map(tid=>`${esc(trs[tid].name)} ${(b.cmds||{})[tid]?'공개됨':ready[tid]?'READY':'입력 중'}`).join(' · ');
  return `<details class="bside" data-bside="${side}" ${open?'open':''}><summary class="bsh"><span>지시 현황</span><small class="bsum">${sum}</small><span class="sp"></span><b>TURN ${+b.turn||0}</b></summary>${blocks}</details>`}
 /* 10-21 망령: 날씨 · 필드 · 룸 · 《필드》 그림을 배틀맵 뒤에 반투명하게 깐다 (맵툴 Lib:field 0.75 · Lib:field_object 0.5 처럼) */
 const fbgUrl=k=>{if(!k)return '';let u=`img/fieldbg/${k}.webp?v=2`;try{u=new URL(u,location.href).href}catch(e){}return `url('${cssu(u)}')`};
 function fieldBg(f){f=f||{};const w=(f.weather||{}).type,t=(f.terrain||{}).type;const cls=[],st=[];
  const ss=window.OM_STAGE_UI?window.OM_STAGE_UI.bgStyle(f):'';const m=ss.match(/style="([^"]*)"/);if(m)st.push(m[1]);
  const low=[...ROOMS.filter(r=>(f.rooms||{})[r]>0),...ETC.filter(r=>(f.etc||{})[r]>0),t].filter(Boolean).map(k=>fbgUrl(T_IMG[k])).filter(Boolean);
  if(w&&W_IMG[w]){cls.push('fbw','w-'+W_IMG[w]);st.push(`--fbw:${fbgUrl(W_IMG[w])}`)}
  if(low.length){cls.push('fbt');st.push(`--fbt:${low.join(',')}`)}
  if(cls.length)cls.push('fxbg');return {cls:cls.join(' '),st:st.join(';')}}
 function fieldStrip(c,f){const w=f.weather.type,t=f.terrain.type;
  const ic=(name,label,cnt,kind)=>{const im=fimg(name);return `<div class="fic ${kind}" title="${esc(label)}">${im?`<img src="${esc(im)}" alt="">`:'<span class="fnoimg"></span>'}<span><small>${({w:'날씨',t:'필드',r:'룸',e:'필드의 상태'})[kind]||''}</small><b>${esc(label)}</b>${cnt?`<em>${cnt>=1000?'∞':cnt+'T'}</em>`:''}</span></div>`};
  const mid=[w?ic(W_IMG[w],w,f.weather.count,'w'):'',t?ic(T_IMG[t],t,f.terrain.count,'t'):'',...ROOMS.filter(r=>(f.rooms||{})[r]>0).map(r=>ic(T_IMG[r],r,f.rooms[r],'r')),...ETC.filter(r=>(f.etc||{})[r]>0).map(r=>ic(T_IMG[r],r,f.etc[r],'e'))].filter(Boolean).join('');
  const objs=side=>{const o=(f.objects||{})[side]||{};const by={};for(const k in o){if(!(o[k]>0))continue;const cat=objCat(k)[0];(by[cat]=by[cat]||[]).push(`<span class="obj ${cat}" title="${esc(objCat(k)[1])}">${esc(k)}${o[k]>=1000?'':` <b>${k==='압정뿌리기'||k==='독압정'?o[k]+'겹':o[k]+'T'}</b>`}</span>`)}
   return OBJ_CAT.filter(cc=>by[cc[0]]).map(cc=>`<span class="ocat"><i>${esc(cc[1])}</i>${by[cc[0]].join('')}</span>`).join('')};
  const gmc=c.mgr?' clickable':'';
  return `<div class="fstrip"><div class="fobjs lft${gmc}" ${c.mgr?'data-act="objects" data-side="left" title="눌러서 좌측 설치기 놓기"':''}><span class="olab left">좌측 설치물</span>${objs('left')||'<span class="dim small">없음</span>'}${c.mgr?'<span class="fplus">＋</span>':''}</div><div class="fmid${gmc}" ${c.mgr?'data-act="field" title="눌러서 날씨·필드·룸·필드의 상태"':''}>${mid||'<span class="dim small">날씨·필드 없음'+(c.mgr?' — 눌러서 설정':'')+'</span>'}</div><div class="fobjs rgt${gmc}" ${c.mgr?'data-act="objects" data-side="right" title="눌러서 우측 설치기 놓기"':''}>${c.mgr?'<span class="fplus">＋</span>':''}${objs('right')||'<span class="dim small">없음</span>'}<span class="olab right">우측 설치물</span></div></div>`}
 function sideBox(c,side,ready){
  const b=c.b;const ids=((b.sides||{})[side]||{}).trainers||[];const trs=b.trainers||{};const seats=c.ST.state.seats||{};
  const ent=entered(b,side);
  const areas=AREAS.slice(0,mode(b)).map(a=>{const m=ent[a];const slot=slotOf(side,a);
   return `<div class="area ${m?'':'empty'}" data-slot="${slot}"><div class="alab">${a.toUpperCase()}</div>${m?bigCard(c,m,slot):`<div class="aempty">빈 자리${c.mgr||ids.includes(c.seat)?'<br><span class="small">벤치에서 「등장」</span>':''}</div>`}</div>`}).join('');
  const bench=ids.map(tid=>{const t=trs[tid]||{name:'?',ranks:{}};const o=seats[tid];const mons=Object.values(b.mons||{}).filter(m=>m.tid===tid).sort((x,y)=>(x.slot||0)-(y.slot||0));
   const cmdDone=!!(b.cmds||{})[tid];const rd=!!ready[tid];
   return `<div class="trainer"><div class="tpic" style="${t.image?`background-image:url('${cssu(t.image)}')`:''}"></div><div class="tinfo"><div class="tn">${esc(t.name)}${tid===c.seat?' <span class="tag me">ME</span>':ownT(c,tid)?' <span class="tag me co" title="함께 지시하는 트레이너">함께</span>':''}${rd?' <span class="tag ok">READY</span>':cmdDone?' <span class="tag">공개됨</span>':''}</div>
     <div class="tr">${['지시','육성','통솔','능력'].map(k=>`${k} <b>${esc(t.ranks[k]||'-')}</b>`).join(' · ')} · ${o?`<span class="who">${esc(o.name)}</span>`:'<span class="dim">빈 자리</span>'}${coHtml(c,tid)}</div></div>
     ${c.mgr?`<button class="btn xs ghost" data-act="orders" data-tid="${tid}" title="포텐셜 설정 · 지령·명령 · 고유·전용 횟수">설정</button><button class="btn xs ghost danger" data-act="unload" data-tid="${tid}">빼기</button>`:''}</div>
    <div class="bench">${mons.map(m=>benchCard(c,m)).join('')||'<div class="dim small">포켓몬 없음</div>'}</div>`}).join('');
  return `<div class="sideBox ${side}"><div class="shead"><span class="sname">${SIDE_KO[side]}</span><span class="sp"></span>${canLoad(c)?`<button class="btn xs" data-act="load" data-side="${side}">+ 파티</button>`:''}</div>
   <div class="areas">${areas}</div>${bench||'<div class="aempty">트레이너 없음</div>'}</div>`}

 /* HP 막대: 지난번 값에서 새 값으로 줄어들고(늘고), 빨간 잔상이 뒤따라온다 */
 const HPPREV=new Map();let hpQ=0;
 /* ---------- 11-03 감우 (검토 6 · 7): 로그를 보고 카드 연출. rp_ui autoSe 가 로그마다 한 번 부른다 (소리 설정이 꺼져 있어도 연출은 나온다) ----------
    · 【피해】(data.hp.cur < prev): 대상 카드(필드 큰 카드 · 벤치) .hit 0.5s 흔들림, 급소면 .crit 붉은 플래시, 빈사면 .ko 0.8s 회색으로 가라앉음
    · 턴 종료 카드(data.seq = [{mid,name,prev,cur,max}] 순서대로): 상태 쓰기는 한 번(om_jset_many)이고, 받는 화면마다 항목을 0.4s 간격으로 HP 바 갱신 + dmg/heal 효과음.
      그 사이 다시 그려져도 hpBar 가 FXS.hold(아직 안 보여 준 prev 값)를 본다 */
 const FXS={hold:{},pend:{}};   /* pend[mid] = {cls:{hit:until,…}} — 연출 중에 다시 그려져도 render 끝에 reflash 가 되붙인다 (로그가 상태 신호보다 먼저 올 때가 있다) */
 const pctOf=(cur,max)=>cur>0?Math.max(1,Math.round(cur/(max||1)*100)):0;
 function cardsOf(mid){return [...document.querySelectorAll(`#scene .mon[data-mon="${CSS&&CSS.escape?CSS.escape(String(mid)):String(mid)}"]`)]}
 function flash(mid,cls,ms){const P=FXS.pend[mid]=FXS.pend[mid]||{};P[cls]=Date.now()+ms;for(const el of cardsOf(mid)){el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls)}setTimeout(()=>{if(FXS.pend[mid])delete FXS.pend[mid][cls];for(const el of cardsOf(mid))el.classList.remove(cls)},ms)}
 function reflash(){const now=Date.now();for(const mid in FXS.pend){const P=FXS.pend[mid];for(const cls in P){if(P[cls]<=now){delete P[cls];continue}for(const el of cardsOf(mid))el.classList.add(cls)}if(!Object.keys(P).length)delete FXS.pend[mid]}}
 function setBar(mid,pct){for(const el of cardsOf(mid)){const bar=el.querySelector('.hpbar');if(!bar)continue;bar.removeAttribute('data-to');const i=bar.querySelector('i'),g=bar.querySelector('.ghost');if(i)i.style.width=pct+'%';if(g)g.style.width=pct+'%';bar.classList.toggle('low',pct<=25);bar.classList.toggle('mid',pct>25&&pct<=50)}}
 function seqFx(seq){const L=(seq||[]).filter(x=>x&&x.mid&&+x.prev!==+x.cur);if(!L.length)return;for(const x of L)FXS.hold[x.mid]=pctOf(+x.prev,+x.max);for(const x of L)setBar(x.mid,FXS.hold[x.mid]);
  L.forEach((x,i)=>setTimeout(()=>{delete FXS.hold[x.mid];const dn=+x.cur<+x.prev;setBar(x.mid,pctOf(+x.cur,+x.max));flash(x.mid,dn?'hit':'heal',500);if(dn&&+x.cur<=0)setTimeout(()=>flash(x.mid,'ko',800),250);try{if(CUT()&&CUT().synth)CUT().synth(dn?'dmg':'heal')}catch(e){}},i*400));
  setTimeout(()=>{for(const x of L)delete FXS.hold[x.mid]},L.length*400+150)}
 function logFx(row){try{if(!row||row.kind!=='battle'||!row.data)return;if(row.at&&Date.now()-new Date(row.at).getTime()>15000)return;const d=row.data;const t=String(d.t||'');
  if(Array.isArray(d.seq)&&d.seq.length)return seqFx(d.seq);
  const h=d.hp;if(h&&d.mid&&+h.cur<+h.prev){flash(d.mid,'hit',500);if(/급소/.test(String(h.why||'')))flash(d.mid,'crit',500);if(h.faint||+h.cur<=0)setTimeout(()=>flash(d.mid,'ko',800),300);return}
  if(h&&d.mid&&+h.cur>+h.prev)return flash(d.mid,'heal',500);
  if(d.mid&&/빈사!|쓰러졌다!/.test(t))flash(d.mid,'ko',800)}catch(e){}}
 function hpAnim(){hpQ=0;const L=[...document.querySelectorAll('.hpbar[data-to]')];if(!L.length)return;requestAnimationFrame(()=>requestAnimationFrame(()=>{for(const e of L){const to=e.dataset.to;e.removeAttribute('data-to');const i=e.querySelector('i'),g=e.querySelector('.ghost');if(i)i.style.width=to+'%';if(g)g.style.width=to+'%'}}))}
 function hpBar(m,full){const hp=m.hp||{max:1,cur:1};const pct0=Math.max(0,Math.min(100,(hp.cur>0?Math.max(1,Math.round(hp.cur/hp.max*100)):0)));const key=m.id||'';const held=FXS.hold[key];const pct=held!=null?held:pct0;const cls=pct<=25?'low':pct<=50?'mid':'';   /* 11-03: 턴 종료 순차 연출 중이면 아직 안 보여 준 값(prev)으로 */
  const prev=HPPREV.has(key)?HPPREV.get(key):pct;HPPREV.set(key,pct0);const mv=held==null&&prev!==pct&&key;if(mv&&!hpQ)hpQ=setTimeout(hpAnim,0);
  return `<div class="hpbar ${cls}" ${mv?`data-to="${pct}"`:''}><span class="ghost" style="width:${mv?Math.max(prev,pct):pct}%"></span><i style="width:${mv?prev:pct}%"></i></div><div class="hpnum">${full?`${hp.cur} <span class="dim">/ ${hp.max}</span>`:pct+'%'}</div>`}
 function rankChips(m){const r=m.rank||{};const out=[];for(const k of ['attack','defense','specialattack','specialdefense','speed','accuracy','evasion','critical']){const v=+r[k]||0;if(v)out.push(`<span class="rk ${v>0?'up':'dn'}">${STAT_KO[k]}${v>0?'+':''}${v}</span>`)}
  const md=m.mod||{};for(const k in md){const v=+md[k];if(v&&v!==1)out.push(`<span class="rk ${v>1?'up':'dn'}">${STAT_KO[k]||k}×${v}</span>`)}return out.join('')}
 const FLAG_KO={endure:'버텨라!',surehit:'맞춰라!',dodgePhys:'물러나!',dodgeSpec:'피해라!',swap:'바꿔라!',return:'돌아와!',hitPhys:'지킬 수 없다!',hitSpec:'피할 수 없다!',noEndure:'버틸 수 없다!',acc0:'맞출 수 없다!',dodgeOnce:'주인의 칙령',nullify:'파계',rebirth:'윤회의 법계',protect:'기술 방어'};
 function flagChips(m){return Object.keys(m.flags||{}).filter(k=>m.flags[k]&&FLAG_KO[k]&&(k!=='protect'||m.flags[k]===(+ctx().b.turn||0))).map(k=>`<span class="rk flag">${esc(FLAG_KO[k]||k)}</span>`).join('')+(m.prioDown?'<span class="rk flag" title="아이스번 — 다음 기술 우선도 −1">우선도 −1</span>':'')}
 function stateChips(m){const st=m.states||{};const db=(DB().states||{}).st||{};return Object.keys(st).filter(k=>st[k]).map(k=>{const im=simg(k);return `<span class="stc ${db[k]&&db[k].abn?'abn':''}" data-stinfo="${esc(k)}" title="${esc((db[k]&&db[k].desc||[]).join(' '))}">${im?`<img src="${esc(im)}" alt="">`:''}${esc(db[k]?db[k].ko:k)}${+st[k]>1&&+st[k]<1000?' '+st[k]:''}</span>`}).join('')}
 function bigCard(c,m,slot){const full=canEdit(c,m);const cmd=cmdOf(c.b,m);
  /* 11-03 감우 (검토 8): 행동 순서의 지금 차례(orderIdx)인 카드는 노란 테두리(.now) + 「공격」 pri, 그 상대편 카드는 「피격 대기」 톤(.wait) */
  const ph=+c.b.phase||0;const o=(c.b.order||[])[+c.b.orderIdx||0];const nowM=ph>=2&&ph<5&&o?(c.b.mons||{})[o.mid]:null;const isNow=!!(nowM&&nowM.id===m.id&&m.hp.cur>0);const isWait=!!(nowM&&!isNow&&ph===3&&m.hp.cur>0&&!sameT(nowM,m,c.b));
  return `<div class="mon big ${m.hp.cur<=0?'fainted':''} ${isNow?'now':isWait?'wait':''}" data-mon="${m.id}"><div class="pic" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}"></div>
   <div class="minfo"><div class="nm">${isNow?'<span class="nowtag" title="행동 순서의 지금 차례">▶ 차례</span>':isWait?'<span class="waittag" title="지금 차례의 상대편 — 공격을 받을 수 있다">피격 대기</span>':''}<span class="nmt">${esc(m.name)}</span><span class="lv">Lv.${m.lv}</span><span class="nmb">${((!full&&c.seat)||c.gm)?`<button class="btn xs ghost dexb" data-act="dex" data-mid="${m.id}" title="도감 정보 · 해석">도감</button>`:''}${full&&mode(c.b)>=2&&m.hp.cur>0?`<button class="btn xs ghost dexb" data-act="areaswap" data-mid="${m.id}" title="같은 편 다른 에리어와 자리 바꾸기 (사이드체인지 등)">⇄ 에리어</button>`:''}${(!full&&c.seat&&!sameT(c.seat,m,c.b)&&(+c.b.phase||0)===0)||c.gm&&!full?`<button class="btn xs ghost dexb" data-act="time" data-mid="${m.id}" title="「타임」 — 상대 지시의 꼴 엿보기">타임</button>`:''}</span></div><div class="ty">${tyHtml(c,m)}${m.teraActive?`<span class="rk up">테라 ${esc(m.tera)}</span>`:''}</div>
   ${hpBar(m,full)}<div class="rks">${rankChips(m)}${stateChips(m)}${flagChips(m)}${FX()?FX().chips(m).map(ch=>`<span class="rk fxc ${full?'rm':''}" title="${esc(ch.title)}${full?' — 눌러서 해제':''}" ${full?`data-act="fxoff" data-mid="${m.id}" data-fx="${esc(ch.id)}" data-nm="${esc(ch.name)}"`:''}>${esc(ch.t)}${full?' ✕':''}</span>`).join(''):''}</div>
   ${cmd?`<div class="cmdcard">${cmd}</div>`:(((+c.b.phase||0)>=2&&full&&m.hp.cur>0&&turnReached(c.b,m))?`<div class="revealrow"><button class="btn sm pri" data-act="revealmon" data-tid="${m.tid}" data-mid="${m.id}">지시 공개 (에리어 ${String(m.entry).toUpperCase()})</button></div>`:'')}
   ${potLine(c,m)}
   ${m.lastHit&&full?(()=>{const h=m.lastHit,tip=`피해 판정 받음 · ${h.from}의 「${h.move}」 ${h.total}×${h.eff}${h.crit?' 급소':''} ≈ ${h.expect} — 「적용」을 누르면 HP 창에서 내 쪽 완화까지 넣어 반영`;   /* 11-02 망령 「피해 적용이 카드를 왕창 늘린다」: 세 줄 상자 → 한 줄(자세한 건 마우스를 올리면) */
     return `<div class="incoming" title="${esc(tip)}"><b>피격</b><span class="incd">「${esc(h.move)}」${h.crit?' <em>급소</em>':''}</span><span class="incn">≈ ${esc(String(h.expect))}</span><button class="btn xs pri" data-act="hp" data-mid="${m.id}" title="${esc(tip)}">적용</button></div>`})():''}
   <div class="mbtns">${full?`<button class="btn xs ${isNow?'pri':''}" data-act="attack" data-mid="${m.id}">공격</button><button class="btn xs ${m.lastHit?'pri':''}" data-act="hp" data-mid="${m.id}">HP</button><button class="btn xs mmore" type="button" data-mmore aria-label="버튼 더 보기" aria-expanded="false">⋯</button><button class="btn xs mx" data-act="pots" data-mid="${m.id}" title="포텐셜 목록 · 출력 · 발동 · 해제">포텐셜</button><button class="btn xs mx" data-act="edit" data-mid="${m.id}">랭크·상태</button><span class="exg"><button class="btn xs ghost mx exit1" data-act="exit" data-mid="${m.id}" title="바로 퇴장 (랭크·배율·효과 정리)">퇴장</button><button class="btn xs ghost mx exdn" data-act="exitx" data-mid="${m.id}" title="퇴장(특수) — 배턴터치 퇴장 · 강제 교대">(특수)</button></span>`:''}</div>${full&&(formsOf(m).length||m.form0||hasTera(m))?`<div class="mbtns mbtns2"><button class="btn xs mx ${m.form0||teraOn(m)?'pri':''}" data-act="form" data-mid="${m.id}" title="폼체인지 · 메가진화 · 테라스탈 · 원래대로">${m.form0?'✦ '+esc(((m.forms||[])[m.formIdx]||{}).kind||'폼'):teraOn(m)?'◆ 테라 '+esc(m.tera||''):formsOf(m).length?'✦ 폼':'◆ 테라'}</button></div>`:''}</div></div>`}   /* 11-03 21:15 망령 「폼체인지나 메가 … 평소에 안 쓰는 버튼은 아래 줄 하나 더」 · 21:17 「(특수)는 냅둬」: 폼 · 메가 · 테라만 둘째 줄(.mbtns2), 있을 때만 */
 /* 비공개: 아직 한 번도 나오지 않은 상대 포켓몬은 이름·그림·타입을 숨긴다 (맵툴 「비공개」 토큰) */
 function secret(c,m){if((c.gm&&!c.fair)||!m)return false;if(m.seen||m.entry||c.b.pvp)return false;   /* 11-03 PVP 설정: 비공개 벤치도 연다 */if(c.gm){if(canEdit(c,m))return false;const v=gmEyes(c,m);const t=(c.b.trainers||{})[v];return !t||!sameT(v,m,c.b)}const mt=myTrainers(c)[0];const my=(c.b.trainers||{})[mt];return !my||!sameT(mt,m,c.b)}
 function benchCard(c,m){const full=canEdit(c,m);const out=!!m.entry;const sec=secret(c,m);
  if(sec)return `<div class="mon small secret"><div class="btop"><div class="pic"></div><div class="nm">비공개</div></div><div class="hpbar"><i style="width:100%"></i></div><div class="hpnum">?</div></div>`;
  return `<div class="mon small ${m.hp.cur<=0?'fainted':''} ${out?'onfield':''}" data-mon="${m.id}">
   <div class="btop"><div class="pic" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}"></div><div class="nm" title="${esc(m.name)}${dexSees(c,m,'type')?' · '+esc(m.types.filter(t=>t!=='-').map(t=>S().typeKo(t)).join('/')):''}">${esc(m.name)}${out?` <span class="tag">${m.entry.toUpperCase()}</span>`:''}</div></div><div class="ty">${tyHtml(c,m)}</div>${hpBar(m,full)}
   ${!out&&full&&m.hp.cur>0?(simOn(c.b,m.tid)&&((+c.b.phase||0)<2||m.pend)?`<button class="btn xs ${m.pend?'pri':''}" data-act="pend" data-mid="${m.id}">${m.pend?'예약 '+String(m.pend).toUpperCase()+' ✓':'내밀기 예약'}</button>`:`<button class="btn xs" data-act="enter" data-mid="${m.id}">등장</button>`):''}${!out&&full&&m.hp.cur<=0?`<button class="btn xs ghost" data-act="edit" data-mid="${m.id}" title="잘못 쓰러진 포켓몬의 HP 를 되돌린다 (랭크·상태 창의 HP 칸)">HP 되돌리기</button>`:''}</div>`}

 /* 【N/시】 포텐셜 횟수. potUses[name] = 남은 횟수 */
 /* 포켓몬이 쓸 수 있는 포텐셜 전부: 20칸 + 전용 + 트레이너의 고유 */
 function uniqOf(m){const b=ctx().b;const t=(b.trainers||{})[m.tid];return ((t&&t.unique)||[]).filter(u=>u&&u.name).map(u=>Object.assign({kind:'고유',unique:true},u))}
 /* 지시 칸의 포텐셜 선언 칩: 고유(트레이너) · 전용 · 일반, 남은 횟수와 함께 */
 function potDecl(c,m,x,grp){const u=m.potUses||{};const chips=potSrc(m).filter(p=>{const sp=isExcl(m,p);return grp==='sp'?sp:grp==='norm'?!sp:true}).map(p=>{const kind=isExcl(m,p)?'전용':'';const mxm=String(p.eff||'').match(/【(\d+)\/시】/);const pmax=p.max!=null?p.max:(mxm?+mxm[1]:null);const left=pmax!=null?(u[p.name]==null?pmax:+u[p.name]):null;p={...p,max:pmax};const on=(x.pots||[]).includes(p.name);return `<div class="oc ${on?'mine':''} ${left!==null&&left<=0?'dis':''}" data-pdecl="${esc(p.name)}" title="${esc(String(p.eff||'').replace(/<br\s*\/?>/g,' '))}"><b>${kind?'['+esc(kind)+'] ':''}${esc(p.name)}</b>${left!==null?`<small>${pips(left,p.max)}</small>`:'<small>횟수 없음</small>'}</div>`});return chips.join('')||`<span class="dim small">${grp==='sp'?'전용 포텐셜이 없다':'선행 입력할 포텐셜이 없다'}</span>`}
 /* 고유(트레이너) · 전용 포텐셜: 지시 선언 · 카드 · 4식 6령 창에서 따로 묶어 보인다 */
 const isExcl=(m,p)=>(m.excl&&m.excl.name===p.name)||(m.exclX||[]).some(q=>q.name===p.name);
 /* 10-26 망령: 사용 제한 — 【N/시】 = 시합 중 N번(uses), 【소진】 = 1턴에 1번, 【탈진】 = 연속된 턴에는 못 쓴다 (발동 후 다음 턴 끝까지). 턴 제한은 쓴 턴을 적어 둔다(turns) */
 function limOf(p,uses,turns){const e=String(p.eff||'');const mm=e.match(/【(\d+)\/시】/);const mmax=mm?+mm[1]:null;const ml=mmax==null?null:(uses[p.name]==null?mmax:+uses[p.name]);
  const per=/【\s*소진\s*】/.test(e)?'turn':/【\s*탈진\s*】/.test(e)?'tal':'';const T=+((ctx().b||{}).turn)||0;const ut=turns[p.name];
  const tl=!per?null:(ut==null?1:per==='turn'?(+ut===T?0:1):(T-(+ut)<=1?0:1));
  const max=mmax!=null?mmax:per?1:null;const left=ml==null&&tl==null?null:Math.min(ml==null?Infinity:ml,tl==null?Infinity:tl);return {max,left,mmax,per}}
 function specialPots(m){const u=m.potUses||{};return potSrc(m).filter(p=>isExcl(m,p)).map(p=>{const L=limOf(p,u,m.potTurn||{});const max=L.max,left=L.left;const a=FX()&&FX().autoOf(m,'pot',p.name);return {p,kind:p.unique?'고유':'전용',max,left,mmax:L.mmax,per:L.per,auto:!!(a&&a.ops&&a.ops.length&&!a.manual)}})}
 /* 11-03 21:36 망령 「일반 포텐셜도 【탈진】 · 【소진】을 세자 — 칸 길이는 그대로」: 쓴 턴을 potTurn 에 적고(손으로 누른 발동 · 사용만), 못 쓰는 턴엔 발동 자리에 같은 크기의 「탈진」 · 「소진」 칩 */
 function potRest(m,name){const p=potSrc(m).find(q=>q&&q.name===name);if(!p||isExcl(m,p))return null;const e=String(p.eff||'');const per=/【\s*소진\s*】/.test(e)?'turn':/【\s*탈진\s*】/.test(e)?'tal':'';if(!per)return null;
  const T=+((ctx().b||{}).turn)||0;const ut=(m.potTurn||{})[name];if(ut==null)return null;const no=per==='turn'?+ut===T:T-(+ut)<=1;if(!no)return null;
  return {lab:per==='turn'?'소진':'탈진',title:per==='turn'?`${ut}턴에 썼다 — 이번 턴엔 다시 못 쓴다 (【소진】)`:`${ut}턴에 썼다 — 다음 턴 끝까지 못 쓴다 (【탈진】)`}}
 const restChip=r=>`<span class="btn xs potrest" title="${esc(r.title)}">${r.lab}</span>`;
 async function potMark(mid,name){const m=(ctx().b.mons||{})[mid];if(!m)return;const p=potSrc(m).find(q=>q&&q.name===name);if(!p||isExcl(m,p))return;if(!/【\s*(소진|탈진)\s*】/.test(String(p.eff||'')))return;await A().set(['battle','mons',mid,'potTurn',name],+ctx().b.turn||0)}
 function spBtn(m,s){const n=esc(s.p.name);if(s.left!==null&&s.left<=0)return '<span class="small dim">다 씀</span>';
  if(s.auto)return `<button class="btn xs pri" data-act="fireauto" data-mid="${m.id}" data-kind="pot" data-pot="${n}" title="자동화 효과를 건다${s.max!=null?' (횟수 1 사용)':''}">발동</button>`;
  if(s.max!=null)return `<button class="btn xs pri" data-act="usepot" data-mid="${m.id}" data-pot="${n}" title="횟수 1을 쓰고 로그에 출력">사용</button>`;
  return `<button class="btn xs" data-act="announce" data-mid="${m.id}" data-kind="pot" data-pot="${n}" title="효과를 로그에 출력">📢 발동</button>`}
 function pips(left,max){if(max==null)return '';left=Math.max(0,+left||0);max=+max||0;if(max>8||max<1)return `남은 ${left}/${max}`;return `<span class="pips" title="남은 ${left}/${max}">${'●'.repeat(Math.min(left,max))}${'○'.repeat(Math.max(0,max-left))}</span>`}
 /* 10-23 망령: 4식 6령 불가 — 시트 체크(올드 타입은 기본), 「난동부리기」·반무적(공중·땅속·물속 …) 상태 */
 function noOrdWhy(m){if(!m)return '';const why=[];const old=(m.pots||[]).some(p=>p&&/분류/.test(p.kind||'')&&String(p.name||'').trim()==='올드 타입');if(m.noOrd!=null?m.noOrd:old)why.push(m.noOrd==null?'올드 타입':'시트 체크');
  const st=m.states||{};const db=(DB().states||{}).st||{};const semi=(((DB().states||{}).groups||[]).find(g=>g.l==='반무적')||{}).s||['VanishToDark','VanishToHole','Fly','VanishToWater','VanishToFire','VanishToMeteor','VanishToSun'];
  for(const k of ['Thrash','Recharge',...semi])if(st[k])why.push((db[k]||{}).ko||k);return why.join(' · ')}
 const NOORD_W={},THR_PICK={};
 function potSrc(m){return [...(m.pots||[]).filter(p=>p&&!p.ph&&p.name),...(m.excl?[m.excl]:[]),...(m.exclX||[])]}
 /* 10-28 망령: 미사그 대학 (4+2) 각성체 대가 — 제작기 「각성체 대가」의 통솔 항목으로 포텐셜 발동을 막는다. 항목 이름 B-2 · A-1 · A-2 로 판정
    B-2 지정 역할의 역할 포텐셜 · A-1 필드 위 다른 아군 중 지정 타입이 없으면 각성 (대가) 포켓몬의 포텐셜 · A-2 각성 (대가)가 필드에 있으면 다른 아군의 역할 포텐셜. 막은 이유를 돌려준다 */
 function misagBlock(b,m,name){const t=((b&&b.trainers)||{})[m&&m.tid];const M=t&&t.misag;if(!M||!Array.isArray(M.items)||!M.items.length)return '';
  const nm=x=>String(x||'').replace(/『|』/g,'').trim();const pot=potSrc(m).find(p=>nm(p.name)===nm(name));if(!pot)return '';
  const keys=M.items.map(x=>x.key);const isRole=/역할/.test(String(pot.kind||''));const onF=x=>!!(x&&x.entry&&x.hp&&x.hp.cur>0);
  const mates=Object.values(b.mons||{}).filter(x=>x&&x.tid===m.tid);const aw=mates.find(x=>x.awaken==='free');
  const hasType=(x,ko)=>{const en=window.OM_STATS&&window.OM_STATS.typeEn?window.OM_STATS.typeEn(ko):ko;if(teraOn(x))return x.teraEn===en;return (x.types||[]).includes(en)||(x.typesKo||[]).includes(ko)};   /* 테라스탈이면 타입 4 만 (11-02) */
  if(keys.includes('B-2')&&isRole&&M.role&&(String(m.role||'')===M.role||nm(pot.name).includes(M.role)))return `각성체 대가 B-2 — 역할 「${M.role}」은(는) 발동하지 않는다`;
  /* 11-01 망령: A-1 은 포텐셜을 막지 않고 「행동 불능」으로 (misagA1) */
  if(keys.includes('A-2')&&isRole&&aw&&aw.id!==m.id&&onF(aw))return `각성체 대가 A-2 — ${aw.name}이(가) 필드에 있는 한 아군의 역할은 무효`;
  return ''}
 /* 11-01 망령 「A-1 도 포텐셜 발동하지 않는다가 아니라 행동불능으로」: 필드 위 다른 아군 중 지정 타입이 한 체도 없으면 각성 (대가) 포켓몬은 행동 불능 — 이유 글을 돌려준다 */
 function misagA1(b,m){const t=((b&&b.trainers)||{})[m&&m.tid];const M=t&&t.misag;if(!M||!M.type||m.awaken!=='free'||!(M.items||[]).some(x=>x.key==='A-1'))return '';
  const onF=x=>!!(x&&x.entry&&x.hp&&x.hp.cur>0);const hasType=(x,ko)=>{const en=window.OM_STATS&&window.OM_STATS.typeEn?window.OM_STATS.typeEn(ko):ko;if(teraOn(x))return x.teraEn===en;return (x.types||[]).includes(en)||(x.typesKo||[]).includes(ko)};   /* 테라스탈이면 타입 4 만 (11-02) */
  const others=Object.values(b.mons||{}).filter(x=>x&&x.tid===m.tid&&x.id!==m.id&&onF(x));return others.some(x=>hasType(x,M.type))?'':`각성체 대가 A-1 — 필드 위 다른 아군 중 ${M.type} 타입이 없어 행동 불능`}
 /* 고유 포텐셜 = 트레이너 것. 횟수는 battle.trainers[tid].uUses */
 function uniqList(t){return ((t&&t.unique)||[]).filter(u=>u&&u.name).map(u=>{const L=limOf(u,t.uUses||{},t.uTurn||{});return {p:u,kind:'고유',max:L.max,left:L.left,mmax:L.mmax,per:L.per}})}
 function potList(m){const out=[];const src=potSrc(m);
  for(const p of src){const mm=String(p.eff||'').match(/【(\d+)\/시】/);if(mm)out.push({name:p.name,max:+mm[1]})}return out}
 /* 해석: 상대 포켓몬의 타입은 「타입」 해석(또는 전체)부터, 포텐셜 칸은 전체 해석부터 보인다 (도감 scope 기준 — GM · 주인 · 같은 편은 늘 보인다) */
 /* PL 권한(공평 모드) 중의 GM 은 플레이어 몫 포켓몬을 자기 트레이너 눈으로 본다 — 같은 편이거나, 자기 트레이너의 도감으로 해석한 만큼만 */
 function plView(c){return c.gm&&c.fair}
 function gmEyes(c,m){const trs=c.b.trainers||{};const mine=myTrainers(c).filter(t=>trs[t]);const al=mine.find(t=>trs[t].side&&sameT(t,m,c.b));return al||mine.find(t=>!sameT(t,m,c.b))||mine[0]||''}
 function dexSees(c,m,part){if((c.gm&&!c.fair)||canEdit(c,m)||c.b.pvp)return true;   /* 11-03 PVP 설정: 모두에게 전체 해석 상태 (표시만 — dex 기록은 그대로) */const D=window.OM_DEX_UI;if(!D||!D.scope)return !c.gm;const sc=c.gm?(()=>{const v=gmEyes(c,m);return v?D.scope(m.id,v,true):[]})():D.scope(m.id,c.seat||'');return sc==='all'||(part!=='all'&&Array.isArray(sc)&&sc.includes(part))}
 function tyHtml(c,m){return dexSees(c,m,'type')?m.types.filter(t=>t!=='-').map(typeChip).join(''):'<span class="tyq" title="타입 미해석 — 도감으로 해석하면 보인다">타입 ?</span>'}
 function potLine(c,m){const full=canEdit(c,m);if(!full&&!dexSees(c,m,'all'))return '';const L=potList(m).filter(p=>full||!isExcl(m,p));   /* 전용 포텐셜은 주인(과 GM)만 본다 */const u=m.potUses||{};const Lnames=new Set(L.map(p=>p.name));
  /* 횟수 없는 자동화(포텐셜·특성·소지품) 도 「발동」 버튼으로 */
  const extra=[];if(FX()&&full){const src=potSrc(m).filter(p=>!Lnames.has(p.name));
   for(const p of src){const a=FX().autoOf(m,'pot',p.name);if(a&&a.ops&&a.ops.length&&!a.manual)extra.push(['pot',p.name])}
   if(m.ability){const a=FX().autoOf(m,'trait',m.ability);if(a&&a.ops&&a.ops.length&&!a.manual&&!FX().timing(a.text).entry&&!FX().timing(a.text).passive)extra.push(['trait',m.ability])}
   if(m.item){const a=FX().autoOf(m,'item',m.item);if(a&&a.ops&&a.ops.length&&!a.manual&&!FX().timing(a.text).entry)extra.push(['item',m.item])}}
  const sp=full?specialPots(m).filter(s=>!Lnames.has(s.p.name)&&!extra.some(([k,n])=>k==='pot'&&n===s.p.name)):[];
  /* 10-21 망령: 폰에서는 칩 · 버튼을 늘어놓지 않고 한 줄 요약 칸 — 누르면 포텐셜 카드 창 (카드가 길어지고 작은 버튼이 상세 보기 터치와 겹쳤다) */
  if(full&&window.matchMedia&&matchMedia('(max-width:760px)').matches){const nP=(m.pots||[]).filter(p=>p&&p.name&&!p.ph).length;const SPs=specialPots(m).filter(s=>s.kind==='전용');const hasI=m.item&&m.item!=='-';
   const nA=extra.length+L.filter(p=>{const a=FX()&&FX().autoOf(m,'pot',p.name);const left=u[p.name]==null?p.max:+u[p.name];return a&&a.ops&&a.ops.length&&!a.manual&&left>0}).length;
   const tot=nP+SPs.length+(hasI?1:0);const pp=SPs.filter(s=>s.max!=null).map(s=>pips(s.left,s.max)).join('');
   return tot?`<button type="button" class="potsum" data-act="pots" data-mid="${m.id}" title="포텐셜 ${nP} · 전용 ${SPs.length}${hasI?' · 소지품 '+esc(m.item):''} — 눌러서 출력 · 발동 · 사용"><span class="psl">포텐 <b>${tot}</b></span>${pp?`<span class="psp">${pp}</span>`:''}${nA?`<span class="psf" title="발동할 수 있는 것 ${nA}">⚡${nA}</span>`:''}</button>`:''}
  const spHtml=sp.length?`<div class="pots sppots">${sp.map(s=>`<span class="pot sp ${s.kind==='고유'?'uq':'ex'}" title="${esc(String(s.p.eff||'').replace(/<br\s*\/?>/g,' ').slice(0,300))}"><em>${s.kind}</em><span class="potn">${esc(s.p.name)}</span>${s.max!=null?pips(s.left,s.max):''}${spBtn(m,s)}</span>`).join('')}</div>`:'';
  /* 자동화가 없는 소지품도 「📢 발동」으로 로그에 표시 */
  const itemAnn=full&&m.item&&m.item!=='-'&&!extra.some(([k])=>k==='item')?`<span class="pot" title="${esc(String(m.itemEff||'').replace(/<br\s*\/?>/g,' ').slice(0,300))}"><span class="potn"><span class="potk">소지품 </span>${esc(m.item)}</span><button class="btn xs" data-act="announce" data-mid="${m.id}" data-kind="item" data-pot="${esc(m.item)}" title="효과를 로그에 출력 (자동화 없음)" aria-label="발동">📢<span class="potk"> 발동</span></button></span>`:'';
  /* 10-25 망령: 늘 같은 순서로 — 전용 → 고유 → 포텐셜(횟수) → 포텐셜(자동) → 특성 → 소지품 */
  const rows=[];
  for(const p of L){const left=u[p.name]==null?p.max:+u[p.name];const a=FX()&&FX().autoOf(m,'pot',p.name);const spk=(potSrc(m).find(q=>q.name===p.name)||{}).unique?'고유':isExcl(m,p)?'전용':'';
   rows.push([spk==='전용'?0:spk==='고유'?1:2,`<span class="pot ${left<=0?'off':''} ${a&&a.ops&&a.ops.length&&!a.manual?'auto':''} ${spk?'sp '+(spk==='고유'?'uq':'ex'):''}" title="${esc(p.name)}${a&&a.ops&&a.ops.length?' · 자동: '+esc(FX().unparse(a.ops).join(' / ')):''}">${spk?`<em>${spk}</em>`:''}<span class="potn">${esc(p.name)}</span>${pips(left,p.max)}${full&&left>0?(potRest(m,p.name)?restChip(potRest(m,p.name)):`<button class="btn xs" data-act="usepot" data-mid="${m.id}" data-pot="${esc(p.name)}">사용</button>`):''}${full&&left<p.max?`<button class="btn xs ghost" data-act="restorepot" data-mid="${m.id}" data-pot="${esc(p.name)}">+</button>`:''}</span>`])}
  for(const s2 of sp)rows.push([s2.kind==='고유'?1:0,`<span class="pot sp ${s2.kind==='고유'?'uq':'ex'}" title="${esc(String(s2.p.eff||'').replace(/<br\s*\/?>/g,' ').slice(0,300))}"><em>${s2.kind}</em><span class="potn">${esc(s2.p.name)}</span>${s2.max!=null?pips(s2.left,s2.max):''}${spBtn(m,s2)}</span>`]);
  for(const [k,n] of extra){const a=FX().autoOf(m,k,n);rows.push([k==='pot'?3:k==='trait'?4:5,`<span class="pot auto" title="${esc(n)} · ${esc(FX().unparse(a.ops).join(' / '))}"><span class="potn">${k==='trait'?'특성 ':k==='item'?'소지품 ':''}${esc(n)}</span>${k==='pot'&&potRest(m,n)?restChip(potRest(m,n)):`<button class="btn xs" data-act="fireauto" data-mid="${m.id}" data-kind="${k}" data-pot="${esc(n)}">발동</button>`}</span>`])}
  if(itemAnn)rows.push([5,itemAnn]);
  if(!rows.length)return '';
  rows.sort((x,y)=>x[0]-y[0]);   /* 같은 무리 안에서는 시트 순서 그대로 (안정 정렬) */
  /* 11-03 21:02 망령 「카드 길이가 왔다갔다 거슬린다 — 전용 · 포텐셜 · 소지품 순으로 나누고 옆 여백을 써서 한 줄에 두 칸씩」 · 21:04 「하나뿐이면 한 줄에 하나」: 무리(전용 · 고유 / 포텐셜 · 특성 / 소지품)마다 2열 격자, 하나면 한 칸 */
  const G=[[0,1],[2,3,4],[5]];const grp=G.map(ks=>rows.filter(r=>ks.includes(r[0]))).filter(g=>g.length);
  return `<div class="pots pgs">${grp.map(g=>`<div class="pgrp ${g.length===1?'one':''}">${g.map(r=>r[1]).join('')}</div>`).join('')}</div>`}
 function cmdOf(b,m){const cm=(b.cmds||{})[m.tid];if(!cm||!cm.mons||!cm.mons[m.id])return '';const x=cm.mons[m.id];
  const parts=[];if(x.move==='switch')parts.push(`<b>교대</b> → ${esc(monName(b,x.switch))}`);else if(x.move!=null&&x.move!==''){const mv=MVS(m)[+x.move];parts.push(`<b>${esc(mv?mv.name:'?')}</b>${mv?' '+typeChip(mv.typeEn):''}`);if(x.targets&&x.targets.length)parts.push('→ '+x.targets.map(s=>slotName(b,s)).join(', '))}
  if(x.prio&&Object.values(x.prio).some(v=>v!==''&&+v!==0))parts.push('우선도 '+Object.entries(x.prio).filter(([k,v])=>v!==''&&+v!==0).map(([k,v])=>slotName(b,k)+' '+v).join(', '));
  if(x.ochg&&Object.values(x.ochg).some(v=>v!==''&&+v!==20))parts.push('순서 '+Object.entries(x.ochg).filter(([k,v])=>v!==''&&+v!==20).map(([k,v])=>slotName(b,k)+' '+v).join(', '));
  const fd=((cm.fired||{})[m.id])||{};if(fd.order)parts.push(`<span class="rk up">『${esc(orderName(b,m.tid,'order',fd.order))}』</span>`);if(fd.command)parts.push(`<span class="rk up">『${esc(orderName(b,m.tid,'command',fd.command))}』</span>`);
  if(x.pots&&x.pots.length)parts.push(x.pots.map(p=>{const src=potSrc(m).find(q=>q.name===p)||{};const k=src.unique?'고유':(m.excl&&m.excl.name===p)||(m.exclX||[]).some(q=>q.name===p)?'전용':'포텐셜';return `<span class="rk fxc" title="${esc(src.eff||'')}">${k} 『${esc(p)}』</span>`}).join(' '));
  if(cm.detail)parts.push(`<span class="dim">${esc(cm.detail)}</span>`);
  return parts.join(' ')}
 function slotName(b,slot){const [side,area]=String(slot).split('_');const m=entered(b,side)[area];return `${SIDE_KO[side]||side}${(area||'').toUpperCase()}${m?'('+esc(m.name)+')':''}`}
 const OO=()=>window.OM_ORDERS;
 function orderName(b,tid,kind,key){const t=(b.trainers||{})[tid]||{};return kind==='order'?OO().orderName(t,key):OO().commandName(t,key)}

 /* 행동 순서 띠 (맵툴 print_turn_order 꼴: 초상 줄 + 「교대 등장」「통상 교대」「우선도」「순서값」 줄) + 지금 행동 중인 칸 */
 function orderBox(c){const b=c.b;if(!b.order||!b.order.length)return '';const cur=+b.orderIdx||0;
  const cap=o=>{if(!o.started)return '「교대 등장」';if(o.change)return '「통상 교대」';if(o.order!==20)return '「'+esc(orderValueName(o.order))+'」';return '「우선도 : '+(o.prio>0?'+':'')+o.prio+'」'};
  return `<div class="orderbox"><div class="ohead"><span class="olab">행동 순서</span><span class="small dim">${(b.orderNotes||[]).length?esc((b.orderNotes||[]).join(' · ')):'스피드 순 · 초상을 누르면 그 차례로'}</span><span class="sp"></span>${c.mgr?`<button class="btn xs ghost" data-act="oprev">◀</button><span class="small">${Math.min(cur+1,b.order.length)} / ${b.order.length}</span><button class="btn xs pri" data-act="onext">다음 행동 ▶</button><button class="btn xs ghost" data-act="oresort" title="아직 행동하지 않은 포켓몬만 지금 스피드 · 랭크 · 마비 · 트릭룸 · 순풍 등으로 다시 줄 세운다 (이미 행동한 차례와 지금 차례는 그대로)">순서 다시 계산</button>`:''}</div>
   <div class="ostrip">${b.order.map((o,i)=>{const m=(b.mons||{})[o.mid]||{};const dead=m.hp&&m.hp.cur<=0;return `<div class="ocard ${o.side} ${i===cur?'now':i<cur?'done':''} ${dead?'dead':''}" data-act="ojump" data-i="${i}" title="${esc(o.name)} · 스피드 ${Math.round(o.speed)} · d${o.dice}"><span class="onum">${i+1}</span><div class="opt" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}"></div><b class="onm">${esc(o.name)}</b><span class="ocap">${cap(o)}</span>${(()=>{const px=(((b.cmds||{})[m.tid]||{}).mons||{})[o.mid];if(px){if(px.move==='switch')return '<span class="omv">교대</span>';const mv=(px.move!==''&&px.move!=null)?MVS(m)[+px.move]:null;return mv?`<span class="omv">${typeChip(mv.typeEn)}${esc(mv.name)}</span>`:'<span class="omv dim">행동 없음</span>'}if(o.pursuitHit&&o.move)return `<span class="omv">${esc(o.move)}</span>`;return `<span class="omv dim" title="차례가 오면 공개">${i<=cur?'공개 대기':'?'}</span>`})()}<span class="osp">S ${Math.round(Math.abs(o.speed))} · d${o.dice}</span></div>`}).join('')}</div></div>`}
 function orderValueName(v){return ({40:'가장 먼저',30:'상대보다 먼저',20:'일반',10:'상대보다 나중에',0:'가장 나중에'})[v]||('순서 '+v)}

 /* ---------- 지시 입력 패널 ---------- */
 let CMD={};  /* 편집 중인 내 지시 {tid:{mons:{},order:{},command:{},detail,turn}} */
 /* 지난 턴에 고른 지시(교대 → 이미 나온 포켓몬 등)가 다음 턴까지 남지 않게: 턴이 바뀌면 버린다 (GM 화면은 턴 종료 때 비우지만 PL 화면은 여기서) */
 const cmdNow=(tid,b)=>{const c=CMD[tid];if(c&&c.turn!=null&&c.turn!==(+b.turn||0)){delete CMD[tid];return null}return c||null};
 /* ---------- 지시 입력 패널 (맵툴 cmd_ui 와 같은 구성: 포켓몬 탭 → 기술 카드 → 대상 보드 → 지령 풀 → 요약) ---------- */
 const UIC={tab:{},fold:{}};  /* tid → 선택된 mid */
 function moveCard(mv,i,on,extra){const col=S().typeColor(mv.typeEn);const X=mv.ext;return `<div class="mv ${on?'on':''}${mv.virt?' virt':''}${X?' ext':''}${extGone(mv)?' gone':''}" ${mv.virt?'title="발버둥 — 「망각」 상태이거나 쓸 수 있는 기술이 없을 때"':X?`title="${esc(`기능 확장 — 트레이너${X.src?' 『'+X.src.replace(/[『』]/g,'')+'』':''}가 주는 기술 · ${X.kind==='extra'?'추가 행동으로 (행동과 따로)':'이 포켓몬의 행동으로'} · ${X.lim?`【${X.lim}/시】 남은 ${X.left}`:'횟수 제한 없음'}`)}"`:''} style="background:${col.bg};color:${col.fg}" ${extra||''}>${X?`<div class="mvx">기능 확장${X.kind==='extra'?' · 추가 행동':''}${X.lim?` · ${X.left}/${X.lim}`:''}</div>`:''}<div class="mn">${esc(mv.name)} <i class="mvdb" data-mvdb="${esc(mv.name)}" title="기술 DB">?</i></div><div class="mm">${esc(mv.cat)} · 위력 ${mv.pow||'-'} · 명중 ${mv.acc||'필중'}${mv.prio?' · 우선 '+mv.prio:''}</div><div class="mr">${esc(mv.range)}${A().contactOf(mv)==='O'?' · <b class="mct">접촉</b>':A().contactOf(mv)==='X'?' · 비접촉':''}</div></div>`}
 function tile(m,side,area,on,cls,extra){if(!m)return `<div class="ttile none ${cls||''}"><span class="tn"><small>${SIDE_KO[side]} ${area.toUpperCase()} 빈 자리</small></span></div>`;const pct=Math.max(0,Math.min(100,(m.hp.cur>0?Math.max(1,Math.round(m.hp.cur/m.hp.max*100)):0)));
  return `<div class="ttile ${cls||''} ${on?'on':''}" ${extra||''}><div class="ti" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}"></div><div class="tn"><b>${esc(m.name)}</b><small>${SIDE_KO[side]} ${area.toUpperCase()} · ${tyHtml(ctx(),m)}</small><div class="hpb ${pct<=25?'low':pct<=50?'mid':''}"><i style="width:${pct}%"></i></div></div><span class="tk">${on?'✓':''}</span></div>`}
 /* 대상판: 열 = 좌측/우측, 행 = 에리어 (무대와 같은 배치). 아군 열은 초록, 상대 열은 빨강 */
 function board(b,mySide,isOn,attr,allowSelf,me){const ent={left:entered(b,'left'),right:entered(b,'right')};const cls=s=>s===mySide?'al':'en';
  /* 개인전: 같은 진영이라도 다른 편이면 빨강 (me = 지시하는/공격하는 포켓몬) */
  const tc=(m,s)=>m&&me?(sameT(m,me,b)?'al':'en'):cls(s);const mixed=!!me&&((((b.sides||{})[mySide]||{}).trainers)||[]).some(t=>((b.trainers||{})[t]||{}).solo);
  const head=SIDES.map(s=>`<div class="bl ${cls(s)}">${SIDE_KO[s]}${s===mySide?(mixed?' (내 쪽 · 개인전)':' (아군)'):' (상대)'}</div>`).join('');
  const rows=AREAS.slice(0,mode(b)).map(a=>SIDES.map(s=>{const m=ent[s][a];const slot=slotOf(s,a);return tile(m,s,a,m&&isOn(slot,m),tc(m,s),m?attr(slot,m):'')}).join('')).join('');
  return `<div class="board grid">${head}${rows}</div>`}
 /* 선행 입력에 묻은 추격(맵툴 command_pursuit): 선행 입력한 포텐셜·지령·명령·고유의 자동화에 「추격」이 있거나 글에 따라가때리기 부여가 적혀 있으면.
    「추격 무시」면 pimm (이번 턴 교대해도 상대의 추격을 받지 않는다). 손으로 켠 추격(pman)도 함께. 공개되지 않고 행동 순서 때 드러난다 */
 function prePursuit(t,m,x,upots){const out={pur:'',pimm:'',ut:''};if(!x)return out;
  const scan=(ops,name)=>{for(const op of ops||[]){if(op.k==='pursuit'&&op.on){if(op.immune){if(!out.pimm)out.pimm=name}else if(!out.pur)out.pur=name}if(op.k==='choice')for(const o of op.opts||[])scan(o.ops,name)}};
  const byText=(txt,name)=>{txt=String(txt||'');if(/「?유턴」?\s*효과를\s*부여/.test(txt)&&!out.ut)out.ut=name;   /* 10-24 제보: 선행에 묻은 「유턴」 */if(!/따라가때리기|『?추격』?/.test(txt))return;if(/무시|받지 않/.test(txt)){if(!out.pimm)out.pimm=name}else if(/부여|발동|얻는다|된다/.test(txt)&&!out.pur)out.pur=name};
  const look=(kind,name,eff)=>{if(!name)return;const a=FX()?FX().autoOf(m,kind,name)||(kind!=='pot'?FX().rm(name):null):null;if(a&&a.ops&&a.ops.length)scan(a.ops,name);byText(eff||(a&&a.text),name)};
  for(const n of x.pots||[]){const p=potSrc(m).find(q=>q.name===n);look('pot',n,p&&p.eff)}
  for(const n of upots||[]){const u=(t.unique||[]).find(q=>q&&q.name===n);look('pot',n,u&&u.eff)}
  if(x.order)look('order',OO().orderName(t,x.order));if(x.command)look('order',OO().commandName(t,x.command));
  if(x.pman&&!out.pur)out.pur='손으로 선행';if(x.uman&&!out.ut)out.ut='손으로 선행';return out}
 /* 「유턴」 기술: 태그 · 효과 글 (명중 후 임의 교대) */
 function isUturn(mv,m){if(!mv)return false;if(((m&&m.flags)||{}).uturn)return true;if((mv.tags||[]).some(t=>/유턴/.test(t))||/유턴/.test(String(mv.tag||'')))return true;return /「유턴」\s*기술|명중\s*후\s*임의\s*교대/.test(String(mv.eff||''))}
 function cmdPanel(c,ready){
  const b=c.b;const tids=myTrainers(c);if(!tids.length)return '';
  const phase=+b.phase||0;
  const blocks=tids.map(tid=>{const t=(b.trainers||{})[tid]||{};const mons=Object.values(b.mons||{}).filter(m=>m.tid===tid&&m.entry&&m.hp.cur>0).sort((x,y)=>x.entry.localeCompare(y.entry));if(!mons.length)return '';
   if(!cmdNow(tid,b)&&coOf(c,tid).length)coPull(tid);const cur=cmdNow(tid,b)||(CMD[tid]={mons:{},detail:'',upots:[],turn:+b.turn||0,fresh:1});cur.upots=cur.upots||[];const UL=uniqList(t);const tmOpen=!!ready[tid]&&timeOf(t,+b.turn||0).sw>=1&&phase===0;const locked=!!ready[tid]&&!tmOpen;
   if(!mons.find(m=>m.id===UIC.tab[tid]))UIC.tab[tid]=mons[0].id;const m=mons.find(x=>x.id===UIC.tab[tid]);
   mons.forEach(mm=>{cur.mons[mm.id]=cur.mons[mm.id]||{move:'',switch:'',targets:[],prio:{},ochg:{},order:'',command:'',pots:[]};cur.mons[mm.id].pots=cur.mons[mm.id].pots||[]});
   const x=cur.mons[m.id];const bench=Object.values(b.mons||{}).filter(mm=>mm.tid===tid&&!mm.entry&&mm.hp.cur>0);
   const oNames=OO().orderNames(t);const cNames=OO().commandNames(t);const OKEYS=OO().orderKeys(t);const CKEYS=OO().commandKeys(t);const cnt=t.orderCount||{};
   const summ=mons.map(mm=>{const xx=cur.mons[mm.id];const pre=[xx.order?`『${esc(OO().orderName(t,xx.order))}』`:'',xx.command?`『${esc(OO().commandName(t,xx.command))}』`:''].filter(Boolean).join(' ');const pd=(xx.pots||[]).length?` <span class="dim">포텐셜 ${xx.pots.map(p=>'『'+esc(p)+'』').join('')}</span>`:'';const pp=prePursuit(t,mm,xx,cur.upots);const tail=(pre?` <span class="dim">선행 ${pre}</span>`:'')+pd+(pp.pur||(xx.move!=='switch'&&isPursuit(MVS(mm)[+xx.move],mm))?' <span style="color:var(--yel2)">· 추격</span>':'')+(pp.pimm?' <span style="color:var(--ok)">· 추격 무시</span>':'')+(xx.move!=='switch'&&(pp.ut||isUturn(MVS(mm)[+xx.move],mm))?' <span style="color:var(--yel2)">· 유턴</span>':'');if(xx.move==='switch')return `${mm.name}: 교대 → ${monName(b,xx.switch)||'?'}${tail}`;if(xx.move===''||xx.move==null)return `${mm.name}: <span class="warn">행동 없음</span>${tail}`;const mv=MVS(mm)[+xx.move];return `${mm.name}: <b>${mv?esc(mv.name):'?'}</b>${xx.targets.length?' → '+xx.targets.map(sl=>slotName(b,sl)).join(', '):' <span class="warn">대상 없음</span>'}${tail}`}).join(' · ');
   const isSwitch=x.move==='switch';const mvSel=!isSwitch&&x.move!==''?MVS(m)[+x.move]:null;
   return `<div class="cmdt ${locked?'locked':''}" data-tid="${tid}">
    <div class="cmdhead"><b>${esc(t.name)}</b> 지시 ${locked?'<span class="tag ok">READY</span><span class="small dim">준비 완료 — 바꾸려면 「준비 해제」</span>':tmOpen?'<span class="tag ok">READY</span><span class="small" style="color:var(--yel2)">「타임」을 썼으니 고칠 수 있다 — 「저장」하면 반영</span>':''}<span class="sp"></span>${phase>=1?`<button class="btn xs" data-act="fire" data-tid="${tid}">포텐셜 발동</button>`:''}${locked?'':`<button class="btn xs ghost" data-act="cmdload" data-tid="${tid}">저장된 지시 불러오기</button>`}</div>
    ${UL.length?`<div class="upre ${locked?'ro':''}"><div class="sec">고유 포텐셜 <span class="tag uqt">트레이너</span> <span class="note">선행 입력 — 턴 중 「포텐셜 발동」에서 「선행 발동」 · 공개해도 상대는 모른다</span></div><div class="pool">${UL.map(s=>`<div class="oc ${cur.upots.includes(s.p.name)?'mine':''} ${s.left!==null&&s.left<=0?'dis':''}" data-upre="${esc(s.p.name)}" title="${esc(String(s.p.eff||'').replace(/<br\s*\/?>/g,' '))}"><b>${esc(s.p.name)}</b><small>${s.max!=null?pips(s.left,s.max):'횟수 없음'}</small></div>`).join('')}</div></div>`:''}
    <div class="tabs2">${mons.map(mm=>{const xx=cur.mons[mm.id];const mv=xx.move!==''&&xx.move!=='switch'?MVS(mm)[+xx.move]:null;return `<div class="tab2 ${mm.id===m.id?'on':''}" data-ctab="${mm.id}"><div class="pic" style="${mm.image?`background-image:url('${cssu(mm.image)}')`:''}"></div><div><b>${esc(mm.name)}</b><small>${xx.move==='switch'?'교대 → '+esc(monName(b,xx.switch)||'?'):mv?esc(mv.name):'미정'}</small></div></div>`}).join('')}</div>
    <div class="pane ${locked?'ro':''}">
     <div class="sec">행동 <span class="seg"><span class="${!isSwitch?'on':''}" data-seg="move">기술</span><span class="${isSwitch?'on':''}" data-seg="switch">교대</span></span><span class="note">에리어 ${m.entry.toUpperCase()}</span></div>
     ${isSwitch?(()=>{const tw=trapWarn(m);return tw?`<div class="small" style="margin:4px 0;color:${tw.free?'var(--ok)':'var(--yel2)'}">${tw.free?`교대 제한(${esc(tw.hit.join('·'))})이 걸려 있지만 ${esc(tw.free)}로 교대할 수 있다`:`⚠ ${esc(tw.hit.join('·'))} 때문에 교대할 수 없다${tw.pot?` — 「${esc(tw.pot)}」를 쓰면 교대할 수 있다`:''}`}</div>`:''})():''}${isSwitch?`<div class="pg">${bench.length?bench.map(bm=>`<div class="pc ${x.switch===bm.id?'on':''}" data-sw="${bm.id}"><div class="pic" style="${bm.image?`background-image:url('${cssu(bm.image)}')`:''}"></div><div><b>${esc(bm.name)}</b><div class="small dim">${bm.hp.cur}/${bm.hp.max}</div></div></div>`).join(''):'<div class="dim small">교대할 포켓몬이 없다</div>'}</div>`
     :`${misagA1(b,m)?`<div class="small" style="color:var(--yel2);margin:2px 0 4px">⚠ ${esc(misagA1(b,m))} — 이번 턴은 기술을 쓸 수 없다 (행동 순서에서 저절로 건너뛴다 · 교대는 된다)</div>`:''}${(m.states||{}).Recharge?'<div class="small" style="color:var(--yel2);margin:2px 0 4px">「반동 : 행동불능」 — 이번 턴은 움직일 수 없다 (행동 없음 · 4식 6령도 받을 수 없다)</div>':''}${(m.states||{}).Oblivion?'<div class="small" style="color:var(--yel2);margin:2px 0 4px">「망각」 상태 — 「발버둥」만 내보낼 수 있다</div>':''}${misagA1(b,m)?'':`<div class="mvg">${MVS(m).map((mv,i)=>moveCard(mv,i,String(x.move)===String(i),`data-mv="${i}"`)).join('')}</div>`}${mvSel?`<div class="mef">${esc(mvSel.eff||'')}${mvSel.tag&&mvSel.tag!=='-'?` <span class="dim">[${esc(mvSel.tag)}]</span>`:''}</div>`:''}
      ${mvSel?`<div class="sec">대상 <span class="note">범위 ${esc(mvSel.range)} — 누르면 바꿀 수 있다</span></div>${(m.states||{}).Thrash?`<div class="small" style="color:var(--yel2);margin:2px 0 4px">「난동부리기」 — ${x.tman?'손으로 고른 대상으로 때린다':'공격할 때 적진에서 랜덤으로 고른다 · 대상을 누르면 손으로 정한다'}</div>`:''}${board(b,m.side,(slot)=>x.targets.includes(slot),(slot)=>`data-tgt="${slot}"`,false,m)}`:''}${(()=>{const pp=prePursuit(t,m,x,cur.upots);const auto=isPursuit(mvSel,m);return `<div class="row small purrow" style="margin-top:6px;gap:8px;flex-wrap:wrap"><span class="oc ${x.pman||auto?'mine':''}" data-pman title="노린 대상이 교대하면 교대 전에 먼저 때린다 (맵툴 「추격」 칸)"><b>추격</b><small>${auto?'기술에 있음':x.pman?'켬':'끔'}</small></span>${pp.pur&&pp.pur!=='손으로 선행'?`<span class="tag" style="color:var(--yel2)">선행 『${esc(pp.pur)}』에 추격이 묻어 있다</span>`:''}${pp.pimm?`<span class="tag" style="color:var(--ok)">선행 『${esc(pp.pimm)}』 — 상대 추격 무시</span>`:''}${(()=>{const ua=isUturn(mvSel,m);return `<span class="oc ${x.uman||ua?'mine':''}" data-uman title="공격이 명중하면 임의 교대한다 — 상대가 이 포켓몬을 「따라가때리기」로 노리면 빠지기 전에 맞는다"><b>유턴</b><small>${ua?'기술에 있음':x.uman?'켬':'끔'}</small></span>${pp.ut&&pp.ut!=='손으로 선행'?`<span class="tag" style="color:var(--yel2)">선행 『${esc(pp.ut)}』에 유턴이 묻어 있다</span>`:''}`})()}<span class="dim">공개되지 않고, 걸리면 행동 순서 때 드러난다</span></div>`})()}`}
     ${(()=>{/* 11-03 감우 (검토 22): 휴대폰에서는 전용 · 명령 · 지령 · 일반 포텐셜 네 칸을 「선행 입력 ▸」 한 묶음 안에 */const ph1=window.matchMedia&&matchMedia('(max-width:760px)').matches;if(!ph1)return '';const all=[...x.pots,x.order?OO().orderName(t,x.order):'',x.command?OO().commandName(t,x.command):''].filter(Boolean);return `<details class="cfold pregrp" data-fold="${tid}:pre" ${UIC.fold[tid+':pre']?'open':''}><summary>선행 입력 <small class="dim">전용 · 명령 · 지령 · 포텐셜</small><span class="fsum">${fsum(all)}</span></summary><div class="pregrpin">`})()}<details class="cfold" data-fold="${tid}:sp" ${UIC.fold[tid+':sp']?'open':''}><summary>전용 포텐셜 <span class="tag ext">${esc(m.name)}</span><span class="fsum">${fsum(x.pots.filter(n=>specialPots(m).some(s=>s.p.name===n)))}</span></summary><div class="note small">선행 입력 — 턴 중 「포텐셜 발동」에서 「선행 발동」</div><div class="pool">${potDecl(c,m,x,'sp')}</div></details>
     <details class="cfold" data-fold="${tid}:ord" ${UIC.fold[tid+':ord']?'open':''}><summary>명령 <small class="dim">4식</small><span class="fsum">${fsum(x.order?[OO().orderName(t,x.order)]:[])}</span></summary>${noOrdWhy(m)?`<div class="small noordw">⚠ 4식 6령 불가 — ${esc(noOrdWhy(m))}</div>`:''}<div class="note small">에리어 ${m.entry.toUpperCase()} ${esc(m.name)} 에 선행 입력 — 턴 중 「포텐셜 발동」에서 발동</div><div class="pool">${OKEYS.map((k,i)=>oNames[i]?`<div class="oc ${x.order===k?'mine':''} ${(cnt['order_'+k]??0)<=0?'dis':''}" data-ord="${k}"><b>${esc(oNames[i])}</b>${OO().ownerOf(t,k)?`<i class="oown">${esc(OO().ownerOf(t,k))}</i>`:''}<small>남은 ${cnt['order_'+k]??0}</small></div>`:'').join('')||'<span class="dim small">쓸 수 있는 명령이 없다</span>'}</div></details>
     <details class="cfold" data-fold="${tid}:cmd" ${UIC.fold[tid+':cmd']?'open':''}><summary>지령 <small class="dim">6령</small><span class="fsum">${fsum(x.command?[OO().commandName(t,x.command)]:[])}</span></summary>${noOrdWhy(m)?`<div class="small noordw">⚠ 4식 6령 불가 — ${esc(noOrdWhy(m))}</div>`:''}<div class="pool">${CKEYS.map((k,i)=>cNames[i]?`<div class="oc ${x.command===k?'mine':''} ${(cnt['command_'+k]??0)<=0?'dis':''}" data-cmd="${k}"><b>${esc(cNames[i])}</b>${OO().ownerOf(t,k)?`<i class="oown">${esc(OO().ownerOf(t,k))}</i>`:''}<small>남은 ${cnt['command_'+k]??0}</small></div>`:'').join('')||'<span class="dim small">쓸 수 있는 지령이 없다</span>'}</div></details>
     <details class="cfold" data-fold="${tid}:norm" ${UIC.fold[tid+':norm']?'open':''}><summary>일반 포텐셜 선행 입력<span class="fsum">${fsum(x.pots.filter(n=>!specialPots(m).some(s=>s.p.name===n)))}</span></summary><div class="pool">${potDecl(c,m,x,'norm')}</div></details>${window.matchMedia&&matchMedia('(max-width:760px)').matches?'</div></details>':''}
     ${(()=>{/* 10-22 망령: 우선도는 바로 누르는 칩으로 (이 포켓몬 칸). 다른 포켓몬 칸 · 행동 순서는 아래 접힌 칸 */const my=allEntered(b).find(s=>s.mon.id===m.id);if(!my||isSwitch)return '';const v=x.prio[my.slot];const vv=v===''||v==null?0:+v;const base=mvSel?(FX()&&FX().prioOf?FX().prioOf(m,mvSel):(+mvSel.prio||0)):0;const sg=n=>n>0?'+'+n:String(n);
      return `<div class="prow"><span class="pl">우선도 보정</span><span class="pqs">${[-3,-2,-1,0,1,2,3,4,5].map(n=>`<span class="pq ${vv===n?'on':''} ${n<0?'neg':n>0?'pos':''}" data-pq="${n}" data-slot="${my.slot}">${sg(n)}</span>`).join('')}</span><span class="small dim">${mvSel?`기술 ${sg(base)}${vv?` → <b style="color:var(--yel2)">${sg(base+vv)}</b>`:''}`:''}</span></div>`})()}
     <details class="adv"><summary>다른 포켓몬 우선도 · 행동 순서 변경 (${esc(m.name)}의 지시로)</summary><div class="tgts">${allEntered(b).map(s=>`<label class="tg2">${s.area.toUpperCase()} ${esc(s.mon.name)} 우선 <input type="number" class="n" data-f="prio" data-mid="${m.id}" data-slot="${s.slot}" value="${x.prio[s.slot]??''}" placeholder="0"> 순서 <input type="number" class="n" data-f="ochg" data-mid="${m.id}" data-slot="${s.slot}" value="${x.ochg[s.slot]??''}" placeholder="20"></label>`).join('')}</div></details>
     <div class="row" style="margin-top:6px"><input type="text" data-f="detail" value="${esc(cur.detail)}" placeholder="상세 (포텐셜 선언, 자유 메모)" style="flex:1"></div>
    </div>
    <div class="cfoot"><div class="sum">${cur.upots.length?`<div><span class="tag uqt">고유</span> 선행 ${cur.upots.map(n=>'『'+esc(n)+'』').join('')}</div>`:''}${summ}</div>${locked?'':`<button class="btn" data-act="cmdsave" data-tid="${tid}">저장</button>`}<button class="btn ${locked?'':'pri'}" data-act="ready" data-tid="${tid}">${locked?'준비 해제':'준비 완료'}</button></div></div>`}).join('');
  if(!blocks.trim())return '';
  loadPeek().then(pk=>{const el=document.getElementById('peekbox');if(!el||!pk)return;if(pk.turn!==(ctx().b.turn||0))return;el.innerHTML=`<div class="chip" style="border-color:var(--yel);padding:4px 10px">타임 결과 · ${esc(pk.name)}: <b>${esc(pk.text)}</b></div>`});
  return `<form id="cmdForm" class="cmdpanel" onsubmit="return false"><div id="peekbox"></div><div class="cmdtitle">지시 입력 <span class="dim small">${phase===0?'지시 준비 페이즈':'지금은 '+['','턴 개시','행동 순서','행동 처리','','턴 종료'][phase]+' — 입력은 저장만 된다'}</span></div>${blocks}</form>`}
 function fsum(L){L=(L||[]).filter(Boolean);return L.length?L.map(n=>esc(n)).join(' · '):'—'}
 /* 지시를 고칠 때마다 벤치 아래 지시 현황도 */
 function refreshSide(c){document.querySelectorAll('[data-bside]').forEach(el=>{const tmp=document.createElement('div');tmp.innerHTML=sidePanel(c,el.dataset.bside,c.ST.state.ready||{});if(tmp.firstElementChild)el.replaceWith(tmp.firstElementChild)});document.querySelectorAll('[data-bside]').forEach(el=>el.ontoggle=()=>{UIC.bside=UIC.bside||{};UIC.bside[el.dataset.bside]=el.open})}
 function rerenderCmd(){const old=$('#cmdForm');if(!old)return;const c=ctx();const tmp=document.createElement('div');const h=cmdPanel(c,c.ST.state.ready||{});tmp.innerHTML=h;const nf=tmp.firstElementChild;if(!nf){old.remove();return}nf._h=h;old.replaceWith(nf);refreshSide(c);nf.querySelectorAll('[data-act]').forEach(bt=>bt.onclick=()=>action(bt.dataset));bindCmdForm(nf,c)}
 function bindCmdForm(form,c){const bnd=!form._bnd;form._bnd=1;   /* 11-03: 같은 요소를 다시 묶을 때(render 가 옛 폼을 되붙임) addEventListener 는 한 번만 */
  form.querySelectorAll('.cmdt').forEach(blk=>{const tid=blk.dataset.tid;const cur=CMD[tid];if(!cur)return;const mid=UIC.tab[tid];const x=cur.mons[mid]||(cur.mons[mid]={move:'',switch:'',targets:[],prio:{},ochg:{},order:'',command:'',pots:[]});
   if(bnd)blk.querySelectorAll('[data-fold]').forEach(d=>d.addEventListener('toggle',()=>{UIC.fold[d.dataset.fold]=d.open}));
   if(blk.classList.contains('locked')){blk.querySelectorAll('[data-ctab]').forEach(el=>el.onclick=()=>{UIC.tab[tid]=el.dataset.ctab;rerenderCmd()});return}
   blk.querySelectorAll('[data-ctab]').forEach(el=>el.onclick=()=>{UIC.tab[tid]=el.dataset.ctab;rerenderCmd()});
   blk.querySelectorAll('[data-upre]').forEach(el=>el.onclick=()=>{if(el.classList.contains('dis'))return;const n=el.dataset.upre;cur.upots=cur.upots||[];const i=cur.upots.indexOf(n);if(i>=0)cur.upots.splice(i,1);else cur.upots.push(n);rerenderCmd()});
   blk.querySelectorAll('[data-seg]').forEach(el=>el.onclick=()=>{if(el.dataset.seg==='switch'){x.move='switch';x.targets=[]}else{x.move='';x.targets=[]}rerenderCmd()});
   blk.querySelectorAll('[data-mv]').forEach(el=>el.onclick=()=>{if(extGone(MVS((c.b.mons||{})[mid]||{})[+el.dataset.mv]))return A().toast('이 기능 확장은 이번 시합에서 다 썼다');x.move=el.dataset.mv;x.targets=defaultTargets(c.b,mid,el.dataset.mv);x.tman=0;rerenderCmd()});
   blk.querySelectorAll('[data-sw]').forEach(el=>el.onclick=()=>{x.switch=el.dataset.sw;rerenderCmd()});
   blk.querySelectorAll('[data-tgt]').forEach(el=>el.onclick=()=>{const s=el.dataset.tgt;x.tman=1;const i=x.targets.indexOf(s);if(i>=0)x.targets.splice(i,1);else{/* 단일 대상 기술은 새로 누른 대상으로 바꾼다 — 지난 턴 대상이 남아 둘을 노리던 일 (10-26 FFA 시험) */const mv=MVS((c.b.mons||{})[mid]||{})[+x.move]||{};if(!MULTI_RANGE.test(String(mv.range||'')))x.targets.length=0;x.targets.push(s)}rerenderCmd()});
   blk.querySelectorAll('[data-pq]').forEach(el=>el.onclick=()=>{const n=+el.dataset.pq;x.prio=x.prio||{};x.prio[el.dataset.slot]=n?String(n):'';rerenderCmd()});
   blk.querySelectorAll('[data-pman]').forEach(el=>el.onclick=()=>{x.pman=x.pman?0:1;rerenderCmd()});blk.querySelectorAll('[data-uman]').forEach(el=>el.onclick=()=>{x.uman=x.uman?0:1;rerenderCmd()});
   const noOrdGate=()=>{const mm=c.b.mons[mid];const why=noOrdWhy(mm);const wk=mid+':'+(+c.b.turn||0);if(!why||NOORD_W[wk])return false;NOORD_W[wk]=1;A().toast(`⚠ ${mm.name} — 4식 6령을 받을 수 없다 (${why}). 그래도 넣으려면 한 번 더 누른다`);return true};
   const oneOf=(k,nm)=>{const o=Object.entries(cur.mons).find(([id,v])=>id!==mid&&v&&v[k]&&(c.b.mons[id]||{}).entry);if(!o)return false;A().toast(`${nm}은 한 턴에 하나만 — ${(c.b.mons[o[0]]||{}).name||'다른 포켓몬'}에 넣은 것을 먼저 뺀다`);return true};   /* 10-26 망령: 4식 · 6령은 트레이너당 한 턴에 종류별 하나 */
   blk.querySelectorAll('[data-ord]').forEach(el=>el.onclick=()=>{if(el.classList.contains('dis'))return;if(x.order!==el.dataset.ord&&oneOf('order','4식(명령)'))return;if(x.order!==el.dataset.ord&&noOrdGate())return;x.order=x.order===el.dataset.ord?'':el.dataset.ord;rerenderCmd()});
   blk.querySelectorAll('[data-cmd]').forEach(el=>el.onclick=()=>{if(el.classList.contains('dis'))return;if(x.command!==el.dataset.cmd&&oneOf('command','6령(지령)'))return;if(x.command!==el.dataset.cmd&&noOrdGate())return;x.command=x.command===el.dataset.cmd?'':el.dataset.cmd;rerenderCmd()});
   blk.querySelectorAll('[data-pdecl]').forEach(el=>el.onclick=()=>{if(el.classList.contains('dis'))return;const n=el.dataset.pdecl;x.pots=x.pots||[];const i=x.pots.indexOf(n);if(i>=0)x.pots.splice(i,1);else x.pots.push(n);rerenderCmd()});
   if(bnd)blk.querySelectorAll('[data-f]').forEach(el=>{const h=()=>{const f=el.dataset.f;const cu=CMD[tid];if(!cu)return;/* 폼을 되붙여 써도 지금의 CMD 를 본다 */const xm=cu.mons[el.dataset.mid]||cu.mons[UIC.tab[tid]];if(!xm)return;if(f==='prio')xm.prio[el.dataset.slot]=el.value;if(f==='ochg')xm.ochg[el.dataset.slot]=el.value;if(f==='detail')cu.detail=el.value};el.addEventListener('input',h);el.addEventListener('change',h)})})}
 const MULTI_RANGE=/전체|적진|자진|자신 이외|[2-9]체/;
 /* 11-03 특수 효과(sp) 와 기술이 맞나: 타입(e.types · 기술 타입 영문) · 태그(e.tg) · 분류(물리 · 특수 · 변화 · 접촉) */
 function spHit(e,mv,tys){if(!e||!mv)return false;if(e.types&&e.types.length&&!(tys||[]).some(t=>e.types.includes(t)))return false;
  if(e.tg&&e.tg.length){const T=String(mv.tag||'')+','+(mv.tags||[]).join(',')+','+String(mv.name||'');if(!e.tg.some(x=>T.includes(x)))return false}
  if(e.cat){if(e.cat==='접촉'){if(String(mv.contact||'')!=='O')return false}else if(e.cat!==mv.cat)return false}return true}
 const spL=(m,k)=>FX()&&FX().spOf?FX().spOf(m,k):[];
 const mvTysRaw=mv=>String((mv&&mv.type)||'').split(/[()/,]/).map(t=>t.trim()).filter(Boolean).map(S().typeEn);
 /* 끌어오기: 상대 쪽(공격하는 포켓몬과 다른 편)에 맞는 「끌어오기」가 있으면 그 포켓몬 자리. 단일 대상 기술만 */
 function redirectOf(b,atk,mv){if(!mv||String(mv.range||'')!=='1체')return null;const slots=allEntered(b);for(const s of slots){const m=s.mon;if(!m||m.id===atk.id||sameT(m,atk,b)||m.hp.cur<=0)continue;const e=spL(m,'redirect').find(x=>spHit(x,mv,mvTysRaw(mv)));if(e)return {slot:s.slot,mon:m,e}}return null}
 function defaultTargets(b,mid,moveIdx){const m=b.mons[mid];if(!m||moveIdx===''||moveIdx==='switch')return [];const mv=MVS(m)[+moveIdx];if(!mv)return [];
  {const rd=redirectOf(b,m,mv);if(rd)return [rd.slot]}
  const slots=allEntered(b);const my=slots.find(s=>s.mon.id===mid);const r=String(mv.range||'');
  const enemies=slots.filter(s=>!sameT(s.mon,m,b)),allies=slots.filter(s=>sameT(s.mon,m,b)&&s.mon.id!==mid);
  if(r==='자신')return my?[my.slot]:[];if(r==='상대 전체'||r==='적진')return enemies.map(s=>s.slot);if(r==='아군 전체'||r==='자진')return slots.filter(s=>sameT(s.mon,m,b)).map(s=>s.slot);
  if(r==='자신 이외')return slots.filter(s=>s.mon.id!==mid).map(s=>s.slot);if(r==='전체'||r==='필드 전체')return slots.map(s=>s.slot);
  if(r==='아군')return allies.map(s=>s.slot).slice(0,1);
  if(r==='상대 2체')return enemies.map(s=>s.slot).slice(0,2);
  if(mv.name==='발버둥'&&enemies.length)return [enemies[Math.floor(Math.random()*enemies.length)].slot];   /* 무작위한 상대에게 */
  return enemies.map(s=>s.slot).slice(0,1)}

 /* ---------- 11-03 감우: 턴 체크포인트 · 배틀 저장 · 이어서 하기 ----------
    턴 개시 처리가 끝난 모습(state.battle 전체)을 방 상태 밖 om_snap 표에 남긴다 (supabase/patch_2026-11-03_배틀.sql · kind 'turn' 은 방마다 최근 3턴).
    함수가 없는 DB 면 이 브라우저(localStorage om_bsnap_<방>)에만 — 다른 화면에서는 안 보인다. 복원은 battle 전체를 한 번에 쓴다 */
 const SNAPC={server:null};
 const snapKey=()=>'om_bsnap_'+A().ST.room;
 function snapLocal(){try{const x=JSON.parse(localStorage.getItem(snapKey())||'null');if(x&&Array.isArray(x.turns)&&Array.isArray(x.saves))return x}catch(e){}return {turns:[],saves:[]}}
 function snapLocalSave(x){for(let i=0;i<8;i++){try{localStorage.setItem(snapKey(),JSON.stringify(x));return true}catch(e){if(x.saves.length)x.saves.shift();else if(x.turns.length)x.turns.shift();else return false}}return false}
 const snapNoFn=e=>{const S=DBS().snap;return !!(S&&S.noFn&&(S.noFn((e&&e.raw)||e)||S.noFn(e)))};
 async function snapPut(kind,name,data){const ST=A().ST;const id=(kind==='turn'?'t':'s')+Date.now().toString(36)+Math.random().toString(36).slice(2,6);const turn=+data.turn||0;
  if(SNAPC.server!==false&&DBS().snap){try{await DBS().snap.put(ST.room,ST.secret,id,kind,name,turn,data);SNAPC.server=true;return {id,server:true}}catch(e){if(!snapNoFn(e))throw e;SNAPC.server=false}}
  const x=snapLocal();const row={id,kind,name,turn,at:Date.now(),w:ST.role==='gm'?'gm':ST.seat,data};if(kind==='turn'){x.turns.push(row);while(x.turns.length>3)x.turns.shift()}else x.saves.push(row);
  if(!snapLocalSave(x))A().toast('이 브라우저에 저장할 자리가 없다');return {id,server:false}}
 async function snapList(kind){const ST=A().ST;if(SNAPC.server!==false&&DBS().snap){try{const L=await DBS().snap.list(ST.room,ST.secret,kind);SNAPC.server=true;return (L||[]).map(r=>Object.assign({},r,{at:+new Date(r.at)||0}))}catch(e){if(!snapNoFn(e))throw e;SNAPC.server=false}}
  const x=snapLocal();return [...(kind==='turn'?x.turns:kind==='save'?x.saves:[...x.turns,...x.saves])].map(r=>Object.assign({},r,{data:undefined})).sort((a,b)=>b.at-a.at)}
 async function snapGet(id){const ST=A().ST;if(SNAPC.server){const r=await DBS().snap.get(ST.room,ST.secret,id);return r&&r.data?r.data:null}const x=snapLocal();const r=[...x.turns,...x.saves].find(r=>r.id===id);return r?r.data:null}
 async function snapDel(id){const ST=A().ST;if(SNAPC.server)return DBS().snap.del(ST.room,ST.secret,id);const x=snapLocal();x.turns=x.turns.filter(r=>r.id!==id);x.saves=x.saves.filter(r=>r.id!==id);snapLocalSave(x);return true}
 async function snapTurn(){const b=snap(ctx().b);if(!b.started)return;const r=await snapPut('turn','TURN '+(+b.turn||0),b);SNAPC.last={id:r.id,turn:+b.turn||0,server:r.server}}
 /* 되돌리기는 GM, 또는 GM 이 접속해 있지 않은 모의전(진행 권한이 있는 좌석) */
 function canRewind(c){if(c.gm)return true;if(!c.mgr)return false;const P=A().presList?A().presList():[];return !P.some(p=>p.role==='gm')}
 async function restoreBattle(data,why){if(!data||typeof data!=='object')return false;CMD={};for(const k in FAINT_SEEN)delete FAINT_SEEN[k];
  const ok=await A().setMany([[['battle'],data],[['ready'],{}]]);if(!ok)return false;A().sysLog(why,'battle');return true}
 async function rewindTurn(){const c=ctx();if(!canRewind(c))return A().toast('되돌리기는 GM 또는 GM 없는 모의전에서만');let L=[];try{L=await snapList('turn')}catch(e){return A().toast('체크포인트를 읽지 못했다: '+e.message)}
  const T=+c.b.turn||0;const r=L.find(x=>+x.turn===T)||L[0];if(!r)return A().toast('체크포인트가 없다 — 턴 개시 뒤에 생긴다');
  const when=r.at?new Date(r.at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}):'';
  if(!(await askYes(`TURN ${r.turn} 턴 개시 직후${when?' ('+when+')':''}로 되돌릴까?${+r.turn!==T?`\n(지금은 TURN ${T} — 이 턴의 체크포인트가 없어 가장 가까운 것)`:''}\n그 뒤의 공격 · HP · 상태 · 공개된 지시가 전부 지워진다 (로그는 남는다 · 선행 입력한 비밀 지시는 남는다)`,'되돌린다','그대로')))return;
  let data=null;try{data=await snapGet(r.id)}catch(e){return A().toast('읽지 못했다: '+e.message)}if(!data)return A().toast('체크포인트가 비어 있다');
  if(await restoreBattle(data,`↶ 되돌리기 — TURN ${r.turn} 턴 개시 직후로 (${c.gm?'GM':c.ST.name||c.seat})`))A().toast(`TURN ${r.turn} 처음으로 되돌렸다`)}
 async function saveBattleAs(){const c=ctx();if(!c.mgr)return;const b=c.b;if(!b.trainers||!Object.keys(b.trainers).length)return A().toast('저장할 배틀이 없다');
  const d=new Date();const def=`TURN ${+b.turn||0} · ${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  const name=prompt('저장 이름',def);if(name==null)return;try{const r=await snapPut('save',String(name).trim()||def,snap(b));A().toast(r.server?`「${String(name).trim()||def}」 저장했다`:`「${String(name).trim()||def}」 — 이 브라우저에만 저장했다 (SQL 패치 전)`);A().sysLog(`배틀 저장 「${String(name).trim()||def}」`,'battle')}catch(e){A().toast('저장 실패: '+e.message)}}
 async function openResume(){const c=ctx();if(!c.mgr)return;const md=A().openModal(`<div class="mhead"><h2>배틀 저장 · 이어서 하기</h2><span class="sp"></span><button class="btn sm pri" id="snapSave" title="지금 배틀 전체를 이름 붙여 저장 (방 상태 밖)">지금 저장</button><button class="btn ghost" data-x>닫기</button></div><div id="snapls" class="small dim">읽는 중…</div>`);
  $('#snapSave',md).onclick=async()=>{await saveBattleAs();draw()};
  const draw=async()=>{let L=[];try{L=await snapList('save')}catch(e){$('#snapls',md).innerHTML=`<div class="small" style="color:var(--red)">읽지 못했다: ${esc(e.message)}</div>`;return}
   const me=c.gm?'gm':c.seat;const fmt=t=>t?new Date(t).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
   $('#snapls',md).innerHTML=`<div class="small dim" style="margin-bottom:8px">${SNAPC.server===false?'⚠ 서버에 om_snap 이 아직 없어 이 브라우저의 저장만 보인다 (supabase/patch_2026-11-03_배틀.sql)':'방마다 60개까지 · 이어서 하면 지금 배틀을 덮는다 (먼저 「배틀 저장」으로 남겨 둘 것)'}</div>
    ${L.length?L.map(r=>`<div class="row" style="gap:8px;padding:6px 0;border-bottom:1px dashed var(--line)"><div style="flex:1;min-width:160px"><b>${esc(r.name||'(이름 없음)')}</b><div class="small dim">TURN ${+r.turn||0} · ${fmt(r.at)}${r.w?' · '+esc(r.w==='gm'?'GM':(((c.b.trainers||{})[r.w]||{}).name||r.w)):''}${r.bytes?' · '+Math.round(r.bytes/1024)+'KB':''}</div></div><button class="btn sm pri" data-rs="${esc(r.id)}">이어서 하기</button>${(c.gm||r.w===me||!r.w)?`<button class="btn sm ghost danger" data-rd="${esc(r.id)}">삭제</button>`:''}</div>`).join(''):'<div class="small dim">저장한 배틀이 없다 — 배틀 화면의 「배틀 저장」</div>'}`;
   md.querySelectorAll('[data-rs]').forEach(b=>b.onclick=async()=>{const r=L.find(x=>x.id===b.dataset.rs);if(!r)return;if(!(await askYes(`「${r.name}」 (TURN ${+r.turn||0}) 를 불러와 지금 배틀을 덮을까?\n지시는 다시 입력한다`,'이어서 한다','그대로')))return;let data=null;try{data=await snapGet(r.id)}catch(e){return A().toast('읽지 못했다: '+e.message)}if(!data)return A().toast('저장이 비어 있다');A().closeModal();if(await restoreBattle(data,`▶ 이어서 하기 — 저장 「${r.name}」 (TURN ${+r.turn||0}) 불러옴`))A().toast(`「${r.name}」 에서 이어서 한다`)});
   md.querySelectorAll('[data-rd]').forEach(b=>b.onclick=async()=>{const r=L.find(x=>x.id===b.dataset.rd);if(!r||!confirm(`「${r.name}」 저장을 지울까?`))return;try{await snapDel(r.id)}catch(e){return A().toast('지우지 못했다: '+e.message)}draw()})};
  draw()}
 /* ---------- 11-03 감우: 지시 입력 제한 시간 — battle.deadline (ms). 띠의 숫자 칸(#bdl)만 1초마다 갱신, 시간이 지나면 진행 권한에게 「행동 없음으로 두고 진행」 ---------- */
 function dlHtml(c,b){const dl=+b.deadline||0;if(!dl||(+b.phase||0)!==0)return '';const left=dl-Date.now();if(left>0){const s=Math.ceil(left/1000);return `<span class="bdlt ${s<=30?'hot':''}" title="지시 입력 제한 시간">⏱ ${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}</span>`}
  return `<span class="bdlt over">⏱ 시간 종료</span>${c.mgr?`<button class="btn xs pri" data-act="dlgo" title="아직 준비 완료가 아닌 자리는 행동 없음으로 두고 턴을 개시한다">준비 안 된 자리를 행동 없음으로 두고 진행</button>`:''}`}
 function dlTick(){const el=document.getElementById('bdl');if(!el)return;const c=ctx();const h=dlHtml(c,c.b);if(el._h===h)return;el.innerHTML=h;el._h=h;el.querySelectorAll('[data-act]').forEach(bt=>bt.onclick=()=>action(bt.dataset))}
 setInterval(()=>{try{dlTick()}catch(e){}},1000);
 /* ---------- 11-03 감우: 휴대폰에서 상태 칩 설명 — title 은 터치로 못 보니 칩을 누르면 작은 팝오버 (마우스도 같다) ---------- */
 function stPop(anchor,k,txt){document.querySelectorAll('.stpop').forEach(e=>e.remove());const db=(DB().states||{}).st||{};const d=db[k]||{};const body=txt||(d.desc||[]).join(' ');if(!body&&!d.ko)return;
  const p=document.createElement('div');p.className='stpop';p.innerHTML=`<b>${esc(d.ko||k)}</b>${d.abn?' <span class="tag" style="color:var(--red)">상태 이상</span>':''}<div class="stpb">${esc(body||'설명이 없다')}</div><button class="btn xs ghost" data-x>닫기</button>`;document.body.appendChild(p);
  const r=anchor.getBoundingClientRect();const W=Math.min(300,window.innerWidth-16);p.style.width=W+'px';let x=Math.max(8,Math.min(window.innerWidth-W-8,r.left));let y=r.bottom+6;if(y+p.offsetHeight>window.innerHeight-8)y=r.top-p.offsetHeight-6;y=Math.max(8,Math.min(window.innerHeight-p.offsetHeight-8,y));p.style.left=x+'px';p.style.top=y+'px';
  const off=ev=>{if(ev&&ev.type==='click'&&p.contains(ev.target)&&!ev.target.closest('[data-x]'))return;p.remove();document.removeEventListener('click',off,true);document.removeEventListener('keydown',kd);window.removeEventListener('scroll',off,true)};const kd=e=>{if(e.key==='Escape')off()};
  setTimeout(()=>{document.addEventListener('click',off,true);document.addEventListener('keydown',kd)},0);setTimeout(()=>{if(p.isConnected)window.addEventListener('scroll',off,true)},400)}
 document.addEventListener('click',e=>{const t=e.target.closest('[data-stinfo]');if(!t||e.target.closest('[data-sd],[data-soff],.stx'))return;e.preventDefault();e.stopPropagation();stPop(t,t.dataset.stinfo,t.getAttribute('title')||'')},true);
 /* ---------- 동작 ---------- */
 /* 페이즈 버튼 = 그 단계의 처리까지 (맵툴 progress_turn 처럼). 「턴 진행 ▶」은 다음 단계로 */
 /* 11-03 감우: 페이즈 버튼으로 지금보다 앞 단계로 갈 때는 묻는다 (지시 준비로 가면 지시 · 준비 · 순서가 지워진다). 「턴 진행 ▶」의 정상 진행은 묻지 않는다 (o.force) */
 const PH_NAME={0:'지시 준비',1:'턴 개시',2:'행동 순서',3:'행동 처리',5:'턴 종료'};
 async function setPhase(p,o){o=o||{};const c=ctx();if(!c.mgr)return;const b=c.b;p=+p;const cur=+b.phase||0;
  if(!o.force&&p<cur){const q=p===0?`「지시 준비」로 돌아가면 이번 턴의 공개된 지시 · 준비 완료 · 행동 순서가 지워진다 (비밀 지시는 남는다).\n지금 단계: ${PH_NAME[cur]||cur}`:`지금 「${PH_NAME[cur]||cur}」인데 앞 단계 「${PH_NAME[p]||p}」로 돌아갈까?\n(그 단계의 처리를 다시 한다)`;if(!(await askYes(q,'돌아간다','그대로')))return}
  if(p===0){await A().setMany([[['battle','cmds'],{}],[['ready'],{}],[['battle','order'],[]],[['battle','phase'],0]]);A().sysLog('페이즈: 지시 준비 — 지시를 입력하고 「준비 완료」','battle');return}
  if(p===1){const tids=Object.keys(b.trainers||{});const ready=c.ST.state.ready||{};const seats=c.ST.state.seats||{};const notReady=tids.filter(t=>seats[t]&&!ready[t]);
   if(notReady.length&&!o.force&&!(await askYes(`아직 준비 완료가 아닌 트레이너: ${notReady.map(t=>b.trainers[t].name).join(', ')}\n그래도 턴을 개시할까?`)))return;
   if(notReady.length&&o.timeout)A().sysLog(`제한 시간 종료 — 준비 안 된 자리(${notReady.map(t=>(b.trainers[t]||{}).name||t).join(' · ')})는 행동 없음으로 두고 진행`,'battle');
   if(!b.started){await startBattle();if(!ctx().b.started)return;await new Promise(r=>setTimeout(r,2600))}
   /* 11-03 감우: 칸마다 따로 쓰던 것을 한 번에 (om_jset_many · 없으면 칸마다) */
   const ops=[[['ready'],{}],[['battle','cmds'],{}],[['battle','host'],c.gm?'gm':c.seat]];if(b.deadline)ops.push([['battle','deadline'],null]);if(b.tstep)ops.push([['battle','tstep'],null]);if(b.swPur)ops.push([['battle','swPur'],null]);if(b.swOut)ops.push([['battle','swOut'],null]);ops.push([['battle','phase'],1]);
   /* 맵툴 set_turn_start: 턴을 연 순간 필드에 있던 포켓몬은 started (이 턴 도중에 들어온 포켓몬만 「교대 등장」) */
   for(const m of Object.values(ctx().b.mons||{}))if(m.entry&&!m.started)ops.push([['battle','mons',m.id,'started'],true]);
   if(!await A().setMany(ops))return;
   await preCharge();const TN=+ctx().b.turn||1;cutPhase('턴 개시',`TURN ${TN}`);A().sysLog(`턴 개시 — TURN ${TN}${TN<=1?'\n「턴 진행 ▶」: 교대 알림 → 『지령』 & 『포텐셜』 발동 → 행동 순서 · 지시는 행동 순서가 오면 차례대로 공개':''}`,'battle');try{await autoTurnStart()}catch(e){console.warn('턴 개시 자동',e)}
   /* 11-03 감우: 턴 개시 처리가 끝난 모습을 체크포인트로 (「↶ 이 턴 처음으로」) — 방 상태 밖 om_snap, 없으면 이 브라우저 */
   try{await snapTurn()}catch(e){console.warn('턴 체크포인트',e)}return}
  if(p===2)return computeOrder();
  if(p===3){await A().setMany([[['battle','orderIdx'],0],[['battle','phase'],3]]);cutPhase('행동 처리','순서대로 공격');A().sysLog('행동 처리 — 순서대로 「공격」, 끝나면 「다음 행동 ▶」','battle');return}
  if(p===5)return endFlow()}
 /* 행동 순서에서 이 포켓몬 차례가 왔나 (지금 · 지난 차례) */
 function turnReached(b,m){const ord=b.order||[];const i=ord.findIndex(o=>o.mid===m.id);return i>=0&&i<=(+b.orderIdx||0)}
 /* 순서 열쇠: 행동 순서 계산에 드는 것만 (교대 여부 · 우선도/순서 바꾸기 · 기술 우선도 · 따라가때리기). 기술 이름·대상은 차례가 올 때 공개 */
 function okeyOf(m,x){x=x||{};const pm={},om={};for(const k in (x.prio||{}))if(x.prio[k]!=='')pm[k]=+x.prio[k];for(const k in (x.ochg||{}))if(x.ochg[k]!=='')om[k]=+x.ochg[k];
  const mv=(x.move!==''&&x.move!=='switch'&&x.move!=null)?MVS(m)[+x.move]:null;
  const o={sw:x.move==='switch'?1:0,...(x.move==='switch'&&x.switch?{st:String(x.switch)}:{}),pm,om,pr:mv?(FX()?FX().prioOf(m,mv):(+mv.prio||0)):0,mv:mv?1:0};
  if(mv&&(isPursuit(mv,m)||x.pur)){o.pn=mv.name;o.tg=tgNow(ctx().b,x,m);o.psrc=isPursuit(mv,m)?((m.flags||{}).pursuit?(m.flags.pursuitBy||''):''):(x.pur||'')}
  const pimm=x.pimm||((m.flags||{}).pursuitImmune?(m.flags.pursuitImmuneBy||'추격 무시'):'');if(pimm)o.pimm=pimm;if(mv&&(isUturn(mv,m)||x.ut||x.uman))o.ut=1;return o}
 /* 좌석: 턴 개시 때 내 순서 열쇠를 cmds[내 자리].ok 에 올린다 (진행하는 사람이 남의 비밀 지시를 못 읽어도 순서를 계산하게) */
 /* 11-03 21:30 (아니스 시온 「행동 진행을 안 누르는 쪽은 우선도가 반영 안 된다」): 열쇠는 턴 개시 때 한 번만 올라가서, 그 뒤(선행 발동 등)에 생긴 우선도 효과가 남의 화면 계산에 안 들어갔다.
    열쇠에 우선도에 닿는 상태의 지문(sig)을 붙이고, 지문이 바뀌면 다시 올린다. 계산하는 쪽은 지문이 맞을 때까지 잠깐 기다린다 */
 function prioSig(b,tid){return Object.values((b&&b.mons)||{}).filter(m=>m&&m.tid===tid&&m.entry&&m.hp&&m.hp.cur>0).sort((x,y)=>String(x.id).localeCompare(String(y.id))).map(m=>m.id+':'+JSON.stringify(((m.fx||{}).prio)||[])+':'+(m.prioDown?1:0)+':'+(m.ability||'')+':'+(m.item||'')).join('|')}
 async function publishOk(tid0,force){const c=ctx();const b=c.b;const tid=tid0||c.seat;if(!(c.role==='seat'||(c.gm&&!seatOwned(c,tid)))||!tid||!(b.trainers||{})[tid])return;   /* 11-03 21:51: GM 몫(NPC · GM 이 불러온 파티)도 GM 화면이 올린다 — 좌석이 진행할 때 GM 쪽 우선도 · 교대가 빠지던 것 */const key=turnKey(b);const cur=((b.cmds||{})[tid]||{}).ok;const sig=prioSig(b,tid);if(!force&&((cur&&cur.key===key&&cur.sig===sig)||BUSY.ok===key+tid+sig))return;BUSY.ok=key+tid+sig;const t=b.trainers[tid];try{
  const cm=await myCmd(c,tid,true);const ok={key,sig,m:{}};for(const mm of Object.values(b.mons||{}).filter(x=>x.tid===tid&&x.entry&&x.hp.cur>0)){const xx=((cm||{}).mons||{})[mm.id]||{};ok.m[mm.id]=okeyOf(mm,xx);if(preCounts(t,xx,mm))ok.m[mm.id].pi=1}if(upCounts(t,(cm||{}).upots))ok.pre=1;
  if((ctx().b.cmds||{})[tid])await A().set(['battle','cmds',tid,'ok'],ok);else await A().set(['battle','cmds',tid],{ok})}catch(e){BUSY.ok='';console.warn('publishOk',e)}}
 /* 차례가 온 포켓몬의 지시를 연다: 주인 화면이, GM 몫(NPC · GM 이 불러온 파티)은 GM 화면이. 보통 모드의 GM 은 플레이어가 안 열면 잠시 뒤 대신 연다 */
 const RVT={};
 async function autoRevealTurn(){const c=ctx();const b=c.b;if((+b.phase||0)<2)return;const o=(b.order||[])[+b.orderIdx||0];if(!o)return;const m=(b.mons||{})[o.mid];if(!m||!m.entry||m.hp.cur<=0||revealed(b,m.tid,m.id))return;
  const key=turnKey(b)+':'+m.id;if(SENT['rv:'+key]||BUSY.rv)return;
  const run=async()=>{const b2=ctx().b;const o2=(b2.order||[])[+b2.orderIdx||0];if(!o2||o2.mid!==m.id||revealed(b2,m.tid,m.id)||SENT['rv:'+key])return;SENT['rv:'+key]=1;BUSY.rv=1;try{await revealOne(m.tid,m.id,true)}finally{BUSY.rv=0}};
  if(c.role==='seat'&&lead(c,m.tid))return run();
  if(!c.gm||(b.host||'gm')!=='gm')return;if(!isLeader(c))return;if(c.fair&&seatOwned(c,m.tid))return;
  if(!seatOwned(c,m.tid))return run();
  if(!RVT[key])RVT[key]=setTimeout(run,2500)}
 function unrevealed(b){const out=[];for(const tid in b.trainers||{}){const t=b.trainers[tid];const mons=Object.values(b.mons||{}).filter(m=>m.tid===tid&&m.entry&&m.hp.cur>0);for(const m of mons)if(!revealed(b,tid,m.id))out.push(`${t.name} ${String(m.entry).toUpperCase()}`)}return out}
 async function progressTurn(){const c=ctx();if(!c.mgr)return;const p=+c.b.phase||0;
  /* 10-26: 행동 처리 중에 「턴 진행」을 또 누르면 남은 행동이 통째로 건너뛰어졌다 — 물어본다 */
  if(p===3){const O=c.b.order||[];const i0=+c.b.orderIdx||0;if(O.slice(i0).some(o=>{const m=(c.b.mons||{})[o.mid];return m&&m.entry&&m.hp.cur>0})&&!(await askYes('아직 행동하지 않은 포켓몬이 있다. 그래도 턴 종료로 넘어갈까?','넘어간다','돌아간다')))return}if(p===1)return stepTurn();const next={0:1,1:2,2:3,3:5,5:0}[p];if(next==null)return;return setPhase(next,{force:true})}
 /* ----- 턴 개시 단계 (맵툴 set_turn_start → 1.5 set_turn_potential → 2): ① 교대가 있으면 교대 알림 · 교대 처리 → ② 선행 입력이 있으면 『지령』 & 『포텐셜』 발동 알림 → 행동 순서 (10-21 망령) ----- */
 /* 턴 개시 「『지령』 & 『포텐셜』 발동」 컷인에 세는 선행 (10-24 망령): 4식(버텨라! · 물러나! …)은 공격받을 때 쓰는 것이라 턴 개시에 뜨지 않는다 — 글에 「턴 개시」 가 있으면 센다 */
 /* 10-23 망령: 선행 포텐셜은 글에 「턴 개시」 가 있을 때만 · 지령(6령)은 늘 · 결계 · 법계(5계)는 늘 · 4식 등 다른 지시는 「턴 개시」 가 있을 때만 */
 const TS=s=>/턴\s*개시/.test(String(s||'').replace(/<br\s*\/?>/g,' '));
 const potRowOf=n=>((DB().maker||{}).pots||[]).find(r=>r[1]===n||r[1]==='『'+n+'』');
 const rmText=n=>{const R=(window.OM_DB||{}).readymade||{};return (R[n]||{}).text||''};
 const PRE_LATER=/받(?:을|았을|으면|는)|맞(?:을|았을|으면)|명중\s*굴림|명중굴림|공격(?:할|하기|을 받|받을)|기술을\s*(?:쓸|사용할|낼)|다음\s*(?:기술|공격|행동)|행동(?:할|하기|한 뒤|했을)|쓰러|빈사|교대|등장|퇴장|턴\s*종료|【\s*(?:임의|사전)\s*】/;
 /* 선행 입력한 포텐셜이 턴 개시(선행 발동)에 발동하나: 'now' — 글에 「턴 개시」 · 이름이 결계/법계 · 【선행】인데 따로 때(받을 때 · 명중굴림 · 다음 기술 …)가 없다 / 'later' — 조건 때 손으로 */
 function preWhen(pn,m){const p=m?potSrc(m).find(q=>q.name===pn):null;const row=potRowOf(pn);const tx=String((p&&p.eff)||(row&&row[2])||rmText(pn)||'').replace(/<br\s*\/?>/g,' ');
  if(TS(tx)||/결계|법계/.test(pn)||/메가진화/.test(pn+' '+tx)&&!PRE_LATER.test(tx.replace(/메가진화/g,'')))return 'now';if(/【\s*선행\s*】/.test(tx)&&!PRE_LATER.test(tx))return 'now';return 'later'}
 function preCounts(t,x,m){x=x||{};if(x.command)return true;
  if(x.order){const n=OO().orderName(t||{},x.order);const row=potRowOf(n);if((row&&row[0]==='5계')||/결계|법계/.test(n))return true;if(row&&TS(row[2]))return true;if(!row&&TS(rmText(n)))return true}
  for(const pn of x.pots||[])if(preWhen(pn,m)==='now')return true;
  return false}
 function upCounts(t,ups){for(const n of ups||[]){const u=((t&&t.unique)||[]).find(q=>q&&q.name===n);if(TS(u&&u.eff)||(!u&&TS(rmText(n))))return true}return false}
 async function turnInfo(c,b){let rows=[];try{rows=(await DBS().secretGet(c.ST.room,c.ST.secret,'cmd')||[]).filter(r=>cmdFresh(r,b))}catch(e){}
  const SEC={},PRE={},UP={};const live=mid=>{const mm=(b.mons||{})[mid];return mm&&mm.entry&&mm.hp.cur>0};
  for(const r of rows){const d=r.data||{};if(!(b.trainers||{})[r.id])continue;if(upCounts(b.trainers[r.id],d.upots))PRE[r.id]=UP[r.id]=1;for(const mid in (d.mons||{})){const x=d.mons[mid]||{};SEC[mid]=x;if(live(mid)&&preCounts(b.trainers[r.id],x,b.mons[mid]))PRE[r.id]=1}}
  const tk=turnKey(b);for(const tid in b.trainers||{}){const ok=((b.cmds||{})[tid]||{}).ok;if(!ok||ok.key!==tk)continue;if(ok.pre)PRE[tid]=1;for(const mid in (ok.m||{}))if(ok.m[mid].pi&&live(mid))PRE[tid]=1}   /* 교대로 나간 포켓몬의 선행은 세지 않는다 */
  const keyOf=m=>{if(SEC[m.id])return okeyOf(m,SEC[m.id]);const ok=((b.cmds||{})[m.tid]||{}).ok;if(ok&&ok.key===tk&&ok.m&&ok.m[m.id])return ok.m[m.id];const px=(((b.cmds||{})[m.tid]||{}).mons||{})[m.id];return px?okeyOf(m,px):null};
  return {SEC,PRE,UP,keyOf}}
 async function stepTurn(){const c=ctx();if(!c.mgr)return;const b=c.b;if((+b.phase||0)!==1)return;const st=+b.tstep||0;const I=await turnInfo(c,b);const slots=allEntered(b);const TN=tid=>((b.trainers||{})[tid]||{}).name||'?';
  if(st<1){const sw=slots.filter(s=>{const k=I.keyOf(s.mon);return k&&k.sw});
   if(sw.length){const swTo=mo=>{const k=I.keyOf(mo)||{};const id=k.st||(I.SEC[mo.id]||{}).switch||((((b.cmds||{})[mo.tid]||{}).mons||{})[mo.id]||{}).switch;return (b.mons||{})[id]||null};   /* 10-28 망령: 「교대 대상 미정」 — 비밀 지시(SEC) · 확정 지시(ok.m)에 든 교대 대상을 먼저 본다 (공개 지시 칸은 비어 있을 때가 있다) */   /* 10-27 망령: 교대 알림에 누구와 바꾸는지 · 그림 */
    const L=sw.map(s=>{const w=swTo(s.mon);return `${TN(s.mon.tid)} — ${String(s.mon.entry).toUpperCase()} ${s.mon.name} ⇄ ${w?w.name:'?'}`});
    const RV=sw.map(s=>{const w=swTo(s.mon);return {tr:TN(s.mon.tid),mid:s.mon.id,name:s.mon.name,img:s.mon.image||'',side:s.mon.side,area:String(s.mon.entry||'').toUpperCase(),sw:{name:w?w.name:'(교대 대상 미정)',img:w?w.image||'':''}}});
    /* 따라가때리기: 교대하려는 포켓몬을 노린 추격은 교대 전에 먼저 (맵툴 get_turn_pursuit) — 그 포켓몬은 이번 턴 행동을 쓴 것으로 본다 */
    const pl=[],pur=[];for(const s of slots){const k=I.keyOf(s.mon);if(!k||!k.pn)continue;for(const tg of (k.tg||[])){const v=sw.find(z=>z.slot===tg);if(!v)continue;const kv=I.keyOf(v.mon)||{};
      if(kv.pimm){pl.push(`${v.mon.name}의 『${kv.pimm}』 — ${s.mon.name}의 따라가때리기를 무시했다`);continue}
      pl.push(`${s.mon.name}의 「${k.pn}」 — 교대하려는 ${v.mon.name}을(를) 교대 전에 먼저 때린다! (공격 창에서 처리한 뒤 교대)`);pur.push({slot:s.slot,mid:s.mon.id,name:s.mon.name,side:s.mon.side,change:false,started:true,order:20,prio:0,speed:0,dice:0,move:k.pn,targets:[tg],pursuit:true,pursuitHit:v.mon.id,pursuitSrc:k.psrc||''});break}}
    {const ops=[[['battle','tstep'],1],[['battle','swPur'],pur.map(o=>o.mid)],[['battle','swOut'],sw.map(s=>s.mon.id)]];if(pur.length)ops.push([['battle','order'],pur],[['battle','orderIdx'],0]);await A().setMany(ops)}
    cutPhase('교대',sw.map(s=>s.mon.name).join(' · '));
    A().sysLog(`【교대 알림】\n${L.join('\n')}${pl.length?'\n'+pl.join('\n'):''}\n교대를 마치면 「턴 진행 ▶」`,'battle',{rv:RV,rvx:[...pl,'교대를 마치면 「턴 진행 ▶」']});return}}
  if(st<2){let tids=Object.keys(I.PRE).filter(t=>(b.trainers||{})[t]);
   /* 10-31 망령 「4식 · 6령 쓰는 방식이 시뮬과 다르다 — 꼭 고쳐」: 선행 입력한 지령(6령)은 턴 개시 때 저절로 「선행 발동」 (시뮬과 같다 — 시뮬은 지시 때 정한 지령을 그 자리에서 건다).
      횟수는 이미 턴 개시에서 깎였으니 효과만 건다. 4식은 맞을 때 공격 창이 쓰고(버텨라 · 피해라 …), 선행 포텐셜 · 「턴 개시」 4식은 그대로 「포텐셜 발동」에서 */
   {const AL=[];for(const [mid,x] of Object.entries(I.SEC)){const mm=(b.mons||{})[mid];if(!x||!x.command||!mm||!mm.entry||!(+(mm.hp||{}).cur>0))continue;const tid=mm.tid;if(!(b.trainers||{})[tid])continue;
     const fd=((((ctx().b.cmds||{})[tid]||{}).fired||{})[mid])||{};if(fd.command)continue;
     /* 턴 개시 차감(preCharge) 뒤에 지시를 넣었으면(예: 시합 개시와 턴 개시를 한 번에 누른 1턴) 여기서 1 깎고 건다 — 횟수 없이 공짜로 걸리지 않게 */
     {const tt=snap((ctx().b.trainers||{})[tid]||{});const pcK=tt.pcTurn===turnKey(ctx().b);const pcHad=!tt.pcList||((tt.pcList[mid]||{}).c===x.command);if(pcK?!pcHad:!(c.fair&&seatOwned(c,tid))){const ck='command_'+x.command;tt.orderCount=tt.orderCount||{};if(!(+tt.orderCount[ck]>0)){AL.push(`${TN(tid)} · ${mm.name} 『${OO().commandName((b.trainers||{})[tid],x.command)}』 — 남은 횟수가 없어 걸지 않았다`);continue}const t2=snap(tt);t2.orderCount[ck]=(+t2.orderCount[ck]||0)-1;if(pcK)t2.pcList=Object.assign({},t2.pcList||{},{[mid]:{o:((t2.pcList||{})[mid]||{}).o||'',c:x.command}});const sk=OO().shareKey(t2,x.command);if(sk)t2.orderCount['command_'+sk]=Math.max(0,(+t2.orderCount['command_'+sk]||0)-1);await A().setDiff(['battle','trainers',tid],tt,t2,1)}}
     try{await fireOrder(tid,mid,'command',x.command,'pre');const f2=((((ctx().b.cmds||{})[tid]||{}).fired||{})[mid])||{};if(f2.command)AL.push(`${TN(tid)} · ${mm.name} 『${OO().commandName((b.trainers||{})[tid],x.command)}』`);else AL.push(`${TN(tid)} · ${mm.name} 『${OO().commandName((b.trainers||{})[tid],x.command)}』 — 걸리지 않았다 (같은 무리 한 턴 하나 · 받을 수 없는 상태 — 「포텐셜 발동」에서 확인)`)}catch(e){console.warn('지령 자동 발동',e)}}
    if(AL.length)A().sysLog(`【지령 자동 발동】 선행 입력한 지령 · 영창\n${AL.join('\n')}`,'battle');
    /* 11-03 21:00 망령 「교대 뒤 선행 포텐셜」 · 「선행 포텐셜도 지령처럼 저절로」 · 「메진 전용을 선행 입력해 둬도 턴 개시에 알려 주지도 발동하지도 않아 깜빡」:
       선행 입력한 포텐셜 중 턴 개시에 쓰는 것(preWhen 'now')은 여기서 저절로 — 전용은 fireSpecial(횟수 · 컷인 · 구문), 메가진화 전용은 폼도 바꾼다, 일반은 「사용」(횟수 −1 · 구문). 조건 때 쓰는 것 · 구문 없는 효과는 이름을 적어 알린다 */
    /* 11-03 21:54: 십계 4식(결계 · 법계 — 명령 칸)과 글에 「턴 개시」가 있는 4식도 선행 입력했으면 여기서 저절로 「선행 발동」 (횟수는 턴 개시에 깎였다). 버텨라! · 피해라! 처럼 맞을 때 쓰는 4식은 그대로 공격 창에서 */
    {const OL=[];for(const [mid,x] of Object.entries(I.SEC)){const mm=(ctx().b.mons||{})[mid];if(!x||!x.order||!mm||!mm.entry||!(+(mm.hp||{}).cur>0))continue;const tid=mm.tid;const t=(ctx().b.trainers||{})[tid];if(!t)continue;
      const fd=((((ctx().b.cmds||{})[tid]||{}).fired||{})[mid])||{};if(fd.order)continue;if(c.fair&&seatOwned(c,tid))continue;
      const on=OO().orderName(t,x.order);const row=potRowOf(on);const turnStart=(row&&row[0]==='5계')||/결계|법계/.test(on)||TS(row&&row[2])||(!row&&TS(rmText(on)));if(!turnStart)continue;
      try{await fireOrder(tid,mid,'order',x.order,'pre');const f2=((((ctx().b.cmds||{})[tid]||{}).fired||{})[mid])||{};if(f2.order)OL.push(`${TN(tid)} · ${mm.name} 『${on}』`)}catch(e){console.warn('4식 자동 발동',e)}}
     if(OL.length)A().sysLog(`【명령 자동 발동】 선행 입력한 결계 · 턴 개시 4식\n${OL.join('\n')}`,'battle')}
    const MANT=new Set();{const PL=[],MAN=[];
     for(const [mid,x] of Object.entries(I.SEC)){const mm=(ctx().b.mons||{})[mid];if(!x||!(x.pots||[]).length||!mm||!mm.entry||!(+(mm.hp||{}).cur>0))continue;const tid=mm.tid;if(!(ctx().b.trainers||{})[tid])continue;
      for(const pn of x.pots){const fpot=((((ctx().b.cmds||{})[tid]||{}).fired||{})[mid]||{}).pot||{};const cur=(ctx().b.mons||{})[mid]||mm;
       if(preWhen(pn,cur)!=='now'){MAN.push(`${TN(tid)} · ${cur.name} 『${pn}』 — 조건이 되면 「포텐셜 발동 → 선행 발동」`);MANT.add(tid);continue}
       if(c.fair&&seatOwned(c,tid)){MAN.push(`${TN(tid)} · ${cur.name} 『${pn}』 — 주인이 「선행 발동」`);MANT.add(tid);continue}
       const sp=specialPots(cur).find(q=>q.p.name===pn);const a=FX()&&FX().autoOf(cur,'pot',pn);const auto=!!(a&&a.ops&&a.ops.length&&!a.manual);
       try{if(sp){if(fpot['e:'+pn])continue;if(sp.left!==null&&sp.left<=0){MAN.push(`${cur.name} 『${pn}』 — 남은 횟수가 없다`);MANT.add(tid);continue}
         await fireSpecial(tid,mid,'ex',pn,'pre');const fk=/메가진화/.test(pn+' '+(sp.p.eff||''))?formsOf((ctx().b.mons||{})[mid]||cur).findIndex(f=>f&&f.kind==='메가진화'):-1;
         if(fk>=0&&!((ctx().b.mons||{})[mid]||{}).form0)await doForm(mid,fk);
         PL.push(`${cur.name} 『${pn}』${fk>=0?' → 메가진화':''}`);if(fk<0&&!auto){MAN.push(`${cur.name} 『${pn}』 — 효과는 손으로`);MANT.add(tid)}}
        else{if(fpot['p:'+pn])continue;const pl=potList(cur).find(q=>q.name===pn);
         if(pl){const left=(cur.potUses||{})[pn]==null?pl.max:+(cur.potUses||{})[pn];if(left<=0){MAN.push(`${cur.name} 『${pn}』 — 남은 횟수가 없다`);MANT.add(tid);continue}await action({act:'usepot',mid,pot:pn})}
         else if(auto)await fireAuto(mid,'pot',pn,{quiet:true});
         else{const src=potSrc(cur).find(q=>q&&q.name===pn)||{};A().sysLog(`【포텐셜】 ${cur.name} 『${pn}』 【선행】`,'battle',{mid,img:cur.image||'',eff:String(src.eff||'').replace(/<br\s*\/?>/g,'\n').slice(0,400)})}
         await A().set(['battle','cmds',tid,'fired',mid,'pot','p:'+pn],1);PL.push(`${cur.name} 『${pn}』`);if(!auto){MAN.push(`${cur.name} 『${pn}』 — 효과는 손으로`);MANT.add(tid)}}}
       catch(e){console.warn('선행 포텐셜',e)}}}
     if(PL.length||MAN.length)A().sysLog(`【선행 발동】${PL.length?'\n저절로: '+PL.join(' · '):''}${MAN.length?'\n'+MAN.join('\n'):''}`,'battle')}
    const rest=tid=>{const t=(b.trainers||{})[tid];if(I.UP[tid]||MANT.has(tid))return true;return Object.entries(I.SEC).some(([mid,x])=>{const mm=(b.mons||{})[mid];const fo=((((ctx().b.cmds||{})[tid]||{}).fired||{})[mid]||{}).order;return mm&&mm.tid===tid&&mm.entry&&+(mm.hp||{}).cur>0&&x.order&&!fo&&preCounts(t,{order:x.order},mm)})};
    tids=tids.filter(rest)}
   if(tids.length){await A().set(['battle','tstep'],2);
    for(const tid of tids){const t=b.trainers[tid];cutFire('t:'+tid,trainerImg(t),'『지령』 & 『포텐셜』 발동',t.name,t.side==='left'?'#1f6fd1':'#e3101f','You used the Potential!')   /* 10-24 제보: 긴 영문이 큰 글자 칸에서 겹쳤다 — 이름은 크게, 영문은 대사 칸으로 */}
    A().sysLog(`【『지령』 & 『포텐셜』 발동】\n${tids.map(TN).join(' · ')}\n남은 선행(고유 · 명령 · 조건 때 쓰는 포텐셜)은 「포텐셜 발동」 → 「선행 발동」 (지령 · 턴 개시에 쓰는 선행 포텐셜은 저절로 걸었다 · 놓쳤으면 행동 순서 · 행동 처리 중에도 발동할 수 있다)\n끝나면 「턴 진행 ▶」`,'battle');return}}
  return computeOrder()}
 async function action(d,val){
  const c=ctx();const b=c.b;
  switch(d.act){
   case 'load':return A().openLoadParty(d.side);
   case 'unload':return A().unloadTrainer(d.tid);
   case 'clear':{const HL=window.OM_HALL_UI;if(HL&&HL.worth(b)){const r=await HL.offer(b,{clear:true});if(r==='cancel')return}else if(!confirm('배틀 상태를 전부 비울까? (좌석은 남는다)'))return}   /* 10-27 망령: 시합이 있었으면 전당에 남길지 묻는 창이 비우기 확인을 겸한다 */CMD={};for(const k in FAINT_SEEN)delete FAINT_SEEN[k];return A().set(['battle'],{turn:0,phase:0,mode:mode(b),sides:{left:{trainers:[]},right:{trainers:[]}},trainers:{},mons:{},field:{},cmds:{},order:[]});
   case 'iv':return A().openHatch(d.tid);
   /* 11-03 감우: 제한 시간 · 체크포인트 · 저장 */
   case 'deadline':{if(!c.mgr)return;const min=Math.max(0,Math.min(180,+val||0));const dl=min>0?Date.now()+min*60000:null;await A().set(['battle','deadline'],dl);A().sysLog(dl?`지시 입력 제한 시간 ${min}분 — ${new Date(dl).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})} 까지`:'지시 입력 제한 시간 없음','battle');return}
   case 'dlgo':{if(!c.mgr)return;if((+b.phase||0)!==0)return;if(!(await askYes('제한 시간이 지났다. 아직 준비 완료가 아닌 자리는 행동 없음으로 두고 턴을 개시할까?','개시한다','기다린다')))return;return setPhase(1,{force:true,timeout:true})}
   case 'rewind':return rewindTurn();
   case 'bsave':return saveBattleAs();
   case 'bresume':return openResume();
   case 'mode':if(c.b.started){A().toast('시합 중에는 에리어를 바꿀 수 없다');return A().renderScene()}return A().set(['battle','mode'],+val);
   case 'gmtake':{if(!c.gm)return;const t=(c.b.trainers||{})[d.tid];if(!t)return;const on=!t.gmTake;await A().set(['battle','trainers',d.tid,'gmTake'],on?true:null);A().sysLog(`${t.name} — ${on?'GM 이 맡는다 (빌려쓰기)':'플레이어에게 돌려줌'}`,'battle');return}
   case 'gmhands':{if(!c.gm)return;const on=!c.fair;await A().set(['rp','gmHands'],on?false:null);A().sysLog(on?'GM 이 PL 권한으로 전환 — 플레이어의 지시·상태를 건드리지 않는다':'GM 권한으로 복귀','battle');return}   /* 방 설정 「GM 불간섭」과 같은 값 */
   case 'areaswap':return areaSwap(d.mid);
   case 'field':return openField();
   case 'stage':return window.OM_STAGE_UI&&window.OM_STAGE_UI.info();
   case 'spmgr':return window.OM_SP_UI&&window.OM_SP_UI.open(d.side||'',d.tid||'');
   case 'cards':return window.OM_DECK_UI&&window.OM_DECK_UI.battleHand(d.tid,{pickAnchor:tid=>window.OM_SP_UI&&window.OM_SP_UI.pickAnchorFor?window.OM_SP_UI.pickAnchorFor(tid):Promise.resolve('')});
   case 'stagemgr':return window.OM_STAGE_UI&&window.OM_STAGE_UI.open(d.side||'',d.tid||'');
   case 'orders':return openOrders(d.tid);
   case 'co':return openCo(d.tid);
   case 'copick':{const b=c.b;const ids=(((b.sides||{})[d.side]||{}).trainers||[]).filter(t=>coBtn(c,t));const md=A().openModal(`<div class="mhead"><h2>함께 지시 — 트레이너 고르기</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="mmenu">${ids.map(t=>`<button class="btn" data-cop="${t}">${esc(((b.trainers||{})[t]||{}).name||t)}</button>`).join('')}</div>`);md.querySelectorAll('[data-cop]').forEach(x=>x.onclick=()=>{A().closeModal();openCo(x.dataset.cop)});return}
   case 'solo':return toggleSolo(d.tid);
   case 'dexmgr':{if(!(c.gm||ownT(c,d.tid)))return;return window.OM_DEX_UI&&window.OM_DEX_UI.openMgr(d.tid)}
   case 'skillp':{if(!(c.mgr||ownT(c,d.tid)))return;return openMyosu(d.tid)}
   case 'skillck':{if(!(c.mgr||ownT(c,d.tid)))return;return window.OM_SKILL_UI&&window.OM_SKILL_UI.openPlayer(d.tid)}
   case 'enter':return enterMon(d.mid);
   case 'pend':return pendMon(d.mid);
   case 'simul':{const tid=d.tid;if(!tid||!(c.gm||ownT(c,tid))||!(c.b.trainers||{})[tid])return;
    /* 10-26 망령: GM 이 켜고 끄면 모든 트레이너가 같이 (한쪽만 켜져 상대 선발이 먼저 공개되던 것) */
    if(c.gm){for(const t of Object.keys(c.b.trainers||{}))await A().set(['battle','trainers',t,'simul'],!!val);return}
    return A().set(['battle','trainers',tid,'simul'],!!val)}
   case 'pvp':{if(!c.mgr)return;const on=!b.pvp;   /* 11-03 망령 「PVP 설정」: 서로의 도감 정보가 다 공개 — 표시 단계에서만 (dex 해석 기록은 그대로) */
    if(!(await askYes(on?'PVP 모드를 켤까?\n양쪽 포켓몬의 도감 정보(타입 · 약점 · 종족치 · 기술 · 특성 · 포텐셜)와 비공개 벤치가 모두에게 공개된다.\n해석 횟수 · 기록은 그대로 — 끄면 해석한 만큼만 보이게 돌아간다':'PVP 모드를 끌까?\n도감은 다시 해석한 만큼만 보인다 (해석 기록은 그대로)',on?'켠다':'끈다','그대로')))return;
    await A().set(['battle','pvp'],on?true:null);A().sysLog(on?'【PVP 모드】 양쪽 도감 공개 — 비공개 벤치 · 타입 · 기술 · 특성 · 포텐셜이 해석 없이 전부 보인다':'PVP 해제 — 도감은 해석한 만큼만 보인다','battle');return}
   case 'start':return startBattle();
   case 'pendgo':return applyPending();
   case 'exit':return exitMon(d.mid,{noAsk:true});
   case 'exitx':return exitMon(d.mid);
   case 'fswitch':return forcedSwitch(d.mid);
   case 'edit':return openEdit(d.mid);
   case 'form':return openForm(d.mid);
   case 'result':return openResult();
   case 'hp':return openHp(d.mid);
   case 'pots':return openPots(d.mid,d.only);
   case 'autock':return openAutoCheck(d.tid);
   case 'fxoff':{const m=b.mons[d.mid];if(!m||!canEdit(c,m))return;const nm=d.nm||'';const all=FX().chips(m).filter(ch=>ch.name===nm);const compound=nm&&all.length>1;
    if(!(await askYes(compound?`「${nm}」 의 효과 ${all.length}개를 모두 해제할까?\n${all.map(x=>'· '+x.t).join('\n')}`:`「${nm}」 효과를 해제할까?`,'해제')))return;   /* 11-03 (검토 13): 진행류는 창 안 확인 */
    const m0=snap(b.mons[d.mid]);const x=snap(m0);if(compound)FX().removeByName(x,nm);else FX().remove(x,d.fx);await saveMon(m0,d.mid,x);return A().sysLog(`${m.name} 「${nm}」 해제${compound?' ('+all.length+'개)':''}`,'battle')}
   case 'announce':{const m=b.mons[d.mid];if(!m||!canEdit(c,m))return;const [kind,name]=[d.kind,d.pot];const src=kind==='trait'?{name:m.ability,eff:m.abilityEff}:kind==='item'?(()=>{/* 10-28 망령: 소지품이 여럿이면 누른 칸(이름)의 것을 — 예전엔 늘 1번 칸이 나왔다 */const nn=x=>String(x||'').replace(/『|』/g,'').trim();const x2=name&&nn(name)!==nn(m.item)?(m.items2||[]).find(x=>x&&nn(x.item)===nn(name)):null;if(x2){const it=((window.OM_DB||{}).items||{})[nn(x2.item)]||{};return {name:x2.item,eff:x2.itemEff||it.eff||''}}return {name:m.item,eff:m.itemEff}})():potSrc(m).find(p=>p&&p.name===name)||{name,eff:''};
    return A().sysLog(`【${({pot:'포텐셜',trait:'특성',item:'소지품'})[kind]}】 ${m.name} 『${src.name}』`,'battle',{mid:m.id,img:m.image||'',eff:String(src.eff||'').replace(/<br\s*\/?>/g,'\n').slice(0,400)})}
   case 'objects':return openObjects(d.side);
   case 'turnset':{if(!c.mgr)return;const v=prompt('턴 번호',String(b.turn||0));if(v==null)return;const n=Math.max(0,parseInt(v,10)||0);await A().set(['battle','turn'],n);return A().sysLog(`턴을 ${n}(으)로 맞췄다`,'battle')}
   case 'dex':{if(!window.OM_DEX_UI)return;const dm=(c.b.mons||{})[d.mid];if(plView(c)&&dm&&!canEdit(c,dm)){const v=gmEyes(c,dm);return window.OM_DEX_UI.open(d.mid,v||'_view',true)}return window.OM_DEX_UI.open(d.mid,c.gm?'':(c.seat||'_view'))}
   case 'attack':return openAttack(d.mid);
   case 'usepot':case 'restorepot':{const m=b.mons[d.mid];if(!m||!canEdit(c,m))return;if(d.act==='usepot'){const r=potRest(m,d.pot);if(r&&!d.auto)return A().toast(r.title);await potMark(d.mid,d.pot)}const L=potList(m);const p=L.find(x=>x.name===d.pot);if(!p)return;const u=Object.assign({},m.potUses||{});const cur=u[p.name]==null?p.max:+u[p.name];u[p.name]=d.act==='usepot'?Math.max(0,cur-1):Math.min(p.max,cur+1);if(d.act==='usepot'&&wantCut(m,p.name))cutFire('m:'+m.id,m.image,m.name,`『${p.name}』`,m.side==='left'?'#1f6fd1':'#e3101f');
    await A().set(['battle','mons',d.mid,'potUses'],u);
    if(d.act==='usepot'){ /* 횟수를 깎으면서 효과 글을 카드로 띄운다 (자동화가 있으면 그 카드가 대신 뜬다) */
     const fired=FX()?await fireAuto(d.mid,'pot',p.name,{quiet:true}):false;
     if(fired)A().sysLog(`${m.name} 『${p.name}』 남은 ${u[p.name]}/${p.max}`,'battle');
     else{const src=potSrc(m).find(x=>x&&x.name===p.name)||{};A().sysLog(`【포텐셜】 ${m.name} 『${p.name}』\n사용 — 남은 ${u[p.name]}/${p.max}`,'battle',{mid:m.id,img:m.image||'',eff:String(src.eff||'').replace(/<br\s*\/?>/g,'\n').slice(0,400)})}}
    else A().sysLog(`${m.name} 『${p.name}』 횟수 +1 (남은 ${u[p.name]}/${p.max})`,'battle');return}
   case 'fireauto':{const m=b.mons[d.mid];if(!m||!canEdit(c,m))return;if(d.kind==='pot'){const r=potRest(m,d.pot);if(r)return A().toast(r.title);await potMark(d.mid,d.pot)}if(d.kind==='pot'&&wantCut(m,d.pot))cutFire('m:'+m.id,m.image,m.name,`『${d.pot}』`,m.side==='left'?'#1f6fd1':'#e3101f');return fireAuto(d.mid,d.kind,d.pot)}
   case 'time':return c.mgr?requestTime(d.mid):openMyosu(c.seat,d.mid);
   case 'myosu':return openMyosu(d.tid);
   case 'stx':{if(!stxOk(c,d.tid))return;return window.OM_STATUS_UI&&window.OM_STATUS_UI.open(d.tid)}   /* 10-27 망령: 현황 창 */
   case 'timeok':return grantTime(d.seat);
   case 'cmdsave':return saveCmd(d.tid,false);
   case 'ufire':return openUfire(d.tid,d.pot);
   case 'ready':return toggleReady(d.tid);
   case 'cmdload':return loadCmd(d.tid);
   case 'reveal':return reveal();
   case 'order':return computeOrder();
   case 'progress':return progressTurn();
   case 'edone':case 'efire':case 'eskip':return endAct(d.act,d);
   case 'turnstart':{await A().set(['ready'],{});await A().set(['battle','cmds'],{});await A().set(['battle','phase'],1);A().sysLog('턴 개시 — 각자 지시를 공개하세요 (에리어마다 「공개」)','battle');return}
   case 'revealmon':return revealOne(d.tid,d.mid);
   case 'fire':return openFire(d.tid);
   case 'onext':{const O=c.b.order||[];let n=Math.min(O.length,(+c.b.orderIdx||0)+1);const skipped=[];
    /* 10-26 망령: 쓰러졌거나 필드에 없는 포켓몬의 차례는 건너뛴다 */
    const a1=[];while(n<O.length){const om=(c.b.mons||{})[O[n].mid];if(om&&om.entry&&om.hp.cur>0){const na=!O[n].change&&misagA1(c.b,om);if(!na)break;a1.push(`${O[n].name} — ${na}`);n++;continue}if(!O[n].change)skipped.push(O[n].name);n++}   /* 11-01 망령: 각성체 대가 A-1 행동 불능은 차례를 건너뛴다 (그때 필드로 다시 본다) */
    for(const l of a1)A().sysLog(l+' (차례를 건너뛴다)','battle');
    if(skipped.length)A().sysLog(`${skipped.join(' · ')} — 쓰러져 있어 차례를 건너뛴다`,'battle');await A().set(['battle','orderIdx'],n);if((+c.b.phase||0)===2)await A().set(['battle','phase'],3);if(n<(c.b.order||[]).length)A().sysLog(`▶ ${c.b.order[n].name}의 행동`,'battle');else{if((+c.b.orderIdx||0)<n)A().sysLog('행동 순서 끝 — 턴 종료 처리','battle');if(c.b.endq&&c.b.endq.step)return endFlow();if(await askYes('행동이 모두 끝났다. 턴 마무리(턴 가장 마지막 → 턴 종료 → 턴 종료 이후)로 갈까?'))await endFlow()}return}
   case 'oprev':{await A().set(['battle','orderIdx'],Math.max(0,(+c.b.orderIdx||0)-1));return}
   case 'ojump':{if(!c.mgr)return;await A().set(['battle','orderIdx'],+d.i);return}
   case 'oresort':return resortOrder();
   case 'turnend':return endFlow();
   case 'resetcmd':if(!confirm('공개된 지시와 준비 상태를 지울까?'))return;CMD={};await A().set(['battle','cmds'],{});await A().set(['ready'],{});return}}

 /* 등장: 더블(2:2)이 기본. 트레이너가 둘이면 첫 트레이너 A, 둘째 B 가 기본 자리. 빈 자리가 아니면 고른다. */
 /* 에리어 교대: 같은 편의 다른 에리어로 자리만 옮긴다(교체 아님 — 랭크·상태 그대로). 그 자리에 있던 포켓몬은 내 자리로 */
 async function areaSwap(mid,to){const c=ctx();const b=c.b;const m=b.mons[mid];if(!m||!m.entry||!canEdit(c,m))return;const areas=AREAS.slice(0,mode(b)).filter(a=>a!==m.entry);if(!areas.length)return;const ent=entered(b,m.side);
  if(!to){if(areas.length===1)to=areas[0];else{const md=A().openModal(`<div class="mhead"><h2>${esc(m.name)} 에리어 교대</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="small dim" style="margin-bottom:8px">지금 ${String(m.entry).toUpperCase()} — 옮길 자리를 고른다. 있던 포켓몬은 ${String(m.entry).toUpperCase()} 로 온다.</div>
    <div class="row">${areas.map(a=>`<button class="btn pri" data-area="${a}">${a.toUpperCase()}${ent[a]?' · '+esc(ent[a].name)+' 와 자리 바꿈':' · 빈 자리'}</button>`).join('')}</div>`);
    md.querySelectorAll('[data-area]').forEach(bt=>bt.onclick=()=>{A().closeModal();areaSwap(mid,bt.dataset.area)});return}}
  const from=m.entry;const occ=ent[to];const other=occ||Object.values(b.mons||{}).find(x=>x.side===m.side&&x.entry===to&&x.id!==mid);
  await A().set(['battle','mons',mid,'entry'],to);if(other)await A().set(['battle','mons',other.id,'entry'],from);
  A().sysLog(`${m.name} 에리어 교대 ${from.toUpperCase()} → ${to.toUpperCase()}${other?` · ${other.name} → ${from.toUpperCase()}`:''}`,'battle')}
 async function enterMon(mid,area,opt){opt=opt||{};const c=ctx();const b=c.b;const m=b.mons[mid];if(!m||!(canEdit(c,m)||(opt.sys&&c.mgr)))return;
  const ent=entered(b,m.side);const areas=AREAS.slice(0,mode(b));
  if(!area&&(+b.tstep||0)>=1){/* 10-27 망령: 교대 단계면 이 포켓몬과 바꾸기로 한 (교대 지시) 포켓몬의 자리로 — 빈 자리가 있어도 그쪽으로 새지 않게 */const outs=(b.swOut||[]).map(id=>(b.mons||{})[id]).filter(o=>o&&o.tid===m.tid&&o.side===m.side&&o.entry&&o.id!==mid);
   const want=outs.find(o=>((((b.cmds||{})[o.tid]||{}).mons||{})[o.id]||{}).switch===mid)||(outs.length===1?outs[0]:null);if(want)area=want.entry}
  if(!area){const tids=((b.sides||{})[m.side]||{}).trainers||[];const pref=areas[Math.min(tids.indexOf(m.tid),areas.length-1)]||areas[0];
   const free=areas.filter(a=>!ent[a]);
   if(areas.length===1)area=areas[0];
   else if(!ent[pref])area=pref;
   else if(free.length)area=free[0];
   else{const md=A().openModal(`<div class="mhead"><h2>${esc(m.name)} 등장 — 에리어</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
     <div class="row">${areas.map(a=>`<button class="btn ${ent[a]?'ghost':'pri'}" data-area="${a}">${a.toUpperCase()}${ent[a]?' · '+esc(ent[a].name)+' 과 교대':' · 빈 자리'}</button>`).join('')}</div>`);
    md.querySelectorAll('[data-area]').forEach(bt=>bt.onclick=()=>{A().closeModal();enterMon(mid,bt.dataset.area,opt)});return}}
  if(!areas.includes(area))return A().toast('그런 에리어가 없다');
  const occ=ent[area];
  let XL=null;if(occ&&occ.id!==mid){XL=await exitMon(occ.id,{forced:!!opt.forced,noAsk:!!opt.noAsk,sys:!!opt.sys,quiet:true})}
  const swIn=occ&&occ.id!==mid?(b.swOut||[]).includes(occ.id):(+b.tstep||0)>=1&&opt.how!=='죽어내밀기'&&(b.swOut||[]).some(id=>{const o=(b.mons||{})[id];return o&&id!==mid&&o.tid===m.tid&&!o.entry&&o.outA===area});   /* 10-27 망령: 동시 죽어내밀기 — 같은 트레이너가 교대도 했으면, 쓰러진 자리로 나온 포켓몬까지 교대 등장이 됐다. 교대로 빠진 바로 그 자리로 나올 때만 */   /* 10-27 망령: 교대하는 포켓몬을 먼저 「퇴장」시키고 빈 자리로 「등장」하면 occ 가 없어 교대 등장으로 안 잡혀, 행동 순서에 들어가 행동했다 — 교대 단계(tstep 1)에 같은 트레이너의 교대 포켓몬이 빠져 있으면 교대 등장 */
  const started=(+b.phase||0)===1&&!(b.order||[]).length&&!swIn;   /* 10-23 망령: 턴 개시 뒤 · 순서 계산 전에 나온 포켓몬(죽어내밀기 · 동시 내밀기 · 윤회)은 그 턴 순서에 들어간다. 그 밖엔 */ /* 턴 도중(교대 · 빈사 교체)에 들어온 포켓몬은 「교대 등장」 — 그 턴엔 지시가 없다. 턴 개시 때 필드에 있던 포켓몬만 setPhase(1) 이 started 로 바꾼다 */
  await A().set(['battle','mons',mid,'entry'],area);{const faintRep=opt.how==='죽어내밀기'||!occ||(occ.id!==mid&&occ.hp&&occ.hp.cur<=0);const T0=+b.turn||0;await A().set(['battle','mons',mid,'inT'],b.started&&faintRep&&(+b.phase||0)>=2?T0+1:Math.max(1,T0))}   /* 10-26 망령: 죽어내밀기는 다음 턴이 1턴째 — 턴 도중 · 턴 끝에 빈 자리(쓰러진 자리)로 나오면 다음 턴부터 센다 */await A().set(['battle','mons',mid,'started'],started);   /* inT: 필드에 나온 턴 (【지연】 셈 — 나온 턴이 1턴째) */if(!m.seen)await A().set(['battle','mons',mid,'seen'],true);if(m.pend)await A().set(['battle','mons',mid,'pend'],null);
  const EL=await entryLines(mid);
  {/* 10-27 망령: 교대면 나가는 포켓몬 ⇄ 들어오는 포켓몬을 그림과 함께 한 장으로 (먼저 「퇴장」하고 빈 자리로 나온 교대도) */
   const outM=occ&&occ.id!==mid?occ:swIn?(b.swOut||[]).map(id=>(b.mons||{})[id]).find(o=>o&&o.tid===m.tid&&!o.entry&&o.id!==mid&&((((b.cmds||{})[o.tid]||{}).mons||{})[o.id]||{}).switch===mid)||(b.swOut||[]).map(id=>(b.mons||{})[id]).find(o=>o&&o.tid===m.tid&&!o.entry&&o.id!==mid):null;
   const XLL=Array.isArray(XL)?XL:[];
   if(outM){const tn=((b.trainers||{})[m.tid]||{}).name||'';const head=`【교대】 ${outM.name} ⇄ ${m.name} (${SIDE_KO[m.side]} ${area.toUpperCase()})`;
    A().sysLog(`${head}${XLL.length||EL.length?'\n'+[...XLL,...EL].join('\n'):''}`,'battle',{mid,img:m.image||'',rv:[{tr:tn,mid:outM.id,name:outM.name,img:outM.image||'',side:m.side,area:area.toUpperCase(),sw:{name:m.name,img:m.image||'',done:1}}],rvx:[...XLL,...EL]})}
   else{if(XLL.length)A().sysLog(`${occ.name} ${opt.forced?'강제 퇴장':'퇴장'}\n${XLL.join('\n')}`,'battle');
    A().sysLog(`${m.name} 등장 (${SIDE_KO[m.side]} ${area.toUpperCase()})${EL.length?'\n'+EL.join('\n'):''}`,'battle')}}
  /* 배턴터치 받기 */
  {const nb0=snap(),nb=snap(nb0);const t=nb.trainers[m.tid];if(t&&t.batton&&t.batton.from!==m.name){const L=applyBatton(nb,nb.mons[mid]);await saveMon(nb0.mons[mid],mid,nb.mons[mid]);await A().set(['battle','trainers',m.tid,'batton'],null);if(L.length)A().sysLog(L.join('\n'),'battle');stLog(nb0.mons[mid],nb.mons[mid],{n:t.batton.from||'',s:'배턴터치'},300)}}   /* 11-01 망령 「상태 변화도 효과 로그」: 넘겨받은 상태도 카드로 */
  /* 설치기 (맵툴 hazard_eval): 등장한 쪽의 설치기를 평가한다 */
  if(F()){const nb0=snap(),nb=snap(nb0);const nm=nb.mons[mid];nm.entry=area;const f=fieldOf(nb);const oppSide=m.side==='left'?'right':'left';const opp=entered(nb,oppSide);
   const r=F().hazardsOnEntry(nm,f,opp);if(r.lines.length){if(nm.hp.cur<=0){nm.entry='';r.lines.push(`${nm.name}은(는) 쓰러졌다!`)}else if(r.forced){nm.entry='';r.lines.push(`${nm.name}은(는) 튕겨 나갔다 — 다른 포켓몬을 내보내야 한다`)}
    await saveBattle(nb0,nb,f);A().sysLog(`설치기 처리\n${r.lines.join('\n')}`,'battle')}}
  /* 10-26 (서서 VS 마리 시험): 필드의 다른 포켓몬이 「있는 한」 걸어 둔 효과(재앙의그릇 · 승리의별 …)를 새로 들어온 포켓몬에게도 */
  if(FX()&&FX().reAura&&ctx().b.started&&(ctx().b.mons[mid]||{}).entry){const nb0=snap(),nb=snap(nb0);const L=FX().reAura(nb,nb.mons[mid]);if(L.length&&await saveBattle(nb0,nb))A().sysLog(`【필드 효과】\n${L.join('\n')}`,'battle')}
  /* 10-26 망령: 시합 개시 전에 나온 포켓몬 · 동시 내밀기는 모두 나온 뒤에 등장 효과를 스피드 순으로 (위협이 아무도 못 맞히던 것) */
  if(FX()&&(ctx().b.mons[mid]||{}).entry&&!opt.noAuto&&ctx().b.started)await autoOnEntry(mid,{how:opt.how||(opt.forced?'강제 교대':occ&&occ.id!==mid?'통상 교대':(+b.phase||0)>=2?'통상 교대':'죽어내밀기')})}
 async function autoEntryAll(ids,hows){const b=ctx().b;const f=fieldOf(b);const sp=m=>{try{return B().statValue(m,'speed').value*spMulOf(m,f).v}catch(e){return +((m.stats||[])[5]||0)}};
  const list=ids.map(id=>b.mons[id]).filter(m=>m&&m.entry&&m.hp.cur>0).sort((x,y)=>sp(y)-sp(x));for(const m of list)if(FX())await autoOnEntry(m.id,hows&&hows[m.id]?{how:hows[m.id]}:undefined)}
 /* 10-23 망령: 맵툴 print_entry — 등장하면 「통솔」 명중 강화 → 특성 등장 문구 → 소지품 등장 문구 (data/ment.js, 맵툴 entry_ment 그대로) */
 const LEAD_ACC={A:1.05,AA:1.15,AAA:1.25,S:1.33};
 /* 「통솔」 명중 보정: 랭크 · 배율(mod)에 넣지 않고 공격 창 「명중 배율」 기본값으로 곱한다 (10-24 망령) */
 function leadAcc(m){const t=m&&(ctx().b.trainers||{})[m.tid];return (t&&LEAD_ACC[S().strip((t.ranks||{})['통솔'])])||1}
 function josa(w,p){const s=String(w||'').replace(/[」』)\]\s]+$/,'');const ch=s.charCodeAt(s.length-1);let has=false,ri=false;
  if(ch>=0xAC00&&ch<=0xD7A3){const j=(ch-0xAC00)%28;has=j>0;ri=j===8}else if(/[0-9]$/.test(s)){has='013678'.includes(s.slice(-1));ri='178'.includes(s.slice(-1))}else if(/[a-z]$/i.test(s)){has=/[lmnbkpt]$/i.test(s);ri=/l$/i.test(s)}
  const P={은는:['은','는'],이가:['이','가'],을를:['을','를'],와과:['과','와'],으로로:['으로','로']}[p];return p==='으로로'?(has&&!ri?P[0]:P[1]):(has?P[0]:P[1])}
 function mentText(t,nm,tg){let s=String(t||'').replace(/\{이름\}/g,nm).replace(/\{대상\}/g,tg||'');for(const p of ['은는','이가','을를','으로로','와과'])s=s.split('{'+p+'}').join(josa(nm,p));const i=s.indexOf('@');return i<0?s:s.slice(0,i)+(s.slice(i+1).trim()?' ('+s.slice(i+1).trim()+')':'')}
 const mentKey=n=>String(n||'').replace(/『|』|\s/g,'');
 async function entryLines(mid){const b=ctx().b;const m=b.mons[mid];const L=[];if(!m)return L;const t=(b.trainers||{})[m.tid];const MT=DB().ment||{};
  const la=leadAcc(m);
  /* 10-24 망령: 「통솔」 명중 강화 문구는 로그에 쓰지 않는다 (공격 창 명중 배율 칸에 자동) */
  const tm=(MT.trait||{})[mentKey(m.ability)];if(m.ability&&tm)L.push(mentText(tm,m.name,m.ability));
  for(const it of [m.item,...(m.items2||[]).map(x=>x&&x.item)]){const x=it&&(MT.item||{})[mentKey(it)];if(x)L.push(mentText(x,m.name,it))}
  return L}
 /* 동시 내밀기: 주인이 예약(pend)해 두고, GM 의 「시합 개시」·「내밀기 실행」 때 한꺼번에 등장 (상대는 예약을 못 본다) */
 async function pendMon(mid,area){const c=ctx();const b=c.b;const m=b.mons[mid];if(!m||!canEdit(c,m))return;
  const tnm=((b.trainers||{})[m.tid]||{}).name||SIDE_KO[m.side];const cnt=()=>{const nb=ctx().b;const L=pendCount(nb,'left'),R=pendCount(nb,'right');return `좌 ${L.n}/${L.need} · 우 ${R.n}/${R.need}`};
  if(m.pend){const was=m.pend;await A().set(['battle','mons',mid,'pend'],null);A().sysLog(`${tnm} — 에리어 ${String(was).toUpperCase()} 내밀기 예약 취소 (${cnt()})`,'battle');return}
  const areas=AREAS.slice(0,mode(b));const taken=Object.values(b.mons).filter(x=>x.side===m.side&&x.id!==m.id&&x.pend).map(x=>x.pend);const ent=entered(b,m.side);
  if(!area){const free=areas.filter(a=>!taken.includes(a));if(areas.length===1)area=areas[0];else if(free.length===1&&areas.every(a=>taken.includes(a)||a===free[0]))area=free[0];
   else{const md=A().openModal(`<div class="mhead"><h2>${esc(m.name)} 내밀기 예약 — 에리어</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="row">${areas.map(a=>`<button class="btn ${taken.includes(a)?'ghost':'pri'}" data-area="${a}">${a.toUpperCase()}${taken.includes(a)?' · 이미 예약':ent[a]?' · '+esc(ent[a].name)+' 과 교대':' · 빈 자리'}</button>`).join('')}</div>`);
    md.querySelectorAll('[data-area]').forEach(bt=>bt.onclick=()=>{A().closeModal();pendMon(mid,bt.dataset.area)});return}}
  await A().set(['battle','mons',mid,'pend'],area);A().sysLog(`${tnm} — 에리어 ${area.toUpperCase()} 내밀기 예약 ✓ (누가 나올지는 실행 때까지 비밀 · ${cnt()})`,'battle');A().toast(`${m.name} 내밀기 예약 (${area.toUpperCase()}) — ${c.mgr?'「시합 개시」나 「내밀기 실행」을 누르면':'GM 이 실행하면'} 나온다`);
  const nb=ctx().b;const L=pendCount(nb,'left'),R=pendCount(nb,'right');if(L.need>0&&R.need>0&&L.n>=L.need&&R.n>=R.need)A().sysLog(`양쪽 내밀기 예약 완료 — GM 「${nb.started?'내밀기 실행':'시합 개시'}」`,'battle')}
 async function applyPending(){const c=ctx();if(!c.mgr)return 0;const b=c.b;const list=Object.values(b.mons||{}).filter(m=>m.pend&&m.hp.cur>0);if(!list.length)return 0;
  A().sysLog('동시 내밀기!','battle');const ids=list.map(m=>m.id);const hows={};for(const m of list)hows[m.id]=Object.values(b.mons||{}).some(q=>q.id!==m.id&&q.side===m.side&&q.entry===m.pend&&q.hp&&q.hp.cur>0)?'통상 교대':'죽어내밀기';for(const {id,pend} of list.map(m=>({id:m.id,pend:m.pend}))){await enterMon(id,pend,{sys:true,noAuto:true})}if(ctx().b.started)await autoEntryAll(ids,hows);return list.length}   /* pend 는 enterMon 이 지운다 — 먼저 지우면 set 의 낙관적 반영으로 m.pend 가 사라져 예약 에리어를 잃는다 */
 async function startBattle(){const c=ctx();if(!c.mgr)return;const b=c.b;if(b.started)return;for(const k in FAINT_SEEN)delete FAINT_SEEN[k];
  if(simAny(b)){const n=await applyPending();if(!n&&!Object.values(b.mons||{}).some(m=>m.entry)){if(!(await askYes('예약된 포켓몬이 없다. 그래도 시합을 개시할까?')))return}}
  for(const tid of Object.keys(b.trainers||{}))if((b.trainers[tid]||{}).time)await A().set(['battle','trainers',tid,'time'],null);
  await A().set(['battle','started'],true);if(b.done)await A().set(['battle','done'],null);   /* 10-31: 던전으로 돌아온(done) 배틀을 다시 열면 살아 있는 배틀 */
  if(!(+b.turn||0))await A().set(['battle','turn'],1);await A().set(['battle','log0'],+A().ST.lastLogId||0);await A().set(['battle','at0'],Date.now());   /* log0 · at0: 전당의 간략 로그를 여기서부터 (hall_ui.js) */
  await autoEntryAll(Object.values(ctx().b.mons||{}).filter(m=>m.entry).map(m=>m.id));   /* 선발 전원이 나온 뒤 등장 효과 (스피드 순) */
  try{const DK=window.OM_DECK_UI;if(DK&&DK.beat)await DK.beat('battle',Object.keys(ctx().b.trainers||{}))}catch(e){console.warn(e)}   /* 11-01 은열쇠: 배틀 시작에 덱 설정 「배틀 시작에 n장」 */
  A().sysLog('시합 개시! — TURN 1','battle');battleStartCut(ctx().b)}
 /* 퇴장 정리 (맵툴 out_area): 랭크·배율·임시 효과·발동 중인 포텐셜 효과·타입/특성 변경·하늘 위·급소 방호 를 되돌리고, 상태 이상(abn) 과 원념·빈사 빼고는 상태도 푼다.
    배턴터치면 랭크와 넘길 수 있는 상태(bat) 를 트레이너에게 맡겨 두었다가 다음 등장 포켓몬이 받는다. 강제 교대는 배턴터치 없이 정리만 */
 function passable(m){const st=(DB().states||{}).st||{};const rk=Object.values(m.rank||{}).some(v=>+v);const bs=Object.keys(m.states||{}).filter(k=>m.states[k]&&(st[k]||{}).bat);return rk||bs.length>0||!!(+m.critBuff)}
 function outReset(nb,m,opt){opt=opt||{};const st=(DB().states||{}).st||{};const L=[];const t=nb.trainers[m.tid];if(m.fxDone)delete m.fxDone;if(m.thrashOn)delete m.thrashOn;   /* 10-26: 다시 나오면 상시 효과를 다시 건다 · 난동 표시도 정리 */
  if(opt.batton&&t){const states={};for(const k in (m.states||{}))if(m.states[k]&&(st[k]||{}).bat)states[k]=m.states[k];t.batton={rank:Object.assign({},m.rank||{}),states,critBuff:+m.critBuff||0,from:m.name};L.push(`${m.name} 「배턴터치」 — 랭크·상태를 다음 포켓몬에게 넘긴다`)}
  /* 효과(배율 출처 포함)를 먼저 풀고 나서 랭크·배율을 비운다 — 순서가 바뀌면 배율이 역으로 나뉘어 0.75 같은 값이 남는다 */
  if(FX()&&FX().release)L.push(...FX().release(nb,m));
  if(FX()){const n=FX().chips(m).length;FX().removeAll(m);if(n)L.push(`${m.name} 발동 중인 효과 ${n}개 해제`)}
  m.rank={};delete m.tempRank;m.mod={};delete m.tempMod;delete m.critBuff;if(m.fx)m.fx.mults=[];
  const gone=[];for(const k in (m.states||{})){if(!m.states[k])continue;const d=st[k]||{};if(d.abn||k==='Grudge'||k==='Dead')continue;delete m.states[k];gone.push(d.ko||k)}
  if(m.form0&&((m.forms||[])[m.formIdx]||{}).revert)L.push(...formSet(m,-1));
  delete m.flags;delete m.prioDown;delete m.fxDone;delete m.futRsv;if(m.statsOrig){m.stats=m.statsOrig;delete m.statsOrig}   /* 11-02: 배틀 실수치 변경(실수치변경 구문)은 교대하면 원래대로 *//* 11-02 망령: 「테라스탈」은 교대해도 풀리지 않는다 (상태 DB 설명) — 배틀을 차릴 때(prepMon)만 끈다 */m.entry='';
  if(gone.length)L.push(`${m.name} 상태 해제: ${gone.join('·')}`);return L}
 /* 10-22 망령: 나가는 포켓몬이 다른 포켓몬에게 걸어 둔 포텐셜·특성 효과(옵저버 같은 아군 배율)도 같이 꺼진다. 기술로 건 효과는 남긴다 */
 function auraOff(nb,m){const L=[],ids=[];if(!FX())return {L,ids};const mv=new Set((m.moves||[]).map(x=>x&&String(x.name||'').replace(/『|』/g,'').trim()).filter(Boolean));const tail=' ← '+m.name;
  for(const x of Object.values(nb.mons||{})){if(!x||x.id===m.id)continue;const off=FX().chips(x).filter(c=>/^(mods|noind|prio|immune|nodrop|mults|chance):/.test(c.id)&&(c.id.endsWith(tail)||c.id.includes(tail+' ('))&&!mv.has(String(c.name||'').replace(/『|』/g,'').trim()));
   if(!off.length)continue;for(const c of off)FX().remove(x,c.id);ids.push(x.id);L.push(`${x.name} 「${[...new Set(off.map(c=>c.name))].join('」「')}」 해제 (${m.name} 퇴장)`)}return {L,ids}}
 function applyBatton(nb,m){const t=nb.trainers[m.tid];const bt=t&&t.batton;if(!bt)return [];delete t.batton;m.rank=Object.assign({},bt.rank||{});m.states=Object.assign({},m.states||{},bt.states||{});if(bt.critBuff)m.critBuff=bt.critBuff;
  const st=(DB().states||{}).st||{};const rk=Object.entries(m.rank).filter(([k,v])=>+v).map(([k,v])=>(FX()?FX().STAT_KO[k]:k)+(v>0?'+':'')+v);const ss=Object.keys(bt.states||{}).map(k=>(st[k]||{}).ko||k);
  return [`${m.name} 「배턴터치」 받음 (${bt.from||''}) ${[...rk,...ss].join(' · ')||'없음'}`]}
 async function exitMon(mid,opt){const c=ctx();const m=c.b.mons[mid];if(!m||!(canEdit(c,m)||(opt&&opt.sys&&c.mgr)))return;
  if(!opt){ /* 카드의 「퇴장」: 작은 창에서 고른다 */
   const bench=Object.values(c.b.mons).filter(x=>x.tid===m.tid&&!x.entry&&!x.pend&&x.hp.cur>0&&x.id!==mid);const ps=passable(m);
   const md=A().openModal(`<div class="mhead"><h2>${esc(m.name)} 퇴장 (특수)</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
    <div class="firelist"><label class="firerow ${ps?'':'dis'}" data-ex="batton"><b>배턴터치 퇴장</b><span class="small dim">${ps?'랭크와 넘길 수 있는 상태를 다음에 나오는 포켓몬에게':'넘길 랭크·상태가 없다'}</span></label>
    <label class="firerow ${bench.length?'':'dis'}" data-ex="forced"><b>강제 교대</b><span class="small dim">${bench.length?'배턴터치 없이 나가고 벤치에서 무작위 한 마리가 같은 자리로':'벤치에 교대할 포켓몬이 없다'}</span></label></div>`);
   md.querySelectorAll('[data-ex]').forEach(el=>el.onclick=()=>{const k=el.dataset.ex;if(k==='forced'&&!bench.length)return;if(k==='batton'&&!ps)return;A().closeModal();if(k==='forced')return forcedSwitch(mid);exitMon(mid,{batton:k==='batton',noAsk:true})});return}
  let batton=!!opt.batton;/* 10-26 FFA 시험: 랭크가 바뀐 포켓몬은 그냥 교대해도 늘 「배턴터치인가?」를 물어, 서두르다 「예」를 누르면 위협 −2 가 다음 포켓몬에게 넘어갔다 — 「배턴터치」를 쓸 줄 아는 포켓몬만 묻는다 (그 밖은 「(특수)」의 배턴터치 퇴장) */const knowsBP=MVS(m).some(v=>/배턴터치/.test(String((v||{}).name||'')))||potSrc(m).some(p=>p&&/배턴터치/.test(String(p.eff||'')))||/배턴터치/.test(String(m.abilityEff||''));if(!batton&&!opt.forced&&knowsBP&&passable(m)&&!opt.noAsk)batton=await askYes(`${m.name} 퇴장 — 「배턴터치」인가? (랭크·넘길 수 있는 상태를 다음 포켓몬에게)\n취소 = 그냥 퇴장`);
  const nb0=snap(c.b),nb=snap(nb0);const a0=m.entry||'';const L=outReset(nb,nb.mons[mid],{batton});if(a0)nb.mons[mid].outA=a0;   /* outA: 마지막으로 빠진 자리 (교대 등장 판정) */const AU=auraOff(nb,nb.mons[mid]);L.push(...AU.L);if(!await A().setMany(A().diffOps(['battle'],nb0,nb,3)))return;itemKick();if(batton)await A().set(['battle','trainers',m.tid,'batton'],nb.trainers[m.tid].batton);
  if(opt.quiet)return L;   /* 10-27: 교대 등장이 한 장(【교대】)으로 같이 적는다 */
  A().sysLog(`${m.name} ${opt.forced?'강제 퇴장':'퇴장'}${L.length?'\n'+L.join('\n'):''}`,'battle')}
 /* 강제 교대 (맵툴 change_forced): 배턴터치 없이 나가고, 벤치에서 아무 포켓몬이나 같은 에리어로 */
 async function forcedSwitch(mid,opt){opt=opt||{};const c=ctx();const b=c.b;const m=b.mons[mid];if(!m||!(canEdit(c,m)||(opt.sys&&c.mgr))||!m.entry)return false;
  const bench=Object.values(b.mons).filter(x=>x.tid===m.tid&&!x.entry&&!x.pend&&x.hp.cur>0&&x.id!==mid);if(!bench.length){A().toast('교대할 포켓몬이 벤치에 없다');if(opt.sys)A().sysLog(`${m.name} 강제 교대 — 벤치에 나올 포켓몬이 없다`,'battle');return false}
  const must=bench.filter(x=>/강제 교대로 반드시 선택/.test(String(x.abilityEff||'')));   /* 방위라인·벤치가드 */
  const area=m.entry;const pool=must.length?must:bench;const pick=pool[Math.floor(Math.random()*pool.length)];
  await exitMon(mid,{forced:true,sys:opt.sys});A().sysLog(`${m.name} 강제 교대 → ${pick.name}${must.length?' (「'+pick.ability+'」로 반드시 선택)':''}`,'battle');await enterMon(pick.id,area,{forced:true,sys:opt.sys});return true}
 /* 강제 교대를 막는 것: 효과 엔진의 「교대 무시」, 뿌리박기·다이맥스, 특성 글(받지 않는다·무효화). 포텐셜 글(횟수 제한)은 물어본다 */
 /* 교대 제한: 검은눈빛·조이기 등. 고스트 · 아름다운허물 · 「반드시 교대할 수 있다」 효과는 예외. 경고만 하고 막지는 않는다 */
 const TRAPS={MeanLook:'검은눈빛',Bind:'조이기',ThunderCage:'썬더프리즌',Ingrain:'뿌리박기',OctoLock:'문어굳히기',NoRetreat:'배수의진',Block:'블록'};
 const FREESW=/반드시\s*(임의\s*)?교대할?\s*수\s*있/;
 function trapWarn(m){const st=m.states||{};const hit=Object.keys(TRAPS).filter(k=>st[k]).map(k=>TRAPS[k]);if(!hit.length)return null;
  if(tysOf(m).includes('Ghost'))return {hit,free:'고스트 타입'};const it=IT(m);if(it==='아름다운허물')return {hit,free:'아름다운허물'};
  if(it&&FREESW.test(String(m.itemEff||'')))return {hit,free:it};if(m.ability&&FREESW.test(String(m.abilityEff||'')))return {hit,free:'특성 : '+m.ability};
  if(FX()&&FX().noind(m,'freesw'))return {hit,free:FX().noindName(m,'freesw')||'반드시 교대'};const p=potSrc(m).find(p=>FREESW.test(String(p.eff||'')));return {hit,free:'',pot:p?p.name:''}}
 async function switchGuard(m){if(FX()&&FX().noind(m,'switch'))return FX().noindName(m,'switch')||'교대 무시';const st=m.states||{};if(st.Ingrain)return '뿌리박기';if(st.Dynamax)return '다이맥스';
  const re=/강제 교대[^.\n]*?(받지 않|무효)/;if(m.ability&&re.test(String(m.abilityEff||'')))return '특성 : '+m.ability;
  for(const p of potSrc(m))if(re.test(String(p.eff||''))&&await askYes(`${m.name}의 「${p.name}」로 강제 교대를 막을까?\n${String(p.eff||'').replace(/<br\s*\/?>/g,' ').slice(0,120)}`))return p.name;return ''}

 /* ----- 지시 저장 · 준비 · 공개 ----- */
 /* 저장한 지시엔 턴 번호를 붙인다 (10-24 망령): 지난 턴 지시(선행 포텐셜 · 지령)를 다음 턴에 또 읽어 「선행」이 풀리지 않던 것 */
 function cleanCmd(cur){const out={mons:{},detail:cur.detail||'',upots:cur.upots||[],turn:+ctx().b.turn||1};   /* 시합 개시 전(턴 0)에 넣은 지시는 TURN 1 것 */for(const k in cur.mons){const x=cur.mons[k];out.mons[k]={move:x.move,switch:x.switch,targets:x.targets||[],tm:tmOf(ctx().b,x.targets),prio:x.prio||{},ochg:x.ochg||{},order:x.order||'',command:x.command||'',pots:x.pots||[],pman:x.pman?1:0,pur:x.pur||'',pimm:x.pimm||'',uman:x.uman?1:0,ut:x.ut||'',tman:x.tman?1:0}}return out}
 /* 공개용: 선행 입력(지령·명령)은 뺀다 — 발동할 때 드러난다 */
 function pubMon(x){x=x||{};return {move:x.move,switch:x.switch,targets:x.targets||[],tm:x.tm||{},prio:x.prio||{},ochg:x.ochg||{},tman:x.tman?1:0}}
 async function saveCmd(tid,quiet){const c=ctx();const cur=CMD[tid];if(!cur)return;{const t=(c.b.trainers||{})[tid]||{};for(const mid in cur.mons){const m=c.b.mons[mid];if(!m)continue;const pp=prePursuit(t,m,cur.mons[mid],cur.upots);cur.mons[mid].pur=pp.pur;cur.mons[mid].pimm=pp.pimm;cur.mons[mid].ut=pp.ut}}
  try{await DBS().secretPut(c.ST.room,c.ST.secret,'cmd',tid,cleanCmd(cur));/* 11-03 21:51 망령 「우선도 문제 안 고쳐졌다」: 턴 개시 뒤에 지시를 저장하거나 바꾸면(준비 안 된 채 턴이 열린 경우 등) 순서 열쇠가 기술 없는 옛것으로 남아 우선도가 0 — 저장할 때마다 열쇠를 다시 올린다 */if(c.role==='seat'&&(+c.b.phase||0)>=1&&(+c.b.phase||0)<2)publishOk(tid,true).catch(()=>{});if(coOf(c,tid).length&&!(c.gm&&c.fair))try{await A().set(['pub',tid,'csav'],{at:Date.now(),by:c.gm?'gm':c.seat,name:c.gm?'GM':(c.ST.name||c.seat)})}catch(e){}   /* 함께 지시하는 화면들이 이걸 보고 불러온다 */if(!quiet)A().toast('지시를 저장했다 (공개 전까지 GM만 본다)');if((c.ST.state.ready||{})[tid])await putShape(tid);return true}catch(e){A().toast('저장 실패: '+e.message);return false}}
 /* 지시의 「꼴」만 공개 칸에 둔다 — 「타임」이 보는 건 교대인지 기술인지뿐 (맵툴 active_command_expert 와 같다) */
 async function putShape(tid,clear){const c=ctx();const b=c.b;const cur=CMD[tid];const mons={};if(!clear&&cur){for(const mid in cur.mons){const m=b.mons[mid];if(!m||!m.entry)continue;const x=cur.mons[mid];mons[mid]=x.move==='switch'?'switch':(x.move===''||x.move==null)?'none':'move'}}
  try{await A().set(['pub',tid,'shape'],clear?null:{turn:+b.turn||0,mons})}catch(e){}}
 async function loadCmd(tid){const c=ctx();try{const rows=await DBS().secretGet(c.ST.room,c.ST.secret,'cmd');const r=(rows||[]).find(x=>x.id===tid);if(!r)return A().toast('저장된 지시가 없다');CMD[tid]=Object.assign({mons:{},detail:''},JSON.parse(JSON.stringify(r.data)),{turn:+c.b.turn||0});delete CMD[tid].order;delete CMD[tid].command;if(!cmdFresh(r)){CMD[tid].upots=[];for(const k in CMD[tid].mons||{}){const x=CMD[tid].mons[k];x.pots=[];x.order='';x.command=''}}A().renderScene();A().toast('불러왔다')}catch(e){A().toast(e.message)}}
 /* 함께 지시하기: 저장된 지시를 지시 창으로 — 처음 열 때(아직 손대지 않았으면), 그리고 같이 보는 사람이 저장했을 때 */
 const PULL={};
 async function coPull(tid,who){const c=ctx();const key=turnKey(c.b)+':'+tid;if(!who&&PULL[key])return;PULL[key]=1;let rows;try{rows=await DBS().secretGet(c.ST.room,c.ST.secret,'cmd')}catch(e){return}
  const r=(rows||[]).filter(x=>cmdFresh(x,ctx().b)).find(x=>x.id===tid);if(!r||!r.data)return;const now=cmdNow(tid,ctx().b);if(!who&&now&&!now.fresh)return;
  CMD[tid]=Object.assign({mons:{},detail:'',upots:[]},JSON.parse(JSON.stringify(r.data)),{turn:+ctx().b.turn||0});A().renderScene();
  if(who)A().toast(`${who} 님이 「${((ctx().b.trainers||{})[tid]||{}).name||tid}」 지시를 저장했다 — 지시 창에 불러왔다`)}
 const CSEEN={};
 function coWatch(){const c=ctx();if(!c.gm&&c.role!=='seat')return;const me=c.gm?'gm':c.seat;for(const tid of myTrainers(c)){if(!coOf(c,tid).length)continue;const s=((c.ST.state.pub||{})[tid]||{}).csav;
  if(CSEEN[tid]==null){CSEEN[tid]=(s&&+s.at)||0;continue}if(s&&s.at>CSEEN[tid]){CSEEN[tid]=s.at;if(s.by!==me)coPull(tid,String(s.name||s.by||'').slice(0,30)||'함께 지시하는 사람')}}}
 /* 10-24 망령: 개인전 켜기 · 끄기 — GM 과 그 트레이너 주인. 같은 진영에 둘 이상 있을 때만 의미가 있다 */
 function soloTag(c,tid,ids){const t=(c.b.trainers||{})[tid]||{};const can=(c.gm||ownT(c,tid))&&(ids||[]).length>1&&(t.solo||(ids||[]).indexOf(tid)>0);   /* 진영 맨 앞 트레이너는 기준이라 버튼 없음 (뒤에 선 트레이너를 개인전으로) */if(!t.solo&&!can)return '';
  return can?` <button class="tag solo ${t.solo?'on':''}" data-act="solo" data-tid="${tid}" title="${t.solo?'개인전 — 같은 진영의 다른 트레이너와 정보를 나누지 않고 서로 적으로 싸운다. 누르면 같은 팀으로':'같은 팀 — 누르면 개인전(정보 비공유 · 서로 적)으로'}">${t.solo?'⚔ 개인전':'같은 팀'}</button>`:' <span class="tag solo on" title="개인전 — 같은 진영이어도 한 편이 아니다">⚔ 개인전</span>'}
 async function toggleSolo(tid){const c=ctx();const t=(c.b.trainers||{})[tid];if(!t||!(c.gm||ownT(c,tid)))return;const on=!t.solo;
  if(await A().set(['battle','trainers',tid,'solo'],on?true:null))A().sysLog(`${t.name} — ${on?'개인전 (같은 진영과도 정보를 나누지 않고 서로 적)':'같은 팀으로 (진영과 정보 공유)'}`,'battle')}
 /* 함께 지시할 좌석 고르기 — 트레이너 주인과 GM 만. 트레이너 시트에 적는다 */
 function openCo(tid){const c=ctx();if(!c.gm&&tid!==c.seat)return;const R=((c.ST.state.roster||{}).trainers||{})[tid];if(!R)return A().toast('시트에 있는 트레이너만 함께 지시할 수 있다');
  const seats=Object.entries(c.ST.state.seats||{}).filter(([k])=>k!==tid);const on=new Set(coOf(c,tid));
  const md=A().openModal(`<div class="mhead"><h2>함께 지시하기 — ${esc(R.name||tid)}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="small dim" style="margin-bottom:10px">고른 플레이어는 이 트레이너의 지시 창을 같이 보고 고치고, 준비 완료 · 지시 공개 · 포켓몬 조작(HP · 공격 · 교대 …)도 함께 한다. 누가 저장하면 같이 보는 화면에 바로 불러온다.</div>
   <div class="cosel">${seats.length?seats.map(([k,v])=>{const tn=(((c.ST.state.roster||{}).trainers||{})[k]||{}).name;return `<label class="coseat"><input type="checkbox" value="${esc(k)}" ${on.has(k)?'checked':''}><b>${esc((v&&v.name)||k)}</b>${tn?`<small>${esc(tn)}</small>`:''}</label>`}).join(''):'<div class="dim">자리에 앉은 다른 플레이어가 없다</div>'}</div>
   <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn pri" data-cosave>저장</button></div>`);
  md.querySelector('[data-cosave]').onclick=async()=>{const pick=[...md.querySelectorAll('.cosel input:checked')].map(i=>i.value);const before=coOf(ctx(),tid);
   const r=await A().set(['roster','trainers',tid,'co'],pick.length?pick:null);if(r===false)return;A().closeModal();
   const nm=s=>(((ctx().ST.state.seats||{})[s]||{}).name||s);const add=pick.filter(s=>!before.includes(s)),del=before.filter(s=>!pick.includes(s));
   if(add.length||del.length)A().sysLog(`함께 지시하기 — ${R.name||tid}: ${[add.length?add.map(nm).join(' · ')+' 합류':'',del.length?del.map(nm).join(' · ')+' 빠짐':''].filter(Boolean).join(' / ')}`,'battle')}}
 async function toggleReady(tid){const c=ctx();const rd=!!(c.ST.state.ready||{})[tid];
  /* 11-03 감우 (검토 17): 「준비 완료」 때 행동이 비어 있는 에리어가 있으면 묻는다 */
  if(!rd){const cur=CMD[tid];const none=Object.values(c.b.mons||{}).filter(m=>m.tid===tid&&m.entry&&m.hp.cur>0).sort((x,y)=>x.entry.localeCompare(y.entry)).filter(m=>{const x=cur&&cur.mons&&cur.mons[m.id];return !x||x.move===''||x.move==null});
   if(none.length&&!(await askYes(`${none.map(m=>`${String(m.entry).toUpperCase()} ${m.name}`).join(' · ')}${none.length>1?'는':'은(는)'} 행동이 비어 있다.\n행동 없음으로 둘까?`,'행동 없음으로','돌아가서 고친다')))return}
  if(!rd){const ok=await saveCmd(tid,true);if(!ok)return}
  if(rd&&!c.mgr&&(+c.b.phase||0)>=1)return A().toast('턴이 시작돼서 준비를 풀 수 없다');
  const path=c.mgr||ownT(c,tid)?['ready',tid]:['ready',c.seat];
  await putShape(tid,rd);
  await A().set(path,rd?null:true);A().sysLog(`${((c.b.trainers||{})[tid]||{}).name||tid} ${rd?'준비 해제':'준비 완료'}`,'battle');
  /* 10-24 망령: 자리에 앉은 트레이너가 모두 준비를 마치면 한 줄 알림 (마지막으로 누른 사람이 쓴다) */
  if(!rd){const R=Object.assign({},c.ST.state.ready||{});R[path[1]]=true;const seats=c.ST.state.seats||{};const T=Object.keys(c.b.trainers||{}).filter(t=>seats[t]);
   if(T.length>=2&&T.every(t=>R[t]))A().sysLog(`【준비 완료】 양측 모두 지시 준비를 마쳤다${c.mgr?'':' — GM 의 「턴 개시」를 기다린다'}`,'battle')}}
 /* 턴 개시: 선행 입력한 지령·명령의 횟수를 미리 깎는다 (맵툴 set_turn_start). 주인의 호령(tc 7)은 능력·회복이 횟수를 같이 쓴다 */
 function chargeOne(t,data,b,used){t.orderCount=t.orderCount||{};const tc=OO().styles(t).tc;t.pcList={};   /* 11-03 20:47 (이토리 시온 「지령 선행 입력이 턴 개시에 자동 발동됐는데 횟수가 안 빠졌다」): 이번 턴에 무엇을 깎았는지 남긴다 — 깎은 뒤에 넣거나 바꾼 지령은 발동 때 깎는다 */
  for(const mid in (data.mons||{})){const m=b.mons[mid];if(!m||!m.entry||m.hp.cur<=0)continue;const x=data.mons[mid];
   if(x.order){const k='order_'+x.order;t.orderCount[k]=Math.max(0,(+t.orderCount[k]||0)-1);if(used)used.o++}
   if(x.order||x.command)t.pcList[mid]={o:x.order||'',c:x.command||''};
   if(x.command){const dec=k=>{t.orderCount[k]=Math.max(0,(+t.orderCount[k]||0)-1)};dec('command_'+x.command);if(used)used.c++;const sk=OO().shareKey(t,x.command);if(sk)dec('command_'+sk)}}}
 async function preCharge(){const c=ctx();const b=c.b;const key=turnKey(b);
  if(!c.gm){for(const t of myTrainers(c).filter(t=>lead(c,t)))await selfCharge(t);return}
  let rows;try{rows=await DBS().secretGet(c.ST.room,c.ST.secret,'cmd')}catch(e){return}
  const trs0=snap(ctx().b.trainers||{}),trs=snap(trs0);let any=false;
  const used={o:0,c:0};for(const r of rows||[]){const t=trs[r.id];if(!t||!r.data||!cmdFresh(r,b)||t.pcTurn===key)continue;if(c.fair&&seatOwned(c,r.id))continue;chargeOne(t,r.data,b,used);t.pcTurn=key;any=true}
  if(any)await A().setDiff(['battle','trainers'],trs0,trs,2)}
 /* 좌석: 내 지시의 선입력분은 내 화면이 깎는다 (모의전 · GM 불간섭 · GM 이 없을 때) */
 const BUSY={},SENT={};
 async function selfCharge(tid0){const c=ctx();const b=c.b;const tid=tid0||c.seat;const t=(b.trainers||{})[tid];if(c.role!=='seat'||!t)return;const key=turnKey(b);if(t.pcTurn===key||BUSY.pc===key)return;BUSY.pc=key;
  const cm=await myCmd(c,tid,true);const t0=snap((ctx().b.trainers||{})[tid]||t),t2=snap(t0);if(t2.pcTurn===key)return;const used={o:0,c:0};if(cm)chargeOne(t2,cm,ctx().b,used);else t2.pcList={};t2.pcTurn=key;await A().setDiff(['battle','trainers',tid],t0,t2,1)}
 /* 상태가 바뀔 때마다 (app.js onState): 턴 개시면 내 선입력 차감, 공개 요청이 오면 내 남은 지시를 연다, 진행자는 자동으로 넘긴다 */
 /* 10-26 망령: 배틀 준비(시합 개시 전) 중에 한 파티에 같은 소지품이 겹치면 그 파티를 다루는 사람(GM · 그 좌석)에게만 한 번 알린다. 소지품을 또 바꿔 다르게 겹치면 다시 */
 const DUP_SEEN={};
 function dupWatch(c,b){if(!b||b.started||!A().dupItems)return;const T=b.trainers||{};
  for(const [tid,t] of Object.entries(T)){if(!(c.gm||ownT(c,tid)))continue;const d=A().dupItems(Object.values(b.mons||{}).filter(m=>m.tid===tid));if(!d.length)continue;
   const key=(A().ST.room||'')+'|'+tid+'|'+JSON.stringify(d);if(DUP_SEEN[key])continue;DUP_SEEN[key]=1;const tx=A().dupItemText(t.name||tid,d);A().selfLog(tx);A().toast(tx)}}
 /* 10-26 망령: 【지연 (N턴)】 = 필드에 나온 턴을 1턴째로 셀 때 N번째 턴부터. 【지연 (N턴 동안)】 = 나온 턴부터 N턴 동안.
    턴이 바뀔 때마다(GM 창) 필드 포켓몬의 특성 · 소지품 · 포텐셜 글을 보고, 도달한 것은 알린다. 지연 표시가 ① 줄에 있고 구문이 있으면 N번째 턴에 자동 발동 */
 const DELAY_SEEN={};const DLY_RE=/【[^】]*지연\s*\((아군,\s*)?(\d+)\s*턴(\s*동안)?\)[^】]*】/;
 /* 10-27 망령: 자동 처리는 한 창만 — 「플레이어도 배틀 진행」이면 좌석도 진행 권한이라 창마다 따로 돌아 【지연】 이 두 번 찍혔다.
    접속 중인 GM 창이 있으면 그중 하나(id 가 가장 작은 것), 없으면 진행 권한 좌석 중 하나만 */
 function myPid(){try{const P=A().presList?A().presList():[];const me=P.find(p=>p.me);return me?String(me.id):'?'}catch(e){return '?'}}
 function isLeader(c){if(!c||!c.mgr)return false;const P=(A().presList?A().presList():[]).filter(p=>p.role==='gm'||p.role==='seat');const gms=P.filter(p=>p.role==='gm');const pool=gms.length?gms:P;if(!pool.length)return true;const lead=pool.slice().sort((x,y)=>String(x.id)<String(y.id)?-1:String(x.id)>String(y.id)?1:0)[0];return !!lead.me}
 async function delayWatch(c,b){if(!c.mgr||!b||!b.started||!FX())return;const T=+b.turn||0;const key=String(b.started)+'|'+T;if(DELAY_SEEN[key])return;if(!isLeader(c))return;if(+b.dlyT===T){DELAY_SEEN[key]=1;return}DELAY_SEEN[key]=1;await A().set(['battle','dlyT'],T);   /* dlyT: 이 턴의 지연 알림을 이미 했다 (새로고침 · 다른 창에서 또 하지 않게) */
  const notes=[];for(const m of Object.values(b.mons||{})){if(!m.entry||m.hp.cur<=0||!(+m.inT))continue;const k=T-(+m.inT)+1;
   const src=[['trait',m.ability,m.abilityEff],['item',m.item,m.itemEff],...potSrc(m).map(p=>['pot',p.name,p.eff])].filter(x=>x[1]&&x[2]);
   for(const [kind,name,eff0] of src){const eff=String(eff0).replace(/<br\s*\/?>/g,'\n');const lines=eff.split(/(?=[②③④⑤])/);
    lines.forEach((ln,li)=>{const mm=ln.match(DLY_RE);if(!mm)return;const N=+mm[2],ally=!!mm[1],dur=!!mm[3];const tag=mm[0];const lab=`${m.name} 「${name}」 ${tag}`;
     if(ally){if(k===N)notes.push(`${lab} — 나온 지 ${N}턴째 (아군 조건은 손으로 확인)`);return}
     if(dur){if(k===1)notes.push(`${lab} — 이번 턴부터 ${N}턴 동안 (${T}~${T+N-1}턴)`);else if(k===N+1)notes.push(`${lab} — 끝났다 (손으로 건 효과가 있으면 지운다)`);return}
     if(k!==N)return;const a=FX().autoOf(m,kind,name);
     if(li===0&&a&&a.ops&&a.ops.length&&!a.manual){fireAuto(m.id,kind,name,{quiet:true,head:`【지연】 ${lab} — 나온 지 ${N}턴째, 발동`}).catch(e=>console.warn('delay',e))}
     else notes.push(`${lab} — 나온 지 ${N}턴째, 이번 턴부터 (손으로)`)})}}
  if(notes.length)A().sysLog(`【지연】 ${T}턴\n${notes.join('\n')}`,'battle')}
 async function watch(){const c=ctx();const b=c.b;try{dupWatch(c,b)}catch(e){console.warn('dup',e)}if(b&&b.started&&(c.gm||c.role==='seat'))itemKickRemote();delayWatch(c,b).catch(e=>console.warn('delay',e));try{coWatch()}catch(e){}faintWatch().catch(e=>console.warn('faint',e));hpFormWatch().catch(e=>console.warn('hpform',e));answerAsks().catch(e=>console.warn('asks',e));if(b.endq&&b.endq.step)endAdvance();if((+b.phase||0)>=2)return autoRevealTurn();if((+b.phase||0)!==1)return;
  if(c.gm)for(const tid of Object.keys(b.trainers||{}).filter(t=>!seatOwned(c,t)))await publishOk(tid);
  if(c.role==='seat')for(const tid of myTrainers(c).filter(t=>lead(c,t))){await selfCharge(tid);await publishOk(tid);   /* 함께 지시하는 트레이너도 (주인이 없을 때) */
   const key=turnKey(b);if(String(b.revealReq||'')===key&&!BUSY.rv){const left=Object.values(b.mons||{}).filter(m=>m.tid===tid&&m.entry&&m.hp.cur>0&&!revealed(b,tid,m.id)&&!SENT[key+':'+m.id]);
    if(left.length){BUSY.rv=1;try{for(const m of left){if(revealed(ctx().b,tid,m.id))continue;SENT[key+':'+m.id]=1;await revealOne(tid,m.id,true)}}finally{BUSY.rv=0}}}}
  autoAdvance()}
 /* ----- 4식 6령 발동 창 (맵툴 order_mgr / order_run): 선행 발동 · 임의 발동 · 강제 ----- */
 function openFire(tid){const c=ctx();const b=c.b;const t=(b.trainers||{})[tid];if(!t)return;if(!c.gm&&!ownT(c,tid))return;
  const mons=Object.values(b.mons||{}).filter(m=>m.tid===tid&&m.entry&&m.hp.cur>0).sort((x,y)=>x.entry.localeCompare(y.entry));if(!mons.length)return A().toast('필드에 포켓몬이 없다');
  UIC.fire=UIC.fire||{};if(!mons.find(m=>m.id===UIC.fire[tid]))UIC.fire[tid]=mons[0].id;const m=mons.find(x=>x.id===UIC.fire[tid]);
  const cnt=t.orderCount||{};const fired=(((b.cmds||{})[tid]||{}).fired||{})[m.id]||{};const ph=+b.phase||0;
  const md=A().openModal(`<div class="mhead"><h2>포텐셜 발동 · ${esc(t.name)}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="tabs2">${mons.map(mm=>`<div class="tab2 ${mm.id===m.id?'on':''}" data-ftab="${mm.id}"><div class="pic" style="${mm.image?`background-image:url('${cssu(mm.image)}')`:''}"></div><div><b>${esc(mm.name)}</b><small>에리어 ${mm.entry.toUpperCase()}</small></div></div>`).join('')}</div>
   <div class="firepre small dim" id="firepre">선행 입력을 읽는 중…</div>
   ${(()=>{const U=uniqList(t);const E=specialPots(m);const fp=fired.pot||{};const row=(sk,x)=>{const n=x.p.name;const done=!!fp[(sk==='uq'?'u:':'e:')+n];const can=x.left===null||x.left>0;
     return `<div class="firerow ${done?'done':''}" data-sk="${sk}" data-sn="${esc(n)}"><b class="fnm"><span class="tag ${sk==='uq'?'uqt':'ext'}">${sk==='uq'?'고유':'전용'}</span> 『${esc(n)}』</b><span class="fcnt">${x.max!=null?pips(x.left,x.max):'횟수 없음'}</span><span class="sp"></span>
      <button class="btn sm pri" data-sfire="pre" data-sk="${sk}" data-sn="${esc(n)}" hidden>선행 발동</button><button class="btn sm" data-sfire="free" data-sk="${sk}" data-sn="${esc(n)}" ${can&&(ph>=1||/【\s*사전\s*】|「빈사」\s*상태가\s*되었을\s*때/.test(String(x.p.eff||'')))?'':'disabled'}>임의 발동</button>${c.gm?`<button class="btn sm ghost" data-sfire="force" data-sk="${sk}" data-sn="${esc(n)}">강제</button>`:''}</div><div class="small dim" style="padding:0 10px 6px">${esc(String(x.p.eff||'').replace(/<br\s*\/?>/g,' ').slice(0,220))}</div>`};
    return `${U.length?`<div class="sec">고유 포텐셜 <span class="note">${esc(t.name)} · 대상 ${esc(m.name)} (에리어 ${m.entry.toUpperCase()})</span></div><div class="firelist">${U.map(x=>row('uq',x)).join('')}</div>`:''}${E.length?`<div class="sec">전용 포텐셜 <span class="note">${esc(m.name)}</span></div><div class="firelist">${E.map(x=>row('ex',x)).join('')}</div>`:''}`})()}
   ${[['order','명령 (4식)',OO().orderKeys(t),k=>OO().orderName(t,k)],['command','지령 (6령)',OO().commandKeys(t),k=>OO().commandName(t,k)]].map(([kind,title,keys,nm])=>`<div class="sec">${title}</div><div class="firelist">${keys.map(k=>{const ck=(kind==='order'?'order_':'command_')+k;const n=+cnt[ck]||0;const done=fired[kind]===k;
    return `<div class="firerow ${done?'done':''}" data-fk="${k}" data-kind="${kind}"><b class="fnm">『${esc(nm(k))}』</b>${OO().ownerOf(t,k)?`<i class="oown">${esc(OO().ownerOf(t,k))} 몫</i>`:''}<span class="fcnt">남은 <b>${n}</b></span><span class="sp"></span>
     <button class="btn sm pri" data-fire="pre" data-kind="${kind}" data-k="${k}" hidden>선행 발동</button><button class="btn sm" data-fire="free" data-kind="${kind}" data-k="${k}" ${n>0&&(ph>=1||preTag(nm(k)))?'':'disabled'} title="남은 횟수 1을 써서 바로 발동${preTag(nm(k))?' · 【사전】 — 지시 준비 중에도':''}">임의 발동</button>${c.gm?`<button class="btn sm ghost" data-fire="force" data-kind="${kind}" data-k="${k}" title="횟수·입력과 상관없이 발동">강제</button>`:''}</div>`}).join('')||'<div class="small dim">쓰는 항목이 없다</div>'}</div>`).join('')}
   <div class="small dim" style="margin-top:8px">선행 발동 : 지시 입력에서 선행 입력한 것을 그 순간 발동 (턴 개시 때 횟수를 깎았다) · 임의 발동 : 남은 횟수 1을 써서 지금 발동 · 강제 : GM 이 횟수와 상관없이</div>`);
  md.querySelectorAll('[data-ftab]').forEach(el=>el.onclick=()=>{UIC.fire[tid]=el.dataset.ftab;A().closeModal();openFire(tid)});
  /* 선행 입력 읽기 (주인·GM 만 읽을 수 있다) */
  let CM=null;/* 10-26 망령: 「선행 발동」은 선행 입력한 그 포켓몬에게 — 다른 탭이 열려 있어도 입력한 포켓몬을 찾아 건다 */
  const preMid=(kind,k,sk,n)=>{const ms=(CM&&CM.mons)||{};if(kind){if((ms[m.id]||{})[kind]===k)return m.id;const id=Object.keys(ms).find(i=>(ms[i]||{})[kind]===k&&mons.some(x=>x.id===i));return id||m.id}if(sk==='ex'){if(((ms[m.id]||{}).pots||[]).includes(n))return m.id;const id=Object.keys(ms).find(i=>((ms[i]||{}).pots||[]).includes(n)&&mons.some(x=>x.id===i));return id||m.id}return m.id};
  myCmd(c,tid,true).then(cm=>{CM=cm;const pre=$('#firepre',md);if(!pre)return;const x=cm&&cm.mons&&cm.mons[m.id]||{};const parts=[];   /* 교대로 나간 포켓몬의 선행 입력은 함께 사라진다 (들어온 포켓몬이 이어받지 않는다) */
   for(const kind of ['order','command']){const k=x[kind];if(!k)continue;const nm=kind==='order'?OO().orderName(t,k):OO().commandName(t,k);parts.push(`${kind==='order'?'명령':'지령'} 『${esc(nm)}』${fired[kind]===k?' (발동함)':''}`);
    const bt=md.querySelector(`[data-fire="pre"][data-kind="${kind}"][data-k="${k}"]`);if(bt&&ph>=1&&fired[kind]!==k)bt.hidden=false;const row=md.querySelector(`.firerow[data-kind="${kind}"][data-fk="${k}"]`);if(row)row.classList.add('pre')}
   const fp=fired.pot||{};for(const [sk,list] of [['uq',(cm&&cm.upots)||[]],['ex',x.pots||[]]])for(const n of list){const key=(sk==='uq'?'u:':'e:')+n;const bt=md.querySelector(`[data-sfire="pre"][data-sk="${sk}"][data-sn="${CSS.escape(n)}"]`);if(!bt)continue;parts.push(`${sk==='uq'?'고유':'전용'} 『${esc(n)}』${fp[key]?' (발동함)':''}`);if(ph>=1&&!fp[key])bt.hidden=false;const r=bt.closest('.firerow');if(r)r.classList.add('pre')}
   /* 다른 포켓몬이 선행 입력한 명령 · 지령도 여기서 「선행 발동 → 그 포켓몬」으로 누를 수 있다 */
   for(const om of mons){if(om.id===m.id)continue;const ox=(cm&&cm.mons&&cm.mons[om.id])||{};const of=(((b.cmds||{})[tid]||{}).fired||{})[om.id]||{};
    for(const kind of ['order','command']){const k=ox[kind];if(!k||of[kind]===k)continue;const bt=md.querySelector(`[data-fire="pre"][data-kind="${kind}"][data-k="${k}"]`);if(bt&&ph>=1&&bt.hidden){bt.hidden=false;bt.textContent='선행 발동 → '+om.name}}}
   pre.innerHTML=`${esc(m.name)} (에리어 ${m.entry.toUpperCase()}) 선행 입력: ${parts.join(' · ')||'<span class="dim">없음</span>'}${ph<1?' <span class="dim">— 턴 개시 뒤에 발동할 수 있다</span>':''}`}).catch(()=>{});
  md.querySelectorAll('[data-fire]').forEach(bt=>bt.onclick=()=>fireOrder(tid,bt.dataset.fire==='pre'?preMid(bt.dataset.kind,bt.dataset.k):m.id,bt.dataset.kind,bt.dataset.k,bt.dataset.fire));
  md.querySelectorAll('[data-sfire]').forEach(bt=>bt.onclick=()=>fireSpecial(tid,bt.dataset.sfire==='pre'?preMid('',null,bt.dataset.sk,bt.dataset.sn):m.id,bt.dataset.sk,bt.dataset.sn,bt.dataset.sfire))}
 /* 트레이너 칸의 고유 「발동」: 대상(필드의 내 포켓몬 · 없으면 대상 없이) · 선행/임의/강제 를 고른다 */
 async function openUfire(tid,name){const c=ctx();const b=c.b;const t=(b.trainers||{})[tid];if(!t)return;if(!c.gm&&!ownT(c,tid))return;const x=uniqList(t).find(q=>q.p.name===name);if(!x)return;
  /* 11-02 망령 「상태 미라클아이 상대1체 2턴 — 상대가 안 뜨고 아군만 보인다」: 고유 구문이 「상대 1체」를 고르면 대상 목록을 상대 포켓몬으로 (기준은 이 트레이너의 나와 있는 포켓몬) */
  const ua0=FX()?FX().autoOf({tid},'pot',name):null;const foeT=!!(ua0&&ua0.ops&&JSON.stringify(ua0.ops).includes('"tgt":"enemy1"'));
  const mons=Object.values(b.mons||{}).filter(m=>(foeT?(m.side!==t.side&&m.tid!==tid):m.tid===tid)&&m.entry&&m.hp.cur>0).sort((p,q)=>p.entry.localeCompare(q.entry));const ph=+b.phase||0;
  /* 11-02 망령 「트레이너 고유 때도 누가 기준일지 고를 수 있게」: 이 트레이너의 나와 있는 포켓몬 중 기준(구문의 「자신」)을 고른다. 대상이 내 포켓몬이면 대상을 고를 때 기준도 같이 따라간다 */
  const own=Object.values(b.mons||{}).filter(m=>m.tid===tid&&m.entry&&m.hp.cur>0).sort((p,q)=>p.entry.localeCompare(q.entry));
  const md=A().openModal(`<div class="mhead"><h2><span class="tag uqt">고유</span> 『${esc(name)}』</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="small" style="margin-bottom:8px;white-space:pre-wrap">${esc(String(x.p.eff||'').replace(/<br\s*\/?>/g,'\n'))}</div>
   <div class="small dim">${esc(t.name)} · ${x.max!=null?pips(x.left,x.max):'횟수 없음'}</div>
   <div class="sec">대상${foeT?' <span class="dim small">— 상대 1체</span>':''}</div><div class="pool">${mons.map((m,i)=>`<div class="oc ${i===0?'mine':''}" data-ut="${m.id}"><b>${esc(m.name)}</b><small>${foeT?'상대 · ':''}에리어 ${m.entry.toUpperCase()}</small></div>`).join('')}<div class="oc ${mons.length?'':'mine'}" data-ut=""><b>대상 없음</b><small>${foeT?'발동할 때 고른다':'트레이너만'}</small></div></div>
   ${own.length>1||(foeT&&own.length)?`<div class="sec">기준 <span class="dim small">— 구문의 「자신」 · 예고 공격 등의 능력치는 이 포켓몬</span></div><div class="pool" id="ubase">${own.map((m,i)=>`<div class="oc ${i===0?'mine':''}" data-ub="${m.id}"><b>${esc(m.name)}</b><small>에리어 ${m.entry.toUpperCase()}</small></div>`).join('')}</div>`:''}
   <div class="small dim" id="upre" style="margin-top:6px">선행 입력 확인 중…</div>
   <div class="row" style="margin-top:10px"><span class="sp"></span><button class="btn pri" data-uf="pre" hidden>선행 발동</button><button class="btn" data-uf="free" ${x.left===null||x.left>0?'':'disabled'}>임의 발동</button>${c.gm?'<button class="btn ghost" data-uf="force">강제</button>':''}</div>`);
  let tgt=mons[0]?mons[0].id:'',base=own[0]?own[0].id:'';const markB=()=>md.querySelectorAll('[data-ub]').forEach(o=>o.classList.toggle('mine',o.dataset.ub===base));
  md.querySelectorAll('[data-ut]').forEach(el=>el.onclick=()=>{tgt=el.dataset.ut;md.querySelectorAll('[data-ut]').forEach(o=>o.classList.toggle('mine',o===el));if(!foeT&&tgt&&own.some(m=>m.id===tgt)){base=tgt;markB()}});
  md.querySelectorAll('[data-ub]').forEach(el=>el.onclick=()=>{base=el.dataset.ub;markB();if(!foeT&&tgt&&tgt!==base&&own.some(m=>m.id===tgt)){tgt=base;md.querySelectorAll('[data-ut]').forEach(o=>o.classList.toggle('mine',o.dataset.ut===tgt))}});
  md.querySelectorAll('[data-uf]').forEach(bt=>bt.onclick=()=>fireSpecial(tid,tgt,'uq',name,bt.dataset.uf,base));
  try{const rows=await DBS().secretGet(c.ST.room,c.ST.secret,'cmd');const r=(rows||[]).filter(q=>cmdFresh(q)).find(q=>q.id===tid);const cm=r&&(r.data||r.v||r.value||r);const up=(cm&&cm.upots)||[];const el=$('#upre',md);if(el)el.textContent=up.includes(name)?'이번 턴에 선행 입력했다':'선행 입력 안 함';if(up.includes(name)&&ph>=1){const p=md.querySelector('[data-uf=pre]');if(p)p.hidden=false}}catch(e){const el=$('#upre',md);if(el)el.textContent=''}}
 /* 고유(트레이너) · 전용 포텐셜 발동: 선행(지시에서 선행 입력한 것) · 임의 · 강제(GM). 횟수는 발동할 때 1 깎는다(강제 제외). 자동화가 있으면 대상 포켓몬에 걸고, 없으면 효과를 로그 카드로 */
 async function fireSpecial(tid,mid,sk,name,how,baseId){const c=ctx();const b=c.b;const t=(b.trainers||{})[tid];const m=(b.mons||{})[mid]||null;if(!t||(!m&&sk!=='uq'))return;if(!c.gm&&!ownT(c,tid))return;if(how==='force'&&!c.gm)return;
  const x=sk==='uq'?uniqList(t).find(q=>q.p.name===name):specialPots(m).find(q=>q.p.name===name);if(!x)return;
  if(how!=='force'&&x.left!==null&&x.left<=0)return A().toast('남은 횟수가 없다');
  A().closeModal();const tag=how==='pre'?'【선행】':how==='free'?'【임의】':'【강제】';const LB=sk==='uq'?'고유':'전용';
  if(how!=='force'&&x.max!=null){const T=+b.turn||0;
   if(x.mmax!=null){const cur=sk==='uq'?(t.uUses||{}):(m.potUses||{});const had=cur[name]==null?x.mmax:+cur[name];const uu=Object.assign({},cur);uu[name]=Math.max(0,had-1);await A().set(sk==='uq'?['battle','trainers',tid,'uUses']:['battle','mons',mid,'potUses'],uu)}
   if(x.per)await A().set(sk==='uq'?['battle','trainers',tid,'uTurn',name]:['battle','mons',mid,'potTurn',name],T)}   /* 【소진】 · 【탈진】: 쓴 턴을 적는다 */
  await A().set(['battle','cmds',tid,'fired',m?mid:'_t','pot',(sk==='uq'?'u:':'e:')+name],1);
  if(sk==='uq'){if(String(((A().ST.state.rp||{}).cutin||{}).ord)!=='0')cutFire('t:'+tid,trainerImg(t),`${t.name}의 고유!`,`『${name}』`,t.side==='left'?'#1f6fd1':'#e3101f')}else if(wantCut(m,name))cutFire('m:'+m.id,m.image,m.name,`『${name}』`,m.side==='left'?'#1f6fd1':'#e3101f');
  const left=x.max!=null?` 【${how==='force'?x.left:Math.max(0,x.left-1)}/${x.max}】`:'';
  const who=sk==='uq'?t.name:m.name;const bm0=sk==='uq'&&baseId&&(!m||m.side!==t.side)?(b.mons||{})[baseId]:null;const tgt=sk==='uq'?((m?` → ${m.name} (에리어 ${String(m.entry).toUpperCase()})`:'')+(bm0?` · 기준 ${bm0.name}`:'')):'';const img=sk==='uq'?trainerImg(t):(m.image||'');
  /* 10-28 망령 (빛의장막 고유): 고유 구문은 트레이너에서 바로 찾는다 — 대상을 안 골랐거나 상대 포켓몬을 골라도 돌게. 대상이 없으면 그 트레이너의 나와 있는 포켓몬을 기준으로 건다 */
  const foe=sk==='uq'&&m&&m.side!==t.side;   /* 고른 대상이 상대 포켓몬 — 구문의 「상대 1체」로 그 포켓몬을 쓰고, 기준(자신)은 이 트레이너의 포켓몬 */
  const ua=sk==='uq'&&FX()?(FX().autoOf({tid},'pot',name)||(m&&!foe&&FX().autoOf(m,'pot',name))):null;
  const bm=sk==='uq'&&baseId?(b.mons||{})[baseId]:null;const cm=(foe?null:m)||(bm&&bm.tid===tid&&bm.entry?bm:null)||(ua?Object.values(b.mons||{}).find(q=>q&&q.tid===tid&&q.entry)||Object.values(b.mons||{}).find(q=>q&&q.tid===tid):null);const cmid=cm?cm.id:mid;
  const a=sk==='uq'?ua:m&&FX()&&FX().autoOf(m,'pot',name);const pr0=prioNow(cmid);
  if(cm&&a&&a.ops&&a.ops.length&&!a.manual){setTimeout(()=>reprio(cmid,pr0),0);await fireAuto(cmid,'pot',name,{auto:a,quiet:true,uq:sk==='uq'&&!foe,pickId:foe?m.id:'',head:`【${LB}】 ${who} 『${name}』${left}${tag}${tgt}`,img,eff:String(x.p.eff||'')});return}
  A().sysLog(`【${LB}】 ${who} 『${name}』${left}${tag}${tgt?'\n대상:'+tgt.replace(' →',''):''}`,'battle',{mid:m?m.id:'',img,eff:String(x.p.eff||'').replace(/<br\s*\/?>/g,'\n').slice(0,400)})}
 async function fireOrder(tid,mid,kind,key,how){const c=ctx();const b0=snap(c.b),b=snap(b0);const t=b.trainers[tid];const m=b.mons[mid];if(!t||!m)return;
  const name=kind==='order'?OO().orderName(t,key):OO().commandName(t,key);const ck=(kind==='order'?'order_':'command_')+key;t.orderCount=t.orderCount||{};
  /* 10-26 망령 (서서 VS 마리 시험): 4식 · 6령은 한 턴에 종류별로 하나만 · 임의 발동은 원칙이 아니다 (선행 입력 → 선행 발동) */
  {const KN=kind==='order'?'4식(명령)':'6령(지령)';/* 11-03 22:05 망령 「영창도 지령 자동 발동에 뜨게 — COMMAND 는 다 저기」: 한 턴 하나는 같은 무리끼리(6령은 6령 · 영창은 영창 · 4식은 4식) — 영창이 6령에 막혀 안 걸리던 것 */const fam=k=>{const n=kind==='order'?OO().orderName(t,k):OO().commandName(t,k);const r=potRowOf(n)||potRowOf(n+'!');return (r&&r[0])||(/영창$/.test(n)?'영창':kind)};const used=Object.entries((((b.cmds||{})[tid]||{}).fired)||{}).find(([id,x])=>x&&x[kind]&&!(id===mid&&x[kind]===key&&how==='pre')&&fam(x[kind])===fam(key));
   {const why=how==='force'?'':noOrdWhy(m);if(why)return A().toast(`⚠ ${m.name} — ${KN}을 받을 수 없다 (${why}). 꼭 써야 하면 「강제」로`)}   /* 10-26 망령: 행동불능(반동) · 난동 · 반무적 · 올드 타입은 발동 때도 막는다 (지시 창 경고만으로는 선행 발동이 그대로 나갔다) */
   if(used&&how!=='force'){const um=b.mons[used[0]];return A().toast(`${KN}은 한 턴에 하나만 — 이번 턴에 이미 『${kind==='order'?OO().orderName(t,used[1][kind]):OO().commandName(t,used[1][kind])}』(${um?um.name:'?'})를 썼다`)}
   const MT={공격:'아군의 명중굴림 전',특공:'아군의 명중굴림 전',저격:'아군의 명중굴림 전',방어:'상대의 명중굴림 전',특방:'상대의 명중굴림 전',회피:'상대의 명중굴림 전',민첩:'행동 순서 공개 때',회복:'『지령』을 쓰지 않은 턴의 종료 때'};const mm=kind==='command'&&String(name).match(/^숙달(공격|특공|저격|방어|특방|회피|민첩|회복)지령$/);
   if(how==='free'&&!(await askYes(mm?`『${name}』 ② — ${MT[mm[1]]}에 【임의】로 쓸 수 있다.\n지금이 그때면 발동한다.`:`${KN}은 지시 단계에서 선행 입력한 것을 「선행 발동」으로 쓰는 게 원칙이다.\n【임의】가 붙는 조건(6령 ② 등)일 때만 임의 발동한다. 그래도 지금 임의 발동할까?`,mm?'발동':'임의 발동','그만')))return}
  let tag='';
  if(how==='pre'){tag='【선행】'}
  else if(how==='free'){if((+t.orderCount[ck]||0)<=0)return A().toast('남은 횟수가 없어 임의 발동할 수 없다');t.orderCount[ck]=(+t.orderCount[ck]||0)-1;{const sk=kind==='command'?OO().shareKey(t,key):'';const o=sk?'command_'+sk:'';if(o)t.orderCount[o]=Math.max(0,(+t.orderCount[o]||0)-1)}tag='【임의】'}
  else if(how==='force'){if(!c.gm)return;tag='【강제】'}
  const f=fieldOf(b);const fx=applyOrder(b.mons,f,t,name,mid);
  if(!fx.length&&FX()){const a=FX().rm(name)||FX().rm(String(name).replace(/\s*[:：]\s*/,' / '));if(a&&a.ops&&a.ops.length&&!a.manual){const r=await FX().run(a.ops,uiCtx(b,m,name,m.entry));fx.push(...r.lines)}}
  if(!fx.length)fx.push(`「${name}」 — 손으로 처리`);
  A().closeModal();
  const okT=await A().setDiff(['battle','trainers',tid],b0.trainers[tid],t,1);if(!okT)return;if(String(((A().ST.state.rp||{}).cutin||{}).ord)!=='0')cutFire('t:'+tid,trainerImg(t),`${t.name}의 지시!`,`『${name}』`,t.side==='left'?'#1f6fd1':'#e3101f');b.trainers[tid]=b0.trainers[tid];await saveBattle(b0,b,f,{n:t.name,s:name,img:trainerImg(t)});await A().set(['battle','cmds',tid,'fired',mid,kind],key);
  /* 11-03 21:54 망령 「4식이나 지령 발동할 때 효과도 UI 에 넣어서 나와야지」: 레디메이드 글이 비어 있으면 제작기 포텐셜 표(4식 · 6령 · 5계 · 영창 …)의 효과 글 */
  const oeff=(FX()&&FX().rm&&(FX().rm(name)||{}).text)||((potRowOf(name)||potRowOf(String(name).replace(/[!！]$/,''))||[])[2])||((potRowOf(name+'!')||[])[2])||'';
  A().sysLog(`【${kind==='order'?'명령':'지령'}】 ${t.name}의 지시! 『${name}』 → ${m.name} (에리어 ${String(m.entry).toUpperCase()}) 【${Math.max(0,+t.orderCount[ck]||0)}/시】${tag}${fx.length?'\n'+fx.join('\n'):''}`,'battle',{mid:m.id,img:trainerImg(t),eff:String(oeff).replace(/<br\s*\/?>/g,'\n').slice(0,400)})}
 /* 【사전】 태그: 지시 준비(페이즈 0)에도 쓸 수 있다 — 효과 글은 레디메이드 · 제작기 포텐셜 표에서 */
 function preTag(name){const t=((FX()&&FX().rm&&FX().rm(name))||{}).text||(((DB().maker||{}).pots||[]).find(r=>r[1]===name)||[])[2]||'';return /【\s*사전\s*】/.test(String(t))}
 /* 맵툴 open_command 처럼 에리어(포켓몬) 하나씩 공개한다. 좌석은 자기 것만, GM 은 아무 것이나 */
 function revealed(b,tid,part){const cm=((b.cmds||{})[tid]||{});return part==='orders'?!!cm.revealedOrders:!!((cm.mons||{})[part])}
 const cmdFresh=(r,b)=>{const d=r&&r.data;return !!d&&(d.turn==null||(+d.turn||1)===(+(b||ctx().b).turn||1))};
 async function myCmd(c,tid,quiet){let rows;try{rows=await DBS().secretGet(c.ST.room,c.ST.secret,'cmd')}catch(e){if(!quiet)A().toast('지시를 읽지 못했다: '+e.message);return null}const r=(rows||[]).filter(x=>cmdFresh(x,c.b)).find(x=>x.id===tid);if(!r){if(!quiet)A().toast('저장된 지시가 없다 — 먼저 「저장」');return null}return r.data}
 function revealCardText(b,t,m,x){if(x.move==='switch')return `${t.name} · ${m.name} (${slotName(b,m.side+'_'+m.entry).replace(/<[^>]+>/g,'')}): 「교대」 → ${monName(b,x.switch)}`;
  if(x.move===''||x.move==null)return `${t.name} · ${m.name}: (행동 없음)`;const mv=MVS(m)[+x.move]||{};
  const thr=(m.states||{}).Thrash&&!x.tman&&mv.cat!=='변화'&&!/전체|적진|자진|자신/.test(String(mv.range||''));   /* 10-26: 난동부리기면 대상은 공격할 때 랜덤 */
  return `${t.name} · ${m.name} (${SIDE_KO[m.side]} ${String(m.entry).toUpperCase()}): 「${mv.name||'?'}」 ${mv.type||''}·${mv.cat||''} · 위력 ${mv.pow||'-'} · 명중 ${mv.acc||'-'}${mv.prio?' · 우선도 '+mv.prio:''}${thr?' → 적진에서 랜덤 (「난동부리기」)':x.targets&&x.targets.length?' → '+tgNow(b,x,m).map(sl=>slotName(b,sl).replace(/<[^>]+>/g,'')).join(', '):''}${mv.eff&&mv.eff!=='-'?'\n   '+mv.eff:''}`}
 /* 공개 카드 그림용 (10-24 망령): 누가 · 무엇을 · 누구에게 — 로그가 그림 칩으로 그린다 */
 function revealData(b,t,m,x){const at=sl=>{const [s,a]=String(sl).split('_');const q=Object.values(b.mons||{}).find(q=>q.side===s&&q.entry===a&&q.hp&&q.hp.cur>0);return {slot:sl,side:s,area:String(a||'').toUpperCase(),name:q?q.name:'',img:q?q.image||'':'',mid:q?q.id:''}};
  const o={tr:t.name||'',mid:m.id,name:m.name,img:m.image||'',side:m.side,area:String(m.entry||'').toUpperCase()};
  if(x.move==='switch'){const w=(b.mons||{})[x.switch]||{};return Object.assign(o,{sw:{name:w.name||monName(b,x.switch)||'',img:w.image||''}})}
  if(x.move===''||x.move==null)return Object.assign(o,{none:1});const mv=MVS(m)[+x.move]||{};
  return Object.assign(o,{mv:{name:mv.name||'?',type:mv.typeEn||'',typeKo:mv.type||'',cat:mv.cat||'',pow:mv.pow||'-',acc:mv.acc||'-',prio:+mv.prio||0},tg:tgNow(b,x,m).map(at)})}
 let autoT=null;
 function autoAdvance(){const c=ctx();const b=c.b;if(!c.mgr)return;const me=c.gm?'gm':c.seat;if((b.host||'gm')!==me)return;if(me==='gm'&&!isLeader(c))return;   /* 10-27: GM 창 여럿이면 리더 하나만 */if((+b.phase||0)!==1||b.tstep)return;if(unrevealed(b).length)return;clearTimeout(autoT);autoT=setTimeout(async()=>{const c2=ctx();if((+c2.b.phase||0)!==1||c2.b.tstep||unrevealed(c2.b).length)return;A().sysLog('지시가 모두 공개됐다','battle');await stepTurn()},800)}
 /* 같은 포켓몬 공개가 여러 길(자동 공개 · 내 차례 공개 · 버튼)로 겹쳐 들어오면 로그가 두 번 찍혔다 (10-24 망령) — 진행 중이면 무시하고, 기다린 뒤 다시 확인 */
 const RVING=new Set();
 async function revealOne(tid,part,quiet){const rk=tid+':'+part+':'+(+ctx().b.turn||0);if(RVING.has(rk))return;RVING.add(rk);try{return await revealOne0(tid,part,quiet)}finally{setTimeout(()=>RVING.delete(rk),1500)}}
 async function revealOne0(tid,part,quiet){const c=ctx();const b=c.b;const t=(b.trainers||{})[tid];if(!t)return;if(!c.gm&&!ownT(c,tid))return A().toast('내 지시만 공개할 수 있다');
  if(fairOff(c,tid))return A().toast(seatOwned(c,tid)?'GM 불간섭 설정 — 플레이어의 지시는 그 플레이어가 연다':'PL 권한 중 — 다른 GM 이 불러온 트레이너의 지시는 그 GM 이 연다');
  const cm=await myCmd(c,tid,quiet);if(!cm)return;
  const m=b.mons[part];if(!m)return;if(revealed(b,tid,part)||revealed(ctx().b,tid,part))return;const x=pubMon((cm.mons||{})[part]);
  {const cur=(ctx().b.cmds||{})[tid];if(!cur)await A().set(['battle','cmds',tid],{mons:{[part]:x}});else if(!cur.mons)await A().set(['battle','cmds',tid,'mons'],{[part]:x});else await A().set(['battle','cmds',tid,'mons',part],x)}if(cm.detail&&!((b.cmds||{})[tid]||{}).detail)await A().set(['battle','cmds',tid,'detail'],cm.detail);A().sysLog('【공개】 '+revealCardText(b,t,m,x),'battle',{rv:[revealData(b,t,m,x)]})}
 async function reveal(npcOnly){const c=ctx();if(!c.gm)return;const b=c.b;npcOnly=npcOnly||c.fair;
  let rows;try{rows=await DBS().secretGet(c.ST.room,c.ST.secret,'cmd')}catch(e){return A().toast('지시를 읽지 못했다: '+e.message)}
  const cmds={};(rows||[]).forEach(r=>{if((b.trainers||{})[r.id]&&cmdFresh(r,b)&&!(npcOnly&&seatOwned(c,r.id)))cmds[r.id]=r.data});
  if(!Object.keys(cmds).length){if(!npcOnly)A().toast('저장된 지시가 없다');return}
  const already=b.cmds||{};const out={};if(npcOnly)for(const tid in already)if(seatOwned(c,tid))out[tid]=already[tid];
  for(const tid in cmds){const cm=cmds[tid];const al=already[tid]||{};const o={mons:{},detail:cm.detail||'',fired:al.fired||{}};for(const mid in (cm.mons||{})){const m=b.mons[mid];if(!m||!m.entry)continue;o.mons[mid]=al.mons&&al.mons[mid]?al.mons[mid]:pubMon(cm.mons[mid])}out[tid]=o}
  await A().set(['battle','cmds'],out);await A().set(['battle','phase'],Math.max(1,+b.phase||0));
  const lines=[],rvs=[];for(const tid in out){if(!cmds[tid])continue;const t=b.trainers[tid];const cm=out[tid];
   for(const mid in cm.mons){const m=b.mons[mid];if(!m||!m.entry)continue;if(already[tid]&&already[tid].mons&&already[tid].mons[mid])continue;lines.push(revealCardText(b,t,m,cm.mons[mid]));rvs.push(revealData(b,t,m,cm.mons[mid]))}
   if(cm.detail)lines.push(`${t.name}: ${cm.detail}`)}
  if(lines.length)A().sysLog('【모두 공개】\n'+lines.join('\n'),'battle',{rv:rvs})}

 /* 지령·명령 효과 (Lib:readymade 의 지령 레디메이드와 같은 내용). 랭크는 임시(턴 종료 해제). 플래그는 flags 에 두고 공격 창이 읽는다 */
 const STATWORD={공격:'attack',방어:'defense',특공:'specialattack',특방:'specialdefense',민첩:'speed',저격:'accuracy',회피:'evasion',스피드:'speed',명중:'accuracy'};
 function tempRank(m,k,d){m.rank=m.rank||{};m.tempRank=m.tempRank||{};const lim=k==='critical'?4:6;const b0=+m.rank[k]||0;const a=Math.max(-lim,Math.min(lim,b0+d));m.rank[k]=a;m.tempRank[k]=(+m.tempRank[k]||0)+(a-b0)}   /* 한계(±6)에 막힌 만큼은 기록하지 않는다 — 턴 종료 해제 때 랭크가 깎이지 않게 */
 function applyOrder(mons,f,t,name,targetId){const out=[];const tgt=mons[targetId];const allies=Object.values(mons).filter(m=>sameT(m,t)&&m.entry&&m.hp.cur>0);const enemies=Object.values(mons).filter(m=>!sameT(m,t)&&m.entry&&m.hp.cur>0);
  const n=String(name||'');let m;
  if((m=n.match(/^(숙달|전개|방해)?(공격|방어|특공|특방|민첩|회복|저격|회피)지령$/))){const pre=m[1]||'',st=m[2];
   if(st==='회복'){if(pre==='방해'){for(const e of enemies){e.states=e.states||{};if(!e.states.HealBlock)e.states.HealBlock=1}out.push(`상대 전체 「회복봉인」 (턴 종료까지)${enemies.length?'':' — 대상 없음'}`);return out}if(tgt){const v=Math.max(1,Math.floor(tgt.hp.max/4));tgt.hp.cur=Math.min(tgt.hp.max,tgt.hp.cur+v);out.push(`${tgt.name} HP +${v}`)}return out}
   const k=STATWORD[st];
   if(pre==='방해'){for(const e of enemies){e.rank=e.rank||{};e.rank[k]=Math.max(-6,(+e.rank[k]||0)-1)}out.push(`상대 전체 ${st} −1`);return out}
   if(!tgt)return out;
   if(pre==='전개'){tgt.mod=tgt.mod||{};tgt.mod[k]=(+tgt.mod[k]||1)*2;tgt.tempMod=tgt.tempMod||{};tgt.tempMod[k]=(+tgt.tempMod[k]||1)*2;out.push(`${tgt.name} ${st} ×2`);return out}
   tempRank(tgt,k,1);out.push(`${tgt.name} ${st} +1`);return out}
  if((m=n.match(/^(검|방패|관|잔|날개|촛불|장막)의 영창$/))){const k={검:'attack',방패:'defense',관:'specialattack',잔:'specialdefense',날개:'speed',촛불:'accuracy',장막:'evasion'}[m[1]];for(const a of allies)tempRank(a,k,1);out.push(`아군 전체 ${STAT_KO[k]} +1`);return out}
  if(n==='물리결계'||n==='특수결계'){f.objects[t.side]=f.objects[t.side]||{};f.objects[t.side][n==='물리결계'?'리플렉터':'빛의장막']=3;out.push(`${SIDE_KO[t.side]} ${n==='물리결계'?'리플렉터':'빛의장막'} 3T`);return out}
  if(n==='치유의 법계'){for(const a of allies){const v=Math.max(1,Math.floor(a.hp.max/4));a.hp.cur=Math.min(a.hp.max,a.hp.cur+v)}out.push('아군 전체 HP 1/4 회복');return out}
  if(n==='정화의 법계'){const db=(DB().states||{}).st||{};let c=0;for(const a of allies){for(const k in (a.states||{})){if(db[k]&&db[k].neg){delete a.states[k];c++}}}out.push(`아군 상태 이상 ${c}개 해제`);return out}
  if(/^주인의 호령\s*[:：]\s*회복$/.test(n)){if(!tgt){out.push('「주인의 호령 : 회복」 (대상 없음)');return out}const v=Math.max(1,Math.floor(tgt.hp.max/3));const h=Math.min(v,tgt.hp.max-tgt.hp.cur);tgt.hp.cur+=h;const cured=[];for(const k of ['Poison','Toxic','Burn','Paralysis','Freeze','Sleep'])if((tgt.states||{})[k]){delete tgt.states[k];cured.push(k)}out.push(`${tgt.name} HP +${h} (1/3)${cured.length?` · 상태 이상 ${cured.length}개 치유`:''}`);return out}   /* 「능력」(강화 1.5배)은 레디메이드 「주인의 호령 / 능력」이 돈다 */
  /* 4식: 플래그 */
  const FLAG={'버텨라!':'endure','맞춰라!':'surehit','물러나!':'dodgePhys','피해라!':'dodgeSpec','바꿔라!':'swap','돌아와!':'return','지킬 수 없다!':'hitPhys','피할 수 없다!':'hitSpec','버틸 수 없다!':'noEndure','맞출 수 없다!':'acc0','주인의 칙령':'dodgeOnce','파계':'nullify','윤회의 법계':'rebirth'};
  if(FLAG[n]){if(tgt){tgt.flags=tgt.flags||{};tgt.flags[FLAG[n]]=1;out.push(`${tgt.name} 「${n}」`)}else out.push(`「${n}」 (대상 없음)`);return out}
  return out}   /* 여기서 모르는 지시는 fireOrder 가 레디메이드를 찾아 보고, 그래도 없으면 「손으로 처리」를 붙인다 (점검 3-3) */

 /* 따라가때리기 기술: 기술 태그·효과 글, 또는 효과 엔진이 붙인 「추격」 */
 const pursuitX2=mv=>/교대할 때 2배의 위력/.test(String((mv||{}).eff||''));
 function isPursuit(mv,m){if(!mv)return false;if((m&&m.flags||{}).pursuit)return true;if((mv.tags||[]).some(t=>/따라가때리기/.test(t))||/따라가때리기/.test(String(mv.tag||'')))return true;return /교대할 때 2배의 위력|교대하는 대상에게 명중/.test(String(mv.eff||''))}
 /* ----- 행동 순서 ----- */
 async function computeOrder(){const c=ctx();if(!c.mgr)return;const b=c.b;const f=fieldOf(b);const iceUsed=[];
  let SEC={};try{const rows=await DBS().secretGet(c.ST.room,c.ST.secret,'cmd');for(const r of rows||[]){if(!cmdFresh(r))continue;const d=r.data||{};for(const mid in (d.mons||{}))SEC[mid]=d.mons[mid]}}catch(e){}   /* 선행 입력에 묻은 추격·추격 무시 (GM 만 읽힌다) */
  const slots=allEntered(b);if(!slots.length)return A().toast('등장한 포켓몬이 없다');
  /* 순서 열쇠: 읽을 수 있는 비밀 지시(GM 은 전부) → 좌석이 올린 열쇠(cmds[tid].ok) → 이미 공개된 지시 */
  {const stale=()=>{const bb=ctx().b;const tk0=turnKey(bb);return [...new Set(allEntered(bb).map(x=>x.mon).filter(m=>!SEC[m.id]).map(m=>m.tid))].filter(tid=>{const ok=((bb.cmds||{})[tid]||{}).ok;return ok&&ok.key===tk0&&ok.sig!=null&&ok.sig!==prioSig(bb,tid)})};
   for(let k=0;k<8&&stale().length;k++)await new Promise(r=>setTimeout(r,400));const st=stale();if(st.length)A().sysLog(`【행동 순서】 ${st.map(t=>(b.trainers[t]||{}).name||t).join(' · ')} 쪽 우선도 정보가 아직 옛것일 수 있다 — 순서가 이상하면 잠시 뒤 「행동 순서」를 다시 누른다`,'battle')}
  const tk=turnKey(b);const keyOf=m=>{if(SEC[m.id])return okeyOf(m,SEC[m.id]);const ok=((ctx().b.cmds||{})[m.tid]||{}).ok;if(ok&&ok.key===tk&&ok.m&&ok.m[m.id])return ok.m[m.id];const px=(((b.cmds||{})[m.tid]||{}).mons||{})[m.id];return px?okeyOf(m,px):null};
  const KEYS={},miss=[];for(const s of slots){const k=keyOf(s.mon);if(!k&&s.mon.started)miss.push(`${(b.trainers[s.mon.tid]||{}).name||'?'} · ${s.mon.name}`);KEYS[s.mon.id]=k||{sw:0,pm:{},om:{},pr:0,mv:0}}
  if(miss.length&&!(await askYes(`아직 순서 정보가 없는 포켓몬: ${miss.join(', ')}\n(지시를 저장하지 않았거나 그 플레이어가 접속해 있지 않다)\n행동 없음으로 보고 순서를 계산할까?`)))return;
  const spNotes=[];const entries=slots.map(s=>{const K=KEYS[s.mon.id];let prioMod=+K.pr||0;if(K.mv&&s.mon.prioDown){prioMod-=1;iceUsed.push(s.mon)}
   const objs=(f.objects||{})[s.side]||{};
   const SPM=spMulOf(s.mon,f);if(SPM.why.length)spNotes.push(...SPM.why);
   return {slot:s.slot,mon:s.mon,cmd:{change:!!K.sw,priorityMap:K.pm||{},orderMap:K.om||{}},prioMod,started:!!s.mon.started,scarf:IT(s.mon)==='구애스카프',tailwind:(objs['순풍']||0)>0,swamp:(objs['습원']||0)>0,spMul:SPM.v}});
  const rows=B().turnOrder(entries,{trick:((f.rooms||{})['트릭룸']||0)>0});
  const swPur=(b.tstep&&b.swPur)||[];
  const order=rows.filter(r=>!swPur.includes(r.mon.id)).map(r=>{const K=KEYS[r.mon.id]||{};
   return {...(!r.change&&misagA1(b,r.mon)?{noact:misagA1(b,r.mon)}:{}),slot:r.slot,mid:r.mon.id,name:r.mon.name,side:r.mon.side,change:r.change,started:r.started,order:r.order,prio:r.prio,speed:r.speed,dice:r.dice,move:K.pn||'',targets:K.tg||[],pursuit:!!K.pn,pursuitSrc:K.psrc||'',pimm:K.pimm||'',ut:K.ut?1:0}});
  /* 추격: 교대하는 대상을 노리면 교대보다 먼저 때린다 */
  const notes=[];if(((f.rooms||{})['트릭룸']||0)>0)notes.push('「트릭룸」이 시공간을 뒤틀었다! (스피드 역순)');for(const mid of swPur)notes.push(`${(b.mons[mid]||{}).name||'?'} — 교대 때 따라가때리기로 이미 행동`);
  for(const m of iceUsed)notes.push(`${m.name} 「아이스번」 — 이번 기술 우선도 −1`);notes.push(...spNotes);
  /* 따라가때리기: 교대하려는 대상을 노리면 그 교대 바로 앞으로 끌어당기고, 그 공격은 위력 2배 (공격 창이 pursuitHit 를 본다) */
  const purs=[];for(const o of order.filter(z=>z.pursuit))for(const t of o.targets){const v=order.find(z=>z.slot===t&&(z.change||(z.ut&&order.indexOf(z)<order.indexOf(o))));if(!v)continue;   /* 10-24 제보: 「유턴」으로 빠지려는 대상도 — 먼저 움직인 유턴 포켓몬이 빠지기 직전에 때린다 */
   if(v.pimm){notes.push(`${v.name}의 『${v.pimm}』 — ${o.name}의 따라가때리기를 무시했다!`);A().sysLog(`【따라가때리기】 ${v.name} 『${v.pimm}』\n${o.name}의 따라가때리기를 무시했다! (교대는 그대로)`,'battle',{mid:v.mid,img:(b.mons[v.mid]||{}).image||''});continue}
   const i=order.indexOf(o),j=order.indexOf(v);
   if(!v.change&&v.ut){order.splice(i,1);order.splice(order.indexOf(v)+1,0,o);o.pursuitHit=v.mid;v.utHit=1;notes.push(`${o.name}의 「${o.move}」 — 「유턴」으로 빠지려는 ${v.name}을(를) 교대 전에 때린다! (${v.name}은 공격 뒤 바로 교대하지 말고 기다린다)`);purs.push([o,v]);break}
   if(i>j){order.splice(i,1);order.splice(j,0,o)}o.pursuitHit=v.mid;notes.push(`${o.name}의 「${o.move}」 — 교대하려는 ${v.name}을(를) 먼저 때린다!`);purs.push([o,v]);break}
  for(const o of order){if(!o.pursuitHit){delete o.pursuitSrc;o.pursuit=false;o.move='';o.targets=[]}delete o.pimm;delete o.ut}   /* 기술 이름·대상은 차례가 와서 공개될 때까지 순서표에 남기지 않는다 (걸린 따라가때리기만 예외) */   /* 걸리지 않은 선행 추격·추격 무시는 공개 순서표에 남기지 않는다 */
  for(const m of iceUsed)await A().set(['battle','mons',m.id,'prioDown'],null);
  {let i0=0;while(i0<order.length&&order[i0].noact){A().sysLog(`${order[i0].name} — ${order[i0].noact} (차례를 건너뛴다)`,'battle');i0++}
   /* 11-03 감우: 순서 · 색인 · 메모 · 페이즈를 한 번에 (om_jset_many) */const ops=[[['battle','order'],order],[['battle','orderIdx'],i0],[['battle','orderNotes'],notes],[['battle','phase'],2]];if(b.tstep)ops.push([['battle','tstep'],null]);if(b.swPur)ops.push([['battle','swPur'],null]);if(!await A().setMany(ops))return}
  cutPhase('행동 순서','');for(const [o,v] of purs){const pm=b.mons[o.mid]||{};A().sysLog(`【따라가때리기】 ${o.name} 『${o.move}』 발동!${o.pursuitSrc?'\n선행 『'+o.pursuitSrc+'』에 묻어 있던 추격':''}\n${v.utHit?'「유턴」으로 빠지려는':'교대하려는'} ${v.name}을(를) 교대 전에 먼저 때린다${pursuitX2(((b.mons[o.mid]||{}).moves||[]).find(q=>q.name===o.move))?' → 위력 2배':''}`,'battle',{mid:o.mid,img:pm.image||''});setTimeout(()=>cutFire('m:'+o.mid,pm.image,`${o.name}의 따라가때리기!`,`『${o.move}』 → ${v.name}`,pm.side==='left'?'#1f6fd1':'#e3101f'),1600)}A().sysLog('행동 순서\n'+order.map((o,i)=>`${i+1}. ${o.name} (${o.change?'교대 · ':''}${o.order!==20?'순서 '+o.order+' · ':''}${o.prio?'우선 '+o.prio+' · ':''}스피드 ${Math.round(o.speed)}${order.some(q=>q!==o&&Math.round(q.speed)===Math.round(o.speed)&&(+q.prio||0)===(+o.prio||0)&&q.order===o.order)?' · 동속 주사위 '+o.dice:''})`).join('\n')+(spNotes.length?'\n'+spNotes.map(x=>'· '+x).join('\n'):''),'battle',{ord:order.map(o=>({n:o.name,img:(b.mons[o.mid]||{}).image||'',side:o.side,s:Math.round(o.speed),cap:!o.started?'교대 등장':o.change?'통상 교대':o.order!==20?orderValueName(o.order):'우선도 '+(o.prio>0?'+':'')+o.prio+(o.pursuitHit?' · 따라가때리기':'')}))})}

 /* 10-27 망령: 행동 순서 다시 계산 — 턴 도중 바뀐 상황(스피드 랭크 · 마비 · 트릭룸 · 순풍 · 습원 · 스카프 · 날씨 특성)을 아직 행동하지 않은 차례에만 적용한다.
    이미 행동한 차례(지금 칸 앞)와 지금 행동 중인 칸은 그대로 (행동 순서가 막 나온 2단계면 첫 칸부터). 순서값 · 우선도 · 교대 · 교대 등장은 처음 계산한 값 그대로, 같은 스피드는 처음 주사위 그대로 */
 async function resortOrder(){const c=ctx();if(!c.mgr)return;const b=c.b;const O=(b.order||[]).map(o=>Object.assign({},o));if(!O.length)return;
  const ph=+b.phase||0;const cur=+b.orderIdx||0;const st=ph===2?cur:cur+1;if(st>=O.length-1)return A().toast('다시 줄 세울 차례가 없다 (남은 차례가 하나 이하)');
  const rest=O.slice(st);if(rest.some(o=>o.pursuitHit))return A().toast('따라가때리기가 걸린 차례가 남아 있어 다시 계산하지 않는다 — 초상을 눌러 손으로 옮긴다');
  const f=fieldOf(b);const trick=((f.rooms||{})['트릭룸']||0)>0;
  const ents=rest.map(o=>{const m=(b.mons||{})[o.mid];if(!m)return null;const objs=(f.objects||{})[m.side]||{};
   return {slot:o.slot,mon:m,cmd:{change:!!o.change,priorityMap:{},orderMap:{[o.slot]:o.order}},prioMod:+o.prio||0,started:!!o.started,scarf:IT(m)==='구애스카프',tailwind:(objs['순풍']||0)>0,swamp:(objs['습원']||0)>0,spMul:spMulOf(m,f).v}}).filter(Boolean);
  const rows=B().turnOrder(ents,{trick});const sp={};for(const r of rows)sp[r.mon.id]=r.speed;
  const before=rest.map(o=>o.mid);
  for(const o of rest)if(sp[o.mid]!=null)o.speed=sp[o.mid];
  rest.sort((a,b2)=>((b2.started?1:0)-(a.started?1:0))||((b2.change?1:0)-(a.change?1:0))||(b2.order-a.order)||(b2.prio-a.prio)||(b2.speed-a.speed)||(b2.dice-a.dice));
  const order=[...O.slice(0,st),...rest];const moved=rest.some((o,i)=>o.mid!==before[i]);
  const notes=(b.orderNotes||[]).filter(x=>!/^「트릭룸」/.test(x));if(trick)notes.unshift('「트릭룸」이 시공간을 뒤틀었다! (스피드 역순)');
  await A().setMany([[['battle','order'],order],[['battle','orderNotes'],notes]]);
  A().sysLog(`【행동 순서 다시 계산】 ${st+1}번째 차례부터${moved?'':' — 순서는 그대로'}\n`+rest.map((o,i)=>`${st+i+1}. ${o.name} (${o.change?'교대 · ':''}${o.order!==20?'순서 '+o.order+' · ':''}${o.prio?'우선 '+o.prio+' · ':''}스피드 ${Math.round(Math.abs(o.speed))}${trick?' · 트릭룸':''})`).join('\n'),'battle')}

 /* ----- 턴 종료 ----- */
 /* 턴 마무리: 「턴 가장 마지막」 → (턴 종료 처리) → 「턴 종료 이후」. 그 타이밍이 적힌 포텐셜(필드의 포켓몬 · 그 트레이너 고유)이 있으면 단계마다 발동을 묻고, 없으면 그냥 넘어간다 */
 /* 「턴 종료 시까지」「가장 마지막까지」는 해제 타이밍이라 발동 후보가 아니다 */
 const END_T={last:/가장\s*마지막(?!\s*까지)/,end:/턴\s*종료\s*(시|때|시점|에)(?!\s*까지)|턴\s*종료\s*마다/,after:/턴\s*종료\s*(이후|후|뒤)(?!\s*까지)/};
 function endCands(b,step){const out=[];const ok=t=>{t=String(t||'');if(step==='end'&&END_T.after.test(t)&&!END_T.end.test(t.replace(END_T.after,'')))return false;return END_T[step].test(t)};
  for(const m of Object.values(b.mons||{})){if(!m.entry||m.hp.cur<=0)continue;for(const p of potSrc(m))if(ok(p.eff))out.push({m,kind:'pot',name:p.name,eff:p.eff,tag:isExcl(m,p)?'전용':'포텐셜'})}
  const seen=new Set();for(const m of Object.values(b.mons||{})){if(!m.entry||m.hp.cur<=0||seen.has(m.tid))continue;seen.add(m.tid);const t=(b.trainers||{})[m.tid];for(const x of uniqList(t))if(ok(x.p.eff))out.push({m,kind:'uq',name:x.p.name,eff:x.p.eff,tag:'고유',t})}
  return out}
 /* 턴 마무리 (10-23): 단계마다 그 타이밍 포텐셜을 가진 트레이너의 주인 화면에만 묻는다 (플레이어 몫은 그 플레이어, NPC·GM 몫은 GM).
    각자 쓸 것을 「발동」하고 「다음 ▶」(턴 종료 단계는 「턴 종료 처리 ▶」)를 누르면, 모두 눌렀을 때 진행하는 화면이 다음 단계로 넘긴다.
    상태: battle.endq = {key, step:'last'|'end'|'after', need:[tid]} · 끝냄 표시 = battle.cmds[tid].ed = key+':'+step (좌석도 쓸 수 있는 자리) */
 const END_STEP={last:'턴 가장 마지막',end:'턴 종료',after:'턴 종료 이후'};
 const endMine=(c,tid)=>c.role==='seat'?ownT(c,tid):(c.gm&&!seatOwned(c,tid)&&!fairOff(c,tid));
 const endDone=(b,tid)=>{const q=b.endq||{};return ((b.cmds||{})[tid]||{}).ed===q.key+':'+q.step};
 const EFIRED={};
 async function endFlow(){const c=ctx();if(!c.mgr)return;const q=c.b.endq;if(q&&q.step){const wait=(q.need||[]).filter(t=>!endDone(c.b,t)&&endCands(c.b,q.step).some(x=>x.m.tid===t)).map(t=>(c.b.trainers[t]||{}).name||'?');
   if(await askYes(`${END_STEP[q.step]} 확인 중이다${wait.length?' (기다리는 중: '+wait.join(' · ')+')':''}.\n기다리지 않고 바로 넘길까?`,'넘긴다','기다린다'))return endAdvance(true);return}
  await A().set(['battle','host'],c.gm?'gm':c.seat);raidExtra(c.b);await endStep('last')}
 async function endStep(step){for(;;){const b=ctx().b;const L=endCands(b,step);const need=[...new Set(L.map(x=>x.m.tid))];
   if(need.length){const key=String(Date.now());await A().set(['battle','endq'],{key,step,need});A().sysLog(`【${END_STEP[step]}】 포텐셜 확인 — ${need.map(t=>(b.trainers[t]||{}).name||'?').join(' · ')} (각자 쓸 것을 고르고 「다음」)`,'battle');return}
   if(step==='last'){step='end';continue}
   if(step==='end'){await turnEnd();step='after';continue}
   await A().set(['battle','endq'],null);return}}
 /* 진행하는 화면: 모두 「다음」을 눌렀으면 다음 단계로 */
 async function endAdvance(force){const c=ctx();const b=c.b;const q=b.endq;if(!q||!q.step||!c.mgr)return;const me=c.gm?'gm':c.seat;if(!force&&(b.host||'gm')!==me)return;   /* 넘기기(force)는 진행 화면이 아니어도 된다 — 진행하던 좌석이 나가도 막히지 않게 */
  /* 고를 것이 없어진 트레이너(그 포켓몬이 쓰러졌거나 물러남)는 끝낸 것으로 본다 */
  const L=endCands(b,q.step);if(!force&&!(q.need||[]).every(t=>endDone(b,t)||!L.some(x=>x.m.tid===t)))return;if(BUSY.end===q.key)return;BUSY.end=q.key;
  /* 10-27 망령: GM 창이 여럿이면(같은 계정 두 창 · GM 둘) 모두 host 'gm' 이라 턴 종료를 같이 돌려 한 턴이 건너뛰어졌다 (6턴).
     ① 접속 중 GM 창 중 리더 하나만 ② 그래도 겹칠 때를 위해 잠금을 쓰고 잠깐 뒤 내 것인지 다시 본다 */
  if(me==='gm'&&!force&&!isLeader(c)){BUSY.end='';return}
  const lk=q.key+'|'+myPid();await A().set(['battle','endLock'],lk);await new Promise(r=>setTimeout(r,450));if(String((ctx().b||{}).endLock||'')!==lk||!((ctx().b||{}).endq||{}).step){BUSY.end='';return}
  try{await A().set(['battle','endq'],null);if(q.step==='last')await endStep('end');else if(q.step==='end'){await turnEnd();await endStep('after')}}finally{BUSY.end=''}}
 function endPanel(c){const b=c.b;const q=b.endq;if(!q||!q.step)return '';const L=endCands(b,q.step);const btn=q.step==='end'?'턴 종료 처리':q.step==='last'?'턴 종료로':'다음 턴으로';
  const rows=(q.need||[]).map(tid=>{const t=(b.trainers||{})[tid]||{};const mine=endMine(c,tid);const dn=endDone(b,tid)||!L.some(x=>x.m.tid===tid);const my=mine?L.filter(x=>x.m.tid===tid):[];
   return `<div class="eqrow ${dn?'done':''} ${mine?'mine':''}"><div class="eqh"><b>${esc(t.name||'?')}</b>${dn?'<span class="tag ok">✓ 끝냄</span>':mine?'':'<span class="small dim">고르는 중…</span>'}<span class="sp"></span>${mine&&!dn?`<button class="btn sm pri" data-act="edone" data-tid="${tid}">${btn} ▶</button>`:''}</div>
    ${my.map(x=>{const i=L.indexOf(x);const fk=q.key+':'+q.step+':'+x.m.id+':'+x.name;return `<div class="firerow"><b class="fnm"><span class="tag ${x.kind==='uq'?'uqt':'ext'}">${x.tag}</span> 『${esc(x.name)}』</b><span class="small dim">${esc(x.kind==='uq'?x.t.name:x.m.name)} (${String(x.m.entry).toUpperCase()})</span><span class="sp"></span>${dn?'':`<button class="btn xs ${EFIRED[fk]?'ghost':'pri'}" data-act="efire" data-i="${i}" ${EFIRED[fk]?'disabled':''}>${EFIRED[fk]?'발동함':'발동'}</button>`}<div class="small" style="flex-basis:100%;white-space:pre-wrap;color:var(--fg2)">${esc(String(x.eff||'').replace(/<br\s*\/?>/g,'\n').slice(0,300))}</div></div>`}).join('')}</div>`}).join('');
  return `<div class="endq"><div class="ohead"><span class="olab">${END_STEP[q.step]}</span><span class="small dim">이 타이밍이 적힌 포텐셜 — 주인만 본다. 쓸 것만 「발동」, 다 골랐으면 「${btn}」. 모두 누르면 넘어간다</span><span class="sp"></span>${c.mgr?'<button class="btn xs ghost" data-act="eskip" title="안 누른 사람을 기다리지 않고 넘긴다">기다리지 않고 넘기기</button>':''}</div>${rows}</div>`}
 async function endAct(act,d){const c=ctx();const b=c.b;const q=b.endq;if(!q||!q.step)return;
  if(act==='eskip'){if(!c.mgr)return;if(!(await askYes('아직 안 누른 사람을 기다리지 않고 넘길까?','넘긴다','기다린다')))return;return endAdvance(true)}
  if(act==='edone'){const tid=d.tid;if(!endMine(c,tid))return;const ed=q.key+':'+q.step;if((b.cmds||{})[tid])await A().set(['battle','cmds',tid,'ed'],ed);else await A().set(['battle','cmds',tid],{ed});A().sysLog(`${(b.trainers[tid]||{}).name} — ${END_STEP[q.step]} 끝냄`,'battle');return endAdvance()}
  if(act==='efire'){const L=endCands(b,q.step);const x=L[+d.i];if(!x||!endMine(c,x.m.tid))return;const fk=q.key+':'+q.step+':'+x.m.id+':'+x.name;if(EFIRED[fk])return;EFIRED[fk]=1;
   if(x.kind==='uq'){A().sysLog(`【고유】 ${x.t.name} 『${x.name}』 (${END_STEP[q.step]})`,'battle',{mid:x.m.id,img:x.t.image||'',eff:String(x.eff||'').replace(/<br\s*\/?>/g,'\n').slice(0,400)});return A().renderScene()}
   const a=FX()&&FX().autoOf(x.m,'pot',x.name);if(a&&a.ops&&a.ops.length&&!a.manual){await fireAuto(x.m.id,'pot',x.name);return A().renderScene()}
   A().sysLog(`【${x.tag}】 ${x.m.name} 『${x.name}』 (${END_STEP[q.step]})`,'battle',{mid:x.m.id,img:x.m.image||'',eff:String(x.eff||'').replace(/<br\s*\/?>/g,'\n').slice(0,400)});return A().renderScene()}}
 /* 예고 공격(미래예지 계열, 맵툴 future_fire): 건 포켓몬의 그때 공격/특공 실수치(랭크 무시)로 계산. 명중 확정 · 급소 없음 · 벽 보정 · 상성 · 타입 일치. 소지품·특성 보정은 손으로 */
 function futureFire(b,m){const r=m.futRsv;delete m.futRsv;if(!r)return [];if(!m.entry||m.hp.cur<=0)return [`「${r.by}」의 『${r.mv}』 — ${m.name}이(가) 쓰러져 있어 불발`];
  const f=fieldOf(b);const objs=(f.objects||{})[m.side]||{};const cat=r.akey==='attack'?'physical':'special';const ws=mode(b)>=2?0.667:0.5;   /* 10-25: 더블 이상은 0.67배 (공격 창과 같게) */
  const wall=(cat==='physical'&&objs['리플렉터']>0)||(cat==='special'&&objs['빛의장막']>0)||objs['오로라베일']>0||(objs['얼음의장벽']>0&&r.typeEn!=='Fire')?ws:1;
  const dk=cat==='physical'?'defense':'specialdefense';const D=Math.max(1,B().statValue(m,dk).value);const L=Math.floor((+r.lv||50)*2/5)+2;
  const base=Math.floor(Math.floor(L*(+r.pw||0)*(+r.A||1)/50)/D)*wall+2;const amt=Math.floor(base*(85+Math.floor(Math.random()*16))/100);
  const eff=r.typeEn?B().effectiveness([r.typeEn],m,{atkTypes:r.atkTypes||[]}):{value:1,stab:false};const hd=B().hpDamage(m,amt,eff.value,{stab:eff.stab});
  m.hp.cur=Math.max(0,m.hp.cur-hd.final);const out=[`◆ 예고 공격 발동 — 「${r.by}」의 『${r.mv}』가 ${m.name}을(를) 덮쳤다! ${hd.final} 대미지 (기본 ${Math.floor(base*0.85)}~${Math.floor(base)}${eff.value!==1?' · 상성 ×'+eff.value:''}${eff.stab?' · 타입 일치':''}${wall<1?' · 벽 보정':''}) → HP ${m.hp.cur}/${m.hp.max}`];
  if(m.hp.cur<=0){m.entry='';out.push(`${m.name}은(는) 쓰러졌다!`)}return out}
 /* 기술을 내보낼 때 줄어드는 상태: DB 의 prog:'move' + 얼음(설명이 「3번째로 기술을 내보낼 때 해제」라 턴이 아니라 기술 횟수로 센다) */
 const movesDown=(k,d)=>(d&&d.prog==='move')||k==='Freeze';
 async function turnEnd(){const c=ctx();if(!c.mgr)return;const b0=snap(c.b),b=snap(b0);const f=fieldOf(b);const db=(DB().states||{}).st||{};const lines=[];const futs=[];
  /* 10-21 망령: 로그를 갈래별로 (포켓몬 · 풀린 것 · 필드) */ const fieldL=[];const rel={};const relAdd=(m,t)=>{(rel[m.name]=rel[m.name]||[]).push(t)};
  if(F()){const slots={};for(const s of SIDES){const e=entered(b,s);for(const a in e)slots[s+'_'+a]=e[a]}
   const r1=F().turnEndStates(b.mons,slots);lines.push(...r1.lines);const r2=F().turnEndField(b.mons,f);fieldL.push(...r2.lines);
   for(const mid in b.mons){const m=b.mons[mid];if(m.entry&&m.hp.cur<=0){m.entry='';if(!r1.dead.includes(mid))lines.push(`${m.name}은(는) 쓰러졌다!`)}}}
  else for(const mid in b.mons){const m=b.mons[mid];if(!m.entry||m.hp.cur<=0)continue;
   for(const t of B().turnEnd(m)){if(!t.delta)continue;m.hp.cur=Math.max(0,Math.min(m.hp.max,m.hp.cur+t.delta));lines.push(`${m.name} ${db[t.state]?db[t.state].ko:t.state} ${t.delta>0?'+':''}${t.delta} → ${m.hp.cur}`);if(m.hp.cur<=0){lines.push(`${m.name} 빈사!`);m.entry=''}}}
  for(const mid in b.mons){const m=b.mons[mid];if(!m.entry||m.hp.cur<=0)continue;
   const st=m.states||{};/* 10-26 망령: 「반동 : 행동불능」으로 쉬는 턴에도 「난동부리기」는 줄어든다 */if(+st.Recharge===1&&st.Thrash){const tv=+st.Thrash;if(tv<=1){delete st.Thrash;relAdd(m,'「난동부리기」')}else if(tv<1000)st.Thrash=tv-1}
   for(const k in st){const v=+st[k];const def=db[k]||{};if((def.prog==='turn'||def.prog==='once')&&!movesDown(k,def)&&v>0&&v<1000){   /* 10-23 망령: 「다음 기술 한 번」 상태(악인 · 송전 · 자세잡기 …)도 행동 안 했으면 턴 종료에 준다 */st[k]=v-1;if(st[k]<=0){delete st[k];if(m.futRsv&&m.futRsv.st===k)futs.push(m);else relAdd(m,`「${def.ko||k}」`)}}}
   /* 임시 랭크 해제 */
   if(m.tempRank){for(const k in m.tempRank){{const lim=k==='critical'?4:6;m.rank[k]=Math.max(-lim,Math.min(lim,(+m.rank[k]||0)-(+m.tempRank[k]||0)))}}delete m.tempRank;relAdd(m,'임시 랭크')}
   if(m.tempMod){for(const k in m.tempMod){m.mod[k]=Math.round(((+m.mod[k]||1)/(+m.tempMod[k]||1))*1000)/1000;if(Math.abs(m.mod[k]-1)<0.002)delete m.mod[k]}delete m.tempMod}
   if(m.fx&&m.fx.mults&&m.fx.mults.some(e=>e.temp))m.fx.mults=m.fx.mults.filter(e=>!e.temp);
   if(m.flags)delete m.flags;
   m.started=false}
  for(const m of futs)lines.push(...futureFire(b,m));
  if(FX())lines.push(...FX().turnEnd(b));
  const raidL=[];for(const mid in b.mons){const m=b.mons[mid];const R=m.raid;if(!R||!(+R.segments>0))continue;if(m.hp.cur>0&&(R.brk||R.cond==='every'))raidL.push(...raidPhase(b,m,'턴 종료 이후'));delete R.brk}
  for(const mid in b.mons){delete b.mons[mid].flags}
  const dec=(o,k)=>{if(o[k]>0&&o[k]<1000){o[k]--;if(o[k]<=0){delete o[k];return true}}return false};
  if(f.weather.type&&f.weather.count>0){f.weather.count--;if(f.weather.count<=0){fieldL.push(`날씨 「${f.weather.type}」 끝`);f.weather={type:'',count:0}}}
  if(f.terrain.type&&f.terrain.count>0){f.terrain.count--;if(f.terrain.count<=0){fieldL.push(`「${f.terrain.type}」 끝`);f.terrain={type:'',count:0}}}
  if(window.OM_STAGE_UI)fieldL.push(...window.OM_STAGE_UI.turnEnd(b,f));
  for(const k of ROOMS)if(dec(f.rooms,k))fieldL.push(`「${k}」 끝`);for(const k of ETC)if(dec(f.etc,k))fieldL.push(`「${k}」 끝`);
  for(const s of SIDES){f.objects[s]=f.objects[s]||{};for(const k in f.objects[s])if(!/^haz/.test(objCat(k)[0])/* 10-24 제보: 설치기(압정뿌리기 · 독압정의 「겹」 수)는 턴으로 줄지 않는다 */&&dec(f.objects[s],k))fieldL.push(`${SIDE_KO[s]} 「${k}」 끝`)}
  b.field=f;b.cmds={};b.order=[];b.phase=0;b.turn=(+b.turn||0)+1;delete b.deadline;CMD={};
  await saveBattle(b0,b,undefined,undefined,[[['ready'],{}]]);   /* 11-03: ready 비우기도 같은 묶음에 */
  cutPhase('턴 종료',`다음 턴 ${b.turn} · 지시 준비`);const sec=(h,L)=>L.length?[`▸ ${h}`,...L.map(x=>'  '+String(x).replace(/\n/g,'\n  '))]:[];const relL=Object.keys(rel).map(n=>`${n} — ${rel[n].join(' · ')}`);
  const body=[...sec('포켓몬',lines),...sec('풀린 것',relL),...sec('필드',fieldL),...sec('레이드',raidL)];
  /* 11-03 감우 (검토 7): HP 가 바뀐 포켓몬을 순서대로 카드에 실어 보낸다 — 받는 화면마다 0.4s 간격으로 연출 (logFx · seqFx) */
  const seq=[];for(const mid in b.mons){const m=b.mons[mid],o=(b0.mons||{})[mid];if(!o||!o.hp||!m.hp||+o.hp.cur===+m.hp.cur)continue;seq.push({mid,name:m.name,prev:+o.hp.cur,cur:+m.hp.cur,max:+m.hp.max||1})}
  A().sysLog(`【턴 ${b.turn-1} 종료】${body.length?'\n'+body.join('\n'):'\n  처리할 것 없음'}\n— 턴 ${b.turn} 지시 준비`,'battle',seq.length?{seq}:undefined)}

 /* ---------- 묘수 = 「타임」 (맵툴 command_expert): 지시 준비 페이즈에, 상대 트레이너가 준비를 마치면 상대 포켓몬 하나의 지시 꼴(교대/기술)을 본다.
     횟수는 배틀마다 지시 랭크로(A 1회 · AA 이상 2회) + 포켓몬의 timeAlly/timeEnemy 보정. 한 턴에 한 대상만(다시 보기는 자유). 양쪽이 같은 턴에 쓰면 둘 다 그 턴은 더 못 쓴다. 쓰고 나면 READY 여도 지시를 고칠 수 있다 ---------- */
 function timeOf(t,turn){const x=(t&&t.time)||{};const same=(+x.turn||0)===turn;return {used:+x.used||0,forced:+x.forced||0,sw:same?(+x.sw||0):0,target:same?(x.target||''):''}}
 function timeLimit(c,tid){const b=c.b;const t=(b.trainers||{})[tid];if(!t)return 0;let mod=0;for(const m of Object.values(b.mons||{})){if(!m.entry)continue;if(sameT(m,tid,b))mod+=+(m.timeAlly||0);else mod+=+(m.timeEnemy||0)}return Math.max(0,timeCount(t)+mod)}
 function enemyTids(c,tid){const b=c.b;const t=(b.trainers||{})[tid]||{};return Object.keys(b.trainers||{}).filter(k=>k!==tid&&(b.trainers[k]||{}).side&&!sameT(k,tid,b))}
 function timeBlocked(c,tid){const b=c.b;const turn=+b.turn||0;const my=timeOf(b.trainers[tid],turn);if(my.sw===2)return true;return my.sw>=1&&enemyTids(c,tid).some(e=>timeOf(b.trainers[e],turn).sw>=1)}
 function myosuGlow(c,tid){const b=c.b;if((+b.phase||0)!==0)return false;const t=b.trainers[tid];if(!t)return false;const my=timeOf(t,+b.turn||0);if(timeBlocked(c,tid))return false;if(my.sw===0&&my.used>=timeLimit(c,tid))return false;const rd=c.ST.state.ready||{};return enemyTids(c,tid).some(e=>rd[e])}
 const SHAPE_KO={switch:'교대하려고 한다…',move:'기술을 내보내려고 한다…',none:'움직일 기색이 없다…'};
 function openMyosu(tid,pick){const c=ctx();const b=c.b;const t=(b.trainers||{})[tid];if(!t)return;if(!(c.mgr||ownT(c,tid)))return;
  const turn=+b.turn||0;const phase=+b.phase||0;const my=timeOf(t,turn);const lim=timeLimit(c,tid);const rd=c.ST.state.ready||{};const blocked=timeBlocked(c,tid);
  const enemies=Object.values(b.mons||{}).filter(m=>m.entry&&m.hp.cur>0&&!sameT(m,tid,b)).sort((x,y)=>String(x.entry).localeCompare(String(y.entry)));
  const left=Math.max(0,lim-my.used);
  const why=m=>{if(phase!==0)return '지시 준비 페이즈에만';if(blocked)return '이번 턴은 더 못 쓴다';if(!rd[m.tid])return '상대가 아직 준비 전';if(my.sw===1&&my.target&&my.target!==m.id)return '이번 턴은 「'+(monName(b,my.target)||'?')+'」만';if(my.sw===0&&my.used>=lim)return lim?'횟수를 다 썼다':'지시 '+(t.ranks['지시']||'-')+' 는 「타임」 0회';return ''};
  const md=A().openModal(`<div class="mhead"><h2>묘수 · 「타임」 <span class="small dim">${esc(t.name)}</span></h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="row small" style="gap:10px;flex-wrap:wrap"><span>지시 <b>${esc(t.ranks['지시']||'-')}</b></span><span>이 배틀 남은 횟수 <b style="color:var(--yel2)">${left}</b> / ${lim}${my.forced?` <span class="dim">(강제 ${my.forced})</span>`:''}</span><span class="dim">이번 턴 ${my.sw===0?'아직 안 씀':my.sw===1?'사용 — 「'+esc(monName(b,my.target)||'?')+'」':'사용 불가'}</span></div>
   ${blocked?'<div class="card" style="border-color:var(--red);margin-top:8px">양 트레이너가 서로의 수를 읽고 있다는 것을 눈치챘다 — 이번 턴은 「타임」을 더 쓸 수 없다.</div>':''}
   <div class="sec" style="margin-top:10px">상대 포켓몬 <span class="note">상대 트레이너가 「준비 완료」를 누른 뒤에만 볼 수 있다 · 보이는 건 교대인지 기술인지뿐</span></div>
   <div class="pg">${enemies.map(m=>{const w=why(m);const seen=my.sw>=1&&my.target===m.id;return `<div class="pc ${w?'dis':''} ${seen?'on':''}" data-tm="${m.id}" title="${esc(w||'엿본다')}"><div class="pic" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}"></div><div><b>${secret(c,m)?'비공개':esc(m.name)}</b><div class="small dim">${SIDE_KO[m.side]} ${String(m.entry).toUpperCase()} · ${esc((b.trainers[m.tid]||{}).name||'')} ${rd[m.tid]?'<span class="tag ok">READY</span>':'<span class="dim">준비 전</span>'}</div>${w?`<div class="small" style="color:var(--red)">${esc(w)}</div>`:seen?'<div class="small" style="color:var(--yel2)">다시 보기</div>':''}</div></div>`}).join('')||'<div class="dim small">상대 포켓몬이 없다</div>'}</div>
   <div class="row small" style="margin-top:10px"><label title="횟수가 다 떨어졌어도 GM 재량으로 쓴다 (강제 사용 횟수로 따로 센다)"><input type="checkbox" id="tmForce" ${c.gm?'':'disabled'}> 강제 사용 (GM)</label><span class="sp"></span>${c.gm?`<button class="btn xs ghost" id="tmReset" title="이 트레이너의 「타임」 횟수를 초기화">횟수 초기화</button>`:''}</div>
   <div id="tmRes"></div>`);
  if(pick){const el=md.querySelector(`[data-tm="${pick}"]`);if(el)el.scrollIntoView()}
  const resetT=$('#tmReset',md);if(resetT)resetT.onclick=async()=>{if(!confirm('「타임」 횟수를 초기화할까?'))return;await A().set(['battle','trainers',tid,'time'],null);A().closeModal();A().sysLog(`${t.name} 「타임」 횟수 초기화`,'battle')};
  md.querySelectorAll('[data-tm]').forEach(el=>el.onclick=async()=>{const m=ctx().b.mons[el.dataset.tm];if(!m)return;const force=!!($('#tmForce',md)&&$('#tmForce',md).checked);const w=why(m);
   if(w&&!(force&&/횟수|0회/.test(w)))return A().toast(w);
   const again=my.sw>=1&&my.target===m.id;
   if(!again&&my.sw===0&&my.used>=lim&&!force)return A().toast(`머리가 아파 더 이상 「타임」을 쓸 수 없다 (최대 ${lim}번)`);
   const shape=((ctx().ST.state.pub||{})[m.tid]||{}).shape;const sh=shape&&(+shape.turn||0)===turn?shape.mons[m.id]:null;
   if(!sh&&!c.mgr)return A().toast('상대의 지시가 아직 저장되지 않았다');
   if(!again){const nt={used:my.used+(force&&my.used>=lim?0:1),forced:my.forced+(force&&my.used>=lim?1:0),turn,sw:1,target:m.id};
    const enemyUsed=enemyTids(c,tid).some(e=>timeOf(ctx().b.trainers[e],turn).sw>=1);if(enemyUsed)nt.sw=2;
    const ok=await A().set(['battle','trainers',tid,'time'],nt);if(!ok)return;
    A().sysLog(`【묘수】 ${t.name} 「타임」 → ${secret(c,m)?'상대 포켓몬':m.name}\n이 배틀 ${nt.used}/${lim}${nt.forced?' · 강제 '+nt.forced:''}`,'battle',{mid:m.id,img:''});
    if(enemyUsed)A().sysLog('양 트레이너는 서로가 서로의 수를 읽고 있다는 것을 눈치챘다!','battle');
    my.sw=nt.sw;my.target=m.id;my.used=nt.used}
   const txt=sh?`「${m.name}」${sh==='none'?'은(는) ':'은(는) '}${SHAPE_KO[sh]}`:'(GM) 저장된 지시 꼴이 없다';
   $('#tmRes',md).innerHTML=`<div class="card hit" style="margin-top:10px"><div class="row" style="gap:10px"><div class="ti" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}"></div><div style="flex:1"><div class="small dim">타임 결과 · 턴 ${turn}</div><b style="font-size:16px">${esc(txt)}</b></div></div></div>`;
   md.querySelectorAll('[data-tm]').forEach(x=>x.classList.toggle('on',x.dataset.tm===m.id))})}

 /* ---------- 타임 (GM 직접 보기 · 옛 요청 흐름) ---------- */
 function timeCount(t){const lt=((DB().const||{}).lists||{}).list_time_count||{E:0,D:0,C:0,B:0,A:1,AA:2,AAA:2,S:2};const r=S().strip((t.ranks||{})['지시']);return +(lt[r]||0)}
 async function requestTime(mid){const c=ctx();const b=c.b;const m=b.mons[mid];if(!m)return;const my=c.mgr?null:c.seat;const t=b.trainers[my];
  if(!c.mgr){if(!t)return;const used=+(t.timeUsed||0);if(used>=timeCount(t))return A().toast('타임 횟수가 없다');if(!(await askYes(`${m.name} 의 지시를 엿볼까? (타임 ${used+1}/${timeCount(t)})`,'엿본다')))return;
   await A().set(['pub',my,'time'],{mid,at:Date.now()});A().sysLog(`${t.name} 「타임」 요청 → ${m.name}`,'chat');return}
  /* GM 은 바로 본다 */
  const rows=await DBS().secretGet(c.ST.room,c.ST.secret,'cmd');const r=(rows||[]).filter(x=>cmdFresh(x)).find(x=>x.id===m.tid);const x=r&&r.data&&r.data.mons&&r.data.mons[mid];
  A().openModal(`<div class="mhead"><h2>타임 — ${esc(m.name)}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="pre">${esc(x?describeCmd(b,m,x):'아직 저장된 지시가 없다')}</div>`)}
 function describeCmd(b,m,x){if(!x)return '(없음)';if(x.move==='switch')return `교대 → ${monName(b,x.switch)}`;if(x.move===''||x.move==null)return '(행동 없음)';const mv=MVS(m)[+x.move];return `${mv?mv.name:'?'}${x.targets&&x.targets.length?' → '+tgNow(b,x,m).map(sl=>slotName(b,sl).replace(/<[^>]+>/g,'')).join(', '):''}`}
 async function grantTime(seat){const c=ctx();if(!c.mgr)return;const b=c.b;const req=((c.ST.state.pub||{})[seat]||{}).time;if(!req)return;const m=b.mons[req.mid];const t=b.trainers[seat];
  const rows=await DBS().secretGet(c.ST.room,c.ST.secret,'cmd');const r=(rows||[]).filter(x=>cmdFresh(x)).find(x=>x.id===(m||{}).tid);const x=r&&r.data&&r.data.mons&&r.data.mons[req.mid];
  await DBS().secretPut(c.ST.room,c.ST.secret,'peek',seat,{mid:req.mid,name:m?m.name:'?',text:m?describeCmd(b,m,x):'?',turn:b.turn||0,at:Date.now()});
  await A().set(['pub',seat,'time'],null);if(t){await A().set(['battle','trainers',seat,'timeUsed'],(+t.timeUsed||0)+1)}
  A().sysLog(`GM: ${t?t.name:seat} 의 「타임」 허가 (${m?m.name:'?'})`,'battle')}
 async function loadPeek(){const c=ctx();if(c.mgr||!c.seat)return null;try{const rows=await DBS().secretGet(c.ST.room,c.ST.secret,'peek');const r=(rows||[]).find(x=>x.id===c.seat);return r?r.data:null}catch(e){return null}}

 /* ---------- 랭크·상태 편집 ---------- */
 /* ---------- 포텐셜 목록 창: 출력(채팅에 알림) · 발동(자동화) · 횟수 · 효과 해제 ---------- */
 /* ---------- ⚙ 자동화 확인 (10-24 망령: 처음 하는 사람이 자동화 도우미를 어려워한다)
    내 트레이너(GM 은 고른 트레이너)와 지금 필드 위의 그 포켓몬에서, 구문이 있어 자동으로 처리되는 것을 한눈에: 언제 · 무엇을 · 어떻게 (자동 / 발동 버튼 / 공격·HP 창) ----- */
 const AK={tid:''};
 function autoRows(m,t){const out=[],man=[];const tm=a=>FX()?FX().timing(a.text||''):{};
  const how=(a,kind)=>{const T=tm(a);if(kind==='지령 · 명령')return ['지시에서 고르면 걸린다','press'];if(T.entry)return ['등장하면 자동','auto'];if(T.passive)return ['늘 켜짐','auto'];if(/【턴 종료】/.test(a.text||''))return ['턴 종료 때 · 「발동」','press'];if(T.pre)return ['선행 · 「발동」','press'];return ['「발동」 버튼','press']};
  /* 11-03 22:05 망령 「자동화 확인에서 여전히 하이 어태커 · 에이스가 안 된 걸로」: 기본 레디메이드엔 구문이 있는데 방 DB(dbx.rm) · 제작기 DB 수정 행이 비거나 「손으로」로 덮은 경우 — 그 사실과 「기본으로」 단추 */
  const ovOf=(kind,name)=>{const key=kind==='특성'?'특성 : '+name:kind==='소지품'?'소지품 : '+name:String(name||'').replace(/『|』/g,'').trim();const base=((window.OM_DB||{}).readymade||{})[key];if(!base||!base.ops||!base.ops.length||base.manual)return null;const room=(((ctx().ST||{}).state||{}).dbx||{}).rm||{};return {key,src:room[key]?(room[key].src==='room'?'이 방 DB':'제작기 DB 수정(방에 옮겨짐)'):'제작기 DB 수정'}};
  const add=(kind,name,a,eff)=>{if(a&&a.ops&&a.ops.length&&!a.manual){const [w,c]=how(a,kind);out.push({kind,name,when:w+(tm(a).uses?` (${tm(a).uses}회)`:''),cls:c,what:FX().describe(a.ops)})}else man.push({kind,name,eff,ov:kind==='지령 · 명령'?null:(a&&a.src==='own'?null:ovOf(kind,name))})};
  if(m){for(const p of potSrc(m))add(p.unique?'고유':isExcl(m,p)?'전용':'포텐셜',p.name,FX()&&FX().autoOf(m,'pot',p.name),p.eff);
   if(m.ability)add('특성',m.ability,FX()&&FX().autoOf(m,'trait',m.ability),m.abilityEff);
   if(m.item&&m.item!=='-'){const I=window.OM_ITEMS,IR=window.OM_ITEMRULE;const r=I&&I.of(m);const passive=r&&IR&&IR.has(r);if(passive)out.push({kind:'소지품',name:m.item,when:'공격 · HP 창 · 턴 종료에서 자동',cls:'auto',what:IR.toText(r).split('\n').filter(x=>x!=='소모품'&&!/^전용 /.test(x)).join(' · ')+(r.once?' (한 번 쓰면 없어짐)':'')});
    const a=FX()&&FX().autoOf(m,'item',m.item);if(a&&a.ops&&a.ops.length&&!a.manual){if(!passive)add('소지품',m.item,a)}else if(!passive)man.push({kind:'소지품',name:m.item,eff:m.itemEff})}
   for(const mv of m.moves||[]){if(!mv||!mv.name)continue;const a=moveAuto(mv);if(a&&MA().auto(a))out.push({kind:'기술',name:mv.name,when:'공격 창 「적용」 때 자동',cls:'auto',what:MA().describe(a)+(a.notes&&a.notes.length?' · 손으로: '+a.notes.join(' · '):'')});else if(a&&a.notes&&a.notes.length)man.push({kind:'기술',name:mv.name,eff:a.notes.join(' · ')})}}
  else if(t){for(const u of (t.unique||[]).filter(u=>u&&u.name))add('고유',u.name,FX()&&FX().autoOf({tid:t.id},'pot',u.name),u.eff);
   if(OO())for(const n of [...OO().orderNames(t),...OO().commandNames(t)].filter(Boolean)){const a=FX()&&FX().rm(n);if(a&&a.ops&&a.ops.length&&!a.manual)add('지령 · 명령',n,a)}}
  return {out,man}}
 function openAutoCheck(tid){const c=ctx(),b=c.b;const trs=Object.values(b.trainers||{}).filter(t=>c.mgr||t.id===c.seat);if(!trs.length)return A().toast('배틀에 올린 내 트레이너가 없다');
  if(tid)AK.tid=tid;if(!trs.some(t=>t.id===AK.tid))AK.tid=trs[0].id;const t=b.trainers[AK.tid];
  const mons=Object.values(b.mons||{}).filter(m=>m.tid===t.id&&m.entry&&m.hp&&m.hp.cur>0);
  const block=(title,img,{out,man})=>`<div class="akblk"><div class="akh">${img?`<img src="${esc(img)}" alt="">`:''}<b>${esc(title)}</b><span class="dim small">자동 ${out.length}${man.length?' · 손으로 '+man.length:''}</span></div>
   ${out.length?`<div class="akl">${out.map(x=>`<div class="akr ${x.cls}"><span class="akk">${esc(x.kind)}</span><b>${esc(x.name)}</b><span class="akw">${esc(x.when)}</span><div class="akd">${esc(x.what)}</div></div>`).join('')}</div>`:'<div class="dim small">자동으로 처리되는 것이 없다</div>'}
   ${man.length?`<details class="akman"><summary class="small">자동화 안 됨 — 손으로 (📢 발동 · HP · 상태 창) ${man.length}</summary>${man.map(x=>`<div class="small"><span class="akk">${esc(x.kind)}</span>${esc(x.name)}${x.ov?` <b class="akov">기본 구문은 있다 — ${esc(x.ov.src)}이 덮음</b>${c.gm?` <button class="btn xs" data-akfix="${esc(x.ov.key)}">기본으로</button>`:''}`:''}${x.eff?` <span class="dim">— ${esc(String(x.eff).replace(/<br\s*\/?>/g,' ').slice(0,90))}</span>`:''}</div>`).join('')}</details>`:''}</div>`;
  const md=A().openModal(`<div class="mhead"><h2>⚙ 자동화 확인</h2><span class="sp"></span>${trs.length>1?`<select id="akt">${trs.map(x=>`<option value="${esc(x.id)}" ${x.id===t.id?'selected':''}>${esc(x.name||x.id)}</option>`).join('')}</select>`:''}<button class="btn ghost" data-x>닫기</button></div>
   <div class="mbody akbody"><p class="small dim" style="margin:0 0 8px">구문이 있어 오레마스가 알아서 처리하는 것들. <b class="akauto">자동</b> 은 건드리지 않아도 되고, <b class="akbtn">「발동」</b> 은 포텐셜 칸의 발동 버튼을 누르면 효과가 걸린다. 자동화가 없는 것은 「📢 발동」으로 로그에 띄우고 HP · 상태 창에서 손으로.</p>
   ${block(`트레이너 ${t.name||t.id}`,t.image||'',autoRows(null,t))}
   ${mons.length?mons.map(m=>block(`${m.name}${m.entry?' · '+m.entry:''}`,m.image||'',autoRows(m,t))).join(''):'<div class="dim small" style="margin-top:8px">필드에 나와 있는 포켓몬이 없다 — 내보내면 여기 나온다</div>'}</div>`,{wide:true});
  const sel=md&&md.querySelector('#akt');if(sel)sel.onchange=()=>{A().closeModal();openAutoCheck(sel.value)};
  if(md)md.querySelectorAll('[data-akfix]').forEach(bt=>bt.onclick=async()=>{const k=bt.dataset.akfix;const base=((window.OM_DB||{}).readymade||{})[k];if(!base)return;await A().set(['dbx','rm',k],Object.assign(JSON.parse(JSON.stringify(base)),{src:'room'}));await A().set(['dbx','at'],Date.now());A().sysLog(`레디메이드 「${k}」 — 이 방에서 기본 구문으로 되돌렸다`,'battle');A().closeModal();openAutoCheck(AK.tid)});
  if(md)md.querySelectorAll('[data-x]').forEach(x=>x.onclick=()=>A().closeModal())}
 /* only: 로그 카드의 「효과」로 열 때 그 줄에 나온 이름들. 내 포켓몬이 아니면 공개된 것만 — 그 줄에 나온 것 · 도감 전체 해석이면 포텐셜(전용 빼고) · 특성 해석이면 특성 (10-24 망령) */
 function openPots(mid,only){const c=ctx();const b=c.b;const m=b.mons[mid];if(!m)return;const full=canEdit(c,m);const u=m.potUses||{};const L=potList(m);const ON=new Set((only||[]).map(x=>String(x).replace(/『|』/g,'')));
  const seeAll=full||dexSees(c,m,'all'),seeTr=full||dexSees(c,m,'trait');const vis=([k,n,kind])=>full||ON.has(n)||(k==='pot'&&kind!=='전용'&&seeAll)||(k==='trait'&&seeTr);
  const rows0=[...(m.excl?[['pot',m.excl.name,'전용',m.excl.eff||'']]:[]),...(m.exclX||[]).map(p=>['pot',p.name,'전용',p.eff||'']),...(m.pots||[]).filter(p=>p&&p.name&&!p.ph).map(p=>['pot',p.name,p.kind||'',p.eff||'']),...(m.ability?[['trait',m.ability,'특성',m.abilityEff||'']]:[]),...(m.item?[['item',m.item,'소지품',m.itemEff||'']]:[]),...(m.items2||[]).filter(x=>x&&x.item).map(x=>['item',x.item,'소지품',x.itemEff||''])];const rows=rows0.filter(vis);const hid=rows0.length-rows.length;
  const chips=FX()?FX().chips(m):[];const SH=window.OM_SHEET_UI||{};const pf=SH.potFmt||(t=>esc(t));const pk=SH.potKind||(k=>({no:'',lab:k}));const HUE=SH.POT_HUE||{};
  /* 10-21 망령: 시트처럼 카드로 — 분류 꼬리표 · 이름 · 남은 횟수 · 효과 (「」【】 강조, ① ② 줄 나눔) · 아래에 버튼 줄. 폰에서도 효과 글이 한 줄을 다 쓴다 */
  const card=([k,n,kind,eff])=>{const a=FX()&&FX().autoOf(m,k,n);const auto=a&&a.ops&&a.ops.length&&!a.manual;const cnt=L.find(x=>x.name===n);const left=cnt?(u[n]==null?cnt.max:+u[n]):null;const tm=a?FX().timing(a.text||eff):{};
   const kk=k==='trait'?{no:'',lab:'특성'}:k==='item'?{no:'',lab:'소지품'}:pk(kind);const hue=k==='trait'?'#5fd38d':k==='item'?'#ff9a3c':kind==='전용'?'#ffd84a':(HUE[kk.lab]||'#3fc7c0');
   return `<div class="potc bpc${kind==='전용'?' ex':''}${cnt&&left<=0?' spent':''}" style="--ph:${hue}"><div class="poth"><span class="potk">${kk.no?`<em>${esc(kk.no)}</em>`:''}${kk.lab?`<span>${esc(kk.lab)}</span>`:''}</span><b class="potn">${esc(n)}</b>${cnt?`<span class="bpcn">${pips(left,cnt.max)}</span>`:''}${auto?`<span class="bpau">자동${tm.entry?' · 등장':tm.passive?' · 상시':''}</span>`:''}</div>
    ${String(eff||'').trim()?`<div class="pote">${pf(String(eff).replace(/<br\s*\/?>/gi,'\n'))}</div>`:''}
    ${full?`<div class="bpct"><button class="btn xs" data-pa="announce" data-kind="${k}" data-pot="${esc(n)}" title="효과 글을 채팅에 띄운다">📢 출력</button>${k==='pot'&&potRest(m,n)?restChip(potRest(m,n)):`${auto?`<button class="btn xs pri" data-pa="fire" data-kind="${k}" data-pot="${esc(n)}">발동</button>`:''}${cnt?`<button class="btn xs" data-pa="use" data-pot="${esc(n)}" ${left>0?'':'disabled'}>사용 −1</button>`:''}`}${cnt?`<button class="btn xs ghost" data-pa="restore" data-pot="${esc(n)}" ${left<cnt.max?'':'disabled'}>+1</button>`:''}${k==='item'?`<button class="btn xs" data-pa="consume" title="다 쓴 소지품을 칸에서 뺀다 (결과 정리 때 시트에도)">소모</button>`:''}<span class="sp"></span>${window.OM_FX_UI?`<button class="btn xs ghost" data-pa="edit" data-kind="${k}" data-pot="${esc(n)}" data-text="${esc(eff)}">구문</button>`:''}</div>`:''}</div>`};
  const usedRow=(full||seeAll||ON.has((m.itemUsed||{}).name))&&!m.item&&m.itemUsed&&m.itemUsed.name?`<div class="potc bpc spent" style="--ph:#ff9a3c"><div class="poth"><span class="potk"><span>소지품</span></span><b class="potn" style="text-decoration:line-through">${esc(m.itemUsed.name)}</b><span class="bpau">소모함</span><span class="sp"></span>${full?'<button class="btn xs ghost" data-pa="unconsume">되돌리기</button>':''}</div><div class="pote small dim">이번 배틀에서 썼다</div></div>`:'';
  const md=A().openModal(`<div class="mhead"><h2>${esc(m.name)} <span class="small dim">포텐셜 · 특성 · 소지품</span></h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="potl bpl">${rows.map(card).join('')||(usedRow?'':`<div class="small dim">${hid?'공개된 것 없음':'없음'}</div>`)}${usedRow}</div>${hid?`<div class="small dim" style="margin-top:4px">🔒 아직 공개되지 않은 것 ${hid}개 — 도감으로 해석하거나 출력되면 보인다</div>`:''}
   <div class="sec">발동 중인 효과 <span class="note">${chips.length}</span></div><div class="row" style="flex-wrap:wrap;gap:4px">${chips.map(ch=>`<span class="rk fxc ${full?'rm':''}" title="${esc(ch.title)}" ${full?`data-pa="off" data-fx="${esc(ch.id)}" data-nm="${esc(ch.name)}"`:''}>${esc(ch.t)}${full?' ✕':''}</span>`).join('')||'<span class="small dim">없음</span>'}${full&&chips.length?`<span class="sp"></span><button class="btn xs ghost danger" data-pa="offall">모두 해제</button>`:''}</div>
   ${full&&(m.tempRank&&Object.keys(m.tempRank).length||m.tempMod&&Object.keys(m.tempMod).length)?`<div class="row small" style="margin-top:6px"><span class="dim">임시 랭크·배율(턴 종료까지)이 걸려 있다</span><span class="sp"></span><button class="btn xs ghost" data-pa="temp">임시 랭크 해제</button></div>`:''}`);
  md.querySelectorAll('[data-pa]').forEach(bt=>bt.onclick=async()=>{const k=bt.dataset.pa;const d={mid,pot:bt.dataset.pot,kind:bt.dataset.kind};
   if(k==='announce'){A().closeModal();return action(Object.assign(d,{act:'announce'}))}
   if(k==='fire'){A().closeModal();if(d.kind==='pot')await potMark(mid,d.pot);if(d.kind==='pot'&&wantCut(m,d.pot))cutFire('m:'+m.id,m.image,m.name,`『${d.pot}』`,m.side==='left'?'#1f6fd1':'#e3101f');return fireAuto(mid,d.kind,d.pot)}
   if(k==='use'||k==='restore'){A().closeModal();return action({act:k==='use'?'usepot':'restorepot',mid,pot:d.pot})}
   if(k==='consume'){A().closeModal();return itemConsume(mid)}
   if(k==='unconsume'){A().closeModal();return itemConsume(mid,true)}
   if(k==='edit'){A().closeModal();return window.OM_FX_UI.openEditor({mon:ctx().b.mons[mid],kind:d.kind,name:d.pot,text:bt.dataset.text,save:async auto=>{const cur=Object.assign({},(ctx().b.mons[mid]||{}).auto||{});if(auto)cur[d.pot]=auto;else delete cur[d.pot];await A().set(['battle','mons',mid,'auto'],cur);const rm=(A().ST.state.roster||{}).mons||{};if(rm[mid])await A().set(['roster','mons',mid,'auto'],cur);A().toast(auto?'구문을 저장했다':'구문을 지웠다')}})}
   if(k==='off'){A().closeModal();return action({act:'fxoff',mid,fx:bt.dataset.fx,nm:bt.dataset.nm})}
   if(k==='offall'){if(!(await askYes('발동 중인 효과를 모두 해제할까?','모두 해제'))){openPots(mid,only);return}const m0=snap(ctx().b.mons[mid]),x=snap(m0);FX().removeAll(x);A().closeModal();await saveMon(m0,mid,x);return A().sysLog(`${m.name} 효과 모두 해제`,'battle')}
   if(k==='temp'){const m0=snap(ctx().b.mons[mid]),x=snap(m0);if(x.tempRank){for(const kk in x.tempRank)x.rank[kk]=(+x.rank[kk]||0)-(+x.tempRank[kk]||0);delete x.tempRank}if(x.tempMod){for(const kk in x.tempMod){x.mod[kk]=Math.round(((+x.mod[kk]||1)/(+x.tempMod[kk]||1))*1000)/1000;if(x.mod[kk]===1)delete x.mod[kk]}delete x.tempMod}if(x.fx&&x.fx.mults)x.fx.mults=x.fx.mults.filter(e=>!e.temp);A().closeModal();await saveMon(m0,mid,x);return A().sysLog(`${m.name} 임시 랭크·배율 해제`,'battle')}})}
 /* ---------- HP 창 (맵툴 hp_mgr): 받은 피해 판정 적용(완화 배율) · 비율/고정 피해 · 특수 피해 · 회복 ---------- */
 const FRACS=[['1/16',16],['1/8',8],['1/6',6],['1/4',4],['1/3',3],['1/2',2],['2/3',1.5]];
 function parseAmt(v,base){v=String(v||'').trim();if(!v)return 0;const m=v.match(/^(\d+)\s*\/\s*(\d+)$/);if(m)return Math.max(1,Math.floor(base*+m[1]/+m[2]));const n=+v;return isNaN(n)?0:Math.max(0,Math.floor(n))}
 /* HP 창의 감쇄 · 보정 요소 (10-27): 기본 대미지에 이미 들어간 것 + 여기서 곱하는 것. 공격 쪽 보정은 공격 쪽을 다룰 수 있을 때만 */
 function hfxHtml(c,lh){if(!lh)return '';const F=lh.hfx||{pub:[],atk:[]};const am=(c.b.mons||{})[lh.fromId];const seeAtk=true;   /* 10-28 망령: 공격 쪽 보정(소지품 ×1.2 · 타입 강화 …)도 받는 쪽에 그대로 보인다 — 때리는 쪽 · 받는 쪽 · 판정 로그 표기를 맞춘다 */const chip=t=>`<span class="chip" style="cursor:default">${esc(t)}</span>`;
  const inB=[...(F.pub||[]),...(seeAtk?(F.atk||[]):[])];const hidN=seeAtk?0:(F.atk||[]).length;
  return `<div class="hfx small" style="margin:6px 0;padding:6px 8px;border:1px dashed var(--line,#888);border-radius:8px"><div><b>기본 대미지에 이미 들어감</b> ${inB.length?inB.map(chip).join(' '):'<span class="dim">없음</span>'}${hidN?` <span class="dim">+ 공격 쪽 보정 ${hidN}개 (공격 쪽만 볼 수 있다)</span>`:''}${lh.crit?' '+chip('급소'):''}</div>
   <div style="margin-top:4px"><b>여기서 곱함</b> ${chip('상성 ×'+lh.eff)} ${lh.guard&&lh.guard!==1?chip('위력 완화 ×'+lh.guard+((F.grd||[]).length?' — '+F.grd.join(' · '):'')):''} <span class="dim">· 반감열매 · 대미지 보정 · 버티기는 아래 칸</span></div></div>`}
 function openHp(mid,tab){const c=ctx();const b=c.b;const m=b.mons[mid];if(!m||!canEdit(c,m))return;tab=tab||(m.lastHit?'dmg':'dmg');const lh=m.lastHit;const pct=(m.hp.cur>0?Math.max(1,Math.round(m.hp.cur/m.hp.max*100)):0);
  const EFFS=[0,0.25,0.5,1,2,4];const fl=raidFloor(m);const berryN=lh&&OI()?OI().resist(m,lh):'';const sashX=lh&&OI()?OI().sash(m):null;const SH=lh?hitShield(m,lh):{};const RX=lh&&lh.cat!=='변화'?hitRules(m):[];
  const md=A().openModal(`<div class="mhead"><h2>「HP」 · ${esc(m.name)}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="hphead"><div class="ti" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}"></div><div style="flex:1"><div class="hpbar ${pct<=25?'low':pct<=50?'mid':''}"><i style="width:${pct}%"></i></div><div class="row small"><span>「HP」 <b>${m.hp.cur}</b> / ${m.hp.max} (${pct}%)</span>${m.hp.latest!=null&&m.hp.latest!==m.hp.cur?`<span class="dim">직전 ${m.hp.latest}</span>`:''}<span class="sp"></span><span class="hpundo"><button class="btn xs ghost" data-hp="undo" ${m.hp.latest==null?'disabled':''}>되돌리기</button><button class="btn xs ghost" data-hp="one">HP 1</button><button class="btn xs ghost danger" data-hp="faint">빈사</button></span></div></div></div>
   <div class="tabs"><button class="tb ${tab==='dmg'?'on':''}" data-hpt="dmg">피해</button><button class="tb ${tab==='heal'?'on':''}" data-hpt="heal">회복</button></div>
   ${tab==='dmg'?`
   ${lh?`<div class="card hit"><div class="hith"><span class="hitw">${esc(lh.from)}</span><span class="hitm">「${esc(lh.move)}」</span>${lh.moveType?`<span class="small dim">${esc(lh.moveType)}</span>`:''}<span class="sp"></span><span class="hitc ${+lh.eff>1?'up':+lh.eff<1?'dn':''}">상성 ×${lh.eff}</span><span class="hitc cr" id="h_critc" ${lh.crit?'':'hidden'}>급소</span>${lh.hits>1?`<span class="hitc">${lh.hits}번 맞음</span>`:''}</div>
     <div class="hitb"><div><small>기본 대미지</small><b id="h_tot">${lh.total}</b><i id="h_rng">${lh.min}~${lh.max}</i></div><div><small>위력 완화</small><b>${lh.guard&&lh.guard!==1?'×'+lh.guard:'—'}</b><i>${lh.guardNote?esc(lh.guardNote):'자동 반영'}${lh.guard&&lh.guard<1?' · 급소 타는 무시':''}</i></div><div class="hitp"><small>받을 피해</small><b id="h_prevd">—</b><i id="h_preva"></i></div></div>
     <div class="hpbar hitbar"><i id="h_bar_after" style="width:${pct}%"></i><em id="h_bar_cut"></em></div><div class="small dim" id="h_perhit" style="margin:2px 0 4px;overflow-wrap:anywhere" hidden></div>
      ${hfxHtml(c,lh)}
     <div class="hgrid">${lh.alt?`<label class="hcrit" title="명중 판정에서 굴린 급소 여부를 여기서 바꾼다 — 대미지를 급소/급소 아님으로 다시 계산한 값으로"><input type="checkbox" id="h_crit" ${lh.crit?'checked':''}> 급소 <span class="small dim">(판정: ${lh.crit?'급소':'급소 아님'})</span></label>`:''}<label>대미지 보정 <input type="text" class="n" id="h_mod" value="1" title="방호·완화·역할 보정 등 배율 · 곱셈도 된다 (1.2*1.5 · ×0.5)"></label>
      <label>최종 상성 <select id="h_eff">${EFFS.map(v=>`<option value="${v}" ${v===+lh.eff?'selected':''}>×${v}</option>`).join('')}</select></label>
      <label><input type="checkbox" id="h_berry" ${berryN?'checked':''}> 반감열매${berryN?` <b style="color:var(--yel2)">「${esc(berryN)}」</b>`:''}</label><label><input type="checkbox" id="h_endure" ${lh.endure||(sashX&&sashX.sure)?'checked':''}> 버티기 (HP 1 남김)${sashX&&sashX.sure?` <b style="color:var(--yel2)">「${esc(sashX.name)}」</b>`:''}</label>${sashX&&sashX.pct?`<label class="small" style="color:var(--yel2)">「${esc(sashX.name)}」 쓰러질 피해면 ${sashX.pct}% 로 버틴다 (적용 때 굴림)</label>`:''}
      ${SH.fullGuard?`<label title="그 타를 맞기 전에 HP 가 가득일 때만 — 연속기면 첫 타만"><input type="checkbox" id="h_fg" checked> 「${esc(SH.fullGuard.name)}」 HP 가득일 때 반감</label>`:''}${SH.disguise?`<label title="이번 시합 한 번 — 처음 맞은 타의 대미지를 0 으로, 대신 HP 를 쓴다"><input type="checkbox" id="h_dsg" checked> 「${esc(SH.disguise.name)}」 첫 타 0 · HP −${SH.disguise.cost}</label>`:''}${RX.length?`<label title="맞은 타마다 특성 글대로 굴리고 적용한다 (적용 뒤 로그)"><input type="checkbox" id="h_rx" checked> 맞을 때 「${esc(abNm(m))}」 자동${lh.hits>1?' (맞은 타마다)':''}</label>`:''}
      <label>고정 대미지 <input type="text" class="n" id="h_forced" placeholder="-1 = 계산값" value="-1" title="숫자 또는 분수(1/8)를 넣으면 그 값으로"></label>
      ${fl?`<label class="small" style="color:var(--yel)">레이드 배리어 하한 ${fl}</label>`:''}</div>
     </div>`
   :'<div class="small dim" style="margin:6px 0">받은 피해 판정이 없다 — 고정·비율 피해로 처리한다.</div>'}
   <div class="card"><div class="sec">비율 · 고정 피해 <span class="note">최대 「HP」 기준</span></div><div class="qs">${FRACS.map(([l,n])=>`<button class="btn sm" data-hp="frac" data-v="${l}">${l} <small>−${Math.max(1,Math.floor(m.hp.max/n))}</small></button>`).join('')}</div>
    <div class="row" style="margin-top:6px"><input type="text" class="n" id="h_cv" placeholder="숫자 또는 분수 (예: 30, 1/8)" style="width:170px"><button class="btn sm" data-hp="custom">피해</button></div></div>
   <div class="card"><div class="sec">특수한 피해</div>
    <div class="spx"><b>↻ 최근 피해 다시</b><span class="small dim">${m.lastTaken?`직전에 받은 피해 ${m.lastTaken.v} · ${esc(m.lastTaken.why)}`:'(기록 없음)'}</span><span class="qs"><button class="btn xs" data-hp="again" ${m.lastTaken?'':'disabled'} title="같은 피해를 한 번 더 받는다 (연속기 추가타 · 같은 효과가 다시 터질 때)">한 번 더</button><button class="btn xs ghost" data-hp="againh" ${m.lastTaken?'':'disabled'} title="그 피해의 절반">½</button>${m.lastTaken&&m.lastTaken.hit?'<button class="btn xs pri" data-hp="rehit" title="그때의 판정과 넣은 배율을 다시 불러와 고쳐서 받는다">배율 고쳐 다시 받기</button>':''}</span></div>
    <div class="spx"><b>🌀 혼란 자해</b><span class="small dim">위력 40 노말 물리 · 상성 · 랭크 무시 (자기 공격/방어)</span><span class="qs"><button class="btn xs" data-hp="confuse">자해</button></span></div>
    <div class="spx"><b>✊ 발버둥 반동</b><span class="small dim">최대 「HP」의 1/4 · 무시할 수 없다 (−${Math.max(1,Math.floor(m.hp.max/4))})</span><span class="qs"><button class="btn xs" data-hp="strug">반동</button></span></div>
    <div class="spx"><b>↯ 반동</b><span class="small dim">직전에 입힌 대미지의 비율 ${m.lastDealt?`(${m.lastDealt.total} · ${esc(m.lastDealt.targets)})`:'(기록 없음)'}</span><span class="qs">${['1/4','1/3','1/2'].map(x=>`<button class="btn xs" data-hp="recoil" data-v="${x}" ${m.lastDealt?'':'disabled'}>${x}</button>`).join('')}</span></div>
    <div class="spx"><b>% 현재 HP 비례</b><span class="small dim">현재 「HP」(${m.hp.cur})의 비율</span><span class="qs">${['1/2','1/4','1/8'].map(x=>`<button class="btn xs" data-hp="cur" data-v="${x}">${x}</button>`).join('')}</span></div>
    <div class="spx"><b>◈ 타입 비례</b><span class="small dim">최대 「HP」 × 비율 × 상성 (스텔스록처럼)</span><span class="qs"><select id="h_tt" class="mini">${(S().allTypes?S().allTypes():['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy']).map(t=>`<option value="${t}">${esc(S().typeKo(t))}</option>`).join('')}</select><input type="text" class="n xs" id="h_tv" value="1/8"><button class="btn xs" data-hp="typed">피해</button></span></div></div>
   ${lh?`<div class="row afoot hpfoot"><span class="small dim" id="h_prev"></span><span class="sp"></span><button class="btn ghost xs" data-hp="discard" title="이 판정을 지운다 (피해 없음)">판정 버리기</button><button class="btn pri" data-hp="apply">피해 적용</button></div>`:''}`
   :`<div class="card"><div class="sec">회복 <span class="note">최대 「HP」 기준</span></div><div class="qs">${FRACS.map(([l,n])=>`<button class="btn sm" data-hp="heal" data-v="${l}">${l} <small>+${Math.max(1,Math.floor(m.hp.max/n))}</small></button>`).join('')}<button class="btn sm" data-hp="full">전부</button></div>
    <div class="row" style="margin-top:6px"><input type="text" class="n" id="h_cv" placeholder="숫자 또는 분수" style="width:170px"><button class="btn sm" data-hp="healc">회복</button></div></div>
   <div class="card"><div class="sec">특수한 회복</div>
    <div class="spx"><b>◆ 드레인</b><span class="small dim">직전에 입힌 대미지의 비율 ${m.lastDealt?`(${m.lastDealt.total})`:'(기록 없음)'}</span><span class="qs">${['1/2','3/4','1/1'].map(x=>`<button class="btn xs" data-hp="drain" data-v="${x}" ${m.lastDealt?'':'disabled'}>${x}</button>`).join('')}</span></div>
    <div class="spx"><b>★ 희망사항</b><span class="small dim">최대 「HP」 1/2</span><span class="qs"><button class="btn xs" data-hp="heal" data-v="1/2">회복</button></span></div></div>`}`);
  md.querySelectorAll('[data-hpt]').forEach(bt=>bt.onclick=()=>{A().closeModal();openHp(mid,bt.dataset.hpt)});
  if(lh&&lh.re){const o=lh.re,g=id=>$('#'+id,md);const sv=(id,v)=>{const e=g(id);if(e&&v!=null)e.value=v};const sc=(id,v)=>{const e=g(id);if(e&&v!=null)e.checked=!!v};sv('h_eff',o.eff);sv('h_mod',o.mod);sv('h_forced',o.forced);sc('h_berry',o.berry);sc('h_endure',o.endure);sc('h_crit',o.crit)}   /* 다시 받기: 그때 넣은 배율 */
  const curHit=()=>{const ck=$('#h_crit',md);return ck&&lh.alt&&ck.checked!==!!lh.crit?lh.alt:lh};
  /* 10-27 망령: 연속기는 타마다 깎는다 (lastHit.per). 버티기 칸이 띠(HP 가득일 때만)로 켜진 거면 그 타를 맞기 전에 가득일 때만 · roll 을 주면 확률 띠를 쓰러지는 타마다 굴린다 */
  const calc=(roll)=>{if(!lh)return null;const g=id=>$('#'+id,md);const forced=g('h_forced').value.trim();
   if(forced!==''&&forced!=='-1'){const v=parseAmt(forced,m.hp.max);return {final:Math.min(v,m.hp.cur),after:Math.max(0,m.hp.cur-v)}}
   const h=curHit();const per=h.per&&h.per.length>1?h.per:[h.total];const en=g('h_endure').checked,sashOnly=en&&!lh.endure&&!!(sashX&&sashX.sure);
   const fgOn=!!(SH.fullGuard&&g('h_fg')&&g('h_fg').checked),dgOn=!!(SH.disguise&&g('h_dsg')&&g('h_dsg').checked);
   /* 멀티스케일을 손으로 발동해 둔 경우 위력 완화에 이미 ×0.5 가 들어 있다 — 빼고 타마다 다시 건다 */const g0=(lh.guard||1)/(fgOn&&String(lh.guardNote||'').includes(SH.fullGuard.name)?SH.fullGuard.v:1);
   const r=B().hpDamageHits(m,per,+g('h_eff').value,{fullGuard:fgOn?SH.fullGuard.v:0,disguise:dgOn?SH.disguise.cost:0,stab:false,guard:g0,guardCrit:lh.guardCrit,crit:h===lh?(lh.perCrit||!!lh.crit):!!h.crit,manual:mulOf(g('h_mod').value,1)||1,berryHalf:g('h_berry').checked,endure:en&&!sashOnly,endureFull:sashOnly,hpFloor:fl,band:roll&&sashX&&sashX.pct&&!en?{pct:sashX.pct,roll:()=>1+Math.floor(Math.random()*100)}:null});return r};
  const perTxt=r=>{const n=(curHit().per||[]).length;if(!r||!r.per||(n<2&&!r.per.some(x=>x.held==='disguise'||x.fg)))return '';return r.per.map((x,k)=>`${k+1}타 −${x.final}${x.held==='band'?'(띠로 버팀)':x.held==='disguise'?'(탈)':x.held?'(버팀)':''}${x.fg?'(반감)':''}`).join(' · ')+(r.landed<n?` · ${r.landed}타째에 쓰러져 남은 ${n-r.landed}타는 맞지 않음`:'')};
  const prev=()=>{const r=calc();if(!r)return;{const h=curHit();const t=$('#h_tot',md),rg=$('#h_rng',md),cc=$('#h_critc',md);if(t)t.textContent=h.total;if(rg)rg.textContent=h.min+'~'+h.max;if(cc)cc.hidden=!h.crit}const P=v=>v>0?Math.max(1,Math.round(v/m.hp.max*100)):0;const d=$('#h_prevd',md),a=$('#h_preva',md),bA=$('#h_bar_after',md),bC=$('#h_bar_cut',md);
   if(d)d.textContent='−'+r.final;if(a)a.textContent=`HP ${m.hp.cur} → ${r.after}/${m.hp.max} (${P(r.after)}%)${r.after<=0?' · 빈사':''}`;{const ph=$('#h_perhit',md);if(ph){ph.textContent=perTxt(r);ph.hidden=!ph.textContent}}
   if(bA)bA.style.width=P(r.after)+'%';if(bC){bC.style.left=P(r.after)+'%';bC.style.width=Math.max(0,pct-P(r.after))+'%'}};prev();
  md.querySelectorAll('#h_mod,#h_eff,#h_berry,#h_endure,#h_forced,#h_crit,#h_fg,#h_dsg').forEach(el=>{el.addEventListener('input',prev);el.addEventListener('change',prev)});
  const apply=async(delta,why,opt)=>{opt=opt||{};const m0=snap(ctx().b.mons[mid]),x=snap(m0);x.hp.latest=x.hp.cur;
   if(delta<0){let v=-delta;if(opt.floor&&x.hp.cur-v<opt.floor)v=Math.max(0,x.hp.cur-opt.floor);x.hp.cur=Math.max(0,x.hp.cur-v);x.hpOdd=!x.hpOdd;delta=-v;if(v>0)x.lastTaken={v,why:String(why||'').split('\n')[0].slice(0,120),turn:+ctx().b.turn||0,...(opt.hit?{hit:opt.hit}:{})}}else{const h=Math.min(delta,x.hp.max-x.hp.cur);x.hp.cur+=h;delta=h}
   if(opt.clearHit)delete x.lastHit;if(opt.dsg)x.dsgUsed=1;const pc=v=>v>0?Math.max(1,Math.round(v/x.hp.max*100)):0;
   let line=delta?`【${delta>0?'회복':'피해'}】 ${x.name} ${delta>0?'+':'−'}${Math.abs(delta)}  ·  HP ${x.hp.latest} → ${x.hp.cur}/${x.hp.max} (${pc(x.hp.cur)}%)\n${why}`:`【무효】 ${x.name} 대미지 없음  ·  HP ${x.hp.cur}/${x.hp.max}\n${why}`;
   if(x.hp.cur<=0){x.entry='';line+=`\n${x.name}은(는) 쓰러졌다!`}
   if(x.raid&&x.raid.segments>0&&opt.floor&&x.hp.cur<=opt.floor&&delta<0&&x.hp.cur>0){x.raid.broken=(x.raid.broken||0)+1;x.raid.brk=1;line+=`\n◆ ${x.name}의 배리어(${opt.floor})가 깨졌다! — 턴 종료 이후 「트리거 : 페이즈 체인지」`}   /* 10-25 망령: 맵툴처럼 페이즈 체인지는 깨진 턴이 끝난 뒤 */
   A().closeModal();if(await saveMon(m0,mid,x)){A().sysLog(line,'battle',Object.assign({mid,img:x.image||''},delta?{hp:{name:x.name,prev:x.hp.latest,cur:x.hp.cur,max:x.hp.max,why,faint:x.hp.cur<=0}}:{}));if(x.hp.cur<=0&&m0.hp.cur>0)await faintOff(mid)}};
  md.querySelectorAll('[data-hp]').forEach(bt=>bt.onclick=async()=>{const k=bt.dataset.hp;const v=bt.dataset.v;const g=id=>$('#'+id,md);
   if(k==='apply'){let r=calc();if(!r)return;const mods=[];{const hm=mulOf(g('h_mod').value,1)||1;if(hm!==1)mods.push('보정 ×'+hm)}if(g('h_berry').checked)mods.push(berryN?'「'+berryN+'」 반감':'반감열매');let saved=false;if(g('h_endure').checked){const ec=g('h_endure');ec.checked=false;const r0=calc();ec.checked=true;saved=!!(r0&&r0.after<=0&&r.after>0);if(saved)mods.push(sashX&&sashX.sure?'「'+sashX.name+'」로 버팀':'버티기')}   /* 10-23 망령 제보: 쓰러질 피해가 아니면 「버팀」을 적지 않는다 */
    /* 기합의머리띠: 쓰러질 피해면 굴린다 */
    if(sashX&&sashX.pct&&!g('h_endure').checked&&r.after<=0&&m.hp.cur>1){r=calc(true);for(const x of (r.per||[]).filter(x=>x.band))mods.push(x.band.ok?`「${sashX.name}」로 버팀 (${x.band.roll}/${x.band.pct})`:`「${sashX.name}」 실패 (${x.band.roll}/${x.band.pct})`)}
    const berryUse=g('h_berry').checked&&/열매/.test(IT(m));const sashUse=saved&&sashX&&sashX.sure&&sashX.once&&m.hp.cur>1;const hc=curHit();const rxOn=!!(RX.length&&g('h_rx')&&g('h_rx').checked);   /* 창이 닫히기 전에 읽어 둔다 */const ret=await apply(-r.final,`${lh.from}의 「${lh.move}」 · 상성 ×${g('h_eff').value}${hc.crit?' · 급소':''}${hc!==lh?(hc.crit?' (급소로 바꿈)':' (급소 아님으로 바꿈)'):''}${lh.hits>1?' · '+lh.hits+'번 맞음':''}${mods.length?' · '+mods.join(' · '):''}${perTxt(r)?'\n'+perTxt(r):''}`,{clearHit:true,hit:(()=>{const h=JSON.parse(JSON.stringify(lh));delete h.re;const ck=g('h_crit');return {lh:h,o:{eff:g('h_eff').value,mod:g('h_mod').value,berry:g('h_berry').checked,endure:g('h_endure').checked,forced:g('h_forced').value,...(ck?{crit:ck.checked}:{})}}})(),floor:fl,dsg:(r.per||[]).some(x=>x.held==='disguise')});if(berryUse||sashUse)await itemConsume(mid);
    const nHit=r.per&&r.per.length?r.landed:1;if(OI()&&r.final>0)await itemHitReact(mid,lh,r.final,nHit);
    if(rxOn&&r.final>0)await abilityHitReact(mid,Object.assign({},lh,hc===lh?{}:{perCrit:null,crit:hc.crit}),r);return ret}
   /* 10-28 망령: 「피해 다시 받기」 — 그때의 판정과 넣은 배율(상성 · 대미지 보정 · 반감열매 · 버티기 · 고정 · 급소)을 다시 불러와 고쳐서 받는다 */
   if(k==='rehit'){const L=m.lastTaken;if(!L||!L.hit)return;A().closeModal();await A().set(['battle','mons',mid,'lastHit'],Object.assign({},L.hit.lh,{re:L.hit.o,at:Date.now()}));return openHp(mid,'dmg')}
   if(k==='again'||k==='againh'){const L=m.lastTaken;if(!L)return;const v=k==='againh'?Math.max(1,Math.floor(L.v/2)):L.v;return apply(-v,`최근 피해 다시${k==='againh'?' (½)':''} — ${L.why}`,{floor:fl})}
   if(k==='discard'){A().closeModal();await A().set(['battle','mons',mid,'lastHit'],null);return A().sysLog(`${m.name} 받은 피해 판정을 버렸다`,'battle')}
   if(k==='frac')return apply(-parseAmt(v,m.hp.max),`비율 피해 ${v}`,{floor:fl});
   if(k==='custom'){const a=parseAmt(g('h_cv').value,m.hp.max);if(!a)return A().toast('숫자나 분수를 넣어 줘');return apply(-a,`고정 피해 ${g('h_cv').value}`,{floor:fl})}
   if(k==='recoil'){if(FX()&&FX().noind(m,'recoil'))return A().toast('반동 비례 대미지를 받지 않는다');const a=parseAmt(v,m.lastDealt.total);return apply(-a,`반동 ${v} (입힌 ${m.lastDealt.total})`)}
   if(k==='confuse'){if(!F())return;const v=F().confusionHit(m);return apply(-v,'혼란 자해 (위력 40 노말 물리)')}
   if(k==='strug')return apply(-Math.max(1,Math.floor(m.hp.max/4)),'발버둥 반동 (최대 HP 1/4 · 무시 불가)');
   if(k==='cur')return apply(-Math.max(1,parseAmt(v,m.hp.cur)),`현재 HP 비례 ${v}`);
   if(k==='typed'){const ty=g('h_tt').value;const mul=B().effectiveness([ty],m,{}).value;if(mul<=0){return A().toast(`${S().typeKo(ty)} 타입은 효과가 없다`)}const base=parseAmt(g('h_tv').value,m.hp.max);return apply(-Math.max(1,Math.floor(base*mul)),`타입 비례 피해 ${S().typeKo(ty)} ${g('h_tv').value} ×${mul}`)}
   if(k==='heal')return apply(parseAmt(v,m.hp.max),`회복 ${v}`);
   if(k==='healc'){const a=parseAmt(g('h_cv').value,m.hp.max);if(!a)return;return apply(a,`회복 ${g('h_cv').value}`)}
   if(k==='full')return apply(m.hp.max-m.hp.cur,'전부 회복');
   if(k==='drain')return apply(parseAmt(v,m.lastDealt.total),`드레인 ${v} (입힌 ${m.lastDealt.total})`);
   if(k==='one')return apply(-(m.hp.cur-1),'HP 1');
   if(k==='faint')return apply(-m.hp.cur,'빈사 처리');
   if(k==='undo'){const m0=snap(ctx().b.mons[mid]),x=snap(m0);const l=x.hp.latest;if(l==null)return;x.hp.latest=x.hp.cur;x.hp.cur=l;if(x.hp.cur>0&&!x.entry&&m.hp.cur<=0){}A().closeModal();await saveMon(m0,mid,x);return A().sysLog(`${x.name} HP 되돌리기 → ${x.hp.cur}/${x.hp.max}`,'battle')}})}
 /* ---------- 폼체인지 · 메가진화 (제작기 시트의 forms). form0 에 원래 모습을 두고 돌아올 때 그대로 되돌린다 ---------- */
 function formSet(m,k){const L=[];const f=k>=0?(m.forms||[])[k]:null;if(k>=0&&!f)return L;
  if(!m.form0)m.form0={name:m.name,types:m.types,typesKo:m.typesKo,ability:m.ability,abilityEff:m.abilityEff,base:m.base,ranks:m.ranks,stats:m.stats,image:m.image,pots:JSON.parse(JSON.stringify(m.pots||[]))};
  const o=m.form0;const fromName=m.name,oldAb=m.ability,oldMax=m.hp.max;
  if(oldAb&&FX())FX().removeByName(m,oldAb);delete m.typesOrig;delete m.abilityOrig;
  /* 폼마다 바뀌는 포텐셜 칸 (종족·속별 등): 원래 목록에서 같은 칸(slot)을 갈아 끼운다. 빠지는 포텐셜의 발동 효과는 푼다 */
  const potsBefore=(m.pots||[]).map(p=>p.name);const fp=(f&&f.pots)||[];const pots=JSON.parse(JSON.stringify(o.pots||[]));const swapped=[];
  for(const x of fp){const i=pots.findIndex(p=>p.slot===x.slot);const np={slot:x.slot,name:x.name,kind:x.kind||'',eff:x.eff||''};if(i>=0){swapped.push([pots[i].name,x.name]);pots[i]=np}else{swapped.push(['',x.name]);pots.push(np)}}
  m.pots=pots;const potsAfter=pots.map(p=>p.name);if(FX())for(const n of potsBefore)if(!potsAfter.includes(n))FX().removeByName(m,n);
  m.formNewPots=potsAfter.filter(n=>!potsBefore.includes(n));
  if(f){m.name=f.name||o.name;m.types=f.types||o.types;m.typesKo=f.typesKo||o.typesKo;if(f.ability){m.ability=f.ability;m.abilityEff=f.abilityEff!=null?f.abilityEff:''}else{m.ability=o.ability;m.abilityEff=o.abilityEff}
   m.base=f.base;m.ranks=f.base.map(S().gradeOf);m.stats=S().statsOf(f.base,m.iv,m.ev,m.lv);m.image=f.image||o.image;m.formIdx=k}
  else{for(const x of ['name','types','typesKo','ability','abilityEff','base','ranks','stats','image'])m[x]=o[x];delete m.form0;delete m.formIdx}
  const potLine=f?swapped.map(([a,b2])=>a?`「${a}」→「${b2}」`:`+「${b2}」`).join(' · '):(m.formNewPots.length?'포텐셜 '+m.formNewPots.map(n=>'「'+n+'」').join('')+' 복귀':'');
  /* 최대 HP 가 바뀌면 그 차이만큼 지금 HP 도 (지가르데 퍼펙트폼처럼). 쓰러지지는 않는다 */
  m.hp.max=m.stats[0];if(m.hp.max!==oldMax)m.hp.cur=Math.max(m.hp.cur>0?1:0,Math.min(m.hp.max,m.hp.cur+(m.hp.max-oldMax)));
  const tk=t=>(t||[]).filter(x=>x&&x!=='-').map(x=>S().typeKo?S().typeKo(x):x).join('/');
  L.push(f?`${fromName} → 「${m.name}」 ${f.kind||'폼체인지'}! (${tk(m.types)} · 특성 ${m.ability||'-'}${m.hp.max!==oldMax?' · 최대 HP '+oldMax+'→'+m.hp.max:''})${potLine?'\n포텐셜 '+potLine:''}`:`${fromName} → 원래 모습 「${m.name}」으로 돌아왔다${potLine?'\n'+potLine:''}`);
  return L}
 /* ---------- 소지품 소모 (맵툴 item_consume): 칸에서 빼고 itemUsed 에 남긴다. 결과 정리 때 시트에서도 뺀다 ---------- */
 /* 10-27 망령: 받는 쪽 특성 — 첫 타 완화(멀티스케일 · 스펙터가드) · 탈 · 맞을 때마다 반응(정전기 · 까칠한피부 · 지구력 · 깨어진갑옷 …). 특성 글(abilityEff, 없으면 특성 DB)을 읽는다 */
 function abNm(m){return String((m&&m.ability)||'').replace(/^특성\s*:\s*/,'').trim()}
 function abTxt(m){return String((m&&m.abilityEff)||((DB().traits||{})[abNm(m)]||{}).multi||'').replace(/<br\s*\/?>/gi,'\n')}
 function hitShield(m,lh){const t=abTxt(m);const o={};if(!t||!m||(lh&&lh.cat==='변화'))return o;
  if(/「HP : 가득」일 때 기술(?:의|로 받을) 대미지를 반감/.test(t))o.fullGuard={v:0.5,name:abNm(m)};
  const dz=t.match(/기술에 의한 대미지를 「0」으로 만들고 자신의 「HP」를 (\d+\/\d+)만큼 소비/);if(dz&&!m.dsgUsed)o.disguise={cost:parseAmt(dz[1],m.hp.max),name:abNm(m)};return o}
 /* 공격 창 예상용: 받는 쪽 첫 타 완화 · 탈 (손으로 발동해 이미 완화에 든 것은 빼지 않고 그대로) */
 function hsOpt(def,cat,mods){const sh=hitShield(def,{cat});const dup=sh.fullGuard&&((mods&&mods.names)||[]).some(x=>String(x.txt||'').includes(sh.fullGuard.name));return {fullGuard:sh.fullGuard&&!dup?sh.fullGuard.v:0,disguise:sh.disguise?sh.disguise.cost:0}}
 const HIT_ST={공격:'attack',방어:'defense',특공:'specialattack',특방:'specialdefense',스피드:'speed',명중:'accuracy',회피:'evasion'};
 function hitRules(m){const t=abTxt(m);if(!t)return [];const R=[];
  for(const cl of t.split(/(?=[①②③④⑤])|\n/)){const c=cl.trim();if(!/받(았을 때|으면)|급소에 맞았을 때/.test(c))continue;if(/반감|무효|「0」|「빈사」 상태가 되지|교대|모든 포켓몬|아군|상대 전체|적진|상태일 때|하고 자신을|「[^」:]+ : \d+\/\d+」/.test(c))continue;   /* 조건 붙은 것 · 두 쪽에 다른 효과 · 타입 비례는 손으로 */
   const r={};let x;if(/「접촉기」를 받/.test(c))r.contact=1;if((x=c.match(/「(물리기|특수기)」를 받/)))r.cat=x[1]==='물리기'?'물리':'특수';
   if((x=c.match(/「([^」]+)」 기술을 받/)))r.types=x[1].split('/').map(s=>S().typeEn(s.trim())).filter(Boolean);if(/급소에 맞았을 때/.test(c))r.crit=1;
   if(!r.contact&&!r.cat&&!r.types&&!r.crit&&!/공격을 받/.test(c))continue;
   if((x=c.match(/(\d+)할로/)))r.chance=+x[1]*10;if((x=c.match(/(\d+)턴 동안/)))r.cnt=+x[1];r.to=/자신을 공격한 (?:포켓몬|상대)|대상을|대상에게|그 포켓몬|상대를|상대에게/.test(c)?'atk':'self';
   if((x=c.match(/(\d+\/\d+)의 비례 대미지/)))r.back=x[1];
   if((x=c.match(/「([^」:]+\/[^」:]+)」 중 무작위/)))r.rnd=x[1].split('/');else if((x=c.match(/「([^」:]+)」 상태/))&&FX()&&FX().stEn(x[1]))r.state=x[1];
   if((x=c.match(/「특성 : ([^」]+)」로 만든다/)))r.setTrait=x[1];
   const st={};for(const y of c.matchAll(/「(공격|방어|특공|특방|스피드|명중|회피) : ([+-]\d+)」/g))st[HIT_ST[y[1]]]=(st[HIT_ST[y[1]]]||0)+(+y[2]);if(Object.keys(st).length)r.stats=st;
   if(r.back||r.rnd||r.state||r.setTrait||r.stats)R.push(r)}
  return R}
 /* 맞은 타마다 특성 반응을 돌린다. r = hpDamageHits 결과(per · landed) — 받는 쪽 화면에서, 공격한 쪽도 함께 고친다 */
 async function abilityHitReact(mid,lh,r){if(!FX()||!lh||!r)return;const b0=snap(),b=snap(b0);const m=b.mons[mid];if(!m)return;const R=hitRules(m);if(!R.length)return;
  const n=r.per&&r.per.length?r.landed:(r.final>0?1:0);if(!n)return;const per=r.per&&r.per.length?r.per:[{after:m.hp.cur}];const crits=lh.perCrit||[];const name='특성 : '+abNm(m);const L=[];
  for(let k=0;k<n;k++){const pre=n>1?(k+1)+'타 · ':'';const atk=b.mons[lh.fromId];
   for(const ru of R){if(ru.contact&&!lh.ct)continue;if(ru.cat&&ru.cat!==lh.cat)continue;if(ru.types&&!ru.types.some(t=>(lh.mt||[]).includes(t)))continue;if(ru.crit&&!(crits[k]||(!crits.length&&lh.crit&&k===0)))continue;
    if(ru.to==='self'&&!((per[k]||{}).after>0))continue;const tg=ru.to==='atk'?atk:m;if(!tg||tg.hp.cur<=0)continue;
    if(ru.setTrait&&abNm(tg)===ru.setTrait)continue;
    let roll='';if(ru.chance){const rl=1+Math.floor(Math.random()*100);if(rl>ru.chance){L.push(`${pre}${tg.name} 「${name}」 실패 (${rl}/${ru.chance})`);continue}roll=` (${rl}/${ru.chance})`}
    const tgt=tg.id===m.id?'self':tg.side===m.side?'ally1':'enemy1';const ops=[];
    if(ru.back)ops.push({k:'dmg',tgt,value:ru.back,basis:'max'});const stn=ru.rnd?ru.rnd[Math.floor(Math.random()*ru.rnd.length)]:ru.state;if(stn)ops.push({k:'state',state:stn,tgt,count:ru.cnt||-1,forced:0});if(ru.stats)ops.push({k:'rank',tgt,stats:ru.stats});
    if(ops.length){const res=await FX().run(ops,{b,self:m,name,pick:list=>list.find(x=>x.id===tg.id)||null,confirm:async()=>true,choose:async()=>[0]});L.push(...res.lines.map(x=>pre+String(x).replace(/(」(?: \d+턴)?) — .*$/,'$1')+roll))   /* 상태 설명 글은 줄인다 */}
    if(ru.setTrait){if(FX().setAb)FX().setAb(tg,ru.setTrait,name);else{if(tg.abilityOrig==null)tg.abilityOrig=tg.ability||'';tg.abilityBy=name;tg.ability=ru.setTrait;tg.abilityEff=((DB().traits||{})[ru.setTrait]||{}).multi||''}L.push(`${pre}${tg.name} 특성 → 「${ru.setTrait}」${roll}`)}}}
  if(!L.length)return;for(const id in b.mons){const x=b.mons[id];if(x.entry&&x.hp.cur<=0)x.entry=''}
  if(await saveBattle(b0,b,undefined,{n:m.name,s:abNm(m),img:m.image||''}))A().sysLog(`【특성】 ${m.name} 「${abNm(m)}」${n>1?' · '+n+'번 맞음':''}\n${L.join('\n')}`,'battle',{mid,img:m.image||''})}
 /* 맞은 뒤 소지품 반응 (약점보험 · 울퉁불퉁멧 · 옐로우카드 · 풍선 · 구근 …): 받는 쪽 화면에서, 공격한 쪽도 함께 고친다 */
 async function itemHitReact(mid,lh,dealt,n){const b0=snap(),b=snap(b0);const m=b.mons[mid];if(!m)return;let L=[];try{L=OI().onHit(b,m,lh,dealt,n)}catch(e){console.warn(e);return}if(!L.length)return;
  for(const id in b.mons){const x=b.mons[id];if(x.entry&&x.hp.cur<=0)x.entry=''}
  if(await saveBattle(b0,b,undefined,{n:m.name,s:(b0.mons[mid]||{}).item||'',img:m.image||''}))A().sysLog(`【소지품】 ${m.name} 『${(b0.mons[mid]||{}).item||''}』\n${L.join('\n')}`,'battle',{mid,img:m.image||'',eff:String(((DB().items||{})[String((b0.mons[mid]||{}).item||'').replace(/『|』/g,'').trim()]||{}).eff||'').slice(0,300)})}
 async function itemConsume(mid,undo){const m0=snap(ctx().b.mons[mid]);if(!m0)return;const x=snap(m0);
  if(undo){const u=x.itemUsed;if(!u||x.item)return;x.item=u.name;x.itemEff=u.eff||'';delete x.itemUsed;await saveMon(m0,mid,x);return A().sysLog(`${x.name} 「${u.name}」 소모 되돌림`,'battle')}
  if(!x.item)return;const name=x.item;x.itemUsed={name,eff:x.itemEff||'',turn:+ctx().b.turn||0};if(FX())FX().removeByName(x,name);x.item='';x.itemEff='';
  await saveMon(m0,mid,x);A().sysLog(`${x.name}의 「${name}」 — 다 써서 없어졌다`,'battle',{mid,img:x.image||''})}
 /* 다 쓰면 사라지는 소지품: 열매 · 효과 글에 소모/사라진다/한 번 */
 const oneShot=m=>{const n=IT(m);return !!n&&(/열매|주얼$|씨$/.test(n)||/소모|사라진다|사라짐|1회|한 번/.test(m.itemEff||''))};
 /* ---------- 배틀 결과 정리 (맵툴 battle_return): HP·빈사·상태 이상·포텐셜 횟수·쓴 소지품을 시트(로스터)로 ---------- */
 const SHEET_ABN=['Poison','Toxic','Burn','Paralysis','Freeze','Sleep'];
 function resultOf(m,rm){const dead=m.hp.cur<=0||!!(m.states||{}).Dead;
  const hp=dead?0:Math.min(rm.hp.max,m.form0?Math.max(1,Math.round(m.hp.cur/m.hp.max*rm.hp.max)):m.hp.cur);
  const st={};for(const k of SHEET_ABN)if((m.states||{})[k])st[k]=m.states[k];if(dead)st.Dead=1;
  return {hp,dead,st,uses:Object.assign({},m.potUses||{}),item:m.item||'',itemEff:m.itemEff||'',used:!m.item&&m.itemUsed?m.itemUsed.name:''}}
 function openResult(){const c=ctx();if(!c.gm)return;const b=c.b;const R=(A().ST.state.roster||{}).mons||{};const stKo=k=>(((DB().states||{}).st||{})[k]||{}).ko||k;
  const RID=m=>m.rid||m.id;   /* 빌려 쓴 파티(다른 좌석이 불러옴)는 배틀 id 가 다르다 — 시트 id 는 rid */
  const mons=Object.values(b.mons||{}).filter(m=>R[RID(m)]).sort((x,y)=>String(x.tid).localeCompare(String(y.tid))||(x.slot||0)-(y.slot||0));
  if(!mons.length)return A().toast('시트(로스터)에서 불러온 포켓몬이 없다');
  const rows=mons.map(m=>{const rm=R[RID(m)];const r=resultOf(m,rm);const t=b.trainers[m.tid]||{};const hp0=rm.sheetHp==null?rm.hp.max:rm.sheetHp;
   const usesTxt=Object.entries(r.uses).map(([k,v])=>`${k} 남은 ${v}`).join(' · ');
   return {m,r,html:`<tr><td><label class="row" style="gap:6px;flex-wrap:nowrap"><input type="checkbox" data-rs="${m.id}" checked><div class="ti sm" style="${m.image?`background-image:url('${cssu((m.form0||{}).image||m.image)}')`:''}"></div><div><b>${esc((m.form0||{}).name||m.name)}</b><div class="small dim">${esc(t.name||'')}</div></div></label></td>
    <td class="nw mono">${hp0} → <b style="color:${r.dead?'var(--red)':r.hp<hp0?'var(--yel2)':'var(--ok)'}">${r.hp}</b><span class="dim">/${rm.hp.max}</span></td>
    <td>${r.dead?'<span class="rk" style="background:var(--red);color:#fff">빈사</span>':''}${Object.keys(r.st).filter(k=>k!=='Dead').map(k=>`<span class="rk">${esc(stKo(k))}</span>`).join('')||(r.dead?'':'<span class="dim small">없음</span>')}</td>
    <td class="small">${usesTxt?esc(usesTxt):'<span class="dim">그대로</span>'}</td>
    <td class="small">${r.used?`<s>${esc(r.used)}</s> 소모`:(r.item!==(rm.item||'')?esc((rm.item||'-')+' → '+(r.item||'없음')):'<span class="dim">그대로</span>')}</td></tr>`}});
  const md=A().openModal(`<div class="mhead"><h2>배틀 결과 정리</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="small dim" style="margin-bottom:6px">체크한 것만 시트(로스터)에 돌려준다. 다음에 파티를 불러오면 이 HP·상태로 시작한다.</div>
   <div class="row small" style="gap:12px;margin-bottom:8px"><label><input type="checkbox" data-rk="hp" checked> HP</label><label><input type="checkbox" data-rk="st" checked> 빈사·상태 이상</label><label><input type="checkbox" data-rk="uses" checked> 포텐셜 횟수</label><label><input type="checkbox" data-rk="item" checked> 쓴 소지품</label></div>
   <table class="t"><tr><th>포켓몬</th><th>HP</th><th>상태</th><th>포텐셜 횟수</th><th>소지품</th></tr>${rows.map(x=>x.html).join('')}</table>
   <div class="row" style="margin-top:10px"><label class="small"><input type="checkbox" id="rsclear"> 반영한 뒤 배틀 비우기</label><span class="sp"></span><button class="btn" data-x>취소</button><button class="btn pri" id="rsgo">시트에 반영</button></div>`);
  $('#rsgo',md).onclick=async()=>{const on=k=>!!(md.querySelector(`[data-rk="${k}"]`)||{}).checked;const ops=[];const L=[];
   for(const {m,r} of rows){if(!(md.querySelector(`[data-rs="${m.id}"]`)||{}).checked)continue;const P=['roster','mons',RID(m)];const bits=[];
    if(on('hp')){ops.push([[...P,'sheetHp'],r.hp]);bits.push('HP '+r.hp)}
    {const rr=(R[RID(m)]||{}).rank||{};if(Object.values(rr).some(v=>+v)){ops.push([[...P,'rank'],{attack:0,defense:0,specialattack:0,specialdefense:0,speed:0,accuracy:0,evasion:0,critical:0}]);bits.push('배틀 전 랭크 정리')}}   /* 10-26: 스킬 체크 패널티로 시트에 남긴 랭크는 이 배틀에서 썼으니 비운다 */
    if(on('st')){ops.push([[...P,'sheetStates'],Object.keys(r.st).length?r.st:null]);const s2=Object.keys(r.st).map(k=>k==='Dead'?'빈사':stKo(k));if(s2.length)bits.push(s2.join('·'))}
    if(on('uses')){ops.push([[...P,'potUses'],Object.keys(r.uses).length?r.uses:null])}
    if(on('item')&&r.used&&!r.item){ops.push([[...P,'item'],'']);ops.push([[...P,'itemEff'],'']);bits.push(r.used+' 소모')}
    L.push(`${(m.form0||{}).name||m.name}: ${bits.join(' · ')||'반영'}`)}
   if(!ops.length)return A().toast('반영할 것이 없다');A().closeModal();ops.push([['battle','resultAt'],Date.now()]);   /* 10-31 망령 「결과 정리를 했는데 던전 귀환 창이 『결과 정리 먼저』」: 했다는 표시 */if(!await A().setMany(ops))return;
   A().sysLog(`【배틀 결과】 시트에 반영\n${L.join('\n')}`,'battle');A().toast('시트에 반영했다');
   {const HL=window.OM_HALL_UI;const nb=ctx().b;if(HL&&HL.worth(nb))await HL.offer(nb,{})}   /* 10-27 망령: 결과 정리 때도 전당에 남길지 */
   if($('#rsclear',md).checked){CMD={};await A().set(['battle'],{turn:0,phase:0,mode:mode(b),sides:{left:{trainers:[]},right:{trainers:[]}},trainers:{},mons:{},field:{},cmds:{},order:[]})}}}
 /* 폼 목록은 시트(로스터) 쪽을 먼저 — 오레마스 시트에서 고친 폼이 바로 따라온다 (빌려 온 파티는 rid) */
 function formsOf(m){const rm=((A().ST.state.roster||{}).mons||{})[m.rid||m.id];return rm?(rm.forms||[]):(m.forms||[])}
 function openForm(mid){const c=ctx();const b=c.b;const m=b.mons[mid];if(!m||!canEdit(c,m))return;const forms=formsOf(m);if(!forms.length&&!m.form0&&!hasTera(m))return;
  const usedTera=Object.values(b.mons).some(x=>x.tid===m.tid&&x.teraUsed&&x.id!==mid);
  const cur=m.form0?m.formIdx:-1;const o=m.form0||m;const usedMega=Object.values(b.mons).some(x=>x.tid===m.tid&&x.megaUsed&&x.id!==mid);
  const row=(k,f)=>{const ty=f?(f.types||o.types):o.types;const base=f?f.base:o.base;const img=f?(f.image||o.image):o.image;
   return `<label class="firerow ${k===cur?'dis':''}" data-fm="${k}"><div class="row" style="gap:8px;flex-wrap:nowrap"><div class="ti sm" style="${img?`background-image:url('${cssu(img)}')`:''}"></div><div><b>${esc(f?f.name||o.name:o.name)}</b> <span class="small dim">${f?esc(f.kind||'폼체인지'):'원래 모습'}${k===cur?' · 지금':''}</span>
    <div class="small">${(ty||[]).filter(x=>x&&x!=='-').map(x=>esc(S().typeKo(x))).join('/')} · 특성 ${esc((f&&f.ability)||o.ability||'-')} · ${['H','A','B','C','D','S'].map((x,i)=>x+(base||[])[i]).join(' ')}</div>${f&&(f.pots||[]).length?`<div class="small">포텐셜 ${f.pots.map(x=>{const op=(o.pots||m.pots||[]).find(p=>p.slot===x.slot);return (op?esc(op.name)+'→':'+')+'「'+esc(x.name)+'」'}).join(' · ')}</div>`:''}${f&&f.cond?`<div class="small" style="color:var(--yel2)">${esc(f.cond)}</div>`:''}${f&&f.kind==='메가진화'&&usedMega?'<div class="small" style="color:var(--red)">이 트레이너는 이번 배틀에서 이미 메가진화를 썼다</div>':''}</div></div></label>`};
  const md=A().openModal(`<div class="mhead"><h2>${esc(m.name)} — ${forms.length||m.form0?'폼체인지':'테라스탈'}${(forms.length||m.form0)&&hasTera(m)?' · 테라스탈':''}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="firelist">${hasTera(m)?`<label class="firerow" data-tera="1"><div class="row" style="gap:8px;flex-wrap:nowrap"><div class="ti sm" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}"></div><div><b>${teraOn(m)?'테라스탈 끄기':'테라스탈'}</b> <span class="small dim">테라 타입 「${esc(m.tera)}」${teraOn(m)?' · 지금':''}</span>
    <div class="small">${teraOn(m)?'교대해도 풀리지 않는다 — 잘못 켰을 때 바로잡기만':`받는 상성은 「${esc(m.tera)}」 하나로 · 원래 타입과 테라 타입 모두 자속${teraSameIf(m)?' · 같은 타입이라 자속 2배(적응력)':''}`}</div>${!teraOn(m)&&usedTera?'<div class="small" style="color:var(--red)">이 트레이너는 이번 배틀에서 이미 테라스탈을 썼다</div>':''}</div></div></label>`:''}${m.form0?row(-1,null):''}${forms.map((f,k)=>row(k,f)).join('')}</div>
   <div class="small dim" style="margin-top:6px">랭크·상태는 그대로. 최대 HP 가 바뀌면 그 차이만큼 지금 HP 도 바뀐다. 「교대하면 돌아옴」 폼은 퇴장 때 원래 모습으로.</div>`);
  {const te=md.querySelector('[data-tera]');if(te)te.onclick=async()=>{const on=!teraOn(m);if(!on&&!(await askYes('테라스탈은 교대해도 풀리지 않는다. 잘못 켠 것을 바로잡으려고 끌까?','끈다'))){openForm(mid);return}if(on&&usedTera&&!(await askYes('이 트레이너는 이번 배틀에서 이미 테라스탈을 썼다. 그래도 할까?','한다'))){openForm(mid);return}A().closeModal();await doTera(mid,on)}}
  md.querySelectorAll('[data-fm]').forEach(el=>el.onclick=async()=>{const k=+el.dataset.fm;if(k===cur)return;const f=forms[k];
   if(f&&f.kind==='메가진화'&&usedMega&&!(await askYes('이 트레이너는 이번 배틀에서 이미 메가진화를 썼다. 그래도 할까?','한다'))){openForm(mid);return}
   A().closeModal();await doForm(mid,k)})}
 /* 11-02 망령: 테라스탈 켜기 · 끄기 — 로그 · 컷인. teraUsed 는 이번 배틀에서 썼다는 표시 (메가진화처럼 경고만) */
 function teraSameIf(m){return hasTera(m)&&(m.types||[]).includes(m.teraEn)}
 async function doTera(mid,on){const b=ctx().b;const m=b.mons[mid];if(!m||!hasTera(m))return false;const nb0=snap(),nb=snap(nb0);const x=nb.mons[mid];if(!x)return false;x.teraActive=!!on;if(on)x.teraUsed=true;
  if(!await saveBattle(nb0,nb))return false;
  const ty=String(x.tera||'');const same=on&&teraSameIf(x);
  A().sysLog(on?`【테라스탈】 ${x.name}이(가) 테라스탈했다! → 「${ty}」 타입\n받는 상성은 「${ty}」 하나로 · 원래 타입(${(x.types||[]).filter(t=>t&&t!=='-').map(t=>S().typeKo(t)).join('/')||'-'})과 「${ty}」 기술 모두 자속${same?' · 같은 타입이라 「'+ty+'」 기술은 자속 2배(적응력)':''} · 교대해도 풀리지 않는다`:`【테라스탈 해제】 ${x.name} — 원래 타입으로 (GM 바로잡기)`,'battle',{mid,img:x.image||''});
  if(on){const col=x.side==='left'?'#1f6fd1':'#e3101f';if(CUT()&&CUT().evo){try{CUT().evo({kind:'form',label:'테라스탈',from:{name:m.name,img:m.image||''},to:{name:x.name+' · '+ty,img:x.image||''},color:col})}catch(e){}}else cutFire('m:'+mid,x.image,`${x.name}의 테라스탈!`,`→ 「${ty}」`,col)}
  return true}
 /* 폼 바꾸기 본체 (창 · 자동 HP 조건 폼체인지 공용) */
 async function doForm(mid,k,why){const b=ctx().b;const m=b.mons[mid];if(!m)return false;const forms=formsOf(m);const o=m.form0||m;const f=forms[k];const nb0=snap(),nb=snap(nb0);const x=nb.mons[mid];if(!x)return false;x.forms=JSON.parse(JSON.stringify(forms));const L=formSet(x,k);if(f&&f.kind==='메가진화')x.megaUsed=true;if(why)x.hpFormDone=1;
   if(!await saveBattle(nb0,nb))return false;A().sysLog(`【${f?f.kind||'폼체인지':'폼 복귀'}】 ${L.join('\n')}${why?'\n('+why+')':''}`,'battle',{mid,img:x.image||''});
   {const col=x.side==='left'?'#1f6fd1':'#e3101f';const kd=!f?'back':f.kind==='메가진화'?'mega':'form';
    if(CUT()&&CUT().evo){try{CUT().evo({kind:kd,label:f?f.kind||'폼체인지':'',from:{name:m.name,img:m.image||''},to:{name:x.name,img:x.image||''},color:col})}catch(e){}}
    else if(f)cutFire('m:'+mid,x.image,`${m.name}의 ${f.kind||'폼체인지'}!`,`→ 「${x.name}」`,col)}
   /* 새 특성의 등장·상시 구문은 바로 */
   const ab=ctx().b.mons[mid];if(f&&ab&&ab.ability&&ab.ability!==o.ability&&FX()){const a=FX().autoOf(ab,'trait',ab.ability);if(a&&a.ops&&a.ops.length&&!a.manual){const tm=FX().timing(a.text||'');if(tm.entry||tm.passive)await fireAuto(mid,'trait',ab.ability,{quiet:true,noRoll:!!tm.passive})}}
   {const cm=ctx().b.mons[mid];if(cm&&FX())for(const n of (cm.formNewPots||[])){const a=FX().autoOf(cm,'pot',n);if(!a||!a.ops||!a.ops.length||a.manual)continue;const tm=FX().timing(a.text||'');if(tm.entry||tm.passive)await fireAuto(mid,'pot',n,{quiet:true,noRoll:!!tm.passive})}}return true}
 /* HP 조건 폼체인지 (10-26 망령): 폼 조건 글이 「HP : 1/2 이하」 꼴이면 HP 가 그만큼 내려갔을 때 자동으로 (한 배틀에 한 번) */
 let hpFormBusy=false;
 async function hpFormWatch(){const c=ctx();const b=c.b;if(!c.mgr||!b.started||hpFormBusy)return;if(!isLeader(c))return;hpFormBusy=true;try{for(const m of Object.values(b.mons||{})){if(!m.entry||m.hp.cur<=0||m.hpFormDone||m.form0)continue;const fs=formsOf(m);
   for(let k=0;k<fs.length;k++){const f=fs[k];const r=String((f&&f.cond)||'').match(/「HP\s*:\s*(\d+)\s*\/\s*(\d+)\s*이하」/);if(!r||f.kind==='메가진화')continue;if(m.hp.cur<=Math.floor(m.hp.max*+r[1]/+r[2])){await doForm(m.id,k,`「HP : ${r[1]}/${r[2]} 이하」 — 자동`);break}}}}finally{hpFormBusy=false}}
 function openEdit(mid){const c=ctx();const b=c.b;const m=b.mons[mid];if(!m||!canEdit(c,m))return;
  const sdb=DB().states||{st:{},groups:[]};const items=Object.keys(DB().items||{});
  const md=A().openModal(`<div class="mhead"><h2>${esc(m.name)} <span class="small dim">랭크·상태·소지품</span></h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   ${FX()?`<div class="card" style="margin-top:0;padding:6px 10px"><div class="sec">자동화 <span class="note">포텐셜·특성·소지품의 구문 — 「발동」은 카드에서</span></div><div class="row" style="flex-wrap:wrap;gap:4px">${[...(m.pots||[]).filter(p=>p&&p.name&&!p.ph).map(p=>['pot',p.name,p.eff]),...(m.excl?[['pot',m.excl.name,m.excl.eff]]:[]),...(m.exclX||[]).map(p=>['pot',p.name,p.eff]),...(m.ability?[['trait',m.ability,m.abilityEff]]:[]),...(m.item?[['item',m.item,m.itemEff]]:[])].map(([k,n,t])=>{const own=(m.auto||{})[n];const base=FX().autoOf(Object.assign({},m,{auto:{}}),k,n);const has=own&&own.ops&&own.ops.length;const rmHas=base&&base.ops&&base.ops.length&&!base.manual;return `<button class="btn xs ${has?'pri':rmHas?'':'ghost'}" data-fxed="${k}" data-name="${esc(n)}" data-text="${esc(t||'')}">${k==='trait'?'특성 ':k==='item'?'소지품 ':''}${esc(n)} ${has?'✓':rmHas?'(자동)':''}</button>`}).join('')||'<span class="small dim">없음</span>'}</div></div>`:''}
   <div class="row" style="margin-bottom:8px"><b>HP</b> <input type="number" id="ehp" value="${m.hp.cur}" style="width:90px"> / ${m.hp.max} <button class="btn sm" id="ehpfull">전부 회복</button><span class="sp"></span><label><input type="checkbox" id="etera" ${m.teraActive?'checked':''}> 테라스탈 ${esc(m.tera)}</label></div>
   <div class="rankgrid">${Object.keys(STAT_KO).map(k=>`<div class="rkrow"><span>${STAT_KO[k]}</span><button class="btn xs" data-rk="${k}" data-d="-1">−</button><b class="mono" id="rk_${k}">${(+m.rank[k]||0)>0?'+':''}${+m.rank[k]||0}</b><button class="btn xs" data-rk="${k}" data-d="1">＋</button>
     <input type="text" class="n" data-mod="${k}" value="${(m.mod||{})[k]!=null&&(m.mod||{})[k]!==1?(m.mod||{})[k]:''}" placeholder="×1" title="배율(mod)"></div>`).join('')}</div>
   <div class="row small" style="margin:6px 0"><label><input type="checkbox" id="etemp"> 이번 변경을 임시 랭크로 (턴 종료 때 해제)</label><button class="btn xs ghost" id="erk0">랭크 전부 0</button></div>
   <div class="row" style="margin:8px 0"><b>소지품</b> <input type="text" id="eitem" list="itemlist" value="${esc(m.item||'')}" style="flex:1"><button class="btn sm" id="eitemdb" type="button">DB</button><datalist id="itemlist">${items.map(i=>`<option value="${esc(i)}">`).join('')}</datalist>
    ${c.mgr?`<b>레이드</b> <input type="number" class="n" id="eraid" value="${(m.raid&&m.raid.segments)||''}" placeholder="구간 X" title="최대 HP 를 X 등분한 자리마다 배리어"><span class="small dim">${m.raid&&m.raid.segments?`페이즈 ${m.raid.phase||1} · 깨짐 ${m.raid.broken||0}${raidFloor(m)?' · 다음 배리어 '+raidFloor(m):''}${m.raid.brk?' · 이번 턴 깨짐':''}`:''}</span>${m.raid&&m.raid.segments?'<button class="btn xs ghost" type="button" id="eraidpc" title="「트리거 : 페이즈 체인지」를 지금 발동 (자신의 부정적인 상태 · 적진 능력치 상승 초기화)">페이즈 체인지</button>':''}`:''}</div>
   <div class="sec" style="margin-top:10px">걸린 상태</div><div class="ston" id="ston"></div><div class="row" style="margin-top:8px"><b>눌러서 걸기</b><input type="text" id="stq" placeholder="상태 검색 (이름·설명)" style="flex:1"></div>
   <div class="stgroups" id="stgroups">${(sdb.groups||[]).map(g=>`<div class="stg" data-stg><div class="stgl">${esc(g.l)}</div>${g.s.map(k=>{const d=sdb.st[k]||{ko:k};const v=(m.states||{})[k];const im=simg(k);return `<label class="stt ${v?'on':''} ${d.abn?'abn':''}" data-stq="${esc((d.ko+' '+k+' '+(d.desc||[]).join(' ')).toLowerCase())}" title="${esc((d.desc||[]).join(' '))}"><input type="checkbox" data-st="${k}" ${v?'checked':''}>${im?`<img src="${esc(im)}" alt="">`:`<span class="sti0">${esc(String(d.ko||k).slice(0,1))}</span>`}<span class="stn">${esc(d.ko)}</span>${d.prog==='turn'||d.prog==='move'?`<input type="number" class="n xs" data-stc="${k}" value="${v&&v<1000?v:(d.min<1000?d.min:'')}" placeholder="T">`:''}</label>`}).join('')}</div>`).join('')}</div>
   <div class="row afoot"><span class="sp"></span><button class="btn pri" id="esave">적용</button></div>`);
  {const pc=$('#eraidpc',md);if(pc)pc.onclick=async()=>{A().closeModal();await raidPhaseNow(mid,'수동 발동')}}
  const rank=Object.assign({},m.rank);const delta={};
  md.querySelectorAll('[data-rk]').forEach(bt=>bt.onclick=()=>{const k=bt.dataset.rk;const lim=k==='critical'?4:6;const p0=+rank[k]||0;rank[k]=Math.max(-lim,Math.min(lim,p0+(+bt.dataset.d)));delta[k]=(delta[k]||0)+(rank[k]-p0);$('#rk_'+k,md).textContent=(rank[k]>0?'+':'')+rank[k]});
  $('#erk0',md).onclick=()=>{for(const k in STAT_KO){rank[k]=0;$('#rk_'+k,md).textContent='0'}};
  md.querySelectorAll('[data-fxed]').forEach(bt=>bt.onclick=()=>{A().closeModal();window.OM_FX_UI.openEditor({mon:ctx().b.mons[mid],kind:bt.dataset.fxed,name:bt.dataset.name,text:bt.dataset.text,save:async auto=>{const cur=Object.assign({},(ctx().b.mons[mid]||{}).auto||{});if(auto)cur[bt.dataset.name]=auto;else delete cur[bt.dataset.name];await A().set(['battle','mons',mid,'auto'],cur);const rm=(A().ST.state.roster||{}).mons||{};if(rm[mid])await A().set(['roster','mons',mid,'auto'],cur);A().toast(auto?'구문을 저장했다':'구문을 지웠다')}})});
  $('#ehpfull',md).onclick=()=>{$('#ehp',md).value=m.hp.max};
  const updOn=()=>{const L=[...md.querySelectorAll('[data-st]:checked')].map(cb=>cb.dataset.st);md.querySelectorAll('[data-st]').forEach(cb=>cb.closest('.stt').classList.toggle('on',cb.checked));
   $('#ston',md).innerHTML=L.length?L.map(k=>{const d=sdb.st[k]||{ko:k};const im=simg(k);const ci=md.querySelector(`[data-stc="${k}"]`);const v=ci?(ci.value===''?'':+ci.value):null;
    return `<span class="stchip ${d.abn?'abn':''}" data-stinfo="${esc(k)}" title="${esc((d.desc||[]).join(' '))}">${im?`<img src="${esc(im)}" alt="">`:''}${esc(d.ko)}${ci?`<span class="stcnt"><b data-sd="${k}" data-d="-1">−</b><i>${v===''||v>=1000?'계속':v}</i><b data-sd="${k}" data-d="1">+</b></span>`:''}<b class="stx" data-soff="${k}" title="풀기">✕</b></span>`}).join(''):'<span class="small dim">없음</span>';
   md.querySelectorAll('[data-soff]').forEach(x=>x.onclick=()=>{const cb=md.querySelector(`[data-st="${x.dataset.soff}"]`);if(cb){cb.checked=false;updOn()}});
   md.querySelectorAll('[data-sd]').forEach(x=>x.onclick=()=>{const ci=md.querySelector(`[data-stc="${x.dataset.sd}"]`);if(!ci)return;ci.value=Math.max(1,Math.min(999,(+ci.value||0)+(+x.dataset.d)));updOn()})};
  md.querySelectorAll('[data-st],[data-stc]').forEach(cb=>cb.addEventListener('input',updOn));updOn();
  const stq=$('#stq',md);if(stq){stq.oninput=()=>{const q=stq.value.trim().toLowerCase();md.querySelectorAll('.stt').forEach(l=>{l.style.display=!q||l.dataset.stq.includes(q)||l.classList.contains('on')?'':'none'});md.querySelectorAll('[data-stg]').forEach(g=>{g.style.display=[...g.querySelectorAll('.stt')].some(l=>l.style.display!=='none')?'':'none'})};setTimeout(()=>stq.focus(),50)}
  $('#eitemdb',md).onclick=()=>{window.OM_DB_UI.open({kind:'item',sel:$('#eitem',md).value,pick:async name=>{const it=(DB().items||{})[name]||{};await A().set(['battle','mons',mid,'item'],name);await A().set(['battle','mons',mid,'itemEff'],String(it.eff||''));openEdit(mid)}})};
  /* 10-23 망령: 저장 중에 화면이 m(살아 있는 상태 객체)을 새 값으로 먼저 바꿔 놓아서(낙관적 반영) 「바뀐 것」 로그가 비던 것 — 누를 때의 사본과 비교한다 */
  const snapM=()=>JSON.parse(JSON.stringify((ctx().b.mons||{})[mid]||m));
  $('#esave',md).onclick=async()=>{const m=snapM();const nm=JSON.parse(JSON.stringify(m));nm.hp.cur=Math.max(0,Math.min(m.hp.max,+$('#ehp',md).value||0));nm.rank=rank;nm.teraActive=$('#etera',md).checked;if(nm.teraActive&&!m.teraActive)nm.teraUsed=true;nm.item=$('#eitem',md).value.trim();
   nm.mod={};md.querySelectorAll('[data-mod]').forEach(i=>{const v=i.value===''?1:mulOf(i.value,(m.mod||{})[i.dataset.mod]||1);if(v>0&&v!==1)nm.mod[i.dataset.mod]=v});
   /* 손으로 바꾼 배율은 출처 기록에서 떼어 낸다 (나중에 ✕ 로 역으로 나뉘지 않게) */
   if(nm.fx&&nm.fx.mults){nm.fx.mults=nm.fx.mults.map(e=>{const st={};for(const k in e.stats)if((+nm.mod[k]||1)===(+(m.mod||{})[k]||1))st[k]=e.stats[k];return Object.assign({},e,{stats:st})}).filter(e=>Object.keys(e.stats).length)}
   const er=$('#eraid',md);if(er){const X=+er.value||0;if(!X)delete nm.raid;else if(!nm.raid||nm.raid.segments!==X)nm.raid=Object.assign({cure:1,cstat:1,rup:1,rmod:0,cond:'cap'},nm.raid||{},{segments:X,broken:0,phase:1,brk:0})}
   if($('#etemp',md).checked){nm.tempRank=nm.tempRank||{};for(const k in delta)nm.tempRank[k]=(+nm.tempRank[k]||0)+delta[k]}
   nm.states={};md.querySelectorAll('[data-st]').forEach(cb=>{if(!cb.checked)return;const k=cb.dataset.st;const ci=md.querySelector(`[data-stc="${k}"]`);const d=sdb.st[k]||{};nm.states[k]=ci&&ci.value!==''?+ci.value:(+(m.states||{})[k]||(d.min>=1000||!d.min?1000:(+d.max>+d.min&&+d.max<1000?+d.min+Math.floor(Math.random()*(+d.max-+d.min+1)):+d.min)))});if(nm.states.LeechSeed&&!(m.states||{}).LeechSeed){const sf=seedSrc(b,m);if(sf)nm.seedFrom=sf;else delete nm.seedFrom}
   if(nm.hp.cur<=0)nm.entry='';
   A().closeModal();if(await saveMon(m,mid,nm)){const SC=stLog(m,nm,fcMan('랭크·상태 창'));const ch=[];   /* 11-01 망령 「상태 변화도 효과 로그」: 걸리고 풀린 상태는 카드로 — 이 줄에서는 뺀다 */for(const k in STAT_KO){const a=+m.rank[k]||0,b2=+rank[k]||0;if(a!==b2)ch.push(`${STAT_KO[k]} ${a}→${b2>0?'+':''}${b2}`)}
    const sa=Object.keys(m.states||{}).filter(k=>m.states[k]),sb=Object.keys(nm.states);const on=sb.filter(k=>!sa.includes(k)).map(k=>(sdb.st[k]||{}).ko||k),off=sa.filter(k=>!sb.includes(k)).map(k=>(sdb.st[k]||{}).ko||k);
    if(on.length&&!SC)ch.push('+'+on.join(','));if(off.length&&!SC)ch.push('−'+off.join(','));if(nm.hp.cur!==m.hp.cur)ch.push(`HP ${m.hp.cur}→${nm.hp.cur}`);if(!!nm.teraActive!==!!m.teraActive)ch.push(nm.teraActive?`테라스탈 → 「${m.tera}」 타입`:'테라스탈 해제');const itCh=(nm.item||'')!==(m.item||'')?`소지품 ${nm.item||'없음'}`:'';
    const dsc=SC?[]:sb.filter(k=>!sa.includes(k)).map(k=>{const ds=stDesc(k);return ds.length?`「${stName(k)}」 ${ds.join(' ')}`:''}).filter(Boolean);if(ch.length)A().sysLog(`${m.name}: ${ch.join(' · ')}${dsc.length?'\n'+dsc.join('\n'):''}`,'battle',{mid,img:m.image||''});if(itCh&&A().selfLog)A().selfLog(`${m.name}: ${itCh}`)}}}

 /* ---------- 11-01 망령 「필드 · 날씨 · 설치물 전개 때 효과 UI 를 로그에」 ----------
    배틀을 쓸 때(saveBattle · 필드 창 · 설치물 창) 쓰기 전후 필드를 견주어(fieldDiff) 새로 깔리거나 갱신된 날씨 · 필드 · 룸 · 필드의 상태 · 설치물마다
    배틀 로그 한 줄(data.fc)을 남긴다 — 다른 배틀 카드처럼 로그 표로 모두에게 간다. 그리는 건 fieldCard (app.js battleCard 가 부른다), 걷히면 작은 카드.
    글(data.t)은 「【날씨】 비 — 5턴」 + 효과 줄이라 카드를 모르는 곳(로그 저장 · 정리기)에서도 보통 배틀 카드로 읽힌다. 효과 글은 실제 계산 규칙(WEATHER_MUL · field.js HAZ/RM · 공격 창 배율)에서 */
 const FC_KIND={w:'날씨',t:'필드',r:'룸',e:'필드의 상태',o:'설치물'};
 const FC_COL={맑음:'#f08a24',큰가뭄:'#e5531a',비:'#3b8fe0',폭우:'#2a5fd0',모래바람:'#c49a5a',싸라기눈:'#6fc9de',눈:'#9fe3ef',극한:'#58c0e0',짙은안개:'#9aa0b4',밤:'#6a5cc4',깊은밤:'#4b3aa6',별하늘:'#7486ea',난기류:'#6fb7a3',
  그래스필드:'#3fae5a',일렉트릭필드:'#f2c418',미스트필드:'#ef7fb8',사이코필드:'#a65fd6',트릭룸:'#c75fd0',매직룸:'#4f8ad6',원더룸:'#d6894f',블랙룸:'#6d7290',중력:'#7a6fd0',물놀이:'#3fa6d6',흙놀이:'#a07a4a',
  wall:'#4fb3c9',aid:'#5cbf8c',hazA:'#8d877c',hazB:'#8d877c',etc:'#9a8fb0',guard:'#7d93b0',스텔스록:'#a8875a',독압정:'#9a62c0',불바다:'#e0562a'};
 const FC_GLY={wall:'◆',aid:'✦',hazA:'▲',hazB:'▲',etc:'●',guard:'◆'};
 const FC_LAY={압정뿌리기:3,독압정:2};
 const fcEnd=x=>x.k==='o'&&/^haz/.test(objCat(x.n)[0])?'철거':'끝';   /* 설치기는 「철거」, 벽 · 날씨 · 룸은 「끝」 */
 function fcDur(x){if(x.end)return '끝';if(x.k==='o'&&FC_LAY[x.n])return (+x.c||1)+'겹';return (!+x.c||+x.c>=1000)?'계속':(+x.c)+'턴'}
 function fcInfo(x,b){const n=x.n,L=[];let note='',EXL=[];const tk=t=>S().typeKo(t);const ws=mode(b||{})>=2?0.67:0.5;
  if(x.k==='w'){const M=WEATHER_MUL[n]||{};const up=Object.keys(M).filter(t=>M[t]>1);if(up.length)L.push(`${up.map(tk).join(' · ')} 기술 ×${M[up[0]]}`);for(const t of Object.keys(M).filter(t=>M[t]<1))L.push(M[t]?`${tk(t)} 기술 ×${M[t]}`:`${tk(t)} 기술 무효 (×0)`);
   /* 11-01 망령 「맵툴 캠페인 읽고 날씨 부가 효과」: print_effect_weather 의 줄을 옮김 (싸라기눈 · 깊은밤 배율 · 짙은안개 0.9 는 웹툴 결정 유지) */
   if(n==='맑음'||n==='큰가뭄')L.push('「얼음」 상태가 되지 않는다');
   if(n==='밤'||n==='깊은밤')L.push('고스트 · 악 타입은 「잠듦」 상태가 되지 않는다');if(n==='깊은밤')L.push('「명중 : 90」 이하인 기술은 무효');
   if(n==='모래바람')L.push('바위 타입 특방 ×1.5','턴 끝 1/16 대미지 (바위 · 땅 · 강철 · 방진고글 제외)');
   if(n==='극한')L.push('얼음 타입 방어 ×2','물 기술이 얼음 기술이 된다','「얼음」 상태 내성이 무효');
   if(['눈','싸라기눈'].includes(n))L.push('얼음 타입 방어 ×1.5');if(n==='싸라기눈')L.push('턴 끝 대미지 없음');
   if(n==='짙은안개')L.push('명중 ×0.9 (독 · 페어리 타입 포켓몬은 영향 없음)');if(n==='별하늘')L.push('명중 ×1.1');
   if(n==='난기류')L.push('비행 타입의 약점을 없앤다 (상성 2배 → 1배)');
   if(['큰가뭄','폭우','난기류','극한','깊은밤'].includes(n))note='특성이 부르는 날씨 — 부른 포켓몬이 필드 위에 있는 한 · 상위 날씨나 「삼천세계」로만 덮어쓴다';
   EXL=wxLinks(b,n)}
  else if(x.k==='t'){note='땅 위 포켓몬에게만';L.push(...(({그래스필드:['풀 기술 ×1.3','턴 끝 HP 1/16 회복'],일렉트릭필드:['전기 기술 ×1.3','「잠듦」 · 「하품」에 걸리지 않는다'],미스트필드:['받는 드래곤 기술 ×0.5','상태 이상 · 「혼란」에 걸리지 않는다'],사이코필드:['에스퍼 기술 ×1.3','상대의 선공기(우선도 +1 이상)를 받지 않는다']})[n]||[]))}
  else if(x.k==='r'||x.k==='e')L.push(...(({트릭룸:['스피드가 느린 포켓몬부터 행동'],매직룸:['소지품 효과 없음'],원더룸:['방어 ↔ 특방 실수치를 바꾼다'],블랙룸:['공격 기술이 모두 고스트 타입'],중력:['명중 ×1.67','하늘에 떠오를 수 없다'],물놀이:['불꽃 기술 위력 ×0.5'],흙놀이:['전기 기술 위력 ×0.5']})[n]||[]));
  else{const FD=window.OM_FIELD||{};const H=(FD.HAZ||[]).find(h=>h.k===n);const R=(FD.RM||{})[n];
   const W=({리플렉터:[`받는 물리기 대미지 ×${ws}`,'급소면 무시'],빛의장막:[`받는 특수기 대미지 ×${ws}`,'급소면 무시'],오로라베일:[`받는 기술 대미지 ×${ws}`,'급소면 무시'],얼음의장벽:[`받는 기술 대미지 ×${ws}`,'불꽃 기술을 맞으면 녹아 철거'],신비의부적:['다른 포켓몬이 거는 상태 이상 · 「혼란」을 막는다'],흰안개:['능력 감소를 막는다'],주술:['급소에 맞지 않는다'],검은숲:['랭크 변화가 ±0'],
    순풍:['스피드 ×2'],습원:['스피드 ×0.25'],불바다:['턴 끝 1/8 대미지 (불꽃 타입 제외)'],돌격:['「공격」 ×2'],신기루:['받는 물리기 명중률 반감'],희망사항:['다음 턴 끝에 HP 1/2 회복'],와이드가드:['이번 턴 전체기를 막는다']})[n];
   if(W)L.push(...W);
   else if(H){const lay=Math.max(1,+x.c||1);
    if(H.kind==='spike')L.push(`등장 때 HP 1/${10-2*Math.min(3,lay)} 대미지`,'1겹 1/8 → 2겹 1/6 → 3겹 1/4');
    else if(H.kind==='tspike')L.push(`등장 때 「${lay>=2?'맹독':'독'}」 (1겹 독 → 2겹 맹독)`,'독 · 강철 타입 · 이미 상태 이상이면 영향 없음');
    else if(H.kind==='net')L.push('등장 때 스피드 −1');
    else if(H.kind==='mine')L.push('등장 때 「마비」 · 한 번 쓰면 사라진다');
    else if(H.kind==='bounce')L.push('등장하면 강제 교대 · 한 번 쓰면 사라진다');
    else if(H.kind==='rose')L.push('등장 때 HP 1/8 드레인 — 같은 에리어 상대가 회복');
    else if(H.kind==='iceburn')L.push('등장한 포켓몬의 첫 기술 「우선도 : -1」');
    else if(H.ty)L.push(`등장 때 ${tk(H.ty)} 상성 × 1/8 대미지`);
    else if(H.st)L.push(`등장 때 「${((((DB().states||{}).st||{})[H.st])||{}).ko||H.st}」 상태로`);
    else if(H.f)L.push(`등장 때 HP 1/${H.f} 대미지${H.once?' · 한 번 쓰면 사라진다':''}`);
    if(R)L.push(`${R.g?'땅 위의 ':''}${R.t.map(tk).join(' · ')} 타입이 등장하면 철거`);
    note=(H.c==='A'?'땅 위 포켓몬만':'모든 포켓몬')+' · 통굽부츠면 영향 없음'}
   else note=objCat(n)[1]||''}
  /* 규칙 표에 없는 것은 기술 DB 효과 글을 줄여서 */
  if(!L.length){const e=String((((DB().moves||{})[n])||{}).eff||'').replace(/「(?:우선도|설치기)[^」]*」[^.]*\.\s*/g,'').replace(/\s*「[^」]+」\s*기술\.\s*$/,'').trim();if(e&&e!=='-')L.push(e.length>90?e.slice(0,88)+'…':e)}
  return {L:[...L.slice(0,4),...EXL],note}}
 /* 11-01 망령 「날씨 효과 위력만 있고 부가 효과가 없다」: 이 배틀에 나온 포켓몬의 기술 · 특성 · 포텐셜 중 이 날씨를 따르는 것을 카드에 덧붙인다.
    기술 글의 「날씨 : X, Y」일 때 … 문장을 읽어 필중 · 명중 N · 차지 없이 · 위력 반감 · 회복 ↑↓ 로 묶고, 그 밖은 이름만. 눈 ↔ 싸라기눈은 같은 것으로 본다 (spMulOf 와 같게) */
 const wxSame=(x,W)=>x===W||(x==='눈'&&W==='싸라기눈')||(x==='싸라기눈'&&W==='눈');
 const wxIn=(s,W)=>{const re=/「날씨\s*:\s*([^」]+)」/g;let r;while((r=re.exec(s)))if(r[1].split(/[,，/]\s*/).some(x=>wxSame(x.trim(),W)))return true;return false};
 function wxLinks(b,W){if(!W||!b||!b.mons)return [];const G=new Map(),add=(k,v)=>{if(!G.has(k))G.set(k,[]);const a=G.get(k);if(!a.includes(v))a.push(v)};
  for(const m of Object.values(b.mons)){if(!m||!m.name)continue;const who=String(m.name);
   for(const mv of (m.moves||[])){if(!mv||!mv.name)continue;const e=String(mv.eff||'');const nm=`${who} 「${mv.name}」`;
    for(const sen of e.split(/(?<=\.)\s*/)){if(!wxIn(sen,W)){if(/「날씨」(?:가 전개되어 있을 때|와 같은)/.test(sen))add('날씨 연동',nm);continue}
     const ac=sen.match(/「명중\s*:\s*(\d+)」/);
     if(/「필중기」/.test(sen))add('필중',nm);else if(ac)add('명중 '+ac[1],nm);else if(/「차지」를 생략/.test(sen))add('차지 없이 바로',nm);else if(/위력을 반감/.test(sen))add('위력 반감',nm);
     else if(/회복량이 강화\(([^)]*)\)/.test(sen))add('회복 '+sen.match(/회복량이 강화\(([^)]*)\)/)[1],nm);else if(/회복량이 저하\(([^)]*)\)/.test(sen))add('회복 '+sen.match(/회복량이 저하\(([^)]*)\)/)[1],nm);else add('효과',nm)}}
   for(const [an,ae] of [[m.ability,m.abilityEff],...potSrc(m).map(p=>[p.name,p.eff])]){if(an&&wxIn(String(ae||''),W))add('특성 · 포텐셜',`${who} 「${an}」`)}}
  const ORD=['필중','명중 50','차지 없이 바로','위력 반감','특성 · 포텐셜'];const ks=[...G.keys()].sort((a,c)=>(ORD.indexOf(a)+1||9)-(ORD.indexOf(c)+1||9));
  return ks.map(k=>{const v=G.get(k);return `이 배틀 · ${k}: ${v.slice(0,4).join(' · ')}${v.length>4?` 외 ${v.length-4}`:''}`}).slice(0,6)}
 /* 앞(a) 뒤(z) 필드 → [{k:w|t|r|e|o, n, c(턴 · 겹), side, prev(바뀐 날씨 · 필드), re(갱신), end(걷힘)}] — 턴 종료에 줄기만 한 것은 넣지 않는다 */
 function fieldDiff(a,z){const F0=fieldOf({field:a}),F1=fieldOf({field:z});const out=[];
  for(const [k,g] of [['w','weather'],['t','terrain']]){const p=F0[g]||{},q=F1[g]||{};const c0=+p.count||0,c1=+q.count||0;
   if(q.type&&(q.type!==p.type||c1>c0))out.push({k,n:q.type,c:c1,prev:q.type!==p.type?p.type||'':'',re:q.type===p.type?1:0});
   else if(p.type&&!q.type)out.push({k,n:p.type,end:1})}
  const cmp=(k,o0,o1,side)=>{o0=o0||{};o1=o1||{};for(const n of new Set([...Object.keys(o0),...Object.keys(o1)])){const v0=+o0[n]||0,v1=+o1[n]||0;const sd=side?{side}:{};
   if(v1>0&&v1>v0)out.push(Object.assign({k,n,c:v1,re:v0>0?1:0},sd));else if(v0>0&&v1<=0)out.push(Object.assign({k,n,end:1},sd))}};
  cmp('r',F0.rooms,F1.rooms);cmp('e',F0.etc,F1.etc);for(const s of SIDES)cmp('o',(F0.objects||{})[s],(F1.objects||{})[s],s);
  return out}
 /* by = {n: 누가, s: 무엇으로(기술 · 특성 …), img}. ms 뒤에 남긴다 (saveBattle 은 부른 쪽의 【특성】 · 【전달】 카드가 먼저 오르게). 돌려줌: 카드 수 */
 function fieldLog(a,z,by,b,ms){const D=fieldDiff(a,z);if(!D.length)return 0;const B0=b||ctx().b;
  const rows=D.map(x=>{const I=x.end?{L:[],note:''}:fcInfo(x,B0);const col=FC_COL[x.n]||(x.k==='o'?FC_COL[objCat(x.n)[0]]:'')||'#777';const who=by&&by.n&&!x.end?by:null;
   const fc=Object.assign({},x,{L:I.L,note:I.note,col},who?{by:{n:String(who.n),s:String(who.s||''),img:String(who.img||'')}}:{});const head=`【${FC_KIND[x.k]}】 ${x.side?SIDE_KO[x.side]+' ':''}${x.n} — ${x.end?fcEnd(x):fcDur(x)}`;
   return [x.end?head:[head,...(x.prev?[`「${x.prev}」에서 바뀜`]:[]),...I.L,...(who?[`전개: ${who.n}${who.s?' 『'+who.s+'』':''}`]:[])].join('\n'),fc]});
  setTimeout(async()=>{for(const [t,fc] of rows)await A().sysLog(t,'battle',{fc})},ms||0);return rows.length}
 /* 로그 카드: 왼쪽 그림(날씨 · 필드 · 룸 그림, 설치물은 색 칸 + 기호) · 이름 · 남은 턴(압정 · 독압정은 겹 점) · 효과 줄 · 전개한 쪽 */
 function fieldCard(d){const x=d&&d.fc;if(!x||!x.n)return '';const col=/^#[0-9a-f]{6}$/i.test(String(x.col||''))?x.col:'#777777';const lum=(i=>[1,3,5].map(j=>parseInt(col.substr(j,2),16)/255).reduce((a,v,j)=>a+v*[.299,.587,.114][j],0))();const tf=lum>.62?'#111':'#fff';   /* 밝은 색(눈 · 일렉트릭필드)은 꼬리표 글자를 검게 */const k=FC_KIND[x.k]?x.k:'t';const side=SIDES.includes(x.side)?x.side:'';
  const im=k==='w'?fimg(W_IMG[x.n]):k==='o'?'':fimg(T_IMG[x.n]);const th=`<span class="fcth${im?'':' gly'}"${im?` style="background-image:url('${cssu(im)}')"`:''}>${im?'':`<i>${esc(FC_GLY[k==='o'?objCat(x.n)[0]:'etc']||'◆')}</i>`}</span>`;
  const head=`<span class="bctag">${esc(FC_KIND[k])}</span>${side?`<span class="fcside ${side}">${esc(SIDE_KO[side])}</span>`:''}<b>${esc(x.n)}</b>`;
  if(x.end)return `<div class="bcard fcard end" style="--tc:${col};--tf:${tf}">${th}<div class="fcm"><div class="fch">${head}<span class="sp"></span><span class="fcend">${fcEnd({k,n:x.n})}</span></div></div></div>`;
  const c=Math.max(0,Math.min(9999,+x.c||0)),mx=k==='o'?(FC_LAY[x.n]||0):0;
  const dur=mx?`<span class="fcd lay" title="${Math.max(1,c)}겹">${Array.from({length:mx},(_,i)=>`<i class="${i<Math.max(1,c)?'on':''}"></i>`).join('')}<small>${Math.max(1,c)}겹</small></span>`:`<span class="fcd">${esc(fcDur({k,n:x.n,c}))}</span>`;
  const sub=[x.re?(mx?'겹 추가':'갱신'):'',x.prev?`「${x.prev}」에서 바뀜`:'',x.note||''].filter(Boolean).map(String);const L=(Array.isArray(x.L)?x.L:[]).map(String);
  const by=x.by&&x.by.n?`<div class="fcby"><span class="fcbl">전개</span>${x.by.img?`<span class="fcbav" style="background-image:url('${cssu(x.by.img)}')"></span>`:''}<span>${esc(x.by.n)}${x.by.s?` 『${esc(x.by.s)}』`:''}</span></div>`:'';
  return `<div class="bcard fcard" style="--tc:${col};--tf:${tf}">${th}<div class="fcm"><div class="fch">${head}<span class="sp"></span>${dur}</div>${sub.length?`<div class="fcsub">${sub.map(esc).join(' · ')}</div>`:''}${L.length?`<div class="fcl">${L.map(l=>`<div>${esc(l)}</div>`).join('')}</div>`:''}${by}</div></div>`}

 /* ---------- 11-01 망령 「상태 변화도 효과 로그」 ----------
    필드 전개 카드(fieldLog)와 같은 길: 쓰기 전후 포켓몬의 states 를 견주어(stDiff) 새로 걸린 상태마다 카드 한 장(data.sc)을 배틀 로그에, 풀리면 작은 「풀림」 카드.
    한 번의 쓰기에서 한 포켓몬에게 여럿이 걸리면 한 장에 줄로 모은다. 숨김 상태(DB hidden) · DB 에 없는 내부 상태는 넣지 않고, 쓰러짐 · 필드를 떠나며 풀린 것 · 한 번짜리(풀죽음 등) 풀림은 적지 않는다.
    글(data.t)에는 설명을 넣지 않는다 — 효과음 자동(rp_ui)이 「풀이 죽어 …」 같은 설명 글에 반응하지 않게. 설명은 카드(statusCard)에서 상태 DB desc 로 */
 const ST_COL={Burn:'#e0562a',Poison:'#9a62c0',Toxic:'#7b3fa8',Paralysis:'#e2b81c',Freeze:'#5fc4e0',Sleep:'#7a86c0',Comatose:'#7a86c0'};
 const STG_COL={'상태 이상':'#c8362b','피해 증가':'#e07a2a','자신':'#3f9f8a','행동 방해':'#d68a4f','멘탈 효과':'#d65fa0','교대 관련':'#5f86b8','비례 대미지':'#8a5a9a','기술 타입 변화':'#4f8ad6','지연 발생':'#8a8f5a','필중':'#c0a03a','미래예지':'#6a5cc4','내성 변화':'#6f8fa8'};
 function stMeta(k){const D=DB().states||{};const d=(D.st||{})[k];if(!d||(D.hidden||[]).includes(k))return null;const g=((D.groups||[]).find(x=>(x.s||[]).includes(k))||{}).l||'';return {k,ko:d.ko||k,abn:!!d.abn,g,prog:d.prog||'',col:ST_COL[k]||STG_COL[g]||'#6f8fa8'}}
 /* 앞(m0) 뒤(m1) 한 포켓몬 → {add:[{k,ko,g,abn,c}], off:[{k,ko}]} */
 function stDiff(m0,m1){const out={add:[],off:[]};if(!m0||!m1)return out;const a=m0.states||{},z=m1.states||{};const dead=!(m1.hp&&m1.hp.cur>0),left=!!m0.entry&&!m1.entry;
  for(const k in z){if(!z[k]||a[k]||dead)continue;const x=stMeta(k);if(x)out.add.push(Object.assign(x,{c:+z[k]||0}))}
  for(const k in a){if(!a[k]||z[k]||dead||left)continue;const x=stMeta(k);if(x&&x.prog!=='once')out.off.push(x)}
  return out}
 /* 카드 줄 만들기 — 돌려줌: [글, data.sc] 또는 null */
 function stRow(m0,m1,by){const D=stDiff(m0,m1);if(!D.add.length&&!D.off.length)return null;fixStDesc();const S0=(DB().states||{}).st||{};const one=D.add.length===1;
  const add=D.add.map(x=>({k:x.k,ko:x.ko,g:x.g,abn:x.abn?1:0,c:x.c,col:x.col,L:(S0[x.k].desc||[]).map(t=>String(t).replace(/<[^>]+>/g,'').trim()).filter(Boolean).slice(0,one?3:1).map(t=>t.length>80?t.slice(0,78)+'…':t)}));
  const off=D.off.map(x=>({k:x.k,ko:x.ko}));const who=by&&by.n&&add.length?{n:String(by.n),s:String(by.s||''),img:String(by.img||'')}:null;
  const tag=add.length?(add.some(x=>x.abn)?'상태 이상':'상태 변화'):'상태 회복';const at=m1.entry?`${SIDE_KO[m1.side]||''} ${String(m1.entry).toUpperCase()}`.trim():'';
  const sc={mid:m1.id||'',n:m1.name||'',img:m1.image||'',side:m1.side||'',at,add,off,col:add.length?add[0].col:'#6f8fa8'};if(who)sc.by=who;
  const dur=c=>(!c||c>=1000)?'계속':c+'턴';
  const t=[`【${tag}】 ${m1.name}${at?' ('+at+')':''}`,...add.map(x=>`「${x.ko}」 ${x.g||''}${x.g?' · ':''}${dur(x.c)}`),...(off.length?[`${off.map(x=>'「'+x.ko+'」').join(' ')} 풀림`]:[]),...(who?[`원인: ${who.n}${who.s?' 『'+who.s+'』':''}`]:[])].join('\n');
  return [t,sc]}
 /* 한 포켓몬 (상세 창 · 랭크·상태 창) */
 function stLog(m0,m1,by,ms){const r=stRow(m0,m1,by);if(!r)return 0;setTimeout(()=>A().sysLog(r[0],'battle',{sc:r[1]}),ms||0);return 1}
 /* 배틀 전체 (saveBattle) — 포켓몬마다 한 장 */
 function stLogAll(b0,b1,by,ms){const M0=(b0||{}).mons||{},M1=(b1||{}).mons||{};const rows=[];for(const id in M1){const r=stRow(M0[id],M1[id],by);if(r)rows.push(r)}if(!rows.length)return 0;
  setTimeout(async()=>{for(const [t,sc] of rows)await A().sysLog(t,'battle',{sc})},ms||0);return rows.length}
 function statusCard(d){const x=d&&d.sc;if(!x||!x.n)return '';const hex=v=>/^#[0-9a-f]{6}$/i.test(String(v||''))?v:'#6f8fa8';const col=hex(x.col);const tf=[1,3,5].map(j=>parseInt(col.substr(j,2),16)/255).reduce((a,v,j)=>a+v*[.299,.587,.114][j],0)>.62?'#111':'#fff';const add=Array.isArray(x.add)?x.add:[],off=Array.isArray(x.off)?x.off:[];
  const side=SIDES.includes(x.side)?x.side:'';const ic=k=>{const u=simg(k);return `<span class="scic"${u?` style="background-image:url('${cssu(u)}')"`:''}></span>`};
  const head=`${x.img?`<span class="bcav" style="background-image:url('${cssu(x.img)}')"></span>`:''}<span class="bctag">${esc(add.length?(add.some(a=>a.abn)?'상태 이상':'상태 변화'):'상태 회복')}</span><b>${esc(x.n)}</b>${x.at?`<span class="fcside ${side}">${esc(x.at)}</span>`:''}`;
  const offL=off.length?`<div class="scoff">${add.length?'<span class="scofl">풀림</span>':''}${off.map(o=>`<span class="scoffi">${ic(o.k)}<s>${esc(o.ko)}</s></span>`).join('')}${add.length?'':'<span class="fcend">풀림</span>'}</div>`:'';
  if(!add.length)return `<div class="bcard scard end" style="--tc:${col};--tf:${tf}"><div class="fch">${head}<span class="sp"></span>${offL}</div></div>`;
  const dur=c=>(!+c||+c>=1000)?'계속':(+c)+'턴';
  const rows=add.map(a=>`<div class="scr" style="--sc:${hex(a.col)}">${ic(a.k)}<div class="scm"><div class="sct"><b>「${esc(a.ko)}」</b>${a.g&&a.g!=='상태 이상'?`<span class="scg">${esc(a.g)}</span>`:''}<span class="sp"></span><span class="fcd">${esc(dur(a.c))}</span></div>${(Array.isArray(a.L)?a.L:[]).map(l=>`<div class="scd">${esc(l)}</div>`).join('')}</div></div>`).join('');
  const by=x.by&&x.by.n?`<div class="fcby"><span class="fcbl">원인</span>${x.by.img?`<span class="fcbav" style="background-image:url('${cssu(x.by.img)}')"></span>`:''}<span>${esc(x.by.n)}${x.by.s?` 『${esc(x.by.s)}』`:''}</span></div>`:'';
  return `<div class="bcard scard" style="--tc:${col};--tf:${tf}"><div class="fch">${head}</div><div class="scb">${rows}</div>${off.length?`<div class="scfoot">${offL}</div>`:''}${by}</div>`}

 /* ---------- 필드 (GM) ---------- */
 const fcMan=s=>({n:ctx().gm?'GM':(A().ST.name||''),s});   /* 11-01 망령: 창에서 손으로 깐 것 — 전개 카드엔 「GM 『필드 설정』」 · 카드가 하나라도 오르면 예전 한 줄 요약은 남기지 않는다 */
 function openField(){const c=ctx();if(!c.mgr)return;const f=fieldOf(c.b);
  const pic=n=>{const im=fimg(n);return im?`<img src="${esc(im)}" alt="">`:'<span class="fnoimg"></span>'};
  const one=(id,list,imgs,cur,cnt,kind)=>`<div class="row fpick ${kind}" data-fp="${id}">${list.filter(Boolean).map(w=>`<span class="fchip ${kind} ${cur===w?'on':''}" data-fv="${esc(w)}" title="${esc(w)}">${pic(imgs[w])}<b>${esc(w)}</b></span>`).join('')}<span class="fchip none ${cur?'':'on'}" data-fv="" title="없음"><b>없음</b></span></div>
   <div class="row small" style="margin-top:4px"><span class="dim">남은 턴</span><input type="number" class="n" id="${id}c" value="${cnt||''}" placeholder="턴" ${cur?'':'disabled'}><span class="dim">(비우면 계속)</span></div>`;
  const md=A().openModal(`<div class="mhead"><h2>날씨 · 필드 · 룸 · 설치기</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="sec">날씨 <span class="note">하나만 · 누르면 바뀐다</span></div>${one('fw',WEATHER,W_IMG,f.weather.type,f.weather.count,'w')}
   <div class="sec">필드 <span class="note">하나만 · 깔린 필드를 다시 누르면 걷힌다</span></div>${one('ft',TERRAIN,T_IMG,f.terrain.type,f.terrain.count,'t')}
   <div class="sec">룸 · 필드의 상태 <span class="note">여러 개 가능 · 누르면 기본 5턴, 숫자는 남은 턴 (1000 = 계속)</span></div>
   <div class="row" style="flex-wrap:wrap;gap:6px">${[...ROOMS.map(r=>['rooms',r,'r']),...ETC.map(r=>['etc',r,'e'])].map(([g,r,k])=>`<span class="fchip ${k} tog ${(f[g]||{})[r]>0?'on':''}" data-fg="${g}" data-fk="${esc(r)}">${pic(T_IMG[r])}<b>${esc(r)}</b><input type="number" class="n xs" data-fgv="${g}" data-fk="${esc(r)}" value="${(f[g]||{})[r]||''}" placeholder="0"></span>`).join('')}</div>
   <div class="small dim" style="margin-top:8px">설치기는 무대의 「좌측 설치물」「우측 설치물」을 눌러서 놓는다.</div>
   <div class="row" style="margin-top:12px"><button class="btn ghost" id="fclear">전부 걷기</button><span class="sp"></span><button class="btn pri" id="fsave">적용</button></div>`);
  const pickOf=id=>{const on=md.querySelector(`[data-fp="${id}"] .fchip.on`);return on?on.dataset.fv:''};
  /* 10-21 망령: 필드는 갱신할 일이 거의 없다 — 깔린 필드를 다시 누르면 「없음」으로 (날씨는 그대로 바꾸기) */
  md.querySelectorAll('[data-fp]').forEach(g=>g.querySelectorAll('.fchip').forEach(ch=>ch.onclick=()=>{const off=g.dataset.fp==='ft'&&ch.dataset.fv&&ch.classList.contains('on');g.querySelectorAll('.fchip').forEach(x=>x.classList.remove('on'));if(off){ch=g.querySelector('.fchip.none')}ch.classList.add('on');const inp=$('#'+g.dataset.fp+'c',md);inp.disabled=!ch.dataset.fv;if(!ch.dataset.fv)inp.value=''}));
  md.querySelectorAll('.fchip.tog').forEach(ch=>ch.addEventListener('click',e=>{if(e.target.tagName==='INPUT')return;const inp=ch.querySelector('input');if(+inp.value>0){inp.value='';ch.classList.remove('on')}else{inp.value=5;ch.classList.add('on')}}));
  md.querySelectorAll('[data-fgv]').forEach(i=>i.addEventListener('input',()=>i.closest('.fchip').classList.toggle('on',+i.value>0)));
  $('#fclear',md).onclick=()=>{md.querySelectorAll('[data-fp]').forEach(g=>{g.querySelectorAll('.fchip').forEach(x=>x.classList.toggle('on',!x.dataset.fv));const inp=$('#'+g.dataset.fp+'c',md);inp.value='';inp.disabled=true});md.querySelectorAll('.fchip.tog').forEach(ch=>{ch.querySelector('input').value='';ch.classList.remove('on')})};
  $('#fsave',md).onclick=async()=>{const wt=pickOf('fw'),tt=pickOf('ft');const cnt=id=>{const v=$('#'+id+'c',md).value.trim();return +v||0};
   const nf={weather:{type:wt,count:wt?cnt('fw'):0},terrain:{type:tt,count:tt?cnt('ft'):0},rooms:{},etc:{},objects:{}};
   md.querySelectorAll('[data-fgv]').forEach(i=>{if(+i.value>0)nf[i.dataset.fgv][i.dataset.fk]=+i.value});
   nf.objects=JSON.parse(JSON.stringify(f.objects||{left:{},right:{}}));if(f.stage)nf.stage=f.stage;const tl=v=>(v>=1000||!v)?'':' '+v+'T';
   A().closeModal();if(await A().setDiff(['battle','field'],f,nf,2)&&!fieldLog(f,nf,fcMan('필드 설정'),c.b))A().sysLog(`필드 갱신: ${[nf.weather.type&&'날씨 '+nf.weather.type+tl(nf.weather.count),nf.terrain.type&&nf.terrain.type+tl(nf.terrain.count),...Object.entries(nf.rooms).map(([k,v])=>k+tl(v)),...Object.entries(nf.etc).map(([k,v])=>k+tl(v)),...SIDES.flatMap(s=>Object.entries(nf.objects[s]||{}).map(([k,v])=>SIDE_KO[s]+' '+k+tl(v)))].filter(Boolean).join(' · ')||'없음'}`,'battle')}}

 /* 진영별 설치기: 분류별 칩, 누르면 기본 지속으로 놓고, 다시 누르면 치운다. 숫자는 겹/턴 */
 function openObjects(side){const c=ctx();if(!c.mgr)return;const f=fieldOf(c.b);const cur=Object.assign({},(f.objects||{})[side]||{});
  const md=A().openModal(`<div class="mhead"><h2>${SIDE_KO[side]} 설치물</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   ${OBJ_CAT.map(([k,n,dur,desc,list])=>`<div class="sec">${n} <span class="note">${esc(desc)}</span></div><div class="row" style="flex-wrap:wrap;gap:6px">${list.map(o=>`<span class="objchip ${k} ${cur[o]>0?'on':''}" data-oc="${esc(o)}" data-dur="${dur}"><b>${esc(o)}</b><input type="number" class="n xs" data-ov="${esc(o)}" value="${cur[o]>0?cur[o]:''}" placeholder="${dur>=1000?'∞':dur}" title="${o==='압정뿌리기'||o==='독압정'?'겹':'남은 턴 (1000 = 계속)'}"></span>`).join('')}</div>`).join('')}
   <div class="row" style="margin-top:12px"><button class="btn ghost" id="oclear">전부 치우기</button><span class="sp"></span><button class="btn pri" id="osave">적용</button></div>`);
  md.querySelectorAll('[data-oc]').forEach(ch=>ch.addEventListener('click',e=>{if(e.target.tagName==='INPUT')return;const inp=ch.querySelector('input');const o=ch.dataset.oc;if(+inp.value>0){inp.value='';ch.classList.remove('on')}else{inp.value=(o==='압정뿌리기'||o==='독압정')?1:+ch.dataset.dur;ch.classList.add('on')}}));
  md.querySelectorAll('[data-ov]').forEach(i=>i.addEventListener('input',()=>i.closest('.objchip').classList.toggle('on',+i.value>0)));
  $('#oclear',md).onclick=()=>{md.querySelectorAll('[data-ov]').forEach(i=>{i.value='';i.closest('.objchip').classList.remove('on')})};
  $('#osave',md).onclick=async()=>{const n={};md.querySelectorAll('[data-ov]').forEach(i=>{if(+i.value>0)n[i.dataset.ov]=+i.value});A().closeModal();const nf=JSON.parse(JSON.stringify(f));nf.objects=nf.objects||{left:{},right:{}};nf.objects[side]=n;if(await A().setDiff(['battle','field','objects',side],(f.objects||{})[side]||{},n,1)&&!fieldLog(f,nf,fcMan('설치물 설정'),c.b))A().sysLog(`${SIDE_KO[side]} 설치물: ${Object.entries(n).map(([k,v])=>k+(v>=1000?'':' '+v)).join(' · ')||'없음'}`,'battle')}}
 /* ---------- 포텐셜 설정 (지령·명령 + 고유·전용 포텐셜 남은 횟수) ---------- */
 function spCntHtml(tid){const b=ctx().b;const t=b.trainers[tid];const U=uniqList(t);const mons=Object.values(b.mons||{}).filter(m=>m.tid===tid);
  const cell=(x,attrs,sub)=>`<div class="oc2 ${x.max!=null&&x.left<=0?'zero':''}"><div class="nm">『${esc(x.p.name)}』<small>${esc(sub)}</small></div>${x.max!=null?`<span class="step"><button type="button" ${attrs} data-d="-1">−</button><b>${x.left}<small class="dim">/${x.max}${x.per&&x.mmax==null?(x.per==='turn'?' · 이번 턴':' · 탈진'):''}</small></b><button type="button" ${attrs} data-d="1">+</button></span>`:'<span class="small dim">횟수 없음</span>'}</div>`;
  const E=mons.flatMap(m=>specialPots(m).filter(x=>!x.p.unique).map(x=>cell(x,`data-spc="ex" data-mid="${m.id}" data-pn="${esc(x.p.name)}"`,m.name)));
  return `<div class="ogrp"><div class="ogh"><span class="gk uq">UNIQUE</span><b>고유 포텐셜</b><span class="small dim">트레이너</span></div><div class="ogrid">${U.map(x=>cell(x,`data-spc="uq" data-pn="${esc(x.p.name)}"`,'고유')).join('')||'<div class="small dim">고유 포텐셜이 없다.</div>'}</div></div>
   <div class="ogrp"><div class="ogh"><span class="gk ex">EXCLUSIVE</span><b>전용 포텐셜</b><span class="small dim">포켓몬마다</span></div><div class="ogrid">${E.join('')||'<div class="small dim">전용 포텐셜이 없다.</div>'}</div></div>`}
 function openOrders(tid){const c=ctx();if(!c.mgr)return;const t=c.b.trainers[tid];if(!t)return;
  const md=A().openModal(`<div class="mhead"><h2>${esc(t.name)} 포텐셜 설정</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div id="opanel">${OO().panel(t,true)}</div><div id="spcnt">${spCntHtml(tid)}</div><div class="small dim" style="margin-top:6px">바꾸면 바로 저장된다 (배틀 쪽 트레이너·포켓몬만 — 시트는 그대로). 고유·전용은 【N/시】가 적힌 것만 횟수가 있다.</div>
   <div class="row" style="margin-top:12px"><button class="btn xs ghost danger" id="ounload" title="이 트레이너와 포켓몬을 배틀에서 뺀다">배틀에서 빼기</button><span class="sp"></span></div>`);
  $('#ounload',md).onclick=()=>{A().closeModal();A().unloadTrainer(tid)};
  const rebind=()=>OO().bind($('#opanel',md),()=>ctx().b.trainers[tid],async nt=>{await A().setDiff(['battle','trainers',tid],ctx().b.trainers[tid],nt,1);$('#opanel',md).innerHTML=OO().panel(nt,true);rebind()});rebind();
  const spBind=()=>$('#spcnt',md).querySelectorAll('[data-spc]').forEach(bt=>bt.onclick=async()=>{const b=ctx().b;const d=+bt.dataset.d,n=bt.dataset.pn;
   const adj=async(x,uses,upath,tpath)=>{if(!x||x.max==null)return;if(x.mmax!=null){const had=uses[n]==null?x.mmax:+uses[n];const uu=Object.assign({},uses);uu[n]=Math.max(0,Math.min(x.mmax,had+d));await A().set(upath,uu)}
     else if(x.per)await A().set([...tpath,n],d<0?(+b.turn||0):null)};   /* 턴 제한만 있으면: − 는 「이번 턴에 썼다」, ＋ 는 그 표시를 지운다 */
   if(bt.dataset.spc==='uq'){const t2=b.trainers[tid];await adj(uniqList(t2).find(q=>q.p.name===n),t2.uUses||{},['battle','trainers',tid,'uUses'],['battle','trainers',tid,'uTurn'])}
   else{const m=b.mons[bt.dataset.mid];if(!m)return;await adj(specialPots(m).find(q=>q.p.name===n),m.potUses||{},['battle','mons',m.id,'potUses'],['battle','mons',m.id,'potTurn'])}
   $('#spcnt',md).innerHTML=spCntHtml(tid);spBind()});spBind()}
 const F=()=>window.OM_FIELD;const CUT=()=>window.OM_CUTIN;const FX=()=>window.OM_FX;
 /* 매직룸 동안 소지품은 없는 셈 */
 const IT=m=>!m?'':F()&&F().itemOf?F().itemOf(m):(m.item||'');
 const tysOf=m=>(m.teraActive&&m.teraEn&&m.teraEn!=='-')?[m.teraEn]:(m.types||[]).filter(t=>t&&t!=='-');
 const grd=m=>F()&&F().grounded?F().grounded(m):!tysOf(m).includes('Flying');
 /* ---------- 효과 엔진 연결: 포텐셜·특성·소지품의 자동화를 UI(대상 고르기·확인·선택)와 함께 돌린다 ---------- */
 /* 10-24 제보 (킬링 에이스): 진행자 화면에서 상대 포켓몬의 효과를 돌릴 때, 고르기 · 대상 · 조건 확인 창이 진행자에게 떴다.
    그 포켓몬 주인(자리 플레이어 · 없으면 GM)에게 battle.asks[id] 로 물어보고 답(ans)을 기다린다. 2분 안에 답이 없으면 여기서 고른다 */
 const ASKED={};
 function askTo(mon){const c=ctx();if(!mon||canEdit(c,mon))return '';const seats=c.ST.state.seats||{};const tid=mon.tid;
  if(tid&&seats[tid]&&(A().online(tid)||coOf(c,tid).some(s=>A().online(s))))return 'seat:'+tid;if(!c.gm)return 'gm';return ''}
 async function remoteAsk(mon,type,data,local){const to=askTo(mon);if(!to)return local();
  const id='q'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);await A().set(['battle','asks',id],Object.assign({to,type,mid:mon.id,at:Date.now()},data));
  A().toast(`${mon.name} 쪽에 고르기를 맡겼다 — 답을 기다리는 중`);
  const t0=Date.now();while(Date.now()-t0<120000){await new Promise(r=>setTimeout(r,400));const q=((ctx().b.asks||{})[id]);if(q&&q.ans!==undefined){await A().set(['battle','asks',id],null);return q.ans}if(!q)break}
  await A().set(['battle','asks',id],null);A().toast('답이 없어 여기서 고른다');return local()}
 /* 내게 온 물음에 답한다 (watch 에서) */
 async function answerAsks(){const c=ctx();const Q=c.b.asks||{};for(const id in Q){const q=Q[id];if(!q||q.ans!==undefined||ASKED[id])continue;
   const mine=q.to==='gm'?c.gm:(String(q.to).startsWith('seat:')&&lead(c,String(q.to).slice(5)));if(!mine)continue;ASKED[id]=1;
   const m=(c.b.mons||{})[q.mid]||{name:'?'};const U=localUi(c.b,m,q.name||'');let ans;
   try{if(q.type==='choose')ans=await U.choose(q.labels||[],!!q.multi);else if(q.type==='pick'){const list=(q.ids||[]).map(i=>(ctx().b.mons||{})[i]).filter(Boolean);const r=await U.pick(list,q.label||'대상');ans=r?r.id:''}else if(q.type==='confirm')ans=await U.confirm(q.q||'')}catch(e){ans=q.type==='choose'?[]:q.type==='pick'?'':false}
   if(((ctx().b.asks||{})[id]))await A().set(['battle','asks',id,'ans'],ans==null?(q.type==='choose'?[]:''):ans)}}
 function uiCtx(b,self,name,area){const L=localUi(b,self,name,area);const mon=self;
  return Object.assign({},L,{
   pick:(list,label)=>remoteAsk(mon,'pick',{name,label,ids:list.map(m=>m.id)},()=>L.pick(list,label)).then(r=>typeof r==='string'?(r?list.find(m=>m.id===r)||null:null):r),
   confirm:q=>remoteAsk(mon,'confirm',{name,q},()=>L.confirm(q)).then(v=>!!v),
   choose:(labels,multi)=>remoteAsk(mon,'choose',{name,labels,multi:!!multi},()=>L.choose(labels,multi)).then(v=>Array.isArray(v)?v.map(Number):[]),
   freeSwitch:(m,nm)=>{setTimeout(()=>freeSwitchUI(m.id,nm).catch(e=>console.warn(e)),600);return `${m.name} 「${nm}」 — 임의 교대 창을 연다`},
   useMove:(m,mv,nm,o)=>{setTimeout(()=>openAttack(m.id,{mvName:mv,by:nm,baseTop:(o||{}).top||[]}),600)}})}
 /* 11-03 「임의교대」 구문: 벤치에서 골라 같은 자리로 (그 트레이너 · GM 만) */
 async function freeSwitchUI(mid,nm){const c=ctx();const a=c.b.mons[mid];if(!a||!a.entry||a.hp.cur<=0)return;if(!canEdit(c,a)&&!c.mgr){A().sysLog(`${a.name} 「${nm}」 임의 교대할 수 있다 — 그 트레이너가 「퇴장」에서`,'battle');return}
  const bench=Object.values(c.b.mons).filter(x=>x.tid===a.tid&&!x.entry&&!x.pend&&x.hp.cur>0&&x.id!==mid);if(!bench.length){A().sysLog(`${a.name} 교대할 포켓몬이 벤치에 없다`,'battle');return}
  if(!await askYes(`「${nm}」 — ${a.name} 임의 교대할까?`,'교대','그대로'))return;const pk=await uiCtx(c.b,a,nm).pick(bench,'교대해 들어올 포켓몬');if(!pk)return;const area=a.entry;await exitMon(mid,{noAsk:true,sys:true});await enterMon(pk.id,area,{sys:true,how:'임의 교대'})}
 function localUi(b,self,name,area){return {b,self,name,area,viewer:ctx().gm?'':ctx().seat,
  pick:(list,label)=>new Promise(res=>{const md=A().openModal(`<div class="mhead"><h2>${esc(name)} — ${esc(label)}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="pg">${list.map(m=>`<div class="pc" data-pk="${m.id}"><div class="pic" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}"></div><div><b>${esc(m.name)}</b><div class="small dim">${SIDE_KO[m.side]} ${String(m.entry).toUpperCase()} · HP ${m.hp.cur}/${m.hp.max}</div></div></div>`).join('')}</div>`);
   md.querySelectorAll('[data-pk]').forEach(el=>el.onclick=()=>{A().closeModal();res(list.find(m=>m.id===el.dataset.pk))});md.querySelector('[data-x]').addEventListener('click',()=>res(null))}),
  confirm:q=>askYes(`「${name}」\n${q}\n\n조건을 만족하는가?`,'만족한다','아니다'),
  choose:(labels,multi)=>new Promise(res=>{const md=A().openModal(`<div class="mhead"><h2>${esc(name)} — 발동할 효과</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="firelist">${labels.map((l,i)=>`<label class="firerow"><input type="${multi?'checkbox':'radio'}" name="ch" value="${i}" ${i===0?'checked':''}> <span>${esc(l)}</span></label>`).join('')}</div><div class="row" style="margin-top:10px"><span class="sp"></span><button class="btn pri" id="chok">발동</button></div>`);
   $('#chok',md).onclick=()=>{const v=[...md.querySelectorAll('[name=ch]:checked')].map(i=>+i.value);A().closeModal();res(v)};md.querySelector('[data-x]').addEventListener('click',()=>res([]))})}}
 /* 효과 하나를 돌려서 배틀에 적용한다. kind: pot|trait|item|order. 돌려줌: 적용했으면 true */
 async function fireAuto(mid,kind,name,opt){opt=opt||{};const c=ctx();const b0=c.b;const m0=b0.mons[mid];if(!m0)return false;const auto=opt.auto||FX().autoOf(m0,kind,name);   /* opt.auto: SP(서포터) 처럼 포켓몬 밖에 적힌 구문 */
  if(!auto||!auto.ops||!auto.ops.length||auto.manual){if(!opt.quiet)A().toast(auto&&auto.manual?`「${name}」은(는) 자동화가 없어 손으로 처리한다`:`「${name}」 자동화 없음`);return false}
  if(kind==='pot'&&!opt.uq&&auto.src!=='card'){const bk=misagBlock(b0,m0,name);if(bk){A().sysLog(`【포텐셜】 ${m0.name} 『${name}』\n${bk} — 발동하지 않았다`,'battle',{mid:m0.id,img:m0.image||''});return false}}   /* 10-28 미사그 대학 */
  /* 확률 (10-24 망령): 레디메이드 특성은 글(text)이 비어 있어 확률을 못 읽었다 — 그 칸의 효과 글까지 본다. 「N할로」 · 「N% 확률」 은 여기서 굴리고, 줄마다 고르는 효과(①②)는 고른 줄에서 굴린다 */
  const etx=auto.text||slotEff(m0,kind,name);const tm=FX().timing(etx);const nb0=snap(b0),nb=snap(nb0);const m=nb.mons[mid];const L=[];
  const lc=!!(FX().lineChance&&FX().lineChance(auto.ops));const perLine=auto.ops.length===1&&auto.ops[0].k==='choice';/* 10-24 망령: 레디메이드에 적어 둔 확률(p)이 먼저 */const pExp=auto.p!=null&&auto.p!==''&&isFinite(+auto.p)&&+auto.p>0?Math.min(100,+auto.p):0;const ch=opt.noRoll?0:pExp?pExp:(!tm.percent&&!perLine&&!lc&&FX().chanceOf?FX().chanceOf(etx):0);
  const KN=({pot:'포텐셜',trait:'특성',item:'소지품',order:'지령'})[kind]||'효과';let adj={};
  if(!opt.quiet&&!opt.noRoll&&FX().rollP&&((ch&&ch<100)||tm.percent||chanceIn(auto.ops))){adj=await askChance(name,ch||(tm.percent?FX().percentOf(tm.percent):0));if(adj===null)return false}
  const roll=p=>FX().rollP?FX().rollP(m,p,adj):(()=>{const r=Math.floor(Math.random()*100)+1;return {ok:r<=p,r,p,adj:''}})();
  if(ch&&(ch<100||Object.keys(adj).length||((m.fx||{}).chance||[]).length)){const rr=roll(ch);if(!rr.ok){A().sysLog(`【${KN}】 ${m.name} 『${name}』\n${rr.p}% 판정 실패 (${rr.r}/${rr.p})${rr.adj} — 발동하지 않았다`,'battle',{mid:m.id,img:m.image||''});return false}L.push(`${rr.p}% 판정 성공 (${rr.r}/${rr.p})${rr.adj}`)}
  /* 11-03 21:36 망령 「중확률 판정 성공 뒤에 또 실패가 뜬다」(변한 뒤의 기쁨): 글의 확률 말과 구문 줄의 확률(「중확률:」)이 같이 있으면 줄에서만 굴린다 */
  if(tm.percent&&!opt.noRoll&&!pExp&&!lc){const rr=roll(FX().percentOf(tm.percent));if(!rr.ok){A().sysLog(`【${KN}】 ${m.name} 『${name}』\n${tm.percent} 판정 실패 (${rr.r}/${rr.p})${rr.adj} — 발동하지 않았다`,'battle',{mid:m.id,img:m.image||''});return false}L.push(`${tm.percent} 판정 성공 (${rr.r}/${rr.p})${rr.adj}`)}
  /* 「필드 위에 있는 한」 · 「필드에 있는 동안」: 이 효과가 바꾼 것은 쓴 포켓몬이 필드를 떠나면 되돌린다 */const hold=Object.assign(FX().release&&(/필드\s*(?:위)?에\s*있는\s*(?:한|동안)|나와\s*있는\s*(?:한|동안)/.test(etx)||(opt.aura&&/【방호】/.test(etx)))?{hold:1}:{},/【유일】/.test(etx)?{uniq:1}:{});   /* 11-03 20:44 망령 「커맨더 · 옵저버」: 【방호】 아군 효과(opt.aura)도 「있는 한」처럼 · 【유일】 은 같은 이름 효과를 이미 받은 대상에겐 안 건다 */
  /* 10-26 망령: 트레이너 고유는 고른 포켓몬이 곧 대상 — 구문의 「아군 1체」는 「고른 포켓몬」으로 (예전엔 고른 포켓몬을 뺀 다른 아군에게 걸렸다) */
  /* 10-26 덱 시험: 카드의 「아군 1체」가 기준 포켓몬(자기 편 첫 포켓몬)을 빼고 물었다 — 트레이너가 쓰는 카드는 기준 포켓몬도 고를 수 있게 (ally1s) */
  const ops=opt.uq?JSON.parse(JSON.stringify(auto.ops).replace(/"tgt":"ally1"/g,'"tgt":"self"')):auto.src==='card'?JSON.parse(JSON.stringify(auto.ops).replace(/"tgt":"ally1"/g,'"tgt":"ally1s"')):auto.ops;
  const ux=uiCtx(nb,m,name,opt.area);if(opt.pickId){const up=ux.pick;ux.pick=(list,label)=>{const f=list.find(x=>x.id===opt.pickId);return f?Promise.resolve(f):up(list,label)}}   /* 11-02: 창에서 이미 고른 대상 */
  const r=await FX().run(ops,Object.assign(ux,opt.noRoll?{noRoll:1}:{},adj,hold));L.push(...r.lines);if(hold.hold&&(m.holds||[]).length)L.push('(필드를 떠나면 풀린다)');
  const raidNew=await raidFix(m,m0,name,L);if(raidNew===null)return false;
  const f=fieldOf(nb);for(const id in nb.mons){const x=nb.mons[id];if(x.entry&&x.hp.cur<=0){x.entry='';L.push(`${x.name}은(는) 쓰러졌다!`)}}
  if(!await saveBattle(nb0,nb,f,{n:m.name,s:name,img:opt.img!=null?opt.img:(m.image||'')}))return false;if(raidNew)raidCut(m);
  if(kind==='item'&&oneShot(m0)&&!opt.quiet&&await askYes(`「${name}」을(를) 다 썼나? (소지품 칸에서 뺀다)`,'뺀다','남긴다'))setTimeout(()=>itemConsume(mid),50);
  A().sysLog(opt.head?`${opt.head}${L.length?'\n'+L.join('\n'):''}`:`【${({pot:'포텐셜',trait:'특성',item:'소지품',order:'지령'})[kind]||'효과'}】 ${m.name} 『${name}』${L.length?'\n'+L.join('\n'):''}`,'battle',{mid:m.id,img:opt.img!=null?opt.img:(m.image||''),eff:String(opt.eff||auto.text||(kind==='trait'?m.abilityEff:kind==='item'?m.itemEff:((potSrc(m).find(p=>p&&p.name===name)||{}).eff))||'').replace(/<br\s*\/?>/g,'\n').slice(0,300)});return true}
 function slotEff(m,kind,name){const n=String(name||'').replace(/『|』/g,'');if(kind==='trait')return m.abilityEff||(FX()&&FX().effOf?FX().effOf('trait',n):'');if(kind==='item'){const x=n===m.item?m:(m.items2||[]).find(q=>q&&q.item===n);return (x&&x.itemEff)||''}
  const pe=((potSrc(m).find(p=>p&&p.name===n)||{}).eff)||'';if(pe)return pe;/* 11-03: 트레이너 고유 포텐셜의 효과 글도 (autoOnEntry · fireAuto) */const t=m&&m.tid?((ctx().b.trainers||{})[m.tid]):null;const u=t&&(t.unique||[]).find(q=>q&&String(q.name||'').replace(/『|』/g,'')===n);return (u&&u.eff)||''}
 /* 턴 개시 자동 (10-24 망령): 「턴 개시 시」 · 【턴 개시】 가 적힌 특성 · 소지품 · 포텐셜 — 구문이 있으면 (확률을 굴려) 발동, 없으면 확률만 굴려 손으로 할 일을 알린다 */
 async function autoTurnStart(){if(!FX())return;const b=ctx().b;for(const m of Object.values(b.mons||{})){if(!m.entry||m.hp.cur<=0)continue;const list=[];
  if(m.ability)list.push(['trait',m.ability]);if(m.item)list.push(['item',m.item]);for(const x of (m.items2||[]))if(x&&x.item)list.push(['item',x.item]);for(const p of potSrc(m))if(p&&p.name&&!p.ph)list.push(['pot',p.name]);
  for(const [kind,name] of list){const tx=slotEff(m,kind,name);if(!/턴\s*개시\s*시|【턴\s*개시】/.test(tx))continue;if(/【\s*(선행|임의)\s*】/.test(tx))continue;if(kind==='pot'&&/【\s*\d+\s*\/\s*(시|턴)\s*】/.test(tx))continue;const a=FX().autoOf(m,kind,name);
   if(a&&a.ops&&a.ops.length&&!a.manual){await fireAuto(m.id,kind,name,{quiet:true});continue}
   const ch=FX().chanceOf(tx);const K=({pot:'포텐셜',trait:'특성',item:'소지품'})[kind];let roll='';if(ch&&ch<100){const rr=FX().rollP?FX().rollP(snap(m),ch,{}):(()=>{const r=Math.floor(Math.random()*100)+1;return {ok:r<=ch,r,p:ch,adj:''}})();roll=rr.ok?`${rr.p}% 판정 성공 (${rr.r}/${rr.p})${rr.adj} — 효과를 손으로 적용`:`${rr.p}% 판정 실패 (${rr.r}/${rr.p})${rr.adj} — 발동하지 않았다`}else roll='턴 개시 효과 — 손으로 적용';
   A().sysLog(`【${K}】 ${m.name} 『${name}』\n${roll}`,'battle',{mid:m.id,img:m.image||'',eff:String(tx).replace(/<br\s*\/?>/g,'\n').slice(0,300)})}}}
 /* 등장·상시 자동 발동: 글에 【등장】/【상시】 표식이 있는 특성·소지품·포텐셜 */
 /* 지속형 구문: 걸어 두면 공격 창 · 순서 · HP 창이 알아서 읽는 것들 */
 const PASSIVE_K=['boost','guard','mult','immune','nodrop','ignoreup','noind','float','prio','chance','pursuit','cond','sp'];
 /* 맨 앞 「조건」(아군빈사 · HP≤ · 상태)을 미리 본다 — 안 맞으면 조용히 넘기고 나중(아군 빈사 등)에 다시 */
 function condNow(b,m,ops){if(!m)return false;for(const o of ops||[]){if(o.k!=='cond')break;if(o.c==='ally_fainted'){if(!Object.values(b.mons||{}).some(x=>x.id!==m.id&&sameT(x,m,b)&&x.hp.cur<=0))return false}else if(o.c==='self_state'){if(!(m.states||{})[o.st])return false}else return false}return true}
 /* 아군 빈사 (10-26 망령): 새로 쓰러진 포켓몬이 생기면 — 같은 편 필드 포켓몬의 「아군빈사」 조건 상시(에이스 …)를 걸고, 【자동】 「아군이 「빈사」 상태가 되었을 때」 포텐셜을 발동, 그 밖의 그런 고유 · 포텐셜은 알림 */
 const FAINT_SEEN={};let faintBusy=false;
 async function faintWatch(){const c=ctx();const b=c.b;if(!c.mgr||!b.started||faintBusy)return;const bk=String(b.started)+':'+Object.keys(b.mons||{}).sort().join(',');
  if(!FAINT_SEEN[bk]){FAINT_SEEN[bk]=new Set(Object.values(b.mons||{}).filter(m=>m.hp.cur<=0).map(m=>m.id));return}
  const seen=FAINT_SEEN[bk];/* 10-26 점검: 되살아난(HP>0) 포켓몬은 다시 빈사 감시 대상으로 */for(const m of Object.values(b.mons||{}))if(m.hp.cur>0&&seen.has(m.id))seen.delete(m.id);const neu=Object.values(b.mons||{}).filter(m=>m.hp.cur<=0&&!seen.has(m.id));if(!neu.length)return;neu.forEach(m=>seen.add(m.id));if(!isLeader(c))return;   /* 10-27: 아군 빈사 자동 처리도 한 창만 */faintBusy=true;
  try{const RE=/아군이\s*「빈사」\s*상태가\s*되었을\s*때/;const notes=[];const doneT=new Set();
   for(const dm of neu){for(const x of Object.values(ctx().b.mons||{})){if(x.id===dm.id||!x.entry||x.hp.cur<=0||!sameT(x,dm,ctx().b))continue;
     await autoOnEntry(x.id,{passiveOnly:true});
     for(const p0 of potSrc(ctx().b.mons[x.id]||x)){if(!p0||!p0.name||p0.unique||p0.ph)continue;const eff=String(p0.eff||'');if(!RE.test(eff))continue;const mm=eff.match(/【(\d+)\/시】/);const p={name:p0.name,max:mm?+mm[1]:null};const cur=ctx().b.mons[x.id];const u=(cur.potUses||{})[p.name];const left=p.max==null?null:(u==null?p.max:+u);if(left!==null&&left<=0)continue;
      if(/【자동】/.test(eff)&&FX()&&FX().autoOf(cur,'pot',p.name)&&!FX().autoOf(cur,'pot',p.name).manual){if(await fireAuto(x.id,'pot',p.name,{quiet:true,head:`【포텐셜】 ${cur.name} 『${p.name}』【자동】 — ${dm.name} 빈사`})&&left!==null){const uu=Object.assign({},cur.potUses||{});uu[p.name]=left-1;await A().set(['battle','mons',x.id,'potUses'],uu)}}
      else notes.push(`${cur.name} 『${p.name}』`)}
     const t=(ctx().b.trainers||{})[x.tid];if(t&&!doneT.has(t.id||x.tid)){doneT.add(t.id||x.tid);for(const u of uniqList(t)){if(RE.test(String(u.p.eff||''))&&(u.left===null||u.left>0))notes.push(`${t.name} 고유 『${u.p.name}』`)}}}}
   if(notes.length)A().sysLog(`【아군 빈사】 ${neu.map(m=>m.name).join(' · ')} — 발동 조건을 만족한 효과\n${[...new Set(notes)].join('\n')}\n(「발동」 버튼으로)`,'battle')}finally{faintBusy=false}}
 const EVENT_RE=/받았을 때|받을 때 \d할|맞았을 때|했을 때|내보낼 때|내보냈을 때|쓰러뜨렸을|빈사(?:가| 상태가)? 되었을|교대(?:했을|할) 때|등장했을 때|턴 개시|【(?:등장|턴 종료|선행|사전|퇴장|함성|보급|탈진|지연|자동)/;
 function passiveOps(ops,text){if(!ops||!ops.length)return false;
  /* 11-03: 특수 효과(sp — 추가공격 · 보호 · 회피 …)는 그 자체가 조건부 규칙이라 글에 「~했을 때」가 있어도 나올 때 걸어 둔다 */if(ops.every(o=>o&&o.k==='sp'))return true;
  /* 줄이 여럿(①②…)이면 첫 줄만 본다 — 구문은 대개 ① 몫이고, 뒤 줄의 계기(【등장 (죽어내밀기)】 · 【지연】 …)는 따로 (디스럽터 ① …) */
  const t=String(text||'');const first=/[①②③④⑤]/.test(t)?(t.split(/[②③④⑤]/)[0]):t;
  if(EVENT_RE.test(first)||/\d할(?:로|의)|\d+%\s*(?:확률|로)/.test(first))return false;
  /* 고르는 대상(아군 1체 · 상대 1체 · 에리어)이 든 구문은 등장 때 묻게 되니 손으로 */
  return ops.every(o=>o&&PASSIVE_K.includes(o.k)&&!o.p&&!o.pl&&!['ally1','enemy1','area'].includes(o.tgt))}
 /* 11-03 20:44 망령 「커맨더 · 옵저버 · 프렌드가드」: 【방호】(또는 「필드 위에 있는 한」) 줄이 아군 · 상대에게 거는 지속 효과인데, 다른 줄의 계기(【탈진】 …)나 「아군 1체」 대상 때문에 등장 때 안 걸리던 것.
    그 줄에 계기 말이 없으면 등장 때 건다 — 「아군 1체」 → 자신 제외 아군 전체, 「상대 1체」 → 상대 전체. 필드에 있는 동안 새로 나온 포켓몬에게도(reAura), 떠나면 풀린다(release) */
 function auraOf(a,etx){const ops=a&&a.ops;if(!ops||!ops.length||ops.some(o=>!o||o.k==='choice'||!PASSIVE_K.includes(o.k)||o.p||o.pl))return null;
  if(!ops.some(o=>['ally1','enemy1','allyx','ally','enemy','others','all'].includes(o.tgt))||passiveOps(ops,etx))return null;
  const cl=String(etx||'').split(/(?=[①②③④⑤])/).find(c=>/【방호】|필드\s*(?:위)?에\s*있는\s*(?:한|동안)/.test(c)&&/아군|상대|이외/.test(c)&&!EVENT_RE.test(c.replace(/【(?:방호|유일|수세)】/g,'')));
  if(!cl)return null;return JSON.parse(JSON.stringify(ops).replace(/"tgt":"ally1"/g,'"tgt":"allyx"').replace(/"tgt":"enemy1"/g,'"tgt":"enemy"'))}
 /* 자기 등급 조건: 「공격 : B」 이하일 때 · 「방어 : C」 이하일 때 — 포켓몬 등급표(m.ranks: HP 공격 방어 특공 특방 스피드)를 본다 */
 const GR_IDX={HP:0,공격:1,방어:2,특공:3,특방:4,스피드:5};
 function gradeVal(g){g=String(g||'').trim();const base=S().strip?S().strip(g):g.replace(/[+-]$/,'');const i=(S().RANKS||['E','D','C','B','A','AA','AAA','S']).indexOf(base);if(i<0)return null;return i*3+(/\+$/.test(g)?1:/-$/.test(g)?-1:0)}
 function gradeCond(m,ops,text){if(!ops||ops.length!==1||ops[0].k!=='choice')return null;const t=String(text||'');const mm=t.match(/「(HP|공격|방어|특공|특방|스피드)\s*:\s*([A-Z]{1,3}[+-]?)」\s*(이하|이상)일 때/);if(!mm)return null;
  if(/①[\s\S]*②/.test(t)&&!/^[^②]*「(HP|공격|방어|특공|특방|스피드)\s*:/.test(t))return null;   /* 조건이 ①이 아닌 줄에만 있으면 손으로 */
  const cur=gradeVal((m.ranks||[])[GR_IDX[mm[1]]]),lim=gradeVal(mm[2]);if(cur==null||lim==null)return null;const opt=(ops[0].opts||[])[0];if(!opt||!(opt.ops||[]).length)return null;
  return {ok:mm[3]==='이하'?cur<=lim:cur>=lim,ops:opt.ops}}
 /* 날씨 · 필드 조건 스피드 (엽록소 · 쓱쓱 · 모래헤치기 · 눈치우기 · 야행성 · 음속 활강 …): 특성 · 포텐셜 글을 보고 순서 계산 때 곱한다 */
 function spMulOf(m,f){let v=1;const why=[];const W=String((f.weather||{}).type||''),TR=String((f.terrain||{}).type||'');const wOk=x=>x===W||(x==='눈'&&W==='싸라기눈')||(x==='싸라기눈'&&W==='눈');
  const srcs=[[m.ability,m.abilityEff],...potSrc(m).filter(p=>p&&!p.ph).map(p=>[p.name,p.eff])];
  for(const [n,e] of srcs){const t=String(e||'');const re=/「(날씨|필드)\s*:\s*([^」]+)」일 때[^.①②③]*?「스피드」(?:를|가|이)\s*(?:(\d+(?:\.\d+)?)배|강화\((\d+(?:\.\d+)?)배\))/g;let r;
   while((r=re.exec(t))){const x=r[2].trim();const ok=r[1]==='날씨'?x.split(/[,/·]\s*/).some(wOk):TR===x;if(!ok)continue;const k=+(r[3]||r[4]);if(k>0){v*=k;why.push(`${m.name} 「${n}」 스피드 ×${k}`)}}}
  return {v,why}}
 /* -스킨 특성 (페어리스킨 · 스카이스킨 · 프리즈스킨 · 일렉트릭스킨 · 노말스킨): 기술 타입을 바꾸고 위력을 강화 */
 function skinOf(m,mv){const t=String((m&&m.abilityEff)||'');if(!mv||mv.cat==='변화')return null;let r=t.match(/자신의 「노말」 기술(?:을|이) 「([^」]+)」 (?:기술로 만들고|기술이 되고|타입으로 하고)[^.]*?강화\((\d+(?:\.\d+)?)배\)/);
  if(r&&mv.typeEn==='Normal'){const ty=S().typeEn(r[1]);return ty?{ty,mul:+r[2],name:m.ability}:null}
  r=t.match(/자신의 기술을 「노말」 기술로 (?:만들고|변경하고)[^.]*?강화\((\d+(?:\.\d+)?)배\)/);if(r)return {ty:'Normal',mul:+r[1],name:m.ability};return null}
 async function autoOnEntry(mid,o2){o2=o2||{};const c=ctx();const m=c.b.mons[mid];if(!m||!FX())return;const list=[];
  if(m.ability)list.push(['trait',m.ability]);if(m.item)list.push(['item',m.item]);for(const p of [...(m.pots||[]),...(m.excl?[m.excl]:[]),...(m.exclX||[])])if(p&&p.name&&!p.ph)list.push(['pot',p.name]);
  /* 11-03 감우: 트레이너 고유 포텐셜도 같은 길로 — 【등장】 · 【상시】 이고 구문이 있으면 그 트레이너의 포켓몬이 나올 때 건다 (autoOf 가 m.tid 로 고유 구문을 읽는다). 횟수(【N/시】)가 있는 고유는 손으로(선행 · 임의 발동) */
  {const t=(c.b.trainers||{})[m.tid];for(const u of ((t&&t.unique)||[]))if(u&&u.name&&!/【\s*\d+\s*\/\s*(시|턴)\s*】/.test(String(u.eff||''))&&!list.some(([k,n])=>k==='pot'&&n===u.name))list.push(['pot',u.name])}
  for(const [kind,name] of list){const a=FX().autoOf(m,kind,name);if(!a||!a.ops||!a.ops.length||a.manual)continue;/* 시트에 직접 쓴 구문은 글이 없으니 그 칸의 효과 글에서 【등장】/【상시】 를 읽는다 */const tm=FX().timing(a.text||slotEff(m,kind,name)||'');
   const etx2=a.text||slotEff(m,kind,name)||'';
   /* 10-26 망령: 표시 없는 상시 특성 · 포텐셜 (테크니션 · 적응력 · 철주먹 · 멀티스케일 …) — 지속형 구문뿐이고 계기 말(받았을 때 · 턴 종료 …)이 없으면 등장 때 건다.
      「공격 : B」 이하일 때 같은 자기 등급 조건(천하장사 · 순수한힘 · 퍼코트 …)은 등급을 보고 맞으면 건다 */
   const gc=!tm.entry&&!tm.passive&&!tm.turnEnd?gradeCond(m,a.ops,etx2):null;
   if(gc){if(gc.ok){const cur=ctx().b.mons[mid];if(cur&&(cur.fxDone||{})[name])continue;if(await fireAuto(mid,kind,name,{quiet:true,noRoll:true,auto:{ops:gc.ops,text:a.text}})){const d=Object.assign({},(ctx().b.mons[mid]||{}).fxDone||{});d[name]=1;await A().set(['battle','mons',mid,'fxDone'],d)}}continue}
   {const au=!tm.entry?auraOf(a,etx2):null;if(au){const cur=ctx().b.mons[mid];if(cur&&(cur.fxDone||{})[name])continue;if(await fireAuto(mid,kind,name,{quiet:true,noRoll:true,aura:1,auto:{ops:au,text:etx2}})){const d=Object.assign({},(ctx().b.mons[mid]||{}).fxDone||{});d[name]=1;await A().set(['battle','mons',mid,'fxDone'],d)}continue}}
   /* 줄마다 고르는 효과(선택:)에서 늘 켜져 있어야 할 줄만 (하이 블로커 ① 방호수세 …): 계기 말이 없는 지속형 줄을 등장 때 건다 */
   if(!tm.entry&&a.ops.length===1&&a.ops[0].k==='choice'){const po=(a.ops[0].opts||[]).filter(o=>o&&o.label&&/^[\s-]*[①②③④⑤]/.test(o.label)&&!/조건|등장|턴 종료|함성|보급|선행|사전|교대|빈사|받았을|했을|\d할/.test(o.label)&&passiveOps(o.ops,''));
    if(po.length){const cur=ctx().b.mons[mid];if(cur&&(cur.fxDone||{})[name])continue;if(await fireAuto(mid,kind,name,{quiet:true,noRoll:true,auto:{ops:po.flatMap(o=>o.ops),text:a.text}})){const d=Object.assign({},(ctx().b.mons[mid]||{}).fxDone||{});d[name]=1;await A().set(['battle','mons',mid,'fxDone'],d)}}continue}
   /* 【등장 (통상 교대)】 · 【등장 (임의 교대)】 · 【등장 (죽어내밀기)】: 그렇게 나왔을 때만 (바운서 · 닌자 ②) */
   {const hx=String(etx2).split(/[②③④⑤]/)[0].match(/【등장\s*\(([^)]+)\)】/);if(hx&&!tm.entry&&!(a.ops.length===1&&a.ops[0].k==='choice')){if(!o2.passiveOnly&&o2.how&&hx[1].replace(/\s/g,'').includes(String(o2.how).replace(/\s/g,'')))await fireAuto(mid,kind,name,{quiet:true});continue}}
   if(tm.entry){if(!o2.passiveOnly)await fireAuto(mid,kind,name,{quiet:true})}
   else if(tm.passive||(!tm.turnEnd&&passiveOps(a.ops,etx2))){if(!condNow(ctx().b,ctx().b.mons[mid],a.ops))continue;const cur=ctx().b.mons[mid];if(cur&&(cur.fxDone||{})[name])continue;if(await fireAuto(mid,kind,name,{quiet:true,noRoll:true})){const d=Object.assign({},(ctx().b.mons[mid]||{}).fxDone||{});d[name]=1;await A().set(['battle','mons',mid,'fxDone'],d)}}}}
 /* 포켓몬마다 급소 규칙 (10-23 망령 · 제작기 상세 조정): tbl 급소 표 · add 급소 랭크 + · guard 받을 때 방호 · dmg 급소 대미지 배율 · sure 언제나 급소 · never 급소에 맞지 않음 */
 const CRR=m=>(m&&m.critRule)||{};
 /* 10-24 망령: 지시 급소 보정 (고정식, 오레마스 룰) — 상대 · 야생과 상관없이 공격 쪽 트레이너 「지시」 랭크값 − 3 (A +1 · AA +2 · AAA +3 · S +4). 야생 포켓몬(트레이너 없음)은 0.
    랭크값 E0 · D1 · C2 · B3 · A4 · AA5 · AAA6 · S7, 필드 위 포켓몬의 orderAlly/orderEnemy 를 더한다 (get_status_trainer) */
 function orderCrit(atk,def){const b=ctx().b;const T=b.trainers||{};const ta=T[atk.tid];if(!ta||!def)return {v:0};
  const lv=t=>{let v=S().RANKS.indexOf(S().strip((t.ranks||{})['지시']));if(v<0)v=0;for(const m of Object.values(b.mons||{}))if(m.entry)v+=+(sameT(m,t,b)?m.orderAlly:m.orderEnemy)||0;return Math.min(7,Math.max(0,v))};
  const rk=t=>S().strip((t.ranks||{})['지시'])||'-';
  const v=Math.max(0,lv(ta)-3);return {v,txt:`${ta.name} 「지시」 ${rk(ta)} — 급소 +${v}`}}
 function crAdj(atk,def){return (+CRR(atk).add||0)-(+CRR(def).guard||0)}
 function critMulOf(atk){return +CRR(atk).dmg||0}
 /* 강화 무시 (10-23 망령): 상승 · 감소 · 둘 다(모두) × 방어 · 회피(공격할 때) · 공격 · 명중(받을 때). 돌려줌 {def,eva,atk,acc} = statValue 의 ignore 코드 (0 상승 / 1 감소 / 6 둘 다) */
 /* 10-28 망령 (킬러 자동화): 『역할』은 포켓몬의 역할 포텐셜(m.role)에 있다 — 효과 엔진은 fx.roles 만 보던 탓에 『에이스』 상대 강화(킬러)가 안 걸렸다.
    역할 포텐셜 비고의 「『X』의 『상위 역할』」 · 「『X』『Y』는 동일한 『역할』 취급」도 같은 역할로 친다 */
 function rolesOf(m){const out=new Set(((m&&m.fx)||{}).roles||[]);const r=String((m&&m.role)||'').replace(/『|』/g,'').trim();
  if(r){out.add(r);const row=(((DB().maker||{}).pots)||[]).find(x=>x&&x[1]===r);const note=String((row&&row[3])||'');if(/상위 역할|동일한\s*『?역할/.test(note))for(const q of note.matchAll(/『([^』]+)』/g))if(q[1]!=='역할'&&q[1]!=='상위 역할')out.add(q[1])}
  return [...out]}
 function roleV(m){if(!m)return m;const rs=rolesOf(m);const cur=((m.fx||{}).roles)||[];if(rs.length===cur.length)return m;return Object.assign({},m,{fx:Object.assign({},m.fx||{},{roles:rs})})}
 function iuIgnore(atk,def){const sc=(iu,k)=>!iu.scope||iu.scope==='both'||String(iu.scope).split(',').includes(k);const code=iu=>{const lv=iu.lv||'';if(iu.all)return lv==='rank'?6:lv==='mod'?8:7;if(iu.dn)return lv==='rank'?4:lv==='mod'?5:1;return lv==='rank'?2:lv==='mod'?3:0};const iu=(atk.fx||{}).ignoreUp,iuD=(def.fx||{}).ignoreUp;const o={};
  const roOk=(x,who)=>!x.ro||!x.ro.length||rolesOf(who).some(r=>x.ro.includes(r));   /* 킬러: 『에이스』 상대일 때만 */
  const A1=iu&&(iu.dir==='atk'||iu.dir==='both')&&roOk(iu,def),R1=iuD&&(iuD.dir==='recv'||iuD.dir==='both')&&roOk(iuD,atk);if(A1&&sc(iu,'def'))o.def=code(iu);if(A1&&sc(iu,'eva'))o.eva=code(iu);if(R1&&sc(iuD,'atk'))o.atk=code(iuD);if(R1&&sc(iuD,'acc'))o.acc=code(iuD);return o}
 /* 발동 확률 (10-23 망령): 손으로 누른 발동이고 확률이 걸린 효과면 굴리기 전에 그대로 · 반드시 · 바꿔서 를 고른다. 돌려줌 {pSet?,pAdd?,pSure?} 또는 null(닫기) */
 function chanceIn(ops){return (ops||[]).some(o=>o&&(o.p||o.pl||o.k==='statefx'||(o.k==='cure'&&o.chance&&+o.chance<100)||(o.k==='choice'&&(o.opts||[]).some(x=>FX().chanceOf(x.label)||FX().timing(x.label).percent||chanceIn(x.ops)))))}
 function askChance(name,base){return new Promise(res=>{const md=A().openModal(`<div class="mhead"><h2>${esc(name)} — 발동 확률</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
  <div class="small dim">${base?'효과 글의 확률 <b>'+base+'%</b>':'줄마다 확률이 걸린 효과'} — 다른 포텐셜 · 특성으로 확률이 오르거나 반드시 발동하면 여기서 바꾼다</div>
  <div class="pcask"><button class="btn pri" data-c="as">그대로 굴리기</button><button class="btn" data-c="sure">반드시 발동</button></div>
  <div class="pcask"><label>확률 <input type="number" class="n" id="pc_set" placeholder="${base||''}" min="0" max="100">%</label><label>보정 <input type="number" class="n" id="pc_add" placeholder="0">%p</label><button class="btn" data-c="go">바꿔서 굴리기</button></div>`);
  let done=false;const fin=v=>{if(done)return;done=true;A().closeModal();res(v)};
  md.querySelectorAll('[data-c]').forEach(el=>el.onclick=()=>{const c=el.dataset.c;if(c==='as')return fin({});if(c==='sure')return fin({pSure:1});const s=$('#pc_set',md).value,a=$('#pc_add',md).value;fin(Object.assign({},s!==''?{pSet:+s}:{},a!==''?{pAdd:+a}:{}))});
  md.querySelector('[data-x]').addEventListener('click',()=>{if(!done){done=true;res(null)}})})}
 /* 공격 창에서 쓸 조건 */
 /* 공격 쪽 배율(자속·적응력·달인의띠): 받는 쪽에는 숫자에 녹여서만 보낸다 */
 /* 10-27 망령: 연속기 타별 대미지 (맞은 타만) — am 을 주면 공격 쪽 배율(자속 · 달인의띠)을 곱해 내림. HP 는 hpDamageHits 로 타마다 깎는다 */
 function perOf(d,am){return d&&d.hits?d.hits.filter(h=>h.hit>0).map(h=>am?Math.floor(h.value*am):h.value):[]}
 function atkMul(r,md){const ck=id=>{const el=md?$('#'+id,md):document.getElementById(id);return !!(el&&el.checked)};return (r.stab?(ck('aadapt')?2:1.5):1)*(ck('abelt')&&r.eff&&r.eff.value>1?1.2:1)}
 /* 10-26 망령: 이번 턴 공격을 지시받았나 — 공개된 지시(cmds[tid].mons[mid])의 기술이 변화기가 아니면. 교대 · 지시 없음(행동불능 등) · 변화기는 「지시받지 않음」 → 【수세】 · 【공세】 판정에 쓴다 */
 function ordAtk(b,m){if(!b||!m)return false;const x=(((b.cmds||{})[m.tid]||{}).mons||{})[m.id];if(!x||x.move==null||x.move===''||x.move==='switch')return false;const mv=MVS(m)[+x.move];return !!mv&&mv.cat!=='변화'}
 function moveQuery(atk,def,mv,moveTypes,eff,single){const b=ctx().b;return {types:moveTypes,cat:mv.cat,eff:eff,single:single,stab:!!(eff&&eff.stab),tags:String(mv.tag||'').split(/[,/·\s]+/).filter(x=>x&&x!=='-'),pow:+mv.pow||0,atkAtk:atk===def?ordAtk(b,atk):true,defAtk:atk===def?ordAtk(b,def):ordAtk(b,def)}}
 /* 컷인에 쓸 트레이너 그림: 표정(스탠딩) → 시트 그림 */
 function trainerImg(t){if(!t)return '';const st=(t.stands||[]);const a=st[+t.standActive||0]||st[0];return (a&&a.src)||t.image||''}
 const potKey=n=>String(n||'').replace(/『|』/g,'').trim();
 function potLineOf(m,name){return String(((m&&m.cutLine)||{})[potKey(name)]||'')}
 function uqLineOf(t,name){const u=((t&&t.unique)||[]).find(x=>x&&potKey(x.name)===potKey(name));return String((u&&u.line)||'')}
 function potTagOf(m,name){const k=potKey(name);if((m.excl&&potKey(m.excl.name)===k)||(m.exclX||[]).some(p=>p&&potKey(p.name)===k))return `${m.name}의 전용 포텐셜!`;const p=(m.pots||[]).find(x=>x&&potKey(x.name)===k);return p&&/고유/.test(p.kind||'')?`${m.name}의 고유 포텐셜!`:`${m.name}의 포텐셜!`}
 function cutFire(tok,src,tag,ment,color,line){try{if(!CUT())return;const b=ctx().b||{};const nm=String(ment||'').replace(/^『|』$/g,'');
  if(line==null){if(/^m:/.test(tok)){const m=(b.mons||{})[tok.slice(2)];if(m){line=potLineOf(m,nm);if(tag===m.name)tag=potTagOf(m,nm)}}else if(/^t:/.test(tok)&&/의 고유!$/.test(String(tag||'')))line=uqLineOf((b.trainers||{})[tok.slice(2)],nm)}
  let side='';{const m=/^m:/.test(tok)?(b.mons||{})[tok.slice(2)]:null;const t=/^t:/.test(tok)?(b.trainers||{})[tok.slice(2)]:null;side=(m&&m.side)||(t&&t.side)||''}   /* 11-03 (검토 10): 동시 컷인의 좌/우 자리 · PLAYER/RIVAL 글자 */
  CUT().fire({tok,src,tag,ment,color,line:line||'',side})}catch(e){}}
 /* 컷인을 띄울 포텐셜: rp.cutin.pot = excl(전용·고유만, 기본) | all | none */
 function wantCut(m,name){const cfg=((A().ST.state.rp||{}).cutin)||{};const mode=cfg.pot||'excl';if(mode==='none')return false;if(mode==='all')return true;if(m.excl&&m.excl.name===name)return true;if((m.exclX||[]).some(p=>p.name===name))return true;const p=(m.pots||[]).find(x=>x.name===name);return !!(p&&/전용|고유/.test(p.kind||''))}
 /* 11-03 감우 (검토 9): 턴 개시 · 턴 종료만 큰 띠(2.3s), 교대 · 행동 순서 · 행동 처리는 0.9s 작은 띠 (sub 없이) */
 const PH_BIG=/^(턴 개시|턴 종료)$/;
 function cutPhase(text,sub){try{if(CUT())CUT().phase(text,PH_BIG.test(String(text||''))?sub:'',!PH_BIG.test(String(text||'')))}catch(e){}}
 /* 시합 개시 연출 (맵툴 switch_cutscene): rp.cutin.start = vs | warn | off. 레이드 보스가 있으면 경고 */
 function battleStartCut(b,force){const cfg=((A().ST.state.rp||{}).cutin)||{};const mode=force||cfg.start||'vs';if(mode==='off'||!CUT())return;
  /* 10-26 망령: 한 진영에 트레이너가 여럿(따로 세우기 · 개인전)이거나 합친 파티가 6체를 넘으면 — 이름을 모두, 그림 둘, 볼은 트레이너(6체)마다 한 줄 */
  const monsOf=ids=>Object.values(b.mons||{}).filter(m=>ids.includes(m.tid)).sort((x,y)=>(x.slot||0)-(y.slot||0));
  const pack=ms=>({balls:ms.slice(0,6).map(m=>m.hp.cur>0?1:0),mons:ms.slice(0,6).map(m=>({img:(!c_gm_or_seen(m))?'':m.image,name:(!c_gm_or_seen(m))?'비공개':m.name}))});
  const sideData=side=>{const ids=(((b.sides||{})[side]||{}).trainers||[]).filter(tid=>monsOf([tid]).length||(b.trainers||{})[tid]);const T=ids.map(tid=>(b.trainers||{})[tid]).filter(Boolean);const all=monsOf(ids);
   if(!T.length&&!all.length)return null;const t=T[0];
   if(T.length<=1&&all.length<=6)return Object.assign({img:t?trainerImg(t):(all[0]||{}).image||'',t:t?t.name:'야생의 '+(all[0]||{}).name,sub:t?['지시','육성','통솔','능력'].map(k=>k+' '+((t.ranks||{})[k]||'-')).join('·'):''},pack(all));
   const parts=[];if(T.length>1){for(const x of T){const ms=monsOf([x.id||ids[T.indexOf(x)]]);parts.push(Object.assign({t:x.name},pack(ms)))}}else{for(let i=0;i<all.length;i+=6)parts.push(Object.assign({t:''},pack(all.slice(i,i+6))))}
   const solo=T.some(x=>x.solo);return {img:t?trainerImg(t):'',img2:T[1]?trainerImg(T[1]):'',t:T.length>1?T.map(x=>x.name).join(solo?' · ':' & '):(t?t.name:''),sub:'',solo,parts,balls:parts[0].balls,mons:parts[0].mons}};
  function c_gm_or_seen(m){return !!(m.entry||m.seen)}   /* 지금 나와 있거나 한 번 나온 포켓몬만 그림·이름, 나머지는 볼 */
  const boss=Object.values(b.mons||{}).find(m=>m.raid&&+m.raid.segments>0);
  if(mode==='warn'||boss){const AM=Object.values(b.mons||{});const bm=boss||AM.find(m=>m.side==='right'&&m.entry)||AM.find(m=>m.side==='right')||AM[0]||(force?{name:'???',image:'',hp:{cur:1,max:1}}:null);if(bm){CUT().raid({img:bm.image,n:bm.name,title:cfg.warnTitle||(boss?'레이드 배틀 : '+boss.raid.segments:'강적 출현'),tape:cfg.warnTape||('⚠ WARNING ⚠ '+(cfg.warnTitle||(boss?'레이드 보스 출현':'강적 출현'))),nohp:cfg.warnHp?0:1,x:boss?boss.raid.segments:0,hp:(bm.hp.cur>0?Math.max(1,Math.round(bm.hp.cur/bm.hp.max*100)):0),ph:boss?boss.raid.phase||1:0,label:boss?'RAID BATTLE':'BATTLE'});return}}
  let L=sideData('left'),R=sideData('right');if(force&&!(L&&R)){const ex=(t,n)=>({img:'',t,sub:'',balls:Array(n).fill(1),mons:[]});L=L||ex('좌측 트레이너',6);R=R||ex('우측 트레이너',6);A().toast('배틀에 양쪽 파티가 없어서 예시로 띄웠다')}if(L&&R)CUT().vs(L,R)}/* 효과음은 로그를 보고 rp_ui 가 울린다 (모두 같은 로그를 받으니 좌석도 들린다) */
 /* ---------- 레이드 배틀 (맵툴 raid_set · raid_turnend · raid_phase · raid_cure · raid_reset_one) ----------
    배리어: 최대 HP × k/X 자리마다. 닿으면 깨지고(그 아래로는 그 피해에서 안 깎임) 회복해도 되살아나지 않는다.
    깨진 턴(또는 cond:every 면 매 턴)이 끝난 뒤 「트리거 : 페이즈 체인지」: ② 자신의 부정적인 상태(cstat: 능력치 하락도) 초기화 ③ 적진 전체 능력치 상승(rmod: 배율 강화도) 초기화 */
 async function raidFix(m,m0,name,L){if(!m.raid)return 0;const R=m.raid;const was=!!(m0&&m0.raid&&+m0.raid.segments>0);
  if(!(+R.segments>0)){let X=+((String(name||'').match(/(\d+)/)||[])[1])||0;   /* X 가 비어 있으면 포텐셜 이름 속 숫자 (레이드 배틀 : 4 → 4) */
   if(!X){const v=prompt('「레이드 배틀 : X」의 X를 정해 줘.\n최대 HP 의 1/X 마다 배리어가 생긴다.','3');if(v===null)return null;X=+v||3}R.segments=X}
  R.segments=Math.max(1,Math.floor(+R.segments));for(const [k,v] of [['cure',1],['cstat',1],['rup',1],['rmod',0]])if(R[k]==null||R[k]==='')R[k]=v;R.cond=R.cond||'cap';R.name=R.name||String(name||'');
  if(!was){R.broken=0;R.phase=+R.phase||1;delete R.brk}
  const X=R.segments,cap=Math.max(1,Math.floor(m.hp.max/X));
  const txt=`「레이드 배틀 : ${X}」 — 「HP : 1/${X}」(${cap})마다 배리어. 배리어 아래로 내려가는 피해는 받지 않고, 배리어는 닿으면 깨지며 회복해도 되살아나지 않는다. ${R.cond==='every'?'매 턴':'배리어가 깨진 턴'} 종료 이후 「트리거 : 페이즈 체인지」${+R.cure?`\n· 자신의 모든 부정적인 상태${+R.cstat?'(능력치 하락 포함)':''} 초기화`:''}${+R.rup?`\n· 적진 전체의 모든 능력치 상승${+R.rmod?'·강화':''} 초기화`:''}`;
  const i=L.findIndex(x=>/레이드 배틀 설정/.test(x));if(i>=0)L[i]=txt;else L.push(txt);return was?0:1}
 function raidCut(m){try{const cfg=((A().ST.state.rp||{}).cutin)||{};if(cfg.start==='off'||!CUT()||!CUT().raid)return;const R=m.raid||{};CUT().raid({img:m.image,n:m.name,title:'레이드 배틀 : '+R.segments,tape:'⚠ WARNING ⚠ 레이드 보스 출현',nohp:cfg.warnHp?0:1,x:R.segments,hp:m.hp.cur>0?Math.max(1,Math.round(m.hp.cur/m.hp.max*100)):0,ph:R.phase||1,label:'RAID BATTLE'})}catch(e){}}
 function modDrop(m,k){if(m.mod)delete m.mod[k];if(m.fx&&m.fx.mults)m.fx.mults=m.fx.mults.map(e=>{const st=Object.assign({},e.stats);delete st[k];return Object.assign({},e,{stats:st})}).filter(e=>Object.keys(e.stats).length)}
 function raidPhase(b,m,why){const R=m.raid;R.phase=(+R.phase||1)+1;const out=[`「트리거 : 페이즈 체인지」 ${m.name} · 페이즈 ${R.phase}${why?' ('+why+')':''}`];const RK=Object.assign({},STAT_KO,{critical:'급소'});const on=(k,d)=>R[k]==null||R[k]===''?d:+R[k];
  if(on('cure',1)){const NEG=(FX()&&FX().NEG)||[];const sdb=(DB().states||{}).st||{};const st=m.states||{};const c=[];for(const k of Object.keys(st))if(st[k]&&NEG.includes(k)){delete st[k];c.push(`「${(sdb[k]||{}).ko||k}」`)}
   if(m.seedFrom&&!st.LeechSeed)delete m.seedFrom;const d=[];
   if(on('cstat',1)){m.rank=m.rank||{};for(const k in m.rank)if(+m.rank[k]<0){d.push(`${RK[k]||k} ${m.rank[k]}→0`);m.rank[k]=0}for(const k in (m.mod||{}))if(+m.mod[k]<1){d.push(`${RK[k]||k} ×${m.mod[k]}→×1`);modDrop(m,k)}}
   out.push(c.length||d.length?`② 자신의 부정적인 상태를 초기화했다! ${c.join('')}${d.length?' / '+d.join(' '):''}`:'② 자신에게 초기화할 부정적인 상태가 없다.')}
  if(on('rup',1)){const e=[];for(const id in b.mons){const x=b.mons[id];if(x===m||!x.entry||x.hp.cur<=0||sameT(x,m,b))continue;const d=[];x.rank=x.rank||{};
    for(const k in x.rank)if(+x.rank[k]>0){d.push(`${RK[k]||k} +${x.rank[k]}→0`);x.rank[k]=0}if(x.tempRank)for(const k in x.tempRank)if(+x.tempRank[k]>0)delete x.tempRank[k];
    if(on('rmod',0))for(const k in (x.mod||{}))if(+x.mod[k]>1){d.push(`${RK[k]||k} ×${x.mod[k]}→×1`);modDrop(x,k);if(x.tempMod)delete x.tempMod[k]}
    if(d.length)e.push(`「${x.name}」 ${d.join(' ')}`)}
   out.push(e.length?`③ 적진 전체의 능력치 상승을 초기화했다!\n   ${e.join('\n   ')}`:'③ 적진에 초기화할 능력치 상승이 없다.')}
  return out}
 /* 수동 페이즈 체인지 (버프 관리 raid_pc) */
 async function raidPhaseNow(mid,why){const c=ctx();if(!c.mgr)return;const b0=snap(c.b),b=snap(b0);const m=b.mons[mid];if(!m||!m.raid)return;const L=raidPhase(b,m,why||'수동 발동');delete m.raid.brk;if(await saveBattle(b0,b))A().sysLog(`【레이드】 ${L.join('\n')}`,'battle',{mid,img:m.image||''})}
 /* 「레이드 배틀 : 4」 ②: 「3」 배수 턴의 가장 마지막에 추가 행동 (【사전】 공개) — 맵툴처럼 손으로 하되 알려 준다 */
 function raidExtra(b){const t=+b.turn||0;if(!t||t%3)return;for(const id in b.mons){const m=b.mons[id];if(!m.raid||!(+m.raid.segments>0)||!m.entry||m.hp.cur<=0)continue;const p=potSrc(m).find(p=>p&&/레이드 배틀/.test(p.name||'')&&/추가 행동/.test(p.eff||''));if(p)A().sysLog(`【레이드】 ${m.name} — 「3」의 배수 턴(턴 ${t})의 가장 마지막: 추가 행동을 얻는다 (【사전】에 공개)`,'battle',{mid:m.id,img:m.image||''})}}
 function raidFloor(m){if(!m||!m.raid||!(+m.raid.segments>0))return 0;const X=+m.raid.segments,br=+m.raid.broken||0;let fl=0;for(let k=X-1-br;k>=1;k--){const v=Math.floor(m.hp.max*k/X);if(v<m.hp.cur){fl=v;break}}return fl}
 /* 10-26 망령: 행동 순서가 나온 뒤에 발동한 우선도(선행유턴 · 지휘봉 …)는 아직 행동하지 않은 칸들 사이에서 다시 줄을 세운다 */
 function prioNow(mid){try{const m=(ctx().b.mons||{})[mid];return m&&FX()&&FX().prioOf?FX().prioOf(m,{prio:0,cat:'',typeEn:''}):0}catch(e){return 0}}
 async function reprio(mid,before,tries){tries=tries||0;await new Promise(r=>setTimeout(r,700));const b=ctx().b;const ph=+b.phase||0;if(ph<2)return;const d=prioNow(mid)-before;if(!d){if(tries<6)return reprio(mid,before,tries+1);return}
  const O=(b.order||[]).map(o=>Object.assign({},o));const i=ph===2?-1:(+b.orderIdx||0);const k=O.findIndex(o=>o.mid===mid&&!o.change);if(k<0||k<=i)return;O[k].prio=(+O[k].prio||0)+d;
  const head=O.slice(0,i+1),tail=O.slice(i+1);tail.sort((a,c)=>((c.started||0)-(a.started||0))||((c.change||0)-(a.change||0))||((c.order||0)-(a.order||0))||((c.prio||0)-(a.prio||0))||((c.speed||0)-(a.speed||0))||((c.dice||0)-(a.dice||0)));
  const NO=head.concat(tail);if(NO.map(o=>o.mid).join()===O.map(o=>o.mid).join()&&O[k].prio===(+((b.order||[])[k]||{}).prio||0))return;await A().set(['battle','order'],NO);
  A().sysLog(`${(b.mons[mid]||{}).name||'?'} 우선도 ${d>0?'+':''}${d} — 남은 행동 순서를 다시 정했다\n${NO.slice(i+1).map((o,j)=>`${i+2+j}. ${o.name}${o.change?' (교대)':''}`).join('\n')}`,'battle')}
 /* 10-26 망령: 브라우저 확인창(confirm) 대신 창 안 확인 — 확인창이 막히거나 취소되어 진행이 멈추던 것 */
 /* 11-03 감우 (검토 16): 공격 창 결과 — 표로 스크롤 · 휴대폰 sticky 요약 줄 (.asum1, 760px 이하에서만 보인다) */
 function aScroll(md){try{const ar=md.querySelector('#ares');if(ar&&ar.firstElementChild)setTimeout(()=>ar.scrollIntoView({behavior:'smooth',block:'start'}),30)}catch(e){}}
 function aSum(md,html){try{let s1=md.querySelector('.asum1');if(!s1){s1=document.createElement('div');s1.className='asum1';const h=md.querySelector('.mhead');if(h)h.after(s1);else md.prepend(s1)}s1.innerHTML=html;s1.classList.add('on')}catch(e){}}
 function askYes(q,yes,no){return new Promise(res=>{const md=A().openModal(`<div class="mhead"><h2>확인</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="small" style="white-space:pre-wrap;margin-bottom:10px">${esc(String(q||''))}</div><div class="row"><span class="sp"></span><button class="btn" data-ay="0">${esc(no||'아니요')}</button><button class="btn pri" data-ay="1">${esc(yes||'예')}</button></div>`);let done=false;const fin=v=>{if(done)return;done=true;A().closeModal();res(v)};md.querySelectorAll('[data-ay]').forEach(b=>b.onclick=()=>fin(b.dataset.ay==='1'));const x=md.querySelector('[data-x]');if(x)x.addEventListener('click',()=>{if(!done){done=true;res(false)}})})}
 /* ---------- 공격 ---------- */
 /* 「기술 방어」 기술 (방어 · 판별 · 니들가드 · 킹실드 …): 효과 글로 알아본다. 무시하는 기술: 「방어」 상태를 무시 (해제면 'clear') */
 /* 속임수 (10-26): 「대상의 「공격」으로 대미지 계산」 — 공격 쪽 능력치 · 랭크 · 배율을 대상 것으로 */
 const FOUL_RE=/대상의\s*「공격」으로\s*대미지\s*계산/;
 /* 11-03 망령: 「기술 X 를 내보낸다. 이때, 자신의 「공격」을 가장 높은 종족치와 같은 랭크로」 — 그 기술 한 번만. 공격 창의 대미지 계산에만 쓰는 그림자 (저장되는 포켓몬은 그대로) */
 function topShadow(m,top){if(!m||!top||!top.length||!Array.isArray(m.base))return m;const St=S();const G=((DB().maker||{}).grade)||[];const IDX=['hp','attack','defense','specialattack','specialdefense','speed'],KO=['HP','공격','방어','특공','특방','스피드'];const base=m.base.map(v=>+v||0);const nb=base.slice();const notes=[];
  for(const k of top){const i=IDX.indexOf(k);if(i<1)continue;let mx=-1;base.forEach((v,j)=>{if(j!==i&&v>mx)mx=v});const g=St.gradeOf(mx);if(mx<=base[i]||g===St.gradeOf(base[i]))continue;const row=G.find(r=>r[1]===g);if(!row)continue;nb[i]=+row[0];notes.push(`${KO[i]} 종족치 ${base[i]}→${nb[i]} (${g})`)}
  if(!notes.length)return m;const s0=St.statsOf(base,m.iv,m.ev,m.lv),s1=St.statsOf(nb,m.iv,m.ev,m.lv);const x=Object.assign({},m);x.stats=(m.stats||[]).slice();for(let i=1;i<6;i++)if(nb[i]!==base[i])x.stats[i]=Math.max(1,(+x.stats[i]||0)+s1[i]-s0[i]);x.topNote=notes.join(' · ');return x}
 function foulAtk(atk,def,mv){if(!def||!FOUL_RE.test(String((mv||{}).eff||'')))return atk;const x=Object.assign({},atk);x.stats=(atk.stats||[]).slice();x.stats[1]=(def.stats||[])[1]||x.stats[1];x.rank=Object.assign({},atk.rank||{},{attack:+((def.rank||{}).attack||0)});x.mod=Object.assign({},atk.mod||{},{attack:+((def.mod||{}).attack||1)});return x}
 /* 이제 창이 알아서 하는 「손으로」 문장 (속임수 · 날씨 차지 생략 · 날씨 위력 반감 · 난동부리기) */
 const autoNote=t=>FOUL_RE.test(String(t))||/「날씨\s*:[^」]*」일 때 「차지」를 생략|「날씨\s*:[^」]*」일 때 「필중기」|「날씨\s*:[^」]*」일 때 「명중\s*:\s*\d+」|「날씨\s*:[^」]*」일 때 위력을 반감|「기술 방어」\s*상태가 된다|^「난동부리기\s*\(혼란\)\s*:\s*\d+~\d+회」$/.test(String(t).trim());
 const protMove=mv=>/「(기술|공격) 방어」\s*상태가 된다/.test(String((mv||{}).eff||''));
 const protBypass=mv=>{const e=String((mv||{}).eff||'');if(!/「방어」(?:「[^」]*」)*\s*상태를\s*무시/.test(e))return '';return /무시\(해제\)|해제한다/.test(e)?'clear':'pass'};
 /* 10-26 망령: 숙달 지령 ② 는 정해진 때에 【임의】로 쓸 수 있다 — 명중굴림 전(공격 창)에 쓸 수 있는 것을 알려 준다.
    아군(공격하는 쪽): 숙달 공격 · 특공 · 저격 / 상대(맞는 쪽): 숙달 방어 · 특방 · 회피. 【공유 (『지령』)】 이라 그 턴에 지령을 이미 썼으면 못 쓴다 */
 function masterUsable(b,tid,re){const t=(b.trainers||{})[tid];if(!t)return [];const fired=(((b.cmds||{})[tid]||{}).fired)||{};if(Object.values(fired).some(x=>x&&x.command))return [];
  return OO().commandKeys(t).map(k=>({k,n:OO().commandName(t,k)})).filter(x=>re.test(x.n)&&(+(t.orderCount||{})['command_'+x.k]||0)>0)}
 function masterHint(b,atk){if(!b||!atk)return '';const T=b.trainers||{};const rows=[];
  const mine=masterUsable(b,atk.tid,/^숙달(공격|특공|저격)지령$/);if(mine.length)rows.push({tid:atk.tid,who:(T[atk.tid]||{}).name||'',list:mine});
  for(const [tid,t] of Object.entries(T)){if(tid===atk.tid||t.side===(T[atk.tid]||{}).side)continue;const l=masterUsable(b,tid,/^숙달(방어|특방|회피)지령$/);if(l.length)rows.push({tid,who:t.name||'',list:l})}
  if(!rows.length)return '';
  return `<div class="small amaster" style="margin:6px 0;padding:6px 8px;border:1px dashed var(--line,#888);border-radius:8px">💡 명중굴림 전 — 【임의】로 쓸 수 있는 숙달 지령: ${rows.map(r=>`<b>${esc(r.who)}</b> ${r.list.map(x=>`『${esc(x.n)}』`).join(' ')} <button type="button" class="btn xs" data-amfire="${esc(r.tid)}">발동 창</button>`).join(' · ')}<br><span class="dim">쓰면 이 창은 닫힌다 — 발동한 뒤 공격을 다시 연다.</span></div>`}
 /* 효과 엔진의 확률 보정(「발동 확률 +N%p」 · 「확률 효과 반드시」)을 부가효과 칸 기본값으로 — 횟수가 있는 것은 알림만(손으로 넣고 「발동」 버튼으로 횟수를 쓴다) */
 function chanceLive(m){const t=+(ctx().b||{}).turn||0;return ((m&&m.fx&&m.fx.chance)||[]).filter(e=>!(e.until>=0&&t>e.until)&&e.uses!==0)}
 function secAdd0(m){return chanceLive(m).filter(e=>e.uses<0&&!e.sure).reduce((a,e)=>a+(+e.v||0),0)}
 function secSure0(m){return chanceLive(m).some(e=>e.uses<0&&e.sure)}
 function secNote(m){const L=chanceLive(m);if(!L.length)return '1할 = 10%p';return L.map(e=>`「${esc(e.name)}」 ${e.sure?'반드시':((e.v>0?'+':'')+e.v+'%p')}${e.uses>0?` (${e.uses}회 — 손으로)`:''}`).join(' · ')}
 function openAttack(mid,opt){opt=opt||{};const c=ctx();const b=c.b;const atk=b.mons[mid];if(!atk||!canEdit(c,atk))return;const f=fieldOf(b);const atkD=topShadow(atk,opt.baseTop);
  /* 11-03 「기술사용」 · 「추가공격」: opt.mvName(기술 이름 — 목록에 없으면 기술 DB 에서 잠시 붙인다) · opt.targets · opt.extra {pw, sure, left, name} */
  delete XMV[mid];let OPI=-1;if(opt.mvName){OPI=MVS(atk).findIndex(q=>q&&q.name===opt.mvName);if(OPI<0){const nm2=String(opt.mvName).trim();const mv=window.OM_IMPORT&&window.OM_IMPORT.move?window.OM_IMPORT.move(nm2,false):null;if(!mv||!mv.name){A().toast(`기술 「${nm2}」를 기술 DB 에서 못 찾았다`);return}XMV[mid]=Object.assign({},mv,{fromFx:opt.by||''});OPI=MVS(atk).length-1}}
  const MVT=mv=>{if(!mv)return '';const L=spL(atk,'mvtype');const e=L.find(x=>x.mv&&x.mv===mv.name)||L.find(x=>!x.mv&&x.from&&mvTysRaw(mv).includes(x.from))||L.find(x=>!x.mv&&!x.from);return e?e.to:''};
  const RM=k=>+((f.rooms||{})[k]||0)>0;/* 10-25 망령: 송전 · 침수 · 악인 상태면 다음 기술이 전기 · 물 · 악 타입 (여럿이면 맨 끝 것 — 손으로 바꿀 수 있다) */const TYS0=[['Electrify','Electric'],['Flooding','Water'],['Knave','Dark']].filter(([k])=>+((atk.states||{})[k]||0)>0);let ATY=TYS0.length?TYS0[TYS0.length-1][1]:'';const tyOf=mv=>ATY||MVT(mv)||(RM('블랙룸')&&mv.cat!=='변화'?'Ghost':((skinOf(atk,mv)||{}).ty||mv.typeEn));
  /* 10-24 제안: 공격 창에서 기술 타입을 바꾼다 (타입을 바꾸는 특성 · 포텐셜 · 웨더볼 등) — 고르면 그 한 타입으로 상성 · 자속 · 날씨 · 소지품을 다시 본다 */
  const mtys=mv=>ATY?[ATY]:MVT(mv)?[MVT(mv)]:(RM('블랙룸')&&mv.cat!=='변화'?['Ghost']:skinOf(atk,mv)?[skinOf(atk,mv).ty]:String(mv.type||'').split(/[()/,]/).map(t=>t.trim()).filter(Boolean).map(S().typeEn));
  const TYS=['Normal','Fire','Water','Grass','Electric','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];   /* 블랙룸: 모든 공격 기술이 고스트 */
  const x0=(((b.cmds||{})[atk.tid]||{}).mons||{})[mid]||{};const x=x0.tm?Object.assign({},x0,{targets:tgNow(b,x0,atk)}):x0;const slots=allEntered(b);
  /* 10-26 망령: 따라가때리기(교대 전 선제)처럼 지시가 아직 공개되지 않은 채 창을 열면 순서 칸에 적힌 기술 · 대상으로 */
  const OE=(b.order||[]).find(o=>o.mid===mid&&o.move);const oeIdx=OE?MVS(atk).findIndex(q=>String(q.name)===String(OE.move)):-1;
  const defMoveIdx=OPI>=0?OPI:opt.mvIdx!=null?+opt.mvIdx:x.move!==''&&x.move!=='switch'&&x.move!=null?+x.move:oeIdx>=0?oeIdx:((atk.states||{}).Oblivion?MVS(atk).findIndex(q=>q.name==='발버둥'):0);
  let T0=((x.targets&&x.targets.length)?x.targets:(OE&&OE.targets)||[]).filter(s=>slots.some(z=>z.slot===s));let lostNote='';{const lost=(x.targets||[]).filter(s=>!slots.some(z=>z.slot===s));const mv0=MVS(atk)[defMoveIdx];
   if(lost.length&&!T0.length){const foes=slots.filter(z=>!sameT(z.mon,atk,b));const nm=lost.map(s=>{const [sd,ar]=s.split('_');const q=Object.values(b.mons||{}).find(o=>o.side===sd&&o.entry===ar);return q?q.name:s.replace('_',' ').toUpperCase()}).join(', ');
    if(mv0&&(mv0.cat!=='변화'||String(mv0.range||'')==='1체')&&foes.length===1){T0=[foes[0].slot];lostNote=`<div class="small" style="color:var(--yel2);margin:2px 0 4px">지시한 대상(${esc(nm)})이 쓰러져 있어 남은 상대 ${esc(foes[0].mon.name)}(으)로 바꿨다</div>`}
    else lostNote=`<div class="small" style="color:var(--yel2);margin:2px 0 4px">지시한 대상(${esc(nm)})이 쓰러져 있다 — 다른 대상을 골라 줘</div>`}}
  /* 10-23 망령: 「난동부리기」 — 대상은 적진에서 랜덤 (지시에서 손으로 고른 대상이 있으면 그대로). 같은 턴에 창을 다시 열어도 같은 대상 */
  let thrNote='';if((atk.states||{}).Thrash&&!x.tman){const mv0=MVS(atk)[defMoveIdx];const foes=slots.filter(z=>!sameT(z.mon,atk,b));const multi=/전체|적진|자진|자신/.test(String((mv0||{}).range||''));
   if(mv0&&mv0.cat!=='변화'&&!multi&&foes.length){const tk=mid+':'+(+b.turn||0);let pick=foes.find(z=>z.slot===THR_PICK[tk]);if(!pick){pick=foes[Math.floor(Math.random()*foes.length)];THR_PICK[tk]=pick.slot}T0=[pick.slot];lostNote='';
    thrNote=`<div class="small" style="color:var(--yel2);margin:2px 0 4px">「난동부리기」 — 적진에서 랜덤으로 ${esc(pick.mon.name)}(을)를 골랐다 · 눌러서 바꿀 수 있다</div>`}}
  if(opt.targets&&opt.targets.length)T0=opt.targets.filter(sl=>slots.some(z=>z.slot===sl));
  {const rd=redirectOf(b,atk,MVS(atk)[defMoveIdx]);if(rd&&!opt.targets&&!(T0.length===1&&T0[0]===rd.slot)){T0=[rd.slot];lostNote+=`<div class="small" style="color:var(--yel2);margin:2px 0 4px">${esc(rd.mon.name)} 「${esc(rd.e.name)}」 — 대상을 끌어왔다</div>`}}
  const md=A().openModal(`<div class="mhead"><h2>${opt.extra?'추가 공격':opt.mvName?'기술 사용':'공격'} — ${esc(atk.name)}${opt.extra?` <small class="dim">「${esc(opt.extra.name||'')}」 위력 ×${esc(String(opt.extra.pw))}${opt.extra.sure?' · 필중':''}</small>`:opt.by?` <small class="dim">「${esc(opt.by)}」${atkD.topNote?' · 이 기술만 '+esc(atkD.topNote):''}</small>`:''}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <select id="amove" hidden>${MVS(atk).map((mv,i)=>`<option value="${i}" ${i===defMoveIdx?'selected':''}>${esc(mv.name)}</option>`).join('')}</select>
   <div class="sec">기술</div><div class="mvg" id="amvg">${MVS(atk).map((mv,i)=>moveCard(mv,i,i===defMoveIdx,`data-amv="${i}"`)).join('')}</div>
   <div class="amefw"><div class="amhd" id="amhd"></div><div class="mef amef" id="amef"></div></div><div class="row small" style="margin-top:6px"><label>위력 <input type="number" class="n" id="apow"></label><label title="이번 공격만 기술 타입을 바꾼다 (타입을 바꾸는 특성 · 포텐셜 등)">타입 <select id="atype"><option value="">기술 그대로</option>${TYS.map(t=>`<option value="${t}">${esc(S().typeKo(t))}</option>`).join('')}</select></label><label title="트레이너 「통솔」 A 이상이면 기본값에 명중 보정이 들어 있다">명중 배율 <input type="number" step="0.01" class="n" id="aacc" value="${leadAcc(atk)}">${leadAcc(atk)!==1?` <span class="small dim">통솔 ×${leadAcc(atk)}</span>`:''}</label><label class="tgc asurel" title="이 공격은 명중 판정 없이 맞는다 (필중화 · 록온 · 마음의눈 등)"><input type="checkbox" id="asure"> 필중화</label></div>
   ${masterHint(b,atk)}<div class="sec">대상 <span class="note">누르면 고르고 푼다</span></div>${lostNote}${thrNote}<div id="aboard">${board(b,atk.side,(slot)=>T0.includes(slot),(slot)=>`data-at="${slot}"`,false,atk)}</div>
   <div id="aprev" class="aprev"></div>
   <div hidden>${slots.map(s=>`<input type="checkbox" data-t="${s.slot}" ${T0.includes(s.slot)?'checked':''}>`).join('')}</div>
   <div class="sec">보정 <span class="note">바꾼 것만 위에 모인다 · ✕ 로 되돌림</span></div><div class="achg" id="achg"></div>
   <details class="agrp" data-ag0="crit"><summary>급소<span class="asum" data-asum="crit"></span></summary><div class="agrid"><label>급소 +<input type="number" class="n" id="acrit" value="0" title="입력 보정"></label><label title="「지시」 랭크 보정은 대상마다 자동으로 들어간다. 이 칸은 그 위에 더한다">급소 지시 추가 <input type="number" class="n" id="acritord" value="0"> <span class="small dim aordh" id="aordh"></span></label><label>급소 표 <select id="acrittype"><option value="">포켓몬 설정대로</option><option value="0">기본 (6.25 → 12.5 → 25 → 50 → 100%)</option><option value="2">5세대 (6.25 → 12.5 → 25 → 33.3 → 50%)</option><option value="1">6세대 (6.25 → 12.5 → 50 → 100%)</option><option value="3">7세대 이후 (4.17 → 12.5 → 50 → 100%)</option></select></label><label>급소 대미지 <select id="acritmul"><option value="">포켓몬 설정대로</option><option value="1.5">×1.5 (6세대 이후)</option><option value="2">×2 (5세대까지)</option><option value="2.25">×2.25</option><option value="2.5">×2.5</option><option value="3">×3</option></select></label><label class="tgc"><input type="checkbox" id="acritforce"> 급소 확정</label></div></details><details class="agrp" data-ag0="mul"><summary>배율<span class="asum" data-asum="mul"></span></summary><div class="agrid"><label>자유 1 <input type="number" step="0.01" class="n" id="afree1" value="1"></label><label>자유 2 <input type="number" step="0.01" class="n" id="afree2" value="1"></label><label>아이템 1 <input type="number" step="0.01" class="n" id="aitem1" value="1"></label><label>아이템 2 <input type="number" step="0.01" class="n" id="aitem2" value="1"></label><label>특성 <input type="number" step="0.01" class="n" id="atrait" value="1"></label><label>날씨 <input type="number" step="0.01" class="n" id="aweather" value="1"></label><label>필드 <input type="number" step="0.01" class="n" id="afield" value="1"></label></div></details><details class="agrp" data-ag0="stat"><summary>능력 · 무시<span class="asum" data-asum="stat"></span></summary><div class="agrid"><label>공격 능력 <select id="aatk"><option value="">기본</option>${['attack','specialattack','defense','specialdefense','speed'].map(k=>`<option value="${k}">${STAT_KO[k]}</option>`).join('')}</select></label><label>방어 능력 <select id="adef"><option value="">기본</option>${['defense','specialdefense','attack','specialattack','speed'].map(k=>`<option value="${k}">${STAT_KO[k]}</option>`).join('')}</select></label><label>공격 측 무시 <select id="aigatk"><option value="-1">없음</option><option value="0">상승·강화 (랭크+ · 배율×)</option><option value="2">상승만 (랭크+)</option><option value="3">강화만 (배율×)</option><option value="1">감소·저하</option><option value="4">감소만 (랭크−)</option><option value="5">저하만 (배율)</option><option value="6">랭크 변화 모두</option><option value="7">변화 모두</option></select></label><label>방어 측 무시 <select id="aigdef"><option value="-1">없음</option><option value="0">상승·강화 (랭크+ · 배율×)</option><option value="2">상승만 (랭크+)</option><option value="3">강화만 (배율×)</option><option value="1">감소·저하</option><option value="4">감소만 (랭크−)</option><option value="5">저하만 (배율)</option><option value="6">랭크 변화 모두</option><option value="7">변화 모두</option></select></label></div></details><details class="agrp" data-ag0="eff"><summary>상성<span class="asum" data-asum="eff"></span></summary><div class="agrid"><label>복합 상성 <select id="amulti"><option value="0">첫 타입</option><option value="1">상대에게 유리</option><option value="2">상대에게 불리</option></select></label><label>상성 강제 <select id="aforce"><option value="">없음</option><option value="4">4</option><option value="2">2</option><option value="1">1</option><option value="0.5">½</option><option value="0.25">¼</option><option value="0">무효</option></select></label></div></details><details class="agrp" data-ag0="etc"><summary>기타<span class="asum" data-asum="etc"></span></summary><div class="agrid"><label>연속 <input type="number" class="n" id="ahits" placeholder="자동"></label><span class="small dim amhint" id="amhint"></span><label class="tgc"><input type="checkbox" id="ahelp" ${(atk.states||{}).HelpingHand?'checked':''}> 도우미 1.5</label><label class="tgc"><input type="checkbox" id="acharge"> 충전계 ×2</label><label class="tgc"><input type="checkbox" id="alife" ${IT(atk)==='생명의구슬'?'checked':''}> 생명의구슬 1.3</label><label class="tgc"><input type="checkbox" id="aadapt"> 적응력 (자속 2배)</label><label class="tgc"><input type="checkbox" id="abelt" ${IT(atk)==='달인의띠'?'checked':''}> 달인의띠 1.2</label><label class="tgc"><input type="checkbox" id="askill" ${atk.ability==='스킬링크'?'checked':''}> 스킬링크</label></div></details>
   <details class="agrp" data-ag0="sec"><summary>부가효과<span class="asum" data-asum="sec"></span></summary><div class="agrid"><label title="기술의 부가효과(N할) 발동 확률에 더한다. 1할 = 10%p">확률 +<input type="number" class="n" id="asecadd" value="${secAdd0(atk)}" step="10">%p</label><label class="tgc"><input type="checkbox" id="asecsure" ${secSure0(atk)?'checked':''}> 반드시 발동</label><span class="small dim">${secNote(atk)}</span></div></details>
   <div id="ares"></div>
   <div class="row afoot"><label class="small tgc" title="풀죽음 → 잠듦 → 마비 → 얼음 → 헤롱헤롱 → 혼란 순서로 판정 (맵툴 check_attack)"><input type="checkbox" id="achk" checked> 행동 판정 먼저</label><span class="sp"></span><button class="btn" id="aroll">굴리기</button><button class="btn pri" id="aapply" disabled>적용</button></div>`);
  md.querySelectorAll('[data-amfire]').forEach(bt=>bt.onclick=()=>{A().closeModal();openFire(bt.dataset.amfire)});
  const mvSel=$('#amove',md);
  const syncBoard=()=>{md.querySelectorAll('[data-at]').forEach(t=>{const cb=md.querySelector(`[data-t="${t.dataset.at}"]`);t.classList.toggle('on',!!(cb&&cb.checked));const tk=t.querySelector('.tk');if(tk)tk.textContent=cb&&cb.checked?'✓':''})};
  md.querySelectorAll('[data-at]').forEach(t=>t.onclick=()=>{const cb=md.querySelector(`[data-t="${t.dataset.at}"]`);if(cb){cb.checked=!cb.checked;syncBoard()}});
  md.querySelectorAll('[data-amv]').forEach(cd=>cd.onclick=()=>{if(extGone(MVS(atk)[+cd.dataset.amv]))A().toast('이 기능 확장은 이번 시합에서 다 썼다 — 판정을 바로잡을 때만 쓴다');mvSel.value=cd.dataset.amv;md.querySelectorAll('[data-amv]').forEach(q=>q.classList.toggle('on',q===cd));syncMove()});
  const syncMove=()=>{const mv=MVS(atk)[+mvSel.value]||{};{const el=$('#aadapt',md);if(el){const on=teraSame(atk)&&mtys(mv).includes(atk.teraEn);if(on||el.dataset.tera==='1'){el.checked=on;el.dataset.tera=on?'1':''}el.parentNode.title=on?'테라스탈 — 원래 타입과 같은 테라 타입 기술이라 자동으로 켬':''}}   /* 11-02 망령: 같은 타입 테라스탈 = 적응력 자동 */const pst=powStepOf(mv);$('#apow',md).value=mv.pow||pst||0;{const h=$('#amhint',md),mn=+mv.min||1,mx=+mv.max||1;if(h)h.textContent=(mx<=1?'':mn===mx?`${mx}회 연속기 — 매 회 명중 판정`:`${mn}~${mx}회 연속기 — 첫 명중 뒤 확정`)+(pst?` · 맞을 때마다 위력 +${pst} (위력 칸 = 1타)`:'')}{const oe=(b.order||[]).find(o=>o.mid===mid&&o.pursuitHit);const pv=oe&&b.mons[oe.pursuitHit];if(oe&&pv&&pv.entry&&String(mv.name)===String(oe.move)){const x2=pursuitX2(mv);if(x2)$('#apow',md).value=(+mv.pow||0)*2;setTimeout(()=>{const e2=$('#amef',md);if(e2)e2.textContent='【따라가때리기 — 교대하려는 '+pv.name+'에게 먼저'+(x2?' · 위력 2배':'')+'】 '+e2.textContent},0)}}{const a=moveAuto(mv);$('#acritforce',md).checked=!!(a&&a.critSure)}{const e=String(mv.eff||''),W=String(f.weather.type||'');const wl=(re)=>{const r=e.match(re);return r?r[1].split(/[,，]\s*/).map(x=>x.trim()):null};const skip=wl(/「날씨\s*:\s*([^」]+)」일 때 「차지」를 생략/),half=wl(/「날씨\s*:\s*([^」]+)」일 때 위력을 반감/);const nt=[];
    /* 11-01 망령 「날씨 부가 효과」: 「날씨 : X」일 때 「필중기」 · 「명중 : N」도 창이 맞춘다 (번개 · 폭풍 · 눈보라 · 코멧펀치 …) */const wsure=wl(/「날씨\s*:\s*([^」]+)」일 때 「필중기」/),wacm=e.match(/「날씨\s*:\s*([^」]+)」일 때 「명중\s*:\s*(\d+)」/);md.dataset.wsure=wsure&&W&&wsure.some(x=>wxSame(x,W))?'1':'';md.dataset.wacc=wacm&&W&&wacm[1].split(/[,，]\s*/).some(x=>wxSame(x.trim(),W))?wacm[2]:'';if(md.dataset.wsure)nt.push('「'+W+'」 — 필중');if(md.dataset.wacc)nt.push('「'+W+'」 — 명중 '+md.dataset.wacc);
    if(skip&&W&&skip.includes(W))nt.push('「'+W+'」 — 차지 없이 바로');else if(/「차지」/.test(e))nt.push('「차지」 기술 — 첫 턴은 모으기');if(half&&W&&half.includes(W)){$('#apow',md).value=Math.floor((+mv.pow||0)/2);nt.push('「'+W+'」 — 위력 반감')}
    if(nt.length)setTimeout(()=>{const e2=$('#amef',md);if(e2)e2.textContent='【'+nt.join(' · ')+'】 '+e2.textContent},0)}
   if(FOUL_RE.test(String(mv.eff||'')))setTimeout(()=>{const e2=$('#amef',md);if(e2)e2.textContent='【대상의 「공격」으로 계산 — 자동】 '+e2.textContent},0);{const st=atk.states||{};$('#acharge',md).checked=mv.cat!=='변화'&&Object.keys(CHARGE_ST).some(k=>st[k]&&tyOf(mv)===CHARGE_ST[k])}$('#amef',md).textContent=(SPMAP[String(mv.name||'').trim()]?'【변칙 위력 — 대상마다 자동 계산】 ':'')+String(mv.eff||'').replace(/<br\s*\/?>/gi,'\n');{const col=S().typeColor(tyOf(mv));$('#amhd',md).innerHTML=`<span class="amty" style="background:${col.bg};color:${col.fg}">${esc(S().typeKo(tyOf(mv))||mv.type||'')}</span><b>${esc(mv.name||'')}</b><span class="dim">${esc(mv.cat||'')} · 위력 ${mv.pow||'-'} · 명중 ${mv.acc||'필중'}${mv.prio?' · 우선 '+mv.prio:''} · ${esc(mv.range||'')}${mv.tag&&mv.tag!=='-'?' · '+esc(mv.tag):''}</span>`}const T0=tyOf(mv);const wm=WEATHER_MUL[f.weather.type]||{};$('#aweather',md).value=wm[T0]!=null?wm[T0]:1;{const sk=!ATY&&skinOf(atk,mv);$('#atrait',md).value=sk?sk.mul:1;if(sk)setTimeout(()=>{const e2=$('#amef',md);if(e2)e2.textContent='【특성 「'+sk.name+'」 '+S().typeKo(sk.ty)+' 기술 · 위력 ×'+sk.mul+'】 '+e2.textContent},0)}
   /* 필드 강화는 땅 위의 공격자만 (미스트필드의 드래곤 반감은 대상마다 따로) */
   let fm=1;const ft=f.terrain.type;if(grd(atk)){if(ft==='그래스필드'&&T0==='Grass')fm=1.3;if(ft==='일렉트릭필드'&&T0==='Electric')fm=1.3;if(ft==='사이코필드'&&T0==='Psychic')fm=1.3}$('#afield',md).value=fm;
   /* 소지품 위력 (검은띠 · 쥬얼 · 구애머리띠 …): 기술을 고를 때 「아이템 1」 칸에 넣는다 */
   {const tys=mtys(mv);const im=OI()?OI().atkMul(atk,{types:tys,cat:mv.cat,single:String(mv.range||'')==='1체'}):null;$('#aitem1',md).value=im?im.v:1;md.dataset.it1=im&&im.txt?String(im.txt):'';md.dataset.jewel=im&&im.jewel?'1':'';if(im)setTimeout(()=>{const e2=$('#amef',md);if(e2)e2.textContent='【소지품 '+im.txt+'】 '+e2.textContent},0)}
   {const rn=[...(RM('블랙룸')&&mv.cat!=='변화'?['블랙룸: 고스트 기술로']:[]),...(RM('원더룸')?['원더룸: 방어↔특방']:[]),...(RM('매직룸')?['매직룸: 소지품 무효']:[]),...(ft&&['그래스필드','일렉트릭필드','사이코필드'].includes(ft)&&!grd(atk)?['떠 있어 '+ft+' 강화 없음']:[])];if(rn.length)setTimeout(()=>{const e2=$('#amef',md);if(e2)e2.textContent='【'+rn.join(' · ')+'】 '+e2.textContent},0)}
   const dflt=(OE&&+mvSel.value===oeIdx&&(OE.targets||[]).length)?OE.targets:defaultTargets(b,mid,String(mvSel.value));if(x.move==null||x.move===''||+x.move!==+mvSel.value){md.querySelectorAll('[data-t]').forEach(cb=>cb.checked=dflt.includes(cb.dataset.t))}syncBoard()};
  mvSel.onchange=syncMove;
  {const ts=$('#atype',md);if(ts)ts.addEventListener('change',()=>{const pw=$('#apow',md).value;ATY=ts.value;syncMove();$('#apow',md).value=pw;ts.closest('label').classList.toggle('chgd',!!ATY)})}
  {const ts=$('#atype',md);if(ts&&ATY){ts.value=ATY;ts.closest('label').classList.add('chgd');ts.closest('label').title=`「${TYS0.map(([k])=>({Electrify:'송전',Flooding:'침수',Knave:'악인'})[k]).join(' · ')}」 상태 — 이 기술은 ${S().typeKo(ATY)} 타입`}}
  /* 보정: 바꾼 것만 위로 모아 보여 주고 ✕ 로 기본값 */
  const AF=[['acrit','급소 +',0,'crit'],['acritord','급소 지시 추가 ',0,'crit'],['acrittype','급소 표 ','','crit'],['acritmul','급소 대미지 ','','crit'],['acritforce','급소 확정',false,'crit'],['afree1','자유1 ×',1,'mul'],['afree2','자유2 ×',1,'mul'],['aitem1','아이템1 ×',1,'mul'],['aitem2','아이템2 ×',1,'mul'],['atrait','특성 ×',1,'mul'],['aweather','날씨 ×',1,'mul'],['afield','필드 ×',1,'mul'],['aatk','공격 능력 ',''],['adef','방어 능력 ',''],['aigatk','공격 측 무시 ','-1'],['aigdef','방어 측 무시 ','-1'],['amulti','복합 상성 ','0'],['aforce','상성 강제 ',''],['ahits','연속 ',''],['ahelp','도우미',false],['acharge','충전계',false],['alife','생명의구슬',false],['aadapt','적응력',false],['abelt','달인의띠',false],['askill','스킬링크',false],['asure','필중',false],['asecadd','부가효과 확률 +',0,'sec'],['asecsure','부가효과 확정',false,'sec']];
  const grpOf={aatk:'stat',adef:'stat',aigatk:'stat',aigdef:'stat',amulti:'eff',aforce:'eff',ahits:'etc',ahelp:'etc',acharge:'etc',alife:'etc',aadapt:'etc',abelt:'etc',askill:'etc',asure:'etc'};
  const chgList=()=>AF.filter(([id,,d])=>{const e=$('#'+id,md);if(!e)return false;return typeof d==='boolean'?e.checked!==d:String(e.value)!==String(d)&&!(typeof d==='number'&&+e.value===d&&e.value!=='')}).map(([id,l])=>{const e=$('#'+id,md);const v=e.type==='checkbox'?'':e.tagName==='SELECT'?e.options[e.selectedIndex].text:e.value;return {id,t:l+v,g:grpOf[id]||AF.find(x=>x[0]===id)[3]}});
  const updChg=()=>{const L=chgList();$('#achg',md).innerHTML=L.length?L.map(x=>`<span class="chip chg" data-ax="${x.id}">${esc(x.t)} <b>✕</b></span>`).join(''):'<span class="small dim">기본값 그대로</span>';
   md.querySelectorAll('[data-asum]').forEach(e=>{const gl=L.filter(x=>x.g===e.dataset.asum);e.textContent=gl.length?gl.map(x=>x.t).join(' · '):'기본'});
   md.querySelectorAll('[data-ax]').forEach(ch=>ch.onclick=()=>{const d=AF.find(x=>x[0]===ch.dataset.ax);const e=$('#'+d[0],md);if(typeof d[2]==='boolean')e.checked=d[2];else e.value=d[2];updChg();prev()})};
  /* 굴리기 전 예상 대미지 (난수 85~100%, 급소·연속 횟수 빼고 1회 기준) */
  const prev=()=>{const box=$('#aprev',md);if(!box)return;const mv=MVS(atk)[+mvSel.value];const g=id=>$('#'+id,md);const n=id=>+g(id).value;
   {const oh=g('aordh');if(oh){const tg=[...md.querySelectorAll('[data-t]:checked')].map(cb=>cb.dataset.t);const L=tg.map(sl=>{const [sd,ar]=sl.split('_');const d=entered(b,sd)[ar];return d?[d,orderCrit(atk,d)]:null}).filter(x=>x&&x[1].v);oh.textContent=L.length?'자동 지시 '+L.map(([d,o])=>(tg.length>1?d.name+' ':'')+'+'+o.v).join(' · '):'자동 지시 +0'}}
   if(!mv||mv.cat==='변화'||!(+g('apow').value)){box.innerHTML='';return}
   const tg=[...md.querySelectorAll('[data-t]:checked')].map(cb=>cb.dataset.t);const out=[];
   try{const moveTypes=mtys(mv);const atkTypes=atk.teraActive&&atk.teraEn!=='-'?[...atk.types,atk.teraEn]:atk.types;
    for(const slot of tg){const [side,area]=slot.split('_');const def=entered(b,side)[area];if(!def)continue;
     const tyK=dexSees(c,def,'type');const eff0=B().effectiveness(moveTypes,def,{scrappy:spL(atk,'scrappy'),multiMode:+g('amulti').value,atkTypes,force:g('aforce').value===''?null:+g('aforce').value,floating:(def.states||{}).MagnetRise||(def.states||{}).Telekinesis||(FX()&&FX().floating(def))||IT(def)==='풍선'});const eff=tyK||g('aforce').value!==''?eff0:Object.assign({},eff0,{value:1});
     let mods={boost:1,guard:1};try{if(FX())mods=FX().attackMods(roleV(atk),roleV(def),Object.assign(moveQuery(atk,def,mv,moveTypes,eff.value,tg.length<2),{stab:!!eff.stab}))}catch(e){}{const ig=OI()&&OI().defGuard(def,mv.cat);if(ig)mods=Object.assign({},mods,{guard:(mods.guard||1)*ig.v})}
     const objs=(fieldOf(b).objects||{})[side]||{};const wall={};for(const k in WALLS)if(objs[k]>0&&!(k==='얼음의장벽'&&tyOf(mv)==='Fire'))wall[WALLS[k]]=1;
     const d=B().damage(foulAtk(atkD,def,mv),def,Object.assign({},mv,{pow:+g('apow').value}),{critMul:(+g('acritmul').value||critMulOf(atk)),hits:[1],free1:n('afree1')*(mods.boost||1),free2:n('afree2'),item1:n('aitem1'),item2:n('aitem2'),trait:n('atrait'),weather:n('aweather'),fieldMul:n('afield'),wonder:RM('원더룸'),helping:g('ahelp').checked,charge:g('acharge').checked,lifeOrb:g('alife').checked,multiTarget:tg.length>1,wall,wallSize:mode(b)>=2?2:1,atkStat:g('aatk').value||undefined,defStat:g('adef').value||undefined,ignoreAtk:+g('aigatk').value,ignoreDef:+g('aigdef').value,scarf:IT(atk)==='구애스카프'});
     const o={stab:eff.stab,adaptability:g('aadapt').checked,expertBelt:g('abelt').checked,guard:(mods.guard||1)*((def.flags||{}).endure?0.5:1)};
     const lo=Math.max(eff.value>0?1:0,B().hpDamage(def,d.min,eff.value,o).raw),hi=Math.max(lo,B().hpDamage(def,d.max,eff.value,o).raw);const cur=def.hp.cur,mx=def.hp.max||1;
     const pc=v=>Math.round(v/mx*100);const nk=lo>0?Math.ceil(cur/lo):0;
     out.push(`<div class="apv"><div class="apvh"><b>${esc(def.name)}</b> <span class="small dim">${tyK?esc((def.types||[]).filter(t=>t!=='-').map(t=>S().typeKo(t)).join(' · ')):'타입 ?'}</span></div><div class="apbar"><i style="width:${pc(Math.max(0,cur-hi))}%"></i><b style="left:${pc(Math.max(0,cur-hi))}%;width:${Math.max(0,pc(cur)-pc(Math.max(0,cur-hi)))}%"></b><u style="left:${pc(Math.max(0,cur-lo))}%"></u></div><div><span class="apn">${lo} ~ ${hi}</span> <span class="small dim">/ 남은 HP ${cur}</span></div><div class="small dim">HP의 ${pc(lo)}~${pc(hi)}% · ${tyK||g('aforce').value!==''?'상성 ×'+eff.value:'상성 ? (×1 가정)'}${eff.stab?' · 자속':''}${d&&d.wall<1?` · <span style="color:var(--yel2)">${esc(wallNames(objs,catEn(mv.cat),tyOf(mv)).join('·'))} ×${d.wall}</span>`:''}${nk===1?' · <b style="color:var(--red)">확정 1타</b>':nk?' · 확정 '+nk+'타':''}${mv.max>1?' · 1회 기준':''}</div></div>`)}}catch(e){out.length=0}
   box.innerHTML=out.length?`<div class="sec">예상 대미지 <span class="note">급소·명중 빼고 · 받는 쪽 완화는 HP 창에서</span></div><div class="apvs">${out.join('')}</div>`:''};
  md.addEventListener('input',e=>{if(e.target.closest('#ares'))return;updChg();prev()});md.addEventListener('change',e=>{if(e.target.closest('#ares'))return;updChg();prev()});
  md.querySelectorAll('[data-at],[data-amv]').forEach(t=>t.addEventListener('click',()=>{updChg();prev()}));
  syncMove();if(opt.extra){const mv=MVS(atk)[+mvSel.value]||{};const pe=$('#apow',md);if(pe)pe.value=Math.max(1,Math.floor((+pe.value||+mv.pow||0)*(+opt.extra.pw||1)));const se=$('#asure',md);if(se&&opt.extra.sure)se.checked=true}if(XMV[mid]){const iv=setInterval(()=>{if(!md.isConnected){delete XMV[mid];clearInterval(iv)}},700)}updChg();prev();
  let RESULT=null;
  $('#aroll',md).onclick=()=>{
   const mv=MVS(atk)[+mvSel.value];if(!mv)return;RESULT=null;SECADJ={add:+(($('#asecadd',md)||{}).value)||0,sure:!!(($('#asecsure',md)||{}).checked)};
   /* 행동 판정: 상태 변화로 못 움직이면 여기서 끝. 적용하면 상태 변화(잠듦 남은 턴·얼음 해제 등)와 로그만 남는다 */
   if($('#achk',md).checked&&F()&&['Flinch', 'Sleep', 'Paralysis', 'Freeze', 'Attract', 'Confusion'].some(k=>(atk.states||{})[k])){const am=JSON.parse(JSON.stringify(atk));const r=F().actionCheck(am);
    if(!r.ok){let self=0;if(r.selfHit){self=F().confusionHit(am);am.hp.cur=Math.max(0,am.hp.cur-self);r.lines.push(`${am.name} 자작 대미지 −${self} → HP ${am.hp.cur}/${am.hp.max}${am.hp.cur<=0?' 빈사!':''}`)}
     RESULT={check:am,lines:r.lines,mv};$('#ares',md).innerHTML=`<div class="card" style="border-color:var(--red)"><b>행동 실패</b><div class="small" style="white-space:pre-wrap;margin-top:4px">${esc(r.lines.join('\n'))}</div></div>`;$('#aapply',md).disabled=false;aSum(md,`<em>행동 실패</em> ${esc(String(r.lines[0]||'').slice(0,40))}`);aScroll(md);return}
    RESULT={checkOnly:am,lines:r.lines};if(r.lines.length)$('#ares',md).innerHTML=`<div class="small dim" style="white-space:pre-wrap">${esc(r.lines.join('\n'))}</div>`}
   const targets=[...md.querySelectorAll('[data-t]:checked')].map(cb=>cb.dataset.t);if(!targets.length)return A().toast('대상을 골라 줘');
   /* 10-26 망령: 「기술 방어」(방어 · 판별 · 니들가드 …) — 성공하면 턴 종료까지 상대 기술을 막는다. 「연속 제한 (방어)」: 바로 전 턴에 성공했으면 1/3, 1/9 … */
   const PROT=protMove(mv);let PR=null;if(PROT){const t0=+b.turn||0;const k=atk.protectLast===t0-1?(+atk.protectN||0):0;const ch=Math.pow(1/3,k);const rl=Math.random();PR={ok:rl<ch,chance:Math.round(ch*1000)/10,k}}
   const PBY=protBypass(mv);const NX=(FX()&&FX().nextOf)?FX().nextOf(atk):[];
   const g=id=>$('#'+id,md);const n=id=>+g(id).value;const ck=id=>g(id).checked;
   const moveTypes=mtys(mv);SECX=spL(atk,'secx').filter(e=>spHit(e,mv,moveTypes)).reduce((a,e)=>a*(+e.v||1),1);
   const atkTypes=atk.teraActive&&atk.teraEn!=='-'?[...atk.types,atk.teraEn]:atk.types;
   const res=[];const multiTarget=targets.length>1;const SPW=specialPowFor(mv.name,atk);const MAU0=moveAuto(mv),MAU=MA()&&MA().auto(MAU0)?MAU0:null;   /* 변칙 위력 기술: 대상마다 위력 자동 (매그니튜드 같은 무작위는 한 번만 굴림) */
   for(const slot of targets){const [side,area]=slot.split('_');const def=entered(b,side)[area];if(!def)continue;
    const AF=atk.flags||{},DF=def.flags||{};const phys=mv.cat==='물리',spec=mv.cat==='특수';
    const sure=ck('asure')||md.dataset.wsure==='1'||AF.surehit||(phys&&AF.hitPhys)||(spec&&AF.hitSpec)||!!(FX()&&FX().nextOf&&FX().nextOf(atk).some(e=>e.sure));const IG=FX()?iuIgnore(atk,def):{};
    const sureMv=sure||!(+mv.acc);/* 10-26 망령 판정: 「필중기」는 『피해라!』『물러나!』로 피할 수 없다 */const autoMiss=((phys&&DF.dodgePhys)||(spec&&DF.dodgeSpec))&&!sureMv||AF.acc0;
    /* 사이코필드: 땅 위의 포켓몬은 상대의 선공 기술(우선도 +1 이상)을 받지 않는다 */
    const psyBlock=f.terrain.type==='사이코필드'&&!sameT(def,atk)&&grd(def)&&(FX()?FX().prioOf(atk,mv):(+mv.prio||0))>0;
    const itImm=OI()&&mv.cat!=='변화'?OI().immune(def,moveTypes):'';
    /* 와이드가드(「전체기 방어」): 그 진영이 받는 전체기(대상 2체 이상 · 범위가 전체인 기술)를 막는다 — 같은 편 전체기도 */const wideBlock=def!==atk&&+(((f.objects||{})[def.side]||{})['와이드가드']||0)>0&&(multiTarget||/전체|자신\s*이외/.test(String(mv.range||'')));
    const protBlock=def!==atk&&!PBY&&(def.flags||{}).protect===(+b.turn||0)&&def.hp.cur>0;const accRoll0=()=>protBlock?{prot:1,sure:false,hit:false,target:0,roll:0,acc:0,eva:0,note:`${def.name} 「기술 방어」 — 기술을 막았다`,prot:1}:wideBlock?{sure:false,hit:false,target:0,roll:0,acc:0,eva:0,note:`${SIDE_KO[def.side]} 「와이드가드」 — 전체기를 막았다`}:itImm?{sure:false,hit:false,target:0,roll:0,acc:0,eva:0,note:`${def.name}의 「${itImm}」 — 효과가 없다`}:psyBlock?{sure:false,hit:false,target:0,roll:0,acc:0,eva:0,note:'사이코필드 — 땅 위라 선공 기술 무효'}:autoMiss?{sure:false,hit:false,target:0,roll:0,acc:0,eva:0,note:'지령으로 회피/명중 0'}:B().accuracy(atk,def,{acc:md.dataset.wacc?+md.dataset.wacc:mv.acc},{accMult:n('aacc'),sureHit:sure,starry:f.weather.type==='별하늘',fog:f.weather.type==='짙은안개',fogImmune:tysOf(atk).some(t=>t==='Poison'||t==='Fairy')/* 11-01 망령: 독 · 페어리 「타입」 포켓몬만 면제 (맵툴 캠페인 calculate_attack) */,gravity:(f.etc||{})['중력']>0,wideLens:IT(atk)==='광각렌즈',ignoreAcc:IG.acc,ignoreEva:IG.eva});
     /* 11-03 「회피 N할」: 맞은 쪽의 회피 효과 — 필중이 아니면 한 번 더 굴린다 */const accRoll=()=>{const r=accRoll0();if(r&&r.hit&&!r.sure&&def!==atk&&!sameT(def,atk,b)){const ev=spL(def,'evade').find(e=>spHit(e,mv,moveTypes));if(ev){const rl=1+Math.floor(Math.random()*100);if(rl<=+ev.pct)return Object.assign({},r,{hit:false,note:`${def.name} 「${ev.name}」 ${ev.pct}% 회피 (${rl})`})}}return r};const acc=accRoll();
    /* 효과 엔진: 상성을 먼저 보고 강화·완화·급소 조건을 맞춘다 */
    const effPre=mv.cat==='변화'?null:B().effectiveness(moveTypes,def,{scrappy:spL(atk,'scrappy'),multiMode:+g('amulti').value,atkTypes,force:g('aforce').value===''?null:+g('aforce').value,floating:(def.states||{}).MagnetRise||(def.states||{}).Telekinesis||(FX()&&FX().floating(def))||IT(def)==='풍선'});
    const mods=FX()?FX().attackMods(roleV(atk),roleV(def),Object.assign(moveQuery(atk,def,mv,moveTypes,effPre?effPre.value:1,!multiTarget),{stab:!!(effPre&&effPre.stab)})):{boost:1,guard:1,cg:0,cr:0,cx:'',names:[]};
    {const ig=OI()&&OI().defGuard(def,mv.cat);if(ig){mods.guard=(mods.guard||1)*ig.v;mods.names=(mods.names||[]).concat([{key:'_i',who:def.id,txt:ig.txt}])}}
    const iu=(atk.fx||{}).ignoreUp,iuD=(def.fx||{}).ignoreUp;let igDef=+g('aigdef').value,igAtk=+g('aigatk').value;const igW=c=>({0:'상승·강화',1:'감소·저하',2:'상승(랭크)',3:'강화(배율)',4:'감소(랭크)',5:'저하(배율)',6:'랭크 변화',7:'변화 모두',8:'배율 변화'})[c]||'상승';if(IG.def!=null&&igDef===-1){igDef=IG.def;mods.names=(mods.names||[]).concat([{key:'_iu',who:atk.id,txt:`${atk.name} 「${iu.name}」 상대의 방어 ${igW(IG.def)} 무시`}])}if(IG.atk!=null&&igAtk===-1){igAtk=IG.atk;mods.names=(mods.names||[]).concat([{key:'_iuD',who:def.id,txt:`${def.name} 「${iuD.name}」 공격 쪽 ${igW(IG.atk)} 무시`}])}
    if(IG.eva!=null&&+mv.acc)mods.names=(mods.names||[]).concat([{key:'_iuE',who:atk.id,txt:`${atk.name} 「${iu.name}」 상대의 회피 ${igW(IG.eva)} 무시`}]);if(IG.acc!=null&&+mv.acc)mods.names=(mods.names||[]).concat([{key:'_iuA',who:def.id,txt:`${def.name} 「${iuD.name}」 공격 쪽 명중 ${igW(IG.acc)} 무시`}]);
    /* 기술 글 「대상의 랭크 변화를 무시한다」(성스러운칼 · 야금야금 …): 방어 쪽 랭크를 위아래 모두 무시 */if(igDef===-1&&/대상의\s*랭크\s*변화를\s*무시/.test(String(mv.eff||''))){igDef=6;mods.names=(mods.names||[]).concat([{key:'_mvig',who:atk.id,txt:`「${mv.name}」 대상의 랭크 변화 무시`}])}
    const OC=orderCrit(atk,def);if(OC.v)mods.names=(mods.names||[]).concat([{key:'_ord',who:atk.id,txt:OC.txt}]);
    if(mods.cx!=='none'&&CRR(def).never){mods.cx='none';mods.names=(mods.names||[]).concat([{key:'_crn',who:def.id,txt:`${def.name} 급소에 맞지 않는다 (급소 규칙)`}])}
    /* 특성 · 포텐셜 글 「기술이 자신의 급소에 맞지 않는다」 (조가비갑옷 · 전투무장 · 가시갑옷 …): 구문 없이도 급소 없음 */if(mods.cx!=='none'){const nc=[[def.ability,def.abilityEff],...potSrc(def).map(p=>[p.name,p.eff])].find(([n,e])=>n&&/자신의\s*급소에\s*맞지\s*않는다/.test(String(e||'')));if(nc){mods.cx='none';mods.names=(mods.names||[]).concat([{key:'_nc',who:def.id,txt:`${def.name} 「${nc[0]}」 급소에 맞지 않는다`}])}}
    /* 연속기 (맵툴 attack_target): 2~5회처럼 횟수가 범위면 첫 명중 뒤로는 확정, 2회·3회처럼 고정이면 매 회 명중 판정 (스킬링크면 첫 명중 뒤 확정) · 빗나가면 거기서 멈춘다 */
    let hits=[];if(acc.hit){const sl=ck('askill');const mx=+mv.max||1,mn=+mv.min||1;const cnt=n('ahits')||B().multiHits(mv,{skillLink:sl});const fixedN=mx>1&&mn===mx&&!sl&&!acc.sure;const stage=B().critStage(atk,def,{input:n('acrit'),order:n('acritord')+OC.v+(mods.cr||0)-(mods.cg||0)+itemCrit(atk,def)+crAdj(atk,def)});
     if(cnt>1)acc.multi={cnt,kind:mx>1&&mn===mx?'fixed':'range',sl,more:[]};
     for(let i=0;i<cnt;i++){if(i>0&&fixedN){const a2=accRoll();acc.multi.more.push(a2);if(!a2.hit){acc.multi.stop=i+1;break}}const cr=mods.cx==='none'?{crit:false,roll:0,chance:0}:B().critical(stage,{type:g('acrittype').value!==''?+g('acrittype').value:(+CRR(atk).tbl||0),forced:ck('acritforce')||mods.cx==='sure'||!!CRR(atk).sure});hits.push({v:cr.crit?2:1,cr,stage})}}
    const objs=(f.objects||{})[side]||{};const wall={};for(const k in WALLS)if(objs[k]>0&&!(k==='얼음의장벽'&&tyOf(mv)==='Fire'))wall[WALLS[k]]=1;
    if(objs['얼음의장벽']>0&&tyOf(mv)==='Fire'&&mv.cat!=='변화'){delete objs['얼음의장벽'];A().set(['battle','field','objects',side,'얼음의장벽'],null).then(ok=>{if(ok)A().sysLog(`「불꽃」 기술 『${mv.name}』 — ${SIDE_KO[side]} 「얼음의장벽」이 녹아 철거됐다`,'battle')})}   /* 10-25: 대미지 계산 전에 철거 */
    const spw=SPW?SPW(def):null;const powT=spw&&spw.pow!=null?spw.pow:+g('apow').value;
    /* 미스트필드: 땅 위 대상이 받는 드래곤 반감 · 눈(싸라기눈) 얼음 타입 방어 1.5 · 모래바람 바위 타입 특방 1.5 · 원더룸 방어↔특방 실수치 */
    const dTy=tysOf(def),dS=g('adef').value||(mv.cat==='특수'?'specialdefense':'defense');const fieldT=n('afield')*(f.terrain.type==='미스트필드'&&moveTypes.includes('Dragon')&&grd(def)?0.5:1);
    const wt=f.weather.type;const defMul=(wt==='극한'&&dTy.includes('Ice')&&dS==='defense')?2:(['눈','싸라기눈'].includes(wt)&&dTy.includes('Ice')&&dS==='defense')?1.5:(wt==='모래바람'&&dTy.includes('Rock')&&dS==='specialdefense')?1.5:1;
    if(defMul!==1&&mods.names)mods.names.push({key:'_w',who:def.id,txt:`${def.name} 「${wt}」 ${dS==='defense'?'방어':'특방'} ×1.5`});if(fieldT!==n('afield')&&mods.names)mods.names.push({key:'_t',who:def.id,txt:`${def.name} 「미스트필드」 드래곤 ×0.5`});
    let MVP=null,DOPT=null;const dmg=mv.cat==='변화'||!powT||(spw&&spw.fixed)||(MAU&&MAU.delay)?null:B().damage(foulAtk(atkD,def,mv),def,MVP=Object.assign({},mv,{pow:powT},ATY?{typeEn:ATY,type:S().typeKo(ATY)}:skinOf(atk,mv)?{typeEn:skinOf(atk,mv).ty,type:S().typeKo(skinOf(atk,mv).ty)}:{}),DOPT={critMul:(+g('acritmul').value||critMulOf(atk)),hits:hits.map(h=>h.v),powStep:spw?0:powStepOf(mv),free1:n('afree1')*(mods.boost||1),free2:n('afree2'),item1:n('aitem1'),item2:n('aitem2'),trait:n('atrait'),weather:n('aweather'),fieldMul:fieldT,defMul,wonder:RM('원더룸'),helping:ck('ahelp'),charge:ck('acharge'),lifeOrb:ck('alife'),multiTarget,wall,wallSize:mode(b)>=2?2:1,atkStat:g('aatk').value||undefined,defStat:g('adef').value||undefined,ignoreAtk:igAtk,ignoreDef:igDef,watersport:(f.etc||{})['물놀이']>0,mudsport:(f.etc||{})['흙놀이']>0,scarf:IT(atk)==='구애스카프',choiceDef:false,tailwindDef:((f.objects||{})[side]||{})['순풍']>0,swampDef:((f.objects||{})[side]||{})['습원']>0});
    const eff=dmg?B().effectiveness(moveTypes,def,{scrappy:spL(atk,'scrappy'),multiMode:+g('amulti').value,atkTypes,force:g('aforce').value===''?null:+g('aforce').value,floating:(def.states||{}).MagnetRise||(def.states||{}).Telekinesis||(FX()&&FX().floating(def))||IT(def)==='풍선'}):null;
    const stab=eff?eff.stab:false;
    if(dmg&&dmg.wall<1){mods.names=mods.names||[];mods.names.push({key:'_wall',who:def.id,txt:`${def.name} 「${wallNames(objs,catEn(mv.cat),tyOf(mv)).join('·')||'벽'}」 피해 ×${dmg.wall}${mode(b)>=2?' (더블)':''} · 급소면 무시`})}
    const guard0=(DF.endure?0.5:1)*(mods.guard||1),guardC0=(DF.endure?0.5:1)*Math.max(1,mods.guard||1);const endure0=(!!DF.endure&&!DF.endureUsed||!!mods.endure)&&!AF.noEndure;
    const hp=dmg?B().hpDamageHits(def,perOf(dmg),eff.value,{...hsOpt(def,mv.cat,mods),stab,adaptability:ck('aadapt'),expertBelt:ck('abelt'),guard:guard0,guardCrit:guardC0,crit:hits.map(h=>h.v===2),endure:endure0,hpFloor:raidFloor(def)}):null;
    /* 급소를 뒤집은 대미지 (10-24 망령): HP 창에서 피해 적용 전에 급소 여부를 바꿀 수 있게 — 맞은 타마다 전부 급소 / 전부 급소 아님 */
    const dmgAlt=dmg&&DOPT.hits.some(v=>v>0)?(()=>{const anyC=DOPT.hits.includes(2);try{return B().damage(foulAtk(atkD,def,mv),def,MVP,Object.assign({},DOPT,{hits:DOPT.hits.map(v=>v===0?0:(anyC?1:2))}))}catch(e){return null}})():null;
    res.push({_mv:MVP,_opt:DOPT,slot,def,acc,hits,dmg,dmgAlt,eff,stab,hp,guard:guard0,guardCrit:guardC0,endure:endure0,manual:1,mods,spw,sec:[...(spw&&acc.hit?[{ok:true,line:spw.note}]:[]),...(acc.hit?(MAU?MAU.groups.filter(g=>g.who==='target').map(g=>rollGroup(atk,def,g)):secRolls(atk,def,mv)):[])]})}
   const anyHit=res.some(r=>r.acc.hit);const once=MAU?MAU.groups.filter(g=>g.who!=='target'&&(anyHit||g.when==='use')).map(g=>rollGroup(atk,null,g)):[];
   /* 10-22 망령: 행동 판정을 통과했으면(혼란 · 마비 …) 그 결과(남은 턴)를 「적용」 때까지 들고 간다 — 예전엔 여기서 덮어써서 혼란 턴이 안 줄었다 */
   const CK=RESULT&&RESULT.checkOnly?RESULT:null;
   RESULT={mv,targets:res,moveTypes,auto:MAU,once,checkOnly:CK?CK.checkOnly:null,lines:CK?CK.lines:[],protect:PR,bypass:PBY,nextKeys:NX.map(e=>e.key),nextU:NX.some(e=>e.uturn)};
   { /* 굴린 시점에 로그로 (자속·보정 같은 공격 쪽 내부 정보는 빼고) */
    const L=res.map(r=>{const hit=r.acc.prot?'「기술 방어」로 막힘':r.acc.sure?'필중':r.acc.hit?`명중 ${r.acc.roll}/${r.acc.target}`:`빗나감 ${r.acc.roll}/${r.acc.target}`;if(!r.acc.hit)return `→ ${r.def.name}: ${hit}`;
     /* 10-27 제보: 급소 아님도 굴림 숫자를 남긴다 (오류 확인용) — 터지면 「급소!」, 아니면 「급소 ✗」. 변화기는 적지 않는다 */const cr=r.dmg?r.hits.map((h,k)=>{const n=r.hits.length>1?(k+1)+'타 ':'';const rc=h.cr&&h.cr.chance?`${h.cr.roll}/${h.cr.chance}`:'없음';return h.v===2?`급소!(${n}${rc})`:`급소 ✗(${n}${rc})`}).join(' · '):'';
     const am=atkMul(r);const mu=r.acc.multi;const mh=mu?` · ${mu.kind==='fixed'?mu.cnt+'회 연속기':'연속기 '+mu.cnt+'회'}${mu.sl?'「스킬링크」':''}${mu.more.length?' (이후 명중 '+mu.more.map(a=>a.hit?a.roll+'/'+a.target:'빗나감 '+a.roll+'/'+a.target).join(' · ')+')':''} → ${r.hits.length}번 맞았다!${r._opt&&r._opt.powStep&&r.hits.length>1?' (위력 '+r.hits.map((h,k)=>+r._mv.pow+r._opt.powStep*k).join('→')+')':''}`:'';return `→ ${r.def.name}: ${hit}${mh}${cr?' · '+cr:''}${r.dmg?` · 대미지 ${Math.floor(r.dmg.total*am)}${r.hits.length>1?' ('+r.hits.length+'회)':''} · 상성 ×${r.eff.value}`:' (변화기)'}${(r.sec||[]).map(x=>'\n   '+x.line).join('')}`});
    const PO=(b.order||[]).find(o=>o.mid===mid&&o.pursuitHit&&String(o.move)===String(mv.name));const PV=PO&&b.mons[PO.pursuitHit];if(PV&&res.some(r=>r.def.id===PV.id))cutFire('m:'+atk.id,atk.image,`${atk.name}의 따라가때리기!`,`『${mv.name}』 → ${PV.name}`,atk.side==='left'?'#1f6fd1':'#e3101f');
    A().sysLog(`【공격】 ${atk.name} 『${mv.name}』${PV&&res.some(r=>r.def.id===PV.id)?(pursuitX2(mv)?' · 따라가때리기 ×2':' · 따라가때리기'):''} ${ATY?esc(S().typeKo(ATY))+'(타입 변경)':skinOf(atk,mv)?esc(S().typeKo(skinOf(atk,mv).ty))+'('+esc(skinOf(atk,mv).name)+')':esc(mv.type||'')} ${mv.cat||''}${+g('apow').value?' 위력 '+g('apow').value:''}
${PR?`「기술 방어」 ${PR.ok?'성공':'실패'}${PR.k?` (연속 ${PR.k+1}번째 · 성공 확률 ${PR.chance}%)`:''}\n`:''}${L.join('\n')}${once.length?'\n'+once.map(x=>'· '+x.line).join('\n'):''}`,'battle',{mid:atk.id,img:atk.image||''})}
   const agRow=(x,key,who)=>x.g&&x.ok?`<label class="small agr"><input type="checkbox" data-ag="${key}" checked> ${who?esc(who)+' · ':''}${esc(x.line)}</label>`:`<div class="small" style="color:${x.ok?'var(--ok)':'var(--mute)'}">${who?esc(who)+' · ':''}${esc(x.line)}</div>`;
   const extra=MAU?[...(MAU.recoil?[`반동 ${MAU.recoil.basis==='max'?'최대 HP':'가한 대미지'} ${MAU.recoil.frac}${MAU.recoil.when==='miss'?' (모두 빗나갔을 때)':''}${MAU.recoil.hard?' · 무시 불가':''}`]:[]),...(MAU.drain?[`드레인 ${MAU.drain}`]:[]),...(MAU.selfFaint?['사용 후 자신 빈사']:[]),...(MAU.forceSwitch?['맞은 대상 강제 교대 (흡반·뿌리박기 등은 막힘)']:[]),...(MAU.selfSwitch?[MAU.selfSwitch==='batton'?'배턴터치로 교대':'명중 후 임의 교대']:[])]:[];const nxNote=NX.some(e=>e.uturn)&&!(MAU&&MAU.selfSwitch)?'<div class="small" style="color:var(--ok)">「다음 기술」 유턴 — 명중하면 교대할 포켓몬을 고른다</div>':'';
   /* 10-27 제보: 자동으로 들어간 보정(타입 위력 강화 · 피해 완화 · 소지품 · 날씨 …)이 잘 안 보였다 — 결과 위에 「적용된 보정」 카드 + 굴린 사람에게 나만 보는 로그로 */
   const aplGlob=chgList().map(x=>x.t);const aplPer=res.map(r=>({n:r.def.name,hit:r.acc.hit,L:[...((r.mods&&r.mods.names)||[]).map(x=>x.txt),...(r.eff?['상성 ×'+r.eff.value]:[]),...(r.stab?['자속 ×'+(ck('aadapt')?2:1.5)]:[])]}));
   const aplHtml=`<div class="card aapl" style="margin:0 0 6px;padding:6px 10px;border-color:var(--yel2)"><b class="small" style="color:var(--yel2)">적용된 보정</b><label class="small dim" style="float:right;cursor:pointer" title="이 브라우저에만 — 끄면 【보정】 줄을 채팅에 남기지 않는다"><input type="checkbox" data-aplog ${APLOG()?'checked':''}> 나만 보는 로그에 남기기</label><div class="small"><span class="dim">창 전체</span> ${aplGlob.length?aplGlob.map(t=>`<span class="chip chg" style="cursor:default">${esc(t)}</span>`).join(' '):'<span class="dim">기본값 그대로</span>'}</div>${aplPer.map(p=>`<div class="small"><b>→ ${esc(p.n)}</b> ${p.L.length?p.L.map(t=>`<span class="chip" style="cursor:default">${esc(t)}</span>`).join(' '):'<span class="dim">없음</span>'}${p.hit?'':' <span class="dim">(빗나감)</span>'}</div>`).join('')}</div>`;
   /* 10-28 망령: 【보정】 줄이 공격마다 쌓여 너무 많다 — 한 줄로, 상성(【공격】 줄에 이미 있음)은 빼고, 남길 보정이 없으면 안 남긴다. 카드의 체크로 끈다 */
   try{const per=aplPer.filter(p=>p.hit).map(p=>({n:p.n,L:p.L.filter(t=>!/^상성 ×/.test(t))})).filter(p=>p.L.length);
    if(APLOG()&&(aplGlob.length||per.length))A().selfLog(`【보정】 ${atk.name} 『${mv.name}』 — ${[...(aplGlob.length?['창: '+aplGlob.join(' · ')]:[]),...per.map(p=>`${p.n}: ${p.L.join(' · ')}`)].join(' / ')}`)}catch(e){}
   {const ar=$('#ares',md);if(!ar._apl){ar._apl=1;ar.addEventListener('change',e=>{if(e.target.matches('[data-aplog]'))try{localStorage.setItem('om_aplog',e.target.checked?'1':'0')}catch(x){}})}}
   $('#ares',md).innerHTML=`${aplHtml}${nxNote}${PR?`<div class="card" style="margin:0 0 6px;padding:6px 10px;border-color:${PR.ok?'var(--ok)':'var(--red)'}"><b>「기술 방어」 ${PR.ok?'성공':'실패'}</b> <span class="small dim">${PR.k?`연속 ${PR.k+1}번째 — 성공 확률 ${PR.chance}%`:'첫 사용 — 반드시 성공'}</span></div>`:''}${CK&&CK.lines.length?`<div class="small" style="white-space:pre-wrap;margin:0 0 6px;color:var(--ok)">${esc(CK.lines.join('\n'))}</div>`:''}${res.some(r=>(r.sec||[]).length)||once.length||extra.length||(MAU0&&MAU0.notes.filter(t=>!autoNote(t)).length)?`<div class="card agc" style="margin:0 0 6px;padding:6px 10px"><b class="small">판정 · 부가효과</b> <span class="small dim">${MAU?'(체크된 것은 「적용」 때 자동으로 들어간다)':'(부가효과 발동은 손으로 적용)'}</span>${res.map((r,i)=>(r.sec||[]).map((x,j)=>agRow(x,'t'+i+'_'+j,r.def.name)).join('')).join('')}${once.map((x,j)=>agRow(x,'o'+j,atk.name)).join('')}${extra.map((t,j)=>`<label class="small agr"><input type="checkbox" data-agx="${j}" checked> ${esc(atk.name)} · ${esc(t)}</label>`).join('')}${MAU0&&MAU0.notes.filter(t=>!autoNote(t)).length?`<div class="small" style="color:var(--yel2);margin-top:3px">손으로: ${MAU0.notes.filter(t=>!autoNote(t)).map(t=>esc(String(t).replace(/<br\s*\/?>/gi,' '))).join(' · ')}</div>`:''}</div>`:''}<table class="t"><tr><th>대상</th><th>명중</th><th>급소</th><th>대미지(상성 전)</th><th>상성</th><th>보정</th><th>최종</th></tr>${res.map((r,i)=>`<tr>
    <td class="nw"><div class="row" style="gap:6px;flex-wrap:nowrap"><div class="ti sm" style="${r.def.image?`background-image:url('${cssu(r.def.image)}')`:''}"></div><div><b>${esc(r.def.name)}</b><div class="small dim">HP ${r.def.hp.cur}/${r.def.hp.max}</div>${r.mods&&r.mods.names.length?`<div class="small" style="color:var(--yel2)">${r.mods.names.map(x=>esc(x.txt)).join('<br>')}</div>`:''}</div></div></td>
    <td class="nw">${r.acc.sure?'필중':(r.acc.hit?'<b style="color:var(--ok)">명중</b>':'<b style="color:var(--red)">빗나감</b>')+`<div class="small dim">${r.acc.note?esc(r.acc.note):r.acc.roll+' / '+r.acc.target}</div>`}</td>
    <td class="nw crkc">${r.hits.map((h,k)=>`<div class="crk1">${r.dmg&&r._mv?`<label class="small crk" title="눌러서 급소를 직접 켜고 끈다"><input type="checkbox" data-crk="${i}.${k}" ${h.v===2?'checked':''}> <b style="color:${h.v===2?'var(--red)':'var(--mute)'}">급소</b>${r.hits.length>1?' '+(k+1)+'타':''}</label>`:(h.v===2?`<b style="color:var(--red)">급소</b>`:'-')} <span class="small dim mono">${h.cr.roll}/${h.cr.chance}</span></div>`).join('')}</td>
    <td id="dmgc_${i}">${r.dmg?`<b class="mono">${r.dmg.total}</b> <span class="small dim">(${r.dmg.min}~${r.dmg.max}${r.hits.length>1?' · '+r.hits.length+'회':''})</span>`:'-'}</td>
    <td>${r.eff?`<b>×${r.eff.value}</b> <span class="small dim">${esc(S().typeKo(r.eff.type))}${r.stab?' · 자속':''}</span>`:'-'}</td>
    <td>${r.dmg?`<label class="small">버텨라/방호 <input type="number" step="0.01" class="n xs" data-guard="${i}" value="${r.guard}"></label> <label class="small">수동 <input type="text" class="n xs" data-manual="${i}" value="1" title="곱셈으로도 적는다 (1.2*1.5 · ×1.5)"></label> <label class="small"><input type="checkbox" data-berry="${i}" ${OI()&&OI().resist(r.def,{mt:moveTypes,cat:mv.cat,eff:r.eff.value,multi:multiTarget})?'checked':''}> 반감열매</label> <label class="small"><input type="checkbox" data-endure="${i}" ${r.endure?'checked':''}> 버티기</label>${raidFloor(r.def)?`<div class="small" style="color:var(--yel)">레이드 배리어 하한 ${raidFloor(r.def)}</div>`:''}`:''}</td>
    <td><b class="mono" id="fin_${i}">${r.hp&&r.acc.hit?r.hp.final:0}</b><div class="small dim" id="aft_${i}">→ ${r.hp&&r.acc.hit?r.hp.after:r.def.hp.cur}</div></td></tr>`).join('')}</table>
    <div class="small dim" style="margin-top:4px">${esc(mv.name)} · L${atk.lv} 위력 ${g('apow').value} · ${res[0]&&res[0].dmg?`공격 ${Math.round(res[0].dmg.hits[0]?res[0].dmg.hits[0].A:0)} / 방어 ${Math.round(res[0].dmg.hits[0]?res[0].dmg.hits[0].D:0)} · M ${res[0].dmg.M}${multiTarget?` (전체기 ×0.75 · 대상 ${res.length})`:''} · 벽 ${res[0].dmg.wall}`:''}</div>`;
   const recompute=()=>{res.forEach((r,i)=>{if(!r.dmg)return;const gd=md.querySelector(`[data-guard="${i}"]`),mn=md.querySelector(`[data-manual="${i}"]`),br=md.querySelector(`[data-berry="${i}"]`),en=md.querySelector(`[data-endure="${i}"]`);
     r.hp=B().hpDamageHits(r.def,perOf(r.dmg),r.eff.value,{...hsOpt(r.def,mv.cat,r.mods),stab:r.stab,adaptability:ck('aadapt'),expertBelt:ck('abelt'),guard:+gd.value||1,guardCrit:(+gd.value||1)===r.guard?r.guardCrit:undefined,crit:r.hits.map(h=>h.v===2),manual:mulOf(mn.value,1)||1,berryHalf:br.checked,endure:en.checked,hpFloor:raidFloor(r.def)});
     $('#fin_'+i,md).textContent=r.acc.hit?r.hp.final:0;$('#aft_'+i,md).textContent='→ '+(r.acc.hit?r.hp.after:r.def.hp.cur)})};
   md.querySelectorAll('[data-guard],[data-manual],[data-berry],[data-endure]').forEach(el=>el.addEventListener('input',recompute));
   md.querySelectorAll('[data-crk]').forEach(el=>el.addEventListener('change',()=>{const [i,k]=el.dataset.crk.split('.').map(Number);const r=res[i];if(!r||!r.dmg||!r._mv||!r.hits[k])return;r.hits[k].v=el.checked?2:1;r.hits[k].hand=1;const hv=r.hits.map(h=>h.v);
    try{r.dmg=B().damage(foulAtk(atkD,r.def,r._mv),r.def,r._mv,Object.assign({},r._opt,{hits:hv}));const anyC=hv.includes(2);r.dmgAlt=B().damage(foulAtk(atkD,r.def,r._mv),r.def,r._mv,Object.assign({},r._opt,{hits:hv.map(v=>v===0?0:(anyC?1:2))}))}catch(e){return}
    const cc=$('#dmgc_'+i,md);if(cc)cc.innerHTML=`<b class="mono">${r.dmg.total}</b> <span class="small dim">(${r.dmg.min}~${r.dmg.max}${r.hits.length>1?' · '+r.hits.length+'회':''}) · 급소 손으로</span>`;const lb=el.parentNode.querySelector('b');if(lb)lb.style.color=el.checked?'var(--red)':'var(--mute)';recompute()}));
   $('#aapply',md).disabled=false;
   /* 11-03 감우 (검토 16): 굴린 뒤 결과 표로 부드럽게 내려가고, 휴대폰은 창 위에 붙는 요약 한 줄(명중 · 급소 · 대미지) */
   aSum(md,res.map(r=>`<b>${esc(r.def.name)}</b> ${r.acc.prot?'막힘':r.acc.sure?'필중':r.acc.hit?'명중':'<em>빗나감</em>'}${r.acc.hit&&r.hits.some(h=>h.v===2)?' · <em>급소</em>':''}${r.dmg&&r.acc.hit?` · ${r.hp?r.hp.final:0}<small> ×${r.eff.value}</small>`:''}`).join('<span class="asep">|</span>'));aScroll(md)};
  $('#aapply',md).onclick=async()=>{if(!RESULT)return;const nb0=snap(),nb=snap(nb0);const lines=[];
   if(RESULT.check){/* 창을 연 때의 공격자 사본(am)으로 덮지 않는다 (점검 3-6): 상태 변화와 자작 대미지만 지금 모습에 옮긴다 */const am=RESULT.check;const x=nb.mons[mid];if(!x)return;const self=Math.max(0,(+atk.hp.cur||0)-(+am.hp.cur||0));x.states=am.states;if(self){x.hp.latest=x.hp.cur;x.hp.cur=Math.max(0,x.hp.cur-self)}if(x.hp.cur<=0)x.entry='';A().closeModal();if(await saveBattle(nb0,nb)){A().sysLog(`${atk.name}의 ${RESULT.mv.name}…\n${RESULT.lines.join('\n')}`,'battle')}return}
   if(RESULT.checkOnly){const am=RESULT.checkOnly;nb.mons[mid].states=am.states;if(RESULT.lines.length)lines.push(...RESULT.lines)}
   /* 10-27 망령: 트레이너 「기능 확장」 기술 — 적용하면 횟수 1 */
   {const X=(RESULT.mv||{}).ext;const tt=X&&(nb.trainers||{})[X.tid];if(tt){const U=Object.assign({},tt.extUse||{});U[X.i]=(+U[X.i]||0)+1;tt.extUse=U;lines.push(`【기능 확장】 ${tt.name}${X.src?' 『'+X.src.replace(/[『』]/g,'')+'』':''} → ${atk.name} 「${RESULT.mv.name}」${X.kind==='extra'?' (추가 행동)':''}${X.lim?` 【${Math.max(0,X.lim-U[X.i])}/${X.lim}】`:''}`)}}
   /* 「기술을 내보낼 때마다」 줄어드는 상태 (prog:'move' — 도발·앙코르·사슬묶기·침묵·소란피기·난동부리기 … + 얼음). 잠듦·혼란·얼음은 행동 판정을 돌렸으면 거기서 이미 줄었다 */
   /* 충전·가열·냉각·장전: 그 타입 기술로 대미지를 줬으면 상태를 쓴다 */
   {const a=nb.mons[mid];const ty=tyOf(RESULT.mv||{});if(a&&a.states&&RESULT.targets.some(r=>r.acc.hit&&r.dmg))for(const k in CHARGE_ST)if(a.states[k]&&CHARGE_ST[k]===ty){delete a.states[k];lines.push(`${a.name} 「${(((DB().states||{}).st||{})[k]||{}).ko||k}」 사용 — 대미지 2배`)}}
   {const a=nb.mons[mid];const sdb=(DB().states||{}).st||{};const st=(a&&a.states)||{};for(const k of Object.keys(st)){const d=sdb[k]||{};const v=+st[k];if(!movesDown(k,d)||!(v>0&&v<1000))continue;if(RESULT.checkOnly&&(k==='Sleep'||k==='Confusion'||k==='Freeze'))continue;
    if(v<=1){delete st[k];lines.push(`${a.name} 「${d.ko||k}」 해제`)}else{st[k]=v-1;lines.push(`${a.name} 「${d.ko||k}」 남은 ${v-1}`)}}}
   if(RESULT.protect){const a=nb.mons[mid];const t0=+nb.turn||0;if(RESULT.protect.ok){a.flags=Object.assign({},a.flags||{},{protect:t0});a.protectLast=t0;a.protectN=RESULT.protect.k+1;lines.push(`${a.name} 「기술 방어」 — 이번 턴 상대의 기술을 막는다`)}else{if(a.flags)delete a.flags.protect;a.protectLast=null;a.protectN=0;lines.push(`${a.name} 「기술 방어」 실패 (연속 사용)`)}}
   if(RESULT.bypass==='clear')for(const r of RESULT.targets){const d=nb.mons[r.def.id];if(r.acc.hit&&d&&d.flags&&d.flags.protect!=null){delete d.flags.protect;lines.push(`${d.name} 「기술 방어」 해제 — 『${RESULT.mv.name}』`)}}
   /* 맵툴처럼 공격 쪽은 판정만 한다. 피해는 받는 쪽이 「HP」 창에서 완화 배율을 넣고 적용한다 (lastHit 에 기록) */
   let dealtAny=false;const sumL=[];   /* 11-03 감우 (검토 11): 【전달】 카드는 【공격】 카드와 같은 판정을 되풀이하지 않고 「누구 → 누구 ≈ 대미지」 한 줄 요약만 — 나머지 줄(반동 · 드레인 · 상태 · 기능 확장 …)은 새 정보라 남긴다 */
   for(const r of RESULT.targets){const def=nb.mons[r.def.id];if(!def)continue;
    if(!r.acc.hit){sumL.push(`${def.name} ${r.acc.prot?'막힘':'빗나감'}`);continue}
    if(!r.dmg){sumL.push(`${def.name} (변화기)`);continue}
    const crit=r.hits.some(h=>h.v===2);dealtAny=true;
    const am=atkMul(r,md);
    /* 10-27 제보: HP 창에 감쇄 요소가 다 안 보였다 — 기본 대미지에 이미 들어간 배율을 적어 둔다. pub = 누구나 봐도 되는 것(전체기 · 화상 · 날씨 · 필드 · 벽 · 받는 쪽 완화 …), atk = 공격 쪽 보정(소지품 · 특성 · 자속 …, 공격 쪽을 다룰 수 있는 사람만) */
    const hfx=(()=>{const O=r._opt||{};const D=r.dmg||{};const H0=(D.hits||[])[0]||{};const pub=[],ak=[],gd=[];const mt=O.multiTarget?0.75:1,wt=+O.weather||1,fd=+O.fieldMul||1;
     if(O.multiTarget)pub.push('전체기 ×0.75');if((+H0.M||1)/(mt*wt*fd)<0.99)pub.push('화상 ×0.5');if(wt!==1)pub.push('날씨 ×'+wt);if(fd!==1)pub.push('필드 ×'+fd);if((+D.wall||1)<1)pub.push('벽 ×'+D.wall+(crit?' (급소면 무시)':''));
     if(O.watersport)pub.push('물놀이 ×0.5');if(O.mudsport)pub.push('흙놀이 ×0.5');if(O.helping)pub.push('도우미 ×1.5');if(+O.defMul&&+O.defMul!==1)pub.push('받는 쪽 능력 배율 ×'+O.defMul);
     for(const x of ((r.mods&&r.mods.names)||[]))(x.who===def.id?gd:ak).push(x.txt);   /* 받는 쪽 완화(블로커 등)는 기본 대미지가 아니라 HP 창의 「위력 완화」로 곱한다 */
     if(+O.item1&&+O.item1!==1)ak.push((md.dataset.it1?'소지품 '+md.dataset.it1.replace(/\s*×\s*[\d.]+\s*$/,''):'아이템1')+' ×'+O.item1);if(+O.item2&&+O.item2!==1)ak.push('아이템2 ×'+O.item2);if(+O.trait&&+O.trait!==1)ak.push('특성 ×'+O.trait);if(+O.free2&&+O.free2!==1)ak.push('자유2 ×'+O.free2);
     {const f1=(+O.free1||1)/((r.mods&&r.mods.boost)||1);if(Math.abs(f1-1)>0.001)ak.push('자유1 ×'+Math.round(f1*1000)/1000)}if(O.charge)ak.push('충전 ×2');if(O.lifeOrb)ak.push('생명의구슬 ×1.3');if(r.stab)ak.push('자속 ×'+(($('#aadapt',md)||{}).checked?2:1.5));if((($('#abelt',md)||{}).checked)&&r.eff&&r.eff.value>1)ak.push('달인의띠 ×1.2');
     return {pub,atk:ak,grd:gd}})();
    def.lastHit={hfx,from:atk.name,fromId:atk.id,move:RESULT.mv.name,moveType:RESULT.mv.type||'',eff:r.eff.value,effType:r.eff.type||'',total:Math.floor(r.dmg.total*am),min:Math.floor(r.dmg.min*am),max:Math.floor(r.dmg.max*am),hits:r.hits.length,crit,per:perOf(r.dmg,am),perCrit:r.hits.map(h=>h.v===2),...(r.dmgAlt?{alt:{total:Math.floor(r.dmgAlt.total*am),min:Math.floor(r.dmgAlt.min*am),max:Math.floor(r.dmgAlt.max*am),crit:!crit,per:perOf(r.dmgAlt,am)}}:{}),guard:r.guard,guardCrit:r.guardCrit,guardNote:(r.mods&&r.mods.names.filter(x=>x.who===def.id).map(x=>x.txt).join(' · '))||'',endure:r.endure,expect:r.hp?r.hp.final:0,at:Date.now(),turn:+nb.turn||0,mt:RESULT.moveTypes||[],cat:RESULT.mv.cat||'',ct:!!(A().contactOf&&A().contactOf(RESULT.mv)==='O'),multi:RESULT.targets.length>1};
    if(FX()&&r.mods)FX().consume(nb,r.mods.names);if(def.flags&&def.flags.endure)def.flags.endureUsed=1;
    sumL.push(`${def.name} ≈ ${r.hp?r.hp.final:0}${r.eff.value!==1?' ×'+r.eff.value:''}${crit?' 급소':''}${r.acc.multi?' '+r.hits.length+'타':''}`)}
   if($('#alife',md).checked&&dealtAny){const a=nb.mons[mid];const rec=Math.max(1,Math.floor(a.hp.max/10));a.hp.latest=a.hp.cur;a.hp.cur=Math.max(0,a.hp.cur-rec);lines.push(`${atk.name} 생명의구슬 반동 −${rec} → ${a.hp.cur}`);if(a.hp.cur<=0){a.entry='';lines.push(`${a.name}은(는) 쓰러졌다!`)}}
   if(RESULT.auto&&FX()){const AU=RESULT.auto,a=nb.mons[mid];const ck2=k=>{const el=md.querySelector(`[data-ag="${k}"]`);return !!(el&&el.checked)};const ckx=t=>{const ex=[...(AU.recoil?['recoil']:[]),...(AU.drain?['drain']:[]),...(AU.selfFaint?['faint']:[]),...(AU.forceSwitch?['fsw']:[]),...(AU.selfSwitch?['ssw']:[])];const el=md.querySelector(`[data-agx="${ex.indexOf(t)}"]`);return !!(el&&el.checked)};
    const runOps=async(ops,def)=>{const map=def?tgtFor(atk,def):(o=>o);const cx=Object.assign({},uiCtx(nb,a,RESULT.mv.name),def?{pick:list=>list.find(x=>x.id===def.id)||null}:{});const r=await FX().run(ops.map(map),cx);lines.push(...r.lines)};
    for(const [j,x] of (RESULT.once||[]).entries())if(x.ok&&ck2('o'+j))await runOps(x.ops,null);
    for(const [i,r] of RESULT.targets.entries())for(const [j,x] of (r.sec||[]).entries())if(x.g&&x.ok&&ck2('t'+i+'_'+j)){const d=nb.mons[r.def.id];if(!d)continue;
      /* 11-03 「반사」: 상대의 변화기를 되받아친다 — 효과가 쓴 쪽에 */const bo=RESULT.mv.cat==='변화'&&d.id!==mid&&!sameT(d,a,nb)?spL(d,'bounce').find(e=>!e.cat||e.cat==='변화'):null;if(bo){lines.push(`${d.name} 「${bo.name}」 — 「${RESULT.mv.name}」를 되받아쳤다`);await runOps(x.ops,a);continue}await runOps(x.ops,d)}
    const dealt=RESULT.targets.filter(r=>r.acc.hit&&r.dmg).reduce((s2,r)=>s2+(r.hp?r.hp.final:0),0);const anyHit=RESULT.targets.some(r=>r.acc.hit);
    if(AU.recoil&&ckx('recoil')&&a.hp.cur>0){const R2=AU.recoil;const base=R2.basis==='max'?a.hp.max:dealt;const ok=R2.when==='miss'?!anyHit:anyHit&&(R2.basis==='max'||dealt>0);
     if(ok){if(!R2.hard&&(FX().noind(a,'recoil')||FX().noind(a,'')))lines.push(`${a.name} 반동을 받지 않는다`);else{const [p,q]=R2.frac.split('/').map(Number);const v=Math.max(1,Math.floor(base*p/q));a.hp.latest=a.hp.cur;a.hp.cur=Math.max(0,a.hp.cur-v);lines.push(`${a.name} 반동 −${v}${R2.basis==='max'?'':' (예상 대미지 '+dealt+'의 '+R2.frac+')'} → ${a.hp.cur}`)}}}
    if(AU.drain&&ckx('drain')&&dealt>0&&a.hp.cur>0){if((a.states||{}).HealBlock)lines.push(`${a.name} 「회복봉인」이라 드레인 없음`);else{const [p,q]=AU.drain.split('/').map(Number);let v=Math.max(1,Math.floor(dealt*p/q));if(IT(a)==='큰뿌리')v=Math.floor(v*1.3);const h=Math.min(v,a.hp.max-a.hp.cur);a.hp.latest=a.hp.cur;a.hp.cur+=h;lines.push(`${a.name} 드레인 +${h} (예상 대미지 ${dealt}의 ${AU.drain}) → ${a.hp.cur}`)}}
    if(AU.selfFaint&&ckx('faint')&&a.hp.cur>0){a.hp.latest=a.hp.cur;a.hp.cur=0;lines.push(`${a.name} 「${RESULT.mv.name}」 사용 후 빈사`)}
    for(const id in nb.mons){const x=nb.mons[id];if(x.entry&&x.hp.cur<=0){x.entry='';lines.push(`${x.name}은(는) 쓰러졌다!`)}}}
   if(OI()){const a=nb.mons[mid];const tags=String(RESULT.mv.tag||'').split(/[,/·\s]+/).filter(Boolean);const dealt=RESULT.targets.filter(r=>r.acc.hit&&r.dmg).map(r=>r.def.id);
    try{lines.push(...OI().afterAttack(nb,a,{jewel:md.dataset.jewel==='1'&&+$('#aitem1',md).value>1,dealt,missAll:RESULT.targets.length>0&&!RESULT.targets.some(r=>r.acc.hit),tags}))}catch(e){console.warn(e)}}
   {const e=String(RESULT.mv.eff||'');const hitAny=RESULT.targets.some(r=>r.acc.hit);const ok=!/명중(\s*후|했을\s*때)/.test(e)||hitAny;const f2=nb.field=nb.field||{};f2.objects=f2.objects||{};const foe=atk.side==='left'?'right':'left';
    const HZ=[...OBJ_CAT[2][4],...OBJ_CAT[3][4]],WL=['리플렉터','빛의장막','오로라베일'];
    const strip=(side,list)=>{const o=f2.objects[side]=Object.assign({},f2.objects[side]||{});const gone=list.filter(k=>+o[k]>0);gone.forEach(k=>delete o[k]);if(gone.length)lines.push(`${SIDE_KO[side]} ${gone.map(k=>'「'+k+'」').join('')} 철거 — 『${RESULT.mv.name}』`)};
    if(ok){if(/적진의\s*「장벽」「신비의부적」「흰안개」/.test(e)){strip(foe,[...WL,'신비의부적','흰안개']);if(/필드 전체의\s*「+설치물」+/.test(e)){strip('left',HZ);strip('right',HZ)}}
     else{if(/자진의\s*「설치물」[^.]*철거/.test(e))strip(atk.side,HZ);if(/자진의\s*「장벽」[^.]*철거/.test(e))strip(atk.side,WL);else if(/「장벽」[^.]*철거/.test(e)){const sd=[...new Set(RESULT.targets.filter(r=>r.acc.hit&&r.def.side!==atk.side).map(r=>r.def.side))];(sd.length?sd:[foe]).forEach(s=>strip(s,WL))}}
     if(/「필드」[^.]*철거/.test(e)&&f2.terrain&&f2.terrain.type){lines.push(`「${f2.terrain.type}」 철거 — 『${RESULT.mv.name}』`);f2.terrain={type:'',count:0}}
     if(/「전체기 방어」\s*상태로/.test(e)){const o=f2.objects[atk.side]=Object.assign({},f2.objects[atk.side]||{});o['와이드가드']=1;lines.push(`${SIDE_KO[atk.side]} 「와이드가드」 — 턴 종료까지 전체기를 막는다 (연속으로 쓰면 실패 판정은 손으로)`)}
     if(/서로의 필드의 상태를 뒤바꾼다/.test(e)){const L0=f2.objects.left||{},R0=f2.objects.right||{};f2.objects={left:R0,right:L0};lines.push(`좌측 ↔ 우측 설치물을 맞바꿨다 — 『${RESULT.mv.name}』`)}}}
   /* 10-26 망령: 「난동부리기 (혼란) : 2~3회」(역린 · 꽃잎댄스 …) — 처음 쓰면 남은 횟수만큼 「난동부리기」, 끝나면 혼란 */
   {const tm2=String(RESULT.mv.eff||'').match(/「난동부리기\s*\(혼란\)\s*:\s*(\d+)~(\d+)회」/);const a=nb.mons[mid];if(tm2&&a&&!RESULT.check){a.states=a.states||{};if(!a.states.Thrash&&!a.thrashOn){const n=+tm2[1]+Math.floor(Math.random()*(+tm2[2]-+tm2[1]+1));if(n>1){a.states.Thrash=n-1;a.thrashOn=1;lines.push(`${a.name} 「난동부리기」 — 앞으로 ${n-1}번 더 (끝나면 혼란)`)}}else if(!a.states.Thrash&&a.thrashOn){delete a.thrashOn;const cf=((DB().states||{}).st||{}).Confusion||{};const lo=+cf.min||1,hi=+cf.max||lo;a.states.Confusion=lo+Math.floor(Math.random()*(hi-lo+1));lines.push(`${a.name} 난동이 끝나 「혼란」 상태가 됐다`)}}}
   /* 10-26 망령 (서서 VS 마리 시험): 「반동 : 행동불능」 기술이 맞으면 다음 턴 움직일 수 없다 · 『버서커』는 공격하면 2턴 「난동부리기」 */
   {const a=nb.mons[mid];const e=String(RESULT.mv.eff||'');if(a&&!RESULT.check&&a.hp.cur>0){a.states=a.states||{};
    if(/「반동\s*:\s*행동불능」/.test(e)&&RESULT.targets.some(r=>r.acc.hit)){a.states.Recharge=2;lines.push(`${a.name} 「반동 : 행동불능」 — 다음 턴 움직일 수 없다 (무시하는 효과가 있으면 상태에서 지운다)`)}
    if(RESULT.mv.cat!=='변화'&&!(atk.states||{}).Thrash&&!a.states.Thrash&&potSrc(a).some(p=>String(p.name||'').trim()==='버서커')){a.states.Thrash=2;lines.push(`${a.name} 『버서커』 — 2턴 동안 「난동부리기」`)}}}
   /* 10-26 망령: 「다음 기술」 효과는 기술을 내보내면 (변화기 · 빗나감이어도) 다 쓴다 */
   if((RESULT.nextKeys||[]).length){const a=nb.mons[mid];const F=a.fx||{};const nk=RESULT.nextKeys;const had=(F.mods||[]).some(e=>e.next&&nk.includes(e.key));F.mods=(F.mods||[]).filter(e=>!(e.next&&nk.includes(e.key)));F.prio=(F.prio||[]).filter(e=>!(e.next&&nk.includes(e.key)));if(had)lines.push(`${a.name} 「다음 기술」 효과를 썼다`)}
   nb.mons[mid].lastDealt={total:RESULT.targets.filter(r=>r.acc.hit&&r.dmg).reduce((a,r)=>a+(r.hp?r.hp.final:0),0),targets:RESULT.targets.filter(r=>r.acc.hit&&r.dmg).map(r=>r.def.name).join(', '),at:Date.now()};
   const AU2=RESULT.auto;const xck=t=>{if(!AU2)return false;const ex=[...(AU2.recoil?['recoil']:[]),...(AU2.drain?['drain']:[]),...(AU2.selfFaint?['faint']:[]),...(AU2.forceSwitch?['fsw']:[]),...(AU2.selfSwitch?['ssw']:[])];const el=md.querySelector(`[data-agx="${ex.indexOf(t)}"]`);return !!(el&&el.checked)};
   const doF=AU2&&AU2.forceSwitch&&xck('fsw'),doS=AU2&&AU2.selfSwitch&&xck('ssw');const swS=doS?AU2.selfSwitch:(RESULT.nextU?'free':'');   /* 선행유턴처럼 「다음 기술」에 붙은 유턴도 */
   A().closeModal();if(!await saveBattle(nb0,nb,undefined,{n:atk.name,s:RESULT.mv.name,img:atk.image||''}))return;A().sysLog(`【전달】 ${atk.name} 『${RESULT.mv.name}』 → ${sumL.join(' · ')||'대상 없음'}${dealtAny?' — 받는 쪽이 「HP」에서 적용':''}${lines.length?'\n'+lines.join('\n'):''}`,'battle',{mid:atk.id,img:atk.image||''});
   /* 11-03 「추가공격」: 포켓몬 하나에게 내보낸 맞는 기술이 명중했으면 1번 더 (위력 · 필중은 구문대로) — 추가 공격 창을 연다 */
   {const hit1=RESULT.targets.length===1&&RESULT.targets[0].acc.hit&&RESULT.mv.cat!=='변화'?RESULT.targets[0]:null;const left=opt.extra?(+opt.extra.left||0):null;
    if(hit1&&(left===null||left>0)){const a2=ctx().b.mons[mid];const ex=a2&&a2.entry&&a2.hp.cur>0?(opt.extra?{pw:opt.extra.pw,sure:opt.extra.sure,n:left,name:opt.extra.name}:spL(a2,'extra').find(e=>spHit(e,RESULT.mv,RESULT.moveTypes))):null;const d2=ctx().b.mons[hit1.def.id];
     if(ex&&d2&&d2.entry&&d2.hp.cur>0){const mi=MVS(a2).findIndex(q=>q&&q.name===RESULT.mv.name);setTimeout(()=>openAttack(mid,{mvIdx:mi>=0?mi:undefined,mvName:mi<0?RESULT.mv.name:undefined,targets:[hit1.slot],extra:{pw:+ex.pw||0.25,sure:!!ex.sure,left:(opt.extra?left:(+ex.n||1))-1,name:ex.name}}),500)}}}
   /* 교대는 저장 뒤에 (퇴장·등장이 각자 저장한다) */
   if(doF)for(const r of RESULT.targets){if(!r.acc.hit||r.def.id===mid)continue;const d=ctx().b.mons[r.def.id];if(!d||!d.entry||d.hp.cur<=0)continue;const g=await switchGuard(d);
    if(g){A().sysLog(`${d.name} 강제 교대를 받지 않는다 (${g})`,'battle');continue}
    const c2=ctx();if(canEdit(c2,d)||c2.mgr)await forcedSwitch(d.id,{sys:true});else A().sysLog(`${d.name} 강제 교대 — 상대나 GM 이 「퇴장 → 강제 교대」로 처리`,'battle')}
   if(swS&&RESULT.targets.some(r=>r.acc.hit)){const a=ctx().b.mons[mid];if(a&&a.entry&&a.hp.cur>0){const bench=Object.values(ctx().b.mons).filter(x=>x.tid===a.tid&&!x.entry&&!x.pend&&x.hp.cur>0&&x.id!==mid);
    if(!bench.length)A().sysLog(`${a.name} 교대할 포켓몬이 벤치에 없다`,'battle');else{const pk=await uiCtx(ctx().b,a,RESULT.mv.name).pick(bench,'교대해 들어올 포켓몬');if(pk){const area=a.entry;await exitMon(mid,{noAsk:true,batton:swS==='batton',sys:true});await enterMon(pk.id,area,{sys:true,how:'임의 교대'})}}}}}}

 /* 상세 창용: 지금 걸린 것 (읽기 전용) */
 /* ---------- 단축키 (prefs_ui 「배틀」 묶음에서 부른다). 처리했으면 true ----------
    「지금 차례」 = 행동 순서의 지금 칸, 없으면 내가 고칠 수 있는 첫 등장 포켓몬 */
 function nowMon(c){const b=c.b;const o=(b.order||[])[+b.orderIdx||0];if((+b.phase||0)>=2&&o&&b.mons[o.mid]&&canEdit(c,b.mons[o.mid]))return b.mons[o.mid];
  const mine=allEntered(b).map(s=>s.mon).filter(m=>canEdit(c,m));return mine[0]||null}
 function hotkey(act){const c=ctx();const b=c.b;const md=document.querySelector('.modalbg');
  const click=sel=>{const e=md&&md.querySelector(sel);if(e&&!e.disabled){e.click();return true}return false};
  if(act==='mRoll')return click('#aroll');
  if(act==='mApply')return click('#aapply')||click('#esave');
  if(!b.trainers||!Object.keys(b.trainers).length){A().toast('배틀에 나온 트레이너가 없다');return true}
  const mgrOnly=()=>{if(!c.mgr)A().toast('배틀 진행 권한이 없다');return c.mgr};
  const mySeat=()=>{const t=myTrainers(c);if(t.length===1)return t[0];A().toast(t.length?'트레이너가 여럿이라 단축키로는 고를 수 없다':'내 트레이너가 없다');return null};
  const onMon=a=>{const m=nowMon(c);if(!m){A().toast('고를 포켓몬이 없다');return true}action({act:a,mid:m.id});return true};
  switch(act){
   case 'bProgress':if(mgrOnly())progressTurn();return true;
   case 'bNext':if(mgrOnly()){if(!(b.order||[]).length)A().toast('행동 순서가 아직 없다');else action({act:'onext'})}return true;
   case 'bPrev':if(mgrOnly())action({act:'oprev'});return true;
   case 'bAttack':return onMon('attack');
   case 'bHp':return onMon('hp');
   case 'bEdit':return onMon('edit');
   case 'bCmd':{const f=document.getElementById('cmdForm');if(f)f.scrollIntoView({behavior:'smooth',block:'start'});else A().toast('지시 입력 칸이 없다');return true}
   case 'bReady':{const t=mySeat();if(t)toggleReady(t);return true}
   case 'bFire':{const t=mySeat();if(t)openFire(t);return true}
   case 'bReveal':if(!c.gm)A().toast('모두 공개는 GM 만');else if((+b.phase||0)!==1)A().toast('턴 개시·공개 페이즈에서만');else reveal();return true;
   case 'bField':if(mgrOnly())openField();return true;
   case 'bTurnEnd':if(mgrOnly())askYes('턴 마무리(턴 가장 마지막 → 턴 종료 → 턴 종료 이후)로 갈까?','간다','아직').then(ok=>{if(ok)endFlow()});return true}
  return false}
 /* ----- 상세 창의 랭크·배율·상태 (10-21 망령): 항목별 칸을 눌러 바로 조절하고, 상태는 붙이고 뗀다. 바뀐 것은 채팅 로그에 (상태는 설명까지) ----- */
 /* 10-28 망령: 배율 칸은 곱셈으로도 적는다 — 「1.2*1.5」 · 「×1.5」 · 「x1.5」. 「*」 · 「×」 로 시작하면 지금 배율에 곱한다. 「/」 로 나누기도 된다 */
 function mulOf(v,cur){let t=String(v==null?'':v).replace(/\s+/g,'').replace(/[×xX＊]/g,'*').replace(/÷/g,'/').replace(/,/g,'.');if(!t)return NaN;let r=1;if(/^[*\/]/.test(t))r=+cur||1;else t='*'+t;
  const parts=t.match(/[*\/][^*\/]+/g);if(!parts||parts.join('')!==t)return NaN;for(const q of parts){const f=+q.slice(1);if(!isFinite(f)||f<=0)return NaN;r=q[0]==='*'?r*f:r/f}return Math.round(r*1000)/1000}
 const NOW_K=['attack','defense','specialattack','specialdefense','speed','accuracy','evasion','critical'];const NOW_MODS=[0.5,0.67,0.75,1,1.33,1.5,2];
 const fmtR=v=>(v>0?'+':'')+v;const LOGQ={};
 /* 랭크·배율은 여러 번 누르니 잠깐 모았다가 한 줄로 (바꾸기 전 값을 처음 한 번만 잡아 둔다) */
 function nowQueue(m){const q=LOGQ[m.id]||(LOGQ[m.id]={r0:Object.assign({},m.rank||{}),m0:Object.assign({},m.mod||{})});clearTimeout(q.t);q.t=setTimeout(()=>nowFlush(m.id),1500)}
 function nowFlush(mid){const q=LOGQ[mid];if(!q)return;clearTimeout(q.t);delete LOGQ[mid];const m=(ctx().b.mons||{})[mid];if(!m)return;const ch=[];
  for(const k of NOW_K){const a=+q.r0[k]||0,b2=+(m.rank||{})[k]||0;if(a!==b2)ch.push(`${STAT_KO[k]} 랭크 ${fmtR(a)} → ${fmtR(b2)}`);const x=+q.m0[k]||1,y=+(m.mod||{})[k]||1;if(x!==y)ch.push(`${STAT_KO[k]} 배율 ×${x} → ×${y}`)}
  if(ch.length)A().sysLog(`【랭크·배율】 ${m.name}\n${ch.join('\n')}`,'battle',{mid,img:m.image||''})}
 /* 손으로 붙인 「씨뿌리기」: 지금 행동 중인 상대 포켓몬의 에리어를 씨 뿌린 곳으로 (없으면 정면) */
 function seedSrc(b,m){const o=(b.order||[])[+b.orderIdx||0];const a=o&&(b.mons||{})[o.mid];return a&&!sameT(a,m,b)&&a.entry&&(+b.phase||0)>=2?a.side+'_'+a.entry:null}
 const stDesc=k=>((((DB().states||{}).st||{})[k])||{}).desc||[];const stName=k=>((((DB().states||{}).st||{})[k])||{}).ko||k;
 function nowEditHtml(m,full,o){o=o||{};const r=m.rank||{},md=m.mod||{};const sdb=(DB().states||{}).st||{};const st=m.states||{};
  const tmpK=k=>!!(+(m.tempRank||{})[k]||(+(m.tempMod||{})[k]||1)!==1);
  const cell=k=>{const v=+r[k]||0,x=+md[k]||1;return `<button type="button" class="dxrk ${v>0?'up':v<0?'dn':''} ${x>1?'mup':x<1?'mdn':''} ${o.sel===k?'sel':''}" ${full?`data-nrk="${k}"`:'disabled'}><small>${STAT_KO[k]}${k==='critical'?' (C)':''}</small><b>${fmtR(v)}</b><em>×${x}</em>${tmpK(k)?'<i class="dxtmp" title="턴 종료 때 풀리는 임시 랭크·배율이 있다">임시</i>':''}</button>`};
  const chips=Object.keys(st).filter(k=>st[k]).map(k=>{const d=sdb[k]||{ko:k};const im=simg(k);return `<span class="dxs1 ${d.abn?'abn':''}" title="${esc((d.desc||[]).join(' '))}">${im?`<img src="${esc(im)}" alt="">`:''}<b>${esc(d.ko||k)}</b>${full?`<input type="number" class="dxsn" data-nst="${esc(k)}" min="1" max="99" value="${+st[k]<1000?+st[k]:''}" placeholder="∞" title="남은 턴 (비우면 계속)"><i>턴</i>`:+st[k]>1&&+st[k]<1000?`<i>${st[k]}턴</i>`:''}${full?`<button type="button" class="dxsx" data-nsoff="${esc(k)}" title="「${esc(d.ko||k)}」 풀기">✕</button>`:''}</span>`}).join('');
  const fx=flagChips(m)+(FX()?FX().chips(m).map(ch=>`<span class="rk fxc" title="${esc(ch.title)}">${esc(ch.t)}</span>`).join(''):'');
  /* 10-28 망령 「배율에 임시 배율이 없는 게 불편 · 시합 중 배율 조정 UI 개편」: 배율은 「곱해진 것들」의 목록으로 보인다 — 효과 출처 · 손 조정 · 임시(턴 종료까지)를 하나씩 보고 ✕ 로 뗀다.
     단추는 지금 배율에 곱한다(새 줄). 전체를 한 값으로 맞추는 건 아래 「총 배율 직접 맞추기」 */
  const bar=()=>{const k=o.sel;const v=+r[k]||0,x=+md[k]||1;const lim=k==='critical'?4:6;
   const ms=((m.fx&&m.fx.mults)||[]).filter(e=>e&&e.stats&&e.stats[k]!=null);const prod=ms.reduce((a,e)=>a*(+e.stats[k]||1),1);const rest=Math.round(x/prod*1000)/1000;const tr=+(m.tempRank||{})[k]||0;
   const src=e=>{const n=String(e.name||e.key||'');const by=String(e.key||'').split(' ← ')[1]||'';return esc(n.replace(/ · [a-z0-9]+$/,''))+(by&&!e.hand?`<span class="dim"> ← ${esc(by)}</span>`:'')};
   const rows=ms.map(e=>`<span class="dxmf ${e.temp?'tmp':''} ${e.hand?'hand':''}"><b>${src(e)}</b><span class="mono">×${+e.stats[k]}</span>${e.temp?'<i>턴 종료까지</i>':''}<button type="button" class="dxsx" data-nmx="${esc(e.key)}" title="이 배율만 뗀다">✕</button></span>`).join('')+(Math.abs(rest-1)>0.002?`<span class="dxmf"><b>출처 없음</b><span class="mono">×${rest}</span><button type="button" class="dxsx" data-nmx0 title="출처 없는 배율을 뗀다 (×1)">✕</button></span>`:'');
   return `<div class="dxrkb"><div class="dxrkh"><b class="dxrkt">${STAT_KO[k]}</b><label class="dxtg ${o.temp?'on':''}" title="켜 두면 여기서 올리고 곱한 것은 턴 종료 때 저절로 풀린다"><input type="checkbox" data-ntemp ${o.temp?'checked':''}> 임시 (턴 종료까지)</label></div>
    <div class="dxrkl"><span class="small dim">랭크</span><span class="dxrkr"><button type="button" class="btn sm" data-nrd="-1" ${v<=-lim?'disabled':''}>−1</button><b class="mono">${fmtR(v)}</b><button type="button" class="btn sm" data-nrd="1" ${v>=lim?'disabled':''}>+1</button></span>${tr?`<span class="dxmf tmp"><b>임시</b><span class="mono">${fmtR(tr)}</span><i>턴 종료 때 되돌림</i></span>`:''}</div>
    <div class="dxrkl"><span class="small dim">배율</span><b class="mono dxmt">×${x}</b><span class="dxmfs">${rows||'<span class="small dim">곱해진 배율 없음</span>'}</span></div>
    <div class="dxrkl dxmadd"><span class="small dim">곱하기</span>${[0.5,0.67,0.75,1.2,1.33,1.5,2].map(z=>`<button type="button" class="btn xs ${o.temp?'tmp':''}" data-nmul="${z}">×${z}</button>`).join('')}<input type="text" class="n xs" data-nmulx placeholder="1.2*1.5" title="곱할 값 · 곱셈도 된다"><input type="text" class="n xs dxmemo" data-nmemo value="${esc(o.memo||'')}" placeholder="출처 (선택)" maxlength="30"><button type="button" class="btn xs pri" data-nmulgo>곱하기</button></div>
    <details class="dxmset"><summary class="small dim">총 배율 직접 맞추기</summary><span class="dxrkm">${NOW_MODS.map(z=>`<button type="button" class="btn xs ${z===x?'pri':'ghost'}" data-nmod="${z}">×${z}</button>`).join('')}<input type="text" class="n xs" data-nmodi value="${x}" title="배율 직접 입력 · 곱셈도 된다 (1.2*1.5) · ×1.5 처럼 ×/* 로 시작하면 지금 배율에 곱한다"></span><div class="small dim">한 값으로 맞추면 이 능력의 출처 기록은 지워진다</div></details></div>`};
  const rng=d=>!d.min||d.min>=1000?'계속':d.max&&d.max!==d.min?`${d.min}~${d.max}턴`:`${d.min}턴`;
  const list=()=>{const q=(o.q||'').toLowerCase();const groups=((DB().states||{}).groups||[]).map(g=>({l:g.l,s:g.s.filter(k=>!st[k]&&sdb[k]&&(!q||(sdb[k].ko+' '+k+' '+(sdb[k].desc||[]).join(' ')).toLowerCase().includes(q)))})).filter(g=>g.s.length);
   return groups.map(g=>`<div class="dxspgl">${esc(g.l)}</div><div class="dxsps">${g.s.map(k=>{const d=sdb[k];const im=simg(k);return `<button type="button" class="dxsp1 ${d.abn?'abn':''}" data-nsadd1="${esc(k)}" title="${esc((d.desc||[]).join(' '))}">${im?`<img src="${esc(im)}" alt="">`:''}${esc(d.ko)}<i>${rng(d)}</i></button>`}).join('')}</div>`).join('')||'<span class="small dim">맞는 상태가 없다</span>'};
  if(o.listOnly)return list();
  const pick=()=>`<div class="dxspk"><div class="dxspr"><input type="text" data-nsq value="${esc(o.q||'')}" placeholder="상태 검색 (이름·설명)"><label class="small dxspn" title="붙일 때의 턴 수. 비우면 상태 DB 의 기본 턴">턴 <input type="number" data-nsn min="1" max="99" value="${esc(o.n||'')}" placeholder="기본"></label></div><div class="dxspg">${list()}</div></div>`;
  return `<div class="dxnow"><div class="k dxk">랭크 · 배율${full?'<span class="small dim">칸을 눌러 조절</span><span class="sp"></span><button type="button" class="btn xs ghost" data-nrk0 title="랭크·배율을 전부 원래대로">초기화</button>':''}</div><div class="dxrkg">${NOW_K.map(cell).join('')}</div>${full&&o.sel?bar():''}</div>
   <div class="dxnow"><div class="k dxk">상태${full?`<span class="sp"></span><button type="button" class="btn xs ${o.pk?'pri':''}" data-nsadd>${o.pk?'닫기':'+ 상태'}</button>`:''}</div><div class="dxstl">${chips||'<span class="small dim">없음</span>'}</div>${full&&o.pk?pick():''}</div>
   ${fx?`<div class="dxnow"><div class="k">효과</div><div class="rks">${fx}</div></div>`:''}`}
 function bindNowEdit(box,mid){if(!box)return;const o={sel:'',temp:false,pk:false,q:''};const mon=()=>(ctx().b.mons||{})[mid];
  const P=k=>['battle','mons',mid,k];
  const redraw=(focusQ)=>{const m=mon();if(!m)return;box.innerHTML=nowEditHtml(m,true,o);bind();if(focusQ){const q=box.querySelector('[data-nsq]');if(q){q.focus();q.setSelectionRange(q.value.length,q.value.length)}}};
  const setMod=async z=>{z=Math.round(+z*1000)/1000;if(!(z>0))return;const m=mon(),k=o.sel;const x0=+(m.mod||{})[k]||1;if(z===x0)return;nowQueue(m);const nm=Object.assign({},m.mod||{});if(z===1)delete nm[k];else nm[k]=z;await A().set(P('mod'),nm);
   /* 손으로 바꾼 배율은 출처 기록에서 떼어 낸다 (나중에 효과 ✕ 로 역으로 나뉘지 않게) */
   const F=m.fx;if(F&&F.mults&&F.mults.some(e=>e.stats&&e.stats[k]!=null)){const nf=JSON.parse(JSON.stringify(F));nf.mults=nf.mults.map(e=>{const s=Object.assign({},e.stats);delete s[k];return Object.assign({},e,{stats:s})}).filter(e=>Object.keys(e.stats).length);await A().set(P('fx'),nf)}redraw()};
  const saveMults=async x=>{await A().set(P('mod'),x.mod||{});await A().set(P('tempMod'),x.tempMod&&Object.keys(x.tempMod).length?x.tempMod:null);await A().set(P('fx'),x.fx||null)};
  /* 곱하기: 출처(손 조정 · 적은 이름)를 남긴 새 줄로 — 임시면 턴 종료 때 풀린다 */
  const addMul=async v=>{v=Math.round(+v*1000)/1000;if(!(v>0)||v===1)return;const m0=mon(),k=o.sel;if(!m0||!k)return;nowQueue(m0);const x=snap(m0);x.mod=x.mod||{};x.mod[k]=Math.round((+x.mod[k]||1)*v*1000)/1000;if(Math.abs(x.mod[k]-1)<0.002)delete x.mod[k];
   if(o.temp){x.tempMod=x.tempMod||{};x.tempMod[k]=Math.round((+x.tempMod[k]||1)*v*1000)/1000}
   x.fx=x.fx||{};x.fx.mults=x.fx.mults||[];const nm=String(o.memo||'').trim().slice(0,30)||'손 조정';x.fx.mults.push({key:nm+' · '+Date.now().toString(36),name:nm,stats:{[k]:v},temp:!!o.temp,hand:1});o.memo='';
   await saveMults(x);redraw()};
  const bind=()=>{
   box.querySelectorAll('[data-nrk]').forEach(b=>b.onclick=()=>{o.sel=o.sel===b.dataset.nrk?'':b.dataset.nrk;redraw()});
   box.querySelectorAll('[data-nrd]').forEach(b=>b.onclick=async()=>{const m=mon(),k=o.sel;const lim=k==='critical'?4:6;const v0=+(m.rank||{})[k]||0;const v=Math.max(-lim,Math.min(lim,v0+(+b.dataset.nrd)));if(v===v0)return;nowQueue(m);
    await A().set(P('rank'),Object.assign({},m.rank||{},{[k]:v}));if(o.temp){const tr=Object.assign({},m.tempRank||{});tr[k]=(+tr[k]||0)+(v-v0);if(!tr[k])delete tr[k];await A().set(P('tempRank'),tr)}redraw()});
   box.querySelectorAll('[data-nmod]').forEach(b=>b.onclick=()=>setMod(b.dataset.nmod));
   const mi=box.querySelector('[data-nmodi]');if(mi)mi.onchange=()=>{const v=mulOf(mi.value,+(mon().mod||{})[o.sel]||1);if(!(v>0)){mi.value=+(mon().mod||{})[o.sel]||1;return A().toast('배율을 못 읽었다 — 1.5 · 1.2*1.5 · ×1.5 처럼')}mi.value=v;setMod(v)};   /* 값을 바로 바꿔 두어 포커스가 빠질 때 한 번 더 곱해지지 않게 */
   const tp=box.querySelector('[data-ntemp]');if(tp)tp.onchange=()=>{o.temp=tp.checked;redraw()};
   const me=box.querySelector('[data-nmemo]');if(me)me.oninput=()=>{o.memo=me.value};
   box.querySelectorAll('[data-nmul]').forEach(b=>b.onclick=()=>addMul(+b.dataset.nmul));
   const mx=box.querySelector('[data-nmulx]'),mg=box.querySelector('[data-nmulgo]');const goX=()=>{const v=mulOf(mx.value,1);if(!(v>0))return A().toast('곱할 값을 못 읽었다 — 1.2 · 1.2*1.5 처럼');mx.value='';addMul(v)};
   if(mg)mg.onclick=goX;if(mx)mx.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();goX()}};
   box.querySelectorAll('[data-nmx]').forEach(b=>b.onclick=async()=>{const m0=mon();if(!m0||!FX())return;const x=snap(m0);const e=((x.fx||{}).mults||[]).find(q=>q.key===b.dataset.nmx);if(!e)return;nowQueue(m0);FX().remove(x,'mults:'+e.key);await saveMults(x);A().sysLog(`【랭크·배율】 ${x.name} 「${String(e.name||e.key).replace(/ · [a-z0-9]+$/,'')}」 배율을 뗐다`,'battle',{mid,img:x.image||''});redraw()});
   const m0b=box.querySelector('[data-nmx0]');if(m0b)m0b.onclick=async()=>{const m0=mon(),k=o.sel;const ms=((m0.fx&&m0.fx.mults)||[]).filter(e=>e&&e.stats&&e.stats[k]!=null);const prod=Math.round(ms.reduce((a,e)=>a*(+e.stats[k]||1),1)*1000)/1000;nowQueue(m0);const nm=Object.assign({},m0.mod||{});if(Math.abs(prod-1)<0.002)delete nm[k];else nm[k]=prod;await A().set(P('mod'),nm);redraw()};
   const r0=box.querySelector('[data-nrk0]');if(r0)r0.onclick=async()=>{const m=mon();const any=NOW_K.some(k=>+(m.rank||{})[k]||(+(m.mod||{})[k]||1)!==1);if(!any)return A().toast('바꿀 랭크·배율이 없다');if(!confirm(`${m.name}의 랭크·배율을 전부 원래대로 돌릴까?`))return;nowQueue(m);
    await A().set(P('rank'),{});await A().set(P('mod'),{});if(m.tempRank)await A().set(P('tempRank'),null);if(m.tempMod)await A().set(P('tempMod'),null);if(m.fx&&m.fx.mults&&m.fx.mults.length){const nf=JSON.parse(JSON.stringify(m.fx));nf.mults=[];await A().set(P('fx'),nf)}nowFlush(mid);redraw()};
   box.querySelectorAll('[data-nsoff]').forEach(b=>b.onclick=async()=>{const m=mon(),k=b.dataset.nsoff;const ns=Object.assign({},m.states||{});delete ns[k];await A().set(P('states'),ns);if(!stLog(m,Object.assign({},m,{states:ns})))A().sysLog(`【상태】 ${m.name}의 「${stName(k)}」이(가) 풀렸다`,'battle',{mid,img:m.image||''});redraw()});
   const ad=box.querySelector('[data-nsadd]');if(ad)ad.onclick=()=>{o.pk=!o.pk;o.q='';redraw(o.pk)};
   /* 검색칸은 목록만 다시 그린다 (칸째 다시 그리면 한글 조합이 끊긴다) */
   const q=box.querySelector('[data-nsq]');if(q)q.oninput=()=>{o.q=q.value;const g=box.querySelector('.dxspg'),m=mon();if(!g||!m)return;g.innerHTML=nowEditHtml(m,true,Object.assign({},o,{listOnly:1}));bindAdd()};
   const sn=box.querySelector('[data-nsn]');if(sn)sn.oninput=()=>{o.n=sn.value};
   box.querySelectorAll('[data-nst]').forEach(inp=>inp.onchange=async()=>{const m=mon(),k=inp.dataset.nst;const v=Math.round(+inp.value);const c=v>0?Math.min(v,999):1000;if(+(m.states||{})[k]===c)return;
    await A().set(P('states'),Object.assign({},m.states||{},{[k]:c}));A().sysLog(`【상태】 ${m.name}의 「${stName(k)}」 남은 턴 → ${c<1000?c+'턴':'계속'}`,'battle',{mid,img:m.image||''});redraw()});
   bindAdd()};
  const bindAdd=()=>box.querySelectorAll('[data-nsadd1]').forEach(b=>b.onclick=async()=>{const m=mon(),k=b.dataset.nsadd1;const d=((DB().states||{}).st||{})[k]||{};const n=Math.round(+o.n);const c=n>0?Math.min(n,999):(d.min>=1000||!d.min?1000:(+d.max>+d.min&&+d.max<1000?+d.min+Math.floor(Math.random()*(+d.max-+d.min+1)):+d.min));const ns=Object.assign({},m.states||{},{[k]:c});await A().set(P('states'),ns);if(k==='LeechSeed')await A().set(P('seedFrom'),seedSrc(ctx().b,m));
    const ds=stDesc(k);/* 11-01 망령 「상태 변화도 효과 로그」: 상태 카드가 되면 예전 줄은 남기지 않는다 */if(!stLog(m,Object.assign({},m,{states:ns}),fcMan('상세 창')))A().sysLog(`【상태】 ${m.name} 「${stName(k)}」${c<1000?` (${c}턴)`:''}${ds.length?'\n'+ds.join('\n'):''}`,'battle',{mid,img:m.image||''});o.pk=false;o.q='';o.n='';redraw()});
  bind()}
 function nowParts(m){return {rank:rankChips(m),state:stateChips(m),fx:flagChips(m)+(FX()?FX().chips(m).map(ch=>`<span class="rk fxc" title="${esc(ch.title)}">${esc(ch.t)}</span>`).join(''):'')}}
 return {askYes,canSeeStx:tid=>stxOk(ctx(),tid),canEditMon:mid=>{const c=ctx();const m=((c.b||{}).mons||{})[mid];return !!m&&canEdit(c,m)},fireAuto,render,nowParts,nowEditHtml,bindNowEdit,watch,ctx,entered,allEntered,fieldOf,fieldCard,statusCard,futureFire,trapWarn,resetLocal:()=>{CMD={}},startCut:(m)=>battleStartCut(ctx().b,m),openHp,action,hotkey,logFx,hitBadge};
})();
