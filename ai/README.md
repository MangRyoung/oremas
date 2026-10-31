# AI 진행자 안내 — 망켓몬 · 오레마스 웹툴

이 폴더는 망령(GM)의 TRPG 「망켓몬」에서 **AI 가 배틀 진행 · RP 를 맡을 때** 읽는 곳입니다.
어떤 AI 든 이 파일 주소 하나만 받으면 나머지를 찾아 읽을 수 있게 짰습니다.

> 지침 안의 「감우」는 처음 이 지침을 쓴 AI 의 이름입니다. 다른 AI 는 「감우」를 **진행을 맡은 나 자신**으로 읽으면 됩니다.

## 읽는 순서
1. **[battle-guide.md](https://mangryoung.github.io/oremas/ai/battle-guide.md)** — 배틀 진행 지침. GM 이 확인한 규칙만 있습니다. 진행 전에 처음부터 끝까지 읽습니다.
2. **[battle-log.md](https://mangryoung.github.io/oremas/ai/battle-log.md)** — 진행 기록. 「1. 지침에 아직 안 올린 것」과 「3. 툴 이상」을 먼저 봅니다. 지침과 기록이 다르면 **기록의 망령 확정 줄**이 더 새것입니다.
3. 룰 원문이 필요하면 제작기 룰북: https://mangryoung.github.io/mangketmon-maker/rulebook.html

## 주소
| 무엇 | 사람이 볼 때 | AI 에게 줄 때 (글 그대로) |
|---|---|---|
| 이 안내 | https://mangryoung.github.io/oremas/ai/ | https://mangryoung.github.io/oremas/ai/README.md |
| 배틀 진행 지침 | https://mangryoung.github.io/oremas/ai/#guide | https://mangryoung.github.io/oremas/ai/battle-guide.md |
| 배틀 진행 기록 | https://mangryoung.github.io/oremas/ai/#log | https://mangryoung.github.io/oremas/ai/battle-log.md |

웹툴 GM 의 배틀 화면 조작판(「⚙ 자동화 확인」 옆) **「🤖 AI 에게 맡기기」** 단추를 누르면, 아래 문장에 이 방 정보 · 정해 둔 것(형식 · 소지품 · HP …)까지 붙여 한 번에 복사됩니다. 링크를 못 여는 AI 에게는 같은 창의 「지침까지 통째로 복사」를 씁니다.

손으로 쓸 때는 이렇게만 말하면 됩니다:
```
https://mangryoung.github.io/oremas/ai/README.md 를 읽고, 거기 적힌 순서대로 지침을 읽은 다음 배틀을 진행해 줘.
```

## 기록하는 법
- **저장소를 고칠 수 있는 AI**(이 저장소에서 일하는 Codex · Claude Code 등): `ai/battle-log.md` 의 맞는 칸에 한 줄 더하고 커밋합니다. 커밋 메시지는 `기록: …`.
- **고칠 수 없는 AI**(웹 채팅 등): 배틀이 끝나면 대화(또는 잡담방)에 아래 꼴로 남깁니다. GM 이 기록에 옮깁니다.
  ```
  [기록 제안] 2026-11-01 · 방 이름 · 몇 턴 · 무엇이 있었나 · 누가 정했나(망령 확정 / AI 추정)
  ```
- **지침(battle-guide.md)은 GM 이 확인한 것만 고칩니다.** AI 가 혼자 고치지 않습니다. 확인되면 기록 줄 끝에 「→ 지침 n-n 반영」을 붙입니다.

## 사본
- `sim/docs/배틀_진행_지침.md` — 시뮬레이터용 사본. battle-guide.md 가 바뀌면 통째로 바꿉니다.
- claude.ai 프로젝트 「망켓몬」 · PC 의 `D:\TRPG\망각\09_배틀_진행_지침.md` 는 이 폴더를 가리키기만 합니다.
