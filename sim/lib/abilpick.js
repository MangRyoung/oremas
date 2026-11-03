/* 11-03 20시 망령 「오리지널 특성은 엉망 · 이름만 바꾼 것 · 밸런스」 → 「기존 특성만 잘 고르기」(시안, 확정 전). 특성 고르기 v2 — 기존 특성(제작기 DB)만, 어울리는 것, 한 특성 최대 2번 */
const M=require('./mongen.js'),RD=require('./abilread.js');
const IMM={독:['독','강철'],화상:['불꽃'],마비:['전기'],얼음:['얼음'],잠듦:[]};
const TYPES=['노말','불꽃','물','전기','풀','얼음','격투','독','땅','비행','에스퍼','벌레','바위','고스트','드래곤','악','강철','페어리'];
/* 11-03 20:46 망령 「특성은 적어도 같은 던전 내에선 어지간하면 겹치지 마」 → o.dg = {몹 id: [던전 id …]}, o.fixed = {던전 id: [그 던전 실제 포켓몬 특성 …]}.
   같은 던전에 이미 있는 특성은 먼저 빼고 고른다. 정말 후보가 없을 때만 겹침 허용(dupDg 로 셈). 던전 몹을 먼저 고른다(선택 폭이 넓을 때). */
function pickAll(entries,W,rng,o){o=o||{};const A=M.abil();const use=o.use||{};const out={};const DG=o.dg||{};const inDg={};const dupDg=[];
 for(const [d,names] of Object.entries(o.fixed||{}))inDg[d]=new Set(names);
 const ord=entries.slice().sort((a,b)=>((DG[b.id]||[]).length?1:0)-((DG[a.id]||[]).length?1:0)||'ABC'.indexOf(a.grade)-'ABC'.indexOf(b.grade));
 for(const e of ord){const to=String(e.abilityTo);const re=(M.KIND_RE||{})[e.kind];const myDg=DG[e.id]||[];
  let sc=[];for(const [cap,needRead,allowDup] of [[2,1,0],[2,0,0],[3,1,0],[3,0,0],[4,0,0],[2,1,1],[3,0,1]]){sc=[];for(const a of A){if(a.to!==to)continue;const d=a.desc;if((use[a.name]||0)>=cap)continue;
   if(!allowDup&&myDg.some(g=>inDg[g]&&inDg[g].has(a.name)))continue;   /* 같은 던전에 이미 있음 */
   if(/타입\s*:\s*[^」]+」\s*(을|를)?\s*추가/.test(d))continue;   /* 타입 추가 = 야생에선 뺀다 */
   let bad=false;for(const [st,ts] of Object.entries(IMM))if(new RegExp('「'+st+'」\\s*상태일 때').test(d)&&e.types.some(t=>ts.includes(t)))bad=true;if(bad)continue;   /* 걸리지 않는 상태 */
   if(TYPES.some(t=>!e.types.includes(t)&&(d.includes('「'+t+'」 기술의 대미지')||d.includes('자신의 「'+t+'」')))&&!/받으면|받았을 때|받을/.test(d))continue;   /* 남의 타입 기술 강화 */
   if(/퇴장|교대|교체|나무열매|도구|소지품|데이터|해석|도감|성별|소지로|내보냈을 때|날씨\s*:|필드\s*:|「특성\s*:/.test(d))continue;   /* 야생에서 안 켜지거나 뜻이 없는 것 (날씨 · 필드는 야생이 스스로 못 깐다) */
   if(/「(독|맹독|화상|마비|잠듦|얼음|혼란|헤롱헤롱)」\s*상태일 때/.test(d))continue;   /* 자기가 상태 이상일 때만 — 야생은 거의 안 켜진다 */
   {const WX={'비':['물'],'맑음':['불꽃','풀'],'모래바람':['바위','땅','강철'],'싸라기눈':['얼음'],'설경':['얼음'],'눈':['얼음'],'일렉트릭필드':['전기'],'그래스필드':['풀'],'미스트필드':['페어리'],'사이코필드':['에스퍼']};let off=false;for(const [w,ts] of Object.entries(WX))if(new RegExp('(날씨|필드)\\s*:\\s*'+w+'」').test(d)&&!e.types.some(t=>ts.includes(t)))off=true;if(off)continue}   /* 날씨 · 필드 조건은 그걸 까는 타입일 때만 */
   if(/자신의\s*「(춤|소리|펀치|킥|이빨|베기|파동|바람|구슬|폭탄|머리|가루)」\s*기술/.test(d)||/「(춤|소리)」\s*기술의/.test(d))continue;   /* 기술 갈래 의존 — 그 기술을 안 가질 수 있다 */
   {const m=d.match(/기술을\s*「([^」]+)」\s*기술로\s*만/);if(m&&!e.types.includes(m[1]))continue}   /* -스킨: 제 타입으로 바꿀 때만 */
   let v=1;if(e.types.some(t=>d.includes('「'+t+'」')||d.includes(t+' 기술')))v+=3;
   const K={'물리 스위퍼':/공격|물리기|접촉기|스피드|급소/,'특수 스위퍼':/특공|특수기|스피드|급소/,'물리 탱커':/방어|HP|회복|반감|접촉기를 받|물리기를 받/,'특수 벽':/특방|HP|회복|반감|특수기를 받|상태가 되지 않/,'밸런스':/./,'쌍두':/공격|특공|기술의 대미지/}[e.kind]||/./;if(K.test(d))v+=2;
   if(/탱커|벽/.test(e.kind)&&/「(방어|특방|HP) : -/.test(d))v-=3;if(/스위퍼|쌍두/.test(e.kind)&&/「(공격|특공|스피드) : -/.test(d))v-=3;
   if(/날씨|필드/.test(d)&&!e.types.some(t=>d.includes(t)))v-=1;
   const reads=RD.reads(W,a.name,d);if(needRead&&!reads)continue;if(!reads){if(/표시|날씨|오라|에리어|타입\s*:\s*임의|같은 「?타입|특성」을|맞바꾼|지속 턴|분노|바인드/.test(d))continue;v-=1}   /* 시뮬이 못 읽는 것은 GM 판정 — 배틀에서 뜻이 있는 것만 */   /* 시뮬 · 웹툴이 읽는 것만 — 승률에 잡히게 */if(use[a.name])v-=1.5;
   sc.push({a,v:v+rng()*1.2,reads})}if(sc.length)break}
  sc.sort((x,y)=>y.v-x.v);const p=sc[Math.floor(rng()*Math.min(3,sc.length))];if(!p){out[e.id]=null;continue}use[p.a.name]=(use[p.a.name]||0)+1;out[e.id]={name:p.a.name,desc:p.a.desc,to:p.a.to,reads:p.reads};
  for(const g of myDg){(inDg[g]=inDg[g]||new Set());if(inDg[g].has(p.a.name))dupDg.push(g+':'+p.a.name);inDg[g].add(p.a.name)}}
 return {out,use,dupDg}}
/* 11-03 21:50 새 야생 한 체(mongen.one)도 같은 규칙으로 — use 는 생성 묶음 안 공유(한 특성 2~3번까지) */
function pickOne(e,W,rng,o){const r=pickAll([Object.assign({id:'_one'},e)],W,rng,o||{});return r.out._one||null}
module.exports={pickAll,pickOne};
