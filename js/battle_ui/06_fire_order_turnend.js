  /* ── 조각 06_fire_order_turnend.js — 동조 · 지령 발동 · 공개 · 행동 순서 · 턴 종료 ── */
  /* ---------- 【동조】 (11-05 망령): 필드에 같은 『역할』 대치가 성립한 순간 발동 여부를 묻는다 · 대치가 없으면 발동 버튼을 잠근다
    【동조】 구문 대상 「동조아군」 = 동조된 아군, 【동조 (상대)】 「동조상대」 = 동조된 상대 (fx syncPairs). 【동조 (아군)】(기술 대상이 같은 역할일 때 단발)은 여기서 묻지 않는다.
    상태 m.syncOn = 이 포켓몬 기준 대치가 이미 성립해 물어봤다 (새로고침 · 다른 창에서 또 묻지 않게) */
  const SYNC_RE = /【동조(?:\s*\(상대\))?】/;
  function syncP(b, m) {
    if (!FX() || !FX().syncPairs) return { a: new Set(), e: new Set(), pairs: [] };
    if (FX().syncRoles) FX().syncRoles(rolesOf); /* 조건 낱말 「동조중」도 같은 역할 읽기로 */
    return FX().syncPairs(b, m, rolesOf);
  }
  const syncLock = (b, m, eff) => SYNC_RE.test(String(eff || '')) && !syncP(b, m).pairs.length;
  function syncEffs(m) {
    const out = [];
    const list = [];
    if (m.ability) list.push(['trait', m.ability]);
    if (m.item && !IOFF(m)) list.push(['item', m.item]);
    for (const x of m.items2 || []) if (x && x.item && !IOFF(m)) list.push(['item', x.item]);
    for (const p of potSrc(m)) if (p && p.name && !p.ph) list.push(['pot', p.name]);
    for (const [kind, name] of list) {
      const tx = String(slotEff(m, kind, name) || '');
      if (!SYNC_RE.test(tx)) continue;
      if (kind === 'pot') {
        if (potRest(m, name)) continue;
        const lim = tx.match(/【\s*(\d+)\s*\/\s*시\s*】/);
        const left = (m.potUses || {})[name];
        if (lim && left != null && +left <= 0) continue;
      }
      const a = FX().autoOf(m, kind, name);
      out.push({ kind, name, auto: !!(a && a.ops && a.ops.length && !a.manual), tx });
    }
    return out;
  }
  /* 동조 성립 때 발동 여부 묻기 — 주인(접속 중이면 그 자리) · GM · 자기 것만. 남의 포켓몬은 묻지 않고 알림만 (11-06 망령 「동조 발동 창이 상대한테도 뜬다」)
    주인이 2분 안에 답하지 않아도 상대 화면에는 띄우지 않는다. 돌려주는 값: true = 발동 · false = 안 함(또는 알림만) */
  async function syncAsk(c, m, who, K, name, tx, pr) {
    const q = `【동조】 ${who}같은 『역할』 대치가 성립했다\n${pr}\n\n${K} 『${name}』을(를) 발동할까?`;
    const seats = c.ST.state.seats || {};
    const so = seats[m.tid] ? m.tid : baseSeat(c, m.tid);
    const to = m.tid && so && (A().online(so) || coOf(c, m.tid).some(s2 => A().online(s2))) && !ownT(c, m.tid) ? 'seat:' + m.tid : '';
    if (!to && !c.gm && !ownT(c, m.tid)) {
      A().sysLog(`【동조】 ${who}같은 역할 대치 성립 (${pr})\n${K} 『${name}』 — 주인이 「발동」 단추로 쓸 수 있다`, 'battle', {
        mid: m.id,
        img: m.image || '',
        eff: String(tx || '')
          .replace(/<br\s*\/?>/g, '\n')
          .slice(0, 300)
      });
      return false;
    }
    const yes = await remoteAsk(
      m,
      'confirm',
      { name, q },
      () => (c.gm || ownT(c, m.tid) ? askYes(q, '발동한다', '안 한다') : Promise.resolve(false)),
      to
    );
    if (!yes) A().sysLog(`【동조】 ${who}『${name}』 — 발동하지 않았다`, 'battle');
    return !!yes;
  }
  /* 11-27 망령 (미궁 포텐셜 「①【동조】/아군의 기술의 대미지를 강화」): 트레이너 고유(던전의 미궁 포텐셜 포함) 중 【동조】 글 + 구문이 있는 것 — 그 트레이너의 포켓몬 하나라도 대치가 성립하면 한 번 묻는다 (상태 t.syncOn) */
  function syncUniq(t, tid) {
    return uniqList(t).filter(x => {
      if (!SYNC_RE.test(String(x.p.eff || ''))) return false;
      if (x.left !== null && x.left <= 0) return false;
      const a = FX().autoOf({ tid }, 'pot', x.p.name);
      return !!(a && a.ops && a.ops.length && !a.manual);
    });
  }
  async function syncWatchUniq(c, b) {
    for (const [tid, t] of Object.entries(b.trainers || {})) {
      if (!t) continue;
      const mine = Object.values(b.mons || {}).filter(m => m && m.tid === tid && m.entry && m.hp.cur > 0);
      let on = null;
      let base = null;
      for (const m of mine) {
        const r = syncP(b, m);
        const hit = r.pairs.find(([a]) => (b.mons[a] || {}).tid === tid);
        if (hit) {
          on = r;
          base = b.mons[hit[0]];
          break;
        }
      }
      if (!on) {
        if (t.syncOn) await A().set(['battle', 'trainers', tid, 'syncOn'], null);
        continue;
      }
      if (t.syncOn) continue;
      await A().set(['battle', 'trainers', tid, 'syncOn'], 1);
      const U = syncUniq(t, tid);
      if (!U.length) continue;
      const pr = on.pairs
        .map(([a, e, r]) => `『${r}』 ${((b.mons || {})[a] || {}).name || '?'} ↔ ${((b.mons || {})[e] || {}).name || '?'}`)
        .join(' · ');
      for (const x of U) {
        const yes = await syncAsk(c, base, `${t.name || '야생'} — `, x.p.mq ? '미궁 포텐셜' : '고유', x.p.name, x.p.eff, pr);
        if (!yes) continue;
        const m2 = (ctx().b.mons || {})[base.id];
        if (!m2 || !m2.entry || !syncP(ctx().b, m2).pairs.length) {
          A().toast('그 사이 대치가 풀렸다');
          continue;
        }
        await fireSpecial(tid, base.id, 'uq', x.p.name, 'free');
      }
    }
  }
  let SYNC_BUSY = false;
  async function syncWatch(c, b) {
    if (SYNC_BUSY || !c.mgr || !b || !b.started || !FX() || !FX().syncPairs) return;
    if (!isLeader(c)) return;
    SYNC_BUSY = true;
    try {
      for (const m of Object.values(b.mons || {})) {
        const on = m.entry && m.hp.cur > 0 ? syncP(b, m) : null;
        const est = !!(on && on.pairs.length);
        if (!est) {
          if (m.syncOn) await A().set(['battle', 'mons', m.id, 'syncOn'], null);
          continue;
        }
        if (m.syncOn) continue;
        const E = syncEffs(m);
        await A().set(['battle', 'mons', m.id, 'syncOn'], 1);
        if (!E.length) continue;
        const pr = on.pairs
          .map(([a, e, r]) => `『${r}』 ${((b.mons || {})[a] || {}).name || '?'} ↔ ${((b.mons || {})[e] || {}).name || '?'}`)
          .join(' · ');
        for (const x of E) {
          const K = { pot: '포텐셜', trait: '특성', item: '소지품' }[x.kind];
          if (!x.auto) {
            A().sysLog(`【동조】 ${m.name} — 같은 역할 대치 성립 (${pr})\n${K} 『${x.name}』을(를) 쓸 수 있다 (구문 없음 — 손으로)`, 'battle', {
              mid: m.id,
              img: m.image || '',
              eff: x.tx.replace(/<br\s*\/?>/g, '\n').slice(0, 300)
            });
            continue;
          }
          const yes = await syncAsk(c, m, `${m.name} — `, K, x.name, x.tx, pr);
          if (!yes) continue;
          const m2 = (ctx().b.mons || {})[m.id];
          if (!m2 || !m2.entry || !syncP(ctx().b, m2).pairs.length) {
            A().toast('그 사이 대치가 풀렸다');
            continue;
          }
          if (x.kind === 'pot') {
            await potMark(m.id, x.name);
            if (wantCut(m2, x.name)) cutFire('m:' + m2.id, m2.image, m2.name, `『${x.name}』`, m2.side === 'left' ? '#1f6fd1' : '#e3101f');
          }
          await fireAuto(m.id, x.kind, x.name);
        }
      }
      await syncWatchUniq(c, ctx().b);
    } finally {
      SYNC_BUSY = false;
    }
  }
  async function delayWatch(c, b) {
    if (!c.mgr || !b || !b.started || !FX()) return;
    const T = +b.turn || 0;
    const key = String(b.started) + '|' + T;
    if (DELAY_SEEN[key]) return;
    if (!isLeader(c)) return;
    if (+b.dlyT === T) {
      DELAY_SEEN[key] = 1;
      return;
    }
    DELAY_SEEN[key] = 1;
    await A().set(['battle', 'dlyT'], T); /* dlyT: 이 턴의 지연 알림을 이미 했다 (새로고침 · 다른 창에서 또 하지 않게) */
    const notes = [];
    for (const m of Object.values(b.mons || {})) {
      if (!m.entry || m.hp.cur <= 0 || !+m.inT) continue;
      const k = T - +m.inT + 1;
      const src = [['trait', m.ability, m.abilityEff], ['item', m.item, m.itemEff], ...potSrc(m).map(p => ['pot', p.name, p.eff])].filter(
        x => x[1] && x[2]
      );
      for (const [kind, name, eff0] of src) {
        const eff = String(eff0).replace(/<br\s*\/?>/g, '\n');
        const lines = eff.split(/(?=[②③④⑤])/);
        lines.forEach((ln, li) => {
          const mm = ln.match(DLY_RE);
          if (!mm) return;
          const N = +mm[2],
            ally = !!mm[1],
            dur = !!mm[3];
          const tag = mm[0];
          const lab = `${m.name} 「${name}」 ${tag}`;
          if (ally) {
            if (k === N) notes.push(`${lab} — 나온 지 ${N}턴째 (아군 조건은 손으로 확인)`);
            return;
          }
          if (dur) {
            if (k === 1) notes.push(`${lab} — 이번 턴부터 ${N}턴 동안 (${T}~${T + N - 1}턴)`);
            else if (k === N + 1) notes.push(`${lab} — 끝났다 (손으로 건 효과가 있으면 지운다)`);
            return;
          }
          if (k !== N) return;
          const a = FX().autoOf(m, kind, name);
          /* 11-04 19:33 망령 「횟수 빠진 선회도」: 『질투닌의 선회』(【1/시】【지연 (2턴)】 턴 종료 이후 임의 교대할 수 있다)를 지연이 풀리는 턴 개시에 저절로 돌려
        횟수를 깎고, 진행 창(GM)에 「임의 교대할까?」를 띄웠다 — 「할 수 있다」 · 임의 교대 같은 고르는 효과는 저절로 쓰지 않고 「이제 쓸 수 있다」만 알린다 (쓸 때 카드 「발동」) */
          if (limManual(m, kind, name, eff) || (li === 0 && a && a.ops && a.ops.some(o => o && o.k === 'freeswitch')) || /할\s*수\s*있다/.test(ln)) {
            notes.push(`${lab} — 나온 지 ${N}턴째, 이제 쓸 수 있다 (때가 되면 그 포켓몬 카드에서 「발동」 — 저절로 쓰지 않음)`);
            return;
          }
          if (li === 0 && a && a.ops && a.ops.length && !a.manual) {
            fireAuto(m.id, kind, name, { quiet: true, head: `【지연】 ${lab} — 나온 지 ${N}턴째, 발동` }).catch(e => console.warn('delay', e));
          } else notes.push(`${lab} — 나온 지 ${N}턴째, 이번 턴부터 (손으로)`);
        });
      }
    }
    if (notes.length) A().sysLog(`【지연】 ${T}턴\n${notes.join('\n')}`, 'battle');
  }
  async function watch() {
    const c = ctx();
    const b = c.b;
    try {
      dupWatch(c, b);
    } catch (e) {
      console.warn('dup', e);
    }
    if (b && b.started && (c.gm || c.role === 'seat')) itemKickRemote();
    delayWatch(c, b).catch(e => console.warn('delay', e));
    try {
      coWatch();
    } catch (e) {}
    faintWatch().catch(e => console.warn('faint', e));
    stateWatch().catch(e => console.warn('state', e));
    try {
      orderWatch();
    } catch (e) {
      console.warn('order', e);
    }
    try {
      healWatch();
    } catch (e) {
      console.warn('heal', e);
    }
    leaveWatch().catch(e => console.warn('leave', e));
    weatherWatch().catch(e => console.warn('weather', e));
    typeWatch().catch(e => console.warn('typed', e));
    trWatch().catch(e => console.warn('trait', e));
    symWatch().catch(e => console.warn('공생', e));
    whileWatch().catch(e => console.warn('while', e));
    roleNullWatch().catch(e => console.warn('역할 무효', e));
    itdaWatch().catch(e => console.warn('itda', e));
    hpFormWatch().catch(e => console.warn('hpform', e));
    answerAsks().catch(e => console.warn('asks', e));
    if (b.endq && b.endq.step) endAdvance();
    if (b.started && (+b.phase || 0) >= 1) {
      if (c.role === 'seat') for (const tid of myTrainers(c).filter(t => lead(c, t))) selfCharge(tid).catch(e => console.warn('선행 차감', e));
      if (+b.tstep >= 2 && (b.host || 'gm') !== c.seat && ((b.host || 'gm') !== 'gm' || c.fair))
        for (const tid of myTrainers(c).filter(t => lead(c, t)))
          selfPreFire(tid, (b.host || 'gm') === 'gm').catch(e => console.warn('선행 자동(주인)', e));
      gmChargeOrphans().catch(e => console.warn('선행 차감(GM)', e));
    }
    if ((+b.phase || 0) >= 2) return autoRevealTurn();
    if ((+b.phase || 0) !== 1) return;
    if (c.gm) for (const tid of Object.keys(b.trainers || {}).filter(t => !seatOwned(c, t))) await publishOk(tid);
    if (c.role === 'seat')
      for (const tid of myTrainers(c).filter(t => lead(c, t))) {
        await publishOk(tid); /* 함께 지시하는 트레이너도 (주인이 없을 때) */
        const key = turnKey(b);
        if (String(b.revealReq || '') === key && !BUSY.rv) {
          const left = Object.values(b.mons || {}).filter(
            m => m.tid === tid && m.entry && m.hp.cur > 0 && !revealed(b, tid, m.id) && !SENT[key + ':' + m.id]
          );
          if (left.length) {
            BUSY.rv = 1;
            try {
              for (const m of left) {
                if (revealed(ctx().b, tid, m.id)) continue;
                SENT[key + ':' + m.id] = 1;
                await revealOne(tid, m.id, true);
              }
            } finally {
              BUSY.rv = 0;
            }
          }
        }
      }
    autoAdvance();
  }
  /* ----- 4식 6령 발동 창 (맵툴 order_mgr / order_run): 선행 발동 · 임의 발동 · 강제 ----- */
  function openFire(tid) {
    const c = ctx();
    const b = c.b;
    const t = (b.trainers || {})[tid];
    if (!t) return;
    if (!c.gm && !ownT(c, tid)) return;
    const mons = Object.values(b.mons || {})
      .filter(m => m.tid === tid && m.entry && m.hp.cur > 0)
      .sort((x, y) => x.entry.localeCompare(y.entry));
    if (!mons.length) return A().toast('필드에 포켓몬이 없다');
    UIC.fire = UIC.fire || {};
    if (!mons.find(m => m.id === UIC.fire[tid])) UIC.fire[tid] = mons[0].id;
    const m = mons.find(x => x.id === UIC.fire[tid]);
    const cnt = t.orderCount || {};
    const fired = (((b.cmds || {})[tid] || {}).fired || {})[m.id] || {};
    const ph = +b.phase || 0;
    const md = A()
      .openModal(`<div class="mhead"><h2>포텐셜 발동 · ${esc(t.name)}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="tabs2">${mons.map(mm => `<div class="tab2 ${mm.id === m.id ? 'on' : ''}" data-ftab="${mm.id}"><div class="pic" style="${mm.image ? `background-image:url('${cssu(mm.image)}')` : ''}"></div><div><b>${esc(mm.name)}</b><small>에리어 ${mm.entry.toUpperCase()}</small></div></div>`).join('')}</div>
   <div class="firepre small dim" id="firepre">선행 입력을 읽는 중…</div>
   ${(() => {
     const U = uniqList(t);
     const E = specialPots(m);
     const fp = fired.pot || {};
     const row = (sk, x) => {
       const n = x.p.name;
       const done = !!fp[(sk === 'uq' ? 'u:' : 'e:') + n];
       const can = x.left === null || x.left > 0;
       return `<div class="firerow ${done ? 'done' : ''}" data-sk="${sk}" data-sn="${esc(n)}"><b class="fnm"><span class="tag ${sk === 'uq' ? 'uqt' : 'ext'}"${(() => {
         const cc = sk === 'uq' ? hexOk(x.p.color) : exColOf(m, n);
         return cc ? ` style="background:${cc};color:${fgOn(cc)};border-color:${cc}"` : '';
       })()}>${sk === 'uq' ? '고유' : '전용'}</span> 『${esc(n)}』</b><span class="fcnt">${x.max != null ? pipsL(x) : '횟수 없음'}</span><span class="sp"></span>
      <button class="btn sm pri" data-sfire="pre" data-sk="${sk}" data-sn="${esc(n)}" hidden>선행 발동</button><button class="btn sm" data-sfire="free" data-sk="${sk}" data-sn="${esc(n)}" ${can && (ph >= 1 || /【\s*사전\s*】|「빈사」\s*상태가\s*되었을\s*때/.test(String(x.p.eff || ''))) ? '' : 'disabled'}>임의 발동</button>${c.gm ? `<button class="btn sm ghost" data-sfire="force" data-sk="${sk}" data-sn="${esc(n)}">강제</button>` : ''}</div><div class="small dim" style="padding:0 10px 6px">${esc(
        String(x.p.eff || '')
          .replace(/<br\s*\/?>/g, ' ')
          .slice(0, 220)
      )}</div>`;
     };
     return `${U.length ? `<div class="sec">고유 포텐셜 <span class="note">${esc(t.name)} · 대상 ${esc(m.name)} (에리어 ${m.entry.toUpperCase()})</span></div><div class="firelist">${U.map(x => row('uq', x)).join('')}</div>` : ''}${E.length ? `<div class="sec">전용 포텐셜 <span class="note">${esc(m.name)}</span></div><div class="firelist">${E.map(x => row('ex', x)).join('')}</div>` : ''}`;
   })()}
   ${[
     ['order', '명령 (4식)', pKeys(b, tid, 'order'), k => pName(b, tid, 'order', k)],
     ['command', '지령 (6령)', pKeys(b, tid, 'command'), k => pName(b, tid, 'command', k)]
   ]
     .map(
       ([kind, title, keys, nm]) =>
         `<div class="sec">${title}</div><div class="firelist">${
           keys
             .map(k => {
               const ck = (kind === 'order' ? 'order_' : 'command_') + k;
               const n = pN(b, tid, ck);
               const done = fired[kind] === k;
               return `<div class="firerow ${done ? 'done' : ''}" data-fk="${k}" data-kind="${kind}"><b class="fnm">『${esc(nm(k))}』</b>${OO().ownerOf(t, k) ? `<i class="oown">${esc(OO().ownerOf(t, k))} 몫</i>` : ''}<span class="fcnt">남은 <b>${n}</b></span><span class="sp"></span>
     <button class="btn sm pri" data-fire="pre" data-kind="${kind}" data-k="${k}" hidden>선행 발동</button><button class="btn sm" data-fire="free" data-kind="${kind}" data-k="${k}" ${n > 0 && (ph >= 1 || preTag(nm(k)) || rinneOK(b, tid, k, kind)) ? '' : 'disabled'} title="남은 횟수 1을 써서 바로 발동${preTag(nm(k)) ? ' · 【사전】 — 지시 준비 중에도' : ''}${rinneOK(b, tid, k, kind) ? ' · ② — 지난 턴 종료에 【임의】' : ''}">${rinneOK(b, tid, k, kind) ? '임의 발동 ②' : '임의 발동'}</button>${c.gm ? `<button class="btn sm ghost" data-fire="force" data-kind="${kind}" data-k="${k}" title="횟수·입력과 상관없이 발동">강제</button>` : ''}</div>`;
             })
             .join('') || '<div class="small dim">쓰는 항목이 없다</div>'
         }</div>`
     )
     .join('')}
   <div class="small dim" style="margin-top:8px">선행 발동 : 지시 입력에서 선행 입력한 것을 그 순간 발동 (턴 개시 때 횟수를 깎았다) · 임의 발동 : 남은 횟수 1을 써서 지금 발동 · 강제 : GM 이 횟수와 상관없이</div>`);
    md.querySelectorAll('[data-ftab]').forEach(
      el =>
        (el.onclick = () => {
          UIC.fire[tid] = el.dataset.ftab;
          A().closeModal();
          openFire(tid);
        })
    );
    /* 선행 입력 읽기 (주인·GM 만 읽을 수 있다) */
    let CM = null; /* 10-26 망령: 「선행 발동」은 선행 입력한 그 포켓몬에게 — 다른 탭이 열려 있어도 입력한 포켓몬을 찾아 건다 */
    const preMid = (kind, k, sk, n) => {
      const ms = (CM && CM.mons) || {};
      if (kind) {
        if ((ms[m.id] || {})[kind] === k) return m.id;
        const id = Object.keys(ms).find(i => (ms[i] || {})[kind] === k && mons.some(x => x.id === i));
        return id || m.id;
      }
      if (sk === 'ex') {
        if (((ms[m.id] || {}).pots || []).includes(n)) return m.id;
        const id = Object.keys(ms).find(i => ((ms[i] || {}).pots || []).includes(n) && mons.some(x => x.id === i));
        return id || m.id;
      }
      return m.id;
    };
    myCmd(c, tid, true)
      .then(cm => {
        CM = cm;
        const pre = $('#firepre', md);
        if (!pre) return;
        const x = (cm && cm.mons && cm.mons[m.id]) || {};
        const parts = []; /* 교대로 나간 포켓몬의 선행 입력은 함께 사라진다 (들어온 포켓몬이 이어받지 않는다) */
        for (const kind of ['order', 'command']) {
          const k = x[kind];
          if (!k) continue;
          const nm = kind === 'order' ? OO().orderName(t, k) : OO().commandName(t, k);
          parts.push(`${kind === 'order' ? '명령' : '지령'} 『${esc(nm)}』${fired[kind] === k ? ' (발동함)' : ''}`);
          const bt = md.querySelector(`[data-fire="pre"][data-kind="${kind}"][data-k="${k}"]`);
          if (bt && ph >= 1 && fired[kind] !== k) bt.hidden = false;
          const row = md.querySelector(`.firerow[data-kind="${kind}"][data-fk="${k}"]`);
          if (row) row.classList.add('pre');
        }
        const fp = fired.pot || {};
        for (const [sk, list] of [
          ['uq', (cm && cm.upots) || []],
          ['ex', x.pots || []]
        ])
          for (const n of list) {
            const key = (sk === 'uq' ? 'u:' : 'e:') + n;
            const bt = md.querySelector(`[data-sfire="pre"][data-sk="${sk}"][data-sn="${CSS.escape(n)}"]`);
            if (!bt) continue;
            parts.push(`${sk === 'uq' ? '고유' : '전용'} 『${esc(n)}』${fp[key] ? ' (발동함)' : ''}`);
            if (ph >= 1 && !fp[key]) bt.hidden = false;
            const r = bt.closest('.firerow');
            if (r) r.classList.add('pre');
          }
        /* 다른 포켓몬이 선행 입력한 명령 · 지령도 여기서 「선행 발동 → 그 포켓몬」으로 누를 수 있다 */
        for (const om of mons) {
          if (om.id === m.id) continue;
          const ox = (cm && cm.mons && cm.mons[om.id]) || {};
          const of = (((b.cmds || {})[tid] || {}).fired || {})[om.id] || {};
          for (const kind of ['order', 'command']) {
            const k = ox[kind];
            if (!k || of[kind] === k) continue;
            const bt = md.querySelector(`[data-fire="pre"][data-kind="${kind}"][data-k="${k}"]`);
            if (bt && ph >= 1 && bt.hidden) {
              bt.hidden = false;
              bt.textContent = '선행 발동 → ' + om.name;
            }
          }
        }
        pre.innerHTML = `${esc(m.name)} (에리어 ${m.entry.toUpperCase()}) 선행 입력: ${parts.join(' · ') || '<span class="dim">없음</span>'}${ph < 1 ? ' <span class="dim">— 턴 개시 뒤에 발동할 수 있다</span>' : ''}`;
      })
      .catch(() => {});
    md.querySelectorAll('[data-fire]').forEach(
      bt =>
        (bt.onclick = () =>
          fireOrder(tid, bt.dataset.fire === 'pre' ? preMid(bt.dataset.kind, bt.dataset.k) : m.id, bt.dataset.kind, bt.dataset.k, bt.dataset.fire))
    );
    md.querySelectorAll('[data-sfire]').forEach(
      bt =>
        (bt.onclick = () =>
          fireSpecial(
            tid,
            bt.dataset.sfire === 'pre' ? preMid('', null, bt.dataset.sk, bt.dataset.sn) : m.id,
            bt.dataset.sk,
            bt.dataset.sn,
            bt.dataset.sfire
          ))
    );
  }
  /* 트레이너 칸의 고유 「발동」: 대상(필드의 내 포켓몬 · 없으면 대상 없이) · 선행/임의/강제 를 고른다 */
  async function openUfire(tid, name) {
    const c = ctx();
    const b = c.b;
    const t = (b.trainers || {})[tid];
    if (!t) return;
    if (!c.gm && !ownT(c, tid)) return;
    const x = uniqList(t).find(q => q.p.name === name);
    if (!x) return;
    /* 11-02 망령 「상태 미라클아이 상대1체 2턴 — 상대가 안 뜨고 아군만 보인다」: 고유 구문이 「상대 1체」를 고르면 대상 목록을 상대 포켓몬으로 (기준은 이 트레이너의 나와 있는 포켓몬) */
    const ua0 = FX() ? FX().autoOf({ tid }, 'pot', name) : null;
    const foeT = !!(ua0 && ua0.ops && JSON.stringify(ua0.ops).includes('"tgt":"enemy1"'));
    const mons = Object.values(b.mons || {})
      .filter(m => (foeT ? m.side !== t.side && m.tid !== tid : m.tid === tid) && m.entry && m.hp.cur > 0)
      .sort((p, q) => p.entry.localeCompare(q.entry));
    const ph = +b.phase || 0;
    /* 11-02 망령 「트레이너 고유 때도 누가 기준일지 고를 수 있게」: 이 트레이너의 나와 있는 포켓몬 중 기준(구문의 「자신」)을 고른다. 대상이 내 포켓몬이면 대상을 고를 때 기준도 같이 따라간다 */
    const own = Object.values(b.mons || {})
      .filter(m => m.tid === tid && m.entry && m.hp.cur > 0)
      .sort((p, q) => p.entry.localeCompare(q.entry));
    const md = A()
      .openModal(`<div class="mhead"><h2><span class="tag uqt">고유</span> 『${esc(name)}』</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="small" style="margin-bottom:8px;white-space:pre-wrap">${esc(String(x.p.eff || '').replace(/<br\s*\/?>/g, '\n'))}</div>
   <div class="small dim">${esc(t.name)} · ${x.max != null ? pipsL(x) : '횟수 없음'}</div>
   <div class="sec">대상${foeT ? ' <span class="dim small">— 상대 1체</span>' : ''}</div><div class="pool">${mons.map((m, i) => `<div class="oc ${i === 0 ? 'mine' : ''}" data-ut="${m.id}"><b>${esc(m.name)}</b><small>${foeT ? '상대 · ' : ''}에리어 ${m.entry.toUpperCase()}</small></div>`).join('')}<div class="oc ${mons.length ? '' : 'mine'}" data-ut=""><b>대상 없음</b><small>${foeT ? '발동할 때 고른다' : '트레이너만'}</small></div></div>
   ${own.length > 1 || (foeT && own.length) ? `<div class="sec">기준 <span class="dim small">— 구문의 「자신」 · 예고 공격 등의 능력치는 이 포켓몬</span></div><div class="pool" id="ubase">${own.map((m, i) => `<div class="oc ${i === 0 ? 'mine' : ''}" data-ub="${m.id}"><b>${esc(m.name)}</b><small>에리어 ${m.entry.toUpperCase()}</small></div>`).join('')}</div>` : ''}
   <div class="small dim" id="upre" style="margin-top:6px">선행 입력 확인 중…</div>
   <div class="row" style="margin-top:10px"><span class="sp"></span><button class="btn pri" data-uf="pre" hidden>선행 발동</button><button class="btn" data-uf="free" ${x.left === null || x.left > 0 ? '' : 'disabled'}>임의 발동</button>${c.gm ? '<button class="btn ghost" data-uf="force">강제</button>' : ''}</div>`);
    let tgt = mons[0] ? mons[0].id : '',
      base = own[0] ? own[0].id : '';
    const markB = () => md.querySelectorAll('[data-ub]').forEach(o => o.classList.toggle('mine', o.dataset.ub === base));
    md.querySelectorAll('[data-ut]').forEach(
      el =>
        (el.onclick = () => {
          tgt = el.dataset.ut;
          md.querySelectorAll('[data-ut]').forEach(o => o.classList.toggle('mine', o === el));
          if (!foeT && tgt && own.some(m => m.id === tgt)) {
            base = tgt;
            markB();
          }
        })
    );
    md.querySelectorAll('[data-ub]').forEach(
      el =>
        (el.onclick = () => {
          base = el.dataset.ub;
          markB();
          if (!foeT && tgt && tgt !== base && own.some(m => m.id === tgt)) {
            tgt = base;
            md.querySelectorAll('[data-ut]').forEach(o => o.classList.toggle('mine', o.dataset.ut === tgt));
          }
        })
    );
    md.querySelectorAll('[data-uf]').forEach(bt => (bt.onclick = () => fireSpecial(tid, tgt, 'uq', name, bt.dataset.uf, base)));
    try {
      const rows = await DBS().secretGet(c.ST.room, c.ST.secret, 'cmd');
      const r = (rows || []).filter(q => cmdFresh(q)).find(q => q.id === tid);
      const cm = r && (r.data || r.v || r.value || r);
      const up = (cm && cm.upots) || [];
      const el = $('#upre', md);
      if (el) el.textContent = up.includes(name) ? '이번 턴에 선행 입력했다' : '선행 입력 안 함';
      if (up.includes(name) && ph >= 1) {
        const p = md.querySelector('[data-uf=pre]');
        if (p) p.hidden = false;
      }
    } catch (e) {
      const el = $('#upre', md);
      if (el) el.textContent = '';
    }
  }
  /* 고유(트레이너) · 전용 포텐셜 발동: 선행(지시에서 선행 입력한 것) · 임의 · 강제(GM). 횟수는 발동할 때 1 깎는다(강제 제외). 자동화가 있으면 대상 포켓몬에 걸고, 없으면 효과를 로그 카드로 */
  async function fireSpecial(tid, mid, sk, name, how, baseId) {
    const c = ctx();
    const b = c.b;
    const t = (b.trainers || {})[tid];
    let m = (b.mons || {})[mid] || null;
    if (!t || (!m && sk !== 'uq')) return;
    if (!c.gm && !ownT(c, tid)) return;
    if (how === 'force' && !c.gm) return;
    const x = sk === 'uq' ? uniqList(t).find(q => q.p.name === name) : specialPots(m).find(q => q.p.name === name);
    if (!x) return;
    /* 11-15 망령 「아니스는 고유 키고 있나」: 【동조】 고유 · 전용은 고른 포켓몬이 적진의 같은 『역할』과 대치할 때만 (카드 단추는 막고 있었는데 선행 · 임의 발동 길은 안 봤다) — 강제는 그대로 */
    if (how !== 'force' && m && SYNC_RE.test(String(x.p.eff || '')) && syncLock(b, m, x.p.eff)) {
      A().sysLog(
        `【${sk === 'uq' ? '고유' : '전용'}】 『${name}』 — 【동조】: ${m.name} 이(가) 적진의 같은 『역할』과 대치하지 않아 발동하지 않는다`,
        'battle',
        { mid: m.id }
      );
      return;
    }
    const TWO = twoStage(x.p.eff);
    const PD = TWO && sk === 'uq' ? preDoneOf(t, name) : null;
    const ST2 = TWO && sk === 'uq' ? (PD || how === 'pre' ? 2 : 1) : 0; /* 0 = 두 단계 아님 · 1 = ①(사전) · 2 = ②(선행) */
    if (TWO && sk === 'uq' && !PD && how === 'pre') {
      if (
        !(await askYes(
          `『${name}』 ② 는 「①의 효과를 발동했을 때」 — 이번 턴에 ① 을 【사전】으로 쓰지 않았다.\n그래도 ② 를 발동할까? (① 몫 없이)`,
          '발동',
          '그만'
        ))
      )
        return;
    }
    if (how !== 'force' && !PD && x.left !== null && x.left <= 0) return A().toast('남은 횟수가 없다');
    /* 11-04 망령: 【선행】(【임의】 없음)인 고유 · 전용을 선행 입력 없이 「임의 발동」하려면 경고 — 그래도 하면 강제로 (횟수는 쓴다) */
    if (how === 'free' && b.started && (+b.phase || 0) >= 1 && effPre(x.p.eff) && !effFree(x.p.eff)) {
      let cm = null;
      try {
        const rows = await DBS().secretGet(c.ST.room, c.ST.secret, 'cmd');
        const r = (rows || []).filter(q => cmdFresh(q, b)).find(q => q.id === tid);
        cm = r && r.data;
      } catch (e) {}
      const did = sk === 'uq' ? ((cm && cm.upots) || []).includes(name) : ((((cm && cm.mons) || {})[mid] || {}).pots || []).includes(name);
      if (
        !did &&
        !(await askYes(
          `⚠ ${sk === 'uq' ? '고유' : '전용'} 『${name}』 은(는) 【선행】 포텐셜인데 이번 턴에 선행 입력하지 않았다.\n원칙은 지시 단계에서 선행 입력 → 턴 개시 뒤 「선행 발동」.\n그래도 강제로 발동할까?`,
          '강제 발동',
          '그만'
        ))
      )
        return;
    }
    /* 11-07 대상 지정: 지시에서 찍어 둔 자리(cur.utg · x.ptg)의 포켓몬을 구문의 「1체」로 — 고유는 그 포켓몬이 곧 대상 */
    let TP = '';
    {
      const ts = tselOf(sk === 'uq' ? null : m, name, sk === 'uq' ? tid : '');
      if (ts) {
        let cm0 = null;
        try {
          const rows = await DBS().secretGet(c.ST.room, c.ST.secret, 'cmd');
          const r = (rows || []).filter(q => cmdFresh(q, b)).find(q => q.id === tid);
          cm0 = r && r.data;
        } catch (e) {}
        const slot = sk === 'uq' ? ((cm0 && cm0.utg) || {})[name] : ((((cm0 && cm0.mons) || {})[mid] || {}).ptg || {})[name];
        const tm = tselMon(b, slot);
        if (tm) TP = tm.id;
      }
      if (sk === 'uq' && !TP && PD && PD.tgt && (b.mons || {})[PD.tgt]) TP = PD.tgt; /* ② 대상 = ① 의 대상 (지시에서 따로 안 찍었으면) */
      if (sk === 'uq' && !TP && ST2 === 1 && ts) {
        const al = Object.values(b.mons || {}).filter(
          q => q && q.entry && q.hp && q.hp.cur > 0 && (ts.tgt === 'enemy1' ? q.side !== t.side : q.side === t.side)
        );
        const base = al[0] || Object.values(b.mons || {}).find(q => q && q.tid === tid);
        if (al.length === 1) TP = al[0].id;
        else if (al.length && base) {
          const pk = await uiCtx(b, base, name).pick(al, `『${name}』 ① 대상 (${ts.tgt === 'enemy1' ? '상대' : '아군'})`);
          if (!pk) return;
          TP = pk.id;
        }
      } /* ① 을 지시 전에 쓰면 지시의 대상 칸이 없다 — 여기서 고른다 */
      if (sk === 'uq' && TP) {
        mid = TP;
        m = (b.mons || {})[TP] || m;
      }
    }
    /* 11-11 망령 「고유로 보급 적혀 있으면 발동된 애가 보급 적용 — 걔는 못 걸고 그 옆은 되는 거지」: 고유 【보급】은 받은 포켓몬마다 등장당 1번 (potTurn._sup['u:이름'], 교대하면 지워짐) */
    const USUP = sk === 'uq' && /【\s*보급\s*】/.test(String((x.p || {}).eff || ''));
    if (
      USUP &&
      m &&
      how !== 'force' &&
      ((m.potTurn || {})._sup || {})['u:' + name] &&
      !(await askYes(
        `${m.name}은(는) 이번 등장에 이미 고유 『${name}』을(를) 받았다 (【보급】 — 소지에 들어갔다 나와야 다시 받는다).\n다른 포켓몬을 대상으로 고르거나, 그래도 강제로 걸까?`,
        '강제로 건다',
        '그만'
      ))
    )
      return;
    /* 11-09 감우 57: 기술 지정 — 지시에서 고른 기술(cur.utm · x.ptm)을 구문의 「지정기술」로 */
    let MS = '';
    if (mselOf(sk === 'uq' ? null : m, name, sk === 'uq' ? tid : '')) {
      let cm1 = null;
      try {
        const rows = await DBS().secretGet(c.ST.room, c.ST.secret, 'cmd');
        const r = (rows || []).filter(q => cmdFresh(q, b)).find(q => q.id === tid);
        cm1 = r && r.data;
      } catch (e) {}
      MS = String((sk === 'uq' ? ((cm1 && cm1.utm) || {})[name] : ((((cm1 && cm1.mons) || {})[mid] || {}).ptm || {})[name]) || '');
    }
    A().closeModal();
    const tag = how === 'pre' ? '【선행】' : how === 'free' ? '【임의】' : '【강제】';
    const LB = sk === 'uq' ? '고유' : '전용';
    if (how !== 'force' && x.max != null && !(ST2 === 2 && PD)) {
      const T = +b.turn || 0;
      if (x.mmax != null) {
        const cur = sk === 'uq' ? t.uUses || {} : m.potUses || {};
        const had = cur[name] == null ? x.mmax : +cur[name];
        /* 11-05: 지금 서버 값에서 1 — 칸 하나만 쓴다(옛 사본으로 다른 포텐셜 횟수를 덮지 않게) */ const fb = ctx().b || {};
        const fc = sk === 'uq' ? ((fb.trainers || {})[tid] || {}).uUses || {} : ((fb.mons || {})[mid] || {}).potUses || {};
        const fh = fc[name] == null ? had : +fc[name];
        await A().set(sk === 'uq' ? ['battle', 'trainers', tid, 'uUses', name] : ['battle', 'mons', mid, 'potUses', name], Math.max(0, fh - 1));
      }
      if (x.per) await A().set(sk === 'uq' ? ['battle', 'trainers', tid, 'uTurn', name] : ['battle', 'mons', mid, 'potTurn', name], T);
    } /* 【소진】 · 【탈진】: 쓴 턴을 적는다 */
    await A().set(['battle', 'cmds', tid, 'fired', m ? mid : '_t', 'pot', (sk === 'uq' ? 'u:' : 'e:') + name], 1);
    if (USUP && m) await A().set(['battle', 'mons', mid, 'potTurn', '_sup', 'u:' + name], 1);
    if (m && sk !== 'uq') await shareMark(mid, name); /* 11-10 【공유】 */
    if (sk === 'uq') {
      if (String(((A().ST.state.rp || {}).cutin || {}).ord) !== '0')
        cutFire('t:' + tid, trainerImg(t), `${t.name}의 고유!`, `『${name}』`, t.side === 'left' ? '#1f6fd1' : '#e3101f');
    } else if (wantCut(m, name)) cutFire('m:' + m.id, m.image, m.name, `『${name}』`, m.side === 'left' ? '#1f6fd1' : '#e3101f');
    if (sk !== 'uq' && m && ((m.excl && m.excl.name === name) || (m.exclX || []).some(q => q && q.name === name)))
      setTimeout(() => rcvReact(tid, mid, 'excl', name).catch(e => console.warn('rcvReact', e)), 1200); /* 11-09 「전용 포텐셜이 발동했을 때」 계기 */
    const lv0 = x.mmax != null && x.ml != null ? x.ml : x.left;
    const left =
      x.max != null
        ? ` 【${how === 'force' ? lv0 : Math.max(0, lv0 - 1)}/${x.max}】`
        : ''; /* 11-26 05:20 망령 「이것도 0/3」: 【3/시】【소진】 은 이번 턴 몫(1)이 아니라 남은 횟수(ml)에서 1 뺀 값 */
    const who = sk === 'uq' ? t.name : m.name;
    const bm0 = sk === 'uq' && baseId && (!m || m.side !== t.side) ? (b.mons || {})[baseId] : null;
    const tgt =
      sk === 'uq'
        ? (m ? ` → ${m.name} (에리어 ${String(m.entry).toUpperCase()})` : '') + (bm0 ? ` · 기준 ${bm0.name}` : '')
        : TP && (b.mons || {})[TP]
          ? ` → ${(b.mons || {})[TP].name} (에리어 ${String((b.mons || {})[TP].entry).toUpperCase()})`
          : '';
    const img = sk === 'uq' ? trainerImg(t) : m.image || '';
    /* 11-14 망령 「커맨드 미션류」: 「이번 턴 … 『지령』의 효과를 【…】로 변경한다」 — 지금 효과를 걸지 않고 이번 턴 표만 세운다 (지령을 쓸 때 cmdChange 가 바꿔 건다) */
    {
      const e0 = String(x.p.eff || '');
      const cm0 = e0.match(CHG_RE);
      if (cm0 && /이번\s*턴/.test(e0) && !ST2) {
        const T = +b.turn || 0;
        const keep = {};
        for (const [k, v] of Object.entries(b.cmdChg || {})) if (v && +v.turn === T) keep[k] = v;
        keep[(sk === 'uq' ? 'u:' : 'e:') + tid + ':' + String(name).replace(/[.\/#$\[\]]/g, '_')] = {
          turn: T,
          tid,
          side: t.side,
          sk,
          name,
          mid: sk === 'uq' ? '' : mid
        };
        await A().set(['battle', 'cmdChg'], keep);
        A().sysLog(
          `【${LB}】 ${who} 『${name}』${left}${tag}\n→ 이번 턴 ${/타입/.test(e0.slice(0, cm0.index)) ? (e0.slice(0, cm0.index).match(/「[^」]*타입[^」]*」[^『]*/) || [''])[0].trim() + ' ' : ''}『지령』의 효과가 【${cm0[1]}】로 바뀐다 (지령을 쓸 때 자동)`,
          'battle',
          { mid: m ? m.id : '', img, eff: e0.replace(/<br\s*\/?>/g, '\n').slice(0, 400) }
        );
        return;
      }
    }
    /* 10-28 망령 (빛의장막 고유): 고유 구문은 트레이너에서 바로 찾는다 — 대상을 안 골랐거나 상대 포켓몬을 골라도 돌게. 대상이 없으면 그 트레이너의 나와 있는 포켓몬을 기준으로 건다 */
    const foe =
      sk === 'uq' && m && m.side !== t.side; /* 고른 대상이 상대 포켓몬 — 구문의 「상대 1체」로 그 포켓몬을 쓰고, 기준(자신)은 이 트레이너의 포켓몬 */
    const ua = sk === 'uq' && FX() ? FX().autoOf({ tid }, 'pot', name) || (m && !foe && FX().autoOf(m, 'pot', name)) : null;
    const bm = sk === 'uq' && baseId ? (b.mons || {})[baseId] : null;
    const cm =
      (foe ? null : m) ||
      (bm && bm.tid === tid && bm.entry ? bm : null) ||
      (ua ? Object.values(b.mons || {}).find(q => q && q.tid === tid && q.entry) || Object.values(b.mons || {}).find(q => q && q.tid === tid) : null);
    const cmid = cm ? cm.id : mid;
    const a0 = sk === 'uq' ? ua : m && FX() && FX().autoOf(m, 'pot', name);
    const a = ST2 ? stageOps(a0, ST2) : a0;
    const pr0 = prioNow(cmid);
    if (ST2 === 1)
      await A().set(
        [
          'battle',
          'trainers',
          tid,
          'preDone',
          String(name)
            .replace(/[『』]/g, '')
            .trim()
        ],
        { t: +b.turn || 0, tgt: TP || cmid || '' }
      );
    const DYN =
      !(a && realOps(a) && !a.manual) &&
      DYN_TYPE_RE.test(String(x.p.eff || '')); /* 11-15: 구문 없이 그때그때 타입을 정하는 것(찰나의 모작) — fireAuto 가 정한다 */
    if (cm && ((a && realOps(a) && !a.manual) || DYN)) {
      setTimeout(() => reprio(cmid, pr0), 0);
      await fireAuto(cmid, 'pot', name, {
        auto: DYN ? undefined : a,
        quiet: true,
        manual: 1,
        ownTid: tid,
        uq: sk === 'uq' && !foe,
        pickId: foe ? m.id : TP || '',
        tsel: foe ? '' : TP || '',
        ctx: MS ? { msel: MS } : undefined,
        head: `【${LB}】 ${who} 『${name}』${ST2 ? (ST2 === 1 ? ' ①' : ' ②') : ''}${ST2 === 2 && PD ? '' : left}${tag}${tgt}`,
        img,
        eff: String(x.p.eff || '')
      });
      return;
    }
    A().sysLog(`【${LB}】 ${who} 『${name}』${left}${tag}${tgt ? '\n대상:' + tgt.replace(' →', '') : ''}`, 'battle', {
      mid: m ? m.id : '',
      img,
      eff: String(x.p.eff || '')
        .replace(/<br\s*\/?>/g, '\n')
        .slice(0, 400)
    });
  }
  async function fireOrder(tid, mid, kind, key, how) {
    const c = ctx();
    const b0 = snap(c.b),
      b = snap(b0);
    const t = b.trainers[tid];
    const m = b.mons[mid];
    if (!t || !m) return;
    let name = pName(c.b, tid, kind, key);
    const ck = (kind === 'order' ? 'order_' : 'command_') + key;
    t.orderCount = t.orderCount || {};
    const RW = how === 'free' && rinneOK(c.b, tid, key, kind); /* 턴 종료 ② 【임의】 창 — 『윤회의 법계』 · 『숙달회복지령』 */
    /* 10-26 망령 (서서 VS 마리 시험): 4식 · 6령은 한 턴에 종류별로 하나만 · 임의 발동은 원칙이 아니다 (선행 입력 → 선행 발동) */
    {
      const KN = kind === 'order' ? '4식(명령)' : '6령(지령)';
      /* 11-03 22:05 망령 「영창도 지령 자동 발동에 뜨게 — COMMAND 는 다 저기」: 한 턴 하나는 같은 무리끼리(6령은 6령 · 영창은 영창 · 4식은 4식) — 영창이 6령에 막혀 안 걸리던 것 */ const fam =
        k => {
          const n = kind === 'order' ? OO().orderName(t, k) : OO().commandName(t, k);
          const r = potRowOf(n) || potRowOf(n + '!');
          return (r && r[0]) || (/영창$/.test(n) ? '영창' : kind);
        };
      const used = Object.entries(((b.cmds || {})[tid] || {}).fired || {}).find(
        ([id, x]) => x && x[kind] && !(id === mid && x[kind] === key && how === 'pre') && fam(x[kind]) === fam(key)
      );
      {
        const why = how === 'force' ? '' : noOrdWhy(m);
        if (why) return A().toast(`⚠ ${m.name} — ${KN}을 받을 수 없다 (${why}). 꼭 써야 하면 「강제」로`);
      }
      {
        const xs = (((b.cmds || {})[tid] || {}).mons || {})[mid];
        if (how !== 'force' && how !== 'free' && xs && xs.move === 'switch')
          return A().toast(
            `⚠ ${m.name} — 교대하는 포켓몬이라 ${KN}을 선행 발동할 수 없다 (숙달 지령 ② 의 【임의】는 그때 필드의 포켓몬에게 · 꼭 써야 하면 「강제」로)`
          );
      } /* 11-15 14:16 망령 */ /* 10-26 망령: 행동불능(반동) · 난동 · 반무적 · 올드 타입은 발동 때도 막는다 (지시 창 경고만으로는 선행 발동이 그대로 나갔다) */
      if (used && how !== 'force' && !RW) {
        const um = b.mons[used[0]];
        return A().toast(
          `${KN}은 한 턴에 하나만 — 이번 턴에 이미 『${kind === 'order' ? OO().orderName(t, used[1][kind]) : OO().commandName(t, used[1][kind])}』(${um ? um.name : '?'})를 썼다`
        );
      }
      const MT = {
        공격: '아군의 명중굴림 전',
        특공: '아군의 명중굴림 전',
        저격: '아군의 명중굴림 전',
        방어: '상대의 명중굴림 전',
        특방: '상대의 명중굴림 전',
        회피: '상대의 명중굴림 전',
        민첩: '행동 순서 공개 때',
        회복: '『지령』을 쓰지 않은 턴의 종료 때'
      };
      const mm = kind === 'command' && String(name).match(/^숙달(공격|특공|저격|방어|특방|회피|민첩|회복)지령$/);
      if (RW) {
        if (
          !(await askYes(
            kind === 'order'
              ? `『윤회의 법계』 ② — 지난 턴 종료에 【임의】가 붙었다.\n「방어」 상태가 아니었던 아군 하나를 「따라가때리기」를 받지 않고 교대시킨다 (교대는 그 포켓몬의 「교대」로).\n남은 횟수 1을 써서 발동할까?`
              : `『${name}』 ② — 『지령』을 쓰지 않은 지난 턴 종료에 【임의】가 붙었다.\n${m.name} 쪽에 ① 효과를 건다. 남은 횟수 1을 써서 발동할까?`,
            '발동',
            '그만'
          ))
        )
          return;
      } else if (
        how === 'free' &&
        !(await askYes(
          mm
            ? `『${name}』 ② — ${MT[mm[1]]}에 【임의】로 쓸 수 있다.\n지금이 그때면 발동한다.`
            : `${KN}은 지시 단계에서 선행 입력한 것을 「선행 발동」으로 쓰는 게 원칙이다.\n【임의】가 붙는 조건(6령 ② 등)일 때만 임의 발동한다. 그래도 지금 임의 발동할까?`,
          mm ? '발동' : '임의 발동',
          '그만'
        ))
      )
        return;
    }
    let tag = '';
    let FBOR = '';
    let PREDED = false;
    if (how === 'pre') {
      tag = '【선행】';
      /* 11-04 19:16 망령 「치유의 법계가 이번에도 사용 횟수가 줄지 않았다 — 자동 처리로 하면 횟수가 안 빠지나?」: 선행 발동은 「턴 개시에 깎았다」고 믿고 횟수를 안 건드렸는데,
      턴 개시 차감이 이 지시를 못 읽은 채(지시 행이 없음 · 다른 턴 표시 · 새로고침) 「이번 턴 깎음」으로 적히면 공짜로 걸렸다(시노사와 유이 『치유의 법계』 5턴 — 1 그대로).
      → 이번 턴 차감 목록(pcList)에 이 지시가 없으면 여기서 1 깎고 적는다. 아직 턴 개시 차감 전이면 preSpent 에 적어 두어 나중 차감(chargeOne)이 두 번 깎지 않게 한다 */
      const tk = turnKey(c.b),
        ok = kind === 'order' ? 'o' : 'c';
      const pcK = t.pcTurn === tk;
      const had = pcK && ((t.pcList || {})[mid] || {})[ok] === key;
      const ps = t.preSpent && t.preSpent.k === tk ? t.preSpent : null;
      const spent = !!ps && ((ps.m || {})[mid] || {})[ok] === key;
      if (!had && !spent) {
        const lend = pLend(c.b, tid, ck);
        if ((+t.orderCount[ck] || 0) <= 0 && !lend)
          return A().toast(`『${name}』 — 남은 횟수가 없다 (이번 턴 몫이 아직 안 깎였는데 남은 것도 없다 · 꼭 써야 하면 GM 「강제」)`);
        if (lend) FBOR = ck;
        else {
          PREDED = true;
          t.orderCount[ck] = (+t.orderCount[ck] || 0) - 1;
          const sk = kind === 'command' ? OO().shareKey(t, key) : '';
          if (sk) t.orderCount['command_' + sk] = Math.max(0, (+t.orderCount['command_' + sk] || 0) - 1);
        }
        const one = o => Object.assign({ o: '', c: '' }, o || {}, { [ok]: key });
        if (pcK) t.pcList = Object.assign({}, t.pcList || {}, { [mid]: one((t.pcList || {})[mid]) });
        else {
          const m2 = Object.assign({}, (ps && ps.m) || {});
          m2[mid] = one(m2[mid]);
          t.preSpent = { k: tk, m: m2 };
        }
      }
    } else if (how === 'free') {
      const lend = pLend(c.b, tid, ck);
      if ((+t.orderCount[ck] || 0) <= 0 && !lend) return A().toast('남은 횟수가 없어 임의 발동할 수 없다');
      if (lend) FBOR = ck;
      else {
        t.orderCount[ck] = (+t.orderCount[ck] || 0) - 1;
        {
          const sk = kind === 'command' ? OO().shareKey(t, key) : '';
          const o = sk ? 'command_' + sk : '';
          if (o) t.orderCount[o] = Math.max(0, (+t.orderCount[o] || 0) - 1);
        }
      }
      tag = (FBOR ? '【임의 · 일행 몫】' : '【임의】') + (RW ? ' ② 턴 종료' : '');
    } else if (how === 'force') {
      if (!c.gm) return;
      tag = '【강제】';
    }
    /* 11-14 망령 「커맨드 미션류 자동화」: 『지령』을 다른 『지령』으로 · 『지령』의 효과를 【…】로 바꾼다 (cmdChange) — 횟수는 원래 지령 몫으로 이미 깎였다 */
    const CH = kind === 'command' ? await cmdChange(b, t, mid, name) : null;
    const SKIP = new Set(CH ? CH.chg : []);
    if (CH && CH.to) name = CH.to;
    /* 11-04 20:41 망령: 『변환술』(【보급】/『지령(영창)』으로 상승하는 능력치를 임의로 변경할 수 있다) — 능력 지령 · 영창을 받는 포켓몬이 들고 있으면 올릴 능력치를 고른다 (주인 화면에 묻는다) */
    const CONV = [];
    {
      const sm = kind === 'command' && String(name).match(/^(숙달)?(공격|방어|특공|특방|민첩|저격|회피)지령$/),
        cm = kind === 'command' && String(name).match(/^(검|방패|관|잔|날개|촛불|장막)의 영창$/);
      if (sm || cm) {
        const base = sm
          ? STATWORD[sm[2]]
          : { 검: 'attack', 방패: 'defense', 관: 'specialattack', 잔: 'specialdefense', 날개: 'speed', 촛불: 'accuracy', 장막: 'evasion' }[cm[1]];
        const tg = sm ? [b.mons[mid]] : Object.values(b.mons).filter(x => sameT(x, t) && x.entry && x.hp.cur > 0);
        const KS = ['attack', 'defense', 'specialattack', 'specialdefense', 'speed', 'accuracy', 'evasion'];
        const ord = [base, ...KS.filter(k => k !== base)];
        for (const x of tg) {
          if (
            !x ||
            SKIP.has(x.id) ||
            !potSrc(x).some(
              p =>
                p &&
                String(p.name || '')
                  .replace(/[『』]/g, '')
                  .trim() === '변환술'
            )
          )
            continue;
          {
            const cp = potSrc(x).find(
              p =>
                p &&
                String(p.name || '')
                  .replace(/[『』]/g, '')
                  .trim() === '변환술'
            );
            if (((x.potTurn || {})._sup || {})[cp.name]) continue;
          }
          /* 11-11 【보급】: 이번 등장에 이미 바꿨으면 묻지 않는다 */ const r = await uiCtx(b, x, '변환술').choose(
            ord.map((k, i) => STAT_KO[k] + ' +1' + (i === 0 ? ' (그대로)' : ''))
          );
          const k2 = ord[Array.isArray(r) && r.length ? +r[0] : 0];
          if (k2 && k2 !== base) {
            CONV.push({ id: x.id, from: base, to: k2 });
            const cp = potSrc(x).find(
              p =>
                p &&
                String(p.name || '')
                  .replace(/[『』]/g, '')
                  .trim() === '변환술'
            );
            await A().set(['battle', 'mons', x.id, 'potTurn', '_sup', cp.name], 1);
          }
        }
      }
    }
    const f = fieldOf(b);
    const fx =
      CH && CH.all
        ? []
        : applyOrder(
            SKIP.size ? Object.fromEntries(Object.entries(b.mons).filter(([k]) => !SKIP.has(k))) : b.mons,
            f,
            t,
            name,
            mid
          ); /* 바뀐 포켓몬은 원래 효과에서 뺀다 */
    for (const cv of CONV) {
      const x = b.mons[cv.id];
      if (!x) continue;
      tempRank(x, cv.from, -1);
      tempRank(x, cv.to, 1);
      fx.push(`${x.name} 『변환술』 — ${STAT_KO[cv.from]} 대신 ${STAT_KO[cv.to]} +1`);
    }
    if (!fx.length && !(CH && CH.all) && FX()) {
      const a = FX().rm(name) || FX().rm(String(name).replace(/\s*[:：]\s*/, ' / '));
      if (a && a.ops && a.ops.length && !a.manual) {
        const r = await FX().run(a.ops, uiCtx(b, m, name, m.entry));
        fx.push(...r.lines);
      }
    }
    if (!fx.length && !(CH && CH.all))
      fx.push(
        RW && kind === 'order' ? `「윤회의 법계」 ② — 아군 하나를 「따라가때리기」 없이 임의 교대 (교대는 손으로)` : `「${name}」 — 손으로 처리`
      );
    if (CH && CH.lines.length) fx.unshift(...CH.lines);
    A().closeModal();
    /* 11-05: 창을 띄워 둔 사이 턴 개시 차감이 이 지시를 이미 깎았으면(지금 서버 값의 pcList) 선행 발동 몫은 되돌린다 — 두 번 깎지 않게 */
    if (PREDED) {
      const tf = ((ctx().b || {}).trainers || {})[tid] || {};
      const tk2 = turnKey(ctx().b),
        ok2 = kind === 'order' ? 'o' : 'c';
      if (tf.pcTurn === tk2 && ((tf.pcList || {})[mid] || {})[ok2] === key && !(b0.trainers[tid].pcTurn === tk2)) {
        t.orderCount[ck] = (+t.orderCount[ck] || 0) + 1;
        const sk = kind === 'command' ? OO().shareKey(t, key) : '';
        if (sk) t.orderCount['command_' + sk] = (+t.orderCount['command_' + sk] || 0) + 1;
        const o0 = b0.trainers[tid] || {};
        for (const kk of ['pcList', 'pcTurn', 'preSpent']) {
          if (o0[kk] === undefined) delete t[kk];
          else t[kk] = snap(o0[kk]);
        }
      }
    }
    const okT = await saveTr(tid, b0.trainers[tid], t);
    if (!okT) return;
    if (FBOR) await pBorrowSave(tid, [FBOR]);
    if (String(((A().ST.state.rp || {}).cutin || {}).ord) !== '0')
      cutFire('t:' + tid, trainerImg(t), `${t.name}의 지시!`, `『${name}』`, t.side === 'left' ? '#1f6fd1' : '#e3101f');
    b.trainers[tid] = b0.trainers[tid];
    await saveBattle(b0, b, f, { n: t.name, s: name, img: trainerImg(t) });
    if (RW) await A().set(['battle', 'rinne', 't', tid], null);
    else await A().set(['battle', 'cmds', tid, 'fired', mid, kind], key); /* ② 는 지난 턴 몫 — 이번 턴 「한 턴 하나」에 세지 않는다 */
    /* 11-03 21:54 망령 「4식이나 지령 발동할 때 효과도 UI 에 넣어서 나와야지」: 레디메이드 글이 비어 있으면 제작기 포텐셜 표(4식 · 6령 · 5계 · 영창 …)의 효과 글 */
    const oeff =
      (FX() && FX().rm && (FX().rm(name) || {}).text) ||
      (potRowOf(name) || potRowOf(String(name).replace(/[!！]$/, '')) || [])[2] ||
      (potRowOf(name + '!') || [])[2] ||
      '';
    A().sysLog(
      `【${kind === 'order' ? '명령' : '지령'}】 ${t.name}의 지시! 『${name}』 → ${m.name} (에리어 ${String(m.entry).toUpperCase()}) 【${Math.max(0, +t.orderCount[ck] || 0)}/시】${tag}${fx.length ? '\n' + fx.join('\n') : ''}`,
      'battle',
      {
        mid: m.id,
        img: trainerImg(t),
        eff: String(oeff)
          .replace(/<br\s*\/?>/g, '\n')
          .slice(0, 400)
      }
    );
    setTimeout(() => rcvReact(tid, mid, kind, name).catch(e => console.warn('rcvReact', e)), 500); /* 11-09 「지령 · 4식을 받았을 때」 계기 */
    {
      const fr = (potRowOf(name) || potRowOf(String(name).replace(/[!！]$/, '')) || [])[0] || '';
      const ev2 =
        kind === 'order' && (fr === '5계' || /결계$/.test(name))
          ? 'barrier'
          : kind === 'command' && (fr === '영창' || /영창$/.test(name))
            ? 'chant'
            : '';
      if (ev2) setTimeout(() => rcvReact(tid, mid, ev2, name).catch(e => console.warn('rcvReact', e)), 900);
    }
  } /* 11-18 「『결계』 · 『영창』이 발동했을 때」 계기 */
  /* 【사전】 태그: 지시 준비(페이즈 0)에도 쓸 수 있다 — 효과 글은 레디메이드 · 제작기 포텐셜 표에서 */
  function preTag(name) {
    const t = ((FX() && FX().rm && FX().rm(name)) || {}).text || (((DB().maker || {}).pots || []).find(r => r[1] === name) || [])[2] || '';
    return /【\s*사전\s*】/.test(String(t));
  }
  /* 맵툴 open_command 처럼 에리어(포켓몬) 하나씩 공개한다. 좌석은 자기 것만, GM 은 아무 것이나 */
  function revealed(b, tid, part) {
    const cm = (b.cmds || {})[tid] || {};
    return part === 'orders' ? !!cm.revealedOrders : !!(cm.mons || {})[part];
  }
  /* 『윤회의 법계』 ② 창: 턴 종료가 연 그 다음 턴 지시 준비(페이즈 0) 동안만 */
  const rinneOK = (b, tid, k, kind) => {
    const R = (b || {}).rinne;
    if (!R || R.turn !== turnKey(b) || (+b.phase || 0) !== 0) return false;
    const x = (R.t || {})[tid];
    if (x == null) return false;
    if (typeof x === 'string') return (kind || 'order') === 'order' && x === k;
    return x[(kind || 'order') === 'order' ? 'o' : 'c'] === k;
  }; /* 11-04 19:27: 숙달회복지령 ② 도 (c) */
  const cmdFresh = (r, b) => {
    const d = r && r.data;
    return !!d && (d.turn == null || (+d.turn || 1) === (+(b || ctx().b).turn || 1));
  };
  async function myCmd(c, tid, quiet) {
    let rows;
    try {
      rows = await DBS().secretGet(c.ST.room, c.ST.secret, 'cmd');
    } catch (e) {
      if (!quiet) A().toast('지시를 읽지 못했다: ' + e.message);
      return null;
    }
    const r = (rows || []).filter(x => cmdFresh(x, c.b)).find(x => x.id === tid);
    if (!r) {
      if (!quiet) A().toast('저장된 지시가 없다 — 먼저 「저장」');
      return null;
    }
    return r.data;
  }
  function revealCardText(b, t, m, x) {
    if (x.move === 'switch')
      return `${t.name} · ${m.name} (${slotName(b, m.side + '_' + m.entry).replace(/<[^>]+>/g, '')}): 「교대」 → ${monName(b, x.switch)}`;
    if (x.move === '' || x.move == null) return `${t.name} · ${m.name}: (행동 없음)`;
    const mv = MVS(m)[+x.move] || {};
    const thr =
      (m.states || {}).Thrash &&
      !x.tman &&
      mv.cat !== '변화' &&
      !/전체|적진|자진|자신/.test(String(mv.range || '')); /* 10-26: 난동부리기면 대상은 공격할 때 랜덤 */
    return `${t.name} · ${m.name} (${SIDE_KO[m.side]} ${String(m.entry).toUpperCase()}): 「${mv.name || '?'}」 ${mv.type || ''}·${mv.cat || ''} · 위력 ${mv.pow || '-'} · 명중 ${mv.acc || '-'}${mv.range && mv.range !== '-' ? ' · 범위 ' + mv.range : ''}${A().contactOf(mv) === 'O' ? ' · 접촉' : ''}${mv.prio ? ' · 우선도 ' + mv.prio : ''}${
      thr
        ? ' → 적진에서 랜덤 (「난동부리기」)'
        : x.targets && x.targets.length
          ? ' → ' +
            tgNow(b, x, m)
              .map(sl => slotName(b, sl).replace(/<[^>]+>/g, ''))
              .join(', ')
          : ''
    }${mv.eff && mv.eff !== '-' ? '\n   ' + mv.eff : ''}`;
  }
  /* 공개 카드 그림용 (10-24 망령): 누가 · 무엇을 · 누구에게 — 로그가 그림 칩으로 그린다 */
  function revealData(b, t, m, x) {
    const at = sl => {
      const [s, a] = String(sl).split('_');
      const q = Object.values(b.mons || {}).find(q => q.side === s && q.entry === a && q.hp && q.hp.cur > 0);
      return { slot: sl, side: s, area: String(a || '').toUpperCase(), name: q ? q.name : '', img: q ? q.image || '' : '', mid: q ? q.id : '' };
    };
    const o = { tr: t.name || '', mid: m.id, name: m.name, img: m.image || '', side: m.side, area: String(m.entry || '').toUpperCase() };
    if (x.move === 'switch') {
      const w = (b.mons || {})[x.switch] || {};
      return Object.assign(o, { sw: { name: w.name || monName(b, x.switch) || '', img: w.image || '' } });
    }
    if (x.move === '' || x.move == null) return Object.assign(o, { none: 1 });
    const mv = MVS(m)[+x.move] || {};
    return Object.assign(o, {
      mv: {
        name: mv.name || '?',
        type: mv.typeEn || '',
        typeKo: mv.type || '',
        cat: mv.cat || '',
        pow: mv.pow || '-',
        acc: mv.acc || '-',
        prio: +mv.prio || 0,
        range: mv.range || '',
        ct: A().contactOf(mv) === 'O' ? 1 : 0
      },
      tg: tgNow(b, x, m).map(at)
    });
  } /* 11-18 PL 제보 「범위가 접촉 여부보다 중요한데 안 나온다」: 공개 카드에 범위 · 접촉 */
  let autoT = null;
  function autoAdvance() {
    const c = ctx();
    const b = c.b;
    if (!c.mgr) return;
    const me = c.gm ? 'gm' : c.seat;
    if ((b.host || 'gm') !== me) return;
    if (me === 'gm' && !isLeader(c)) return;
    /* 10-27: GM 창 여럿이면 리더 하나만 */ if ((+b.phase || 0) !== 1 || b.tstep) return;
    if (unrevealed(b).length) return;
    clearTimeout(autoT);
    autoT = setTimeout(async () => {
      const c2 = ctx();
      if ((+c2.b.phase || 0) !== 1 || c2.b.tstep || unrevealed(c2.b).length) return;
      A().sysLog('지시가 모두 공개됐다', 'battle');
      await stepTurn();
    }, 800);
  }
  /* 같은 포켓몬 공개가 여러 길(자동 공개 · 내 차례 공개 · 버튼)로 겹쳐 들어오면 로그가 두 번 찍혔다 (10-24 망령) — 진행 중이면 무시하고, 기다린 뒤 다시 확인 */
  const RVING = new Set();
  async function revealOne(tid, part, quiet) {
    const rk = tid + ':' + part + ':' + (+ctx().b.turn || 0);
    if (RVING.has(rk)) return;
    RVING.add(rk);
    try {
      return await revealOne0(tid, part, quiet);
    } finally {
      setTimeout(() => RVING.delete(rk), 1500);
    }
  }
  async function revealOne0(tid, part, quiet) {
    const c = ctx();
    const b = c.b;
    const t = (b.trainers || {})[tid];
    if (!t) return;
    if (!c.gm && !ownT(c, tid)) return A().toast('내 지시만 공개할 수 있다');
    if (fairOff(c, tid))
      return A().toast(
        seatOwned(c, tid) ? 'GM 불간섭 설정 — 플레이어의 지시는 그 플레이어가 연다' : 'PL 권한 중 — 다른 GM 이 불러온 트레이너의 지시는 그 GM 이 연다'
      );
    const cm = await myCmd(c, tid, quiet);
    if (!cm) return;
    const m = b.mons[part];
    if (!m) return;
    if (revealed(b, tid, part) || revealed(ctx().b, tid, part)) return;
    const x = pubMon((cm.mons || {})[part]);
    {
      const cur = (ctx().b.cmds || {})[tid];
      if (!cur) await A().set(['battle', 'cmds', tid], { mons: { [part]: x } });
      else if (!cur.mons) await A().set(['battle', 'cmds', tid, 'mons'], { [part]: x });
      else await A().set(['battle', 'cmds', tid, 'mons', part], x);
    }
    if (cm.detail && !((b.cmds || {})[tid] || {}).detail) await A().set(['battle', 'cmds', tid, 'detail'], cm.detail);
    A().sysLog('【공개】 ' + revealCardText(b, t, m, x), 'battle', { rv: [revealData(b, t, m, x)] });
  }
  async function reveal(npcOnly) {
    const c = ctx();
    if (!c.gm) return;
    const b = c.b;
    npcOnly = npcOnly || c.fair;
    let rows;
    try {
      rows = await DBS().secretGet(c.ST.room, c.ST.secret, 'cmd');
    } catch (e) {
      return A().toast('지시를 읽지 못했다: ' + e.message);
    }
    const cmds = {};
    (rows || []).forEach(r => {
      if ((b.trainers || {})[r.id] && cmdFresh(r, b) && !(npcOnly && seatOwned(c, r.id))) cmds[r.id] = r.data;
    });
    if (!Object.keys(cmds).length) {
      if (!npcOnly) A().toast('저장된 지시가 없다');
      return;
    }
    const already = b.cmds || {};
    const out = {};
    if (npcOnly) for (const tid in already) if (seatOwned(c, tid)) out[tid] = already[tid];
    for (const tid in cmds) {
      const cm = cmds[tid];
      const al = already[tid] || {};
      const o = { mons: {}, detail: cm.detail || '', fired: al.fired || {} };
      for (const mid in cm.mons || {}) {
        const m = b.mons[mid];
        if (!m || !m.entry) continue;
        o.mons[mid] = al.mons && al.mons[mid] ? al.mons[mid] : pubMon(cm.mons[mid]);
      }
      out[tid] = o;
    }
    await A().set(['battle', 'cmds'], out);
    await A().set(['battle', 'phase'], Math.max(1, +b.phase || 0));
    const lines = [],
      rvs = [];
    for (const tid in out) {
      if (!cmds[tid]) continue;
      const t = b.trainers[tid];
      const cm = out[tid];
      for (const mid in cm.mons) {
        const m = b.mons[mid];
        if (!m || !m.entry) continue;
        if (already[tid] && already[tid].mons && already[tid].mons[mid]) continue;
        lines.push(revealCardText(b, t, m, cm.mons[mid]));
        rvs.push(revealData(b, t, m, cm.mons[mid]));
      }
      if (cm.detail) lines.push(`${t.name}: ${cm.detail}`);
    }
    if (lines.length) A().sysLog('【모두 공개】\n' + lines.join('\n'), 'battle', { rv: rvs });
  }

  /* 지령·명령 효과 (Lib:readymade 의 지령 레디메이드와 같은 내용). 랭크는 임시(턴 종료 해제). 플래그는 flags 에 두고 공격 창이 읽는다 */
  const STATWORD = {
    공격: 'attack',
    방어: 'defense',
    특공: 'specialattack',
    특방: 'specialdefense',
    민첩: 'speed',
    저격: 'accuracy',
    회피: 'evasion',
    스피드: 'speed',
    명중: 'accuracy'
  };
  /* 11-14 망령 「『지령』을 임의로 변경하는 효과랑 『지령』의 효과 자체를 변경하는 계통 — 커맨드 미션류 자동화」
    ① 「(자신에 대한) 『지령』을 임의의 『지령』으로 · 『방어 지령』을 『방패의 영창』으로 변경할 수 있다」(『커맨드 미션』 · 카렌 전용): 받는 포켓몬 주인에게 묻고, 고른 지령을 대신 건다
    ② 「이번 턴 (「타입 : X」인 아군이 받는) 『지령』의 효과를 【…】로 변경한다」(나하루 · 킴블리 고유): 발동하면 이번 턴 표(battle.cmdChg) — 그 턴 받는 포켓몬이 맞으면 원래 효과 대신 【…】 (묻지 않음)
    ③ 「자신이 받은 『지령』의 효과를 【…】로 변경할 수 있다」(『회복술』): 받을 때 묻는다 (【보급】 · 【N/시】 셈)
    【…】 = 그 포텐셜의 시트 구문 → 레디메이드 → 제작기 구문 추천기(MKM_POTLINT)로 【…】 글 풀이 → 그래도 없으면 「손으로」.
    【준비】 줄(카렌 전용 「『방어 지령』을 『방패의 영창』으로」)은 시합 준비 때 세팅을 바꾸는 것 — 여기서 묻지 않는다 (망령 11-14) */
  const CHG_RE = /『지령』(?:\s*『성언』)?의\s*효과를\s*【\s*([\s\S]+?)\s*】\s*로\s*변경/;
  const TOC_RE = /(자신에\s*대한\s*『지령』|『([^』]+)』)\s*을\s*(?:(임의의\s*『지령』)|『([^』]+)』)\s*(?:으로|로)\s*변경할\s*수\s*있다/;
  function chgOps(h) {
    let a = null;
    if (FX()) {
      if (h.sk === 'uq') a = FX().autoOf({ tid: h.tid }, 'pot', h.p.name);
      else if (h.own) a = FX().autoOf(h.own, 'pot', h.p.name);
    }
    if (a && realOps(a) && !a.manual) return a.ops;
    /* 11-14 망령 「구문 추천기로 연동」: 시트 구문 · 레디메이드가 없으면 【…】 안의 글을 제작기 구문 추천기(MKM_POTLINT.suggest)로 풀어 건다 */
    const PL = window.MKM_POTLINT;
    if (PL && PL.suggest && FX() && FX().parse) {
      try {
        const sg = PL.suggest(String(h.p.eff || ''));
        const ls = ((sg && sg.chg && sg.lines) || []).filter(Boolean);
        if (ls.length) {
          const r = FX().parse(ls.join('\n'));
          if (r.ops && r.ops.length && !(r.errs || []).length && !r.ops.some(o => o && o.k === '?')) return r.ops;
        }
      } catch (e) {
        console.warn('chgOps', e);
      }
    }
    return null;
  }
  function chgWho(e, m, x, own) {
    const pre = e.slice(0, m.index);
    const w = pre.slice(pre.lastIndexOf('/') + 1);
    const ty = w.match(/「\s*타입\s*[:：]\s*([^」]+)」/);
    if (ty) {
      const ko = (x.types || []).filter(q => q && q !== '-').map(q => (S().typeKo ? S().typeKo(q) : q));
      if (!ty[1].split(/[·,/]/).some(s => ko.includes(s.trim()))) return false;
    }
    if (/자신이\s*받/.test(w) && own && own.id !== x.id) return false;
    return true;
  }
  function allCmdNames(t) {
    const own = (OO() && OO().commandNames ? OO().commandNames(t) : []).filter(Boolean);
    const all = (OO() && OO().allCommandNames ? OO().allCommandNames() : []).filter(Boolean);
    return [...own, ...all.filter(n => !own.includes(n))];
  }
  async function cmdChange(b, t, mid, name) {
    const out = { to: '', chg: [], lines: [], all: false };
    const nm = s => String(s || '').replace(/[『』\s]/g, '');
    const pn = p =>
      String(p.name || '')
        .replace(/[『』]/g, '')
        .trim();
    const recv = n =>
      /의\s*영창$/.test(n)
        ? Object.values(b.mons || {}).filter(x => x && sameT(x, t) && x.entry && x.hp && x.hp.cur > 0)
        : /^방해|결계$/.test(n)
          ? []
          : [(b.mons || {})[mid]].filter(Boolean);
    const limOk = (x, p) => {
      const L = limOf(p, x.potUses || {}, x.potTurn || {});
      return L.left == null || L.left > 0;
    };
    const spend = async (x, p) => {
      const L = limOf(p, x.potUses || {}, x.potTurn || {});
      if (L.mmax != null) {
        const u = (x.potUses || {})[p.name];
        const had = u == null ? L.mmax : +u;
        await A().set(['battle', 'mons', x.id, 'potUses', p.name], Math.max(0, had - 1));
        x.potUses = Object.assign({}, x.potUses || {}, { [p.name]: Math.max(0, had - 1) });
      }
      await potMark(x.id, p.name);
      if (/【\s*보급\s*】/.test(String(p.eff || ''))) {
        x.potTurn = x.potTurn || {};
        x.potTurn._sup = Object.assign({}, x.potTurn._sup || {}, { [p.name]: 1 });
      }
    };
    const ask = async (x, p, labels) => {
      const r = await uiCtx(b, x, pn(p)).choose(labels);
      return Array.isArray(r) && r.length ? +r[0] : 0;
    };
    /* ① 지령 → 다른 지령 (한 포켓몬에게 거는 지령만 — 영창 · 방해 · 결계는 「자신에 대한」이 아니다) */
    {
      const R0 = recv(name);
      const x = R0.length === 1 && R0[0].id === mid && !/의\s*영창$/.test(name) ? R0[0] : null;
      if (x)
        for (const p of potSrc(x)) {
          const e = String(p.eff || '');
          const m = e.match(TOC_RE);
          if (!m || /【\s*준비\s*】/.test(e)) continue;
          const from = m[2] && nm(m[2]) !== '지령' ? nm(m[2]) : '';
          if (from && from !== nm(name)) continue;
          if (!limOk(x, p)) continue;
          const opts = m[4] ? [m[4].trim()] : allCmdNames(t).filter(n => nm(n) !== nm(name));
          if (!opts.length) continue;
          const i = await ask(x, p, [`그대로 『${name}』`, ...opts.map(n => `→ 『${n}』`)]);
          if (!i) continue;
          const to = opts[i - 1];
          await spend(x, p);
          out.lines.push(`${x.name} 『${pn(p)}』 — 『${name}』 → 『${to}』`);
          out.to = to;
          name = to;
          break;
        }
    }
    /* ② · ③ 지령의 효과 → 【…】 */
    const T = +b.turn || 0;
    const act = Object.values(b.cmdChg || {}).filter(r => r && +r.turn === T && r.side === t.side);
    const R = recv(name);
    for (const x of R) {
      let hit = null;
      for (const r of act) {
        const tr = (b.trainers || {})[r.tid];
        let p = null,
          own = null;
        if (r.sk === 'uq') p = ((tr && tr.unique) || []).find(u => u && u.name === r.name);
        else {
          own = (b.mons || {})[r.mid];
          p = own && potSrc(own).find(q => q && q.name === r.name);
        }
        if (!p) continue;
        const e = String(p.eff || '');
        const m = e.match(CHG_RE);
        if (!m || !chgWho(e, m, x, own)) continue;
        hit = { p, own, tid: r.tid, sk: r.sk, X: m[1] };
        break;
      }
      if (!hit)
        for (const p of potSrc(x)) {
          const e = String(p.eff || '');
          const m = e.match(CHG_RE);
          if (!m || /이번\s*턴/.test(e) || !/로\s*변경할\s*수\s*있다/.test(e) || !chgWho(e, m, x, x)) continue;
          if (!limOk(x, p)) continue;
          const i = await ask(x, p, [`그대로 『${name}』`, `대신 【${m[1]}】`]);
          if (!i) continue;
          await spend(x, p);
          hit = { p, own: x, tid: x.tid, sk: 'pot', X: m[1] };
          break;
        }
      if (!hit) continue;
      out.chg.push(x.id);
      const ops = chgOps(hit);
      const head = `${x.name} — 『${name}』의 효과 대신 【${hit.X}】 (『${pn(hit.p)}』)`;
      if (ops && FX()) {
        let rr = null;
        try {
          rr = await FX().run(ops, uiCtx(b, x, pn(hit.p), x.entry));
        } catch (e) {
          console.warn('cmdChange', e);
        }
        out.lines.push(head, ...((rr && rr.lines) || []).map(l => '  ' + l));
      } else out.lines.push(head + ' — 효과는 손으로');
    }
    out.all = R.length > 0 && out.chg.length === R.length;
    return out;
  }
  /* 11-23 21:32 망령 「(손으로 고친 랭크 · 지령 · 영창에도 변린이) 걸려야 돼」: 포텐셜 글 「「능력」이 상승하는 대신 「특성 : X」이 된다」(fx rkToAb) — 오를 차례면 올리지 않고 특성을 바꾼 뒤 알림 글을 돌려준다 */
  function rkAbSwap(m, k) {
    try {
      const F = FX();
      if (!F || !F.rkToAb || !F.setAb || !m) return '';
      const sw = F.rkToAb(m, k);
      if (!sw) return '';
      F.setAb(m, sw.ab, sw.nm);
      return `${m.name} 『${sw.nm}』 — 「${STAT_KO[k] || k}」이(가) 오르는 대신 「특성 : ${sw.ab}」이(가) 되었다`;
    } catch (e) {
      return '';
    }
  }
  function tempRank(m, k, d, rx) {
    if (rx && FX() && FX().rkRedir) k = FX().rkRedir(m, k, d);
    if (d > 0) {
      const sw = rkAbSwap(m, k);
      if (sw) return sw;
    }
    /* 11-10 랭크전환: 지령 · 영창 (변환술 되돌리기는 rx 없이) */ m.rank = m.rank || {};
    m.tempRank = m.tempRank || {};
    const lim = k === 'critical' ? 4 : 6;
    const b0 = +m.rank[k] || 0;
    const a = Math.max(-lim, Math.min(lim, b0 + d));
    m.rank[k] = a;
    m.tempRank[k] = (+m.tempRank[k] || 0) + (a - b0);
  } /* 한계(±6)에 막힌 만큼은 기록하지 않는다 — 턴 종료 해제 때 랭크가 깎이지 않게 */
  function applyOrder(mons, f, t, name, targetId) {
    const out = [];
    const tgt = mons[targetId];
    const allies = Object.values(mons).filter(m => sameT(m, t) && m.entry && m.hp.cur > 0);
    const enemies = Object.values(mons).filter(m => !sameT(m, t) && m.entry && m.hp.cur > 0);
    const n = String(name || '');
    let m;
    if ((m = n.match(/^(숙달|전개|방해)?(공격|방어|특공|특방|민첩|회복|저격|회피)지령$/))) {
      const pre = m[1] || '',
        st = m[2];
      if (st === '회복') {
        if (pre === '방해') {
          for (const e of enemies) {
            e.states = e.states || {};
            if (!e.states.HealBlock) e.states.HealBlock = 1;
          }
          out.push(`상대 전체 「회복봉인」 (턴 종료까지)${enemies.length ? '' : ' — 대상 없음'}`);
          return out;
        }
        if (tgt) {
          const v = Math.max(1, Math.floor(tgt.hp.max / 4));
          tgt.hp.cur = Math.min(tgt.hp.max, tgt.hp.cur + v);
          out.push(`${tgt.name} HP +${v}`);
        }
        return out;
      }
      const k = STATWORD[st];
      if (pre === '방해') {
        for (const e of enemies) {
          e.rank = e.rank || {};
          const k1 = FX() && FX().rkRedir ? FX().rkRedir(e, k, -1) : k;
          e.rank[k1] = Math.max(-6, (+e.rank[k1] || 0) - 1);
        }
        out.push(`상대 전체 ${st} −1`);
        return out;
      }
      if (!tgt) return out;
      if (pre === '전개') {
        tgt.mod = tgt.mod || {};
        tgt.mod[k] = (+tgt.mod[k] || 1) * 2;
        tgt.tempMod = tgt.tempMod || {};
        tgt.tempMod[k] = (+tgt.tempMod[k] || 1) * 2;
        out.push(`${tgt.name} ${st} ×2`);
        return out;
      }
      {
        const k1 = FX() && FX().rkRedir ? FX().rkRedir(tgt, k, 1) : k;
        const sw = tempRank(tgt, k1, 1);
        out.push(sw || `${tgt.name} ${k1 !== k ? st + '→' + (STAT_KO[k1] || k1) : st} +1`);
      }
      return out;
    }
    if ((m = n.match(/^(검|방패|관|잔|날개|촛불|장막)의 영창$/))) {
      const k = { 검: 'attack', 방패: 'defense', 관: 'specialattack', 잔: 'specialdefense', 날개: 'speed', 촛불: 'accuracy', 장막: 'evasion' }[m[1]];
      const SW = [];
      for (const a of allies) {
        const sw = tempRank(a, k, 1, 1);
        if (sw) SW.push(sw);
      }
      out.push(`아군 전체 ${STAT_KO[k]} +1`, ...SW);
      return out;
    }
    if (n === '물리결계' || n === '특수결계') {
      f.objects[t.side] = f.objects[t.side] || {};
      f.objects[t.side][n === '물리결계' ? '리플렉터' : '빛의장막'] = 3;
      out.push(`${SIDE_KO[t.side]} ${n === '물리결계' ? '리플렉터' : '빛의장막'} 3T`);
      return out;
    }
    if (n === '치유의 법계') {
      for (const a of allies) {
        const v = Math.max(1, Math.floor(a.hp.max / 4));
        a.hp.cur = Math.min(a.hp.max, a.hp.cur + v);
      }
      out.push('아군 전체 HP 1/4 회복');
      return out;
    }
    if (n === '정화의 법계') {
      const db = (DB().states || {}).st || {};
      let c = 0;
      for (const a of allies) {
        for (const k in a.states || {}) {
          if (db[k] && db[k].neg) {
            delete a.states[k];
            c++;
          }
        }
      }
      out.push(`아군 상태 이상 ${c}개 해제`);
      return out;
    }
    if (/^주인의 호령\s*[:：]\s*회복$/.test(n)) {
      if (!tgt) {
        out.push('「주인의 호령 : 회복」 (대상 없음)');
        return out;
      }
      const v = Math.max(1, Math.floor(tgt.hp.max / 3));
      const nh0 = NOHEAL(tgt, 'heal');
      const h = nh0 || (tgt.states || {}).HealBlock ? 0 : Math.min(v, tgt.hp.max - tgt.hp.cur);
      if (nh0) out.push(`${tgt.name} ${nh0} — 회복이 발동하지 않는다`);
      tgt.hp.cur += h;
      const cured = [];
      for (const k of ['Poison', 'Toxic', 'Burn', 'Paralysis', 'Freeze', 'Sleep'])
        if ((tgt.states || {})[k]) {
          delete tgt.states[k];
          cured.push(k);
        }
      out.push(`${tgt.name} HP +${h} (1/3)${cured.length ? ` · 상태 이상 ${cured.length}개 치유` : ''}`);
      return out;
    } /* 「능력」(강화 1.5배)은 레디메이드 「주인의 호령 / 능력」이 돈다 */
    /* 4식: 플래그 */
    const FLAG = {
      '버텨라!': 'endure',
      '맞춰라!': 'surehit',
      '물러나!': 'dodgePhys',
      '피해라!': 'dodgeSpec',
      '바꿔라!': 'swap',
      '돌아와!': 'return',
      '지킬 수 없다!': 'hitPhys',
      '피할 수 없다!': 'hitSpec',
      '버틸 수 없다!': 'noEndure',
      '맞출 수 없다!': 'acc0',
      '주인의 칙령': 'dodgeOnce',
      '파계': 'nullify',
      '윤회의 법계': 'rebirth'
    };
    if (FLAG[n]) {
      if (tgt) {
        tgt.flags = tgt.flags || {};
        tgt.flags[FLAG[n]] = 1;
        out.push(`${tgt.name} 「${n}」`);
      } else out.push(`「${n}」 (대상 없음)`);
      return out;
    }
    return out;
  } /* 여기서 모르는 지시는 fireOrder 가 레디메이드를 찾아 보고, 그래도 없으면 「손으로 처리」를 붙인다 (점검 3-3) */

  /* 따라가때리기 기술: 기술 태그·효과 글, 또는 효과 엔진이 붙인 「추격」 */
  const pursuitX2 = mv => /교대할 때 2배의 위력/.test(String((mv || {}).eff || ''));
  /* 11-22 망령 「미사그 자동화 전체 검토」 — 마리안네 『에코로케이션』 「①자신의 「소리」 기술에 「따라가때리기」 효과를 부여한다」: 특성 · 포텐셜 · 소지품 · 고유 글에 「자신의 「X」 기술에 「따라가때리기」 효과를 부여」가 있으면 X(태그 · 타입) 기술은 따라가때리기 */
  const PURS_GRANT_RE = /자신의\s*「\s*([^」]+?)\s*」\s*기술에\s*「\s*따라가때리기\s*」\s*효과를\s*부여/;
  function pursGrant(mv, m) {
    if (!m || !mv) return '';
    try {
      const tags = [...(mv.tags || []), ...String(mv.tag || '').split(/[,\s]+/)].map(x => String(x).replace(/^#/, '').trim()).filter(Boolean);
      const tko = (S().typeKo ? S().typeKo(mv.typeEn) : '') || mv.type || '';
      for (const x of trigSrcs(m, ctx().b)) {
        const mm = String(x.eff || '').match(PURS_GRANT_RE);
        if (!mm) continue;
        const k = mm[1].replace(/\s/g, '');
        if (tags.includes(k) || tko === k || String(mv.name || '') === k) return String(x.name || '').replace(/[『』]/g, '');
      }
    } catch (e) {}
    return '';
  }
  function isPursuit(mv, m) {
    if (!mv) return false;
    if (((m && m.flags) || {}).pursuit) return true;
    if (pursGrant(mv, m)) return true;
    if ((mv.tags || []).some(t => /따라가때리기/.test(t)) || /따라가때리기/.test(String(mv.tag || ''))) return true;
    return /교대할 때 2배의 위력|교대하는 대상에게 명중/.test(String(mv.eff || ''));
  }
  /* ----- 행동 순서 ----- */
  async function computeOrder() {
    const c = ctx();
    if (!c.mgr) return;
    const b = c.b;
    const f = fieldOf(b);
    const iceUsed = [];
    let SEC = {};
    try {
      const rows = await DBS().secretGet(c.ST.room, c.ST.secret, 'cmd');
      for (const r of rows || []) {
        if (!cmdFresh(r)) continue;
        const d = r.data || {};
        for (const mid in d.mons || {}) SEC[mid] = d.mons[mid];
      }
    } catch (e) {} /* 선행 입력에 묻은 추격·추격 무시 (GM 만 읽힌다) */
    const slots = allEntered(b);
    if (!slots.length) return A().toast('등장한 포켓몬이 없다');
    /* 순서 열쇠: 읽을 수 있는 비밀 지시(GM 은 전부) → 좌석이 올린 열쇠(cmds[tid].ok) → 이미 공개된 지시 */
    {
      const stale = () => {
        const bb = ctx().b;
        const tk0 = turnKey(bb);
        return [
          ...new Set(
            allEntered(bb)
              .map(x => x.mon)
              .filter(m => !SEC[m.id])
              .map(m => m.tid)
          )
        ].filter(tid => {
          const ok = ((bb.cmds || {})[tid] || {}).ok;
          return ok && ok.key === tk0 && ok.sig != null && ok.sig !== prioSig(bb, tid);
        });
      };
      for (let k = 0; k < 8 && stale().length; k++) await new Promise(r => setTimeout(r, 400));
      const st = stale();
      if (st.length)
        A().sysLog(
          `【행동 순서】 ${st.map(t => (b.trainers[t] || {}).name || t).join(' · ')} 쪽 우선도 정보가 아직 옛것일 수 있다 — 순서가 이상하면 잠시 뒤 「행동 순서」를 다시 누른다`,
          'battle'
        );
    }
    const tk = turnKey(b);
    const keyOf = m => {
      if (SEC[m.id]) return okeyOf(m, SEC[m.id]);
      const ok = ((ctx().b.cmds || {})[m.tid] || {}).ok;
      if (ok && ok.key === tk && ok.m && ok.m[m.id]) return ok.m[m.id];
      const px = (((b.cmds || {})[m.tid] || {}).mons || {})[m.id];
      return px ? okeyOf(m, px) : null;
    };
    const KEYS = {},
      miss = [];
    for (const s of slots) {
      const k = keyOf(s.mon);
      if (!k && s.mon.started) miss.push(`${(b.trainers[s.mon.tid] || {}).name || '?'} · ${s.mon.name}`);
      KEYS[s.mon.id] = k || { sw: 0, pm: {}, om: {}, pr: 0, mv: 0 };
    }
    if (
      miss.length &&
      !(await askYes(
        `아직 순서 정보가 없는 포켓몬: ${miss.join(', ')}\n(지시를 저장하지 않았거나 그 플레이어가 접속해 있지 않다)\n행동 없음으로 보고 순서를 계산할까?`
      ))
    )
      return;
    const spNotes = [];
    const entries = slots.map(s => {
      const K = KEYS[s.mon.id];
      let prioMod = +K.pr || 0;
      if (K.mv && s.mon.prioDown) {
        prioMod -= 1;
        iceUsed.push(s.mon);
      }
      {
        const ap = abPrioMod(b, s, K, KEYS, slots);
        if (ap) {
          prioMod += ap.v;
          spNotes.push(ap.note);
        }
      }
      const objs = (f.objects || {})[s.side] || {};
      const SPM = spMulOf(s.mon, f);
      if (SPM.why.length) spNotes.push(...SPM.why);
      return {
        slot: s.slot,
        mon: s.mon,
        cmd: { change: !!K.sw, priorityMap: K.pm || {}, orderMap: K.om || {} },
        prioMod,
        started: !!s.mon.started,
        scarf: HAS(s.mon, '구애스카프'),
        tailwind: (objs['순풍'] || 0) > 0,
        swamp: (objs['습원'] || 0) > 0,
        spMul: SPM.v
      };
    });
    const rows = B().turnOrder(entries, { trick: ((f.rooms || {})['트릭룸'] || 0) > 0 });
    /* 11-14 망령 「이건 또 뭔 지랄이야」(미사그 캠퍼스 TURN 5 · 오색동이): 교대 때 따라가때리기 차례를 처리하지 않고 넘어가도 「이미 행동」으로 순서에서 빠졌다 → 이번 턴에 실제로 기술을 낸 것(lastMove.turn)만 뺀다 */
    const swPur0 = (b.tstep && b.swPur) || [];
    const purDone = mid => {
      const lm = ((b.mons || {})[mid] || {}).lastMove;
      return !!(lm && +lm.turn === (+b.turn || 0));
    };
    const swPur = swPur0.filter(purDone),
      swSkip = swPur0.filter(mid => !purDone(mid));
    const order = rows
      .filter(r => !swPur.includes(r.mon.id))
      .map(r => {
        const K = KEYS[r.mon.id] || {};
        return {
          ...(!r.change && misagA1(b, r.mon) ? { noact: misagA1(b, r.mon) } : {}),
          slot: r.slot,
          mid: r.mon.id,
          name: r.mon.name,
          side: r.mon.side,
          change: r.change,
          started: r.started,
          order: r.order,
          prio: r.prio,
          speed: r.speed,
          dice: r.dice,
          move: K.pn || '',
          targets: K.tg || [],
          pursuit: !!K.pn,
          pursuitSrc: K.psrc || '',
          pcond: K.pcond || '',
          pimm: K.pimm || '',
          ut: K.ut ? 1 : 0
        };
      });
    /* 추격: 교대하는 대상을 노리면 교대보다 먼저 때린다 */
    const notes = [];
    if (((f.rooms || {})['트릭룸'] || 0) > 0) notes.push('「트릭룸」이 시공간을 뒤틀었다! (스피드 역순)');
    for (const mid of swPur) notes.push(`${(b.mons[mid] || {}).name || '?'} — 교대 때 따라가때리기로 이미 행동`);
    for (const mid of swSkip) notes.push(`${(b.mons[mid] || {}).name || '?'} — 교대 때 따라가때리기를 하지 않아 평소 차례로 행동`);
    for (const m of iceUsed) notes.push(`${m.name} 「아이스번」 — 이번 기술 우선도 −1`);
    notes.push(...spNotes);
    /* 따라가때리기: 교대하려는 대상을 노리면 그 교대 바로 앞으로 끌어당기고, 그 공격은 위력 2배 (공격 창이 pursuitHit 를 본다) */
    const purs = [];
    for (const o of order.filter(z => z.pursuit))
      for (const t of o.targets) {
        const v = order.find(z => z.slot === t && (z.change || (z.ut && order.indexOf(z) < order.indexOf(o))));
        if (!v) continue;
        if (o.pcond === 'dex' && !dexTeam(b, b.mons[v.mid], b.mons[o.mid]))
          continue; /* 11-22 해석된 상대에게만 */ /* 10-24 제보: 「유턴」으로 빠지려는 대상도 — 먼저 움직인 유턴 포켓몬이 빠지기 직전에 때린다 */
        if (v.pimm) {
          notes.push(`${v.name}의 『${v.pimm}』 — ${o.name}의 따라가때리기를 무시했다!`);
          A().sysLog(`【따라가때리기】 ${v.name} 『${v.pimm}』\n${o.name}의 따라가때리기를 무시했다! (교대는 그대로)`, 'battle', {
            mid: v.mid,
            img: (b.mons[v.mid] || {}).image || ''
          });
          continue;
        }
        const i = order.indexOf(o),
          j = order.indexOf(v);
        if (!v.change && v.ut) {
          order.splice(i, 1);
          order.splice(order.indexOf(v) + 1, 0, o);
          o.pursuitHit = v.mid;
          v.utHit = 1;
          notes.push(
            `${o.name}의 「${o.move}」 — 「유턴」으로 빠지려는 ${v.name}을(를) 교대 전에 때린다! (${v.name}은 공격 뒤 바로 교대하지 말고 기다린다)${o.pcond === 'dex' ? illuPursSpend(o.mid, o.pursuitSrc) : ''}`
          );
          purs.push([o, v]);
          break;
        }
        if (i > j) {
          order.splice(i, 1);
          order.splice(j, 0, o);
        }
        o.pursuitHit = v.mid;
        notes.push(
          `${o.name}의 「${o.move}」 — 교대하려는 ${v.name}을(를) 먼저 때린다!${o.pcond === 'dex' ? illuPursSpend(o.mid, o.pursuitSrc) : ''}`
        );
        purs.push([o, v]);
        break;
      }
    for (const o of order) {
      if (!o.pursuitHit) {
        delete o.pursuitSrc;
        o.pursuit = false;
        o.move = '';
        o.targets = [];
      }
      delete o.pimm;
      delete o.ut;
      delete o.pcond;
    } /* 기술 이름·대상은 차례가 와서 공개될 때까지 순서표에 남기지 않는다 (걸린 따라가때리기만 예외) */ /* 걸리지 않은 선행 추격·추격 무시는 공개 순서표에 남기지 않는다 */
    for (const m of iceUsed) await A().set(['battle', 'mons', m.id, 'prioDown'], null);
    /* 11-09 망령 「창파나이트의 추가행동도 대상을 지정해야 돼 · 넣자」: 선행 입력한 포텐셜 글이 「가장 마지막에 「기술」에 의한 추가 행동」이면 순서 맨 끝에 그 기술 차례를 붙인다.
     대상 = 선행 입력 때 대상 판에서 고른 자리(ptg — 구문 「대상지정」). 차례가 오면 공격 창이 그 기술 · 대상으로 열린다 (openAttack 의 xact) */
    for (const s of slots) {
      const K = SEC[s.mon.id];
      if (!K || !(K.pots || []).length) continue;
      for (const pn of K.pots) {
        const p = potSrc(s.mon).find(q => q && q.name === pn);
        const mm = p && String(p.eff || '').match(XACT_POS_RE);
        if (!mm) continue;
        const tg = (K.ptg || {})[pn];
        order.push(xactEnt(s, mm[1], pn, { targets: tg ? [tg] : [] }));
        notes.push(`${s.mon.name} 『${pn}』 — 가장 마지막에 「${mm[1]}」 추가 행동`);
      }
    }
    /* 11-09 감우 54-F: 「「4」배수 턴 가장 마지막에 「드래곤옐」에 의한 추가 행동」 — 선행 입력 없이 그 턴이면 저절로 (【준비】 불충족이면 빼고) */
    for (const s of slots) {
      const T = +b.turn || 0;
      if (!T) continue;
      const K = SEC[s.mon.id];
      for (const p of potSrc(s.mon)) {
        if (!p || !p.name || p.ph || potOffWhy(s.mon, p.name) || (K && (K.pots || []).includes(p.name))) continue;
        const mm = String(p.eff || '').match(XACTN_RE);
        if (!mm || T % +mm[1]) continue;
        order.push(xactEnt(s, mm[2], p.name));
        notes.push(`${s.mon.name} 『${p.name}』 — ${mm[1]}배수 턴 · 가장 마지막에 「${mm[2]}」 추가 행동`);
      }
    }
    /* 11-26 366: ① 「「물」기술에 의한 추가 행동」처럼 타입으로 적힌 추가 행동은 그 타입의 첫 기술로 (홍옥 『비네아』)
      ② 「(저|중|고)확률로 가장 마지막에 「X」에 의한 추가 행동」(제레 『염야성연의 성흔』) — 행동 순서를 짤 때 턴마다 굴린다. 「「A」가 PT에 참가하고 있을 때」가 있으면 그 트레이너 PT 에 A 가 있을 때만
      ③ 고유 「「N」배수 턴 가장 마지막에 아군이 「X」 기술에 의한 추가 행동」(오렐리오 『세 번째 종소리』) — 그 턴이면 누가 할지 묻는다 (X 타입 기술을 가진 필드의 아군) */
    {
      const tyMv = (m, nm) => {
        try {
          const ty = S().typeEn(nm);
          if (ty && !MVS(m).some(v => v && v.name === nm)) return xactMove(m, { ty: nm }) || nm;
        } catch (e) {}
        return nm;
      };
      for (const o of order)
        if (o && o.xact && o.move && o.order === -1000) {
          const m = b.mons[o.mid];
          if (m) o.move = tyMv(m, o.move);
        }
      for (const s of slots) {
        for (const p of potSrc(s.mon)) {
          if (!p || !p.name || p.ph || potOffWhy(s.mon, p.name)) continue;
          const tx = String(p.eff || '');
          const mm = tx.match(XACT_CH_RE);
          if (!mm || /배수\s*턴/.test(tx) || order.some(o => o.xact === p.name && o.mid === s.mon.id)) continue;
          const pt = tx.match(/「([^」]+)」\s*(?:이|가)\s*PT에\s*참가하고\s*있을\s*때/);
          if (
            pt &&
            !Object.values(b.mons || {}).some(
              x => x && x.tid === s.mon.tid && x.id !== s.mon.id && String(x.name || '').replace(/\s/g, '') === pt[1].replace(/\s/g, '')
            )
          )
            continue;
          let base = 0;
          try {
            base = +FX().percentOf(mm[1] + '확률') || 0;
          } catch (e) {}
          if (!base) base = { 저: 10, 중: 30, 고: 50 }[mm[1]];
          const R = FX().rollP(s.mon, base, {});
          if (R.ok) {
            order.push(xactEnt(s, tyMv(s.mon, mm[2]), p.name));
            notes.push(`${s.mon.name} 『${p.name}』 — ${mm[1]}확률 성공 (${R.r}/${R.p}) · 가장 마지막에 「${mm[2]}」 추가 행동`);
          } else notes.push(`${s.mon.name} 『${p.name}』 — ${mm[1]}확률 실패 (${R.r}/${R.p})`);
        }
      }
      const T3 = +b.turn || 0;
      if (T3)
        for (const t of Object.values(b.trainers || {})) {
          for (const q of uniqList(t)) {
            const mm = String(q.p.eff || '').match(XACT_UQ_RE);
            if (!mm || T3 % +mm[1] || (q.left !== null && q.left <= 0)) continue;
            const nm = String(q.p.name || '').replace(/[『』]/g, '');
            if (order.some(o => o.xact === nm)) continue;
            const ty = (() => {
              try {
                return S().typeEn(mm[2]);
              } catch (e) {
                return '';
              }
            })();
            const cand = slots.filter(
              s => s.mon.tid === t.id && s.mon.hp.cur > 0 && MVS(s.mon).some(v => v && (ty ? mvTysRaw(v).includes(ty) : v.name === mm[2]))
            );
            if (!cand.length) {
              notes.push(`${t.name} 고유 『${nm}』 — ${mm[1]}배수 턴 · 「${mm[2]}」 기술을 가진 아군이 필드에 없다`);
              continue;
            }
            let ix = 0;
            {
              try {
                const L = [...cand.map(s => s.mon.name), '쓰지 않는다'];
                const ans = await localUi(ctx().b, cand[0].mon, `${t.name} 고유 『${nm}』 — 추가 행동을 할 아군`).choose(L);
                ix = Array.isArray(ans) && ans.length ? +ans[0] : L.length - 1;
              } catch (e) {
                ix = 0;
              }
            }
            const s = cand[ix];
            if (!s) {
              notes.push(`${t.name} 고유 『${nm}』 — 쓰지 않음`);
              continue;
            }
            order.push(xactEnt(s, tyMv(s.mon, mm[2]), nm));
            notes.push(`${t.name} 고유 『${nm}』 — ${mm[1]}배수 턴 · ${s.mon.name}이(가) 가장 마지막에 「${mm[2]}」 기술로 추가 행동`);
          }
        }
    }
    for (const q of b.xq || []) {
      if (!q || +q.t !== (+b.turn || 0)) continue;
      const s = slots.find(z => z.mon && z.mon.id === q.mid);
      if (!s || order.some(o => o.xact === q.by && o.mid === q.mid)) continue;
      order.push(xactEnt(s, q.mv, q.by));
      notes.push(`${s.mon.name} 『${q.by}』 — 가장 마지막에 「${q.mv || '기술'}」 추가 행동`);
    } /* 11-26 구문 「추가행동」 (선행 · 턴 개시 때 적어 둔 것) */
    {
      let i0 = 0;
      while (i0 < order.length && order[i0].noact) {
        A().sysLog(`${order[i0].name} — ${order[i0].noact} (차례를 건너뛴다)`, 'battle');
        i0++;
      }
      /* 11-03 감우: 순서 · 색인 · 메모 · 페이즈를 한 번에 (om_jset_many) */ const ops = [
        [['battle', 'order'], order],
        [['battle', 'orderIdx'], i0],
        [['battle', 'orderNotes'], notes],
        [['battle', 'phase'], 2]
      ];
      if (b.tstep) ops.push([['battle', 'tstep'], null]);
      if (b.swPur) ops.push([['battle', 'swPur'], null]);
      if (!(await A().setMany(ops))) return;
    }
    cutPhase('행동 순서', '');
    for (const [o, v] of purs) {
      const pm = b.mons[o.mid] || {};
      A().sysLog(
        `【따라가때리기】 ${o.name} 『${o.move}』 발동!${o.pursuitSrc ? '\n선행 『' + o.pursuitSrc + '』에 묻어 있던 추격' : ''}\n${v.utHit ? '「유턴」으로 빠지려는' : '교대하려는'} ${v.name}을(를) 교대 전에 먼저 때린다${pursuitX2(((b.mons[o.mid] || {}).moves || []).find(q => q.name === o.move)) ? ' → 위력 2배' : ''}`,
        'battle',
        { mid: o.mid, img: pm.image || '' }
      );
      setTimeout(
        () => cutFire('m:' + o.mid, pm.image, `${o.name}의 따라가때리기!`, `『${o.move}』 → ${v.name}`, pm.side === 'left' ? '#1f6fd1' : '#e3101f'),
        1600
      );
    }
    A().sysLog(
      '행동 순서\n' +
        order
          .map(
            (o, i) =>
              `${i + 1}. ${o.name} (${o.change ? '교대 · ' : ''}${o.order !== 20 ? '순서 ' + o.order + ' · ' : ''}${o.prio ? '우선 ' + o.prio + ' · ' : ''}스피드 ${Math.round(o.speed)}${order.some(q => q !== o && Math.round(q.speed) === Math.round(o.speed) && (+q.prio || 0) === (+o.prio || 0) && q.order === o.order) ? ' · 동속 주사위 ' + o.dice : ''})`
          )
          .join('\n') +
        (spNotes.length ? '\n' + spNotes.map(x => '· ' + x).join('\n') : ''),
      'battle',
      {
        ord: order.map(o => ({
          n: o.name,
          img: (b.mons[o.mid] || {}).image || '',
          side: o.side,
          s: Math.round(o.speed),
          cap: !o.started
            ? '교대 등장'
            : o.change
              ? '통상 교대'
              : o.order !== 20
                ? orderValueName(o.order)
                : '우선도 ' + (o.prio > 0 ? '+' : '') + o.prio + (o.pursuitHit ? ' · 따라가때리기' : '')
        }))
      }
    );
  }

  /* 10-27 망령: 행동 순서 다시 계산 — 턴 도중 바뀐 상황(스피드 랭크 · 마비 · 트릭룸 · 순풍 · 습원 · 스카프 · 날씨 특성)을 아직 행동하지 않은 차례에만 적용한다.
    이미 행동한 차례(지금 칸 앞)와 지금 행동 중인 칸은 그대로 (행동 순서가 막 나온 2단계면 첫 칸부터). 순서값 · 우선도 · 교대 · 교대 등장은 처음 계산한 값 그대로, 같은 스피드는 처음 주사위 그대로 */
  /* 11-26 07:34 망령 「턴 중 스피드/우선도가 변동되면 즉시 행동 순서 갱신」: 행동 순서가 나온 뒤(2 · 3단계) 스피드(랭크 · 배율 · 마비 · 순풍 · 습원 · 트릭룸 · 스카프 · 날씨 특성)나 우선도(다음 기술 우선도 · 포텐셜 · 특성)가 바뀌면 리더 화면이 곧바로 다시 줄 세운다 (orderWatch → resortOrder({auto:true})).
    · 이미 행동한 차례와 지금 행동 중인 칸은 그대로 — 아직 행동하지 않은 차례만. 순서값 · 교대 · 교대 등장 · 같은 스피드 주사위는 처음 값 그대로
    · 우선도는 지시(기술 우선도 · 우선도 바꾸기)와 지금 걸린 효과로 다시 계산 (computeOrder 와 같은 셈 — 읽을 수 있는 지시 · 좌석이 올린 순서 열쇠). 열쇠가 없는 포켓몬의 우선도는 처음 값 그대로
    · 추가 행동(순서 -1000) · 따라가때리기로 끌어온 차례는 건드리지 않는다 — 자동일 때 끌어온 차례가 남아 있으면 그 뒤부터만 다시 세운다
    · 손으로 누르는 「순서 다시」(10-27)도 이 함수 — 이제 우선도도 같이 다시 계산한다 */
  async function resortOrder(opt) {
    opt = opt || {};
    const auto = !!opt.auto;
    const c = ctx();
    if (!c.mgr) return;
    const b = c.b;
    const O = (b.order || []).map(o => Object.assign({}, o));
    if (!O.length) return;
    const ph = +b.phase || 0;
    const cur = +b.orderIdx || 0;
    let st = ph === 2 ? cur : cur + 1;
    if (auto) {
      for (let i = O.length - 1; i >= st; i--)
        if (O[i].pursuitHit) {
          st = i + 1;
          break;
        }
    }
    if (st >= O.length - 1) {
      if (!auto) A().toast('다시 줄 세울 차례가 없다 (남은 차례가 하나 이하)');
      return;
    }
    const rest = O.slice(st);
    if (rest.some(o => o.pursuitHit)) return A().toast('따라가때리기가 걸린 차례가 남아 있어 다시 계산하지 않는다 — 초상을 눌러 손으로 옮긴다');
    const f = fieldOf(b);
    const trick = ((f.rooms || {})['트릭룸'] || 0) > 0;
    let SEC = {};
    try {
      const rows = await DBS().secretGet(c.ST.room, c.ST.secret, 'cmd');
      for (const r of rows || []) {
        if (!cmdFresh(r)) continue;
        const d = r.data || {};
        for (const mid in d.mons || {}) SEC[mid] = d.mons[mid];
      }
    } catch (e) {}
    const slots = allEntered(b);
    const tk = turnKey(b);
    const keyOf = m => {
      if (SEC[m.id]) return okeyOf(m, SEC[m.id]);
      const ok = ((ctx().b.cmds || {})[m.tid] || {}).ok;
      if (ok && ok.key === tk && ok.m && ok.m[m.id]) return ok.m[m.id];
      const px = (((b.cmds || {})[m.tid] || {}).mons || {})[m.id];
      return px ? okeyOf(m, px) : null;
    };
    const KEYS = {};
    for (const s of slots) KEYS[s.mon.id] = keyOf(s.mon) || null;
    const KZ = { sw: 0, pm: {}, om: {}, pr: 0, mv: 0 };
    const KA = {};
    for (const s of slots) KA[s.mon.id] = KEYS[s.mon.id] || KZ;
    const ents = slots.map(s => {
      const K = KA[s.mon.id];
      let prioMod = +K.pr || 0;
      if (K.mv && s.mon.prioDown) prioMod -= 1;
      try {
        const ap = abPrioMod(b, s, K, KA, slots);
        if (ap) prioMod += ap.v;
      } catch (e) {}
      const objs = (f.objects || {})[s.side] || {};
      return {
        slot: s.slot,
        mon: s.mon,
        cmd: { change: !!K.sw, priorityMap: K.pm || {}, orderMap: K.om || {} },
        prioMod,
        started: !!s.mon.started,
        scarf: HAS(s.mon, '구애스카프'),
        tailwind: (objs['순풍'] || 0) > 0,
        swamp: (objs['습원'] || 0) > 0,
        spMul: spMulOf(s.mon, f).v
      };
    });
    const rows = B().turnOrder(ents, { trick });
    const sp = {},
      pr = {};
    for (const r of rows) {
      sp[r.mon.id] = r.speed;
      if (KEYS[r.mon.id]) pr[r.mon.id] = r.prio;
    }
    const before = rest.map(o => o.mid);
    const chg = [];
    const R = v => Math.round(Math.abs(+v || 0)),
      P = v => (v > 0 ? '+' : '') + v;
    for (const o of rest) {
      if (o.xact || o.order === -1000) continue;
      const s0 = o.speed,
        p0 = +o.prio || 0;
      if (sp[o.mid] != null) o.speed = sp[o.mid];
      if (!o.change && pr[o.mid] != null) o.prio = pr[o.mid];
      const p1 = +o.prio || 0;
      const bits = [];
      if (p0 !== p1) bits.push(`우선도 ${P(p0)} → ${P(p1)}`);
      if (R(s0) !== R(o.speed)) bits.push(`스피드 ${R(s0)} → ${R(o.speed)}`);
      if (bits.length) chg.push(`${o.name} ${bits.join(' · ')}`);
    }
    rest.sort(
      (a, b2) =>
        (b2.started ? 1 : 0) - (a.started ? 1 : 0) ||
        (b2.change ? 1 : 0) - (a.change ? 1 : 0) ||
        b2.order - a.order ||
        b2.prio - a.prio ||
        b2.speed - a.speed ||
        b2.dice - a.dice
    );
    const order = [...O.slice(0, st), ...rest];
    const moved = rest.some((o, i) => o.mid !== before[i]);
    const notes = (b.orderNotes || []).filter(x => !/^「트릭룸」/.test(x));
    if (trick) notes.unshift('「트릭룸」이 시공간을 뒤틀었다! (스피드 역순)');
    if (auto && !moved && !chg.length) return;
    /* 그 사이 차례가 넘어갔으면(다른 화면 · 「다음 행동」) 덮어쓰지 않는다 — 다음 감시 때 다시 */
    {
      const nb = ctx().b;
      if ((+nb.orderIdx || 0) !== cur || (+nb.phase || 0) !== ph || (nb.order || []).length !== O.length) return;
    }
    await A().setMany([
      [['battle', 'order'], order],
      [['battle', 'orderNotes'], notes]
    ]);
    if (auto && !moved) return; /* 값만 바뀌고 순서는 그대로 — 조용히 */
    A().sysLog(
      `【행동 순서 ${auto ? '갱신' : '다시 계산'}】 ${st + 1}번째 차례부터${moved ? '' : ' — 순서는 그대로'}${chg.length ? '\n' + chg.map(x => '· ' + x).join('\n') : ''}\n` +
        rest
          .map(
            (o, i) =>
              `${st + i + 1}. ${o.name} (${o.change ? '교대 · ' : ''}${o.order !== 20 ? '순서 ' + o.order + ' · ' : ''}${o.prio ? '우선 ' + o.prio + ' · ' : ''}스피드 ${R(o.speed)}${trick ? ' · 트릭룸' : ''})`
          )
          .join('\n'),
      'battle'
    );
  }
  /* 감시: 스피드 · 우선도에 닿는 것의 지문이 바뀌면 다시 줄 세운다 (리더 화면만 · 2~3단계 · 순서가 있을 때). 턴마다 처음 본 지문은 기준만 */
  /* 11-26 366 「HP 가 회복했을 때」 계기의 감시: 필드에 나와 있는 포켓몬의 HP 가 늘면 evReact('healed'). 처음 본 포켓몬(막 나온 것) · 최대 HP 가 바뀐 때(폼체인지)는 기준만. 턴 0(시작 전 정리)은 보지 않는다 */
  const HL_SEEN = {};
  function healWatch() {
    const c = ctx();
    const b = c.b;
    if (!c.mgr || !b || !b.started || !FX()) return;
    const bk = String(b.started) + ':' + (b.at0 || '');
    const seen = HL_SEEN[bk] || (HL_SEEN[bk] = {});
    const ev = [];
    for (const m of Object.values(b.mons || {})) {
      if (!m) continue;
      if (!m.entry || !m.hp || m.hp.cur <= 0) {
        delete seen[m.id];
        continue;
      }
      const old = seen[m.id];
      seen[m.id] = { c: +m.hp.cur, x: +m.hp.max };
      if (!old || old.x !== +m.hp.max) continue;
      if (+m.hp.cur > old.c) ev.push({ mid: m.id, amt: +m.hp.cur - old.c, cur: +m.hp.cur });
    }
    if (!ev.length || !(+b.turn || 0) || !isLeader(c)) return;
    for (const e of ev)
      evReact('healed', { mid: e.mid, amt: e.amt, key: 'h' + e.mid + ':' + e.cur + ':' + (+b.orderIdx || 0) + ':' + (+b.phase || 0) }).catch(x =>
        console.warn('healed', x)
      );
  }
  const OW = { k: '', sig: '', busy: false, t: 0 };
  function orderSig(b) {
    const f = fieldOf(b);
    const trick = ((f.rooms || {})['트릭룸'] || 0) > 0;
    return (
      (trick ? 'T' : '') +
      '|' +
      allEntered(b)
        .map(s => {
          const m = s.mon;
          const objs = (f.objects || {})[s.side] || {};
          let v = 0;
          try {
            v = Math.round(B().statValue(m, 'speed', { mod: (m.mod || {}).speed || 1 }).value);
          } catch (e) {}
          return [
            m.id,
            v,
            (m.states || {}).Paralysis ? 1 : 0,
            HAS(m, '구애스카프') ? 1 : 0,
            (objs['순풍'] || 0) > 0 ? 1 : 0,
            (objs['습원'] || 0) > 0 ? 1 : 0,
            spMulOf(m, f).v,
            JSON.stringify((m.fx || {}).prio || []),
            m.prioDown ? 1 : 0,
            m.ability || ''
          ].join(':');
        })
        .join('|') +
      '|' +
      Object.keys(b.cmds || {})
        .sort()
        .map(t => {
          const ok = (b.cmds[t] || {}).ok;
          return ok && ok.key === turnKey(b)
            ? t +
                '=' +
                Object.keys(ok.m || {})
                  .sort()
                  .map(k => k + ':' + (+(ok.m[k] || {}).pr || 0))
                  .join(',')
            : '';
        })
        .join(';')
    );
  } /* 좌석이 올린 순서 열쇠(우선도)가 뒤늦게 다시 올라오면 한 번 더 */
  function orderWatch() {
    const c = ctx();
    const b = c.b;
    if (!c.mgr || !b || !b.started) return;
    const ph = +b.phase || 0;
    if ((ph !== 2 && ph !== 3) || !(b.order || []).length) {
      OW.k = '';
      return;
    }
    let sig = '';
    try {
      sig = orderSig(b);
    } catch (e) {
      return;
    }
    const k = String(b.started) + ':' + turnKey(b);
    if (OW.k !== k) {
      OW.k = k;
      OW.sig = sig;
      return;
    }
    if (sig === OW.sig || OW.busy) return;
    if (!isLeader(c)) return;
    clearTimeout(OW.t);
    OW.t = setTimeout(async () => {
      if (OW.busy) return;
      OW.busy = true;
      try {
        const b2 = ctx().b;
        const s2 = orderSig(b2);
        if (s2 === OW.sig) return;
        await resortOrder({ auto: true });
        OW.sig = s2;
      } catch (e) {
        console.warn('orderWatch', e);
      } finally {
        OW.busy = false;
      }
    }, 350);
  }

  /* ----- 턴 종료 ----- */
  /* 턴 마무리: 「턴 가장 마지막」 → (턴 종료 처리) → 「턴 종료 이후」. 그 타이밍이 적힌 포텐셜(필드의 포켓몬 · 그 트레이너 고유)이 있으면 단계마다 발동을 묻고, 없으면 그냥 넘어간다 */
  /* 「턴 종료 시까지」「가장 마지막까지」는 해제 타이밍이라 발동 후보가 아니다 */
  const END_T = {
    last: /가장\s*마지막(?!\s*까지)/,
    end: /턴\s*종료\s*(시|때|시점|에)(?!\s*까지)|턴\s*종료\s*마다/,
    after: /턴\s*종료\s*(이후|후|뒤)(?!\s*까지)/
  };
  /* 11-26 망령 「N배수 턴 자체는 따로 계기화 해둬 — 3배수 턴에 모든 능력치 강화 같은 것도」: 글 마디(①②…)에 「N」배수 턴(N의 배수 턴)이 있으면 그 마디는 N 의 배수 턴에만.
    턴 마무리 후보(가장 마지막 · 턴 종료 · 이후) · 턴 개시 자동 둘 다 이 마디 단위로 본다. 「「N」배수 턴 가장 마지막에 「X」에 의한 추가 행동」은 행동 순서가 따로 넣으니(54-F) 후보에서 뺀다.
    지속형(배율 · 위력 줄)은 구문 조건 토큰 턴:N배수 가 판정마다 본다 (제작기 fx.js · 추천기가 「N」배수 턴 → 턴:N배수) */
  const TMUL_RE = /「?\s*(\d+)\s*」?\s*(?:의\s*)?배수\s*(?:의\s*)?턴/g;
  const XACTN_RE = /「?\s*(\d+)\s*」?\s*배수\s*턴\s*(?:에\s*)?가장\s*마지막에\s*「([^」]+)」\s*(?:기술)?\s*에?\s*의한\s*추가\s*행동/;
  /* 추가 행동 글 꼴 — 여기 한곳 (지도는 xactEnt 위) */
  const XACT_CH_RE = /(저|중|고)\s*확률로\s*(?:턴\s*)?가장\s*마지막에\s*「([^」]+)」\s*(?:기술)?\s*에?\s*의한\s*추가\s*행동/; /* ③ 확률 */
  const XACT_UQ_RE =
    /「?\s*(\d+)\s*」?\s*배수\s*턴\s*(?:에\s*)?가장\s*마지막에\s*아군(?:이|가)\s*「([^」]+)」\s*기술에\s*의한\s*추가\s*행동/; /* ④ 고유 · 아군 */
  const XACT_ORD_RE = new RegExp(
    '(?:' + XACT_CH_RE.source + ')|(?:' + XACT_UQ_RE.source + ')'
  ); /* 순서를 짤 때 이미 처리 — 턴 마무리 후보에서 뺀다 */

  /* 11-26 366 방 시험에서 잡음: 「상대가 「화상」 상태가 되었을 때 가장 마지막에 「X」에 의한 추가 행동」처럼 다른 계기(~때)가 앞에 있는 마디의 「가장 마지막에」는 행동 자리이지 턴 마무리 타이밍이 아니다 — 턴 가장 마지막 후보에서 뺀다 (안 빼면 턴 끝에 계기 없이 한 번 더 발동) */ const XACT_POS_RE =
    /가장\s*마지막에\s*「([^」]+)」\s*(?:기술)?\s*에?\s*의한\s*추가\s*행동/;
  /* ① 자리 말 (기술 이름 = [1]) */ const xactEv = x => {
    x = String(x || '');
    const r = x.match(XACT_POS_RE);
    return (
      !!r &&
      (/때/.test(x.slice(0, r.index)) || /【\s*등장[^】]*】/.test(x.slice(0, r.index))) &&
      !END_T.last.test(x.replace(/(?:턴\s*)?가장\s*마지막에\s*「[^」]+」\s*(?:기술)?\s*에?\s*의한\s*추가\s*행동/, ''))
    );
  };
  /* 366: 【등장 (…)】/턴 가장 마지막에 「X」 추가 행동(방칠낭 『비상하는 학의 자세』 ①)도 등장 때의 것 */ const tmulNs = t =>
    [...String(t || '').matchAll(TMUL_RE)].map(x => +x[1]).filter(n => n > 1);
  function tmulOk(t, T) {
    const ns = tmulNs(t);
    return !ns.length || (+T > 0 && ns.every(n => +T % n === 0));
  }
  const segsOf = t => {
    const L = String(t || '')
      .replace(/<br\s*\/?>/g, '\n')
      .split(/(?=[①②③④⑤⑥⑦⑧⑨])/)
      .filter(x => x.trim());
    return L.length ? L : [String(t || '')];
  };
  /* 턴 타이밍 말 없이 「N」배수 턴만 있는 마디 (= 그 턴 개시 때 발동) — 이번 턴이 그 배수일 때 */
  function tmulStart(t, T) {
    return segsOf(t).some(
      x =>
        tmulNs(x).length &&
        tmulOk(x, T) &&
        !XACTN_RE.test(x) &&
        !END_T.last.test(x) &&
        !END_T.end.test(x) &&
        !END_T.after.test(x) &&
        !EVENT_RE.test(x.replace(/【\s*자동\s*】/g, ''))
    );
  }
  /* 11-06 망령 「『명경』(턴 종료 시 중확률로 「도발」「헤롱헤롱」 상태를 치유한다) 이 안 걸려 있을 때도 나온다」: 상태를 치유 · 해제하는 효과는 그 상태가 하나라도 걸려 있을 때만 후보.
    「「X」「Y」 상태를 치유」 → 적힌 상태 중 하나 · 「상태 이상을 치유」 → 상태 이상 하나. 다른 효과가 같이 적혀 있으면(치유 말고 할 일이 있으면) 그대로 묻는다 */
  const CURE_RE = /상태(?:\s*이상)?」?(?:\s*\([^)]*\))?(?:을|를)?\s*(?:모두\s*)?(?:치유|해제|회복)/;
  function cureOnlyIdle(m, eff) {
    const t = String(eff || '').replace(/<br\s*\/?>/g, ' ');
    if (!CURE_RE.test(t)) return false;
    if (/(?:치유|해제|회복)(?:하고|하며|한\s*뒤|한\s*후|하면|해서)/.test(t)) return false;
    const rest = t
      .replace(/【(?:[^【】]|【[^【】]*】)*】/g, '')
      .replace(/[^.。]*?(?:상태(?:\s*이상)?」?(?:\s*\([^)]*\))?(?:을|를)?\s*(?:모두\s*)?(?:치유|해제|회복)[^.。]*[.。]?)/g, '')
      .replace(/턴\s*종료[^.。]*?[,，]/g, '')
      .trim();
    if (rest.replace(/[\s.。]/g, '').length > 2) return false; /* 치유 말고 다른 문장이 있다 */
    const ST = (DB().states || {}).st || {};
    const byKo = {};
    for (const k in ST) if (ST[k] && ST[k].ko) byKo[ST[k].ko] = k;
    const has = k => !!(m.states || {})[k] || (k === 'Poison' && !!(m.states || {}).Toxic); /* 「독」은 맹독도 */
    const names = [...t.matchAll(/「([^」:]+)」/g)].map(x => x[1].trim()).filter(n => byKo[n]);
    if (names.length) return !names.some(n => has(byKo[n]));
    if (/상태\s*이상/.test(t)) {
      const ABN = ['Poison', 'Toxic', 'Burn', 'Paralysis', 'Freeze', 'Sleep'];
      return !ABN.some(has);
    }
    return false;
  }
  /* 11-07 망령 「사용한 1/시 포텐셜이 턴 종료시에 계속 발동을 물어봄」: 【N/시】 를 다 썼거나 【소진】 · 【탈진】 으로 이번 턴에 못 쓰면 후보에서 뺀다 */
  const spent = (p, uses, turns) => {
    try {
      const L = limOf(p, uses || {}, turns || {});
      return L.left != null && L.left <= 0;
    } catch (e) {
      return false;
    }
  };
  const NO_SWT = ['가속']; /* 교대로 나온 턴 종료엔 발동 안 하는 특성 */
  function endCands(b, step) {
    const out = [];
    const ok0 = t => {
      t = String(t || '');
      if (step === 'end' && END_T.after.test(t) && !END_T.end.test(t.replace(END_T.after, ''))) return false;
      return END_T[step].test(t);
    };
    const TN = +b.turn || 0;
    const tmOk = t => {
      const sg = segsOf(t).filter(x => END_T[step].test(x));
      return sg.length
        ? sg.some(x => !XACTN_RE.test(x) && !xactEv(x) && !XACT_ORD_RE.test(x) && tmulOk(x, TN))
        : tmulOk(t, TN) && !XACTN_RE.test(String(t || '')) && !xactEv(String(t || '')) && !XACT_ORD_RE.test(String(t || ''));
    };
    /* 11-26 N배수 턴 계기 */ const ok = (t, m) => ok0(t) && tmOk(t) && !cureOnlyIdle(m, t);
    for (const m of Object.values(b.mons || {})) {
      if (!m.entry || m.hp.cur <= 0) continue;
      for (const p of potSrc(m))
        if (ok(p.eff, m) && !spent(p, m.potUses, m.potTurn))
          out.push({ m, kind: 'pot', name: p.name, eff: p.eff, tag: isExcl(m, p) ? '전용' : '포텐셜' });
      /* 11-07 망령 「가속 특성 턴 종료 시에 왜 확인 문구 안 뜨냐」: 후보를 포텐셜 · 고유에서만 찾아서 특성은 빠져 있었다 — 특성 글(시트 → 특성 DB)에 그 타이밍이 적혀 있으면 같이 묻는다. 소지품 턴 종료(먹다남은음식 등)는 items.js 가 저절로 하므로 넣지 않는다 */
      /* 11-07 23:37 망령 「가속은 교대로 나온 턴 종료 시에는 발동 안 해」 */
      if (
        m.ability &&
        !(NO_SWT.includes(String(m.ability).trim()) && +m.inSw && +m.inT === +b.turn) &&
        !(step === 'end' && F() && F().poisonHeal && F().poisonHeal(m))
      ) {
        /* 11-19 포이즌힐 꼴은 슬립 대미지 단계에서 대미지 대신 회복 (field.js) — 묻지 않는다 */ const te = slotEff(m, 'trait', m.ability);
        if (ok(te, m)) out.push({ m, kind: 'trait', name: m.ability, eff: te, tag: '특성' });
      }
    }
    /* 11-22 망령 슬렌더 맨 『납치 괴이』 「【자동】【지원】/턴 종료 이후 …」: 볼 안(벤치)의 【지원】 포텐셜도 후보 — 【지원】 · 【지원 (상위)】는 살아 있을 때, 【지원 (빈사)】는 빈사여도 (supLive) */
    for (const m of Object.values(b.mons || {})) {
      if (m.entry || m.pend) continue;
      for (const p of potSrc(m))
        if (supKind(p.eff) && ok(p.eff, m) && !spent(p, m.potUses, m.potTurn))
          out.push({ m, kind: 'pot', name: p.name, eff: p.eff, tag: isExcl(m, p) ? '전용' : '포텐셜' });
    }
    const seen = new Set();
    for (const m of Object.values(b.mons || {})) {
      if (!m.entry || m.hp.cur <= 0 || seen.has(m.tid)) continue;
      seen.add(m.tid);
      const t = (b.trainers || {})[m.tid];
      for (const x of uniqList(t))
        if (ok(x.p.eff, m) && !spent(x.p, t && t.uUses, t && t.uTurn)) out.push({ m, kind: 'uq', name: x.p.name, eff: x.p.eff, tag: '고유', t });
    }
    return out;
  }
  /* 턴 마무리 (10-23): 단계마다 그 타이밍 포텐셜을 가진 트레이너의 주인 화면에만 묻는다 (플레이어 몫은 그 플레이어, NPC·GM 몫은 GM).
    각자 쓸 것을 「발동」하고 「다음 ▶」(턴 종료 단계는 「턴 종료 처리 ▶」)를 누르면, 모두 눌렀을 때 진행하는 화면이 다음 단계로 넘긴다.
    상태: battle.endq = {key, step:'last'|'end'|'after', need:[tid]} · 끝냄 표시 = battle.cmds[tid].ed = key+':'+step (좌석도 쓸 수 있는 자리) */
  const END_STEP = { last: '턴 가장 마지막', end: '턴 종료', after: '턴 종료 이후' };
  const endMine = (c, tid) => (c.role === 'seat' ? ownT(c, tid) : c.gm && !seatOwned(c, tid) && !fairOff(c, tid));
  const endDone = (b, tid) => {
    const q = b.endq || {};
    return ((b.cmds || {})[tid] || {}).ed === q.key + ':' + q.step;
  };
  const EFIRED = {};
  async function endFlow() {
    const c = ctx();
    if (!c.mgr) return;
    const q = c.b.endq;
    if (q && q.step) {
      const wait = (q.need || [])
        .filter(t => !endDone(c.b, t) && endCands(c.b, q.step).some(x => x.m.tid === t))
        .map(t => (c.b.trainers[t] || {}).name || '?');
      if (
        await askYes(
          `${END_STEP[q.step]} 확인 중이다${wait.length ? ' (기다리는 중: ' + wait.join(' · ') + ')' : ''}.\n기다리지 않고 바로 넘길까?`,
          '넘긴다',
          '기다린다'
        )
      )
        return endAdvance(true);
      return;
    }
    await A().set(['battle', 'host'], c.gm ? 'gm' : c.seat);
    raidExtra(c.b);
    await endStep(+c.b.endXT === (+c.b.turn || 0) && (+c.b.turn || 0) ? 'end' : 'last');
  }
  /* 11-09 감우 55: 그 타이밍(턴 가장 마지막 · 턴 종료 · 턴 종료 이후)의 【자동】 포텐셜 · 고유 중 구문이 있는 것은 묻지 않고 바로 발동 (조건 줄은 구문이 본다) — 발동한 것은 확인 후보에서 뺀다 */
  const EAUTO = {};
  /* 11-18 망령 「턴 종료 시엔 ②만 처리되게 하고 ①은 상시형 패시브로」(오호게츠히메 「공주님」 ①【방호】 아군 공격 무효 · ② 매 턴 종료 시 1/8 회복): 줄 고르기(선택:) 구문이면 라벨에 이 단계 말(턴 종료 시 …)이 든 줄만 — 없으면 그대로(고르는 창) */
  function endPick(a, step) {
    if (!a || !a.ops || a.ops.length !== 1 || a.ops[0].k !== 'choice') return a;
    const re = END_T[step];
    if (!re) return a;
    const os = (a.ops[0].opts || []).filter(o => o && re.test(String(o.label || '')));
    if (!os.length) return a;
    return Object.assign({}, a, { ops: os.flatMap(o => o.ops || []) });
  }
  async function endAuto(step) {
    if (!FX()) return;
    const b = ctx().b;
    const T = turnKey(b);
    for (const x of endCands(b, step)) {
      if (x.kind !== 'pot' && x.kind !== 'uq') continue;
      if (!/【\s*자동\s*】/.test(String(x.eff || ''))) continue;
      const k = [T, step, x.kind, x.m.id, x.name].join('|');
      if (EAUTO[k]) continue;
      const cur = ctx().b.mons[x.m.id] || x.m;
      const a = endPick(FX().autoOf(x.kind === 'uq' ? { tid: x.m.tid } : cur, 'pot', x.name) || FX().autoOf(cur, 'pot', x.name), step);
      if (!a || !realOps(a) || a.manual) continue;
      EAUTO[k] = 1;
      let L = null,
        p = null;
      if (x.kind === 'pot') {
        p = potSrc(cur).find(q => q && q.name === x.name);
        if (p) {
          L = limOf(p, cur.potUses || {}, cur.potTurn || {});
          if (L.left !== null && L.left <= 0) continue;
        }
      }
      let ok = false;
      try {
        ok = await fireAuto(
          x.m.id,
          'pot',
          x.name,
          Object.assign(
            {
              auto: a,
              quiet: true,
              noEv: 1,
              head: `【${END_STEP[step]}】 ${x.kind === 'uq' ? x.t.name + ' 고유' : cur.name} 『${x.name}』【자동】`,
              eff: String(x.eff || '')
            },
            x.kind === 'uq' ? { uq: 1 } : {}
          )
        );
      } catch (e) {
        console.warn('endAuto', e);
      }
      if (ok && L) {
        const c2 = ctx().b.mons[x.m.id] || cur;
        if (L.mmax != null) {
          const u = (c2.potUses || {})[x.name];
          const had = u == null ? L.mmax : +u;
          await A().set(['battle', 'mons', x.m.id, 'potUses', x.name], Math.max(0, had - 1));
        }
        if (L.per) await A().set(['battle', 'mons', x.m.id, 'potTurn', x.name], +ctx().b.turn || 0);
        if (L.sup) await A().set(['battle', 'mons', x.m.id, 'potTurn', '_sup', x.name], 1);
      }
      if (ok && x.kind === 'uq') {
        const tt = (ctx().b.trainers || {})[x.t.id] || x.t;
        const q = uniqList(tt).find(y => y.p.name === x.name);
        if (q && q.mmax != null) {
          const v = (tt.uUses || {})[x.name];
          await A().set(['battle', 'trainers', x.t.id, 'uUses', x.name], Math.max(0, (v == null ? q.mmax : +v) - 1));
        }
        if (q && q.per) await A().set(['battle', 'trainers', x.t.id, 'uTurn', x.name], +ctx().b.turn || 0);
      }
    }
  }
  const endLeft = (b, step) => {
    const T = turnKey(b);
    return endCands(b, step).filter(x => !EAUTO[[T, step, x.kind, x.m.id, x.name].join('|')]);
  };
  /* 11-26 366 「~한 턴 가장 마지막에 「X」에 의한 추가 행동」(세라핀 · 파오젠 · 총지엔 · 오카다 이조 …): 턴 가장 마지막 단계에서 발동해 순서 끝에 붙은 추가 행동이 있으면, 턴 종료로 넘어가지 않고 그 차례에 멈춘다 — 행동을 처리하고 「턴 진행」을 다시 누르면 턴 종료부터 (battle.endXT = 그 턴) */
  let IN_LAST = false;
  async function xactPause() {
    const b = ctx().b;
    const O = b.order || [];
    const i = O.findIndex(o => o && o.xact && o.late === 1 && (b.mons[o.mid] || {}).entry && ((b.mons[o.mid] || {}).hp || {}).cur > 0);
    if (i < 0) return false;
    const order = O.map(o => (o && o.late === 1 ? Object.assign({}, o, { late: 2 }) : o));
    await A().setMany([
      [['battle', 'order'], order],
      [['battle', 'orderIdx'], i],
      [['battle', 'endXT'], +b.turn || 0],
      [['battle', 'endq'], null]
    ]);
    A().sysLog(
      `【추가 행동】 ${O.filter(o => o && o.late === 1)
        .map(o => `${o.name} 『${o.xact}』`)
        .join(' · ')} — 턴 가장 마지막 차례. 행동을 처리한 뒤 「턴 진행」을 다시 누르면 턴 종료로 넘어간다`,
      'battle'
    );
    return true;
  }
  async function endStep(step) {
    for (;;) {
      IN_LAST = step === 'last';
      try {
        await endAuto(step);
      } catch (e) {
        console.warn('endAuto', e);
      } finally {
        IN_LAST = false;
      }
      const b = ctx().b;
      const L = endLeft(b, step);
      const need = [...new Set(L.map(x => x.m.tid))];
      if (need.length) {
        const key = String(Date.now());
        await A().set(['battle', 'endq'], { key, step, need });
        A().sysLog(
          `【${END_STEP[step]}】 포텐셜 확인 — ${need.map(t => (b.trainers[t] || {}).name || '?').join(' · ')} (각자 쓸 것을 고르고 「다음」)`,
          'battle'
        );
        return;
      }
      if (step === 'last') {
        if (await xactPause()) return;
        step = 'end';
        continue;
      }
      if (step === 'end') {
        await turnEnd();
        step = 'after';
        continue;
      }
      await A().set(['battle', 'endq'], null);
      return;
    }
  }
  /* 진행하는 화면: 모두 「다음」을 눌렀으면 다음 단계로 */
  async function endAdvance(force) {
    const c = ctx();
    const b = c.b;
    const q = b.endq;
    if (!q || !q.step || !c.mgr) return;
    const me = c.gm ? 'gm' : c.seat;
    if (!force && (b.host || 'gm') !== me) return; /* 넘기기(force)는 진행 화면이 아니어도 된다 — 진행하던 좌석이 나가도 막히지 않게 */
    /* 고를 것이 없어진 트레이너(그 포켓몬이 쓰러졌거나 물러남)는 끝낸 것으로 본다 */
    const L = endCands(b, q.step);
    if (!force && !(q.need || []).every(t => endDone(b, t) || !L.some(x => x.m.tid === t))) return;
    if (BUSY.end === q.key) return;
    BUSY.end = q.key;
    /* 10-27 망령: GM 창이 여럿이면(같은 계정 두 창 · GM 둘) 모두 host 'gm' 이라 턴 종료를 같이 돌려 한 턴이 건너뛰어졌다 (6턴).
     ① 접속 중 GM 창 중 리더 하나만 ② 그래도 겹칠 때를 위해 잠금을 쓰고 잠깐 뒤 내 것인지 다시 본다 */
    if (me === 'gm' && !force && !isLeader(c)) {
      BUSY.end = '';
      return;
    }
    const lk = q.key + '|' + myPid();
    await A().set(['battle', 'endLock'], lk);
    await new Promise(r => setTimeout(r, 450));
    if (String((ctx().b || {}).endLock || '') !== lk || !((ctx().b || {}).endq || {}).step) {
      BUSY.end = '';
      return;
    }
    try {
      await A().set(['battle', 'endq'], null);
      if (q.step === 'last') {
        if (!(await xactPause())) await endStep('end');
      } else if (q.step === 'end') {
        await turnEnd();
        await endStep('after');
      }
    } finally {
      BUSY.end = '';
    }
  }
  function endPanel(c) {
    const b = c.b;
    const q = b.endq;
    if (!q || !q.step) return '';
    const L = endCands(b, q.step);
    const btn = q.step === 'end' ? '턴 종료 처리' : q.step === 'last' ? '턴 종료로' : '다음 턴으로';
    const rows = (q.need || [])
      .map(tid => {
        const t = (b.trainers || {})[tid] || {};
        const mine = endMine(c, tid);
        const dn = endDone(b, tid) || !L.some(x => x.m.tid === tid);
        const my = mine ? L.filter(x => x.m.tid === tid) : [];
        return `<div class="eqrow ${dn ? 'done' : ''} ${mine ? 'mine' : ''}"><div class="eqh"><b>${esc(t.name || '?')}</b>${dn ? '<span class="tag ok">✓ 끝냄</span>' : mine ? '' : '<span class="small dim">고르는 중…</span>'}<span class="sp"></span>${mine && !dn ? `<button class="btn sm pri" data-act="edone" data-tid="${tid}">${btn} ▶</button>` : ''}</div>
    ${my
      .map(x => {
        const i = L.indexOf(x);
        const fk = q.key + ':' + q.step + ':' + x.m.id + ':' + x.name;
        return `<div class="firerow"><b class="fnm"><span class="tag ${x.kind === 'uq' ? 'uqt' : 'ext'}">${x.tag}</span> 『${esc(x.name)}』</b><span class="small dim">${esc(x.kind === 'uq' ? x.t.name : x.m.name)} (${String(x.m.entry).toUpperCase()})</span><span class="sp"></span>${dn ? '' : `<button class="btn xs ${EFIRED[fk] ? 'ghost' : 'pri'}" data-act="efire" data-i="${i}" ${EFIRED[fk] ? 'disabled' : ''}>${EFIRED[fk] ? '발동함' : '발동'}</button>`}<div class="small" style="flex-basis:100%;white-space:pre-wrap;color:var(--fg2)">${esc(
          String(x.eff || '')
            .replace(/<br\s*\/?>/g, '\n')
            .slice(0, 300)
        )}</div></div>`;
      })
      .join('')}</div>`;
      })
      .join('');
    return `<div class="endq"><div class="ohead"><span class="olab">${END_STEP[q.step]}</span><span class="small dim">이 타이밍이 적힌 포텐셜 — 주인만 본다. 쓸 것만 「발동」, 다 골랐으면 「${btn}」. 모두 누르면 넘어간다</span><span class="sp"></span>${c.mgr ? '<button class="btn xs ghost" data-act="eskip" title="안 누른 사람을 기다리지 않고 넘긴다">기다리지 않고 넘기기</button>' : ''}</div>${rows}</div>`;
  }
  async function endAct(act, d) {
    const c = ctx();
    const b = c.b;
    const q = b.endq;
    if (!q || !q.step) return;
    if (act === 'eskip') {
      if (!c.mgr) return;
      if (!(await askYes('아직 안 누른 사람을 기다리지 않고 넘길까?', '넘긴다', '기다린다'))) return;
      return endAdvance(true);
    }
    if (act === 'edone') {
      const tid = d.tid;
      if (!endMine(c, tid)) return;
      const ed = q.key + ':' + q.step;
      if ((b.cmds || {})[tid]) await A().set(['battle', 'cmds', tid, 'ed'], ed);
      else await A().set(['battle', 'cmds', tid], { ed });
      A().sysLog(`${(b.trainers[tid] || {}).name} — ${END_STEP[q.step]} 끝냄`, 'battle');
      return endAdvance();
    }
    if (act === 'efire') {
      const L = endCands(b, q.step);
      const x = L[+d.i];
      if (!x || !endMine(c, x.m.tid)) return;
      const fk = q.key + ':' + q.step + ':' + x.m.id + ':' + x.name;
      if (EFIRED[fk]) return;
      EFIRED[fk] = 1;
      if (x.kind === 'uq') {
        A().sysLog(`【고유】 ${x.t.name} 『${x.name}』 (${END_STEP[q.step]})`, 'battle', {
          mid: x.m.id,
          img: x.t.image || '',
          eff: String(x.eff || '')
            .replace(/<br\s*\/?>/g, '\n')
            .slice(0, 400)
        });
        return A().renderScene();
      }
      const fk2 = x.kind === 'trait' ? 'trait' : 'pot';
      const a0 = FX() && FX().autoOf(x.m, fk2, x.name);
      const a = endPick(a0, q.step);
      if (a && a.ops && a.ops.length && !a.manual) {
        const mid = x.m.id;
        const h0 = +(((ctx().b.mons || {})[mid] || {}).hp || {}).cur || 0;
        await fireAuto(mid, fk2, x.name, a !== a0 ? { auto: a } : undefined);
        /* 11-07 망령 「턴 종료 시 HP 회복은 중첩 안 돼 — 가장 높은 것만」: 턴 종료 단계에서 회복이 두 번 들어오면 큰 쪽만 남기고, 몫을 m.teHeal 에 적어 소지품 · 상태 회복(turnEnd)과도 견준다 */
        if (q.step === 'end') {
          const m1 = (ctx().b.mons || {})[mid];
          const h1 = +((m1 || {}).hp || {}).cur || 0;
          const got = h1 - h0;
          if (got > 0) {
            const T = +ctx().b.turn || 0;
            const pr = m1.teHeal && +m1.teHeal.t === T ? +m1.teHeal.v || 0 : 0;
            if (pr > 0) {
              const keep = h0 + Math.max(0, got - pr);
              await A().set(['battle', 'mons', mid, 'hp', 'cur'], keep);
              A().sysLog(
                `${m1.name} 턴 종료 회복은 가장 높은 것만 — 먼저 ${pr} 회복해서 『${x.name}』은(는) ${Math.max(0, got - pr)}만 (HP ${keep}/${m1.hp.max})`,
                'battle'
              );
            }
            await A().set(['battle', 'mons', mid, 'teHeal'], { t: T, v: Math.max(pr, got) });
          }
        }
        return A().renderScene();
      }
      A().sysLog(`【${x.tag}】 ${x.m.name} 『${x.name}』 (${END_STEP[q.step]})`, 'battle', {
        mid: x.m.id,
        img: x.m.image || '',
        eff: String(x.eff || '')
          .replace(/<br\s*\/?>/g, '\n')
          .slice(0, 400)
      });
      return A().renderScene();
    }
  }
  /* 예고 공격(미래예지 계열, 맵툴 future_fire): 건 포켓몬의 그때 공격/특공 실수치(랭크 무시)로 계산. 명중 확정 · 급소 없음 · 벽 보정 · 상성 · 타입 일치 · 받는 쪽 반감열매(11-06). 그 밖의 소지품·특성 보정은 손으로 */
  function futureFire(b, m) {
    const r = m.futRsv;
    delete m.futRsv;
    if (!r) return [];
    if (!m.entry || m.hp.cur <= 0) return [`「${r.by}」의 『${r.mv}』 — ${m.name}이(가) 쓰러져 있어 불발`];
    const f = fieldOf(b);
    const objs = (f.objects || {})[m.side] || {};
    const cat = r.akey === 'attack' ? 'physical' : 'special';
    const ws = mode(b) >= 2 ? 0.667 : 0.5; /* 10-25: 더블 이상은 0.67배 (공격 창과 같게) */
    const wall =
      (cat === 'physical' && objs['리플렉터'] > 0) ||
      (cat === 'special' && objs['빛의장막'] > 0) ||
      objs['오로라베일'] > 0 ||
      (objs['얼음의장벽'] > 0 && r.typeEn !== 'Fire')
        ? ws
        : 1;
    const dk = cat === 'physical' ? 'defense' : 'specialdefense';
    const D = Math.max(1, B().statValue(m, dk).value);
    const L = Math.floor(((+r.lv || 50) * 2) / 5) + 2;
    const base = Math.floor(Math.floor((L * (+r.pw || 0) * (+r.A || 1)) / 50) / D) * wall + 2;
    const amt = Math.floor((base * (85 + Math.floor(Math.random() * 16))) / 100);
    const eff = r.typeEn ? B().effectiveness([r.typeEn], m, { atkTypes: r.atkTypes || [] }) : { value: 1, stab: false };
    /* 11-06 망령 「미래예지 대미지에 반감열매가 작동을 안 한다」: 받는 쪽 반감열매(야파열매 …)를 HP 창과 같은 규칙(OI().resist)으로 보고, 맞으면 반감하고 먹는다 */
    const berry =
      eff.value > 0 && OI()
        ? OI().resist(m, { mt: r.typeEn ? [r.typeEn] : [], cat: cat === 'physical' ? '물리' : '특수', eff: eff.value, multi: false })
        : '';
    /* 11-10 망령 「벌레침략 공격에 버텨라 반감 적용된다고 했는데 자동화엔 안 된다」: 받는 쪽이 『버텨라!』(flags.endure — 턴 종료 처리에서 플래그가 지워지기 전에 m._fe 로 옮겨 둔다)면 ×0.5 */
    const endu = endHalf(m) || !!m._fe;
    delete m._fe;
    const hd = B().hpDamage(m, amt, eff.value, { stab: eff.stab, berryHalf: !!berry, guard: endu ? 0.5 : 1 });
    m.hp.cur = Math.max(0, m.hp.cur - hd.final);
    const out = [
      `◆ 예고 공격 발동 — 「${r.by}」의 『${r.mv}』가 ${m.name}을(를) 덮쳤다! ${hd.final} 대미지 (기본 ${Math.floor(base * 0.85)}~${Math.floor(base)}${eff.value !== 1 ? ' · 상성 ×' + eff.value : ''}${eff.stab ? ' · 타입 일치' : ''}${wall < 1 ? ' · 벽 보정' : ''}${berry ? ' · 「' + berry + '」 반감' : ''}${endu ? ' · 『버텨라!』 ×0.5' : ''}) → HP ${m.hp.cur}/${m.hp.max}`
    ];
    if (berry) {
      const o = OI()
        .all(m)
        .find(x => x.r.name === berry);
      const L = [];
      OI().use(m, L, b, o ? o.k : 0);
      out.push(...L.map(t => `${m.name} ${t}`));
    }
    if (m.hp.cur <= 0) {
      m.entry = '';
      out.push(`${m.name}은(는) 쓰러졌다!`);
    }
    return out;
  }
  /* 기술을 내보낼 때 줄어드는 상태: DB 의 prog:'move' + 얼음(설명이 「3번째로 기술을 내보낼 때 해제」라 턴이 아니라 기술 횟수로 센다) */
  const movesDown = (k, d) => (d && d.prog === 'move') || k === 'Freeze';
  async function turnEnd() {
    if (!ctx().mgr) return;
    try {
      await deferAll('턴 종료 시 (행동하지 못했거나 이미 행동했다)');
    } catch (e) {
      console.warn('defer', e);
    }
    try {
      await fieldAuto('end');
    } catch (e) {
      console.warn('필드 턴 종료 구문', e);
    }
    try {
      await guard4Future();
    } catch (e) {
      console.warn('예고 공격 버텨라', e);
    }
    const c = ctx();
    if (!c.mgr) return;
    const b0 = snap(c.b),
      b = snap(b0);
    const f = fieldOf(b);
    const db = (DB().states || {}).st || {};
    const lines = [];
    const futs = [];
    /* 10-21 망령: 로그를 갈래별로 (포켓몬 · 풀린 것 · 필드) */ const fieldL = [];
    const rel = {};
    const relAdd = (m, t) => {
      (rel[m.name] = rel[m.name] || []).push(t);
    };
    /* 11-04 21:50 망령 「악타입 상대로 미라클아이가 먼저 풀리고 미래예지가 박혀서 0딜 — 미래예지 계는 가장 마지막 타이밍에 포함」:
     이번 턴 종료에 떨어지는 예고 공격은 다른 상태(미라클아이 · 임시 랭크 …)가 풀리기 전에 먼저 맞힌다.
     11-11 망령 「권수아 — 모래바람이 예고 공격 전 HP 로 계산됨」: 룰북 턴 종료 순서 1. 「미래예지」 등 → 3. 슬립 대미지(날씨 포함) — 날씨 · 상태 대미지(turnEndStates · turnEndField)보다도 먼저 */
    const futDone = new Map();
    for (const mid in b.mons) {
      const m = b.mons[mid];
      const r = m.futRsv;
      if (!r || !m.entry || m.hp.cur <= 0) continue;
      const v = +(m.states || {})[r.st];
      const def = db[r.st] || {};
      if ((def.prog === 'turn' || def.prog === 'once') && !movesDown(r.st, def) && v > 0 && v < 1000 && v - 1 <= 0) {
        const k0 = r.st;
        lines.push(...futureFire(b, m));
        futDone.set(mid, k0);
      }
    }
    if (F()) {
      const slots = {};
      for (const s of SIDES) {
        const e = entered(b, s);
        for (const a in e) slots[s + '_' + a] = e[a];
      }
      /* 11-13 22:16 망령: 룰북 순서 — 날씨 · 불바다(슬립 대미지)를 회복보다 먼저 */ const r2 = F().turnEndField(b.mons, f, { noGrass: 1 });
      fieldL.push(...r2.lines);
      const r1 = F().turnEndStates(b.mons, slots, { field: f, turn: +b.turn || 0 });
      lines.push(...r1.lines);
      for (const mid in b.mons) {
        const m = b.mons[mid];
        if (m.entry && m.hp.cur <= 0) {
          m.entry = '';
          if (!r1.dead.includes(mid)) lines.push(`${m.name}은(는) 쓰러졌다!`);
        }
      }
      /* 11-15 05시: 「【함성】을 발동시키지 못한 턴 종료 시 N/M 의 비례 대미지」(『폭식의 대죄』 ③) — 이번 턴 【함성】 계기가 발동했으면(shoutT) 안 입는다 */
      for (const mid in b.mons) {
        const m = b.mons[mid];
        if (!m.entry || m.hp.cur <= 0) continue;
        for (const q of potSrc(m)) {
          if (!q || !q.name || q.ph) continue;
          const mm = String(q.eff || '').match(/【\s*함성\s*】\s*을\s*발동시키지\s*못한\s*턴\s*종료\s*시\s*(\d+)\s*\/\s*(\d+)\s*의\s*비례\s*대미지/);
          if (!mm || +m.shoutT === (+b.turn || 0)) continue;
          const v = Math.max(1, Math.floor((m.hp.max * +mm[1]) / +mm[2]));
          m.hp.latest = m.hp.cur;
          m.hp.cur = Math.max(0, m.hp.cur - v);
          lines.push(`${m.name} 『${q.name}』 — 【함성】 없는 턴 ${mm[1]}/${mm[2]} −${v}${m.hp.cur <= 0 ? ' · 쓰러졌다!' : ''}`);
          if (m.hp.cur <= 0) m.entry = '';
          break;
        }
      }
      /* 11-23 망령 (말레니아 『도약 검무』 ②「①이 발동한 턴 종료 시 자신의 「스피드」 변화를 초기화한다」): 이번 턴에 그 포텐셜을 썼으면(potTurn = 이번 턴 — 【탈진】 · 【소진】 기록) 적힌 능력치 랭크를 0으로 */
      {
        const T0 = +b.turn || 0;
        const KO = {};
        try {
          const SK = (FX() && FX().STAT_KO) || {};
          for (const k in SK) if (!KO[SK[k]]) KO[SK[k]] = k;
        } catch (e) {} /* 11-23 방 시험(219번 3-4): STAT_KO 는 효과 엔진(FX) 쪽에 있다 — 필드 엔진(F)에서 찾아 늘 비어 있었고, 그래서 초기화가 한 번도 안 됐다 */
        for (const mid in b.mons) {
          const m = b.mons[mid];
          if (!m.entry || m.hp.cur <= 0) continue;
          for (const q of potSrc(m)) {
            if (!q || !q.name || q.ph) continue;
            const mm = String(q.eff || '').match(
              /[①-⑳]\s*(?:\(\s*『[^』]+』\s*\))?\s*이\s*발동한\s*턴\s*종료\s*시\s*자신의\s*((?:「[^」]+」\s*[·,]?\s*)+)\s*(?:랭크\s*)?변화를\s*초기화/
            );
            if (!mm) continue;
            if (+(m.potTurn || {})[q.name] !== T0) continue;
            const ks = [...mm[1].matchAll(/「([^」]+)」/g)].map(x => KO[x[1].trim()]).filter(Boolean);
            const R = m.rank || {};
            const done = ks.filter(k => +R[k]);
            for (const k of done) R[k] = 0;
            if (done.length)
              lines.push(`${m.name} 『${q.name}』 — 발동한 턴 종료 · ${done.map(k => ((FX() && FX().STAT_KO) || {})[k] || k).join('·')} 변화 초기화`);
          }
        }
      }
    } else
      for (const mid in b.mons) {
        const m = b.mons[mid];
        if (!m.entry || m.hp.cur <= 0) continue;
        for (const t of B().turnEnd(m)) {
          if (!t.delta) continue;
          m.hp.cur = Math.max(0, Math.min(m.hp.max, m.hp.cur + t.delta));
          lines.push(`${m.name} ${db[t.state] ? db[t.state].ko : t.state} ${t.delta > 0 ? '+' : ''}${t.delta} → ${m.hp.cur}`);
          if (m.hp.cur <= 0) {
            lines.push(`${m.name} 빈사!`);
            m.entry = '';
          }
        }
      }
    for (const mid in b.mons) {
      const m = b.mons[mid];
      if (!m.entry || m.hp.cur <= 0) continue;
      const st = m.states || {};
      /* 10-26 망령: 「반동 : 행동불능」으로 쉬는 턴에도 「난동부리기」는 줄어든다 */ if (+st.Recharge === 1 && st.Thrash) {
        const tv = +st.Thrash;
        if (tv <= 1) {
          delete st.Thrash;
          relAdd(m, '「난동부리기」');
        } else if (tv < 1000) st.Thrash = tv - 1;
      }
      const KS = keepSt(m);
      for (const k in st) {
        const v = +st[k];
        const def = db[k] || {};
        if (KS.includes(k)) continue;
        if ((def.prog === 'turn' || def.prog === 'once') && !movesDown(k, def) && !cntSt(k, def) && v > 0 && v < 1000) {
          /* 10-23 망령: 「다음 기술 한 번」 상태(악인 · 송전 · 자세잡기 …)도 행동 안 했으면 턴 종료에 준다 */ st[k] = v - 1;
          if (st[k] <= 0) {
            delete st[k];
            if (k === 'Disable') chainFree(m, lines);
            if (m.futRsv && m.futRsv.st === k) futs.push(m);
            else if (futDone.get(mid) !== k) relAdd(m, `「${def.ko || k}」`);
          }
        }
      }
      /* 임시 랭크 해제 */
      if (m.tempRank) {
        for (const k in m.tempRank) {
          {
            const lim = k === 'critical' ? 4 : 6;
            m.rank[k] = Math.max(-lim, Math.min(lim, (+m.rank[k] || 0) - (+m.tempRank[k] || 0)));
          }
        }
        delete m.tempRank;
        relAdd(m, '임시 랭크');
      }
      if (m.tempMod) {
        for (const k in m.tempMod) {
          m.mod[k] = Math.round(((+m.mod[k] || 1) / (+m.tempMod[k] || 1)) * 1000) / 1000;
          if (Math.abs(m.mod[k] - 1) < 0.002) delete m.mod[k];
        }
        delete m.tempMod;
      }
      if (m.fx && m.fx.mults && m.fx.mults.some(e => e.temp)) m.fx.mults = m.fx.mults.filter(e => !e.temp);
      if (m.flags) {
        if (endHalf(m) && m.futRsv) m._fe = 1;
        delete m.flags;
      }
      m.started = false;
    }
    for (const m of futs) lines.push(...futureFire(b, m));
    if (FX()) lines.push(...FX().turnEnd(b));
    /* 11-22 망령 「특성 엔진 처리」: 돌재생 = 「소지품 : -」일 때 턴 종료 시 「딱딱한돌」 · 픽업 = 다른 포켓몬이 「소지품」을 소비한 턴 종료 시 그 소지품을 가진다 (지닌 것이 없을 때 · 이번 턴 가장 나중에 본 것). 배틀에서 얻은 것(itemGot)으로 — 결과 정리 때 시트에 넣지 않는다 */
    try {
      const T = +b.turn || 0;
      const DBI = DB().items || {};
      const nI = v =>
        String(v || '')
          .replace(/[『』]/g, '')
          .trim();
      const give = (m, n, eff, why) => {
        if (m.itemUsed && !m.itemUsed0 && !(m.itemGot || []).includes(nI(m.itemUsed.name))) m.itemUsed0 = m.itemUsed;
        m.item = n;
        m.itemEff = eff != null && eff !== '' ? eff : String((DBI[n] || {}).eff || '');
        m.itemGot = [...(m.itemGot || []), n];
        lines.push(`${m.name} 「${why}」 — 「${n}」을(를) 지녔다`);
      };
      /* 11-23 특성 공생: 아군이 「소지품」을 소비하면(이번 턴) 자신의 소지품을 건네준다 — 턴 종료 때 처리 */
      for (const g of Object.values(b.mons || {})) {
        if (!g || !g.entry || !(g.hp && g.hp.cur > 0) || !nI(g.item) || abNm(g).replace(/『|』|\s/g, '') !== '공생') continue;
        const al = Object.values(b.mons || {}).find(
          x => x && x.id !== g.id && x.entry && x.hp && x.hp.cur > 0 && sameT(x, g, b) && !nI(x.item) && x.itemUsed && +x.itemUsed.turn === T
        );
        if (!al) continue;
        const it = nI(g.item),
          ef = g.itemEff || '';
        g.item = '';
        g.itemEff = '';
        give(al, it, ef, '공생 (' + g.name + ')');
      }
      for (const m of Object.values(b.mons || {})) {
        if (!m || !m.entry || !(m.hp && m.hp.cur > 0) || nI(m.item)) continue;
        const ab = abNm(m);
        if (ab === '돌재생') give(m, '딱딱한돌', null, '돌재생');
        else if (ab === '픽업') {
          const used = Object.values(b.mons || {}).filter(x => x && x.id !== m.id && x.itemUsed && +x.itemUsed.turn === T && nI(x.itemUsed.name));
          if (used.length) {
            const u = used[used.length - 1].itemUsed;
            let rc = m;
            /* 11-23 망령 (디컨 브로디 『낮에는 장인의 모습』 「「특성 : 픽업」으로 착용할 소지품의 대상을 아군으로 변경할 수 있다」): 등장 때 「적용」을 골랐고 소지품이 빈 아군이 필드에 있으면 그 아군에게 */ try {
              const gv = FX() && FX().traitMods ? FX().traitMods(m).give : '';
              if (gv) {
                const pp = potSrc(m, 1).find(q => q && q.name === gv);
                const L = pp ? limOf(pp, m.potUses || {}, m.potTurn || {}) : { left: null };
                const al = Object.values(b.mons || {}).find(
                  x => x && x.id !== m.id && x.entry && x.hp && x.hp.cur > 0 && sameT(x, m, b) && !nI(x.item)
                );
                if (al && (L.left === null || L.left > 0)) {
                  rc = al;
                  if (pp && /【\s*보급\s*】/.test(String(pp.eff || ''))) {
                    m.potTurn = m.potTurn || {};
                    m.potTurn._sup = Object.assign({}, m.potTurn._sup || {}, { [pp.name]: 1 });
                  }
                  lines.push(`【포텐셜】 ${m.name} 『${gv}』 — 「픽업」으로 주운 소지품을 ${al.name}에게`);
                }
              }
            } catch (e) {
              console.warn('픽업 아군', e);
            }
            give(rc, nI(u.name), u.eff || '', '픽업');
          }
        }
      }
    } catch (e) {
      console.warn('돌재생 · 픽업', e);
    }
    const raidL = [];
    for (const mid in b.mons) {
      const m = b.mons[mid];
      const R = m.raid;
      if (!R || !(+R.segments > 0)) continue;
      if (m.hp.cur > 0 && (R.brk || R.cond === 'every')) raidL.push(...raidPhase(b, m, '턴 종료 이후'));
      delete R.brk;
    }
    for (const mid in b.mons) {
      delete b.mons[mid].flags;
    }
    const dec = (o, k) => {
      if (o[k] > 0 && o[k] < 1000) {
        o[k]--;
        if (o[k] <= 0) {
          delete o[k];
          return true;
        }
      }
      return false;
    };
    if (f.weather.type && f.weather.count > 0) {
      f.weather.count--;
      if (f.weather.count <= 0) {
        fieldL.push(`날씨 「${f.weather.type}」 끝`);
        f.weather = { type: '', count: 0 };
      }
    }
    if (f.terrain.type && f.terrain.count > 0) {
      f.terrain.count--;
      if (f.terrain.count <= 0) {
        fieldL.push(`「${f.terrain.type}」 끝`);
        f.terrain = { type: '', count: 0 };
      }
    }
    if (window.OM_STAGE_UI) fieldL.push(...window.OM_STAGE_UI.turnEnd(b, f));
    else if (f && f.stage && f.stage.name) {
      /* 11-15 필드 전개 창이 없는 곳(시뮬): 남은 턴만 줄이고 걷는다 */ const s0 = f.stage;
      if (s0.count > 0 && s0.count < 1000) {
        s0.count--;
        if (s0.count <= 0) {
          fieldL.push(`《${s0.name}》의 풍경이 옅어져 간다…`);
          try {
            if (FX()) for (const m of Object.values(b.mons || {})) FX().removeByName(m, '《' + s0.name + '》');
          } catch (e) {}
          delete f.stage;
        }
      }
    }
    for (const k of ROOMS) if (dec(f.rooms, k)) fieldL.push(`「${k}」 끝`);
    for (const k of ETC) if (dec(f.etc, k)) fieldL.push(`「${k}」 끝`);
    for (const s of SIDES) {
      f.objects[s] = f.objects[s] || {};
      for (const k in f.objects[s])
        if (!/^haz/.test(objCat(k)[0]) /* 10-24 제보: 설치기(압정뿌리기 · 독압정의 「겹」 수)는 턴으로 줄지 않는다 */ && dec(f.objects[s], k))
          fieldL.push(`${SIDE_KO[s]} 「${k}」 끝`);
    }
    /* 11-04 19:0x 망령 「윤회의 법계 2번 효과로 임의로 발동 못 시켜 지금?」: 『윤회의 법계』 ② 「방어」 상태가 아닌 아군에 대하여 턴 종료 시에 이 포텐셜에 【임의】를 부여한다.
     턴 종료에 (남은 횟수 · 이번 턴에 5계를 안 썼다 · 「방어」(지키기 계열) 아닌 아군이 필드에 있다) 이면 다음 턴 개시 전까지 「포텐셜 발동 → 임의 발동」을 연다 (b.rinne).
     같은 턴에 치유의 법계 등 다른 5계를 썼으면 열지 않는다 (망령 11-04 10:03 「같이 못 쓰지」) */
    const RN = {},
      rnL = [];
    {
      const fam5 = (t, k) => {
        const r = potRowOf(pName(b0, t, 'order', k));
        return !!r && r[0] === '5계';
      };
      for (const tid in b.trainers || {}) {
        const k = pKeys(b0, tid, 'order').find(q => pName(b0, tid, 'order', q) === '윤회의 법계');
        if (!k || !(pN(b0, tid, 'order_' + k) > 0)) continue;
        const fd = ((b0.cmds || {})[tid] || {}).fired || {};
        if (Object.values(fd).some(x => x && x.order && fam5(tid, x.order))) continue;
        const al = Object.values(b0.mons || {}).filter(
          m => m.tid === tid && m.entry && +(m.hp || {}).cur > 0 && !(m.flags || {}).protect && !(m.states || {}).Protect
        );
        if (!al.length) continue;
        RN[tid] = Object.assign({}, RN[tid] || {}, { o: k });
        rnL.push(
          `${(b.trainers[tid] || {}).name || tid} — 『윤회의 법계』 ② 【임의】 (남은 ${pN(b0, tid, 'order_' + k)}) · 「방어」 아닌 아군: ${al.map(m => m.name).join(' · ')} — 다음 턴 개시 전까지 「포텐셜 발동 → 임의 발동」`
        );
      }
    }
    {
      /* 11-04 19:27 망령 「숙달회복 임의로 턴 종료 시에 쓰는 것도 비슷하게」: 『숙달회복지령』 ② 『지령』을 사용하지 않은 턴 종료 시 【임의】 — 그 턴에 6령(지령)을 하나도 안 썼고 횟수가 남았으면 같은 창을 연다 */
      for (const tid in b.trainers || {}) {
        const k = pKeys(b0, tid, 'command').find(q => pName(b0, tid, 'command', q) === '숙달회복지령');
        if (!k || !(pN(b0, tid, 'command_' + k) > 0)) continue;
        const fd = ((b0.cmds || {})[tid] || {}).fired || {};
        if (Object.values(fd).some(x => x && x.command)) continue; /* 영창도 『지령』과 같은 처리 분류 — 쓴 턴엔 안 열린다 (망령 11-04 19:29) */
        const al = Object.values(b0.mons || {}).filter(m => m.tid === tid && m.entry && +(m.hp || {}).cur > 0);
        if (!al.length) continue;
        RN[tid] = Object.assign({}, RN[tid] || {}, { c: k });
        rnL.push(
          `${(b.trainers[tid] || {}).name || tid} — 『숙달회복지령』 ② 【임의】 (남은 ${pN(b0, tid, 'command_' + k)}) — 『지령』을 안 쓴 턴 · 다음 턴 개시 전까지 「포텐셜 발동 → 지령 → 임의 발동 ②」`
        );
      }
    }
    /* 11-11 통솔 대가 A-1 (게으름 꼴): 턴 종료 때 필드 위 각성 (대가)의 조건을 보고, 맞으면 다음 턴 1턴 행동 불능 · 포텐셜 불발 */
    {
      const T = +b.turn || 0;
      for (const mid in b.mons) {
        const m = b.mons[mid];
        if (!m) continue;
        const on = m.entry && m.hp && m.hp.cur > 0;
        const w = on ? misagA1Cond(b, m) : '';
        if (w) {
          m.a1Lock = { t: T + 1, why: w };
          lines.push(`${m.name} 『A-1』 — ${w.replace(/^각성체 대가 A-1 — /, '').replace(/\s*행동 불능$/, '')} → 다음 턴 행동 불능 (교대는 된다)`);
        } else if (m.a1Lock && +m.a1Lock.t <= T + 1 && !(+m.a1Lock.t === T + 1)) delete m.a1Lock;
      }
    }
    b.field = f;
    b.cmds = {};
    b.order = [];
    b.phase = 0;
    b.turn = (+b.turn || 0) + 1;
    delete b.deadline;
    CMD = {};
    if (rnL.length) b.rinne = { turn: turnKey(b), t: RN };
    else delete b.rinne;
    await saveBattle(b0, b, undefined, undefined, [[['ready'], {}]]); /* 11-03: ready 비우기도 같은 묶음에 */
    cutPhase('턴 종료', `다음 턴 ${b.turn} · 지시 준비`);
    const sec = (h, L) => (L.length ? [`▸ ${h}`, ...L.map(x => '  ' + String(x).replace(/\n/g, '\n  '))] : []);
    const relL = Object.keys(rel).map(n => `${n} — ${rel[n].join(' · ')}`);
    const body = [...sec('포켓몬', lines), ...sec('풀린 것', relL), ...sec('필드', fieldL), ...sec('레이드', raidL), ...sec('【임의】', rnL)];
    /* 11-03 감우 (검토 7): HP 가 바뀐 포켓몬을 순서대로 카드에 실어 보낸다 — 받는 화면마다 0.4s 간격으로 연출 (logFx · seqFx) */
    const seq = [];
    for (const mid in b.mons) {
      const m = b.mons[mid],
        o = (b0.mons || {})[mid];
      if (!o || !o.hp || !m.hp || +o.hp.cur === +m.hp.cur) continue;
      seq.push({ mid, name: m.name, prev: +o.hp.cur, cur: +m.hp.cur, max: +m.hp.max || 1 });
    }
    A().sysLog(
      `【턴 ${b.turn - 1} 종료】${body.length ? '\n' + body.join('\n') : '\n  처리할 것 없음'}\n— 턴 ${b.turn} 지시 준비`,
      'battle',
      seq.length ? { seq } : undefined
    );
  }

