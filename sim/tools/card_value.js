/* 11-05 감우: 은열쇠 시작 카드 24장 — 카드 하나씩 값 재기 (같은 씨앗 짝 비교).
   일행에 그 카드 1장만 vs 카드 0장(slot24 only=none), 던전 · 시험 일행 · 씨앗이 모두 같아 카드가 바꾼 판만 차이가 난다.
   node tools/card_value.js [--dungeon md2_sea,md4_cave] [--t 15] [--vn 2] [--out 파일] */
'use strict';
const fs=require('fs'),path=require('path');const SIM=path.resolve(__dirname,'..');
const opt={};for(let i=2;i<process.argv.length;i++){const a=process.argv[i];if(a.startsWith('--')){const k=a.slice(2);const v=process.argv[i+1]&&!process.argv[i+1].startsWith('--')?process.argv[++i]:true;opt[k]=v}}
(async()=>{const {load}=require('../lib/env.js');const W=load().win;const P=require('../lib/party.js');const C=require('../lib/calib.js'),D=require('../lib/dungeon.js');
 const snap=P.readSnap(path.join(SIM,'data','snapshot.json'));const all=D.dungeons();const ids=String(opt.dungeon||'md2_sea,md4_cave,md5_house,md6_ruin').split(',');
 const pool=P.testPool(snap);const built={};for(const s of pool)built[s]=P.pick(W,snap,s)[0];const wf=P.wildFrom(W,snap);
 const trios=C.trios(pool,+opt.t||15,+opt.tseed||11,+opt.size||3);const vn=+opt.vn||2;
 const KEYS=opt.keys?['none',...String(opt.keys).split(',')]:['none',...Object.keys(D.CARD).filter(k=>/^[sdb]_/.test(k))];const res={};const T0=Date.now();
 for(const key of KEYS){let n=0,w=0,use=0,ck=0,ok=0,inj=0,hp=0;
  for(const id of ids){const dg=all[id];let k=0;for(const c of trios)for(let i=0;i<vn;i++){const r=await D.run(W,dg,c.map(x=>built[x]),{seed:991000+k+1,wildFrom:wf,cards:'slot24',adjust:Object.assign({only:key},opt.adjust?Object.fromEntries(String(opt.adjust).split(',').map(x=>x.split('=')).map(([k,v])=>[k,isNaN(+v)?v:+v])):{})});k++;n++;if(!r.wipe)w++;use+=Object.values((r.cards||{}).use||{}).reduce((a,b)=>a+b,0);ck+=r.checks.n;ok+=r.checks.ok;inj+=r.injuries.reduce((a,b)=>a+b,0);hp+=r.endHpAvg}}
  res[key]={name:key==='none'?'(카드 없음)':D.CARD[key].n,n,win:w/n,use:use/n,ok:ok/ck,inj:inj/n,hp:hp/n};const b=res.none;
  console.log(`${res[key].name}\t승률 ${(w/n*100).toFixed(1)}%${b&&key!=='none'?` (${w/n-b.win>=0?'+':''}${((w/n-b.win)*100).toFixed(1)})`:''} · 체크 ${(ok/ck*100).toFixed(1)}%${b&&key!=='none'?` (${((ok/ck-b.ok)*100).toFixed(1)})`:''} · 부상 ${(inj/n).toFixed(2)} · 끝 HP ${(hp/n*100).toFixed(0)}% · 사용 ${(use/n).toFixed(2)}/판`)}
 const out=opt.out||path.join(SIM,'records','card_value_'+new Date().toISOString().slice(0,10)+'.json');fs.writeFileSync(out,JSON.stringify({at:new Date().toISOString(),ids,trios:trios.length,vn,res},null,1));console.log('저장:',out,((Date.now()-T0)/1000).toFixed(0)+'초')})();
