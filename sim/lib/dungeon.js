/* 던전 진행기 — 던전(data/dungeons/*.json)의 방을 차례로 지나며 스킬 체크 · 야생 조우 · 휴식을 돌리고, 일행 상태를 끝까지 추적한다.
   던전: {id, name, wn 동행 수(기본 2), rooms:[{id, t 종류, name, check:{…}, enc:{pack, boss?}, rest:'breath'|'short'|'long'}], path:[방 id 순서]}
   체크 (10-29 v4, lib/skill.js): {v:4, label, stat 지시|육성|통솔|능력, base 종족값 칸(0 HP~5 스피드), target 8|10|12|15, pm ±, twice ±1, fit:{types, moves, abil, etcMons}, noStep,
          (옛 v3 체크 target 5|7|9|11 · step · hint 는 skill.js up 이 v4 로 바꾼다)
          pen:{fail:{dmg:'1/4', st:'Poison', rk:{speed:-1}, oo:1, oc:1, al, memo}}, gain:{…} 성공 보상 · gainCrit:{…} 대성공 이득 (생성기 기본 = 경계도 −10)}
   일행 정책(policy): who 'best'(그 자질 주사위가 가장 큰 사람) | 'round'(돌아가며) · cover 'never' | 'fail'(실패를 받침, 'always' 도 같음 — v4 엔 대가가 없다) · partner 'match'(조건 맞는 안 지친 포켓몬) | 'any' | 'none'
   조정값(adj): fieldMax 필드 포켓몬 수(기본 1, 웹툴 fieldMax) · coverBall 볼 안 커버 · coverHp · crit · injPen · dyingFight …
   휴식: 상태 회복은 룰북 표(긴 2단계 · 중간 · 짧은 1단계 · 숨돌리기 0). HP · 4식 6령은 웹툴 skill_ui REST0 과 같은 표 — 자동 생성 던전은 RULES(10-28: 짧은 = 전원 HP 1/4 · 숨돌리기 = 1체 HP 1/4 + 6령 1 · 중간 = HP 1/2 · 빈사 1/4) */
"use strict";
const fs=require('fs'),path=require('path');
const SK=require('./skill.js'),BT=require('./battle.js'),WD=require('./wild.js');
const DIR=path.resolve(__dirname,'..','data','dungeons');
const REST={long:{hp:'full',revive:1,cure:1,tired:1,care:1,inou:1,inj:2},short:{hp:'1/2',revive:0,cure:1,tired:1,care:1,inou:1,inj:1},breath:{hp:'1/4',revive:0,cure:0,tired:1,care:0,inou:0,inj:0}};
/* 휴식 표 2안 (10-27 망령 「휴식 단계 회복량도 조정해도 돼」): 짧은 휴식이 빈사를 HP 1/4 로 깨운다 — 숨돌리기와 차이를 둔다 */
/* 중간 휴식(10-27 망령 「던전 안은 짧거나 중간, 긴 휴식은 던전이 끝난 뒤」): HP 3/4 · 빈사를 HP 1/2 로 · 상태 · 부상 1단계 */
const REST2={long:REST.long,mid:{hp:'1/2',revive:'1/4',cure:1,tired:1,care:1,inou:1,inj:1},   /* 10-28 중간 휴식 = 웹툴 skill_ui REST0.mid (전원 HP 1/2 · 빈사 1/4 · 상태 회복 · 공용 4식 6령 절반) */short:{hp:'1/2',revive:'1/4',cure:1,tired:1,care:1,inou:1,inj:1},breath:{hp:'1/4',revive:0,cure:0,tired:1,care:0,inou:0,inj:0}};
const TYPE_KO={노말:'Normal',불꽃:'Fire',물:'Water',전기:'Electric',풀:'Grass',얼음:'Ice',격투:'Fighting',독:'Poison',땅:'Ground',비행:'Flying',에스퍼:'Psychic',벌레:'Bug',바위:'Rock',고스트:'Ghost',드래곤:'Dragon',악:'Dark',강철:'Steel',페어리:'Fairy'};
const frac=(v,s)=>{s=String(s==null?'':s).trim();if(s==='full')return v;const m=s.match(/^(\d+)\s*\/\s*(\d+)$/);return m?Math.max(1,Math.floor(v*+m[1]/+m[2])):Math.max(0,Math.floor(+s||0))};
const clone=o=>JSON.parse(JSON.stringify(o));
function dungeons(){const out={};if(!fs.existsSync(DIR))return out;for(const f of fs.readdirSync(DIR)){if(!f.endsWith('.json'))continue;const d=JSON.parse(fs.readFileSync(path.join(DIR,f),'utf8'));if(/\.private\.json$/.test(f))d.private=true;d._file=f;out[d.id||f.replace(/(\.private)?\.json$/,'')]=d}return out}

/* 일행 상태 만들기: parties=[{trainer,mons}] (제작기 파티), wn 동행 수 → 동행 = 파트너 먼저, 그다음 순서대로 */
function makeParty(parties,wn){return parties.map(p=>{const t=clone(p.trainer);const ms=p.mons.slice().sort((a,b)=>(b.partner?1:0)-(a.partner?1:0)).slice(0,wn).map(m=>{const x=clone(m);x.hp.cur=x.hp.max;x.states={};x.rank={};return x});
 return {trainer:t,mons:ms,inj:0,tired:new Set(),inou:0,myosu:0,care:0,aa:0,debt:{oo:0,oc:0,rk:{}},stats:{checks:0,ok:0,cost:0,fail:0,fumble:0,crit:0,covers:0,covered:0,inouUsed:0,penDmg:0}}})}

function pathOf(dg,r){let P=(dg.path||dg.rooms.filter(x=>!x.alt).map(x=>x.id)).slice();for(const g of dg.branches||[]){if(r()<0.5){const i=P.indexOf(g.main[0]);if(i>=0)P.splice(i,g.main.length,...g.alt)}}return P}
async function run(W,dg,parties,opt){opt=opt||{};const rng=opt.rng||BT.mkRng(opt.seed||1);const pol=Object.assign({who:'best',cover:'fail',partner:'match',inou:'yes'},opt.policy||{});
 const adj=Object.assign({fieldMax:1,coverBall:0,ordScope:'dungeon',ordPer:1,cmdPer:2,target:0,penScale:1,checkEvery:1,stepAll:0,wildLv:0,wildExtra:0,bossN:0,raidX:null,raidMode:'barrier',restV:1,al0:0,al30:5,al70:10,alBattle:0,alScale:1},dg.rules||{},opt.adjust||{});   /* dg.rules = 던전에 박힌 규칙값(자동 생성 던전). 조정값(opt.adjust)이 그 위에 */
 const party=makeParty(parties,dg.wn||opt.wn||2);const ev=[];const say=(e)=>ev.push(e);
 const aliveMons=P=>P.mons.filter(m=>m.hp.cur>0);
 /* 10-29 필드 포켓몬 (룰북 「던전 · 배틀 중엔 필드 포켓몬만」 · 웹툴 skill_ui fieldMax 기본 1): 트레이너마다 살아 있는 동행 앞에서 adj.fieldMax 체. 커버도 필드만(adj.coverBall 1 이면 볼 안의 동행도) */
 const fieldMons=P=>aliveMons(P).slice(0,Math.max(1,+adj.fieldMax||1));const anyAlive=()=>party.some(P=>aliveMons(P).length);
 const rankOf=(P,st)=>((P.trainer.ranks||{})[st]||'C');
 let round=0;
 /* 10-29 스킬 체크 v4 (lib/skill.js): 판정할 사람 · 포켓몬 고르기 — 일행 모두 필드(동행 wn 체)에 있다고 보고, 보정 합이 가장 큰 짝을 고른다.
    초상 능력(능력 A 이상 · 휴식 사이 A 1 · AA 2)은 「능력」 체크에서 포켓몬보다 나을 때만 (pol.inou 'no' 면 안 씀) */
 const supMax=P=>{const l=SK.lv(rankOf(P,'능력'));return l>=4?2:l>=3?1:0};
 const myosuMax=P=>{const l=SK.lv(rankOf(P,'지시'));return l>=4?2:l>=3?1:0};
 const optFor=(P,ck)=>{const base={rank:rankOf(P,ck.stat),pm:(+ck.pm||0)+(+adj.stepAll||0),twice:+ck.twice||0,inj:P.inj,tough:SK.lv(rankOf(P,'육성'))>=3};const L=[];
  if(pol.partner!=='none')for(const m of fieldMons(P)){const f=SK.monFit(m,ck);L.push(Object.assign({},base,{mon:f.mon,fit:pol.partner==='match'?f.fit:0,m,why:f.why}))}
  L.push(Object.assign({},base,{mon:null,m:null}));
  if(ck.stat==='능력'&&pol.inou!=='no'&&P.inou<supMax(P))L.push(Object.assign({},base,{super:true,m:null}));
  return L.map(q=>Object.assign(q,{mod:SK.modOf(q)})).sort((a,b)=>b.mod-a.mod||(a.super?1:0)-(b.super?1:0))[0]};
 /* 체크 하나 */
 const doCheck=(room,ck0)=>{const ck=SK.up(ck0);const target=+ck.target+adj.target;const cands=party.filter(P=>P.inj<3);if(!cands.length)return null;let P;
  if(pol.who==='round'){P=cands[round%cands.length];round++}else{P=cands.slice().sort((a,b)=>optFor(b,ck).mod-optFor(a,ck).mod)[0]}
  const rank=rankOf(P,ck.stat);const q=optFor(P,ck);q.target=target;q.crit=adj.crit==null?4:+adj.crit;q.myosu=myosuMax(P)-P.myosu>0?1:0;
  const r=SK.roll(q,rng);if(r.myosuUsed)P.myosu++;const mode=q.super?'inou':'skill';if(q.super)P.inou++;
  const rec={room:room.id,label:ck.label,stat:ck.stat,target,who:P.trainer.name,rank,mode,partner:q.m?q.m.name:(q.super?'이능':'혼자'),mod:r.mod,fit:q.fit||0,pdie:6,die:6,a:r.a,p:r.p,total:r.total,ri0:r.ri,ri:r.ri,fumble:r.fumble,stubborn:false,cover:'',pen:[]};
  /* 실패: 상태 한 단계 (제시가 noStep 이면 없음). 커버 = 판정하지 않은 포켓몬이 최대 HP adj.coverHp(1/4) 를 받고 막는다 (pol.cover 'never' 면 안 함) */
  if(r.ri===1&&!+ck.noStep){let C=null;if(pol.cover!=='never'){const cs=party.flatMap(Q=>(+adj.coverBall?aliveMons(Q):fieldMons(Q)).map(m=>({Q,m}))).filter(x=>x.m!==q.m&&x.m.hp.cur>frac(x.m.hp.max,adj.coverHp||'1/4'));cs.sort((a,b)=>b.m.hp.cur/b.m.hp.max-a.m.hp.cur/a.m.hp.max);C=cs[0]||null}
   if(C){const loss=frac(C.m.hp.max,adj.coverHp||'1/4');C.m.hp.cur=Math.max(0,C.m.hp.cur-loss);rec.cover=C.Q.trainer.name;C.Q.stats.covers++;P.stats.covered++;rec.pen.push(`[커버] ${C.m.name} HP −${loss}`)}
   else injure(P,'실패',rec)}
  P.stats.checks++;if(rec.ri>=3)P.stats.ok++;if(rec.ri===4)P.stats.crit++;if(rec.ri<=1)P.stats.fail++;if(mode==='inou')P.stats.inouUsed++;
  /* 보상 · 패널티 묶음 (묶음은 판정한 포켓몬이 받는다 — 혼자면 포켓몬 몫은 없음) */
  if(rec.ri>=3&&ck.gain)applyPen(P,ck.gain,rec,'성공 보상');if(rec.ri===4&&ck.gainCrit)applyPen(P,ck.gainCrit,rec,'대성공 보상');
  const pen=ck.pen||{};if(rec.ri<=1&&pen.fail)applyPen(P,pen.fail,rec,'실패',q.m||null);
  say(Object.assign({k:'check'},rec));return rec};
 /* 상태 단계: 건강 → 부상(6령 −1 · 판정 −1) → 중상(4식 −1 · 불리) → 빈사(그 방에서 판정 못 함, 다음 방에서 중상) */
 const injure=(P,why,rec)=>{if(P.inj>=3)return;P.inj++;const lab=['건강','부상','중상','빈사'][P.inj];const L=[`${P.trainer.name} 「${lab}」 (${why})`];
  const cut=P.inj===1?['command',+(adj.injOc==null?1:adj.injOc)]:P.inj===2?['order',+(adj.injOo==null?1:adj.injOo)]:null;
  if(cut&&cut[1]){if(adj.ordScope==='dungeon'){pool[cut[0]]=Math.max(0,pool[cut[0]]-cut[1])}else P.debt[cut[0]==='order'?'oo':'oc']+=cut[1];L.push(`${cut[0]==='order'?'4식':'6령'} −${cut[1]}`)}
  rec.pen.push(L.join(' · '));say({k:'injury',who:P.trainer.name,inj:P.inj,why})};
 const applyPen=(P,sub,rec,why,mon)=>{sub=sub||{};const L=[];const ms=aliveMons(P);const m=mon!==undefined?(mon&&mon.hp.cur>0?mon:null):ms.length?ms[Math.floor(rng()*ms.length)]:null;
  if(sub.dmg&&m){let loss=frac(m.hp.max,sub.dmg);loss=Math.max(1,Math.floor(loss*adj.penScale));m.hp.cur=Math.max(0,m.hp.cur-loss);P.stats.penDmg+=loss;L.push(`${m.name} HP −${loss}`)}
  if(sub.st&&m&&m.hp.cur>0){m.states[sub.st]=+sub.cnt>0?+sub.cnt:sub.st==='Sleep'?2:sub.st==='Confusion'?3:1000;L.push(`${m.name} 「${sub.st}」`)}
  if(sub.rk){for(const k in sub.rk)P.debt.rk[k]=(P.debt.rk[k]||0)+(+sub.rk[k]||0);L.push('랭크 '+JSON.stringify(sub.rk))}
  if(adj.ordScope==='dungeon'){/* 10-28: 던전 공용 풀에서 바로 뺀다 */if(+sub.oo)pool.order=Math.max(0,pool.order-(+sub.oo));if(+sub.oc)pool.command=Math.max(0,pool.command-(+sub.oc));if(+sub.oo||+sub.oc)L.push(`4식 −${+sub.oo||0} · 6령 −${+sub.oc||0} (던전 공용 남은 4식 ${pool.order} · 6령 ${pool.command})`)}
  else{if(+sub.oo)P.debt.oo+=+sub.oo;if(+sub.oc)P.debt.oc+=+sub.oc;if(+sub.oo||+sub.oc)L.push(`4식 −${+sub.oo||0} · 6령 −${+sub.oc||0} (다음 배틀)`)}
  /* 배틀에 닿는 패널티: fight 추가 조우(이 방 바로 뒤) · restDown 다음 휴식 한 단계 깎임 · foeLv 다음 배틀 야생 레벨 + */
  if(sub.fight){pend.fights.push(sub.fight);L.push(`추가 조우 ${(sub.fight.mix||[]).length||sub.fight.n||1}체`)}
  if(+sub.restDown){pend.restDown+=+sub.restDown;L.push(`다음 휴식 −${+sub.restDown}단계`)}
  if(+sub.foeLv){pend.foeLv+=+sub.foeLv;L.push(`다음 배틀 야생 Lv +${+sub.foeLv}`)}
  if(+sub.al){const b=pend.al;pend.al=Math.max(0,Math.min(100,pend.al+(+sub.al)*(+adj.alScale||1)));L.push(`경계도 ${pend.al>=b?'+':'−'}${Math.abs(pend.al-b)} → ${pend.al}`);say({k:'alert',from:b,to:pend.al})}
  if(+sub.bossLv){pend.bossLv+=+sub.bossLv;L.push(`보스방 Lv ${+sub.bossLv>0?'+':''}${+sub.bossLv}`)}
  if(sub.memo)L.push(sub.memo);rec.pen.push(`[${why}] `+L.join(' · '))};
 const pool0={order:party.length*(+adj.ordPer||0),command:party.length*(+adj.cmdPer||0)};const pool=Object.assign({},pool0);   /* 던전 공용 4식 · 6령 (10-28) */
 const pend={fights:[],restDown:0,foeLv:0,bossLv:0,al:+adj.al0||0};
 /* 경계도 (웹툴 던전 탭과 같은 단계): 30 이상 → 야생 Lv +al30, 70 이상 → +al70, 100 → 자동 실패 */
 const alLv=()=>pend.al>=70?(+adj.al70||0):pend.al>=30?(+adj.al30||0):0;
 /* 조우 */
 const doBattle=async(room,enc)=>{let wild;
  if(enc.mix){/* 여러 트레이너의 포켓몬을 섞은 야생 무리: mix:[{trainer,pick}], 순서대로 이어 붙여 앞에서 n 체(보스 방은 adjust.bossN 이 우선). bossAt 번째가 『와일드 보스』(×1.5), raid:X 면 「레이드 배틀 : X」 */
   if(!opt.wildFrom&&enc.mix.some(m=>!m.sp&&!m.db))throw new Error('스냅샷 야생을 쓸 수 없음 (wildFrom 없음)');const lvAdd=(+enc.lvAdd||0)+(+adj.wildLv||0)+(enc._extra?0:pend.foeLv)+(enc.boss?pend.bossLv:0)+alLv();if(!enc._extra)pend.foeLv=0;let mons=[],tr=null;
   for(const src of enc.mix){if(src.db){/* 야생 DB (lib/wilddb.js v2) */const WB=require('./wilddb.js');const e=(WB._cache=WB._cache||WB.fullV2()).find(x=>x.id===src.db||x.name===src.db);if(!e)throw new Error('야생 DB 에 없음: '+src.db);const r=WB.buildEntry(W,e,{lvAdd});tr=tr||r.trainer;mons.push(r.mon);continue}if(src.sp){/* 도감 야생 (lib/dex.js) */const r=require('./dex.js').build(W,src.sp,{lvAdd});tr=tr||r.trainer;mons.push(r.mon);continue}const w=opt.wildFrom(src.trainer,{pick:src.pick,take:src.take,lvAdd});tr=tr||w.trainer;mons=mons.concat(w.mons)}
   const N=enc.boss&&+adj.bossN?+adj.bossN:(+enc.n||mons.length);while(mons.length<N)mons.push(clone(mons[mons.length%Math.max(1,enc.mix.length)]));mons=mons.slice(0,N);
   const seen={};mons.forEach((x,i)=>{seen[x.id]=(seen[x.id]||0)+1;if(seen[x.id]>1)x.id=x.id+'_d'+i});
   const bi=enc.boss?(+enc.bossAt||0):-1;const X=enc.boss?(adj.raidX!=null&&adj.raidX!==''?+adj.raidX:(+enc.raid||0)):0;
   mons.forEach((x,i)=>{const k=i===bi?1.5:1.25;x.mod={attack:k,defense:k,specialattack:k,specialdefense:k,speed:k};x.boss=i===bi;x.role=i===bi?'와일드 보스':'와일드';x.hp.cur=x.hp.max;delete x.raid;if(i===bi&&X>0)x.raid={segments:X,broken:0,phase:1,mode:adj.raidMode==='cap'?'cap':'barrier'}});
   wild={trainer:tr,mons}}
  else if(enc.trainer){/* 제작기 스냅샷의 트레이너를 야생 무리로 (예: 무진 NPC/숲 속의 폐가) — opt.wildFrom 은 서버 · 명령줄이 넘긴다 */if(!opt.wildFrom)throw new Error('스냅샷 야생을 쓸 수 없음 (wildFrom 없음)');const fl=pend.foeLv+alLv();pend.foeLv=0;wild=opt.wildFrom(enc.trainer,{pick:enc.pick,take:enc.take,boss:enc.boss,lvAdd:(+enc.lvAdd||0)+(+adj.wildLv||0)+fl,extra:(+enc.extra||0)+(+adj.wildExtra||0)})}
  else{const packs=WD.packs();const pk=packs[enc.pack];if(!pk)throw new Error('야생 무리 없음: '+enc.pack);const pk2=Object.assign({},pk,{lvAdd:(+pk.lvAdd||0)+(+adj.wildLv||0),mons:pk.mons.concat(Array.from({length:+adj.wildExtra||0},(_,i)=>pk.mons[i%pk.mons.length]))});wild=WD.build(W,pk2)}
  /* 10-29 빈사 트레이너는 그 장면(방)에 참가하지 못한다 — 같은 방 배틀에 그 트레이너 포켓몬도 안 나간다 (adj.dyingFight 1 이면 옛 방식) */
  const parties=party.filter(P=>P.inj<3||+adj.dyingFight).map(P=>{const t=clone(P.trainer);require('./party.js').orders(W,t,{mons:P.mons,autoPick:adj.autoPick!==0&&adj.autoPick!=='0'});const oc=t.orderCount||{};if(adj.ordScope==='dungeon'){/* 10-28 망령: 4식 · 6령은 던전 단위 — 1인 4식 1 · 6령 2 를 셋이 합친 공용 풀(pool). 종류마다 칸은 넉넉히 두고 풀이 한도 */for(const k of Object.keys(oc))if(oc[k]>0)oc[k]=9}/* 체크 패널티의 4식 · 6령 차감 */let oo=P.debt.oo,oc2=P.debt.oc;for(const k of Object.keys(oc).sort()){if(k.startsWith('order_')&&oo>0&&oc[k]>0){oc[k]--;oo--}if(k.startsWith('command_')&&oc2>0&&oc[k]>0){oc[k]--;oc2--}}P.debt.oo=0;P.debt.oc=0;
   const mons=P.mons.filter(m=>m.hp.cur>0).map(m=>{const x=clone(m);x.rank=Object.assign({},P.debt.rk);return x});P.debt.rk={};return {trainer:t,mons}}).filter(p=>p.mons.length);
  if(!parties.length)return null;const fmt=Math.min(3,Math.max(1,parties.reduce((a,p)=>a+p.mons.length,0)>=3?3:2));
  const r=await BT.runBattle(W,{left:{parties},right:wild,rng,format:fmt,maxTurns:30,pool:adj.ordScope==='dungeon'?pool:null,poolBoss:!!enc.boss,poolInit:pool0});
  /* 결과를 시트로 */for(const P of party)for(const m of P.mons){const x=r.left.find(y=>y.id===m.id);if(x){m.hp.cur=x.hp;m.states={};for(const k of x.states)if(['Poison','Toxic','Burn','Paralysis','Freeze','Sleep'].includes(k))m.states[k]=1000;
   /* 10-28 03:50 망령: 소지품도 던전 단위 — 쓴 열매 · 띠는 다음 배틀에 없다. 포텐셜 횟수도 이어진다 */if(adj.ordScope==='dungeon'){if(m.item&&!x.item){const nm=m.item;if(W.OM_FX&&W.OM_FX.removeByName)W.OM_FX.removeByName(m,nm);m.item='';m.itemEff='';m.itemUsed=x.itemUsed||{name:nm};say({k:'itemGone',mon:m.name,item:nm})}if(x.potUses)m.potUses=JSON.parse(JSON.stringify(x.potUses))}}}
  const used={order:0,command:0};for(const t of Object.values(r.trainers.left)){used.order+=t.used.order;used.command+=t.used.command}
  if(+adj.alBattle&&!enc.boss)pend.al=Math.min(100,pend.al+(+adj.alBattle));
  const rec={k:'battle',extra:!!enc._extra,alert:pend.al,room:room.id,pack:enc.pack||enc.trainer||'mix',boss:!!enc.boss,foes:wild.mons.length,raidX:(wild.mons.find(m=>m.raid)||{raid:{}}).raid.segments||0,phases:(r.raid||[]).length,bossHp:(()=>{const b=r.right.find(y=>wild.mons.find(m=>m.boss&&m.id===y.id));return b?+(b.hp/b.max).toFixed(2):null})(),win:r.winner==='left',turns:r.turns,kos:r.kos.filter(k=>k.side==='left').length,wildKos:r.kos.filter(k=>k.side==='right').length,used,hpAfter:party.map(P=>P.mons.map(m=>+(m.hp.cur/m.hp.max).toFixed(2)))};say(rec);return rec};
 const doRest=(room,kind)=>{const ORD=['none','breath','short','mid','long'];if(pend.restDown){const k0=kind;kind=ORD[Math.max(0,ORD.indexOf(kind)-pend.restDown)];pend.restDown=0;say({k:'restDown',room:room.id,from:k0,to:kind});if(kind==='none')return}const TB=(+adj.restV===2||kind==='mid')?REST2:REST;const R=TB[kind]||TB.breath;
  /* 10-28 03:23~25 망령: 짧은 휴식 = 파티에서 4식 · 6령 1개씩 + 가장 다친 1체 HP 1/4 + 빈사는 HP 1 + 상태 회복 (restShort:'one'. 'add' 는 원래 짧은 휴식에 더하는 실험용) */
  const SN=kind==='short'&&adj.restShort?adj.restShort:'';
  /* 10-28 22시 망령: 짧은 휴식은 전원 HP 1/4 (restShort:'all'), 숨돌리기 = 가장 다친 1체 HP 1/4 + 6령 1 (restBreath:'one' · restBC) */
  const BN=kind==='breath'&&adj.restBreath==='one';
  if(kind==='mid'&&adj.ordScope==='dungeon'){pool.order=Math.min(pool0.order,pool.order+Math.ceil(pool0.order/2));pool.command=Math.min(pool0.command,pool.command+Math.ceil(pool0.command/2))}
  if(SN){const al=party.flatMap(P=>P.mons.filter(m=>m.hp.cur>0&&m.hp.cur<m.hp.max));al.sort((a,b)=>a.hp.cur/a.hp.max-b.hp.cur/b.hp.max);for(const m of SN==='all'?al:al.slice(0,1))m.hp.cur=Math.min(m.hp.max,m.hp.cur+frac(m.hp.max,adj.restOneHp||'1/4'));
   if(adj.ordScope==='dungeon'){pool.order=Math.min(pool0.order,pool.order+(+adj.restPO||0));pool.command=Math.min(pool0.command,pool.command+(+adj.restPC||0))}}
  if(BN){const al=party.flatMap(P=>P.mons.filter(m=>m.hp.cur>0&&m.hp.cur<m.hp.max));al.sort((a,b)=>a.hp.cur/a.hp.max-b.hp.cur/b.hp.max);if(al[0])al[0].hp.cur=Math.min(al[0].hp.max,al[0].hp.cur+frac(al[0].hp.max,'1/4'));
   if(adj.ordScope==='dungeon')pool.command=Math.min(pool0.command,pool.command+(adj.restBC==null?1:+adj.restBC||0));for(const P of party)if(R.tired)P.tired.clear();say({k:'rest',room:room.id,kind});return}
  for(const P of party){if(SN==='one'||SN==='all'){/* 03:25 망령: 빈사는 HP 1 로 · 상태 회복 */for(const m of P.mons){if(m.hp.cur<=0)m.hp.cur=1;m.states={}}if(R.tired)P.tired.clear();if(R.inou)P.inou=0;if(R.care)P.care=0;P.inj=Math.max(0,P.inj-R.inj);continue}for(const m of P.mons){if(m.hp.cur<=0){if(typeof R.revive==='string'){m.hp.cur=frac(m.hp.max,R.revive);if(R.cure)m.states={};continue}if(R.revive){m.hp.cur=R.hp==='full'?m.hp.max:1}else continue}else m.hp.cur=R.hp==='full'?m.hp.max:Math.min(m.hp.max,m.hp.cur+frac(m.hp.max,R.hp));if(R.cure)m.states={}}
   if(R.tired)P.tired.clear();if(R.inou)P.inou=0;if(R.care)P.care=0;P.inj=Math.max(0,P.inj-R.inj)}
  /* 10-28: 휴식이 던전 공용 4식 · 6령을 일부 돌려준다(adj.restO · restC = 1인당, 짧은 휴식 이상) — 웹툴 휴식 설정 「4식 6령 회복」 칸과 같은 뜻 */
  if(adj.ordScope==='dungeon'&&kind!=='breath'&&kind!=='none'){const o0=pool.order,c0=pool.command;pool.order=Math.min(pool0.order,pool.order+party.length*(+adj.restO||0));pool.command=Math.min(pool0.command,pool.command+party.length*(+adj.restC||0));if(pool.order>o0||pool.command>c0)say({k:'restOrd',room:room.id,order:pool.order-o0,command:pool.command-c0})}
  say({k:'rest',room:room.id,kind})};
 /* 돌봄(육성 B 이상, 휴식 사이 1회): 지친 포켓몬이 있고 쓸 수 있으면 체크 앞에서 */
 const care=()=>{};   /* 10-29 v4: 지침 · 돌봄 없음 */

 let ci=0,wipe=false,boss=false,endRoom='',lockdown=false;
 /* 10-28 갈림길(dg.branches): 판마다 갈림길에서 반반으로 한쪽 길(본길 구간 / 다른 길)을 걷는다 — opt.route = 'main' | 'alt' 로 고정할 수 있다 */
 const route=pathOf(dg,()=>opt.route==='main'?1:opt.route==='alt'?0:rng());if(dg.branches&&dg.branches.length)say({k:'route',path:route});
 for(const rid of route){const room=dg.rooms.find(r=>r.id===rid);if(!room)continue;endRoom=rid;for(const P of party)if(P.inj===3)P.inj=2;say({k:'room',room:rid,t:room.t,name:room.name});
  if(room.check){ci++;/* checkEvery 2 = 체크를 하나 걸러 하나만 (제시 횟수를 줄이는 실험) */if(adj.checkEvery<=1||ci%adj.checkEvery===1){care();doCheck(room,room.check)}
   if(pend.al>=100){lockdown=true;wipe=true;break}
   while(pend.fights.length){const f=Object.assign({},pend.fights.shift(),{_extra:1});const r=await doBattle(room,f);if(!r||!r.win){wipe=true;break}}if(wipe)break}
  if(room.enc){const r=await doBattle(room,room.enc);if(!r||!r.win){wipe=true;break}if(room.enc.boss)boss=true}
  if(pend.al>=100){lockdown=true;wipe=true;break}
  if(room.rest)doRest(room,room.rest);
  if(!anyAlive()){wipe=true;break}}
 const checks=ev.filter(e=>e.k==='check'),battles=ev.filter(e=>e.k==='battle');
 const endHp=party.map(P=>P.mons.reduce((a,m)=>a+m.hp.cur/m.hp.max,0)/P.mons.length);
 return {dungeon:dg.id,wipe,lockdown,alert:pend.al,boss,endRoom,rooms:ev.filter(e=>e.k==='room').length,
  checks:{n:checks.length,ok:checks.filter(c=>c.ri>=3).length,crit:checks.filter(c=>c.ri===4).length,cost:checks.filter(c=>c.ri===2).length,fail:checks.filter(c=>c.ri<=1).length,fumble:checks.filter(c=>c.ri===0).length,covers:checks.filter(c=>c.cover).length,inou:checks.filter(c=>c.mode==='inou').length,alone:checks.filter(c=>c.partner==='혼자').length},
  extraFights:battles.filter(b=>b.extra).length,restDowns:ev.filter(e=>e.k==='restDown').length,
  bossLvDebt:pend.bossLv,poolLeft:Object.assign({},pool),
  bossBattle:(()=>{const b=battles.find(x=>x.boss);return b?{win:b.win,turns:b.turns,kos:b.kos,foes:b.foes,raidX:b.raidX,phases:b.phases,bossHp:b.bossHp,hpAfter:b.hpAfter}:null})(),
  battles:{n:battles.length,won:battles.filter(b=>b.win).length,turns:battles.reduce((a,b)=>a+b.turns,0),kos:battles.reduce((a,b)=>a+b.kos,0),orders:battles.reduce((a,b)=>a+b.used.order,0),commands:battles.reduce((a,b)=>a+b.used.command,0)},
  injuries:party.map(P=>P.inj),injuryEvents:ev.filter(e=>e.k==='injury').length,tiredLeft:party.map(P=>P.tired.size),penDmg:party.reduce((a,P)=>a+P.stats.penDmg,0),
  endHp:endHp.map(x=>+x.toFixed(2)),endHpAvg:+(endHp.reduce((a,b)=>a+b,0)/endHp.length).toFixed(3),faintedEnd:party.reduce((a,P)=>a+P.mons.filter(m=>m.hp.cur<=0).length,0),monsTotal:party.reduce((a,P)=>a+P.mons.length,0),
  checkRows:checks.map(c=>({l:c.label,t:c.target,ri:c.ri,ri0:c.ri0,w:c.who,p:c.partner,m:c.mode,cv:c.cover?1:0})),
  party:party.map(P=>({name:P.trainer.name,ranks:P.trainer.ranks,stats:P.stats})),events:opt.events?ev:undefined}}
module.exports={pathOf,dungeons,run,makeParty,REST,REST2,DIR};
