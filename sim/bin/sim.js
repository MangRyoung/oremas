#!/usr/bin/env node
/* 망켓몬 던전 · 스킬 체크 시뮬레이터 — 명령줄
   node bin/sim.js ui [--port 8470]              화면 (브라우저) — 일행 · 던전 · 설정 고르고 돌리기 · 던전 · 야생 편집 · 기록 · 피드백
   node bin/sim.js fetch                         제작기 공유 DB → data/snapshot.json (망령 PC 에서)
   node bin/sim.js list [--snap 파일]           스냅샷의 트레이너 목록
   node bin/sim.js check                         스킬 체크 성공률 표 (룰북 열지도와 같은 식)
   node bin/sim.js battle --party 카이 --wild factory_boss [--n 200] [--log] [--snap 파일]
   node bin/sim.js run --scenario data/scenarios/base.json [--n 1000]      시나리오대로 던전을 N 판 돌려 records/ 에 기록
   node bin/sim.js run --dungeon factory --party 카이,미오,레온 [--n 500] [--seed 1] [--adjust target=2,penScale=0.5] [--policy cover=never]
   node bin/sim.js combos --pool 이름,이름,… --size 3 --dungeons a,b --n 100 [--id x --name 이름]   조합 훑기
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
 if(cmd==='check'){const S=require('../lib/skill.js');const T=[5,7,9,11];
  for(const pt of ['alone','mon','inou']){console.log(`\n[동료: ${pt==='alone'?'혼자 d4':pt==='mon'?'포켓몬 d6':'이능(능력 A 이상)'}]  성공 / 대가 포함 (%)`);console.log('랭크\t'+T.map(t=>`목표 ${t}`).join('\t'));
   for(const r of ['D','C','B','A','AA']){if(pt==='inou'&&S.lv(r)<3)continue;console.log(r+'\t'+T.map(t=>{const s=S.summary({rank:r,target:t,partner:pt});return `${s.ok}/${s.okPlus}`}).join('\t'))}}
  console.log('\n부상(−1단계) · C 포켓몬 기준: '+T.map(t=>{const s=S.summary({rank:'C',target:t,partner:'mon',inj:1});return `목표 ${t} ${s.ok}/${s.okPlus}`}).join(' · '));return}
 const {load}=require('../lib/env.js');const W=load().win;const P=require('../lib/party.js');
 if(cmd==='list'){const snap=P.readSnap(snapFile());if(!snap)return console.log('스냅샷이 없다 — fetch 먼저');console.log('스냅샷:',snapFile(),snap.at);for(const t of P.list(snap))console.log(`${t.folder||'(폴더 없음)'}/${t.name}\t${t.kind}\t지 ${t.ranks['지시']||'-'} 육 ${t.ranks['육성']||'-'} 통 ${t.ranks['통솔']||'-'} 능 ${t.ranks['능력']||'-'}\t${t.n}체${t.solo?' 1인':''}${t.priv?' 비공개':''}\tid:${t.id}`);return}
 const snap=P.readSnap(snapFile());if(!snap)return console.log('스냅샷이 없다 — fetch 먼저');
 const pickParties=sel=>String(sel||'').split(',').map(s=>s.trim()).filter(Boolean).flatMap(s=>{const r=P.pick(W,snap,s);if(!r.length)throw new Error('트레이너 못 찾음: '+s+' (list 로 확인)');return r});
 if(cmd==='battle'){const WD=require('../lib/wild.js'),BT=require('../lib/battle.js');const parties=pickParties(opt.party).map(p=>{Object.assign(p.trainer,W.OM_ORDERS.auto(p.trainer,'assoc',1));return {trainer:p.trainer,mons:p.mons.slice(0,+opt.wn||6)}});
  const pk=WD.packs()[opt.wild];if(!pk)throw new Error('야생 무리 없음: '+opt.wild+' (data/wild/)');const N=+opt.n||100;let w=0,T=0,hp=0;
  for(let i=0;i<N;i++){const r=BT.runBattle(W,{left:{parties},right:WD.build(W,pk),seed:(+opt.seed||1)+i,format:+opt.format||(parties.reduce((a,p)=>a+p.mons.length,0)>=3?3:2),log:opt.log&&i===0});if(r.winner==='left')w++;T+=r.turns;hp+=r.left.reduce((a,m)=>a+m.hp/m.max,0)/r.left.length;if(opt.log&&i===0)console.log(r.log.join('\n')+'\n')}
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
    for(let i=0;i<sc.n;i++)rows.push(D.run(W,dg,parties,{seed:(sc.seed||1)+i,adjust:v.adjust,policy:v.policy,wildFrom:wf,wn:+sc.wn||undefined}));
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
   for(const d of dlist){if(P.isPrivate(parties,dgs[d]))priv=true;const rows=[];for(let i=0;i<N;i++)rows.push(D.run(W,dgs[d],parties,{seed:(+opt.seed||1)+i,wildFrom:wf,adjust:kv(opt.adjust),policy:kv(opt.policy)}));const a=R.aggregate(rows);
    row.dungeons[d]={wipe:a.wipe,boss:a.boss,endHp:a.endHp,ok:a.ok,cost:a.cost,fail:a.fail,alone:a.alone,injAny:a.injAny,injSevere:a.injSevere,covers:a.covers,bkos:a.bkos,bturns:a.bturns,bossReach:a.bossReach,bossWin:a.bossWin,bossTurns:a.bossTurns,bossKos:a.bossKos,bossPhases:a.bossPhases}}
   out.push(row);if(ci%5===4||ci===combos.length-1)console.log(`${ci+1}/${combos.length} · ${((Date.now()-t0)/1000).toFixed(0)}초`)}
  const id=(opt.id||'combos_'+KO.stamp()).replace(/[^\w가-힣=._-]/g,'_');const RD=R.recDir(priv);fs.mkdirSync(RD,{recursive:true});
  fs.writeFileSync(path.join(RD,id+'.json'),JSON.stringify({id,name:opt.name||id,at:new Date().toISOString(),n:N,size,pool,dungeons:dlist,dungeonNames:dlist.map(d=>KO.dungeonName(d)),adjust:kv(opt.adjust),policy:kv(opt.policy),rows:out},null,1));
  console.log('저장:',path.join(RD,id+'.json'));return}
 if(cmd==='gen'){/* 던전 하나 무작위 생성 → data/dungeons/gen_<난이도>_<씨앗>.private.json */const G=require('../lib/gen.js');const dg=G.make(opt.tier||'normal',kv(opt.knobs),+opt.seed||1);const f=path.join(SIM,'data','dungeons',dg.id+'.private.json');if(opt.save)fs.writeFileSync(f,JSON.stringify(dg,null,1));console.log(JSON.stringify(dg,null,1).slice(0,+opt.max||4000));if(opt.save)console.log('저장:',f);return}
 if(cmd==='calib'){/* 생성기 맞추기: --tier easy|normal|hard --base 'battles=2,foes=2' --grid 'lv=-10,-5,0;rest=short,long' --g 던전 수 --t 3인 조합 수 --n 판 */const C=require('../lib/calib.js');
  const pool=String(opt.pool||'id:4jie5w05,id:5leooo2r,id:6kqpeluy,id:d7pqlnhq,id:em94ge3p,id:hmt1rchl,id:mrsr7bn7,id:uudsvc3l').split(',');const built={};for(const s of pool){const r=P.pick(W,snap,s);if(!r.length)throw new Error('트레이너 못 찾음: '+s);built[s]=r[0]}
  const TR=C.trios(pool,+opt.t||12,+opt.tseed||7);const wf=P.wildFrom(W,snap);const base=kv(opt.base);const out=[];const t0=Date.now();
  for(const tier of String(opt.tier||'easy').split(','))for(const gk of C.grid(opt.grid)){const kn=Object.assign({},base,gk);const AD=['restV','al0','al30','al70','alBattle','alScale'];const ad={};for(const k of AD)if(kn[k]!=null){ad[k]=kn[k];delete kn[k]}opt.adjust=Object.entries(Object.assign(kv(opt.adjustBase),ad)).map(([k,v])=>k+'='+v).join(',');const r=C.evalCfg(W,built,wf,tier,kn,{g:+opt.g||8,n:+opt.n||10,trios:TR,seed0:+opt.seed0||100,adjust:kv(opt.adjust)});out.push(r);
   r.adjust=kv(opt.adjust);console.log(`${tier} ${JSON.stringify(kn)}${opt.adjust?' ['+opt.adjust+']':''} → 승률 ${(r.win*100).toFixed(0)}% (조합 ${(r.trioWin.min*100).toFixed(0)}~${(r.trioWin.max*100).toFixed(0)}, 중앙 ${(r.trioWin.med*100).toFixed(0)}) · 보스 도달 ${(r.boss.reach*100).toFixed(0)}% 보스전 승 ${(r.boss.win*100).toFixed(0)}% · 체크 ${r.checks.per.toFixed(1)}개 성공 ${(r.checks.ok*100).toFixed(0)} 대가 ${(r.checks.cost*100).toFixed(0)} 실패 ${(r.checks.fail*100).toFixed(0)} · 경계도 평균 ${r.alertAvg.toFixed(0)} 퇴출 ${(r.lockdown*100).toFixed(0)}% [${['0+','30+','70+','100'].map(k=>r.byAl[k]?k+':'+(r.byAl[k].w/r.byAl[k].n*100).toFixed(0)+'%('+(r.byAl[k].n/r.runs*100).toFixed(0)+')':'').filter(Boolean).join(' ')}] · 끝 HP ${(r.endHp*100).toFixed(0)}% · ${((Date.now()-t0)/1000).toFixed(0)}초`)}
  const R=require('../lib/report.js');const id=(opt.id||'calib_'+KO.stamp()).replace(/[^\w가-힣=._-]/g,'_');fs.mkdirSync(R.PRIV,{recursive:true});fs.writeFileSync(path.join(R.PRIV,id+'.json'),JSON.stringify({id,name:opt.name||id,at:new Date().toISOString(),pool,trios:TR,g:+opt.g||8,n:+opt.n||10,base,grid:opt.grid||'',rows:out},null,1));console.log('저장:',id);return}
 if(cmd==='report'){const R=require('../lib/report.js');const rep=R.build();console.log(`시나리오 ${rep.n}개 → ${rep.html}`);return}
 console.log('모르는 명령:',cmd);})().catch(e=>{console.error('오류:',e.message);process.exit(1)});
