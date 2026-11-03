#!/usr/bin/env node
/* 망켓몬 던전 · 스킬 체크 시뮬레이터 — 명령줄
   node bin/sim.js ui [--port 8470]              화면 (브라우저) — 일행 · 던전 · 설정 고르고 돌리기 · 던전 · 야생 편집 · 기록 · 피드백
   node bin/sim.js fetch                         제작기 공유 DB → data/snapshot.json (망령 PC 에서)
   node bin/sim.js list [--snap 파일]           스냅샷의 트레이너 목록
   node bin/sim.js check                         스킬 체크 성공률 표 (룰북 열지도와 같은 식)
   node bin/sim.js battle --party 카이 --wild factory_boss [--n 200] [--log] [--snap 파일]
   node bin/sim.js run --scenario data/scenarios/base.json [--n 1000]      시나리오대로 던전을 N 판 돌려 records/ 에 기록
   node bin/sim.js run --dungeon auto_normal_21202 --party 카이,미오,레온 [--n 500] [--seed 1] [--adjust target=2,penScale=0.5] [--policy cover=never]
   node bin/sim.js combos --pool 이름,이름,… --size 3 --dungeons a,b --n 100 [--id x --name 이름]   조합 훑기
   node bin/sim.js auto --tier easy|normal|hard [--theme 숲] [--seed N] [--name 이름] [--id 파일id] [--save] [--webtool 1] [--test 200 --party a,b,c]   던전 자동 생성(검증 루프 기본)
   node bin/sim.js recheck [--dungeon a,b] [--save]   저장된 던전을 검증 조건 그대로 다시 잰다
   node bin/sim.js recast --dungeon a,b [--seed 1] [--tries 4] [--vn 10] [--save]   던전 몹 배역만 다시(lib/cast.js — 중복 · 타입 쏠림 막기)
   node bin/sim.js gendb [--seed 27]                야생 DB 200체 (오리지널 150 생성 + 올드 50) → data/wild/db.json
   node bin/sim.js mon --step B --kind 쌍두 --types 물,독 --n 5   오리지널몬 한 줌 만들어 보기
   node bin/sim.js report                        records/*.summary.json → report/index.html · report.md
   --snap 를 안 주면 data/snapshot.json, 없으면 data/sample_snapshot.json (시험용 4명) */
"use strict";
const fs=require('fs'),path=require('path');
const SIM=path.resolve(__dirname,'..');
const KO=require('../lib/ko.js');
const args=process.argv.slice(2);const cmd=args[0]||'help';
const opt={};for(let i=1;i<args.length;i++){const a=args[i];if(a.startsWith('--')){const k=a.slice(2);const v=args[i+1]&&!args[i+1].startsWith('--')?args[++i]:'1';opt[k]=v}}
const kv=s=>{const o={};for(const p of String(s||'').split(',')){if(!p)continue;const [k,v]=p.split('=');o[k.trim()]=isNaN(+v)?v:+v}return o};
const snapFile=()=>opt.snap?path.resolve(opt.snap):fs.existsSync(path.join(SIM,'data','snapshot.json'))?path.join(SIM,'data','snapshot.json'):path.join(SIM,'data','sample_snapshot.json');
const stamp=()=>new Date().toISOString().replace(/[-:T]/g,'').slice(0,12);
(async()=>{
 if(cmd==='help'){console.log(fs.readFileSync(__filename,'utf8').split('*/')[0].replace(/^[^\n]*\n/,''));return}
 if(cmd==='fetch'){const F=require('../lib/fetch.js');const r=await F.fetchAll(path.join(SIM,'data','snapshot.json'));console.log(`받았다: 트레이너 ${r.trainers} · 포켓몬 ${r.pokemon} · 폴더 ${r.folders} → ${r.file}`);return}
 if(cmd==='ui'){require('../lib/server.js').start({port:+opt.port||8470,open:!opt.noopen});return}
 if(cmd==='check'){/* 10-29 v4: 트레이너 자질 × 포켓몬 종족값 랭크 → 목표 8 · 10 · 12 · 15 성공률 */const S=require('../lib/skill.js');const T=[8,10,12,15];
  for(const mon of [null,0,1,2,3,4]){console.log(`\n[${mon==null?'혼자':'포켓몬 종족값 '+['D 이하','C','B','A','AA'][mon]}]  성공 / 대성공 (%)`);console.log('자질\t'+T.map(t=>`목표 ${t}`).join('\t'));
   for(const r of ['D','C','B','A','AA']){console.log(r+'\t'+T.map(t=>{const s=S.summary({rank:r,mon,target:t});return `${s.ok}/${s.crit}`}).join('\t'))}}
  console.log('\n초상 능력: '+['A','AA'].map(r=>r+' '+T.map(t=>`목표 ${t} ${S.summary({rank:r,super:true,target:t}).ok}%`).join(' · ')).join(' / '));return}
 const {load}=require('../lib/env.js');const W=load().win;const P=require('../lib/party.js');
 if(cmd==='list'){const snap=P.readSnap(snapFile());if(!snap)return console.log('스냅샷이 없다 — fetch 먼저');console.log('스냅샷:',snapFile(),snap.at);for(const t of P.list(snap))console.log(`${t.folder||'(폴더 없음)'}/${t.name}\t${t.kind}\t지 ${t.ranks['지시']||'-'} 육 ${t.ranks['육성']||'-'} 통 ${t.ranks['통솔']||'-'} 능 ${t.ranks['능력']||'-'}\t${t.n}체${t.solo?' 1인':''}${t.priv?' 비공개':''}\tid:${t.id}`);return}
 const snap=P.readSnap(snapFile());if(!snap)return console.log('스냅샷이 없다 — fetch 먼저');
 /* 11-02 망령 「은열쇠(덱) 넣어서 테스트」: 검증 · autocheck · recheck 는 기본으로 은열쇠 기본 덱(base)을 켠다. --cards 0 이면 카드 없이(11-01 전과 같음) */const CARDS=opt.cards==null||opt.cards===true?'base':(['0','false','none',''].includes(String(opt.cards))?null:String(opt.cards));
 const pickParties=sel=>String(sel||'').split(',').map(s=>s.trim()).filter(Boolean).flatMap(s=>{const r=P.pick(W,snap,s);if(!r.length)throw new Error('트레이너 못 찾음: '+s+' (list 로 확인)');return r});
 if(cmd==='battle'){const WD=require('../lib/wild.js'),BT=require('../lib/battle.js');const parties=pickParties(opt.party).map(p=>{P.orders(W,p.trainer,{mons:p.mons});return {trainer:p.trainer,mons:p.mons.slice(0,+opt.wn||6)}});
  const pk=WD.packs()[opt.wild];if(!pk)throw new Error('야생 무리 없음: '+opt.wild+' (data/wild/)');const N=+opt.n||100;let w=0,T=0,hp=0;
  for(let i=0;i<N;i++){const r=await BT.runBattle(W,{left:{parties},right:WD.build(W,pk),seed:(+opt.seed||1)+i,format:+opt.format||(parties.reduce((a,p)=>a+p.mons.length,0)>=3?3:2),log:opt.log&&i===0});if(r.winner==='left')w++;T+=r.turns;hp+=r.left.reduce((a,m)=>a+m.hp/m.max,0)/r.left.length;if(opt.log&&i===0)console.log(r.log.join('\n')+'\n')}
  console.log(`${opt.party} vs ${pk.name}: 승률 ${(w/N*100).toFixed(0)}% · 평균 ${(T/N).toFixed(1)}턴 · 남은 HP ${(hp/N*100).toFixed(0)}% (${N}판)`);return}
 if(cmd==='run'){const D=require('../lib/dungeon.js'),R=require('../lib/report.js');let sc;
  if(opt.scenario){sc=JSON.parse(fs.readFileSync(path.resolve(opt.scenario),'utf8'))}else sc={id:opt.id||`${opt.dungeon}_${stamp()}`,dungeon:opt.dungeon,party:String(opt.party||'').split(','),n:+opt.n||300,seed:+opt.seed||1,adjust:kv(opt.adjust),policy:kv(opt.policy)};
  if(opt.n)sc.n=+opt.n;const dgs=D.dungeons();const variants=[];
  const sweep=sc.sweep||{};const keys=Object.keys(sweep);
  if(Array.isArray(sc.variants)&&sc.variants.length){/* 짝지은 변형 목록: [{id, name, adjust, policy}] (예: 보스방 4체 · 레이드 2 / 6체 · 레이드 3) */for(const v of sc.variants)variants.push({id:sc.id+'__'+v.id,name:(sc.name||sc.id)+' · '+(v.name||KO.describe(v.adjust,v.policy)),adjust:Object.assign({},sc.adjust||{},v.adjust||{}),policy:Object.assign({},sc.policy||{},v.policy||{})})}
  else if(!keys.length)variants.push({id:sc.id,adjust:sc.adjust||{},policy:sc.policy||{}});
  else{const POLK=['cover','who','partner','inou'];const split=cur=>{const a={},p={};for(const k in cur)(POLK.includes(k)?p:a)[k]=cur[k];return {a,p}};const rec=(i,cur)=>{if(i===keys.length){const {a,p}=split(cur);variants.push({id:sc.id+'__'+keys.map(k=>k+'='+cur[k]).join('_'),name:(sc.name||sc.id)+' · '+KO.describe(a,p,true),adjust:Object.assign({},sc.adjust||{},a),policy:Object.assign({},sc.policy||{},p)});return}for(const v of sweep[keys[i]])rec(i+1,Object.assign({},cur,{[keys[i]]:v}))};rec(0,{})}
  for(const dgId of [].concat(sc.dungeon)){const dg=dgs[dgId];if(!dg)throw new Error('던전 없음: '+dgId+' (data/dungeons/)');const parties=pickParties(sc.party.join(','));
   for(const v of variants){const id=([].concat(sc.dungeon).length>1?dgId+'_':'')+v.id;const rows=[];const t0=Date.now();
    const wf=P.wildFrom(W,snap);const priv=sc.private||P.isPrivate(parties,dg);
    for(let i=0;i<sc.n;i++)rows.push(await D.run(W,dg,parties,{seed:(sc.seed||1)+i,adjust:v.adjust,policy:v.policy,wildFrom:wf,wn:+sc.wn||undefined}));
    const RD=R.recDir(priv);fs.mkdirSync(RD,{recursive:true});const base=path.join(RD,id.replace(/[^\w가-힣=._-]/g,'_'));
    fs.writeFileSync(base+'.jsonl',rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
    const agg=R.aggregate(rows);fs.writeFileSync(base+'.summary.json',JSON.stringify({id,private:priv||undefined,name:(v.name||sc.name||sc.id)+(([].concat(sc.dungeon).length>1)?' · '+KO.dungeonName(dgId):''),dungeon:dgId,party:sc.party,n:sc.n,seed:sc.seed||1,adjust:v.adjust,policy:v.policy,at:new Date().toISOString(),snapshot:path.basename(snapFile()),agg},null,1));
    console.log(`${priv?'[비공개] ':''}${id}: ${sc.n}판 ${((Date.now()-t0)/1000).toFixed(1)}초 — 전멸 ${(agg.wipe*100).toFixed(0)}% · 끝 HP ${(agg.endHp*100).toFixed(0)}% · 체크 성공 ${(agg.ok*100).toFixed(0)}% 대가 ${(agg.cost*100).toFixed(0)}% 실패 ${(agg.fail*100).toFixed(0)}% · 부상자 있는 판 ${(agg.injAny*100).toFixed(0)}% · 커버 ${agg.covers.toFixed(2)}/판`)}}
  const rep=R.build();console.log('리포트:',rep.html);return}
 if(cmd==='combos'){/* 조합 훑기: --pool 후보(쉼표) 중 --size 명씩 모든 조합 × --dungeons 를 --n 판씩. 결과 = records/(private/)combos_<id>.json · .md */
  const D=require('../lib/dungeon.js'),R=require('../lib/report.js');const pool=String(opt.pool||'').split(',').map(x=>x.trim()).filter(Boolean);const size=+opt.size||3;const N=+opt.n||100;const dgs=D.dungeons();
  const dlist=String(opt.dungeons||Object.keys(dgs).join(',')).split(',').map(x=>x.trim()).filter(Boolean);for(const d of dlist)if(!dgs[d])throw new Error('던전 없음: '+d);
  const built={};for(const s of pool){const r=P.pick(W,snap,s);if(!r.length)throw new Error('트레이너 못 찾음: '+s);built[s]=r[0]}
  const combos=[];const rec=(st,cur)=>{if(cur.length===size){combos.push(cur.slice());return}for(let i=st;i<pool.length;i++){cur.push(pool[i]);rec(i+1,cur);cur.pop()}};rec(0,[]);
  const wf=P.wildFrom(W,snap);const out=[];const t0=Date.now();let priv=false;
  for(const [ci,c] of combos.entries()){const parties=c.map(s=>built[s]);const row={party:c,names:parties.map(p=>p.trainer.name),dungeons:{}};
   for(const d of dlist){if(P.isPrivate(parties,dgs[d]))priv=true;const rows=[];for(let i=0;i<N;i++)rows.push(await D.run(W,dgs[d],parties,{seed:(+opt.seed||1)+i,wildFrom:wf,adjust:kv(opt.adjust),policy:kv(opt.policy)}));const a=R.aggregate(rows);
    row.dungeons[d]={wipe:a.wipe,boss:a.boss,endHp:a.endHp,ok:a.ok,cost:a.cost,fail:a.fail,alone:a.alone,injAny:a.injAny,injSevere:a.injSevere,covers:a.covers,bkos:a.bkos,bturns:a.bturns,bossReach:a.bossReach,bossWin:a.bossWin,bossTurns:a.bossTurns,bossKos:a.bossKos,bossPhases:a.bossPhases}}
   out.push(row);if(ci%5===4||ci===combos.length-1)console.log(`${ci+1}/${combos.length} · ${((Date.now()-t0)/1000).toFixed(0)}초`)}
  const id=(opt.id||'combos_'+KO.stamp()).replace(/[^\w가-힣=._-]/g,'_');const RD=R.recDir(priv);fs.mkdirSync(RD,{recursive:true});
  fs.writeFileSync(path.join(RD,id+'.json'),JSON.stringify({id,name:opt.name||id,at:new Date().toISOString(),n:N,size,pool,dungeons:dlist,dungeonNames:dlist.map(d=>KO.dungeonName(d)),adjust:kv(opt.adjust),policy:kv(opt.policy),rows:out},null,1));
  console.log('저장:',path.join(RD,id+'.json'));return}
 if(cmd==='gen'){/* 던전 하나 무작위 생성 → data/dungeons/gen_<난이도>_<씨앗>.private.json */const G=require('../lib/gen.js');const dg=G.make(opt.tier||'normal',kv(opt.knobs),+opt.seed||1);const f=path.join(SIM,'data','dungeons',dg.id+'.private.json');if(opt.save)fs.writeFileSync(f,JSON.stringify(dg,null,1));console.log(JSON.stringify(dg,null,1).slice(0,+opt.max||4000));if(opt.save)console.log('저장:',f);return}
 if(cmd==='recheck'){/* 저장된 던전을 검증 루프와 같은 조건(시험 일행 20조합 × 3판)으로 다시 잰다: --dungeon a,b,c (비우면 auto_* 전부) [--save] → gen.verify 갱신 */
  const C=require('../lib/calib.js'),D=require('../lib/dungeon.js');const all=D.dungeons();const ids=opt.dungeon?String(opt.dungeon).split(','):Object.keys(all).filter(k=>/^auto_/.test(k));
  const pool=String(opt.pool||P.testPool(snap).join(',')).split(',');const built={};for(const s of pool)built[s]=P.pick(W,snap,s)[0];const wf=P.wildFrom(W,snap);
  for(const id of ids){const dg=all[id];if(!dg){console.log(id,'없음');continue}const tier=(dg.gen&&dg.gen.tier)||(id.match(/^auto_(easy|normal|hard)_/)||[])[1]||'normal';   /* 11-01: 난이도는 던전에 적힌 값(id 꼴에 기대지 않는다) */const wr=await C.quickWin(W,built,wf,dg,C.trios(pool,20,+opt.tseed||11),+opt.vn||3,777000,CARDS);const tg=C.TGT[tier];const old=(dg.gen||{}).verify;
   console.log(`${id} ${dg.name}: ${(wr*100).toFixed(0)}% (목표 ${tg*100}±15${old?` · 전 ${(old.wr*100).toFixed(0)}%`:''})${Math.abs(wr-tg)<=0.15?'':' — 범위 밖'}`);
   if(opt.save){const f=[id+'.json',id+'.private.json'].map(x=>path.join(SIM,'data','dungeons',x)).find(x=>fs.existsSync(x));if(f){const j=JSON.parse(fs.readFileSync(f,'utf8'));j.gen=Object.assign({},j.gen,{verify:Object.assign({},j.gen&&j.gen.verify,{wr:+wr.toFixed(2),target:tg,band:0.15,ok:Math.abs(wr-tg)<=0.15,at:new Date().toISOString().slice(0,10)})});fs.writeFileSync(f,JSON.stringify(j,null,1))}}}return}
 if(cmd==='recast'){/* 11-03 망령 「몬스터 로직 다시」: 저장된 던전의 몹 배역만 lib/cast.js 로 다시 채운다(방 · 체크 · 보스는 그대로). 다른 던전 몹은 피한다.
   --dungeon a,b (필수) --seed N(기본 1) --tries 4 --vn 10 [--save] → 검증(시험 일행 20조합 × vn판)이 목표 ±15 안인 첫 배역(없으면 가장 가까운 것)을 저장 */
  const C=require('../lib/calib.js'),D=require('../lib/dungeon.js'),CA=require('../lib/cast.js'),WB=require('../lib/wilddb.js'),BT=require('../lib/battle.js');const allW=WB.fullV2();const nm=Object.fromEntries(allW.map(e=>[e.id,e.name]));
  if(!opt.dungeon)throw new Error('--dungeon a,b 를 적어 주세요');const ids=String(opt.dungeon).split(',');
  const pool=String(opt.pool||P.testPool(snap).join(',')).split(',');const built={};for(const s of pool)built[s]=P.pick(W,snap,s)[0];const wf=P.wildFrom(W,snap);
  for(const id of ids){const all=D.dungeons();const dg0=all[id];if(!dg0){console.log(id,'없음');continue}const tier=(dg0.gen&&dg0.gen.tier)||'normal';const tg=C.TGT[tier];const th=dg0.theme||(dg0.gen||{}).theme;
   const avoid=new Set();for(const [k,x] of Object.entries(all))if(k!==id)for(const s0 of CA.slotsOf(x))avoid.add(s0.m.db);
   const before=CA.typeSpread(dg0,allW);let best=null;
   for(let t=0;t<(+opt.tries||4);t++){const dg=JSON.parse(JSON.stringify(dg0));const seed=(+opt.seed||1)+t;const r=CA.cast(dg,{theme:th,grades:((dg0.gen||{}).grades||{}).wild||['C'],all:allW,avoid,rng:BT.mkRng(seed*7919+13)});
    const wr=await C.quickWin(W,built,wf,dg,C.trios(pool,20,+opt.tseed||11),+opt.vn||10,777000,CARDS);const sp=CA.typeSpread(dg,allW);
    console.log(`${id} 씨앗 ${seed}: ${(wr*100).toFixed(0)}% (목표 ${tg*100}±15) · 타입 ${before.distinct}→${sp.distinct} 최다 ${before.top}→${sp.top} · 떠돌이 ${r.guests}`);
    const d=Math.abs(wr-tg);if(!best||d<best.d)best={dg,wr,d,seed,r};if(d<=0.15)break}
   console.log('   ',best.dg.rooms.filter(x=>x.enc).map(x=>x.id+':'+x.enc.mix.map(m=>nm[m.db]).join('·')).join('  '));
   if(opt.save){const f=[id+'.json',id+'.private.json'].map(x=>path.join(SIM,'data','dungeons',x)).find(x=>fs.existsSync(x));const j=best.dg;delete j._file;delete j.private;
    j.gen=Object.assign({},j.gen,{cast:Object.assign({},best.r,{seed:best.seed,at:new Date().toISOString().slice(0,10)}),verify:Object.assign({},j.gen&&j.gen.verify,{wr:+best.wr.toFixed(2),target:tg,band:0.15,ok:best.d<=0.15,at:new Date().toISOString().slice(0,10)})});fs.writeFileSync(f,JSON.stringify(j,null,1))}}return}
 if(cmd==='cards'){/* 11-01 망령 「은열쇠」: 카드 없이 vs 덱별 던전 승률 — recheck 와 같은 시험 일행 · 같은 씨앗. --decks base,sneak --dungeon a,b (비우면 auto_*) --t 20 --vn 3 [--size 2 (일행 인원, 기본 3)] [--out 파일] · 덱 「a+b」 = 트레이너마다 다른 덱 */
  const C=require('../lib/calib.js'),D=require('../lib/dungeon.js');const all=D.dungeons();const ids=opt.dungeon?String(opt.dungeon).split(','):Object.keys(all).filter(k=>/^auto_/.test(k)).sort();
  const pool=String(opt.pool||P.testPool(snap).join(',')).split(',');const built={};for(const s of pool)built[s]=P.pick(W,snap,s)[0];const wf=P.wildFrom(W,snap);
  const decks=['',...String(opt.decks||'base').split(',').filter(Boolean)];const trios=C.trios(pool,+opt.t||20,+opt.tseed||11,+opt.size||3);const vn=+opt.vn||3;const rows=[];const T0=Date.now();
  for(const id of ids){const dg=all[id];if(!dg)continue;const tier=(dg.gen&&dg.gen.tier)||(id.match(/^auto_(easy|normal|hard)_/)||[])[1]||'normal';const row={id,name:dg.name,tier,wr:{},st:{}};
   for(const dk of decks){let w=0,k=0;const st={runs:0,commit:0,mad:0,dead:0,skip:0,autopass:0,retryOk:0,lock:0,use:{}};
    for(const c of trios)for(let i=0;i<vn;i++){const r=await D.run(W,dg,c.map(x=>built[x]),{seed:777000+k+1,wildFrom:wf,cards:dk||null,adjust:Object.assign({},opt.madStart?{madStart:+opt.madStart}:{},opt.coverN!=null?{coverN:+opt.coverN}:{},opt.hand!=null?{hand:+opt.hand}:{})});k++;if(!r.wipe)w++;if(r.lockdown)st.lock++;st.runs++;
     if(r.checks){st.ck=st.ck||{n:0,ok:0,n15:0,ok15:0,fail:0};for(const x of ['n','ok','n15','ok15','fail'])st.ck[x]+=r.checks[x]||0}if(r.cards){st.plus=(st.plus||0)+(r.cards.plus||0);for(const x of ['commit','mad','dead','skip','autopass','retryOk','costSpent','madIn','scarIn','collapse','penDrawn','penClear','noCost','draws','mill','overpay','madOut'])st[x]=(st[x]||0)+(r.cards[x]||0);for(const [u,n] of Object.entries(r.cards.use||{}))st.use[u]=(st.use[u]||0)+n}}
    row.wr[dk||'없음']=+(w/k).toFixed(3);row.st[dk||'없음']=st}
   rows.push(row);console.log(`${id} ${dg.name} [${tier}] `+decks.map(d=>`${d||'없음'} ${(row.wr[d||'없음']*100).toFixed(0)}%`).join(' · '))}
  const tiers=['easy','normal','hard'];console.log('\n난이도별 평균');for(const t of tiers){const R=rows.filter(r=>r.tier===t);if(!R.length)continue;console.log(`${t} (${R.length}개): `+decks.map(d=>{const k=d||'없음';return `${k} ${(R.reduce((a,r)=>a+r.wr[k],0)/R.length*100).toFixed(1)}%`}).join(' · '))}
  const out=opt.out||path.join(SIM,'records','cards_'+new Date().toISOString().slice(0,10)+'.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({at:new Date().toISOString(),decks,trios:trios.length,vn,rows},null,1));console.log('저장:',out,`(${((Date.now()-T0)/1000).toFixed(0)}초)`);return}
 if(cmd==='auto'){/* 던전 자동 생성 (lib/autogen.js · docs/던전_자동생성.md): --tier easy|normal|hard [--seed N] [--theme 폐가|동굴|숲|연구소|유적|바다|화산|설원] [--save] [--webtool 파일] [--test 200 --party a,b,c] */
  const AG=require('../lib/autogen.js'),D=require('../lib/dungeon.js'),R=require('../lib/report.js');let dg;
  /* 11-01: --name 이름 · --id 파일 id (비우면 auto_<난이도>_<씨앗>) — 이름을 안 주면 이미 있는 던전 이름은 피한다 */const extra={avoidNames:Object.values(D.dungeons()).filter(d=>d.id!==opt.id).map(d=>d.name)};if(opt.name)extra.name=String(opt.name);if(opt.id)extra.id=String(opt.id);
  if(opt.verify==null||!['0','false'].includes(String(opt.verify))){/* 10-28 망령 결정: 검증 루프가 기본 (끄려면 --verify 0). --verify — 시험 일행 20조합 × 3판을 돌려 목표 승률(쉬움 80 · 보통 60 · 어려움 30%) ±15% 안에 드는 씨앗까지 다시 만든다 (--band 0.15 --tries 8 --vn 3) */const C=require('../lib/calib.js');
   const pool=String(opt.pool||P.testPool(snap).join(',')).split(',');const built={};for(const s of pool)built[s]=P.pick(W,snap,s)[0];
   dg=await C.verified(W,built,P.wildFrom(W,snap),opt.tier||'normal',{seed:+opt.seed||Math.floor(Math.random()*1e6),theme:opt.theme,knobs:kv(opt.knobs),trios:C.trios(pool,20,+opt.tseed||11),n:+opt.vn||3,band:opt.band,tries:+opt.tries||8,extra,cards:CARDS});
   const v=dg.gen.verify;console.log(`검증: ${v.tries}번째 씨앗 · 승률 ${(v.wr*100).toFixed(0)}% (목표 ${(v.target*100).toFixed(0)}±${(v.band*100).toFixed(0)})${v.ok?'':' — 범위 밖, 가장 가까운 것'}`)}
  else dg=AG.generate(Object.assign({tier:opt.tier||'normal',seed:+opt.seed||undefined,theme:opt.theme,knobs:kv(opt.knobs)},extra));
  console.log(`${dg.name} — ${dg.note}`);for(const r of dg.rooms)console.log(`  ${r.t.padEnd(8)} ${r.name}${r.check?` · 🎲 ${r.check.stat} ${r.check.target}${r.check.hint&&r.check.hint!=='any'?' ('+r.check.hint.replace('type:','타입 ')+')':''}`:''}${r.enc?` · ${r.enc.boss?'♛':'⚔'} ${r.enc.mix.length}체${r.enc.raid?' 레이드 '+r.enc.raid:''}`:''}${r.rest?' · ☗ '+r.rest:''}`);
  if(opt.save){/* 11-01: 야생 DB · 도감 야생만 쓴 던전은 <id>.json (git 에 올라가는 data/dungeons 꼴 — 10-28 던전 10개와 같다), 스냅샷 트레이너가 야생으로 들어가면 <id>.private.json (git 제외). --private 1 이면 언제나 비공개 */
   const usesSnap=dg.rooms.some(r=>r.enc&&(r.enc.trainer||(r.enc.mix||[]).some(m=>m.trainer)));const priv=usesSnap||!!opt.private;const dir=path.join(SIM,'data','dungeons');const f=path.join(dir,dg.id+(priv?'.private.json':'.json'));const other=path.join(dir,dg.id+(priv?'.json':'.private.json'));
   fs.writeFileSync(f,JSON.stringify(dg,null,1));if(fs.existsSync(other))fs.unlinkSync(other);console.log('저장:',f)}
  if(opt.webtool){const f=path.resolve(opt.webtool===' 1'||opt.webtool==='1'?path.join(SIM,'data','webtool',dg.id+'.json'):opt.webtool);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(AG.toWebtool(dg),null,1));console.log('웹툴 꼴:',f)}
  if(opt.test){const parties=pickParties(opt.party||P.testPool(snap).slice(0,3).join(','));const wf=P.wildFrom(W,snap);const rows=[];for(let i=0;i<+opt.test;i++)rows.push(await D.run(W,dg,parties,{seed:i+1,wildFrom:wf,cards:CARDS}));const a=R.aggregate(rows);console.log(`시험 ${opt.test}판 — 승률 ${((1-a.wipe)*100).toFixed(0)}% · 보스전 승 ${(a.bossWin*100).toFixed(0)}% · 끝 HP ${(a.endHp*100).toFixed(0)}% · 체크 성공 ${(a.ok*100).toFixed(0)} 대가 ${(a.cost*100).toFixed(0)} 실패 ${(a.fail*100).toFixed(0)}`)}
  return}
 if(cmd==='autocheck'){/* 자동 생성 검증: 난이도마다 던전 g개 × 3인 조합 t개 × n판 */const C=require('../lib/calib.js');
  const pool=String(opt.pool||P.testPool(snap).join(',')).split(',');const built={};for(const s of pool)built[s]=P.pick(W,snap,s)[0];
  const TR=C.trios(pool,+opt.t||20,+opt.tseed||11);const wf=P.wildFrom(W,snap);const out=[];
  for(const tier of String(opt.tier||'easy,normal,hard').split(',')){const gr=opt.grades?Object.fromEntries(String(opt.grades).split(';').map(x=>x.split('=')).map(([k,v])=>[k.trim(),v.split(',').map(y=>y.trim())])):undefined;   /* --grades 'wild=C,B;boss=A' · --knobs 'bossLv=0,battles=1' (10-27 밤: 쉬움 맞추기 실험) */
   const r=await C.evalAuto(W,built,wf,tier,{g:+opt.g||12,n:+opt.n||10,trios:TR,verify:opt.verify==null||!['0','false'].includes(String(opt.verify)),vn:+opt.vn||3,band:opt.band,tries:+opt.tries||8,seed0:+opt.seed0||900,theme:opt.theme,knobs:opt.knobs?kv(opt.knobs):undefined,grades:gr,cards:CARDS});out.push(r);
   console.log(`${tier} → 승률 ${(r.win*100).toFixed(0)}% (조합 ${(r.trioWin.min*100).toFixed(0)}~${(r.trioWin.max*100).toFixed(0)}) · 경계도 30↑ ${(r.al30*100).toFixed(0)}% · 70↑ ${(r.al70*100).toFixed(0)}% · 퇴출 ${(r.lockdown*100).toFixed(0)}% · 던전별 ${r.perD.map(d=>(d.win*100).toFixed(0)).join('/')}`)}
  const R=require('../lib/report.js');fs.mkdirSync(R.PRIV,{recursive:true});const id=(opt.id||'autocheck_'+KO.stamp()).replace(/[^\w가-힣=._-]/g,'_');fs.writeFileSync(path.join(R.PRIV,id+'.json'),JSON.stringify({id,at:new Date().toISOString(),rows:out},null,1));console.log('저장:',id);return}
 if(cmd==='calib'){/* 생성기 맞추기: --tier easy|normal|hard --base 'battles=2,foes=2' --grid 'lv=-10,-5,0;rest=short,long' --g 던전 수 --t 3인 조합 수 --n 판 */const C=require('../lib/calib.js');
  const pool=String(opt.pool||P.testPool(snap).join(',')).split(',');const built={};for(const s of pool){const r=P.pick(W,snap,s);if(!r.length)throw new Error('트레이너 못 찾음: '+s);built[s]=r[0]}
  const TR=C.trios(pool,+opt.t||12,+opt.tseed||7);const wf=P.wildFrom(W,snap);const base=kv(opt.base);const out=[];const t0=Date.now();
  for(const tier of String(opt.tier||'easy').split(','))for(const gk of C.grid(opt.grid)){const kn=Object.assign({},base,gk);const AD=['restV','al0','al30','al70','alBattle','alScale'];const ad={};for(const k of AD)if(kn[k]!=null){ad[k]=kn[k];delete kn[k]}opt.adjust=Object.entries(Object.assign(kv(opt.adjustBase),ad)).map(([k,v])=>k+'='+v).join(',');const r=await C.evalCfg(W,built,wf,tier,kn,{g:+opt.g||8,n:+opt.n||10,trios:TR,seed0:+opt.seed0||100,adjust:kv(opt.adjust),raw:!!opt.raw});out.push(r);
   r.adjust=kv(opt.adjust);console.log(`${tier} ${JSON.stringify(kn)}${opt.adjust?' ['+opt.adjust+']':''} → 승률 ${(r.win*100).toFixed(0)}% (조합 ${(r.trioWin.min*100).toFixed(0)}~${(r.trioWin.max*100).toFixed(0)}, 중앙 ${(r.trioWin.med*100).toFixed(0)}) · 보스 도달 ${(r.boss.reach*100).toFixed(0)}% 보스전 승 ${(r.boss.win*100).toFixed(0)}% · 체크 ${r.checks.per.toFixed(1)}개 성공 ${(r.checks.ok*100).toFixed(0)} 대가 ${(r.checks.cost*100).toFixed(0)} 실패 ${(r.checks.fail*100).toFixed(0)} · 경계도 평균 ${r.alertAvg.toFixed(0)} 퇴출 ${(r.lockdown*100).toFixed(0)}% [${['0+','30+','70+','100'].map(k=>r.byAl[k]?k+':'+(r.byAl[k].w/r.byAl[k].n*100).toFixed(0)+'%('+(r.byAl[k].n/r.runs*100).toFixed(0)+')':'').filter(Boolean).join(' ')}] · 끝 HP ${(r.endHp*100).toFixed(0)}% · ${((Date.now()-t0)/1000).toFixed(0)}초`)}
  const R=require('../lib/report.js');const id=(opt.id||'calib_'+KO.stamp()).replace(/[^\w가-힣=._-]/g,'_');fs.mkdirSync(R.PRIV,{recursive:true});fs.writeFileSync(path.join(R.PRIV,id+'.json'),JSON.stringify({id,name:opt.name||id,at:new Date().toISOString(),pool,trios:TR,g:+opt.g||8,n:+opt.n||10,base,grid:opt.grid||'',rows:out},null,1));console.log('저장:',id);return}
 if(cmd==='mdapply'){/* 11-03 미사그 던전 8: data/dungeons/_md_overlay.js 의 이름 · 소개 · 방 이름 · 묘사(desc → 웹툴 메모) · 그림 프롬프트(art)를 md*.json 에 입힌다. 구조 · 조우 · 체크 수치는 그대로 (bossTo 면 보스만 바꾸고 단서를 다시 쓴다) */
  const OV=require('../data/dungeons/_md_overlay.js'),AG=require('../lib/autogen.js'),WB=require('../lib/wilddb.js');const dir=path.join(SIM,'data','dungeons');
  for(const [id,o] of Object.entries(OV.D)){const f=path.join(dir,id+'.json');if(!fs.existsSync(f)){console.log('없음',id);continue}const dg=JSON.parse(fs.readFileSync(f,'utf8'));dg.name=o.name;dg.intro=o.intro;if(!dg.rooms.some(r=>r.enc&&(r.enc.mix||[]).some(m=>m.trainer)))delete dg.private;   /* 야생 DB 만 쓰니 공개(git) */ dg.art={look:o.look};
   if(o.bossTo){const b=dg.rooms.find(r=>r.t==='boss');if(b&&b.enc.mix[0].db!==o.bossTo){b.enc.mix[0]={db:o.bossTo};const e=(WB._cache=WB._cache||WB.fullV2()).find(x=>x.id===o.bossTo);dg.gen.boss=e?e.name:o.bossTo;const tr=dg.rooms.find(r=>r.t==='treasure');const c=AG.bossClue(dg,Math.random);if(tr&&c)tr.clue=c}}
   const miss=[];for(const r of dg.rooms){const x=o.rooms[r.id];if(!x){miss.push(r.id);continue}r.name=x[0];r.desc=x[1];r.memo=x[1];r.art=x[2];if(x[3]&&r.check)r.check.label=x[3]}
   /* 11-03 망령 「4개만 정말 웰메이드로」: _md_overlay2.js — 의뢰 · 보스 낭독 · 끝 · 보상 · 방마다 GM 메모 · 성공/실패 낭독 · 이야기 단서 */
   let O2={};try{O2=require('../data/dungeons/_md_overlay2.js')[id]||{}}catch(e){}if(O2.hook){dg.story={hook:O2.hook,boss:O2.boss,end:O2.end,reward:O2.reward};dg.test=true}
   for(const r of dg.rooms){const x=(O2.rooms||{})[r.id];if(x){if(x.gm)r.gm=x.gm;if(x.ok)r.okText=x.ok;if(x.fail)r.failText=x.fail;r.memo=r.desc+(x.gm?'\nGM: '+x.gm:'')}
    if(r.t==='treasure'&&O2.clue&&r.clue){if(!r.clueAuto)r.clueAuto=r.clue.d;r.clue={t:O2.clue.t,d:O2.clue.d+'\n'+r.clueAuto,auto:1}}}
   fs.writeFileSync(f,JSON.stringify(dg,null,1));console.log(id,dg.name,miss.length?'· 묘사 없는 방 '+miss.join(','):'')}return}
 if(cmd==='rename'){/* 11-03 망령 「몬스터 이름 로직」: 야생 DB 오리지널 이름을 lib/naming.js 로 다시 짓는다 (옛 이름은 oldName, 동물 바탕은 root). --save 로 저장, --salt 로 다른 판 */
  const N=require('../lib/naming.js'),WB=require('../lib/wilddb.js');const f=path.join(SIM,'data','wild','db.json');const db=JSON.parse(fs.readFileSync(f,'utf8'));const real=N.realNames();const used=new Set(db.entries.filter(e=>e.origin!=='orig'||(e.nameFix&&!opt.all)).map(e=>e.name));
  const rngOf=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return ()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}};
  for(const e of db.entries){if(e.origin!=='orig'||(e.nameFix&&!opt.all)){used.add(e.name);continue}const old=e.oldName||e.name;e.root=e.root||N.rootOf(old);e.oldName=old;e.name=N.name(rngOf(e.id+(opt.salt||'')),{types:e.types,beast:e.root,grade:e.grade,used,real});console.log(`${e.id} ${old} → ${e.name}`)}
  if(opt.save){fs.writeFileSync(f,JSON.stringify(db,null,1));console.log('저장:',f)}return}
 if(cmd==='gendb'){/* 야생 DB 생성: --n 300 --seed 27 --mix 0.5(0 균등 ~ 1 도감 비율) [--out 파일] [--dry] [--rounds 3 --reviewn 24 | --noreview]. 저장하면 옛 무리 7개도 다시 짠다 */
  const WB=require('../lib/wilddb.js');const db=WB.buildV2({seed:+opt.seed||27,n:+opt.n||undefined,mix:opt.mix==null?0.5:+opt.mix,W:opt.noreview?null:W,rounds:opt.rounds==null?3:+opt.rounds,reviewN:+opt.reviewn||24});const cov=db.coverage;if(db.review){console.log('검토:',JSON.stringify(db.review.log),'평균 승률',db.review.avgWr,'남은 표시',db.review.flagged);for(const f of db.review.flags.slice(0,30))console.log('  ·',f)}
  console.log('만든 수:',JSON.stringify(db.count));console.log('서식지 덮기 (C/B/A):',Object.entries(cov).map(([h,c])=>`${h} ${c.C}/${c.B}/${c.A}`).join(' · '));
  const P2=require('../lib/pride.js');let bad=0;for(const e of db.entries)if(e.origin==='orig'){const r=P2.calc(e.base,e.dual);if(r.step!==e.pride||!P2.legal(e.base))bad++}console.log('계단 불일치:',bad);
  if(!opt.dry){const f=opt.out?path.resolve(opt.out):WB.FILE;fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(Object.assign(db,{at:new Date().toISOString()}),null,1));console.log('저장:',f);if(!opt.out){WB.clearCache();console.log('무리 다시 짬:',WB.rebuildPacks(+opt.seed||27).join(', '))}}return}
 if(cmd==='mon'){/* 한 체 만들어 보기: --step B --kind 쌍두 --types 물,독 --n 5 --seed 1 */
  const M=require('../lib/mongen.js'),BT=require('../lib/battle.js'),P2=require('../lib/pride.js');const rng=BT.mkRng(+opt.seed||Date.now()%100000);const used=new Set();
  for(let i=0;i<(+opt.n||5);i++){const m=M.one(rng,{step:opt.step||'C',kind:opt.kind,types:opt.types?String(opt.types).split(','):null,used});if(!m){console.log('실패');continue}const r=P2.calc(m.base,m.dual);console.log(`${m.name}\t${m.types.join('/')}\t${m.base.join('/')}\t${m.kind}\t${m.pride}(계산 ${Math.round(r.ct)})\t${m.ability}\t${m.hab.join('·')}\n  ${m.concept}`)}return}
 if(cmd==='checkgen'){/* 스킬 체크 생성 (lib/checkgen.js): --party a,b,c --tier normal --theme 숲 --n 4 [--seed N] · 검토: --review [--seeds 10 --t 20] */const CG=require('../lib/checkgen.js'),C=require('../lib/calib.js');
  if(opt.review){const pool=String(opt.pool||P.testPool(snap).join(',')).split(',');const built={};for(const s of pool)built[s]=P.pick(W,snap,s)[0];
   const r=CG.review(built,C.trios(pool,+opt.t||20,+opt.tseed||11),{seeds:+opt.seeds||10,n:+opt.n||4});const f=x=>(x*100).toFixed(0);
   for(const [t,v] of Object.entries(r)){console.log(`${t} (목표 ${v.band})`);for(const k of ['old','new']){const x=v[k];console.log(`  ${k==='old'?'지금(7·9)':'생성기  '} 띠 안 ${f(x.inBand)}% · 대가 포함 성공 평균 ${f(x.avg)}% (10~90% 구간 ${f(x.q10)}~${f(x.q90)}, 최저 ${f(x.min)}) · 혼자 d4 ${f(x.alone)}% · 주인공 고루 ${f(x.spotlight)} · 4개 다 넘김 ${f(x.allPass)}%`)}}
   const R=require('../lib/report.js');fs.mkdirSync(R.PRIV,{recursive:true});fs.writeFileSync(path.join(R.PRIV,'checkgen_review.json'),JSON.stringify(r,null,1));return}
  const parties=pickParties(opt.party);const L=CG.make(parties,{tier:opt.tier||'normal',theme:opt.theme,n:+opt.n||4,seed:+opt.seed||Date.now()%100000});
  for(const c of L)console.log(`🎲 ${c.stat} + ${['HP','공격','방어','특공','특방','스피드'][c.base]} ${c.target}${c.hint!=='any'?' (적합 '+c.hint.replace('type:','타입 ')+')':''} — 「${c.label}」 · 굴림 ${c.odds.who} ${c.odds.die} (${c.odds.partner==='alone'?'혼자':c.odds.partner}) · 성공 ${(c.odds.ok*100).toFixed(0)}%\n   실패: ${c.pen.fail.memo}`);return}
 if(cmd==='report'){const R=require('../lib/report.js');const rep=R.build();console.log(`시나리오 ${rep.n}개 → ${rep.html}`);return}
 console.log('모르는 명령:',cmd);})().catch(e=>{console.error('오류:',e.message);process.exit(1)});
