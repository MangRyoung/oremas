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
async function fetchAll(outFile){const [trainers,pokemon,folders]=await Promise.all([docs('trainers'),docs('pokemon'),docs('folders')]);
 const snap={at:new Date().toISOString(),trainers,pokemon,folders};
 fs.mkdirSync(path.dirname(outFile),{recursive:true});fs.writeFileSync(outFile,JSON.stringify(snap));
 return {trainers:trainers.length,pokemon:pokemon.length,folders:folders.length,file:outFile}}
module.exports={fetchAll,docs};
