/* 11-03 20시 망령 「외신 그림체가 좀 더 몬스터 느낌 · C(괴물)랑 D(이형)를 섞되, D 는 눈 많고 뼈 돌기 이빨 가득이 늘 붙는 게 아니라
   기괴한 여러 특징 중에 무작위로 섞이는 느낌」 — 미사그 변이체 포트 프롬프트.
   = 괴물 바탕 줄(C, 늘) + 변이 특징 몇 개(D, 몹마다 무작위 — 공통 묶음 + 타입 묶음에서) + 등급별 위압감.
   같은 몹 id 면 같은 특징이 나온다(씨앗 = id). 'cute but wild' 는 쓰지 않는다. */
'use strict';
const BASE='1.3::fearsome monster, mutated beast, predatory body, dark fantasy monster design, monster-collecting game creature but menacing, readable silhouette::';
const NEG='-1.2::cute, chibi, kawaii, round eyes, plush, cuddly::, -1.5::frame, border, vignette, circle background, white background, card::';
/* 변이 특징 — 공통 (몸의 꼴이 어긋남 · 낯선 부속 · 질감) */
/* 변이 특징 — NAI 는 긴 문장보다 짧은 태그를 잘 따른다(11-03 1차 시험: 문장형은 녹스팬서 하나만 먹힘) → 태그꼴 */
const COMMON=['extra eyes','multiple eyes on body','extra mouth','mouth on torso','faceless','skull mask','bone mask face','eyes in a ring','asymmetrical body','one oversized arm','extra legs','extra arms','long thin fingers',
 'split jaw','empty eye sockets, glowing eye sockets','cracked skin','tentacle hair','hand on tail','bone spikes on spine','bone antlers','exposed ribs','floating eyes around head',
 'stitched body, stitches','melting skin, dripping','barnacles on skin','wrong shadow, shadow with extra eyes','vertical mouth','translucent body, visible glowing organs','long twisted neck','reverse-jointed legs','sharp teeth, too many teeth'];
/* 타입 묶음 — 변이가 타입을 따라 다르게 */
const BY_TYPE={노말:['patchy fur, bald patches','eyes inside ears'],불꽃:['magma cracks on body','glowing veins','charred black skin'],물:['jelly body, translucent','torn fins','black tar dripping body'],
 전기:['exposed glowing coils','electric filament hair'],풀:['mushrooms growing on back','root tentacles','moss in eye sockets'],얼음:['cracked ice mask','icicles growing from joints'],
 격투:['overgrown muscles, veins','exposed bone knuckles'],독:['pustules','black tar drooling from mouth','toxic gas from gills'],땅:['body of mud and stones','shovel claws'],
 비행:['eyes on feathers','extra wings','split beak'],에스퍼:['third eye on forehead','floating detached body parts','exposed brain pattern'],벌레:['segmented abdomen','mandibles','compound eyes'],
 바위:['stone growths fused to flesh','cracked rock skin'],고스트:['body dissolving into smoke','faces in its body','floating chains'],
 드래곤:['mouths in scales','horns piercing skull'],악:['grin too wide, wide mouth','shadow claws'],강철:['rusted rivets, exposed gears','gear teeth'],페어리:['grasping ribbon tentacles','doll eyes, glossy eyes']};
const SIZE={C:'medium size',B:'large size, imposing',A:'huge and imposing, boss-like presence'};
/* 얼굴 쪽 특징은 한 몹에 하나만 (얼굴 없음 + 웃는 입 같은 충돌 막기) */
const FACE=/face|faceless|eye socket|eyes in a ring|third eye|grin|mask|jaw|beak|compound eyes|doll eyes|vertical mouth/;
function rngOf(seed){let h=2166136261;for(const ch of String(seed)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0}
 let s=h||1;return ()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296}}
/* e = 야생 DB 한 줄, o = {seed, boss} → {style, traits} — 특징 수: C 1~2 · B 2 · A/보스 2~3, 그중 하나는 타입 묶음에서(있으면) */
function mutation(e,o){o=o||{};const r=rngOf(o.seed||e.id||e.name);const g=o.boss?'A':(e.grade||'C');const n=g==='A'?2+Math.floor(r()*2):g==='B'?2:1+Math.floor(r()*2);
 const pool=COMMON.slice();const ty=[].concat(...(e.types||[]).map(t=>BY_TYPE[t]||[]));const out=[];if(ty.length)out.push(ty[Math.floor(r()*ty.length)]);
 while(out.length<n&&pool.length){const i=Math.floor(r()*pool.length);const t=pool.splice(i,1)[0];if(FACE.test(t)&&out.some(x=>FACE.test(x)))continue;out.push(t)}
 return {traits:out,style:`${BASE}, 1.5::${out.join(', ')}::, ${SIZE[g]||SIZE.C}, ${NEG}`}}
module.exports={BASE,NEG,COMMON,BY_TYPE,FACE,mutation};
/* 옛 포트 태그(job_dungeon3 의 it.tags)에서 아기자기 쪽 말을 걷어내고 변이 줄을 붙인다 */
const SOFT=/,\s*(cute but wild|cute|soft rounded shapes|simple readable silhouette|small to medium size|small size|medium size|large size[^,]*|large and imposing size|huge[^,]*|shielded by a calm protective aura)(?=,|$)/g;
function retag(tags,e,o){const m=mutation(e,o);const t=(','+tags).replace(SOFT,'').slice(1).trim();return {traits:m.traits,tags:`${t}, ${m.style}`}}
module.exports.retag=retag;module.exports.SOFT=SOFT;
