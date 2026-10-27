/* 던전 자동 생성 (2026-10-27 망령 「시뮬레이터에 던전 자동 생성 매커니즘을 만들어봐 · 문서로도」)
   gen.js 의 make()(실험용 손잡이)를 감싸서, 10-27 가이드라인을 기본값으로 한 「바로 쓰는」 던전을 만든다.
     generate({tier, seed, theme, knobs, wild, boss, name})  → 시뮬 던전 JSON (dungeon.run 으로 그대로 돌린다. dg.rules = 던전 규칙값)
     toWebtool(dg, names)                                    → 웹툴 던전 탭 꼴 {n,o,a,al,st,wn,r:{rid:{n,t,x,y,sk,rk,m}},l}
   가이드라인(records/feedback.md 「10-27 저녁 개정」, docs/던전_자동생성.md):
     공통  야생 · 보스 Lv −5 · 체크 4 (목표 7 · 9 섞기, 타입 조건 1개, 자질 넷 고루) · 보스 앞 짧은 휴식 하나(휴식 2안)
           경계도: 대가 +15 · 실패 +30 · 일반 조우 +10 · 30 → 야생 Lv +5 · 70 → +10 · 100 → 자동 실패
     쉬움  보스방 4체 · 레이드 2 · 사전 배틀 0   (승률 약 8할)
     보통  보스방 4체 · 레이드 3 · 사전 배틀 2   (약 6할)
     어려움 보스방 6체 · 레이드 3 · 사전 배틀 0~1 (약 3할) */
"use strict";
const fs=require('fs');
const G=require('./gen.js'),BT=require('./battle.js');
const COMMON={lv:-5,bossLv:-5,checks:4,tgt:'mix',pen:'alert',alCost:15,alFail:30,rest:'short',hintTyped:1,foes:2};
const DEX_BST={wild:[400,520],boss:[520,600]};   /* 도감 야생 종족치 범위 — 보스는 600족까지(전설 · 환상 680 이상은 안 나옴) */
const RULES={restV:2,alBattle:10,al30:5,al70:10};
const PRESET={easy:{battles:[0]},normal:{battles:[2]},hard:{battles:[0,1]}};
const TIER_KO={easy:'쉬움',normal:'보통',hard:'어려움'};
/* 테마: 방 이름 · 체크 문구 · 단서 · 보스 방 이름. 문구만 바뀌고 숫자는 같다 */
const THEMES={
 폐가:{types:['고스트','악','독','에스퍼','노말'],a:'안개 · 폐가',name:['숲 속의 폐가','버려진 별장','흐느끼는 저택'],entry:['녹슨 철문','무너진 현관','잡초 덮인 정원'],battle:['현관 홀','삐걱이는 계단','곰팡이 핀 식당','지하 창고'],check:['2층 서재','흐느끼는 복도','잠긴 아이 방','거울의 방'],safe:['다락 아래 골방','오래된 부엌'],boss:['다락','지하 예배실'],treasure:['먼지 쌓인 금고'],
  chk:{지시:['흩어진 일기장의 순서를 맞춘다','거울 장치의 각도를 맞춘다'],육성:['겁먹은 야생 포켓몬을 달랜다','곰팡이 독을 가려낸다'],통솔:['무너지는 계단을 함께 건넌다','어둠 속에서 대열을 지킨다'],능력:['흐느끼는 소리의 정체를 쫓는다','봉인된 문을 연다']}},
 동굴:{types:['바위','땅','강철','고스트','격투'],a:'어둠 · 동굴',name:['검은모래 동굴','울림 동굴','이끼 낀 갱도'],entry:['갱도 입구','바위틈'],battle:['박쥐 굴','지하 호수','갈림길 광장','수정 회랑'],check:['좁은 틈','낙석 구간','지하 물길','메아리 방'],safe:['마른 동굴','버려진 광부 쉼터'],boss:['가장 깊은 굴','수정 왕좌'],treasure:['광석 더미'],
  chk:{지시:['메아리로 길을 찾는다','무너질 바위를 읽는다'],육성:['야생의 발자국을 쫓는다','다친 포켓몬을 응급 처치한다'],통솔:['물길을 함께 건넌다','겁먹은 포켓몬을 진정시킨다'],능력:['낙석을 막아 선다','어둠 속 기척을 읽는다']}},
 숲:{types:['풀','벌레','독','비행','노말','페어리'],a:'안개 · 숲',name:['안개 숲','뒤엉킨 덩굴숲','고목의 숲'],entry:['숲 어귀','이정표 앞'],battle:['덤불 사이','쓰러진 고목','버섯 군락','개울가'],check:['길 잃은 오솔길','덩굴 장벽','독 늪','갈림길'],safe:['나무꾼 오두막','맑은 샘'],boss:['고목의 심장','안개 호수'],treasure:['새 둥지'],
  chk:{지시:['안개 속 표식을 따라간다','덩굴의 매듭을 푼다'],육성:['독초와 약초를 가려낸다','야생의 흔적을 쫓는다'],통솔:['늪을 함께 건넌다','안개 속에서 대열을 지킨다'],능력:['쓰러진 나무를 치운다','숲의 속삭임을 듣는다']}},
 연구소:{types:['전기','강철','독','에스퍼','노말'],a:'폐허 · 연구소',name:['버려진 연구소','봉쇄된 실험동','지하 관측소'],entry:['정문 게이트','화물 승강기'],battle:['조립 라인','사육실','통제실 앞 복도','배양조 홀'],check:['보안 문','감전 복도','배전반','기록 보관실'],safe:['휴게실','비상 대피소'],boss:['실험 심부','중앙 제어실'],treasure:['잠긴 사물함'],
  chk:{지시:['보안 장치를 해제한다','배전반 회로를 맞춘다'],육성:['폭주한 실험체를 진정시킨다','오염된 사료를 가려낸다'],통솔:['정전 속에서 대열을 지킨다','무너지는 통로를 함께 지난다'],능력:['감전 복도를 돌파한다','기록의 암호를 읽는다']}},
 유적:{types:['바위','고스트','에스퍼','땅','드래곤'],a:'고대 · 유적',name:['잠든 유적','모래에 묻힌 신전','고문서 번역소'],entry:['무너진 아치','모래 계단'],battle:['석상 회랑','기둥의 방','무너진 서고','제단 앞'],check:['문자 석판','움직이는 바닥','봉인의 문','별자리 천장'],safe:['순례자의 방','샘이 솟는 뜰'],boss:['왕의 묘실','금서고'],treasure:['봉헌함'],
  chk:{지시:['옛 문자를 해독한다','바닥 장치의 순서를 읽는다'],육성:['석상에 깃든 포켓몬을 달랜다','유물의 진위를 가린다'],통솔:['움직이는 바닥을 함께 건넌다','어둠 속 대열을 지킨다'],능력:['봉인을 푼다','유물의 기억을 읽는다']}},
 /* 10-27 밤: 야생 DB 서식지 8곳에 맞춰 바다 · 화산 · 설원 추가 (전에는 이 셋에만 사는 야생이 던전에 안 나왔다) */
 바다:{types:['물','얼음','비행','전기'],a:'파도 · 바다',name:['난파선 해안','썰물 동굴','등대 섬'],entry:['부서진 선착장','모래톱'],battle:['갯바위','난파선 갑판','해초 숲','조수 웅덩이'],check:['밀물 통로','끊어진 다리','소용돌이 물길','녹슨 선실'],safe:['등대 아래 창고','마른 동굴'],boss:['난파선 선창','바다 동굴 끝'],treasure:['떠밀려 온 상자'],
  chk:{지시:['물때를 읽어 길을 고른다','표류물의 흐름을 읽는다'],육성:['그물에 걸린 포켓몬을 풀어 준다','상한 해산물을 가려낸다'],통솔:['밀물 전에 함께 건넌다','풍랑 속에서 대열을 지킨다'],능력:['소용돌이를 거슬러 헤엄친다','녹슨 문을 비튼다']}},
 화산:{types:['불꽃','바위','땅','드래곤','격투'],a:'열기 · 화산',name:['잿빛 화산','용암 동굴','유황 협곡'],entry:['재 덮인 등산로','갈라진 땅'],battle:['용암 강가','검은 바위 지대','유황 웅덩이','열기 굴'],check:['무너지는 비탈','용암 징검다리','유독 가스 지대','갈라진 동굴'],safe:['식은 용암 굴','온천 바위틈'],boss:['분화구','용암 호수'],treasure:['굳은 화석층'],
  chk:{지시:['가스가 덜한 길을 고른다','용암 흐름을 읽는다'],육성:['화상 입은 포켓몬을 돌본다','먹을 수 있는 열매를 가려낸다'],통솔:['열기 속에서 대열을 지킨다','징검다리를 함께 건넌다'],능력:['떨어지는 바위를 막는다','달아오른 바위를 밀어낸다']}},
 설원:{types:['얼음','강철','페어리','물'],a:'눈보라 · 설원',name:['눈보라 고원','얼어붙은 호수','빙하 틈'],entry:['눈 덮인 산길','얼음 계곡 입구'],battle:['얼음 들판','눈 무덤','서리 숲','빙벽 아래'],check:['얇은 얼음판','눈사태 비탈','빙하 틈새','화이트아웃'],safe:['산장','바람 막힌 바위굴'],boss:['빙하 심부','얼음 신전'],treasure:['얼음 속 유물'],
  chk:{지시:['눈보라 속 표식을 찾는다','얼음판의 두께를 읽는다'],육성:['얼어 가는 포켓몬을 데운다','눈 아래 먹이를 찾는다'],통솔:['눈사태 비탈을 함께 지난다','화이트아웃 속 대열을 지킨다'],능력:['빙벽을 오른다','얼어붙은 문을 깬다']}}};
const RAIDN={2:'레이드 배틀 : 2',3:'레이드 배틀 : 3'};
function generate(o){o=o||{};const tier=o.tier||'normal';if(!PRESET[tier])throw new Error('난이도: easy | normal | hard');const seed=+o.seed||Math.floor(Math.random()*1e6);
 const rng=BT.mkRng(seed*7+3);const ri=n=>Math.floor(rng()*n);const pick=a=>a[ri(a.length)];
 const thName=o.theme&&THEMES[o.theme]?o.theme:Object.keys(THEMES)[ri(Object.keys(THEMES).length)];const th=THEMES[thName];
 const pre=PRESET[tier];const knobs=Object.assign({},COMMON,{battles:pick(pre.battles)},o.knobs||{});
 /* 야생 풀을 바꿀 수 있다: o.wild = [[트레이너 id, 순번, 이름]…] · o.boss = 같은 꼴 */
 /* 야생 출처: 'dex'(기본, 제작기 도감 실제 포켓몬 — 테마 타입 · 종족치 범위) | 'npc'(무진 NPC 풀, 10-27 맞추기에 쓴 것) */
 /* 'db'(야생 DB 가 있으면 기본): 테마 = 서식지. 일반 야생 = C 묶음(일반), 보스 = B · A 묶음. o.grades = {wild:['C'], boss:['B','A']} 로 바꿀 수 있다(등급 구성 실험용) */
 const GT={easy:{wild:['C'],boss:['B','A']},normal:{wild:['C'],boss:['A']},hard:{wild:['C','B'],boss:['A']}};/* 10-27 20:30 야생 DB 300체 기준 맞춤(gradecal_db300): 쉬움 88 · 보통 63 · 어려움 37% */const gr=Object.assign({},GT[tier]||GT.normal,o.grades||{});
 const WB=require('./wilddb.js');const hasDb=fs.existsSync(WB.FILE)&&(WB.read().v||1)>=2;const source=o.source||(hasDb?'db':'dex');let wild=o.wild,bossP=o.boss;
 if(source==='db'&&!wild){const all=WB.fullV2();const gr=Object.assign({},GT[tier]||GT.normal,o.grades||{});const inHab=e=>(e.hab||[]).includes(thName);
  const W0=all.filter(e=>inHab(e)&&gr.wild.includes(e.grade)),B0=all.filter(e=>inHab(e)&&gr.boss.includes(e.grade));
  wild=(W0.length>=8?W0:all.filter(e=>gr.wild.includes(e.grade))).map(e=>['db',e.id,e.name]);bossP=(B0.length>=3?B0:all.filter(e=>gr.boss.includes(e.grade))).map(e=>['db',e.id,e.name])}
 if(source==='dex'&&!wild){const DX=require('./dex.js');const wb=o.wildBst||DEX_BST.wild,bb=o.bossBst||DEX_BST.boss;
  const W0=DX.pick({types:th.types,bst:wb}),B0=DX.pick({types:th.types,bst:bb});wild=(W0.length>=8?W0:DX.pick({bst:wb})).map(d=>['dex',d.name,d.name]);bossP=(B0.length>=3?B0:DX.pick({bst:bb})).map(d=>['dex',d.name,d.name])}
 const keep={POOL:G.POOL.slice(),BOSS:G.BOSS.slice()};if(Array.isArray(wild)&&wild.length){G.POOL.length=0;G.POOL.push(...wild)}if(Array.isArray(bossP)&&bossP.length){G.BOSS.length=0;G.BOSS.push(...bossP)}
 let dg;try{dg=G.make(tier,knobs,seed)}finally{G.POOL.length=0;G.POOL.push(...keep.POOL);G.BOSS.length=0;G.BOSS.push(...keep.BOSS)}
 /* 테마 문구 입히기 */
 const used=new Set();const nm=list=>{const L=list.filter(x=>!used.has(x));const v=L.length?pick(L):pick(list)+' '+(used.size+1);used.add(v);return v};
 for(const r of dg.rooms){if(r.t==='entry')r.name=nm(th.entry);else if(r.t==='battle')r.name=nm(th.battle);else if(r.t==='safe')r.name=nm(th.safe);else if(r.t==='boss')r.name=nm(th.boss);else r.name=nm(th.check);
  if(r.check){const L=th.chk[r.check.stat];if(L)r.check.label=pick(L)}}
 /* 보물 방 하나(체크 · 조우 없음) — 지도 꾸밈 · 웹툴에서 단서 자리 */
 if(o.treasure!==false){const at=1+ri(Math.max(1,dg.rooms.length-2));dg.rooms.splice(at,0,{id:'tr',t:'treasure',name:nm(th.treasure),clue:{t:'단서',d:'(GM 이 채운다 — 보스의 약점 · 다음 장면의 실마리 등)'}})}
 const bossName=dg.gen.boss;
 dg.id=o.id||`auto_${tier}_${seed}`;dg.name=o.name||`${pick(th.name)} (${TIER_KO[tier]})`;dg.theme=thName;dg.owner=bossName;
 dg.rules=Object.assign({},RULES,o.rules||{});dg.private=true;
 dg.note=`자동 생성 · ${TIER_KO[tier]} · 씨앗 ${seed} · 테마 ${thName}. 사전 배틀 ${knobs.battles} · 체크 ${knobs.checks} · 보스방 ${G.TIER[tier].bossN}체 · ${RAIDN[G.TIER[tier].raid]} · 야생 Lv ${knobs.lv>=0?'+':''}${knobs.lv}.`;
 dg.gen=Object.assign({},dg.gen,{v:1,auto:true,theme:thName,rules:dg.rules,source,grades:source==='db'?gr:undefined});
 return dg}
/* 웹툴 던전 탭 꼴로 — 지도 좌표(지그재그) · 통로 · 방마다 sk(스킬 체크) · rk(휴식 단계) · m(GM 메모: 조우 구성 · 경계도 패널티 · 단서) */
const PEN_KO=p=>{if(!p)return '';const L=[];if(p.al)L.push('경계도 +'+p.al);if(p.dmg)L.push('HP −'+p.dmg);if(p.st)L.push('상태 '+({Paralysis:'마비',Poison:'독',Confusion:'혼란',Burn:'화상',Sleep:'잠듦'}[p.st]||p.st));if(p.oo)L.push('다음 배틀 4식 −'+p.oo);if(p.oc)L.push('다음 배틀 6령 −'+p.oc);if(p.rk)L.push('랭크 '+Object.entries(p.rk).map(([k,v])=>k+(v>0?'+':'')+v).join(' '));if(p.memo)L.push(p.memo);return L.join(' · ')};
function toWebtool(dg,names){names=names||{};for(const [t,i,n] of G.POOL.concat(G.BOSS)){names[t]=names[t]||{};if(names[t][i]==null)names[t][i]=n}const nameOf=(t,i)=>t==='dex'?i:t==='db'?((names.db||{})[i]||i):(names[t]&&names[t][i])||`${t} #${i}`;const rs=dg.rooms;const COLS=4,cw=200,rh=180;
 const r={},l={};const rid=x=>x.id.replace(/[^\w]/g,'').slice(0,8)||('r'+Math.random().toString(36).slice(2,6));
 rs.forEach((x,i)=>{const row=Math.floor(i/COLS),col=i%COLS,c=row%2?COLS-1-col:col;const id=rid(x);const o={n:x.name,t:x.t,x:110+c*cw,y:140+row*rh};const memo=[];
  if(x.check){const c0=x.check;o.sk={label:c0.label,stat:c0.stat,mode:c0.mode==='inou'?'inou':'skill',target:+c0.target,name:c0.label};if(c0.step)o.sk.step=c0.step;if(c0.twice)o.sk.twice=c0.twice;
   const pf=Object.assign({},c0.pen&&c0.pen.fail),pc=Object.assign({},c0.pen&&c0.pen.cost);for(const q of [pf,pc]){const a=q.al?`경계도 +${q.al}`:'';delete q.al;if(a)q.memo=[q.memo,a].filter(Boolean).join(' · ')}   /* 웹툴 패널티 칸에 경계도가 없어서 메모로 */o.sk.pen={fail:pf,cost:pc};
   memo.push(`🎲 ${c0.stat} ${c0.target}${c0.mode==='inou'?' (능력 A↑ 이능)':''} · 동료 ${c0.hint==='any'||!c0.hint?'아무 포켓몬':String(c0.hint).replace('type:','타입 ')}`);memo.push(`  실패: ${PEN_KO(c0.pen&&c0.pen.fail)}`);memo.push(`  대가: ${PEN_KO(c0.pen&&c0.pen.cost)}`)}
  if(x.enc&&x.enc.mix){const mons=x.enc.mix.flatMap(m=>m.sp?[m.sp]:(m.pick||[]).map(i=>nameOf(m.trainer,i)));const lv=+x.enc.lvAdd||0;
   memo.push(`${x.enc.boss?'♛ 보스방':'⚔ 야생'} ${mons.length}체 · Lv ${lv>=0?'+':''}${lv} (경계도 30↑ +${dg.rules&&dg.rules.al30||5} · 70↑ +${dg.rules&&dg.rules.al70||10})`);
   memo.push('  '+mons.map((n,j)=>x.enc.boss&&j===(+x.enc.bossAt||0)?`★${n}『와일드 보스』${x.enc.raid?' 「레이드 배틀 : '+x.enc.raid+'」':''}`:`${n}『와일드』`).join(' · '));if(!x.enc.boss&&dg.rules&&dg.rules.alBattle)memo.push(`  배틀이 끝나면 경계도 +${dg.rules.alBattle}`)}
  if(x.rest)o.rk=x.rest==='mid'?'short':x.rest;
  if(x.clue)o.cl={t:x.clue.t,d:x.clue.d};
  if(memo.length)o.m=memo.join('\n').slice(0,400);r[id]=o;if(i)l[[rid(rs[i-1]),id].sort().join('~')]=1});
 return {n:dg.name,o:dg.owner?`(자동 생성) ${dg.owner}`:'',a:THEMES[dg.theme]?THEMES[dg.theme].a:(dg.theme||''),al:0,st:rid(rs[0]),wn:dg.wn||2,r,l,gen:{tier:dg.gen.tier,seed:dg.gen.seed,theme:dg.theme,rules:dg.rules}}}
module.exports={DEX_BST,generate,toWebtool,THEMES,PRESET,COMMON,RULES,TIER_KO};
