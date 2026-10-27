/* 던전 진행기 — 던전(data/dungeons/*.json)의 방을 차례로 지나며 스킬 체크 · 야생 조우 · 휴식을 돌리고, 일행 상태를 끝까지 추적한다.
   던전: {id, name, wn 동행 수(기본 2), rooms:[{id, t 종류, name, check:{…}, enc:{pack, boss?}, rest:'breath'|'short'|'long'}], path:[방 id 순서]}
   체크: {label, stat 지시|육성|통솔|능력, target 5|7|9|11, mode 'skill'|'inou'(능력 A 이상이면 이능으로), step ±1, twice ±1, hint 동료 조건 ('type:물' · 'any' · 'none'),
          pen:{fail:{dmg:'1/4', st:'Poison', rk:{speed:-1}, oo:1, oc:1, memo}, cost:{…}}, gain:{…} (대성공 보너스, 지금은 기록만)}
   일행 정책(policy): who 'best'(그 자질 주사위가 가장 큰 사람) | 'round'(돌아가며) · cover 'never' | 'fail'(실패를 받침) | 'always'(대가도 받침) · partner 'match'(조건 맞는 안 지친 포켓몬) | 'any' | 'none'
   휴식은 오레마스 skill_ui 의 REST0 과 같은 표: 긴 휴식 전부 회복 · 짧은 휴식 HP 1/2 · 부상 1단계 · 숨돌리기 HP 1/4 · 지침만 풀림 */
"use strict";
const fs=require('fs'),path=require('path');
const SK=require('./skill.js'),BT=require('./battle.js'),WD=require('./wild.js');
const DIR=path.resolve(__dirname,'..','data','dungeons');
const REST={long:{hp:'full',revive:1,cure:1,tired:1,care:1,inou:1,inj:2},short:{hp:'1/2',revive:0,cure:1,tired:1,care:1,inou:1,inj:1},breath:{hp:'1/4',revive:0,cure:0,tired:1,care:0,inou:0,inj:0}};
const TYPE_KO={노말:'Normal',불꽃:'Fire',물:'Water',전기:'Electric',풀:'Grass',얼음:'Ice',격투:'Fighting',독:'Poison',땅:'Ground',비행:'Flying',에스퍼:'Psychic',벌레:'Bug',바위:'Rock',고스트:'Ghost',드래곤:'Dragon',악:'Dark',강철:'Steel',페어리:'Fairy'};
const frac=(v,s)=>{s=String(s==null?'':s).trim();if(s==='full')return v;const m=s.match(/^(\d+)\s*\/\s*(\d+)$/);return m?Math.max(1,Math.floor(v*+m[1]/+m[2])):Math.max(0,Math.floor(+s||0))};
const clone=o=>JSON.parse(JSON.stringify(o));
function dungeons(){const out={};if(!fs.existsSync(DIR))return out;for(const f of fs.readdirSync(DIR)){if(!f.endsWith('.json'))continue;const d=JSON.parse(fs.readFileSync(path.join(DIR,f),'utf8'));out[d.id||f.replace(/\.json$/,'')]=d}return out}

/* 일행 상태 만들기: parties=[{trainer,mons}] (제작기 파티), wn 동행 수 → 동행 = 파트너 먼저, 그다음 순서대로 */
function makeParty(parties,wn){return parties.map(p=>{const t=clone(p.trainer);const ms=p.mons.slice().sort((a,b)=>(b.partner?1:0)-(a.partner?1:0)).slice(0,wn).map(m=>{const x=clone(m);x.hp.cur=x.hp.max;x.states={};x.rank={};return x});
 return {trainer:t,mons:ms,inj:0,tired:new Set(),inou:0,myosu:0,care:0,aa:0,debt:{oo:0,oc:0,rk:{}},stats:{checks:0,ok:0,cost:0,fail:0,fumble:0,crit:0,covers:0,covered:0,inouUsed:0,penDmg:0}}})}

function run(W,dg,parties,opt){opt=opt||{};const rng=opt.rng||BT.mkRng(opt.seed||1);const pol=Object.assign({who:'best',cover:'fail',partner:'match',inou:'yes'},opt.policy||{});
 const adj=Object.assign({target:0,penScale:1,checkEvery:1,stepAll:0,wildLv:0,wildExtra:0},opt.adjust||{});
 const party=makeParty(parties,dg.wn||opt.wn||2);const ev=[];const say=(e)=>ev.push(e);
 const aliveMons=P=>P.mons.filter(m=>m.hp.cur>0);const anyAlive=()=>party.some(P=>aliveMons(P).length);
 const rankOf=(P,st)=>((P.trainer.ranks||{})[st]||'C');
 const dieIdx=(P,st)=>SK.dieOf(rankOf(P,st),{inj:P.inj}).idx-(SK.dieOf(rankOf(P,st),{inj:P.inj}).autofail?9:0);
 let round=0;const bond=m=>[...(m.pots||[]),m.excl,...(m.exclX||[])].some(p=>p&&/유대/.test(p.name||''));
 const prideA=m=>/^A/.test(String(m.pride||''));
 /* 동료 고르기 */
 const partnerFor=(P,ck)=>{if(pol.partner==='none'||ck.hint==='none')return null;const cands=P.mons.filter(m=>m.hp.cur>0&&!P.tired.has(m.id));if(!cands.length)return null;
  if(pol.partner==='match'&&ck.hint&&ck.hint!=='any'){const [k,v]=String(ck.hint).split(':');if(k==='type'){const en=TYPE_KO[v]||v;const m=cands.find(m=>(m.types||[]).includes(en));return m||null}}
  return cands[0]};
 /* 체크 하나 */
 const doCheck=(room,ck)=>{const target=+ck.target+adj.target;let P;const cands=party.filter(P=>aliveMons(P).length||true);
  if(pol.who==='round'){P=cands[round%cands.length];round++}else{P=cands.slice().sort((a,b)=>dieIdx(b,ck.stat)-dieIdx(a,ck.stat))[0]}
  const rank=rankOf(P,ck.stat);const aLv=SK.lv(rank);
  let mode='skill';if(ck.mode==='inou'&&ck.stat==='능력'&&aLv>=3&&P.inj<2&&P.inou<2&&pol.inou!=='no')mode='inou';
  let partner=null,pt='alone';if(mode==='inou')pt='inou';else{partner=partnerFor(P,ck);if(partner){pt=(ck.stat==='통솔'&&bond(partner))?'bond':'mon'}}
  const q={rank,target,partner:pt,step:(+ck.step||0)+adj.stepAll,twice:+ck.twice||0,inj:P.inj,prideA:!!(partner&&prideA(partner)&&!bond(partner)),myosu:(ck.stat==='지시'&&(aLv===3?1:aLv>=4?2:0)-P.myosu>0)?1:0};
  /* AA 특권: 세션 1회, 목표 9 이하 이능은 굴리지 않고 성공 */
  let r;if(mode==='inou'&&aLv>=4&&!P.aa&&target<=9){P.aa=1;P.inou++;r={ri:3,res:'성공',aa:true,a:0,p:0,total:0,myosuUsed:0,stubborn:false}}else r=SK.roll(q,rng);
  if(r.myosuUsed)P.myosu++;if(mode==='inou')P.inou++;
  if(partner)P.tired.add(partner.id);
  const rec={room:room.id,label:ck.label,stat:ck.stat,target,who:P.trainer.name,rank,mode,partner:partner?partner.name:(pt==='inou'?'이능':'혼자'),pdie:r.pdie,die:r.die&&r.die.sides,a:r.a,p:r.p,total:r.total,ri0:r.ri,ri:r.ri,fumble:r.fumble,stubborn:r.stubborn,cover:'',pen:[]};
  /* 커버 */
  if(r.ri<=1&&pol.cover!=='never'||(r.ri===2&&pol.cover==='always')){const C=party.find(Q=>Q!==P&&Q.inj<2);if(C){rec.ri=Math.min(3,r.ri+1);rec.cover=C.trainer.name;C.stats.covers++;P.stats.covered++;injure(C,'커버',rec)}}
  /* 이능 실패 → 부상 (커버로 올라갔으면 반동 없음) */
  if(mode==='inou'&&rec.ri<=1)injure(P,'이능 반동',rec);
  P.stats.checks++;if(rec.ri>=3)P.stats.ok++;if(rec.ri===4)P.stats.crit++;if(rec.ri===2)P.stats.cost++;if(rec.ri<=1)P.stats.fail++;if(rec.ri===0)P.stats.fumble++;if(mode==='inou')P.stats.inouUsed++;
  /* 패널티 */
  const pen=ck.pen||{};if(rec.ri<=1&&pen.fail)applyPen(P,pen.fail,rec,'실패');if((rec.ri===2||r.stubborn)&&pen.cost)applyPen(P,pen.cost,rec,r.stubborn&&rec.ri!==2?'고집':'대가');
  say(Object.assign({k:'check'},rec));return rec};
 const injure=(P,why,rec)=>{P.inj=Math.min(2,P.inj+1);const m=aliveMons(P).sort((a,b)=>b.hp.cur-a.hp.cur)[0];let line=`${P.trainer.name} ${P.inj>=2?'중상':'부상'} (${why})`;if(m){const loss=frac(m.hp.max,P.inj>=2?'1/2':'1/4');m.hp.cur=Math.max(0,m.hp.cur-loss);line+=` · ${m.name} HP −${loss}`}rec.pen.push(line);say({k:'injury',who:P.trainer.name,inj:P.inj,why})};
 const applyPen=(P,sub,rec,why)=>{sub=sub||{};const L=[];const ms=aliveMons(P);const m=ms.length?ms[Math.floor(rng()*ms.length)]:null;
  if(sub.dmg&&m){let loss=frac(m.hp.max,sub.dmg);loss=Math.max(1,Math.floor(loss*adj.penScale));m.hp.cur=Math.max(0,m.hp.cur-loss);P.stats.penDmg+=loss;L.push(`${m.name} HP −${loss}`)}
  if(sub.st&&m&&m.hp.cur>0){m.states[sub.st]=sub.st==='Sleep'?2:sub.st==='Confusion'?3:1000;L.push(`${m.name} 「${sub.st}」`)}
  if(sub.rk){for(const k in sub.rk)P.debt.rk[k]=(P.debt.rk[k]||0)+(+sub.rk[k]||0);L.push('랭크 '+JSON.stringify(sub.rk))}
  if(+sub.oo)P.debt.oo+=+sub.oo;if(+sub.oc)P.debt.oc+=+sub.oc;if(+sub.oo||+sub.oc)L.push(`4식 −${+sub.oo||0} · 6령 −${+sub.oc||0} (다음 배틀)`);
  if(sub.memo)L.push(sub.memo);rec.pen.push(`[${why}] `+L.join(' · '))};
 /* 조우 */
 const doBattle=(room,enc)=>{const packs=WD.packs();const pk=packs[enc.pack];if(!pk)throw new Error('야생 무리 없음: '+enc.pack);const pk2=Object.assign({},pk,{lvAdd:(+pk.lvAdd||0)+(+adj.wildLv||0),mons:pk.mons.concat(Array.from({length:+adj.wildExtra||0},(_,i)=>pk.mons[i%pk.mons.length]))});const wild=WD.build(W,pk2);
  const parties=party.map(P=>{const t=clone(P.trainer);Object.assign(t,W.OM_ORDERS.auto(t,'assoc',1));const oc=t.orderCount||{};/* 체크 패널티의 4식 · 6령 차감 */let oo=P.debt.oo,oc2=P.debt.oc;for(const k of Object.keys(oc).sort()){if(k.startsWith('order_')&&oo>0&&oc[k]>0){oc[k]--;oo--}if(k.startsWith('command_')&&oc2>0&&oc[k]>0){oc[k]--;oc2--}}P.debt.oo=0;P.debt.oc=0;
   const mons=P.mons.filter(m=>m.hp.cur>0).map(m=>{const x=clone(m);x.rank=Object.assign({},P.debt.rk);return x});P.debt.rk={};return {trainer:t,mons}}).filter(p=>p.mons.length);
  if(!parties.length)return null;const fmt=Math.min(3,Math.max(1,parties.reduce((a,p)=>a+p.mons.length,0)>=3?3:2));
  const r=BT.runBattle(W,{left:{parties},right:wild,rng,format:fmt,maxTurns:30});
  /* 결과를 시트로 */for(const P of party)for(const m of P.mons){const x=r.left.find(y=>y.id===m.id);if(x){m.hp.cur=x.hp;m.states={};for(const k of x.states)if(['Poison','Toxic','Burn','Paralysis','Freeze','Sleep'].includes(k))m.states[k]=1000}}
  const used={order:0,command:0};for(const t of Object.values(r.trainers.left)){used.order+=t.used.order;used.command+=t.used.command}
  const rec={k:'battle',room:room.id,pack:enc.pack,boss:!!enc.boss,win:r.winner==='left',turns:r.turns,kos:r.kos.filter(k=>k.side==='left').length,wildKos:r.kos.filter(k=>k.side==='right').length,used,hpAfter:party.map(P=>P.mons.map(m=>+(m.hp.cur/m.hp.max).toFixed(2)))};say(rec);return rec};
 const doRest=(room,kind)=>{const R=REST[kind]||REST.breath;for(const P of party){for(const m of P.mons){if(m.hp.cur<=0){if(R.revive){m.hp.cur=R.hp==='full'?m.hp.max:1}else continue}else m.hp.cur=R.hp==='full'?m.hp.max:Math.min(m.hp.max,m.hp.cur+frac(m.hp.max,R.hp));if(R.cure)m.states={}}
   if(R.tired)P.tired.clear();if(R.inou)P.inou=0;if(R.care)P.care=0;P.inj=Math.max(0,P.inj-R.inj)}say({k:'rest',room:room.id,kind})};
 /* 돌봄(육성 B 이상, 휴식 사이 1회): 지친 포켓몬이 있고 쓸 수 있으면 체크 앞에서 */
 const care=()=>{for(const P of party){if(P.care)continue;if(SK.lv(rankOf(P,'육성'))<2)continue;const Q=party.find(Q=>Q.tired.size);if(!Q)break;const id=[...Q.tired][0];Q.tired.delete(id);P.care=1;say({k:'care',who:P.trainer.name,for:Q.trainer.name})}};

 let ci=0,wipe=false,boss=false,endRoom='';
 for(const rid of dg.path||dg.rooms.map(r=>r.id)){const room=dg.rooms.find(r=>r.id===rid);if(!room)continue;endRoom=rid;say({k:'room',room:rid,t:room.t,name:room.name});
  if(room.check){ci++;/* checkEvery 2 = 체크를 하나 걸러 하나만 (제시 횟수를 줄이는 실험) */if(adj.checkEvery<=1||ci%adj.checkEvery===1){care();doCheck(room,room.check)}}
  if(room.enc){const r=doBattle(room,room.enc);if(!r||!r.win){wipe=true;break}if(room.enc.boss)boss=true}
  if(room.rest)doRest(room,room.rest);
  if(!anyAlive()){wipe=true;break}}
 const checks=ev.filter(e=>e.k==='check'),battles=ev.filter(e=>e.k==='battle');
 const endHp=party.map(P=>P.mons.reduce((a,m)=>a+m.hp.cur/m.hp.max,0)/P.mons.length);
 return {dungeon:dg.id,wipe,boss,endRoom,rooms:ev.filter(e=>e.k==='room').length,
  checks:{n:checks.length,ok:checks.filter(c=>c.ri>=3).length,crit:checks.filter(c=>c.ri===4).length,cost:checks.filter(c=>c.ri===2).length,fail:checks.filter(c=>c.ri<=1).length,fumble:checks.filter(c=>c.ri===0).length,covers:checks.filter(c=>c.cover).length,inou:checks.filter(c=>c.mode==='inou').length,alone:checks.filter(c=>c.partner==='혼자').length},
  battles:{n:battles.length,won:battles.filter(b=>b.win).length,turns:battles.reduce((a,b)=>a+b.turns,0),kos:battles.reduce((a,b)=>a+b.kos,0),orders:battles.reduce((a,b)=>a+b.used.order,0),commands:battles.reduce((a,b)=>a+b.used.command,0)},
  injuries:party.map(P=>P.inj),injuryEvents:ev.filter(e=>e.k==='injury').length,tiredLeft:party.map(P=>P.tired.size),penDmg:party.reduce((a,P)=>a+P.stats.penDmg,0),
  endHp:endHp.map(x=>+x.toFixed(2)),endHpAvg:+(endHp.reduce((a,b)=>a+b,0)/endHp.length).toFixed(3),faintedEnd:party.reduce((a,P)=>a+P.mons.filter(m=>m.hp.cur<=0).length,0),monsTotal:party.reduce((a,P)=>a+P.mons.length,0),
  checkRows:checks.map(c=>({l:c.label,t:c.target,ri:c.ri,ri0:c.ri0,w:c.who,p:c.partner,m:c.mode,cv:c.cover?1:0})),
  party:party.map(P=>({name:P.trainer.name,ranks:P.trainer.ranks,stats:P.stats})),events:opt.events?ev:undefined}}
module.exports={dungeons,run,makeParty,REST,DIR};
