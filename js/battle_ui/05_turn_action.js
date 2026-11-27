  /* ── 조각 05_turn_action.js — 동작: 페이즈 · 턴 진행 · 등장 · 퇴장 ── */
  /* ---------- 동작 ---------- */
  /* 페이즈 버튼 = 그 단계의 처리까지 (맵툴 progress_turn 처럼). 「턴 진행 ▶」은 다음 단계로 */
  /* 11-03 감우: 페이즈 버튼으로 지금보다 앞 단계로 갈 때는 묻는다 (지시 준비로 가면 지시 · 준비 · 순서가 지워진다). 「턴 진행 ▶」의 정상 진행은 묻지 않는다 (o.force) */
  const PH_NAME = { 0: '지시 준비', 1: '턴 개시', 2: '행동 순서', 3: '행동 처리', 5: '턴 종료' };
  async function setPhase(p, o) {
    o = o || {};
    const c = ctx();
    if (!c.mgr) return;
    const b = c.b;
    p = +p;
    const cur = +b.phase || 0;
    if (!o.force && p < cur) {
      const q =
        p === 0
          ? `「지시 준비」로 돌아가면 이번 턴의 공개된 지시 · 준비 완료 · 행동 순서가 지워진다 (비밀 지시는 남는다).\n지금 단계: ${PH_NAME[cur] || cur}`
          : `지금 「${PH_NAME[cur] || cur}」인데 앞 단계 「${PH_NAME[p] || p}」로 돌아갈까?\n(그 단계의 처리를 다시 한다)`;
      if (!(await askYes(q, '돌아간다', '그대로'))) return;
    }
    if (p === 0) {
      await A().setMany([
        [['battle', 'cmds'], {}],
        [['ready'], {}],
        [['battle', 'order'], []],
        [['battle', 'phase'], 0]
      ]);
      A().sysLog('페이즈: 지시 준비 — 지시를 입력하고 「준비 완료」', 'battle');
      return;
    }
    if (p === 1) {
      const tids = Object.keys(b.trainers || {});
      const ready = c.ST.state.ready || {};
      const seats = c.ST.state.seats || {};
      const notReady = tids.filter(t => (seats[t] || baseSeat(c, t)) && !ready[t]);
      if (
        notReady.length &&
        !o.force &&
        !(await askYes(`아직 준비 완료가 아닌 트레이너: ${notReady.map(t => b.trainers[t].name).join(', ')}\n그래도 턴을 개시할까?`))
      )
        return;
      if (notReady.length && o.timeout)
        A().sysLog(
          `제한 시간 종료 — 준비 안 된 자리(${notReady.map(t => (b.trainers[t] || {}).name || t).join(' · ')})는 행동 없음으로 두고 진행`,
          'battle'
        );
      if (!b.started) {
        await startBattle();
        if (!ctx().b.started) return;
        await new Promise(r => setTimeout(r, 2600));
      }
      /* 11-03 감우: 칸마다 따로 쓰던 것을 한 번에 (om_jset_many · 없으면 칸마다) */
      const ops = [
        [['ready'], {}],
        [['battle', 'cmds'], {}],
        [['battle', 'host'], c.gm ? 'gm' : c.seat]
      ];
      if (b.deadline) ops.push([['battle', 'deadline'], null]);
      if (b.tstep) ops.push([['battle', 'tstep'], null]);
      if (b.swPur) ops.push([['battle', 'swPur'], null]);
      if (b.swOut) ops.push([['battle', 'swOut'], null]);
      ops.push([['battle', 'phase'], 1]);
      /* 맵툴 set_turn_start: 턴을 연 순간 필드에 있던 포켓몬은 started (이 턴 도중에 들어온 포켓몬만 「교대 등장」) */
      for (const m of Object.values(ctx().b.mons || {})) if (m.entry && !m.started) ops.push([['battle', 'mons', m.id, 'started'], true]);
      if (!(await A().setMany(ops))) return;
      await preCharge();
      const TN = +ctx().b.turn || 1;
      cutPhase('턴 개시', `TURN ${TN}`);
      A().sysLog(
        `턴 개시 — TURN ${TN}${TN <= 1 ? '\n「턴 진행 ▶」: 교대 알림 → 『지령』 & 『포텐셜』 발동 → 행동 순서 · 지시는 행동 순서가 오면 차례대로 공개' : ''}`,
        'battle'
      );
      try {
        await autoTurnStart();
      } catch (e) {
        console.warn('턴 개시 자동', e);
      }
      try {
        await twoStageStart();
      } catch (e) {
        console.warn('두 단계 고유 ②', e);
      }
      try {
        await fieldAuto('start');
      } catch (e) {
        console.warn('필드 턴 개시 구문', e);
      }
      /* 11-03 감우: 턴 개시 처리가 끝난 모습을 체크포인트로 (「↶ 이 턴 처음으로」) — 방 상태 밖 om_snap, 없으면 이 브라우저 */
      try {
        await snapTurn();
      } catch (e) {
        console.warn('턴 체크포인트', e);
      }
      return;
    }
    if (p === 2) return computeOrder();
    if (p === 3) {
      await A().setMany([
        [['battle', 'orderIdx'], 0],
        [['battle', 'phase'], 3]
      ]);
      cutPhase('행동 처리', '순서대로 공격');
      A().sysLog('행동 처리 — 순서대로 「공격」, 끝나면 「다음 행동 ▶」', 'battle');
      return;
    }
    if (p === 5) return endFlow();
  }
  /* 행동 순서에서 이 포켓몬 차례가 왔나 (지금 · 지난 차례) */
  /* 11-11 두 단계 고유 ②: 턴 개시 때 ① 을 쓴(preDone 이번 턴) 트레이너가 선행 입력한 ② 를 저절로 발동 — 고른 기술(utm)이 공개된다 */
  async function twoStageStart() {
    const c = ctx();
    if (!c.mgr || !c.ST.secret) return;
    const b = c.b;
    let rows = [];
    try {
      rows = await DBS().secretGet(c.ST.room, c.ST.secret, 'cmd');
    } catch (e) {
      return;
    }
    for (const tid in b.trainers || {}) {
      const t = b.trainers[tid];
      const r = (rows || []).filter(q => cmdFresh(q, b)).find(q => q.id === tid);
      const up = (r && r.data && r.data.upots) || [];
      for (const u of t.unique || []) {
        if (!u || !u.name || !twoStage(u.eff) || !preDoneOf(t, u.name)) continue;
        if (!up.includes(u.name)) {
          A().sysLog(`【고유】 ${t.name} 『${u.name}』 ② — 이번 턴 선행 입력(기술 선언)이 없어 ② 는 발동하지 않는다`, 'battle');
          continue;
        }
        if ((((ctx().b.cmds || {})[tid] || {}).fired || {})._t && ((ctx().b.cmds[tid].fired._t || {}).pot || {})['u:' + u.name]) continue;
        await fireSpecial(tid, null, 'uq', u.name, 'pre');
      }
    }
  }
  function turnReached(b, m) {
    const ord = b.order || [];
    const i = ord.findIndex(o => o.mid === m.id);
    return i >= 0 && i <= (+b.orderIdx || 0);
  }
  /* 순서 열쇠: 행동 순서 계산에 드는 것만 (교대 여부 · 우선도/순서 바꾸기 · 기술 우선도 · 따라가때리기). 기술 이름·대상은 차례가 올 때 공개 */
  function okeyOf(m, x) {
    x = x || {};
    const pm = {},
      om = {};
    for (const k in x.prio || {}) if (x.prio[k] !== '') pm[k] = +x.prio[k];
    for (const k in x.ochg || {}) if (x.ochg[k] !== '') om[k] = +x.ochg[k];
    const mv = x.move !== '' && x.move !== 'switch' && x.move != null ? MVS(m)[+x.move] : null;
    const o = {
      sw: x.move === 'switch' ? 1 : 0,
      ...(x.move === 'switch' && x.switch ? { st: String(x.switch) } : {}),
      pm,
      om,
      pr: mv ? (FX() ? FX().prioOf(m, mv) : +mv.prio || 0) : 0,
      mv: mv ? 1 : 0,
      atk: mv && mv.cat !== '변화' ? 1 : 0
    }; /* atk: 공격을 지시받았나 (【수세】 · 【공세】 — 숨은 지시를 못 읽는 화면용, 11-07) */
    if (mv && (isPursuit(mv, m) || x.pur)) {
      o.pn = mv.name;
      o.tg = tgNow(ctx().b, x, m);
      o.psrc = isPursuit(mv, m) ? ((m.flags || {}).pursuit ? m.flags.pursuitBy || '' : '') : x.pur || '';
    } else if (mv && mv.cat !== '변화' && illuPursBy(m)) {
      o.pn = mv.name;
      o.tg = tgNow(ctx().b, x, m);
      o.psrc = illuPursBy(m);
      o.pcond = 'dex';
    } /* 11-22 변장 중 · 해석된 상대에게만 */
    {
      const ab = abNm(m);
      if (mv && PRIO_AB[ab]) {
        o.ab = ab;
        o.one = String(mv.range || '') === '1체' ? 1 : 0;
        try {
          o.atg = tgNow(ctx().b, x, m) || [];
        } catch (e) {
          o.atg = [];
        }
      }
    } /* 11-22 추월 · 앞지르기: 대상 쪽 지시를 보고 순서 계산 때 우선도 +0.5 */
    const pimm = x.pimm || ((m.flags || {}).pursuitImmune ? m.flags.pursuitImmuneBy || '추격 무시' : '');
    if (pimm) o.pimm = pimm;
    if (mv && (isUturn(mv, m) || x.ut || x.uman)) o.ut = 1;
    return o;
  }
  /* 11-22 망령 「추월이나 앞지르기 같은 건 조건이 충족되면 자동 발동해야」:
    추월 = 【공세】/「단일기」에 「우선도 : +0.5」 — 1체 기술이고 그 대상이 공격을 지시받지 않았을 때(변화기 · 교대 · 행동 없음).
    앞지르기 = 서로 「변화기」를 내보냈을 때 자신의 기술에 「우선도 : +0.5」 — 자신이 변화기이고, 노린 상대(없으면 맞은편 상대 중 누구든)도 변화기.
    상대의 지시를 알아야 해서 순서 계산(computeOrder)이 모든 열쇠를 모은 뒤 더한다. 예전 레디메이드(우선도 +0.5 · 늘 / 이번턴)는 조건이 없어 「손으로」로 돌림 */
  const PRIO_AB = { '추월': 1, '앞지르기': 1 };
  function abPrioMod(b, s, K, KEYS, slots) {
    if (!K || !K.ab || !K.mv || K.sw) return null;
    const foeK = sl => {
      const z = slots.find(q => q.slot === sl);
      if (!z || sameT(z.mon, s.mon, b)) return null;
      return { mon: z.mon, k: KEYS[z.mon.id] || {} };
    };
    const tg = (K.atg || []).map(foeK).filter(Boolean);
    if (K.ab === '추월') {
      if (!K.one || !tg.length) return null;
      const t = tg[0];
      if (t.k.atk) return null;
      return { v: 0.5, note: `${s.mon.name} 「추월」 — ${t.mon.name}이(가) 공격을 지시받지 않아 단일기 우선도 +0.5` };
    }
    if (K.ab === '앞지르기') {
      if (K.atk) return null;
      const pool = tg.length ? tg : slots.filter(z => !sameT(z.mon, s.mon, b)).map(z => ({ mon: z.mon, k: KEYS[z.mon.id] || {} }));
      const t = pool.find(q => q.k.mv && !q.k.atk && !q.k.sw);
      if (!t) return null;
      return { v: 0.5, note: `${s.mon.name} 「앞지르기」 — 서로 변화기 (${t.mon.name}) · 우선도 +0.5` };
    }
    return null;
  }
  /* 좌석: 턴 개시 때 내 순서 열쇠를 cmds[내 자리].ok 에 올린다 (진행하는 사람이 남의 비밀 지시를 못 읽어도 순서를 계산하게) */
  /* 11-03 21:30 (아니스 시온 「행동 진행을 안 누르는 쪽은 우선도가 반영 안 된다」): 열쇠는 턴 개시 때 한 번만 올라가서, 그 뒤(선행 발동 등)에 생긴 우선도 효과가 남의 화면 계산에 안 들어갔다.
    열쇠에 우선도에 닿는 상태의 지문(sig)을 붙이고, 지문이 바뀌면 다시 올린다. 계산하는 쪽은 지문이 맞을 때까지 잠깐 기다린다 */
  function prioSig(b, tid) {
    return Object.values((b && b.mons) || {})
      .filter(m => m && m.tid === tid && m.entry && m.hp && m.hp.cur > 0)
      .sort((x, y) => String(x.id).localeCompare(String(y.id)))
      .map(m => m.id + ':' + JSON.stringify((m.fx || {}).prio || []) + ':' + (m.prioDown ? 1 : 0) + ':' + (m.ability || '') + ':' + (m.item || ''))
      .join('|');
  }
  /* 11-07 망령 「버텨라! — PL 이 공격 창을 열어도 나와야지」: 맞을 때 쓰는 4식(버텨라! · 물러나! · 피해라!)을 선행 입력했으면 턴 개시 뒤 순서 열쇠에 그 칸(g4)을 올린다 —
    숨은 지시를 못 읽는 PL 화면도 공격 창 앞에서 선행 발동할 수 있게. 지시가 잠긴 뒤(phase 1)에만 올라간다 */
  const HIT4 = ['버텨라!', '물러나!', '피해라!'];
  async function publishOk(tid0, force) {
    const c = ctx();
    const b = c.b;
    const tid = tid0 || c.seat;
    if (!(c.role === 'seat' || (c.gm && !seatOwned(c, tid))) || !tid || !(b.trainers || {})[tid]) return;
    /* 11-03 21:51: GM 몫(NPC · GM 이 불러온 파티)도 GM 화면이 올린다 — 좌석이 진행할 때 GM 쪽 우선도 · 교대가 빠지던 것 */ const key = turnKey(b);
    const cur = ((b.cmds || {})[tid] || {}).ok;
    const sig = prioSig(b, tid);
    if (!force && ((cur && cur.key === key && cur.sig === sig) || BUSY.ok === key + tid + sig)) return;
    BUSY.ok = key + tid + sig;
    const t = b.trainers[tid];
    try {
      const cm = await myCmd(c, tid, true);
      const ok = { key, sig, m: {} };
      for (const mm of Object.values(b.mons || {}).filter(x => x.tid === tid && x.entry && x.hp.cur > 0)) {
        const xx = ((cm || {}).mons || {})[mm.id] || {};
        ok.m[mm.id] = okeyOf(mm, xx);
        if (preCounts(t, xx, mm)) ok.m[mm.id].pi = 1;
        if (xx.order && HIT4.includes(OO().orderName(t, xx.order))) ok.m[mm.id].g4 = xx.order;
      }
      if (upCounts(t, (cm || {}).upots)) ok.pre = 1;
      if ((ctx().b.cmds || {})[tid]) await A().set(['battle', 'cmds', tid, 'ok'], ok);
      else await A().set(['battle', 'cmds', tid], { ok });
    } catch (e) {
      BUSY.ok = '';
      console.warn('publishOk', e);
    }
  }
  /* 차례가 온 포켓몬의 지시를 연다: 주인 화면이, GM 몫(NPC · GM 이 불러온 파티)은 GM 화면이. 보통 모드의 GM 은 플레이어가 안 열면 잠시 뒤 대신 연다 */
  const RVT = {};
  async function autoRevealTurn() {
    const c = ctx();
    const b = c.b;
    if ((+b.phase || 0) < 2) return;
    const o = (b.order || [])[+b.orderIdx || 0];
    if (!o) return;
    const m = (b.mons || {})[o.mid];
    if (!m || !m.entry || m.hp.cur <= 0 || revealed(b, m.tid, m.id)) return;
    const key = turnKey(b) + ':' + m.id;
    if (SENT['rv:' + key] || BUSY.rv) return;
    const run = async () => {
      const b2 = ctx().b;
      const o2 = (b2.order || [])[+b2.orderIdx || 0];
      if (!o2 || o2.mid !== m.id || revealed(b2, m.tid, m.id) || SENT['rv:' + key]) return;
      SENT['rv:' + key] = 1;
      BUSY.rv = 1;
      try {
        await revealOne(m.tid, m.id, true);
      } finally {
        BUSY.rv = 0;
      }
    };
    if (c.role === 'seat' && lead(c, m.tid)) return run();
    if (!c.gm || (b.host || 'gm') !== 'gm') return;
    if (!isLeader(c)) return;
    if (c.fair && seatOwned(c, m.tid)) return;
    if (!seatOwned(c, m.tid)) return run();
    if (!RVT[key]) RVT[key] = setTimeout(run, 2500);
  }
  function unrevealed(b) {
    const out = [];
    for (const tid in b.trainers || {}) {
      const t = b.trainers[tid];
      const mons = Object.values(b.mons || {}).filter(m => m.tid === tid && m.entry && m.hp.cur > 0);
      for (const m of mons) if (!revealed(b, tid, m.id)) out.push(`${t.name} ${String(m.entry).toUpperCase()}`);
    }
    return out;
  }
  async function progressTurn() {
    const c = ctx();
    if (!c.mgr) return;
    const p = +c.b.phase || 0;
    /* 10-26: 행동 처리 중에 「턴 진행」을 또 누르면 남은 행동이 통째로 건너뛰어졌다 — 물어본다 */
    if (p === 3) {
      const O = c.b.order || [];
      const i0 = +c.b.orderIdx || 0;
      if (
        O.slice(i0).some(o => {
          const m = (c.b.mons || {})[o.mid];
          return m && m.entry && m.hp.cur > 0;
        }) &&
        !(await askYes('아직 행동하지 않은 포켓몬이 있다. 그래도 턴 종료로 넘어갈까?', '넘어간다', '돌아간다'))
      )
        return;
    }
    if (p === 1) return stepTurn();
    const next = { 0: 1, 1: 2, 2: 3, 3: 5, 5: 0 }[p];
    if (next == null) return;
    return setPhase(next, { force: true });
  }
  /* ----- 턴 개시 단계 (맵툴 set_turn_start → 1.5 set_turn_potential → 2): ① 교대가 있으면 교대 알림 · 교대 처리 → ② 선행 입력이 있으면 『지령』 & 『포텐셜』 발동 알림 → 행동 순서 (10-21 망령) ----- */
  /* 턴 개시 「『지령』 & 『포텐셜』 발동」 컷인에 세는 선행 (10-24 망령): 4식(버텨라! · 물러나! …)은 공격받을 때 쓰는 것이라 턴 개시에 뜨지 않는다 — 글에 「턴 개시」 가 있으면 센다 */
  /* 10-23 망령: 선행 포텐셜은 글에 「턴 개시」 가 있을 때만 · 지령(6령)은 늘 · 결계 · 법계(5계)는 늘 · 4식 등 다른 지시는 「턴 개시」 가 있을 때만 */
  const TS = s => /턴\s*개시/.test(String(s || '').replace(/<br\s*\/?>/g, ' '));
  const potRowOf = n => ((DB().maker || {}).pots || []).find(r => r[1] === n || r[1] === '『' + n + '』');
  const rmText = n => {
    const R = (window.OM_DB || {}).readymade || {};
    return (R[n] || {}).text || '';
  };
  const PRE_LATER =
    /받(?:을|았을|으면|는)|맞(?:을|았을|으면)|명중\s*굴림|명중굴림|공격(?:할|하기|을 받|받을)|기술을\s*(?:쓸|사용할|낼)|다음\s*(?:기술|공격|행동)|행동(?:할|하기|한 뒤|했을)|쓰러|빈사|교대|등장|퇴장|턴\s*종료|【\s*(?:임의|사전)\s*】/;
  /* 선행 입력한 포텐셜이 턴 개시(선행 발동)에 발동하나: 'now' — 글에 「턴 개시」 · 이름이 결계/법계 · 【선행】인데 따로 때(받을 때 · 명중굴림 · 다음 기술 …)가 없다 / 'later' — 조건 때 손으로 */
  function preWhen(pn, m) {
    const p = m ? potSrc(m).find(q => q.name === pn) : null;
    const row = potRowOf(pn);
    const tx = String((p && p.eff) || (row && row[2]) || rmText(pn) || '').replace(/<br\s*\/?>/g, ' ');
    if (TS(tx) || /결계|법계/.test(pn) || (/메가진화/.test(pn + ' ' + tx) && !PRE_LATER.test(tx.replace(/메가진화/g, '')))) return 'now';
    if (/【\s*선행\s*】/.test(tx) && !PRE_LATER.test(tx)) return 'now';
    return 'later';
  }
  function preCounts(t, x, m) {
    x = x || {};
    if (x.command) return true;
    if (x.order) {
      const n = m && m.tid ? pName(ctx().b, m.tid, 'order', x.order) : OO().orderName(t || {}, x.order);
      const row = potRowOf(n);
      if ((row && row[0] === '5계') || /결계|법계/.test(n)) return true;
      if (row && TS(row[2])) return true;
      if (!row && TS(rmText(n))) return true;
    }
    for (const pn of x.pots || []) if (preWhen(pn, m) === 'now') return true;
    return false;
  }
  /* (GM 이 진행하는 「GM 불간섭」 방이면 GM 이 건너뛴 명령 칸만 — ordOnly) 11-06 망령 「십계 턴 개시 발동」: 진행 화면이 다른 좌석이라 내 숨긴 지시를 못 읽어 저절로 못 건 턴 개시 선행(지령 · 결계 · 「턴 개시」 4식)은 내 화면이 「선행 발동」 단계에서 건다 (턴마다 한 번) */
  const SPF = {};
  async function selfPreFire(tid, ordOnly) {
    const c = ctx();
    const b = c.b;
    const k = turnKey(b) + '|' + tid;
    if (SPF[k]) return;
    SPF[k] = 1;
    const cm = await myCmd(c, tid, true);
    if (!cm) return;
    const TN = ((b.trainers || {})[tid] || {}).name || '?';
    const L = [];
    for (const [mid, x] of Object.entries(cm.mons || {})) {
      const mm = (ctx().b.mons || {})[mid];
      if (!x || !mm || mm.tid !== tid || !mm.entry || !(+(mm.hp || {}).cur > 0)) continue;
      for (const kind of ordOnly ? ['order'] : ['command', 'order']) {
        const key = x[kind];
        if (!key) continue;
        const fd = (((ctx().b.cmds || {})[tid] || {}).fired || {})[mid] || {};
        if (fd[kind]) continue;
        const on = pName(ctx().b, tid, kind, key);
        if (kind === 'order') {
          const row = potRowOf(on);
          if (!((row && row[0] === '5계') || /결계|법계/.test(on) || TS(row && row[2]) || (!row && TS(rmText(on))))) continue;
        }
        try {
          await fireOrder(tid, mid, kind, key, 'pre');
          const f2 = (((ctx().b.cmds || {})[tid] || {}).fired || {})[mid] || {};
          if (f2[kind]) L.push(`${mm.name} 『${on}』`);
        } catch (e) {
          console.warn('선행 자동(주인)', e);
        }
      }
    }
    if (L.length) A().sysLog(`【선행 자동 발동】 ${TN} — ${L.join(' · ')}`, 'battle');
  }
  function upCounts(t, ups) {
    for (const n of ups || []) {
      const u = ((t && t.unique) || []).find(q => q && q.name === n);
      if (TS(u && u.eff) || (!u && TS(rmText(n)))) return true;
    }
    return false;
  }
  async function turnInfo(c, b) {
    let rows = [];
    try {
      rows = ((await DBS().secretGet(c.ST.room, c.ST.secret, 'cmd')) || []).filter(r => cmdFresh(r, b));
    } catch (e) {}
    const SEC = {},
      PRE = {},
      UP = {};
    const live = mid => {
      const mm = (b.mons || {})[mid];
      return mm && mm.entry && mm.hp.cur > 0;
    };
    for (const r of rows) {
      const d = r.data || {};
      if (!(b.trainers || {})[r.id]) continue;
      if (upCounts(b.trainers[r.id], d.upots)) PRE[r.id] = UP[r.id] = 1;
      for (const mid in d.mons || {}) {
        const x = d.mons[mid] || {};
        SEC[mid] = x;
        if (live(mid) && preCounts(b.trainers[r.id], x, b.mons[mid])) PRE[r.id] = 1;
      }
    }
    const tk = turnKey(b);
    for (const tid in b.trainers || {}) {
      const ok = ((b.cmds || {})[tid] || {}).ok;
      if (!ok || ok.key !== tk) continue;
      if (ok.pre) PRE[tid] = 1;
      for (const mid in ok.m || {}) if (ok.m[mid].pi && live(mid)) PRE[tid] = 1;
    } /* 교대로 나간 포켓몬의 선행은 세지 않는다 */
    const keyOf = m => {
      if (SEC[m.id]) return okeyOf(m, SEC[m.id]);
      const ok = ((b.cmds || {})[m.tid] || {}).ok;
      if (ok && ok.key === tk && ok.m && ok.m[m.id]) return ok.m[m.id];
      const px = (((b.cmds || {})[m.tid] || {}).mons || {})[m.id];
      return px ? okeyOf(m, px) : null;
    };
    return { SEC, PRE, UP, keyOf };
  }
  /* 11-23 망령 (이시카와 고에몬 『천하대도』 ②「「프라이드 : B」이하인 상대가 내보내는 기술의 「따라가때리기」 효과를 무효화한다」): 교대하려는 쪽(def)의 포텐셜 · 전용 글을 보고, 때리는 쪽(atk)이 상대 편이며 프라이드 조건(없으면 누구든)이 맞으면 추격을 막는다 */
  function pursPriImm(def, atk, b) {
    if (!def || !atk || sameT(def, atk, b)) return '';
    for (const p of potSrc(def)) {
      const e = String((p && p.eff) || '');
      const q = e.match(
        /(?:「\s*프라이드\s*[:：]\s*([^」]+)」\s*((?:이하|이상|미만|초과)?)\s*인\s*)?상대(?:가|의)\s*(?:내보내는\s*)?기술의\s*「?따라가때리기」?\s*효과(?:를|을)?\s*무효/
      );
      if (!q) continue;
      if (q[1] && !(FX() && FX().priOk && FX().priOk(atk, q[1] + (q[2] || '')))) continue;
      return p.name;
    }
    return '';
  }
  async function stepTurn() {
    const c = ctx();
    if (!c.mgr) return;
    const b = c.b;
    if ((+b.phase || 0) !== 1) return;
    const st = +b.tstep || 0;
    const I = await turnInfo(c, b);
    const slots = allEntered(b);
    const TN = tid => ((b.trainers || {})[tid] || {}).name || '?';
    /* 11-24 아스트라이아 고유 ② 교대 선언: 선언한 포켓몬과 통상 교대하려는 대상은 교대 알림 앞에서 「검은눈빛」(건 쪽 = 선언한 트레이너의 필드 포켓몬 — 떠나면 풀린다) — 이번 턴 교대 목록에서 뺀다 */
    const TDT = +b.turn || 0;
    const tdSwTo = mo => {
      const k = I.keyOf(mo) || {};
      return String(k.st || (I.SEC[mo.id] || {}).switch || ((((b.cmds || {})[mo.tid] || {}).mons || {})[mo.id] || {}).switch || '');
    };
    if (st < 1) {
      const ops = [],
        TL = [];
      for (const s of slots) {
        const k = I.keyOf(s.mon);
        if (!k || !k.sw || +s.mon.tdHit === TDT) continue;
        const TD = tdeclOf(b, s.mon);
        if (!TD || !TD.sw || tdSwTo(s.mon) !== String(TD.sw)) continue;
        const by = Object.values(b.mons || {}).find(x => x && x.tid === TD.by && x.entry && x.hp && x.hp.cur > 0);
        ops.push([['battle', 'mons', s.mon.id, 'tdHit'], TDT], [['battle', 'mons', s.mon.id, 'states', 'MeanLook'], 1000]);
        if (by) ops.push([['battle', 'mons', s.mon.id, 'stFrom', 'MeanLook'], by.id]);
        s.mon.tdHit = TDT;
        TL.push(
          `${s.mon.name} — ${TD.swn || monName(b, TD.sw) || '?'}(와)과 교대하려 했다! 『${TD.src || '고유'}』의 선언대로 「검은눈빛」 상태가 되어 교대하지 못한다`
        );
      }
      if (ops.length) {
        await A().setMany(ops);
        A().sysLog(`【고유】 ${TL.join('\n')}`, 'battle');
      }
    }
    if (st < 1) {
      const sw = slots.filter(s => {
        const k = I.keyOf(s.mon);
        return k && k.sw && +s.mon.tdHit !== TDT;
      });
      if (sw.length) {
        const swTo = mo => {
          const k = I.keyOf(mo) || {};
          const id = k.st || (I.SEC[mo.id] || {}).switch || ((((b.cmds || {})[mo.tid] || {}).mons || {})[mo.id] || {}).switch;
          return (b.mons || {})[id] || null;
        }; /* 10-28 망령: 「교대 대상 미정」 — 비밀 지시(SEC) · 확정 지시(ok.m)에 든 교대 대상을 먼저 본다 (공개 지시 칸은 비어 있을 때가 있다) */ /* 10-27 망령: 교대 알림에 누구와 바꾸는지 · 그림 */
        const L = sw.map(s => {
          const w = swTo(s.mon);
          return `${TN(s.mon.tid)} — ${String(s.mon.entry).toUpperCase()} ${s.mon.name} ⇄ ${w ? w.name : '?'}`;
        });
        const RV = sw.map(s => {
          const w = swTo(s.mon);
          return {
            tr: TN(s.mon.tid),
            mid: s.mon.id,
            name: s.mon.name,
            img: s.mon.image || '',
            side: s.mon.side,
            area: String(s.mon.entry || '').toUpperCase(),
            sw: { name: w ? w.name : '(교대 대상 미정)', img: w ? w.image || '' : '' }
          };
        });
        /* 따라가때리기: 교대하려는 포켓몬을 노린 추격은 교대 전에 먼저 (맵툴 get_turn_pursuit) — 그 포켓몬은 이번 턴 행동을 쓴 것으로 본다 */
        const pl = [],
          pur = [];
        for (const s of slots) {
          const k = I.keyOf(s.mon);
          if (!k || !k.pn) continue;
          for (const tg of k.tg || []) {
            const v = sw.find(z => z.slot === tg);
            if (!v) continue;
            if (k.pcond === 'dex' && !dexTeam(b, v.mon, s.mon)) continue;
            const kv = I.keyOf(v.mon) || {};
            if (kv.pimm) {
              pl.push(`${v.mon.name}의 『${kv.pimm}』 — ${s.mon.name}의 따라가때리기를 무시했다`);
              continue;
            }
            {
              const pi = pursPriImm(v.mon, s.mon, b);
              if (pi) {
                pl.push(`${v.mon.name}의 『${pi}』 — ${s.mon.name}의 따라가때리기 효과를 무효화했다`);
                continue;
              }
            }
            pl.push(
              `${s.mon.name}의 「${k.pn}」 — 교대하려는 ${v.mon.name}을(를) 교대 전에 먼저 때린다! (공격 창에서 처리한 뒤 교대)${k.pcond === 'dex' ? illuPursSpend(s.mon.id, k.psrc) : ''}`
            );
            pur.push({
              slot: s.slot,
              mid: s.mon.id,
              name: s.mon.name,
              side: s.mon.side,
              change: false,
              started: true,
              order: 20,
              prio: 0,
              speed: 0,
              dice: 0,
              move: k.pn,
              targets: [tg],
              pursuit: true,
              pursuitHit: v.mon.id,
              pursuitSrc: k.psrc || ''
            });
            break;
          }
        }
        {
          const ops = [
            [['battle', 'tstep'], 1],
            [['battle', 'swPur'], pur.map(o => o.mid)],
            [['battle', 'swOut'], sw.map(s => s.mon.id)]
          ];
          if (pur.length) ops.push([['battle', 'order'], pur], [['battle', 'orderIdx'], 0]);
          await A().setMany(ops);
        }
        cutPhase('교대', sw.map(s => s.mon.name).join(' · '));
        A().sysLog(`【교대 알림】\n${L.join('\n')}${pl.length ? '\n' + pl.join('\n') : ''}\n교대를 마치면 「턴 진행 ▶」`, 'battle', {
          rv: RV,
          rvx: [...pl, '교대를 마치면 「턴 진행 ▶」']
        });
        return;
      }
    }
    /* 11-14 제보 「서로 통상 교대를 할 때 한쪽만 먼저 떠서 행동 순서가 나오고 다른 쪽 교대가 뒤에 뜬다」: 교대 알림 뒤에 들어온(늦게 공개 · 확정된) 교대도 행동 순서 전에 한 번 더 알리고,
     알림에 든 포켓몬이 아직 필드에 그대로면(교대를 안 했으면) 묻는다 — 행동 순서는 모든 교대가 끝난 뒤에 */
    if (st === 1) {
      const SO = b.swOut || [];
      const sw2 = slots.filter(s => {
        const k = I.keyOf(s.mon);
        return k && k.sw && !SO.includes(s.mon.id) && +s.mon.tdHit !== TDT;
      });
      if (sw2.length) {
        const to = mo => {
          const k = I.keyOf(mo) || {};
          const id = k.st || (I.SEC[mo.id] || {}).switch || ((((b.cmds || {})[mo.tid] || {}).mons || {})[mo.id] || {}).switch;
          return (b.mons || {})[id] || null;
        };
        await A().set(['battle', 'swOut'], SO.concat(sw2.map(s => s.mon.id)));
        cutPhase('교대', sw2.map(s => s.mon.name).join(' · '));
        A().sysLog(
          `【교대 알림 · 추가】\n${sw2
            .map(s => {
              const w = to(s.mon);
              return `${TN(s.mon.tid)} — ${String(s.mon.entry).toUpperCase()} ${s.mon.name} ⇄ ${w ? w.name : '?'}`;
            })
            .join('\n')}\n교대를 마치면 「턴 진행 ▶」`,
          'battle',
          {
            rv: sw2.map(s => {
              const w = to(s.mon);
              return {
                tr: TN(s.mon.tid),
                mid: s.mon.id,
                name: s.mon.name,
                img: s.mon.image || '',
                side: s.mon.side,
                area: String(s.mon.entry || '').toUpperCase(),
                sw: { name: w ? w.name : '(교대 대상 미정)', img: w ? w.image || '' : '' }
              };
            }),
            rvx: ['교대를 마치면 「턴 진행 ▶」']
          }
        );
        return;
      }
    }
    /* 11-14: 교대 때 따라가때리기 차례(swPur)를 아직 처리하지 않았으면 묻는다 — 그대로 가면 교대가 끝난 뒤 평소 차례로 행동한다 */
    if (st === 1 && (b.swPur || []).length) {
      const left = (b.swPur || []).filter(mid => {
        const m = (b.mons || {})[mid];
        const lm = m && m.lastMove;
        return m && m.entry && m.hp && m.hp.cur > 0 && !(lm && +lm.turn === (+b.turn || 0));
      });
      if (
        left.length &&
        !(await askYes(
          `${left.map(mid => (b.mons[mid] || {}).name || '?').join(' · ')} — 교대하려는 상대를 노린 따라가때리기를 아직 하지 않았다.\n행동 순서 「다음 행동 ▶」(또는 초상)으로 공격 창을 열어 먼저 처리한다.\n그대로 진행하면 교대가 끝난 뒤 평소 차례로 행동한다 (따라가때리기 없이).`,
          '그대로 진행',
          '기다린다'
        ))
      )
        return;
    }
    /* 11-14 망령 「동시에 통상 교대를 할 경우 동시 교대 처리 — 서로 나갔다 들어온 다음 퇴장과 등장을 순서대로」: 교대 알림에 든 포켓몬 중 아직 안 바꾼 것은 여기서 한꺼번에 —
     모두 나가고 모두 들어온 뒤 → 퇴장 계기(나간 쪽 스피드 순) → 등장 효과(들어온 쪽 스피드 순, autoEntryAll). 교대 대상을 모르는 것만 묻는다 */
    if (st === 1) {
      const SO = (b.swOut || []).map(id => (b.mons || {})[id]).filter(m => m && m.entry && m.hp && m.hp.cur > 0);
      if (SO.length) {
        const tgt = mo => {
          const k = I.keyOf(mo) || {};
          const id = k.st || (I.SEC[mo.id] || {}).switch || ((((b.cmds || {})[mo.tid] || {}).mons || {})[mo.id] || {}).switch;
          const w = (b.mons || {})[id];
          return w && !w.entry && w.hp && w.hp.cur > 0 && w.tid === mo.tid ? w : null;
        };
        const P = SO.map(m => ({ out: m, in: tgt(m) }));
        const miss = P.filter(x => !x.in);
        if (
          miss.length &&
          !(await askYes(
            `${miss.map(x => x.out.name).join(' · ')} — 교대 알림에 들었는데 바꿀 포켓몬을 모른다 (지시에 교대 대상이 없다).\n손으로 교대한 뒤 「턴 진행 ▶」을 누르거나, 그대로 진행하면 이 포켓몬은 교대하지 않는다.`,
            '그대로 진행',
            '기다린다'
          ))
        )
          return;
        const go = P.filter(x => x.in);
        if (go.length) {
          await simulSwitch(go.map(x => ({ out: x.out.id, in: x.in.id, area: x.out.entry })));
          return;
        }
      }
    }
    if (st < 2) {
      let tids = Object.keys(I.PRE).filter(t => (b.trainers || {})[t]);
      /* 10-31 망령 「4식 · 6령 쓰는 방식이 시뮬과 다르다 — 꼭 고쳐」: 선행 입력한 지령(6령)은 턴 개시 때 저절로 「선행 발동」 (시뮬과 같다 — 시뮬은 지시 때 정한 지령을 그 자리에서 건다).
      횟수는 이미 턴 개시에서 깎였으니 효과만 건다. 4식은 맞을 때 공격 창이 쓰고(버텨라 · 피해라 …), 선행 포텐셜 · 「턴 개시」 4식은 그대로 「포텐셜 발동」에서 */
      {
        const AL = [];
        for (const [mid, x] of Object.entries(I.SEC)) {
          const mm = (b.mons || {})[mid];
          if (!x || !x.command || !mm || !mm.entry || !(+(mm.hp || {}).cur > 0)) continue;
          const tid = mm.tid;
          if (!(b.trainers || {})[tid]) continue;
          const fd = (((ctx().b.cmds || {})[tid] || {}).fired || {})[mid] || {};
          if (fd.command) continue;
          /* 턴 개시 차감 뒤에 넣었거나 차감이 이 지시를 못 읽었으면 fireOrder('pre')가 1 깎고 건다 (11-04 — 예전엔 여기서 따로 깎았다) */
          try {
            await fireOrder(tid, mid, 'command', x.command, 'pre');
            const f2 = (((ctx().b.cmds || {})[tid] || {}).fired || {})[mid] || {};
            if (f2.command) AL.push(`${TN(tid)} · ${mm.name} 『${pName(b, tid, 'command', x.command)}』`);
            else
              AL.push(
                `${TN(tid)} · ${mm.name} 『${pName(b, tid, 'command', x.command)}』 — 걸리지 않았다 (같은 무리 한 턴 하나 · 받을 수 없는 상태 — 「포텐셜 발동」에서 확인)`
              );
          } catch (e) {
            console.warn('지령 자동 발동', e);
          }
        }
        if (AL.length) A().sysLog(`【지령 자동 발동】 선행 입력한 지령 · 영창\n${AL.join('\n')}`, 'battle');
        /* 11-03 21:00 망령 「교대 뒤 선행 포텐셜」 · 「선행 포텐셜도 지령처럼 저절로」 · 「메진 전용을 선행 입력해 둬도 턴 개시에 알려 주지도 발동하지도 않아 깜빡」:
       선행 입력한 포텐셜 중 턴 개시에 쓰는 것(preWhen 'now')은 여기서 저절로 — 전용은 fireSpecial(횟수 · 컷인 · 구문), 메가진화 전용은 폼도 바꾼다, 일반은 「사용」(횟수 −1 · 구문). 조건 때 쓰는 것 · 구문 없는 효과는 이름을 적어 알린다 */
        /* 11-03 21:54: 십계 4식(결계 · 법계 — 명령 칸)과 글에 「턴 개시」가 있는 4식도 선행 입력했으면 여기서 저절로 「선행 발동」 (횟수는 턴 개시에 깎였다). 버텨라! · 피해라! 처럼 맞을 때 쓰는 4식은 그대로 공격 창에서 */
        /* 11-06 망령 「십계는 선행을 안 보여준다」(미사그 캠퍼스 TURN 2 · 시노사와 유이 『특수결계』): 명령 칸 선행은 저절로 걸릴 때만 로그에 나오고,
       「GM 불간섭」 방의 PL 몫 · 맞을 때 쓰는 4식 · 걸리지 않은 것(남은 횟수 · 한 턴 하나 · 받을 수 없는 상태)은 아무 데도 안 떠서 턴 개시에 선행이 없는 것처럼 보였다.
       → 포텐셜과 똑같이 【선행 발동】 목록에 이름 · 할 일을 적고, 남은 것이면 『지령』 & 『포텐셜』 발동 단계도 연다 */
        const MANT = new Set(),
          OMAN = [];
        {
          const OL = [];
          for (const [mid, x] of Object.entries(I.SEC)) {
            const mm = (ctx().b.mons || {})[mid];
            if (!x || !x.order || !mm || !mm.entry || !(+(mm.hp || {}).cur > 0)) continue;
            const tid = mm.tid;
            const t = (ctx().b.trainers || {})[tid];
            if (!t) continue;
            const fd = (((ctx().b.cmds || {})[tid] || {}).fired || {})[mid] || {};
            if (fd.order) continue;
            const on = pName(ctx().b, tid, 'order', x.order);
            const row = potRowOf(on);
            const turnStart = (row && row[0] === '5계') || /결계|법계/.test(on) || TS(row && row[2]) || (!row && TS(rmText(on)));
            if (!turnStart)
              continue; /* 11-06 망령 「버텨라가 선행 입력 때 선행 타이밍에 뜬다 — 뜨면 안 된다」: 턴 개시에 쓰지 않는 4식(맞을 때 공격 창이 쓰는 버텨라! · 피해라! …)은 선행 발동 목록에 올리지 않는다 */
            if (c.fair && seatOwned(c, tid)) {
              OMAN.push(`${TN(tid)} · ${mm.name} 명령 『${on}』 — 주인이 「선행 발동」`);
              MANT.add(tid);
              continue;
            }
            try {
              await fireOrder(tid, mid, 'order', x.order, 'pre');
              const f2 = (((ctx().b.cmds || {})[tid] || {}).fired || {})[mid] || {};
              if (f2.order) OL.push(`${TN(tid)} · ${mm.name} 『${on}』`);
              else {
                OMAN.push(
                  `${TN(tid)} · ${mm.name} 명령 『${on}』 — 걸리지 않았다 (남은 횟수 · 한 턴 하나 · 받을 수 없는 상태 — 「포텐셜 발동」에서 확인)`
                );
                MANT.add(tid);
              }
            } catch (e) {
              console.warn('4식 자동 발동', e);
              OMAN.push(`${TN(tid)} · ${mm.name} 명령 『${on}』 — 저절로 걸다가 멈췄다 (「포텐셜 발동 → 선행 발동」)`);
              MANT.add(tid);
            }
          }
          if (OL.length) A().sysLog(`【명령 자동 발동】 선행 입력한 결계 · 턴 개시 4식\n${OL.join('\n')}`, 'battle');
        }
        /* 11-06 망령 「십계 왜 턴 개시 때 발동 타이밍이 없냐」: 진행하는 화면이 좌석이면(턴 종료를 PL 이 누르면 host 가 그 좌석) 남의 숨긴 지시를 못 읽어 I.SEC 에 없다 —
       그 트레이너가 올린 순서 열쇠(ok.m[mid].pi = 턴 개시에 쓰는 선행 있음)로 알아채고, 저절로 걸지 못했으니 「선행 발동」 단계를 열어 주인에게 맡긴다 */
        {
          const tk = turnKey(ctx().b);
          for (const tid in ctx().b.trainers || {}) {
            const ok = ((ctx().b.cmds || {})[tid] || {}).ok;
            if (!ok || ok.key !== tk) continue;
            for (const mid in ok.m || {}) {
              if (!ok.m[mid].pi || I.SEC[mid]) continue;
              const mm = (ctx().b.mons || {})[mid];
              if (!mm || !mm.entry || !(+(mm.hp || {}).cur > 0)) continue;
              const fd = (((ctx().b.cmds || {})[tid] || {}).fired || {})[mid] || {};
              if (fd.order || fd.command) continue;
              OMAN.push(
                `${TN(tid)} · ${mm.name} — 턴 개시에 쓰는 선행(명령 · 지령 · 포텐셜)이 있다 · 주인이 「포텐셜 발동 → 선행 발동」 (이 화면은 숨긴 지시를 못 읽어 저절로 걸지 못했다)`
              );
              MANT.add(tid);
            }
            /* 11-06 망령 「원래 되던 선행 고유 타이밍이 날아갔다」: 고유 선행(upots)도 숨긴 지시라 못 읽는 화면은 I.UP 이 비어 「발동」 단계에서 그 트레이너를 뺐다 → 순서 열쇠의 ok.pre 로 본다 */
            if (ok.pre && !I.UP[tid]) {
              OMAN.push(`${TN(tid)} — 트레이너 고유 선행이 있다 · 주인이 「포텐셜 발동 → 선행 발동」`);
              MANT.add(tid);
            }
          }
        }
        {
          const PL = [],
            MAN = OMAN;
          for (const [mid, x] of Object.entries(I.SEC)) {
            const mm = (ctx().b.mons || {})[mid];
            if (!x || !(x.pots || []).length || !mm || !mm.entry || !(+(mm.hp || {}).cur > 0)) continue;
            const tid = mm.tid;
            if (!(ctx().b.trainers || {})[tid]) continue;
            for (const pn of x.pots) {
              const fpot = ((((ctx().b.cmds || {})[tid] || {}).fired || {})[mid] || {}).pot || {};
              const cur = (ctx().b.mons || {})[mid] || mm;
              if (preWhen(pn, cur) !== 'now') {
                MAN.push(`${TN(tid)} · ${cur.name} 『${pn}』 — 조건이 되면 「포텐셜 발동 → 선행 발동」`);
                MANT.add(tid);
                continue;
              }
              if (c.fair && seatOwned(c, tid)) {
                MAN.push(`${TN(tid)} · ${cur.name} 『${pn}』 — 주인이 「선행 발동」`);
                MANT.add(tid);
                continue;
              }
              const sp = specialPots(cur).find(q => q.p.name === pn);
              const a = FX() && FX().autoOf(cur, 'pot', pn);
              const auto = !!(a && a.ops && a.ops.length && !a.manual);
              try {
                if (sp) {
                  if (fpot['e:' + pn]) continue;
                  if (sp.left !== null && sp.left <= 0) {
                    MAN.push(`${cur.name} 『${pn}』 — 남은 횟수가 없다`);
                    MANT.add(tid);
                    continue;
                  }
                  await fireSpecial(tid, mid, 'ex', pn, 'pre');
                  const fk = /메가진화/.test(pn + ' ' + (sp.p.eff || ''))
                    ? formsOf((ctx().b.mons || {})[mid] || cur).findIndex(f => f && f.kind === '메가진화')
                    : -1;
                  if (fk >= 0 && !((ctx().b.mons || {})[mid] || {}).form0) await doForm(mid, fk);
                  PL.push(`${cur.name} 『${pn}』${fk >= 0 ? ' → 메가진화' : ''}`);
                  if (fk < 0 && !auto) {
                    MAN.push(`${cur.name} 『${pn}』 — 효과는 손으로`);
                    MANT.add(tid);
                  }
                } else {
                  if (fpot['p:' + pn]) continue;
                  const pl = potList(cur).find(q => q.name === pn);
                  if (pl) {
                    const left = (cur.potUses || {})[pn] == null ? pl.max : +(cur.potUses || {})[pn];
                    if (left <= 0) {
                      MAN.push(`${cur.name} 『${pn}』 — 남은 횟수가 없다`);
                      MANT.add(tid);
                      continue;
                    }
                    await action({ act: 'usepot', mid, pot: pn });
                  } else if (auto) await fireAuto(mid, 'pot', pn, { quiet: true, manual: 1 });
                  else {
                    const src = potSrc(cur).find(q => q && q.name === pn) || {};
                    A().sysLog(`【포텐셜】 ${cur.name} 『${pn}』 【선행】`, 'battle', {
                      mid,
                      img: cur.image || '',
                      eff: String(src.eff || '')
                        .replace(/<br\s*\/?>/g, '\n')
                        .slice(0, 400)
                    });
                  }
                  await A().set(['battle', 'cmds', tid, 'fired', mid, 'pot', 'p:' + pn], 1);
                  PL.push(`${cur.name} 『${pn}』`);
                  if (!auto) {
                    MAN.push(`${cur.name} 『${pn}』 — 효과는 손으로`);
                    MANT.add(tid);
                  }
                }
              } catch (e) {
                console.warn('선행 포텐셜', e);
              }
            }
          }
          if (PL.length || MAN.length)
            A().sysLog(`【선행 발동】${PL.length ? '\n저절로: ' + PL.join(' · ') : ''}${MAN.length ? '\n' + MAN.join('\n') : ''}`, 'battle');
        }
        const rest = tid => {
          const t = (b.trainers || {})[tid];
          if (I.UP[tid] || MANT.has(tid)) return true;
          return Object.entries(I.SEC).some(([mid, x]) => {
            const mm = (b.mons || {})[mid];
            const fo = ((((ctx().b.cmds || {})[tid] || {}).fired || {})[mid] || {}).order;
            return mm && mm.tid === tid && mm.entry && +(mm.hp || {}).cur > 0 && x.order && !fo && preCounts(t, { order: x.order }, mm);
          });
        };
        tids = tids.filter(rest);
      }
      if (tids.length) {
        await A().set(['battle', 'tstep'], 2);
        for (const tid of tids) {
          const t = b.trainers[tid];
          cutFire(
            't:' + tid,
            trainerImg(t),
            '『지령』 & 『포텐셜』 발동',
            t.name,
            t.side === 'left' ? '#1f6fd1' : '#e3101f',
            'You used the Potential!'
          ); /* 10-24 제보: 긴 영문이 큰 글자 칸에서 겹쳤다 — 이름은 크게, 영문은 대사 칸으로 */
        }
        A().sysLog(
          `【『지령』 & 『포텐셜』 발동】\n${tids.map(TN).join(' · ')}\n남은 선행(고유 · 명령 · 조건 때 쓰는 포텐셜)은 「포텐셜 발동」 → 「선행 발동」 (지령 · 턴 개시에 쓰는 선행 포텐셜은 저절로 걸었다 · 놓쳤으면 행동 순서 · 행동 처리 중에도 발동할 수 있다)\n끝나면 「턴 진행 ▶」`,
          'battle'
        );
        return;
      }
    }
    return computeOrder();
  }
  /* 【선행】 포텐셜을 카드에서 쓰려는데 이번 턴 선행 입력이 아니면 묻는다 (11-04 망령). 지시 단계(페이즈 0)엔 카드가 「선행 입력」 버튼이라 여기 오지 않는다 — 시합 전 · 【사전】은 묻지 않는다 */
  async function preGuard(c, m, n) {
    if (!potIsPre(m, n)) return true;
    const b = c.b;
    if (!b.started || (+b.phase || 0) < 1) return true;
    const p = potSrc(m, 1).find(q => q && q.name === n) || {};
    if (/【\s*사전\s*】/.test(String(p.eff || ''))) return true;
    let cm = null;
    try {
      const rows = await DBS().secretGet(c.ST.room, c.ST.secret, 'cmd');
      const r = (rows || []).filter(x => cmdFresh(x, b)).find(x => x.id === m.tid);
      cm = r && r.data;
    } catch (e) {}
    if (cm && (((cm.mons || {})[m.id] || {}).pots || []).includes(n)) return true;
    {
      const ok = ((b.cmds || {})[m.tid] || {}).ok;
      if (!cm && ok && ok.key === turnKey(b) && ok.m && ok.m[m.id] && ok.m[m.id].pi) return true;
    } /* 지시를 못 읽는 화면은 순서 열쇠의 선행 표시로 본다 */
    return await askYes(
      `⚠ 『${n}』 은(는) 【선행】 포텐셜인데 이번 턴에 선행 입력하지 않았다.\n원칙은 지시 단계에서 선행 입력 → 턴 개시 뒤 발동.\n그래도 강제로 발동할까?`,
      '강제 발동',
      '그만'
    );
  }
  /* 11-06 망령 「배틀 비우기 할 때 해당 로그 지울지도 고르게」: 이 배틀 구역(시합 개시 ~ 지금)을 닫고, 고르면 채팅 창에서 숨긴다 (GM 은 rp.logHide, PL 은 자기 pub 칸 — 기록은 남아 GM 이 로그 비우기 창에서 되돌린다) */
  async function clearBattleLog(b) {
    try {
      const ST = A().ST;
      const S = (A().logSecs ? A().logSecs() : []).filter(x => x.k === 'battle');
      let sec = S.length ? S[S.length - 1] : null;
      /* 11-06 망령 「전당 비우기로 지울 때 · 휴대폰에서 고르지를 못한다」: 시합이 끝나 「배틀 종료」로 구역이 이미 닫혔으면 묻지 않고 넘어갔다 — 닫힌 마지막 배틀 구역도 (이미 숨긴 것만 빼고) 묻는다 */
      const H = A().logHides ? A().logHides() : [];
      if (sec && H.some(h => h.a === sec.a)) sec = null;
      let a = sec ? sec.a : 0;
      if (!a && +b.log0 > 0) a = +b.log0 + 1;
      if (!a) return;
      const z = sec && sec.z ? sec.z : +ST.lastLogId || 0;
      if (z < a) return;
      const n = (ST.log || []).filter(r => r.id >= a && r.id <= z).length;
      const hide = await askYes(
        `이 배틀 로그${n ? ` ${n}줄` : ''}도 채팅 창에서 지울까?\n(기록은 남아서 「💾 로그」로 받을 수 있고, GM 이 「로그 비우기」에서 다시 보이게 할 수 있다)`,
        '로그도 지운다',
        '로그는 남긴다'
      );
      if (!(sec && sec.z)) await A().sysLog('배틀을 비웠다', 'sys', { sec: { k: 'battle', op: 'close' } });
      if (hide) {
        if (A().ST.role === 'gm') await A().set(['rp', 'logHide', String(a)], z);
        else if (ST.seat) await A().set(['pub', ST.seat, 'logHide', String(a)], z);
      }
    } catch (e) {
      console.warn('[배틀 로그 구역]', e);
    }
  }
  async function action(d, val) {
    const c = ctx();
    const b = c.b;
    switch (d.act) {
      case 'load':
        return A().openLoadParty(d.side);
      case 'addmon':
        return A().openAddMon(d.side);
      case 'addpick': {
        const md = A().openModal(
          `<div class="mhead"><h2>${SIDE_KO[d.side] || ''} 진영에 추가</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div style="display:flex;flex-direction:column;gap:8px"><button class="btn pri" data-ap="load">+ 파티 <span class="small dim">트레이너 파티를 불러온다</span></button><button class="btn" data-ap="addmon">+ 포켓몬 <span class="small dim">세션 노트 지원 폴더에서 포켓몬만 (도중에도)</span></button></div>`
        );
        md.querySelectorAll('[data-ap]').forEach(
          bt =>
            (bt.onclick = () => {
              A().closeModal();
              if (bt.dataset.ap === 'load') A().openLoadParty(d.side);
              else A().openAddMon(d.side);
            })
        );
        return;
      } /* 11-06 망령: 「+ 파티」 · 「+ 포켓몬」을 하나로 */
      case 'unload':
        return A().unloadTrainer(d.tid);
      case 'clear':
        {
          const HL = window.OM_HALL_UI;
          if (HL && HL.worth(b)) {
            const r = await HL.offer(b, { clear: true });
            if (r === 'cancel') return;
          } else if (!confirm('배틀 상태를 전부 비울까? (좌석은 남는다)')) return;
        }
        /* 10-27 망령: 시합이 있었으면 전당에 남길지 묻는 창이 비우기 확인을 겸한다 */ await clearBattleLog(b);
        CMD = {};
        for (const k in FAINT_SEEN) delete FAINT_SEEN[k];
        /* 11-07 망령 「준비 완료 안 눌렀는데 준비 해제가 뜬다」: 비울 때 준비 표시도 같이 */ return A().setMany([
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
      case 'iv':
        return A().openHatch(d.tid);
      /* 11-03 감우: 제한 시간 · 체크포인트 · 저장 */
      case 'deadline': {
        if (!c.mgr) return;
        const min = Math.max(0, Math.min(180, +val || 0));
        const dl = min > 0 ? Date.now() + min * 60000 : null;
        await A().set(['battle', 'deadline'], dl);
        A().sysLog(
          dl
            ? `지시 입력 제한 시간 ${min}분 — ${new Date(dl).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 까지`
            : '지시 입력 제한 시간 없음',
          'battle'
        );
        return;
      }
      case 'dlgo': {
        if (!c.mgr) return;
        if ((+b.phase || 0) !== 0) return;
        if (!(await askYes('제한 시간이 지났다. 아직 준비 완료가 아닌 자리는 행동 없음으로 두고 턴을 개시할까?', '개시한다', '기다린다'))) return;
        return setPhase(1, { force: true, timeout: true });
      }
      case 'rewind':
        return rewindTurn();
      case 'bsave':
        return saveBattleAs();
      case 'bresume':
        return openResume();
      case 'mode':
        if (c.b.started) {
          A().toast('시합 중에는 에리어를 바꿀 수 없다');
          return A().renderScene();
        }
        return A().set(['battle', 'mode'], +val);
      case 'gmtake': {
        if (!c.gm) return;
        const t = (c.b.trainers || {})[d.tid];
        if (!t) return;
        const on = !t.gmTake;
        await A().set(['battle', 'trainers', d.tid, 'gmTake'], on ? true : null);
        A().sysLog(`${t.name} — ${on ? 'GM 이 맡는다 (빌려쓰기)' : '플레이어에게 돌려줌'}`, 'battle');
        return;
      }
      case 'gmhands': {
        if (!c.gm) return;
        const rp = c.ST.state.rp || {};
        if (rp.gmHands === false) {
          if (
            !(await askYes(
              '방 전체 「GM 불간섭」이 켜져 있어 지금은 모든 GM 이 PL 권한이다.\n이걸 끄고 GM 마다 따로 쓸까? (나는 GM 권한으로 돌아가고, 다른 GM 도 각자 단추로 고른다)',
              'GM 마다 따로',
              '그대로'
            ))
          )
            return;
          await A().set(['rp', 'gmHands'], null);
          A().sysLog('방 설정 「GM 불간섭」 해제 — 이제 PL 권한은 GM 마다 따로', 'battle');
          return;
        }
        const k = gmKeyMe();
        const on = !gmFairMine(rp);
        await A().set(['rp', 'gmFair', k], on ? 1 : null);
        const nk = c.ST.gmNick ? ' (' + c.ST.gmNick + ')' : '';
        A().sysLog(on ? `GM${nk} 이 PL 권한으로 전환 — 플레이어의 지시·상태를 건드리지 않는다 (이 GM 만)` : `GM${nk} GM 권한으로 복귀`, 'battle');
        return;
      } /* 11-14: GM 마다 따로 (방 설정 「GM 불간섭」은 방 전체) */
      case 'areaswap':
        return areaSwap(d.mid);
      case 'field':
        return openField();
      case 'stage':
        return window.OM_STAGE_UI && window.OM_STAGE_UI.info();
      case 'spmgr':
        return window.OM_SP_UI && window.OM_SP_UI.open(d.side || '', d.tid || '');
      case 'sk3one':
        return window.OM_SK3R && window.OM_SK3R.openOne(d.tid);
      case 'cards':
        return (
          window.OM_DECK_UI &&
          window.OM_DECK_UI.battleHand(d.tid, {
            pickAnchor: tid => (window.OM_SP_UI && window.OM_SP_UI.pickAnchorFor ? window.OM_SP_UI.pickAnchorFor(tid) : Promise.resolve(''))
          })
        );
      case 'stagemgr':
        return window.OM_STAGE_UI && window.OM_STAGE_UI.open(d.side || '', d.tid || '');
      case 'orders':
        return openOrders(d.tid);
      case 'co':
        return openCo(d.tid);
      case 'copick': {
        const b = c.b;
        const ids = (((b.sides || {})[d.side] || {}).trainers || []).filter(t => coBtn(c, t));
        const md = A().openModal(
          `<div class="mhead"><h2>함께 지시 — 트레이너 고르기</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="mmenu">${ids.map(t => `<button class="btn" data-cop="${t}">${esc(((b.trainers || {})[t] || {}).name || t)}</button>`).join('')}</div>`
        );
        md.querySelectorAll('[data-cop]').forEach(
          x =>
            (x.onclick = () => {
              A().closeModal();
              openCo(x.dataset.cop);
            })
        );
        return;
      }
      case 'solo':
        return toggleSolo(d.tid);
      case 'dexmgr': {
        if (!(c.gm || ownT(c, d.tid))) return;
        return window.OM_DEX_UI && window.OM_DEX_UI.openMgr(d.tid);
      }
      case 'intel': {
        if (!(c.gm || ownT(c, d.tid))) return;
        const md = A().openModal(
          `<div class="mhead"><h2>해석 · 묘수</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div style="display:flex;flex-direction:column;gap:8px"><button class="btn" data-iq="dex">해석 <span class="small dim">도감 · 데이터 해석</span></button><button class="btn ${myosuGlow(c, d.tid) ? 'pri' : ''}" data-iq="myosu">묘수 <span class="small dim">「타임」 — 상대 지시의 꼴을 엿본다</span></button></div>`
        );
        md.querySelectorAll('[data-iq]').forEach(
          el =>
            (el.onclick = () => {
              A().closeModal();
              if (el.dataset.iq === 'dex') return window.OM_DEX_UI && window.OM_DEX_UI.openMgr(d.tid);
              if (c.mgr || ownT(c, d.tid)) return openMyosu(d.tid);
              A().toast('묘수는 주인 · 진행자만');
            })
        );
        return;
      } /* 11-06 망령 「설정을 발동 옆 · 해석과 묘수는 한 단추로 · 한 줄로」 */
      case 'skillp': {
        if (!(c.mgr || ownT(c, d.tid))) return;
        return openMyosu(d.tid);
      }
      case 'skillck': {
        if (!(c.mgr || ownT(c, d.tid))) return;
        return window.OM_SKILL_UI && window.OM_SKILL_UI.openPlayer(d.tid);
      }
      case 'enter':
        return enterMon(d.mid);
      case 'pend':
        return pendMon(d.mid);
      case 'fxforce': {
        const tid = d.tid;
        if (!tid || !(b.trainers || {})[tid] || !(ownT(c, tid) || (c.gm && !fairOff(c, tid)))) return;
        const on = !!val; /* 11-09 강제 발동 토글 — 그 트레이너 주인 · GM 만 */
        await A().set(['battle', 'trainers', tid, 'forceFx'], on ? true : null);
        A().toast(on ? `「${(b.trainers[tid] || {}).name || ''}」 강제 발동 켬 — 손으로 누르는 발동은 조건 · 확률을 건너뛴다` : '강제 발동 끔');
        return;
      }
      case 'simul': {
        const tid = d.tid;
        if (!tid || !(c.gm || ownT(c, tid)) || !(c.b.trainers || {})[tid]) return;
        /* 10-26 망령: GM 이 켜고 끄면 모든 트레이너가 같이 (한쪽만 켜져 상대 선발이 먼저 공개되던 것) */
        if (c.gm) {
          for (const t of Object.keys(c.b.trainers || {})) await A().set(['battle', 'trainers', t, 'simul'], !!val);
          return;
        }
        return A().set(['battle', 'trainers', tid, 'simul'], !!val);
      }
      case 'pvp': {
        if (!c.mgr) return;
        const on = !b.pvp; /* 11-03 망령 「PVP 설정」: 서로의 도감 정보가 다 공개 — 표시 단계에서만 (dex 해석 기록은 그대로) */
        if (
          !(await askYes(
            on
              ? 'PVP 모드를 켤까?\n양쪽 포켓몬의 도감 정보(타입 · 약점 · 종족치 · 기술 · 특성 · 포텐셜)와 비공개 벤치가 모두에게 공개된다.\n해석 횟수 · 기록은 그대로 — 끄면 해석한 만큼만 보이게 돌아간다'
              : 'PVP 모드를 끌까?\n도감은 다시 해석한 만큼만 보인다 (해석 기록은 그대로)',
            on ? '켠다' : '끈다',
            '그대로'
          ))
        )
          return;
        await A().set(['battle', 'pvp'], on ? true : null);
        A().sysLog(
          on
            ? '【PVP 모드】 양쪽 도감 공개 — 비공개 벤치 · 타입 · 기술 · 특성 · 포텐셜이 해석 없이 전부 보인다'
            : 'PVP 해제 — 도감은 해석한 만큼만 보인다',
          'battle'
        );
        return;
      }
      case 'start':
        return startBattle();
      case 'pendgo':
        return applyPending();
      case 'exit':
        return exitMon(d.mid, { noAsk: true });
      case 'exitx':
        return exitMon(d.mid);
      case 'fswitch':
        return forcedSwitch(d.mid);
      case 'edit':
        return openEdit(d.mid);
      case 'form':
        return openForm(d.mid);
      case 'result':
        return openResult();
      case 'hp':
        return openHp(d.mid);
      case 'pots':
        return openPots(d.mid, d.only);
      case 'autock':
        return openAutoCheck(d.tid);
      case 'fxoff': {
        const m = b.mons[d.mid];
        if (!m || !canEdit(c, m)) return;
        const nm = d.nm || '';
        const all = FX()
          .chips(m)
          .filter(ch => ch.name === nm);
        const compound = nm && all.length > 1;
        if (
          !(await askYes(
            compound ? `「${nm}」 의 효과 ${all.length}개를 모두 해제할까?\n${all.map(x => '· ' + x.t).join('\n')}` : `「${nm}」 효과를 해제할까?`,
            '해제'
          ))
        )
          return; /* 11-03 (검토 13): 진행류는 창 안 확인 */
        const m0 = snap(b.mons[d.mid]);
        const x = snap(m0);
        if (compound) FX().removeByName(x, nm);
        else FX().remove(x, d.fx);
        await saveMon(m0, d.mid, x);
        return A().sysLog(`${m.name} 「${nm}」 해제${compound ? ' (' + all.length + '개)' : ''}`, 'battle');
      }
      case 'announce': {
        const m = b.mons[d.mid];
        if (!m || !canEdit(c, m)) return;
        if (d.kind === 'pot' && d.card && !(await preGuard(c, m, d.pot))) return;
        const [kind, name] = [d.kind, d.pot];
        const src =
          kind === 'trait'
            ? { name: m.ability, eff: m.abilityEff }
            : kind === 'item'
              ? (() => {
                  /* 10-28 망령: 소지품이 여럿이면 누른 칸(이름)의 것을 — 예전엔 늘 1번 칸이 나왔다 */ const nn = x =>
                    String(x || '')
                      .replace(/『|』/g, '')
                      .trim();
                  const x2 = name && nn(name) !== nn(m.item) ? (m.items2 || []).find(x => x && nn(x.item) === nn(name)) : null;
                  if (x2) {
                    const it = ((window.OM_DB || {}).items || {})[nn(x2.item)] || {};
                    return { name: x2.item, eff: x2.itemEff || it.eff || '' };
                  }
                  return { name: m.item, eff: m.itemEff };
                })()
              : potSrc(m).find(p => p && p.name === name) || { name, eff: '' };
        return A().sysLog(`【${{ pot: '포텐셜', trait: '특성', item: '소지품' }[kind]}】 ${m.name} 『${src.name}』`, 'battle', {
          mid: m.id,
          img: m.image || '',
          eff: String(src.eff || '')
            .replace(/<br\s*\/?>/g, '\n')
            .slice(0, 400)
        });
      }
      case 'objects':
        return openObjects(d.side);
      case 'turnset': {
        if (!c.mgr) return;
        const v = prompt('턴 번호', String(b.turn || 0));
        if (v == null) return;
        const n = Math.max(0, parseInt(v, 10) || 0);
        await A().set(['battle', 'turn'], n);
        return A().sysLog(`턴을 ${n}(으)로 맞췄다`, 'battle');
      }
      case 'illu': {
        const m = b.mons[d.mid];
        if (!m || !canEdit(c, m)) return;
        if (!m.entry) return illuPreOpen(m);
        const L = illuCands(b, m);
        const cur = illuOf(b, m);
        const md = A().openModal(
          `<div class="mhead"><h2>🎭 ${esc(m.name)} · 일루젼</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><p class="small" style="margin-top:0">상대 화면에 누구의 모습으로 보일지 골라요. 기술의 대미지를 받으면 풀려요.</p><div class="firelist">${L.map(x => `<label class="firerow ${cur && cur.id === x.id ? 'on' : ''}" data-il="${x.dv || x.id}"><b>${esc(x.name)}</b>${x.fake ? '<span class="small dim">일루젼 폼</span>' : ''}${cur && cur.id === x.id ? '<span class="small dim">지금</span>' : ''}</label>`).join('') || '<div class="small dim">변장할 수 있는 아군(벤치 · 쓰러지지 않음)이 없다</div>'}${cur ? '<label class="firerow" data-il=""><b>변장 풀기</b><span class="small dim">진짜 모습으로 — 로그에 남는다</span></label>' : ''}</div>`
        );
        md.querySelectorAll('[data-il]').forEach(
          el =>
            (el.onclick = async () => {
              const v = el.dataset.il;
              A().closeModal();
              const was = illuOf(ctx().b, m);
              if (!v) {
                if (!was) return;
                await A().set(['battle', 'mons', m.id, 'disg'], null);
                await A().set(['battle', 'mons', m.id, 'seen'], true);
                return A().sysLog(`【일루젼】 「${was.name}」의 정체는 「${m.name}」 — 스스로 변장을 풀었다`, 'battle', {
                  mid: m.id,
                  img: m.image || ''
                });
              }
              await A().set(['battle', 'mons', m.id, 'disg'], v);
              await illuBenchMarks(m.id, v);
              A().toast(`상대 화면에는 「${(illuOf(ctx().b, Object.assign({}, m, { disg: v })) || {}).name || '?'}」(으)로 보여요`);
            })
        );
        return;
      }
      case 'dex': {
        if (!window.OM_DEX_UI) return;
        {
          const v = illuDexOf(c, d.mid);
          if (!v.mid) return A().toast(`「${v.name}」 — 공개된 도감 없음`);
          if (v.mid !== d.mid) d = Object.assign({}, d, { mid: v.mid, asField: !!v.asField });
        }
        /* 11-05 일루젼: 변장 중이면 변장한 아군의 도감 */ const dm = (c.b.mons || {})[d.mid];
        if (plView(c) && dm && !canEdit(c, dm)) {
          const v = gmEyes(c, dm);
          return window.OM_DEX_UI.open(d.mid, v || '_view', true, { asField: !!d.asField });
        }
        return window.OM_DEX_UI.open(d.mid, c.gm ? '' : c.seat || '_view', false, { asField: !!d.asField });
      }
      case 'attack':
        return openAttackPre(d.mid);
      case 'pretoggle': {
        const m = b.mons[d.mid];
        if (!m || !preCardOK(c, m)) return;
        const tid = m.tid;
        let cur = cmdNow(tid, b);
        if (!cur) {
          try {
            const rows = await DBS().secretGet(c.ST.room, c.ST.secret, 'cmd');
            const r = (rows || []).filter(x => cmdFresh(x, b)).find(x => x.id === tid);
            if (r) CMD[tid] = Object.assign({ mons: {}, detail: '', upots: [] }, JSON.parse(JSON.stringify(r.data)), { turn: +b.turn || 0 });
          } catch (e) {} /* 저장해 둔 지시가 있으면 먼저 불러온다 — 빈 지시로 덮어쓰지 않게 */
          cur = cmdNow(tid, b) || (CMD[tid] = { mons: {}, detail: '', upots: [], turn: +b.turn || 0, fresh: 1 });
        }
        cur.mons = cur.mons || {};
        const x = cur.mons[m.id] || (cur.mons[m.id] = { move: '', switch: '', targets: [], prio: {}, ochg: {}, order: '', command: '', pots: [] });
        x.pots = x.pots || [];
        const i = x.pots.indexOf(d.pot);
        if (i >= 0) x.pots.splice(i, 1);
        else x.pots.push(d.pot);
        await saveCmd(tid, true);
        A().toast(i >= 0 ? `『${d.pot}』 선행 입력을 뺐다` : `${m.name} 『${d.pot}』 선행 입력 — 턴 개시 뒤 발동`);
        rerenderCmd();
        A().renderScene();
        return;
      }
      case 'usepot':
      case 'restorepot': {
        const m = b.mons[d.mid];
        if (!m || !canEdit(c, m)) return;
        if (d.act === 'usepot' && d.card && !(await preGuard(c, m, d.pot))) return;
        if (d.act === 'usepot') {
          const r = potRest(m, d.pot);
          if (r && !d.auto) return A().toast(r.title);
          await potMark(d.mid, d.pot);
        }
        const L = potList(m);
        const p = L.find(x => x.name === d.pot);
        if (!p) return;
        const u = Object.assign({}, m.potUses || {});
        const cur = u[p.name] == null ? p.max : +u[p.name];
        u[p.name] = d.act === 'usepot' ? Math.max(0, cur - 1) : Math.min(p.max, cur + 1);
        if (d.act === 'usepot' && wantCut(m, p.name))
          cutFire('m:' + m.id, m.image, m.name, `『${p.name}』`, m.side === 'left' ? '#1f6fd1' : '#e3101f');
        {
          const fu = (((ctx().b || {}).mons || {})[d.mid] || {}).potUses || {};
          const ops = [];
          for (const k of new Set([...Object.keys(m.potUses || {}), ...Object.keys(u)])) {
            if (jeq((m.potUses || {})[k], u[k])) continue;
            const was = (m.potUses || {})[k],
              now = u[k];
            const d0 = now == null || was == null ? null : +now - +was;
            ops.push([
              ['battle', 'mons', d.mid, 'potUses', k],
              d0 == null ? (now == null ? null : now) : Math.max(0, (fu[k] == null ? +was : +fu[k]) + d0)
            ]);
          }
          if (ops.length) await A().setMany(ops);
        } /* 11-05: 바뀐 포텐셜 칸만 · 차이만 */
        if (d.act === 'usepot') {
          /* 횟수를 깎으면서 효과 글을 카드로 띄운다 (자동화가 있으면 그 카드가 대신 뜬다) */
          const fired = FX() ? await fireAuto(d.mid, 'pot', p.name, { quiet: true, manual: 1 }) : false;
          if (fired) A().sysLog(`${m.name} 『${p.name}』 남은 ${u[p.name]}/${p.max}`, 'battle');
          else {
            const src = potSrc(m).find(x => x && x.name === p.name) || {};
            A().sysLog(`【포텐셜】 ${m.name} 『${p.name}』\n사용 — 남은 ${u[p.name]}/${p.max}`, 'battle', {
              mid: m.id,
              img: m.image || '',
              eff: String(src.eff || '')
                .replace(/<br\s*\/?>/g, '\n')
                .slice(0, 400)
            });
          }
        } else A().sysLog(`${m.name} 『${p.name}』 횟수 +1 (남은 ${u[p.name]}/${p.max})`, 'battle');
        return;
      }
      case 'fireauto': {
        const m = b.mons[d.mid];
        if (!m || !canEdit(c, m)) return;
        if (syncLock(b, m, slotEff(m, d.kind, d.pot))) return A().toast('【동조】 — 필드에 같은 『역할』 대치가 없다');
        if (d.kind === 'pot' && d.card && !(await preGuard(c, m, d.pot))) return;
        if (d.kind === 'pot') {
          const r = potRest(m, d.pot);
          if (r) return A().toast(r.title);
          await potMark(d.mid, d.pot);
        }
        if (d.kind === 'pot' && wantCut(m, d.pot)) cutFire('m:' + m.id, m.image, m.name, `『${d.pot}』`, m.side === 'left' ? '#1f6fd1' : '#e3101f');
        return fireAuto(d.mid, d.kind, d.pot);
      }
      case 'time':
        return c.mgr ? requestTime(d.mid) : openMyosu(c.seat, d.mid);
      case 'myosu':
        return openMyosu(d.tid);
      case 'stx': {
        if (!stxOk(c, d.tid)) return;
        return window.OM_STATUS_UI && window.OM_STATUS_UI.open(d.tid);
      } /* 10-27 망령: 현황 창 */
      case 'timeok':
        return grantTime(d.seat);
      case 'cmdsave':
        return saveCmd(d.tid, false);
      case 'ufire':
        return openUfire(d.tid, d.pot);
      case 'usaj':
        return fireSpecial(d.tid, null, 'uq', d.pot, 'free'); /* 11-11 두 단계 고유 ① 【사전】 */
      case 'upretoggle': {
        const tid = d.tid;
        if (!(b.trainers || {})[tid] || !preTrOK(c, tid)) return;
        let cur = cmdNow(tid, b);
        if (!cur) {
          try {
            const rows = await DBS().secretGet(c.ST.room, c.ST.secret, 'cmd');
            const r = (rows || []).filter(x => cmdFresh(x, b)).find(x => x.id === tid);
            if (r) CMD[tid] = Object.assign({ mons: {}, detail: '', upots: [] }, JSON.parse(JSON.stringify(r.data)), { turn: +b.turn || 0 });
          } catch (e) {}
          cur = cmdNow(tid, b) || (CMD[tid] = { mons: {}, detail: '', upots: [], turn: +b.turn || 0, fresh: 1 });
        }
        cur.upots = cur.upots || [];
        const i = cur.upots.indexOf(d.pot);
        if (i >= 0) cur.upots.splice(i, 1);
        else cur.upots.push(d.pot);
        await saveCmd(tid, true);
        A().toast(i >= 0 ? `고유 『${d.pot}』 선행 입력을 뺐다` : `고유 『${d.pot}』 선행 입력 — 턴 개시 뒤 「포텐셜 발동 → 선행 발동」`);
        rerenderCmd();
        A().renderScene();
        return;
      }
      case 'ready':
        return toggleReady(d.tid);
      case 'cmdload':
        return loadCmd(d.tid);
      case 'reveal':
        return reveal();
      case 'order':
        return computeOrder();
      case 'progress':
        return progressTurn();
      case 'edone':
      case 'efire':
      case 'eskip':
        return endAct(d.act, d);
      case 'turnstart': {
        await A().set(['ready'], {});
        await A().set(['battle', 'cmds'], {});
        await A().set(['battle', 'phase'], 1);
        A().sysLog('턴 개시 — 각자 지시를 공개하세요 (에리어마다 「공개」)', 'battle');
        return;
      }
      case 'revealmon':
        return revealOne(d.tid, d.mid);
      case 'fire':
        return openFire(d.tid);
      case 'onext': {
        {
          const O0 = c.b.order || [];
          const cur = O0[+c.b.orderIdx || 0];
          if ((+c.b.phase || 0) === 3 && cur && cur.mid)
            try {
              await deferFire(cur.mid, '자신의 행동이 끝나서', 'act');
            } catch (e) {
              console.warn('defer', e);
            }
        } /* 11-09 미룬 대미지: 차례가 넘어가면 */
        {
          const O1 = c.b.order || [];
          const X1 = O1[+c.b.orderIdx || 0];
          const xm = X1 && (c.b.mons || {})[X1.mid];
          if (
            (+c.b.phase || 0) === 3 &&
            X1 &&
            X1.xact &&
            !X1.doneX &&
            xm &&
            xm.entry &&
            xm.hp.cur > 0 &&
            !(await askYes(
              `${X1.name}의 추가 행동 — 『${X1.xact}』 「${X1.move || '?'}」을(를) 아직 안 했다.\n(${X1.name} 카드의 「공격」을 누르면 그 기술로 열린다)\n\n그래도 넘길까?`,
              '넘긴다',
              '기다린다'
            ))
          )
            return;
        } /* 11-11 망령 「드래곤옐 추가 행동 — 표시창엔 넣어 놓고 차례가 되니 넘겨버린다」: 추가 행동 차례를 공격 없이 넘기려 하면 묻는다 */
        const O = c.b.order || [];
        let n = Math.min(O.length, (+c.b.orderIdx || 0) + 1);
        const skipped = [],
          outSk = []; /* 11-10 「교대로 물러난 포켓몬도 『쓰러져 있어』로 뜬다」: 살아 있는데 필드에 없으면 따로 */
        /* 10-26 망령: 쓰러졌거나 필드에 없는 포켓몬의 차례는 건너뛴다 */
        const a1 = [];
        while (n < O.length) {
          const om = (c.b.mons || {})[O[n].mid];
          if (om && om.entry && om.hp.cur > 0) {
            const na = !O[n].change && misagA1(c.b, om);
            if (!na) break;
            a1.push(`${O[n].name} — ${na}`);
            n++;
            continue;
          }
          if (!O[n].change) (om && om.hp.cur > 0 ? outSk : skipped).push(O[n].name);
          n++;
        } /* 11-01 망령: 각성체 대가 A-1 행동 불능은 차례를 건너뛴다 (그때 필드로 다시 본다) */
        for (const l of a1) A().sysLog(l + ' (차례를 건너뛴다)', 'battle');
        if (skipped.length) A().sysLog(`${skipped.join(' · ')} — 쓰러져 있어 차례를 건너뛴다`, 'battle');
        if (outSk.length) A().sysLog(`${outSk.join(' · ')} — 필드에 없어(교대로 물러남) 차례를 건너뛴다`, 'battle');
        await A().set(['battle', 'orderIdx'], n);
        if ((+c.b.phase || 0) === 2) await A().set(['battle', 'phase'], 3);
        if (n < (c.b.order || []).length) {
          const On = c.b.order[n];
          A().sysLog(
            On.xact
              ? `▶ ${On.name}의 추가 행동 — 『${On.xact}』 「${On.move || '?'}」 (카드의 「공격」을 누르면 그 기술로 열린다)`
              : `▶ ${On.name}의 행동`,
            'battle'
          );
        } else {
          if ((+c.b.orderIdx || 0) < n) A().sysLog('행동 순서 끝 — 턴 종료 처리', 'battle');
          if (c.b.endq && c.b.endq.step) return endFlow();
          if (await askYes('행동이 모두 끝났다. 턴 마무리(턴 가장 마지막 → 턴 종료 → 턴 종료 이후)로 갈까?')) await endFlow();
        }
        return;
      }
      case 'oprev': {
        await A().set(['battle', 'orderIdx'], Math.max(0, (+c.b.orderIdx || 0) - 1));
        return;
      }
      case 'ojump': {
        if (!c.mgr) return;
        await A().set(['battle', 'orderIdx'], +d.i);
        return;
      }
      case 'oresort':
        return resortOrder();
      case 'turnend':
        return endFlow();
      case 'resetcmd':
        if (!confirm('공개된 지시와 준비 상태를 지울까?')) return;
        CMD = {};
        await A().set(['battle', 'cmds'], {});
        await A().set(['ready'], {});
        return;
    }
  }

  /* 등장: 더블(2:2)이 기본. 트레이너가 둘이면 첫 트레이너 A, 둘째 B 가 기본 자리. 빈 자리가 아니면 고른다. */
  /* 에리어 교대: 같은 편의 다른 에리어로 자리만 옮긴다(교체 아님 — 랭크·상태 그대로). 그 자리에 있던 포켓몬은 내 자리로 */
  async function areaSwap(mid, to) {
    const c = ctx();
    const b = c.b;
    const m = b.mons[mid];
    if (!m || !m.entry || !canEdit(c, m)) return;
    const areas = AREAS.slice(0, mode(b)).filter(a => a !== m.entry);
    if (!areas.length) return;
    const ent = entered(b, m.side);
    if (!to) {
      if (areas.length === 1) to = areas[0];
      else {
        const md = A()
          .openModal(`<div class="mhead"><h2>${esc(m.name)} 에리어 교대</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="small dim" style="margin-bottom:8px">지금 ${String(m.entry).toUpperCase()} — 옮길 자리를 고른다. 있던 포켓몬은 ${String(m.entry).toUpperCase()} 로 온다.</div>
    <div class="row">${areas.map(a => `<button class="btn pri" data-area="${a}">${a.toUpperCase()}${ent[a] ? ' · ' + esc(ent[a].name) + ' 와 자리 바꿈' : ' · 빈 자리'}</button>`).join('')}</div>`);
        md.querySelectorAll('[data-area]').forEach(
          bt =>
            (bt.onclick = () => {
              A().closeModal();
              areaSwap(mid, bt.dataset.area);
            })
        );
        return;
      }
    }
    const from = m.entry;
    const occ = ent[to];
    const other = occ || Object.values(b.mons || {}).find(x => x.side === m.side && x.entry === to && x.id !== mid);
    /* 11-19 망령 「에리어를 이동할 수 없게 되는 "고정" 상태변화」: 고정(AreaLock)이면 에리어를 이동할 수 없다 — 고정인 포켓몬과 자리를 바꾸는 것도. GM 은 확인하고 옮길 수 있다 */
    {
      const lk = [m, other].filter(x => x && (x.states || {}).AreaLock);
      if (lk.length) {
        const why = lk.map(x => `${x.name} 「고정」`).join(' · ');
        if (!(c.gm && (await askYes(`${why} — 에리어를 이동할 수 없다.\nGM 판단으로 그래도 옮길까?`, '옮긴다', '그만')))) {
          A().sysLog(`${m.name} 에리어 이동 실패 — ${why}`, 'battle', { mid });
          return;
        }
      }
    }
    await A().set(['battle', 'mons', mid, 'entry'], to);
    if (other) await A().set(['battle', 'mons', other.id, 'entry'], from);
    A().sysLog(
      `${m.name} 에리어 교대 ${from.toUpperCase()} → ${to.toUpperCase()}${other ? ` · ${other.name} → ${from.toUpperCase()}` : ''}`,
      'battle'
    );
    if (b.started) {
      const T = +b.turn || 0;
      await A().set(['battle', 'mons', mid, 'areaT'], T);
      if (other) await A().set(['battle', 'mons', other.id, 'areaT'], T);
      try {
        await areaMovedAuto(mid);
        if (other) await areaMovedAuto(other.id);
      } catch (e) {
        console.warn('areaMovedAuto', e);
      }
    }
  }
  /* 11-14 망령 「에리어 이동했을 때는 자동화 만들어야지 · 보법술도 · 위력 강화 무시도」:
    에리어 교대(기술 「에리어 이동」 · 카드 단추)로 자리를 옮긴 포켓몬에 m.areaT = 그 턴. 교대로 들어온 것은 에리어 이동이 아니다(표시 없음). 자리를 바꿔 준 쪽도 이동한 것(11-14 17:41 망령 「둘 다 이동한 거긴 해」).
    ① 옮긴 포켓몬의 「에리어를 이동한 턴 …」 포텐셜(보법술: 턴 종료까지 회피 ×1.33)은 저절로 건다 — 구문이 있고 【N/시】 없는 것 · 【탈진】 은 지난 턴에 썼으면 안 건다
    ② 「에리어를 이동한 턴 아군이 상대의 「전체기」의 위력 강화를 무시한다」: 그 포텐셜을 가진 포켓몬의 아군(자신 제외 — 자신 포함은 「아군 전체」로 적힌다)이 이번 턴에 에리어를 옮겼으면,
       상대의 전체기에 맞을 때 공격 쪽의 도구 · 특성 · 포텐셜 위력 강화(×1 초과)를 끈다 — 줄인 배율(×1 미만)은 그대로 */
  /* 11-15 「『X』가 발동했을 때 「태그」 기술에 의한 추가 행동」(【보급】 등 횟수): 그 태그 기술 중 하나 — 「자세」면 다음 「거합」 기술 타입이 상대에게 가장 잘 드는 자세 (바로 전 자세는 뺌 · 연속 제한) */
  const XACT_RE = /『\s*([^』]+?)\s*』\s*(?:이|가)\s*발동했을\s*때\s*「\s*([^」]+?)\s*」\s*기술에\s*의한\s*추가\s*행동/;
  async function stanceXact(mid, trig) {
    try {
      const b = ctx().b;
      const m = (b.mons || {})[mid];
      if (!m || !m.entry || !(m.hp && m.hp.cur > 0)) return null;
      const T = +b.turn || 0;
      for (const p of potSrc(m)) {
        const e = String((p && p.eff) || '');
        const x = e.match(XACT_RE);
        if (
          !x ||
          x[1].trim() !==
            String(trig || '')
              .replace(/[『』]/g, '')
              .trim()
        )
          continue;
        const L = limOf(p, m.potUses || {}, m.potTurn || {});
        if (L.left !== null && L.left <= 0) continue;
        const tag = x[2].trim();
        const MV = MVS(m);
        const re = new RegExp('(^|[,\\s])' + tag + '($|[,\\s])');
        const cands = MV.map((mv, i) => ({ mv, i })).filter(
          o => o.mv && (re.test(String(o.mv.tag || '')) || o.mv.name === tag) && !sealed(m, o.mv) && m.stance !== o.mv.name
        );
        if (!cands.length) continue;
        const foes = Object.values(b.mons || {}).filter(f => f && f.entry && f.hp && f.hp.cur > 0 && !sameT(f, m, b));
        const iaiMv = MV.some(mv => mv && mv.cat !== '변화' && /(^|[,\s])거합($|[,\s])/.test(String(mv.tag || '')));
        let best = null,
          bv = -1;
        for (const o of cands) {
          const ty = (moveAuto(o.mv) || {}).iai;
          let v = 0.5;
          if (ty && iaiMv && foes.length)
            v = Math.max(
              ...foes.map(f => {
                try {
                  return +B().effectiveness([ty], { types: tysOf(f) }).value || 1;
                } catch (_) {
                  return 1;
                }
              })
            );
          if (v > bv) {
            bv = v;
            best = o;
          }
        }
        if (!best) continue;
        if (L.mmax != null) {
          const u = (m.potUses || {})[p.name];
          await A().set(['battle', 'mons', mid, 'potUses', p.name], Math.max(0, (u == null ? L.mmax : +u) - 1));
        }
        if (L.per) await A().set(['battle', 'mons', mid, 'potTurn', p.name], T);
        if (L.sup) await A().set(['battle', 'mons', mid, 'potTurn', '_sup', p.name], 1);
        return { i: best.i, mv: best.mv, p: p.name };
      }
    } catch (e) {
      console.warn('stanceXact', e);
    }
    return null;
  }
  /* 11-22 망령: ① 「「잠듦」 상태일 때 아군의 「소리」 기술에 뒤이어 「소리」 기술을 내보낸다」 — 같은 편이 그 기술을 낸 직후, 행동 순서 바로 다음 칸에 추가 행동(콤비네이션).
    조건 상태(잠듦 …)는 그 추가 행동에선 판정하지 않고 줄이지도 않는다(잠든 채로 낸다). 뒤이은 기술에는 다시 뒤잇지 않는다 · 한 턴에 한 번 · 【N/시】 · 【보급】은 stanceXact 처럼 쓴다.
    ② 「자신의 「X」 상태가 턴 경과로 인해 해제되지 않는다」 — 그 상태의 턴 카운트를 아예 줄이지 않는다(행동 판정 · 행동 뒤 · 턴 종료 모두) */
  const COMBO_RE =
    /(?:「([^」]+)」\s*상태일\s*때\s*,?\s*)?아군(?:의|이\s*내보낸)\s*「([^」]+)」\s*기술에\s*뒤이어\s*,?\s*(?:자신(?:의|도)\s*)?「([^」]+)」\s*기술을\s*내보낸다/;
  const KEEPST_RE =
    /「([^」]+)」\s*상태(?:가|는)?\s*턴\s*(?:경과|진행)\s*(?:로|에)?\s*(?:인해|의해|따라)?\s*(?:해제되지|풀리지|감소하지|줄어들지)\s*않/g;
  function stKeyOf(ko) {
    const sdb = (DB().states || {}).st || {};
    ko = String(ko || '').trim();
    if (sdb[ko]) return ko;
    for (const k in sdb) if (sdb[k] && sdb[k].ko === ko) return k;
    return null;
  }
  function mvTagHit(mv, t) {
    if (!mv) return false;
    t = String(t || '').trim();
    const re = new RegExp('(^|[,\\s])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[,\\s])');
    return re.test(String(mv.tag || '')) || mv.name === t;
  }
  function potLive(m, p) {
    try {
      return !(potOffWhy(m, p.name) || misagBlock(ctx().b, m, p.name));
    } catch (e) {
      return true;
    }
  }
  function keepSt(m) {
    const out = [];
    if (!m) return out;
    try {
      const L = [
        ...potSrc(m)
          .filter(p => potLive(m, p))
          .map(p => p.eff),
        m.abilityEff
      ];
      for (const e of L)
        for (const x of String(e || '')
          .replace(/<br\s*\/?>/g, '\n')
          .matchAll(KEEPST_RE)) {
          const k = stKeyOf(x[1]);
          if (k && !out.includes(k)) out.push(k);
        }
    } catch (e) {
      console.warn('keepSt', e);
    }
    return out;
  }
  /* 11-26 07:59 망령 「(추가 공격은) 자신이 공격한 직후」: 포텐셜 글 「(저|중|고)확률로 (기술) 「X」에 의한 추가 공격을 행한다」(루포 『벨로네 패밀리』) —
     자신의 공격 기술을 적용한 직후 한 번 굴리고, 성공하면 그 자리에서 「X」 공격 창을 연다. 새 장치를 만들지 않고 있던 구문 「기술사용 X」를 그 계기에 태운다 (시트에 구문이 있으면 그 구문).
     · 한 행동(턴 · 순서 칸)에 포텐셜마다 한 번 — 추가 공격으로 한 공격에는 다시 붙지 않는다
     · 다른 계기나 주어가 붙은 마디(「~했을 때 추가 공격」 · 「아군이 … 추가 공격」)는 여기서 보지 않는다 (앤 보니&메리 리드 · 은 『암부닌의 지원』) */
  const XATK_RE = /(?:(저|중|고)\s*확률로\s*)?(?:기술\s*)?「\s*([^」]+?)\s*」\s*에\s*의한\s*추가\s*공격을\s*(?:행한다|한다|내보낸다|얻는다)/;
  const XATK_DONE = {};
  async function extraAtkAfter(mid, R) {
    try {
      if (!R || R.check || !R.mv || R.mv.cat === '변화' || !FX()) return;
      const b = ctx().b;
      const a = (b.mons || {})[mid];
      if (!a || !a.entry || !(a.hp && a.hp.cur > 0)) return;
      for (const p of potSrc(a)) {
        if (!p || !p.name || !potLive(a, p)) continue;
        const cl = String(p.eff || '')
          .replace(/<br\s*\/?>/g, '\n')
          .split(/(?=[①②③④⑤⑥⑦⑧⑨])|\n/)
          .find(x => XATK_RE.test(x));
        if (!cl) continue;
        const x = cl.match(XATK_RE);
        if (/때|아군(?:이|가)/.test(cl.slice(0, x.index))) continue;
        const k = [String(b.started), +b.turn || 0, +b.orderIdx || 0, mid, p.name].join('|');
        if (XATK_DONE[k]) continue;
        XATK_DONE[k] = 1;
        const L = limOf(p, a.potUses || {}, a.potTurn || {});
        if (L.left !== null && L.left <= 0) continue;
        const own = FX().autoOf(a, 'pot', p.name);
        const au =
          own && own.ops && own.ops.length && !own.manual
            ? own
            : (() => {
                const P = FX().parse(`${x[1] ? x[1] + '확률: ' : ''}기술사용 ${x[2]}`);
                return P && P.ops && P.ops.length ? { name: p.name, ops: P.ops, text: cl } : null;
              })();
        if (!au) continue;
        const ok = await fireAuto(mid, 'pot', p.name, {
          auto: au,
          quiet: true,
          head: `【포텐셜】 ${a.name} 『${p.name}』 — 공격한 직후 · 추가 공격`
        });
        if (ok) await potMark(mid, p.name);
      }
    } catch (e) {
      console.warn('extraAtk', e);
    }
  }
  async function comboXact(mid, R) {
    try {
      if (!R || R.check || !R.mv) return;
      const b = ctx().b;
      const a = (b.mons || {})[mid];
      if (!a) return;
      const ON = (+b.phase || 0) >= 2 && (b.order || []).length;
      const XO = ON ? (b.order || [])[+b.orderIdx || 0] : null;
      if (XO && XO.combo) return;
      const T = +b.turn || 0;
      const hits = [];
      for (const m of Object.values(b.mons || {})) {
        if (!m || m.id === mid || m.side !== a.side || !m.entry || !(m.hp && m.hp.cur > 0)) continue;
        for (const p of potSrc(m)) {
          const x = String((p && p.eff) || '')
            .replace(/<br\s*\/?>/g, '\n')
            .match(COMBO_RE);
          if (!x || !potLive(m, p)) continue;
          const sk = x[1] ? stKeyOf(x[1]) : '';
          if (x[1] && (!sk || !(m.states || {})[sk])) continue;
          if (!mvTagHit(R.mv, x[2])) continue;
          const L = limOf(p, m.potUses || {}, m.potTurn || {});
          if (L.left !== null && L.left <= 0) continue;
          const k2 = m.id + '|combo|' + p.name;
          if (ACTFX[k2] === T) continue;
          const cands = MVS(m).filter(mv => mvTagHit(mv, x[3]) && !sealed(m, mv));
          if (!cands.length) continue;
          const pn = String(p.name).replace(/[『』]/g, '');
          let mv = cands[0];
          if (cands.length > 1) {
            const r = await uiCtx(b, m, pn).choose(cands.map(v => v.name));
            mv = cands[r && r.length ? +r[0] : 0] || mv;
          }
          ACTFX[k2] = T;
          if (L.mmax != null) {
            const u = (m.potUses || {})[p.name];
            await A().set(['battle', 'mons', m.id, 'potUses', p.name], Math.max(0, (u == null ? L.mmax : +u) - 1));
          }
          if (L.per) await A().set(['battle', 'mons', m.id, 'potTurn', p.name], T);
          if (L.sup) await A().set(['battle', 'mons', m.id, 'potTurn', '_sup', p.name], 1);
          hits.push({ m, p, pn, mv, sk, trig: x[2] });
          break;
        }
      }
      /* 11-22 망령 「특성 엔진 처리」 — 무희: 다른 포켓몬(어느 편이든)이 「춤」 기술을 내보냈을 때 같은 기술을 내보낸다 (바로 다음 칸 추가 행동 · 따라 춘 춤에는 다시 따라 추지 않는다) */
      if (mvTagHit(R.mv, '춤'))
        for (const m of Object.values(b.mons || {})) {
          if (!m || m.id === mid || !m.entry || !(m.hp && m.hp.cur > 0) || abNm(m) !== '무희') continue;
          const k2 = m.id + '|dancer|' + mid + '|' + R.mv.name;
          if (ACTFX[k2] === T) continue;
          ACTFX[k2] = T;
          hits.push({ m, p: { name: '특성 : 무희' }, pn: '무희', mv: { name: R.mv.name }, sk: '', trig: '춤', dancer: 1 });
        }
      if (!hits.length) return;
      const b2 = ctx().b;
      const ord = (b2.order || []).slice();
      let idx = +b2.orderIdx || 0;
      for (const h of hits) {
        const stN = h.sk ? `「${(((DB().states || {}).st || {})[h.sk] || {}).ko || h.sk}」 상태로 ` : '';
        if (ON) {
          ord.splice(++idx, 0, {
            slot: slotOf(h.m.side, h.m.entry),
            mid: h.m.id,
            name: h.m.name,
            side: h.m.side,
            change: false,
            started: false,
            order: -1000,
            prio: 0,
            speed: 0,
            dice: 0,
            move: h.mv.name,
            targets: [],
            pursuit: false,
            xact: h.p.name,
            combo: 1,
            skipSt: h.sk || ''
          });
          A().sysLog(
            `${h.dancer ? `【특성】 ${h.m.name} 「무희」` : `【포텐셜】 ${h.m.name} 『${h.pn}』`} — ${a.name}의 「${R.mv.name}」에 뒤이어 ${stN}「${h.mv.name}」 (다음 차례 · 추가 행동)`,
            'battle',
            { mid: h.m.id, img: h.m.image || '' }
          );
        } else
          A().sysLog(
            `${h.dancer ? `【특성】 ${h.m.name} 「무희」` : `【포텐셜】 ${h.m.name} 『${h.pn}』`} — ${a.name}의 「${R.mv.name}」에 뒤이어 ${stN}「${h.mv.name}」를 내보낸다 (행동 순서 밖이라 직접 공격 창에서)`,
            'battle',
            { mid: h.m.id, img: h.m.image || '' }
          );
      }
      if (ON) await A().set(['battle', 'order'], ord);
    } catch (e) {
      console.warn('comboXact', e);
    }
  }
  const RX_AMV = /에리어를\s*이동한\s*턴/;
  const RX_AIGN = /에리어를\s*이동한\s*턴[^\n/]*?아군이\s*(?:상대의\s*)?「?\s*전체기\s*」?의\s*위력\s*강화를\s*무시/;
  function movedNow(b, m) {
    return !!(b && b.started && m && m.areaT != null && +m.areaT === (+b.turn || 0));
  }
  function isSpreadMv(mv) {
    return !!mv && /전체|자신\s*이외/.test(String(mv.range || '')) && mv.cat !== '변화';
  }
  function areaBoostIgn(b, atk, def, mv) {
    if (!b || !atk || !def || atk.side === def.side || !isSpreadMv(mv) || !movedNow(b, def)) return null;
    for (const mm of Object.values(b.mons || {})) {
      if (!mm || mm.id === def.id || mm.side !== def.side || !mm.entry || !(mm.hp && mm.hp.cur > 0)) continue;
      const p = potSrc(mm).find(q => q && RX_AIGN.test(String(q.eff || '')));
      if (!p) continue;
      try {
        if (potOffWhy(mm, p.name) || misagBlock(b, mm, p.name)) continue;
      } catch (e) {}
      return { who: mm, name: p.name };
    }
    return null;
  }
  /* 공격 쪽 위력 강화(×1 초과)만 빼고 다시 곱한다 — attackMods 의 names(공격 쪽 「이름」 ×v)에서 읽는다 */
  function boostOff(mods, atk, ig, def) {
    const keep = [],
      drop = [];
    let v = 1;
    for (const x of mods.names || []) {
      const mm = x && x.who === atk.id && String(x.txt || '').match(/ ×([\d.]+)$/);
      if (!mm) {
        keep.push(x);
        continue;
      }
      const k = +mm[1];
      if (k > 1) drop.push(x);
      else {
        v *= k;
        keep.push(x);
      }
    }
    keep.push({
      key: ig.key || '_aign',
      who: def.id,
      txt: `${def.name} — ${ig.who.name} 『${ig.name}』: ${ig.why || '에리어를 이동한 턴, 상대 「전체기」의 위력 강화(도구 · 특성 · 포텐셜) 무시'}${drop.length ? ' · 끈 것 ' + drop.map(x => String(x.txt).replace(atk.name + ' ', '')).join(', ') : ''}`
    });
    return Object.assign({}, mods, { boost: Math.round(v * 1000) / 1000, names: keep });
  }
  /* 11-26 05:14 망령 「【방호】/「타입 : 불꽃, 물」이 내보낸 기술의 위력 강화를 무시한다」(R-ACE 프리벤터 ①): 맞는 쪽 포텐셜 — 때리는 쪽 타입이 그중 하나면
    그 기술의 위력 강화(도구 · 특성 · 포텐셜 · 역할의 ×1 초과)를 끈다. 타입 일치(자속) 보정은 이 묶음 밖이라 그대로 · 줄인 배율(×1 미만)도 그대로
    11-26 4차: 조건 꼴을 표(DBIGN)로 — 한 줄에 글 꼴(re) · 때리는 쪽이 맞는지(ok) · 로그 글(why). 새 조건은 여기에 한 줄.
    「타입 : X」이 내보낸 기술 (프리벤터) · 「X」 상태인 상대의 기술 (「봉인」 상태인 상대의 기술의 위력 강화를 무시) */
  const DBIGN_TAIL = '기술의\\s*위력\\s*강화를\\s*무시';
  const DBIGN = [
    {
      re: new RegExp('「\\s*타입\\s*:\\s*([^」]+?)\\s*」\\s*(?:이|가|인\\s*포켓몬이)\\s*내보낸\\s*' + DBIGN_TAIL),
      ok: (x, atk) => {
        const aT = tysOf(atk).map(t => String(S().typeKo ? S().typeKo(t) : t));
        return x[1]
          .split(/[,/·、\s]+/)
          .map(t => t.trim())
          .filter(Boolean)
          .some(t => aT.includes(t));
      },
      why: x =>
        `「타입 : ${x[1]
          .split(/[,/·、\s]+/)
          .map(t => t.trim())
          .filter(Boolean)
          .join(', ')}」이 내보낸 기술의 위력 강화(도구 · 특성 · 포텐셜) 무시`
    },
    {
      re: new RegExp('「\\s*([^」:]+?)\\s*」\\s*상태인\\s*(?:상대|포켓몬)(?:의|(?:이|가)\\s*내보낸)\\s*' + DBIGN_TAIL),
      ok: (x, atk) => {
        const k = stKeyOf(x[1]);
        return !!(k && (atk.states || {})[k]);
      },
      why: x => `「${x[1]}」 상태인 상대의 기술의 위력 강화(도구 · 특성 · 포텐셜) 무시`
    }
  ];
  function defBoostIgn(b, atk, def) {
    try {
      if (!atk || !def || atk.id === def.id || atk.side === def.side) return null;
      for (const p of potSrc(def)) {
        const e = String((p && p.eff) || '');
        for (const R of DBIGN) {
          const x = e.match(R.re);
          if (!x || !R.ok(x, atk)) continue;
          try {
            if (potOffWhy(def, p.name) || misagBlock(b, def, p.name)) break;
          } catch (_) {}
          return { who: def, name: String(p.name || '').replace(/[『』]/g, ''), key: '_tbign', why: R.why(x) };
        }
      }
    } catch (e) {}
    return null;
  }
  async function areaMovedAuto(mid) {
    const b = ctx().b;
    const m = (b.mons || {})[mid];
    if (!m || !m.entry || !(m.hp && m.hp.cur > 0) || !FX()) return;
    for (const p of potSrc(m)) {
      const e = String((p && p.eff) || '');
      if (!p || !p.name || !RX_AMV.test(e) || RX_AIGN.test(e)) continue;
      const au = FX().autoOf(m, 'pot', p.name);
      if (!au || !au.ops || !au.ops.length || au.manual || limManual(m, 'pot', p.name, e)) continue;
      const cur = (ctx().b.mons || {})[mid] || m;
      const L = limOf(p, cur.potUses || {}, cur.potTurn || {});
      if (L.left !== null && L.left <= 0) {
        A().sysLog(
          `【포텐셜】 ${m.name} 『${p.name}』 — 에리어를 이동했지만 ${L.per === 'tal' ? '【탈진】(지난 턴에 썼다)' : L.per === 'turn' ? '【소진】(이번 턴에 썼다)' : '다 썼다'}라 발동하지 않는다`,
          'battle',
          { mid, img: m.image || '' }
        );
        continue;
      }
      const ok = await fireAuto(mid, 'pot', p.name, {
        quiet: true,
        noRoll: true,
        head: `【포텐셜】 ${m.name} 『${p.name}』 — 에리어를 이동한 턴 자동`
      });
      if (ok) await potMark(mid, p.name);
    }
    /* 11-15 망령 「에리어 이동 해야지」: 「【1/시】/에리어를 이동했을 때 아군 전체의 『닌자』를 발동시킬 수 있다」(카자마 레비 『질투의 아카이브』) — 필드의 같은 편 중 그 포텐셜(임명 포함)이 켜진 포켓몬마다 바로 발동 · 횟수 −1 · 「행동한 뒤」 계기는 이번 턴 다시 안 건다 */
    for (const p of potSrc((ctx().b.mons || {})[mid] || m)) {
      const e = String((p && p.eff) || '');
      const mm = e.match(/에리어를\s*이동했을\s*때\s*아군\s*전체의\s*『\s*([^』]+?)\s*』\s*(?:을|를)\s*발동/);
      if (!mm) continue;
      const cur = (ctx().b.mons || {})[mid] || m;
      const L = limOf(p, cur.potUses || {}, cur.potTurn || {});
      if (L.left !== null && L.left <= 0) continue;
      const b1 = ctx().b;
      const T = +b1.turn || 0;
      const tg = Object.values(b1.mons || {}).filter(
        x => x && x.entry && x.hp && x.hp.cur > 0 && sameT(x, cur, b1) && potSrc(x).some(q => q && q.name === mm[1].trim())
      );
      if (!tg.length) continue;
      if (/할\s*수\s*있다/.test(e)) {
        const q = `${cur.name} 『${p.name}』 — 에리어를 이동했다. 아군 ${tg.map(x => x.name).join(' · ')}의 『${mm[1]}』을(를) 발동할까?`;
        if (!(await remoteAsk(cur, 'confirm', { name: p.name, q }, () => askYes(q, '발동', '그만둔다')))) continue;
      }
      if (L.mmax != null) {
        const u = (cur.potUses || {})[p.name];
        await A().set(['battle', 'mons', mid, 'potUses', p.name], Math.max(0, (u == null ? L.mmax : +u) - 1));
      }
      if (L.per) await A().set(['battle', 'mons', mid, 'potTurn', p.name], T);
      A().sysLog(`【포텐셜】 ${cur.name} 『${p.name}』 — 에리어를 이동해 아군 전체의 『${mm[1]}』 발동`, 'battle', { mid, img: cur.image || '' });
      for (const x of tg) {
        ACTFX[x.id + '|' + mm[1].trim()] = T;
        await fireAuto(x.id, 'pot', mm[1].trim(), {
          quiet: true,
          noRoll: true,
          noEv: 1,
          head: `【포텐셜】 ${x.name} 『${mm[1].trim()}』 — 『${p.name}』`
        });
      }
    }
  }
  async function enterMon(mid, area, opt) {
    opt = opt || {};
    const c = ctx();
    const b = c.b;
    const m = b.mons[mid];
    if (!m || !(canEdit(c, m) || (opt.sys && c.mgr))) return;
    const ent = entered(b, m.side);
    const areas = AREAS.slice(0, mode(b));
    if (!area && (+b.tstep || 0) >= 1) {
      /* 10-27 망령: 교대 단계면 이 포켓몬과 바꾸기로 한 (교대 지시) 포켓몬의 자리로 — 빈 자리가 있어도 그쪽으로 새지 않게 */ const outs = (
        b.swOut || []
      )
        .map(id => (b.mons || {})[id])
        .filter(o => o && o.tid === m.tid && o.side === m.side && o.entry && o.id !== mid);
      const want = outs.find(o => ((((b.cmds || {})[o.tid] || {}).mons || {})[o.id] || {}).switch === mid) || (outs.length === 1 ? outs[0] : null);
      if (want) area = want.entry;
    }
    const OKA = okAreas(b, m);
    if (!area) {
      const tids = (((b.sides || {})[m.side] || {}).trainers || []).filter(x => x !== '__swap__');
      const pref = areas[Math.min(Math.max(0, tids.indexOf(m.tid)), areas.length - 1)] || areas[0];
      const free = OKA.filter(a => !ent[a]);
      if (!OKA.length) return A().toast('낼 수 있는 자리가 없다 — 트레이너마다 필드 1칸 (짝 트레이너가 전멸하면 그 빈 칸에 낼 수 있다)');
      if (areas.length === 1) area = areas[0];
      else if (!ent[pref] && OKA.includes(pref)) area = pref;
      else if (free.length) area = free[0];
      else {
        const md = A()
          .openModal(`<div class="mhead"><h2>${esc(m.name)} 등장 — 에리어</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
     ${OKA.length < areas.length ? '<div class="small dim" style="margin-bottom:8px">트레이너마다 필드 1칸 — 자기 포켓몬과만 교대 (짝 트레이너가 전멸하면 그 빈 칸에도 낼 수 있다)</div>' : ''}<div class="row">${OKA.map(a => `<button class="btn ${ent[a] ? 'ghost' : 'pri'}" data-area="${a}">${a.toUpperCase()}${ent[a] ? ' · ' + esc(ent[a].name) + ' 과 교대' : ' · 빈 자리'}</button>`).join('')}</div>`);
        md.querySelectorAll('[data-area]').forEach(
          bt =>
            (bt.onclick = () => {
              A().closeModal();
              enterMon(mid, bt.dataset.area, opt);
            })
        );
        return;
      }
    }
    if (!areas.includes(area)) return A().toast('그런 에리어가 없다');
    if (!opt.sys && !opt.forced && !OKA.includes(area))
      return A().toast(`${area.toUpperCase()} 에는 못 나온다 — 트레이너마다 필드 1칸 (짝 트레이너가 전멸하면 그 빈 칸에 낼 수 있다)`);
    const occ = ent[area];
    let XL = null;
    if (occ && occ.id !== mid) {
      const pup = abNm(m) === '인형술사' && occ.hp && occ.hp.cur > 0 && passable(occ);
      /* 11-22 인형술사: 자신이 포함된 교대에 「바톤」 효과 — 들어오는 쪽이 인형술사면 나가는 포켓몬의 랭크 · 넘길 수 있는 상태를 받는다 */ XL =
        await exitMon(occ.id, { forced: !!opt.forced, noAsk: !!opt.noAsk || pup, sys: !!opt.sys, quiet: true, batton: pup, puppet: pup ? 'in' : '' });
    }
    const swIn =
      occ && occ.id !== mid
        ? (b.swOut || []).includes(occ.id)
        : (+b.tstep || 0) >= 1 &&
          opt.how !== '죽어내밀기' &&
          (b.swOut || []).some(id => {
            const o = (b.mons || {})[id];
            return o && id !== mid && o.tid === m.tid && !o.entry && o.outA === area;
          }); /* 10-27 망령: 동시 죽어내밀기 — 같은 트레이너가 교대도 했으면, 쓰러진 자리로 나온 포켓몬까지 교대 등장이 됐다. 교대로 빠진 바로 그 자리로 나올 때만 */ /* 10-27 망령: 교대하는 포켓몬을 먼저 「퇴장」시키고 빈 자리로 「등장」하면 occ 가 없어 교대 등장으로 안 잡혀, 행동 순서에 들어가 행동했다 — 교대 단계(tstep 1)에 같은 트레이너의 교대 포켓몬이 빠져 있으면 교대 등장 */
    const started =
      (+b.phase || 0) === 1 &&
      !(b.order || []).length &&
      !swIn; /* 10-23 망령: 턴 개시 뒤 · 순서 계산 전에 나온 포켓몬(죽어내밀기 · 동시 내밀기 · 윤회)은 그 턴 순서에 들어간다. 그 밖엔 */ /* 턴 도중(교대 · 빈사 교체)에 들어온 포켓몬은 「교대 등장」 — 그 턴엔 지시가 없다. 턴 개시 때 필드에 있던 포켓몬만 setPhase(1) 이 started 로 바꾼다 */
    await A().set(['battle', 'mons', mid, 'entry'], area);
    {
      const faintRep = opt.how === '죽어내밀기' || !occ || (occ.id !== mid && occ.hp && occ.hp.cur <= 0);
      const T0 = +b.turn || 0;
      const nextT = b.started && faintRep && (+b.phase || 0) >= 2;
      await A().set(['battle', 'mons', mid, 'inT'], nextT ? T0 + 1 : Math.max(1, T0));
      await A().set(['battle', 'mons', mid, 'inSw'], b.started && T0 > 0 && !nextT ? 1 : null);
    }
    /* 11-07 inSw: 이 턴 도중 교대로 나왔다 (가속 — 나온 턴 종료엔 발동 안 함) */ /* 10-26 망령: 죽어내밀기는 다음 턴이 1턴째 — 턴 도중 · 턴 끝에 빈 자리(쓰러진 자리)로 나오면 다음 턴부터 센다 */ await A().set(
      ['battle', 'mons', mid, 'started'],
      started
    );
    /* inT: 필드에 나온 턴 (【지연】 셈 — 나온 턴이 1턴째) */ if (m.lastMove) await A().set(['battle', 'mons', mid, 'lastMove'], null);
    if (m.metro) await A().set(['battle', 'mons', mid, 'metro'], null);
    /* 11-06 스케치: 새로 나오면 마지막 기술 기록을 비운다 */ let DSG = null;
    const illuPre = hasIllu(m) ? illuPreOf(b, m) : null; /* 11-26 등장 전에 정해 둔 모습 */
    if (illuPre) {
      DSG = illuPre === 'none' ? null : illuPre.dv || illuPre.id;
      await A().set(['battle', 'mons', mid, 'disg'], DSG);
    } else if (hasIllu(m)) {
      const fk = illuFk(m);
      let it = fk >= 0 ? null : illuPick(b, m);
      if (fk < 0 && it) {
        const fn = illuTextBy(m, ILLU_FREE_RE);
        if (fn) {
          const L = Object.values(b.mons || {})
            .filter(x => x && x.tid === m.tid && x.id !== m.id && x.hp && x.hp.cur > 0 && !x.entry && x.id !== mid)
            .sort((x, y) => (x.slot || 0) - (y.slot || 0));
          if (L.length > 1) {
            const ch = await illuChoose(m, L, fn);
            if (ch) it = ch;
          }
        }
      }
      DSG = fk >= 0 ? '@f' + fk : it ? it.id : null;
      await A().set(['battle', 'mons', mid, 'disg'], DSG);
    } else if (m.disg) await A().set(['battle', 'mons', mid, 'disg'], null);
    /* 11-05 일루젼 */ if (!m.seen && !DSG) await A().set(['battle', 'mons', mid, 'seen'], true);
    await illuBenchMarks(mid, DSG);
    if (m.pend) await A().set(['battle', 'mons', mid, 'pend'], null);
    /* 11-20 23:04 망령 「지시 전에 죽어내밀기로 짝이 서면 패널티가 아니잖아 — 한 번 행동 불능 상태가 걸리면 교대하던가 움직일 수 없어야지」:
     11-13 에 넣었던 「지시 전에 아군이 서면 A-1 잠금 해제」를 뺐다. 턴 종료 때 걸린 A-1 은 그 다음 턴 내내 간다 (교대는 된다) */
    const EL = await entryLines(mid);
    try {
      await shootIn(mid);
    } catch (e) {
      console.warn('shootIn', e);
    }
    {
      /* 10-27 망령: 교대면 나가는 포켓몬 ⇄ 들어오는 포켓몬을 그림과 함께 한 장으로 (먼저 「퇴장」하고 빈 자리로 나온 교대도) */
      const outM =
        occ && occ.id !== mid
          ? occ
          : swIn
            ? (b.swOut || [])
                .map(id => (b.mons || {})[id])
                .find(
                  o => o && o.tid === m.tid && !o.entry && o.id !== mid && ((((b.cmds || {})[o.tid] || {}).mons || {})[o.id] || {}).switch === mid
                ) || (b.swOut || []).map(id => (b.mons || {})[id]).find(o => o && o.tid === m.tid && !o.entry && o.id !== mid)
            : null;
      const XLL = Array.isArray(XL) ? XL : [];
      if (outM) {
        const tn = ((b.trainers || {})[m.tid] || {}).name || '';
        const head = `【교대】 ${outM.name} ⇄ ${m.name} (${SIDE_KO[m.side]} ${area.toUpperCase()})`;
        A().sysLog(`${head}${XLL.length || EL.length ? '\n' + [...XLL, ...EL].join('\n') : ''}`, 'battle', {
          mid,
          img: m.image || '',
          rv: [
            {
              tr: tn,
              mid: outM.id,
              name: outM.name,
              img: outM.image || '',
              side: m.side,
              area: area.toUpperCase(),
              sw: { name: m.name, img: m.image || '', done: 1 }
            }
          ],
          rvx: [...XLL, ...EL]
        });
      } else {
        if (XLL.length) A().sysLog(`${occ.name} ${opt.forced ? '강제 퇴장' : '퇴장'}\n${XLL.join('\n')}`, 'battle');
        A().sysLog(`${m.name} 등장 (${SIDE_KO[m.side]} ${area.toUpperCase()})${EL.length ? '\n' + EL.join('\n') : ''}`, 'battle');
      }
    }
    /* 배턴터치 받기 */
    {
      const nb0 = snap(),
        nb = snap(nb0);
      const t = nb.trainers[m.tid];
      if (t && t.batton && t.batton.from !== m.name) {
        const L = applyBatton(nb, nb.mons[mid]);
        await saveMon(nb0.mons[mid], mid, nb.mons[mid]);
        await A().set(['battle', 'trainers', m.tid, 'batton'], null);
        if (L.length) A().sysLog(L.join('\n'), 'battle');
        stLog(nb0.mons[mid], nb.mons[mid], { n: t.batton.from || '', s: '배턴터치' }, 300);
      }
    } /* 11-01 망령 「상태 변화도 효과 로그」: 넘겨받은 상태도 카드로 */
    /* 11-09 감우 56: 교대로 나간 포켓몬의 【퇴장】 (들어온 아군 · 정면을 고른다) / 빈자리로 나왔으면 그 자리를 떠난 아군이 미뤄 둔 줄 */
    if (ctx().b.started && (ctx().b.mons[mid] || {}).entry && !opt.noExit) {
      try {
        if (occ && occ.id !== mid && occ.hp && occ.hp.cur > 0 && Array.isArray(XL))
          await exitTrig(occ.id, opt.forced ? '강제 교대' : opt.how === '임의 교대' ? '임의 교대' : '통상 교대', { phase: 'all', inId: mid, area });
        else await exitPendIn(mid);
      } catch (e) {
        console.warn('퇴장 계기', e);
      }
    }
    /* 설치기 (맵툴 hazard_eval): 등장한 쪽의 설치기를 평가한다 */
    if (F()) {
      const nb0 = snap(),
        nb = snap(nb0);
      const nm = nb.mons[mid];
      nm.entry = area;
      const f = fieldOf(nb);
      const oppSide = m.side === 'left' ? 'right' : 'left';
      const opp = entered(nb, oppSide);
      let HLD = [];
      try {
        HLD = await fieldHoldInto(nb, nm);
      } catch (e) {
        console.warn('필드 동안 (등장 전)', e);
      }
      const r = F().hazardsOnEntry(nm, f, opp);
      if (HLD.length) r.lines.unshift(...HLD);
      if (r.lines.length) {
        if (nm.hp.cur <= 0) {
          nm.entry = '';
          r.lines.push(`${nm.name}은(는) 쓰러졌다!`);
        } else if (r.forced) {
          nm.entry = '';
          r.lines.push(`${nm.name}은(는) 튕겨 나갔다 — 다른 포켓몬을 내보내야 한다`);
        }
        await saveBattle(nb0, nb, f);
        A().sysLog(`설치기 처리\n${r.lines.join('\n')}`, 'battle');
      }
    }
    /* 10-26 (서서 VS 마리 시험): 필드의 다른 포켓몬이 「있는 한」 걸어 둔 효과(재앙의그릇 · 승리의별 …)를 새로 들어온 포켓몬에게도 */
    if (FX() && FX().reAura && ctx().b.started && (ctx().b.mons[mid] || {}).entry) {
      const nb0 = snap(),
        nb = snap(nb0);
      const L = FX().reAura(nb, nb.mons[mid]);
      if (L.length && (await saveBattle(nb0, nb))) A().sysLog(`【필드 효과】\n${L.join('\n')}`, 'battle');
    }
    try {
      await auraLate(mid);
    } catch (e) {
      console.warn('auraLate', e);
    }
    /* 10-26 망령: 시합 개시 전에 나온 포켓몬 · 동시 내밀기는 모두 나온 뒤에 등장 효과를 스피드 순으로 (위협이 아무도 못 맞히던 것) */
    if (FX() && (ctx().b.mons[mid] || {}).entry && !opt.noAuto && ctx().b.started) {
      await autoOnEntry(mid, {
        how: opt.how || (opt.forced ? '강제 교대' : occ && occ.id !== mid ? '통상 교대' : (+b.phase || 0) >= 2 ? '통상 교대' : '죽어내밀기')
      });
      try {
        await fieldAuto('entry', { mid });
      } catch (e) {
        console.warn('필드 등장 구문', e);
      }
      try {
        await illuTrig(mid);
      } catch (e) {
        console.warn('일루젼 발동 계기', e);
      }
      try {
        await foeInTrig(
          mid,
          null,
          opt.how || (opt.forced ? '강제 교대' : occ && occ.id !== mid ? '통상 교대' : (+b.phase || 0) >= 2 ? '통상 교대' : '죽어내밀기')
        );
      } catch (e) {
        console.warn('등장 (상대)', e);
      }
    }
  }
  /* 11-14 동시 교대: 모두 나가고 모두 들어온 뒤 퇴장 계기 → 등장 효과 (각각 스피드 순) */
  async function simulSwitch(L) {
    const b0 = ctx().b;
    const f = fieldOf(b0);
    const sp = m => {
      try {
        return B().statValue(m, 'speed').value * spMulOf(m, f).v;
      } catch (e) {
        return +((m.stats || [])[5] || 0);
      }
    };
    const outs = L.map(x => ({ x, m: b0.mons[x.out] }))
      .filter(o => o.m)
      .sort((p, q) => sp(q.m) - sp(p.m));
    A().sysLog(
      `【동시 교대】 ${L.map(x => `${(b0.mons[x.out] || {}).name || '?'} ⇄ ${(b0.mons[x.in] || {}).name || '?'}`).join(' · ')}\n모두 나가고 들어온 뒤 퇴장 → 등장 순서로 처리한다`,
      'battle'
    );
    for (const x of L) {
      await enterMon(x.in, x.area, { sys: true, noAuto: true, noExit: true, noAsk: true, how: '통상 교대' });
    }
    for (const o of outs) {
      const inM = ctx().b.mons[o.x.in];
      if (!inM || !inM.entry) continue;
      const om = ctx().b.mons[o.x.out];
      if (!om || !om.hp || om.hp.cur <= 0) continue;
      try {
        await exitTrig(o.x.out, '통상 교대', { phase: 'all', inId: o.x.in, area: inM.entry });
      } catch (e) {
        console.warn('동시 교대 퇴장', e);
      }
    }
    const hw = {};
    for (const x of L) hw[x.in] = '통상 교대';
    await autoEntryAll(
      L.map(x => x.in),
      hw
    );
  }
  async function autoEntryAll(ids, hows) {
    const b = ctx().b;
    const f = fieldOf(b);
    const sp = m => {
      try {
        return B().statValue(m, 'speed').value * spMulOf(m, f).v;
      } catch (e) {
        return +((m.stats || [])[5] || 0);
      }
    };
    const list = ids
      .map(id => b.mons[id])
      .filter(m => m && m.entry && m.hp.cur > 0)
      .sort((x, y) => sp(y) - sp(x));
    for (const m of list)
      if (FX()) {
        await autoOnEntry(m.id, hows && hows[m.id] ? { how: hows[m.id] } : undefined);
        try {
          await fieldAuto('entry', { mid: m.id });
        } catch (e) {
          console.warn('필드 등장 구문', e);
        }
      }
    for (const m of list)
      if (FX())
        try {
          await illuTrig(m.id);
        } catch (e) {
          console.warn('일루젼 발동 계기', e);
        } /* 11-22 선발로 변장한 채 나온 것도 */
    {
      const tog = list.map(m => m.id);
      for (const m of list)
        if (FX())
          try {
            await foeInTrig(m.id, tog);
          } catch (e) {
            console.warn('등장 (상대)', e);
          }
    }
  } /* 11-09 감우 56: 모두 나온 뒤 【등장 (상대)】 — 같이 나온 것끼리는 불발 (망령 13:51) */
  /* 10-23 망령: 맵툴 print_entry — 등장하면 「통솔」 명중 강화 → 특성 등장 문구 → 소지품 등장 문구 (data/ment.js, 맵툴 entry_ment 그대로) */
  const LEAD_ACC = { A: 1.05, AA: 1.15, AAA: 1.25, S: 1.33 };
  /* 「통솔」 명중 보정: 랭크 · 배율(mod)에 넣지 않고 공격 창 「명중 배율」 기본값으로 곱한다 (10-24 망령) */
  function leadAcc(m) {
    const t = m && (ctx().b.trainers || {})[m.tid];
    return (t && LEAD_ACC[S().strip((t.ranks || {})['통솔'])]) || 1;
  }
  function josa(w, p) {
    const s = String(w || '').replace(/[」』)\]\s]+$/, '');
    const ch = s.charCodeAt(s.length - 1);
    let has = false,
      ri = false;
    if (ch >= 0xac00 && ch <= 0xd7a3) {
      const j = (ch - 0xac00) % 28;
      has = j > 0;
      ri = j === 8;
    } else if (/[0-9]$/.test(s)) {
      has = '013678'.includes(s.slice(-1));
      ri = '178'.includes(s.slice(-1));
    } else if (/[a-z]$/i.test(s)) {
      has = /[lmnbkpt]$/i.test(s);
      ri = /l$/i.test(s);
    }
    const P = { 은는: ['은', '는'], 이가: ['이', '가'], 을를: ['을', '를'], 와과: ['과', '와'], 으로로: ['으로', '로'] }[p];
    return p === '으로로' ? (has && !ri ? P[0] : P[1]) : has ? P[0] : P[1];
  }
  function mentText(t, nm, tg) {
    let s = String(t || '')
      .replace(/\{이름\}/g, nm)
      .replace(/\{대상\}/g, tg || '');
    for (const p of ['은는', '이가', '을를', '으로로', '와과']) s = s.split('{' + p + '}').join(josa(nm, p));
    const i = s.indexOf('@');
    return i < 0 ? s : s.slice(0, i) + (s.slice(i + 1).trim() ? ' (' + s.slice(i + 1).trim() + ')' : '');
  }
  const mentKey = n => String(n || '').replace(/『|』|\s/g, '');
  /* 11-19 망령 「특성 : 사출 같은 거 자동화 돼 있던가?」 (사출 ①「필드 위에 있는 한 아군이 【등장】/다음 기술을 내보낼 때 「스피드」를 강화(1.33배)한다」):
    필드에 있는 같은 편(자신 제외)의 특성 · 포텐셜 글에 이 꼴이 있으면, 나온 포켓몬에게 그 배율을 걸고 m.mvMod 에 적어 둔다 → 그 포켓몬이 기술을 내면(공격 창 저장) 푼다 · 교대로 빠지면 outReset 이 배율째 지운다 */
  const SHOOT_RE = /아군이\s*【등장】\s*\/?\s*다음\s*기술을\s*내보낼\s*때\s*「([^」]+)」\s*(?:을|를)\s*강화\s*\(\s*(\d+(?:\.\d+)?)\s*배\s*\)/;
  const STK = {
    '공격': 'attack',
    '방어': 'defense',
    '특공': 'specialattack',
    '특방': 'specialdefense',
    '스피드': 'speed',
    '명중': 'accuracy',
    '회피': 'evasion'
  };
  async function shootIn(mid) {
    const b = ctx().b;
    const me = (b.mons || {})[mid];
    if (!me || !me.entry) return;
    const add = {},
      src = [];
    for (const x of Object.values(b.mons || {})) {
      if (!x || x.id === mid || !x.entry || !(x.hp && x.hp.cur > 0) || x.side !== me.side) continue;
      const T = [];
      if (x.ability && !(x.states || {}).TraitBroken) T.push([String(x.ability).replace(/『|』/g, ''), slotEff(x, 'trait', x.ability)]);
      try {
        for (const p of potSrc(x)) if (p && p.eff) T.push([p.name, p.eff]);
      } catch (e) {}
      for (const [nm, t] of T) {
        const r = String(t || '')
          .replace(/<br\s*\/?>/g, ' ')
          .match(SHOOT_RE);
        if (!r) continue;
        const k = STK[r[1].trim()];
        const v = +r[2];
        if (!k || !(v > 0)) continue;
        add[k] = (add[k] || 1) * v;
        src.push(`${x.name} 「${nm}」 ${r[1].trim()} ×${v}`);
      }
    }
    if (!src.length) return;
    const mod = Object.assign({}, me.mod || {}),
      mv = Object.assign({}, (me.mvMod || {}).st || {});
    for (const k in add) {
      mod[k] = Math.round((+mod[k] || 1) * add[k] * 1000) / 1000;
      mv[k] = Math.round((+mv[k] || 1) * add[k] * 1000) / 1000;
    }
    await A().set(['battle', 'mons', mid, 'mod'], mod);
    await A().set(['battle', 'mons', mid, 'mvMod'], { st: mv, src: src.join(' · ') });
    A().sysLog(`${me.name} — ${src.join(' · ')} (다음 기술을 낼 때까지)`, 'battle', { mid });
  }
  function shootOff(m, lines) {
    if (!m || !m.mvMod) return;
    const st = m.mvMod.st || {};
    m.mod = m.mod || {};
    for (const k in st) {
      m.mod[k] = Math.round(((+m.mod[k] || 1) / (+st[k] || 1)) * 1000) / 1000;
      if (Math.abs(m.mod[k] - 1) < 0.002) delete m.mod[k];
    }
    if (lines) lines.push(`${m.name} 기술을 냈다 — ${m.mvMod.src} 끝`);
    delete m.mvMod;
  }
  async function entryLines(mid) {
    const b = ctx().b;
    const m = b.mons[mid];
    const L = [];
    if (!m) return L;
    const t = (b.trainers || {})[m.tid];
    const MT = DB().ment || {};
    const la = leadAcc(m);
    /* 10-24 망령: 「통솔」 명중 강화 문구는 로그에 쓰지 않는다 (공격 창 명중 배율 칸에 자동) */
    const tm = (MT.trait || {})[mentKey(m.ability)];
    if (m.ability && tm) L.push(mentText(tm, m.name, m.ability));
    for (const it of [m.item, ...(m.items2 || []).map(x => x && x.item)]) {
      const x = it && (MT.item || {})[mentKey(it)];
      if (x) L.push(mentText(x, m.name, it));
    }
    return L;
  }
  /* 동시 내밀기: 주인이 예약(pend)해 두고, GM 의 「시합 개시」·「내밀기 실행」 때 한꺼번에 등장 (상대는 예약을 못 본다) */
  async function pendMon(mid, area) {
    const c = ctx();
    const b = c.b;
    const m = b.mons[mid];
    if (!m || !canEdit(c, m)) return;
    const tnm = ((b.trainers || {})[m.tid] || {}).name || SIDE_KO[m.side];
    const cnt = () => {
      const nb = ctx().b;
      const L = pendCount(nb, 'left'),
        R = pendCount(nb, 'right');
      return `좌 ${L.n}/${L.need} · 우 ${R.n}/${R.need}`;
    };
    if (m.pend) {
      const was = m.pend;
      await A().set(['battle', 'mons', mid, 'pend'], null);
      A().sysLog(`${tnm} — 에리어 ${String(was).toUpperCase()} 내밀기 예약 취소 (${cnt()})`, 'battle');
      return;
    }
    const areas0 = AREAS.slice(0, mode(b));
    const areas = okAreas(b, m);
    const taken = Object.values(b.mons)
      .filter(x => x.side === m.side && x.id !== m.id && x.pend)
      .map(x => x.pend);
    const ent = entered(b, m.side);
    if (!areas.length) return A().toast('예약할 자리가 없다 — 트레이너마다 필드 1칸 (짝 트레이너가 전멸하면 그 빈 칸에 낼 수 있다)');
    if (area && !areas.includes(area)) return A().toast(`${String(area).toUpperCase()} 에는 예약 못 한다 — 트레이너마다 필드 1칸`);
    if (!area) {
      const free = areas.filter(a => !taken.includes(a));
      if (areas0.length === 1) area = areas0[0];
      else if (free.length === 1 && areas.every(a => taken.includes(a) || a === free[0])) area = free[0];
      else {
        const md = A().openModal(
          `<div class="mhead"><h2>${esc(m.name)} 내밀기 예약 — 에리어</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="row">${areas.map(a => `<button class="btn ${taken.includes(a) ? 'ghost' : 'pri'}" data-area="${a}">${a.toUpperCase()}${taken.includes(a) ? ' · 이미 예약' : ent[a] ? ' · ' + esc(ent[a].name) + ' 과 교대' : ' · 빈 자리'}</button>`).join('')}</div>`
        );
        md.querySelectorAll('[data-area]').forEach(
          bt =>
            (bt.onclick = () => {
              A().closeModal();
              pendMon(mid, bt.dataset.area);
            })
        );
        return;
      }
    }
    await A().set(['battle', 'mons', mid, 'pend'], area);
    A().sysLog(`${tnm} — 에리어 ${area.toUpperCase()} 내밀기 예약 ✓ (누가 나올지는 실행 때까지 비밀 · ${cnt()})`, 'battle');
    A().toast(`${m.name} 내밀기 예약 (${area.toUpperCase()}) — ${c.mgr ? '「시합 개시」나 「내밀기 실행」을 누르면' : 'GM 이 실행하면'} 나온다`);
    const nb = ctx().b;
    const L = pendCount(nb, 'left'),
      R = pendCount(nb, 'right');
    if (L.need > 0 && R.need > 0 && L.n >= L.need && R.n >= R.need)
      A().sysLog(`양쪽 내밀기 예약 완료 — GM 「${nb.started ? '내밀기 실행' : '시합 개시'}」`, 'battle');
  }
  async function applyPending() {
    const c = ctx();
    if (!c.mgr) return 0;
    const b = c.b;
    const list = Object.values(b.mons || {}).filter(m => m.pend && m.hp.cur > 0);
    if (!list.length) return 0;
    A().sysLog('동시 내밀기!', 'battle');
    const ids = list.map(m => m.id);
    const hows = {};
    for (const m of list)
      hows[m.id] = Object.values(b.mons || {}).some(q => q.id !== m.id && q.side === m.side && q.entry === m.pend && q.hp && q.hp.cur > 0)
        ? '통상 교대'
        : '죽어내밀기';
    for (const { id, pend } of list.map(m => ({ id: m.id, pend: m.pend }))) {
      await enterMon(id, pend, { sys: true, noAuto: true });
    }
    if (ctx().b.started) await autoEntryAll(ids, hows);
    return list.length;
  } /* pend 는 enterMon 이 지운다 — 먼저 지우면 set 의 낙관적 반영으로 m.pend 가 사라져 예약 에리어를 잃는다 */
  async function startBattle() {
    const c = ctx();
    if (!c.mgr) return;
    const b = c.b;
    if (b.started) return;
    for (const k in FAINT_SEEN) delete FAINT_SEEN[k];
    if (simAny(b)) {
      const n = await applyPending();
      if (!n && !Object.values(b.mons || {}).some(m => m.entry)) {
        if (!(await askYes('예약된 포켓몬이 없다. 그래도 시합을 개시할까?'))) return;
      }
    }
    for (const tid of Object.keys(b.trainers || {})) if ((b.trainers[tid] || {}).time) await A().set(['battle', 'trainers', tid, 'time'], null);
    for (const x of Object.values(b.mons || {})) if (x && x.tstop) await A().set(['battle', 'mons', x.id, 'tstop'], null);
    await A().set(['battle', 'exitPend'], null); /* 11-09 감우 56: 지난 배틀의 미뤄 둔 퇴장 줄 */
    await A().set(['battle', 'started'], true);
    if (b.done) await A().set(['battle', 'done'], null); /* 10-31: 던전으로 돌아온(done) 배틀을 다시 열면 살아 있는 배틀 */
    if (!(+b.turn || 0)) await A().set(['battle', 'turn'], 1);
    await A().set(['battle', 'log0'], +A().ST.lastLogId || 0);
    await A().set(['battle', 'at0'], Date.now()); /* log0 · at0: 전당의 간략 로그를 여기서부터 (hall_ui.js) */
    {
      const ids0 = Object.values(ctx().b.mons || {})
        .filter(m => m.entry)
        .map(m => m.id);
      const hw = {};
      for (const i of ids0) hw[i] = '선발';
      await autoEntryAll(ids0, hw);
    } /* 선발 전원이 나온 뒤 등장 효과 (스피드 순) · 11-09 감우 54: 【등장 (선발)】 도 이때 */
    try {
      const DK = window.OM_DECK_UI;
      if (DK && DK.beat) await DK.beat('battle', Object.keys(ctx().b.trainers || {}));
    } catch (e) {
      console.warn(e);
    } /* 11-01 은열쇠: 배틀 시작에 덱 설정 「배틀 시작에 n장」 */
    try {
      await prepCheck();
    } catch (e) {
      console.warn('준비 검사', e);
    } /* 11-09 감우 54-G: 【준비】 PT 조건 */
    A().sysLog('시합 개시! — TURN 1', 'battle');
    battleStartCut(ctx().b);
  }
  /* 퇴장 정리 (맵툴 out_area): 랭크·배율·임시 효과·발동 중인 포텐셜 효과·타입/특성 변경·하늘 위·급소 방호 를 되돌리고, 상태 이상(abn) 과 원념·빈사 빼고는 상태도 푼다.
    배턴터치면 랭크와 넘길 수 있는 상태(bat) 를 트레이너에게 맡겨 두었다가 다음 등장 포켓몬이 받는다. 강제 교대는 배턴터치 없이 정리만 */
  function passable(m) {
    const st = (DB().states || {}).st || {};
    const rk = Object.values(m.rank || {}).some(v => +v);
    const bs = Object.keys(m.states || {}).filter(k => m.states[k] && (st[k] || {}).bat);
    return rk || bs.length > 0 || !!+m.critBuff;
  }
  function outReset(nb, m, opt) {
    opt = opt || {};
    const st = (DB().states || {}).st || {};
    const L = [];
    const t = nb.trainers[m.tid];
    if (m.fxDone) delete m.fxDone;
    if (m.hitOnce) delete m.hitOnce;
    if (m.rnull) delete m.rnull;
    if (m.rnOff) delete m.rnOff;
    if (m.treatX) delete m.treatX;
    if (m.tagHit) delete m.tagHit;
    if (m.noCharge) delete m.noCharge;
    /* 11-23 257b 퀄러: 필드를 떠나면 무효화도 끝 · 무효 표시도 지운다 */ if (m.hpHi) delete m.hpHi;
    if (m.hpTrig) {
      const k = {};
      for (const n in m.hpTrig) if (m.hpTrig[n] === 'u') k[n] = 'u';
      if (Object.keys(k).length) m.hpTrig = k;
      else delete m.hpTrig;
    }
    /* 11-23 「HP 이하가 되었을 때」 계기: 교대하면 다시 (【유일】만 남긴다) */ if (m.charge) delete m.charge;
    /* 11-14: 「차지」 중에 필드를 떠나면 모은 것도 풀린다 (다시 나와서 그 기술로 열리지 않게) */ if (m.thrashOn)
      delete m.thrashOn; /* 10-26: 다시 나오면 상시 효과를 다시 건다 · 난동 표시도 정리 */
    if (opt.batton && t) {
      const states = {};
      for (const k in m.states || {}) if (m.states[k] && (st[k] || {}).bat) states[k] = m.states[k];
      t.batton = { rank: Object.assign({}, m.rank || {}), states, critBuff: +m.critBuff || 0, from: m.name };
      L.push(`${m.name} 「배턴터치」 — 랭크·상태를 다음 포켓몬에게 넘긴다`);
    }
    /* 효과(배율 출처 포함)를 먼저 풀고 나서 랭크·배율을 비운다 — 순서가 바뀌면 배율이 역으로 나뉘어 0.75 같은 값이 남는다 */
    if (FX() && FX().release) L.push(...FX().release(nb, m));
    if (FX()) {
      const n = FX().chips(m).length;
      FX().removeAll(m);
      if (n) L.push(`${m.name} 발동 중인 효과 ${n}개 해제`);
    }
    m.rank = {};
    delete m.tempRank;
    m.mod = {};
    delete m.tempMod;
    delete m.critBuff;
    delete m.stock;
    delete m.stockUp;
    /* 11-18 비축 카운터는 교대하면 0 */ delete m.mvMod;
    /* 11-19 사출 */ if (m.fx) m.fx.mults = [];
    delete m.metro;
    delete m.bindFrom; /* 51-2 ⑬ 메트로놈 · ⑪ 조이기 건 쪽 */
    const gone = [];
    for (const k in m.states || {}) {
      if (!m.states[k]) continue;
      const d = st[k] || {};
      if (d.abn || k === 'Grudge' || k === 'Dead' || k === 'Seal') continue;
      delete m.states[k];
      gone.push(d.ko || k);
    } /* 11-05 망령: 「봉인」은 교대해도 풀리지 않는다 */
    if (FX() && FX().abSync) {
      const t = FX().abSync(m);
      if (t) L.push(t);
    } /* 51-2 ㉓ 특성 파괴가 풀리면 특성을 되돌린다 */
    if (m.form0 && ((m.forms || [])[m.formIdx] || {}).revert) L.push(...formSet(m, -1));
    if (m.potTurn && m.potTurn._sup) delete m.potTurn._sup; /* 11-11 【보급】: 필드를 떠나면 다시 쓸 수 있다 */
    if (m.stance) delete m.stance; /* 11-23 10:36 망령 「교대 때 지우게 해」: 필드를 떠나면 자세가 풀린다 */
    delete m.flags;
    delete m.prioDown;
    delete m.fxDone;
    delete m.futRsv;
    if (m.statsOrig) {
      m.stats = m.statsOrig;
      delete m.statsOrig;
    }
    /* 11-02: 배틀 실수치 변경(실수치변경 구문)은 교대하면 원래대로 */ /* 11-02 망령: 「테라스탈」은 교대해도 풀리지 않는다 (상태 DB 설명) — 배틀을 차릴 때(prepMon)만 끈다 */ m.entry =
      '';
    if (gone.length) L.push(`${m.name} 상태 해제: ${gone.join('·')}`);
    return L;
  }
  /* 10-22 망령: 나가는 포켓몬이 다른 포켓몬에게 걸어 둔 포텐셜·특성 효과(옵저버 같은 아군 배율)도 같이 꺼진다. 기술로 건 효과는 남긴다 */
  function auraOff(nb, m) {
    const L = [],
      ids = [];
    if (!FX()) return { L, ids };
    const mv = new Set(
      (m.moves || [])
        .map(
          x =>
            x &&
            String(x.name || '')
              .replace(/『|』/g, '')
              .trim()
        )
        .filter(Boolean)
    );
    const tail = ' ← ' + m.name;
    for (const x of Object.values(nb.mons || {})) {
      if (!x || x.id === m.id) continue;
      const off = FX()
        .chips(x)
        .filter(
          c =>
            /^(mods|noind|prio|immune|nodrop|mults|chance):/.test(c.id) &&
            (c.id.endsWith(tail) || c.id.includes(tail + ' (')) &&
            !mv.has(
              String(c.name || '')
                .replace(/『|』/g, '')
                .trim()
            )
        );
      if (!off.length) continue;
      for (const c of off) FX().remove(x, c.id);
      ids.push(x.id);
      L.push(`${x.name} 「${[...new Set(off.map(c => c.name))].join('」「')}」 해제 (${m.name} 퇴장)`);
    }
    return { L, ids };
  }
  function applyBatton(nb, m) {
    const t = nb.trainers[m.tid];
    const bt = t && t.batton;
    if (!bt) return [];
    delete t.batton;
    m.rank = Object.assign({}, bt.rank || {});
    m.states = Object.assign({}, m.states || {}, bt.states || {});
    if (bt.critBuff) m.critBuff = bt.critBuff;
    const st = (DB().states || {}).st || {};
    const rk = Object.entries(m.rank)
      .filter(([k, v]) => +v)
      .map(([k, v]) => (FX() ? FX().STAT_KO[k] : k) + (v > 0 ? '+' : '') + v);
    const ss = Object.keys(bt.states || {}).map(k => (st[k] || {}).ko || k);
    return [`${m.name} 「배턴터치」 받음 (${bt.from || ''}) ${[...rk, ...ss].join(' · ') || '없음'}`];
  }
  /* 11-09 감우 56 (망령 「퇴장 · 등장 계기 만들기」): 【퇴장】 · 【퇴장 (통상 교대 | 임의 교대 | 강제 교대 | 빈사)】 · 【등장 (상대)】 — 예전엔 퇴장이 정리만 하고 이 태그는 아무것도 터뜨리지 않았다.
    용어집(제작기): 퇴장 = 필드를 떠날 때, 강제 교대는 (강제 교대) 외의 퇴장을 발동하지 않는다 → 맨 【퇴장】은 통상 교대 · 임의 교대 · 빈사 때.
    「필드에 등장한 아군」 · 「같은 에리어의 아군」을 고르는 효과는 그 자리로 다음 포켓몬이 나온 뒤에 — 교대면 바로, 빈사 · 따로 누른 퇴장이면 그 자리에 다음 포켓몬이 나올 때(battle.exitPend).
    「정면」(레디메이드에선 「상대 1체」)은 떠난 자리의 맞은편을 먼저 고른다. 상대 필드에 「경호원」이 있으면 특성의 【등장】【퇴장】은 무효.
    【N/시】 는 【자동】 이 없으면 묻는다 · 구문이 없거나 괄호 조건을 웹툴이 모르면(『어시스트』 발동 …) GM 귓속말로 알린다 */
  const XIN_RE = /필드에\s*등장한\s*아군|같은\s*에리어의\s*아군|교대(?:해|하여)?\s*(?:들어온|나온)\s*아군/;
  const XHOW = ['통상교대', '임의교대', '강제교대', '빈사'];
  function trigSrcs(m, b) {
    const out = [];
    if (!m) return out;
    if (m.ability) out.push({ kind: 'trait', name: m.ability, eff: String(m.abilityEff || slotEff(m, 'trait', m.ability) || '') });
    if (!IOFF(m)) {
      if (m.item) out.push({ kind: 'item', name: m.item, eff: String(m.itemEff || '') });
      for (const x of m.items2 || []) if (x && x.item && x.item !== m.item) out.push({ kind: 'item', name: x.item, eff: String(x.itemEff || '') });
    }
    for (const p of potSrc(m)) if (p && p.name && !potOffWhy(m, p.name)) out.push({ kind: 'pot', name: p.name, eff: String(p.eff || ''), p });
    const t = (b.trainers || {})[m.tid];
    for (const u of (t && t.unique) || []) if (u && u.name) out.push({ kind: 'uq', name: u.name, eff: String(u.eff || ''), u, t });
    return out;
  }
  /* 태그 뒤에 다른 【…】 를 지나 「/」가 와야 계기 — 「경호원」의 「【등장】【퇴장】 효과를 무효화」 같은 언급은 빼고 */
  function tagHit(eff, tag) {
    const t = String(eff || '').replace(/<br\s*\/?>/gi, '\n');
    const cls = t
      .split(/(?=[①②③④⑤⑥⑦⑧⑨⑩])|\n/)
      .map(x => x.trim())
      .filter(Boolean);
    const re =
      tag === 'exit'
        ? /【퇴장(?:\s*\(([^)]*)\))?】(?:【(?:[^【】]|【[^【】]*】)*】)*\s*\//
        : /【등장\s*\(\s*상대\s*(?:[,，]\s*([^)]*?))?\s*\)】(?:【(?:[^【】]|【[^【】]*】)*】)*\s*\//; /* 11-22 망령 「【등장 (상대, 강제 교대)】」: 쉼표 뒤 조각(등장 방식 · 「타입 : X」)을 arg 로 — foeArgOk 가 본다 */
    for (let i = 0; i < cls.length; i++) {
      const r = cls[i].match(re);
      if (r)
        return {
          cl: cls[i],
          arg: String(r[1] || '').trim(),
          first: i === 0 || /^①/.test(cls[i]),
          no: (cls[i].match(/^[①②③④⑤⑥⑦⑧⑨⑩]/) || [])[0] || ''
        };
    }
    return null;
  }
  /* 11-15 망령 「나탈리아 눈 메리트」 → 『끝없이 눈 내리는 설원의 기억』 【퇴장 (빈사, 「타입 : 얼음」)】 이 「손으로」로만 떴음: 괄호를 쉼표로 나눠 방식(빈사 · 임의 교대 …)과 「타입 : X」(나가는 포켓몬의 타입)를 둘 다 판정 — 모르는 조각이 있을 때만 묻는다 */
  function exitArgOk2(arg, how, m) {
    const parts = String(arg || '')
      .split(/[,，]/)
      .map(x => x.trim())
      .filter(Boolean);
    if (parts.length < 2) return exitArgOk(arg, how);
    let ask = false;
    for (const p of parts) {
      const a = p.replace(/\s/g, '');
      if (XHOW.includes(a)) {
        if (a !== String(how || '').replace(/\s/g, '')) return 'no';
        continue;
      }
      const t = p.match(/^「\s*타입\s*:\s*([^」]+?)\s*」$/);
      if (t && m) {
        const ko = t[1].trim();
        const en = S().typeEn ? S().typeEn(ko) : ko;
        const ty = [...tysOf(m), ...(m.typesKo || [])];
        if (!(ty.includes(en) || ty.includes(ko))) return 'no';
        continue;
      }
      ask = true;
    }
    if (String(how || '').replace(/\s/g, '') === '강제교대' && !parts.some(p => p.replace(/\s/g, '') === '강제교대')) return 'no';
    return ask ? 'ask' : 'yes';
  }
  function exitArgOk(arg, how) {
    const a = String(arg || '').replace(/\s/g, ''),
      h = String(how || '').replace(/\s/g, '');
    if (!a) return h === '강제교대' ? 'no' : 'yes';
    if (XHOW.includes(a)) return a === h ? 'yes' : 'no';
    return h === '강제교대' ? 'no' : 'ask';
  }
  function guardOff(b, m) {
    const g = Object.values(b.mons || {}).find(
      x =>
        x &&
        x.entry &&
        x.hp &&
        x.hp.cur > 0 &&
        !sameT(x, m, b) &&
        (abNm(x).replace(/[『』\s]/g, '') === '경호원' ||
          /상대의\s*「특성」의\s*【등장】\s*【퇴장】\s*효과를\s*무효/.test(String(x.abilityEff || '')))
    );
    return g ? g.name : '';
  }
  async function trigFire(mid, x, hit, o) {
    const m = ctx().b.mons[mid];
    if (!m) return {};
    const kind = x.kind === 'uq' ? 'pot' : x.kind;
    const K = { pot: '포텐셜', trait: '특성', item: '소지품', uq: '고유' }[x.kind] || '효과';
    const who = x.kind === 'uq' ? x.t.name + ' 고유' : m.name;
    const nm = String(x.name).replace(/[『』]/g, '');
    let a = FX().autoOf(m, kind, x.name);
    if (kind === 'item') a = itemAutoDedupe(a, x.name);
    const note = { note: `${who} 『${nm}』 — ${o.why}` };
    if (!a || !realOps(a) || a.manual) return note;
    if (a.ops.length === 1 && a.ops[0].k === 'choice') {
      /* 줄 고르기 구문: 계기가 든 줄(①②…)만 */ const os = (a.ops[0].opts || []).filter(q => q && q.label);
      const pk = hit.no ? os.find(q => String(q.label).trim().startsWith(hit.no)) : os.length === 1 ? os[0] : null;
      if (!pk || !(pk.ops || []).length) return note;
      a = Object.assign({}, a, { ops: pk.ops });
    } else if (!hit.first) return note;
    let L = null,
      Q = null;
    if (x.kind === 'pot') {
      L = limOf(x.p, m.potUses || {}, m.potTurn || {});
      if (L.left !== null && L.left <= 0) return {};
    }
    if (x.kind === 'uq') {
      const tt = (ctx().b.trainers || {})[m.tid] || x.t;
      Q = limOf(x.u, tt.uUses || {}, tt.uTurn || {});
      if (Q.left !== null && Q.left <= 0) return {};
    }
    if (/【\s*\d+\s*\/\s*(?:시|턴)\s*】/.test(x.eff) && !/【\s*자동\s*】/.test(x.eff)) {
      const q = `【계기】 ${o.why}\n\n${who} 『${nm}』 을(를) 발동할까?\n${String(hit.cl).slice(0, 160)}`; /* 11-17 망령 「PL 권한 켜뒀는데 (PL 포켓몬 【함성】 발동 확인 창이 GM 에게) 왜 보이죠」: 주인(자리 플레이어)에게 묻는다 — 동조 · 고르기와 같은 remoteAsk */
      if (!(await remoteAsk(m, 'confirm', { name: nm, q }, () => askYes(q, '발동', '그만')))) return {};
    }
    let ok = false;
    try {
      ok = await fireAuto(
        mid,
        kind,
        x.name,
        Object.assign(
          { auto: a, quiet: true, noEv: 1, head: `【${K}】 ${who} 『${nm}』 — ${o.why}`, eff: x.eff, pickIds: o.pickIds || [] },
          o.area ? { area: o.area } : {},
          x.kind === 'uq' ? { uq: 1 } : {}
        )
      );
    } catch (e) {
      console.warn('계기', e);
    }
    if (ok && L) {
      const cur = ctx().b.mons[mid] || m;
      if (L.mmax != null) {
        const u = (cur.potUses || {})[x.name];
        const had = u == null ? L.mmax : +u;
        await A().set(['battle', 'mons', mid, 'potUses', x.name], Math.max(0, had - 1));
      }
      if (L.per) await A().set(['battle', 'mons', mid, 'potTurn', x.name], +ctx().b.turn || 0);
      if (L.sup) await A().set(['battle', 'mons', mid, 'potTurn', '_sup', x.name], 1);
    }
    if (ok && Q) {
      const tt = (ctx().b.trainers || {})[m.tid] || x.t;
      if (Q.mmax != null) {
        const v = (tt.uUses || {})[x.name];
        await A().set(['battle', 'trainers', m.tid, 'uUses', x.name], Math.max(0, (v == null ? Q.mmax : +v) - 1));
      }
      if (Q.per) await A().set(['battle', 'trainers', m.tid, 'uTurn', x.name], +ctx().b.turn || 0);
    }
    return { ok };
  }
  /* phase: 'now' = 떠난 순간(들어올 아군이 필요한 줄은 exitPend 로 미룸) · 'in' = 그 자리에 다음 포켓몬이 나온 뒤(미뤄 둔 줄만) · 'all' = 교대(바로 들어왔다) */
  let EXIT_MV = null;
  async function exitTrig(mid, how, o) {
    o = o || {};
    const c = ctx();
    const b = c.b;
    if (!b || !b.started || !FX()) return;
    const m = b.mons[mid];
    if (!m) return;
    const area = o.area || m.entry || (how === '빈사' ? m.koA || LAST_AREA[mid] || m.outA : m.outA) || '';
    const inM = o.inId ? b.mons[o.inId] : null;
    const front = area
      ? Object.values(b.mons || {}).find(x => x && x.entry === area && x.side !== m.side && x.hp && x.hp.cur > 0 && !sameT(x, m, b))
      : null;
    const g = guardOff(b, m);
    const notes = [];
    let pend = false;
    const why = `퇴장 (${how})`;
    for (const x of trigSrcs(m, b)) {
      const hit = tagHit(x.eff, 'exit');
      if (!hit) continue;
      /* 11-24 망령 「교대했을 때만」: 【퇴장 (「유체이탈」)】 = 그 기술의 유턴 효과로 교대해 나갈 때 — 그 기술이 맞은 대상이 구문의 「상대1체」 */ const xmvL =
        (String(hit.arg || '').match(/「[^」:：]+」/g) || []).map(s => s.replace(/[「」\s]/g, ''));
      const xmvOn =
        xmvL.length > 0 &&
        !String(hit.arg || '')
          .replace(/「[^」:：]+」/g, '')
          .replace(/[,，·\s]/g, '');
      const xmvHit = xmvOn && EXIT_MV && EXIT_MV.mid === mid && xmvL.includes(String(EXIT_MV.mv || '').replace(/\s/g, ''));
      if (xmvOn && !xmvHit) continue;
      const ok = xmvOn ? 'yes' : exitArgOk2(hit.arg, how, m);
      if (ok === 'no') continue;
      const nm = String(x.name).replace(/[『』]/g, '');
      const who = x.kind === 'uq' ? x.t.name + ' 고유' : m.name;
      if (ok === 'ask') {
        if (o.phase !== 'in') notes.push(`${who} 『${nm}』 — 【퇴장 (${hit.arg})】 조건을 확인해 손으로`);
        continue;
      }
      if (x.kind === 'trait' && g) {
        if (o.phase !== 'in') A().sysLog(`【특성】 ${m.name} 『${nm}』의 【퇴장】 — ${g} 「경호원」으로 무효`, 'battle', { mid: m.id });
        continue;
      }
      const needIn = XIN_RE.test(hit.cl);
      if (o.phase === 'now' && needIn) {
        pend = true;
        continue;
      }
      if (o.phase === 'in' && !needIn) continue;
      const r = await trigFire(mid, x, hit, {
        why,
        pickIds: [...(xmvHit && EXIT_MV.hit ? [EXIT_MV.hit] : []), ...(inM ? [inM.id] : []), ...(front ? [front.id] : [])],
        area: inM && inM.entry ? inM.entry : ''
      });
      if (r && r.note) notes.push(r.note);
    }
    if (pend && area) await A().set(['battle', 'exitPend', m.side + '_' + area], { mid, how, tid: m.tid, turn: +b.turn || 0 });
    if (notes.length)
      A().sysLog(`【계기】 ${m.name} ${why} — 발동 조건을 만족한 효과 (구문이 없어 손으로)\n${[...new Set(notes)].join('\n')}`, 'battle', {
        gmPriv: 1
      });
  }
  /* 빈자리로 나왔을 때: 그 자리를 떠난 아군의 미뤄 둔 퇴장 줄 (「필드에 등장한 아군」) */
  async function exitPendIn(mid) {
    const b = ctx().b;
    const m = b.mons[mid];
    if (!m || !m.entry) return;
    const k = m.side + '_' + m.entry;
    const p = (b.exitPend || {})[k];
    if (!p) return;
    await A().set(['battle', 'exitPend', k], null);
    if (p.mid === mid || !sameT(b.mons[p.mid] || {}, m, b)) return;
    /* 같은 편이면 다른 트레이너 포켓몬도 「아군」 */ await exitTrig(p.mid, p.how, { phase: 'in', inId: mid, area: m.entry });
  }
  /* 상대가 나왔을 때: 필드의 다른 편 포켓몬의 【등장 (상대)】 (무당거미 · 뜬돌 · 마그마의바다 …) — 그 상대가 대상.
    11-09 13:51 망령 「동시에 나온 케이스엔 불발」: 같이 나온 포켓몬(선발 · 동시 내밀기 묶음 = together)끼리는 안 터진다 — 이미 필드에 있던 쪽만 */
  /* 11-22 망령 「【은폐】/「특성 : 일루젼」이 발동했을 때 「정면」의 데이터를 해석한다 — 이런 류는?」: 일루젼으로 변장한 채 나왔을 때(등장 때 disg 가 걸림)를 「일루젼 발동」으로 보고, 그 포켓몬의 특성 · 포텐셜 · 소지품 · 트레이너 고유 중 이 계기가 적힌 것을 trigFire (구문이 없으면 주인에게 알림만) */
  /* 11-22 망령 (비독) 「①【준비】【은폐】/「특성 : 일루젼」으로 보일 대상을 임의로 변경할 수 있다. ②「특성 : 일루젼」이 발동중일 때 데이터가 해석된 상대에게 내보내는 기술에 「따라가때리기」 효과를 부여한다」:
    ① 그 글이 있으면 변장한 채 나올 때 주인에게 보일 대상을 묻는다(자동 = 벤치 맨 뒤, 벤치가 둘 이상일 때만) — 상대에겐 아무것도 안 찍힌다
    ② 변장 중(disg)이면 그 포켓몬의 기술에 따라가때리기 — 단 노린 상대가 우리 편이 해석한 상대일 때만 걸린다(순서 열쇠 pcond:'dex') */
  const ILLU_FREE_RE = /일루[젼전]\s*[」』]?\s*(?:으로|로)\s*보일\s*대상을\s*임의로\s*(?:변경|바꿀|고를)/;
  const ILLU_PURS_RE =
    /일루[젼전]\s*[」』]?\s*(?:이|가)\s*발동\s*중(?:일|인)?\s*때[^①②③④⑤]*?데이터가\s*해석된\s*상대에게\s*내보내는\s*기술에\s*「\s*따라가때리기\s*」\s*효과를\s*부여/;
  function illuTextBy(m, re) {
    if (!m) return '';
    try {
      for (const x of trigSrcs(m, ctx().b)) {
        const t = String(x.eff || '').replace(/<br\s*\/?>/gi, '\n');
        if (t.split(/(?=[①②③④⑤⑥⑦⑧⑨⑩])|\n/).some(q => re.test(q))) return String(x.name || '').replace(/[『』]/g, '');
      }
    } catch (e) {}
    return '';
  }
  const ILLU_SUPK = n =>
    n + '·추격'; /* 11-22 망령 (비독 ② 【보급】): 등장당 1번 — 따라가때리기가 실제로 걸리면 potTurn._sup 에 적고, 교대해 필드를 떠나면 지워진다 */
  function illuPursSup(m, n) {
    try {
      for (const x of trigSrcs(m, ctx().b)) {
        if (String(x.name || '').replace(/[『』]/g, '') !== n) continue;
        const t = String(x.eff || '').replace(/<br\s*\/?>/gi, '\n');
        return t.split(/(?=[①②③④⑤⑥⑦⑧⑨⑩])|\n/).some(q => ILLU_PURS_RE.test(q) && /【\s*보급\s*】/.test(q));
      }
    } catch (e) {}
    return false;
  }
  const illuPursBy = m => {
    if (!m || !m.disg) return '';
    const n = illuTextBy(m, ILLU_PURS_RE);
    if (!n) return '';
    if (illuPursSup(m, n) && ((m.potTurn || {})._sup || {})[ILLU_SUPK(n)]) return '';
    return n;
  };
  function illuPursSpend(mid, src) {
    const m = ((ctx().b || {}).mons || {})[mid];
    if (!m || !src || !illuPursSup(m, src)) return '';
    A()
      .set(['battle', 'mons', mid, 'potTurn', '_sup', ILLU_SUPK(src)], 1)
      .catch(() => {});
    return ` (『${src}』 【보급】 사용 — 다시 나올 때까지 끝)`;
  }
  function dexTeam(b, tg, atk) {
    if (!tg || !atk) return false;
    const D = ((A().ST || {}).state || {}).dex || {};
    for (const tid in D) {
      if (!((D[tid] || {}).list || []).includes(tg.id)) continue;
      const tr = (b.trainers || {})[tid];
      if (tr && sameT({ tid, side: tr.side }, atk, b)) return true;
    }
    return false;
  }
  /* 11-27 벤치 표시(benchView)가 기대는 두 가지를 등장 · 모습 바꾸기 때 맞춘다:
    ① 빌린 모습(진짜 아군)은 상대가 이미 본 것 → seen ② 이 포켓몬이 진짜로 나오면, 예전에 이 모습을 쓰고 빠져 있는 아군의 변장 표시는 지운다 */
  async function illuBenchMarks(mid, dsg) {
    const b = ctx().b;
    const m = (b.mons || {})[mid];
    const t = dsg && !/^@f\d+$/.test(String(dsg)) ? (b.mons || {})[dsg] : null;
    if (t && !t.seen) await A().set(['battle', 'mons', t.id, 'seen'], true);
    for (const x of Object.values(b.mons || {}))
      if (m && x && x.id !== mid && x.tid === m.tid && !x.entry && x.disg === mid) await A().set(['battle', 'mons', x.id, 'disg'], null);
  }
  /* 11-26 등장 전(벤치)에 일루젼 모습을 미리 고르는 창 — 고른 값은 m.disgPre (illuPreOf 가 읽는다) */
  function illuPreOpen(m) {
    const b = ctx().b;
    const L = illuCands(b, m);
    const cur = illuPreOf(b, m);
    const row = (v, name, note, on) =>
      `<label class="firerow ${on ? 'on' : ''}" data-ilp="${esc(v)}"><b>${esc(name)}</b>${note ? `<span class="small dim">${note}</span>` : ''}${on ? '<span class="small dim">지금</span>' : ''}</label>`;
    const md = A().openModal(
      `<div class="mhead"><h2>🎭 ${esc(m.name)} · 일루젼 (등장 전)</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><p class="small" style="margin-top:0">등장했을 때 상대 화면에 누구의 모습으로 보일지 미리 골라 둬요. 상대에게는 보이지 않아요. 고른 모습이 그때 쓰러졌거나 필드에 나와 있으면 자동으로 정해요.</p><div class="firelist">${row('', '자동', '일루젼 폼, 없으면 벤치 맨 뒤', !cur)}${L.map(x => row(x.dv || x.id, x.name, x.fake ? '일루젼 폼' : '', cur && cur !== 'none' && cur.id === x.id)).join('')}${row('none', '변장 없이', '진짜 모습으로 등장', cur === 'none')}</div>`
    );
    md.querySelectorAll('[data-ilp]').forEach(
      el =>
        (el.onclick = async () => {
          const v = el.dataset.ilp;
          A().closeModal();
          await A().set(['battle', 'mons', m.id, 'disgPre'], v || null);
          const p = illuPreOf(ctx().b, Object.assign({}, m, { disgPre: v || null }));
          A().toast(p === 'none' ? '변장 없이 등장해요' : p ? `등장하면 상대 화면에는 「${p.name}」(으)로 보여요` : '등장할 때 자동으로 정해요');
        })
    );
  }
  async function illuChoose(m, L, nm) {
    const c = ctx();
    const lab = '「일루젼」으로 보일 대상';
    try {
      const seats = c.ST.state.seats || {};
      const ownerOn =
        !ownT(c, m.tid) &&
        !!(seats[m.tid] || baseSeat(c, m.tid)) &&
        (A().online(seats[m.tid] ? m.tid : baseSeat(c, m.tid)) || coOf(c, m.tid).some(s => A().online(s)));
      if (ownerOn) {
        const r = await remoteAsk(m, 'pick', { name: nm, label: lab, ids: L.map(x => x.id) }, () => '', 'seat:' + m.tid);
        return typeof r === 'string' ? L.find(x => x.id === r) || null : r;
      }
      if (canEdit(c, m)) return await uiCtx(c.b, m, nm).pick(L, lab);
    } catch (e) {
      console.warn('일루젼 대상 고르기', e);
    }
    return null;
  }
  const ILLU_TRIG_RE = /(?:「\s*특성\s*:\s*일루[젼전]\s*」|『\s*일루[젼전]\s*』|「\s*일루[젼전]\s*」)\s*(?:이|가)\s*발동(?:했을|하였을|한)\s*때/;
  async function illuTrig(mid) {
    const b = ctx().b;
    const m = (b.mons || {})[mid];
    if (!m || !m.entry || !m.disg || !b.started || !FX()) return;
    const notes = [];
    for (const x of trigSrcs(m, b)) {
      const t = String(x.eff || '').replace(/<br\s*\/?>/gi, '\n');
      const cls = t
        .split(/(?=[①②③④⑤⑥⑦⑧⑨⑩])|\n/)
        .map(q => q.trim())
        .filter(Boolean);
      let hit = null;
      for (let i = 0; i < cls.length; i++)
        if (ILLU_TRIG_RE.test(cls[i])) {
          hit = { cl: cls[i], arg: '', first: i === 0 || /^①/.test(cls[i]), no: (cls[i].match(/^[①②③④⑤⑥⑦⑧⑨⑩]/) || [])[0] || '' };
          break;
        }
      if (!hit) continue;
      const cur = ctx().b.mons[mid];
      if (!cur || !cur.entry || cur.hp.cur <= 0) break;
      const r = await trigFire(mid, x, hit, { why: `${m.name} 「일루젼」 발동` });
      if (r && r.note) notes.push(r.note);
    }
    if (notes.length)
      A().sysLog(`【계기】 ${m.name} 「일루젼」 발동 — 발동 조건을 만족한 효과 (구문이 없어 손으로)\n${[...new Set(notes)].join('\n')}`, 'battle', {
        gmPriv: 1,
        mid
      });
  }
  const EHOW = ['통상교대', '임의교대', '강제교대', '죽어내밀기', '선발'];
  function foeArgOk(arg, how, m) {
    const parts = String(arg || '')
      .split(/[,，]/)
      .map(x => x.trim())
      .filter(Boolean);
    if (!parts.length) return true;
    const h = String(how || '').replace(/\s/g, '');
    const hows = parts.map(p => p.replace(/\s/g, '')).filter(p => EHOW.includes(p));
    if (hows.length && !hows.includes(h)) return false;
    for (const p of parts) {
      const t = p.match(/^「\s*타입\s*:\s*([^」]+?)\s*」$/);
      if (t && m) {
        const ko = t[1].trim();
        const en = S().typeEn ? S().typeEn(ko) : ko;
        const ty = [...tysOf(m), ...(m.typesKo || [])];
        if (!(ty.includes(en) || ty.includes(ko))) return false;
      }
    }
    return true;
  }
  async function foeInTrig(mid, together, how) {
    const b = ctx().b;
    if (!b || !b.started || !FX()) return;
    const m = b.mons[mid];
    if (!m || !m.entry || m.hp.cur <= 0) return;
    const notes = [];
    for (const y of Object.values(b.mons || {})) {
      if (!y || !y.entry || y.hp.cur <= 0 || y.id === mid || sameT(y, m, b) || (together && together.includes(y.id))) continue;
      const g = guardOff(ctx().b, y);
      for (const x of trigSrcs(y, ctx().b)) {
        const hit = tagHit(x.eff, 'foeIn');
        if (!hit) continue;
        if (hit.arg && !foeArgOk(hit.arg, how, m)) continue;
        const nm = String(x.name).replace(/[『』]/g, '');
        if (x.kind === 'trait' && g) {
          A().sysLog(`【특성】 ${y.name} 『${nm}』의 【등장 (상대)】 — ${g} 「경호원」으로 무효`, 'battle', { mid: y.id });
          continue;
        }
        const cur = ctx().b.mons[mid];
        if (!cur || !cur.entry || cur.hp.cur <= 0) break;
        const r = await trigFire(y.id, x, hit, { why: `${m.name} 등장 (상대)`, pickIds: [mid] });
        if (r && r.note) notes.push(r.note);
      }
    }
    if (notes.length)
      A().sysLog(`【계기】 ${m.name} 등장 (상대) — 발동 조건을 만족한 효과 (구문이 없어 손으로)\n${[...new Set(notes)].join('\n')}`, 'battle', {
        gmPriv: 1
      });
  }
  /* 11-23 방 시험(219번 3-10): 「소지로 돌아가면 자신의 「HP」를 N/M만큼 회복한다」(회복력 · 재생력 꼴) — 【퇴장】 태그가 없어 퇴장 계기가 못 읽던 특성. 살아서 나가면 회복 (회복봉인이면 없음) */
  async function exitHeal(mid) {
    try {
      const cur = ctx().b.mons[mid];
      const q =
        cur && cur.hp && cur.hp.cur > 0 && !cur.entry
          ? String(abTxt(cur) || cur.abilityEff || '')
              .replace(/<br\s*\/?>/gi, '\n')
              .match(/소지로\s*돌아가면\s*자신의\s*「HP」를\s*(\d+)\s*\/\s*(\d+)\s*만큼\s*회복/)
          : null;
      if (q && cur.hp.cur < cur.hp.max) {
        if ((cur.states || {}).HealBlock) A().sysLog(`【특성】 ${cur.name} 「${abNm(cur)}」 — 「회복봉인」이라 회복하지 못했다`, 'battle', { mid });
        else {
          const v = Math.max(1, Math.floor((cur.hp.max * +q[1]) / +q[2]));
          const was = +cur.hp.cur,
            to = Math.min(cur.hp.max, was + v);
          await A().set(['battle', 'mons', mid, 'hp', 'cur'], to);
          A().sysLog(`【특성】 ${cur.name} 「${abNm(cur)}」 — 소지로 돌아가 「HP」 +${to - was} (${to}/${cur.hp.max})`, 'battle', { mid });
        }
      }
    } catch (e) {
      console.warn('회복력', e);
    }
  }
  async function exitMon(mid, opt) {
    const c = ctx();
    const m = c.b.mons[mid];
    if (!m || !(canEdit(c, m) || (opt && opt.sys && c.mgr))) return;
    if (!opt) {
      /* 카드의 「퇴장」: 작은 창에서 고른다 */
      const bench = Object.values(c.b.mons).filter(x => x.tid === m.tid && !x.entry && !x.pend && x.hp.cur > 0 && x.id !== mid);
      const ps = passable(m);
      const md = A()
        .openModal(`<div class="mhead"><h2>${esc(m.name)} 퇴장 (특수)</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
    <div class="firelist"><label class="firerow ${ps ? '' : 'dis'}" data-ex="batton"><b>배턴터치 퇴장</b><span class="small dim">${ps ? '랭크와 넘길 수 있는 상태를 다음에 나오는 포켓몬에게' : '넘길 랭크·상태가 없다'}</span></label>
    <label class="firerow ${bench.length ? '' : 'dis'}" data-ex="forced"><b>강제 교대</b><span class="small dim">${bench.length ? '배턴터치 없이 나가고 벤치에서 무작위 한 마리가 같은 자리로' : '벤치에 교대할 포켓몬이 없다'}</span></label></div>`);
      md.querySelectorAll('[data-ex]').forEach(
        el =>
          (el.onclick = () => {
            const k = el.dataset.ex;
            if (k === 'forced' && !bench.length) return;
            if (k === 'batton' && !ps) return;
            A().closeModal();
            if (k === 'forced') return forcedSwitch(mid);
            exitMon(mid, { batton: k === 'batton', noAsk: true });
          })
      );
      return;
    }
    let batton = !!opt.batton;
    /* 10-26 FFA 시험: 랭크가 바뀐 포켓몬은 그냥 교대해도 늘 「배턴터치인가?」를 물어, 서두르다 「예」를 누르면 위협 −2 가 다음 포켓몬에게 넘어갔다 — 「배턴터치」를 쓸 줄 아는 포켓몬만 묻는다 (그 밖은 「(특수)」의 배턴터치 퇴장) */ const knowsBP =
      MVS(m).some(v => /배턴터치/.test(String((v || {}).name || ''))) ||
      potSrc(m).some(p => p && /배턴터치/.test(String(p.eff || ''))) ||
      /배턴터치/.test(String(m.abilityEff || ''));
    let pupOut = false;
    if (!batton && m.hp && m.hp.cur > 0 && abNm(m) === '인형술사' && passable(m)) {
      batton = true;
      pupOut = true;
    } /* 11-22 인형술사: 나가는 쪽이 인형술사여도 바톤 */
    if (!batton && !opt.forced && knowsBP && passable(m) && !opt.noAsk)
      batton = await askYes(`${m.name} 퇴장 — 「배턴터치」인가? (랭크·넘길 수 있는 상태를 다음 포켓몬에게)\n취소 = 그냥 퇴장`);
    const nb0 = snap(c.b),
      nb = snap(nb0);
    const a0 = m.entry || '';
    const L = outReset(nb, nb.mons[mid], { batton });
    if (pupOut) L.push(`${m.name} 「인형술사」 — 교대에 「바톤」 효과`);
    else if (opt.puppet === 'in') L.push(`들어오는 포켓몬의 「인형술사」 — 교대에 「바톤」 효과`);
    if (a0) nb.mons[mid].outA = a0;
    /* outA: 마지막으로 빠진 자리 (교대 등장 판정) */ const AU = auraOff(nb, nb.mons[mid]);
    L.push(...AU.L);
    if (!(await A().setMany(A().diffOps(['battle'], nb0, nb, 3)))) return;
    itemKick();
    if (batton) await A().set(['battle', 'trainers', m.tid, 'batton'], nb.trainers[m.tid].batton);
    await exitHeal(mid);
    if (opt.quiet) return L; /* 10-27: 교대 등장이 한 장(【교대】)으로 같이 적는다 */
    A().sysLog(`${m.name} ${opt.forced ? '강제 퇴장' : '퇴장'}${L.length ? '\n' + L.join('\n') : ''}`, 'battle');
    try {
      await exitOrdSpend(mid, opt.forced ? '강제 교대' : opt.how || '퇴장');
    } catch (e) {
      console.warn('나간 포켓몬 선행 4식', e);
    }
    if (m.hp && m.hp.cur > 0)
      try {
        await exitTrig(mid, opt.forced ? '강제 교대' : opt.how || '통상 교대', { phase: 'now', area: a0 });
      } catch (e) {
        console.warn('퇴장 계기', e);
      }
  }
  /* 11-11 망령 「4식을 선행으로 입력한 아군이 턴 도중 레드카드로 강제 교대당하면 4식이 소모되지 않는다」:
    선행 입력한 4식 · 6령은 쓰지 못하고 나가도 소모된다 — 턴 개시 차감(pcList · preSpent)에 이 지시가 없으면 여기서 1 깎고 적는다 (나중 차감이 두 번 깎지 않게).
    깎였든 안 깎였든 「쓰지 못하고 소모」를 로그에 남긴다. 숨긴 지시를 읽을 수 있는 화면(주인 · GM)만. 자기 지시로 교대해 나간 포켓몬은 뺀다 */
  async function exitOrdSpend(mid, why) {
    const c = ctx();
    const b = c.b;
    if (!b || !b.started || (+b.phase || 0) < 1) return;
    const m = (b.mons || {})[mid];
    if (!m) return;
    const tid = m.tid;
    if (!(b.trainers || {})[tid]) return;
    if (!(c.gm || ownT(c, tid))) return;
    const cm = await myCmd(c, tid, true);
    const x = ((cm || {}).mons || {})[mid];
    if (!x || x.move === 'switch') return;
    const B = ctx().b;
    const fired = (((B.cmds || {})[tid] || {}).fired || {})[mid] || {};
    const tk = turnKey(B);
    const t0 = snap((B.trainers || {})[tid]),
      t1 = snap(t0);
    t1.orderCount = t1.orderCount || {};
    const L = [],
      bor = [];
    let ch = false;
    for (const [kind, ok] of [
      ['order', 'o'],
      ['command', 'c']
    ]) {
      const key = x[kind];
      if (!key || fired[kind] === key) continue;
      const pcK = t1.pcTurn === tk;
      const had = pcK && ((t1.pcList || {})[mid] || {})[ok] === key;
      const ps = t1.preSpent && t1.preSpent.k === tk ? t1.preSpent : null;
      const spent = !!ps && ((ps.m || {})[mid] || {})[ok] === key;
      if (!had && !spent) {
        const ck = (kind === 'order' ? 'order_' : 'command_') + key;
        pSpend(B, tid, t1, ck, null, bor);
        if (kind === 'command') {
          const sk = OO().shareKey(t1, key);
          if (sk) t1.orderCount['command_' + sk] = Math.max(0, (+t1.orderCount['command_' + sk] || 0) - 1);
        }
        const one = o => Object.assign({ o: '', c: '' }, o || {}, { [ok]: key });
        if (pcK) t1.pcList = Object.assign({}, t1.pcList || {}, { [mid]: one((t1.pcList || {})[mid]) });
        else {
          const m2 = Object.assign({}, (ps && ps.m) || {});
          m2[mid] = one(m2[mid]);
          t1.preSpent = { k: tk, m: m2 };
        }
        ch = true;
      }
      L.push(`${kind === 'order' ? '명령' : '지령'} 『${pName(B, tid, kind, key)}』`);
    }
    if (ch) {
      if ((await saveTr(tid, t0, t1)) && bor.length) await pBorrowSave(tid, bor);
    }
    if (L.length)
      A().sysLog(
        `${m.name} — 선행 입력한 ${L.join(' · ')}을(를) 쓰지 못하고 나가 소모했다 (${why})${ch ? '' : ' · 횟수는 턴 개시에 깎였다'}`,
        'battle',
        { mid }
      );
  } /* 11-09 감우 56: 따로 누른 퇴장 · 임의 교대 · 강제 교대 (교대 한 번에 들어오는 길은 enterMon 이) */
  /* 강제 교대 (맵툴 change_forced): 배턴터치 없이 나가고, 벤치에서 아무 포켓몬이나 같은 에리어로 */
  async function forcedSwitch(mid, opt) {
    opt = opt || {};
    const c = ctx();
    const b = c.b;
    const m = b.mons[mid];
    if (!m || !(canEdit(c, m) || (opt.sys && c.mgr)) || !m.entry) return false;
    const bench = Object.values(b.mons).filter(x => x.tid === m.tid && !x.entry && !x.pend && x.hp.cur > 0 && x.id !== mid);
    if (!bench.length) {
      A().toast('교대할 포켓몬이 벤치에 없다');
      if (opt.sys) A().sysLog(`${m.name} 강제 교대 — 벤치에 나올 포켓몬이 없다`, 'battle');
      return false;
    }
    const must = bench.filter(x =>
      /강제 교대로 반드시 선택/.test(abTxt(x))
    ); /* 11-23 시트에 특성 글이 없어도 DB 글로 (참견쟁이 · 길치) */ /* 방위라인·벤치가드 */
    const area = m.entry;
    const pool = must.length ? must : bench;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    await exitMon(mid, { forced: true, sys: opt.sys });
    A().sysLog(`${m.name} 강제 교대 → ${pick.name}${must.length ? ' (「' + pick.ability + '」로 반드시 선택)' : ''}`, 'battle');
    await enterMon(pick.id, area, { forced: true, sys: opt.sys });
    return true;
  }
  /* 강제 교대를 막는 것: 효과 엔진의 「교대 무시」, 뿌리박기·다이맥스, 특성 글(받지 않는다·무효화). 포텐셜 글(횟수 제한)은 물어본다 */
  /* 교대 제한: 검은눈빛·조이기 등. 고스트 · 아름다운허물 · 「반드시 교대할 수 있다」 효과는 예외. 경고만 하고 막지는 않는다 */
  const TRAPS = {
    MeanLook: '검은눈빛',
    Bind: '조이기',
    ThunderCage: '썬더프리즌',
    Ingrain: '뿌리박기',
    OctoLock: '문어굳히기',
    NoRetreat: '배수의진',
    Block: '블록'
  };
  const FREESW = /반드시\s*(임의\s*)?교대할?\s*수\s*있/;
  function trapWarn(m) {
    const st = m.states || {};
    const hit = Object.keys(TRAPS)
      .filter(k => st[k])
      .map(k => TRAPS[k]);
    {
      const b = ctx().b;
      if (b && m && abOnField(b, '그림자밟기', m, false).length && !abOnField(b, '그림자밟기', m, true).length) hit.push('특성 : 그림자밟기');
    }
    /* 11-22 그림자밟기: 상대 전체는 통상 교대할 수 없다 · 적진(그 편)에도 그림자밟기가 있으면 무효 */ if (!hit.length) return null;
    if (tysOf(m).includes('Ghost')) return { hit, free: '고스트 타입' };
    const it = IT(m);
    if (HAS(m, '아름다운허물')) return { hit, free: '아름다운허물' };
    if (it && FREESW.test(String(m.itemEff || ''))) return { hit, free: it };
    if (m.ability && FREESW.test(String(m.abilityEff || ''))) return { hit, free: '특성 : ' + m.ability };
    if (FX() && FX().noind(m, 'freesw')) return { hit, free: FX().noindName(m, 'freesw') || '반드시 교대' };
    const p = potSrc(m).find(p => FREESW.test(String(p.eff || '')));
    return { hit, free: '', pot: p ? p.name : '' };
  }
  async function switchGuard(m) {
    if (FX() && FX().noind(m, 'switch')) return FX().noindName(m, 'switch') || '교대 무시';
    const st = m.states || {};
    if (st.Ingrain) return '뿌리박기';
    if (st.Dynamax) return '다이맥스';
    const re = /강제 교대[^.\n]*?(받지 않|무효)/;
    if (m.ability && re.test(String(m.abilityEff || ''))) return '특성 : ' + m.ability;
    for (const p of potSrc(m)) {
      if (!re.test(String(p.eff || ''))) continue;
      const q = `${m.name}의 「${p.name}」로 강제 교대를 막을까?\n${String(p.eff || '')
        .replace(/<br\s*\/?>/g, ' ')
        .slice(0, 120)}`;
      if (await remoteAsk(m, 'confirm', { name: p.name, q }, () => askYes(q))) return p.name;
    }
    return '';
  } /* 11-17: 주인에게 묻기 */

  /* ----- 지시 저장 · 준비 · 공개 ----- */
  /* 저장한 지시엔 턴 번호를 붙인다 (10-24 망령): 지난 턴 지시(선행 포텐셜 · 지령)를 다음 턴에 또 읽어 「선행」이 풀리지 않던 것 */
  function cleanCmd(cur) {
    const out = { mons: {}, detail: cur.detail || '', upots: cur.upots || [], utg: cur.utg || {}, utm: cur.utm || {}, turn: +ctx().b.turn || 1 };
    /* 11-09 감우 57: utm · ptm = 기술 지정 (실제 턴 시험에서 저장이 빠진 것을 찾음) */ /* 시합 개시 전(턴 0)에 넣은 지시는 TURN 1 것 */ for (const k in cur.mons) {
      const x = cur.mons[k];
      out.mons[k] = {
        move: x.move,
        switch: x.switch,
        targets: x.targets || [],
        tm: tmOf(ctx().b, x.targets),
        prio: x.prio || {},
        ochg: x.ochg || {},
        order: x.order || '',
        command: x.command || '',
        pots: x.pots || [],
        pman: x.pman ? 1 : 0,
        pur: x.pur || '',
        pimm: x.pimm || '',
        uman: x.uman ? 1 : 0,
        ut: x.ut || '',
        tman: x.tman ? 1 : 0,
        ptg: x.ptg || {},
        ptm: x.ptm || {}
      };
    }
    return out;
  }
  /* 공개용: 선행 입력(지령·명령)은 뺀다 — 발동할 때 드러난다 */
  function pubMon(x) {
    x = x || {};
    return { move: x.move, switch: x.switch, targets: x.targets || [], tm: x.tm || {}, prio: x.prio || {}, ochg: x.ochg || {}, tman: x.tman ? 1 : 0 };
  }
  async function saveCmd(tid, quiet) {
    const c = ctx();
    const cur = CMD[tid];
    if (!cur) return;
    {
      const t = (c.b.trainers || {})[tid] || {};
      for (const mid in cur.mons) {
        const m = c.b.mons[mid];
        if (!m) continue;
        const pp = prePursuit(t, m, cur.mons[mid], cur.upots);
        cur.mons[mid].pur = pp.pur;
        cur.mons[mid].pimm = pp.pimm;
        cur.mons[mid].ut = pp.ut;
      }
    }
    try {
      await DBS().secretPut(c.ST.room, c.ST.secret, 'cmd', tid, cleanCmd(cur));
      /* 11-03 21:51 망령 「우선도 문제 안 고쳐졌다」: 턴 개시 뒤에 지시를 저장하거나 바꾸면(준비 안 된 채 턴이 열린 경우 등) 순서 열쇠가 기술 없는 옛것으로 남아 우선도가 0 — 저장할 때마다 열쇠를 다시 올린다 */ if (
        c.role === 'seat' &&
        (+c.b.phase || 0) >= 1 &&
        (+c.b.phase || 0) < 2
      )
        publishOk(tid, true).catch(() => {});
      if (coOf(c, tid).length && !(c.gm && c.fair))
        try {
          await A().set(['pub', tid, 'csav'], { at: Date.now(), by: c.gm ? 'gm' : c.seat, name: c.gm ? 'GM' : c.ST.name || c.seat });
        } catch (e) {}
      /* 함께 지시하는 화면들이 이걸 보고 불러온다 */ if (!quiet) A().toast('지시를 저장했다 (공개 전까지 GM만 본다)');
      if ((c.ST.state.ready || {})[tid]) await putShape(tid);
      return true;
    } catch (e) {
      A().toast('저장 실패: ' + e.message);
      return false;
    }
  }
  /* 지시의 「꼴」만 공개 칸에 둔다 — 「타임」이 보는 건 교대인지 기술인지뿐 (맵툴 active_command_expert 와 같다) */
  async function putShape(tid, clear) {
    const c = ctx();
    const b = c.b;
    const cur = CMD[tid];
    const mons = {};
    if (!clear && cur) {
      for (const mid in cur.mons) {
        const m = b.mons[mid];
        if (!m || !m.entry) continue;
        const x = cur.mons[mid];
        mons[mid] = x.move === 'switch' ? 'switch' : x.move === '' || x.move == null ? 'none' : 'move';
      }
    }
    try {
      await A().set(['pub', tid, 'shape'], clear ? null : { turn: +b.turn || 0, mons });
    } catch (e) {}
    try {
      let pre = null;
      if (!clear && cur && enemyTids(c, tid).some(e => seeHas(b, e, PRESEE_RE))) {
        const M = {};
        for (const mid in cur.mons) {
          const m = b.mons[mid];
          if (!m || !m.entry) continue;
          const x = cur.mons[mid] || {};
          const L = [];
          if (x.order) L.push('명령 『' + pName(b, tid, 'order', x.order) + '』');
          if (x.command) L.push('지령 『' + pName(b, tid, 'command', x.command) + '』');
          for (const n of x.pots || []) L.push('『' + String(n).replace(/[『』]/g, '') + '』');
          if (L.length) M[mid] = L;
        }
        pre = { turn: +b.turn || 0, mons: M, u: (cur.upots || []).map(n => String(n).replace(/[『』]/g, '')) };
      }
      if (pre || ((c.ST.state.pub || {})[tid] || {}).pre) await A().set(['pub', tid, 'pre'], pre);
    } catch (e) {}
  }
  async function loadCmd(tid) {
    const c = ctx();
    try {
      const rows = await DBS().secretGet(c.ST.room, c.ST.secret, 'cmd');
      const r = (rows || []).find(x => x.id === tid);
      if (!r) return A().toast('저장된 지시가 없다');
      CMD[tid] = Object.assign({ mons: {}, detail: '' }, JSON.parse(JSON.stringify(r.data)), { turn: +c.b.turn || 0 });
      delete CMD[tid].order;
      delete CMD[tid].command;
      if (!cmdFresh(r)) {
        CMD[tid].upots = [];
        for (const k in CMD[tid].mons || {}) {
          const x = CMD[tid].mons[k];
          x.pots = [];
          x.order = '';
          x.command = '';
        }
      }
      A().renderScene();
      A().toast('불러왔다');
    } catch (e) {
      A().toast(e.message);
    }
  }
  /* 함께 지시하기: 저장된 지시를 지시 창으로 — 처음 열 때(아직 손대지 않았으면), 그리고 같이 보는 사람이 저장했을 때 */
  const PULL = {};
  async function coPull(tid, who) {
    const c = ctx();
    const key = turnKey(c.b) + ':' + tid;
    if (!who && PULL[key]) return;
    PULL[key] = 1;
    let rows;
    try {
      rows = await DBS().secretGet(c.ST.room, c.ST.secret, 'cmd');
    } catch (e) {
      return;
    }
    const r = (rows || []).filter(x => cmdFresh(x, ctx().b)).find(x => x.id === tid);
    if (!r || !r.data) return;
    const now = cmdNow(tid, ctx().b);
    if (!who && now && !now.fresh) return;
    CMD[tid] = Object.assign({ mons: {}, detail: '', upots: [] }, JSON.parse(JSON.stringify(r.data)), { turn: +ctx().b.turn || 0 });
    A().renderScene();
    if (who) A().toast(`${who} 님이 「${((ctx().b.trainers || {})[tid] || {}).name || tid}」 지시를 저장했다 — 지시 창에 불러왔다`);
  }
  const CSEEN = {};
  function coWatch() {
    const c = ctx();
    if (!c.gm && c.role !== 'seat') return;
    const me = c.gm ? 'gm' : c.seat;
    for (const tid of myTrainers(c)) {
      if (!coOf(c, tid).length) continue;
      const s = ((c.ST.state.pub || {})[tid] || {}).csav;
      if (CSEEN[tid] == null) {
        CSEEN[tid] = (s && +s.at) || 0;
        continue;
      }
      if (s && s.at > CSEEN[tid]) {
        CSEEN[tid] = s.at;
        if (s.by !== me) coPull(tid, String(s.name || s.by || '').slice(0, 30) || '함께 지시하는 사람');
      }
    }
  }
  /* 10-24 망령: 개인전 켜기 · 끄기 — GM 과 그 트레이너 주인. 같은 진영에 둘 이상 있을 때만 의미가 있다 */
  function soloTag(c, tid, ids) {
    const t = (c.b.trainers || {})[tid] || {};
    const can = (c.gm || ownT(c, tid)) && (ids || []).length > 1 && (t.solo || (ids || []).indexOf(tid) > 0);
    /* 진영 맨 앞 트레이너는 기준이라 버튼 없음 (뒤에 선 트레이너를 개인전으로) */ if (!t.solo && !can) return '';
    return can
      ? ` <button class="tag solo ${t.solo ? 'on' : ''}" data-act="solo" data-tid="${tid}" title="${t.solo ? '개인전 — 같은 진영의 다른 트레이너와 정보를 나누지 않고 서로 적으로 싸운다. 누르면 같은 팀으로' : '같은 팀 — 누르면 개인전(정보 비공유 · 서로 적)으로'}">${t.solo ? '⚔ 개인전' : '같은 팀'}</button>`
      : ' <span class="tag solo on" title="개인전 — 같은 진영이어도 한 편이 아니다">⚔ 개인전</span>';
  }
  async function toggleSolo(tid) {
    const c = ctx();
    const t = (c.b.trainers || {})[tid];
    if (!t || !(c.gm || ownT(c, tid))) return;
    const on = !t.solo;
    if (await A().set(['battle', 'trainers', tid, 'solo'], on ? true : null))
      A().sysLog(`${t.name} — ${on ? '개인전 (같은 진영과도 정보를 나누지 않고 서로 적)' : '같은 팀으로 (진영과 정보 공유)'}`, 'battle');
  }
  /* 함께 지시할 좌석 고르기 — 트레이너 주인과 GM 만. 트레이너 시트에 적는다 */
  function openCo(tid) {
    const c = ctx();
    if (!c.gm && tid !== c.seat) return;
    const R = ((c.ST.state.roster || {}).trainers || {})[tid];
    if (!R) return A().toast('시트에 있는 트레이너만 함께 지시할 수 있다');
    const seats = Object.entries(c.ST.state.seats || {}).filter(([k]) => k !== tid);
    const on = new Set(coOf(c, tid));
    const md = A()
      .openModal(`<div class="mhead"><h2>함께 지시하기 — ${esc(R.name || tid)}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="small dim" style="margin-bottom:10px">고른 플레이어는 이 트레이너의 지시 창을 같이 보고 고치고, 준비 완료 · 지시 공개 · 포켓몬 조작(HP · 공격 · 교대 …)도 함께 한다. 누가 저장하면 같이 보는 화면에 바로 불러온다.</div>
   <div class="cosel">${
     seats.length
       ? seats
           .map(([k, v]) => {
             const tn = (((c.ST.state.roster || {}).trainers || {})[k] || {}).name;
             return `<label class="coseat"><input type="checkbox" value="${esc(k)}" ${on.has(k) ? 'checked' : ''}><b>${esc((v && v.name) || k)}</b>${tn ? `<small>${esc(tn)}</small>` : ''}</label>`;
           })
           .join('')
       : '<div class="dim">자리에 앉은 다른 플레이어가 없다</div>'
   }</div>
   <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn pri" data-cosave>저장</button></div>`);
    md.querySelector('[data-cosave]').onclick = async () => {
      const pick = [...md.querySelectorAll('.cosel input:checked')].map(i => i.value);
      const before = coOf(ctx(), tid);
      const r = await A().set(['roster', 'trainers', tid, 'co'], pick.length ? pick : null);
      if (r === false) return;
      A().closeModal();
      const nm = s => ((ctx().ST.state.seats || {})[s] || {}).name || s;
      const add = pick.filter(s => !before.includes(s)),
        del = before.filter(s => !pick.includes(s));
      if (add.length || del.length)
        A().sysLog(
          `함께 지시하기 — ${R.name || tid}: ${[add.length ? add.map(nm).join(' · ') + ' 합류' : '', del.length ? del.map(nm).join(' · ') + ' 빠짐' : ''].filter(Boolean).join(' / ')}`,
          'battle'
        );
    };
  }
  async function toggleReady(tid) {
    const c = ctx();
    const rd = !!(c.ST.state.ready || {})[tid];
    /* 11-03 감우 (검토 17): 「준비 완료」 때 행동이 비어 있는 에리어가 있으면 묻는다 */
    if (!rd) {
      const cur = CMD[tid];
      const none = Object.values(c.b.mons || {})
        .filter(m => m.tid === tid && m.entry && m.hp.cur > 0)
        .sort((x, y) => x.entry.localeCompare(y.entry))
        .filter(m => {
          const x = cur && cur.mons && cur.mons[m.id];
          return !x || x.move === '' || x.move == null;
        });
      if (
        none.length &&
        !(await askYes(
          `${none.map(m => `${String(m.entry).toUpperCase()} ${m.name}`).join(' · ')}${none.length > 1 ? '는' : '은(는)'} 행동이 비어 있다.\n행동 없음으로 둘까?`,
          '행동 없음으로',
          '돌아가서 고친다'
        ))
      )
        return;
    }
    if (!rd) {
      const ok = await saveCmd(tid, true);
      if (!ok) return;
    }
    if (rd && !c.mgr && (+c.b.phase || 0) >= 1) return A().toast('턴이 시작돼서 준비를 풀 수 없다');
    const path = c.mgr || ownT(c, tid) ? ['ready', tid] : ['ready', c.seat];
    await putShape(tid, rd);
    await A().set(path, rd ? null : true);
    A().sysLog(`${((c.b.trainers || {})[tid] || {}).name || tid} ${rd ? '준비 해제' : '준비 완료'}`, 'battle');
    /* 10-24 망령: 자리에 앉은 트레이너가 모두 준비를 마치면 한 줄 알림 (마지막으로 누른 사람이 쓴다) */
    if (!rd) {
      const R = Object.assign({}, c.ST.state.ready || {});
      R[path[1]] = true;
      const seats = c.ST.state.seats || {};
      const T = Object.keys(c.b.trainers || {}).filter(t => seats[t] || baseSeat(c, t));
      if (T.length >= 2 && T.every(t => R[t]))
        A().sysLog(`【준비 완료】 양측 모두 지시 준비를 마쳤다${c.mgr ? '' : ' — GM 의 「턴 개시」를 기다린다'}`, 'battle');
    }
  }
  /* 11-04 망령 「2체 기준 들고 가는 4식 6령 — 합산 아니니?」 → 「나」: 던전 배틀(b.dg)은 같은 진영 일행의 4식 · 6령을 합쳐 쓴다.
    남이 고른 종류도 빌려 쓴다(각성체 대가로 0 인 종류도 일행 몫이 있으면 쓴다). 내 몫을 먼저 쓰고, 없으면 일행 몫(진영 순서)에서 뺀다. 공동 지휘(@) 몫은 빌리지 않는다 */
  function pMates(b, tid) {
    if (!b || !(b.dg || b.ordPool)) return [];
    const S = b.sides || {};
    for (const sd of ['left', 'right']) {
      const L = (S[sd] || {}).trainers || [];
      if (L.includes(tid)) return L.filter(x => x !== tid && (b.trainers || {})[x]);
    }
    return [];
  }
  function pN(b, tid, ck, T) {
    T = T || b.trainers || {};
    let n = Math.max(0, +((T[tid] || {}).orderCount || {})[ck] || 0);
    if (String(ck).includes('@')) return n;
    for (const o of pMates(b, tid)) n += Math.max(0, +((T[o] || {}).orderCount || {})[ck] || 0);
    return n;
  }
  function pBorrow(b, tid, ck, T) {
    if (String(ck).includes('@')) return '';
    T = T || b.trainers || {};
    for (const o of pMates(b, tid)) {
      const oc = (T[o] || {}).orderCount || {};
      if ((+oc[ck] || 0) > 0) {
        T[o].orderCount = Object.assign({}, oc, { [ck]: (+oc[ck] || 0) - 1 });
        return o;
      }
    }
    return '';
  }
  /* 내 몫이 있으면 내 것에서, 없으면 일행에서 하나 — t 는 내 트레이너(고칠 사본), T 는 일행을 고칠 사본(없으면 빌린 키만 돌려준다) */
  function pSpend(b, tid, t, ck, T, bor) {
    t.orderCount = t.orderCount || {};
    if ((+t.orderCount[ck] || 0) > 0) {
      t.orderCount[ck] = (+t.orderCount[ck] || 0) - 1;
      return;
    }
    if (T) {
      pBorrow(b, tid, ck, T);
    } else if (bor) bor.push(ck);
  }
  /* 11-05 00:07 망령 「동시 저장이 겹쳐 횟수가 되돌아가면 무조건 고쳐야」: 트레이너 칸을 setDiff(…,1) 로 쓰면 orderCount · pcList 같은 칸이 「통째로」 옛 사본 값으로 덮였다
    (선행 발동 창을 띄워 둔 사이 다른 화면이 턴 개시 차감을 하면, 발동 저장이 그 차감을 지웠다 — 쓴 4식이 다시 「남은 1」).
    → 바뀐 잎만 쓰고, 횟수(orderCount · uUses)는 「이 화면이 바꾼 만큼(차이)」을 지금 서버 값에 더해서 쓴다 */
  const jeq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function trOps(tid, t0, t1) {
    t0 = t0 || {};
    t1 = t1 || {};
    const cur = ((ctx().b || {}).trainers || {})[tid] || t0;
    const ops = [];
    const CNT = { orderCount: 1, uUses: 1 };
    for (const k of new Set([...Object.keys(t0), ...Object.keys(t1)])) {
      if (jeq(t0[k], t1[k])) continue;
      const a = t0[k],
        z = t1[k];
      if (CNT[k] && (a == null || typeof a === 'object') && z && typeof z === 'object') {
        const A0 = a || {},
          F = cur[k] || {};
        for (const q of new Set([...Object.keys(A0), ...Object.keys(z)])) {
          if (jeq(A0[q], z[q])) continue;
          if (z[q] == null) {
            ops.push([['battle', 'trainers', tid, k, q], null]);
            continue;
          }
          const d = (+z[q] || 0) - (+A0[q] || 0);
          ops.push([['battle', 'trainers', tid, k, q], Math.max(0, (+F[q] || 0) + d)]);
        }
      } else A().diffOps(['battle', 'trainers', tid, k], a, z, 1, ops);
    }
    return ops;
  }
  function saveTr(tid, t0, t1) {
    const ops = trOps(tid, t0, t1);
    return ops.length ? A().setMany(ops) : Promise.resolve(true);
  }
  async function pBorrowSave(tid, list) {
    for (const ck of list || []) {
      const b = ctx().b;
      const T0 = snap(b.trainers || {}),
        T = snap(T0);
      const o = pBorrow(b, tid, ck, T);
      if (!o) continue;
      await saveTr(o, T0[o], T[o]);
    }
  }
  function pKeys(b, tid, kind) {
    const t = (b.trainers || {})[tid] || {};
    const f = kind === 'order' ? OO().orderKeys : OO().commandKeys;
    const ks = f(t).slice();
    for (const o of pMates(b, tid)) for (const k of f(b.trainers[o])) if (!k.includes('@') && !ks.includes(k)) ks.push(k);
    return ks;
  }
  function pName(b, tid, kind, k) {
    const t = (b.trainers || {})[tid] || {};
    const f = kind === 'order' ? OO().orderName : OO().commandName;
    let n = f(t, k);
    if (n === k)
      for (const o of pMates(b, tid)) {
        const n2 = f(b.trainers[o], k);
        if (n2 !== k) {
          n = n2;
          break;
        }
      }
    return n;
  }
  function pLend(b, tid, ck) {
    return pMates(b, tid).length && !(+(((b.trainers || {})[tid] || {}).orderCount || {})[ck] > 0) && pN(b, tid, ck) > 0;
  }
  /* 턴 개시: 선행 입력한 지령·명령의 횟수를 미리 깎는다 (맵툴 set_turn_start). 주인의 호령(tc 7)은 능력·회복이 횟수를 같이 쓴다 */
  function chargeOne(t, data, b, used, T, bor, tid) {
    t.orderCount = t.orderCount || {};
    const tc = OO().styles(t).tc;
    t.pcList =
      {}; /* 11-03 20:47 (이토리 시온 「지령 선행 입력이 턴 개시에 자동 발동됐는데 횟수가 안 빠졌다」): 이번 턴에 무엇을 깎았는지 남긴다 — 깎은 뒤에 넣거나 바꾼 지령은 발동 때 깎는다 */
    for (const mid in data.mons || {}) {
      const m = b.mons[mid];
      if (!m) continue;
      const x = data.mons[mid];
      const PS =
        t.preSpent && t.preSpent.k === turnKey(b)
          ? (t.preSpent.m || {})[mid] || {}
          : {}; /* 11-04: 선행 발동 때 이미 깎은 것(preSpent)은 건너뛴다 */ /* 11-03 22:20 이토리 시온 「물러나 · 피해라 · 바꿔라 · 방어지령 · 특방지령 횟수가 안 빠졌다」: 늦게 깎을 때(턴 진행 뒤) 교대로 나갔거나 쓰러진 포켓몬 몫을 건너뛰지 않는다 — 지시는 필드에 있을 때만 넣을 수 있으니 넣은 것은 다 깎는다 */
      if (x.order && PS.o !== x.order) {
        const k = 'order_' + x.order;
        pSpend(b, tid, t, k, T, bor);
        if (used) used.o++;
      }
      if (x.order || x.command) t.pcList[mid] = { o: x.order || '', c: x.command || '' };
      if (x.command && PS.c !== x.command) {
        const dec = k => {
          t.orderCount[k] = Math.max(0, (+t.orderCount[k] || 0) - 1);
        };
        pSpend(b, tid, t, 'command_' + x.command, T, bor);
        if (used) used.c++;
        const sk = OO().shareKey(t, x.command);
        if (sk) dec('command_' + sk);
      }
    }
  }
  async function preCharge() {
    const c = ctx();
    const b = c.b;
    const key = turnKey(b);
    if (!c.gm) {
      for (const t of myTrainers(c).filter(t => lead(c, t))) await selfCharge(t);
      return;
    }
    let rows;
    try {
      rows = await DBS().secretGet(c.ST.room, c.ST.secret, 'cmd');
    } catch (e) {
      return;
    }
    const trs0 = snap(ctx().b.trainers || {}),
      trs = snap(trs0);
    let any = false;
    const used = { o: 0, c: 0 };
    for (const r of rows || []) {
      const t = trs[r.id];
      if (!t || !r.data || !cmdFresh(r, b) || t.pcTurn === key) continue;
      if (c.fair && seatOwned(c, r.id)) continue;
      chargeOne(t, r.data, b, used, trs, null, r.id);
      t.pcTurn = key;
      any = true;
    }
    if (any) {
      const ops = [];
      for (const tid in trs) ops.push(...trOps(tid, trs0[tid], trs[tid]));
      if (ops.length) await A().setMany(ops);
    }
  }
  /* 좌석: 내 지시의 선입력분은 내 화면이 깎는다 (모의전 · GM 불간섭 · GM 이 없을 때) */
  const BUSY = {},
    SENT = {};
  /* 11-03 22:20 (PL 권한 판에서 선행 입력 횟수가 턴마다 들쭉날쭉 빠지던 것): ① 예전엔 페이즈 1(턴 개시 ~ 행동 순서)을 내 화면이 「보는 동안」에만 깎았다 — 진행자가 곧장 행동 단계로 넘기거나 휴대폰이 뒤에 있으면 그 턴을 통째로 건너뛰었다 → 시합 중이고 페이즈 1 이상이면 언제든 이번 턴 몫을 깎는다.
    ② 지시를 못 읽었을 때(통신 오류)도 「깎음」으로 적어 버려 다시 안 깎았다 → 못 읽으면 적지 않고 다음에 다시. ③ 대기 표시(BUSY.pc)가 트레이너 구분 없이 하나라 함께 지시하는 두 번째 트레이너가 막혔다 */
  async function selfCharge(tid0) {
    const c = ctx();
    const b = c.b;
    const tid = tid0 || c.seat;
    const t = (b.trainers || {})[tid];
    if (c.role !== 'seat' || !t || !b.started || (+b.phase || 0) < 1) return;
    const key = turnKey(b);
    const bk = 'pc:' + tid;
    if (t.pcTurn === key || BUSY[bk] === key) return;
    BUSY[bk] = key;
    try {
      let rows;
      try {
        rows = await DBS().secretGet(c.ST.room, c.ST.secret, 'cmd');
      } catch (e) {
        BUSY[bk] = null;
        return;
      }
      const r = (rows || []).filter(x => cmdFresh(x, ctx().b)).find(x => x.id === tid);
      const cm = r && r.data;
      if (turnKey(ctx().b) !== key) return;
      const t0 = snap((ctx().b.trainers || {})[tid] || t),
        t2 = snap(t0);
      if (t2.pcTurn === key) return;
      const used = { o: 0, c: 0 };
      const bor = [];
      if (cm) chargeOne(t2, cm, ctx().b, used, null, bor, tid);
      else t2.pcList = {};
      t2.pcTurn = key;
      if (!(await saveTr(tid, t0, t2))) BUSY[bk] = null;
      else if (bor.length) await pBorrowSave(tid, bor);
    } catch (e) {
      BUSY[bk] = null;
      console.warn('선행 차감', e);
    }
  }
  /* GM: PL 권한 중 좌석 트레이너 몫은 좌석 화면이 깎는데, 그 좌석(과 함께 지시하는 좌석)이 아무도 접속해 있지 않으면 GM 화면이 대신 깎는다 */
  async function gmChargeOrphans() {
    const c = ctx();
    const b = c.b;
    if (!c.gm || !c.fair || !b.started || (+b.phase || 0) < 1) return;
    const key = turnKey(b);
    const T = Object.keys(b.trainers || {}).filter(
      tid => seatOwned(c, tid) && (b.trainers[tid] || {}).pcTurn !== key && !A().online(tid) && !coOf(c, tid).some(s => A().online(s))
    );
    if (!T.length || BUSY.gpc === key + ':' + T.join(',')) return;
    BUSY.gpc = key + ':' + T.join(',');
    let rows;
    try {
      rows = await DBS().secretGet(c.ST.room, c.ST.secret, 'cmd');
    } catch (e) {
      BUSY.gpc = null;
      return;
    }
    for (const tid of T) {
      const r = (rows || []).filter(x => cmdFresh(x, ctx().b)).find(x => x.id === tid);
      const t0 = snap((ctx().b.trainers || {})[tid] || {}),
        t2 = snap(t0);
      if (t2.pcTurn === key) continue;
      const bor = [];
      if (r && r.data) chargeOne(t2, r.data, ctx().b, { o: 0, c: 0 }, null, bor, tid);
      else t2.pcList = {};
      t2.pcTurn = key;
      if ((await saveTr(tid, t0, t2)) && bor.length) await pBorrowSave(tid, bor);
    }
  }
  /* 상태가 바뀔 때마다 (app.js onState): 턴 개시면 내 선입력 차감, 공개 요청이 오면 내 남은 지시를 연다, 진행자는 자동으로 넘긴다 */
  /* 10-26 망령: 배틀 준비(시합 개시 전) 중에 한 파티에 같은 소지품이 겹치면 그 파티를 다루는 사람(GM · 그 좌석)에게만 한 번 알린다. 소지품을 또 바꿔 다르게 겹치면 다시 */
  const DUP_SEEN = {};
  function dupWatch(c, b) {
    if (!b || b.started || !A().dupItems) return;
    const T = b.trainers || {};
    for (const [tid, t] of Object.entries(T)) {
      if (!(c.gm || ownT(c, tid))) continue;
      const d = A().dupItems(Object.values(b.mons || {}).filter(m => m.tid === tid));
      if (!d.length) continue;
      const key = (A().ST.room || '') + '|' + tid + '|' + JSON.stringify(d);
      if (DUP_SEEN[key]) continue;
      DUP_SEEN[key] = 1;
      const tx = A().dupItemText(t.name || tid, d);
      A().selfLog(tx);
      A().toast(tx);
    }
  }
  /* 10-26 망령: 【지연 (N턴)】 = 필드에 나온 턴을 1턴째로 셀 때 N번째 턴부터. 【지연 (N턴 동안)】 = 나온 턴부터 N턴 동안.
    턴이 바뀔 때마다(GM 창) 필드 포켓몬의 특성 · 소지품 · 포텐셜 글을 보고, 도달한 것은 알린다. 지연 표시가 ① 줄에 있고 구문이 있으면 N번째 턴에 자동 발동 */
  const DELAY_SEEN = {};
  const DLY_RE = /【[^】]*지연\s*\((아군,\s*)?(\d+)\s*턴(\s*동안)?\)[^】]*】/;
  /* 10-27 망령: 자동 처리는 한 창만 — 「플레이어도 배틀 진행」이면 좌석도 진행 권한이라 창마다 따로 돌아 【지연】 이 두 번 찍혔다.
    접속 중인 GM 창이 있으면 그중 하나(id 가 가장 작은 것), 없으면 진행 권한 좌석 중 하나만 */
  function myPid() {
    try {
      const P = A().presList ? A().presList() : [];
      const me = P.find(p => p.me);
      return me ? String(me.id) : '?';
    } catch (e) {
      return '?';
    }
  }
  function isLeader(c) {
    if (!c || !c.mgr) return false;
    const P = (A().presList ? A().presList() : []).filter(p => p.role === 'gm' || p.role === 'seat');
    const gms = P.filter(p => p.role === 'gm');
    const pool = gms.length ? gms : P;
    if (!pool.length) return true;
    const lead = pool.slice().sort((x, y) => (String(x.id) < String(y.id) ? -1 : String(x.id) > String(y.id) ? 1 : 0))[0];
    return !!lead.me;
  }
