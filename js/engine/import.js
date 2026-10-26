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
 /* 필드 전개 [{type,name,loc,img,eff,count,color}] — 트레이너·포켓몬 같은 모양 (stage_ui) */
 const fieldsOf=a=>(Array.isArray(a)?a:[]).filter(x=>x&&x.name).map(x=>({type:[0,1,2].includes(+x.type)?+x.type:0,name:String(x.name),loc:x.loc||'',img:x.img||'',eff:brN(x.eff||''),count:+x.count>0?+x.count:-1,color:x.color||''}));
 const standsOf=a=>(Array.isArray(a)?a:[]).filter(x=>x&&x.src).map(x=>Object.assign({label:x.label||'기본',src:x.src,point:+x.point||0},x.kind==='stand'||x.kind==='portrait'?{kind:x.kind}:{}));

 /* 제작기 트레이너 문서 → 배틀 트레이너 */
 function trainer(doc){
  const d=(doc.data&&doc.data.data)||doc.data||doc;
  return {deck:(Array.isArray(d.deck)?d.deck:[]).filter(x=>x&&x.n).map(x=>({n:String(x.n).slice(0,60),q:Math.max(0,Math.min(99,Math.floor(+x.q||1)))})),deckName:String(d.deckName||'').slice(0,40),id:doc.id||d.id,name:d.name||'트레이너',kind:d.kind==='npc'?'npc':'pc',image:d.image||'',stands:standsOf(d.stands),standActive:+d.standActive||0,
   ranks:Object.assign({육성:'',지시:'',통솔:'',능력:''},d.ranks||{}),base:d.base||{},detail:d.detail||{},
   unique:(d.unique||[]).filter(u=>u&&u.name).map(u=>{const o={name:u.name,eff:brN(u.eff||'')};for(const k of ['color','icon','sub'])if(u[k])o[k]=String(u[k]).slice(0,40);if(u.line)o.line=String(u.line).slice(0,80);const dsl=String(u.auto||'').trim();if(dsl){const r=window.OM_FX?window.OM_FX.parse(dsl):{ops:[]};o.auto={dsl,ops:r.ops}}return o}),
   pids:d.pids||[],solo:!!d.solo,folder:d.folder||'',fields:fieldsOf(d.fields),
   /* 10-25 망령: SP · 서포터 — 제작기 「포인트」 칸 아래에서 적는다. 자동화 구문은 고유 포텐셜과 같은 꼴로 */
   sps:(Array.isArray(d.sps)?d.sps:[]).filter(x=>x&&x.name).map(x=>{const o={name:String(x.name),prob:x.prob===''||x.prob==null?100:Math.max(0,Math.min(100,Math.round(+x.prob)||0)),theme:String(x.theme||''),eff:brN(x.eff||''),img:String(x.img||''),line:String(x.line||''),color:String(x.color||'')};const dsl=String(x.auto||'').trim();if(dsl){const r=window.OM_FX?window.OM_FX.parse(dsl):{ops:[]};o.auto={dsl,ops:r.ops}}return o}),
   /* 10-23 망령: 제작기 시트의 지시 체계 {preset:assoc|ten|wild|jam|manual, tc, base} */
   mkOrders:d.orders&&d.orders.preset?Object.assign({preset:String(d.orders.preset),tc:+d.orders.tc||0,base:d.orders.base==null?1:Math.max(0,+d.orders.base||0)},(()=>{const ty={};const src=d.orders.type||{};for(const k in src)if(/^[oc]_[a-z]+$/.test(k)&&isFinite(+src[k]))ty[k]=Math.max(0,Math.min(8,Math.round(+src[k])));return Object.keys(ty).length?{type:ty}:{}})(),(()=>{/* 10-26 1인 기준(2체): 제작기에서 고른 ORDER · COMMAND 만 횟수, 나머지 0 */const pk=d.orders.pick;if(!d.solo||!pk||typeof pk!=='object')return {};const f=a=>(Array.isArray(a)?a:[]).filter(k=>/^[a-z]+$/.test(k));return {pick:{o:f(pk.o),c:f(pk.c)}}})()):null}}

 /* 기술 이름 → 배틀용 기술 (기술 DB 복사) */
 function move(name,half){
  const m=(DB().moves||{})[name];
  if(!m)return {name,type:'-',typeEn:'-',cat:'',pow:0,acc:0,range:'1체',contact:'-',prio:0,eff:'(DB에 없는 기술)',half:!!half,missing:true};
  return {name,type:m.type,typeEn:m.typeEn||S().typeEn(m.type),cat:m.cat,pow:nz(m.pow),acc:nz(m.acc),range:m.range,contact:m.contact,prio:nz(m.prio),
   tag:m.tag,eff:brN(m.eff),atk:m.atk,def:m.def,note:m.note,min:nz(m.min)||1,max:nz(m.max)||1,sock:m.sock||'',tags:m.tags||[],half:!!half}}

 /* 제작기 포켓몬 문서 → 배틀 포켓몬. 개체값은 제작기 시트의 알까기 값(ivs), 없으면 0 (10-23 망령) */
 function pokemon(doc,tr,iv){
  const d=(doc.data&&doc.data.data)||doc.data||doc;
  const L=S().levelOf(tr,d);
  /* 10-22 망령: 제작기가 특성 · 포텐셜의 「종족치 N랭크 상승」을 반영해 둔 값(baseUp)이 있으면 그걸로 실수치를 낸다 (원래 값은 base0) */
  const base0=Array.from({length:6},(_,i)=>nz((d.base||[])[i]));const BU=d.baseUp&&Array.isArray(d.baseUp.base)&&d.baseUp.base.length===6?d.baseUp:null;
  const base=BU?BU.base.map((v,i)=>v===''||v==null?base0[i]:nz(v)):base0;
  const ev=[0,0,0,0,0,0];  /* 개체값·노력치는 쓰지 않는다 */
  const mkIv=Array.isArray(d.ivs)&&d.ivs.length===6?d.ivs.map(v=>Math.max(0,Math.min(31,Math.round(+v)||0))):null;
  iv=mkIv||[0,0,0,0,0,0];
  const stats=S().statsOf(base,iv,ev,L);
  const tko=[d.t1,d.t2,d.t3].map(x=>x&&x!=='-'?x:'-');
  const pots=[];
  /* 효과 글: 시트에 직접 적은 글 → 제작기가 시트에 남긴 사본(effTxt, 제작기 DB·새로 만든 항목 포함) → 오레마스 DB (10-21 망령: DB 에 없어도 시트에 있으면 가져온다) */
  const ET=d.effTxt||{};
  (d.pots||[]).forEach((n,i)=>{if(!n||n==='-')return;const row=((DB().maker||{}).pots||[]).find(r=>r[1]===n);
   pots.push({slot:i,name:String(n).replace(/『|』/g,''),kind:(d.potKind||[])[i]||(ET.kinds||[])[i]||(row?row[0]:''),eff:brN((d.potEff||[])[i]||(ET.pots||[])[i]||(row?row[2]:'')),ph:isPh(n)})});
  const abil0=(DB().traits||{})[d.ability]||{};const abil=ET.ab?{multi:ET.ab}:abil0;
  /* 소지품: 오레마스 DB → 없으면 제작기 시트의 오리지널 소지품(itemOwn, DB 에 안 넣은 것) · 시트 사본(effTxt.it) (10-24 망령) */
  const item0=(DB().items||{})[d.item];const own=d.itemOwn&&d.itemOwn.name&&d.itemOwn.name===d.item?d.itemOwn:null;
  const item=item0||(own?{eff:own.eff||ET.it||''}:ET.it?{eff:ET.it}:{});
  return {id:doc.id||d.id,tid:tr?tr.id:(doc.data&&doc.data.tid)||'',name:d.name||'',gender:d.gender||'-',lv:L,dist:nz(d.dist),mkDist:nz(d.dist),
   typesKo:tko,types:tko.map(S().typeEn),tera:d.tera&&d.tera!=='-'?d.tera:'-',teraEn:d.tera&&d.tera!=='-'?S().typeEn(d.tera):'-',
   ability:d.ability||'',abilityEff:brN(abil.multi||abil.single||''),item:d.item||'',itemEff:brN(item.eff||''),items2:itemsX(d,ET),
   base,ranks:base.map(S().gradeOf),iv,ev,stats,...(mkIv?{mkIvSig:mkIv.join('/')}:{}),...(d.ivRolls&&Array.isArray(d.ivRolls.rolls)&&d.ivRolls.rolls.length?{ivRolls:{rolls:d.ivRolls.rolls.filter(r=>Array.isArray(r)&&r.length===6).map(r=>r.map(v=>Math.max(0,Math.min(31,Math.round(+v)||0)))),x:+d.ivRolls.x||0,r:+d.ivRolls.r||0}}:{}),   /* 10-24: 제작기에서 굴려 둔 알까기 후보 */...(BU?{base0,baseUp:(BU.up||[]).map(u=>({i:+u.i,from:+u.from,to:+u.to,by:(u.by||[]).slice(0,4)}))}:{}),hp:{max:stats[0],cur:stats[0]},
   moves:(()=>{const mv=(d.moves||[]).filter(m=>m&&m.name).map(m=>{const o=move(m.name,m.half);if(m.hide)o.hide=true;return o});   /* hide: 한 장 요약 · 도감에 안 보이는 기술 (10-22) */return mv.length?mv:[move('발버둥',false)]})(),
   pots,excl:d.excl&&d.excl.name&&d.excl.name!=='전용 포텐셜'?{name:d.excl.name,eff:brN(d.excl.eff||'')}:null,
   exclX:(d.exclX||[]).filter(x=>x&&x.name).map(x=>({name:x.name,eff:brN(x.eff||'')})),
   role:roleOf(d),pride:d.pride||'',egg:[d.egg1||'-',d.egg2||'-'],partner:!!d.partner,image:d.image||'',stands:standsOf(d.stands),standActive:+d.standActive||0,memo:d.memo||'',
   cutLine:(()=>{const out={};const src=d.cutLine||{};for(const k in src){const v=String(src[k]||'').trim();if(v)out[String(k).replace(/『|』/g,'').trim()]=v.slice(0,80)}return out})(),
   auto:(()=>{const out={};const src=d.auto||{};for(const k in src){const dsl=String(src[k]||'').trim();if(!dsl)continue;const r=window.OM_FX?window.OM_FX.parse(dsl):{ops:[]};out[String(k).replace(/『|』/g,'')]={dsl,ops:r.ops}}
    /* 제작기 「상세 조정」 탭: 상태 변화 사양 → 「상태수정」 줄 (OM_FX.stMod 가 읽는다) */
    const tst=((d.tune||{}).st||[]).filter(x=>x&&x.st&&/^\d+\/\d+$/.test(String(x.v||'').replace(/\s+/g,''))).map(x=>`상태수정 ${x.st} ${String(x.v).replace(/\s+/g,'')}`).join('\n');
    if(tst){const r=window.OM_FX?window.OM_FX.parse(tst):{ops:[]};out['상세 조정']={dsl:tst,ops:r.ops}}return out})(),
   ...(!item0&&d.item&&(own||ET.it)?{itemOwn:{name:String(d.item),eff:brN(item.eff||''),auto:String(own?own.auto||'':ET.itAuto||''),cons:!!(own?own.cons:ET.itCons)}}:{}),
   ...(()=>{const tu=d.tune||{};const dsl=String(tu.item||'').trim();return dsl?{itemTune:{item:String(tu.itemName||d.item||''),dsl}}:{}})(),
   ...(()=>{const c=(d.tune||{}).crit;if(!c||typeof c!=='object')return {};const r={};if(c.tbl!=null&&c.tbl!=='')r.tbl=+c.tbl;if(+c.add)r.add=+c.add;if(+c.guard)r.guard=+c.guard;if(+c.dmg)r.dmg=+c.dmg;if(c.sure)r.sure=1;if(c.never)r.never=1;return Object.keys(r).length?{critRule:r}:{}})(),   /* 제작기 상세 조정 「급소 규칙」 (10-23 망령) */
   fields:fieldsOf(d.fields),rank:{attack:0,defense:0,specialattack:0,specialdefense:0,speed:0,accuracy:0,evasion:0,critical:0},states:{},forms:formsOf(d,base,L)}}

 /* 소지품 2 · 3번 칸 (제작기 items2, 10-24 망령): DB → 오리지널(itemOwn) → 시트 사본(effTxt.its2) 순으로 글을 찾는다 */
 function itemsX(d,ET){return (Array.isArray(d.items2)?d.items2:[]).slice(0,2).map((x,k)=>{const n=String((x&&x.item)||'');if(!n)return {item:'',itemEff:''};const r=(DB().items||{})[n];const own=x.itemOwn&&x.itemOwn.name===n?x.itemOwn:null;const et=((ET.its2||[])[k])||{};const eff=brN(r?r.eff||'':own?own.eff||'':et.it||'');
  return Object.assign({item:n,itemEff:eff},!r&&(own||et.it)?{itemOwn:{name:n,eff,auto:String(own?own.auto||'':et.itAuto||''),cons:!!(own?own.cons:et.itCons),sock:own?String(own.sock||''):''}}:{})})}
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
  /* 10-23 망령: pids 에 빠진 포켓몬도 그 트레이너 것(tid)이면 뒤에 붙인다 */
  for(const x of pokeDocs)if(x&&x.data&&x.data.tid===tr.id&&!tr.pids.includes(x.id))tr.pids.push(x.id);
  const mons=tr.pids.map(id=>byId.get(id)).filter(Boolean).map(x=>pokemon(x,tr));
  return {trainer:tr,mons}}

 return {trainer,pokemon,move,party,roleOf};
})();
