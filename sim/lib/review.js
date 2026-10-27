/* 야생몬 검토 — 만든 뒤 「실전성」을 시뮬 엔진으로 재 보고, 엉망인 것을 다시 만든다 (10-27 밤 망령 「만들어보고 콘셉트나 실전성도 어느 정도 로직 첨부 · 제작 후 검토하고 개선을 몇 차례」).
   1) 정적 검토 flags: 공격 칸이 둘 다 낮음 · 스위퍼인데 느림 · 자속 기술 없음 · 특성이 타입 · 역할과 무관 · 타입 짝이 표 밖 · 이름 중복 …
   2) 실전 검토: 같은 묶음(C / B / A)의 표본 상대와 1 : 1 약식 배틀(엔진 그대로, 기술은 automove) N 판 → 승률 wr. 묶음 안에서 0.25 미만 = 「약함」, 0.78 초과 = 「과강」.
   3) 개선: 약함 · 과강 · 자속 없음은 같은 조건(계단 · 역할형 · 타입)으로 다시 만들어 재검토, 최대 rounds 회. 그래도 남으면 flags 에 남긴다(기록용). */
"use strict";
const BT=require('./battle.js');
const LOW=0.25,HIGH=0.78;
function staticFlags(e,M){const F=[];const b=e.base||[];const main=Math.max(b[1],b[3]);
 if(main<(/탱커|벽/.test(e.kind)?72:85))F.push('공격 둘 다 낮음');
 if(/스위퍼/.test(e.kind)&&b[5]<95)F.push('스위퍼인데 느림');
 if(/탱커|벽/.test(e.kind)&&Math.min(b[2],b[4])<70&&b[0]<95)F.push('탱커인데 물렁');
 if(e.types[1]&&M&&M.PAIR&&!(M.PAIR[e.types[0]]||[]).includes(e.types[1])&&!(M.PAIR[e.types[1]]||[]).includes(e.types[0]))F.push('타입 짝 어색');
 return F}
/* 1:1 승률 — opp: 상대 항목 배열, n 판 */
function duel(W,WB,e,opp,n,seed){let w=0,t=0;const rng=BT.mkRng(seed||1);const A=WB.buildEntry(W,e,{});
 if(!A.mon.moves||!A.mon.moves.length||A.mon.moves.every(m=>m.name==='발버둥'))return {wr:0,noMoves:true};
 const SI=require('./automove.js').sockInfo(W,A.mon);
 for(let i=0;i<n;i++){const o=opp[i%opp.length];const B=WB.buildEntry(W,o,{});const r=BT.runBattleSync(W,{left:{parties:[{trainer:A.trainer,mons:[A.mon]}]},right:{trainer:B.trainer,mons:[B.mon]},seed:(seed||1)*131+i,format:1,maxTurns:20});if(r.winner==='left')w++;else if(r.winner!=='right')t++}
 return {wr:w/n,draw:t/n,stab:A.mon.moves.some(m=>e.types.includes(m.type)),sock:SI}}
/* 전체 검토 + 개선 루프. entries 를 제자리에서 고친다. 돌려주는 것: 요약 */
function reviewAll(W,WB,M,entries,o){o=o||{};const n=o.n||24,rounds=o.rounds==null?3:o.rounds;const rng=BT.mkRng(o.seed||9);const log=[];
 const byG={};for(const e of entries)(byG[e.grade]=byG[e.grade]||[]).push(e);
 const sample=g=>{const L=byG[g]||[];const out=[];for(let i=0;i<Math.min(8,L.length);i++)out.push(L[Math.floor(rng()*L.length)]);return out};
 const used=new Set(entries.map(e=>e.name));
 for(let round=0;round<=rounds;round++){let redo=0;const samp={C:sample('C'),B:sample('B'),A:sample('A')};
  for(const e of entries){if(e.origin!=='orig')continue;if(round>0&&!e._redo)continue;
   if(round>0&&WB.clearCache)WB.clearCache();const d=duel(W,WB,e,samp[e.grade].filter(x=>x!==e),n,100+round);const F=staticFlags(e,M);if(d.noMoves||d.stab===false)F.push('자속 기술 없음');if(d.sock){if(d.sock.n<4)F.push('기술 4개 미만');if(!d.sock.status)F.push('변화기 없음');if(d.sock.cap!=null&&d.sock.used>d.sock.cap)F.push(`소켓 초과 ${d.sock.used}/${d.sock.cap}`)}if(d.wr<LOW)F.push('약함');if(d.wr>HIGH)F.push('과강');
   e.review={wr:+d.wr.toFixed(2),flags:F,round};const bad=F.some(f=>/약함|과강|자속|낮음|느림|물렁|4개|변화기|소켓/.test(f));
   if(bad&&round<rounds){/* 같은 조건으로 다시 — 역할형은 유지, 약함이면 스위퍼 · 쌍두 쪽으로 한 번 더 기회 */const kind=F.includes('약함')&&rng()<0.5?(e.kind==='물리 탱커'?'물리 스위퍼':e.kind==='특수 벽'?'특수 스위퍼':e.kind):e.kind;
    used.delete(e.name);const m=M.one(rng,{step:e.pride,kind,types:e.types,hab:e.hab,used,W});if(m){const keep={id:e.id};for(const k of Object.keys(e))if(k!=='id')delete e[k];Object.assign(e,m,keep);e._redo=true;redo++}else used.add(e.name)}
   else delete e._redo}
  log.push({round,redo});if(!redo)break}
 for(const e of entries)delete e._redo;
 const wrs=entries.filter(e=>e.review).map(e=>e.review.wr);const flagged=entries.filter(e=>e.review&&e.review.flags.length);
 return {log,n,avgWr:wrs.length?+(wrs.reduce((a,b)=>a+b,0)/wrs.length).toFixed(2):0,flagged:flagged.length,flags:flagged.map(e=>e.name+': '+e.review.flags.join(' · '))}}
module.exports={staticFlags,duel,reviewAll,LOW,HIGH};
