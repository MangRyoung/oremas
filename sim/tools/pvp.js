/* 11-14 망령 「학생들끼리 포텐셜 잘 활용하면서 배틀을 돌리고 로그 분석 후 승률이 높아지게 지시 로직을 다듬어」
   학생(미사그 캠퍼스, 각성체 2체) 총당 PvP. node tools/pvp.js [--n 4] [--seed 1] [--only 이름,이름] [--log 이름:이름] [--polL 정책] [--polR 정책] [--out 파일]
   polL/polR: 한쪽만 새 지시 로직(opt.ai)으로 돌려 견주기 — ai=old|new */
"use strict";
const fs=require('fs'),path=require('path');const SIM=path.resolve(__dirname,'..');
const args=process.argv.slice(2);const opt={};for(let i=0;i<args.length;i++){const a=args[i];if(a.startsWith('--')){const k=a.slice(2);const v=args[i+1]&&!args[i+1].startsWith('--')?args[++i]:'1';opt[k]=v}}
const {load}=require('../lib/env.js');const W=load().win;const P=require('../lib/party.js');const BT=require('../lib/battle.js');
const snap=P.readSnap(opt.snap?path.resolve(opt.snap):path.join(SIM,'data','snapshot.json'));
const dOf=t=>(t.data&&t.data.data)||t.data||{};
function students(){const F=Object.fromEntries((snap.folders||[]).map(f=>[f.id,f.data||{}]));const root=id=>{let x=id,g=0,last=id;while(x&&F[x]&&g++<8){last=x;x=F[x].parent}return last};
 const out=[];for(const t of snap.trainers||[]){const d=dOf(t);if(root(d.folder)!=='misag-campus'||['misag-npc','vwnq43tc'].includes(d.folder)||/\(보스\)/.test(d.name||''))continue;
  let r;try{r=P.build(W,snap,t.id)}catch(e){continue}if(!r.trainer.two||r.mons.length<2)continue;if(r.mons.some(m=>!(m.moves||[]).some(mv=>+mv.pow>0)))continue;out.push({id:t.id,name:d.name})}
 return out}
const mk=id=>{const r=P.build(W,snap,id);P.orders(W,r.trainer,{mons:r.mons});return {trainer:r.trainer,mons:r.mons}};
(async()=>{let S=students();if(opt.only){const L=opt.only.split(',');S=S.filter(s=>L.some(n=>s.name.includes(n)))}
 const N=+opt.n||2,seed0=+opt.seed||1;const res={};for(const s of S)res[s.name]={w:0,l:0,d:0,g:0};const pairs=[];const asked={};let turns=0,games=0;const t0=Date.now();
 const sideAI={left:opt.polL||opt.ai||'',right:opt.polR||opt.ai||''};const sideW={left:0,right:0,draw:0};const used={order:0,command:0,pot:0};
 for(let i=0;i<S.length;i++)for(let j=0;j<S.length;j++){if(i===j)continue;if(!opt.both&&j<i&&!(opt.polL||opt.polR))continue;let w=0,l=0,d=0;
  for(let k=0;k<N;k++){const a=mk(S[i].id),b=mk(S[j].id);b.trainer.id=b.trainer.id===a.trainer.id?b.trainer.id+'_r':b.trainer.id;
   const wantLog=opt.log&&k===0&&opt.log.split(':').every((n,x)=>(x?S[j]:S[i]).name.includes(n));
   let r;try{r=await BT.runBattle(W,{left:a,right:b,seed:seed0+k*7919+i*131+j*17,format:2,log:!!wantLog||!!opt.stats,ai:sideAI,maxTurns:+opt.maxT||30})}catch(e){console.error('ERR',S[i].name,S[j].name,e.message.slice(0,200));continue}
   games++;turns+=r.turns;sideW[r.winner]++;if(r.winner==='left'){w++;res[S[i].name].w++;res[S[j].name].l++}else if(r.winner==='right'){l++;res[S[j].name].w++;res[S[i].name].l++}else{d++;res[S[i].name].d++;res[S[j].name].d++}res[S[i].name].g++;res[S[j].name].g++;
   for(const sd of ['left','right'])for(const t of Object.values(r.trainers[sd])){used.order+=t.used.order;used.command+=t.used.command}
   for(const q in r.asked||{})asked[q]=(asked[q]||0)+r.asked[q];
   if(opt.stats)for(const ln of r.log){const m=ln.match(/^【(포텐셜|고유|전용|계기|준비)】/);if(m)used.pot++}
   if(wantLog)fs.writeFileSync(path.join(SIM,'records','pvp_log_'+S[i].name+'_'+S[j].name+'.txt'),r.log.join('\n'))}
  pairs.push([S[i].name,S[j].name,w,l,d])}
 const rows=Object.entries(res).map(([n,r])=>({n,rate:r.g?r.w/r.g:0,...r})).sort((a,b)=>b.rate-a.rate);
 console.log(`학생 ${S.length}명 · ${games}판 · 평균 ${(turns/Math.max(1,games)).toFixed(1)}턴 · ${((Date.now()-t0)/1000).toFixed(0)}초 · 왼 ${sideW.left} 오 ${sideW.right} 무 ${sideW.draw} · 4식 ${used.order} 6령 ${used.command}${opt.stats?' 포텐셜 줄 '+used.pot:''}`);
 if(!opt.quiet)for(const r of rows)console.log(`${(r.rate*100).toFixed(0).padStart(3)}%  ${r.w}-${r.l}-${r.d}  ${r.n}`);
 if(opt.out)fs.writeFileSync(path.resolve(opt.out),JSON.stringify({at:new Date().toISOString(),n:N,games,sideW,rows,pairs,asked},null,1));
 if(opt.asked){const L=Object.entries(asked).sort((a,b)=>b[1]-a[1]).slice(0,+opt.asked||30);for(const [q,c] of L)console.log(c,q)}
})().catch(e=>{console.error(e);process.exit(1)});
