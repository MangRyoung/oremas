/* 기술이 비어 있는 포켓몬에게 「시험용 표준 기술」을 채운다 (10-27 무진 시험: 무진 각성체는 아직 기술을 안 정해 발버둥만 쓰게 됨).
   규칙(결정적 — 같은 포켓몬이면 늘 같은 기술):
     · 공격 ≥ 특공이면 물리, 아니면 특수.
     · 자기 타입마다 STAB 하나: 아래 STD 의 낯익은 표준 기술(위력 70~95, 1체). 없으면 위력 75~95 · 명중 90↑ · 단서 없는 기술 중 위력×명중이 큰 것.
     · 견제 하나: 자기 타입이 아닌 타입 중 18타입에 효과가 굉장한 칸이 가장 많은 타입의 같은 조건 기술.
     · 기술이 하나라도 있으면 그대로 둔다(제작기에 적힌 기술이 기준). m.autoMoves=true 로 표시해 기록에 남긴다.
   10-27 20시 (망령 「기술 최소 4개 · 변화기 1개는 있어야 한다는 제작 규칙」): 기술은 **4개 이상**, 그중 **변화기 1개**(역할형 · 타입에 맞는 것). 그리고 제작기 **기술 소켓 상한**(MKM_DB.sock: min(공격, 특공) 종족치 등급 행 × 종족치 합 열) 안에 들어가게 — 넘치면 소켓이 싼 기술로 바꾼다. sockInfo() 로 상한 · 사용량을 돌려준다. */
/* 변화기 은행 — [이름…] 앞에서부터 DB 에 있는 것. 역할(kind 추정)별 + 타입별 맛 */
const ST_ROLE={phys:['칼춤','용의춤','벌크업','고속이동'],spec:['나쁜음모','명상','고속이동'],bulk:['철벽','벌크업','명상','잠자기','아픔나누기'],any:['방어','울음소리','째려보기']};
const ST_TYPE={불꽃:['도깨비불'],전기:['전기자석파'],풀:['씨뿌리기','광합성'],독:['맹독','독가스'],고스트:['저주'],노말:['하품','속이기'],바위:['스텔스록'],비행:['순풍','날개쉬기'],에스퍼:['리플렉터','빛의장막','최면술'],얼음:['오로라베일'],물:['물놀이'],악:['도발'],벌레:['나비춤'],드래곤:['용의춤'],격투:['벌크업'],강철:['철벽'],땅:['모래뿌리기'],페어리:['빛의장막']};
"use strict";
const BAD=/충전|반동|자신의.{0,12}(-|하락|낮아)|다음 턴|연속으로 사용할 수 없|사용할 수 없다|기절한다|자폭|HP.{0,6}절반|1턴째|2턴|공격할 수 없|랜덤|무작위|실패한다|조건/;
/* 타입마다 낯익은 표준 기술 (물리 후보 · 특수 후보, 앞에서부터 DB 에 있는 것) */
const STD={노말:[['은혜갚기','배틀하우스','몸통박치기'],['하이퍼보이스','스피드스타']],불꽃:[['불꽃펀치','불꽃엄니'],['화염방사','불꽃세례']],물:[['아쿠아테일','폭포오르기'],['파도타기','물의파동']],전기:[['번개펀치','번개엄니'],['10만볼트','방전']],풀:[['씨폭탄','리프블레이드'],['에너지볼','기가드레인']],얼음:[['냉동펀치','얼음엄니'],['냉동빔','얼다바람']],격투:[['드레인펀치','깨트리다','바위깨기'],['파동탄','진공파']],독:[['독찌르기','크로스포이즌'],['오물폭탄','오물웨이브']],땅:[['10만마력','땅고르기'],['대지의힘','진흙폭탄']],비행:[['회전부리','공중제비','제비반환'],['에어슬래시','에어컷터']],에스퍼:[['사념의박치기','사이코커터'],['사이코키네시스','사이코빔']],벌레:[['시저크로스','은빛바람'],['벌레의야단법석','시그널빔']],바위:[['스톤에지','원시의힘'],['파워젬','원시의힘']],고스트:[['섀도클로','섀도펀치'],['섀도볼','괴상한바람']],드래곤:[['드래곤클로','용의날개'],['용의파동','회오리']],악:[['깨물어부수기','속여때리기'],['악의파동','바크아웃']],강철:[['아이언헤드','메탈크로'],['러스터캐논','라스터캐논']],페어리:[['치근거리기','요정의바람'],['문포스','매지컬샤인']]};
let CACHE=null,SCACHE=null;
/* 변화기 풀 (10-27 20시 망령 「변화기도 조금 다채롭게」): 기술 DB 의 변화기 전부를 효과로 분류 — pb 물리 강화 · sb 특수 강화 · bulk 내구/회복 · deb 상대 약화 · stat 상태 이상 · field 날씨/설치/벽. 소켓 1.5 이하 · 교체/아군/성별/자폭 의존은 뺀다 */
const SCAT={pb:/「(공격|스피드) : \+/,sb:/「특공 : \+/,bulk:/「(방어|특방) : \+|회복/,deb:/(상대|정면|대상).{0,30}「[^」]+ : -/,stat:/「(독|맹독|마비|화상|잠듦|혼란|얼음)」 상태로/,field:/날씨|필드|설치|리플렉터|빛의장막/};
const SBAD=/교체|교대|아군|성별|이성|자신.{0,10}(빈사|기절)|자폭|HP.{0,6}절반.{0,6}(소비|잃)|다음 턴|충전|조건부|포텐셜|레이드/;
function statusPool(W){if(SCACHE)return SCACHE;const MV=W.OM_DB.moves||{};const L=[];for(const [k,m] of Object.entries(MV)){if(!m||m.cat!=='변화'||/\(/.test(k))continue;const sock=m.sock!==''&&!isNaN(+m.sock)?+m.sock:3;if(sock>1.5)continue;const d=String(m.eff||'');if(SBAD.test(d))continue;const cats=Object.keys(SCAT).filter(c=>SCAT[c].test(d));if(!cats.length)continue;L.push({name:m.name||k,type:m.type,cats,sock})}SCACHE=L;return L}
const SROLE={phys:['pb','stat','deb','field'],spec:['sb','stat','deb','field'],bulk:['bulk','stat','field','deb']};
function pool(W){if(CACHE)return CACHE;const MV=W.OM_DB.moves||{};const L=[];
 for(const [k,m] of Object.entries(MV)){if(!m||!m.type||m.type==='-'||!/^(물리|특수)$/.test(m.cat))continue;const pow=+m.pow||0,acc=+m.acc||0;if(pow<60||pow>120||acc<85)continue;if(pow>=110&&acc<100)continue;/* 고위력은 필중급만 */if(String(m.range||'')!=='1체')continue;if(+m.prio)continue;if(BAD.test(String(m.eff||'')+String(m.tag||'')))continue;if(/\(/.test(k))continue;
  const tags=(m.tags||[]).join(' ');if(/다이맥스|전용|Z기술/.test(tags))continue;L.push({name:m.name||k,type:m.type,typeEn:m.typeEn,cat:m.cat,pow,orig:/#오리지널/.test(tags),sock:m.sock!==''&&!isNaN(+m.sock)?+m.sock:3,score:Math.min(pow,100)*acc/100+(String(m.eff||'').length<2?3:0)-(+(m.sock)>=2.5?10:0)})}
 L.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));CACHE=L;return L}
const TYPES=['노말','불꽃','물','전기','풀','얼음','격투','독','땅','비행','에스퍼','벌레','바위','고스트','드래곤','악','강철','페어리'];
/* 기술 구성 계획 (10-27 20시 망령 「어태커는 변화기 1~2개, 서포터는 공격기를 하나씩 챙긴 이후엔 변화기」)
   kindHint(야생 DB 의 역할형)가 있으면 그걸로, 없으면 스탯으로 추정. 해시로 두 계획 중 하나 → 몬마다 조금씩 다르다.
     어태커(물리 · 특수 스위퍼 · 쌍두) : 공격 3 + 변화 1 (70%) / 공격 2 + 변화 2 (30%)
     서포터(물리 탱커 · 특수 벽)        : 공격 2 + 변화 2 (60%) / 공격 1 + 변화 3 (40%)
     밸런스                            : 공격 2 + 변화 2 (60%) / 공격 3 + 변화 1 (40%)
   공격기 = 첫 타입 자속(반드시) → 둘째 타입 자속 → 견제. 후보는 「표준 기술(STD)」 7 : 「풀(실기 · 1체 · 단서 없음)」 3 의 비중으로 뽑아 매번 같은 기술만 보이지 않게. #오리지널 · 『올드 타입』 전용 · 다이맥스 기술은 풀에서 뺀다. */
const PLAN={attacker:[[3,1],[3,1],[3,1],[3,1],[3,1],[3,1],[3,1],[2,2],[2,2],[2,2]],support:[[2,2],[2,2],[2,2],[2,2],[2,2],[2,2],[1,3],[1,3],[1,3],[1,3]],balance:[[2,2],[2,2],[2,2],[2,2],[2,2],[2,2],[3,1],[3,1],[3,1],[3,1]]};
function fill(W,m){const real=(m.moves||[]).filter(x=>x&&x.name&&x.name!=='발버둥');if(real.length)return false;
 const S=W.OM_STATS,st=m.stats||[];const cat=(+st[1]||0)>=(+st[3]||0)?'물리':'특수';const own=(m.typesKo||[]).filter(t=>t&&t!=='-');const P=pool(W);const MV=W.OM_DB.moves||{};
 let h=0;for(const ch of String(m.name||''))h=(h*31+ch.charCodeAt(0))>>>0;const H=(k)=>((h>>>(k%24))^(h*(k+1)))>>>0;
 /* 역할 */const kind=m.kindHint||'';const bulky=Math.min(+st[2]||0,+st[4]||0)>=(+st[1]||0)*0.9&&Math.min(+st[2]||0,+st[4]||0)>=(+st[3]||0)*0.9;
 const group=/스위퍼|쌍두/.test(kind)?'attacker':/탱커|벽/.test(kind)?'support':kind==='밸런스'?'balance':bulky?'support':'attacker';const role=bulky&&group!=='attacker'?'bulk':cat==='물리'?'phys':'spec';
 const [nAtk,nSt]=PLAN[group][H(1)%10];const cat2=m.dualHint||/쌍두/.test(kind)?(cat==='물리'?'특수':'물리'):cat;
 /* 공격기 후보 · 선택 */
 const atkPick=(t,c,slot)=>{const stdL=(STD[t]||[[],[]])[c==='물리'?0:1].filter(n=>MV[n]&&!pick.some(p=>p.name===n)).map(n=>({name:n,type:t,cat:c,sock:+(MV[n].sock)||3,std:true}));
  const poolL=P.filter(x=>x.type===t&&x.cat===c&&!x.orig&&!pick.some(p=>p.name===x.name)).slice(0,6);
  const useStd=stdL.length&&(H(slot)%10<7||!poolL.length);const C=useStd?stdL:poolL.length?poolL:stdL;if(!C.length)return null;return C[H(slot+40)%C.length]};
 const pick=[];
 own.forEach((t,i)=>{if(pick.length<nAtk){const mv=atkPick(t,i===0?cat:cat2,10+i);if(mv)pick.push(mv)}});
 const cov=TYPES.filter(t=>!own.includes(t)).map(t=>{const en=S.typeEn(t);return [t,TYPES.filter(d=>S.effect(en,[S.typeEn(d)])>1).length]}).sort((a,b)=>b[1]-a[1]).slice(0,6);
 for(let k=0;k<cov.length&&pick.length<nAtk;k++){const [t]=cov[(H(20)+k*2)%cov.length];const mv=atkPick(t,own.length>=2?cat:cat2,30+k);if(mv)pick.push(mv)}
 /* 변화기 후보 · 선택 (서로 다른 분류를 우선) */
 const SP=statusPool(W);const want=SROLE[role];const stdNames=new Set(ST_ROLE[role].concat(own.flatMap(t=>ST_TYPE[t]||[])));
 const scored=SP.map(x=>{let v=0;if(own.includes(x.type))v+=2;const ci=x.cats.findIndex(c=>want.includes(c));if(ci>=0)v+=2+(want.indexOf(x.cats[ci])===0?1.5:0);if(stdNames.has(x.name))v+=1.5;if(x.sock<=1)v+=0.5;if(x.type==='노말'&&!own.includes('노말'))v-=0.3;if(!own.includes(x.type)&&!['노말','에스퍼','격투','악'].includes(x.type))v-=1.5;/* 남의 속성 변화기(요정 키스 · 물놀이 …)는 뒤로 */return {x,v}}).filter(o=>o.v>=2).sort((a,b)=>b.v-a.v);
 const usedCat=new Set();for(let k=0;k<nSt;k++){const C=scored.filter(o=>!pick.some(p=>p.name===o.x.name)&&!o.x.cats.some(c=>usedCat.has(c))).slice(0,8);const C2=C.length?C:scored.filter(o=>!pick.some(p=>p.name===o.x.name)).slice(0,8);if(!C2.length)break;const o=C2[H(50+k)%C2.length];pick.push({name:o.x.name,type:o.x.type,status:true,sock:o.x.sock});o.x.cats.forEach(c=>usedCat.add(c))}
 /* 4개 보장 · 변화기 1개 보장 */
 if(!pick.some(p=>p.status)&&scored.length){const o=scored[H(60)%Math.min(8,scored.length)];pick.push({name:o.x.name,type:o.x.type,status:true,sock:o.x.sock})}
 for(let k=0;k<cov.length&&pick.length<4;k++){const [t]=cov[(H(70)+k)%cov.length];const mv=atkPick(t,cat,80+k);if(mv)pick.push(mv)}
 while(pick.length<4){const o=scored.find(o=>!pick.some(p=>p.name===o.x.name));if(!o)break;pick.push({name:o.x.name,type:o.x.type,status:true,sock:o.x.sock})}
 if(!pick.length)return false;
 /* 소켓 상한: 넘치면 소켓 비싼 것부터 같은 타입 · 범주의 싼 기술로 */
 const cap=sockCap(W,m);const sockOf=n=>{const r=MV[n];return r&&r.sock!==''&&!isNaN(+r.sock)?+r.sock:3};
 for(let guard=0;guard<8&&cap!=null&&pick.reduce((a,p)=>a+sockOf(p.name),0)>cap;guard++){const i=pick.map((p,i)=>[sockOf(p.name),i]).sort((a,b)=>b[0]-a[0])[0][1];const cur=pick[i];const t=cur.type||(MV[cur.name]||{}).type;
  let alt=null;if(cur.status)alt=scored.map(o=>o.x).find(x=>x.sock<sockOf(cur.name)&&!pick.some(p=>p.name===x.name));else alt=P.filter(x=>x.type===t&&x.cat===(MV[cur.name]||{}).cat&&sockOf(x.name)<sockOf(cur.name)&&!pick.some(p=>p.name===x.name)).sort((a,b)=>sockOf(a.name)-sockOf(b.name)||b.score-a.score)[0];
  if(!alt){pick.splice(i,1);if(pick.length<4)break;continue}pick[i]=Object.assign({},alt,{status:cur.status})}
 const doc={id:'auto',data:{name:m.name,t1:own[0]||'-',t2:own[1]||'-',base:[1,1,1,1,1,1],moves:pick.map(x=>({name:x.name})),pots:[]}};
 try{const tr=W.OM_IMPORT.trainer({id:'auto_t',data:{name:'auto',ranks:{육성:'C'},pids:[]}});const x=W.OM_IMPORT.pokemon(doc,tr);if(x.moves&&x.moves.length){m.moves=x.moves;m.autoMoves=true;m.movePlan={group,nAtk,nSt};return true}}catch(e){}
 return false}
/* 제작기 기술 소켓 상한 — MKM_DB.sock 행: [등급, <525, 525~569, ≥570, …]. 등급 = min(공격, 특공) 종족치의 등급(+/- 뗀 것). 종족치를 모르면 null */
function sockCap(W,m){const b=m.base||[];if(b.length<6||!b.every(x=>+x>0))return null;const T=((W.OM_DB.maker||{}).sock)||[];if(!T.length)return null;const S=W.OM_STATS;const g=v=>String(S.gradeOf(+v)||'').replace(/[+-]/g,'');
 const gs=T.map(r=>r[0]);const gi=x=>{const i=gs.indexOf(x==='EX'?'S':x);return i<0?99:i};const i=Math.min(gi(g(b[1])),gi(g(b[3])));if(i===99)return null;const tot=b.reduce((a,c)=>a+(+c||0),0);const v=+T[i][tot>=570?3:tot>=525?2:1];return isNaN(v)?null:v}
function sockInfo(W,m){const MV=W.OM_DB.moves||{};const sockOf=n=>{const r=MV[n];return r&&r.sock!==''&&!isNaN(+r.sock)?+r.sock:3};const L=(m.moves||[]).map(x=>typeof x==='string'?x:x.name).filter(Boolean);
 return {cap:sockCap(W,m),used:+L.reduce((a,n)=>a+sockOf(n),0).toFixed(1),n:L.length,status:L.filter(n=>(MV[n]||{}).cat==='변화').length,socks:L.map(n=>[n,sockOf(n)])}}
module.exports={fill,pool,sockCap,sockInfo};
