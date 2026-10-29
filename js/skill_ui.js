/* ---------- 스킬 체크 (스킬 체크 룰 v3 · 맵툴 skill_gm / skill_mgr / skill_rest / skill_pen 을 옮김) ----------
   자질 주사위: D d4 / C d6 / B d8 / A d10 / AA d12, ± 보정 ±1. 동료 주사위: 포켓몬 d6(『유대』 통솔 판정 d8) / 혼자 d4 / 이능(A 이상) 자기 능력 주사위 하나 더.
   결과: 목표+5 대성공 · 목표 이상 성공 · 1~2 모자람 대가를 치르고 성공 · 그 아래 실패 · 두 주사위 모두 1 대실패(A 이상은 실패).
   상황 보정: 주사위 단계 ±1(d4 아래면 자동 실패, d12 위면 d12+1) · 두 번 굴려 높은/낮은 값 · 숙련(서투름: 자질 최대값이면 −1 / 능숙함: 1이면 +1).
   묘수(지시 A 1회 · AA 2회): 지시 판정 뒤 주사위 하나 다시. 돌봄(육성 B 이상, 휴식 사이 1회): 지친 포켓몬 1체 회복. 이능: 휴식 사이 2회, 실패하면 부상(부상 중이면 중상) + 소지 포켓몬 1체 HP 1/4.
   AA 특권: 세션 1회, 목표 9 이하 이능 판정을 굴리지 않고 성공(이능 1회 소모). 커버: 다른 트레이너가 결과를 한 칸 올리고 부상(중상은 불가). 프라이드 A 고집: 동료 주사위 1 → 대가.
   패널티(맵툴 skill_pen): 제시마다 「실패·대실패」「대가를 치르고 성공」 두 묶음 — 포켓몬 대미지·상태·랭크, 4식/6령 차감, 포텐셜 횟수 −n, 메모. 자동 적용이면 결과가 나오는 즉시 건다.
   휴식(맵툴 skill_rest): 긴 휴식(대대적) · 짧은 휴식(상담함) · 숨돌리기(가벼움) 세 단계. 각 단계의 내용은 「휴식」 탭에서 고친다. 휴대폰 캘린더의 「회복」도 이것을 부른다.
   상태: state.skill = {cfg, rest:{long,mid,short,breath}, presets:[], offer, trainers:{tid:{myosu,care,inou,aa,inj,tired:[mid]}}, res:{tid:{...}}, hist:[]} */
"use strict";
window.OM_SKILL_UI=(()=>{
 const A=()=>window.OM_APP, S=()=>window.OM_STATS, DB=()=>window.OM_DB||{};
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const $=(s,r)=>(r||document).querySelector(s);
 const SK=['지시','육성','통솔','능력'];
 const DIFF=[[5,'쉬움'],[7,'보통'],[9,'어려움'],[11,'매우 어려움']];
 const NPC=[[0,'없음'],[1,'일반인 d4+d4',[4,4]],[2,'일반 트레이너 d6+d6',[6,6]],[3,'숙련 트레이너 d8+d6',[8,6]],[4,'『두목』 d10+d6',[10,6]]];
 const LAD={E:0,D:0,C:1,B:2,A:3,AA:4,AAA:4,S:4},SIDES=[4,6,8,10,12];
 const RES=['대실패','실패','대가를 치르고 성공','성공','대성공'];const COL=['#7a1020','#8a1c2b','#8a6a12','#1f7a4a','#1a6ad8'];
 const RK=[['attack','공격'],['defense','방어'],['specialattack','특공'],['specialdefense','특방'],['speed','스피드'],['accuracy','명중'],['evasion','회피'],['critical','급소']];
 const CFG0={s1:1,s2:2,both1:1,noinou2:1,nocover2:1,hp1:'1/4',hp2:'1/4',rest:1,inou:2,aa:9,myosuA:1,myosuAA:2,penAuto:1};
 const KINDS=[['long','긴 휴식','대대적'],['mid','중간 휴식','반쯤'],['short','짧은 휴식','상담함'],['breath','숨돌리기','가벼움']];   /* 10-28 망령: 중간 휴식 추가 */
 const REST0={long:{hp:'full',revive:1,revive_hp:'full',cure_ab:1,cure_sp:1,pot_pk_n:'all',ord_n:'all',pot_tr_n:'all',tired:1,care:1,inou:1,inj_n:2},
  /* 10-28 망령 「짧은 휴식이 저 정도고 긴 휴식이 전부면 중간 휴식은 적절하게」 — 감우안: 전원 HP 1/2 · 빈사는 HP 1/4 · 상태 회복 ·
     파티 4식 2 · 6령 3(3인 공용 4식 3 · 6령 6 의 절반) · 전용 · 고유 포텐셜 1씩 · 지침 · 돌봄 · 이능 · 부상 1단계 */
  mid:{hp:'1/2',hp_one:0,revive:1,revive_hp:'1/4',cure_ab:1,cure_sp:1,pot_pk_n:'1',ord_n:'0',ord_po:2,ord_pc:3,pot_tr_n:'1',tired:1,care:1,inou:1,inj_n:1},
  /* 10-28 망령(시뮬 맞춤): 짧은 휴식 = (22시: 전원) HP 1/4 · 빈사는 HP 1 · 상태 회복 · 파티 전체 4식 1 · 6령 1 (옛 기본: 전원 HP 1/2 · 상태 변화만) */
  short:{hp:'1/4',hp_one:0,revive:1,revive_hp:'1',cure_ab:1,cure_sp:1,pot_pk_n:'0',ord_n:'0',ord_po:1,ord_pc:1,pot_tr_n:'0',tired:1,care:1,inou:1,inj_n:1},
  /* 10-28 22시 망령: 짧은 휴식은 전원 HP 1/4, 숨돌리기 = 가장 다친 1체 HP 1/4 + 파티 6령 1 */
  breath:{hp:'1/4',hp_one:1,revive:0,revive_hp:'1',cure_ab:0,cure_sp:0,pot_pk_n:'0',ord_n:'0',ord_po:0,ord_pc:1,pot_tr_n:'0',tired:1,care:0,inou:0,inj_n:0}};
 /* 체크 제시 예시 (자주 쓰는 모양). 「저장」으로 내 것을 더할 수 있다 */
 const EX=[
  {name:'정보 수집 (지시 7)',o:{label:'정보 수집',stat:'지시',mode:'skill',target:7}},
  {name:'설득·교섭 (통솔 7)',o:{label:'설득·교섭',stat:'통솔',mode:'skill',target:7}},
  {name:'야생 무리 진정 (육성 7)',o:{label:'겁먹은 야생 무리를 진정시킨다',stat:'육성',mode:'skill',target:7}},
  {name:'추적·수색 (육성 9 · 시간 여유)',o:{label:'흔적을 쫓아 수색',stat:'육성',mode:'skill',target:9,twice:1}},
  {name:'위기 돌파 (능력 9 · 이능 · 반동)',o:{label:'위기 돌파 — 이능',stat:'능력',mode:'inou',target:9,pen:{fail:{dmg:'1/4',memo:'반동으로 휘말린다'},cost:{dmg:'1/8'}}}},
  {name:'대항 — 숙련 트레이너 (지시)',o:{label:'상대 트레이너와 수 싸움',stat:'지시',mode:'skill',target:7,npc:3}},
  {name:'잠입 (지시 9 · 불리 · 실패 시 경계)',o:{label:'들키지 않고 잠입',stat:'지시',mode:'skill',target:9,step:-1,pen:{fail:{memo:'경계 강화 — 다음 배틀 상대 「경계」 상태'},cost:{memo:'흔적을 남김'}}}}];
 /* 10-24 망령: 패널티 예시 (자주 쓰는 묶음). 「저장」으로 내 것을 더하고, 「예시 관리」에서 한 번에 보고 고친다 */
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
  {name:'지시 혼선 — 4식 1개 차감',p:{oo:1}},
  {name:'지쳐 버림 — 6령 1개 차감',p:{oc:1}},
  {name:'고유 포텐셜 1회 소모',p:{pot:{who:'tr',name:'',n:1}}},
  {name:'경계 강화 (서술)',p:{memo:'경계 강화 — 다음 배틀 상대 「경계」 상태'}},
  {name:'흔적을 남김 (서술)',p:{memo:'흔적을 남겼다 — 추적당할 수 있다'}},
  {name:'시간 지체 (서술)',p:{memo:'시간이 지체된다 — 다음 장면이 한 시간대 늦어진다'}}];
 const d=n=>1+Math.floor(Math.random()*n);
 const st=()=>A().ST.state.skill||{};
 const cfg=()=>Object.assign({},CFG0,st().cfg||{});
 const restCfg=k=>Object.assign({},REST0[k]||REST0.long,((st().rest||{})[k])||{});
 const trs=()=>Object.assign({},(A().ST.state.roster||{}).trainers||{});
 const mons=()=>(A().ST.state.roster||{}).mons||{};
 const bmons=()=>((A().ST.state.battle||{}).mons)||{};
 const tsk=tid=>Object.assign({myosu:0,care:0,inou:0,aa:0,inj:0,tired:[]},(st().trainers||{})[tid]||{});
 const rankOf=(t,stat)=>String(((t||{}).ranks||{})[stat]||'').trim();
 const lv=r=>LAD[S().strip(r)]??0;
 const sign=r=>/\+$/.test(r)?1:/-$/.test(r)?-1:0;
 const gm=()=>A().ST.role==='gm';
 const me=()=>A().ST.seat;
 const myosuMax=t=>{const r=S().strip(rankOf(t,'지시'));return r==='A'?cfg().myosuA:(LAD[r]>=4?cfg().myosuAA:0)};
 const hasBond=m=>[...(m.pots||[]),m.excl,...(m.exclX||[])].some(p=>p&&/유대/.test(p.name||''));
 const prideA=m=>/^A/.test(S().strip(m.pride||''));
 const frac=(v,s)=>{s=String(s==null?'':s).trim();if(s==='full')return v;const m=s.match(/^(\d+)\s*\/\s*(\d+)$/);return m?Math.max(1,Math.floor(v*+m[1]/+m[2])):Math.max(0,Math.floor(+s||0))};
 const sdb=()=>((DB().states||{}).st)||{};
 const stKo=k=>(sdb()[k]||{}).ko||k;
 const stList=()=>Object.keys(sdb()).filter(k=>k!=='Dead').map(k=>[k,sdb()[k].ko||k,!!sdb()[k].abn]);
 /* 바뀐 칸만 쓴다 (점검 3-18) — 통째로 쓰면 그 사이 남이 바꾼 칸이 지워진다. 처음이면 통째로 */
 async function setT(tid,patch){const had=!!(st().trainers||{})[tid];const cur=tsk(tid);const before=JSON.parse(JSON.stringify(cur));const n=Object.assign(cur,patch);if(had)await A().setDiff(['skill','trainers',tid],before,n,1);else await A().set(['skill','trainers',tid],n);return n}
 /* 로스터 포켓몬을 고치고 배틀 쪽도 맞춘다 */
 async function putMon(mid,fn){const m=JSON.parse(JSON.stringify(mons()[mid]||null));if(!m)return null;const nm=JSON.parse(JSON.stringify(m));fn(nm,false);await A().setDiff(['roster','mons',mid],m,nm,1);const bm=JSON.parse(JSON.stringify(bmons()[mid]||null));if(bm){const nb=JSON.parse(JSON.stringify(bm));fn(nb,true);await A().setDiff(['battle','mons',mid],bm,nb,1)}return nm}
 /* 10-26: 시트(로스터) 포켓몬의 지금 HP · 상태는 sheetHp · sheetStates 다 (hp.cur · states 는 배틀 칸 것). 예전엔 로스터의 hp.cur 를 고쳐서
    배틀 밖에서 쉰 회복 · 패널티 대미지가 시트에 안 남았다 — putMon 이 (x, 배틀 칸인가) 로 부르니 둘을 나눠 고친다 */
 const HP=(x,b)=>b?(+(x.hp||{}).cur||0):(x.sheetHp==null?x.hp.max:Math.max(0,Math.min(x.hp.max,+x.sheetHp||0)));
 const setHP=(x,b,v)=>{if(b)x.hp.cur=v;else x.sheetHp=v};
 const STS=(x,b)=>b?(x.states=x.states||{}):(x.sheetStates=x.sheetStates||{});
 const tidyST=(x,b)=>{if(!b&&x.sheetStates&&!Object.keys(x.sheetStates).length)delete x.sheetStates};
 const alive=m=>HP(m,false)>0&&!(m.sheetStates||{}).Dead;
 async function hpLoss(tid,mid,fracs,why){const m=mons()[mid];if(!m)return '';const loss=frac(m.hp.max,fracs);if(!loss)return '';await putMon(mid,(x,b)=>{setHP(x,b,Math.max(0,HP(x,b)-loss))});return `${m.name} HP −${loss} (${why})`}
 async function injure(tid,pickMid){const t=trs()[tid];const k=tsk(tid);const inj=Math.min(2,(+k.inj||0)+1);await setT(tid,{inj});const line=await hpLoss(tid,pickMid,inj>=2?cfg().hp2:cfg().hp1,inj>=2?'중상':'부상');return {inj,line:`${t.name} ${inj>=2?'「중상」':'「부상」'}${line?' · '+line:''}`}}
 function pickMon(tid,title,sub){return new Promise(res=>{const ms=Object.values(mons()).filter(m=>m.tid===tid&&alive(m));if(!ms.length)return res(null);
  const md=A().openModal(`<div class="mhead"><h2>${esc(title)}</h2><span class="sp"></span></div><div class="small dim" style="margin-bottom:6px">${esc(sub||'소지 포켓몬 1체를 고른다')}</div><div class="pg">${ms.map(m=>`<div class="penc" data-pk="${m.id}"><div class="pic" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}"></div><div><b>${esc(m.name)}</b><div class="small dim">HP ${HP(m,false)}/${m.hp.max}</div></div></div>`).join('')}</div>`);
  md.querySelectorAll('[data-pk]').forEach(el=>el.onclick=()=>{A().closeModal();res(el.dataset.pk)})})}

 /* ===== 판정 계산 ===== */
 function dieOf(t,stat,o){const r=rankOf(t,stat);let idx=lv(r)+(o.step||0);const injStep=o.inj>=2?cfg().s2:o.inj>=1?cfg().s1:0;idx-=injStep;
  const autofail=idx<0;let plus=sign(r);if(idx>4){plus+=idx-4;idx=4}idx=Math.max(0,Math.min(4,idx));return {sides:SIDES[idx],plus,autofail,idx,injStep}}
 /* 10-28 망령 「목표 자동」 (시뮬 lib/checkgen.js 와 같은 계산): 대상 가운데 그 자질을 가장 잘 굴리는 사람의 주사위로,
    「대가를 치르고 성공」 이상이 나올 확률이 난이도 띠에 드는 목표 중 띠 가운데에 가장 가까운 값을 고른다.
    동료 주사위 = 살아 있는 포켓몬이 있으면 d6(통솔 + 『유대』 d8), 없으면 혼자 d4 · 이능 판정은 능력 주사위. 두 번 굴리기 · 숙련 · 단계 · 부상도 넣는다 */
 const BAND={easy:[0.85,0.95,'쉬움'],normal:[0.70,0.85,'보통'],hard:[0.50,0.70,'어려움']};
 function okPlusOf(D,cs,o,target){const n=D.sides;const pa={};for(let r1=1;r1<=n;r1++){if(o.twice){for(let r2=1;r2<=n;r2++){const v=o.twice>0?Math.max(r1,r2):Math.min(r1,r2);pa[v]=(pa[v]||0)+1/(n*n)}}else pa[r1]=(pa[r1]||0)+1/n}
  let p=0;for(const k in pa){let av=+k;if(o.pm>0&&av===1)av=2;else if(o.pm<0&&av===n)av=n-1;for(let c=1;c<=cs;c++){if(av===1&&c===1)continue;if(av+(D.plus||0)+c>=target-2)p+=pa[k]/cs}}return p}
 /* 한 사람이 이 체크를 굴릴 때의 주사위 (자질 D · 동료 cs). 굴릴 수 없으면 why 만 */
 function rollerOf(tid,o){const t=trs()[tid];if(!t)return null;const k=tsk(tid);const D=dieOf(t,o.stat,{inj:+k.inj||0,step:o.step||0});if(D.autofail)return {tid,name:t.name,D,why:'자질 주사위가 d4 아래 — 자동 실패'};let cs,how;
  if(o.mode==='inou'){if((LAD[S().strip(rankOf(t,'능력'))]||0)<3||o.stat!=='능력')return {tid,name:t.name,D,why:'이능은 능력 A 이상 · 「능력」 체크만'};const Dc=dieOf(t,'능력',{inj:cfg().both1?+k.inj||0:0,step:o.step||0});cs=Dc.sides;how='이능 d'+cs}
  else{const ms=Object.values(mons()).filter(m=>m.tid===tid&&m.hp&&alive(m));if(ms.length){const bond=o.stat==='통솔'&&ms.some(hasBond);cs=bond?8:6;how=bond?'『유대』 d8':'포켓몬 d6'}else{cs=4;how='혼자 d4'}}
  return {tid,name:t.name,D,cs,how}}
 function autoRoller(ids,o){let best=null;
  for(const tid of ids||[]){const r=rollerOf(tid,o);if(!r||r.why)continue;const sc=okPlusOf(r.D,r.cs,o,8);if(!best||sc>best.sc)best=Object.assign(r,{sc})}
  return best}
 function autoTarget(ids,o,tier){const B=BAND[tier];if(!B)return null;const r=autoRoller(ids,o);if(!r)return null;const mid=(B[0]+B[1])/2;let pick=null;
  for(let tg=2;tg<=20;tg++){const p=okPlusOf(r.D,r.cs,o,tg);const inb=p>=B[0]-1e-9&&p<=B[1]+1e-9;const d=Math.abs(p-mid);if(!pick||(inb&&!pick.inb)||(inb===pick.inb&&d<pick.d))pick={tg,p,inb,d}}
  return {target:pick.tg,p:pick.p,inb:pick.inb,who:r.name,die:'d'+r.D.sides+(r.D.plus?(r.D.plus>0?'+':'')+r.D.plus:''),how:r.how,tier,band:B}}
 const autoTxt=a=>a?`목표 ${a.target} — ${a.who} (${a.die} + ${a.how}) 기준 대가 포함 성공 ${Math.round(a.p*100)}%${a.inb?'':' (띠 밖: 이 일행엔 가장 가까운 값)'}`:'굴릴 수 있는 대상이 없다';
 /* 10-29 망령 「스킬 체크 창이 직관적이지 않다」: 목표를 결과 네 칸으로 풀어 보여 준다 (judge 와 같은 경계). now = 합계가 있으면 그 칸에 표시 */
 const dieTxt=D=>'d'+D.sides+(D.plus?(D.plus>0?'+':'')+D.plus:'');
 function ladder(target,now){if(!(+target>0))return '';const t=+target;const seg=[[0,`${t-3} 이하`,null,t-3],[2,`${t-2}~${t-1}`,t-2,t-1],[3,`${t}~${t+4}`,t,t+4],[4,`${t+5} 이상`,t+5,null]];
  const lab=['','','대가 성공','성공','대성공'];lab[0]='실패';
  return `<div class="sklad">${seg.map(([ri,rg,lo,hi])=>{const on=now!=null&&(lo==null||now>=lo)&&(hi==null||now<=hi);return `<span class="${on?'on':''}" style="--c:${COL[ri]}"><b>${lab[ri]}</b><small>${rg}</small></span>`}).join('')}</div>`}
 const pct=p=>Math.round(p*100)+'%';
 function judge(total,target,fumble,aLv){const diff=total-target;let ri=1;if(diff>=-2)ri=2;if(diff>=0)ri=3;if(diff>=5)ri=4;if(fumble)ri=aLv>=3?1:0;return ri}

 /* ===== 패널티 ===== */
 /* 10-28 망령 「대가 실패는 게임 수치로」: al = 경계도 +N (던전 탐색 중이면 그 던전 경계도를 올린다) */
 const PEN0=()=>({al:0,dmg:'',st:'',cnt:'',rk:{},oo:0,oc:0,pot:{who:'tr',name:'',n:0},memo:''});
 function penNorm(x){const b=PEN0();x=x||{};for(const k in b)if(x[k]!=null&&x[k]!=='')b[k]=typeof b[k]==='object'?Object.assign({},b[k],x[k]):x[k];if(typeof b.rk!=='object')b.rk={};return b}
 function penHas(x){x=penNorm(x);return !!(+x.al>0||x.dmg||x.st||x.memo||Object.values(x.rk).some(v=>+v)||+x.oo>0||+x.oc>0||+x.pot.n>0)}
 function penTxt(x){x=penNorm(x);const t=[];if(+x.al>0)t.push('경계도 +'+x.al);if(x.dmg)t.push('대미지 '+x.dmg);if(x.st)t.push('「'+stKo(x.st)+'」'+(x.cnt&&+x.cnt>0?' '+x.cnt+'턴':''));RK.forEach(([k,n])=>{const v=+x.rk[k]||0;if(v)t.push(n+' '+(v>0?'+':'')+v)});if(+x.oo>0)t.push('4식 '+x.oo+'개 차감');if(+x.oc>0)t.push('6령 '+x.oc+'개 차감');if(+x.pot.n>0)t.push((x.pot.who==='pk'?'전용':'고유')+' 포텐셜'+(x.pot.name?' 『'+x.pot.name+'』':'')+' −'+x.pot.n);if(x.memo)t.push(x.memo);return t.join(' · ')}
 /* 결과가 나온 트레이너에게 패널티 묶음을 건다 (맵툴 pen_apply) */
 async function applyPenalty(tid,sub,why){sub=penNorm(sub);const t=trs()[tid];if(!t||!penHas(sub))return '';const L=[];
  const needMon=!!(sub.dmg||sub.st||Object.values(sub.rk).some(v=>+v));
  if(needMon){const mid=await pickMon(tid,`패널티 — ${why}`,'패널티를 받을 포켓몬 1체를 고른다');if(mid){await putMon(mid,(x,b)=>{const nm=x.name;
    if(sub.dmg){const loss=frac(x.hp.max,sub.dmg);setHP(x,b,Math.max(0,HP(x,b)-loss));if(!b)L.push(`${nm} HP −${loss}`)}
    if(sub.st){const XS=STS(x,b);const sd=sdb()[sub.st]||{};{const d=sd;XS[sub.st]=+sub.cnt>0?+sub.cnt:(d.min>=1000||!d.min?1000:(+d.max>+d.min&&+d.max<1000?+d.min+Math.floor(Math.random()*(+d.max-+d.min+1)):+d.min))}if(!b)L.push(`${nm} 「${stKo(sub.st)}」`)}
    const rk=Object.entries(sub.rk).filter(([k,v])=>+v);if(rk.length){x.rank=x.rank||{};for(const [k,v] of rk){x.rank[k]=Math.max(-6,Math.min(6,(+x.rank[k]||0)+ +v))}if(!b)L.push(`${nm} `+rk.map(([k,v])=>(RK.find(r=>r[0]===k)||[k,k])[1]+(v>0?'+':'')+v).join(' '))}})}}
  const bt=((A().ST.state.battle||{}).trainers||{})[tid];
  if(+sub.oo>0||+sub.oc>0){if(bt){const nt=JSON.parse(JSON.stringify(bt));nt.orderCount=nt.orderCount||{};const cut=(pre,n)=>{let left=n;for(const k of Object.keys(nt.orderCount).filter(k=>k.startsWith(pre)).sort()){while(left>0&&(+nt.orderCount[k]||0)>0){nt.orderCount[k]--;left--}}return n-left};const a=cut('order_',+sub.oo||0),b=cut('command_',+sub.oc||0);await A().setDiff(['battle','trainers',tid],bt,nt,2);if(a)L.push(`4식 −${a}`);if(b)L.push(`6령 −${b}`)}else L.push(`4식/6령 차감은 배틀에 트레이너가 없어 손으로 (${sub.oo||0}/${sub.oc||0})`)}
  if(+sub.pot.n>0){let n=+sub.pot.n;let done=0;const uniq=(bt&&bt.unique)||[];
   for(const m of Object.values(bmons()).filter(m=>m.tid===tid)){if(n<=0)break;const all=[...(m.pots||[]),m.excl,...(m.exclX||[]),...uniq].filter(p=>p&&p.name&&/【(\d+)\/시】/.test(p.eff||''));const u=Object.assign({},m.potUses||{});let ch=false;
    for(const p of all){if(n<=0)break;if(sub.pot.name&&p.name!==sub.pot.name)continue;const max=+(String(p.eff||'').match(/【(\d+)\/시】/)||[0,0])[1];const cur=u[p.name]==null?max:+u[p.name];if(cur>0){u[p.name]=cur-1;n--;done++;ch=true}}
    if(ch)await A().set(['battle','mons',m.id,'potUses'],u)}
   L.push(done?`포텐셜 횟수 −${done}`:'포텐셜 횟수 차감할 것이 없다')}
  if(+sub.al>0){const DG=window.OM_DG_UI;let r='';try{r=DG&&DG.alAdd?await DG.alAdd(+sub.al,(why||'').split(' · ')[0]):''}catch(e){}L.push(r||`경계도 +${+sub.al} (던전 밖 — 적용 안 함)`)}
  if(sub.memo)L.push(sub.memo);
  const txt=`【패널티】 ${t.name} 『${why}』\n${L.join('\n')||'(적용할 것 없음)'}`;A().sysLog(txt,'battle',{});return txt}

 /* ===== 휴식 ===== */
 async function applyRest(kind,tids,opt){opt=opt||{};const R=restCfg(kind);const T=trs();const ids=(tids&&tids.length?tids:Object.keys(T)).filter(id=>T[id]);const kn=(KINDS.find(k=>k[0]===kind)||[])[1]||kind;const L=[];
  const SD=sdb();const bt=(A().ST.state.battle||{}).trainers||{};
  /* 10-28: hp_one = 「HP」 회복은 일행 전체에서 가장 다친 1체만 (빈사 · 만피는 빼고 HP 비율이 가장 낮은 포켓몬) */
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
   const patch={};if(+R.tired)patch.tired=[];if(+R.care)patch.care=0;if(+R.inou)patch.inou=0;if(+R.inj_n>0)patch.inj=Math.max(0,(+k.inj||0)-(+R.inj_n));
   if(Object.keys(patch).length)await setT(tid,patch);
   const tl=[];if(+R.tired&&k.tired.length)tl.push('지침 해제');if(+R.care)tl.push('돌봄');if(+R.inou)tl.push('이능');if(+R.inj_n>0&&k.inj)tl.push(`${k.inj>=2?'중상':'부상'} → ${patch.inj>=2?'중상':patch.inj===1?'부상':'건강'}`);if(tl.length)lines.push(tl.join(' · '));
   L.push(`${t.name}: ${lines.join(' · ')||'변화 없음'}`)}
  /* 10-28: ord_po · ord_pc = 파티 전체에서 4식 · 6령을 n 개 회복 (배틀 중이면 배틀 쪽 횟수, 아니면 시트 쪽 — 던전 탭 ordSrc 와 같다). 제작한 값(가득)까지만 */
  if(+R.ord_po>0||+R.ord_pc>0){const OO=window.OM_ORDERS;const B=A().ST.state.battle||{};const LP=[];
   for(const [pre,n0,lab] of [['order_',+R.ord_po||0,'4식'],['command_',+R.ord_pc||0,'6령']]){let n=n0;
    for(const tid of ids){if(n<=0)break;const bT=(B.trainers||{})[tid];const inB=!!(bT&&bT.orderCount&&B.started);const src=inB?bT:T[tid];if(!src)continue;let FL={};try{FL=OO.fill(src,src.orderBase||1)}catch(e){}const cnt=Object.assign({},src.orderCount||{});let ch=0;
     for(const kk of Object.keys(FL).filter(k=>k.startsWith(pre)).sort()){while(n>0&&(+cnt[kk]||0)<(+FL[kk]||0)){cnt[kk]=(+cnt[kk]||0)+1;n--;ch++}}
     if(ch){await A().set(inB?['battle','trainers',tid,'orderCount']:['roster','trainers',tid,'orderCount'],cnt);LP.push(`${src.name||''} ${lab} +${ch}`)}}}
   if(LP.length)L.push('파티: '+LP.join(' · '))}
  const txt=`【휴식】 ${kn}${opt.by?' · '+opt.by:''}\n${L.join('\n')}`;A().sysLog(txt,'battle',{});try{window.OM_RP_UI&&window.OM_RP_UI.playSe('Ping')}catch(e){}return txt}

 /* ===== 창 공통 ===== */
 function open(){if(gm())return openGm();const tid=me();if(!tid)return A().toast('자리에 앉아야 한다');openPlayer(tid)}
 const seg=(name,opts,cur)=>`<span class="seg" data-seg="${name}">${opts.map(([v,n,t])=>`<span class="${String(cur)===String(v)?'on':''}" data-v="${esc(v)}" ${t?`title="${esc(t)}"`:''}>${n}</span>`).join('')}</span>`;
 const segVal=(md,name)=>{const on=md.querySelector(`[data-seg="${name}"] .on`);return on?on.dataset.v:''};
 function bindSeg(md){md.querySelectorAll('[data-seg]').forEach(sg=>sg.querySelectorAll('span[data-v]').forEach(sp=>sp.onclick=()=>{sg.querySelectorAll('span[data-v]').forEach(x=>x.classList.toggle('on',x===sp));sg.dispatchEvent(new CustomEvent('segchange',{bubbles:true,detail:sp.dataset.v}))}))}
 const F={label:'',stat:'지시',mode:'skill',target:7,npc:0,step:0,twice:0,pm:0,pen:{fail:PEN0(),cost:PEN0()},ids:null,penOpen:false,restKind:'long',auto:''};
 function offerSummary(O){return `${esc(O.stat)}${O.mode==='inou'?' · 이능':O.mode==='any'?' · 방식 자유':''} · 목표 ${O.target}${O.auto&&BAND[O.auto]?' (자동 · '+BAND[O.auto][2]+')':''}${O.npc?' (대항 '+esc(O.npc)+')':''}${O.step?' · 단계 '+(O.step>0?'유리':'불리'):''}${O.twice?' · 두 번 굴려 '+(O.twice>0?'높은':'낮은')+' 값':''}${O.pm?' · '+(O.pm>0?'능숙함':'서투름'):''}`}
 function penLine(P){if(!P||!(penHas(P.fail)||penHas(P.cost)))return '';return `<div class="skpenline">${penHas(P.fail)?`<span><i class="penf">실패</i> ${esc(penTxt(P.fail))}</span>`:''}${penHas(P.cost)?`<span><i class="penc">대가</i> ${esc(penTxt(P.cost))}</span>`:''}</div>`}
 const DMGS=['','1/8','1/4','1/3','1/2'];
 /* 패널티 한 칸 (실패 · 대가 · 예시 편집 창이 같이 쓴다). t = 칸 이름, X = 패널티 */
 function penFields(t,X){return `   <div class="fr"><span class="lbl">대미지</span>${seg('pen_'+t+'_dmg',[['','없음'],['1/8','1/8'],['1/4','1/4'],['1/3','1/3'],['1/2','1/2']],DMGS.includes(X.dmg)?X.dmg:'x')}<input type="text" class="n xs" data-pen="${t}.dmg" value="${DMGS.includes(X.dmg)?'':esc(X.dmg)}" placeholder="직접"></div>
   <div class="fr"><span class="lbl">상태</span><select data-pen="${t}.st"><option value="">없음</option>${stList().map(([k,ko,abn])=>`<option value="${k}" ${X.st===k?'selected':''}>${esc(ko)}${abn?' (이상)':''}</option>`).join('')}</select><span class="small dim">턴</span><input type="number" class="n xs" data-pen="${t}.cnt" value="${esc(X.cnt)}" placeholder="기본"></div>
   <div class="fr" style="align-items:flex-start"><span class="lbl">랭크</span><div class="prk">${RK.map(([k,n])=>{const v=+X.rk[k]||0;return `<div class="prki ${v>0?'up':v<0?'dn':''}"><small>${n}</small><span data-rk="${t}.${k}.-1">−</span><b>${v>0?'+':''}${v}</b><span data-rk="${t}.${k}.1">＋</span></div>`}).join('')}</div></div>
   <div class="fr"><span class="lbl">경계도</span><span class="small dim">+</span><input type="number" class="n xs" data-pen="${t}.al" value="${+X.al||0}" step="5"><span class="small dim">던전 탐색 중이면 그 던전 경계도에 더한다</span></div>
   <div class="fr"><span class="lbl">4식 6령</span><span class="small dim">4식</span><input type="number" class="n xs" data-pen="${t}.oo" value="${+X.oo||0}"><span class="small dim">6령</span><input type="number" class="n xs" data-pen="${t}.oc" value="${+X.oc||0}"><span class="small dim">개 차감 (배틀의 트레이너)</span></div>
   <div class="fr"><span class="lbl">포텐셜</span>${seg('pen_'+t+'_who',[['tr','고유'],['pk','전용']],X.pot.who||'tr')}<input type="text" class="n" data-pen="${t}.pot.name" value="${esc(X.pot.name||'')}" placeholder="이름 (비우면 아무거나)" style="width:150px"><input type="number" class="n xs" data-pen="${t}.pot.n" value="${+X.pot.n||0}"><span class="small dim">회 차감</span></div>
   <div class="fr"><span class="lbl">메모</span><input type="text" data-pen="${t}.memo" value="${esc(X.memo)}" placeholder="GM 이 손으로 할 것 · 서술" style="flex:1"></div>`}
 /* 패널티 칸 머리의 예시 고르기 (기본 예시 중 숨긴 것은 빼고, 내 것 먼저) */
 const exHide=k=>(((st().exHide)||{})[k])||[];
 function penExSel(t){const mine=st().penPresets||[];const hid=exHide('pen');return `<select data-penex="${t}" title="패널티 예시 불러오기 (이 칸에)"><option value="">예시…</option>${mine.length?`<optgroup label="내가 저장한 것">${mine.map(p=>`<option value="my:${esc(p.id)}">${esc(p.name)}</option>`).join('')}</optgroup>`:''}<optgroup label="기본">${PEN_EX.map((e,i)=>hid.includes(e.name)?'':`<option value="ex:${i}">${esc(e.name)}</option>`).join('')}</optgroup></select>`}
 function penExGet(v){if(!v)return null;if(v.startsWith('ex:'))return (PEN_EX[+v.slice(3)]||{}).p||null;const p=(st().penPresets||[]).find(p=>p.id===v.slice(3));return p?p.p:null}
 /* 패널티 칸 읽기 (data-pen="t.…") */
 function grabPen(md,t,X0){const X=penNorm(X0);const q=k=>md.querySelector(`[data-pen="${t}.${k}"]`);if(!q('dmg'))return X;const dv=segVal(md,'pen_'+t+'_dmg');const di=q('dmg').value.trim();X.dmg=di||(dv==='x'?X.dmg:dv);X.al=Math.max(0,+((q('al')||{}).value)||0);X.st=q('st').value;X.cnt=q('cnt').value;X.oo=+q('oo').value||0;X.oc=+q('oc').value||0;X.pot.who=segVal(md,'pen_'+t+'_who')||'tr';X.pot.name=q('pot.name').value.trim();X.pot.n=+q('pot.n').value||0;X.memo=q('memo').value.trim();return X}
 function penBox(P){return `<div class="skpen"><div class="fr"><span class="lbl">패널티</span><div class="pensum">${penHas(P.fail)?`<div><i class="penf">실패 · 대실패</i> ${esc(penTxt(P.fail))}</div>`:''}${penHas(P.cost)?`<div><i class="penc">대가를 치르고 성공</i> ${esc(penTxt(P.cost))}</div>`:''}${!penHas(P.fail)&&!penHas(P.cost)?'<span class="dim small">없음</span>':''}</div><button class="btn xs" data-sk="penopen">${F.penOpen?'접기':'패널티 설정 ▸'}</button><button class="btn xs ghost" data-sk="exmgr" data-t="pen" title="패널티 예시를 한 번에 보고 관리">패널티 예시</button>${penHas(P.fail)||penHas(P.cost)?'<button class="btn xs ghost" data-sk="penclr">비우기</button>':''}</div>
  ${F.penOpen?`<div class="skpencols">${[['fail','실패 · 대실패','penf'],['cost','대가를 치르고 성공','penc']].map(([t,title,cl])=>{const X=penNorm(P[t]);return `<div class="skpencol ${cl}"><div class="sec">${title}<span class="sp"></span>${penExSel(t)}<button class="btn xs ghost" data-sk="pensave" data-t="${t}" title="이 칸을 패널티 예시로 저장">저장</button></div>
${penFields(t,X)}</div>`}).join('')}</div>
   <label class="small tg" style="margin-top:6px;display:block"><input type="checkbox" id="pen_auto" ${cfg().penAuto?'checked':''}> 결과가 나오면 자동으로 건다 (끄면 GM 이 현황에서 손으로)</label>`:''}</div>`}
 function grabOffer(md){F.label=$('#so_label',md).value.trim();F.stat=segVal(md,'stat')||'지시';F.mode=segVal(md,'mode')||'skill';F.target=+$('#so_target',md).value||7;F.npc=+segVal(md,'npc')||0;F.step=+segVal(md,'step')||0;F.twice=+segVal(md,'twice')||0;F.pm=+segVal(md,'pm')||0;F.auto=segVal(md,'auto')||'';
  F.ids=[...md.querySelectorAll('[data-so-id]:checked')].map(i=>i.dataset.soId);
  if(F.penOpen){for(const t of ['fail','cost'])F.pen[t]=grabPen(md,t,F.pen[t])}}
 function loadPreset(o){Object.assign(F,{label:o.label||'',stat:o.stat||'지시',mode:o.mode||'skill',target:+o.target||7,auto:BAND[o.auto]?o.auto:'',npc:+o.npc||0,step:+o.step||0,twice:+o.twice||0,pm:+o.pm||0,pen:{fail:penNorm((o.pen||{}).fail),cost:penNorm((o.pen||{}).cost)}});F.penOpen=penHas(F.pen.fail)||penHas(F.pen.cost)}

 /* ----- GM 창 ----- */
 function openGm(tab){tab=tab||'offer';const K=st();const T=Object.fromEntries(Object.entries(trs()).filter(([,t])=>t&&t.kind!=='npc'));const O=K.offer;const R=K.res||{};const C=cfg();const presets=K.presets||[];
  const ids=F.ids||Object.keys(T);
  const offerTab=`${O?`<div class="skcard hit"><div class="sec">지금 제시된 체크 <span class="note">${esc(O.label||'')}</span><span class="sp"></span><button class="btn xs ghost" data-sk="close">마감 (제시 거두기)</button></div><div class="small">${offerSummary(O)}</div>${penLine(O.pen)}
     <div class="sklist" style="margin-top:6px">${(O.ids||[]).map(id=>{const r=R[id];const t=T[id]||{};const done=r&&r.offerId===O.id;return `<div class="skrow"><b>${esc(t.name)}</b>${done?`<span class="skres" style="background:${COL[r.ri]}">${RES[r.ri]}</span><span class="small dim">${esc(r.text.split('\n').slice(1,-1).join(' / '))}</span>${r.cover?`<span class="tag">커버 ${esc(T[r.cover.by]&&T[r.cover.by].name)}</span>`:''}${r.penDone?'<span class="tag">패널티 적용됨</span>':''}`:'<span class="small dim">아직 안 굴림</span>'}<span class="sp"></span>${done&&O.pen&&!r.penDone&&((r.ri<=1&&penHas(O.pen.fail))||(r.ri===2&&penHas(O.pen.cost)))?`<button class="btn xs" data-sk="penapply" data-tid="${id}">패널티 걸기</button>`:''}<button class="btn xs ghost" data-sk="rollfor" data-tid="${id}">대신 굴리기</button></div>`}).join('')}</div></div>`:''}
    <div class="skcard sknew"><div class="sec">새 체크 제시 <span class="sp"></span><select id="so_ex" title="예시·저장한 제시 불러오기"><option value="">예시 불러오기…</option>${presets.length?`<optgroup label="내가 저장한 것">${presets.map(p=>`<option value="my:${p.id}">${esc(p.name)}</option>`).join('')}</optgroup>`:''}<optgroup label="기본">${EX.map((e,i)=>exHide('check').includes(e.name)?'':`<option value="ex:${i}">${esc(e.name)}</option>`).join('')}</optgroup></select><button class="btn xs ghost" data-sk="exsave" title="지금 폼을 예시로 저장">저장</button><button class="btn xs" data-sk="exmgr" data-t="check" title="체크 · 패널티 예시를 한 번에 보고 이름 · 순서 · 삭제 · 덮어쓰기">예시 관리</button></div>
     <div class="skstep"><div class="skh"><i>1</i>무엇을 <small>상황과 굴릴 자질</small></div>
      <div class="fr"><span class="lbl">상황</span><input type="text" id="so_label" placeholder="예) 겁먹은 야생 무리를 진정시킨다" value="${esc(F.label)}" style="flex:1;min-width:0"></div>
      <div class="fr"><span class="lbl">자질</span>${seg('stat',SK.map(s=>[s,s]),F.stat)}</div>
      <div class="fr"><span class="lbl">방식</span>${seg('mode',[['skill','기교 / 일반'],['inou','이능 (A 이상)'],['any','트레이너가 고름']],F.mode)}</div></div>
     <div class="skstep"><div class="skh"><i>2</i>누가 <small>눌러서 넣고 빼기</small></div>
      <span class="chips">${Object.values(T).map(t=>`<label class="chip ${ids.includes(t.id)?'on':''}"><input type="checkbox" data-so-id="${t.id}" ${ids.includes(t.id)?'checked':''} hidden> ${esc(t.name)}</label>`).join('')||'<span class="dim small">로스터에 트레이너가 없다</span>'}</span></div>
     <div class="skstep"><div class="skh"><i>3</i>목표 <small>난이도를 고르거나 · 자동으로 맞추거나 · 상대와 겨룬다</small></div>
      <div class="fr"><span class="lbl">난이도</span><span class="chips">${DIFF.map(([v,n])=>`<span class="chip ${!F.npc&&F.target===v?'on':''}" data-diff="${v}">${n} ${v}</span>`).join('')}</span><label class="sktg">목표 <input type="number" class="n xs" id="so_target" value="${F.target}"></label></div>
      <div class="fr"><span class="lbl">목표 자동</span>${seg('auto',[['','끔'],['easy','쉬움 85~95%'],['normal','보통 70~85%'],['hard','어려움 50~70%']],F.auto)}</div><div class="small dim skinfo" id="so_autoinfo"></div>
      <div class="fr"><span class="lbl">대항 판정</span>${seg('npc',NPC.map(([v,n])=>[v,n]),F.npc)}</div>
      <div id="so_lad"></div></div>
     <details class="skstep skmod" ${F.step||F.twice||F.pm?'open':''}><summary class="skh"><i>4</i>상황 보정 <small id="so_modsum"></small></summary>
      <div class="fr"><span class="lbl">주사위 단계</span>${seg('step',[[-1,'불리'],[0,'없음'],[1,'유리']],F.step)}<span class="small dim">도구 · 환경 · 힘 차이</span></div>
      <div class="fr"><span class="lbl">두 번 굴리기</span>${seg('twice',[[-1,'낮은 값'],[0,'없음'],[1,'높은 값']],F.twice)}<span class="small dim">시간 여유·정보 / 서두름·방해</span></div>
      <div class="fr"><span class="lbl">숙련</span>${seg('pm',[[-1,'서투름'],[0,'없음'],[1,'능숙함']],F.pm)}<span class="small dim">서투름: 자질 최대값이면 −1 · 능숙함: 1이면 +1</span></div></details>
     <div class="skstep"><div class="skh"><i>5</i>패널티 <small>실패 · 대가 성공 때 거는 것 (없어도 된다)</small></div>${penBox(F.pen)}</div>
     <div class="skprev"><div class="skh">미리보기 <small>이대로 제시하면</small></div><div id="so_prev"></div></div>
     <div class="row skgo"><span class="small dim">제시하면 로그에 카드가 나가고, 대상은 상단 「스킬 체크」에서 굴린다</span><span class="sp"></span><button class="btn pri big" data-sk="offer">제시 (모두에게)</button></div></div>
    <div class="skcard"><div class="sec">최근 판정 <span class="note">${(K.hist||[]).length}</span></div><div class="skhist">${(K.hist||[]).slice(-12).reverse().map(h=>`<div style="border-left-color:${COL[h.ri]}">${esc(h.text)}</div>`).join('')||'<span class="dim small">없음</span>'}</div></div>`;
  const statusTab=`<div class="skcard"><div class="sec">트레이너 자원 <span class="note">묘수 · 돌봄 · 이능 · AA 특권 · 부상 · 지침</span></div>
     <div class="sklist">${Object.values(T).map(t=>{const k=tsk(t.id);const mm=myosuMax(t);const can=S().strip(rankOf(t,'능력'));const isA=LAD[can]>=3;const tired=k.tired.map(id=>(mons()[id]||{}).name).filter(Boolean);
      return `<div class="skrow wrap"><div class="skwho"><b>${esc(t.name)}</b><small>${SK.map(s=>s+' '+esc(rankOf(t,s)||'-')).join(' · ')}</small></div>
       <span class="skstat"><small>묘수</small><b>${k.myosu}/${mm}</b></span><span class="skstat"><small>돌봄</small><b>${k.care?'사용':(LAD[S().strip(rankOf(t,'육성'))]>=2?'가능':'—')}</b></span><span class="skstat"><small>이능</small><b>${isA?k.inou+'/'+C.inou:'—'}</b></span><span class="skstat"><small>AA</small><b>${LAD[can]>=4?(k.aa?'사용':'가능'):'—'}</b></span>
       <span class="skstat"><small>부상</small>${seg('inj_'+t.id,[[0,'없음'],[1,'부상'],[2,'중상']],+k.inj||0)}</span>
       <span class="skstat"><small>지침</small><span class="chips">${tired.length?tired.map((n,i)=>`<span class="chip on" data-sk="untire" data-tid="${t.id}" data-mid="${k.tired[i]}" title="눌러서 풀기">${esc(n)} ✕</span>`).join(''):'<span class="dim">없음</span>'}</span></span><span class="sp"></span><button class="btn xs ghost" data-sk="resetone" data-tid="${t.id}">초기화</button></div>`}).join('')||'<div class="dim small">로스터에 트레이너가 없다</div>'}</div>
     <div class="row" style="margin-top:10px;gap:6px"><button class="btn ghost" data-sk="session" title="묘수 · AA 특권 · 지침 · 돌봄 · 이능 · 부상 모두 초기화">세션 시작 (전부 초기화)</button><span class="sp"></span><span class="small dim">휴식은 「휴식」 탭에서 단계별로</span></div></div>`;
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
     <div><div class="sec">트레이너</div>${nsel('ord_n','4식 6령 회복','전부 = 제작한 값으로 (트레이너마다)')}<div class="skrow on"><div style="flex:1"><b>파티 4식 · 6령 회복</b><small>일행 전체에서 합쳐 n 개 (짧은 휴식 기본 1 · 1 · 숨돌리기 6령 1)</small></div>4식 <input type="number" class="n xs" data-restp="ord_po" value="${+R.ord_po||0}" min="0" max="9"> 6령 <input type="number" class="n xs" data-restp="ord_pc" value="${+R.ord_pc||0}" min="0" max="9"></div>${nsel('pot_tr_n','고유 포텐셜 횟수 회복','횟수 제한이 있는 고유 포텐셜')}
      ${tg('tired','지친 포켓몬 회복','스킬 체크 동료 지침 해제')}${tg('care','돌봄 횟수 회복')}${tg('inou','이능 횟수 · 반동 회복')}
      <div class="skrow on"><div style="flex:1"><b>부상 회복</b><small>중상 → 부상 → 없음</small></div>${seg('rest_inj_n',[[0,'안 함'],[1,'1단계'],[2,'2단계']],+R.inj_n||0)}</div></div></div>
    <div class="row" style="margin-top:10px"><button class="btn ghost" data-sk="restdef">「${kn[1]}」 기본값</button><span class="sp"></span><button class="btn" data-sk="restsave">「${kn[1]}」 설정 저장</button></div></div>`})();
  const cfgTab=`<div class="skcard"><div class="sec">부상 · 중상</div><div class="skcfg">
     <label>부상: 자질 주사위 하강 <input type="number" class="n xs" id="sc_s1" value="${C.s1}"></label><label>중상: 하강 <input type="number" class="n xs" id="sc_s2" value="${C.s2}"></label><label class="tg"><input type="checkbox" id="sc_both1" ${C.both1?'checked':''}> 이능은 두 주사위 모두 하강</label>
     <label>부상 때 포켓몬 HP 감소 <input type="text" class="n xs" id="sc_hp1" value="${esc(C.hp1)}"></label><label>중상 때 <input type="text" class="n xs" id="sc_hp2" value="${esc(C.hp2)}"></label>
     <label class="tg"><input type="checkbox" id="sc_noinou2" ${C.noinou2?'checked':''}> 중상이면 이능 불가</label><label class="tg"><input type="checkbox" id="sc_nocover2" ${C.nocover2?'checked':''}> 중상이면 커버 불가</label></div>
    <div class="sec" style="margin-top:10px">횟수</div><div class="skcfg"><label>휴식 사이 이능 횟수 <input type="number" class="n xs" id="sc_inou" value="${C.inou}"></label><label>AA 특권 목표 상한 <input type="number" class="n xs" id="sc_aa" value="${C.aa}"></label><label>묘수 A <input type="number" class="n xs" id="sc_myosuA" value="${C.myosuA}"></label><label>묘수 AA <input type="number" class="n xs" id="sc_myosuAA" value="${C.myosuAA}"></label><label class="tg"><input type="checkbox" id="sc_penAuto" ${C.penAuto?'checked':''}> 패널티 자동 적용 (기본)</label></div>
    <div class="row" style="margin-top:10px"><span class="small dim">휴식 단계의 내용은 「휴식」 탭, 제시 예시는 「제시」 탭의 저장 버튼</span><span class="sp"></span><button class="btn pri" data-sk="cfgsave">저장</button></div></div>`;
  const md=A().openModal(`<div class="mhead"><h2>스킬 체크 <span class="small dim">GM</span></h2><span class="tabs2" style="margin-left:14px;flex:0 1 420px">${[['offer','제시'],['status','현황'],['rest','휴식'],['cfg','설정']].map(([k,n])=>`<button class="tab2 ${tab===k?'on':''}" data-skt="${k}">${n}</button>`).join('')}</span><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="skwrap">${tab==='offer'?offerTab:tab==='status'?statusTab:tab==='rest'?restTab:cfgTab}</div>`);
  md.classList.add('wide');bindSeg(md);
  const re=t=>{A().closeModal();openGm(t||tab)};
  md.querySelectorAll('[data-skt]').forEach(b=>b.onclick=()=>{if(tab==='offer')grabOffer(md);re(b.dataset.skt)});
  if(tab==='offer'){
   /* 목표 자동: 자질 · 방식 · 단계 · 두 번 · 숙련 · 대상이 바뀔 때마다 다시 셈한다. 난이도 칩이나 목표 칸을 손으로 고치면 자동은 꺼진다 */
   const autoOff=()=>{const sg=md.querySelector('[data-seg="auto"]');if(sg)sg.querySelectorAll('span[data-v]').forEach(x=>x.classList.toggle('on',x.dataset.v===''));const i=$('#so_autoinfo',md);if(i)i.textContent=''};
   const autoRe=()=>{const tier=segVal(md,'auto');const i=$('#so_autoinfo',md);if(!tier){if(i)i.textContent='';return}const ids=[...md.querySelectorAll('[data-so-id]:checked')].map(x=>x.dataset.soId);if(+segVal(md,'npc')){if(i)i.textContent='대항 판정은 상대 주사위가 목표라 자동을 쓰지 않는다';return}
    const a=autoTarget(ids,{stat:segVal(md,'stat')||'지시',mode:segVal(md,'mode')||'skill',step:+segVal(md,'step')||0,twice:+segVal(md,'twice')||0,pm:+segVal(md,'pm')||0},tier);if(a){$('#so_target',md).value=a.target;md.querySelectorAll('[data-diff]').forEach(x=>x.classList.toggle('on',+x.dataset.diff===a.target))}if(i)i.textContent=ids.length?autoTxt(a):'대상을 골라 줘'};
   md.addEventListener('segchange',e=>{const sg=e.target.closest('[data-seg]');if(sg&&/^(auto|stat|mode|step|twice|pm|npc)$/.test(sg.dataset.seg))autoRe()});
   md.querySelectorAll('[data-diff]').forEach(c=>c.onclick=()=>{$('#so_target',md).value=c.dataset.diff;md.querySelectorAll('[data-diff]').forEach(x=>x.classList.toggle('on',x===c));autoOff()});
   {const ti=$('#so_target',md);if(ti)ti.addEventListener('input',autoOff)}
   md.querySelectorAll('[data-so-id]').forEach(cb=>cb.onchange=()=>{cb.closest('.chip').classList.toggle('on',cb.checked);autoRe();prev()});
   /* 미리보기: 결과 네 칸 + 대상마다 굴릴 주사위와 확률 (목표 자동과 같은 계산) */
   const prev=()=>{const o={stat:segVal(md,'stat')||'지시',mode:segVal(md,'mode')||'skill',step:+segVal(md,'step')||0,twice:+segVal(md,'twice')||0,pm:+segVal(md,'pm')||0};const npc=NPC.find(x=>x[0]===+segVal(md,'npc'));const tg=+($('#so_target',md)||{}).value||0;
    const ms=[o.step?'주사위 '+(o.step>0?'유리':'불리'):'',o.twice?'두 번 굴려 '+(o.twice>0?'높은':'낮은')+' 값':'',o.pm?(o.pm>0?'능숙함':'서투름'):''].filter(Boolean);const sm=$('#so_modsum',md);if(sm)sm.textContent=ms.length?ms.join(' · '):'없음 — 눌러서 열기';
    const L=$('#so_lad',md);if(L)L.innerHTML=npc&&npc[2]?`<div class="small dim skinfo">목표 = 굴릴 때 상대가 ${esc(npc[1])} 를 굴린 값</div>`:ladder(tg);
    const ids=[...md.querySelectorAll('[data-so-id]:checked')].map(x=>x.dataset.soId);const P=$('#so_prev',md);if(!P)return;
    if(!ids.length){P.innerHTML='<span class="small dim">대상을 고르면 각자 무엇을 굴리는지 보인다</span>';return}
    P.innerHTML=`<div class="sklist">${ids.map(id=>{const r=rollerOf(id,o.mode==='any'?Object.assign({},o,{mode:'skill'}):o);if(!r)return '';const t=trs()[id];
     if(r.why)return `<div class="skrow"><b>${esc(r.name)}</b><span class="small dim">${esc(o.stat)} ${esc(rankOf(t,o.stat)||'-')}</span><span class="sp"></span><span class="small warn">${esc(r.why)}</span></div>`;
     const dice=`<span class="skdtx">${dieTxt(r.D)} + ${esc(r.how)}</span>`;if(npc&&npc[2])return `<div class="skrow"><b>${esc(r.name)}</b>${dice}<span class="sp"></span><span class="small dim">대 ${esc(npc[1])}</span></div>`;
     const pOk=okPlusOf(r.D,r.cs,o,tg+2),pCost=okPlusOf(r.D,r.cs,o,tg);
     return `<div class="skrow"><b>${esc(r.name)}</b>${dice}<span class="sp"></span><span class="skpb" title="성공 ${pct(pOk)} · 대가 성공까지 ${pct(pCost)}"><i style="width:${pOk*100}%;background:${COL[3]}"></i><i style="width:${Math.max(0,pCost-pOk)*100}%;background:${COL[2]}"></i></span><span class="skpp">성공 <b>${pct(pOk)}</b> · 대가 포함 <b>${pct(pCost)}</b></span></div>`}).join('')}</div>${o.mode==='any'?'<div class="small dim skinfo">방식 자유: 기교 기준으로 셈 (이능을 고르면 달라진다)</div>':''}`};
   md.addEventListener('segchange',prev);{const ti=$('#so_target',md);if(ti)ti.addEventListener('input',prev)}md.querySelectorAll('[data-diff]').forEach(c=>c.addEventListener('click',prev));
   autoRe();prev();
   md.querySelectorAll('[data-rk]').forEach(b=>b.onclick=()=>{grabOffer(md);const [t,k,dv]=b.dataset.rk.split('.');const X=penNorm(F.pen[t]);X.rk[k]=Math.max(-6,Math.min(6,(+X.rk[k]||0)+ +dv));F.pen[t]=X;re('offer')});
   const ex=$('#so_ex',md);if(ex)ex.onchange=()=>{const v=ex.value;if(!v)return;grabOffer(md);if(v.startsWith('ex:'))loadPreset(EX[+v.slice(3)].o);else{const p=presets.find(p=>p.id===v.slice(3));if(p)loadPreset(p.o)}re('offer')};
   md.querySelectorAll('[data-penex]').forEach(sl=>sl.onchange=()=>{const p=penExGet(sl.value);if(!p)return;grabOffer(md);F.pen[sl.dataset.penex]=penNorm(JSON.parse(JSON.stringify(p)));F.penOpen=true;re('offer')});
   const pa=$('#pen_auto',md);if(pa)pa.onchange=async()=>{await A().set(['skill','cfg'],Object.assign({},st().cfg||{},{penAuto:pa.checked?1:0}))}}
  function grabRest(){const kind=F.restKind||'long';const R=restCfg(kind);md.querySelectorAll('[data-rest]').forEach(cb=>R[cb.dataset.rest]=cb.checked?1:0);
   for(const k of ['hp','revive_hp']){if(!md.querySelector(`[data-seg="rest_${k}"]`))continue;const v=segVal(md,'rest_'+k);const inp=md.querySelector(`[data-restv="${k}"]`);R[k]=(inp&&inp.value.trim())||(v==='x'?R[k]:v)}
   for(const k of ['pot_pk_n','ord_n','pot_tr_n']){const v=segVal(md,'rest_'+k);const inp=md.querySelector(`[data-restn="${k}"]`);R[k]=v==='n'?String(Math.max(1,+inp.value||1)):v}
   R.inj_n=+segVal(md,'rest_inj_n')||0;md.querySelectorAll('[data-restp]').forEach(i=>R[i.dataset.restp]=Math.max(0,Math.min(9,+i.value||0)));return R}
  if(tab==='rest'){md.addEventListener('segchange',e=>{const sg=e.target.closest('[data-seg]');if(!sg)return;const n=sg.dataset.seg;if(n==='restkind'){F.restKind=e.detail;re('rest')}else if(/^rest_(pot_pk_n|ord_n|pot_tr_n)$/.test(n)){const inp=md.querySelector(`[data-restn="${n.slice(5)}"]`);inp.style.visibility=e.detail==='n'?'visible':'hidden';if(e.detail==='n'&&!inp.value)inp.value='1'}});
   md.querySelectorAll('[data-rest]').forEach(cb=>cb.onchange=async()=>{cb.closest('.skrow').classList.toggle('on',cb.checked);if(cb.dataset.rest==='revive'){const R=grabRest();await A().set(['skill','rest',F.restKind||'long'],R);re('rest')}})}
  md.querySelectorAll('[data-sk]').forEach(el=>{el.onclick=async()=>{const k=el.dataset.sk;
   if(k==='penopen'){grabOffer(md);F.penOpen=!F.penOpen;return re('offer')}
   if(k==='penclr'){F.pen={fail:PEN0(),cost:PEN0()};return re('offer')}
   if(k==='exmgr'){grabOffer(md);return openExMgr(el.dataset.t||'check')}
   if(k==='pensave'){grabOffer(md);const t=el.dataset.t;const X=penNorm(F.pen[t]);if(!penHas(X))return A().toast('이 칸이 비어 있다');const name=prompt('패널티 예시 이름',penTxt(X).slice(0,40));if(name==null||!name.trim())return;const list=(st().penPresets||[]).slice();list.push({id:'q'+Date.now().toString(36),name:name.trim(),p:X});await A().set(['skill','penPresets'],list);A().toast('패널티 예시로 저장했다');return re('offer')}
   if(k==='exsave'){grabOffer(md);const name=prompt('예시 이름',F.label||'새 예시');if(name==null||!name.trim())return;const list=(st().presets||[]).slice();list.push({id:'p'+Date.now().toString(36),name:name.trim(),o:{label:F.label,stat:F.stat,mode:F.mode,target:F.target,auto:F.auto,npc:F.npc,step:F.step,twice:F.twice,pm:F.pm,pen:{fail:F.pen.fail,cost:F.pen.cost}}});await A().set(['skill','presets'],list);A().toast('저장했다');return re('offer')}
   if(k==='exdel'){const list=st().presets||[];if(!list.length)return;const name=prompt('지울 예시 번호\n'+list.map((p,i)=>(i+1)+'. '+p.name).join('\n'));const i=+name-1;if(!(i>=0&&i<list.length))return;await A().set(['skill','presets'],list.filter((p,j)=>j!==i));return re('offer')}
   if(k==='offer'){grabOffer(md);const ids=F.ids;if(!ids.length)return A().toast('대상을 골라 줘');const npc=NPC.find(x=>x[0]===F.npc);
    let auto='';if(F.auto&&!F.npc){const a=autoTarget(ids,F,F.auto);if(a){F.target=a.target;auto=F.auto}}
    const o={id:'o'+Date.now().toString(36),label:F.label,stat:F.stat,mode:F.mode,target:F.target,auto,npc:npc&&npc[2]?npc[1]:'',npcDice:npc&&npc[2]?npc[2]:null,step:F.step,twice:F.twice,pm:F.pm,pen:{fail:penNorm(F.pen.fail),cost:penNorm(F.pen.cost),auto:cfg().penAuto?1:0},ids,at:Date.now()};
    A().closeModal();await A().set(['skill','offer'],o);await A().set(['skill','res'],{});
    A().sysLog(`【스킬 체크】 ${o.label||'판정'}\n${o.stat}${o.mode==='inou'?' · 이능':''} · 목표 ${o.target}${o.auto?' (자동 · '+BAND[o.auto][2]+')':''}${o.npc?' (대항 '+o.npc+')':''}${o.step?' · 단계 '+(o.step>0?'유리':'불리'):''}${o.twice?' · 두 번 굴려 '+(o.twice>0?'높은':'낮은')+' 값':''}${o.pm?' · '+(o.pm>0?'능숙함':'서투름'):''}\n대상: ${ids.map(i=>(T[i]||{}).name).join(', ')}${penHas(o.pen.fail)?'\n실패: '+penTxt(o.pen.fail):''}${penHas(o.pen.cost)?'\n대가: '+penTxt(o.pen.cost):''}`,'battle',{});try{window.OM_RP_UI&&window.OM_RP_UI.playSe('Ping2')}catch(e){}return openGm('offer')}
   if(k==='close'){A().closeModal();await A().set(['skill','offer'],null);return A().sysLog('스킬 체크 제시를 거뒀다','battle')}
   if(k==='rollfor'){A().closeModal();return openPlayer(el.dataset.tid)}
   if(k==='penapply'){const r=(st().res||{})[el.dataset.tid];if(!r||!O)return;A().closeModal();await applyPenalty(el.dataset.tid,r.ri<=1?O.pen.fail:O.pen.cost,(O.label||'스킬 체크')+' · '+RES[r.ri]);await A().set(['skill','res',el.dataset.tid,'penDone'],1);return openGm('offer')}
   if(k==='untire'){const t=tsk(el.dataset.tid);t.tired=t.tired.filter(x=>x!==el.dataset.mid);await setT(el.dataset.tid,{tired:t.tired});return re('status')}
   if(k==='resetone'){await A().set(['skill','trainers',el.dataset.tid],{myosu:0,care:0,inou:0,aa:0,inj:0,tired:[]});return re('status')}
   if(k==='session'){if(!confirm('묘수 · AA 특권 · 지침 · 돌봄 · 이능 · 부상을 모두 초기화할까?'))return;A().closeModal();await A().set(['skill','trainers'],{});await A().set(['skill','hist'],[]);return A().sysLog('◆ 세션 시작 — 스킬 체크 자원 모두 초기화','battle')}
   if(k==='restsave'){const R=grabRest();await A().set(['skill','rest',F.restKind||'long'],R);A().toast('저장했다');return re('rest')}
   if(k==='restdef'){await A().set(['skill','rest',F.restKind||'long'],null);return re('rest')}
   if(k==='restgo'){const R=grabRest();const kind=F.restKind||'long';const kn=KINDS.find(x=>x[0]===kind)[1];if(!confirm(`「${kn}」 을 선언할까? (로스터 트레이너 전원 · 지금 설정도 저장)`))return;await A().set(['skill','rest',kind],R);A().closeModal();await applyRest(kind,null,{});return}
   if(k==='cfgsave'){const g=id=>$('#'+id,md);const n=Object.assign({},st().cfg||{},{s1:+g('sc_s1').value||0,s2:+g('sc_s2').value||0,both1:g('sc_both1').checked?1:0,hp1:g('sc_hp1').value.trim(),hp2:g('sc_hp2').value.trim(),noinou2:g('sc_noinou2').checked?1:0,nocover2:g('sc_nocover2').checked?1:0,inou:+g('sc_inou').value||2,aa:+g('sc_aa').value||9,myosuA:+g('sc_myosuA').value||1,myosuAA:+g('sc_myosuAA').value||2,penAuto:g('sc_penAuto').checked?1:0});A().closeModal();await A().set(['skill','cfg'],n);return A().toast('저장했다')}}});
  md.addEventListener('segchange',async e=>{const sg=e.target.closest('[data-seg]');if(!sg)return;const n=sg.dataset.seg;if(n.startsWith('inj_'))await setT(n.slice(4),{inj:+e.detail||0})})}

 /* ----- 10-24 망령: 예시 관리 창 — 체크 제시 예시 · 패널티 예시를 한 번에 보고 고친다 -----
    내 것(skill.presets · skill.penPresets): 불러오기 · 덮어쓰기/편집 · 이름 · 순서 · 삭제. 기본 예시: 불러오기 · 내 것으로 복사 · 숨기기(skill.exHide).
    내보내기/가져오기(JSON)로 다른 방에 옮긴다 */
 function exSum(o){o=o||{};const n=NPC.find(x=>x[0]===+o.npc);return offerSummary(Object.assign({stat:'지시',target:7},o,{npc:n&&n[2]?n[1]:''}))}
 function openExMgr(tab){tab=tab==='pen'?'pen':'check';const K=st();const isP=tab==='pen';const mine=(isP?K.penPresets:K.presets)||[];const base=isP?PEN_EX:EX;const hid=exHide(tab);const key=isP?'penPresets':'presets';
  const sum=x=>isP?`<span class="exs">${esc(penTxt(x.p))||'<span class="dim">비어 있음</span>'}</span>`:`<span class="exs">${exSum(x.o)}${x.o&&x.o.label?' · 「'+esc(x.o.label)+'」':''}</span>${penLine((x.o||{}).pen)}`;
  const load=(src,i)=>isP?`<button class="btn xs" data-em="lf" data-src="${src}" data-i="${i}" title="실패 · 대실패 칸에 넣는다">→ 실패</button><button class="btn xs" data-em="lc" data-src="${src}" data-i="${i}" title="대가를 치르고 성공 칸에 넣는다">→ 대가</button>`:`<button class="btn xs pri" data-em="load" data-src="${src}" data-i="${i}">불러오기</button>`;
  const rowM=(x,i)=>`<div class="exrow"><div class="exn"><b>${esc(x.name)}</b>${sum(x)}</div><span class="exb">${load('m',i)}${isP?`<button class="btn xs ghost" data-em="edit" data-i="${i}">편집</button>`:`<button class="btn xs ghost" data-em="over" data-i="${i}" title="스킬 체크 창에 지금 적혀 있는 폼으로 바꾼다">덮어쓰기</button>`}<button class="btn xs ghost" data-em="ren" data-i="${i}">이름</button><button class="btn xs ghost" data-em="up" data-i="${i}" ${i?'':'disabled'} title="위로">▲</button><button class="btn xs ghost" data-em="dn" data-i="${i}" ${i<mine.length-1?'':'disabled'} title="아래로">▼</button><button class="btn xs ghost danger" data-em="del" data-i="${i}">삭제</button></span></div>`;
  const rowB=(x,i)=>{const h=hid.includes(x.name);return `<div class="exrow ${h?'off':''}"><div class="exn"><b>${esc(x.name)}</b>${h?' <span class="tag">숨김</span>':''}${sum(isP?x:{o:x.o})}</div><span class="exb">${h?'':load('b',i)}<button class="btn xs ghost" data-em="copy" data-i="${i}" title="내 예시로 복사해서 고친다">복사</button><button class="btn xs ghost" data-em="hide" data-i="${i}">${h?'보이기':'숨기기'}</button></span></div>`};
  const md=A().openModal(`<div class="mhead"><h2>예시 관리 <span class="small dim">스킬 체크</span></h2><span class="tabs2" style="margin-left:14px;flex:0 1 300px">${[['check','체크 제시 예시'],['pen','패널티 예시']].map(([k,n])=>`<button class="tab2 ${tab===k?'on':''}" data-emt="${k}">${n}</button>`).join('')}</span><span class="sp"></span><button class="btn ghost" data-em="back">← 스킬 체크</button></div>
   <div class="skwrap exmgr"><div class="skcard"><div class="sec">내가 저장한 것 <span class="note">${mine.length}</span><span class="sp"></span>${isP?'<button class="btn xs pri" data-em="new">＋ 새 패널티 예시</button>':'<button class="btn xs pri" data-em="newf" title="스킬 체크 창에 적혀 있는 폼을 새 예시로">＋ 지금 폼을 새 예시로</button>'}<button class="btn xs ghost" data-em="exp" title="내 예시를 JSON 파일로 내려받는다">내보내기</button><button class="btn xs ghost" data-em="imp" title="JSON 파일에서 예시를 더한다">가져오기</button></div>
    <div class="exlist">${mine.map(rowM).join('')||`<div class="empty small">아직 없다 — ${isP?'「＋ 새 패널티 예시」나 스킬 체크 창 패널티 칸의 「저장」':'스킬 체크 창의 「저장」이나 위 「＋ 지금 폼을 새 예시로」'}로 더한다</div>`}</div></div>
    <div class="skcard"><div class="sec">기본 예시 <span class="note">${base.length} · 숨긴 것은 고르기 목록에 안 나온다</span></div><div class="exlist">${base.map(rowB).join('')}</div></div>
    <input type="file" id="em_file" accept="application/json,.json" hidden></div>`);
  md.classList.add('wide');const re=()=>openExMgr(tab);const save=async L=>{await A().set(['skill',key],L);re()};const back=()=>openGm('offer');
  md.querySelectorAll('[data-emt]').forEach(b=>b.onclick=()=>openExMgr(b.dataset.emt));
  const fi=$('#em_file',md);fi.onchange=async()=>{const f=fi.files[0];if(!f)return;try{const j=JSON.parse(await f.text());const arr=Array.isArray(j)?j:(j[key]||[]);const ok=arr.filter(x=>x&&x.name&&(isP?x.p:x.o)).map(x=>({id:(isP?'q':'p')+Date.now().toString(36)+Math.random().toString(36).slice(2,5),name:String(x.name).slice(0,80),[isP?'p':'o']:isP?penNorm(x.p):x.o}));if(!ok.length)return A().toast('가져올 예시가 없다');await save([...(st()[key]||[]),...ok]);A().toast(`${ok.length}개를 더했다`)}catch(e){A().toast('읽지 못했다: '+e.message)}};
  md.querySelectorAll('[data-em]').forEach(b=>b.onclick=async()=>{const k=b.dataset.em;const i=+b.dataset.i;const L=(st()[key]||[]).slice();const src=b.dataset.src==='b'?base:L;
   if(k==='back')return back();
   if(k==='load'){loadPreset(src[i].o);return back()}
   if(k==='lf'||k==='lc'){F.pen[k==='lf'?'fail':'cost']=penNorm(JSON.parse(JSON.stringify(src[i].p)));F.penOpen=true;return back()}
   if(k==='newf'){const name=prompt('예시 이름',F.label||'새 예시');if(name==null||!name.trim())return;L.push({id:'p'+Date.now().toString(36),name:name.trim(),o:{label:F.label,stat:F.stat,mode:F.mode,target:F.target,auto:F.auto,npc:F.npc,step:F.step,twice:F.twice,pm:F.pm,pen:{fail:F.pen.fail,cost:F.pen.cost}}});return save(L)}
   if(k==='over'){if(!confirm(`「${L[i].name}」 를 스킬 체크 창의 지금 폼으로 바꿀까?\n${F.label||'(상황 없음)'} · ${F.stat} · 목표 ${F.target}`))return;L[i]=Object.assign({},L[i],{o:{label:F.label,stat:F.stat,mode:F.mode,target:F.target,auto:F.auto,npc:F.npc,step:F.step,twice:F.twice,pm:F.pm,pen:{fail:F.pen.fail,cost:F.pen.cost}}});return save(L)}
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
 function openPlayer(tid){const T=trs();const t=T[tid];if(!t)return;const K=st();const O=K.offer;const k=tsk(tid);const C=cfg();const R=(K.res||{})[tid];const mine=R&&O&&R.offerId===O.id?R:null;
  const can=S().strip(rankOf(t,'능력'));const aLv=LAD[can]||0;const inouLeft=Math.max(0,C.inou-(+k.inou||0));/* 10-26 던전 시험: 방의 모든 포켓몬(야생 무리 · 상대 트레이너까지)이 다 떠서 고르기 어려웠다 — 내 포켓몬 먼저, 그다음 같은 체크를 받은 동료의 포켓몬만 */const mates=new Set([tid,...((O&&O.ids)||[])]);const myMons=Object.values(mons()).filter(m=>m.hp&&alive(m)&&mates.has(m.tid)).sort((x,y)=>(x.tid===tid?0:1)-(y.tid===tid?0:1));
  const stat=O?O.stat:'지시';const mode=O?O.mode:'any';const D=O?dieOf(t,stat,{inj:+k.inj||0,step:O.step||0}):null;
  const md=A().openModal(`<div class="mhead"><h2>스킬 체크 <span class="small dim">${esc(t.name)}</span></h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="skwrap">
   <div class="skme"><div class="skranks">${SK.map(s=>`<span><small>${s}</small><b>${esc(rankOf(t,s)||'-')}</b><em>d${SIDES[Math.min(4,lv(rankOf(t,s)))]}</em></span>`).join('')}</div>
    <div class="skres2"><span class="skstat"><small>묘수</small><b>${k.myosu}/${myosuMax(t)}</b></span><span class="skstat"><small>돌봄</small><b>${k.care?'사용':(LAD[S().strip(rankOf(t,'육성'))]>=2?'가능':'—')}</b></span><span class="skstat"><small>이능</small><b>${aLv>=3?inouLeft+'회':'—'}</b></span><span class="skstat"><small>AA 특권</small><b>${aLv>=4?(k.aa?'사용':'가능'):'—'}</b></span><span class="skstat ${k.inj?'bad':''}"><small>건강</small><b>${k.inj>=2?'중상':k.inj===1?'부상':'건강'}</b></span></div></div>
   ${!O?'<div class="skcard"><div class="small dim">제시된 체크가 없다. GM 이 제시하면 여기서 굴린다.</div></div>':!(O.ids||[]).includes(tid)&&!gm()?'<div class="skcard"><div class="small dim">이번 체크는 내 대상이 아니다.</div></div>':`
   <div class="skcard hit"><div class="skoffer"><div class="skot">${esc(O.label||'스킬 체크')}</div><div class="skos">${offerSummary(O)}</div>${penLine(O.pen)}${O.npcDice?'':ladder(O.target,mine?mine.total:null)}</div>
    ${mine?resultHtml(mine,t,k):`
    <div class="sec">누구와 함께 굴릴까 <span class="note">내 자질 ${esc(stat)} ${esc(rankOf(t,stat)||'-')} → ${dieTxt(D)}${D.injStep?' (부상 −'+D.injStep+'단계)':''}${D.autofail?' — 자동 실패':''}</span></div>
    <span hidden>${mode!=='inou'?'<input type="radio" name="how" value="mon"><input type="radio" name="how" value="alone">':''}${aLv>=3&&mode!=='skill'&&stat==='능력'?`<input type="radio" name="how" value="inou" ${mode==='inou'&&!(inouLeft<=0||(k.inj>=2&&C.noinou2))?'checked':''}><input type="radio" name="how" value="aa">`:''}</span>
    <div class="skopts" id="monpick">
     ${mode!=='inou'?myMons.map(m=>{const tired=Object.values(K.trainers||{}).some(x=>(x.tired||[]).includes(m.id));const own=m.tid===tid;const cs=stat==='통솔'&&hasBond(m)?8:6;return `<div class="skopt ${tired?'off':''}" data-mp="${m.id}" data-cs="${cs}" data-nm="${esc(m.name)}" ${tired?'title="지쳐서 쓸 수 없다 — 돌봄이나 휴식으로 회복"':''}><div class="pic" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}"></div><div><b>${esc(m.name)}</b><small>${own?'':esc((T[m.tid]||{}).name||'')+' · '}${tired?'지침':(cs===8?'『유대』 d8':'d6')}${prideA(m)&&cs!==8?' · 프라이드 A 고집':''}</small></div><em>d${cs}</em></div>`}).join('')+`<div class="skopt alone" data-how="alone" data-cs="4" data-nm="혼자"><div class="pic">—</div><div><b>혼자</b><small>동료 없이</small></div><em>d4</em></div>`:''}
     ${aLv>=3&&mode!=='skill'&&stat==='능력'?(()=>{const no=inouLeft<=0||(k.inj>=2&&C.noinou2);const cs=SIDES[Math.min(4,aLv)];return `<div class="skopt inou ${no?'off':''} ${mode==='inou'&&!no?'on':''}" data-how="inou" data-cs="${cs}" data-nm="이능"><div class="pic">能</div><div><b>이능</b><small>남은 ${inouLeft}회 · 실패하면 부상${k.inj>=2&&C.noinou2?' · 중상이라 불가':''}</small></div><em>d${cs}</em></div>`+(aLv>=4&&!k.aa&&O.target<=C.aa&&!no?`<div class="skopt aa" data-how="aa" data-nm="AA 특권"><div class="pic">AA</div><div><b>AA 특권</b><small>굴리지 않고 성공 · 목표 ${C.aa} 이하 · 세션 1회 · 이능 1회 소모</small></div><em>성공</em></div>`:'')})():(mode==='inou'?'<div class="small dim">이능 판정은 능력 A 이상만 할 수 있다.</div>':'')}
    </div>
    <div class="skformula" id="sk_formula"></div>
    <div class="row" style="margin-top:10px"><label class="small" title="GM 이 따로 말한 ± 보정">보정 <input type="number" class="n xs" id="sk_bonus" value="0"></label><span class="sp"></span><button class="btn pri big" id="sk_roll">굴리기</button></div>`}
   </div>`}
   ${O&&Object.keys(K.res||{}).some(id=>id!==tid&&(K.res[id]||{}).offerId===O.id)?`<div class="skcard"><div class="sec">다른 트레이너의 결과 <span class="note">받치면 결과가 한 칸 오르고 내가 부상을 입는다</span></div><div class="sklist">${Object.keys(K.res).filter(id=>id!==tid&&K.res[id].offerId===O.id).map(id=>{const r=K.res[id];const tt=T[id]||{};const canCover=!r.cover&&r.ri<3&&r.ri>=0&&!(k.inj>=2&&C.nocover2);return `<div class="skrow"><b>${esc(tt.name)}</b><span class="skres" style="background:${COL[r.ri]}">${RES[r.ri]}</span>${r.cover?`<span class="tag">커버: ${esc((T[r.cover.by]||{}).name)}</span>`:''}<span class="sp"></span>${canCover?`<button class="btn xs" data-cover="${id}">내가 받칠게</button>`:''}</div>`}).join('')}</div></div>`:''}
   <div class="skcard"><div class="sec">돌봄 <span class="note">육성 B 이상 · 휴식 사이 1회 · 지친 포켓몬 1체 회복</span></div>${LAD[S().strip(rankOf(t,'육성'))]>=2&&!k.care?`<span class="chips">${Object.entries(K.trainers||{}).flatMap(([oid,x])=>(x.tired||[]).map(mid=>`<button class="chip" data-care="${mid}" data-owner="${oid}">${esc((mons()[mid]||{}).name||mid)}${oid!==tid?' ('+esc((T[oid]||{}).name)+')':''}</button>`)).join('')||'<span class="small dim">지친 포켓몬이 없다</span>'}</span>`:'<span class="small dim">쓸 수 없다</span>'}</div></div>`);
  md.classList.add('wide');
  /* 10-29: 동료 · 혼자 · 이능 · AA 를 카드 한 줄에서 고르고, 고른 대로 「d10 + d6 → 성공 n%」 를 바로 보여 준다 */
  const sel=md.querySelector('#monpick');let pickId=null;
  const formula=()=>{const F_=$('#sk_formula',md),rb=$('#sk_roll',md);if(!F_||!D)return;const on=sel&&sel.querySelector('.skopt.on');const bonus=+($('#sk_bonus',md)||{}).value||0;
   if(!on){F_.innerHTML='<span class="dim">위에서 함께 굴릴 포켓몬 · 혼자 · 이능 중 하나를 고른다</span>';if(rb)rb.textContent='굴리기';return}
   if(on.dataset.how==='aa'){F_.innerHTML='<b>AA 특권</b> — 굴리지 않고 바로 <b>성공</b>';if(rb)rb.textContent='특권 쓰기';return}
   const cs=+on.dataset.cs;const D2=Object.assign({},D,{plus:(D.plus||0)+bonus});const o={twice:O.twice||0,pm:O.pm||0};
   const odds=O.npcDice||D.autofail?'':` <span class="sp"></span><span class="skpp">성공 <b>${pct(okPlusOf(D2,cs,o,O.target+2))}</b> · 대가 포함 <b>${pct(okPlusOf(D2,cs,o,O.target))}</b></span>`;
   F_.innerHTML=D.autofail?'<span class="warn">자질 주사위가 d4 아래 — 자동 실패</span>':`<span class="skdie"><small>${esc(stat)}</small>${dieTxt(D)}</span><em>+</em><span class="skdie"><small>${esc(on.dataset.nm)}</small>d${cs}</span>${bonus?`<em>${bonus>0?'+':'−'}</em><span class="skdie"><small>보정</small>${Math.abs(bonus)}</span>`:''}<em>vs</em><span class="skdie tg"><small>목표</small>${O.npcDice?esc(O.npc):O.target}</span>${odds}`;
   if(rb)rb.textContent=`굴리기 · ${dieTxt(D)} + d${cs}`};
  if(sel)sel.querySelectorAll('.skopt').forEach(el=>el.onclick=()=>{if(el.classList.contains('off'))return;const how=el.dataset.mp?'mon':el.dataset.how;pickId=el.dataset.mp||null;sel.querySelectorAll('.skopt').forEach(x=>x.classList.toggle('on',x===el));const r=md.querySelector(`[name=how][value=${how}]`);if(r)r.checked=true;formula()});
  {const bi=$('#sk_bonus',md);if(bi)bi.addEventListener('input',formula)}formula();
  const rb=$('#sk_roll',md);if(rb)rb.onclick=()=>{if(!md.querySelector('[name=how]:checked'))return A().toast('누구와 함께 굴릴지 먼저 골라 줘');roll(tid,O,md,pickId)};
  md.querySelectorAll('[data-myosu]').forEach(b=>b.onclick=()=>myosu(tid,b.dataset.myosu));
  md.querySelectorAll('[data-cover]').forEach(b=>b.onclick=()=>cover(tid,b.dataset.cover));
  md.querySelectorAll('[data-care]').forEach(b=>b.onclick=()=>care(tid,b.dataset.owner,b.dataset.care))}
 function resultHtml(r,t,k){const O=st().offer;const canMyosu=O&&O.stat==='지시'&&(+k.myosu||0)<myosuMax(t)&&!r.myosu&&r.how!=='aa'&&r.ri>0;
  const a=r.a||{},c=r.c||{};const dice=a.sides&&c.sides?`<div class="skformula"><span class="skdie"><small>${esc(r.stat)} d${a.sides}${a.plus?(a.plus>0?'+':'')+a.plus:''}</small>${a.v}${a.plus?(a.plus>0?'+':'')+a.plus:''}</span><em>+</em><span class="skdie"><small>${c.kind==='inou'?'이능':c.kind==='mon'?esc(c.name):'혼자'} d${c.sides}</small>${c.v}</span>${r.bonus?`<em>${r.bonus>0?'+':'−'}</em><span class="skdie"><small>보정</small>${Math.abs(r.bonus)}</span>`:''}<em>=</em><span class="skdie tot" style="--c:${COL[r.ri]}"><small>합계</small>${r.total}</span><em>vs</em><span class="skdie tg"><small>목표</small>${r.target}</span></div>`:'';
  return `<div class="skbig" style="background:${COL[r.ri]}"><div class="skbigt">${RES[r.ri]}</div><div class="skbigs">합계 ${r.total} / 목표 ${r.target}</div></div>${dice}<details class="skdet"><summary>굴림 자세히</summary><div class="pre small" style="white-space:pre-wrap">${esc(r.text.split('\n').slice(1).join('\n'))}</div></details>${r.cover?`<div class="small" style="margin-top:4px">커버: ${esc((trs()[r.cover.by]||{}).name)} 이(가) 받쳐 ${RES[r.cover.from]} → ${RES[r.ri]}</div>`:''}
   ${canMyosu?`<div class="row" style="margin-top:8px"><span class="small dim">묘수 (${k.myosu}/${myosuMax(t)}): 주사위 하나를 다시 굴린다</span><span class="sp"></span><button class="btn sm" data-myosu="a">자질 주사위 다시</button><button class="btn sm" data-myosu="c">${r.how==='inou'?'두 번째 주사위':'동료 주사위'} 다시</button></div>`:''}`}
 /* 굴리기 */
 async function roll(tid,O,md,pickId){const T=trs();const t=T[tid];const k=tsk(tid);const C=cfg();const how=(md.querySelector('[name=how]:checked')||{}).value||'alone';const bonus=+($('#sk_bonus',md)||{}).value||0;
  if(how==='mon'&&!pickId)return A().toast('함께할 포켓몬을 골라 줘');
  const stat=O.stat;const inj=+k.inj||0;const aLv=LAD[S().strip(rankOf(t,'능력'))]||0;
  let target=O.target,npcTxt='';if(O.npcDice){const n1=d(O.npcDice[0]),n2=d(O.npcDice[1]);target=n1+n2;npcTxt=`${O.npc} → ${n1}+${n2} = ${target}`}
  const lines=[];let a={},c={},ri,total=0,fum=false;
  if(how==='aa'){ri=3;total=target;lines.push(`AA 특권 — 굴리지 않고 성공 (이능 1회 소모)`);await setT(tid,{aa:1,inou:(+k.inou||0)+1})}
  else{
   const D=dieOf(t,stat,{inj,step:O.step||0});if(D.autofail){ri=1;lines.push(`자질 주사위가 d4 아래로 내려가 자동 실패`)}
   else{
    const twice=O.twice||0;const r1=d(D.sides),r2=twice?d(D.sides):null;let av=twice>0?Math.max(r1,r2):twice<0?Math.min(r1,r2):r1;let pmTxt='';
    if(O.pm>0&&av===1){av=2;pmTxt=' (능숙함 1→2)'}else if(O.pm<0&&av===D.sides){av=D.sides-1;pmTxt=` (서투름 ${D.sides}→${av})`}
    a={sides:D.sides,r1,r2,v:av,plus:D.plus};
    if(how==='inou'){const Dc=dieOf(t,'능력',{inj:C.both1?inj:0,step:O.step||0});const cv=d(Dc.sides);c={sides:Dc.sides,v:cv,kind:'inou'};await setT(tid,{inou:(+k.inou||0)+1})}
    else if(how==='mon'){const m=mons()[pickId];const bond=stat==='통솔'&&hasBond(m);const cs=bond?8:6;const cv=d(cs);c={sides:cs,v:cv,kind:'mon',mid:pickId,name:m.name,bond,pride:prideA(m)&&!bond};
     const owner=m.tid;const ok=tsk(owner);if(!ok.tired.includes(pickId)){ok.tired.push(pickId);await setT(owner,{tired:ok.tired})}}
    else{c={sides:4,v:d(4),kind:'alone'}}
    total=av+(D.plus||0)+c.v+bonus;fum=av===1&&c.v===1;ri=judge(total,target,fum,how==='inou'?aLv:lv(rankOf(t,stat)));
    lines.push(`자질 d${D.sides}${D.plus?(D.plus>0?'+':'')+D.plus:''} → ${av}${pmTxt}${twice?` (두 번 ${r1}, ${r2} 중 ${twice>0?'높은':'낮은'} 값)`:''}${D.injStep?` (${inj>=2?'중상':'부상'} −${D.injStep}단계)`:''}${O.step?` (상황 ${O.step>0?'↑':'↓'})`:''}`);
    lines.push(c.kind==='inou'?`이능 주사위 d${c.sides} → ${c.v}`:c.kind==='mon'?`동료 「${c.name}」 d${c.sides}${c.bond?' (유대)':''} → ${c.v}${c.pride&&c.v===1?' — 프라이드 A 고집! 대가 하나':''}`:`혼자 d4 → ${c.v}`);
    if(bonus)lines.push(`보정 ${bonus>0?'+':''}${bonus}`);if(fum)lines.push('두 주사위 모두 1 — '+(ri===0?'대실패':'A 이상이라 실패로'));}}
  const text=`스킬 체크 · ${t.name} · ${stat}(${rankOf(t,stat)||'-'})${O.label?' · '+O.label:''}${how==='inou'?' · 이능':''}\n${lines.join('\n')}\n합계 ${total} / 목표 ${target}${npcTxt?' ('+npcTxt+')':''}\n→ ${RES[ri]}${c.pride&&c.v===1?' (+ 고집의 대가)':''}`;
  const res={offerId:O.id,tid,how,stat,target,a,c,bonus,ri,total,text,at:Date.now()};
  if(how==='inou'&&ri<=1){const mid=await pickMon(tid,'이능 실패 — 부상','반동을 받을 소지 포켓몬 1체');const r=await injure(tid,mid);res.inj={prev:inj,mid};res.text+='\n'+r.line}
  await A().set(['skill','res',tid],res);const hist=(st().hist||[]).slice(-40);hist.push({ri,text:res.text,at:res.at});await A().set(['skill','hist'],hist);
  A().closeModal();A().sysLog(res.text,'dice');try{if(window.OM_CUTIN)window.OM_CUTIN.phase(RES[ri],`${t.name} · ${stat} ${total}/${target}`)}catch(e){}
  if(O.pen&&O.pen.auto){const sub=ri<=1?O.pen.fail:ri===2?O.pen.cost:null;if(sub&&penHas(sub)){await applyPenalty(tid,sub,(O.label||'스킬 체크')+' · '+RES[ri]);await A().set(['skill','res',tid,'penDone'],1)}}
  setTimeout(()=>openPlayer(tid),300)}
 /* 묘수: 주사위 하나 다시 */
 async function myosu(tid,which){const T=trs();const t=T[tid];const k=tsk(tid);const r=JSON.parse(JSON.stringify((st().res||{})[tid]));if(!r||r.myosu)return;
  if(which==='a'){const nv=d(r.a.sides);r.text+=`\n묘수: 자질 주사위 다시 ${r.a.v} → ${nv}`;r.a.v=nv}else{const nv=d(r.c.sides);r.text+=`\n묘수: ${r.c.kind==='inou'?'이능':'동료'} 주사위 다시 ${r.c.v} → ${nv}`;r.c.v=nv}
  r.total=(r.a.v||0)+(r.a.plus||0)+(r.c.v||0)+(r.bonus||0);const fum=r.a.v===1&&r.c.v===1;r.ri=judge(r.total,r.target,fum,r.how==='inou'?LAD[S().strip(rankOf(t,'능력'))]:lv(rankOf(t,r.stat)));r.text+=`\n합계 ${r.total} / 목표 ${r.target} → ${RES[r.ri]}`;r.myosu=1;
  await setT(tid,{myosu:(+k.myosu||0)+1});await A().set(['skill','res',tid],r);A().closeModal();A().sysLog(`${t.name} 묘수! ${which==='a'?'자질':'동료'} 주사위 다시 → 합계 ${r.total} / ${r.target} → ${RES[r.ri]}`,'dice');setTimeout(()=>openPlayer(tid),200)}
 /* 커버 */
 async function cover(byTid,forTid){const T=trs();const k=tsk(byTid);const C=cfg();if(k.inj>=2&&C.nocover2)return A().toast('중상이라 받칠 수 없다');const r=JSON.parse(JSON.stringify((st().res||{})[forTid]));if(!r||r.cover||r.ri>=3)return;
  if(!confirm(`${T[forTid].name}의 「${RES[r.ri]}」을(를) 한 칸 올리고 내가 부상을 입을까?`))return;
  const from=r.ri;r.ri=Math.min(3,r.ri+1);r.cover={by:byTid,from};r.text+=`\n커버: ${T[byTid].name} 이(가) 받침 → ${RES[r.ri]}`;
  if(r.inj){await setT(forTid,{inj:r.inj.prev});r.text+=`\n${T[forTid].name}의 반동(부상)은 없던 일로`;delete r.inj}
  const mid=await pickMon(byTid,'커버 — 부상','부상을 받을 소지 포켓몬 1체');const inj=await injure(byTid,mid);r.text+='\n'+inj.line;
  await A().set(['skill','res',forTid],r);A().closeModal();A().sysLog(`${T[byTid].name} 커버! ${T[forTid].name}: ${RES[from]} → ${RES[r.ri]} · ${inj.line}`,'dice');setTimeout(()=>openPlayer(byTid),200)}
 /* 돌봄 */
 async function care(tid,ownerTid,mid){const k=tsk(tid);if(k.care)return;const ok=tsk(ownerTid);ok.tired=ok.tired.filter(x=>x!==mid);await setT(ownerTid,{tired:ok.tired});await setT(tid,{care:1});A().closeModal();A().sysLog(`${trs()[tid].name} 돌봄 — 「${(mons()[mid]||{}).name}」 지침 회복`,'dice');setTimeout(()=>openPlayer(tid),200)}
 /* 상단 버튼에 제시 표시 */
 function pending(){const O=st().offer;if(!O)return false;const tid=me();if(gm())return true;if(!tid||!(O.ids||[]).includes(tid))return false;const r=(st().res||{})[tid];return !(r&&r.offerId===O.id)}
 /* 10-26 던전 연계: 방에 넣어 둔 체크를 그대로 제시 (dungeon_ui). o0 = 예시 모양 {label,stat,mode,target,npc,step,twice,pm,pen} */
 function presetList(){return [...EX.map((e,i)=>({id:'ex'+i,name:e.name,o:e.o})),...(st().presets||[]).map(p=>({id:p.id,name:p.name,o:p.o}))]}
 async function present(o0,ids,by){if(!gm())return false;const T=trs();ids=(ids||[]).filter(i=>T[i]);if(!ids.length){A().toast('체크를 받을 트레이너가 없다');return false}o0=o0||{};const npc=NPC.find(x=>x[0]===+o0.npc);
  /* 10-28: 던전 체크에 auto(easy · normal · hard)가 있으면 지금 일행으로 목표를 셈한다 (시뮬 자동 생성 던전은 난이도 띠만 적어 보낸다) */
  let target=+o0.target||7,auto='';if(BAND[o0.auto]&&!(npc&&npc[2])){const a=autoTarget(ids,{stat:o0.stat||'지시',mode:o0.mode||'skill',step:+o0.step||0,twice:+o0.twice||0,pm:+o0.pm||0},o0.auto);if(a){target=a.target;auto=o0.auto}}
  const o={id:'o'+Date.now().toString(36),label:o0.label||'',stat:o0.stat||'지시',mode:o0.mode||'skill',target,auto,npc:npc&&npc[2]?npc[1]:'',npcDice:npc&&npc[2]?npc[2]:null,step:+o0.step||0,twice:+o0.twice||0,pm:+o0.pm||0,pen:{fail:penNorm((o0.pen||{}).fail),cost:penNorm((o0.pen||{}).cost),auto:cfg().penAuto?1:0},ids,at:Date.now()};
  await A().set(['skill','offer'],o);await A().set(['skill','res'],{});
  A().sysLog(`【스킬 체크】 ${o.label||'판정'}${by?' · '+by:''}\n${o.stat}${o.mode==='inou'?' · 이능':''} · 목표 ${o.target}${o.auto?' (자동 · '+BAND[o.auto][2]+')':''}${o.npc?' (대항 '+o.npc+')':''}${o.step?' · 단계 '+(o.step>0?'유리':'불리'):''}${o.twice?' · 두 번 굴려 '+(o.twice>0?'높은':'낮은')+' 값':''}${o.pm?' · '+(o.pm>0?'능숙함':'서투름'):''}\n대상: ${ids.map(i=>(T[i]||{}).name).join(', ')}${penHas(o.pen.fail)?'\n실패: '+penTxt(o.pen.fail):''}${penHas(o.pen.cost)?'\n대가: '+penTxt(o.pen.cost):''}`,'battle',{});try{window.OM_RP_UI&&window.OM_RP_UI.playSe('Ping2')}catch(e){}return true}
 const sumOf=o=>offerSummary(Object.assign({stat:'지시',target:7},o||{},{npc:''}));
 return {open,openGm,openPlayer,pending,applyRest,restCfg,KINDS,tsk,cfg,presetList,present,sumOf,autoTarget,okPlusOf,BAND};
})();
