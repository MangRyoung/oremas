# 은열쇠 시작 카드 24장 그림 v3
# 11-04 22:34 망령: 예전 그림은 도구만 나오고 톤이 음침하기만 했다 → 사람 + 동행 몬스터가 행동하는 장면, 테마별 색.
# 11-04 23:18 망령: 「카드는 특정 등장인물이 안 나오는 게 낫다 · 어둡거나 차분한 건 차분할 수도 — 카드마다 달라야」
#   → 사람은 뒷모습 · 손 · 작은 실루엣만(얼굴 없음), 분위기(mood)는 카드마다 따로. 테마 색은 살짝만.
import json
Q = '::year 2025, year 2026 ::, -1::artist collaboration ::, -2::multiple views ::, ::masterpiece, best quality, amazing quality, very aesthetic, best illustration, newest ::, ::highres, incredibly absurdres, hyper detail ::, '
ART = '0.6::artist:nishikujic ::, 0.6::artist:k-suwabe ::, 0.6::background:tsukushi akihito ::, 0.6::background:yoshida akihiko ::, 0.8::artist:kankan33333 ::, 1.0::artist:kimhiro ::, 1.1::artist:ciloranko ::, ' + Q
BASE = ('1.2::anime illustration, fantasy adventure scene, storytelling moment::, '
        '1.4::anonymous person, seen from behind or only hands visible, face not visible::, '
        '1.2::a small original fantasy creature companion::, dynamic composition, detailed background filling the whole image, ')
THEME = {
    '스킬': 'teal accents, outdoor or campus setting, ',
    '던전': 'inside ancient ruins and caves, lantern light, ',
    '배틀': 'battle scene, red and blue accents, ',
}
NEG = ('1.5::text, letters, caption, speech bubble, watermark, signature, logo, ui, trading card, card frame, border, picture frame, vignette::, '
       '1.4::pokemon, pokemon (creature), digimon::, 1.3::horror, gore, blood, monochrome::, '
       '1.4::face focus, portrait, looking at viewer, close-up face, detailed face::, 1.2::still life, object focus::, '
       'lowres, worst quality, bad anatomy, bad hands, extra fingers, cropped, multiple views')
C = [
    # 스킬
    ("역경", "스킬", "a person seen from behind with a bandaged arm climbing a rocky slope, small creature companion pushing from behind", "1.2::harsh wind, overcast sky breaking with a ray of sun, gritty determined mood::"),
    ("협력", "스킬", "two people seen from behind at a cliff ledge, one person's creature companion helping the other climb up, hand reaching out", "1.2::warm afternoon sunlight, friendly hopeful mood::"),
    ("침착한 대처", "스킬", "close-up of a person's hands calmly catching a falling flask in mid-air, creature companion catching falling books, library courtyard", "1.2::calm composed mood, soft clear daylight, frozen still moment::"),
    ("정신 집중", "스킬", "a small silhouette of a person sitting cross-legged seen from behind on a hill, teal glow and floating leaves, creature companion meditating beside", "1.2::quiet dusk, deep calm, serene meditative mood::"),
    ("배수진", "스킬", "a small figure seen from behind leaping across a gap between two cliffs, creature companion clinging to the shoulder, broken rope bridge", "1.2::dramatic stormy sky, tense daring mood, strong wind::"),
    ("숙련된 기초", "스킬", "close-up of practiced hands tying a perfect rope knot effortlessly, creature companion yawning on a wooden bench, training yard", "1.2::peaceful morning light, relaxed everyday mood::"),
    ("무리하지 마", "스킬", "two people seen from behind on a road, one supporting an exhausted friend by the shoulder and carrying the heavy backpack, creatures following", "1.2::gentle golden evening, caring warm mood::"),
    ("난관 계산", "스킬", "over-the-shoulder view of hands holding an open notebook full of calculations in front of a huge brass gear puzzle lock, creature companion pointing at a gear", "1.2::focused intellectual mood, cool indoor light, dust in light beams::"),
    # 던전
    ("기세 올리기", "던전", "a person seen from behind raising a lantern high in an ancient stone corridor, creature companion howling, silhouettes of companions raising fists", "1.2::rousing heroic mood, bright lantern glow pushing back the darkness::"),
    ("비상식량", "던전", "hands passing sandwiches and steaming soup around a small camping stove, creature companions eating happily, cave camp", "1.2::cozy restful mood, warm campfire glow in a safe corner of a dark cave::"),
    ("붕대와 진통제", "던전", "close-up of hands wrapping a bandage around an arm, open first aid kit, creature companion holding a small lantern", "1.2::quiet gentle mood, dim warm candlelight::"),
    ("정화", "던전", "a hand holding up a glowing silver key charm, purifying light washing over several tired creatures, stone shrine", "1.2::serene holy mood, soft white and gold light::"),
    ("길잡이 표식", "던전", "a hand drawing a glowing chalk arrow on a stone wall at a crossroads of tunnels, creature companion sniffing the left path", "1.2::mysterious exploratory mood, cool blue darkness with one warm lantern::"),
    ("예비 꾸러미", "던전", "hands opening a neatly packed backpack revealing spare supplies and one softly glowing card, creature companion peeking in", "1.2::cozy prepared mood, warm campfire glow::"),
    ("기운 북돋우기", "던전", "hands gently patting several tired creature companions, healing sparkles rising, creatures perking up", "1.2::heartwarming mood, warm sparkles in a dim ruin room::"),
    ("보스의 흔적", "던전", "a hand holding a lantern low over giant claw marks and a huge footprint on a stone floor, creature companion with raised hackles", "1.3::dark ominous tense mood, deep shadows, a single lantern, foreboding::"),
    # 배틀
    ("실타래 되감기", "배틀", "a glowing red thread rewinding onto a spool held in a hand, a creature's missed attack flowing backward in time, clock motifs", "1.2::mystical mood, glowing thread in dim violet light::"),
    ("요정의 장난", "배틀", "a tiny mischievous fairy creature giggling and tugging an incoming energy beam aside, the attack curving away from a creature companion", "1.2::playful mischievous mood, pink and blue sparkles::"),
    ("안개의 환영", "배틀", "an enemy attack striking a misty illusion double of a creature while the real one stands safely aside", "1.3::eerie mysterious mood, night blue mist, moonlight::"),
    ("위기일발!", "배틀", "a creature companion barely dodging a huge blast by a hair, sparks flying, a trainer's silhouette in the foreground", "1.3::intense high-tension mood, explosive orange light, motion blur::"),
    ("다시 일어서", "배틀", "a creature shaking off crackling sparks and dizzy stars and standing back up, a raised fist in the foreground", "1.2::triumphant comeback mood, light breaking through dust::"),
    ("약간 은밀한 망토", "배틀", "a creature wearing a small hooded cloak flicking the cloak to deflect glowing status effect particles", "1.2::sly stealthy mood, dusky shadows, cool tones::"),
    ("정찰 비행", "배틀", "a bird creature soaring high over a wide battlefield scouting the enemy team below, a small silhouette looking up from far below", "1.2::wide open sky, adventurous mood, bright wind::"),
    ("관찰안", "배틀", "over-the-shoulder view of a hand holding up a magnifying glass toward one enemy creature across the field, the lens glinting", "1.2::sharp analytical mood, cool focused light, shallow depth of field::"),
]
# 11-04 23:34 망령 「B 로 해보자」 — 화풍 비교(A 루이나풍 · B 아컴풍 · C 고딕 잉크 · D 타로 판화 · E TCG 실사풍) 중 B 아컴풍으로 확정.
#   애니 작가 줄(ART) · 테마 색 대신 아래 STYLE_B 를 맨 앞에. 금지 칸에서 horror 를 빼고 anime · chibi · cute 를 더한다.
STYLE_B = '1.4::painterly card game illustration, realistic oil painting, 1920s cosmic horror atmosphere, muted earthy colors, dramatic chiaroscuro, visible brush strokes::, '
BASE_B = '1.4::anonymous person, seen from behind or only hands visible, face not visible::, 1.1::a small fantasy creature companion::, detailed background filling the whole image, '
NEG_B = NEG.replace('1.3::horror, gore, blood, monochrome::, ', '1.3::gore, blood::, ') + ', anime, chibi, cute'
out_b = [{'no': i + 1, 'name': n, 'theme': t, 'style': 'B arkham', 'prompt': STYLE_B + Q + BASE_B + m + ', ' + s, 'neg': NEG_B, 'w': 832, 'h': 1216, 'steps': 28}
         for i, (n, t, s, m) in enumerate(C)]
out = [{'no': i + 1, 'name': n, 'theme': t, 'scene': s, 'mood': m, 'prompt': ART + BASE + THEME[t] + m + ', ' + s, 'neg': NEG, 'w': 832, 'h': 1216, 'steps': 28}
       for i, (n, t, s, m) in enumerate(C)]
if __name__ == '__main__':
    json.dump(out, open('prompts_anime.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(out_b, open('prompts.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(len(out))
