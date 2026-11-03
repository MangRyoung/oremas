/* 던전 무작위 생성기 — 난이도(쉬움 · 보통 · 어려움)와 손잡이(knobs)로 던전 JSON 하나를 만든다. 만든 던전은 lib/dungeon.js 의 run() 으로 그대로 돌린다.
   목적: 「던전 랜덤 생성 가이드라인」과 「스킬 체크 기준점」을 숫자로 맞추기 (10-27 망령: 3인 × 2체 기준, 쉬움 승률 8할 · 보통 6할 · 어려움 3할).
   난이도: easy = 보스방 4체 · 레이드 2 / normal = 4체 · 레이드 3 / hard = 6체 · 레이드 3 (레이드는 배리어식).
   knobs: battles 일반 배틀 수 · foes 배틀당 야생 수 · lv 일반 야생 레벨 가감 · bossLv 보스방 레벨 가감 · rest 보스 앞 휴식(none|breath|short|long)
          checks 스킬 체크 수 · tgt 목표치 묶음 — 11-02 'v4mix' 보통 · 어려움 · 매우 어려움 섞기(MIX, mixUp 1 = 한 칸 위 비율) / 10-29 v4: 'tier' 난이도 목표(쉬움 8 · 보통 10 · 어려움 12) / 'tierUp' 한 칸 위(10 · 12 · 15). 옛 v3 묶음('low' 5·7 / 'mid' 7·9 / 'high' 9·11 / 'mix' 7·7·9·9…)은 실행 때 skill.js up 이 v4 로 바꾼다
          critAl 대성공 이득 = 경계도 −critAl (기본 10) · pen 패널티 세기('light'|'mid'|'heavy') · hintTyped 타입 조건 체크 수
   야생 풀: POOL (스냅샷 NPC 포켓몬 — 트레이너 id + 순번). 보스는 BOSS 에서, 호위 · 일반 야생은 POOL 에서 겹치지 않게 뽑는다. */
"use strict";
const BT=require('./battle.js'),SK=require('./skill.js');
const H='id:eixp1i3f',A='id:cmouymoc',R='id:8erchipe',P='id:60mwn3bi';
/* [트레이너, 순번, 이름] — 사제 세라핌(EX)은 뺀다 */
const POOL=[[H,1,'모스맨'],[H,2,'밴시'],[H,3,'크로뱃'],[A,0,'야느와르몽'],[A,2,'애프룡'],[A,3,'쇼고스'],[R,1,'미-고'],[R,2,'렝의 거미'],[R,3,'나이트건트'],[R,4,'잠자는 숲속의 공주'],[R,5,'클락워크 드래곤'],[P,1,'하멜른'],[P,4,'엘모의 불'],[P,5,'네후스탄'],[P,6,'야곱']];
const BOSS=[[H,0,'잭 오 랜턴'],[A,1,'알 아지프'],[R,0,'아틀락-나차'],[P,2,'리바이어던'],[P,3,'아바돈']];
const TIER={easy:{bossN:4,raid:2,name:'쉬움'},normal:{bossN:4,raid:3,name:'보통'},hard:{bossN:6,raid:3,name:'어려움'}};
const STATS=['지시','육성','통솔','능력'];
const TYPES=['물','풀','불꽃','전기','에스퍼','고스트','땅','비행','악','페어리'];
const SRC=([t,i])=>t==='dex'?{sp:i}:t==='db'?{db:i}:{trainer:t,pick:[i]};   /* 풀 항목 → mix 항목. ['dex', 이름, 이름] = 도감 야생 · ['db', id, 이름] = 야생 DB(data/wild/db.json) */
const TGT={low:[5,7],mid:[7,9],high:[9,11],mix:[7,9]};
/* 10-29 스킬 체크 v4: 룰북 목표치 쉬움 8 · 보통 10 · 어려움 12 · 매우 어려움 15 — 던전 난이도 = 체크 난이도, 빡센 길 · 어려운 길은 한 칸 위 (checkgen.js BAND 와 같다) */
const V4={easy:8,normal:10,hard:12},V4UP={8:10,10:12,12:15,15:15};
/* 11-02 망령 「쉬움은 테스트로 내는 의미가 거~의 없어 · 보통/어려움 위주에 매우 어려움을 좀 섞는 느낌」 — 체크 목표를 던전 난이도 하나로 두지 않고 섞는다.
   MIX[난이도] = 보통(10) · 어려움(12) · 매우 어려움(15) 비율. 쉬움(8) 체크는 내지 않는다. 빡센 길 · 어려운 길은 한 칸 위 비율(MIXUP).
   목표 15 는 「매우 어려움」 체크로만 나온다(11-02 망령 — 전엔 어려움 던전 빡센 길이 체크 전부를 15 로 올렸다) */
const MIX_T=[10,12,15],MIX={easy:[6,3,1],normal:[4,4,2],hard:[2,5,3],hardUp:[1,5,4]},MIXUP={easy:'normal',normal:'hard',hard:'hardUp'};
/* 11-02 망령 「어렵다고 매우 어려움 체크만 마구 내면 안 돼. 매우 어려움은 뚫기 어려우니까」 — 매우 어려움(15)은 한 길에 1개까지(어려움 던전 빡센 길만 2개). 넘친 것은 어려움(12)으로 */
const CAP15={easy:1,normal:1,hard:1,hardUp:2};
/* n 개 체크에 비율대로 목표를 나눠 준다 — 큰 나머지 순(같으면 무작위), 순서는 섞는다 */
function mixTargets(w,n,rng,cap){const S=w.reduce((a,b)=>a+b,0);const q=w.map(x=>x*n/S);const c=q.map(Math.floor);let left=n-c.reduce((a,b)=>a+b,0);
 const ord=q.map((x,i)=>({i,r:x-Math.floor(x)+rng()*1e-6})).sort((a,b)=>b.r-a.r);for(const {i} of ord){if(left<=0)break;c[i]++;left--}
 const L=[];c.forEach((k,i)=>{for(let j=0;j<k;j++)L.push(MIX_T[i])});if(cap!=null){let k=0;for(let i=0;i<L.length;i++)if(L[i]===15&&++k>cap)L[i]=12}for(let i=L.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[L[i],L[j]]=[L[j],L[i]]}return L}
function mixPick(w,rng){const S=w.reduce((a,b)=>a+b,0);let x=rng()*S;for(let i=0;i<w.length;i++){x-=w[i];if(x<0)return MIX_T[i]}return MIX_T[0]}
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
/* 10-28 망령 「스킬체크는 대가 실패가 정말 허접하게 되있는데? 게임 수치적인걸 제시해야지」 — 자질마다 숫자로 된 패널티 (룰: HP · 상태 이상 · 경계도 · 4식 6령).
   실패 = 경계도 +F 와 함께 하나 더(HP · 상태 · 4식 · 6령), 대가 = 숫자 하나. 메모는 장면 말 한 줄(숫자 뒤에 붙는다).
   지시 = 지시가 엇갈림(4식 · 6령) · 육성 = 야생 · 환경에 다침(HP · 독) · 통솔 = 대열이 흔들림(혼란 · 6령) · 능력 = 몸으로 · 이능 반동(HP · 마비).
   난이도: 쉬움은 HP 한 단계 가볍게(1/4 → 1/8) · 어려움은 한 단계 무겁게(1/4 → 1/3, 1/8 → 1/6)와 6령 +1. 상태의 cnt = 턴 수(혼란) */
PEN.num={
 지시:{fail:[{al:'F',oo:1,memo:'지시가 엇갈렸다'},{al:'F',oc:2,memo:'우왕좌왕했다'}],cost:[{oc:1,memo:'지시를 다시 내렸다'},{al:'C',memo:'시간을 끌었다'}]},
 육성:{fail:[{al:'F',st:'Poison',memo:'독이 있는 것에 닿았다'},{al:'F',dmg:'1/4',memo:'야생에게 물렸다'}],cost:[{dmg:'1/8',memo:'긁혔다'},{al:'C',memo:'흔적을 남겼다'}]},
 통솔:{fail:[{al:'F',st:'Confusion',cnt:3,memo:'대열이 무너졌다'},{al:'F',oc:2,memo:'모두 지쳤다'}],cost:[{st:'Confusion',cnt:2,memo:'정신이 없다'},{oc:1,memo:'숨이 찼다'}]},
 능력:{fail:[{al:'F',dmg:'1/4',st:'Paralysis',memo:'반동에 몸이 굳었다'},{al:'F',dmg:'1/3',memo:'크게 휘말렸다'}],cost:[{dmg:'1/8',memo:'무리했다'},{al:'C',memo:'소리를 냈다'}]}};
const DMG_UP={'1/8':'1/6','1/6':'1/4','1/4':'1/3'},DMG_DN={'1/2':'1/3','1/3':'1/4','1/4':'1/8','1/6':'1/8'};
/* 한 체크의 패널티 {fail, cost} — k = {alFail, alCost} */
function penFor(stat,tier,rng,k){const T=PEN.num[stat]||PEN.num.지시;const pick=a=>JSON.parse(JSON.stringify(a[Math.floor(rng()*a.length)]));k=k||{};
 const fx=o=>{if(o.al==='F')o.al=k.alFail==null?20:k.alFail;if(o.al==='C')o.al=k.alCost==null?10:k.alCost;if(o.dmg&&tier==='easy')o.dmg=DMG_DN[o.dmg]||o.dmg;if(o.dmg&&tier==='hard')o.dmg=DMG_UP[o.dmg]||o.dmg;return o};
 const fail=fx(pick(T.fail)),cost=fx(pick(T.cost));if(tier==='hard')fail.oc=(+fail.oc||0)+1;return {fail,cost}}
const LABEL={지시:['옛 장치를 작동시킨다','함정의 순서를 읽는다','갈림길의 표식을 해독한다'],육성:['지친 포켓몬을 돌본다','야생의 흔적을 쫓는다','다친 야생 포켓몬을 달랜다'],통솔:['겁먹은 포켓몬을 진정시킨다','무너지는 다리를 함께 건넌다','대열을 지켜 안개를 지난다'],능력:['봉인된 문을 연다','속삭이는 목소리의 정체를 쫓는다','무너진 길을 몸으로 뚫는다']};
const DEF={battles:2,foes:2,lv:0,bossLv:0,rest:'short',checks:3,tgt:'tier',pen:'alert',hintTyped:1,alCost:15,alFail:30,critAl:10};
function make(tier,knobs,seed){const T=TIER[tier];if(!T)throw new Error('난이도: easy | normal | hard');const k=Object.assign({},DEF,knobs||{});const rng=BT.mkRng(seed||1);
 const ri=n=>Math.floor(rng()*n);const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=ri(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
 const boss=BOSS[ri(BOSS.length)];const pool=shuffle(POOL);let pi=0;const take=n=>{const out=[];for(let i=0;i<n;i++){out.push(pool[pi%pool.length]);pi++}return out};
 /* 체크: 자질을 고루(같은 자질 연달아 X), 목표치 묶음, 타입 조건은 hintTyped 개만 */
 const sts=shuffle(STATS);const checks=[];const tg=TGT[k.tgt]||TGT.mix;const mixT=k.tgt==='v4mix'?mixTargets(MIX[k.mixUp?MIXUP[tier]:tier]||MIX.normal,k.checks,rng,CAP15[k.mixUp?MIXUP[tier]:tier]):null;const typedAt=new Set(shuffle([...Array(k.checks).keys()]).slice(0,k.hintTyped));
 for(let i=0;i<k.checks;i++){const st=sts[i%4];const target=mixT?mixT[i]:k.tgt==='tier'?V4[tier]:k.tgt==='tierUp'?V4UP[V4[tier]]:k.tgt==='mix'?tg[i%2]:tg[ri(tg.length)];const pe=PEN[k.pen]||PEN.mid;
  const fx=o=>{o=JSON.parse(JSON.stringify(o));if(o.al==='F')o.al=k.alFail;if(o.al==='C')o.al=k.alCost;if(typeof o.fight==='string'){const n=+o.fight.slice(1);o.fight={mix:take(n).map(SRC),lvAdd:k.lv}}return o};
  const c={label:LABEL[st][ri(3)],stat:st,target,hint:typedAt.has(i)?'type:'+TYPES[ri(TYPES.length)]:'any',pen:k.pen==='alert'||k.pen==='num'?penFor(st,tier,rng,k):{fail:fx(pe.fail[ri(pe.fail.length)]),cost:fx(pe.cost[ri(pe.cost.length)])}};if(st==='능력')ri(2);   /* 10-29 v4: 초상 능력은 시뮬이 고른다(옛 mode 'inou' 없음) — 씨앗마다 같은 던전이 나오게 주사위만 굴린다 */
  const u=SK.up(c);if(k.tgt==='tier'||k.tgt==='tierUp'||mixT)u.target=target;delete u.pen.cost;if(+k.critAl)u.gainCrit={al:-(+k.critAl),memo:'대성공 — 기척을 지웠다'};checks.push(u)}
 /* 방 배치: 입구(체크) → [배틀 · 체크 섞기] → (휴식 방 + 남은 체크) → 보스 */
 const rooms=[];let ci=0,rn=0;const nextCheck=()=>ci<checks.length?checks[ci++]:null;const cid=()=>'c'+(++rn);   /* 10-28: 방 id 가 겹치던 것 고침(전엔 'c'+ci 가 두 곳에서 같은 값 — 시뮬이 한 체크를 두 번 · 다른 하나는 건너뜀) */
 rooms.push({id:'entry',t:'entry',name:'입구',check:nextCheck()});
 for(let b=0;b<k.battles;b++){rooms.push({id:'b'+(b+1),t:'battle',name:'조우 '+(b+1),enc:{mix:take(k.foes).map(SRC),lvAdd:k.lv}});
  const left=checks.length-ci,slots=k.battles-b;if(left>1&&(left>slots||ri(2))){const c=nextCheck();if(c)rooms.push({id:cid(),t:['puzzle','trap','room'][ri(3)],name:'방 '+ci,check:c})}}
 /* 10-27 저녁: 남은 체크는 휴식 방 앞에 둔다(마지막 하나는 휴식 방 안). 전엔 휴식 뒤에 남아 HP 패널티가 그대로 보스로 갔다 */
 while(checks.length-ci>1)rooms.push({id:cid(),t:['puzzle','trap','room'][ri(3)],name:'방 '+ci,check:nextCheck()});
 const restRoom={id:'safe',t:'safe',name:'쉼터'};if(k.rest&&k.rest!=='none')restRoom.rest=k.rest;const c2=nextCheck();if(c2){if(+c2.target===15)c2.target=12;restRoom.check=c2}   /* 11-04 망령 「난이도 15는 육성형이 있는데도 그럼 문제가 조금」: 쉼터 체크(덤 · 실패 대가가 큼)는 매우 어려움(15)을 내지 않고 어려움(12)까지 */if(restRoom.rest||restRoom.check)rooms.push(restRoom);
 /* 11-02 망령 「어려움이 방이 많을 경우엔 회복 방을 2개 배치한다던가?」: knobs.rest2 = 본길 방이 그 수 이상이면 본길 가운데쯤에 쉼터(짧은 휴식) 하나 더 */
 if(+k.rest2>0&&rooms.length+1>=+k.rest2){const mid=Math.max(2,Math.floor(rooms.length/2));if(rooms[mid-1].t!=='safe'&&(!rooms[mid]||rooms[mid].t!=='safe'))rooms.splice(mid,0,{id:'safe2',t:'safe',name:'쉼터 2',rest:k.rest&&k.rest!=='none'?k.rest:'short'})}
 const bN=+k.bossN||T.bossN,rX=k.raid!=null&&k.raid!==''?+k.raid:T.raid;   /* 11-02: knobs.bossN · raid 로 보스방 수 · 레이드 바꾸기(실험 · 결정 뒤 기본값) */const esc=take(bN-1);rooms.push({id:'boss',t:'boss',name:'보스 · '+boss[2],enc:{mix:[SRC(boss)].concat(esc.map(SRC)),boss:true,bossAt:0,raid:rX,n:bN,lvAdd:k.bossLv}});
 return {id:`gen_${tier}_${seed}`,name:`생성 · ${T.name} #${seed}`,wn:2,private:true,gen:{tier,knobs:k,seed,boss:boss[2]},rooms}}
module.exports={make,TIER,POOL,BOSS,PEN,DEF,penFor,V4,V4UP,LABEL,MIX,MIX_T,MIXUP,CAP15,mixTargets,mixPick};
