/* ---------- 배틀 계산 엔진 (맵툴 Lib:pokemon 의 get_turn_order / attack_target_once / calculate_damage / damage_target / hp_damage 를 순수 함수로) ----------
   여기엔 화면·저장이 없다. 입력 → 결과만 돌려준다. 주사위는 opts.rng 로 바꿔 끼울 수 있다(시험용). */
"use strict";
window.OM_BATTLE=(()=>{
 const S=()=>window.OM_STATS;
 const DB=()=>window.OM_DB||{};
 const C=()=>(DB().const||{});
 const STATS=['hp','attack','defense','specialattack','specialdefense','speed'];
 const RANKED=['attack','defense','specialattack','specialdefense','speed','accuracy','evasion'];
 const rng=o=>(o&&o.rng)||Math.random;
 const d=(o,n)=>1+Math.floor(rng(o)()*n);           /* 1..n */
 const floor=Math.floor;

 /* 능력치 실수치 × 랭크 × mod (get_status_values). ignore: -1 없음 / 0 상승(랭크+)·강화(배율) 무시 / 1 감소·저하 무시 / 2 랭크 상승만 / 3 배율 강화만 / 4 랭크 감소만 / 5 배율 저하만 / 6 랭크 변화 모두 / 7 랭크·배율 변화 모두 / 8 배율 변화 모두 */
 function statValue(mon,stat,opt){
  opt=opt||{};const base=stat==='accuracy'||stat==='evasion'?1:(mon.stats[STATS.indexOf(stat)]||0);
  let r=+((mon.rank||{})[stat]||0),m=+((mon.mod||{})[stat]||1);
  if(opt.rank!=null)r=+opt.rank;if(opt.mod!=null)m=+opt.mod;
  const ig=opt.ignore==null?-1:+opt.ignore;
  if(r>0&&(ig===0||ig===2||ig===6||ig===7))r=0;if(r<0&&(ig===1||ig===4||ig===6||ig===7))r=0;   /* 6 = 랭크 변화 모두 (천진 · 성스러운칼) · 7 = 랭크+배율 모두 */
  if(m>1&&(ig===0||ig===3||ig===7||ig===8))m=1;if(m<1&&(ig===1||ig===5||ig===7||ig===8))m=1;
  const rv=(stat==='accuracy'||stat==='evasion')?S().accMult(r):S().rankMult(r);
  return {value:base*rv*m,rank:r,rankMult:rv,mod:m}}

 const has=(mon,st)=>!!((mon.states||{})[st]);

 /* ----- 행동 순서 (get_turn_order) -----
    mons: 등장한 포켓몬 배열 [{mon, cmd}], cmd = {change, priorityMap:{slot:n}, orderMap:{slot:n}}  (다른 포켓몬의 지시가 내 칸에 넣은 값도 합산)
    field: {trick:bool}  →  정렬 키: started(턴 도중 등장은 뒤) > change(교대 먼저) > order(20 기준) > priority > speed > dice */
 function turnOrder(entries,field,opts){
  field=field||{};
  const rows=entries.map(e=>{
   const mon=e.mon,slot=e.slot;
   let order=20,prio=0;
   for(const o of entries){const cmd=o.cmd||{};
    const oc=cmd.orderMap&&cmd.orderMap[slot];if(oc!=null&&oc!==''){const v=+oc;if(v>20)order=Math.max(order,v);else if(v<20&&order!==50)order=Math.min(order,v)}
    const pc=cmd.priorityMap&&cmd.priorityMap[slot];if(pc!=null&&pc!=='')prio+=+pc}
   prio+=+(e.prioMod||0);
   let spd=statValue(mon,'speed',{mod:((mon.mod||{}).speed||1)*(e.scarf?1.5:1)*(e.tailwind?2:1)*(e.swamp?0.25:1)*(+e.spMul||1)}).value;   /* spMul: 날씨 · 필드 조건 스피드 특성 (10-26) */
   if(has(mon,'Paralysis'))spd*=(+C().campaign.value_paralysis||0.5);
   if(field.trick)spd*=-1;
   return {slot,mon,started:e.started?1:0,change:(e.cmd&&e.cmd.change)?1:0,order,prio,speed:spd,dice:d(opts,10000)}});
  /* 맵툴 json.sort "d" = 내림차순: started 1(턴 개시 때 필드에 있던 포켓몬)이 먼저, 턴 도중 등장(0, 「교대 등장」)은 뒤 */
  rows.sort((a,b)=>(b.started-a.started)||(b.change-a.change)||(b.order-a.order)||(b.prio-a.prio)||(b.speed-a.speed)||(b.dice-a.dice));
  return rows}

 /* ----- 명중 (calculate_attack → attack_target_once) ----- */
 function accuracy(atk,def,move,o){
  o=o||{};
  if(!move.acc||o.sureHit)return {sure:true,hit:true,target:0,roll:0};
  const env=(o.env||1)*(o.starry?1.1:1)*(o.fog&&!o.fogImmune?0.9:1)*(o.wideLens?1.1:1)*(o.gravity?1.67:1);
  const av=statValue(atk,'accuracy',{ignore:o.ignoreAcc});
  const acc=floor(+move.acc*(+o.accMult||1)*av.rankMult*(av.mod*env)*100);
  const ev=statValue(def,'evasion',{ignore:o.ignoreEva});
  const eva=floor(ev.rankMult*ev.mod*(o.evaMult||1)*100);
  const target=floor(acc/eva*100);
  const roll=d(o,10000);
  return {sure:false,hit:roll<=target,target,roll,acc,eva}}

 /* ----- 급소 (get_target_critical 계열) ----- stage = C랭크+버프+입력+지시보정+아이템+기합 - 방호 */
 const CRIT={0:[625,1250,2500,5000,10000],2:[625,1250,2500,3333,5000],1:[625,1250,5000,10000,10000],3:[417,1250,5000,10000,10000]};   /* 0 기본 · 2 5세대(1/16→1/8→1/4→1/3→1/2) · 1 6세대(1/16→1/8→1/2→1) · 3 7세대 이후(1/24→1/8→1/2→1) */
 function critical(stage,o){
  o=o||{};const tbl=CRIT[o.type||0]||CRIT[0];
  const s=Math.max(0,Math.min(tbl.length-1,floor(stage)));
  const p=tbl[s];const roll=o.forced?0:d(o,10000);
  return {stage:s,chance:p,roll,crit:!!o.forced||roll<=p}}
 function critStage(atk,def,o){
  o=o||{};let s=+((atk.rank||{}).critical||0)+(+o.buff||0)+(+o.input||0)+(+o.order||0)+(o.scopeLens?1:0)+(has(atk,'FocusEnergy')?2:0);
  s-= +((def.guard||{}).critical||0);s+=(+o.cond||0);return s}

 /* ----- 대미지 (calculate_damage + damage_target) : 상성·자속은 제외 -----
    o: {atkStat,defStat (기본 move.cat), accMult, free1, free2, item1, item2, trait, weather, helping, charge, watersport, mudsport, powerBoost,
        multiTarget, wall:{reflector,lightscreen,icewall,aurora}, wallSize(1 싱글/2 더블+), ignoreAtk, ignoreDef, scarf, tailwindDef, swampDef, choiceDef,
        critGen(1.5|2), critDamage(0 기본/1 ×1.5/2 ×2/3 고정 2.5), lifeOrb, burnGuts, hits:[1|2|0 ...] (hit_log) } */
 function damage(atk,def,move,o){
  o=o||{};
  const cat=move.cat==='특수'?'special':'physical';
  const atkStat=o.atkStat||(cat==='special'?'specialattack':'attack');
  const defStat=o.defStat||(cat==='special'?'specialdefense':'defense');
  const L=floor(atk.lv*2/5+2);
  const free1=num(o.free1,1),free2=num(o.free2,1),item1=num(o.item1,1),item2=num(o.item2,1),trait=num(o.trait,1),weather=num(o.weather,1);
  let P=(+o.power||+move.pow||0)*(o.helping?1.5:1)*free1*free2*item1*item2*(o.charge?2:1)*trait*(o.watersport?0.5:1)*(o.mudsport?0.5:1)*num(o.powerBoost,1);
  const burn=(cat==='physical'&&has(atk,'Burn')&&!(has(atk,'Guts')||o.burnGuts))?0.5:1;
  const M=burn*(o.multiTarget?0.75:1)*weather*num(o.fieldMul,1);
  let wall=1;const ws=o.wallSize>=2?0.667:0.5;const w=o.wall||{};
  if((cat==='physical'&&w.reflector)||(cat==='special'&&w.lightscreen)||w.aurora||w.icewall)wall=ws;   /* 10-25 망령: 얼음의장벽은 「기술로 받을 대미지」 — 물리 · 특수 둘 다 */
  const critMul=(o.critGen===2?2:1.5)*(o.critDamage===1?1.5:o.critDamage===2?2:1);
  const critValue=num(o.critMul,0)>0?+o.critMul:(o.critDamage===3?2.5:critMul);   /* critMul: 포켓몬마다 급소 배율 (제작기 상세 조정) */
  /* 급소 때 1 미만 보정을 1 로 되돌리는 역수 (input_damage_mod_reverse) */
  let rev=1;if(free1>0&&free1<1)rev/=free1;if(free2>0&&free2<1)rev/=free2;if(trait>0&&trait<1)rev/=trait;
  const hits=o.hits&&o.hits.length?o.hits:[1];
  const out=[];let total=0,minSum=0,maxSum=0;
  for(const h of hits){
   const crit=h===2;
   const Pc=crit?P*rev:P;
   const av=statValue(atk,atkStat,{ignore:crit&&(o.ignoreAtk===1||o.ignoreAtk===4||o.ignoreAtk===5)?-1:o.ignoreAtk,/* 10-26 점검: 급소는 공격 측 하락만 이미 지우므로 하락 코드만 버린다 (전엔 상승 코드를 버려 천진류가 급소에 무력했다) */rank:crit&&+((atk.rank||{})[atkStat]||0)<0?0:undefined,mod:crit&&+((atk.mod||{})[atkStat]||1)<1?1:undefined});
   let A=av.value*(o.scarf&&atkStat==='speed'?1.5:1);
   if(has(atk,'Paralysis')&&atkStat==='speed')A*=(+C().campaign.value_paralysis||0.5);
   /* 원더룸: 방어·특방 실수치만 맞바꾸고 랭크·배율은 원래 능력 것을 쓴다 */
   const wS=o.wonder&&(defStat==='defense'||defStat==='specialdefense')?(defStat==='defense'?'specialdefense':'defense'):defStat;
   const dv=statValue(def,wS,{ignore:crit?(o.ignoreDef==null||o.ignoreDef===-1?0:o.ignoreDef===3?0:o.ignoreDef===1?7:o.ignoreDef===4?6:o.ignoreDef===5?0:o.ignoreDef):o.ignoreDef,/* 급소: 방어 측 상승은 늘 무시 + 호출자가 준 무시를 합친다 */rank:+((def.rank||{})[defStat]||0),mod:((def.mod||{})[defStat]||1)*(o.choiceDef?1.5:1)*(o.tailwindDef&&defStat==='speed'?2:1)*(o.swampDef&&defStat==='speed'?0.25:1)});
   let D=dv.value*num(o.defMul,1);if(has(def,'Paralysis')&&defStat==='speed')D*=(+C().campaign.value_paralysis||0.5);
   const wallCur=crit?1:wall;
   const base=floor(floor(L*Pc*A/50)/D)*(M*wallCur)+2;
   let m2=1;if(crit)m2*=critValue;if(o.lifeOrb)m2*=1.3;
   const res=base*m2;const mn=floor(res*0.85),mx=floor(res);
   const rnd=(d(o,16)+84)/100;const val=h>0?floor(res*rnd):0;
   out.push({hit:h,crit,base:res,min:mn,max:mx,rnd,value:val,A,D,L,P:Pc,M,wall:wallCur});
   if(h>0){total+=val;minSum+=mn;maxSum+=mx}}
  return {hits:out,total,min:minSum,max:maxSum,cat,atkStat,defStat,L,P,M,wall,critValue}}
 function num(v,dflt){return v==null||v===''||isNaN(+v)?dflt:+v}

 /* ----- 상성 (get_type_value / get_type_value_multiple) -----
    moveTypes: 기술 타입(영문) 1~3개, def: 포켓몬, o:{multiMode 0 첫타입/1 최고/2 최저, atkTypes:공격자 타입, force:null|2|1|0.5|0, floating, tera} */
 function effectiveness(moveTypes,def,o){
  o=o||{};const defTypes=def.teraActive&&def.teraEn&&def.teraEn!=='-'?[def.teraEn]:(def.types||[]);
  const one=t=>{
   if(t==='Shadow'||t==='Wild')return 2;if(t==='God')return 1;
   if(t==='Ground'&&(o.floating||has(def,'MagnetRise')||has(def,'Telekinesis')))return 0;
   return S().effect(t,defTypes)};
  const vals=moveTypes.filter(t=>t&&t!=='-').map(t=>({type:t,v:one(t),stab:(o.atkTypes||[]).includes(t)}));
  if(!vals.length)return {value:1,type:'-',stab:false,all:vals};
  let pick=vals[0];const mode=+o.multiMode||0;
  if(mode===1){pick=vals.reduce((a,b)=>b.v>a.v||(b.v===a.v&&b.stab&&!a.stab)?b:a)}
  else if(mode===2){pick=vals.reduce((a,b)=>b.v<a.v||(b.v===a.v&&!b.stab&&a.stab)?b:a)}
  let value=pick.v;if(o.force!=null&&o.force!=='')value=+o.force;
  return {value,type:pick.type,stab:pick.stab,all:vals}}

 /* ----- 피격 (hp_damage) : amount(공격 측 합계) × 상성 × 자속 × 수동mod × 달인의띠 × 반감열매 × 버텨라 등 ----- */
 function hpDamage(def,amount,eff,o){
  o=o||{};
  const stabMul=o.stab?(o.adaptability?2:1.5):1;
  let v=amount*eff*stabMul*num(o.manual,1)*(o.expertBelt&&eff>1?1.2:1)*(o.berryHalf?0.5:1)*num(o.guard,1)*num(o.defMod,1);
  v=floor(v);
  if(o.applyOdd){v+=def.hpOdd?1:0}
  let final=v;
  if(eff>0&&amount>0)final=Math.max(Math.min(v,def.hp.cur),1);else final=Math.min(v,def.hp.cur);
  if(eff===0)final=0;
  const floorHp=+(o.hpFloor||0);if(floorHp>0&&def.hp.cur-final<floorHp)final=Math.max(0,def.hp.cur-floorHp);
  if(o.endure&&def.hp.cur-final<1)final=def.hp.cur-1;
  return {raw:v,final,after:def.hp.cur-final,eff,stabMul}}

 /* ----- 비례 대미지·회복 (state_turnend) ----- */
 const FRAC={Poison:-1/8,Toxic:-1/8,Burn:-1/16,Nightmare:-1/4,Curse:-1/4,Bind:-1/8,AquaRing:1/8,Ingrain:1/16,GrassySong:1/16};
 function fraction(mon,f){const v=floor(mon.hp.max*Math.abs(f));return Math.max(1,v)}
 function turnEnd(mon){
  const out=[];const st=mon.states||{};
  for(const k in FRAC){if(!st[k])continue;const f=FRAC[k];const v=fraction(mon,f);out.push({state:k,delta:f<0?-Math.min(v,mon.hp.cur):Math.min(v,mon.hp.max-mon.hp.cur)})}
  return out}

 /* ----- 연속기 횟수 (attack_target_once) ----- */
 function multiHits(move,o){o=o||{};const mn=+move.min||1,mx=+move.max||1;if(mx<=1)return 1;if(o.skillLink)return mx;return mn+Math.floor(rng(o)()*(mx-mn+1))}

 return {STATS,RANKED,statValue,turnOrder,accuracy,critical,critStage,damage,effectiveness,hpDamage,turnEnd,multiHits,FRAC};
})();
