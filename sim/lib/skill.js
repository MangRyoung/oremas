/* 스킬 체크 v4 — 룰북 「스킬 체크」 장 · 오레마스 js/skill_ui.js 와 같은 규칙을 순수 함수로 (10-29 망령 「다 뜯어 고치자」).
   2d6 + 트레이너 자질(D 0 · C 1 · B 2 · A 3 · AA 4) + 포켓몬 종족값 랭크(59 이하 0 · 60 1 · 90 2 · 110 3 · 140 4) + 적합(최대 +3) ± 보정 ≥ 목표치
   목표치 쉬움 8 · 보통 10 · 어려움 12 · 매우 어려움 15. 1·1 은 언제나 실패, 6·6 은 언제나 대성공, 목표 + crit(기본 4) 이상도 대성공.
   두 번 굴리기: 2d6 을 두 번, 합이 높은(1)/낮은(−1) 쪽. 부상 = 판정 −1 (육성 A 이상 강인함은 무시) · 중상 = 불리(두 번 굴리기 한 칸 아래).
   초상 능력(능력 A 이상, 휴식 사이 A 1 · AA 2): 포켓몬 없이 2d6 + 자질 × 2.
   결과 번호는 예전 다섯 칸을 그대로 쓴다: 1 실패 · 3 성공 · 4 대성공 (0 대실패 · 2 대가는 이제 나오지 않는다 — 보고서 칸 호환) */
"use strict";
const LAD={E:0,D:0,C:1,B:2,A:3,AA:4,AAA:4,S:4};
const RES=['대실패','실패','대가를 치르고 성공','성공','대성공'];
const TIER={easy:8,normal:10,hard:12,vhard:15};
const BASE=['HP','공격','방어','특공','특방','스피드'];
const BASE_OF={지시:3,육성:1,통솔:4,능력:3};
const strip=s=>String(s||'').replace(/[+\-]/g,'').trim();
const lv=r=>LAD[strip(r)]??0;
const baseLv=v=>{v=+v||0;return v>=140?4:v>=110?3:v>=90?2:v>=60?1:0};
/* 예전(v3) 체크를 v4 로: 목표 5 · 7 · 9 · 11 → 8 · 10 · 12 · 15, 주사위 단계 → ±1, 타입 조건(hint) → 적합 타입 */
function up(ck){ck=Object.assign({},ck||{});if(+ck.v>=4)return ck;const T3={5:8,7:10,9:12,11:15};ck.target=T3[+ck.target]||(+ck.target||7)+3;ck.pm=+ck.step?(+ck.step>0?1:-1):0;delete ck.step;
 if(ck.base==null)ck.base=BASE_OF[ck.stat]??3;if(!ck.fit){const h=String(ck.hint||'');ck.fit={types:h.startsWith('type:')?[h.slice(5)]:[],moves:[],abil:[]}}if(ck.pen&&ck.pen.cost)ck.pen=Object.assign({},ck.pen,{cost:undefined});ck.v=4;return ck}
/* 보정 합. q:{rank 트레이너 자질, mon 종족값 랭크(0~4, 혼자면 null), fit 0~3, pm, inj 0~3, tough, super, bonus} */
function modOf(q){const t=lv(q.rank);if(q.super)return t*2+(+q.pm||0)+injMod(q);return t+(q.mon==null?0:+q.mon)+(q.mon==null?0:Math.min(3,+q.fit||0))+(+q.pm||0)+(+q.bonus||0)+injMod(q)}
const injMod=q=>+q.inj===1&&!q.tough?-(q.injPen==null?1:+q.injPen):0;
const twOf=q=>{let tw=+q.twice||0;if(+q.inj===2)tw=Math.max(-1,tw-1);return tw};
function judge(a,b,total,target,crit){if(a===1&&b===1)return 1;if(a===6&&b===6)return 4;return total>=target+(crit==null?4:crit)?4:total>=target?3:1}
const d=(rng,n)=>1+Math.floor(rng()*n);
function roll2(rng,tw){const x=[d(rng,6),d(rng,6)];if(!tw)return x;const y=[d(rng,6),d(rng,6)];const sx=x[0]+x[1],sy=y[0]+y[1];return tw>0?(sx>=sy?x:y):(sx<=sy?x:y)}
/* 한 번 굴린다. q 에 target · crit · myosu(남은 묘수 — 실패면 한 번 다시) → {ri, res, total, a, p(두 눈), mod, myosuUsed, fumble, crit66} */
function roll(q,rng){rng=rng||Math.random;const mod=modOf(q),tw=twOf(q);const out={ri:1,res:'',mod,tw,a:0,p:0,total:0,myosuUsed:0,fumble:false,stubborn:false,die:{sides:6},pdie:6};
 const go=()=>{const k=roll2(rng,tw);out.a=k[0];out.p=k[1];out.total=k[0]+k[1]+mod;out.fumble=k[0]===1&&k[1]===1;out.ri=judge(k[0],k[1],out.total,+q.target,q.crit)};
 go();if(q.myosu>0&&out.ri===1){out.myosuUsed=1;go()}
 out.res=RES[out.ri];return out}
/* 정확한 확률 (열거) → [0, 실패, 0, 성공(대성공 빼고), 대성공] */
const PAIRS=[];for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)PAIRS.push([a,b]);
function dist(q){const mod=modOf(q),tw=twOf(q);const out=[0,0,0,0,0];let n=0;const add=k=>{out[judge(k[0],k[1],k[0]+k[1]+mod,+q.target,q.crit)]++;n++};
 if(!tw)PAIRS.forEach(add);else for(const x of PAIRS)for(const y of PAIRS){const sx=x[0]+x[1],sy=y[0]+y[1];add(tw>0?(sx>=sy?x:y):(sx<=sy?x:y))}
 return out.map(v=>v/n)}
const pct=x=>Math.round(x*100);
function summary(q){const o=dist(q);return {fail:pct(o[1]),cost:0,ok:pct(o[3]+o[4]),okPlus:pct(o[3]+o[4]),crit:pct(o[4]),fumble:0}}
/* 포켓몬 m 이 체크 ck 에 얼마나 맞나 → {mon 종족값 랭크, fit, why[]} (m.types 영문 · m.typesKo 한글 둘 다 본다) */
const TYPE_KO={노말:'Normal',불꽃:'Fire',물:'Water',전기:'Electric',풀:'Grass',얼음:'Ice',격투:'Fighting',독:'Poison',땅:'Ground',비행:'Flying',에스퍼:'Psychic',벌레:'Bug',바위:'Rock',고스트:'Ghost',드래곤:'Dragon',악:'Dark',강철:'Steel',페어리:'Fairy'};
function monFit(m,ck){ck=up(ck);const F=ck.fit||{};const why=[];const ty=new Set([...(m.typesKo||[]),...(m.types||[])]);
 if((F.types||[]).some(t=>ty.has(t)||ty.has(TYPE_KO[t])))why.push('타입');
 const mv=(m.moves||[]).map(x=>typeof x==='string'?x:x&&x.name);if((F.moves||[]).some(x=>mv.includes(x))||(F.abil||[]).includes(m.ability))why.push('기술 · 특성');
 return {mon:baseLv(((m.base||[])[ck.base])),fit:why.length,why}}
module.exports={LAD,RES,TIER,BASE,TYPE_KO,lv,strip,baseLv,up,modOf,judge,roll,dist,summary,monFit};
