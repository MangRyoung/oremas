/* 11-03 20시 망령 「외신 그림체가 좀 더 몬스터 느낌 · C(괴물)랑 D(이형)를 섞되, D 는 눈 많고 뼈 돌기 이빨 가득이 늘 붙는 게 아니라
   기괴한 여러 특징 중에 무작위로 섞이는 느낌」 — 미사그 변이체 포트 프롬프트.
   = 괴물 바탕 줄(C, 늘) + 변이 특징 몇 개(D, 몹마다 무작위 — 공통 묶음 + 타입 묶음에서) + 등급별 위압감.
   같은 몹 id 면 같은 특징이 나온다(씨앗 = id). 'cute but wild' 는 쓰지 않는다. */
'use strict';
const BASE='1.3::fearsome monster, mutated beast, predatory body, dark fantasy monster design, monster-collecting game creature but menacing, readable silhouette::';
const NEG='-1.2::cute, chibi, kawaii, smiling, round eyes, plush, cuddly::';
/* 변이 특징 — 공통 (몸의 꼴이 어긋남 · 낯선 부속 · 질감) */
const COMMON=['too many eyes in odd places','a second mouth on its body','faceless head','mask-like bone face','eyes arranged in a ring','asymmetric limbs, one much larger','extra jointed legs','elongated thin fingers','split jaw that opens sideways',
 'mirror-image half face','hollow glowing eye sockets','cracked porcelain-like skin','hair-like writhing tendrils','tail ending in a grasping hand','spine of bony ridges','antlers of twisted bone','inside-out shell plates','halo of floating eyes',
 'body made of overlapping masks','wax-like dripping skin','parasitic flowers sprouting from wounds-like cracks','barnacle clusters on the hide','stitched seams across the body','shadow that does not match its shape','vertical slit mouth on the chest',
 'glass-like translucent belly showing glowing organs-like lights','chitin armor plates over fur','long neck that bends unnaturally','backward-bent knees','too many teeth in a wide grin'];
/* 타입 묶음 — 변이가 타입을 따라 다르게 */
const BY_TYPE={노말:['patchy mismatched fur','oversized ears full of eyes'],불꽃:['molten cracks across the body','ember veins glowing under the skin','smoking char-black hide'],물:['translucent jelly skin','fin membranes torn like rags','tar-like dripping body'],
 전기:['exposed glowing coils under the skin','crackling filaments instead of hair'],풀:['fungal caps growing from the back','root tendrils dragging on the ground','moss covering empty eye sockets'],얼음:['frozen cracked shell over the face','icicle spines growing out of joints'],
 격투:['bulging overgrown muscles','knuckles of raw bone'],독:['bubbling pustules on the hide','tar dripping from the mouth','toxic fumes leaking from gills'],땅:['body of packed mud and stones','burrowing claws like shovels'],
 비행:['ragged feathers with eyes on them','too many wings','beak split into petals'],에스퍼:['third eye splitting the forehead','floating detached body parts','brain-like patterns on the skin'],벌레:['segmented abdomen','mandibles at the mouth','compound eyes'],
 바위:['stone growths fused to the flesh','crystal-free cracked rock hide'],고스트:['body fading into smoke at the edges','grinning face in the shadows of its body','chains of light around the limbs'],
 드래곤:['scales peeling into new mouths','horns curling into the skull'],악:['grin stretching too far','shadowy limbs that end in claws'],강철:['rusted rivets and clockwork showing through','gear teeth in the mouth'],페어리:['ribbon-like tendrils that grasp','doll-like glossy eyes']};
const SIZE={C:'medium size',B:'large size, imposing',A:'huge and imposing, boss-like presence'};
/* 얼굴 쪽 특징은 한 몹에 하나만 (얼굴 없음 + 웃는 입 같은 충돌 막기) */
const FACE=/face|faceless|eye socket|eyes arranged|third eye|grin|mask|jaw|beak|compound eyes|doll-like/;
function rngOf(seed){let h=2166136261;for(const ch of String(seed)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0}
 let s=h||1;return ()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296}}
/* e = 야생 DB 한 줄, o = {seed, boss} → {style, traits} — 특징 수: C 1~2 · B 2 · A/보스 2~3, 그중 하나는 타입 묶음에서(있으면) */
function mutation(e,o){o=o||{};const r=rngOf(o.seed||e.id||e.name);const g=o.boss?'A':(e.grade||'C');const n=g==='A'?2+Math.floor(r()*2):g==='B'?2:1+Math.floor(r()*2);
 const pool=COMMON.slice();const ty=[].concat(...(e.types||[]).map(t=>BY_TYPE[t]||[]));const out=[];if(ty.length)out.push(ty[Math.floor(r()*ty.length)]);
 while(out.length<n&&pool.length){const i=Math.floor(r()*pool.length);const t=pool.splice(i,1)[0];if(FACE.test(t)&&out.some(x=>FACE.test(x)))continue;out.push(t)}
 return {traits:out,style:`${BASE}, 1.2::${out.join(', ')}::, ${SIZE[g]||SIZE.C}, ${NEG}`}}
module.exports={BASE,NEG,COMMON,BY_TYPE,FACE,mutation};
/* 옛 포트 태그(job_dungeon3 의 it.tags)에서 아기자기 쪽 말을 걷어내고 변이 줄을 붙인다 */
const SOFT=/,\s*(cute but wild|cute|soft rounded shapes|simple readable silhouette|small to medium size|small size|medium size|large size[^,]*|large and imposing size|huge[^,]*|shielded by a calm protective aura)(?=,|$)/g;
function retag(tags,e,o){const m=mutation(e,o);const t=(','+tags).replace(SOFT,'').slice(1).trim();return {traits:m.traits,tags:`${t}, ${m.style}`}}
module.exports.retag=retag;module.exports.SOFT=SOFT;
