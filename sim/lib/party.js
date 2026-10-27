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
/* opt.lvAdd: 포켓몬 문서의 dist(레벨 보정)에 더한다 — 야생으로 쓸 때 레벨 가감용 */
function build(win,snap,tid,opt){opt=opt||{};const tdoc=(snap.trainers||[]).find(t=>t.id===tid);if(!tdoc)throw new Error('트레이너 없음: '+tid);
 const pk=(snap.pokemon||[]).map(x=>{const d=Object.assign({},x.data,{tid:(x.data&&x.data.tid)||dOf(x).tid});if(+opt.lvAdd){if(d.data&&typeof d.data==='object')d.data=Object.assign({},d.data,{dist:(+d.data.dist||0)+(+opt.lvAdd)});else d.dist=(+d.dist||0)+(+opt.lvAdd)}return Object.assign({},x,{data:d})});
 const r=win.OM_IMPORT.party(tdoc,pk);r.trainer.folderName=folderName(snap,dOf(tdoc).folder);r.trainer.priv=!!dOf(tdoc).priv;
 /* 기술이 비어 있으면 시험용 표준 기술 (lib/automove.js) */const A=require('./automove.js');for(const m of r.mons)A.fill(win,m);return r}
/* 스냅샷 트레이너를 야생 무리로: 『와일드』 ×1.25, enc.boss 면 파트너(★, 없으면 첫째)만 『와일드 보스』 ×1.5. pick:[순번…] 으로 고르거나 take 로 앞에서부터 n 체. */
function wild(win,snap,sel,enc){enc=enc||{};const L=list(snap);const id=/^id:/.test(sel)?sel.slice(3):((L.find(x=>x.name===sel||(x.folder+'/'+x.name)===sel)||{}).id);if(!id)throw new Error('야생으로 쓸 트레이너 없음: '+sel);
 const r=build(win,snap,id,{lvAdd:enc.lvAdd});const tr=r.trainer;tr.wild=true;tr.orderCount={};tr.ranks=Object.assign({},tr.ranks,{지시:'D',통솔:'D',능력:'D'});
 let mons=Array.isArray(enc.pick)?enc.pick.map(i=>r.mons[i]).filter(Boolean):r.mons.slice();if(+enc.take)mons=mons.slice(0,+enc.take);const extra=+enc.extra||0;for(let i=0;i<extra;i++){const x=JSON.parse(JSON.stringify(mons[i%mons.length]));x.id=x.id+'_x'+i;mons.push(x)}
 const bi=enc.boss?Math.max(0,mons.findIndex(m=>m.partner)):-1;
 mons.forEach((x,i)=>{const k=i===bi?1.5:1.25;x.mod={attack:k,defense:k,specialattack:k,specialdefense:k,speed:k};x.boss=i===bi;x.role=i===bi?'와일드 보스':'와일드';x.hp.cur=x.hp.max});
 return {trainer:tr,mons,name:dOf((snap.trainers||[]).find(t=>t.id===id)).name,priv:tr.priv}}
/* 던전 진행기에 넘길 「스냅샷 야생」 만들기 함수 (같은 조건이면 한 번만 빌드하고 복사본을 준다) */
function wildFrom(win,snap){const C={};return (sel,enc)=>{const k=sel+'|'+JSON.stringify(enc||{});if(!C[k])C[k]=wild(win,snap,sel,enc);return JSON.parse(JSON.stringify(C[k]))}}
/* 일행 · 던전에 비공개가 섞였나 */
function isPrivate(parties,dg){return !!((dg&&dg.private)||(parties||[]).some(p=>p.trainer&&p.trainer.priv))}
/* 지시 횟수: 기본은 협회식(assoc). 1인 기준(solo) 트레이너는 제작기 시트의 지시 체계 · 고른 ORDER · COMMAND(mkOrders.pick)를 웹툴(sheet_ui)과 같게 — 고르지 않은 항목은 0 회 */
/* 10-28: 1인 기준인데 제작기에서 아직 안 고른 트레이너(무진 NPC 등)는 시뮬이 대신 고른다 — 1인 지령 규칙(2체 4식 1 · 6령 2, 3체 4식 2 · 6령 3, 지시 A 이상은 6령 3 · 회피/명중 1 필수)대로.
   4식 = 버텨라(3체면 + 물러나), 6령 = 주력 공격(일행 기술이 물리가 많으면 공격 · 아니면 특공) · 회복 (+ 지시 A↑ 회피 · 3체 방어). 옛 방식(전부)은 opt.autoPick=false */
function autoPick(t,mons){const s3=t.solo==3||t.solo==='3';const A=/^(AA|A|S)/.test(String((t.ranks||{})['지시']||''));
 let ph=0,sp=0;for(const m of mons||[])for(const mv of m.moves||[]){if(mv.cat==='물리')ph++;else if(mv.cat==='특수')sp++}
 const o=s3?['endure','retreat']:['endure'];const c=[ph>=sp?'attack':'specialattack','heal'];if(A)c.push('evasion');else if(s3)c.push('defense');if(A&&s3&&c.length<3)c.push('defense');
 return {o,c}}
function orders(win,t,opt){opt=opt||{};const OD=win.OM_ORDERS;let mo=t.solo&&t.mkOrders;
 if(t.solo&&!(mo&&mo.pick)&&opt.autoPick!==false){mo=Object.assign({preset:'assoc',tc:0,base:1},mo||{},{pick:autoPick(t,opt.mons)});t.autoPick=mo.pick}
 if(!mo){Object.assign(t,OD.auto(t,'assoc',1));return t}
 if(mo.preset==='manual'){Object.assign(t,OD.make(t,mo.tc,mo.base,{reset:true}));t.orderPreset=''}else Object.assign(t,OD.auto(Object.assign({},t,{orderPreset:mo.preset}),mo.preset,mo.base));
 if(mo.type){let nt=t;for(const k in mo.type)nt=OD.setItemType(nt,k[0]==='o'?'order':'command',k.slice(2),mo.type[k]);Object.assign(t,{orderType:nt.orderType,orderCount:nt.orderCount})}
 if(mo.pick){const oc=Object.assign({},t.orderCount||{});for(const k of Object.keys(oc)){const m=k.match(/^(order|command)_([a-z]+)$/);if(!m)continue;const L=m[1]==='order'?mo.pick.o:mo.pick.c;if(!L.includes(m[2]))oc[k]=0}t.orderCount=oc}
 return t}
module.exports={readSnap,list,pick,build,wild,wildFrom,isPrivate,orders,autoPick,SNAP};
