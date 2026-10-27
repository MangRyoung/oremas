/* 야생 무리 — data/wild/*.json 의 종(種) 정의로 배틀용 포켓몬을 만든다 (오레마스 import.js 의 pokemon() 을 그대로 써서 웹툴과 같은 능력치 계산).
   종 정의: {name, types:['물','비행'], base:[HP,공,방,특공,특방,스], ability, moves:['기술',…], pride:'C'}
   무리 정의: {id, name, lv:{육성 랭크 'C'} 또는 lvAdd, mons:[{sp:'종 이름', boss:true?, dist:+N?}]}
   『와일드』 = 모든 능력치 ×1.25 (【방호】) · 『와일드 보스』 = ×1.5 + HP 종족치 1랭크 상승(여기선 HP 종족치 +15 로 근사) */
"use strict";
const fs=require('fs'),path=require('path');
const DIR=path.resolve(__dirname,'..','data','wild');
function readJson(f){return JSON.parse(fs.readFileSync(f,'utf8'))}
function species(){const f=path.join(DIR,'species.json');return fs.existsSync(f)?readJson(f):{}}
function packs(){const out={};for(const f of fs.readdirSync(DIR)){if(f==='species.json'||!f.endsWith('.json'))continue;const p=readJson(path.join(DIR,f));out[p.id||f.replace(/\.json$/,'')]=p}return out}
function build(W,pack,opts){opts=opts||{};const SP=species();const rank=(pack.lv&&pack.lv.육성)||opts.rank||'C';
 const tdoc={id:'wild_'+(pack.id||'x'),data:{name:pack.name||'야생',kind:'npc',ranks:{육성:rank,지시:'D',통솔:'D',능력:'D'},pids:[]}};
 const tr=W.OM_IMPORT.trainer(tdoc);tr.wild=true;tr.orderCount={};
 const mons=(pack.mons||[]).map((m,i)=>{const sp=SP[m.sp];if(!sp)throw new Error('야생 종 없음: '+m.sp);const base=sp.base.slice();if(m.boss)base[0]+=15;
  const doc={id:`${tdoc.id}_${i}`,data:{name:m.name||sp.name,t1:sp.types[0]||'-',t2:sp.types[1]||'-',base,ability:sp.ability||'',item:'',moves:(m.moves||sp.moves||[]).map(n=>({name:n})),pride:m.boss?'B':(sp.pride||'C'),dist:+(m.dist||0)+(+pack.lvAdd||0),pots:[]}};
  const x=W.OM_IMPORT.pokemon(doc,tr);const k=m.boss?1.5:1.25;x.mod={attack:k,defense:k,specialattack:k,specialdefense:k,speed:k};x.boss=!!m.boss;x.role=m.boss?'와일드 보스':'와일드';return x});
 return {trainer:tr,mons}}
module.exports={species,packs,build,DIR};
