/* 소지품 자동 착용 (11-02 망령 「소지품 착용 시키고 … 넣어서 테스트 해봐」)
   시험 일행(객원)의 포켓몬 대부분이 소지품이 비어 있다 → 시뮬에서만 빈 칸에 소지품을 쥐여 준다. 이미 든 소지품은 그대로.
   기준 = 배틀 진행 지침 1-6 「소지품을 내가 고를 때」: 밴 목록 빼기 · 역할에 맞추기(에이스 · 어태커 = 화력, 블로커 = 버티기, 러너 = 열매) · 같은 소지품은 한 파티에 하나만.
   소켓: 2체 기준(룰북 「1인 기준 (2체)」 소지품 소켓 = 지시 D 2.5 · C 3 · B 3.5 · A 4 · AA 4.5) 안에서. 넘치면 싼 것으로 내린다.
   구문(auto)이 있는 소지품만 쓴다 — 시뮬 엔진이 효과를 걸 수 있는 것. */
"use strict";
const BAN=new Set(['구애스카프','생명의구슬','구애머리띠','구애안경','흉내허브']);
const SOCK2={D:2.5,C:3,B:3.5,A:4,AA:4.5};
const BOOST={노말:null,불꽃:'목탄',물:'신비의물방울',풀:'기적의씨',전기:'자석',얼음:'녹지않는얼음',격투:'검은띠',독:'독바늘',땅:'부드러운모래',비행:'예리한부리',에스퍼:'휘어진스푼',벌레:'은빛가루',바위:'딱딱한돌',고스트:null,드래곤:'용의이빨',악:'검은안경',강철:'금속코트',페어리:'요정의깃털'};
const rankKey=v=>{const s=String(v||'').toUpperCase();return s.startsWith('AA')?'AA':s.startsWith('A')?'A':s.startsWith('B')?'B':s.startsWith('C')?'C':'D'};
/* 이 포켓몬이 가장 세게 치는 기술 타입 (자속 1.5 · 위력 · 공격/특공 종족값) */
function mainType(m){const b=(m.base||[]).map(Number);const tk=(m.typesKo||[]).filter(t=>t&&t!=='-');let best=null,bv=-1;
 for(const mv of m.moves||[]){if(!mv||!(+mv.pow>0)||mv.cat==='변화')continue;const st=mv.cat==='특수'?b[3]:b[1];const v=+mv.pow*(tk.includes(mv.type)?1.5:1)*(st||80);if(v>bv){bv=v;best=mv.type}}return best||tk[0]||null}
function roleOf(m){const r=String(m.role||'');const b=(m.base||[]).map(Number);const atk=Math.max(b[1]||0,b[3]||0),bulk=(b[0]||0)+(b[2]||0)+(b[4]||0);
 if(/블로커|어시스트|서포터/.test(r))return 'wall';if(/러너/.test(r))return 'runner';if(/에이스|어태커|킬러/.test(r))return 'atk';
 if(atk>=100||atk>=bulk/3+10)return 'atk';if(bulk>=290)return 'wall';return 'atk'}
function choices(m,role,DBI){const L=[];const T=mainType(m);const bo=T&&BOOST[T];
 if(role==='atk'){if(bo)L.push(bo);L.push('자뭉열매','하양허브')}
 else if(role==='wall'){L.push('자뭉열매','먹다남은음식','울퉁불퉁멧','하양허브');if(bo)L.push(bo)}
 else{L.push('자뭉열매');if(bo)L.push(bo);L.push('하양허브')}
 return L.filter(n=>DBI[n]&&DBI[n].auto&&!BAN.has(n))}
/* r = P.build 결과 {trainer, mons}. 빈 칸만 채운다. 돌려주는 값 = [{mon, item, why}] */
function equip(win,r){const DBI=((win.OM_DB||{}).items)||{};const t=r.trainer;const cap=SOCK2[rankKey((t.ranks||{})['지시'])]||3;
 const used=new Set(r.mons.map(m=>m.item).filter(Boolean));let spent=r.mons.reduce((a,m)=>a+(m.item&&DBI[m.item]?+DBI[m.item].sock||0:0),0);const out=[];
 const order=r.mons.filter(m=>!m.item).map(m=>({m,role:roleOf(m)})).sort((a,b)=>(a.role==='atk'?0:1)-(b.role==='atk'?0:1));
 order.forEach(({m,role},i)=>{const left=order.length-i-1;const keep=left*1;   /* 뒤에 남은 포켓몬 몫으로 1소켓씩은 남겨 둔다 */
  const c=choices(m,role,DBI).find(n=>!used.has(n)&&spent+(+DBI[n].sock||0)<=cap-keep+1e-9);if(!c)return;
  m.item=c;m.itemEff=String(DBI[c].eff||'').replace(/<br\s*\/?>/g,'\n');m.itemAuto=1;used.add(c);spent+=+DBI[c].sock||0;out.push({mon:m.name,item:c,why:role})});
 t.autoItems=out;t.itemSock={cap,spent};return out}
/* 11-04 망령 「2체일 땐 2체 소지품 TO 중에서 장착하고 다 같이 합쳐야지」: 던전 일행 = 한 파티.
   소켓 상한 = 트레이너마다 1인 기준(2체) 상한을 더한 값, 같은 소지품은 일행 전체에서 하나만.
   equip 은 트레이너마다 따로 채우므로, 일행이 모인 뒤 여기서 겹친 것 · 넘친 것을 다시 맞춘다.
   겹치면 뒤의 포켓몬을 다른 것으로(없으면 뗀다), 넘치면 자동으로 채운 것부터 뗀다. parties = makeParty 결과(트레이너 · 동행) */
function pool(win,parties){const DBI=((win.OM_DB||{}).items)||{};const sk=n=>(n&&DBI[n]?+DBI[n].sock||0:0);
 const cap=parties.reduce((a,p)=>a+(SOCK2[rankKey(((p.trainer||{}).ranks||{})['지시'])]||3),0);const used=new Set();const log=[];let spent=0;
 const all=[];parties.forEach(p=>p.mons.forEach(m=>all.push({p,m})));
 for(const {p,m} of all){const it=m.item;if(!it)continue;
  if(used.has(it)){const alt=choices(m,roleOf(m),DBI).find(n=>!used.has(n));const was=it;if(alt){m.item=alt;m.itemEff=String(DBI[alt].eff||'').replace(/<br\s*\/?>/g,'\n');m.itemAuto=1;log.push(`${m.name}: ${was} 겹침 → ${alt}`)}else{m.item='';m.itemEff='';log.push(`${m.name}: ${was} 겹침 → 뗌`)}}
  if(m.item){used.add(m.item);spent+=sk(m.item)}}
 /* 넘치면 자동으로 채운 것 중 소켓이 큰 것부터 뗀다 */
 const auto=all.filter(x=>x.m.item&&x.m.itemAuto).sort((a,b)=>sk(b.m.item)-sk(a.m.item));
 for(const {m} of auto){if(spent<=cap+1e-9)break;spent-=sk(m.item);log.push(`${m.name}: ${m.item} 뗌 (일행 소켓 넘침)`);m.item='';m.itemEff=''}
 const r={cap,spent:Math.round(spent*10)/10,over:spent>cap+1e-9,log};parties.forEach(p=>{p.trainer.partySock=r});return r}
module.exports={equip,pool,roleOf,mainType,SOCK2,BAN};
