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
 const rng=opt.rng||mkRng(opt.seed||1);H.setRng(rng);H.logOn=!!opt.log;H.cards=opt.cards||null;   /* 11-01 은열쇠: 보험형 배틀 카드 (fight.js cardTake) */
 const fmt=Math.max(1,Math.min(3,opt.format||2)),maxT=opt.maxTurns||30;
 /* ---- 배틀 차리기 (웹툴 encounter · prepMon 과 같은 꼴) ---- */
 const b={turn:0,phase:0,mode:fmt,sides:{left:{trainers:[]},right:{trainers:[]}},trainers:{},mons:{},field:{},cmds:{},order:[],ordPool:opt.pool?1:0};   /* 11-04: 던전 공용 풀이면 웹툴 battle_ui 의 일행 몫 이름(pName)이 다른 지시 체계 종류도 빌려 준 사람 이름으로 건다 */
 const POLS={};let wildN=0;
 const addParty=(side,pt,k)=>{const t=clone(pt.trainer||{name:side+k,ranks:{}});const wild=!!t.wild;const tid=wild?'wild_'+side+'_'+(wildN++):(t.id||side+k);t.id=tid;t.side=side;delete t.solo;if(!t.orderCount)t.orderCount={};
  b.sides[side].trainers.push(tid);b.trainers[tid]=t;POLS[tid]=pt.policy||(wild?'wild':process.env.FORCEPOL||POL((t.ranks||{})['지시']));/* 11-15 FORCEPOL=B : 모두 같은 지시 랭크로 — 덱 힘만 견주기 */
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
 /* 11-14 망령 「학생들끼리 포텐셜 잘 활용하면서 배틀 · 로그 분석 · 지시 로직 다듬기」: opt.ai = {left:'new'|'', right:…} — 'new' 쪽만 새 지시 로직 (옛 로직과 견주려고) */
 const AI=sd=>{const v=opt.ai&&opt.ai[sd];return v?v==='new':!process.env.OLDAI};/* 11-14 밤 망령 「지침도 바꿔」: 새 로직이 기본 — 옛 로직은 ai 'old' 또는 OLDAI=1 */const sideOfTid=tid=>(C().trainers[tid]||{}).side||'left';
 /* 새 로직 ①: 「기능 확장」 기술도 공격 후보 (행동으로 쓰는 것만 · 횟수 남은 것). 트레이너 기능 확장은 웹툴 extUse, 포텐셜 쪽은 그 포텐셜의 【N/시】 · 【탈진】 · 【소진】을 시뮬이 센다 */
 const PX={};const extSrcEff=(tid,src)=>{const t=C().trainers[tid]||{};const nm=x=>String(x||'').replace(/[『』\s]/g,'');for(const u of t.unique||[])if(u&&nm(u.name)===nm(src))return String(u.eff||'');for(const m of Object.values(C().mons))if(m.tid===tid)for(const q of FN.potSrc(m))if(nm(q.name)===nm(src))return String(q.eff||'');return ''};
 const extOk=(m,mv)=>{const X=mv.ext;if(!X||X.kind==='extra')return false;if(X.tid!=null&&X.i!=null)return !(X.lim&&X.left<=0);const e=extSrcEff(m.tid,X.src||X.pot);const k=m.tid+'|'+(X.src||X.pot);const u=PX[k]||{n:0,t:-9};const T=+C().turn||0;const mm=e.match(/【\s*(\d+)\s*\/\s*시\s*】/);if(mm&&u.n>=+mm[1])return false;if(/【\s*탈진\s*】/.test(e)&&T-u.t<=1)return false;if(/【\s*소진\s*】/.test(e)&&u.t===T)return false;return true};
 const extUsed=async(m,mv)=>{const X=mv&&mv.ext;if(!X)return;if(X.tid!=null&&X.i!=null){const t=C().trainers[X.tid];const U=Object.assign({},(t&&t.extUse)||{});U[X.i]=(+U[X.i]||0)+1;await W.OM_APP.set(['battle','trainers',X.tid,'extUse'],U);return}const k=m.tid+'|'+(X.src||X.pot);const u=PX[k]||{n:0,t:-9};PX[k]={n:u.n+1,t:+C().turn||0}};
 const dmgMoves=m=>FN.MVS(m).map((mv,i)=>Object.assign({},mv,{_i:i})).filter(mv=>mv&&mv.cat!=='변화'&&+mv.pow>0&&!mv.virt&&(!mv.ext||(AI(m.side)&&extOk(m,mv))));
 const allMoves=m=>FN.MVS(m).map((mv,i)=>Object.assign({},mv,{_i:i})).filter(mv=>mv&&!mv.virt&&!mv.ext);
 /* 11-14 「차지」 기술: 모으는 턴이 있어 한 턴 값은 반 (날씨로 생략 · 파워풀허브 · 이미 모았으면 그대로) */
 const CHG_RE=/「차지」/;const chargeSkip=(m,mv)=>{const e=String(mv.eff||'');const W0=FN.wxNow?FN.wxNow(C()):'';const sk=e.match(/「날씨\s*:\s*([^」]+)」일 때 「차지」를 생략/);return !!(sk&&W0&&sk[1].split(/[,，]\s*/).map(q=>q.trim()).includes(W0))||(FN.HAS&&FN.HAS(m,'파워풀허브'))};
 const charged=(m,mv)=>!!(m.charge&&m.charge.mv===mv.name&&+m.charge.turn<(+C().turn||0));
 const expect=(atk,mv,def,multi)=>{let v=0;try{v=FG.estimate(H,W,atk,def,mv,{multi})}catch(e){return 0}{/* 11-15 연속 제한 — 바로 전 턴에 같은 기술이면 성공 확률만큼 */const cm=String(mv.eff||'').match(/「연속\s*제한\s*:\s*(실패\s*확률\s*증가|확정\s*실패)」/);if(cm&&atk.lastMove===mv.name&&+atk.lastMoveT===(+C().turn||0)-1){const k=Math.max(1,+((atk.consec&&atk.consec.name===mv.name)?atk.consec.n:1));v*=/확정/.test(cm[1])?0:Math.pow(1/3,k)}}if(CHG_RE.test(String(mv.eff||''))&&!charged(atk,mv)&&!chargeSkip(atk,mv))v*=0.5;return v};
 const reach=(atk,mv,def)=>{const fx=fixTg(atk,mv,[def]);return !fx||fx.includes(def)};const bestVs=(atk,def)=>{let best=null,bv=0;for(const mv of dmgMoves(atk)){if(!reach(atk,mv,def))continue;const v=expect(atk,mv,def);if(v>bv){bv=v;best=mv}}return {mv:best,v:bv}};
 /* 2-1 정보 차단: 상대 기술은 이 배틀에서 본 것 · C 는 본 것(없으면 자속기 짐작) · B 이상은 본 것 + 자속기 짐작 */
 const knownMoves=(pol,f)=>{const all=dmgMoves(f);const s=seen.get(f.id);const sn=s?all.filter(x=>s.has(x.name)):[];const stab=all.filter(x=>(FN.tysOf(f)||[]).includes(x.typeEn));if(pol==='C')return sn.length?sn:stab;return Array.from(new Set(sn.concat(stab)))};
 const threatVs=(pol,f,m)=>{let best=null,bv=0;for(const mv of knownMoves(pol,f)){if(!reach(f,mv,m))continue;const v=expect(f,mv,m);if(v>bv){bv=v;best=mv}}return {mv:best,v:bv,f}};
 const topThreat=(pol,m)=>foes(m.side).map(f=>threatVs(pol,f,m)).sort((a,c)=>c.v-a.v)[0]||{mv:null,v:0};
 const matchup=(m,f)=>bestVs(m,f).v/Math.max(1,f.hp.cur)-threatVs(polOf(m),f,m).v/Math.max(1,m.hp.cur);
 const dangerOf=m=>foes(m.side).reduce((s,f)=>s+threatVs(polOf(m),f,m).v,0);
 const front=(m,fs)=>fs.find(f=>f.entry===m.entry)||fs[0];
 /* 11-15 망령 「정면기 제약은 계산되고 있어?」: 범위 「정면」 · 「대각」 기술은 웹툴 defaultTargets 가 정한 그 자리 상대만 (전엔 아무 상대나 골랐음) */
 const FIXR=/^(정면|대각)$/;const fixTg=(m,mv,opp)=>{if(!FIXR.test(String(mv.range||'')))return null;let sl=[];try{sl=FN.defaultTargets(C(),m.id,String(mv._i))||[]}catch(e){}const L=sl.map(x=>{const [sd,ar]=String(x).split('_');return opp.find(f=>f.side===sd&&f.entry===ar)}).filter(Boolean);return L};
 const isOld=m=>/올드\s*타입/.test(JSON.stringify(m.pots||[]));
 const isSure=mv=>!!mv&&(!+mv.acc||/필중/.test(String(mv.eff||'')));
 const mastery=tid=>{const p=POLS[tid];return p==='B'||p==='A'};
 const spd=m=>{try{return B.statValue(m,'speed').value*(FN.spMulOf(m,FN.fieldOf(C())).v||1)}catch(e){return +m.stats[5]||0}};
 /* ---- 선발 · 교대 고르기 ---- */
 /* 11-15 망령 「카렌 전위 A-1 — 바위 아군이 없으면 다음 턴 행동 불능인데 짝을 고를 때 안 본다」: 각성 (대가) A-1 의 지정 타입(트레이너 misag.type) 을 선발 · 내밀기 점수에 — 그 타입 짝이 있으면 +1.5 · 없으면 −1.5, 짝 잃은 A-1 아이 옆에 그 타입이면 +1.5 */
 const a1Type=m=>{const t=C().trainers[m.tid];const M=t&&t.misag;if(!M||m.awaken!=='free'||!M.type||t.two||!(M.items||[]).some(x=>x.key==='A-1'))return '';return String(M.type)};
 const hasTyKo=(x,ko)=>{const en=W.OM_STATS&&W.OM_STATS.typeEn?W.OM_STATS.typeEn(ko):ko;return (x.types||[]).includes(en)||(x.typesKo||[]).includes(ko)};
 const a1Score=(m,mates,later)=>{let v=0;const ta=a1Type(m);if(ta){if(mates.some(p=>hasTyKo(p,ta)))v+=1.5;else if(later&&later.some(p=>hasTyKo(p,ta)))v+=0.5;else v-=1.5}
  for(const p of mates){const tp=a1Type(p);if(tp&&!mates.some(q=>q!==p&&hasTyKo(q,tp))&&hasTyKo(m,tp))v+=1.5}return v};
 /* 11-15 09시 망령 「순풍 · 벽 · 날씨 · 트릭룸은 기초 택틱」: 판을 까는 아이는 판이 이득일 때 먼저 낸다 — 트릭룸(우리 편이 느림) · 순풍(순풍으로 앞지르게 될 아이가 많음) · 벽 · 날씨 기술 · 등장 날씨 특성. 깔린 판이 이미 있으면 덤 없음 */
 const setupBonus=(m,sd)=>{const f=FN.fieldOf(C());const mine=Object.values(C().mons).filter(x=>x.side===sd&&x.hp.cur>0);const th=Object.values(C().mons).filter(x=>x.side!==sd&&x.hp.cur>0);if(!th.length)return 0;const sp=x=>+x.stats[5]||0;const fAvg=th.reduce((a,x)=>a+sp(x),0)/th.length,mAvg=mine.reduce((a,x)=>a+sp(x),0)/Math.max(1,mine.length);const fMax=Math.max(...th.map(sp));const mv=n=>FN.MVS(m).some(q=>q&&q.name===n);let v=0;
  if(mv('트릭룸')&&!(+((f.rooms||{})['트릭룸']||0)>0)){const slow=mine.filter(x=>sp(x)<fAvg).length;if(mAvg<fAvg*0.9&&slow>=3)v+=0.4+0.15*slow}
  if(mv('순풍')&&!(+((f.objects||{})[sd]||{})['순풍']>0)){const flip=mine.filter(x=>sp(x)<fMax&&sp(x)*2>fMax).length;v+=0.15*flip}
  if((mv('리플렉터')||mv('빛의장막')||mv('오로라베일'))&&mine.length>=3)v+=0.3;
  const WX={쾌청:'맑음',비바라기:'비',모래바람:'모래바람',설경:'눈',싸라기눈:'싸라기눈'};
  /* 등장하면 날씨를 까는 특성(눈퍼뜨리기 · 가뭄 · 잔비 · 모래날림) — 덕을 볼 우리 편(그 날씨에 세지는 자속 기술 · 눈의 얼음 · 모래의 바위)만큼 */
  {const AW={눈퍼뜨리기:'눈',가뭄:'맑음',잔비:'비',모래날림:'모래바람'}[String(m.ability||'').trim()];const cw0=String((f.weather||{}).type||'');if(AW&&cw0!==AW){const n=mine.filter(x=>x!==m&&(FN.MVS(x).some(q=>q&&q.cat!=='변화'&&((FN.WEATHER_MUL||{})[AW]||{})[q.typeEn]>1&&FN.tysOf(x).includes(q.typeEn))||(AW==='눈'&&FN.tysOf(x).includes('Ice'))||(AW==='모래바람'&&FN.tysOf(x).includes('Rock')))).length;v+=0.1*n;if(AW==='눈'&&FN.MVS(m).some(q=>q&&q.name==='오로라베일'))v+=0.3}}const WM=FN.WEATHER_MUL||{};const cw=String((f.weather||{}).type||'');
  for(const [k,w] of Object.entries(WX))if(mv(k)&&cw!==w){const n=mine.filter(x=>FN.MVS(x).some(q=>q&&q.cat!=='변화'&&(WM[w]||{})[q.typeEn]>1&&FN.tysOf(x).includes(q.typeEn))).length;v+=0.12*n}
  return Math.min(1.5,v)};
 const pickIn=(sd,n,tidPref)=>{const L=bench(sd);const fs=foes(sd);const byT={};for(const m of L)(byT[m.tid]=byT[m.tid]||[]).push(m);const out=[];const tids=Object.keys(byT);if(tidPref&&byT[tidPref])tids.sort((x,y)=>(y===tidPref)-(x===tidPref));let k=0;
  while(out.length<n&&tids.some(t=>byT[t].length)){const t=tids[k%tids.length];k++;const arr=byT[t];if(!arr.length)continue;const pol=POLS[t];let pick;
   const aiP=AI(sd)&&pol!=='wild'&&!process.env.NOPICK;if(!aiP&&(pol==='D'||pol==='C'||pol==='wild'||!fs.length))pick=arr[0];else{const mates=[...active(sd),...out];const more=n-out.length>=2&&!mates.length;pick=arr.map((m,i)=>({m,i,s:(fs.length?fs.reduce((a,f)=>a+matchup(m,f),0):0)+(aiP?a1Score(m,mates,more?arr.filter(x=>x!==m):null)+(process.env.NOSETUP?0:setupBonus(m,sd)):0)})).sort((a,c)=>c.s-a.s||a.i-c.i)[0].m}arr.splice(arr.indexOf(pick),1);out.push(pick)}return out};
 /* ---- 행동 고르기 (2-9 · 2-11) ---- */
 const statusPlan=(sd,m,pol,fs,best,J)=>FG.statusPick(H,W,{J,ai:AI(sd),bench:bench(sd),matchup,m,pol,fs,best,allies:active(sd).filter(x=>x!==m),threatVs,topThreat,dangerOf,turn:C().turn,expect,spd,isOld});
 const choose=(sd,m,plan)=>{const pol=polOf(m);const fs=foes(sd);if(!fs.length)return null;const dm=dmgMoves(m);const st=m.states||{};
  /* 11-14 모은 다음 턴: 그 기술 · 대상으로 */
  if(m.charge&&+m.charge.turn<(+C().turn||0)){const mv=allMoves(m).find(x=>x.name===m.charge.mv);if(mv){const tg=(m.charge.tg&&C().mons[m.charge.tg]&&alive(C().mons[m.charge.tg])&&C().mons[m.charge.tg].entry)?C().mons[m.charge.tg]:fs[0];return {mv,tg,v:0}}}
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
 /* 새 로직 ④: 두 마리 공격을 함께 고른다 (11-14) — 상대마다 「얼마나 위협적인가」 × 깎는 비율(쓰러뜨리면 덤), 같은 편을 맞히는 전체기는 뺀다.
    한 마리를 확실히 쓰러뜨리는 쪽(상대 공격 수가 줄어든다)이 두 마리를 반씩 깎는 것보다 낫게 */
 const SPREAD=/전체|자신 이외|상대 2체/;
 /* 11-15 망령 「포켓몬 할 줄 몰라? 상성으로 교대해서 받거나 · 방어로 막거나 · 4식 6령으로 흘리고, 거기서부터 상대의 대응을 읽는 수읽기」:
    두 수 읽기(chooseJoint2) — ① 상대 쪽 후보(공격 · 방어 · 안전한 교대)를 「우리가 평범하게 칠 때」 기준으로 저울질해 상대가 둘 만한 수 몇 개를 뽑고(상대가 아는 것 = 우리가 공개한 기술만)
    ② 우리 후보(공격 · 방어 · 안전한 교대) 마다 그 상대 수들에 대해 한 턴을 돌려 가중 평균이 가장 큰 것을 고른다. C 는 상대 수 1개(지금 그대로 · 읽기 없음) · B 3개 · A · AA 4개. 교대는 그 자리로 오는 공격을 들어온 아이가 받는다 · 상대가 교대하면 우리 공격은 들어온 아이에게. */
 function chooseJoint2(sd){const me=active(sd).filter(m=>{const st=m.states||{};return !(st.Thrash||st.Encore)&&!(m.charge&&+m.charge.turn<(+C().turn||0))});const fs=foes(sd).filter(f=>{const st=f.states||{};return !(f.charge&&+f.charge.turn<(+C().turn||0))});if(me.length<2||!fs.length)return null;
  const T0=+C().turn||0;const pol0=polOf(me[0]);const P0=pol0==='D'?'C':pol0;const EX=new Map();const ex=(a,mv,d,multi)=>{const k=a.id+'|'+(mv._i!=null?mv._i:mv.name)+'|'+d.id+'|'+(multi?1:0);if(!EX.has(k))EX.set(k,expect(a,mv,d,multi));return EX.get(k)};
  const ms=(x,opp)=>opp.reduce((a,f)=>a+(bestVs(x,f).v/Math.max(1,f.hp.cur)-threatVs(P0,f,x).v/Math.max(1,x.hp.cur)),0);
  const moves=(m,mine)=>mine?dmgMoves(m):knownMoves(P0,m);
  /* 후보: 공격(상위 6) · 방어 · 안전한 교대(상위 2) */
  const cands=(m,mine,opp,side)=>{const L=[];const st=m.states||{};for(const mv of moves(m,mine)){if(st.Taunt&&mv.cat==='변화')continue;{const fx=fixTg(m,mv,opp);if(fx){for(const f of fx)L.push({mv,tg:f,d:{[f.id]:ex(m,mv,f,false)},pen:0});continue}}if(SPREAD.test(mv.range||'')){const d={};for(const f of opp)d[f.id]=ex(m,mv,f,true);let pen=0;if(mv.range==='자신 이외')for(const x of active(side))if(x!==m)pen+=ex(m,mv,x,true)/Math.max(1,x.hp.cur);L.push({mv,d,pen})}else for(const f of opp)L.push({mv,tg:f,d:{[f.id]:ex(m,mv,f,false)},pen:0})}
   const L2=L.sort((a,c)=>Object.values(c.d).reduce((x,y)=>x+y,0)-Object.values(a.d).reduce((x,y)=>x+y,0)).slice(0,6);
   if(!process.env.NOPROT&&!st.Taunt&&m.protectLast!==T0-1){const pm=FN.MVS(m).map((mv,i)=>Object.assign({},mv,{_i:i})).find(mv=>mv&&FN.protMove(mv)&&!mv.virt);if(pm&&(mine||(seen.get(m.id)||new Set()).has(pm.name)||P0!=='C'))L2.push({mv:pm,tg:m,d:{},pen:0,prot:1})}
   if(!ENVS('NOJSW',side)&&!(st.Bind||st.MeanLook||st.Block||m.charge)&&!(T0>1&&+m.inT>=T0-1)){const m0=ms(m,opp);const mates=active(side).filter(y=>y!==m);
    bench(side).filter(x=>x.tid===m.tid).map(x=>({x,s:ms(x,opp)})).sort((a,c)=>c.s-a.s).slice(0,3).forEach(o=>{const worst=opp.reduce((acc,f)=>{const t=threatVs(P0,f,m);return acc+(t.mv?ex(f,t.mv,o.x,false):0)},0);if(o.s>m0&&worst<o.x.hp.cur*(+process.env.SWSAFE||0.7))L2.push({sw:o.x,tg:m,d:{},pen:0,lt:(+process.env.SWLT||0.4)*(o.s-m0)+0.15*a1Score(o.x,mates,null)})})}
   return L2};
  const twOf=(att,def)=>{const t={};for(const f of def){let w=0;for(const m of att){const th=threatVs(P0,f,m);w=Math.max(w,th.v/Math.max(1,m.hp.cur))}t[f.id]=0.6+Math.min(1.6,w)}return t};
  const PB0=(()=>{const F0=FN.fieldOf(C());const twF=+(((F0.objects||{})[fs[0].side]||{})['순풍']||0);const trR=+((F0.rooms||{})['트릭룸']||0);const avg=L=>L.reduce((a,x)=>a+(+x.stats[5]||0),0)/Math.max(1,L.length);return +(process.env.PROTB||0.25)+(twF>0||(trR>0&&avg(fs)<avg(me))?0.3:0)})();
  /* 한 턴 돌리기 — A 쪽에서 본 값 (pa · pb = 포켓몬 id → 후보) */
  /* 11-15 망령 「아니스는 킬링 에이스로 쓰러뜨려서 회복하거나 살아나가는 움직임」: 【함성】 회복 포텐셜이 있는 아이가 쓰러뜨리면 그만큼 덤 (『폭식의 대죄』 1/4 → 1/2) */
  const SH=new Map();const shoutHeal=x=>{if(SH.has(x.id))return SH.get(x.id);let h=0;const ps=[...(x.pots||[]),...(x.excl?[x.excl]:[]),...(x.exclX||[])];for(const p of ps){const m=String(p&&p.eff||'').replace(/<br\s*\/?>/g,'\n').match(/【함성[^】]*】[^\n]*?「HP」를\s*(\d+)\/(\d+)만큼\s*회복/);if(m)h=Math.max(h,+m[1]/+m[2])}if(h&&ps.some(p=>/회복량을\s*강화\s*\(\s*1\/4\s*→\s*1\/2\s*\)/.test(String(p&&p.eff||''))))h=0.5;SH.set(x.id,h);return h};
  const evalP=(A,B,pa,pb,twB)=>{const hp={};const all=[...A,...B];for(const x of all)hp[x.id]=x.hp.cur;const swOf=id=>{const p=pa[id]||pb[id];return p&&p.sw?p.sw:null};for(const x of all){const y=swOf(x.id);if(y)hp[y.id]=y.hp.cur}
   const isA=new Set(A.map(x=>x.id));const sp=x=>spd(x);/* 11-15: 순서 = 우선도(교대 먼저) → 스피드 (트릭룸이면 느린 쪽 먼저) — 전엔 스피드만 봐서 트릭룸 · 우선도 기술이 읽기에 안 들어갔다 */const TRn=+((FN.fieldOf(C()).rooms||{})['트릭룸']||0)>0;const prA=x=>{const p=pa[x.id]||pb[x.id];if(!p)return 0;if(p.sw)return 7;if(p.prot)return 4;try{return p.mv?(FX.prioOf?FX.prioOf(x,p.mv):+(p.mv.prio||0)):0}catch(e){return +((p.mv||{}).prio||0)}};const actors=all.slice().sort((x,y)=>(prA(y)-prA(x))||(TRn?sp(x)-sp(y):sp(y)-sp(x)));let v=0;
   for(const x of actors){if(hp[x.id]<=0)continue;const p=isA.has(x.id)?pa[x.id]:pb[x.id];if(!p||p.sw||p.prot)continue;
    for(const tid of Object.keys(p.d)){const T=all.find(z=>z.id===tid);if(!T)continue;const tp=isA.has(tid)?pa[tid]:pb[tid];let R=T,dv=p.d[tid];if(tp&&tp.sw){R=tp.sw;dv=ex(x,p.mv,R,Object.keys(p.d).length>1)}
     if(hp[R.id]<=0||dv<=0)continue;if(tp&&tp.prot&&R===T){if(!isA.has(x.id))v+=PB0;continue}const b0=hp[R.id];hp[R.id]=Math.max(0,b0-dv);const fr=(b0-hp[R.id])/Math.max(1,R.hp.cur);if(isA.has(x.id)){v+=(twB[R.id]||twB[tid]||1)*fr;if(b0>0&&hp[R.id]<=0){const h=shoutHeal(x);if(h){const gain=Math.min(h*x.hp.max,x.hp.max-hp[x.id]);hp[x.id]+=gain;v+=0.8*gain/Math.max(1,x.hp.max)}}}else v-=0.8*fr}}
   for(const f of B){const y=pb[f.id]&&pb[f.id].sw;const R=y||f;if(hp[R.id]<=0)v+=0.6*(twB[f.id]||1)}
   for(const m of A){const p=pa[m.id];if(p&&p.sw){if(hp[p.sw.id]<=0)v-=0.5;v+=p.lt||0}else if(hp[m.id]<=0)v-=0.5;if(p)v-=1.2*(p.pen||0)}return v};
  const plansOf=(L1,L2,mons)=>{const out=[];for(const a of L1)for(const c of L2){if(a.prot&&c.prot)continue;if(a.sw&&c.sw&&a.sw===c.sw)continue;out.push({[mons[0].id]:a,[mons[1].id]:c})}return out};
  const CA=me.map(m=>cands(m,true,fs,sd));if(CA.some(L=>!L.length))return null;const twF=twOf(me,fs);
  /* 상대 수 */const fsd=fs[0].side;const CB=fs.map(f=>cands(f,false,me,fsd));let foeP=[];
  const defB={};for(let i=0;i<fs.length;i++){const f=fs[i];let bt=null,br=-1;for(const m of me){const t=threatVs(P0,f,m);const r=t.v/Math.max(1,m.hp.cur);if(r>br){br=r;bt={m,t}}}const c0=CB[i].filter(c=>!c.prot&&!c.sw&&(c.tg===bt.m||(c.d&&c.d[bt.m.id]>0))).sort((a,c)=>(c.d[bt.m.id]||0)-(a.d[bt.m.id]||0))[0]||CB[i][0];if(c0)defB[f.id]=c0}
  const K=ENVS('NOREAD',sd)?1:P0==='C'?(+process.env.CREAD||1):P0==='B'?3:4;/* 11-15 02:43 C 2수 → 04:50 망령 「지시 C 를 조금 더 단순하게」 · 수읽기 줄이기: C 는 상대가 가장 셀 법한 한 수만 가정(저울질 없음 · 교대 · 짝은 그대로). CREAD=2 면 옛 C */
  if(K===1||fs.length<2)foeP=[{p:defB,w:1}];else{const defA={};me.forEach((m,i)=>{defA[m.id]=CA[i].filter(c=>!c.prot&&!c.sw).sort((a,c)=>Math.max(0,...Object.entries(c.d).map(([k,v])=>v/Math.max(1,(fs.find(f=>f.id===k)||{hp:{cur:1}}).hp.cur)))-Math.max(0,...Object.entries(a.d).map(([k,v])=>v/Math.max(1,(fs.find(f=>f.id===k)||{hp:{cur:1}}).hp.cur))))[0]||CA[i][0]});
   const twM=twOf(fs,me);const sc=plansOf(CB[0],CB[1],fs).map(p=>({p,v:evalP(fs,me,p,defA,twM)})).sort((a,c)=>c.v-a.v).slice(0,K);const tau=P0==='C'?0.4:P0==='B'?0.3:0.2;const mx=sc[0]?sc[0].v:0;let sw=0;for(const o of sc){o.w=Math.exp((o.v-mx)/tau);sw+=o.w}foeP=sc.map(o=>({p:o.p,w:o.w/sw}))}
  let best=null,bv=-1e9;for(const pa of plansOf(CA[0],CA[1],me)){let v=0;for(const o of foeP)v+=o.w*evalP(me,fs,pa,o.p,twF);if(v>bv){bv=v;best=pa}}
  if(!best)return null;const out=new Map();for(const m of me){const x=best[m.id];out.set(m.id,x.sw?{sw:x.sw}:{mv:x.mv,tg:x.tg||Object.keys(x.d).map(k=>fs.find(f=>f.id===k)).filter(Boolean).sort((a,c)=>(x.d[c.id]||0)-(x.d[a.id]||0))[0]||fs[0],v:x.tg?(x.d[x.tg.id]||0):0,prot:x.prot})}return out}
 function chooseJoint(sd){const me=active(sd).filter(m=>{const st=m.states||{};return !(st.Thrash||st.Encore)&&!(m.charge&&+m.charge.turn<(+C().turn||0))});const fs=foes(sd);if(me.length<2||!fs.length)return null;
  const pol0=polOf(me[0]);const tw={};for(const f of fs){let w=0;for(const m of active(sd)){const th=threatVs(pol0==='D'?'C':pol0,f,m);w=Math.max(w,th.v/Math.max(1,m.hp.cur))}tw[f.id]=0.6+Math.min(1.6,w)}
  const cands=m=>{const L=[];for(const mv of dmgMoves(m)){if((m.states||{}).Taunt&&mv.cat==='변화')continue;{const fx=fixTg(m,mv,fs);if(fx){for(const f of fx)L.push({mv,tg:f,d:{[f.id]:expect(m,mv,f,false)},pen:0});continue}}if(SPREAD.test(mv.range||'')){const d={};for(const f of fs)d[f.id]=expect(m,mv,f,true);let pen=0;if(mv.range==='자신 이외')for(const x of active(sd))if(x!==m)pen+=expect(m,mv,x,true)/Math.max(1,x.hp.cur);L.push({mv,tg:fs.slice().sort((a,c)=>d[c.id]-d[a.id])[0],d,pen})}else for(const f of fs)L.push({mv,tg:f,d:{[f.id]:expect(m,mv,f,false)},pen:0})}
   const L2=L.sort((a,c)=>Object.values(c.d).reduce((x,y)=>x+y,0)-Object.values(a.d).reduce((x,y)=>x+y,0)).slice(0,8);
   /* 11-14 기술 방어도 후보 — 연속이면 1/3 확률이라 지난 턴에 썼으면 뺀다 */
   if(!process.env.NOPROT&&!(m.states||{}).Taunt&&m.protectLast!==(+C().turn||0)-1){const pm=FN.MVS(m).map((mv,i)=>Object.assign({},mv,{_i:i})).find(mv=>mv&&FN.protMove(mv)&&!mv.virt);if(pm)L2.push({mv:pm,tg:m,d:{},pen:0,prot:1})}
   /* 11-15 망령 「타입 상성으로 교대해서 받거나 · 방어로 막거나 · 4식 6령으로 흘리고 거기서 수읽기」: 교대도 같은 저울에 — 들어오는 아이가 그 자리로 오는 공격을 대신 받고, 앞으로의 맞대결 차이를 덤으로 (막 나온 아이는 빼고) */
   {const T0=+C().turn||0;const st=m.states||{};if(AI(sd)&&!ENVS('NOJSW',sd)&&!(st.Bind||st.MeanLook||st.Block||m.charge)&&!(T0>1&&+m.inT>=T0-1)){const P9=polOf(m)==='D'?'C':polOf(m);const inc=fs.reduce((acc,f)=>{let bt=null,br=-1;for(const x of me){const t=threatVs(P9,f,x);const r=t.v/Math.max(1,x.hp.cur);if(r>br){br=r;bt=x}}return bt===m?acc+threatVs(P9,f,m).v:acc},0);const need=inc>=m.hp.cur*(+process.env.SWNEED||0);const ms=msum(m);if(need)bench(sd).filter(x=>x.tid===m.tid).map(x=>({x,s:msum(x)})).sort((a,c)=>c.s-a.s).slice(0,3).forEach(o=>{/* 안전한 교대만: 두 상대가 다 그 자리(이 아이를 노린 기술)로 쳐도 70% 넘게 남는 아이 */const worst=fs.reduce((acc,f)=>{const t=threatVs(P9,f,m);return acc+(t.mv?expect(f,t.mv,o.x):0)},0);if(o.s>ms&&worst<o.x.hp.cur*(+process.env.SWSAFE||0.7))L2.push({sw:o.x,tg:m,d:{},pen:0,lt:(+process.env.SWLT||0.4)*(o.s-ms)+0.15*a1Score(o.x,me.filter(y=>y!==m),null)})})}}
   return L2};
  const msum=x=>fs.reduce((a,f)=>a+matchup(x,f),0);
  const C1=cands(me[0]),C2=cands(me[1]);if(!C1.length||!C2.length)return null;let best=null,bv=-1e9;
  /* 행동 순서까지: 스피드 순으로 한 턴을 짧게 돌려 본다 — 빠른 상대가 먼저 우리 한 마리를 쓰러뜨리면 그 아이의 공격은 없다 · 우리가 먼저 쓰러뜨린 상대는 못 때린다 */
  const P0=pol0==='D'?'C':pol0;const FA={};for(const f of fs){let bt=null,br=-1;for(const m of active(sd)){const th=threatVs(P0,f,m);const r=th.v/Math.max(1,m.hp.cur);if(r>br){br=r;bt={m,v:th.v}}}FA[f.id]=bt&&Object.assign(bt,{mv:(threatVs(P0,f,bt.m)||{}).mv})}
  /* 11-15 망령 「방어나 4식으로 턴을 흘린다」: 상대 순풍 · 상대에게 유리한 트릭룸이 남아 있으면 막는 값이 커진다 (그 턴을 흘려 보냄) */const F0=FN.fieldOf(C());const fsd=fs[0].side;const twF=+(((F0.objects||{})[fsd]||{})['순풍']||0);const trR=+((F0.rooms||{})['트릭룸']||0);const avg=L=>L.reduce((a,x)=>a+(+x.stats[5]||0),0)/Math.max(1,L.length);const trF=trR>0&&avg(fs)<avg(me);const PB=+(process.env.PROTB||0.25)+(twF>0||trF?0.3:0);
  /* 수읽기(B 이상): 우리가 쓰러뜨릴 수 있는 상대는 방어로 막을 수 있다 — 그 확률만큼 우리 공격 · 그 상대의 공격을 깎아 본다 */const pP={};if(['B','A','AA'].includes(P0)&&!ENVS('NOREAD',sd)){const T1=+C().turn||0;for(const f of fs){const can=me.reduce((a,m)=>a+bestVs(m,f).v,0)>=f.hp.cur;const hasP=f.protectLast!==T1-1&&FN.MVS(f).some(q=>q&&FN.protMove(q)&&!q.virt)&&!(f.states||{}).Taunt;pP[f.id]=can&&hasP?(P0==='B'?0.35:0.45):0}}
  const SP={};for(const x of [...me,...fs])SP[x.id]=spd(x);const actors=[...me,...fs].sort((x,y)=>SP[y.id]-SP[x.id]);
  for(const a of C1)for(const c of C2){if(a.prot&&c.prot)continue;if(a.sw&&c.sw&&a.sw===c.sw)continue;const plan={[me[0].id]:a,[me[1].id]:c};const PROT={};if(a.prot)PROT[me[0].id]=1;if(c.prot)PROT[me[1].id]=1;const hp={};for(const x of [...active(sd),...fs])hp[x.id]=x.hp.cur;for(const q of [a,c])if(q.sw)hp[q.sw.id]=q.sw.hp.cur;let v=0;
   for(const x of actors){if(hp[x.id]<=0)continue;if(plan[x.id]){if(plan[x.id].sw)continue;for(const f of fs){const d=(plan[x.id].d[f.id]||0)*(1-(pP[f.id]||0));if(d<=0||hp[f.id]<=0)continue;const before=hp[f.id];hp[f.id]=Math.max(0,before-d);v+=tw[f.id]*((before-hp[f.id])/Math.max(1,f.hp.cur))}}
    else{const t=FA[x.id];if(t&&t.m&&hp[t.m.id]>0){if(PROT[t.m.id]){v+=PB;continue}const k=1-(pP[x.id]||0);const swp=plan[t.m.id]&&plan[t.m.id].sw;if(swp){/* 교대해 들어온 아이가 대신 맞는다 */const y=swp;const dv=t.mv?expect(x,t.mv,y)*k:0;const b0=hp[y.id];hp[y.id]=Math.max(0,b0-dv);v-=0.8*((b0-hp[y.id])/Math.max(1,y.hp.cur));if(hp[y.id]<=0)v-=0.5;continue}const before=hp[t.m.id];hp[t.m.id]=Math.max(0,before-t.v*k);v-=0.8*((before-hp[t.m.id])/Math.max(1,t.m.hp.cur))}}}
   for(const f of fs)if(hp[f.id]<=0)v+=0.6*tw[f.id];for(const m of me)if(hp[m.id]<=0&&!plan[m.id].sw)v-=0.5;v-=1.2*(a.pen+c.pen);v+=(a.lt||0)+(c.lt||0);if(v>bv){bv=v;best=[a,c]}}
  if(!best)return null;const out=new Map();me.forEach((m,i)=>{const x=best[i];out.set(m.id,x.sw?{sw:x.sw}:{mv:x.mv,tg:x.tg,v:x.d[x.tg.id]||0,prot:x.prot})});return out}
 /* 교대 (2-10 · 2-11) */
 /* 11-14 새 로직 교대: 지시 랭크와 상관없이 — 지금 상대들에게 크게 밀리고(받을 위협 ≥ 남은 HP 의 70%) 벤치에 확실히 나은 아이(맞대결 점수 +0.6)가 있을 때. 교대해 들어오는 아이가 이번 턴 받을 피해도 셈 */
 const wantSwitchNew=(sd,m)=>{if(m.charge)return null;const st=m.states||{};if(st.Bind||st.MeanLook||st.Block)return null;const fs=foes(sd);if(!fs.length)return null;const pol=polOf(m);const P2=pol==='D'?'C':pol;
  const thr=fs.reduce((a,f)=>Math.max(a,threatVs(P2,f,m).v),0);if(thr<m.hp.cur*(+process.env.SWT||0.7))return null;
  const cur=fs.reduce((a,f)=>a+matchup(m,f),0);const L=bench(sd).filter(x=>x.tid===m.tid).map(x=>{const inThr=fs.reduce((a,f)=>Math.max(a,threatVs(P2,f,x).v),0);return {x,s:fs.reduce((a,f)=>a+matchup(x,f),0)-inThr/Math.max(1,x.hp.cur)*0.5}}).sort((a,c)=>c.s-a.s);
  return L.length&&L[0].s>cur+(+process.env.SWM||0.6)?L[0].x:null};
 /* 11-15 망령 「느려서 공격 받고 당할 것 같으면 교대로 받거나 해야지」: 나보다 먼저 움직이는 상대들의 공격으로 행동 전에 쓰러질 판이면, 그 공격을 반 넘게 남기고 받아낼 벤치로 바꾼다.
    방어를 쓸 수 있으면(지난 턴에 안 썼으면) 그쪽은 두 마리 함께 고르기에 맡긴다 (SWP=1 이면 방어가 있어도 바꿈). 막 나온 아이(지난 턴 · 이번 턴)는 안 바꾼다 — 핑퐁 방지. SWKO=left|right|both|off 로 견주기 */
 const swTaken=new Set();const SWKO=sd=>{const v=process.env.SWKO;if(v==='left'||v==='right')return v===sd;return v==='both'};/* 기본 끔 — 교대는 두 마리 함께 고르기의 저울로 (11-15 시험: 따로 교대 47.8%) */const ENVS=(k,sd)=>{const v=process.env[k];return v==='1'||v==='both'||v===sd};
 const wantSwitchKO=(sd,m)=>{const st=m.states||{};if(m.charge||st.Bind||st.MeanLook||st.Block||st.Substitute)return null;const fs=foes(sd);if(!fs.length)return null;const pol=polOf(m);const P2=pol==='D'?'C':pol;const T0=+C().turn||0;if(T0>1&&+m.inT>=T0-1)return null;
  const my=active(sd);const atks=fs.map(f=>{let bt=null,br=-1;for(const x of my){const t=threatVs(P2,f,x);const r=t.v/Math.max(1,x.hp.cur);if(r>br){br=r;bt={x,t}}}return {f,bt}}).filter(o=>o.bt&&o.bt.x===m&&o.bt.t.mv);if(!atks.length)return null;
  const sm=spd(m);const first=atks.filter(o=>spd(o.f)>sm||(+o.bt.t.mv.prio||0)>0);if(first.reduce((a,o)=>a+o.bt.t.v,0)<m.hp.cur)return null;
  const prot=!st.Taunt&&m.protectLast!==T0-1&&FN.MVS(m).some(mv=>mv&&FN.protMove(mv)&&!mv.virt);if(prot&&!process.env.SWP)return null;
  const mates=my.filter(x=>x!==m);const inc=x=>atks.reduce((a,o)=>a+expect(o.f,o.bt.t.mv,x),0);
  const L=bench(sd).filter(x=>x.tid===m.tid&&!swTaken.has(x.id)).map(x=>{const fr=inc(x)/Math.max(1,x.hp.cur);return {x,fr,s:fs.reduce((a,f)=>a+matchup(x,f),0)-fr+a1Score(x,mates,null)}}).filter(o=>o.fr<(+process.env.SWF||0.55)).sort((a,c)=>c.s-a.s);
  if(L.length)swTaken.add(L[0].x.id);return L.length?L[0].x:null};
 const wantSwitch=(sd,m)=>{if(m.charge)return null;if(AI(sd)&&process.env.NEWSW)return wantSwitchNew(sd,m);if(AI(sd)&&SWKO(sd)&&polOf(m)!=='wild'&&!isWildT(m.tid)){const k=wantSwitchKO(sd,m);if(k)return k}const pol=polOf(m);if(pol==='D'||pol==='wild'||isWildT(m.tid))return null;if((m.states||{}).Bind||(m.states||{}).MeanLook||(m.states||{}).Block)return null;const fs=foes(sd);if(!fs.length)return null;
  const L=bench(sd).filter(x=>x.tid===m.tid).map(x=>({x,s:fs.reduce((a,f)=>a+matchup(x,f),0)})).sort((a,c)=>c.s-a.s);if(!L.length)return null;const cur=fs.reduce((a,f)=>a+matchup(m,f),0);
  if(pol==='C'){const crit=fs.some(f=>{const t=threatVs('C',f,m);return t.mv&&B.effectiveness([t.mv.typeEn],m,{atkTypes:f.types}).value>=4&&t.v>=m.hp.cur});return crit&&L[0].s>cur?L[0].x:null}
  const bad=fs.every(f=>threatVs(pol,f,m).v>=m.hp.cur*0.6);if(!bad)return null;return L[0].s>cur+0.5?L[0].x:null};
 /* 4식 · 6령 (지시 단계 선행): 웹툴 fireOrder — 받을 수 없는 포켓몬 · 한 턴 하나는 웹툴이 막는다 */
 const ordKeys=t=>Object.keys(t.orderCount||{}).filter(k=>/^order_/.test(k)&&+t.orderCount[k]>0).map(k=>k.slice(6));
 const cmdLeft=(t,k)=>+((t.orderCount||{})['command_'+k]||0)>0&&(!opt.pool||opt.pool.command>0);
 const fired=tid=>(((C().cmds||{})[tid]||{}).fired)||{};
 const cmdUsed=tid=>Object.values(fired(tid)).some(x=>x&&x.command);
 /* 10-28 망령: 4식 · 6령은 던전 단위 공용 풀(opt.pool = {order, command}, 던전이 넘긴다). 보스방 아닌 배틀에서는 풀의 절반(올림)을 보스방 몫으로 남긴다 — 시뮬 판단(지침에 없음) */
 const POOL=opt.pool||null,P0=opt.poolInit||null;const keep=kind=>POOL&&!opt.poolBoss&&P0?Math.ceil(P0[kind]/2):0;
 /* 10-28 망령: 「대체로 절반을 남기려 하되 위험해질 것 같으면 써」 — 위험하면 보스방 몫도 꺼낸다.
    위험 = 우리 편 살아 있는 수가 처음의 절반 이하 · 남은 HP 합이 40% 이하 · 또는 지키는 지시(방어 · 회피 · 회복 · 4식)로 쓰러질 아이를 살리는데 우리 편 수가 상대보다 많지 않을 때 */
 const N0={};const SAVE=new Set(['defense','specialdefense','evasion','heal','retreat','dodge','endure']);
 const danger=(tid,mid,key)=>{const sd=(T(tid)||{}).side||'left';const all=Object.values(C().mons).filter(m=>m.side===sd);if(N0[sd]==null)N0[sd]=all.length;const al=all.filter(alive);
  if(al.length*2<=N0[sd])return true;const mx=all.reduce((a,m)=>a+m.hp.max,0);if(mx&&al.reduce((a,m)=>a+m.hp.cur,0)<=mx*0.4)return true;
  const m=C().mons[mid];if(m&&SAVE.has(key)&&alive(m)&&dangerOf(m)>=m.hp.cur){const fo=Object.values(C().mons).filter(x=>x.side!==sd&&alive(x)).length;if(al.length<=fo)return true}return false};
 const fire=async(tid,mid,kind,key)=>{const t=T(tid);const ck=(kind==='order'?'order_':'command_')+key;const before=+((t.orderCount||{})[ck]||0);if(before<=0)return false;if(POOL&&POOL[kind]<=0)return false;if(POOL&&POOL[kind]<=keep(kind)&&!danger(tid,mid,key))return false;await FN.fireOrder(tid,mid,kind,key,'free');await flush(1);const after=+((T(tid).orderCount||{})[ck]||0);if(after<before&&POOL)POOL[kind]--;return after<before};
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
 /* 새 로직 ②: 4식을 이름으로 (지시 체계마다 같은 칸에 다른 4식이 들어간다 — 십계면 「버텨라」 칸이 『정화의 법계』). 11-14 */
 const NEG=['Burn','Poison','Toxic','Paralysis','Sleep','Freeze','Confusion'];
 const ordNames=tid=>{const t=T(tid);return ordKeys(t).map(k=>({k,n:String(FN.pName(C(),tid,'order',k)||'').trim()}))};
 const foeCat=(sd,tid)=>{let ph=0,sp=0;for(const f of foes(sd))for(const m of active(sd).filter(x=>x.tid===tid)){const th=threatVs(POLS[tid]==='D'?'C':POLS[tid],f,m);if(th.mv){if(th.mv.cat==='물리')ph+=th.v;else if(th.mv.cat==='특수')sp+=th.v}}return {ph,sp}};
 const wallOn=(sd,nm)=>{const o=((FN.fieldOf(C()).objects||{})[sd])||{};return +o[nm]>0};
 async function ordersNew(tid,pol,mine,acts){const t=T(tid);const sd=t.side;const L=ordNames(tid);if(!L.length)return;const has=re=>L.find(x=>re.test(x.n));const P2=pol==='D'?'C':pol;
  /* 결계: 상대 위협이 물리 · 특수 한쪽으로 기울면 첫 기회에 (이미 깔렸으면 안 함) */
  {const fc=foeCat(sd,tid);const tot=fc.ph+fc.sp;const ph=has(/^물리결계/),sp=has(/^특수결계/);
   if(tot>0){if(ph&&fc.ph>=tot*0.55&&!wallOn(sd,'리플렉터')&&await fire(tid,mine[0].id,'order',ph.k))return;if(sp&&fc.sp>=tot*0.55&&!wallOn(sd,'빛의장막')&&await fire(tid,mine[0].id,'order',sp.k))return}}
  /* 법계: 정화 = 아군 상태 이상 · 치유 = 아군이 많이 다쳤을 때 */
  {const pu=has(/정화의 법계/);if(pu){const bad=active(sd).filter(m=>NEG.some(k=>(m.states||{})[k]));if(bad.length&&await fire(tid,bad[0].id,'order',pu.k))return}
   const he=has(/치유의 법계/);if(he){const al=active(sd);const miss=al.reduce((a,m)=>a+(m.hp.max-m.hp.cur)/m.hp.max,0);if((miss>=0.7||al.some(m=>m.hp.cur<m.hp.max*0.35))&&await fire(tid,al[0].id,'order',he.k))return}}
  /* 지키는 4식: 이번 턴 쓰러질 아이 (위협 ≥ 남은 HP) — 필중이면 버텨라 · 물리면 물러나 · 특수면 피해라 */
  for(const m of mine.slice().sort((a,c)=>a.hp.cur/a.hp.max-c.hp.cur/c.hp.max)){if(acts.some(a=>a.m===m&&a.sw))continue;const th=topThreat(P2,m);const stall=(()=>{const F0=FN.fieldOf(C());const fs0=foes(sd);if(!fs0.length)return 0;const tw=+(((F0.objects||{})[fs0[0].side]||{})['순풍']||0);const tr=+((F0.rooms||{})['트릭룸']||0);const av=L=>L.reduce((a,x)=>a+(+x.stats[5]||0),0)/Math.max(1,L.length);return tw>0||(tr>0&&av(fs0)<av(mine))?1:0})();/* 11-15 상대 순풍 · 유리한 트릭룸 중이면 4식으로 턴을 흘린다 */const need=pol==='D'?m.hp.cur<m.hp.max*0.35:(th.mv&&th.v>=m.hp.cur*((pol==='C'?0.85:1)*(stall?0.65:1)));if(!need)continue;
   const sure=isSure(th.mv);const cat=th.mv?th.mv.cat:'';const pick=(!sure&&cat==='물리'&&has(/^물러나/))||(!sure&&cat==='특수'&&has(/^피해라/))||has(/^버텨라/)||has(/주인의 칙령/);if(pick&&await fire(tid,m.id,'order',pick.k))return}
  /* 맞춰라: 결정타가 빗나갈 수 있을 때 */
  {const mt=has(/^맞춰라/);if(mt)for(const a of acts.filter(x=>x.m.tid===tid&&x.mv&&x.mv.cat!=='변화'&&x.tg)){const acc=+a.mv.acc||0;if(acc&&acc<100&&a.v>=a.tg.hp.cur&&await fire(tid,a.m.id,'order',mt.k))return}}}
 /* 새 로직 ③: 손으로 쓰는 포텐셜(고유 · 전용 · 포켓몬 포텐셜의 【사전】 · 【선행】 · 【N/시】) — 자동 구문이 있는 것만, 구문 종류로 때를 고른다. 11-14
    판 깔기(이계 · 필드 · 날씨 · 설치) · 상대에게 상태 → 첫 기회 / 자기 · 아군 강화 → 이번 턴 공격하는 아이가 있을 때 / 완화 · 회피 · 방어 → 위협이 셀 때 / 회복 → HP 반 아래 */
 const TRIG=/했을\s*때|받았을\s*때|받을\s*때|【\s*(자동|등장|퇴장|준비|함성|지원|동조|방호|공세|수세|보급)|턴\s*종료|가장\s*마지막|쓰러/;
 const splitTag=e=>{const t=String(e||'');const m=t.match(/^\s*[①-⑳]?\s*((?:【[^】]*】\s*)*)\/?/);const head=m?m[1]:'';return {head,body:t.slice(m?m[0].length:0)}};
 const manualTag=e=>{const {head,body}=splitTag(e);if(!/【\s*(사전|선행)\s*】|【\s*\d+\s*\/\s*시\s*】|【\s*(탈진|소진)\s*】/.test(head))return false;   /* 11-15: 【탈진】 · 【소진】만 붙은 손 발동(그 턴만 — 망령)도 */if(/【\s*(자동|등장|퇴장|준비|함성|지원|동조|보급|방호|공세|수세)/.test(head))return false;return !/했을\s*때|받았을\s*때|받을\s*때|턴\s*종료|가장\s*마지막/.test(body.slice(0,60))};
 /* 손해가 섞인 구문(우선도를 내리거나 · 급소를 맞기 쉽게 · 대상 · 기술을 고르는 두 단계)은 시뮬이 판단하지 못해 쓰지 않는다 — 카렌 『죽음을 각오한 저항』 ① 처럼 ② 와 짝인 것 */
 const opsRisky=ops=>(ops||[]).some(o=>o&&((o.k==='prio'&&+o.v<0)||o.k==='tsel'||o.k==='msel'||o.k==='cond'||/급소방호\s*-|급소방호-/.test(JSON.stringify(o))||(o.k==='guard'&&+o.cr<0)));
 const opsClass=ops=>{if(opsRisky(ops))return '';const K=new Set((ops||[]).map(o=>o&&o.k));const tg=(ops||[]).map(o=>String((o&&o.tgt)||''));if(K.has('dex'))return 'dex';if(['stage','terrain','weather','object'].some(k=>K.has(k)))return 'open';if(K.has('state')&&tg.some(x=>/enemy|상대|front|정면|all/.test(x)))return 'foe';if(K.has('heal'))return 'heal';if(['guard','eva','protect','nodrop'].some(k=>K.has(k)))return 'def';if(['rank','mult','boost','prio','sp','state'].some(k=>K.has(k)))return 'buff';if(K.has('dmg'))return 'foe';return ''};
 const PU={};
 async function potsNew(tid,acts){const t=T(tid);if(!t||isWildT(tid))return;const sd=t.side;const P2=POLS[tid]==='D'?'C':POLS[tid];const mine=active(sd).filter(m=>m.tid===tid);if(!mine.length)return;const T0=+C().turn||0;
  const attacking=m=>acts.some(a=>a.m.id===m.id&&a.mv&&a.mv.cat!=='변화');const danger=m=>{const th=topThreat(P2,m);return th.mv&&th.v>=m.hp.cur*0.6};
  /* 11-15: 기술 · 태그 · 비자속 한정 강화는 이번 턴 그 기술을 낼 때만 (불굴귀의 투창 = 타입 비일치 「가시창」) */
  const mvOk=(ops,m)=>{const a=acts.find(x=>x.m.id===m.id&&x.mv&&x.mv.cat!=='변화');if(!a)return false;for(const o of ops||[]){if(!o||!['boost','mult'].includes(o.k))continue;if(Array.isArray(o.mv)&&o.mv.length&&!o.mv.includes(a.mv.name))return false;if(Array.isArray(o.tg)&&o.tg.length&&!o.tg.some(t=>String(a.mv.name).includes(t)||[].concat(a.mv.tags||[]).some(x=>String(x).includes(t))))return false;if(o.sb==='nonstab'&&(m.types||[]).some(t=>t===a.mv.typeEn||t===a.mv.type))return false;if(o.sb==='stab'&&!(m.types||[]).some(t=>t===a.mv.typeEn||t===a.mv.type))return false}return true};
  const dexLeft=()=>{const L=((W.OM_APP.ST.state.dex||{})[tid]||{}).list||[];return foes(sd).some(f=>!L.includes(f.id))};
  const want=(cls,m,ops)=>cls==='dex'?dexLeft():cls==='open'||cls==='foe'?true:cls==='buff'?attacking(m)&&(!ops||mvOk(ops,m)):cls==='def'?danger(m):cls==='heal'?m.hp.cur<m.hp.max*0.5:false;
  /* 11-15 「데이터 해석」: 우리 편 포텐셜 · 고유가 해석을 조건으로 쓰면(「해석된 상대」 · 「해석했을 때」) 『포켓몬 도감』(지시 랭크 횟수 · 【사전】)으로 필드의 아직 안 본 상대 중 가장 위협적인 아이를 본다 · 해석하는 포텐셜(구문 「해석」)도 그때 */
  {const DX=W.OM_DEX_UI;const st=W.OM_APP.ST.state;const D=(st.dex||{})[tid]||{used:0,list:[]};const teamTxt=[...Object.values(C().mons).filter(x=>x.tid===tid).flatMap(x=>FN.potSrc(x).map(q=>String((q&&q.eff)||''))),...((t.unique||[]).map(u=>String(u.eff||'')))].join('\n');
   const needDex=/해석된\s*상대|데이터\s*해석했을\s*때|해석했을\s*때에만/.test(teamTxt);const L0=((W.OM_DB.const||{}).lists||{}).list_pokedex_count||{E:0,D:0,C:0,B:1,A:2,AA:2,AAA:2,S:2};const dmax=+(L0[String((t.ranks||{})['지시']||'').replace(/[+\-]/g,'').trim()]||0);
   if(DX&&needDex&&(+D.used||0)<dmax){const fo=foes(sd).filter(f=>!(D.list||[]).includes(f.id)).sort((a,c)=>Math.max(c.stats[1],c.stats[3])-Math.max(a.stats[1],a.stats[3]))[0];if(fo)try{await DX.analyze(tid,fo.id,{});await flush(1)}catch(err){}}}
  /* 11-15: 그때그때 타입 — 고유 「턴 종료 시까지 아군을 대상의 「타입 1」로」(찰나의 모작): 크게 위협받는 아이가 그 상대의 타입1 이 되면 그 공격이 덜 들어갈 때 */
  const effV=(mt,tys)=>{try{return +W.OM_BATTLE.effectiveness([mt],{types:tys}).value}catch(e){return 1}};
  for(const q of (H.fn.uniqList||H.get('uniqList'))(t)){const e=String(q.p.eff||'');if(!/아군을\s*대상의\s*「\s*타입\s*1\s*」\s*로\s*만든다/.test(e)||(q.left!==null&&q.left<=0))continue;const k='u|'+tid+'|'+q.p.name;if(PU[k]===T0||PU[k]===T0-1&&/【\s*탈진\s*】/.test(e))continue;
   let bt=null;for(const x of mine){const th=topThreat(P2,x);if(!th.mv||!th.f||th.v<x.hp.cur*0.5)continue;const mt=th.mv.typeEn||th.mv.type;const t1=(th.f.types||[])[0];if(!t1||t1==='-')continue;const now=effV(mt,(x.types||[]).filter(z=>z&&z!=='-')),nw=effV(mt,[t1]);if(nw<now){const g=(now-nw)*th.v/Math.max(1,x.hp.cur);if(!bt||g>bt.g)bt={x,f:th.f,g}}}
   if(!bt)continue;PU[k]=T0;H.pickHint=bt.f.id;try{await (H.fn.fireSpecial||H.get('fireSpecial'))(tid,bt.x.id,'uq',q.p.name,'free');await flush(1)}catch(err){}H.pickHint=null}
  /* 고유 */
  /* 11-15 10:50 로르 『무시할 수 없는 독창성』 「【자동】【탈진】/아군이 내보내는 타입 비일치 「혼돈의물감」의 대미지가 2배」: 계기 말 없이 기술 · 비자속으로만 묶인 강화는 웹툴에 「낼 때」 걸이가 없다 — 이번 턴 그 기술을 내는 아군이 있을 때 고른다 (탈진은 연달아 안 씀) */
  const atkTied=(e,a)=>/【\s*자동\s*】/.test(splitTag(e).head)&&/【\s*(탈진|소진)\s*】/.test(splitTag(e).head)&&!TRIG.test(splitTag(e).body.slice(0,60).replace(/【[^】]*】/g,''))&&a&&(a.ops||[]).length&&(a.ops||[]).every(o=>o&&['boost','mult'].includes(o.k)&&((Array.isArray(o.mv)&&o.mv.length)||o.sb||(Array.isArray(o.tg)&&o.tg.length)));
  for(const q of (H.fn.uniqList||H.get('uniqList'))(t)){const e=String(q.p.eff||'');const a0=FX.autoOf({tid},'pot',q.p.name);const AT=atkTied(e,a0);if(!(manualTag(e)||AT)||(q.left!==null&&q.left<=0))continue;const k='u|'+tid+'|'+q.p.name;if(PU[k]===T0||(PU[k]===T0-1&&/【\s*탈진\s*】/.test(e)))continue;const a=a0;if(!a||!a.ops||!a.ops.length||a.manual)continue;const cls=opsClass(a.ops);if(!cls)continue;
   if(AT){const ms=mine.filter(x=>attacking(x)&&mvOk(a.ops,x));if(!ms.length)continue;PU[k]=T0;try{await (H.fn.fireSpecial||H.get('fireSpecial'))(tid,ms[0].id,'uq',q.p.name,'free');await flush(1)}catch(err){}continue}
   const m=cls==='heal'?mine.slice().sort((x,y)=>x.hp.cur/x.hp.max-y.hp.cur/y.hp.max)[0]:mine.find(x=>attacking(x))||mine[0];if(!want(cls,m))continue;PU[k]=T0;try{await (H.fn.fireSpecial||H.get('fireSpecial'))(tid,m.id,'uq',q.p.name,'free');await flush(1)}catch(err){}}
  /* 전용 · 포켓몬 포텐셜 */
  for(const m0 of mine){const m=C().mons[m0.id];if(!m||!m.entry||!alive(m))continue;
   for(const p of FN.potSrc(m)){const e=String(p.eff||'');if(!manualTag(e)&&!/아군의\s*「\s*타입\s*2\s*」\s*와\s*같은/.test(e))continue;const k='p|'+m.id+'|'+p.name;if(PU[k]===T0)continue;const L=FN.limOf(p,m.potUses||{},m.potTurn||{});if(L.left!==null&&L.left<=0)continue;if((H.fn.potOffWhy||H.get('potOffWhy'))(m,p.name))continue;
    /* 11-15: 「이번 턴 「X」가 아군의 「타입2」와 같은 타입이 된다」(당신도 모르는 당신) — 이번 턴 X 를 내고, 그 타입이 대상에게 잘 들 때 */
    const mA=e.match(/이번\s*턴\s*「([^」]+)」\s*(?:이|가)\s*아군의\s*「\s*타입\s*2\s*」/);
    if(mA){const act=acts.find(z=>z.m.id===m.id&&z.mv&&z.mv.name===mA[1].trim());const al=active(sd).find(z=>z.id!==m.id&&((z.types||[])[1]||'-')!=='-');if(!act||!al||!act.tg)continue;let ev=1;try{ev=+W.OM_BATTLE.effectiveness([al.types[1]],act.tg).value}catch(err){}if(ev<=1)continue;PU[k]=T0;try{await (H.fn.potMark||H.get('potMark'))(m.id,p.name);await FN.fireAuto(m.id,'pot',p.name,{manual:1,quiet:true})}catch(err){}await flush(1);continue}
    const a=FX.autoOf(m,'pot',p.name);if(!a||!a.ops||!a.ops.length||a.manual)continue;const cls=opsClass(a.ops);if(!cls||!want(cls,m,a.ops))continue;PU[k]=T0;
    try{if(FN.isExcl(m,p))await (H.fn.fireSpecial||H.get('fireSpecial'))(tid,m.id,'ex',p.name,'free');else{await (H.fn.potMark||H.get('potMark'))(m.id,p.name);if(L.mmax!=null){const u=Object.assign({},(C().mons[m.id]||{}).potUses||{});u[p.name]=Math.max(0,(u[p.name]==null?L.mmax:+u[p.name])-1);await W.OM_APP.set(['battle','mons',m.id,'potUses'],u)}await FN.fireAuto(m.id,'pot',p.name,{manual:1,quiet:true})}await flush(1)}catch(err){}}}}
 /* 11-14: 턴 종료 · 이후 포텐셜 — 【N/시】 · 【탈진】 · 【소진】 횟수를 지킨다 (예전엔 『탈착술』 【1/시】이 매 턴 돌았다). 랭크 초기화(reset)는 내 랭크 합이 마이너스일 때만 */
 async function endPot(x){const m=C().mons[x.m.id];if(!m||!m.entry||!alive(m))return;const au=FX.autoOf(m,'pot',x.name);if(!au||!au.ops||!au.ops.length||au.manual)return;const p=FN.potSrc(m).find(q=>q&&q.name===x.name);
  if(p){const L=FN.limOf(p,m.potUses||{},m.potTurn||{});if(L.left!==null&&L.left<=0)return;
   if(au.ops.some(o=>o&&o.k==='reset')){const rs=Object.values(m.rank||{}).reduce((a,v)=>a+(+v||0),0);if(rs>=0)return}
   if(L.max!=null){await (H.fn.potMark||H.get('potMark'))(m.id,p.name);if(L.mmax!=null){const u=Object.assign({},(C().mons[m.id]||{}).potUses||{});u[p.name]=Math.max(0,(u[p.name]==null?L.mmax:+u[p.name])-1);await W.OM_APP.set(['battle','mons',m.id,'potUses'],u)}}}
  await FN.fireAuto(m.id,'pot',x.name,{quiet:true})}
 /* 새 로직 ⑤: 단순 6령(C) — 이번 턴 효과가 확실한 쪽부터: 공격 +1 로 쓰러뜨림이 되는 아이 > 방어 +1 로 버티게 되는 아이 > HP 40% 아래 회복 > 가장 센 공격수 (11-14) */
 async function cmdNewC(tid,mine,myActs){const t=T(tid);const ck=k=>cmdLeft(t,k);
  for(const a of myActs.slice().sort((x,y)=>y.v-x.v)){if(!a.tg||!alive(a.tg))continue;const k=a.mv.cat==='특수'?'specialattack':'attack';if(ck(k)&&a.v<a.tg.hp.cur&&a.v*1.5>=a.tg.hp.cur&&await fire(tid,a.m.id,'command',k))return}
  for(const m of mine){const th=topThreat('C',m);if(!th.mv)continue;const k=th.mv.cat==='특수'?'specialdefense':'defense';if(ck(k)&&th.v>=m.hp.cur&&th.v/1.5<m.hp.cur&&await fire(tid,m.id,'command',k))return}
  {const w=mine.filter(m=>m.hp.cur<m.hp.max*0.4).sort((a,c)=>a.hp.cur/a.hp.max-c.hp.cur/c.hp.max)[0];if(w&&ck('heal')&&await fire(tid,w.id,'command','heal'))return}
  if(process.env.HOLDCMD)return;
  {const a=myActs.slice().sort((x,y)=>y.v-x.v)[0];if(a){const k=a.mv.cat==='특수'?'specialattack':'attack';if(ck(k))await fire(tid,a.m.id,'command',k)}}}
 /* ---- 결과 기록 ---- */
 const kos=[];const turnsLog=[];const used={};const markKo=(before)=>{for(const m of Object.values(C().mons)){const was=before[m.id];if(was>0&&!alive(m))kos.push({name:m.name,side:m.side,turn:C().turn,by:m._by||''})}};
 const hpMap=()=>{const o={};for(const m of Object.values(C().mons))o[m.id]=m.hp.cur;return o};
 /* ---- 선발 → 시합 개시 ---- */
 /* 11-15 05시: 선발은 양쪽이 동시에 · 서로 모르고 고른다 — 예전엔 오른쪽이 왼쪽 선발을 보고 맞춤 선발을 골라 같은 팀끼리도 오른쪽이 65% 이겼다 */
 const LS={left:pickIn('left',fmt),right:pickIn('right',fmt)};
 for(const sd of ['left','right']){const L=LS[sd];
  /* 11-15 05시: 「【준비】/「에리어 : A」에 등장 예약 한다」(흐림게르드 『선봉 거인』) — 그 에리어에 선발로 */
  for(const m of bench(sd).concat(L)){const p=FN.potSrc(m).find(q=>q&&/【\s*준비\s*】[^「]*「에리어\s*:\s*([AB])」에\s*등장\s*예약/.test(String(q.eff||'')));if(!p)continue;const ix=String(p.eff).match(/「에리어\s*:\s*([AB])」에\s*등장\s*예약/)[1]==='A'?0:1;if(ix>=L.length)continue;const j=L.indexOf(m);if(j===ix)continue;if(j>=0){L[j]=L[ix];L[ix]=m}else{/* 11-15: 그 자리에 있던 아이는 밀어내지 않고 다른 자리로 — 가장 덜 원하던(뒤) 아이가 빠진다 (흐림게르드가 A 로 오면서 나인테일이 빠지던 것) */L.splice(ix,0,m);L.length=Math.min(L.length,fmt)}}
  for(let i=0;i<L.length;i++)await FN.enterMon(L[i].id,AREAS[i],{sys:true,noAuto:true})}
 await FN.startBattle();await flush();if(!process.env.NOPVP&&!Object.keys(C().trainers||{}).some(isWildT))await W.OM_APP.set(['battle','pvp'],true);   /* 11-15 05시: 학생끼리 = PVP (유대 버티기 시합 중 한 번 — 웹툴 bondBand) */if(FN.faintWatch)await FN.faintWatch();
 let turn=0;
 while(turn<maxT){
  if(!active('left').length||!active('right').length)break;
  await FN.setPhase(1);await flush();turn=+C().turn||turn+1;
  const hp0=hpMap();
  /* 11-02 「상비약」: 턴 개시 때 아군 1체의 상태 이상 하나를 치유 (주된 상태 이상이 있는 가장 앞 포켓몬) */
  if(H.cards){const MJ=['Sleep','Paralysis','Freeze','Burn','Toxic','Poison'];const m=active('left').find(x=>MJ.some(k=>(x.states||{})[k]));if(m&&FG.cardTake(H,'cure',turn,m.tid)){const nb0=FN.snap(),nb=FN.snap(nb0);const x=nb.mons[m.id];if(x){x.states=Object.assign({},x.states);for(const k of MJ)delete x.states[k];await FN.saveBattle(nb0,nb)}}}
  /* 1. 지시 */
  const acts=[];const plans={left:new Map(),right:new Map()};const cmds={};swTaken.clear();
  /* 11-14 망령 「D 도 완전 저능아는 아니야 — C 랑 비슷한데 종종 실수」: 새 로직에서 D 는 C 처럼 두되, 트레이너마다 턴마다 DERR(기본 1/4) 확률로 「실수 턴」 — 그 턴은 필드의 한 마리가 옛 D 로직(눈앞 상대에게 세 보이는 공격)으로 고름. DSLIPALL=1 이면 트레이너 전체가 옛 D 로직(4식 포함) */
  const DERR=process.env.DERR!=null?+process.env.DERR:0.1;/* 11-15 03:37 망령 「D 실수는 매 턴 10% 정도로」 */const SLIP={};const SLIPM={};for(const tid of Object.keys(C().trainers))if(POLS[tid]==='D'&&rng()<DERR){SLIP[tid]=1;if(process.env.DSLIPALL)continue;const mm=Object.values(C().mons).filter(x=>x.tid===tid&&x.hp.cur>0&&x.entry!=null&&active(T(tid).side).includes(x));if(mm.length)SLIPM[mm[Math.floor(rng()*mm.length)].id]=1}
  for(const sd of ['left','right']){const p0=active(sd)[0]||{tid:''};const J=AI(sd)&&polOf(p0)!=='wild'&&!(polOf(p0)==='D'&&SLIP[p0.tid]&&process.env.DSLIPALL)?(ENVS('JOLD',sd)?chooseJoint(sd):chooseJoint2(sd)):null;
   for(const m of active(sd)){if(J&&J.has(m.id)&&J.get(m.id).sw){acts.push({sd,m,sw:J.get(m.id).sw});continue}const sw=J&&J.has(m.id)&&!process.env.NEWSW&&process.env.SWKO!=='both'?null:wantSwitch(sd,m);if(sw){acts.push({sd,m,sw});continue}let a=null;
    if(J&&J.has(m.id)&&!SLIPM[m.id]){const j=J.get(m.id);a=j;if(!j.prot&&!(m.states||{}).Taunt&&!process.env.NOSTAT){const sp=statusPlan(sd,m,polOf(m),foes(sd),j,J);if(process.env.SPDBG&&new RegExp(process.env.SPDBG).test(m.name))console.error('SP',C().turn,m.name,j.prot?'prot':j.sw?'sw':(j.mv&&j.mv.name),j.v|0,j.tg&&j.tg.hp.cur,sp&&sp.why,sp&&sp.score);if(sp&&sp.score>(j.v/Math.max(1,j.tg.hp.cur)))a={mv:sp.mv,tg:sp.tg,v:0,status:sp.why}}}else a=choose(sd,m,plans[sd]);
    if(a)acts.push(Object.assign({sd,m},a))}}
  for(const a of acts){const tid=a.m.tid;cmds[tid]=cmds[tid]||{mons:{}};if(a.sw)cmds[tid].mons[a.m.id]={move:'switch',switch:a.sw.id,targets:[]};else{const tg=a.tg?[a.tg.side+'_'+a.tg.entry]:[];const r=String(a.mv.range||'');const dt=FN.defaultTargets(C(),a.m.id,String(a.mv._i));
   const targets=r==='1체'||r===''?tg:dt.length?dt:tg;cmds[tid].mons[a.m.id]={move:a.mv._i,targets};a.targets=targets}}
  {const nb=C();nb.cmds=cmds}
  /* 새 로직: 손으로 쓰는 포텐셜 (【사전】 · 【선행】 — 지시 단계 · 턴 개시) */
  /* 11-15 05시: 지령 · 포텐셜 · 4식 6령을 늘 왼쪽 먼저 처리하면 오른쪽이 왼쪽 것을 보고 고르게 되어 거울전에서 오른쪽이 65% — 턴마다 순서를 굴린다 */
  const TORD=Object.keys(C().trainers);if(!process.env.NOFLIP&&rng()<0.5)TORD.reverse();
  for(const tid of TORD)if(AI(sideOfTid(tid)))await potsNew(tid,acts);
  /* 6령 · 4식 선행 (트레이너마다) */
  for(const tid of TORD){if(isWildT(tid))continue;const pol=POLS[tid];const t=T(tid);const mine=active(t.side).filter(m=>m.tid===tid&&!isOld(m));if(!mine.length)continue;
   const myActs=acts.filter(a=>a.m.tid===tid&&a.mv&&a.mv.cat!=='변화'&&!isOld(a.m));
   if(AI(t.side)&&(pol==='C'||!mastery(tid))&&!cmdUsed(tid)){await cmdNewC(tid,mine,myActs);}
   else if(pol==='C'){const th=mine.map(m=>Object.assign(topThreat('C',m),{m})).filter(x=>x.mv&&x.v>=x.m.hp.cur*0.6).sort((a,c)=>c.v/c.m.hp.cur-a.v/a.m.hp.cur)[0];const tired=mine.filter(m=>m.hp.cur<m.hp.max*0.4)[0];
    let done=false;if(th)done=await fire(tid,th.m.id,'command',th.mv.cat==='특수'?'specialdefense':'defense');if(!done&&tired)done=await fire(tid,tired.id,'command','heal');if(!done&&myActs.length){const a=myActs.sort((x,y)=>y.v-x.v)[0];await fire(tid,a.m.id,'command',a.mv.cat==='특수'?'specialattack':'attack')}}
   /* 4식: 위험한 아이 하나 (D 35% · C 45% · B 본 위협 ≥ HP · A 그리고 60%) — 위협이 필중기면 버텨라 */
   if(AI(t.side)){await ordersNew(tid,pol==='D'&&!(SLIP[tid]&&process.env.DSLIPALL)?'C':pol,mine,acts);continue}
   for(const m of mine){if(acts.some(a=>a.m===m&&a.sw))continue;const threat=topThreat(pol==='D'?'C':pol,m);const ratio=m.hp.cur/m.hp.max;
    const need=pol==='D'?ratio<0.35:pol==='C'?ratio<0.45:pol==='B'?(threat.mv&&threat.v>=m.hp.cur):(threat.mv&&threat.v>=m.hp.cur&&ratio<0.6);if(!need)continue;
    const ks=ordKeys(T(tid));const cat=threat.mv?threat.mv.cat:'';const sure=isSure(threat.mv);const k=!sure&&cat==='물리'&&ks.includes('retreat')?'retreat':!sure&&cat==='특수'&&ks.includes('dodge')?'dodge':ks.includes('endure')?'endure':null;if(!k)continue;
    if(await fire(tid,m.id,'order',k))break}}
  /* 2. 순서 (웹툴 computeOrder) + 숙달민첩 ② */
  await FN.computeOrder();await flush(1);
  {let flip=false;for(const tid of TORD){if(flip||isWildT(tid)||!mastery(tid)||cmdUsed(tid)||!cmdLeft(T(tid),'speed'))continue;const ord=C().order||[];
    for(const a of acts.filter(x=>x.m.tid===tid&&x.mv&&x.mv.cat!=='변화'&&x.tg&&!isOld(x.m))){const me=ord.findIndex(o=>o.mid===a.m.id),it=ord.findIndex(o=>o.mid===a.tg.id);if(it<0||me<0||it>me)continue;if(ord[it].prio!==ord[me].prio||ord[it].change||ord[me].change)continue;
     if(a.v>=a.tg.hp.cur&&ord[me].speed*1.5>ord[it].speed&&threatVs(POLS[tid],a.tg,a.m).v>=a.m.hp.cur*0.5){if(await fire(tid,a.m.id,'command','speed')){flip=true;break}}}}
   if(flip){await FN.computeOrder();await flush(1)}}
  /* 3. 행동 (순서대로) */
  for(const o of (C().order||[]).slice()){const m=C().mons[o.mid];if(!m||!m.entry||!alive(m))continue;
   /* 11-15 11시 「추가 행동」(행동 순서 xact — 『네 마리의 용』 4배수 턴 가장 마지막 「드래곤옐」 · 「가장 마지막에 「X」에 의한 추가 행동」): 지금까지 그 자리의 원래 지시(공격)를 한 번 더 했다 → 적힌 기술로 (웹툴 openAttack xact 와 같다) */
   if(o.xact){const L=FN.MVS(m);let i=L.findIndex(x=>x&&FN.mvNameEq?FN.mvNameEq(x.name,o.move):x&&x.name===o.move);const mvO=i<0&&W.OM_IMPORT?W.OM_IMPORT.move(o.move,false):null;if(i<0&&!(mvO&&mvO.cat))continue;const mv=i>=0?L[i]:mvO;
    let tg=(o.targets||[]).filter(s=>{const [sd,ar]=s.split('_');return !!FN.entered(C(),sd)[ar]});if(!tg.length){const r=String(mv.range||'');const dt=i>=0?FN.defaultTargets(C(),m.id,String(i)):[];if(dt.length&&!(r==='1체'||r===''))tg=dt;else if(mv.cat!=='변화'||/^1체$|^$/.test(r)){const fs=foes(m.side);const f=mv.cat==='변화'?null:fs.sort((x,y)=>expect(m,mv,y)/Math.max(1,y.hp.cur)-expect(m,mv,x)/Math.max(1,x.hp.cur))[0];if(f)tg=[f.side+'_'+f.entry]}}
    W.OM_APP.sysLog(`【추가 행동】 ${m.name} 『${mv.name}』 — ${o.xact}`,'battle');await FG.attack(H,W,m.id,i,tg,i<0?{mvObj:Object.assign({},mv,{virt:1})}:{});await flush();await gmChores();markSeen(m,mv.name);if(!active('left').length||!active('right').length)break;continue}
   const a=acts.find(x=>x.m.id===o.mid);if(!a)continue;
   if(a.sw){if(!alive(a.sw)||a.sw.entry)continue;const area=m.entry;await FN.exitMon(m.id,{sys:true,noAsk:true});await FN.enterMon(a.sw.id,area,{sys:true,how:'통상 교대'});await flush();continue}
   /* 대상이 쓰러졌으면 남은 상대 (3-3) */
   let targets=(a.targets||[]).filter(s=>{const [sd,ar]=s.split('_');const d=FN.entered(C(),sd)[ar];return !!d});if(!targets.length&&a.mv.cat!=='변화'){const fs=foes(m.side);if(fs.length)targets=[fs[0].side+'_'+fs[0].entry]}
   /* 숙달 ② 명중굴림 전 (2-4): 아군 공격 · 상대 방어 */
   if(a.mv.cat!=='변화'){const tg0=targets.map(s=>{const [sd,ar]=s.split('_');return FN.entered(C(),sd)[ar]}).filter(Boolean).find(d=>d.side!==m.side);
    if(tg0){const tidA=m.tid;if(!isWildT(tidA)&&mastery(tidA)&&!cmdUsed(tidA)&&!isOld(m)){const v=expect(C().mons[m.id],a.mv,tg0);if(v<tg0.hp.cur&&v*1.5>=tg0.hp.cur)await fire(tidA,m.id,'command',a.mv.cat==='특수'?'specialattack':'attack');else if(POLS[tidA]==='A'&&v>=tg0.hp.cur&&+a.mv.acc&&+a.mv.acc<100&&cmdLeft(T(tidA),'accuracy'))await fire(tidA,m.id,'command','accuracy')}
     const tidD=tg0.tid;if(!isWildT(tidD)&&mastery(tidD)&&!cmdUsed(tidD)&&!isOld(tg0)){const DF=tg0.flags||{};const dodged=((DF.dodgePhys&&a.mv.cat==='물리')||(DF.dodgeSpec&&a.mv.cat==='특수'))&&!isSure(a.mv);if(!dodged){const v=expect(C().mons[m.id],a.mv,C().mons[tg0.id]);if(v>=tg0.hp.cur&&v/1.5<tg0.hp.cur)await fire(tidD,tg0.id,'command',a.mv.cat==='특수'?'specialdefense':'defense');else if(POLS[tidD]==='A'&&v>=tg0.hp.cur&&!isSure(a.mv)&&cmdLeft(T(tidD),'evasion'))await fire(tidD,tg0.id,'command','evasion')}}}}
   /* 11-14 「차지」: 아직 안 모았으면 이번 턴은 모으기 — 반무적 상태 · 「차지할 때」 랭크 (웹툴 openAttackPre ① 과 같다) */
   {const mm=C().mons[m.id];if(CHG_RE.test(String(a.mv.eff||''))&&!charged(mm,a.mv)){if(chargeSkip(mm,a.mv)){if(FN.HAS&&FN.HAS(mm,'파워풀허브')&&!(FN.wxNow&&String(a.mv.eff).includes(FN.wxNow(C())||'@@')))await FN.itemConsume(mm.id,false,'파워풀허브')}
     else{const vk=FN.chargeVanish?FN.chargeVanish(a.mv):'';const x=clone(mm);x.states=Object.assign({},x.states||{});if(vk)x.states[vk]=2;const tg0=targets.map(s=>{const [sd,ar]=s.split('_');return FN.entered(C(),sd)[ar]}).find(d=>d&&d.side!==mm.side);x.charge={mv:a.mv.name,turn:+C().turn||0,tg:tg0?tg0.id:''};
      const cr=String(a.mv.eff).match(/「차지」할 때 「([^」]+?)\s*:\s*\+(\d)」/);if(cr){const K={공격:'attack',방어:'defense',특공:'specialattack',특방:'specialdefense',스피드:'speed'};for(const nm of cr[1].split('/')){const k=K[nm.trim()];if(k)x.rank[k]=Math.min(6,(+x.rank[k]||0)+(+cr[2]))}}
      await W.OM_APP.setDiff(['battle','mons',mm.id],mm,x,1);W.OM_APP.sysLog(`【차지】 ${mm.name} 『${a.mv.name}』 — 모으기${vk?' · 「'+(FN.stKoU?FN.stKoU(vk):vk)+'」':''}`,'battle');markSeen(m,a.mv.name);continue}}}
   const before=hpMap();
   const r=await FG.attack(H,W,m.id,a.mv._i,targets,{});
   /* 모은 기술을 냈으면 차지 · 반무적을 푼다 */{const mm=C().mons[m.id];if(mm&&mm.charge&&mm.charge.mv===a.mv.name){const x=clone(mm);const vk=FN.chargeVanish?FN.chargeVanish(a.mv):'';if(vk&&x.states)delete x.states[vk];delete x.charge;await W.OM_APP.setDiff(['battle','mons',mm.id],mm,x,1)}}await flush();await gmChores();
   markSeen(m,a.mv.name);{const x=C().mons[m.id];const T1=+C().turn||0;if(x&&!(r&&r.fail)){x.consec={name:a.mv.name,n:x.lastMove===a.mv.name&&+x.lastMoveT===T1-1?((x.consec&&x.consec.name===a.mv.name?+x.consec.n:1)+1):1};x.lastMove=a.mv.name;x.lastMoveT=T1}}if(a.mv.ext)await extUsed(m,a.mv);
   for(const id in before)if(before[id]>0&&C().mons[id]&&!alive(C().mons[id]))C().mons[id]._by=m.name;
   /* 자기 교대(유턴 등) — 벤치에서 고른다 */
   const me=C().mons[m.id];if(r&&r.selfSwitch&&me&&me.entry&&alive(me)){const nx=pickIn(m.side,1,m.tid).filter(x=>x.tid===m.tid)[0]||pickIn(m.side,1)[0];if(nx){const area=me.entry;await FN.exitMon(me.id,{sys:true,noAsk:true});await FN.enterMon(nx.id,area,{sys:true,how:'임의 교대'});await flush()}}
   if(!active('left').length||!active('right').length)break}
  /* 4. 턴 종료: 「가장 마지막」 · 「턴 종료 시」 포텐셜 → 웹툴 turnEnd → 「턴 종료 이후」 · 숙달회복 ② */
  for(const step of ['last','end']){for(const x of FN.endCands(C(),step))if(x.kind==='pot')await endPot(x)}
  for(const tid of TORD){if(isWildT(tid)||!mastery(tid)||cmdUsed(tid)||!cmdLeft(T(tid),'heal'))continue;const w=active(T(tid).side).filter(m=>m.tid===tid&&!isOld(m)&&m.hp.cur<=m.hp.max*0.5).sort((a,c)=>a.hp.cur/a.hp.max-c.hp.cur/c.hp.max)[0];if(w)await fire(tid,w.id,'command','heal')}
  {const ub=C();for(const tid in (ub.cmds||{})){const x=(ub.cmds[tid]||{}).fired||{};for(const mid in x){const f=x[mid]||{};used[tid]=used[tid]||{order:0,command:0};if(f.order)used[tid].order++;if(f.command)used[tid].command++}}}
  await gmEndHeal();await FN.turnEnd();await flush();await gmChores();
  for(const x of FN.endCands(C(),'after'))if(x.kind==='pot')await endPot(x)
  markKo(hp0);
  /* 5. 빈자리 채우기 (죽어내밀기) */
  for(const sd of ['left','right']){const ent=FN.entered(C(),sd);for(const ar of AREAS){if(ent[ar])continue;const nx=pickIn(sd,1)[0];if(!nx)continue;await FN.enterMon(nx.id,ar,{sys:true,how:'죽어내밀기'});await flush()}}
  turnsLog.push({turn,hp:hpMap()});
  if(!Object.values(C().mons).some(m=>m.side==='left'&&alive(m))||!Object.values(C().mons).some(m=>m.side==='right'&&alive(m)))break}
 const fb=C();const winner=!Object.values(fb.mons).some(m=>m.side==='right'&&alive(m))?'left':!Object.values(fb.mons).some(m=>m.side==='left'&&alive(m))?'right':'draw';
 const mo=m=>({id:m._oid||m.id,tid:m.tid,name:m.name,hp:Math.max(0,m.hp.cur),max:m.hp.max,states:Object.keys(m.states||{}).filter(k=>m.states[k]),item:m.item||'',itemUsed:m.itemUsed||null,potUses:m.potUses||null,dealt:0,taken:0});
 const to=sd=>Object.fromEntries(Object.values(fb.trainers).filter(t=>t.side===sd).map(t=>[t.id,{name:t.name,pol:POLS[t.id],used:used[t.id]||{order:0,command:0},oc:t.orderCount||{}}]));
 const raid=Object.values(fb.mons).filter(m=>m.raid&&+m.raid.phase>0).flatMap(m=>Array.from({length:+m.raid.phase},(_,i)=>({name:m.name,phase:i+1})));
 const orig=sd=>{const src=opt[sd];return (src.parties||[src]).flatMap(p=>p.mons||[])};
 /* 왼쪽 결과는 원래 id 로 (던전이 시트에 되돌려 쓴다) */
 const left=Object.values(fb.mons).filter(m=>m.side==='left').map(mo);
 return {winner,turns:turn,kos,raid,left,right:Object.values(fb.mons).filter(m=>m.side==='right').map(mo),trainers:{left:to('left'),right:to('right')},log:opt.log?H.logs.slice():[],asked:H.asked}}
module.exports={runBattle,mkRng,POL};
