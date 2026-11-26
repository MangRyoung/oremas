  /* ── 조각 14_attack.js — 공격 창 ── */
  /* ---------- 공격 ---------- */
  /* 「기술 방어」 기술 (방어 · 판별 · 니들가드 · 킹실드 …): 효과 글로 알아본다. 무시하는 기술: 「방어」 상태를 무시 (해제면 'clear') */
  /* 속임수 (10-26): 「대상의 「공격」으로 대미지 계산」 — 공격 쪽 능력치 · 랭크 · 배율을 대상 것으로 */
  const FOUL_RE = /대상의\s*「공격」으로\s*대미지\s*계산/;
  /* 11-03 망령: 「기술 X 를 내보낸다. 이때, 자신의 「공격」을 가장 높은 종족치와 같은 랭크로」 — 그 기술 한 번만. 공격 창의 대미지 계산에만 쓰는 그림자 (저장되는 포켓몬은 그대로) */
  /* 11-23 저녁 (254번 검수): 「「환희의노래」 상태일 때 「소리」 기술이 「물 안」「하늘 위」인 상대에게도 명중한다」(IA) · 「「지진」이 「물 안」「어둠 안」인 상대에게도 명중한다」(켄라) — 포텐셜 · 특성 글. 앞 낫표 = 기술 이름 · 기술 태그 · 타입, 뒤 낫표들 = 그 상태(반무적)인 상대. 【보급】 횟수는 세지 않는다 */
  const SEMIPASS_RE =
    /(?:「([^」:]+)」\s*상태일\s*때\s*,?\s*)?「([^」:]+)」\s*(?:기술)?(?:이|가|은|는)\s*((?:「[^」:]+」\s*(?:[,·]|과|와)?\s*)+)(?:\s*상태)?인\s*(?:상대|대상|포켓몬)에게도\s*명중/g;
  /* 11-23 저녁 감우 256 (255번 「조건이 붙은 기술 타입 변경」): 구문 `기술타입`은 조건을 못 받으므로 글로 읽는다 — 「X」이 「날씨 : Y」일 때 「T」 기술이 된다 (여우구슬 · 날씨는 쉼표 · / 로 여럿) · 「X」이 자신의 「소지품 : 쥬얼」과 같은 「타입」의 기술이 된다 (광물성 안료 — 지금 든 「○○쥬얼」의 타입). 조건 없는 꼴(「X」이 「T」 기술이 된다)은 구문 몫이라 여기서 읽지 않는다 */
  const MVT_WX_RE = /「([^」:]+)」\s*(?:이|가|은|는)\s*「날씨\s*:\s*([^」]+)」\s*일\s*때\s*「([^」:]+)」\s*기술이\s*된다/g;
  const MVT_JW_RE = /「([^」:]+)」\s*(?:이|가|은|는)\s*자신의\s*「소지품\s*:\s*쥬얼」\s*과\s*같은\s*「타입」\s*의?\s*기술이\s*된다/g;
  function mvTypeTxt(atk, mv, b) {
    try {
      if (!atk || !mv) return '';
      const nq = x => String(x || '').replace(/\s/g, '');
      const tx = [atk.ability ? slotEff(atk, 'trait', atk.ability) : '', ...potSrc(atk).map(p => p && p.eff)];
      const W = nq(wxNow(b));
      for (const t of tx) {
        const T = String(t || '');
        for (const r of T.matchAll(MVT_WX_RE)) {
          if (nq(r[1]) !== nq(mv.name)) continue;
          if (
            !W ||
            !r[2]
              .split(/[,\/·]/)
              .map(nq)
              .includes(W)
          )
            continue;
          const ty = tyEnStrict(r[3]);
          if (ty) return ty;
        }
        for (const r of T.matchAll(MVT_JW_RE)) {
          if (nq(r[1]) !== nq(mv.name)) continue;
          for (const it of [atk.item, ...(atk.items2 || []).map(q => q && q.item)]) {
            const q = nq(it).match(/^(.+?)의?쥬얼$/);
            const ty = q ? tyEnStrict(q[1]) : '';
            if (ty) return ty;
          }
        }
      }
      return '';
    } catch (_) {
      return '';
    }
  }
  function semiPass(atk, mv, smKo) {
    try {
      if (!atk || !mv || !smKo) return false;
      const nq = x => String(x || '').replace(/\s/g, '');
      const tags = String(mv.tag || '')
        .split(/[,\s#]+/)
        .map(nq);
      const tx = [atk.ability ? slotEff(atk, 'trait', atk.ability) : '', ...potSrc(atk).map(p => p && p.eff)];
      for (const t of tx)
        for (const r of String(t || '').matchAll(SEMIPASS_RE)) {
          if (r[1]) {
            const k = FX().stEn ? FX().stEn(r[1]) : '';
            if (!k || !(atk.states || {})[k]) continue;
          }
          const w = nq(r[2]);
          if (!(w === nq(mv.name) || tags.includes(w) || w === nq(mv.type) || w === nq(S().typeKo(mv.typeEn)))) continue;
          if ([...r[3].matchAll(/「([^」]+)」/g)].some(x => nq(x[1]) === nq(smKo))) return true;
        }
      return false;
    } catch (_) {
      return false;
    }
  }
  function topMvOf(atk, def, mv) {
    const out = [];
    if (!atk || !mv || mv.cat === '변화') return out;
    const nq = x => String(x || '').replace(/\s/g, '');
    for (const e of spL(atk, 'topmv')) {
      if ((e.mv || []).length && !e.mv.some(n => nq(n) === nq(mv.name))) continue;
      let ok = true;
      try {
        ok = !FX().dynOk || FX().dynOk(Object.assign({}, e, { mv: [] }), atk, def || null, {});
      } catch (_) {
        ok = false;
      }
      if (!ok) continue;
      for (const k of e.stats || []) if (!out.includes(k)) out.push(k);
    }
    return out;
  }
  function topShadow(m, top) {
    if (!m || !top || !top.length || !Array.isArray(m.base)) return m;
    const St = S();
    const G = (DB().maker || {}).grade || [];
    const IDX = ['hp', 'attack', 'defense', 'specialattack', 'specialdefense', 'speed'],
      KO = ['HP', '공격', '방어', '특공', '특방', '스피드'];
    const base = m.base.map(v => +v || 0);
    const nb = base.slice();
    const notes = [];
    for (const k of top) {
      const i = IDX.indexOf(k);
      if (i < 1) continue;
      let mx = -1;
      base.forEach((v, j) => {
        if (j !== i && v > mx) mx = v;
      });
      const g = St.gradeOf(mx);
      if (mx <= base[i] || g === St.gradeOf(base[i])) continue;
      const row = G.find(r => r[1] === g);
      if (!row) continue;
      nb[i] = +row[0];
      notes.push(`${KO[i]} 종족치 ${base[i]}→${nb[i]} (${g})`);
    }
    if (!notes.length) return m;
    const s0 = St.statsOf(base, m.iv, m.ev, m.lv),
      s1 = St.statsOf(nb, m.iv, m.ev, m.lv);
    const x = Object.assign({}, m);
    x.stats = (m.stats || []).slice();
    for (let i = 1; i < 6; i++) if (nb[i] !== base[i]) x.stats[i] = Math.max(1, (+x.stats[i] || 0) + s1[i] - s0[i]);
    x.topNote = notes.join(' · ');
    return x;
  }
  /* 11-15 망령 「에이스 방호 뚫게 해」: 「①이 발동했을 때 대상의 『에이스』 포텐셜의 【방호】 효과를 무시」(킬러 · 디스럽터 ②) — 맞는 쪽의 『에이스』 배율(방어 · 특방 · 회피)을 빼고 계산한 사본 */
  const ACE_HO_RE = /대상의\s*『\s*에이스\s*』\s*포텐셜의\s*【\s*방호\s*】\s*효과를\s*무시/;
  function aceDef(atk, def) {
    try {
      if (!atk || !def || atk.id === def.id) return def;
      if (!potSrc(atk).some(p => p && ACE_HO_RE.test(String(p.eff || '')))) return def;
      const es = ((def.fx || {}).mults || []).filter(
        e =>
          e &&
          String(e.name || '')
            .replace(/『|』/g, '')
            .trim() === '에이스'
      );
      if (!es.length) return def;
      const x = Object.assign({}, def);
      x.mod = Object.assign({}, def.mod || {});
      for (const e of es)
        for (const k of ['defense', 'specialdefense', 'evasion']) {
          const v = +(e.stats || {})[k] || 1;
          if (v > 1 && x.mod[k]) x.mod[k] = Math.round((+x.mod[k] / v) * 1000) / 1000;
        }
      x._aceHo = 1;
      return x;
    } catch (e) {
      return def;
    }
  }
  function foulAtk(atk, def, mv) {
    try {
      if (mv && mv.cat !== '변화' && FX() && FX().asOf) {
        const ak = FX().asOf(atk, def, moveQuery(atk, def, mv, [mv.typeEn].filter(Boolean), 1, true));
        const SI2 = { attack: 1, defense: 2, specialattack: 3, specialdefense: 4, speed: 5 };
        if (ak && SI2[ak]) {
          const to = mv.cat === '특수' ? 'specialattack' : 'attack';
          if (to !== ak) {
            const x = Object.assign({}, atk);
            x.stats = (atk.stats || []).slice();
            x.stats[SI2[to]] = (atk.stats || [])[SI2[ak]] || x.stats[SI2[to]];
            x.rank = Object.assign({}, atk.rank || {}, { [to]: +((atk.rank || {})[ak] || 0) });
            x.mod = Object.assign({}, atk.mod || {}, { [to]: +((atk.mod || {})[ak] || 1) });
            atk = x;
          }
        }
      }
    } catch (e) {
      console.warn('계산:능력치', e);
    }
    /* 11-23 10:49 「자신의 「스피드」로 대미지 계산」(구문 위력 ×1 계산:스피드) — 공격(특수기는 특공) 자리에 그 능력치 · 랭크 · 배율 */ {
      const md = mv && mv.mvmod;
      const SI = { 공격: 1, 방어: 2, 특공: 3, 특방: 4, 스피드: 5 };
      if (md && md.to && md.from && SI[md.to] && SI[md.from]) {
        const x = Object.assign({}, atk);
        x.stats = (atk.stats || []).slice();
        x.stats[SI[md.to]] = (atk.stats || [])[SI[md.from]] || x.stats[SI[md.to]];
        atk = x;
      }
    }
    /* 11-15: 「이 때 자신의 「공격」을 「특방」과 같게」 — 그 판 대미지부터 (mvModApply) */ if (!def || !FOUL_RE.test(String((mv || {}).eff || '')))
      return atk;
    const x = Object.assign({}, atk);
    x.stats = (atk.stats || []).slice();
    x.stats[1] = (def.stats || [])[1] || x.stats[1];
    x.rank = Object.assign({}, atk.rank || {}, { attack: +((def.rank || {}).attack || 0) });
    x.mod = Object.assign({}, atk.mod || {}, { attack: +((def.mod || {}).attack || 1) });
    return x;
  }
  /* 이제 창이 알아서 하는 「손으로」 문장 (속임수 · 날씨 차지 생략 · 날씨 위력 반감 · 난동부리기) */
  const autoNote = t =>
    FOUL_RE.test(String(t)) ||
    /「날씨\s*:[^」]*」일 때 「차지」를 생략|「날씨\s*:[^」]*」일 때 「필중기」|「날씨\s*:[^」]*」일 때 「명중\s*:\s*\d+」|「날씨\s*:[^」]*」일 때 위력을 반감|「기술 방어」\s*상태가 된다|^「난동부리기\s*\(혼란\)\s*:\s*\d+~\d+회」$/.test(
      String(t).trim()
    );
  /* 11-15 망령 「방어 기술의 추가 효과 왜 자동화 안 돼 있는데」: 기술 방어 기술의 덤 — 「(비)접촉기」를 무효화/방어했을 때 · 기술을 무효화했을 때 + 그 뒤 글.
    대상 · 상대(의 · 에게 · 을) → 때린 쪽, 없으면 → 막은 쪽 자신. 1/8 비례 대미지 · 1/8 드레인 · 임의 교대 · 강제 교대는 따로. (토치카 · 니들가드 · 킹실드 · 블로킹 · 버블가드 · 정신으로방어 · 드래곤가드 · 체인가드 …) */
  function protRider(mv) {
    const e = String((mv || {}).eff || '');
    const m = e.match(/(「비접촉기」를|「접촉기」를|기술을)\s*(?:무효화|방어)했을\s*때,?\s*([^.]+)/);
    if (!m) return null;
    const R = { when: m[1].includes('비접촉') ? 'nc' : m[1].includes('접촉') ? 'c' : 'any', ops: [], extra: '', text: m[0].trim() };
    let body = m[2].trim();
    if (/1\/8의\s*비례\s*대미지/.test(body)) {
      R.extra = 'pct8';
      return R;
    }
    if (/「HP」를\s*1\/8만큼\s*드레인/.test(body)) {
      R.extra = 'drain8';
      return R;
    }
    if (/임의\s*교대/.test(body)) {
      R.extra = 'selfsw';
      return R;
    }
    if (/강제\s*교대/.test(body)) {
      R.extra = 'force';
      return R;
    }
    const TP = /^(?:상대|대상)(?:의|에게|을|를)\s*/;
    const toT = TP.test(body);
    body = body.replace(TP, '');
    let P = null;
    try {
      P = window.OM_MOVEAUTO.parse({ name: '방어 덤', cat: '변화', range: toT ? '1체' : '자신', eff: body + '.' });
    } catch (x) {}
    R.ops = ((P && P.groups) || []).flatMap(g => g.ops || []).map(op => Object.assign({}, op, { tgt: toT ? 'target' : 'self' }));
    return R.ops.length ? R : null;
  }
  async function protRiderFire(atkId, defId, contact, mvName) {
    if (!FX()) return;
    const c = ctx();
    const b = c.b;
    const def = b.mons[defId],
      atk = b.mons[atkId];
    if (!def || !atk) return;
    const lm = def.lastMove;
    const nm = typeof lm === 'string' ? lm : lm && lm.name;
    if (!nm || (lm && typeof lm === 'object' && +lm.turn !== (+b.turn || 0))) return;
    const pm = MVS(def).find(x => x && x.name === nm) || Object.assign({ name: nm }, (DB().moves || {})[nm] || {});
    if (!protMove(pm)) return;
    const R = protRider(pm);
    if (!R) return;
    if (R.when === 'c' && !contact) return;
    if (R.when === 'nc' && contact) return;
    const head = `【방어 덤】 ${def.name} 『${nm}』 — 「${mvName || '기술'}」을(를) 막아서`;
    if (R.extra === 'selfsw') {
      A().sysLog(`${head}\n${def.name} 임의 교대할 수 있다 — 교대 창에서`, 'battle');
      return;
    }
    if (R.extra === 'force') {
      if (atk.entry && atk.hp.cur > 0 && !(await switchGuard(atk))) {
        A().sysLog(`${head}\n${atk.name} 강제 교대`, 'battle');
        await forcedSwitch(atk.id, { sys: true });
      }
      return;
    }
    const nb0 = snap(b),
      nb = snap(nb0);
    const d = nb.mons[defId],
      a = nb.mons[atkId];
    const lines = [];
    if (R.extra === 'pct8' || R.extra === 'drain8') {
      if (a.hp.cur <= 0) return;
      const v = Math.min(a.hp.cur, Math.max(1, Math.floor(a.hp.max / 8)));
      a.hp.cur -= v;
      lines.push(`${a.name} −${v} (1/8) → ${a.hp.cur}/${a.hp.max}`);
      if (R.extra === 'drain8' && d.hp.cur > 0) {
        const h = Math.min(v, d.hp.max - d.hp.cur);
        d.hp.cur += h;
        lines.push(`${d.name} +${h} 회복`);
      }
      if (a.hp.cur <= 0) lines.push(`${a.name}은(는) 쓰러졌다!`);
    } else {
      const r = await FX().run(R.ops.map(tgtFor(d, a)), Object.assign({}, uiCtx(nb, d, nm), { pick: list => list.find(q => q.id === a.id) || null }));
      lines.push(...r.lines);
    }
    if (!lines.length) return;
    if (await saveBattle(nb0, nb)) A().sysLog([head, ...lines].join('\n'), 'battle', { mid: defId });
    if (nb.mons[atkId] && nb.mons[atkId].hp.cur <= 0)
      try {
        await faintOff(atkId);
      } catch (e) {}
  }
  function consecFail(atk, mv, T) {
    const cm = String((mv && mv.eff) || '').match(/「연속\s*제한\s*:\s*(실패\s*확률\s*증가|확정\s*실패)」/);
    if (!cm || protMove(mv)) return '';
    const lm = atk && atk.lastMove;
    if (!lm || lm.name !== mv.name || +lm.turn !== T - 1) return '';
    if (/확정/.test(cm[1])) return '연속으로 내보내';
    const k = Math.max(1, +(atk.consec && atk.consec.name === mv.name ? atk.consec.n : 1));
    const ch = Math.pow(1 / 3, k);
    return Math.random() < ch ? '' : `연속으로 내보내 (성공 ${Math.round(ch * 1000) / 10}% 판정 실패)`;
  }
  const protMove = mv =>
    /「(기술|공격) 방어」\s*상태가 된다|자신에 대한 공격을 방어한다/.test(
      String((mv || {}).eff || '')
    ); /* 11-15: 정신으로방어 「자신에 대한 공격을 방어한다」도 */
  /* 11-07 망령 「저주는 방어 관통이야」: 효과 글에 「방어」 무시가 없어도 이름으로 관통하는 기술 */
  const PROT_PASS = ['저주'];
  function noPierce(m) {
    if (!m) return false;
    try {
      if (
        FX() &&
        FX().liveMods &&
        FX()
          .liveMods(m)
          .some(e => e && e.np)
      )
        return true;
    } catch (e) {}
    const T = [m.abilityEff || '', ...potSrc(m).map(p => p.eff || '')].join('\n');
    return /「?방어」?[^.\n]{0,30}관통(?:\s*\(?\s*해제\s*\)?)?\s*(?:당하지|되지)\s*않는다/.test(T);
  } /* 11-11 「관통(해제) 당하지 않는다」 */
  const protBypass = mv => {
    const e = String((mv || {}).eff || '');
    if (
      PROT_PASS.includes(
        String((mv || {}).name || '')
          .replace(/[『』]/g, '')
          .trim()
      )
    )
      return 'pass';
    if (!/「방어」(?:「[^」]*」)*\s*상태를\s*무시/.test(e)) return '';
    return /무시\(해제\)|「방어」[^.\n]{0,30}해제/.test(e) ? 'clear' : 'pass';
  }; /* 11-14 망령 「방어 상태 무시는 그 기술만 무시 — 해제한다고 적힌 것만 해제」: 글의 다른 「해제한다」(랭크 · 장벽 …)로는 해제가 되지 않게 「방어」 가까이의 해제만 본다 */
  /* 10-26 망령: 숙달 지령 ② 는 정해진 때에 【임의】로 쓸 수 있다 — 명중굴림 전(공격 창)에 쓸 수 있는 것을 알려 준다.
    아군(공격하는 쪽): 숙달 공격 · 특공 · 저격 / 상대(맞는 쪽): 숙달 방어 · 특방 · 회피. 【공유 (『지령』)】 이라 그 턴에 지령을 이미 썼으면 못 쓴다 */
  function masterUsable(b, tid, re) {
    const t = (b.trainers || {})[tid];
    if (!t) return [];
    const fired = ((b.cmds || {})[tid] || {}).fired || {};
    if (Object.values(fired).some(x => x && x.command)) return [];
    return OO()
      .commandKeys(t)
      .map(k => ({ k, n: OO().commandName(t, k) }))
      .filter(x => re.test(x.n) && pN(b, tid, 'command_' + x.k) > 0);
  }
  function masterHint(b, atk) {
    if (!b || !atk) return '';
    const T = b.trainers || {};
    const rows = [];
    const mine = masterUsable(b, atk.tid, /^숙달(공격|특공|저격)지령$/);
    if (mine.length) rows.push({ tid: atk.tid, who: (T[atk.tid] || {}).name || '', list: mine });
    for (const [tid, t] of Object.entries(T)) {
      if (tid === atk.tid || t.side === (T[atk.tid] || {}).side) continue;
      const l = masterUsable(b, tid, /^숙달(방어|특방|회피)지령$/);
      if (l.length) rows.push({ tid, who: t.name || '', list: l });
    }
    if (!rows.length) return '';
    return `<div class="small amaster" style="margin:6px 0;padding:6px 8px;border:1px dashed var(--line,#888);border-radius:8px">💡 명중굴림 전 — 【임의】로 쓸 수 있는 숙달 지령: ${rows.map(r => `<b>${esc(r.who)}</b> ${r.list.map(x => `『${esc(x.n)}』`).join(' ')} <button type="button" class="btn xs" data-amfire="${esc(r.tid)}">발동 창</button>`).join(' · ')}<br><span class="dim">쓰면 이 창은 닫힌다 — 발동한 뒤 공격을 다시 연다.</span></div>`;
  }
  /* 효과 엔진의 확률 보정(「발동 확률 +N%p」 · 「확률 효과 반드시」)을 부가효과 칸 기본값으로 — 횟수가 있는 것은 알림만(손으로 넣고 「발동」 버튼으로 횟수를 쓴다) */
  function chanceLive(m) {
    const t = +(ctx().b || {}).turn || 0;
    return ((m && m.fx && m.fx.chance) || []).filter(e => !(e.until >= 0 && t > e.until) && e.uses !== 0);
  }
  function secAdd0(m) {
    return chanceLive(m)
      .filter(e => e.uses < 0 && !e.sure)
      .reduce((a, e) => a + (+e.v || 0), 0);
  }
  function secSure0(m) {
    return chanceLive(m).some(e => e.uses < 0 && e.sure);
  }
  function secNote(m) {
    const L = chanceLive(m);
    if (!L.length) return '1할 = 10%p';
    return L.map(
      e => `「${esc(e.name)}」 ${e.sure ? '반드시' : (e.v > 0 ? '+' : '') + e.v + '%p'}${e.uses > 0 ? ` (${e.uses}회 — 손으로)` : ''}`
    ).join(' · ');
  }
  /* 11-04 망령 「개선할거 다 개선」 (관사 시험 탐사): 카드의 「공격」을 누르면 공격 창 앞에서 두 가지를 먼저 본다 (GM 화면)
    ① 2턴(「차지」) 기술 — 지시한 기술이 「차지」인데 아직 안 모았으면 이번 턴은 모으기: 효과 글의 「반무적 : ○○」 상태(어둠 안 · 하늘 위 …)를 걸고
       기술 · 대상을 m.charge 에 적는다. 다음 턴에 「공격」을 누르면 그 기술 · 대상으로 창이 열리고, 적용하면 상태 · charge 를 지운다. 날씨로 생략되면 그냥 공격.
    ② 선행 입력한 방어 4식 — 지시 대상 중 『버텨라!』(늘) · 『물러나!』(물리기) · 『피해라!』(특수기)를 선행 입력하고 아직 안 쓴 포켓몬이 있으면 먼저 선행 발동한다
       (예전에는 턴 개시 때 횟수만 빠지고 효과는 GM 이 「포텐셜 발동」에서 따로 눌러야 해서, 버텨라가 빠진 채 대미지가 들어갔다) */
  /* 11-22 망령 「【자동】【보급】/「로켓펀치」로 상승하는 능력을 임의로 변경할 수 있다 — 이런 건?」: 모으는 턴에 기술 글의 「「차지」할 때 「방어 : +1」」을 건다 (예전엔 손으로).
    이 포켓몬 포텐셜에 「「기술」로 상승하는 능력을 임의로 변경」이 있으면 올릴 능력을 주인 화면에 묻는다 — 【보급】이면 바꾼 뒤 이번 등장엔 다시 묻지 않는다 (『변환술』과 같은 길) */
  const CRISE_RE = /((?:「[^」]+」\s*(?:[,·]|과|와)?\s*)+)\s*(?:으로|로)\s*상승하는\s*능력(?:치)?\s*(?:을|를)?\s*임의로\s*변경/;
  async function chargeRise(mid, mv) {
    try {
      const b = ctx().b;
      const m = (b.mons || {})[mid];
      if (!m || !mv || !FX()) return;
      const s = String(mv.eff || '').match(/「차지」\s*(?:할|하는)\s*때\s*,?\s*((?:「[^」]+?\s*[:：]\s*[+-]\d+」\s*(?:[,·]|과|와)?\s*)+)/);
      if (!s) return;
      const KO = ['공격', '방어', '특공', '특방', '스피드', '명중', '회피'];
      const ups = [...s[1].matchAll(/「([^」:：]+?)\s*[:：]\s*([+-]\d+)」/g)]
        .flatMap(x => x[1].split('/').map(k => [k.trim(), +x[2]]))
        .filter(([k]) => KO.includes(k));
      if (!ups.length) return;
      const nm = String(mv.name || '').trim();
      const conv = potSrc(m).find(p => {
        const r = String((p && p.eff) || '')
          .replace(/<br\s*\/?>/g, '\n')
          .match(CRISE_RE);
        return !!r && [...r[1].matchAll(/「([^」]+)」/g)].some(x => x[1].trim() === nm);
      });
      const parts = [],
        notes = [];
      let changed = false;
      for (const [k, v] of ups) {
        let k2 = k;
        if (conv && v > 0) {
          const ord = [k, ...KO.filter(x => x !== k)];
          const r = await uiCtx(b, m, String(conv.name).replace(/[『』]/g, '')).choose(
            ord.map((x, i) => `${x} +${v}` + (i === 0 ? ' (그대로)' : ''))
          );
          k2 = ord[Array.isArray(r) && r.length ? +r[0] : 0] || k;
          if (k2 !== k) {
            changed = true;
            notes.push(`『${String(conv.name).replace(/[『』]/g, '')}』 — ${k} 대신 ${k2}`);
          }
        }
        parts.push(`${k2}${v > 0 ? '+' : ''}${v}`);
      }
      if (changed && /【\s*보급\s*】/.test(String(conv.eff || ''))) await A().set(['battle', 'mons', mid, 'potTurn', '_sup', conv.name], 1);
      const ops = FX().parse('랭크 ' + parts.join(' ')).ops || [];
      if (!ops.length) return;
      await fireAuto(mid, 'move', nm, {
        auto: { name: nm, src: 'dyn', ops, text: '' },
        quiet: true,
        noRoll: true,
        force: true,
        noEv: 1,
        head: `【차지】 ${m.name} 『${nm}』 — 모으면서 ${parts.map(x => '「' + x.replace(/([+-]\d+)$/, ' : $1') + '」').join(' ')}${notes.length ? '\n' + notes.join('\n') : ''}`
      });
    } catch (e) {
      console.warn('chargeRise', e);
    }
  }
  function chargeVanish(mv) {
    const e = String((mv || {}).eff || '');
    const g = ((DB().states || {}).groups || []).find(x => x.l === '반무적');
    const db = (DB().states || {}).st || {};
    const m = e.match(/「반무적\s*:\s*([^」]+)」/);
    if (!m) return '';
    const ko = m[1].trim();
    return ((g && g.s) || Object.keys(db)).find(k => db[k] && db[k].ko === ko) || '';
  }
  /* 11-17 망령 「공중날기 · 다이브류가 충전하는 턴에 기술 공개할 때 물러나! 같은 게 발동해 버린다」: 모으는 턴은 공격이 아니니 방어 4식(버텨라! · 물러나! · 피해라!)을 걸지 않는다.
    차지 기술인데 아직 안 모았고 · 날씨로 생략되지 않고 · 파워풀허브도 없으면 = 모으는 턴. 모은 다음 턴(내보내는 턴)에는 그 기술 · 대상으로 방어 4식을 건다 (예전엔 GM 화면이 이 턴에 4식을 거치지 않았다) */
  /* 11-23 22:38 구문 「차지생략 [기술:X] [이번턴]」(fx nocharge → m.noCharge=[{by,mv,t}]) — 그 기술의 「차지」를 건너뛴다. 돌려주는 값 = 건 효과 이름 */
  function ncSkip(b, atk, mv) {
    try {
      const T = +(b || {}).turn || 0;
      for (const e of atk && Array.isArray(atk.noCharge) ? atk.noCharge : []) {
        if (!e || (+e.t && +e.t !== T)) continue;
        if ((e.mv || []).length && !e.mv.some(n => mvNameEq(n, mv.name))) continue;
        return e.by || '차지 생략';
      }
    } catch (e) {}
    return '';
  }
  function chargeTurnNow(b, atk, mv) {
    if (!mv || !/「차지」/.test(String(mv.eff || ''))) return false;
    const CH = atk.charge;
    if (CH && +CH.turn < (+b.turn || 0)) return false;
    if (ncSkip(b, atk, mv)) return false;
    const W = wxNow(b);
    const sk = String(mv.eff).match(/「날씨\s*:\s*([^」]+)」일 때 「차지」를 생략/);
    if (
      sk &&
      W &&
      sk[1]
        .split(/[,，]\s*/)
        .map(q => q.trim())
        .includes(W)
    )
      return false;
    if (HAS(atk, '파워풀허브')) return false;
    return true;
  }
  /* 11-23 망령 (카르멜리타 『스카르의 노래 여왕』 「「최후의 1체」일 때 「특성 : 반주」가 자신에게 적용된다」): 등장 뒤에 아군이 쓰러져 최후의 1체가 됐으면 공격 창을 열기 전에 특성을 자신에게 다시 건다 */
  async function selfAuraSync(mid) {
    try {
      const m = (ctx().b.mons || {})[mid];
      if (!m || !m.entry || !FX() || !FX().traitMods) return;
      const tm = FX().traitMods(m);
      if (!tm.selfGate || !tm.selfOn) return;
      const ab = abNm(m);
      if (!ab) return;
      const has = ((m.fx || {}).mods || []).some(
        x => x && x.kind === 'boost' && String(x.key || '').includes(ab) && String(x.key || '').includes('← ' + m.name)
      );
      if (has) return;
      await fireAuto(mid, 'trait', ab, {
        force: true,
        quiet: true,
        head: `【포텐셜】 ${m.name} 『${tm.selfOn}』 — 최후의 1체 · 「${ab}」가 자신에게 적용`
      });
    } catch (e) {
      console.warn('selfAuraSync', e);
    }
  }
  async function openAttackPre(mid) {
    await selfAuraSync(mid);
    const c = ctx();
    const b = c.b;
    const atk = (b.mons || {})[mid];
    if (!atk || !canEdit(c, atk)) return openAttack(mid);
    {
      const XO = (+b.phase || 0) >= 2 ? (b.order || [])[+b.orderIdx || 0] : null;
      if (XO && XO.xact && XO.mid === mid) return openAttack(mid);
    }
    /* 11-11 추가 행동 차례: 원래 지시(기술 · 차지 · 방어 4식)를 거치지 않고 그 기술로 바로 */ if (
      atk.reflPend &&
      +atk.reflPend.turn === (+b.turn || 0)
    )
      return openAttack(mid); /* 11-23 반사 공격 대기 */
    if (!c.gm) {
      /* 11-07: PL 화면 — 차지 처리는 GM 몫 그대로, 방어 4식만 (상대의 숨은 지시 대신 순서 열쇠 g4) */
      let x1 = (((b.cmds || {})[atk.tid] || {}).mons || {})[mid] || {};
      if (x1.move == null || x1.move === '') {
        try {
          const cm = await myCmd(c, atk.tid, true);
          const y = ((cm || {}).mons || {})[mid];
          if (y) x1 = Object.assign({}, y, { tm: y.tm || tmOf(b, y.targets) });
        } catch (e) {}
      }
      const mv1 = x1.move !== '' && x1.move != null && x1.move !== 'switch' ? MVS(atk)[+x1.move] : null;
      const CH1 = atk.charge;
      if (CH1 && +CH1.turn < (+b.turn || 0)) {
        const mvF = MVS(atk).find(q => q && q.name === CH1.mv);
        if (mvF && mvF.cat !== '변화') await guard4Pre(c, atk, mvF, { targets: CH1.targets || [] }, {});
      } else if (mv1 && mv1.cat !== '변화' && !atk.charge && !chargeTurnNow(b, atk, mv1)) await guard4Pre(c, atk, mv1, x1, {});
      return openAttack(mid);
    }
    let x0 = (((b.cmds || {})[atk.tid] || {}).mons || {})[mid] || {};
    const T = +b.turn || 0;
    let SECO = null;
    await secCmdRefresh(c, b); /* 11-07: 【수세】 · 【공세】 판정용 — 숨은 지시를 이 창 동안 기억 */
    /* 11-04 감우 (봉인 서고: 이요 「문포스」 지시가 「미스트볼」로 열림 ×2): 「다음 행동 ▶」의 지시 공개(b.cmds)가 저장되기 전에 공격 창을 열면 지시가 비어 1번 기술로 열렸다 — GM 은 숨은 지시(secret cmd)를 바로 읽어 그 기술 · 대상으로 연다 */
    if ((x0.move == null || x0.move === '') && !x0.switch && c.ST && c.ST.secret) {
      try {
        const rows = await DBS().secretGet(c.ST.room, c.ST.secret, 'cmd');
        for (const r of rows || []) {
          if (!cmdFresh(r, b)) continue;
          const y = ((r.data || {}).mons || {})[mid];
          if (y && y.move != null && y.move !== '' && y.move !== 'switch') {
            x0 = Object.assign({}, y, { tm: y.tm || tmOf(b, y.targets) });
            SECO = { mvIdx: +y.move, targets: tgNow(b, x0, atk) };
            break;
          }
        }
      } catch (e) {
        console.warn('숨은 지시 읽기', e);
      }
    }
    /* ①-2 모은 다음 턴: 그 기술 · 대상으로 */
    const CH = atk.charge;
    if (CH && +CH.turn < T) {
      const mi = MVS(atk).findIndex(q => q && q.name === CH.mv);
      const slots = allEntered(b);
      const tg = (CH.targets || []).filter(sl => slots.some(z => z.slot === sl));
      const mvF = mi >= 0 ? MVS(atk)[mi] : null;
      if (mvF && mvF.cat !== '변화') {
        let SEC = {};
        try {
          const rows = await DBS().secretGet(c.ST.room, c.ST.secret, 'cmd');
          for (const r of rows || []) {
            if (!cmdFresh(r, b)) continue;
            for (const k in (r.data || {}).mons || {}) SEC[k] = r.data.mons[k];
          }
        } catch (e) {}
        await guard4Pre(c, atk, mvF, { targets: tg }, SEC);
      } /* 11-17 내보내는 턴에 방어 4식 */
      return openAttack(mid, mi >= 0 ? { mvIdx: mi, targets: tg.length ? tg : undefined, chargeFire: 1 } : {});
    }
    const mv = x0.move !== '' && x0.move != null && x0.move !== 'switch' ? MVS(atk)[+x0.move] : null;
    if (mv && /「차지」/.test(String(mv.eff || '')) && !(CH && +CH.turn === T)) {
      const W = wxNow(b);
      const sk = String(mv.eff).match(/「날씨\s*:\s*([^」]+)」일 때 「차지」를 생략/);
      const NC = ncSkip(b, atk, mv);
      if (NC)
        A().sysLog(
          `【포텐셜】 ${atk.name} 『${String(NC).replace(/[『』]/g, '')}』 — 『${mv.name}』의 「차지」를 생략한다 (차지 때의 효과는 손으로)`,
          'battle',
          { mid, img: atk.image || '' }
        );
      const skip =
        !!NC ||
        (sk &&
          W &&
          sk[1]
            .split(/[,，]\s*/)
            .map(q => q.trim())
            .includes(W));
      const herb = !skip && HAS(atk, '파워풀허브');
      if (herb) {
        await itemConsume(mid, false, '파워풀허브');
        A().sysLog(`【소지품】 ${atk.name} 「파워풀허브」 — 『${mv.name}』의 「차지」를 생략한다 (차지 때의 효과는 손으로)`, 'battle', {
          mid,
          img: atk.image || ''
        });
      } /* 11-08 51-2 ⑨ */
      if (!skip && !herb) {
        const vk = chargeVanish(mv);
        const vko = vk ? (((DB().states || {}).st || {})[vk] || {}).ko || vk : '';
        const tg = x0.tm ? tgNow(b, x0, atk) : x0.targets || [];
        if (
          await askYes(
            `「${mv.name}」은 「차지」 기술 — 이번 턴은 모으기만 한다.${vko ? `\n${atk.name} 은(는) 「${vko}」 상태가 되어 상대의 기술을 받지 않는다.` : ''}\n다음 턴에 「공격」을 누르면 이 기술과 지시한 대상으로 창이 열린다.`,
            '모으기',
            '그냥 공격 창'
          )
        ) {
          const st = Object.assign({}, atk.states || {});
          if (vk) st[vk] = 2;
          await A().setMany([
            [['battle', 'mons', mid, 'states'], st],
            [['battle', 'mons', mid, 'charge'], { mv: mv.name, turn: T, targets: tg }]
          ]);
          A().sysLog(`【차지】 ${atk.name} 『${mv.name}』 — 모으기${vko ? ` · 「${vko}」` : ''} (다음 턴에 내보낸다)`, 'battle');
          await chargeRise(mid, mv);
          return;
        }
      }
    }
    /* ② 선행 입력한 방어 4식 */
    if (mv && mv.cat !== '변화') {
      let SEC = {};
      try {
        const rows = await DBS().secretGet(c.ST.room, c.ST.secret, 'cmd');
        for (const r of rows || []) {
          if (!cmdFresh(r, b)) continue;
          for (const k in (r.data || {}).mons || {}) SEC[k] = r.data.mons[k];
        }
      } catch (e) {}
      await guard4Pre(c, atk, mv, x0, SEC);
    }
    return openAttack(mid, SECO || undefined);
  }
  /* 맞을 때 쓰는 방어 4식 선행 발동 — SEC: 읽을 수 있는 숨은 지시(GM), 없으면 그 트레이너가 올린 순서 열쇠의 g4 */
  async function guard4Pre(c, atk, mv, x0, SEC) {
    const b = ctx().b;
    /* 11-20 제보 「풀죽음 상태인 상대의 지시에 대응해서 선행 입력한 피해라가 자동 발동된다」: 공격하는 쪽이 이번 턴 움직이지 못하면(풀죽음 · 각성체 대가 A-1 행동 불능) 공격이 나오지 않으니 방어 4식을 걸지 않는다 — 횟수도 안 쓴다 */
    if ((atk.states || {}).Flinch || misagA1(b, atk)) return;
    const slots = allEntered(b);
    const tg = x0.tm ? tgNow(b, x0, atk) : x0.targets || [];
    const fired = [];
    const tk = turnKey(b);
    for (const sl of tg) {
      const z = slots.find(q => q.slot === sl);
      if (!z || sameT(z.mon, atk, b)) continue;
      const dm = z.mon;
      const t = (b.trainers || {})[dm.tid];
      if (!t) continue;
      const ok = ((b.cmds || {})[dm.tid] || {}).ok;
      const g4 = ok && ok.key === tk && ok.m && ok.m[dm.id] && ok.m[dm.id].g4;
      const okey = ((SEC || {})[dm.id] || {}).order || g4;
      if (!okey) continue;
      const done = ((((ctx().b.cmds || {})[dm.tid] || {}).fired || {})[dm.id] || {}).order;
      if (done) continue;
      const nm = OO().orderName(t, okey);
      const fit = nm === '버텨라!' || (nm === '물러나!' && mv.cat === '물리') || (nm === '피해라!' && mv.cat === '특수');
      if (!fit) continue;
      try {
        await fireOrder(dm.tid, dm.id, 'order', okey, 'pre');
        if (((((ctx().b.cmds || {})[dm.tid] || {}).fired || {})[dm.id] || {}).order) fired.push(`${dm.name} 『${nm}』`);
      } catch (e) {
        console.warn('방어 4식 선행 발동', e);
      }
    }
    if (fired.length) A().toast('선행 발동 — ' + fired.join(' · '));
  }
  /* 11-10 망령 「벌레침략(미래예지 계열) 공격에 버텨라 반감」: 예고 공격은 공격 창을 거치지 않아 선행 입력한 『버텨라!』가 안 걸렸다 —
    턴 종료 처리 전에, 이번 턴 끝에 예고 공격을 맞을 포켓몬이 『버텨라!』를 선행 입력하고 아직 안 썼으면 먼저 선행 발동한다 (물러나! · 피해라! 는 명중 판정이 없는 공격이라 안 건다) */
  async function guard4Future() {
    const c = ctx();
    const b = c.b;
    const db = (DB().states || {}).st || {};
    const tk = turnKey(b);
    let SEC = null;
    const fired = [];
    for (const mid in b.mons || {}) {
      const m = b.mons[mid];
      const r = m && m.futRsv;
      if (!r || !m.entry || !(m.hp && m.hp.cur > 0)) continue;
      const v = +(m.states || {})[r.st];
      const def = db[r.st] || {};
      if (!((def.prog === 'turn' || def.prog === 'once') && !movesDown(r.st, def) && v > 0 && v < 1000 && v - 1 <= 0)) continue;
      if ((m.flags || {}).endure) continue;
      const t = (b.trainers || {})[m.tid];
      if (!t) continue;
      if (SEC == null) {
        SEC = {};
        if (c.ST && c.ST.secret) {
          try {
            const rows = await DBS().secretGet(c.ST.room, c.ST.secret, 'cmd');
            for (const x of rows || []) {
              if (!cmdFresh(x, b)) continue;
              for (const k in (x.data || {}).mons || {}) SEC[k] = x.data.mons[k];
            }
          } catch (e) {}
        }
      }
      const ok = ((b.cmds || {})[m.tid] || {}).ok;
      const g4 = ok && ok.key === tk && ok.m && ok.m[mid] && ok.m[mid].g4;
      const okey = (SEC[mid] || {}).order || g4;
      if (!okey) continue;
      if (((((ctx().b.cmds || {})[m.tid] || {}).fired || {})[mid] || {}).order) continue;
      if (OO().orderName(t, okey) !== '버텨라!') continue;
      try {
        await fireOrder(m.tid, mid, 'order', okey, 'pre');
        if (((((ctx().b.cmds || {})[m.tid] || {}).fired || {})[mid] || {}).order) fired.push(`${m.name} 『버텨라!』`);
      } catch (e) {
        console.warn('예고 공격 버텨라 선행 발동', e);
      }
    }
    if (fired.length) A().toast('선행 발동 (예고 공격) — ' + fired.join(' · '));
  }
  /* ===== 11-05 은열쇠 배틀 카드 (세 칸 · 노트 32 3차): 공격 창 결과에서 조건이 맞으면 「🗝 카드」 단추 — 자기 포켓몬에게만 · 쓰면 버림 =====
    명중다시 아군(실타래 되감기) · 명중다시 상대(요정의 장난) · 급소무효 1(안개의 환영) · 난수다시(위기일발!) · 부가무시 30(약간 은밀한 망토) · 행동다시(다시 일어서) */
  const s3tid = (b, m) => {
    const t = (b.trainers || {})[m && m.tid] || {};
    return t.srcTid || (m && m.tid) || '';
  };
  const s3b = tid => {
    const h = ((A().ST.state.sk3 || {}).h || {})[tid];
    const x = h && h.b;
    return x && x.on && x.n ? x : null;
  };
  const s3e = n => {
    try {
      return window.OM_SK3FX ? window.OM_SK3FX.of(n) : null;
    } catch (e) {
      return null;
    }
  };
  const s3mine = (c, tid) => !!(c.gm || (c.seat && tid === c.seat));
  const s3card = (c, tid, code, argRe) => {
    const x = s3b(tid);
    const e = x && s3e(x.n);
    return e && e.code === code && (!argRe || argRe.test(e.arg || '')) && s3mine(c, tid) ? x : null;
  };
  async function s3use(tid, why) {
    const R = window.OM_SK3R;
    if (R && R.run) await R.run({ op: 'use', tid, k: 'b', quiet: 1, why });
  }
  /* 11-15 망령 「만들 후보 만들고」: 「턴 종료 시까지 아군을 「유사 방어」 상태로 만들어 받는 대미지를 반감」(감싸기) — 상태 DB 에 「유사 방어」가 없어, 맞은 아군에게 이번 턴 받는 대미지 ×0.5(완화 · 이번턴)를 건다. 연속 제한은 방어 태그로 웹툴이 이미 본다 */
  /* 11-15 망령 「아지 다하카 사슬묶기 줄기 구현」:
    ① 「「특성 : X」가 발동한 턴 「얼음/독/악」 대미지를 무효화한다」 — 특성 X 가 발동하면 그 턴 그 타입 대미지 ×0 (chainT = 그 턴)
    ② 「①의 효과를 발동한 턴 행동 후 「사슬묶기」 상태가 된다」 — 그 턴 행동한 뒤 사슬묶기
    ③ 「「사슬묶기」 상태가 되었을 때 턴 종료 시까지 행동불능」 — 아직 행동 안 했으면 이번 턴 행동 못 함(noActT)
    ④ 「「사슬묶기」 상태가 턴 경과에 의해 해제되었을 때 「모든 능력치 : +N」」 — 턴 종료에서 사슬묶기가 저절로 풀리면
    ⑤ 「조건 상태:X + 배율」 같은 상태 조건 상시(『멸망룡의 삼두』)는 상태가 있을 때만 걸리는 배율로 (등장 때 상태가 없어 안 걸리던 것) */
  const CHAIN_IMM_RE = /「\s*특성\s*:\s*([^」]+)」\s*(?:이|가)\s*발동한\s*턴\s*「([^」]+)」\s*대미지를\s*무효화/;
  async function traitFired(mid, name) {
    try {
      const b = ctx().b;
      const m = b.mons[mid];
      if (!m) return;
      const T = +b.turn || 0;
      for (const q of potSrc(m)) {
        if (!q || q.ph) continue;
        const mm = String(q.eff || '').match(CHAIN_IMM_RE);
        if (!mm || mm[1].replace(/\s/g, '') !== String(name).replace(/\s/g, '')) continue;
        const types = mm[2]
          .split(/[\/,·]/)
          .map(z => S().typeEn(z.trim()))
          .filter(Boolean);
        if (!types.length) continue;
        await A().set(['battle', 'mons', mid, 'chainT'], T);
        await fireAuto(mid, 'pot', q.name, {
          auto: {
            name: q.name,
            src: 'dyn',
            ops: [
              { k: 'guard', tgt: 'self', v: 0, types, cat: 'all', eff: 'all', rng: 'all', uses: -1, turn: 1, tl: 0, ro: [], st: '', tg: [], sb: '' }
            ]
          },
          quiet: true,
          noRoll: true,
          force: true,
          head: `【포텐셜】 ${m.name} 『${q.name}』 — 「특성 : ${name}」 발동 · 이번 턴 「${mm[2]}」 대미지 무효`
        });
      }
    } catch (e) {
      console.warn('traitFired', e);
    }
  }
  async function chainAfterAct(mid) {
    try {
      const b = ctx().b;
      const m = b.mons[mid];
      if (!m || !m.entry || m.hp.cur <= 0) return;
      const T = +b.turn || 0;
      if (+m.chainT !== T || (m.states || {}).Disable) return;
      const q = potSrc(m).find(
        z => z && !z.ph && /①\s*의\s*효과를\s*발동한\s*턴\s*행동\s*후\s*「\s*사슬묶기\s*」\s*상태가\s*된다/.test(String(z.eff || ''))
      );
      if (!q) return;
      await fireAuto(mid, 'pot', q.name, {
        auto: { name: q.name, src: 'dyn', ops: FX().parse('상태 사슬묶기 자신').ops },
        quiet: true,
        noRoll: true,
        force: true,
        head: `【포텐셜】 ${m.name} 『${q.name}』 ② — 행동 후 「사슬묶기」`
      });
      await chainBound(mid);
    } catch (e) {
      console.warn('chainAfterAct', e);
    }
  }
  async function chainBound(mid) {
    const b = ctx().b;
    const m = b.mons[mid];
    if (!m || !(m.states || {}).Disable) return;
    const T = +b.turn || 0;
    const q = potSrc(m).find(
      z => z && !z.ph && /「\s*사슬묶기\s*」\s*상태가\s*되었을\s*때\s*턴\s*종료\s*시?까지\s*행동\s*불능/.test(String(z.eff || ''))
    );
    if (!q) return;
    const acted = m.lastMove && +m.lastMove.turn === T;
    await A().set(['battle', 'mons', mid, 'noActT'], T);
    A().sysLog(`【포텐셜】 ${m.name} 『${q.name}』 ① — 「사슬묶기」 · 턴 종료까지 행동불능${acted ? ' (이미 행동함)' : ''}`, 'battle', { mid });
  }
  /* ④ 사슬묶기가 턴 경과로 풀렸을 때 (턴 종료 상태 감소에서) */
  function chainFree(m, lines) {
    try {
      if (!m || !m.entry || m.hp.cur <= 0) return;
      const q = potSrc(m).find(
        z =>
          z &&
          !z.ph &&
          /「\s*사슬묶기\s*」\s*상태가\s*턴\s*경과에\s*의해\s*해제되었을\s*때\s*「\s*모든\s*능력치\s*:\s*\+\s*\d/.test(String(z.eff || ''))
      );
      if (!q) return;
      const n = +String(q.eff).match(/모든\s*능력치\s*:\s*\+\s*(\d)/)[1];
      m.rank = m.rank || {};
      for (const k of ['attack', 'defense', 'specialattack', 'specialdefense', 'speed']) m.rank[k] = Math.min(6, (+m.rank[k] || 0) + n);
      lines.push(`${m.name} 『${q.name}』 ② — 「사슬묶기」가 풀렸다 · 모든 능력치 +${n}`);
    } catch (e) {}
  }
  function csFromCond(ops) {
    if (!Array.isArray(ops)) return null;
    const cs = ops.filter(o => o && o.k === 'cond');
    if (cs.length !== 1 || cs[0].c !== 'self_state' || !cs[0].st) return null;
    const rest = ops.filter(o => o && o.k !== 'cond');
    if (!rest.length || !rest.every(o => ['boost', 'guard', 'mult'].includes(o.k))) return null;
    return rest.map(o => Object.assign({}, o, { cs: cs[0].st }));
  }
  const DYN_TYPE_RE =
    /아군의\s*「\s*타입\s*2\s*」\s*와\s*같은\s*타입이\s*된다|아군을\s*대상의\s*「\s*타입\s*1\s*」\s*로\s*만든다|턴\s*개시\s*시\s*『\s*[^』]+\s*』\s*인\s*아군이\s*에리어를\s*이동한다/; /* 11-15: 이대도강 (에리어 이동 고유)도 */
  async function coverFire(mid, R) {
    try {
      if (!R || R.check || !R.mv || !/「\s*유사\s*방어\s*」\s*상태로/.test(String(R.mv.eff || ''))) return;
      const b = ctx().b;
      for (const r of R.targets || []) {
        const id = r && r.def && r.def.id;
        const t = id && b.mons[id];
        if (!t || !t.entry || t.hp.cur <= 0) continue;
        if (r.acc && r.acc.hit === false) continue;
        await fireAuto(id, 'pot', R.mv.name, {
          auto: {
            name: R.mv.name,
            src: 'move',
            ops: [
              {
                k: 'guard',
                tgt: 'self',
                v: 0.5,
                types: [],
                cat: 'all',
                eff: 'all',
                rng: 'all',
                uses: -1,
                turn: 1,
                tl: 0,
                ro: [],
                st: '',
                tg: [],
                sb: ''
              }
            ]
          },
          quiet: true,
          noRoll: true,
          force: true,
          head: `【기술】 ${(b.mons[mid] || {}).name || ''} 『${R.mv.name}』 → ${t.name} 「유사 방어」 — 이번 턴 받는 대미지 ×0.5`
        });
      }
    } catch (e) {}
  }
  const ACTFX = {}; /* 11-07 「행동한 뒤」 자동 — mid|포텐셜 → 건 턴 */
  function openAttack(mid, opt) {
    opt = opt || {};
    const c = ctx();
    const b = c.b;
    const atk = b.mons[mid];
    if (!atk || !canEdit(c, atk)) return;
    {
      const XO = (+b.phase || 0) >= 2 ? (b.order || [])[+b.orderIdx || 0] : null;
      if (XO && XO.xact && XO.mid === mid && !opt.mvName)
        opt = Object.assign({}, opt, {
          mvName: XO.move,
          targets: (XO.targets || []).slice(),
          by: XO.xact,
          preT: 1,
          skipSt: XO.skipSt || '',
          ...(XO.refl ? { refl: XO.refl, rangeDone: 1 } : {})
        });
    } /* 11-09 선행 추가 행동 차례 */
    /* 11-23 망령 「기술의 반사」: RF = 반사 공격(반사한 포켓몬이 공격자 · 대상은 원래 쓴 포켓몬). 대미지는 반사한 쪽 능력치로, 반동 · 추가 효과는 원래 쓴 포켓몬(RF.from)에게. 4식 타이밍 · 『맞춰라!』 · 「등장 후 첫 기술」 · 「다음 기술」 효과는 붙지 않는다 */ if (
      !opt.refl &&
      !opt.mvName &&
      !opt.extra &&
      atk.reflPend &&
      +atk.reflPend.turn === (+b.turn || 0) &&
      (b.mons || {})[atk.reflPend.from]
    ) {
      const P = atk.reflPend;
      opt = Object.assign({}, opt, {
        mvName: (P.mv || {}).name,
        targets: (P.targets || []).slice(),
        by: P.xact || '반사',
        preT: 1,
        refl: { from: P.from, by: P.by, mv: P.mv },
        rangeDone: 1
      });
    }
    /* 11-23 순서 없이 반사된 것(reflPend) — 카드 「공격」으로 */ const RF = opt.refl && (b.mons || {})[opt.refl.from] ? opt.refl : null;
    const RNDT = {};
    const rndOf = mv => (isRndMove(mv) ? RNDT[mv.name] || (RNDT[mv.name] = rndType()) : '');
    /* 11-04 망령: 「무작위」 타입 기술 — 이 공격 창을 열 때 기술마다 한 번 굴린다 (미리보기 · 판정 · 로그가 같은 타입) */ const f = fieldOf(b);
    const atkD = topShadow(atk, opt.baseTop);
    /* 11-23 18시 망령 「데이터가 해석된 상대에게 「스타브레이커」를 내보낼 때 「특공」을 가장 높은 종족치와 같은 랭크로」: 구문 「기술최고 특공 기술:스타브레이커 상대해석됨」(sp topmv) — 기술 · 대상마다 조건을 보고 그 계산에서만 */ const ATKD =
      (def, mv) => {
        try {
          const tp = topMvOf(atk, def, mv);
          if (!tp.length) return atkD;
          return topShadow(atk, [...new Set([...(opt.baseTop || []), ...tp])]);
        } catch (_) {
          return atkD;
        }
      };
    const UMA = UMB(atk); /* 51-2 ⑫ 만능우산: 공격 쪽이 지니면 날씨 배율 · 필중 · 명중 · 차지 생략 · 타입 변화 없음 */
    /* 11-03 「기술사용」 · 「추가공격」: opt.mvName(기술 이름 — 목록에 없으면 기술 DB 에서 잠시 붙인다) · opt.targets · opt.extra {pw, sure, left, name} */
    if (opt.mvName && !opt.rangeDone) {
      const R = mvRange(atk, opt.mvName);
      if (R) {
        const lab = `『${String(opt.by || '추가 행동').replace(/[『』]/g, '')}』 「${opt.mvName}」`;
        if (!R.length) {
          A().toast(`${atk.name} — 「${opt.mvName}」에 맞는 기술이 없다`);
          return;
        }
        if (R.length === 1) {
          opt = Object.assign({}, opt, { mvName: MVS(atk)[R[0]].name, rangeDone: 1 });
        } else {
          mvRangePick(
            atk,
            lab,
            R.map(i => {
              const q = MVS(atk)[i];
              return `${q.name} (${q.type || ''} · ${q.cat || ''}${q.pow ? ' · 위력 ' + q.pow : ''})`;
            })
          ).then(k => {
            if (k < 0) return;
            openAttack(mid, Object.assign({}, opt, { mvName: MVS(atk)[R[k]].name, rangeDone: 1 }));
          });
          return;
        }
      }
    } /* 11-09 범위 기술 고르기 */
    delete XMV[mid];
    let OPI = -1;
    if (RF && RF.mv && RF.mv.name) {
      XMV[mid] = Object.assign({}, RF.mv, { fromFx: opt.by || '' });
      delete XMV[mid].ext;
      OPI = MVS(atk).length - 1;
    } else if (opt.mvName) {
      OPI = MVS(atk).findIndex(q => q && q.name === opt.mvName);
      if (OPI < 0) {
        const nm2 = String(opt.mvName).trim();
        const mv = window.OM_IMPORT && window.OM_IMPORT.move ? window.OM_IMPORT.move(nm2, false) : null;
        if (!mv || !mv.name) {
          A().toast(`기술 「${nm2}」를 기술 DB 에서 못 찾았다`);
          return;
        }
        XMV[mid] = Object.assign({}, mv, { fromFx: opt.by || '' });
        OPI = MVS(atk).length - 1;
      }
    }
    const MVT = mv => {
      if (!mv) return '';
      const L = spL(atk, 'mvtype');
      const e =
        L.find(x => x.mv && x.mv === mv.name) || L.find(x => !x.mv && x.from && mvTysRaw(mv).includes(x.from)) || L.find(x => !x.mv && !x.from);
      return e ? e.to : mvTypeTxt(atk, mv, b);
    };
    /* 11-05 망령 「자연의은혜 — 실기 기준」: 지닌 나무열매로 타입 · 위력 (OM_ITEMRULE.natGift 표 · 소지품 구문 「자연의은혜 타입 위력」), 열매가 없으면 실패, 적용하면 열매를 쓴다 */
    const NGN = '자연의은혜';
    const NG = (() => {
      const n = IT(atk);
      const IR = window.OM_ITEMRULE;
      if (!n || !IR || !IR.natGift) return null;
      const g = IR.natGift(n, (DB().items || {})[n] || (atk.itemOwn && atk.itemOwn.name === n ? atk.itemOwn : null));
      return g ? { name: n, ty: S().typeEn(g.type), ko: g.type, pow: +g.pow || 0 } : null;
    })();
    const isNG = mv => !!mv && String(mv.name || '').trim() === NGN;
    const ngT = mv => (isNG(mv) && NG ? NG.ty : '');
    const RM = k => +((f.rooms || {})[k] || 0) > 0;
    /* 10-25 망령: 송전 · 침수 · 악인 상태면 다음 기술이 전기 · 물 · 악 타입 (여럿이면 맨 끝 것 — 손으로 바꿀 수 있다) */ const TYS0 = [
      ['Electrify', 'Electric'],
      ['Flooding', 'Water'],
      ['Knave', 'Dark']
    ].filter(([k]) => +((atk.states || {})[k] || 0) > 0);
    let ATY = TYS0.length ? TYS0[TYS0.length - 1][1] : '';
    let ATX = [];
    const ATXOFF = new Set();
    /* 11-07 망령 「복합기」: 더한 타입 [{t, src(자동이면 특성 · 포텐셜 이름)}] · 손으로 뺀 자동 (src|t) */ const IAI = mv =>
      atk.iai && mv && /(^|[,\s])거합($|[,\s])/.test(String(mv.tag || '')) ? atk.iai : '';
    /* 11-09 감우 55: 「자세」 → 다음 「거합」 기술 타입 */ const tyOf = mv =>
      ATY ||
      MVT(mv) ||
      IAI(mv) ||
      wxMoveTy(b, mv, atk) ||
      (RM('블랙룸') && mv.cat !== '변화' ? 'Ghost' : (skinOf(atk, mv) || {}).ty || ngT(mv) || rndOf(mv) || mv.typeEn);
    /* 10-24 제안: 공격 창에서 기술 타입을 바꾼다 (타입을 바꾸는 특성 · 포텐셜 · 웨더볼 등) — 고르면 그 한 타입으로 상성 · 자속 · 날씨 · 소지품을 다시 본다 */
    const mtys0 = mv =>
      ATY
        ? [ATY]
        : MVT(mv)
          ? [MVT(mv)]
          : IAI(mv)
            ? [IAI(mv)]
            : wxMoveTy(b, mv, atk)
              ? [wxMoveTy(b, mv, atk)]
              : RM('블랙룸') && mv.cat !== '변화'
                ? ['Ghost']
                : skinOf(atk, mv)
                  ? [skinOf(atk, mv).ty]
                  : ngT(mv)
                    ? [ngT(mv)]
                    : rndOf(mv)
                      ? [rndOf(mv)]
                      : String(mv.type || '')
                          .split(/[()/,]/)
                          .map(t => t.trim())
                          .filter(Boolean)
                          .map(S().typeEn);
    /* 11-07 망령 「복합기는 타입 고르는 창에서도 여러 개」: 「복합기 +」로 더한 타입(ATX)을 기술 타입 뒤에 붙인다 — 상성은 engine effectiveness 가 「복합 상성」(#amulti)대로 하나를 고른다 */
    const mtys = mv => {
      const a = mtys0(mv).slice();
      if (mv && mv.cat !== '변화') for (const x of ATX) if (x && x.t && !a.includes(x.t)) a.push(x.t);
      return a;
    };
    const TYS = [
      'Normal',
      'Fire',
      'Water',
      'Grass',
      'Electric',
      'Ice',
      'Fighting',
      'Poison',
      'Ground',
      'Flying',
      'Psychic',
      'Bug',
      'Rock',
      'Ghost',
      'Dragon',
      'Dark',
      'Steel',
      'Fairy'
    ]; /* 블랙룸: 모든 공격 기술이 고스트 */
    const x0 = (((b.cmds || {})[atk.tid] || {}).mons || {})[mid] || {};
    const x = x0.tm ? Object.assign({}, x0, { targets: tgNow(b, x0, atk) }) : x0;
    const slots = allEntered(b);
    /* 10-26 망령: 따라가때리기(교대 전 선제)처럼 지시가 아직 공개되지 않은 채 창을 열면 순서 칸에 적힌 기술 · 대상으로 */
    const OE = (b.order || []).find(o => o.mid === mid && o.move);
    const oeIdx = OE ? MVS(atk).findIndex(q => String(q.name) === String(OE.move)) : -1;
    const defMoveIdx =
      OPI >= 0
        ? OPI
        : opt.mvIdx != null
          ? +opt.mvIdx
          : x.move !== '' && x.move !== 'switch' && x.move != null
            ? +x.move
            : oeIdx >= 0
              ? oeIdx
              : (atk.states || {}).Oblivion
                ? MVS(atk).findIndex(q => q.name === '발버둥')
                : 0;
    let T0 = (x.targets && x.targets.length ? x.targets : (OE && OE.targets) || []).filter(s => slots.some(z => z.slot === s));
    let lostNote = '';
    {
      const lost = (x.targets || []).filter(s => !slots.some(z => z.slot === s));
      const mv0 = MVS(atk)[defMoveIdx];
      if (lost.length && !T0.length) {
        const foes = slots.filter(z => !sameT(z.mon, atk, b));
        const nm = lost
          .map(s => {
            const [sd, ar] = s.split('_');
            const q = Object.values(b.mons || {}).find(o => o.side === sd && o.entry === ar);
            return q ? q.name : s.replace('_', ' ').toUpperCase();
          })
          .join(', ');
        if (mv0 && (mv0.cat !== '변화' || String(mv0.range || '') === '1체') && foes.length === 1) {
          T0 = [foes[0].slot];
          lostNote = `<div class="small" style="color:var(--yel2);margin:2px 0 4px">지시한 대상(${esc(nm)})이 쓰러져 있어 남은 상대 ${esc(foes[0].mon.name)}(으)로 바꿨다</div>`;
        } else
          lostNote = `<div class="small" style="color:var(--yel2);margin:2px 0 4px">지시한 대상(${esc(nm)})이 쓰러져 있다 — 다른 대상을 골라 줘</div>`;
      }
    }
    /* 10-23 망령: 「난동부리기」 — 대상은 적진에서 랜덤 (지시에서 손으로 고른 대상이 있으면 그대로). 같은 턴에 창을 다시 열어도 같은 대상 */
    let thrNote = '';
    if ((atk.states || {}).Thrash && !x.tman) {
      const mv0 = MVS(atk)[defMoveIdx];
      const foes = slots.filter(z => !sameT(z.mon, atk, b));
      const multi = /전체|적진|자진|자신/.test(String((mv0 || {}).range || ''));
      if (mv0 && mv0.cat !== '변화' && !multi && foes.length) {
        const tk = mid + ':' + (+b.turn || 0);
        let pick = foes.find(z => z.slot === THR_PICK[tk]);
        if (!pick) {
          pick = foes[Math.floor(Math.random() * foes.length)];
          THR_PICK[tk] = pick.slot;
        }
        T0 = [pick.slot];
        lostNote = '';
        thrNote = `<div class="small" style="color:var(--yel2);margin:2px 0 4px">「난동부리기」 — 적진에서 랜덤으로 ${esc(pick.mon.name)}(을)를 골랐다 · 눌러서 바꿀 수 있다</div>`;
      }
    }
    if (opt.targets && opt.targets.length) T0 = opt.targets.filter(sl => slots.some(z => z.slot === sl));
    {
      const rd = redirectOf(b, atk, MVS(atk)[defMoveIdx]);
      if (rd && (!opt.targets || opt.preT) && !(T0.length === 1 && T0[0] === rd.slot)) {
        T0 = [rd.slot];
        lostNote += `<div class="small" style="color:var(--yel2);margin:2px 0 4px">${esc(rd.mon.name)} 「${esc(rd.e.name)}」 — 대상을 끌어왔다</div>`;
      }
    }
    /* 11-22 망령 「특성 엔진 처리」 — 동생뻘: 공격을 받을 때 3할로 기술의 대상을 「특성 : 여장부기질」(같은 편 필드 위)로 바꾼다. 굴림은 이 턴 · 이 공격자 · 이 기술마다 한 번 (창을 다시 열어도 같다) */
    {
      const mv0 = MVS(atk)[defMoveIdx];
      if (mv0 && mv0.cat !== '변화' && !moldOn(atk, mv0)) {
        const nT = T0.slice();
        for (let i = 0; i < nT.length; i++) {
          const z = slots.find(q => q.slot === nT[i]);
          const d = z && z.mon;
          if (!d || d.id === atk.id || abNm(d) !== '동생뻘') continue;
          const sis = slots.find(
            q =>
              q.mon &&
              q.mon.id !== d.id &&
              q.mon.id !== atk.id &&
              sameT(q.mon, d, b) &&
              q.mon.hp &&
              q.mon.hp.cur > 0 &&
              abNm(q.mon) === '여장부기질' &&
              !nT.includes(q.slot)
          );
          if (!sis) continue;
          const tk = mid + ':' + (+b.turn || 0) + ':' + d.id + ':' + (mv0.name || '');
          let rl = SIS_ROLL[tk];
          if (rl == null) rl = SIS_ROLL[tk] = 1 + Math.floor(Math.random() * 100);
          /* 11-23 확률을 바꾸는 포텐셜 (엘리자 『쌍동생의 응석』 「상성 : 2~8배」인 기술에 3할→5할) */ let SP = 30;
          try {
            for (const x of abTune(d)) {
              if (x.n !== '동생뻘' || x.k !== 'p') continue;
              if (x.se) {
                const ev = B().effectiveness(mvTysRaw(mv0), d, {});
                if (!(ev && +ev.value >= 2)) continue;
              }
              SP = x.u === '%' ? +x.to : +x.to * 10;
            }
          } catch (e) {}
          if (rl <= SP) {
            nT[i] = sis.slot;
            lostNote += `<div class="small" style="color:var(--yel2);margin:2px 0 4px">${esc(d.name)} 「동생뻘」 (${rl}/${SP}) — 대상이 ${esc(sis.mon.name)}(「여장부기질」)로 바뀌었다</div>`;
          } else lostNote += `<div class="small dim" style="margin:2px 0 4px">${esc(d.name)} 「동생뻘」 실패 (${rl}/${SP})</div>`;
        }
        T0 = nT;
      }
    }
    if (RF)
      lostNote += `<div class="small" style="color:var(--yel2);margin:2px 0 4px">반사 공격 — 대미지는 ${esc(atk.name)}의 능력치로 · 반동 · 추가 효과는 ${esc(((b.mons || {})[RF.from] || {}).name || '')}에게 · 드레인은 ${esc(atk.name)}</div>`; /* 11-23 모바일: 제목이 길어 잘려서 안내는 대상 칸 위로 */
    const md = A()
      .openModal(`<div class="mhead"><h2>${opt.extra ? '추가 공격' : RF ? '반사 공격' : opt.mvName ? '기술 사용' : '공격'} — ${esc(atk.name)}${RF ? ` <small style="color:var(--yel2)">→ ${esc(((b.mons || {})[RF.from] || {}).name || '')}</small>` : ''}${opt.extra ? ` <small class="dim">「${esc(opt.extra.name || '')}」 위력 ×${esc(String(opt.extra.pw))}${opt.extra.sure ? ' · 필중' : ''}</small>` : opt.by ? ` <small class="dim">「${esc(opt.by)}」${atkD.topNote ? ' · 이 기술만 ' + esc(atkD.topNote) : ''}</small>` : ''}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <select id="amove" hidden>${MVS(atk)
     .map((mv, i) => `<option value="${i}" ${i === defMoveIdx ? 'selected' : ''}>${esc(mv.name)}</option>`)
     .join('')}</select>
   <div class="sec">기술</div><div class="mvg" id="amvg">${sealMark(atk, MVS(atk))
     .map((mv, i) => moveCard(mv, i, i === defMoveIdx, `data-amv="${i}"`))
     .join('')}</div>
   <div class="amefw"><div class="amhd" id="amhd"></div><div class="mef amef" id="amef"></div></div><div class="row small" style="margin-top:6px"><label>위력 <input type="number" class="n" id="apow"></label><label title="이번 공격만 기술 타입을 바꾼다 (타입을 바꾸는 특성 · 포텐셜 등)">타입 <select id="atype"><option value="">기술 그대로</option>${TYS.map(t => `<option value="${t}">${esc(S().typeKo(t))}</option>`).join('')}</select></label><label title="이번 공격에 타입을 더한다 (복합기 — 여러 개 가능). 상성은 「상성」의 「복합 상성」대로 하나를 고른다">복합기 + <select id="atxadd"><option value="">타입 더하기</option>${TYS.map(t => `<option value="${t}">${esc(S().typeKo(t))}</option>`).join('')}</select></label><span class="atxl" id="atxl"></span><label title="트레이너 「통솔」 A 이상이면 기본값에 명중 보정이 들어 있다">명중 배율 <input type="number" step="0.01" class="n" id="aacc" value="${leadAcc(atk)}">${leadAcc(atk) !== 1 ? ` <span class="small dim">통솔 ×${leadAcc(atk)}</span>` : ''}</label><label class="tgc asurel" title="이 공격은 명중 판정 없이 맞는다 (필중화 · 록온 · 마음의눈 등)"><input type="checkbox" id="asure"> 필중화</label></div>
   ${masterHint(b, atk)}<div class="sec">대상 <span class="note">누르면 고르고 푼다</span></div>${lostNote}${thrNote}<div id="aboard">${board(
     b,
     atk.side,
     slot => T0.includes(slot),
     slot => `data-at="${slot}"`,
     false,
     atk
   )}</div>
   <div id="aprev" class="aprev"></div>
   <div hidden>${slots.map(s => `<input type="checkbox" data-t="${s.slot}" ${T0.includes(s.slot) ? 'checked' : ''}>`).join('')}</div>
   <div class="sec">보정 <span class="note">바꾼 것만 위에 모인다 · ✕ 로 되돌림</span></div><div class="achg" id="achg"></div>
   <details class="agrp" data-ag0="crit"><summary>급소<span class="asum" data-asum="crit"></span></summary><div class="agrid"><label>급소 +<input type="number" class="n" id="acrit" value="0" title="입력 보정"></label><label title="「지시」 랭크 보정은 대상마다 자동으로 들어간다. 이 칸은 그 위에 더한다">급소 지시 추가 <input type="number" class="n" id="acritord" value="0"> <span class="small dim aordh" id="aordh"></span></label><label>급소 표 <select id="acrittype"><option value="">포켓몬 설정대로</option><option value="0">기본 (6.25 → 12.5 → 25 → 50 → 100%)</option><option value="2">5세대 (6.25 → 12.5 → 25 → 33.3 → 50%)</option><option value="1">6세대 (6.25 → 12.5 → 50 → 100%)</option><option value="3">7세대 이후 (4.17 → 12.5 → 50 → 100%)</option></select></label><label>급소 대미지 <select id="acritmul"><option value="">포켓몬 설정대로</option><option value="1.5">×1.5 (6세대 이후)</option><option value="2">×2 (5세대까지)</option><option value="2.25">×2.25</option><option value="2.5">×2.5</option><option value="3">×3</option></select></label><label class="tgc"><input type="checkbox" id="acritforce"> 급소 확정</label></div></details><details class="agrp" data-ag0="mul"><summary>배율<span class="asum" data-asum="mul"></span></summary><div class="agrid"><label>자유 1 <input type="number" step="0.01" class="n" id="afree1" value="1"></label><label>자유 2 <input type="number" step="0.01" class="n" id="afree2" value="1"></label><label>아이템 1 <input type="number" step="0.01" class="n" id="aitem1" value="1"></label><label>아이템 2 <input type="number" step="0.01" class="n" id="aitem2" value="1"></label><label>특성 <input type="number" step="0.01" class="n" id="atrait" value="1"></label><label>날씨 <input type="number" step="0.01" class="n" id="aweather" value="1"></label><label>필드 <input type="number" step="0.01" class="n" id="afield" value="1"></label></div></details><details class="agrp" data-ag0="stat"><summary>능력 · 무시<span class="asum" data-asum="stat"></span></summary><div class="agrid"><label>분류 <select id="acat" title="물리기 · 특수기 판정 — 리플렉터 · 빛의장막, 「물리기」/「특수기」 조건이 이걸 따른다"><option value="">기술대로</option><option value="물리">물리기</option><option value="특수">특수기</option></select></label><label>공격 능력 <select id="aatk"><option value="">기본</option>${['attack', 'specialattack', 'defense', 'specialdefense', 'speed'].map(k => `<option value="${k}">${STAT_KO[k]}</option>`).join('')}</select></label><label>방어 능력 <select id="adef"><option value="">기본</option>${['defense', 'specialdefense', 'attack', 'specialattack', 'speed'].map(k => `<option value="${k}">${STAT_KO[k]}</option>`).join('')}</select></label><label>공격 측 무시 <select id="aigatk"><option value="-1">없음</option><option value="0">상승·강화 (랭크+ · 배율×)</option><option value="2">상승만 (랭크+)</option><option value="3">강화만 (배율×)</option><option value="1">감소·저하</option><option value="4">감소만 (랭크−)</option><option value="5">저하만 (배율)</option><option value="6">랭크 변화 모두</option><option value="7">변화 모두</option></select></label><label>방어 측 무시 <select id="aigdef"><option value="-1">없음</option><option value="0">상승·강화 (랭크+ · 배율×)</option><option value="2">상승만 (랭크+)</option><option value="3">강화만 (배율×)</option><option value="1">감소·저하</option><option value="4">감소만 (랭크−)</option><option value="5">저하만 (배율)</option><option value="6">랭크 변화 모두</option><option value="7">변화 모두</option></select></label></div></details><details class="agrp" data-ag0="eff"><summary>상성<span class="asum" data-asum="eff"></span></summary><div class="agrid"><label>복합 상성 <select id="amulti"><option value="0">첫 타입</option><option value="1">공격자에게 유리 (최고 배율)</option><option value="2">공격자에게 불리 (최저 배율)</option></select></label><label>상성 강제 <select id="aforce"><option value="">없음</option><option value="4">4</option><option value="2">2</option><option value="1">1</option><option value="0.5">½</option><option value="0.25">¼</option><option value="0">무효</option></select></label></div></details><details class="agrp" data-ag0="etc"><summary>기타<span class="asum" data-asum="etc"></span></summary><div class="agrid"><label>연속 <input type="number" class="n" id="ahits" placeholder="자동"></label><span class="small dim amhint" id="amhint"></span><label class="tgc"><input type="checkbox" id="ahelp" ${(atk.states || {}).HelpingHand ? 'checked' : ''}> 도우미 ${helpMul(atk)}${(+atk.helpN || 1) > 1 && (atk.states || {}).HelpingHand ? ` (${+atk.helpN}번)` : ''}</label><label class="tgc"><input type="checkbox" id="acharge"> 충전계 ×2</label><label class="tgc"><input type="checkbox" id="alife" ${HAS(atk, '생명의구슬') ? 'checked' : ''}> 생명의구슬 1.3</label><label class="tgc"><input type="checkbox" id="aadapt"> 적응력 (자속 2배)</label><label class="tgc"><input type="checkbox" id="abelt" ${HAS(atk, '달인의띠') ? 'checked' : ''}> 달인의띠 1.2</label><label class="tgc"><input type="checkbox" id="askill" ${atk.ability === '스킬링크' ? 'checked' : ''}> 스킬링크</label></div></details>
   <details class="agrp" data-ag0="sec"><summary>부가효과<span class="asum" data-asum="sec"></span></summary><div class="agrid"><label title="기술의 부가효과(N할) 발동 확률에 더한다. 1할 = 10%p">확률 +<input type="number" class="n" id="asecadd" value="${secAdd0(atk)}" step="10">%p</label><label class="tgc"><input type="checkbox" id="asecsure" ${secSure0(atk) ? 'checked' : ''}> 반드시 발동</label><span class="small dim">${secNote(atk)}</span></div></details>
   <div id="ares"></div>
   <div class="row afoot"><label class="small tgc" title="풀죽음 → 잠듦 → 마비 → 얼음 → 헤롱헤롱 → 혼란 순서로 판정 (맵툴 check_attack)"><input type="checkbox" id="achk" checked> 행동 판정 먼저</label><span class="sp"></span><button class="btn" id="aroll">굴리기</button><button class="btn pri" id="aapply" disabled>적용</button></div>`);
    md.querySelectorAll('[data-amfire]').forEach(
      bt =>
        (bt.onclick = () => {
          A().closeModal();
          openFire(bt.dataset.amfire);
        })
    );
    const mvSel = $('#amove', md);
    let T0KEEP = !!(opt.targets && opt.targets.length && T0.length);
    const syncBoard = () => {
      md.querySelectorAll('[data-at]').forEach(t => {
        const cb = md.querySelector(`[data-t="${t.dataset.at}"]`);
        t.classList.toggle('on', !!(cb && cb.checked));
        const tk = t.querySelector('.tk');
        if (tk) tk.textContent = cb && cb.checked ? '✓' : '';
      });
    };
    md.querySelectorAll('[data-at]').forEach(
      t =>
        (t.onclick = () => {
          const cb = md.querySelector(`[data-t="${t.dataset.at}"]`);
          if (cb) {
            cb.checked = !cb.checked;
            syncBoard();
          }
        })
    );
    md.querySelectorAll('[data-amv]').forEach(
      cd =>
        (cd.onclick = () => {
          if (extGone(MVS(atk)[+cd.dataset.amv])) A().toast('이 기능 확장은 이번 시합에서 다 썼다 — 판정을 바로잡을 때만 쓴다');
          mvSel.value = cd.dataset.amv;
          md.querySelectorAll('[data-amv]').forEach(q => q.classList.toggle('on', q === cd));
          syncMove();
        })
    );
    /* 11-07 망령 「복합기」 자동 채움: 공격자 특성 · 포텐셜 글 — 「자신의 공격에 「복합기 : X, Y」를 부여」 · 「자신의 공격에 「X」 타입을 부여」 · 「자신의 「A」 기술에 「X」 타입을 추가」(기술이 A 타입일 때만). 같은 글에 「유리한 상성」이 있으면 「복합 상성」을 「상대에게 유리」로. 칩 ✕ 로 끈다 */
    const atxSrcs = () => {
      const out = [];
      const add = (n, e) => {
        if (n && e)
          out.push([
            String(n)
              .replace(/[『』]/g, '')
              .trim(),
            String(e).replace(/<br\s*\/?>/g, '\n')
          ]);
      };
      add(atk.ability, atk.abilityEff);
      for (const p of potSrc(atk)) if (p && p.name && !p.ph) add(p.name, p.eff);
      return out;
    };
    const drawATX = () => {
      const el = $('#atxl', md);
      if (!el) return;
      el.innerHTML = ATX.map(
        (x, i) =>
          `<button type="button" class="btn xs${x.src ? ' ghost' : ''}" data-atxi="${i}" title="눌러서 뺀다">+${esc(S().typeKo(x.t))}${x.src ? ' · 자동: ' + esc(x.src) : ''} ✕</button>`
      ).join('');
    };
    const atxAuto = mv => {
      const keep = ATX.filter(x => !x.src);
      const au = [];
      let fav = '';
      if (mv && mv.cat && mv.cat !== '변화') {
        const own = String(mv.type || '')
          .split(/[()/,]/)
          .map(t => t.trim())
          .filter(Boolean)
          .map(S().typeEn);
        for (const [n, e] of atxSrcs()) {
          let got = [],
            r;
          if ((r = e.match(/자신의\s*공격에\s*「복합기\s*[:：]\s*([^」]+)」/))) got = r[1].split(/[,，·\/]\s*/);
          else if ((r = e.match(/자신의\s*공격에\s*「([^」:：]+)」\s*타입을\s*(?:부여|추가)/))) got = [r[1]];
          else if (
            (r = e.match(/자신의\s*「([^」:：]+)」\s*기술에\s*「([^」:：]+)」\s*타입을\s*(?:부여|추가)/)) &&
            own.includes(S().typeEn(r[1].trim()))
          )
            got = [r[2]];
          got = got.map(x => S().typeEn(String(x).trim())).filter(t => t && TYS.includes(t));
          for (const t of got) {
            if (ATXOFF.has(n + '|' + t) || keep.some(x => x.t === t) || au.some(x => x.t === t)) continue;
            au.push({ t, src: n });
            if (/유리한\s*상성/.test(e)) fav = fav || n;
          }
        }
      }
      ATX = keep.concat(au);
      /* 11-09 망령 「복합기는 유리한 상성 — 자동이든 손이든 기본값 유리」: 더한 타입이 하나라도 있으면 「복합 상성」 = 공격자에게 유리. 손으로 고르거나 ✕ 로 되돌리면(dataset.man) 그대로 둔다 */ /* 11-10 망령 「복합기는 상성이 양쪽 같으면 자속 보정을 받는 쪽?」: DB 기술 자체가 복합기(타입 칸 「격투(비행)」 · 플라잉프레스 · 하드론포 …)인데 더한 타입이 없으면 「첫 타입」으로 남던 것 → 이것도 유리한 상성(같으면 자속 쪽) */ const nat =
        !!(mv && mv.cat && mv.cat !== '변화' && mtys0(mv).length > 1);
      if (!fav && (ATX.length || nat)) fav = (au.find(x => x.src) || {}).src || (ATX.length ? '복합기 +' : '기술 「복합기」');
      const am = $('#amulti', md);
      if (am && !am.dataset.man) {
        if (fav && (am.value === '0' || am.dataset.auto)) {
          am.value = '1';
          am.dataset.auto = fav;
          am.title = '자동: ' + fav + ' (복합기 — 유리한 상성으로 판정)';
        } else if (am.dataset.auto && !fav) {
          if (am.value === '1') am.value = '0';
          delete am.dataset.auto;
          am.title = '';
        }
      }
      drawATX();
    };
    let PLG = null,
      PLGTY = false;
    let APOWM = false;
    const SPRND = ['mag', 'present', 'psywave'];
    const syncMove = () => {
      const mv = MVS(atk)[+mvSel.value] || {};
      atxAuto(mv);
      {
        const k = SPMAP[String(mv.name || '').trim()];
        const pe = $('#apow', md);
        if (pe) pe.title = k && k !== 'psywave' ? '변칙 위력 — 그대로 두면 대상마다 자동. 숫자를 고치면 그 위력으로 친다' : '';
        if (k && k !== 'psywave')
          setTimeout(() => {
            const e2 = $('#amef', md);
            if (e2 && !/^【변칙 위력/.test(e2.textContent))
              e2.textContent =
                (SPRND.includes(k)
                  ? '【변칙 위력 — 굴릴 때 무작위 · 위력 칸을 고치면 그 값으로】 '
                  : '【변칙 위력 — 대상마다 자동 · 위력 칸을 고치면 그 값으로】 ') + e2.textContent;
          }, 0);
      }
      {
        PLG = plSecond(b, atk, mv);
        if (PLG) {
          ATY = PLG.ty;
          PLGTY = true;
          const ts = $('#atype', md);
          if (ts) {
            ts.value = PLG.ty;
            ts.closest('label') && ts.closest('label').classList.add('chgd');
          }
          setTimeout(() => {
            const pw = $('#apow', md);
            if (pw && PLG) pw.value = 150;
            const e2 = $('#amef', md);
            if (e2 && PLG)
              e2.textContent =
                `【합체 — 「${PLG.mv}」+「${plNm(mv)}」: 위력 150 · ${S().typeKo(PLG.ty)} 타입 · ${PLG.who === 'self' ? '자진' : '적진'} 「${PLG.o}」 4턴】 ` +
                e2.textContent;
          }, 0);
        } else if (PLGTY) {
          ATY = '';
          PLGTY = false;
          const ts = $('#atype', md);
          if (ts) {
            ts.value = '';
            ts.closest('label') && ts.closest('label').classList.remove('chgd');
          }
        }
      }
      /* 11-07 맹세 합체: 두 번째 */ {
        const el = $('#aadapt', md);
        if (el) {
          const on = teraSame(atk) && mtys(mv).includes(atk.teraEn);
          if (on || el.dataset.tera === '1') {
            el.checked = on;
            el.dataset.tera = on ? '1' : '';
          }
          el.parentNode.title = on ? '테라스탈 — 원래 타입과 같은 테라 타입 기술이라 자동으로 켬' : '';
        }
      }
      /* 11-02 망령: 같은 타입 테라스탈 = 적응력 자동 */ const pst = powStepOf(mv);
      $('#apow', md).value = mv.pow || pst || 0;
      if (isNG(mv)) {
        $('#apow', md).value = NG ? NG.pow : 0;
        setTimeout(() => {
          const e2 = $('#amef', md);
          if (e2)
            e2.textContent =
              (NG
                ? `【자연의은혜 — 「${NG.name}」 → ${NG.ko} 타입 · 위력 ${NG.pow} · 적용하면 열매를 쓴다】 `
                : '【자연의은혜 — 지닌 나무열매가 없거나 표에 없는 열매라 실패한다】 ') + e2.textContent;
        }, 0);
      }
      {
        const IK = OI() && OI().moveKind ? OI().moveKind(mv) : '';
        if (IK) {
          const FI = IK === 'fling' ? OI().flingInfo(atk) : null;
          if (FI)
            $('#apow', md).value = FI.ok
              ? FI.pow
              : 0; /* 11-06 망령 「소지품 기술 전부」: 효과 글로 고른 소지품 기술 — 무엇을 하는지 미리 적고, 내던지기는 지닌 소지품으로 위력 */
          const tip =
            IK === 'fling'
              ? FI.ok
                ? `내던지기 — 「${FI.name}」 위력 ${FI.pow} · 적용하면 소지품을 쓴다`
                : `내던지기 — ${FI.why} 실패한다`
              : {
                  eat: '맞은 대상의 나무열매를 먹는다 — 효과는 이쪽에 (적용 때 자동)',
                  knock: '소지품을 지닌 대상은 위력 ×1.5 (대상마다 자동) · 적용하면 소지품을 떨어뜨린다',
                  steal: '1번 칸이 비어 있으면 맞은 대상의 소지품을 빼앗는다 (적용 때 자동)',
                  swap: '1번 칸 소지품을 서로 맞바꾼다 (적용 때 자동)',
                  burn: '맞은 대상의 소지품 한 칸을 파괴한다 — 배틀 한정 (적용 때 자동)',
                  burnall: '맞은 대상의 소지품을 모두 파괴한다 — 배틀 한정 (적용 때 자동)',
                  give: '자신의 1번 칸 소지품을 빈손인 대상에게 건네준다 (적용 때 자동)'
                }[IK];
          setTimeout(() => {
            const e2 = $('#amef', md);
            if (e2) e2.textContent = '【' + tip + '】 ' + e2.textContent;
          }, 0);
        }
      }
      {
        const OVK = {
          type: '타입',
          cat: '분류',
          pow: '위력',
          acc: '명중',
          prio: '우선도',
          range: '범위',
          contact: '접촉',
          eff: '효과 글',
          auto: '구문'
        };
        if (mv.ov && mv.ov.length)
          setTimeout(() => {
            const e2 = $('#amef', md);
            if (e2) e2.textContent = '【이 포켓몬만 — ' + mv.ov.map(k => OVK[k] || k).join(' · ') + ' 덮어씀】 ' + e2.textContent;
          }, 0);
      }
      /* 11-08 포켓몬별 기술 덮어쓰기 */ {
        const h = $('#amhint', md),
          mn = +mv.min || 1,
          mx = +mv.max || 1;
        const MH = mx > mn ? minHitOf(atk) : null;
        if (h)
          h.textContent =
            (mx <= 1
              ? ''
              : mn === mx
                ? `${mx}회 연속기 — 매 회 명중 판정`
                : `${MH && MH.n > mn ? `${Math.min(MH.n, mx)}~${mx}회 (「${MH.name}」 · 원래 ${mn}~)` : `${mn}~${mx}회`} 연속기 — 첫 명중 뒤 확정`) +
            (pst ? ` · 맞을 때마다 위력 +${pst} (위력 칸 = 1타)` : '');
      }
      {
        const oe = (b.order || []).find(o => o.mid === mid && o.pursuitHit);
        const pv = oe && b.mons[oe.pursuitHit];
        if (oe && pv && pv.entry && String(mv.name) === String(oe.move)) {
          const x2 = pursuitX2(mv);
          if (x2) $('#apow', md).value = (+mv.pow || 0) * 2;
          setTimeout(() => {
            const e2 = $('#amef', md);
            if (e2) e2.textContent = '【따라가때리기 — 교대하려는 ' + pv.name + '에게 먼저' + (x2 ? ' · 위력 2배' : '') + '】 ' + e2.textContent;
          }, 0);
        }
      }
      {
        const a = moveAuto(mv);
        $('#acritforce', md).checked = !!(a && a.critSure);
      }
      {
        const e = String(mv.eff || ''),
          W = UMA ? '' : String(f.weather.type || '');
        const wl = re => {
          const r = e.match(re);
          return r ? r[1].split(/[,，]\s*/).map(x => x.trim()) : null;
        };
        const skip = wl(/「날씨\s*:\s*([^」]+)」일 때 「차지」를 생략/),
          half = wl(/「날씨\s*:\s*([^」]+)」일 때 위력을 반감/);
        const nt = [];
        /* 11-01 망령 「날씨 부가 효과」: 「날씨 : X」일 때 「필중기」 · 「명중 : N」도 창이 맞춘다 (번개 · 폭풍 · 눈보라 · 코멧펀치 …) */ const wsure =
            wl(/「날씨\s*:\s*([^」]+)」일 때 「필중기」/),
          wacm = e.match(/「날씨\s*:\s*([^」]+)」일 때 「명중\s*:\s*(\d+)」/);
        md.dataset.wsure = wsure && W && wsure.some(x => wxSame(x, W)) ? '1' : '';
        md.dataset.wacc = wacm && W && wacm[1].split(/[,，]\s*/).some(x => wxSame(x.trim(), W)) ? wacm[2] : '';
        if (md.dataset.wsure) nt.push('「' + W + '」 — 필중');
        if (md.dataset.wacc) nt.push('「' + W + '」 — 명중 ' + md.dataset.wacc);
        {
          const NC = /「차지」/.test(e) ? ncSkip(b, atk, mv) : '';
          if (NC) nt.push('『' + String(NC).replace(/[『』]/g, '') + '』 — 차지 없이 바로');
          else if (skip && W && skip.includes(W)) nt.push('「' + W + '」 — 차지 없이 바로');
          else if (/「차지」/.test(e)) nt.push('「차지」 기술 — 첫 턴은 모으기');
        }
        if (half && W && half.includes(W)) {
          $('#apow', md).value = Math.floor((+mv.pow || 0) / 2);
          nt.push('「' + W + '」 — 위력 반감');
        }
        {
          const q = wxTerrPow(b, atk, mv);
          if (q.mul !== 1) $('#apow', md).value = Math.floor((+$('#apow', md).value || 0) * q.mul);
          nt.push(...q.why);
        } /* 11-04: 날씨 · 필드 위력 · 타입 · 범위 (wxTerrPow) */
        if (nt.length)
          setTimeout(() => {
            const e2 = $('#amef', md);
            if (e2) e2.textContent = '【' + nt.join(' · ') + '】 ' + e2.textContent;
          }, 0);
      }
      if (FOUL_RE.test(String(mv.eff || '')))
        setTimeout(() => {
          const e2 = $('#amef', md);
          if (e2) e2.textContent = '【대상의 「공격」으로 계산 — 자동】 ' + e2.textContent;
        }, 0);
      {
        const st = atk.states || {};
        $('#acharge', md).checked = mv.cat !== '변화' && Object.keys(CHARGE_ST).some(k => st[k] && mtys(mv).includes(CHARGE_ST[k]));
      }
      $('#amef', md).textContent =
        (SPMAP[String(mv.name || '').trim()] ? '【변칙 위력 — 대상마다 자동 계산】 ' : '') + String(mv.eff || '').replace(/<br\s*\/?>/gi, '\n');
      {
        const col = S().typeColor(tyOf(mv));
        $('#amhd', md).innerHTML =
          `<span class="amty" style="background:${col.bg};color:${col.fg}">${esc(S().typeKo(tyOf(mv)) || mv.type || '')}</span><b>${esc(mv.name || '')}</b><span class="dim">${esc(mv.cat || '')} · 위력 ${mv.pow || '-'} · 명중 ${mv.acc || '필중'}${mv.prio ? ' · 우선 ' + mv.prio : ''} · ${esc(mv.range || '')}${mv.tag && mv.tag !== '-' ? ' · ' + esc(mv.tag) : ''}</span>`;
      }
      const T0 = tyOf(mv);
      const wm = WEATHER_MUL[UMA ? '' : wxNow(b)] || {};
      /* 11-07 망령 「복합기 날씨는 둘 다 곱하기」: 기술의 모든 타입(같은 타입은 한 번)마다 날씨 배율을 곱한다 — 쾌청 불꽃(물) ×1.5 × ×0.5 = ×0.75 */ {
        const TW = [...new Set(mtys(mv))];
        let wv = TW.reduce((a, t) => a * (wm[t] == null ? 1 : +wm[t]), 1);
        if (wv < 1 && wv > 0 && spL(atk, 'wxdemerit').length) wv = 1;
        /* 11-25 날씨디메리트무시 (익스펜션 : 비행 ②): 자기 기술이 날씨로 약해지지 않는다 (×0 실패는 그대로) */ /* 11-07 망령 「첫째 · 둘째 타입 관계 없다, 복합기라고」: ×0(폭우 불꽃 · 큰가뭄 물 = 실패)도 어느 타입이든 그대로 곱한다 */ $(
          '#aweather',
          md
        ).value = Math.round(wv * 10000) / 10000;
      }
      /* 11-04 19:44 망령 「밤바람 스피드스타 같은 것도」: 「날씨 : X」에 의한 대미지 강화율이 강화(1.33배→1.5배) · 「날씨 : X」의 위력 보정을 받는다(빛의칼 — 그 날씨의 강화 배율) */
      {
        const e = String(mv.eff || ''),
          W = UMA ? '' : wxNow(b);
        const hit = x =>
          !!W &&
          String(x || '')
            .split(/[,，]\s*/)
            .some(q => {
              q = q.trim();
              return wxSame(q, W) || (q.length >= 1 && W.endsWith(q));
            });
        const say = t =>
          setTimeout(() => {
            const e2 = $('#amef', md);
            if (e2) e2.textContent = '【' + t + '】 ' + e2.textContent;
          }, 0);
        const r = e.match(/「날씨\s*:\s*([^」]+)」에 의한 대미지 강화율이\s*강화\(\s*[\d.]+\s*배?\s*→\s*([\d.]+)\s*배\)/);
        if (r && hit(r[1]) && +$('#aweather', md).value > 1) {
          $('#aweather', md).value = +r[2];
          say(`「${W}」 강화 ×${r[2]}`);
        }
        const r2 = e.match(/「(?:날씨\s*:\s*)?([^」]+)」의 위력 보정을 받는다/);
        if (r2 && hit(r2[1])) {
          const mx = Math.max(1, ...Object.values(wm).map(Number));
          if (mx > 1 && +$('#aweather', md).value < mx) {
            $('#aweather', md).value = mx;
            say(`「${W}」 위력 보정 ×${mx}`);
          }
        }
      }
      {
        const rt = rndOf(mv);
        if (rt && tyOf(mv) === rt)
          setTimeout(() => {
            const e2 = $('#amef', md);
            if (e2 && !/^【무작위/.test(e2.textContent)) e2.textContent = '【무작위 타입 → ' + S().typeKo(rt) + '】 ' + e2.textContent;
          }, 0);
      }
      {
        const sk = !ATY && skinOf(atk, mv);
        $('#atrait', md).value = sk ? sk.mul : 1;
        if (sk)
          setTimeout(() => {
            const e2 = $('#amef', md);
            if (e2) e2.textContent = '【특성 「' + sk.name + '」 ' + S().typeKo(sk.ty) + ' 기술 · 위력 ×' + sk.mul + '】 ' + e2.textContent;
          }, 0);
      }
      /* 필드 강화는 땅 위의 공격자만 (미스트필드의 드래곤 반감은 대상마다 따로) */
      let fm = 1;
      const ft = f.terrain.type;
      if (grd(atk)) {
        const TA = mtys(mv);
        /* 11-07 망령: 복합기는 어느 한 타입이라도 맞으면 필드 강화 */ if (ft === '그래스필드' && TA.includes('Grass')) fm = 1.3;
        if (ft === '일렉트릭필드' && TA.includes('Electric')) fm = 1.3;
        if (ft === '사이코필드' && TA.includes('Psychic')) fm = 1.3;
      }
      $('#afield', md).value = fm;
      /* 소지품 위력 (검은띠 · 쥬얼 · 구애머리띠 …): 기술을 고를 때 「아이템 1」 칸에 넣는다 */
      {
        const tys = mtys(mv);
        const im = OI() ? OI().atkMul(atk, { types: tys, cat: mv.cat, single: String(mv.range || '') === '1체' }) : null;
        $('#aitem1', md).value = im ? im.v : 1;
        md.dataset.it1 = im && im.txt ? String(im.txt) : '';
        md.dataset.jewel = im && im.jewel ? String(im.name || '1') : '';
        if (im)
          setTimeout(() => {
            const e2 = $('#amef', md);
            if (e2) e2.textContent = '【소지품 ' + im.txt + '】 ' + e2.textContent;
          }, 0);
      }
      {
        const rn = [
          ...(RM('블랙룸') && mv.cat !== '변화' ? ['블랙룸: 고스트 기술로'] : []),
          ...(RM('원더룸') ? ['원더룸: 방어↔특방'] : []),
          ...(RM('매직룸') ? ['매직룸: 소지품 무효'] : []),
          ...(ft && ['그래스필드', '일렉트릭필드', '사이코필드'].includes(ft) && !grd(atk) ? ['떠 있어 ' + ft + ' 강화 없음'] : [])
        ];
        if (rn.length)
          setTimeout(() => {
            const e2 = $('#amef', md);
            if (e2) e2.textContent = '【' + rn.join(' · ') + '】 ' + e2.textContent;
          }, 0);
      }
      const dflt = OE && +mvSel.value === oeIdx && (OE.targets || []).length ? OE.targets : defaultTargets(b, mid, String(mvSel.value));
      /* 11-23 방 시험: 추가 공격 · 기술사용 · 반사 공격처럼 대상을 정해서 연 창(opt.targets)은 처음 한 번은 그 대상 그대로 — 예전엔 지시가 없으면 기본 대상으로 덮여, 둘이함께 「헤드샷」의 반대 에리어 대상이 원래 대상으로 돌아갔다. 기술을 손으로 바꾸면 그때부터는 기본 대상 */ if (
        T0KEEP
      ) {
        T0KEEP = false;
      } else if (x.move == null || x.move === '' || +x.move !== +mvSel.value) {
        md.querySelectorAll('[data-t]').forEach(cb => (cb.checked = dflt.includes(cb.dataset.t)));
      }
      syncBoard();
    };
    mvSel.onchange = () => {
      APOWM = false;
      syncMove();
    };
    {
      const pe = $('#apow', md);
      if (pe)
        pe.addEventListener('input', () => {
          APOWM = true;
        });
    } /* 11-07 망령 「변칙기가 현재 위력을 임의로 조절하는 게 안 된다」: 위력 칸을 손으로 고치면(APOWM) 변칙 위력 자동 대신 그 값 */
    {
      const ts = $('#atype', md);
      if (ts)
        ts.addEventListener('change', () => {
          const pw = $('#apow', md).value;
          ATY = ts.value;
          syncMove();
          $('#apow', md).value = pw;
          ts.closest('label').classList.toggle('chgd', !!ATY);
        });
    }
    /* 11-07 복합기 +: 더하기 · 칩 ✕ 로 빼기 (자동은 이 창에서 다시 안 채운다) · 「복합 상성」을 손으로 바꾸면 자동 표시를 뗀다 */
    {
      const xa = $('#atxadd', md);
      if (xa)
        xa.addEventListener('change', () => {
          const t = xa.value;
          xa.value = '';
          if (!t || ATX.some(x => x.t === t)) return;
          const pw = $('#apow', md).value;
          ATX.push({ t, src: '' });
          syncMove();
          $('#apow', md).value = pw;
        });
      const xl = $('#atxl', md);
      if (xl)
        xl.addEventListener('click', e => {
          const bt = e.target.closest('[data-atxi]');
          if (!bt) return;
          const x = ATX[+bt.dataset.atxi];
          if (!x) return;
          if (x.src) ATXOFF.add(x.src + '|' + x.t);
          ATX.splice(+bt.dataset.atxi, 1);
          const pw = $('#apow', md).value;
          syncMove();
          $('#apow', md).value = pw;
        });
      const am = $('#amulti', md);
      if (am)
        am.addEventListener('change', () => {
          am.dataset.man = '1';
          delete am.dataset.auto;
          am.title = '';
        });
    }
    {
      const ts = $('#atype', md);
      if (ts && ATY) {
        ts.value = ATY;
        ts.closest('label').classList.add('chgd');
        ts.closest('label').title =
          `「${TYS0.map(([k]) => ({ Electrify: '송전', Flooding: '침수', Knave: '악인' })[k]).join(' · ')}」 상태 — 이 기술은 ${S().typeKo(ATY)} 타입`;
      }
    }
    /* 보정: 바꾼 것만 위로 모아 보여 주고 ✕ 로 기본값 */
    const AF = [
      ['acrit', '급소 +', 0, 'crit'],
      ['acritord', '급소 지시 추가 ', 0, 'crit'],
      ['acrittype', '급소 표 ', '', 'crit'],
      ['acritmul', '급소 대미지 ', '', 'crit'],
      ['acritforce', '급소 확정', false, 'crit'],
      ['afree1', '자유1 ×', 1, 'mul'],
      ['afree2', '자유2 ×', 1, 'mul'],
      ['aitem1', '아이템1 ×', 1, 'mul'],
      ['aitem2', '아이템2 ×', 1, 'mul'],
      ['atrait', '특성 ×', 1, 'mul'],
      ['aweather', '날씨 ×', 1, 'mul'],
      ['afield', '필드 ×', 1, 'mul'],
      ['acat', '분류 ', ''],
      ['aatk', '공격 능력 ', ''],
      ['adef', '방어 능력 ', ''],
      ['aigatk', '공격 측 무시 ', '-1'],
      ['aigdef', '방어 측 무시 ', '-1'],
      ['amulti', '복합 상성 ', '0'],
      ['aforce', '상성 강제 ', ''],
      ['ahits', '연속 ', ''],
      ['ahelp', '도우미', false],
      ['acharge', '충전계', false],
      ['alife', '생명의구슬', false],
      ['aadapt', '적응력', false],
      ['abelt', '달인의띠', false],
      ['askill', '스킬링크', false],
      ['asure', '필중', false],
      ['asecadd', '부가효과 확률 +', 0, 'sec'],
      ['asecsure', '부가효과 확정', false, 'sec']
    ];
    const grpOf = {
      aatk: 'stat',
      adef: 'stat',
      aigatk: 'stat',
      aigdef: 'stat',
      amulti: 'eff',
      aforce: 'eff',
      ahits: 'etc',
      ahelp: 'etc',
      acharge: 'etc',
      alife: 'etc',
      aadapt: 'etc',
      abelt: 'etc',
      askill: 'etc',
      asure: 'etc'
    };
    const chgList = () =>
      AF.filter(([id, , d]) => {
        const e = $('#' + id, md);
        if (!e) return false;
        return typeof d === 'boolean'
          ? e.checked !== d
          : String(e.value) !== String(d) && !(typeof d === 'number' && +e.value === d && e.value !== '');
      }).map(([id, l]) => {
        const e = $('#' + id, md);
        const v = e.type === 'checkbox' ? '' : e.tagName === 'SELECT' ? e.options[e.selectedIndex].text : e.value;
        return { id, t: l + v, g: grpOf[id] || AF.find(x => x[0] === id)[3] };
      });
    const updChg = () => {
      const L = chgList();
      $('#achg', md).innerHTML = L.length
        ? L.map(x => `<span class="chip chg" data-ax="${x.id}">${esc(x.t)} <b>✕</b></span>`).join('')
        : '<span class="small dim">기본값 그대로</span>';
      md.querySelectorAll('[data-asum]').forEach(e => {
        const gl = L.filter(x => x.g === e.dataset.asum);
        e.textContent = gl.length ? gl.map(x => x.t).join(' · ') : '기본';
      });
      md.querySelectorAll('[data-ax]').forEach(
        ch =>
          (ch.onclick = () => {
            const d = AF.find(x => x[0] === ch.dataset.ax);
            const e = $('#' + d[0], md);
            if (typeof d[2] === 'boolean') e.checked = d[2];
            else e.value = d[2];
            if (d[0] === 'amulti') {
              e.dataset.man = '1';
              delete e.dataset.auto;
              e.title = '';
            }
            updChg();
            prev();
          })
      );
    };
    /* 굴리기 전 예상 대미지 (난수 85~100%, 급소·연속 횟수 빼고 1회 기준) */
    const prev = () => {
      const box = $('#aprev', md);
      if (!box) return;
      const mv = MVS(atk)[+mvSel.value];
      const g = id => $('#' + id, md);
      const n = id => +g(id).value;
      {
        const oh = g('aordh');
        if (oh) {
          const tg = [...md.querySelectorAll('[data-t]:checked')].map(cb => cb.dataset.t);
          const L = tg
            .map(sl => {
              const [sd, ar] = sl.split('_');
              const d = entered(b, sd)[ar];
              return d ? [d, orderCrit(atk, d)] : null;
            })
            .filter(x => x && x[1].v);
          oh.textContent = L.length ? '자동 지시 ' + L.map(([d, o]) => (tg.length > 1 ? d.name + ' ' : '') + '+' + o.v).join(' · ') : '자동 지시 +0';
        }
      }
      const SPK = SPMAP[String((mv || {}).name || '').trim()];
      const spAuto = !APOWM && SPK && !SPRND.includes(SPK);
      const spF = spAuto ? specialPowFor(mv.name, atk) : null;
      if (!mv || mv.cat === '변화' || (!spAuto && !+g('apow').value)) {
        box.innerHTML = '';
        return;
      }
      const tg = [...md.querySelectorAll('[data-t]:checked')].map(cb => cb.dataset.t);
      const out = [];
      const mvO = mv;
      try {
        const moveTypes = mtys(mv);
        const atkTypes = proteanTys(atk, mv) || (atk.teraActive && atk.teraEn !== '-' ? [...atk.types, atk.teraEn] : atk.types);
        for (const slot of tg) {
          const [side, area] = slot.split('_');
          const def = V(c, entered(b, side)[area]);
          if (!def) continue;
          const mv = catFix(
            md,
            atk,
            def,
            mvO
          ).mv; /* 11-11 분류 (손 · 셸암즈 꼴) */ /* 11-05 일루젼: 변장한 상대는 변장한 모습(타입)으로 미리보기 — 굴리면 진짜로 */
          const tyK = dexSees(c, def, 'type');
          const eff0 = B().effectiveness(moveTypes, def, {
            scrappy: scrL(atk, def),
            multiMode: +g('amulti').value,
            atkTypes,
            force: g('aforce').value === '' ? null : +g('aforce').value,
            ironBall: HAS(def, '검은철구'),
            ringTarget: HAS(def, '겨냥표적'),
            vsOver: vsOf(atk, def, mv, moveTypes),
            floating: (def.states || {}).MagnetRise || (def.states || {}).Telekinesis || (FX() && FX().floating(def)) || HAS(def, '풍선')
          });
          const eff = tyK || g('aforce').value !== '' ? eff0 : Object.assign({}, eff0, { value: 1 });
          {
            let nu = '';
            try {
              nu =
                FX() && FX().nullOf
                  ? FX().nullOf(
                      roleV(atk),
                      roleV(def),
                      Object.assign(moveQuery(atk, def, mv, moveTypes, eff.value, tg.length < 2), { stab: !!eff.stab })
                    )
                  : '';
            } catch (e) {}
            if (nu) {
              out.push(
                `<div class="apv"><div class="apvh"><b>${esc(def.name)}</b></div><div><span class="apn">0</span> <span class="small dim">효과가 없다 — 「${esc(nu)}」</span></div></div>`
              );
              continue;
            }
          } /* 11-09 완화 ×0 */
          let mods = { boost: 1, guard: 1 };
          try {
            if (FX())
              mods = FX().attackMods(
                roleV(atk),
                roleV(def),
                Object.assign(moveQuery(atk, def, mv, moveTypes, eff.value, tg.length < 2), { stab: !!eff.stab })
              );
          } catch (e) {}
          const AIGP = areaBoostIgn(b, atk, def, mv);
          if (AIGP) mods = boostOff(mods, atk, AIGP, def);
          {
            const TBI = defBoostIgn(b, atk, def);
            if (TBI) mods = boostOff(mods, atk, TBI, def);
          }
          {
            const ig = OI() && OI().defGuard(def, mv.cat);
            if (ig) mods = Object.assign({}, mods, { guard: (mods.guard || 1) * ig.v });
          }
          const objs = (fieldOf(b).objects || {})[side] || {};
          const wall = {};
          const WIG = wallIgn(atk, mv, mtys(mv)) && Object.keys(WALLS).some(k => objs[k] > 0);
          if (!WIG) for (const k in WALLS) if (objs[k] > 0 && !(k === '얼음의장벽' && mtys(mv).includes('Fire'))) wall[WALLS[k]] = 1;
          const pw0 = spF ? +(spF(def) || {}).pow || 0 : +g('apow').value;
          if (!pw0) continue;
          const koP =
            OI() && OI().moveKind && OI().moveKind(mv) === 'knock' && dexSees(c, def, 'item') && OI().knockable(def)
              ? Math.floor(pw0 * 1.5)
              : pw0; /* 11-06 탁쳐서떨구기 미리보기: 소지품을 볼 수 있는 대상만 ×1.5 (굴리면 대상마다 자동) */
          const d = B().damage(foulAtk(ATKD(def, mv), def, mv), aceDef(atk, def), Object.assign({}, mv, { pow: koP || +g('apow').value }), {
            critMul: +g('acritmul').value || critMulOf(atk),
            hits: [1],
            free1: n('afree1') * (mods.boost || 1),
            free2: n('afree2'),
            item1: AIGP ? Math.min(1, n('aitem1')) : n('aitem1'),
            item2: AIGP ? Math.min(1, n('aitem2')) : n('aitem2'),
            trait: AIGP ? Math.min(1, n('atrait')) : n('atrait'),
            weather: n('aweather'),
            fieldMul:
              n('afield') * (fieldOf(b).terrain && fieldOf(b).terrain.type === '미스트필드' && moveTypes.includes('Dragon') && grd(def) ? 0.5 : 1),
            defMul: wxDefMul(b, def, g('adef').value || (mv.cat === '특수' ? 'specialdefense' : 'defense')).v,
            wonder: RM('원더룸') && !(window.OM_FIELD && window.OM_FIELD.roomImm && window.OM_FIELD.roomImm(def)),
            helping: g('ahelp').checked ? helpMul(atk) : 0,
            charge: g('acharge').checked,
            lifeOrb: AIGP ? false : g('alife').checked,
            multiTarget: tg.length > 1,
            wall,
            wallSize: mode(b) >= 2 ? 2 : 1,
            atkStat: g('aatk').value || undefined,
            defStat: g('adef').value || undefined,
            ignoreAtk: +g('aigatk').value,
            ignoreDef: +g('aigdef').value,
            scarf: HAS(atk, '구애스카프')
          });
          const o = {
            stab: eff.stab,
            adaptability: g('aadapt').checked,
            expertBelt: g('abelt').checked,
            guard: (mods.guard || 1) * ((def.flags || {}).endure ? 0.5 : 1)
          };
          const lo = Math.max(eff.value > 0 ? 1 : 0, B().hpDamage(def, d.min, eff.value, o).raw),
            hi = Math.max(lo, B().hpDamage(def, d.max, eff.value, o).raw);
          const cur = def.hp.cur,
            mx = def.hp.max || 1;
          const pc = v => Math.round((v / mx) * 100);
          const nk = lo > 0 ? Math.ceil(cur / lo) : 0;
          out.push(
            `<div class="apv"><div class="apvh"><b>${esc(def.name)}</b> <span class="small dim">${
              tyK
                ? esc(
                    (def.types || [])
                      .filter(t => t !== '-')
                      .map(t => S().typeKo(t))
                      .join(' · ')
                  )
                : '타입 ?'
            }</span></div><div class="apbar"><i style="width:${pc(Math.max(0, cur - hi))}%"></i><b style="left:${pc(Math.max(0, cur - hi))}%;width:${Math.max(0, pc(cur) - pc(Math.max(0, cur - hi)))}%"></b><u style="left:${pc(Math.max(0, cur - lo))}%"></u></div><div><span class="apn">${lo} ~ ${hi}</span> <span class="small dim">/ 남은 HP ${cur}</span></div><div class="small dim">HP의 ${pc(lo)}~${pc(hi)}% · ${tyK || g('aforce').value !== '' ? '상성 ×' + eff.value : '상성 ? (×1 가정)'}${eff.stab ? ' · 자속' : ''}${d && d.wall < 1 ? ` · <span style="color:var(--yel2)">${esc(wallNames(objs, catEn(mv.cat), tyOf(mv)).join('·'))} ×${d.wall}</span>` : ''}${nk === 1 ? ' · <b style="color:var(--red)">확정 1타</b>' : nk ? ' · 확정 ' + nk + '타' : ''}${mv.max > 1 ? ' · 1회 기준' : ''}</div></div>`
          );
        }
      } catch (e) {
        out.length = 0;
      }
      box.innerHTML = out.length
        ? `<div class="sec">예상 대미지 <span class="note">급소·명중 빼고 · 받는 쪽 완화는 HP 창에서</span></div><div class="apvs">${out.join('')}</div>`
        : '';
    };
    md.addEventListener('input', e => {
      if (e.target.closest('#ares')) return;
      updChg();
      prev();
    });
    md.addEventListener('change', e => {
      if (e.target.closest('#ares')) return;
      updChg();
      prev();
    });
    md.querySelectorAll('[data-at],[data-amv]').forEach(t =>
      t.addEventListener('click', () => {
        updChg();
        prev();
      })
    );
    syncMove();
    if (opt.extra) {
      const mv = MVS(atk)[+mvSel.value] || {};
      const pe = $('#apow', md);
      if (pe) pe.value = Math.max(1, Math.floor((+pe.value || +mv.pow || 0) * (+opt.extra.pw || 1)));
      const se = $('#asure', md);
      if (se && opt.extra.sure) se.checked = true;
    }
    if (XMV[mid]) {
      const iv = setInterval(() => {
        if (!md.isConnected) {
          delete XMV[mid];
          clearInterval(iv);
        }
      }, 700);
    }
    updChg();
    prev();
    let RESULT = null;
    let ACCKEEP = null,
      ACCNOTE = '';
    $('#aroll', md).onclick = () => {
      let mv = MVS(atk)[+mvSel.value];
      if (!mv) return;
      try {
        if (
          anulAsk(
            atk,
            mv,
            mtys(mv),
            [...md.querySelectorAll('[data-t]:checked')]
              .map(cb => {
                const [sd, ar] = String(cb.dataset.t).split('_');
                return (entered(b, sd) || {})[ar];
              })
              .filter(Boolean),
            () => {
              /* 11-23 실전 방 시험: 고르는 창이 공격 창을 덮어 닫는다 → 같은 기술 · 같은 대상으로 공격 창을 다시 열고 판정을 이어서 누른다 */ const sl =
                [...md.querySelectorAll('[data-t]:checked')].map(cb => cb.dataset.t);
              const mi = +mvSel.value;
              openAttack(mid, { mvIdx: mi, targets: sl, preT: 1 });
              setTimeout(() => {
                try {
                  const m2 = document.querySelector('#aroll');
                  if (m2 && !m2.disabled) m2.click();
                } catch (_) {}
              }, 700);
            }
          )
        )
          return;
      } catch (e) {
        console.warn('anulAsk', e);
      }
      if (!RF && sealed(atk, mv)) {
        if (!ctx().mgr) {
          A().toast('「봉인」 — 이 기술은 내보낼 수 없다');
          return;
        }
        A().toast('「봉인」된 기술 — GM 이라 판정은 한다 (바로잡을 때만)');
      }
      if (!RF && taunted(atk, mv)) {
        if (!ctx().mgr) {
          A().toast('「도발」 — 변화기는 내보낼 수 없다');
          return;
        }
        A().toast('「도발」 중 변화기 — GM 이라 판정은 한다 (도발 턴은 줄지 않는다)');
      }
      if (!RF) {
        const w = mvBan(atk, mv);
        if (w) {
          if (!ctx().mgr) {
            A().toast(w);
            return;
          }
          A().toast(w + ' — GM 이라 판정은 한다');
        }
      }
      if (!RF) {
        const w = mvSoft(atk, mv);
        if (w) A().toast(w);
      }
      if (isNG(mv) && !NG) {
        A().toast(`나무열매를 지니고 있지 않아 「${NGN}」는 실패한다`);
        A().sysLog(
          `【공격】 ${atk.name} 『${NGN}』 — ${IT(atk) ? '「' + IT(atk) + '」는 자연의은혜에 쓸 수 없는 소지품이라' : '나무열매를 지니고 있지 않아'} 실패했다`,
          'battle',
          { mid, img: atk.image || '' }
        );
        A().closeModal();
        return;
      }
      {
        const FI = OI() && OI().moveKind && OI().moveKind(mv) === 'fling' ? OI().flingInfo(atk) : null;
        if (FI && !FI.ok) {
          A().toast(`${FI.why} 「${mv.name}」는 실패한다`);
          A().sysLog(`【공격】 ${atk.name} 『${mv.name}』 — ${FI.why} 실패했다`, 'battle', { mid, img: atk.image || '' });
          A().closeModal();
          return;
        }
      } /* 11-06 내던지기: 빈손 · 못 던지는 소지품 · 서투름 · 금제 */
      {
        const PP = plPartner(b, atk, mv);
        if (
          PP &&
          confirm(
            `아군 ${PP.m.name}이(가) 「${PP.mv}」를 골라 두었다 — 합체한다?\n\n확인: ${atk.name}은(는) 기다리고(공격 없음) ${PP.m.name}의 차례를 바로 다음으로 당긴다\n취소: 따로 공격한다`
          )
        ) {
          const O = (b.order || []).slice();
          const cur = +b.orderIdx || 0;
          const ai = O.findIndex(o => o.mid === atk.id);
          const at = ai >= 0 ? ai : cur;
          const it = PP.oi >= 0 ? O.splice(PP.oi, 1)[0] : null;
          if (it) O.splice(at + 1, 0, it);
          const ops = [[['battle', 'pledgeW'], { turn: +b.turn || 0, side: atk.side, mv: plNm(mv), by: atk.id, for: PP.m.id }]];
          if (it && O.length) ops.push([['battle', 'order'], O]);
          A().closeModal();
          A()
            .setMany(ops)
            .then(() =>
              A().sysLog(
                `【공격】 ${atk.name} 『${mv.name}』 — ${PP.m.name}의 기술을 기다리고 있다 (합체 · ${PP.m.name}의 차례를 바로 다음으로)`,
                'battle',
                { mid, img: atk.image || '' }
              )
            );
          return;
        }
      } /* 11-07 맹세 합체: 첫 번째 */
      {
        const TD = tdeclOf(b, atk);
        if (
          TD &&
          TD.mv &&
          mvNameEq(TD.mv, mv.name) &&
          !(
            ctx().mgr &&
            confirm(
              `『${TD.src || '고유'}』 — 「${mv.name}」은(는) 「타임」으로 선언된 기술이라 실패한다.\n\n확인: 그래도 굴린다 (GM 판정)\n취소: 실패로 끝낸다`
            )
          )
        ) {
          A().toast(`선언된 기술 「${mv.name}」 — 실패한다`);
          A().sysLog(`【공격】 ${atk.name} 『${mv.name}』 — 『${TD.src || '고유'}』(으)로 선언된 기술이라 실패했다`, 'battle', {
            mid,
            img: atk.image || ''
          });
          A().closeModal();
          return;
        }
      } /* 11-24 아스트라이아 고유 ② 기술 선언 */
      if (/「날씨」가 전개되어 있지 않으면 실패/.test(String(mv.eff || '')) && !String((fieldOf(b).weather || {}).type || '')) {
        A().toast(`「날씨」가 없어 「${mv.name}」는 실패한다`);
        A().sysLog(`【공격】 ${atk.name} 『${mv.name}』 — 「날씨」가 전개되어 있지 않아 실패했다`, 'battle', { mid, img: atk.image || '' });
        A().closeModal();
        return;
      } /* 11-07 천지를먹기 */
      const keepCK = ACCKEEP && RESULT && RESULT.checkOnly ? { checkOnly: RESULT.checkOnly, lines: RESULT.lines || [] } : null;
      RESULT = null;
      SECADJ = { add: +($('#asecadd', md) || {}).value || 0, sure: !!($('#asecsure', md) || {}).checked };
      /* 행동 판정: 상태 변화로 못 움직이면 여기서 끝. 적용하면 상태 변화(잠듦 남은 턴·얼음 해제 등)와 로그만 남는다 */
      if (keepCK) RESULT = keepCK;
      if (
        !RF &&
        !ACCKEEP &&
        $('#achk', md).checked &&
        F() &&
        ['Flinch', 'Sleep', 'Paralysis', 'Freeze', 'Attract', 'Confusion'].some(k => (atk.states || {})[k] && k !== opt.skipSt)
      ) {
        const am = JSON.parse(JSON.stringify(atk));
        const r = F().actionCheck(am, {
          skip: opt.skipSt ? [opt.skipSt] : [],
          keep: keepSt(atk),
          sleepOk: /^\s*「\s*잠듦\s*」\s*상태일\s*때/.test(String((mv && mv.eff) || ''))
        });
        if (!r.ok) {
          let self = 0;
          if (r.selfHit) {
            self = F().confusionHit(am);
            am.hp.cur = Math.max(0, am.hp.cur - self);
            r.lines.push(`${am.name} 자작 대미지 −${self} → HP ${am.hp.cur}/${am.hp.max}${am.hp.cur <= 0 ? ' 빈사!' : ''}`);
          }
          RESULT = { check: am, lines: r.lines, mv };
          const rT = s3tid(b, atk);
          const rc = ['Paralysis', 'Confusion'].some(k => (atk.states || {})[k]) && !(atk.states || {}).Flinch ? s3card(c, rT, '행동다시') : null;
          $('#ares', md).innerHTML =
            `<div class="card" style="border-color:var(--red)"><b>행동 실패</b><div class="small" style="white-space:pre-wrap;margin-top:4px">${esc(r.lines.join('\n'))}</div>${rc ? `<div class="row" style="margin-top:6px"><button class="btn sm pri" id="a3rise">🗝 「${esc(rc.n)}」 — 마비 · 혼란 판정 다시</button></div>` : ''}</div>`;
          $('#aapply', md).disabled = false;
          {
            const bt = $('#a3rise', md);
            if (bt)
              bt.onclick = async () => {
                bt.disabled = true;
                await s3use(rT, `${atk.name} 행동 판정 다시`);
                A().sysLog(
                  `【은열쇠】 ${(((A().ST.state.roster || {}).trainers || {})[rT] || {}).name || ''} 『${rc.n}』 — ${atk.name} 행동 판정 다시`,
                  'battle'
                );
                click('#aroll');
              };
          }
          aSum(md, `<em>행동 실패</em> ${esc(String(r.lines[0] || '').slice(0, 40))}`);
          aScroll(md);
          return;
        }
        RESULT = { checkOnly: am, lines: r.lines };
        if (r.lines.length) $('#ares', md).innerHTML = `<div class="small dim" style="white-space:pre-wrap">${esc(r.lines.join('\n'))}</div>`;
      }
      const targets = [...md.querySelectorAll('[data-t]:checked')].map(cb => cb.dataset.t);
      if (!targets.length) return A().toast('대상을 골라 줘');
      let BCN = '';
      {
        const [sd0, ar0] = String(targets[0] || '').split('_');
        const d0 = (entered(b, sd0) || {})[ar0];
        const CF = catFix(md, atk, d0, mv);
        BCN = CF.note;
        mv = CF.mv;
      } /* 11-11 셸암즈 꼴: 첫 대상 기준으로 한 번 고른다 */
      /* 11-09 감우 55: 기술 효과 글의 실패 조건 — 나온 뒤 첫 기술 · 이번 턴 공격을 받음 · 대상이 공격하지 않음 · 대상보다 늦음 · 「타입 : X」 이외 (GM 은 그래도 굴릴 수 있다) */
      {
        const au = moveAuto(mv) || {};
        const T = +b.turn || 0;
        const d0 = (() => {
          const [sd, ar] = String(targets[0] || '').split('_');
          return (entered(b, sd) || {})[ar] || null;
        })();
        let why = '';
        if (RF) {
        } else if (au.firstOnly && atk.lastMove) why = '필드에 나와 처음 내보낸 기술이 아니라';
        else if (au.failHit && (+atk.hitT === T || (atk.lastTaken && atk.lastTaken.hit && +atk.lastTaken.turn === T))) why = '이번 턴 공격을 받아';
        else if (au.failNoAtk && d0 && d0 !== atk && !ordAtk(b, d0)) why = `${d0.name}이(가) 공격하지 않아`;
        else if (au.failLate && d0 && d0 !== atk && actedB4(b, d0)) why = `${d0.name}이(가) 먼저 행동해서`;
        /* 11-23 망령 「응」: 「트림」(나무열매를 소모한 상태가 아니면) · 「추월」(대상이 「미래예지」 상태가 아니면)의 실패를 판정 — 구문 「실패무시 기술:X」가 걸려 있으면 넘긴다 */
        else if (
          (au.failNoBerry || au.failNoSt) &&
          (() => {
            const nm = x => String(x || '').replace(/\s/g, '');
            const nf = spL(atk, 'nofail').find(e => !e.mv || !e.mv.length || e.mv.some(x => nm(x) === nm(mv.name)));
            if (nf) return false;
            if (au.failNoBerry && !(atk.ateBerry || (atk.itemUsed && /열매$/.test(String(atk.itemUsed.name || '').trim())))) {
              why = '「나무열매」를 소모한 상태가 아니라';
              return true;
            }
            if (au.failNoSt && d0 && d0 !== atk && !(d0.states || {})[au.failNoSt]) {
              why = `${d0.name}이(가) 「${au.failNoStKo || au.failNoSt}」 상태가 아니라`;
              return true;
            }
            return false;
          })()
        ) {
        } else if (au.onlyVs && d0 && !(au.onlyVsL || [au.onlyVs]).some(t => tysOf(d0).includes(t)))
          why = `${d0.name}이(가) 「${(au.onlyVsL || [au.onlyVs]).map(t => S().typeKo(t)).join(' · ')}」 타입이 아니라`;
        /* 11-25 망령 「불꽃특공 화상은 불꽃도 걸려야」: 「반동 : 화상」 기술은 자신이 「화상」이 될 수 없으면 실패 — 기술 글(비고)에 「「타입 : 불꽃」이라도 「화상」」이면 불꽃 타입 면역만 넘긴다 */
        else if (
          RCB_RE.test(String(mv.eff || '')) &&
          FX() &&
          FX().canState &&
          (() => {
            const r = FX().canState(atk, 'Burn', atk, rcbFire(mv) ? { fireOk: 1 } : null);
            if (r) {
              why = `${atk.name}이(가) 「화상」 상태가 될 수 없어 (${r.replace(/^\S+\s/, '')})`;
              return true;
            }
            return false;
          })()
        ) {
        } else {
          /* 11-15 망령 「메이링 승률이 실제보다 높다」 → 썬더랜스 「연속 제한 : 실패 확률 증가」가 방어 기술에만 걸려 있었음: 바로 전 턴에 같은 기술을 냈으면 1/3 · 1/9 … , 「확정 실패」면 실패 */ const nc =
            (atk.fx || {}).noConsec;
          const ncOk = nc && +nc.t === T && (!(nc.mv || []).length || nc.mv.includes(mv.name)) && (!nc.ally || !d0 || d0 === atk || sameT(d0, atk));
          /* 11-18 쌀공주의 경단: 연속무시 */ const why2 = ncOk ? '' : consecFail(atk, mv, T);
          if (why2) why = why2;
        }
        if (why && !(ctx().mgr && confirm(`${why} 「${mv.name}」 — 실패한다.\n\n확인: 그래도 굴린다 (GM 판정)\n취소: 실패로 끝낸다`))) {
          A().toast(`${why} 「${mv.name}」 — 실패한다`);
          A().sysLog(`【공격】 ${atk.name} 『${mv.name}』 — ${why} 실패했다`, 'battle', { mid, img: atk.image || '' });
          A().closeModal();
          return;
        }
      }
      /* 10-26 망령: 「기술 방어」(방어 · 판별 · 니들가드 …) — 성공하면 턴 종료까지 상대 기술을 막는다. 「연속 제한 (방어)」: 바로 전 턴에 성공했으면 1/3, 1/9 … */
      const PROT = protMove(mv);
      let PR = null;
      if (PROT) {
        const t0 = +b.turn || 0;
        const k = atk.protectLast === t0 - 1 ? +atk.protectN || 0 : 0;
        const ch = Math.pow(1 / 3, k);
        const rl = Math.random();
        PR = { ok: rl < ch, chance: Math.round(ch * 1000) / 10, k };
      }
      const PBY = protBypass(mv);
      const NX = !RF && FX() && FX().nextOf ? FX().nextOf(atk) : [];
      const g = id => $('#' + id, md);
      const n = id => +g(id).value;
      const ck = id => g(id).checked;
      const moveTypes = mtys(mv);
      SECX = spL(atk, 'secx')
        .filter(e => spHit(e, mv, moveTypes) && !e.mode && !(FX() && FX().hasCond && FX().hasCond(Object.assign({}, e, { types: [], tg: [] }))))
        .reduce((a, e) => a * (+e.v || 1), 1);
      SECXM = {};
      const atkTypes = proteanTys(atk, mv) || (atk.teraActive && atk.teraEn !== '-' ? [...atk.types, atk.teraEn] : atk.types);
      const res = [];
      const multiTarget = targets.length > 1;
      const SPW = specialPowFor(mv.name, atk);
      const ACCX = d => {
        const au = moveAuto(mv);
        return au && au.accNot && d && !tysOf(d).includes(au.accNot.ty) ? au.accNot.acc : mv.acc;
      };
      const MAU0 = moveAuto(mv),
        MAU1 =
          MA() && MA().auto(MAU0)
            ? MAU0
            : null; /* 11-22 망령 카밀라 특성 『흡정』 「자신의 「단일기」에 「드레인 : 1/2」의 추가 효과를 부여한다」: 특성 · 포텐셜 글에 그 꼴이 있으면 「단일기」(범위 1체 · 변화 아님)에 드레인을 붙인다 — 기술에 이미 드레인이 있으면 그대로 */
      const MAU2 = (() => {
        if (mv.cat === '변화' || String(mv.range || '') !== '1체' || (MAU1 && MAU1.drain)) return MAU1;
        const SRC = [[atk.ability, abTxt(atk)], ...(atk.pots || []).map(p => [p && p.name, p && p.eff])];
        for (const [nm, tx] of SRC) {
          const mm = String(tx || '').match(
            /자신의\s*「\s*단일기\s*」\s*에\s*「\s*드레인\s*[:：]\s*(\d+\s*\/\s*\d+)\s*」\s*의?\s*추가\s*효과를\s*부여/
          );
          if (mm)
            return Object.assign({ groups: [], notes: [], src: 'grant' }, MAU1 || {}, {
              drain: mm[1].replace(/\s/g, ''),
              drainBy: String(nm || '').replace(/[『』]/g, '')
            });
        }
        return MAU1;
      })();
      const MAU = drainUp(
        atk,
        mv,
        MAU2,
        targets,
        b
      ); /* 11-26 376 「X」의 「드레인」을 강화(a/b→c/d) */ /* 변칙 위력 기술: 대상마다 위력 자동 (매그니튜드 같은 무작위는 한 번만 굴림) */
      /* 11-04 망령 (관사 · 도모에 『활솜씨』): 「N할로 자신의 기술이 필중한다」 특성 · 포텐셜은 굴릴 때 한 번 굴려 필중으로 */
      let abSure = false,
        abNote = '';
      if (mv.cat !== '변화' && !ck('asure')) {
        const SRC = [[atk.ability, abTxt(atk)], ...(atk.pots || []).map(p => [p && p.name, p && p.eff])];
        for (const [nm, tx] of SRC) {
          const mm = String(tx || '').match(/(\d+)할(?:의 확률)?로\s*자신의\s*기술이\s*필중/);
          if (!mm) continue;
          const N = +mm[1];
          const r0 = 1 + Math.floor(Math.random() * 10);
          abSure = r0 <= N;
          abNote = `『${nm || '특성'}』 ${N}할 필중 — 굴림 ${r0}/${N} ${abSure ? '발동! 이번 기술은 필중' : '불발'}`;
          break;
        }
      }
      let MCLU = false;
      for (const slot of targets) {
        if (ACCKEEP && ACCKEEP[slot]) {
          res.push(ACCKEEP[slot]);
          continue;
        }
        /* 11-05 은열쇠 명중 다시: 다른 대상 결과는 그대로 */ const [side, area] = slot.split('_');
        const def = entered(b, side)[area];
        if (!def) continue;
        const AF = atk.flags || {},
          DF = def.flags || {};
        const phys = mv.cat === '물리',
          spec = mv.cat === '특수';
        /* 11-08 20:55 망령 「버텨라 ① 턴 종료 시까지 아군을 「회피율 : 0」 — 자동화 안 돼 있다」 → 「회피 랭크 · 보정 무시」로 (물러나! · 피해라! ② 「그 기술에 대해 회피율 : 0」도 같이 — 필중기로 회피가 막혔을 때) */ const EVA0 =
          def !== atk && (!!DF.endure || (phys && !!DF.dodgePhys) || (spec && !!DF.dodgeSpec));
        /* 11-08 23:4x 망령 「버텨라 자동화 한거 아니었냐? 왜 빗나간거임」(최북 『빙산바람』 7410/6800 빗나감): 『버텨라!』 ① 「회피율 : 0」 → 망령 11-08 「필중이랑은 좀 다르고. 명중률이 반드시 100이 된다에 가까워」: 명중 굴림의 목표를 100% 로 (필중 아님). 「회피 N할」 추가 굴림도 끈다 (망령 「버텨라 중에는 그것도 꺼」). 기술 방어 · 와이드가드 · 무효 · 「맞출 수 없다!」는 그대로 */ const ENDSURE =
          def !== atk && !!DF.endure && !AF.acc0;
        const tySure = (() => {
          const m = String(mv.eff || '').match(/「타입\s*:\s*([^」]+)」(?:이|가)\s*(?:내보내면|사용하면)[^.]*「필중기」/);
          return !!m && tysOf(atk).includes(S().typeEn(m[1].trim()));
        })(); /* 11-05 맹독: 「타입 : 독」이 사용하면 「필중기」 */
        /* 11-08 51-2 ⑯~⑳ · ④ · ⑤ · ⑬: 받는 쪽 상태(록온 · 마음의눈 = 필중 · 반무적 무시, 대검돌격 · 작아지기 = 필중 · 위력 2배, 반무적 = 자동 빗나감) · 미클열매 · 포커스렌즈 · 메트로놈 */
        const DST = def.states || {};
        const LKO = def !== atk && !!(DST.LockOn || DST.Gaze) && (!def.lockFrom || def.lockFrom === atk.id);
        /* 건 포켓몬의 기술만 */ const GRS = def !== atk && !!DST.GlaiveRush;
        const MINI =
          def !== atk &&
          !!DST.Minimize &&
          (/다이브/.test(String(mv.tag || '')) ||
            /「작아지기」/.test(String(mv.eff || ''))); /* 상태 DB: 상대의 「다이브」 기술이 2배 위력으로 필중 */
        const SM =
          def !== atk
            ? (() => {
                const st = (def && def.states) || {};
                const g = (((DB().states || {}).groups || []).find(x => x.l === '반무적') || {}).s || SEMI0;
                return g.find(k => k !== 'Protect' && st[k]) || '';
              })()
            : '';
        /* 11-26 05:51 망령 「방어 관통 — 표기는 되는데 안 뚫린다」: 상태 DB 반무적 묶음에 「방어」(Protect)도 들어 있어 반무적 자동 빗나감(0/0)이 관통보다 먼저 막았다 — 「방어」는 아래 protBlock(관통 · 해제 반영)에만 맡긴다 */ const smKo =
          SM ? stKoU(SM) : '';
        const semiMiss =
          !!SM &&
          !LKO &&
          !noGuard(atk) &&
          !noGuard(def) &&
          !String(mv.eff || '').includes(smKo) &&
          !(SM === 'Fly' && /하늘에\s*(?:떠\s*)?있는\s*대상/.test(String(mv.eff || ''))) &&
          !semiPass(atk, mv, smKo);
        const MCL =
          def !== atk &&
          +mv.acc > 0 &&
          HAS(atk, '미클열매') &&
          atk.hp.cur <= Math.floor(atk.hp.max / 4) &&
          !/일격기/.test(String(mv.eff || '') + String(mv.tag || ''));
        if (MCL) MCLU = true;
        const FCL = def !== atk && +mv.acc > 0 && HAS(atk, '포커스렌즈') && actedB4(b, def);
        const MTR =
          mv.cat !== '변화' && HAS(atk, '메트로놈') && atk.metro && nmMv(atk.metro.name) === nmMv(mv.name)
            ? Math.min(2, Math.round((1 + 0.1 * (+atk.metro.n || 0)) * 100) / 100)
            : 1;
        const SMX = !!SM && !semiMiss && new RegExp('「' + smKo + '」[^.]{0,24}2배의 위력').test(String(mv.eff || ''));
        const XP = (GRS ? 2 : 1) * (MINI ? 2 : 1) * (SMX ? 2 : 1) * MTR; /* 지진 → 구멍 안 · 파도타기 → 물 안 · 회오리 → 하늘 위 = 2배 */
        /* 11-23 글 「(「X」 상태인 상대에게 내보내는) 「기술」이 【필중】 한다」(디케 『아버지의 위광』) */ let txSure = '';
        try {
          const nq = x => String(x || '').replace(/\s/g, '');
          for (const p of potSrc(atk)) {
            {
              const L0 = limOf(p, atk.potUses || {}, atk.potTurn || {});
              if (L0.left !== null && L0.left <= 0) continue;
            }
            /* 11-23 【보급】 · 【N/시】 · 【탈진】을 다 썼으면 안 걸린다 */ for (const q of String((p && p.eff) || '').matchAll(
              /(?:「([^」]+)」\s*상태인\s*상대에게\s*(?:내보내는\s*)?)?「([^」:]+)」(?:이|가)\s*(?:【\s*필중\s*】|필중)\s*(?:한다|된다)/g
            )) {
              if (nq(q[2]) !== nq(mv.name)) continue;
              if (q[1]) {
                const k = FX() && FX().stEn(q[1]);
                if (!k || !(def.states || {})[k]) continue;
              }
              txSure = p.name;
              break;
            }
            if (txSure) break;
          }
        } catch (e) {}
        const sure =
          !!txSure ||
          LKO ||
          GRS ||
          MINI ||
          tySure ||
          abSure ||
          ck('asure') ||
          md.dataset.wsure === '1' ||
          (!RF &&
            (AF.surehit ||
              (phys && AF.hitPhys) ||
              (spec && AF.hitSpec) ||
              !!(
                FX() &&
                FX().nextOf &&
                FX()
                  .nextOf(atk)
                  .some(e => e.sure)
              ) ||
              (() => {
                try {
                  return !!(def !== atk && FX() && FX().attackMods(roleV(atk), roleV(def), moveQuery(atk, def, mv, moveTypes, 1, !multiTarget)).sh);
                } catch (e) {
                  return false;
                }
              })()));
        /* 11-23 구문 「필중화」 */ const PCR = {};
        const CQ = (() => {
          try {
            return B().critStage(atk, def, {
              input: n('acrit'),
              order: n('acritord') + orderCrit(atk, def).v + moveCritOf(mv) + keenCritOf(atk) + itemCrit(atk, def) + crAdj(atk, def)
            });
          } catch (e) {
            return 0;
          }
        })();
        const PQ = x => Object.assign(x, { pcr: PCR, crit: CQ, sureMv: x.sureMv || sure });
        /* 11-09 감우 54-B: 판정마다 굴리는 확률(대상 한 명마다 같은 PCR) · 급소 랭크 · 필중기 조건 */ const IG = FX()
          ? iuIgnore(roleV(atk), roleV(def), PQ(moveQuery(atk, def, mv, moveTypes, 1, !multiTarget)))
          : {};
        const sureMv = sure || !+mv.acc;
        /* 10-26 망령 판정: 「필중기」는 『피해라!』『물러나!』로 피할 수 없다 */ const autoMiss =
          (!RF && ((phys && DF.dodgePhys) || (spec && DF.dodgeSpec)) && !sureMv) ||
          AF.acc0; /* 11-23 반사 공격에는 『물러나!』『피해라!』 타이밍이 없다 */
        /* 사이코필드: 땅 위의 포켓몬은 상대의 선공 기술(우선도 +1 이상)을 받지 않는다 */
        const psyBlock =
          f.terrain.type === '사이코필드' &&
          !sameT(def, atk) &&
          grd(def) &&
          (FX() ? FX().prioOf(atk, mv) : +mv.prio || 0) >= 1; /* 11-07 망령: 우선도 +0.5 같은 소수는 막지 않는다 — +1 이상만 */
        const itImm = OI() && mv.cat !== '변화' ? OI().immune(def, moveTypes) : '';
        /* 11-09 망령 「A·B·E 다 고치기」: 「완화 ×0」 = 효과가 없다 (방탄 · 방진 · 텔레파시 · 조건부 무효) — 상성 · 조건을 보고 명중 판정 전에 막는다 */ let NUL =
          '';
        try {
          if (FX() && FX().nullOf && def !== atk) {
            const e0 =
              mv.cat === '변화'
                ? null
                : B().effectiveness(moveTypes, def, {
                    scrappy: scrL(atk, def),
                    multiMode: +g('amulti').value,
                    atkTypes,
                    force: g('aforce').value === '' ? null : +g('aforce').value
                  });
            NUL = FX().nullOf(
              roleV(atk),
              roleV(def),
              PQ(Object.assign(moveQuery(atk, def, mv, moveTypes, e0 ? e0.value : 1, !multiTarget), { stab: !!(e0 && e0.stab) }))
            );
          }
        } catch (e) {
          NUL = '';
        }
        /* 11-23 망령 (오렐리오 고유 『성화를 받드는 손』 「【소진】【방호】/아군이 「불꽃」 기술(대미지)을 받으면 무효화하고 「특공 : +1」한다」) */ if (
          !NUL &&
          def !== atk &&
          mv.cat !== '변화'
        ) {
          const an = allyNul(b, def, moveTypes, anulKey(atk, mv));
          if (an) NUL = an.name;
        }
        /* 11-23 망령 「특성 만트라 룬 자동화 되어 있음?」: 룬 = 【방호】/자신의 「타입1」과 같은 기술을 무효화 (변화기 포함 · 같은 편 기술 · 특성 무시는 빼고). 만트라(같은 타입 공격 회피)는 아래 mantraH */ if (
          !NUL &&
          def !== atk &&
          abNm(def) === '룬' &&
          def.hp &&
          def.hp.cur > 0 &&
          !sameT(def, atk, b) &&
          !moldOn(atk, mv)
        ) {
          const t1 = (tysOf(def) || [])[0];
          if (t1 && t1 !== '-' && (moveTypes || []).includes(t1)) NUL = '룬';
        }
        /* 와이드가드(「전체기 방어」): 그 진영이 받는 전체기(대상 2체 이상 · 범위가 전체인 기술)를 막는다 — 같은 편 전체기도 */ const wideBlock =
          def !== atk &&
          +(((f.objects || {})[def.side] || {})['와이드가드'] || 0) > 0 &&
          (multiTarget || /전체|자신\s*이외/.test(String(mv.range || '')));
        /* 11-22 망령 「특성 엔진 처리」: 너럭바위 = 【방호】/아군이 「타입 : 바위」일 때 아군 전체에 대한 「전체기」를 무효화 (그 편 필드에 너럭바위 + 다른 바위 타입 아군) · 프렌드쉽 = 아군에 대한 「전체기」가 반드시 빗나간다 (같은 편끼리 맞는 전체기) */
        const SPRD = multiTarget || /전체|자신\s*이외/.test(String(mv.range || ''));
        const rockH =
          def !== atk && SPRD && !moldOn(atk, mv)
            ? abOnField(b, '너럭바위', def, true).find(h =>
                Object.values(b.mons || {}).some(
                  x => x && x.entry && x.hp && x.hp.cur > 0 && x.id !== h.id && sameT(x, h, b) && tysOf(x).includes('Rock')
                )
              )
            : null;
        const friendH = def !== atk && SPRD && sameT(def, atk, b) ? abOnField(b, '프렌드쉽', def, true)[0] : null;
        /* 11-23 망령 「「특성 : 만트라」로 기술을 회피했을 때 … 자동화 안 돼 있어?」: 만트라 = 자신과 같은 타입의 공격을 회피 (기술 타입 중 하나라도 자신의 타입이면 · 변화기 · 특성 무시는 빼고). 회피로 처리하고 적용 때 「특성 : 만트라」 발동 계기(trFire)를 남긴다 */
        /* 11-23 망령 「포켓몬 이름을 직접 지정」(메리 『샴언니의 우애』 「「엘리자 철허스트」에 대한 「지진」이 반드시 빗나간다」): 맞는 쪽 편(자신 포함) 필드 위 포켓몬의 포텐셜 글 */ let nameMissH =
          null;
        try {
          const nq = x => String(x || '').replace(/\s/g, '');
          for (const x of Object.values(b.mons || {})) {
            if (!x || !x.entry || !(x.hp && x.hp.cur > 0) || !sameT(x, def, b)) continue;
            for (const p of potSrc(x)) {
              const q = String((p && p.eff) || '').match(/「([^」:]+)」에\s*대한\s*「([^」:]+)」(?:이|가)\s*반드시\s*빗나간다/);
              /* 이름은 낱말마다 앞부분만 맞아도 (「엘리 철허스트」 = 엘리자 철허스트) */ const nmEq = (w, n) => {
                if (nq(w) === nq(n)) return true;
                const A = String(w).trim().split(/\s+/),
                  B2 = String(n).trim().split(/\s+/);
                return A.length === B2.length && A.every((x, i) => x.length >= 2 && B2[i].startsWith(x));
              };
              if (q && nmEq(q[1], def.name) && nq(q[2]) === nq(mv.name)) {
                nameMissH = { name: x.name, pot: p.name };
                break;
              }
            }
            if (nameMissH) break;
          }
        } catch (e) {}
        const mantraH =
          def !== atk &&
          mv.cat !== '변화' &&
          abNm(def) === '만트라' &&
          def.hp &&
          def.hp.cur > 0 &&
          !moldOn(atk, mv) &&
          (moveTypes || []).some(t => t && t !== '-' && tysOf(def).includes(t));
        /* 11-24 망령 (묘선공주 『속세를 벗어나다』 「【1/시】【자동】/「특성 : 만트라」가 「따라가때리기」「유턴」 기술에도 발동한다」 · 「효과가 부여된 것도」): 태그 · 효과 글 · 부여(추격 · 다음기술 유턴/추격)로 그런 기술이면 만트라로 회피 — 횟수는 적용 때 깎는다(evPot) */ let mantraX =
          '';
        if (!mantraH && def !== atk && mv.cat !== '변화' && abNm(def) === '만트라' && def.hp && def.hp.cur > 0 && !moldOn(atk, mv)) {
          try {
            const pp = potSrc(def).find(
              p => p && /「\s*특성\s*:\s*만트라\s*」\s*(?:이|가)[^.\n]*(?:따라가때리기|유턴)[^.\n]*기술에도\s*발동/.test(String(p.eff || ''))
            );
            if (pp) {
              const L = limOf(pp, def.potUses || {}, def.potTurn || {});
              const NXa = (FX() && FX().nextOf ? FX().nextOf(atk) : []) || [];
              if (!(L.left !== null && L.left <= 0) && (isPursuit(mv, atk) || isUturn(mv, atk) || NXa.some(e => e && (e.uturn || e.pursuit))))
                mantraX = String(pp.name || '');
            }
          } catch (e) {}
        }
        /* 11-15 망령 「지원 기술 다 개선」: 트릭가드(「변화기 방어」) = 그 진영이 상대에게서 받는 변화기를 막는다 · 에임가드(「필중기 방어」) = 그 진영이 상대에게서 받는 필중기를 막는다 (둘 다 턴 종료까지) */
        const objOn = k => +(((f.objects || {})[def.side] || {})[k] || 0) > 0;
        const craftyBlock = def !== atk && def.side !== atk.side && mv.cat === '변화' && objOn('트릭가드');
        const aimBlock =
          def !== atk && def.side !== atk.side && objOn('에임가드') && (/「필중기」/.test(String(mv.eff || '')) || (mv.cat !== '변화' && !+mv.acc));
        const effPre =
          mv.cat === '변화'
            ? null
            : B().effectiveness(moveTypes, def, {
                scrappy: scrL(atk, def),
                multiMode: +g('amulti').value,
                atkTypes,
                force: g('aforce').value === '' ? null : +g('aforce').value,
                ironBall: HAS(def, '검은철구'),
                ringTarget: HAS(def, '겨냥표적'),
                vsOver: vsOf(atk, def, mv, moveTypes),
                floating: (def.states || {}).MagnetRise || (def.states || {}).Telekinesis || (FX() && FX().floating(def)) || HAS(def, '풍선')
              });
        /* 11-05 망령: 조건부 회피 강화(약점회피 「회피 ×1.1 굉장」) — 상성을 명중 판정 전에 본다 */ const EVM =
          FX() && FX().evaMods && def !== atk
            ? FX().evaMods(
                roleV(atk),
                roleV(def),
                PQ(Object.assign(moveQuery(atk, def, mv, moveTypes, effPre ? effPre.value : 1, !multiTarget), { stab: !!(effPre && effPre.stab) }))
              )
            : { v: 1, names: [] };
        /* 11-08: 때리는 쪽 「명중×N」 줄(기술 · 태그 조건) */ const ACM =
          FX() && FX().accMods && def !== atk
            ? FX().accMods(
                roleV(atk),
                roleV(def),
                PQ(Object.assign(moveQuery(atk, def, mv, moveTypes, effPre ? effPre.value : 1, !multiTarget), { stab: !!(effPre && effPre.stab) }))
              )
            : { v: 1, names: [] };
        /* 11-11 망령 「【1/시】【선행】/자신의 「전체기」가 상대의 「방어」 등의 기술을 관통한다 — 관통 · 해제 자동화, 관통(해제) 당하지 않는다도」:
       공격하는 쪽 지속 줄 「위력 ×1 방어관통|방어해제 [전체기 …] [이번턴]」(FX attackMods pp · pb) + 기술 글(protBypass) · 맞는 쪽 「완화 ×1 관통무시」(np)나 글 「관통(해제) 당하지 않는다」면 둘 다 안 통한다 */
        const PPM = (() => {
          try {
            return FX() && def !== atk
              ? FX().attackMods(
                  roleV(atk),
                  roleV(def),
                  PQ(Object.assign(moveQuery(atk, def, mv, moveTypes, effPre ? effPre.value : 1, !multiTarget), { stab: !!(effPre && effPre.stab) }))
                )
              : {};
          } catch (e) {
            return {};
          }
        })();
        /* 11-26 05:51 망령 「방어 관통 — 표기는 되는데 방어가 안 뚫린다」: 관통 판정이 상성을 1(보통) · 자속 없음으로 물어서 「굉장」 · 자속 · 급소 같은 조건이 붙은 관통 줄이 여기선 안 맞고, 대미지 쪽(진짜 상성)에서만 맞아 「관통」 글만 떴다 — 대미지 쪽과 같은 물음으로 */ const NPX =
          def !== atk && noPierce(def);
        const BYP = NPX ? '' : PBY === 'clear' || PPM.pb ? 'clear' : PBY || (PPM.pp ? 'pass' : '');
        /* 11-11 망령 「방어 상태를 해제해도 기술 방어가 여전히 유지」: 「방어」 상태(states.Protect)만 본다 — 기술 방어를 쓰면 상태와 flags.protect 를 같이 걸고, 상태 창에서 풀면 막기도 풀린다 */
        /* 11-23 망령 「기술의 반사」: 공격 기술을 반사하는 상대 — 이미 반사된 기술 · 「반무적」일 때 받은 기술은 반사하지 않는다. 적용하면 반사한 쪽의 추가 행동(반사 공격)이 다음 칸에 선다 */ const reflH =
          def !== atk && !RF && mv.cat !== '변화' && !sameT(def, atk, b) && def.hp.cur > 0 && !SM ? bncOf(def, mv, moveTypes) : null;
        const protBlock = def !== atk && !BYP && !!(def.states || {}).Protect && def.hp.cur > 0;
        /* 11-07: 상태 DB 「방어」(Protect)도 같은 막기 */ const accRoll0 = () =>
          protBlock
            ? { prot: 1, sure: false, hit: false, target: 0, roll: 0, acc: 0, eva: 0, note: `${def.name} 「기술 방어」 — 기술을 막았다` }
            : reflH
              ? {
                  sure: false,
                  hit: false,
                  target: 0,
                  roll: 0,
                  acc: 0,
                  eva: 0,
                  refl: String(reflH.name || '반사'),
                  note: `${def.name} 「${String(reflH.name || '반사')}」 — 「${mv.name}」을(를) 반사했다`
                }
              : wideBlock && !BYP
                ? { sure: false, hit: false, target: 0, roll: 0, acc: 0, eva: 0, note: `${SIDE_KO[def.side]} 「와이드가드」 — 전체기를 막았다` }
                : rockH
                  ? { sure: false, hit: false, target: 0, roll: 0, acc: 0, eva: 0, note: `${rockH.name} 「너럭바위」 — 전체기를 무효화했다` }
                  : friendH
                    ? {
                        sure: false,
                        hit: false,
                        target: 0,
                        roll: 0,
                        acc: 0,
                        eva: 0,
                        note: `${friendH.name} 「프렌드쉽」 — 아군에 대한 전체기가 빗나갔다`
                      }
                    : nameMissH
                      ? {
                          sure: false,
                          hit: false,
                          target: 0,
                          roll: 0,
                          acc: 0,
                          eva: 0,
                          note: `${nameMissH.name} 『${nameMissH.pot}』 — ${def.name}에 대한 「${mv.name}」이(가) 빗나갔다`
                        }
                      : mantraH
                        ? {
                            sure: false,
                            hit: false,
                            target: 0,
                            roll: 0,
                            acc: 0,
                            eva: 0,
                            evTrait: '만트라',
                            note: `${def.name} 「만트라」 — 자신과 같은 타입의 공격을 회피했다`
                          }
                        : mantraX
                          ? {
                              sure: false,
                              hit: false,
                              target: 0,
                              roll: 0,
                              acc: 0,
                              eva: 0,
                              evTrait: '만트라',
                              evPot: mantraX,
                              note: `${def.name} 『${mantraX.replace(/[『』]/g, '')}』 — 「만트라」가 추격 · 유턴 기술에도 발동해 회피했다`
                            }
                          : craftyBlock
                            ? {
                                sure: false,
                                hit: false,
                                target: 0,
                                roll: 0,
                                acc: 0,
                                eva: 0,
                                note: `${SIDE_KO[def.side]} 「트릭가드」 — 변화기를 막았다`
                              }
                            : aimBlock
                              ? {
                                  sure: false,
                                  hit: false,
                                  target: 0,
                                  roll: 0,
                                  acc: 0,
                                  eva: 0,
                                  note: `${SIDE_KO[def.side]} 「에임가드」 — 필중기를 막았다`
                                }
                              : itImm
                                ? { sure: false, hit: false, target: 0, roll: 0, acc: 0, eva: 0, note: `${def.name}의 「${itImm}」 — 효과가 없다` }
                                : NUL
                                  ? {
                                      sure: false,
                                      hit: false,
                                      target: 0,
                                      roll: 0,
                                      acc: 0,
                                      eva: 0,
                                      nul: NUL,
                                      note: `${def.name}의 「${NUL}」 — 효과가 없다`
                                    }
                                  : psyBlock
                                    ? { sure: false, hit: false, target: 0, roll: 0, acc: 0, eva: 0, note: '사이코필드 — 땅 위라 선공 기술 무효' }
                                    : semiMiss
                                      ? {
                                          sure: false,
                                          hit: false,
                                          target: 0,
                                          roll: 0,
                                          acc: 0,
                                          eva: 0,
                                          note: `${def.name} 「${smKo}」 — 기술을 받지 않는다`
                                        }
                                      : autoMiss
                                        ? { sure: false, hit: false, target: 0, roll: 0, acc: 0, eva: 0, note: '지령으로 회피/명중 0' }
                                        : B().accuracy(
                                            atk,
                                            def,
                                            {
                                              acc:
                                                (md.dataset.wacc ? +md.dataset.wacc : ACCX(def)) &&
                                                (md.dataset.wacc ? +md.dataset.wacc : +ACCX(def)) + (MCL ? 20 : 0)
                                            },
                                            {
                                              accMult: n('aacc') * ACM.v * (FCL ? 1.2 : 1),
                                              sureHit: sure,
                                              starry: f.weather.type === '별하늘',
                                              fog: f.weather.type === '짙은안개',
                                              fogImmune: tysOf(atk).some(
                                                t => t === 'Poison' || t === 'Fairy'
                                              ) /* 11-01 망령: 독 · 페어리 「타입」 포켓몬만 면제 (맵툴 캠페인 calculate_attack) */,
                                              gravity: (f.etc || {})['중력'] > 0,
                                              wideLens: HAS(atk, '광각렌즈'),
                                              ignoreAcc: IG.acc,
                                              ignoreEva: EVA0 ? 7 : IG.eva,
                                              evaMult: EVA0 ? 1 : EVM.v
                                            }
                                          );
        /* 11-03 「회피 N할」: 맞은 쪽의 회피 효과 — 필중이 아니면 한 번 더 굴린다 */ const accRoll = () => {
          let r = accRoll0();
          if (ENDSURE && r && !r.sure && +r.acc > 0 && !r.hit) r = Object.assign({}, r, { hit: true, target: 10000, end100: 1 });
          else if (ENDSURE && r && !r.sure && +r.acc > 0) r = Object.assign({}, r, { target: 10000, end100: 1 });
          if (r && r.hit && !r.sure && !ENDSURE && def !== atk && !sameT(def, atk, b)) {
            const ev = spL(def, 'evade').find(
              e =>
                spHit(e, mv, moveTypes) &&
                (!(e.it && e.it.length) || e.it.some(n => HAS(def, n))) &&
                (() => {
                  try {
                    return !FX().dynOk || FX().dynOk(e, def, atk, moveQuery(atk, def, mv, moveTypes, 1, !multiTarget));
                  } catch (_) {
                    return true;
                  }
                })()
            );
            /* 11-23 10:32 회피 N할 · 중확률 … 자세:X 상태:Y (조건 낱말) */ /* 11-23 회피 N할 … 소지품:X */ if (ev) {
              const rl = 1 + Math.floor(Math.random() * 100);
              const pc = ev.pcl && FX().percentOf ? FX().percentOf(ev.pcl) : +ev.pct;
              if (rl <= pc)
                return Object.assign({}, r, {
                  hit: false,
                  evTrait: String(ev.name || '')
                    .replace(/^특성\s*:\s*/, '')
                    .trim(),
                  note: `${def.name} 「${ev.name}」 ${pc}% 회피 (${rl})`
                });
            }
          }
          return r;
        };
        const acc = accRoll();
        if (txSure && acc) acc.txSure = txSure;
        /* 효과 엔진: 상성을 먼저 보고 강화·완화·급소 조건을 맞춘다 */
        let mods = FX()
          ? FX().attackMods(
              roleV(atk),
              roleV(def),
              PQ(Object.assign(moveQuery(atk, def, mv, moveTypes, effPre ? effPre.value : 1, !multiTarget), { stab: !!(effPre && effPre.stab) }))
            )
          : { boost: 1, guard: 1, cg: 0, cr: 0, cx: '', names: [] };
        const AIG = areaBoostIgn(b, atk, def, mv);
        if (AIG) mods = boostOff(mods, atk, AIG, def);
        {
          const TBI = defBoostIgn(b, atk, def);
          if (TBI) mods = boostOff(mods, atk, TBI, def);
        } /* 11-26 타입이 내보낸 기술의 위력 강화 무시 */ /* 11-14 에리어 이동 턴 · 상대 전체기 위력 강화 무시 */
        {
          const ig = OI() && OI().defGuard(def, mv.cat);
          if (ig) {
            mods.guard = (mods.guard || 1) * ig.v;
            mods.names = (mods.names || []).concat([{ key: '_i', who: def.id, txt: ig.txt }]);
          }
        }
        /* 11-23 방 시험(219번 2-10): 특성 둘이함께 ③ 「「전체기」로 받을 대미지가 2배」 — 글에 「명중했을 때」가 있어 등장 때 저절로 안 걸리던 것. 전체기(대상 2체 이상 · 범위 전체)면 받는 쪽 ×2 (손으로 이미 걸어 둔 완화 줄이 있으면 겹치지 않는다 · 특성 무시는 빼고) */
        if (
          def !== atk &&
          mv.cat !== '변화' &&
          abNm(def) === '둘이함께' &&
          (multiTarget || /전체|자신\s*이외/.test(String(mv.range || ''))) &&
          !moldOn(atk, mv) &&
          !((def.fx || {}).mods || []).some(e => e && e.kind === 'guard' && +e.v === 2 && /둘이함께/.test(String(e.name || '')))
        ) {
          mods.guard = (mods.guard || 1) * 2;
          mods.names = (mods.names || []).concat([{ key: '_two', who: def.id, txt: `${def.name} 「둘이함께」 전체기로 받는 대미지 ×2` }]);
        }
        /* 11-09 감우 54-D: 이 대상에 대한 추가 효과 규칙 (기술 · 상대 상태 · 소지품 · 해석 … 조건) */ try {
          const SI = secInfo(
            atk,
            def,
            mv,
            moveTypes,
            PQ(Object.assign(moveQuery(atk, def, mv, moveTypes, effPre ? effPre.value : 1, !multiTarget), { stab: !!(effPre && effPre.stab) }))
          );
          SECXM[def.id] = SI;
          if (!SECXM._) SECXM._ = SI;
          if (SI.nm.length) mods.names = (mods.names || []).concat(SI.nm.map((t, i) => ({ key: '_sx' + i, who: atk.id, txt: `${atk.name} ${t}` })));
          if (SI.imm)
            mods.names = (mods.names || []).concat([{ key: '_sxi', who: def.id, txt: `${def.name} 「${SI.imm}」 추가 효과를 받지 않는다` }]);
        } catch (e) {}
        if (EVM.names.length && +mv.acc && !sure) mods.names = (mods.names || []).concat(EVM.names);
        if (ACM.names.length && +mv.acc && !sure) mods.names = (mods.names || []).concat(ACM.names);
        const iu = (atk.fx || {}).ignoreUp,
          iuD = (def.fx || {}).ignoreUp;
        let igDef = +g('aigdef').value,
          igAtk = +g('aigatk').value;
        const igW = c =>
          ({
            0: '상승·강화',
            1: '감소·저하',
            2: '상승(랭크)',
            3: '강화(배율)',
            4: '감소(랭크)',
            5: '저하(배율)',
            6: '랭크 변화',
            7: '변화 모두',
            8: '배율 변화'
          })[c] || '상승';
        const IGN = k => (IG.nm && IG.nm[k]) || (k === 'def' || k === 'eva' ? iu && iu.name : iuD && iuD.name) || '';
        if (IG.def != null && igDef === -1) {
          igDef = IG.def;
          mods.names = (mods.names || []).concat([{ key: '_iu', who: atk.id, txt: `${atk.name} 「${IGN('def')}」 상대의 방어 ${igW(IG.def)} 무시` }]);
        }
        if (IG.atk != null && igAtk === -1) {
          igAtk = IG.atk;
          mods.names = (mods.names || []).concat([{ key: '_iuD', who: def.id, txt: `${def.name} 「${IGN('atk')}」 공격 쪽 ${igW(IG.atk)} 무시` }]);
        }
        if (IG.eva != null && +mv.acc)
          mods.names = (mods.names || []).concat([
            { key: '_iuE', who: atk.id, txt: `${atk.name} 「${IGN('eva')}」 상대의 회피 ${igW(IG.eva)} 무시` }
          ]);
        if (IG.acc != null && +mv.acc)
          mods.names = (mods.names || []).concat([
            { key: '_iuA', who: def.id, txt: `${def.name} 「${IGN('acc')}」 공격 쪽 명중 ${igW(IG.acc)} 무시` }
          ]);
        /* 기술 글 「대상의 랭크 변화를 무시한다」(성스러운칼 · 야금야금 …): 방어 쪽 랭크를 위아래 모두 무시 */ if (
          igDef === -1 &&
          /대상의\s*랭크\s*변화를\s*무시/.test(String(mv.eff || ''))
        ) {
          igDef = 6;
          mods.names = (mods.names || []).concat([{ key: '_mvig', who: atk.id, txt: `「${mv.name}」 대상의 랭크 변화 무시` }]);
        }
        const OC = orderCrit(atk, def);
        if (OC.v) mods.names = (mods.names || []).concat([{ key: '_ord', who: atk.id, txt: OC.txt }]);
        if (BCN) mods.names = (mods.names || []).concat([{ key: '_bc', who: atk.id, txt: BCN }]);
        try {
          if (def !== atk && (def.states || {}).Protect && (PBY || PPM.pp || PPM.pb))
            mods.names = (mods.names || []).concat([
              {
                key: '_pp',
                who: atk.id,
                txt: NPX
                  ? `${def.name} — 「방어」 관통(해제)을 받지 않는다`
                  : `「방어」 ${BYP === 'clear' ? '해제' : '관통'}${PPM.pb || PPM.pp ? ' — ' + atk.name + ' 「' + (PPM.pb || PPM.pp) + '」' : ' — 「' + mv.name + '」'}`
              }
            ]);
        } catch (e) {}
        try {
          const DT = tysOf(def);
          const VE = (FX() && FX().effOver ? FX().effOver(roleV(atk), def, moveQuery(atk, def, mv, moveTypes, 1, !multiTarget)) : []).filter(x =>
            DT.includes(x.ty)
          );
          if (VE.length)
            mods.names = (mods.names || []).concat(
              VE.map(x => ({
                key: '_vs' + x.name + x.ty,
                who: atk.id,
                txt: `${atk.name} 「${x.name}」 「타입 : ${S().typeKo(x.ty)}」에게 상성 ×${x.v}`
              }))
            );
        } catch (e) {}
        const MVC = moveCritOf(mv),
          KNC = keenCritOf(atk);
        if (MVC) mods.names = (mods.names || []).concat([{ key: '_mvc', who: atk.id, txt: `「${mv.name}」 급소 +${MVC}` }]);
        if (KNC) mods.names = (mods.names || []).concat([{ key: '_knc', who: atk.id, txt: `${atk.name} 「예리${KNC}」 급소 +${KNC}` }]);
        {
          /* 11-11 망령 「거북손데스 C+4 여야 되는데 C+2 — 최종 급소율 확인이 안 된다」: 소지품 · 랭크 몫의 급소도 배율 줄에 (예전엔 계산엔 들어가도 줄에 안 보였다) */ const ICV =
            itemCrit(atk, def);
          if (ICV)
            mods.names = (mods.names || []).concat([
              { key: '_icr', who: atk.id, txt: `${atk.name} 소지품 「${IT(atk) || '?'}」 급소 ${ICV > 0 ? '+' : ''}${ICV}` }
            ]);
          const RCV = +((atk.rank || {}).critical || 0);
          if (RCV) mods.names = (mods.names || []).concat([{ key: '_rcr', who: atk.id, txt: `${atk.name} 급소 랭크 ${RCV > 0 ? '+' : ''}${RCV}` }]);
        }
        {
          const NT = [];
          const A1 = t => NT.push({ key: '_51a' + NT.length, who: atk.id, txt: t }),
            D1 = t => NT.push({ key: '_51d' + NT.length, who: def.id, txt: t });
          if (LKO) D1(`${def.name} 「${stKoU(DST.LockOn ? 'LockOn' : 'Gaze')}」 — 이 기술은 필중`);
          if (GRS) D1(`${def.name} 「대검돌격」 — 필중 · 위력 ×2`);
          if (MINI) D1(`${def.name} 「작아지기」 — 필중 · 위력 ×2`);
          if (SM && !semiMiss)
            D1(
              `${def.name} 「${smKo}」 — ${LKO ? '록온 · 마음의눈으로' : noGuard(atk) || noGuard(def) ? '「노가드」로' : '이 기술은'} 맞는다${SMX ? ' · 위력 ×2' : ''}`
            );
          if (MCL) A1(`${atk.name} 「미클열매」 — 명중 +20 (적용하면 다 쓴다)`);
          if (FCL) A1(`${atk.name} 「포커스렌즈」 — 먼저 행동한 ${def.name}에게 명중 ×1.2`);
          if (MTR > 1) A1(`${atk.name} 「메트로놈」 — 같은 기술 ${(+atk.metro.n || 0) + 1}번째 · 위력 ×${MTR}`);
          if (UMB(def) && n('aweather') !== 1 && mv.cat !== '변화') D1(`${def.name} 「만능우산」 — 날씨 배율 없음`);
          if (UMA && wxNow(b)) A1(`${atk.name} 「만능우산」 — 날씨의 효과를 받지 않는다`);
          if (HAS(def, '가벼운돌')) D1(`${def.name} 「가벼운돌」 — 기술 효과에 의한 위력 강화를 무시 (손으로)`);
          if (HAS(atk, '가벼운돌')) A1(`${atk.name} 「가벼운돌」 — 「일렉트릭볼」 등의 효과가 반드시 발동 (손으로)`);
          if (NT.length) mods.names = (mods.names || []).concat(NT);
        }
        if (mods.cx !== 'none' && CRR(def).never) {
          mods.cx = 'none';
          mods.names = (mods.names || []).concat([{ key: '_crn', who: def.id, txt: `${def.name} 급소에 맞지 않는다 (급소 규칙)` }]);
        }
        /* 특성 · 포텐셜 글 「기술이 자신의 급소에 맞지 않는다」 (조가비갑옷 · 전투무장 · 가시갑옷 …): 구문 없이도 급소 없음 */ if (
          mods.cx !== 'none'
        ) {
          const nc = [[def.ability, def.abilityEff], ...potSrc(def).map(p => [p.name, p.eff])].find(
            ([n, e]) => n && /자신의\s*급소에\s*맞지\s*않는다/.test(String(e || ''))
          );
          if (nc) {
            mods.cx = 'none';
            mods.names = (mods.names || []).concat([{ key: '_nc', who: def.id, txt: `${def.name} 「${nc[0]}」 급소에 맞지 않는다` }]);
          }
        }
        /* 11-07 망령 「예민해지기 확급 자동화가 안 되어 있다」: 공격 쪽이 「예민해지기」(LaserFocus) 상태면 반드시 급소 — 급소에 맞지 않는 쪽(조가비갑옷 · 급소 규칙)이 이긴다 */ if (
          mods.cx !== 'none' &&
          (atk.states || {}).LaserFocus
        ) {
          mods.cx = 'sure';
          mods.names = (mods.names || []).concat([{ key: '_lf', who: atk.id, txt: `${atk.name} 「예민해지기」 — 반드시 급소` }]);
        }
        /* 연속기 (맵툴 attack_target): 2~5회처럼 횟수가 범위면 첫 명중 뒤로는 확정, 2회·3회처럼 고정이면 매 회 명중 판정 (스킬링크면 첫 명중 뒤 확정) · 빗나가면 거기서 멈춘다 */
        let hits = [];
        if (acc.hit) {
          const sl = ck('askill');
          const mx = +mv.max || 1,
            mn = +mv.min || 1;
          const MH = mx > mn ? minHitOf(atk) : null;
          if (MH && !n('ahits') && !sl && mods.names)
            mods.names = (mods.names || []).concat([{ key: '_mh', who: atk.id, txt: `${atk.name} 「${MH.name}」 최소 ${Math.min(MH.n, mx)}회` }]);
          const cnt = n('ahits') || B().multiHits(mv, { skillLink: sl, min: MH ? MH.n : 0 });
          const fixedN = mx > 1 && mn === mx && !sl && !acc.sure;
          const stage = B().critStage(atk, def, {
            input: n('acrit'),
            order: n('acritord') + OC.v + MVC + KNC + (mods.cr || 0) - (mods.cg || 0) + itemCrit(atk, def) + crAdj(atk, def)
          });
          if (cnt > 1) acc.multi = { cnt, kind: mx > 1 && mn === mx ? 'fixed' : 'range', sl, more: [] };
          for (let i = 0; i < cnt; i++) {
            if (i > 0 && fixedN) {
              const a2 = accRoll();
              acc.multi.more.push(a2);
              if (!a2.hit) {
                acc.multi.stop = i + 1;
                break;
              }
            }
            const cr =
              mods.cx === 'none'
                ? { crit: false, roll: 0, chance: 0 }
                : B().critical(stage, {
                    type: g('acrittype').value !== '' ? +g('acrittype').value : +CRR(atk).tbl || 0,
                    forced: ck('acritforce') || mods.cx === 'sure' || !!CRR(atk).sure
                  });
            hits.push({ v: cr.crit ? 2 : 1, cr, stage });
          }
        }
        const objs = (f.objects || {})[side] || {};
        const wall = {};
        const WIG = wallIgn(atk, mv, mtys(mv)) && Object.keys(WALLS).some(k => objs[k] > 0);
        if (!WIG) for (const k in WALLS) if (objs[k] > 0 && !(k === '얼음의장벽' && mtys(mv).includes('Fire'))) wall[WALLS[k]] = 1;
        if (objs['얼음의장벽'] > 0 && mtys(mv).includes('Fire') && mv.cat !== '변화') {
          delete objs['얼음의장벽'];
          A()
            .set(['battle', 'field', 'objects', side, '얼음의장벽'], null)
            .then(ok => {
              if (ok) A().sysLog(`「불꽃」 기술 『${mv.name}』 — ${SIDE_KO[side]} 「얼음의장벽」이 녹아 철거됐다`, 'battle');
            });
        } /* 10-25: 대미지 계산 전에 철거 */
        const spw = SPW && !(APOWM && SPMAP[String(mv.name || '').trim()] !== 'psywave') ? SPW(def) : null;
        let powT = spw && spw.pow != null ? spw.pow : +g('apow').value;
        if (mods.pset && mv.cat !== '변화' && !APOWM) powT = +mods.pset;
        /* 11-09 감우 54-C: 「위력 =N」 (연단염소의 주조 — 방어 +2 이상이면 히트스탬프 위력 100) */ if (SPW && !spw && mods.names)
          mods.names.push({ key: '_spm', who: atk.id, txt: `변칙 위력 ${mv.name}: 손으로 위력 ${powT}` });
        if (!spw && powT > 0 && mv.cat !== '변화' && OI() && OI().moveKind && OI().moveKind(mv) === 'knock' && OI().knockable(def)) {
          powT = Math.floor(powT * 1.5);
          mods.names = (mods.names || []).concat([{ key: '_ko', who: atk.id, txt: `「${mv.name}」 ${def.name} 소지품 있음 — 위력 ×1.5 (${powT})` }]);
        } /* 11-06 탁쳐서떨구기: 뺄 수 있는 소지품을 지닌 대상만 (점착이어도) */
        /* 미스트필드: 땅 위 대상이 받는 드래곤 반감 · 눈(싸라기눈) 얼음 타입 방어 1.5 · 모래바람 바위 타입 특방 1.5 · 원더룸 방어↔특방 실수치 */
        const dTy = tysOf(def),
          dS = g('adef').value || (mv.cat === '특수' ? 'specialdefense' : 'defense');
        const fieldT = n('afield') * (f.terrain.type === '미스트필드' && moveTypes.includes('Dragon') && grd(def) ? 0.5 : 1);
        const { v: defMul, wt } = UMB(def) ? { v: 1, wt: '' } : wxDefMul(b, def, dS); /* 51-2 ⑫ 만능우산 */
        if (defMul !== 1 && mods.names)
          mods.names.push({ key: '_w', who: def.id, txt: `${def.name} 「${wt}」 ${dS === 'defense' ? '방어' : '특방'} ×${defMul}` });
        if (fieldT !== n('afield') && mods.names) mods.names.push({ key: '_t', who: def.id, txt: `${def.name} 「미스트필드」 드래곤 ×0.5` });
        /* 11-18 망령 제보 「급소가 상대 방호를 무시 못 해 — 방호 포텐셜 효과가 급소에 맞았는데도 그대로」(잔다르크 『거짓된 성녀』 공격 쪽 상승·강화 무시): 급소면 받는 쪽 【방호】 포텐셜의 「공격 쪽 상승 · 강화 무시」를 끈다 (완화 배율은 원래 급소면 1 이하를 버림) */
        let igAtkC;
        {
          if (IG.atk != null && +g('aigatk').value === -1) {
            const nm = String(IGN('atk') || '')
              .replace(/[『』]/g, '')
              .trim();
            const pp =
              nm &&
              potSrc(def).find(
                q =>
                  q &&
                  String(q.name || '')
                    .replace(/[『』]/g, '')
                    .trim() === nm
              );
            if (pp && /【\s*방호\s*】/.test(String(pp.eff || ''))) {
              igAtkC = -1;
              if (hits.some(h => h.v === 2))
                mods.names = (mods.names || []).concat([{ key: '_iuC', who: def.id, txt: `급소 — ${def.name} 「${nm}」(【방호】) 무시` }]);
            }
          }
        }
        let MVP = null,
          DOPT = null;
        const dmg =
          mv.cat === '변화' || !powT || (spw && spw.fixed) || (MAU && MAU.delay)
            ? null
            : B().damage(
                foulAtk(ATKD(def, mv), def, mv),
                aceDef(atk, def),
                (MVP = Object.assign(
                  {},
                  mv,
                  { pow: powT },
                  ATY
                    ? { typeEn: ATY, type: S().typeKo(ATY) }
                    : skinOf(atk, mv)
                      ? { typeEn: skinOf(atk, mv).ty, type: S().typeKo(skinOf(atk, mv).ty) }
                      : rndOf(mv)
                        ? { typeEn: rndOf(mv), type: S().typeKo(rndOf(mv)) }
                        : wxMoveTy(b, mv, atk)
                          ? { typeEn: wxMoveTy(b, mv, atk), type: S().typeKo(wxMoveTy(b, mv, atk)) }
                          : {}
                )),
                (DOPT = {
                  critMul: +g('acritmul').value || critMulOf(atk),
                  hits: hits.map(h => h.v),
                  powStep: spw ? 0 : powStepOf(mv),
                  free1: n('afree1') * (mods.boost || 1),
                  free2: n('afree2') * XP,
                  item1: AIG ? Math.min(1, n('aitem1')) : n('aitem1'),
                  item2: AIG ? Math.min(1, n('aitem2')) : n('aitem2'),
                  trait: AIG ? Math.min(1, n('atrait')) : n('atrait'),
                  weather: UMB(def) ? 1 : n('aweather'),
                  fieldMul: fieldT,
                  defMul,
                  wonder: RM('원더룸') && !(window.OM_FIELD && window.OM_FIELD.roomImm && window.OM_FIELD.roomImm(def)),
                  helping: ck('ahelp') ? helpMul(atk) : 0,
                  charge: ck('acharge'),
                  lifeOrb: AIG ? false : ck('alife'),
                  multiTarget,
                  wall,
                  wallSize: mode(b) >= 2 ? 2 : 1,
                  atkStat: g('aatk').value || undefined,
                  defStat: g('adef').value || undefined,
                  ignoreAtk: igAtk,
                  ignoreAtkC: igAtkC,
                  ignoreDef: igDef,
                  watersport: (f.etc || {})['물놀이'] > 0,
                  mudsport: (f.etc || {})['흙놀이'] > 0,
                  scarf: HAS(atk, '구애스카프'),
                  choiceDef: false,
                  tailwindDef: ((f.objects || {})[side] || {})['순풍'] > 0,
                  swampDef: ((f.objects || {})[side] || {})['습원'] > 0
                })
              );
        const eff = dmg
          ? B().effectiveness(moveTypes, def, {
              scrappy: scrL(atk, def),
              multiMode: +g('amulti').value,
              atkTypes,
              force: g('aforce').value === '' ? null : +g('aforce').value,
              ironBall: HAS(def, '검은철구'),
              ringTarget: HAS(def, '겨냥표적'),
              vsOver: vsOf(atk, def, mv, moveTypes),
              floating: (def.states || {}).MagnetRise || (def.states || {}).Telekinesis || (FX() && FX().floating(def)) || HAS(def, '풍선')
            })
          : null;
        const stab = eff ? eff.stab : false;
        if (WIG) {
          mods.names = mods.names || [];
          mods.names.push({ key: '_wig', who: atk.id, txt: `${atk.name} 『익스펜션 : 격투』 — 「장벽」 무시` });
        }
        if (dmg && dmg.wall < 1) {
          mods.names = mods.names || [];
          mods.names.push({
            key: '_wall',
            who: def.id,
            txt: `${def.name} 「${wallNames(objs, catEn(mv.cat), tyOf(mv)).join('·') || '벽'}」 피해 ×${dmg.wall}${mode(b) >= 2 ? ' (더블)' : ''} · 급소면 무시`
          });
        }
        const guard0 = (DF.endure ? 0.5 : 1) * (mods.guard || 1),
          guardC0 = (DF.endure ? 0.5 : 1) * Math.max(1, mods.guard || 1);
        const endure0 = ((!!DF.endure && !DF.endureUsed) || !!mods.endure) && !AF.noEndure;
        /* 11-17 시노비 「강철의도끼 반동이 보코열매 적용 전 대미지 기준」: 반감열매 칸은 처음부터 켜져 보이는데 첫 계산(이 줄)에는 안 들어가 예상 대미지 · 반동 · 드레인이 열매 전 값이었다 — 처음부터 같이 건다 */ const berry0 =
          !!(dmg && OI() && OI().resist(def, { mt: moveTypes, cat: mv.cat, eff: eff.value, multi: multiTarget }));
        const hp = dmg
          ? B().hpDamageHits(def, perOf(dmg), eff.value, {
              ...hsOpt(def, mv.cat, mods),
              stab,
              adaptability: ck('aadapt'),
              expertBelt: ck('abelt'),
              guard: guard0,
              guardCrit: guardC0,
              crit: hits.map(h => h.v === 2),
              berryHalf: berry0,
              endure: endure0,
              hpFloor: raidFloor(def)
            })
          : null;
        /* 급소를 뒤집은 대미지 (10-24 망령): HP 창에서 피해 적용 전에 급소 여부를 바꿀 수 있게 — 맞은 타마다 전부 급소 / 전부 급소 아님 */
        const dmgAlt =
          dmg && DOPT.hits.some(v => v > 0)
            ? (() => {
                const anyC = DOPT.hits.includes(2);
                try {
                  return B().damage(
                    foulAtk(ATKD(def, mv), def, mv),
                    aceDef(atk, def),
                    MVP,
                    Object.assign({}, DOPT, { hits: DOPT.hits.map(v => (v === 0 ? 0 : anyC ? 1 : 2)) })
                  );
                } catch (e) {
                  return null;
                }
              })()
            : null;
        res.push({
          pclear: BYP === 'clear' && !!(def.states || {}).Protect,
          pnote:
            NPX && (PBY || PPM.pp || PPM.pb)
              ? `${def.name} — 「방어」 관통(해제)을 받지 않는다`
              : BYP && (def.states || {}).Protect && def !== atk
                ? `「방어」 ${BYP === 'clear' ? '해제' : '관통'}${PPM.pb || PPM.pp ? ' — 「' + (PPM.pb || PPM.pp) + '」' : ''}`
                : '',
          _mv: MVP,
          _opt: DOPT,
          slot,
          def,
          acc,
          hits,
          dmg,
          dmgAlt,
          eff,
          stab,
          hp,
          guard: guard0,
          guardCrit: guardC0,
          endure: endure0,
          berryU: berry0,
          manual: 1,
          mods,
          spw,
          sec: [
            ...(spw && acc.hit ? [{ ok: true, line: spw.note }] : []),
            ...(acc.hit && !(mv.cat !== '변화' && eff && +eff.value === 0)
              ? secGroups(atk, def, MAU ? MAU.groups.filter(g => g.who === 'target') : null, mv)
              : [])
          ]
        });
      } /* 11-04 망령 (관사): 상성 ×0 으로 안 맞은 대상(비행에게 땅고르기)에게는 부가효과도 없다 */
      const anyHit = res.some(r => r.acc.hit);
      const once = MAU ? MAU.groups.filter(g => g.who !== 'target' && (anyHit || g.when === 'use')).map(g => rollGroup(atk, null, g)) : [];
      /* 10-22 망령: 행동 판정을 통과했으면(혼란 · 마비 …) 그 결과(남은 턴)를 「적용」 때까지 들고 간다 — 예전엔 여기서 덮어써서 혼란 턴이 안 줄었다 */
      const CK = RESULT && RESULT.checkOnly ? RESULT : null;
      RESULT = {
        mv,
        targets: res,
        moveTypes,
        auto: MAU || (res.some(r => (r.sec || []).some(x => x && x.g && x.ok)) ? { groups: [], notes: [], src: 'secx' } : null),
        /* 11-09 감우 55 방 시험: 기술 자동화가 없는 기술(총애)도 부여된 추가 효과(매료실 「10할 : 헤롱헤롱」)는 적용 때 건다 */ micle: MCLU,
        once,
        checkOnly: CK ? CK.checkOnly : null,
        lines: CK ? CK.lines : [],
        abNote,
        protect: PR,
        bypass: PBY,
        nextKeys: NX.map(e => e.key),
        nextU: NX.some(e => e.uturn)
      };
      {
        /* 굴린 시점에 로그로 (자속·보정 같은 공격 쪽 내부 정보는 빼고) */
        const L = res.map(r => {
          const hit = r.acc.prot
            ? '「기술 방어」로 막힘'
            : r.acc.refl
              ? `「${r.acc.refl}」로 반사`
              : r.acc.sure
                ? '필중'
                : r.acc.hit
                  ? `명중 ${r.acc.roll}/${r.acc.target}${r.acc.end100 ? ' (『버텨라!』 회피율 0 — 명중률 100)' : ''}`
                  : `빗나감 ${r.acc.roll}/${r.acc.target}`;
          if (!r.acc.hit) return `→ ${V(c, r.def).name}: ${hit}`;
          /* 10-27 제보: 급소 아님도 굴림 숫자를 남긴다 (오류 확인용) — 터지면 「급소!」, 아니면 「급소 ✗」. 변화기는 적지 않는다 */ const cr = r.dmg
            ? r.hits
                .map((h, k) => {
                  const n = r.hits.length > 1 ? k + 1 + '타 ' : '';
                  const rc = h.cr && h.cr.chance ? `${h.cr.roll}/${h.cr.chance}` : '없음';
                  const cs = h.stage != null ? `C+${Math.max(0, Math.floor(+h.stage || 0))} · ` : '';
                  return h.v === 2 ? `급소!(${n}${cs}${rc})` : `급소 ✗(${n}${cs}${rc})`;
                })
                .join(' · ')
            : '';
          const am = atkMul(r);
          const mu = r.acc.multi;
          const mh = mu
            ? ` · ${mu.kind === 'fixed' ? mu.cnt + '회 연속기' : '연속기 ' + mu.cnt + '회'}${mu.sl ? '「스킬링크」' : ''}${mu.more.length ? ' (이후 명중 ' + mu.more.map(a => (a.hit ? a.roll + '/' + a.target : '빗나감 ' + a.roll + '/' + a.target)).join(' · ') + ')' : ''} → ${r.hits.length}번 맞았다!${r._opt && r._opt.powStep && r.hits.length > 1 ? ' (위력 ' + r.hits.map((h, k) => +r._mv.pow + r._opt.powStep * k).join('→') + ')' : ''}`
            : '';
          return `→ ${V(c, r.def).name}: ${hit}${mh}${cr ? ' · ' + cr : ''}${r.dmg ? ` · 대미지 ${Math.floor(r.dmg.total * am)}${r.hits.length > 1 ? ' (' + r.hits.length + '회)' : ''} · 상성 ×${r.eff.value}` : ' (변화기)'}${
            r.dmg
              ? (() => {
                  const P = mulParts(r, md);
                  return P.pub.length ? '\n   ✦ 배율  ' + P.pub.join(' · ') : '';
                })()
              : ''
          }${(r.sec || []).map(x => '\n   ' + x.line).join('')}`;
        });
        const PO = (b.order || []).find(o => o.mid === mid && o.pursuitHit && String(o.move) === String(mv.name));
        const PV = PO && b.mons[PO.pursuitHit];
        if (PV && res.some(r => r.def.id === PV.id))
          cutFire(
            'm:' + atk.id,
            atk.image,
            `${atk.name}의 따라가때리기!`,
            `『${mv.name}』 → ${PV.name}`,
            atk.side === 'left' ? '#1f6fd1' : '#e3101f'
          );
        A().sysLog(
          `${ACCNOTE ? ACCNOTE + '\n' : ''}【공격】 ${atk.name} 『${mv.name}』${RF ? ' · 반사 공격(「' + String(RF.by || '반사') + '」)' : ''}${PV && res.some(r => r.def.id === PV.id) ? (pursuitX2(mv) ? ' · 따라가때리기 ×2' : ' · 따라가때리기') : ''} ${ATY ? esc(S().typeKo(ATY)) + '(타입 변경)' : skinOf(atk, mv) ? esc(S().typeKo(skinOf(atk, mv).ty)) + '(' + esc(skinOf(atk, mv).name) + ')' : rndOf(mv) ? esc(S().typeKo(rndOf(mv))) + '(무작위)' : esc(mv.type || '')} ${mv.cat || ''}${+g('apow').value ? ' 위력 ' + g('apow').value : ''}
${(() => {
  const t = (($('#amef', md) || {}).textContent || '').match(/^(?:【(?:[^【】]|【[^【】]*】)*】\s*)+/);
  const ch = chgList()
    .filter(x => x.g !== 'mul' && !['ahelp', 'acharge', 'alife', 'aadapt', 'abelt'].includes(x.id))
    .map(x => x.t);
  const parts = [
    ...(t
      ? t[0]
          .trim()
          .replace(/】\s*【/g, ' · ')
          .replace(/^【|】$/g, '')
          .split(' · ')
      : []
    ).filter(x => !/^(소지품|특성)\s/.test(x))
  ];
  return parts.length ? '✦ 기술  ' + [...new Set(parts)].join(' · ') + '\n' : '';
})()}${PR ? `「기술 방어」 ${PR.ok ? '성공' : '실패'}${PR.k ? ` (연속 ${PR.k + 1}번째 · 성공 확률 ${PR.chance}%)` : ''}\n` : ''}${L.join('\n')}${once.length ? '\n' + once.map(x => '· ' + x.line).join('\n') : ''}`,
          'battle',
          { mid: atk.id, img: atk.image || '' }
        );
      }
      const agRow = (x, key, who) =>
        x.g && x.ok
          ? `<label class="small agr"><input type="checkbox" data-ag="${key}" checked> ${who ? esc(who) + ' · ' : ''}${esc(x.line)}</label>`
          : `<div class="small" style="color:${x.ok ? 'var(--ok)' : 'var(--mute)'}">${who ? esc(who) + ' · ' : ''}${esc(x.line)}</div>`;
      const extra = MAU
        ? [
            ...(MAU.recoil
              ? [
                  `반동 ${MAU.recoil.basis === 'max' ? '최대 HP' : '가한 대미지'} ${MAU.recoil.frac}${MAU.recoil.when === 'miss' ? ' (모두 빗나갔을 때)' : ''}${MAU.recoil.hard ? ' · 무시 불가' : ''}`
                ]
              : []),
            ...(MAU.drain ? [`드레인 ${MAU.drain}${MAU.drainBy ? ' · 『' + MAU.drainBy + '』' : ''}`] : []),
            ...(MAU.selfFaint ? ['사용 후 자신 빈사'] : []),
            ...(MAU.forceSwitch ? ['맞은 대상 강제 교대 (흡반·뿌리박기 등은 막힘)'] : []),
            ...(MAU.selfSwitch ? [MAU.selfSwitch === 'batton' ? '배턴터치로 교대' : '명중 후 임의 교대'] : [])
          ]
        : [];
      const nxNote =
        NX.some(e => e.uturn) && !(MAU && MAU.selfSwitch)
          ? '<div class="small" style="color:var(--ok)">「다음 기술」 유턴 — 명중하면 교대할 포켓몬을 고른다</div>'
          : '';
      /* 10-27 제보: 자동으로 들어간 보정(타입 위력 강화 · 피해 완화 · 소지품 · 날씨 …)이 잘 안 보였다 — 결과 위에 「적용된 보정」 카드 + 굴린 사람에게 나만 보는 로그로 */
      const aplGlob = chgList().map(x => x.t);
      const aplPer = res.map(r => ({
        n: V(c, r.def).name,
        hit: r.acc.hit,
        L: [
          ...((r.mods && r.mods.names) || []).map(x => x.txt),
          ...(r.eff ? ['상성 ×' + r.eff.value] : []),
          ...(r.stab ? ['자속 ×' + (ck('aadapt') ? 2 : 1.5)] : [])
        ]
      }));
      const aplHtml = `<div class="card aapl" style="margin:0 0 6px;padding:6px 10px;border-color:var(--yel2)"><b class="small" style="color:var(--yel2)">적용된 보정</b><label class="small dim" style="float:right;cursor:pointer" title="이 브라우저에만 — 끄면 【보정】 줄을 채팅에 남기지 않는다"><input type="checkbox" data-aplog ${APLOG() ? 'checked' : ''}> 나만 보는 로그에 남기기</label><div class="small"><span class="dim">창 전체</span> ${aplGlob.length ? aplGlob.map(t => `<span class="chip chg" style="cursor:default">${esc(t)}</span>`).join(' ') : '<span class="dim">기본값 그대로</span>'}</div>${aplPer.map(p => `<div class="small"><b>→ ${esc(p.n)}</b> ${p.L.length ? p.L.map(t => `<span class="chip" style="cursor:default">${esc(t)}</span>`).join(' ') : '<span class="dim">없음</span>'}${p.hit ? '' : ' <span class="dim">(빗나감)</span>'}</div>`).join('')}</div>`;
      /* 10-28 망령: 【보정】 줄이 공격마다 쌓여 너무 많다 — 한 줄로, 상성(【공격】 줄에 이미 있음)은 빼고, 남길 보정이 없으면 안 남긴다. 카드의 체크로 끈다 */
      try {
        const per = aplPer
          .filter(p => p.hit)
          .map(p => ({ n: p.n, L: p.L.filter(t => !/^상성 ×/.test(t)) }))
          .filter(p => p.L.length);
        if (APLOG() && (aplGlob.length || per.length))
          A().selfLog(
            `【보정】 ${atk.name} 『${mv.name}』 — ${[...(aplGlob.length ? ['창: ' + aplGlob.join(' · ')] : []), ...per.map(p => `${p.n}: ${p.L.join(' · ')}`)].join(' / ')}`
          );
      } catch (e) {}
      {
        const ar = $('#ares', md);
        if (!ar._apl) {
          ar._apl = 1;
          ar.addEventListener('change', e => {
            if (e.target.matches('[data-aplog]'))
              try {
                localStorage.setItem('om_aplog', e.target.checked ? '1' : '0');
              } catch (x) {}
          });
        }
      }
      $('#ares', md).innerHTML =
        `${aplHtml}${nxNote}${abNote ? `<div class="small" style="color:var(--yel2);margin:0 0 6px">${esc(abNote)}</div>` : ''}${PR ? `<div class="card" style="margin:0 0 6px;padding:6px 10px;border-color:${PR.ok ? 'var(--ok)' : 'var(--red)'}"><b>「기술 방어」 ${PR.ok ? '성공' : '실패'}</b> <span class="small dim">${PR.k ? `연속 ${PR.k + 1}번째 — 성공 확률 ${PR.chance}%` : '첫 사용 — 반드시 성공'}</span></div>` : ''}${CK && CK.lines.length ? `<div class="small" style="white-space:pre-wrap;margin:0 0 6px;color:var(--ok)">${esc(CK.lines.join('\n'))}</div>` : ''}${
          res.some(r => (r.sec || []).length) || once.length || extra.length || (MAU0 && MAU0.notes.filter(t => !autoNote(t)).length)
            ? `<div class="card agc" style="margin:0 0 6px;padding:6px 10px"><b class="small">판정 · 부가효과</b> <span class="small dim">${MAU || res.some(r => (r.sec || []).some(x => x && x.g && x.ok)) ? '(체크된 것은 「적용」 때 자동으로 들어간다)' : '(부가효과 발동은 손으로 적용)'}</span>${res.map((r, i) => (r.sec || []).map((x, j) => agRow(x, 't' + i + '_' + j, V(c, r.def).name)).join('')).join('')}${once.map((x, j) => agRow(x, 'o' + j, RF ? ((b.mons || {})[RF.from] || atk).name : atk.name)).join('')}${extra.map((t, j) => `<label class="small agr"><input type="checkbox" data-agx="${j}" checked> ${esc(RF && !/^드레인/.test(t) ? ((b.mons || {})[RF.from] || atk).name : atk.name)} · ${esc(t)}</label>`).join('')}${
                MAU0 && MAU0.notes.filter(t => !autoNote(t)).length
                  ? `<div class="small" style="color:var(--yel2);margin-top:3px">손으로: ${MAU0.notes
                      .filter(t => !autoNote(t))
                      .map(t => esc(String(t).replace(/<br\s*\/?>/gi, ' ')))
                      .join(' · ')}</div>`
                  : ''
              }</div>`
            : ''
        }<table class="t"><tr><th>대상</th><th>명중</th><th>급소</th><th>대미지(상성 전)</th><th>상성</th><th>보정</th><th>최종</th></tr>${res
          .map(
            (r, i) => `<tr>
    <td class="nw"><div class="row" style="gap:6px;flex-wrap:nowrap"><div class="ti sm" style="${V(c, r.def).image ? `background-image:url('${cssu(V(c, r.def).image)}')` : ''}"></div><div><b>${esc(V(c, r.def).name)}</b><div class="small dim">HP ${r.def.hp.cur}/${r.def.hp.max}</div>${r.mods && r.mods.names.length ? `<div class="small" style="color:var(--yel2)">${r.mods.names.map(x => esc(x.txt)).join('<br>')}</div>` : ''}</div></div></td>
    <td class="nw">${r.acc.sure ? '필중' : (r.acc.hit ? '<b style="color:var(--ok)">명중</b>' : r.acc.refl ? '<b style="color:var(--yel2)">반사</b>' : '<b style="color:var(--red)">빗나감</b>') + `<div class="small dim">${r.acc.note ? esc(r.acc.note) : r.acc.roll + ' / ' + r.acc.target}</div>`}</td>
    <td class="nw crkc">${r.hits.map((h, k) => `<div class="crk1">${r.dmg && r._mv ? `<label class="small crk" title="눌러서 급소를 직접 켜고 끈다"><input type="checkbox" data-crk="${i}.${k}" ${h.v === 2 ? 'checked' : ''}> <b style="color:${h.v === 2 ? 'var(--red)' : 'var(--mute)'}">급소</b>${r.hits.length > 1 ? ' ' + (k + 1) + '타' : ''}</label>` : h.v === 2 ? `<b style="color:var(--red)">급소</b>` : '-'} <span class="small dim mono">${h.cr.roll}/${h.cr.chance}</span></div>`).join('')}</td>
    <td id="dmgc_${i}">${r.dmg ? `<b class="mono">${r.dmg.total}</b> <span class="small dim">(${r.dmg.min}~${r.dmg.max}${r.hits.length > 1 ? ' · ' + r.hits.length + '회' : ''})</span>` : '-'}</td>
    <td>${r.eff ? `<b>×${r.eff.value}</b> <span class="small dim">${esc(S().typeKo(r.eff.type))}${r.stab ? ' · 자속' : ''}</span>` : '-'}</td>
    <td>${r.dmg ? `<label class="small">버텨라/방호 <input type="number" step="0.01" class="n xs" data-guard="${i}" value="${r.guard}"></label> <label class="small">수동 <input type="text" class="n xs" data-manual="${i}" value="1" title="곱셈으로도 적는다 (1.2*1.5 · ×1.5)"></label> <label class="small"><input type="checkbox" data-berry="${i}" ${OI() && OI().resist(r.def, { mt: moveTypes, cat: mv.cat, eff: r.eff.value, multi: multiTarget }) ? 'checked' : ''}> 반감열매</label> <label class="small"><input type="checkbox" data-endure="${i}" ${r.endure ? 'checked' : ''}> 버티기</label>${raidFloor(r.def) ? `<div class="small" style="color:var(--yel)">레이드 배리어 하한 ${raidFloor(r.def)}</div>` : ''}` : ''}</td>
    <td><b class="mono" id="fin_${i}">${r.hp && r.acc.hit ? r.hp.final : 0}</b><div class="small dim" id="aft_${i}">→ ${r.hp && r.acc.hit ? r.hp.after : r.def.hp.cur}</div></td></tr>`
          )
          .join('')}</table>
    <div class="small dim" style="margin-top:4px">${esc(mv.name)} · L${atk.lv} 위력 ${g('apow').value} · ${res[0] && res[0].dmg ? `공격 ${Math.round(res[0].dmg.hits[0] ? res[0].dmg.hits[0].A : 0)} / 방어 ${Math.round(res[0].dmg.hits[0] ? res[0].dmg.hits[0].D : 0)} · M ${res[0].dmg.M}${multiTarget ? ` (전체기 ×0.75 · 대상 ${res.length})` : ''} · 벽 ${res[0].dmg.wall}` : ''}</div>`;
      {
        const ar = $('#ares', md);
        if (ar && res.some(r => illuOf(b, r.def) && !illuTrue(c, r.def))) ar.innerHTML = illuMask(ar.innerHTML, b);
      } /* 11-05 일루젼: 맞은 쪽 보정 글 등에 진짜 이름이 새지 않게 */
      const recompute = () => {
        res.forEach((r, i) => {
          if (!r.dmg) return;
          const gd = md.querySelector(`[data-guard="${i}"]`),
            mn = md.querySelector(`[data-manual="${i}"]`),
            br = md.querySelector(`[data-berry="${i}"]`),
            en = md.querySelector(`[data-endure="${i}"]`);
          r.hp = B().hpDamageHits(r.def, perOf(r.dmg), r.eff.value, {
            ...hsOpt(r.def, mv.cat, r.mods),
            stab: r.stab,
            adaptability: ck('aadapt'),
            expertBelt: ck('abelt'),
            guard: +gd.value || 1,
            guardCrit: (+gd.value || 1) === r.guard ? r.guardCrit : undefined,
            crit: r.hits.map(h => h.v === 2),
            manual: mulOf(mn.value, 1) || 1,
            berryHalf: br.checked,
            endure: en.checked,
            hpFloor: raidFloor(r.def)
          });
          /* 11-04 망령 (관사 보스방): 여기서 고친 버텨라/방호 · 수동 · 반감열매 · 버티기를 받는 쪽 HP 창으로 넘긴다 — 원래 대미지로 깎여 둘이 쓰러진 것 */
          r.guardU = +gd.value || 1;
          r.guardCritU = (+gd.value || 1) === r.guard ? r.guardCrit : +gd.value || 1;
          r.manU = mulOf(mn.value, 1) || 1;
          r.berryU = br.checked;
          r.endU = en.checked;
          $('#fin_' + i, md).textContent = r.acc.hit ? r.hp.final : 0;
          $('#aft_' + i, md).textContent = '→ ' + (r.acc.hit ? r.hp.after : r.def.hp.cur);
        });
      };
      md.querySelectorAll('[data-guard],[data-manual],[data-berry],[data-endure]').forEach(el => el.addEventListener('input', recompute));
      md.querySelectorAll('[data-crk]').forEach(el =>
        el.addEventListener('change', () => {
          const [i, k] = el.dataset.crk.split('.').map(Number);
          const r = res[i];
          if (!r || !r.dmg || !r._mv || !r.hits[k]) return;
          r.hits[k].v = el.checked ? 2 : 1;
          r.hits[k].hand = 1;
          const hv = r.hits.map(h => h.v);
          try {
            r.dmg = B().damage(foulAtk(ATKD(r.def, r._mv), r.def, r._mv), r.def, r._mv, Object.assign({}, r._opt, { hits: hv }));
            const anyC = hv.includes(2);
            r.dmgAlt = B().damage(
              foulAtk(ATKD(r.def, r._mv), r.def, r._mv),
              r.def,
              r._mv,
              Object.assign({}, r._opt, { hits: hv.map(v => (v === 0 ? 0 : anyC ? 1 : 2)) })
            );
          } catch (e) {
            return;
          }
          const cc = $('#dmgc_' + i, md);
          if (cc)
            cc.innerHTML = `<b class="mono">${r.dmg.total}</b> <span class="small dim">(${r.dmg.min}~${r.dmg.max}${r.hits.length > 1 ? ' · ' + r.hits.length + '회' : ''}) · 급소 손으로</span>`;
          const lb = el.parentNode.querySelector('b');
          if (lb) lb.style.color = el.checked ? 'var(--red)' : 'var(--mute)';
          recompute();
        })
      );
      /* 11-05 은열쇠 배틀 카드 단추 */ {
        const LST = [];
        res.forEach((r, i) => {
          const def = r.def;
          const aT = s3tid(b, atk),
            dT = s3tid(b, def);
          const foe = def.side !== atk.side;
          if (!r.acc.hit && !r.acc.prot && !r.acc.note && !r.acc.sure && mv.cat !== '변화') {
            const x = s3card(c, aT, '명중다시', /아군/);
            if (x) LST.push({ i, t: aT, x, act: 'acc', lab: `${def.name} — 빗나감 · 명중 다시` });
          }
          if (foe && r.acc.hit && !r.acc.sure && mv.cat !== '변화' && (+r.acc.target || 0) > 0 && (+r.acc.target || 0) < 10000) {
            const x = s3card(c, dT, '명중다시', /상대/);
            if (x) LST.push({ i, t: dT, x, act: 'acc', lab: `${def.name} 가 맞음 — 명중 다시` });
          }
          if (foe && r.acc.hit && r.dmg && r._mv && r.hits.some(h => h.v === 2 && (+h.stage || 0) <= 1)) {
            const x = s3card(c, dT, '급소무효');
            if (x) LST.push({ i, t: dT, x, act: 'crit', lab: `${def.name} — 급소(C+1 이하)를 일반 명중으로` });
          }
          if (
            foe &&
            r.acc.hit &&
            r.dmg &&
            r.hp &&
            r.hp.after <= 0 &&
            def.hp.cur > 0 &&
            r.dmg.total > 0 &&
            Math.floor(r.hp.final * (r.dmg.min / r.dmg.total)) < def.hp.cur
          ) {
            const x = s3card(c, dT, '난수다시');
            if (x) LST.push({ i, t: dT, x, act: 'dmg', lab: `${def.name} — 난수 차이로 쓰러짐 · 난수 다시` });
          }
          if (foe && r.acc.hit)
            (r.sec || []).forEach((y, j) => {
              if (y && y.ok && y.g && y.g.sec && (+y.g.n || 10) <= 3) {
                const x = s3card(c, dT, '부가무시');
                if (x) LST.push({ i, j, t: dT, x, act: 'sec', lab: `${def.name} — ${y.line} 무시` });
              }
            });
        });
        if (LST.length) {
          const ar = $('#ares', md);
          ar.insertAdjacentHTML(
            'afterbegin',
            `<div class="card" style="margin:0 0 6px;padding:6px 10px;border-color:#b48cff"><b class="small" style="color:#b48cff">🗝 은열쇠 배틀 카드</b> <span class="small dim">자기 포켓몬에게만 · 쓰면 버림</span><div class="row" style="gap:6px;flex-wrap:wrap;margin-top:4px">${LST.map((o, q) => `<button class="btn sm" data-a3="${q}">「${esc(o.x.n)}」 ${esc(o.lab)}</button>`).join('')}</div></div>`
          );
          ar.querySelectorAll('[data-a3]').forEach(
            bt =>
              (bt.onclick = async () => {
                const o = LST[+bt.dataset.a3];
                if (!o) return;
                ar.querySelectorAll('[data-a3]').forEach(z => (z.disabled = true));
                const r = res[o.i];
                const tn = (((A().ST.state.roster || {}).trainers || {})[o.t] || {}).name || '';
                await s3use(o.t, o.lab);
                if (o.act === 'acc') {
                  ACCKEEP = {};
                  res.forEach((rr, j) => {
                    if (j !== o.i && rr.slot) ACCKEEP[rr.slot] = rr;
                  });
                  ACCNOTE = `【은열쇠】 ${tn} 『${o.x.n}』 — ${o.lab}`;
                  try {
                    click('#aroll');
                  } finally {
                    ACCKEEP = null;
                    ACCNOTE = '';
                  }
                  return;
                }
                if (o.act === 'crit') {
                  r.hits.forEach((h, k) => {
                    if (h.v === 2 && (+h.stage || 0) <= 1) {
                      const cb = md.querySelector(`[data-crk="${o.i}.${k}"]`);
                      if (cb) {
                        cb.checked = false;
                        cb.dispatchEvent(new Event('change'));
                      }
                    }
                  });
                  A().sysLog(`【은열쇠】 ${tn} 『${o.x.n}』 — ${V(c, r.def).name} 의 급소를 일반 명중으로`, 'battle');
                  return;
                }
                if (o.act === 'dmg') {
                  const was = r.hp.final;
                  try {
                    r.dmg = B().damage(foulAtk(ATKD(r.def, r._mv), r.def, r._mv), r.def, r._mv, r._opt);
                  } catch (e) {}
                  const cc = $('#dmgc_' + o.i, md);
                  if (cc) cc.innerHTML = `<b class="mono">${r.dmg.total}</b> <span class="small dim">(${r.dmg.min}~${r.dmg.max}) · 난수 다시</span>`;
                  recompute();
                  A().sysLog(
                    `【은열쇠】 ${tn} 『${o.x.n}』 — ${V(c, r.def).name} 대미지 난수 다시 (${was} → ${r.hp.final}${r.hp.after > 0 ? ' · 버텼다' : ''})`,
                    'battle'
                  );
                  return;
                }
                if (o.act === 'sec') {
                  const cb = md.querySelector(`[data-ag="t${o.i}_${o.j}"]`);
                  if (cb) cb.checked = false;
                  A().sysLog(`【은열쇠】 ${tn} 『${o.x.n}』 — ${V(c, r.def).name} : ${(r.sec[o.j] || {}).line || '추가 효과'} 무시`, 'battle');
                  return;
                }
              })
          );
        }
      }
      $('#aapply', md).disabled = false;
      /* 11-03 감우 (검토 16): 굴린 뒤 결과 표로 부드럽게 내려가고, 휴대폰은 창 위에 붙는 요약 한 줄(명중 · 급소 · 대미지) */
      aSum(
        md,
        res
          .map(
            r =>
              `<b>${esc(V(c, r.def).name)}</b> ${r.acc.prot ? '막힘' : r.acc.refl ? '<em>반사</em>' : r.acc.sure ? '필중' : r.acc.hit ? '명중' : '<em>빗나감</em>'}${r.acc.hit && r.hits.some(h => h.v === 2) ? ' · <em>급소</em>' : ''}${r.dmg && r.acc.hit ? ` · ${r.hp ? r.hp.final : 0}<small> ×${r.eff.value}</small>` : ''}`
          )
          .join('<span class="asep">|</span>')
      );
      aScroll(md);
    };
    $('#aapply', md).onclick = async () => {
      if (!RESULT) return;
      const nb0 = snap(),
        nb = snap(nb0);
      const lines = [];
      if (RESULT.check) {
        /* 창을 연 때의 공격자 사본(am)으로 덮지 않는다 (점검 3-6): 상태 변화와 자작 대미지만 지금 모습에 옮긴다 */ const am = RESULT.check;
        const x = nb.mons[mid];
        if (!x) return;
        const self = Math.max(0, (+atk.hp.cur || 0) - (+am.hp.cur || 0));
        x.states = am.states;
        if (am.wakeT != null) x.wakeT = am.wakeT;
        else delete x.wakeT;
        if (self) {
          x.hp.latest = x.hp.cur;
          x.hp.cur = Math.max(0, x.hp.cur - self);
        }
        if (x.hp.cur <= 0) x.entry = '';
        A().closeModal();
        if (await saveBattle(nb0, nb)) {
          A().sysLog(`${atk.name}의 ${RESULT.mv.name}…\n${RESULT.lines.join('\n')}`, 'battle');
        }
        return;
      }
      if (RESULT.checkOnly) {
        const am = RESULT.checkOnly;
        nb.mons[mid].states = am.states;
        if (am.wakeT != null) nb.mons[mid].wakeT = am.wakeT;
        else delete nb.mons[mid].wakeT;
        if (RESULT.lines.length) lines.push(...RESULT.lines);
      }
      if (RESULT.abNote) lines.push(RESULT.abNote);
      {
        const a = nb.mons[mid];
        if (a && a.charge && RESULT.mv && a.charge.mv === RESULT.mv.name && +a.charge.turn < (+nb.turn || 0)) {
          const vk = chargeVanish(RESULT.mv);
          if (vk && a.states && a.states[vk]) {
            delete a.states[vk];
          }
          delete a.charge;
          lines.push(
            `${a.name} 모은 힘을 내보냈다 — 『${RESULT.mv.name}』${vk ? ' · 「' + ((((DB().states || {}).st || {})[vk] || {}).ko || vk) + '」 해제' : ''}`
          );
        }
      }
      /* 11-08 51-2: 기술을 내보내면 「유리구두」「자세잡기」 · 행동하면 「대검돌격」(창을 열 때 이미 걸려 있던 것) 해제 · 맞은 쪽 「록온」「마음의눈」 해제 · 「미클열매」 소모 */
      {
        const a = nb.mons[mid];
        if (a && a.states && !RESULT.check && !RF) {
          const off = [];
          if (a.states.GlaiveRush && (atk.states || {}).GlaiveRush) {
            delete a.states.GlaiveRush;
            off.push('대검돌격');
          }
          for (const k of ['GlassShoes', 'Positioning'])
            if (a.states[k]) {
              delete a.states[k];
              off.push(stKoU(k));
            }
          if (off.length) lines.push(`${a.name} 「${off.join('」「')}」 해제 — 기술을 내보냈다`);
        }
        if (!RESULT.check)
          for (const r of RESULT.targets) {
            const d = nb.mons[r.def.id];
            if (!d || d.id === mid || !r.acc || !r.acc.hit || !d.states) continue;
            const off = ['LockOn', 'Gaze'].filter(k => d.states[k]);
            for (const k of off) delete d.states[k];
            if (off.length) lines.push(`${d.name} 「${off.map(stKoU).join('」「')}」 — 기술을 받아 해제`);
          }
        if (a && RESULT.micle && !RESULT.check && FX() && FX().useItem) {
          const t = FX().useItem(a, '미클열매');
          if (t) lines.push(t);
        }
      }
      /* 11-07: 「예민해지기」로 친 공격 — 이번 턴 종료에 풀리게 (상태 DB: 발생 후 행동했다면 턴 종료 시 해제) */ {
        const a = nb.mons[mid];
        if (a && RESULT.mv && RESULT.mv.cat !== '변화' && +(a.states || {}).LaserFocus > 1) a.states.LaserFocus = 1;
      }
      /* 10-27 망령: 트레이너 「기능 확장」 기술 — 적용하면 횟수 1 */
      {
        const XO = (nb.order || [])[+nb.orderIdx || 0];
        if ((+nb.phase || 0) >= 2 && XO && XO.xact && XO.mid === mid) XO.doneX = 1;
      }
      if (RF && nb.mons[mid]) delete nb.mons[mid].reflPend; /* 11-11 추가 행동을 했다 (넘길 때 묻지 않게) */
      {
        const X = (RESULT.mv || {}).ext;
        const am = nb.mons[mid];
        if (X && X.pot && am) {
          lines.push(`【기능 확장】 ${am.name} 『${X.pot}』 → 「${RESULT.mv.name}」${X.lim ? ` 【${Math.max(0, (+X.left || 0) - 1)}/시】` : ''}`);
          if (X.lim && X.potRaw) {
            am.potUses = Object.assign({}, am.potUses || {}, { [X.potRaw]: Math.max(0, (+X.left || 0) - 1) });
          }
        }
      }
      {
        const X = (RESULT.mv || {}).ext;
        const am = nb.mons[mid];
        if (X && X.item && am) {
          const sl = X.k ? (am.items2 || [])[X.k - 1] : am;
          const nI = v =>
            String(v || '')
              .replace(/[『』]/g, '')
              .trim();
          if (X.once && sl && nI(sl.item) === X.item) {
            am.itemUsed = Object.assign({ name: sl.item, eff: sl.itemEff || '', turn: +nb.turn || 0 }, X.k ? { k: X.k } : {});
            if (FX()) FX().removeByName(am, sl.item);
            sl.item = '';
            sl.itemEff = '';
            if (X.k) delete sl.itemOwn;
            lines.push(`【기능 확장】 ${am.name} 「${X.item}」 → 「${RESULT.mv.name}」 — 소지품을 다 썼다`);
          } else lines.push(`【기능 확장】 ${am.name} 「${X.item}」 → 「${RESULT.mv.name}」`);
        }
      }
      /* 11-07 망령 「애슈열매는 발동하고 나서 안 사라진다」: 턴 개시 자동 발동(autoTurnStart → fireAuto quiet)은 소모를 묻지 않았다. 비고가 「소모하는 것은 기술을 내보낼 때」인 소모품은 그 이름으로 건 이번 턴 우선도가 걸린 채 기술을 내보내면(이 적용) 그때 소모 */
      {
        const am = RF ? null : nb.mons[mid];
        if (am && am.fx && (am.fx.prio || []).length) {
          const IT = DB().items || {};
          const nI = v =>
            String(v || '')
              .replace(/[『』]/g, '')
              .trim();
          const tn = +nb.turn || 0;
          const slots = [[0, am], ...(am.items2 || []).map((x, i) => [i + 1, x])];
          for (const [k, sl] of slots) {
            const n = sl && nI(sl.item);
            if (!n) continue;
            const row = IT[n] || {};
            if (!/기술을\s*내보낼\s*때/.test(String(row.note || '')) || !/소모/.test(String(row.eff || sl.itemEff || ''))) continue;
            if (!(am.fx.prio || []).some(e => nI(e.name) === n && (e.turn < 0 || e.turn >= tn))) continue;
            am.itemUsed = Object.assign({ name: sl.item, eff: sl.itemEff || '', turn: tn }, k ? { k } : {});
            if (FX()) FX().removeByName(am, sl.item);
            sl.item = '';
            sl.itemEff = '';
            if (k) delete sl.itemOwn;
            lines.push(`${am.name}의 「${n}」 — 기술을 내보내서 다 썼다`);
          }
        }
      }
      {
        const X = (RESULT.mv || {}).ext;
        const tt = X && (nb.trainers || {})[X.tid];
        if (tt) {
          const U = Object.assign({}, tt.extUse || {});
          U[X.i] = (+U[X.i] || 0) + 1;
          tt.extUse = U;
          lines.push(
            `【기능 확장】 ${tt.name}${X.src ? ' 『' + X.src.replace(/[『』]/g, '') + '』' : ''} → ${atk.name} 「${RESULT.mv.name}」${X.kind === 'extra' ? ' (추가 행동)' : ''}${X.lim ? ` 【${Math.max(0, X.lim - U[X.i])}/${X.lim}】` : ''}`
          );
        }
      }
      /* 「기술을 내보낼 때마다」 줄어드는 상태 (prog:'move' — 도발·앙코르·사슬묶기·침묵·소란피기·난동부리기 … + 얼음). 잠듦·혼란·얼음은 행동 판정을 돌렸으면 거기서 이미 줄었다 */
      /* 충전·가열·냉각·장전: 그 타입 기술로 대미지를 줬으면 상태를 쓴다 */
      {
        const a = nb.mons[mid];
        const ty = tyOf(RESULT.mv || {});
        if (a && a.states && RESULT.targets.some(r => r.acc.hit && r.dmg))
          for (const k in CHARGE_ST)
            if (a.states[k] && CHARGE_ST[k] === ty) {
              delete a.states[k];
              lines.push(`${a.name} 「${(((DB().states || {}).st || {})[k] || {}).ko || k}」 사용 — 대미지 2배`);
            }
      }
      {
        const a = nb.mons[mid];
        const sdb = (DB().states || {}).st || {};
        const st = (a && a.states) || {};
        const KS = keepSt(a);
        for (const k of RF ? [] : Object.keys(st)) {
          const d = sdb[k] || {};
          const v = +st[k];
          if (!movesDown(k, d) || !(v > 0 && v < 1000)) continue;
          if (KS.includes(k) || k === opt.skipSt) continue;
          /* 11-22 ② 턴 경과로 해제되지 않음 · ① 잠든 채 뒤이은 기술 */ if (k === 'Taunt' && RESULT.mv && RESULT.mv.cat === '변화') continue;
          if (RESULT.checkOnly && (k === 'Sleep' || k === 'Confusion' || k === 'Freeze')) continue;
          if (v <= 1) {
            delete st[k];
            lines.push(`${a.name} 「${d.ko || k}」 해제`);
          } else {
            st[k] = v - 1;
            lines.push(`${a.name} 「${d.ko || k}」 남은 ${v - 1}`);
          }
        }
      }
      if (RESULT.protect) {
        const a = nb.mons[mid];
        const t0 = +nb.turn || 0;
        if (RESULT.protect.ok) {
          a.flags = Object.assign({}, a.flags || {}, { protect: t0 });
          a.states = Object.assign({}, a.states || {}, { Protect: 1 });
          a.protectLast = t0;
          a.protectN = RESULT.protect.k + 1;
          lines.push(`${a.name} 「기술 방어」 — 이번 턴 상대의 기술을 막는다`);
        } else {
          if (a.flags) delete a.flags.protect;
          a.protectLast = null;
          a.protectN = 0;
          lines.push(`${a.name} 「기술 방어」 실패 (연속 사용)`);
        }
      }
      for (const r of RESULT.targets) {
        if (!(r.pclear || (RESULT.bypass === 'clear' && !noPierce(r.def)))) continue;
        const d = nb.mons[r.def.id];
        if (r.acc.hit && d && ((d.flags && d.flags.protect != null) || (d.states || {}).Protect)) {
          if (d.flags) delete d.flags.protect;
          if (d.states) delete d.states.Protect;
          lines.push(`${d.name} 「기술 방어」 해제 — 『${RESULT.mv.name}』`);
        }
      }
      /* 맵툴처럼 공격 쪽은 판정만 한다. 피해는 받는 쪽이 「HP」 창에서 완화 배율을 넣고 적용한다 (lastHit 에 기록) */
      let dealtAny = false;
      const sumL =
        []; /* 11-03 감우 (검토 11): 【전달】 카드는 【공격】 카드와 같은 판정을 되풀이하지 않고 「누구 → 누구 ≈ 대미지」 한 줄 요약만 — 나머지 줄(반동 · 드레인 · 상태 · 기능 확장 …)은 새 정보라 남긴다 */
      for (const r of RESULT.targets) {
        const def = nb.mons[r.def.id];
        if (!def) continue;
        if (!r.acc.hit) {
          sumL.push(`${def.name} ${r.acc.prot ? '막힘' : r.acc.refl ? '반사' : r.acc.nul ? '무효' : '빗나감'}`);
          /* 11-18 망령 「맥 콘 글린 『환상을 먹다』 【보급】/「페어리」 공격을 받으면 무효화한다」: 횟수가 있는 무효(완화 ×0 … N회)는 막을 때마다 하나 깎는다 · 【보급】 포텐셜이면 이번 등장에 썼다고 적는다 */
          if (r.acc.nul) {
            try {
              const an = allyNul(nb, def, RESULT.moveTypes, anulKey(atk, RESULT.mv));
              if (
                an &&
                an.name ===
                  String(r.acc.nul)
                    .replace(/[『』]/g, '')
                    .trim()
              ) {
                const T = +nb.turn || 0;
                const ow = an.tid ? (nb.trainers || {})[an.tid] : (nb.mons || {})[an.mid];
                if (ow) {
                  const tk = an.tid ? 'uTurn' : 'potTurn',
                    uk = an.tid ? 'uUses' : 'potUses';
                  if (an.per) ow[tk] = Object.assign({}, ow[tk] || {}, { [an.raw]: T });
                  if (an.mmax != null) {
                    const u = (ow[uk] || {})[an.raw];
                    ow[uk] = Object.assign({}, ow[uk] || {}, { [an.raw]: Math.max(0, (u == null ? an.mmax : +u) - 1) });
                  }
                }
                const sk = { 공격: 'attack', 방어: 'defense', 특공: 'specialattack', 특방: 'specialdefense', 스피드: 'speed' }[an.stat];
                if (sk) {
                  def.rank = def.rank || {};
                  def.rank[sk] = Math.max(-6, Math.min(6, (+def.rank[sk] || 0) + an.n));
                }
                lines.push(
                  `【${an.tid ? '고유' : '포텐셜'}】 『${an.name}』 — ${def.name}이(가) 받은 기술을 무효화 · 「${an.stat} : ${an.n > 0 ? '+' : ''}${an.n}」`
                );
              }
            } catch (e) {
              console.warn('allyNul apply', e);
            }
          }
          if (r.acc.nul && FX()) {
            const e = ((def.fx || {}).mods || []).find(x => x && x.kind === 'guard' && +x.v === 0 && x.name === r.acc.nul && +x.uses > 0);
            if (e) FX().consume(nb, [{ who: def.id, key: e.key, kind: 'guard' }]);
            const pp = potSrc(def).find(q => q && String(q.name || '').replace(/[『』]/g, '') === String(r.acc.nul).replace(/[『』]/g, ''));
            if (pp && /【\s*보급\s*】/.test(String(pp.eff || ''))) {
              def.potTurn = def.potTurn || {};
              def.potTurn._sup = Object.assign({}, def.potTurn._sup || {}, { [pp.name]: 1 });
            }
          }
          continue;
        }
        if (!r.dmg) {
          sumL.push(`${def.name} (변화기)`);
          continue;
        }
        const crit = r.hits.some(h => h.v === 2);
        dealtAny = true;
        const am = atkMul(r, md);
        /* 10-27 제보: HP 창에 감쇄 요소가 다 안 보였다 — 기본 대미지에 이미 들어간 배율을 적어 둔다. pub = 누구나 봐도 되는 것(전체기 · 화상 · 날씨 · 필드 · 벽 · 받는 쪽 완화 …), atk = 공격 쪽 보정(소지품 · 특성 · 자속 …, 공격 쪽을 다룰 수 있는 사람만) */
        const hfx = mulParts(r, md);
        if (RESULT.mv.cat !== '변화') def.hitT = +nb.turn || 0; /* 11-09 감우 55: 이번 턴 공격을 받았다 (힘껏펀치류 실패) */
        {
          const T0 = +ctx().b.turn || 0;
          const HB = def.hitBy && +def.hitBy.t === T0 ? (def.hitBy.by || []).slice() : [];
          if (!HB.includes(atk.id)) HB.push(atk.id);
          def.hitBy = { t: T0, by: HB };
        } /* 11-26 이번 턴 누구에게 맞았나 (drainUp 「대상의 공격을 받으면」) */
        def.lastHit = {
          hfx,
          from: atk.name,
          fromId: atk.id,
          move: RESULT.mv.name,
          moveType: (rndOf(RESULT.mv) ? S().typeKo(rndOf(RESULT.mv)) : RESULT.mv.type) || '',
          eff: r.eff.value,
          effType: r.eff.type || '',
          total: Math.floor(r.dmg.total * am),
          min: Math.floor(r.dmg.min * am),
          max: Math.floor(r.dmg.max * am),
          hits: r.hits.length,
          crit,
          per: perOf(r.dmg, am),
          perCrit: r.hits.map(h => h.v === 2),
          ...(r.dmgAlt
            ? {
                alt: {
                  total: Math.floor(r.dmgAlt.total * am),
                  min: Math.floor(r.dmgAlt.min * am),
                  max: Math.floor(r.dmgAlt.max * am),
                  crit: !crit,
                  per: perOf(r.dmgAlt, am)
                }
              }
            : {}),
          guard: r.guardU ?? r.guard,
          guardCrit: r.guardCritU ?? r.guardCrit,
          guardNote: [
            (r.mods &&
              r.mods.names
                .filter(x => x.who === def.id)
                .map(x => x.txt)
                .join(' · ')) ||
              '',
            r.guardU != null && r.guardU !== r.guard ? '공격 창에서 ×' + r.guardU : ''
          ]
            .filter(Boolean)
            .join(' · '),
          endure: r.endU ?? r.endure,
          defer: (r.mods && r.mods.defer) || '',
          deferAll: r.mods && r.mods.deferAll ? 1 : 0,
          manual: r.manU || 1,
          berry: !!r.berryU,
          expect: r.hp ? r.hp.final : 0,
          at: Date.now(),
          turn: +nb.turn || 0,
          mt: RESULT.moveTypes || [],
          cat: RESULT.mv.cat || '',
          ct: !!(A().contactOf && A().contactOf(RESULT.mv) === 'O') && !HAS(atk, '방호패드') && !farOf(atk),
          ...(HAS(atk, '방호패드') && A().contactOf && A().contactOf(RESULT.mv) === 'O' ? { pad: 1 } : {}),
          multi: RESULT.targets.length > 1
        };
        if (FX() && r.mods) FX().consume(nb, r.mods.names);
        if (def.flags && def.flags.endure) def.flags.endureUsed = 1;
        sumL.push(
          `${def.name} ≈ ${r.hp ? r.hp.final : 0}${r.eff.value !== 1 ? ' ×' + r.eff.value : ''}${crit ? ' 급소' : ''}${r.acc.multi ? ' ' + r.hits.length + '타' : ''}`
        );
      }
      if ($('#alife', md).checked && dealtAny && !RF) {
        const a = nb.mons[mid];
        const rec = Math.max(1, Math.floor(a.hp.max / 10));
        a.hp.latest = a.hp.cur;
        a.hp.cur = Math.max(0, a.hp.cur - rec);
        lines.push(`${atk.name} 생명의구슬 반동 −${rec} → ${a.hp.cur}`);
        if (a.hp.cur <= 0) {
          a.entry = '';
          lines.push(`${a.name}은(는) 쓰러졌다!`);
        }
      }
      if (RESULT.auto && FX()) {
        const AU = RESULT.auto,
          a = RF && nb.mons[RF.from] ? nb.mons[RF.from] : nb.mons[mid];
        /* 11-23 반사 공격: 반동 · 추가 효과(자신에게 오는 것 포함)의 주인 = 원래 쓴 포켓몬 */ const ck2 = k => {
          const el = md.querySelector(`[data-ag="${k}"]`);
          return !!(el && el.checked);
        };
        const ckx = t => {
          const ex = [
            ...(AU.recoil ? ['recoil'] : []),
            ...(AU.drain ? ['drain'] : []),
            ...(AU.selfFaint ? ['faint'] : []),
            ...(AU.forceSwitch ? ['fsw'] : []),
            ...(AU.selfSwitch ? ['ssw'] : [])
          ];
          const el = md.querySelector(`[data-agx="${ex.indexOf(t)}"]`);
          return !!(el && el.checked);
        };
        const runOps = async (ops, def) => {
          if (RF) {
            const r = await FX().run(
              ops.map(o =>
                o && (o.tgt == null || ['target', 'enemy', 'enemy1', 'self'].includes(o.tgt)) ? Object.assign({}, o, { tgt: 'self' }) : o
              ),
              uiCtx(nb, a, RESULT.mv.name)
            );
            lines.push(...r.lines);
            return;
          }
          const map = def ? tgtFor(atk, def) : o => o;
          const cx = Object.assign({}, uiCtx(nb, a, RESULT.mv.name), def ? { pick: list => list.find(x => x.id === def.id) || null } : {});
          const r = await FX().run(ops.map(map), cx);
          lines.push(...r.lines);
        };
        /* 11-07 망령 「은밀망토가 전체기에선 추가 효과를 다 무시하고 있어? 자기만 안 받는 건데」: 상대 전체에 한 번 거는 부가효과(sec · 「상대 전체」)는 은밀망토를 가진 포켓몬만 빼고 건다 (예전엔 은밀망토를 아예 안 봤다) */
        /* 11-09 감우 54-A: 반동 문맥(기술 · 맞은 대상) — 반동 비례 대미지와 「반동 (특공) : -2」 같은 능력 반동 둘 다 「비례무시 반동 …」으로 막는다 */ const RQX =
          (() => {
            let v;
            return () => {
              if (v !== undefined) return v;
              const RT = (RESULT.targets.find(r => r.acc && r.acc.hit) || RESULT.targets[0] || {}).def;
              try {
                v = Object.assign(
                  moveQuery(a, RT ? nb.mons[RT.id] || RT : null, RESULT.mv, RESULT.moveTypes || mtys(RESULT.mv), 1, RESULT.targets.length < 2),
                  { pcr: {} }
                );
              } catch (e) {
                v = null;
              }
              return v;
            };
          })();
        const rcF = x0 => {
          if (!(x0.ops || []).some(o => o && o.recoil) || !FX().noindUse) return x0;
          const nm = FX().noindUse(a, 'recoil', RQX());
          if (!nm) return x0;
          lines.push(`${a.name} 「${nm}」 — 「${RESULT.mv.name}」의 반동(능력 변화)을 받지 않는다`);
          const ops = x0.ops.filter(o => !(o && o.recoil));
          return ops.length ? Object.assign({}, x0, { ops }) : null;
        };
        for (const [j, x0] of (RESULT.once || []).entries())
          if (x0.ok && ck2('o' + j)) {
            const x = rcF(x0);
            if (!x) continue;
            const hitE = RESULT.targets
              .filter(r => r.acc && r.acc.hit && r.def && !sameT(r.def, atk))
              .map(r => nb.mons[r.def.id])
              .filter(Boolean);
            const cov = x.g && x.g.sec && (x.ops || []).some(o => o.tgt === 'enemy') ? hitE.filter(d => covOf(d)) : [];
            if (!cov.length) {
              /* 11-23 『기술』의 회복량을 강화(1/4→1/2) — 글로 읽는다 */ let ops1 = x.ops;
              try {
                const U = RF && nb.mons[RF.by] ? nb.mons[RF.by] : a;
                const fu = FX().fracUp
                  ? FX().fracUp(
                      [{ name: '특성 : ' + abNm(U), eff: abTxt(U) || U.abilityEff }, ...potSrc(U).filter(p => p && p.name && !(p.ph && !p.apt))],
                      RESULT.mv.name,
                      [],
                      ops1
                    )
                  : null;
                if (fu && !fu.types) {
                  ops1 = fu.ops;
                  lines.push(`${U.name} 「${fu.name}」 — 「${RESULT.mv.name}」 강화 (${fu.from} → ${fu.to})`);
                }
              } catch (e) {}
              await runOps(ops1, null);
              continue;
            }
            for (const d of cov) lines.push(`${d.name} 「${covOf(d)}」 — 『${RESULT.mv.name}』의 추가 효과를 받지 않았다`);
            const rest = (x.ops || []).filter(o => o.tgt !== 'enemy');
            if (rest.length) await runOps(rest, null);
            for (const d of hitE)
              if (!cov.includes(d))
                await runOps(
                  (x.ops || []).filter(o => o.tgt === 'enemy').map(o => Object.assign({}, o, { tgt: 'target' })),
                  d
                );
          }
        for (const [i, r] of RESULT.targets.entries())
          for (const [j, x] of (r.sec || []).entries())
            if (x.g && x.ok && ck2('t' + i + '_' + j)) {
              const d = nb.mons[r.def.id];
              if (!d) continue;
              /* 11-03 「반사」: 상대의 변화기를 되받아친다 — 효과가 쓴 쪽에 */ const bo =
                RESULT.mv.cat === '변화' && !RF && d.id !== mid && !sameT(d, a, nb) ? bncOf(d, RESULT.mv, RESULT.moveTypes || mtys(RESULT.mv)) : null;
              if (bo) {
                lines.push(`${d.name} 「${bo.name}」 — 「${RESULT.mv.name}」를 되받아쳤다`);
                {
                  const bn = String(bo.name || '')
                    .replace(/^특성\s*:\s*/, '')
                    .trim();
                  if (bn && bn === abNm(d) && nb.mons[d.id]) nb.mons[d.id].trFire = { n: bn, k: Date.now(), opp: mid };
                }
                /* 11-22 매직미러 등 반사 특성 → 「특성 : X」 발동 계기 */ await runOps(x.ops, a);
                continue;
              }
              {
                /* 11-23 「「기술」이 「타입 : X」에게 위력이 강화(1/3→1/2)」 — 글로 읽어 비례 대미지 분수를 바꾼다 */ let ops1 = x.ops;
                try {
                  const U = RF && nb.mons[RF.by] ? nb.mons[RF.by] : a;
                  const fu = FX().fracUp
                    ? FX().fracUp(
                        [{ name: '특성 : ' + abNm(U), eff: abTxt(U) || U.abilityEff }, ...potSrc(U).filter(p => p && p.name && !(p.ph && !p.apt))],
                        RESULT.mv.name,
                        tysOf(d),
                        ops1
                      )
                    : null;
                  if (fu) {
                    ops1 = fu.ops;
                    lines.push(`${U.name} 「${fu.name}」 — 「${RESULT.mv.name}」의 위력 강화 (${fu.from} → ${fu.to})`);
                  }
                } catch (e) {}
                await runOps(ops1, d);
              }
            }
        const dealt = RESULT.targets.filter(r => r.acc.hit && r.dmg).reduce((s2, r) => s2 + (r.hp ? r.hp.final : 0), 0);
        const anyHit = RESULT.targets.some(r => r.acc.hit);
        if (AU.recoil && ckx('recoil') && a.hp.cur > 0) {
          const R2 = AU.recoil;
          const base = R2.basis === 'max' ? a.hp.max : dealt;
          const ok =
            R2.when === 'miss'
              ? !anyHit && !RESULT.targets.some(r => r.acc && r.acc.refl)
              : anyHit && (R2.basis === 'max' || dealt > 0); /* 반사당한 것은 빗나감 반동이 아니다 */
          /* 11-09 감우 54-A: 기술별 · 조건부 반동 무시(비례무시 반동 기술:X 상대타입:Y …) · 「1회」는 여기서 깎는다 · 「반동빈사」 = 반동으로는 HP 1 */ const RQ =
            RQX();
          if (ok) {
            const NR = R2.hard
              ? ''
              : FX().noindUse
                ? FX().noindUse(a, 'recoil', RQ)
                : FX().noind(a, 'recoil') || FX().noind(a, '')
                  ? '비례 무시'
                  : '';
            if (NR) lines.push(`${a.name} 반동을 받지 않는다 (「${NR}」)`);
            else {
              const [p, q] = R2.frac.split('/').map(Number);
              const v = Math.max(1, Math.floor((base * p) / q));
              a.hp.latest = a.hp.cur;
              a.hp.cur = Math.max(0, a.hp.cur - v);
              let ko = '';
              if (a.hp.cur <= 0 && FX().noindUse) {
                ko = FX().noindUse(a, 'recoilko', RQ);
                if (ko) a.hp.cur = 1;
              }
              lines.push(
                `${a.name} 반동 −${v}${R2.basis === 'max' ? '' : ' (예상 대미지 ' + dealt + '의 ' + R2.frac + ')'} → ${a.hp.cur}${ko ? ' (「' + ko + '」 반동으로는 빈사가 되지 않는다)' : ''}`
              );
            }
          }
        }
        /* 11-09 감우 55: 카운터 · 미러코트 · 메탈버스트 · 앙갚음 — 이번 턴 마지막으로 받은 공격(lastTaken)의 대미지 × 배율을 그 공격을 한 포켓몬에게 */ if (
          AU.counter &&
          a &&
          a.hp.cur > 0
        ) {
          const lt = a.lastTaken;
          const h = lt && lt.hit && lt.hit.lh;
          const T = +nb.turn || 0;
          const k = h && nb.mons[h.fromId];
          if (!lt || +lt.turn !== T || !h || !k || (AU.counter.cat && h.cat !== AU.counter.cat))
            lines.push(`「${RESULT.mv.name}」 — 이번 턴 ${AU.counter.cat ? AU.counter.cat + '기로 ' : ''}받은 공격이 없어 실패`);
          else if (!k.entry || k.hp.cur <= 0) lines.push(`「${RESULT.mv.name}」 — ${k.name}이(가) 필드에 없어 실패`);
          else {
            const v = Math.max(1, Math.floor(+lt.v * AU.counter.mul));
            k.hp.latest = k.hp.cur;
            k.hp.cur = Math.max(0, k.hp.cur - v);
            if (k.hp.cur <= 0) k.entry = '';
            lines.push(
              `「${RESULT.mv.name}」 — ${k.name}에게 받은 대미지 ${lt.v} × ${AU.counter.mul} = −${v} → ${k.hp.cur}/${k.hp.max}${k.hp.cur <= 0 ? ' 빈사!' : ''}`
            );
          }
        }
        /* 11-18 「「타입 : X」에게 N/M의 드레인」(물마름): 그 타입을 맞힌 몫만 — 자신의 「「타입 : Y」에게도 「기술」의 드레인 효과가 발동한다」(맥 콘 글린 『환상을 마시다』)면 Y 도 */
        let dealtD = dealt;
        if (AU.drainVs && AU.drainVs.length) {
          const vs = new Set(AU.drainVs);
          for (const p of potSrc(a)) {
            const r = String((p && p.eff) || '').match(
              /((?:「타입\s*:\s*[^」]+」\s*(?:,|·)?\s*)+)에게도\s*「([^」]+)」의\s*드레인\s*효과가\s*발동한다/
            );
            if (r && r[2].trim() === String(RESULT.mv.name).trim())
              for (const x of r[1].matchAll(/「타입\s*:\s*([^」]+)」/g))
                for (const t of x[1].split(/[,·\/]/)) {
                  const en = S().typeEn(t.trim());
                  if (en) vs.add(en);
                }
          }
          dealtD = RESULT.targets
            .filter(r => r.acc.hit && r.dmg && tysOf(nb.mons[r.def.id] || r.def).some(t => vs.has(t)))
            .reduce((s2, r) => s2 + (r.hp ? r.hp.final : 0), 0);
          if (!dealtD && dealt > 0) lines.push(`「${RESULT.mv.name}」 드레인 — ${[...vs].map(t => S().typeKo(t)).join('·')} 타입을 맞히지 않아 없음`);
        }
        /* 11-23 망령 결정: 반사 공격의 드레인은 반사한 쪽이 회복한다 (반동 · 추가 효과만 원래 쓴 포켓몬) */ {
          const dA = RF ? nb.mons[mid] : a;
          if (AU.drain && ckx('drain') && dealtD > 0 && dA.hp.cur > 0) {
            if ((dA.states || {}).HealBlock) lines.push(`${dA.name} 「회복봉인」이라 드레인 없음`);
            else if (NOHEAL(dA, 'drain')) lines.push(`${dA.name} ${NOHEAL(dA, 'drain')} — 드레인이 발동하지 않는다`);
            else {
              const [p, q] = AU.drain.split('/').map(Number);
              let v = Math.max(1, Math.floor((dealtD * p) / q));
              if (HAS(dA, '큰뿌리')) v = Math.floor(v * 1.3);
              const h = Math.min(v, dA.hp.max - dA.hp.cur);
              dA.hp.latest = dA.hp.cur;
              dA.hp.cur += h;
              lines.push(`${dA.name} 드레인 +${h} (예상 대미지 ${dealtD}의 ${AU.drain}) → ${dA.hp.cur}`);
              if (h > 0) EVQ.push(['drain', { mid: dA.id, key: 'd' + Date.now() }]);
            }
          }
        }
        if (AU.selfFaint && ckx('faint') && a.hp.cur > 0) {
          a.hp.latest = a.hp.cur;
          a.hp.cur = 0;
          lines.push(`${a.name} 「${RESULT.mv.name}」 사용 후 빈사`);
        }
        for (const id in nb.mons) {
          const x = nb.mons[id];
          if (x.entry && x.hp.cur <= 0) {
            x.entry = '';
            lines.push(`${x.name}은(는) 쓰러졌다!`);
          }
        }
      }
      /* 11-21 망령 「기술 해석도 만들자」: 효과 글에 「대상(상대)의 데이터를 해석한다」가 있는 기술(꿰뚫어보기 · 냄새구별 · 미라클아이 · 간파하기 …)이 맞으면, 쓴 포켓몬의 트레이너가 맞은 상대를 데이터 해석 (강제 · 도감 횟수 없음 · 소지품은 안 보임) */
      {
        const ex = String(RESULT.mv.eff || '');
        const am = nb.mons[mid];
        if (am && window.OM_DEX_UI && /(?:대상|상대)(?:\s*포켓몬)?의\s*데이터를\s*해석/.test(ex)) {
          const tgs = RESULT.targets
            .filter(r => r.acc && r.acc.hit && r.def && !sameT(r.def, am, nb))
            .map(r => r.def.id)
            .filter(id => nb.mons[id]);
          if (tgs.length) {
            lines.push(`「${RESULT.mv.name}」 — ${tgs.map(id => nb.mons[id].name).join(' · ')}의 데이터를 해석한다`);
            const vw = am.tid,
              mvN = RESULT.mv.name;
            setTimeout(
              () =>
                tgs.forEach((id, i) =>
                  setTimeout(() => {
                    Promise.resolve(
                      window.OM_DEX_UI.analyze(vw, id, { forced: true, free: true, quiet: tgs.length > 1, via: 'move', by: mvN, byMid: mid })
                    ).catch(e => console.warn('기술 해석', e));
                  }, i * 250)
                ),
              900
            );
          }
        }
      }
      if (OI() && !RF) {
        const a = nb.mons[mid];
        const tags = String(RESULT.mv.tag || '')
          .split(/[,/·\s]+/)
          .filter(Boolean);
        const dealt = RESULT.targets.filter(r => r.acc.hit && r.dmg).map(r => r.def.id);
        try {
          lines.push(
            ...OI().afterAttack(nb, a, {
              jewel: md.dataset.jewel && +$('#aitem1', md).value > 1 ? (md.dataset.jewel === '1' ? true : md.dataset.jewel) : false,
              dealt,
              missAll: RESULT.targets.length > 0 && !RESULT.targets.some(r => r.acc.hit),
              tags
            })
          );
        } catch (e) {
          console.warn(e);
        }
      }
      if (isNG(RESULT.mv) && NG) {
        const am = nb.mons[mid];
        if (am && am.item === NG.name) {
          am.itemUsed = { name: am.item, eff: am.itemEff || '', turn: +nb.turn || 0 };
          if (FX()) FX().removeByName(am, am.item);
          am.item = '';
          am.itemEff = '';
          lines.push(`${am.name}의 「${NG.name}」 — 「${NGN}」로 써서 없어졌다`);
        }
      } /* 11-05 자연의은혜: 열매 소비 */
      /* 11-06 망령 「스케치 — 배틀 중 다른 기술로 바뀌는 것」: 마지막으로 쓴 기술(lastMove)을 남기고, 스케치가 맞으면 그 칸을 대상의 마지막 기술로 (시합 중 유지 · 시트는 그대로) */
      {
        const am = RF ? null : nb.mons[mid];
        const mvN = String(RESULT.mv.name || '').trim();
        const NOSK = ['스케치', '발버둥', '잡담', '흉내내기'];
        if (am && !RESULT.check && /대상이\s*마지막으로\s*사용한\s*기술이\s*된다/.test(String(RESULT.mv.eff || ''))) {
          const r0 = (RESULT.targets || []).find(r => r.acc && r.acc.hit && r.def && r.def.id !== mid);
          const d = r0 && nb.mons[r0.def.id];
          const lm = d && d.lastMove && d.lastMove.name;
          const k = (am.moves || []).findIndex(x => x && x.name === mvN);
          const IM = window.OM_IMPORT;
          const ok = d && lm && !NOSK.includes(lm) && !(am.moves || []).some(x => x && x.name === lm) && k >= 0 && IM && IM.move;
          if (ok) {
            const nm = IM.move(lm, false);
            nm.sketch = mvN;
            am.moves = am.moves.slice();
            am.moves[k] = nm;
            lines.push(`【스케치】 ${am.name} — ${d.name}의 『${lm}』를 베꼈다 (시합 중 유지)`);
          } else
            lines.push(
              `${am.name} 『${mvN}』 — ${!d ? '맞은 대상이 없다' : !lm ? d.name + '이(가) 아직 기술을 쓰지 않았다' : NOSK.includes(lm) ? '「' + lm + '」는 베낄 수 없다' : k < 0 ? '기술 칸을 찾지 못했다' : '이미 「' + lm + '」를 지니고 있다'} — 기술 검색 창에서 고른다`
            );
          /* 11-06 망령 「기본은 마지막 기술, 검색해서 다른 걸로도」: 저장 뒤 DB 기술 검색 창 (고른 기술로 그 칸을 다시 바꾼다 · 닫으면 그대로) */
          if (k >= 0) setTimeout(() => sketchPick(mid, k, ok ? lm : '', mvN), 700);
        } else if (
          am &&
          !RESULT.check &&
          mvN &&
          mvN !== '발버둥' &&
          !RESULT.mv.ext &&
          ((am.consec = {
            name: mvN,
            n:
              am.lastMove && am.lastMove.name === mvN && +am.lastMove.turn === (+nb.turn || 0) - 1
                ? (am.consec && am.consec.name === mvN ? +am.consec.n : 1) + 1
                : 1
          }),
          true)
        )
          am.lastMove = { name: mvN, turn: +nb.turn || 0, tg: (RESULT.targets || []).map(r => r && r.def && r.def.id).filter(Boolean) };
        /* 11-09 감우 57: tg = 이 기술의 대상 (「지정기술」 — 나에게 내보냈나) */ if (
          am &&
          !RESULT.check &&
          (am.states || {}).DestinyBond &&
          String(mvN || '').replace(/\s/g, '') !== '길동무'
        ) {
          delete am.states.DestinyBond;
          lines.push(`${am.name} 「길동무」 해제 (다음 행동)`);
        }
        /* 11-09 감우 54: 「자세」 기술(날개의자세 · 불길의자세 …)을 쓰면 지금 자세로 남긴다 — 구문 조건 「자세:날개의자세」 (교대하면 풀린다(11-23) · 다른 자세를 쓰면 바뀐다) */ if (
          am &&
          !RESULT.check &&
          RESULT.mv &&
          RESULT.mv.cat === '변화' &&
          /(^|[,\s])자세($|[,\s])/.test(String(RESULT.mv.tag || '')) &&
          /의자세$/.test(mvN || '')
        )
          am.stance = mvN;
        if (am && !RESULT.check && RESULT.mv) {
          const au = RESULT.auto || {};
          if (au.iai) {
            am.iai = au.iai;
            lines.push(`${am.name} 다음 「거합」 기술 → 「${S().typeKo(au.iai)}」`);
          } else if (au.stance || (RESULT.mv.cat === '변화' && /의자세$/.test(mvN || ''))) delete am.iai;
          else if (am.iai && /(^|[,\s])거합($|[,\s])/.test(String(RESULT.mv.tag || ''))) delete am.iai;
        }
        /* 11-08 51-2 ⑬ 메트로놈: 같은 기술을 연속해서 쓴 수 (다른 기술 · 교대면 처음부터) */ if (am && !RESULT.check && mvN && !RESULT.mv.ext)
          am.metro = { name: mvN, n: am.metro && nmMv(am.metro.name) === mvN ? (+am.metro.n || 0) + 1 : 1 };
        if (am && !RESULT.check && RESULT.mv && am.mvMod) shootOff(am, lines);
      }
      if (
        RESULT.targets.some(r => r.acc && r.acc.hit && r.def && r.def.id !== mid) &&
        HAS(atk, '방호패드') &&
        A().contactOf &&
        A().contactOf(RESULT.mv) === 'O'
      )
        lines.push(`${atk.name} 「방호패드」 — 대상의 「접촉기」 계기를 무시한다`);
      /* 11-06 소지품 기술 (벌레먹기 · 쪼아대기 · 탁쳐서떨구기 · 도둑질 · 탐내기 · 트릭 · 바꿔치기 · 내던지기 — 효과 글로): 맞은 대상마다 소지품을 옮기고 줄을 남긴다. 상태 이상(내던지기 화염구슬 …)은 FX 로 */
      {
        const IK = OI() && OI().moveKind ? OI().moveKind(RESULT.mv) : '';
        if (IK && nb.mons[mid]) {
          const hits = RESULT.targets.map(r => ({
            id: r.def.id,
            hit: !!r.acc.hit,
            dmg: !!(r.acc.hit && r.dmg && !(r.eff && +r.eff.value === 0)),
            final: r.hp ? r.hp.final : 0
          }));
          let R2 = { lines: [], st: [] };
          try {
            R2 = OI().moveFx(nb, mid, IK, hits, {
              name: RESULT.mv.name,
              mt: RESULT.moveTypes || [],
              cat: RESULT.mv.cat,
              eff: Object.fromEntries(RESULT.targets.map(r => [r.def.id, r.eff ? +r.eff.value : 1])),
              multi: RESULT.targets.length > 1,
              turn: +nb.turn || 0
            });
          } catch (e) {
            console.warn(e);
          }
          lines.push(...R2.lines);
          for (const x of R2.st || []) {
            const d = nb.mons[x.id];
            if (!d || !FX()) continue;
            try {
              const rr = await FX().run(
                [{ k: 'state', state: x.en, tgt: 'target' }].map(tgtFor(nb.mons[mid], d)),
                Object.assign({}, uiCtx(nb, nb.mons[mid], RESULT.mv.name), { pick: list => list.find(q => q.id === d.id) || null })
              );
              lines.push(...rr.lines.map(t => `「${x.from}」 ${t}`));
            } catch (e) {
              console.warn(e);
            }
          }
        }
      }
      /* 11-08 망령 「1~3」: 소지품을 건드리는 특성 — 공격 쪽 매지션 · 파괴의논리, 맞은 쪽 나쁜손버릇 (대미지로 맞은 것만) */
      if (OI() && OI().traitFx && !RF && nb.mons[mid] && RESULT.mv.cat !== '변화' && !RESULT.check) {
        const hits = RESULT.targets.map(r => ({
          id: r.def.id,
          hit: !!r.acc.hit,
          dmg: !!(r.acc.hit && r.dmg && !(r.eff && +r.eff.value === 0)),
          final: r.hp ? r.hp.final : 0
        }));
        try {
          const R3 = OI().traitFx(nb, mid, hits, {
            name: RESULT.mv.name,
            mt: RESULT.moveTypes || [],
            cat: RESULT.mv.cat,
            eff: Object.fromEntries(RESULT.targets.map(r => [r.def.id, r.eff ? +r.eff.value : 1])),
            multi: RESULT.targets.length > 1,
            turn: +nb.turn || 0
          });
          lines.push(...R3.lines);
        } catch (e) {
          console.warn(e);
        }
      }
      {
        const e = String(RESULT.mv.eff || '');
        const hitAny = RESULT.targets.some(r => r.acc.hit);
        const ok = !/명중(\s*후|했을\s*때)/.test(e) || hitAny;
        const f2 = (nb.field = nb.field || {});
        f2.objects = f2.objects || {};
        const foe = atk.side === 'left' ? 'right' : 'left';
        const HZ = [...OBJ_CAT[2][4], ...OBJ_CAT[3][4]],
          WL = ['리플렉터', '빛의장막', '오로라베일'];
        const strip = (side, list) => {
          const o = (f2.objects[side] = Object.assign({}, f2.objects[side] || {}));
          const gone = list.filter(k => +o[k] > 0);
          gone.forEach(k => delete o[k]);
          if (gone.length) lines.push(`${SIDE_KO[side]} ${gone.map(k => '「' + k + '」').join('')} 철거 — 『${RESULT.mv.name}』`);
        };
        if (ok) {
          if (/적진의\s*「장벽」「신비의부적」「흰안개」/.test(e)) {
            strip(foe, [...WL, '신비의부적', '흰안개']);
            if (/필드 전체의\s*「+설치물」+/.test(e)) {
              strip('left', HZ);
              strip('right', HZ);
            }
          } else {
            if (/자진의\s*「설치물」[^.]*철거/.test(e)) strip(atk.side, HZ);
            if (/자진의\s*「장벽」[^.]*철거/.test(e)) strip(atk.side, WL);
            else if (/「장벽」[^.]*철거/.test(e)) {
              const sd = [...new Set(RESULT.targets.filter(r => r.acc.hit && r.def.side !== atk.side).map(r => r.def.side))];
              (sd.length ? sd : [foe]).forEach(s => strip(s, WL));
            }
          }
          if (/「필드」[^.]*철거/.test(e) && f2.terrain && f2.terrain.type) {
            lines.push(`「${f2.terrain.type}」 철거 — 『${RESULT.mv.name}』`);
            f2.terrain = { type: '', count: 0 };
          }
          if (/「전체기 방어」\s*상태로/.test(e)) {
            const o = (f2.objects[atk.side] = Object.assign({}, f2.objects[atk.side] || {}));
            o['와이드가드'] = 1;
            lines.push(`${SIDE_KO[atk.side]} 「와이드가드」 — 턴 종료까지 전체기를 막는다 (연속으로 쓰면 실패 판정은 손으로)`);
          }
          if (/「변화기 방어」\s*상태로/.test(e)) {
            const o = (f2.objects[atk.side] = Object.assign({}, f2.objects[atk.side] || {}));
            o['트릭가드'] = 1;
            lines.push(`${SIDE_KO[atk.side]} 「트릭가드」 — 턴 종료까지 상대의 변화기를 막는다`);
          }
          if (/「필중기 방어」\s*상태로/.test(e)) {
            const o = (f2.objects[atk.side] = Object.assign({}, f2.objects[atk.side] || {}));
            o['에임가드'] = 1;
            lines.push(`${SIDE_KO[atk.side]} 「에임가드」 — 턴 종료까지 상대의 필중기를 막는다`);
          }
          if (/서로의 필드의 상태를 뒤바꾼다/.test(e)) {
            const L0 = f2.objects.left || {},
              R0 = f2.objects.right || {};
            f2.objects = { left: R0, right: L0 };
            lines.push(`좌측 ↔ 우측 설치물을 맞바꿨다 — 『${RESULT.mv.name}』`);
          }
        }
      }
      /* 11-04 19:50: 『대타출동』(「HP」를 1/4만큼 소비하여 … 「대역인형」을 소환) — HP 1/4 를 깎고 「대타출동」 상태 · 인형 HP = 최대 HP 1/4 · 「조이기」 해제. HP 가 1/4 이하이거나 이미 인형이 있으면 실패 */
      {
        const a = nb.mons[mid];
        if (a && !RESULT.check && /「대역인형」을\s*소환/.test(String(RESULT.mv.eff || ''))) {
          const q = Math.max(1, Math.floor(a.hp.max / 4));
          a.states = a.states || {};
          if (a.states.Substitute) lines.push(`${a.name} 이미 대역인형이 있다 — 실패`);
          else if (a.hp.cur <= q) lines.push(`${a.name} 「HP」가 모자라 대역인형을 부르지 못했다 — 실패`);
          else {
            a.hp.cur -= q;
            a.states.Substitute = 1000;
            a.subHp = q;
            const bnd = !!a.states.Bind;
            delete a.states.Bind;
            lines.push(`${a.name} 「HP」 −${q} (${a.hp.cur}/${a.hp.max}) — 대역인형을 불렀다 (인형 ${q})${bnd ? ' · 「조이기」 해제' : ''}`);
          }
        }
      }
      /* 11-04: 『도우미』를 이미 「도우미」인 아군에게 또 걸면 helpN +1 (배율 ×1.5 씩 겹친다) · 새로 걸리면 1 */
      if (!RESULT.check && /「도우미」\s*상태로/.test(String(RESULT.mv.eff || ''))) {
        for (const r of RESULT.targets || []) {
          const id = r.def && r.def.id;
          const t1 = id && nb.mons[id],
            t0 = id && (nb0.mons || {})[id];
          if (!t1 || !(t1.states || {}).HelpingHand) continue;
          const had = !!(t0 && (t0.states || {}).HelpingHand);
          t1.helpN = had ? Math.max(1, +t0.helpN || 1) + 1 : 1;
          if (had) lines.push(`${t1.name} 「도우미」 겹침 — ${t1.helpN}번 · 대미지 ×${helpMul(t1)}`);
        }
      }
      /* 10-26 망령: 「난동부리기 (혼란) : 2~3회」(역린 · 꽃잎댄스 …) — 처음 쓰면 남은 횟수만큼 「난동부리기」, 끝나면 혼란 */
      {
        const tm2 = String(RESULT.mv.eff || '').match(/「난동부리기\s*\(혼란\)\s*:\s*(\d+)~(\d+)회」/);
        const a = nb.mons[mid];
        if (tm2 && a && !RESULT.check && !RF) {
          a.states = a.states || {};
          if (!a.states.Thrash && !a.thrashOn) {
            const n = +tm2[1] + Math.floor(Math.random() * (+tm2[2] - +tm2[1] + 1));
            const thIm = FX() && FX().immuneHit ? FX().immuneHit(a, 'Thrash') : '';
            /* 11-18 망령 「맥 콘 글린 『난동 달래기』 — 스위트베일이 아군의 「난동부리기」에도」: 면역이면 난동(과 끝난 뒤 혼란) 없음 */ if (
              thIm &&
              n > 1
            )
              lines.push(`${a.name} 「난동부리기」 면역 (${thIm})`);
            else if (n > 1) {
              a.states.Thrash = n - 1;
              a.thrashOn = 1;
              lines.push(`${a.name} 「난동부리기」 — 앞으로 ${n - 1}번 더 (끝나면 혼란)`);
            }
          } else if (!a.states.Thrash && a.thrashOn) {
            delete a.thrashOn;
            const cf = ((DB().states || {}).st || {}).Confusion || {};
            const lo = +cf.min || 1,
              hi = +cf.max || lo;
            a.states.Confusion = lo + Math.floor(Math.random() * (hi - lo + 1));
            lines.push(`${a.name} 난동이 끝나 「혼란」 상태가 됐다`);
          }
        }
      }
      /* 10-26 망령 (서서 VS 마리 시험): 「반동 : 행동불능」 기술이 맞으면 다음 턴 움직일 수 없다 · 『버서커』는 공격하면 2턴 「난동부리기」 */
      {
        const a = RF && nb.mons[RF.from] ? nb.mons[RF.from] : nb.mons[mid];
        const e = String(RESULT.mv.eff || '');
        if (a && !RESULT.check && a.hp.cur > 0) {
          a.states = a.states || {};
          if (RCB_RE.test(e) && RESULT.targets.some(r => r.acc.hit) && FX()) {
            try {
              const rr = await FX().run(
                [{ k: 'state', state: 'Burn', tgt: 'self', fireOk: rcbFire(RESULT.mv) ? 1 : 0 }],
                uiCtx(nb, a, RESULT.mv.name)
              );
              lines.push(...(rr.lines || []).map(x => `「반동 : 화상」 ${x}`));
            } catch (er) {
              console.warn('반동 화상', er);
            }
          }
          if (/「반동\s*:\s*행동불능」/.test(e) && RESULT.targets.some(r => r.acc.hit)) {
            a.states.Recharge = 2;
            lines.push(`${a.name} 「반동 : 행동불능」 — 다음 턴 움직일 수 없다 (무시하는 효과가 있으면 상태에서 지운다)`);
          }
          if (
            !RF &&
            RESULT.mv.cat !== '변화' &&
            !(atk.states || {}).Thrash &&
            !a.states.Thrash &&
            potSrc(a).some(p => String(p.name || '').trim() === '버서커') &&
            !(FX() && FX().immuneHit && FX().immuneHit(a, 'Thrash'))
          ) {
            a.states.Thrash = 2;
            lines.push(`${a.name} 『버서커』 — 2턴 동안 「난동부리기」`);
          }
        }
      }
      /* 10-26 망령: 「다음 기술」 효과는 기술을 내보내면 (변화기 · 빗나감이어도) 다 쓴다 */
      if ((RESULT.nextKeys || []).length) {
        const a = nb.mons[mid];
        const F = a.fx || {};
        const nk = RESULT.nextKeys;
        const had = (F.mods || []).some(e => e.next && nk.includes(e.key));
        F.mods = (F.mods || []).filter(e => !(e.next && nk.includes(e.key)));
        F.prio = (F.prio || []).filter(e => !(e.next && nk.includes(e.key)));
        if (had) lines.push(`${a.name} 「다음 기술」 효과를 썼다`);
      } /* 11-22 「추가효과 부여 … 1회」(다음 단일기 1회 — 크로노스 『시간정지』): 맞는 기술을 내보내면 그 부여를 뗀다 */
      {
        const a = RF ? null : nb.mons[mid];
        const F = a && a.fx;
        if (F && Array.isArray(F.sp) && F.sp.some(e => e && e.sp === 'secx' && e.once)) {
          const mv = RESULT.mv || {};
          const mt = RESULT.moveTypes || [];
          const one = String(mv.range || '') === '1체';
          const used = F.sp.filter(
            e => e && e.sp === 'secx' && e.once && spHit(e, mv, mt) && !(e.rng === 'single' && !one) && !(e.rng === 'multi' && one)
          );
          if (used.length) {
            F.sp = F.sp.filter(e => !used.includes(e));
            lines.push(`${a.name} 「${used.map(e => e.name).join('」「')}」 — 다음 기술 1회 효과를 썼다`);
          }
        }
      }
      /* 11-23 특성으로 기술을 회피했을 때(만트라 · 회피 구문 특성) → 「특성 : X」 발동 계기 — 「「특성 : X」로 기술을 회피했을 때」 포텐셜이 잇는다 */
      /* 11-23 글 필중(디케 『아버지의 위광』)을 쓴 공격을 적용하면 그 포텐셜의 【보급】 · 【N/시】 · 【탈진】을 센다 */ try {
        const used = [...new Set((RESULT.targets || []).map(r => r && r.acc && r.acc.txSure).filter(Boolean))];
        const am = nb.mons[mid];
        for (const n of used) {
          const p = am && potSrc(am, 1).find(q => q && q.name === n);
          if (!p) continue;
          const e = String(p.eff || '');
          am.potTurn = am.potTurn || {};
          if (/【\s*보급\s*】/.test(e)) {
            am.potTurn._sup = Object.assign({}, am.potTurn._sup || {});
            am.potTurn._sup[n] = 1;
          }
          if (/【\s*(소진|탈진)\s*】/.test(e)) am.potTurn[n] = +nb.turn || 0;
          const mx = e.match(/【(\d+)\/시】/);
          if (mx) {
            am.potUses = am.potUses || {};
            const u = am.potUses[n];
            am.potUses[n] = Math.max(0, (u == null ? +mx[1] : +u) - 1);
          }
          lines.push(`${am.name} 『${n}』 — 「${RESULT.mv.name}」 필중`);
        }
      } catch (e) {
        console.warn('글 필중', e);
      }
      try {
        for (const r of RESULT.targets || []) {
          const ac = r && r.acc;
          if (!ac || ac.hit || !ac.evTrait || !r.def) continue;
          const d = nb.mons[r.def.id];
          if (d && abNm(d) === ac.evTrait) d.trFire = { n: ac.evTrait, k: Date.now(), opp: mid };
          if (d && ac.evPot) {
            const pp = potSrc(d).find(p => p && p.name === ac.evPot);
            const L = pp ? limOf(pp, d.potUses || {}, d.potTurn || {}) : null;
            if (L && L.mmax != null) {
              d.potUses = Object.assign({}, d.potUses || {});
              d.potUses[ac.evPot] = Math.max(0, (d.potUses[ac.evPot] == null ? L.mmax : +d.potUses[ac.evPot]) - 1);
            }
          }
        }
      } catch (e) {
        console.warn('회피 계기', e);
      }
      /* 11-22 망령 「특성 엔진 처리」: 변환자재 · 리베로 = 내보낸 기술 타입으로 (등장당 1번) · 그로기 ② = 「물리기」가 맞으면 「반동 (공격) : -1」 */
      try {
        const a = RF ? null : nb.mons[mid];
        const mv = RESULT.mv || {};
        const CX = nm => ({ b: nb, self: a, name: nm, pick: l => l[0] || null, confirm: async () => true, choose: async () => [0] });
        const pn = a && FX() ? proteanOk(a) : '';
        if (pn) {
          const t = ((RESULT.moveTypes && RESULT.moveTypes.length ? RESULT.moveTypes : mtys(mv)) || []).filter(x => x && x !== '-')[0];
          const cur = (a.types || []).filter(x => x && x !== '-');
          if (t && !(cur.length === 1 && cur[0] === t)) {
            const r = await FX().run([{ k: 'type', tgt: 'self', mode: 'set', types: [t] }], CX('특성 : ' + pn));
            a.potTurn = a.potTurn || {};
            a.potTurn._sup = Object.assign({}, a.potTurn._sup || {}, { ['특성 : ' + pn]: 1 });
            lines.push(`${a.name} 「${pn}」 — ${(r.lines || []).join(' · ') || '타입 변경'} (【보급】 — 다시 나올 때까지 1번)`);
            a.trFire = { n: pn, k: Date.now() };
          }
        }
        if (a && FX() && abNm(a) === '그로기' && mv.cat === '물리' && a.hp.cur > 0 && RESULT.targets.some(r => r.acc && r.acc.hit && r.dmg)) {
          const r = await FX().run([{ k: 'rank', tgt: 'self', stats: { attack: -1 } }], CX('특성 : 그로기'));
          lines.push(`${a.name} 「그로기」 반동 — ${(r.lines || []).join(' · ') || '공격 -1'}`);
        }
      } catch (e) {
        console.warn('특성 (변환자재 · 그로기)', e);
      }
      nb.mons[mid].lastDealt = {
        total: RESULT.targets.filter(r => r.acc.hit && r.dmg).reduce((a, r) => a + (r.hp ? r.hp.final : 0), 0),
        targets: RESULT.targets
          .filter(r => r.acc.hit && r.dmg)
          .map(r => r.def.name)
          .join(', '),
        per: RESULT.targets.filter(r => r.acc.hit && r.dmg).map(r => ({ id: r.def.id, n: r.def.name, v: r.hp ? r.hp.final : 0 })),
        at: Date.now()
      }; /* 11-17 시노비: 전체기에서 반동 · 드레인을 한 대상 몫으로 고를 수 있게 대상별 값도 */
      const AU2 = RESULT.auto;
      const xck = t => {
        if (!AU2) return false;
        const ex = [
          ...(AU2.recoil ? ['recoil'] : []),
          ...(AU2.drain ? ['drain'] : []),
          ...(AU2.selfFaint ? ['faint'] : []),
          ...(AU2.forceSwitch ? ['fsw'] : []),
          ...(AU2.selfSwitch ? ['ssw'] : [])
        ];
        const el = md.querySelector(`[data-agx="${ex.indexOf(t)}"]`);
        return !!(el && el.checked);
      };
      const HIT2 =
        RESULT.mv.cat === '변화' ||
        (RESULT.targets || []).some(
          r => r && r.acc && r.acc.hit && r.def && r.def.id !== mid
        ); /* 11-15 감우 (나탈리아 분석 — 「잠수」 명중 후 임의 교대가 「판별」에 막혔는데도 교대): 공격기의 교대 · 날려보내기는 하나라도 맞았을 때만 */
      const doF = AU2 && AU2.forceSwitch && HIT2 && xck('fsw'),
        doS = !RF && AU2 && AU2.selfSwitch && HIT2 && xck('ssw');
      const swS = doS ? AU2.selfSwitch : RESULT.nextU ? 'free' : ''; /* 선행유턴처럼 「다음 기술」에 붙은 유턴도 */
      {
        const P2 = plSecond(b, atk, RESULT.mv);
        if (P2) {
          const side = P2.who === 'self' ? atk.side : atk.side === 'left' ? 'right' : 'left';
          nb.field = nb.field || {};
          nb.field.objects = nb.field.objects || { left: {}, right: {} };
          const o = (nb.field.objects[side] = nb.field.objects[side] || {});
          o[P2.o] = 4;
          lines.push(`합체 「${P2.mv}」+「${plNm(RESULT.mv)}」 — ${side === 'left' ? '좌측' : '우측'}에 「${P2.o}」 4턴`);
          delete nb.pledgeW;
        }
      } /* 11-07 맹세 합체: 장판 */
      /* 11-23 망령 「기술의 반사」: 반사한 포켓몬마다 행동 순서 바로 다음 칸에 「반사 공격」(추가 행동)을 세운다 — 그 포켓몬의 카드 「공격」을 누르면 같은 기술로, 원래 쓴 포켓몬을 대상으로 열린다. 순서가 없을 때(턴 밖)는 저장 뒤 바로 연다 */
      const RFQ = [];
      if (!RF && !RESULT.check) {
        const mvC = (() => {
          try {
            const m = JSON.parse(JSON.stringify(RESULT.mv));
            delete m.ext;
            delete m.sketch;
            return m;
          } catch (e) {
            return { name: RESULT.mv.name };
          }
        })();
        const a0 = nb.mons[mid];
        let k = 0;
        for (const r of RESULT.targets) {
          if (!r || !r.acc || !r.acc.refl || !r.def) continue;
          const d = nb.mons[r.def.id];
          if (!d || !d.entry || d.hp.cur <= 0 || !a0) continue;
          const by = String(r.acc.refl);
          {
            const bn = by.replace(/^특성\s*:\s*/, '').trim();
            if (bn && bn === abNm(d)) d.trFire = { n: bn, k: Date.now(), opp: mid };
          }
          const ent = {
            slot: slotOf(d.side, d.entry),
            mid: d.id,
            name: d.name,
            side: d.side,
            change: false,
            started: false,
            order: -1000,
            prio: 0,
            speed: 0,
            dice: 0,
            move: RESULT.mv.name,
            targets: a0.entry ? [slotOf(a0.side, a0.entry)] : [],
            pursuit: false,
            xact: '반사 · ' + by.replace(/[『』「」]/g, ''),
            refl: { from: mid, by, mv: mvC }
          };
          if ((+nb.phase || 0) >= 2 && Array.isArray(nb.order) && nb.order.length) {
            nb.order.splice((+nb.orderIdx || 0) + 1 + k, 0, ent);
            k++;
            lines.push(`${d.name} 「${by}」 — 「${RESULT.mv.name}」을(를) 반사했다 (다음 차례 · 반사 공격 → ${a0.name})`);
          } else {
            RFQ.push(ent);
            /* 11-23 순서가 없을 때: 반사한 포켓몬에 적어 둔다(reflPend) — 적용한 사람이 그 포켓몬을 못 다루면(PL 끼리) 주인이 카드 「공격」을 눌러 반사 공격을 연다 */ d.reflPend =
              { from: mid, by, mv: mvC, targets: ent.targets, xact: ent.xact, turn: +nb.turn || 0 };
            lines.push(
              `${d.name} 「${by}」 — 「${RESULT.mv.name}」을(를) 반사했다 (반사 공격 → ${a0.name} · ${d.name} 카드의 「공격」을 누르면 열린다)`
            );
          }
        }
      }
      A().closeModal();
      if (!(await saveBattle(nb0, nb, undefined, { n: atk.name, s: RESULT.mv.name, img: atk.image || '' }))) return;
      A().sysLog(
        `【전달】 ${atk.name} 『${RESULT.mv.name}』${RF ? ' · 반사 공격' : ''} → ${sumL.join(' · ') || '대상 없음'}${dealtAny ? ' — 받는 쪽이 「HP」에서 적용' : ''}${lines.length ? '\n' + lines.join('\n') : ''}`,
        'battle',
        { mid: atk.id, img: atk.image || '' }
      );
      if (RFQ.length)
        RFQ.forEach((e, i) =>
          setTimeout(
            () => {
              try {
                openAttack(e.mid, { mvName: e.move, targets: e.targets, by: e.xact, preT: 1, refl: e.refl, rangeDone: 1 });
              } catch (x) {
                console.warn('반사 공격', x);
              }
            },
            600 + i * 300
          )
        );
      await coverFire(mid, RESULT);
      if (!RF) {
        await chainAfterAct(mid);
        await mvModAfter(mid, RESULT);
        await comboXact(mid, RESULT);
        await sleepTalkAfter(mid, RESULT);
        await thirdToneAfter(mid, RESULT);
        await orderUpAfter(mid, RESULT);
        if (RESULT.auto && RESULT.auto.drainUpPot) await potMark(mid, RESULT.auto.drainUpPot);
        await extraAtkAfter(mid, RESULT);
      } /* 11-22 「아군의 「소리」 기술에 뒤이어」 */
      /* 11-07 망령 「닌자 자동화가 없어요」: 「자신이 행동한 뒤 …」 포텐셜(닌자 ① 회피 ×1.33 턴 종료까지)은 공격을 적용한 뒤 저절로 건다 — 구문이 있고 횟수(【N/시】) 없는 것만 · 한 턴에 한 번 */
      {
        const a2 = RF ? null : ctx().b.mons[mid];
        const T = +ctx().b.turn || 0;
        if (a2 && a2.entry && a2.hp.cur > 0 && FX())
          for (const p of potSrc(a2)) {
            if (!p || !p.name || (p.ph && !p.apt) || !/자신이\s*행동한\s*(?:뒤|후)/.test(String(p.eff || ''))) continue;
            const k = mid + '|' + p.name;
            if (ACTFX[k] === T) continue;
            const au = FX().autoOf(a2, 'pot', p.name);
            if (!au || !au.ops || !au.ops.length || au.manual || limManual(a2, 'pot', p.name, p.eff)) continue;
            ACTFX[k] = T;
            const okN = await fireAuto(mid, 'pot', p.name, {
              quiet: true,
              noRoll: true,
              head: `【포텐셜】 ${a2.name} 『${p.name}』 — 행동한 뒤 자동`
            });
            /* 11-15 「『닌자』가 발동했을 때 「자세」 기술에 의한 추가 행동」(울트라드래곤 『궁극의 사두룡』 【보급】) — 행동 순서 바로 다음 칸에 추가 행동 */ if (
              okN
            ) {
              const X = await stanceXact(mid, p.name);
              if (X) {
                const b2 = ctx().b;
                const ord = (b2.order || []).slice();
                const idx = +b2.orderIdx || 0;
                ord.splice(idx + 1, 0, {
                  slot: slotOf(a2.side, a2.entry),
                  mid,
                  name: a2.name,
                  side: a2.side,
                  change: false,
                  started: false,
                  order: -1000,
                  prio: 0,
                  speed: 0,
                  dice: 0,
                  move: X.mv.name,
                  targets: [],
                  pursuit: false,
                  xact: X.p
                });
                await A().set(['battle', 'order'], ord);
                A().sysLog(`【포텐셜】 ${a2.name} 『${X.p}』 — 『${p.name}』 발동 · 「${X.mv.name}」로 추가 행동 (다음 차례)`, 'battle', {
                  mid,
                  img: a2.image || ''
                });
              }
            }
          }
      }
      /* 11-08 「조건 명중」 자동 (돌던지기 → 물 타입 강제 교대 …) */
      try {
        await hitAuto(mid, RESULT);
      } catch (e) {
        console.warn('hitAuto', e);
      }
      /* 11-26 364 「자신의 공격으로 상대가 「HP : 1」이 되었을 때 상대를 「빈사」 상태로 만든다」(제레 발레리 『생사접의 권능』): 맞은 상대의 HP 가 딱 1 로 남으면 0 으로 */
      try {
        if (!RESULT.check)
          for (const r of RESULT.targets || []) {
            if (!r || !r.def || r.def.id === mid || !r.acc || !r.acc.hit) continue;
            await hp1Kill(mid, r.def.id);
          }
      } catch (e) {
        console.warn('hp1', e);
      }
      /* 11-26 07:05 망령 「「아군에게 이 기술을 내보냈을 때」 계기도 만들자」(루파 고무 · 수호 · 선봉): 기술이 같은 편 다른 포켓몬에게 들어갔으면 쓴 쪽의 포텐셜 · 고유가 본다 (대상 = 그 아군) */
      try {
        if (!RESULT.check)
          for (const r of RESULT.targets || []) {
            if (!r || !r.def || r.def.id === mid || (r.acc && r.acc.hit === false)) continue;
            const B1 = ctx().b;
            const a1 = B1.mons[mid],
              d1 = B1.mons[r.def.id];
            if (!a1 || !d1 || !sameT(a1, d1, B1)) continue;
            await evReact('used', {
              mid,
              tgt: d1.id,
              mv: RESULT.mv.name,
              key: 'u' + mid + ':' + d1.id + ':' + RESULT.mv.name + ':' + (+B1.orderIdx || 0)
            });
          }
      } catch (e) {
        console.warn('evReact used', e);
      }
      /* 11-09 감우 55: 맞은 쪽의 「공격을 받았을 때」 포텐셜 · 고유 */ try {
        if (!RESULT.check)
          for (const r of RESULT.targets || []) {
            if (!r || !r.acc || !r.acc.hit || !r.def || r.def.id === mid) continue;
            await evReact('hit', {
              mid,
              tgt: r.def.id,
              dmg: (() => {
                try {
                  const lh = (ctx().b.mons[r.def.id] || {}).lastHit;
                  return lh && lh.fromId === mid ? +lh.total || 0 : Math.floor(+(r.dmg || {}).total || 0);
                } catch (e) {
                  return 0;
                }
              })(),
              mv: RESULT.mv.name,
              mt: RESULT.moveTypes || [],
              cat: RESULT.mv.cat || '',
              ct: !!(A().contactOf && A().contactOf(RESULT.mv) === 'O') && !farOf(ctx().b.mons[mid] || {}),
              eff: r.eff ? +r.eff.value : 1,
              crit: !!(r.hits || []).some(h => h && h.v === 2),
              key: RESULT.mv.name + '@' + r.def.id + '@' + Date.now()
            });
          }
      } catch (e) {
        console.warn('evReact hit', e);
      }
      /* 11-22 「상대 기술이 명중하지 않았을 때」 계기 (빗나감 — 「기술 방어」로 막힘 · 무효는 빼고) */ try {
        if (!RESULT.check)
          for (const r of RESULT.targets || []) {
            if (!r || !r.acc || r.acc.hit || r.acc.prot || r.acc.nul || r.acc.refl || !r.def || r.def.id === mid) continue;
            await evReact('miss', { mid, tgt: r.def.id, mv: RESULT.mv.name, key: RESULT.mv.name + '@miss@' + r.def.id + '@' + Date.now() });
          }
      } catch (e) {
        console.warn('evReact miss', e);
      }
      /* 11-10: 「기술 방어」로 막은 쪽의 「「방어」 상태로 무시했을 때」 */ try {
        if (!RESULT.check)
          for (const r of RESULT.targets || []) {
            if (!r || !r.acc || !r.acc.prot || !r.def || r.def.id === mid) continue;
            try {
              await protRiderFire(
                mid,
                r.def.id,
                !!(A().contactOf && A().contactOf(RESULT.mv) === 'O') && !farOf(ctx().b.mons[mid] || {}),
                RESULT.mv.name
              );
            } catch (e) {
              console.warn('protRider', e);
            }
            await evReact('guard', {
              mid,
              tgt: r.def.id,
              mv: RESULT.mv.name,
              mt: RESULT.moveTypes || [],
              cat: RESULT.mv.cat || '',
              ct: !!(A().contactOf && A().contactOf(RESULT.mv) === 'O') && !farOf(ctx().b.mons[mid] || {}),
              key: RESULT.mv.name + '@g' + r.def.id + '@' + Date.now()
            });
          }
      } catch (e) {
        console.warn('evReact guard', e);
      }
      /* 11-09 감우 54-E: 적용 중 쌓인 계기(드레인 …) · 【함성(기술)】 */ try {
        await evFlush();
        if (RESULT && RESULT.mv && !RESULT.check && !RF) await evReact('shout', { mid, mv: RESULT.mv.name, key: RESULT.mv.name + '@' + Date.now() });
      } catch (e) {
        console.warn('evReact', e);
      }
      try {
        await deferFire(mid, '자신의 행동이 끝나서', 'act');
      } catch (e) {
        console.warn('defer', e);
      } /* 11-09 미룬 대미지 */
      /* 11-03 「추가공격」: 포켓몬 하나에게 내보낸 맞는 기술이 명중했으면 1번 더 (위력 · 필중은 구문대로) — 추가 공격 창을 연다 */
      {
        const hit1 = !RF && RESULT.targets.length === 1 && RESULT.targets[0].acc.hit && RESULT.mv.cat !== '변화' ? RESULT.targets[0] : null;
        const left = opt.extra ? +opt.extra.left || 0 : null;
        if (hit1 && (left === null || left > 0)) {
          const a2 = ctx().b.mons[mid];
          const ex =
            a2 && a2.entry && a2.hp.cur > 0
              ? opt.extra
                ? { pw: opt.extra.pw, sure: opt.extra.sure, n: left, name: opt.extra.name }
                : spL(a2, 'extra').find(e => spHit(e, RESULT.mv, RESULT.moveTypes)) ||
                  (abNm(a2) === '둘이함께' ? { pw: 0.25, sure: 1, n: 1, name: '둘이함께' } : null)
              : null;
          const d2 = ctx().b.mons[hit1.def.id];
          /* 11-23 망령 「손으로 처리하는 것들도」: 특성 둘이함께 = 포켓몬 하나에게 내보낸 공격이 명중하면 1번 더(같은 대상 · 필중 · 위력 1/4) · 앤 보니&메리 리드 『콤비네이션』 ① 그 추가 공격의 대상을 임의로(대상을 비워 연다) ② 「헤드샷」이면 반드시 반대 에리어의 상대에게 */ let xt =
              [hit1.slot],
            free = false;
          try {
            if (ex && !opt.extra && abNm(a2) === '둘이함께') {
              const ct =
                potSrc(a2)
                  .map(q => String((q && q.eff) || ''))
                  .find(e => /「특성\s*:\s*둘이함께」로\s*내보내는/.test(e)) || '';
              const hm = ct.match(/둘이함께」로\s*내보내는\s*「([^」]+)」(?:이|가)\s*반드시\s*반대\s*에리어에\s*명중/);
              if (hm && hm[1].trim() === RESULT.mv.name) {
                const o = Object.values(ctx().b.mons || {}).find(
                  x => x && x.entry && x.hp && x.hp.cur > 0 && !sameT(x, a2, ctx().b) && d2 && x.entry !== d2.entry
                );
                if (o) {
                  xt = [slotOf(o.side, o.entry)];
                  free = true;
                }
              } else if (/기술의\s*대상을\s*임의로/.test(ct)) {
                xt = null;
                free = true;
              }
            }
          } catch (e) {
            console.warn('둘이함께', e);
          }
          if (ex && d2 && ((d2.entry && d2.hp.cur > 0) || free)) {
            const mi = MVS(a2).findIndex(q => q && q.name === RESULT.mv.name);
            setTimeout(
              () =>
                openAttack(mid, {
                  mvIdx: mi >= 0 ? mi : undefined,
                  mvName: mi < 0 ? RESULT.mv.name : undefined,
                  ...(xt ? { targets: xt } : {}),
                  extra: { pw: +ex.pw || 0.25, sure: !!ex.sure, left: (opt.extra ? left : +ex.n || 1) - 1, name: ex.name }
                }),
              500
            );
          }
        }
      }
      /* 교대는 저장 뒤에 (퇴장·등장이 각자 저장한다) */
      if (doF)
        for (const r of RESULT.targets) {
          if (!r.acc.hit || r.def.id === mid) continue;
          const d = ctx().b.mons[r.def.id];
          if (!d || !d.entry || d.hp.cur <= 0) continue;
          /* 11-18 망령 제보 「강제교대기를 맞으면 대미지 판정 이전에 강제교대 당한다」: 받는 쪽이 아직 HP 창에서 대미지를 적용하지 않았으면(lastHit) 강제 교대를 거기에 맡긴다 — 적용하고 살아 있으면 그때 교대 */
          if (d.lastHit && d.lastHit.fromId === mid && d.lastHit.move === RESULT.mv.name && r.dmg) {
            await A().set(['battle', 'mons', d.id, 'lastHit', 'fsw'], { by: atk.name, move: RESULT.mv.name });
            A().sysLog(`${d.name} — 「${RESULT.mv.name}」 대미지를 적용한 뒤 강제 교대`, 'battle');
            continue;
          }
          const g = await switchGuard(d);
          if (g) {
            A().sysLog(`${d.name} 강제 교대를 받지 않는다 (${g})`, 'battle');
            continue;
          }
          const c2 = ctx();
          if (canEdit(c2, d) || c2.mgr) await forcedSwitch(d.id, { sys: true });
          else A().sysLog(`${d.name} 강제 교대 — 상대나 GM 이 「퇴장 → 강제 교대」로 처리`, 'battle');
        }
      /* 11-24 망령 「지휘 자동화」: 「지휘」 = 대상이 쓴 기술을 다시 내보내게 한다 — 대상에 instr={t,by,mv} 를 적고 알린다(그 기술은 공격 창에서 한 번 더 굴린다). 【함성 (아군)】/「지휘」로 내보낸 기술일 때 … 가 이 표시를 본다 */ try {
        if (String(RESULT.mv.name || '').replace(/\s/g, '') === '지휘') {
          for (const r of RESULT.targets || []) {
            if (!r || !r.def || r.def.id === mid) continue;
            const d = ctx().b.mons[r.def.id];
            if (!d || !d.entry || !(d.hp && d.hp.cur > 0)) continue;
            const lm = d.lastMove;
            if (!lm || !lm.name || String(lm.name).replace(/\s/g, '') === '지휘') {
              A().sysLog(`「지휘」 — ${d.name}이(가) 아직 내보낸 기술이 없어 실패`, 'battle', { mid: d.id });
              continue;
            }
            await A().set(['battle', 'mons', d.id, 'instr'], { t: +ctx().b.turn || 0, by: mid, mv: lm.name });
            A().sysLog(`「지휘」 — ${d.name}이(가) 「${lm.name}」을(를) 다시 내보낸다 (공격 창에서 그 기술을 한 번 더 굴린다)`, 'battle', {
              mid: d.id
            });
          }
        }
      } catch (e) {
        console.warn('지휘', e);
      }
      if (swS && RESULT.targets.some(r => r.acc.hit)) {
        const a = ctx().b.mons[mid];
        if (a && a.entry && a.hp.cur > 0) {
          const bench = Object.values(ctx().b.mons).filter(x => x.tid === a.tid && !x.entry && !x.pend && x.hp.cur > 0 && x.id !== mid);
          if (!bench.length) A().sysLog(`${a.name} 교대할 포켓몬이 벤치에 없다`, 'battle');
          else {
            const pk = await uiCtx(ctx().b, a, RESULT.mv.name).pick(bench, '교대해 들어올 포켓몬');
            if (pk) {
              const area = a.entry;
              EXIT_MV = {
                mid,
                mv: RESULT.mv.name,
                hit: ((RESULT.targets || []).find(r => r && r.acc && r.acc.hit && r.def && r.def.id !== mid) || { def: {} }).def.id || ''
              };
              try {
                await exitMon(mid, { noAsk: true, batton: swS === 'batton', sys: true, how: '임의 교대' });
              } finally {
                EXIT_MV = null;
              }
              await enterMon(pk.id, area, { sys: true, how: '임의 교대' });
            }
          }
        }
      }
    };
  }

  /* 상세 창용: 지금 걸린 것 (읽기 전용) */
