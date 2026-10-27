/* 던전 무작위 생성기 — 난이도(쉬움 · 보통 · 어려움)와 손잡이(knobs)로 던전 JSON 하나를 만든다. 만든 던전은 lib/dungeon.js 의 run() 으로 그대로 돌린다.
   목적: 「던전 랜덤 생성 가이드라인」과 「스킬 체크 기준점」을 숫자로 맞추기 (10-27 망령: 3인 × 2체 기준, 쉬움 승률 8할 · 보통 6할 · 어려움 3할).
   난이도: easy = 보스방 4체 · 레이드 2 / normal = 4체 · 레이드 3 / hard = 6체 · 레이드 3 (레이드는 배리어식).
   knobs: battles 일반 배틀 수 · foes 배틀당 야생 수 · lv 일반 야생 레벨 가감 · bossLv 보스방 레벨 가감 · rest 보스 앞 휴식(none|breath|short|long)
          checks 스킬 체크 수 · tgt 목표치 묶음('low' 5·7 / 'mid' 7·9 / 'high' 9·11 / 'mix' 7·7·9·9…) · pen 패널티 세기('light'|'mid'|'heavy') · hintTyped 타입 조건 체크 수
   야생 풀: POOL (스냅샷 NPC 포켓몬 — 트레이너 id + 순번). 보스는 BOSS 에서, 호위 · 일반 야생은 POOL 에서 겹치지 않게 뽑는다. */
"use strict";
const BT=require('./battle.js');
const H='id:eixp1i3f',A='id:cmouymoc',R='id:8erchipe',P='id:60mwn3bi';
/* [트레이너, 순번, 이름] — 사제 세라핌(EX)은 뺀다 */
const POOL=[[H,1,'모스맨'],[H,2,'밴시'],[H,3,'크로뱃'],[A,0,'야느와르몽'],[A,2,'애프룡'],[A,3,'쇼고스'],[R,1,'미-고'],[R,2,'렝의 거미'],[R,3,'나이트건트'],[R,4,'잠자는 숲속의 공주'],[R,5,'클락워크 드래곤'],[P,1,'하멜른'],[P,4,'엘모의 불'],[P,5,'네후스탄'],[P,6,'야곱']];
const BOSS=[[H,0,'잭 오 랜턴'],[A,1,'알 아지프'],[R,0,'아틀락-나차'],[P,2,'리바이어던'],[P,3,'아바돈']];
const TIER={easy:{bossN:4,raid:2,name:'쉬움'},normal:{bossN:4,raid:3,name:'보통'},hard:{bossN:6,raid:3,name:'어려움'}};
const STATS=['지시','육성','통솔','능력'];
const TYPES=['물','풀','불꽃','전기','에스퍼','고스트','땅','비행','악','페어리'];
const SRC=([t,i])=>t==='dex'?{sp:i}:t==='db'?{db:i}:{trainer:t,pick:[i]};   /* 풀 항목 → mix 항목. ['dex', 이름, 이름] = 도감 야생 · ['db', id, 이름] = 야생 DB(data/wild/db.json) */
const TGT={low:[5,7],mid:[7,9],high:[9,11],mix:[7,9]};
/* 패널티 표 (웹툴 PEN_EX 꼴). 세기별로 실패 · 대가 */
const PEN={
 light:{fail:[{memo:'시간 지체'},{dmg:'1/8',memo:'긁힘'}],cost:[{memo:'시간이 걸림'},{memo:'흔적을 남김'}]},
 mid:{fail:[{dmg:'1/8',st:'Confusion',memo:'홀림'},{oo:1,memo:'동요 — 다음 배틀 4식 −1'},{dmg:'1/4',memo:'함정'}],cost:[{dmg:'1/8',memo:'무리함'},{rk:{speed:-1},memo:'발이 무거워짐'}]},
 /* 배틀에 닿는 패널티 (10-27 3차: HP · 상태 패널티는 승률을 거의 못 움직임) — F 는 생성 때 추가 조우 무리로 바뀐다 */
 battle:{fail:[{fight:'F1',memo:'소란 — 야생이 몰려옴'},{restDown:1,memo:'쉴 자리를 잃음'}],cost:[{foeLv:5,memo:'기척을 들킴 — 다음 야생 Lv +5'},{dmg:'1/8',memo:'무리함'}]},
 battle2:{fail:[{fight:'F2',memo:'둥지를 건드림 — 야생 2체'},{restDown:2,memo:'쉴 자리가 무너짐'}],cost:[{fight:'F1',memo:'소리를 냄 — 야생 1체'},{restDown:1,memo:'시간이 걸려 쉴 틈이 줄어듦'},{foeLv:5,memo:'기척을 들킴 — 다음 야생 Lv +5'}]},
 /* 10-27 망령 확정 룰: 패널티는 HP · 상태 이상 · 경계도만. 'A' 는 생성 때 knobs.alCost / alFail 로 바뀐다 */
 /* 10-27 망령: 4식 차감 = 큰 패널티(1개면 치명적), 6령 차감 = 작은 패널티(2개 ≈ 4식 1개보다 조금 작음) — 실패 쪽에 4식 1 · 6령 2, 대가 쪽에 6령 1 */
 alert:{fail:[{al:'F',dmg:'1/4',memo:'들켜서 다쳤다'},{al:'F',st:'Paralysis',memo:'들켜서 몸이 굳었다'},{al:'F',oo:1,memo:'들켜서 허둥댔다'},{oc:2,memo:'크게 지쳤다'}],cost:[{al:'C',memo:'기척을 남겼다'},{al:'C',memo:'소리를 냈다'},{dmg:'1/8',memo:'무리했다'},{st:'Confusion',memo:'정신이 어지럽다'},{oc:1,memo:'조금 지쳤다'}]},
 boss:{fail:[{bossLv:10,memo:'보스가 눈치챔 — 보스방 Lv +10'}],cost:[{bossLv:5,memo:'흔적을 남김 — 보스방 Lv +5'}]},
 boss_lite:{fail:[{bossLv:5,memo:'보스가 눈치챔 — 보스방 Lv +5'}],cost:[{bossLv:3,memo:'흔적을 남김 — 보스방 Lv +3'}]},
 heavy:{fail:[{dmg:'1/4',st:'Poison',memo:'독 함정'},{oo:1,oc:1,memo:'혼란 — 다음 배틀 4식 · 6령 −1'},{dmg:'1/4',st:'Paralysis',memo:'감전'}],cost:[{dmg:'1/8',memo:'무리함'},{oc:1,memo:'경계 — 다음 배틀 6령 −1'},{rk:{attack:-1,specialattack:-1},memo:'기세가 꺾임'}]}};
const LABEL={지시:['옛 장치를 작동시킨다','함정의 순서를 읽는다','갈림길의 표식을 해독한다'],육성:['지친 포켓몬을 돌본다','야생의 흔적을 쫓는다','다친 야생 포켓몬을 달랜다'],통솔:['겁먹은 포켓몬을 진정시킨다','무너지는 다리를 함께 건넌다','대열을 지켜 안개를 지난다'],능력:['봉인된 문을 연다','속삭이는 목소리의 정체를 쫓는다','무너진 길을 몸으로 뚫는다']};
const DEF={battles:2,foes:2,lv:0,bossLv:0,rest:'short',checks:3,tgt:'mix',pen:'alert',hintTyped:1,alCost:15,alFail:30};
function make(tier,knobs,seed){const T=TIER[tier];if(!T)throw new Error('난이도: easy | normal | hard');const k=Object.assign({},DEF,knobs||{});const rng=BT.mkRng(seed||1);
 const ri=n=>Math.floor(rng()*n);const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=ri(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
 const boss=BOSS[ri(BOSS.length)];const pool=shuffle(POOL);let pi=0;const take=n=>{const out=[];for(let i=0;i<n;i++){out.push(pool[pi%pool.length]);pi++}return out};
 /* 체크: 자질을 고루(같은 자질 연달아 X), 목표치 묶음, 타입 조건은 hintTyped 개만 */
 const sts=shuffle(STATS);const checks=[];const tg=TGT[k.tgt]||TGT.mix;const typedAt=new Set(shuffle([...Array(k.checks).keys()]).slice(0,k.hintTyped));
 for(let i=0;i<k.checks;i++){const st=sts[i%4];const target=k.tgt==='mix'?tg[i%2]:tg[ri(tg.length)];const pe=PEN[k.pen]||PEN.mid;
  const fx=o=>{o=JSON.parse(JSON.stringify(o));if(o.al==='F')o.al=k.alFail;if(o.al==='C')o.al=k.alCost;if(typeof o.fight==='string'){const n=+o.fight.slice(1);o.fight={mix:take(n).map(SRC),lvAdd:k.lv}}return o};
  const c={label:LABEL[st][ri(3)],stat:st,target,hint:typedAt.has(i)?'type:'+TYPES[ri(TYPES.length)]:'any',pen:{fail:fx(pe.fail[ri(pe.fail.length)]),cost:fx(pe.cost[ri(pe.cost.length)])}};if(st==='능력'&&ri(2))c.mode='inou';checks.push(c)}
 /* 방 배치: 입구(체크) → [배틀 · 체크 섞기] → (휴식 방 + 남은 체크) → 보스 */
 const rooms=[];let ci=0,rn=0;const nextCheck=()=>ci<checks.length?checks[ci++]:null;const cid=()=>'c'+(++rn);   /* 10-28: 방 id 가 겹치던 것 고침(전엔 'c'+ci 가 두 곳에서 같은 값 — 시뮬이 한 체크를 두 번 · 다른 하나는 건너뜀) */
 rooms.push({id:'entry',t:'entry',name:'입구',check:nextCheck()});
 for(let b=0;b<k.battles;b++){rooms.push({id:'b'+(b+1),t:'battle',name:'조우 '+(b+1),enc:{mix:take(k.foes).map(SRC),lvAdd:k.lv}});
  const left=checks.length-ci,slots=k.battles-b;if(left>1&&(left>slots||ri(2))){const c=nextCheck();if(c)rooms.push({id:cid(),t:['puzzle','trap','room'][ri(3)],name:'방 '+ci,check:c})}}
 /* 10-27 저녁: 남은 체크는 휴식 방 앞에 둔다(마지막 하나는 휴식 방 안). 전엔 휴식 뒤에 남아 HP 패널티가 그대로 보스로 갔다 */
 while(checks.length-ci>1)rooms.push({id:cid(),t:['puzzle','trap','room'][ri(3)],name:'방 '+ci,check:nextCheck()});
 const restRoom={id:'safe',t:'safe',name:'쉼터'};if(k.rest&&k.rest!=='none')restRoom.rest=k.rest;const c2=nextCheck();if(c2)restRoom.check=c2;if(restRoom.rest||restRoom.check)rooms.push(restRoom);
 const esc=take(T.bossN-1);rooms.push({id:'boss',t:'boss',name:'보스 · '+boss[2],enc:{mix:[SRC(boss)].concat(esc.map(SRC)),boss:true,bossAt:0,raid:T.raid,n:T.bossN,lvAdd:k.bossLv}});
 return {id:`gen_${tier}_${seed}`,name:`생성 · ${T.name} #${seed}`,wn:2,private:true,gen:{tier,knobs:k,seed,boss:boss[2]},rooms}}
module.exports={make,TIER,POOL,BOSS,PEN,DEF};
