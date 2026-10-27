/* 스킬 체크 — 룰북 「스킬 체크」 장(v3) · 오레마스 js/skill_ui.js 와 같은 규칙을 순수 함수로.
   자질 주사위 D d4 · C d6 · B d8 · A d10 · AA d12 (단계 ±1 보정, d4 아래 = 굴리지 않고 실패, d12 위 = d12+n)
   동료 주사위 포켓몬 d6 · 『유대』 포켓몬과 통솔 판정 d8 · 혼자 d4 · 이능(능력 A 이상) = 자기 능력 주사위 하나 더
   두 번 굴리기(자질 주사위만) 높은/낮은 값 · 부상 −1단계 · 중상 −2단계(이능은 두 주사위 모두)
   결과 0 대실패(두 주사위 모두 1 · A 이상 자질은 실패) · 1 실패(3 이상 모자람) · 2 대가를 치르고 성공(1~2 모자람) · 3 성공 · 4 대성공(+5 이상)
   커버: 결과 한 칸 올림(최대 성공) · 커버한 사람 부상. 프라이드 A 고집: 동료 주사위 1 이면 대가 하나 더. 묘수(지시 A 1 · AA 2): 주사위 하나 다시 */
"use strict";
const LAD={E:0,D:0,C:1,B:2,A:3,AA:4,AAA:4,S:4};const SIDES=[4,6,8,10,12];
const RES=['대실패','실패','대가를 치르고 성공','성공','대성공'];
const strip=s=>String(s||'').replace(/[+\-]/g,'').trim();
const lv=r=>LAD[strip(r)]??0;
const sign=r=>/\+$/.test(String(r||''))?1:/-$/.test(String(r||''))?-1:0;   /* C+ · B- 같은 보조 표기: 주사위에 ±1 */
/* 자질 주사위. o:{step 단계 보정, inj 0|1|2} → {sides, plus, autofail, idx} */
function dieOf(rank,o){o=o||{};let idx=lv(rank)+(+o.step||0)-(o.inj>=2?2:o.inj>=1?1:0);const autofail=idx<0;let plus=sign(rank);if(idx>4){plus+=idx-4;idx=4}idx=Math.max(0,Math.min(4,idx));return {sides:SIDES[idx],plus,autofail,idx}}
/* 동료 주사위. partner: 'mon' d6 | 'bond' d8(『유대』+통솔) | 'alone' d4 | 'inou' 능력 주사위 하나 더 */
function partnerDie(partner,abilDie){return partner==='inou'?abilDie:partner==='bond'?8:partner==='alone'?4:6}
function judge(total,target,fumble,aLv){const diff=total-target;let ri=1;if(diff>=-2)ri=2;if(diff>=0)ri=3;if(diff>=5)ri=4;if(fumble)ri=aLv>=3?1:0;return ri}
const d=(rng,n)=>1+Math.floor(rng()*n);
/* 한 번 굴린다. q:{rank, target, partner, step, twice(1 높은 값 · -1 낮은 값 · 0), inj, prideA(동료가 프라이드 A · 유대 없음), myosu(남은 묘수 수 — 실패면 하나 다시 굴린다)}
   → {ri, res, total, a(자질 눈), p(동료 눈), die, pdie, autofail, fumble, stubborn(고집 대가), myosuUsed, rerolls} */
function roll(q,rng){rng=rng||Math.random;const D=dieOf(q.rank,q);const aLv=lv(q.rank);const out={ri:1,res:'',die:D,autofail:D.autofail,fumble:false,stubborn:false,myosuUsed:0,a:0,p:0,total:0,pdie:0};
 if(D.autofail){out.res=RES[1];return out}
 const pd=partnerDie(q.partner,D.sides);out.pdie=pd;
 const rollA=()=>{let a=d(rng,D.sides);if(q.twice>0)a=Math.max(a,d(rng,D.sides));else if(q.twice<0)a=Math.min(a,d(rng,D.sides));return a};
 let a=rollA(),p=d(rng,pd);
 const fin=()=>{out.a=a;out.p=p;out.total=a+D.plus+p;out.fumble=(a===1&&p===1);out.ri=judge(out.total,q.target,out.fumble,aLv)};
 fin();
 /* 묘수: 지시 판정이 성공 미만이면 더 작은 주사위 하나를 다시 (단순 정책) */
 if(q.myosu>0&&out.ri<3){if(a<=p)a=rollA();else p=d(rng,pd);out.myosuUsed=1;fin()}
 if(q.prideA&&p===1)out.stubborn=true;
 out.res=RES[out.ri];return out}
/* 정확한 확률 (열거). 돌려주는 값: [대실패,실패,대가,성공,대성공] 비율 */
function dist(q){const D=dieOf(q.rank,q);const aLv=lv(q.rank);const out=[0,0,0,0,0];if(D.autofail){out[1]=1;return out}
 const pd=partnerDie(q.partner,D.sides);const n=D.sides;
 /* 자질 주사위 분포 (두 번 굴리기 반영) */
 const pa=[];for(let v=1;v<=n;v++){let p;if(q.twice>0)p=(v*v-(v-1)*(v-1))/(n*n);else if(q.twice<0)p=((n-v+1)**2-(n-v)**2)/(n*n);else p=1/n;pa.push([v,p])}
 for(const [a,pA] of pa)for(let p=1;p<=pd;p++){const ri=judge(a+D.plus+p,q.target,a===1&&p===1,aLv);out[ri]+=pA/pd}
 return out}
const pct=(x)=>Math.round(x*100);
function summary(q){const o=dist(q);return {fail:pct(o[0]+o[1]),cost:pct(o[2]),ok:pct(o[3]+o[4]),okPlus:pct(o[2]+o[3]+o[4]),crit:pct(o[4]),fumble:pct(o[0])}}
module.exports={LAD,SIDES,RES,lv,strip,dieOf,partnerDie,judge,roll,dist,summary};
