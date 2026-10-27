/* 생성기 맞추기 — 난이도 × 손잡이 묶음마다 「던전 g개 × 3인 조합 t개 × n판」을 돌려 승률(전멸 안 함)을 잰다.
   결과는 records/private/calib_<id>.json (조합 · 던전마다 값 포함). 명령: node bin/sim.js calib --tier easy --grid lv=-10,-5,0;battles=1,2 --g 8 --t 12 --n 10 */
"use strict";
const D=require('./dungeon.js'),G=require('./gen.js'),BT=require('./battle.js');
function trios(pool,k,seed){const all=[];const rec=(s,c)=>{if(c.length===3){all.push(c.slice());return}for(let i=s;i<pool.length;i++){c.push(pool[i]);rec(i+1,c);c.pop()}};rec(0,[]);
 if(!k||k>=all.length)return all;const rng=BT.mkRng(seed||7);for(let i=all.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[all[i],all[j]]=[all[j],all[i]]}return all.slice(0,k)}
async function evalCfg(W,built,wf,tier,knobs,o){const g=o.g||8,n=o.n||10;const TR=o.trios;let runs=0,wins=0;const perD=[],perT={};const ck={n:0,ok:0,cost:0,fail:0,cover:0,inj:0,alone:0};const byDebt={},byAl={};let lock=0,alSum=0;let bossReach=0,bossWin=0,bossTurns=0,phases=0,endHp=0,preHp=0;
 for(let s=1;s<=g;s++){const dg=G.make(tier,knobs,(o.seed0||100)+s);let dw=0,dn=0;
  for(const c of TR){const parties=c.map(x=>built[x]);let tw=0;
   for(let i=0;i<n;i++){const r=await D.run(W,dg,parties,{seed:s*1000+i+1,wildFrom:wf,adjust:o.adjust});runs++;dn++;if(!r.wipe){wins++;dw++;tw++}const ak=r.alert>=100?'100':r.alert>=70?'70+':r.alert>=30?'30+':'0+';const ba=byAl[ak]=byAl[ak]||{n:0,w:0};ba.n++;if(!r.wipe)ba.w++;if(r.lockdown)lock++;alSum+=r.alert||0;const dk=r.bossLvDebt||0;const bd=byDebt[dk]=byDebt[dk]||{n:0,w:0};bd.n++;if(!r.wipe)bd.w++;
    ck.n+=r.checks.n;ck.ok+=r.checks.ok;ck.cost+=r.checks.cost;ck.fail+=r.checks.fail;ck.cover+=r.checks.covers;ck.alone+=r.checks.alone;ck.inj+=r.injuryEvents;endHp+=r.endHpAvg;
    if(r.bossBattle){bossReach++;if(r.bossBattle.win)bossWin++;bossTurns+=r.bossBattle.turns;phases+=r.bossBattle.phases}}
   const key=c.join(',');perT[key]=(perT[key]||0)+tw}
  perD.push({seed:(o.seed0||100)+s,boss:dg.gen.boss,win:dw/dn})}
 const tw=Object.values(perT).map(v=>v/(g*n)).sort((a,b)=>a-b);const q=p=>tw[Math.min(tw.length-1,Math.floor(p*tw.length))];
 return {tier,knobs,runs,win:wins/runs,trioWin:{min:tw[0],q25:q(0.25),med:q(0.5),q75:q(0.75),max:tw[tw.length-1]},perD,
  checks:{per:ck.n/runs,ok:ck.ok/Math.max(1,ck.n),cost:ck.cost/Math.max(1,ck.n),fail:ck.fail/Math.max(1,ck.n),alone:ck.alone/Math.max(1,ck.n),cover:ck.cover/runs,inj:ck.inj/runs},
  byDebt,byAl,lockdown:lock/runs,alertAvg:alSum/runs,boss:{reach:bossReach/runs,win:bossWin/Math.max(1,bossReach),turns:bossTurns/Math.max(1,bossReach),phases:phases/Math.max(1,bossReach)},endHp:endHp/runs}}
function grid(spec){/* "lv=-10,-5,0;battles=1,2" → [{lv:-10,battles:1},…] */const ks=[];for(const part of String(spec||'').split(';')){if(!part.trim())continue;const [k,v]=part.split('=');ks.push([k.trim(),v.split(',').map(x=>isNaN(+x)?x.trim():+x)])}
 let out=[{}];for(const [k,vs] of ks){const nx=[];for(const o of out)for(const v of vs)nx.push(Object.assign({},o,{[k]:v}));out=nx}return out}
/* 자동 생성 검증: generate() 로 뽑은 던전(규칙값 dg.rules 포함)을 그대로 돌린다 */
async function evalAuto(W,built,wf,tier,o){const AG=require('./autogen.js');const g=o.g||12,n=o.n||10;let runs=0,wins=0,al30=0,al70=0,lock=0;const perT={},perD=[];
 for(let s=1;s<=g;s++){const dg=AG.generate({tier,seed:(o.seed0||900)+s,knobs:o.knobs,theme:o.theme,grades:o.grades});let dw=0,dn=0;
  for(const c of o.trios){let tw=0;for(let i=0;i<n;i++){const r=await D.run(W,dg,c.map(x=>built[x]),{seed:s*1000+i+1,wildFrom:wf});runs++;dn++;if(!r.wipe){wins++;dw++;tw++}if(r.alert>=30)al30++;if(r.alert>=70)al70++;if(r.lockdown)lock++}perT[c.join(',')]=(perT[c.join(',')]||0)+tw}
  perD.push({seed:dg.gen.seed,name:dg.name,battles:dg.gen.knobs.battles,boss:dg.gen.boss,win:dw/dn})}
 const tw=Object.values(perT).map(v=>v/(g*n)).sort((a,b)=>a-b);
 return {tier,runs,win:wins/runs,al30:al30/runs,al70:al70/runs,lockdown:lock/runs,trioWin:{min:tw[0],med:tw[Math.floor(tw.length/2)],max:tw[tw.length-1]},perD}}
module.exports={evalCfg,evalAuto,grid,trios};
