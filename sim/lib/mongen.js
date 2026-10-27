/* 오리지널 야생몬 무작위 생성기 (10-27 밤 망령 「제작기 규칙을 보고 포켓몬을 그럴듯한 수준으로 제작하는 랜덤 생성기」).
   명세: docs/야생몬_제작_로직.md. 계산은 lib/pride.js(제작기 customCalc) 로 검증한다 — 만든 모든 몬은 calc().step 이 목표 계단과 같고 legal() 을 통과한다.
   한 체: {id, origin:'orig', name, types, base, ability, abilityTo, pride, grade, hab, role, kind(역할형), dual, moves:[], concept, ct}
   역할형(kind): 물리 스위퍼 · 특수 스위퍼 · 물리 탱커 · 특수 벽 · 밸런스 · 쌍두(물리 · 특수기 둘 다 → 쌍두 할인 적용).
   이름: 「수식어 + 생물/사물 어근」 식 한국어 오리지널 (타입별 어휘 은행). 제작기 도감 이름 · 서로 겹치지 않게.
   포텐셜 · 선공기 · 선공 특성은 넣지 않는다(명세). */
"use strict";
const fs=require('fs'),path=require('path'),vm=require('vm');
const P=require('./pride.js');
const {makerRoot}=require('./env.js');
const TYPES=['노말','불꽃','물','전기','풀','얼음','격투','독','땅','비행','에스퍼','벌레','바위','고스트','드래곤','악','강철','페어리'];
const HAB={폐가:['고스트','악','독','에스퍼','노말'],동굴:['바위','땅','강철','고스트','격투'],숲:['풀','벌레','독','비행','노말','페어리'],연구소:['전기','강철','독','에스퍼','노말'],유적:['바위','고스트','에스퍼','땅','드래곤'],바다:['물','얼음','비행','전기'],화산:['불꽃','바위','땅','드래곤','격투'],설원:['얼음','강철','페어리','물']};
/* 둘째 타입 짝 — 자연스러운 조합 위주 (첫 타입 → 후보). 없는 쌍은 안 나온다 */
const PAIR={노말:['비행','페어리','격투','에스퍼','풀'],불꽃:['격투','비행','바위','땅','악','고스트'],물:['얼음','비행','땅','독','페어리','바위','악'],전기:['강철','비행','물','에스퍼','페어리'],풀:['독','벌레','페어리','땅','고스트','비행'],얼음:['물','비행','땅','고스트','강철'],격투:['바위','땅','강철','악','불꽃'],독:['벌레','풀','악','물','고스트','땅'],땅:['바위','강철','독','물','드래곤','불꽃'],비행:['노말','벌레','물','전기','드래곤'],에스퍼:['페어리','고스트','비행','물','노말'],벌레:['독','풀','비행','강철','바위'],바위:['땅','강철','물','불꽃','고스트'],고스트:['독','악','에스퍼','풀','얼음'],드래곤:['비행','땅','물','강철','불꽃'],악:['고스트','비행','독','격투','강철'],강철:['바위','땅','전기','격투','벌레'],페어리:['풀','물','에스퍼','비행','노말']};
/* 생물 어근의 체형 — fast 날렵 · bulky 묵직 · spec 특수(마법 · 빛 · 소리) · 역할형에 맞는 어근을 고른다 */
const BODY={두더지:'bulky',토끼:'fast',다람쥐:'fast',오소리:'bulky',족제비:'fast',염소:'bulky',들소:'bulky',너구리:'',여우:'fast spec',도마뱀:'fast',사자:'fast',멧돼지:'bulky',살라만더:'spec',불나방:'spec fast',수탉:'fast',수달:'fast',거북:'bulky',게:'bulky',소라:'bulky spec',해파리:'spec',문어:'spec',물범:'bulky',가오리:'spec fast',개구리:'',늑대:'fast',뱀장어:'spec',반딧불:'spec',양:'bulky spec',고양이:'fast spec',사슴:'fast',나무늘보:'bulky',달팽이:'bulky',사마귀:'fast',곰:'bulky',올빼미:'spec',나방:'spec',원숭이:'fast',캥거루:'fast',두루미:'fast spec',개:'fast',두꺼비:'bulky',전갈:'',지네:'fast',뱀:'fast spec',민달팽이:'bulky',코뿔소:'bulky',아르마딜로:'bulky',하마:'bulky',지렁이:'bulky',매:'fast',까마귀:'fast spec',박쥐:'fast spec',갈매기:'fast',제비:'fast',딱정벌레:'bulky',거미:'',벌:'fast',매미:'spec',잠자리:'fast',골렘:'bulky',등불:'spec',인형:'spec',가면:'spec',촛불:'spec',항아리:'bulky spec',거울:'spec',열쇠:'spec fast',악어:'bulky',하이에나:'fast',갑옷:'bulky',톱니:'bulky',개미:'',종:'bulky spec',나비:'spec fast'};
const WANT={'물리 스위퍼':['fast'],'특수 스위퍼':['spec','fast'],'물리 탱커':['bulky'],'특수 벽':['bulky','spec'],'밸런스':[],'쌍두':['fast','spec']};
const STEP_IDX={C:0,'C+':1,B:2,'B+':3,A:4};
const GRADE_OF={C:'C','C+':'C',B:'B','B+':'B',A:'A'};
/* 역할형 — 명세 3절 예시 줄을 씨앗으로, 계단마다 [HP,공,방,특공,특방,스] */
const KINDS={
 '물리 스위퍼':{dual:false,seed:{C:[75,110,70,40,70,110],'C+':[80,115,70,45,70,115],B:[80,120,75,45,75,120],'B+':[85,125,75,50,75,125],A:[90,125,80,50,80,125]},key:[1,5],soft:[0,2,4]},
 '특수 스위퍼':{dual:false,seed:{C:[75,40,70,110,70,110],'C+':[80,45,70,115,70,115],B:[80,45,75,120,75,120],'B+':[85,50,75,125,75,125],A:[90,50,80,125,80,125]},key:[3,5],soft:[0,2,4]},
 '물리 탱커':{dual:false,seed:{C:[100,95,95,40,70,55],'C+':[105,100,95,45,75,55],B:[110,105,100,45,80,55],'B+':[115,105,105,50,85,55],A:[120,110,105,50,90,60]},key:[0,1,2],soft:[4,5]},
 '특수 벽':{dual:false,seed:{C:[105,40,85,85,105,50],'C+':[110,45,85,85,110,50],B:[115,45,90,90,115,55],'B+':[120,45,90,90,120,55],A:[125,50,95,95,125,55]},key:[0,3,4],soft:[2,5]},
 '밸런스':{dual:false,seed:{C:[80,85,80,65,80,80],'C+':[85,90,85,70,85,85],B:[90,95,90,70,90,85],'B+':[90,95,90,75,90,90],A:[95,100,95,80,95,95]},key:[1,5],soft:[0,2,3,4]},
 '쌍두':{dual:true,seed:{C:[75,90,70,90,70,85],'C+':[80,95,70,95,70,90],B:[85,100,75,100,75,95],'B+':[90,105,80,105,80,100],A:[95,105,85,105,85,105]},key:[1,3],soft:[0,2,4,5]}};
const KIND_NAMES=Object.keys(KINDS);
/* ---------- 특성 (제작기 MKM_DB.abil: [TO, 이름, 설명, …]) ---------- */
let ABIL=null;
function abil(){if(ABIL)return ABIL;const f=path.join(makerRoot(),'data','db.js');const ctx={window:{}};ctx.window.window=ctx.window;vm.createContext(ctx);vm.runInContext(fs.readFileSync(f,'utf8'),ctx);
 const rows=((ctx.window.MKM_DB||{}).abil||[]);
 /* 뺀다: 선공(우선도) · 종족치를 바꾸는 것(계산 종족치가 틀어짐) · 나무열매 · 포텐셜 · 세트 의존 · 폼 체인지 */
 const BAD=/우선도|선공|종족치|나무열매|포텐셜|폼|메가|다이맥스|테라|Z기술|교체했을 때|파트너|아군이|이 포켓몬이 쓰러|기절했을 때/;
 ABIL=rows.filter(r=>r[1]&&!BAD.test(String(r[2])+' '+String(r[1]))).map(r=>({to:String(r[0]),name:r[1],desc:String(r[2]||'')}));return ABIL}
/* 특성 고르기 — 타입 · 역할형과 맞는 설명에 점수를 주고 상위에서 무작위 (10-27 밤 망령 「콘셉트나 실전성 로직」) */
const KIND_RE={'물리 스위퍼':/공격|물리기|접촉기|스피드|급소/,'특수 스위퍼':/특공|특수기|스피드|급소/,'물리 탱커':/방어|HP|회복|반감|접촉기를 받|물리기를 받/,'특수 벽':/특방|HP|회복|반감|특수기를 받|상태가 되지 않/,'밸런스':/./,'쌍두':/공격|특공|기술의 대미지/};
function pickAbility(rng,types,toWant,kind){const L=abil().filter(a=>a.to===String(toWant));const re=KIND_RE[kind]||/./;
 const sc=L.map(a=>{let v=1;const d=a.desc;if(types.some(t=>d.includes('「'+t+'」')||d.includes(t+' 기술')||d.includes('타입 : '+t)))v+=3;if(re.test(d))v+=2;
  if(TYPES.some(t=>!types.includes(t)&&(d.includes('「'+t+'」 기술')||d.includes(t+' 기술')||d.includes('자신의 「'+t+'」'))&&!/받으면|받았을 때|받을/.test(d)))v-=3;/* 남의 타입 기술을 강화하는 특성 */
  if(/탱커|벽/.test(kind)&&/「(방어|특방|HP) : -/.test(d))v-=3;if(/스위퍼|쌍두/.test(kind)&&/「(공격|특공|스피드) : -/.test(d))v-=3;
  if(/퇴장|교대|교체/.test(d))v-=3;/* 야생은 교체하지 않는다 */ if(/날씨|필드/.test(d)&&!types.some(t=>d.includes(t)))v-=1;/* 혼자선 못 깔 조건 */ if(/나무열매|도구|소지품/.test(d))v-=2;
  if(/상대 전체|정면/.test(d)&&/등장/.test(d))v+=1;return {a,v:v+rng()*0.9}}).sort((x,y)=>y.v-x.v);
 return (sc[Math.floor(rng()*Math.min(5,sc.length))]||{}).a}
/* ---------- 종족치 만들기 ---------- */
const sum=b=>b.reduce((a,c)=>a+c,0);
const capOf=step=>P.STEPS[STEP_IDX[step]].v,floorOf=step=>STEP_IDX[step]>0?P.STEPS[STEP_IDX[step]-1].v:0;
/* 목표: calc().step === step, 그리고 계산 종족치가 「안쪽 끝」(아래 계단 상한 초과 ~ 상한) — C 는 455 이상 */
function fits(b,step,dual){if(!P.legal(b))return false;const r=P.calc(b,dual);if(r.step!==step)return false;const lo=step==='C'?455:floorOf(step)+1;return r.ct>=lo&&r.ct<=capOf(step)}
function makeBase(rng,step,kind){const K=KINDS[kind];const seed=K.seed[step];let best=null;
 for(let attempt=0;attempt<60;attempt++){const b=seed.map((v,i)=>{const j=K.key.includes(i)?6:K.soft.includes(i)?12:8;return Math.max(31,Math.min(255,v+Math.round((rng()*2-1)*j)))});
  /* 다듬기: 계단이 높으면 깎고, 낮으면 올린다 — 최대 120번 */
  for(let it=0;it<120;it++){const r=P.calc(b,K.dual);const lo=step==='C'?455:floorOf(step)+1;
   if(P.legal(b)&&r.step===step&&r.ct>=lo&&r.ct<=capOf(step))break;
   const tooHigh=STEP_IDX[r.step]>STEP_IDX[step]||r.step==='EX'||(r.step===step&&r.ct>capOf(step));
   const idxs=tooHigh?K.soft.concat(K.key):K.key.concat(K.soft);const i=idxs[Math.floor(rng()*idxs.length)];b[i]=Math.max(31,Math.min(255,b[i]+(tooHigh?-1:1)*(1+Math.floor(rng()*3))));
   if(sum(b)<P.DEF.realMin){const k=K.key[Math.floor(rng()*K.key.length)];b[k]+=P.DEF.realMin-sum(b)}}
  if(fits(b,step,K.dual)){best=b;break}}
 return best}
/* ---------- 이름 · 콘셉트 ---------- */
const MOD={노말:['들','얼룩','솜털','둥근','털복','점박이','회색'],불꽃:['잿','숯','화염','불','열사','용암','그을음'],물:['물','거품','소라','파도','이슬','소금','물보라'],전기:['번개','찌릿','전기','뇌','스파크','정전기','전류'],풀:['이끼','덩굴','꽃','새싹','풀잎','버섯','솔방울','가시풀'],얼음:['서리','얼음','눈','빙하','고드름','설','한파'],격투:['주먹','철권','투사','발차기','완력','근육'],독:['독','늪','진흙','가시독','독액','오염'],땅:['모래','흙','황토','진흙','점토','먼지'],비행:['바람','깃','구름','하늘','돌풍','회오리'],에스퍼:['꿈','달','별','거울','환','최면','수정'],벌레:['껍질','더듬이','실','꿀','갑각','유충'],바위:['돌','암','자갈','석','화석','광석'],고스트:['망령','유령','그림자','안개','등불','저주'],드래곤:['용','비늘','뿔','고룡','사룡'],악:['밤','검은','그늘','도둑','칠흑','어둠'],강철:['쇠','강철','톱니','무쇠','철갑','나사'],페어리:['요정','달콤','방울','리본','꽃가루','별빛']};
const BEAST={노말:['두더지','토끼','다람쥐','오소리','족제비','염소','들소','너구리'],불꽃:['여우','도마뱀','사자','멧돼지','살라만더','불나방','수탉'],물:['수달','거북','게','소라','해파리','문어','물범','가오리','개구리'],전기:['늑대','다람쥐','가오리','뱀장어','반딧불','양','고양이'],풀:['두더지','사슴','나무늘보','달팽이','사마귀','거북','여우','개구리'],얼음:['늑대','물범','올빼미','곰','여우','염소','나방'],격투:['곰','원숭이','캥거루','멧돼지','두루미','사마귀','개'],독:['두꺼비','전갈','지네','뱀','해파리','나방','민달팽이'],땅:['두더지','코뿔소','아르마딜로','거북','전갈','하마','지렁이'],비행:['매','올빼미','까마귀','두루미','박쥐','갈매기','제비'],에스퍼:['올빼미','고양이','사슴','여우','해파리','나방','원숭이'],벌레:['딱정벌레','거미','사마귀','나방','벌','지네','매미','잠자리'],바위:['거북','도마뱀','게','아르마딜로','달팽이','곰','골렘'],고스트:['등불','인형','가면','촛불','항아리','거울','열쇠','까마귀'],드래곤:['도마뱀','뱀','거북','가오리','지네','악어'],악:['늑대','까마귀','고양이','족제비','하이에나','박쥐','여우'],강철:['갑옷','톱니','거북','딱정벌레','개미','코뿔소','종'],페어리:['토끼','양','나비','사슴','고양이','다람쥐','인형']};
const VERB={노말:'들판을 어슬렁거리는',불꽃:'잿더미 속에서 몸을 데우는',물:'물가에 숨어 기다리는',전기:'털끝에 전기를 모으는',풀:'이끼와 덩굴을 몸에 키우는',얼음:'서리를 내뿜는',격투:'제 영역에 들어온 것과 맞붙는',독:'독을 흘리며 기어다니는',땅:'흙 속을 파고드는',비행:'바람을 타고 내려다보는',에스퍼:'눈빛으로 사람을 홀리는',벌레:'그늘에서 집을 짓는',바위:'바위인 척 가만히 있는',고스트:'밤에만 모습을 드러내는',드래곤:'오래 살아 비늘이 굳은',악:'어둠 속에서 뒤를 노리는',강철:'몸이 쇠처럼 굳은',페어리:'달콤한 향으로 꾀는'};
function makeName(rng,types,used,kind){const t1=types[0],t2=types[1];const want=WANT[kind]||[];const fit=L=>{const F=L.filter(b=>want.every(w=>(BODY[b]||'').includes(w)));return F.length?F:L.filter(b=>want.some(w=>(BODY[b]||'').includes(w)))||L};const bs=t=>{const F=fit(BEAST[t]);return F.length?F:BEAST[t]};
 for(let i=0;i<200;i++){const r=rng();let n,beast;
  if(t2&&r<0.55){beast=pick(rng,bs(t1));n=pick(rng,MOD[t2])+beast}else if(r<0.85){beast=pick(rng,bs(t2||t1));n=pick(rng,MOD[t1])+beast}else{const a=pick(rng,MOD[t1]);const b=pick(rng,MOD[t2||t1].filter(x=>x!==a));beast=pick(rng,bs(t1));n=a+b+beast}
  if(n.length>=3&&n.length<=6&&!used.has(n)&&!/(.{1,2})\1/.test(n)){used.add(n);return {name:n,beast}}}
 let k=1,n,beast=BEAST[t1][0];do n=pick(rng,MOD[t1])+beast+k++;while(used.has(n));used.add(n);return {name:n,beast}}
const pick=(rng,a)=>a[Math.floor(rng()*a.length)];
function concept(rng,types,kind,hab,beast){const t=types[0];const h1=hab.filter(h=>HAB[h].includes(t));const h=h1.length?pick(rng,h1):hab.length?pick(rng,hab):'들판';const tail={'물리 스위퍼':'빠르고 세게 들이받는다','특수 스위퍼':'거리를 두고 쏘아 댄다','물리 탱커':'맞아 가며 버틴다','특수 벽':'좀처럼 지치지 않는다','밸런스':'어디 하나 모자람이 없다','쌍두':'힘과 기교를 다 쓴다'}[kind];
 return `${h}에서 ${VERB[t]} ${beast||BEAST[t][0]}. ${types[1]?types[1]+' 기운도 띤다. ':''}${tail}.`}
const habOf=types=>Object.keys(HAB).filter(h=>types.some(t=>HAB[h].includes(t)));
/* ---------- 한 체 ---------- */
function one(rng,o){o=o||{};const step=o.step||'C';const kind=o.kind||pick(rng,KIND_NAMES);const t1=o.types&&o.types.length?o.types[0]:pick(rng,TYPES);const types=(o.types&&o.types.length?o.types.slice(0,2):[t1].concat(rng()<0.45?[pick(rng,PAIR[t1]||TYPES)]:[])).filter((t,i,a)=>a.indexOf(t)===i);
 const base=makeBase(rng,step,kind);if(!base)return null;const to=P.STEPS[STEP_IDX[step]].to;const ab=pickAbility(rng,types,to,kind);const hab=o.hab&&o.hab.length?o.hab:habOf(types);const used=o.used||new Set();
 const r=P.calc(base,KINDS[kind].dual);const nm=makeName(rng,types,used,kind);
 return {id:'',origin:'orig',name:nm.name,types,base,ability:ab?ab.name:'',abilityTo:to,pride:step,grade:GRADE_OF[step],hab,role:GRADE_OF[step]==='C'?'일반':'보스',kind,dual:KINDS[kind].dual,moves:[],concept:concept(rng,types,kind,hab,nm.beast),ct:Math.round(r.ct)}}
/* ---------- 묶음 — 계단별 수 · 서식지 고루 ---------- */
/* plan = {C:63,'C+':42,B:18,'B+':12,A:15}. 서식지(8곳)를 돌아가며, 그 서식지의 타입에서 첫 타입을 고른다 → 서식지마다 등급이 고루 걸린다. 18타입이 한 번씩은 첫 타입이 되게 앞부분은 타입 순서대로. */
function batch(rng,plan,used){used=used||new Set();const out=[];const habs=Object.keys(HAB);let hi=0;const tcount=Object.fromEntries(TYPES.map(t=>[t,0]));
 for(const step of ['C','C+','B','B+','A'])for(let i=0;i<(plan[step]||0);i++){
  const h=habs[hi++%habs.length];const hl=HAB[h].slice().sort((a,b)=>tcount[a]-tcount[b]||rng()-0.5);const t1=hl[0];tcount[t1]++;
  const t2=rng()<0.45?pick(rng,PAIR[t1]||TYPES.filter(t=>t!==t1)):null;const types=t2?[t1,t2]:[t1];
  /* 역할형: 등급이 오를수록 스위퍼 · 쌍두 비중을 조금 올린다 */
  const kinds=step==='A'||step==='B+'?KIND_NAMES.concat(['물리 스위퍼','특수 스위퍼','쌍두']):KIND_NAMES.concat(['밸런스','물리 탱커']);
  let m=null;for(let k=0;k<5&&!m;k++)m=one(rng,{step,kind:pick(rng,kinds),types,used});if(!m)continue;out.push(m)}
 return out}
function coverage(entries){const o={};for(const h of Object.keys(HAB)){o[h]={C:0,B:0,A:0};for(const e of entries)if((e.hab||[]).includes(h))o[h][e.grade]++}return o}
module.exports={TYPES,HAB,KINDS,KIND_NAMES,PAIR,BODY,one,batch,makeBase,makeName,coverage,abil,habOf,pickAbility};
