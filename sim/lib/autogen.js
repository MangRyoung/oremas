/* 던전 자동 생성 (2026-10-27 망령 「시뮬레이터에 던전 자동 생성 매커니즘을 만들어봐 · 문서로도」)
   gen.js 의 make()(실험용 손잡이)를 감싸서, 10-27 가이드라인을 기본값으로 한 「바로 쓰는」 던전을 만든다.
     generate({tier, seed, theme, knobs, wild, boss, name})  → 시뮬 던전 JSON (dungeon.run 으로 그대로 돌린다. dg.rules = 던전 규칙값)
     toWebtool(dg, names)                                    → 웹툴 던전 탭 꼴 {n,o,a,al,st,wn,r:{rid:{n,t,x,y,sk,rk,m}},l}
   가이드라인(records/feedback.md 「10-27 저녁 개정」, docs/던전_자동생성.md):
     공통  야생 · 보스 Lv +1(10-28 4식 · 6령 던전 단위 기준 · 그 전 +10 · 옛 −5) · 체크 3~5 (목표 7 · 9 섞기 — 빡센 길이면 9 · 11, 타입 조건 1개, 자질 넷 고루) · 보스 앞 짧은 휴식 하나(휴식 2안)
           경계도: 대가 +15 · 실패 +30 · 일반 조우 +10 · 30 → 야생 Lv +5 · 70 → +10 · 100 → 자동 실패
     쉬움  보스방 4체 · 레이드 2 · 사전 배틀 1   (승률 약 8할 — v3 검증 78%)
     보통  보스방 4체 · 레이드 3 · 사전 배틀 1~2 (약 6할)
     어려움 보스방 6체 · 레이드 3 · 사전 배틀 0~1 (약 3할 — v3 31%) */
"use strict";
const fs=require('fs');
const G=require('./gen.js'),BT=require('./battle.js');
const COMMON={lv:5,bossLv:5,   /* 10-28 03:50 망령 「+1 은 웃기다 · +5/+10 기준으로 다른 걸 조정」 → 공통 Lv +5 (배틀마다 채우던 때 +10, 약식 엔진 −5) — docs/던전_자동생성.md */
 checks:[3,4,5],   /* 10-28 01:48 망령: 체크 수 3~5 무작위(전 난이도) */
 tgt:'mix',pen:'alert',alCost:10,alFail:20,   /* 10-28 03:23 망령: 경계도 완화(옛 15 · 30) */
 rest:'short',hintTyped:1,foes:2};
/* 「빡센 길」(10-28 01:48 망령 「수가 줄면 조금 더 어렵게나 빡세게」) — 03시 2단계로:
   사전 배틀이 그 난이도 최대보다 적으면 = 빡센 길: 체크 목표 9 · 11(어렵게) + 경계도 실패 +45 · 대가 +20(빡세게). 보통 사전 배틀 1 에서 67 → 61% (2 일 때 58%)
   체크만 3개면 = 어려운 길: 목표 9 · 11 만 (체크 수 3 · 4 · 5 는 승률 59 · 58 · 58% 로 거의 같다) */
const TOUGH={tgt:'high',alFail:45,alCost:20};
const DEX_BST={wild:[400,520],boss:[520,600]};   /* 도감 야생 종족치 범위 — 보스는 600족까지(전설 · 환상 680 이상은 안 나옴) */
const RULES={restV:2,alBattle:5,al30:5,al70:10,   /* 10-28 03:23 망령: 조우 경계도 +10 → +5, 경계도 단계의 레벨 상승(+5 · +10)은 그대로 */
 restShort:'all',restPO:1,restPC:1,restBreath:'one',restBC:1};   /* 10-28 22시 망령: 짧은 휴식 전원 HP 1/4 · 숨돌리기 = 1체 HP 1/4 + 6령 1 */   /* 10-28 03:25 망령: 짧은 휴식 = 파티 4식 · 6령 1개씩 + 가장 다친 1체 HP 1/4 + 빈사 HP 1 + 상태 회복 (lib/dungeon.js doRest) */
const PRESET={easy:{battles:[0,1]},   /* 10-28 03:50 Lv +5 · 던전 단위 자원에서: 0 → 92% · 1 → 69% · 0~1 → 82% */
 normal:{battles:[1]},   /* 10-28 01:38 망령: 2 → 1~2. 03:50 Lv +5 · 던전 단위 자원에서 1~2 → 51% · 1 → 58% 라 1 로 (망령 확인 대기) */
 hard:{battles:[0,1]}};   /* 03:50: 일반 야생을 C 로만 — C·B 면 21% */
const TIER_KO={easy:'쉬움',normal:'보통',hard:'어려움'};
/* 테마: 방 이름 · 체크 문구 · 단서 · 보스 방 이름. 문구만 바뀌고 숫자는 같다 */
const THEMES={
 폐가:{types:['고스트','악','독','에스퍼','노말'],a:'안개 · 폐가',name:['비 새는 고아원','불 꺼진 여관','숲 속의 폐가','버려진 별장','흐느끼는 저택'],entry:['녹슨 철문','무너진 현관','잡초 덮인 정원'],battle:['현관 홀','삐걱이는 계단','곰팡이 핀 식당','지하 창고'],check:['2층 서재','흐느끼는 복도','잠긴 아이 방','거울의 방'],safe:['다락 아래 골방','오래된 부엌'],boss:['다락','지하 예배실'],treasure:['먼지 쌓인 금고'],
  side:['먼지 쌓인 창고', '깨진 온실', '하인 방', '막힌 굴뚝'],
  chk:{지시:['흩어진 일기장의 순서를 맞춘다','거울 장치의 각도를 맞춘다'],육성:['겁먹은 야생 포켓몬을 달랜다','곰팡이 독을 가려낸다'],통솔:['무너지는 계단을 함께 건넌다','어둠 속에서 대열을 지킨다'],능력:['흐느끼는 소리의 정체를 쫓는다','봉인된 문을 연다']}},
 동굴:{types:['바위','땅','강철','고스트','격투'],a:'어둠 · 동굴',name:['메아리 굴','수정 갱도','검은모래 동굴','울림 동굴','이끼 낀 갱도'],entry:['갱도 입구','바위틈'],battle:['박쥐 굴','지하 호수','갈림길 광장','수정 회랑'],check:['좁은 틈','낙석 구간','지하 물길','메아리 방'],safe:['마른 동굴','버려진 광부 쉼터'],boss:['가장 깊은 굴','수정 왕좌'],treasure:['광석 더미'],
  side:['박쥐 틈', '물방울 방', '광부 창고', '좁은 굴'],
  chk:{지시:['메아리로 길을 찾는다','무너질 바위를 읽는다'],육성:['야생의 발자국을 쫓는다','다친 포켓몬을 응급 처치한다'],통솔:['물길을 함께 건넌다','겁먹은 포켓몬을 진정시킨다'],능력:['낙석을 막아 선다','어둠 속 기척을 읽는다']}},
 숲:{types:['풀','벌레','독','비행','노말','페어리'],a:'안개 · 숲',name:['속삭이는 숲','버섯 골짜기','안개 숲','뒤엉킨 덩굴숲','고목의 숲'],entry:['숲 어귀','이정표 앞'],battle:['덤불 사이','쓰러진 고목','버섯 군락','개울가'],check:['길 잃은 오솔길','덩굴 장벽','독 늪','갈림길'],safe:['나무꾼 오두막','맑은 샘'],boss:['고목의 심장','안개 호수'],treasure:['새 둥지'],
  side:['덤불 속 공터', '버려진 덫', '고사목 굴', '이끼 바위'],
  chk:{지시:['안개 속 표식을 따라간다','덩굴의 매듭을 푼다'],육성:['독초와 약초를 가려낸다','야생의 흔적을 쫓는다'],통솔:['늪을 함께 건넌다','안개 속에서 대열을 지킨다'],능력:['쓰러진 나무를 치운다','숲의 속삭임을 듣는다']}},
 연구소:{types:['전기','강철','독','에스퍼','노말'],a:'폐허 · 연구소',name:['폐쇄된 사육 센터','무인 발전소','버려진 연구소','봉쇄된 실험동','지하 관측소'],entry:['정문 게이트','화물 승강기'],battle:['조립 라인','사육실','통제실 앞 복도','배양조 홀'],check:['보안 문','감전 복도','배전반','기록 보관실'],safe:['휴게실','비상 대피소'],boss:['실험 심부','중앙 제어실'],treasure:['잠긴 사물함'],
  side:['비품실', '고장 난 엘리베이터', '샘플 냉동고', '환기 덕트'],
  chk:{지시:['보안 장치를 해제한다','배전반 회로를 맞춘다'],육성:['폭주한 실험체를 진정시킨다','오염된 사료를 가려낸다'],통솔:['정전 속에서 대열을 지킨다','무너지는 통로를 함께 지난다'],능력:['감전 복도를 돌파한다','기록의 암호를 읽는다']}},
 유적:{types:['바위','고스트','에스퍼','땅','드래곤'],a:'고대 · 유적',name:['잊힌 성채','가라앉은 신전','잠든 유적','모래에 묻힌 신전','고문서 번역소'],entry:['무너진 아치','모래 계단'],battle:['석상 회랑','기둥의 방','무너진 서고','제단 앞'],check:['문자 석판','움직이는 바닥','봉인의 문','별자리 천장'],safe:['순례자의 방','샘이 솟는 뜰'],boss:['왕의 묘실','금서고'],treasure:['봉헌함'],
  side:['무너진 회랑', '작은 사당', '벽화의 방', '모래 구덩이'],
  chk:{지시:['옛 문자를 해독한다','바닥 장치의 순서를 읽는다'],육성:['석상에 깃든 포켓몬을 달랜다','유물의 진위를 가린다'],통솔:['움직이는 바닥을 함께 건넌다','어둠 속 대열을 지킨다'],능력:['봉인을 푼다','유물의 기억을 읽는다']}},
 /* 10-27 밤: 야생 DB 서식지 8곳에 맞춰 바다 · 화산 · 설원 추가 (전에는 이 셋에만 사는 야생이 던전에 안 나왔다) */
 바다:{types:['물','얼음','비행','전기'],a:'파도 · 바다',name:['안개 낀 만','폐선 묘지','난파선 해안','썰물 동굴','등대 섬'],entry:['부서진 선착장','모래톱'],battle:['갯바위','난파선 갑판','해초 숲','조수 웅덩이'],check:['밀물 통로','끊어진 다리','소용돌이 물길','녹슨 선실'],safe:['등대 아래 창고','마른 동굴'],boss:['난파선 선창','바다 동굴 끝'],treasure:['떠밀려 온 상자'],
  side:['조개 무덤', '부서진 보트', '갈매기 둥지', '해식 동굴'],
  chk:{지시:['물때를 읽어 길을 고른다','표류물의 흐름을 읽는다'],육성:['그물에 걸린 포켓몬을 풀어 준다','상한 해산물을 가려낸다'],통솔:['밀물 전에 함께 건넌다','풍랑 속에서 대열을 지킨다'],능력:['소용돌이를 거슬러 헤엄친다','녹슨 문을 비튼다']}},
 화산:{types:['불꽃','바위','땅','드래곤','격투'],a:'열기 · 화산',name:['재의 고원','끓는 호수','잿빛 화산','용암 동굴','유황 협곡'],entry:['재 덮인 등산로','갈라진 땅'],battle:['용암 강가','검은 바위 지대','유황 웅덩이','열기 굴'],check:['무너지는 비탈','용암 징검다리','유독 가스 지대','갈라진 동굴'],safe:['식은 용암 굴','온천 바위틈'],boss:['분화구','용암 호수'],treasure:['굳은 화석층'],
  side:['식은 용암관', '유황 틈', '화석 벽', '검은 모래톱'],
  chk:{지시:['가스가 덜한 길을 고른다','용암 흐름을 읽는다'],육성:['화상 입은 포켓몬을 돌본다','먹을 수 있는 열매를 가려낸다'],통솔:['열기 속에서 대열을 지킨다','징검다리를 함께 건넌다'],능력:['떨어지는 바위를 막는다','달아오른 바위를 밀어낸다']}},
 설원:{types:['얼음','강철','페어리','물'],a:'눈보라 · 설원',name:['얼음 동굴','백야의 협곡','눈보라 고원','얼어붙은 호수','빙하 틈'],entry:['눈 덮인 산길','얼음 계곡 입구'],battle:['얼음 들판','눈 무덤','서리 숲','빙벽 아래'],check:['얇은 얼음판','눈사태 비탈','빙하 틈새','화이트아웃'],safe:['산장','바람 막힌 바위굴'],boss:['빙하 심부','얼음 신전'],treasure:['얼음 속 유물'],
  side:['눈 굴', '얼음 동굴', '버려진 썰매', '서리 덮인 오두막'],
  chk:{지시:['눈보라 속 표식을 찾는다','얼음판의 두께를 읽는다'],육성:['얼어 가는 포켓몬을 데운다','눈 아래 먹이를 찾는다'],통솔:['눈사태 비탈을 함께 지난다','화이트아웃 속 대열을 지킨다'],능력:['빙벽을 오른다','얼어붙은 문을 깬다']}}};
/* 곁방 내용 (10-28 03시) — 시뮬은 곁방을 걷지 않는다(dg.path 밖) → 난이도 맞춤은 그대로. 웹툴에서 GM 이 고르게 하는 선택지 */
const SIDE_KIND=[{k:'item',t:'room',n:'숨은 물건',memo:'살피면 소지품 · 열매 하나(GM 이 정한다). 찾는 데 체크는 없다'},
 {k:'breath',t:'room',n:'숨 고르기',memo:'한 번만 「숨돌리기」(가장 다친 1체 HP 1/4 · 6령 1). 경계도 30 이상이면 쉴 수 없다'},
 {k:'check',t:'puzzle',n:'선택 체크',memo:'해도 되고 안 해도 되는 체크 — 성공하면 경계도 −10 또는 단서, 실패하면 경계도가 오른다'},
 {k:'ambush',t:'battle',n:'기습',memo:'들어오면 야생 1~2체가 덮친다(웹툴 「기습」 — 플레이어에게 안 보임). 이기면 숨은 물건 하나'},
 {k:'clue',t:'room',n:'흔적',memo:'보스나 다음 방에 대한 단서 하나(GM 이 채운다)'}];
/* 체크의 「이 타입 동료」 조건 — 그 장소에서 도움이 될 만한 타입 (10-28) */
const HINT_T={폐가:['고스트','악','에스퍼','페어리'],동굴:['땅','바위','격투','강철'],숲:['풀','벌레','비행','불꽃'],연구소:['전기','강철','에스퍼','독'],유적:['에스퍼','고스트','바위','드래곤'],바다:['물','비행','전기','얼음'],화산:['물','땅','바위','불꽃'],설원:['불꽃','얼음','강철','격투']};
const RAIDN={2:'레이드 배틀 : 2',3:'레이드 배틀 : 3'};
/* 보물 방 단서 (10-28): 보스의 타입 · 약점 · 쓰는 기술 하나를 「흔적」으로. GM 이 고쳐 쓸 수 있는 초안 */
const TC={노말:{바위:.5,고스트:0,강철:.5},불꽃:{불꽃:.5,물:.5,풀:2,얼음:2,벌레:2,바위:.5,드래곤:.5,강철:2},물:{불꽃:2,물:.5,풀:.5,땅:2,바위:2,드래곤:.5},전기:{물:2,전기:.5,풀:.5,땅:0,비행:2,드래곤:.5},풀:{불꽃:.5,물:2,풀:.5,독:.5,땅:2,비행:.5,벌레:.5,바위:2,드래곤:.5,강철:.5},얼음:{불꽃:.5,물:.5,풀:2,얼음:.5,땅:2,비행:2,드래곤:2,강철:.5},격투:{노말:2,얼음:2,독:.5,비행:.5,에스퍼:.5,벌레:.5,바위:2,고스트:0,악:2,강철:2,페어리:.5},독:{풀:2,독:.5,땅:.5,바위:.5,고스트:.5,강철:0,페어리:2},땅:{불꽃:2,전기:2,풀:.5,독:2,비행:0,벌레:.5,바위:2,강철:2},비행:{전기:.5,풀:2,격투:2,벌레:2,바위:.5,강철:.5},에스퍼:{격투:2,독:2,에스퍼:.5,악:0,강철:.5},벌레:{불꽃:.5,풀:2,격투:.5,독:.5,비행:.5,에스퍼:2,고스트:.5,악:2,강철:.5,페어리:.5},바위:{불꽃:2,얼음:2,격투:.5,땅:.5,비행:2,벌레:2,강철:.5},고스트:{노말:0,에스퍼:2,고스트:2,악:.5},드래곤:{드래곤:2,강철:.5,페어리:0},악:{격투:.5,에스퍼:2,고스트:2,악:.5,페어리:.5},강철:{불꽃:.5,물:.5,전기:.5,얼음:2,바위:2,강철:.5,페어리:2},페어리:{불꽃:.5,격투:2,독:.5,드래곤:2,악:2,강철:.5}};
const mulOf=(a,types)=>types.reduce((m,t)=>m*(TC[a][t]==null?1:TC[a][t]),1);const weakOf=types=>Object.keys(TC).filter(a=>mulOf(a,types)>=2).sort((a,b)=>mulOf(b,types)-mulOf(a,types));
function bossClue(dg,rng){try{const b=dg.rooms.find(r=>r.t==='boss');const src=b&&b.enc&&b.enc.mix[0];if(!src||!src.db)return null;const WB=require('./wilddb.js');const e=(WB._cache=WB._cache||WB.fullV2()).find(x=>x.id===src.db);if(!e)return null;
 const types=e.types||[];const weak=weakOf(types);const mv=(e.moves||[]).map(m=>typeof m==='string'?m:m.n||m.name).filter(Boolean);const m1=mv.length?mv[Math.floor(rng()*mv.length)]:'';
 const d=[`깊은 곳의 주인 — 「${types.join(' · ')}」 기운이 서려 있다.`,weak.length?`${weak.slice(0,3).map(t=>'「'+t+'」').join(' · ')} 쪽을 꺼리는 흔적이 남아 있다.`:'',m1?`「${m1}」의 자국이 벽에 새겨져 있다.`:''].filter(Boolean).join('\n');
 return {t:'주인의 흔적',d,auto:1}}catch(err){return null}}
/* ---------- 지도 모양 (10-28 02:20 망령 「모양은 웹툴 지도 기능과 호환 · 그 기준으로 다양한 모양」) ----------
   웹툴 던전 탭(js/dungeon_ui.js): 방 = r:{id:{n,t,x,y,…}}, 통로 = l:{'a~b':1} (아무 방끼리나 이을 수 있음), 편집기 판 1000×640 · 방 좌표 x 30~970 · y 30~600, 방 종류 8(entry · room · battle · trap · puzzle · treasure · safe · boss).
   여기서는 그 판에 6×4 격자(칸 162×170)를 깔고:
     본길 = 시뮬이 걷는 순서(dg.path) — 격자 위 자기 회피 산책. 꺾임 정도(turn)에 따라 곧은길 · 꺾인길 · 구불길.
     곁방 = 본길 옆 빈칸에 붙는 막다른 방(보물 1 + 곁방 0~2). 승률에 닿는 내용은 넣지 않는다(단서 · GM 메모 자리) → 난이도 맞춤은 그대로.
   통로는 위아래 · 좌우 이웃 칸끼리만 잇는다 → 웹툴 등각 지도에서 통로끼리 겹치거나 방을 가로지르지 않는다. */
const GRID={cols:6,rows:4,x0:95,dx:162,y0:85,dy:170};
const SHAPES={곧은길:0.15,꺾인길:0.45,구불길:0.8};
const DIRS=[[1,0],[0,1],[-1,0],[0,-1]];
function walkGrid(rng,n,turn){const C=GRID.cols,Rw=GRID.rows,key=(c,r)=>c+','+r,inb=(c,r)=>c>=0&&r>=0&&c<C&&r<Rw;
 for(let t=0;t<300;t++){const st=[Math.floor(rng()*C),Math.floor(rng()*Rw)],used=new Set([key(...st)]),path=[st];let steps=0;
  const go=dir=>{if(path.length===n)return true;if(++steps>4000)return false;const [c,r]=path[path.length-1];
   const ord=[0,1,2,3].filter(i=>dir<0||i!==(dir+2)%4).map(i=>({i,w:(dir<0||i===dir?1-turn:turn/2)*(0.5+rng())})).sort((a,b)=>b.w-a.w);
   for(const {i} of ord){const nc=c+DIRS[i][0],nr=r+DIRS[i][1];if(!inb(nc,nr)||used.has(key(nc,nr)))continue;used.add(key(nc,nr));path.push([nc,nr]);if(go(i))return true;path.pop();used.delete(key(nc,nr))}return false};
  if(go(-1))return {path,used}}
 return null}
const isChk=r=>r&&['puzzle','trap','room'].includes(r.t)&&r.check;
function addBranches(rng,dg,donor,n){const pick=a=>a[Math.floor(rng()*a.length)];const main=dg.rooms.filter(r=>!r.side&&!r.alt);dg.branches=[];if(!(n>0))return;
 const spare={battle:donor.rooms.filter(r=>r.t==='battle'),check:donor.rooms.filter(isChk)};const taken=new Set();
 for(let g=1;g<=n;g++){const C=[];for(let i=0;i<main.length;i++)for(const L of [1,2]){const j=i+L+1;if(j>=main.length)continue;const seg=main.slice(i+1,j);if(seg.some(r=>taken.has(r.id)||!(r.t==='battle'||isChk(r))))continue;if(taken.has(main[i].id)&&taken.has(main[j].id))continue;C.push([i,j,seg])}
  if(!C.length)break;const [i,j,seg]=pick(C);const alt=[];
  for(const r of seg){const want=r.t==='battle'?'check':'battle';const src=spare[want].shift();if(!src)break;const x=JSON.parse(JSON.stringify(src));x.id='g'+g+'a'+(alt.length+1);x.alt='g'+g;alt.push(x)}
  if(alt.length!==seg.length)break;seg.forEach(r=>taken.add(r.id));dg.rooms.push(...alt);dg.branches.push({id:'g'+g,from:main[i].id,to:main[j].id,main:seg.map(r=>r.id),alt:alt.map(r=>r.id)})}}
/* 격자에서 a → b 를 정확히 k 걸음으로 잇는 빈칸 길 (끝점 빼고 used 를 피한다) */
function gridPath(rng,a,b,k,used){const key=(c,r)=>c+','+r;const P=[a];const seen=new Set([key(...a)]);
 const go=()=>{const [c,r]=P[P.length-1];const left=k-(P.length-1);const d=Math.abs(c-b[0])+Math.abs(r-b[1]);if(d>left||(left-d)%2)return false;if(left===0)return c===b[0]&&r===b[1];
  for(const i of [0,1,2,3].sort(()=>rng()-0.5)){const nc=c+DIRS[i][0],nr=r+DIRS[i][1];if(nc<0||nr<0||nc>=GRID.cols||nr>=GRID.rows)continue;const kk=key(nc,nr);const end=nc===b[0]&&nr===b[1];if(end?left!==1:(used.has(kk)||seen.has(kk)))continue;seen.add(kk);P.push([nc,nr]);if(go())return true;P.pop();seen.delete(kk)}return false};
 return go()?P:null}
function layout(rng,dg,o,nm,th){o=o||{};const pick=a=>a[Math.floor(rng()*a.length)];const main=dg.rooms.filter(r=>!r.side&&!r.alt);const sides=dg.rooms.filter(r=>r.side);const key=(c,r)=>c+','+r;
 const shapeName=o.shape&&SHAPES[o.shape]!=null?o.shape:pick(Object.keys(SHAPES));
 for(let t=0;t<50;t++){const w=walkGrid(rng,main.length,SHAPES[shapeName]);if(!w)continue;const cells={},links={};main.forEach((r,i)=>{cells[r.id]=w.path[i];if(i)links[[main[i-1].id,r.id].sort().join('~')]=1});
  let ok=true;const used=new Set(w.used);
  for(const g of dg.branches||[]){const p=gridPath(rng,cells[g.from],cells[g.to],g.alt.length+1,used);if(!p){ok=false;break}let prev=g.from;g.alt.forEach((id,k)=>{cells[id]=p[k+1];used.add(p[k+1].join(','));links[[prev,id].sort().join('~')]=1;prev=id});links[[prev,g.to].sort().join('~')]=1}
  if(!ok)continue;
  for(const s of sides){/* 붙일 본길 방: 입구 · 보스 빼고, 빈 이웃 칸이 있는 곳 */const cand=[];main.forEach((r,i)=>{if(r.t==='boss'||(r.t==='entry'&&main.length>3))return;const [c,rr]=cells[r.id];for(const [dx,dy] of DIRS){const nc=c+dx,nr=rr+dy;if(nc>=0&&nr>=0&&nc<GRID.cols&&nr<GRID.rows&&!used.has(key(nc,nr)))cand.push([r.id,[nc,nr]])}});
   if(!cand.length){ok=false;break}const [at,cell]=pick(cand);used.add(key(...cell));cells[s.id]=cell;s.from=at;links[[at,s.id].sort().join('~')]=1}
  if(!ok)continue;
  let turns=0;for(let i=2;i<main.length;i++){const a=w.path[i-2],b=w.path[i-1],c=w.path[i];if((b[0]-a[0])!==(c[0]-b[0])||(b[1]-a[1])!==(c[1]-b[1]))turns++}
  dg.map={grid:GRID,shape:shapeName,turns,cells,links};dg.path=main.map(r=>r.id);return dg.map}
 dg.path=main.map(r=>r.id);return null}
function generate(o){o=o||{};const tier=o.tier||'normal';if(!PRESET[tier])throw new Error('난이도: easy | normal | hard');const seed=+o.seed||Math.floor(Math.random()*1e6);
 const rng=BT.mkRng(seed*7+3);const ri=n=>Math.floor(rng()*n);const pick=a=>a[ri(a.length)];
 const thName=o.theme&&THEMES[o.theme]?o.theme:Object.keys(THEMES)[ri(Object.keys(THEMES).length)];const th=THEMES[thName];
 const pre=PRESET[tier];const knobs=Object.assign({},COMMON,{battles:pick(pre.battles)},o.knobs||{});if(Array.isArray(knobs.checks))knobs.checks=pick(knobs.checks);
 const fewB=knobs.battles<Math.max(...pre.battles),fewC=knobs.checks<4;const tough=o.tough!=null?(o.tough?'full':''):fewB?'full':fewC?'hard':'';   /* 10-28 03시: 2단계 — 사전 배틀이 모자라면 어렵게 + 빡세게, 체크만 3개면 어렵게만(체크 수는 승률을 거의 안 움직임) */
 if(tough){for(const [k,v] of Object.entries(tough==='full'?TOUGH:{tgt:TOUGH.tgt}))if(!(o.knobs&&k in o.knobs))knobs[k]=v}
 /* 야생 풀을 바꿀 수 있다: o.wild = [[트레이너 id, 순번, 이름]…] · o.boss = 같은 꼴 */
 /* 야생 출처: 'dex'(기본, 제작기 도감 실제 포켓몬 — 테마 타입 · 종족치 범위) | 'npc'(무진 NPC 풀, 10-27 맞추기에 쓴 것) */
 /* 'db'(야생 DB 가 있으면 기본): 테마 = 서식지. 일반 야생 = C 묶음(일반), 보스 = B · A 묶음. o.grades = {wild:['C'], boss:['B','A']} 로 바꿀 수 있다(등급 구성 실험용) */
 const GT={easy:{wild:['C'],boss:['B','A']},normal:{wild:['C'],boss:['A']},hard:{wild:['C'],boss:['A']}};/* 10-27 20:30 야생 DB 300체 기준 맞춤(gradecal_db300): 쉬움 88 · 보통 63 · 어려움 37% */const gr=Object.assign({},GT[tier]||GT.normal,o.grades||{});
 const WB=require('./wilddb.js');const hasDb=fs.existsSync(WB.FILE)&&(WB.read().v||1)>=2;const source=o.source||(hasDb?'db':'dex');let wild=o.wild,bossP=o.boss;
 if(source==='db'&&!wild){const all=WB.fullV2();const gr=Object.assign({},GT[tier]||GT.normal,o.grades||{});const inHab=e=>(e.hab||[]).includes(thName);
  const W0=all.filter(e=>inHab(e)&&gr.wild.includes(e.grade)),B0=all.filter(e=>inHab(e)&&gr.boss.includes(e.grade));
  wild=(W0.length>=8?W0:all.filter(e=>gr.wild.includes(e.grade))).map(e=>['db',e.id,e.name]);bossP=(B0.length>=3?B0:all.filter(e=>gr.boss.includes(e.grade))).map(e=>['db',e.id,e.name])}
 if(source==='dex'&&!wild){const DX=require('./dex.js');const wb=o.wildBst||DEX_BST.wild,bb=o.bossBst||DEX_BST.boss;
  const W0=DX.pick({types:th.types,bst:wb}),B0=DX.pick({types:th.types,bst:bb});wild=(W0.length>=8?W0:DX.pick({bst:wb})).map(d=>['dex',d.name,d.name]);bossP=(B0.length>=3?B0:DX.pick({bst:bb})).map(d=>['dex',d.name,d.name])}
 const keep={POOL:G.POOL.slice(),BOSS:G.BOSS.slice()};if(Array.isArray(wild)&&wild.length){G.POOL.length=0;G.POOL.push(...wild)}if(Array.isArray(bossP)&&bossP.length){G.BOSS.length=0;G.BOSS.push(...bossP)}
 let dg,donor;try{dg=G.make(tier,knobs,seed);donor=G.make(tier,Object.assign({},knobs,{battles:4,checks:5}),seed+977)}finally{G.POOL.length=0;G.POOL.push(...keep.POOL);G.BOSS.length=0;G.BOSS.push(...keep.BOSS)}
 /* 갈림길 (10-28 망령 「1갈래 길 밖에 안 나오는데?」) — 본길 한 구간(방 1~2개) 옆에 나란한 다른 길을 내고 끝에서 다시 만난다.
    다른 길은 본길 구간의 방을 뒤집어 채운다: 배틀 ↔ 체크 (싸우며 뚫는 길 / 머리 쓰는 길). 방 수가 같아 길이도 같다.
    시뮬은 판마다 반반으로 한쪽을 걷는다(dungeon.pathOf) → 승률은 두 길의 평균. o.branches = 갈림길 수(기본 1, 0 이면 예전처럼 한 줄) */
 addBranches(rng,dg,donor,o.branches!=null?+o.branches:1);
 /* 테마 문구 입히기 */
 const used=new Set(),usedLab=new Set();const nm=list=>{const L=list.filter(x=>!used.has(x));const v=L.length?pick(L):pick(list)+' '+(used.size+1);used.add(v);return v};
 for(const r of dg.rooms){if(r.t==='entry')r.name=nm(th.entry);else if(r.t==='battle')r.name=nm(th.battle);else if(r.t==='safe')r.name=nm(th.safe);else if(r.t==='boss')r.name=nm(th.boss);else r.name=nm(th.check);
  if(r.check){const L=th.chk[r.check.stat];if(L){const F=L.filter(x=>!usedLab.has(x));r.check.label=pick(F.length?F:L);usedLab.add(r.check.label)}   /* 10-28: 체크 5개면 같은 문구가 두 번 나오던 것 막음 */
   if(String(r.check.hint||'').startsWith('type:')&&HINT_T[thName])r.check.hint='type:'+pick(HINT_T[thName])}}   /* 10-28: 「이 타입 동료」를 테마에 맞는 타입에서 (전엔 고정 10타입 무작위 — 화산에 풀 같은 줄) */
 /* 보물 방 하나(체크 · 조우 없음) — 지도 꾸밈 · 웹툴에서 단서 자리 */
 if(o.treasure!==false)dg.rooms.push({id:'tr',t:'treasure',side:1,name:nm(th.treasure),clue:bossClue(dg,rng)||{t:'단서',d:'(GM 이 채운다 — 보스의 약점 · 다음 장면의 실마리 등)'}});
 /* 곁방 0~2 — 막다른 통로(웹툴 「통로」). 시뮬은 안 걷는다(dg.path 밖). GM 이 숨은 것 · 단서 · 기습을 채울 자리 */
 const nSide=o.sideRooms!=null?+o.sideRooms:ri(3);const SK=['지시','육성','통솔','능력'];
 for(let i=0;i<nSide;i++){const kind=pick(SIDE_KIND);const r={id:'s'+(i+1),t:kind.t,side:1,name:nm(th.side||th.check),memo:'곁방 · '+kind.n+' — '+kind.memo};
  if(kind.k==='check'){const st=pick(SK);const L=(th.chk[st]||[]).filter(x=>!usedLab.has(x));r.check={label:L.length?pick(L):kind.n,stat:st,target:9,hint:'any',optional:1,pen:{fail:{al:knobs.alCost||15,memo:'헛걸음 — 기척을 남겼다'},cost:{dmg:'1/8',memo:'무리했다'}},reward:'성공하면 경계도 −10 또는 단서 하나'}}
  if(kind.k==='ambush'){r.ambush=1}
  dg.rooms.push(r)}
 layout(rng,dg,o,nm,th);
 if(!dg.map&&dg.branches&&dg.branches.length){/* 격자에 갈림길이 안 들어가면 갈림길 없이 */const A=new Set(dg.branches.flatMap(g=>g.alt));dg.rooms=dg.rooms.filter(r=>!A.has(r.id));dg.branches=[];layout(rng,dg,o,nm,th)}
 const bossName=dg.gen.boss;
 dg.id=o.id||`auto_${tier}_${seed}`;dg.name=o.name||`${pick(th.name)} (${TIER_KO[tier]})`;dg.theme=thName;dg.owner=bossName;
 dg.rules=Object.assign({},RULES,o.rules||{});dg.private=true;
 dg.note=`자동 생성 · ${TIER_KO[tier]} · 씨앗 ${seed} · 테마 ${thName}. 사전 배틀 ${knobs.battles} · 체크 ${knobs.checks} · 보스방 ${G.TIER[tier].bossN}체 · ${RAIDN[G.TIER[tier].raid]} · 지도 ${dg.branches&&dg.branches.length?'갈림길 '+dg.branches.length+' · ':''}${dg.map?dg.map.shape+(dg.rooms.some(r=>r.side)?' + 곁방 '+dg.rooms.filter(r=>r.side).length:''):'일자'} · 야생 Lv ${knobs.lv>=0?'+':''}${knobs.lv}${tough==='full'?' · 빡센 길(체크 목표 9 · 11, 경계도 실패 +45 · 대가 +20)':tough==='hard'?' · 어려운 길(체크 목표 9 · 11)':''}.`;
 dg.gen=Object.assign({},dg.gen,{v:1,auto:true,tough,shape:dg.map&&dg.map.shape,theme:thName,rules:dg.rules,source,grades:source==='db'?gr:undefined});
 return dg}
/* 웹툴 던전 탭 꼴로 — 지도 좌표(dg.map 격자, 없으면 옛 지그재그) · 통로 · 방마다 sk(스킬 체크) · rk(휴식 단계) · m(GM 메모: 조우 구성 · 경계도 패널티 · 단서) */
const PEN_KO=p=>{if(!p)return '';const L=[];if(p.al)L.push('경계도 +'+p.al);if(p.dmg)L.push('HP −'+p.dmg);if(p.st)L.push('상태 '+({Paralysis:'마비',Poison:'독',Confusion:'혼란',Burn:'화상',Sleep:'잠듦'}[p.st]||p.st));if(p.oo)L.push('다음 배틀 4식 −'+p.oo);if(p.oc)L.push('다음 배틀 6령 −'+p.oc);if(p.rk)L.push('랭크 '+Object.entries(p.rk).map(([k,v])=>k+(v>0?'+':'')+v).join(' '));if(p.memo)L.push(p.memo);return L.join(' · ')};
function toWebtool(dg,names){names=names||{};for(const [t,i,n] of G.POOL.concat(G.BOSS)){names[t]=names[t]||{};if(names[t][i]==null)names[t][i]=n}let DBN=null;const dbName=i=>{if(!DBN){try{const WB=require('./wilddb.js');DBN=Object.fromEntries((WB._cache=WB._cache||WB.fullV2()).map(e=>[e.id,e.name]))}catch(e){DBN={}}}return DBN[i]||i};const nameOf=(t,i)=>t==='dex'?i:t==='db'?((names.db||{})[i]||dbName(i)):(names[t]&&names[t][i])||`${t} #${i}`;const rs=dg.rooms;const COLS=4,cw=200,rh=180;
 const r={},l={};const rid=x=>x.id.replace(/[^\w]/g,'').slice(0,8)||('r'+Math.random().toString(36).slice(2,6));
 const M=dg.map;rs.forEach((x,i)=>{const row=Math.floor(i/COLS),col=i%COLS,c=row%2?COLS-1-col:col;const id=rid(x);const cell=M&&M.cells[x.id];const o={n:x.name,t:x.t,x:cell?M.grid.x0+cell[0]*M.grid.dx:110+c*cw,y:cell?M.grid.y0+cell[1]*M.grid.dy:140+row*rh};const memo=[];if(x.memo)memo.push(x.memo);
  if(x.check){const c0=x.check;o.sk={label:c0.label,stat:c0.stat,mode:c0.mode==='inou'?'inou':'skill',target:+c0.target,name:c0.label,auto:dg.gen&&dg.gen.tier};if(c0.step)o.sk.step=c0.step;if(c0.twice)o.sk.twice=c0.twice;
   const pf=Object.assign({},c0.pen&&c0.pen.fail),pc=Object.assign({},c0.pen&&c0.pen.cost);for(const q of [pf,pc]){const a=q.al?`경계도 +${q.al}`:'';delete q.al;if(a)q.memo=[q.memo,a].filter(Boolean).join(' · ')}   /* 웹툴 패널티 칸에 경계도가 없어서 메모로 */o.sk.pen={fail:pf,cost:pc};
   memo.push(`🎲 ${c0.stat} ${c0.target}${c0.mode==='inou'?' (능력 A↑ 이능)':''} · 동료 ${c0.hint==='any'||!c0.hint?'아무 포켓몬':String(c0.hint).replace('type:','타입 ')}`);memo.push(`  실패: ${PEN_KO(c0.pen&&c0.pen.fail)}`);memo.push(`  대가: ${PEN_KO(c0.pen&&c0.pen.cost)}`);if(c0.reward)memo.push(`  보상: ${c0.reward}`)}
  if(x.enc&&x.enc.mix){const mons=x.enc.mix.flatMap(m=>m.sp?[m.sp]:m.db?[nameOf('db',m.db)]:(m.pick||[]).map(i=>nameOf(m.trainer,i)));   /* 10-28: 야생 DB(m.db) 이름이 빠져 「야생 0체」로 나가던 것 고침 */const lv=+x.enc.lvAdd||0;
   memo.push(`${x.enc.boss?'♛ 보스방':'⚔ 야생'} ${mons.length}체 · Lv ${lv>=0?'+':''}${lv} (경계도 30↑ +${dg.rules&&dg.rules.al30||5} · 70↑ +${dg.rules&&dg.rules.al70||10})`);
   memo.push('  '+mons.map((n,j)=>x.enc.boss&&j===(+x.enc.bossAt||0)?`★${n}『와일드 보스』${x.enc.raid?' 「레이드 배틀 : '+x.enc.raid+'」':''}`:`${n}『와일드』`).join(' · '));if(!x.enc.boss&&dg.rules&&dg.rules.alBattle)memo.push(`  배틀이 끝나면 경계도 +${dg.rules.alBattle}`)}
  if(x.rest)o.rk=x.rest;   /* 10-28 웹툴에 중간 휴식(mid)이 생김 */
  if(x.clue)o.cl={t:x.clue.t,d:x.clue.d};
  if(memo.length)o.m=memo.join('\n').slice(0,400);r[id]=o;if(!M&&i)l[[rid(rs[i-1]),id].sort().join('~')]=1});
 if(M)for(const k of Object.keys(M.links)){const [a,b]=k.split('~').map(z=>rid(rs.find(x=>x.id===z)));l[[a,b].sort().join('~')]=1}
 return {n:dg.name,o:dg.owner?`(자동 생성) ${dg.owner}`:'',a:THEMES[dg.theme]?THEMES[dg.theme].a:(dg.theme||''),al:0,st:rid(rs[0]),wn:dg.wn||2,r,l,gen:{tier:dg.gen.tier,seed:dg.gen.seed,theme:dg.theme,rules:dg.rules}}}
module.exports={DEX_BST,generate,toWebtool,THEMES,PRESET,COMMON,RULES,TIER_KO,HINT_T};
