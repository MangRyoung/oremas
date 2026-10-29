/* 스킬 체크 생성기 (10-28 망령 「스킬 체크 생성기도 로직을 짜고 검토」). 10-29 v4: 목표 = 난이도 고정(BAND, 쉬움 8 · 보통 10 · 어려움 12 · 매우 어려움 15), 굴림 = 2d6 + 자질 + 필드 포켓몬 종족값 랭크 + 적합,
   대가 없음 · 대성공 이득 gainCrit(경계도 −10). 아래 1)~5) 는 v3(주사위 · 목표 7 · 9) 때 설명 — 「누가 굴릴지」 고르기 · 자질 고루 · 타입 조건 고르기는 그대로 쓴다.
   지금 던전 생성기(gen.js)는 목표치를 7 · 9 로 번갈아 박고 자질 · 타입 조건을 무작위로 고른다 → 같은 체크라도 일행에 따라 성공률이 20~95% 로 갈린다.
   여기서는 「누가 굴릴지」까지 셈해서 목표치를 고른다:
     1) 일행마다 자질 주사위(지시 · 육성 · 통솔 · 능력)와 동행 포켓몬 타입을 읽는다 (던전 시뮬과 같다: 가장 큰 주사위가 굴린다, 타입 조건 동료가 없으면 혼자 d4).
     2) 자질: 돌아가며 주인공이 되게 — 그 자질에서 가장 잘하는 사람이 아직 덜 나온 자질을 먼저, 같은 자질 연달아 X.
     3) 타입 조건(체크 중 hintTyped 개): 테마에 어울리는 타입(autogen HINT_T) 중 일행에 있는 타입을 먼저 — 「그 타입을 데려왔으면 덕을 본다」. 없는 타입이면 혼자 d4 로 셈한다.
     4) 목표치: 굴릴 사람 · 동료 주사위로 정확한 확률(skill.js dist)을 계산해, 「대가 포함 성공」이 난이도 띠에 드는 값 중 하나(띠 가운데에 가까운 쪽을 더 자주).
          쉬움 85~95% · 보통 70~85% · 어려움 50~70%   (지금 7 · 9 고정이 시험 일행에서 대략 이 근처)
     5) 대가 · 실패: gen.js penFor — 자질마다 숫자로 된 패널티(10-28, 실패 = 경계도 + HP · 상태 · 4식 6령 하나, 대가 = 숫자 하나). 문구는 테마(autogen THEMES[테마].chk).
   한 체크: gen.js 와 같은 꼴 {label, stat, target, hint, pen, mode?} + odds {who, die, partner, okPlus, ok, fail} (검토용 — 웹툴로 보낼 땐 무시해도 된다).
   검토(review): 조합마다 체크 묶음을 만들어 띠 안 비율 · 주인공 고루 · 혼자 d4 체크 수를, 지금 방식(7 · 9 고정)과 나란히 센다. */
"use strict";
const SK=require('./skill.js'),BT=require('./battle.js'),G=require('./gen.js');
const STATS=['지시','육성','통솔','능력'];
const BAND={easy:8,normal:10,hard:12,vhard:15};   /* 10-29 v4: 난이도 = 고정 목표치 (룰북 쉬움 8 · 보통 10 · 어려움 12 · 매우 어려움 15) */
const TYPE_KO=SK.TYPE_KO;
/* 일행 읽기: parties=[{trainer, mons}] → [{name, ranks, mons}] — 동행 wn 체(파트너 먼저, dungeon.makeParty 와 같다) */
function partyInfo(parties,wn,fieldMax){wn=wn||2;return parties.map(p=>{const ms=p.mons.slice().sort((a,b)=>(b.partner?1:0)-(a.partner?1:0)).slice(0,wn).slice(0,Math.max(1,+fieldMax||1));   /* 10-29: 판정은 필드 포켓몬만 (dungeon.js fieldMons 와 같다, 기본 1체) */
 return {name:p.trainer.name,ranks:p.trainer.ranks||{},mons:ms,types:new Set(ms.flatMap(m=>m.types||[]))}})}
/* 이 체크를 누가 어떤 짝으로 굴리나 (dungeon.js doCheck 와 같은 고르기: 보정 합이 가장 큰 사람 · 포켓몬) */
function roller(info,stat,hint){const ck=SK.up({stat,hint,target:7});let best=null;
 for(const P of info){const rank=P.ranks[stat]||'C';const opts=[{rank,mon:null,m:null},...P.mons.map(m=>{const f=SK.monFit(m,ck);return {rank,mon:f.mon,fit:f.fit,m}})];
  for(const q of opts){q.mod=SK.modOf(q);if(!best||q.mod>best.q.mod)best={P,rank,q,partner:q.m?q.m.name:'alone',score:q.mod}}}
 return best}
const odds=(r,target)=>{const s=SK.summary(Object.assign({},r.q,{target}));return {okPlus:s.ok/100,ok:s.ok/100,fail:s.fail/100}};
/* 목표치: 난이도 그대로 (band = 목표치 숫자. 예전처럼 [하한, 상한] 확률 띠를 주면 띠 가운데에 가장 가까운 v4 목표치) */
function pickTarget(rng,r,band){const T=[8,10,12,15];if(typeof band==='number'){const o=odds(r,band);return {t:band,o,inb:true,d:0}}
 const mid=(band[0]+band[1])/2;const C=T.map(t=>{const o=odds(r,t);return {t,o,d:Math.abs(o.okPlus-mid),inb:o.okPlus>=band[0]-1e-9&&o.okPlus<=band[1]+1e-9}});return C.sort((a,b)=>(b.inb-a.inb)||(a.d-b.d))[0]}
/* o = {tier, theme, n, hintTyped, alCost, alFail, seed | rng, wn, band} → 체크 배열 */
function make(parties,o){o=o||{};const tier=o.tier||'normal',band=o.band||BAND[tier];const rng=o.rng||BT.mkRng(o.seed||1);const pick=a=>a[Math.floor(rng()*a.length)];
 const AG=require('./autogen.js');const TH=AG.THEMES[o.theme]||null;const HT=(AG.HINT_T||{})[o.theme]||Object.keys(TYPE_KO);
 const info=o.info||partyInfo(parties,o.wn,o.fieldMax);const n=o.n||4,typedN=o.hintTyped==null?1:o.hintTyped;
 const typedAt=new Set();while(typedAt.size<Math.min(n,typedN))typedAt.add(Math.floor(rng()*n));
 const spot=Object.fromEntries(info.map(P=>[P.name,0])),usedStat={},usedLab=new Set();let last='';const out=[];
 for(let i=0;i<n;i++){
  /* 자질: 같은 자질 연달아 X → 그 자질의 굴릴 사람이 덜 나온 쪽 → 덜 쓴 자질 → 무작위 */
  const SL=o.stats&&o.stats.length?STATS.filter(s=>o.stats.includes(s)):STATS;const cand=(SL.length>1?SL.filter(s=>s!==last):SL).map(s=>({s,r:roller(info,s,'any'),k:rng()})).sort((a,b)=>(spot[a.r.P.name]-spot[b.r.P.name])||((usedStat[a.s]||0)-(usedStat[b.s]||0))||(a.k-b.k));
  const stat=cand[0].s;last=stat;usedStat[stat]=(usedStat[stat]||0)+1;
  /* 타입 조건: 일행에 있는 테마 타입 먼저 */
  let hint='any';if(typedAt.has(i)){const have=HT.filter(t=>info.some(P=>P.types.has(TYPE_KO[t])));hint='type:'+(have.length&&rng()<0.8?pick(have):pick(HT))}
  const r=roller(info,stat,hint);spot[r.P.name]++;const T=pickTarget(rng,r,band);
  const PN=G.penFor(stat,tier,rng,{alFail:o.alFail,alCost:o.alCost});delete PN.cost;   /* 10-29 v4: 대가 없음 */   /* 10-28: 자질마다 숫자로 된 패널티 (gen.js PEN.num) */
  let label='';if(TH&&TH.chk&&TH.chk[stat]){const L=TH.chk[stat].filter(x=>!usedLab.has(x));label=pick(L.length?L:TH.chk[stat]);usedLab.add(label)}else label=stat+' 체크';
  const c={v:4,label,stat,base:SK.up({stat}).base,target:T.t,hint,fit:SK.up({stat,hint}).fit,pen:PN,odds:{who:r.P.name,die:'2d6'+(r.q.mod>=0?'+':'')+r.q.mod,partner:r.partner,okPlus:+T.o.okPlus.toFixed(2),ok:+T.o.ok.toFixed(2),fail:+T.o.fail.toFixed(2),inBand:T.inb}};if(o.critAl!==0)c.gainCrit={al:-(+o.critAl||10),memo:'대성공 — 기척을 지웠다'};
  out.push(c)}
 return out}
/* 지금 방식(gen.js: 목표 7 · 9 번갈아, 자질 섞어 돌림, 타입 조건 무작위 10타입)을 같은 계산으로 — 비교용 */
function makeOld(parties,o){o=o||{};const rng=o.rng||BT.mkRng(o.seed||1);const info=o.info||partyInfo(parties,o.wn);const n=o.n||4;
 const TY=['물','풀','불꽃','전기','에스퍼','고스트','땅','비행','악','페어리'];const sts=STATS.slice().sort(()=>rng()-0.5);const typed=Math.floor(rng()*n);const out=[];
 for(let i=0;i<n;i++){const stat=sts[i%4];const hint=i===typed?'type:'+TY[Math.floor(rng()*TY.length)]:'any';const target=[10,12][i%2];const r=roller(info,stat,hint);const ob=odds(r,target);
  out.push({stat,target,hint,odds:{who:r.P.name,partner:r.partner,okPlus:+ob.okPlus.toFixed(2)}})}
 return out}
/* 검토: 조합(trios)마다 seeds 번 만들어 센다 → {띠 안 비율, 대가 포함 성공 평균 · 최소 · 최대, 혼자 d4 비율, 주인공 고루(한 묶음에서 굴린 사람 수 / 일행 수)} */
function review(built,trios,o){o=o||{};const out={};
 for(const tier of o.tiers||['easy','normal','hard']){const band=BAND[tier];const S={new:[],old:[]};
  for(const c of trios){const parties=c.map(x=>built[x]);const info=partyInfo(parties,o.wn);
   for(let s=1;s<=(o.seeds||10);s++){const th=o.theme||Object.keys(require('./autogen.js').THEMES)[s%8];
    S.new.push(make(parties,{tier,theme:th,n:o.n||4,seed:s*31+7,info}));S.old.push(makeOld(parties,{n:o.n||4,seed:s*31+7,info}))}}
  const sum=L=>{const all=L.flat();const v=all.map(c=>c.odds.okPlus).sort((a,b)=>a-b);const q=p=>v[Math.min(v.length-1,Math.floor(p*v.length))];
   return {n:all.length,inBand:1,avg:+(v.reduce((a,b)=>a+b,0)/v.length).toFixed(2),
    q10:q(0.1),q90:q(0.9),min:v[0],max:v[v.length-1],alone:+(all.filter(c=>c.odds.partner==='alone').length/all.length).toFixed(2),
    spotlight:+(L.map(set=>new Set(set.map(c=>c.odds.who)).size/Math.min(3,set.length)).reduce((a,b)=>a+b,0)/L.length).toFixed(2),
    allPass:+(L.map(set=>set.reduce((p,c)=>p*c.odds.okPlus,1)).reduce((a,b)=>a+b,0)/L.length).toFixed(2)}};
  out[tier]={band,new:sum(S.new),old:sum(S.old)}}
 return out}
module.exports={BAND,partyInfo,roller,odds,pickTarget,make,makeOld,review,STATS};
