  /* ── 조각 13_raid_seal.js — 레이드 · 봉인 ── */
  /* ---------- 레이드 배틀 (맵툴 raid_set · raid_turnend · raid_phase · raid_cure · raid_reset_one) ----------
    배리어: 최대 HP × k/X 자리마다. 닿으면 깨지고(그 아래로는 그 피해에서 안 깎임) 회복해도 되살아나지 않는다.
    깨진 턴(또는 cond:every 면 매 턴)이 끝난 뒤 「트리거 : 페이즈 체인지」: ② 자신의 부정적인 상태(cstat: 능력치 하락도) 초기화 ③ 적진 전체 능력치 상승(rmod: 배율 강화도) 초기화 */
  async function raidFix(m, m0, name, L) {
    if (!m.raid) return 0;
    const R = m.raid;
    const was = !!(m0 && m0.raid && +m0.raid.segments > 0);
    /* 11-28 망령 「이건 왜 모든 매크로마다 출력하는 거야?」: 이미 레이드인 포켓몬의 다른 효과를 낼 때마다 레이드 설명이 붙었다 — 설명은 처음 걸 때와 레이드 배틀 포텐셜을 낼 때만 */
    if (was && !/레이드\s*배틀/.test(String(name || ''))) return 0;
    if (!(+R.segments > 0)) {
      let X = +(String(name || '').match(/(\d+)/) || [])[1] || 0; /* X 가 비어 있으면 포텐셜 이름 속 숫자 (레이드 배틀 : 4 → 4) */
      if (!X) {
        const v = prompt('「레이드 배틀 : X」의 X를 정해 줘.\n최대 HP 의 1/X 마다 배리어가 생긴다.', '3');
        if (v === null) return null;
        X = +v || 3;
      }
      R.segments = X;
    }
    R.segments = Math.max(1, Math.floor(+R.segments));
    for (const [k, v] of [
      ['cure', 1],
      ['cstat', 1],
      ['rup', 1],
      ['rmod', 0]
    ])
      if (R[k] == null || R[k] === '') R[k] = v;
    R.cond = R.cond || 'cap';
    R.name = R.name || String(name || '');
    if (!was) {
      R.broken = 0;
      R.phase = +R.phase || 1;
      delete R.brk;
    }
    const X = R.segments,
      cap = Math.max(1, Math.floor(m.hp.max / X));
    const txt = `「레이드 배틀 : ${X}」 — 「HP : 1/${X}」(${cap})마다 배리어. 배리어 아래로 내려가는 피해는 받지 않고, 배리어는 닿으면 깨지며 회복해도 되살아나지 않는다. ${R.cond === 'every' ? '매 턴' : '배리어가 깨진 턴'} 종료 이후 「트리거 : 페이즈 체인지」${+R.cure ? `\n· 자신의 모든 부정적인 상태${+R.cstat ? '(능력치 하락 포함)' : ''} 초기화` : ''}${+R.rup ? `\n· 적진 전체의 모든 능력치 상승${+R.rmod ? '·강화' : ''} 초기화` : ''}`;
    const i = L.findIndex(x => /레이드 배틀 설정/.test(x));
    if (i >= 0) L[i] = txt;
    else L.push(txt);
    return was ? 0 : 1;
  }
  function raidCut(m) {
    try {
      const cfg = (A().ST.state.rp || {}).cutin || {};
      if (cfg.start === 'off' || !CUT() || !CUT().raid) return;
      const R = m.raid || {};
      CUT().raid({
        img: m.image,
        n: m.name,
        title: '레이드 배틀 : ' + R.segments,
        tape: '⚠ WARNING ⚠ 레이드 보스 출현',
        nohp: cfg.warnHp ? 0 : 1,
        x: R.segments,
        hp: m.hp.cur > 0 ? Math.max(1, Math.round((m.hp.cur / m.hp.max) * 100)) : 0,
        ph: R.phase || 1,
        label: 'RAID BATTLE'
      });
    } catch (e) {}
  }
  function modDrop(m, k) {
    if (m.mod) delete m.mod[k];
    if (m.fx && m.fx.mults)
      m.fx.mults = m.fx.mults
        .map(e => {
          const st = Object.assign({}, e.stats);
          delete st[k];
          return Object.assign({}, e, { stats: st });
        })
        .filter(e => Object.keys(e.stats).length);
  }
  function raidPhase(b, m, why) {
    const R = m.raid;
    R.phase = (+R.phase || 1) + 1;
    /* 11-28 「페이즈 2」만 적으면 【페이즈 체인지 : 2】(2번 일어난 뒤)와 헷갈린다 — 몇 번째인지를 앞에 */
    const out = [`「트리거 : 페이즈 체인지」 ${m.name} · ${R.phase - 1}번째 (페이즈 ${R.phase})${why ? ' (' + why + ')' : ''}`];
    const RK = Object.assign({}, STAT_KO, { critical: '급소' });
    const on = (k, d) => (R[k] == null || R[k] === '' ? d : +R[k]);
    if (on('cure', 1)) {
      const NEG = (FX() && FX().NEG) || [];
      const sdb = (DB().states || {}).st || {};
      const st = m.states || {};
      const c = [];
      for (const k of Object.keys(st))
        if (st[k] && NEG.includes(k)) {
          delete st[k];
          c.push(`「${(sdb[k] || {}).ko || k}」`);
        }
      if (m.seedFrom && !st.LeechSeed) delete m.seedFrom;
      const d = [];
      if (on('cstat', 1)) {
        m.rank = m.rank || {};
        for (const k in m.rank)
          if (+m.rank[k] < 0) {
            d.push(`${RK[k] || k} ${m.rank[k]}→0`);
            m.rank[k] = 0;
          }
        for (const k in m.mod || {})
          if (+m.mod[k] < 1) {
            d.push(`${RK[k] || k} ×${m.mod[k]}→×1`);
            modDrop(m, k);
          }
      }
      out.push(
        c.length || d.length
          ? `② 자신의 부정적인 상태를 초기화했다! ${c.join('')}${d.length ? ' / ' + d.join(' ') : ''}`
          : '② 자신에게 초기화할 부정적인 상태가 없다.'
      );
    }
    if (on('rup', 1)) {
      const e = [];
      for (const id in b.mons) {
        const x = b.mons[id];
        if (x === m || !x.entry || x.hp.cur <= 0 || sameT(x, m, b)) continue;
        const d = [];
        x.rank = x.rank || {};
        for (const k in x.rank)
          if (+x.rank[k] > 0) {
            d.push(`${RK[k] || k} +${x.rank[k]}→0`);
            x.rank[k] = 0;
          }
        if (x.tempRank) for (const k in x.tempRank) if (+x.tempRank[k] > 0) delete x.tempRank[k];
        if (on('rmod', 0))
          for (const k in x.mod || {})
            if (+x.mod[k] > 1) {
              d.push(`${RK[k] || k} ×${x.mod[k]}→×1`);
              modDrop(x, k);
              if (x.tempMod) delete x.tempMod[k];
            }
        if (d.length) e.push(`「${x.name}」 ${d.join(' ')}`);
      }
      out.push(e.length ? `③ 적진 전체의 능력치 상승을 초기화했다!\n   ${e.join('\n   ')}` : '③ 적진에 초기화할 능력치 상승이 없다.');
    }
    return out;
  }
  /* 수동 페이즈 체인지 (버프 관리 raid_pc) */
  async function raidPhaseNow(mid, why) {
    const c = ctx();
    if (!c.mgr) return;
    const b0 = snap(c.b),
      b = snap(b0);
    const m = b.mons[mid];
    if (!m || !m.raid) return;
    const L = raidPhase(b, m, why || '수동 발동');
    delete m.raid.brk;
    if (!(await saveBattle(b0, b))) return;
    A().sysLog(`【레이드】 ${L.join('\n')}`, 'battle', { mid, img: m.image || '' });
    await phaseReact([mid]);
  }
  /* 「레이드 배틀 : 4」 ②: 「3」 배수 턴의 가장 마지막에 추가 행동 (【사전】 공개) — 맵툴처럼 손으로 하되 알려 준다 */
  function raidExtra(b) {
    const t = +b.turn || 0;
    if (!t || t % 3) return;
    for (const id in b.mons) {
      const m = b.mons[id];
      if (!m.raid || !(+m.raid.segments > 0) || !m.entry || m.hp.cur <= 0) continue;
      const p = potSrc(m).find(p => p && /레이드 배틀/.test(p.name || '') && /추가 행동/.test(p.eff || ''));
      if (p)
        A().sysLog(`【레이드】 ${m.name} — 「3」의 배수 턴(턴 ${t})의 가장 마지막: 추가 행동을 얻는다 (【사전】에 공개)`, 'battle', {
          mid: m.id,
          img: m.image || ''
        });
    }
  }
  function raidFloor(m) {
    if (!m || !m.raid || !(+m.raid.segments > 0)) return 0;
    const X = +m.raid.segments,
      br = +m.raid.broken || 0;
    let fl = 0;
    for (let k = X - 1 - br; k >= 1; k--) {
      const v = Math.floor((m.hp.max * k) / X);
      if (v < m.hp.cur) {
        fl = v;
        break;
      }
    }
    return fl;
  }
  /* 10-26 망령: 행동 순서가 나온 뒤에 발동한 우선도(선행유턴 · 지휘봉 …)는 아직 행동하지 않은 칸들 사이에서 다시 줄을 세운다 */
  function prioNow(mid) {
    try {
      const m = (ctx().b.mons || {})[mid];
      return m && FX() && FX().prioOf ? FX().prioOf(m, { prio: 0, cat: '', typeEn: '' }) : 0;
    } catch (e) {
      return 0;
    }
  }
  async function reprio(mid, before, tries) {
    tries = tries || 0;
    await new Promise(r => setTimeout(r, 700));
    const b = ctx().b;
    const ph = +b.phase || 0;
    if (ph < 2) return;
    const d = prioNow(mid) - before;
    if (!d) {
      if (tries < 6) return reprio(mid, before, tries + 1);
      return;
    }
    const O = (b.order || []).map(o => Object.assign({}, o));
    const i = ph === 2 ? -1 : +b.orderIdx || 0;
    const k = O.findIndex(o => o.mid === mid && !o.change);
    if (k < 0 || k <= i) return;
    O[k].prio = (+O[k].prio || 0) + d;
    const head = O.slice(0, i + 1),
      tail = O.slice(i + 1);
    tail.sort(
      (a, c) =>
        (c.started || 0) - (a.started || 0) ||
        (c.change || 0) - (a.change || 0) ||
        (c.order || 0) - (a.order || 0) ||
        (c.prio || 0) - (a.prio || 0) ||
        (c.speed || 0) - (a.speed || 0) ||
        (c.dice || 0) - (a.dice || 0)
    );
    const NO = head.concat(tail);
    if (NO.map(o => o.mid).join() === O.map(o => o.mid).join() && O[k].prio === (+((b.order || [])[k] || {}).prio || 0)) return;
    await A().set(['battle', 'order'], NO);
    A().sysLog(
      `${(b.mons[mid] || {}).name || '?'} 우선도 ${d > 0 ? '+' : ''}${d} — 남은 행동 순서를 다시 정했다\n${NO.slice(i + 1)
        .map((o, j) => `${i + 2 + j}. ${o.name}${o.change ? ' (교대)' : ''}`)
        .join('\n')}`,
      'battle'
    );
  }
  /* 10-26 망령: 브라우저 확인창(confirm) 대신 창 안 확인 — 확인창이 막히거나 취소되어 진행이 멈추던 것 */
  /* 11-03 감우 (검토 16): 공격 창 결과 — 표로 스크롤 · 휴대폰 sticky 요약 줄 (.asum1, 760px 이하에서만 보인다) */
  function aScroll(md) {
    try {
      const ar = md.querySelector('#ares');
      if (ar && ar.firstElementChild) setTimeout(() => ar.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
    } catch (e) {}
  }
  function aSum(md, html) {
    try {
      let s1 = md.querySelector('.asum1');
      if (!s1) {
        s1 = document.createElement('div');
        s1.className = 'asum1';
        const h = md.querySelector('.mhead');
        if (h) h.after(s1);
        else md.prepend(s1);
      }
      s1.innerHTML = html;
      s1.classList.add('on');
    } catch (e) {}
  }
  function askYes(q, yes, no) {
    return new Promise(res => {
      const md = A().openModal(
        `<div class="mhead"><h2>확인</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="small" style="white-space:pre-wrap;margin-bottom:10px">${esc(String(q || ''))}</div><div class="row"><span class="sp"></span><button class="btn" data-ay="0">${esc(no || '아니요')}</button><button class="btn pri" data-ay="1">${esc(yes || '예')}</button></div>`
      );
      let done = false;
      const fin = v => {
        if (done) return;
        done = true;
        A().closeModal();
        res(v);
      };
      md.querySelectorAll('[data-ay]').forEach(b => (b.onclick = () => fin(b.dataset.ay === '1')));
      const x = md.querySelector('[data-x]');
      if (x)
        x.addEventListener('click', () => {
          if (!done) {
            done = true;
            res(false);
          }
        });
    });
  }
  /* ---------- 「봉인」 (11-05 망령 · 우리 사양): 상대에게 걸어 기술폭을 공개시키고, 그중 고른 1개를 내보낼 수 없다 · 교대해도 풀리지 않는다 ----------
    m.sealMove = {name, by} · 걸린 순간(공격 적용 뒤) 건 쪽이 고른다 · 지시 칸에서도 고를 수 있다 */
  const nmMv = v =>
    String(v || '')
      .replace(/『|』/g, '')
      .trim();
  /* 11-07 망령 「도발 상태에서 변화기를 내면 도발이 풀려버림」: 도발 중엔 변화기를 못 고르게 막는다 (GM 은 바로잡기용으로 판정은 되지만 도발 턴은 줄지 않는다) */
  function taunted(m, mv) {
    return !!(m && mv && !mv.virt && (m.states || {}).Taunt && mv.cat === '변화');
  }
  function sealed(m, mv) {
    return !!(m && mv && !mv.virt && (m.states || {}).Seal && m.sealMove && nmMv(mv.name) === nmMv(m.sealMove.name));
  }
  const sealMark = (m, list) => list.map(mv => (sealed(m, mv) || taunted(m, mv) || mvBan(m, mv) ? Object.assign({}, mv, { sealed: 1 }) : mv));
  async function sealPick(byMid, mid) {
    const c = ctx();
    const m = (c.b.mons || {})[mid];
    if (!m || !(m.states || {}).Seal) return;
    const by = byMid ? (c.b.mons || {})[byMid] : null;
    if (by && by.tid && by.tid !== m.tid && window.OM_DEX_UI && window.OM_DEX_UI.analyze) {
      try {
        const sc = window.OM_DEX_UI.scope(mid, by.tid);
        if (sc !== 'all' && !(Array.isArray(sc) && sc.includes('move')))
          await window.OM_DEX_UI.analyze(by.tid, mid, { parts: ['move'], forced: true, free: true });
      } catch (e) {
        console.warn(e);
      }
    }
    if (!(c.mgr || (by && canEdit(c, by)))) {
      A().sysLog(`【봉인】 ${m.name} — ${by ? by.name + ' 쪽이' : '건 쪽이'} 봉인할 기술을 고른다 (지시 칸 「봉인할 기술 고르기」)`, 'battle');
      return;
    }
    const mvs = MVS(m).filter(mv => mv && !mv.virt && !mv.ext);
    if (!mvs.length) return A().toast('고를 기술이 없다');
    const md = A().openModal(
      `<div class="mhead"><h2>「봉인」 — ${esc(m.name)}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="small dim" style="margin-bottom:8px">${esc(m.name)}의 기술이 공개됐다. 내보낼 수 없게 할 기술 1개를 고른다 (교대해도 풀리지 않는다).</div><div class="mvg">${mvs.map((mv, i) => moveCard(mv, i, m.sealMove && nmMv(m.sealMove.name) === nmMv(mv.name), `data-seal="${i}"`)).join('')}</div>`
    );
    md.querySelectorAll('[data-seal]').forEach(
      el =>
        (el.onclick = async e => {
          if (e.target.closest('[data-mvdb]')) return;
          const mv = mvs[+el.dataset.seal];
          A().closeModal();
          const cur = ctx().b.mons[mid];
          if (!cur) return;
          await A().set(['battle', 'mons', mid, 'sealMove'], { name: nmMv(mv.name), by: by ? by.name : '' });
          A().sysLog(`【봉인】 ${cur.name}의 『${nmMv(mv.name)}』 — 내보낼 수 없다${by ? ' (' + by.name + ')' : ''}`, 'battle', {
            mid,
            img: cur.image || ''
          });
        })
    );
  }
