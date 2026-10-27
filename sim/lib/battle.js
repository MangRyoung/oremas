/* 약식 배틀 — 오레마스 엔진(OM_BATTLE: 순서 · 명중 · 급소 · 대미지 · 상성 · 비례 대미지, OM_FIELD: 행동 판정, OM_MOVEAUTO: 기술 효과 구문)으로
   더블(기본 2:2) 배틀을 끝까지 자동으로 돌린다. 레이드(배리어식)는 raidFloor · floorLoss · 페이즈 체인지.
   지시 = 「지시 로직 v2」(10-27 밤): 배틀 진행 지침(docs/배틀_진행_지침.md = 알짜/09 사본) 2절을 따른다. 절 번호가 주석에 붙어 있고,
   지침 ↔ 코드 대조표는 docs/지시_로직.md — **지침을 고치면 그 표와 이 파일을 같이 고친다.**
     D    눈앞 상대 · 위력 × 상성 묶음 · 읽기 없음 · 교대 없음 · 지령 없음 · 4식은 HP 35% 아래에서
     C    기대 대미지 · HP 낮은 상대부터(둘이 한 상대를 겹쳐 때리지 않음) · 단순 지령은 이득이 보이면 바로 · 4식 45% 아래 · 4배 약점 위기면 교대
     B    + 쓰러뜨릴 수 있는 수 · 숙달 지령 ②(순서 공개 · 명중굴림 전 · 턴 종료) · 본 위협 ≥ HP 면 4식 · 교대
     A·AA B + 한 상대 집중 · 숙달저격 · 숙달회피
     wild 눈앞 상대에게 가장 센 기술 / 『와일드 보스』는 C 고르기
   상대 기술은 본 것(+ B 이상은 자속기 짐작)만 안다(2-1). 다루지 않는 것: 특성 · 소지품 · 포텐셜 · 날씨 · 필드 · 설치기 · 기술 방어 · 연속 제한 — docs/지시_로직.md 「못 하는 것」. */
"use strict";
const STATK={attack:'공격',defense:'방어',specialattack:'특공',specialdefense:'특방',speed:'스피드',accuracy:'명중',evasion:'회피'};
const LAD={E:0,D:0,C:1,B:2,A:3,AA:4,AAA:4,S:4};
const strip=s=>String(s||'').replace(/[+\-]/g,'').trim();
const POL=r=>{const l=LAD[strip(r)]??1;return l<=0?'D':l===1?'C':l===2?'B':'A'};
/* 씨앗 고정 난수 (xorshift32). 작은 씨앗은 처음 몇 값이 아주 작게 나와서(1 · 2 · 3 → 첫 굴림이 늘 1) 씨앗을 섞고 앞 값을 버린다 */
function mkRng(seed){let s=((seed>>>0)*2654435761+0x9e3779b9)>>>0;if(!s)s=123456789;const nx=()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return (s>>>0)/4294967296};for(let i=0;i<12;i++)nx();return nx}
const clone=o=>JSON.parse(JSON.stringify(o));
/* 레이드 배틀 (웹툴 battle_ui.js raidFloor · raidPhase 와 같은 꼴): 최대 HP × k/X 자리마다 배리어. 닿으면 깨지고(그 피해는 배리어에서 멈춤) 회복해도 안 살아남.
   깨진 턴의 턴 종료 이후 「트리거 : 페이즈 체인지」 — 자신의 부정적인 상태 · 능력치 하락 초기화, 적진(나와 있는) 능력치 상승 초기화. m.raid={segments:X} */
const NEGST=['Poison','Toxic','Burn','Paralysis','Freeze','Sleep','Confusion','Flinch','Taunt','Encore','Attract','Curse','LeechSeed','Yawn','Bind'];
function raidFloor(m){if(!m||!m.raid||!(+m.raid.segments>0))return 0;if(m.raid.mode==='cap'){/* 포텐셜 글 그대로: 턴 중 「HP : 1/X」 초과 피해를 받지 않는다 */const v=(+m.raid.t0||m.hp.cur)-Math.floor(m.hp.max/+m.raid.segments);return v>0?Math.min(v,m.hp.cur):0}const X=+m.raid.segments,br=+m.raid.broken||0;for(let k=X-1-br;k>=1;k--){const v=Math.floor(m.hp.max*k/X);if(v<m.hp.cur)return v}return 0}

function runBattle(W,opt){
 const B=W.OM_BATTLE,F=W.OM_FIELD,MA=W.OM_MOVEAUTO,S=W.OM_STATS,DB=W.OM_DB;
 const rng=opt.rng||mkRng(opt.seed||1);const o={rng};
 const fmt=opt.format||2,maxT=opt.maxTurns||30;const log=[];const say=s=>{if(opt.log)log.push(s)};
 const sides={};
 for(const sd of ['left','right']){const src=opt[sd];const parties=src.parties||[src];const trs={};const mons=[];
  parties.forEach((pt,k)=>{const t=pt.trainer||{name:sd+k,ranks:{}};const tid=t.id||(sd+k);const pol=pt.policy||src.policy||(t.wild?'wild':POL((t.ranks||{})['지시']));
   trs[tid]={tid,name:t.name||tid,pol,oc:Object.assign({},t.orderCount||{}),used:{order:0,command:0},trainer:t};
   pt.mons.forEach((m,i)=>{const x=clone(m);x.side=sd;x.tid=tid;x.i=mons.length;x.hp=x.hp||{};x.hp.max=+x.hp.max||+x.stats[0];if(x.hp.cur==null)x.hp.cur=x.hp.max;x.states=x.states||{};x.rank=x.rank||{};x.mod=x.mod||{};x.entry='';x.temp={};x.dealt=0;x.taken=0;mons.push(x)})});
  const first=Object.values(trs)[0];sides[sd]={name:Object.values(trs).map(t=>t.name).join('·'),pol:first.pol,mons,trs,trainer:first.trainer}}
 const polOf=m=>{const p=sides[m.side].trs[m.tid].pol;return p==='wild'&&m.boss?'C':p};   /* 지침 2-11: 야생은 본능, 보스(와일드 보스)는 C 정도 */const trOf=m=>sides[m.side].trs[m.tid];
 const alive=m=>m.hp.cur>0;
 const floorLoss=(m,v)=>{const fl=raidFloor(m);if(!fl||m.hp.cur-v>fl)return v;if(v>0){m.raid.broken=(+m.raid.broken||0)+1;m.raid.brk=1}return Math.max(0,m.hp.cur-fl)};const raidLog=[];const active=sd=>sides[sd].mons.filter(m=>m.entry);const bench=sd=>sides[sd].mons.filter(m=>!m.entry&&alive(m));
 const foes=sd=>active(sd==='left'?'right':'left');const other=sd=>sd==='left'?'right':'left';
 const enter=(sd,m,slot)=>{m.entry=slot;m.rank={};m.temp={};say(`${trOf(m).name} → ${m.name} 등장 (${slot})`)};
 /* 선발: 벤치에서 상대 선발에 상성이 좋은 순 (B 이상) · 앞에서부터 (D · C · wild) */
 const SLOTS=['a','b','c'].slice(0,fmt);
 const pickLead=(sd,n)=>{const L=bench(sd);const fs=foes(sd);
  /* 트레이너가 여럿이면 번갈아 (일행의 동행 포켓몬이 한 마리씩 서는 모양). 정책은 그 포켓몬 주인 것: D · C · wild 는 앞에서부터, B 이상은 상성 */
  const byT={};for(const m of L)(byT[m.tid]=byT[m.tid]||[]).push(m);const out=[];const tids=Object.keys(byT);let k=0;
  while(out.length<n&&tids.some(t=>byT[t].length)){const t=tids[k%tids.length];k++;const arr=byT[t];if(!arr.length)continue;const pol=sides[sd].trs[t].pol;let pick;
   if(pol==='D'||pol==='C'||pol==='wild'||!fs.length)pick=arr[0];else pick=arr.map(m=>({m,s:fs.reduce((a,f)=>a+matchup(m,f),0)})).sort((a,b)=>b.s-a.s)[0].m;
   arr.splice(arr.indexOf(pick),1);out.push(pick)}return out};
 const eff=(mv,def,atk)=>B.effectiveness([mv.typeEn],def,{atkTypes:atk.types}).value;
 const dmgMoves=m=>(m.moves||[]).filter(mv=>mv&&mv.cat!=='변화'&&+mv.pow>0);
 /* 기대 대미지(상성 · 자속 · 명중 반영, 주사위 중간값) */
 const expect=(atk,mv,def)=>{if(!mv||mv.cat==='변화'||!+mv.pow)return 0;const e=eff(mv,def,atk);if(!e)return 0;const r=B.damage(atk,def,mv,{rng:()=>0.5});const stab=(atk.types||[]).includes(mv.typeEn)?1.5:1;const acc=mv.acc?Math.min(1,(+mv.acc/100)*B.statValue(atk,'accuracy').rankMult/B.statValue(def,'evasion').rankMult):1;return r.total*e*stab*acc};
 const bestVs=(atk,def)=>{let best=null,bv=0;for(const mv of dmgMoves(atk)){const v=expect(atk,mv,def);if(v>bv){bv=v;best=mv}}return {mv:best,v:bv}};
 /* ── 지시 로직 v2 (10-27 밤 · 지침 = docs/배틀_진행_지침.md(알짜/09 사본) 2절 · 대조표 docs/지시_로직.md) ──
    정보 차단(2-1): 상대 기술은 「이 배틀에서 본 것」만 안다. C 는 본 것(없으면 자속기 짐작), B 이상은 본 것 + 자속기 짐작(2-7 「들고 있을 법한 기술」).
    D · 야생은 상대 수를 읽지 않는다(2-11 D 「읽기 없음」). 자기 기술은 다 안다. */
 const seen=new Map();const markSeen=(m,mv)=>{if(!mv)return;let s=seen.get(m);if(!s){s=new Set();seen.set(m,s)}s.add(mv.name)};
 const knownMoves=(pol,f)=>{const all=dmgMoves(f);const s=seen.get(f);const sn=s?all.filter(x=>s.has(x.name)):[];const stab=all.filter(x=>(f.types||[]).includes(x.typeEn));if(pol==='C')return sn.length?sn:stab;return Array.from(new Set(sn.concat(stab)))};
 const threatVs=(pol,f,m)=>{let best=null,bv=0;for(const mv of knownMoves(pol,f)){const v=expect(f,mv,m);if(v>bv){bv=v;best=mv}}return {mv:best,v:bv,f}};
 const topThreat=(pol,m)=>foes(m.side).filter(alive).map(f=>threatVs(pol,f,m)).sort((a,b)=>b.v-a.v)[0]||{mv:null,v:0};
 const matchup=(m,f)=>{const a=bestVs(m,f).v/Math.max(1,f.hp.cur),b=threatVs(polOf(m),f,m).v/Math.max(1,m.hp.cur);return a-b};
 const dangerOf=m=>{const fs=foes(m.side);return fs.reduce((s,f)=>s+threatVs(polOf(m),f,m).v,0)};
 const isSure=mv=>!!mv&&(!+mv.acc||/필중/.test(String(mv.eff||'')));   /* 3-3 · 8-3: 필중기는 물러나 · 피해라로 못 피한다 */
 const isOld=m=>/올드\s*타입/.test(JSON.stringify(m.pots||[]));   /* 2-5: 올드 타입은 메가 전 4식 · 6령을 못 받는다 (시뮬에 메가 없음 → 늘 못 받음) */
 const front=(m,fs)=>fs.find(f=>f.entry===m.entry)||fs[0];   /* 「눈앞 상대」 = 마주 선 자리 */
 const mastery=T=>T.pol==='B'||T.pol==='A';   /* 2-3: 지시 B 이상 = 숙달 지령 */
 for(const sd of ['left','right'])pickLead(sd,fmt).forEach((m,i)=>enter(sd,m,SLOTS[i]));

 /* 4식 · 6령 (단순) : orderCount 의 order_* / command_* 남은 횟수 안에서 */
 const takeOrder=(T,k)=>{const oc=T.oc;if(!((oc[k]||0)>0))return false;oc[k]--;T.used.order++;return true};
 const hasOrder=(T,k)=>(T.oc[k]||0)>0;
 /* 6령: 트레이너마다 한 턴에 하나(【공유 (『지령』)】, 2-3) · 받을 수 없는 포켓몬엔 안 건다(2-5). how = 숙달 ② 【임의】 때 */
 const useCommand=(T,m,stat,how)=>{if(T.cmdTurn||!m||isOld(m))return false;const k='command_'+stat;if(!((T.oc[k]||0)>0))return false;
  if(stat!=='heal'&&!STATK[stat])return false;T.oc[k]--;T.used.command++;T.cmdTurn=true;const nm=(how?'숙달':'')+(stat==='heal'?'회복':STATK[stat]);
  if(stat==='heal'){const b=m.hp.cur;m.hp.cur=Math.min(m.hp.max,m.hp.cur+Math.floor(m.hp.max/4));say(`${T.name} 『${nm}지령』${how?' ('+how+')':''} → ${m.name} HP +${m.hp.cur-b}`);return true}
  m.rank[stat]=Math.min(6,(+m.rank[stat]||0)+1);m.temp[stat]=(m.temp[stat]||0)+1;say(`${T.name} 『${nm}지령』${how?' ('+how+')':''} → ${m.name}`);return true};

 const initState=k=>{const d=(DB.states.st||{})[k]||{};if(k==='Sleep')return 1+Math.floor(rng()*2);if(k==='Confusion')return 2+Math.floor(rng()*3);if(k==='Freeze')return 3;if(k==='Flinch')return 1;return d.min>=1000||!d.min?1000:+d.min};
 const abnormal=m=>['Poison','Toxic','Burn','Paralysis','Freeze','Sleep'].some(k=>m.states[k]);
 const applyOps=(ops,user,target,lines)=>{for(const op of ops||[]){const tg=op.tgt==='self'||op.tgt==='user'?user:target;if(!tg)continue;
   if(op.k==='rank'){for(const k in op.stats){const v=+op.stats[k]||0;if(!v)continue;const b=+tg.rank[k]||0;tg.rank[k]=Math.max(-6,Math.min(6,b+v));if(tg.rank[k]!==b)lines.push(`${tg.name} ${STATK[k]||k} ${v>0?'+':''}${v}`)}}
   else if(op.k==='state'){const k=op.state;if(!k||tg.states[k]||tg.hp.cur<=0)continue;if(['Poison','Toxic','Burn','Paralysis','Freeze','Sleep'].includes(k)&&abnormal(tg))continue;
    if((k==='Poison'||k==='Toxic')&&(tg.types||[]).some(t=>t==='Poison'||t==='Steel'))continue;if(k==='Burn'&&(tg.types||[]).includes('Fire'))continue;if(k==='Paralysis'&&(tg.types||[]).includes('Electric'))continue;if(k==='Freeze'&&(tg.types||[]).includes('Ice'))continue;
    tg.states[k]=initState(k);lines.push(`${tg.name} 「${((DB.states.st||{})[k]||{}).ko||k}」`)}
   else if(op.k==='heal'){const fr=String(op.value||'1/2').split('/');const v=Math.max(1,Math.floor(tg.hp.max*(+fr[0]||1)/(+fr[1]||2)));const b=tg.hp.cur;tg.hp.cur=Math.min(tg.hp.max,tg.hp.cur+v);if(tg.hp.cur>b)lines.push(`${tg.name} HP +${tg.hp.cur-b}`)}}};

 /* 행동 고르기 (2-9 · 2-11). plan = 이 진영이 이번 턴 상대마다 넣기로 한 기대 대미지 (C 이상의 「두 마리 맞추기」) */
 const choose=(sd,m,plan)=>{const pol=polOf(m);const T=trOf(m);const fs=foes(sd).filter(alive);if(!fs.length)return null;
  const dm=dmgMoves(m);
  /* 야생 · D: 눈앞 상대에게 가장 세 보이는 공격(위력 × 상성 묶음 굉장 / 보통 / 별로 / 없음). 순서 · 상대 수는 안 본다. 무효는 D 도 안다 */
  if(pol==='wild'||pol==='D'){const tg=front(m,fs);let best=null,bv=-1;for(const mv of dm){const e=eff(mv,tg,m);const bucket=e>=2?2:e===0?0:e<1?0.5:1;const v=+mv.pow*bucket*(mv.range==='자신 이외'||/전체/.test(mv.range)?0.75:1);if(v>bv){bv=v;best=mv}}
   if(!best||bv<=0){best=dm[0]||(m.moves||[])[0]}return best?{mv:best,tg}:null}
  /* C 이상: 기대 대미지. 같은 편을 맞히는 전체기는 같은 편 피해 ×1.5 만큼 깎는다(2-11 C 「서로 방해하지 않기」 — 내 HP 를 잃는 쪽을 더 무겁게) */
  let cands=[];const allies=active(sd).filter(x=>x!==m&&alive(x));for(const tg of fs)for(const mv of dm){let v=expect(m,mv,tg);if(mv.range==='자신 이외')v-=allies.reduce((a,x)=>a+expect(m,mv,x),0)*1.5;cands.push({mv,tg,v,ko:v>=tg.hp.cur})}
  if(!cands.length){const st=(m.moves||[]).find(mv=>mv.cat==='변화');return st?{mv:st,tg:fs[0]}:null}
  const left=tg=>tg.hp.cur-(plan.get(tg)||0);const done=tg=>left(tg)<=0;   /* 같은 편이 이미 쓰러뜨리기로 한 만큼 뺀 남은 HP */
  const keep=c=>{if(c&&!/전체|자신 이외|상대 2체/.test(c.mv.range||''))plan.set(c.tg,(plan.get(c.tg)||0)+c.v);return c};
  if(pol==='C'){/* C: HP 가 가장 낮은 상대부터 · 한 마리로 충분한 상대를 둘이 때리지 않는다 */const ord=fs.slice().sort((a,b)=>a.hp.cur/a.hp.max-b.hp.cur/b.hp.max);const low=ord.find(t=>!done(t))||ord[0];
   const c=cands.filter(x=>x.tg===low).sort((a,b)=>b.v-a.v)[0]||cands.sort((a,b)=>b.v-a.v)[0];return keep(c)}
  /* B · A: 쓰러뜨릴 수 있으면 그것(여럿이면 나를 더 아프게 할 쪽 — 위협은 본 정보로) · 같은 편이 이미 쓰러뜨릴 상대는 빼고 */
  const kos=cands.filter(x=>!done(x.tg)&&x.v>=left(x.tg)).sort((a,b)=>threatVs(pol,b.tg,m).v-threatVs(pol,a.tg,m).v);if(kos.length)return keep(kos[0]);
  if(T.turn===1){const boost=(m.moves||[]).find(mv=>mv.cat==='변화'&&MA.parse(mv).groups.some(g=>g.ops.some(op=>op.k==='rank'&&op.tgt==='self'&&Object.values(op.stats).some(v=>v>0))));if(boost&&dangerOf(m)<m.hp.cur*0.5)return {mv:boost,tg:m}}
  const pool=cands.filter(x=>!done(x.tg));const P0=pool.length?pool:cands;const focus=T.focus;let pick=P0.slice().sort((a,b)=>b.v/Math.max(1,left(b.tg))-a.v/Math.max(1,left(a.tg)))[0];
  if(pol==='A'&&focus&&alive(focus)&&!done(focus)){const c=P0.filter(x=>x.tg===focus).sort((a,b)=>b.v-a.v)[0];if(c&&c.v>=pick.v*0.6)pick=c}
  if(pol==='A')T.focus=pick.tg;return keep(pick)};
 /* 교대 판단 (B 이상): 두 상대 모두에게 2배 이상 맞고, 벤치에 그보다 나은 아이가 있으면 */
 /* 교대 (2-10 · 2-11): D · 야생 · 보스는 안 한다. C 는 「4배 약점 · 확정 위기」 때만. B 이상은 상대 둘 모두에게 크게 맞고 벤치에 나은 아이가 있을 때 */
 const wantSwitch=(sd,m)=>{const pol=polOf(m);if(pol==='D'||pol==='wild'||trOf(m).trainer.wild)return null;const fs=foes(sd).filter(alive);if(!fs.length)return null;
  const L=bench(sd).filter(x=>x.tid===m.tid).map(x=>({x,s:fs.reduce((a,f)=>a+matchup(x,f),0)})).sort((a,b)=>b.s-a.s);if(!L.length)return null;const cur=fs.reduce((a,f)=>a+matchup(m,f),0);
  if(pol==='C'){const crit=fs.some(f=>{const t=threatVs('C',f,m);return t.mv&&eff(t.mv,m,f)>=4&&t.v>=m.hp.cur});return crit&&L[0].s>cur?L[0].x:null}
  const bad=fs.every(f=>threatVs(pol,f,m).v>=m.hp.cur*0.6);if(!bad)return null;return L[0].s>cur+0.5?L[0].x:null};

 let turn=0;const kos=[];const turnsLog=[];
 while(turn<maxT){turn++;for(const sd of ['left','right'])for(const T of Object.values(sides[sd].trs)){T.turn=turn;T.cmdTurn=false}
  if(!active('left').length||!active('right').length)break;
  for(const sd of ['left','right'])for(const m of sides[sd].mons)if(m.raid)m.raid.t0=m.hp.cur;
  /* 1. 지시 */
  const acts=[];const plan={left:new Map(),right:new Map()};
  for(const sd of ['left','right']){
   for(const m of active(sd)){if(!alive(m))continue;const sw=wantSwitch(sd,m);if(sw){acts.push({sd,m,sw});continue}const a=choose(sd,m,plan[sd]);if(a)acts.push(Object.assign({sd,m},a))}
   for(const T of Object.values(sides[sd].trs)){const pol=T.pol;if(T.trainer.wild)continue;const mine=active(sd).filter(m=>m.tid===T.tid&&alive(m));
    /* 6령 — 지시 단계 (2-3 · 2-11): D 는 지령이 없다(『4식』만). C(단순 지령)는 이득이 보이면 바로 — 위험한 아이 방어 > 지친 아이 회복 > 가장 센 공격수 강화.
       B 이상(숙달 지령)은 여기서 안 쓰고 ② 【임의】 때를 노린다 — 순서 공개 · 명중굴림 전 · 턴 종료 (2-4) */
    const myActs=acts.filter(a=>a.sd===sd&&a.m.tid===T.tid&&a.mv&&a.mv.cat!=='변화'&&!isOld(a.m));
    if(pol==='C'){const th=mine.filter(m=>!isOld(m)).map(m=>Object.assign(topThreat('C',m),{m})).filter(t=>t.mv&&t.v>=t.m.hp.cur*0.6).sort((a,b)=>b.v/b.m.hp.cur-a.v/a.m.hp.cur)[0];
     const tired=mine.filter(m=>!isOld(m)&&m.hp.cur<m.hp.max*0.4)[0];
     if(!(th&&useCommand(T,th.m,th.mv.cat==='특수'?'specialdefense':'defense'))&&!(tired&&useCommand(T,tired,'heal'))&&myActs.length){const a=myActs.sort((x,y)=>y.v-x.v)[0];useCommand(T,a.m,a.mv.cat==='특수'?'specialattack':'attack')}}
    /* 4식 (2-2): 지시 단계 선행 입력만 · 트레이너당 한 턴 하나 · 받을 수 없는 포켓몬 제외. 위협이 필중기면 물러나 · 피해라 대신 버텨라 (3-3) */
    let ord=false;for(const m of mine){if(ord)break;if(isOld(m)||acts.some(a=>a.m===m&&a.sw))continue;const threat=topThreat(pol==='D'?'C':pol,m);const ratio=m.hp.cur/m.hp.max;
     const need=pol==='D'?ratio<0.35:pol==='C'?ratio<0.45:pol==='B'?(threat.mv&&threat.v>=m.hp.cur):(threat.mv&&threat.v>=m.hp.cur&&ratio<0.6);if(!need)continue;
     const cat=threat.mv?threat.mv.cat:'';const sure=isSure(threat.mv);const k=!sure&&cat==='물리'&&hasOrder(T,'order_retreat')?'order_retreat':!sure&&cat==='특수'&&hasOrder(T,'order_dodge')?'order_dodge':hasOrder(T,'order_endure')?'order_endure':null;if(!k)continue;takeOrder(T,k);m.temp[k]=1;ord=true;say(`${T.name} 『${k==='order_retreat'?'물러나!':k==='order_dodge'?'피해라!':'버텨라!'}』 → ${m.name}`)}}}
  /* 2. 순서 */
  const entries=acts.map(a=>({mon:a.m,slot:a.sd+'_'+a.m.entry,cmd:{change:!!a.sw,priorityMap:{[a.sd+'_'+a.m.entry]:a.mv?+a.mv.prio||0:0}},started:true}));
  let order=B.turnOrder(entries,{},o);
  /* 숙달민첩지령 ② (행동 순서 공개 때, 2-4): 내가 쓰러뜨릴 상대가 먼저 움직이고, +1 이면 순서가 뒤집힐 때 */
  {let flip=false;for(const sd of ['left','right'])for(const T of Object.values(sides[sd].trs)){if(flip||T.trainer.wild||!mastery(T)||T.cmdTurn||!((T.oc.command_speed||0)>0))continue;
    for(const a of acts.filter(x=>x.sd===sd&&x.m.tid===T.tid&&x.mv&&x.mv.cat!=='변화'&&x.tg&&x.tg.side!==sd&&!isOld(x.m))){const me=order.findIndex(r=>r.mon===a.m),it=order.findIndex(r=>r.mon===a.tg);if(it<0||me<0||it>me)continue;
     if(order[it].prio!==order[me].prio||order[it].change||order[me].change)continue;if(a.v>=a.tg.hp.cur&&order[me].speed*1.5>order[it].speed&&threatVs(T.pol,a.tg,a.m).v>=a.m.hp.cur*0.5&&useCommand(T,a.m,'speed','순서 공개')){flip=true;break}}}
   if(flip)order=B.turnOrder(entries,{},o)}
  /* 3. 행동 */
  for(const row of order){const a=acts.find(x=>x.m===row.mon);if(!a||!alive(a.m))continue;const m=a.m,sd=a.sd;
   if(a.sw){const slot=m.entry;m.entry='';m.rank={};m.temp={};enter(sd,a.sw,slot);continue}
   const chk=F.actionCheck(m);if(!chk.ok){if(chk.selfHit){const v=floorLoss(m,Math.min(m.hp.cur,F.confusionHit(m)));m.hp.cur-=v;say(`${m.name} 혼란 자작 ${v}`)}else say(chk.lines[0]||`${m.name} 행동 실패`);if(m.hp.cur<=0){kos.push({name:m.name,side:sd,turn,by:'혼란'});m.entry=''}continue}
   const mv=a.mv;if(!mv)continue;markSeen(m,mv);const P=MA.parse(mv);const lines=[];
   let tgs;if(mv.range==='자신'||(mv.cat==='변화'&&a.tg===m))tgs=[m];else if(/전체|자신 이외/.test(mv.range)){tgs=foes(sd).filter(alive);if(mv.range==='자신 이외')tgs=tgs.concat(active(sd).filter(x=>x!==m&&alive(x)))}else if(/상대 2체/.test(mv.range))tgs=foes(sd).filter(alive).slice(0,2);else tgs=[alive(a.tg)?a.tg:foes(sd).filter(alive)[0]].filter(Boolean);
   if(mv.cat==='변화'){for(const tg of tgs){if(tg!==m&&mv.acc){const acc=B.accuracy(m,tg,mv,o);if(!acc.hit){lines.push(`${tg.name} 빗나감`);continue}}for(const g of P.groups)if(g.n>=10||rng()<g.n/10)applyOps(g.ops,m,tg,lines)}say(`${m.name} 『${mv.name}』 ${lines.join(' · ')}`);continue}
   /* 숙달공격 · 숙달특공지령 ② (아군의 명중굴림 전, 2-4): 이 한 방이 아슬아슬하게 못 쓰러뜨릴 때. 지시 A 는 빗나갈 수 있는 결정타에 숙달저격(명중 +1) */
   {const T=trOf(m);const tg0=tgs.find(alive);if(mv.cat!=='변화'&&tg0&&tg0.side!==m.side&&!T.trainer.wild&&mastery(T)&&!T.cmdTurn&&!isOld(m)){const v=expect(m,mv,tg0);
     if(v<tg0.hp.cur&&v*1.5>=tg0.hp.cur)useCommand(T,m,mv.cat==='특수'?'specialattack':'attack','명중굴림 전');else if(T.pol==='A'&&v>=tg0.hp.cur&&+mv.acc&&+mv.acc<100)useCommand(T,m,'accuracy','명중굴림 전')}}
   const multi=tgs.length>1;let dealtTotal=0;
   for(const tg of tgs){if(!alive(tg))continue;
    /* 숙달방어 · 숙달특방지령 ② (상대의 명중굴림 전, 2-4): 맞으면 쓰러질 때 지령 하나로 버틸 수 있으면. 지시 A 는 못 버티면 숙달회피 */
    {const D=trOf(tg);const dodged=(tg.temp.order_retreat&&mv.cat==='물리'||tg.temp.order_dodge&&mv.cat==='특수')&&!isSure(mv);if(mv.cat!=='변화'&&tg.side!==m.side&&!D.trainer.wild&&mastery(D)&&!D.cmdTurn&&!isOld(tg)&&!dodged){const v=expect(m,mv,tg);
      if(v>=tg.hp.cur&&v/1.5<tg.hp.cur)useCommand(D,tg,mv.cat==='특수'?'specialdefense':'defense','명중굴림 전');else if(D.pol==='A'&&v>=tg.hp.cur&&!isSure(mv))useCommand(D,tg,'evasion','명중굴림 전')}}
    if(tg.temp.order_retreat&&mv.cat==='물리'&&!isSure(mv)){lines.push(`${tg.name} 『물러나!』 회피`);continue}if(tg.temp.order_dodge&&mv.cat==='특수'&&!isSure(mv)){lines.push(`${tg.name} 『피해라!』 회피`);continue}
    const acc=B.accuracy(m,tg,mv,o);if(!acc.hit){lines.push(`${tg.name} 빗나감`);continue}
    const e=B.effectiveness([mv.typeEn],tg,{atkTypes:m.types});if(!e.value){lines.push(`${tg.name} 효과 없음`);continue}
    const cs=B.critStage(m,tg,{buff:P.critSure?4:0,input:/급소에 맞기 쉽다\(C\+(\d)\)/.test(mv.eff||'')?+RegExp.$1:0});const cr=B.critical(cs,o);
    const n=B.multiHits(mv,o);const hits=Array.from({length:n},()=>cr.crit?2:1);
    const dm=B.damage(m,tg,mv,{rng,hits,multiTarget:multi&&tgs.filter(alive).length>1});
    const fl=raidFloor(tg);const hd=B.hpDamageHits(tg,dm.hits.map(h=>h.value),e.value,{stab:e.stab,guard:tg.temp.order_endure?0.5:1,endure:!!tg.temp.order_endure,rng,hpFloor:fl});
    tg.hp.cur=hd.after;if(fl&&tg.hp.cur<=fl&&hd.final>0){tg.hp.cur=Math.max(tg.hp.cur,fl);tg.raid.broken=(+tg.raid.broken||0)+1;tg.raid.brk=1;lines.push(`◆ ${tg.name} 배리어(${fl}) 깨짐`)}m.dealt+=hd.final;tg.taken+=hd.final;dealtTotal+=hd.final;
    lines.push(`${tg.name} −${hd.final}${e.value!==1?` ×${e.value}`:''}${cr.crit?' 급소':''}${n>1?` ${hd.landed}타`:''}${hd.final>0&&tg.hp.cur<=0?' 쓰러짐':''}`);
    if(tg.hp.cur>0)for(const g of P.groups)if(g.when!=='use'&&(g.n>=10||rng()<g.n/10))applyOps(g.ops,m,tg,lines);
    if(tg.hp.cur<=0){kos.push({name:tg.name,side:tg.side,turn,by:m.name});tg.entry='';tg.states={}}}
   if(P.recoil&&dealtTotal>0){const fr=String(P.recoil.frac||'1/4').split('/');const v=Math.max(1,Math.floor((P.recoil.basis==='dealt'?dealtTotal:m.hp.max)*(+fr[0]||1)/(+fr[1]||4)));const v2=floorLoss(m,v);m.hp.cur=Math.max(0,m.hp.cur-v2);lines.push(`반동 −${v2}`);if(m.hp.cur<=0){kos.push({name:m.name,side:sd,turn,by:'반동'});m.entry=''}}
   if(P.drain&&dealtTotal>0){const fr=String(P.drain).split('/');const v=Math.max(1,Math.floor(dealtTotal*(+fr[0]||1)/(+fr[1]||2)));const b=m.hp.cur;m.hp.cur=Math.min(m.hp.max,m.hp.cur+v);if(m.hp.cur>b)lines.push(`흡수 +${m.hp.cur-b}`)}
   for(const g of P.groups)if(g.when==='use'&&g.ops.every(op=>op.tgt==='self'))if(g.n>=10||rng()<g.n/10)applyOps(g.ops,m,m,lines);
   say(`${m.name} 『${mv.name}』 ${lines.join(' · ')}`);
   if(P.selfSwitch&&bench(sd).length&&alive(m)){const slot=m.entry;m.entry='';m.rank={};m.temp={};const nx=pickLead(sd,1)[0];if(nx)enter(sd,nx,slot)}}
  /* 숙달회복지령 ② (지령을 안 쓴 턴의 종료 때, 2-4): 반 넘게 다친 아군에게 */
  for(const sd of ['left','right'])for(const T of Object.values(sides[sd].trs)){if(T.trainer.wild||!mastery(T)||T.cmdTurn||!((T.oc.command_heal||0)>0))continue;const w=active(sd).filter(m=>m.tid===T.tid&&alive(m)&&!isOld(m)&&m.hp.cur<=m.hp.max*0.5).sort((a,b)=>a.hp.cur/a.hp.max-b.hp.cur/b.hp.max)[0];if(w)useCommand(T,w,'heal','턴 종료')}
  /* 4. 턴 종료: 비례 대미지 · 지령 랭크 되돌림 · 4식 표시 지움 · 빈 자리 채우기 */
  for(const sd of ['left','right'])for(const m of active(sd)){if(!alive(m))continue;for(const r of B.turnEnd(m)){const d=r.delta<0?-floorLoss(m,-r.delta):r.delta;m.hp.cur=Math.max(0,Math.min(m.hp.max,m.hp.cur+d));if(r.delta<0)m.taken+=-r.delta}if(m.hp.cur<=0){kos.push({name:m.name,side:sd,turn,by:'상태'});m.entry='';continue}
   for(const k in m.temp){if(STATK[k]){m.rank[k]=(+m.rank[k]||0)-m.temp[k]}}m.temp={};if(m.states.Flinch)delete m.states.Flinch}
  /* 레이드: 배리어가 깨진 턴이 끝난 뒤 페이즈 체인지 */
  for(const sd of ['left','right'])for(const m of sides[sd].mons){if(!m.raid||!m.raid.brk)continue;delete m.raid.brk;if(!alive(m))continue;m.raid.phase=(+m.raid.phase||1)+1;
   for(const k of Object.keys(m.states))if(NEGST.includes(k))delete m.states[k];for(const k in m.rank)if(+m.rank[k]<0)m.rank[k]=0;
   let up=0;for(const x of active(other(sd))){if(!alive(x))continue;for(const k in x.rank)if(+x.rank[k]>0){x.rank[k]=0;up++}}raidLog.push({turn,name:m.name,phase:m.raid.phase,up});say(`「트리거 : 페이즈 체인지」 ${m.name} · 페이즈 ${m.raid.phase} (적진 상승 ${up}개 초기화)`)}
  for(const sd of ['left','right']){const used=new Set(active(sd).map(m=>m.entry));for(const s of SLOTS){if(used.has(s))continue;const nx=pickLead(sd,1)[0];if(nx){enter(sd,nx,s);used.add(s)}}}
  turnsLog.push({turn,hp:{left:sides.left.mons.map(m=>m.hp.cur),right:sides.right.mons.map(m=>m.hp.cur)}});
  if(!sides.left.mons.some(alive)||!sides.right.mons.some(alive))break}
 const winner=!sides.right.mons.some(alive)?'left':!sides.left.mons.some(alive)?'right':'draw';
 const mo=m=>({id:m.id,tid:m.tid,name:m.name,hp:m.hp.cur,max:m.hp.max,states:Object.keys(m.states),dealt:m.dealt,taken:m.taken});const to=sd=>Object.fromEntries(Object.values(sides[sd].trs).map(T=>[T.tid,{name:T.name,pol:T.pol,used:T.used,oc:T.oc}]));
 const out={winner,turns:turn,kos,raid:raidLog,left:sides.left.mons.map(mo),right:sides.right.mons.map(mo),trainers:{left:to('left'),right:to('right')},log};
 return out}
module.exports={runBattle,mkRng,POL};
