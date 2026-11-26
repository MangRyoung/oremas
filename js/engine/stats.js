/* ---------- 능력치·레벨·개체값 (맵툴 Lib:pokemon calculate_data_info / reroll_iv 와 같은 식) ---------- */
'use strict';
window.OM_STATS = (() => {
  const DB = () => window.OM_DB || {};
  const STATS = ['hp', 'attack', 'defense', 'specialattack', 'specialdefense', 'speed'];
  const STATS_KO = ['HP', '공격', '방어', '특공', '특방', '스피드'];
  const RANKS = ['E', 'D', 'C', 'B', 'A', 'AA', 'AAA', 'S'];
  const strip = s =>
    String(s || '')
      .replace(/[+\-]/g, '')
      .trim();

  /* 트레이너 육성 랭크 → 기본 레벨 (제작기 lvl 표: [랭크, 경험치, 레벨, 종족치 상한]) */
  function baseLevel(rank) {
    const L = (DB().maker || {}).lvl || [];
    const r = L.find(x => x[0] === rank) || L.find(x => x[0] === strip(rank));
    return r ? +r[2] : 100;
  }
  /* 11-03 감우: 분배레벨(dist)이 소수면 제작기 lv 와 같게 반올림 (제작기는 Math.round(dist)) — 전엔 그대로 더해 레벨이 소수로 어긋났다 */
  function levelOf(trainer, p) {
    return (
      baseLevel(trainer && trainer.ranks ? trainer.ranks['육성'] : '') + Math.round(+(p && p.dist) || 0) + Math.round(+(p && p.lvUp && p.lvUp.n) || 0)
    );
  } /* 11-18: 제작기가 【준비】 「LV : +N」을 계산해 둔 lvUp */

  /* 종족치 → 등급 (제작기 grade 표: [하한, 등급]) */
  function gradeOf(v) {
    v = +v || 0;
    const G = (DB().maker || {}).grade || [];
    let g = '-';
    for (const [lo, name] of G) {
      if (v >= +lo) g = name;
      else break;
    }
    return g;
  }

  /* 실수치. hp: floor((2B+IV+floor(EV/4))·L/100)+L+10 / 그 밖: …+5 */
  function statOf(i, base, iv, ev, L) {
    const core = Math.floor(((2 * (+base || 0) + (+iv || 0) + Math.floor((+ev || 0) / 4)) * L) / 100);
    return i === 0 ? core + L + 10 : core + 5;
  }
  function statsOf(base, iv, ev, L) {
    return [0, 1, 2, 3, 4, 5].map(i => statOf(i, base[i], iv ? iv[i] : 0, ev ? ev[i] : 0, L));
  }

  /* 개체값 알까기: 1d32-1 ×6 을 count 번. 횟수는 트레이너 육성 랭크(reroll_list) 기준 */
  function hatchCount(trainer) {
    const rl = ((DB().const || {}).campaign || {}).reroll_list || {};
    const r = strip(trainer && trainer.ranks ? trainer.ranks['육성'] : '');
    return +(rl[r] || 5);
  }
  /* 11-26 망령 「알까기에서 천부의 재능은 모든 개체치 31로 고정 / 금관은 HP 개체치 62 스피드 개체치 0 으로 고정」
     분류 포텐셜로 정해지는 개체값 표 — 칸(HP · 공격 · 방어 · 특공 · 특방 · 스피드)마다 숫자 = 고정, null = 굴린다.
     굴리기 · 후보 읽기 · 손으로 고치기 · 제작기에서 불러오기가 전부 ivNorm 하나를 거친다. 제작기 js/maker/02_calc.js 의 IV_FIX 와 같은 표 — 고치면 둘 다 */
  const IV_FIX = {
    '천부의 재능': [31, 31, 31, 31, 31, 31],
    '금관 사이즈': [62, null, null, null, null, 0]
  };
  /* 포켓몬(배틀 · 시트 · 제작기 문서 — pots 가 이름 글자열이든 {name} 이든)의 고정 표. 없으면 null */
  function ivFixOf(mon) {
    for (const p of (mon && mon.pots) || []) {
      const name = String((p && typeof p === 'object' ? p.name : p) || '').replace(/[『』\s]/g, '');
      const hit = Object.keys(IV_FIX).find(k => k.replace(/\s/g, '') === name);
      if (hit) return IV_FIX[hit];
    }
    return null;
  }
  /* 개체값 6칸을 바르게: 고정 칸은 표의 값, 나머지는 0–31 정수 */
  function ivNorm(iv, mon) {
    const fix = ivFixOf(mon);
    return [0, 1, 2, 3, 4, 5].map(k => (fix && fix[k] != null ? fix[k] : Math.max(0, Math.min(31, Math.round(+(iv || [])[k]) || 0))));
  }
  /* 알까기 창에 띄우는 한 줄 (고정이 없으면 빈 글) */
  function ivFixNote(mon) {
    const fix = ivFixOf(mon);
    if (!fix) return '';
    const kind = Object.keys(IV_FIX).find(k => IV_FIX[k] === fix);
    const names = ['HP', '공격', '방어', '특공', '특방', '스피드'];
    const all = fix.every(v => v != null && v === fix[0]);
    return `『${kind}』 — ${
      all
        ? `모든 개체값 ${fix[0]}`
        : fix
            .map((v, k) => (v == null ? '' : `${names[k]} ${v}`))
            .filter(Boolean)
            .join(' · ')
    } 고정`;
  }
  function rollIv(mon) {
    return ivNorm(
      [0, 1, 2, 3, 4, 5].map(() => Math.floor(Math.random() * 32)),
      mon
    );
  }
  function hatch(count, mon) {
    const out = [];
    for (let i = 0; i < count; i++) out.push(rollIv(mon));
    return out;
  }
  const ivSum = iv => iv.reduce((a, b) => a + (+b || 0), 0);

  /* 랭크 배율 (get_status_values): 능력치 r≥0 → 1+r/2, r<0 → 2/(2+|r|) / 명중·회피 r≥0 → 1+r/3, r<0 → 3/(3+|r|) */
  function rankMult(r) {
    r = +r || 0;
    return r >= 0 ? 1 + r / 2 : 2 / (2 - r);
  }
  function accMult(r) {
    r = +r || 0;
    return r >= 0 ? 1 + r / 3 : 3 / (3 - r);
  }

  /* 타입 */
  function typeEn(ko) {
    if (!ko || ko === '-') return '-';
    const t = (DB().const || {}).trans || {};
    return t['type_' + ko] || ko;
  }
  function typeKo(en) {
    if (!en || en === '-') return '-';
    const t = (DB().const || {}).trans || {};
    return t['type_' + en] || en;
  }
  function typeColor(en) {
    const c = ((DB().const || {}).color || {})[String(en || '').toLowerCase()] || '';
    const p = c.split(',');
    return p.length >= 2 ? { bg: p[0].trim(), fg: p[1].trim() } : { bg: '#2d3244', fg: '#e8e4da' };
  }
  /* 상성: chart[방어타입][공격타입] */
  function effect(atkEn, defTypesEn) {
    const ch = (DB().types || {}).chart || {};
    let m = 1;
    for (const d of defTypesEn) {
      if (!d || d === '-') continue;
      const row = ch[d];
      if (row && row[atkEn] != null) m *= row[atkEn];
    }
    return m;
  }

  return {
    STATS,
    STATS_KO,
    RANKS,
    strip,
    baseLevel,
    levelOf,
    gradeOf,
    statOf,
    statsOf,
    hatchCount,
    rollIv,
    hatch,
    ivFixOf,
    ivNorm,
    ivFixNote,
    ivSum,
    rankMult,
    accMult,
    typeEn,
    typeKo,
    typeColor,
    effect
  };
})();
