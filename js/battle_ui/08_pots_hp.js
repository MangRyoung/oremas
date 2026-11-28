  /* ── 조각 08_pots_hp.js — 자동화 확인 · 포텐셜 창 · HP 창 ── */
  /* ---------- 랭크·상태 편집 ---------- */
  /* ---------- 포텐셜 목록 창: 출력(채팅에 알림) · 발동(자동화) · 횟수 · 효과 해제 ---------- */
  /* ---------- ⚙ 자동화 확인 (10-24 망령: 처음 하는 사람이 자동화 도우미를 어려워한다)
    내 트레이너(GM 은 고른 트레이너)와 지금 필드 위의 그 포켓몬에서, 구문이 있어 자동으로 처리되는 것을 한눈에: 언제 · 무엇을 · 어떻게 (자동 / 발동 버튼 / 공격·HP 창) ----- */
  const AK = { tid: '' };
  function autoRows(m, t) {
    const out = [],
      man = [];
    const tm = a => (FX() ? FX().timing(a.text || '') : {});
    const how = (a, kind) => {
      const T = tm(a);
      if (kind === '지령 · 명령') return ['지시에서 고르면 걸린다', 'press'];
      /* 11-03 22:40: 배틀 효과 없음(없음) · 시트 몫(종족치 · 실수치)만 있는 포텐셜 */ if ((a.ops || []).every(o => o && o.k === 'none'))
        return ['배틀 효과 없음 (시트 · 파티 규칙)', 'auto'];
      if ((a.ops || []).length && (a.ops || []).every(o => o && (o.k === 'timeuq' || o.k === 'timedecl')))
        return ['묘수 창(「타임」)에서 쓴다', 'auto'];
      if ((a.ops || []).every(o => o && ['baseup', 'statadd', 'none'].includes(o.k))) return ['제작기 시트에 반영', 'auto'];
      if (T.entry) return ['등장하면 자동', 'auto'];
      if (T.passive) return ['늘 켜짐', 'auto'];
      if (/【턴 종료】/.test(a.text || '')) return ['턴 종료 때 · 「발동」', 'press'];
      if (T.pre) return ['선행 · 「발동」', 'press'];
      return ['「발동」 버튼', 'press'];
    };
    /* 11-03 22:05 망령 「자동화 확인에서 여전히 하이 어태커 · 에이스가 안 된 걸로」: 기본 레디메이드엔 구문이 있는데 방 DB(dbx.rm) · 제작기 DB 수정 행이 비거나 「손으로」로 덮은 경우 — 그 사실과 「기본으로」 단추 */
    const ovOf = (kind, name) => {
      const key =
        kind === '특성'
          ? '특성 : ' + name
          : kind === '소지품'
            ? '소지품 : ' + name
            : String(name || '')
                .replace(/『|』/g, '')
                .trim();
      const base = ((window.OM_DB || {}).readymade || {})[key];
      if (!base || !base.ops || !base.ops.length || base.manual) return null;
      const room = (((ctx().ST || {}).state || {}).dbx || {}).rm || {};
      return { key, src: room[key] ? (room[key].src === 'room' ? '이 방 DB' : '제작기 DB 수정(방에 옮겨짐)') : '제작기 DB 수정' };
    };
    const add = (kind, name, a, eff) => {
      if (a && a.ops && a.ops.length && !a.manual) {
        const [w, c] = how(a, kind);
        out.push({ kind, name, when: w + (tm(a).uses ? ` (${tm(a).uses}회)` : ''), cls: c, what: FX().describe(a.ops) });
      } else man.push({ kind, name, eff, ov: kind === '지령 · 명령' ? null : a && a.src === 'own' ? null : ovOf(kind, name) });
    };
    if (m) {
      for (const p of potSrc(m)) add(p.unique ? '고유' : isExcl(m, p) ? '전용' : '포텐셜', p.name, FX() && FX().autoOf(m, 'pot', p.name), p.eff);
      if (m.ability) add('특성', m.ability, FX() && FX().autoOf(m, 'trait', m.ability), m.abilityEff);
      if (m.item && m.item !== '-') {
        const I = window.OM_ITEMS,
          IR = window.OM_ITEMRULE;
        const r = I && I.of(m);
        const passive = r && IR && IR.has(r);
        if (passive)
          out.push({
            kind: '소지품',
            name: m.item,
            when: '공격 · HP 창 · 턴 종료에서 자동',
            cls: 'auto',
            what:
              IR.toText(r)
                .split('\n')
                .filter(x => x !== '소모품' && !/^전용 /.test(x))
                .join(' · ') + (r.once ? ' (한 번 쓰면 없어짐)' : '')
          });
        const a = FX() && FX().autoOf(m, 'item', m.item);
        if (a && a.ops && a.ops.length && !a.manual) {
          if (!passive) add('소지품', m.item, a);
        } else if (!passive) man.push({ kind: '소지품', name: m.item, eff: m.itemEff });
      }
      for (const mv of m.moves || []) {
        if (!mv || !mv.name) continue;
        const a = moveAuto(mv);
        if (a && MA().auto(a))
          out.push({
            kind: '기술',
            name: mv.name,
            when: '공격 창 「적용」 때 자동',
            cls: 'auto',
            what: MA().describe(a) + (a.notes && a.notes.length ? ' · 손으로: ' + a.notes.join(' · ') : '')
          });
        else if (a && a.notes && a.notes.length) man.push({ kind: '기술', name: mv.name, eff: a.notes.join(' · ') });
      }
    } else if (t) {
      for (const u of (t.unique || []).filter(u => u && u.name)) add('고유', u.name, FX() && FX().autoOf({ tid: t.id }, 'pot', u.name), u.eff);
      if (OO())
        for (const n of [...OO().orderNames(t), ...OO().commandNames(t)].filter(Boolean)) {
          const a = FX() && FX().rm(n);
          if (a && a.ops && a.ops.length && !a.manual) add('지령 · 명령', n, a);
        }
    }
    return { out, man };
  }
  /* 11-08 21:35 망령 「자동화 확인 버튼 설마 상대 것도 보이진 않지?」: 예전엔 진행자(c.mgr — PL 이 진행하는 배틀의 좌석 포함)면 모든 트레이너를 골랐다 → GM 은 모두(불간섭 중이면 자기가 다루는 트레이너만), 좌석은 자기 것 · 함께 지시하는 것만 */
  function openAutoCheck(tid) {
    const c = ctx(),
      b = c.b;
    const trs = Object.values(b.trainers || {}).filter(t => (c.gm ? !fairOff(c, t.id) : ownT(c, t.id)));
    if (!trs.length) return A().toast('배틀에 올린 내 트레이너가 없다');
    if (tid) AK.tid = tid;
    if (!trs.some(t => t.id === AK.tid)) AK.tid = trs[0].id;
    const t = b.trainers[AK.tid];
    const mons = Object.values(b.mons || {}).filter(m => m.tid === t.id && m.entry && m.hp && m.hp.cur > 0);
    const block = (
      title,
      img,
      { out, man }
    ) => `<div class="akblk"><div class="akh">${img ? `<img src="${esc(img)}" alt="">` : ''}<b>${esc(title)}</b><span class="dim small">자동 ${out.length}${man.length ? ' · 손으로 ' + man.length : ''}</span></div>
   ${out.length ? `<div class="akl">${out.map(x => `<div class="akr ${x.cls}"><span class="akk">${esc(x.kind)}</span><b>${esc(x.name)}</b><span class="akw">${esc(x.when)}</span><div class="akd">${esc(x.what)}</div></div>`).join('')}</div>` : '<div class="dim small">자동으로 처리되는 것이 없다</div>'}
   ${
     man.length
       ? `<details class="akman"><summary class="small">자동화 안 됨 — 손으로 (📢 발동 · HP · 상태 창) ${man.length}</summary>${man
           .map(
             x =>
               `<div class="small"><span class="akk">${esc(x.kind)}</span>${esc(x.name)}${x.ov ? ` <b class="akov">기본 구문은 있다 — ${esc(x.ov.src)}이 덮음</b>${c.gm ? ` <button class="btn xs" data-akfix="${esc(x.ov.key)}">기본으로</button>` : ''}` : ''}${
                 x.eff
                   ? ` <span class="dim">— ${esc(
                       String(x.eff)
                         .replace(/<br\s*\/?>/g, ' ')
                         .slice(0, 90)
                     )}</span>`
                   : ''
               }</div>`
           )
           .join('')}</details>`
       : ''
   }</div>`;
    const md = A().openModal(
      `<div class="mhead"><h2>⚙ 자동화 확인</h2><span class="sp"></span>${trs.length > 1 ? `<select id="akt">${trs.map(x => `<option value="${esc(x.id)}" ${x.id === t.id ? 'selected' : ''}>${esc(x.name || x.id)}</option>`).join('')}</select>` : ''}<button class="btn ghost" data-x>닫기</button></div>
   <div class="mbody akbody"><p class="small dim" style="margin:0 0 8px">구문이 있어 오레마스가 알아서 처리하는 것들. <b class="akauto">자동</b> 은 건드리지 않아도 되고, <b class="akbtn">「발동」</b> 은 포텐셜 칸의 발동 버튼을 누르면 효과가 걸린다. 자동화가 없는 것은 「📢 발동」으로 로그에 띄우고 HP · 상태 창에서 손으로.</p>
   ${block(`트레이너 ${t.name || t.id}`, t.image || '', autoRows(null, t))}
   ${mons.length ? mons.map(m => block(`${m.name}${m.entry ? ' · ' + m.entry : ''}`, m.image || '', autoRows(m, t))).join('') : '<div class="dim small" style="margin-top:8px">필드에 나와 있는 포켓몬이 없다 — 내보내면 여기 나온다</div>'}</div>`,
      { wide: true }
    );
    const sel = md && md.querySelector('#akt');
    if (sel)
      sel.onchange = () => {
        A().closeModal();
        openAutoCheck(sel.value);
      };
    if (md)
      md.querySelectorAll('[data-akfix]').forEach(
        bt =>
          (bt.onclick = async () => {
            const k = bt.dataset.akfix;
            const base = ((window.OM_DB || {}).readymade || {})[k];
            if (!base) return;
            {
              const ov = Object.assign({}, (A().ST.state.dbx || {}).rm || {});
              if (ov[k] && ov[k].src === 'maker') ov[k] = Object.assign(JSON.parse(JSON.stringify(base)), { src: 'room' });
              else delete ov[k];
              await A().set(['dbx', 'rm'], ov);
            }
            await A().set(['dbx', 'at'], Date.now());
            /* 11-07: 방에서 덮은 것이면 방 것을 뺀다(기본이 나중에 고쳐지면 따라감) · 제작기 DB 수정이 덮은 것이면 예전처럼 기본을 방에 박는다 */ A().sysLog(
              `레디메이드 「${k}」 — 이 방에서 기본 구문으로 되돌렸다`,
              'battle'
            );
            A().closeModal();
            openAutoCheck(AK.tid);
          })
      );
    if (md) md.querySelectorAll('[data-x]').forEach(x => (x.onclick = () => A().closeModal()));
  }
  /* only: 로그 카드의 「효과」로 열 때 그 줄에 나온 이름들. 내 포켓몬이 아니면 공개된 것만 — 그 줄에 나온 것 · 도감 전체 해석이면 포텐셜(전용 빼고) · 특성 해석이면 특성 (10-24 망령) */
  function openPots(mid, only) {
    const c = ctx();
    const b = c.b;
    const m = b.mons[mid];
    if (!m) return;
    if (illuOf(b, m) && !illuTrue(c, m)) return A().toast('공개된 것 없음');
    /* 11-05 일루젼 */ const full = canEdit(c, m);
    const u = m.potUses || {};
    const L = potList(m);
    const ON = new Set((only || []).map(x => String(x).replace(/『|』/g, '')));
    const seeAll = full || dexSees(c, m, 'all'),
      seeTr = full || dexSees(c, m, 'trait');
    const vis = ([k, n, kind]) => full || ON.has(n) || (k === 'pot' && kind !== '전용' && seeAll) || (k === 'trait' && seeTr);
    const rows0 = [
      ...(m.excl ? [['pot', m.excl.name, '전용', m.excl.eff || '']] : []),
      ...(m.exclX || []).map(p => ['pot', p.name, '전용', p.eff || '']),
      ...(m.pots || []).filter(p => p && p.name && !p.ph).map(p => ['pot', p.name, p.kind || '', p.eff || '']),
      ...(m.ability ? [['trait', m.ability, '특성', m.abilityEff || '']] : []),
      ...(m.item ? [['item', m.item, '소지품', m.itemEff || '']] : []),
      ...(m.items2 || []).filter(x => x && x.item).map(x => ['item', x.item, '소지품', x.itemEff || ''])
    ];
    const rows = rows0.filter(vis);
    const hid = rows0.length - rows.length;
    const chips = FX()
      ? FX()
          .chips(m)
          .filter(ch => full || !armedOwn(m, ch))
      : [];
    const SH = window.OM_SHEET_UI || {};
    const pf = SH.potFmt || (t => esc(t));
    const pk = SH.potKind || (k => ({ no: '', lab: k }));
    const HUE = SH.POT_HUE || {};
    /* 10-21 망령: 시트처럼 카드로 — 분류 꼬리표 · 이름 · 남은 횟수 · 효과 (「」【】 강조, ① ② 줄 나눔) · 아래에 버튼 줄. 폰에서도 효과 글이 한 줄을 다 쓴다 */
    const card = ([k, n, kind, eff]) => {
      const a = FX() && FX().autoOf(m, k, n);
      const auto = a && a.ops && a.ops.length && !a.manual;
      const cnt = L.find(x => x.name === n);
      const left = cnt ? (u[n] == null ? cnt.max : +u[n]) : null;
      const tm = a ? FX().timing(a.text || eff) : {};
      const kk = k === 'trait' ? { no: '', lab: '특성' } : k === 'item' ? { no: '', lab: '소지품' } : pk(kind);
      const hue = k === 'trait' ? '#5fd38d' : k === 'item' ? '#ff9a3c' : kind === '전용' ? '#ffd84a' : HUE[kk.lab] || '#3fc7c0';
      return `<div class="potc bpc${kind === '전용' ? ' ex' : ''}${cnt && left <= 0 ? ' spent' : ''}" style="--ph:${hue}"><div class="poth"><span class="potk">${kk.no ? `<em>${esc(kk.no)}</em>` : ''}${kk.lab ? `<span>${esc(kk.lab)}</span>` : ''}</span><b class="potn">${esc(n)}</b>${cnt ? `<span class="bpcn">${pips(left, cnt.max)}</span>` : ''}${auto ? `<span class="bpau">자동${tm.entry ? ' · 등장' : tm.passive ? ' · 상시' : ''}</span>` : ''}</div>
    ${String(eff || '').trim() ? `<div class="pote">${pf(String(eff).replace(/<br\s*\/?>/gi, '\n'))}</div>` : ''}
    ${full ? `<div class="bpct"><button class="btn xs" data-pa="announce" data-kind="${k}" data-pot="${esc(n)}" title="효과 글을 채팅에 띄운다">📢 출력</button>${k === 'pot' && preCardOK(ctx(), m) && potIsPre(m, n) ? prePotBtn(ctx(), m, n).replace('data-act="pretoggle"', 'data-pa="pre"') : k === 'pot' && potRest(m, n) ? restChip(potRest(m, n)) : `${auto ? (syncLock(ctx().b, m, eff) ? `<button class="btn xs pri" disabled title="【동조】 — 필드에 같은 『역할』 대치가 없다">발동</button>` : `<button class="btn xs pri" data-pa="fire" data-kind="${k}" data-pot="${esc(n)}">발동</button>`) : ''}${cnt ? `<button class="btn xs" data-pa="use" data-pot="${esc(n)}" ${left > 0 ? '' : 'disabled'}>사용 −1</button>` : ''}`}${cnt ? `<button class="btn xs ghost" data-pa="restore" data-pot="${esc(n)}" ${left < cnt.max ? '' : 'disabled'}>+1</button>` : ''}${k === 'item' ? `<button class="btn xs" data-pa="consume" title="다 쓴 소지품을 칸에서 뺀다 (결과 정리 때 시트에도)">소모</button>` : ''}<span class="sp"></span>${window.OM_FX_UI ? `<button class="btn xs ghost" data-pa="edit" data-kind="${k}" data-pot="${esc(n)}" data-text="${esc(eff)}">구문</button>` : ''}</div>` : ''}</div>`;
    };
    const usedRow =
      (full || seeAll || ON.has((m.itemUsed || {}).name)) && !m.item && m.itemUsed && m.itemUsed.name
        ? `<div class="potc bpc spent" style="--ph:#ff9a3c"><div class="poth"><span class="potk"><span>소지품</span></span><b class="potn" style="text-decoration:line-through">${esc(m.itemUsed.name)}</b><span class="bpau">소모함</span><span class="sp"></span>${full ? '<button class="btn xs ghost" data-pa="unconsume">되돌리기</button>' : ''}</div><div class="pote small dim">이번 배틀에서 썼다</div></div>`
        : '';
    const md = A()
      .openModal(`<div class="mhead"><h2>${esc(m.name)} <span class="small dim">포텐셜 · 특성 · 소지품</span></h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="potl bpl">${rows.map(card).join('') || (usedRow ? '' : `<div class="small dim">${hid ? '공개된 것 없음' : '없음'}</div>`)}${usedRow}</div>${hid ? `<div class="small dim" style="margin-top:4px">🔒 아직 공개되지 않은 것 ${hid}개 — 도감으로 해석하거나 출력되면 보인다</div>` : ''}
   <div class="sec">발동 중인 효과 <span class="note">${chips.length}</span></div><div class="row" style="flex-wrap:wrap;gap:4px">${chips.map(ch => `<span class="rk fxc ${full ? 'rm' : ''}" title="${esc(ch.title)}" ${full ? `data-pa="off" data-fx="${esc(ch.id)}" data-nm="${esc(ch.name)}"` : ''}>${esc(ch.t)}${full ? ' ✕' : ''}</span>`).join('') || '<span class="small dim">없음</span>'}${full && chips.length ? `<span class="sp"></span><button class="btn xs ghost danger" data-pa="offall">모두 해제</button>` : ''}</div>
   ${full && ((m.tempRank && Object.keys(m.tempRank).length) || (m.tempMod && Object.keys(m.tempMod).length)) ? `<div class="row small" style="margin-top:6px"><span class="dim">임시 랭크·배율(턴 종료까지)이 걸려 있다</span><span class="sp"></span><button class="btn xs ghost" data-pa="temp">임시 랭크 해제</button></div>` : ''}`);
    md.querySelectorAll('[data-pa]').forEach(
      bt =>
        (bt.onclick = async () => {
          const k = bt.dataset.pa;
          const d = { mid, pot: bt.dataset.pot, kind: bt.dataset.kind };
          if (k === 'pre') {
            A().closeModal();
            return action({ act: 'pretoggle', mid, pot: d.pot });
          }
          if (k === 'announce') {
            A().closeModal();
            return action(Object.assign(d, { act: 'announce', card: '1' }));
          }
          if (k === 'fire') {
            if (syncLock(ctx().b, m, slotEff(m, d.kind, d.pot))) return A().toast('【동조】 — 필드에 같은 『역할』 대치가 없다');
            A().closeModal();
            if (d.kind === 'pot' && !(await preGuard(ctx(), m, d.pot))) return;
            if (d.kind === 'pot') await potMark(mid, d.pot);
            if (d.kind === 'pot' && wantCut(m, d.pot))
              cutFire('m:' + m.id, m.image, m.name, `『${d.pot}』`, m.side === 'left' ? '#1f6fd1' : '#e3101f');
            return fireAuto(mid, d.kind, d.pot);
          }
          if (k === 'use' || k === 'restore') {
            A().closeModal();
            return action({ act: k === 'use' ? 'usepot' : 'restorepot', mid, pot: d.pot, card: k === 'use' ? '1' : '' });
          }
          if (k === 'consume') {
            A().closeModal();
            return itemConsume(mid);
          }
          if (k === 'unconsume') {
            A().closeModal();
            return itemConsume(mid, true);
          }
          if (k === 'edit') {
            A().closeModal();
            return window.OM_FX_UI.openEditor({
              mon: ctx().b.mons[mid],
              kind: d.kind,
              name: d.pot,
              text: bt.dataset.text,
              save: async auto => {
                const cur = Object.assign({}, (ctx().b.mons[mid] || {}).auto || {});
                if (auto) cur[d.pot] = auto;
                else delete cur[d.pot];
                await A().set(['battle', 'mons', mid, 'auto'], cur);
                const rm = (A().ST.state.roster || {}).mons || {};
                if (rm[mid]) await A().set(['roster', 'mons', mid, 'auto'], cur);
                A().toast(auto ? '구문을 저장했다' : '구문을 지웠다');
              }
            });
          }
          if (k === 'off') {
            A().closeModal();
            return action({ act: 'fxoff', mid, fx: bt.dataset.fx, nm: bt.dataset.nm });
          }
          if (k === 'offall') {
            if (!(await askYes('발동 중인 효과를 모두 해제할까?', '모두 해제'))) {
              openPots(mid, only);
              return;
            }
            const m0 = snap(ctx().b.mons[mid]),
              x = snap(m0);
            FX().removeAll(x);
            A().closeModal();
            await saveMon(m0, mid, x);
            return A().sysLog(`${m.name} 효과 모두 해제`, 'battle');
          }
          if (k === 'temp') {
            const m0 = snap(ctx().b.mons[mid]),
              x = snap(m0);
            if (x.tempRank) {
              for (const kk in x.tempRank) x.rank[kk] = (+x.rank[kk] || 0) - (+x.tempRank[kk] || 0);
              delete x.tempRank;
            }
            if (x.tempMod) {
              for (const kk in x.tempMod) {
                x.mod[kk] = Math.round(((+x.mod[kk] || 1) / (+x.tempMod[kk] || 1)) * 1000) / 1000;
                if (x.mod[kk] === 1) delete x.mod[kk];
              }
              delete x.tempMod;
            }
            if (x.fx && x.fx.mults) x.fx.mults = x.fx.mults.filter(e => !e.temp);
            A().closeModal();
            await saveMon(m0, mid, x);
            return A().sysLog(`${m.name} 임시 랭크·배율 해제`, 'battle');
          }
        })
    );
  }
  /* ---------- HP 창 (맵툴 hp_mgr): 받은 피해 판정 적용(완화 배율) · 비율/고정 피해 · 특수 피해 · 회복 ---------- */
  const FRACS = [
    ['1/16', 16],
    ['1/8', 8],
    ['1/6', 6],
    ['1/4', 4],
    ['1/3', 3],
    ['1/2', 2],
    ['2/3', 1.5]
  ];
  function parseAmt(v, base) {
    v = String(v || '').trim();
    if (!v) return 0;
    const m = v.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (m) return Math.max(1, Math.floor((base * +m[1]) / +m[2]));
    const n = +v;
    return isNaN(n) ? 0 : Math.max(0, Math.floor(n));
  }
  /* HP 창의 감쇄 · 보정 요소 (10-27): 기본 대미지에 이미 들어간 것 + 여기서 곱하는 것. 공격 쪽 보정은 공격 쪽을 다룰 수 있을 때만 */
  function hfxHtml(c, lh) {
    if (!lh) return '';
    const F = lh.hfx || { pub: [], atk: [] };
    const am = (c.b.mons || {})[lh.fromId];
    const seeAtk = true;
    /* 10-28 망령: 공격 쪽 보정(소지품 ×1.2 · 타입 강화 …)도 받는 쪽에 그대로 보인다 — 때리는 쪽 · 받는 쪽 · 판정 로그 표기를 맞춘다 */ const chip =
      t => `<span class="chip" style="cursor:default">${esc(t)}</span>`;
    const isW = t => /」 피해 ×[\d.]+(?: \(더블\))? · 급소면 무시$/.test(String(t)),
      wG = (F.grd || []).filter(isW),
      gR = (F.grd || []).filter(t => !isW(t)); /* 11-09 망령: 벽 이름표(_wall)는 기본 대미지에 이미 들어간 것 — 「위력 완화」 칩 옆에 붙이지 않는다 */
    const inB = [...(F.pub || []), ...wG, ...(seeAtk ? F.atk || [] : [])];
    const hidN = seeAtk ? 0 : (F.atk || []).length;
    return `<div class="hfx small" style="margin:6px 0;padding:6px 8px;border:1px dashed var(--line,#888);border-radius:8px"><div><b>기본 대미지에 이미 들어감</b> ${inB.length ? inB.map(chip).join(' ') : '<span class="dim">없음</span>'}${hidN ? ` <span class="dim">+ 공격 쪽 보정 ${hidN}개 (공격 쪽만 볼 수 있다)</span>` : ''}${lh.crit ? ' ' + chip('급소') : ''}</div>
   <div style="margin-top:4px"><b>여기서 곱함</b> ${chip('상성 ×' + lh.eff)} ${lh.guard && lh.guard !== 1 ? chip('위력 완화 ×' + lh.guard + (gR.length ? ' — ' + gR.join(' · ') : '')) : ''} <span class="dim">· 반감열매 · 대미지 보정 · 버티기는 아래 칸</span></div></div>`;
  }
  /* 11-26 366 속별 『레기온』 「【1/시】【자동】【방호】/「HP : 가득」일 때 「HP」를 1/2만큼 소비하여 자신에 대한 「단일기 : 공격」을 무효화한다」:
     받은 피해 창 「피해 적용」 직전에 본다(대타출동과 같은 자리) — HP 가 가득이고 맞은 기술이 1체 공격기이며 횟수가 남았으면, 그 피해를 버리고 HP 를 a/b 만큼 깎는다. 글 꼴이 같으면 다른 이름의 포텐셜도.
     트레이너 · 포켓몬 【방호】 무시(방호무시)와의 관계는 아직 안 봄 — 무시당해도 발동한다 */
  const HPPAY_RE =
    /「\s*HP\s*:\s*가득\s*」\s*일\s*때\s*「\s*HP\s*」\s*(?:를|을)\s*(\d+)\s*\/\s*(\d+)\s*만큼\s*소비하여\s*자신에\s*대한\s*「\s*단일기\s*(?::\s*공격)?\s*」\s*(?:을|를)\s*무효화/;
  async function hpPayNull(mid, lh) {
    try {
      const b = ctx().b;
      const m = (b.mons || {})[mid];
      if (!m || !lh || !m.hp || +m.hp.cur < +m.hp.max) return false;
      const p = potSrc(m).find(q => q && q.name && !q.ph && potLive(m, q) && HPPAY_RE.test(String(q.eff || '')));
      if (!p) return false;
      const L = limOf(p, m.potUses || {}, m.potTurn || {});
      if (L.left !== null && L.left <= 0) return false;
      const a = (b.mons || {})[lh.fromId];
      const mv = (a && MVS(a).find(v => v && v.name === lh.move)) || (DB().moves || {})[lh.move] || null;
      if (!mv || mv.cat === '변화' || String(mv.range || '').trim() !== '1체') return false;
      const x0 = String(p.eff || '').match(HPPAY_RE);
      const cost = Math.max(1, Math.floor((+m.hp.max * +x0[1]) / +x0[2]));
      const hp0 = +m.hp.cur;
      const m0 = snap(m),
        x = snap(m0);
      delete x.lastHit;
      x.hp.cur = Math.max(1, hp0 - cost);
      if (L.mmax != null) {
        x.potUses = Object.assign({}, x.potUses || {});
        const u = x.potUses[p.name];
        x.potUses[p.name] = Math.max(0, (u == null ? L.mmax : +u) - 1);
      }
      if (!(await saveMon(m0, mid, x))) return false;
      A().sysLog(
        `【포텐셜】 ${m.name} 『${String(p.name).replace(/[『』]/g, '')}』 — 「HP」를 ${x0[1]}/${x0[2]}(−${cost}) 소비하여 ${lh.from}의 「${lh.move}」를 무효화\nHP ${hp0} → ${x.hp.cur}/${m.hp.max}`,
        'battle',
        { mid, img: m.image || '' }
      );
      return true;
    } catch (e) {
      console.warn('hpPayNull', e);
      return false;
    }
  }
  function openHp(mid, tab) {
    const c = ctx();
    const b = c.b;
    const m = b.mons[mid];
    if (!m || !canEdit(c, m)) return;
    tab = tab || (m.lastHit ? 'dmg' : 'dmg');
    const lh = m.lastHit;
    const pct = m.hp.cur > 0 ? Math.max(1, Math.round((m.hp.cur / m.hp.max) * 100)) : 0;
    const EFFS = [0, 0.25, 0.5, 1, 2, 4];
    const fl = raidFloor(m);
    const berryN = lh && OI() ? OI().resist(m, lh) : '';
    let sashX = lh && OI() ? OI().sash(m) : null;
    if (lh && lh.cat !== '변화' && !(sashX && (sashX.sure || sashX.pct))) {
      const bb = bondBand(m);
      if (bb) sashX = bb;
    }
    /* 11-04 20:34: 『사랑의 유대』 · 『영혼의 유대』 */ const SH = lh ? hitShield(m, lh) : {};
    const RX = lh && lh.cat !== '변화' ? hitRules(m) : [];
    const md = A()
      .openModal(`<div class="mhead"><h2>「HP」 · ${esc(m.name)}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="hphead"><div class="ti" style="${m.image ? `background-image:url('${cssu(m.image)}')` : ''}"></div><div style="flex:1"><div class="hpbar ${pct <= 25 ? 'low' : pct <= 50 ? 'mid' : ''}"><i style="width:${pct}%"></i></div><div class="row small"><span>「HP」 <b>${m.hp.cur}</b> / ${m.hp.max} (${pct}%)</span>${m.hp.latest != null && m.hp.latest !== m.hp.cur ? `<span class="dim">직전 ${m.hp.latest}</span>` : ''}<span class="sp"></span><span class="hpundo"><button class="btn xs ghost" data-hp="undo" ${m.hp.latest == null ? 'disabled' : ''}>되돌리기</button><button class="btn xs ghost" data-hp="one">HP 1</button><button class="btn xs ghost danger" data-hp="faint">빈사</button></span></div></div></div>
   <div class="tabs"><button class="tb ${tab === 'dmg' ? 'on' : ''}" data-hpt="dmg">피해</button><button class="tb ${tab === 'heal' ? 'on' : ''}" data-hpt="heal">회복</button></div>
   ${
     tab === 'dmg'
       ? `
   ${
     lh
       ? `<div class="card hit"><div class="hith"><span class="hitw">${esc(lh.from)}</span><span class="hitm">「${esc(lh.move)}」</span>${lh.moveType ? `<span class="small dim">${esc(lh.moveType)}</span>` : ''}<span class="sp"></span><span class="hitc ${+lh.eff > 1 ? 'up' : +lh.eff < 1 ? 'dn' : ''}">상성 ×${lh.eff}</span><span class="hitc cr" id="h_critc" ${lh.crit ? '' : 'hidden'}>급소</span>${lh.hits > 1 ? `<span class="hitc">${lh.hits}번 맞음</span>` : ''}</div>
     <div class="hitb"><div><small>기본 대미지</small><b id="h_tot">${lh.total}</b><i id="h_rng">${lh.min}~${lh.max}</i></div><div><small>위력 완화</small><b>${lh.guard && lh.guard !== 1 ? '×' + lh.guard : '—'}</b><i>${lh.guardNote ? esc(lh.guardNote) : '자동 반영'}${lh.guard && lh.guard < 1 ? ' · 급소 타는 무시' : ''}</i></div><div class="hitp"><small>받을 피해</small><b id="h_prevd">—</b><i id="h_preva"></i></div></div>
     <div class="hpbar hitbar"><i id="h_bar_after" style="width:${pct}%"></i><em id="h_bar_cut"></em></div><div class="small dim" id="h_perhit" style="margin:2px 0 4px;overflow-wrap:anywhere" hidden></div>
      ${hfxHtml(c, lh)}
     <div class="hgrid">${lh.alt ? `<label class="hcrit" title="명중 판정에서 굴린 급소 여부를 여기서 바꾼다 — 대미지를 급소/급소 아님으로 다시 계산한 값으로"><input type="checkbox" id="h_crit" ${lh.crit ? 'checked' : ''}> 급소 <span class="small dim">(판정: ${lh.crit ? '급소' : '급소 아님'})</span></label>` : ''}<label>대미지 보정 <input type="text" class="n" id="h_mod" value="${lh.manual && lh.manual !== 1 ? lh.manual : 1}" title="방호·완화·역할 보정 등 배율 · 곱셈도 된다 (1.2*1.5 · ×0.5)"></label>
      <label>최종 상성 <select id="h_eff">${EFFS.map(v => `<option value="${v}" ${v === +lh.eff ? 'selected' : ''}>×${v}</option>`).join('')}</select></label>
      ${(m.states || {}).Substitute ? `<label title="대역인형(남은 ${+m.subHp || Math.max(1, Math.floor(m.hp.max / 4))})이 대신 맞는다 — 관통하는 기술 · 특성이면 끈다"><input type="checkbox" id="h_sub" checked> 대타출동이 대신 맞음 <b style="color:var(--yel2)">인형 ${+m.subHp || Math.max(1, Math.floor(m.hp.max / 4))}</b></label>` : ''}<label><input type="checkbox" id="h_berry" ${berryN || lh.berry ? 'checked' : ''}> 반감열매${berryN ? ` <b style="color:var(--yel2)">「${esc(berryN)}」</b>` : ''}</label><label><input type="checkbox" id="h_endure" ${lh.endure || (sashX && sashX.sure) ? 'checked' : ''}> 버티기 (HP 1 남김)${sashX && sashX.sure ? ` <b style="color:var(--yel2)">「${esc(sashX.name)}」</b>` : ''}</label>${sashX && sashX.pct ? `<label class="small" style="color:var(--yel2)">「${esc(sashX.name)}」 쓰러질 피해면 ${sashX.pct}% 로 버틴다 (적용 때 굴림)</label>` : ''}
      ${SH.fullGuard ? `<label title="그 타를 맞기 전에 HP 가 가득일 때만 — 연속기면 첫 타만"><input type="checkbox" id="h_fg" checked> 「${esc(SH.fullGuard.name)}」 HP 가득일 때 반감</label>` : ''}${SH.disguise ? `<label title="이번 시합 한 번 — 처음 맞은 타의 대미지를 0 으로, 대신 HP 를 쓴다"><input type="checkbox" id="h_dsg" checked> 「${esc(SH.disguise.name)}」 첫 타 0 · HP −${SH.disguise.cost}</label>` : ''}${RX.length ? `<label title="맞은 타마다 특성 글대로 굴리고 적용한다 (적용 뒤 로그)"><input type="checkbox" id="h_rx" checked> 맞을 때 「${esc(abNm(m))}」 자동${lh.hits > 1 ? ' (맞은 타마다)' : ''}</label>` : ''}
      <label>고정 대미지 <input type="text" class="n" id="h_forced" placeholder="-1 = 계산값" value="-1" title="숫자 또는 분수(1/8)를 넣으면 그 값으로"></label>
      ${fl ? `<label class="small" style="color:var(--yel)">레이드 배리어 하한 ${fl}</label>` : ''}</div>
     </div>`
       : '<div class="small dim" style="margin:6px 0">받은 피해 판정이 없다 — 고정·비율 피해로 처리한다.</div>'
   }
   <div class="card"><div class="sec">비율 · 고정 피해 <span class="note">최대 「HP」 기준</span></div><div class="qs">${FRACS.map(([l, n]) => `<button class="btn sm" data-hp="frac" data-v="${l}">${l} <small>−${Math.max(1, Math.floor(m.hp.max / n))}</small></button>`).join('')}</div>
    <div class="row" style="margin-top:6px"><input type="text" class="n" id="h_cv" placeholder="숫자 또는 분수 (예: 30, 1/8)" style="width:170px"><button class="btn sm" data-hp="custom">피해</button></div></div>
   <div class="card"><div class="sec">특수한 피해</div>
    <div class="spx"><b>↻ 최근 피해 다시</b><span class="small dim">${m.lastTaken ? `직전에 받은 피해 ${m.lastTaken.v} · ${esc(m.lastTaken.why)}` : '(기록 없음)'}</span><span class="qs"><button class="btn xs" data-hp="again" ${m.lastTaken ? '' : 'disabled'} title="같은 피해를 한 번 더 받는다 (연속기 추가타 · 같은 효과가 다시 터질 때)">한 번 더</button><button class="btn xs ghost" data-hp="againh" ${m.lastTaken ? '' : 'disabled'} title="그 피해의 절반">½</button>${m.lastTaken && m.lastTaken.hit ? '<button class="btn xs pri" data-hp="rehit" title="그때의 판정과 넣은 배율을 다시 불러와 고쳐서 받는다">배율 고쳐 다시 받기</button>' : ''}</span></div>
    <div class="spx"><b>🌀 혼란 자해</b><span class="small dim">위력 40 노말 물리 · 상성 · 랭크 무시 (자기 공격/방어)</span><span class="qs"><button class="btn xs" data-hp="confuse">자해</button></span></div>
    <div class="spx"><b>✊ 발버둥 반동</b><span class="small dim">최대 「HP」의 1/4 · 무시할 수 없다 (−${Math.max(1, Math.floor(m.hp.max / 4))})</span><span class="qs"><button class="btn xs" data-hp="strug">반동</button></span></div>
    ${ldSel(m)}<div class="spx"><b>↯ 반동</b><span class="small dim">직전에 입힌 대미지의 비율 ${m.lastDealt ? `(<span class="ldv">${m.lastDealt.total}</span> · ${esc(m.lastDealt.targets)})` : '(기록 없음)'}</span><span class="qs">${['1/4', '1/3', '1/2'].map(x => `<button class="btn xs" data-hp="recoil" data-v="${x}" ${m.lastDealt ? '' : 'disabled'}>${x}</button>`).join('')}</span></div>
    <div class="spx"><b>% 현재 HP 비례</b><span class="small dim">현재 「HP」(${m.hp.cur})의 비율</span><span class="qs">${['1/2', '1/4', '1/8'].map(x => `<button class="btn xs" data-hp="cur" data-v="${x}">${x}</button>`).join('')}</span></div>
    <div class="spx"><b>◈ 타입 비례</b><span class="small dim">최대 「HP」 × 비율 × 상성 (스텔스록처럼)</span><span class="qs"><select id="h_tt" class="mini">${(S().allTypes ? S().allTypes() : ['Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy']).map(t => `<option value="${t}">${esc(S().typeKo(t))}</option>`).join('')}</select><input type="text" class="n xs" id="h_tv" value="1/8"><button class="btn xs" data-hp="typed">피해</button></span></div></div>
   ${lh ? `<div class="row afoot hpfoot"><span class="small dim" id="h_prev"></span><span class="sp"></span><button class="btn ghost xs" data-hp="discard" title="이 판정을 지운다 (피해 없음)">판정 버리기</button><button class="btn pri" data-hp="apply">피해 적용</button></div>` : ''}`
       : `<div class="card"><div class="sec">회복 <span class="note">최대 「HP」 기준</span></div><div class="qs">${FRACS.map(([l, n]) => `<button class="btn sm" data-hp="heal" data-v="${l}">${l} <small>+${Math.max(1, Math.floor(m.hp.max / n))}</small></button>`).join('')}<button class="btn sm" data-hp="full">전부</button></div>
    <div class="row" style="margin-top:6px"><input type="text" class="n" id="h_cv" placeholder="숫자 또는 분수" style="width:170px"><button class="btn sm" data-hp="healc">회복</button></div></div>
   <div class="card"><div class="sec">특수한 회복</div>
    <div class="spx"><b>◆ 드레인</b><span class="small dim">직전에 입힌 대미지의 비율 ${m.lastDealt ? `(<span class="ldv">${m.lastDealt.total}</span>)` : '(기록 없음)'}</span><span class="qs">${['1/2', '3/4', '1/1'].map(x => `<button class="btn xs" data-hp="drain" data-v="${x}" ${m.lastDealt ? '' : 'disabled'}>${x}</button>`).join('')}</span></div>
    <div class="spx"><b>★ 희망사항</b><span class="small dim">최대 「HP」 1/2</span><span class="qs"><button class="btn xs" data-hp="heal" data-v="1/2">회복</button></span></div></div>`
   }`);
    md.querySelectorAll('[data-hpt]').forEach(
      bt =>
        (bt.onclick = () => {
          A().closeModal();
          openHp(mid, bt.dataset.hpt);
        })
    );
    if (lh && lh.re) {
      const o = lh.re,
        g = id => $('#' + id, md);
      const sv = (id, v) => {
        const e = g(id);
        if (e && v != null) e.value = v;
      };
      const sc = (id, v) => {
        const e = g(id);
        if (e && v != null) e.checked = !!v;
      };
      sv('h_eff', o.eff);
      sv('h_mod', o.mod);
      sv('h_forced', o.forced);
      sc('h_berry', o.berry);
      sc('h_endure', o.endure);
      sc('h_crit', o.crit);
    } /* 다시 받기: 그때 넣은 배율 */
    const curHit = () => {
      const ck = $('#h_crit', md);
      return ck && lh.alt && ck.checked !== !!lh.crit ? lh.alt : lh;
    };
    /* 10-27 망령: 연속기는 타마다 깎는다 (lastHit.per). 버티기 칸이 띠(HP 가득일 때만)로 켜진 거면 그 타를 맞기 전에 가득일 때만 · roll 을 주면 확률 띠를 쓰러지는 타마다 굴린다 */
    const calc = roll => {
      if (!lh) return null;
      const g = id => $('#' + id, md);
      const forced = g('h_forced').value.trim();
      if (forced !== '' && forced !== '-1') {
        const v = parseAmt(forced, m.hp.max);
        return { final: Math.min(v, m.hp.cur), after: Math.max(0, m.hp.cur - v) };
      }
      const h = curHit();
      const per = h.per && h.per.length > 1 ? h.per : [h.total];
      const en = g('h_endure').checked,
        sashOnly = en && !lh.endure && !!(sashX && sashX.sure);
      const fgOn = !!(SH.fullGuard && g('h_fg') && g('h_fg').checked),
        dgOn = !!(SH.disguise && g('h_dsg') && g('h_dsg').checked);
      /* 멀티스케일을 손으로 발동해 둔 경우 위력 완화에 이미 ×0.5 가 들어 있다 — 빼고 타마다 다시 건다 */ const g0 =
        (lh.guard || 1) / (fgOn && String(lh.guardNote || '').includes(SH.fullGuard.name) ? SH.fullGuard.v : 1);
      const r = B().hpDamageHits(m, per, +g('h_eff').value, {
        fullGuard: fgOn ? SH.fullGuard.v : 0,
        disguise: dgOn ? SH.disguise.cost : 0,
        stab: false,
        guard: g0,
        guardCrit: lh.guardCrit,
        crit: h === lh ? lh.perCrit || !!lh.crit : !!h.crit,
        manual: mulOf(g('h_mod').value, 1) || 1,
        berryHalf: g('h_berry').checked,
        endure: en && !sashOnly,
        endureFull: sashOnly,
        hpFloor: fl,
        band: roll && sashX && sashX.pct && !en ? { pct: sashX.pct, roll: () => 1 + Math.floor(Math.random() * 100) } : null
      });
      return r;
    };
    const perTxt = r => {
      const n = (curHit().per || []).length;
      if (!r || !r.per || (n < 2 && !r.per.some(x => x.held === 'disguise' || x.fg))) return '';
      return (
        r.per
          .map(
            (x, k) =>
              `${k + 1}타 −${x.final}${x.held === 'band' ? '(띠로 버팀)' : x.held === 'disguise' ? '(탈)' : x.held ? '(버팀)' : ''}${x.fg ? '(반감)' : ''}`
          )
          .join(' · ') + (r.landed < n ? ` · ${r.landed}타째에 쓰러져 남은 ${n - r.landed}타는 맞지 않음` : '')
      );
    };
    const prev = () => {
      const r = calc();
      if (!r) return;
      {
        const h = curHit();
        const t = $('#h_tot', md),
          rg = $('#h_rng', md),
          cc = $('#h_critc', md);
        if (t) t.textContent = h.total;
        if (rg) rg.textContent = h.min + '~' + h.max;
        if (cc) cc.hidden = !h.crit;
      }
      const P = v => (v > 0 ? Math.max(1, Math.round((v / m.hp.max) * 100)) : 0);
      const d = $('#h_prevd', md),
        a = $('#h_preva', md),
        bA = $('#h_bar_after', md),
        bC = $('#h_bar_cut', md);
      if (d) d.textContent = '−' + r.final;
      if (a) a.textContent = `HP ${m.hp.cur} → ${r.after}/${m.hp.max} (${P(r.after)}%)${r.after <= 0 ? ' · 빈사' : ''}`;
      {
        const ph = $('#h_perhit', md);
        if (ph) {
          ph.textContent = perTxt(r);
          ph.hidden = !ph.textContent;
        }
      }
      if (bA) bA.style.width = P(r.after) + '%';
      if (bC) {
        bC.style.left = P(r.after) + '%';
        bC.style.width = Math.max(0, pct - P(r.after)) + '%';
      }
    };
    prev();
    md.querySelectorAll('#h_mod,#h_eff,#h_berry,#h_endure,#h_forced,#h_crit,#h_fg,#h_dsg').forEach(el => {
      el.addEventListener('input', prev);
      el.addEventListener('change', prev);
    });
    const apply = async (delta, why, opt) => {
      opt = opt || {};
      const m0 = snap(ctx().b.mons[mid]),
        x = snap(m0);
      x.hp.latest = x.hp.cur;
      if (delta < 0) {
        let v = -delta;
        if (opt.floor && x.hp.cur - v < opt.floor) v = Math.max(0, x.hp.cur - opt.floor);
        x.hp.cur = Math.max(0, x.hp.cur - v);
        x.hpOdd = !x.hpOdd;
        delta = -v;
        if (v > 0)
          x.lastTaken = {
            v,
            why: String(why || '')
              .split('\n')[0]
              .slice(0, 120),
            turn: +ctx().b.turn || 0,
            ...(opt.hit ? { hit: opt.hit } : {})
          };
      } else {
        const h = Math.min(delta, x.hp.max - x.hp.cur);
        x.hp.cur += h;
        delta = h;
      }
      if (opt.clearHit) delete x.lastHit;
      if (opt.dsg) x.dsgUsed = 1;
      const pc = v => (v > 0 ? Math.max(1, Math.round((v / x.hp.max) * 100)) : 0);
      const ILT = illuOf(ctx().b, m0);
      const ilOff = !!(ILT && delta < 0 && (opt.hit || opt.clearHit));
      if (ilOff) {
        delete x.disg;
        x.seen = true;
      } /* 11-05 일루젼: 기술의 대미지를 받으면 풀린다 */
      let line = delta
        ? `【${delta > 0 ? '회복' : '피해'}】 ${x.name} ${delta > 0 ? '+' : '−'}${Math.abs(delta)}  ·  HP ${x.hp.latest} → ${x.hp.cur}/${x.hp.max} (${pc(x.hp.cur)}%)\n${why}`
        : `【무효】 ${x.name} 대미지 없음  ·  HP ${x.hp.cur}/${x.hp.max}\n${why}`;
      if (x.hp.cur <= 0) {
        x.entry = '';
        line += `\n${x.name}은(는) 쓰러졌다!`;
      }
      if (x.raid && x.raid.segments > 0 && opt.floor && x.hp.cur <= opt.floor && delta < 0 && x.hp.cur > 0) {
        line += '\n' + raidBreak(x, opt.floor);
      } /* 10-25 망령: 맵툴처럼 페이즈 체인지는 깨진 턴이 끝난 뒤 */
      const LX = Object.assign(
        { mid, img: x.image || '' },
        delta ? { hp: { name: x.name, prev: x.hp.latest, cur: x.hp.cur, max: x.hp.max, why, faint: x.hp.cur <= 0 } } : {}
      );
      const LM = ilOff ? illuMask({ t: line, e: LX }, ctx().b) : { t: line, e: LX }; /* 풀리기 전 모습으로 피해 줄을 쓰고 나서 「【일루젼】」 */
      A().closeModal();
      if (await saveMon(m0, mid, x)) {
        await A().sysLog(LM.t, 'battle', LM.e);
        if (ilOff)
          await A().sysLog(`【일루젼】 「${ILT.name}」의 정체는 「${x.name}」 — 「일루젼」이 풀렸다!`, 'battle', { mid, img: x.image || '' });
        if (x.hp.cur <= 0 && m0.hp.cur > 0) await faintOff(mid);
        /* 11-18: 미뤄 둔 강제 교대(휘젓기 · 드래곤테일 …) — 대미지를 적용하고 살아 있으면 */ const FS = opt.clearHit && m0.lastHit && m0.lastHit.fsw;
        if (FS && x.hp.cur > 0) {
          const d = ctx().b.mons[mid];
          if (d && d.entry && d.hp.cur > 0) {
            const gd = await switchGuard(d);
            if (gd) A().sysLog(`${d.name} 강제 교대를 받지 않는다 (${gd})`, 'battle');
            else await forcedSwitch(mid, { sys: true });
          }
        }
      }
    };
    md.querySelectorAll('[data-hp]').forEach(
      bt =>
        (bt.onclick = async () => {
          const k = bt.dataset.hp;
          const v = bt.dataset.v;
          const g = id => $('#' + id, md);
          if (k === 'apply') {
            let r = calc();
            if (!r) return;
            if (r.final > 0 && (await hpPayNull(mid, lh))) {
              A().closeModal();
              return;
            }
            /* 11-26 레기온: HP 를 치르고 무효화 */ const mods = [];
            {
              const hm = mulOf(g('h_mod').value, 1) || 1;
              if (hm !== 1) mods.push('보정 ×' + hm);
            }
            if (g('h_berry').checked) mods.push(berryN ? '「' + berryN + '」 반감' : '반감열매');
            let saved = false;
            if (g('h_endure').checked) {
              const ec = g('h_endure');
              ec.checked = false;
              const r0 = calc();
              ec.checked = true;
              saved = !!(r0 && r0.after <= 0 && r.after > 0);
              if (saved) mods.push(sashX && sashX.sure ? '「' + sashX.name + '」로 버팀' : '버티기');
            } /* 10-23 망령 제보: 쓰러질 피해가 아니면 「버팀」을 적지 않는다 */
            /* 기합의머리띠: 쓰러질 피해면 굴린다 */
            /* 11-04 20:40 망령: 유대 — PVP 아니고 방 설정이 「GM 이 정함」이면 쓰러질 때 GM 에게 굴림 · 확정 발동 · 발동 안 함을 묻는다 (GM 이 아닌 화면이면 GM 화면으로) */
            /* 11-09 망령: 방 설정 「모든 빈사에 GM 에게 묻는다」(PVP 아닐 때) · 「GM 이 정함」(유대 포텐셜) — 고르는 것에 「자신의 행동 이후로 대미지를 미룬다」. 구문 「미루기」(lh.defer)면 묻지 않고 미룬다 */
            let bondForce = false,
              gmEnd = false,
              deferIt = false;
            /* 11-28 망령 「GM 판정이라고 뜨면 좀 짜치니까 다이스 굴린 척 나오게」: GM 이 고른 결과도 로그엔 굴림처럼 (성공이면 확률 안, 실패면 밖의 수) */
            const fakeRoll = (pct, ok) => (ok ? 1 + Math.floor(Math.random() * pct) : pct + 1 + Math.floor(Math.random() * (100 - pct)));
            let endTxt = '';
            {
              const bm = (A().ST.state.rp || {}).bondMode || '';
              const dying = !g('h_endure').checked && r.after <= 0 && m.hp.cur > 0 && !m.defer;
              const bond = sashX && sashX.pot && m.hp.cur > 1 ? sashX : null;
              if ((dying || (lh.deferAll && r.final > 0 && !m.defer)) && lh.defer) {
                deferIt = true;
                mods.push(`「${lh.defer}」 — 대미지를 자신의 행동 뒤로 미룸`);
              } else if (dying && !ctx().b.pvp && (bm === 'all' || (bm === 'gm' && bond))) {
                const DF = '자신의 행동 이후로 대미지를 미룬다';
                /* 11-28 망령 「GM 이 정하는 설정일 때 나오는 항목 중에 확률로 굴리기도 있긴 해야지」: 유대 포텐셜이 없는 빈사(모든 빈사에 묻기)에도 굴림 — 유대와 같은 저확률 */
                const bondPct = Math.round((FX() && FX().percentOf && FX().percentOf('저확률')) || 20);
                const L3 = bond
                  ? ['굴린다 (' + bond.pct + '%)', '확정 발동 — 버틴다', '발동 안 함 — 쓰러진다', DF]
                  : ['쓰러진다', '유대 — HP 1 로 버틴다', DF, '유대 — 확률로 굴린다 (' + bondPct + '%)'];
                const nm = bond ? bond.name : `${m.name} 빈사`;
                const pick = async () => localUi(ctx().b, m, nm).choose(L3);
                const ans = ctx().gm ? await pick() : await remoteAsk(m, 'choose', { name: nm, labels: L3 }, pick, 'gm');
                const ix = Array.isArray(ans) && ans.length ? +ans[0] : 0;
                if (bond) {
                  if (ix === 2) {
                    mods.push(`「${bond.name}」 실패 (${fakeRoll(+bond.pct || 20, false)}/${+bond.pct || 20})`);
                    sashX = null;
                  } else if (ix === 1) {
                    bondForce = true;
                  } else if (ix === 3) {
                    deferIt = true;
                    sashX = null;
                    mods.push('대미지를 자신의 행동 뒤로 미룸');
                  }
                } else {
                  if (ix === 1) {
                    gmEnd = true;
                    endTxt = `「유대」로 버팀 (${fakeRoll(bondPct, true)}/${bondPct})`;
                  } else if (ix === 2) {
                    deferIt = true;
                    mods.push('대미지를 자신의 행동 뒤로 미룸');
                  } else if (ix === 3) {
                    const roll = 1 + Math.floor(Math.random() * 100);
                    if (roll <= bondPct) {
                      gmEnd = true;
                      endTxt = `「유대」로 버팀 (${roll}/${bondPct})`;
                    } else mods.push(`「유대」 실패 (${roll}/${bondPct})`);
                  }
                }
              }
            }
            if (deferIt) {
              const why = `${lh.from}의 「${lh.move}」 · 상성 ×${g('h_eff').value}${mods.length ? ' · ' + mods.join(' · ') : ''}`;
              const af = deferWhen(ctx().b, mid);
              const m0 = snap(ctx().b.mons[mid]),
                x = snap(m0);
              delete x.lastHit;
              x.defer = { v: r.final, why, turn: +ctx().b.turn || 0, after: af };
              A().closeModal();
              if (await saveMon(m0, mid, x))
                await A().sysLog(
                  `【미룸】 ${m.name} — 「빈사」가 될 대미지 −${r.final} 를 ${af === 'end' ? '턴 종료 시로' : '자신의 행동 이후로'} 미뤘다  ·  HP ${m.hp.cur}/${m.hp.max} 그대로\n${why}`,
                  'battle',
                  { mid, img: m.image || '' }
                );
              return;
            }
            if (gmEnd) {
              const ec = g('h_endure');
              ec.checked = true;
              r = calc();
              ec.checked = false;
              mods.push(endTxt || '「유대」로 버팀');
            } else if (bondForce && sashX) {
              const ec = g('h_endure');
              ec.checked = true;
              r = calc();
              ec.checked = false;
              mods.push(`「${sashX.name}」로 버팀 (${fakeRoll(+sashX.pct || 20, true)}/${+sashX.pct || 20})`);
              await potMark(mid, sashX.name);
            } else if (sashX && sashX.pct && !g('h_endure').checked && r.after <= 0 && m.hp.cur > 1) {
              r = calc(true);
              for (const x of (r.per || []).filter(x => x.band))
                mods.push(
                  x.band.ok ? `「${sashX.name}」로 버팀 (${x.band.roll}/${x.band.pct})` : `「${sashX.name}」 실패 (${x.band.roll}/${x.band.pct})`
                );
              if (sashX.pot && (r.per || []).some(x => x.band && x.band.ok)) {
                await potMark(mid, sashX.name);
                if (ctx().b.pvp) await A().set(['battle', 'mons', mid, 'bondUsed'], 1);
              }
            }
            /* 11-04 19:50 망령 「대타출동의 자동화는 되어 있어?」: 「대타출동」 상태면 대역인형(최대 HP 1/4)이 대신 맞는다 — 인형 HP 가 0 이 되면 부서지고 넘친 피해는 본체에 가지 않는다 */
            if ((m.states || {}).Substitute && g('h_sub') && g('h_sub').checked && r.final > 0) {
              const sub0 = +m.subHp || Math.max(1, Math.floor(m.hp.max / 4));
              const hc = curHit();
              const per = hc.per && hc.per.length ? hc.per : [hc.total];
              const unc = Math.round(
                per.reduce((a, v) => a + (+v || 0), 0) *
                  (+g('h_eff').value || 1) *
                  (mulOf(g('h_mod').value, 1) || 1) *
                  (g('h_berry').checked ? 0.5 : 1) *
                  (lh.guard || 1)
              );
              const dmg = r.after <= 0 ? Math.max(r.final, unc) : r.final;
              const left = sub0 - dmg;
              const m0 = snap(ctx().b.mons[mid]),
                x = snap(m0);
              delete x.lastHit;
              x.states = Object.assign({}, x.states || {});
              if (left > 0) x.subHp = left;
              else {
                delete x.states.Substitute;
                delete x.subHp;
              }
              A().closeModal();
              if (await saveMon(m0, mid, x))
                A().sysLog(
                  `【대타출동】 ${m.name}의 대역인형이 ${lh.from}의 「${lh.move}」 −${dmg} 를 대신 맞았다${left > 0 ? ` (인형 ${left}/${Math.max(1, Math.floor(m.hp.max / 4))})` : ' — 인형이 부서졌다!'}\nHP ${m.hp.cur}/${m.hp.max} 그대로`,
                  'battle',
                  { mid, img: m.image || '' }
                );
              if (left <= 0) setTimeout(() => subBrokeAuto(mid).catch(e => console.warn('subBrokeAuto', e)), 400);
              return;
            }
            /* 11-07: 받는 쪽 완화(특성 · 포텐셜 이름)도 공개 — 아래 「✦ 받는 쪽」 줄에 (예전엔 나만 보는 【보정】 로그) */
            const berryUse = g('h_berry').checked ? berryN || (/열매/.test(IT(m)) ? IT(m) : '') : '';
            const sashUse = saved && sashX && sashX.sure && sashX.once && m.hp.cur > 1;
            const hc = curHit();
            const rxOn = !!(RX.length && g('h_rx') && g('h_rx').checked);
            /* 창이 닫히기 전에 읽어 둔다 */ const ret = await apply(
              -r.final,
              `${lh.from}의 「${lh.move}」 · 상성 ×${g('h_eff').value}${hc.crit ? ' · 급소' : ''}${hc !== lh ? (hc.crit ? ' (급소로 바꿈)' : ' (급소 아님으로 바꿈)') : ''}${lh.hits > 1 ? ' · ' + lh.hits + '번 맞음' : ''}${(() => {
                const H = lh.hfx || {};
                const A0 = [...(H.pub || [])];
                return (
                  (A0.length ? '\n   ✦ 공격 쪽  ' + A0.join(' · ') : '') +
                  (() => {
                    const G = [
                      ...(H.grd || [])
                        .map(x => (saved ? x : String(x).replace(/\s*·?\s*빈사 견딤$/, '')))
                        .filter(x => !/」\s*(급소 없음)?$/.test(x))
                        .filter(x => !mods.includes(x)),
                      ...mods
                    ];
                    /* 11-07: 켜져만 있고 이번에 일하지 않은 줄(빈사 견딤 — 버티지 않았을 때 · 급소 없음)은 공개하지 않는다 */ return G.length
                      ? '\n   ✦ 받는 쪽  ' + G.join(' · ')
                      : '';
                  })()
                );
              })()}${perTxt(r) ? '\n' + perTxt(r) : ''}`,
              {
                clearHit: true,
                hit: (() => {
                  const h = JSON.parse(JSON.stringify(lh));
                  delete h.re;
                  const ck = g('h_crit');
                  return {
                    lh: h,
                    o: {
                      eff: g('h_eff').value,
                      mod: g('h_mod').value,
                      berry: g('h_berry').checked,
                      endure: g('h_endure').checked,
                      forced: g('h_forced').value,
                      ...(ck ? { crit: ck.checked } : {})
                    }
                  };
                })(),
                floor: fl,
                dsg: (r.per || []).some(x => x.held === 'disguise')
              }
            );
            try {
              if (lh.fromId) await hp1Kill(lh.fromId, mid);
            } catch (e) {
              console.warn('hp1', e);
            }
            if (berryUse) await itemConsume(mid, false, berryUse);
            if (sashUse && sashX.name !== berryUse) await itemConsume(mid, false, sashX.name);
            /* 11-25 망령 「피닉스 ① 부활초는 왜 손으로?」: 구문 「완화 ×1 견딤 소지품:X」 로 버텼을 때 — 그 칸 글에 「「소지품 : X」를 소모」가 있으면 그 소지품을 쓰고, 【N/시】 를 하나 깎고, 「다음 턴 행동 불능」이면 「반동 : 행동불능」(게으름처럼) */
            if (saved && !(sashX && sashX.sure) && FX() && FX().liveMods) {
              try {
                const m1 = ctx().b.mons[mid];
                for (const e of FX()
                  .liveMods(m1)
                  .filter(x => x && x.kind === 'guard' && x.ed)) {
                  const nm = String(e.name || '')
                    .replace(/[『』]/g, '')
                    .trim();
                  const eff = String(slotEff(m1, 'pot', nm) || '');
                  if (!eff) continue;
                  const im = eff.match(/「\s*소지품\s*:\s*([^」]+?)\s*」\s*(?:을|를)\s*소모/);
                  if (im && HAS(ctx().b.mons[mid], im[1].trim())) await itemConsume(mid, false, im[1].trim());
                  const um = eff.match(/【\s*(\d+)\s*\/\s*시\s*】/);
                  if (um) {
                    const u = ((ctx().b.mons[mid] || {}).potUses || {})[nm];
                    await A().set(['battle', 'mons', mid, 'potUses', nm], Math.max(0, (u == null ? +um[1] : +u) - 1));
                  }
                  if (/다음\s*턴\s*행동\s*불능/.test(eff)) {
                    await A().set(['battle', 'mons', mid, 'states', 'Recharge'], 2);
                  }
                  A().sysLog(
                    `【포텐셜】 ${m1.name} 『${nm}』 — ${im ? '「' + im[1].trim() + '」을(를) 소모해 ' : ''}기술 대미지로 빈사가 되지 않았다${/다음\s*턴\s*행동\s*불능/.test(eff) ? ' · 다음 턴 행동 불능' : ''}`,
                    'battle',
                    { mid }
                  );
                  break;
                }
              } catch (er) {
                console.warn('견딤 소모', er);
              }
            }
            const nHit = r.per && r.per.length ? r.landed : 1;
            if (OI() && r.final > 0) await itemHitReact(mid, lh, r.final, nHit);
            if (rxOn && r.final > 0)
              try {
                await dscaleReact(mid, Object.assign({}, lh), r);
              } catch (e) {
                console.warn('드래곤스케일', e);
              }
            if (rxOn && r.final > 0) await abilityHitReact(mid, Object.assign({}, lh, hc === lh ? {} : { perCrit: null, crit: hc.crit }), r);
            if (rxOn && r.final > 0) await sureHitFire(mid, lh);
            try {
              if (r.final > 0) await stHitReact(mid, lh, r);
            } catch (e) {
              console.warn('stHitReact', e);
            }
            return ret;
          }
          /* 10-28 망령: 「피해 다시 받기」 — 그때의 판정과 넣은 배율(상성 · 대미지 보정 · 반감열매 · 버티기 · 고정 · 급소)을 다시 불러와 고쳐서 받는다 */
          if (k === 'rehit') {
            const L = m.lastTaken;
            if (!L || !L.hit) return;
            A().closeModal();
            await A().set(['battle', 'mons', mid, 'lastHit'], Object.assign({}, L.hit.lh, { re: L.hit.o, at: Date.now() }));
            return openHp(mid, 'dmg');
          }
          if (k === 'again' || k === 'againh') {
            const L = m.lastTaken;
            if (!L) return;
            const v = k === 'againh' ? Math.max(1, Math.floor(L.v / 2)) : L.v;
            return apply(-v, `최근 피해 다시${k === 'againh' ? ' (½)' : ''} — ${L.why}`, { floor: fl });
          }
          if (k === 'discard') {
            A().closeModal();
            await A().set(['battle', 'mons', mid, 'lastHit'], null);
            return A().sysLog(`${m.name} 받은 피해 판정을 버렸다`, 'battle');
          }
          if (k === 'frac') return apply(-parseAmt(v, m.hp.max), `비율 피해 ${v}`, { floor: fl });
          if (k === 'custom') {
            const a = parseAmt(g('h_cv').value, m.hp.max);
            if (!a) return A().toast('숫자나 분수를 넣어 줘');
            return apply(-a, `고정 피해 ${g('h_cv').value}`, { floor: fl });
          }
          if (k === 'recoil') {
            if (FX() && FX().noind(m, 'recoil')) return A().toast('반동 비례 대미지를 받지 않는다');
            const LD = ldPick(m, md);
            const a = parseAmt(v, LD.v);
            return apply(-a, `반동 ${v} (입힌 ${LD.v}${LD.n ? ' · ' + LD.n : ''})`);
          }
          if (k === 'confuse') {
            if (!F()) return;
            const v = F().confusionHit(m);
            return apply(-v, '혼란 자해 (위력 40 노말 물리)');
          }
          if (k === 'strug') return apply(-Math.max(1, Math.floor(m.hp.max / 4)), '발버둥 반동 (최대 HP 1/4 · 무시 불가)');
          if (k === 'cur') return apply(-Math.max(1, parseAmt(v, m.hp.cur)), `현재 HP 비례 ${v}`);
          if (k === 'typed') {
            const ty = g('h_tt').value;
            const mul = B().effectiveness([ty], m, {}).value;
            if (mul <= 0) {
              return A().toast(`${S().typeKo(ty)} 타입은 효과가 없다`);
            }
            const base = parseAmt(g('h_tv').value, m.hp.max);
            return apply(-Math.max(1, Math.floor(base * mul)), `타입 비례 피해 ${S().typeKo(ty)} ${g('h_tv').value} ×${mul}`);
          }
          if (k === 'heal') return apply(parseAmt(v, m.hp.max), `회복 ${v}`);
          if (k === 'healc') {
            const a = parseAmt(g('h_cv').value, m.hp.max);
            if (!a) return;
            return apply(a, `회복 ${g('h_cv').value}`);
          }
          if (k === 'full') return apply(m.hp.max - m.hp.cur, '전부 회복');
          if (k === 'drain') {
            const LD = ldPick(m, md);
            return apply(parseAmt(v, LD.v), `드레인 ${v} (입힌 ${LD.v}${LD.n ? ' · ' + LD.n : ''})`);
          }
          if (k === 'one') return apply(-(m.hp.cur - 1), 'HP 1');
          if (k === 'faint') return apply(-m.hp.cur, '빈사 처리');
          if (k === 'undo') {
            const m0 = snap(ctx().b.mons[mid]),
              x = snap(m0);
            const l = x.hp.latest;
            if (l == null) return;
            x.hp.latest = x.hp.cur;
            x.hp.cur = l;
            if (x.hp.cur > 0 && !x.entry && m.hp.cur <= 0) {
            }
            A().closeModal();
            await saveMon(m0, mid, x);
            return A().sysLog(`${x.name} HP 되돌리기 → ${x.hp.cur}/${x.hp.max}`, 'battle');
          }
        })
    );
  }
