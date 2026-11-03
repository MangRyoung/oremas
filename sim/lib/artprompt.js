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
/* 11-03 20:10 망령 「아직 포켓몬 그림체풍이 너무 진하다」 — 원인: 몹 바탕 줄(job.mstyleFk)에 fakemon · pokemon (creature) · thick outlines ·
   kimhiro 1.5 · kankan33333(포켓몬 팬아트 쪽 작가), 태그 첫머리 'original fakemon creature' · 'X type creature', 네거티브의 extra limbs · bad anatomy(변이를 막음).
   → 변이체 전용 바탕 줄 두 갈래(시안). 포켓몬 말은 네거티브로. */
const Q='::year 2025, year 2026 ::, -1::artist collaboration ::, -2::multiple views ::, ::masterpiece, best quality, amazing quality, very aesthetic, best illustration, newest ::, ::highres, incredibly absurdres, hyper detail ::, ';
const MSTYLE={
 /* E 악마 도감 — 카네코 카즈마 쪽 기괴한 괴물 디자인, 그림책 느낌은 약하게 */
 E:'1.1::artist:kazuma kaneko ::, 0.5::artist:nishikujic ::, 0.6::artist:ciloranko ::, '+Q+'1.4::no humans, monster, creature, solo::, 1.2::dark fantasy, creature design, eldritch, unsettling::, painterly, dramatic lighting, 1.2::full body, centered, the whole creature inside the frame::, detailed background, ',
 /* F 괴수 원화 — 실사에 가까운 컨셉 아트 질감 */
 F:'0.6::artist:kazuma kaneko ::, 0.5::artist:ciloranko ::, '+Q+'1.4::no humans, monster, creature, solo::, 1.3::dark fantasy creature concept art, realistic, detailed texture, wet skin and bone, eldritch::, cinematic lighting, 1.2::full body, centered, the whole creature inside the frame::, detailed background, '};
/* 11-03 20:20 망령 「인물이나 배경이랑 그림체 비슷한 느낌 나게 유지할 순 없어?」 — 인물(NPC 스탠딩) · 구역 그림과 같은 작가 9명 줄을 그대로 쓰고,
   포켓몬 말만 빼는 갈래. G = 작가 줄 그대로(kimhiro 1.5 · kaneko 0.6), H = 같은 9명에 kimhiro 1.0 · kaneko 1.1 (괴물 쪽으로 살짝). */
const ART=(kim,kan)=>`0.6::artist:nishikujic ::, 0.6::artist:k-suwabe ::, ${kan}::artist:kazuma kaneko ::, 0.6::background:tsukushi akihito ::, 0.6::background:kuroimori ::, 0.6::background:yoshida akihiko ::, 0.8::artist:kankan33333 ::, ${kim}::artist:kimhiro ::, 1.1::artist:ciloranko ::, `+Q+'thick outlines, ::ultra complexity ::, ';
const BODY='1.4::no humans, monster, creature, solo::, 1.2::dark fantasy, eldritch, unsettling::, 1.2::full body, centered, the whole creature inside the frame::, detailed background, ';
MSTYLE.G=ART(1.5,0.6)+BODY;MSTYLE.H=ART(1.0,1.1)+BODY;
/* 11-03 20:25 망령 「H 로 해서 좀 더 개선」 → H2: 액자 · 둥근 틀 막기(배경이 화면 끝까지) · 약한 몹도 노려보는 눈빛(동그란 눈 막기). 이게 기본. */
MSTYLE.H2=ART(1.0,1.1)+'1.4::no humans, monster, creature, solo::, 1.2::dark fantasy, eldritch, unsettling::, 1.1::menacing, predatory gaze, hostile::, 1.2::full body, centered, the whole creature inside the frame::, 1.2::detailed background filling the whole image, edge to edge scenery::, ';
/* 주의(11-03 20:35): 네거티브 칸(UC) 안에서 -N:: 은 「덜 빼라」 = 거꾸로 그 말을 부른다. UC 에는 + 무게만 쓴다. (E/F/G/H 시험은 이 실수로 틀 · 둥근 창이 더 나왔다) */
const MNEG='1.5::pokemon (creature), pokemon, fakemon, digimon, mascot, anime creature::, 1.2::cute, chibi, kawaii, round eyes, plush, cuddly, simple shading, flat color, thick outlines::, 1.5::frame, border, vignette, circle background, white background, card::';
/* H2 용: thick outlines 는 작가 줄에 있으니 네거티브에서 뺌, 틀 · 동그란 눈을 더 세게 */
const MNEG2='1.5::pokemon (creature), pokemon, fakemon, digimon, mascot, anime creature::, 1.3::cute, chibi, kawaii, round eyes, big eyes, dot eyes, innocent, plush, cuddly, smiling happily::, 1.8::frame, picture frame, border, white border, vignette, circle frame, round frame, porthole, framed, letterboxing, card, white background::';
module.exports.MNEG2=MNEG2;
const MNEG_BASE='human, humanoid, 1girl, 1boy, multiple views, multiple creatures, text, caption, english text, trading card, card frame, border, watermark, signature, logo, cropped, out of frame, lowres, worst quality, gore';
/* 태그에서 포켓몬 말 걷기 */
function depoke(t){return t.replace(/original (fakemon|pokemon-style|pokemon) creature based on (an? )?/g,'monstrous creature based on $2').replace(/(\w+(?: and \w+)*) type creature/g,'$1 element').replace(/,\s*0?\.?\d*::pokemon \(creature\)::/g,'')}
function mtags(tags,e,o){const r=retag(tags,e,o);return {traits:r.traits,tags:depoke(r.tags.replace(BASE,'1.3::mutated beast, predatory body, menacing, readable silhouette::').replace(NEG+'','').replace(/,\s*$/,''))}}
module.exports.MSTYLE=MSTYLE;module.exports.MNEG=MNEG;module.exports.MNEG_BASE=MNEG_BASE;module.exports.depoke=depoke;module.exports.mtags=mtags;
