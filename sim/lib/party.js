/* 스냅샷(data/snapshot.json) → 배틀용 파티. 오레마스 import.js 의 party() 를 그대로 써서 웹툴이 보는 것과 같은 모양으로 만든다 */
"use strict";
const fs=require('fs'),path=require('path');
const SNAP=path.resolve(__dirname,'..','data','snapshot.json');
function readSnap(file){file=file||SNAP;if(!fs.existsSync(file))return null;return JSON.parse(fs.readFileSync(file,'utf8'))}
const dOf=x=>(x&&x.data&&x.data.data)||(x&&x.data)||x||{};
function folderName(snap,fid){const f=(snap.folders||[]).find(f=>f.id===fid);return f?String(dOf(f).name||''):''}
/* 목록: 폴더 이름 · 트레이너 이름 · 랭크 · 포켓몬 수 */
function list(snap){return (snap.trainers||[]).map(t=>{const d=dOf(t);const n=(snap.pokemon||[]).filter(p=>{const pd=dOf(p);return (d.pids||[]).includes(p.id)||pd.tid===t.id||(p.data&&p.data.tid===t.id)}).length;
 return {id:t.id,name:d.name||'',folder:folderName(snap,d.folder),ranks:d.ranks||{},kind:d.kind||'pc',solo:d.solo||false,priv:!!d.priv,n}})}
/* 이름 · id · 폴더로 고른다. sel: 'id:xxx' | '폴더/이름' | '이름' | '폴더/*' */
function pick(win,snap,sel){const L=list(snap);let hits;
 if(/^id:/.test(sel))hits=L.filter(x=>x.id===sel.slice(3));
 else if(sel.includes('/')){const [fo,nm]=sel.split('/');hits=L.filter(x=>x.folder===fo&&(nm==='*'||x.name===nm))}
 else hits=L.filter(x=>x.name===sel);
 return hits.map(h=>build(win,snap,h.id))}
function build(win,snap,tid){const tdoc=(snap.trainers||[]).find(t=>t.id===tid);if(!tdoc)throw new Error('트레이너 없음: '+tid);
 const pk=(snap.pokemon||[]).map(x=>Object.assign({},x,{data:Object.assign({},x.data,{tid:(x.data&&x.data.tid)||dOf(x).tid})}));
 const r=win.OM_IMPORT.party(tdoc,pk);r.trainer.folderName=folderName(snap,dOf(tdoc).folder);return r}
module.exports={readSnap,list,pick,build,SNAP};
