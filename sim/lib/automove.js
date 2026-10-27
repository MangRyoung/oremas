/* 기술이 비어 있는 포켓몬에게 「시험용 표준 기술」을 채운다 (10-27 무진 시험: 무진 각성체는 아직 기술을 안 정해 발버둥만 쓰게 됨).
   규칙(결정적 — 같은 포켓몬이면 늘 같은 기술):
     · 공격 ≥ 특공이면 물리, 아니면 특수.
     · 자기 타입마다 STAB 하나: 아래 STD 의 낯익은 표준 기술(위력 70~95, 1체). 없으면 위력 75~95 · 명중 90↑ · 단서 없는 기술 중 위력×명중이 큰 것.
     · 견제 하나: 자기 타입이 아닌 타입 중 18타입에 효과가 굉장한 칸이 가장 많은 타입의 같은 조건 기술.
     · 기술이 하나라도 있으면 그대로 둔다(제작기에 적힌 기술이 기준). m.autoMoves=true 로 표시해 기록에 남긴다. */
"use strict";
const BAD=/충전|반동|자신의.{0,12}(-|하락|낮아)|다음 턴|연속으로 사용할 수 없|사용할 수 없다|기절한다|자폭|HP.{0,6}절반|1턴째|2턴|공격할 수 없|랜덤|무작위|실패한다|조건/;
/* 타입마다 낯익은 표준 기술 (물리 후보 · 특수 후보, 앞에서부터 DB 에 있는 것) */
const STD={노말:[['은혜갚기','배틀하우스','몸통박치기'],['하이퍼보이스','스피드스타']],불꽃:[['불꽃펀치','불꽃엄니'],['화염방사','불꽃세례']],물:[['아쿠아테일','폭포오르기'],['파도타기','물의파동']],전기:[['번개펀치','번개엄니'],['10만볼트','방전']],풀:[['씨폭탄','리프블레이드'],['에너지볼','기가드레인']],얼음:[['냉동펀치','얼음엄니'],['냉동빔','얼다바람']],격투:[['드레인펀치','깨트리다','바위깨기'],['파동탄','진공파']],독:[['독찌르기','크로스포이즌'],['오물폭탄','오물웨이브']],땅:[['10만마력','땅고르기'],['대지의힘','진흙폭탄']],비행:[['회전부리','공중제비','제비반환'],['에어슬래시','에어컷터']],에스퍼:[['사념의박치기','사이코커터'],['사이코키네시스','사이코빔']],벌레:[['시저크로스','은빛바람'],['벌레의야단법석','시그널빔']],바위:[['스톤에지','원시의힘'],['파워젬','원시의힘']],고스트:[['섀도클로','섀도펀치'],['섀도볼','괴상한바람']],드래곤:[['드래곤클로','용의날개'],['용의파동','회오리']],악:[['깨물어부수기','속여때리기'],['악의파동','바크아웃']],강철:[['아이언헤드','메탈크로'],['러스터캐논','라스터캐논']],페어리:[['치근거리기','요정의바람'],['문포스','매지컬샤인']]};
let CACHE=null;
function pool(W){if(CACHE)return CACHE;const MV=W.OM_DB.moves||{};const L=[];
 for(const [k,m] of Object.entries(MV)){if(!m||!m.type||m.type==='-'||!/^(물리|특수)$/.test(m.cat))continue;const pow=+m.pow||0,acc=+m.acc||0;if(pow<75||pow>95||acc<90)continue;if(String(m.range||'')!=='1체')continue;if(+m.prio)continue;if(BAD.test(String(m.eff||'')+String(m.tag||'')))continue;if(/\(/.test(k))continue;
  L.push({name:m.name||k,type:m.type,typeEn:m.typeEn,cat:m.cat,score:pow*acc/100+(String(m.eff||'').length<2?3:0)})}
 L.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));CACHE=L;return L}
const TYPES=['노말','불꽃','물','전기','풀','얼음','격투','독','땅','비행','에스퍼','벌레','바위','고스트','드래곤','악','강철','페어리'];
function fill(W,m){const real=(m.moves||[]).filter(x=>x&&x.name&&x.name!=='발버둥');if(real.length)return false;
 const S=W.OM_STATS,st=m.stats||[];const cat=(+st[1]||0)>=(+st[3]||0)?'물리':'특수';const own=(m.typesKo||[]).filter(t=>t&&t!=='-');const P=pool(W);const pick=[];
 const MV=W.OM_DB.moves||{};const std=t=>{const L=(STD[t]||[[],[]])[cat==='물리'?0:1].concat((STD[t]||[[],[]])[cat==='물리'?1:0]);for(const n of L)if(MV[n])return {name:n,type:t};return P.find(x=>x.type===t&&x.cat===cat)||P.find(x=>x.type===t)};
 for(const t of own){const mv=std(t);if(mv&&!pick.some(p=>p.name===mv.name))pick.push(mv)}
 const cov=TYPES.filter(t=>!own.includes(t)).map(t=>{const en=S.typeEn(t);return [t,TYPES.filter(d=>S.effect(en,[S.typeEn(d)])>1).length]}).sort((a,b)=>b[1]-a[1]);
 for(const [t] of cov){const mv=std(t);if(mv){pick.push(mv);break}}
 if(!pick.length)return false;
 const doc={id:'auto',data:{name:m.name,t1:own[0]||'-',t2:own[1]||'-',base:[1,1,1,1,1,1],moves:pick.map(x=>({name:x.name})),pots:[]}};
 try{const tr=W.OM_IMPORT.trainer({id:'auto_t',data:{name:'auto',ranks:{육성:'C'},pids:[]}});const x=W.OM_IMPORT.pokemon(doc,tr);if(x.moves&&x.moves.length){m.moves=x.moves;m.autoMoves=true;return true}}catch(e){}
 return false}
module.exports={fill,pool};
