/* ---------- 능력치·레벨·개체값 (맵툴 Lib:pokemon calculate_data_info / reroll_iv 와 같은 식) ---------- */
"use strict";
window.OM_STATS=(()=>{
 const DB=()=>window.OM_DB||{};
 const STATS=['hp','attack','defense','specialattack','specialdefense','speed'];
 const STATS_KO=['HP','공격','방어','특공','특방','스피드'];
 const RANKS=['E','D','C','B','A','AA','AAA','S'];
 const strip=s=>String(s||'').replace(/[+\-]/g,'').trim();

 /* 트레이너 육성 랭크 → 기본 레벨 (제작기 lvl 표: [랭크, 경험치, 레벨, 종족치 상한]) */
 function baseLevel(rank){const L=(DB().maker||{}).lvl||[];const r=L.find(x=>x[0]===rank)||L.find(x=>x[0]===strip(rank));return r?+r[2]:100}
 function levelOf(trainer,p){return baseLevel(trainer&&trainer.ranks?trainer.ranks['육성']:'')+(+(p&&p.dist)||0)}

 /* 종족치 → 등급 (제작기 grade 표: [하한, 등급]) */
 function gradeOf(v){v=+v||0;const G=(DB().maker||{}).grade||[];let g='-';for(const [lo,name] of G){if(v>=+lo)g=name;else break}return g}

 /* 실수치. hp: floor((2B+IV+floor(EV/4))·L/100)+L+10 / 그 밖: …+5 */
 function statOf(i,base,iv,ev,L){const core=Math.floor(((2*(+base||0))+(+iv||0)+Math.floor((+ev||0)/4))*L/100);return i===0?core+L+10:core+5}
 function statsOf(base,iv,ev,L){return [0,1,2,3,4,5].map(i=>statOf(i,base[i],iv?iv[i]:0,ev?ev[i]:0,L))}

 /* 개체값 알까기: 1d32-1 ×6 을 count 번. 횟수는 트레이너 육성 랭크(reroll_list) 기준 */
 function hatchCount(trainer){const rl=((DB().const||{}).campaign||{}).reroll_list||{};const r=strip(trainer&&trainer.ranks?trainer.ranks['육성']:'');return +(rl[r]||5)}
 function rollIv(){return [0,1,2,3,4,5].map(()=>Math.floor(Math.random()*32))}
 function hatch(count){const out=[];for(let i=0;i<count;i++)out.push(rollIv());return out}
 const ivSum=iv=>iv.reduce((a,b)=>a+(+b||0),0);

 /* 랭크 배율 (get_status_values): 능력치 r≥0 → 1+r/2, r<0 → 2/(2+|r|) / 명중·회피 r≥0 → 1+r/3, r<0 → 3/(3+|r|) */
 function rankMult(r){r=+r||0;return r>=0?1+r/2:2/(2-r)}
 function accMult(r){r=+r||0;return r>=0?1+r/3:3/(3-r)}

 /* 타입 */
 function typeEn(ko){if(!ko||ko==='-')return '-';const t=(DB().const||{}).trans||{};return t['type_'+ko]||ko}
 function typeKo(en){if(!en||en==='-')return '-';const t=(DB().const||{}).trans||{};return t['type_'+en]||en}
 function typeColor(en){const c=((DB().const||{}).color||{})[String(en||'').toLowerCase()]||'';const p=c.split(',');return p.length>=2?{bg:p[0].trim(),fg:p[1].trim()}:{bg:'#2d3244',fg:'#e8e4da'}}
 /* 상성: chart[방어타입][공격타입] */
 function effect(atkEn,defTypesEn){const ch=((DB().types||{}).chart)||{};let m=1;for(const d of defTypesEn){if(!d||d==='-')continue;const row=ch[d];if(row&&row[atkEn]!=null)m*=row[atkEn]}return m}

 return {STATS,STATS_KO,RANKS,strip,baseLevel,levelOf,gradeOf,statOf,statsOf,hatchCount,rollIv,hatch,ivSum,rankMult,accMult,typeEn,typeKo,typeColor,effect};
})();
