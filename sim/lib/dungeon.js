/* 던전 진행기 — 던전(data/dungeons/*.json)의 방을 차례로 지나며 스킬 체크 · 야생 조우 · 휴식을 돌리고, 일행 상태를 끝까지 추적한다.
   던전: {id, name, wn 동행 수(기본 2), rooms:[{id, t 종류, name, check:{…}, enc:{pack, boss?}, rest:'breath'|'short'|'long'}], path:[방 id 순서]}
   체크 (10-29 v4, lib/skill.js): {v:4, label, stat 지시|육성|통솔|능력, base 종족값 칸(0 HP~5 스피드), target 8|10|12|15, pm ±, twice ±1, fit:{types, moves, abil, etcMons}, noStep,
          (옛 v3 체크 target 5|7|9|11 · step · hint 는 skill.js up 이 v4 로 바꾼다)
          pen:{fail:{dmg:'1/4', st:'Poison', rk:{speed:-1}, oo:1, oc:1, al, memo}}, gain:{…} 성공 보상 · gainCrit:{…} 대성공 이득 (생성기 기본 = 경계도 −10)}
   일행 정책(policy): who 'best'(그 자질 주사위가 가장 큰 사람) | 'round'(돌아가며) · cover 'never' | 'fail'(실패를 받침, 'always' 도 같음 — v4 엔 대가가 없다) · partner 'match'(조건 맞는 안 지친 포켓몬) | 'any' | 'none'
   조정값(adj): fieldMax 필드 포켓몬 수(기본 1, 웹툴 fieldMax) · coverBall 볼 안 커버 · coverHp · crit · injPen · dyingFight …
   휴식: 상태 회복은 룰북 표(긴 2단계 · 중간 · 짧은 1단계 · 숨돌리기 0). HP · 4식 6령은 웹툴 skill_ui REST0 과 같은 표 — 자동 생성 던전은 RULES(10-28: 짧은 = 전원 HP 1/4 · 숨돌리기 = 1체 HP 1/4 + 6령 1 · 중간 = HP 1/2 · 빈사 1/4) */
"use strict";
const fs=require('fs'),path=require('path');
const SK=require('./skill.js'),BT=require('./battle.js'),WD=require('./wild.js');
const DIR=path.resolve(__dirname,'..','data','dungeons');
const REST={long:{hp:'full',revive:1,cure:1,tired:1,care:1,inou:1,inj:2},short:{hp:'1/2',revive:0,cure:1,tired:1,care:1,inou:1,inj:1},breath:{hp:'1/4',revive:0,cure:0,tired:1,care:0,inou:0,inj:0}};
/* 휴식 표 2안 (10-27 망령 「휴식 단계 회복량도 조정해도 돼」): 짧은 휴식이 빈사를 HP 1/4 로 깨운다 — 숨돌리기와 차이를 둔다 */
/* 중간 휴식(10-27 망령 「던전 안은 짧거나 중간, 긴 휴식은 던전이 끝난 뒤」): HP 3/4 · 빈사를 HP 1/2 로 · 상태 · 부상 1단계 */
const REST2={long:REST.long,mid:{hp:'1/2',revive:'1/4',cure:1,tired:1,care:1,inou:1,inj:1},   /* 10-28 중간 휴식 = 웹툴 skill_ui REST0.mid (전원 HP 1/2 · 빈사 1/4 · 상태 회복 · 공용 4식 6령 절반) */short:{hp:'1/2',revive:'1/4',cure:1,tired:1,care:1,inou:1,inj:1},breath:{hp:'1/4',revive:0,cure:0,tired:1,care:0,inou:0,inj:0}};
const TYPE_KO={노말:'Normal',불꽃:'Fire',물:'Water',전기:'Electric',풀:'Grass',얼음:'Ice',격투:'Fighting',독:'Poison',땅:'Ground',비행:'Flying',에스퍼:'Psychic',벌레:'Bug',바위:'Rock',고스트:'Ghost',드래곤:'Dragon',악:'Dark',강철:'Steel',페어리:'Fairy'};
const frac=(v,s)=>{s=String(s==null?'':s).trim();if(s==='full')return v;const m=s.match(/^(\d+)\s*\/\s*(\d+)$/);return m?Math.max(1,Math.floor(v*+m[1]/+m[2])):Math.max(0,Math.floor(+s||0))};
const clone=o=>JSON.parse(JSON.stringify(o));
function dungeons(){const out={};if(!fs.existsSync(DIR))return out;for(const f of fs.readdirSync(DIR)){if(!f.endsWith('.json'))continue;const d=JSON.parse(fs.readFileSync(path.join(DIR,f),'utf8'));if(/\.private\.json$/.test(f))d.private=true;d._file=f;out[d.id||f.replace(/(\.private)?\.json$/,'')]=d}return out}

/* 일행 상태 만들기: parties=[{trainer,mons}] (제작기 파티), wn 동행 수 → 동행 = 파트너 먼저, 그다음 순서대로 */
function makeParty(parties,wn){return parties.map(p=>{const t=clone(p.trainer);const ms=p.mons.slice().sort((a,b)=>(b.partner?1:0)-(a.partner?1:0)).slice(0,wn).map(m=>{const x=clone(m);x.hp.cur=x.hp.max;x.states={};x.rank={};return x});
 return {trainer:t,mons:ms,inj:0,tired:new Set(),inou:0,myosu:0,care:0,aa:0,debt:{oo:0,oc:0,rk:{}},stats:{checks:0,ok:0,cost:0,fail:0,fumble:0,crit:0,covers:0,covered:0,inouUsed:0,penDmg:0}}})}

function pathOf(dg,r){let P=(dg.path||dg.rooms.filter(x=>!x.alt).map(x=>x.id)).slice();for(const g of dg.branches||[]){if(r()<0.5){const i=P.indexOf(g.main[0]);if(i>=0)P.splice(i,g.main.length,...g.alt)}}return P}
/* ---------- 11-01 망령 「은열쇠」 카드 덱 (룰북 「은열쇠 (카드 덱)」) ----------
   opt.cards = 덱 이름(CARD_DECKS) 또는 카드 키 배열 8장. 비우면 카드 없이 (예전과 같다).
   1인 덱 8장 · 손패 3 · 시작 3 · 배틀 시작 1 · 짧은 휴식 1 · 중간 2 · 긴 휴식 = 다시 섞고 3 · 덱이 바닥나 섞으면 광기 +1 (광기 3 · 5 에 죽은 카드 1장씩).
   체크: 굴리기 전 아이콘 맞는 카드를 최대 2장(한 사람 1장) +1 씩 — 성공률이 0.9 미만일 때만. 배틀: 보험형(실타래 되감기 · 안개의 환영)만 fight.js 가 쓴다.
   모델에 없는 것: 관찰 노트 · 호흡 맞추기 · 물러서! · 소금기 어린 부적 · 지도 펼치기 · 불러내기 (아이콘으로 바치는 데만 쓰인다) */
const CARD={key:{n:'열쇠 카드',ic:['★'],v:9,eff:'autopass'},sneak:{n:'발소리 죽이기',ic:['육성','지시'],v:8,eff:'skip'},gust:{n:'기세 올리기',ic:['통솔'],v:6,eff:'al'},
 bandage:{n:'붕대와 진통제',ic:['육성'],v:5,eff:'heal_inj'},reroll:{n:'실타래 되감기',ic:['지시'],v:5,eff:'reroll',battle:1},nocrit:{n:'안개의 환영',ic:['능력'],v:5,eff:'noCrit',battle:1},
 retry:{n:'다른 길로',ic:['지시'],v:4,eff:'retry'},firstaid:{n:'응급 처치',ic:['육성'],v:4,eff:'heal'},craft:{n:'손재주',ic:['능력'],v:4,eff:'easy'},food:{n:'비상식량',ic:['육성','통솔'],v:3,eff:'restUp'},
 breath:{n:'숨 고르기',ic:['★'],v:3,eff:'breath'},salt:{n:'소금기 어린 부적',ic:['능력'],v:3,eff:''},reso:{n:'은빛 공명',ic:['★'],v:2,eff:'cycle'},cover0:{n:'함께 버티자',ic:['통솔'],v:2,eff:'cover0'},
 note:{n:'관찰 노트',ic:['지시'],v:1,eff:''},map:{n:'지도 펼치기',ic:['지시','능력'],v:1,eff:''},pair:{n:'호흡 맞추기',ic:['통솔','지시'],v:1,eff:''},back:{n:'물러서!',ic:['통솔'],v:1,eff:''},call:{n:'불러내기',ic:['능력'],v:1,eff:''},
 keyc:{n:'열쇠 카드 (바치기만)',ic:['★'],v:9,eff:''},
 dodge:{n:'빗나가라!',ic:['지시'],v:2,eff:'dodgeReroll',battle:1},restwatch:{n:'휴식 망보기',ic:['통솔'],v:2,eff:'alRest2'},   /* 11-04 세 칸 30장 초안 */
 /* 11-02 망령 확정 공통 카드 40장 (records/silverkey_pool.json) — 체크 · 던전 쪽 효과만 모델. 배틀 정보 · 대응 카드는 아이콘으로만(바치기) */
 suk:{n:'숙련',ic:['지시'],v:4,eff:'plus',plus:2,stat:'지시'},lead:{n:'리더십',ic:['통솔'],v:4,eff:'plus',plus:2,stat:'통솔'},body:{n:'체력 단련',ic:['육성'],v:4,eff:'plus',plus:2,stat:'육성'},inou2:{n:'이능 해방',ic:['능력'],v:4,eff:'plus',plus:2,stat:'능력'},
 bae:{n:'배수진',ic:['능력'],v:3,eff:'plus',plus:2,risk:2},k15:{n:'결정적 순간',ic:['★'],v:4,eff:'plus',plus:2,only15:1},k15x:{n:'결정적 순간(+1안)',ic:['★'],v:4,eff:'plus',plus:1,only15:1},last:{n:'마지막 힘',ic:['★'],v:3,eff:'plus',plus:2,deckLe:2},adv:{n:'역경',ic:['★'],v:3,eff:'plus',plus:1,injGe:1,plus2At:2},
 medkit:{n:'구급 상자',ic:['육성'],v:4,eff:'heal_inj2'},cheer:{n:'격려',ic:['통솔'],v:2,eff:'nomill'},muri:{n:'무리하지 마',ic:['통솔'],v:3,eff:'cover1'},
 sotr:{n:'급소 털어내기',ic:['능력'],v:2,eff:'critReroll',battle:1},mend:{n:'상비약',ic:['육성'],v:2,eff:'cure',battle:1},rise:{n:'다시 일어서',ic:['지시','육성'],v:2,eff:'actReroll',battle:1},bless:{n:'축복',ic:['능력'],v:2,eff:''},calm:{n:'침착한 대처',ic:['통솔','지시'],v:2,eff:''},scout:{n:'정찰 비행',ic:['지시'],v:1,eff:''},clock:{n:'시계 맞추기',ic:['지시'],v:1,eff:''},dead:{n:'광기 카드',ic:[],v:-1,eff:'dead',pen:'mad'},scar:{n:'상흔 카드',ic:[],v:-1,eff:'dead',pen:'scar'}};
/* 11-01 망령 「코스트」: 효과로 쓸 때만 코스트 (바치기는 무료). 트레이너마다 5점 · 긴 휴식에 5로 */
const CARD_COST={"key":2,"sneak":3,"gust":1,"bandage":1,"reroll":2,"nocrit":2,"retry":2,"firstaid":2,"craft":2,"food":1,"breath":1,"salt":1,"reso":1,"cover0":2,"note":1,"map":0,"pair":1,"back":1,"call":0,"keyc":2,"suk":2,"lead":2,"body":2,"inou2":2,"bae":0,"k15":2,"k15x":2,"last":1,"adv":0,"medkit":2,"cheer":1,"muri":1,"sotr":1,"mend":2,"bless":1,"calm":1,"scout":1,"clock":0,"rise":1};for(const k in CARD)CARD[k].c=CARD_COST[k]||0;
const CARD_DECKS={base:['key','key','reroll','bandage','gust','nocrit','retry','reso'],sneak:['key','key','reroll','bandage','gust','nocrit','sneak','reso'],
 check:['key','key','reso','breath','gust','craft','retry','bandage'],battle:['key','key','reroll','reroll','nocrit','nocrit','firstaid','reso'],
 nokey:['keyc','keyc','reroll','bandage','gust','nocrit','retry','reso'],
 /* 11-02 확정 40장에서 짠 덱 (열쇠 2 + 준비 6) — 시뮬 records/silverkey_pool.json 검토용 */
 p_check:['key','key','bae','k15','suk','lead','cover0','last'],p_care:['key','key','cover0','bandage','medkit','food','gust','cheer'],
 p_mix:['key','key','bae','k15','cover0','bandage','food','reroll'],p_star:['key','key','k15','last','adv','breath','reso','cover0'],
 p_stat:['key','key','suk','lead','body','inou2','cover0','bandage'],p_battle:['key','key','reroll','nocrit','sotr','mend','rise','cover0'],p_typ:['key','key','k15','bae','mend','nocrit','food','cover0'],p_check1:['key','key','bae','k15x','suk','lead','cover0','last'],
 /* 11-02 18시 망령 「객원 2명 · 여러 조합」: 확정 40장(아이콘 지시 9 · 육성 9)만으로 짠 덱 — 열쇠 2 + 준비 6 */
 d_check:['key','key','bae','k15','suk','lead','cover0','last'],d_care:['key','key','cover0','bandage','medkit','food','gust','cheer'],d_battle:['key','key','reroll','nocrit','sotr','mend','rise','cover0'],
 d_star:['key','key','k15','last','adv','breath','reso','cover0'],d_stat:['key','key','suk','lead','body','inou2','cover0','bandage'],d_dgn:['key','key','gust','craft','food','breath','bandage','muri'],
 d_bal:['key','key','reroll','nocrit','cover0','bandage','k15','gust'],d_guard:['key','key','cover0','muri','cheer','bandage','medkit','nocrit']};   /* 열쇠 카드를 「판정 없이 통과」 없이 ★ 바치기로만 쓸 때 */
/* 11-04 망령 「30장 목록은 시뮬레이터에 그 대표카드 고르는 칸 맞게」: 카드풀 화면(ui/cards.html)의 세 칸(체크 · 던전 · 배틀 10장씩)을 records/silverkey_pool.json 의 slots 로 저장 → 세 칸 시뮬이 그 목록에서 고른다.
   이름이 시뮬 CARD 와 같으면 그 효과 모델, 아니면 아이콘만(바치기 재료) 쓰는 카드로 넣는다. 아이콘은 카드풀 화면 값(고친 것 포함) */
let SLOT_POOL,SLOT_AT=0;function slotPool(){const fs=require('fs'),path=require('path');const R=path.join(__dirname,'..','records');let mt=0;try{mt=fs.statSync(path.join(R,'silverkey_pool.json')).mtimeMs}catch(e){}if(SLOT_POOL!==undefined&&mt===SLOT_AT)return SLOT_POOL;SLOT_AT=mt;SLOT_POOL=null;try{const P=JSON.parse(fs.readFileSync(path.join(R,'silverkey_pool.json'),'utf8'));if(!P.slots)return null;
 const C=JSON.parse(fs.readFileSync(path.join(R,fs.existsSync(path.join(R,'silverkey_candidates_v3.json'))?'silverkey_candidates_v3.json':'silverkey_candidates_v2.json'),'utf8')).cards;const by=Object.fromEntries(C.map(c=>[c.id,Object.assign({},c,(P.edits||{})[c.id]||{})]));const NK={};for(const k in CARD)NK[CARD[k].n]=k;const out={c:[],d:[],b:[],names:{}};
 for(const w of ['c','d','b'])for(const id of (P.slots[w]||[])){const c=by[id];if(!c)continue;let k=NK[c.name]||NK[String(c.name).replace(/!$/,'')];if(!k){k='x_'+id;CARD[k]={n:c.name,ic:c.icons||[],v:1,eff:'',c:0}}else CARD[k].ic=(c.icons||CARD[k].ic).slice();out[w].push(k);out.names[k]=c.name}SLOT_POOL=out}catch(e){SLOT_POOL=null}return SLOT_POOL}
async function run(W,dg,parties,opt){opt=opt||{};const rng=opt.rng||BT.mkRng(opt.seed||1);const pol=Object.assign({who:'best',cover:opt.cards&&!(opt.adjust&&+opt.adjust.coverOn)?'never':'fail',partner:'match',inou:'yes'},opt.policy||{});   /* 11-01 23:56 망령: 은열쇠 덱이 있으면 커버 없음 (adj.coverOn 1 이면 켬) */
 const adj=Object.assign({fieldMax:1,coverBall:0,ordScope:'dungeon',ordPer:1,cmdPer:2,target:0,penScale:1,checkEvery:1,stepAll:0,wildLv:0,wildExtra:0,bossN:0,raidX:null,raidMode:'barrier',restV:1,al0:0,al30:5,al70:10,alBattle:0,alLose:10,alScale:1},dg.rules||{},opt.adjust||{});   /* 10-31 망령 「꼭 고쳐」: alLose 는 규칙에 없는 옛 던전도 +10 (autogen RULES 와 같다) */   /* dg.rules = 던전에 박힌 규칙값(자동 생성 던전). 조정값(opt.adjust)이 그 위에 */
 const party=makeParty(parties,dg.wn||opt.wn||2);const ev=[];const say=(e)=>ev.push(e);
 /* 11-04 망령: 던전 일행 소지품 — 동행 2체 기준 소켓을 일행이 합치고, 중복 금지도 일행 전체 (lib/autoitem.js pool) */
 if(opt.partyItems!==false){const ip=require('./autoitem.js').pool(W,party);if(ip.log.length||ip.over)say({k:'items',cap:ip.cap,spent:ip.spent,over:ip.over,log:ip.log})}
 /* 11-01 은열쇠 카드 */
 const deckOf=x=>Array.isArray(x)?x:CARD_DECKS[x]||CARD_DECKS.base;   /* 11-02 18시: 「a+b」 또는 [덱, 덱] = 트레이너마다 다른 덱(순서대로 돌려 씀) */
 const CDL=opt.cards?(typeof opt.cards==='string'&&opt.cards.includes('+')?opt.cards.split('+').map(deckOf):Array.isArray(opt.cards)&&Array.isArray(opt.cards[0])?opt.cards.map(deckOf):null):null;
 const CD=opt.cards?(CDL?CDL[0]:deckOf(opt.cards)):null;const cstat={use:{},commit:0,mad:0,dead:0,skip:0,autopass:0,retryOk:0,draws:0,reshuffle:0,costSpent:0,madIn:0,scarIn:0,collapse:0,penDrawn:0,penClear:0,noCost:0,mill:0,overpay:0,madOut:0};
 /* 11-04 망령 「세 칸」 시안 (opt.cards==='slot', 06:14~06:29): 덱 · 드로우 · 덱탑 · 광기 · 코스트 없음. 트레이너마다 체크 · 던전 · 배틀 칸 1장씩 + 일행 공용 예비 가방(종류마다 adj.slotRes 장, 기본 1).
    짧은 · 중간 휴식 때 트레이너마다 빈 칸 하나를 예비로(배틀 → 체크 → 던전 순). 부상 단계 = 카드 1장 버림(4식 · 6령 대신). 바치기는 결과를 보고(아이콘 · +1 · 체크 하나에 1장). 배틀 카드는 자기 포켓몬에게만 (fight.js cardTake own) */
 const SLOT=opt.cards==='slot';const SPL=SLOT&&adj.slotPool!==0&&adj.slotPool!=='0'?slotPool():null;const SK_C=SPL&&SPL.c.length?SPL.c:['suk','lead','body','inou2','bae','k15','adv','cover0','muri','cheer'],SK_D=SPL&&SPL.d.length?SPL.d:['gust','bandage','medkit','food','breath','craft'],SK_B=SPL&&SPL.b.length?SPL.b:['reroll','nocrit','sotr','rise'];const kindOf=k=>SK_C.includes(k)?'c':SK_D.includes(k)?'d':SK_B.includes(k)?'b':'';let SRES=null;
 const shuf=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
 const COST0=adj.cost0==null?5:+adj.cost0,MADCAP=adj.madCap==null?2:+adj.madCap,HAND=adj.hand==null?4:+adj.hand;   /* 11-01 21:58 망령: 손패 4 · 박자마다 4장까지 채움 · 부상 1장 · 중상 2장 덱 맨 위 버림 · 빈사 = 증상 1장 · 코스트 모자라면 그만큼 덱 맨 위 버림 · 커버는 트레이너마다 휴식 사이 1회 */   /* 11-01 망령: 코스트 5 · 광기 칸 2 (3장째면 붕괴 = 던전 이탈) · adj.madStart = 이미 덱에 든 광기 카드 */
 for(const P of party)P.coverUsed=0;
 if(CD)for(const [pi,P] of party.entries()){P.cd={pile:shuf(CDL?CDL[pi%CDL.length]:CD),hand:[],disc:[],mad:0,dead:0,cost:COST0,madN:0};for(let i=0;i<(+adj.madStart||0)&&i<MADCAP;i++){P.cd.madN++;P.cd.pile.splice(Math.floor(rng()*(P.cd.pile.length+1)),0,'dead')}}
 if(SLOT){const pick=L=>L[Math.floor(rng()*L.length)];const STK={지시:'suk',통솔:'lead',육성:'body',능력:'inou2'};for(const P of party){const R=P.trainer.ranks||{};const best=['지시','육성','통솔','능력'].sort((a,b)=>SK.lv(R[b]||'C')-SK.lv(R[a]||'C'))[0];P.cd={pile:[],hand:[adj.slotPick==='rand'||!SK_C.includes(STK[best])?pick(SK_C):STK[best],pick(SK_D),pick(SK_B)],disc:[],mad:0,dead:0,cost:999,madN:0,slot:1}}
  SRES={c:[],d:[],b:[]};/* 11-04 06:54 망령 「PL 이 3칸 외에 예비 칸이 있어서 한 장 넣고, 합치면 예비 덱」 (adj.slotRes4 1): 트레이너마다 예비 1장(종류는 각자 — 시뮬은 무작위) · 아니면 옛 시안(종류마다 slotRes 장) */
  if(+adj.slotRes4){for(const P of party){const w=pick(['c','d','b']);SRES[w].push(pick(w==='c'?SK_C:w==='d'?SK_D:SK_B))}}else{const nR=adj.slotRes==null?1:+adj.slotRes;for(let i=0;i<nR;i++){SRES.c.push(pick(SK_C));SRES.d.push(pick(SK_D));SRES.b.push(pick(SK_B))}}}
 /* 패널티 카드: 중상 → 상흔 · 빈사 / 덱 소진 → 광기. 광기는 칸(2)이 차 있으면 붕괴. 뽑아도 대신 뽑기 없음 */
 const penIns=(P,kind)=>{if(!P.cd||P.gone)return;if(kind==='mad'){if(P.cd.madN>=MADCAP){P.gone=true;P.inj=3;cstat.collapse++;say({k:'collapse',who:P.trainer.name});return}P.cd.madN++;cstat.madIn++;P.cd.pile.splice(Math.floor(rng()*(P.cd.pile.length+1)),0,'dead')}else{cstat.scarIn++;P.cd.pile.splice(Math.floor(rng()*(P.cd.pile.length+1)),0,'scar')}};
 const refill=P=>{if(!P.cd.pile.length){if(!P.cd.disc.length)return false;P.cd.pile=shuf(P.cd.disc);P.cd.disc=[];P.cd.mad++;cstat.mad++;cstat.reshuffle++;penIns(P,'mad');if(P.gone)return false}return true};
 const cMill=(P,n)=>{if(!P.cd||P.gone)return;if(SLOT){for(let i=0;i<n&&P.cd.hand.length;i++){const h=P.cd.hand.slice().sort((a,b)=>CARD[a].v-CARD[b].v);const k=h[0];P.cd.hand.splice(P.cd.hand.indexOf(k),1);P.cd.disc.push(k);cstat.mill++}return}let left=n,guard=0;while(left>0&&guard++<30){if(!refill(P))return;const k=P.cd.pile.shift();if(CARD[k].pen){P.cd.hand.push(k);cstat.penDrawn++;if(k==='dead'&&rng()<0.5)cstat.alQ=(cstat.alQ||0)+10;continue}P.cd.disc.push(k);cstat.mill++;left--}};   /* 11-01 22:2x 망령: 버리다 증상 카드가 나오면 손으로(뽑을 때 효과) · 한 장 더 버린다 */
 const cDraw=(P,n)=>{if(!P.cd||SLOT)return;for(let i=0;i<n;i++){if(!refill(P))break
   const k=P.cd.pile.shift();P.cd.hand.push(k);cstat.draws++;if(CARD[k].pen){cstat.penDrawn++;if(k==='dead'&&rng()<0.5)cstat.alQ=(cstat.alQ||0)+10}}
  while(P.cd.hand.length>HAND){const real=P.cd.hand.filter(k=>k!=='dead');if(!real.length)break;real.sort((a,b)=>CARD[a].v-CARD[b].v);const k=real[0];P.cd.hand.splice(P.cd.hand.indexOf(k),1);P.cd.disc.push(k)}};
 const cFill=P=>{if(P.cd&&!P.gone)cDraw(P,Math.max(0,HAND-P.cd.hand.length))};
 const cUse=(P,k,pay)=>{const i=P.cd.hand.indexOf(k);if(i<0)return false;if(pay!==false){const c=CARD[k].c||0;if(P.cd.cost<c){if(P.cd.madN>=MADCAP)return false;const sh=c-P.cd.cost;cstat.costSpent+=P.cd.cost;P.cd.cost=0;cstat.overpay+=sh;cMill(P,sh)}else{P.cd.cost-=c;cstat.costSpent+=c}}P.cd.hand.splice(P.cd.hand.indexOf(k),1);P.cd.disc.push(k);if(pay!==false)cstat.use[k]=(cstat.use[k]||0)+1;return true};
 const cFind=(eff,who)=>{if(!CD)return null;for(const P of (who?[who]:party)){if(!P.cd||P.inj>=3)continue;const k=P.cd.hand.find(x=>CARD[x].eff===eff);if(k){if(P.cd.cost>=(CARD[k].c||0)||P.cd.madN<MADCAP)return {P,k};cstat.noCost++}}return null};
 /* 손패의 패널티 치우기 (방에 들어설 때): 상흔 = 코스트 1 또는 손패 1장 함께 버리기 · 광기 = 코스트 2 또는 통솔 체크(약 75%) */
 const cClear=P=>{if(!P.cd||P.gone)return;for(const k of P.cd.hand.slice()){if(!CARD[k].pen)continue;const i=P.cd.hand.indexOf(k);let ok=false;if(k==='scar'){if(P.cd.cost>=3){P.cd.cost--;cstat.costSpent++;ok=true}else{const real=P.cd.hand.filter(x=>!CARD[x].pen).sort((a,b)=>CARD[a].v-CARD[b].v);if(real.length>=2){const d=real[0];P.cd.hand.splice(P.cd.hand.indexOf(d),1);P.cd.disc.push(d);ok=true}}}else{if(P.cd.cost>=4){P.cd.cost-=2;cstat.costSpent+=2;ok=true}else if(rng()<0.75)ok=true}if(ok){P.cd.hand.splice(P.cd.hand.indexOf(k),1);P.cd.disc.push(k);cstat.penClear++}}};
 const cReset=P=>{if(!P.cd||SLOT)return;let all=[...P.cd.pile,...P.cd.hand,...P.cd.disc];const di=all.indexOf('dead');if(di>=0&&P.cd.madN>0){all.splice(di,1);P.cd.madN--;cstat.madOut++}P.cd.pile=shuf(all);P.cd.hand=[];P.cd.disc=[];P.cd.cost=COST0;cDraw(P,HAND)};   /* 긴 휴식: 증상 1장 빼고 전부 섞어 4장 · 코스트 5 */
 const pOk=q=>{const d=SK.dist(q);return d[3]+d[4]};
 if(CD)for(const P of party)cDraw(P,HAND);
 const aliveMons=P=>P.mons.filter(m=>m.hp.cur>0);
 /* 10-29 필드 포켓몬 (룰북 「던전 · 배틀 중엔 필드 포켓몬만」 · 웹툴 skill_ui fieldMax 기본 1): 트레이너마다 살아 있는 동행 앞에서 adj.fieldMax 체. 커버도 필드만(adj.coverBall 1 이면 볼 안의 동행도) */
 const fieldMons=P=>aliveMons(P).slice(0,Math.max(1,+adj.fieldMax||1));const anyAlive=()=>party.some(P=>!P.gone&&aliveMons(P).length);
 const rankOf=(P,st)=>((P.trainer.ranks||{})[st]||'C');
 let round=0;
 /* 10-29 스킬 체크 v4 (lib/skill.js): 판정할 사람 · 포켓몬 고르기 — 일행 모두 필드(동행 wn 체)에 있다고 보고, 보정 합이 가장 큰 짝을 고른다.
    초상 능력(능력 A 이상 · 휴식 사이 A 1 · AA 2)은 「능력」 체크에서 포켓몬보다 나을 때만 (pol.inou 'no' 면 안 씀) */
 const supMax=P=>{const l=SK.lv(rankOf(P,'능력'));return l>=4?2:l>=3?1:0};
 const myosuMax=P=>{const l=SK.lv(rankOf(P,'지시'));return l>=4?2:l>=3?1:0};
 const optFor=(P,ck)=>{const base={rank:rankOf(P,ck.stat),pm:(+ck.pm||0)+(+adj.stepAll||0),twice:+ck.twice||0,inj:P.inj,tough:SK.lv(rankOf(P,'육성'))>=3};const L=[];
  if(pol.partner!=='none')for(const m of fieldMons(P)){const f=SK.monFit(m,ck);L.push(Object.assign({},base,{mon:f.mon,fit:pol.partner==='match'?f.fit:0,m,why:f.why}))}
  L.push(Object.assign({},base,{mon:null,m:null}));
  if(ck.stat==='능력'&&pol.inou!=='no'&&P.inou<supMax(P))L.push(Object.assign({},base,{super:true,m:null}));
  return L.map(q=>Object.assign(q,{mod:SK.modOf(q)})).sort((a,b)=>b.mod-a.mod||(a.super?1:0)-(b.super?1:0))[0]};
 /* 체크 하나 */
 const doCheck=(room,ck0)=>{const ck=SK.up(ck0);const target=+ck.target+adj.target;const cands=party.filter(P=>P.inj<3);if(!cands.length)return null;let P;
  if(pol.who==='round'){P=cands[round%cands.length];round++}else{P=cands.slice().sort((a,b)=>optFor(b,ck).mod-optFor(a,ck).mod)[0]}
  const rank=rankOf(P,ck.stat);const q=optFor(P,ck);q.target=target;q.crit=adj.crit==null?4:+adj.crit;q.myosu=myosuMax(P)-P.myosu>0?1:0;
  /* 11-01 은열쇠: 손재주(함정 · 기믹 · 수수께끼 목표 −2) → 열쇠 카드(함정 · 수수께끼 · 어려운 체크를 판정 없이) → 아이콘 바치기 (성공률 0.9 미만일 때, 최대 2장 · 한 사람 1장) */
  let keyPass=false;const cardRec=[];
  if(CD){const trapish=['trap','puzzle'].includes(room.t);
   if(trapish){const c=cFind('easy');if(c&&pOk(q)<0.9){cUse(c.P,c.k);q.target-=2;cardRec.push(CARD[c.k].n)}}
   if((trapish||(adj.keyTrap!=null&&+adj.keyTrap===0&&q.target>=12))&&pOk(q)<0.75){const c=cFind('autopass');if(c){cUse(c.P,c.k);keyPass=true;cstat.autopass++;cardRec.push(CARD[c.k].n)}}
   if(!keyPass&&!SLOT){const usedBy=new Set();q.bonus=0;while(q.bonus<(adj.bkMax==null?1:+adj.bkMax)&&pOk(q)<0.9){let best=null;for(const Q of party){if(!Q.cd||Q.inj>=3||usedBy.has(Q))continue;for(const k of Q.cd.hand){const C=CARD[k];if(!C.ic.length||!(C.ic.includes('★')||C.ic.includes(ck.stat))||C.eff==='autopass'||C.eff==='skip')continue;if(!best||C.v<best.v)best={Q,k,v:C.v}}}
     if(!best)break;cUse(best.Q,best.k,false);if(+adj.bkMill!==0&&CARD[best.k].eff!=='nomill')cMill(best.Q,1);usedBy.add(best.Q);q.bonus++;cstat.commit++;   /* 바치면 덱 맨 위 1장도 버림 */cardRec.push(CARD[best.k].n+' +1')}}}
  /* 11-02 확정 40장: 체크 +N 카드(숙련 · 리더십 · 체력 단련 · 이능 해방 · 배수진 · 결정적 순간 · 마지막 힘 · 역경) — 한 체크에 1장, 성공률 0.75 미만일 때. 배수진은 실패하면 상태 두 단계 */
  let riskN=0,plusUsed=false;if(CD&&!keyPass&&pOk(q)<(adj.plusAt==null?0.75:+adj.plusAt)){let best=null;for(const Q of party){if(!Q.cd||Q.inj>=3)continue;for(const k of Q.cd.hand){const C=CARD[k];if(C.eff!=='plus')continue;if(C.stat&&C.stat!==ck.stat)continue;if(C.only15&&target<15)continue;if(C.deckLe!=null&&Q.cd.pile.length>C.deckLe)continue;if(C.injGe!=null&&Math.max(...party.map(X=>X.inj||0))<C.injGe)continue;   /* 11-02 2차: 역경 = 일행 누구든 부상 이상 */if(C.risk&&pOk(Object.assign({},q,{bonus:(q.bonus||0)+C.plus}))<0.7)continue;if((Q.cd.cost<(C.c||0))&&Q.cd.madN>=MADCAP)continue;const sc=C.plus*10-(C.risk?5:0)-(C.c||0);if(!best||sc>best.sc)best={Q,k,sc}}}
   if(best&&cUse(best.Q,best.k)){const C0=CARD[best.k];const pl=C0.plus2At!=null&&Math.max(...party.map(X=>X.inj||0))>=C0.plus2At?2:C0.plus;plusUsed=true;q.bonus=(q.bonus||0)+pl;riskN=CARD[best.k].risk||0;cstat.plus=(cstat.plus||0)+1;cardRec.push(C0.n+' +'+pl)}}
  let r=keyPass?{ri:3,mod:SK.modOf(q),a:0,p:0,total:0,fumble:false}:SK.roll(q,rng);
  if(CD&&!keyPass&&r.ri===1&&!(plusUsed&&(adj.oneEff==null||+adj.oneEff!==0))){const c=cFind('retry');if(c){cUse(c.P,c.k);cardRec.push(CARD[c.k].n);const r2=SK.roll(q,rng);if(r2.ri>=3)cstat.retryOk++;r=r2}}/* 세 칸: 결과를 보고 바친다 — +1 로 한 단계 오를 때만, 아이콘 맞는 카드(★) 중 값이 가장 낮은 것(배틀 칸은 아낀다) */if(SLOT&&!keyPass&&!r.fumble){const need=r.ri===1&&r.total+1>=q.target?3:r.ri===3&&r.total+1>=q.target+(q.crit==null?4:q.crit)?4:0;if(need){let best=null;for(const Q of party){if(!Q.cd||Q.inj>=3)continue;for(const k of Q.cd.hand){const C=CARD[k];if(!C.ic.length||!(C.ic.includes('★')||C.ic.includes(ck.stat)))continue;const kv=C.v+(kindOf(k)==='b'?3:0);if(need===4&&kv>3)continue;if(!best||kv<best.v)best={Q,k,v:kv}}}if(best){cUse(best.Q,best.k,false);r=Object.assign({},r,{total:r.total+1,ri:need});cstat.commit++;cstat.commitAfter=(cstat.commitAfter||0)+1;cardRec.push(CARD[best.k].n+' +1 (결과 뒤)')}}}if(r.myosuUsed)P.myosu++;const mode=q.super?'inou':'skill';if(q.super)P.inou++;
  const rec={cards:cardRec,room:room.id,label:ck.label,stat:ck.stat,target,who:P.trainer.name,rank,mode,partner:q.m?q.m.name:(q.super?'이능':'혼자'),mod:r.mod,fit:q.fit||0,pdie:6,die:6,a:r.a,p:r.p,total:r.total,ri0:r.ri,ri:r.ri,fumble:r.fumble,stubborn:false,cover:'',pen:[]};
  /* 실패: 상태 한 단계 (제시가 noStep 이면 없음). 커버 = 판정하지 않은 포켓몬이 최대 HP adj.coverHp(1/4) 를 받고 막는다 (pol.cover 'never' 면 안 함) */
  if(r.ri===1&&!+ck.noStep){let C=null;if(pol.cover!=='never'){const cs=(+adj.coverN===0||P.coverUsed<(adj.coverN==null?1:+adj.coverN))?party.flatMap(Q=>(+adj.coverBall?aliveMons(Q):fieldMons(Q)).map(m=>({Q,m}))).filter(x=>x.m!==q.m&&x.m.hp.cur>frac(x.m.hp.max,adj.coverHp||'1/4')):[];cs.sort((a,b)=>b.m.hp.cur/b.m.hp.max-a.m.hp.cur/a.m.hp.max);C=cs[0]||null}
   if(C){const c0=cFind('cover0');let loss=frac(C.m.hp.max,adj.coverHp||'1/4');if(c0){cUse(c0.P,c0.k);loss=0}C.m.hp.cur=Math.max(0,C.m.hp.cur-loss);rec.cover=C.Q.trainer.name;P.coverUsed=(P.coverUsed||0)+1;C.Q.stats.covers++;P.stats.covered++;rec.pen.push(`[커버] ${C.m.name} HP −${loss}`)}
   else{let saved=false;const one=adj.oneEff==null||+adj.oneEff!==0;   /* 11-02 감우 제안 규칙: 체크 하나에 효과로 쓰는 체크 카드는 1장 (누가 내든) — adjust oneEff=0 이면 끔 */const c0=CD&&pol.cover==='never'&&riskN<2&&!(one&&plusUsed)?cFind('cover0'):null;if(c0&&cUse(c0.P,c0.k)){rec.pen.push('[함께 버티자] 상태 그대로');saved=true}
    if(!saved&&CD&&pol.cover==='never'&&riskN<2&&!(one&&plusUsed))for(const Q of party){if(Q===P||!Q.cd||Q.inj>=3)continue;const k=Q.cd.hand.find(x=>CARD[x].eff==='cover1');if(k&&(!SLOT||Q.inj<2)&&cUse(Q,k)){if(SLOT){injure(Q,'무리하지 마 — 대신 받음',rec);rec.pen.push(`[무리하지 마] ${Q.trainer.name} 가 대신 받음`)}else{cMill(Q,2);rec.pen.push('[무리하지 마] 상태 그대로 · 대신 덱 2장')}saved=true;break}}
    if(!saved){injure(P,'실패',rec);if(riskN>=2)injure(P,'배수진',rec)}}}   /* 11-01: 커버가 없으면 「함께 버티자」가 실패의 상태 진행을 막는다 */
  P.stats.checks++;if(rec.ri>=3)P.stats.ok++;if(rec.ri===4)P.stats.crit++;if(rec.ri<=1)P.stats.fail++;if(mode==='inou')P.stats.inouUsed++;
  /* 보상 · 패널티 묶음 (묶음은 판정한 포켓몬이 받는다 — 혼자면 포켓몬 몫은 없음) */
  if(rec.ri>=3&&ck.gain)applyPen(P,ck.gain,rec,'성공 보상');if(rec.ri===4&&ck.gainCrit)applyPen(P,ck.gainCrit,rec,'대성공 보상');
  const pen=ck.pen||{};if(rec.ri<=1&&pen.fail)applyPen(P,pen.fail,rec,'실패',q.m||null);
  say(Object.assign({k:'check'},rec));if(GIM.length)gimRun('check',room,{fail:rec.ri<=1,P});return rec};
 /* 상태 단계: 건강 → 부상(6령 −1 · 판정 −1) → 중상(4식 −1 · 불리) → 빈사(그 방에서 판정 못 함, 다음 방에서 중상) */
 const injure=(P,why,rec)=>{if(P.inj>=3)return;P.inj++;if(CD){if(SLOT)cMill(P,1);else{if(P.inj===1)cMill(P,1);if(P.inj===2)cMill(P,2);if(P.inj===3)penIns(P,'mad')}}const lab=['건강','부상','중상','빈사'][P.inj];const L=[`${P.trainer.name} 「${lab}」 (${why})`];
  const cut=SLOT?null:P.inj===1?['command',+(adj.injOc==null?1:adj.injOc)]:P.inj===2?['order',+(adj.injOo==null?1:adj.injOo)]:null;
  if(cut&&cut[1]){if(adj.ordScope==='dungeon'){const miss=Math.max(0,cut[1]-pool[cut[0]]);pool[cut[0]]=Math.max(0,pool[cut[0]]-cut[1]);/* 11-04: 모자라면 소지 1체 1/2 */for(let i=0;i<miss;i++){const a=aliveMons(P);const h=a[Math.floor(rng()*a.length)];if(!h)break;const loss=Math.max(1,Math.floor(h.hp.max/2));h.hp.cur=Math.max(0,h.hp.cur-loss);P.stats.penDmg+=loss;L.push(`낼 것 없음 → ${h.name} HP −${loss} (1/2)`)}}else P.debt[cut[0]==='order'?'oo':'oc']+=cut[1];L.push(`${cut[0]==='order'?'4식':'6령'} −${cut[1]}`)}
  rec.pen.push(L.join(' · '));say({k:'injury',who:P.trainer.name,inj:P.inj,why})};
 const applyPen=(P,sub,rec,why,mon)=>{sub=sub||{};const L=[];const ms=aliveMons(P);const m=mon!==undefined?(mon&&mon.hp.cur>0?mon:null):ms.length?ms[Math.floor(rng()*ms.length)]:null;
  if(sub.dmg&&m){let loss=frac(m.hp.max,sub.dmg);loss=Math.max(1,Math.floor(loss*adj.penScale));m.hp.cur=Math.max(0,m.hp.cur-loss);P.stats.penDmg+=loss;L.push(`${m.name} HP −${loss}`)}
  if(sub.st&&m&&m.hp.cur>0){m.states[sub.st]=+sub.cnt>0?+sub.cnt:sub.st==='Sleep'?2:sub.st==='Confusion'?3:1000;L.push(`${m.name} 「${sub.st}」`)}
  if(sub.rk){for(const k in sub.rk)P.debt.rk[k]=(P.debt.rk[k]||0)+(+sub.rk[k]||0);L.push('랭크 '+JSON.stringify(sub.rk))}
  if(adj.ordScope==='dungeon'){/* 10-28: 던전 공용 풀에서 바로 뺀다 · 11-04 망령: 낼 4식 · 6령이 모자라면 모자란 수만큼 소지 1체가 최대 HP 1/2 피해 (웹툴 skill_ui halfHit) */const miss=Math.max(0,(+sub.oo||0)-pool.order)+Math.max(0,(+sub.oc||0)-pool.command);if(+sub.oo)pool.order=Math.max(0,pool.order-(+sub.oo));if(+sub.oc)pool.command=Math.max(0,pool.command-(+sub.oc));for(let i=0;i<miss;i++){const a=aliveMons(P);const h=(m&&m.hp.cur>0)?m:a[Math.floor(rng()*a.length)];if(!h)break;const loss=Math.max(1,Math.floor(h.hp.max/2));h.hp.cur=Math.max(0,h.hp.cur-loss);P.stats.penDmg+=loss;L.push(`낼 것 없음 → ${h.name} HP −${loss} (1/2)`)}if(+sub.oo||+sub.oc)L.push(`4식 −${+sub.oo||0} · 6령 −${+sub.oc||0} (던전 공용 남은 4식 ${pool.order} · 6령 ${pool.command})`)}
  else{if(+sub.oo)P.debt.oo+=+sub.oo;if(+sub.oc)P.debt.oc+=+sub.oc;if(+sub.oo||+sub.oc)L.push(`4식 −${+sub.oo||0} · 6령 −${+sub.oc||0} (다음 배틀)`)}
  /* 배틀에 닿는 패널티: fight 추가 조우(이 방 바로 뒤) · restDown 다음 휴식 한 단계 깎임 · foeLv 다음 배틀 야생 레벨 + */
  if(sub.fight){pend.fights.push(sub.fight);L.push(`추가 조우 ${(sub.fight.mix||[]).length||sub.fight.n||1}체`)}
  if(+sub.restDown){pend.restDown+=+sub.restDown;L.push(`다음 휴식 −${+sub.restDown}단계`)}
  if(+sub.foeLv){pend.foeLv+=+sub.foeLv;L.push(`다음 배틀 야생 Lv +${+sub.foeLv}`)}
  if(+sub.al){const b=pend.al;pend.al=Math.max(0,Math.min(100,pend.al+(+sub.al)*(+adj.alScale||1)));L.push(`경계도 ${pend.al>=b?'+':'−'}${Math.abs(pend.al-b)} → ${pend.al}`);say({k:'alert',from:b,to:pend.al})}
  if(+sub.bossLv){pend.bossLv+=+sub.bossLv;L.push(`보스방 Lv ${+sub.bossLv>0?'+':''}${+sub.bossLv}`)}
  if(sub.memo)L.push(sub.memo);rec.pen.push(`[${why}] `+L.join(' · '))};
 const pool0={order:party.length*(+adj.ordPer||0),command:party.length*(+adj.cmdPer||0)};const pool=Object.assign({},pool0);   /* 던전 공용 4식 · 6령 (10-28) */
 const pend={fights:[],restDown:0,foeLv:0,bossLv:0,al:+adj.al0||0};const alTrack={n:0,lo:0,mid:0,hi:0,boss:null,max:0};
 /* 경계도 (웹툴 던전 탭과 같은 단계): 30 이상 → 야생 Lv +al30, 70 이상 → +al70, 100 → 자동 실패 */
 const alLv=()=>pend.al>=70?(+adj.al70||0):pend.al>=30?(+adj.al30||0):0;
 /* 11-04 06:46 망령 「50 이상으로 보스레벨 +5, 70 이상으로 추가로 야생 레벨 +5」: adj.alB50 = 경계도 50 이상이면 보스방 Lv + · adj.alB70 = 70 이상이면 보스방에 더 + (기본 0) — 보스방 레벨은 alLv 에 더한다 */
 const alBoss=()=>(pend.al>=50?(+adj.alB50||0):0)+(pend.al>=70?(+adj.alB70||0):0);
 /* 조우 */
 const doBattle=async(room,enc)=>{let wild;
  if(enc.mix){/* 여러 트레이너의 포켓몬을 섞은 야생 무리: mix:[{trainer,pick}], 순서대로 이어 붙여 앞에서 n 체(보스 방은 adjust.bossN 이 우선). bossAt 번째가 『와일드 보스』(×1.5), raid:X 면 「레이드 배틀 : X」 */
   if(!opt.wildFrom&&enc.mix.some(m=>!m.sp&&!m.db))throw new Error('스냅샷 야생을 쓸 수 없음 (wildFrom 없음)');const lvAdd=(+enc.lvAdd||0)+(+adj.wildLv||0)+(enc._extra?0:pend.foeLv)+(enc.boss?pend.bossLv+alBoss():0)+alLv();if(!enc._extra)pend.foeLv=0;let mons=[],tr=null;
   for(const src of enc.mix){if(src.db){/* 야생 DB (lib/wilddb.js v2) */const WB=require('./wilddb.js');const e=(WB._cache=WB._cache||WB.fullV2()).find(x=>x.id===src.db||x.name===src.db);if(!e)throw new Error('야생 DB 에 없음: '+src.db);const r=WB.buildEntry(W,e,{lvAdd});tr=tr||r.trainer;mons.push(r.mon);continue}if(src.sp){/* 도감 야생 (lib/dex.js) */const r=require('./dex.js').build(W,src.sp,{lvAdd});tr=tr||r.trainer;mons.push(r.mon);continue}const w=opt.wildFrom(src.trainer,{pick:src.pick,take:src.take,lvAdd});tr=tr||w.trainer;mons=mons.concat(w.mons)}
   const N=enc.boss&&+adj.bossN?+adj.bossN:(+enc.n||mons.length);while(mons.length<N)mons.push(clone(mons[mons.length%Math.max(1,enc.mix.length)]));mons=mons.slice(0,N);
   const seen={};mons.forEach((x,i)=>{seen[x.id]=(seen[x.id]||0)+1;if(seen[x.id]>1)x.id=x.id+'_d'+i});
   const bi=enc.boss?(+enc.bossAt||0):-1;const X=enc.boss?(adj.raidX!=null&&adj.raidX!==''?+adj.raidX:(+enc.raid||0)):0;
   mons.forEach((x,i)=>{require('./wild.js').tag(x,i===bi);x.hp.cur=x.hp.max;delete x.raid;if(i===bi&&X>0)x.raid={segments:X,broken:0,phase:1,mode:adj.raidMode==='cap'?'cap':'barrier'}});
   wild={trainer:tr,mons}}
  else if(enc.trainer){/* 제작기 스냅샷의 트레이너를 야생 무리로 (예: 무진 NPC/숲 속의 폐가) — opt.wildFrom 은 서버 · 명령줄이 넘긴다 */if(!opt.wildFrom)throw new Error('스냅샷 야생을 쓸 수 없음 (wildFrom 없음)');const fl=pend.foeLv+alLv()+(enc.boss?alBoss():0);pend.foeLv=0;wild=opt.wildFrom(enc.trainer,{pick:enc.pick,take:enc.take,boss:enc.boss,lvAdd:(+enc.lvAdd||0)+(+adj.wildLv||0)+fl,extra:(+enc.extra||0)+(+adj.wildExtra||0)})}
  else{const packs=WD.packs();const pk=packs[enc.pack];if(!pk)throw new Error('야생 무리 없음: '+enc.pack);const pk2=Object.assign({},pk,{lvAdd:(+pk.lvAdd||0)+(+adj.wildLv||0),mons:pk.mons.concat(Array.from({length:+adj.wildExtra||0},(_,i)=>pk.mons[i%pk.mons.length]))});wild=WD.build(W,pk2)}
  /* 10-29 빈사 트레이너는 그 장면(방)에 참가하지 못한다 — 같은 방 배틀에 그 트레이너 포켓몬도 안 나간다 (adj.dyingFight 1 이면 옛 방식) */
  /* 11-04 망령 「나」: 일행 몫은 남이 고른 종류도 빌려 쓴다 — 일행 누구든 고른(>0) 종류를 모두 쓸 수 있게(지시 체계가 달라도 · 각성체 대가 종류도 빌린다) */const OKS=new Set();if(adj.ordScope==='dungeon'&&adj.ordLend!==0&&adj.ordLend!=='0')for(const P of party){const t0=clone(P.trainer);require('./party.js').orders(W,t0,{mons:P.mons,autoPick:adj.autoPick!==0&&adj.autoPick!=='0'});for(const [k,v] of Object.entries(t0.orderCount||{}))if(v>0&&!k.includes('@'))OKS.add(k)}
  const parties=party.filter(P=>P.inj<3||+adj.dyingFight).map(P=>{const t=clone(P.trainer);require('./party.js').orders(W,t,{mons:P.mons,autoPick:adj.autoPick!==0&&adj.autoPick!=='0'});const oc=t.orderCount||{};if(adj.ordScope==='dungeon'){/* 10-28 망령: 4식 · 6령은 던전 단위 — 1인 4식 1 · 6령 2 를 셋이 합친 공용 풀(pool). 종류마다 칸은 넉넉히 두고 풀이 한도 */for(const k of Object.keys(oc))if(oc[k]>0)oc[k]=9;/* 11-04 망령 「시뮬레이터 개선해」: 지시 체계가 달라도 빌린다 — 이름은 웹툴 pName 이 빌려 준 사람 것으로 */for(const k of OKS)oc[k]=9}/* 체크 패널티의 4식 · 6령 차감 */let oo=P.debt.oo,oc2=P.debt.oc;for(const k of Object.keys(oc).sort()){if(k.startsWith('order_')&&oo>0&&oc[k]>0){oc[k]--;oo--}if(k.startsWith('command_')&&oc2>0&&oc[k]>0){oc[k]--;oc2--}}P.debt.oo=0;P.debt.oc=0;
   const mons=P.mons.filter(m=>m.hp.cur>0).map(m=>{const x=clone(m);x.rank=Object.assign({},P.debt.rk);return x});P.debt.rk={};return {trainer:t,mons}}).filter(p=>p.mons.length);
  if(!parties.length)return null;/* 11-04 망령 「던전 야생전은 보스방까지 늘 2:2」 — 웹툴 encounter 와 같게: 에리어 = min(2, 야생 수 · 우리 수), adj.fmt 로만 바꾼다 */const fmt=+adj.fmt||Math.max(1,Math.min(2,(wild.mons||[]).length||2,parties.reduce((a,p)=>a+p.mons.length,0)));
  let cards=null;if(CD){for(const P of party)if(P.inj<3)cFill(P);cards={list:party.flatMap(P=>(P.cd?P.cd.hand:[]).filter(k=>CARD[k].battle&&CARD[k].eff).map(k=>({tid:P.trainer.id,P,k,eff:CARD[k].eff,used:false,pay:()=>{const c=CARD[k].c||0;if(P.cd.cost<c){if(P.cd.madN>=MADCAP){cstat.noCost++;return false}const sh=c-P.cd.cost;cstat.costSpent+=P.cd.cost;P.cd.cost=0;cstat.overpay+=sh;cMill(P,sh)}else{P.cd.cost-=c;cstat.costSpent+=c}cstat.use[k]=(cstat.use[k]||0)+1;return true}}))),turn:{},own:SLOT}}
  const r=await BT.runBattle(W,{left:{parties},right:wild,rng,format:fmt,maxTurns:30,pool:adj.ordScope==='dungeon'?pool:null,poolBoss:!!enc.boss,poolInit:pool0,cards});
  if(cards)for(const c of cards.list)if(c.used)cUse(c.P,c.k,false);
  /* 결과를 시트로 */for(const P of party)for(const m of P.mons){const x=r.left.find(y=>y.id===m.id);if(x){m.hp.cur=x.hp;m.states={};for(const k of x.states)if(['Poison','Toxic','Burn','Paralysis','Freeze','Sleep'].includes(k))m.states[k]=1000;
   /* 10-28 03:50 망령: 소지품도 던전 단위 — 쓴 열매 · 띠는 다음 배틀에 없다. 포텐셜 횟수도 이어진다 */if(adj.ordScope==='dungeon'){if(m.item&&!x.item){const nm=m.item;if(W.OM_FX&&W.OM_FX.removeByName)W.OM_FX.removeByName(m,nm);m.item='';m.itemEff='';m.itemUsed=x.itemUsed||{name:nm};say({k:'itemGone',mon:m.name,item:nm})}if(x.potUses)m.potUses=JSON.parse(JSON.stringify(x.potUses))}}}
  const used={order:0,command:0};for(const t of Object.values(r.trainers.left)){used.order+=t.used.order;used.command+=t.used.command}
  /* 10-31 망령 「배틀 승/패에 따른 경계도를 던전 전투마다」: 방의 enc.alWin · enc.alLose 가 있으면 그 값, 없으면 규칙(이기면 alBattle — 보스방 0 · 지면 alLose). 웹툴 방의 aw · alo 와 같다 */
  {const win=r.winner==='left';const dA=win?(enc.alWin!=null&&enc.alWin!==''?+enc.alWin:(enc.boss?0:+adj.alBattle||0)):(enc.alLose!=null&&enc.alLose!==''?+enc.alLose:+adj.alLose||0);if(dA){const b0=pend.al;pend.al=Math.max(0,Math.min(100,pend.al+dA));say({k:'alert',from:b0,to:pend.al,why:win?'battleWin':'battleLose'})}}
  const rec={k:'battle',extra:!!enc._extra,alert:pend.al,room:room.id,pack:enc.pack||enc.trainer||'mix',boss:!!enc.boss,foes:wild.mons.length,raidX:(wild.mons.find(m=>m.raid)||{raid:{}}).raid.segments||0,phases:(r.raid||[]).length,bossHp:(()=>{const b=r.right.find(y=>wild.mons.find(m=>m.boss&&m.id===y.id));return b?+(b.hp/b.max).toFixed(2):null})(),win:r.winner==='left',turns:r.turns,kos:r.kos.filter(k=>k.side==='left').length,wildKos:r.kos.filter(k=>k.side==='right').length,used,hpAfter:party.map(P=>P.mons.map(m=>+(m.hp.cur/m.hp.max).toFixed(2)))};say(rec);return rec};
 const doRest=(room,kind)=>{if(GIM.length){const gx=gimRun('rest',room);if(gx.restDown){const OR=['none','breath','short','mid','long'];const k0=kind;kind=OR[Math.max(0,OR.indexOf(kind)-gx.restDown)];say({k:'restDown',room:room.id,from:k0,to:kind,why:'gim'});if(kind==='none')return}}/* 11-04 06:54 망령 「30 이하일 때 보너스는 배틀보다 회복 단계를 올려 주자」 (adj.alLowRest 1): 경계도 30 미만이면 휴식 한 단계 위(숨돌리기 → 짧은 → 중간) */if(+adj.alLowRest&&pend.al<30){const UP={breath:'short',short:'mid'};if(UP[kind]){say({k:'restUp',room:room.id,from:kind,to:UP[kind],why:'경계도 30 미만'});kind=UP[kind];cstat.lowRest=(cstat.lowRest||0)+1}}if(+adj.alRest&&(kind==='short'||kind==='mid')){const b0=pend.al;let dn=+adj.alRest;if(SLOT&&pend.al>=30){const c=cFind('alRest2');if(c){cUse(c.P,c.k);dn*=2}}pend.al=Math.max(0,pend.al-dn);say({k:'alert',from:b0,to:pend.al,why:'rest'})}const ORD=['none','breath','short','mid','long'];if(CD&&kind==='short'){const c=cFind('restUp');if(c){cUse(c.P,c.k);kind='mid'}}if(CD){if(kind==='long')party.forEach(cReset);else if(kind==='mid'||kind==='short')party.forEach(cFill)}if(SLOT&&(kind==='short'||kind==='mid'))for(const P of party){if(!P.cd||P.gone)continue;const have=new Set(P.cd.hand.map(kindOf));for(const w of ['b','c','d']){if(have.has(w)||!SRES[w].length)continue;P.cd.hand.push(SRES[w].shift());cstat.slotRefill=(cstat.slotRefill||0)+1;break}}if(kind==='long'||kind==='mid'||kind==='short')for(const P of party)P.coverUsed=0;   /* 커버 1회는 짧은 휴식 이상에서 다시 */if(pend.restDown){const k0=kind;kind=ORD[Math.max(0,ORD.indexOf(kind)-pend.restDown)];pend.restDown=0;say({k:'restDown',room:room.id,from:k0,to:kind});if(kind==='none')return}const TB=(+adj.restV===2||kind==='mid')?REST2:REST;const R=TB[kind]||TB.breath;
  /* 10-28 03:23~25 망령: 짧은 휴식 = 파티에서 4식 · 6령 1개씩 + 가장 다친 1체 HP 1/4 + 빈사는 HP 1 + 상태 회복 (restShort:'one'. 'add' 는 원래 짧은 휴식에 더하는 실험용) */
  const SN=kind==='short'&&adj.restShort?adj.restShort:'';
  /* 10-28 22시 망령: 짧은 휴식은 전원 HP 1/4 (restShort:'all'), 숨돌리기 = 가장 다친 1체 HP 1/4 + 6령 1 (restBreath:'one' · restBC) */
  const BN=kind==='breath'&&adj.restBreath==='one';
  if(kind==='mid'&&adj.ordScope==='dungeon'){pool.order=Math.min(pool0.order,pool.order+Math.ceil(pool0.order/2));pool.command=Math.min(pool0.command,pool.command+Math.ceil(pool0.command/2))}
  if(SN){const al=party.flatMap(P=>P.mons.filter(m=>m.hp.cur>0&&m.hp.cur<m.hp.max));al.sort((a,b)=>a.hp.cur/a.hp.max-b.hp.cur/b.hp.max);for(const m of SN==='all'?al:al.slice(0,1))m.hp.cur=Math.min(m.hp.max,m.hp.cur+frac(m.hp.max,adj.restOneHp||'1/4'));
   if(adj.ordScope==='dungeon'){pool.order=Math.min(pool0.order,pool.order+(+adj.restPO||0));pool.command=Math.min(pool0.command,pool.command+(+adj.restPC||0))}}
  if(BN){const al=party.flatMap(P=>P.mons.filter(m=>m.hp.cur>0&&m.hp.cur<m.hp.max));al.sort((a,b)=>a.hp.cur/a.hp.max-b.hp.cur/b.hp.max);if(al[0])al[0].hp.cur=Math.min(al[0].hp.max,al[0].hp.cur+frac(al[0].hp.max,'1/4'));
   if(adj.ordScope==='dungeon')pool.command=Math.min(pool0.command,pool.command+(adj.restBC==null?1:+adj.restBC||0));for(const P of party)if(R.tired)P.tired.clear();say({k:'rest',room:room.id,kind});return}
  for(const P of party){if(SN==='one'||SN==='all'){/* 03:25 망령: 빈사는 HP 1 로 · 상태 회복 */for(const m of P.mons){if(m.hp.cur<=0)m.hp.cur=1;m.states={}}if(R.tired)P.tired.clear();if(R.inou)P.inou=0;if(R.care)P.care=0;P.inj=P.gone?3:Math.max(0,P.inj-R.inj);continue}for(const m of P.mons){if(m.hp.cur<=0){if(typeof R.revive==='string'){m.hp.cur=frac(m.hp.max,R.revive);if(R.cure)m.states={};continue}if(R.revive){m.hp.cur=R.hp==='full'?m.hp.max:1}else continue}else m.hp.cur=R.hp==='full'?m.hp.max:Math.min(m.hp.max,m.hp.cur+frac(m.hp.max,R.hp));if(R.cure)m.states={}}
   if(R.tired)P.tired.clear();if(R.inou)P.inou=0;if(R.care)P.care=0;P.inj=P.gone?3:Math.max(0,P.inj-R.inj)}
  /* 10-28: 휴식이 던전 공용 4식 · 6령을 일부 돌려준다(adj.restO · restC = 1인당, 짧은 휴식 이상) — 웹툴 휴식 설정 「4식 6령 회복」 칸과 같은 뜻 */
  if(adj.ordScope==='dungeon'&&kind!=='breath'&&kind!=='none'){const o0=pool.order,c0=pool.command;pool.order=Math.min(pool0.order,pool.order+party.length*(+adj.restO||0));pool.command=Math.min(pool0.command,pool.command+party.length*(+adj.restC||0));if(pool.order>o0||pool.command>c0)say({k:'restOrd',room:room.id,order:pool.order-o0,command:pool.command-c0})}
  say({k:'rest',room:room.id,kind})};
 /* 돌봄(육성 B 이상, 휴식 사이 1회): 지친 포켓몬이 있고 쓸 수 있으면 체크 앞에서 */
 const care=()=>{};   /* 10-29 v4: 지침 · 돌봄 없음 */

/* 11-04 던전 기믹 (노트 27 · 망령 「던전 기믹도 로직화 시키고 시스템에 넣을 방법」): dg.gim (실험은 adj.gim) — {id,n,on:'room'|'rest'|'check'|'battle',every,where,to:'all'|'healthiest'|'lead'|'random',do:{step,al,hp,lose,foeLv,bossLv,rest},save:{stat,target},unless:{type,card,flag},cond:{fail}}.
    곁방 보상 room.reward = {flag} (실험은 adj.gimReward = {방 id: 표식}) — 방을 마치면 표식을 얻고, unless.flag 가 그 표식이면 기믹이 꺼진다 */
 /* 11-04 웹툴 편집 창(js/dg_gim.js) 꼴 — fx:[{k,v}] · on checkFail/checkOk/move/enter/win/lose/alert · to weakest · chance · once · alMin/alMax · ifFlag/noFlag — 를 이 엔진 꼴로 읽는다 (시뮬이 아는 것만) */
 const gimConv=g=>{if(!g||g.off)return null;const o=Object.assign({},g);if(Array.isArray(g.fx)){const d={};for(const f of g.fx){if(['step','al','foeLv','bossLv','rest'].includes(f.k))d[f.k]=(+d[f.k]||0)+(+f.v||0);else if(f.k==='restUp')d.rest=(+d.rest||0)-(+f.v||0);else if(f.k==='hp')d.hp=f.v}o.do=d}if(g.on==='checkFail'){o.on='check';o.cond={fail:1}}if(g.on==='checkOk'){o.on='check';o.cond={ok:1}}if(g.to==='weakest')o.to='weakest';return o};
 const GIM=(Array.isArray(adj.gim)?adj.gim:(dg.gim||[])).map(gimConv).filter(Boolean);const flags=new Set();const gimN={};const gstat={fired:0,saved:0,off:0,exempt:0,flags:[]};
 const gimRun=(on,room,ctx)=>{ctx=ctx||{};for(const g of GIM){if(g.on!==on)continue;const W=g.where||[];if(W.length&&!W.includes('*')&&!W.includes(room.t)&&!W.includes(room.id))continue;if(g.cond&&g.cond.fail&&!ctx.fail)continue;if(g.cond&&g.cond.ok&&ctx.fail)continue;if(on==='alert'){if(g.alMin==null||!(+ctx.from<+g.alMin&&+ctx.to>=+g.alMin))continue}else{if(g.alMin!=null&&pend.al<+g.alMin)continue;if(g.alMax!=null&&pend.al>+g.alMax)continue}if(g.ifFlag&&!flags.has(g.ifFlag))continue;if(g.noFlag&&flags.has(g.noFlag))continue;if(g.once&&gimN['_done_'+g.id])continue;gimN[g.id]=(gimN[g.id]||0)+1;if(+g.every>1&&gimN[g.id]%(+g.every)!==0)continue;if(+g.chance>0&&rng()*100>=+g.chance)continue;gimN['_done_'+g.id]=1;const un=g.unless||{};if(un.flag&&flags.has(un.flag)){gstat.off++;continue}
  let T=party.filter(P=>!P.gone&&P.inj<3);if(!T.length)continue;const to=g.to||'all';if(to==='healthiest')T=[T.slice().sort((a,b)=>a.inj-b.inj)[0]];else if(to==='weakest')T=[T.slice().sort((a,b)=>b.inj-a.inj)[0]];else if(to==='lead')T=[ctx.P&&T.includes(ctx.P)?ctx.P:T[0]];else if(to==='random')T=[T[Math.floor(rng()*T.length)]];
  if(un.type)T=T.filter(P=>{const ex=fieldMons(P).some(m=>[...(m.typesKo||[]),...(m.types||[])].includes(un.type));if(ex)gstat.exempt++;return !ex});
  if(un.card)T=T.filter(P=>{const k=P.cd&&P.cd.hand.find(x=>x===un.card||CARD[x].n===un.card);if(k){cUse(P,k,false);gstat.exempt++;return false}return true});
  const d=g.do||{};for(const P of T){if(g.save){const q=optFor(P,SK.up({label:g.n||g.id,stat:g.save.stat,target:+g.save.target}));q.target=+g.save.target;q.crit=4;const r=SK.roll(q,rng);if(r.ri>=3){gstat.saved++;continue}}
   gstat.fired++;const rec={pen:[]};for(let i=0;i<(+d.step||0);i++)injure(P,g.n||g.id,rec);if(d.hp)for(const m of aliveMons(P)){const loss=Math.max(1,frac(m.hp.max,d.hp));m.hp.cur=Math.max(0,m.hp.cur-loss);P.stats.penDmg+=loss}if(+d.lose&&P.cd)cMill(P,+d.lose);
   if(+d.al){const b0=pend.al;pend.al=Math.max(0,Math.min(100,pend.al+(+d.al)));say({k:'alert',from:b0,to:pend.al,why:'gim'})}if(+d.foeLv)pend.foeLv+=+d.foeLv;if(+d.bossLv)pend.bossLv+=+d.bossLv;if(+d.rest)ctx.restDown=(ctx.restDown||0)+(+d.rest);say({k:'gim',id:g.id,who:P.trainer.name});
   if(d.al||d.foeLv||d.bossLv||d.rest)break}}return ctx};
 /* 11-04: 경계도가 기준을 넘을 때(alert) — 방마다 · 체크 · 배틀 뒤에 지난 값과 견준다 */let alLast=pend.al;const alWatch=room=>{if(!GIM.length)return;if(pend.al>alLast)gimRun('alert',room,{from:alLast,to:pend.al});alLast=pend.al};
 let ci=0,wipe=false,boss=false,endRoom='',lockdown=false;
 /* 10-28 갈림길(dg.branches): 판마다 갈림길에서 반반으로 한쪽 길(본길 구간 / 다른 길)을 걷는다 — opt.route = 'main' | 'alt' 로 고정할 수 있다 */
 const route=pathOf(dg,()=>opt.route==='main'?1:opt.route==='alt'?0:rng());/* 11-04 곁방(side): adj.side 1 이면 그 「from」 방 다음에 들른다 (욕심 길) */if(+adj.side)for(const r of dg.rooms.filter(x=>x.side&&x.from)){const i=route.indexOf(r.from);if(i>=0&&!route.includes(r.id))route.splice(i+1,0,r.id)}if(dg.branches&&dg.branches.length)say({k:'route',path:route});
 if(GIM.length){const r0=dg.rooms.find(r=>r.id===route[0])||{};gimRun('enter',r0);alWatch(r0)}
 for(const rid of route){const room=dg.rooms.find(r=>r.id===rid);if(!room)continue;endRoom=rid;for(const P of party)if(P.inj===3&&!P.gone)P.inj=2;if(CD){for(const P of party)cClear(P);if(cstat.alQ){pend.al=Math.min(100,pend.al+cstat.alQ);cstat.alQ=0}}say({k:'room',room:rid,t:room.t,name:room.name});/* 11-04 06:33 망령 「경계도는 30~70 사이를 왔다갔다 해야 재밌다 · 방 이동할 때마다 좀 올라야」: adj.alRoom = 방에 들어설 때마다 + (입구 제외) · alTrack = 방마다 경계도 구간 */if(+adj.alRoom&&room.t!=='entry'){const b0=pend.al;pend.al=Math.min(100,pend.al+(+adj.alRoom));say({k:'alert',from:b0,to:pend.al,why:'room'})}alTrack.n++;if(pend.al<30)alTrack.lo++;else if(pend.al<70)alTrack.mid++;else alTrack.hi++;if(room.t==='boss')alTrack.boss=pend.al;alTrack.max=Math.max(alTrack.max,pend.al);if(GIM.length){gimRun('room',room);gimRun('move',room);alWatch(room)}
  if(CD){for(const P of party)if(P.inj===2){const c=cFind('heal_inj2',P)||cFind('heal_inj2');if(c){cUse(c.P,c.k);P.inj=1}}   /* 11-02 구급 상자: 중상 → 부상 */
   for(const P of party)if(P.inj===1){const c=cFind('heal_inj',P)||(P.inj===1&&cFind('heal_inj'));if(c){cUse(c.P,c.k);P.inj=0}}
   while(pend.al>=20){const c=cFind('al');if(!c)break;cUse(c.P,c.k);const b0=pend.al;pend.al=Math.max(0,pend.al-10);say({k:'alert',from:b0,to:pend.al,why:'card'})}
   if(room.enc&&room.enc.boss){const lo=party.flatMap(P=>aliveMons(P)).sort((a,b)=>a.hp.cur/a.hp.max-b.hp.cur/b.hp.max)[0];if(lo&&lo.hp.cur/lo.hp.max<0.5){const c=cFind('breath');if(c){cUse(c.P,c.k);doRest(room,'breath')}}
    for(let i=0;i<3;i++){const m=party.flatMap(P=>aliveMons(P)).sort((a,b)=>a.hp.cur/a.hp.max-b.hp.cur/b.hp.max)[0];if(!m||m.hp.cur/m.hp.max>=0.75)break;const c=cFind('heal');if(!c)break;cUse(c.P,c.k);m.hp.cur=Math.min(m.hp.max,m.hp.cur+frac(m.hp.max,'1/4'))}}}
  if(room.check){ci++;/* checkEvery 2 = 체크를 하나 걸러 하나만 (제시 횟수를 줄이는 실험) */if(adj.checkEvery<=1||ci%adj.checkEvery===1){care();doCheck(room,room.check);alWatch(room)}
   if(pend.al>=100){lockdown=true;wipe=true;break}
   while(pend.fights.length){const f=Object.assign({},pend.fights.shift(),{_extra:1});const r=await doBattle(room,f);if(!r||!r.win){wipe=true;break}}if(wipe)break}
  if(room.enc&&CD&&!room.enc.boss){const c=cFind('skip');if(c){cUse(c.P,c.k);cstat.skip++;say({k:'skip',room:rid});if(room.rest)doRest(room,room.rest);continue}}
  if(room.enc){if(GIM.length)gimRun('battle',room);const r=await doBattle(room,room.enc);if(GIM.length){gimRun(r&&r.win?'win':'lose',room);alWatch(room)}if(!r||!r.win){wipe=true;break}if(room.enc.boss)boss=true}
  if(pend.al>=100){lockdown=true;wipe=true;break}
  if(room.rest)doRest(room,room.rest);
  {const fl=(room.reward&&room.reward.flag)||((adj.gimReward||{})[rid]);if(fl&&!flags.has(fl)){flags.add(fl);gstat.flags.push(fl);say({k:'flag',room:rid,flag:fl})}}
  if(!anyAlive()){wipe=true;break}}
 const checks=ev.filter(e=>e.k==='check'),battles=ev.filter(e=>e.k==='battle');
 const endHp=party.map(P=>P.mons.reduce((a,m)=>a+m.hp.cur/m.hp.max,0)/P.mons.length);
 return {gim:GIM.length?Object.assign({},gstat):null,alTrack,cards:CD?Object.assign({},cstat,{hand:party.map(P=>P.cd.hand.slice())}):null,dungeon:dg.id,wipe,lockdown,alert:pend.al,boss,endRoom,rooms:ev.filter(e=>e.k==='room').length,
  checks:{n15:checks.filter(c=>c.target>=15).length,ok15:checks.filter(c=>c.target>=15&&c.ri>=3).length,n:checks.length,ok:checks.filter(c=>c.ri>=3).length,crit:checks.filter(c=>c.ri===4).length,cost:checks.filter(c=>c.ri===2).length,fail:checks.filter(c=>c.ri<=1).length,fumble:checks.filter(c=>c.ri===0).length,covers:checks.filter(c=>c.cover).length,inou:checks.filter(c=>c.mode==='inou').length,alone:checks.filter(c=>c.partner==='혼자').length},
  extraFights:battles.filter(b=>b.extra).length,restDowns:ev.filter(e=>e.k==='restDown').length,
  bossLvDebt:pend.bossLv,poolLeft:Object.assign({},pool),
  bossBattle:(()=>{const b=battles.find(x=>x.boss);return b?{win:b.win,turns:b.turns,kos:b.kos,foes:b.foes,raidX:b.raidX,phases:b.phases,bossHp:b.bossHp,hpAfter:b.hpAfter}:null})(),
  battles:{n:battles.length,won:battles.filter(b=>b.win).length,turns:battles.reduce((a,b)=>a+b.turns,0),kos:battles.reduce((a,b)=>a+b.kos,0),orders:battles.reduce((a,b)=>a+b.used.order,0),commands:battles.reduce((a,b)=>a+b.used.command,0)},
  injuries:party.map(P=>P.inj),injuryEvents:ev.filter(e=>e.k==='injury').length,tiredLeft:party.map(P=>P.tired.size),penDmg:party.reduce((a,P)=>a+P.stats.penDmg,0),
  endHp:endHp.map(x=>+x.toFixed(2)),endHpAvg:+(endHp.reduce((a,b)=>a+b,0)/endHp.length).toFixed(3),faintedEnd:party.reduce((a,P)=>a+P.mons.filter(m=>m.hp.cur<=0).length,0),monsTotal:party.reduce((a,P)=>a+P.mons.length,0),
  checkRows:checks.map(c=>({l:c.label,t:c.target,ri:c.ri,ri0:c.ri0,w:c.who,p:c.partner,m:c.mode,cv:c.cover?1:0})),
  party:party.map(P=>({name:P.trainer.name,ranks:P.trainer.ranks,stats:P.stats})),events:opt.events?ev:undefined}}
module.exports={pathOf,dungeons,run,makeParty,REST,REST2,DIR,CARD,CARD_DECKS};
