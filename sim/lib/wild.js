/* 야생 무리 — data/wild/*.json 의 종(種) 정의로 배틀용 포켓몬을 만든다 (오레마스 import.js 의 pokemon() 을 그대로 써서 웹툴과 같은 능력치 계산).
   종 정의: {name, types:['물','비행'], base:[HP,공,방,특공,특방,스], ability, moves:['기술',…], pride:'C'}
   무리 정의: {id, name, lv:{육성 랭크 'C'} 또는 lvAdd, mons:[{sp:'종 이름', boss:true?, dist:+N?}]}
   『와일드』 = 모든 능력치 ×1.25 (【방호】) · 『와일드 보스』 = ×1.5 + HP 종족치 1랭크 상승(여기선 HP 종족치 +15 로 근사) */
"use strict";
const fs=require('fs'),path=require('path');
const DIR=path.resolve(__dirname,'..','data','wild');
function readJson(f){return JSON.parse(fs.readFileSync(f,'utf8'))}
function species(){return {}}/* 10-27 20시: 시험용 가상 종은 뺐다(망령). 무리는 야생 DB(db.json) 항목만 */
function packs(){const out={};for(const f of fs.readdirSync(DIR)){if(f==='species.json'||f==='db.json'||!f.endsWith('.json'))continue;const p=readJson(path.join(DIR,f));if(!Array.isArray(p.mons))continue;/* 야생 DB 등 무리가 아닌 파일 */out[p.id||f.replace(/\.json$/,'')]=p}return out}
function build(W,pack,opts){opts=opts||{};const SP=species();const rank=(pack.lv&&pack.lv.육성)||opts.rank||'C';
 const tdoc={id:'wild_'+(pack.id||'x'),data:{name:pack.name||'야생',kind:'npc',ranks:{육성:rank,지시:'D',통솔:'D',능력:'D'},pids:[]}};
 const tr=W.OM_IMPORT.trainer(tdoc);tr.wild=true;tr.orderCount={};
 let DBL=null;const dbEntry=id=>{if(!DBL){const WB=require('./wilddb.js');DBL=WB.fullV2()}return DBL.find(e=>e.id===id||e.name===id)};
 const mons=(pack.mons||[]).map((m,i)=>{
  if(m.entry){/* 10-28 생성기 탭: DB 에 넣기 전 즉석 항목 그대로 */const WB=require('./wilddb.js');const r=WB.buildEntry(W,Object.assign({},m.entry,{id:m.entry.id||('tmp_'+i+'_'+(m.entry.name||''))}),{lvAdd:+(m.dist||0)+(+pack.lvAdd||0),boss:!!m.boss});const x=r.mon;x.tid=tr.id;tag(x,m.boss);return x}
  if(m.db){/* 야생 DB(data/wild/db.json) 항목 — 『와일드』 ×1.25 · boss ×1.5 는 같다 */const e=dbEntry(m.db);if(!e)throw new Error('야생 DB 에 없음: '+m.db);const WB=require('./wilddb.js');const r=WB.buildEntry(W,Object.assign({},e,{name:m.name||e.name}),{lvAdd:+(m.dist||0)+(+pack.lvAdd||0),boss:!!m.boss});const x=r.mon;x.tid=tr.id;tag(x,m.boss);return x}
  throw new Error('무리 「'+pack.name+'」 에 야생 DB 가 아닌 항목이 있어요 (가상 종은 빠졌어요): '+JSON.stringify(m));const base=sp.base.slice();if(m.boss)base[0]+=15;
  const doc={id:`${tdoc.id}_${i}`,data:{name:m.name||sp.name,t1:sp.types[0]||'-',t2:sp.types[1]||'-',base,ability:sp.ability||'',item:'',moves:(m.moves||sp.moves||[]).map(n=>({name:n})),pride:m.boss?'B':(sp.pride||'C'),dist:+(m.dist||0)+(+pack.lvAdd||0),pots:[]}};
  const x=W.OM_IMPORT.pokemon(doc,tr);tag(x,m.boss);return x});
 return {trainer:tr,mons}}
/* 10-31 망령 「와일드 배율이 웹툴에선 빠진다」: 시뮬도 웹툴과 같은 길로 — 배율 칸(mod)을 직접 쓰지 않고 포텐셜 『와일드』 · 『와일드 보스』 를 단다.
   배틀을 차릴 때 웹툴 배틀 코드가 그 포텐셜(레디메이드 mult ×1.25 · ×1.5)을 발동한다. 레이드는 x.raid 그대로(시뮬) + 웹툴 내보내기엔 「레이드 배틀 : X」 포텐셜 */
function tag(x,boss,raidX){x.mod={};x.boss=!!boss;x.role=boss?'와일드 보스':'와일드';const nm=x.role;x.pots=(x.pots||[]).filter(p=>!(p&&/^와일드( 보스)?$/.test(p.name)));x.pots.push({slot:x.pots.length,name:nm,kind:'',eff:boss?'모든 능력치 ×1.5':'모든 능력치 ×1.25',ph:false});
 if(+raidX>0)x.raidX=+raidX;return x}
module.exports={species,packs,build,DIR,tag};
