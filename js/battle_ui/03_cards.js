  /* ── 조각 03_cards.js — 로그 카드 연출 · 포텐셜 줄 · 지시 상자 ── */
  /* ---------- 11-03 감우 (검토 6 · 7): 로그를 보고 카드 연출. rp_ui autoSe 가 로그마다 한 번 부른다 (소리 설정이 꺼져 있어도 연출은 나온다) ----------
    · 【피해】(data.hp.cur < prev): 대상 카드(필드 큰 카드 · 벤치) .hit 0.5s 흔들림, 급소면 .crit 붉은 플래시, 빈사면 .ko 0.8s 회색으로 가라앉음
    · 턴 종료 카드(data.seq = [{mid,name,prev,cur,max}] 순서대로): 상태 쓰기는 한 번(om_jset_many)이고, 받는 화면마다 항목을 0.4s 간격으로 HP 바 갱신 + dmg/heal 효과음.
      그 사이 다시 그려져도 hpBar 가 FXS.hold(아직 안 보여 준 prev 값)를 본다 */
  const FXS = {
    hold: {},
    pend: {}
  }; /* pend[mid] = {cls:{hit:until,…}} — 연출 중에 다시 그려져도 render 끝에 reflash 가 되붙인다 (로그가 상태 신호보다 먼저 올 때가 있다) */
  const pctOf = (cur, max) => (cur > 0 ? Math.max(1, Math.round((cur / (max || 1)) * 100)) : 0);
  function cardsOf(mid) {
    return [...document.querySelectorAll(`#scene .mon[data-mon="${CSS && CSS.escape ? CSS.escape(String(mid)) : String(mid)}"]`)];
  }
  function flash(mid, cls, ms) {
    const P = (FXS.pend[mid] = FXS.pend[mid] || {});
    P[cls] = Date.now() + ms;
    for (const el of cardsOf(mid)) {
      el.classList.remove(cls);
      void el.offsetWidth;
      el.classList.add(cls);
    }
    setTimeout(() => {
      if (FXS.pend[mid]) delete FXS.pend[mid][cls];
      for (const el of cardsOf(mid)) el.classList.remove(cls);
    }, ms);
  }
  function reflash() {
    const now = Date.now();
    for (const mid in FXS.pend) {
      const P = FXS.pend[mid];
      for (const cls in P) {
        if (P[cls] <= now) {
          delete P[cls];
          continue;
        }
        for (const el of cardsOf(mid)) el.classList.add(cls);
      }
      if (!Object.keys(P).length) delete FXS.pend[mid];
    }
  }
  function setBar(mid, pct) {
    for (const el of cardsOf(mid)) {
      const bar = el.querySelector('.hpbar');
      if (!bar) continue;
      bar.removeAttribute('data-to');
      const i = bar.querySelector('i'),
        g = bar.querySelector('.ghost');
      if (i) i.style.width = pct + '%';
      if (g) g.style.width = pct + '%';
      bar.classList.toggle('low', pct <= 25);
      bar.classList.toggle('mid', pct > 25 && pct <= 50);
      const hn = bar.nextElementSibling;
      if (hn && hn.classList.contains('hpnum') && /%\s*$/.test(hn.textContent)) hn.textContent = pct + '%';
    }
  } /* 11-11 망령 「로그엔 HP 1 인데 카드 글씨는 55%」: 턴 종료 순차 연출 중(hold)에 그려진 % 글씨가 막대만 따라가고 안 바뀌던 것 */
  function seqFx(seq) {
    const L = (seq || []).filter(x => x && x.mid && +x.prev !== +x.cur);
    if (!L.length) return;
    for (const x of L) FXS.hold[x.mid] = pctOf(+x.prev, +x.max);
    for (const x of L) setBar(x.mid, FXS.hold[x.mid]);
    L.forEach((x, i) =>
      setTimeout(() => {
        delete FXS.hold[x.mid];
        const dn = +x.cur < +x.prev;
        setBar(x.mid, pctOf(+x.cur, +x.max));
        flash(x.mid, dn ? 'hit' : 'heal', 500);
        if (dn && +x.cur <= 0) setTimeout(() => flash(x.mid, 'ko', 800), 250);
        try {
          if (CUT() && CUT().synth) CUT().synth(dn ? 'dmg' : 'heal');
        } catch (e) {}
      }, i * 400)
    );
    setTimeout(
      () => {
        for (const x of L) delete FXS.hold[x.mid];
      },
      L.length * 400 + 150
    );
  }
  function logFx(row) {
    try {
      if (!row || row.kind !== 'battle' || !row.data) return;
      if (row.at && Date.now() - new Date(row.at).getTime() > 15000) return;
      const d = row.data;
      const t = String(d.t || '');
      if (Array.isArray(d.seq) && d.seq.length) return seqFx(d.seq);
      const h = d.hp;
      if (h && d.mid && +h.cur < +h.prev) {
        flash(d.mid, 'hit', 500);
        if (/급소/.test(String(h.why || ''))) flash(d.mid, 'crit', 500);
        if (h.faint || +h.cur <= 0) setTimeout(() => flash(d.mid, 'ko', 800), 300);
        return;
      }
      if (h && d.mid && +h.cur > +h.prev) return flash(d.mid, 'heal', 500);
      if (d.mid && /빈사!|쓰러졌다!/.test(t)) flash(d.mid, 'ko', 800);
    } catch (e) {}
  }
  function hpAnim() {
    hpQ = 0;
    const L = [...document.querySelectorAll('.hpbar[data-to]')];
    if (!L.length) return;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        for (const e of L) {
          const to = e.dataset.to;
          e.removeAttribute('data-to');
          const i = e.querySelector('i'),
            g = e.querySelector('.ghost');
          if (i) i.style.width = to + '%';
          if (g) g.style.width = to + '%';
        }
      })
    );
  }
  function hpBar(m, full) {
    const hp = m.hp || { max: 1, cur: 1 };
    const pct0 = Math.max(0, Math.min(100, hp.cur > 0 ? Math.max(1, Math.round((hp.cur / hp.max) * 100)) : 0));
    const key = m.id || '';
    const held = FXS.hold[key];
    const pct = held != null ? held : pct0;
    const cls = pct <= 25 ? 'low' : pct <= 50 ? 'mid' : ''; /* 11-03: 턴 종료 순차 연출 중이면 아직 안 보여 준 값(prev)으로 */
    const prev = HPPREV.has(key) ? HPPREV.get(key) : pct;
    HPPREV.set(key, pct0);
    const mv = held == null && prev !== pct && key;
    if (mv && !hpQ) hpQ = setTimeout(hpAnim, 0);
    return `<div class="hpbar ${cls}" ${mv ? `data-to="${pct}"` : ''}><span class="ghost" style="width:${mv ? Math.max(prev, pct) : pct}%"></span><i style="width:${mv ? prev : pct}%"></i></div><div class="hpnum">${full ? `${hp.cur} <span class="dim">/ ${hp.max}</span>` : pct + '%'}</div>`;
  }
  function rankChips(m) {
    const r = m.rank || {};
    const out = [];
    for (const k of ['attack', 'defense', 'specialattack', 'specialdefense', 'speed', 'accuracy', 'evasion', 'critical']) {
      const v = +r[k] || 0;
      if (v) out.push(`<span class="rk ${v > 0 ? 'up' : 'dn'}">${STAT_KO[k]}${v > 0 ? '+' : ''}${v}</span>`);
    }
    const md = m.mod || {};
    for (const k in md) {
      const v = +md[k];
      if (v && v !== 1) out.push(`<span class="rk ${v > 1 ? 'up' : 'dn'}">${STAT_KO[k] || k}×${v}</span>`);
    }
    return out.join('');
  }
  const FLAG_KO = {
    endure: '버텨라!',
    surehit: '맞춰라!',
    dodgePhys: '물러나!',
    dodgeSpec: '피해라!',
    swap: '바꿔라!',
    return: '돌아와!',
    hitPhys: '지킬 수 없다!',
    hitSpec: '피할 수 없다!',
    noEndure: '버틸 수 없다!',
    acc0: '맞출 수 없다!',
    dodgeOnce: '주인의 칙령',
    nullify: '파계',
    rebirth: '윤회의 법계',
    protect: '기술 방어'
  };
  function flagChips(m) {
    return (
      Object.keys(m.flags || {})
        .filter(k => m.flags[k] && FLAG_KO[k] && (k !== 'protect' || m.flags[k] === (+ctx().b.turn || 0)))
        .map(k => `<span class="rk flag">${esc(FLAG_KO[k] || k)}</span>`)
        .join('') +
      (m.prioDown ? '<span class="rk flag" title="아이스번 — 다음 기술 우선도 −1">우선도 −1</span>' : '') +
      (m.defer && +m.defer.v > 0
        ? `<span class="rk flag" title="${esc((m.defer.why || '') + ' — ' + (m.defer.after === 'end' ? '턴 종료 시' : '자신의 행동이 끝나면 (못 하면 턴 종료 시)') + ' 받는다')}">미룬 대미지 −${+m.defer.v}</span>`
        : '')
    );
  }
  function stateChips(m) {
    const st = m.states || {};
    const db = (DB().states || {}).st || {};
    return (
      (+m.stock > 0 && !st.Stockpile
        ? `<span class="stc" data-stinfo="Stockpile" title="비축 카운터 — 그만큼 방어/특방이 올라 있다">비축 ${+m.stock}</span>`
        : '') /* 11-18 옛 칸 m.stock (11-27 부터 상태 Stockpile 의 수) */ +
      Object.keys(st)
        .filter(k => st[k])
        .map(k => {
          const im = simg(k);
          return `<span class="stc ${db[k] && db[k].abn ? 'abn' : ''}" data-stinfo="${esc(k)}" title="${esc(((db[k] && db[k].desc) || []).join(' '))}">${im ? `<img src="${esc(im)}" alt="">` : ''}${k === 'Stockpile' ? `비축 ${FX() && FX().stockOf ? FX().stockOf(m) : +st[k]}` : esc(db[k] ? db[k].ko : k) + (+st[k] > 1 && +st[k] < 1000 ? ' ' + st[k] : '')}</span>`; /* 11-27 비축 카운터는 늘 수를 보인다 */
        })
        .join('')
    );
  }
  function bigCard(c, m, slot) {
    m = V(c, m);
    const full = canEdit(c, m);
    const cmd = cmdOf(c.b, m);
    /* 11-03 감우 (검토 8): 행동 순서의 지금 차례(orderIdx)인 카드는 노란 테두리(.now) + 「공격」 pri, 그 상대편 카드는 「피격 대기」 톤(.wait) */
    const ph = +c.b.phase || 0;
    const o = (c.b.order || [])[+c.b.orderIdx || 0];
    const nowM = ph >= 2 && ph < 5 && o ? (c.b.mons || {})[o.mid] : null;
    const isNow = !!(nowM && nowM.id === m.id && m.hp.cur > 0);
    const isWait = !!(nowM && !isNow && ph === 3 && m.hp.cur > 0 && !sameT(nowM, m, c.b));
    const NMB = `${(!full && c.seat) || c.gm ? `<button class="btn xs ghost dexb" data-act="dex" data-mid="${m.id}" title="도감 정보 · 해석">도감</button>` : ''}${full && mode(c.b) >= 2 && m.hp.cur > 0 ? `<button class="btn xs ghost dexb" data-act="areaswap" data-mid="${m.id}" title="같은 편 다른 에리어와 자리 바꾸기 (사이드체인지 등)">⇄ 에리어</button>` : ''}${(!full && c.seat && !sameT(c.seat, m, c.b) && (+c.b.phase || 0) === 0) || (c.gm && !full) ? `<button class="btn xs ghost dexb" data-act="time" data-mid="${m.id}" title="「타임」 — 상대 지시의 꼴 엿보기">타임</button>` : ''}`; /* 11-05 망령: 폰에선 도감·타입 단추를 타입 줄 오른쪽에 (이름 밑 한 줄을 따로 먹지 않게) */
    return `<div class="mon big ${m.hp.cur <= 0 ? 'fainted' : ''} ${isNow ? 'now' : isWait ? 'wait' : ''}" data-mon="${m.id}"><div class="pic" style="${m.image ? `background-image:url('${cssu(m.image)}')` : ''}"></div>
   <div class="minfo"><div class="nm">${isNow ? '<span class="nowtag" title="행동 순서의 지금 차례">▶ 차례</span>' : isWait ? '<span class="waittag" title="지금 차례의 상대편 — 공격을 받을 수 있다">피격 대기</span>' : ''}<span class="nmt">${esc(m.name)}</span><span class="lv">Lv.${m.lv}</span><span class="nmb">${NMB}</span></div><div class="ty">${tyHtml(c, m)}${m.teraActive ? `<span class="rk up">테라 ${esc(m.tera)}</span>` : ''}${NMB ? `<span class="nmb nmb-ty">${NMB}</span>` : ''}</div>
   ${hpBar(m, full)}<div class="rks">${(() => {
     const o = misagA2Off(c.b, m);
     return o && m.entry
       ? `<span class="rk" style="background:#6b2230;color:#ffd6dc" title="각성체 대가 A-2 — ${esc(o.aw.name)}이(가) 필드에 없어 아군의 역할이 전부 무효">역할 무효 (A-2)</span>`
       : '';
   })()}${illuChip(c, m, full)}${rankChips(m)}${stateChips(m)}${flagChips(m)}${
     FX()
       ? FX()
           .chips(m)
           .filter(ch => full || !armedOwn(m, ch))
           .map(
             ch =>
               `<span class="rk fxc ${full ? 'rm' : ''}" title="${esc(ch.title)}${full ? ' — 눌러서 해제' : ''}" ${full ? `data-act="fxoff" data-mid="${m.id}" data-fx="${esc(ch.id)}" data-nm="${esc(ch.name)}"` : ''}>${esc(ch.t)}${full ? ' ✕' : ''}</span>`
           )
           .join('')
       : ''
   }</div>
   ${cmd ? `<div class="cmdcard">${cmd}</div>` : (+c.b.phase || 0) >= 2 && full && m.hp.cur > 0 && turnReached(c.b, m) ? `<div class="revealrow"><button class="btn sm pri" data-act="revealmon" data-tid="${m.tid}" data-mid="${m.id}">지시 공개 (에리어 ${String(m.entry).toUpperCase()})</button></div>` : ''}
   ${potLine(c, m)}
   ${
     m.lastHit && full
       ? (() => {
           const h = m.lastHit,
             tip = `피해 판정 받음 · ${h.from}의 「${h.move}」 ${h.total}×${h.eff}${h.crit ? ' 급소' : ''} ≈ ${h.expect} — 「적용」을 누르면 HP 창에서 내 쪽 완화까지 넣어 반영`; /* 11-02 망령 「피해 적용이 카드를 왕창 늘린다」: 세 줄 상자 → 한 줄(자세한 건 마우스를 올리면) */
           return `<div class="incoming" title="${esc(tip)}"><b>피격</b><span class="incd">「${esc(h.move)}」${h.crit ? ' <em>급소</em>' : ''}</span><span class="incn">≈ ${esc(String(h.expect))}</span><button class="btn xs pri" data-act="hp" data-mid="${m.id}" title="${esc(tip)}">적용</button></div>`;
         })()
       : ''
   }
   <div class="mbtns">${full ? `<button class="btn xs ${isNow ? 'pri' : ''}" data-act="attack" data-mid="${m.id}">공격</button><button class="btn xs ${m.lastHit ? 'pri' : ''}" data-act="hp" data-mid="${m.id}">HP</button><button class="btn xs mmore" type="button" data-mmore aria-label="버튼 더 보기" aria-expanded="false">⋯</button><button class="btn xs mx" data-act="pots" data-mid="${m.id}" title="포텐셜 목록 · 출력 · 발동 · 해제">포텐셜</button><button class="btn xs mx" data-act="edit" data-mid="${m.id}">랭크·상태</button><span class="exg"><button class="btn xs ghost mx exit1" data-act="exit" data-mid="${m.id}" title="바로 퇴장 (랭크·배율·효과 정리)">퇴장</button><button class="btn xs ghost mx exdn" data-act="exitx" data-mid="${m.id}" title="퇴장(특수) — 배턴터치 퇴장 · 강제 교대">(특수)</button></span>` : ''}</div>${full && (formsOf(m).some(f => f && f.kind !== '일루젼') || m.form0 || hasTera(m)) ? `<div class="mbtns mbtns2"><button class="btn xs mx ${m.form0 || teraOn(m) ? 'pri' : ''}" data-act="form" data-mid="${m.id}" title="폼체인지 · 메가진화 · 테라스탈 · 원래대로">${m.form0 ? '✦ ' + esc(((m.forms || [])[m.formIdx] || {}).kind || '폼') : teraOn(m) ? '◆ 테라 ' + esc(m.tera || '') : formsOf(m).some(f => f && f.kind !== '일루젼') ? '✦ 폼' : '◆ 테라'}</button></div>` : ''}</div></div>`;
  } /* 11-03 21:15 망령 「폼체인지나 메가 … 평소에 안 쓰는 버튼은 아래 줄 하나 더」 · 21:17 「(특수)는 냅둬」: 폼 · 메가 · 테라만 둘째 줄(.mbtns2), 있을 때만 */
  /* 비공개: 아직 한 번도 나오지 않은 상대 포켓몬은 이름·그림·타입을 숨긴다 (맵툴 「비공개」 토큰) */
  function secret(c, m) {
    if ((c.gm && !c.fair) || !m) return false;
    if (m.seen || m.entry) return false;
    if (m.priv && !canEdit(c, m)) return true;
    /* 11-12 망령 「포켓몬 1체만 숨기기」: 제작기에서 숨긴 포켓몬은 필드에 나오기 전까지 주인 · GM 말고는 벤치에서도 「비공개」 (PVP 여도) */ if (
      c.b.pvp
    )
      return false;
    /* 11-03 PVP 설정: 비공개 벤치도 연다 */ if (c.gm) {
      if (canEdit(c, m)) return false;
      const v = gmEyes(c, m);
      const t = (c.b.trainers || {})[v];
      return !t || !sameT(v, m, c.b);
    }
    const mt = myTrainers(c)[0];
    const my = (c.b.trainers || {})[mt];
    return !my || !sameT(mt, m, c.b);
  }
  function benchCard(c, m) {
    m = benchView(c, m);
    const full = canEdit(c, m);
    const out = !!m.entry;
    const sec = secret(c, m);
    if (sec)
      return `<div class="mon small secret"><div class="btop"><div class="pic"></div><div class="nm">비공개</div></div><div class="hpbar"><i style="width:100%"></i></div><div class="hpnum">?</div></div>`;
    return `<div class="mon small ${m.hp.cur <= 0 ? 'fainted' : ''} ${out ? 'onfield' : ''}" data-mon="${m.id}">
   <div class="btop"><div class="pic" style="${m.image ? `background-image:url('${cssu(m.image)}')` : ''}"></div><div class="nm" title="${esc(m.name)}${
     seenTypesKo(c, m).length ? ' · ' + esc(seenTypesKo(c, m).join('/')) : ''
   }">${esc(m.name)}${out ? ` <span class="tag">${m.entry.toUpperCase()}</span>` : ''}</div></div><div class="ty">${tyHtml(c, m)}</div>${hpBar(m, full)}
   ${!out && full && m.hp.cur > 0 ? (simOn(c.b, m.tid) && ((+c.b.phase || 0) < 2 || m.pend) ? `<button class="btn xs ${m.pend ? 'pri' : ''}" data-act="pend" data-mid="${m.id}">${m.pend ? '예약 ' + String(m.pend).toUpperCase() + ' ✓' : '내밀기 예약'}</button>` : `<button class="btn xs" data-act="enter" data-mid="${m.id}">등장</button>`) : ''}${!out && full && m.hp.cur > 0 ? illuPreChip(c, m) : ''}${!out && full && m.hp.cur <= 0 ? `<button class="btn xs ghost" data-act="edit" data-mid="${m.id}" title="잘못 쓰러진 포켓몬의 HP 를 되돌린다 (랭크·상태 창의 HP 칸)">HP 되돌리기</button>` : ''}</div>`;
  }

  /* 【N/시】 포텐셜 횟수. potUses[name] = 남은 횟수 */
  /* 포켓몬이 쓸 수 있는 포텐셜 전부: 20칸 + 전용 + 트레이너의 고유 */
  /* 지시 칸의 포텐셜 선언 칩: 고유(트레이너) · 전용 · 일반, 남은 횟수와 함께 */
  function potDecl(c, m, x, grp) {
    const u = m.potUses || {};
    const chips = potSrc(m)
      .filter(p => {
        const sp = isExcl(m, p);
        return grp === 'sp' ? sp : grp === 'norm' ? !sp : true;
      })
      .map(p => {
        const kind = isExcl(m, p) ? '전용' : '';
        const mxm = String(p.eff || '').match(/【(\d+)\/시】/);
        const pmax = p.max != null ? p.max : mxm ? +mxm[1] : null;
        const left = pmax != null ? (u[p.name] == null ? pmax : +u[p.name]) : null;
        p = { ...p, max: pmax };
        const on = (x.pots || []).includes(p.name);
        return `<div class="oc ${on ? 'mine' : ''} ${left !== null && left <= 0 ? 'dis' : ''}" data-pdecl="${esc(p.name)}" title="${esc(String(p.eff || '').replace(/<br\s*\/?>/g, ' '))}"><b>${kind ? '[' + esc(kind) + '] ' : ''}${esc(p.name)}</b>${left !== null ? `<small>${pips(left, p.max)}</small>` : '<small>횟수 없음</small>'}</div>`;
      });
    return chips.join('') || `<span class="dim small">${grp === 'sp' ? '전용 포텐셜이 없다' : '선행 입력할 포텐셜이 없다'}</span>`;
  }
  /* 고유(트레이너) · 전용 포텐셜: 지시 선언 · 카드 · 4식 6령 창에서 따로 묶어 보인다 */
  const isExcl = (m, p) => (m.excl && m.excl.name === p.name) || (m.exclX || []).some(q => q.name === p.name);
  /* 11-07 망령 「전용 입력에 대상 지정이 없다 — 추가 반동류처럼 상대를 지정해야 하는 전용 · 고유는 자동화에 대상 지정을 체크해 두면 입력할 때 지시 기술처럼 대상을 찍게」:
    구문에 「대상지정 [상대1체|아군1체|자신포함아군1체|아무나1체]」 줄(제작기 생성기 「◎ 대상 지정」)이 있으면, 선행 입력한 그 포텐셜 아래에 대상 판을 띄운다.
    고른 자리는 지시에 x.ptg[이름](전용 · 일반) · cur.utg[이름](고유) = 'side_area' 로 저장 → 발동(fireSpecial)할 때 그 자리의 포켓몬을 구문의 「1체」로 쓴다 */
  function tselOf(m, name, tid) {
    const F = FX();
    let a = null;
    if (F && F.autoOf)
      try {
        a = (tid && F.autoOf({ tid }, 'pot', name)) || (m && m.id ? F.autoOf(m, 'pot', name) : null);
      } catch (e) {}
    const ts = a && !a.manual ? (a.ops || []).find(o => o && o.k === 'tsel') : null;
    return ts || xactTsel(m, name);
  }
  /* 11-11 망령 「창의 용사 『멈추지 않을 용사의 용맹』 【1/시】【선행】/가장 마지막에 「스타어설트」에 의한 추가 행동 — 대상 지정이 왜 안 뜨지」:
    「가장 마지막에 「기술」에 의한 추가 행동」 포텐셜은 구문 「대상지정」이 없어도 그 기술이 1체기면 선행 입력 아래에 대상 판을 띄운다 (고른 자리 = 추가 행동 차례의 대상) */
  function xactTsel(m, name) {
    try {
      const p = m && m.id ? potSrc(m).find(q => q && q.name === name) : null;
      const mm = p && String(p.eff || '').match(/가장\s*마지막에\s*「([^」]+)」\s*(?:기술)?\s*에?\s*의한\s*추가\s*행동/);
      if (!mm) return null;
      const d = ((window.OM_DB || {}).moves || {})[mm[1].trim()];
      if (d && !/1체/.test(String(d.range || ''))) return null;
      return { k: 'tsel', tgt: d && d.cat === '변화' ? 'any1' : 'enemy1', xact: mm[1].trim() };
    } catch (e) {
      return null;
    }
  }
  const TSEL_KO = { enemy1: '상대 1체', ally1: '아군 1체', ally1s: '아군 1체 (자신 포함)', any1: '아무나 1체' };
  const realOps = a => !!(a && (a.ops || []).some(o => o && o.k !== 'tsel' && o.k !== 'msel'));
  function tselMon(b, slot) {
    if (!slot) return null;
    const [sd, ar] = String(slot).split('_');
    return (entered(b, sd) || {})[ar] || null;
  }
  function tselRows(b, side, me, names, sel, attr, tid) {
    return names
      .map(n => {
        const ts = tselOf(me, n, tid);
        if (!ts) return '';
        const cur = sel[n] || '';
        const cm = tselMon(b, cur);
        return `<div class="sec tselh">『${esc(n)}』 대상 <span class="note">${esc(TSEL_KO[ts.tgt] || '1체')} — 누르면 고른다 · 다시 누르면 뺀다</span>${cm ? ` <span class="tag ok">${slotName(b, cur)}</span>` : ' <span class="warn small">대상 없음</span>'}</div>${board(
          b,
          side,
          s => s === cur,
          s => `${attr}="${s}" data-tpn="${esc(n)}"`,
          ts.tgt !== 'ally1',
          me
        )}`;
      })
      .join('');
  }
  /* 11-09 감우 57 (망령 「기술 지정은 추가로」 — 카렌 『죽음을 각오한 저항』): 구문에 「기술지정 [상대|아군]」 줄이 있으면 선행 입력한 그 포텐셜 아래에 기술 고르기 판.
    위: 상대(아군) 필드 포켓몬 중 이 트레이너가 기술을 해석한 포켓몬의 기술 + 이번 배틀에서 내보낸 기술 · 아래 「기술 DB 검색」(숨은 기술은 새지 않는다 — 11-09 망령 「해석된 기술 + 전체 검색」).
    고른 기술은 지시에 cur.utm[이름](고유) · x.ptm[이름](전용 · 일반) → 발동할 때 ctx.msel 로 넘겨 「지정기술」 조건(fx)이 쓴다. 발동 로그에 공개(망령 「선행 발동 때 공개」) */
  function mselOf(m, name, tid) {
    const F = FX();
    let a = null;
    if (F && F.autoOf)
      try {
        a = (tid && F.autoOf({ tid }, 'pot', name)) || (m && m.id ? F.autoOf(m, 'pot', name) : null);
      } catch (e) {}
    const ms = a && !a.manual ? (a.ops || []).find(o => o && o.k === 'msel') : null;
    if (ms) return ms;
    /* 11-11 망령 (①【사전】【탈진】 … ②【선행】/①의 효과를 발동했을 때 기술을 지정한다): 구문 「기술지정」이 없어도 효과 글에 「기술을 지정한다」가 있으면 선행 입력 아래 기술 고르기 (상대 기술) */
    try {
      let tx = '';
      if (tid) {
        const t = ((ctx().b || {}).trainers || {})[tid];
        const u = ((t && t.unique) || []).find(x => x && x.name === name);
        tx = u ? String(u.eff || '') : '';
      }
      if (!tx && m && m.id) {
        const p = potSrc(m).find(q => q && q.name === name);
        tx = p ? String(p.eff || '') : '';
      }
      if (/기술을\s*(?:하나\s*)?(?:지정|선언)한다/.test(tx)) return { k: 'msel', who: /아군의\s*기술을\s*(?:지정|선언)/.test(tx) ? 'ally' : 'enemy' };
    } catch (e) {}
    return null;
  }
  function mselCands(b, side, tid, who) {
    const out = [];
    const DX = window.OM_DEX_UI;
    const add = (n, from) => {
      n = String(n || '').trim();
      if (!n || n === '발버둥') return;
      const o = out.find(q => q.n === n);
      if (o) {
        if (!o.from.includes(from)) o.from.push(from);
      } else out.push({ n, from: [from] });
    };
    for (const x of Object.values(b.mons || {})) {
      if (!x || !x.entry || !(x.hp && x.hp.cur > 0)) continue;
      const foe = x.side !== side;
      if (who === 'ally' ? foe : !foe) continue;
      let sc = [];
      try {
        sc = DX && DX.scope ? DX.scope(x.id, tid, true) : 'all';
      } catch (e) {}
      const all = sc === 'all' || (Array.isArray(sc) && sc.includes('move'));
      if (all) for (const mv of MVS(x)) if (mv && mv.name) add(mv.name, x.name);
      if (x.lastMove && x.lastMove.name) add(x.lastMove.name, x.name);
    }
    return out;
  }
  function mselRows(b, side, me, names, sel, attr, tid) {
    return names
      .map(n => {
        const ms = mselOf(me, n, tid);
        if (!ms) return '';
        const cur = sel[n] || '';
        const C = mselCands(b, side, tid || (me && me.tid), ms.who);
        return `<div class="sec tselh">『${esc(n)}』 기술 지정 <span class="note">${ms.who === 'ally' ? '아군' : '상대'} 기술 — 해석된 기술 · 이번 배틀에서 내보낸 기술, 없으면 검색</span>${cur ? ` <span class="tag ok">『${esc(cur)}』</span>` : ' <span class="warn small">기술 없음</span>'}</div><div class="pool">${C.map(q => `<div class="oc ${q.n === cur ? 'mine' : ''}" ${attr}="${esc(q.n)}" data-tpn="${esc(n)}" title="${esc(q.from.join(' · '))}"><b>${esc(q.n)}</b><small>${esc(q.from.join(' · '))}</small></div>`).join('')}<div class="oc" ${attr}s="1" data-tpn="${esc(n)}" title="기술 DB 전체에서 고른다"><b>기술 DB 검색</b><small>${cur && !C.some(q => q.n === cur) ? '『' + esc(cur) + '』' : '전체'}</small></div></div>`;
      })
      .join('');
  }
  /* 10-26 망령: 사용 제한 — 【N/시】 = 시합 중 N번(uses), 【소진】 = 1턴에 1번, 【탈진】 = 연속된 턴에는 못 쓴다 (발동 후 다음 턴 끝까지). 턴 제한은 쓴 턴을 적어 둔다(turns) */
  function limOf(p, uses, turns) {
    const e = String(p.eff || '');
    const mm = e.match(/【(\d+)\/시】/);
    const mmax = mm ? +mm[1] : null;
    const ml = mmax == null ? null : uses[p.name] == null ? mmax : +uses[p.name];
    const per = /【\s*소진\s*】/.test(e) ? 'turn' : /【\s*탈진\s*】/.test(e) ? 'tal' : '';
    const T = +(ctx().b || {}).turn || 0;
    const ut = turns[p.name];
    const tl = !per ? null : ut == null ? 1 : per === 'turn' ? (+ut === T ? 0 : 1) : T - +ut <= 1 ? 0 : 1;
    /* 11-11 망령: 【보급】 = 필드에 나와 1번까지 — 다시 쓰려면 소지에 들어갔다 나와야 한다. 쓴 것은 potTurn._sup[이름] 에 적고 교대(필드를 떠남)하면 지운다 */ const sup =
      /【\s*보급\s*】/.test(e);
    const sl = sup ? (((turns || {})._sup || {})[p.name] ? 0 : 1) : null;
    const max = mmax != null ? mmax : per || sup ? 1 : null;
    const left =
      ml == null && tl == null && sl == null ? null : Math.min(ml == null ? Infinity : ml, tl == null ? Infinity : tl, sl == null ? Infinity : sl);
    const sw = shareWhy(p, turns);
    if (sw) return { max: max == null ? 1 : max, left: 0, mmax, per, sup, sw, ml };
    return { max, left, mmax, per, sup, ml };
  } /* 11-26 ml = 【N/시】 남은 횟수 그대로 (left 는 【소진】 등 이번 턴 제한까지 합친 값) */
  /* 11-10 망령 「【공유】 자동화 — 포켓몬 기준 · 괄호 안 이름은 그 이름이 들어간 효과끼리만 (【공유 (『악전위』)】 = 악전위가 들어간 효과랑 같은 턴에 못 쓴다)」:
    포켓몬이 이번 턴에 발동한 포텐셜을 potTurn._share = {t:턴, u:[{n:이름, p:괄호 없는 【공유】, g:[괄호 안 이름], x:전용}], ex:[이 포켓몬의 전용 이름]} 에 적고,
    ① 괄호 없는 【공유】끼리 ② 내 괄호 이름이 들어간 효과를 이미 썼으면 ③ 이미 쓴 효과의 괄호 이름이 내 이름에 들어 있으면 — 이번 턴에 못 쓴다 (limOf left 0 · potRest 「공유」 칩).
    『전용』 = 이름에 「전용」이 들어 있거나 전용 포텐셜. 한 글자 이름(『포』)은 그 글자로 끝나는 이름만. 『지령)』처럼 괄호가 꼬인 글도 읽는다. 다음 턴이면 저절로 풀린다 */
  function shareTag(e) {
    const m = String(e || '').match(/【\s*공유([^】]*)】/);
    if (!m) return null;
    const g = [...m[1].matchAll(/『([^』)]+)/g)].map(x => x[1].trim()).filter(Boolean);
    return { p: !g.length, g };
  }
  function shareWhy(p, turns) {
    try {
      const S = turns && turns._share;
      const T = +(ctx().b || {}).turn || 0;
      if (!p || !S || +S.t !== T || !Array.isArray(S.u)) return '';
      const N = p.name;
      const me = shareTag(p.eff);
      const ex = (S.ex || []).includes(N);
      const has = (n, x, g) => {
        n = String(n);
        if (g === '전용') return !!x || n.includes('전용');
        if (g.length === 1) return new RegExp(g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|\\s|[』,·)])').test(n);
        return n.includes(g);
      }; /* 한 글자(『포』)는 끝말만 — 관통포 · 곡사포 O, 포텐셜 · 포효 X */
      for (const u of S.u) {
        if (!u || u.n === N) continue;
        if (me && me.p && u.p) return `이번 턴에 『${u.n}』(【공유】)를 썼다 — 다른 【공유】 효과는 턴 끝까지 못 쓴다`;
        const g1 = me ? me.g.find(g => has(u.n, u.x, g)) : null;
        if (g1) return `이번 턴에 『${u.n}』을(를) 썼다 — 【공유 (『${g1}』)】 라 같이 못 쓴다`;
        const g2 = (u.g || []).find(g => has(N, ex, g));
        if (g2) return `이번 턴에 『${u.n}』(【공유 (『${g2}』)】)를 썼다 — 『${g2}』이(가) 들어간 효과는 턴 끝까지 못 쓴다`;
      }
      return '';
    } catch (e) {
      return '';
    }
  }
  async function shareMark(mid, name) {
    try {
      const m = ((ctx().b || {}).mons || {})[mid];
      if (!m) return;
      const nn = String(name || '')
        .replace(/[『』]/g, '')
        .trim();
      const p = potSrc(m).find(q => q && (q.name === name || q.name === nn));
      if (!p) return;
      const T = +ctx().b.turn || 0;
      const S0 = (m.potTurn || {})._share;
      const u = S0 && +S0.t === T && Array.isArray(S0.u) ? S0.u.slice() : [];
      if (u.some(x => x && x.n === p.name)) return;
      const tg = shareTag(p.eff);
      u.push({ n: p.name, p: tg && tg.p ? 1 : 0, g: tg ? tg.g : [], x: isExcl(m, p) ? 1 : 0 });
      await A().set(['battle', 'mons', mid, 'potTurn', '_share'], {
        t: T,
        u,
        ex: potSrc(m)
          .filter(q => isExcl(m, q))
          .map(q => q.name)
      });
    } catch (e) {
      console.warn('shareMark', e);
    }
  }
  function specialPots(m) {
    const u = m.potUses || {};
    return potSrc(m)
      .filter(p => isExcl(m, p))
      .map(p => {
        const L = limOf(p, u, m.potTurn || {});
        const max = L.max,
          left = L.left,
          sw = L.sw || '';
        const a = FX() && FX().autoOf(m, 'pot', p.name);
        return {
          p,
          kind: p.unique ? '고유' : '전용',
          max,
          left,
          sw,
          mmax: L.mmax,
          ml: L.ml,
          per: L.per,
          auto: !!(a && a.ops && a.ops.length && !a.manual)
        };
      });
  }
  /* 11-03 21:36 망령 「일반 포텐셜도 【탈진】 · 【소진】을 세자 — 칸 길이는 그대로」: 쓴 턴을 potTurn 에 적고(손으로 누른 발동 · 사용만), 못 쓰는 턴엔 발동 자리에 같은 크기의 「탈진」 · 「소진」 칩 */
  /* 11-04 20:34 망령 「웹툴 배틀에서 유대가 자동화 안 되어 있는 것 같대」: 『사랑의 유대』 · 『영혼의 유대』(【탈진】/저확률로 기술 대미지로 「빈사」 상태가 되지 않는다)를
    기합의머리띠처럼 HP 창에서 굴린다 — 쓰러질 피해면 확률(저 30 · 중 50 · 고 60)을 굴려 버티면 HP 1 · 버티면 【탈진】(쓴 턴 기록 — 다음 턴 끝까지 다시 안 굴림) */
  function bondBand(m) {
    const PF = l => {
      const F = FX();
      return F && F.percentOf ? Math.round(F.percentOf(l)) : { 저확률: 20, 중확률: 50, 고확률: 60 }[l] || 100;
    };
    const P = {
      저: PF('저확률'),
      중: PF('중확률'),
      고: PF('고확률')
    }; /* 11-04 20:40 망령 「저확률 20% 아니야?」: 방 설정(rp.pct) → 룰 DB(campaign.percent_*) 값 */
    if (ctx().b.pvp && m.bondUsed) return null; /* PVP: 시합 중 한 번만 버틴다 */
    for (const p of potSrc(m)) {
      if (!p || !p.name) continue;
      const mm = String(p.eff || '').match(/(저|중|고)확률로\s*기술\s*대미지로\s*「빈사」\s*상태가\s*되지\s*않는다/);
      if (!mm) continue;
      if (potRest(m, p.name)) continue;
      const lim = String(p.eff || '').match(/【\s*(\d+)\s*\/\s*시\s*】/);
      if (lim) {
        const left = (m.potUses || {})[p.name];
        if (left != null && +left <= 0) continue;
      }
      return { pct: P[mm[1]], name: p.name, pot: 1 };
    }
    return null;
  }
  function potRest(m, name) {
    const p = potSrc(m).find(q => q && q.name === name);
    if (!p || isExcl(m, p)) return null;
    {
      const sw = shareWhy(p, m.potTurn || {});
      if (sw) return { lab: '공유', title: sw };
    }
    const e = String(p.eff || '');
    if (/【\s*보급\s*】/.test(e) && ((m.potTurn || {})._sup || {})[name])
      return { lab: '보급', title: '이번 등장에 이미 썼다 — 소지에 들어갔다 나오면 다시 쓸 수 있다 (【보급】)' };
    const per = /【\s*소진\s*】/.test(e) ? 'turn' : /【\s*탈진\s*】/.test(e) ? 'tal' : '';
    if (!per) return null;
    const T = +(ctx().b || {}).turn || 0;
    const ut = (m.potTurn || {})[name];
    if (ut == null) return null;
    const no = per === 'turn' ? +ut === T : T - +ut <= 1;
    if (!no) return null;
    return {
      lab: per === 'turn' ? '소진' : '탈진',
      title: per === 'turn' ? `${ut}턴에 썼다 — 이번 턴엔 다시 못 쓴다 (【소진】)` : `${ut}턴에 썼다 — 다음 턴 끝까지 못 쓴다 (【탈진】)`
    };
  }
  const restChip = r => `<span class="btn xs potrest" title="${esc(r.title)}">${r.lab}</span>`;
  /* 11-23 「「프라이드」를 1단계 올리고 【프라이드 : A】 태그가 발동한다」(티아마트 전용): 쓰면 배틀 동안 priUp(+단계) · priTag(켜진 등급)을 남긴다 — 【프라이드 : X】 판정이 이것도 본다 */
  async function priGrant(mid, name) {
    try {
      const m = (ctx().b.mons || {})[mid];
      if (!m) return;
      const p = potSrc(m, 1).find(q => q && q.name === name);
      const e = String((p && p.eff) || '');
      if (!e) return;
      const up = e.match(/「?\s*프라이드\s*」?\s*(?:을|를)\s*(\d+|한)?\s*단계\s*(?:올|상승)/);
      const tg = [...e.matchAll(/【\s*프라이드\s*[:：]\s*([^】]+?)\s*】\s*태그(?:가|를)?\s*(?:발동|켜|활성)/g)].map(x => x[1].trim());
      if (up) {
        const n = up[1] && up[1] !== '한' ? +up[1] : 1;
        await A().set(['battle', 'mons', mid, 'priUp'], (+m.priUp || 0) + n);
      }
      if (tg.length) {
        const cur = (m.priTag || []).slice();
        for (const g of tg) if (!cur.includes(g)) cur.push(g);
        await A().set(['battle', 'mons', mid, 'priTag'], cur);
      }
      if (up || tg.length)
        A().sysLog(
          `【프라이드】 ${m.name} 『${name}』 — ${up ? '프라이드 ' + (up[1] && up[1] !== '한' ? up[1] : 1) + '단계 상승' : ''}${up && tg.length ? ' · ' : ''}${tg.length ? tg.map(g => '【프라이드 : ' + g + '】').join(' ') + ' 태그 발동' : ''}`,
          'battle',
          { mid }
        );
    } catch (e) {
      console.warn('priGrant', e);
    }
  }
  async function potMark(mid, name) {
    const m = (ctx().b.mons || {})[mid];
    if (!m) return;
    await shareMark(mid, name);
    await priGrant(mid, name);
    const p = potSrc(m).find(q => q && q.name === name);
    if (!p || isExcl(m, p)) return;
    if (/【\s*보급\s*】/.test(String(p.eff || ''))) await A().set(['battle', 'mons', mid, 'potTurn', '_sup', name], 1);
    if (!/【\s*(소진|탈진)\s*】/.test(String(p.eff || ''))) return;
    await A().set(['battle', 'mons', mid, 'potTurn', name], +ctx().b.turn || 0);
  }
  function spBtn(m, s) {
    const n = esc(s.p.name);
    if (s.sw) return `<span class="btn xs potrest" title="${esc(s.sw)}">공유</span>`;
    if (s.left !== null && s.left <= 0)
      return s.ml > 0
        ? `<span class="small dim" title="남은 ${s.ml}회 — 다음 턴에 다시 쓸 수 있다">이번 턴 씀</span>`
        : '<span class="small dim">다 씀</span>';
    if (s.auto && syncLock(ctx().b, m, s.p.eff))
      return `<button class="btn xs pri" disabled title="【동조】 — 필드에 같은 『역할』 대치가 없다">발동</button>`;
    if (s.auto)
      return `<button class="btn xs pri" data-act="fireauto" data-card="1" data-mid="${m.id}" data-kind="pot" data-pot="${n}" title="자동화 효과를 건다${s.max != null ? ' (횟수 1 사용)' : ''}">발동</button>`;
    if (s.max != null)
      return `<button class="btn xs pri" data-act="usepot" data-card="1" data-mid="${m.id}" data-pot="${n}" title="횟수 1을 쓰고 로그에 출력">사용</button>`;
    return `<button class="btn xs" data-act="announce" data-card="1" data-mid="${m.id}" data-kind="pot" data-pot="${n}" title="효과를 로그에 출력">📢 발동</button>`;
  }
  /* 11-26 망령 「3/시가 한 번 누르면 0/시 · 원 3개가 다 비고, 다음 턴엔 1개」: 【N/시】【소진】 은 남은 횟수(ml)를 원으로 보이고, 이번 턴에 더 못 쓰면 흐리게만 — pipsL(o) */
  function pipsL(o) {
    if (!o) return '';
    if (o.mmax != null && o.ml != null && o.ml > (+o.left || 0) && !(o.left != null && o.left <= 0))
      return pips(
        o.ml,
        o.max
      ); /* 11-26 05:07 망령 「3/시 고유가 원 하나만 채워진 채로 들어온다」: 【소진】 등이 left 를 1 로 묶어도 원은 남은 횟수(ml)대로 */
    const blk = o.mmax != null && o.ml != null && o.left != null && o.left <= 0 && o.ml > 0;
    return blk
      ? `<span class="pips pblk" title="남은 ${o.ml}/${o.max} — ${o.sw ? '이번 턴은 이미 같은 계열을 썼다' : o.per === 'tal' ? '【탈진】 지난 턴에 써서 이번 턴은 못 쓴다' : o.sup ? '【보급】 필드에 나와 이미 썼다' : '【소진】 이번 턴은 이미 썼다'}">${'●'.repeat(Math.min(o.ml, o.max))}${'○'.repeat(Math.max(0, o.max - o.ml))}</span>`
      : pips(o.left, o.max);
  }
  function pips(left, max) {
    if (max == null) return '';
    left = Math.max(0, +left || 0);
    max = +max || 0;
    if (max > 8 || max < 1) return `남은 ${left}/${max}`;
    return `<span class="pips" title="남은 ${left}/${max}">${'●'.repeat(Math.min(left, max))}${'○'.repeat(Math.max(0, max - left))}</span>`;
  }
  /* 10-23 망령: 4식 6령 불가 — 시트 체크(올드 타입은 기본), 「난동부리기」·반무적(공중·땅속·물속 …) 상태 */
  function noOrdWhy(m) {
    if (!m) return '';
    const why = [];
    const old = (m.pots || []).some(p => p && /분류/.test(p.kind || '') && /^(올드 타입|리전 폼)$/.test(String(p.name || '').trim()));
    /* 11-15 14:16 망령 「리전 폼도 막아」 — 『리전 폼』 = 별도의 형태를 띈 『올드 타입』 */ if (m.noOrd != null ? m.noOrd : old)
      why.push(m.noOrd == null ? '올드 타입' : '시트 체크');
    const st = m.states || {};
    const db = (DB().states || {}).st || {};
    const semi = (((DB().states || {}).groups || []).find(g => g.l === '반무적') || {}).s || [
      'VanishToDark',
      'VanishToHole',
      'Fly',
      'VanishToWater',
      'VanishToFire',
      'VanishToMeteor',
      'VanishToSun'
    ];
    for (const k of ['Thrash', 'Recharge', ...semi]) if (st[k]) why.push((db[k] || {}).ko || k);
    return why.join(' · ');
  }
  const NOORD_W = {},
    THR_PICK = {};
  /* 11-07 23:58 망령 「옹골찬턱 같은 거 왜 전부 다 보여? — 자동화를 위해 켜 두는 계통은 자기만 보라고 했잖아」: 등장 때 저절로 켜 둔 상시 · 지속형(fxDone)의 칩은 주인 · GM 화면에만 — 발동하면 로그로 공개 */
  const armedOwn = (m, ch) => {
    const nn = x =>
      String(x || '')
        .replace(/[『』]/g, '')
        .trim();
    const D = (m && m.fxDone) || {};
    const n = nn(ch && ch.name);
    return !!n && Object.keys(D).some(k => D[k] && nn(k) === n);
  };
  function aptOn(m, n) {
    const T = +(ctx().b || {}).turn || 0;
    const u = ((m && m.apt) || {})[
      String(n || '')
        .replace(/『|』/g, '')
        .trim()
    ];
    return u != null && +u >= T;
  } /* 11-15 임명된 동안 (fx appoint) */
  /* 11-18 망령 「맥 콘 글린의 환상」: 필드 위 누군가의 「「필드 : X」일 때 필드 위의 모든 포켓몬의 「회복」「드레인」 효과가 발동하지 않는다」 — 제작기 fx.noHeal */
  const NOHEAL = (m, kind) => (FX() && FX().noHeal ? FX().noHeal(m, kind, ctx().b) : '');
  /* 11-21 망령 「【지원】은 볼에서만 발동 — 필드 위에선 발동하지 않는다. 필드에서도 발동하는 계열은 【지원 (상위)】」:
    글 머리 태그로 가른다 — 'sup' = 【지원】(볼 안 · 빈사면 안 됨) · 'ko' = 【지원 (빈사)】(볼 안 · 빈사여도) · 'up' = 【지원 (상위)】(필드 · 볼 둘 다) */
  function supKind(eff) {
    const hd = (String(eff || '')
      .replace(/^[\s①②③④⑤]+/, '')
      .match(/^((?:\s*【(?:[^【】]|【[^【】]*】)*】)+)/) || [''])[0];
    if (!/【\s*지원/.test(hd)) return '';
    if (/【\s*지원\s*\(\s*상위\s*\)\s*】/.test(hd)) return 'up';
    if (/【\s*지원\s*\(\s*빈사\s*\)\s*】/.test(hd)) return 'ko';
    return /【\s*지원\s*】/.test(hd) ? 'sup' : '';
  }
  /* 지금 이 자리에서 효과가 살아 있나: 필드 위면 【지원】 · 【지원 (빈사)】는 꺼짐, 빈사면 【지원】 · 【지원 (상위)】는 꺼짐 */
  function supLive(m, p) {
    const k = supKind(p && p.eff);
    if (!k) return true;
    const dead = !(m && m.hp && m.hp.cur > 0);
    if (m && m.entry && !dead) return k === 'up';
    if (dead) return k === 'ko';
    return true;
  }
  function potSrc(m, all) {
    const L = [...(m.pots || []).filter(p => p && p.name && (!p.ph || (p.apt && aptOn(m, p.name)))), ...(m.excl ? [m.excl] : []), ...(m.exclX || [])];
    return all ? L : L.filter(p => supLive(m, p) && !priGated(m, p));
  }
  /* 11-23 망령 「【프라이드 : X】 = 자신이 프라이드 X일 때」: 효과(또는 ① · ② 줄) 머리 태그에 【프라이드 : X】가 있으면 그 포켓몬의 프라이드(시트 · 자동 계산값 + 배틀 중 올린 단계 priUp)로 판정.
    「【프라이드 : A】 태그가 발동한다」(티아마트 전용)처럼 태그를 켜 주는 효과를 쓰면 m.priTag 에 등급을 적어 그 등급으로도 통과. 【함성 (【프라이드 : A】)】 안쪽은 머리 태그가 아니라 상대 조건이라 여기서 안 본다.
    줄이 모두 막히면 포텐셜 전체를 숨기고(potSrc), 일부 줄만 막히면 그 줄의 계기만 거른다(evReact) */
  function priTopTags(h) {
    const out = [];
    let d = 0,
      st = -1;
    for (let i = 0; i < h.length; i++) {
      const c = h[i];
      if (c === '【') {
        if (d === 0) st = i;
        d++;
      } else if (c === '】') {
        d--;
        if (d === 0 && st >= 0) {
          out.push(h.slice(st + 1, i));
          st = -1;
        }
      }
    }
    return out;
  }
  function priHeadSpec(cl) {
    const m = String(cl || '').match(/^\s*[①-⑳]?\s*((?:【(?:[^【】]|【[^【】]*】)*】\s*)+)/);
    if (!m) return null;
    for (const t of priTopTags(m[1])) {
      const q = t.match(/^\s*프라이드\s*[:：]\s*(.+)$/);
      if (q) return q[1].trim();
    }
    return null;
  }
  function priSelfOk(m, spec) {
    const F = FX();
    if (!F || !F.priOk) return true;
    if (F.priOk(m, spec)) return true;
    for (const g of (m && m.priTag) || []) if (F.priOk({ pride: g }, spec)) return true;
    return false;
  }
  function priGated(m, p) {
    try {
      const s = String((p && p.eff) || '').replace(/<br\s*\/?>/gi, '\n');
      const cls = s.split(/(?=[①-⑳])/).filter(x => x.trim());
      let any = 0;
      for (const c of cls.length ? cls : [s]) {
        const sp = priHeadSpec(c);
        if (!sp) return false;
        any = 1;
        if (priSelfOk(m, sp)) return false;
      }
      return !!any;
    } catch (e) {
      return false;
    }
  }
  /* 11-23: 계기 글의 「「프라이드 : C」 이하인 상대」 · 「「프라이드 : A」인 상대」 — 그 계기의 상대(맞힌 쪽 · 고른 대상 중 상대 편)가 맞을 때만 */
  function priFoeOk(cl, own, o, r, b) {
    const q = String(cl || '').match(/「\s*프라이드\s*[:：]\s*([^」]+)」\s*((?:이하|이상|미만|초과)?)\s*인\s*상대/);
    if (!q) return true;
    const F = FX();
    if (!F || !F.priOk) return true;
    const cand = [r && r.pick, o && o.mid, o && o.tgt].map(id => id && (b.mons || {})[id]).filter(z => z && !sameT(z, own, b));
    if (!cand.length) return true;
    return F.priOk(cand[0], q[1] + q[2]);
  }
  /* 10-28 망령: 미사그 대학 (4+2) 각성체 대가 — 제작기 「각성체 대가」의 통솔 항목으로 포텐셜 발동을 막는다. 항목 이름 B-2 · A-1 · A-2 로 판정
    B-2 지정 역할의 역할 포텐셜 · A-1 필드 위 다른 아군 중 지정 타입이 없으면 각성 (대가) 포켓몬의 포텐셜 · A-2 각성 (대가)가 필드에 있으면 다른 아군의 역할 포텐셜. 막은 이유를 돌려준다 */
  function misagBlock(b, m, name) {
    const t = ((b && b.trainers) || {})[m && m.tid];
    const M = t && t.misag;
    if (!M || !Array.isArray(M.items) || !M.items.length) return '';
    const nm = x =>
      String(x || '')
        .replace(/『|』/g, '')
        .trim();
    const pot = potSrc(m).find(p => nm(p.name) === nm(name));
    if (!pot) return '';
    const keys = M.items.map(x => x.key);
    const isRole = /역할/.test(String(pot.kind || ''));
    const onF = x => !!(x && x.entry && x.hp && x.hp.cur > 0);
    const mates = Object.values(b.mons || {}).filter(x => x && x.tid === m.tid);
    const aw = mates.find(x => x.awaken === 'free');
    {
      const RF = x => (FX() && FX().roleFams ? FX().roleFams(x) : [nm(x)]);
      const fam0 = RF(M.role);
      const fam = fam0.length > 1 ? [] : fam0;
      const hit = [...RF(m.role), ...RF(pot.name)].find(f => fam.includes(f));
      /* 지정 역할이 두 분류에 걸치면(타이트엔드) 그 역할만 */ if (
        keys.includes('B-2') &&
        isRole &&
        M.role &&
        (hit || nm(pot.name).includes(nm(M.role)))
      )
        return `각성체 대가 B-2 — 역할 분류 「${hit || fam[0] || nm(M.role)}」(${nm(pot.name)})은(는) 발동하지 않는다`;
    } /* 11-05 망령: 러너를 막으면 닌자 · 하이 러너도 (분류로) */
    /* 11-01 망령: A-1 은 포텐셜을 막지 않고 「행동 불능」으로 (misagA1) → 11-06 망령 「포텐셜도 막자」: 행동 불능인 동안 그 각성체의 포텐셜도 발동하지 않는다 */
    if (keys.includes('A-1')) {
      const a1 = misagA1(b, m);
      if (a1) return a1 + ' · 포텐셜도 발동하지 않는다';
    }
    /* 11-05 망령 「A-2 가 약하다 — 본인을 내지 않으면 문제가 없으니 반대로」: 각성 (대가)가 필드에 나와 있지 않으면 아군의 역할이 전부 무효 */
    if (keys.includes('A-2') && isRole && aw && !onF(aw)) return `각성체 대가 A-2 — ${aw.name}이(가) 필드에 없으면 아군의 역할은 무효`;
    return '';
  }
  /* 11-05: A-2 가 지금 걸려 있나 (각성 (대가)가 필드에 없음) — 걸려 있으면 그 트레이너의 역할 포텐셜 이름들 */
  function misagA2Off(b, m) {
    const t = ((b && b.trainers) || {})[m && m.tid];
    const M = t && t.misag;
    if (!M || !(M.items || []).some(x => x.key === 'A-2')) return null;
    const mates = Object.values(b.mons || {}).filter(x => x && x.tid === m.tid);
    const aw = mates.find(x => x.awaken === 'free');
    if (!aw || (aw.entry && aw.hp && aw.hp.cur > 0)) return null;
    const nm = x =>
      String(x || '')
        .replace(/『|』/g, '')
        .trim();
    const names = new Set();
    for (const x of mates) for (const p of potSrc(x)) if (p && /역할/.test(String(p.kind || ''))) names.add(nm(p.name));
    for (const x of mates) if (x.role) names.add(nm(x.role));
    return { aw, names, srcs: new Set(mates.map(x => x.name)) };
  }
  /* 11-01 망령 「A-1 도 포텐셜 발동하지 않는다가 아니라 행동불능으로」: 필드 위 다른 아군(같은 진영 · 다른 PC 포켓몬 포함) 중 지정 타입이 한 체도 없으면 각성 (대가) 포켓몬은 행동 불능 — 이유 글을 돌려준다 */
  /* 11-11 망령 「통솔 대가 행동 불능은 과하다 — 특성 : 게으름 마냥 조건을 충족하면 다음 턴 행동불능(교대는 가능)」 · 확인은 턴 종료 때 · 포텐셜 불발도 그 턴만:
    misagA1Cond = 조건(지금 맞나 — 예전 판정 그대로), misagA1 = 지난 턴 종료 때 걸린 잠금(m.a1Lock = {t: 행동 불능 턴, why})이 이번 턴이면 그 이유 */
  /* 11-23 저녁 망령 「1/2/3 다 해줘」(254번 검수 — 크로노스 『그리고, 시간은 정지한다.』 【1/시】【자동】/「타임」이 발동한 턴 자신 이외를 행동불능으로 만든다):
    자기 트레이너가 「타임」을 쓰면(openMyosu) 그 글을 가진 필드 위 포켓몬에게 tstop={t:턴} 을 적고(시합에 한 번), 그 턴 동안 그 포켓몬 말고는 전부 행동 불능 — A-1 행동 불능과 같은 길(차례 건너뜀 · 기술 칸 숨김 · 교대는 됨) */
  const TSTOP_RE = /「타임」\s*(?:이|을|를)?\s*(?:발동|사용)(?:한|된|하는)\s*턴\s*자신\s*이외(?:를|가|의\s*포켓몬(?:을|이))?\s*행동\s*불능/;
  function tstopBy(b, m) {
    const T = +(b || {}).turn || 0;
    if (!T || !m) return null;
    for (const x of Object.values((b && b.mons) || {})) {
      if (!x || x.id === m.id || !x.entry || !x.hp || !(x.hp.cur > 0)) continue;
      if (x.tstop && +x.tstop.t === T) return x;
    }
    return null;
  }
  function misagA1(b, m) {
    {
      const ts = tstopBy(b, m);
      if (ts) return `「타임」이 발동한 턴 — ${ts.name} 이외는 이번 턴 행동 불능 (교대는 된다)`;
    }
    const L = m && m.a1Lock;
    if (!L || +L.t !== (+(b || {}).turn || 0)) return '';
    return `각성체 대가 A-1 — 지난 턴 종료 때 ${String(L.why || '')
      .replace(/^각성체 대가 A-1 — /, '')
      .replace(/\s*행동 불능$/, '')} → 이번 턴 행동 불능 (교대는 된다)`;
  }
  function misagA1Cond(b, m) {
    const t = ((b && b.trainers) || {})[m && m.tid];
    const M = t && t.misag;
    if (!M || m.awaken !== 'free' || !(M.items || []).some(x => x.key === 'A-1')) return '';
    const onF = x => !!(x && x.entry && x.hp && x.hp.cur > 0);
    const hasType = (x, ko) => {
      const en = window.OM_STATS && window.OM_STATS.typeEn ? window.OM_STATS.typeEn(ko) : ko;
      if (teraOn(x)) return x.teraEn === en;
      return (x.types || []).includes(en) || (x.typesKo || []).includes(ko);
    }; /* 테라스탈이면 타입 4 만 (11-02) */
    const own = Object.values(b.mons || {}).filter(x => x && x.tid === m.tid);
    /* 11-10 망령 「2체 기준을 바꾸자 — 짝으로 판정 말고 필드 위에 아군이 없을 때 혹은 자신의 타입이 변경되어 있을 때」: 2체 기준(트레이너 two · 그 트레이너가 이 배틀에 2체 이하)은 지정 타입을 세지 않는다 — 자신의 타입이 바뀌어 있으면(타입 변경 typesOrig · 테라스탈) 또는 필드 위에 자신 이외의 아군(같은 진영 · 다른 PC 포켓몬도 됨)이 한 체도 없으면 행동 불능. (11-09 「짝 기준」 대체) */
    if (t.two || own.length <= 2) {
      if (m.typesOrig || teraOn(m)) return `각성체 대가 A-1 — 자신의 타입이 바뀌어 있어(${teraOn(m) ? '테라스탈' : '타입 변경'}) 행동 불능`;
      return Object.values(b.mons || {}).some(x => x && x.side === m.side && x.id !== m.id && onF(x))
        ? ''
        : '각성체 대가 A-1 — 필드 위에 자신 이외의 아군이 없어 행동 불능';
    }
    if (!M.type) return '';
    const others = Object.values(b.mons || {}).filter(x => x && x.side === m.side && x.id !== m.id && onF(x));
    /* 6체: 필드 위 다른 아군 (같은 진영) */ return others.some(x => hasType(x, M.type))
      ? ''
      : `각성체 대가 A-1 — 필드 위 다른 아군 중 ${M.type} 타입이 없어 행동 불능`;
  }
  /* 고유 포텐셜 = 트레이너 것. 횟수는 battle.trainers[tid].uUses */
  /* 11-09 망령 「4식을 소모해서 · 지령을 소모해서 — 발동했을 때 남은 것 중 무엇을 소모할지 창」: 구문 「소모 4식 | 소모 지령 | 소모 4식지령 [N]」 — 그 트레이너의 남은 4식 · 지령(횟수 1 이상)을 띄워 고른 것을 1 깎는다 */
  async function spendPick(mm, name, what, n, choose) {
    const tid = mm && mm.tid;
    const out = [];
    if (!tid) return null;
    for (let k = 0; k < Math.max(1, +n || 1); k++) {
      const tc = (ctx().b.trainers || {})[tid] || {};
      const cnt = tc.orderCount || {};
      const rows = [];
      for (const kind of what === 'any' ? ['order', 'command'] : [what === 'command' ? 'command' : 'order']) {
        let ks = [];
        try {
          ks = kind === 'order' ? OO().orderKeys(tc) : OO().commandKeys(tc);
        } catch (e) {}
        for (const key of ks) {
          const ck = (kind === 'order' ? 'order_' : 'command_') + key;
          const v = +cnt[ck] || 0;
          if (v > 0) rows.push({ kind, key, ck, v, nm: kind === 'order' ? OO().orderName(tc, key) : OO().commandName(tc, key) });
        }
      }
      const KW = what === 'command' ? '『지령』' : what === 'any' ? '『4식』 · 『지령』' : '『4식』';
      if (!rows.length) {
        A().toast(`${tc.name || ''} — 소모할 ${KW}이 남아 있지 않다`);
        return out.length ? out : null;
      }
      const r = await choose(rows.map(x => `${x.kind === 'order' ? '4식' : '지령'} 『${x.nm}』 — 남은 ${x.v}`));
      const x = rows[Array.isArray(r) && r.length ? +r[0] : -1];
      if (!x) return out.length ? out : null;
      const ops = [[['battle', 'trainers', tid, 'orderCount', x.ck], x.v - 1]];
      if (x.kind === 'command') {
        const sk = OO().shareKey ? OO().shareKey(tc, x.key) : '';
        if (sk) ops.push([['battle', 'trainers', tid, 'orderCount', 'command_' + sk], Math.max(0, (+cnt['command_' + sk] || 0) - 1)]);
      }
      await A().setMany(ops);
      out.push(`${tc.name || ''} ${x.kind === 'order' ? '4식' : '지령'} 『${x.nm}』 소모 (『${name}』) — 남은 ${x.v - 1}`);
    }
    return out;
  }
  /* 11-09 망령 「지령을 받았을 때 · 4식을 받았을 때 · 전용 포텐셜이 발동했을 때 같은 것들은? — 발동 기준(선행 입력한 뒤 발동할 때)」: fireOrder · fireSpecial(전용)이 실제로 발동한 뒤 부른다.
    같은 편의 필드 위 포켓몬 포텐셜 · 트레이너 고유 중 글에 그 계기가 있는 것 — 「아군」이 받는 것이면 받은 포켓몬을 대상(1체)으로, 아니면 자신이 받았을 때만. 【자동】은 바로, 아니면 묻는다. 구문이 없으면 알림만 */
  const RCV_RE = {
    command: /[『「]?지령(?:\s*\([^)]*\))?[』」]?(?:\s*\([^)]*\))?\s*을\s*받(?:았을|은|을(?!\s*수)|는)/,
    order: /[『「]?(?:4식|명령)(?:\s*\([^)]*\))?[』」]?(?:\s*\([^)]*\))?\s*을\s*받(?:았을|은|을(?!\s*수)|는)/,
    excl: /[『「]?전용\s*포텐셜[』」]?\s*이\s*발동(?:했을|한|할|하)/,
    /* 11-18 망령 「결계나 영창 발동 트리거 없어?」(오호게츠히메 『식량 결계』 【보급】/『결계』가 발동했을 때): 같은 편 트레이너의 5계(결계) · 영창이 발동하면 — 필드 전체에 거는 것이라 받은 포켓몬이 아니어도 같은 편 필드 위 포켓몬 모두가 계기를 본다 */
    barrier: /(?<![가-힣])[『「]?결계[』」]?\s*(?:이|가|을|를)\s*(?:(?:발동|전개)\s*(?:했을|하였을|한|할|하)|받(?:았을|은|는))/,
    chant: /(?<![가-힣])[『「]?영창[』」]?\s*(?:이|가|을|를)\s*(?:(?:발동|전개)\s*(?:했을|하였을|한|할|하)|받(?:았을|은|는))/
  };
  const RCV_DONE = {};
  async function rcvReact(tid, mid, ev, src) {
    const c = ctx();
    const b = c.b;
    const rc = (b.mons || {})[mid];
    const RE = RCV_RE[ev];
    if (!rc || !RE || !FX()) return;
    const KN = { command: '『지령』', order: '『4식』', excl: '『전용 포텐셜』', barrier: '『결계』', chant: '『영창』' }[ev];
    const tk = turnKey(b);
    const WIDE = ev === 'barrier' || ev === 'chant';
    const clause = t =>
      String(t || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .split(/(?=[①②③④⑤])|\n/)
        .find(x => RE.test(x)) || '';
    const C = [];
    for (const mm of Object.values(b.mons || {})) {
      if (!mm || !mm.entry || !(mm.hp && mm.hp.cur > 0) || !sameT(mm, rc, b)) continue;
      for (const p of potSrc(mm)) {
        const cl = clause(p.eff);
        if (!cl) continue;
        const ally = /아군/.test(cl);
        if (!WIDE && !ally && mm.id !== rc.id) continue;
        if (ev === 'excl' && mm.id === rc.id && p.name === src) continue;
        const ex = (mm.excl && mm.excl.name === p.name) || (mm.exclX || []).some(q => q && q.name === p.name);
        C.push({ who: mm.name, own: mm, tid: mm.tid, p, cl, kind: ex ? 'ex' : 'pot', a: FX().autoOf(mm, 'pot', p.name) });
      }
    }
    for (const t of Object.values(b.trainers || {})) {
      if (!t || t.side !== rc.side) continue;
      for (const q of uniqList(t)) {
        const cl = clause(q.p.eff);
        if (!cl) continue;
        if (q.left !== null && q.left <= 0) continue;
        C.push({ who: t.name, own: null, tid: t.id, p: q.p, cl, kind: 'uq', a: FX().autoOf({ tid: t.id }, 'pot', q.p.name) });
      }
    }
    for (const x of C) {
      const k = [tk, x.kind, x.own ? x.own.id : x.tid, x.p.name, ev, mid].join('|');
      if (RCV_DONE[k]) continue;
      RCV_DONE[k] = 1;
      if (!c.gm && !ownT(c, x.tid)) continue;
      const why = WIDE
        ? `${KN} — ${((b.trainers || {})[tid] || {}).name || ''}의 『${String(src || '').replace(/[『』]/g, '')}』 발동`
        : `${KN} — ${rc.name}${ev === 'excl' ? '의 『' + String(src || '').replace(/[『』]/g, '') + '』 발동' : '이(가) 『' + String(src || '').replace(/[『』]/g, '') + '』을(를) 받았다'}`;
      if (!x.a || !realOps(x.a) || x.a.manual) {
        A().sysLog(`【계기】 ${why}\n→ ${x.who} 『${x.p.name}』 — 효과는 손으로`, 'battle', {
          mid: x.own ? x.own.id : '',
          eff: String(x.p.eff || '')
            .replace(/<br\s*\/?>/g, '\n')
            .slice(0, 300)
        });
        continue;
      }
      if (!/【\s*자동\s*】/.test(String(x.p.eff || ''))) {
        const q = `${why}\n\n${x.who} 『${x.p.name}』 을(를) 발동할까?\n${String(x.cl).slice(0, 160)}`;
        if (!(await remoteAsk(x.own || rc, 'confirm', { name: x.p.name, q }, () => askYes(q, '발동', '그만')))) continue;
      } /* 11-17: 주인에게 묻기 (위 trigFire 와 같이) */
      try {
        if (x.kind === 'uq') await fireSpecial(x.tid, rc.id, 'uq', x.p.name, 'free');
        else if (x.kind === 'ex') await fireSpecial(x.tid, x.own.id, 'ex', x.p.name, 'free');
        else
          await fireAuto(x.own.id, 'pot', x.p.name, {
            auto: x.a,
            manual: 1,
            pickId: rc.id,
            head: `【포텐셜】 ${x.own.name} 『${x.p.name}』 — ${why}`,
            eff: String(x.p.eff || '')
          });
      } catch (e) {
        console.warn('rcvReact', e);
      }
    }
  }
  /* 11-21 망령 「해석이 트리거가 안 돼 있으면 만들어 — 해석했을 때」: 우리 편이 상대를 데이터 해석하면(도감 · 효과 · 기술) 같은 편 필드 위 포켓몬의 포텐셜 · 전용 · 특성 · 트레이너 고유 중
    글에 「(데이터를) 해석했을 때」가 있는 것을 계기로 본다. 대상(1체)은 해석된 상대. 【자동】은 바로, 아니면 묻는다. 구문이 없으면 알림만 (rcvReact 와 같은 흐름).
    「해석했을 때에만 사용할 수 있다」(헬레나 보구)는 사용 조건이라 계기가 아니다 */
  const DEX_RE =
    /(?:데이터|정보)(?:를|을)?\s*해석(?:했을|하였을|한)\s*(?:때|직후|경우)(?!에만)|『?데이터\s*해석』?\s*(?:을|를)\s*(?:했을|한)\s*(?:때|직후)(?!에만)/;
  const DEX_DONE = {};
  async function dexReact(d) {
    const c = ctx();
    const b = c.b;
    if (!b || !FX() || !d) return;
    const tg = (b.mons || {})[d.mid];
    const vt = (b.trainers || {})[d.viewer];
    if (!tg || !vt) return;
    const tk = turnKey(b);
    const clause = t =>
      String(t || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .split(/(?=[①②③④⑤])|\n/)
        .find(x => DEX_RE.test(x)) || '';
    const C = [];
    for (const mm of Object.values(b.mons || {})) {
      if (!mm || !mm.entry || !(mm.hp && mm.hp.cur > 0) || !sameT(mm, d.viewer, b)) continue;
      for (const p of potSrc(mm)) {
        const cl = clause(p.eff);
        if (!cl) continue;
        const ex = (mm.excl && mm.excl.name === p.name) || (mm.exclX || []).some(q => q && q.name === p.name);
        C.push({ who: mm.name, own: mm, tid: mm.tid, p, cl, kind: ex ? 'ex' : 'pot', a: FX().autoOf(mm, 'pot', p.name) });
      }
      if (mm.ability) {
        const te = String(mm.abilityEff || ((DB().traits || {})[mm.ability] || {}).multi || '');
        const cl = clause(te);
        if (cl)
          C.push({
            who: mm.name,
            own: mm,
            tid: mm.tid,
            p: { name: mm.ability, eff: te },
            cl,
            kind: 'trait',
            a: FX().autoOf(mm, 'trait', mm.ability)
          });
      }
    }
    for (const t of Object.values(b.trainers || {})) {
      if (!t || !sameT(t.id, d.viewer, b)) continue;
      for (const q of uniqList(t)) {
        const cl = clause(q.p.eff);
        if (!cl) continue;
        if (q.left !== null && q.left <= 0) continue;
        C.push({ who: t.name, own: null, tid: t.id, p: q.p, cl, kind: 'uq', a: FX().autoOf({ tid: t.id }, 'pot', q.p.name) });
      }
    }
    const why = `데이터 해석 — ${vt.name || ''} → ${tg.name}${d.by ? ' (「' + String(d.by).replace(/[『』「」]/g, '') + '」)' : ''}`;
    for (const x of C) {
      const k = [tk, x.kind, x.own ? x.own.id : x.tid, x.p.name, 'dex', d.mid].join('|');
      if (DEX_DONE[k]) continue;
      DEX_DONE[k] = 1;
      if (!c.gm && !ownT(c, x.tid)) continue;
      if (!x.a || !realOps(x.a) || x.a.manual) {
        A().sysLog(`【계기】 ${why}\n→ ${x.who} 『${x.p.name}』 — 효과는 손으로`, 'battle', {
          mid: x.own ? x.own.id : '',
          eff: String(x.p.eff || '')
            .replace(/<br\s*\/?>/g, '\n')
            .slice(0, 300)
        });
        continue;
      }
      if (!/【\s*자동\s*】/.test(String(x.p.eff || ''))) {
        const q = `${why}\n\n${x.who} 『${x.p.name}』 을(를) 발동할까?\n${String(x.cl).slice(0, 160)}`;
        if (!(await remoteAsk(x.own || tg, 'confirm', { name: x.p.name, q }, () => askYes(q, '발동', '그만')))) continue;
      }
      try {
        if (x.kind === 'uq') await fireSpecial(x.tid, tg.id, 'uq', x.p.name, 'free');
        else if (x.kind === 'ex') await fireSpecial(x.tid, x.own.id, 'ex', x.p.name, 'free');
        else
          await fireAuto(x.own.id, x.kind === 'trait' ? 'trait' : 'pot', x.p.name, {
            auto: x.a,
            manual: 1,
            pickId: tg.id,
            head: `【${x.kind === 'trait' ? '특성' : '포텐셜'}】 ${x.own.name} 『${x.p.name}』 — ${why}`,
            eff: String(x.p.eff || '')
          });
      } catch (e) {
        console.warn('dexReact', e);
      }
    }
  }
  window.addEventListener('om:dexdone', e => {
    const d = e && e.detail;
    if (!d) return;
    const b = ctx().b;
    if (!b || !(b.mons || {})[d.mid]) return;
    setTimeout(() => dexReact(d).catch(er => console.warn('dexReact', er)), 300);
  });
  /* 11-25 망령 「고유 · 전용 꾸미기 웹툴에도 다」: 고유 색(u.color) · 전용 타입 색(excl.ty) — 컷인 띠 · 고유/전용 꼬리표. 글자색은 바탕 밝기로 검정/흰색 */
  const RCB_RE = /「반동\s*:\s*화상」/;
  const rcbFire = mv => /「타입\s*:\s*불꽃」\s*이라도\s*「화상」/.test(String((mv && mv.note) || '') + ' ' + String((mv && mv.eff) || ''));
  const hexOk = v => {
    v = String(v || '').trim();
    return /^#[0-9a-f]{3,8}$/i.test(v) ? v : '';
  };
  const fgOn = c => {
    const h = String(c || '').replace('#', '');
    const x =
      h.length === 3
        ? h
            .split('')
            .map(z => z + z)
            .join('')
        : h.slice(0, 6);
    if (!/^[0-9a-f]{6}$/i.test(x)) return '#fff';
    const r = parseInt(x.slice(0, 2), 16),
      g = parseInt(x.slice(2, 4), 16),
      bb = parseInt(x.slice(4, 6), 16);
    return (r * 299 + g * 587 + bb * 114) / 1000 >= 150 ? '#111' : '#fff';
  };
  function uqColOf(t, name) {
    const n = String(name || '')
      .replace(/[『』]/g, '')
      .trim();
    const u = ((t && t.unique) || []).find(
      q =>
        q &&
        String(q.name || '')
          .replace(/[『』]/g, '')
          .trim() === n
    );
    return u ? hexOk(u.color) : '';
  }
  function exColOf(m, name) {
    const n = String(name || '')
      .replace(/[『』]/g, '')
      .trim();
    const x = [m && m.excl, ...((m && m.exclX) || [])].find(
      q =>
        q &&
        String(q.name || '')
          .replace(/[『』]/g, '')
          .trim() === n
    );
    if (!x || !x.ty) return '';
    try {
      const en = tyEnStrict(x.ty);
      return en ? hexOk(S().typeColor(en).bg) : '';
    } catch (e) {
      return '';
    }
  }
  const spSty = c => (c ? ` style="--spc:${c};--spf:${fgOn(c)}"` : '');
  function uniqList(t) {
    return ((t && t.unique) || [])
      .filter(u => u && u.name)
      .map(u => {
        const L = limOf(u, t.uUses || {}, t.uTurn || {});
        return { p: u, kind: '고유', max: L.max, left: L.left, mmax: L.mmax, ml: L.ml, per: L.per };
      });
  }
  function potList(m) {
    const out = [];
    const src = potSrc(m);
    for (const p of src) {
      const mm = String(p.eff || '').match(/【(\d+)\/시】/);
      if (mm) out.push({ name: p.name, max: +mm[1] });
    }
    return out;
  }
  /* 해석: 상대 포켓몬의 타입은 「타입」 해석(또는 전체)부터, 포텐셜 칸은 전체 해석부터 보인다 (도감 scope 기준 — GM · 주인 · 같은 편은 늘 보인다) */
  /* PL 권한(공평 모드) 중의 GM 은 플레이어 몫 포켓몬을 자기 트레이너 눈으로 본다 — 같은 편이거나, 자기 트레이너의 도감으로 해석한 만큼만 */
  function plView(c) {
    return c.gm && c.fair;
  }
  function gmEyes(c, m) {
    const trs = c.b.trainers || {};
    const mine = myTrainers(c).filter(t => trs[t]);
    const al = mine.find(t => trs[t].side && sameT(t, m, c.b));
    return al || mine.find(t => !sameT(t, m, c.b)) || mine[0] || '';
  }
  function dexSees(c, m, part) {
    if ((c.gm && !c.fair) || canEdit(c, m) || c.b.pvp) return true;
    /* 11-03 PVP 설정: 모두에게 전체 해석 상태 (표시만 — dex 기록은 그대로) */ const D = window.OM_DEX_UI;
    if (!D || !D.scope) return !c.gm;
    const sc = c.gm
      ? (() => {
          const v = gmEyes(c, m);
          return v ? D.scope(m.id, v, true) : [];
        })()
      : D.scope(m.id, c.seat || '');
    return sc === 'all' || (part !== 'all' && Array.isArray(sc) && sc.includes(part));
  }
  /* 11-28 망령 「배틀 할 때 상대의 타입이 변경, 추가 되어서 확정 정보가 되면 타입 ? 가 아니라 표기」:
    도감 미해석이어도 타입 변경 · 추가(typesOrig — fx 「타입 변경」 · 직접 변경이 같은 꼴로 남김)로 드러난 타입은 보인다.
    원래 타입이 모두 남은 「추가」는 더해진 타입만 보이고 나머지는 「?」 */
  function seenTypes(c, m) {
    const cur = (m.types || []).filter(t => t !== '-');
    if (dexSees(c, m, 'type')) return { types: cur, rest: false };
    if (!m.typesOrig) return { types: [], rest: true };
    const orig = m.typesOrig.filter(t => t !== '-');
    const kept = orig.every(t => cur.includes(t));
    return kept ? { types: cur.filter(t => !orig.includes(t)), rest: true } : { types: cur, rest: false };
  }
  function seenTypesKo(c, m) {
    const s = seenTypes(c, m);
    const ko = s.types.map(t => S().typeKo(t));
    return s.rest ? (ko.length ? ko.concat('?') : []) : ko;
  }
  function tyHtml(c, m) {
    const s = seenTypes(c, m);
    const chips = s.types.map(typeChip).join('');
    if (!s.rest) return chips;
    return chips.length
      ? chips + '<span class="tyq" title="더해진 타입만 확정 — 원래 타입은 도감으로 해석하면 보인다">+ ?</span>'
      : '<span class="tyq" title="타입 미해석 — 도감으로 해석하면 보인다">타입 ?</span>';
  }
  /* 11-04 19:29 망령 「선행 포텐셜은 입력하기 전에 곧바로 『사용』으로 돼 있어서 무심코 쓰는 경우가 많다 — 지시 때엔 카드에서 선행 입력하게 · 쓸 때 선행 입력 안 됐으면 경고창으로 강제 발동할지 묻게」
    · 지시 단계(페이즈 0)에 내가 지시할 수 있는 포켓몬의 【선행】 포텐셜(일반 · 전용)은 카드 버튼이 「선행 입력」(누르면 지시의 선행 입력 칸에 넣고 빼기 · 바로 저장)
    · 행동 단계에 카드(폰 포텐셜 창 포함)에서 【선행】 포텐셜을 사용 · 발동하려는데 이번 턴 선행 입력이 아니면 「강제로 발동할까?」 */
  const potIsPre = (m, n) => {
    const p = potSrc(m, 1).find(q => q && q.name === n);
    return /【\s*선행\s*】/.test(String((p && p.eff) || ''));
  };
  function preCardOK(c, m) {
    if (!m || !m.entry || !(+(m.hp || {}).cur > 0)) return false;
    if ((+c.b.phase || 0) !== 0 || c.b.endq) return false;
    if (!(ownT(c, m.tid) || (c.gm && !fairOff(c, m.tid)))) return false;
    return !(c.ST.state.ready || {})[m.tid];
  }
  function prePotBtn(c, m, n) {
    const cur = cmdNow(m.tid, c.b);
    const on = !!cur && (((cur.mons || {})[m.id] || {}).pots || []).includes(n);
    return `<button class="btn xs ${on ? 'pri' : 'ghost'} prepot" data-act="pretoggle" data-mid="${m.id}" data-pot="${esc(n)}" title="${on ? '선행 입력함 — 누르면 뺀다' : '【선행】 — 누르면 이번 턴 지시에 선행 입력 (턴 개시 뒤 발동)'}">${on ? '✓ 선행' : '선행 입력'}</button>`;
  }
  const preWrap = (c, m, n, html) => (preCardOK(c, m) && potIsPre(m, n) ? prePotBtn(c, m, n) : html);
  /* 11-04 19:45 망령 「포켓몬 말고 고유 포텐셜도 선행 입력은 선행 로직 따르게」: 트레이너 칸 고유의 「발동」도 지시 단계엔 「선행 입력」(지시의 upots) */
  const effPre = t => /【\s*선행\s*】/.test(String(t || '')),
    effFree = t => /【\s*임의\s*】/.test(String(t || ''));
  /* 11-11 망령 (카렌 『죽음을 각오한 저항』 ①【사전】【탈진】/… ②【선행】/①의 효과를 발동했을 때 기술을 지정한다 …) 「사전하면서 ① 적용 · 선행 입력으로 기술 선언 · 턴 개시 때 공개 — 다 잘 되도록」:
    두 단계 포텐셜 = 글에 ①【…사전…】 과 ②【선행】 이 있고 ②가 ①을 발동했을 때를 받는다. ① = 지정기술(dmv) · 기술지정 줄을 뺀 구문, ② = 지정기술 · 기술지정(+대상지정) 줄만.
    ①을 쓰면 t.preDone[이름] = {t: 턴, tgt: 대상} — 그 턴 ②는 횟수를 다시 쓰지 않고, 선행 입력도 막지 않는다. ②는 턴 개시 때 저절로(GM) 발동해 고른 기술을 공개한다 */
  const twoStage = t => {
    t = String(t || '');
    return /①\s*【[^】]*사전[^】]*】/.test(t) && /②\s*【\s*선행\s*】/.test(t);
  };
  const preDoneOf = (t, name) => {
    const d = ((t && t.preDone) || {})[
      String(name || '')
        .replace(/[『』]/g, '')
        .trim()
    ];
    return d && +d.t === (+(ctx().b || {}).turn || 0) ? d : null;
  };
  const stageOps = (a, st) => {
    if (!a || !a.ops) return a;
    const two = o => o && (o.k === 'msel' || o.dmv);
    const ops = a.ops.filter(o => o && (o.k === 'tsel' || (st === 2 ? two(o) : !two(o))));
    return Object.assign({}, a, { ops });
  };
  function preTrOK(c, tid) {
    const b = c.b;
    if ((+b.phase || 0) !== 0 || b.endq) return false;
    if (!(ownT(c, tid) || (c.gm && !fairOff(c, tid)))) return false;
    return !(c.ST.state.ready || {})[tid];
  }
  function preUqBtn(c, tid, n) {
    const cur = cmdNow(tid, c.b);
    const on = !!cur && (cur.upots || []).includes(n);
    return `<button class="btn xs ${on ? 'pri' : 'ghost'} prepot" data-act="upretoggle" data-tid="${tid}" data-pot="${esc(n)}" title="${on ? '선행 입력함 — 누르면 뺀다' : '【선행】 — 누르면 이번 턴 지시에 선행 입력 (턴 개시 뒤 「포텐셜 발동 → 선행 발동」)'}">${on ? '✓ 선행' : '선행 입력'}</button>`;
  }
  /* 11-21 망령 「소지품 해석」: 상대 포켓몬이라도 우리 편이 소지품을 해석했으면 카드에 소지품 칸 (데이터 해석으로는 안 열린다) */
  function itemSeenC(c, m) {
    if (canEdit(c, m)) return true;
    const D = window.OM_DEX_UI;
    if (!D || !D.itemSeen) return false;
    if (c.gm && !c.fair) return true;
    const v = c.gm ? gmEyes(c, m) : c.seat || '';
    return !!v && D.itemSeen(m.id, v, c.gm);
  }
  function enemyItemHtml(c, m) {
    if (canEdit(c, m) || !itemSeenC(c, m)) return '';
    const L = [{ item: m.item, itemEff: m.itemEff }, ...(m.items2 || [])].filter(x => x && x.item && x.item !== '-');
    if (!L.length) return '';
    return L.map(
      x =>
        `<span class="pot" title="「소지품 해석」으로 보인다 · ${esc(
          String(x.itemEff || '')
            .replace(/<br\s*\/?>/g, ' ')
            .slice(0, 300)
        )}"><span class="potn"><span class="potk">소지품 </span>${esc(x.item)}</span></span>`
    ).join('');
  }
  function potLine(c, m) {
    const full = canEdit(c, m);
    if (!full && !dexSees(c, m, 'all')) {
      const ei = enemyItemHtml(c, m);
      return ei ? `<div class="pots pgs"><div class="pgrp one">${ei}</div></div>` : '';
    }
    const L = potList(m).filter(p => full || !isExcl(m, p));
    /* 전용 포텐셜은 주인(과 GM)만 본다 */ const u = m.potUses || {};
    const Lnames = new Set(L.map(p => p.name));
    /* 횟수 없는 자동화(포텐셜·특성·소지품) 도 「발동」 버튼으로 */
    const extra = [];
    if (FX() && full) {
      const src = potSrc(m).filter(p => !Lnames.has(p.name));
      for (const p of src) {
        const a = FX().autoOf(m, 'pot', p.name);
        if (a && a.ops && a.ops.length && !a.manual) extra.push(['pot', p.name]);
      }
      if (m.ability) {
        const a = FX().autoOf(m, 'trait', m.ability);
        if (a && a.ops && a.ops.length && !a.manual && !FX().timing(a.text).entry && !FX().timing(a.text).passive) extra.push(['trait', m.ability]);
      }
      for (const it of [m.item, ...(m.items2 || []).map(x => x && x.item)]) {
        if (!it) continue;
        const a = FX().autoOf(m, 'item', it);
        if (a && a.ops && a.ops.length && !a.manual && !FX().timing(a.text).entry && !extra.some(([k, n]) => k === 'item' && n === it))
          extra.push(['item', it]);
      }
    }
    const sp = full ? specialPots(m).filter(s => !Lnames.has(s.p.name) && !extra.some(([k, n]) => k === 'pot' && n === s.p.name)) : [];
    /* 10-21 망령: 폰에서는 칩 · 버튼을 늘어놓지 않고 한 줄 요약 칸 — 누르면 포텐셜 카드 창 (카드가 길어지고 작은 버튼이 상세 보기 터치와 겹쳤다) */
    if (full && window.matchMedia && matchMedia('(max-width:760px)').matches) {
      const nP = (m.pots || []).filter(p => p && p.name && !p.ph).length;
      const SPs = specialPots(m).filter(s => s.kind === '전용');
      const hasI = m.item && m.item !== '-';
      const nA =
        extra.length +
        L.filter(p => {
          const a = FX() && FX().autoOf(m, 'pot', p.name);
          const left = u[p.name] == null ? p.max : +u[p.name];
          return a && a.ops && a.ops.length && !a.manual && left > 0;
        }).length;
      const tot = nP + SPs.length + (hasI ? 1 : 0);
      const pp = SPs.filter(s => s.max != null)
        .map(s => pipsL(s))
        .join('');
      return tot
        ? `<button type="button" class="potsum" data-act="pots" data-mid="${m.id}" title="포텐셜 ${nP} · 전용 ${SPs.length}${hasI ? ' · 소지품 ' + esc(m.item) : ''} — 눌러서 출력 · 발동 · 사용"><span class="psl">포텐 <b>${tot}</b></span>${pp ? `<span class="psp">${pp}</span>` : ''}${nA ? `<span class="psf" title="발동할 수 있는 것 ${nA}">⚡${nA}</span>` : ''}</button>`
        : '';
    }
    const spHtml = sp.length
      ? `<div class="pots sppots">${sp
          .map(
            s =>
              `<span class="pot sp ${s.kind === '고유' ? 'uq' : 'ex'}" title="${esc(
                String(s.p.eff || '')
                  .replace(/<br\s*\/?>/g, ' ')
                  .slice(0, 300)
              )}"><em>${s.kind}</em><span class="potn">${esc(s.p.name)}</span>${s.max != null ? pipsL(s) : ''}${preWrap(c, m, s.p.name, spBtn(m, s))}</span>`
          )
          .join('')}</div>`
      : '';
    /* 자동화가 없는 소지품도 「📢 발동」으로 로그에 표시 */
    const itemAnn =
      full && m.item && m.item !== '-' && !extra.some(([k]) => k === 'item')
        ? `<span class="pot" title="${esc(
            String(m.itemEff || '')
              .replace(/<br\s*\/?>/g, ' ')
              .slice(0, 300)
          )}"><span class="potn"><span class="potk">소지품 </span>${esc(m.item)}</span><button class="btn xs" data-act="announce" data-mid="${m.id}" data-kind="item" data-pot="${esc(m.item)}" title="효과를 로그에 출력 (자동화 없음)" aria-label="발동">📢<span class="potk"> 발동</span></button></span>`
        : '';
    /* 10-25 망령: 늘 같은 순서로 — 전용 → 고유 → 포텐셜(횟수) → 포텐셜(자동) → 특성 → 소지품 */
    const rows = [];
    for (const p of L) {
      const left = u[p.name] == null ? p.max : +u[p.name];
      const a = FX() && FX().autoOf(m, 'pot', p.name);
      const spk = (potSrc(m).find(q => q.name === p.name) || {}).unique ? '고유' : isExcl(m, p) ? '전용' : '';
      rows.push([
        spk === '전용' ? 0 : spk === '고유' ? 1 : 2,
        `<span class="pot ${left <= 0 ? 'off' : ''} ${a && a.ops && a.ops.length && !a.manual ? 'auto' : ''} ${spk ? 'sp ' + (spk === '고유' ? 'uq' : 'ex') : ''}"${spk === '전용' ? spSty(exColOf(m, p.name)) : spk === '고유' ? spSty(uqColOf((ctx().b.trainers || {})[m.tid], p.name)) : ''} title="${esc(p.name)}${a && a.ops && a.ops.length ? ' · 자동: ' + esc(FX().unparse(a.ops).join(' / ')) : ''}">${spk ? `<em>${spk}</em>` : ''}<span class="potn">${esc(p.name)}</span>${pips(left, p.max)}${full && left > 0 ? (potRest(m, p.name) ? restChip(potRest(m, p.name)) : preWrap(c, m, p.name, `<button class="btn xs" data-act="usepot" data-mid="${m.id}" data-pot="${esc(p.name)}" data-card="1">사용</button>`)) : ''}${full && left < p.max ? `<button class="btn xs ghost" data-act="restorepot" data-mid="${m.id}" data-pot="${esc(p.name)}">+</button>` : ''}</span>`
      ]);
    }
    for (const s2 of sp)
      rows.push([
        s2.kind === '고유' ? 1 : 0,
        `<span class="pot sp ${s2.kind === '고유' ? 'uq' : 'ex'}"${spSty(s2.kind === '고유' ? hexOk(s2.p.color) || uqColOf((ctx().b.trainers || {})[m.tid], s2.p.name) : exColOf(m, s2.p.name))} title="${esc(
          String(s2.p.eff || '')
            .replace(/<br\s*\/?>/g, ' ')
            .slice(0, 300)
        )}"><em>${s2.kind}</em><span class="potn">${esc(s2.p.name)}</span>${s2.max != null ? pipsL(s2) : ''}${preWrap(c, m, s2.p.name, spBtn(m, s2))}</span>`
      ]);
    for (const [k, n] of extra) {
      const a = FX().autoOf(m, k, n);
      rows.push([
        k === 'pot' ? 3 : k === 'trait' ? 4 : 5,
        `<span class="pot auto" title="${esc(n)} · ${esc(FX().unparse(a.ops).join(' / '))}"><span class="potn">${k === 'trait' ? '특성 ' : k === 'item' ? '소지품 ' : ''}${esc(n)}</span>${k === 'pot' && potRest(m, n) ? restChip(potRest(m, n)) : k === 'pot' ? preWrap(c, m, n, `<button class="btn xs" data-act="fireauto" data-mid="${m.id}" data-kind="${k}" data-pot="${esc(n)}" data-card="1">발동</button>`) : `<button class="btn xs" data-act="fireauto" data-mid="${m.id}" data-kind="${k}" data-pot="${esc(n)}">발동</button>`}</span>`
      ]);
    }
    if (itemAnn) rows.push([5, itemAnn]);
    {
      const ei = enemyItemHtml(c, m);
      if (ei) rows.push([5, ei]);
    }
    if (!rows.length) return '';
    rows.sort((x, y) => x[0] - y[0]); /* 같은 무리 안에서는 시트 순서 그대로 (안정 정렬) */
    /* 11-03 21:02 망령 「카드 길이가 왔다갔다 거슬린다 — 전용 · 포텐셜 · 소지품 순으로 나누고 옆 여백을 써서 한 줄에 두 칸씩」 · 21:04 「하나뿐이면 한 줄에 하나」: 무리(전용 · 고유 / 포텐셜 · 특성 / 소지품)마다 2열 격자, 하나면 한 칸 */
    const G = [[0, 1], [2, 3, 4], [5]];
    const grp = G.map(ks => rows.filter(r => ks.includes(r[0]))).filter(g => g.length);
    return `<div class="pots pgs">${grp.map(g => `<div class="pgrp ${g.length === 1 ? 'one' : ''}">${g.map(r => r[1]).join('')}</div>`).join('')}</div>`;
  }
  function cmdOf(b, m) {
    const cm = (b.cmds || {})[m.tid];
    if (!cm || !cm.mons || !cm.mons[m.id]) return '';
    const x = cm.mons[m.id];
    const parts = [];
    if (x.move === 'switch') parts.push(`<b>교대</b> → ${esc(monName(b, x.switch))}`);
    else if (x.move != null && x.move !== '') {
      const mv = MVS(m)[+x.move];
      parts.push(`<b>${esc(mv ? mv.name : '?')}</b>${mv ? ' ' + typeChip(mv.typeEn) : ''}`);
      if (x.targets && x.targets.length) parts.push('→ ' + x.targets.map(s => slotName(b, s)).join(', '));
    }
    if (x.prio && Object.values(x.prio).some(v => v !== '' && +v !== 0))
      parts.push(
        '우선도 ' +
          Object.entries(x.prio)
            .filter(([k, v]) => v !== '' && +v !== 0)
            .map(([k, v]) => slotName(b, k) + ' ' + v)
            .join(', ')
      );
    if (x.ochg && Object.values(x.ochg).some(v => v !== '' && +v !== 20))
      parts.push(
        '순서 ' +
          Object.entries(x.ochg)
            .filter(([k, v]) => v !== '' && +v !== 20)
            .map(([k, v]) => slotName(b, k) + ' ' + v)
            .join(', ')
      );
    const fd = (cm.fired || {})[m.id] || {};
    if (fd.order) parts.push(`<span class="rk up">『${esc(orderName(b, m.tid, 'order', fd.order))}』</span>`);
    if (fd.command) parts.push(`<span class="rk up">『${esc(orderName(b, m.tid, 'command', fd.command))}』</span>`);
    if (x.pots && x.pots.length)
      parts.push(
        x.pots
          .map(p => {
            const src = potSrc(m).find(q => q.name === p) || {};
            const k = src.unique ? '고유' : (m.excl && m.excl.name === p) || (m.exclX || []).some(q => q.name === p) ? '전용' : '포텐셜';
            return `<span class="rk fxc" title="${esc(src.eff || '')}">${k} 『${esc(p)}』</span>`;
          })
          .join(' ')
      );
    if (cm.detail) parts.push(`<span class="dim">${esc(cm.detail)}</span>`);
    return parts.join(' ');
  }
  function slotName(b, slot) {
    const [side, area] = String(slot).split('_');
    const m = V(ctx(), entered(b, side)[area]);
    return `${SIDE_KO[side] || side}${(area || '').toUpperCase()}${m ? '(' + esc(m.name) + ')' : ''}`;
  }
  const OO = () => window.OM_ORDERS;
  function orderName(b, tid, kind, key) {
    const t = (b.trainers || {})[tid] || {};
    return kind === 'order' ? OO().orderName(t, key) : OO().commandName(t, key);
  }

  /* 행동 순서 띠 (맵툴 print_turn_order 꼴: 초상 줄 + 「교대 등장」「통상 교대」「우선도」「순서값」 줄) + 지금 행동 중인 칸 */
  function orderBox(c) {
    const b = c.b;
    if (!b.order || !b.order.length) return '';
    const cur = +b.orderIdx || 0;
    const cap = o => {
      if (o.xact) return '「추가 행동」';
      if (!o.started) return '「교대 등장」';
      if (o.change) return '「통상 교대」';
      if (o.order !== 20) return '「' + esc(orderValueName(o.order)) + '」';
      return '「우선도 : ' + (o.prio > 0 ? '+' : '') + o.prio + '」';
    };
    return `<div class="orderbox"><div class="ohead"><span class="olab">행동 순서</span><span class="small dim">${(b.orderNotes || []).length ? esc((b.orderNotes || []).join(' · ')) : '스피드 순 · 초상을 누르면 그 차례로'}</span><span class="sp"></span>${c.mgr ? `<button class="btn xs ghost" data-act="oprev">◀</button><span class="small">${Math.min(cur + 1, b.order.length)} / ${b.order.length}</span><button class="btn xs pri" data-act="onext">다음 행동 ▶</button><button class="btn xs ghost" data-act="oresort" title="아직 행동하지 않은 포켓몬만 지금 스피드 · 랭크 · 마비 · 트릭룸 · 순풍 등으로 다시 줄 세운다 (이미 행동한 차례와 지금 차례는 그대로)">순서 다시 계산</button>` : ''}</div>
   <div class="ostrip">${b.order
     .map((o, i) => {
       const m = V(c, (b.mons || {})[o.mid] || {});
       o = Object.assign({}, o, { name: m.illuFake ? m.name : o.name });
       const dead = m.hp && m.hp.cur <= 0;
       return `<div class="ocard ${o.side} ${i === cur ? 'now' : i < cur ? 'done' : ''} ${dead ? 'dead' : ''}" data-act="ojump" data-i="${i}" title="${esc(o.name)} · 스피드 ${Math.round(o.speed)} · d${o.dice}"><span class="onum">${i + 1}</span><div class="opt" style="${m.image ? `background-image:url('${cssu(m.image)}')` : ''}"></div><b class="onm">${esc(o.name)}</b><span class="ocap">${cap(o)}</span>${(() => {
         if (o.xact && o.move) return `<span class="omv">${esc(o.move)}</span>`;
         const px = (((b.cmds || {})[m.tid] || {}).mons || {})[o.mid];
         if (px) {
           if (px.move === 'switch') return '<span class="omv">교대</span>';
           const mv = px.move !== '' && px.move != null ? MVS(m)[+px.move] : null;
           return mv ? `<span class="omv">${typeChip(mv.typeEn)}${esc(mv.name)}</span>` : '<span class="omv dim">행동 없음</span>';
         }
         if (o.pursuitHit && o.move) return `<span class="omv">${esc(o.move)}</span>`;
         return `<span class="omv dim" title="차례가 오면 공개">${i <= cur ? '공개 대기' : '?'}</span>`;
       })()}<span class="osp">S ${Math.round(Math.abs(o.speed))} · d${o.dice}</span></div>`;
     })
     .join('')}</div></div>`;
  }
  function orderValueName(v) {
    return { 40: '가장 먼저', 30: '상대보다 먼저', 20: '일반', 10: '상대보다 나중에', 0: '가장 나중에' }[v] || '순서 ' + v;
  }

