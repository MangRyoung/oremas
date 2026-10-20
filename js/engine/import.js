/* ---------- 제작기 시트(docs: trainers / pokemon) → 배틀용 트레이너·포켓몬 ---------- */
"use strict";
window.OM_IMPORT=(()=>{
 const S=()=>window.OM_STATS;
 const DB=()=>window.OM_DB||{};
 const brN=s=>String(s??'').replace(/<br\s*\/?>/gi,'\n');
 const nz=v=>v===''||v==null?0:+v;
 /* 제작기 템플릿의 빈 칸 이름(역할 포텐셜, 종족 포텐셜①, 익스펜션 : ○○ …)은 아직 안 정한 자리 */
 const isPh=n=>/(포텐셜[①-④]?$)|○○/.test(String(n||''));
 /* 스탠딩 [{label,src,point,kind?}] — 트레이너·포켓몬 같은 모양 */
 const standsOf=a=>(Array.isArray(a)?a:[]).filter(x=>x&&x.src).map(x=>Object.assign({label:x.label||'기본',src:x.src,point:+x.point||0},x.kind==='stand'||x.kind==='portrait'?{kind:x.kind}:{}));

 /* 제작기 트레이너 문서 → 배틀 트레이너 */
 function trainer(doc){
  const d=(doc.data&&doc.data.data)||doc.data||doc;
  return {id:doc.id||d.id,name:d.name||'트레이너',kind:d.kind==='npc'?'npc':'pc',image:d.image||'',stands:standsOf(d.stands),standActive:+d.standActive||0,
   ranks:Object.assign({육성:'',지시:'',통솔:'',능력:''},d.ranks||{}),base:d.base||{},detail:d.detail||{},
   unique:(d.unique||[]).filter(u=>u&&u.name).map(u=>{const o={name:u.name,eff:brN(u.eff||'')};const dsl=String(u.auto||'').trim();if(dsl){const r=window.OM_FX?window.OM_FX.parse(dsl):{ops:[]};o.auto={dsl,ops:r.ops}}return o}),
   pids:d.pids||[],solo:!!d.solo,folder:d.folder||''}}

 /* 기술 이름 → 배틀용 기술 (기술 DB 복사) */
 function move(name,half){
  const m=(DB().moves||{})[name];
  if(!m)return {name,type:'-',typeEn:'-',cat:'',pow:0,acc:0,range:'1체',contact:'-',prio:0,eff:'(DB에 없는 기술)',half:!!half,missing:true};
  return {name,type:m.type,typeEn:m.typeEn||S().typeEn(m.type),cat:m.cat,pow:nz(m.pow),acc:nz(m.acc),range:m.range,contact:m.contact,prio:nz(m.prio),
   tag:m.tag,eff:brN(m.eff),atk:m.atk,def:m.def,note:m.note,min:nz(m.min)||1,max:nz(m.max)||1,sock:m.sock||'',tags:m.tags||[],half:!!half}}

 /* 제작기 포켓몬 문서 → 배틀 포켓몬. iv 를 주지 않으면 0 (알까기는 파티 등록 때) */
 function pokemon(doc,tr,iv){
  const d=(doc.data&&doc.data.data)||doc.data||doc;
  const L=S().levelOf(tr,d);
  const base=Array.from({length:6},(_,i)=>nz((d.base||[])[i]));
  const ev=[0,0,0,0,0,0];  /* 개체값·노력치는 쓰지 않는다 */
  iv=[0,0,0,0,0,0];
  const stats=S().statsOf(base,iv,ev,L);
  const tko=[d.t1,d.t2,d.t3].map(x=>x&&x!=='-'?x:'-');
  const pots=[];
  (d.pots||[]).forEach((n,i)=>{if(!n||n==='-')return;const row=((DB().maker||{}).pots||[]).find(r=>r[1]===n);
   pots.push({slot:i,name:String(n).replace(/『|』/g,''),kind:(d.potKind||[])[i]||(row?row[0]:''),eff:brN((d.potEff||[])[i]||(row?row[2]:'')),ph:isPh(n)})});
  const abil=(DB().traits||{})[d.ability]||{};
  const item=(DB().items||{})[d.item]||{};
  return {id:doc.id||d.id,tid:tr?tr.id:(doc.data&&doc.data.tid)||'',name:d.name||'',gender:d.gender||'-',lv:L,dist:nz(d.dist),
   typesKo:tko,types:tko.map(S().typeEn),tera:d.tera&&d.tera!=='-'?d.tera:'-',teraEn:d.tera&&d.tera!=='-'?S().typeEn(d.tera):'-',
   ability:d.ability||'',abilityEff:brN(abil.multi||abil.single||''),item:d.item||'',itemEff:brN(item.eff||''),
   base,ranks:base.map(S().gradeOf),iv,ev,stats,hp:{max:stats[0],cur:stats[0]},
   moves:(()=>{const mv=(d.moves||[]).filter(m=>m&&m.name).map(m=>move(m.name,m.half));return mv.length?mv:[move('발버둥',false)]})(),
   pots,excl:d.excl&&d.excl.name&&d.excl.name!=='전용 포텐셜'?{name:d.excl.name,eff:brN(d.excl.eff||'')}:null,
   exclX:(d.exclX||[]).filter(x=>x&&x.name).map(x=>({name:x.name,eff:brN(x.eff||'')})),
   role:roleOf(d),pride:d.pride||'',egg:[d.egg1||'-',d.egg2||'-'],partner:!!d.partner,image:d.image||'',stands:standsOf(d.stands),standActive:+d.standActive||0,memo:d.memo||'',
   auto:(()=>{const out={};const src=d.auto||{};for(const k in src){const dsl=String(src[k]||'').trim();if(!dsl)continue;const r=window.OM_FX?window.OM_FX.parse(dsl):{ops:[]};out[String(k).replace(/『|』/g,'')]={dsl,ops:r.ops}}return out})(),
   rank:{attack:0,defense:0,specialattack:0,specialdefense:0,speed:0,accuracy:0,evasion:0,critical:0},states:{},forms:formsOf(d,base,L)}}

 /* 폼체인지·메가진화 (제작기 시트 forms): 비운 칸은 원래 값 */
 function formsOf(d,base0,L){const out=(d.forms||[]).filter(f=>f&&(f.name||f.ability||(f.base||[]).some(v=>v!=='')||(f.pots||[]).some(x=>x&&x.name))).map(f=>{
   const base=Array.from({length:6},(_,i)=>{const v=(f.base||[])[i];return v===''||v==null?base0[i]:nz(v)});
   const tko=[f.t1,f.t2].map(x=>x&&x!=='-'?x:'-');const keepT=tko.every(x=>x==='-');
   const ab=f.ability||'';const abil=ab?((DB().traits||{})[ab]||{}):null;
   return {name:f.name||'',kind:f.kind||'폼체인지',typesKo:keepT?null:[...tko,'-'],types:keepT?null:[...tko,'-'].map(S().typeEn),
    ability:ab,abilityEff:abil?brN(abil.multi||abil.single||''):null,base,image:f.image||'',cond:f.cond||'',revert:!!f.revert,
    pots:(f.pots||[]).filter(x=>x&&x.name).map(x=>{const row=((DB().maker||{}).pots||[]).find(r=>r[1]===x.name);return {slot:+x.slot||0,name:String(x.name).replace(/『|』/g,''),kind:row?row[0]:'',eff:brN(x.eff||(row?row[2]:''))}})}});
  return out.length?out:null}

 /* 역할 포텐셜(00.x. 역할)에서 역할 이름 */
 function roleOf(d){const P=(DB().maker||{}).pots||[];
  for(const n of (d.pots||[])){if(!n||isPh(n))continue;const r=P.find(x=>x[1]===n);if(r&&/^00\./.test(r[0])&&n!=='바닐라')return String(n).replace(/『|』/g,'')}
  return ''}

 /* 트레이너 하나와 그 파티 */
 function party(trDoc,pokeDocs){
  const tr=trainer(trDoc);
  const byId=new Map(pokeDocs.map(x=>[x.id,x]));
  const mons=tr.pids.map(id=>byId.get(id)).filter(Boolean).map(x=>pokemon(x,tr));
  return {trainer:tr,mons}}

 return {trainer,pokemon,move,party,roleOf};
})();
