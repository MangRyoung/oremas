/* 커스텀 포켓몬 프라이드 계산 — 제작기 js/maker.js customCalc 를 그대로 옮긴 것 (PRIDE_DEF 기본값, 10-27 판: toDown 25).
   계산 종족치 = 실제 합 + 하한분(공격 · 특공 · 스피드) + 내구 할증 + HP 할증 + 화력·스피드 할증 − 쌍두 할인 + 특성 TO 조정 → 담을 수 있는 가장 낮은 계단.
   다루지 않는 것: 선공 하한(우선도 기술 · 특성 · 포텐셜) — 야생 DB 는 선공기를 넣지 않는다. 특성 소켓은 기본 TO(조정 0). */
"use strict";
const DEF={rows:[['C',1,480,40,1],['C+',1.5,503,43,1],['B',2,525,45,1],['B+',2.5,548,48,1],['A',3,570,50,1.5]],
 opp:0.4,absMin:31,realMin:400,bulk:{lo:85,hi:105,k1:0.5,k2:0.75},hp:{lo:95,hi:120,k1:0.5,k2:0.75},fs:{lo:105,hi:120,k1:0.5,k2:1,slo:90,shi:140},dual:{lo:90,hi:120,k:1}};
const two=(x,o)=>o.k1*Math.max(0,Math.min(x,o.hi)-o.lo)+o.k2*Math.max(0,x-o.hi);
const STEPS=DEF.rows.map(r=>({lab:r[0],pt:r[1],v:r[2],floor:r[3],to:r[4]}));
/* b = [HP, 공, 방, 특공, 특방, 스], dual = 물리기 · 특수기를 둘 다 가졌나 */
function calc(b,dual){const real=b.reduce((a,c)=>a+c,0),main=Math.max(b[1],b[3]);
 const bulk=two(Math.min(b[2],b[4]),DEF.bulk),hp=two(b[0],DEF.hp),F=DEF.fs;
 const fs=two(main,F)*Math.max(0,Math.min(1,(Math.min(b[5],F.shi)-F.slo)/(F.shi-F.slo)));
 const D=DEF.dual,dualRaw=D.k*Math.max(0,Math.min(Math.min(b[1],b[3]),D.hi)-D.lo),dv=dual?dualRaw:0,opp=Math.round(main*DEF.opp);
 let last=null;for(const st of STEPS){const fa=Math.max(0,Math.max(st.floor,b[1]<main?opp:0)-b[1]),fc=Math.max(0,Math.max(st.floor,b[3]<main?opp:0)-b[3]),fsp=Math.max(0,st.floor-b[5]);
  const ct=real+fa+fc+fsp+bulk+hp+fs-dv;last={real,ct,step:st.lab,ok:ct<=st.v+1e-9,parts:{floor:fa+fc+fsp,bulk,hp,fs,dual:dv}};if(last.ok)return last}
 return Object.assign(last,{step:'EX',ok:false})}
/* 제작 조건: 실제 합 400 이상 · HP · 방어 · 특방 31 이상 */
const legal=b=>b.reduce((a,c)=>a+c,0)>=DEF.realMin&&[0,2,4].every(i=>b[i]>=DEF.absMin)&&b.every(x=>x>=1&&x<=255);
module.exports={DEF,STEPS,calc,legal};
