  /* ── 조각 04_cmd_panel.js — 지시 입력 패널 · 배틀 저장 · 제한 시간 ── */
  /* ---------- 지시 입력 패널 ---------- */
  let CMD = {}; /* 편집 중인 내 지시 {tid:{mons:{},order:{},command:{},detail,turn}} */
  /* 지난 턴에 고른 지시(교대 → 이미 나온 포켓몬 등)가 다음 턴까지 남지 않게: 턴이 바뀌면 버린다 (GM 화면은 턴 종료 때 비우지만 PL 화면은 여기서) */
  const cmdNow = (tid, b) => {
    const c = CMD[tid];
    if (c && c.turn != null && c.turn !== (+b.turn || 0)) {
      delete CMD[tid];
      return null;
    }
    return c || null;
  };
  /* ---------- 지시 입력 패널 (맵툴 cmd_ui 와 같은 구성: 포켓몬 탭 → 기술 카드 → 대상 보드 → 지령 풀 → 요약) ---------- */
  const UIC = { tab: {}, fold: {} }; /* tid → 선택된 mid */
  function moveCard(mv, i, on, extra) {
    const col = S().typeColor(mv.typeEn);
    const X = mv.ext;
    return `<div class="mv ${on ? 'on' : ''}${mv.virt ? ' virt' : ''}${X ? ' ext' : ''}${extGone(mv) || mv.sealed ? ' gone' : ''}" ${mv.sealed ? 'title="「봉인」 — 이 기술은 내보낼 수 없다"' : mv.virt ? 'title="발버둥 — 「망각」 상태이거나 쓸 수 있는 기술이 없을 때"' : X ? `title="${esc(`기능 확장 — 트레이너${X.src ? ' 『' + X.src.replace(/[『』]/g, '') + '』' : ''}가 주는 기술 · ${X.kind === 'extra' ? '추가 행동으로 (행동과 따로)' : '이 포켓몬의 행동으로'} · ${X.lim ? `【${X.lim}/시】 남은 ${X.left}` : '횟수 제한 없음'}`)}"` : ''} style="background:${col.bg};color:${col.fg}" ${extra || ''}>${X ? `<div class="mvx">기능 확장${X.kind === 'extra' ? ' · 추가 행동' : ''}${X.lim ? ` · ${X.left}/${X.lim}` : ''}</div>` : ''}<div class="mn">${esc(mv.name)} <i class="mvdb" data-mvdb="${esc(mv.name)}" title="기술 DB">?</i></div><div class="mm">${esc(mv.cat)} · 위력 ${mv.pow || '-'} · 명중 ${mv.acc || '필중'}${mv.prio ? ' · 우선 ' + mv.prio : ''}</div><div class="mr">${esc(mv.range)}${A().contactOf(mv) === 'O' ? ' · <b class="mct">접촉</b>' : A().contactOf(mv) === 'X' ? ' · 비접촉' : ''}</div></div>`;
  }
  function tile(m, side, area, on, cls, extra) {
    m = V(ctx(), m);
    if (!m) return `<div class="ttile none ${cls || ''}"><span class="tn"><small>${SIDE_KO[side]} ${area.toUpperCase()} 빈 자리</small></span></div>`;
    const pct = Math.max(0, Math.min(100, m.hp.cur > 0 ? Math.max(1, Math.round((m.hp.cur / m.hp.max) * 100)) : 0));
    return `<div class="ttile ${cls || ''} ${on ? 'on' : ''}" ${extra || ''}><div class="ti" style="${m.image ? `background-image:url('${cssu(m.image)}')` : ''}"></div><div class="tn"><b>${esc(m.name)}</b><small>${SIDE_KO[side]} ${area.toUpperCase()} · ${tyHtml(ctx(), m)}</small><div class="hpb ${pct <= 25 ? 'low' : pct <= 50 ? 'mid' : ''}"><i style="width:${pct}%"></i></div></div><span class="tk">${on ? '✓' : ''}</span></div>`;
  }
  /* 대상판: 열 = 좌측/우측, 행 = 에리어 (무대와 같은 배치). 아군 열은 초록, 상대 열은 빨강 */
  function board(b, mySide, isOn, attr, allowSelf, me) {
    const ent = { left: entered(b, 'left'), right: entered(b, 'right') };
    const cls = s => (s === mySide ? 'al' : 'en');
    /* 개인전: 같은 진영이라도 다른 편이면 빨강 (me = 지시하는/공격하는 포켓몬) */
    const tc = (m, s) => (m && me ? (sameT(m, me, b) ? 'al' : 'en') : cls(s));
    const mixed = !!me && (((b.sides || {})[mySide] || {}).trainers || []).some(t => ((b.trainers || {})[t] || {}).solo);
    const head = SIDES.map(
      s => `<div class="bl ${cls(s)}">${SIDE_KO[s]}${s === mySide ? (mixed ? ' (내 쪽 · 개인전)' : ' (아군)') : ' (상대)'}</div>`
    ).join('');
    const rows = AREAS.slice(0, mode(b))
      .map(a =>
        SIDES.map(s => {
          const m = ent[s][a];
          const slot = slotOf(s, a);
          return tile(m, s, a, m && isOn(slot, m), tc(m, s), m ? attr(slot, m) : '');
        }).join('')
      )
      .join('');
    return `<div class="board grid">${head}${rows}</div>`;
  }
  /* 선행 입력에 묻은 추격(맵툴 command_pursuit): 선행 입력한 포텐셜·지령·명령·고유의 자동화에 「추격」이 있거나 글에 따라가때리기 부여가 적혀 있으면.
    「추격 무시」면 pimm (이번 턴 교대해도 상대의 추격을 받지 않는다). 손으로 켠 추격(pman)도 함께. 공개되지 않고 행동 순서 때 드러난다 */
  function prePursuit(t, m, x, upots) {
    const out = { pur: '', pimm: '', ut: '' };
    if (!x) return out;
    const scan = (ops, name) => {
      for (const op of ops || []) {
        if (op.k === 'pursuit' && op.on) {
          if (op.immune) {
            if (!out.pimm) out.pimm = name;
          } else if (!out.pur) out.pur = name;
        }
        if (op.k === 'choice') for (const o of op.opts || []) scan(o.ops, name);
      }
    };
    const byText = (txt, name) => {
      txt = String(txt || '');
      if (/「?유턴」?\s*효과를\s*부여/.test(txt) && !out.ut) out.ut = name;
      /* 10-24 제보: 선행에 묻은 「유턴」 */ if (!/따라가때리기|『?추격』?/.test(txt)) return;
      if (/무시|받지 않/.test(txt)) {
        if (!out.pimm) out.pimm = name;
      } else if (/부여|발동|얻는다|된다/.test(txt) && !out.pur) out.pur = name;
    };
    const look = (kind, name, eff) => {
      if (!name) return;
      const a = FX() ? FX().autoOf(m, kind, name) || (kind !== 'pot' ? FX().rm(name) : null) : null;
      if (a && a.ops && a.ops.length) scan(a.ops, name);
      byText(eff || (a && a.text), name);
    };
    for (const n of x.pots || []) {
      const p = potSrc(m).find(q => q.name === n);
      look('pot', n, p && p.eff);
    }
    for (const n of upots || []) {
      const u = (t.unique || []).find(q => q && q.name === n);
      look('pot', n, u && u.eff);
    }
    if (x.order) look('order', OO().orderName(t, x.order));
    if (x.command) look('order', OO().commandName(t, x.command));
    if (x.pman && !out.pur) out.pur = '손으로 선행';
    if (x.uman && !out.ut) out.ut = '손으로 선행';
    return out;
  }
  /* 「유턴」 기술: 태그 · 효과 글 (명중 후 임의 교대) */
  /* 11-24 망령 (인텔스 『중화 중력장』 「「텔레키네시스」 상태인 상대에게 아군의 기술이 「상성」에 의해 무효화되지 않는다」 · 「자동화 하면 되는거 아냐?」): 받는 쪽이 텔레키네시스 상태이고, 때리는 쪽과 같은 편의 다른 포켓몬이 그 글을 가지고 필드에 있으면 상성 0배를 내는 타입만 빼고 계산한다(「명중확장 전부」와 같은 길 — 떠 있어서 땅 기술이 안 맞는 것도 상성으로 보고 푼다) */
  const NEUT_RE = /「\s*텔레키네시스\s*」\s*상태인\s*상대에게\s*아군의\s*기술이\s*「\s*상성\s*」\s*에\s*의해\s*무효화되지\s*않는다/;
  const NEUT_TY = [
    'Normal',
    'Fire',
    'Water',
    'Electric',
    'Grass',
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
  ];
  function scrL(atk, def) {
    const L = spL(atk, 'scrappy') || [];
    try {
      if (atk && def && def !== atk && (def.states || {}).Telekinesis) {
        const b = ctx().b || {};
        const src = Object.values(b.mons || {}).find(
          x =>
            x && x.entry && x.hp && x.hp.cur > 0 && x.id !== atk.id && sameT(x, atk, b) && potSrc(x).some(p => p && NEUT_RE.test(String(p.eff || '')))
        );
        /* 11-24 18:56 망령 「아군의 기술에 본인은 해당 안되지」: 그 글을 가진 본인의 기술은 빼고 같은 편의 다른 포켓몬 것만 */ if (src)
          return L.concat([
            { types: [], vs: NEUT_TY.slice(), float: 1 }
          ]); /* 11-24 18:57 망령 「땅 안맞는 것도 상성이야」: 떠 있어서 「땅」 기술이 안 맞는 것도 푼다 */
      }
    } catch (e) {}
    return L;
  }
  function isUturn(mv, m) {
    if (!mv) return false;
    if (((m && m.flags) || {}).uturn) return true;
    /* 11-23 특성 정찰비행: 하늘 위에 떠 있을 때 자신의 「비행」 기술에 「유턴」 */ if (
      m &&
      mv.cat !== '변화' &&
      abNm(m).replace(/『|』|\s/g, '') === '정찰비행' &&
      (mv.typeEn === 'Flying' || mv.type === '비행')
    ) {
      let sky = false;
      try {
        sky = window.OM_FIELD && window.OM_FIELD.grounded ? !window.OM_FIELD.grounded(m) : tysOf(m).includes('Flying');
      } catch (e) {}
      if (sky) return true;
    }
    if ((mv.tags || []).some(t => /유턴/.test(t)) || /유턴/.test(String(mv.tag || ''))) return true;
    return /「유턴」\s*기술|명중\s*후\s*임의\s*교대/.test(String(mv.eff || ''));
  }
  function cmdPanel(c, ready) {
    const b = c.b;
    const tids = myTrainers(c);
    if (!tids.length) return '';
    const phase = +b.phase || 0;
    const blocks = tids
      .map(tid => {
        const t = (b.trainers || {})[tid] || {};
        const mons = Object.values(b.mons || {})
          .filter(m => m.tid === tid && m.entry && m.hp.cur > 0)
          .sort((x, y) => x.entry.localeCompare(y.entry));
        if (!mons.length) return '';
        if (!cmdNow(tid, b) && coOf(c, tid).length) coPull(tid);
        const cur = cmdNow(tid, b) || (CMD[tid] = { mons: {}, detail: '', upots: [], turn: +b.turn || 0, fresh: 1 });
        cur.upots = cur.upots || [];
        const UL = uniqList(t);
        const tmOpen = !!ready[tid] && timeOf(t, +b.turn || 0).sw >= 1 && phase === 0;
        const locked = !!ready[tid] && !tmOpen;
        if (!mons.find(m => m.id === UIC.tab[tid])) UIC.tab[tid] = mons[0].id;
        const m = mons.find(x => x.id === UIC.tab[tid]);
        mons.forEach(mm => {
          cur.mons[mm.id] = cur.mons[mm.id] || { move: '', switch: '', targets: [], prio: {}, ochg: {}, order: '', command: '', pots: [] };
          cur.mons[mm.id].pots = cur.mons[mm.id].pots || [];
        });
        const x = cur.mons[m.id];
        const bench = Object.values(b.mons || {}).filter(mm => mm.tid === tid && !mm.entry && mm.hp.cur > 0);
        /* 11-04: 던전 배틀은 일행 몫까지 합친 종류 · 횟수 (pKeys · pN) */ const OKEYS = pKeys(b, tid, 'order');
        const CKEYS = pKeys(b, tid, 'command');
        const oNames = OKEYS.map(k => pName(b, tid, 'order', k));
        const cNames = CKEYS.map(k => pName(b, tid, 'command', k));
        const cnt = {};
        for (const k of OKEYS) cnt['order_' + k] = pN(b, tid, 'order_' + k);
        for (const k of CKEYS) cnt['command_' + k] = pN(b, tid, 'command_' + k);
        const summ = mons
          .map(mm => {
            const xx = cur.mons[mm.id];
            const pre = [
              xx.order ? `『${esc(pName(b, tid, 'order', xx.order))}』` : '',
              xx.command ? `『${esc(pName(b, tid, 'command', xx.command))}』` : ''
            ]
              .filter(Boolean)
              .join(' ');
            const pd = (xx.pots || []).length ? ` <span class="dim">포텐셜 ${xx.pots.map(p => '『' + esc(p) + '』').join('')}</span>` : '';
            const pp = prePursuit(t, mm, xx, cur.upots);
            const tail =
              (pre ? ` <span class="dim">선행 ${pre}</span>` : '') +
              pd +
              (pp.pur || (xx.move !== 'switch' && isPursuit(MVS(mm)[+xx.move], mm)) ? ' <span style="color:var(--yel2)">· 추격</span>' : '') +
              (pp.pimm ? ' <span style="color:var(--ok)">· 추격 무시</span>' : '') +
              (xx.move !== 'switch' && (pp.ut || isUturn(MVS(mm)[+xx.move], mm)) ? ' <span style="color:var(--yel2)">· 유턴</span>' : '');
            if (xx.move === 'switch') return `${mm.name}: 교대 → ${monName(b, xx.switch) || '?'}${tail}`;
            if (xx.move === '' || xx.move == null) return `${mm.name}: <span class="warn">행동 없음</span>${tail}`;
            const mv = MVS(mm)[+xx.move];
            return `${mm.name}: <b>${mv ? esc(mv.name) : '?'}</b>${xx.targets.length ? ' → ' + xx.targets.map(sl => slotName(b, sl)).join(', ') : ' <span class="warn">대상 없음</span>'}${tail}`;
          })
          .join(' · ');
        const isSwitch = x.move === 'switch';
        const mvSel = !isSwitch && x.move !== '' ? MVS(m)[+x.move] : null;
        return `<div class="cmdt ${locked ? 'locked' : ''}" data-tid="${tid}">
    <div class="cmdhead"><b>${esc(t.name)}</b> 지시 ${locked ? '<span class="tag ok">READY</span><span class="small dim">준비 완료 — 바꾸려면 「준비 해제」</span>' : tmOpen ? '<span class="tag ok">READY</span><span class="small" style="color:var(--yel2)">「타임」을 썼으니 고칠 수 있다 — 「저장」하면 반영</span>' : ''}<span class="sp"></span>${phase >= 1 ? `<button class="btn xs" data-act="fire" data-tid="${tid}">포텐셜 발동</button>` : ''}${locked ? '' : `<button class="btn xs ghost" data-act="cmdload" data-tid="${tid}">저장된 지시 불러오기</button>`}</div>
    ${UL.length ? `<div class="upre ${locked ? 'ro' : ''}"><div class="sec">고유 포텐셜 <span class="tag uqt">트레이너</span> <span class="note">선행 입력 — 턴 중 「포텐셜 발동」에서 「선행 발동」 · 공개해도 상대는 모른다</span></div><div class="pool">${UL.map(s => `<div class="oc ${cur.upots.includes(s.p.name) ? 'mine' : ''} ${s.left !== null && s.left <= 0 && !(twoStage(s.p.eff) && preDoneOf(t, s.p.name)) ? 'dis' : ''}" data-upre="${esc(s.p.name)}" title="${esc(String(s.p.eff || '').replace(/<br\s*\/?>/g, ' '))}"><b>${esc(s.p.name)}</b><small>${s.max != null ? pipsL(s) : '횟수 없음'}</small></div>`).join('')}</div>${tselRows(b, t.side, null, cur.upots || [], cur.utg || {}, 'data-utg', tid)}${mselRows(b, t.side, null, cur.upots || [], cur.utm || {}, 'data-utm', tid)}</div>` : ''}
    <div class="tabs2">${mons
      .map(mm => {
        const xx = cur.mons[mm.id];
        const mv = xx.move !== '' && xx.move !== 'switch' ? MVS(mm)[+xx.move] : null;
        return `<div class="tab2 ${mm.id === m.id ? 'on' : ''}" data-ctab="${mm.id}"><div class="pic" style="${mm.image ? `background-image:url('${cssu(mm.image)}')` : ''}"></div><div><b>${esc(mm.name)}</b><small>${xx.move === 'switch' ? '교대 → ' + esc(monName(b, xx.switch) || '?') : mv ? esc(mv.name) : '미정'}</small></div></div>`;
      })
      .join('')}</div>
    <div class="pane ${locked ? 'ro' : ''}">
     <div class="sec">행동 <span class="seg"><span class="${!isSwitch ? 'on' : ''}" data-seg="move">기술</span><span class="${isSwitch ? 'on' : ''}" data-seg="switch">교대</span></span><span class="note">에리어 ${m.entry.toUpperCase()}</span></div>
     ${
       isSwitch
         ? (() => {
             const tw = trapWarn(m);
             return tw
               ? `<div class="small" style="margin:4px 0;color:${tw.free ? 'var(--ok)' : 'var(--yel2)'}">${tw.free ? `교대 제한(${esc(tw.hit.join('·'))})이 걸려 있지만 ${esc(tw.free)}로 교대할 수 있다` : `⚠ ${esc(tw.hit.join('·'))} 때문에 교대할 수 없다${tw.pot ? ` — 「${esc(tw.pot)}」를 쓰면 교대할 수 있다` : ''}`}</div>`
               : '';
           })()
         : ''
     }${
       isSwitch
         ? `<div class="pg">${bench.length ? bench.map(bm => `<div class="pc ${x.switch === bm.id ? 'on' : ''}" data-sw="${bm.id}"><div class="pic" style="${bm.image ? `background-image:url('${cssu(bm.image)}')` : ''}"></div><div><b>${esc(bm.name)}</b><div class="small dim">${bm.hp.cur}/${bm.hp.max}</div></div></div>`).join('') : '<div class="dim small">교대할 포켓몬이 없다</div>'}</div>`
         : `${misagA1(b, m) ? `<div class="small" style="color:var(--yel2);margin:2px 0 4px">⚠ ${esc(misagA1(b, m))} — 이번 턴은 기술 · 포텐셜을 쓸 수 없다 (행동 순서에서 저절로 건너뛴다 · 교대는 된다)</div>` : ''}${(() => {
             const o = misagA2Off(b, m);
             return o
               ? `<div class="small" style="color:var(--yel2);margin:2px 0 4px">⚠ 각성체 대가 A-2 — ${esc(o.aw.name)}이(가) 필드에 없어 아군의 역할이 전부 무효</div>`
               : '';
           })()}${(m.states || {}).Recharge ? '<div class="small" style="color:var(--yel2);margin:2px 0 4px">「반동 : 행동불능」 — 이번 턴은 움직일 수 없다 (행동 없음 · 4식 6령도 받을 수 없다)</div>' : ''}${(m.states || {}).Oblivion ? '<div class="small" style="color:var(--yel2);margin:2px 0 4px">「망각」 상태 — 「발버둥」만 내보낼 수 있다</div>' : ''}${(m.states || {}).Seal ? `<div class="small" style="color:var(--yel2);margin:2px 0 4px">「봉인」 상태 — ${m.sealMove ? `『${esc(m.sealMove.name)}』을(를) 내보낼 수 없다` : '봉인할 기술을 아직 고르지 않았다'} <button class="btn xs ghost" data-sealpick="${m.id}" title="건 쪽이 봉인할 기술 1개를 고른다">봉인할 기술 고르기</button></div>` : ''}${
             misagA1(b, m)
               ? ''
               : `<div class="mvg">${sealMark(m, MVS(m))
                   .map((mv, i) => moveCard(mv, i, String(x.move) === String(i), `data-mv="${i}"`))
                   .join('')}</div>`
           }${mvSel ? `<div class="mef">${esc(mvSel.eff || '')}${mvSel.tag && mvSel.tag !== '-' ? ` <span class="dim">[${esc(mvSel.tag)}]</span>` : ''}</div>` : ''}
      ${
        mvSel
          ? `<div class="sec">대상 <span class="note">범위 ${esc(mvSel.range)} — 누르면 바꿀 수 있다</span></div>${(m.states || {}).Thrash ? `<div class="small" style="color:var(--yel2);margin:2px 0 4px">「난동부리기」 — ${x.tman ? '손으로 고른 대상으로 때린다' : '공격할 때 적진에서 랜덤으로 고른다 · 대상을 누르면 손으로 정한다'}</div>` : ''}${board(
              b,
              m.side,
              slot => x.targets.includes(slot),
              slot => `data-tgt="${slot}"`,
              false,
              m
            )}`
          : ''
      }${(() => {
        const pp = prePursuit(t, m, x, cur.upots);
        const auto = isPursuit(mvSel, m);
        return `<div class="row small purrow" style="margin-top:6px;gap:8px;flex-wrap:wrap"><span class="oc ${x.pman || auto ? 'mine' : ''}" data-pman title="노린 대상이 교대하면 교대 전에 먼저 때린다 (맵툴 「추격」 칸)"><b>추격</b><small>${auto ? '기술에 있음' : x.pman ? '켬' : '끔'}</small></span>${pp.pur && pp.pur !== '손으로 선행' ? `<span class="tag" style="color:var(--yel2)">선행 『${esc(pp.pur)}』에 추격이 묻어 있다</span>` : ''}${pp.pimm ? `<span class="tag" style="color:var(--ok)">선행 『${esc(pp.pimm)}』 — 상대 추격 무시</span>` : ''}${(() => {
          const ua = isUturn(mvSel, m);
          return `<span class="oc ${x.uman || ua ? 'mine' : ''}" data-uman title="공격이 명중하면 임의 교대한다 — 상대가 이 포켓몬을 「따라가때리기」로 노리면 빠지기 전에 맞는다"><b>유턴</b><small>${ua ? '기술에 있음' : x.uman ? '켬' : '끔'}</small></span>${pp.ut && pp.ut !== '손으로 선행' ? `<span class="tag" style="color:var(--yel2)">선행 『${esc(pp.ut)}』에 유턴이 묻어 있다</span>` : ''}`;
        })()}<span class="dim">공개되지 않고, 걸리면 행동 순서 때 드러난다</span></div>`;
      })()}`
     }
     ${(() => {
       /* 11-03 감우 (검토 22): 휴대폰에서는 전용 · 명령 · 지령 · 일반 포텐셜 네 칸을 「선행 입력 ▸」 한 묶음 안에 */ const ph1 =
         window.matchMedia && matchMedia('(max-width:760px)').matches;
       if (!ph1) return '';
       const all = [...x.pots, x.order ? pName(b, tid, 'order', x.order) : '', x.command ? pName(b, tid, 'command', x.command) : ''].filter(Boolean);
       return `<details class="cfold pregrp" data-fold="${tid}:pre" ${UIC.fold[tid + ':pre'] ? 'open' : ''}><summary>선행 입력 <small class="dim">전용 · 명령 · 지령 · 포텐셜</small><span class="fsum">${fsum(all)}</span></summary><div class="pregrpin">`;
     })()}<details class="cfold" data-fold="${tid}:sp" ${UIC.fold[tid + ':sp'] ? 'open' : ''}><summary>전용 포텐셜 <span class="tag ext">${esc(m.name)}</span><span class="fsum">${fsum(x.pots.filter(n => specialPots(m).some(s => s.p.name === n)))}</span></summary><div class="note small">선행 입력 — 턴 중 「포텐셜 발동」에서 「선행 발동」</div><div class="pool">${potDecl(c, m, x, 'sp')}</div></details>
     <details class="cfold" data-fold="${tid}:ord" ${UIC.fold[tid + ':ord'] ? 'open' : ''}><summary>명령 <small class="dim">4식</small><span class="fsum">${fsum(x.order ? [pName(b, tid, 'order', x.order)] : [])}</span></summary>${noOrdWhy(m) ? `<div class="small noordw">⚠ 4식 6령 불가 — ${esc(noOrdWhy(m))}</div>` : ''}<div class="note small">에리어 ${m.entry.toUpperCase()} ${esc(m.name)} 에 선행 입력 — 턴 중 「포텐셜 발동」에서 발동</div><div class="pool">${OKEYS.map((k, i) => (oNames[i] ? `<div class="oc ${x.order === k ? 'mine' : ''} ${(cnt['order_' + k] ?? 0) <= 0 ? 'dis' : ''}" data-ord="${k}"><b>${esc(oNames[i])}</b>${OO().ownerOf(t, k) ? `<i class="oown">${esc(OO().ownerOf(t, k))}</i>` : ''}${pLend(b, tid, 'order_' + k) ? '<i class="oown">일행 몫</i>' : ''}<small>남은 ${cnt['order_' + k] ?? 0}</small></div>` : '')).join('') || '<span class="dim small">쓸 수 있는 명령이 없다</span>'}</div></details>
     <details class="cfold" data-fold="${tid}:cmd" ${UIC.fold[tid + ':cmd'] ? 'open' : ''}><summary>지령 <small class="dim">6령</small><span class="fsum">${fsum(x.command ? [pName(b, tid, 'command', x.command)] : [])}</span></summary>${noOrdWhy(m) ? `<div class="small noordw">⚠ 4식 6령 불가 — ${esc(noOrdWhy(m))}</div>` : ''}<div class="pool">${CKEYS.map((k, i) => (cNames[i] ? `<div class="oc ${x.command === k ? 'mine' : ''} ${(cnt['command_' + k] ?? 0) <= 0 ? 'dis' : ''}" data-cmd="${k}"><b>${esc(cNames[i])}</b>${OO().ownerOf(t, k) ? `<i class="oown">${esc(OO().ownerOf(t, k))}</i>` : ''}${pLend(b, tid, 'command_' + k) ? '<i class="oown">일행 몫</i>' : ''}<small>남은 ${cnt['command_' + k] ?? 0}</small></div>` : '')).join('') || '<span class="dim small">쓸 수 있는 지령이 없다</span>'}</div></details>
     <details class="cfold" data-fold="${tid}:norm" ${UIC.fold[tid + ':norm'] ? 'open' : ''}><summary>일반 포텐셜 선행 입력<span class="fsum">${fsum(x.pots.filter(n => !specialPots(m).some(s => s.p.name === n)))}</span></summary><div class="pool">${potDecl(c, m, x, 'norm')}</div></details>${window.matchMedia && matchMedia('(max-width:760px)').matches ? '</div></details>' : ''}
     ${tselRows(b, m.side, m, x.pots || [], x.ptg || {}, 'data-ptg')}${mselRows(b, m.side, m, x.pots || [], x.ptm || {}, 'data-ptm', tid)}
     ${(() => {
       /* 10-22 망령: 우선도는 바로 누르는 칩으로 (이 포켓몬 칸). 다른 포켓몬 칸 · 행동 순서는 아래 접힌 칸 */ const my = allEntered(b).find(
         s => s.mon.id === m.id
       );
       if (!my || isSwitch) return '';
       const v = x.prio[my.slot];
       const vv = v === '' || v == null ? 0 : +v;
       const base = mvSel ? (FX() && FX().prioOf ? FX().prioOf(m, mvSel) : +mvSel.prio || 0) : 0;
       const sg = n => (n > 0 ? '+' + n : String(n));
       return `<div class="prow"><span class="pl">우선도 보정</span><span class="pqs">${[-3, -2, -1, 0, 1, 2, 3, 4, 5].map(n => `<span class="pq ${vv === n ? 'on' : ''} ${n < 0 ? 'neg' : n > 0 ? 'pos' : ''}" data-pq="${n}" data-slot="${my.slot}">${sg(n)}</span>`).join('')}</span><span class="small dim">${mvSel ? `기술 ${sg(base)}${vv ? ` → <b style="color:var(--yel2)">${sg(base + vv)}</b>` : ''}` : ''}</span></div>`;
     })()}
     <details class="adv"><summary>다른 포켓몬 우선도 · 행동 순서 변경 (${esc(m.name)}의 지시로)</summary><div class="tgts">${allEntered(b)
       .map(
         s =>
           `<label class="tg2">${s.area.toUpperCase()} ${esc(s.mon.name)} 우선 <input type="number" class="n" data-f="prio" data-mid="${m.id}" data-slot="${s.slot}" value="${x.prio[s.slot] ?? ''}" placeholder="0"> 순서 <input type="number" class="n" data-f="ochg" data-mid="${m.id}" data-slot="${s.slot}" value="${x.ochg[s.slot] ?? ''}" placeholder="20"></label>`
       )
       .join('')}</div></details>
     <div class="row" style="margin-top:6px"><input type="text" data-f="detail" value="${esc(cur.detail)}" placeholder="상세 (포텐셜 선언, 자유 메모)" style="flex:1"></div>
    </div>
    <div class="cfoot"><div class="sum">${cur.upots.length ? `<div><span class="tag uqt">고유</span> 선행 ${cur.upots.map(n => '『' + esc(n) + '』').join('')}</div>` : ''}${summ}</div>${locked ? '' : `<button class="btn" data-act="cmdsave" data-tid="${tid}">저장</button>`}<button class="btn ${locked ? '' : 'pri'}" data-act="ready" data-tid="${tid}">${locked ? '준비 해제' : '준비 완료'}</button></div></div>`;
      })
      .join('');
    if (!blocks.trim()) return '';
    loadPeek().then(pk => {
      const el = document.getElementById('peekbox');
      if (!el || !pk) return;
      if (pk.turn !== (ctx().b.turn || 0)) return;
      el.innerHTML = `<div class="chip" style="border-color:var(--yel);padding:4px 10px">타임 결과 · ${esc(pk.name)}: <b>${esc(pk.text)}</b></div>`;
    });
    return `<form id="cmdForm" class="cmdpanel" onsubmit="return false"><div id="peekbox"></div><div class="cmdtitle">지시 입력 <span class="dim small">${phase === 0 ? '지시 준비 페이즈' : '지금은 ' + ['', '턴 개시', '행동 순서', '행동 처리', '', '턴 종료'][phase] + ' — 입력은 저장만 된다'}</span></div>${blocks}</form>`;
  }
  function fsum(L) {
    L = (L || []).filter(Boolean);
    return L.length ? L.map(n => esc(n)).join(' · ') : '—';
  }
  /* 지시를 고칠 때마다 벤치 아래 지시 현황도 */
  function refreshSide(c) {
    document.querySelectorAll('[data-bside]').forEach(el => {
      const tmp = document.createElement('div');
      tmp.innerHTML = sidePanel(c, el.dataset.bside, c.ST.state.ready || {});
      if (tmp.firstElementChild) el.replaceWith(tmp.firstElementChild);
    });
    document.querySelectorAll('[data-bside]').forEach(
      el =>
        (el.ontoggle = () => {
          UIC.bside = UIC.bside || {};
          UIC.bside[el.dataset.bside] = el.open;
        })
    );
  }
  function rerenderCmd() {
    const old = $('#cmdForm');
    if (!old) return;
    const c = ctx();
    const tmp = document.createElement('div');
    const h = cmdPanel(c, c.ST.state.ready || {});
    tmp.innerHTML = h;
    const nf = tmp.firstElementChild;
    if (!nf) {
      old.remove();
      return;
    }
    nf._h = h;
    old.replaceWith(nf);
    refreshSide(c);
    nf.querySelectorAll('[data-act]').forEach(bt => (bt.onclick = () => action(bt.dataset)));
    bindCmdForm(nf, c);
  }
  function bindCmdForm(form, c) {
    const bnd = !form._bnd;
    form._bnd = 1; /* 11-03: 같은 요소를 다시 묶을 때(render 가 옛 폼을 되붙임) addEventListener 는 한 번만 */
    form.querySelectorAll('.cmdt').forEach(blk => {
      const tid = blk.dataset.tid;
      const cur = CMD[tid];
      if (!cur) return;
      const mid = UIC.tab[tid];
      const x = cur.mons[mid] || (cur.mons[mid] = { move: '', switch: '', targets: [], prio: {}, ochg: {}, order: '', command: '', pots: [] });
      if (bnd)
        blk.querySelectorAll('[data-fold]').forEach(d =>
          d.addEventListener('toggle', () => {
            UIC.fold[d.dataset.fold] = d.open;
          })
        );
      if (blk.classList.contains('locked')) {
        blk.querySelectorAll('[data-ctab]').forEach(
          el =>
            (el.onclick = () => {
              UIC.tab[tid] = el.dataset.ctab;
              rerenderCmd();
            })
        );
        return;
      }
      blk.querySelectorAll('[data-ctab]').forEach(
        el =>
          (el.onclick = () => {
            UIC.tab[tid] = el.dataset.ctab;
            rerenderCmd();
          })
      );
      blk.querySelectorAll('[data-upre]').forEach(
        el =>
          (el.onclick = () => {
            if (el.classList.contains('dis')) return;
            const n = el.dataset.upre;
            cur.upots = cur.upots || [];
            const i = cur.upots.indexOf(n);
            if (i >= 0) cur.upots.splice(i, 1);
            else cur.upots.push(n);
            rerenderCmd();
          })
      );
      blk.querySelectorAll('[data-seg]').forEach(
        el =>
          (el.onclick = () => {
            if (el.dataset.seg === 'switch') {
              x.move = 'switch';
              x.targets = [];
            } else {
              x.move = '';
              x.targets = [];
            }
            rerenderCmd();
          })
      );
      blk.querySelectorAll('[data-sealpick]').forEach(
        el =>
          (el.onclick = e => {
            e.stopPropagation();
            sealPick('', el.dataset.sealpick);
          })
      );
      blk.querySelectorAll('[data-mv]').forEach(
        el =>
          (el.onclick = () => {
            const mm0 = (c.b.mons || {})[mid] || {};
            if (sealed(mm0, MVS(mm0)[+el.dataset.mv])) return A().toast('「봉인」 — 이 기술은 내보낼 수 없다');
            if (taunted(mm0, MVS(mm0)[+el.dataset.mv])) return A().toast('「도발」 — 변화기는 내보낼 수 없다');
            {
              const w = mvBan(mm0, MVS(mm0)[+el.dataset.mv]);
              if (w) return A().toast(w);
            }
            {
              const w = mvSoft(mm0, MVS(mm0)[+el.dataset.mv]);
              if (w) A().toast(w);
            }
            if (extGone(MVS(mm0)[+el.dataset.mv])) return A().toast('이 기능 확장은 이번 시합에서 다 썼다');
            x.move = el.dataset.mv;
            x.targets = defaultTargets(c.b, mid, el.dataset.mv);
            x.tman = 0;
            rerenderCmd();
          })
      );
      blk.querySelectorAll('[data-sw]').forEach(
        el =>
          (el.onclick = () => {
            x.switch = el.dataset.sw;
            rerenderCmd();
          })
      );
      blk.querySelectorAll('[data-tgt]').forEach(
        el =>
          (el.onclick = () => {
            const s = el.dataset.tgt;
            x.tman = 1;
            const i = x.targets.indexOf(s);
            if (i >= 0) x.targets.splice(i, 1);
            else {
              /* 단일 대상 기술은 새로 누른 대상으로 바꾼다 — 지난 턴 대상이 남아 둘을 노리던 일 (10-26 FFA 시험) */ const mv =
                MVS((c.b.mons || {})[mid] || {})[+x.move] || {};
              if (!MULTI_RANGE.test(String(mv.range || ''))) x.targets.length = 0;
              x.targets.push(s);
            }
            rerenderCmd();
          })
      );
      blk.querySelectorAll('[data-pq]').forEach(
        el =>
          (el.onclick = () => {
            const n = +el.dataset.pq;
            x.prio = x.prio || {};
            x.prio[el.dataset.slot] = n ? String(n) : '';
            rerenderCmd();
          })
      );
      blk.querySelectorAll('[data-pman]').forEach(
        el =>
          (el.onclick = () => {
            x.pman = x.pman ? 0 : 1;
            rerenderCmd();
          })
      );
      blk.querySelectorAll('[data-uman]').forEach(
        el =>
          (el.onclick = () => {
            x.uman = x.uman ? 0 : 1;
            rerenderCmd();
          })
      );
      const noOrdGate = () => {
        const mm = c.b.mons[mid];
        const why = noOrdWhy(mm);
        const wk = mid + ':' + (+c.b.turn || 0);
        if (!why || NOORD_W[wk]) return false;
        NOORD_W[wk] = 1;
        A().toast(`⚠ ${mm.name} — 4식 6령을 받을 수 없다 (${why}). 그래도 넣으려면 한 번 더 누른다`);
        return true;
      };
      /* 11-15 14:16 망령 「교대하는 대상에게 4식 6령은 기본적으로 입력이나 발동할 수 없다 (숙달 지령은 임의 타이밍이 있다)」: 교대를 지시한 포켓몬에 넣으려 하면 경고 — 한 번 더 누르면 넣는다(바로잡기용) */
      const swGate = () => {
        const xx = cur.mons[mid] || {};
        if (xx.move !== 'switch') return false;
        const wk = 'sw:' + mid + ':' + (+c.b.turn || 0);
        if (NOORD_W[wk]) return false;
        NOORD_W[wk] = 1;
        A().toast(
          `⚠ 교대하는 포켓몬에게는 4식 · 6령을 넣을 수 없다 (숙달 지령 ② 의 【임의】는 그때 필드의 포켓몬에게). 그래도 넣으려면 한 번 더 누른다`
        );
        return true;
      };
      const oneOf = (k, nm) => {
        const o = Object.entries(cur.mons).find(([id, v]) => id !== mid && v && v[k] && (c.b.mons[id] || {}).entry);
        if (!o) return false;
        A().toast(`${nm}은 한 턴에 하나만 — ${(c.b.mons[o[0]] || {}).name || '다른 포켓몬'}에 넣은 것을 먼저 뺀다`);
        return true;
      }; /* 10-26 망령: 4식 · 6령은 트레이너당 한 턴에 종류별 하나 */
      blk.querySelectorAll('[data-ord]').forEach(
        el =>
          (el.onclick = () => {
            if (el.classList.contains('dis')) return;
            if (x.order !== el.dataset.ord && oneOf('order', '4식(명령)')) return;
            if (x.order !== el.dataset.ord && (noOrdGate() || swGate())) return;
            x.order = x.order === el.dataset.ord ? '' : el.dataset.ord;
            rerenderCmd();
          })
      );
      blk.querySelectorAll('[data-cmd]').forEach(
        el =>
          (el.onclick = () => {
            if (el.classList.contains('dis')) return;
            if (x.command !== el.dataset.cmd && oneOf('command', '6령(지령)')) return;
            if (x.command !== el.dataset.cmd && (noOrdGate() || swGate())) return;
            x.command = x.command === el.dataset.cmd ? '' : el.dataset.cmd;
            rerenderCmd();
          })
      );
      blk.querySelectorAll('[data-ptg]').forEach(
        el =>
          (el.onclick = () => {
            const n = el.dataset.tpn,
              s = el.dataset.ptg;
            x.ptg = x.ptg || {};
            if (x.ptg[n] === s) delete x.ptg[n];
            else x.ptg[n] = s;
            rerenderCmd();
          })
      );
      blk.querySelectorAll('[data-utg]').forEach(
        el =>
          (el.onclick = () => {
            const n = el.dataset.tpn,
              s = el.dataset.utg;
            cur.utg = cur.utg || {};
            if (cur.utg[n] === s) delete cur.utg[n];
            else cur.utg[n] = s;
            rerenderCmd();
          })
      );
      /* 11-09 감우 57: 기술 지정 (고유 utm · 포텐셜 ptm) — 칩은 누르면 고르고 다시 누르면 뺀다, 「기술 DB 검색」은 DB 창에서 */
      const mselSet = (o, k, n, v) => {
        o[k] = o[k] || {};
        if (!v || o[k][n] === v) delete o[k][n];
        else o[k][n] = v;
        rerenderCmd();
      };
      const mselDb = (o, k, n) => {
        const DU = window.OM_DB_UI;
        if (!DU || !DU.open) return A().toast('기술 DB 창을 아직 못 불러왔다');
        DU.open({
          kind: 'move',
          sel: (o[k] || {})[n] || '',
          pick: v => {
            if (v) {
              o[k] = o[k] || {};
              o[k][n] = v;
              rerenderCmd();
            }
          }
        });
      };
      blk.querySelectorAll('[data-utm]').forEach(el => (el.onclick = () => mselSet(cur, 'utm', el.dataset.tpn, el.dataset.utm)));
      blk.querySelectorAll('[data-utms]').forEach(el => (el.onclick = () => mselDb(cur, 'utm', el.dataset.tpn)));
      blk.querySelectorAll('[data-ptm]').forEach(el => (el.onclick = () => mselSet(x, 'ptm', el.dataset.tpn, el.dataset.ptm)));
      blk.querySelectorAll('[data-ptms]').forEach(el => (el.onclick = () => mselDb(x, 'ptm', el.dataset.tpn)));
      blk.querySelectorAll('[data-pdecl]').forEach(
        el =>
          (el.onclick = () => {
            if (el.classList.contains('dis')) return;
            const n = el.dataset.pdecl;
            x.pots = x.pots || [];
            const i = x.pots.indexOf(n);
            if (i >= 0) x.pots.splice(i, 1);
            else x.pots.push(n);
            rerenderCmd();
          })
      );
      if (bnd)
        blk.querySelectorAll('[data-f]').forEach(el => {
          const h = () => {
            const f = el.dataset.f;
            const cu = CMD[tid];
            if (!cu) return;
            /* 폼을 되붙여 써도 지금의 CMD 를 본다 */ const xm = cu.mons[el.dataset.mid] || cu.mons[UIC.tab[tid]];
            if (!xm) return;
            if (f === 'prio') xm.prio[el.dataset.slot] = el.value;
            if (f === 'ochg') xm.ochg[el.dataset.slot] = el.value;
            if (f === 'detail') cu.detail = el.value;
          };
          el.addEventListener('input', h);
          el.addEventListener('change', h);
        });
    });
  }
  const MULTI_RANGE = /전체|적진|자진|자신 이외|[2-9]체/;
  /* 11-03 특수 효과(sp) 와 기술이 맞나: 타입(e.types · 기술 타입 영문) · 태그(e.tg) · 분류(물리 · 특수 · 변화 · 접촉) */
  function spHit(e, mv, tys) {
    if (!e || !mv) return false;
    if (e.types && e.types.length && !(tys || []).some(t => e.types.includes(t))) return false;
    if (e.tg && e.tg.length) {
      const CT = (() => {
        try {
          return A().contactOf ? A().contactOf(mv) : '';
        } catch (_) {
          return '';
        }
      })();
      const T = String(mv.tag || '') + ',' + (mv.tags || []).join(',') + ',' + String(mv.name || '');
      if (!e.tg.some(x => (x === '비접촉' || x === '비접촉기' ? CT === 'X' : x === '접촉' || x === '접촉기' ? CT === 'O' : T.includes(x))))
        return false;
    } /* 11-23 태그:접촉 · 태그:비접촉 */
    if (e.cat) {
      if (e.cat === '접촉') {
        if (String(mv.contact || '') !== 'O') return false;
      } else if (e.cat !== mv.cat) return false;
    }
    return true;
  }
  const spL = (m, k) => (FX() && FX().spOf ? FX().spOf(m, k) : []);
  /* 11-23 망령 「기술의 반사」 사양 (225번 노트): 맞는 쪽 d 의 「반사」 줄 가운데 이 기술에 걸리는 것. 분류 없음 + 타입 · 태그 없음 = 예전대로 변화기만 · 분류 없음 + 타입/태그 = 그 기술 전부 · 공격 = 대미지 기술 전부 · 물리/특수 = 그 분류만 */
  const bncOf = (d, mv, tys) => {
    if (!d || !mv) return null;
    return (
      spL(d, 'bounce').find(e => {
        const c = e.cat || '';
        const fl = !!((e.types && e.types.length) || (e.tg && e.tg.length));
        if (mv.cat === '변화') {
          if (!(c === '변화' || (c === '' && true))) return false;
        } else if (!(c === '공격' || c === mv.cat || (c === '' && fl))) return false;
        return spHit(Object.assign({}, e, { cat: '' }), mv, tys);
      }) || null
    );
  };
  const mvTysRaw = mv =>
    String((mv && mv.type) || '')
      .split(/[()/,]/)
      .map(t => t.trim())
      .filter(Boolean)
      .map(S().typeEn);
  /* 끌어오기: 상대 쪽(공격하는 포켓몬과 다른 편)에 맞는 「끌어오기」가 있으면 그 포켓몬 자리. 단일 대상 기술만 */
  /* 11-09 망령 「「풀」 기술 같이 해당되는 범위의 기술이 여러 개면 발동할 때 선택」: 「기술사용 X」 · 추가 행동의 X 가 기술 이름이 아니라 범위(타입 · 태그 · 단일기 · 물리기 …)이면 그 포켓몬의 기술 중 맞는 것 */
  function mvRange(atk, nm) {
    const L = MVS(atk);
    const k = String(nm || '')
      .replace(/\s/g, '')
      .replace(/^「|」$/g, '');
    if (!k) return null;
    if (L.some(q => q && String(q.name).replace(/\s/g, '') === k)) return null;
    {
      const MD = DB().moves || {};
      if (MD[k] || MD[nm]) return null;
    } /* 기술 DB 에 있는 이름이면 예전처럼 그 기술 */
    const base = k.replace(/기술$/, '');
    const en = S() && S().typeEn ? S().typeEn(base) : '';
    const tagsOf = q =>
      [...String(q.tag || '').split(/[,/·\s]+/), ...(q.tags || []).map(t => String(t || '').replace(/^#/, ''))].map(x => x.trim()).filter(Boolean);
    const ok = q => {
      if (!q || q.virt || q.name === '발버둥' || q.sealed) return false;
      if (base === '단일기' || base === '단일') return String(q.range || '') === '1체' && q.cat !== '변화';
      if (base === '전체기') return /전체|자신\s*이외/.test(String(q.range || '')) && q.cat !== '변화';
      if (base === '물리기' || base === '물리') return q.cat === '물리';
      if (base === '특수기' || base === '특수') return q.cat === '특수';
      if (base === '변화기' || base === '변화') return q.cat === '변화';
      if (base === '공격기') return q.cat !== '변화';
      if (base === '접촉기') return !!(A().contactOf && A().contactOf(q) === 'O');
      if (en && en !== base) return mvTysRaw(q).includes(en) || q.typeEn === en;
      return tagsOf(q).includes(base) || String(q.name || '').endsWith(base);
    };
    const idx = [];
    L.forEach((q, i) => {
      if (ok(q)) idx.push(i);
    });
    return idx;
  }
  function mvRangePick(atk, label, names) {
    return new Promise(res => {
      const md = A().openModal(
        `<div class="mhead"><h2>${esc(label)} — 기술 고르기</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="firelist">${names.map((l, i) => `<label class="firerow"><input type="radio" name="ch" value="${i}" ${i === 0 ? 'checked' : ''}> <span>${esc(l)}</span></label>`).join('')}</div><div class="row" style="margin-top:10px"><span class="sp"></span><button class="btn pri" id="chok">이 기술로</button></div>`
      );
      $('#chok', md).onclick = () => {
        const v = md.querySelector('[name=ch]:checked');
        A().closeModal();
        res(v ? +v.value : -1);
      };
      md.querySelector('[data-x]').addEventListener('click', () => res(-1));
    });
  }
  function redirectOf(b, atk, mv) {
    if (!mv || String(mv.range || '') !== '1체') return null;
    if (/^(굳건한신념|스크루지느러미)$/.test(abNm(atk).replace(/『|』|\s/g, ''))) return null;
    /* 11-09 굳건한신념: 기술의 대상을 바꾸는 효과를 무시 */ if (spL(atk, 'noredirect').some(x => spHit(x, mv, mvTysRaw(mv)))) return null;
    /* 11-09 감우 55: 구문 「끌어오기무시」 */ {
      const au = moveAuto(mv);
      if (au && au.noRedirect) return null;
    }
    const slots = allEntered(b);
    /* 11-09 감우 55: 「날따름」 상태 — 끌어오는 특성보다 먼저 (단일 대상 기술만) */ for (const s of slots) {
      const m = s.mon;
      if (!m || m.id === atk.id || sameT(m, atk, b) || m.hp.cur <= 0 || !(m.states || {}).FollowMe) continue;
      return { slot: s.slot, mon: m, e: { name: '날따름' } };
    }
    for (const s of slots) {
      const m = s.mon;
      if (!m || m.id === atk.id || sameT(m, atk, b) || m.hp.cur <= 0) continue;
      const e = spL(m, 'redirect').find(x => spHit(x, mv, mvTysRaw(mv)));
      if (e) return { slot: s.slot, mon: m, e };
    }
    return null;
  }
  function defaultTargets(b, mid, moveIdx) {
    const m = b.mons[mid];
    if (!m || moveIdx === '' || moveIdx === 'switch') return [];
    const mv = MVS(m)[+moveIdx];
    if (!mv) return [];
    {
      const rd = redirectOf(b, m, mv);
      if (rd) return [rd.slot];
    }
    const slots = allEntered(b);
    const my = slots.find(s => s.mon.id === mid);
    const r = terrRange(b, m, mv) || String(mv.range || ''); /* 11-04: 와이드포스 — 사이코필드 위면 상대 전체 */
    const enemies = slots.filter(s => !sameT(s.mon, m, b)),
      allies = slots.filter(s => sameT(s.mon, m, b) && s.mon.id !== mid);
    if (r === '자신') return my ? [my.slot] : [];
    if (r === '상대 전체' || r === '적진') return enemies.map(s => s.slot);
    if (r === '아군 전체' || r === '자진') return slots.filter(s => sameT(s.mon, m, b)).map(s => s.slot);
    if (r === '자신 이외') return slots.filter(s => s.mon.id !== mid).map(s => s.slot);
    if (r === '전체' || r === '필드 전체') return slots.map(s => s.slot);
    if (r === '아군') return allies.map(s => s.slot).slice(0, 1);
    /* 11-04 21:02 망령 「대상이 정면기 · 대각기 같은 건 전체기처럼 지시 때 기본 타게팅」: 정면 = 맞은편 같은 에리어(좌 A ↔ 우 A) · 대각 = 맞은편 옆 에리어(좌 A ↔ 우 B). 비었으면 남은 상대 하나 */
    if (r === '정면' && my) {
      const f = enemies.find(s => s.side !== my.side && s.area === my.area);
      return f ? [f.slot] : enemies.slice(0, 1).map(s => s.slot);
    }
    if (r === '대각' && my) {
      const O = 'abcdef';
      const i = O.indexOf(String(my.area));
      const d = enemies.filter(s => s.side !== my.side && Math.abs(O.indexOf(String(s.area)) - i) === 1);
      return d.length
        ? [d[0].slot]
        : enemies
            .filter(s => s.area !== my.area)
            .concat(enemies)
            .slice(0, 1)
            .map(s => s.slot);
    }
    if (r === '상대 2체') return enemies.map(s => s.slot).slice(0, 2);
    if (mv.name === '발버둥' && enemies.length) return [enemies[Math.floor(Math.random() * enemies.length)].slot]; /* 무작위한 상대에게 */
    return enemies.map(s => s.slot).slice(0, 1);
  }

  /* ---------- 11-03 감우: 턴 체크포인트 · 배틀 저장 · 이어서 하기 ----------
    턴 개시 처리가 끝난 모습(state.battle 전체)을 방 상태 밖 om_snap 표에 남긴다 (supabase/patch_2026-11-03_배틀.sql · kind 'turn' 은 방마다 최근 3턴).
    함수가 없는 DB 면 이 브라우저(localStorage om_bsnap_<방>)에만 — 다른 화면에서는 안 보인다. 복원은 battle 전체를 한 번에 쓴다 */
  const SNAPC = { server: null };
  const snapKey = () => 'om_bsnap_' + A().ST.room;
  function snapLocal() {
    try {
      const x = JSON.parse(localStorage.getItem(snapKey()) || 'null');
      if (x && Array.isArray(x.turns) && Array.isArray(x.saves)) return x;
    } catch (e) {}
    return { turns: [], saves: [] };
  }
  function snapLocalSave(x) {
    for (let i = 0; i < 8; i++) {
      try {
        localStorage.setItem(snapKey(), JSON.stringify(x));
        return true;
      } catch (e) {
        if (x.saves.length) x.saves.shift();
        else if (x.turns.length) x.turns.shift();
        else return false;
      }
    }
    return false;
  }
  const snapNoFn = e => {
    const S = DBS().snap;
    return !!(S && S.noFn && (S.noFn((e && e.raw) || e) || S.noFn(e)));
  };
  async function snapPut(kind, name, data) {
    const ST = A().ST;
    const id = (kind === 'turn' ? 't' : 's') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const turn = +data.turn || 0;
    if (SNAPC.server !== false && DBS().snap) {
      try {
        await DBS().snap.put(ST.room, ST.secret, id, kind, name, turn, data);
        SNAPC.server = true;
        return { id, server: true };
      } catch (e) {
        if (!snapNoFn(e)) throw e;
        SNAPC.server = false;
      }
    }
    const x = snapLocal();
    const row = { id, kind, name, turn, at: Date.now(), w: ST.role === 'gm' ? 'gm' : ST.seat, data };
    if (kind === 'turn') {
      x.turns.push(row);
      while (x.turns.length > 3) x.turns.shift();
    } else x.saves.push(row);
    if (!snapLocalSave(x)) A().toast('이 브라우저에 저장할 자리가 없다');
    return { id, server: false };
  }
  async function snapList(kind) {
    const ST = A().ST;
    if (SNAPC.server !== false && DBS().snap) {
      try {
        const L = await DBS().snap.list(ST.room, ST.secret, kind);
        SNAPC.server = true;
        return (L || []).map(r => Object.assign({}, r, { at: +new Date(r.at) || 0 }));
      } catch (e) {
        if (!snapNoFn(e)) throw e;
        SNAPC.server = false;
      }
    }
    const x = snapLocal();
    return [...(kind === 'turn' ? x.turns : kind === 'save' ? x.saves : [...x.turns, ...x.saves])]
      .map(r => Object.assign({}, r, { data: undefined }))
      .sort((a, b) => b.at - a.at);
  }
  async function snapGet(id) {
    const ST = A().ST;
    if (SNAPC.server) {
      const r = await DBS().snap.get(ST.room, ST.secret, id);
      return r && r.data ? r.data : null;
    }
    const x = snapLocal();
    const r = [...x.turns, ...x.saves].find(r => r.id === id);
    return r ? r.data : null;
  }
  async function snapDel(id) {
    const ST = A().ST;
    if (SNAPC.server) return DBS().snap.del(ST.room, ST.secret, id);
    const x = snapLocal();
    x.turns = x.turns.filter(r => r.id !== id);
    x.saves = x.saves.filter(r => r.id !== id);
    snapLocalSave(x);
    return true;
  }
  async function snapTurn() {
    const b = snap(ctx().b);
    if (!b.started) return;
    const r = await snapPut('turn', 'TURN ' + (+b.turn || 0), b);
    SNAPC.last = { id: r.id, turn: +b.turn || 0, server: r.server };
  }
  /* 되돌리기는 GM, 또는 GM 이 접속해 있지 않은 모의전(진행 권한이 있는 좌석) */
  function canRewind(c) {
    if (c.gm) return true;
    if (!c.mgr) return false;
    const P = A().presList ? A().presList() : [];
    return !P.some(p => p.role === 'gm');
  }
  async function restoreBattle(data, why) {
    if (!data || typeof data !== 'object') return false;
    CMD = {};
    for (const k in FAINT_SEEN) delete FAINT_SEEN[k];
    const ok = await A().setMany([
      [['battle'], data],
      [['ready'], {}]
    ]);
    if (!ok) return false;
    A().sysLog(why, 'battle');
    return true;
  }
  async function rewindTurn() {
    const c = ctx();
    if (!canRewind(c)) return A().toast('되돌리기는 GM 또는 GM 없는 모의전에서만');
    let L = [];
    try {
      L = await snapList('turn');
    } catch (e) {
      return A().toast('체크포인트를 읽지 못했다: ' + e.message);
    }
    const T = +c.b.turn || 0;
    const r = L.find(x => +x.turn === T) || L[0];
    if (!r) return A().toast('체크포인트가 없다 — 턴 개시 뒤에 생긴다');
    const when = r.at ? new Date(r.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '';
    if (
      !(await askYes(
        `TURN ${r.turn} 턴 개시 직후${when ? ' (' + when + ')' : ''}로 되돌릴까?${+r.turn !== T ? `\n(지금은 TURN ${T} — 이 턴의 체크포인트가 없어 가장 가까운 것)` : ''}\n그 뒤의 공격 · HP · 상태 · 공개된 지시가 전부 지워진다 (로그는 남는다 · 선행 입력한 비밀 지시는 남는다)`,
        '되돌린다',
        '그대로'
      ))
    )
      return;
    let data = null;
    try {
      data = await snapGet(r.id);
    } catch (e) {
      return A().toast('읽지 못했다: ' + e.message);
    }
    if (!data) return A().toast('체크포인트가 비어 있다');
    if (await restoreBattle(data, `↶ 되돌리기 — TURN ${r.turn} 턴 개시 직후로 (${c.gm ? 'GM' : c.ST.name || c.seat})`))
      A().toast(`TURN ${r.turn} 처음으로 되돌렸다`);
  }
  async function saveBattleAs() {
    const c = ctx();
    if (!c.mgr) return;
    const b = c.b;
    if (!b.trainers || !Object.keys(b.trainers).length) return A().toast('저장할 배틀이 없다');
    const d = new Date();
    const def = `TURN ${+b.turn || 0} · ${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const name = prompt('저장 이름', def);
    if (name == null) return;
    try {
      const r = await snapPut('save', String(name).trim() || def, snap(b));
      A().toast(
        r.server ? `「${String(name).trim() || def}」 저장했다` : `「${String(name).trim() || def}」 — 이 브라우저에만 저장했다 (SQL 패치 전)`
      );
      A().sysLog(`배틀 저장 「${String(name).trim() || def}」`, 'battle');
    } catch (e) {
      A().toast('저장 실패: ' + e.message);
    }
  }
  async function openResume() {
    const c = ctx();
    if (!c.mgr) return;
    const md = A().openModal(
      `<div class="mhead"><h2>배틀 저장 · 이어서 하기</h2><span class="sp"></span><button class="btn sm pri" id="snapSave" title="지금 배틀 전체를 이름 붙여 저장 (방 상태 밖)">지금 저장</button><button class="btn ghost" data-x>닫기</button></div><div id="snapls" class="small dim">읽는 중…</div>`
    );
    $('#snapSave', md).onclick = async () => {
      await saveBattleAs();
      draw();
    };
    const draw = async () => {
      let L = [];
      try {
        L = await snapList('save');
      } catch (e) {
        $('#snapls', md).innerHTML = `<div class="small" style="color:var(--red)">읽지 못했다: ${esc(e.message)}</div>`;
        return;
      }
      const me = c.gm ? 'gm' : c.seat;
      const fmt = t => (t ? new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
      $('#snapls', md).innerHTML =
        `<div class="small dim" style="margin-bottom:8px">${SNAPC.server === false ? '⚠ 서버에 om_snap 이 아직 없어 이 브라우저의 저장만 보인다 (supabase/patch_2026-11-03_배틀.sql)' : '방마다 60개까지 · 이어서 하면 지금 배틀을 덮는다 (먼저 「배틀 저장」으로 남겨 둘 것)'}</div>
    ${L.length ? L.map(r => `<div class="row" style="gap:8px;padding:6px 0;border-bottom:1px dashed var(--line)"><div style="flex:1;min-width:160px"><b>${esc(r.name || '(이름 없음)')}</b><div class="small dim">TURN ${+r.turn || 0} · ${fmt(r.at)}${r.w ? ' · ' + esc(r.w === 'gm' ? 'GM' : ((c.b.trainers || {})[r.w] || {}).name || r.w) : ''}${r.bytes ? ' · ' + Math.round(r.bytes / 1024) + 'KB' : ''}</div></div><button class="btn sm pri" data-rs="${esc(r.id)}">이어서 하기</button>${c.gm || r.w === me || !r.w ? `<button class="btn sm ghost danger" data-rd="${esc(r.id)}">삭제</button>` : ''}</div>`).join('') : '<div class="small dim">저장한 배틀이 없다 — 배틀 화면의 「배틀 저장」</div>'}`;
      md.querySelectorAll('[data-rs]').forEach(
        b =>
          (b.onclick = async () => {
            const r = L.find(x => x.id === b.dataset.rs);
            if (!r) return;
            if (!(await askYes(`「${r.name}」 (TURN ${+r.turn || 0}) 를 불러와 지금 배틀을 덮을까?\n지시는 다시 입력한다`, '이어서 한다', '그대로')))
              return;
            let data = null;
            try {
              data = await snapGet(r.id);
            } catch (e) {
              return A().toast('읽지 못했다: ' + e.message);
            }
            if (!data) return A().toast('저장이 비어 있다');
            A().closeModal();
            if (await restoreBattle(data, `▶ 이어서 하기 — 저장 「${r.name}」 (TURN ${+r.turn || 0}) 불러옴`))
              A().toast(`「${r.name}」 에서 이어서 한다`);
          })
      );
      md.querySelectorAll('[data-rd]').forEach(
        b =>
          (b.onclick = async () => {
            const r = L.find(x => x.id === b.dataset.rd);
            if (!r || !confirm(`「${r.name}」 저장을 지울까?`)) return;
            try {
              await snapDel(r.id);
            } catch (e) {
              return A().toast('지우지 못했다: ' + e.message);
            }
            draw();
          })
      );
    };
    draw();
  }
  /* ---------- 11-03 감우: 지시 입력 제한 시간 — battle.deadline (ms). 띠의 숫자 칸(#bdl)만 1초마다 갱신, 시간이 지나면 진행 권한에게 「행동 없음으로 두고 진행」 ---------- */
  function dlHtml(c, b) {
    const dl = +b.deadline || 0;
    if (!dl || (+b.phase || 0) !== 0) return '';
    const left = dl - Date.now();
    if (left > 0) {
      const s = Math.ceil(left / 1000);
      return `<span class="bdlt ${s <= 30 ? 'hot' : ''}" title="지시 입력 제한 시간">⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}</span>`;
    }
    return `<span class="bdlt over">⏱ 시간 종료</span>${c.mgr ? `<button class="btn xs pri" data-act="dlgo" title="아직 준비 완료가 아닌 자리는 행동 없음으로 두고 턴을 개시한다">준비 안 된 자리를 행동 없음으로 두고 진행</button>` : ''}`;
  }
  function dlTick() {
    const el = document.getElementById('bdl');
    if (!el) return;
    const c = ctx();
    const h = dlHtml(c, c.b);
    if (el._h === h) return;
    el.innerHTML = h;
    el._h = h;
    el.querySelectorAll('[data-act]').forEach(bt => (bt.onclick = () => action(bt.dataset)));
  }
  setInterval(() => {
    try {
      dlTick();
    } catch (e) {}
  }, 1000);
  /* ---------- 11-03 감우: 휴대폰에서 상태 칩 설명 — title 은 터치로 못 보니 칩을 누르면 작은 팝오버 (마우스도 같다) ---------- */
  function stPop(anchor, k, txt) {
    document.querySelectorAll('.stpop').forEach(e => e.remove());
    const db = (DB().states || {}).st || {};
    const d = db[k] || {};
    const body = txt || (d.desc || []).join(' ');
    if (!body && !d.ko) return;
    const p = document.createElement('div');
    p.className = 'stpop';
    p.innerHTML = `<b>${esc(d.ko || k)}</b>${d.abn ? ' <span class="tag" style="color:var(--red)">상태 이상</span>' : ''}<div class="stpb">${esc(body || '설명이 없다')}</div><button class="btn xs ghost" data-x>닫기</button>`;
    document.body.appendChild(p);
    const r = anchor.getBoundingClientRect();
    const W = Math.min(300, window.innerWidth - 16);
    p.style.width = W + 'px';
    let x = Math.max(8, Math.min(window.innerWidth - W - 8, r.left));
    let y = r.bottom + 6;
    if (y + p.offsetHeight > window.innerHeight - 8) y = r.top - p.offsetHeight - 6;
    y = Math.max(8, Math.min(window.innerHeight - p.offsetHeight - 8, y));
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    const off = ev => {
      if (ev && ev.type === 'click' && p.contains(ev.target) && !ev.target.closest('[data-x]')) return;
      p.remove();
      document.removeEventListener('click', off, true);
      document.removeEventListener('keydown', kd);
      window.removeEventListener('scroll', off, true);
    };
    const kd = e => {
      if (e.key === 'Escape') off();
    };
    setTimeout(() => {
      document.addEventListener('click', off, true);
      document.addEventListener('keydown', kd);
    }, 0);
    setTimeout(() => {
      if (p.isConnected) window.addEventListener('scroll', off, true);
    }, 400);
  }
  document.addEventListener(
    'click',
    e => {
      const t = e.target.closest('[data-stinfo]');
      if (!t || e.target.closest('[data-sd],[data-soff],.stx')) return;
      e.preventDefault();
      e.stopPropagation();
      stPop(t, t.dataset.stinfo, t.getAttribute('title') || '');
    },
    true
  );
