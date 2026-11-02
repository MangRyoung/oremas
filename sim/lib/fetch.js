/* 제작기 공유 DB(Supabase docs 표)에서 트레이너 · 포켓몬 · 폴더 문서를 받아 data/snapshot.json 으로.
   공개 키만 쓴다(읽기 전용). 작업 컨테이너에서는 Supabase 가 막혀 있어 망령 PC 에서 돌린다: `node bin/sim.js fetch` 또는 sim/받기.bat */
"use strict";
const fs=require('fs'),path=require('path');
const CFG=()=>{const s=fs.readFileSync(path.resolve(__dirname,'..','..','js','config.js'),'utf8');const u=s.match(/supabaseUrl:"([^"]+)"/)[1],k=s.match(/supabaseKey:"([^"]+)"/)[1],t=(s.match(/makerTable:"([^"]+)"/)||[])[1]||'docs';return {url:u,key:k,table:t}};
async function docs(kind){const c=CFG();const out=[];let from=0;const PAGE=1000;
 for(;;){const q=`${c.url}/rest/v1/${c.table}?kind=eq.${kind}&select=id,data,updated_at&order=id&offset=${from}&limit=${PAGE}`;
  const r=await fetch(q,{headers:{apikey:c.key,Authorization:'Bearer '+c.key}});if(!r.ok)throw new Error(`${kind} ${r.status} ${await r.text()}`);
  const rows=await r.json();out.push(...rows);if(!rows.length)break;from+=rows.length;if(rows.length<PAGE&&from>=20000)break}
 return out}
/* 11-02 망령 「시뮬레이팅 대상을 미사그 캠퍼스의 객원으로」: 세션 노트(nt_camp · nt_docs, 공개 시트만)에서 「미사그」 캠페인의 시트 분류(cls)를 읽는다.
   시트 id = 제작기 트레이너 id. cls 가 'guest' 면 객원. 실패해도 스냅샷은 그대로 받는다(notes 없음 → 예전 시험 일행) */
async function notesCls(){const c=CFG();const h={apikey:c.key,Authorization:'Bearer '+c.key};
 const camps=await (await fetch(`${c.url}/rest/v1/nt_camp?select=id,name`,{headers:h})).json();const camp=(camps||[]).find(x=>/미사그/.test(x.name||''));if(!camp)return null;
 const r=await fetch(`${c.url}/rest/v1/nt_docs?camp=eq.${camp.id}&kind=in.(pc,npc)&select=kind,id,cls:data->>cls,gsub:data->>gsub`,{headers:h});if(!r.ok)throw new Error('세션 노트 '+r.status);const rows=await r.json();
 const cls={},gsub={};for(const x of rows){cls[x.id]=x.cls||(x.kind==='npc'?'npc':'pc');if(x.gsub)gsub[x.id]=x.gsub}return {camp:camp.id,name:camp.name,at:new Date().toISOString(),cls,gsub}}
async function fetchAll(outFile){const [trainers,pokemon,folders]=await Promise.all([docs('trainers'),docs('pokemon'),docs('folders')]);
 let notes=null;try{notes=await notesCls()}catch(e){console.warn('세션 노트 객원 목록을 못 받았다:',e.message)}
 const snap={at:new Date().toISOString(),trainers,pokemon,folders,notes};
 fs.mkdirSync(path.dirname(outFile),{recursive:true});fs.writeFileSync(outFile,JSON.stringify(snap));
 return {trainers:trainers.length,pokemon:pokemon.length,folders:folders.length,guests:notes?Object.values(notes.cls).filter(c=>c==='guest').length:0,file:outFile}}
module.exports={fetchAll,docs,notesCls};
