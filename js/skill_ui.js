/* ---------- 스킬 체크 v4 (10-29 망령 「다 뜯어 고치자」 · 룰북 「스킬 체크」 장) ----------
   판정: 2d6 + 트레이너 자질(D 0 · C 1 · B 2 · A 3 · AA 4) + 포켓몬 종족값 랭크(59 이하 0 · 60 1 · 90 2 · 110 3 · 140 4) + 적합(최대 +3) ± 상황 ≥ 목표치.
   목표치 쉬움 8 · 보통 10 · 어려움 12 · 매우 어려움 15. 결과 실패 · 성공 · 대성공(6·6 또는 목표 + cfg.crit). 1·1 은 언제나 실패.
   보정은 ± 숫자와 두 번 굴리기(2d6 을 두 번, 합이 높은/낮은 쪽)만. 대결 판정: 상대도 2d6 + 보정, 동점은 막는 쪽.
   포켓몬: RP 장면 = 동행(트레이너마다 1체, 통솔 A 이상 2체) · 던전 · 배틀 = 필드(배틀 중이면 에리어에 나온 포켓몬, 아니면 지정한 cfg.fieldMax 체). 없으면 혼자.
   적합: GM 이 제시한 타입 +1 · 기술 또는 특성 +1 · 기타(GM 인정) +1.
   실패: 판정한 트레이너 상태 한 단계 (건강 → 부상(될 때 6령 1 소실 · 판정 −1) → 중상(될 때 4식 1 소실 · 판정 불리) → 빈사(장면 참가 불가, 장면 끝에 중상)).
         포켓몬과 굴렸으면 그 포켓몬이 GM 의 패널티 묶음도 받는다.
   커버: 판정하지 않은 동행 · 필드 포켓몬(cfg.coverBall 이면 볼 안도)이 최대 HP cfg.coverHp 대미지를 받고 그 한 단계를 없던 일로. 패널티 묶음은 못 막는다.
   특화(자질 A 이상): 지시 묘수(실패 뒤 다시 굴리기, 세션 A 1 · AA 2) · 육성 강인함(부상 −1 무시) · 통솔 동행 2체 · 능력 초상 능력(혼자 2d6 + 자질×2, 휴식 사이 A 1 · AA 2).
   휴식: 상태 단계 회복 긴 2 · 중간 · 짧은 1 · 숨돌리기 0. 덱 연동: 설정의 「상태 카드」를 그 트레이너 손패에 붙인다 (GM 화면이 sync).
   상태: state.skill = {cfg, rest:{long,mid,short,breath}, presets:[], penPresets:[], offer, trainers:{tid:{myosu,sup,inj 0~3,comp:[mid]}}, res:{tid:{...}}, hist:[]} */
"use strict";
window.OM_SKILL_UI=(()=>{
 const A=()=>window.OM_APP, S=()=>window.OM_STATS, DB=()=>window.OM_DB||{};
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const $=(s,r)=>(r||document).querySelector(s);
 const SK=['지시','육성','통솔','능력'];
 const BASE=['HP','공격','방어','특공','특방','스피드'];
 const BASE_HINT=['꾸준히 하는 지구력','물리적인 파괴력','물리적인 방어력','계산력 · 지능','정신력 · 멘탈리티','순간의 민첩성'];
 const BASE_OF={지시:3,육성:1,통솔:4,능력:3};   /* 예전 제시(종족값 없음)를 열 때 기본 짝 */
 const DIFF=[[8,'쉬움'],[10,'보통'],[12,'어려움'],[15,'매우 어려움']];
 const TIER={easy:8,normal:10,hard:12,vhard:15};
 const NPC=[[0,'없음'],[1,'일반인',0],[2,'일반 트레이너',2],[3,'숙련 트레이너',4],[4,'『두목』',6],[9,'직접',null]];
 const LAD={E:0,D:0,C:1,B:2,A:3,AA:4,AAA:4,S:4};const RKN=['D','C','B','A','AA'];
 const TYPES=['노말','불꽃','물','전기','풀','얼음','격투','독','땅','비행','에스퍼','벌레','바위','고스트','드래곤','악','강철','페어리'];
 /* 결과 칸: 예전 다섯 칸 번호를 그대로 쓴다 (mecard · rp_ui 가 ri 로 색을 고른다) — 1 실패 · 3 성공 · 4 대성공 */
 const RES=['실패','실패','성공','성공','대성공'];const COL=['#7a1020','#8a1c2b','#1f7a4a','#1f7a4a','#1a6ad8'];
 const STEP=['건강','부상','중상','빈사'];const STEPC=['#1f7a4a','#8a6a12','#8a1c2b','#3a0a12'];
 const RK=[['attack','공격'],['defense','방어'],['specialattack','특공'],['specialdefense','특방'],['speed','스피드'],['accuracy','명중'],['evasion','회피'],['critical','급소']];
 const CFG0={crit:4,injPen:1,injOc:1,injOo:1,coverHp:'1/4',coverBall:0,fieldMax:1,myosuA:1,myosuAA:2,supA:1,supAA:2,penAuto:1,cards:{deck:'',c1:'',c2:'',c3:''}};
 const KINDS=[['long','긴 휴식','대대적'],['mid','중간 휴식','반쯤'],['short','짧은 휴식','상담함'],['breath','숨돌리기','가벼움']];   /* 10-28 망령: 중간 휴식 추가 */
 /* inou = 초상 능력 횟수 회복 · inj_n = 상태 단계 회복 (10-29 망령: 긴 2 · 중간 · 짧은 1 · 숨돌리기 0) */
 const REST0={long:{hp:'full',revive:1,revive_hp:'full',cure_ab:1,cure_sp:1,pot_pk_n:'all',ord_n:'all',pot_tr_n:'all',inou:1,inj_n:2,swap:1,key_n:'all'},
  /* 10-28 망령 「짧은 휴식이 저 정도고 긴 휴식이 전부면 중간 휴식은 적절하게」 — 전원 HP 1/2 · 빈사는 HP 1/4 · 상태 회복 · 파티 4식 2 · 6령 3 · 포텐셜 1씩 */
  mid:{hp:'1/2',hp_one:0,revive:1,revive_hp:'1/4',cure_ab:1,cure_sp:1,pot_pk_n:'1',ord_n:'0',ord_po:2,ord_pc:3,pot_tr_n:'1',inou:1,inj_n:1,swap:1,key_n:'1'},
  /* 10-28 망령(시뮬 맞춤): 짧은 휴식 = 전원 HP 1/4 · 빈사는 HP 1 · 상태 회복 · 파티 전체 4식 1 · 6령 1 */
  short:{hp:'1/4',hp_one:0,revive:1,revive_hp:'1',cure_ab:1,cure_sp:1,pot_pk_n:'0',ord_n:'0',ord_po:1,ord_pc:1,pot_tr_n:'0',inou:1,inj_n:1,swap:1,key_n:'0'},
  /* 10-28 22시 망령: 숨돌리기 = 가장 다친 1체 HP 1/4 + 파티 6령 1 */
  breath:{hp:'1/4',hp_one:1,revive:0,revive_hp:'1',cure_ab:0,cure_sp:0,pot_pk_n:'0',ord_n:'0',ord_po:0,ord_pc:1,pot_tr_n:'0',inou:0,inj_n:0,swap:0,key_n:'0'}};
 /* 체크 제시 예시 (자주 쓰는 모양). 「저장」으로 내 것을 더할 수 있다 */
 const EX=[
  {name:'고대 문자 해독 (지시 + 특공 · 어려움 12)',o:{v:4,label:'고대 문자를 해독한다',stat:'지시',base:3,target:12,fit:{types:['에스퍼'],moves:['사이코키네시스'],abil:[]}}},
  {name:'설득 · 교섭 (통솔 + 특방 · 보통 10)',o:{v:4,label:'설득 · 교섭',stat:'통솔',base:4,target:10,fit:{types:['페어리'],moves:[],abil:[]}}},
  {name:'기로 누르기 (통솔 + 공격 · 대결)',o:{v:4,label:'깡패 트레이너를 기로 누른다',stat:'통솔',base:1,target:10,npc:2,fit:{types:['악'],moves:[],abil:['위협']}}},
  {name:'추격대 따돌리기 (육성 + 스피드 · 보통 10)',o:{v:4,label:'추격대를 따돌린다',stat:'육성',base:5,target:10,fit:{types:['비행'],moves:['고속이동'],abil:[]}}},
  {name:'무너지는 바위 받치기 (육성 + 방어 · 어려움 12)',o:{v:4,label:'무너지는 바위를 받친다',stat:'육성',base:2,target:12,fit:{types:['바위'],moves:['철벽'],abil:[]},pen:{fail:{dmg:'1/4',memo:'바위에 깔린다'}}}},
  {name:'밤새 입구 지키기 (육성 + HP · 보통 10)',o:{v:4,label:'밤새 입구를 지킨다',stat:'육성',base:0,target:10,fit:{types:['노말'],moves:['잠자기'],abil:[]}}},
  {name:'잠입 (지시 + 스피드 · 어려움 12 · 불리)',o:{v:4,label:'들키지 않고 잠입',stat:'지시',base:5,target:12,pm:-1,fit:{types:['고스트','악'],moves:[],abil:[]},pen:{fail:{al:10,memo:'경계 강화'}}}},
  {name:'철문 비틀기 (능력 + 공격 · 어려움 12)',o:{v:4,label:'잠긴 철문을 비튼다',stat:'능력',base:1,target:12,fit:{types:['격투'],moves:['바위깨기'],abil:[]}}}];
 /* 10-24 망령: 패널티 예시 (자주 쓰는 묶음) */
 const PEN_EX=[
  {name:'반동 — 대미지 1/4',p:{dmg:'1/4',memo:'반동으로 휘말린다'}},
  {name:'가벼운 반동 — 대미지 1/8',p:{dmg:'1/8'}},
  {name:'큰 부상 — 대미지 1/2',p:{dmg:'1/2',memo:'크게 다쳤다'}},
  {name:'독에 노출',p:{st:'Poison',memo:'독 안개를 들이마셨다'}},
  {name:'화상',p:{st:'Burn'}},
  {name:'혼란',p:{st:'Confusion',cnt:3,memo:'정신이 아득해진다'}},
  {name:'잠듦 (지쳐 쓰러짐)',p:{st:'Sleep'}},
  {name:'기세가 꺾임 — 공격 · 특공 −1',p:{rk:{attack:-1,specialattack:-1}}},
  {name:'발이 묶임 — 스피드 −1',p:{rk:{speed:-1}}},
  {name:'고유 포텐셜 1회 소모',p:{pot:{who:'tr',name:'',n:1}}},
  {name:'경계 강화 (경계도 +10)',p:{al:10,memo:'경계 강화'}},
  {name:'흔적을 남김 (서술)',p:{memo:'흔적을 남겼다 — 추적당할 수 있다'}},
  {name:'시간 지체 (서술)',p:{memo:'시간이 지체된다 — 다음 장면이 한 시간대 늦어진다'}}];
 const d6=()=>1+Math.floor(Math.random()*6);
 const st=()=>A().ST.state.skill||{};
 const cfg=()=>{const c=Object.assign({},CFG0,st().cfg||{});c.cards=Object.assign({},CFG0.cards,c.cards||{});return c};
 const restCfg=k=>Object.assign({},REST0[k]||REST0.long,((st().rest||{})[k])||{});
 const trs=()=>Object.assign({},(A().ST.state.roster||{}).trainers||{});
 const mons=()=>(A().ST.state.roster||{}).mons||{};
 const bmons=()=>((A().ST.state.battle||{}).mons)||{};
 const tsk=tid=>{const x=Object.assign({myosu:0,sup:0,inj:0,comp:[],swap:0},(st().trainers||{})[tid]||{});x.inj=Math.max(0,Math.min(3,+x.inj||0));if(!Array.isArray(x.comp))x.comp=[];x.tired=[];return x};
 const rankOf=(t,stat)=>String(((t||{}).ranks||{})[stat]||'').trim();
 const qLv=(t,stat)=>LAD[S().strip(rankOf(t,stat))]??0;
 const baseLv=v=>{v=+v||0;return v>=140?4:v>=110?3:v>=90?2:v>=60?1:0};
 const baseVal=(m,i)=>+((m&&m.base)||[])[i]||0;
 const gm=()=>A().ST.role==='gm';
 const me=()=>A().ST.seat;
 const myosuMax=t=>{const l=qLv(t,'지시');return l>=4?+cfg().myosuAA:l>=3?+cfg().myosuA:0};
 const supMax=t=>{const l=qLv(t,'능력');return l>=4?+cfg().supAA:l>=3?+cfg().supA:0};
 const tough=t=>qLv(t,'육성')>=3;
 const sgn=n=>(n>=0?'+':'−')+Math.abs(n);
 const av=(img,txt,cls)=>`<i class="skav ${cls||''}" style="${img?`background-image:url('${cssu(img)}')`:''}">${img?'':esc([...String(txt||'?')][0]||'?')}</i>`;
 const tyCol=ko=>{try{return S().typeColor(S().typeEn(ko))}catch(e){return {bg:'#2d3244',fg:'#e8e4da'}}};
 const tyChip=ko=>{const c=tyCol(ko);return `<span class="type" style="background:${c.bg};color:${c.fg}">${esc(ko)}</span>`};
 const stepTxt=n=>STEP[Math.max(0,Math.min(3,+n||0))];
 const frac=(v,s)=>{s=String(s==null?'':s).trim();if(s==='full')return v;const m=s.match(/^(\d+)\s*\/\s*(\d+)$/);return m?Math.max(1,Math.floor(v*+m[1]/+m[2])):Math.max(0,Math.floor(+s||0))};
 const sdb=()=>((DB().states||{}).st)||{};
 const stKo=k=>(sdb()[k]||{}).ko||k;
 const stList=()=>Object.keys(sdb()).filter(k=>k!=='Dead').map(k=>[k,sdb()[k].ko||k,!!sdb()[k].abn]);
 /* 바뀐 칸만 쓴다 (점검 3-18) — 통째로 쓰면 그 사이 남이 바꾼 칸이 지워진다. 처음이면 통째로 */
 async function setT(tid,patch){const had=!!(st().trainers||{})[tid];const cur=tsk(tid);delete cur.tired;const before=JSON.parse(JSON.stringify(cur));const n=Object.assign(cur,patch);if(had)await A().setDiff(['skill','trainers',tid],before,n,1);else await A().set(['skill','trainers',tid],n);return n}
 /* 로스터 포켓몬을 고치고 배틀 쪽도 맞춘다 */
 async function putMon(mid,fn){const m=JSON.parse(JSON.stringify(mons()[mid]||null));if(!m)return null;const nm=JSON.parse(JSON.stringify(m));fn(nm,false);await A().setDiff(['roster','mons',mid],m,nm,1);const bm=JSON.parse(JSON.stringify(bmons()[mid]||null));if(bm){const nb=JSON.parse(JSON.stringify(bm));fn(nb,true);await A().setDiff(['battle','mons',mid],bm,nb,1)}return nm}
 /* 10-26: 시트(로스터) 포켓몬의 지금 HP · 상태는 sheetHp · sheetStates 다 (hp.cur · states 는 배틀 칸 것) */
 const HP=(x,b)=>b?(+(x.hp||{}).cur||0):(x.sheetHp==null?x.hp.max:Math.max(0,Math.min(x.hp.max,+x.sheetHp||0)));
 const setHP=(x,b,v)=>{if(b)x.hp.cur=v;else x.sheetHp=v};
 const STS=(x,b)=>b?(x.states=x.states||{}):(x.sheetStates=x.sheetStates||{});
 const tidyST=(x,b)=>{if(!b&&x.sheetStates&&!Object.keys(x.sheetStates).length)delete x.sheetStates};
 const alive=m=>{if(!m||!m.hp)return false;const b=bmons()[m.id];if(b&&A().ST.state.battle&&A().ST.state.battle.started)return HP(b,true)>0;return HP(m,false)>0&&!(m.sheetStates||{}).Dead};
 async function hpLoss(mid,fracs){const m=mons()[mid];if(!m)return 0;const loss=frac(m.hp.max,fracs);if(!loss)return 0;await putMon(mid,(x,b)=>{setHP(x,b,Math.max(0,HP(x,b)-loss))});return loss}

 /* ===== 어떤 포켓몬이 판정하나 ===== */
 const SCN={rp:'동행',field:'필드'};
 function battleField(tid){const B=A().ST.state.battle||{};if(!B.started)return null;const L=Object.values(B.mons||{}).filter(m=>m.tid===tid&&m.entry&&(+(m.hp||{}).cur||0)>0).map(m=>m.id).filter(id=>mons()[id]);return L.length?L:null}
 const compCap=(tid,scene)=>scene==='field'?Math.max(1,+cfg().fieldMax||1):(qLv(trs()[tid],'통솔')>=3?2:1);
 /* → {ids, battle(배틀 에리어에서 자동), cap} */
 function compOf(tid,scene){const cap=compCap(tid,scene);const bf=scene==='field'?battleField(tid):null;if(bf)return {ids:bf,battle:true,cap};
  const k=tsk(tid);return {ids:k.comp.filter(id=>mons()[id]&&mons()[id].tid===tid&&alive(mons()[id])).slice(0,cap),battle:false,cap}}
 /* 동행 지정 (무대 바의 포켓몬 아이콘에서). 10-29 망령 「판정이 나왔을 때 멋대로 동행을 못 바꾸게」:
    GM 은 언제나 · 플레이어는 처음 지정(제시 대기 중 아닐 때)과 「교대 가능」 휴식 뒤(다음 제시까지)만 */
 const pendingFor=tid=>{const O=st().offer;if(!O||!(O.ids||[]).includes(tid))return false;const r=(st().res||{})[tid];return !(r&&r.offerId===O.id)};
 function compLock(tid){if(gm())return '';const k=tsk(tid);if(k.swap)return '';const live=k.comp.filter(id=>mons()[id]&&alive(mons()[id]));if(!live.length&&!pendingFor(tid))return '';return live.length?'동행 교대는 휴식(교대 가능) 때나 GM 이 할 수 있다':'체크가 제시된 동안은 동행을 정할 수 없다'}
 async function setComp(tid,mid){const t=trs()[tid];const m=mons()[mid];if(!t||!m||m.tid!==tid)return;const lk=compLock(tid);const k=tsk(tid);const cap=compCap(tid,'rp');let L=k.comp.filter(x=>mons()[x]&&alive(mons()[x]));
  if(L.includes(mid)){if(lk)return A().toast(lk);L=L.filter(x=>x!==mid)}else{if(!alive(m))return A().toast('쓰러진 포켓몬은 동행할 수 없다');if(lk&&!(L.length<cap&&!pendingFor(tid)&&!k.comp.length))return A().toast(lk);L.push(mid);if(L.length>cap)L=L.slice(-cap)}
  await setT(tid,{comp:L});A().sysLog(`${t.name} 동행: ${L.map(x=>mons()[x].name).join(', ')||'없음'}`,'battle',{})}
 async function clearSwap(ids){for(const id of ids||[])if(tsk(id).swap)await setT(id,{swap:0})}
 /* 적합: 제시한 타입 하나라도 → +1, 기술 또는 특성 → +1 (기타는 굴릴 때 고른다) */
 function fitOf(m,O){const F=(O&&O.fit)||{};const out=[];if(!m)return out;
  if((F.types||[]).length&&(m.typesKo||[]).some(t=>F.types.includes(t)))out.push('타입');
  const pw=+F.pow||0;const mv=(m.moves||[]).find(x=>(F.moves||[]).includes(x.name))||(pw>0?(m.moves||[]).find(x=>(+x.pow||0)>=pw&&(!F.powType||x.type===F.powType||S().typeKo(x.typeEn)===F.powType)):null);if(mv)out.push('기술 「'+mv.name+'」');else if((F.abil||[]).includes(m.ability))out.push('특성 「'+m.ability+'」');
  return out}
 const fitTxt=O=>{const F=(O&&O.fit)||{};const L=[];if((F.types||[]).length)L.push('타입 '+F.types.join('·'));if((F.moves||[]).length)L.push('기술 '+F.moves.join('·'));if(+F.pow)L.push(`${F.powType?F.powType+' ':''}기술 위력 ${+F.pow} 이상`);if((F.abil||[]).length)L.push('특성 '+F.abil.join('·'));if(F.etc)L.push('기타 '+F.etc);return L.join(' / ')};

 /* ===== 판정 계산 ===== */
 /* ch = {how:'mon'|'alone'|'super', mid, etc(기타 적합), bonus} → {parts:[[이름,값]], mod, tw(두 번 굴리기 −1 · 0 · 1)} */
 function calcOf(tid,O,ch){const t=trs()[tid];const k=tsk(tid);const C=cfg();const parts=[];const q=qLv(t,O.stat);
  if(ch.how==='super')parts.push([`초상 능력 · 능력 ${RKN[q]} ×2`,q*2]);
  else{parts.push([`${O.stat} ${rankOf(t,O.stat)||'D'}`,q]);
   if(ch.how==='mon'){const m=mons()[ch.mid];if(m){const bv=baseVal(m,O.base);parts.push([`${m.name} ${BASE[O.base]} ${bv}`,baseLv(bv)]);
    const f=O.free?Array.from({length:Math.min(3,+O.fitN||0)},()=>'선언'):fitOf(m,O);if(ch.etc)f.push('기타');const fit=Math.min(3,f.length);if(fit)parts.push([O.free?'적합 (선언)':`적합 ${f.join(' · ')}`,fit])}}}
  if(+O.pm)parts.push([+O.pm>0?'유리':'불리',+O.pm]);
  if(k.inj===1&&+C.injPen)parts.push([tough(t)?'부상 (강인함으로 무시)':'부상',tough(t)?0:-(+C.injPen)]);
  if(+ch.bonus)parts.push(['추가 보정',+ch.bonus]);
  let tw=+O.twice||0;if(k.inj===2)tw=Math.max(-1,tw-1);
  return {parts,mod:parts.reduce((a,p)=>a+p[1],0),tw}}
 /* 정확한 확률 (2d6 열거). 1·1 실패 · 6·6 대성공 → {ok, crit} */
 const PAIRS=[];for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)PAIRS.push([a,b]);
 function judge(k,total,target,crit){if(k[0]===1&&k[1]===1)return 1;if(k[0]===6&&k[1]===6)return 4;return total>=target+crit?4:total>=target?3:1}
 function oddsOf(mod,target,tw,crit){crit=crit==null?+cfg().crit:crit;let ok=0,cr=0,n=0;const add=k=>{const r=judge(k,k[0]+k[1]+mod,target,crit);n++;if(r>=3)ok++;if(r===4)cr++};
  if(!tw)PAIRS.forEach(add);else for(const x of PAIRS)for(const y of PAIRS){const sx=x[0]+x[1],sy=y[0]+y[1];add(tw>0?(sx>=sy?x:y):(sx<=sy?x:y))}
  return {ok:ok/n,crit:cr/n}}
 /* 대결: 상대 2d6 + 보정. 막는 쪽이 상대면 넘어야 이기고, 내가 막는 쪽이면 같아도 이긴다 */
 function oddsVs(mod,tw,O){let ok=0,cr=0;for(const [a,b] of PAIRS){const need=a+b+(+O.npcMod||0)+(O.npcDef==='pc'?0:1);const o=oddsOf(mod,need,tw);ok+=o.ok/36;cr+=o.crit/36}return {ok,crit:cr}}
 const oddsFor=(c,O)=>O.npc?oddsVs(c.mod,c.tw,O):oddsOf(c.mod,+O.target,c.tw);
 function roll2(tw){const x=[d6(),d6()];if(!tw)return {k:x,all:[x]};const y=[d6(),d6()];const sx=x[0]+x[1],sy=y[0]+y[1];return {k:tw>0?(sx>=sy?x:y):(sx<=sy?x:y),all:[x,y]}}
 const pct=p=>Math.round(p*100)+'%';
 /* 결과 칸 (실패 · 성공 · 대성공). now = 합계가 있으면 그 칸에 표시 */
 function ladder(target,now){if(!(+target>0))return '';const t=+target,c=+cfg().crit;const seg=[[1,`${t-1} 이하`,null,t-1],[3,`${t}~${t+c-1}`,t,t+c-1],[4,`${t+c} 이상 · 6·6`,t+c,null]];
  return `<div class="sklad" style="grid-template-columns:repeat(3,1fr)">${seg.map(([ri,rg,lo,hi])=>{const on=now!=null&&(lo==null||now>=lo)&&(hi==null||now<=hi);return `<span class="${on?'on':''}" style="--c:${COL[ri]}"><b>${RES[ri]}</b><small>${rg}</small></span>`}).join('')}</div>`}
 /* 목표 자동 (던전 · 시뮬이 보내는 난이도 이름) → 고정 목표치 */
 function autoTarget(ids,o,tier){const t=TIER[tier];return t?{target:t,tier,p:null,inb:true,who:'',die:'2d6',how:''}:null}
 /* 예전(v3) 제시 모양을 v4 로: 목표 5 · 7 · 9 · 11 → 8 · 10 · 12 · 15, 주사위 단계 → ± 1, 종족값은 자질에 맞는 기본 짝 */
 function upOffer(o){o=Object.assign({},o||{});if(+o.v>=4)return o;const T3={5:8,7:10,9:12,11:15};o.target=T3[+o.target]||(+o.target||7)+3;if(+o.step)o.pm=(+o.pm||0)*0+(+o.step>0?1:-1);else o.pm=0;delete o.step;if(o.base==null)o.base=BASE_OF[o.stat]??3;if(o.pen&&o.pen.cost)delete o.pen.cost;o.v=4;return o}

 /* ===== 패널티 묶음 ===== */
 /* 10-28 망령 「대가 실패는 게임 수치로」: al = 경계도 +N (던전 탐색 중이면 그 던전 경계도를 올린다) */
 const PEN0=()=>({al:0,dmg:'',st:'',cnt:'',rk:{},pot:{who:'tr',name:'',n:0},memo:''});
 function penNorm(x){const b=PEN0();x=x||{};for(const k in b)if(x[k]!=null&&x[k]!=='')b[k]=typeof b[k]==='object'?Object.assign({},b[k],x[k]):x[k];if(typeof b.rk!=='object')b.rk={};return b}
 function penHas(x){x=penNorm(x);return !!(+x.al>0||x.dmg||x.st||x.memo||Object.values(x.rk).some(v=>+v)||+x.pot.n>0)}
 function penTxt(x){x=penNorm(x);const t=[];if(+x.al>0)t.push('경계도 +'+x.al);if(x.dmg)t.push('대미지 '+x.dmg);if(x.st)t.push('「'+stKo(x.st)+'」'+(x.cnt&&+x.cnt>0?' '+x.cnt+'턴':''));RK.forEach(([k,n])=>{const v=+x.rk[k]||0;if(v)t.push(n+' '+(v>0?'+':'')+v)});if(+x.pot.n>0)t.push((x.pot.who==='pk'?'전용':'고유')+' 포텐셜'+(x.pot.name?' 『'+x.pot.name+'』':'')+' −'+x.pot.n);if(x.memo)t.push(x.memo);return t.join(' · ')}
 /* 실패한 판정에 묶음을 건다: 대미지 · 상태 · 랭크는 판정한 포켓몬(mid), 나머지는 트레이너 · 일행 */
 async function applyPenalty(tid,sub,why,mid){sub=penNorm(sub);const t=trs()[tid];if(!t||!penHas(sub))return '';const L=[];
  const monPart=!!(sub.dmg||sub.st||Object.values(sub.rk).some(v=>+v));
  if(monPart&&mid&&mons()[mid]){await putMon(mid,(x,b)=>{const nm=x.name;
    if(sub.dmg){const loss=frac(x.hp.max,sub.dmg);setHP(x,b,Math.max(0,HP(x,b)-loss));if(!b)L.push(`${nm} HP −${loss}`)}
    if(sub.st){const XS=STS(x,b);const sd=sdb()[sub.st]||{};XS[sub.st]=+sub.cnt>0?+sub.cnt:(sd.min>=1000||!sd.min?1000:(+sd.max>+sd.min&&+sd.max<1000?+sd.min+Math.floor(Math.random()*(+sd.max-+sd.min+1)):+sd.min));if(!b)L.push(`${nm} 「${stKo(sub.st)}」`)}
    const rk=Object.entries(sub.rk).filter(([k,v])=>+v);if(rk.length){x.rank=x.rank||{};for(const [k,v] of rk){x.rank[k]=Math.max(-6,Math.min(6,(+x.rank[k]||0)+ +v))}if(!b)L.push(`${nm} `+rk.map(([k,v])=>(RK.find(r=>r[0]===k)||[k,k])[1]+(v>0?'+':'')+v).join(' '))}})}
  else if(monPart)L.push('혼자 굴려 포켓몬 패널티는 없다');
  const bt=((A().ST.state.battle||{}).trainers||{})[tid];
  if(+sub.pot.n>0){let n=+sub.pot.n;let done=0;const uniq=(bt&&bt.unique)||[];
   for(const m of Object.values(bmons()).filter(m=>m.tid===tid)){if(n<=0)break;const all=[...(m.pots||[]),m.excl,...(m.exclX||[]),...uniq].filter(p=>p&&p.name&&/【(\d+)\/시】/.test(p.eff||''));const u=Object.assign({},m.potUses||{});let ch=false;
    for(const p of all){if(n<=0)break;if(sub.pot.name&&p.name!==sub.pot.name)continue;const max=+(String(p.eff||'').match(/【(\d+)\/시】/)||[0,0])[1];const cur=u[p.name]==null?max:+u[p.name];if(cur>0){u[p.name]=cur-1;n--;done++;ch=true}}
    if(ch)await A().set(['battle','mons',m.id,'potUses'],u)}
   L.push(done?`포텐셜 횟수 −${done}`:'포텐셜 횟수 차감할 것이 없다')}
  if(+sub.al>0){const DG=window.OM_DG_UI;let r='';try{r=DG&&DG.alAdd?await DG.alAdd(+sub.al,(why||'').split(' · ')[0]):''}catch(e){}L.push(r||`경계도 +${+sub.al} (던전 밖 — 적용 안 함)`)}
  if(sub.memo)L.push(sub.memo);
  const txt=`【패널티】 ${t.name} 『${why}』\n${L.join('\n')||'(적용할 것 없음)'}`;A().sysLog(txt,'battle',{});return txt}

 /* ===== 상태 단계 ===== */
 /* 4식 · 6령을 n 개 뺀다 (배틀 중이면 배틀 쪽 횟수, 아니면 시트 쪽). 돌려줄 수 있게 뺀 칸을 적어 둔다 */
 async function cutOrd(tid,pre,n){const B=A().ST.state.battle||{};const bT=(B.trainers||{})[tid];const inB=!!(bT&&bT.orderCount&&B.started);const src=inB?bT:trs()[tid];const lab=pre==='order_'?'4식':'6령';const out={n:0,want:n,lab,keys:[],inB,tid};if(!src)return out;
  const cnt=Object.assign({},src.orderCount||{});let left=n;for(const kk of Object.keys(cnt).filter(k=>k.startsWith(pre)).sort()){while(left>0&&(+cnt[kk]||0)>0){cnt[kk]--;left--;out.keys.push(kk)}}
  out.n=out.keys.length;if(out.n)await A().set(inB?['battle','trainers',tid,'orderCount']:['roster','trainers',tid,'orderCount'],cnt);return out}
 async function refundOrd(c){if(!c||!c.n)return;const B=A().ST.state.battle||{};const src=c.inB?(B.trainers||{})[c.tid]:trs()[c.tid];if(!src)return;const cnt=Object.assign({},src.orderCount||{});for(const kk of c.keys)cnt[kk]=(+cnt[kk]||0)+1;await A().set(c.inB?['battle','trainers',c.tid,'orderCount']:['roster','trainers',c.tid,'orderCount'],cnt)}
 /* 한 단계 나빠진다 → {prev, now, cut, line} */
 async function stepUp(tid,why){const t=trs()[tid];const k=tsk(tid);const C=cfg();const prev=k.inj;if(prev>=3)return {prev,now:3,cut:null,line:`${t.name} 이미 「빈사」`};const now=prev+1;let cut=null;
  if(now===1&&+C.injOc>0)cut=await cutOrd(tid,'command_',+C.injOc);if(now===2&&+C.injOo>0)cut=await cutOrd(tid,'order_',+C.injOo);
  await setT(tid,{inj:now});
  const cl=cut?(cut.n?` · ${cut.lab} −${cut.n}`:` · ${cut.lab} 뺄 것이 없다 (손으로)`):'';
  return {prev,now,cut,line:`${t.name} 「${STEP[prev]}」 → 「${STEP[now]}」${cl}${now===2?' · 모든 판정 불리':now===1?(tough(t)?' · 강인함':' · 모든 판정 −'+C.injPen):' · 이 장면에서 빠진다'} (${why})`}}
 async function stepUndo(tid,s){if(!s)return;await setT(tid,{inj:s.prev});await refundOrd(s.cut)}
 /* 실패 확정: 단계 + 패널티 묶음 (자동이면) */
 async function settleFail(tid,r){const O=r.offerId==='free'?null:st().offer;delete r.pend;if(r.offerId==='free'?+r.noStep:(O&&O.id===r.offerId&&O.noStep)){r.text+='\n상태 단계는 오르지 않는 체크';}else{const s=await stepUp(tid,(r.label||'스킬 체크')+' 실패');r.step=s;r.text+='\n'+s.line;A().sysLog(s.line,'dice')}
  if(O&&O.id===r.offerId&&O.pen&&O.pen.auto&&penHas(O.pen.fail)){await applyPenalty(tid,O.pen.fail,(O.label||'스킬 체크')+' · 실패',r.how==='mon'?r.mid:'');r.penDone=1}
  return r}

 /* ===== 휴식 ===== */
 async function applyRest(kind,tids,opt){opt=opt||{};const R=restCfg(kind);const T=trs();const ids=(tids&&tids.length?tids:Object.keys(T)).filter(id=>T[id]);const kn=(KINDS.find(k=>k[0]===kind)||[])[1]||kind;const L=[];
  const SD=sdb();const bt=(A().ST.state.battle||{}).trainers||{};
  /* 10-28: hp_one = 「HP」 회복은 일행 전체에서 가장 다친 1체만 */
  let oneId='';if(+R.hp_one&&R.hp&&R.hp!=='0'){let best=2;for(const m0 of Object.values(mons()).filter(m=>ids.includes(m.tid))){const b0=bmons()[m0.id];const x0=b0||m0;const c0=HP(x0,!!b0);if(c0<=0||c0>=x0.hp.max)continue;const r0=c0/x0.hp.max;if(r0<best){best=r0;oneId=m0.id}}}
  for(const tid of ids){const t=T[tid];const k=tsk(tid);const lines=[];
   for(const m of Object.values(mons()).filter(m=>m.tid===tid)){let heal=0,rev=false,cured=[];
    await putMon(m.id,(x,b)=>{const was=HP(x,b);let cur=was;const XS=STS(x,b);
     if(cur<=0||XS.Dead){if(+R.revive){cur=Math.max(1,frac(x.hp.max,R.revive_hp||'1'));delete XS.Dead;if(!b)rev=true}}
     else if(R.hp&&R.hp!=='0'&&(!+R.hp_one||m.id===oneId)){const h=frac(x.hp.max,R.hp);cur=Math.min(x.hp.max,cur+h);if(!b)heal=cur-was}
     setHP(x,b,cur);
     for(const st0 in XS){if(!XS[st0]||st0==='Dead')continue;const abn=!!(SD[st0]||{}).abn;if((abn&&+R.cure_ab)||(!abn&&+R.cure_sp)){delete XS[st0];if(!b)cured.push(SD[st0]?SD[st0].ko:st0)}}
     tidyST(x,b);
     if(R.pot_pk_n==='all'&&x.potUses)delete x.potUses});
    if(rev)lines.push(`${m.name} 부활`);else if(heal>0)lines.push(`${m.name} HP +${heal}`);if(cured.length)lines.push(`${m.name} 「${cured.join('」「')}」 해제`)}
   if(R.pot_pk_n!=='all'&&+R.pot_pk_n>0){let n=+R.pot_pk_n;for(const m of Object.values(bmons()).filter(m=>m.tid===tid)){if(n<=0)break;const u=Object.assign({},m.potUses||{});let ch=false;for(const nm in u){if(n<=0)break;const src=[...(m.pots||[]),m.excl,...(m.exclX||[])].find(p=>p&&p.name===nm);const max=+(String((src||{}).eff||'').match(/【(\d+)\/시】/)||[0,0])[1];if(+u[nm]<max){u[nm]=+u[nm]+1;n--;ch=true}}if(ch)await A().set(['battle','mons',m.id,'potUses'],u)}if(+R.pot_pk_n-n)lines.push(`전용 포텐셜 횟수 +${+R.pot_pk_n-n}`)}
   if(bt[tid]&&R.ord_n&&R.ord_n!=='0'){const nt=JSON.parse(JSON.stringify(bt[tid]));nt.orderCount=nt.orderCount||{};const OO=window.OM_ORDERS;
    if(R.ord_n==='all'){try{nt.orderCount=OO.fill(nt,OO.styles(nt))}catch(e){for(const kk in nt.orderCount)nt.orderCount[kk]=nt.orderBase||1}lines.push('4식 6령 전부 회복')}
    else{let n=+R.ord_n;for(const kk of Object.keys(nt.orderCount).sort()){while(n>0&&(+nt.orderCount[kk]||0)<(nt.orderBase||1)){nt.orderCount[kk]++;n--}}lines.push(`4식 6령 +${+R.ord_n-n}`)}
    await A().setDiff(['battle','trainers',tid],bt[tid],nt,2)}
   const patch={};if(+R.inou)patch.sup=0;if(+R.swap)patch.swap=1;if(+R.inj_n>0)patch.inj=Math.max(0,k.inj-(+R.inj_n));
   if(Object.keys(patch).length)await setT(tid,patch);
   const tl=[];if(+R.inou&&k.sup)tl.push('초상 능력 횟수');if(+R.inj_n>0&&k.inj)tl.push(`${STEP[k.inj]} → ${STEP[patch.inj]}`);if(+R.swap)tl.push('동행 교대 가능');if(tl.length)lines.push(tl.join(' · '));
   L.push(`${t.name}: ${lines.join(' · ')||'변화 없음'}`)}
  /* 10-28: ord_po · ord_pc = 파티 전체에서 4식 · 6령을 n 개 회복 (배틀 중이면 배틀 쪽, 아니면 시트 쪽). 제작한 값(가득)까지만 */
  if(+R.ord_po>0||+R.ord_pc>0){const OO=window.OM_ORDERS;const B=A().ST.state.battle||{};const LP=[];
   for(const [pre,n0,lab] of [['order_',+R.ord_po||0,'4식'],['command_',+R.ord_pc||0,'6령']]){let n=n0;
    for(const tid of ids){if(n<=0)break;const bT=(B.trainers||{})[tid];const inB=!!(bT&&bT.orderCount&&B.started);const src=inB?bT:T[tid];if(!src)continue;let FL={};try{FL=OO.fill(src,src.orderBase||1)}catch(e){}const cnt=Object.assign({},src.orderCount||{});let ch=0;
     for(const kk of Object.keys(FL).filter(k=>k.startsWith(pre)).sort()){while(n>0&&(+cnt[kk]||0)<(+FL[kk]||0)){cnt[kk]=(+cnt[kk]||0)+1;n--;ch++}}
     if(ch){await A().set(inB?['battle','trainers',tid,'orderCount']:['roster','trainers',tid,'orderCount'],cnt);LP.push(`${src.name||''} ${lab} +${ch}`)}}}
   if(LP.length)L.push('파티: '+LP.join(' · '))}
  /* 10-29 망령: 은열쇠 회복 — 덱 자원 「은열쇠」 (덱은 GM 화면만 쓴다) */
  if(R.key_n&&R.key_n!=='0'){const D=A().ST.state.deck2;const LK=[];if(!gm())LK.push('은열쇠 회복은 GM 화면에서');else if(D&&D.decks){for(const [did,dk] of Object.entries(D.decks)){const res=(dk.res||[]).find(r=>r.n==='은열쇠');if(!res)continue;const rv=JSON.parse(JSON.stringify(dk.rv||{}));let ch=false;
    for(const tid of ids){if(!rv[tid])continue;const cur=+rv[tid]['은열쇠']||0;const mx=+res.m||0;const to=R.key_n==='all'?(mx||cur):Math.min(mx||1e9,cur+(+R.key_n||0));if(to>cur){rv[tid]['은열쇠']=to;ch=true;LK.push(`${T[tid].name} ${cur} → ${to}`)}}
    if(ch)await A().setDiff(['deck2','decks',did,'rv'],dk.rv||{},rv,2)}}
   if(LK.length)L.push('은열쇠: '+LK.join(' · '))}
  const txt=`【휴식】 ${kn}${opt.by?' · '+opt.by:''}\n${L.join('\n')}`;A().sysLog(txt,'battle',{});try{window.OM_RP_UI&&window.OM_RP_UI.playSe('Ping')}catch(e){}return txt}
 /* 장면 끝: 빈사 → 중상 */
 async function sceneEnd(){const L=[];for(const tid of Object.keys(trs())){const k=tsk(tid);if(k.inj===3){await setT(tid,{inj:2});L.push(trs()[tid].name)}}A().sysLog(L.length?`◆ 장면 끝 — ${L.join(', ')} 「빈사」 → 「중상」`:'◆ 장면 끝','battle');return L}

 /* ===== 덱 연동: 상태 카드 (GM 화면) =====
    설정의 상태 카드(부상 · 중상 · 빈사)를 그 트레이너 손패에 하나만 둔다 — 단계가 바뀌면 다른 상태 카드는 버린 카드로, 새 카드는 덱 · 버린 카드에서 가져온다 */
 let syncing=false,syncT=0;
 function sync(){if(!gm()||syncing)return;clearTimeout(syncT);syncT=setTimeout(()=>{doSync().catch(e=>console.warn(e))},500)}
 async function doSync(){const cd=cfg().cards;const D=A().ST.state.deck2;if(!cd.deck||!D||!D.decks||!D.decks[cd.deck])return;const dk=D.decks[cd.deck];const C3=[cd.c1,cd.c2,cd.c3];if(!C3.some(Boolean))return;
  syncing=true;try{const nd=JSON.parse(JSON.stringify(dk));nd.hands=nd.hands||{};nd.holders=nd.holders||[];nd.pile=nd.pile||[];nd.disc=nd.disc||[];nd.rv=nd.rv||{};let ch=false;
   for(const tid of Object.keys(trs())){const s=tsk(tid).inj;const w=s?C3[s-1]||'':'';const h=(nd.hands[tid]||[]).slice();
    for(const c of C3){if(!c||c===w)continue;let i;while((i=h.indexOf(c))>=0){h.splice(i,1);nd.disc.push(c);ch=true}}
    if(w&&!h.includes(w)){let i=nd.pile.indexOf(w);if(i>=0)nd.pile.splice(i,1);else{i=nd.disc.lastIndexOf(w);if(i>=0)nd.disc.splice(i,1)}h.push(w);ch=true;if(!nd.holders.includes(tid))nd.holders.push(tid);if(!nd.rv[tid])nd.rv[tid]=Object.fromEntries((nd.res||[]).map(r=>[r.n,+r.s||0]))}
    if(h.length||nd.hands[tid])nd.hands[tid]=h}
   if(ch)await A().setDiff(['deck2','decks',cd.deck],dk,nd,1)}finally{syncing=false}}

 /* ===== 창 공통 ===== */
 function open(){if(gm())return openGm();const tid=me();if(!tid)return A().toast('자리에 앉아야 한다');openPlayer(tid)}
 const seg=(name,opts,cur)=>`<span class="seg" data-seg="${name}">${opts.map(([v,n,t])=>`<span class="${String(cur)===String(v)?'on':''}" data-v="${esc(v)}" ${t?`title="${esc(t)}"`:''}>${n}</span>`).join('')}</span>`;
 const segVal=(md,name)=>{const on=md.querySelector(`[data-seg="${name}"] .on`);return on?on.dataset.v:''};
 function bindSeg(md){md.querySelectorAll('[data-seg]').forEach(sg=>sg.querySelectorAll('span[data-v]').forEach(sp=>sp.onclick=()=>{sg.querySelectorAll('span[data-v]').forEach(x=>x.classList.toggle('on',x===sp));sg.dispatchEvent(new CustomEvent('segchange',{bubbles:true,detail:sp.dataset.v}))}))}
 const F={noStep:0,label:'',stat:'지시',base:3,scene:'rp',target:10,npc:0,npcMod:2,npcDef:'npc',pm:0,twice:0,fit:{types:[],moves:[],abil:[],pow:0,powType:'',etc:''},pen:{fail:PEN0()},ids:null,penOpen:false,restKind:'long',auto:''};
 const npcTxt=O=>O.npc?`대결 · ${esc(O.npc)} 2d6${sgn(+O.npcMod||0)} · 막는 쪽 ${O.npcDef==='pc'?'나':'상대'}`:'';
 function offerSummary(O){O=upOffer(O);return `${esc(O.stat)} + ${BASE[O.base]??'?'} · ${O.scene==='field'?'필드':'동행'} · ${O.npc?npcTxt(O):'목표 '+O.target}${O.auto&&TIER[O.auto]?' (자동)':''}${+O.pm?' · '+(+O.pm>0?'유리 ':'불리 ')+sgn(+O.pm):''}${+O.twice?' · 두 번 굴려 '+(+O.twice>0?'높은':'낮은')+' 값':''}${fitTxt(O)?' · 적합 '+esc(fitTxt(O)):''}${O.noStep?' · 실패해도 상태 단계 그대로':''}`}
 function penLine(P){if(!P||!penHas(P.fail))return '';return `<div class="skpenline"><span><i class="penf">실패</i> ${esc(penTxt(P.fail))}</span></div>`}
 const DMGS=['','1/8','1/4','1/3','1/2'];
 /* 패널티 한 칸 (제시 · 예시 편집 창이 같이 쓴다). t = 칸 이름, X = 패널티 */
 function penFields(t,X){return `   <div class="fr"><span class="lbl">대미지</span>${seg('pen_'+t+'_dmg',[['','없음'],['1/8','1/8'],['1/4','1/4'],['1/3','1/3'],['1/2','1/2']],DMGS.includes(X.dmg)?X.dmg:'x')}<input type="text" class="n xs" data-pen="${t}.dmg" value="${DMGS.includes(X.dmg)?'':esc(X.dmg)}" placeholder="직접"></div>
   <div class="fr"><span class="lbl">상태</span><select data-pen="${t}.st"><option value="">없음</option>${stList().map(([k,ko,abn])=>`<option value="${k}" ${X.st===k?'selected':''}>${esc(ko)}${abn?' (이상)':''}</option>`).join('')}</select><span class="small dim">턴</span><input type="number" class="n xs" data-pen="${t}.cnt" value="${esc(X.cnt)}" placeholder="기본"></div>
   <div class="fr" style="align-items:flex-start"><span class="lbl">랭크</span><div class="prk">${RK.map(([k,n])=>{const v=+X.rk[k]||0;return `<div class="prki ${v>0?'up':v<0?'dn':''}"><small>${n}</small><span data-rk="${t}.${k}.-1">−</span><b>${v>0?'+':''}${v}</b><span data-rk="${t}.${k}.1">＋</span></div>`}).join('')}</div></div>
   <div class="fr"><span class="lbl">경계도</span><span class="small dim">+</span><input type="number" class="n xs" data-pen="${t}.al" value="${+X.al||0}" step="5"><span class="small dim">던전 탐색 중이면 그 던전 경계도에 더한다</span></div>
   <div class="fr"><span class="lbl">포텐셜</span>${seg('pen_'+t+'_who',[['tr','고유'],['pk','전용']],X.pot.who||'tr')}<input type="text" class="n" data-pen="${t}.pot.name" value="${esc(X.pot.name||'')}" placeholder="이름 (비우면 아무거나)" style="width:150px"><input type="number" class="n xs" data-pen="${t}.pot.n" value="${+X.pot.n||0}"><span class="small dim">회 차감</span></div>
   <div class="fr"><span class="lbl">메모</span><input type="text" data-pen="${t}.memo" value="${esc(X.memo)}" placeholder="GM 이 손으로 할 것 · 서술" style="flex:1"></div>`}
 const exHide=k=>(((st().exHide)||{})[k])||[];
 function penExSel(t){const mine=st().penPresets||[];const hid=exHide('pen');return `<select data-penex="${t}" title="패널티 예시 불러오기"><option value="">예시…</option>${mine.length?`<optgroup label="내가 저장한 것">${mine.map(p=>`<option value="my:${esc(p.id)}">${esc(p.name)}</option>`).join('')}</optgroup>`:''}<optgroup label="기본">${PEN_EX.map((e,i)=>hid.includes(e.name)?'':`<option value="ex:${i}">${esc(e.name)}</option>`).join('')}</optgroup></select>`}
 function penExGet(v){if(!v)return null;if(v.startsWith('ex:'))return (PEN_EX[+v.slice(3)]||{}).p||null;const p=(st().penPresets||[]).find(p=>p.id===v.slice(3));return p?p.p:null}
 function grabPen(md,t,X0){const X=penNorm(X0);const q=k=>md.querySelector(`[data-pen="${t}.${k}"]`);if(!q('dmg'))return X;const dv=segVal(md,'pen_'+t+'_dmg');const di=q('dmg').value.trim();X.dmg=di||(dv==='x'?X.dmg:dv);X.al=Math.max(0,+((q('al')||{}).value)||0);X.st=q('st').value;X.cnt=q('cnt').value;X.pot.who=segVal(md,'pen_'+t+'_who')||'tr';X.pot.name=q('pot.name').value.trim();X.pot.n=+q('pot.n').value||0;X.memo=q('memo').value.trim();return X}
 function penBox(P){const X=penNorm(P.fail);return `<div class="skpen"><div class="fr"><span class="lbl">묶음</span><div class="pensum">${penHas(X)?`<div><i class="penf">실패</i> ${esc(penTxt(X))}</div>`:'<span class="dim small">없음 — 실패하면 트레이너 상태 한 단계만</span>'}</div><button class="btn xs" data-sk="penopen">${F.penOpen?'접기':'설정 ▸'}</button><button class="btn xs ghost" data-sk="exmgr" data-t="pen" title="패널티 예시를 한 번에 보고 관리">패널티 예시</button>${penHas(X)?'<button class="btn xs ghost" data-sk="penclr">비우기</button>':''}</div>
  ${F.penOpen?`<div class="skpencols" style="grid-template-columns:1fr"><div class="skpencol penf"><div class="sec">실패했을 때 판정한 포켓몬이 받는 것 <span class="sp"></span>${penExSel('fail')}<button class="btn xs ghost" data-sk="pensave" data-t="fail" title="이 칸을 패널티 예시로 저장">저장</button></div>
${penFields('fail',X)}</div></div>
   <label class="small tg" style="margin-top:6px;display:block"><input type="checkbox" id="pen_auto" ${cfg().penAuto?'checked':''}> 실패가 확정되면 자동으로 건다 (끄면 GM 이 제시 탭에서 손으로)</label>`:''}</div>`}
 const splitL=s=>String(s||'').split(/[,，、·\/]/).map(x=>x.trim()).filter(Boolean).slice(0,8);
 function grabOffer(md){F.label=$('#so_label',md).value.trim();F.stat=segVal(md,'stat')||'지시';F.base=+segVal(md,'base')||0;F.scene=segVal(md,'scene')||'rp';F.target=+$('#so_target',md).value||10;F.npc=+segVal(md,'npc')||0;F.npcMod=+(($('#so_npcmod',md)||{}).value)||0;F.npcDef=segVal(md,'npcdef')||'npc';F.pm=+segVal(md,'pm')||0;F.twice=+segVal(md,'twice')||0;
  F.fit={types:[...md.querySelectorAll('[data-fty].on')].map(x=>x.dataset.fty),moves:splitL($('#so_fmv',md).value),abil:splitL($('#so_fab',md).value),pow:Math.max(0,+(($('#so_fpow',md)||{}).value)||0),powType:(($('#so_fpt',md)||{}).value)||'',etc:$('#so_fetc',md).value.trim().slice(0,60)};
  F.noStep=+segVal(md,'nostep')||0;F.ids=[...md.querySelectorAll('[data-so-id]:checked')].map(i=>i.dataset.soId);
  if(F.penOpen)F.pen.fail=grabPen(md,'fail',F.pen.fail)}
 function presetOf(){return {v:4,noStep:F.noStep?1:0,label:F.label,stat:F.stat,base:F.base,scene:F.scene,target:F.target,npc:F.npc,npcMod:F.npcMod,npcDef:F.npcDef,pm:F.pm,twice:F.twice,fit:JSON.parse(JSON.stringify(F.fit)),pen:{fail:F.pen.fail}}}
 function loadPreset(o){o=upOffer(o);Object.assign(F,{noStep:+o.noStep?1:0,label:o.label||'',stat:o.stat||'지시',base:o.base??3,scene:o.scene||'rp',target:+o.target||10,auto:'',npc:+o.npc||0,npcMod:o.npcMod!=null?+o.npcMod:((NPC.find(x=>x[0]===+o.npc)||[])[2]??2),npcDef:o.npcDef||'npc',pm:+o.pm||0,twice:+o.twice||0,fit:Object.assign({types:[],moves:[],abil:[],etc:''},o.fit||{}),pen:{fail:penNorm((o.pen||{}).fail)}});F.penOpen=penHas(F.pen.fail)}
 /* 제시 만들기 (GM 창 · 던전 공용) */
 function mkOffer(o,ids){const npc=NPC.find(x=>x[0]===+o.npc&&x[0]);return {id:'o'+Date.now().toString(36),v:4,label:o.label||'',stat:o.stat||'지시',base:+o.base||0,scene:o.scene||'rp',target:+o.target||10,auto:o.auto||'',npc:npc?(npc[0]===9?'상대':npc[1]):'',npcMod:npc?+o.npcMod||0:0,npcDef:o.npcDef==='pc'?'pc':'npc',pm:+o.pm||0,twice:+o.twice||0,fit:Object.assign({types:[],moves:[],abil:[],etc:''},o.fit||{}),pen:{fail:penNorm((o.pen||{}).fail),auto:cfg().penAuto?1:0},ids,noStep:+o.noStep?1:0,at:Date.now()}}
 function offerLog(o,by){const T=trs();return `【스킬 체크】 ${o.label||'판정'}${by?' · '+by:''}\n${o.stat} + ${BASE[o.base]} · ${o.scene==='field'?'필드 포켓몬':'동행 포켓몬'} · ${o.npc?`대결 (${o.npc} 2d6${sgn(o.npcMod)}, 막는 쪽 ${o.npcDef==='pc'?'우리':'상대'})`:'목표 '+o.target}${o.pm?' · '+(o.pm>0?'유리 ':'불리 ')+sgn(o.pm):''}${o.twice?' · 두 번 굴려 '+(o.twice>0?'높은':'낮은')+' 값':''}${fitTxt(o)?'\n적합: '+fitTxt(o):''}\n대상: ${o.ids.map(i=>(T[i]||{}).name).join(', ')}${penHas(o.pen.fail)?'\n실패하면: '+penTxt(o.pen.fail):''}${o.noStep?'\n이 체크는 실패해도 트레이너 상태 단계가 오르지 않는다':''}`}
 /* 한 트레이너가 이 제시를 굴릴 때 고를 수 있는 것과 확률 (미리보기 · 플레이어 창) */
 function optionsOf(tid,O){const t=trs()[tid];const k=tsk(tid);const out=[];if(!t)return out;
  for(const mid of compOf(tid,O.scene).ids){const c=calcOf(tid,O,{how:'mon',mid});out.push({how:'mon',mid,name:mons()[mid].name,c,o:oddsFor(c,O)})}
  {const c=calcOf(tid,O,{how:'alone'});out.push({how:'alone',name:'혼자',c,o:oddsFor(c,O)})}
  if(O.stat==='능력'&&supMax(t)>0){const c=calcOf(tid,O,{how:'super'});out.push({how:'super',name:'초상 능력',c,o:oddsFor(c,O),left:supMax(t)-k.sup})}
  return out}

 /* ----- GM 창 ----- */
 function openGm(tab){tab=tab||'offer';const K=st();const T=Object.fromEntries(Object.entries(trs()).filter(([,t])=>t&&t.kind!=='npc'));const O=K.offer?upOffer(K.offer):null;const R=K.res||{};const C=cfg();const presets=K.presets||[];
  const ids=F.ids||Object.keys(T);
  const resCell=(id)=>{const r=R[id];const done=r&&O&&r.offerId===O.id;if(!done)return '<span class="small dim">아직 안 굴림</span>';
   return `<span class="skres" style="background:${COL[r.ri]}">${RES[r.ri]}</span><span class="small dim">${esc(r.total)} / ${esc(r.target)} · ${esc(r.how==='mon'?r.monName:r.how==='super'?'초상 능력':'혼자')}</span>${r.pend?'<span class="tag">묘수 고민 중</span>':''}${r.step?`<span class="tag">${STEP[r.step.prev]} → ${STEP[r.step.now]}</span>`:''}${r.cover?`<span class="tag">커버 ${esc(r.cover.name)}</span>`:''}${r.penDone?'<span class="tag">묶음 적용됨</span>':''}`};
  const offerTab=`${O?`<div class="skcard hit"><div class="sec">지금 제시된 체크 <span class="note">${esc(O.label||'')}</span><span class="sp"></span><button class="btn xs ghost" data-sk="close">마감 (제시 거두기)</button></div><div class="small">${offerSummary(O)}</div>${penLine(O.pen)}
     <div class="sklist" style="margin-top:6px">${(O.ids||[]).map(id=>{const r=R[id];const done=r&&r.offerId===O.id;const t=T[id]||trs()[id]||{};return `<div class="skrow wrap"><b>${esc(t.name)}</b>${resCell(id)}<span class="sp"></span>${done&&r.pend?`<button class="btn xs" data-sk="settle" data-tid="${id}" title="묘수를 쓰지 않고 실패를 확정한다">실패 확정</button>`:''}${done&&r.ri===1&&!r.pend&&!r.penDone&&penHas(O.pen.fail)?`<button class="btn xs" data-sk="penapply" data-tid="${id}">묶음 걸기</button>`:''}<button class="btn xs ghost" data-sk="rollfor" data-tid="${id}">${done?'열기':'대신 굴리기'}</button></div>`}).join('')}</div></div>`:''}
    <div class="skcard sknew"><div class="sec">새 체크 제시 <span class="sp"></span><select id="so_ex" title="예시·저장한 제시 불러오기"><option value="">예시 불러오기…</option>${presets.length?`<optgroup label="내가 저장한 것">${presets.map(p=>`<option value="my:${p.id}">${esc(p.name)}</option>`).join('')}</optgroup>`:''}<optgroup label="기본">${EX.map((e,i)=>exHide('check').includes(e.name)?'':`<option value="ex:${i}">${esc(e.name)}</option>`).join('')}</optgroup></select><button class="btn xs ghost" data-sk="exsave" title="지금 폼을 예시로 저장">저장</button><button class="btn xs" data-sk="exmgr" data-t="check" title="체크 · 패널티 예시를 한 번에 보고 관리">예시 관리</button></div>
     <div class="skstep"><div class="skh"><i>1</i>무엇을 <small>트레이너 자질 + 포켓몬 종족값</small></div>
      <div class="fr"><span class="lbl">상황</span><input type="text" id="so_label" placeholder="예) 고대 문자를 해독한다" value="${esc(F.label)}" style="flex:1;min-width:0"></div>
      <div class="fr"><span class="lbl">자질</span>${seg('stat',SK.map(s=>[s,s,{지시:'머리를 쓰는 일',육성:'신체를 쓰는 일',통솔:'대화 · 교섭 · 위압',능력:'기술과 이능'}[s]]),F.stat)}</div>
      <div class="fr"><span class="lbl">종족값</span>${seg('base',BASE.map((b,i)=>[i,b,BASE_HINT[i]]),F.base)}</div>
      <div class="fr"><span class="lbl">장면</span>${seg('scene',[['rp','RP · 동행 포켓몬'],['field','던전 · 배틀 · 필드 포켓몬']],F.scene)}</div></div>
     <div class="skstep"><div class="skh"><i>2</i>누가 <small>눌러서 넣고 빼기</small></div>
      <span class="chips">${Object.values(T).map(t=>{const cp=compOf(t.id,F.scene);return `<label class="chip skwhochip ${ids.includes(t.id)?'on':''}"><input type="checkbox" data-so-id="${t.id}" ${ids.includes(t.id)?'checked':''} hidden>${av(t.image,t.name)}${cp.ids.map(id=>av(mons()[id].image,mons()[id].name,'sm')).join('')} ${esc(t.name)}${tsk(t.id).inj?' · '+STEP[tsk(t.id).inj]:''}</label>`}).join('')||'<span class="dim small">로스터에 트레이너가 없다</span>'}</span></div>
     <div class="skstep"><div class="skh"><i>3</i>목표 <small>난이도를 고르거나 · 상대와 겨룬다</small></div>
      <div class="fr"><span class="lbl">난이도</span><span class="chips">${DIFF.map(([v,n])=>`<span class="chip ${F.target===v?'on':''}" data-diff="${v}">${n} ${v}</span>`).join('')}</span><label class="sktg">목표 <input type="number" class="n xs" id="so_target" value="${F.target}"></label></div>
      <div class="fr"><span class="lbl">대결 판정</span>${seg('npc',NPC.map(([v,n,m])=>[v,v&&m!=null?`${n} ${sgn(m)}`:n]),F.npc)}</div>
      <div class="fr" id="so_npcrow" style="${F.npc?'':'display:none'}"><span class="lbl">상대</span><span class="small dim">2d6</span><input type="number" class="n xs" id="so_npcmod" value="${F.npcMod}" title="상대 자질 + 종족값 + 적합"><span class="small dim">막는 쪽 (동점이면 이긴다)</span>${seg('npcdef',[['npc','상대'],['pc','우리']],F.npcDef)}</div>
      <div id="so_lad"></div></div>
     <div class="skstep"><div class="skh"><i>4</i>적합 <small>맞으면 하나마다 +1 · 최대 +3</small></div>
      <div class="fr" style="align-items:flex-start"><span class="lbl">타입</span><span class="chips sktys">${TYPES.map(ty=>{const c=tyCol(ty);return `<span class="chip skty ${F.fit.types.includes(ty)?'on':''}" data-fty="${ty}" style="--tb:${c.bg};--tf:${c.fg}">${ty}</span>`}).join('')}</span></div>
      <div class="fr"><span class="lbl">기술</span><input type="text" id="so_fmv" value="${esc(F.fit.moves.join(', '))}" placeholder="예) 사이코키네시스, 고속이동 (쉼표로)" style="flex:1;min-width:0"></div>
      <div class="fr"><span class="lbl">기술 위력</span><input type="number" class="n xs" id="so_fpow" min="0" step="10" value="${+F.fit.pow||''}" placeholder="0"><span class="small dim">이상</span><select id="so_fpt"><option value="">아무 타입 기술</option>${TYPES.map(ty=>`<option ${F.fit.powType===ty?'selected':''}>${ty}</option>`).join('')}</select><span class="small dim">기술 이름 · 위력 · 특성 중 하나만 맞아도 +1</span></div>
      <div class="fr"><span class="lbl">특성</span><input type="text" id="so_fab" value="${esc(F.fit.abil.join(', '))}" placeholder="예) 위협" style="flex:1;min-width:0"></div>
      <div class="fr"><span class="lbl">기타</span><input type="text" id="so_fetc" value="${esc(F.fit.etc)}" placeholder="예) 물에 뜰 수 있는 포켓몬 — 굴릴 때 고르면 +1" style="flex:1;min-width:0"></div></div>
     <details class="skstep skmod" ${F.pm||F.twice?'open':''}><summary class="skh"><i>5</i>상황 보정 <small id="so_modsum"></small></summary>
      <div class="fr"><span class="lbl">± 보정</span>${seg('pm',[[-2,'−2'],[-1,'−1'],[0,'없음'],[1,'+1'],[2,'+2']],F.pm)}<span class="small dim">도구 · 환경 · 준비 · 서두름</span></div>
      <div class="fr"><span class="lbl">두 번 굴리기</span>${seg('twice',[[-1,'낮은 값'],[0,'없음'],[1,'높은 값']],F.twice)}<span class="small dim">굉장히 유리 / 불리</span></div></details>
     <div class="skstep"><div class="skh"><i>6</i>실패하면 <small>트레이너 상태 단계 + 판정한 포켓몬의 패널티 묶음</small></div><div class="fr"><span class="lbl">상태 단계</span>${seg('nostep',[[0,'한 단계 오른다 (기본)'],[1,'오르지 않는다']],F.noStep?1:0)}</div>${penBox(F.pen)}</div>
     <div class="skprev"><div class="skh">미리보기 <small>이대로 제시하면</small></div><div id="so_prev"></div></div>
     <div class="row skgo"><span class="small dim">제시하면 로그에 카드가 나가고, 대상은 상단 「스킬 체크」에서 굴린다</span><span class="sp"></span><button class="btn pri big" data-sk="offer">제시 (모두에게)</button></div></div>
    <div class="skcard"><div class="sec">최근 판정 <span class="note">${(K.hist||[]).length}</span></div><div class="skhist">${(K.hist||[]).slice(-12).reverse().map(h=>`<div style="border-left-color:${COL[h.ri]||'#555'}">${esc(h.text)}</div>`).join('')||'<span class="dim small">없음</span>'}</div></div>`;
  const statusTab=`<div class="skcard"><div class="sec">트레이너 상태 <span class="note">상태 단계 · 묘수 · 초상 능력 · 동행</span></div>
     <div class="sklist">${Object.values(T).map(t=>{const k=tsk(t.id);const mm=myosuMax(t),sm=supMax(t);const comp=k.comp.map(id=>(mons()[id]||{}).name).filter(Boolean);
      return `<div class="skrow wrap">${av(t.image,t.name,'big')}<div class="skwho"><b>${esc(t.name)}</b><small>${SK.map(s=>s+' '+esc(rankOf(t,s)||'-')).join(' · ')}</small></div>
       <span class="skstat"><small>상태</small>${seg('inj_'+t.id,STEP.map((n,i)=>[i,n]),k.inj)}</span>
       <span class="skstat"><small>묘수</small><b>${mm?k.myosu+'/'+mm:'—'}</b></span><span class="skstat"><small>초상 능력</small><b>${sm?k.sup+'/'+sm:'—'}</b></span><span class="skstat"><small>강인함</small><b>${tough(t)?'○':'—'}</b></span>
       <span class="skstat"><small>동행 (${compCap(t.id,'rp')})${k.swap?' · 교대 가능':''}</small><span class="skprow">${k.comp.filter(id=>mons()[id]).map(id=>`${av(mons()[id].image,mons()[id].name)}<b style="font-size:12px">${esc(mons()[id].name)}</b>`).join('')||'<b>—</b>'}</span></span><span class="sp"></span><button class="btn xs ghost" data-sk="resetone" data-tid="${t.id}">초기화</button></div>`}).join('')||'<div class="dim small">로스터에 트레이너가 없다</div>'}</div>
     <div class="row" style="margin-top:10px;gap:6px"><button class="btn" data-sk="scene" title="빈사인 트레이너를 중상으로 되돌린다">장면 끝 (빈사 → 중상)</button><button class="btn ghost" data-sk="session" title="묘수 · 초상 능력 · 상태 단계 모두 초기화">세션 시작 (전부 초기화)</button><span class="sp"></span><span class="small dim">휴식은 「휴식」 탭에서 단계별로</span></div></div>`;
  const restTab=(()=>{const kind=F.restKind||'long';const R=restCfg(kind);const kn=KINDS.find(k=>k[0]===kind);
   const tg=(k,lab,sub)=>`<label class="skrow tog ${+R[k]?'on':''}"><input type="checkbox" data-rest="${k}" ${+R[k]?'checked':''} hidden><i class="sw"></i><div><b>${lab}</b>${sub?`<small>${sub}</small>`:''}</div></label>`;
   const amt=(k,lab,list)=>`<div class="fr"><span class="lbl">${lab}</span>${seg('rest_'+k,list,list.some(o=>String(o[0])===String(R[k]))?String(R[k]):'x')}<input type="text" class="n xs" data-restv="${k}" value="${list.some(o=>String(o[0])===String(R[k]))?'':esc(R[k])}" placeholder="직접"></div>`;
   const nsel=(k,lab,sub)=>{const v=String(R[k]==null?'all':R[k]);const isN=v!=='all'&&v!=='0';return `<div class="skrow on"><div style="flex:1"><b>${lab}</b>${sub?`<small>${sub}</small>`:''}</div>${seg('rest_'+k,[['0','안 함'],['all','전부'],['n','개수']],isN?'n':v)}<input type="number" class="n xs" data-restn="${k}" value="${isN?esc(v):''}" placeholder="개" style="${isN?'':'visibility:hidden'}"></div>`};
   return `<div class="skcard"><div class="sec">휴식 단계 <span class="note">종류마다 따로 저장 · 선언하면 로스터 트레이너 전원과 소지 포켓몬에 적용 · 휴대폰 캘린더의 「회복」은 자기만</span></div>
    <div class="fr">${seg('restkind',KINDS.map(k=>[k[0],k[1]+' · '+k[2]]),kind)}<span class="sp"></span><button class="btn pri" data-sk="restgo">「${kn[1]}」 선언 (전원)</button></div>
    <div class="skcols"><div><div class="sec">포켓몬</div>${amt('hp','「HP」 회복',[['0','회복 안 함'],['1/4','1/4'],['1/2','1/2'],['full','전부']])}${tg('hp_one','1체만 회복','일행 전체에서 가장 다친 포켓몬 하나만 (숨돌리기 기본)')}
      ${tg('revive','빈사 포켓몬 부활','「HP」 0 인 포켓몬을 일으킨다')}${+R.revive?amt('revive_hp','부활 시 「HP」',[['1','1'],['1/4','1/4'],['1/2','1/2'],['full','전부']]):''}
      ${tg('cure_ab','상태 이상 치유','독 · 화상 · 마비 · 잠듦 · 얼음 등')}${tg('cure_sp','상태 변화 치유','혼란 · 랭크 외 일시 효과 등')}
      ${nsel('pot_pk_n','전용 포텐셜 횟수 회복','배틀에 있는 소지 포켓몬 (개수면 트레이너당 합계)')}</div>
     <div><div class="sec">트레이너</div>${nsel('ord_n','4식 6령 회복','전부 = 제작한 값으로 (트레이너마다)')}<div class="skrow on"><div style="flex:1"><b>파티 4식 · 6령 회복</b><small>일행 전체에서 합쳐 n 개</small></div>4식 <input type="number" class="n xs" data-restp="ord_po" value="${+R.ord_po||0}" min="0" max="9"> 6령 <input type="number" class="n xs" data-restp="ord_pc" value="${+R.ord_pc||0}" min="0" max="9"></div>${nsel('pot_tr_n','고유 포텐셜 횟수 회복','횟수 제한이 있는 고유 포텐셜')}
      ${tg('inou','초상 능력 횟수 회복','능력 A 이상의 특화')}${tg('swap','동행 포켓몬 교대 가능','쉰 뒤 다음 제시까지 플레이어가 동행(등장) 포켓몬을 바꿀 수 있다')}
      ${nsel('key_n','은열쇠 회복','덱 자원 「은열쇠」 — 전부 = 최대치까지 (GM 화면에서 선언할 때)')}
      <div class="skrow on"><div style="flex:1"><b>상태 단계 회복</b><small>빈사 → 중상 → 부상 → 건강</small></div>${seg('rest_inj_n',[[0,'안 함'],[1,'1단계'],[2,'2단계'],[3,'전부']],+R.inj_n||0)}</div></div></div>
    <div class="row" style="margin-top:10px"><button class="btn ghost" data-sk="restdef">「${kn[1]}」 기본값</button><span class="sp"></span><button class="btn" data-sk="restsave">「${kn[1]}」 설정 저장</button></div></div>`})();
  const cfgTab=(()=>{const D=A().ST.state.deck2||{};const decks=Object.entries(D.decks||{});const dk=(D.decks||{})[C.cards.deck];const cards=dk?Object.entries(dk.cards||{}):[];
   const csel=(k,lab)=>`<label>${lab} <select id="sc_${k}" ${dk?'':'disabled'}><option value="">없음</option>${cards.map(([cid,c])=>`<option value="${esc(cid)}" ${C.cards[k]===cid?'selected':''}>${esc(c.n||cid)}</option>`).join('')}</select></label>`;
   return `<div class="skcard"><div class="sec">판정</div><div class="skcfg">
     <label>대성공: 목표 + <input type="number" class="n xs" id="sc_crit" value="${C.crit}" min="1" max="12"> 이상 (6·6 은 언제나)</label></div>
    <div class="sec" style="margin-top:10px">상태 단계</div><div class="skcfg">
     <label>부상: 모든 판정 − <input type="number" class="n xs" id="sc_injPen" value="${C.injPen}" min="0" max="5"></label><label>부상 될 때 6령 <input type="number" class="n xs" id="sc_injOc" value="${C.injOc}" min="0" max="5"> 개 소실</label><label>중상 될 때 4식 <input type="number" class="n xs" id="sc_injOo" value="${C.injOo}" min="0" max="5"> 개 소실</label></div>
    <div class="sec" style="margin-top:10px">커버</div><div class="skcfg">
     <label>커버한 포켓몬 대미지 (최대 HP) <input type="text" class="n xs" id="sc_coverHp" value="${esc(C.coverHp)}" placeholder="1/4"></label><label class="tg"><input type="checkbox" id="sc_coverBall" ${+C.coverBall?'checked':''}> 볼 안의 포켓몬도 커버할 수 있다</label></div>
    <div class="sec" style="margin-top:10px">포켓몬 · 특화 횟수</div><div class="skcfg">
     <label>필드 포켓몬 수 (배틀 밖 던전) <input type="number" class="n xs" id="sc_fieldMax" value="${C.fieldMax}" min="1" max="6"></label>
     <label>묘수 A <input type="number" class="n xs" id="sc_myosuA" value="${C.myosuA}"></label><label>묘수 AA <input type="number" class="n xs" id="sc_myosuAA" value="${C.myosuAA}"></label>
     <label>초상 능력 A <input type="number" class="n xs" id="sc_supA" value="${C.supA}"></label><label>초상 능력 AA <input type="number" class="n xs" id="sc_supAA" value="${C.supAA}"></label>
     <label class="tg"><input type="checkbox" id="sc_penAuto" ${C.penAuto?'checked':''}> 패널티 묶음 자동 적용 (기본)</label></div>
    <div class="sec" style="margin-top:10px">덱 연동 · 상태 카드 <span class="note">단계가 바뀌면 그 트레이너 손패에 이 카드 하나만 둔다 (GM 화면이 켜져 있을 때)</span></div><div class="skcfg">
     <label>덱 <select id="sc_deck"><option value="">쓰지 않음</option>${decks.map(([id,x])=>`<option value="${esc(id)}" ${C.cards.deck===id?'selected':''}>${esc(x.name||id)}</option>`).join('')}</select></label>${csel('c1','부상')}${csel('c2','중상')}${csel('c3','빈사')}</div>
    <div class="row" style="margin-top:10px"><span class="small dim">휴식 단계의 내용은 「휴식」 탭, 제시 예시는 「제시」 탭의 저장 버튼</span><span class="sp"></span><button class="btn pri" data-sk="cfgsave">저장</button></div></div>`})();
  const md=A().openModal(`<div class="mhead"><h2>스킬 체크 <span class="small dim">GM</span></h2><span class="tabs2" style="margin-left:14px;flex:0 1 420px">${[['offer','제시'],['status','상태'],['rest','휴식'],['cfg','설정']].map(([k,n])=>`<button class="tab2 ${tab===k?'on':''}" data-skt="${k}">${n}</button>`).join('')}</span><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="skwrap">${tab==='offer'?offerTab:tab==='status'?statusTab:tab==='rest'?restTab:cfgTab}</div>`);
  md.classList.add('wide');bindSeg(md);
  const re=t=>{A().closeModal();openGm(t||tab)};
  md.querySelectorAll('[data-skt]').forEach(b=>b.onclick=()=>{if(tab==='offer')grabOffer(md);re(b.dataset.skt)});
  if(tab==='offer'){
   md.querySelectorAll('[data-diff]').forEach(c=>c.onclick=()=>{$('#so_target',md).value=c.dataset.diff;md.querySelectorAll('[data-diff]').forEach(x=>x.classList.toggle('on',x===c));prev()});
   md.querySelectorAll('[data-fty]').forEach(c=>c.onclick=()=>{c.classList.toggle('on');prev()});
   md.querySelectorAll('[data-so-id]').forEach(cb=>cb.onchange=()=>{cb.closest('.chip').classList.toggle('on',cb.checked);prev()});
   /* 미리보기: 결과 칸 + 대상마다 고를 수 있는 포켓몬 · 혼자 · 초상 능력의 확률 */
   const prev=()=>{const o={stat:segVal(md,'stat')||'지시',base:+segVal(md,'base')||0,scene:segVal(md,'scene')||'rp',target:+($('#so_target',md)||{}).value||0,pm:+segVal(md,'pm')||0,twice:+segVal(md,'twice')||0,
     fit:{types:[...md.querySelectorAll('[data-fty].on')].map(x=>x.dataset.fty),moves:splitL($('#so_fmv',md).value),abil:splitL($('#so_fab',md).value),pow:+(($('#so_fpow',md)||{}).value)||0,powType:(($('#so_fpt',md)||{}).value)||''}};
    const nv=+segVal(md,'npc')||0;const npc=NPC.find(x=>x[0]===nv&&nv);const nr=$('#so_npcrow',md);if(nr)nr.style.display=npc?'':'none';
    if(npc){const mi=$('#so_npcmod',md);if(npc[2]!=null&&mi&&mi.dataset.npc!==String(nv)){mi.value=npc[2]}if(mi)mi.dataset.npc=String(nv);o.npc=npc[1];o.npcMod=+mi.value||0;o.npcDef=segVal(md,'npcdef')||'npc'}
    const ms=[o.pm?(o.pm>0?'유리 ':'불리 ')+sgn(o.pm):'',o.twice?'두 번 굴려 '+(o.twice>0?'높은':'낮은')+' 값':''].filter(Boolean);const sm=$('#so_modsum',md);if(sm)sm.textContent=ms.length?ms.join(' · '):'없음 — 눌러서 열기';
    const L=$('#so_lad',md);if(L)L.innerHTML=npc?`<div class="small dim skinfo">목표 = 굴릴 때 상대가 2d6${sgn(o.npcMod)} 를 굴린 값${o.npcDef==='pc'?' (같으면 우리가 이긴다)':' 보다 높아야 이긴다'}</div>`:ladder(o.target);
    const ids=[...md.querySelectorAll('[data-so-id]:checked')].map(x=>x.dataset.soId);const P=$('#so_prev',md);if(!P)return;
    if(!ids.length){P.innerHTML='<span class="small dim">대상을 고르면 각자 무엇을 굴리는지 보인다</span>';return}
    P.innerHTML=`<div class="sklist">${ids.map(id=>{const t=trs()[id];if(!t)return '';const k=tsk(id);if(k.inj>=3)return `<div class="skrow"><b>${esc(t.name)}</b><span class="sp"></span><span class="small warn">빈사 — 이 장면에 참가할 수 없다</span></div>`;
     const op=optionsOf(id,o);const cp=compOf(id,o.scene);
     return `<div class="skrow wrap">${av(t.image,t.name)}<b>${esc(t.name)}</b><span class="small dim">${esc(o.stat)} ${esc(rankOf(t,o.stat)||'D')}${k.inj?' · '+STEP[k.inj]:''}${cp.battle?' · 배틀 에리어':''}${!cp.ids.length?` · ${SCN[o.scene]} 포켓몬 없음`:''}</span><span class="sp"></span><span class="skprow">${op.map(x=>{const m=x.mid?mons()[x.mid]:null;return `<span class="skpp skpo" title="${esc(x.c.parts.map(p=>p[0]+' '+sgn(p[1])).join(' · '))}">${m?av(m.image,m.name):`<i class="skav">${x.how==='super'?'超':'—'}</i>`}${esc(x.name)} 2d6${sgn(x.c.mod)} <b>${pct(x.o.ok)}</b></span>`}).join('')}</span></div>`}).join('')}</div>`};
   md.addEventListener('segchange',prev);['#so_target','#so_fmv','#so_fab','#so_npcmod','#so_fpow'].forEach(s=>{const i=$(s,md);if(i)i.addEventListener('input',prev)});{const fp=$('#so_fpt',md);if(fp)fp.addEventListener('change',prev)}
   prev();
   md.querySelectorAll('[data-rk]').forEach(b=>b.onclick=()=>{grabOffer(md);const [t,k,dv]=b.dataset.rk.split('.');const X=penNorm(F.pen[t]);X.rk[k]=Math.max(-6,Math.min(6,(+X.rk[k]||0)+ +dv));F.pen[t]=X;re('offer')});
   const ex=$('#so_ex',md);if(ex)ex.onchange=()=>{const v=ex.value;if(!v)return;grabOffer(md);if(v.startsWith('ex:'))loadPreset(EX[+v.slice(3)].o);else{const p=presets.find(p=>p.id===v.slice(3));if(p)loadPreset(p.o)}re('offer')};
   md.querySelectorAll('[data-penex]').forEach(sl=>sl.onchange=()=>{const p=penExGet(sl.value);if(!p)return;grabOffer(md);F.pen.fail=penNorm(JSON.parse(JSON.stringify(p)));F.penOpen=true;re('offer')});
   const pa=$('#pen_auto',md);if(pa)pa.onchange=async()=>{await A().set(['skill','cfg'],Object.assign({},st().cfg||{},{penAuto:pa.checked?1:0}))}}
  if(tab==='cfg'){const dsel=$('#sc_deck',md);if(dsel)dsel.onchange=async()=>{await A().set(['skill','cfg'],Object.assign({},st().cfg||{},{cards:{deck:dsel.value,c1:'',c2:'',c3:''}}));re('cfg')}}
  function grabRest(){const kind=F.restKind||'long';const R=restCfg(kind);md.querySelectorAll('[data-rest]').forEach(cb=>R[cb.dataset.rest]=cb.checked?1:0);
   for(const k of ['hp','revive_hp']){if(!md.querySelector(`[data-seg="rest_${k}"]`))continue;const v=segVal(md,'rest_'+k);const inp=md.querySelector(`[data-restv="${k}"]`);R[k]=(inp&&inp.value.trim())||(v==='x'?R[k]:v)}
   for(const k of ['pot_pk_n','ord_n','pot_tr_n','key_n']){const v=segVal(md,'rest_'+k);const inp=md.querySelector(`[data-restn="${k}"]`);R[k]=v==='n'?String(Math.max(1,+inp.value||1)):v}
   R.inj_n=+segVal(md,'rest_inj_n')||0;md.querySelectorAll('[data-restp]').forEach(i=>R[i.dataset.restp]=Math.max(0,Math.min(9,+i.value||0)));return R}
  if(tab==='rest'){md.addEventListener('segchange',e=>{const sg=e.target.closest('[data-seg]');if(!sg)return;const n=sg.dataset.seg;if(n==='restkind'){F.restKind=e.detail;re('rest')}else if(/^rest_(pot_pk_n|ord_n|pot_tr_n|key_n)$/.test(n)){const inp=md.querySelector(`[data-restn="${n.slice(5)}"]`);inp.style.visibility=e.detail==='n'?'visible':'hidden';if(e.detail==='n'&&!inp.value)inp.value='1'}});
   md.querySelectorAll('[data-rest]').forEach(cb=>cb.onchange=async()=>{cb.closest('.skrow').classList.toggle('on',cb.checked);if(cb.dataset.rest==='revive'){const R=grabRest();await A().set(['skill','rest',F.restKind||'long'],R);re('rest')}})}
  md.querySelectorAll('[data-sk]').forEach(el=>{el.onclick=async()=>{const k=el.dataset.sk;
   if(k==='penopen'){grabOffer(md);F.penOpen=!F.penOpen;return re('offer')}
   if(k==='penclr'){F.pen={fail:PEN0()};return re('offer')}
   if(k==='exmgr'){grabOffer(md);return openExMgr(el.dataset.t||'check')}
   if(k==='pensave'){grabOffer(md);const X=penNorm(F.pen.fail);if(!penHas(X))return A().toast('이 칸이 비어 있다');const name=prompt('패널티 예시 이름',penTxt(X).slice(0,40));if(name==null||!name.trim())return;const list=(st().penPresets||[]).slice();list.push({id:'q'+Date.now().toString(36),name:name.trim(),p:X});await A().set(['skill','penPresets'],list);A().toast('패널티 예시로 저장했다');return re('offer')}
   if(k==='exsave'){grabOffer(md);const name=prompt('예시 이름',F.label||'새 예시');if(name==null||!name.trim())return;const list=(st().presets||[]).slice();list.push({id:'p'+Date.now().toString(36),name:name.trim(),o:presetOf()});await A().set(['skill','presets'],list);A().toast('저장했다');return re('offer')}
   if(k==='offer'){grabOffer(md);const ids=F.ids;if(!ids.length)return A().toast('대상을 골라 줘');
    const o=mkOffer(presetOf(),ids);A().closeModal();await A().set(['skill','offer'],o);await A().set(['skill','res'],{});await clearSwap(ids);
    A().sysLog(offerLog(o),'battle',{});try{window.OM_RP_UI&&window.OM_RP_UI.playSe('Ping2')}catch(e){}return openGm('offer')}
   if(k==='close'){A().closeModal();await A().set(['skill','offer'],null);return A().sysLog('스킬 체크 제시를 거뒀다','battle')}
   if(k==='rollfor'){A().closeModal();return openPlayer(el.dataset.tid)}
   if(k==='settle'){const r=JSON.parse(JSON.stringify((st().res||{})[el.dataset.tid]||null));if(!r||!r.pend)return;A().closeModal();await settleFail(el.dataset.tid,r);await A().set(['skill','res',el.dataset.tid],r);return openGm('offer')}
   if(k==='penapply'){const r=(st().res||{})[el.dataset.tid];if(!r||!O)return;A().closeModal();await applyPenalty(el.dataset.tid,O.pen.fail,(O.label||'스킬 체크')+' · 실패',r.how==='mon'?r.mid:'');await A().set(['skill','res',el.dataset.tid,'penDone'],1);return openGm('offer')}
   if(k==='resetone'){await A().set(['skill','trainers',el.dataset.tid],Object.assign({myosu:0,sup:0,inj:0},{comp:tsk(el.dataset.tid).comp}));return re('status')}
   if(k==='scene'){await sceneEnd();return re('status')}
   if(k==='session'){if(!confirm('묘수 · 초상 능력 · 상태 단계를 모두 초기화할까? (동행 지정은 남긴다)'))return;A().closeModal();const N={};for(const [tid,x] of Object.entries(st().trainers||{}))N[tid]={myosu:0,sup:0,inj:0,comp:(x&&x.comp)||[]};await A().set(['skill','trainers'],N);await A().set(['skill','hist'],[]);return A().sysLog('◆ 세션 시작 — 스킬 체크 자원 · 상태 단계 모두 초기화','battle')}
   if(k==='restsave'){const R=grabRest();await A().set(['skill','rest',F.restKind||'long'],R);A().toast('저장했다');return re('rest')}
   if(k==='restdef'){await A().set(['skill','rest',F.restKind||'long'],null);return re('rest')}
   if(k==='restgo'){const R=grabRest();const kind=F.restKind||'long';const kn=KINDS.find(x=>x[0]===kind)[1];if(!confirm(`「${kn}」 을 선언할까? (로스터 트레이너 전원 · 지금 설정도 저장)`))return;await A().set(['skill','rest',kind],R);A().closeModal();await applyRest(kind,null,{});return}
   if(k==='cfgsave'){const g=id=>$('#'+id,md);const nv=(id,lo,hi,dv)=>{const v=+g(id).value;return isFinite(v)&&g(id).value!==''?Math.max(lo,Math.min(hi,Math.round(v))):dv};
    const n=Object.assign({},st().cfg||{},{crit:nv('sc_crit',1,12,4),injPen:nv('sc_injPen',0,5,1),injOc:nv('sc_injOc',0,5,1),injOo:nv('sc_injOo',0,5,1),coverHp:g('sc_coverHp').value.trim()||'1/4',coverBall:g('sc_coverBall').checked?1:0,fieldMax:nv('sc_fieldMax',1,6,1),
     myosuA:nv('sc_myosuA',0,9,1),myosuAA:nv('sc_myosuAA',0,9,2),supA:nv('sc_supA',0,9,1),supAA:nv('sc_supAA',0,9,2),penAuto:g('sc_penAuto').checked?1:0,
     cards:{deck:g('sc_deck').value,c1:(g('sc_c1')||{}).value||'',c2:(g('sc_c2')||{}).value||'',c3:(g('sc_c3')||{}).value||''}});A().closeModal();await A().set(['skill','cfg'],n);sync();return A().toast('저장했다')}}});
  md.addEventListener('segchange',async e=>{const sg=e.target.closest('[data-seg]');if(!sg)return;const n=sg.dataset.seg;if(n.startsWith('inj_')){await setT(n.slice(4),{inj:+e.detail||0});sync()}})}

 /* ----- 10-24 망령: 예시 관리 창 — 체크 제시 예시 · 패널티 예시를 한 번에 보고 고친다 ----- */
 function exSum(o){return offerSummary(Object.assign({stat:'지시',target:10},upOffer(o||{}),{npc:''}))}
 function openExMgr(tab){tab=tab==='pen'?'pen':'check';const K=st();const isP=tab==='pen';const mine=(isP?K.penPresets:K.presets)||[];const base=isP?PEN_EX:EX;const hid=exHide(tab);const key=isP?'penPresets':'presets';
  const sum=x=>isP?`<span class="exs">${esc(penTxt(x.p))||'<span class="dim">비어 있음</span>'}</span>`:`<span class="exs">${exSum(x.o)}${x.o&&x.o.label?' · 「'+esc(x.o.label)+'」':''}</span>${penLine((x.o||{}).pen)}`;
  const load=(src,i)=>isP?`<button class="btn xs" data-em="lf" data-src="${src}" data-i="${i}" title="제시의 패널티 묶음 칸에 넣는다">→ 묶음</button>`:`<button class="btn xs pri" data-em="load" data-src="${src}" data-i="${i}">불러오기</button>`;
  const rowM=(x,i)=>`<div class="exrow"><div class="exn"><b>${esc(x.name)}</b>${sum(x)}</div><span class="exb">${load('m',i)}${isP?`<button class="btn xs ghost" data-em="edit" data-i="${i}">편집</button>`:`<button class="btn xs ghost" data-em="over" data-i="${i}" title="스킬 체크 창에 지금 적혀 있는 폼으로 바꾼다">덮어쓰기</button>`}<button class="btn xs ghost" data-em="ren" data-i="${i}">이름</button><button class="btn xs ghost" data-em="up" data-i="${i}" ${i?'':'disabled'} title="위로">▲</button><button class="btn xs ghost" data-em="dn" data-i="${i}" ${i<mine.length-1?'':'disabled'} title="아래로">▼</button><button class="btn xs ghost danger" data-em="del" data-i="${i}">삭제</button></span></div>`;
  const rowB=(x,i)=>{const h=hid.includes(x.name);return `<div class="exrow ${h?'off':''}"><div class="exn"><b>${esc(x.name)}</b>${h?' <span class="tag">숨김</span>':''}${sum(isP?x:{o:x.o})}</div><span class="exb">${h?'':load('b',i)}<button class="btn xs ghost" data-em="copy" data-i="${i}" title="내 예시로 복사해서 고친다">복사</button><button class="btn xs ghost" data-em="hide" data-i="${i}">${h?'보이기':'숨기기'}</button></span></div>`};
  const md=A().openModal(`<div class="mhead"><h2>예시 관리 <span class="small dim">스킬 체크</span></h2><span class="tabs2" style="margin-left:14px;flex:0 1 300px">${[['check','체크 제시 예시'],['pen','패널티 예시']].map(([k,n])=>`<button class="tab2 ${tab===k?'on':''}" data-emt="${k}">${n}</button>`).join('')}</span><span class="sp"></span><button class="btn ghost" data-em="back">← 스킬 체크</button></div>
   <div class="skwrap exmgr"><div class="skcard"><div class="sec">내가 저장한 것 <span class="note">${mine.length}</span><span class="sp"></span>${isP?'<button class="btn xs pri" data-em="new">＋ 새 패널티 예시</button>':'<button class="btn xs pri" data-em="newf" title="스킬 체크 창에 적혀 있는 폼을 새 예시로">＋ 지금 폼을 새 예시로</button>'}<button class="btn xs ghost" data-em="exp" title="내 예시를 JSON 파일로 내려받는다">내보내기</button><button class="btn xs ghost" data-em="imp" title="JSON 파일에서 예시를 더한다">가져오기</button></div>
    <div class="exlist">${mine.map(rowM).join('')||`<div class="empty small">아직 없다 — ${isP?'「＋ 새 패널티 예시」나 제시 창 패널티 칸의 「저장」':'스킬 체크 창의 「저장」이나 위 「＋ 지금 폼을 새 예시로」'}로 더한다</div>`}</div></div>
    <div class="skcard"><div class="sec">기본 예시 <span class="note">${base.length} · 숨긴 것은 고르기 목록에 안 나온다</span></div><div class="exlist">${base.map(rowB).join('')}</div></div>
    <input type="file" id="em_file" accept="application/json,.json" hidden></div>`);
  md.classList.add('wide');const re=()=>openExMgr(tab);const save=async L=>{await A().set(['skill',key],L);re()};const back=()=>openGm('offer');
  md.querySelectorAll('[data-emt]').forEach(b=>b.onclick=()=>openExMgr(b.dataset.emt));
  const fi=$('#em_file',md);fi.onchange=async()=>{const f=fi.files[0];if(!f)return;try{const j=JSON.parse(await f.text());const arr=Array.isArray(j)?j:(j[key]||[]);const ok=arr.filter(x=>x&&x.name&&(isP?x.p:x.o)).map(x=>({id:(isP?'q':'p')+Date.now().toString(36)+Math.random().toString(36).slice(2,5),name:String(x.name).slice(0,80),[isP?'p':'o']:isP?penNorm(x.p):x.o}));if(!ok.length)return A().toast('가져올 예시가 없다');await save([...(st()[key]||[]),...ok]);A().toast(`${ok.length}개를 더했다`)}catch(e){A().toast('읽지 못했다: '+e.message)}};
  md.querySelectorAll('[data-em]').forEach(b=>b.onclick=async()=>{const k=b.dataset.em;const i=+b.dataset.i;const L=(st()[key]||[]).slice();const src=b.dataset.src==='b'?base:L;
   if(k==='back')return back();
   if(k==='load'){loadPreset(src[i].o);return back()}
   if(k==='lf'){F.pen.fail=penNorm(JSON.parse(JSON.stringify(src[i].p)));F.penOpen=true;return back()}
   if(k==='newf'){const name=prompt('예시 이름',F.label||'새 예시');if(name==null||!name.trim())return;L.push({id:'p'+Date.now().toString(36),name:name.trim(),o:presetOf()});return save(L)}
   if(k==='over'){if(!confirm(`「${L[i].name}」 를 스킬 체크 창의 지금 폼으로 바꿀까?\n${F.label||'(상황 없음)'} · ${F.stat} + ${BASE[F.base]} · 목표 ${F.target}`))return;L[i]=Object.assign({},L[i],{o:presetOf()});return save(L)}
   if(k==='ren'){const n=prompt('새 이름',L[i].name);if(n==null||!n.trim())return;L[i]=Object.assign({},L[i],{name:n.trim()});return save(L)}
   if(k==='up'||k==='dn'){const j=k==='up'?i-1:i+1;if(j<0||j>=L.length)return;[L[i],L[j]]=[L[j],L[i]];return save(L)}
   if(k==='del'){if(!confirm(`「${L[i].name}」 를 지울까?`))return;L.splice(i,1);return save(L)}
   if(k==='copy'){const x=JSON.parse(JSON.stringify(base[i]));L.push({id:(isP?'q':'p')+Date.now().toString(36),name:x.name+' (내 것)',[isP?'p':'o']:isP?penNorm(x.p):x.o});await A().set(['skill',key],L);if(isP)return openPenEd(L.length-1);return re()}
   if(k==='hide'){const H=Object.assign({check:[],pen:[]},st().exHide||{});const nm=base[i].name;H[tab]=H[tab].includes(nm)?H[tab].filter(x=>x!==nm):[...H[tab],nm];await A().set(['skill','exHide'],H);return re()}
   if(k==='edit')return openPenEd(i);
   if(k==='new')return openPenEd(-1);
   if(k==='exp'){const blob=new Blob([JSON.stringify({[key]:L},null,1)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(isP?'패널티_예시':'체크_예시')+'.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);return}
   if(k==='imp')return fi.click()})}
 /* 패널티 예시 편집 (i = 내 예시 번호, -1 = 새로) */
 function openPenEd(i,X,name){const L=st().penPresets||[];const cur=i>=0?L[i]:null;X=penNorm(X||(cur&&cur.p));name=name!=null?name:(cur?cur.name:'');
  const md=A().openModal(`<div class="mhead"><h2>${cur?'패널티 예시 편집':'새 패널티 예시'}</h2><span class="sp"></span><button class="btn ghost" data-pe="back">← 예시 관리</button></div>
   <div class="skwrap"><div class="skcard"><div class="fr"><span class="lbl">이름</span><input type="text" id="pe_name" value="${esc(name)}" placeholder="예) 반동 — 대미지 1/4" style="flex:1"></div>
    <div class="skpencol pene">${penFields('ed',X)}</div>
    <div class="fr"><span class="lbl">미리 보기</span><span class="small" id="pe_sum">${esc(penTxt(X))||'<span class="dim">비어 있음</span>'}</span></div>
    <div class="row" style="margin-top:10px"><span class="sp"></span><button class="btn" data-pe="back">취소</button><button class="btn pri" data-pe="save">저장</button></div></div></div>`);
  bindSeg(md);const grab=()=>grabPen(md,'ed',X);
  md.querySelectorAll('[data-rk]').forEach(b=>b.onclick=()=>{const Y=grab();const [,k,dv]=b.dataset.rk.split('.');Y.rk[k]=Math.max(-6,Math.min(6,(+Y.rk[k]||0)+ +dv));openPenEd(i,Y,$('#pe_name',md).value)});
  md.addEventListener('input',()=>{const s=$('#pe_sum',md);if(s)s.textContent=penTxt(grab())||'비어 있음'});md.addEventListener('segchange',()=>{const s=$('#pe_sum',md);if(s)s.textContent=penTxt(grab())||'비어 있음'});
  md.querySelectorAll('[data-pe]').forEach(b=>b.onclick=async()=>{if(b.dataset.pe==='back')return openExMgr('pen');const Y=grab();if(!penHas(Y))return A().toast('패널티가 비어 있다');const nm=$('#pe_name',md).value.trim()||penTxt(Y).slice(0,40);const L2=(st().penPresets||[]).slice();
   if(i>=0&&L2[i])L2[i]=Object.assign({},L2[i],{name:nm,p:Y});else L2.push({id:'q'+Date.now().toString(36),name:nm,p:Y});await A().set(['skill','penPresets'],L2);A().toast('저장했다');openExMgr('pen')})}

 /* ----- 플레이어 창 ----- */
 const picOf=m=>`<div class="pic" style="${m&&m.image?`background-image:url('${cssu(m.image)}')`:''}"></div>`;
 /* 10-29 망령 「제시된 체크가 없어도 트레이너가 굴릴 수 있게」: 자유 판정 — 짝 · 목표치를 직접 골라 굴린다. 결과는 skill.free[tid] (제시 결과 res 와 따로) */
 const FREE={};
 function freeOffer(tid){return Object.assign({id:'free',free:1,v:4,label:'자유 판정',scene:'rp',fit:{},pen:{},ids:[tid],npc:''},{stat:'지시',base:3,target:10,pm:0,twice:0,fitN:0,noStep:0},FREE[tid]||{})}
 const resPath=(tid,free)=>['skill',free?'free':'res',tid];
 const resOf=(tid,free)=>(st()[free?'free':'res']||{})[tid];
 function freeHead(tid,O,O0,mine){const sel=(k,L)=>`<select data-fr="${k}">${L.map(([v,n])=>`<option value="${v}" ${String(O[k])===String(v)?'selected':''}>${n}</option>`).join('')}</select>`;
  return `<div class="skot">자유 판정 <span class="small dim">${O0?'이번 제시는 내 대상이 아니다':'제시된 체크 없음'} · 짝과 목표치를 직접 골라 굴린다</span></div>
   ${mine?'':`<div class="skfree"><label>자질 ${sel('stat',SK.map(x=>[x,x]))}</label><label>종족값 ${sel('base',BASE.map((x,i)=>[i,x]))}</label><label>목표 ${sel('target',[[8,'쉬움 8'],[10,'보통 10'],[12,'어려움 12'],[15,'매우 어려움 15']])}</label><label>두 번 굴리기 ${sel('twice',[[0,'없음'],[1,'유리 (높은 값)'],[-1,'불리 (낮은 값)']])}</label><label>적합 ${sel('fitN',[[0,'+0'],[1,'+1'],[2,'+2'],[3,'+3']])}</label><label class="tg"><input type="checkbox" data-fr="noStep" ${+O.noStep?'checked':''}> 실패해도 상태 단계 안 오름</label></div>`}`}
 /* 10-29 망령 「굴림 창에 손패 · 카드 쓰기 · 무덤 확인 · 가져오기」 — 덱의 손패 화면(battleHand)을 그대로 연다 */
 function handHtml(tid){const D=window.OM_DECK_UI;const h=D&&D.handInfo?D.handInfo(tid):null;if(!h)return '';
  return `<div class="skcard"><div class="row"><div class="sec" style="margin:0">손패 <span class="note">${esc(h.name)} · ${h.cards.length}장${h.res?' · '+esc(h.res):''} · 누르면 크게 보고 쓴다</span></div><span class="sp"></span><button class="btn xs" data-hand="grave">🪦 무덤 ${h.disc}</button></div>
   <div class="skhand">${h.cards.map((c,i)=>`<button class="skhc" data-hand="${i}" style="--hc:${c.col}" title="${esc(c.x||'')}">${c.img?`<i style="background-image:url('${cssu(c.img)}')"></i>`:''}<b>${esc(c.n)}</b>${c.c!==''&&c.c!=null?`<em>${esc(c.c)}</em>`:''}</button>`).join('')||'<span class="small dim">손패가 비었다</span>'}</div></div>`}
 function openPlayer(tid){const T=trs();const t=T[tid];if(!t)return;const K=st();const O0=K.offer?upOffer(K.offer):null;const free=!(O0&&((O0.ids||[]).includes(tid)||gm()));const O=free?freeOffer(tid):O0;const k=tsk(tid);const C=cfg();const R=resOf(tid,free);const mine=R&&R.offerId===O.id?R:null;
  const scene=O.scene;const cp=compOf(tid,scene);const own=Object.values(mons()).filter(m=>m.tid===tid&&alive(m));const mm=myosuMax(t),sm=supMax(t);
  const isMe=gm()||tid===me();
  const compCard=`<div class="skcard"><div class="sec">${SCN[scene]} 포켓몬 <span class="note">${cp.battle?'배틀 에리어에 나온 포켓몬 (자동)':scene==='field'?`던전 · 배틀 밖 필드 — ${cp.cap}체까지`:`RP 장면 — ${cp.cap}체까지${qLv(t,'통솔')>=3?' (통솔 특화)':''}`} · 판정과 커버에 쓴다</span></div>
    <span class="skprow">${cp.ids.map(id=>`${av(mons()[id].image,mons()[id].name,'big')}<b>${esc(mons()[id].name)}</b>`).join('')||'<span class="small dim">없음</span>'}</span>
    ${cp.battle?'':`<div class="small dim" style="margin-top:4px">무대 바의 포켓몬 아이콘 아래 「동행」을 눌러 정한다${compLock(tid)?' · '+esc(compLock(tid)):k.swap?' · 지금 교대할 수 있다':''}${gm()?' · GM 은 아래에서 바로':''}</div>${gm()?`<span class="chips">${own.map(m=>`<span class="chip ${cp.ids.includes(m.id)?'on':''}" data-comp="${m.id}">${esc(m.name)}</span>`).join('')}</span>`:''}`}</div>`;
  const md=A().openModal(`<div class="mhead"><h2>스킬 체크 <span class="small dim">${esc(t.name)}</span></h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="skwrap">
   <div class="skme">${av(t.image,t.name,'big')}<div class="skranks">${SK.map(s=>`<span><small>${s}</small><b>${esc(rankOf(t,s)||'-')}</b><em>${sgn(qLv(t,s))}</em></span>`).join('')}</div>
    <div class="skres2"><span class="skstat" style="border-bottom-color:${STEPC[k.inj]}"><small>상태</small><b>${STEP[k.inj]}</b></span><span class="skstat"><small>묘수</small><b>${mm?(mm-k.myosu)+'/'+mm:'—'}</b></span><span class="skstat"><small>초상 능력</small><b>${sm?(sm-k.sup)+'/'+sm:'—'}</b></span>${tough(t)?'<span class="skstat"><small>강인함</small><b>○</b></span>':''}</div></div>
   ${k.inj===1?`<div class="small ${tough(t)?'dim':'warn'}" style="margin:4px 0">부상 — ${tough(t)?'강인함으로 판정 패널티 없음':'모든 판정 −'+C.injPen}</div>`:k.inj===2?'<div class="small warn" style="margin:4px 0">중상 — 모든 판정 불리 (두 번 굴려 낮은 값)</div>':''}
   ${compCard}
   ${`
   <div class="skcard ${free?'':'hit'}"><div class="skoffer">${free?freeHead(tid,O,O0,mine):`<div class="skot">${esc(O.label||'스킬 체크')}</div><div class="skos">${offerSummary(O)}</div>${penLine(O.pen)}`}${O.npc?'':ladder(free&&mine?mine.target:O.target,mine?mine.total:null)}</div>
    ${mine?resultHtml(mine,t,k)+(free&&!mine.pend?'<div class="row" style="margin-top:8px"><span class="sp"></span><button class="btn sm pri" data-freenew="1">새로 굴리기</button></div>':''):k.inj>=3?'<div class="small warn" style="margin-top:8px">빈사 — 이 장면에는 참가할 수 없다. 장면이 끝나면 중상으로 돌아온다.</div>':(()=>{const op=optionsOf(tid,O);
     return `<div class="sec">누구와 굴릴까 <span class="note">${esc(O.stat)} + ${BASE[O.base]}</span></div>
    <div class="skopts" id="monpick">${op.map(x=>{const off=x.how==='super'&&x.left<=0;const m=x.how==='mon'?mons()[x.mid]:null;
      const sub=x.how==='mon'?`${BASE[O.base]} ${baseVal(m,O.base)} (${RKN[baseLv(baseVal(m,O.base))]})${fitOf(m,O).length?' · 적합 '+fitOf(m,O).length:''}`:x.how==='super'?`혼자 · 자질 ×2 · 『고유』 범위만 · 남은 ${x.left}회`:'포켓몬 없이 · 종족값 · 적합 없음';
      return `<div class="skopt ${x.how==='alone'?'alone':x.how==='super'?'inou':''} ${off?'off':''}" data-how="${x.how}" ${x.mid?`data-mid="${x.mid}"`:''}>${x.how==='mon'?picOf(m):`<div class="pic">${x.how==='super'?'超':'—'}</div>`}<div><b>${esc(x.name)}</b><small>${esc(sub)}</small></div><em>${sgn(x.c.mod)}</em></div>`}).join('')}</div>
    ${!cp.ids.length?`<div class="small dim">${SCN[scene]} 포켓몬을 위에서 지정하면 함께 굴릴 수 있다</div>`:''}
    ${O.fit&&O.fit.etc?`<label class="small tg" style="display:block;margin-top:4px"><input type="checkbox" id="sk_etc"> 기타 적합 +1 — ${esc(O.fit.etc)} (GM 이 인정한 경우)</label>`:gm()?'<label class="small tg" style="display:block;margin-top:4px"><input type="checkbox" id="sk_etc"> 기타 적합 +1 (GM 인정)</label>':''}
    <div class="skformula" id="sk_formula"></div>
    <div class="row" style="margin-top:10px"><label class="small" title="GM 이 따로 말한 ± 보정">추가 보정 <input type="number" class="n xs" id="sk_bonus" value="0"></label><span class="sp"></span><button class="btn pri big" id="sk_roll">굴리기</button></div>`})()}
   </div>`}
   <div id="sk_hand">${handHtml(tid)}</div>
   ${free?'':coverHtml(tid,O,K)}</div>`);
  md.classList.add('wide');
  const sel=md.querySelector('#monpick');
  const choice=()=>{const on=sel&&sel.querySelector('.skopt.on');if(!on)return null;return {how:on.dataset.how,mid:on.dataset.mid||'',etc:on.dataset.how==='mon'&&!!($('#sk_etc',md)||{}).checked,bonus:+($('#sk_bonus',md)||{}).value||0}};
  const formula=()=>{const F_=$('#sk_formula',md),rb=$('#sk_roll',md);if(!F_||!O)return;const ch=choice();
   if(!ch){F_.innerHTML='<span class="dim">위에서 함께 굴릴 포켓몬 · 혼자 · 초상 능력 중 하나를 고른다</span>';if(rb)rb.textContent='굴리기';return}
   const c=calcOf(tid,O,ch);const o=oddsFor(c,O);
   F_.innerHTML=`<span class="skdie"><small>2d6${c.tw?(c.tw>0?' 두 번 높은':' 두 번 낮은'):''}</small>🎲</span>${c.parts.map(p=>`<em>${p[1]<0?'−':'+'}</em><span class="skdie"><small>${esc(p[0])}</small>${Math.abs(p[1])}</span>`).join('')}<em>vs</em><span class="skdie tg"><small>목표</small>${O.npc?esc(O.npc)+' 2d6'+sgn(+O.npcMod||0):O.target}</span><span class="sp"></span><span class="skpp">성공 <b>${pct(o.ok)}</b> · 대성공 <b>${pct(o.crit)}</b></span>`;
   if(rb)rb.textContent=`굴리기 · 2d6${sgn(c.mod)}`};
  if(sel)sel.querySelectorAll('.skopt').forEach(el=>el.onclick=()=>{if(el.classList.contains('off'))return;sel.querySelectorAll('.skopt').forEach(x=>x.classList.toggle('on',x===el));formula()});
  {const bi=$('#sk_bonus',md);if(bi)bi.addEventListener('input',formula);const ei=$('#sk_etc',md);if(ei)ei.addEventListener('change',formula)}formula();
  const rb=$('#sk_roll',md);if(rb)rb.onclick=()=>{const ch=choice();if(!ch)return A().toast('누구와 굴릴지 먼저 골라 줘');roll(tid,O,ch)};
  md.querySelectorAll('[data-comp]').forEach(b=>b.onclick=async()=>{await setComp(tid,b.dataset.comp);A().closeModal();openPlayer(tid)});
  md.querySelectorAll('[data-myosu]').forEach(b=>b.onclick=()=>myosu(tid,free));
  md.querySelectorAll('[data-accept]').forEach(b=>b.onclick=async()=>{const r=JSON.parse(JSON.stringify(resOf(tid,free)||null));if(!r||!r.pend)return;A().closeModal();await settleFail(tid,r);await A().set(resPath(tid,free),r);setTimeout(()=>openPlayer(tid),200)});
  md.querySelectorAll('[data-fr]').forEach(el=>el.onchange=()=>{const f=FREE[tid]=Object.assign({},FREE[tid]||{});f[el.dataset.fr]=el.type==='checkbox'?(el.checked?1:0):(el.dataset.fr==='stat'?el.value:+el.value);
   if(el.dataset.fr==='stat'&&!(FREE[tid]||{}).baseSet)f.base=BASE_OF[el.value]??3;if(el.dataset.fr==='base')f.baseSet=1;A().closeModal();openPlayer(tid)});
  md.querySelectorAll('[data-freenew]').forEach(b=>b.onclick=async()=>{A().closeModal();await A().set(resPath(tid,true),null);setTimeout(()=>openPlayer(tid),150)});
  const bindHand=()=>{const box=$('#sk_hand',md);if(!box)return;box.querySelectorAll('[data-hand]').forEach(b=>b.onclick=()=>{const D=window.OM_DECK_UI;if(!D)return;const v=b.dataset.hand;
   D.battleHand(tid,{where:'rp',grave:v==='grave',focus:v==='grave'?-1:+v,onClose:()=>[400,1500,3500].forEach(ms=>setTimeout(()=>{if(document.body.contains(box)){box.innerHTML=handHtml(tid);bindHand()}},ms))})})};bindHand();
  md.querySelectorAll('[data-cover]').forEach(b=>b.onclick=()=>cover(b.dataset.cover,b.dataset.mid))}
 /* 커버 칸: 이 제시에서 실패해 단계가 오른 사람 · 그 단계를 막아 줄 수 있는 내 포켓몬 (판정하지 않은 동행 · 필드, 설정이면 볼 안도) */
 function coverCands(byTid,r,scene){const C=cfg();const pool=+C.coverBall?Object.values(mons()).filter(m=>m.tid===byTid&&alive(m)).map(m=>m.id):compOf(byTid,scene).ids;return pool.filter(id=>id!==r.mid)}
 function coverHtml(tid,O,K){if(!O)return '';const T=trs();const R=K.res||{};const C=cfg();const can=(gm()||tid===me());
  const list=Object.keys(R).filter(id=>{const r=R[id];return r&&r.offerId===O.id&&r.ri===1&&r.step&&r.step.now>r.step.prev&&!r.cover});if(!list.length)return '';
  const mineIds=gm()?(O.ids||[]):[tid];
  return `<div class="skcard"><div class="sec">커버 <span class="note">판정하지 않은 포켓몬이 최대 HP ${esc(C.coverHp)} 대미지를 받고 그 단계를 막는다 · 패널티 묶음은 그대로</span></div><div class="sklist">${list.map(id=>{const r=R[id];
   const btns=can?mineIds.flatMap(by=>coverCands(by,r,O.scene).map(mid=>{const m=mons()[mid];return `<button class="btn xs" data-cover="${id}" data-mid="${mid}">${esc(m.name)}${by!==tid||gm()?' ('+esc((T[by]||{}).name)+')':''}로 막기 · HP −${frac(m.hp.max,C.coverHp)}</button>`})):[];
   return `<div class="skrow wrap"><b>${esc((T[id]||{}).name)}</b><span class="tag">${STEP[r.step.prev]} → ${STEP[r.step.now]}</span><span class="sp"></span>${btns.join('')||'<span class="small dim">막아 줄 포켓몬이 없다</span>'}</div>`}).join('')}</div></div>`}
 function resultHtml(r,t,k){const mm=myosuMax(t);const canMyosu=r.pend&&mm>k.myosu;
  const dice=`<div class="skformula"><span class="skdie tot" style="--c:${COL[r.ri]}"><small>2d6${r.rolls&&r.rolls.length>1?' ('+r.rolls.map(x=>x.join('+')).join(' / ')+')':''}</small>${r.dice.join(' + ')}</span>${(r.parts||[]).map(p=>`<em>${p[1]<0?'−':'+'}</em><span class="skdie"><small>${esc(p[0])}</small>${Math.abs(p[1])}</span>`).join('')}<em>=</em><span class="skdie tot" style="--c:${COL[r.ri]}"><small>합계</small>${r.total}</span><em>vs</em><span class="skdie tg"><small>목표</small>${r.target}</span></div>`;
  return `<div class="skbig" style="background:${COL[r.ri]}"><div class="skbigt">${RES[r.ri]}</div><div class="skbigs">합계 ${r.total} / 목표 ${r.target}${r.npcTxt?' · '+esc(r.npcTxt):''}</div></div>${dice}
   ${r.pend?`<div class="row" style="margin-top:8px;gap:6px"><span class="small">실패 — 묘수로 다시 굴릴 수 있다 (${mm-k.myosu}/${mm})</span><span class="sp"></span>${canMyosu?'<button class="btn sm pri" data-myosu="1">묘수 · 다시 굴리기</button>':''}<button class="btn sm" data-accept="1">실패 받아들이기</button></div>`:''}
   ${r.step?`<div class="small" style="margin-top:4px">상태: ${STEP[r.step.prev]} → <b>${STEP[r.step.now]}</b>${r.cover?` — ${esc(r.cover.name)} 이(가) 막아 「${STEP[r.step.prev]}」 그대로`:''}</div>`:''}
   <details class="skdet"><summary>굴림 자세히</summary><div class="pre small" style="white-space:pre-wrap">${esc(r.text.split('\n').slice(1).join('\n'))}</div></details>`}
 /* 굴리기 */
 async function roll(tid,O,ch){const t=trs()[tid];const k=tsk(tid);const C=cfg();if(k.inj>=3)return A().toast('빈사 — 이 장면에 참가할 수 없다');
  if(ch.how==='super'&&supMax(t)-k.sup<=0)return A().toast('초상 능력 횟수가 없다');
  const c=calcOf(tid,O,ch);let target=+O.target,npcTxt='';
  if(O.npc){const n1=d6(),n2=d6();const nt=n1+n2+(+O.npcMod||0);target=nt+(O.npcDef==='pc'?0:1);npcTxt=`${O.npc} ${n1}+${n2}${sgn(+O.npcMod||0)} = ${nt}${O.npcDef==='pc'?' (같으면 우리)':' (넘어야 이김)'}`}
  const R2=roll2(c.tw);const total=R2.k[0]+R2.k[1]+c.mod;const ri=judge(R2.k,total,target,+C.crit);
  const m=ch.how==='mon'?mons()[ch.mid]:null;
  if(ch.how==='super')await setT(tid,{sup:k.sup+1});
  const lines=[`${ch.how==='mon'?`포켓몬 「${m.name}」`:ch.how==='super'?'초상 능력 (혼자 · 자질 ×2)':'혼자'}`,`2d6 → ${R2.k.join('+')}${R2.all.length>1?` (두 번 ${R2.all.map(x=>x.join('+')).join(', ')} 중 ${c.tw>0?'높은':'낮은'} 값)`:''}${R2.k[0]===1&&R2.k[1]===1?' — 1·1':R2.k[0]===6&&R2.k[1]===6?' — 6·6':''}`,'보정 '+c.parts.map(p=>`${p[0]} ${sgn(p[1])}`).join(' · ')];
  const text=`${O.free?'자유 판정':'스킬 체크'} · ${t.name} · ${O.stat} + ${BASE[O.base]}${O.label?' · '+O.label:''}\n${lines.join('\n')}\n합계 ${total} / 목표 ${target}${npcTxt?' ('+npcTxt+')':''}\n→ ${RES[ri]}`;
  let res={offerId:O.id,tid,label:O.label||'',how:ch.how,mid:ch.mid||'',monName:m?m.name:'',etc:!!ch.etc,bonus:+ch.bonus||0,stat:O.stat,target,npcTxt,parts:c.parts,mod:c.mod,tw:c.tw,dice:R2.k,rolls:R2.all,ri,total,text,at:Date.now()};
  if(O.free){res.base=O.base;res.noStep=+O.noStep||0}
  if(ri===1){if(myosuMax(t)>k.myosu)res.pend=1;else res=await settleFail(tid,res)}
  await A().set(resPath(tid,O.free),res);const hist=(st().hist||[]).slice(-40);hist.push({ri,text:res.text,at:res.at});await A().set(['skill','hist'],hist);
  A().closeModal();A().sysLog(text,'dice');try{if(window.OM_CUTIN)window.OM_CUTIN.phase(RES[ri],`${t.name} · ${O.stat} ${total}/${target}`)}catch(e){}
  sync();setTimeout(()=>openPlayer(tid),300)}
 /* 묘수: 실패한 굴림을 같은 보정으로 다시 */
 async function myosu(tid,free){const t=trs()[tid];const k=tsk(tid);const r=JSON.parse(JSON.stringify(resOf(tid,free)||null));if(!r||!r.pend||myosuMax(t)<=k.myosu)return;
  const R2=roll2(r.tw);r.dice=R2.k;r.rolls=R2.all;r.total=R2.k[0]+R2.k[1]+r.mod;r.ri=judge(R2.k,r.total,r.target,+cfg().crit);r.myosu=1;delete r.pend;
  r.text+=`\n묘수! 다시 2d6 → ${R2.k.join('+')} · 합계 ${r.total} / ${r.target} → ${RES[r.ri]}`;
  await setT(tid,{myosu:k.myosu+1});A().closeModal();A().sysLog(`${t.name} 묘수! 다시 굴려 합계 ${r.total} / ${r.target} → ${RES[r.ri]}`,'dice');
  if(r.ri===1)await settleFail(tid,r);
  await A().set(resPath(tid,free),r);sync();setTimeout(()=>openPlayer(tid),200)}
 /* 커버: 판정하지 않은 포켓몬이 대미지를 받고 단계 진행을 없던 일로 */
 async function cover(forTid,mid){const T=trs();const m=mons()[mid];const r=JSON.parse(JSON.stringify((st().res||{})[forTid]||null));if(!m||!r||r.cover||!r.step)return;const C=cfg();
  if(!confirm(`「${m.name}」 이(가) 최대 HP ${C.coverHp} 대미지를 받고 ${T[forTid].name}의 「${STEP[r.step.now]}」을(를) 막을까?`))return;
  const loss=await hpLoss(mid,C.coverHp);await stepUndo(forTid,r.step);r.cover={by:m.tid,mid,name:m.name,loss};r.text+=`\n커버: ${m.name} HP −${loss} → ${T[forTid].name} 「${STEP[r.step.prev]}」 그대로`;
  await A().set(['skill','res',forTid],r);A().closeModal();A().sysLog(`${(T[m.tid]||{}).name||''}의 ${m.name} 커버! HP −${loss} · ${T[forTid].name} 「${STEP[r.step.now]}」 → 「${STEP[r.step.prev]}」`,'dice');sync();
  setTimeout(()=>openPlayer(gm()?forTid:(me()||forTid)),200)}
 /* 상단 버튼에 제시 표시 */
 function pending(){const O=st().offer;if(!O)return false;const tid=me();if(gm())return true;if(!tid||!(O.ids||[]).includes(tid))return false;const r=(st().res||{})[tid];return !(r&&r.offerId===O.id)||!!r.pend}
 /* 10-26 던전 연계: 방에 넣어 둔 체크를 그대로 제시 (dungeon_ui). 던전은 필드 장면 */
 function presetList(){return [...EX.map((e,i)=>({id:'ex'+i,name:e.name,o:e.o})),...(st().presets||[]).map(p=>({id:p.id,name:p.name,o:p.o}))]}
 async function present(o0,ids,by){if(!gm())return false;const T=trs();ids=(ids||[]).filter(i=>T[i]);if(!ids.length){A().toast('체크를 받을 트레이너가 없다');return false}
  const u=upOffer(o0||{});if(!(o0||{}).scene)u.scene='field';if(TIER[u.auto]&&!+u.npc)u.target=TIER[u.auto];
  const o=mkOffer(u,ids);await A().set(['skill','offer'],o);await A().set(['skill','res'],{});await clearSwap(ids);
  A().sysLog(offerLog(o,by),'battle',{});try{window.OM_RP_UI&&window.OM_RP_UI.playSe('Ping2')}catch(e){}return true}
 const sumOf=o=>offerSummary(Object.assign({stat:'지시',target:10},upOffer(o||{}),{npc:''}));
 const BAND=Object.fromEntries(Object.entries(TIER).map(([k,v])=>[k,[v,v,['쉬움','보통','어려움','매우 어려움'][['easy','normal','hard','vhard'].indexOf(k)]]]));
 return {setComp,compLock,up:upOffer,open,openGm,openPlayer,pending,applyRest,restCfg,KINDS,tsk,cfg,presetList,present,sumOf,autoTarget,oddsOf,BAND,TIER,STEP,stepTxt,sceneEnd,sync};
})();
