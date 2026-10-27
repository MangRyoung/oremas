/* 공격 한 번 — 웹툴 공격 창(battle_ui.js openAttack)의 「굴리기 → 적용」과 받는 쪽 「HP」 창(openHp)의 「적용」을 버튼 없이 한다 (10-27 밤).
   계산 순서 · 쓰는 함수는 웹툴과 같다(웹툴 함수는 lib/webtool.js 가 꺼내 둔 H.fn). 창의 칸 기본값 = 사람이 손대지 않았을 때 값:
     명중 배율 = 「통솔」 명중(leadAcc) · 아이템1 = OM_ITEMS.atkMul · 특성 = 스킨 특성 · 날씨 = WEATHER_MUL · 필드 = 땅 위 공격자의 필드 강화 · 자유1 = 효과 엔진 강화(boost) · 급소 확정 = 기술 자동화(critSure)
     HP 창: 반감열매 · 버티기(버텨라 · 기합의띠 확정) · 멀티스케일류 · 탈 · 피격 특성 반응 = 켜짐(창의 기본 체크와 같다)
   사람이 켜던 칸(GM 판단): 달인의띠 = 소지품이 달인의띠면 켠다 · 스킬링크 = 특성이 스킬링크면 켠다 · 적응력 · 생명의구슬 · 도우미는 끈다(적응력은 효과 엔진이 이미 ×1.33, 생명의구슬은 밴).
   웹툴과 다른 점: 「행동 판정」(혼란 · 마비 …)을 늘 켠다 · 창을 다시 여는 일 · 손으로 바꾸는 칸 · 「손으로」 문장(notes)은 없다. */
"use strict";
async function attack(H,W,mid,idx,targets,o){o=o||{};
 const FN=H.fn,B=W.OM_BATTLE,FX=W.OM_FX,OI=W.OM_ITEMS,F=W.OM_FIELD,MA=W.OM_MOVEAUTO,S=W.OM_STATS,DB=W.OM_DB||{};const R=Math.random.bind(W.Math);const rnd=()=>W.Math.random();
 const c=FN.ctx();const b=c.b;const atk0=b.mons[mid];if(!atk0||!atk0.entry||atk0.hp.cur<=0)return {skip:'없음'};const f=FN.fieldOf(b);
 const RM=k=>+((f.rooms||{})[k]||0)>0;
 const TYS0=[['Electrify','Electric'],['Flooding','Water'],['Knave','Dark']].filter(([k])=>+((atk0.states||{})[k]||0)>0);const ATY=TYS0.length?TYS0[TYS0.length-1][1]:'';
 const tyOf=mv=>ATY||(RM('블랙룸')&&mv.cat!=='변화'?'Ghost':((FN.skinOf(atk0,mv)||{}).ty||mv.typeEn));
 const mtys=mv=>ATY?[ATY]:(RM('블랙룸')&&mv.cat!=='변화'?['Ghost']:FN.skinOf(atk0,mv)?[FN.skinOf(atk0,mv).ty]:String(mv.type||'').split(/[()/,]/).map(t=>t.trim()).filter(Boolean).map(S.typeEn));
 const mv=FN.MVS(atk0)[idx];if(!mv)return {skip:'기술 없음'};
 const out={mv:mv.name,lines:[],hits:[],fail:''};
 /* 행동 판정 (창의 「행동 판정」 칸 — 시뮬은 늘 켠다) */
 let chk=null;
 if(F&&['Flinch','Sleep','Paralysis','Freeze','Attract','Confusion'].some(k=>(atk0.states||{})[k])){const am=JSON.parse(JSON.stringify(atk0));const r=F.actionCheck(am);
  if(!r.ok){let self=0;if(r.selfHit){self=F.confusionHit(am);am.hp.cur=Math.max(0,am.hp.cur-self);r.lines.push(`${am.name} 자작 대미지 −${self}`)}
   const nb0=FN.snap(),nb=FN.snap(nb0);const x=nb.mons[mid];x.states=am.states;if(self){x.hp.latest=x.hp.cur;x.hp.cur=Math.max(0,x.hp.cur-self)}if(x.hp.cur<=0)x.entry='';await FN.saveBattle(nb0,nb);
   out.fail=r.lines.join(' / ');out.lines.push(...r.lines);if(H.logOn)W.OM_APP.sysLog(`【행동 실패】 ${atk0.name} — ${out.fail}`,'battle');return out}
  chk={am,lines:r.lines}}
 /* 「반동 : 행동불능」 쉬는 턴 */
 if(+((atk0.states||{}).Recharge||0)===1){out.fail='반동 : 행동불능';return out}
 const atk=atk0;
 /* 대상 */
 const slots=FN.allEntered(b);targets=(targets||[]).filter(s=>slots.some(z=>z.slot===s));
 if(!targets.length&&mv.cat!=='변화'){const foes=slots.filter(z=>!FN.sameT(z.mon,atk,b));if(foes.length)targets=[foes[0].slot]}
 if(!targets.length)targets=FN.defaultTargets?FN.defaultTargets(b,mid,String(idx)):[];
 if(!targets.length){out.fail='대상 없음';return out}
 /* 기술 방어 */
 const PROT=FN.protMove(mv);let PR=null;if(PROT){const t0=+b.turn||0;const k=atk.protectLast===t0-1?(+atk.protectN||0):0;const ch=Math.pow(1/3,k);const rl=rnd();PR={ok:rl<ch,chance:Math.round(ch*1000)/10,k}}
 const PBY=FN.protBypass(mv);const NX=(FX&&FX.nextOf)?FX.nextOf(atk):[];
 const moveTypes=mtys(mv);const atkTypes=atk.teraActive&&atk.teraEn!=='-'?[...atk.types,atk.teraEn]:atk.types;
 /* 창 칸 기본값 */
 const T0=tyOf(mv);const wm=FN.WEATHER_MUL[f.weather.type]||{};const wMul=wm[T0]!=null?wm[T0]:1;const sk=!ATY&&FN.skinOf(atk,mv);const traitMul=sk?sk.mul:1;
 let fm=1;const ft=f.terrain.type;if(FN.grd(atk)){if(ft==='그래스필드'&&T0==='Grass')fm=1.3;if(ft==='일렉트릭필드'&&T0==='Electric')fm=1.3;if(ft==='사이코필드'&&T0==='Psychic')fm=1.3}
 const im=OI?OI.atkMul(atk,{types:mtys(mv),cat:mv.cat,single:String(mv.range||'')==='1체'}):null;const item1=im?im.v:1;
 let pow=+mv.pow||FN.powStepOf(mv)||0;{const oe=(b.order||[]).find(z=>z.mid===mid&&z.pursuitHit);const pv=oe&&b.mons[oe.pursuitHit];if(oe&&pv&&pv.entry&&String(mv.name)===String(oe.move)&&FN.pursuitX2&&FN.pursuitX2(mv))pow=(+mv.pow||0)*2}
 {const e=String(mv.eff||''),Wt=String(f.weather.type||'');const half=e.match(/「날씨\s*:\s*([^」]+)」일 때 위력을 반감/);if(half&&Wt&&half[1].split(/[,，]\s*/).map(x=>x.trim()).includes(Wt))pow=Math.floor((+mv.pow||0)/2)}
 const MAU0=FN.moveAuto(mv),MAU=MA&&MA.auto(MAU0)?MAU0:null;
 const critForce=!!(MAU0&&MAU0.critSure);const charge=mv.cat!=='변화'&&Object.keys(FN.CHARGE_ST).some(k=>(atk.states||{})[k]&&tyOf(mv)===FN.CHARGE_ST[k]);
 const belt=FN.IT(atk)==='달인의띠',skill=String(atk.ability||'').replace(/^특성\s*:\s*/,'')==='스킬링크';
 const accMul=FN.leadAcc(atk);const sure0=false;
 const res=[];const multiTarget=targets.length>1;const SPW=FN.specialPowFor(mv.name,atk);
 /* 부가효과 확률 보정은 효과 엔진(chance) 기본값 — 창 칸 asecadd/asecsure */
 const SECADJ={add:FN.secAdd0?FN.secAdd0(atk):0,sure:FN.secSure0?FN.secSure0(atk):false};
 for(const slot of targets){const [side,area]=slot.split('_');const def=FN.entered(b,side)[area];if(!def)continue;
  const AF=atk.flags||{},DF=def.flags||{};const phys=mv.cat==='물리',spec=mv.cat==='특수';
  const sure=sure0||AF.surehit||(phys&&AF.hitPhys)||(spec&&AF.hitSpec)||!!(FX&&FX.nextOf&&FX.nextOf(atk).some(e=>e.sure));const IG=FX?FN.iuIgnore(atk,def):{};
  const sureMv=sure||!(+mv.acc);const autoMiss=((phys&&DF.dodgePhys)||(spec&&DF.dodgeSpec))&&!sureMv||AF.acc0;
  const psyBlock=f.terrain.type==='사이코필드'&&!FN.sameT(def,atk)&&FN.grd(def)&&(FX?FX.prioOf(atk,mv):(+mv.prio||0))>0;
  const itImm=OI&&mv.cat!=='변화'?OI.immune(def,moveTypes):'';
  const wideBlock=def!==atk&&+(((f.objects||{})[def.side]||{})['와이드가드']||0)>0&&(multiTarget||/전체|자신\s*이외/.test(String(mv.range||'')));
  const protBlock=def!==atk&&!PBY&&(def.flags||{}).protect===(+b.turn||0)&&def.hp.cur>0;
  const accRoll=()=>protBlock?{prot:1,sure:false,hit:false}:wideBlock?{sure:false,hit:false,note:'와이드가드'}:itImm?{sure:false,hit:false,note:itImm}:psyBlock?{sure:false,hit:false,note:'사이코필드'}:autoMiss?{sure:false,hit:false,note:'회피'}:
   B.accuracy(atk,def,{acc:mv.acc},{accMult:accMul,sureHit:sure,starry:f.weather.type==='별하늘',fog:f.weather.type==='짙은안개',fogImmune:moveTypes.some(t=>t==='Poison'||t==='Fairy')||FN.tysOf(atk).some(t=>t==='Poison'||t==='Fairy'),gravity:(f.etc||{})['중력']>0,wideLens:FN.IT(atk)==='광각렌즈',ignoreAcc:IG.acc,ignoreEva:IG.eva,rng:rnd});
  const acc=accRoll();
  const floating=(def.states||{}).MagnetRise||(def.states||{}).Telekinesis||(FX&&FX.floating(def))||FN.IT(def)==='풍선';
  const effPre=mv.cat==='변화'?null:B.effectiveness(moveTypes,def,{multiMode:0,atkTypes,force:null,floating});
  const mods=FX?FX.attackMods(atk,def,Object.assign(FN.moveQuery(atk,def,mv,moveTypes,effPre?effPre.value:1,!multiTarget),{stab:!!(effPre&&effPre.stab)})):{boost:1,guard:1,cg:0,cr:0,cx:'',names:[]};
  {const ig=OI&&OI.defGuard(def,mv.cat);if(ig){mods.guard=(mods.guard||1)*ig.v;mods.names=(mods.names||[]).concat([{key:'_i',who:def.id,txt:ig.txt}])}}
  let igDef=-1,igAtk=-1;if(IG.def!=null)igDef=IG.def;if(IG.atk!=null)igAtk=IG.atk;if(igDef===-1&&/대상의\s*랭크\s*변화를\s*무시/.test(String(mv.eff||'')))igDef=6;
  const OC=FN.orderCrit(atk,def);
  if(mods.cx!=='none'&&FN.CRR(def).never)mods.cx='none';
  if(mods.cx!=='none'){const nc=[[def.ability,def.abilityEff],...FN.potSrc(def).map(p=>[p.name,p.eff])].find(([n,e])=>n&&/자신의\s*급소에\s*맞지\s*않는다/.test(String(e||'')));if(nc)mods.cx='none'}
  let hits=[];if(acc.hit){const mx=+mv.max||1,mn=+mv.min||1;const cnt=B.multiHits(mv,{skillLink:skill,rng:rnd});const fixedN=mx>1&&mn===mx&&!skill&&!acc.sure;const stage=B.critStage(atk,def,{input:0,order:OC.v+(mods.cr||0)-(mods.cg||0)+FN.itemCrit(atk,def)+FN.crAdj(atk,def)});
   for(let i=0;i<cnt;i++){if(i>0&&fixedN){const a2=accRoll();if(!a2.hit)break}const cr=mods.cx==='none'?{crit:false}:B.critical(stage,{type:+FN.CRR(atk).tbl||0,forced:critForce||mods.cx==='sure'||!!FN.CRR(atk).sure,rng:rnd});hits.push({v:cr.crit?2:1,cr})}}
  const objs=(f.objects||{})[side]||{};const wall={};for(const k in FN.WALLS)if(objs[k]>0&&!(k==='얼음의장벽'&&tyOf(mv)==='Fire'))wall[FN.WALLS[k]]=1;
  if(objs['얼음의장벽']>0&&tyOf(mv)==='Fire'&&mv.cat!=='변화'){const nb0=FN.snap(),nb=FN.snap(nb0);const fo=FN.fieldOf(nb);delete fo.objects[side]['얼음의장벽'];nb.field=fo;await FN.saveBattle(nb0,nb)}
  const spw=SPW?SPW(def):null;const powT=spw&&spw.pow!=null?spw.pow:pow;
  const dTy=FN.tysOf(def),dS=mv.cat==='특수'?'specialdefense':'defense';const fieldT=fm*(f.terrain.type==='미스트필드'&&moveTypes.includes('Dragon')&&FN.grd(def)?0.5:1);
  const wt=f.weather.type;const defMul=(['눈','싸라기눈','극한'].includes(wt)&&dTy.includes('Ice')&&dS==='defense')?1.5:(wt==='모래바람'&&dTy.includes('Rock')&&dS==='specialdefense')?1.5:1;
  let MVP=null,DOPT=null;const dmg=mv.cat==='변화'||!powT||(spw&&spw.fixed)||(MAU&&MAU.delay)||!hits.length?null:B.damage(FN.foulAtk(atk,def,mv),def,MVP=Object.assign({},mv,{pow:powT},ATY?{typeEn:ATY,type:S.typeKo(ATY)}:sk?{typeEn:sk.ty,type:S.typeKo(sk.ty)}:{}),DOPT={critMul:FN.critMulOf(atk),hits:hits.map(h=>h.v),powStep:spw?0:FN.powStepOf(mv),free1:1*(mods.boost||1),free2:1,item1,item2:1,trait:traitMul,weather:wMul,fieldMul:fieldT,defMul,wonder:RM('원더룸'),helping:false,charge,lifeOrb:false,multiTarget,wall,wallSize:FN.mode(b)>=2?2:1,ignoreAtk:igAtk,ignoreDef:igDef,watersport:(f.etc||{})['물놀이']>0,mudsport:(f.etc||{})['흙놀이']>0,scarf:FN.IT(atk)==='구애스카프',choiceDef:false,tailwindDef:((f.objects||{})[side]||{})['순풍']>0,swampDef:((f.objects||{})[side]||{})['습원']>0,rng:rnd});
  /* 고정 · 변칙 피해(spw.fixed): 웹툴은 HP 창에서 손으로 — 시뮬은 spw.dmg 가 있으면 그 값 */
  const eff=dmg?B.effectiveness(moveTypes,def,{multiMode:0,atkTypes,force:null,floating}):(effPre||null);
  const stab=eff?eff.stab:false;const DFl=def.flags||{};
  const guard0=(DFl.endure?0.5:1)*(mods.guard||1);const endure0=(!!DFl.endure&&!DFl.endureUsed||!!mods.endure)&&!AF.noEndure;
  res.push({slot,def,acc,hits,dmg,eff,stab,guard:guard0,endure:endure0,mods,spw,sec:[...(acc.hit?(MAU?MAU.groups.filter(g=>g.who==='target').map(g=>rollG(FN,atk,def,g,SECADJ,rnd)):[]):[])]})}
 const anyHit=res.some(r=>r.acc.hit);const once=MAU?MAU.groups.filter(g=>g.who!=='target'&&(anyHit||g.when==='use')).map(g=>rollG(FN,atk,null,g,SECADJ,rnd)):[];
 /* ===== 적용 (공격 창 「적용」) ===== */
 const nb0=FN.snap(),nb=FN.snap(nb0);const lines=out.lines;
 if(chk){nb.mons[mid].states=chk.am.states;lines.push(...chk.lines)}
 {const a=nb.mons[mid];const ty=tyOf(mv);if(a&&a.states&&res.some(r=>r.acc.hit&&r.dmg))for(const k in FN.CHARGE_ST)if(a.states[k]&&FN.CHARGE_ST[k]===ty)delete a.states[k]}
 {const a=nb.mons[mid];const sdb=(DB.states||{}).st||{};const st=(a&&a.states)||{};for(const k of Object.keys(st)){const d=sdb[k]||{};const v=+st[k];if(!FN.movesDown(k,d)||!(v>0&&v<1000))continue;if(chk&&(k==='Sleep'||k==='Confusion'||k==='Freeze'))continue;if(v<=1)delete st[k];else st[k]=v-1}}
 if(PR){const a=nb.mons[mid];const t0=+nb.turn||0;if(PR.ok){a.flags=Object.assign({},a.flags||{},{protect:t0});a.protectLast=t0;a.protectN=PR.k+1;lines.push(`${a.name} 「기술 방어」`)}else{if(a.flags)delete a.flags.protect;a.protectLast=null;a.protectN=0;lines.push(`${a.name} 「기술 방어」 실패`)}}
 if(PBY==='clear')for(const r of res){const d=nb.mons[r.def.id];if(r.acc.hit&&d&&d.flags&&d.flags.protect!=null)delete d.flags.protect}
 const am=r=>(r.stab?1.5:1)*(belt&&r.eff&&r.eff.value>1?1.2:1);   /* 창의 atkMul: 자속 × 달인의띠 (적응력은 효과 엔진) */
 for(const r of res){const def=nb.mons[r.def.id];if(!def)continue;
  if(!r.acc.hit){out.hits.push({to:def.name,miss:true,note:r.acc.prot?'기술 방어':r.acc.note||'빗나감'});continue}
  if(!r.dmg){out.hits.push({to:def.name,status:true});continue}
  const crit=r.hits.some(h=>h.v===2);const A1=am(r);
  def.lastHit={from:atk.name,fromId:atk.id,move:mv.name,moveType:mv.type||'',eff:r.eff.value,total:Math.floor(r.dmg.total*A1),hits:r.hits.length,crit,per:FN.perOf(r.dmg,A1),guard:r.guard,guardNote:((r.mods&&r.mods.names)||[]).filter(x=>x.who===def.id).map(x=>x.txt).join(' · '),endure:r.endure,turn:+nb.turn||0,mt:moveTypes,cat:mv.cat||'',ct:W.OM_APP.contactOf(mv)==='O',multi:res.length>1};
  if(FX&&r.mods)FX.consume(nb,r.mods.names);if(def.flags&&def.flags.endure)def.flags.endureUsed=1}
 if(MAU&&FX){const a=nb.mons[mid];const cx0=W.__SIM.uiCtx(nb,a,mv.name);
  const runOps=async(ops,def)=>{const map=def?FN.tgtFor(atk,def):(q=>q);const cx=Object.assign({},cx0,def?{pick:list=>Promise.resolve(list.find(x=>x.id===def.id)||null)}:{});const r=await FX.run(ops.map(map),cx);lines.push(...r.lines)};
  for(const x of once)if(x.ok&&x.ops)await runOps(x.ops,null);
  for(const r of res)for(const x of (r.sec||[]))if(x.g&&x.ok&&x.ops){const d=nb.mons[r.def.id];if(d)await runOps(x.ops,d)}
  /* 드레인 · 반동은 예상 대미지(받는 쪽 HP 창 계산 전 값) 기준 — 웹툴과 같다 */
  const est=r=>{if(!r.dmg)return 0;const d=nb.mons[r.def.id];const hp=B.hpDamageHits(d||r.def,FN.perOf(r.dmg,am(r)),r.eff.value,Object.assign({},FN.hsOpt(d||r.def,mv.cat,r.mods),{stab:false,guard:r.guard,endure:r.endure,hpFloor:FN.raidFloor(d||r.def)}));return hp.final};
  const dealt=res.filter(r=>r.acc.hit&&r.dmg).reduce((s2,r)=>s2+est(r),0);
  if(MAU.recoil&&a.hp.cur>0){const R2=MAU.recoil;const base=R2.basis==='max'?a.hp.max:dealt;const ok=R2.when==='miss'?!anyHit:anyHit&&(R2.basis==='max'||dealt>0);if(ok&&!(!R2.hard&&(FX.noind(a,'recoil')||FX.noind(a,'')))){const [p,q]=R2.frac.split('/').map(Number);const v=Math.max(1,Math.floor(base*p/q));a.hp.cur=Math.max(0,a.hp.cur-v);lines.push(`${a.name} 반동 −${v}`)}}
  if(MAU.drain&&dealt>0&&a.hp.cur>0&&!(a.states||{}).HealBlock){const [p,q]=MAU.drain.split('/').map(Number);let v=Math.max(1,Math.floor(dealt*p/q));if(FN.IT(a)==='큰뿌리')v=Math.floor(v*1.3);const h=Math.min(v,a.hp.max-a.hp.cur);a.hp.cur+=h;lines.push(`${a.name} 드레인 +${h}`)}
  if(MAU.selfFaint&&a.hp.cur>0){a.hp.cur=0;lines.push(`${a.name} 사용 후 빈사`)}
  for(const id in nb.mons){const x=nb.mons[id];if(x.entry&&x.hp.cur<=0){x.entry='';lines.push(`${x.name}은(는) 쓰러졌다!`)}}}
 if(OI){const a=nb.mons[mid];const tags=String(mv.tag||'').split(/[,/·\s]+/).filter(Boolean);const dealtIds=res.filter(r=>r.acc.hit&&r.dmg).map(r=>r.def.id);try{lines.push(...OI.afterAttack(nb,a,{jewel:!!(im&&im.jewel&&item1>1),dealt:dealtIds,missAll:res.length>0&&!anyHit,tags}))}catch(e){}}
 fieldStrip(FN,nb,atk,mv,res,lines);
 {const tm2=String(mv.eff||'').match(/「난동부리기\s*\(혼란\)\s*:\s*(\d+)~(\d+)회」/);const a=nb.mons[mid];if(tm2&&a){a.states=a.states||{};if(!a.states.Thrash&&!a.thrashOn){const n=+tm2[1]+Math.floor(rnd()*(+tm2[2]-+tm2[1]+1));if(n>1){a.states.Thrash=n-1;a.thrashOn=1}}else if(!a.states.Thrash&&a.thrashOn){delete a.thrashOn;const cf=((DB.states||{}).st||{}).Confusion||{};const lo=+cf.min||1,hi=+cf.max||lo;a.states.Confusion=lo+Math.floor(rnd()*(hi-lo+1))}}}
 {const a=nb.mons[mid];const e=String(mv.eff||'');if(a&&a.hp.cur>0){a.states=a.states||{};if(/「반동\s*:\s*행동불능」/.test(e)&&anyHit)a.states.Recharge=2;if(mv.cat!=='변화'&&!(atk.states||{}).Thrash&&!a.states.Thrash&&FN.potSrc(a).some(p=>String(p.name||'').trim()==='버서커'))a.states.Thrash=2}}
 if(NX.length){const a=nb.mons[mid];const Fx=a.fx||{};const nk=NX.map(e=>e.key);Fx.mods=(Fx.mods||[]).filter(e=>!(e.next&&nk.includes(e.key)));Fx.prio=(Fx.prio||[]).filter(e=>!(e.next&&nk.includes(e.key)))}
 await FN.saveBattle(nb0,nb);
 /* ===== 받는 쪽 「HP」 창 「적용」 (대상마다) ===== */
 let dealtAll=0;
 for(const r of res){if(!r.acc.hit||!r.dmg)continue;const hv=await applyHit(H,W,r.def.id,rnd);if(hv){out.hits.push({to:r.def.name,dmg:hv.final,eff:r.eff.value,crit:r.hits.some(h=>h.v===2),ko:hv.ko,n:r.hits.length});dealtAll+=hv.final}}
 {const b2=FN.ctx().b;const a=b2.mons[mid];if(a)a.lastDealt={total:dealtAll}}
 /* 강제 교대 · 자기 교대 (적용 뒤) */
 out.forceSwitch=!!(MAU&&MAU.forceSwitch);out.selfSwitch=MAU&&MAU.selfSwitch?MAU.selfSwitch:(NX.some(e=>e.uturn)?'free':'');
 if(out.forceSwitch)for(const r of res){if(!r.acc.hit||r.def.id===mid)continue;const d=FN.ctx().b.mons[r.def.id];if(!d||!d.entry||d.hp.cur<=0)continue;const g=await FN.switchGuard(d);if(g)continue;await FN.forcedSwitch(d.id,{sys:true})}
 out.anyHit=anyHit;out.dealt=dealtAll;
 if(H.logOn)W.OM_APP.sysLog(`【공격】 ${atk.name} 『${mv.name}』${PR?(PR.ok?' (기술 방어 성공)':' (기술 방어 실패)'):''} ${out.hits.map(h=>'→ '+h.to+' '+(h.miss?'✗ '+h.note:h.status?'(변화)':'−'+h.dmg+(h.eff!==1?' ×'+h.eff:'')+(h.crit?' 급소':'')+(h.n>1?' '+h.n+'타':'')+(h.ko?' 쓰러짐':''))).join(' ')}${lines.length?'\n  '+lines.join('\n  '):''}`,'battle');
 return out}

/* 부가효과 굴림 = 웹툴 rollGroup (확률 보정 SECADJ 는 창 칸 기본값) */
function rollG(FN,atk,def,g,SA,rnd){let n=g.n;if(g.sec&&atk.ability==='하늘의은총')n=Math.min(10,n*2);
 if(g.sec&&def&&def.id!==atk.id&&FN.IT(def)==='은밀망토')return {g,ok:false};
 const pick=g.oneOf?g.oneOf[Math.floor(rnd()*g.oneOf.length)]:null;
 if(SA.sure)return {g,ok:true,ops:pick||g.ops};
 if(!SA.add||n>=10){if(n>=10)return {g,ok:true,ops:pick||g.ops};const r=1+Math.floor(rnd()*10);return {g,ok:r<=n,ops:pick||g.ops}}
 const p=Math.max(0,Math.min(100,n*10+(+SA.add||0)));if(p>=100)return {g,ok:true,ops:pick||g.ops};const r=1+Math.floor(rnd()*100);return {g,ok:r<=p,ops:pick||g.ops}}

/* 장벽 · 설치물 · 필드 철거, 와이드가드, 설치물 맞바꾸기 — 공격 창 적용과 같은 글 읽기 */
function fieldStrip(FN,nb,atk,mv,res,lines){const e=String(mv.eff||'');const hitAny=res.some(r=>r.acc.hit);const ok=!/명중(\s*후|했을\s*때)/.test(e)||hitAny;const f2=nb.field=FN.fieldOf(nb);f2.objects=f2.objects||{};const foe=atk.side==='left'?'right':'left';
 const HZ=[...FN.OBJ_CAT[2][4],...FN.OBJ_CAT[3][4]],WL=['리플렉터','빛의장막','오로라베일'];
 const strip=(side,list)=>{const o=f2.objects[side]=Object.assign({},f2.objects[side]||{});list.filter(k=>+o[k]>0).forEach(k=>delete o[k])};
 if(!ok)return;if(/적진의\s*「장벽」「신비의부적」「흰안개」/.test(e)){strip(foe,[...WL,'신비의부적','흰안개']);if(/필드 전체의\s*「+설치물」+/.test(e)){strip('left',HZ);strip('right',HZ)}}
 else{if(/자진의\s*「설치물」[^.]*철거/.test(e))strip(atk.side,HZ);if(/자진의\s*「장벽」[^.]*철거/.test(e))strip(atk.side,WL);else if(/「장벽」[^.]*철거/.test(e)){const sd=[...new Set(res.filter(r=>r.acc.hit&&r.def.side!==atk.side).map(r=>r.def.side))];(sd.length?sd:[foe]).forEach(s=>strip(s,WL))}}
 if(/「필드」[^.]*철거/.test(e)&&f2.terrain&&f2.terrain.type)f2.terrain={type:'',count:0};
 if(/「전체기 방어」\s*상태로/.test(e)){const o=f2.objects[atk.side]=Object.assign({},f2.objects[atk.side]||{});o['와이드가드']=1}
 if(/서로의 필드의 상태를 뒤바꾼다/.test(e)){const L0=f2.objects.left||{},R0=f2.objects.right||{};f2.objects={left:R0,right:L0}}}

/* 받는 쪽 「HP」 창 「적용」: 창 기본 체크(반감열매 · 버티기 · 멀티스케일류 · 탈 · 피격 특성 자동) 그대로 */
async function applyHit(H,W,mid,rnd){const FN=H.fn,B=W.OM_BATTLE,OI=W.OM_ITEMS;const b=FN.ctx().b;const m=b.mons[mid];if(!m||!m.lastHit)return null;const lh=m.lastHit;
 const fl=FN.raidFloor(m);const berryN=OI?OI.resist(m,lh):'';const sashX=OI?OI.sash(m):null;const SH=FN.hitShield(m,lh);const RX=lh.cat!=='변화'?FN.hitRules(m):[];
 const per=lh.per&&lh.per.length>1?lh.per:[lh.total];const en=!!(lh.endure||(sashX&&sashX.sure)),sashOnly=en&&!lh.endure&&!!(sashX&&sashX.sure);
 const fgOn=!!SH.fullGuard,dgOn=!!SH.disguise;const g0=(lh.guard||1)/(fgOn&&String(lh.guardNote||'').includes(SH.fullGuard.name)?SH.fullGuard.v:1);
 const calc=roll=>B.hpDamageHits(m,per,+lh.eff,{fullGuard:fgOn?SH.fullGuard.v:0,disguise:dgOn?SH.disguise.cost:0,stab:false,guard:g0,manual:1,berryHalf:!!berryN,endure:en&&!sashOnly,endureFull:sashOnly,hpFloor:fl,band:roll&&sashX&&sashX.pct&&!en?{pct:sashX.pct,roll:()=>1+Math.floor(rnd()*100)}:null});
 let r=calc(false);let saved=false;if(en){const r0=B.hpDamageHits(m,per,+lh.eff,{fullGuard:fgOn?SH.fullGuard.v:0,disguise:dgOn?SH.disguise.cost:0,stab:false,guard:g0,manual:1,berryHalf:!!berryN,endure:false,hpFloor:fl});saved=!!(r0&&r0.after<=0&&r.after>0)}
 if(sashX&&sashX.pct&&!en&&r.after<=0&&m.hp.cur>1)r=calc(true);
 const berryUse=!!berryN&&/열매/.test(FN.IT(m));const sashUse=saved&&sashX&&sashX.sure&&sashX.once&&m.hp.cur>1;
 /* apply(-r.final) */
 const m0=FN.snap(b.mons[mid]),x=FN.snap(m0);let v=r.final;if(fl&&x.hp.cur-v<fl)v=Math.max(0,x.hp.cur-fl);x.hp.latest=x.hp.cur;x.hp.cur=Math.max(0,x.hp.cur-v);delete x.lastHit;if((r.per||[]).some(q=>q.held==='disguise'))x.dsgUsed=1;
 if(v>0)x.lastTaken={v,turn:+b.turn||0};if(x.hp.cur<=0)x.entry='';
 if(x.raid&&x.raid.segments>0&&fl&&x.hp.cur<=fl&&v>0&&x.hp.cur>0){x.raid.broken=(x.raid.broken||0)+1;x.raid.brk=1}
 await W.OM_APP.setDiff(['battle','mons',mid],m0,x,1);if(x.hp.cur<=0&&m0.hp.cur>0)await FN.faintOff(mid);
 if(berryUse||sashUse)await FN.itemConsume(mid);
 const nHit=r.per&&r.per.length?r.landed:1;if(OI&&r.final>0)await FN.itemHitReact(mid,lh,r.final,nHit);
 if(RX.length&&r.final>0)await FN.abilityHitReact(mid,lh,r);
 const after=FN.ctx().b.mons[mid];return {final:v,ko:!!after&&after.hp.cur<=0}}

/* ===== 지시용 기대 대미지 (굴리지 않고 공격 창과 같은 보정으로, 주사위 중간값 · 급소 없음 · 명중 확률 곱) ===== */
function estimate(H,W,atk,def,mv,o){o=o||{};const FN=H.fn,B=W.OM_BATTLE,FX=W.OM_FX,OI=W.OM_ITEMS,S=W.OM_STATS;if(!mv||mv.cat==='변화'||!(+mv.pow>0))return 0;
 const b=FN.ctx().b;const f=FN.fieldOf(b);const RM=k=>+((f.rooms||{})[k]||0)>0;
 const sk=FN.skinOf(atk,mv);const T0=RM('블랙룸')?'Ghost':((sk||{}).ty||mv.typeEn);const moveTypes=RM('블랙룸')?['Ghost']:sk?[sk.ty]:String(mv.type||'').split(/[()/,]/).map(t=>t.trim()).filter(Boolean).map(S.typeEn);
 if(OI&&OI.immune(def,moveTypes))return 0;
 const atkTypes=atk.teraActive&&atk.teraEn!=='-'?[...atk.types,atk.teraEn]:atk.types;const floating=(def.states||{}).MagnetRise||(def.states||{}).Telekinesis||(FX&&FX.floating(def))||FN.IT(def)==='풍선';
 const eff=B.effectiveness(moveTypes,def,{multiMode:0,atkTypes,floating});if(!eff.value)return 0;
 const mods=FX?FX.attackMods(atk,def,Object.assign(FN.moveQuery(atk,def,mv,moveTypes,eff.value,!o.multi),{stab:!!eff.stab})):{boost:1,guard:1};const ig=OI&&OI.defGuard(def,mv.cat);if(ig)mods.guard=(mods.guard||1)*ig.v;
 const wm=FN.WEATHER_MUL[f.weather.type]||{};const wMul=wm[T0]!=null?wm[T0]:1;let fm=1;const ft=f.terrain.type;if(FN.grd(atk)){if(ft==='그래스필드'&&T0==='Grass')fm=1.3;if(ft==='일렉트릭필드'&&T0==='Electric')fm=1.3;if(ft==='사이코필드'&&T0==='Psychic')fm=1.3}if(ft==='미스트필드'&&moveTypes.includes('Dragon')&&FN.grd(def))fm*=0.5;
 const im=OI?OI.atkMul(atk,{types:moveTypes,cat:mv.cat,single:String(mv.range||'')==='1체'}):null;
 const dTy=FN.tysOf(def),dS=mv.cat==='특수'?'specialdefense':'defense';const wt=f.weather.type;const defMul=(['눈','싸라기눈','극한'].includes(wt)&&dTy.includes('Ice')&&dS==='defense')?1.5:(wt==='모래바람'&&dTy.includes('Rock')&&dS==='specialdefense')?1.5:1;
 const objs=(f.objects||{})[def.side]||{};const wall={};for(const k in FN.WALLS)if(objs[k]>0&&!(k==='얼음의장벽'&&T0==='Fire'))wall[FN.WALLS[k]]=1;
 const spw=FN.specialPowFor(mv.name,atk);const sp=spw?spw(def):null;const pow=sp&&sp.pow!=null?sp.pow:+mv.pow;if(!pow)return 0;
 const n=Math.max(1,(+mv.min||1)+(+mv.max||1))/2;
 let d;try{d=B.damage(FN.foulAtk(atk,def,mv),def,Object.assign({},mv,{pow},sk?{typeEn:sk.ty}:{}),{critMul:FN.critMulOf(atk),hits:[1],free1:mods.boost||1,free2:1,item1:im?im.v:1,item2:1,trait:sk?sk.mul:1,weather:wMul,fieldMul:fm,defMul,wonder:RM('원더룸'),multiTarget:!!o.multi,wall,wallSize:FN.mode(b)>=2?2:1,ignoreAtk:-1,ignoreDef:-1,rng:()=>0.5})}catch(e){return 0}
 const am=(eff.stab?1.5:1)*(FN.IT(atk)==='달인의띠'&&eff.value>1?1.2:1);
 const hp=B.hpDamage(def,Math.floor(d.total*am*n),eff.value,{stab:false,guard:(mods.guard||1)*((def.flags||{}).endure?0.5:1)});
 let acc=1;if(+mv.acc){try{acc=Math.min(1,(+mv.acc/100)*FN.leadAcc(atk)*B.statValue(atk,'accuracy').rankMult/B.statValue(def,'evasion').rankMult)}catch(e){}}
 return Math.max(0,hp.raw)*acc}

/* ===== 변화기 고르기 (지침 2-9 ③ 「지원 · 방어」 후보 · 2-11 랭크별) =====
   점수 = 「상대 HP 몇 할을 깎는 공격과 맞먹나」(공격 후보의 기대 대미지 ÷ 남은 HP 와 견준다). 효과 글을 웹툴이 자동으로 처리하는 기술(OM_MOVEAUTO.auto)과 「기술 방어」만 고른다 — 손으로 처리할 기술은 시뮬에서 효과가 없어서.
   C(단순): 상태 이상 걸기 · 지친 아이 회복 · 1턴 자기 강화 · 자기 타입을 살리는 날씨/필드. B 이상: + 기술 방어 · 벽 · 순풍 · 상대 약화 · 혼란 · 설치기 */
const MAJOR=['Poison','Toxic','Burn','Paralysis','Freeze','Sleep'];
function statusPick(H,W,c){const FN=H.fn,MA=W.OM_MOVEAUTO,B=W.OM_BATTLE;const {m,pol,fs}=c;if(pol==='D'||pol==='wild')return null;const b=FN.ctx().b;const f=FN.fieldOf(b);const turn=+b.turn||1;
 const L=FN.MVS(m).map((mv,i)=>Object.assign({},mv,{_i:i})).filter(mv=>mv&&mv.cat==='변화'&&!mv.virt&&!mv.ext);if(!L.length)return null;
 const hpR=m.hp.cur/m.hp.max;const danger=c.dangerOf(m);const safe=danger<m.hp.cur*0.4;const main=(m.stats[1]>=m.stats[3])?'attack':'specialattack';const mtypes=FN.tysOf(m);
 const best=c.best;const bestFrac=best?Math.min(1,best.v/Math.max(1,best.tg.hp.cur)):0;
 const out=[];const T=FN.ctx().b.trainers[m.tid]||{};
 const immune=(tg,st)=>{const ty=FN.tysOf(tg);if(st==='Paralysis'&&ty.includes('Electric'))return true;if(st==='Burn'&&ty.includes('Fire'))return true;if((st==='Poison'||st==='Toxic')&&(ty.includes('Poison')||ty.includes('Steel')))return true;if(st==='Freeze'&&ty.includes('Ice'))return true;if(st==='LeechSeed'&&ty.includes('Grass'))return true;return false};
 const accP=(mv,tg)=>{if(!+mv.acc)return 1;try{return Math.min(1,(+mv.acc/100)*FN.leadAcc(m)/B.statValue(tg,'evasion').rankMult)}catch(e){return +mv.acc/100}};
 for(const mv of L){let P=null;try{P=MA.parse(mv)}catch(e){}const prot=FN.protMove(mv);if(!prot&&!(P&&MA.auto(P)))continue;
  if(prot){if(pol==='C')continue;if(m.protectLast===turn-1)continue;if(danger>=m.hp.cur&&c.allies.length)out.push({mv,tg:m,score:0.6,why:'기술 방어'});continue}
  const ops=(P.groups||[]).flatMap(g=>(g.ops||[]).map(op=>Object.assign({who:g.who,n:g.n},op)));
  for(const op of ops){
   if(op.k==='state'&&op.tgt==='target'){const st=op.state;const cand=fs.filter(tg=>!immune(tg,st)&&!(MAJOR.includes(st)&&MAJOR.some(k=>(tg.states||{})[k]))&&!(tg.states||{})[st]);if(!cand.length)continue;
    const tg=cand.map(t=>Object.assign(c.threatVs(pol,t,m),{t})).sort((a,x)=>x.v-a.v)[0].t;const th=Math.min(1,c.threatVs(pol,tg,m).v/Math.max(1,m.hp.cur));let s=0;
    if(st==='Sleep')s=0.7;else if(st==='Paralysis')s=0.35+(c.spd(tg)>c.spd(m)?0.2:0);else if(st==='Burn')s=tg.stats[1]>tg.stats[3]?0.5:0.15;else if(st==='Toxic')s=0.35;else if(st==='Poison')s=0.25;else if(st==='Confusion'){if(pol==='C')continue;s=0.25}else if(st==='LeechSeed'){if(pol==='C')continue;s=0.25}else if(st==='Taunt'||st==='Encore'){if(pol==='C')continue;s=0.1}else continue;
    s*=accP(mv,tg)*(0.6+0.4*th);if(bestFrac>=0.5)s*=0.6;out.push({mv,tg,score:s,why:'상태 '+st})}
   else if(op.k==='rank'&&(op.tgt==='self')){const up=Object.entries(op.stats||{}).filter(([k,v])=>+v>0);if(!up.length)continue;let s=0;
    for(const [k,v] of up){const cur=+((m.rank||{})[k]||0);if(cur>=2)continue;if(k===main)s+=0.3*Math.min(2,+v);else if(k==='speed'){if(fs.some(tg=>c.spd(tg)>c.spd(m)))s+=0.2*Math.min(2,+v)}else if(k==='defense'||k==='specialdefense'){const th=c.topThreat(pol,m);if(th.mv&&((k==='defense'&&th.mv.cat==='물리')||(k==='specialdefense'&&th.mv.cat==='특수')))s+=0.15*Math.min(2,+v)}}
    if(!s)continue;if(pol==='C'&&turn>1)continue;if(!safe||hpR<0.6)s*=0.3;out.push({mv,tg:m,score:s,why:'강화'})}
   else if(op.k==='rank'&&op.tgt==='target'){if(pol==='C')continue;const dn=Object.entries(op.stats||{}).filter(([k,v])=>+v<0);if(!dn.length)continue;const tg=fs.slice().sort((a,x)=>Math.max(x.stats[1],x.stats[3])-Math.max(a.stats[1],a.stats[3]))[0];const tm=tg.stats[1]>=tg.stats[3]?'attack':'specialattack';let s=0;for(const [k,v] of dn){if(k===tm)s+=0.12*Math.min(2,-v);else if(k==='speed'&&c.spd(tg)>c.spd(m))s+=0.08*Math.min(2,-v)}if(s)out.push({mv,tg,score:s*accP(mv,tg),why:'약화'})}
   else if(op.k==='heal'&&op.tgt==='self'){if(hpR>0.5)continue;const fr=String(op.value||'1/2').split('/');const h=(+fr[0]||1)/(+fr[1]||2);const s=Math.min(h,1-hpR)*(danger<m.hp.cur+m.hp.max*h?1.1:0.4);out.push({mv,tg:m,score:s,why:'회복'})}
   else if(op.k==='weather'){if(f.weather.type===op.w)continue;const WM=FN.WEATHER_MUL[op.w]||{};const mine=c.allies.concat([m]).some(x=>FN.MVS(x).some(q=>q&&q.cat!=='변화'&&WM[q.typeEn]>1&&FN.tysOf(x).includes(q.typeEn)));const theirs=fs.some(x=>FN.MVS(x).some(q=>q&&q.cat!=='변화'&&WM[q.typeEn]>1));if(mine&&!theirs)out.push({mv,tg:m,score:0.3,why:'날씨 '+op.w})}
   else if(op.k==='terrain'&&!op.room){if(f.terrain.type===op.t)continue;const TY={그래스필드:'Grass',일렉트릭필드:'Electric',사이코필드:'Psychic'}[op.t];if(TY&&mtypes.includes(TY)&&FN.MVS(m).some(q=>q&&q.cat!=='변화'&&q.typeEn===TY))out.push({mv,tg:m,score:0.25,why:'필드 '+op.t})}
   else if(op.k==='object'&&op.side==='self'){if(pol==='C')continue;const objs=(f.objects||{})[m.side]||{};if(+objs[op.o]>0)continue;const th=c.topThreat(pol,m);
    if((op.o==='리플렉터'&&th.mv&&th.mv.cat==='물리')||(op.o==='빛의장막'&&th.mv&&th.mv.cat==='특수')||op.o==='오로라베일')out.push({mv,tg:m,score:0.35,why:op.o});
    else if(op.o==='순풍'&&fs.some(tg=>c.spd(tg)>c.spd(m)))out.push({mv,tg:m,score:0.35,why:'순풍'})}
   else if(op.k==='object'&&op.side==='enemy'){if(pol==='C')continue;const objs=(f.objects||{})[fs[0].side]||{};if(+objs[op.o]>0)continue;const benchN=Object.values(b.mons).filter(x=>x.side===fs[0].side&&!x.entry&&x.hp.cur>0).length;if(benchN)out.push({mv,tg:fs[0],score:0.08+0.07*benchN,why:op.o})}}}
 if(!out.length)return null;out.sort((a,x)=>x.score-a.score);return out[0]}
module.exports={attack,applyHit,estimate,statusPick};

