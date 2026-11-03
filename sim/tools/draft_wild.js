/* 미사그 야생몬 다시 짜기 초안 만들기 (11-03 감우) — 이름 v4(동양풍 약 4할) · 특성 v2(기존 특성만, 같은 던전 안 겹침 피하기).
   node tools/draft_wild.js [이름 씨앗=7] [특성 씨앗=3]  →  data/wild/draft_v3.json(던전 몹 74종) · data/wild/names_v4_draft.json(오리지널 225종). db.json 은 안 바꾼다. */
const fs=require('fs'),path=require('path');process.chdir(path.join(__dirname,'..'));
const N=require('../lib/naming.js'),BT=require('../lib/battle.js'),P=require('../lib/abilpick.js'),D=require('../lib/dungeon.js');const W=require('../lib/env.js').load().win;
const db=JSON.parse(fs.readFileSync('data/wild/db.json','utf8'));const E=db.entries.filter(e=>e.origin==='orig');const real=N.realNames();
const ns=+(process.argv[2]||7),as=+(process.argv[3]||3);
const used=new Set(db.entries.filter(e=>e.origin!=='orig').map(e=>e.name));const o={used,real,mine:new Set()};const rng=BT.mkRng(ns);const names={};
for(const e of E)names[e.id]=N.name(rng,Object.assign(o,{types:e.types,beast:e.root,grade:e.grade}));
/* 던전 소속 */
const inDg={},dgOf={},fixed={};for(const [id,dg] of Object.entries(D.dungeons()))for(const r of dg.rooms)if(r.enc)r.enc.mix.forEach((m,j)=>{(inDg[m.db]=inDg[m.db]||[]).push(dg.name+(r.enc.boss&&j===(+r.enc.bossAt||0)?' 보스':''));(dgOf[m.db]=dgOf[m.db]||new Set()).add(id)});
const byId=Object.fromEntries(db.entries.map(e=>[e.id,e]));
for(const [mid,s] of Object.entries(dgOf)){const e=byId[mid];if(e&&e.origin!=='orig')for(const g of s)(fixed[g]=fixed[g]||[]).push(e.ability)}
const dg=Object.fromEntries(Object.entries(dgOf).map(([k,v])=>[k,[...v]]));
const ab=P.pickAll(E,W,BT.mkRng(as),{dg,fixed});
/* 던전마다 겹침 세기 */
const per={};for(const [mid,s] of Object.entries(dgOf))for(const g of s){const e=byId[mid];const a=e.origin==='orig'?(ab.out[mid]||{}).name:e.ability;(per[g]=per[g]||[]).push(a)}
const dupBy=Object.fromEntries(Object.entries(per).map(([g,l])=>{const c={};for(const a of l)c[a]=(c[a]||0)+1;return [g,Object.entries(c).filter(([a,n])=>n>1).map(([a,n])=>a+'×'+n)]}));
const rows=db.entries.filter(e=>inDg[e.id]).map(e=>({id:e.id,old:e.name,neu:e.origin==='orig'?names[e.id]:e.name,orig:e.origin==='orig',types:e.types,grade:e.grade,kind:e.kind,root:e.root,where:inDg[e.id].join(', '),ab0:e.ability,ab0d:(e.abilityDesc||'').replace(/\n/g,' '),ab1:e.origin==='orig'?(ab.out[e.id]||{}).name:e.ability,ab1d:e.origin==='orig'?((ab.out[e.id]||{}).desc||'').replace(/\n/g,' '):'(실제 포켓몬 — 그대로)',reads:e.origin==='orig'?(ab.out[e.id]||{}).reads:null}));
const stat={orig:E.length,abKinds:Object.keys(ab.use).length,ab3:Object.values(ab.use).filter(v=>v>=3).length,gm:E.filter(e=>ab.out[e.id]&&!ab.out[e.id].reads).length,dgDupForced:ab.dupDg.length,dupBy,nameSeed:ns,abilSeed:as};
fs.writeFileSync('data/wild/draft_v3.json',JSON.stringify({memo:'2026-11-03 감우 초안 — 이름 v4(앞머리 겹침 줄임 · 동양풍 약 4할, lib/naming.js) · 특성 v2(기존 특성만 · 같은 던전 안 겹침 피하기, lib/abilpick.js) · 미사그 던전 몹 74종. tools/draft_wild.js 로 만듦. 아직 db.json 에 안 넣음',stat,rows},null,1));
fs.writeFileSync('data/wild/names_v4_draft.json',JSON.stringify({memo:'2026-11-03 감우 — 이름 v4 초안, 오리지널 225종 전부 (씨앗 '+ns+'). 확정 전엔 db.json 안 바꿈',names:E.map(e=>({id:e.id,old:e.name,neu:names[e.id],types:e.types,grade:e.grade,root:e.root}))},null,1));
fs.writeFileSync('data/wild/abil_v2_draft.json',JSON.stringify({memo:'2026-11-03 감우 — 특성 v2 초안, 오리지널 225종 (씨앗 '+as+')',abil:ab.out},null,1));
console.log(JSON.stringify(stat));
