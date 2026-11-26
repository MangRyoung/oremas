  /* ── 조각 09_form_item_result_edit.js — 폼체인지 · 소지품 소모 · 결과 정리 · 편집 창 ── */
  /* ---------- 폼체인지 · 메가진화 (제작기 시트의 forms). form0 에 원래 모습을 두고 돌아올 때 그대로 되돌린다 ---------- */
  function formSet(m, k) {
    const L = [];
    const f = k >= 0 ? (m.forms || [])[k] : null;
    if (k >= 0 && !f) return L;
    if (!m.form0)
      m.form0 = {
        name: m.name,
        types: m.types,
        typesKo: m.typesKo,
        ability: m.ability,
        abilityEff: m.abilityEff,
        base: m.base,
        ranks: m.ranks,
        stats: m.stats,
        image: m.image,
        pots: JSON.parse(JSON.stringify(m.pots || [])),
        moves: JSON.parse(JSON.stringify(m.moves || [])),
        excl: m.excl ? JSON.parse(JSON.stringify(m.excl)) : null,
        exclX: JSON.parse(JSON.stringify(m.exclX || [])),
        auto: JSON.parse(JSON.stringify(m.auto || {}))
      };
    const o = m.form0;
    const fromName = m.name,
      oldAb = m.ability,
      oldMax = m.hp.max;
    /* 11-26 05:38 망령 「폼체인지 포텐셜에 추천기나 구문 제작」: 폼 포텐셜 · 폼 전용 칸의 구문(제작기 공유 폼 f.pots[i].auto · f.exs[i].auto)을 그 폼일 때만 m.auto 에 얹는다 · 원래 모습이면 form0.auto 로 */
    if (o.auto) {
      const au = JSON.parse(JSON.stringify(o.auto));
      if (f && FX() && FX().parse)
        for (const x of [...(f.pots || []), ...(f.exs || [])]) {
          const d = String((x && x.auto) || '').trim();
          if (!d || !x.name) continue;
          try {
            au[String(x.name).replace(/『|』/g, '')] = { dsl: d, ops: FX().parse(d).ops };
          } catch (e) {}
        }
      m.auto = au;
    }
    if (oldAb && FX()) FX().removeByName(m, oldAb);
    delete m.typesOrig;
    delete m.abilityOrig;
    /* 폼마다 바뀌는 포텐셜 칸 (종족·속별 등): 원래 목록에서 같은 칸(slot)을 갈아 끼운다. 빠지는 포텐셜의 발동 효과는 푼다 */
    const potsBefore = (m.pots || []).map(p => p.name);
    const fp = (f && f.pots) || [];
    const pots = JSON.parse(JSON.stringify(o.pots || []));
    const swapped = [];
    for (const x of fp) {
      const i = pots.findIndex(p => p.slot === x.slot);
      const np = { slot: x.slot, name: x.name, kind: x.kind || '', eff: x.eff || '' };
      if (i >= 0) {
        swapped.push([pots[i].name, x.name]);
        pots[i] = np;
      } else {
        swapped.push(['', x.name]);
        pots.push(np);
      }
    }
    m.pots = pots;
    const potsAfter = pots.map(p => p.name);
    if (FX()) for (const n of potsBefore) if (!potsAfter.includes(n)) FX().removeByName(m, n);
    m.formNewPots = potsAfter.filter(n => !potsBefore.includes(n));
    if (f) {
      m.name = f.name || o.name;
      m.types = f.types || o.types;
      m.typesKo = f.typesKo || o.typesKo;
      if (f.ability) {
        m.ability = f.ability;
        m.abilityEff = f.abilityEff != null ? f.abilityEff : '';
      } else {
        m.ability = o.ability;
        m.abilityEff = o.abilityEff;
      }
      m.base = f.base;
      m.ranks = f.base.map(S().gradeOf);
      m.stats = S().statsOf(f.base, m.iv, m.ev, m.lv);
      m.image = f.image || o.image;
      m.formIdx = k;
    } else {
      for (const x of ['name', 'types', 'typesKo', 'ability', 'abilityEff', 'base', 'ranks', 'stats', 'image']) m[x] = o[x];
      delete m.form0;
      delete m.formIdx;
    }
    /* 11-14 폼 기술: 원래 기술 목록(form0.moves)에서 같은 이름을 갈아 끼우거나 덧붙인다. 원래대로 = 원래 목록. 예전 배틀(form0 에 moves 없음)은 건드리지 않는다 */
    const mvSw = [];
    if (o.moves) {
      const rep = !!(f && f.mvRep);
      const mv = rep ? [] : JSON.parse(JSON.stringify(o.moves));
      if (rep) for (const q of o.moves) if (q && q.name) mvSw.push(['−', q.name]);
      for (const x of (f && f.moves) || []) {
        if (!x || !x.mv) continue;
        const i = x.from && !rep ? mv.findIndex(q => q && q.name === x.from) : -1;
        if (i >= 0) {
          mvSw.push([mv[i].name, x.mv.name]);
          mv[i] = Object.assign({}, x.mv, { half: !!mv[i].half });
        } else {
          mvSw.push(['', x.mv.name]);
          mv.push(Object.assign({}, x.mv));
        }
      }
      m.moves = mv;
    }
    /* 11-14 폼 전용: 원래 전용(form0) + 폼의 전용(exs), exRep 면 원래 것은 빼고. 빠지는 전용의 효과는 푼다. 예전 배틀(form0 에 exclX 없음)은 건드리지 않는다 */
    let exLine = '';
    if (o.exclX) {
      const before = [...(m.excl ? [m.excl.name] : []), ...(m.exclX || []).map(x => x.name)];
      const fe = (f && f.exs) || [];
      const rep2 = !!(f && f.exRep);
      m.excl = rep2 ? null : o.excl ? JSON.parse(JSON.stringify(o.excl)) : null;
      m.exclX = [...(rep2 ? [] : JSON.parse(JSON.stringify(o.exclX))), ...fe.map(x => ({ name: x.name, eff: x.eff || '' }))];
      const after = [...(m.excl ? [m.excl.name] : []), ...m.exclX.map(x => x.name)];
      if (FX()) for (const n of before) if (!after.includes(n)) FX().removeByName(m, n);
      const add = after.filter(n => !before.includes(n)),
        gone = before.filter(n => !after.includes(n));
      exLine = [...gone.map(n => `−「${n}」`), ...add.map(n => `+「${n}」`)].join(' · ');
    }
    const mvLine = mvSw
      .map(([a, b2]) => (a === '−' ? `−「${b2}」` : a ? `「${a}」→「${b2}」` : `+「${b2}」`))
      .join(' · '); /* 11-26 −: 기술 전부 교체로 빠진 기술 */
    const potLine = f
      ? swapped.map(([a, b2]) => (a ? `「${a}」→「${b2}」` : `+「${b2}」`)).join(' · ')
      : m.formNewPots.length
        ? '포텐셜 ' + m.formNewPots.map(n => '「' + n + '」').join('') + ' 복귀'
        : '';
    /* 최대 HP 가 바뀌면 그 차이만큼 지금 HP 도 (지가르데 퍼펙트폼처럼). 쓰러지지는 않는다 */
    m.hp.max = m.stats[0];
    if (m.hp.max !== oldMax) m.hp.cur = Math.max(m.hp.cur > 0 ? 1 : 0, Math.min(m.hp.max, m.hp.cur + (m.hp.max - oldMax)));
    const tk = t =>
      (t || [])
        .filter(x => x && x !== '-')
        .map(x => (S().typeKo ? S().typeKo(x) : x))
        .join('/');
    const sameNm = fromName === m.name; /* 11-26 망령 「지박신을 지박신으로 폼체인지」: 이름 없는 폼(공유 폼 등)은 「A → A」 대신 「A 의 폼체인지」 */
    L.push(
      f
        ? `${sameNm ? m.name + '의' : fromName + ' → 「' + m.name + '」'} ${f.kind || '폼체인지'}!`
        : `${sameNm ? m.name + ' — 원래 모습으로' : fromName + ' → 원래 모습 「' + m.name + '」으로'} 돌아왔다`
    );
    /* 11-26 망령 「폼체인지하면 계제랑 기술이 어떻게 바뀌는지도 다 출력 — 그러면 안 되지」: 포텐셜 · 기술 · 전용 바뀐 것은 공개 로그에 싣지 않고 주인(NPC · 야생이면 GM) 귓속말로 */
    {
      const det = [
        f
          ? `타입 ${tk(m.types)} · 특성 ${m.ability || '-'}${m.hp.max !== oldMax ? ' · 최대 HP ' + oldMax + '→' + m.hp.max : ''}`
          : m.hp.max !== oldMax
            ? '최대 HP ' + oldMax + '→' + m.hp.max
            : '',
        potLine ? (f ? '포텐셜 ' : '') + potLine : '',
        mvLine ? '기술 ' + mvLine : '',
        exLine ? '전용 ' + exLine : ''
      ].filter(Boolean);
      const mid0 = m.id,
        nm0 = m.name,
        kd0 = f ? f.kind || '폼체인지' : '폼 복귀';
      if (det.length)
        setTimeout(() => {
          try {
            A().sysLog(`【${kd0} — 바뀐 것】 ${nm0}\n${det.join('\n')}`, 'battle', { gmPriv: 1, mid: mid0 });
          } catch (e) {}
        }, 700);
    }
    return L;
  }
  /* ---------- 소지품 소모 (맵툴 item_consume): 칸에서 빼고 itemUsed 에 남긴다. 결과 정리 때 시트에서도 뺀다 ---------- */
  /* 10-27 망령: 받는 쪽 특성 — 첫 타 완화(멀티스케일 · 스펙터가드) · 탈 · 맞을 때마다 반응(정전기 · 까칠한피부 · 지구력 · 깨어진갑옷 …). 특성 글(abilityEff, 없으면 특성 DB)을 읽는다 */
  function abNm(m) {
    return String((m && m.ability) || '')
      .replace(/^특성\s*:\s*/, '')
      .trim();
  }
  /* 11-22 망령 「특성 엔진 처리」 — 변환자재 · 리베로: 【보급】/기술을 내보낼 때 그 기술 타입이 된다 (등장당 1번 · 테라스탈 중엔 안 바뀐다). 공격 창 자속은 바뀐 타입으로, 적용 때 타입을 바꾼다 */
  const PROTEAN = ['변환자재', '리베로'];
  function proteanOk(m) {
    const n = abNm(m);
    if (!m || !PROTEAN.includes(n)) return '';
    if (m.teraActive && m.teraEn && m.teraEn !== '-') return '';
    if (((m.potTurn || {})._sup || {})['특성 : ' + n]) return '';
    return n;
  }
  function proteanTys(m, mv) {
    try {
      const n = proteanOk(m);
      if (!n || !mv) return null;
      const t = (mtys(mv) || []).filter(x => x && x !== '-')[0];
      if (!t) return null;
      const cur = (m.types || []).filter(x => x && x !== '-');
      if (cur.length === 1 && cur[0] === t) return null;
      return [t];
    } catch (e) {
      return null;
    }
  }
  /* 필드 위에 살아 있는 포켓몬 중 그 특성 (team: 같은 편 기준 포켓몬 · same true = 같은 편 / false = 상대 편) */
  const moldOn = (atk, mv) => {
    try {
      return (
        (FX() && FX().moldQ ? FX().moldQ(atk, { types: mtys(mv), move: (mv || {}).name || '' }) : spL(atk, 'mold').length > 0) ||
        !!(moveAuto(mv) || {}).mold
      );
    } catch (e) {
      return false;
    }
  }; /* 특성 무시(틀깨기 · 구문 「특성무시」 · 기술 효과) — 【방호】 특성을 지난다 */
  const SIS_ROLL = {};
  function abOnField(b, name, ref, same) {
    return Object.values((b && b.mons) || {}).filter(
      x => x && x.entry && x.hp && x.hp.cur > 0 && abNm(x) === name && (ref == null || (same ? sameT(x, ref, b) : !sameT(x, ref, b)))
    );
  }
  /* 11-09 레디메이드 검토: 특성 「인분」 = 은밀망토처럼 자신이 받는 기술의 추가 효과를 받지 않는다 · 「원격」 = 자신의 공격이 접촉 계기(정전기 · 포자 …)를 일으키지 않는다 */
  function covOf(m) {
    if (!m) return '';
    if (HAS(m, '은밀망토')) return '은밀망토';
    return abNm(m).replace(/『|』|\s/g, '') === '인분' ? '인분' : '';
  }
  function farOf(m) {
    return !!m && abNm(m).replace(/『|』|\s/g, '') === '원격';
  }
  /* 11-23 망령 「특성의 확률 / 배율을 변경하는 포텐셜」: 「(「상성 : 2~8배」인 기술에 대한) 「특성 : X」의 (발동) 확률이 증가(3할→5할)」 · 「「특성 : X」의 배율을 강화(1.33배→1.5배)」 · 「…의 회복량 · 대미지를 강화(1/8→1/6)」.
    abTune(m) = 자기 포텐셜 · 전용 글에서 읽은 목록 [{n:특성, k:'p'|'x'|'f', from, to, se:상성 조건, by:포텐셜 이름}] — 특성 글을 읽는 처리(abTxt)는 숫자를 바꿔 읽고, 레디메이드 구문은 fx autoOf 가 바꾼다 */
  function abTune(m) {
    const out = [];
    try {
      const nq = x => String(x || '').replace(/\s/g, '');
      for (const p of [...((m && m.pots) || []), m && m.excl, ...((m && m.exclX) || [])]) {
        const e = String((p && p.eff) || '');
        if (!/특성\s*:/.test(e) || !/→/.test(e)) continue;
        for (const cl of e.split(/\n|(?=[①-⑳])/)) {
          const q = cl.match(/「특성\s*:\s*([^」]+)」[^(（]*[(（]\s*([\d.\/]+)\s*(할|배|%)?\s*→\s*([\d.\/]+)\s*(할|배|%)?\s*[)）]/);
          if (!q) continue;
          const u = q[3] || q[5] || '';
          out.push({
            n: nq(q[1]),
            k: u === '할' || u === '%' ? 'p' : u === '배' ? 'x' : 'f',
            u,
            from: q[2],
            to: q[4],
            se: /「상성\s*:\s*2\s*(?:배)?\s*~\s*8\s*배」인\s*기술/.test(cl) ? 1 : 0,
            by: p.name
          });
        }
      }
    } catch (e) {}
    return out;
  }
  function abTxt(m) {
    let t = String((m && m.abilityEff) || ((DB().traits || {})[abNm(m)] || {}).multi || '').replace(/<br\s*\/?>/gi, '\n');
    try {
      const me = abNm(m).replace(/『|』|\s/g, '');
      for (const x of abTune(m)) {
        if (x.n !== me || x.se) continue;
        const esc0 = v => String(v).replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
        t = t.replace(new RegExp('(^|[^\\d.\\/])' + esc0(x.from) + (x.u ? esc0(x.u) : '(?![\\d.\\/])'), 'g'), '$1' + x.to + (x.u || ''));
      }
      /* 11-23 발동 조건을 바꾸는 포텐셜: 반드시 발동 · 비접촉기에도 · 상승 능력치 변경 (fx traitMods) */ const tm =
        FX() && FX().traitMods ? FX().traitMods(m, me) : null;
      if (tm) {
        if (tm.sure) t = t.replace(/\d+할(?:의\s*확률)?로/g, '10할로').replace(/드물게|저확률로|중확률로|고확률로/g, '10할로');
        if (tm.nc) t = t.replace(/「접촉기」(?:를|을)\s*받/g, '공격을 받');
        if (tm.swap)
          t = t.replace(
            /「(?:공격|방어|특공|특방|스피드|명중|회피)(?:\/(?:공격|방어|특공|특방|스피드|명중|회피))*\s*:\s*([+\-]\d+)」/,
            (a, n) => '「' + tm.swap.ko + ' : ' + (tm.swap.n != null ? (tm.swap.n > 0 ? '+' : '') + tm.swap.n : n) + '」'
          );
      }
    } catch (e) {}
    return t;
  }
  function hitShield(m, lh) {
    const t = abTxt(m);
    const o = {};
    if (!t || !m || (lh && lh.cat === '변화')) return o;
    if (/「HP : 가득」일 때 기술(?:의|로 받을) 대미지를 반감/.test(t)) o.fullGuard = { v: 0.5, name: abNm(m) };
    const dz = t.match(/기술에 의한 대미지를 「0」으로 만들고 자신의 「HP」를 (\d+\/\d+)만큼 소비/);
    if (dz && !m.dsgUsed) o.disguise = { cost: parseAmt(dz[1], m.hp.max), name: abNm(m) };
    return o;
  }
  /* 공격 창 예상용: 받는 쪽 첫 타 완화 · 탈 (손으로 발동해 이미 완화에 든 것은 빼지 않고 그대로) */
  function hsOpt(def, cat, mods) {
    const sh = hitShield(def, { cat });
    const dup = sh.fullGuard && ((mods && mods.names) || []).some(x => String(x.txt || '').includes(sh.fullGuard.name));
    return { fullGuard: sh.fullGuard && !dup ? sh.fullGuard.v : 0, disguise: sh.disguise ? sh.disguise.cost : 0 };
  }
  const HIT_ST = {
    공격: 'attack',
    방어: 'defense',
    특공: 'specialattack',
    특방: 'specialdefense',
    스피드: 'speed',
    명중: 'accuracy',
    회피: 'evasion'
  };
  function hitRules(m) {
    const t = abTxt(m);
    if (!t) return [];
    const R = [];
    for (const cl of t.split(/(?=[①②③④⑤])|\n/)) {
      const c = cl.trim();
      if (!/받(았을 때|으면)|급소에 맞았을 때/.test(c)) continue;
      if (/반감|무효|「0」|「빈사」 상태가 되지|교대|모든 포켓몬|아군|상대 전체|적진|상태일 때|하고 자신을|「[^」:]+ : \d+\/\d+」/.test(c))
        continue; /* 조건 붙은 것 · 두 쪽에 다른 효과 · 타입 비례는 손으로 */
      const r = {};
      let x;
      if (/「접촉기」를 받/.test(c)) r.contact = 1;
      if ((x = c.match(/「(물리기|특수기)」를 받/))) r.cat = x[1] === '물리기' ? '물리' : '특수';
      if ((x = c.match(/「([^」]+)」 기술을 받/)))
        r.types = x[1]
          .split('/')
          .map(s => S().typeEn(s.trim()))
          .filter(Boolean);
      if (/급소에 맞았을 때/.test(c)) r.crit = 1;
      if (!r.contact && !r.cat && !r.types && !r.crit && !/공격을 받/.test(c)) continue;
      if ((x = c.match(/(\d+)할로/))) r.chance = +x[1] * 10;
      if ((x = c.match(/(\d+)턴 동안/))) r.cnt = +x[1];
      r.to = /자신을 공격한 (?:포켓몬|상대)|대상을|대상에게|그 포켓몬|상대를|상대에게/.test(c) ? 'atk' : 'self';
      if ((x = c.match(/(\d+\/\d+)의 비례 대미지/))) r.back = x[1];
      if ((x = c.match(/「([^」:]+\/[^」:]+)」 중 무작위/))) r.rnd = x[1].split('/');
      else if ((x = c.match(/「([^」:]+)」 상태/)) && FX() && FX().stEn(x[1])) r.state = x[1];
      if ((x = c.match(/「특성 : ([^」]+)」로 만든다/))) r.setTrait = x[1];
      const st = {};
      for (const y of c.matchAll(/「(공격|방어|특공|특방|스피드|명중|회피) : ([+-]\d+)」/g)) st[HIT_ST[y[1]]] = (st[HIT_ST[y[1]]] || 0) + +y[2];
      if (Object.keys(st).length) r.stats = st;
      if (r.back || r.rnd || r.state || r.setTrait || r.stats) R.push(r);
    }
    return R;
  }
  /* 맞은 타마다 특성 반응을 돌린다. r = hpDamageHits 결과(per · landed) — 받는 쪽 화면에서, 공격한 쪽도 함께 고친다 */
  /* 11-09 감우 55: 맞았을 때 반응하는 상태 — 「분노」(상대의 공격 → 공격 +1) · 「폭탄」(접촉기 → 자신 1/4) · 「요격」(공격한 쪽에 받은 대미지의 1/2 반동) · 「먹이물기」(상대의 공격 → 그 상대 1/4 + HP 1/2 이상이면 방어 -1, 미만이면 마비 · 뱉으면 해제) */
  async function stHitReact(mid, lh, r) {
    if (!FX() || !lh || !r || !(r.final > 0) || lh.cat === '변화') return;
    const b0 = snap(),
      b = snap(b0);
    const m = b.mons[mid];
    if (!m) return;
    const st = m.states || {};
    if (!(st.Rage || st.Boom || st.Reflect || st.GulpMissile)) return;
    const atk = b.mons[lh.fromId];
    const foe = !!atk && atk.side !== m.side;
    const L = [];
    const run = async (ops, self) => {
      const res = await FX().run(ops, {
        b,
        self: self || m,
        name: '상태',
        pick: list => list.find(x => atk && x.id === atk.id) || null,
        confirm: async () => true,
        choose: async () => [0]
      });
      L.push(...res.lines);
    };
    const atgt = atk ? (atk.side === m.side ? 'ally1' : 'enemy1') : '';
    if (st.Rage && foe && m.hp.cur > 0) {
      L.push(`${m.name} 「분노」`);
      await run([{ k: 'rank', tgt: 'self', stats: { attack: 1 } }]);
    }
    if (st.Reflect && atk && atk.id !== m.id && atk.hp.cur > 0) {
      const v = Math.max(1, Math.floor(r.final / 2));
      atk.hp.latest = atk.hp.cur;
      atk.hp.cur = Math.max(0, atk.hp.cur - v);
      L.push(`${atk.name} 「요격」 반동 −${v} (받은 대미지 ${r.final}의 1/2) → ${atk.hp.cur}/${atk.hp.max}`);
    }
    if (st.GulpMissile && foe && atk.hp.cur > 0) {
      const v = Math.max(1, Math.floor(atk.hp.max / 4));
      atk.hp.latest = atk.hp.cur;
      atk.hp.cur = Math.max(0, atk.hp.cur - v);
      const pika = m.gulp ? m.gulp === 'pika' : m.hp.cur * 2 < m.hp.max;
      L.push(`${m.name} 「먹이물기」 — ${pika ? '피카츄' : '찌로꼬치'}를 뱉었다 · ${atk.name} −${v} → ${atk.hp.cur}/${atk.hp.max}`);
      delete m.states.GulpMissile;
      delete m.gulp;
      if (atk.hp.cur > 0)
        await run(pika ? [{ k: 'state', state: '마비', tgt: atgt, count: -1, forced: 0 }] : [{ k: 'rank', tgt: atgt, stats: { defense: -1 } }]);
    }
    if (st.Boom && lh.ct && m.hp.cur > 0) {
      const fu = F() && F().hazFracUp ? F().hazFracUp('폭탄', m, Object.values(b.mons || {}), 1, 4) : [1, 4, ''];
      /* 11-26 372 「폭탄」의 비례 대미지를 강화(1/4→1/3) — field.js hazFracUp */ const v = Math.max(1, Math.floor((m.hp.max * fu[0]) / fu[1]));
      m.hp.latest = m.hp.cur;
      m.hp.cur = Math.max(0, m.hp.cur - v);
      delete m.states.Boom;
      L.push(`${m.name} 「폭탄」이 터졌다 (${fu[0]}/${fu[1]}${fu[2] ? ' — ' + fu[2] + ' 강화' : ''}) −${v} → ${m.hp.cur}/${m.hp.max}`);
    }
    if (!L.length) return;
    for (const id in b.mons) {
      const x = b.mons[id];
      if (x.entry && x.hp.cur <= 0) x.entry = '';
    }
    if (await saveBattle(b0, b, undefined, { n: m.name, s: '상태', img: m.image || '' }))
      A().sysLog(`【상태】 ${m.name} — ${lh.from}의 「${lh.move}」을(를) 받았다\n${L.join('\n')}`, 'battle', { mid, img: m.image || '' });
  }
  /* 11-22 망령 「특성 엔진 처리」 — 드래곤스케일: 「HP : 가득」일 때 공격을 받으면 자신을 공격한 포켓몬을 강제 교대 (첫 타 맞기 전 HP 가 가득이었을 때) */
  async function dscaleReact(mid, lh, r) {
    const b = ctx().b;
    const m = (b.mons || {})[mid];
    if (!m || abNm(m) !== '드래곤스케일' || !lh || lh.cat === '변화' || !r) return;
    const p0 = (r.per && r.per[0]) || null;
    const before = p0 ? (+p0.after || 0) + (+p0.final || 0) : (+m.hp.cur || 0) + (+r.final || 0);
    if (before < (+m.hp.max || 0)) return;
    const atk = (b.mons || {})[lh.fromId];
    if (!atk || atk.id === m.id || !atk.entry || !(atk.hp && atk.hp.cur > 0)) return;
    await A().set(['battle', 'mons', mid, 'trFire'], { n: '드래곤스케일', k: Date.now(), opp: atk.id });
    A().sysLog(`【특성】 ${m.name} 「드래곤스케일」 — HP 가득일 때 공격을 받아 ${atk.name}을(를) 강제 교대시킨다`, 'battle', {
      mid,
      img: m.image || ''
    });
    setTimeout(() => forceSwitchFx(atk.id, '특성 : 드래곤스케일').catch(e => console.warn(e)), 300);
  }
  async function abilityHitReact(mid, lh, r) {
    if (!FX() || !lh || !r) return;
    const b0 = snap(),
      b = snap(b0);
    const m = b.mons[mid];
    if (!m) return;
    const R = hitRules(m);
    if (!R.length) return;
    const n = r.per && r.per.length ? r.landed : r.final > 0 ? 1 : 0;
    if (!n) return;
    const per = r.per && r.per.length ? r.per : [{ after: m.hp.cur }];
    const crits = lh.perCrit || [];
    const name = '특성 : ' + abNm(m);
    const L = [];
    let fired = false;
    for (let k = 0; k < n; k++) {
      const pre = n > 1 ? k + 1 + '타 · ' : '';
      const atk = b.mons[lh.fromId];
      for (const ru of R) {
        if (ru.contact && !lh.ct) continue;
        if (ru.cat && ru.cat !== lh.cat) continue;
        if (ru.types && !ru.types.some(t => (lh.mt || []).includes(t))) continue;
        if (ru.crit && !(crits[k] || (!crits.length && lh.crit && k === 0))) continue;
        if (ru.to === 'self' && !((per[k] || {}).after > 0)) continue;
        const tg = ru.to === 'atk' ? atk : m;
        if (!tg || tg.hp.cur <= 0) continue;
        if (ru.setTrait && abNm(tg) === ru.setTrait) continue;
        let roll = '';
        if (ru.chance) {
          const rl = 1 + Math.floor(Math.random() * 100);
          if (rl > ru.chance) {
            L.push(`${pre}${tg.name} 「${name}」 실패 (${rl}/${ru.chance})`);
            continue;
          }
          roll = ` (${rl}/${ru.chance})`;
        }
        const tgt = tg.id === m.id ? 'self' : tg.side === m.side ? 'ally1' : 'enemy1';
        const ops = [];
        if (ru.back) ops.push({ k: 'dmg', tgt, value: ru.back, basis: 'max' });
        const stn = ru.rnd ? ru.rnd[Math.floor(Math.random() * ru.rnd.length)] : ru.state;
        if (stn) ops.push({ k: 'state', state: stn, tgt, count: ru.cnt || -1, forced: 0 });
        if (ru.stats) ops.push({ k: 'rank', tgt, stats: ru.stats });
        if (ops.length) {
          fired = true;
          const res = await FX().run(ops, {
            b,
            self: m,
            name,
            pick: list => list.find(x => x.id === tg.id) || null,
            confirm: async () => true,
            choose: async () => [0]
          });
          L.push(...res.lines.map(x => pre + String(x).replace(/(」(?: \d+턴)?) — .*$/, '$1') + roll)); /* 상태 설명 글은 줄인다 */
        }
        if (ru.setTrait) {
          fired = true;
          if (FX().setAb) FX().setAb(tg, ru.setTrait, name);
          else {
            if (tg.abilityOrig == null) tg.abilityOrig = tg.ability || '';
            tg.abilityBy = name;
            tg.ability = ru.setTrait;
            tg.abilityEff = ((DB().traits || {})[ru.setTrait] || {}).multi || '';
          }
          L.push(`${pre}${tg.name} 특성 → 「${ru.setTrait}」${roll}`);
        }
      }
    }
    if (!L.length) return;
    for (const id in b.mons) {
      const x = b.mons[id];
      if (x.entry && x.hp.cur <= 0) x.entry = '';
    }
    if (fired) m.trFire = { n: abNm(m), k: Date.now(), opp: lh.fromId || '' }; /* 11-22 특성 발동 계기 (trWatch) */
    if (await saveBattle(b0, b, undefined, { n: m.name, s: abNm(m), img: m.image || '' }))
      A().sysLog(`【특성】 ${m.name} 「${abNm(m)}」${n > 1 ? ' · ' + n + '번 맞음' : ''}\n${L.join('\n')}`, 'battle', { mid, img: m.image || '' });
  }
  /* 맞은 뒤 소지품 반응 (약점보험 · 울퉁불퉁멧 · 옐로우카드 · 풍선 · 구근 …): 받는 쪽 화면에서, 공격한 쪽도 함께 고친다 */
  async function itemHitReact(mid, lh, dealt, n) {
    const b0 = snap(),
      b = snap(b0);
    const m = b.mons[mid];
    if (!m) return;
    let L = [];
    try {
      L = OI().onHit(b, m, lh, dealt, n);
    } catch (e) {
      console.warn(e);
      return;
    }
    if (!L.length) return;
    for (const id in b.mons) {
      const x = b.mons[id];
      if (x.entry && x.hp.cur <= 0) x.entry = '';
    }
    if (await saveBattle(b0, b, undefined, { n: m.name, s: (b0.mons[mid] || {}).item || '', img: m.image || '' }))
      A().sysLog(`【소지품】 ${m.name} 『${(b0.mons[mid] || {}).item || ''}』\n${L.join('\n')}`, 'battle', {
        mid,
        img: m.image || '',
        eff: String(
          (
            (DB().items || {})[
              String((b0.mons[mid] || {}).item || '')
                .replace(/『|』/g, '')
                .trim()
            ] || {}
          ).eff || ''
        ).slice(0, 300)
      });
  }
  function sketchPick(mid, k, cur, src) {
    const DU = window.OM_DB_UI,
      IM = window.OM_IMPORT;
    if (!DU || !DU.open || !IM || !IM.move) return;
    A().toast(`『${src}』 — 바꿀 기술을 고르세요 (닫으면 ${cur ? '「' + cur + '」 그대로' : '그대로'})`);
    DU.open({
      kind: 'move',
      sel: cur || '',
      pick: async n => {
        if (!n || n === cur) return;
        const m = (ctx().b.mons || {})[mid];
        if (!m) return;
        const L = (m.moves || []).slice();
        if (!L[k]) return;
        if (L.some((x, i) => i !== k && x && x.name === n)) return A().toast(`이미 「${n}」를 지니고 있다`);
        const nm = IM.move(n, false);
        nm.sketch = src;
        L[k] = nm;
        if (!(await A().set(['battle', 'mons', mid, 'moves'], L))) return;
        A().sysLog(`【스케치】 ${m.name} — 『${n}』${cur ? '(으)로 바꿨다 (「' + cur + '」 대신)' : '를 베꼈다'} (시합 중 유지)`, 'battle', {
          mid,
          img: m.image || ''
        });
      }
    });
  }
  async function itemConsume(mid, undo, want) {
    const m0 = snap(ctx().b.mons[mid]);
    if (!m0) return;
    const x = snap(m0);
    const nI = v =>
      String(v || '')
        .replace(/『|』/g, '')
        .trim();
    /* 11-05 망령: 소지품 2 · 3번 칸도 — want(이름)이 있으면 그 이름을 든 칸을 쓴다 (없으면 1번 칸) */
    if (undo) {
      const u = x.itemUsed;
      if (!u) return;
      const k = +u.k || 0;
      const sl = k ? (x.items2 || [])[k - 1] : x;
      if (!sl || sl.item) return;
      sl.item = u.name;
      sl.itemEff = u.eff || '';
      delete x.itemUsed;
      await saveMon(m0, mid, x);
      return A().sysLog(`${x.name} 「${u.name}」 소모 되돌림`, 'battle');
    }
    let k = 0;
    if (want && nI(x.item) !== nI(want)) {
      const i = (x.items2 || []).findIndex(q => q && nI(q.item) === nI(want));
      if (i >= 0) k = i + 1;
    }
    const sl = k ? x.items2[k - 1] : x;
    if (!sl.item) return;
    const name = sl.item;
    x.itemUsed = { name, eff: sl.itemEff || '', turn: +ctx().b.turn || 0, ...(k ? { k } : {}) };
    if (FX()) FX().removeByName(x, name);
    sl.item = '';
    sl.itemEff = '';
    if (k) delete sl.itemOwn;
    await saveMon(m0, mid, x);
    A().sysLog(`${x.name}의 「${name}」 — 다 써서 없어졌다`, 'battle', { mid, img: x.image || '' });
    /* 11-09 망령 「소지품을 소모했을 때」 계기 — 그 포켓몬의 특성 · 포텐셜 · 고유 중 글에 「소모했을 때 · 소모하면」이 있고 구문이 있는 것, 그리고 펼친 필드의 「소지품 소모 시」 */
    if (ctx().mgr && FX())
      try {
        await autoOnUse(mid, { name });
      } catch (e) {
        console.warn('소지품 소모 계기', e);
      }
    if (ctx().mgr && FX())
      try {
        await evReact('use', { mid, name, key: name + '@' + Date.now() });
      } catch (e) {
        console.warn('evReact use', e);
      }
  }
  async function autoOnUse(mid, used) {
    const c = ctx();
    const m = c.b.mons[mid];
    if (!m) return;
    try {
      if (/열매$/.test(String((used || {}).name || '').trim()) && !m.ateBerry) await A().set(['battle', 'mons', mid, 'ateBerry'], +c.b.turn || 1);
    } catch (e) {}
    /* 11-23 「나무열매를 소모한 상태」(트림) */ const USE = /소모\s*(?:했을\s*때|하면|한\s*(?:때|뒤|후))|다\s*(?:썼을|쓰면)\s*때?/;
    const list = [];
    if (m.ability) list.push(['trait', m.ability]);
    for (const p of potSrc(m)) if (p && p.name && !p.ph) list.push(['pot', p.name]);
    {
      const t = (c.b.trainers || {})[m.tid];
      for (const u of (t && t.unique) || []) if (u && u.name && !list.some(([k, n]) => k === 'pot' && n === u.name)) list.push(['pot', u.name]);
    }
    for (const [kind, name] of list) {
      const a = FX().autoOf(m, kind, name);
      if (!a || !a.ops || !a.ops.length || a.manual) continue;
      const tx = a.text || slotEff(m, kind, name) || '';
      if (!USE.test(tx) && !a.ops.some(o => o && o.k === 'cond' && o.c === 'used_item')) continue;
      if (limManual(m, kind, name, tx)) continue;
      await fireAuto(mid, kind, name, { quiet: true, ctx: { used } });
    }
    await fieldAuto('use', { mid, used });
    await fieldTxtType(mid, 'use', { used });
  }
  /* 다 쓰면 사라지는 소지품: 열매 · 효과 글에 소모/사라진다/한 번 */
  const oneShot = (m, want) => {
    const nI = v =>
      String(v || '')
        .replace(/『|』/g, '')
        .trim();
    const sl = want && nI(m.item) !== nI(want) ? (m.items2 || []).find(q => q && nI(q.item) === nI(want)) || null : m;
    if (!sl) return false;
    const n = nI(sl === m ? IT(m) : sl.item);
    return !!n && (/열매|주얼$|씨$/.test(n) || /소모|사라진다|사라짐|1회|한 번/.test(sl.itemEff || ''));
  };
  /* ---------- 배틀 결과 정리 (맵툴 battle_return): HP·빈사·상태 이상·포텐셜 횟수·쓴 소지품을 시트(로스터)로 ---------- */
  const SHEET_ABN = ['Poison', 'Toxic', 'Burn', 'Paralysis', 'Freeze', 'Sleep'];
  function resultOf(m, rm) {
    const dead = m.hp.cur <= 0 || !!(m.states || {}).Dead;
    const hp = dead ? 0 : Math.min(rm.hp.max, m.form0 ? Math.max(1, Math.round((m.hp.cur / m.hp.max) * rm.hp.max)) : m.hp.cur);
    const st = {};
    for (const k of SHEET_ABN) if ((m.states || {})[k]) st[k] = m.states[k];
    if (dead) st.Dead = 1;
    /* 11-06 소지품 기술: 배틀에서 얻은 소지품(itemGot)은 시트에 없는 것 · 빼앗긴 것(itemTaken)은 시트 그대로. 다 쓴 시트 소지품 기록은 itemUsed0(새 소지품을 받기 전) 이 먼저 */
    const nI = v =>
      String(v || '')
        .replace(/『|』/g, '')
        .trim();
    const got = (m.itemGot || []).map(nI);
    const rec = m.itemUsed0 || (m.itemUsed && !got.includes(nI(m.itemUsed.name)) ? m.itemUsed : null);
    const own = m.item && !got.includes(nI(m.item)) ? m.item : '';
    const moved = [
      ...(m.itemTaken || []).map(
        t =>
          `「${t.name}」 ${{ eat: '먹힘', knock: '떨어짐', steal: '빼앗김', swap: '바뀜', burn: '파괴됨', give: '건넴', set: '바뀜' }[t.how] || '빼앗김'}`
      ),
      ...got.map(n => `「${n}」 얻음${[m, ...(m.items2 || [])].some(x => x && nI(x.item) === n) ? '' : ' (지금은 없음)'}`)
    ].join(' · ');
    return {
      hp,
      dead,
      st,
      uses: Object.assign({}, m.potUses || {}),
      item: own,
      itemEff: own ? m.itemEff || '' : '',
      used: rec && !own ? rec.name : '',
      moved
    };
  }
  function openResult() {
    const c = ctx();
    if (!c.gm) return;
    const b = c.b;
    const R = (A().ST.state.roster || {}).mons || {};
    const stKo = k => (((DB().states || {}).st || {})[k] || {}).ko || k;
    const RID = m => m.rid || m.id; /* 빌려 쓴 파티(다른 좌석이 불러옴)는 배틀 id 가 다르다 — 시트 id 는 rid */
    const mons = Object.values(b.mons || {})
      .filter(m => R[RID(m)])
      .sort((x, y) => String(x.tid).localeCompare(String(y.tid)) || (x.slot || 0) - (y.slot || 0));
    const UNDO = A().ST.state.resultUndo;
    if (!mons.length && !(UNDO && UNDO.ops)) return A().toast('시트(로스터)에서 불러온 포켓몬이 없다');
    const rows = mons.map(m => {
      const rm = R[RID(m)];
      const r = resultOf(m, rm);
      const t = b.trainers[m.tid] || {};
      const hp0 = rm.sheetHp == null ? rm.hp.max : rm.sheetHp;
      const usesTxt = Object.entries(r.uses)
        .map(([k, v]) => `${k} 남은 ${v}`)
        .join(' · ');
      return {
        m,
        r,
        html: `<tr><td><label class="row" style="gap:6px;flex-wrap:nowrap"><input type="checkbox" data-rs="${m.id}" checked><div class="ti sm" style="${m.image ? `background-image:url('${cssu((m.form0 || {}).image || m.image)}')` : ''}"></div><div><b>${esc((m.form0 || {}).name || m.name)}</b><div class="small dim">${esc(t.name || '')}</div></div></label></td>
    <td class="nw mono">${hp0} → <b style="color:${r.dead ? 'var(--red)' : r.hp < hp0 ? 'var(--yel2)' : 'var(--ok)'}">${r.hp}</b><span class="dim">/${rm.hp.max}</span></td>
    <td>${r.dead ? '<span class="rk" style="background:var(--red);color:#fff">빈사</span>' : ''}${
      Object.keys(r.st)
        .filter(k => k !== 'Dead')
        .map(k => `<span class="rk">${esc(stKo(k))}</span>`)
        .join('') || (r.dead ? '' : '<span class="dim small">없음</span>')
    }</td>
    <td class="small">${usesTxt ? esc(usesTxt) : '<span class="dim">그대로</span>'}</td>
    <td class="small">${r.used ? `<s>${esc(r.used)}</s> 소모${r.moved ? ` <span class="dim">· ${esc(r.moved)} (배틀 한정)</span>` : ''}` : r.moved ? `${esc(r.moved)} <span class="dim">(배틀 한정 · 시트 그대로)</span>` : r.item !== (rm.item || '') ? esc((rm.item || '-') + ' → ' + (r.item || '없음')) : '<span class="dim">그대로</span>'}</td></tr>`
      };
    });
    const md = A().openModal(`<div class="mhead"><h2>배틀 결과 정리</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   ${UNDO && UNDO.ops ? `<div class="row small" style="gap:8px;margin-bottom:8px;padding:6px 8px;border:1px dashed var(--line);flex-wrap:wrap"><span>지난 결과 정리 <b>${esc(new Date(UNDO.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}</b> · ${esc((UNDO.names || []).join(', ')).slice(0, 120)}</span><span class="sp"></span><button class="btn sm" id="rsundo" title="그 결과 정리 바로 전의 HP · 상태 · 포텐셜 횟수 · 소지품 · 랭크로 시트를 되돌린다">↶ 되돌리기</button></div>` : ''}
   <div class="small dim" style="margin-bottom:6px">체크한 것만 시트(로스터)에 돌려준다. 다음에 파티를 불러오면 이 HP·상태로 시작한다.</div>
   <div class="row small" style="gap:12px;margin-bottom:8px"><label><input type="checkbox" data-rk="hp" checked> HP</label><label><input type="checkbox" data-rk="st" checked> 빈사·상태 이상</label><label><input type="checkbox" data-rk="uses" checked> 포텐셜 횟수</label><label><input type="checkbox" data-rk="item" checked> 쓴 소지품</label></div>
   <table class="t"><tr><th>포켓몬</th><th>HP</th><th>상태</th><th>포텐셜 횟수</th><th>소지품</th></tr>${rows.map(x => x.html).join('')}</table>
   <div class="row" style="margin-top:10px"><label class="small"><input type="checkbox" id="rsclear"> 반영한 뒤 배틀 비우기</label><span class="sp"></span><button class="btn" data-x>취소</button><button class="btn pri" id="rsgo">시트에 반영</button></div>`);
    $('#rsgo', md).onclick = async () => {
      const on = k => !!(md.querySelector(`[data-rk="${k}"]`) || {}).checked;
      const ops = [];
      const L = [];
      const PC = [];
      for (const { m, r } of rows) {
        if (!(md.querySelector(`[data-rs="${m.id}"]`) || {}).checked) continue;
        const P = ['roster', 'mons', RID(m)];
        const bits = [];
        if (on('hp')) {
          ops.push([[...P, 'sheetHp'], r.hp]);
          bits.push('HP ' + r.hp);
        }
        {
          const rr = (R[RID(m)] || {}).rank || {};
          if (Object.values(rr).some(v => +v)) {
            ops.push([
              [...P, 'rank'],
              { attack: 0, defense: 0, specialattack: 0, specialdefense: 0, speed: 0, accuracy: 0, evasion: 0, critical: 0 }
            ]);
            bits.push('배틀 전 랭크 정리');
          }
        } /* 10-26: 스킬 체크 패널티로 시트에 남긴 랭크는 이 배틀에서 썼으니 비운다 */
        if (on('st')) {
          ops.push([[...P, 'sheetStates'], Object.keys(r.st).length ? r.st : null]);
          const s2 = Object.keys(r.st).map(k => (k === 'Dead' ? '빈사' : stKo(k)));
          if (s2.length) bits.push(s2.join('·'));
        }
        if (on('uses')) {
          ops.push([[...P, 'potUses'], Object.keys(r.uses).length ? r.uses : null]);
        }
        if (on('item') && r.used && !r.item) {
          ops.push([[...P, 'item'], '']);
          ops.push([[...P, 'itemEff'], '']);
          bits.push(r.used + ' 소모');
        }
        {
          const rm = R[RID(m)] || {};
          if (rm.src === 'maker') {
            const at = Date.now();
            PC.push([
              RID(m),
              {
                hp: on('hp') ? (r.hp >= rm.hp.max ? null : r.hp) : rm.sheetHp == null ? null : rm.sheetHp,
                max: rm.hp.max,
                st: on('st') ? (Object.keys(r.st).length ? r.st : null) : rm.sheetStates || null,
                at,
                src: 'room',
                room: A().ST.room || ''
              }
            ]);
            ops.push([[...P, 'pcAt'], at]);
          }
        } /* 11-06 망령 「결과 정리한 HP · 상태가 제작기 카드에도」: 제작기 pcond 문서로 */
        L.push(`${(m.form0 || {}).name || m.name}: ${bits.join(' · ') || '반영'}`);
      }
      if (!ops.length) return A().toast('반영할 것이 없다');
      A().closeModal();
      /* 11-05 망령 「정리 잘못 눌렀을 수도 있으니 되돌리기도」: 고치기 바로 전 값을 resultUndo 에 남긴다 (배틀을 비워도 남게 방 맨 위) */
      {
        const S0 = A().ST.state;
        const get = pth => {
          let o = S0;
          for (const k of pth) {
            if (o == null) return null;
            o = o[k];
          }
          return o === undefined ? null : JSON.parse(JSON.stringify(o));
        };
        ops.push([
          ['resultUndo'],
          {
            at: Date.now(),
            names: rows.filter(({ m }) => (md.querySelector(`[data-rs="${m.id}"]`) || {}).checked).map(({ m }) => (m.form0 || {}).name || m.name),
            ops: ops.map(([pth]) => [pth, get(pth)])
          }
        ]);
      }
      ops.push([['battle', 'resultAt'], Date.now()]);
      /* 10-31 망령 「결과 정리를 했는데 던전 귀환 창이 『결과 정리 먼저』」: 했다는 표시 */ if (!(await A().setMany(ops))) return;
      A().sysLog(`【배틀 결과】 시트에 반영\n${L.join('\n')}`, 'battle');
      A().toast('시트에 반영했다');
      pcPut(PC);
      {
        const HL = window.OM_HALL_UI;
        const nb = ctx().b;
        if (HL && HL.worth(nb)) await HL.offer(nb, {});
      } /* 10-27 망령: 결과 정리 때도 전당에 남길지 */
      if ($('#rsclear', md).checked) {
        CMD = {};
        await A().setMany([
          [
            ['battle'],
            {
              turn: 0,
              phase: 0,
              mode: mode(b),
              sides: { left: { trainers: [] }, right: { trainers: [] } },
              trainers: {},
              mons: {},
              field: {},
              cmds: {},
              order: []
            }
          ],
          [['ready'], {}]
        ]);
      }
    };
    {
      const ub = $('#rsundo', md);
      if (ub)
        ub.onclick = async () => {
          const U = A().ST.state.resultUndo;
          if (!U || !U.ops) return;
          if (
            !confirm(
              `지난 결과 정리(${(U.names || []).join(', ')})를 되돌려 시트를 그 전 값으로 돌릴까?\n(그 뒤에 시트에서 따로 고친 HP · 상태도 그 전 값으로 돌아간다)`
            )
          )
            return;
          A().closeModal();
          if (!(await A().setMany([...U.ops, [['resultUndo'], null], [['battle', 'resultAt'], null]]))) return;
          A().sysLog(`【배틀 결과】 결과 정리 되돌림 — ${(U.names || []).join(', ')}`, 'battle');
          A().toast('결과 정리를 되돌렸다');
          pcFromRoster([...new Set(U.ops.map(([pth]) => (pth[0] === 'roster' && pth[1] === 'mons' ? pth[2] : null)).filter(Boolean))]);
        };
    }
  }
  /* 11-06: 제작기 카드의 「지금 HP · 상태」 (docs kind 'pcond', id = 제작기 포켓몬 id). 제작기에서 회복하면 GM 화면이 방 시트에 받아 온다 (db_ui pullCond) */
  async function pcPut(L) {
    const SS = window.OM_STORE;
    if (!SS || !SS.makerPut || !L.length) return;
    let bad = 0;
    for (const [id, d] of L) {
      try {
        await SS.makerPut('pcond', id, d);
      } catch (e) {
        bad++;
        console.warn('pcond', id, e);
      }
    }
    if (bad) A().toast(`제작기 카드에 HP · 상태를 ${bad}체 못 보냈다`);
  }
  function pcFromRoster(ids) {
    const R = (A().ST.state.roster || {}).mons || {};
    const at = Date.now();
    pcPut(
      ids
        .map(id => {
          const rm = R[id];
          if (!rm || rm.src !== 'maker') return null;
          return [
            id,
            {
              hp: rm.sheetHp == null || rm.sheetHp >= rm.hp.max ? null : rm.sheetHp,
              max: rm.hp.max,
              st: rm.sheetStates || null,
              at,
              src: 'room',
              room: A().ST.room || ''
            }
          ];
        })
        .filter(Boolean)
    );
  }
  /* 폼 목록은 시트(로스터) 쪽을 먼저 — 오레마스 시트에서 고친 폼이 바로 따라온다 (빌려 온 파티는 rid) */
  /* 11-14 공유 폼체인지: 트레이너 sforms(제작기 「공유 폼체인지」)를 이 포켓몬의 원래 종족치에 맞춰 풀어 자기 폼 뒤에 붙인다 (shared:1). 같은 입력이면 풀어 둔 것을 다시 쓴다 */
  const SFC = new Map();
  function sharedForms(m) {
    const st = A().ST.state || {};
    const t = ((st.roster || {}).trainers || {})[m.tid] || ((st.battle || {}).trainers || {})[m.tid];
    const sf = t && t.sforms;
    if (!sf || !sf.length || !window.OM_IMPORT || !OM_IMPORT.formsOf) return [];
    const base = ((m.form0 || m).base || []).slice(0, 6);
    const key = m.tid + '|' + base.join(',') + '|' + JSON.stringify(sf);
    let r = SFC.get(key);
    if (!r) {
      try {
        r = (OM_IMPORT.formsOf({ forms: sf }, base) || []).map(f => Object.assign(f, { shared: 1 }));
      } catch (e) {
        console.warn('sharedForms', e);
        r = [];
      }
      if (SFC.size > 200) SFC.clear();
      SFC.set(key, r);
    }
    return r;
  }
  function formsOf(m) {
    const rm = ((A().ST.state.roster || {}).mons || {})[m.rid || m.id];
    const own = rm ? rm.forms || [] : m.forms || [];
    const sh = sharedForms(m);
    return sh.length ? own.concat(sh) : own;
  }
  function openForm(mid) {
    const c = ctx();
    const b = c.b;
    const m = b.mons[mid];
    if (!m || !canEdit(c, m)) return;
    const forms = formsOf(m);
    if (!forms.some(f => f && f.kind !== '일루젼') && !m.form0 && !hasTera(m)) return;
    const usedTera = Object.values(b.mons).some(x => x.tid === m.tid && x.teraUsed && x.id !== mid);
    const cur = m.form0 ? m.formIdx : -1;
    const o = m.form0 || m;
    const usedMega = Object.values(b.mons).some(x => x.tid === m.tid && x.megaUsed && x.id !== mid);
    const row = (k, f) => {
      const ty = f ? f.types || o.types : o.types;
      const base = f ? f.base : o.base;
      const img = f ? f.image || o.image : o.image;
      return `<label class="firerow ${k === cur ? 'dis' : ''}" data-fm="${k}"><div class="row" style="gap:8px;flex-wrap:nowrap"><div class="ti sm" style="${img ? `background-image:url('${cssu(img)}')` : ''}"></div><div><b>${esc(f ? f.name || o.name : o.name)}</b> <span class="small dim">${f ? esc(f.kind || '폼체인지') : '원래 모습'}${f && f.shared ? ' · 공유' : ''}${k === cur ? ' · 지금' : ''}</span>
    <div class="small">${(ty || [])
      .filter(x => x && x !== '-')
      .map(x => esc(S().typeKo(x)))
      .join(
        '/'
      )} · 특성 ${esc((f && f.ability) || o.ability || '-')} · ${['H', 'A', 'B', 'C', 'D', 'S'].map((x, i) => x + (base || [])[i]).join(' ')}</div>${
      f && (f.pots || []).length
        ? `<div class="small">포텐셜 ${f.pots
            .map(x => {
              const op = (o.pots || m.pots || []).find(p => p.slot === x.slot);
              return (op ? esc(op.name) + '→' : '+') + '「' + esc(x.name) + '」';
            })
            .join(' · ')}</div>`
        : ''
    }${f && (f.exs || []).length ? `<div class="small">전용 ${f.exRep ? '(원래 전용 대신) ' : ''}${f.exs.map(x => '「' + esc(x.name) + '」').join(' · ')}</div>` : ''}${f && ((f.moves || []).length || f.mvRep) ? `<div class="small">기술 ${f.mvRep ? '(원래 기술 전부 대신) ' : ''}${f.moves.map(x => (x.from ? esc(x.from) + '→' : '+') + '「' + esc((x.mv || {}).name || '') + '」').join(' · ')}</div>` : ''}${f && f.cond ? `<div class="small" style="color:var(--yel2)">${esc(f.cond)}</div>` : ''}${f && f.kind === '메가진화' && usedMega ? '<div class="small" style="color:var(--red)">이 트레이너는 이번 배틀에서 이미 메가진화를 썼다</div>' : ''}</div></div></label>`;
    };
    const md = A()
      .openModal(`<div class="mhead"><h2>${esc(m.name)} — ${forms.length || m.form0 ? '폼체인지' : '테라스탈'}${(forms.length || m.form0) && hasTera(m) ? ' · 테라스탈' : ''}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="firelist">${
     hasTera(m)
       ? `<label class="firerow" data-tera="1"><div class="row" style="gap:8px;flex-wrap:nowrap"><div class="ti sm" style="${m.image ? `background-image:url('${cssu(m.image)}')` : ''}"></div><div><b>${teraOn(m) ? '테라스탈 끄기' : '테라스탈'}</b> <span class="small dim">테라 타입 「${esc(m.tera)}」${teraOn(m) ? ' · 지금' : ''}</span>
    <div class="small">${teraOn(m) ? '교대해도 풀리지 않는다 — 잘못 켰을 때 바로잡기만' : `받는 상성은 「${esc(m.tera)}」 하나로 · 원래 타입과 테라 타입 모두 자속${teraSameIf(m) ? ' · 같은 타입이라 자속 2배(적응력)' : ''}`}</div>${!teraOn(m) && usedTera ? '<div class="small" style="color:var(--red)">이 트레이너는 이번 배틀에서 이미 테라스탈을 썼다</div>' : ''}</div></div></label>`
       : ''
   }${m.form0 ? row(-1, null) : ''}${forms.map((f, k) => (f && f.kind === '일루젼' ? '' : row(k, f))).join('')}</div>
   <div class="small dim" style="margin-top:6px">랭크·상태는 그대로. 최대 HP 가 바뀌면 그 차이만큼 지금 HP 도 바뀐다. 「교대하면 돌아옴」 폼은 퇴장 때 원래 모습으로.</div>`);
    {
      const te = md.querySelector('[data-tera]');
      if (te)
        te.onclick = async () => {
          const on = !teraOn(m);
          if (!on && !(await askYes('테라스탈은 교대해도 풀리지 않는다. 잘못 켠 것을 바로잡으려고 끌까?', '끈다'))) {
            openForm(mid);
            return;
          }
          if (on && usedTera && !(await askYes('이 트레이너는 이번 배틀에서 이미 테라스탈을 썼다. 그래도 할까?', '한다'))) {
            openForm(mid);
            return;
          }
          A().closeModal();
          await doTera(mid, on);
        };
    }
    md.querySelectorAll('[data-fm]').forEach(
      el =>
        (el.onclick = async () => {
          const k = +el.dataset.fm;
          if (k === cur) return;
          const f = forms[k];
          if (f && f.kind === '메가진화' && usedMega && !(await askYes('이 트레이너는 이번 배틀에서 이미 메가진화를 썼다. 그래도 할까?', '한다'))) {
            openForm(mid);
            return;
          }
          A().closeModal();
          await doForm(mid, k);
        })
    );
  }
  /* 11-02 망령: 테라스탈 켜기 · 끄기 — 로그 · 컷인. teraUsed 는 이번 배틀에서 썼다는 표시 (메가진화처럼 경고만) */
  function teraSameIf(m) {
    return hasTera(m) && (m.types || []).includes(m.teraEn);
  }
  async function doTera(mid, on) {
    const b = ctx().b;
    const m = b.mons[mid];
    if (!m || !hasTera(m)) return false;
    const nb0 = snap(),
      nb = snap(nb0);
    const x = nb.mons[mid];
    if (!x) return false;
    x.teraActive = !!on;
    if (on) x.teraUsed = true;
    if (!(await saveBattle(nb0, nb))) return false;
    const ty = String(x.tera || '');
    const same = on && teraSameIf(x);
    A().sysLog(
      on
        ? `【테라스탈】 ${x.name}이(가) 테라스탈했다! → 「${ty}」 타입\n받는 상성은 「${ty}」 하나로 · 원래 타입(${
            (x.types || [])
              .filter(t => t && t !== '-')
              .map(t => S().typeKo(t))
              .join('/') || '-'
          })과 「${ty}」 기술 모두 자속${same ? ' · 같은 타입이라 「' + ty + '」 기술은 자속 2배(적응력)' : ''} · 교대해도 풀리지 않는다`
        : `【테라스탈 해제】 ${x.name} — 원래 타입으로 (GM 바로잡기)`,
      'battle',
      { mid, img: x.image || '' }
    );
    if (on) {
      const col = x.side === 'left' ? '#1f6fd1' : '#e3101f';
      if (CUT() && CUT().evo) {
        try {
          CUT().evo({
            kind: 'form',
            label: '테라스탈',
            from: { name: m.name, img: m.image || '' },
            to: { name: x.name + ' · ' + ty, img: x.image || '' },
            color: col
          });
        } catch (e) {}
      } else cutFire('m:' + mid, x.image, `${x.name}의 테라스탈!`, `→ 「${ty}」`, col);
    }
    return true;
  }
  /* 폼 바꾸기 본체 (창 · 자동 HP 조건 폼체인지 공용) */
  async function doForm(mid, k, why) {
    const b = ctx().b;
    const m = b.mons[mid];
    if (!m) return false;
    /* 11-26 05:24 망령 「연출 도중 포트가 토지신에서 토지신으로 · 원래에서 원래로」: 같은 폼체인지가 두 번 불리면(고유 효과 + 자동 등) 두 번째는 이미 그 모습 → 「A → A」 컷인 · 로그. 이미 그 폼이면 / 이미 원래 모습이면 아무것도 안 한다 */
    if (k >= 0 && m.form0 && +m.formIdx === +k) return true;
    if (!(k >= 0) && !m.form0) return true;
    const forms = formsOf(m);
    const o = m.form0 || m;
    const f = forms[k];
    const FR = { name: m.name, img: m.image || '' };
    /* 11-26 05:30 망령 「폼 그림 → 폼 그림 그대로」: saveBattle 뒤엔 m 이 새 상태로 바뀌어 있어(같은 객체) 컷인 앞 그림 · 이름이 폼 것이 됐다 — 저장 전에 적어 둔다 */ const nb0 =
        snap(),
      nb = snap(nb0);
    const x = nb.mons[mid];
    if (!x) return false;
    x.forms = JSON.parse(JSON.stringify(forms));
    const L = formSet(x, k);
    if (f && f.kind === '메가진화') x.megaUsed = true;
    if (why) x.hpFormDone = 1;
    if (!(await saveBattle(nb0, nb))) return false;
    A().sysLog(`【${f ? f.kind || '폼체인지' : '폼 복귀'}】 ${L.join('\n')}${why ? '\n(' + why + ')' : ''}`, 'battle', { mid, img: x.image || '' });
    {
      const col = x.side === 'left' ? '#1f6fd1' : '#e3101f';
      const kd = !f ? 'back' : f.kind === '메가진화' ? 'mega' : 'form';
      if (CUT() && CUT().evo) {
        try {
          CUT().evo({ kind: kd, label: f ? f.kind || '폼체인지' : '', from: FR, to: { name: x.name, img: x.image || '' }, color: col });
        } catch (e) {}
      } else if (f) cutFire('m:' + mid, x.image, `${FR.name}의 ${f.kind || '폼체인지'}!`, x.name !== FR.name ? `→ 「${x.name}」` : '', col);
    }
    /* 새 특성의 등장·상시 구문은 바로 */
    const ab = ctx().b.mons[mid];
    if (f && ab && ab.ability && ab.ability !== o.ability && FX()) {
      const a = FX().autoOf(ab, 'trait', ab.ability);
      if (a && a.ops && a.ops.length && !a.manual) {
        const tm = FX().timing(a.text || '');
        if (tm.entry || tm.passive) await fireAuto(mid, 'trait', ab.ability, { quiet: true, noRoll: !!tm.passive });
      }
    }
    {
      const cm = ctx().b.mons[mid];
      if (cm && FX())
        for (const n of cm.formNewPots || []) {
          const a = FX().autoOf(cm, 'pot', n);
          if (!a || !a.ops || !a.ops.length || a.manual) continue;
          if (limManual(cm, 'pot', n)) continue;
          const tm = FX().timing(a.text || '');
          if (tm.entry || tm.passive) await fireAuto(mid, 'pot', n, { quiet: true, noRoll: !!tm.passive });
        }
    }
    return true;
  }
  /* HP 조건 폼체인지 (10-26 망령): 폼 조건 글이 「HP : 1/2 이하」 꼴이면 HP 가 그만큼 내려갔을 때 자동으로 (한 배틀에 한 번) */
  let hpFormBusy = false;
  async function hpFormWatch() {
    const c = ctx();
    const b = c.b;
    if (!c.mgr || !b.started || hpFormBusy) return;
    if (!isLeader(c)) return;
    hpFormBusy = true;
    try {
      for (const m of Object.values(b.mons || {})) {
        if (!m.entry || m.hp.cur <= 0 || m.hpFormDone || m.form0) continue;
        const fs = formsOf(m);
        for (let k = 0; k < fs.length; k++) {
          const f = fs[k];
          const r = String((f && f.cond) || '').match(/「HP\s*:\s*(\d+)\s*\/\s*(\d+)\s*이하」/);
          if (!r || f.kind === '메가진화') continue;
          if (m.hp.cur <= Math.floor((m.hp.max * +r[1]) / +r[2])) {
            await doForm(m.id, k, `「HP : ${r[1]}/${r[2]} 이하」 — 자동`);
            break;
          }
        }
      }
    } finally {
      hpFormBusy = false;
    }
  }
  function openEdit(mid) {
    const c = ctx();
    const b = c.b;
    const m = b.mons[mid];
    if (!m || !canEdit(c, m)) return;
    const sdb = DB().states || { st: {}, groups: [] };
    const items = Object.keys(DB().items || {});
    const md = A()
      .openModal(`<div class="mhead"><h2>${esc(m.name)} <span class="small dim">랭크·상태·소지품</span></h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   ${
     FX()
       ? `<div class="card" style="margin-top:0;padding:6px 10px"><div class="sec">자동화 <span class="note">포텐셜·특성·소지품의 구문 — 「발동」은 카드에서</span></div><div class="row" style="flex-wrap:wrap;gap:4px">${
           [
             ...(m.pots || []).filter(p => p && p.name && !p.ph).map(p => ['pot', p.name, p.eff]),
             ...(m.excl ? [['pot', m.excl.name, m.excl.eff]] : []),
             ...(m.exclX || []).map(p => ['pot', p.name, p.eff]),
             ...(m.ability ? [['trait', m.ability, m.abilityEff]] : []),
             ...(m.item ? [['item', m.item, m.itemEff]] : [])
           ]
             .map(([k, n, t]) => {
               const own = (m.auto || {})[n];
               const base = FX().autoOf(Object.assign({}, m, { auto: {} }), k, n);
               const has = own && own.ops && own.ops.length;
               const rmHas = base && base.ops && base.ops.length && !base.manual;
               return `<button class="btn xs ${has ? 'pri' : rmHas ? '' : 'ghost'}" data-fxed="${k}" data-name="${esc(n)}" data-text="${esc(t || '')}">${k === 'trait' ? '특성 ' : k === 'item' ? '소지품 ' : ''}${esc(n)} ${has ? '✓' : rmHas ? '(자동)' : ''}</button>`;
             })
             .join('') || '<span class="small dim">없음</span>'
         }</div></div>`
       : ''
   }
   <div class="row" style="margin-bottom:8px"><b>HP</b> <input type="number" id="ehp" value="${m.hp.cur}" style="width:90px"> / ${m.hp.max} <button class="btn sm" id="ehpfull">전부 회복</button><span class="sp"></span><label><input type="checkbox" id="etera" ${m.teraActive ? 'checked' : ''}> 테라스탈 ${esc(m.tera)}</label></div>
   <div class="rankgrid">${Object.keys(STAT_KO)
     .map(
       k => `<div class="rkrow"><span>${STAT_KO[k]}</span><button class="btn xs" data-rk="${k}" data-d="-1">−</button><b class="mono" id="rk_${k}">${(+m.rank[k] || 0) > 0 ? '+' : ''}${+m.rank[k] || 0}</b><button class="btn xs" data-rk="${k}" data-d="1">＋</button>
     <input type="text" class="n" data-mod="${k}" value="${(m.mod || {})[k] != null && (m.mod || {})[k] !== 1 ? (m.mod || {})[k] : ''}" placeholder="×1" title="배율(mod)"></div>`
     )
     .join('')}</div>
   <div class="row small" style="margin:6px 0"><label><input type="checkbox" id="etemp"> 이번 변경을 임시 랭크로 (턴 종료 때 해제)</label><button class="btn xs ghost" id="erk0">랭크 전부 0</button></div>
   <div class="row" style="margin:8px 0"><b>소지품</b> <input type="text" id="eitem" list="itemlist" value="${esc(m.item || '')}" style="flex:1"><button class="btn sm" id="eitemdb" type="button">DB</button><datalist id="itemlist">${items.map(i => `<option value="${esc(i)}">`).join('')}</datalist>
    ${c.mgr ? `<b>레이드</b> <input type="number" class="n" id="eraid" value="${(m.raid && m.raid.segments) || ''}" placeholder="구간 X" title="최대 HP 를 X 등분한 자리마다 배리어"><span class="small dim">${m.raid && m.raid.segments ? `페이즈 ${m.raid.phase || 1} · 깨짐 ${m.raid.broken || 0}${raidFloor(m) ? ' · 다음 배리어 ' + raidFloor(m) : ''}${m.raid.brk ? ' · 이번 턴 깨짐' : ''}` : ''}</span>${m.raid && m.raid.segments ? '<button class="btn xs ghost" type="button" id="eraidpc" title="「트리거 : 페이즈 체인지」를 지금 발동 (자신의 부정적인 상태 · 적진 능력치 상승 초기화)">페이즈 체인지</button>' : ''}` : ''}</div>
   <div class="sec" style="margin-top:10px">걸린 상태</div><div class="ston" id="ston"></div><div class="row" style="margin-top:8px"><b>눌러서 걸기</b><input type="text" id="stq" placeholder="상태 검색 (이름·설명)" style="flex:1"></div>
   <div class="stgroups" id="stgroups">${(sdb.groups || [])
     .map(
       g =>
         `<div class="stg" data-stg><div class="stgl">${esc(g.l)}</div>${g.s
           .map(k => {
             const d = sdb.st[k] || { ko: k };
             const v = (m.states || {})[k];
             const im = simg(k);
             return `<label class="stt ${v ? 'on' : ''} ${d.abn ? 'abn' : ''}" data-stq="${esc((d.ko + ' ' + k + ' ' + (d.desc || []).join(' ')).toLowerCase())}" title="${esc((d.desc || []).join(' '))}"><input type="checkbox" data-st="${k}" ${v ? 'checked' : ''}>${im ? `<img src="${esc(im)}" alt="">` : `<span class="sti0">${esc(String(d.ko || k).slice(0, 1))}</span>`}<span class="stn">${esc(d.ko)}</span>${d.prog === 'turn' || d.prog === 'move' ? `<input type="number" class="n xs" data-stc="${k}" value="${v && v < 1000 ? v : d.min < 1000 ? d.min : ''}" placeholder="T">` : ''}</label>`;
           })
           .join('')}</div>`
     )
     .join('')}</div>
   <div class="row afoot"><span class="sp"></span><button class="btn pri" id="esave">적용</button></div>`);
    {
      const pc = $('#eraidpc', md);
      if (pc)
        pc.onclick = async () => {
          A().closeModal();
          await raidPhaseNow(mid, '수동 발동');
        };
    }
    const rank = Object.assign({}, m.rank);
    const delta = {};
    md.querySelectorAll('[data-rk]').forEach(
      bt =>
        (bt.onclick = () => {
          const k = bt.dataset.rk;
          const lim = k === 'critical' ? 4 : 6;
          const p0 = +rank[k] || 0;
          rank[k] = Math.max(-lim, Math.min(lim, p0 + +bt.dataset.d));
          delta[k] = (delta[k] || 0) + (rank[k] - p0);
          $('#rk_' + k, md).textContent = (rank[k] > 0 ? '+' : '') + rank[k];
        })
    );
    $('#erk0', md).onclick = () => {
      for (const k in STAT_KO) {
        rank[k] = 0;
        $('#rk_' + k, md).textContent = '0';
      }
    };
    md.querySelectorAll('[data-fxed]').forEach(
      bt =>
        (bt.onclick = () => {
          A().closeModal();
          window.OM_FX_UI.openEditor({
            mon: ctx().b.mons[mid],
            kind: bt.dataset.fxed,
            name: bt.dataset.name,
            text: bt.dataset.text,
            save: async auto => {
              const cur = Object.assign({}, (ctx().b.mons[mid] || {}).auto || {});
              if (auto) cur[bt.dataset.name] = auto;
              else delete cur[bt.dataset.name];
              await A().set(['battle', 'mons', mid, 'auto'], cur);
              const rm = (A().ST.state.roster || {}).mons || {};
              if (rm[mid]) await A().set(['roster', 'mons', mid, 'auto'], cur);
              A().toast(auto ? '구문을 저장했다' : '구문을 지웠다');
            }
          });
        })
    );
    $('#ehpfull', md).onclick = () => {
      $('#ehp', md).value = m.hp.max;
    };
    const updOn = () => {
      const L = [...md.querySelectorAll('[data-st]:checked')].map(cb => cb.dataset.st);
      md.querySelectorAll('[data-st]').forEach(cb => cb.closest('.stt').classList.toggle('on', cb.checked));
      $('#ston', md).innerHTML = L.length
        ? L.map(k => {
            const d = sdb.st[k] || { ko: k };
            const im = simg(k);
            const ci = md.querySelector(`[data-stc="${k}"]`);
            const v = ci ? (ci.value === '' ? '' : +ci.value) : null;
            return `<span class="stchip ${d.abn ? 'abn' : ''}" data-stinfo="${esc(k)}" title="${esc((d.desc || []).join(' '))}">${im ? `<img src="${esc(im)}" alt="">` : ''}${esc(d.ko)}${ci ? `<span class="stcnt"><b data-sd="${k}" data-d="-1">−</b><i>${v === '' || v >= 1000 ? '계속' : v}</i><b data-sd="${k}" data-d="1">+</b></span>` : ''}<b class="stx" data-soff="${k}" title="풀기">✕</b></span>`;
          }).join('')
        : '<span class="small dim">없음</span>';
      md.querySelectorAll('[data-soff]').forEach(
        x =>
          (x.onclick = () => {
            const cb = md.querySelector(`[data-st="${x.dataset.soff}"]`);
            if (cb) {
              cb.checked = false;
              updOn();
            }
          })
      );
      md.querySelectorAll('[data-sd]').forEach(
        x =>
          (x.onclick = () => {
            const ci = md.querySelector(`[data-stc="${x.dataset.sd}"]`);
            if (!ci) return;
            ci.value = Math.max(1, Math.min(999, (+ci.value || 0) + +x.dataset.d));
            updOn();
          })
      );
    };
    md.querySelectorAll('[data-st],[data-stc]').forEach(cb => cb.addEventListener('input', updOn));
    updOn();
    const stq = $('#stq', md);
    if (stq) {
      stq.oninput = () => {
        const q = stq.value.trim().toLowerCase();
        md.querySelectorAll('.stt').forEach(l => {
          l.style.display = !q || l.dataset.stq.includes(q) || l.classList.contains('on') ? '' : 'none';
        });
        md.querySelectorAll('[data-stg]').forEach(g => {
          g.style.display = [...g.querySelectorAll('.stt')].some(l => l.style.display !== 'none') ? '' : 'none';
        });
      };
      setTimeout(() => stq.focus(), 50);
    }
    $('#eitemdb', md).onclick = () => {
      window.OM_DB_UI.open({
        kind: 'item',
        sel: $('#eitem', md).value,
        pick: async name => {
          const it = (DB().items || {})[name] || {};
          await A().set(['battle', 'mons', mid, 'item'], name);
          await A().set(['battle', 'mons', mid, 'itemEff'], String(it.eff || ''));
          openEdit(mid);
        }
      });
    };
    /* 10-23 망령: 저장 중에 화면이 m(살아 있는 상태 객체)을 새 값으로 먼저 바꿔 놓아서(낙관적 반영) 「바뀐 것」 로그가 비던 것 — 누를 때의 사본과 비교한다 */
    const snapM = () => JSON.parse(JSON.stringify((ctx().b.mons || {})[mid] || m));
    $('#esave', md).onclick = async () => {
      const m = snapM();
      const nm = JSON.parse(JSON.stringify(m));
      nm.hp.cur = Math.max(0, Math.min(m.hp.max, +$('#ehp', md).value || 0));
      nm.rank = rank;
      const RKAB = [];
      for (const k in delta) {
        if (delta[k] > 0 && (+rank[k] || 0) > (+(m.rank || {})[k] || 0)) {
          const sw = rkAbSwap(nm, k);
          if (sw) {
            rank[k] = +(m.rank || {})[k] || 0;
            delete delta[k];
            RKAB.push(sw);
          }
        }
      }
      nm.teraActive = $('#etera', md).checked;
      if (nm.teraActive && !m.teraActive) nm.teraUsed = true;
      nm.item = $('#eitem', md).value.trim();
      nm.mod = {};
      md.querySelectorAll('[data-mod]').forEach(i => {
        const v = i.value === '' ? 1 : mulOf(i.value, (m.mod || {})[i.dataset.mod] || 1);
        if (v > 0 && v !== 1) nm.mod[i.dataset.mod] = v;
      });
      /* 손으로 바꾼 배율은 출처 기록에서 떼어 낸다 (나중에 ✕ 로 역으로 나뉘지 않게) */
      if (nm.fx && nm.fx.mults) {
        nm.fx.mults = nm.fx.mults
          .map(e => {
            const st = {};
            for (const k in e.stats) if ((+nm.mod[k] || 1) === (+(m.mod || {})[k] || 1)) st[k] = e.stats[k];
            return Object.assign({}, e, { stats: st });
          })
          .filter(e => Object.keys(e.stats).length);
      }
      const er = $('#eraid', md);
      if (er) {
        const X = +er.value || 0;
        if (!X) delete nm.raid;
        else if (!nm.raid || nm.raid.segments !== X)
          nm.raid = Object.assign({ cure: 1, cstat: 1, rup: 1, rmod: 0, cond: 'cap' }, nm.raid || {}, { segments: X, broken: 0, phase: 1, brk: 0 });
      }
      if ($('#etemp', md).checked) {
        nm.tempRank = nm.tempRank || {};
        for (const k in delta) nm.tempRank[k] = (+nm.tempRank[k] || 0) + delta[k];
      }
      nm.states = {};
      md.querySelectorAll('[data-st]').forEach(cb => {
        if (!cb.checked) return;
        const k = cb.dataset.st;
        const ci = md.querySelector(`[data-stc="${k}"]`);
        const d = sdb.st[k] || {};
        nm.states[k] =
          ci && ci.value !== ''
            ? +ci.value
            : +(m.states || {})[k] ||
              (d.min >= 1000 || !d.min
                ? 1000
                : +d.max > +d.min && +d.max < 1000
                  ? +d.min + Math.floor(Math.random() * (+d.max - +d.min + 1))
                  : +d.min);
      });
      if (nm.states.LeechSeed && !(m.states || {}).LeechSeed) {
        const sf = seedSrc(b, m);
        if (sf) nm.seedFrom = sf;
        else delete nm.seedFrom;
      }
      if (nm.hp.cur <= 0) nm.entry = '';
      A().closeModal();
      if (await saveMon(m, mid, nm)) {
        const SC = stLog(m, nm, fcMan('랭크·상태 창'));
        const ch = [];
        /* 11-01 망령 「상태 변화도 효과 로그」: 걸리고 풀린 상태는 카드로 — 이 줄에서는 뺀다 */ for (const k in STAT_KO) {
          const a = +m.rank[k] || 0,
            b2 = +rank[k] || 0;
          if (a !== b2) ch.push(`${STAT_KO[k]} ${a}→${b2 > 0 ? '+' : ''}${b2}`);
        }
        ch.push(...RKAB);
        const sa = Object.keys(m.states || {}).filter(k => m.states[k]),
          sb = Object.keys(nm.states);
        const on = sb.filter(k => !sa.includes(k)).map(k => (sdb.st[k] || {}).ko || k),
          off = sa.filter(k => !sb.includes(k)).map(k => (sdb.st[k] || {}).ko || k);
        if (on.length && !SC) ch.push('+' + on.join(','));
        if (off.length && !SC) ch.push('−' + off.join(','));
        if (nm.hp.cur !== m.hp.cur) ch.push(`HP ${m.hp.cur}→${nm.hp.cur}`);
        if (!!nm.teraActive !== !!m.teraActive) ch.push(nm.teraActive ? `테라스탈 → 「${m.tera}」 타입` : '테라스탈 해제');
        const itCh = (nm.item || '') !== (m.item || '') ? `소지품 ${nm.item || '없음'}` : '';
        const dsc = SC
          ? []
          : sb
              .filter(k => !sa.includes(k))
              .map(k => {
                const ds = stDesc(k);
                return ds.length ? `「${stName(k)}」 ${ds.join(' ')}` : '';
              })
              .filter(Boolean);
        if (ch.length) A().sysLog(`${m.name}: ${ch.join(' · ')}${dsc.length ? '\n' + dsc.join('\n') : ''}`, 'battle', { mid, img: m.image || '' });
        if (itCh && A().selfLog) A().selfLog(`${m.name}: ${itCh}`);
      }
    };
  }

