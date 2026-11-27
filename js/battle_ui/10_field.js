  /* ── 조각 10_field.js — 필드 · 상태 효과 로그 · 필드 창(GM) · 설치물 ── */
  /* ---------- 11-01 망령 「필드 · 날씨 · 설치물 전개 때 효과 UI 를 로그에」 ----------
    배틀을 쓸 때(saveBattle · 필드 창 · 설치물 창) 쓰기 전후 필드를 견주어(fieldDiff) 새로 깔리거나 갱신된 날씨 · 필드 · 룸 · 필드의 상태 · 설치물마다
    배틀 로그 한 줄(data.fc)을 남긴다 — 다른 배틀 카드처럼 로그 표로 모두에게 간다. 그리는 건 fieldCard (app.js battleCard 가 부른다), 걷히면 작은 카드.
    글(data.t)은 「【날씨】 비 — 5턴」 + 효과 줄이라 카드를 모르는 곳(로그 저장 · 정리기)에서도 보통 배틀 카드로 읽힌다. 효과 글은 실제 계산 규칙(WEATHER_MUL · field.js HAZ/RM · 공격 창 배율)에서 */
  const FC_KIND = { w: '날씨', t: '필드', r: '룸', e: '필드의 상태', o: '설치물' };
  const FC_COL = {
    맑음: '#f08a24',
    큰가뭄: '#e5531a',
    비: '#3b8fe0',
    폭우: '#2a5fd0',
    모래바람: '#c49a5a',
    싸라기눈: '#6fc9de',
    눈: '#9fe3ef',
    극한: '#58c0e0',
    짙은안개: '#9aa0b4',
    밤: '#6a5cc4',
    깊은밤: '#4b3aa6',
    별하늘: '#7486ea',
    난기류: '#6fb7a3',
    그래스필드: '#3fae5a',
    일렉트릭필드: '#f2c418',
    미스트필드: '#ef7fb8',
    사이코필드: '#a65fd6',
    트릭룸: '#c75fd0',
    매직룸: '#4f8ad6',
    원더룸: '#d6894f',
    블랙룸: '#6d7290',
    중력: '#7a6fd0',
    물놀이: '#3fa6d6',
    흙놀이: '#a07a4a',
    wall: '#4fb3c9',
    aid: '#5cbf8c',
    hazA: '#8d877c',
    hazB: '#8d877c',
    etc: '#9a8fb0',
    guard: '#7d93b0',
    스텔스록: '#a8875a',
    독압정: '#9a62c0',
    불바다: '#e0562a'
  };
  const FC_GLY = { wall: '◆', aid: '✦', hazA: '▲', hazB: '▲', etc: '●', guard: '◆' };
  const FC_LAY = { 압정뿌리기: 3, 독압정: 2 };
  const fcEnd = x => (x.k === 'o' && /^haz/.test(objCat(x.n)[0]) ? '철거' : '끝'); /* 설치기는 「철거」, 벽 · 날씨 · 룸은 「끝」 */
  function fcDur(x) {
    if (x.end) return '끝';
    if (x.k === 'o' && FC_LAY[x.n]) return (+x.c || 1) + '겹';
    return !+x.c || +x.c >= 1000 ? '계속' : +x.c + '턴';
  }
  function fcInfo(x, b) {
    const n = x.n,
      L = [];
    let note = '',
      EXL = [];
    const tk = t => S().typeKo(t);
    const ws = mode(b || {}) >= 2 ? 0.67 : 0.5;
    if (x.k === 'w') {
      const M = WEATHER_MUL[n] || {};
      const up = Object.keys(M).filter(t => M[t] > 1);
      if (up.length) L.push(`${up.map(tk).join(' · ')} 기술 ×${M[up[0]]}`);
      for (const t of Object.keys(M).filter(t => M[t] < 1)) L.push(M[t] ? `${tk(t)} 기술 ×${M[t]}` : `${tk(t)} 기술 무효 (×0)`);
      /* 11-01 망령 「맵툴 캠페인 읽고 날씨 부가 효과」: print_effect_weather 의 줄을 옮김 (싸라기눈 · 깊은밤 배율 · 짙은안개 0.9 는 웹툴 결정 유지) */
      if (n === '맑음' || n === '큰가뭄') L.push('「얼음」 상태가 되지 않는다');
      if (n === '밤' || n === '깊은밤') L.push('고스트 · 악 타입은 「잠듦」 상태가 되지 않는다');
      if (n === '깊은밤') L.push('「명중 : 90」 이하인 기술은 무효');
      if (n === '모래바람') L.push('바위 타입 특방 ×1.5', '턴 끝 1/16 대미지 (바위 · 땅 · 강철 · 방진고글 제외)');
      if (n === '극한') L.push('얼음 타입 방어 ×2', '물 기술이 얼음 기술이 된다', '「얼음」 상태 내성이 무효');
      if (['눈', '싸라기눈'].includes(n)) L.push('얼음 타입 방어 ×1.5');
      if (n === '싸라기눈') L.push('턴 끝 대미지 없음');
      if (n === '짙은안개') L.push('명중 ×0.9 (독 · 페어리 타입 포켓몬은 영향 없음)');
      if (n === '별하늘') L.push('명중 ×1.1');
      if (n === '난기류') L.push('비행 타입의 약점을 없앤다 (상성 2배 → 1배)');
      if (['큰가뭄', '폭우', '난기류', '극한', '깊은밤'].includes(n))
        note = '특성이 부르는 날씨 — 부른 포켓몬이 필드 위에 있는 한 · 상위 날씨나 「삼천세계」로만 덮어쓴다';
      EXL = wxLinks(b, n);
    } else if (x.k === 't') {
      note = '땅 위 포켓몬에게만';
      L.push(
        ...({
          그래스필드: ['풀 기술 ×1.3', '턴 끝 HP 1/16 회복'],
          일렉트릭필드: ['전기 기술 ×1.3', '「잠듦」 · 「하품」에 걸리지 않는다'],
          미스트필드: ['받는 드래곤 기술 ×0.5', '상태 이상 · 「혼란」에 걸리지 않는다'],
          사이코필드: ['에스퍼 기술 ×1.3', '상대의 선공기(우선도 +1 이상)를 받지 않는다']
        }[n] || [])
      );
    } else if (x.k === 'r' || x.k === 'e')
      L.push(
        ...({
          트릭룸: ['스피드가 느린 포켓몬부터 행동'],
          매직룸: ['소지품 효과 없음'],
          원더룸: ['방어 ↔ 특방 실수치를 바꾼다'],
          블랙룸: ['공격 기술이 모두 고스트 타입'],
          중력: ['명중 ×1.67', '하늘에 떠오를 수 없다'],
          물놀이: ['불꽃 기술 위력 ×0.5'],
          흙놀이: ['전기 기술 위력 ×0.5']
        }[n] || [])
      );
    else {
      const FD = window.OM_FIELD || {};
      const H = (FD.HAZ || []).find(h => h.k === n);
      const R = (FD.RM || {})[n];
      const W = {
        리플렉터: [`받는 물리기 대미지 ×${ws}`, '급소면 무시'],
        빛의장막: [`받는 특수기 대미지 ×${ws}`, '급소면 무시'],
        오로라베일: [`받는 기술 대미지 ×${ws}`, '급소면 무시'],
        얼음의장벽: [`받는 기술 대미지 ×${ws}`, '불꽃 기술을 맞으면 녹아 철거'],
        신비의부적: ['다른 포켓몬이 거는 상태 이상 · 「혼란」을 막는다'],
        흰안개: ['능력 감소를 막는다'],
        주술: ['급소에 맞지 않는다'],
        검은숲: ['랭크 변화가 ±0'],
        순풍: ['스피드 ×2'],
        습원: ['스피드 ×0.25'],
        불바다: ['턴 끝 1/8 대미지 (불꽃 타입 제외)'],
        돌격: ['「공격」 ×2'],
        신기루: ['받는 물리기 명중률 반감'],
        희망사항: ['다음 턴 끝에 HP 1/2 회복'],
        와이드가드: ['이번 턴 전체기를 막는다']
      }[n];
      if (W) L.push(...W);
      else if (H) {
        const lay = Math.max(1, +x.c || 1);
        if (H.kind === 'spike') L.push(`등장 때 HP 1/${10 - 2 * Math.min(3, lay)} 대미지`, '1겹 1/8 → 2겹 1/6 → 3겹 1/4');
        else if (H.kind === 'tspike')
          L.push(`등장 때 「${lay >= 2 ? '맹독' : '독'}」 (1겹 독 → 2겹 맹독)`, '독 · 강철 타입 · 이미 상태 이상이면 영향 없음');
        else if (H.kind === 'net') L.push('등장 때 스피드 −1');
        else if (H.kind === 'mine') L.push('등장 때 「마비」 · 한 번 쓰면 사라진다');
        else if (H.kind === 'bounce') L.push('등장하면 강제 교대 · 한 번 쓰면 사라진다');
        else if (H.kind === 'rose') L.push('등장 때 HP 1/8 드레인 — 같은 에리어 상대가 회복');
        else if (H.kind === 'iceburn') L.push('등장한 포켓몬의 첫 기술 「우선도 : -1」');
        else if (H.ty) L.push(`등장 때 ${tk(H.ty)} 상성 × 1/8 대미지`);
        else if (H.st) L.push(`등장 때 「${(((DB().states || {}).st || {})[H.st] || {}).ko || H.st}」 상태로`);
        else if (H.f) L.push(`등장 때 HP 1/${H.f} 대미지${H.once ? ' · 한 번 쓰면 사라진다' : ''}`);
        if (R) L.push(`${R.g ? '땅 위의 ' : ''}${R.t.map(tk).join(' · ')} 타입이 등장하면 철거`);
        note = (H.c === 'A' ? '땅 위 포켓몬만' : '모든 포켓몬') + ' · 통굽부츠면 영향 없음';
      } else note = objCat(n)[1] || '';
    }
    /* 규칙 표에 없는 것은 기술 DB 효과 글을 줄여서 */
    if (!L.length) {
      const e = String(((DB().moves || {})[n] || {}).eff || '')
        .replace(/「(?:우선도|설치기)[^」]*」[^.]*\.\s*/g, '')
        .replace(/\s*「[^」]+」\s*기술\.\s*$/, '')
        .trim();
      if (e && e !== '-') L.push(e.length > 90 ? e.slice(0, 88) + '…' : e);
    }
    return { L: [...L.slice(0, 4), ...EXL], note };
  }
  /* 11-01 망령 「날씨 효과 위력만 있고 부가 효과가 없다」: 이 배틀에 나온 포켓몬의 기술 · 특성 · 포텐셜 중 이 날씨를 따르는 것을 카드에 덧붙인다.
    기술 글의 「날씨 : X, Y」일 때 … 문장을 읽어 필중 · 명중 N · 차지 없이 · 위력 반감 · 회복 ↑↓ 로 묶고, 그 밖은 이름만. 눈 ↔ 싸라기눈은 같은 것으로 본다 (spMulOf 와 같게) */
  /* 11-04 19:39 망령 「와이드포스의 필드 1.5배나 웨더볼 같은 날씨/필드에 영향받는 기술들 자동화」: 기술 글을 읽는다
    · 「날씨 : X」일 때 위력이 강화(N배) · 「필드 : X」 위에 있을 때/일 때 … 위력이 강화(N배) (「위에 있을 때」는 땅 위 공격자만) · 「필드 : X」일 때 위력이 절반
    · 「필드 : X」 위에 있을 때 … 「범위 : Y」가 된다 (와이드포스) → 기본 대상
    · 「날씨」가 전개되어 있을 때 위력이 N배 · 「날씨」 기술과 같은 「타입」 (웨더볼) / 「날씨」와 같은 타입 (하늘을가르는무지개 — 날씨 없으면 실패) */
  const WXT = {};
  function wxTypeOf(W, mv) {
    W = String(W || '');
    if (!W) return '';
    {
      const nt = String((mv && mv.note) || '');
      const re = /「([^:：」]+)\s*[:：]\s*([^」]+)」/g;
      let r;
      while ((r = re.exec(nt))) {
        const k = r[1].trim();
        if (k === W || W.includes(k) || k.includes(W)) {
          const en = S().typeEn(r[2].trim());
          if (en) return en;
        }
      }
    }
    if (WXT[W] != null) return WXT[W];
    let ty = '';
    for (const x of Object.values(DB().moves || {})) {
      if (!x || /^(거?다이)/.test(String(x.name || ''))) continue;
      const r = String(x.eff || '').match(/「날씨\s*:\s*([^」]+)」(?:으로|로)\s*만든다/);
      if (r && wxSame(r[1].trim(), W) && !/일 때|라면/.test(String(x.eff || '').slice(0, r.index))) {
        ty = x.typeEn || S().typeEn(x.type) || '';
        if (ty) break;
      }
    }
    return (WXT[W] = ty);
  }
  function wxMoveTy(b, mv, m) {
    if (m && UMB(m)) return '';
    const e = String((mv && mv.eff) || '');
    if (!/「날씨」(?:가 전개되어 있을 때[^.]*「날씨」 기술과 같은 「타입」|와 같은 타입)/.test(e)) return '';
    return wxTypeOf(wxNow(b), mv);
  }
  function terrRange(b, m, mv) {
    const e = String((mv && mv.eff) || '');
    const r = e.match(/「필드\s*:\s*([^」]+)」\s*(위에\s*있을\s*때|위에\s*있다면|일\s*때).*?「범위\s*:\s*([^」]+)」(?:가|이)\s*된다/);
    if (!r) return '';
    const FT = String(((fieldOf(b) || {}).terrain || {}).type || '');
    if (r[1].trim() !== FT) return '';
    if (/위에/.test(r[2]) && !grd(m)) return '';
    return r[3].trim();
  }
  function wxTerrPow(b, m, mv) {
    const e = String((mv && mv.eff) || '');
    const f = fieldOf(b) || {};
    const W = UMB(m) ? '' : wxNow(b),
      FT = String((f.terrain || {}).type || '');
    let mul = 1;
    const why = [];
    {
      const r = e.match(/「날씨\s*:\s*([^」]+)」일 때 위력이 강화\((\d+(?:\.\d+)?)배\)/);
      if (r && W && r[1].split(/[,，]\s*/).some(x => wxSame(x.trim(), W))) {
        mul *= +r[2];
        why.push(`「${W}」 — 위력 ×${r[2]}`);
      }
    }
    {
      const r = e.match(/「날씨」가 전개되어 있을 때 위력이\s*(\d+(?:\.\d+)?)배/);
      if (r && W) {
        mul *= +r[1];
        const ty = wxMoveTy(b, mv, m);
        why.push(`「${W}」 — 위력 ×${r[1]}${ty ? ' · ' + S().typeKo(ty) + ' 타입' : ''}`);
      }
    }
    if (/「날씨」와 같은 타입이 된다/.test(e)) {
      if (!W) why.push('날씨가 없다 — 실패');
      else {
        const ty = wxMoveTy(b, mv, m);
        if (ty) why.push(`「${W}」 — ${S().typeKo(ty)} 타입`);
      }
    }
    {
      const r = e.match(/「필드\s*:\s*([^」]+)」\s*(위에\s*있을\s*때|위에\s*있다면|일\s*때)[^.]*?위력이\s*강화\((\d+(?:\.\d+)?)배\)/);
      if (r && FT && r[1].trim() === FT) {
        if (/위에/.test(r[2]) && !grd(m)) why.push(`떠 있어 「${FT}」 기술 효과 없음`);
        else {
          mul *= +r[3];
          why.push(`「${FT}」 — 위력 ×${r[3]}`);
        }
      }
    }
    {
      const r = e.match(/「필드\s*:\s*([^」]+)」일 때 위력이\s*(?:절반|반감)/);
      if (r && FT && r[1].trim() === FT) {
        mul *= 0.5;
        why.push(`「${FT}」 — 위력 반감`);
      }
    }
    {
      const rg = terrRange(b, m, mv);
      if (rg) why.push(`「${FT}」 — 범위 ${rg}`);
    }
    return { mul, why };
  }
  /* 11-04 19:55 망령 「도우미 겹치는 배율 자동화 · 도우미는 턴 종료 시까지 유지라 두 번 걸린다」: 「도우미」 상태는 턴 종료까지 그대로(공격해도 안 쓴다) · 걸린 횟수 helpN 만큼 1.5 를 곱한다 (2번 = ×2.25) */
  /* 11-26 368 셰익스피어 『인챈트』 「아군의 「도우미」 상태에 의한 배율을 강화(1.5배→2배)」: 같은 편 필드에 그 글을 가진 다른 포켓몬이 있으면 도우미 한 번의 배율을 그 값으로 (helpBase) */
  const HELP_UP_RE = /아군의\s*「\s*도우미\s*」\s*상태에\s*의한\s*배율을\s*강화\s*\(\s*(?:[\d.]+\s*배?\s*(?:→|->|⇒)\s*)?([\d.]+)\s*배\s*\)/;
  function helpBase(m) {
    let v = 1.5;
    try {
      if (!m) return v;
      for (const o of Object.values((ctx().b || {}).mons || {})) {
        if (!o || o.id === m.id || o.side !== m.side || !o.entry || !(o.hp && o.hp.cur > 0)) continue;
        for (const p of potSrc(o)) {
          const x = String((p && p.eff) || '').match(HELP_UP_RE);
          if (x && potLive(o, p) && +x[1] > v) v = +x[1];
        }
      }
    } catch (e) {}
    return v;
  }
  const helpMul = m => {
    const hb = helpBase(m);
    return m && (m.states || {}).HelpingHand ? Math.round(Math.pow(hb, Math.max(1, +m.helpN || 1)) * 10000) / 10000 : hb;
  };
  const wxSame = (x, W) => x === W || (x === '눈' && W === '싸라기눈') || (x === '싸라기눈' && W === '눈');
  /* 11-07 망령 「날씨 부정 자동화」: 특성 「에어록」 · 「날씨부정」 — 필드 위에 있는 한 「날씨」의 효과를 제거한다.
    날씨 자체(종류 · 턴 수)는 그대로 두고 칩에 「무효」만 붙인다. 효과를 읽는 곳(배율 · 방어 · 스피드 · 차지 · 타입 · 턴 끝 모래바람 · 얼음/잠듦 막기)은 wxNow(b) 로 읽는다 */
  /* 11-07 망령 「맹세 3종 본가 느낌으로」: 같은 편 두 마리가 같은 턴에 서로 다른 맹세를 고르면 —
    먼저 차례가 온 쪽은 「기다린다」(공격 없음) → 짝의 차례를 바로 다음으로 당긴다(b.pledgeW) → 짝이 위력 150 · 조합 타입으로 한 번 치고 장판 4턴(깔린 턴 포함).
    불꽃+풀 = 불꽃 · 적진 「불바다」 / 물+불꽃 = 물 · 자진 「무지개」 / 풀+물 = 풀 · 적진 「습원」. 무지개는 추가 효과 확률 ×2 (하늘의은총과 겹치지 않는다) */
  const PLEDGE = { 풀의맹세: 'Grass', 불꽃의맹세: 'Fire', 물의맹세: 'Water' };
  const plNm = x =>
    String((x && x.name) || x || '')
      .replace(/『|』/g, '')
      .trim();
  function plCombo(a, c) {
    const s = new Set([PLEDGE[a], PLEDGE[c]]);
    if (s.has('Fire') && s.has('Grass')) return { ty: 'Fire', o: '불바다', who: 'enemy' };
    if (s.has('Fire') && s.has('Water')) return { ty: 'Water', o: '무지개', who: 'self' };
    if (s.has('Grass') && s.has('Water')) return { ty: 'Grass', o: '습원', who: 'enemy' };
    return null;
  }
  /* 지금 쓰는 맹세가 합체의 두 번째(짝이 기다리고 있다)면 {ty,o,who,by,mv} */
  function plSecond(b, atk, mv) {
    const n = plNm(mv);
    if (!PLEDGE[n] || !b) return null;
    const W = b.pledgeW;
    if (!W || +W.turn !== (+b.turn || 0) || W.by === atk.id || W.side !== atk.side || W.mv === n) return null;
    if (W.for && W.for !== atk.id) return null;
    const C = plCombo(W.mv, n);
    return C ? Object.assign({ by: W.by, mv: W.mv }, C) : null;
  }
  /* 지금 쓰는 맹세가 첫 번째: 같은 편 · 필드 위 · 아직 차례가 안 온 아군이 다른 맹세를 골라 두었으면 그 아군 */
  function plPartner(b, atk, mv) {
    const n = plNm(mv);
    if (!PLEDGE[n] || !b || plSecond(b, atk, mv)) return null;
    const O = b.order || [];
    const cur = +b.orderIdx || 0;
    for (const m of Object.values(b.mons || {})) {
      if (!m || m.id === atk.id || m.side !== atk.side || !m.entry || !(m.hp && m.hp.cur > 0)) continue;
      const px = (((b.cmds || {})[m.tid] || {}).mons || {})[m.id];
      if (!px || px.move === '' || px.move == null || px.move === 'switch') continue;
      const pm = MVS(m)[+px.move];
      const pn = plNm(pm);
      if (!PLEDGE[pn] || pn === n) continue;
      const oi = O.findIndex(o => o.mid === m.id);
      if (O.length && (oi < 0 || oi <= cur)) continue;
      return { m, mv: pn, oi };
    }
    return null;
  }
  function rainbowOn(atk) {
    let b = null;
    try {
      b = ctx().b;
    } catch (e) {}
    return !!(b && atk && atk.side && +(((fieldOf(b).objects || {})[atk.side] || {})['무지개'] || 0) > 0);
  }
  function wxNeg(b) {
    return (
      Object.values((b && b.mons) || {}).find(m => m && m.entry && m.hp && m.hp.cur > 0 && /에어록|날씨부정/.test(String(m.ability || ''))) || null
    );
  }
  function wxNow(b) {
    const W = String(((fieldOf(b || {}) || {}).weather || {}).type || '');
    return W && !wxNeg(b) ? W : '';
  }
  const wxIn = (s, W) => {
    const re = /「날씨\s*:\s*([^」]+)」/g;
    let r;
    while ((r = re.exec(s))) if (r[1].split(/[,，/]\s*/).some(x => wxSame(x.trim(), W))) return true;
    return false;
  };
  function wxLinks(b, W) {
    if (!W || !b || !b.mons) return [];
    const G = new Map(),
      add = (k, v) => {
        if (!G.has(k)) G.set(k, []);
        const a = G.get(k);
        if (!a.includes(v)) a.push(v);
      };
    for (const m of Object.values(b.mons)) {
      if (!m || !m.name) continue;
      const who = String(m.name);
      for (const mv of m.moves || []) {
        if (!mv || !mv.name) continue;
        const e = String(mv.eff || '');
        const nm = `${who} 「${mv.name}」`;
        for (const sen of e.split(/(?<=\.)\s*/)) {
          if (!wxIn(sen, W)) {
            if (/「날씨」(?:가 전개되어 있을 때|와 같은)/.test(sen)) add('날씨 연동', nm);
            continue;
          }
          const ac = sen.match(/「명중\s*:\s*(\d+)」/);
          if (/「필중기」/.test(sen)) add('필중', nm);
          else if (ac) add('명중 ' + ac[1], nm);
          else if (/「차지」를 생략/.test(sen)) add('차지 없이 바로', nm);
          else if (/위력을 반감/.test(sen)) add('위력 반감', nm);
          else if (/회복량이 강화\(([^)]*)\)/.test(sen)) add('회복 ' + sen.match(/회복량이 강화\(([^)]*)\)/)[1], nm);
          else if (/회복량이 저하\(([^)]*)\)/.test(sen)) add('회복 ' + sen.match(/회복량이 저하\(([^)]*)\)/)[1], nm);
          else add('효과', nm);
        }
      }
      for (const [an, ae] of [[m.ability, m.abilityEff], ...potSrc(m).map(p => [p.name, p.eff])]) {
        if (an && wxIn(String(ae || ''), W)) add('특성 · 포텐셜', `${who} 「${an}」`);
      }
    }
    const ORD = ['필중', '명중 50', '차지 없이 바로', '위력 반감', '특성 · 포텐셜'];
    const ks = [...G.keys()].sort((a, c) => (ORD.indexOf(a) + 1 || 9) - (ORD.indexOf(c) + 1 || 9));
    return ks
      .map(k => {
        const v = G.get(k);
        return `이 배틀 · ${k}: ${v.slice(0, 4).join(' · ')}${v.length > 4 ? ` 외 ${v.length - 4}` : ''}`;
      })
      .slice(0, 6);
  }
  /* 앞(a) 뒤(z) 필드 → [{k:w|t|r|e|o, n, c(턴 · 겹), side, prev(바뀐 날씨 · 필드), re(갱신), end(걷힘)}] — 턴 종료에 줄기만 한 것은 넣지 않는다 */
  function fieldDiff(a, z) {
    const F0 = fieldOf({ field: a }),
      F1 = fieldOf({ field: z });
    const out = [];
    for (const [k, g] of [
      ['w', 'weather'],
      ['t', 'terrain']
    ]) {
      const p = F0[g] || {},
        q = F1[g] || {};
      const c0 = +p.count || 0,
        c1 = +q.count || 0;
      if (q.type && (q.type !== p.type || c1 > c0))
        out.push({ k, n: q.type, c: c1, prev: q.type !== p.type ? p.type || '' : '', re: q.type === p.type ? 1 : 0 });
      else if (p.type && !q.type) out.push({ k, n: p.type, end: 1 });
    }
    const cmp = (k, o0, o1, side) => {
      o0 = o0 || {};
      o1 = o1 || {};
      for (const n of new Set([...Object.keys(o0), ...Object.keys(o1)])) {
        const v0 = +o0[n] || 0,
          v1 = +o1[n] || 0;
        const sd = side ? { side } : {};
        if (v1 > 0 && v1 > v0) out.push(Object.assign({ k, n, c: v1, re: v0 > 0 ? 1 : 0 }, sd));
        else if (v0 > 0 && v1 <= 0) out.push(Object.assign({ k, n, end: 1 }, sd));
      }
    };
    cmp('r', F0.rooms, F1.rooms);
    cmp('e', F0.etc, F1.etc);
    for (const s of SIDES) cmp('o', (F0.objects || {})[s], (F1.objects || {})[s], s);
    return out;
  }
  /* by = {n: 누가, s: 무엇으로(기술 · 특성 …), img}. ms 뒤에 남긴다 (saveBattle 은 부른 쪽의 【특성】 · 【전달】 카드가 먼저 오르게). 돌려줌: 카드 수 */
  function fieldLog(a, z, by, b, ms) {
    const D = fieldDiff(a, z);
    if (!D.length) return 0;
    const B0 = b || ctx().b;
    const rows = D.map(x => {
      const I = x.end ? { L: [], note: '' } : fcInfo(x, B0);
      const col = FC_COL[x.n] || (x.k === 'o' ? FC_COL[objCat(x.n)[0]] : '') || '#777';
      const who = by && by.n && !x.end ? by : null;
      const fc = Object.assign(
        {},
        x,
        { L: I.L, note: I.note, col },
        who ? { by: { n: String(who.n), s: String(who.s || ''), img: String(who.img || '') } } : {}
      );
      const head = `【${FC_KIND[x.k]}】 ${x.side ? SIDE_KO[x.side] + ' ' : ''}${x.n} — ${x.end ? fcEnd(x) : fcDur(x)}`;
      return [
        x.end
          ? head
          : [
              head,
              ...(x.prev ? [`「${x.prev}」에서 바뀜`] : []),
              ...I.L,
              ...(who ? [`전개: ${who.n}${who.s ? ' 『' + who.s + '』' : ''}`] : [])
            ].join('\n'),
        fc
      ];
    });
    setTimeout(async () => {
      for (const [t, fc] of rows) await A().sysLog(t, 'battle', { fc });
    }, ms || 0);
    return rows.length;
  }
  /* 로그 카드: 왼쪽 그림(날씨 · 필드 · 룸 그림, 설치물은 색 칸 + 기호) · 이름 · 남은 턴(압정 · 독압정은 겹 점) · 효과 줄 · 전개한 쪽 */
  function fieldCard(d) {
    const x = d && d.fc;
    if (!x || !x.n) return '';
    const col = /^#[0-9a-f]{6}$/i.test(String(x.col || '')) ? x.col : '#777777';
    const lum = (i => [1, 3, 5].map(j => parseInt(col.substr(j, 2), 16) / 255).reduce((a, v, j) => a + v * [0.299, 0.587, 0.114][j], 0))();
    const tf = lum > 0.62 ? '#111' : '#fff';
    /* 밝은 색(눈 · 일렉트릭필드)은 꼬리표 글자를 검게 */ const k = FC_KIND[x.k] ? x.k : 't';
    const side = SIDES.includes(x.side) ? x.side : '';
    const im = k === 'w' ? fimg(W_IMG[x.n]) : k === 'o' ? OBJ_IMG[x.n] || '' : fimg(T_IMG[x.n]);
    const th = `<span class="fcth${im ? (k === 'o' ? ' ico' : '') : ' gly'}"${im ? ` style="background-image:url('${cssu(im)}')"` : ''}>${im ? '' : `<i>${esc(FC_GLY[k === 'o' ? objCat(x.n)[0] : 'etc'] || '◆')}</i>`}</span>`;
    const head = `<span class="bctag">${esc(FC_KIND[k])}</span>${side ? `<span class="fcside ${side}">${esc(SIDE_KO[side])}</span>` : ''}<b>${esc(x.n)}</b>`;
    if (x.end)
      return `<div class="bcard fcard end" style="--tc:${col};--tf:${tf}">${th}<div class="fcm"><div class="fch">${head}<span class="sp"></span><span class="fcend">${fcEnd({ k, n: x.n })}</span></div></div></div>`;
    const c = Math.max(0, Math.min(9999, +x.c || 0)),
      mx = k === 'o' ? FC_LAY[x.n] || 0 : 0;
    const dur = mx
      ? `<span class="fcd lay" title="${Math.max(1, c)}겹">${Array.from({ length: mx }, (_, i) => `<i class="${i < Math.max(1, c) ? 'on' : ''}"></i>`).join('')}<small>${Math.max(1, c)}겹</small></span>`
      : `<span class="fcd">${esc(fcDur({ k, n: x.n, c }))}</span>`;
    const sub = [x.re ? (mx ? '겹 추가' : '갱신') : '', x.prev ? `「${x.prev}」에서 바뀜` : '', x.note || ''].filter(Boolean).map(String);
    const L = (Array.isArray(x.L) ? x.L : []).map(String);
    const by =
      x.by && x.by.n
        ? `<div class="fcby"><span class="fcbl">전개</span>${x.by.img ? `<span class="fcbav" style="background-image:url('${cssu(x.by.img)}')"></span>` : ''}<span>${esc(x.by.n)}${x.by.s ? ` 『${esc(x.by.s)}』` : ''}</span></div>`
        : '';
    return `<div class="bcard fcard" style="--tc:${col};--tf:${tf}">${th}<div class="fcm"><div class="fch">${head}<span class="sp"></span>${dur}</div>${sub.length ? `<div class="fcsub">${sub.map(esc).join(' · ')}</div>` : ''}${L.length ? `<div class="fcl">${L.map(l => `<div>${esc(l)}</div>`).join('')}</div>` : ''}${by}</div></div>`;
  }

  /* ---------- 11-01 망령 「상태 변화도 효과 로그」 ----------
    필드 전개 카드(fieldLog)와 같은 길: 쓰기 전후 포켓몬의 states 를 견주어(stDiff) 새로 걸린 상태마다 카드 한 장(data.sc)을 배틀 로그에, 풀리면 작은 「풀림」 카드.
    한 번의 쓰기에서 한 포켓몬에게 여럿이 걸리면 한 장에 줄로 모은다. 숨김 상태(DB hidden) · DB 에 없는 내부 상태는 넣지 않고, 쓰러짐 · 필드를 떠나며 풀린 것 · 한 번짜리(풀죽음 등) 풀림은 적지 않는다.
    글(data.t)에는 설명을 넣지 않는다 — 효과음 자동(rp_ui)이 「풀이 죽어 …」 같은 설명 글에 반응하지 않게. 설명은 카드(statusCard)에서 상태 DB desc 로 */
  const ST_COL = {
    Burn: '#e0562a',
    Poison: '#9a62c0',
    Toxic: '#7b3fa8',
    Paralysis: '#e2b81c',
    Freeze: '#5fc4e0',
    Sleep: '#7a86c0',
    Comatose: '#7a86c0'
  };
  const STG_COL = {
    '상태 이상': '#c8362b',
    '피해 증가': '#e07a2a',
    '자신': '#3f9f8a',
    '행동 방해': '#d68a4f',
    '멘탈 효과': '#d65fa0',
    '교대 관련': '#5f86b8',
    '비례 대미지': '#8a5a9a',
    '기술 타입 변화': '#4f8ad6',
    '지연 발생': '#8a8f5a',
    '필중': '#c0a03a',
    '미래예지': '#6a5cc4',
    '내성 변화': '#6f8fa8'
  };
  function stMeta(k) {
    const D = DB().states || {};
    const d = (D.st || {})[k];
    if (!d || (D.hidden || []).includes(k)) return null;
    const g = ((D.groups || []).find(x => (x.s || []).includes(k)) || {}).l || '';
    return { k, ko: d.ko || k, abn: !!d.abn, g, prog: d.prog || '', col: ST_COL[k] || STG_COL[g] || '#6f8fa8' };
  }
  /* 앞(m0) 뒤(m1) 한 포켓몬 → {add:[{k,ko,g,abn,c}], off:[{k,ko}]} */
  function stDiff(m0, m1) {
    const out = { add: [], off: [] };
    if (!m0 || !m1) return out;
    const a = m0.states || {},
      z = m1.states || {};
    const dead = !(m1.hp && m1.hp.cur > 0),
      left = !!m0.entry && !m1.entry;
    for (const k in z) {
      if (!z[k] || a[k] || dead) continue;
      const x = stMeta(k);
      if (x) out.add.push(Object.assign(x, { c: +z[k] || 0 }));
    }
    for (const k in a) {
      if (!a[k] || z[k] || dead || left) continue;
      const x = stMeta(k);
      if (x && x.prog !== 'once') out.off.push(x);
    }
    return out;
  }
  /* 카드 줄 만들기 — 돌려줌: [글, data.sc] 또는 null */
  function stRow(m0, m1, by) {
    const D = stDiff(m0, m1);
    if (!D.add.length && !D.off.length) return null;
    fixStDesc();
    const S0 = (DB().states || {}).st || {};
    const one = D.add.length === 1;
    const add = D.add.map(x => ({
      k: x.k,
      ko: x.ko,
      g: x.g,
      abn: x.abn ? 1 : 0,
      c: x.c,
      col: x.col,
      L: (S0[x.k].desc || [])
        .map(t =>
          String(t)
            .replace(/<[^>]+>/g, '')
            .trim()
        )
        .filter(Boolean)
        .slice(0, one ? 3 : 1)
        .map(t => (t.length > 80 ? t.slice(0, 78) + '…' : t))
    }));
    const off = D.off.map(x => ({ k: x.k, ko: x.ko }));
    const who = by && by.n && add.length ? { n: String(by.n), s: String(by.s || ''), img: String(by.img || '') } : null;
    const tag = add.length ? (add.some(x => x.abn) ? '상태 이상' : '상태 변화') : '상태 회복';
    const at = m1.entry ? `${SIDE_KO[m1.side] || ''} ${String(m1.entry).toUpperCase()}`.trim() : '';
    const sc = {
      mid: m1.id || '',
      n: m1.name || '',
      img: m1.image || '',
      side: m1.side || '',
      at,
      add,
      off,
      col: add.length ? add[0].col : '#6f8fa8'
    };
    if (who) sc.by = who;
    const dur = (c, k) =>
      k === 'Stockpile' ? '카운터 ' + (+c >= 1000 ? 1 : +c) : !c || c >= 1000 ? '계속' : c + '턴'; /* 11-27 비축 카운터는 턴이 아니라 수 */
    const t = [
      `【${tag}】 ${m1.name}${at ? ' (' + at + ')' : ''}`,
      ...add.map(x => `「${x.ko}」 ${x.g || ''}${x.g ? ' · ' : ''}${dur(x.c, x.k)}`),
      ...(off.length ? [`${off.map(x => '「' + x.ko + '」').join(' ')} 풀림`] : []),
      ...(who ? [`원인: ${who.n}${who.s ? ' 『' + who.s + '』' : ''}`] : [])
    ].join('\n');
    return [t, sc];
  }
  /* 한 포켓몬 (상세 창 · 랭크·상태 창) */
  function stLog(m0, m1, by, ms) {
    const r = stRow(m0, m1, by);
    if (!r) return 0;
    setTimeout(() => A().sysLog(r[0], 'battle', { sc: r[1] }), ms || 0);
    return 1;
  }
  /* 배틀 전체 (saveBattle) — 포켓몬마다 한 장 */
  function stLogAll(b0, b1, by, ms) {
    const M0 = (b0 || {}).mons || {},
      M1 = (b1 || {}).mons || {};
    const rows = [];
    for (const id in M1) {
      const r = stRow(M0[id], M1[id], by);
      if (r) rows.push(r);
    }
    if (!rows.length) return 0;
    setTimeout(async () => {
      for (const [t, sc] of rows) await A().sysLog(t, 'battle', { sc });
    }, ms || 0);
    return rows.length;
  }
  function statusCard(d) {
    const x = d && d.sc;
    if (!x || !x.n) return '';
    const hex = v => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? v : '#6f8fa8');
    const col = hex(x.col);
    const tf =
      [1, 3, 5].map(j => parseInt(col.substr(j, 2), 16) / 255).reduce((a, v, j) => a + v * [0.299, 0.587, 0.114][j], 0) > 0.62 ? '#111' : '#fff';
    const add = Array.isArray(x.add) ? x.add : [],
      off = Array.isArray(x.off) ? x.off : [];
    const side = SIDES.includes(x.side) ? x.side : '';
    const ic = k => {
      const u = simg(k);
      return `<span class="scic"${u ? ` style="background-image:url('${cssu(u)}')"` : ''}></span>`;
    };
    const head = `${x.img ? `<span class="bcav" style="background-image:url('${cssu(x.img)}')"></span>` : ''}<span class="bctag">${esc(add.length ? (add.some(a => a.abn) ? '상태 이상' : '상태 변화') : '상태 회복')}</span><b>${esc(x.n)}</b>${x.at ? `<span class="fcside ${side}">${esc(x.at)}</span>` : ''}`;
    const offL = off.length
      ? `<div class="scoff">${add.length ? '<span class="scofl">풀림</span>' : ''}${off.map(o => `<span class="scoffi">${ic(o.k)}<s>${esc(o.ko)}</s></span>`).join('')}${add.length ? '' : '<span class="fcend">풀림</span>'}</div>`
      : '';
    if (!add.length)
      return `<div class="bcard scard end" style="--tc:${col};--tf:${tf}"><div class="fch">${head}<span class="sp"></span>${offL}</div></div>`;
    const dur = (c, k) => (k === 'Stockpile' ? '카운터 ' + (+c >= 1000 ? 1 : +c) : !+c || +c >= 1000 ? '계속' : +c + '턴');
    const rows = add
      .map(
        a =>
          `<div class="scr" style="--sc:${hex(a.col)}">${ic(a.k)}<div class="scm"><div class="sct"><b>「${esc(a.ko)}」</b>${a.g && a.g !== '상태 이상' ? `<span class="scg">${esc(a.g)}</span>` : ''}<span class="sp"></span><span class="fcd">${esc(dur(a.c, a.k))}</span></div>${(Array.isArray(a.L) ? a.L : []).map(l => `<div class="scd">${esc(l)}</div>`).join('')}</div></div>`
      )
      .join('');
    const by =
      x.by && x.by.n
        ? `<div class="fcby"><span class="fcbl">원인</span>${x.by.img ? `<span class="fcbav" style="background-image:url('${cssu(x.by.img)}')"></span>` : ''}<span>${esc(x.by.n)}${x.by.s ? ` 『${esc(x.by.s)}』` : ''}</span></div>`
        : '';
    return `<div class="bcard scard" style="--tc:${col};--tf:${tf}"><div class="fch">${head}</div><div class="scb">${rows}</div>${off.length ? `<div class="scfoot">${offL}</div>` : ''}${by}</div>`;
  }

  /* ---------- 필드 (GM) ---------- */
  const fcMan = s => ({
    n: ctx().gm ? 'GM' : A().ST.name || '',
    s
  }); /* 11-01 망령: 창에서 손으로 깐 것 — 전개 카드엔 「GM 『필드 설정』」 · 카드가 하나라도 오르면 예전 한 줄 요약은 남기지 않는다 */
  function openField() {
    const c = ctx();
    if (!c.mgr) return;
    const f = fieldOf(c.b);
    const pic = n => {
      const im = fimg(n);
      return im ? `<img src="${esc(im)}" alt="">` : '<span class="fnoimg"></span>';
    };
    const one = (id, list, imgs, cur, cnt, kind) => `<div class="row fpick ${kind}" data-fp="${id}">${list
      .filter(Boolean)
      .map(w => `<span class="fchip ${kind} ${cur === w ? 'on' : ''}" data-fv="${esc(w)}" title="${esc(w)}">${pic(imgs[w])}<b>${esc(w)}</b></span>`)
      .join('')}<span class="fchip none ${cur ? '' : 'on'}" data-fv="" title="없음"><b>없음</b></span></div>
   <div class="row small" style="margin-top:4px"><span class="dim">남은 턴</span><input type="number" class="n" id="${id}c" value="${cnt || ''}" placeholder="턴" ${cur ? '' : 'disabled'}><span class="dim">(비우면 계속)</span></div>`;
    const md = A()
      .openModal(`<div class="mhead"><h2>날씨 · 필드 · 룸 · 설치기</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="sec">날씨 <span class="note">하나만 · 누르면 바뀐다</span></div>${one('fw', WEATHER, W_IMG, f.weather.type, f.weather.count, 'w')}
   <div class="sec">필드 <span class="note">하나만 · 깔린 필드를 다시 누르면 걷힌다</span></div>${one('ft', TERRAIN, T_IMG, f.terrain.type, f.terrain.count, 't')}
   <div class="sec">룸 · 필드의 상태 <span class="note">여러 개 가능 · 누르면 기본 5턴, 숫자는 남은 턴 (1000 = 계속)</span></div>
   <div class="row" style="flex-wrap:wrap;gap:6px">${[...ROOMS.map(r => ['rooms', r, 'r']), ...ETC.map(r => ['etc', r, 'e'])].map(([g, r, k]) => `<span class="fchip ${k} tog ${(f[g] || {})[r] > 0 ? 'on' : ''}" data-fg="${g}" data-fk="${esc(r)}">${pic(T_IMG[r])}<b>${esc(r)}</b><input type="number" class="n xs" data-fgv="${g}" data-fk="${esc(r)}" value="${(f[g] || {})[r] || ''}" placeholder="0"></span>`).join('')}</div>
   <div class="small dim" style="margin-top:8px">설치기는 무대의 「좌측 설치물」「우측 설치물」을 눌러서 놓는다.</div>
   <div class="row" style="margin-top:12px"><button class="btn ghost" id="fclear">전부 걷기</button><span class="sp"></span><button class="btn pri" id="fsave">적용</button></div>`);
    const pickOf = id => {
      const on = md.querySelector(`[data-fp="${id}"] .fchip.on`);
      return on ? on.dataset.fv : '';
    };
    /* 10-21 망령: 필드는 갱신할 일이 거의 없다 — 깔린 필드를 다시 누르면 「없음」으로 (날씨는 그대로 바꾸기) */
    md.querySelectorAll('[data-fp]').forEach(g =>
      g.querySelectorAll('.fchip').forEach(
        ch =>
          (ch.onclick = () => {
            const off = g.dataset.fp === 'ft' && ch.dataset.fv && ch.classList.contains('on');
            g.querySelectorAll('.fchip').forEach(x => x.classList.remove('on'));
            if (off) {
              ch = g.querySelector('.fchip.none');
            }
            ch.classList.add('on');
            const inp = $('#' + g.dataset.fp + 'c', md);
            inp.disabled = !ch.dataset.fv;
            if (!ch.dataset.fv) inp.value = '';
          })
      )
    );
    md.querySelectorAll('.fchip.tog').forEach(ch =>
      ch.addEventListener('click', e => {
        if (e.target.tagName === 'INPUT') return;
        const inp = ch.querySelector('input');
        if (+inp.value > 0) {
          inp.value = '';
          ch.classList.remove('on');
        } else {
          inp.value = 5;
          ch.classList.add('on');
        }
      })
    );
    md.querySelectorAll('[data-fgv]').forEach(i => i.addEventListener('input', () => i.closest('.fchip').classList.toggle('on', +i.value > 0)));
    $('#fclear', md).onclick = () => {
      md.querySelectorAll('[data-fp]').forEach(g => {
        g.querySelectorAll('.fchip').forEach(x => x.classList.toggle('on', !x.dataset.fv));
        const inp = $('#' + g.dataset.fp + 'c', md);
        inp.value = '';
        inp.disabled = true;
      });
      md.querySelectorAll('.fchip.tog').forEach(ch => {
        ch.querySelector('input').value = '';
        ch.classList.remove('on');
      });
    };
    $('#fsave', md).onclick = async () => {
      const wt = pickOf('fw'),
        tt = pickOf('ft');
      const cnt = id => {
        const v = $('#' + id + 'c', md).value.trim();
        return +v || 0;
      };
      const nf = {
        weather: { type: wt, count: wt ? cnt('fw') : 0 },
        terrain: { type: tt, count: tt ? cnt('ft') : 0 },
        rooms: {},
        etc: {},
        objects: {}
      };
      md.querySelectorAll('[data-fgv]').forEach(i => {
        if (+i.value > 0) nf[i.dataset.fgv][i.dataset.fk] = +i.value;
      });
      nf.objects = JSON.parse(JSON.stringify(f.objects || { left: {}, right: {} }));
      if (f.stage) nf.stage = f.stage;
      const tl = v => (v >= 1000 || !v ? '' : ' ' + v + 'T');
      A().closeModal();
      if ((await A().setDiff(['battle', 'field'], f, nf, 2)) && !fieldLog(f, nf, fcMan('필드 설정'), c.b))
        A().sysLog(
          `필드 갱신: ${[nf.weather.type && '날씨 ' + nf.weather.type + tl(nf.weather.count), nf.terrain.type && nf.terrain.type + tl(nf.terrain.count), ...Object.entries(nf.rooms).map(([k, v]) => k + tl(v)), ...Object.entries(nf.etc).map(([k, v]) => k + tl(v)), ...SIDES.flatMap(s => Object.entries(nf.objects[s] || {}).map(([k, v]) => SIDE_KO[s] + ' ' + k + tl(v)))].filter(Boolean).join(' · ') || '없음'}`,
          'battle'
        );
    };
  }

  /* 진영별 설치기: 분류별 칩, 누르면 기본 지속으로 놓고, 다시 누르면 치운다. 숫자는 겹/턴 */
  function openObjects(side) {
    const c = ctx();
    if (!c.mgr) return;
    const f = fieldOf(c.b);
    const cur = Object.assign({}, (f.objects || {})[side] || {});
    const md = A()
      .openModal(`<div class="mhead"><h2>${SIDE_KO[side]} 설치물</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   ${OBJ_CAT.map(([k, n, dur, desc, list]) => `<div class="sec">${n} <span class="note">${esc(desc)}</span></div><div class="row" style="flex-wrap:wrap;gap:6px">${list.map(o => `<span class="objchip ${k} ${cur[o] > 0 ? 'on' : ''}" data-oc="${esc(o)}" data-dur="${dur}">${OBJ_IMG[o] ? `<img class="oimg" src="${OBJ_IMG[o]}" alt="">` : ''}<b>${esc(o === '와이드가드' ? '와이드가드 (전체기 방어)' : o)}</b><input type="number" class="n xs" data-ov="${esc(o)}" value="${cur[o] > 0 ? cur[o] : ''}" placeholder="${dur >= 1000 ? '∞' : dur}" title="${o === '압정뿌리기' || o === '독압정' ? '겹' : '남은 턴 (1000 = 계속)'}"></span>`).join('')}</div>`).join('')}
   <div class="row" style="margin-top:12px"><button class="btn ghost" id="oclear">전부 치우기</button><span class="sp"></span><button class="btn pri" id="osave">적용</button></div>`);
    md.querySelectorAll('[data-oc]').forEach(ch =>
      ch.addEventListener('click', e => {
        if (e.target.tagName === 'INPUT') return;
        const inp = ch.querySelector('input');
        const o = ch.dataset.oc;
        if (+inp.value > 0) {
          inp.value = '';
          ch.classList.remove('on');
        } else {
          inp.value = o === '압정뿌리기' || o === '독압정' ? 1 : +ch.dataset.dur;
          ch.classList.add('on');
        }
      })
    );
    md.querySelectorAll('[data-ov]').forEach(i => i.addEventListener('input', () => i.closest('.objchip').classList.toggle('on', +i.value > 0)));
    $('#oclear', md).onclick = () => {
      md.querySelectorAll('[data-ov]').forEach(i => {
        i.value = '';
        i.closest('.objchip').classList.remove('on');
      });
    };
    $('#osave', md).onclick = async () => {
      const n = {};
      md.querySelectorAll('[data-ov]').forEach(i => {
        if (+i.value > 0) n[i.dataset.ov] = +i.value;
      });
      A().closeModal();
      const nf = JSON.parse(JSON.stringify(f));
      nf.objects = nf.objects || { left: {}, right: {} };
      nf.objects[side] = n;
      if (
        (await A().setDiff(['battle', 'field', 'objects', side], (f.objects || {})[side] || {}, n, 1)) &&
        !fieldLog(f, nf, fcMan('설치물 설정'), c.b)
      )
        A().sysLog(
          `${SIDE_KO[side]} 설치물: ${
            Object.entries(n)
              .map(([k, v]) => k + (v >= 1000 ? '' : ' ' + v))
              .join(' · ') || '없음'
          }`,
          'battle'
        );
    };
  }
