/* 실험 일지 — 기록 · 리포트 칸에서 읽고 쓰는 코멘트 (10-27 망령 「실험 기록과 개선 부분이나 정해진 것들을 적을 수 있어야지」).
   records/journal.json (공개) · records/private/journal.json (비공개, git 제외) 두 파일. 항목:
     {id, at 'YYYY-MM-DD HH:mm', kind '실험'|'발견'|'개선안'|'결정'|'할 일', title, text, refs:[기록 id…], who '망령'|'감우'|…, done(할 일만), private}
   기록마다 붙는 짧은 코멘트는 summary.json / combos json 의 comment 칸. */
"use strict";
const fs=require('fs'),path=require('path');
const R=require('./report.js');
const KINDS=['실험','발견','개선안','결정','할 일'];
const fileOf=priv=>path.join(priv?R.PRIV:R.REC,'journal.json');
function readOne(priv){const f=fileOf(priv);if(!fs.existsSync(f))return [];try{return (JSON.parse(fs.readFileSync(f,'utf8')).entries||[]).map(e=>Object.assign(e,{private:priv}))}catch(e){return []}}
function writeOne(priv,L){const f=fileOf(priv);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify({entries:L.map(e=>{const o=Object.assign({},e);delete o.private;return o})},null,1))}
function all(){return readOne(false).concat(readOne(true)).sort((a,b)=>String(b.at).localeCompare(String(a.at))||String(b.id).localeCompare(String(a.id)))}
const now=()=>{const d=new Date(),z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`};
function save(e){e=Object.assign({},e);if(!KINDS.includes(e.kind))e.kind='발견';if(!e.id)e.id='j'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);if(!e.at)e.at=now();e.refs=(e.refs||[]).filter(Boolean);
 const priv=!!e.private;for(const p of [false,true]){const L=readOne(p).filter(x=>x.id!==e.id);if(p===priv)L.push(e);writeOne(p,L)}return e}
function remove(id){for(const p of [false,true]){const L=readOne(p);const M=L.filter(x=>x.id!==id);if(M.length!==L.length)writeOne(p,M)}}
/* 기록 코멘트: summary(.summary.json) 또는 조합 훑기(.json) */
function comment(id,text){for(const d of [R.REC,R.PRIV])for(const ext of ['.summary.json','.json']){const f=path.join(d,id+ext);if(fs.existsSync(f)){const j=JSON.parse(fs.readFileSync(f,'utf8'));if(ext==='.json'&&!j.rows)continue;if(text&&String(text).trim())j.comment=String(text).trim();else delete j.comment;fs.writeFileSync(f,JSON.stringify(j,null,1));return true}}return false}
module.exports={KINDS,all,save,remove,comment};
