  /* ── 조각 07_time.js — 타임(묘수) ── */
  /* ---------- 묘수 = 「타임」 (맵툴 command_expert): 지시 준비 페이즈에, 상대 트레이너가 준비를 마치면 상대 포켓몬 하나의 지시 꼴(교대/기술)을 본다.
     횟수는 배틀마다 지시 랭크로(A 1회 · AA 이상 2회) + 포켓몬의 timeAlly/timeEnemy 보정. 한 턴에 한 대상만(다시 보기는 자유). 양쪽이 같은 턴에 쓰면 둘 다 그 턴은 더 못 쓴다. 쓰고 나면 READY 여도 지시를 고칠 수 있다 ---------- */
  /* 11-24 망령 (아스트라이아 고유): ①「【탈진】/①트레이너가 「타임」을 사용할 수 있다. ②시합 중 이미 ①의 효과를 받은 상대는 이 효과를 받지 않는다.」
     = **트레이너 고유**가 주는 「타임」 — 지시 랭크 횟수(used)와 별도, 조건(【탈진】 · 아직 안 받은 상대)이 맞으면 횟수 제한 없음(09:41 결정). 받은 상대는 time.uq[포켓몬 id] (시합 동안).
     ②「「타임」을 사용한 턴 확인한 상대에게 아래의 효과 중 하나를 선택하여 적용한다. ①기술을 선언한다. 대상이 그 기술을 내보낼 경우 실패한다. ②교대할 포켓몬을 선언한다. 대상이 그 포켓몬과 교대하려 할 경우 대상을 「검은눈빛」 상태로 만든다.」
     = 타임을 쓴 뒤 묘수 창에서 선언 → time.decl={t,mid,src,mv|sw,swn}. 그 턴: 선언한 기술은 공격 창에서 실패 · 선언한 포켓몬과의 통상 교대는 교대 알림 앞에서 「검은눈빛」을 걸고 뺀다. 글을 읽어 동작한다(구문 없음). */
  const UQTIME_RE = /트레이너가\s*「타임」\s*(?:을|를)\s*사용할\s*수\s*있다/;
  const TDECL_RE = /「타임」[^\n]{0,24}확인한\s*상대에게[^\n]*선택/;
  /* 구문 「타임사용」 · 「타임선언 [기술] [교대]」(fx k timeuq · timedecl)이 그 고유에 있으면 구문을 따르고, 없으면 글을 읽는다 */
  function uqOps(t, x, k) {
    try {
      return ((x.p.auto || {}).ops || []).find(o => o && o.k === k) || null;
    } catch (e) {
      return null;
    }
  }
  function uqTime(t) {
    try {
      return uniqList(t).find(x => uqOps(t, x, 'timeuq') || UQTIME_RE.test(String(x.p.eff || ''))) || null;
    } catch (e) {
      return null;
    }
  }
  function uqDecl(t) {
    try {
      for (const x of uniqList(t)) {
        const o = uqOps(t, x, 'timedecl');
        const e = String(x.p.eff || '');
        if (o) return Object.assign({}, x, { dmv: !!o.mv, dsw: !!o.sw });
        if (TDECL_RE.test(e) && /기술을\s*선언/.test(e)) return Object.assign({}, x, { dmv: true, dsw: /교대할\s*포켓몬을\s*선언/.test(e) });
      }
    } catch (e) {}
    return null;
  }
  function tdeclOf(b, m) {
    const T = +(b || {}).turn || 0;
    if (!T || !m) return null;
    for (const t of Object.values((b && b.trainers) || {})) {
      const d = t && t.time && t.time.decl;
      if (d && +d.t === T && d.mid === m.id) return d;
    }
    return null;
  }
  /* 11-24 망령 결정 「「타임」 사용을 기본으로 숨길까요? 응.」: 「타임」을 썼다는 로그(【묘수】 · 고유 타임 · 옛 요청/허가)는 쓴 쪽 주인 + GM 에게만(gmPriv 귓속말).
     「상대의 「타임」 발동 여부를 확인할 수 있다」 글을 가진 상대 쪽(포켓몬 포텐셜 · 전용 — 태그 없으면 필드 위 · 【지원】 볼 안 · 【지원 (상위)】 둘 다 / 트레이너 고유)에게는 그 주인에게만 알림.
     선언(고유 ②)도 숨김(12:31 결정) — 실패 · 검은눈빛이 걸리는 순간의 로그만 공개. 시간 정지처럼 효과가 눈에 보이는 것은 그대로 공개. 양쪽이 같은 턴에 써서 막히는 안내도 그대로(룰상 드러남). */
  const TIMESEE_RE = /상대의\s*「타임」\s*(?:의\s*)?발동\s*여부를\s*확인/;
  function timePriv(b, tid) {
    const o =
      Object.values((b && b.mons) || {}).find(x => x && x.tid === tid && x.entry) || Object.values((b && b.mons) || {}).find(x => x && x.tid === tid);
    return o ? { mid: o.id, img: '', gmPriv: 1 } : { img: '', gmPriv: 1 };
  }
  /* 11-24 망령 「상대의 선행 입력한 포텐셜을 확인할 수 있다 — 고유 4식 지령류들 다」: 이 글을 가진 쪽이 상대에 있을 때만, 준비 완료 때 지시 꼴(shape)과 같이 선행 입력(명령 = 4식 · 지령 = 6령 · 포켓몬 포텐셜/전용 · 트레이너 고유)의 이름을 pub[tid].pre 에 올린다. 보는 곳 = 그 글을 가진 트레이너의 묘수 창(+ GM). 화면에서만 가리는 칸(shape 와 같은 수준). */
  const PRESEE_RE = /상대(?:의|가)\s*선행\s*입력한\s*(?:포텐셜|것)(?:을|를)\s*확인/;
  /* 트레이너 e 쪽에 그 글(RE)이 살아 있나: 포켓몬 포텐셜 · 전용(태그 없으면 필드 위 · 【지원】 볼 안 · 【지원 (빈사)】 빈사여도 · 【지원 (상위)】 둘 다) → 없으면 트레이너 고유 */
  function seeHas(b, e, RE) {
    for (const m of Object.values((b && b.mons) || {})) {
      if (!m || m.tid !== e) continue;
      const p = potSrc(m, true).find(q => q && RE.test(String(q.eff || '')));
      if (!p) continue;
      const alive = !!(m.hp && m.hp.cur > 0);
      if (supKind(p.eff) ? supLive(m, p) : !!m.entry && alive) return { m, name: p.name, who: m.name };
    }
    const t = ((b && b.trainers) || {})[e];
    const u = ((t && t.unique) || []).find(q => q && RE.test(String(q.eff || '')));
    const any = u && (Object.values(b.mons || {}).find(x => x && x.tid === e && x.entry) || Object.values(b.mons || {}).find(x => x && x.tid === e));
    return u && any ? { m: any, name: u.name, who: t.name } : null;
  }
  function timeSeers(c, tid) {
    return enemyTids(c, tid)
      .map(e => seeHas(c.b, e, TIMESEE_RE))
      .filter(Boolean);
  }
  function timeTell(c, tid) {
    try {
      const t = (c.b.trainers || {})[tid] || {};
      for (const s of timeSeers(c, tid))
        A().sysLog(
          `【포텐셜】 ${s.who} 『${String(s.name || '').replace(/[『』]/g, '')}』 — 상대 ${t.name || '트레이너'}이(가) 이번 턴 「타임」을 사용했다`,
          'battle',
          { mid: s.m.id, img: '', gmPriv: 1 }
        );
    } catch (e) {}
  }
  function timeOf(t, turn) {
    const x = (t && t.time) || {};
    const same = (+x.turn || 0) === turn;
    return {
      used: +x.used || 0,
      forced: +x.forced || 0,
      sw: same ? +x.sw || 0 : 0,
      target: same ? x.target || '' : '',
      uq: Object.assign({}, x.uq || {})
    };
  }
  function timeLimit(c, tid) {
    const b = c.b;
    const t = (b.trainers || {})[tid];
    if (!t) return 0;
    let mod = 0;
    for (const m of Object.values(b.mons || {})) {
      if (!m.entry) continue;
      if (m.tid === tid && m.hp && m.hp.cur > 0 && timeGrant(m)) mod += 1;
      if (sameT(m, tid, b)) mod += +(m.timeAlly || 0);
      else mod += +(m.timeEnemy || 0);
    }
    return Math.max(0, timeCount(t) + mod);
  }
  function enemyTids(c, tid) {
    const b = c.b;
    const t = (b.trainers || {})[tid] || {};
    return Object.keys(b.trainers || {}).filter(k => k !== tid && (b.trainers[k] || {}).side && !sameT(k, tid, b));
  }
  function timeBlocked(c, tid) {
    const b = c.b;
    const turn = +b.turn || 0;
    const my = timeOf(b.trainers[tid], turn);
    if (my.sw === 2) return true;
    return my.sw >= 1 && enemyTids(c, tid).some(e => timeOf(b.trainers[e], turn).sw >= 1);
  }
  function myosuGlow(c, tid) {
    const b = c.b;
    if ((+b.phase || 0) !== 0) return false;
    const t = b.trainers[tid];
    if (!t) return false;
    const my = timeOf(t, +b.turn || 0);
    if (timeBlocked(c, tid)) return false;
    if (my.sw === 0 && my.used >= timeLimit(c, tid)) return false;
    const rd = c.ST.state.ready || {};
    return enemyTids(c, tid).some(e => rd[e]);
  }
  const SHAPE_KO = { switch: '교대하려고 한다…', move: '기술을 내보내려고 한다…', none: '움직일 기색이 없다…' };
  function openMyosu(tid, pick) {
    const c = ctx();
    const b = c.b;
    const t = (b.trainers || {})[tid];
    if (!t) return;
    if (!(c.mgr || ownT(c, tid))) return;
    const turn = +b.turn || 0;
    const phase = +b.phase || 0;
    const my = timeOf(t, turn);
    const lim = timeLimit(c, tid);
    const rd = c.ST.state.ready || {};
    const blocked = timeBlocked(c, tid);
    const enemies = Object.values(b.mons || {})
      .filter(m => m.entry && m.hp.cur > 0 && !sameT(m, tid, b))
      .sort((x, y) => String(x.entry).localeCompare(String(y.entry)));
    const left = Math.max(0, lim - my.used);
    const UQ = uqTime(t),
      DQ = uqDecl(t);
    const uqFree = !!UQ && (UQ.left === null || UQ.left > 0);
    const uqOk = m => uqFree && !!m && !my.uq[m.id];
    const why = m => {
      if (phase !== 0) return '지시 준비 페이즈에만';
      if (blocked) return '이번 턴은 더 못 쓴다';
      if (!rd[m.tid]) return '상대가 아직 준비 전';
      if (my.sw === 1 && my.target && my.target !== m.id) return '이번 턴은 「' + (monName(b, my.target) || '?') + '」만';
      if (my.sw === 0 && my.used >= lim && !uqOk(m))
        return UQ && my.uq[m.id]
          ? '횟수를 다 썼다 · 고유 「타임」은 이미 받은 상대'
          : UQ && !uqFree
            ? '횟수를 다 썼다 · 고유 「타임」은 【탈진】 중'
            : lim
              ? '횟수를 다 썼다'
              : '지시 ' + (t.ranks['지시'] || '-') + ' 는 「타임」 0회';
      return '';
    };
    const md = A()
      .openModal(`<div class="mhead"><h2>묘수 · 「타임」 <span class="small dim">${esc(t.name)}</span></h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="row small" style="gap:10px;flex-wrap:wrap"><span>지시 <b>${esc(t.ranks['지시'] || '-')}</b></span><span>이 배틀 남은 횟수 <b style="color:var(--yel2)">${left}</b> / ${lim}${my.forced ? ` <span class="dim">(강제 ${my.forced})</span>` : ''}</span><span class="dim">이번 턴 ${my.sw === 0 ? '아직 안 씀' : my.sw === 1 ? '사용 — 「' + esc(monName(b, my.target) || '?') + '」' : '사용 불가'}</span></div>
   ${
     UQ
       ? `<div class="row small" style="gap:8px;flex-wrap:wrap;margin-top:6px"><span class="tag uqt">고유</span><b>『${esc(UQ.p.name)}』</b><span class="dim">지시 횟수와 별도 · 조건이 맞으면 횟수 제한 없음 — ${uqFree ? '지금 쓸 수 있다' : '【탈진】 — 이번 턴은 못 쓴다'}${
           Object.keys(my.uq).length
             ? ` · 이미 받은 상대 ${Object.keys(my.uq)
                 .map(id => esc(monName(b, id) || '?'))
                 .join(', ')}`
             : ''
         }</span><label title="켜 두면 아직 이 고유를 받지 않은 상대에게는 지시 횟수 대신 고유로 「타임」을 쓴다 (【탈진】)"><input type="checkbox" id="tmUq" ${uqFree ? 'checked' : 'disabled'}> 고유로 쓴다</label></div>`
       : ''
   }
   ${(() => {
     const PS = seeHas(b, tid, PRESEE_RE);
     if (!PS) return '';
     const rows = enemyTids(c, tid)
       .map(e => {
         const et = b.trainers[e] || {};
         const pr = ((c.ST.state.pub || {})[e] || {}).pre;
         if (!rd[e]) return `<div class="small"><b>${esc(et.name || e)}</b> <span class="dim">— 아직 준비 전</span></div>`;
         const ok = pr && (+pr.turn || 0) === turn;
         const L = ok
           ? [
               ...(pr.u || []).map(n => `고유 『${esc(n)}』`),
               ...Object.entries(pr.mons || {}).map(([mid, a]) => {
                 const mm = b.mons[mid];
                 return `${mm ? (secret(c, mm) ? '상대 포켓몬' : esc(mm.name)) : '?'}: ${(a || []).map(esc).join(' · ')}`;
               })
             ]
           : [];
         return `<div class="small"><b>${esc(et.name || e)}</b> — ${L.length ? L.join(' / ') : '<span class="dim">선행 입력 없음</span>'}</div>`;
       })
       .join('');
     return `<div class="card" style="margin-top:8px"><div><span class="tag uqt">포텐셜</span> <b>『${esc(String(PS.name || '').replace(/[『』]/g, ''))}』</b> <span class="small dim">— 상대의 선행 입력 (준비 완료한 상대)</span></div>${rows || '<div class="small dim">상대가 없다</div>'}</div>`;
   })()}
   ${blocked ? '<div class="card" style="border-color:var(--red);margin-top:8px">양 트레이너가 서로의 수를 읽고 있다는 것을 눈치챘다 — 이번 턴은 「타임」을 더 쓸 수 없다.</div>' : ''}
   <div class="sec" style="margin-top:10px">상대 포켓몬 <span class="note">상대 트레이너가 「준비 완료」를 누른 뒤에만 볼 수 있다 · 보이는 건 교대인지 기술인지뿐</span></div>
   <div class="pg">${
     enemies
       .map(m0 => {
         const m = V(c, m0);
         const w = why(m0);
         const seen = my.sw >= 1 && my.target === m.id;
         return `<div class="pc ${w ? 'dis' : ''} ${seen ? 'on' : ''}" data-tm="${m.id}" title="${esc(w || '엿본다')}"><div class="pic" style="${m.image ? `background-image:url('${cssu(m.image)}')` : ''}"></div><div><b>${secret(c, m) ? '비공개' : esc(m.name)}</b><div class="small dim">${SIDE_KO[m.side]} ${String(m.entry).toUpperCase()} · ${esc((b.trainers[m.tid] || {}).name || '')} ${rd[m.tid] ? '<span class="tag ok">READY</span>' : '<span class="dim">준비 전</span>'}</div>${w ? `<div class="small" style="color:var(--red)">${esc(w)}</div>` : seen ? '<div class="small" style="color:var(--yel2)">다시 보기</div>' : ''}</div></div>`;
       })
       .join('') || '<div class="dim small">상대 포켓몬이 없다</div>'
   }</div>
   <div class="row small" style="margin-top:10px"><label title="횟수가 다 떨어졌어도 GM 재량으로 쓴다 (강제 사용 횟수로 따로 센다)"><input type="checkbox" id="tmForce" ${c.gm ? '' : 'disabled'}> 강제 사용 (GM)</label><span class="sp"></span>${c.gm ? `<button class="btn xs ghost" id="tmReset" title="이 트레이너의 「타임」 횟수를 초기화">횟수 초기화</button>` : ''}</div>
   <div id="tmRes"></div>`);
    if (pick) {
      const el = md.querySelector(`[data-tm="${pick}"]`);
      if (el) el.scrollIntoView();
    }
    const resetT = $('#tmReset', md);
    if (resetT)
      resetT.onclick = async () => {
        if (!confirm('「타임」 횟수를 초기화할까?')) return;
        await A().set(['battle', 'trainers', tid, 'time'], null);
        A().closeModal();
        A().sysLog(`${t.name} 「타임」 횟수 초기화`, 'battle');
      };
    md.querySelectorAll('[data-tm]').forEach(
      el =>
        (el.onclick = async () => {
          const m = ctx().b.mons[el.dataset.tm];
          if (!m) return;
          const force = !!($('#tmForce', md) && $('#tmForce', md).checked);
          const w = why(m);
          if (w && !(force && /횟수|0회/.test(w))) return A().toast(w);
          const again = my.sw >= 1 && my.target === m.id;
          const useUq = !again && my.sw === 0 && !!($('#tmUq', md) && $('#tmUq', md).checked) && uqOk(m);
          if (!again && my.sw === 0 && my.used >= lim && !force && !useUq)
            return A().toast(`머리가 아파 더 이상 「타임」을 쓸 수 없다 (최대 ${lim}번)`);
          const shape = ((ctx().ST.state.pub || {})[m.tid] || {}).shape;
          const sh = shape && (+shape.turn || 0) === turn ? shape.mons[m.id] : null;
          if (!sh && !c.mgr) return A().toast('상대의 지시가 아직 저장되지 않았다');
          if (!again) {
            const nt = {
              used: my.used + (useUq || (force && my.used >= lim) ? 0 : 1),
              forced: my.forced + (!useUq && force && my.used >= lim ? 1 : 0),
              turn,
              sw: 1,
              target: m.id,
              uq: Object.assign({}, my.uq, useUq ? { [m.id]: 1 } : {})
            };
            const enemyUsed = enemyTids(c, tid).some(e => timeOf(ctx().b.trainers[e], turn).sw >= 1);
            if (enemyUsed) nt.sw = 2;
            const ok = await A().set(['battle', 'trainers', tid, 'time'], nt);
            if (!ok) return;
            if (useUq) {
              if (UQ.per) await A().set(['battle', 'trainers', tid, 'uTurn', UQ.p.name], turn);
              my.uq[m.id] = 1;
              A().sysLog(`【고유】 ${t.name} 『${UQ.p.name}』 — 「타임」을 사용한다 (지시 횟수를 쓰지 않는다)`, 'battle', timePriv(ctx().b, tid));
            }
            try {
              for (const x of Object.values(ctx().b.mons || {})) {
                if (!x || x.tid !== tid || !x.entry || !x.hp || !(x.hp.cur > 0) || x.tstop) continue;
                const pp = potSrc(x).find(p => p && TSTOP_RE.test(String(p.eff || '')));
                if (!pp) continue;
                await A().set(['battle', 'mons', x.id, 'tstop'], { t: turn });
                A().sysLog(
                  `${x.name} 「${String(pp.name || '').replace(/[『』]/g, '')}」 — 「타임」이 발동한 턴, ${x.name} 이외는 이번 턴 행동 불능`,
                  'battle',
                  { mid: x.id }
                );
                break;
              }
            } catch (_) {}
            A().sysLog(
              `【묘수】 ${t.name} 「타임」 → ${secret(c, m) ? '상대 포켓몬' : m.name}\n이 배틀 ${nt.used}/${lim}${nt.forced ? ' · 강제 ' + nt.forced : ''}${useUq ? ' · 고유' : ''}`,
              'battle',
              timePriv(ctx().b, tid)
            );
            timeTell(ctx(), tid);
            if (enemyUsed) A().sysLog('양 트레이너는 서로가 서로의 수를 읽고 있다는 것을 눈치챘다!', 'battle');
            my.sw = nt.sw;
            my.target = m.id;
            my.used = nt.used;
          }
          const mv_ = V(c, m);
          const txt = sh ? `「${mv_.name}」${sh === 'none' ? '은(는) ' : '은(는) '}${SHAPE_KO[sh]}` : '(GM) 저장된 지시 꼴이 없다';
          $('#tmRes', md).innerHTML =
            `<div class="card hit" style="margin-top:10px"><div class="row" style="gap:10px"><div class="ti" style="${mv_.image ? `background-image:url('${cssu(mv_.image)}')` : ''}"></div><div style="flex:1"><div class="small dim">타임 결과 · 턴 ${turn}</div><b style="font-size:16px">${esc(txt)}</b></div></div></div>`;
          md.querySelectorAll('[data-tm]').forEach(x => x.classList.toggle('on', x.dataset.tm === m.id));
          /* 11-24 「타임」을 사용한 턴 확인한 상대에게 선언 (고유 ②) — 이번 턴 이 상대에게 한 번 */
          if (DQ) {
            const box = document.createElement('div');
            $('#tmRes', md).appendChild(box);
            const paint = () => {
              const bb = ctx().b;
              const tm = (bb.mons || {})[m.id] || m;
              const cur = tdeclOf(bb, tm);
              const mine = cur && cur.by === tid;
              if (cur) {
                box.innerHTML = `<div class="card" style="margin-top:8px"><span class="tag uqt">고유</span> <b>『${esc(cur.src || DQ.p.name)}』</b> — ${cur.mv ? `기술 「${esc(cur.mv)}」 선언 · 이번 턴 그 기술을 내보내면 실패한다` : `교대 「${esc(cur.swn || '?')}」 선언 · 이번 턴 그 포켓몬과 교대하려 하면 「검은눈빛」 상태가 된다`}${mine ? '' : ' <span class="dim small">(다른 트레이너의 선언)</span>'}</div>`;
                return;
              }
              const hid = secret(c, tm);
              const mvs = hid
                ? []
                : MVS(tm)
                    .filter(x => x && x.name)
                    .map(x => x.name);
              const bench = Object.values(bb.mons || {}).filter(x => x && x.tid === tm.tid && !x.entry && x.hp && x.hp.cur > 0);
              box.innerHTML = `<div class="card" style="margin-top:8px"><div><span class="tag uqt">고유</span> <b>『${esc(DQ.p.name)}』</b> <span class="small dim">— 확인한 상대에게 하나를 골라 선언한다 (이번 턴)</span></div>
      ${DQ.dmv === false ? '' : `<div class="row small" style="gap:6px;flex-wrap:wrap;margin-top:6px"><span>① 기술</span>${mvs.length ? `<select id="tdMv" style="flex:1;min-width:120px">${mvs.map(n => `<option>${esc(n)}</option>`).join('')}</select>` : `<input type="text" id="tdMv" placeholder="기술 이름" style="flex:1;min-width:120px">`}<button class="btn xs pri" data-td="mv">기술 선언</button></div>`}
      ${DQ.dsw === false ? '' : `<div class="row small" style="gap:6px;flex-wrap:wrap;margin-top:6px"><span>② 교대</span>${bench.length ? `<select id="tdSw" style="flex:1;min-width:120px">${bench.map((x, i) => `<option value="${esc(x.id)}">${secret(c, x) ? '비공개 ' + (i + 1) : esc(x.name)}</option>`).join('')}</select><button class="btn xs pri" data-td="sw">교대 선언</button>` : '<span class="dim">교대할 소지 포켓몬이 없다</span>'}</div>`}</div>`;
              box.querySelectorAll('[data-td]').forEach(
                bt =>
                  (bt.onclick = async () => {
                    const k = bt.dataset.td;
                    const tn = secret(c, tm) ? '상대 포켓몬' : tm.name;
                    let d = null,
                      line = '';
                    if (k === 'mv') {
                      const v = String(($('#tdMv', box) || {}).value || '').trim();
                      if (!v) return A().toast('선언할 기술을 고른다');
                      d = { t: turn, by: tid, mid: tm.id, src: DQ.p.name, mv: v };
                      line = `기술 「${v}」 선언 — 이번 턴 ${tn}이(가) 그 기술을 내보내면 실패한다`;
                    } else {
                      const id = String(($('#tdSw', box) || {}).value || '');
                      const w = (ctx().b.mons || {})[id];
                      if (!w) return A().toast('선언할 포켓몬을 고른다');
                      const wn = secret(c, w) ? '비공개 포켓몬' : w.name;
                      d = { t: turn, by: tid, mid: tm.id, src: DQ.p.name, sw: id, swn: wn };
                      line = `교대 「${wn}」 선언 — 이번 턴 ${tn}이(가) 그 포켓몬과 교대하려 하면 「검은눈빛」 상태가 된다`;
                    }
                    if (!(await A().set(['battle', 'trainers', tid, 'time', 'decl'], d))) return;
                    A().sysLog(
                      `【고유】 ${t.name} 『${DQ.p.name}』 → ${tn}\n${line}`,
                      'battle',
                      timePriv(ctx().b, tid)
                    ); /* 11-24 망령 「알게 되면 의미가 없지 — 2(숨김)로」: 선언도 선언한 쪽 + GM 에게만. 상대는 기술이 실패하거나 교대가 막히는 순간에 안다 */
                    box.innerHTML = `<div class="card" style="margin-top:8px"><span class="tag uqt">고유</span> <b>『${esc(DQ.p.name)}』</b> — ${esc(line)}</div>`;
                  })
              );
            };
            paint();
          }
        })
    );
  }

  /* ---------- 타임 (GM 직접 보기 · 옛 요청 흐름) ---------- */
  function timeCount(t) {
    const lt = ((DB().const || {}).lists || {}).list_time_count || { E: 0, D: 0, C: 0, B: 0, A: 1, AA: 2, AAA: 2, S: 2 };
    const r = S().strip((t.ranks || {})['지시']);
    return +(lt[r] || 0);
  }
  async function requestTime(mid) {
    const c = ctx();
    const b = c.b;
    const m = b.mons[mid];
    if (!m) return;
    const my = c.mgr ? null : c.seat;
    const t = b.trainers[my];
    if (!c.mgr) {
      if (!t) return;
      const used = +(t.timeUsed || 0);
      if (used >= timeCount(t)) return A().toast('타임 횟수가 없다');
      if (!(await askYes(`${m.name} 의 지시를 엿볼까? (타임 ${used + 1}/${timeCount(t)})`, '엿본다'))) return;
      await A().set(['pub', my, 'time'], { mid, at: Date.now() });
      A().sysLog(`${t.name} 「타임」 요청 → ${m.name}`, 'battle', timePriv(b, my));
      return;
    }
    /* GM 은 바로 본다 */
    const rows = await DBS().secretGet(c.ST.room, c.ST.secret, 'cmd');
    const r = (rows || []).filter(x => cmdFresh(x)).find(x => x.id === m.tid);
    const x = r && r.data && r.data.mons && r.data.mons[mid];
    A().openModal(
      `<div class="mhead"><h2>타임 — ${esc(m.name)}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="pre">${esc(x ? describeCmd(b, m, x) : '아직 저장된 지시가 없다')}</div>`
    );
  }
  function describeCmd(b, m, x) {
    if (!x) return '(없음)';
    if (x.move === 'switch') return `교대 → ${monName(b, x.switch)}`;
    if (x.move === '' || x.move == null) return '(행동 없음)';
    const mv = MVS(m)[+x.move];
    return `${mv ? mv.name : '?'}${
      x.targets && x.targets.length
        ? ' → ' +
          tgNow(b, x, m)
            .map(sl => slotName(b, sl).replace(/<[^>]+>/g, ''))
            .join(', ')
        : ''
    }`;
  }
  async function grantTime(seat) {
    const c = ctx();
    if (!c.mgr) return;
    const b = c.b;
    const req = ((c.ST.state.pub || {})[seat] || {}).time;
    if (!req) return;
    const m = b.mons[req.mid];
    const t = b.trainers[seat];
    const rows = await DBS().secretGet(c.ST.room, c.ST.secret, 'cmd');
    const r = (rows || []).filter(x => cmdFresh(x)).find(x => x.id === (m || {}).tid);
    const x = r && r.data && r.data.mons && r.data.mons[req.mid];
    await DBS().secretPut(
      c.ST.room,
      c.ST.secret,
      'peek',
      seat,
      illuMask({ mid: req.mid, name: m ? m.name : '?', text: m ? describeCmd(b, m, x) : '?', turn: b.turn || 0, at: Date.now() }, b)
    ); /* 11-05 일루젼 */
    await A().set(['pub', seat, 'time'], null);
    if (t) {
      await A().set(['battle', 'trainers', seat, 'timeUsed'], (+t.timeUsed || 0) + 1);
    }
    A().sysLog(`GM: ${t ? t.name : seat} 의 「타임」 허가 (${m ? m.name : '?'})`, 'battle', timePriv(b, seat));
    if (t) timeTell(c, seat);
  }
  async function loadPeek() {
    const c = ctx();
    if (c.mgr || !c.seat) return null;
    try {
      const rows = await DBS().secretGet(c.ST.room, c.ST.secret, 'peek');
      const r = (rows || []).find(x => x.id === c.seat);
      return r ? r.data : null;
    } catch (e) {
      return null;
    }
  }

