/* 도감 야생 (10-27 망령 「자동생성 몹이 내 세션 데이터 몹밖에 안 나와」) — 제작기 data/db.js 의 올드 타입 표(MKM_DB.old, 실제 포켓몬 1,240종 · 종족치)를 야생 풀로.
   행: [세대, 이름, 영문, 타입1, 타입2, 특성1, 특성2, 숨특, 알그룹1, 알그룹2, 비고, HP, 공, 방, 특공, 특방, 스]
   list() 도감 전체 · pick(opts) 조건으로 고르기 · build(W, 이름, {lvAdd, boss}) 배틀용 한 체 (wild.js 와 같은 꼴, 기술은 automove) */
"use strict";
const fs=require('fs'),path=require('path'),vm=require('vm');
const {makerRoot}=require('./env.js');
let DEX=null;
function list(){if(DEX)return DEX;const f=path.join(makerRoot(),'data','db.js');if(!fs.existsSync(f))throw new Error('제작기 data/db.js 가 없다: '+f);
 const ctx={window:{}};ctx.window.window=ctx.window;vm.createContext(ctx);vm.runInContext(fs.readFileSync(f,'utf8'),ctx);const rows=(ctx.window.MKM_DB||{}).old||[];
 const seen=new Set();DEX=rows.map(r=>({gen:r[0],name:r[1],types:[r[3],r[4]].filter(t=>t&&t!=='-'),ability:r[5]&&r[5]!=='-'?r[5]:'',base:r.slice(11,17).map(Number),note:r[10]||''})).filter(d=>d.name&&d.base.every(n=>n>0)&&!seen.has(d.name)&&seen.add(d.name)).map(d=>Object.assign(d,{bst:d.base.reduce((a,b)=>a+b,0)}));return DEX}
/* 조건: types(하나라도 맞으면) · bst [lo, hi] · not(이름 목록) */
function pick(o){o=o||{};const T=o.types&&o.types.length?new Set(o.types):null;const [lo,hi]=o.bst||[0,9999];const not=new Set(o.not||[]);
 return list().filter(d=>d.bst>=lo&&d.bst<=hi&&!not.has(d.name)&&(!T||d.types.some(t=>T.has(t)))&&!/메가|거다이맥스|원시회귀/.test(d.name))}
const C={};
function build(W,name,o){o=o||{};const key=name+'|'+(+o.lvAdd||0)+'|'+(o.boss?1:0);if(!C[key]){const d=list().find(x=>x.name===name);if(!d)throw new Error('도감에 없음: '+name);
 const tr=W.OM_IMPORT.trainer({id:'wild_dex',data:{name:'야생',kind:'npc',ranks:{육성:'C',지시:'D',통솔:'D',능력:'D'},pids:[]}});tr.wild=true;tr.orderCount={};
 const base=d.base.slice();if(o.boss)base[0]+=15;
 const doc={id:'dex_'+name,data:{name:d.name,t1:d.types[0]||'-',t2:d.types[1]||'-',base,ability:d.ability,item:'',moves:[],pride:'C',dist:+o.lvAdd||0,pots:[]}};
 const x=W.OM_IMPORT.pokemon(doc,tr);require('./automove.js').fill(W,x);C[key]={trainer:tr,mon:x}}
 return JSON.parse(JSON.stringify(C[key]))}
module.exports={list,pick,build};
