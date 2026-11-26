#!/usr/bin/env node
/* 큰 파일을 조각으로 나눠 관리한다 (2026-11-26 코드 정리 5단계).
   · 고치는 곳은 조각(예: js/battle_ui/14_attack.js)이다. 합친 파일(js/battle_ui.js)은 이 스크립트가 만든다 — 직접 고치지 않는다.
   · 조각은 이름 순서대로 「그대로 이어 붙일」 뿐이다(사이에 아무것도 넣지 않는다). 조각 하나하나는 온전한 js 파일이 아닐 수 있다(첫 조각이 함수를 열고 마지막 조각이 닫는다).
   · 쓰는 법:  node tools/parts.js          조각 → 합친 파일 (고친 뒤 · push 전에 꼭)
               node tools/parts.js --check  합친 파일이 조각과 맞는지만 본다 (다르면 오류로 끝난다)
               node tools/parts.js --split  합친 파일 → 조각 (합친 파일을 통째로 정렬했을 때만)
   · 조각의 첫 줄은 「── 조각 이름.js — 설명 ──」 꼴의 주석 표시다(지우지 않는다 — 합친 파일에서 어느 조각인지 찾는 표지이자 --split 이 자르는 자리).
   · 새 조각은 폴더에 번호 붙은 파일을 더하면 된다(첫 줄에 같은 꼴의 표시). 문장 중간에서 자르지 말 것(함수 하나는 한 조각 안에). */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const TARGETS = [{ out: 'js/battle_ui.js', dir: 'js/battle_ui' }];
const banner = dir => `/* ⚠ 만들어지는 파일 — ${dir}/ 의 조각을 고치고 \`node tools/parts.js\` 로 다시 만든다. 이 파일을 직접 고치면 다음에 만들 때 사라진다. */\n`;
const check = process.argv.includes('--check');
const MARK = /^[ \t]*\/\* ── 조각 (\d+_[A-Za-z0-9_]+\.js) — .* ── \*\/$/;
/* --split : 합친 파일을 조각 표시 줄(「── 조각 이름.js — 설명 ──」)에서 잘라 조각으로 되돌린다. 합친 파일을 통째로 정렬(prettier)한 뒤에만 쓴다. */
if (process.argv.includes('--split')) {
  for (const t of TARGETS) {
    const lines = fs.readFileSync(path.join(ROOT, t.out), 'utf8').split('\n');
    if (/^\/\* ⚠ 만들어지는 파일/.test(lines[0])) lines.shift();
    const parts = []; let cur = null;
    for (const l of lines) { const m = l.match(MARK); if (m) { cur = { name: m[1], lines: [] }; parts.push(cur); } if (!cur) throw new Error(t.out + ': 첫 줄이 조각 표시가 아니다'); cur.lines.push(l); }
    const have = fs.readdirSync(path.join(ROOT, t.dir)).filter(f => /^\d+_.*\.js$/.test(f)).sort();
    if (have.join() !== parts.map(p => p.name).join()) throw new Error(t.out + ': 조각 표시가 폴더의 조각과 다르다 — ' + parts.map(p => p.name).join());
    parts.forEach((p, i) => fs.writeFileSync(path.join(ROOT, t.dir, p.name), p.lines.join('\n') + (i < parts.length - 1 ? '\n' : '')));
    console.log(`되돌림 ${t.out} → ${t.dir}/ ${parts.length} 조각`);
  }
}
let bad = 0;
for (const t of TARGETS) {
  const dir = path.join(ROOT, t.dir);
  const parts = fs.readdirSync(dir).filter(f => /^\d+_.*\.js$/.test(f)).sort();
  const out = banner(t.dir) + parts.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('');
  const file = path.join(ROOT, t.out);
  const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (check) {
    if (cur !== out) { bad++; console.error(`✗ ${t.out} 가 조각과 다르다 — 합친 파일을 직접 고쳤거나 만들기를 빼먹었다`); }
    else console.log(`✓ ${t.out} (${parts.length} 조각)`);
  } else {
    try { new Function(out); } catch (e) { bad++; console.error(`✗ ${t.out} 문법 오류: ${e.message} — 저장하지 않음`); continue; }
    if (cur !== out) fs.writeFileSync(file, out);
    console.log(`${cur !== out ? '만듦' : '그대로'} ${t.out} ← ${t.dir}/ ${parts.length} 조각 · ${(Buffer.byteLength(out) / 1024) | 0}KB`);
  }
}
process.exit(bad ? 1 : 0);
