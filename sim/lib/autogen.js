/* 던전 자동 생성 (2026-10-27 망령 「시뮬레이터에 던전 자동 생성 매커니즘을 만들어봐 · 문서로도」)
   gen.js 의 make()(실험용 손잡이)를 감싸서, 10-27 가이드라인을 기본값으로 한 「바로 쓰는」 던전을 만든다.
     generate({tier, seed, theme, knobs, wild, boss, name})  → 시뮬 던전 JSON (dungeon.run 으로 그대로 돌린다. dg.rules = 던전 규칙값)
     toWebtool(dg, names)                                    → 웹툴 던전 탭 꼴 {n,o,a,al,st,wn,r:{rid:{n,t,x,y,sk,rk,m}},l}
   가이드라인(records/feedback.md 「10-27 저녁 개정」, docs/던전_자동생성.md):
     공통  야생 · 보스 Lv +5 (10-28 03:50) · 체크 3~5 (10-29 v4: 목표 = 난이도 쉬움 8 · 보통 10 · 어려움 12, 빡센 길 · 어려운 길이면 한 칸 위 10 · 12 · 15 · 타입 조건 1개, 자질 넷 고루, 대가 없음)
           · 보스 앞 짧은 휴식 하나(RULES: 전원 HP 1/4 · 빈사 HP 1 · 상태 회복 · 파티 4식 1 · 6령 1)
           경계도: 체크 실패 +20(빡센 길 +45) · 대성공 −10 · 일반 배틀 이기면 +5 · 지면 +10(10-31, 방마다 enc.alWin · alLose) · 30 → 야생 Lv +5 · 70 → +10 · 100 → 자동 실패
     쉬움  보스방 4체 · 레이드 2 · 사전 배틀 0~1 (목표 8할)
     보통  보스방 4체 · 레이드 3 · 사전 배틀 1   (6할)
     어려움 보스방 6체 · 레이드 3 · 사전 배틀 0~1 (3할) — 숫자는 docs/던전_자동생성.md 맨 위 절 */
"use strict";
const fs=require('fs');
const G=require('./gen.js'),BT=require('./battle.js');
const COMMON={lv:5,bossLv:5,   /* 10-28 03:50 망령 「+1 은 웃기다 · +5/+10 기준으로 다른 걸 조정」 → 공통 Lv +5 (배틀마다 채우던 때 +10, 약식 엔진 −5) — docs/던전_자동생성.md */
 checks:[3,4,5],   /* 10-28 01:48 망령: 체크 수 3~5 무작위(전 난이도). 11-02 망령 「방 갯수는 조금씩 더 늘려도」 → 4~6. 11-02 14시 망령 「방이 또 너무 많다 · 8~12개」 → 다시 3~5 (방 수는 generate 가 ROOMS 로 맞춘다) */
 tgt:'v4mix',   /* 11-02 망령: 체크 목표를 보통 · 어려움 · 매우 어려움 섞기(gen.js MIX — 쉬움 던전 6:3:1 · 보통 4:4:2 · 어려움 2:5:3), 쉬움(8) 체크 없음 */pen:'alert',alCost:10,alFail:10,   /* 11-02 망령: 체크 실패 경계도 +20 → +10 (객원 2체 × 3명으로 재 보니 경계도 30↑ 이 88~98% 판 · 퇴출 22~45%) */   /* 10-29 v4: 체크 목표 = 난이도(쉬움 8 · 보통 10 · 어려움 12, gen.js V4) — 전엔 7 · 9 섞기(실행 때 10 · 12) */   /* 10-28 03:23 망령: 경계도 완화(옛 15 · 30) */
 rest:'short',hintTyped:1,foes:2};
/* 「빡센 길」(10-28 01:48 망령 「수가 줄면 조금 더 어렵게나 빡세게」) — 03시 2단계로:
   사전 배틀이 그 난이도 최대보다 적으면 = 빡센 길: 체크 목표 한 칸 위(어렵게 — 10-29 v4: 쉬움 10 · 보통 12 · 어려움 15, 전엔 9 · 11) + 경계도 실패 +45 · 대가 +20(빡세게). 보통 사전 배틀 1 에서 67 → 61% (2 일 때 58%, v3 값)
   체크만 3개면 = 어려운 길: 목표 한 칸 위만 (체크 수 3 · 4 · 5 는 승률 59 · 58 · 58% 로 거의 같다) */
const TOUGH={mixUp:1,alFail:20,alCost:20};   /* 11-02: 빡센 길 실패 +45 → +20 (보통 실패 +10 의 두 배 — 전엔 +20 의 2배 남짓) */   /* 11-02: 「한 칸 위」 = 체크 비율 한 칸 위(gen.js MIXUP — 어려움 빡센 길 1:5:4). 목표 15 는 매우 어려움 체크로만 */
const DEX_BST={wild:[400,520],boss:[520,600]};   /* 도감 야생 종족치 범위 — 보스는 600족까지(전설 · 환상 680 이상은 안 나옴) */
const RULES={restV:2,alBattle:5,alLose:10,   /* 10-31 망령: 배틀에 지면(웹툴에서 물러나면) 경계도 +10 — 방마다 enc.alLose 로 바꾼다 */al30:5,al70:10,   /* 10-28 03:23 망령: 조우 경계도 +10 → +5, 경계도 단계의 레벨 상승(+5 · +10)은 그대로 */
 restShort:'all',restPO:1,restPC:1,restBreath:'one',restBC:1};   /* 10-28 22시 망령: 짧은 휴식 전원 HP 1/4 · 숨돌리기 = 1체 HP 1/4 + 6령 1 */   /* 10-28 03:25 망령: 짧은 휴식 = 파티 4식 · 6령 1개씩 + 가장 다친 1체 HP 1/4 + 빈사 HP 1 + 상태 회복 (lib/dungeon.js doRest) */
const PRESET={easy:{battles:[0,1]},   /* 10-28 03:50 Lv +5 · 던전 단위 자원에서: 0 → 92% · 1 → 69% · 0~1 → 82% */
 normal:{battles:[1]},   /* 10-28 01:38 망령: 2 → 1~2. 03:50 Lv +5 · 던전 단위 자원에서 1~2 → 51% · 1 → 58% 라 1 로 (망령 확인 대기) */
 hard:{battles:[0,1],rest2:7}};   /* 11-02 망령 「어려움이 방이 많으면 회복 방 2개」: 본길(보스 포함) 7방 이상이면 가운데 쉼터 하나 더 (gen.js knobs.rest2) */   /* 03:50: 일반 야생을 C 로만 — C·B 면 21% */
const TIER_KO={easy:'쉬움',normal:'보통',hard:'어려움'};
/* 테마: 방 이름 · 체크 문구 · 단서 · 보스 방 이름. 문구만 바뀌고 숫자는 같다 */
const THEMES={
 폐가:{types:['고스트','악','독','에스퍼','노말'],a:'안개 · 폐가',name:['비 새는 고아원','불 꺼진 여관','숲 속의 폐가','버려진 별장','흐느끼는 저택'],entry:['녹슨 철문','무너진 현관','잡초 덮인 정원'],battle:['현관 홀','삐걱이는 계단','곰팡이 핀 식당','지하 창고','무너진 응접실','벽지 벗겨진 복도','쥐가 드나드는 부엌'],check:['2층 서재','흐느끼는 복도','잠긴 아이 방','거울의 방','뒤틀린 계단참','잠긴 서랍장','삐걱이는 다락문','먼지 낀 피아노방'],safe:['다락 아래 골방','오래된 부엌'],boss:['다락','지하 예배실'],treasure:['먼지 쌓인 금고'],
  side:['먼지 쌓인 창고', '깨진 온실', '하인 방', '막힌 굴뚝','부서진 옷장','비 새는 욕실','하녀 계단'],
  chk:{지시:['흩어진 일기장의 순서를 맞춘다','거울 장치의 각도를 맞춘다'],육성:['겁먹은 야생 포켓몬을 달랜다','곰팡이 독을 가려낸다'],통솔:['무너지는 계단을 함께 건넌다','어둠 속에서 대열을 지킨다'],능력:['흐느끼는 소리의 정체를 쫓는다','봉인된 문을 연다']}},
 동굴:{types:['바위','땅','강철','고스트','격투'],a:'어둠 · 동굴',name:['메아리 굴','수정 갱도','검은모래 동굴','울림 동굴','이끼 낀 갱도'],entry:['갱도 입구','바위틈'],battle:['박쥐 굴','지하 호수','갈림길 광장','수정 회랑','종유석 숲','물웅덩이 굴','뼈 무더기'],check:['좁은 틈','낙석 구간','지하 물길','메아리 방','갈라진 바닥','기울어진 통로','버려진 수레길','종유석 틈'],safe:['마른 동굴','버려진 광부 쉼터'],boss:['가장 깊은 굴','수정 왕좌'],treasure:['광석 더미'],
  side:['박쥐 틈', '물방울 방', '광부 창고', '좁은 굴','곰팡이 굴','작은 물웅덩이','무너진 갱목'],
  chk:{지시:['메아리로 길을 찾는다','무너질 바위를 읽는다'],육성:['야생의 발자국을 쫓는다','다친 포켓몬을 응급 처치한다'],통솔:['물길을 함께 건넌다','겁먹은 포켓몬을 진정시킨다'],능력:['낙석을 막아 선다','어둠 속 기척을 읽는다']}},
 숲:{types:['풀','벌레','독','비행','노말','페어리'],a:'안개 · 숲',name:['속삭이는 숲','버섯 골짜기','안개 숲','뒤엉킨 덩굴숲','고목의 숲'],entry:['숲 어귀','이정표 앞'],battle:['덤불 사이','쓰러진 고목','버섯 군락','개울가','가시덤불 길','늪가 둔덕','부러진 다리 밑'],check:['길 잃은 오솔길','덩굴 장벽','독 늪','갈림길','안개 낀 오솔길','쓰러진 다리','엉킨 뿌리 비탈','반딧불 습지'],safe:['나무꾼 오두막','맑은 샘'],boss:['고목의 심장','안개 호수'],treasure:['새 둥지'],
  side:['덤불 속 공터', '버려진 덫', '고사목 굴', '이끼 바위','버섯 둥지','다람쥐 굴','버려진 사냥 막'],
  chk:{지시:['안개 속 표식을 따라간다','덩굴의 매듭을 푼다'],육성:['독초와 약초를 가려낸다','야생의 흔적을 쫓는다'],통솔:['늪을 함께 건넌다','안개 속에서 대열을 지킨다'],능력:['쓰러진 나무를 치운다','숲의 속삭임을 듣는다']}},
 연구소:{types:['전기','강철','독','에스퍼','노말'],a:'폐허 · 연구소',name:['폐쇄된 사육 센터','무인 발전소','버려진 연구소','봉쇄된 실험동','지하 관측소'],entry:['정문 게이트','화물 승강기'],battle:['조립 라인','사육실','통제실 앞 복도','배양조 홀','격리 복도','폐기물 처리실','부서진 검사실'],check:['보안 문','감전 복도','배전반','기록 보관실','비상 계단','멈춘 컨베이어','소독 구역','잠긴 연구실'],safe:['휴게실','비상 대피소'],boss:['실험 심부','중앙 제어실'],treasure:['잠긴 사물함'],
  side:['비품실', '고장 난 엘리베이터', '샘플 냉동고', '환기 덕트','청소 도구함','샤워실','서버실'],
  chk:{지시:['보안 장치를 해제한다','배전반 회로를 맞춘다'],육성:['폭주한 실험체를 진정시킨다','오염된 사료를 가려낸다'],통솔:['정전 속에서 대열을 지킨다','무너지는 통로를 함께 지난다'],능력:['감전 복도를 돌파한다','기록의 암호를 읽는다']}},
 유적:{types:['바위','고스트','에스퍼','땅','드래곤'],a:'고대 · 유적',name:['잊힌 성채','가라앉은 신전','잠든 유적','모래에 묻힌 신전','고문서 번역소'],entry:['무너진 아치','모래 계단'],battle:['석상 회랑','기둥의 방','무너진 서고','제단 앞','부서진 신상 앞','계단식 광장','지하 납골당'],check:['문자 석판','움직이는 바닥','봉인의 문','별자리 천장','거울 회랑','물이 찬 통로','무너진 다리','바람 구멍'],safe:['순례자의 방','샘이 솟는 뜰'],boss:['왕의 묘실','금서고'],treasure:['봉헌함'],
  side:['무너진 회랑', '작은 사당', '벽화의 방', '모래 구덩이','봉헌물 방','석관 방','갈라진 벽틈'],
  chk:{지시:['옛 문자를 해독한다','바닥 장치의 순서를 읽는다'],육성:['석상에 깃든 포켓몬을 달랜다','유물의 진위를 가린다'],통솔:['움직이는 바닥을 함께 건넌다','어둠 속 대열을 지킨다'],능력:['봉인을 푼다','유물의 기억을 읽는다']}},
 /* 10-27 밤: 야생 DB 서식지 8곳에 맞춰 바다 · 화산 · 설원 추가 (전에는 이 셋에만 사는 야생이 던전에 안 나왔다) */
 바다:{types:['물','얼음','비행','전기'],a:'파도 · 바다',name:['안개 낀 만','폐선 묘지','난파선 해안','썰물 동굴','등대 섬'],entry:['부서진 선착장','모래톱'],battle:['갯바위','난파선 갑판','해초 숲','조수 웅덩이','산호 둔덕','부서진 부두','폐선 화물칸'],check:['밀물 통로','끊어진 다리','소용돌이 물길','녹슨 선실','미끄러운 바위길','잠긴 선장실','썰물 모래톱','파도 치는 절벽'],safe:['등대 아래 창고','마른 동굴'],boss:['난파선 선창','바다 동굴 끝'],treasure:['떠밀려 온 상자'],
  side:['조개 무덤', '부서진 보트', '갈매기 둥지', '해식 동굴','게 구멍','물 고인 선실','표류물 더미'],
  chk:{지시:['물때를 읽어 길을 고른다','표류물의 흐름을 읽는다'],육성:['그물에 걸린 포켓몬을 풀어 준다','상한 해산물을 가려낸다'],통솔:['밀물 전에 함께 건넌다','풍랑 속에서 대열을 지킨다'],능력:['소용돌이를 거슬러 헤엄친다','녹슨 문을 비튼다']}},
 화산:{types:['불꽃','바위','땅','드래곤','격투'],a:'열기 · 화산',name:['재의 고원','끓는 호수','잿빛 화산','용암 동굴','유황 협곡'],entry:['재 덮인 등산로','갈라진 땅'],battle:['용암 강가','검은 바위 지대','유황 웅덩이','열기 굴','재 덮인 평원','뜨거운 샘가','부서진 분석구'],check:['무너지는 비탈','용암 징검다리','유독 가스 지대','갈라진 동굴','열풍 통로','굳은 용암 다리','증기 틈','흔들리는 화구벽'],safe:['식은 용암 굴','온천 바위틈'],boss:['분화구','용암 호수'],treasure:['굳은 화석층'],
  side:['식은 용암관', '유황 틈', '화석 벽', '검은 모래톱','유황 결정 굴','재 구덩이','식은 분기공'],
  chk:{지시:['가스가 덜한 길을 고른다','용암 흐름을 읽는다'],육성:['화상 입은 포켓몬을 돌본다','먹을 수 있는 열매를 가려낸다'],통솔:['열기 속에서 대열을 지킨다','징검다리를 함께 건넌다'],능력:['떨어지는 바위를 막는다','달아오른 바위를 밀어낸다']}},
 설원:{types:['얼음','강철','페어리','물'],a:'눈보라 · 설원',name:['얼음 동굴','백야의 협곡','눈보라 고원','얼어붙은 호수','빙하 틈'],entry:['눈 덮인 산길','얼음 계곡 입구'],battle:['얼음 들판','눈 무덤','서리 숲','빙벽 아래','얼음 기둥 숲','서리 언덕','언 강가'],check:['얇은 얼음판','눈사태 비탈','빙하 틈새','화이트아웃','고드름 동굴','미끄러운 빙판길','눈 덮인 크레바스','얼음 다리'],safe:['산장','바람 막힌 바위굴'],boss:['빙하 심부','얼음 신전'],treasure:['얼음 속 유물'],
  side:['눈 굴', '얼음 동굴', '버려진 썰매', '서리 덮인 오두막','눈 덮인 텐트','얼음 틈','버려진 썰매견 집'],
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
const GRID={cols:7,rows:5,x0:80,dx:140,y0:65,dy:130};   /* 11-02 망령 「갈림길이 거의 없는 1자형만」 → 6×4 에서 7×5 로 (웹툴 편집 판 1000×640 안: x 80~920 · y 65~585) */
const SHAPES={곧은길:0.15,꺾인길:0.45,구불길:0.8};let LAYOUT_TRIES=+process.env.LT||300;
const DIRS=[[1,0],[0,1],[-1,0],[0,-1]];
function walkGrid(rng,n,turn){const C=GRID.cols,Rw=GRID.rows,key=(c,r)=>c+','+r,inb=(c,r)=>c>=0&&r>=0&&c<C&&r<Rw;
 for(let t=0;t<300;t++){const st=[Math.floor(rng()*C),Math.floor(rng()*Rw)],used=new Set([key(...st)]),path=[st];let steps=0;
  const go=dir=>{if(path.length===n)return true;if(++steps>4000)return false;const [c,r]=path[path.length-1];
   const ord=[0,1,2,3].filter(i=>dir<0||i!==(dir+2)%4).map(i=>({i,w:(dir<0||i===dir?1-turn:turn/2)*(0.5+rng())})).sort((a,b)=>b.w-a.w);
   for(const {i} of ord){const nc=c+DIRS[i][0],nr=r+DIRS[i][1];if(!inb(nc,nr)||used.has(key(nc,nr)))continue;used.add(key(nc,nr));path.push([nc,nr]);if(go(i))return true;path.pop();used.delete(key(nc,nr))}return false};
  if(go(-1))return {path,used}}
 return null}
const isChk=r=>r&&['puzzle','trap','room'].includes(r.t)&&r.check;
function addBranches(rng,dg,donor,n,th){const pick=a=>a[Math.floor(rng()*a.length)];const main=dg.rooms.filter(r=>!r.side&&!r.alt);dg.branches=[];if(!(n>0))return;
 const spare={battle:donor.rooms.filter(r=>r.t==='battle'),check:donor.rooms.filter(isChk)};const taken=new Set();
 for(let g=1;g<=n;g++){const C=[];for(let i=0;i<main.length;i++)for(const L of [1,2,3]){const j=i+L+1;if(j>=main.length)continue;const seg=main.slice(i+1,j);if(seg.some(r=>taken.has(r.id)||!(r.t==='battle'||isChk(r))))continue;if(taken.has(main[i].id)&&taken.has(main[j].id))continue;C.push([i,j,seg])}   /* 11-02: 구간 1~2 → 1~3방 */
  if(!C.length)break;/* 11-02: 짧은 구간을 더 자주(1방 3 : 2방 2 : 3방 1) — 긴 구간 하나가 본길을 다 차지해 갈림길이 하나로 끝나던 것 */const Wt=C.map(c=>({c,w:[0,3,2,1][c[2].length]*rng()}));const [i,j,seg]=Wt.sort((a,b)=>b.w-a.w)[0].c;const alt=[];
  /* 10-28 테스트: 2방 구간을 통째로 뒤집으면 다른 길 배틀이 2개 늘어(#8 씨앗 908: 본길 1 · 다른 길 3) 난이도 표가 깨진다 → 두 길의 배틀 수 차이는 1까지. 넘으면 마지막 방은 본길과 같은 종류 */
  const wants=seg.map(r=>r.t==='battle'?'check':'battle');const nb=a=>a.filter(x=>x==='battle').length;
  for(let q=wants.length-1;q>=0&&Math.abs(nb(wants)-seg.filter(r=>r.t==='battle').length)>1;q--)wants[q]=seg[q].t==='battle'?'battle':'check';
  /* 11-02 돌아가는 길: 다른 길이 2방 더 길 수 있다(격자에서는 길이 차가 짝수여야 이어진다) — 체크 1 + 빈 방 1(숨은 물건 자리). 길고 체크가 하나 더 있지만 물건이 있는 길 */
  const detour=rng()<0.4;if(detour){wants.splice(Math.floor(rng()*(wants.length+1)),0,'check');wants.splice(Math.floor(rng()*(wants.length+1)),0,'filler')}
  /* 11-01: 다른 길 방을 아무거나(첫째) 집지 않고 — 체크는 앞뒤 방과 다른 자질(같은 자질 연달아 X, 전엔 25% 던전에서 다른 길에 연달아 나옴), 배틀은 본길에 이미 나온 야생이 없는 것을 먼저 */
  const encKey=m=>m.db||m.sp||(m.trainer+':'+(m.pick||[]).join(','));const seenW=new Set(dg.rooms.filter(x=>x.enc).flatMap(x=>x.enc.mix.map(encKey)));
  let bad=false;for(const [wi,want] of wants.entries()){if(want==='filler'){alt.push({id:'g'+g+'a'+(alt.length+1),t:'room',alt:'g'+g,filler:1,memo:'돌아가는 길 · 숨은 물건 — 살피면 소지품 · 열매 하나(GM 이 정한다). 체크 없음'});continue}let k=0;
   if(want==='check'){/* 배틀을 사이에 둬도 바로 앞 · 뒤 체크와 다른 자질 */const before=main.slice(0,i+1).concat(alt).filter(x=>x.check),after=wants.slice(wi+1).includes('check')?[]:main.slice(j).filter(x=>x.check);const badS=new Set([before.length&&before[before.length-1].check.stat,after.length&&after[0].check.stat].filter(Boolean));const f=spare.check.findIndex(c=>!badS.has(c.check.stat));if(f>=0)k=f}
   else{const f=spare.battle.findIndex(b=>!b.enc.mix.some(m=>seenW.has(encKey(m))));if(f>=0)k=f}
   const src=spare[want].splice(k,1)[0];if(!src){bad=true;break}const x=JSON.parse(JSON.stringify(src));x.id='g'+g+'a'+(alt.length+1);x.alt='g'+g;if(x.enc)x.enc.mix.forEach(m=>seenW.add(encKey(m)));alt.push(x)}
  if(bad)break;seg.forEach(r=>taken.add(r.id));dg.rooms.push(...alt);dg.branches.push({id:'g'+g,from:main[i].id,to:main[j].id,main:seg.map(r=>r.id),alt:alt.map(r=>r.id),detour:detour?1:undefined})}}
/* 격자에서 a → b 를 정확히 k 걸음으로 잇는 빈칸 길 (끝점 빼고 used 를 피한다) */
function gridPath(rng,a,b,k,used){const key=(c,r)=>c+','+r;const P=[a];const seen=new Set([key(...a)]);
 const go=()=>{const [c,r]=P[P.length-1];const left=k-(P.length-1);const d=Math.abs(c-b[0])+Math.abs(r-b[1]);if(d>left||(left-d)%2)return false;if(left===0)return c===b[0]&&r===b[1];
  for(const i of [0,1,2,3].sort(()=>rng()-0.5)){const nc=c+DIRS[i][0],nr=r+DIRS[i][1];if(nc<0||nr<0||nc>=GRID.cols||nr>=GRID.rows)continue;const kk=key(nc,nr);const end=nc===b[0]&&nr===b[1];if(end?left!==1:(used.has(kk)||seen.has(kk)))continue;seen.add(kk);P.push([nc,nr]);if(go())return true;P.pop();seen.delete(kk)}return false};
 return go()?P:null}
/* 11-02 배치: 시도마다 갈림길을 넣을 수 있는 만큼 넣고(못 넣는 갈림길은 그 시도에서만 뺌), 곁방도 자리 있는 만큼 — 가장 많이 들어간 시도를 고른다.
   전엔 갈림길 하나라도 안 들어가면 그 시도를 버렸고, 끝까지 안 되면 갈림길을 통째로 뺐다(그래서 거의 1자형). 곁방은 다른 길 방 옆에도 붙는다 */
function layout(rng,dg,o,nm,th){o=o||{};const pick=a=>a[Math.floor(rng()*a.length)];const main=dg.rooms.filter(r=>!r.side&&!r.alt);const sides=dg.rooms.filter(r=>r.side);const key=(c,r)=>c+','+r;
 const shapeName=o.shape&&SHAPES[o.shape]!=null?o.shape:pick(Object.keys(SHAPES));const BR=dg.branches||[];let best=null;
 for(let t=0;t<LAYOUT_TRIES;t++){const w=walkGrid(rng,main.length,SHAPES[shapeName]);if(!w)continue;const cells={},links={};main.forEach((r,i)=>{cells[r.id]=w.path[i];if(i)links[[main[i-1].id,r.id].sort().join('~')]=1});
  const used=new Set(w.used);const okB=[];
  for(const g of BR){const p=gridPath(rng,cells[g.from],cells[g.to],g.alt.length+1,used);if(!p)continue;okB.push(g);let prev=g.from;g.alt.forEach((id,k)=>{cells[id]=p[k+1];used.add(p[k+1].join(','));links[[prev,id].sort().join('~')]=1;prev=id});links[[prev,g.to].sort().join('~')]=1}
  const okAlt=new Set(okB.flatMap(g=>g.alt));const hosts=main.concat(dg.rooms.filter(r=>okAlt.has(r.id)));const okS=[];
  for(const s of sides){/* 붙일 방: 입구 · 보스 빼고, 빈 이웃 칸이 있는 곳 */const cand=[];hosts.forEach(r=>{if(r.t==='boss'||(r.t==='entry'&&main.length>3))return;const [c,rr]=cells[r.id];for(const [dx,dy] of DIRS){const nc=c+dx,nr=rr+dy;if(nc>=0&&nr>=0&&nc<GRID.cols&&nr<GRID.rows&&!used.has(key(nc,nr)))cand.push([r.id,[nc,nr]])}});
   if(!cand.length)continue;const [at,cell]=pick(cand);used.add(key(...cell));cells[s.id]=cell;okS.push([s,at]);links[[at,s.id].sort().join('~')]=1}
  const score=okB.length*100+okS.length;if(!best||score>best.score){let turns=0;for(let i=2;i<main.length;i++){const a=w.path[i-2],b=w.path[i-1],c=w.path[i];if((b[0]-a[0])!==(c[0]-b[0])||(b[1]-a[1])!==(c[1]-b[1]))turns++}best={score,okB,okS,cells,links,turns}}
  if(okB.length===BR.length&&okS.length===sides.length)break}
 if(!best){dg.path=main.map(r=>r.id);return null}
 const keepB=new Set(best.okB.map(g=>g.id)),dropAlt=new Set(BR.filter(g=>!keepB.has(g.id)).flatMap(g=>g.alt)),keepS=new Set(best.okS.map(([s])=>s.id));
 best.okS.forEach(([s,at])=>{s.from=at});dg.branches=BR.filter(g=>keepB.has(g.id));dg.rooms=dg.rooms.filter(r=>!dropAlt.has(r.id)&&(!r.side||keepS.has(r.id)));
 for(const id of Object.keys(best.cells))if(!dg.rooms.some(r=>r.id===id))delete best.cells[id];
 dg.map={grid:GRID,shape:shapeName,turns:best.turns,cells:best.cells,links:best.links};dg.path=main.map(r=>r.id);return dg.map}
function generate1(o){o=o||{};const tier=o.tier||'normal';if(!PRESET[tier])throw new Error('난이도: easy | normal | hard');const seed=+o.seed||Math.floor(Math.random()*1e6);
 const rs=o._sub?seed+o._sub*104729:seed;   /* 11-02: 갈림길이 모자라면 같은 씨앗 안에서 다시 짠다(generate) — 그때만 rs 가 바뀐다. 이름표(id · 씨앗)는 그대로 */
 const rng=BT.mkRng(rs*7+3);const ri=n=>Math.floor(rng()*n);const pick=a=>a[ri(a.length)];
 const thName=o.theme&&THEMES[o.theme]?o.theme:Object.keys(THEMES)[ri(Object.keys(THEMES).length)];const th=THEMES[thName];
 const pre=PRESET[tier];const knobs=Object.assign({},COMMON,{battles:pick(pre.battles)},pre.rest2?{rest2:pre.rest2}:{},o.knobs||{});if(Array.isArray(knobs.checks))knobs.checks=pick(knobs.checks);
 const fewB=knobs.battles<Math.max(...pre.battles),fewC=knobs.checks<=Math.min(...(Array.isArray(COMMON.checks)?COMMON.checks:[4]));   /* 11-02: 체크가 4~6 이 되어 「가장 적을 때(4)」를 어려운 길로 */const tough=o.tough!=null?(o.tough?'full':''):tier==='easy'?'':fewB?'full':fewC?'hard':'';   /* 11-02 망령: 쉬움에서는 빡센 길을 뺀다(사전 배틀 0 인 쉬움이 보통만큼 어려워졌다) */   /* 10-28 테스트: 쉬움에서 「어려운 길」(목표 9 · 11 체크 3개)은 승률이 38~77% 로 흔들려 뺀다 */   /* 10-28 03시: 2단계 — 사전 배틀이 모자라면 어렵게 + 빡세게, 체크만 3개면 어렵게만(체크 수는 승률을 거의 안 움직임) */
 if(tough){for(const [k,v] of Object.entries(tough==='full'?TOUGH:{mixUp:TOUGH.mixUp}))if(!(o.knobs&&k in o.knobs))knobs[k]=v}
 /* 야생 풀을 바꿀 수 있다: o.wild = [[트레이너 id, 순번, 이름]…] · o.boss = 같은 꼴 */
 /* 야생 출처: 'dex'(기본, 제작기 도감 실제 포켓몬 — 테마 타입 · 종족치 범위) | 'npc'(무진 NPC 풀, 10-27 맞추기에 쓴 것) */
 /* 'db'(야생 DB 가 있으면 기본): 테마 = 서식지. 일반 야생 = C 묶음(일반), 보스 = B · A 묶음. o.grades = {wild:['C'], boss:['B','A']} 로 바꿀 수 있다(등급 구성 실험용) */
 const GT={easy:{wild:['C'],boss:['B','A']},normal:{wild:['C'],boss:['A']},hard:{wild:['C'],boss:['A']}};/* 10-27 20:30 야생 DB 300체 기준 맞춤(gradecal_db300): 쉬움 88 · 보통 63 · 어려움 37% */const gr=Object.assign({},GT[tier]||GT.normal,o.grades||{});
 const WB=require('./wilddb.js');const hasDb=fs.existsSync(WB.FILE)&&(WB.read().v||1)>=2;const source=o.source||(hasDb?'db':'dex');let wild=o.wild,bossP=o.boss;
 if(source==='db'&&!wild){const all=WB.fullV2();const gr=Object.assign({},GT[tier]||GT.normal,o.grades||{});const inHab=e=>(e.hab||[]).includes(thName);
  /* 10-28 실험: knobs.bossBan = '초인|수맥' — 그 특성 가진 몬은 보스 후보에서 뺀다(「자기 타입 2배」 보스가 너무 셈) */const ban=(o.knobs||{}).bossBan?new RegExp('^('+String((o.knobs||{}).bossBan)+')$'):null;const okB=e=>!ban||!ban.test(e.ability||'');
  const W0=all.filter(e=>inHab(e)&&gr.wild.includes(e.grade)),B0=all.filter(e=>inHab(e)&&gr.boss.includes(e.grade)&&okB(e));
  wild=(W0.length>=8?W0:all.filter(e=>gr.wild.includes(e.grade))).map(e=>['db',e.id,e.name]);bossP=(B0.length>=3?B0:all.filter(e=>gr.boss.includes(e.grade)&&okB(e))).map(e=>['db',e.id,e.name])}
 if(source==='dex'&&!wild){const DX=require('./dex.js');const wb=o.wildBst||DEX_BST.wild,bb=o.bossBst||DEX_BST.boss;
  const W0=DX.pick({types:th.types,bst:wb}),B0=DX.pick({types:th.types,bst:bb});wild=(W0.length>=8?W0:DX.pick({bst:wb})).map(d=>['dex',d.name,d.name]);bossP=(B0.length>=3?B0:DX.pick({bst:bb})).map(d=>['dex',d.name,d.name])}
 const keep={POOL:G.POOL.slice(),BOSS:G.BOSS.slice()};if(Array.isArray(wild)&&wild.length){G.POOL.length=0;G.POOL.push(...wild)}if(Array.isArray(bossP)&&bossP.length){G.BOSS.length=0;G.BOSS.push(...bossP)}
 let dg,donor;try{dg=G.make(tier,knobs,rs);donor=G.make(tier,Object.assign({},knobs,{battles:5,checks:6}),rs+977)}finally{G.POOL.length=0;G.POOL.push(...keep.POOL);G.BOSS.length=0;G.BOSS.push(...keep.BOSS)}
 /* 갈림길 (10-28 망령 「1갈래 길 밖에 안 나오는데?」) — 본길 한 구간(방 1~2개) 옆에 나란한 다른 길을 내고 끝에서 다시 만난다.
    다른 길은 본길 구간의 방을 뒤집어 채운다: 배틀 ↔ 체크 (싸우며 뚫는 길 / 머리 쓰는 길). 방 수가 같아 길이도 같다.
    시뮬은 판마다 반반으로 한쪽을 걷는다(dungeon.pathOf) → 승률은 두 길의 평균. o.branches = 갈림길 수(기본 1, 0 이면 예전처럼 한 줄) */
 addBranches(rng,dg,donor,o.branches!=null?+o.branches:2+ri(2),th);dg.gen.brWant=dg.branches.length;
 /* 11-02 매우 어려움(15) 상한: 다른 길 체크는 donor 던전에서 와서 따로 섞였다 → 어느 길로 가도 15 가 상한(CAP15)을 넘지 않게, 넘는 다른 길 체크는 12 로 */
 {const cap=G.CAP15[knobs.mixUp?G.MIXUP[tier]:tier];if(cap!=null){const n15=ids=>ids.map(id=>dg.rooms.find(r=>r.id===id)).filter(r=>r&&r.check&&+r.check.target===15).length;const mainN=n15(dg.rooms.filter(r=>!r.side&&!r.alt).map(r=>r.id));
  for(const g of dg.branches){const segN=n15(g.main);let room=cap-(mainN-segN);for(const id of g.alt){const r=dg.rooms.find(x=>x.id===id);if(r&&r.check&&+r.check.target===15){if(room>0)room--;else r.check.target=12}}}}}   /* 11-02 망령 「갈림길이 거의 없는 1자형만」: 갈림길 1 → 2~3 */
 /* 테마 문구 입히기 */
 const used=new Set(),usedLab=new Set();const nm=list=>{const L=list.filter(x=>!used.has(x));const v=L.length?pick(L):pick(list)+' '+(used.size+1);used.add(v);return v};
 for(const r of dg.rooms){if(r.t==='entry')r.name=nm(th.entry);else if(r.t==='battle')r.name=nm(th.battle);else if(r.t==='safe')r.name=nm(th.safe);else if(r.t==='boss')r.name=nm(th.boss);else if(r.filler)r.name=nm(th.side||th.check);else r.name=nm(th.check);
  if(r.check){const L=th.chk[r.check.stat];if(L){const F=L.filter(x=>!usedLab.has(x)),F2=(G.LABEL[r.check.stat]||[]).filter(x=>!usedLab.has(x));r.check.label=pick(F.length?F:F2.length?F2:L);usedLab.add(r.check.label)}   /* 10-28: 체크 5개면 같은 문구가 두 번 나오던 것 막음. 11-01: 테마 문구(자질마다 2개)가 떨어지면 일반 문구(gen.js LABEL) — 갈림길까지 같은 자질 체크가 셋이면 겹쳤다(180개 중 12개) */
   if(String(r.check.hint||'').startsWith('type:')&&HINT_T[thName]){r.check.hint='type:'+pick(HINT_T[thName]);if(r.check.fit)r.check.fit.types=[r.check.hint.slice(5)]}}}   /* 11-02: 적합 타입(fit)도 테마 타입으로 — 전엔 hint 만 바뀌고 fit 은 gen.js 의 무작위 타입이 남아(화산 던전에 「적합 전기」), 시뮬 판정 · 웹툴 내보내기가 fit 을 썼다 */   /* 10-28: 「이 타입 동료」를 테마에 맞는 타입에서 (전엔 고정 10타입 무작위 — 화산에 풀 같은 줄) */
 /* 보물 방 하나(체크 · 조우 없음) — 지도 꾸밈 · 웹툴에서 단서 자리 */
 if(o.treasure!==false)dg.rooms.push({id:'tr',t:'treasure',side:1,name:nm(th.treasure),clue:bossClue(dg,rng)||{t:'단서',d:'(GM 이 채운다 — 보스의 약점 · 다음 장면의 실마리 등)'}});
 /* 곁방 0~2 — 막다른 통로(웹툴 「통로」). 시뮬은 안 걷는다(dg.path 밖). GM 이 숨은 것 · 단서 · 기습을 채울 자리 */
 const nSide=o.sideRooms!=null?+o.sideRooms:ri(2);   /* 11-02: 곁방 0~2 → 1~3. 14시 망령 「8~12개」 → 0~1 (보물 방은 따로 1) */const SK=['지시','육성','통솔','능력'];
 for(let i=0;i<nSide;i++){const kind=pick(SIDE_KIND);const r={id:'s'+(i+1),t:kind.t,side:1,name:nm(th.side||th.check),memo:'곁방 · '+kind.n+' — '+kind.memo};
  if(kind.k==='check'){const st=pick(SK);const L0=(th.chk[st]||[]).filter(x=>!usedLab.has(x)),L=L0.length?L0:(G.LABEL[st]||[]).filter(x=>!usedLab.has(x));const lab=L.length?pick(L):kind.n;usedLab.add(lab);   /* 11-01: 곁방 선택 체크 둘이 같은 문구였다 */r.check=Object.assign(require('./skill.js').up({label:lab,stat:st,target:9,hint:'any'}),{target:G.mixPick(G.MIX[tier]||G.MIX.normal,rng),optional:1,pen:{fail:{al:knobs.alCost||15,memo:'헛걸음 — 기척을 남겼다'}},reward:'성공하면 경계도 −10 또는 단서 하나'})}   /* 10-29 v4: 곁방 선택 체크도 난이도 목표 · 대가 없음 */
  if(kind.k==='ambush'){r.ambush=1}
  dg.rooms.push(r)}
 layout(rng,dg,o,nm,th);
 if(!dg.map&&dg.branches&&dg.branches.length){/* 격자에 아무것도 안 들어가면 갈림길 없이 */const A=new Set(dg.branches.flatMap(g=>g.alt));dg.rooms=dg.rooms.filter(r=>!A.has(r.id));dg.branches=[];layout(rng,dg,o,nm,th)}
 const bossName=dg.gen.boss;
 dg.id=o.id||`auto_${tier}_${seed}`;const avoid=new Set((o.avoidNames||[]).map(x=>String(x).replace(/ \(.*\)$/,'')));const nmL=th.name.filter(x=>!avoid.has(x));const nm0=pick(th.name);dg.name=o.name||`${nmL.length&&avoid.has(nm0)?nmL[Math.floor(rng()*nmL.length)]:nm0} (${TIER_KO[tier]})`;   /* 11-01: o.avoidNames — 이미 있는 던전 이름은 피한다(전엔 「메아리 굴」이 보통 · 어려움에 둘) */dg.theme=thName;dg.owner=bossName;
 dg.rules=Object.assign({},RULES,o.rules||{});if(dg.rooms.some(r=>r.enc&&(r.enc.trainer||(r.enc.mix||[]).some(m=>m.trainer))))dg.private=true;   /* 11-02: 비공개는 스냅샷 트레이너가 야생으로 들어간 던전만 (전엔 늘 private — 던전 탭에서 「비공개」로 보이고 저장하면 .private.json 으로 옮겨졌다) */
 dg.note=`자동 생성 · ${TIER_KO[tier]} · 씨앗 ${seed} · 테마 ${thName}. 사전 배틀 ${knobs.battles} · 체크 ${knobs.checks} · 보스방 ${G.TIER[tier].bossN}체 · ${RAIDN[G.TIER[tier].raid]} · 지도 ${dg.branches&&dg.branches.length?'갈림길 '+dg.branches.length+' · ':''}${dg.map?dg.map.shape+(dg.rooms.some(r=>r.side)?' + 곁방 '+dg.rooms.filter(r=>r.side).length:''):'일자'} · 야생 Lv ${knobs.lv>=0?'+':''}${knobs.lv}${tough==='full'?` · 빡센 길(체크 목표 ${G.V4UP[G.V4[tier]]}, 경계도 실패 +45)`:tough==='hard'?` · 어려운 길(체크 목표 ${G.V4UP[G.V4[tier]]})`:''}.`;
 dg.gen=Object.assign({},dg.gen,{seed,sub:o._sub||undefined,v:1,auto:true,tough,shape:dg.map&&dg.map.shape,theme:thName,rules:dg.rules,source,grades:source==='db'?gr:undefined});
 return dg}
/* 웹툴 던전 탭 꼴로 — 지도 좌표(dg.map 격자, 없으면 옛 지그재그) · 통로 · 방마다 sk(스킬 체크) · rk(휴식 단계) · m(GM 메모: 조우 구성 · 경계도 패널티 · 단서) */
const PEN_KO=p=>{if(!p)return '';const L=[];if(p.al)L.push('경계도 '+(p.al>0?'+':'−')+Math.abs(p.al));if(p.dmg)L.push('HP −'+p.dmg);if(p.st)L.push('상태 '+({Paralysis:'마비',Poison:'독',Confusion:'혼란',Burn:'화상',Sleep:'잠듦'}[p.st]||p.st)+(+p.cnt>0?' '+p.cnt+'턴':''));if(p.oo)L.push('4식 −'+p.oo);if(p.oc)L.push('6령 −'+p.oc);   /* 11-01: 공용 칸에서 바로 뺀다(10-28 던전 단위 · 10-31 웹툴 「판정한 트레이너 → 일행」) — 「다음 배틀」이 아니다 */if(p.rk)L.push('랭크 '+Object.entries(p.rk).map(([k,v])=>k+(v>0?'+':'')+v).join(' '));if(p.memo)L.push(p.memo);return L.join(' · ')};
const IMG_BASE='https://mangryoung.github.io/oremas/sim/data/dungeon_img/';
function toWebtool(dg,names){names=names||{};for(const [t,i,n] of G.POOL.concat(G.BOSS)){names[t]=names[t]||{};if(names[t][i]==null)names[t][i]=n}let DBN=null;const dbName=i=>{if(!DBN){try{const WB=require('./wilddb.js');DBN=Object.fromEntries((WB._cache=WB._cache||WB.fullV2()).map(e=>[e.id,e.name]))}catch(e){DBN={}}}return DBN[i]||i};const nameOf=(t,i)=>t==='dex'?i:t==='db'?((names.db||{})[i]||dbName(i)):(names[t]&&names[t][i])||`${t} #${i}`;const rs=dg.rooms;const COLS=4,cw=200,rh=180;
 const r={},l={};const rid=x=>x.id.replace(/[^\w]/g,'').slice(0,8)||('r'+Math.random().toString(36).slice(2,6));
 const M=dg.map;rs.forEach((x,i)=>{const row=Math.floor(i/COLS),col=i%COLS,c=row%2?COLS-1-col:col;const id=rid(x);const cell=M&&M.cells[x.id];const o={n:x.name,t:x.t,x:cell?M.grid.x0+cell[0]*M.grid.dx:110+c*cw,y:cell?M.grid.y0+cell[1]*M.grid.dy:140+row*rh};const memo=[];if(x.memo)memo.push(x.memo);
  if(x.check){const c0=x.check;const u=require('./skill.js').up(c0);/* 10-29 v4: 웹툴 스킬 체크 v4 모양 (자질 + 종족값 · 적합 타입 · 목표 8~15) */o.sk={v:4,label:c0.label,stat:c0.stat,base:u.base,scene:'field',target:+u.target,fit:u.fit,name:c0.label,auto:({8:'easy',10:'normal',12:'hard',15:'vhard'})[+u.target]||(dg.gen&&dg.gen.tier)};   /* 11-01: auto 는 이 체크의 목표에 맞는 난이도 — 웹툴은 auto 가 있으면 목표를 TIER[auto] 로 덮어쓴다(skill_ui bestOdds · 제시). 전엔 던전 난이도를 실어서 빡센 길 체크(10 · 12 · 15)가 웹툴에선 8 · 10 · 12 로 나갔다 */if(u.pm)o.sk.pm=u.pm;if(c0.twice)o.sk.twice=c0.twice;
   const pf=Object.assign({},c0.pen&&c0.pen.fail);/* 10-28: 웹툴 패널티에 경계도(al) 칸이 생겨 그대로 싣는다 — 던전 탐색 중이면 웹툴이 경계도를 올린다. 10-29 v4: 대가(cost) 없음 */o.sk.pen={fail:pf};if(c0.noStep)o.sk.noStep=1;if(u.fit&&u.fit.etcMons)o.sk.fit=Object.assign({},u.fit,{etc:u.fit.etc||('GM 인정: '+u.fit.etcMons.join(' · '))});
   const TN={8:'쉬움',10:'보통',12:'어려움',15:'매우 어려움'};const ft=(u.fit&&u.fit.types)||[];   /* 10-29 v4: 메모도 sk 와 같은 목표 · 적합 (전엔 옛 목표 7 · 9 와 「대가」 줄) */
   memo.push(`🎲 ${c0.stat} + ${require('./skill.js').BASE[u.base]||''} · ${TN[+u.target]||''} ${u.target} · 적합 ${ft.length?'타입 '+ft.join('/'):'아무 포켓몬'}`);memo.push(`  실패: 트레이너 상태 한 단계${c0.noStep?' 없음':''} · ${PEN_KO(c0.pen&&c0.pen.fail)}`);if(c0.gainCrit)memo.push(`  대성공: ${PEN_KO(c0.gainCrit)}`);if(c0.reward)memo.push(`  보상: ${c0.reward}`)}
  if(x.enc&&x.enc.mix){const mons=x.enc.mix.flatMap(m=>m.sp?[m.sp]:m.db?[nameOf('db',m.db)]:(m.pick||[]).map(i=>nameOf(m.trainer,i)));   /* 10-28: 야생 DB(m.db) 이름이 빠져 「야생 0체」로 나가던 것 고침 */const lv=+x.enc.lvAdd||0;
   memo.push(`${x.enc.boss?'♛ 보스방':'⚔ 야생'} ${mons.length}체 · Lv ${lv>=0?'+':''}${lv} (경계도 30↑ +${dg.rules&&dg.rules.al30||5} · 70↑ +${dg.rules&&dg.rules.al70||10})`);
   memo.push('  '+mons.map((n,j)=>x.enc.boss&&j===(+x.enc.bossAt||0)?`★${n}『와일드 보스』${x.enc.raid?' 「레이드 배틀 : '+x.enc.raid+'」':''}`:`${n}『와일드』`).join(' · '));{const RU=dg.rules||{};const aw=x.enc.alWin!=null&&x.enc.alWin!==''?+x.enc.alWin:(x.enc.boss?0:+RU.alBattle||0),alo=x.enc.alLose!=null&&x.enc.alLose!==''?+x.enc.alLose:(RU.alLose!=null?+RU.alLose||0:RULES.alLose);o.aw=aw;o.alo=alo;if(aw||alo)memo.push(`  이기면 경계도 ${aw>=0?'+':''}${aw} · 지면 ${alo>=0?'+':''}${alo}`)}
   /* 10-31 망령 「야생도 같이 보내기」: 웹툴이 이 방의 야생 시트를 바로 만들 수 있게 종 · 능력치 · 기술 · 포텐셜을 싣는다 (o.w). 웹툴 가져오기가 시트를 만들고 방 e 에 잇는다 */
   try{const w=wildSpec(x,dg);if(w&&w.mons.length)o.w=w}catch(e){memo.push('  (야생 시트를 못 실었다: '+e.message+')')}}
  if(x.rest)o.rk=x.rest;   /* 10-28 웹툴에 중간 휴식(mid)이 생김 */
  if(x.clue)o.cl={t:x.clue.t,d:x.clue.d};
  if(x.img)o.b=IMG_BASE+String(x.img).split('/').map(encodeURIComponent).join('/');   /* 11-03 미사그 던전 8: 방 그림 = 웹툴 방 배경 (GitHub Pages 의 sim/data/dungeon_img) */
  if(memo.length)o.m=memo.join('\n').slice(0,400);r[id]=o;if(!M&&i)l[[rid(rs[i-1]),id].sort().join('~')]=1});
 if(M)for(const k of Object.keys(M.links)){const [a,b]=k.split('~').map(z=>rid(rs.find(x=>x.id===z)));l[[a,b].sort().join('~')]=1}
 return {n:dg.name,o:dg.owner?`(자동 생성) ${dg.owner}`:'',a:THEMES[dg.theme]?THEMES[dg.theme].a:(dg.theme||''),al:0,st:rid(rs[0]),wn:dg.wn||2,r,l,gen:{tier:dg.gen.tier,seed:dg.gen.seed,theme:dg.theme,rules:dg.rules}}}
/* 웹툴로 보낼 야생 시트 (던전 진행기 lib/dungeon.js 의 mix 빌드와 같은 꼴 — 야생 DB · 도감 야생. 스냅샷 트레이너 야생(m.trainer)은 웹툴에 없으니 뺀다) */
let ENVW=null;const envW=()=>ENVW||(ENVW=require('./env.js').load().win);
function wildSpec(x,dg){const enc=x.enc;if(!enc||!enc.mix)return null;const W=envW();const WB=require('./wilddb.js');const lvAdd=+enc.lvAdd||0;let mons=[];
 for(const src of enc.mix){if(src.db){const e=(WB._cache=WB._cache||WB.fullV2()).find(q=>q.id===src.db||q.name===src.db);if(!e)continue;mons.push(WB.buildEntry(W,e,{lvAdd}).mon)}else if(src.sp){mons.push(require('./dex.js').build(W,src.sp,{lvAdd}).mon)}}
 const N=+enc.n||mons.length;while(mons.length&&mons.length<N)mons.push(mons[mons.length%Math.max(1,enc.mix.length)]);mons=mons.slice(0,N);const bi=enc.boss?(+enc.bossAt||0):-1,X=enc.boss?(+enc.raid||0):0;
 return {name:(enc.boss?'야생 보스 · ':'야생 · ')+(x.name||'방'),rank:'C',mons:mons.map((m,i)=>{const boss=i===bi;const pots=[boss?'와일드 보스':'와일드'];if(boss&&X>0)pots.push('레이드 배틀 : '+X);
  const tk=m.typesKo||[];return {name:m.name,t1:tk[0]||'-',t2:tk[1]||'-',base:(m.base||[]).slice(0,6),ability:m.ability||'',abilityEff:m.abilityEff||'',auto:m.auto&&Object.keys(m.auto).length?m.auto:undefined,item:m.item||'',moves:(m.moves||[]).map(v=>v&&v.name).filter(Boolean),pride:m.pride||'C',dist:+m.dist||0,boss,pots}})}}
/* 11-02 망령 「갈림길이 거의 없는 1자형」: 갈림길 수를 정하지 않았으면 2개 이상 들어간 판이 나올 때까지 같은 씨앗 안에서 6번까지 다시 짠다.
   (첫 판에 2개 이상이면 11-02 첫 판과 같은 던전 — 씨앗이 같으면 늘 같은 던전) */
/* 11-02 14시 망령 「방이 또 너무 많다 · 8~12개로」: 방 수(입구 · 보스 · 다른 길 · 곁방 · 보물 방 모두) = ROOMS 안. 갈림길은 2개 이상을 먼저 노린다 */
const ROOMS=[8,12];
function generate(o){o=o||{};if(o.branches!=null)return generate1(o);const seed=+o.seed||Math.floor(Math.random()*1e6);const [lo,hi]=o.rooms||ROOMS;let best=null,bs=-1e9;
 const score=d=>{const n=d.rooms.length,b=(d.branches||[]).length;const out=n<lo?lo-n:n>hi?n-hi:0;return -out*10+Math.min(b,2)*3-Math.abs(n-(lo+hi)/2)*0.1};
 for(let k=0;k<30;k++){const d=generate1(Object.assign({},o,{seed,_sub:k}));
  /* 넘치면 곁방(보물 방 빼고)부터 덜어 본다 */
  while(d.rooms.length>hi){const i=d.rooms.findIndex(r=>r.side&&r.t!=='treasure');if(i<0)break;const id=d.rooms[i].id;d.rooms.splice(i,1);if(d.map&&d.map.cells)delete d.map.cells[id];if(d.map&&d.map.links)for(const k of Object.keys(d.map.links))if(k.split('~').includes(id))delete d.map.links[k]}
  const sc=score(d);if(sc>bs){bs=sc;best=d}const n=d.rooms.length;if(n>=lo&&n<=hi&&(d.branches||[]).length>=2)break}
 return best}
module.exports={ROOMS,DEX_BST,generate,generate1,toWebtool,wildSpec,THEMES,PRESET,COMMON,RULES,TIER_KO,HINT_T,bossClue};
