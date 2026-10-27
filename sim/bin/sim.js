#!/usr/bin/env node
/* 망켓몬 던전 · 스킬 체크 시뮬레이터 — 명령줄
   node bin/sim.js ui [--port 8470]              화면 (브라우저) — 일행 · 던전 · 설정 고르고 돌리기 · 던전 · 야생 편집 · 기록 · 피드백
   node bin/sim.js fetch                         제작기 공유 DB → data/snapshot.json (망령 PC 에서)
   node bin/sim.js list [--snap 파일]           스냅샷의 트레이너 목록
   node bin/sim.js check                         스킬 체크 성공률 표 (룰북 열지도와 같은 식)
   node bin/sim.js battle --party 카이 --wild factory_boss [--n 200] [--log] [--snap 파일]
   node bin/sim.js run --scenario data/scenarios/base.json [--n 1000]      시나리오대로 던전을 N 판 돌려 records/ 에 기록
   node bin/sim.js run --dungeon factory --party 카이,미오,레온 [--n 500] [--seed 1] [--adjust target=2,penScale=0.5] [--policy cover=never]
   node bin/sim.js report                        records/*.summary.json → report/index.html · report.md
   --snap 를 안 주면 data/snapshot.json, 없으면 data/sample_snapshot.json (시험용 4명) */
"use strict";
const fs=require('fs'),path=require('path');
const SIM=path.resolve(__dirname,'..');
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
  if(!keys.length)variants.push({id:sc.id,adjust:sc.adjust||{},policy:sc.policy||{}});
  else{const POLK=['cover','who','partner','inou'];const split=cur=>{const a={},p={};for(const k in cur)(POLK.includes(k)?p:a)[k]=cur[k];return {a,p}};const rec=(i,cur)=>{if(i===keys.length){const {a,p}=split(cur);variants.push({id:sc.id+'__'+keys.map(k=>k+'='+cur[k]).join('_'),adjust:Object.assign({},sc.adjust||{},a),policy:Object.assign({},sc.policy||{},p)});return}for(const v of sweep[keys[i]])rec(i+1,Object.assign({},cur,{[keys[i]]:v}))};rec(0,{})}
  for(const dgId of [].concat(sc.dungeon)){const dg=dgs[dgId];if(!dg)throw new Error('던전 없음: '+dgId+' (data/dungeons/)');const parties=pickParties(sc.party.join(','));
   for(const v of variants){const id=([].concat(sc.dungeon).length>1?dgId+'_':'')+v.id;const rows=[];const t0=Date.now();
    for(let i=0;i<sc.n;i++)rows.push(D.run(W,dg,parties,{seed:(sc.seed||1)+i,adjust:v.adjust,policy:v.policy}));
    fs.mkdirSync(R.REC,{recursive:true});const base=path.join(R.REC,id.replace(/[^\w가-힣=._-]/g,'_'));
    fs.writeFileSync(base+'.jsonl',rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
    const agg=R.aggregate(rows);fs.writeFileSync(base+'.summary.json',JSON.stringify({id,dungeon:dgId,party:sc.party,n:sc.n,seed:sc.seed||1,adjust:v.adjust,policy:v.policy,at:new Date().toISOString(),snapshot:path.basename(snapFile()),agg},null,1));
    console.log(`${id}: ${sc.n}판 ${((Date.now()-t0)/1000).toFixed(1)}초 — 전멸 ${(agg.wipe*100).toFixed(0)}% · 끝 HP ${(agg.endHp*100).toFixed(0)}% · 체크 성공 ${(agg.ok*100).toFixed(0)}% 대가 ${(agg.cost*100).toFixed(0)}% 실패 ${(agg.fail*100).toFixed(0)}% · 부상자 있는 판 ${(agg.injAny*100).toFixed(0)}% · 커버 ${agg.covers.toFixed(2)}/판`)}}
  const rep=R.build();console.log('리포트:',rep.html);return}
 if(cmd==='report'){const R=require('../lib/report.js');const rep=R.build();console.log(`시나리오 ${rep.n}개 → ${rep.html}`);return}
 console.log('모르는 명령:',cmd);})().catch(e=>{console.error('오류:',e.message);process.exit(1)});
