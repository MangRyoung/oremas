# 던전 · 스킬 체크 시뮬레이터 (sim/)

망켓몬의 **스킬 체크 난이도 · 패널티 · 제시 횟수**와 **던전 구성**이 어디까지 적절한지 숫자로 보기 위한 도구다.
제작기 파티를 불러와 던전(방 · 체크 · 야생 조우 · 휴식)을 수백 판 자동으로 돌리고, 결과를 `records/` 에 남긴다.
목적은 **「스킬 체크 · 던전 제작 가이드라인」** 을 데이터로 쓰는 것이고, 그 가이드라인대로 만든 스킬 체크 예시와 던전은 이 폴더에서 관리하다가 웹툴로 옮긴다.

> 이 README 와 `records/feedback.md` 만 읽어도 다른 세션(사람이든 Claude 든)이 이어서 작업할 수 있게 써 둔다. 바뀐 결정은 `records/feedback.md` 에 날짜와 함께 적는다.

## 돌리는 법

- 필요한 것: Node 18 이상. 제작기 폴더가 웹툴 폴더 옆에 있어야 한다 (`D:\TRPG\망각\oremas` 와 `D:\TRPG\망각\mangketmon-maker`). 다른 곳이면 `MK_ROOT` 환경 변수로 제작기 폴더를 준다.
- **화면으로 쓰기 (권장)**: `sim\실행.bat` → 브라우저에 http://localhost:8470 이 열린다(Node 가 없으면 설치 페이지를 연다). 탭: 돌리기 · 일행(제작기식 트레이너 카드 · 포켓몬 시트) · 던전(웹툴 던전 탭식 지도 편집기) · 야생(무리 · 종 카드) · 기록 · 리포트 · 피드백(feedback.md) · 체크 확률표. 던전 · 야생을 고쳐 저장하면 data/ 에 바로 쓴다. 「제작기에서 받기」 단추가 `fetch` 와 같다. `바로가기_만들기.bat` 을 한 번 실행하면 이 폴더와 바탕화면에 주사위 아이콘 바로가기가 생긴다.
- 명령줄 없이: `sim\받기.bat` (제작기 → 스냅샷), `sim\돌리기.bat` (기본 시나리오 → 리포트).
- 명령줄:

```
node bin/sim.js fetch                                    제작기 공유 DB → data/snapshot.json  (Supabase 가 닿는 곳에서만 — 작업 컨테이너는 막혀 있다)
node bin/sim.js list                                     스냅샷의 트레이너 (폴더/이름 · 랭크 · 포켓몬 수 · id)
node bin/sim.js check                                    스킬 체크 성공률 표 (룰북 열지도와 같은 식)
node bin/sim.js battle --party 카이 --wild factory_boss --n 200 --wn 2 [--log]
node bin/sim.js run --scenario data/scenarios/base.json [--n 1000]
node bin/sim.js run --dungeon factory --party 카이,미오,레온 --n 500 --adjust target=2,penScale=0.5 --policy cover=never
node bin/sim.js combos --pool id:a,id:b,… --size 3 --dungeons x,y --n 100 --id 이름   후보 중 n명 조합 전부 × 던전들 (기록 탭에 표)
node bin/sim.js report                                   records/*.summary.json → report/index.html · report.md
```

- `--snap` 을 안 주면 `data/snapshot.json`, 그것도 없으면 `data/sample_snapshot.json` (시험용 트레이너 4명: 카이 · 미오 · 레온 · 단) 을 쓴다.
- 트레이너 고르기: `이름` · `폴더/이름` · `폴더/*` · `id:xxxx`.

## 폴더

| 경로 | 내용 |
|---|---|
| `bin/sim.js` | 명령줄 진입점 (`ui` 명령이 화면 서버) |
| `lib/server.js` · `ui/index.html` | 화면 — 로컬 서버(/api) + 한 장짜리 페이지. 돌리기 · 던전 편집 · 야생 편집 · 기록 · 피드백 · 체크 확률표 |
| `lib/env.js` | 웹툴 `data/*.js` · `js/engine/*.js` · 제작기 `js/fx/*.js` 를 브라우저 없이 읽는다 (index.html 과 같은 순서) |
| `lib/fetch.js` | Supabase REST 로 제작기 문서를 받아 스냅샷으로 |
| `lib/party.js` | 스냅샷 → 배틀용 파티 (웹툴 `import.js` 의 `party()` 그대로) |
| `lib/skill.js` | 스킬 체크 순수 함수 — 룰북 「스킬 체크」 장 · 웹툴 `skill_ui.js` 와 같은 규칙. `dist()` 로 정확한 확률 |
| `lib/battle.js` | 약식 배틀 — 엔진 계산(순서 · 명중 · 급소 · 대미지 · 상성 · 비례 대미지 · 행동 판정 · 기술 효과 구문) + 지시 랭크별 자동 지시 |
| `lib/wild.js` | 야생 무리 (`data/wild/species.json` 의 종 · `data/wild/*.json` 의 무리) → 『와일드』 ×1.25 · 『와일드 보스』 ×1.5 |
| `lib/dungeon.js` | 던전 진행기 — 방 순서대로 체크 · 조우 · 휴식, 일행 상태(HP · 상태 · 지침 · 부상 · 이능 · 묘수 · 돌봄 · 4식6령 차감) 추적 |
| `lib/report.js` | 기록 집계 → HTML · Markdown |
| `lib/automove.js` | 기술이 빈 포켓몬에게 시험용 표준 기술 |
| `lib/ko.js` | 기록 · 리포트의 한국어 이름표 (조정값 · 정책 · 던전 · 일행 → 읽는 말) |
| `data/dungeons/*.json` | 던전 (방 · 체크 · 조우 · 휴식 · 경로) — **가이드라인에 맞춰 여기서 관리하고 웹툴로 옮긴다** |
| `data/wild/*.json` | 야생 종 · 무리 |
| `data/scenarios/*.json` | 실험 시나리오 (던전 · 일행 · 판 수 · 조정값 · 정책 · 스윕) |
| `data/sample_snapshot.json` | 시험용 파티 4명 (제작기 문서 꼴) |
| `records/*.jsonl` · `*.summary.json` | 판마다 한 줄 기록 · 시나리오 집계 (`name` 이 한국어 이름, `id` 가 파일 이름) |
| `records/feedback.md` | **인수인계 · 결정 · 발견 · 다음 할 일** |
| `records/journal.json` · `records/private/journal.json` | **실험 일지** — 화면 「기록 · 리포트」 맨 위. 항목 종류 실험 · 발견 · 개선안 · 결정 · 할 일, 관련 기록 연결, 비공개 분리. 기록마다 짧은 코멘트는 summary 의 `comment` 칸 |
| `report/index.html` · `report.md` | 리포트 |

## 던전 파일 꼴

```json
{"id":"factory","name":"버려진 발전소","wn":2,
 "rooms":[
  {"id":"gate","t":"entry","name":"정문","check":{"label":"정문 안내판을 해독한다","stat":"지시","target":7,"hint":"any",
      "pen":{"fail":{"memo":"시간 지체"},"cost":{"memo":"흔적을 남김"}}}},
  {"id":"line","t":"battle","name":"조립 라인","enc":{"pack":"factory_pack"}},
  {"id":"safe","t":"safe","name":"휴게실","rest":"breath"},
  {"id":"core","t":"boss","name":"발전기 심부","enc":{"pack":"factory_boss","boss":true}}],
 "path":["gate","line","safe","core"]}
```

- `t` 방 종류는 웹툴 던전 탭과 같다: entry · room · battle · trap · puzzle · treasure · safe · boss.
- `check`: `stat` 지시 · 육성 · 통솔 · 능력, `target` 5 · 7 · 9 · 11, `mode` `inou` 면 능력 A 이상은 이능으로, `step` ±1 단계 보정, `twice` 1 높은 값 · −1 낮은 값, `hint` 동료 조건(`type:물` · `any` · `none`), `pen.fail` · `pen.cost` 패널티(`dmg` 분수 · `st` 상태 · `rk` 랭크 · `oo` 4식 차감 · `oc` 6령 차감 · `memo`). 패널티 꼴은 웹툴 `skill_ui.js` 의 PEN_EX 와 같다.
- `enc.pack` 은 `data/wild/` 의 무리 id. `boss:true` 면 보스 방으로 센다.
- `enc.trainer` 는 제작기 스냅샷의 트레이너를 야생 무리로(`"id:xxxx"`). `pick:[순번…]` 으로 포켓몬을 고르고, `boss:true` 면 파트너(없으면 첫째)가 『와일드 보스』 ×1.5, 나머지 『와일드』 ×1.25.
- 비공개: 파일 이름을 `*.private.json` 으로(화면의 「비공개」 칸). 비공개 트레이너가 일행에 있거나 던전이 비공개면 기록은 `records/private/`, 리포트는 `report/private.html` — 전부 git 제외.
- 기술이 빈 포켓몬은 `lib/automove.js` 가 시험용 표준 기술(자속 + 견제)을 채운다(제작기에 기술이 있으면 그쪽).
- `rest`: breath(HP 1/4 · 지침 해제) · short(HP 1/2 · 상태 치유 · 부상 1단계 · 이능 · 돌봄 회복) · long(전부).

## 시나리오 파일 꼴

```json
{"id":"target","dungeon":"factory","party":["카이","미오","레온"],"n":500,"seed":1,
 "sweep":{"target":[-2,0,2]},"policy":{"cover":"fail"}}
```

- `adjust`: `target` 목표치 가감 · `penScale` 패널티 대미지 배율 · `checkEvery` 2 면 체크를 하나 걸러 하나만 · `stepAll` 모든 체크 단계 보정 · `wildLv` 야생 레벨 가감 · `wildExtra` 야생 무리에 n 체 더.
- `policy`: `who` best(그 자질 주사위가 가장 큰 사람) · round, `cover` never · fail(실패를 받침) · always(대가도 받침), `partner` match · any · none, `inou` yes · no.
- `sweep` 에 적은 키는 값마다 변형을 만든다 (정책 키 cover · who · partner · inou 는 정책으로, 나머지는 조정으로).

## 약식이라 다루지 않는 것 (해석할 때 주의)

- 배틀: 특성 · 소지품 · 포텐셜 · 날씨 · 필드 · 설치기 · 기술 방어 · 연속 제한 · 선행/임의 발동은 없다. 4식은 물러나 · 피해라 · 버텨라만, 6령은 능력 +1 지령만, 둘 다 【1/시】 횟수 안에서 단순 규칙으로 쓴다. 지시 정책은 지침 2-11 을 단순화한 것이라 실제 사람보다 「덜 똑똑하고 덜 멍청」하다.
- 스킬 체크: 대성공 이득 · 대가의 내용은 패널티 칸에 적은 것만 반영한다(시간 지체 같은 서술은 기록만). 재시도 · 대항 판정은 없다.
- 야생 종은 시험용 가상 종이다(실제 포켓몬 아님). 무진 각성체 데이터는 제작기에서 받아 쓰면 된다 (`--party 무진 NPC/…`).
