/* 11-03 망령 「던전 생성할 때 타입들이 너무 겹친다 · 아까의 중복도 그렇고 몬스터 로직은 다시 짜야겠다」
   던전 몹 배역 정하기(cast) — 뼈대(gen.make · 갈림길 donor)가 만든 조우 자리를 한꺼번에 다시 채운다.
   예전: 서식지 = 테마인 몹만 섞어 앞에서부터 뽑기 → (1) 본길과 다른 길(donor)이 따로 섞여 같은 몹이 두 번,
         (2) 테마 타입만 나와 한 던전이 거의 한두 타입(화산 = 불꽃 6), (3) 다른 던전과 같은 몹.
   지금:
   - 던전 하나의 모든 자리(배틀 · 보스방 호위 · 체크 실패 기습)를 한 번에 채운다 → 던전 안 중복 없음.
   - avoid(다른 던전이 이미 쓰는 몹)는 후보에서 뺀다 → 던전끼리 중복 없음(후보가 모자랄 때만 허용).
   - 테마 몹(타입 하나라도 테마 타입 = wilddb HAB) 위주 + 떠돌이 최대 GUEST_MAX(3할). 떠돌이는 모든 타입이 테마 타입 ∪ VISIT(어울리는 손님 타입) 안.
   - 타입 쏠림 막기: 이미 나온 타입마다 무게 × DECAY(테마 타입은 덜 깎는다), 한 타입 최대 — 테마 타입 자리 수 / 3(최소 2), 그 밖 2. 같은 무리 안 타입 겹치면 × ROOM_SAME.
   - 대표 타입(HAB 첫 타입 — 화산 불꽃 · 폐가 고스트 · 바다 물 …)은 적어도 자리 수 / 4(최소 2) 마리 — 테마 얼굴은 남긴다.
   - 테마 몹이어도 다른 타입이 테마 ∪ VISIT 밖이면 뺀다(화산에 풀/땅 X).
   - 같은 동물 바탕(root) · 같은 역할(kind)도 겹치면 무게를 낮춘다.
   - 보스(보스방 bossAt)는 그대로 둔다 — 던전의 얼굴이고 난이도를 쥔다.
   무게 숫자는 처음 값이다. 바꾸면 docs/던전_자동생성.md 에 적는다. */
const GUEST_MAX=0.3,GUEST=0.6,SUB_NATIVE=0.7,DECAY_THEME=0.55,DECAY_OTHER=0.35,ROOM_SAME=0.2,ROOT_SAME=0.25,KIND_SAME=0.75,ABIL_SAME=0.03;   /* 같은 던전에 이미 있는 특성 */
/* 테마 타입(wilddb HAB)에 더해 떠돌이로 와도 어울리는 타입. 떠돌이는 모든 타입이 HAB ∪ VISIT 안에 있어야 한다 (폐가에 만타인 X) */
const VISIT={폐가:['벌레','페어리','풀','비행','격투'],동굴:['독','물','드래곤','악','벌레','전기'],숲:['땅','물','전기','에스퍼','악','격투'],연구소:['고스트','불꽃','벌레','격투','물','얼음'],
 유적:['강철','벌레','격투','페어리','비행','악'],바다:['노말','독','바위','강철','에스퍼','격투'],화산:['강철','악','독','비행','노말'],설원:['비행','바위','격투','노말','고스트','에스퍼']};
/* 던전 JSON 안의 몹 자리: {db} 를 가진 mix 배열의 원소. 방 · 그룹(같은 무리)을 같이 돌려준다 */
function slotsOf(dg){const out=[];const walk=(o,room,grp)=>{if(!o||typeof o!=='object')return;
  if(Array.isArray(o.mix)&&o.mix.some(m=>m&&m.db)){const g={};o.mix.forEach((m,i)=>{if(m&&m.db)out.push({m,room,grp:g,boss:!!(o.boss&&i===(+o.bossAt||0))})})}
  for(const [k,v] of Object.entries(o)){if(k==='mix')continue;if(v&&typeof v==='object')walk(v,room,grp)}};
 for(const r of dg.rooms||[])walk(r,r.id);return out}

/* opt: {theme, grades:['C'], all:[야생 DB fullV2], avoid:Set(id), rng} → {changed, types, guests} */
function cast(dg,opt){const all=opt.all,th=opt.theme,rng=opt.rng||Math.random,grades=opt.grades||['C'],avoid=opt.avoid||new Set();
 const S=slotsOf(dg);const fill=S.filter(s=>!s.boss);if(!fill.length)return {changed:0};
 const bossIds=new Set(S.filter(s=>s.boss).map(s=>s.m.db));const byId=Object.fromEntries(all.map(e=>[e.id,e]));
 const HAB=require('./wilddb.js').HAB;const home=new Set(HAB[th]||[]),ok=new Set([...home,...(VISIT[th]||[])]);
 const native=e=>(e.types||[]).some(t=>home.has(t));
 let C=all.filter(e=>grades.includes(e.grade)&&!bossIds.has(e.id)&&!e.missing&&(e.types||[]).every(t=>ok.has(t)));   /* 테마 몹이어도 다른 타입이 어색하면 뺀다(화산에 풀/땅 X) */
 const fresh=C.filter(e=>!avoid.has(e.id));if(fresh.length>=fill.length*1.5)C=fresh;   /* 다른 던전 몹은 후보가 넉넉하면 뺀다 */
 const capOf=t=>home.has(t)?Math.max(2,Math.ceil(fill.length/3)):2;const gMax=Math.round(fill.length*GUEST_MAX);
 const tc={},rc={},kc={};const used=new Set();const roomT=new Map();const ac=new Set();   /* 11-03 망령 「특성은 같은 던전 안에선 어지간하면 겹치지 마」 */
 for(const s of S)if(s.boss){const e=byId[s.m.db];if(e&&e.ability)ac.add(e.ability)}
 for(const b of bossIds){const e=byId[b];if(e){(e.types||[]).forEach(t=>tc[t]=(tc[t]||0)+1);if(e.root)rc[e.root]=1}}
 /* 보스방 호위부터(보스 곁 — 타입이 보스와 덜 겹치게), 그다음 방 순서대로 */
 const bossRooms=new Set(S.filter(s=>s.boss).map(s=>s.room));const order=fill.filter(s=>bossRooms.has(s.room)).concat(fill.filter(s=>!bossRooms.has(s.room)));
 let guests=0;const sig=(HAB[th]||[])[0],sigMin=Math.max(2,Math.round(fill.length/4));let sigN=0;for(const b of bossIds)if(((byId[b]||{}).types||[]).includes(sig))sigN++;   /* 대표 타입(화산 = 불꽃 · 폐가 = 고스트 …)은 적어도 sigMin 마리 */
 for(const s of order){let rt=roomT.get(s.grp);if(!rt){rt=new Set();roomT.set(s.grp,rt);S.filter(x=>x.grp===s.grp&&x.boss).forEach(x=>((byId[x.m.db]||{}).types||[]).forEach(t=>rt.add(t)))}
  const W=[];for(const e of C){if(used.has(e.id))continue;const ty=e.types||[];if(ty.some(t=>(tc[t]||0)>=capOf(t)))continue;const nat=native(e);if(!nat&&guests>=gMax)continue;
   let w=nat?(home.has(ty[0])?1:SUB_NATIVE):GUEST;for(const t of ty)w*=Math.pow(home.has(t)?DECAY_THEME:DECAY_OTHER,tc[t]||0);if(ty.some(t=>rt.has(t)))w*=ROOM_SAME;if(e.root&&rc[e.root])w*=ROOT_SAME;if(e.kind&&(kc[e.kind]||0)>=2)w*=KIND_SAME;if(sigN<sigMin&&ty.includes(sig))w*=4;if(e.ability&&ac.has(e.ability))w*=ABIL_SAME;W.push([e,w])}
  if(!W.length){for(const e of C)if(!used.has(e.id)&&native(e))W.push([e,0.01])}   /* 다 막히면 제한 풀고 테마 몹에서 */
  if(!W.length)continue;let x=rng()*W.reduce((a,b)=>a+b[1],0),pick=W[0][0];for(const [e,w] of W){x-=w;if(x<=0){pick=e;break}}
  used.add(pick.id);if(pick.ability)ac.add(pick.ability);(pick.types||[]).forEach(t=>{tc[t]=(tc[t]||0)+1;rt.add(t)});if(pick.root)rc[pick.root]=1;if(pick.kind)kc[pick.kind]=(kc[pick.kind]||0)+1;if(!native(pick))guests++;if((pick.types||[]).includes(sig))sigN++;
  s.m.db=pick.id;delete s.m.name}
 return {changed:fill.length,types:tc,guests}}

/* 던전의 타입 분포 요약(검토용) */
function typeSpread(dg,all){const byId=Object.fromEntries(all.map(e=>[e.id,e]));const c={};const ids=[];for(const s of slotsOf(dg)){ids.push(s.m.db);for(const t of (byId[s.m.db]?.types||[]))c[t]=(c[t]||0)+1}
 const dup=ids.filter((x,i)=>ids.indexOf(x)!==i);return {n:ids.length,types:c,distinct:Object.keys(c).length,top:Math.max(0,...Object.values(c)),dup}}

module.exports={cast,slotsOf,typeSpread,VISIT};
