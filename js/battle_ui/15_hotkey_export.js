  /* ── 조각 15_hotkey_export.js — 단축키 · 지금 차례 편집 · 내보내기 ── */
  /* ---------- 단축키 (prefs_ui 「배틀」 묶음에서 부른다). 처리했으면 true ----------
    「지금 차례」 = 행동 순서의 지금 칸, 없으면 내가 고칠 수 있는 첫 등장 포켓몬 */
  function nowMon(c) {
    const b = c.b;
    const o = (b.order || [])[+b.orderIdx || 0];
    if ((+b.phase || 0) >= 2 && o && b.mons[o.mid] && canEdit(c, b.mons[o.mid])) return b.mons[o.mid];
    const mine = allEntered(b)
      .map(s => s.mon)
      .filter(m => canEdit(c, m));
    return mine[0] || null;
  }
  function hotkey(act) {
    const c = ctx();
    const b = c.b;
    const md = document.querySelector('.modalbg');
    const click = sel => {
      const e = md && md.querySelector(sel);
      if (e && !e.disabled) {
        e.click();
        return true;
      }
      return false;
    };
    if (act === 'mRoll') return click('#aroll');
    if (act === 'mApply') return click('#aapply') || click('#esave');
    if (!b.trainers || !Object.keys(b.trainers).length) {
      A().toast('배틀에 나온 트레이너가 없다');
      return true;
    }
    const mgrOnly = () => {
      if (!c.mgr) A().toast('배틀 진행 권한이 없다');
      return c.mgr;
    };
    const mySeat = () => {
      const t = myTrainers(c);
      if (t.length === 1) return t[0];
      A().toast(t.length ? '트레이너가 여럿이라 단축키로는 고를 수 없다' : '내 트레이너가 없다');
      return null;
    };
    const onMon = a => {
      const m = nowMon(c);
      if (!m) {
        A().toast('고를 포켓몬이 없다');
        return true;
      }
      action({ act: a, mid: m.id });
      return true;
    };
    switch (act) {
      case 'bProgress':
        if (mgrOnly()) progressTurn();
        return true;
      case 'bNext':
        if (mgrOnly()) {
          if (!(b.order || []).length) A().toast('행동 순서가 아직 없다');
          else action({ act: 'onext' });
        }
        return true;
      case 'bPrev':
        if (mgrOnly()) action({ act: 'oprev' });
        return true;
      case 'bAttack':
        return onMon('attack');
      case 'bHp':
        return onMon('hp');
      case 'bEdit':
        return onMon('edit');
      case 'bCmd': {
        const f = document.getElementById('cmdForm');
        if (f) f.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else A().toast('지시 입력 칸이 없다');
        return true;
      }
      case 'bReady': {
        const t = mySeat();
        if (t) toggleReady(t);
        return true;
      }
      case 'bFire': {
        const t = mySeat();
        if (t) openFire(t);
        return true;
      }
      case 'bReveal':
        if (!c.gm) A().toast('모두 공개는 GM 만');
        else if ((+b.phase || 0) !== 1) A().toast('턴 개시·공개 페이즈에서만');
        else reveal();
        return true;
      case 'bField':
        if (mgrOnly()) openField();
        return true;
      case 'bTurnEnd':
        if (mgrOnly())
          askYes('턴 마무리(턴 가장 마지막 → 턴 종료 → 턴 종료 이후)로 갈까?', '간다', '아직').then(ok => {
            if (ok) endFlow();
          });
        return true;
    }
    return false;
  }
  /* ----- 상세 창의 랭크·배율·상태 (10-21 망령): 항목별 칸을 눌러 바로 조절하고, 상태는 붙이고 뗀다. 바뀐 것은 채팅 로그에 (상태는 설명까지) ----- */
  /* 10-28 망령: 배율 칸은 곱셈으로도 적는다 — 「1.2*1.5」 · 「×1.5」 · 「x1.5」. 「*」 · 「×」 로 시작하면 지금 배율에 곱한다. 「/」 로 나누기도 된다 */
  function mulOf(v, cur) {
    let t = String(v == null ? '' : v)
      .replace(/\s+/g, '')
      .replace(/[×xX＊]/g, '*')
      .replace(/÷/g, '/')
      .replace(/,/g, '.');
    if (!t) return NaN;
    let r = 1;
    if (/^[*\/]/.test(t)) r = +cur || 1;
    else t = '*' + t;
    const parts = t.match(/[*\/][^*\/]+/g);
    if (!parts || parts.join('') !== t) return NaN;
    for (const q of parts) {
      const f = +q.slice(1);
      if (!isFinite(f) || f <= 0) return NaN;
      r = q[0] === '*' ? r * f : r / f;
    }
    return Math.round(r * 1000) / 1000;
  }
  const NOW_K = ['attack', 'defense', 'specialattack', 'specialdefense', 'speed', 'accuracy', 'evasion', 'critical'];
  const NOW_MODS = [0.5, 0.67, 0.75, 1, 1.33, 1.5, 2];
  /* 11-29 망령 「여기서 전 능력치 건드리는 게 없네」: 「전 능력치」 칸 = 공격 · 방어 · 특공 · 특방 · 스피드 다섯을 한 번에 (랭크 ±1 · 곱하기) */
  const NOW_ALL = ['attack', 'defense', 'specialattack', 'specialdefense', 'speed'];
  const nowKeys = sel => (sel === 'all' ? NOW_ALL : [sel]);
  const fmtR = v => (v > 0 ? '+' : '') + v;
  const LOGQ = {};
  /* 랭크·배율은 여러 번 누르니 잠깐 모았다가 한 줄로 (바꾸기 전 값을 처음 한 번만 잡아 둔다) */
  function nowQueue(m) {
    const q = LOGQ[m.id] || (LOGQ[m.id] = { r0: Object.assign({}, m.rank || {}), m0: Object.assign({}, m.mod || {}) });
    clearTimeout(q.t);
    q.t = setTimeout(() => nowFlush(m.id), 1500);
  }
  function nowFlush(mid) {
    const q = LOGQ[mid];
    if (!q) return;
    clearTimeout(q.t);
    delete LOGQ[mid];
    const m = (ctx().b.mons || {})[mid];
    if (!m) return;
    const ch = [];
    for (const k of NOW_K) {
      const a = +q.r0[k] || 0,
        b2 = +(m.rank || {})[k] || 0;
      if (a !== b2) ch.push(`${STAT_KO[k]} 랭크 ${fmtR(a)} → ${fmtR(b2)}`);
      const x = +q.m0[k] || 1,
        y = +(m.mod || {})[k] || 1;
      if (x !== y) ch.push(`${STAT_KO[k]} 배율 ×${x} → ×${y}`);
    }
    if (ch.length) A().sysLog(`【랭크·배율】 ${m.name}\n${ch.join('\n')}`, 'battle', { mid, img: m.image || '' });
  }
  /* 손으로 붙인 「씨뿌리기」: 지금 행동 중인 상대 포켓몬의 에리어를 씨 뿌린 곳으로 (없으면 정면) */
  function seedSrc(b, m) {
    const o = (b.order || [])[+b.orderIdx || 0];
    const a = o && (b.mons || {})[o.mid];
    return a && !sameT(a, m, b) && a.entry && (+b.phase || 0) >= 2 ? a.side + '_' + a.entry : null;
  }
  const stDesc = k => (((DB().states || {}).st || {})[k] || {}).desc || [];
  const stName = k => (((DB().states || {}).st || {})[k] || {}).ko || k;
  function nowEditHtml(m, full, o) {
    o = o || {};
    const r = m.rank || {},
      md = m.mod || {};
    const sdb = (DB().states || {}).st || {};
    const st = m.states || {};
    const tmpK = k => !!(+(m.tempRank || {})[k] || (+(m.tempMod || {})[k] || 1) !== 1);
    const cell = k => {
      const v = +r[k] || 0,
        x = +md[k] || 1;
      return `<button type="button" class="dxrk ${v > 0 ? 'up' : v < 0 ? 'dn' : ''} ${x > 1 ? 'mup' : x < 1 ? 'mdn' : ''} ${o.sel === k ? 'sel' : ''}" ${full ? `data-nrk="${k}"` : 'disabled'}><small>${STAT_KO[k]}${k === 'critical' ? ' (C)' : ''}</small><b>${fmtR(v)}</b><em>×${x}</em>${tmpK(k) ? '<i class="dxtmp" title="턴 종료 때 풀리는 임시 랭크·배율이 있다">임시</i>' : ''}</button>`;
    };
    const chips = Object.keys(st)
      .filter(k => st[k])
      .map(k => {
        const d = sdb[k] || { ko: k };
        const im = simg(k);
        return `<span class="dxs1 ${d.abn ? 'abn' : ''}" title="${esc((d.desc || []).join(' '))}">${im ? `<img src="${esc(im)}" alt="">` : ''}<b>${esc(d.ko || k)}</b>${full ? `<input type="number" class="dxsn" data-nst="${esc(k)}" min="1" max="99" value="${+st[k] < 1000 ? +st[k] : ''}" placeholder="∞" title="${k === 'Stockpile' ? '비축 카운터 (1~3)' : '남은 턴 (비우면 계속)'}"><i>${k === 'Stockpile' ? '개' : '턴'}</i>` : +st[k] > 1 && +st[k] < 1000 ? `<i>${st[k]}턴</i>` : ''}${full ? `<button type="button" class="dxsx" data-nsoff="${esc(k)}" title="「${esc(d.ko || k)}」 풀기">✕</button>` : ''}</span>`;
      })
      .join('');
    const fx =
      flagChips(m) +
      (FX()
        ? FX()
            .chips(m)
            .filter(ch => full || !armedOwn(m, ch))
            .map(ch => `<span class="rk fxc" title="${esc(ch.title)}">${esc(ch.t)}</span>`)
            .join('')
        : '');
    /* 10-28 망령 「배율에 임시 배율이 없는 게 불편 · 시합 중 배율 조정 UI 개편」: 배율은 「곱해진 것들」의 목록으로 보인다 — 효과 출처 · 손 조정 · 임시(턴 종료까지)를 하나씩 보고 ✕ 로 뗀다.
     단추는 지금 배율에 곱한다(새 줄). 전체를 한 값으로 맞추는 건 아래 「총 배율 직접 맞추기」 */
    const bar = () => {
      const k = o.sel;
      const v = +r[k] || 0,
        x = +md[k] || 1;
      const lim = k === 'critical' ? 4 : 6;
      const ms = ((m.fx && m.fx.mults) || []).filter(e => e && e.stats && e.stats[k] != null);
      const prod = ms.reduce((a, e) => a * (+e.stats[k] || 1), 1);
      const rest = Math.round((x / prod) * 1000) / 1000;
      const tr = +(m.tempRank || {})[k] || 0;
      const src = e => {
        const n = String(e.name || e.key || '');
        const by = (String(e.key || '').split(' ← ')[1] || '').replace(/ \(줄\d+\)$/, '');
        return esc(n.replace(/ · [a-z0-9]+$/, '')) + (by && !e.hand ? `<span class="dim"> ← ${esc(by)}</span>` : '');
      };
      const rows =
        ms
          .map(
            e =>
              `<span class="dxmf ${e.temp ? 'tmp' : ''} ${e.hand ? 'hand' : ''}"><b>${src(e)}</b><span class="mono">×${+e.stats[k]}</span>${e.temp ? '<i>턴 종료까지</i>' : ''}<button type="button" class="dxsx" data-nmx="${esc(e.key)}" title="이 배율만 뗀다">✕</button></span>`
          )
          .join('') +
        (Math.abs(rest - 1) > 0.002
          ? `<span class="dxmf"><b>출처 없음</b><span class="mono">×${rest}</span><button type="button" class="dxsx" data-nmx0 title="출처 없는 배율을 뗀다 (×1)">✕</button></span>`
          : '');
      return `<div class="dxrkb"><div class="dxrkh"><b class="dxrkt">${STAT_KO[k]}</b><label class="dxtg ${o.temp ? 'on' : ''}" title="켜 두면 여기서 올리고 곱한 것은 턴 종료 때 저절로 풀린다"><input type="checkbox" data-ntemp ${o.temp ? 'checked' : ''}> 임시 (턴 종료까지)</label></div>
    <div class="dxrkl"><span class="small dim">랭크</span><span class="dxrkr"><button type="button" class="btn sm" data-nrd="-1" ${v <= -lim ? 'disabled' : ''}>−1</button><b class="mono">${fmtR(v)}</b><button type="button" class="btn sm" data-nrd="1" ${v >= lim ? 'disabled' : ''}>+1</button></span>${tr ? `<span class="dxmf tmp"><b>임시</b><span class="mono">${fmtR(tr)}</span><i>턴 종료 때 되돌림</i></span>` : ''}</div>
    <div class="dxrkl"><span class="small dim">배율</span><b class="mono dxmt">×${x}</b><span class="dxmfs">${rows || '<span class="small dim">곱해진 배율 없음</span>'}</span></div>
    <div class="dxrkl dxmadd"><span class="small dim">곱하기</span>${[0.5, 0.67, 0.75, 1.2, 1.33, 1.5, 2].map(z => `<button type="button" class="btn xs ${o.temp ? 'tmp' : ''}" data-nmul="${z}">×${z}</button>`).join('')}<input type="text" class="n xs" data-nmulx placeholder="1.2*1.5" title="곱할 값 · 곱셈도 된다"><input type="text" class="n xs dxmemo" data-nmemo value="${esc(o.memo || '')}" placeholder="출처 (선택)" maxlength="30"><button type="button" class="btn xs pri" data-nmulgo>곱하기</button></div>
    <details class="dxmset"><summary class="small dim">총 배율 직접 맞추기</summary><span class="dxrkm">${NOW_MODS.map(z => `<button type="button" class="btn xs ${z === x ? 'pri' : 'ghost'}" data-nmod="${z}">×${z}</button>`).join('')}<input type="text" class="n xs" data-nmodi value="${x}" title="배율 직접 입력 · 곱셈도 된다 (1.2*1.5) · ×1.5 처럼 ×/* 로 시작하면 지금 배율에 곱한다"></span><div class="small dim">한 값으로 맞추면 이 능력의 출처 기록은 지워진다</div></details></div>`;
    };
    const barAll = () =>
      `<div class="dxrkb"><div class="dxrkh"><b class="dxrkt">전 능력치</b><span class="small dim">공격 · 방어 · 특공 · 특방 · 스피드</span><label class="dxtg ${o.temp ? 'on' : ''}" title="켜 두면 여기서 올리고 곱한 것은 턴 종료 때 저절로 풀린다"><input type="checkbox" data-ntemp ${o.temp ? 'checked' : ''}> 임시 (턴 종료까지)</label></div>
    <div class="dxrkl"><span class="small dim">랭크</span><span class="dxrkr"><button type="button" class="btn sm" data-nrd="-1">−1</button><b class="mono">다섯 모두</b><button type="button" class="btn sm" data-nrd="1">+1</button></span></div>
    <div class="dxrkl dxmadd"><span class="small dim">곱하기</span>${[0.5, 0.67, 0.75, 1.2, 1.33, 1.5, 2].map(z => `<button type="button" class="btn xs ${o.temp ? 'tmp' : ''}" data-nmul="${z}">×${z}</button>`).join('')}<input type="text" class="n xs" data-nmulx placeholder="1.2*1.5" title="곱할 값 · 곱셈도 된다"><input type="text" class="n xs dxmemo" data-nmemo value="${esc(o.memo || '')}" placeholder="출처 (선택)" maxlength="30"><button type="button" class="btn xs pri" data-nmulgo>곱하기</button></div>
    <div class="small dim">한 능력만 떼거나 맞추려면 그 칸을 누른다</div></div>`;
    const rng = d => (!d.min || d.min >= 1000 ? '계속' : d.max && d.max !== d.min ? `${d.min}~${d.max}턴` : `${d.min}턴`);
    const list = () => {
      const q = (o.q || '').toLowerCase();
      const groups = ((DB().states || {}).groups || [])
        .map(g => ({
          l: g.l,
          s: g.s.filter(k => !st[k] && sdb[k] && (!q || (sdb[k].ko + ' ' + k + ' ' + (sdb[k].desc || []).join(' ')).toLowerCase().includes(q)))
        }))
        .filter(g => g.s.length);
      return (
        groups
          .map(
            g =>
              `<div class="dxspgl">${esc(g.l)}</div><div class="dxsps">${g.s
                .map(k => {
                  const d = sdb[k];
                  const im = simg(k);
                  return `<button type="button" class="dxsp1 ${d.abn ? 'abn' : ''}" data-nsadd1="${esc(k)}" title="${esc((d.desc || []).join(' '))}">${im ? `<img src="${esc(im)}" alt="">` : ''}${esc(d.ko)}<i>${rng(d)}</i></button>`;
                })
                .join('')}</div>`
          )
          .join('') || '<span class="small dim">맞는 상태가 없다</span>'
      );
    };
    if (o.listOnly) return list();
    const pick = () =>
      `<div class="dxspk"><div class="dxspr"><input type="text" data-nsq value="${esc(o.q || '')}" placeholder="상태 검색 (이름·설명)"><label class="small dxspn" title="붙일 때의 턴 수. 비우면 상태 DB 의 기본 턴">턴 <input type="number" data-nsn min="1" max="99" value="${esc(o.n || '')}" placeholder="기본"></label></div><div class="dxspg">${list()}</div></div>`;
    return `<div class="dxnow"><div class="k dxk">랭크 · 배율${full ? '<span class="small dim">칸을 눌러 조절</span><span class="sp"></span><button type="button" class="btn xs ghost" data-nrk0 title="랭크·배율을 전부 원래대로">초기화</button>' : ''}</div><div class="dxrkg">${NOW_K.map(cell).join('')}${full ? `<button type="button" class="dxrk dxrkall ${o.sel === 'all' ? 'sel' : ''}" data-nrk="all"><small>전 능력치</small><em>공격 · 방어 · 특공 · 특방 · 스피드 한 번에</em></button>` : ''}</div>${full && o.sel ? (o.sel === 'all' ? barAll() : bar()) : ''}</div>
   <div class="dxnow"><div class="k dxk">상태${full ? `<span class="sp"></span><button type="button" class="btn xs ${o.pk ? 'pri' : ''}" data-nsadd>${o.pk ? '닫기' : '+ 상태'}</button>` : ''}</div><div class="dxstl">${chips || '<span class="small dim">없음</span>'}</div>${full && o.pk ? pick() : ''}</div>
   ${fx ? `<div class="dxnow"><div class="k">효과</div><div class="rks">${fx}</div></div>` : ''}`;
  }
  function bindNowEdit(box, mid) {
    if (!box) return;
    const o = { sel: '', temp: false, pk: false, q: '' };
    const mon = () => (ctx().b.mons || {})[mid];
    const P = k => ['battle', 'mons', mid, k];
    /* 11-27 상태 쓰기 — 비축 카운터(Stockpile)가 바뀌면 방어/특방도 같이 (stockFix) */
    const stSave = async (m, ns) => {
      const nm = JSON.parse(JSON.stringify(m));
      nm.states = ns;
      const t = stockFix(m, nm);
      if (!t) return A().set(P('states'), ns);
      await saveMon(m, mid, nm);
      A().sysLog(`【비축】 ${m.name} ${t}`, 'battle', { mid, img: m.image || '' });
    };
    const redraw = focusQ => {
      const m = mon();
      if (!m) return;
      box.innerHTML = nowEditHtml(m, true, o);
      bind();
      if (focusQ) {
        const q = box.querySelector('[data-nsq]');
        if (q) {
          q.focus();
          q.setSelectionRange(q.value.length, q.value.length);
        }
      }
    };
    const setMod = async z => {
      z = Math.round(+z * 1000) / 1000;
      if (!(z > 0)) return;
      const m = mon(),
        k = o.sel;
      const x0 = +(m.mod || {})[k] || 1;
      if (z === x0) return;
      nowQueue(m);
      const nm = Object.assign({}, m.mod || {});
      if (z === 1) delete nm[k];
      else nm[k] = z;
      await A().set(P('mod'), nm);
      /* 손으로 바꾼 배율은 출처 기록에서 떼어 낸다 (나중에 효과 ✕ 로 역으로 나뉘지 않게) */
      const F = m.fx;
      if (F && F.mults && F.mults.some(e => e.stats && e.stats[k] != null)) {
        const nf = JSON.parse(JSON.stringify(F));
        nf.mults = nf.mults
          .map(e => {
            const s = Object.assign({}, e.stats);
            delete s[k];
            return Object.assign({}, e, { stats: s });
          })
          .filter(e => Object.keys(e.stats).length);
        await A().set(P('fx'), nf);
      }
      redraw();
    };
    const saveMults = async x => {
      await A().set(P('mod'), x.mod || {});
      await A().set(P('tempMod'), x.tempMod && Object.keys(x.tempMod).length ? x.tempMod : null);
      await A().set(P('fx'), x.fx || null);
    };
    /* 곱하기: 출처(손 조정 · 적은 이름)를 남긴 새 줄로 — 임시면 턴 종료 때 풀린다 */
    const addMul = async v => {
      v = Math.round(+v * 1000) / 1000;
      if (!(v > 0) || v === 1) return;
      const m0 = mon();
      if (!m0 || !o.sel) return;
      const ks = nowKeys(o.sel);
      nowQueue(m0);
      const x = snap(m0);
      x.mod = x.mod || {};
      for (const k of ks) {
        x.mod[k] = Math.round((+x.mod[k] || 1) * v * 1000) / 1000;
        if (Math.abs(x.mod[k] - 1) < 0.002) delete x.mod[k];
        if (o.temp) {
          x.tempMod = x.tempMod || {};
          x.tempMod[k] = Math.round((+x.tempMod[k] || 1) * v * 1000) / 1000;
        }
      }
      x.fx = x.fx || {};
      x.fx.mults = x.fx.mults || [];
      const nm =
        String(o.memo || '')
          .trim()
          .slice(0, 30) || '손 조정';
      x.fx.mults.push({
        key: nm + ' · ' + Date.now().toString(36),
        name: nm,
        stats: Object.fromEntries(ks.map(k => [k, v])),
        temp: !!o.temp,
        hand: 1
      });
      o.memo = '';
      await saveMults(x);
      redraw();
    };
    const bind = () => {
      box.querySelectorAll('[data-nrk]').forEach(
        b =>
          (b.onclick = () => {
            o.sel = o.sel === b.dataset.nrk ? '' : b.dataset.nrk;
            redraw();
          })
      );
      box.querySelectorAll('[data-nrd]').forEach(
        b =>
          (b.onclick = async () => {
            const m = mon();
            const nr = Object.assign({}, m.rank || {}),
              tr = Object.assign({}, m.tempRank || {});
            let moved = false;
            for (const k of nowKeys(o.sel)) {
              const lim = k === 'critical' ? 4 : 6;
              const v0 = +nr[k] || 0;
              const v = Math.max(-lim, Math.min(lim, v0 + +b.dataset.nrd));
              if (v === v0) continue;
              moved = true;
              nr[k] = v;
              tr[k] = (+tr[k] || 0) + (v - v0);
              if (!tr[k]) delete tr[k];
            }
            if (!moved) return;
            nowQueue(m);
            await A().set(P('rank'), nr);
            if (o.temp) await A().set(P('tempRank'), tr);
            redraw();
          })
      );
      box.querySelectorAll('[data-nmod]').forEach(b => (b.onclick = () => setMod(b.dataset.nmod)));
      const mi = box.querySelector('[data-nmodi]');
      if (mi)
        mi.onchange = () => {
          const v = mulOf(mi.value, +(mon().mod || {})[o.sel] || 1);
          if (!(v > 0)) {
            mi.value = +(mon().mod || {})[o.sel] || 1;
            return A().toast('배율을 못 읽었다 — 1.5 · 1.2*1.5 · ×1.5 처럼');
          }
          mi.value = v;
          setMod(v);
        }; /* 값을 바로 바꿔 두어 포커스가 빠질 때 한 번 더 곱해지지 않게 */
      const tp = box.querySelector('[data-ntemp]');
      if (tp)
        tp.onchange = () => {
          o.temp = tp.checked;
          redraw();
        };
      const me = box.querySelector('[data-nmemo]');
      if (me)
        me.oninput = () => {
          o.memo = me.value;
        };
      box.querySelectorAll('[data-nmul]').forEach(b => (b.onclick = () => addMul(+b.dataset.nmul)));
      const mx = box.querySelector('[data-nmulx]'),
        mg = box.querySelector('[data-nmulgo]');
      const goX = () => {
        const v = mulOf(mx.value, 1);
        if (!(v > 0)) return A().toast('곱할 값을 못 읽었다 — 1.2 · 1.2*1.5 처럼');
        mx.value = '';
        addMul(v);
      };
      if (mg) mg.onclick = goX;
      if (mx)
        mx.onkeydown = e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            goX();
          }
        };
      box.querySelectorAll('[data-nmx]').forEach(
        b =>
          (b.onclick = async () => {
            const m0 = mon();
            if (!m0 || !FX()) return;
            const x = snap(m0);
            const e = ((x.fx || {}).mults || []).find(q => q.key === b.dataset.nmx);
            if (!e) return;
            nowQueue(m0);
            FX().remove(x, 'mults:' + e.key);
            await saveMults(x);
            A().sysLog(`【랭크·배율】 ${x.name} 「${String(e.name || e.key).replace(/ · [a-z0-9]+$/, '')}」 배율을 뗐다`, 'battle', {
              mid,
              img: x.image || ''
            });
            redraw();
          })
      );
      const m0b = box.querySelector('[data-nmx0]');
      if (m0b)
        m0b.onclick = async () => {
          const m0 = mon(),
            k = o.sel;
          const ms = ((m0.fx && m0.fx.mults) || []).filter(e => e && e.stats && e.stats[k] != null);
          const prod = Math.round(ms.reduce((a, e) => a * (+e.stats[k] || 1), 1) * 1000) / 1000;
          nowQueue(m0);
          const nm = Object.assign({}, m0.mod || {});
          if (Math.abs(prod - 1) < 0.002) delete nm[k];
          else nm[k] = prod;
          await A().set(P('mod'), nm);
          redraw();
        };
      const r0 = box.querySelector('[data-nrk0]');
      if (r0)
        r0.onclick = async () => {
          const m = mon();
          const any = NOW_K.some(k => +(m.rank || {})[k] || (+(m.mod || {})[k] || 1) !== 1);
          if (!any) return A().toast('바꿀 랭크·배율이 없다');
          if (!confirm(`${m.name}의 랭크·배율을 전부 원래대로 돌릴까?`)) return;
          nowQueue(m);
          await A().set(P('rank'), {});
          await A().set(P('mod'), {});
          if (m.tempRank) await A().set(P('tempRank'), null);
          if (m.tempMod) await A().set(P('tempMod'), null);
          if (m.fx && m.fx.mults && m.fx.mults.length) {
            const nf = JSON.parse(JSON.stringify(m.fx));
            nf.mults = [];
            await A().set(P('fx'), nf);
          }
          nowFlush(mid);
          redraw();
        };
      box.querySelectorAll('[data-nsoff]').forEach(
        b =>
          (b.onclick = async () => {
            const m = mon(),
              k = b.dataset.nsoff;
            const ns = Object.assign({}, m.states || {});
            delete ns[k];
            await stSave(m, ns);
            if (!stLog(m, Object.assign({}, m, { states: ns })))
              A().sysLog(`【상태】 ${m.name}의 「${stName(k)}」이(가) 풀렸다`, 'battle', { mid, img: m.image || '' });
            redraw();
          })
      );
      const ad = box.querySelector('[data-nsadd]');
      if (ad)
        ad.onclick = () => {
          o.pk = !o.pk;
          o.q = '';
          redraw(o.pk);
        };
      /* 검색칸은 목록만 다시 그린다 (칸째 다시 그리면 한글 조합이 끊긴다) */
      const q = box.querySelector('[data-nsq]');
      if (q)
        q.oninput = () => {
          o.q = q.value;
          const g = box.querySelector('.dxspg'),
            m = mon();
          if (!g || !m) return;
          g.innerHTML = nowEditHtml(m, true, Object.assign({}, o, { listOnly: 1 }));
          bindAdd();
        };
      const sn = box.querySelector('[data-nsn]');
      if (sn)
        sn.oninput = () => {
          o.n = sn.value;
        };
      box.querySelectorAll('[data-nst]').forEach(
        inp =>
          (inp.onchange = async () => {
            const m = mon(),
              k = inp.dataset.nst;
            const v = Math.round(+inp.value);
            const c = v > 0 ? Math.min(v, 999) : 1000;
            if (+(m.states || {})[k] === c) return;
            await stSave(m, Object.assign({}, m.states || {}, { [k]: c }));
            A().sysLog(`【상태】 ${m.name}의 「${stName(k)}」 남은 턴 → ${c < 1000 ? c + '턴' : '계속'}`, 'battle', { mid, img: m.image || '' });
            redraw();
          })
      );
      bindAdd();
    };
    const bindAdd = () =>
      box.querySelectorAll('[data-nsadd1]').forEach(
        b =>
          (b.onclick = async () => {
            const m = mon(),
              k = b.dataset.nsadd1;
            const d = ((DB().states || {}).st || {})[k] || {};
            const n = Math.round(+o.n);
            const c =
              n > 0
                ? Math.min(n, 999)
                : d.min >= 1000 || !d.min
                  ? 1000
                  : +d.max > +d.min && +d.max < 1000
                    ? +d.min + Math.floor(Math.random() * (+d.max - +d.min + 1))
                    : +d.min;
            const ns = Object.assign({}, m.states || {}, { [k]: c });
            await stSave(m, ns);
            if (k === 'LeechSeed') await A().set(P('seedFrom'), seedSrc(ctx().b, m));
            const ds = stDesc(k);
            /* 11-01 망령 「상태 변화도 효과 로그」: 상태 카드가 되면 예전 줄은 남기지 않는다 */ if (
              !stLog(m, Object.assign({}, m, { states: ns }), fcMan('상세 창'))
            )
              A().sysLog(`【상태】 ${m.name} 「${stName(k)}」${c < 1000 ? ` (${c}턴)` : ''}${ds.length ? '\n' + ds.join('\n') : ''}`, 'battle', {
                mid,
                img: m.image || ''
              });
            o.pk = false;
            o.q = '';
            o.n = '';
            redraw();
          })
      );
    bind();
  }
  function nowParts(m) {
    return {
      rank: rankChips(m),
      state: stateChips(m),
      fx:
        flagChips(m) +
        (FX()
          ? FX()
              .chips(m)
              .map(ch => `<span class="rk fxc" title="${esc(ch.title)}">${esc(ch.t)}</span>`)
              .join('')
          : '')
    };
  }
  return {
    illuMask,
    concealLog,
    illuDex: mid => illuDexOf(ctx(), mid),
    concealName: (mid, nm) => {
      try {
        const b = ctx().b;
        return concealNames(b, (b.mons || {})[mid]).has(cnm(nm));
      } catch (e) {
        return false;
      }
    },
    askYes,
    canSeeStx: tid => stxOk(ctx(), tid),
    uniqOf: tid => uniqList((ctx().b.trainers || {})[tid]) /* 요약 창: 고유 + 남은 횟수 */,
    canForceTid: tid => {
      const c = ctx();
      return !!tid && (ownT(c, tid) || (c.gm && !fairOff(c, tid)));
    },
    canEditMon: mid => {
      const c = ctx();
      const m = ((c.b || {}).mons || {})[mid];
      return !!m && canEdit(c, m);
    },
    fireAuto,
    fieldAuto,
    fieldClear,
    render,
    nowParts,
    nowEditHtml,
    bindNowEdit,
    watch,
    ctx,
    entered,
    allEntered,
    fieldOf,
    fieldCard,
    statusCard,
    futureFire,
    trapWarn,
    resetLocal: () => {
      CMD = {};
    },
    startCut: m => battleStartCut(ctx().b, m),
    openHp,
    action,
    hotkey,
    logFx,
    hitBadge
  };
})();
