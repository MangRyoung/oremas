/* 스킬 체크 생성기 (10-28 망령 「스킬 체크 생성기도 로직을 짜고 검토」).
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
const BAND={easy:[0.85,0.95],normal:[0.70,0.85],hard:[0.50,0.70]};
const TYPE_KO={노말:'Normal',불꽃:'Fire',물:'Water',전기:'Electric',풀:'Grass',얼음:'Ice',격투:'Fighting',독:'Poison',땅:'Ground',비행:'Flying',에스퍼:'Psychic',벌레:'Bug',바위:'Rock',고스트:'Ghost',드래곤:'Dragon',악:'Dark',강철:'Steel',페어리:'Fairy'};
const bondOf=m=>[...(m.pots||[]),m.excl,...(m.exclX||[])].some(p=>p&&/유대/.test(p.name||''));
/* 일행 읽기: parties=[{trainer, mons}] → [{name, ranks, types:Set(영문), bond}] — 동행 wn 체(파트너 먼저, dungeon.makeParty 와 같다) */
function partyInfo(parties,wn){wn=wn||2;return parties.map(p=>{const ms=p.mons.slice().sort((a,b)=>(b.partner?1:0)-(a.partner?1:0)).slice(0,wn);
 return {name:p.trainer.name,ranks:p.trainer.ranks||{},types:new Set(ms.flatMap(m=>m.types||[])),bond:ms.some(bondOf)}})}
/* 이 체크를 누가 어떤 주사위로 굴리나 (dungeon.js doCheck 와 같은 고르기: 자질 주사위가 가장 큰 사람) */
function roller(info,stat,hint){let best=null;
 for(const P of info){const rank=P.ranks[stat]||'C';const D=SK.dieOf(rank,{});const score=D.autofail?-9:D.idx;if(best&&score<=best.score)continue;
  let partner='mon';if(hint&&hint!=='any'){const en=TYPE_KO[String(hint).split(':')[1]]||'';if(!P.types.has(en))partner='alone'}
  if(partner==='mon'&&stat==='통솔'&&P.bond)partner='bond';best={P,rank,partner,score}}
 return best}
const odds=(r,target)=>{const s=SK.summary({rank:r.rank,target,partner:r.partner});return {okPlus:s.okPlus/100,ok:s.ok/100,fail:s.fail/100}};
/* 목표치 고르기: 띠 안의 값들 중 띠 가운데에 가까울수록 자주. 띠 안이 없으면 가장 가까운 값 */
function pickTarget(rng,r,band){const mid=(band[0]+band[1])/2;const C=[];for(let t=4;t<=15;t++){const o=odds(r,t);C.push({t,o,d:Math.abs(o.okPlus-mid),inb:o.okPlus>=band[0]-1e-9&&o.okPlus<=band[1]+1e-9})}
 const IN=C.filter(c=>c.inb);if(!IN.length)return C.sort((a,b)=>a.d-b.d)[0];const w=IN.map(c=>1/(0.02+c.d));let x=rng()*w.reduce((a,b)=>a+b,0);for(let i=0;i<IN.length;i++){x-=w[i];if(x<=0)return IN[i]}return IN[IN.length-1]}
/* o = {tier, theme, n, hintTyped, alCost, alFail, seed | rng, wn, band} → 체크 배열 */
function make(parties,o){o=o||{};const tier=o.tier||'normal',band=o.band||BAND[tier];const rng=o.rng||BT.mkRng(o.seed||1);const pick=a=>a[Math.floor(rng()*a.length)];
 const AG=require('./autogen.js');const TH=AG.THEMES[o.theme]||null;const HT=(AG.HINT_T||{})[o.theme]||Object.keys(TYPE_KO);
 const info=o.info||partyInfo(parties,o.wn);const n=o.n||4,typedN=o.hintTyped==null?1:o.hintTyped;
 const typedAt=new Set();while(typedAt.size<Math.min(n,typedN))typedAt.add(Math.floor(rng()*n));
 const spot=Object.fromEntries(info.map(P=>[P.name,0])),usedStat={},usedLab=new Set();let last='';const out=[];
 for(let i=0;i<n;i++){
  /* 자질: 같은 자질 연달아 X → 그 자질의 굴릴 사람이 덜 나온 쪽 → 덜 쓴 자질 → 무작위 */
  const SL=o.stats&&o.stats.length?STATS.filter(s=>o.stats.includes(s)):STATS;const cand=(SL.length>1?SL.filter(s=>s!==last):SL).map(s=>({s,r:roller(info,s,'any'),k:rng()})).sort((a,b)=>(spot[a.r.P.name]-spot[b.r.P.name])||((usedStat[a.s]||0)-(usedStat[b.s]||0))||(a.k-b.k));
  const stat=cand[0].s;last=stat;usedStat[stat]=(usedStat[stat]||0)+1;
  /* 타입 조건: 일행에 있는 테마 타입 먼저 */
  let hint='any';if(typedAt.has(i)){const have=HT.filter(t=>info.some(P=>P.types.has(TYPE_KO[t])));hint='type:'+(have.length&&rng()<0.8?pick(have):pick(HT))}
  const r=roller(info,stat,hint);spot[r.P.name]++;const T=pickTarget(rng,r,band);
  const PN=G.penFor(stat,tier,rng,{alFail:o.alFail,alCost:o.alCost});   /* 10-28: 자질마다 숫자로 된 패널티 (gen.js PEN.num) */
  let label='';if(TH&&TH.chk&&TH.chk[stat]){const L=TH.chk[stat].filter(x=>!usedLab.has(x));label=pick(L.length?L:TH.chk[stat]);usedLab.add(label)}else label=stat+' 체크';
  const c={label,stat,target:T.t,hint,pen:PN,odds:{who:r.P.name,die:'d'+SK.dieOf(r.rank,{}).sides,partner:r.partner,okPlus:+T.o.okPlus.toFixed(2),ok:+T.o.ok.toFixed(2),fail:+T.o.fail.toFixed(2),inBand:T.inb}};
  if(stat==='능력'&&rng()<0.5)c.mode='inou';out.push(c)}
 return out}
/* 지금 방식(gen.js: 목표 7 · 9 번갈아, 자질 섞어 돌림, 타입 조건 무작위 10타입)을 같은 계산으로 — 비교용 */
function makeOld(parties,o){o=o||{};const rng=o.rng||BT.mkRng(o.seed||1);const info=o.info||partyInfo(parties,o.wn);const n=o.n||4;
 const TY=['물','풀','불꽃','전기','에스퍼','고스트','땅','비행','악','페어리'];const sts=STATS.slice().sort(()=>rng()-0.5);const typed=Math.floor(rng()*n);const out=[];
 for(let i=0;i<n;i++){const stat=sts[i%4];const hint=i===typed?'type:'+TY[Math.floor(rng()*TY.length)]:'any';const target=[7,9][i%2];const r=roller(info,stat,hint);const ob=odds(r,target);
  out.push({stat,target,hint,odds:{who:r.P.name,partner:r.partner,okPlus:+ob.okPlus.toFixed(2)}})}
 return out}
/* 검토: 조합(trios)마다 seeds 번 만들어 센다 → {띠 안 비율, 대가 포함 성공 평균 · 최소 · 최대, 혼자 d4 비율, 주인공 고루(한 묶음에서 굴린 사람 수 / 일행 수)} */
function review(built,trios,o){o=o||{};const out={};
 for(const tier of o.tiers||['easy','normal','hard']){const band=BAND[tier];const S={new:[],old:[]};
  for(const c of trios){const parties=c.map(x=>built[x]);const info=partyInfo(parties,o.wn);
   for(let s=1;s<=(o.seeds||10);s++){const th=o.theme||Object.keys(require('./autogen.js').THEMES)[s%8];
    S.new.push(make(parties,{tier,theme:th,n:o.n||4,seed:s*31+7,info}));S.old.push(makeOld(parties,{n:o.n||4,seed:s*31+7,info}))}}
  const sum=L=>{const all=L.flat();const v=all.map(c=>c.odds.okPlus).sort((a,b)=>a-b);const q=p=>v[Math.min(v.length-1,Math.floor(p*v.length))];
   return {n:all.length,inBand:+(all.filter(c=>c.odds.okPlus>=band[0]-1e-9&&c.odds.okPlus<=band[1]+1e-9).length/all.length).toFixed(2),avg:+(v.reduce((a,b)=>a+b,0)/v.length).toFixed(2),
    q10:q(0.1),q90:q(0.9),min:v[0],max:v[v.length-1],alone:+(all.filter(c=>c.odds.partner==='alone').length/all.length).toFixed(2),
    spotlight:+(L.map(set=>new Set(set.map(c=>c.odds.who)).size/Math.min(3,set.length)).reduce((a,b)=>a+b,0)/L.length).toFixed(2),
    allPass:+(L.map(set=>set.reduce((p,c)=>p*c.odds.okPlus,1)).reduce((a,b)=>a+b,0)/L.length).toFixed(2)}};
  out[tier]={band,new:sum(S.new),old:sum(S.old)}}
 return out}
module.exports={BAND,partyInfo,roller,odds,pickTarget,make,makeOld,review,STATS};
