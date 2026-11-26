  /* ── 조각 11_orders_fxlink.js — 포텐셜 설정 · 효과 엔진 연결 ── */
  /* ---------- 포텐셜 설정 (지령·명령 + 고유·전용 포텐셜 남은 횟수) ---------- */
  function spCntHtml(tid) {
    const b = ctx().b;
    const t = b.trainers[tid];
    const U = uniqList(t);
    const mons = Object.values(b.mons || {}).filter(m => m.tid === tid);
    const cell = (x, attrs, sub) =>
      `<div class="oc2 ${x.max != null && (x.mmax != null && x.ml != null ? x.ml : x.left) <= 0 ? 'zero' : ''}"><div class="nm">『${esc(x.p.name)}』<small>${esc(sub)}</small></div>${x.max != null ? `<span class="step"><button type="button" ${attrs} data-d="-1">−</button><b>${x.mmax != null && x.ml != null ? x.ml : x.left}<small class="dim">/${x.max}${x.per && x.mmax != null && x.left != null && x.left <= 0 && x.ml > 0 ? ' · 이번 턴 씀' : ''}${x.per && x.mmax == null ? (x.per === 'turn' ? ' · 이번 턴' : ' · 탈진') : ''}</small></b><button type="button" ${attrs} data-d="1">+</button></span>` : '<span class="small dim">횟수 없음</span>'}</div>`;
    const E = mons.flatMap(m =>
      specialPots(m)
        .filter(x => !x.p.unique)
        .map(x => cell(x, `data-spc="ex" data-mid="${m.id}" data-pn="${esc(x.p.name)}"`, m.name))
    );
    return `<div class="ogrp"><div class="ogh"><span class="gk uq">UNIQUE</span><b>고유 포텐셜</b><span class="small dim">트레이너</span></div><div class="ogrid">${U.map(x => cell(x, `data-spc="uq" data-pn="${esc(x.p.name)}"`, '고유')).join('') || '<div class="small dim">고유 포텐셜이 없다.</div>'}</div></div>
   <div class="ogrp"><div class="ogh"><span class="gk ex">EXCLUSIVE</span><b>전용 포텐셜</b><span class="small dim">포켓몬마다</span></div><div class="ogrid">${E.join('') || '<div class="small dim">전용 포텐셜이 없다.</div>'}</div></div>`;
  }
  function openOrders(tid) {
    const c = ctx();
    if (!c.mgr) return;
    const t = c.b.trainers[tid];
    if (!t) return;
    const md = A()
      .openModal(`<div class="mhead"><h2>${esc(t.name)} 포텐셜 설정</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div id="opanel">${OO().panel(t, true)}</div><div id="spcnt">${spCntHtml(tid)}</div><div class="small dim" style="margin-top:6px">바꾸면 바로 저장된다 (배틀 쪽 트레이너·포켓몬만 — 시트는 그대로). 고유·전용은 【N/시】가 적힌 것만 횟수가 있다.</div>
   <div class="row" style="margin-top:12px"><button class="btn xs ghost danger" id="ounload" title="이 트레이너와 포켓몬을 배틀에서 뺀다">배틀에서 빼기</button><span class="sp"></span></div>`);
    $('#ounload', md).onclick = () => {
      A().closeModal();
      A().unloadTrainer(tid);
    };
    const rebind = () =>
      OO().bind(
        $('#opanel', md),
        () => ctx().b.trainers[tid],
        async nt => {
          await A().setDiff(['battle', 'trainers', tid], ctx().b.trainers[tid], nt, 2);
          $('#opanel', md).innerHTML = OO().panel(nt, true);
          rebind();
        }
      );
    rebind();
    const spBind = () =>
      $('#spcnt', md)
        .querySelectorAll('[data-spc]')
        .forEach(
          bt =>
            (bt.onclick = async () => {
              const b = ctx().b;
              const d = +bt.dataset.d,
                n = bt.dataset.pn;
              const adj = async (x, uses, upath, tpath) => {
                if (!x || x.max == null) return;
                if (x.mmax != null) {
                  const had = uses[n] == null ? x.mmax : +uses[n];
                  const uu = Object.assign({}, uses);
                  uu[n] = Math.max(0, Math.min(x.mmax, had + d));
                  await A().set(upath, uu);
                } else if (x.per) await A().set([...tpath, n], d < 0 ? +b.turn || 0 : null);
              }; /* 턴 제한만 있으면: − 는 「이번 턴에 썼다」, ＋ 는 그 표시를 지운다 */
              if (bt.dataset.spc === 'uq') {
                const t2 = b.trainers[tid];
                await adj(
                  uniqList(t2).find(q => q.p.name === n),
                  t2.uUses || {},
                  ['battle', 'trainers', tid, 'uUses'],
                  ['battle', 'trainers', tid, 'uTurn']
                );
              } else {
                const m = b.mons[bt.dataset.mid];
                if (!m) return;
                await adj(
                  specialPots(m).find(q => q.p.name === n),
                  m.potUses || {},
                  ['battle', 'mons', m.id, 'potUses'],
                  ['battle', 'mons', m.id, 'potTurn']
                );
              }
              $('#spcnt', md).innerHTML = spCntHtml(tid);
              spBind();
            })
        );
    spBind();
  }
  const F = () => window.OM_FIELD;
  const CUT = () => window.OM_CUTIN;
  const FX = () => window.OM_FX;
  /* 매직룸 동안 소지품은 없는 셈 */
  const IT = m => (!m ? '' : F() && F().itemOf ? F().itemOf(m) : m.item || '');
  /* 11-08 23:12 망령 「금제 · 서투름은 지닌 효과도 전부 꺼」: 매직룸 · 금제 · 서투름이면 그 포켓몬의 소지품은 없는 셈 (OM_FIELD.itemOff) */
  const IOFF = m => !!(m && F() && F().itemOff && F().itemOff(m));
  /* ===== 11-08 망령 「일단 다 해」 (51-2): 소지품 · 상태 변화 자동화 도우미 ===== */
  const UMB = m => !!m && HAS(m, '만능우산'); /* ⑫ 만능우산: 지닌 쪽은 날씨의 효과를 받지 않는다 */
  const SEMI0 = ['VanishToDark', 'VanishToHole', 'Fly', 'VanishToWater', 'VanishToFire', 'VanishToMeteor', 'VanishToSun'];
  const semiOf = m => {
    const st = (m && m.states) || {};
    const g = (((DB().states || {}).groups || []).find(x => x.l === '반무적') || {}).s || SEMI0;
    return g.find(k => st[k]) || '';
  }; /* ⑯ 반무적 (어둠 안 · 하늘 위 …) */
  const stKoU = k => (((DB().states || {}).st || {})[k] || {}).ko || k;
  const noGuard = m => /^\s*『?노가드』?\s*$/.test(String((m && m.ability) || ''));
  /* ⑤ 포커스렌즈: 이번 턴 행동 순서에서 대상이 이미 차례를 마쳤나 */
  function actedB4(b, def) {
    const ph = +b.phase || 0;
    if (!(ph >= 2 && ph < 5) || !def) return false;
    const ord = b.order || [];
    const ai = +b.orderIdx || 0;
    const di = ord.findIndex(o => o && o.mid === def.id);
    return di >= 0 && di < ai;
  }
  /* ㉔ 지시 경고: 앙코르 · 사슬묶기 · 트집 · 침묵(소리기) · 원념 = 막음(GM 은 판정 가능) · 분진(불꽃기) = 알림만 */
  const mvTys = mv =>
    [
      mv && mv.typeEn,
      ...String((mv && mv.type) || '')
        .split(/[()/,]/)
        .map(x => x.trim())
        .filter(Boolean)
        .map(x => S().typeEn(x))
    ].filter(Boolean);
  function mvBan(m, mv) {
    if (!m || !mv || mv.virt || mv.ext) return '';
    const st = m.states || {};
    const nm = nmMv(mv.name);
    const lm = m.lastMove && nmMv(m.lastMove.name);
    if (st.Encore && lm && nm !== lm) return `「앙코르」 — 『${lm}』만 내보낼 수 있다`;
    if (st.Disable && lm && nm === lm) return `「사슬묶기」 — 『${lm}』는 내보낼 수 없다`;
    if (st.Torrment && lm && nm === lm) return `「트집」 — 『${lm}』를 연속으로 내보낼 수 없다`;
    if (st.Silence && /소리/.test(String(mv.tag || ''))) return '「침묵」 — 「소리」 기술은 내보낼 수 없다';
    if (st.HealBlock) {
      const au = moveAuto(mv);
      if (au && au.drain) return '「회복봉인」 — 「드레인」 기술은 내보낼 수 없다';
    }
    const gm = m.grudgeMove && nmMv(m.grudgeMove);
    if (st.Grudge && gm && nm === gm) return `「원념」 — 『${gm}』는 내보낼 수 없다`;
    if (m.lastMove) {
      const au = moveAuto(mv);
      if (au && au.firstOnly) return '나온 뒤 첫 기술이 아니라 실패한다';
    }
    /* 11-15 망령 「오토나시 승률이 왜 다시 30%」: 어린애속이기 · 만나자마자 류를 첫 턴 뒤에도 고르던 것 */ return '';
  }
  function mvSoft(m, mv) {
    if (!m || !mv || mv.virt) return '';
    const st = m.states || {};
    if (st.Powder && mvTys(mv).includes('Fire')) return '「분진」 — 「불꽃」 기술은 실패하고 1/4 비례 대미지를 입는다 (손으로)';
    return '';
  }
  /* 11-05 망령: 소지품 2 · 3번 칸까지 본다 (매직룸이면 없음) */
  const HAS = (m, n) => !!m && (OI() && OI().has ? OI().has(m, n) : IT(m) === n);
  /* 11-06 망령 「속임수주사위 자동화」: 소지품 · 특성 · 포텐셜 글 「연속으로 공격하는 기술의 최소 명중 횟수를 「4」로」 → 2~5회 같은 범위 연속기의 최소 횟수 (최대를 넘지 않는다) */
  function minHitOf(m) {
    if (!m) return null;
    const I = DB().items || {};
    const L = [
      ...(IOFF(m) ? [] : [[m.item, (I[m.item] || {}).eff], ...(m.items2 || []).map(x => x && [x.item, (I[x.item] || {}).eff]).filter(Boolean)]),
      [m.ability, m.abilityEff],
      ...potSrc(m).map(p => p && [p.name, p.eff])
    ];
    let best = null;
    for (const [n, e] of L) {
      if (!n) continue;
      const mm = String(e || '').match(/최소\s*명중\s*횟수를?\s*「?\s*(\d+)\s*」?\s*(?:회)?\s*로/);
      if (mm && (!best || +mm[1] > best.n)) best = { n: +mm[1], name: n };
    }
    return best;
  }
  const tysOf = m => (m.teraActive && m.teraEn && m.teraEn !== '-' ? [m.teraEn] : (m.types || []).filter(t => t && t !== '-'));
  const grd = m => (F() && F().grounded ? F().grounded(m) : !tysOf(m).includes('Flying'));
  /* 11-08 제보 「눈일 때 얼음 방어 상승 자동화 안 됨」: 날씨 방어 배율을 한 곳에서 — 굴리기와 굴리기 전 예상 대미지가 같이 쓴다 (전엔 예상 대미지에 빠져 있었다). 극한 얼음 방어 ×2 · 눈/싸라기눈 얼음 방어 ×1.5 · 모래바람 바위 특방 ×1.5, 날씨부정이면 없음 */
  const wxDefMul = (b, def, dS) => {
    const wt = wxNow(b),
      ty = tysOf(def);
    const v =
      wt === '극한' && ty.includes('Ice') && dS === 'defense'
        ? 2
        : ['눈', '싸라기눈'].includes(wt) && ty.includes('Ice') && dS === 'defense'
          ? 1.5
          : wt === '모래바람' && ty.includes('Rock') && dS === 'specialdefense'
            ? 1.5
            : 1;
    return { v, wt };
  };
  /* ---------- 효과 엔진 연결: 포텐셜·특성·소지품의 자동화를 UI(대상 고르기·확인·선택)와 함께 돌린다 ---------- */
  /* 10-24 제보 (킬링 에이스): 진행자 화면에서 상대 포켓몬의 효과를 돌릴 때, 고르기 · 대상 · 조건 확인 창이 진행자에게 떴다.
    그 포켓몬 주인(자리 플레이어 · 없으면 GM)에게 battle.asks[id] 로 물어보고 답(ans)을 기다린다. 2분 안에 답이 없으면 여기서 고른다 */
  const ASKED = {};
  function askTo(mon) {
    const c = ctx();
    if (!mon || canEdit(c, mon)) return '';
    const seats = c.ST.state.seats || {};
    const tid = mon.tid;
    const so = seats[tid] ? tid : baseSeat(c, tid);
    if (tid && so && (A().online(so) || coOf(c, tid).some(s => A().online(s)))) return 'seat:' + tid;
    if (!c.gm) return 'gm';
    return '';
  }
  async function remoteAsk(mon, type, data, local, to0) {
    const to = to0 || askTo(mon);
    if (!to) return local();
    const id = 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await A().set(['battle', 'asks', id], Object.assign({ to, type, mid: mon.id, at: Date.now() }, data));
    A().toast(`${mon.name} 쪽에 고르기를 맡겼다 — 답을 기다리는 중`);
    const t0 = Date.now();
    while (Date.now() - t0 < 120000) {
      await new Promise(r => setTimeout(r, 400));
      const q = (ctx().b.asks || {})[id];
      if (q && q.ans !== undefined) {
        await A().set(['battle', 'asks', id], null);
        return q.ans;
      }
      if (!q) break;
    }
    await A().set(['battle', 'asks', id], null);
    A().toast('답이 없어 여기서 고른다');
    return local();
  }
  /* 내게 온 물음에 답한다 (watch 에서) */
  async function answerAsks() {
    const c = ctx();
    const Q = c.b.asks || {};
    for (const id in Q) {
      const q = Q[id];
      if (!q || q.ans !== undefined || ASKED[id]) continue;
      const mine = q.to === 'gm' ? c.gm : String(q.to).startsWith('seat:') && lead(c, String(q.to).slice(5));
      if (!mine) continue;
      ASKED[id] = 1;
      const m = (c.b.mons || {})[q.mid] || { name: '?' };
      const U = localUi(c.b, m, q.name || '');
      let ans;
      try {
        if (q.type === 'choose') ans = await U.choose(q.labels || [], !!q.multi);
        else if (q.type === 'pick') {
          const list = (q.ids || []).map(i => (ctx().b.mons || {})[i]).filter(Boolean);
          const r = await U.pick(list, q.label || '대상');
          ans = r ? r.id : '';
        } else if (q.type === 'confirm') ans = await U.confirm(q.q || '');
      } catch (e) {
        ans = q.type === 'choose' ? [] : q.type === 'pick' ? '' : false;
      }
      if ((ctx().b.asks || {})[id]) await A().set(['battle', 'asks', id, 'ans'], ans == null ? (q.type === 'choose' ? [] : '') : ans);
    }
  }
  function uiCtx(b, self, name, area) {
    const L = localUi(b, self, name, area);
    const mon = self;
    return Object.assign({}, L, {
      rolesOf: m => rolesOf(m) /* 11-05 동조: fx 의 「동조아군 · 동조상대」가 역할(상위 역할 포함)을 같은 기준으로 */,
      pick: (list, label) =>
        remoteAsk(mon, 'pick', { name, label, ids: list.map(m => m.id) }, () => L.pick(list, label)).then(r =>
          typeof r === 'string' ? (r ? list.find(m => m.id === r) || null : null) : r
        ),
      confirm: q => remoteAsk(mon, 'confirm', { name, q }, () => L.confirm(q)).then(v => !!v),
      choose: (labels, multi) =>
        remoteAsk(mon, 'choose', { name, labels, multi: !!multi }, () => L.choose(labels, multi)).then(v => (Array.isArray(v) ? v.map(Number) : [])),
      freeSwitch: (m, nm) => {
        setTimeout(() => freeSwitchUI(m.id, nm).catch(e => console.warn(e)), 600);
        return `${m.name} 「${nm}」 — 임의 교대 창을 연다`;
      },
      spend: (what, n, me) =>
        spendPick(me || mon, name, what, n, labels =>
          remoteAsk(mon, 'choose', { name, labels, multi: false }, () => L.choose(labels, false)).then(v => (Array.isArray(v) ? v.map(Number) : []))
        ) /* 11-09 「소모 4식 · 소모 지령」 */,
      forceSwitch: (m, nm) => {
        setTimeout(() => forceSwitchFx(m.id, nm).catch(e => console.warn(e)), 600);
        return `${m.name} 「${nm}」 — 강제 교대`;
      },
      /* 11-09 감우 54-F: 에리어이동 · 폼체인지 · 이계(필드 전개) 구문 */
      areaMove: (m, nm) => {
        setTimeout(() => areaSwap(m.id).catch(e => console.warn(e)), 600);
        return `${m.name} 「${nm}」 — 에리어 이동 (자리를 고른다)`;
      },
      formTo: (m, fname, nm) => {
        const fs = formsOf(m);
        const n = x => String(x || '').replace(/\s/g, '');
        if (!fname || /^(원래|복귀|해제|원래대로)$/.test(n(fname))) {
          if (!m.form0) return `${m.name} 「${nm}」 — 이미 원래 모습이다`;
          setTimeout(() => doForm(m.id, -1, nm).catch(e => console.warn(e)), 600);
          return `${m.name} 「${nm}」 — 원래 모습으로`;
        }
        let k = fname ? fs.findIndex(f => f && (n(f.name) === n(fname) || n(f.name).includes(n(fname)) || n(f.label).includes(n(fname)))) : -1;
        if (fname && k < 0) return `${m.name} 「${nm}」 — 「${fname}」 폼을 찾지 못했다 (폼 체인지 창에서)`;
        if (!fname && fs.length === 1) k = 0;
        if (k < 0) return `${m.name} 「${nm}」 — 폼 체인지 창에서 고른다`;
        setTimeout(() => doForm(m.id, k, nm).catch(e => console.warn(e)), 600);
        return `${m.name} 「${nm}」 — 「${(fs[k] || {}).name || fname}」(으)로 폼체인지`;
      },
      stageOpen: async (me, sname, turns, nm) => {
        const SU =
          window.OM_STAGE_UI; /* 11-15 망령 「호타루 이계 전개 제대로 해?」: 시트의 필드 전개 칸에 그 이계가 없으면 이름만 있는 《이계/이름》을 편다 — 「《이계/X》가 전개되어 있을 때」 조건이 서게 */
        const bare = () => ({
          type: 2,
          name: String(sname).replace(/^(이계|필드|스타디움)\//, ''),
          loc: '',
          img: '',
          eff: `「${nm}」 로 편 이계 (시트 필드 칸에 없어 이름만)`,
          color: '',
          owner: me.name,
          count: turns > 0 ? turns : 1000,
          src: 'fx:' + me.id,
          tid: me.tid,
          ownerMid: me.id,
          at: Date.now()
        });
        if (!SU || !SU.deployByName) {
          b.field = b.field || {};
          b.field.stage = bare();
          return `${me.name} 「${nm}」 — 《이계/${b.field.stage.name}》 전개${turns ? ' ' + turns + '턴' : ''}`;
        }
        setTimeout(async () => {
          /* 11-23 저녁 257 망령 「타크트 H는 본인의 파티」: 전개하는 포텐셜 · 고유 글에 「자신의 PT를 H 지정」이 있으면 전개한 트레이너를 H 로 (필드 칸의 H 종류가 없음이면 3 = 지정만) */ let ho =
            null;
          try {
            const tr = (ctx().b.trainers || {})[me.tid];
            const src = [].concat((tr && tr.unique) || [], me.pots || [], me.excl ? [me.excl] : [], me.exclX || []);
            const u = src.find(
              x =>
                x &&
                String(x.name || '')
                  .replace(/[『』]/g, '')
                  .trim() ===
                  String(nm || '')
                    .replace(/[『』]/g, '')
                    .trim()
            );
            if (u && /자신의\s*PT\s*(?:를|을)\s*H\s*지정/.test(String(u.eff || ''))) ho = { hTid: me.tid, hAuto: 1 };
          } catch (e) {}
          const r = await SU.deployByName(me.id, me.tid, sname, turns, ho).catch(e => {
            console.warn(e);
            return '';
          });
          if (!r) {
            const st = bare();
            if (await A().set(['battle', 'field', 'stage'], st))
              A().sysLog(
                `◆ ${me.name}의 《이계/${st.name}》 전개${turns ? ' · ' + turns + '턴' : ''} — 필드 전개 칸에 그 이름이 없어 이름만 편다 (그림 · 효과 글은 시트 필드 칸에 넣으면 나온다)`,
                'battle'
              );
          }
        }, 600);
        return `${me.name} 「${nm}」 — 《${sname}》 전개${turns ? ' ' + turns + '턴' : ''}`;
      } /* 11-08 「강제교대」 구문 */,
      useMove: (m, mv, nm, o) => {
        setTimeout(
          () =>
            openAttack(
              m.id,
              Object.assign(
                { mvName: mv, by: nm, baseTop: (o || {}).top || [] },
                (o || {}).targets && o.targets.length ? { targets: o.targets, preT: 1 } : {}
              )
            ),
          600
        );
      }
    });
  } /* 11-09 망령 「창파나이트 추가 행동도 대상 지정」: 지시 창에서 고른 대상(o.targets)으로 공격 창을 연다 */
  /* 11-08 망령 「강제교대」 구문: 고른 대상(맞은 대상)을 강제 교대 — 기술의 강제 교대와 같은 길 (흡반 · 뿌리박기 · 다이맥스 · 교대무시는 switchGuard 가 막는다, 저장 뒤에 돈다) */
  async function forceSwitchFx(mid, nm) {
    const c = ctx();
    const d = c.b.mons[mid];
    if (!d || !d.entry || d.hp.cur <= 0) return;
    if (d.lastHit && d.lastHit.move === nm && !d.lastHit.fsw) {
      await A().set(['battle', 'mons', mid, 'lastHit', 'fsw'], { by: d.lastHit.from || '', move: nm });
      A().sysLog(`${d.name} — 「${nm}」 대미지를 적용한 뒤 강제 교대`, 'battle');
      return;
    }
    /* 11-18 대미지 적용 전 강제 교대 막기 */ const g = await switchGuard(d);
    if (g) {
      A().sysLog(`${d.name} 강제 교대를 받지 않는다 (${g})`, 'battle');
      return;
    }
    if (canEdit(c, d) || c.mgr) await forcedSwitch(d.id, { sys: true });
    else A().sysLog(`${d.name} 「${nm}」 강제 교대 — 상대나 GM 이 「퇴장 → 강제 교대」로 처리`, 'battle');
  }
  /* 11-03 「임의교대」 구문: 벤치에서 골라 같은 자리로 (그 트레이너 · GM 만) */
  /* 11-26 05:55 망령 「(이즈나 속별) 【1/시】【자동】/「대타출동」이 파괴되었을 때 아군과 임의 교대할 수 있다 · 대타출동 자동화는 되어 있나?」:
    대역인형이 부서지면(받은 피해 창) 그 포켓몬의 포텐셜 중 이 글을 찾아 — 【N/시】 남았고 막힘 없으면 횟수를 깎고 임의 교대 창(freeSwitchUI). 【자동】 이 없으면 GM 귓속말로 알리기만 */
  const RX_SUBBRK = /「\s*대타출동\s*」\s*(?:이|가)\s*(?:파괴|부서)(?:되었을|졌을)\s*때[^/\n]{0,10}?(?:아군과\s*)?임의\s*교대/;
  async function subBrokeAuto(mid) {
    const b = ctx().b;
    const m = (b.mons || {})[mid];
    if (!m || !m.entry || !(m.hp && m.hp.cur > 0)) return;
    for (const p of potSrc(m)) {
      const e = String((p && p.eff) || '');
      if (!RX_SUBBRK.test(e)) continue;
      try {
        if (potOffWhy(m, p.name) || misagBlock(b, m, p.name)) continue;
      } catch (_) {}
      const L = limOf(p, m.potUses || {}, m.potTurn || {});
      const nm = String(p.name || '').replace(/[『』]/g, '');
      if (L.left !== null && L.left <= 0) {
        A().sysLog(
          `【포텐셜】 ${m.name} 『${nm}』 — 대타출동이 부서졌지만 ${L.ml === 0 ? '남은 횟수가 없다' : '이번 턴엔 더 쓸 수 없다'}`,
          'battle',
          { mid, gmPriv: 1 }
        );
        continue;
      }
      if (!/【\s*자동\s*】/.test(e)) {
        A().sysLog(`【포텐셜】 ${m.name} 『${nm}』 — 대타출동이 부서졌다 · 임의 교대할 수 있다 (【자동】이 없어 손으로 「발동」)`, 'battle', {
          mid,
          gmPriv: 1
        });
        continue;
      }
      if (L.mmax != null) {
        const cur = (m.potUses || {})[p.name];
        await A().set(['battle', 'mons', mid, 'potUses', p.name], Math.max(0, (cur == null ? L.mmax : +cur) - 1));
      }
      await potMark(mid, p.name);
      A().sysLog(
        `【포텐셜】 ${m.name} 『${nm}』 — 대타출동이 부서졌다 · 아군과 임의 교대할 수 있다${L.mmax != null ? ` 【${Math.max(0, (L.ml == null ? L.mmax : L.ml) - 1)}/${L.mmax}】` : ''}`,
        'battle',
        { mid, img: m.image || '' }
      );
      await freeSwitchUI(mid, nm);
      return;
    }
  }
  async function freeSwitchUI(mid, nm) {
    const c = ctx();
    const a = c.b.mons[mid];
    if (!a || !a.entry || a.hp.cur <= 0) return;
    if (!canEdit(c, a) && !c.mgr) {
      A().sysLog(`${a.name} 「${nm}」 임의 교대할 수 있다 — 그 트레이너가 「퇴장」에서`, 'battle');
      return;
    }
    const bench = Object.values(c.b.mons).filter(x => x.tid === a.tid && !x.entry && !x.pend && x.hp.cur > 0 && x.id !== mid);
    if (!bench.length) {
      A().sysLog(`${a.name} 교대할 포켓몬이 벤치에 없다`, 'battle');
      return;
    }
    /* 11-04 19:15 망령 「(질투닌의 선회 — 카자마 레비 임의 교대할까?) 이게 배틀에 안 나오는 나한테 왜 떠」: 진행자(GM) 화면이 자동화를 돌리면 임의 교대 물음이 GM 에게 떴다.
     그 트레이너 자리에 누가 접속해 있으면(내가 그 자리가 아니면) 그 자리로 물어본다 — 2분 안에 답이 없으면 교대하지 않는다 */
    const seats = c.ST.state.seats || {};
    const ownerOn =
      !ownT(c, a.tid) &&
      !!(seats[a.tid] || baseSeat(c, a.tid)) &&
      (A().online(seats[a.tid] ? a.tid : baseSeat(c, a.tid)) || coOf(c, a.tid).some(s => A().online(s)));
    if (ownerOn) {
      const to = 'seat:' + a.tid;
      const yes = await remoteAsk(a, 'confirm', { name: nm, q: `「${nm}」 — ${a.name} 임의 교대할까?` }, () => false, to);
      if (!yes) return;
      const r = await remoteAsk(a, 'pick', { name: nm, label: '교대해 들어올 포켓몬', ids: bench.map(m => m.id) }, () => '', to);
      const pk = typeof r === 'string' ? bench.find(m => m.id === r) || null : r;
      if (!pk) return;
      const area = a.entry;
      await exitMon(mid, { noAsk: true, sys: true, how: '임의 교대' });
      await enterMon(pk.id, area, { sys: true, how: '임의 교대' });
      return;
    }
    if (!(await askYes(`「${nm}」 — ${a.name} 임의 교대할까?`, '교대', '그대로'))) return;
    const pk = await uiCtx(c.b, a, nm).pick(bench, '교대해 들어올 포켓몬');
    if (!pk) return;
    const area = a.entry;
    await exitMon(mid, { noAsk: true, sys: true, how: '임의 교대' });
    await enterMon(pk.id, area, { sys: true, how: '임의 교대' });
  }
  function localUi(b, self, name, area) {
    return {
      b,
      self,
      name,
      area,
      viewer: ctx().gm ? '' : ctx().seat,
      pick: (list, label) =>
        new Promise(res => {
          const md = A().openModal(
            `<div class="mhead"><h2>${esc(name)} — ${esc(label)}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="pg">${list.map(m => `<div class="pc" data-pk="${m.id}"><div class="pic" style="${m.image ? `background-image:url('${cssu(m.image)}')` : ''}"></div><div><b>${esc(m.name)}</b><div class="small dim">${SIDE_KO[m.side]} ${String(m.entry).toUpperCase()} · HP ${m.hp.cur}/${m.hp.max}</div></div></div>`).join('')}</div>`
          );
          md.querySelectorAll('[data-pk]').forEach(
            el =>
              (el.onclick = () => {
                A().closeModal();
                res(list.find(m => m.id === el.dataset.pk));
              })
          );
          md.querySelector('[data-x]').addEventListener('click', () => res(null));
        }),
      confirm: q => askYes(`「${name}」\n${q}\n\n조건을 만족하는가?`, '만족한다', '아니다'),
      choose: (labels, multi) =>
        new Promise(res => {
          const md = A().openModal(
            `<div class="mhead"><h2>${esc(name)} — 발동할 효과</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="firelist">${labels.map((l, i) => `<label class="firerow"><input type="${multi ? 'checkbox' : 'radio'}" name="ch" value="${i}" ${i === 0 ? 'checked' : ''}> <span>${esc(l)}</span></label>`).join('')}</div><div class="row" style="margin-top:10px"><span class="sp"></span><button class="btn pri" id="chok">발동</button></div>`
          );
          $('#chok', md).onclick = () => {
            const v = [...md.querySelectorAll('[name=ch]:checked')].map(i => +i.value);
            A().closeModal();
            res(v);
          };
          md.querySelector('[data-x]').addEventListener('click', () => res([]));
        })
    };
  }
  /* 효과 하나를 돌려서 배틀에 적용한다. kind: pot|trait|item|order. 돌려줌: 적용했으면 true */
  /* 11-26: 【공유】는 11-10 에 만든 shareWhy · shareMark (potTurn._share = {t,u,ex})가 이미 맡는다 — 06:55 에 감우가 여기 겹쳐 넣은 막기(potTurn._share = 턴 숫자)는 그 칸을 덮어써 원래 것을 망가뜨려서 뺐다 */
  async function fireAuto(mid, kind, name, opt) {
    opt = opt || {};
    const m00 = (ctx().b.mons || {})[mid];
    /* 저절로 터지는 길(상태 계기 등)도 원래 【공유】 장부를 보게: 쏘기 전에 shareWhy, 성공하면 shareMark (이미 적혀 있으면 그대로) */
    const SHP =
      kind === 'pot' && !opt.force && !opt._amv && m00
        ? potSrc(m00).find(
            q =>
              q &&
              q.name ===
                String(name || '')
                  .replace(/[『』]/g, '')
                  .trim() &&
              /【\s*공유/.test(String(q.eff || ''))
          )
        : null;
    if (SHP) {
      const sw = shareWhy(SHP, m00.potTurn || {});
      if (sw) {
        A().sysLog(`【포텐셜】 ${m00.name} 『${SHP.name}』 — ${sw}`, 'battle', { mid: m00.id, img: m00.image || '' });
        return false;
      }
    }
    let XA = [];
    try {
      const au = opt.auto || (FX() && m00 ? FX().autoOf(m00, kind, name) : null);
      XA = ((au && au.ops) || []).filter(o => o && o.k === 'xact');
    } catch (e) {}
    const ok = await fireAuto0(mid, kind, name, opt);
    if (ok && SHP) {
      try {
        await shareMark(mid, SHP.name);
      } catch (e) {}
    }
    if (ok)
      for (const x of XA) {
        try {
          await addXact(mid, x, name);
        } catch (e) {
          console.warn('addXact', e);
        }
      }
    return ok;
  }
  /* 11-26 363 구문 「추가행동」: 이번 턴 행동 순서 맨 끝에 그 포켓몬의 추가 행동 — 순서가 이미 있으면 바로 붙이고, 아직이면(턴 개시 · 선행) battle.xq 에 적어 두었다가 행동 순서를 짤 때 붙인다 */
  /* ===== 추가 행동 (순서 맨 끝 · 순서값 -1000) — 한곳에 모은 지도 (11-26 366 정돈) =====
    차례 한 칸은 xactEnt() 하나로 만든다. 글 꼴(정규식)은 아래 XACT_* 묶음(「턴 종료」 절 앞)에만 둔다.
    붙는 길:  ① 선행 입력한 포텐셜 「가장 마지막에 「X」 추가 행동」      — computeOrder (XACT_POS_RE)
              ② 「N」배수 턴                                         — computeOrder (XACTN_RE)
              ③ (저|중|고)확률로 …                                   — computeOrder (XACT_CH_RE · 턴마다 굴림)
              ④ 고유 「N배수 턴 … 아군이 X 기술」                      — computeOrder (XACT_UQ_RE · 누가 할지 물음)
              ⑤ 구문 「추가행동」(계기 · 등장 · 손 발동)                — addXact (순서 전이면 battle.xq 에 적어 두었다가 computeOrder 가 붙임)
              ⑥ 턴 가장 마지막 단계에서 생긴 것(「~한 턴 가장 마지막에」) — addXact 가 late 표시 → xactPause 가 그 차례에 멈춤
    턴 마무리 후보에서 빼는 것: ②③④ 와 계기 · 【등장】이 앞에 있는 마디 (xactEv · XACT_ORD_RE) */
  function xactEnt(s, move, by, ex) {
    return Object.assign(
      {
        slot: s.slot,
        mid: s.mon.id,
        name: s.mon.name,
        side: s.mon.side,
        change: false,
        started: false,
        order: -1000,
        prio: 0,
        speed: 0,
        dice: 0,
        move: move || '',
        targets: [],
        pursuit: false,
        xact: by
      },
      ex || {}
    );
  }
  function xactMove(m, x) {
    if (x.mv) return x.mv;
    const ty = S().typeEn(x.ty);
    const L = MVS(m).filter(mv => mv && mvTysRaw(mv).includes(ty) && (!x.cat || String(mv.cat || '').replace(/기$/, '') === x.cat));
    return L.length ? L[0].name : '';
  }
  async function addXact(mid, x, by) {
    const b = ctx().b;
    const m = (b.mons || {})[mid];
    if (!m || !m.entry || !(m.hp && m.hp.cur > 0)) return;
    const T = +b.turn || 0;
    const mv = xactMove(m, x);
    const nm = String(by || '').replace(/[『』]/g, '');
    const sl = allEntered(b).find(s => s.mon && s.mon.id === mid);
    const ent = xactEnt({ slot: sl ? sl.slot : '', mon: m }, mv, nm);
    if (IN_LAST || (b.endq || {}).step === 'last')
      ent.late = 1; /* 턴 가장 마지막 단계에서 생긴 추가 행동 — 턴 종료로 넘어가기 전에 그 차례를 준다 (xactPause) */
    if ((+b.phase || 0) >= 2 && (b.order || []).length) {
      if ((b.order || []).some(o => o && o.xact === nm && o.mid === mid)) return;
      await A().set(['battle', 'order'], (b.order || []).concat([ent]));
    } else {
      const q = (b.xq || []).filter(e => e && +e.t === T && !(e.mid === mid && e.by === nm));
      q.push({ t: T, mid, mv, by: nm });
      await A().set(['battle', 'xq'], q);
    }
    A().sysLog(`【추가 행동】 ${m.name} 『${nm}』 — 가장 마지막에 「${mv || '기술'}」`, 'battle', { mid, img: m.image || '' });
  }
  /* 11-26 366 방 시험에서 잡음: 「자신의 공격으로 상대가 「HP : 1」이 되었을 때 … 「빈사」」(제레 『생사접의 권능』)가 공격 창 「적용」 직후에만 보아서, 대미지를 【전달】하고 받는 쪽이 「HP」 창에서 적용하는 보통 길에서는 한 번도 안 터졌다 → 받은 피해 창 「피해 적용」 뒤에도 같은 확인 (hp1Kill 하나로) */
  const HP1_RE = /자신의\s*공격으로\s*상대가\s*「\s*HP\s*:\s*1\s*」\s*(?:이|가)\s*되었을\s*때[^.]*「\s*빈사\s*」\s*상태로/;
  async function hp1Kill(aid, did) {
    const B1 = ctx().b;
    const a1 = (B1.mons || {})[aid],
      d1 = (B1.mons || {})[did];
    if (!a1 || !d1 || aid === did || !a1.entry || !d1.hp || +d1.hp.cur !== 1 || sameT(a1, d1, B1)) return false;
    const hp1 = potSrc(a1).find(q => q && !q.ph && !potOffWhy(a1, q.name) && HP1_RE.test(String(q.eff || '')));
    if (!hp1) return false;
    await A().set(['battle', 'mons', d1.id, 'hp', 'cur'], 0);
    A().sysLog(`【포텐셜】 ${a1.name} 『${hp1.name}』 — ${d1.name} 「HP : 1」 → 「빈사」`, 'battle', { mid: a1.id, img: a1.image || '' });
    return true;
  }
  async function fireAuto0(mid, kind, name, opt) {
    opt = opt || {};
    /* 11-09 망령 「일일이 확인 창을 누르면 처리가 늦어진다 — 동시 내밀기처럼 강제 발동 토글」: 트레이너의 「강제 발동」이 켜져 있으면 손으로 누른 발동(카드 · 포텐셜 발동 창 · 고유)은 처음부터 강제 — 저절로 터지는 효과 · 필드 · SP 는 그대로 */
    if (!opt.force && kind !== 'field' && (opt.manual || !opt.quiet)) {
      const m1 = (ctx().b.mons || {})[mid] || null;
      const ft = opt.ownTid || (m1 && m1.tid);
      if (ft && fxForceOn(ctx().b, ft)) opt = Object.assign({}, opt, { force: true, head: (opt.head ? opt.head + ' ' : '') + '(강제 발동)' });
    }
    if (opt.force) opt = Object.assign({}, opt, { noRoll: true });
    /* 11-09 망령 「혹시 모를 에러 · 몇몇 효과를 대비해 강제 발동」: opt.force = 조건 · 확인 · 확률을 건너뛰고 건다 */ const c = ctx();
    const b0 = c.b;
    const m0 = b0.mons[mid];
    if (!m0) return false;
    let auto = opt.auto || FX().autoOf(m0, kind, name); /* opt.auto: SP(서포터) 처럼 포켓몬 밖에 적힌 구문 */
    /* 11-15 망령 확정: 【탈진】 · 【소진】만 붙고 때가 없는 손 발동 강화(『불굴귀의 투창』)는 **그 턴만** — 기간이 안 적힌(turn 0) 배율 · 완화 · 회피 · 명중 줄을 이번 턴으로 */
    /* 11-15 망령 「만들 후보 만들고」 — 그때그때 정해지는 타입:
      ① 「이번 턴 「X」가 아군의 「타입2」와 같은 타입이 된다 · 없다면 실패」(아니스 4번 짱 『당신도 모르는 당신』) → 필드의 다른 아군 타입2 로 기술타입 (이번 턴)
      ② 「턴 종료 시까지 아군을 대상의 「타입 1」로 만든다」(아니스 고유 『찰나의 모작』) → 이 포켓몬(고른 아군)을 고른 상대의 타입1 로 (턴 종료까지) */
    {
      const tr = (b0.trainers || {})[m0.tid] || {};
      const pp =
        kind === 'pot' && !opt._amv
          ? potSrc(m0)
              .concat((tr.unique || []).map(u => ({ name: u.name, eff: u.eff })))
              .find(q => q && q.name === name)
          : null;
      const e = String((pp && pp.eff) || '');
      if (pp && /턴\s*개시\s*시\s*『\s*[^』]+\s*』\s*인\s*아군이\s*에리어를\s*이동한다/.test(e)) {
        /* 11-15 망령 「에리어 이동 해야지」: 「①【선행】【탈진】/턴 개시 시 『닌자』인 아군이 에리어를 이동한다. ② ①의 효과가 적용 된 아군을 턴 종료 시 까지 「방/특방」을 저하(0.75배)」(전은영 『이대도강 육참골단』) */
        const role = e.match(/턴\s*개시\s*시\s*『\s*([^』]+?)\s*』\s*인\s*아군이/)[1];
        const al = Object.values(b0.mons || {}).filter(
          x => x && x.entry && x.hp && x.hp.cur > 0 && sameT(x, m0, b0) && (rolesOf(x).includes(role) || potSrc(x).some(q => q && q.name === role))
        );
        if (!al.length) {
          A().sysLog(`【고유】 『${name}』 — 필드에 『${role}』인 아군이 없어 실패`, 'battle', { mid: m0.id });
          return false;
        }
        const mover = al.find(x => x.id === m0.id) || al[0];
        A().sysLog(`【고유】 『${name}』 — 『${role}』 ${al.map(x => x.name).join(' · ')} 에리어 이동`, 'battle', {
          mid: mover.id,
          img: mover.image || ''
        });
        await areaSwap(mover.id);
        const dm = e.match(/「\s*방\s*\/\s*특방\s*」\s*을\s*저하\s*\(\s*([\d.]+)\s*배\s*\)/);
        if (dm)
          for (const x of al) {
            const cx = (ctx().b.mons || {})[x.id];
            if (cx && cx.areaT === (+ctx().b.turn || 0))
              await fireAuto(x.id, 'pot', name, {
                _amv: 1,
                auto: { name, ops: [{ k: 'mult', tgt: 'self', stats: { defense: +dm[1], specialdefense: +dm[1] }, temp: true }] },
                quiet: true,
                noRoll: true,
                noEv: 1,
                head: `【고유】 『${name}』 ②`
              });
          }
        return true;
      }
    }
    if (kind === 'pot' && !opt.auto && (!auto || !auto.ops || !auto.ops.length || auto.manual)) {
      const tr = (b0.trainers || {})[m0.tid] || {};
      const src = potSrc(m0).concat((tr.unique || []).map(u => ({ name: u.name, eff: u.eff })));
      const pp = src.find(q => q && q.name === name);
      const e = String((pp && pp.eff) || '');
      const ma = e.match(/이번\s*턴\s*「([^」]+)」\s*(?:이|가)\s*아군의\s*「\s*타입\s*2\s*」\s*와\s*같은\s*타입이\s*된다/);
      if (ma) {
        const al = Object.values(b0.mons || {}).find(
          x => x && x.id !== m0.id && x.entry && x.hp && x.hp.cur > 0 && sameT(x, m0, b0) && (tysOf(x)[1] || '-') !== '-'
        );
        if (!al) {
          A().sysLog(`【포텐셜】 ${m0.name} 『${name}』 — 필드에 「타입2」가 있는 아군이 없어 실패`, 'battle', { mid: m0.id });
          return false;
        }
        auto = { name, src: 'dyn', ops: [{ k: 'sp', sp: 'mvtype', mv: ma[1].trim(), from: '', to: tysOf(al)[1], thisTurn: 1 }] };
      } else if (/아군을\s*대상의\s*「\s*타입\s*1\s*」\s*로\s*만든다/.test(e)) {
        const fs = Object.values(b0.mons || {}).filter(x => x && x.entry && x.hp && x.hp.cur > 0 && !sameT(x, m0, b0));
        if (!fs.length) return false;
        let f = null;
        try {
          f = await uiCtx(b0, m0, name).pick(fs, `『${name}』 — ${m0.name} 을(를) 누구의 「타입 1」로?`);
        } catch (err) {}
        if (!f) return false;
        const t1 = tysOf(f)[0];
        if (!t1 || t1 === '-') return false;
        auto = { name, src: 'dyn', ops: [{ k: 'type', tgt: 'self', mode: 'set', types: [t1], turns: 1 }] };
      }
    }
    if (kind === 'trait' && !opt._tf) await traitFired(mid, name);
    if (kind === 'pot' && auto && auto.ops) {
      const cz = csFromCond(auto.ops);
      if (cz) auto = Object.assign({}, auto, { ops: cz });
    }
    /* 11-15 망령 「진서현 헬레나 보구가 해석 조건 제대로 따르나」: ① 「상대 PT의 「N체」이상 데이터 해석했을 때에만 사용할 수 있다」 — 우리 편이 해석한 상대 수가 모자라면 막는다 ② 「데이터가 해석된 상대에게 … 강화」 — 구문에 「상대해석됨」이 없어도 해석된 상대에게만 · 【선행】이고 기간이 안 적혔으면 이번 턴만 */
    if (kind === 'pot' && auto && auto.ops && !opt.force) {
      const tr0 = (b0.trainers || {})[m0.tid] || {};
      const pp0 = potSrc(m0)
        .concat((tr0.unique || []).map(u => ({ name: u.name, eff: u.eff })))
        .find(q => q && q.name === name);
      const e0 = String((pp0 && pp0.eff) || '');
      const need = e0.match(/상대\s*PT\s*의\s*「\s*(\d+)\s*체\s*」\s*이상\s*데이터\s*해석했을\s*때에만/);
      if (need) {
        const D = (A().ST.state || {}).dex || {};
        const tm = TM(m0.tid, b0);
        const seen = new Set();
        for (const tid in D) {
          if (TM(tid, b0) !== tm) continue;
          for (const id of (D[tid] || {}).list || []) if ((b0.mons || {})[id] && !sameT((b0.mons || {})[id], m0, b0)) seen.add(id);
        }
        if (seen.size < +need[1]) {
          A().sysLog(`【포텐셜】 ${m0.name} 『${name}』 — 해석한 상대 ${seen.size}체 · ${need[1]}체 이상이어야 쓸 수 있다`, 'battle', { mid: m0.id });
          return false;
        }
      }
      if (/데이터가\s*해석된\s*상대에게/.test(e0)) {
        const pre = /【\s*선행\s*】/.test(e0) && !/턴\s*종료\s*시?까지|해제(될|할)?\s*때까지|\d+\s*턴\s*동안/.test(e0);
        auto = Object.assign({}, auto, {
          ops: auto.ops.map(o =>
            o && ['boost', 'guard', 'mult'].includes(o.k) ? Object.assign({}, o, { odx: 1 }, pre && !+o.turn ? { turn: 1 } : {}) : o
          )
        });
      }
    }
    if (kind === 'pot' && opt.manual && !opt.auto && auto && auto.ops) {
      const pp = potSrc(m0).find(q => q && q.name === name);
      const e = String((pp && pp.eff) || '');
      const hd = (e.match(/^((?:\s*【(?:[^【】]|【[^【】]*】)*】)+)\s*\/?/) || [''])[0];
      if (
        /【\s*(탈진|소진)\s*】/.test(hd) &&
        !/【\s*(사전|선행|자동|등장|퇴장|준비|함성|지원|동조|보급|방호|공세|수세|턴\s*종료)/.test(hd) &&
        !/턴\s*종료\s*시?까지|해제(될|할)?\s*때까지|\d+\s*턴\s*동안/.test(e)
      )
        auto = Object.assign({}, auto, {
          ops: auto.ops.map(o => (o && ['boost', 'guard', 'mult', 'eva', 'acc'].includes(o.k) && !+o.turn ? Object.assign({}, o, { turn: 1 }) : o))
        });
    }
    if (!auto || !auto.ops || !auto.ops.length || auto.manual) {
      if (!opt.quiet) A().toast(auto && auto.manual ? `「${name}」은(는) 자동화가 없어 손으로 처리한다` : `「${name}」 자동화 없음`);
      return false;
    }
    /* 11-07 망령 「이미 발동 중인 포텐셜이나 효과를 누르면 「이미 걸려 있다」 로그 말고 중첩 / 해제를 묻게」: 이 이름으로 건 효과가 필드에 남아 있으면 먼저 묻는다 (자동 발동 · quiet 는 묻지 않는다) */
    let STK2 = 0;
    if (!opt.quiet && !opt.restack && FX().chips && !auto.ops.some(o => o && o.k === 'choice')) {
      /* 11-07 망령 「하이 블로커 ②」: 줄을 고르는 효과(①②)는 묻지 않는다 — ① 이 등장 때 걸려 있어도 ② 를 고르러 누른 것 */ const nn = x =>
        String(x || '')
          .replace(/[『』]/g, '')
          .trim();
      const on = Object.values(b0.mons || {}).filter(
        x =>
          x &&
          x.entry &&
          FX()
            .chips(x)
            .some(ch => nn(ch.name) === nn(name))
      );
      if (on.length) {
        const pick = await new Promise(res => {
          const md = A().openModal(
            `<div class="mhead"><h2>『${esc(nn(name))}』 — 이미 걸려 있다</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="small" style="margin-bottom:10px">${on
              .map(
                x =>
                  esc(x.name) +
                  ': ' +
                  FX()
                    .chips(x)
                    .filter(ch => nn(ch.name) === nn(name))
                    .map(ch => esc(ch.t))
                    .join(' · ')
              )
              .join(
                '<br>'
              )}</div><div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn" data-ch="off">해제</button><button class="btn pri" data-ch="stack">중첩 (한 번 더 건다)</button><span class="sp"></span><button class="btn ghost" data-ch="">취소</button></div>`
          );
          md.addEventListener('click', e => {
            const bt = e.target.closest('[data-ch],[data-x]');
            if (!bt) return;
            const v = bt.dataset.ch || '';
            A().closeModal();
            res(v);
          });
        });
        if (!pick) return false;
        if (pick === 'off') {
          const nb0 = snap(b0),
            nb = snap(nb0);
          const gone = [];
          for (const x of on) {
            const t = nb.mons[x.id];
            if (!t) continue;
            let n = FX().removeByName(t, name);
            if (!n && nn(name) !== name) n = FX().removeByName(t, nn(name));
            if (!n) {
              const raw = FX()
                .chips(t)
                .find(ch => nn(ch.name) === nn(name));
              if (raw) n = FX().removeByName(t, raw.name);
            }
            if (n) gone.push(t.name);
          }
          if (!(await saveBattle(nb0, nb))) return false;
          const KN0 = { pot: '포텐셜', trait: '특성', item: '소지품', order: '지령' }[kind] || '효과';
          A().sysLog(`【${KN0}】 ${m0.name} 『${nn(name)}』 해제 — ${gone.join(', ') || '없음'}`, 'battle', { mid: m0.id, img: m0.image || '' });
          return false;
        }
        STK2 = 99;
      }
    }
    if (kind === 'pot' && !opt.force) {
      const off = potOffWhy(m0, name);
      if (off) {
        A().sysLog(
          /『특권』이 발동하지 않는다$|』 무효$/.test(off)
            ? `【포텐셜】 ${m0.name} 『${String(name).replace(/[『』]/g, '')}』 — 발동하지 않는다 (${off})`
            : `【포텐셜】 ${m0.name} 『${String(name).replace(/[『』]/g, '')}』 — 【준비】 조건 불충족(${off})이라 이번 배틀에서는 발동하지 않는다`,
          'battle',
          { mid: m0.id, img: m0.image || '' }
        );
        return false;
      }
    } /* 11-09 감우 54-G */
    if (kind === 'pot' && !opt.uq && auto.src !== 'card') {
      const bk = misagBlock(b0, m0, name);
      if (bk) {
        A().sysLog(`【포텐셜】 ${m0.name} 『${name}』\n${bk} — 발동하지 않았다`, 'battle', { mid: m0.id, img: m0.image || '' });
        return false;
      }
    } /* 10-28 미사그 대학 */
    /* 확률 (10-24 망령): 레디메이드 특성은 글(text)이 비어 있어 확률을 못 읽었다 — 그 칸의 효과 글까지 본다. 「N할로」 · 「N% 확률」 은 여기서 굴리고, 줄마다 고르는 효과(①②)는 고른 줄에서 굴린다 */
    const etx = auto.text || slotEff(m0, kind, name);
    const tm = FX().timing(etx);
    const nb0 = snap(b0),
      nb = snap(nb0);
    const m = nb.mons[mid];
    const L = [];
    const lc = !!(FX().lineChance && FX().lineChance(auto.ops));
    const perLine = auto.ops.length === 1 && auto.ops[0].k === 'choice';
    /* 10-24 망령: 레디메이드에 적어 둔 확률(p)이 먼저 */ const pExp =
      auto.p != null && auto.p !== '' && isFinite(+auto.p) && +auto.p > 0 ? Math.min(100, +auto.p) : 0;
    const ch = opt.noRoll ? 0 : pExp ? pExp : !tm.percent && !perLine && !lc && FX().chanceOf ? FX().chanceOf(etx) : 0;
    const KN = { pot: '포텐셜', trait: '특성', item: '소지품', order: '지령' }[kind] || '효과';
    let adj = {};
    if (!opt.quiet && !opt.noRoll && FX().rollP && ((ch && ch < 100) || tm.percent || chanceIn(auto.ops))) {
      adj = await askChance(name, ch || (tm.percent ? FX().percentOf(tm.percent) : 0));
      if (adj === null) return false;
    }
    const roll = p =>
      FX().rollP
        ? FX().rollP(m, p, adj)
        : (() => {
            const r = Math.floor(Math.random() * 100) + 1;
            return { ok: r <= p, r, p, adj: '' };
          })();
    if (ch && (ch < 100 || Object.keys(adj).length || ((m.fx || {}).chance || []).length)) {
      const rr = roll(ch);
      if (!rr.ok) {
        A().sysLog(`【${KN}】 ${m.name} 『${name}』\n${rr.p}% 판정 실패 (${rr.r}/${rr.p})${rr.adj} — 발동하지 않았다`, 'battle', {
          mid: m.id,
          img: m.image || ''
        });
        return false;
      }
      L.push(`${rr.p}% 판정 성공 (${rr.r}/${rr.p})${rr.adj}`);
    }
    /* 11-03 21:36 망령 「중확률 판정 성공 뒤에 또 실패가 뜬다」(변한 뒤의 기쁨): 글의 확률 말과 구문 줄의 확률(「중확률:」)이 같이 있으면 줄에서만 굴린다 */
    if (tm.percent && !opt.noRoll && !pExp && !lc) {
      const rr = roll(FX().percentOf(tm.percent));
      if (!rr.ok) {
        A().sysLog(`【${KN}】 ${m.name} 『${name}』\n${tm.percent} 판정 실패 (${rr.r}/${rr.p})${rr.adj} — 발동하지 않았다`, 'battle', {
          mid: m.id,
          img: m.image || ''
        });
        return false;
      }
      L.push(`${tm.percent} 판정 성공 (${rr.r}/${rr.p})${rr.adj}`);
    }
    /* 「필드 위에 있는 한」 · 「필드에 있는 동안」: 이 효과가 바꾼 것은 쓴 포켓몬이 필드를 떠나면 되돌린다 */ const hold = Object.assign(
      FX().release && (/필드\s*(?:위)?에\s*있는\s*(?:한|동안)|나와\s*있는\s*(?:한|동안)/.test(etx) || (opt.aura && /【방호】/.test(etx)))
        ? { hold: 1 }
        : {},
      /【유일】/.test(etx) ? { uniq: 1 } : {}
    ); /* 11-03 20:44 망령 「커맨더 · 옵저버」: 【방호】 아군 효과(opt.aura)도 「있는 한」처럼 · 【유일】 은 같은 이름 효과를 이미 받은 대상에겐 안 건다 */
    /* 10-26 망령: 트레이너 고유는 고른 포켓몬이 곧 대상 — 구문의 「아군 1체」는 「고른 포켓몬」으로 (예전엔 고른 포켓몬을 뺀 다른 아군에게 걸렸다) */
    /* 10-26 덱 시험: 카드의 「아군 1체」가 기준 포켓몬(자기 편 첫 포켓몬)을 빼고 물었다 — 트레이너가 쓰는 카드는 기준 포켓몬도 고를 수 있게 (ally1s) */
    const ops = opt.uq
      ? JSON.parse(JSON.stringify(auto.ops).replace(/"tgt":"ally1"/g, '"tgt":"self"'))
      : auto.src === 'card'
        ? JSON.parse(JSON.stringify(auto.ops).replace(/"tgt":"ally1"/g, '"tgt":"ally1s"'))
        : auto.ops;
    const ux = uiCtx(nb, m, name, opt.area);
    {
      const PK = [...(opt.pickId ? [opt.pickId] : []), ...(opt.pickIds || [])];
      if (PK.length) {
        const up = ux.pick;
        ux.pick = (list, label) => {
          const f = PK.map(id => list.find(x => x.id === id)).find(Boolean);
          return f ? Promise.resolve(f) : up(list, label);
        };
      }
    } /* 11-09 감우 56: pickIds = 고를 후보를 순서대로 (퇴장 계기: 들어온 아군 → 정면) */ /* 11-02: 창에서 이미 고른 대상 */
    if (opt.tsel && ux.useMove) {
      const um = ux.useMove;
      ux.useMove = (mm, mv, nm, o) => {
        const tm = (nb.mons || {})[opt.tsel];
        const sl = tm && tm.entry && tm.hp && tm.hp.cur > 0 ? [slotOf(tm.side, tm.entry)] : null;
        return um(mm, mv, nm, Object.assign({}, o || {}, sl ? { targets: sl } : {}));
      };
    } /* 11-09 망령: 「대상지정」으로 고른 포켓몬을 「기술사용」(추가 행동) 공격 창의 대상으로 */
    const r = await FX().run(
      ops,
      Object.assign(
        ux,
        opt.ctx || {},
        opt.force ? { force: 1 } : {},
        opt.noRoll ? { noRoll: 1 } : {},
        opt.hit ? { hit: opt.hit } : {},
        adj,
        hold,
        STK2 ? { stack: STK2 } : {}
      )
    ); /* 11-09 opt.ctx: 「소지품 소모」 계기의 used 등 */ /* 11-08 opt.hit: 「조건 명중」이 맞은 대상 · 기술을 본다 */
    /* 11-09: 조건에 막혔으면 진행하는 화면(GM)에 「강제 발동」을 묻는다 — 저절로 도는 것(quiet)은 로그에 안내만 */
    if (r.blocked && !opt.force) {
      {
        const h =
          kind === 'field'
            ? '(필드 주인 · GM: 《필드》 칩 → 정보 창 「강제 발동」으로 조건을 건너뛸 수 있다)'
            : opt.manual || !opt.quiet
              ? '(벤치 「강제 발동」을 켜 두면 조건 · 확인 · 확률을 건너뛰고 발동한다)'
              : '';
        if (h) r.lines.push(h);
      }
    }
    L.push(...r.lines);
    if (hold.hold && (m.holds || []).length) L.push('(필드를 떠나면 풀린다)');
    const raidNew = await raidFix(m, m0, name, L);
    if (raidNew === null) return false;
    const f = fieldOf(nb);
    for (const id in nb.mons) {
      const x = nb.mons[id];
      if (x.entry && x.hp.cur <= 0) {
        x.entry = '';
        L.push(`${x.name}은(는) 쓰러졌다!`);
      }
    }
    if (!(await saveBattle(nb0, nb, f, { n: m.name, s: name, img: opt.img != null ? opt.img : m.image || '' }))) return false;
    if (raidNew) raidCut(m);
    if (kind === 'item' && oneShot(m0, name) && !opt.quiet && (await askYes(`「${name}」을(를) 다 썼나? (소지품 칸에서 뺀다)`, '뺀다', '남긴다')))
      setTimeout(() => itemConsume(mid, false, name), 50);
    A().sysLog(
      opt.head
        ? `${opt.head}${L.length ? '\n' + L.join('\n') : ''}`
        : `【${{ pot: '포텐셜', trait: '특성', item: '소지품', order: '지령' }[kind] || '효과'}】 ${m.name} 『${name}』${L.length ? '\n' + L.join('\n') : ''}`,
      'battle',
      {
        mid: m.id,
        ...(opt.gmPriv ? { gmPriv: 1 } : {}),
        ...(opt.quiet &&
        ['은밀망토', '클리어참'].includes(
          String(name || '')
            .replace(/[『』「」]/g, '')
            .trim()
        )
          ? { privAll: 1 }
          : {}),
        img: opt.img != null ? opt.img : m.image || '',
        eff: String(
          opt.eff ||
            auto.text ||
            (kind === 'trait' ? m.abilityEff : kind === 'item' ? m.itemEff : (potSrc(m).find(p => p && p.name === name) || {}).eff) ||
            ''
        )
          .replace(/<br\s*\/?>/g, '\n')
          .slice(0, 300)
      }
    );
    /* 11-09 감우 54-E: 특성 · 포텐셜이 「발동」한 것(등장 때 조용히 거는 상시는 빼고)을 계기로 */ if (
      kind === 'pot' &&
      !(opt.quiet && opt.noRoll) &&
      !r.blocked
    )
      await shareMark(mid, name);
    /* 11-10 【공유】: 발동한 포텐셜을 이번 턴 기록에 */ if (
      (kind === 'trait' || kind === 'pot') &&
      !opt.noEv &&
      !(opt.quiet && opt.noRoll) &&
      !r.blocked
    ) {
      const nm0 = String(name || '')
        .replace(/[『』]/g, '')
        .trim();
      setTimeout(() => evReact(kind, { mid, name: nm0, eff: etx, key: nm0 + '@' + Date.now() }).catch(e => console.warn('evReact', e)), 500);
    }
    return true;
  }
  /* 11-04 19:37 망령 「【1/시】는 【자동】이 붙은 게 아닌 이상 맘대로 발동하지 마」: 횟수(【N/시】)가 있는 포텐셜은 【자동】이 없으면 저절로 쓰지 않는다 — 등장 · 상시 · 지연 · 폼 체인지 자동 모두. 쓸 때는 카드 「발동」 · 선행 입력 */
  function limManual(m, kind, name, tx) {
    if (kind !== 'pot') return false;
    const t = String(tx != null && tx !== '' ? tx : slotEff(m, kind, name) || '');
    return /【\s*\d+\s*\/\s*시\s*】/.test(t) && !/【\s*자동\s*】/.test(t);
  }
  function slotEff(m, kind, name) {
    const n = String(name || '').replace(/『|』/g, '');
    if (kind === 'trait') return m.abilityEff || (FX() && FX().effOf ? FX().effOf('trait', n) : '');
    if (kind === 'item') {
      const x = n === m.item ? m : (m.items2 || []).find(q => q && q.item === n);
      return (x && x.itemEff) || '';
    }
    const pe = (potSrc(m).find(p => p && p.name === n) || {}).eff || '';
    if (pe) return pe;
    /* 11-03: 트레이너 고유 포텐셜의 효과 글도 (autoOnEntry · fireAuto) */ const t = m && m.tid ? (ctx().b.trainers || {})[m.tid] : null;
    const u = t && (t.unique || []).find(q => q && String(q.name || '').replace(/『|』/g, '') === n);
    return (u && u.eff) || '';
  }
