/* 기록 · 리포트에 쓰는 한국어 이름표 — 조정값 · 정책 · 던전 · 일행을 사람이 읽는 말로 (10-27 망령 「기록 쪽도 영문으로 되있네」) */
"use strict";
const fs=require('fs'),path=require('path');
const SIM=path.resolve(__dirname,'..');
const ADJ={target:v=>'목표 '+(v>0?'+':'')+v,penScale:v=>'패널티 ×'+v,checkEvery:v=>v==2?'체크 하나 걸러':v==3?'체크 셋에 하나':'체크 간격 '+v,stepAll:v=>'단계 '+(v>0?'+':'')+v,wildLv:v=>'야생 Lv '+(v>0?'+':'')+v,wildExtra:v=>'야생 +'+v+'체'};
const POL={who:{best:'주사위 큰 사람',round:'돌아가며'},cover:{fail:'실패 받침',never:'커버 없음',always:'대가도 받침'},partner:{match:'조건 맞는 포켓몬',any:'아무 포켓몬',none:'늘 혼자'},inou:{yes:'이능 씀',no:'이능 안 씀'}};
const POLK={who:'누가',cover:'커버',partner:'동료',inou:'이능'};
const DEF={who:'best',cover:'fail',partner:'match',inou:'yes'};
function adjustKo(a,all){a=a||{};return Object.entries(a).filter(([k,v])=>v!=null&&v!==''&&(all||!(k==='penScale'?+v===1:k==='checkEvery'?+v<=1:+v===0))).map(([k,v])=>ADJ[k]?ADJ[k](+v):k+' '+v)}
function policyKo(p,all){p=p||{};return Object.entries(p).filter(([k,v])=>all||DEF[k]!==v).map(([k,v])=>(POL[k]||{})[v]||(POLK[k]||k)+' '+v)}
function describe(a,p,all){const L=adjustKo(a,all).concat(policyKo(p,all));return L.length?L.join(' · '):'기본값'}
let DGN=null;function dungeonName(id){if(!DGN){DGN={};const d=path.join(SIM,'data','dungeons');if(fs.existsSync(d))for(const f of fs.readdirSync(d))if(f.endsWith('.json')){try{const j=JSON.parse(fs.readFileSync(path.join(d,f),'utf8'));DGN[j.id||f.replace(/(\.private)?\.json$/,'')]=j.name||f}catch(e){}}}return DGN[id]||id}
function partyKo(party,trainers){const by={};for(const t of trainers||[])by[t.id]=t.name;return (party||[]).map(s=>{s=String(s);if(s.startsWith('id:'))return by[s.slice(3)]||s.slice(3).slice(0,6)+'…';return s.replace(/^.*\//,'')})}
function stamp(d){d=d||new Date();const z=n=>String(n).padStart(2,'0');return `${z(d.getMonth()+1)}${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}`}
module.exports={ADJ,POL,POLK,DEF,adjustKo,policyKo,describe,dungeonName,partyKo,stamp,reset:()=>{DGN=null}};
