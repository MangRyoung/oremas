/* 오리지널 특성 생성기 (10-28 망령 「오리지널 특성 생성기도 시뮬레이터에 만들어서 넣게 로직 세워보자. 마음에 드는건 시뮬레이터 DB 로」).
   로직:
     1) 틀(family) = 제작기 특성 DB 에 실제로 있는 효과 꼴. 틀마다 「기준 특성(anchor)」을 두고, 그 특성들의 TO 를 기준값으로 쓴다.
        (예: 「X 기술을 받으면 S +1」 = 악의마음 · 주눅 TO 1, +2 면 꾸덕꾸덕굳기 TO 1.5)
     2) 세기 손잡이(stat 칸 수 · 발동 조건 폭 · 비례 대미지 덧붙임)마다 TO 를 0.5 단위로 더하거나 뺀다.
     3) 목표 TO 를 주면, 틀 하나로 못 맞추면 둘째 줄(②)에 작은 틀(상태 면역 0.5 등)을 붙여 맞춘다.
     4) 「시뮬 반영」: 웹툴 효과 엔진이 글을 읽어 자동으로 처리하는지 — 자동(m.auto: 맹화 꼴 · 등장 정면) · 피격 반응(hitRules: 「…를 받으면」) · 시뮬 GM(battle3: 상태일 때 회복) · 글만(GM 판정).
        시뮬 승률에 닿는 특성만 쓰려면 engine:'read'.
     5) 이름 = 타입 수식어 + 틀 꼬리말, 제작기 특성 · 특성 DB 와 겹치지 않게.
   한 개: {id, name, desc(제작기 글 꼴 ①②), to, fam:[틀], types, kind, engine, anchors:[기준 특성], note} */
"use strict";
const BT=require('./battle.js');
const TYPES=['노말','불꽃','물','전기','풀','얼음','격투','독','땅','비행','에스퍼','벌레','바위','고스트','드래곤','악','강철','페어리'];
const STATUS={Poison:'독',Burn:'화상',Paralysis:'마비',Sleep:'잠듦',Freeze:'얼음'};
const MOD={노말:['들','얼룩','솜털','둥근','회색'],불꽃:['잿','숯','화염','불','열사','용암'],물:['물','거품','파도','이슬','소금','물보라'],전기:['번개','찌릿','전기','뇌','스파크','전류'],풀:['이끼','덩굴','꽃','새싹','풀잎','버섯'],얼음:['서리','얼음','눈','빙결','성에'],
 격투:['주먹','근육','단련','기합','강철주먹'],독:['독','맹독','독침','늪','이끼독'],땅:['흙','모래','진흙','지반','사막'],비행:['바람','깃털','회오리','하늘','돌풍'],에스퍼:['염력','꿈','예지','환영','정신'],벌레:['벌레','더듬이','고치','날개','허물'],
 바위:['바위','돌','암석','자갈','화석'],고스트:['그림자','망령','도깨비','혼','저승'],드래곤:['용','비늘','역린','용암비늘'],악:['그늘','어둠','악의','밤','도둑'],강철:['쇠','강철','톱니','녹','은빛'],페어리:['요정','달빛','별빛','리본','꽃잎']};
const TAIL={react:['투지','반골','오기','심지','발끈'],touch:['가시','반격','되갚기','역습'],cat:['갑주','굳은껍질','방패','적응'],pinch:['불씨','각오','막판','집념','최후'],glare:['위압','서슬','기세','노려보기'],
 imSt:['내성','굳은살','단련','면역'],heal:['재생','회생','치유'],absorb:['흡수','삼킴','먹성','마중물'],cSt:['독침','정전','저주','홀씨','냉기'],cBack:['가시갑','톱날','바늘']};
const KO_ST=['공격','방어','특공','특방','스피드'];
/* 역할형에 맞는 능력 (mongen origAbility 와 같은 생각) */
const statFor=(rng,kind)=>/특수/.test(kind||'')?'특공':/탱커/.test(kind||'')?(rng()<0.6?'방어':'공격'):/벽/.test(kind||'')?'특방':/쌍두/.test(kind||'')?(rng()<0.5?'공격':'특공'):(rng()<0.6?'공격':'스피드');
const pick=(rng,a)=>a[Math.floor(rng()*a.length)];
/* ---------- 틀 ---------- 각 틀: make(rng, ctx) → {desc, to, engine, anchors, note} | null. ctx = {types, kind, weak(약점 타입), want(목표 TO)} */
const FAM={
 react:{ko:'약점 반응 (X 기술을 받으면 능력 +)',main:true,make:(rng,c)=>{const n=c.want>=1.5&&rng()<0.6?2:1;const X=c.weak.length?pick(rng,c.weak):pick(rng,TYPES.filter(t=>!c.types.includes(t)));const S=statFor(rng,c.kind);
  return {desc:`「${X}」 기술을 받으면 「${S} : +${n}」한다.`,to:n===2?1.5:1,engine:'피격 반응',anchors:n===2?['꾸덕꾸덕굳기']:['악의마음','주눅']}}},
 touch:{ko:'접촉 반응 (접촉기를 받으면 능력 +)',main:true,make:(rng,c)=>{const n=c.want>=2&&rng()<0.5?2:1;const S=statFor(rng,c.kind);return {desc:`「접촉기」를 받으면 「${S} : +${n}」한다.`,to:n===2?2:1.5,engine:'피격 반응',anchors:['대격분']}}},
 cat:{ko:'물리 · 특수 반응 (내주고 얻기)',main:true,make:(rng,c)=>{const ph=rng()<0.5;return {desc:`「${ph?'물리기':'특수기'}」를 받으면 「${ph?'방어':'특방'} : -1」, 「스피드 : +2」한다.`,to:1,engine:'피격 반응',anchors:[ph?'깨어진갑옷':'벗겨진도금']}}},
 pinch:{ko:'핀치 강화 (HP 낮을 때 자기 타입 1.5배)',main:true,make:(rng,c)=>{const half=c.want>=1.5&&rng()<0.6;const t=pick(rng,c.types);return {desc:`「HP : ${half?'1/2':'1/3'} 이하」일 때 자신의 「${t}」 기술의 대미지를 강화(1.5배)한다.`,to:half?1.5:1,engine:'자동',anchors:['맹화','급류','벌레의알림'],note:half?'1/2 은 기준(1/3)보다 넓어 +0.5':''}}},
 glare:{ko:'등장 견제 (정면 능력 −1)',main:true,make:(rng,c)=>{const dmg=c.want>=2&&rng()<0.6;const S=dmg?pick(rng,['공격','특공']):pick(rng,['공격','특공','명중','스피드']);
  return {desc:`【등장】/「정면」에게 「${S} : -1」${dmg?'하고 1/8만큼의 비례 대미지를 입힌다.\n②①로 「빈사」 상태가 되지 않는다.':'한다.'}`,to:dmg?2:1.5,engine:'자동',anchors:dmg?['위협사격','견제마법']:['재뒤집어쓰기'],multi:dmg}}},
 absorb:{ko:'타입 무효 (X 기술을 무효)',main:true,make:(rng,c)=>{const X=c.weak.length?pick(rng,c.weak):pick(rng,TYPES.filter(t=>!c.types.includes(t)));const up=c.want>=2&&rng()<0.6;const S=statFor(rng,c.kind);
  return {desc:`【방호】/「${X}」 기술을 무효화한다.${up?`\n②①로 무효화하면 「${S} : +1」한다.`:''}`,to:up?2:1.5,engine:'글만',anchors:['칼날잡기','방음'],multi:up,note:'약점 하나를 지운다 — 시뮬은 아직 안 읽는다(GM 판정)'}}},
 cSt:{ko:'접촉 상태이상 (3할로 공격한 쪽을 상태이상)',main:true,make:(rng,c)=>{const st=pick(rng,['Poison','Paralysis','Burn']);return {tail:{Poison:['독침','독가시','독털'],Paralysis:['정전','찌릿털','전기털'],Burn:['불씨털','열기','뜨거운몸']}[st],desc:`「접촉기」를 받으면 3할로 자신을 공격한 포켓몬을 「${STATUS[st]}」 상태로 만든다.`,to:1,engine:'피격 반응',anchors:['마그마의비늘 ②','저리는모피 ②']}}},
 cBack:{ko:'접촉 반격 (공격한 쪽에 1/8)',main:true,make:(rng,c)=>({desc:'「접촉기」를 받으면 자신을 공격한 포켓몬에게 1/8만큼의 비례 대미지를 입힌다.',to:1,engine:'피격 반응',anchors:['가시비늘 ②']})},
 heal:{ko:'상태 회복 (상태일 때 턴 종료 1/8 회복)',main:true,make:(rng,c)=>{const st=pick(rng,['Poison','Burn','Paralysis']);return {desc:`「${STATUS[st]}」 상태일 때 턴 종료 시 「HP」를 1/8만큼 회복한다.`,to:1,engine:'시뮬 GM',anchors:['포이즌힐']}}},
 imSt:{ko:'상태 면역 (작은 덧붙임)',main:false,make:(rng,c)=>{const no={Poison:['독','강철'],Burn:['불꽃'],Paralysis:['전기'],Freeze:['얼음']};const st=pick(rng,Object.keys(STATUS).filter(k=>!(no[k]||[]).some(t=>c.types.includes(t))));return {desc:`「${STATUS[st]}」 상태가 되지 않는다.`,to:0.5,engine:'글만',anchors:['면역','유연','불면']}}}};
const MAIN=Object.keys(FAM).filter(k=>FAM[k].main);
const ENG_READ=new Set(['자동','피격 반응','시뮬 GM']);
/* 약점: W(웹툴 OM_STATS) 가 있으면 계산, 없으면 비워 둔다(무작위 타입) */
function weakOf(W,types){const S=W&&W.OM_STATS;if(!S)return [];return TYPES.filter(x=>S.effect(S.typeEn(x),types.map(y=>S.typeEn(y)))>1)}
const circ=['①','②','③'];
/* o = {n, types[], kind, to(목표 TO, 0.5~2.5), fams[], engine:'read'|'any', seed|rng, W, usedNames:Set} */
function gen(o){o=o||{};const rng=o.rng||BT.mkRng(o.seed||Date.now()%1e6);const n=Math.max(1,Math.min(60,+o.n||8));const used=o.usedNames||new Set();const out=[];
 let fams=(o.fams&&o.fams.length?o.fams:MAIN).filter(k=>FAM[k]&&FAM[k].main);if(o.engine==='read')fams=fams.filter(k=>{const t=FAM[k].make(BT.mkRng(1),{types:['노말'],weak:[],kind:'',want:1});return ENG_READ.has(t.engine)});if(!fams.length)fams=MAIN;
 for(let i=0,guard=0;out.length<n&&guard<n*40;guard++,i++){const types=(o.types&&o.types.length?o.types:[pick(rng,TYPES)]).slice(0,2);const kind=o.kind||pick(rng,['물리 스위퍼','특수 스위퍼','물리 탱커','특수 벽','밸런스','쌍두']);
  const want=o.to!=null&&o.to!==''?+o.to:pick(rng,[1,1,1,1.5,1.5,2]);const c={types,kind,weak:weakOf(o.W,types),want};const fk=pick(rng,fams);const a=FAM[fk].make(rng,c);if(!a)continue;
  let to=a.to,desc=[a.desc],engine=[a.engine],anchors=a.anchors.slice(),famL=[fk];
  /* 목표보다 0.5 모자라면 작은 덧붙임(상태 면역 0.5) */
  if(want-to>=0.5-1e-9&&!a.multi){const b=FAM.imSt.make(rng,c);desc.push(b.desc);to+=b.to;engine.push(b.engine);anchors.push(...b.anchors);famL.push('imSt')}
  if(o.to!=null&&o.to!==''&&Math.abs(to-want)>1e-9)continue;   /* 목표 TO 를 정했으면 정확히 맞는 것만 */
  const text=desc.map((d,j)=>d.split('\n').map((l,k)=>/^[①②③]/.test(l)?l:(circ[j+k]||'')+l).join('\n')).join('\n').replace(/\n②①로/g,'\n②①로');
  /* 이름 */let name='';for(let k=0;k<30;k++){const nm=pick(rng,MOD[types[0]]||['낯선'])+pick(rng,a.tail||TAIL[fk]||['기질']);if(!used.has(nm)){name=nm;break}}if(!name)continue;used.add(name);
  const eng=engine.every(e=>ENG_READ.has(e))?engine[0]:engine.some(e=>ENG_READ.has(e))?engine.find(e=>ENG_READ.has(e))+' (일부 글만)':'글만';
  out.push({id:'ab'+Date.now().toString(36)+out.length+Math.floor(rng()*1e4).toString(36),name,desc:fixNum(text),to:+to.toFixed(1),fam:famL,types,kind,engine:eng,anchors,note:a.note||''})}
 return out}
/* ①② 번호 다시 매기기 */
function fixNum(t){const L=t.split('\n').map(l=>l.replace(/^[①②③]/,''));return L.map((l,i)=>circ[i]+l).join('\n').replace(/②①로/g,'②①로')}
/* ---------- 특성 DB (data/abil/db.json) — 마음에 든 것 보관, 야생 생성(mongen)이 끌어 쓴다 ---------- */
const fs=require('fs'),path=require('path');const FILE=path.resolve(__dirname,'..','data','abil','db.json');
function read(){if(!fs.existsSync(FILE))return {v:1,entries:[]};return JSON.parse(fs.readFileSync(FILE,'utf8'))}
function write(d){d.at=new Date().toISOString();fs.mkdirSync(path.dirname(FILE),{recursive:true});fs.writeFileSync(FILE,JSON.stringify(d,null,1));return d}
function add(list){const d=read();const have=new Set(d.entries.map(e=>e.name));let n=0;for(const e of list||[]){if(!e||!e.name||have.has(e.name))continue;d.entries.push(Object.assign({},e,{at:new Date().toISOString()}));have.add(e.name);n++}write(d);return {added:n,total:d.entries.length}}
function remove(names){const d=read();const S=new Set(names||[]);const before=d.entries.length;d.entries=d.entries.filter(e=>!S.has(e.name));write(d);return {removed:before-d.entries.length,total:d.entries.length}}
/* 야생 생성이 쓸 것: 타입 · TO 가 맞는 DB 특성 하나 (없으면 null) */
function fromDb(rng,types,to){const L=read().entries.filter(e=>String(e.to)===String(to)&&(!e.types||!e.types.length||e.types.some(t=>types.includes(t))));return L.length?pick(rng,L):null}
module.exports={FAM,MAIN,TAIL,MOD,gen,weakOf,read,write,add,remove,fromDb,FILE,ENG_READ};
