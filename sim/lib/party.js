/* 스냅샷(data/snapshot.json) → 배틀용 파티. 오레마스 import.js 의 party() 를 그대로 써서 웹툴이 보는 것과 같은 모양으로 만든다 */
"use strict";
const fs=require('fs'),path=require('path');
const SNAP=path.resolve(__dirname,'..','data','snapshot.json');
function readSnap(file){file=file||SNAP;if(!fs.existsSync(file))return null;return JSON.parse(fs.readFileSync(file,'utf8'))}
const dOf=x=>(x&&x.data&&x.data.data)||(x&&x.data)||x||{};
function folderName(snap,fid){const f=(snap.folders||[]).find(f=>f.id===fid);return f?String(dOf(f).name||''):''}
/* 10-29 폴더 묶음: 제작기 폴더는 겹친다(parent). 맨 위 폴더 이름(root) · 경로(fpath) · 그 줄의 규칙(rule — 미사그 캠퍼스 = 'misag') */
function folderChain(snap,fid){const out=[];const seen=new Set();let id=fid;while(id&&!seen.has(id)){seen.add(id);const f=(snap.folders||[]).find(f=>f.id===id);if(!f)break;out.unshift(dOf(f));id=dOf(f).parent}return out}
/* 목록: 폴더 이름 · 트레이너 이름 · 랭크 · 포켓몬 수 */
function list(snap){return (snap.trainers||[]).map(t=>{const d=dOf(t);const n=(snap.pokemon||[]).filter(p=>{const pd=dOf(p);return (d.pids||[]).includes(p.id)||pd.tid===t.id||(p.data&&p.data.tid===t.id)}).length;
 const ch=folderChain(snap,d.folder);return {id:t.id,name:d.name||'',folder:folderName(snap,d.folder),root:ch.length?String(ch[0].name||''):'',fpath:ch.map(x=>String(x.name||'')).join(' › '),rule:(ch.find(x=>x.rule)||{}).rule||'',ranks:d.ranks||{},kind:d.kind||'pc',solo:d.solo||false,priv:!!d.priv,n}})}
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
 /* 10-30 미사그 대학: 일행에 넣을 때는 각성체 2체만 동행 · 1인 2체 기준(파트너 없음, 각성체는 통솔점 검사 안 함). opt.two=false 면 옛 방식(전부) */
 const td=dOf(tdoc);const isMisag=!!td.misag||folderChain(snap,td.folder).some(x=>x.rule==='misag');
 if(isMisag&&opt.two!==false){const aw=r.mons.filter(m=>m.awaken);if(aw.length){r.mons=aw.slice(0,2);for(const m of r.mons)m.partner=false;r.trainer.two=true}else r.trainer.twoMissing=true}
 /* 기술이 비어 있으면 시험용 표준 기술 (lib/automove.js) */const A=require('./automove.js');for(const m of r.mons)A.fill(win,m);
 /* 11-02 망령 「소지품 착용 시키고」: 빈 소지품 칸은 시뮬이 채운다 (lib/autoitem.js — 지침 1-6 · 2체 소켓). opt.autoItem=false 면 시트 그대로 */
 if(opt.autoItem!==false)require('./autoitem.js').equip(win,r);return r}
/* 스냅샷 트레이너를 야생 무리로: 『와일드』 ×1.25, enc.boss 면 파트너(★, 없으면 첫째)만 『와일드 보스』 ×1.5. pick:[순번…] 으로 고르거나 take 로 앞에서부터 n 체. */
function wild(win,snap,sel,enc){enc=enc||{};const L=list(snap);const id=/^id:/.test(sel)?sel.slice(3):((L.find(x=>x.name===sel||(x.folder+'/'+x.name)===sel)||{}).id);if(!id)throw new Error('야생으로 쓸 트레이너 없음: '+sel);
 const r=build(win,snap,id,{lvAdd:enc.lvAdd,two:false});const tr=r.trainer;tr.wild=true;tr.orderCount={};tr.ranks=Object.assign({},tr.ranks,{지시:'D',통솔:'D',능력:'D'});
 let mons=Array.isArray(enc.pick)?enc.pick.map(i=>r.mons[i]).filter(Boolean):r.mons.slice();if(+enc.take)mons=mons.slice(0,+enc.take);const extra=+enc.extra||0;for(let i=0;i<extra;i++){const x=JSON.parse(JSON.stringify(mons[i%mons.length]));x.id=x.id+'_x'+i;mons.push(x)}
 const bi=enc.boss?Math.max(0,mons.findIndex(m=>m.partner)):-1;
 mons.forEach((x,i)=>{require('./wild.js').tag(x,i===bi);x.hp.cur=x.hp.max});   /* 10-31: 배율은 포텐셜 『와일드』 · 『와일드 보스』 로 (웹툴과 같은 길) */
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
/* 11-15 망령 「오토나시는 결계 제대로 쓰고 있어?」: 【준비】/『X』를 『Y』로 교체(변경)할 수 있다 (카테리나 『신앙심』 피해라! → 특수결계 · 텔레실라 방어 지령 → 방패의 영창) — 시합 준비 때 고르는 것, 시뮬은 늘 바꾼다(결계 · 영창이 진영 전체에 걸려 더블에서 낫다). 횟수는 그대로 */
function prepSwap(win,t,mons){const OD=win.OM_ORDERS;if(!OD||!OD.nameOf||!t.orderCount)return t;const N=x=>String(x||'').replace(/[\s!！『』]/g,'');const texts=[...(t.unique||[]).map(u=>u&&u.eff),...(mons||[]).flatMap(m=>[...(m.pots||[]),...(m.excl?[m.excl]:[]),...(m.exclX||[])].map(p=>p&&p.eff))].map(x=>String(x||'').replace(/<br\s*\/?>/gi,'\n'));
 const K=['retreat','dodge','endure','return','snipe','special','attack','defense','specialattack','specialdefense','speed','heal','accuracy','evasion'];t.prepSwaps=[];
 for(const tx of texts)for(const ln of tx.split('\n')){if(!/【\s*준비\s*】/.test(ln))continue;const m=ln.match(/『([^』]+)』(?:을|를)\s*『([^』]+)』(?:으로|로)\s*(?:교체|변경)할\s*수\s*있다/);if(!m)continue;const X=N(m[1]),Y=N(m[2]);
  for(const kind of ['order','command'])for(const k of K){const key=(kind==='order'?'order_':'command_')+k;if(!(+t.orderCount[key]>0))continue;const cur=(t.orderType||{})[(kind==='order'?'o_':'c_')+k];const st=OD.styles(t);const fam0=cur!=null?+cur:(kind==='order'?st.tord:st.tc);if(N(OD.nameOf(kind,fam0,k))!==X)continue;
   for(let f=0;f<16;f++){if(N(OD.nameOf(kind,f,k))!==Y)continue;const n0=+t.orderCount[key];const nt=OD.setItemType(t,kind,k,f);nt.orderCount[key]=n0;Object.assign(t,{orderType:nt.orderType,orderCount:nt.orderCount});t.prepSwaps.push(m[1]+'→'+m[2]);break}}}
 return t}
/* 11-15 망령 「메이링 승률이 실제보다 높다」: 고유 『청파삼형』 「【준비】/「A」「B」「C」중 하나를 고른다 → 그 기술을 「기능 확장」으로」인데 시트 기능 확장 칸에 셋 다 들어 있음 → 시뮬은 시합 준비 때 하나만 남긴다(우리 파티 공격 타입에 가장 적은 타입 = 범위를 넓히는 쪽) */
function prepExtPick(win,t,mons){const ext=t.ext||[];if(ext.length<2)return;for(const u of t.unique||[]){const e=String(u&&u.eff||'').replace(/<br\s*\/?>/g,'\n');const m=e.match(/【\s*준비\s*】[^\n]*?((?:「[^」]+」)+)\s*중\s*하나를\s*고른다/);if(!m||!/기능\s*확장/.test(e))continue;const C=[...m[1].matchAll(/「([^」]+)」/g)].map(x=>x[1].trim());const inExt=ext.filter(x=>C.includes(String(x.mv||'').trim()));if(inExt.length<2)continue;
  const DBM=(win.OM_DB||{}).moves||{};const have={};for(const mm of mons||[])for(const mv of mm.moves||[])if(mv&&+mv.pow>0&&mv.cat!=='변화')have[mv.typeEn||mv.type]=(have[mv.typeEn||mv.type]||0)+1;
  const pick=inExt.slice().sort((a,b)=>(have[(DBM[a.mv]||{}).typeEn]||0)-(have[(DBM[b.mv]||{}).typeEn]||0))[0];t.ext=ext.filter(x=>!inExt.includes(x)||x===pick);t.prepExt=(t.prepExt||[]).concat([u.name+' → '+pick.mv])}}
function orders(win,t,opt){prepExtPick(win,t,(opt||{}).mons);opt=opt||{};const OD=win.OM_ORDERS;if(t.two)return prepSwap(win,ordersTwo(win,t,opt),opt.mons);return prepSwap(win,orders6(win,t,opt),opt.mons)}
function orders6(win,t,opt){opt=opt||{};const OD=win.OM_ORDERS;let mo=t.mkOrders||null;/* 11-15 망령 「지시 대가 패널티 제대로 들어가 있어?」: 6체도 제작기 지시 체계(mkOrders) 그대로 — 전엔 1인 기준만 읽고 6체는 협회식 기본값이라 지시 대가(off)가 빠지지 않았음 (웹툴 sheet_ui 와 같게) */
 if(t.solo&&!(mo&&mo.pick)&&opt.autoPick!==false){mo=Object.assign({preset:'assoc',tc:0,base:1},mo||{},{pick:autoPick(t,opt.mons)});t.autoPick=mo.pick}
 if(!mo){Object.assign(t,OD.auto(t,'assoc',1));return t}
 if(mo.preset==='manual'){Object.assign(t,OD.make(t,mo.tc,mo.base,{reset:true}));t.orderPreset=''}else Object.assign(t,OD.auto(Object.assign({},t,{orderPreset:mo.preset}),mo.preset,mo.base));
 if(mo.type){let nt=t;for(const k in mo.type)nt=OD.setItemType(nt,k[0]==='o'?'order':'command',k.slice(2),mo.type[k]);Object.assign(t,{orderType:nt.orderType,orderCount:nt.orderCount})}
 if(mo.pick){const oc=Object.assign({},t.orderCount||{});for(const k of Object.keys(oc)){const m=k.match(/^(order|command)_([a-z]+)$/);if(!m)continue;const L=m[1]==='order'?mo.pick.o:mo.pick.c;if(!L.includes(m[2]))oc[k]=0}t.orderCount=oc}
 {const off=mo.off||((t.misag||{}).ordOff)||null;if(off){const oc=Object.assign({},t.orderCount||{});for(const k of Object.keys(oc)){const m=k.match(/^(order|command)_([a-z]+)$/);if(!m)continue;if(((m[1]==='order'?off.o:off.c)||[]).includes(m[2]))oc[k]=0}t.orderCount=oc}}
 return t}
/* 10-30 미사그 2체 기준: 제작기 지시 체계(협회식 등)로 횟수를 낸 뒤 → 각성체 지시 대가(mkOrders.off) 0 → 「2체 기준」에서 고른 것(mkOrders.two)만 남김.
   제작기에서 아직 안 골랐으면 1인 2체 규칙(autoPick)으로 시뮬이 대신 고른다. 분배 레벨은 6체 그대로 */
function ordersTwo(win,t,opt){const OD=win.OM_ORDERS;const mo=t.mkOrders||{preset:'assoc',tc:0,base:1};
 if(mo.preset==='manual'){Object.assign(t,OD.make(t,mo.tc,mo.base,{reset:true}));t.orderPreset=''}else Object.assign(t,OD.auto(Object.assign({},t,{orderPreset:mo.preset}),mo.preset,mo.base));
 if(mo.type){let nt=t;for(const k in mo.type)nt=OD.setItemType(nt,k[0]==='o'?'order':'command',k.slice(2),mo.type[k]);Object.assign(t,{orderType:nt.orderType,orderCount:nt.orderCount})}
 let pk=mo.two;if(!pk&&opt.autoPick!==false){pk=autoPick(Object.assign({},t,{solo:2}),opt.mons);t.autoPick=pk}
 const off=mo.off||{o:[],c:[]};const oc=Object.assign({},t.orderCount||{});
 for(const k of Object.keys(oc)){const m=k.match(/^(order|command)_([a-z]+)$/);if(!m)continue;const w=m[1]==='order'?'o':'c';if((off[w]||[]).includes(m[2])||(pk&&!(pk[w]||[]).includes(m[2])))oc[k]=0}
 t.orderCount=oc;t.twoPick=pk||null;return t}
/* 시험 일행 (검증 루프 · recheck · autocheck · calib 의 기본 풀)
   11-02 망령 「시뮬레이팅 대상을 미사그 캠퍼스의 객원으로 변경해」: 세션 노트 「미사그 대학」 캠페인에서 시트 분류가 객원(cls = guest)인 트레이너 — 미사그 2체(각성체) 기준.
   객원 목록은 받기(fetch)가 세션 노트 공개 시트에서 읽어 snapshot.notes 에 둔다. 각성체가 비어 있는(twoMissing) 사람은 뺀다.
   스냅샷에 객원 정보가 없으면 예전 풀(무진 NPC 2체 1인 8명, 10-28~11-01 검증 기준) */
const OLD_POOL=['id:4jie5w05','id:5leooo2r','id:6kqpeluy','id:d7pqlnhq','id:em94ge3p','id:hmt1rchl','id:mrsr7bn7','id:uudsvc3l'];
function guestIds(snap){const N=snap&&snap.notes;if(!N||!N.cls)return [];return Object.entries(N.cls).filter(([,c])=>c==='guest').map(([id])=>id).filter(id=>(snap.trainers||[]).some(t=>t.id===id))}
function testPool(snap,o){o=o||{};const G=guestIds(snap);if(!G.length||o.old)return OLD_POOL.slice();
 return G.filter(id=>{try{const L=list(snap).find(x=>x.id===id);return L&&L.n>=2}catch(e){return true}}).sort().map(id=>'id:'+id)}
module.exports={readSnap,list,pick,build,wild,wildFrom,isPrivate,orders,autoPick,SNAP,testPool,guestIds,OLD_POOL};
