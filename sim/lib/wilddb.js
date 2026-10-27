/* 야생 DB (10-27 망령 「야생 자체 데이터베이스를 잔뜩 · C / B / A 7:2:1 로 한 200개」)
   data/wild/db.json = {v, at, grades, entries:[{id, sp 도감 이름, grade C|B|A, hab [서식지], role 일반|보스, note}]}
   능력치 · 타입은 제작기 도감(lib/dex.js)에서 읽는다 — DB 에는 이름 · 등급 · 서식지만 둔다.
   등급(종족치 합): C 420~524 · B 525~569 · A 570~600 (제작기 프라이드 계단 B 525 · A 570 과 같은 선). 전설 · 환상 · UB · 패러독스 · 메가는 뺀다. */
"use strict";
const fs=require('fs'),path=require('path');
const DX=require('./dex.js');
const FILE=path.resolve(__dirname,'..','data','wild','db.json');
/* 제작기 프라이드 계단(올드 타입: 실제 합을 버림한 계단) — C 480 · C+ 503 · B 525 · B+ 548 · A 570 · 600 넘으면 EX. 480 미만은 0.5(최하)라 야생 DB 에서 뺀다.
   7:2:1 의 묶음: C 묶음 = C · C+ / B 묶음 = B · B+ / A 묶음 = A */
const STEPS=[['C',480],['C+',503],['B',525],['B+',548],['A',570]],CAP=600;
const prideOf=bst=>{if(bst<480||bst>CAP)return '';let p='';for(const [k,v] of STEPS)if(bst>=v)p=k;return p};
const GRADES={C:[480,524],B:[525,569],A:[570,600]};
/* 서식지 = 생성기 테마. 타입 하나라도 맞으면 그 서식지 */
const HAB={폐가:['고스트','악','독','에스퍼','노말'],동굴:['바위','땅','강철','고스트','격투'],숲:['풀','벌레','독','비행','노말','페어리'],연구소:['전기','강철','독','에스퍼','노말'],유적:['바위','고스트','에스퍼','땅','드래곤'],바다:['물','얼음','비행','전기'],화산:['불꽃','바위','땅','드래곤','격투'],설원:['얼음','강철','페어리','물']};
/* 전설 · 환상 · UB · 패러독스 (이름 앞부분으로 거른다 — 폼 이름도 같이 빠진다) */
const NOT=['프리져','썬더','파이어','뮤츠','뮤','라이코','앤테이','스이쿤','루기아','칠색조','세레비','레지락','레지아이스','레지스틸','라티아스','라티오스','가이오가','그란돈','레쿠쟈','지라치','테오키스',
 '유크시','엠라이트','아그놈','디아루가','펄기아','히드런','레지기가스','기라티나','크레세리아','피오네','마나피','다크라이','쉐이미','아르세우스',
 '비크티니','코바르온','테라키온','비리디온','토네로스','볼트로스','레시라무','제크로무','랜드로스','큐레무','케르디오','메로엣타','게노세크트',
 '제르네아스','이벨타르','지가르데','디안시','후파','볼케니온',
 '타입:널','실버디','카푸','코스모그','코스모움','솔가레오','루나아라','네크로즈마','마기아나','마샤도','제라오라','멜탄','멜메탈',
 '텅비드','매시붕','페로코체','전수목','철화구야','종이신도','악식킹','베베놈','아고야곰','차곡차곡','두파팡',
 '자시안','자마젠타','무한다이노','치고마','우라오스','자루도','레지에레키','레지드래고','블리자포스','레이스포스','버드렉스','러브로스',
 '딩루','파오젠','총지엔','위유이','코라이돈','미라이돈','오거폰','테라파고스','복숭악동','이이네구','이누어트','키타카미',
 '위대한엄니','우렁찬꼬리','사나운버섯','날개치는머리','땅을기는날개','모래털가죽','무쇠바퀴','무쇠보따리','무쇠손','무쇠머리','무쇠독나방','무쇠가시','굽이치는물결','무쇠무인','고동치는달','무쇠잎새','꿰뚫는불꽃','날뛰는우레','무쇠바위','무쇠머리',
 '팬텀 메가','네크로즈마','굴레에 빠진 후파','꿰뚫는화염','타오르는불꽃','날뛰는우레','고동치는달','굽이치는물결','무쇠잎새','무쇠무인','무쇠바위'];
const isNot=n=>NOT.some(p=>n===p||n.startsWith(p+' ')||n.startsWith(p+'('))||/^(카푸|무쇠)|후파|패러독스|큐레무|^가라르 (프리져|썬더|파이어)/.test(n);   /* 10-27 밤: 화이트큐레무 · 블랙큐레무 */   /* 「파이어로」가 「파이어」로 걸리지 않게 이름 전체 · 폼 이름만 */
function habOf(types){return Object.keys(HAB).filter(h=>types.some(t=>HAB[h].includes(t)))}
function gradeOf(bst){const p=prideOf(bst);return p?p[0]:''}
function read(){if(!fs.existsSync(FILE))return {v:1,entries:[]};return JSON.parse(fs.readFileSync(FILE,'utf8'))}
function write(db){db.at=new Date().toISOString();fs.mkdirSync(path.dirname(FILE),{recursive:true});fs.writeFileSync(FILE,JSON.stringify(db,null,1));return db}
/* 후보: 도감에서 전설 · 메가 등을 빼고 등급 범위 안 */
function candidates(){return DX.list().filter(d=>!/메가|거다이맥스|원시회귀|테라스탈|스텔라|이터나맥스/.test(d.name)&&d.note!=='O'&&!isNot(d.name)&&gradeOf(d.bst))}
/* 7:2:1 로 n 체 — 타입이 고루 섞이게 첫째 타입별로 돌아가며 뽑는다 (씨앗 고정) */
function build(n,seed){n=n||200;const BT=require('./battle.js');const rng=BT.mkRng(seed||27);const want={C:Math.round(n*0.7),B:Math.round(n*0.2)};want.A=n-want.C-want.B;
 const C=candidates();const out=[];const used=new Set();
 for(const g of ['C','B','A']){const pool=C.filter(d=>gradeOf(d.bst)===g);const byT={};for(const d of pool)(byT[d.types[0]]=byT[d.types[0]]||[]).push(d);
  for(const k in byT){const a=byT[k];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}}
  const ts=Object.keys(byT).sort();let k=0,guard=0;const got=[];
  while(got.length<want[g]&&guard<100000){guard++;const t=ts[k%ts.length];k++;const a=byT[t];while(a.length&&g!=='A'&&used.has(a[a.length-1].name.split(' ')[0]))a.pop();if(!a.length){if(ts.every(x=>!byT[x].length))break;continue}const d=a.pop();used.add(d.name.split(' ')[0]);got.push(d)}
  for(const d of got)out.push({id:'w'+String(out.length+1).padStart(3,'0'),sp:d.name,grade:g,pride:prideOf(d.bst),hab:habOf(d.types),role:g==='C'?'일반':'보스',note:''})}
 return {v:1,source:'제작기 도감(MKM_DB.old)',grades:GRADES,habitats:HAB,entries:out}}
/* 화면 · 생성기용: 항목 + 도감 값 */
function full(db){db=db||read();const L=DX.list();const by=new Map(L.map(d=>[d.name,d]));return db.entries.map(e=>{const d=by.get(e.sp);return Object.assign({},e,d?{types:d.types,base:d.base,bst:d.bst,ability:d.ability,gen:d.gen}:{missing:true})})}
/* ---------- v2 (10-27 밤): 오리지널 150 + 올드 50 ---------- */
const PLAN_V2={orig:{C:63,'C+':42,B:18,'B+':12,A:15},old:{C:21,'C+':14,B:6,'B+':4,A:5}};
/* 올드: 계단별로 n 체, 첫 타입을 돌아가며 (씨앗 고정). 진화 전 단계 이름이 겹치지 않게 첫 어절 기준 중복 제거 */
function pickOld(rng,plan,used){used=used||new Set();const C=candidates();const out=[];
 for(const step of Object.keys(plan)){const pool=C.filter(d=>prideOf(d.bst)===step);const byT={};for(const d of pool)(byT[d.types[0]]=byT[d.types[0]]||[]).push(d);
  for(const k in byT){const a=byT[k];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}}
  const ts=Object.keys(byT).sort();let k=0,guard=0,got=0;
  while(got<plan[step]&&guard<5000){guard++;const a=byT[ts[k++%ts.length]];if(!a||!a.length){if(ts.every(x=>!byT[x].length))break;continue}const d=a.pop();const key=d.name.split(' ').filter(t=>!/^(가라르|알로라|팔데아|히스이|붉은|달|원종|오리진|백마|흑마)$|폼$|종$/.test(t))[0]||d.name;if(used.has(key))continue;used.add(key);got++;
   out.push({id:'',origin:'old',sp:d.name,name:d.name,types:d.types,base:d.base,ability:d.ability,pride:step,grade:step[0],hab:habOf(d.types),role:step[0]==='C'?'일반':'보스',moves:[]})}}
 return out}
/* 전체 생성: {seed, plan} → db v2 */
function buildV2(o){o=o||{};const BT=require('./battle.js'),M=require('./mongen.js');const rng=BT.mkRng(o.seed||27);const plan=o.plan||PLAN_V2;
 const used=new Set(DX.list().map(d=>d.name));const orig=M.batch(rng,plan.orig,used);const old=pickOld(rng,plan.old,new Set());
 const entries=orig.concat(old);entries.forEach((e,i)=>e.id='w'+String(i+1).padStart(3,'0'));
 let review=null;if(o.W){/* 실전 검토 · 개선 루프 (lib/review.js) */const RV=require('./review.js');review=RV.reviewAll(o.W,module.exports,M,entries,{n:o.reviewN||24,rounds:o.rounds==null?3:o.rounds,seed:(o.seed||27)+1});module.exports._cache=null}
 const n=entries.length;const cnt={};for(const e of entries)cnt[e.origin+' '+e.pride]=(cnt[e.origin+' '+e.pride]||0)+1;
 return {v:2,seed:o.seed||27,review,source:'오리지널 = lib/mongen.js(제작기 customCalc 검증) · 올드 = 제작기 도감(MKM_DB.old)',plan,count:cnt,habitats:HAB,coverage:M.coverage(entries),entries}}
/* 화면 · 생성기용: v1(sp 만) · v2 모두 타입 · 종족치가 채워진 꼴로 */
function fullV2(db){db=db||read();if(!db.entries)return [];if(db.v>=2)return db.entries.map(e=>e.origin==='old'&&!e.base?Object.assign({},e,(DX.list().find(d=>d.name===e.sp)||{missing:true})):e);return full(db)}
/* 배틀용 한 체: entry(v2) → {trainer, mon} (dex.build 와 같은 꼴). 오리지널은 제작기 import 로 직접 만든다(명세 8-1) */
const CB={};
function buildEntry(W,e,o){o=o||{};const key=e.id+'|'+(+o.lvAdd||0)+'|'+(o.boss?1:0);if(!CB[key]){const tr=W.OM_IMPORT.trainer({id:'wild_db',data:{name:'야생',kind:'npc',ranks:{육성:'C',지시:'D',통솔:'D',능력:'D'},pids:[]}});tr.wild=true;tr.orderCount={};
  const src=e.base?e:(DX.list().find(d=>d.name===e.sp)||{});const base=(src.base||[60,60,60,60,60,60]).slice();if(o.boss)base[0]+=15;const types=src.types||e.types||['노말'];
  const doc={id:'wdb_'+e.id,data:{name:e.name||e.sp,t1:types[0]||'-',t2:types[1]||'-',base,ability:src.ability||e.ability||'',item:'',moves:(e.moves||[]).map(n=>typeof n==='string'?{name:n}:n),pride:e.pride||'C',dist:+o.lvAdd||0,pots:[]}};
  const x=W.OM_IMPORT.pokemon(doc,tr);require('./automove.js').fill(W,x);CB[key]={trainer:tr,mon:x}}
 return JSON.parse(JSON.stringify(CB[key]))}
module.exports={FILE,STEPS,prideOf,GRADES,HAB,read,write,build,full,candidates,gradeOf,habOf,isNot,PLAN_V2,pickOld,buildV2,fullV2,buildEntry};
