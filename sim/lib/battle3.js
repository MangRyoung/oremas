/* 배틀 v3 (10-27 밤) — 웹툴 배틀 코드를 그대로 돌리는 시뮬 배틀. 망령 「특성 · 소지품 · 포텐셜 / 날씨 · 필드 / 변화기 셋 다 넣어야지」.
   · 배틀 상태 = 웹툴과 같은 꼴(battle.mons · field · trainers · cmds · order …). 등장 · 행동 순서 · 턴 개시/종료 · 4식 6령 효과 · 피격 반응 · 레이드 페이즈 = 웹툴 함수(lib/webtool.js).
   · 공격 = lib/fight.js (웹툴 공격 창 + HP 창을 버튼 없이).
   · 지시 = 배틀 진행 지침(docs/배틀_진행_지침.md) 2절 — 대조표 docs/지시_로직.md. 공격 + 변화기 고르기(2-9 · 2-11).
   runBattle(W, opt) — opt = {left:{parties:[{trainer,mons}]}, right:{trainer,mons}|{parties}, rng, format(2|3), maxTurns, log}
   돌려줌(예전 battle.js 와 같은 꼴) {winner, turns, kos, raid, left:[…], right:[…], trainers, log} */
"use strict";
const WT=require('./webtool.js'),FG=require('./fight.js');
const LAD={E:0,D:0,C:1,B:2,A:3,AA:4,AAA:4,S:4};
const strip=s=>String(s||'').replace(/[+\-]/g,'').trim();
const POL=r=>{const l=LAD[strip(r)]??1;return l<=0?'D':l===1?'C':l===2?'B':'A'};
function mkRng(seed){let s=((seed>>>0)*2654435761+0x9e3779b9)>>>0;if(!s)s=123456789;const nx=()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return (s>>>0)/4294967296};for(let i=0;i<12;i++)nx();return nx}
const clone=o=>JSON.parse(JSON.stringify(o));
const flush=async(n)=>{for(let i=0;i<(n||2);i++)await new Promise(r=>setImmediate(r))};
const STATK={attack:'공격',defense:'방어',specialattack:'특공',specialdefense:'특방',speed:'스피드',accuracy:'명중',evasion:'회피'};

async function runBattle(W,opt){
 const H=WT.load(W);const FN=H.fn,B=W.OM_BATTLE,FX=W.OM_FX,MA=W.OM_MOVEAUTO,OO=W.OM_ORDERS,OI=W.OM_ITEMS;
 const rng=opt.rng||mkRng(opt.seed||1);H.setRng(rng);H.logOn=!!opt.log;
 const fmt=Math.max(1,Math.min(3,opt.format||2)),maxT=opt.maxTurns||30;
 /* ---- 배틀 차리기 (웹툴 encounter · prepMon 과 같은 꼴) ---- */
 const b={turn:0,phase:0,mode:fmt,sides:{left:{trainers:[]},right:{trainers:[]}},trainers:{},mons:{},field:{},cmds:{},order:[]};
 const POLS={};let wildN=0;
 const addParty=(side,pt,k)=>{const t=clone(pt.trainer||{name:side+k,ranks:{}});const wild=!!t.wild;const tid=wild?'wild_'+side+'_'+(wildN++):(t.id||side+k);t.id=tid;t.side=side;delete t.solo;if(!t.orderCount)t.orderCount={};
  b.sides[side].trainers.push(tid);b.trainers[tid]=t;POLS[tid]=pt.policy||(wild?'wild':POL((t.ranks||{})['지시']));
  (pt.mons||[]).forEach((m0,i)=>{const m=clone(m0);m.tid=tid;m.side=side;m.slot=Object.keys(b.mons).length;if(wild||b.mons[m.id]){m._oid=m.id;m.id=(side==='left'?'L':'R')+m.slot+'_'+(m.id||'')}
   const rk0=m.rank||{};m.rank={attack:0,defense:0,specialattack:0,specialdefense:0,speed:0,accuracy:0,evasion:0,critical:0};for(const q in m.rank)if(+rk0[q])m.rank[q]=Math.max(-6,Math.min(6,+rk0[q]));
   m.mod=Object.assign({},m.mod||{});m.states=Object.assign({},m.states||{});m.entry='';m.started=false;m.hp=m.hp||{};m.hp.max=+m.hp.max||+m.stats[0];if(m.hp.cur==null)m.hp.cur=m.hp.max;
   b.mons[m.id]=m})};
 for(const sd of ['left','right']){const src=opt[sd];const parties=src.parties||[src];parties.forEach((pt,k)=>addParty(sd,pt,k))}
 H.reset(b);const C=()=>FN.ctx().b;
 const polOf=m=>{const p=POLS[m.tid];return p==='wild'&&m.boss?'C':p};   /* 2-11: 야생 = 본능, 『와일드 보스』 = C */
 const T=tid=>C().trainers[tid];const isWildT=tid=>!!(T(tid)||{}).wild;
 const alive=m=>m&&m.hp&&m.hp.cur>0&&!(m.states||{}).Dead;
 const active=sd=>Object.values(C().mons).filter(m=>m.side===sd&&m.entry&&alive(m));
 const bench=sd=>Object.values(C().mons).filter(m=>m.side===sd&&!m.entry&&alive(m));
 const other=sd=>sd==='left'?'right':'left';const foes=sd=>active(other(sd));
 const AREAS=['a','b','c'].slice(0,fmt);
 /* ---- 지시용 계산: 기대 대미지 (공격 창과 같은 보정 · 주사위 중간값 · 명중 곱) ---- */
 const seen=new Map();const markSeen=(m,mvName)=>{let s=seen.get(m.id);if(!s){s=new Set();seen.set(m.id,s)}s.add(mvName)};
 const dmgMoves=m=>FN.MVS(m).map((mv,i)=>Object.assign({},mv,{_i:i})).filter(mv=>mv&&mv.cat!=='변화'&&+mv.pow>0&&!mv.virt&&!mv.ext);
 const allMoves=m=>FN.MVS(m).map((mv,i)=>Object.assign({},mv,{_i:i})).filter(mv=>mv&&!mv.virt&&!mv.ext);
 const expect=(atk,mv,def,multi)=>{try{return FG.estimate(H,W,atk,def,mv,{multi})}catch(e){return 0}};
 const bestVs=(atk,def)=>{let best=null,bv=0;for(const mv of dmgMoves(atk)){const v=expect(atk,mv,def);if(v>bv){bv=v;best=mv}}return {mv:best,v:bv}};
 /* 2-1 정보 차단: 상대 기술은 이 배틀에서 본 것 · C 는 본 것(없으면 자속기 짐작) · B 이상은 본 것 + 자속기 짐작 */
 const knownMoves=(pol,f)=>{const all=dmgMoves(f);const s=seen.get(f.id);const sn=s?all.filter(x=>s.has(x.name)):[];const stab=all.filter(x=>(FN.tysOf(f)||[]).includes(x.typeEn));if(pol==='C')return sn.length?sn:stab;return Array.from(new Set(sn.concat(stab)))};
 const threatVs=(pol,f,m)=>{let best=null,bv=0;for(const mv of knownMoves(pol,f)){const v=expect(f,mv,m);if(v>bv){bv=v;best=mv}}return {mv:best,v:bv,f}};
 const topThreat=(pol,m)=>foes(m.side).map(f=>threatVs(pol,f,m)).sort((a,c)=>c.v-a.v)[0]||{mv:null,v:0};
 const matchup=(m,f)=>bestVs(m,f).v/Math.max(1,f.hp.cur)-threatVs(polOf(m),f,m).v/Math.max(1,m.hp.cur);
 const dangerOf=m=>foes(m.side).reduce((s,f)=>s+threatVs(polOf(m),f,m).v,0);
 const front=(m,fs)=>fs.find(f=>f.entry===m.entry)||fs[0];
 const isOld=m=>/올드\s*타입/.test(JSON.stringify(m.pots||[]));
 const isSure=mv=>!!mv&&(!+mv.acc||/필중/.test(String(mv.eff||'')));
 const mastery=tid=>{const p=POLS[tid];return p==='B'||p==='A'};
 const spd=m=>{try{return B.statValue(m,'speed').value*(FN.spMulOf(m,FN.fieldOf(C())).v||1)}catch(e){return +m.stats[5]||0}};
 /* ---- 선발 · 교대 고르기 ---- */
 const pickIn=(sd,n,tidPref)=>{const L=bench(sd);const fs=foes(sd);const byT={};for(const m of L)(byT[m.tid]=byT[m.tid]||[]).push(m);const out=[];const tids=Object.keys(byT);if(tidPref&&byT[tidPref])tids.sort((x,y)=>(y===tidPref)-(x===tidPref));let k=0;
  while(out.length<n&&tids.some(t=>byT[t].length)){const t=tids[k%tids.length];k++;const arr=byT[t];if(!arr.length)continue;const pol=POLS[t];let pick;
   if(pol==='D'||pol==='C'||pol==='wild'||!fs.length)pick=arr[0];else pick=arr.map(m=>({m,s:fs.reduce((a,f)=>a+matchup(m,f),0)})).sort((a,c)=>c.s-a.s)[0].m;arr.splice(arr.indexOf(pick),1);out.push(pick)}return out};
 /* ---- 행동 고르기 (2-9 · 2-11) ---- */
 const statusPlan=(sd,m,pol,fs,best)=>FG.statusPick(H,W,{m,pol,fs,best,allies:active(sd).filter(x=>x!==m),threatVs,topThreat,dangerOf,turn:C().turn,expect,spd,isOld});
 const choose=(sd,m,plan)=>{const pol=polOf(m);const fs=foes(sd);if(!fs.length)return null;const dm=dmgMoves(m);const st=m.states||{};
  /* 앙코르 · 난동: 그 기술만 */
  if(st.Thrash||st.Encore){const last=m.lastMove!=null?allMoves(m).find(x=>x.name===m.lastMove):null;if(last)return {mv:last,tg:fs[Math.floor(rng()*fs.length)],v:0}}
  const taunt=!!st.Taunt;
  if(pol==='wild'||pol==='D'){const tg=front(m,fs);let best=null,bv=-1;for(const mv of dm){const e=B.effectiveness([mv.typeEn],tg,{atkTypes:m.types}).value;const bucket=e>=2?2:e===0?0:e<1?0.5:1;const v=+mv.pow*bucket*(/전체|자신 이외/.test(mv.range||'')?0.75:1);if(v>bv){bv=v;best=mv}}
   if(!best||bv<=0)best=dm[0]||allMoves(m).find(x=>!taunt||x.cat!=='변화')||null;return best?{mv:best,tg,v:0}:null}
  let cands=[];const allies=active(sd).filter(x=>x!==m);for(const tg of fs)for(const mv of dm){const multi=/전체|자신 이외|상대 2체/.test(mv.range||'');let v=expect(m,mv,tg,multi);if(mv.range==='자신 이외')v-=allies.reduce((a,x)=>a+expect(m,mv,x,true),0)*1.5;cands.push({mv,tg,v})}
  const left=tg=>tg.hp.cur-(plan.get(tg.id)||0);const done=tg=>left(tg)<=0;
  const keep=c=>{if(c&&c.mv&&c.mv.cat!=='변화'&&!/전체|자신 이외|상대 2체/.test(c.mv.range||''))plan.set(c.tg.id,(plan.get(c.tg.id)||0)+c.v);return c};
  let pick=null;
  if(pol==='C'){const ord=fs.slice().sort((a,c)=>a.hp.cur/a.hp.max-c.hp.cur/c.hp.max);const low=ord.find(t=>!done(t))||ord[0];pick=cands.filter(x=>x.tg===low).sort((a,c)=>c.v-a.v)[0]||cands.sort((a,c)=>c.v-a.v)[0]||null}
  else{const kos=cands.filter(x=>!done(x.tg)&&x.v>=left(x.tg)).sort((a,c)=>threatVs(pol,c.tg,m).v-threatVs(pol,a.tg,m).v);
   if(kos.length)return keep(kos[0]);
   const pool=cands.filter(x=>!done(x.tg));const P0=pool.length?pool:cands;pick=P0.slice().sort((a,c)=>c.v/Math.max(1,left(c.tg))-a.v/Math.max(1,left(a.tg)))[0]||null;
   const Tt=T(m.tid);if(pol==='A'&&Tt._focus&&C().mons[Tt._focus]&&alive(C().mons[Tt._focus])){const fo=C().mons[Tt._focus];const c2=P0.filter(x=>x.tg.id===fo.id).sort((a,c)=>c.v-a.v)[0];if(c2&&pick&&c2.v>=pick.v*0.6)pick=c2}
   if(pol==='A'&&pick)Tt._focus=pick.tg.id}
  /* 변화기 (C 이상): 공격보다 나을 때 */
  if(!taunt){const sp=statusPlan(sd,m,pol,fs,pick);if(sp&&(!pick||sp.score>(pick.v/Math.max(1,left(pick.tg)))))return {mv:sp.mv,tg:sp.tg,v:0,status:sp.why}}
  if(!pick){const any=allMoves(m).find(x=>!taunt||x.cat!=='변화');return any?{mv:any,tg:fs[0],v:0}:null}
  return keep(pick)};
 /* 교대 (2-10 · 2-11) */
 const wantSwitch=(sd,m)=>{const pol=polOf(m);if(pol==='D'||pol==='wild'||isWildT(m.tid))return null;if((m.states||{}).Bind||(m.states||{}).MeanLook||(m.states||{}).Block)return null;const fs=foes(sd);if(!fs.length)return null;
  const L=bench(sd).filter(x=>x.tid===m.tid).map(x=>({x,s:fs.reduce((a,f)=>a+matchup(x,f),0)})).sort((a,c)=>c.s-a.s);if(!L.length)return null;const cur=fs.reduce((a,f)=>a+matchup(m,f),0);
  if(pol==='C'){const crit=fs.some(f=>{const t=threatVs('C',f,m);return t.mv&&B.effectiveness([t.mv.typeEn],m,{atkTypes:f.types}).value>=4&&t.v>=m.hp.cur});return crit&&L[0].s>cur?L[0].x:null}
  const bad=fs.every(f=>threatVs(pol,f,m).v>=m.hp.cur*0.6);if(!bad)return null;return L[0].s>cur+0.5?L[0].x:null};
 /* 4식 · 6령 (지시 단계 선행): 웹툴 fireOrder — 받을 수 없는 포켓몬 · 한 턴 하나는 웹툴이 막는다 */
 const ordKeys=t=>Object.keys(t.orderCount||{}).filter(k=>/^order_/.test(k)&&+t.orderCount[k]>0).map(k=>k.slice(6));
 const cmdLeft=(t,k)=>+((t.orderCount||{})['command_'+k]||0)>0&&(!opt.pool||opt.pool.command>(opt.pool&&!opt.poolBoss&&opt.poolInit?Math.ceil(opt.poolInit.command/2):0));
 const fired=tid=>(((C().cmds||{})[tid]||{}).fired)||{};
 const cmdUsed=tid=>Object.values(fired(tid)).some(x=>x&&x.command);
 /* 10-28 망령: 4식 · 6령은 던전 단위 공용 풀(opt.pool = {order, command}, 던전이 넘긴다). 보스방 아닌 배틀에서는 풀의 절반(올림)을 보스방 몫으로 남긴다 — 시뮬 판단(지침에 없음) */
 const POOL=opt.pool||null,P0=opt.poolInit||null;const keep=kind=>POOL&&!opt.poolBoss&&P0?Math.ceil(P0[kind]/2):0;
 const fire=async(tid,mid,kind,key)=>{const t=T(tid);const ck=(kind==='order'?'order_':'command_')+key;const before=+((t.orderCount||{})[ck]||0);if(before<=0)return false;if(POOL&&POOL[kind]<=keep(kind))return false;await FN.fireOrder(tid,mid,kind,key,'free');await flush(1);const after=+((T(tid).orderCount||{})[ck]||0);if(after<before&&POOL)POOL[kind]--;return after<before};
 /* ---- GM 손 처리 (웹툴에서 사람이 「발동」을 누르던 일 중 늘 하는 것) — 10-27 밤 ----
    G1 「HP : a/b 이하」일 때 상시 효과(맹화 꼴): 그 HP 가 되면 효과 엔진 구문을 한 번 건다(퇴장하면 웹툴이 fxDone 을 지워 다시 걸 수 있다)
    G2 「S」 상태일 때 턴 종료 시 「HP」를 a/b 회복(포이즌힐 꼴): 턴 종료 전에 그 상태면 회복
    G3 아군 빈사 상시 · 【자동】 포텐셜 = 웹툴 faintWatch */
 const srcList=m=>{const L=[];if(m.ability)L.push(['trait',m.ability,m.abilityEff||'']);if(m.item)L.push(['item',m.item,m.itemEff||'']);for(const p of FN.potSrc(m))L.push(['pot',p.name,p.eff||''])};
 const srcOf=m=>{const L=[];if(m.ability)L.push(['trait',m.ability,m.abilityEff||'']);if(m.item&&!m.itemUsed)L.push(['item',m.item,m.itemEff||'']);for(const p of FN.potSrc(m))L.push(['pot',p.name,p.eff||'']);return L};
 const gmHp=async()=>{for(const m0 of Object.values(C().mons)){if(!m0.entry||!alive(m0))continue;for(const [kind,name] of srcOf(m0)){const m=C().mons[m0.id];if(!m||!m.entry)break;const au=FX.autoOf(m,kind,name);if(!au||!au.ops||!au.ops.length||au.ops[0].k!=='cond'||au.ops[0].c!=='hp_le')continue;if((m.fxDone||{})[name])continue;
   const fr=String(au.ops[0].frac||'1/3').split('/');if(m.hp.cur>Math.floor(m.hp.max*(+fr[0]||1)/(+fr[1]||3)))continue;if(await FN.fireAuto(m.id,kind,name,{quiet:true,noRoll:true})){const d=Object.assign({},(C().mons[m.id]||{}).fxDone||{});d[name]=1;await W.OM_APP.set(['battle','mons',m.id,'fxDone'],d)}}}};
 const gmEndHeal=async()=>{for(const m0 of Object.values(C().mons)){if(!m0.entry||!alive(m0))continue;for(const [kind,name,eff] of srcOf(m0)){const mm=String(eff).match(/「([^」]+)」\s*상태일 때 턴 종료 시 「HP」를 (\d+)\s*\/\s*(\d+)만큼 회복/);if(!mm)continue;const en=FX.stEn?FX.stEn(mm[1]):'';const m=C().mons[m0.id];if(!en||!(m.states||{})[en]||(m.states||{}).HealBlock||m.hp.cur>=m.hp.max)continue;
   const v=Math.max(1,Math.floor(m.hp.max*(+mm[2])/(+mm[3])));const x=clone(m);x.hp.cur=Math.min(x.hp.max,x.hp.cur+v);await W.OM_APP.setDiff(['battle','mons',m.id],m,x,1);W.OM_APP.sysLog(`【GM】 ${m.name} 「${name}」 — 「${mm[1]}」 상태라 턴 종료 시 HP +${x.hp.cur-m.hp.cur}`,'battle')}}};
 const gmChores=async()=>{await gmHp();if(FN.faintWatch)await FN.faintWatch();await flush(1)};
 /* ---- 결과 기록 ---- */
 const kos=[];const turnsLog=[];const used={};const markKo=(before)=>{for(const m of Object.values(C().mons)){const was=before[m.id];if(was>0&&!alive(m))kos.push({name:m.name,side:m.side,turn:C().turn,by:m._by||''})}};
 const hpMap=()=>{const o={};for(const m of Object.values(C().mons))o[m.id]=m.hp.cur;return o};
 /* ---- 선발 → 시합 개시 ---- */
 for(const sd of ['left','right']){const L=pickIn(sd,fmt);for(let i=0;i<L.length;i++)await FN.enterMon(L[i].id,AREAS[i],{sys:true,noAuto:true})}
 await FN.startBattle();await flush();if(FN.faintWatch)await FN.faintWatch();
 let turn=0;
 while(turn<maxT){
  if(!active('left').length||!active('right').length)break;
  await FN.setPhase(1);await flush();turn=+C().turn||turn+1;
  const hp0=hpMap();
  /* 1. 지시 */
  const acts=[];const plans={left:new Map(),right:new Map()};const cmds={};
  for(const sd of ['left','right'])for(const m of active(sd)){const sw=wantSwitch(sd,m);if(sw){acts.push({sd,m,sw});continue}const a=choose(sd,m,plans[sd]);if(a)acts.push(Object.assign({sd,m},a))}
  for(const a of acts){const tid=a.m.tid;cmds[tid]=cmds[tid]||{mons:{}};if(a.sw)cmds[tid].mons[a.m.id]={move:'switch',switch:a.sw.id,targets:[]};else{const tg=a.tg?[a.tg.side+'_'+a.tg.entry]:[];const r=String(a.mv.range||'');const dt=FN.defaultTargets(C(),a.m.id,String(a.mv._i));
   const targets=r==='1체'||r===''?tg:dt.length?dt:tg;cmds[tid].mons[a.m.id]={move:a.mv._i,targets};a.targets=targets}}
  {const nb=C();nb.cmds=cmds}
  /* 6령 · 4식 선행 (트레이너마다) */
  for(const tid of Object.keys(C().trainers)){if(isWildT(tid))continue;const pol=POLS[tid];const t=T(tid);const mine=active(t.side).filter(m=>m.tid===tid&&!isOld(m));if(!mine.length)continue;
   const myActs=acts.filter(a=>a.m.tid===tid&&a.mv&&a.mv.cat!=='변화'&&!isOld(a.m));
   if(pol==='C'){const th=mine.map(m=>Object.assign(topThreat('C',m),{m})).filter(x=>x.mv&&x.v>=x.m.hp.cur*0.6).sort((a,c)=>c.v/c.m.hp.cur-a.v/a.m.hp.cur)[0];const tired=mine.filter(m=>m.hp.cur<m.hp.max*0.4)[0];
    let done=false;if(th)done=await fire(tid,th.m.id,'command',th.mv.cat==='특수'?'specialdefense':'defense');if(!done&&tired)done=await fire(tid,tired.id,'command','heal');if(!done&&myActs.length){const a=myActs.sort((x,y)=>y.v-x.v)[0];await fire(tid,a.m.id,'command',a.mv.cat==='특수'?'specialattack':'attack')}}
   /* 4식: 위험한 아이 하나 (D 35% · C 45% · B 본 위협 ≥ HP · A 그리고 60%) — 위협이 필중기면 버텨라 */
   for(const m of mine){if(acts.some(a=>a.m===m&&a.sw))continue;const threat=topThreat(pol==='D'?'C':pol,m);const ratio=m.hp.cur/m.hp.max;
    const need=pol==='D'?ratio<0.35:pol==='C'?ratio<0.45:pol==='B'?(threat.mv&&threat.v>=m.hp.cur):(threat.mv&&threat.v>=m.hp.cur&&ratio<0.6);if(!need)continue;
    const ks=ordKeys(T(tid));const cat=threat.mv?threat.mv.cat:'';const sure=isSure(threat.mv);const k=!sure&&cat==='물리'&&ks.includes('retreat')?'retreat':!sure&&cat==='특수'&&ks.includes('dodge')?'dodge':ks.includes('endure')?'endure':null;if(!k)continue;
    if(await fire(tid,m.id,'order',k))break}}
  /* 2. 순서 (웹툴 computeOrder) + 숙달민첩 ② */
  await FN.computeOrder();await flush(1);
  {let flip=false;for(const tid of Object.keys(C().trainers)){if(flip||isWildT(tid)||!mastery(tid)||cmdUsed(tid)||!cmdLeft(T(tid),'speed'))continue;const ord=C().order||[];
    for(const a of acts.filter(x=>x.m.tid===tid&&x.mv&&x.mv.cat!=='변화'&&x.tg&&!isOld(x.m))){const me=ord.findIndex(o=>o.mid===a.m.id),it=ord.findIndex(o=>o.mid===a.tg.id);if(it<0||me<0||it>me)continue;if(ord[it].prio!==ord[me].prio||ord[it].change||ord[me].change)continue;
     if(a.v>=a.tg.hp.cur&&ord[me].speed*1.5>ord[it].speed&&threatVs(POLS[tid],a.tg,a.m).v>=a.m.hp.cur*0.5){if(await fire(tid,a.m.id,'command','speed')){flip=true;break}}}}
   if(flip){await FN.computeOrder();await flush(1)}}
  /* 3. 행동 (순서대로) */
  for(const o of (C().order||[]).slice()){const m=C().mons[o.mid];if(!m||!m.entry||!alive(m))continue;const a=acts.find(x=>x.m.id===o.mid);if(!a)continue;
   if(a.sw){if(!alive(a.sw)||a.sw.entry)continue;const area=m.entry;await FN.exitMon(m.id,{sys:true,noAsk:true});await FN.enterMon(a.sw.id,area,{sys:true,how:'통상 교대'});await flush();continue}
   /* 대상이 쓰러졌으면 남은 상대 (3-3) */
   let targets=(a.targets||[]).filter(s=>{const [sd,ar]=s.split('_');const d=FN.entered(C(),sd)[ar];return !!d});if(!targets.length&&a.mv.cat!=='변화'){const fs=foes(m.side);if(fs.length)targets=[fs[0].side+'_'+fs[0].entry]}
   /* 숙달 ② 명중굴림 전 (2-4): 아군 공격 · 상대 방어 */
   if(a.mv.cat!=='변화'){const tg0=targets.map(s=>{const [sd,ar]=s.split('_');return FN.entered(C(),sd)[ar]}).filter(Boolean).find(d=>d.side!==m.side);
    if(tg0){const tidA=m.tid;if(!isWildT(tidA)&&mastery(tidA)&&!cmdUsed(tidA)&&!isOld(m)){const v=expect(C().mons[m.id],a.mv,tg0);if(v<tg0.hp.cur&&v*1.5>=tg0.hp.cur)await fire(tidA,m.id,'command',a.mv.cat==='특수'?'specialattack':'attack');else if(POLS[tidA]==='A'&&v>=tg0.hp.cur&&+a.mv.acc&&+a.mv.acc<100&&cmdLeft(T(tidA),'accuracy'))await fire(tidA,m.id,'command','accuracy')}
     const tidD=tg0.tid;if(!isWildT(tidD)&&mastery(tidD)&&!cmdUsed(tidD)&&!isOld(tg0)){const DF=tg0.flags||{};const dodged=((DF.dodgePhys&&a.mv.cat==='물리')||(DF.dodgeSpec&&a.mv.cat==='특수'))&&!isSure(a.mv);if(!dodged){const v=expect(C().mons[m.id],a.mv,C().mons[tg0.id]);if(v>=tg0.hp.cur&&v/1.5<tg0.hp.cur)await fire(tidD,tg0.id,'command',a.mv.cat==='특수'?'specialdefense':'defense');else if(POLS[tidD]==='A'&&v>=tg0.hp.cur&&!isSure(a.mv)&&cmdLeft(T(tidD),'evasion'))await fire(tidD,tg0.id,'command','evasion')}}}}
   const before=hpMap();
   const r=await FG.attack(H,W,m.id,a.mv._i,targets,{});await flush();await gmChores();
   markSeen(m,a.mv.name);{const x=C().mons[m.id];if(x)x.lastMove=a.mv.name}
   for(const id in before)if(before[id]>0&&C().mons[id]&&!alive(C().mons[id]))C().mons[id]._by=m.name;
   /* 자기 교대(유턴 등) — 벤치에서 고른다 */
   const me=C().mons[m.id];if(r&&r.selfSwitch&&me&&me.entry&&alive(me)){const nx=pickIn(m.side,1,m.tid).filter(x=>x.tid===m.tid)[0]||pickIn(m.side,1)[0];if(nx){const area=me.entry;await FN.exitMon(me.id,{sys:true,noAsk:true});await FN.enterMon(nx.id,area,{sys:true,how:'임의 교대'});await flush()}}
   if(!active('left').length||!active('right').length)break}
  /* 4. 턴 종료: 「가장 마지막」 · 「턴 종료 시」 포텐셜 → 웹툴 turnEnd → 「턴 종료 이후」 · 숙달회복 ② */
  for(const step of ['last','end']){for(const x of FN.endCands(C(),step))if(x.kind==='pot'){const au=FX.autoOf(x.m,'pot',x.name);if(au&&au.ops&&au.ops.length&&!au.manual)await FN.fireAuto(x.m.id,'pot',x.name,{quiet:true})}}
  for(const tid of Object.keys(C().trainers)){if(isWildT(tid)||!mastery(tid)||cmdUsed(tid)||!cmdLeft(T(tid),'heal'))continue;const w=active(T(tid).side).filter(m=>m.tid===tid&&!isOld(m)&&m.hp.cur<=m.hp.max*0.5).sort((a,c)=>a.hp.cur/a.hp.max-c.hp.cur/c.hp.max)[0];if(w)await fire(tid,w.id,'command','heal')}
  {const ub=C();for(const tid in (ub.cmds||{})){const x=(ub.cmds[tid]||{}).fired||{};for(const mid in x){const f=x[mid]||{};used[tid]=used[tid]||{order:0,command:0};if(f.order)used[tid].order++;if(f.command)used[tid].command++}}}
  await gmEndHeal();await FN.turnEnd();await flush();await gmChores();
  for(const x of FN.endCands(C(),'after'))if(x.kind==='pot'){const au=FX.autoOf(x.m,'pot',x.name);if(au&&au.ops&&au.ops.length&&!au.manual)await FN.fireAuto(x.m.id,'pot',x.name,{quiet:true})}
  markKo(hp0);
  /* 5. 빈자리 채우기 (죽어내밀기) */
  for(const sd of ['left','right']){const ent=FN.entered(C(),sd);for(const ar of AREAS){if(ent[ar])continue;const nx=pickIn(sd,1)[0];if(!nx)continue;await FN.enterMon(nx.id,ar,{sys:true,how:'죽어내밀기'});await flush()}}
  turnsLog.push({turn,hp:hpMap()});
  if(!Object.values(C().mons).some(m=>m.side==='left'&&alive(m))||!Object.values(C().mons).some(m=>m.side==='right'&&alive(m)))break}
 const fb=C();const winner=!Object.values(fb.mons).some(m=>m.side==='right'&&alive(m))?'left':!Object.values(fb.mons).some(m=>m.side==='left'&&alive(m))?'right':'draw';
 const mo=m=>({id:m._oid||m.id,tid:m.tid,name:m.name,hp:Math.max(0,m.hp.cur),max:m.hp.max,states:Object.keys(m.states||{}).filter(k=>m.states[k]),item:m.item||'',dealt:0,taken:0});
 const to=sd=>Object.fromEntries(Object.values(fb.trainers).filter(t=>t.side===sd).map(t=>[t.id,{name:t.name,pol:POLS[t.id],used:used[t.id]||{order:0,command:0},oc:t.orderCount||{}}]));
 const raid=Object.values(fb.mons).filter(m=>m.raid&&+m.raid.phase>0).flatMap(m=>Array.from({length:+m.raid.phase},(_,i)=>({name:m.name,phase:i+1})));
 const orig=sd=>{const src=opt[sd];return (src.parties||[src]).flatMap(p=>p.mons||[])};
 /* 왼쪽 결과는 원래 id 로 (던전이 시트에 되돌려 쓴다) */
 const left=Object.values(fb.mons).filter(m=>m.side==='left').map(mo);
 return {winner,turns:turn,kos,raid,left,right:Object.values(fb.mons).filter(m=>m.side==='right').map(mo),trainers:{left:to('left'),right:to('right')},log:opt.log?H.logs.slice():[],asked:H.asked}}
module.exports={runBattle,mkRng,POL};
