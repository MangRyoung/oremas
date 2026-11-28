  /* ── 조각 12_auto_events.js — 필드 구문 · 자동 발동 · 계기(EVM · evReact) · 등장 자동 ── */
  /* ---------- 11-09 망령 「필드 전개에도 구문 — 턴 개시 · 턴 종료 확률 발동 · 등장(임의 교대 · 죽어내밀기 포함) · 복합 효과」 ----------
    battle.field.stage.auto = {deploy, start, end, entry, hold, who} (제작기 js/fx/fx_ui.js fieldAutoBox). 효과 이름 = 《필드 이름》 — 걷힐 때 그 이름으로 푼다.
    deploy · start · end: 자신 = 필드 주인 포켓몬(트레이너 필드면 그 트레이너의 나와 있는 첫 포켓몬, 없으면 주인 편 첫 포켓몬).
    entry: 자신 = 나온 포켓몬 (who: all 누구든 · own 주인 편 · foe 상대 편). 등장 때마다 hold 도 그 포켓몬에게 건다.
    hold: 줄의 대상에 맞는 포켓몬마다 「자신」으로 바꿔 건다 (자신 = 주인 · 아군 · 상대 · 전체) — 이미 그 이름 효과가 있으면 건너뛴다 */
  const FA_KO = { deploy: '전개 시', start: '턴 개시 시', end: '턴 종료 시', entry: '등장 시', use: '소지품 소모 시', hold: '필드 동안' };
  /* 11-09 망령 「필드는 전체에 깔리니 모든 포켓몬 적용이 디폴트」: 전개 · 턴 개시 · 턴 종료 · 필드 동안의 줄에 대상 낱말이 없으면 「전체」를 붙여 읽는다 (등장 · 소지품 소모는 그 포켓몬) */
  const FA_TW =
    /(^|\s)(자신|아군전체|아군|상대전체|상대|자신이외|전체|아군1체|아군1|상대1체|상대1|무작위1|자신이외무작위|상대무작위|전원무작위|에리어|지정에리어)(?=\s|$)/;
  const faTo = (t, w) =>
    String(t || '')
      .split('\n')
      .map(l => {
        const x = l.trim();
        if (!x || x.startsWith('#') || /^(조건|확인|선택|-|·|•)/.test(x) || /[;；]/.test(x) || FA_TW.test(x)) return l;
        return l.replace(/\s*(있는한)?\s*$/, m => ' ' + w + m);
      })
      .join('\n');
  const faAll = t => faTo(t, '전체');
  const faName = s => '《' + String(s.name || '') + '》';
  /* 11-15 망령 「필드 전개에 H」: stage.h 1 = H 파티(hTid)는 필드 효과를 받지 않음 · 2 = H 의 상대(다른 편)가 받는 효과는 무효 → 이 포켓몬이 필드 효과를 받나 */
  function fieldHOk(b, s, m) {
    if (!s || !m || !+s.h || !s.hTid) return true;
    if (+s.h === 3) return true;
    /* 11-23 저녁 257: 3 = H 지정만 — 누가 받는지는 필드 글(【H】 PT …)이 가른다 */ const tk = x => {
      const t = (b.trainers || {})[x];
      return t && t.solo ? 'solo:' + x : (t || {}).side;
    };
    if (+s.h === 1) return m.tid !== s.hTid;
    return tk(m.tid) === tk(s.hTid);
  }
  /* 「필드 동안」 줄을 이 포켓몬 몫으로 (대상 낱말이 없으면 전체 · 자신 = 주인 · 아군/상대 = 주인 기준) — 이미 그 이름 효과가 있으면 [] */
  function faHoldOps(b, s, m) {
    if (!FX() || !s || !s.auto || !String(s.auto.hold || '').trim() || !m) return [];
    if (!fieldHOk(b, s, m)) return [];
    const nm = faName(s);
    if ((FX().chips(m) || []).some(ch => ch && ch.name === nm)) return [];
    const tk = x => {
      const t = (b.trainers || {})[x.tid];
      return t && t.solo ? 'solo:' + x.tid : x.side;
    };
    const om = s.ownerMid ? b.mons[s.ownerMid] : null;
    const anyT = om || Object.values(b.mons || {}).find(x => x.tid === s.tid);
    const own = anyT ? tk(anyT) : '';
    const rel = tk(m) === own ? 'ally' : 'enemy';
    const isO = !!om && m.id === om.id;
    const ok = t => {
      t = t || 'self';
      if (t === 'self') return isO;
      if (/^ally/.test(t)) return rel === 'ally' && !(t === 'allyx' && isO);
      if (/enemy/.test(t)) return rel === 'enemy';
      if (t === 'others' || t === 'randother') return !isO;
      return true;
    };
    let r = { ops: [] };
    try {
      r = FX().parse(faAll(s.auto.hold));
    } catch (e) {}
    return (r.ops || []).filter(op => op && op.k !== 'choice' && ok(op.tgt)).map(op => Object.assign({}, op, { tgt: 'self', p: 0, pl: '' }));
  }
  /* 등장 처리(설치기보다 먼저) — 같은 사본 nb 안에서 새로 나온 포켓몬에게 「필드 동안」을 건다 (벌레 타입 스피드 감소 무시가 끈적끈적네트보다 먼저 걸리게) */
  async function fieldHoldInto(nb, m) {
    const s = (nb.field || {}).stage;
    if (!s || !s.name) return [];
    const ops = faHoldOps(nb, s, m);
    if (!ops.length) return [];
    const nm = faName(s);
    const r = await FX().run(ops, Object.assign(uiCtx(nb, m, nm), { noRoll: 1 }));
    return r.lines.length ? [`【필드】 ${nm} — 필드 동안`, ...r.lines] : [];
  }
  /* 11-22 망령 (에마 《절계/마녀사냥의 재판소》 「필드 위의 모든 포켓몬은 자신의 공격으로 포켓몬을 「빈사」 상태로 만들었을 때 「타입 : 악」이 된다」):
    펼친 필드의 효과 글을 그대로 읽어 그 포켓몬의 타입을 바꾼다 (구문 없이). 같은 꼴의 페르세포네 《명계》 「「소지품 : 나무열매」를 소모했을 때 「타입 : 고스트」가 된다」도.
    필드에 그 계기 구문(auto.use …)이 따로 있으면 구문이 먼저 · H 설정(fieldHOk)을 따름 · 이미 그 타입이면 넘김 */
  const FTT_RE = {
    ko: /자신의\s*공격으로\s*(?:상대(?:의)?\s*)?(?:포켓몬)?\s*(?:을|를)\s*「?\s*빈사\s*」?\s*(?:상태)?\s*(?:로|으로)\s*만들었을\s*때\s*,?\s*「\s*타입\s*[:：]\s*([^」]+)」\s*(?:이|가)?\s*된다/,
    use: /「\s*소지품\s*[:：]\s*나무열매\s*」\s*(?:을|를)\s*소모했을\s*때\s*,?\s*「\s*타입\s*[:：]\s*([^」]+)」\s*(?:이|가)?\s*된다/
  };
  async function fieldTxtType(mid, trig, o) {
    try {
      o = o || {};
      const b = ctx().b;
      const s = (b.field || {}).stage;
      if (!s || !s.name || !FX() || !FTT_RE[trig]) return;
      const m = (b.mons || {})[mid];
      if (!m || !m.entry || !(m.hp && m.hp.cur > 0) || !fieldHOk(b, s, m)) return;
      if (String((s.auto || {})[trig] || '').trim()) return;
      if (trig === 'use' && !/열매$/.test(String((o.used || {}).name || '').trim())) return;
      const x = String(s.eff || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .match(FTT_RE[trig]);
      if (!x) return;
      const ts = x[1]
        .split(/[\/·,]/)
        .map(t => t.trim())
        .filter(Boolean);
      if (!ts.length) return;
      const cur = (tysOf(m) || []).filter(t => t && t !== '-').map(t => S().typeKo(t) || t);
      if (cur.length === ts.length && ts.every(t => cur.includes(t))) return;
      const ops = (FX().parse('타입 변경 ' + ts.join(',')) || {}).ops || [];
      if (!ops.length) return;
      const nm = faName(s);
      await fireAuto(mid, 'field', nm, {
        auto: { name: nm, src: 'dyn', ops, text: x[0] },
        quiet: true,
        noRoll: true,
        force: true,
        noEv: 1,
        ownTid: s.tid || '',
        head: `【필드】 ${nm} — ${m.name} ${trig === 'ko' ? `${o.who ? o.who + '을(를) ' : ''}쓰러뜨려` : `「${(o.used || {}).name || '나무열매'}」를 소모해`} 「타입 : ${ts.join('/')}」`
      });
    } catch (e) {
      console.warn('fieldTxtType', e);
    }
  }
  async function fieldAuto(trig, o) {
    o = o || {};
    const c = ctx();
    if (!c.mgr || !FX() || !FX().parse) return;
    const b = c.b;
    const s = (b.field || {}).stage;
    if (!s || !s.name || !s.auto || typeof s.auto !== 'object') return;
    const AU = s.auto;
    const nm = faName(s);
    const tk = m => {
      const t = (b.trainers || {})[m.tid];
      return t && t.solo ? 'solo:' + m.tid : m.side;
    };
    const live = m => !!(m && m.entry && m.hp && m.hp.cur > 0);
    const om = s.ownerMid ? b.mons[s.ownerMid] : null;
    const anyT = om || Object.values(b.mons || {}).find(m => m.tid === s.tid);
    const own = anyT ? tk(anyT) : '';
    const P = k => {
      let r = { ops: [], errs: [] };
      try {
        r = FX().parse(['deploy', 'start', 'end', 'hold'].includes(k) ? faAll(AU[k]) : faTo(AU[k], '자신'));
      } catch (e) {
        r.errs = [e.message];
      }
      if (r.errs && r.errs.length) A().sysLog(`【필드】 ${nm} 「${FA_KO[k]}」 구문에서 못 읽은 줄 — ${r.errs.join(' / ')}`, 'battle', { gmPriv: 1 });
      return r.ops || [];
    };
    const fire = (mid, k, ops, x) =>
      fireAuto(
        mid,
        'field',
        nm,
        Object.assign(
          {
            quiet: true,
            auto: { ops, text: String(AU[k] || '') },
            head: `【필드】 ${nm} — ${FA_KO[k]}${o.force ? ' (강제 발동)' : ''}`,
            eff: String(s.eff || ''),
            ownTid: s.tid || ''
          },
          o.force ? { force: true } : {},
          x || {},
          { ctx: Object.assign({}, (x && x.ctx) || {}, +s.h && s.hTid ? { tgtOk: mm => fieldHOk(ctx().b, s, mm) } : {}) }
        )
      );
    /* 11-09 소지품 소모 시: o.mid = 다 쓴 포켓몬 · o.used = {name} — 「조건 소모:나무열매」가 읽는다 */
    if (trig === 'use') {
      const m = b.mons[o.mid];
      if (!m || !m.entry || !String(AU.use || '').trim() || !fieldHOk(b, s, m)) return;
      const ops = P('use');
      if (ops.length) await fire(m.id, 'use', ops, { ctx: { used: o.used || {} } });
      return;
    }
    const holdFor = async mid => {
      const b2 = ctx().b;
      const m = b2.mons[mid];
      if (!live(m)) return;
      const ops = faHoldOps(b2, (b2.field || {}).stage, m);
      if (ops.length) await fire(mid, 'hold', ops, { noRoll: true });
    };
    if (trig === 'entry') {
      const m = b.mons[o.mid];
      if (!live(m)) return;
      const who = AU.who || 'all';
      const rel = tk(m) === own ? 'own' : 'foe';
      if (String(AU.entry || '').trim() && (who === 'all' || who === rel) && fieldHOk(b, s, m)) {
        const ops = P('entry');
        if (ops.length) await fire(m.id, 'entry', ops);
      }
      await holdFor(m.id);
      return;
    }
    if (!['deploy', 'start', 'end'].includes(trig)) return;
    if (String(AU[trig] || '').trim() && !o.holdOnly) {
      const L = Object.values(b.mons || {});
      const holder = live(om) ? om : L.find(m => live(m) && m.tid === s.tid) || L.find(m => live(m) && own && tk(m) === own);
      if (!holder) A().sysLog(`【필드】 ${nm} 「${FA_KO[trig]}」 — 주인 편에 나와 있는 포켓몬이 없어 구문을 건너뛴다`, 'battle', { gmPriv: 1 });
      else {
        const ops = P(trig);
        if (ops.length) await fire(holder.id, trig, ops);
      }
    }
    if (trig === 'deploy') for (const m of Object.values(ctx().b.mons || {})) if (live(m)) await holdFor(m.id);
  }
  /* 필드가 걷히면 《이름》으로 건 지속 효과를 푼다 (전개 · 걷기 창 — 턴 종료의 걷힘은 stage_ui turnEnd 가 같은 사본에서) */
  async function fieldClear(name) {
    const c = ctx();
    if (!c.mgr || !FX() || !name) return 0;
    const nb0 = snap(c.b),
      nb = snap(nb0);
    let n = 0;
    const who = [];
    for (const m of Object.values(nb.mons || {})) {
      const k = FX().removeByName(m, name);
      if (k) {
        n += k;
        who.push(m.name);
      }
    }
    if (!n) return 0;
    if (!(await saveBattle(nb0, nb))) return 0;
    A().sysLog(`【필드】 ${name} 걷힘 — ${who.join(' · ')}의 필드 효과가 풀렸다`, 'battle');
    return n;
  }
  /* 턴 개시 자동 (10-24 망령): 「턴 개시 시」 · 【턴 개시】 가 적힌 특성 · 소지품 · 포텐셜 — 구문이 있으면 (확률을 굴려) 발동, 없으면 확률만 굴려 손으로 할 일을 알린다 */
  async function autoTurnStart() {
    if (!FX()) return;
    const b = ctx().b;
    for (const m of Object.values(b.mons || {})) {
      if (!m.entry || m.hp.cur <= 0) continue;
      const list = [];
      if (m.ability) list.push(['trait', m.ability]);
      if (m.item && !IOFF(m)) list.push(['item', m.item]);
      for (const x of m.items2 || []) if (x && x.item && !IOFF(m)) list.push(['item', x.item]);
      for (const p of potSrc(m)) if (p && p.name && !p.ph) list.push(['pot', p.name]);
      for (const [kind, name] of list) {
        const tx0 = slotEff(m, kind, name);
        const TSR = /턴\s*개시\s*시|【턴\s*개시】/;
        const tx = TSR.test(tx0) || kind !== 'item' ? tx0 : (FX().autoOf(m, kind, name) || {}).text || tx0;
        const TT = +b.turn || 0;
        const tmS = !TSR.test(tx) && tmulStart(tx, TT);
        if (!TSR.test(tx) && !tmS) continue;
        if (TSR.test(tx) && !segsOf(tx).some(x => TSR.test(x) && tmulOk(x, TT))) continue;
        /* 11-26 망령 「N배수 턴 계기」: 「「3」배수 턴 개시 시」는 3의 배수 턴에만 · 타이밍 말 없이 「「N」배수 턴에 …」만 있는 마디도 그 턴 개시에 (지속형 구문이면 판정 때 턴:N배수 가 보니 건너뜀) */ /* 11-08 51-2 ③ 선제공격손톱: 소지품 효과 글에 없으면 레디메이드 글(「턴 개시 시 2할로 …」)도 본다 */ if (
          /【\s*(선행|임의)\s*】/.test(tx)
        )
          continue;
        if (kind === 'pot' && /【\s*\d+\s*\/\s*(시|턴)\s*】/.test(tx)) continue;
        const a = FX().autoOf(m, kind, name);
        if (tmS && a && a.ops && passiveOps(a.ops, '')) continue;
        /* 11-18 망령 제보 「애슈열매 — 턴 개시마다 조건(HP 1/4 이하) 불충족 줄이 뜬다」: 맨 앞 「조건 HP≤」가 안 맞으면 조용히 넘긴다 */
        if (a && a.ops && a.ops[0] && a.ops[0].k === 'cond' && a.ops[0].c === 'hp_le') {
          const fr = String(a.ops[0].frac || '1/1')
            .split('/')
            .map(Number);
          if (+m.hp.cur > Math.floor((+m.hp.max * fr[0]) / (fr[1] || 1))) continue;
        }
        if (a && a.ops && a.ops.length && !a.manual) {
          await fireAuto(m.id, kind, name, { quiet: true });
          continue;
        }
        const ch = FX().chanceOf(tx);
        const K = { pot: '포텐셜', trait: '특성', item: '소지품' }[kind];
        let roll = '';
        if (ch && ch < 100) {
          const rr = FX().rollP
            ? FX().rollP(snap(m), ch, {})
            : (() => {
                const r = Math.floor(Math.random() * 100) + 1;
                return { ok: r <= ch, r, p: ch, adj: '' };
              })();
          roll = rr.ok
            ? `${rr.p}% 판정 성공 (${rr.r}/${rr.p})${rr.adj} — 효과를 손으로 적용`
            : `${rr.p}% 판정 실패 (${rr.r}/${rr.p})${rr.adj} — 발동하지 않았다`;
        } else roll = tmS ? `${tmulNs(tx).join(' · ')}배수 턴 효과 — 손으로 적용` : '턴 개시 효과 — 손으로 적용';
        A().sysLog(`【${K}】 ${m.name} 『${name}』\n${roll}`, 'battle', {
          mid: m.id,
          img: m.image || '',
          eff: String(tx)
            .replace(/<br\s*\/?>/g, '\n')
            .slice(0, 300)
        });
      }
    }
  }
  /* 등장·상시 자동 발동: 글에 【등장】/【상시】 표식이 있는 특성·소지품·포텐셜 */
  /* 지속형 구문: 걸어 두면 공격 창 · 순서 · HP 창이 알아서 읽는 것들 */
  const PASSIVE_K = [
    'boost',
    'guard',
    'mult',
    'immune',
    'nodrop',
    'ignoreup',
    'noind',
    'float',
    'prio',
    'chance',
    'pursuit',
    'cond',
    'sp',
    'role',
    'basechg'
  ]; /* 11-10 망령 「트랜스처럼 배틀 중 종족치 변경」: 종족치변경(복사:상대최고 …)도 나와 있는 동안 늘 켜짐 — 교대 · 해제하면 원래대로 */ /* 11-03 22:50: 「역할 추가」(타이트엔드 = 어태커 · 블로커 취급)도 늘 켜짐 */
  /* 맨 앞 「조건」(아군빈사 · HP≤ · 상태)을 미리 본다 — 안 맞으면 조용히 넘기고 나중(아군 빈사 등)에 다시 */
  function condNow(b, m, ops) {
    if (!m) return false;
    for (const o of ops || []) {
      if (o.k !== 'cond') break;
      if (o.c === 'ally_fainted') {
        if (!Object.values(b.mons || {}).some(x => x.id !== m.id && sameT(x, m, b) && x.hp.cur <= 0)) return false;
      } else if (o.c === 'self_state') {
        if (!(m.states || {})[o.st] && !csFromCond(ops)) return false;
      } else if (o.c === 'foe_type') {
        /* 11-15 05시: 「적진에 「타입 : X」가 있을 때」(폭식죄의 요살) — 필드의 상대 중 하나라도 */ const want = (o.types || []).map(String);
        if (!Object.values(b.mons || {}).some(x => x && x.entry && x.hp && x.hp.cur > 0 && !sameT(x, m, b) && tysOf(x).some(t => want.includes(t))))
          return false;
      } else return false;
    }
    return true;
  }
  /* 11-08 망령 「돌던지기가 「타입 : 물」에게 명중 했을 때 대상을 강제 교대」: 구문 첫 줄이 「조건 명중 [기술:…] [상대타입:…] [타입:…]」인 공격한 포켓몬의 포텐셜 · 특성 · 소지품 —
    공격을 적용한 뒤 맞은 대상마다 조건을 보고 저절로 (대상 = 맞은 포켓몬). 【N/시】 포텐셜은 【자동】 이 있어야 하고 횟수를 깎는다 (없으면 「발동」 하라고 알림) */
  async function hitAuto(mid, R) {
    if (!FX() || !FX().hitOk || !R || !R.mv) return;
    const a0 = ctx().b.mons[mid];
    if (!a0) return;
    const hits = (R.targets || []).filter(r => r && r.acc && r.acc.hit && r.def && r.def.id !== mid);
    /* 11-26 「한번」(다음에 내보내는 X — 한 번만): 그 기술을 내면 맞든 빗나가든 쓴 것으로 적는다(mons[].hitOnce[이름] · 필드를 떠나면 outReset 이 지움). onceUse = 이 기술이 그 줄의 기술 제한에 드는가 */
    const nmq = x => String(x || '').replace(/\s/g, '');
    const onceUse = c0 => !!(c0 && c0.once) && R.mv.cat !== '변화' && (!(c0.mv && c0.mv.length) || c0.mv.some(x => nmq(x) === nmq(R.mv.name)));
    const mvPrio = (() => {
      try {
        return FX().prioOf ? +FX().prioOf(a0, R.mv) || 0 : +(R.mv.prio || 0);
      } catch (e) {
        return +(R.mv.prio || 0);
      }
    })();
    const list = [];
    if (a0.ability) list.push(['trait', a0.ability]);
    if (a0.item) list.push(['item', a0.item]);
    for (const x of a0.items2 || []) if (x && x.item) list.push(['item', x.item]);
    for (const p of potSrc(a0)) if (p && p.name && !p.ph) list.push(['pot', p.name]);
    for (const [kind, name] of list) {
      const a = ctx().b.mons[mid];
      if (!a) return;
      const au = FX().autoOf(a, kind, name);
      if (!au || !au.ops || !au.ops.length || au.manual) continue;
      const c0 = au.ops[0];
      if (!c0 || c0.k !== 'cond' || c0.c !== 'on_hit') continue;
      if (c0.once) {
        if ((a.hitOnce || {})[name]) continue;
        if (onceUse(c0)) await A().set(['battle', 'mons', mid, 'hitOnce', name], 1);
      }
      const eff = slotEff(a, kind, name);
      const K = { pot: '포텐셜', trait: '특성', item: '소지품' }[kind] || '효과';
      for (const r of hits) {
        const d = ctx().b.mons[r.def.id];
        if (!d) continue;
        const h = {
          move: R.mv.name,
          defTypes: tysOf(d),
          moveTypes: R.moveTypes || [],
          cat: R.mv.cat || '',
          tags: String(R.mv.tag || '')
            .split(/[,\s#]+/)
            .concat(R.mv.tags || [])
            .concat(String(R.mv.contact || '') === 'O' ? ['접촉', '접촉기'] : ['비접촉', '비접촉기'])
            .filter(Boolean),
          defId: d.id,
          prio: mvPrio,
          air: (() => {
            try {
              return !F().grounded(d);
            } catch (e) {
              return false;
            }
          })(),
          foe: !sameT(a, d, ctx().b),
          multi: hits.length > 1 || /전체|자신\s*이외/.test(String(R.mv.range || '')),
          defItems: [d.item, ...(d.items2 || []).map(q => q && q.item)].filter(Boolean).map(v =>
            String(v)
              .replace(/[『』]/g, '')
              .trim()
          )
        };
        /* 11-23 조건 명중 태그:X */ if (!FX().hitOk(c0, h)) continue;
        if (limManual(a, kind, name, eff)) {
          A().sysLog(
            `【${K}】 ${a.name} 『${name}』 — 「${R.mv.name}」이(가) ${d.name}에게 명중해 조건을 만족했다 (【자동】 이 없어 카드 「발동」으로)`,
            'battle',
            { mid: a.id, img: a.image || '' }
          );
          continue;
        }
        let L = null;
        if (kind === 'pot') {
          const p = potSrc(ctx().b.mons[mid] || a).find(q => q && q.name === name);
          if (p) {
            const c = ctx().b.mons[mid] || a;
            L = limOf(p, c.potUses || {}, c.potTurn || {});
            if (L.left !== null && L.left <= 0) continue;
          }
        } /* 11-09 망령 「더 자동화할 것」: 【N/시】뿐 아니라 【소진】 · 【탈진】도 본다 */
        const ok = await fireAuto(mid, kind, name, {
          quiet: true,
          pickId: d.id,
          hit: h,
          head: `【${K}】 ${a.name} 『${name}』【자동】 — 「${R.mv.name}」이(가) ${d.name}에게 명중`
        });
        if (ok && L) {
          const cur = ctx().b.mons[mid] || a;
          if (L.mmax != null) {
            const u = (cur.potUses || {})[name];
            const had = u == null ? L.mmax : +u;
            await A().set(['battle', 'mons', mid, 'potUses', name], Math.max(0, had - 1));
          }
          if (L.per) await A().set(['battle', 'mons', mid, 'potTurn', name], +ctx().b.turn || 0);
          if (L.sup) await A().set(['battle', 'mons', mid, 'potTurn', '_sup', name], 1);
        }
      }
    }
  }
  /* 아군 빈사 (10-26 망령): 새로 쓰러진 포켓몬이 생기면 — 같은 편 필드 포켓몬의 「아군빈사」 조건 상시(에이스 …)를 걸고, 【자동】 「아군이 「빈사」 상태가 되었을 때」 포텐셜을 발동, 그 밖의 그런 고유 · 포텐셜은 알림 */
  const FAINT_SEEN = {};
  let faintBusy = false;
  /* 11-09 감우 55 (망령 「건 포켓몬이 떠나면 해제 — 포텐셜로 턴제로 걸었으면 떠나도 유지」): 「헤롱헤롱」 · 「검은눈빛」 · 「블록」 — 건 포켓몬(stFrom)이 필드를 떠나면(교대 · 빈사) 풀린다. 「N턴 동안」 고정으로 건 것(stKeep)은 그대로 */
  const LEAVE_ST = ['Attract', 'MeanLook', 'Block'];
  let leaveBusy = false;
  async function leaveWatch() {
    const c = ctx();
    const b = c.b;
    if (!c.mgr || !b || !b.started || leaveBusy || !isLeader(c)) return;
    const hit = [];
    for (const m of Object.values(b.mons || {})) {
      if (!m || !m.states) continue;
      for (const k of LEAVE_ST) {
        if (!m.states[k]) continue;
        const by = (m.stFrom || {})[k];
        if (!by || (m.stKeep || {})[k]) continue;
        const s = (b.mons || {})[by];
        if (s && s.entry && s.hp && s.hp.cur > 0) continue;
        hit.push([m.id, k, s ? s.name : '건 포켓몬']);
      }
    }
    if (!hit.length) return;
    leaveBusy = true;
    try {
      const b0 = snap(),
        nb = snap(b0);
      const L = [];
      for (const [id, k, who] of hit) {
        const m = nb.mons[id];
        if (!m || !m.states || !m.states[k]) continue;
        delete m.states[k];
        if (m.stFrom) delete m.stFrom[k];
        L.push(`${m.name} 「${stKoU(k)}」 해제 — ${who}이(가) 필드를 떠났다`);
      }
      if (L.length && (await saveBattle(b0, nb, undefined, { n: '상태', s: '해제', img: '' }))) A().sysLog(`【상태】\n${L.join('\n')}`, 'battle', {});
    } finally {
      leaveBusy = false;
    }
  }
  /* 11-09 감우 55: HP 적용 창이 lastHit 을 지우므로(clearHit) 맞은 기록은 lastTaken.hit.lh 에서도 찾는다 */
  const LHX = dm => (dm && (dm.lastHit || (dm.lastTaken && dm.lastTaken.hit && dm.lastTaken.hit.lh))) || null;
  /* 11-09 감우 56 (망령 「빈사 퇴장 류도?」): 쓰러진 포켓몬 자신의 특성 · 소지품 「(「접촉기」 | 「비접촉기」 | 기술 대미지)로 「빈사」 상태가 되었을 때」 — 유폭 · 독체액 · 마지막씨앗 · 내용물분출 (대상 = 쓰러뜨린 포켓몬).
    가장 최근 HP 변화(lastTaken)가 기술 명중이어야 한다 — 독 · 날씨로 쓰러졌으면 안 터진다. 비례 대미지 · 「X」 상태 · 「남아있던 HP 만큼」은 웹툴이 직접, 그 밖은 구문(레디메이드) · 없으면 알림.
    포텐셜의 「상대의 기술로 빈사가 되었을 때」는 54-E 가 따로 한다. 리시버 · 화학의힘(아군이 빈사 → 같은 특성)도 여기서 */
  const KO_RE = /(?:(「접촉기」|「비접촉기」|기술\s*대미지|「[^」]+」\s*기술)(?:로|에\s*의해)\s*)?「빈사」\s*상태가\s*되었을\s*때/;
  function koHit(d) {
    const lt = d && d.lastTaken;
    if (lt) return lt.hit && lt.hit.lh ? lt.hit.lh : null;
    const lh = d && d.lastHit;
    return lh && +lh.turn === (+ctx().b.turn || 0) ? lh : null;
  }
  async function koSelf(did) {
    const b = ctx().b;
    const d = b.mons[did];
    if (!d) return;
    const lh = koHit(d);
    const notes = [];
    const srcs = [];
    if (d.ability) srcs.push(['trait', abNm(d), String(d.abilityEff || '')]);
    if (d.item && !IOFF(d)) srcs.push(['item', d.item, String(d.itemEff || '')]);
    for (const [kind, name, eff] of srcs) {
      const cl = eff
        .replace(/<br\s*\/?>/gi, '\n')
        .split(/(?=[①②③④⑤])|\n/)
        .map(x => x.trim())
        .find(c => KO_RE.test(c) && !/아군|상대(?:가|의\s*포켓몬)|모든/.test(c.split('「빈사」')[0]));
      if (!cl) continue;
      const cz = (cl.match(KO_RE) || [])[1] || '';
      const K = kind === 'trait' ? '특성' : '소지품';
      const head = `【${K}】 ${d.name} 『${name}』 — 「빈사」`;
      if (/1할|\d할로|확률/.test(cl) && /HP\s*:\s*가득|부활|되살/.test(cl)) {
        notes.push(`${d.name} 『${name}』 — 쓰러졌다 (되살아나는 효과는 손으로 굴린다)`);
        continue;
      }
      if (cz) {
        if (!lh || lh.cat === '변화' || !lh.fromId) continue;
        if (/비접촉기/.test(cz) && lh.ct) continue;
        if (/「접촉기」/.test(cz) && !lh.ct) continue;
        const tx = cz.match(/「([^」]+)」\s*기술/);
        if (tx && !/접촉기/.test(tx[1])) {
          const ts = tx[1]
            .split('/')
            .map(s => S().typeEn(s.trim()))
            .filter(Boolean);
          if (ts.length && !ts.some(t => (lh.mt || []).includes(t))) continue;
        }
      }
      const atk = lh && lh.fromId ? ctx().b.mons[lh.fromId] : null;
      const to = /자신|아군/.test(cl.split('되었을 때')[1] || '') ? null : atk;
      const b0 = snap(),
        nb = snap(b0);
      const tg = to ? nb.mons[to.id] : null;
      const L = [];
      let x;
      if (to && (!tg || tg.hp.cur <= 0)) continue;
      if (tg && (x = cl.match(/남아\s*있던\s*「HP」\s*만큼/))) {
        const v = Math.max(0, +nb.mons[did].hp.latest || 0);
        if (v > 0) {
          tg.hp.latest = tg.hp.cur;
          tg.hp.cur = Math.max(0, tg.hp.cur - v);
          L.push(`${tg.name} −${v} (남아 있던 HP) → ${tg.hp.cur}/${tg.hp.max}`);
        }
      } else {
        const ops = [];
        const tgt = tg ? (tg.side === d.side ? 'ally1' : 'enemy1') : 'self';
        if ((x = cl.match(/(\d+\/\d+)\s*(?:만큼)?의?\s*비례\s*대미지/))) ops.push({ k: 'dmg', tgt, value: x[1], basis: 'max' });
        if ((x = cl.match(/「([^」:]+)」\s*상태로\s*만든다/)) && FX().stEn && FX().stEn(x[1]))
          ops.push({ k: 'state', state: x[1], tgt, count: -1, forced: 0 });
        if (!ops.length) {
          const a = FX().autoOf(d, kind, name);
          if (a && realOps(a) && !a.manual) {
            await fireAuto(did, kind, name, { auto: a, quiet: true, noEv: 1, head, pickIds: atk ? [atk.id] : [] });
          } else notes.push(`${d.name} 『${name}』 — 「빈사」 계기`);
          continue;
        }
        const res = await FX().run(ops, {
          b: nb,
          self: nb.mons[did],
          name,
          pick: list => list.find(q => tg && q.id === tg.id) || null,
          confirm: async () => true,
          choose: async () => [0]
        });
        L.push(...res.lines);
      }
      if (!L.length) continue;
      for (const id in nb.mons) {
        const q = nb.mons[id];
        if (q.entry && q.hp.cur <= 0) {
          q.entry = '';
          L.push(`${q.name}은(는) 쓰러졌다!`);
        }
      }
      if (await saveBattle(b0, nb, undefined, { n: d.name, s: name, img: d.image || '' }))
        A().sysLog(`${head}${lh && lh.move ? ' (' + (lh.from || '') + '의 「' + lh.move + '」)' : ''}\n${L.join('\n')}`, 'battle', {
          mid: did,
          img: d.image || ''
        });
    }
    /* 리시버 · 화학의힘: 필드의 같은 편 포켓몬이 쓰러진 아군의 특성을 이어받는다 */
    for (const x of Object.values(ctx().b.mons || {})) {
      if (!x || x.id === did || !x.entry || x.hp.cur <= 0 || !sameT(x, d, ctx().b)) continue;
      if (!/아군이\s*「빈사」\s*상태가\s*되었을\s*때\s*아군과\s*같은\s*「특성」이\s*된다/.test(String(x.abilityEff || ''))) continue;
      const tn = abNm(d);
      if (!tn || tn === abNm(x)) continue;
      const b0 = snap(),
        nb = snap(b0);
      const t = nb.mons[x.id];
      const by = '특성 : ' + abNm(x);
      if (FX().setAb) FX().setAb(t, tn, by);
      else {
        if (t.abilityOrig == null) t.abilityOrig = t.ability || '';
        t.abilityBy = by;
        t.ability = tn;
        t.abilityEff = ((DB().traits || {})[tn] || {}).multi || '';
      }
      if (await saveBattle(b0, nb, undefined, { n: x.name, s: abNm(x), img: x.image || '' }))
        A().sysLog(`【특성】 ${x.name} 『${abNm(x)}』 — ${d.name}의 「${tn}」을(를) 이어받았다`, 'battle', { mid: x.id, img: x.image || '' });
    }
    if (notes.length) A().sysLog(`【계기】 ${d.name} 「빈사」 — 손으로 처리할 효과\n${[...new Set(notes)].join('\n')}`, 'battle', { gmPriv: 1 });
  }
  const LAST_AREA =
    {}; /* 11-09 감우 56: 포켓몬마다 마지막으로 서 있던 에리어 — 저장 길에 따라 쓰러진 자리(koA)가 안 남을 때 【퇴장 (빈사)】의 정면 · 다음 등장 자리 */
  async function faintWatch() {
    const c = ctx();
    const b = c.b;
    if (!c.mgr || !b.started || faintBusy) return;
    for (const x of Object.values(b.mons || {})) if (x && x.entry && x.hp && x.hp.cur > 0) LAST_AREA[x.id] = x.entry;
    const bk =
      String(b.started) +
      ':' +
      Object.keys(b.mons || {})
        .sort()
        .join(',');
    if (!FAINT_SEEN[bk]) {
      FAINT_SEEN[bk] = new Set(
        Object.values(b.mons || {})
          .filter(m => m.hp.cur <= 0)
          .map(m => m.id)
      );
      return;
    }
    const seen = FAINT_SEEN[bk];
    /* 10-26 점검: 되살아난(HP>0) 포켓몬은 다시 빈사 감시 대상으로 */ for (const m of Object.values(b.mons || {}))
      if (m.hp.cur > 0 && seen.has(m.id)) seen.delete(m.id);
    const neu = Object.values(b.mons || {}).filter(m => m.hp.cur <= 0 && !seen.has(m.id));
    if (!neu.length) return;
    neu.forEach(m => seen.add(m.id));
    if (!isLeader(c)) return;
    /* 10-27: 아군 빈사 자동 처리도 한 창만 */ faintBusy = true;
    try {
      const RE = /아군이\s*(?:상대의\s*기술에\s*의해\s*)?「빈사」\s*상태가\s*되었을\s*때/;
      const notes = [];
      const doneT = new Set();
      /* 11-09 감우 56: 【퇴장 (빈사)】 · 맨 【퇴장】 (「필드에 등장한 아군」 줄은 그 자리에 다음 포켓몬이 나올 때) */ for (const dm of neu) {
        try {
          await koSelf(dm.id);
        } catch (e) {
          console.warn('빈사 특성', e);
        }
        try {
          await exitTrig(dm.id, '빈사', { phase: 'now' });
        } catch (e) {
          console.warn('퇴장 (빈사)', e);
        }
      }
      /* 11-11 【함성】 · 【함성 (「기술」)】 · 【함성 (「타입 : X」)】 — 이번 턴 상대 기술로 쓰러졌으면 쓰러뜨린 쪽에 */ for (const dm of neu) {
        try {
          const lh = LHX(dm);
          const k = lh && ctx().b.mons[lh.fromId];
          if (!k || k.hp.cur <= 0 || !k.entry || +lh.turn !== (+ctx().b.turn || 0) || sameT(k, dm, ctx().b)) continue;
          if (shoutNull(k, ctx().b)) continue;
          await evReact('ko', { mid: k.id, tgt: dm.id, mv: lh.move || '', key: dm.id });
        } catch (e) {
          console.warn('함성', e);
        }
      }
      /* 11-22 필드 글 「자신의 공격으로 포켓몬을 「빈사」 상태로 만들었을 때 「타입 : X」가 된다」 — 쓰러뜨린 쪽 (같은 편이어도) */ for (const dm of neu) {
        try {
          const lh = LHX(dm);
          const k = lh && ctx().b.mons[lh.fromId];
          if (!k || k.id === dm.id || k.hp.cur <= 0 || !k.entry || +lh.turn !== (+ctx().b.turn || 0)) continue;
          await fieldTxtType(k.id, 'ko', { who: dm.name });
        } catch (e) {
          console.warn('필드 빈사 타입', e);
        }
      }
      /* 11-09 감우 55: 「이 기술로 대상을 쓰러뜨렸을 때 자신의 HP 를 N 회복」(안개로삼키기류) */ for (const dm of neu) {
        const lh = LHX(dm);
        const k = lh && ctx().b.mons[lh.fromId];
        if (!k || k.hp.cur <= 0 || +lh.turn !== (+ctx().b.turn || 0)) continue;
        const mvo = MVS(k).find(v => v && v.name === lh.move);
        const au = mvo && moveAuto(mvo);
        if (!au || !au.koHeal) continue;
        if ((k.states || {}).HealBlock) {
          A().sysLog(`【기술】 ${k.name} 「${lh.move}」 — 「회복봉인」이라 회복하지 못함`, 'battle', { mid: k.id });
          continue;
        }
        {
          const nh = NOHEAL(k, 'heal');
          if (nh) {
            A().sysLog(`【기술】 ${k.name} 「${lh.move}」 — ${nh}: 회복이 발동하지 않는다`, 'battle', { mid: k.id });
            continue;
          }
        }
        const [p, q] = au.koHeal.split('/').map(Number);
        const b0 = snap(),
          nb = snap(b0);
        const kk = nb.mons[k.id];
        const v = Math.min(kk.hp.max - kk.hp.cur, Math.max(1, Math.floor((kk.hp.max * p) / q)));
        kk.hp.latest = kk.hp.cur;
        kk.hp.cur += v;
        if (await saveBattle(b0, nb, undefined, { n: k.name, s: lh.move, img: k.image || '' }))
          A().sysLog(`【기술】 ${k.name} 「${lh.move}」 — ${dm.name}을(를) 쓰러뜨려 HP +${v} → ${kk.hp.cur}/${kk.hp.max}`, 'battle', {
            mid: k.id,
            img: k.image || ''
          });
      }
      /* 11-09 감우 55: 「길동무」 — 상대의 기술로 쓰러지면 그 상대도 「빈사」 */ for (const dm of neu) {
        if (!(dm.states || {}).DestinyBond) continue;
        const lh = LHX(dm);
        const k = ctx().b.mons[lh && lh.fromId];
        if (!k || k.hp.cur <= 0 || sameT(k, dm, ctx().b)) continue;
        const b0 = snap(),
          nb = snap(b0);
        const kk = nb.mons[k.id];
        kk.hp.latest = kk.hp.cur;
        kk.hp.cur = 0;
        kk.entry = '';
        delete nb.mons[dm.id].states.DestinyBond;
        if (await saveBattle(b0, nb, undefined, { n: dm.name, s: '길동무', img: dm.image || '' }))
          A().sysLog(`【상태】 ${dm.name} 「길동무」 — ${k.name}도 「빈사」!`, 'battle', { mid: dm.id, img: dm.image || '' });
      }
      /* 11-09 감우 54-E: 「상대의 기술로 빈사가 되었을 때」(자신) — 쓰러진 포켓몬 자신의 포텐셜 (잇칸자카 『문을 여는 문지기』) */
      for (const dm of neu) {
        const lh = LHX(dm);
        if (!lh || !lh.fromId || sameT(ctx().b.mons[lh.fromId] || {}, dm, ctx().b)) continue;
        for (const p0 of potSrc(ctx().b.mons[dm.id] || dm)) {
          if (!p0 || !p0.name || p0.ph) continue;
          const eff = String(p0.eff || '');
          if (!/상대(?:의)?\s*기술(?:로|에\s*의해)\s*「?빈사」?\s*(?:상태)?\s*(?:가|이)?\s*되었을\s*때/.test(eff)) continue;
          const cur = ctx().b.mons[dm.id];
          const au = FX() && FX().autoOf(cur, 'pot', p0.name);
          if (!au || !realOps(au) || au.manual || limManual(cur, 'pot', p0.name, eff)) {
            notes.push(`${cur.name} 『${p0.name}』`);
            continue;
          }
          await fireAuto(dm.id, 'pot', p0.name, {
            quiet: true,
            noEv: 1,
            pickId: lh.fromId,
            head: `【포텐셜】 ${cur.name} 『${p0.name}』 — 상대의 기술로 빈사`
          });
        }
      }
      for (const dm of neu) {
        for (const x of Object.values(ctx().b.mons || {})) {
          if (x.id === dm.id || !x.entry || x.hp.cur <= 0 || !sameT(x, dm, ctx().b)) continue;
          await autoOnEntry(x.id, { passiveOnly: true });
          for (const p0 of potSrc(ctx().b.mons[x.id] || x)) {
            if (!p0 || !p0.name || p0.unique || p0.ph) continue;
            const eff = String(p0.eff || '');
            if (!RE.test(eff)) continue;
            const mm = eff.match(/【(\d+)\/시】/);
            const p = { name: p0.name, max: mm ? +mm[1] : null };
            const cur = ctx().b.mons[x.id];
            const u = (cur.potUses || {})[p.name];
            const left = p.max == null ? null : u == null ? p.max : +u;
            if (left !== null && left <= 0) continue;
            if (/상대의\s*기술에\s*의해/.test(eff) && !(LHX(dm) && LHX(dm).fromId && !sameT(ctx().b.mons[LHX(dm).fromId] || {}, dm, ctx().b)))
              continue; /* 11-09 감우: 「상대의 기술에 의해」 빈사만 */
            if (/【자동】/.test(eff) && FX() && FX().autoOf(cur, 'pot', p.name) && !FX().autoOf(cur, 'pot', p.name).manual) {
              if (
                (await fireAuto(
                  x.id,
                  'pot',
                  p.name,
                  Object.assign(
                    { quiet: true, head: `【포텐셜】 ${cur.name} 『${p.name}』【자동】 — ${dm.name} 빈사` },
                    LHX(dm) && LHX(dm).fromId && /대상/.test(eff) ? { pickId: LHX(dm).fromId } : {}
                  )
                )) &&
                left !== null
              ) {
                const uu = Object.assign({}, cur.potUses || {});
                uu[p.name] = left - 1;
                await A().set(['battle', 'mons', x.id, 'potUses'], uu);
              }
            } else notes.push(`${cur.name} 『${p.name}』`);
          }
          const t = (ctx().b.trainers || {})[x.tid];
          if (t && !doneT.has(t.id || x.tid)) {
            doneT.add(t.id || x.tid);
            for (const u of uniqList(t)) {
              if (RE.test(String(u.p.eff || '')) && (u.left === null || u.left > 0)) notes.push(`${t.name} 고유 『${u.p.name}』`);
            }
          }
        }
        /* 11-21 【지원】 · 【지원 (빈사)】 · 【지원 (상위)】: 볼 안(벤치)의 같은 편 포켓몬 — 지원 태그가 붙은 포텐셜만 (그 밖의 포텐셜은 볼 안에선 안 돈다) */
        for (const x of Object.values(ctx().b.mons || {})) {
          if (!x || x.id === dm.id || x.entry || !sameT(x, dm, ctx().b)) continue;
          for (const p0 of potSrc(ctx().b.mons[x.id] || x)) {
            if (!p0 || !p0.name || p0.unique || p0.ph || !supKind(p0.eff)) continue;
            const eff = String(p0.eff || '');
            if (!RE.test(eff)) continue;
            const mm = eff.match(/【(\d+)\/시】/);
            const cur = ctx().b.mons[x.id];
            const u = (cur.potUses || {})[p0.name];
            const left = mm ? (u == null ? +mm[1] : +u) : null;
            if (left !== null && left <= 0) continue;
            if (/상대의\s*기술에\s*의해/.test(eff) && !(LHX(dm) && LHX(dm).fromId && !sameT(ctx().b.mons[LHX(dm).fromId] || {}, dm, ctx().b)))
              continue;
            if (/【자동】/.test(eff) && FX() && FX().autoOf(cur, 'pot', p0.name) && !FX().autoOf(cur, 'pot', p0.name).manual) {
              if (
                (await fireAuto(
                  x.id,
                  'pot',
                  p0.name,
                  Object.assign(
                    { quiet: true, head: `【포텐셜】 ${cur.name}(볼 안) 『${p0.name}』【지원】 — ${dm.name} 빈사` },
                    LHX(dm) && LHX(dm).fromId && /대상/.test(eff) ? { pickId: LHX(dm).fromId } : {}
                  )
                )) &&
                left !== null
              ) {
                const uu = Object.assign({}, cur.potUses || {});
                uu[p0.name] = left - 1;
                await A().set(['battle', 'mons', x.id, 'potUses'], uu);
              }
            } else notes.push(`${cur.name}(볼 안) 『${p0.name}』`);
          }
        }
      }
      if (notes.length)
        A().sysLog(
          `【아군 빈사】 ${neu.map(m => m.name).join(' · ')} — 발동 조건을 만족한 효과\n${[...new Set(notes)].join('\n')}\n(「발동」 버튼으로)`,
          'battle'
        );
    } finally {
      faintBusy = false;
    }
  }
  /* 11-08 망령 「「하늘 위」 상태가 되었을 때 중확률로 「회피 : +1」 한다 — 지금 상시형으로 판정된다. ~ 상태가 되었을 때도 자동화」 (감우):
    필드 위 포켓몬에게 새 상태가 붙는 순간을 본다 — 어느 길로 걸렸든(기술 · 차지(하늘 위 · 땅 속) · 효과 엔진 · 상태 칸을 손으로 고친 것). 그 상태를 계기로 쓰는 특성 · 소지품(2 · 3번 칸 포함) · 포텐셜 · 전용 · 고유를 찾는다.
    주어: 없음 · 「자신이」 = 그 포켓몬 자신 / 「아군이」 = 같은 편 다른 포켓몬 / 「상대가」 · 「적진이」 = 다른 편 (그 포켓몬이 구문의 「1체」 대상). 「독」은 「맹독」도.
    구문이 있으면 그 줄을 (확률을 굴려) 발동, 없으면 확률만 굴려 손으로 할 일을 알린다. 【N/시】 는 【자동】 이 있을 때만 저절로(횟수 −1), 【소진】 · 【탈진】 은 쓴 턴을 적는다 — 이미 못 쓰는 턴이면 넘긴다.
    손으로(알리기만): 「~로 「X」 상태가 되었을 때」(원인 지정) · 「모든 포켓몬이」 · 「「혼령」이」 같은 다른 주어 · 「이번 턴」 · 【선행】 · 【사전】 · 【임의】, ① 이 아닌 줄에 계기가 있는데 줄 고르기(①②) 구문이 아닌 것. 「빈사」는 아군 빈사(faintWatch)가 맡는다 */
  const ST_TRIG_RE = /(?:(자신|아군|상대|적진)(?:의\s*포켓몬|\s*포켓몬)?(?:이|가|은|는)?\s*)?「([^」]+)」\s*상태가\s*(?:되었을|됐을)\s*때/g;
  function stTrigs(tx) {
    const out = [];
    const t = String(tx || '').replace(/<br\s*\/?>/gi, '\n');
    if (!/상태가\s*(?:되었을|됐을)\s*때/.test(t)) return out;
    const tagMan = /【\s*(선행|사전|임의)\s*】/.test(t);
    const cls = t
      .split(/(?=[①②③④⑤⑥⑦⑧⑨⑩])|\n/)
      .map(x => x.trim())
      .filter(Boolean);
    cls.forEach((cl, i) => {
      const re = new RegExp(ST_TRIG_RE.source, 'g');
      let r;
      while ((r = re.exec(cl))) {
        const pre = cl.slice(0, r.index);
        const sts = [];
        for (const w of r[2].split(/[\/,·]/)) {
          for (const k of stEnL(w.trim())) if (k && k !== 'Fainted' && w.trim() !== '빈사' && !sts.includes(k)) sts.push(k);
        }
        /* 11-09 감우: 「예리」 → 예리1 · 예리2 */ if (!sts.length) continue;
        const who = r[1] === '아군' ? 'ally' : r[1] === '상대' || r[1] === '적진' ? 'foe' : 'self';
        const man = tagMan
          ? '선행 · 사전 · 임의 태그'
          : /모든\s*포켓몬이\s*$/.test(pre)
            ? '모든 포켓몬이'
            : /」\s*(?:이|가)\s*$/.test(pre)
              ? '다른 주어'
              : /(?:으로|로|에\s*의해)\s*$/.test(pre)
                ? '원인 지정'
                : /이번\s*턴/.test(cl)
                  ? '이번 턴'
                  : '';
        const no = (cl.match(/^[①②③④⑤⑥⑦⑧⑨⑩]/) || [])[0] || '';
        out.push({ sts, who, man, no, first: i === 0 || no === '①', clause: cl });
      }
    });
    return out;
  }
  const ST_SEEN = {};
  let stBusy = false;
  async function stateWatch() {
    const c = ctx();
    const b = c.b;
    if (!c.mgr || !b || !b.started || !FX()) return;
    const bk = String(b.started);
    const seen = ST_SEEN[bk] || (ST_SEEN[bk] = {});
    const neu = [];
    for (const m of Object.values(b.mons || {})) {
      if (!m || !m.entry || !m.hp || m.hp.cur <= 0) {
        delete seen[m && m.id];
        continue;
      }
      const now = Object.keys(m.states || {}).filter(k => (m.states || {})[k]);
      const old = seen[m.id];
      seen[m.id] = now;
      if (!old) continue; /* 처음 본 포켓몬(막 나온 것)은 지금 상태를 기준으로만 */
      const add = now.filter(k => !old.includes(k));
      if (add.includes('Toxic') && !add.includes('Poison')) add.push('Poison');
      if (add.length) neu.push({ id: m.id, add });
    }
    if (!neu.length || stBusy || !isLeader(c)) return;
    stBusy = true;
    try {
      const K = k => ({ pot: '포텐셜', trait: '특성', item: '소지품', uq: '고유' })[k] || '효과';
      const notes = [];
      for (const ev of neu) {
        const dm = ctx().b.mons[ev.id];
        if (!dm) continue;
        const stK = ev.add.map(k => (FX().stKo ? FX().stKo(k) : k)).join(' · ');
        for (const x0 of Object.values(ctx().b.mons || {})) {
          if (!x0 || !x0.entry || x0.hp.cur <= 0) continue;
          const x = ctx().b.mons[x0.id] || x0;
          const rel = x.id === dm.id ? 'self' : sameT(x, dm, ctx().b) ? 'ally' : 'foe';
          const src = [];
          if (x.ability) src.push(['trait', x.ability, slotEff(x, 'trait', x.ability)]);
          if (!IOFF(x)) {
            if (x.item) src.push(['item', x.item, slotEff(x, 'item', x.item)]);
            for (const q of x.items2 || []) if (q && q.item && q.item !== x.item) src.push(['item', q.item, q.itemEff || '']);
          }
          for (const p of potSrc(x)) if (p && p.name && !p.ph) src.push(['pot', p.name, String(p.eff || ''), p]);
          for (const [kind, name, eff0, p] of src) {
            const au0 = kind === 'item' ? itemAutoDedupe(FX().autoOf(x, kind, name), name) : FX().autoOf(x, kind, name);
            const eff = String(eff0 || (au0 && au0.text) || '');
            const hit = stTrigs(eff).find(g => g.who === rel && g.sts.some(s => ev.add.includes(s)));
            if (!hit) continue;
            const head = `【${K(kind)}】 ${x.name} 『${name}』 — ${dm.name} 「${stK}」 상태가 되었다`;
            let L = null;
            if (kind === 'pot' && p) {
              L = limOf(p, x.potUses || {}, x.potTurn || {});
              if (L.left !== null && L.left <= 0) continue;
            }
            const au = au0 && au0.ops && au0.ops.length && !au0.manual ? au0 : null;
            if (hit.man || !au || limManual(x, kind, name, eff)) {
              notes.push(`${x.name} 『${name}』${hit.man ? ` (${hit.man})` : !au ? '' : ' (【N/시】 — 【자동】 없음)'}`);
              continue;
            }
            let ops = au.ops;
            if (!hit.first) {
              if (ops.length === 1 && ops[0].k === 'choice') {
                const o = (ops[0].opts || []).find(q => q && q.label && String(q.label).trim().startsWith(hit.no));
                if (!o || !(o.ops || []).length) {
                  notes.push(`${x.name} 『${name}』 ${hit.no}`);
                  continue;
                }
                ops = o.ops;
              } else {
                notes.push(`${x.name} 『${name}』 ${hit.no}`);
                continue;
              }
            }
            const ok = await fireAuto(
              x.id,
              kind,
              name,
              Object.assign({ quiet: true, head, auto: Object.assign({}, au, { ops, text: hit.clause }) }, rel !== 'self' ? { pickId: dm.id } : {})
            );
            if (ok && L) {
              const cur = ctx().b.mons[x.id] || x;
              if (L.mmax != null) {
                const u = (cur.potUses || {})[name];
                const had = u == null ? L.mmax : +u;
                await A().set(['battle', 'mons', x.id, 'potUses', name], Math.max(0, had - 1));
              }
              if (L.per) await A().set(['battle', 'mons', x.id, 'potTurn', name], +ctx().b.turn || 0);
              if (L.sup) await A().set(['battle', 'mons', x.id, 'potTurn', '_sup', name], 1);
            }
          }
        }
        /* 고유 (트레이너): 그 트레이너의 필드 포켓몬 하나를 쓰는 이로 — 자신 · 아군 계기는 상태가 된 포켓몬이 그 트레이너 것이면 그 포켓몬 */
        const doneT = new Set();
        for (const x of Object.values(ctx().b.mons || {})) {
          if (!x || !x.entry || x.hp.cur <= 0) continue;
          const t = (ctx().b.trainers || {})[x.tid];
          if (!t || doneT.has(x.tid)) continue;
          doneT.add(x.tid);
          const rel = sameT(x, dm, ctx().b) ? (dm.tid === x.tid ? 'self' : 'ally') : 'foe';
          for (const u of uniqList(t)) {
            const eff = String(u.p.eff || '');
            const hit = stTrigs(eff).find(g => (g.who === rel || (g.who === 'ally' && rel === 'self')) && g.sts.some(s => ev.add.includes(s)));
            if (!hit) continue;
            if (u.left !== null && u.left <= 0) continue;
            const mid = rel === 'foe' ? x.id : dm.tid === x.tid ? dm.id : x.id;
            const au = FX().autoOf(ctx().b.mons[mid] || x, 'pot', u.p.name);
            const auOk = au && au.ops && au.ops.length && !au.manual;
            if (hit.man || !auOk || !hit.first || (u.mmax != null && !/【\s*자동\s*】/.test(eff))) {
              notes.push(`${t.name} 고유 『${u.p.name}』${hit.man ? ` (${hit.man})` : ''}`);
              continue;
            }
            const ok = await fireAuto(
              mid,
              'pot',
              u.p.name,
              Object.assign(
                {
                  quiet: true,
                  head: `【고유】 ${t.name} 『${u.p.name}』 — ${dm.name} 「${stK}」 상태가 되었다`,
                  auto: Object.assign({}, au, { text: hit.clause })
                },
                rel === 'foe' ? { pickId: dm.id } : {}
              )
            );
            if (ok) {
              const tt = (ctx().b.trainers || {})[x.tid] || t;
              if (u.mmax != null) {
                const v = (tt.uUses || {})[u.p.name];
                await A().set(['battle', 'trainers', x.tid, 'uUses', u.p.name], Math.max(0, (v == null ? u.mmax : +v) - 1));
              }
              if (u.per) await A().set(['battle', 'trainers', x.tid, 'uTurn', u.p.name], +ctx().b.turn || 0);
            }
          }
        }
      }
      /* 11-09 감우 54-E: 「상대를 X 상태로 만들었을 때」 — 건 쪽(stFrom) 기준 */ for (const ev of neu) {
        const dm = ctx().b.mons[ev.id];
        if (!dm) continue;
        for (const k of ev.add) {
          const by = (dm.stFrom || {})[k];
          if (by && by !== dm.id) EVQ.push(['made', { by, tgt: dm.id, sts: [k], key: dm.id + ':' + k }]);
        }
      }
      if (notes.length)
        A().sysLog(
          `【상태 계기】 ${neu
            .map(e => {
              const m = ctx().b.mons[e.id];
              return (
                (m ? m.name : '') +
                ' 「' +
                e.add
                  .filter(k => !(k === 'Poison' && e.add.includes('Toxic')))
                  .map(k => (FX().stKo ? FX().stKo(k) : k))
                  .join(' · ') +
                '」'
              );
            })
            .join(' / ')} — 발동 조건을 만족한 효과 (손으로 · 「발동」 버튼으로)\n${[...new Set(notes)].join('\n')}`,
          'battle',
          { gmPriv: 1 }
        );
    } finally {
      stBusy = false;
    }
    if (EVQ.length) setTimeout(() => evFlush().catch(e => console.warn('evFlush', e)), 300);
  }
  /* ===== 11-09 감우 54-G 「준비」 (망령 「준비 시에 조건이 안 맞으면 경고 뜨게 해. 조건이 맞으면 맞는 대로 발동 띄우고.」) =====
    시합 개시 때 양쪽 트레이너의 PT(필드 + 벤치) 포켓몬 포텐셜 · 전용 · 트레이너 고유의 【준비】 줄을 읽는다.
    · 조건 줄 (PT에 X 이외가 있다면 발동할 수 없다 · PT에 X를 N체 참여시키지 않았을 때 무효화 · PT에 X가 N체 참여했을 때 발동할 수 있다 · PT에 X를 참여시킬 수 없다 · X가 N체 이상 있을 경우)
      → 안 맞으면 경고(로그 + 창) 하고 그 포텐셜을 이번 배틀 동안 무효(m.potOff / 트레이너 potOff) — 발동 · 등장 자동 · 기능 확장에서 빠진다. 맞으면 구문이 있으면 발동, 없으면 「충족」 안내.
    · 허용 줄 (소지품 중복 · 추가 착용 · 소켓 · 교체 · 변환 · 기술 고르기) → 제작기(팀 짜기) 규칙 — 「적용됨」 확인만. 「「A」「B」「C」 중 하나를 고른다 … 기능 확장」은 여기서 고르게 한다 (청파삼형) */
  function prepClauses(eff) {
    const t = String(eff || '').replace(/<br\s*\/?>/gi, '\n');
    if (!/【\s*준비\s*】/.test(t)) return [];
    return t
      .split(/(?=[①②③④⑤⑥])|\n/)
      .map(x => x.trim())
      .filter(x => /【\s*준비\s*】/.test(x));
  }
  /* 11-23 망령 「상대 PT에 【프라이드 : EX】가 있을 때」: foes = 상대 편 파티 (prepCheck 가 넘긴다) */
  function prepEval(cl, party, foes) {
    const tyOf2 = m => tysOf(m);
    const T = s =>
      s
        .split(/[,·\/]/)
        .map(x => S().typeEn(x.trim()))
        .filter(Boolean);
    const hasIt = (m, n) =>
      [m.item, ...(m.items2 || []).map(x => x && x.item)].some(x => String(x || '').replace(/[『』\s]/g, '') === String(n).replace(/[『』\s]/g, ''));
    let r;
    if ((r = cl.match(/PT에\s*「타입\s*:\s*([^」]+)」\s*이외가\s*있다면/))) {
      const w = T(r[1]);
      const bad = party.filter(m => !tyOf2(m).some(t => w.includes(t)));
      return {
        cond: 1,
        ok: !bad.length,
        why: bad.length ? `PT에 「타입 : ${r[1]}」 이외가 있다 (${bad.map(m => m.name).join(' · ')})` : `PT 전원이 「타입 : ${r[1]}」`
      };
    }
    if ((r = cl.match(/PT에\s*「소지품\s*:\s*([^」]+)」\s*(?:을|를)?\s*(\d+)\s*체\s*참여시키지\s*않았을\s*때/))) {
      const n = party.filter(m => hasIt(m, r[1])).length;
      return { cond: 1, ok: n >= +r[2], why: `「소지품 : ${r[1]}」 ${n}/${r[2]}체` };
    }
    if ((r = cl.match(/PT에\s*「타입\s*:\s*([^」]+)」\s*(?:이|가|을|를)?\s*(\d+)\s*체\s*(?:이상\s*)?참여(?:했을|하였을|시켰을)\s*때/))) {
      const w = T(r[1]);
      const n = party.filter(m => tyOf2(m).some(t => w.includes(t))).length;
      return { cond: 1, ok: n >= +r[2], why: `「타입 : ${r[1]}」 ${n}/${r[2]}체` };
    }
    if ((r = cl.match(/PT에\s*「타입\s*:\s*([^」]+)」\s*(?:을|를)?\s*참여시킬\s*수\s*없다/))) {
      const w = T(r[1]);
      const bad = party.filter(m => tyOf2(m).some(t => w.includes(t)));
      return {
        cond: 1,
        ok: !bad.length,
        why: bad.length ? `PT에 「타입 : ${r[1]}」이(가) 있다 (${bad.map(m => m.name).join(' · ')})` : `PT에 「타입 : ${r[1]}」 없음`
      };
    }
    if ((r = cl.match(/「타입\s*:\s*([^」]+)」\s*(?:이|가)\s*(\d+)\s*체\s*이상\s*있을\s*경우/))) {
      const w = T(r[1]);
      const n = party.filter(m => tyOf2(m).some(t => w.includes(t))).length;
      return { cond: 1, ok: n >= +r[2], soft: 1, why: `「타입 : ${r[1]}」 ${n}/${r[2]}체` };
    }
    if (
      (r = cl.match(/(상대\s*)?(?:PT|파티)에\s*【\s*프라이드\s*[:：]\s*([^】]+?)\s*】\s*(?:이|가)\s*(?:있을|있다면|있는|있으면)/)) &&
      FX() &&
      FX().priOk
    ) {
      const L = r[1] ? foes || [] : party;
      const hit = L.filter(m => FX().priOk(m, r[2]));
      return {
        cond: 1,
        ok: hit.length > 0,
        why: hit.length
          ? `${r[1] ? '상대 ' : ''}PT에 【프라이드 : ${r[2]}】 — ${hit.map(m => m.name).join(' · ')}`
          : `${r[1] ? '상대 ' : ''}PT에 【프라이드 : ${r[2]}】 없음`
      };
    }
    if ((r = cl.match(/「([^」]+)」\s*「([^」]+)」\s*「([^」]+)」\s*중\s*하나를\s*고른다/))) return { pick: [r[1], r[2], r[3]] };
    return { allow: 1 };
  }
  async function prepCheck() {
    const c = ctx();
    if (!c.mgr || !FX()) return;
    const b = c.b;
    const W = [],
      OK = [],
      AL = [],
      PK = [],
      FP = [];
    for (const tid of Object.keys(b.trainers || {})) {
      const t = b.trainers[tid];
      if (!t) continue;
      const party = Object.values(b.mons || {}).filter(m => m && m.tid === tid);
      if (!party.length) continue;
      const items = [];
      for (const m of party) for (const p of potSrc(m)) items.push({ own: m, p, uq: false });
      for (const u of t.unique || []) if (u && u.name) items.push({ own: party.find(m => m.entry) || party[0], p: u, uq: true });
      for (const it of items) {
        const cls = prepClauses(it.p.eff);
        if (!cls.length) continue;
        const who = it.uq ? `${t.name} 고유` : it.own.name;
        const nm = String(it.p.name || '')
          .replace(/[『』]/g, '')
          .trim();
        for (const cl of cls) {
          if (!it.uq && FORM_PICK_RE.test(cl)) {
            FP.push({ own: it.own, nm });
            continue;
          }
          const r = prepEval(
            cl,
            party,
            Object.values(b.mons || {}).filter(m => m && m.tid !== tid && !sameT(m, party[0], b))
          );
          if (r.pick) {
            PK.push({ tid, t, nm, opts: r.pick, cl });
            continue;
          }
          if (r.allow) {
            AL.push(`${who} 『${nm}』 — ${cl.replace(/^[①-⑥]?\s*【\s*준비\s*】\s*\/?\s*/, '').slice(0, 80)}`);
            continue;
          }
          if (!r.ok && !r.soft) {
            W.push(`⚠ ${who} 『${nm}』 — 조건 불충족: ${r.why}`);
            if (it.uq) await A().set(['battle', 'trainers', tid, 'potOff', nm], r.why);
            else await A().set(['battle', 'mons', it.own.id, 'potOff', nm], r.why);
          } else if (!r.ok) {
            W.push(`⚠ ${who} 『${nm}』 — 조건 불충족 (그 효과만 없음): ${r.why}`);
          } else {
            OK.push({ it, who, nm, why: r.why });
          }
        }
      }
    }
    /* 맞은 것: 구문이 있으면 발동 (【N/시】 는 손으로), 없으면 안내 */
    const okL = [];
    for (const x of OK) {
      const m = ctx().b.mons[x.it.own.id];
      const a = m && FX().autoOf(m, 'pot', x.nm);
      if (a && realOps(a) && !a.manual && !limManual(m, 'pot', x.nm, x.it.p.eff) && m.entry) {
        const ok = await fireAuto(
          m.id,
          'pot',
          x.nm,
          Object.assign({ quiet: true, noEv: 1, head: `【준비】 ${x.who} 『${x.nm}』 — 조건 충족 (${x.why}) · 발동` }, x.it.uq ? { uq: 1 } : {})
        );
        okL.push(`✔ ${x.who} 『${x.nm}』 — ${x.why}${ok ? ' · 발동' : ''}`);
      } else okL.push(`✔ ${x.who} 『${x.nm}』 — 조건 충족: ${x.why}${a && realOps(a) ? '' : ' (효과는 손으로 · 「발동」)'}`);
    }
    /* 「셋 중 하나를 고른다」 → 기능 확장 (트레이너 · 시합 중) */
    for (const x of PK) {
      const already = (x.t.ext || []).some(e => e && x.opts.includes(e.mv));
      if (already) continue;
      const idx = await new Promise(res => {
        const md = A().openModal(
          `<div class="mhead"><h2>【준비】 ${esc(x.t.name)} 『${esc(x.nm)}』</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="small dim" style="margin-bottom:8px">${esc(x.cl.slice(0, 160))}</div><div class="row" style="gap:6px;flex-wrap:wrap">${x.opts.map((o, i) => `<button class="btn pri" data-pk="${i}">${esc(o)}</button>`).join('')}</div>`
        );
        md.addEventListener('click', e => {
          const bt = e.target.closest('[data-pk],[data-x]');
          if (!bt) return;
          const v = bt.dataset.pk;
          A().closeModal();
          res(v == null ? -1 : +v);
        });
      });
      if (idx < 0) continue;
      const ext = ((ctx().b.trainers || {})[x.tid] || {}).ext || [];
      await A().set(['battle', 'trainers', x.tid, 'ext'], ext.concat([{ mv: x.opts[idx], src: x.nm, kind: 'act', lim: 0 }]));
      okL.push(`✔ ${x.t.name} 『${x.nm}』 — 「${x.opts[idx]}」를 기능 확장으로 (시합 중)`);
    }
    for (const x of FP) {
      const m = ctx().b.mons[x.own.id];
      if (!m) continue;
      if (m.tatsu) {
        okL.push(`✔ ${m.name} 『${x.nm}』 — 싸리용 ${m.tatsu} 폼 (이미 정함)`);
        continue;
      }
      const z = await tatsuPick(m, `【준비】 ${m.name} 『${x.nm}』 — 입 안의 싸리용 폼`);
      okL.push(
        z
          ? z.none
            ? `✔ ${m.name} 『${x.nm}』 — 싸리용 없음`
            : `✔ ${m.name} 『${x.nm}』 — 싸리용 ${z.f} 폼 (${z.st})`
          : `✔ ${m.name} 『${x.nm}』 — 폼을 고르지 않음 (기술을 맞힐 때 다시 묻는다)`
      );
    }
    if (!W.length && !okL.length && !AL.length) return;
    A().sysLog(
      `【준비】 시합 개시 — PT 조건 검사\n${[...W, ...okL].join('\n')}${AL.length ? '\n· 제작기 규칙(적용됨 확인): ' + AL.length + '건\n' + AL.map(x => '  ' + x).join('\n') : ''}`,
      'battle',
      W.length ? {} : { gmPriv: 1 }
    );
    if (W.length)
      A().openModal(
        `<div class="mhead"><h2>【준비】 조건 불충족</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="small" style="white-space:pre-wrap">${esc(W.join('\n'))}</div><div class="small dim" style="margin-top:8px">이 포텐셜은 이번 배틀 동안 발동하지 않는다 (카드 「발동」은 막히고, 강제 발동은 된다).</div>`
      );
  }
  /* 무효(준비 조건 불충족)인가 */
  /* 11-23 저녁 감우 256 (애디포시어 『이노센트』 「필드 위에 있는 한 중확률로 상대의 【함성】을 무효화한다」): 쓰러뜨린 쪽(k)의 상대 편 필드에 그 글을 가진 포켓몬이 살아 있으면 확률을 굴려, 맞으면 이번 【함성】 계기를 통째로 건너뛴다 (확률 글이 없으면 반드시). 쓰러진 포켓몬 자신은 필드 위가 아니라 세지 않는다 */
  const SHOUT_NULL_RE = /상대의\s*【\s*함성\s*】\s*(?:을|를)\s*무효화/;
  function shoutNull(k, b) {
    try {
      for (const x of Object.values((b && b.mons) || {})) {
        if (!x || !x.entry || !x.hp || x.hp.cur <= 0 || sameT(x, k, b)) continue;
        const src = [...(x.ability ? [{ name: x.ability, eff: slotEff(x, 'trait', x.ability), tr: 1 }] : []), ...potSrc(x)];
        for (const p of src) {
          const t = String((p && p.eff) || '');
          if (!SHOUT_NULL_RE.test(t)) continue;
          if (!p.tr && potOffWhy(x, p.name)) continue;
          const cl = t.split(/\n|(?=[①②③④⑤])/).find(l => SHOUT_NULL_RE.test(l)) || t;
          const pc = (FX() && FX().rmChance ? FX().rmChance(null, cl) : 0) || 100;
          const hit = Math.random() * 100 < pc;
          A().sysLog(
            `【${p.tr ? '특성' : '포텐셜'}】 ${x.name} ${p.tr ? '「' + p.name + '」' : '『' + String(p.name).replace(/[『』]/g, '') + '』'} — ${k.name}의 【함성】 ${hit ? '무효' : '무효화 실패'}${pc < 100 ? ' (' + pc + '%)' : ''}`,
            'battle'
          );
          if (hit) return true;
        }
      }
    } catch (e) {
      console.warn('함성 무효', e);
    }
    return false;
  }
  /* 11-23 저녁 감우 256 (헬레나 『황제모의 위광』 「「조이기」 상태인 포켓몬의 『특권』이 발동하지 않는다」): 필드 위(양쪽)에 그 글을 가진 포켓몬이 살아 있고 m 이 그 상태면, m 의 『특권』 포텐셜(종류 · 이름에 「특권」)은 꺼진 것으로 본다 */
  const PRIV_OFF_RE = /「([^」:]+)」\s*상태인\s*포켓몬의\s*『\s*특권\s*』\s*(?:이|은)\s*발동하지\s*않는다/;
  function privOffWhy(m, nm) {
    try {
      const p = potSrc(m, 1).find(
        q =>
          q &&
          String(q.name || '')
            .replace(/[『』]/g, '')
            .trim() === nm
      );
      if (!p || !(/특권/.test(String(p.kind || '')) || /특권/.test(nm))) return '';
      const b = ctx().b || {};
      for (const x of Object.values(b.mons || {})) {
        if (!x || !x.entry || !x.hp || x.hp.cur <= 0) continue;
        for (const q of potSrc(x)) {
          const r = String((q && q.eff) || '').match(PRIV_OFF_RE);
          if (!r) continue;
          const k = FX() && FX().stEn ? FX().stEn(r[1].trim()) : '';
          if (k && (m.states || {})[k])
            return `${x.name} 『${String(q.name).replace(/[『』]/g, '')}』 — 「${r[1].trim()}」 상태라 『특권』이 발동하지 않는다`;
        }
      }
    } catch (e) {}
    return '';
  }
  /* 11-23 저녁 감우 257b 망령 「잠꼬대 타르티니 자동화」: 「잠꼬대」를 적용하면(잠듦 상태일 때만) 자기 기술 중 하나를 무작위로 골라 그 기술의 공격 창을 연다 — 「잠꼬대」 자신 · 발버둥 · 봉인된 기술은 빼고.
    「「잠꼬대」가 「소리」 기술이 아닌 기술을 선택하지 않게 된다」(타르티니 『악마의 트릴』 ②)가 있으면 그 태그 기술 중에서만 */
  const STALK_ONLY_RE = /「잠꼬대」\s*(?:가|는|이)\s*「([^」:]+)」\s*기술이\s*아닌\s*기술을\s*선택하지\s*않/;
  /* 11-23 21:32 망령 「주세페 자동화는 해뒀지?」 — 『제 3의 음』 「【1/시】【자동】/아군 전체가 「소리」기술로 같은 대상을 공격했을 때 대상이 내보내는 기술을 「소리」 기술로 만든다」:
    공격 기술을 낼 때마다 그 턴에 태그별로 누구를 쳤는지 적고(m.tagHit={t,h:{태그:[mid]}}), 필드에 살아 있는 같은 편 전원이 이번 턴 그 태그 기술로 친 공통 대상에게 m.treatX=[{tag,by,src}] 를 붙인다 —
    treatOf 가 그 포켓몬의 모든 기술에 그 태그를 붙인다. 대상이 필드를 떠나면(outReset) 사라진다(감우가 정한 기간) · 【N/시】 는 limOf 로 깎는다 */
  const THIRD_RE =
    /아군\s*전체가\s*「([^」]+)」\s*기술로\s*같은\s*대상을\s*공격했을\s*때\s*,?\s*대상이\s*내보내는\s*기술을\s*「([^」]+)」\s*기술로\s*만든다/;
  async function thirdToneAfter(mid, R) {
    try {
      if (!R || R.check || !R.mv || R.mv.cat === '변화') return;
      const b = ctx().b;
      const a = (b.mons || {})[mid];
      if (!a) return;
      const T = +b.turn || 0;
      const tg = (R.targets || []).map(r => r && r.def && r.def.id).filter(id => id && id !== mid);
      if (!tg.length) return;
      const tags = String(R.mv.tag || '')
        .split(/[,\/·\s#]+/)
        .map(x => x.trim())
        .filter(x => x && x !== '-');
      if (!tags.length) return;
      const prev = a.tagHit && +a.tagHit.t === T ? a.tagHit : { t: T, h: {} };
      const h = Object.assign({}, prev.h || {});
      for (const w of tags) h[w] = [...new Set([...(h[w] || []), ...tg])];
      await A().set(['battle', 'mons', mid, 'tagHit'], { t: T, h });
      const b1 = ctx().b;
      const on = x => !!(x && x.entry && x.hp && x.hp.cur > 0);
      for (const m of Object.values(b1.mons || {})) {
        if (!on(m) || !sameT(m, a, b1)) continue;
        for (const p of potSrc(m)) {
          const x = String((p && p.eff) || '')
            .replace(/<br\s*\/?>/g, '\n')
            .match(THIRD_RE);
          if (!x || p.ph || !potLive(m, p)) continue;
          const w = x[1].trim(),
            give = x[2].trim();
          if (!tags.includes(w)) continue;
          const L = limOf(p, m.potUses || {}, m.potTurn || {});
          if (L.left !== null && L.left <= 0) continue;
          const team = Object.values(b1.mons).filter(y => on(y) && sameT(y, m, b1));
          let common = null;
          for (const y of team) {
            const th = y.id === mid ? { t: T, h } : y.tagHit;
            const l = (th && +th.t === T && th.h && th.h[w]) || [];
            common = common === null ? l.slice() : common.filter(id => l.includes(id));
          }
          common = (common || []).filter(id => {
            const d = b1.mons[id];
            return on(d) && !sameT(d, m, b1) && !(d.treatX || []).some(z => z && z.tag === give);
          });
          if (!common.length) continue;
          const pn = String(p.name).replace(/[『』]/g, '');
          for (const id of common) {
            const d = b1.mons[id];
            await A().set(['battle', 'mons', id, 'treatX'], [...(d.treatX || []), { tag: give, by: m.name, src: pn }]);
          }
          if (L.mmax != null) {
            const u = (m.potUses || {})[p.name];
            await A().set(['battle', 'mons', m.id, 'potUses', p.name], Math.max(0, (u == null ? L.mmax : +u) - 1));
          }
          if (L.per) await A().set(['battle', 'mons', m.id, 'potTurn', p.name], T);
          if (L.sup) await A().set(['battle', 'mons', m.id, 'potTurn', '_sup', p.name], 1);
          const nmS = common.map(id => b1.mons[id].name).join(' · ');
          A().sysLog(
            `【포텐셜】 ${m.name} 『${pn}』 — 아군 전체가 「${w}」 기술로 ${nmS}을(를) 공격했다 · ${nmS}이(가) 내보내는 기술은 「${give}」 기술이 된다 (필드에 있는 동안)`,
            'battle',
            { mid: m.id, img: m.image || '' }
          );
          break;
        }
      }
    } catch (e) {
      console.warn('thirdTone', e);
    }
  }
  /* 11-23 21:41 망령 「【준비】/입안에 든 「싸리용」의 「폼」을 정할 수 있다 — 이거는?」:
    ① 그 글의 포텐셜(FORM_PICK_RE) — 시합 개시 PT 검사(prepCheck) 때 폼을 고르게 해 m.tatsu 에 적는다(배틀 내내).
    ② 기술 글 「입 안에 든 「싸리용」의 「폼」에 따라 정해진 능력치+N. (노랑 : 스피드, 빨강 : 방어, 주황 : 공격)」(한판내기) — 맞히면 m.tatsu 폼의 능력치 +N. 폼이 안 정해져 있으면 그때 묻고 적어 둔다 */
  const FORM_PICK_RE = /입\s*안에\s*든\s*「\s*싸리용\s*」\s*의\s*「\s*폼\s*」\s*(?:을|를)\s*정할\s*수\s*있다/;
  const ORDERUP_RE = /입\s*안에\s*든\s*「\s*싸리용\s*」\s*의\s*「\s*폼\s*」\s*에\s*따라\s*정해진\s*능력치\s*\+\s*(\d)[^(（]*[(（]([^)）]+)[)）]/;
  function tatsuForms(m) {
    let n = 1,
      L = [];
    try {
      for (const mv of m.moves || []) {
        const x = String((mv && mv.eff) || '').match(ORDERUP_RE);
        if (!x) continue;
        n = +x[1] || 1;
        L = x[2]
          .split(/[,，]/)
          .map(z => {
            const q = z.split(/[:：]/);
            return { f: (q[0] || '').trim(), st: (q[1] || '').trim() };
          })
          .filter(z => z.f && z.st);
        break;
      }
    } catch (e) {}
    if (!L.length)
      L = [
        { f: '노랑', st: '스피드' },
        { f: '빨강', st: '방어' },
        { f: '주황', st: '공격' }
      ];
    return { n, L };
  }
  async function tatsuPick(m, title) {
    const b = ctx().b;
    const F = tatsuForms(m);
    let r = null;
    try {
      r = await uiCtx(b, m, title || '싸리용의 폼').choose([...F.L.map(z => `${z.f} (${z.st})`), '없음']);
    } catch (e) {}
    if (!Array.isArray(r) || !r.length) return null;
    if (+r[0] === F.L.length) {
      await A().set(['battle', 'mons', m.id, 'tatsu'], '없음');
      return { f: '없음', st: '', none: 1 };
    }
    const z = F.L[+r[0]];
    if (!z) return null;
    await A().set(['battle', 'mons', m.id, 'tatsu'], z.f);
    return z;
  } /* 11-23 21:45 망령 「없음도 고를 수 있지?」: 「없음」 = 입 안에 싸리용이 없다 — 능력치를 올리지 않고 다시 묻지도 않는다 */
  async function orderUpAfter(mid, R) {
    try {
      if (!R || R.check || !R.mv) return;
      const x = String(R.mv.eff || '').match(ORDERUP_RE);
      if (!x) return;
      if (!(R.targets || []).some(r => r && r.acc && r.acc.hit)) return;
      const b = ctx().b;
      const m = (b.mons || {})[mid];
      if (!m || !m.entry || !(m.hp && m.hp.cur > 0)) return;
      const F = tatsuForms(m);
      if (m.tatsu === '없음') {
        A().sysLog(`【기술】 ${m.name} 『${R.mv.name}』 — 입 안에 「싸리용」이 없어 능력치 변화 없음`, 'battle', { mid });
        return;
      }
      let z = F.L.find(q => q.f === m.tatsu);
      if (!z) z = await tatsuPick(m, R.mv.name + ' — 입 안의 싸리용 폼');
      if (!z) {
        A().sysLog(`【기술】 ${m.name} 『${R.mv.name}』 — 싸리용의 폼을 고르지 않아 능력치는 손으로`, 'battle', { mid });
        return;
      }
      if (z.none) {
        A().sysLog(`【기술】 ${m.name} 『${R.mv.name}』 — 입 안에 「싸리용」이 없어 능력치 변화 없음`, 'battle', { mid });
        return;
      }
      const ops = (FX().parse(`랭크 자신 ${z.st}+${F.n}`) || {}).ops || [];
      if (!ops.length) return;
      await fireAuto(mid, 'move', R.mv.name, {
        auto: { name: R.mv.name, src: 'dyn', ops, text: '' },
        quiet: true,
        noRoll: true,
        force: true,
        noEv: 1,
        head: `【기술】 ${m.name} 『${R.mv.name}』 — 입 안의 「싸리용」 ${z.f} 폼 · 「${z.st} : +${F.n}」`
      });
    } catch (e) {
      console.warn('orderUp', e);
    }
  }
  async function sleepTalkAfter(mid, R) {
    try {
      if (!R || R.check || !R.mv || String(R.mv.name || '').replace(/\s/g, '') !== '잠꼬대') return;
      const b = ctx().b;
      const m = b.mons[mid];
      if (!m || !m.entry || !(m.hp && m.hp.cur > 0)) return;
      const sk = stKeyOf('잠듦') || (FX() && FX().stEn ? FX().stEn('잠듦') : '');
      if (!sk || !(m.states || {})[sk]) {
        A().sysLog(`【잠꼬대】 ${m.name} — 「잠듦」 상태가 아니라 실패`, 'battle', { mid });
        return;
      }
      let only = '',
        src = '';
      for (const p of potSrc(m)) {
        const r = String((p && p.eff) || '').match(STALK_ONLY_RE);
        if (r && !potOffWhy(m, p.name)) {
          only = r[1].trim();
          src = String(p.name).replace(/[『』]/g, '');
          break;
        }
      }
      let pool = MVS(m).filter(x => x && x.name && !x.virt && x.name !== '발버둥' && String(x.name).replace(/\s/g, '') !== '잠꼬대' && !sealed(m, x));
      if (only) pool = pool.filter(x => mvTagHit(x, only));
      if (!pool.length) {
        A().sysLog(`【잠꼬대】 ${m.name} — 고를 수 있는 기술이 없어 실패${only ? ` (『${src}』 — 「${only}」 기술만)` : ''}`, 'battle', { mid });
        return;
      }
      const pick = pool[Math.floor(Math.random() * pool.length)];
      A().sysLog(
        `【잠꼬대】 ${m.name} — 「${pick.name}」 (${pool.map(x => x.name).join(' · ')} 중 무작위${only ? ` · 『${src}』 — 「${only}」 기술만` : ''})`,
        'battle',
        { mid, img: m.image || '' }
      );
      setTimeout(() => {
        try {
          openAttack(mid, { mvName: pick.name, by: '잠꼬대', rangeDone: 1, skipSt: 'Sleep' });
        } catch (e) {
          console.warn('잠꼬대', e);
        }
      }, 700);
    } catch (e) {
      console.warn('잠꼬대', e);
    }
  }
  /* 11-23 저녁 감우 257b 망령 「크로노스 자동화」(『C.R.O.N.O.S』 「【1/시】/『계약의 특권』이 부여되어 있을 때 트레이너가 「타임」을 사용할 수 있다」): 그 글을 가진 포켓몬이 필드에 살아 있고 『X』(이름에 X 가 든 포텐셜)를 지니고 있으면 그 트레이너의 「타임」 횟수 +1 (포켓몬마다 한 번) */
  const TIME_GRANT_RE = /(?:『\s*([^』]+?)\s*』\s*(?:이|가)\s*부여되어\s*있을\s*때\s*)?트레이너가\s*「타임」\s*(?:을|를)\s*사용할\s*수\s*있다/;
  function timeGrant(m) {
    try {
      for (const p of potSrc(m)) {
        if (!p || p.ph) continue;
        const r = String(p.eff || '').match(TIME_GRANT_RE);
        if (!r || potOffWhy(m, p.name)) continue;
        if (r[1]) {
          const w = r[1].replace(/\s/g, '');
          if (
            !potSrc(m, 1).some(
              q =>
                q &&
                !q.ph &&
                q !== p &&
                String(q.name || '')
                  .replace(/[『』\s]/g, '')
                  .includes(w) &&
                !potOffWhy(m, q.name)
            )
          )
            continue;
        }
        return true;
      }
    } catch (e) {}
    return false;
  }
  /* 11-23 저녁 감우 257b 망령 「퀄러는 공용 포텐셜 아닌가?」(역할 『퀄러』 「①【지연 (2턴)】/발동한 뒤 필드 위에 있는 한 적진의 『에이스』를 무효화한다 ②【등장 (죽어내밀기)】/①의 【지연】을 생략하고 즉시 발동한다」):
    발동하면 fx.js 가 그 포켓몬에 rnull[역할]=포텐셜 이름 을 적고 상대 필드의 그 역할 효과를 뗀다. 그 뒤로는 그 포켓몬이 필드에 살아 있는 동안 상대 편의 그 역할 포텐셜이 꺼진 것으로(potOffWhy) — 새로 나오는 상대도 등장 자동이 안 걸린다.
    roleNullWatch: 무효가 풀리면(퀄러가 떠남 · 빈사) rnOff 표시가 있던 포켓몬의 역할을 다시 건다 */
  function roleNullBy(b, m, nm) {
    try {
      const q = String(nm || '').replace(/[『』\s]/g, '');
      for (const x of Object.values((b && b.mons) || {})) {
        if (!x || x.id === m.id || !x.entry || !x.hp || !(x.hp.cur > 0) || !x.rnull || sameT(x, m, b)) continue;
        for (const k in x.rnull) if (String(k).replace(/[『』\s]/g, '') === q && x.rnull[k]) return { x, by: String(x.rnull[k]) };
      }
    } catch (e) {}
    return null;
  }
  function roleNullWhy(m, nm) {
    const r = roleNullBy(ctx().b || {}, m, nm);
    return r ? `${r.x.name} 『${r.by.replace(/[『』]/g, '')}』 — 적진의 『${String(nm).replace(/[『』]/g, '')}』 무효` : '';
  }
  let RNBUSY = false;
  async function roleNullWatch() {
    const c = ctx();
    const b = c.b;
    if (!c.mgr || !b || !b.started || RNBUSY || !FX()) return;
    if (!isLeader(c)) return;
    const any = Object.values(b.mons || {}).some(m => m && ((m.entry && m.rnull) || m.rnOff));
    if (!any) return;
    RNBUSY = true;
    try {
      for (const m0 of Object.values(b.mons || {})) {
        if (!m0 || !m0.entry || !(m0.hp && m0.hp.cur > 0)) continue;
        const roles = new Set(Object.keys(m0.rnOff || {}));
        for (const x of Object.values(b.mons || {}))
          if (x && x.entry && x.rnull && x.hp && x.hp.cur > 0 && !sameT(x, m0, b)) for (const k in x.rnull) roles.add(k);
        for (const R of roles) {
          const has = potSrc(m0, 1).some(p => p && !p.ph && String(p.name || '').replace(/[『』\s]/g, '') === String(R).replace(/[『』\s]/g, ''));
          if (!has) continue;
          const cur = ctx().b.mons[m0.id];
          if (!cur || !cur.entry) break;
          const on = !!roleNullBy(ctx().b, cur, R);
          const mark = !!(cur.rnOff || {})[R];
          if (on && !mark) {
            const nb0 = snap(),
              nb = snap(nb0);
            const y = nb.mons[cur.id];
            if (FX().removeByName) FX().removeByName(y, R);
            y.rnOff = Object.assign({}, y.rnOff || {});
            y.rnOff[R] = 1;
            if (await saveBattle(nb0, nb)) A().sysLog(`【역할 무효】 ${cur.name} 『${R}』 — ${roleNullWhy(cur, R)}`, 'battle', { mid: cur.id });
          } else if (!on && mark) {
            const d = Object.assign({}, cur.rnOff || {});
            delete d[R];
            await A().set(['battle', 'mons', cur.id, 'rnOff'], Object.keys(d).length ? d : null);
            A().sysLog(`【역할 무효】 ${cur.name} 『${R}』 — 무효가 풀려 다시 유효`, 'battle', { mid: cur.id });
            try {
              await fireAuto(cur.id, 'pot', R, { quiet: true, head: `【포텐셜】 ${cur.name} 『${R}』 — 다시 발동` });
            } catch (e) {
              console.warn(e);
            }
          }
        }
      }
    } finally {
      RNBUSY = false;
    }
  }
  function potOffWhy(m, name) {
    const nm = String(name || '')
      .replace(/[『』]/g, '')
      .trim();
    if (!m) return '';
    const a = (m.potOff || {})[nm];
    if (a) return a;
    const t = ((ctx().b || {}).trainers || {})[m.tid];
    const o = ((t && t.potOff) || {})[nm];
    if (o) return o;
    /* 11-21 【지원】: 필드 위(볼 밖)에선 꺼짐 · 【지원 (상위)】만 필드에서도 */ const p = potSrc(m, 1).find(
      q =>
        q &&
        String(q.name || '')
          .replace(/[『』]/g, '')
          .trim() === nm
    );
    if (p && !supLive(m, p)) {
      const k = supKind(p.eff);
      return k === 'up'
        ? '빈사라 【지원 (상위)】가 작동하지 않는다'
        : m.entry && m.hp && m.hp.cur > 0
          ? '【지원】은 볼 안에서만 — 필드 위에선 작동하지 않는다'
          : '빈사라 【지원】이 작동하지 않는다';
    }
    return phaseOffWhy(m, p) || privOffWhy(m, nm) || roleNullWhy(m, nm);
  }
  /* 11-28 망령 「페이즈 체인지 : 1 은 페이즈 체인지가 한 번 발동한 이후, 2 는 2번, 3 은 3번 발동한 이후에 켤 수 있다」:
     【페이즈 체인지 : N】 태그가 붙은 포텐셜 · 전용은 그 포켓몬의 「트리거 : 페이즈 체인지」가 N 번 일어나기 전엔 꺼져 있다 (m.raid.phase 는 1 에서 시작해 한 번마다 +1) */
  function phaseOffWhy(m, p) {
    const t = String((p && p.eff) || '').match(/【\s*페이즈\s*체인지\s*[:：]\s*(\d+)\s*】/);
    if (!t) return '';
    const need = +t[1],
      have = m && m.raid ? Math.max(0, (+m.raid.phase || 1) - 1) : 0;
    return have >= need ? '' : `【페이즈 체인지 : ${need}】 — 페이즈 체인지 ${need}번 뒤부터 (지금 ${have}번)`;
  }
  /* 11-28 「트리거 : 페이즈 체인지」가 일어난 뒤(턴 종료 · 수동): ① 이번에 막 켜진(【페이즈 체인지 : N】 = 지금 횟수) 상시 포텐셜을 건다
     ② 「「트리거 : 페이즈 체인지」가 발동했을 때」 글이 있는 켜진 포텐셜 · 전용은 바로 발동(11-28 망령 「자동으로 되게」) (레이드 배틀 ③ ④ 는 raidPhase 가 이미 처리) */
  const PC_TRIG = /「?\s*트리거\s*[:：]\s*페이즈\s*체인지\s*」?\s*(?:가|이)?\s*발동(?:했을|하였을|할)\s*때/;
  async function phaseReact(mids) {
    const c = ctx();
    if (!c.mgr || !FX()) return;
    for (const mid of mids || []) {
      const m = (c.b.mons || {})[mid];
      if (!m || !m.raid || !(m.hp && m.hp.cur > 0)) continue;
      const have = Math.max(0, (+m.raid.phase || 1) - 1);
      const fresh = [],
        trig = [];
      for (const p of potSrc(m, 1)) {
        if (!p || !p.name || /레이드\s*배틀/.test(p.name) || potOffWhy(m, p.name)) continue;
        const tg = String(p.eff || '').match(/【\s*페이즈\s*체인지\s*[:：]\s*(\d+)\s*】/);
        if (PC_TRIG.test(String(p.eff || ''))) trig.push(p);
        else if (tg && +tg[1] === have) fresh.push(p.name);
      }
      if (fresh.length) {
        A().sysLog(`【페이즈 체인지 ${have}】 ${m.name} — 켜짐: 『${fresh.join('』 『')}』`, 'battle', { mid });
        await autoOnEntry(mid, { passiveOnly: 1, only: fresh });
      }
      for (const p of trig) await phaseTrigFire(m, p, have);
    }
  }
  async function phaseTrigFire(m, p, have) {
    const head = `【포텐셜】 ${m.name} 『${p.name}』 — 「트리거 : 페이즈 체인지」(${have}번째)`;
    const a = FX().autoOf(m, 'pot', p.name);
    if (!a || !realOps(a) || a.manual) {
      A().sysLog(`${head}\n→ 효과는 손으로`, 'battle', { mid: m.id, eff: String(p.eff || '').replace(/<br\s*\/?>/g, '\n').slice(0, 300) });
      return;
    }
    const ex = (m.excl && m.excl.name === p.name) || (m.exclX || []).some(q => q && q.name === p.name);
    if (ex) await fireSpecial(m.tid, m.id, 'ex', p.name, 'free');
    else await fireAuto(m.id, 'pot', p.name, { auto: a, manual: 1, head, eff: String(p.eff || '') });
  }
  /* 11-09 감우 54-F: 다른 포켓몬 · 트레이너 고유가 주는 「PT 전원이 「기능 확장 : X」를 내보낼 수 있다」 */
  function partyExtSrc(m) {
    const b = (A().ST.state || {}).battle || {};
    const out = [];
    if (!m || !m.tid) return out;
    for (const x of Object.values(b.mons || {})) {
      if (!x || x.id === m.id || x.tid !== m.tid) continue;
      for (const p of potSrc(x)) {
        const e = String(p.eff || '');
        if (/PT\s*전원|아군\s*전원|아군\s*전체|아군이\s*「?기능/.test(e) && /기능\s*확장/.test(e) && !potOffWhy(x, p.name))
          out.push({
            n: String(p.name || '')
              .replace(/[『』]/g, '')
              .trim(),
            e
          });
      }
    }
    const t = (b.trainers || {})[m.tid];
    for (const u of (t && t.unique) || []) {
      const e = String((u && u.eff) || '');
      if (
        u &&
        u.name &&
        /기능\s*확장/.test(e) &&
        /PT\s*전원|아군\s*전원|아군\s*전체|아군이\s*「?기능/.test(e) &&
        !(t.potOff || {})[
          String(u.name)
            .replace(/[『』]/g, '')
            .trim()
        ]
      )
        out.push({
          n: String(u.name)
            .replace(/[『』]/g, '')
            .trim(),
          e
        });
    }
    return out;
  }
  /* ===== 11-09 감우 54-E 「자동 계기 넓히기」 =====
    evReact(종류, 정보): 필드 위 포켓몬의 특성 · 소지품 · 포텐셜 · 전용과 트레이너 고유 중 효과 글이 그 계기에 맞는 것을 찾아 — 구문이 있으면 【자동】은 바로, 아니면 「발동할까?」 (rcvReact 와 같은 방식, 턴마다 한 번) · 구문이 없으면 알림만.
    종류: made (상대를 「X」 상태로 만들었을 때) · trait (「특성 : X」이 발동했을 때) · pot (『X』가 발동했을 때 · 아군이 【보급】 포텐셜을 발동했을 때 → 횟수 회복) · drain (상대가 드레인으로 회복했을 때) ·
          weather (「날씨 : X」가 되었을 때) · shout (【함성(기술)】 — 그 기술을 쓴 뒤) · use (아군이 「소지품 : X」를 소모했을 때) */
  const EV_DONE = {};
  let EVQ = [];
  /* ── 11-26 「…한 턴」 조건을 한 곳에서 (TURN_DID · TURN_PRE · turnGate) ──
    이번 턴에 그 포켓몬이 한 일의 장부: 포텐셜 = potTurn._share(shareMark — 【공유】와 같은 기록) · 특성 = potTurn._tr(didMarkTrait — 특성 발동 계기가 돌 때) · 기술 = lastMove.
    계기 줄 앞에 「①(『X』)이 발동한 턴」 · 「「특성 : X」가 발동한 턴」 · 「「X」를 내보낸 턴」이 붙어 있으면 evReact 가 turnGate 로 걸러낸다(그 턴에 정말 했을 때만).
    새 꼴은 TURN_PRE 에 한 줄, 새 장부는 TURN_DID 에 한 줄 */
  const nqT = x => String(x || '').replace(/[『』「」\s]/g, '');
  const TURN_DID = {
    pot: (m, n, T) => {
      const S0 = (m.potTurn || {})._share;
      return !!(S0 && +S0.t === T && (S0.u || []).some(u => u && nqT(u.n) === nqT(n)));
    },
    trait: (m, n, T) => {
      const S0 = (m.potTurn || {})._tr;
      return !!(S0 && +S0.t === T && (S0.n || []).some(x => nqT(x) === nqT(n)));
    },
    move: (m, n, T) => {
      const lm = m.lastMove;
      return !!(lm && +lm.turn === T && nqT(lm.name) === nqT(n));
    }
  };
  const didThisTurn = (m, kind, name, b) => !!(m && TURN_DID[kind] && TURN_DID[kind](m, name, +(b || {}).turn || 0));
  const TURN_PRE = [
    {
      kind: 'pot',
      re: /(?:([①-⑳])|『([^』]+)』)\s*(?:이|가)\s*발동(?:한|된)\s*턴/,
      name: (r, self) => r[2] || self,
      same: (r, self) => !r[2] || nqT(r[2]) === nqT(self)
    },
    { kind: 'trait', re: /「\s*특성\s*[:：]\s*([^」]+?)\s*」\s*(?:이|가)\s*발동(?:한|된)\s*턴/, name: r => r[1], same: () => false },
    { kind: 'move', re: /「\s*([^」:：]+?)\s*」\s*(?:을|를)\s*내보낸\s*턴/, name: r => r[1], same: () => false }
  ];
  /* 줄(cl)에 「…한 턴」 조건이 없으면 null · 있는데 안 했으면 false · 했으면 {follow} — follow = 같은 포텐셜의 뒷줄(①이 발동한 턴 …)이라 횟수를 다시 세지 않는다 */
  function turnGate(mm, cl, selfName, b) {
    const c0 = String(cl || '');
    const one = c0.slice(0, 1) + c0.slice(1).split(/[①-⑳\n]/)[0];
    /* clauseAt 은 160자를 주니 그 줄(절) 하나만 */ for (const P of TURN_PRE) {
      const r = one.match(P.re);
      if (!r) continue;
      if (!didThisTurn(mm, P.kind, P.name(r, selfName), b)) return false;
      return { follow: P.same(r, selfName) ? 1 : 0 };
    }
    return null;
  }
  /* 「…발동한 턴」이 계기 자체일 때: 뒤에 다른 계기(…했을 때 · 할 때 · 일 때)가 이어지면 그 계기의 몫이다 (pot · trait 계기가 같이 쓴다) */
  const turnTrigAlone = (cl, hit) => {
    if (!/턴$/.test(hit)) return true;
    const rest = String(cl).slice(String(cl).indexOf(hit) + hit.length);
    return !/(?:았|었|였|했)을\s*때|할\s*때|일\s*때/.test(rest.split(/[.\n]/)[0]);
  };
  async function didMarkTrait(mid, name) {
    try {
      const m = ((ctx().b || {}).mons || {})[mid];
      if (!m || !name) return;
      const T = +ctx().b.turn || 0;
      const S0 = (m.potTurn || {})._tr;
      const n = S0 && +S0.t === T && Array.isArray(S0.n) ? S0.n.slice() : [];
      if (n.some(x => nqT(x) === nqT(name))) return;
      n.push(String(name));
      await A().set(['battle', 'mons', mid, 'potTurn', '_tr'], { t: T, n });
    } catch (e) {
      console.warn('didMarkTrait', e);
    }
  }
  const EVM = {
    /* 11-26 366 「자신의 「HP」가 회복했을 때 …」(가름 『마랑황신의 화옥』 · 『작열』 · 레밀리아 『뱀피릭』): 필드 포켓몬의 HP 가 늘면 (healWatch) — 주어 없으면 자신 · 「아군의」 · 「상대의」 */
    healed: (t, mm, o, b) => {
      const re = /(자신의|아군의|상대의|적의)?\s*「\s*HP\s*」\s*(?:가|를|이)?\s*회복\s*(?:했을|하였을|되었을|됐을)\s*때/g;
      const src = b.mons[o.mid];
      if (!src) return null;
      let r;
      while ((r = re.exec(t))) {
        const w = r[1] || '';
        const rel = w === '아군의' ? 'ally' : w === '상대의' || w === '적의' ? 'foe' : 'self';
        if (rel === 'self' && mm.id !== o.mid) continue;
        if (rel === 'ally' && (mm.id === o.mid || !sameT(mm, src, b))) continue;
        if (rel === 'foe' && sameT(mm, src, b)) continue;
        return { why: `${src.name} 「HP」 회복 (+${o.amt})`, pick: rel === 'self' ? null : o.mid, cl: clauseAt(t, r.index) };
      }
      return null;
    },
    made: (t, mm, o, b) => {
      if (mm.id !== o.by) return null;
      const re = /(?:(?:상대|대상|적)(?:을|를)\s*)?「([^」]+)」\s*상태로\s*만들었을\s*때|「([^」]+)」\s*상태가\s*된\s*(?:상대|대상)/g;
      let r;
      while ((r = re.exec(t))) {
        const w = (r[1] || r[2] || '').split(/[\/,·]/).map(x => x.trim());
        const ks = w.map(x => stEnL(x)).flat();
        const S2 = o.sts.includes('Toxic') ? o.sts.concat(['Poison']) : o.sts;
        if (!ks.some(k => S2.includes(k))) continue;
        const ty = t.slice(Math.max(0, r.index - 40), r.index).match(/「타입\s*:\s*([^」]+)」\s*(?:인|을|를)/);
        const d = b.mons[o.tgt];
        if (ty && d) {
          const want = ty[1].split(/[,·\/]/).map(x => S().typeEn(x.trim()));
          if (!tysOf(d).some(x => want.includes(x))) continue;
        }
        return {
          why: `${d ? d.name : ''}을(를) 「${FX().stKo ? FX().stKo(o.sts[0]) : o.sts[0]}」 상태로 만들었다`,
          pick: o.tgt,
          cl: clauseAt(t, r.index)
        };
      }
      return null;
    },
    trait: (t, mm, o, b) => {
      const re =
        /(자신의|아군의|상대의)?\s*「특성\s*:\s*([^」]+)」\s*(?:(?:(?:이|가)?\s*발동\s*(?:했을|한|하였을)|(?:으로|로)\s*(?:기술|공격)(?:을|를)\s*회피\s*(?:했을|하였을|한))\s*때|(?:이|가)\s*발동\s*(?:한|된)\s*턴)/g;
      /* 11-23: 「「특성 : 만트라」로 기술을 회피했을 때」도 같은 계기 (회피로 발동했을 때만 trFire 가 남는다) */ let r;
      while ((r = re.exec(t))) {
        if (String(r[2]).replace(/\s/g, '') !== String(o.name).replace(/\s/g, '')) continue;
        if (!turnTrigAlone(clauseAt(t, r.index), r[0])) continue;
        /* 11-26 「「특성 : X」가 발동한 턴 …」도 같은 계기(구문에는 이번턴) — 뒤에 다른 계기가 이어지면 그쪽 몫 */ const src = b.mons[o.mid];
        if (!src) continue;
        const rel = r[1] === '아군의' ? 'ally' : r[1] === '상대의' ? 'foe' : 'self';
        if (rel === 'self' && mm.id !== o.mid) continue;
        if (rel === 'ally' && (mm.id === o.mid || !sameT(mm, src, b))) continue;
        if (rel === 'foe' && sameT(mm, src, b)) continue;
        return { why: `${src.name} 「특성 : ${o.name}」 발동`, pick: rel === 'self' ? o.opp || null : o.mid, cl: clauseAt(t, r.index) };
      }
      return null;
    } /* 11-22 o.opp: 그 특성을 터뜨린 상대(맞힌 쪽 · 반사당한 쪽) — 구문의 「상대1체」 */,
    /* 11-26 09:45 망령 「특정 포텐셜 명을 지정해서 ~가 발동한 턴, ~가 발동했을 때 — 이런 건 계기화」: 11-09 의 pot 계기(자신의 『X』가 발동했을 때)를 넓힘 —
     주어 「아군의 · 상대의」(없으면 자신) · 「『X』가 발동한 턴 …」도 같은 계기(구문에는 이번턴). 다른 장치가 맡는 꼴은 뺀다:
     「… 발동했을 때 「태그」 기술에 의한 추가 행동」(stanceXact) · 「… 발동한 턴 「기능 확장 : X」」(famFired) · 「… 발동한 턴 (다른 일이 일어났을) 때」(뒤의 계기가 맡는다 — miss 등) */
    pot: (t, mm, o, b, selfName) => {
      const src = b.mons[o.mid];
      if (!src) return null;
      const nq = x => String(x || '').replace(/[『』\s]/g, '');
      let r;
      {
        const re =
          /(자신의|아군의|상대의|적의)?\s*『\s*([^』]+?)\s*』\s*(?:이|가)\s*(?:발동\s*(?:했을|하였을|되었을|됐을)\s*때|발동\s*(?:한|된)\s*턴)/g;
        while ((r = re.exec(t))) {
          if (nq(r[2]) !== nq(o.name) || nq(selfName) === nq(o.name)) continue;
          const cl = clauseAt(t, r.index);
          if (XACT_RE.test(cl) || /기능\s*확장/.test(cl)) continue;
          if (!turnTrigAlone(cl, r[0])) continue;
          const w = r[1] || '';
          const rel = w === '아군의' ? 'ally' : w === '상대의' || w === '적의' ? 'foe' : 'self';
          if (rel === 'self' && mm.id !== o.mid) continue;
          if (rel === 'ally' && (mm.id === o.mid || !sameT(mm, src, b))) continue;
          if (rel === 'foe' && sameT(mm, src, b)) continue;
          return { why: `${src.name} 『${o.name}』 발동`, pick: rel === 'self' ? null : o.mid, cl };
        }
      }
      r = t.match(/아군이\s*【\s*보급\s*】\s*포텐셜을\s*발동\s*(?:했을|하였을)\s*때/);
      if (r && /【\s*보급\s*】/.test(String(o.eff || '')) && mm.id !== o.mid && sameT(mm, src, b))
        return { why: `${src.name} 【보급】 『${o.name}』 발동`, restore: { mid: o.mid, name: o.name }, cl: clauseAt(t, r.index) };
      return null;
    },
    /* 11-22 망령 「【보급】 횟수 회복 자동화」(제갈공명 『초선차전·만전귀래』 ②「①이 발동한 턴 「정면」의 기술이 명중하지 않았을 때 아군 전체의 【보급】을 회복한다」): 상대 기술이 자신에게 빗나갔을 때.
     「①(『X』)이 발동한 턴」이 앞에 있으면 이번 턴에 그 포텐셜을 썼을 때만 — 같은 발동의 뒷줄이라 【보급】 · 횟수를 다시 세지 않는다(follow · turnGate). 「정면」인지까지는 보지 않는다 */
    miss: (t, mm, o, b, nm) => {
      const atk = b.mons[o.mid],
        def = b.mons[o.tgt];
      if (!atk || !def || mm.id !== def.id || sameT(atk, def, b)) return null;
      const re =
        /(?:「\s*정면\s*」|정면|상대|대상)(?:의|이|가)?\s*(?:기술|공격)(?:이|가)\s*(?:자신에게\s*)?(?:명중하지\s*(?:않았을|않을)|빗나갔을)\s*때/g;
      let r;
      while ((r = re.exec(t))) {
        const cl = clauseAt(t, r.index);
        return { why: `${atk.name}의 「${o.mv || '기술'}」이(가) ${def.name}에게 명중하지 않았다`, pick: o.mid, cl };
      }
      return null;
    } /* 「①이 발동한 턴」은 evReact 의 turnGate 가 본다 */,
    drain: (t, mm, o, b) => {
      const src = b.mons[o.mid];
      if (!src || sameT(mm, src, b)) return null;
      const r = t.match(/상대가\s*「?드레인」?\s*(?:기술의\s*효과에\s*의해|기술로|으로|로)?\s*회복\s*(?:했을|하였을|할)\s*때/);
      return r ? { why: `${src.name} 드레인으로 회복`, pick: o.mid, cl: clauseAt(t, r.index) } : null;
    },
    /* 11-26 「(자신 · 아군 · 상대)가 「타입 : X」(이) 되었을 때」 · 「「타입 : X」이 된 상대」 — 소지품 · 특성도 같은 꼴 (becameEv). 주어가 없으면 자신 */
    used: (t, mm, o, b) => {
      if (mm.id !== o.mid) return null;
      const d = b.mons[o.tgt];
      if (!d) return null;
      const re =
        /(?:「\s*타입\s*:\s*([^」]+)」\s*인\s*)?아군(?:\s*포켓몬)?에게\s*「([^」:]+)」\s*(?:을|를)\s*(?:내보냈을|사용했을|내보낼|사용할)\s*때/g;
      let r;
      while ((r = re.exec(t))) {
        if (!r[2].split(/[,·\/]/).some(x => nPV(x) === nPV(o.mv))) continue;
        if (r[1]) {
          const want = r[1].split(/[,·\/]/).map(x => S().typeEn(x.trim()));
          if (!tysOf(d).some(x => want.includes(x))) continue;
        }
        return { why: `${mm.name} → ${d.name} 「${o.mv}」`, pick: o.tgt, cl: clauseAt(t, r.index) };
      }
      return null;
    },
    typed: (t, mm, o, b) =>
      becameEv('타입', t, mm, o, b, (w, d) => {
        const want = w.split(/[,·\/]/).map(x => S().typeEn(x.trim()));
        return (o.tys || []).some(x => want.includes(x));
      }),
    itemed: (t, mm, o, b) =>
      becameEv('소지품', t, mm, o, b, (w, d) =>
        w
          .split(/[,·\/]/)
          .map(x => x.trim())
          .some(x =>
            /^(?:-|없음|빈손)$/.test(x) ? !!o.none : x === '나무열매' ? (o.its || []).some(y => /열매$/.test(y)) : (o.its || []).includes(nPV(x))
          )
      ),
    abiled: (t, mm, o, b) => becameEv('특성', t, mm, o, b, (w, d) => w.split(/[,·\/]/).some(x => nPV(x) === o.ab)),
    weather: (t, mm, o, b) => {
      const re = /「?날씨\s*:\s*([^」]+?)」?\s*(?:이|가)\s*되었을\s*때/g;
      let r;
      while ((r = re.exec(t))) {
        if (r[1].split(/[,·\/]/).some(x => x.trim() === o.w)) return { why: `날씨 「${o.w}」`, cl: clauseAt(t, r.index) };
      }
      return null;
    },
    shout: () =>
      null /* 11-11 망령 「【함성 (「기술」)】 = 그 기술로 쓰러뜨렸을 때 · 【함성 (「타입 : 물」)】 = 그 타입을 쓰러뜨렸을 때」: 예전엔 그 기술을 쓰기만 해도 걸었다 → 아래 ko 로 */,
    ko: (t, mm, o, b) => {
      const r = t.match(/【\s*함성\s*(?:\(\s*([^)]*?)\s*\))?\s*】(?!\s*(?:을|를)\s*발동)/);
      if (!r) return null;
      /* 11-24 망령 「함성 (아군)은 아군이 쓰러뜨렸을 때 키워드」: 쓰러뜨린 쪽이 같은 편의 다른 포켓몬일 때. 「「지휘」로 내보낸 기술일 때」가 붙으면 그 아군이 이번 턴 지휘로 다시 내보낸 기술(instr)로 쓰러뜨렸을 때만 */ const allyK =
        String(r[1] || '').replace(/\s/g, '') === '아군';
      {
        const kk = b.mons[o.mid];
        if (allyK ? mm.id === o.mid || !kk || !sameT(mm, kk, b) : mm.id !== o.mid) return null;
        if (allyK && /「\s*지휘\s*」\s*(?:으로|로)\s*내보낸\s*기술/.test(String(clauseAt(t, r.index) || ''))) {
          const I = kk.instr;
          const nq = x => String(x || '').replace(/\s/g, '');
          if (!(I && +I.t === (+b.turn || 0) && nq(I.mv) === nq(o.mv))) return null;
        }
      }
      /* 11-15: 「【함성】을 발동시키지 못한 턴」(폭식의 대죄 ③)은 계기가 아님 */ const d = b.mons[o.tgt];
      const raw = allyK ? '' : String(r[1] || '').trim();
      if (raw) {
        const tm = raw.match(/타입\s*:\s*([^」)]+)/);
        if (tm) {
          const want = tm[1]
            .split(/[,·\/]/)
            .map(x => S().typeEn(x.trim()))
            .filter(Boolean);
          if (!d || !tysOf(d).some(x => want.includes(x))) return null;
        } else if (/프라이드\s*[:：]/.test(raw)) {
          /* 11-20 망령 「【함성 (【프라이드 : A】)】 — 괄호 문제 · 자동화는 되나」: 쓰러뜨린 상대의 프라이드로 (A · 「A, EX」 · 「A 이상」). 예전엔 괄호 안을 기술 이름으로 읽어 늘 불발 */ const PO =
            ['D', 'C', 'C+', 'B', 'B+', 'A', 'EX'];
          const rc = raw
            .replace(/[「」【】]/g, '')
            .replace(/^.*프라이드\s*[:：]\s*/, '')
            .trim();
          const up = /이상/.test(rc),
            dn = /이하/.test(rc);
          const want = rc
            .replace(/이상|이하/g, '')
            .split(/[,·\/\s]+/)
            .map(x => x.trim().toUpperCase())
            .filter(x => PO.includes(x));
          const dp = String((d && d.pride) || '')
            .trim()
            .toUpperCase();
          const di = PO.indexOf(dp);
          if (!want.length || di < 0) return null;
          if (up ? !(di >= Math.min(...want.map(x => PO.indexOf(x)))) : dn ? !(di <= Math.max(...want.map(x => PO.indexOf(x)))) : !want.includes(dp))
            return null;
        } else if (/^「?(단일기|전체기|물리기|특수기|접촉기|비접촉기)」?$/.test(raw)) {
          /* 11-15 05시: 【함성 (「단일기」)】 — 기술 분류로 (킬링 에이스) */ const kd = raw.replace(/[「」]/g, '');
          const mo = (DB().moves || {})[String(o.mv || '').trim()] || {};
          const rg = String(mo.range || '');
          const multi = /전체|자신\s*이외/.test(rg);
          const ct = String(mo.contact || '') === 'O';
          if (kd === '단일기' && multi) return null;
          if (kd === '전체기' && !multi) return null;
          if (kd === '물리기' && mo.cat !== '물리') return null;
          if (kd === '특수기' && mo.cat !== '특수') return null;
          if (kd === '접촉기' && !ct) return null;
          if (kd === '비접촉기' && ct) return null;
        } else {
          const ns = raw.split(/[,·]/).map(x => x.trim().replace(/[「」]/g, ''));
          if (!ns.includes(String(o.mv || '').trim())) return null;
        }
      }
      return {
        why: `${allyK ? ((b.mons[o.mid] || {}).name || '아군') + '이(가) ' : ''}${d ? d.name : '상대'}을(를) 쓰러뜨렸다 (【함성${allyK ? ' (아군)' : raw ? ' (' + raw + ')' : ''}】${o.mv ? ' · 「' + o.mv + '」' : ''})`,
        cl: clauseAt(t, r.index)
      };
    },
    /* 11-09 감우 55: 「(상대의) 공격을 받았을 때 / 「X」 기술을 받았을 때 / 접촉기를 받았을 때 / 아군이 공격을 받았을 때」 — 맞은 쪽(o.tgt) 기준 · 앞 글의 「타입」 · 「상성 : …」 · 「X」 상태(인 상대 / 에서) · 기술 이름을 조건으로 본다 */
    hit: (t, mm, o, b) => {
      const atk = b.mons[o.mid],
        def = b.mons[o.tgt];
      if (!atk || !def || atk.id === def.id) return null;
      const re = /(공격|기술|접촉기|비접촉기|물리기|특수기)\s*(?:을|를|에|의\s*공격을)?\s*(?:(?:받았을|받을|맞았을)\s*때|받으면|맞으면)/g;
      /* 11-26 프리벤터 수송 「「요격」 상태일 때 공격받으면」도 */ let r;
      while ((r = re.exec(t))) {
        const cl0 = clauseAt(t, r.index);
        const st = Math.max(0, r.index - 70);
        let pre = t.slice(st, r.index);
        const cut = Math.max(
          pre.lastIndexOf('/'),
          pre.lastIndexOf('】'),
          pre.lastIndexOf('\n'),
          pre.lastIndexOf('①'),
          pre.lastIndexOf('②'),
          pre.lastIndexOf('③'),
          pre.lastIndexOf('.')
        );
        if (cut >= 0) pre = pre.slice(cut + 1);
        if (/급소/.test(pre) && !o.crit) continue;
        if (/회피|명중했을/.test(pre)) continue;
        const ally = /아군(?:이|의)/.test(pre);
        if (ally ? mm.id === def.id || !sameT(mm, def, b) : mm.id !== def.id) continue;
        if (/상대(?:의|가|로부터)/.test(pre) && sameT(atk, def, b)) continue;
        const kw = r[1];
        if (kw === '공격' && o.cat === '변화') continue;
        if (kw === '접촉기' && !o.ct) continue;
        if (kw === '비접촉기' && (o.ct || o.cat === '변화')) continue;
        if (kw === '물리기' && o.cat !== '물리') continue;
        if (kw === '특수기' && o.cat !== '특수') continue;
        let ok = true;
        const mvAlt = [];
        for (const q of pre.matchAll(/「([^」]+)」\s*(상태(?:인|에서|일\s*때)?)?/g)) {
          const w = q[1].trim();
          const sx = pre.slice(q.index + q[0].length, q.index + q[0].length + 8);
          if (/^(?:HP|공격|방어|특공|특방|스피드|명중|회피)$/.test(w) && /^\s*(?:종족치|랭크|이|가|보다)/.test(sx))
            continue; /* 11-10: 「방어」 종족치보다 「공격」이 낮은 상대 — 능력치 이름은 기술 「방어」로 읽지 않는다 (조건은 구문의 상대종족치 토큰이 본다) */
          if (/^상성\s*:/.test(w)) {
            const v = +o.eff || 1;
            const nums = (w.match(/\d+(?:\/\d+)?/g) || []).map(x => (x.includes('/') ? +x.split('/')[0] / +x.split('/')[1] : +x));
            if (/이하/.test(w) && nums.length) {
              if (!(v <= nums[0] + 1e-9)) ok = false;
            } else if (/이상/.test(w) && nums.length) {
              if (!(v >= nums[0] - 1e-9)) ok = false;
            } else if (/~/.test(w) && nums.length >= 2) {
              const lo = Math.min(...nums),
                hi = Math.max(...nums);
              if (!(v >= lo - 1e-9 && v <= hi + 1e-9)) ok = false;
            } else if (nums.length && Math.abs(v - nums[0]) > 1e-9) ok = false;
            continue;
          }
          if (q[2]) {
            const ks = stEnL(w);
            if (!ks.length) continue;
            const who = /^\s*상대|인\s*상대/.test(q[0].slice(q[0].indexOf('」') + 1) + sx) ? atk : mm;
            if (!ks.some(k => (who.states || {})[k])) ok = false;
            continue;
          }
          const ws = w
            .split(/[\/,·]/)
            .map(x => x.trim())
            .filter(Boolean);
          const tyE = ws.map(x => S().typeEn(x.replace(/^타입\s*:\s*/, ''))).filter(Boolean);
          if (tyE.length === ws.length) {
            if (!tyE.some(x => (o.mt || []).includes(x))) ok = false;
            continue;
          }
          if (ws.some(x => (DB().moves && DB().moves[x]) || mvTagSet().has(x))) {
            mvAlt.push(...ws);
            continue;
          }
        }
        if (ok && mvAlt.length) {
          const nmv = String(o.mv || '').replace(/\s/g, '');
          const tg = String(((DB().moves || {})[o.mv] || {}).tag || '')
            .split(/[,\s#]+/)
            .filter(Boolean);
          if (!mvAlt.some(x => x.replace(/\s/g, '') === nmv || tg.includes(x))) ok = false;
        } /* 11-22 뽀록나 『독성버섯』 「「물기」「엄니」기술을 받았을 때」: 따옴표 여럿 = 그중 하나 · 기술 이름이거나 기술 태그(#물기 · #엄니) */
        if (!ok) continue;
        return { why: `${def.name}이(가) ${atk.name}의 「${o.mv}」을(를) 받았다`, pick: o.mid, cl: cl0 };
      }
      return null;
    },
    /* 11-28 「「X의자세」가 되었을 때」(호시미 미야비 『잔설』): 「자세」 기술로 자세가 바뀐 순간. 「자세」만 적으면 어느 자세든. 「아군이 …」면 같은 편의 다른 포켓몬, 없으면 자신 */
    stance: (t, mm, o, b) => {
      const d = b.mons[o.tgt];
      if (!d || !o.name) return null;
      const re =
        /(?:(자신|아군|상대)(?:\s*포켓몬)?(?:이|가)?\s*)?「\s*([^」:：]*자세)\s*」\s*(?:이|가|로|으로)?\s*(?:되었을|됐을|바뀌었을|변경\s*되었을|변경\s*했을)\s*때/g;
      let r;
      while ((r = re.exec(t))) {
        const w = r[1] || '자신';
        const rel = d.id === mm.id ? 'self' : sameT(mm, d, b) ? 'ally' : 'foe';
        if ((w === '자신' ? 'self' : w === '아군' ? 'ally' : 'foe') !== rel) continue;
        const nm = r[2].replace(/\s/g, '');
        if (nm !== '자세' && nm !== String(o.name).replace(/\s/g, '')) continue;
        return { why: `${d.name}이(가) 「${o.name}」가 되었다`, pick: o.tgt, cl: clauseAt(t, r.index) };
      }
      return null;
    },
    /* 11-10 망령 「방어 상태로 무시했을 때 ~ 는 있어?」: 「기술 방어」(방어 · 판별 …)로 상대 기술을 막은 순간 — 「「방어」 상태로 (상대의) (접촉기 · 기술 · 공격을) 무시했을 때 / 막았을 때」. 「아군이 …」면 같은 편의 다른 포켓몬이 막았을 때. 대상(pick) · 구문의 「상대」 = 막힌 쪽(공격한 포켓몬) */
    guard: (t, mm, o, b) => {
      const atk = b.mons[o.mid],
        def = b.mons[o.tgt];
      if (!atk || !def) return null;
      const re =
        /(?:「(?:기술\s*)?방어」\s*(?:상태|등의\s*기술)?|방어\s*등의\s*기술)\s*(?:로|으로)\s*([^.\/\n①②③]{0,26}?)(?:무시했을|무시하였을|막았을|막아냈을|무효화\s*했을|무효로\s*했을)\s*때/g;
      /* 11-22 바이올렛 『대필기의 유술』 「방어 등의 기술로 상대의 「접촉기」를 무효화 했을 때」 */ let r;
      while ((r = re.exec(t))) {
        const pre = t.slice(Math.max(0, r.index - 12), r.index);
        const ally = /아군(?:이|의)\s*$/.test(pre);
        if (ally ? mm.id === def.id || !sameT(mm, def, b) : mm.id !== def.id) continue;
        const mid = r[1] || '';
        if (/비접촉기/.test(mid) ? o.ct || o.cat === '변화' : /접촉기/.test(mid) && !o.ct) continue;
        if (/물리기/.test(mid) && o.cat !== '물리') continue;
        if (/특수기/.test(mid) && o.cat !== '특수') continue;
        if (/공격/.test(mid) && o.cat === '변화') continue;
        return { why: `${def.name}이(가) 「방어」 상태로 ${atk.name}의 「${o.mv}」을(를) 무시했다`, pick: o.mid, cl: clauseAt(t, r.index) };
      }
      return null;
    },
    use: (t, mm, o, b) => {
      const src = b.mons[o.mid];
      if (!src || mm.id === o.mid || !sameT(mm, src, b)) return null;
      const r = t.match(/아군이\s*「소지품\s*:\s*([^」]+)」\s*(?:을|를)\s*소모\s*(?:했을|하였을)\s*때/);
      if (!r) return null;
      const nI = x => String(x || '').replace(/[『』\s]/g, '');
      if (nI(r[1]) !== nI(o.name) && !(r[1].trim() === '나무열매' && /열매$/.test(o.name))) return null;
      return { why: `${src.name} 「${o.name}」 소모`, pick: o.mid, cl: clauseAt(t, r.index) };
    }
  };
  let MVTAG = null;
  function mvTagSet() {
    if (MVTAG) return MVTAG;
    const M = DB().moves || {};
    const S0 = new Set();
    for (const k in M) for (const x of String(M[k].tag || '').split(/[,\s#]+/)) if (x) S0.add(x);
    if (Object.keys(M).length) MVTAG = S0;
    return S0;
  }
  function clauseAt(t, i) {
    const s = String(t || '');
    const a = Math.max(s.lastIndexOf('①', i), s.lastIndexOf('②', i), s.lastIndexOf('③', i), s.lastIndexOf('\n', i), 0);
    return s.slice(a, a + 160);
  }
  /* 「예리」처럼 상태 DB 에 「예리1」 「예리2」로 나뉜 이름은 앞부분이 같은 상태를 모두 */
  function stEnL(w) {
    const k = FX() && FX().stEn ? FX().stEn(w) : '';
    if (k) return [k];
    const sd = (DB().states || {}).st || {};
    const n = String(w || '').replace(/\s/g, '');
    if (!n) return [];
    return Object.keys(sd).filter(
      x =>
        String((sd[x] || {}).ko || '')
          .replace(/\s/g, '')
          .replace(/\d+$/, '') === n
    );
  }
  /* 11-15 05시 망령 「시뮬에서 구현 안 되는 게 있으면 만들면서」 — 계기 효과 다듬기:
    ① 여러 줄(①②) 포텐셜이 「선택」 구문 하나로 묶여 있으면 계기가 걸린 줄(①/②)의 선택지를 바로 고른다 (킬링 에이스 ② 함성 회복이 ① 따라가때리기로 가던 것)
    ② 다른 포텐셜 · 전용이 『X』를 고치는 글: 「『X』의 회복량을 강화(a→b)」 · 「(…) 상태 이상을 치유」 · 「『X』의 【보급】을 제거」 (아니스 『폭식의 대죄』) */
  let POT_HEAL_RE = null;
  const potHealRe = () => POT_HEAL_RE || (POT_HEAL_RE = FX().FRAC.re('회복량을\\s*강화\\s*'));
  function potModsOf(m, name) {
    const nm = String(name || '').replace(/[『』\s]/g, '');
    const R = {};
    if (!m || !nm) return R;
    for (const q of potSrc(m)) {
      if (!q || !q.name || q.ph) continue;
      const e = String(q.eff || '');
      for (const seg of e.split(/\n|(?=[①②③④⑤])/)) {
        const mm = seg.match(/『([^』]+)』의/);
        if (!mm || mm[1].replace(/\s/g, '') !== nm) continue;
        const h = seg.match(potHealRe());
        if (h) {
          const fr = FX().FRAC.of(h, 1);
          R.heal = [fr.fromS, fr.toS, q.name];
        }
        /* 분수 꼴은 fx FRAC */ if (/상태\s*이상을\s*치유/.test(seg)) R.cure = q.name;
        if (/【\s*보급\s*】을\s*제거/.test(seg)) R.nosup = q.name;
      }
    }
    return R;
  }
  function clausePick(a, cl) {
    if (!a || !a.ops || a.ops.length !== 1 || a.ops[0].k !== 'choice') return a;
    const mk = (String(cl || '')
      .trim()
      .match(/^[①②③④⑤]/) || [])[0];
    if (!mk) return a;
    const o = (a.ops[0].opts || []).find(z =>
      String(z.label || '')
        .trim()
        .startsWith(mk)
    );
    return o ? Object.assign({}, a, { ops: o.ops }) : a;
  }
  function potModApply(a, M) {
    if (!a || !a.ops || !M || (!M.heal && !M.cure)) return a;
    const fix = ops =>
      ops.map(op => {
        if (!op || typeof op !== 'object') return op;
        if (op.k === 'heal' && M.heal && String(op.value).replace(/\s/g, '') === M.heal[0]) return Object.assign({}, op, { value: M.heal[1] });
        if (op.k === 'choice') return Object.assign({}, op, { opts: (op.opts || []).map(z => Object.assign({}, z, { ops: fix(z.ops || []) })) });
        return op;
      });
    let ops = fix(a.ops);
    if (M.cure && ops.some(op => op && op.k === 'heal')) ops = ops.concat([{ k: 'cure', tgt: 'self', states: 'negative' }]);
    return Object.assign({}, a, { ops });
  }
  async function evReact(ev, o) {
    const c = ctx();
    const b = c.b;
    if (!c.mgr || !FX() || !b || !b.started || !EVM[ev]) return;
    if (!isLeader(c)) return;
    o = o || {};
    if (ev === 'trait' && o.mid && o.name) await didMarkTrait(o.mid, o.name); /* 이번 턴 장부(특성) */
    const gate = (mm, r, nm) => {
      if (ev === 'pot' || ev === 'trait') return true;
      const g = turnGate(mm, r.cl, nm, b);
      if (g === false) return false;
      if (g && g.follow) r.follow = 1;
      return true;
    }; /* 「…한 턴」 조건 (pot · trait 계기는 그 말이 계기 자체) */
    const mons = Object.values(b.mons || {}).filter(m => m && m.entry && m.hp && m.hp.cur > 0);
    const C = [];
    for (const mm of mons) {
      const src = [];
      if (mm.ability) src.push(['trait', mm.ability, slotEff(mm, 'trait', mm.ability)]);
      if (!IOFF(mm)) {
        if (mm.item) src.push(['item', mm.item, slotEff(mm, 'item', mm.item)]);
        for (const q of mm.items2 || []) if (q && q.item && q.item !== mm.item) src.push(['item', q.item, q.itemEff || '']);
      }
      for (const p of potSrc(mm)) if (p && p.name && !p.ph) src.push(['pot', p.name, String(p.eff || ''), p]);
      for (const [kind, name, eff, p] of src) {
        if (ev === 'hit' && kind !== 'pot') continue;
        /* 특성 = hitRules · 소지품 = OI().onHit 이 이미 */ const t = String(eff || '').replace(/<br\s*\/?>/gi, '\n');
        const r = EVM[ev](t, mm, o, b, name);
        if (r && gate(mm, r, name)) {
          if (kind === 'pot') {
            const sp = priHeadSpec(r.cl);
            if (sp && !priSelfOk(mm, sp)) continue;
          }
          if (!priFoeOk(r.cl, mm, o, r, b)) continue;
          C.push({ own: mm, kind, name, eff: t, p, r });
        }
      }
    }
    for (const t of Object.values(b.trainers || {})) {
      const om = o.mid && mons.find(m => m.id === o.mid && m.tid === t.id);
      const rep = om || mons.find(m => m.tid === t.id);
      if (!rep) continue;
      for (const q of uniqList(t)) {
        const tx = String(q.p.eff || '').replace(/<br\s*\/?>/gi, '\n');
        const r = EVM[ev](tx, rep, o, b, q.p.name);
        if (!r || !gate(rep, r, q.p.name) || (q.left !== null && q.left <= 0 && !r.follow)) continue;
        C.push({ own: rep, kind: 'uq', name: q.p.name, eff: tx, p: q.p, r, t, q });
      }
    }
    const notes = [];
    for (const x of C) {
      const key = [turnKey(b), ev, x.kind, x.own.id, x.name, o.key || ''].join('|');
      if (EV_DONE[key]) continue;
      EV_DONE[key] = 1;
      if (!c.gm && !ownT(c, x.own.tid)) continue;
      const K = { pot: '포텐셜', trait: '특성', item: '소지품', uq: '고유' }[x.kind] || '효과';
      const who = x.kind === 'uq' ? x.t.name + ' 고유' : x.own.name;
      const why = `【계기】 ${x.r.why}`;
      if (ev === 'ko') {
        /* 11-15 05시: 상대의 「(저|중|고)확률로 상대의 【함성】을 무효화한다」(애디 『이노센트』 — 필드 위에 있는 한) */ const bl = Object.values(
          ctx().b.mons || {}
        ).find(
          z =>
            z &&
            z.entry &&
            z.hp &&
            z.hp.cur > 0 &&
            !sameT(z, x.own, ctx().b) &&
            potSrc(z).some(q => q && /(저|중|고)확률로\s*상대의\s*【\s*함성\s*】\s*을\s*무효화/.test(String(q.eff || '')))
        );
        if (bl) {
          const q = potSrc(bl).find(q => q && /(저|중|고)확률로\s*상대의\s*【\s*함성\s*】\s*을\s*무효화/.test(String(q.eff || '')));
          const lv = String(q.eff).match(/(저|중|고)확률로\s*상대의\s*【\s*함성/)[1];
          const F = FX();
          const pct = F && F.percentOf ? Math.round(F.percentOf(lv + '확률')) : { 저: 20, 중: 50, 고: 60 }[lv];
          const roll = 1 + Math.floor(Math.random() * 100);
          if (roll <= pct) {
            A().sysLog(`【포텐셜】 ${bl.name} 『${q.name}』 — ${x.own.name} 『${x.name}』의 【함성】 무효 (${roll}/${pct})`, 'battle', {
              mid: bl.id
            });
            continue;
          }
        }
      }
      const PM = x.kind === 'pot' ? potModsOf(ctx().b.mons[x.own.id] || x.own, x.name) : {};
      if (PM.nosup && x.p) x.p = Object.assign({}, x.p, { eff: String(x.p.eff || '').replace(/【\s*보급\s*】/g, '') });
      let L = null;
      if (x.kind === 'pot' && x.p) {
        const cur = ctx().b.mons[x.own.id] || x.own;
        L = limOf(x.p, cur.potUses || {}, cur.potTurn || {});
        if (L.left !== null && L.left <= 0 && !x.r.follow) continue;
      }
      if (x.r.follow) L = null;
      /* 11-22 망령 「【보급】 횟수를 회복시키는 포텐셜 자동화」: 계기 줄이 「(자신 · 아군 전체 · 아군 1체)의 【보급】(포텐셜의 사용 횟수)을 회복한다」면 구문 없이 웹툴이 직접 — 필드에 나와 있는 그 포켓몬들의 「이번 등장에 쓴 【보급】」 표시를 지운다 */
      {
        const sr =
          !x.r.restore &&
          String(x.r.cl || '').match(
            /(자신\s*이외의\s*아군(?:\s*전체)?|자신을\s*제외한\s*아군(?:\s*전체)?|다른\s*아군(?:\s*전체)?|자신|아군\s*전체|아군\s*전원|PT\s*전원|(?:아군|자신을\s*포함한\s*아군)\s*(?:포켓몬\s*)?1\s*체|아군(?:\s*포켓몬)?)의\s*【\s*보급\s*】\s*(?:포텐셜(?:의\s*(?:사용\s*)?횟수)?)?\s*(?:을|를)\s*회복/
          );
        const a0 = sr ? clausePick(FX().autoOf(ctx().b.mons[x.own.id] || x.own, x.kind === 'uq' ? 'pot' : x.kind, x.name), x.r.cl) : null;
        if (sr && !(a0 && realOps(a0) && !a0.manual)) {
          const w = sr[1].replace(/\s/g, '');
          const B = ctx().b;
          const TG = FX().supTgt ? FX().supTgt(w, x.kind === 'uq') : 'ally';
          const ex = TG === 'allyx' || TG === 'ally1';
          let tg =
            TG === 'self'
              ? [B.mons[x.own.id]]
              : Object.values(B.mons || {}).filter(z => z && z.entry && z.hp && z.hp.cur > 0 && sameT(z, x.own, B) && !(ex && z.id === x.own.id));
          /* 대상 = FX supTgt — 맨 「아군」은 자신 빼고 (11-14 「아군」은 자신을 포함하지 않음) · 고유는 자신이 없으니 아군 전체 */ tg = tg.filter(
            z => z && Object.keys((z.potTurn || {})._sup || {}).length
          );
          if (/^ally1/.test(TG) && tg.length > 1) {
            const z0 = await localUi(B, x.own, x.name).pick(tg, '【보급】을 회복할 아군');
            if (!z0) continue;
            tg = [z0];
          }
          if (!x.r.follow && !/【\s*자동\s*】/.test(x.eff)) {
            const q = `${why}\n\n${who} 『${x.name}』 — ${tg.length ? tg.map(z => z.name).join(' · ') + '의 【보급】을 회복할까?' : '(회복할 【보급】 없음) 그래도 발동할까?'}`;
            if (!(await remoteAsk(x.own, 'confirm', { name: x.name, q }, () => askYes(q, '회복', '그만')))) continue;
          }
          const nm2 = [];
          for (const z of tg) {
            const ks = Object.keys((z.potTurn || {})._sup || {});
            await A().set(['battle', 'mons', z.id, 'potTurn', '_sup'], null);
            nm2.push(`${z.name} ${ks.map(k => '『' + String(k).replace(/^u:/, '고유 ') + '』').join(' ')}`);
          }
          A().sysLog(`${why}\n${who} 『${x.name}』 — 【보급】 회복${nm2.length ? '\n' + nm2.join('\n') : ' (쓴 【보급】 없음)'}`, 'battle', {
            mid: x.own.id
          });
          if (L) {
            const cur = ctx().b.mons[x.own.id] || x.own;
            if (L.mmax != null) {
              const u = (cur.potUses || {})[x.name];
              const had = u == null ? L.mmax : +u;
              await A().set(['battle', 'mons', x.own.id, 'potUses', x.name], Math.max(0, had - 1));
            }
            if (L.per) await A().set(['battle', 'mons', x.own.id, 'potTurn', x.name], +ctx().b.turn || 0);
            if (L.sup && !tg.some(z => z.id === x.own.id)) await A().set(['battle', 'mons', x.own.id, 'potTurn', '_sup', x.name], 1);
          }
          continue;
        }
      }
      if (x.r.restore) {
        /* 【보급】 포텐셜 횟수 회복 (칼레발라 『황금신부의 보급』) — 구문 없이 웹툴이 직접 */ const tg = ctx().b.mons[x.r.restore.mid];
        const tp = tg && potSrc(tg).find(q => q && q.name === x.r.restore.name);
        if (!tg || !tp) continue;
        const L2 = limOf(tp, tg.potUses || {}, tg.potTurn || {});
        if (!/【\s*자동\s*】/.test(x.eff)) {
          const q = `${why}\n\n${who} 『${x.name}』 — 『${tp.name}』의 횟수를 회복할까?`;
          if (!(await remoteAsk(x.own, 'confirm', { name: x.name, q }, () => askYes(q, '회복', '그만')))) continue;
        }
        if (L2.mmax != null) {
          const u = (tg.potUses || {})[tp.name];
          const had = u == null ? L2.mmax : +u;
          await A().set(['battle', 'mons', tg.id, 'potUses', tp.name], Math.min(L2.mmax, had + 1));
        }
        if (L2.per) await A().set(['battle', 'mons', tg.id, 'potTurn', tp.name], null);
        A().sysLog(`${why}\n${who} 『${x.name}』 — ${tg.name} 『${tp.name}』 횟수 회복`, 'battle', { mid: x.own.id });
        if (L) {
          const cur = ctx().b.mons[x.own.id] || x.own;
          if (L.mmax != null) {
            const u = (cur.potUses || {})[x.name];
            const had = u == null ? L.mmax : +u;
            await A().set(['battle', 'mons', x.own.id, 'potUses', x.name], Math.max(0, had - 1));
          }
          if (L.per) await A().set(['battle', 'mons', x.own.id, 'potTurn', x.name], +ctx().b.turn || 0);
          if (L.sup) await A().set(['battle', 'mons', x.own.id, 'potTurn', '_sup', x.name], 1);
        }
        continue;
      }
      const a = potModApply(clausePick(FX().autoOf(ctx().b.mons[x.own.id] || x.own, x.kind === 'uq' ? 'pot' : x.kind, x.name), x.r.cl), PM);
      if (!a || !realOps(a) || a.manual) {
        notes.push(`${who} 『${x.name}』 — ${x.r.why}`);
        continue;
      }
      {
        const lm = x.kind === 'pot' && limManual(x.own, 'pot', x.name, x.eff);
        if (lm || !/【\s*자동\s*】/.test(x.eff)) {
          const q = `${why}\n\n${who} 『${x.name}』${lm ? ' (【N/시】)' : ''} 을(를) 발동할까?\n${String(x.r.cl || '').slice(0, 160)}`;
          if (!(await remoteAsk(x.own, 'confirm', { name: x.name, q }, () => askYes(q, '발동', '그만')))) continue;
        }
      } /* 11-17 망령 「이게 나한테 왜 보이냐고」(【함성】 『활력 충전』 — evReact 쪽은 아직 GM 창에서 물었다): 주인 자리에 묻는다 */
      let ok = false;
      try {
        ok = await fireAuto(
          x.own.id,
          x.kind === 'uq' ? 'pot' : x.kind,
          x.name,
          Object.assign(
            {
              auto: a,
              quiet: true,
              noEv: x.kind === 'trait' ? 0 : 1,
              /* 11-15: 계기로 터진 특성도 「「특성 : X」가 발동했을 때」를 잇는다 (유대변화 → 『무관, 무능의 멍에를 벗고』 나굴닌자) */ head: `【${K}】 ${who} 『${x.name}』 — ${x.r.why}`,
              eff: x.eff
            },
            x.r.pick ? { pickId: x.r.pick } : {},
            ev === 'hit'
              ? { ctx: { oppId: o.mid, taken: +o.dmg || 0 } }
              : ev === 'guard'
                ? { ctx: { oppId: o.mid, taken: 0 } }
                : ev === 'ko'
                  ? { ctx: { koId: o.tgt } }
                  : {},
            x.kind === 'uq' ? { uq: 1 } : {}
          )
        );
      } catch (e) {
        console.warn('evReact', e);
      }
      if (ok && ev === 'ko')
        await A().set(['battle', 'mons', x.own.id, 'shoutT'], +ctx().b.turn || 0); /* 11-15: 【함성】 발동한 턴 (『폭식의 대죄』 ③) */
      if (ok && (PM.heal || PM.cure || PM.nosup))
        A().sysLog(
          `【전용】 ${x.own.name} 『${PM.heal ? PM.heal[2] : PM.cure || PM.nosup}』 — 『${x.name}』${PM.heal ? ' 회복 ' + PM.heal[0] + '→' + PM.heal[1] : ''}${PM.cure ? ' · 상태 이상 치유' : ''}${PM.nosup ? ' · 【보급】 없음' : ''}`,
          'battle',
          { mid: x.own.id }
        );
      if (ok && L) {
        const cur = ctx().b.mons[x.own.id] || x.own;
        if (L.mmax != null) {
          const u = (cur.potUses || {})[x.name];
          const had = u == null ? L.mmax : +u;
          await A().set(['battle', 'mons', x.own.id, 'potUses', x.name], Math.max(0, had - 1));
        }
        if (L.per) await A().set(['battle', 'mons', x.own.id, 'potTurn', x.name], +ctx().b.turn || 0);
        if (L.sup) await A().set(['battle', 'mons', x.own.id, 'potTurn', '_sup', x.name], 1);
      }
      if (ok && x.kind === 'uq') {
        const tt = (ctx().b.trainers || {})[x.t.id] || x.t;
        if (x.q.mmax != null) {
          const v = (tt.uUses || {})[x.name];
          await A().set(['battle', 'trainers', x.t.id, 'uUses', x.name], Math.max(0, (v == null ? x.q.mmax : +v) - 1));
        }
        if (x.q.per) await A().set(['battle', 'trainers', x.t.id, 'uTurn', x.name], +ctx().b.turn || 0);
      }
    }
    if (notes.length) A().sysLog(`【계기】 발동 조건을 만족한 효과 (구문이 없어 손으로)\n${[...new Set(notes)].join('\n')}`, 'battle', { gmPriv: 1 });
  }
  async function evFlush() {
    const q = EVQ;
    EVQ = [];
    for (const [ev, o] of q) {
      try {
        await evReact(ev, o);
      } catch (e) {
        console.warn('evFlush', e);
      }
    }
  }
  /* 날씨가 바뀌는 순간 (기술 · 특성 · 효과 엔진 · 손으로 어느 길이든) */
  /* 11-10 망령 「「소지품 : 왕의징표석」인 포켓몬이 PT에 없거나 빈사일 때 이 포텐셜을 무효화하고 「특성 : 무기력」」: 「동안」 효과(fx whiles)를 상태가 바뀔 때마다 다시 본다 — 빈사 · 교대 · 부활 · 소지품 변화 */
  let whileBusy = false;
  async function whileWatch() {
    const c = ctx();
    const b = c.b;
    if (!c.mgr || !b || !b.started || whileBusy || !FX() || !FX().whileSync) return;
    if (!isLeader(c)) return;
    if (!Object.values(b.mons || {}).some(m => m && m.entry && m.fx && Array.isArray(m.fx.whiles) && m.fx.whiles.length)) return;
    whileBusy = true;
    try {
      const nb0 = snap(),
        nb = snap(nb0);
      const L = FX().whileSync(nb);
      if (L.length && (await saveBattle(nb0, nb))) A().sysLog(`【조건 효과】\n${L.join('\n')}`, 'battle');
    } finally {
      whileBusy = false;
    }
  }
  /* 11-10 망령 「(이때다!는) 기술이 아니라 빈사 상태인 아군 3체 이상, 혹은 『에이스』끼리 대면했을 때 자동으로 이때다!에 돌입해」:
    진영마다 ① 그 진영의 빈사 포켓몬(벤치 포함) 3체 이상 ② 그 진영의 『에이스』(분류 에이스 포함)와 상대 『에이스』가 정면(같은 에리어 맞은편)에 서 있음 — 이면 자진 설치물 「이때다!」(계속).
    조건이 풀리면 거둔다 (황금극장 등으로 이미 깔려 있던 남은 턴은 되돌려 둔다 — field.itdaAuto[진영] = {prev}). GM 리더 창만 */
  let itdaBusy = false;
  async function itdaWatch() {
    const c = ctx();
    const b = c.b;
    if (!c.mgr || !b || !b.started || itdaBusy) return;
    if (!isLeader(c)) return;
    const N = '이때다!';
    const mons = Object.values(b.mons || {}).filter(Boolean);
    const live = m => m.entry && m.hp && +m.hp.cur > 0;
    const isAce = m => {
      try {
        return rolesOf(m).includes('에이스');
      } catch (e) {
        return false;
      }
    };
    const want = {};
    for (const sd of ['left', 'right']) {
      const why = [];
      const fainted = mons.filter(m => m.side === sd && m.hp && +m.hp.cur <= 0).length;
      if (fainted >= 3) why.push(`빈사 ${fainted}체`);
      const ace = mons
        .filter(m => m.side === sd && live(m) && isAce(m))
        .find(m => mons.some(e => e.side && e.side !== sd && live(e) && e.entry === m.entry && isAce(e)));
      if (ace) {
        const foe = mons.find(e => e.side && e.side !== sd && live(e) && e.entry === ace.entry && isAce(e));
        why.push(`『에이스』 ${ace.name} ↔ ${foe.name} 대면`);
      }
      want[sd] = why;
    }
    const f = b.field || {};
    const O = f.objects || {};
    const A0 = f.itdaAuto || {};
    let need = false;
    for (const sd of ['left', 'right']) {
      const au = !!A0[sd],
        has = +(O[sd] || {})[N] > 0;
      if ((want[sd].length && !(au && has)) || (!want[sd].length && au)) {
        need = true;
        break;
      }
    }
    if (!need) return;
    itdaBusy = true;
    try {
      const nb0 = snap(),
        nb = snap(nb0);
      nb.field = nb.field || {};
      nb.field.objects = nb.field.objects || { left: {}, right: {} };
      nb.field.itdaAuto = Object.assign({}, nb.field.itdaAuto || {});
      const L = [];
      for (const sd of ['left', 'right']) {
        const ob = (nb.field.objects[sd] = nb.field.objects[sd] || {});
        const au = nb.field.itdaAuto[sd];
        const w = want[sd];
        if (w.length && (!au || !(+ob[N] > 0))) {
          if (!au) {
            nb.field.itdaAuto[sd] = { prev: +ob[N] || 0 };
            L.push(`${SIDE_KO[sd] || sd} 「이때다!」 돌입 — ${w.join(' · ')}`);
          }
          ob[N] = 1000;
        } else if (!w.length && au) {
          const pv = +au.prev || 0;
          if (pv > 0 && pv < 1000) ob[N] = pv;
          else delete ob[N];
          delete nb.field.itdaAuto[sd];
          L.push(`${SIDE_KO[sd] || sd} 「이때다!」 조건이 풀렸다${pv > 0 && pv < 1000 ? ' (남은 ' + pv + '턴은 그대로)' : ''}`);
        }
      }
      if (L.length && (await saveBattle(nb0, nb))) A().sysLog(`【이때다!】\n${L.join('\n')}`, 'battle');
    } finally {
      itdaBusy = false;
    }
  }
  /* 11-22 망령 「냉기 · 매직미러 처리 코드를 만들어」: 웹툴이 직접 처리하는 특성(맞았을 때 반응 hitRules · 매직미러 반사 · 드래곤스케일)이 터지면 그 포켓몬에 trFire {n, k} 를 남기고,
    진행 화면(isLeader)이 보고 「특성 : X」가 발동했을 때 계기(evReact trait · traitFired)를 돌린다 — 받는 쪽 화면이 PL 이어도 GM 화면에서 */
  /* 11-23 망령 「공생은 즉시」: 아군이 소지품을 소비해 빈손이 되면(itemUsed = 이번 턴) 곧바로 「공생」 포켓몬이 자신의 소지품을 건넨다 — 진행 담당 화면이 상태를 받는 대로 */
  const SYM_SEEN = {};
  async function symWatch() {
    const c = ctx();
    const b = c.b;
    if (!c.mgr || !b || !b.started || !isLeader(c)) return;
    const T = +b.turn || 0;
    const nI = v =>
      String(v || '')
        .replace(/[『』]/g, '')
        .trim();
    for (const x of Object.values(b.mons || {})) {
      if (!x || !x.entry || !(x.hp && x.hp.cur > 0) || nI(x.item) || !x.itemUsed || +x.itemUsed.turn !== T) continue;
      const key = x.id + '|' + T + '|' + nI(x.itemUsed.name);
      if (SYM_SEEN[key]) continue;
      const g = Object.values(b.mons || {}).find(
        z => z && z.id !== x.id && z.entry && z.hp && z.hp.cur > 0 && sameT(z, x, b) && nI(z.item) && abNm(z).replace(/『|』|\s/g, '') === '공생'
      );
      if (!g) continue;
      SYM_SEEN[key] = 1;
      const it = nI(g.item),
        ef = g.itemEff || '';
      await A().setMany([
        [['battle', 'mons', g.id, 'item'], ''],
        [['battle', 'mons', g.id, 'itemEff'], ''],
        [['battle', 'mons', x.id, 'item'], it],
        [['battle', 'mons', x.id, 'itemEff'], ef],
        [
          ['battle', 'mons', x.id, 'itemGot'],
          [...(x.itemGot || []), it]
        ]
      ]);
      A().sysLog(`【특성】 ${g.name} 「공생」 — ${x.name}에게 「${it}」을(를) 건넸다`, 'battle', { mid: g.id });
    }
  }
  const TR_SEEN = {};
  async function trWatch() {
    const c = ctx();
    const b = c.b;
    if (!c.mgr || !b || !b.started || !FX()) return;
    for (const m of Object.values(b.mons || {})) {
      const f = m && m.trFire;
      if (!f || !f.k || !f.n) continue;
      const key = m.id + '|' + f.k;
      if (TR_SEEN[key]) continue;
      TR_SEEN[key] = 1;
      if (Date.now() - (+f.k || 0) > 180000) continue;
      if (!isLeader(c)) continue;
      try {
        await traitFired(m.id, f.n);
      } catch (e) {
        console.warn('traitFired', e);
      }
      try {
        await evReact('trait', { mid: m.id, name: f.n, key: 'tr' + f.k, opp: f.opp || '' });
      } catch (e) {
        console.warn('evReact trait', e);
      }
    }
  }
  /* 11-26 망령 「위압은 왜 손으로 발동이지?」(코랄리 『홍마룡왕의 위압』 「「타입 : 불꽃」이 된 상대가 다음에 내보내는 기술에 「우선도 : -1」」): 필드 포켓몬의 타입이 새로 X 를 얻으면 계기 「「타입 : X」이 된 상대」 — evReact typed (대상 = 그 포켓몬) */
  /* 11-26 09:38 망령 (「상대를 「타입 : 불꽃」으로 만들었을 때 「폭탄」 상태로 만든다」): 「(상대)를 … (으)로 만들었을 · 바꿨을 때」 꼴도 같은 계기로 읽는다 — 누가 바꿨는지는 따지지 않는다(그 포켓몬이 그렇게 되었으면) */
  function becameEv(kind, t, mm, o, b, ok) {
    const d = b.mons[o.tgt];
    if (!d) return null;
    const re = new RegExp(
      '(?:(자신|아군|상대|대상|적)(?:\\s*포켓몬)?(?:이|가|의|을|를)?\\s*)?「\\s*' +
        kind +
        '\\s*:\\s*([^」]+)」\\s*(?:(?:이|가|으로|로)?\\s*(?:되었을|됐을|바뀌었을|변했을|변경\\s*되었을|만들었을|바꿨을|바꾸었을|변경\\s*했을|변화시켰을)\\s*때|(?:이|가)\\s*된\\s*(상대|대상|아군|적))',
      'g'
    );
    let r;
    while ((r = re.exec(t))) {
      const w = r[1] || r[3] || '자신';
      const rel = d.id === mm.id ? 'self' : sameT(mm, d, b) ? 'ally' : 'foe';
      if ((w === '자신' ? 'self' : w === '아군' ? 'ally' : 'foe') !== rel) continue;
      if (!ok(r[2].trim(), d)) continue;
      return { why: `${d.name} 「${kind} : ${r[2].trim()}」(이)가 되었다`, pick: o.tgt, cl: clauseAt(t, r.index) };
    }
    return null;
  }
  window.OM_ORDATK = m => {
    try {
      return ordAtk(ctx().b, m);
    } catch (e) {
      return false;
    }
  }; /* 11-26 364 구문 「대상수세 · 대상공세」가 묻는다 */
  const TY_SEEN = {};
  const nPV = x => String(x || '').replace(/[『』「」\s]/g, '');
  /* 11-26 07:04 망령 「상대가 특정 타입 · 소지품 · 특성이 되었을 때는 트리거로 많이 쓰니까 추가」: 필드 포켓몬의 타입 · 소지품 · 특성이 바뀌면 계기 typed · itemed · abiled (처음 본 포켓몬 = 막 나온 것은 기준만 잡는다) */
  async function typeWatch() {
    const c = ctx();
    const b = c.b;
    if (!c.mgr || !b || !b.started || !FX()) return;
    const bk = String(b.started);
    const seen = TY_SEEN[bk] || (TY_SEEN[bk] = {});
    const Q = [];
    for (const m of Object.values(b.mons || {})) {
      if (!m || !m.entry || !m.hp || m.hp.cur <= 0) {
        if (m) delete seen[m.id];
        continue;
      }
      const ty = tysOf(m).filter(x => x && x !== '-');
      const it = IOFF(m)
        ? []
        : [m.item]
            .concat((m.items2 || []).map(q => q && q.item))
            .map(nPV)
            .filter(x => x && x !== '-');
      const ab = nPV(m.ability);
      const old = seen[m.id];
      seen[m.id] = { ty, it, ab };
      if (!old) continue;
      const ta = ty.filter(x => !old.ty.includes(x));
      if (ta.length) Q.push(['typed', { tgt: m.id, tys: ta, key: m.id + ':ty:' + ta.join(',') + ':' + Date.now() }]);
      const ia = it.filter(x => !old.it.includes(x));
      if (ia.length || (!it.length && old.it.length))
        Q.push(['itemed', { tgt: m.id, its: ia, none: !it.length, key: m.id + ':it:' + ia.join(',') + ':' + Date.now() }]);
      if (ab !== old.ab) Q.push(['abiled', { tgt: m.id, ab, key: m.id + ':ab:' + ab + ':' + Date.now() }]);
    }
    for (const [ev, o] of Q) await evReact(ev, o);
  }
  const WX_SEEN = {};
  async function weatherWatch() {
    const c = ctx();
    const b = c.b;
    if (!c.mgr || !b || !b.started) return;
    const bk = String(b.started);
    const w = String(((b.field || {}).weather || {}).type || '');
    if (!(bk in WX_SEEN)) {
      WX_SEEN[bk] = w;
      return;
    }
    if (WX_SEEN[bk] === w) return;
    WX_SEEN[bk] = w;
    if (w) await evReact('weather', { w, key: w + '@' + (Date.now() >> 10) });
  }
  const EVENT_RE =
    /받았을 때|받을 때 \d할|맞았을 때|했을 때|내보낼 때|내보냈을 때|쓰러뜨렸을|빈사(?:가| 상태가)? 되었을|상태가\s*(?:되었을|됐을)\s*때|교대(?:했을|할) 때|등장했을 때|턴 개시|【(?:등장|턴 종료|선행|사전|퇴장|함성|보급|탈진|지연|자동)/;
  function passiveOps(ops, text) {
    ops = (ops || []).filter(o => o && !['baseup', 'statadd', 'none'].includes(o.k));
    if (!ops.length)
      return false; /* 11-03 22:40: 시트 몫(종족치 · 실수치) · 「없음」은 빼고 본다 — 차원의 특권(종족치 + 면역 이상) 같은 것의 면역이 등장 때 걸리게 */
    /* 11-03: 특수 효과(sp — 추가공격 · 보호 · 회피 …)는 그 자체가 조건부 규칙이라 글에 「~했을 때」가 있어도 나올 때 걸어 둔다 */ if (
      ops.every(o => o && o.k === 'sp')
    )
      return true;
    if (ops.every(o => o && o.whl))
      return true; /* 11-10 「동안」 줄(특성 · 종족치변경 · 포텐셜무효 + 조건 + 동안)은 조건 자체가 규칙 — 나올 때 걸어 두고 whileWatch 가 맞을 때만 켠다 */
    /* 줄이 여럿(①②…)이면 첫 줄만 본다 — 구문은 대개 ① 몫이고, 뒤 줄의 계기(【등장 (죽어내밀기)】 · 【지연】 …)는 따로 (디스럽터 ① …) */
    const t = String(text || '');
    let first = /[①②③④⑤]/.test(t) ? t.split(/[②③④⑤]/)[0] : t;
    /* 11-09 감우 54-B: 판정마다 굴리는 확률 지속 줄(위력 · 완화 · 회피 · 강화무시 · 우선도 · 비례무시)과, 「기술:X」 같은 조건이 붙은 지속 줄은 「~를 내보낼 때」 · 「N할로」가 글에 있어도 등장 때 걸어 둔다 (판정은 그때그때) */
    const PCK = o => ['boost', 'guard', 'eva', 'ignoreup', 'prio', 'noind'].includes(o.k) && !o.turn && o.dur !== 'turn';
    const condL = ops.every(o => PCK(o) && (o.p || o.pl || (FX() && FX().hasCond && FX().hasCond(o))));
    if (condL) first = first.replace(/(?:를|을)?\s*(?:내보낼|내보냈을|사용할|사용했을)\s*때/g, ' ');
    /* 11-18 망령 「맥 콘 글린 『환상을 먹다』 【보급】/「페어리」 공격을 받으면 무효화한다」: 횟수가 붙은 완화 줄뿐이면(완화 ×0 타입:페어리 1회) 【보급】 이어도 등장 때 걸어 두고 막을 때 깎는다 */
    if (/【\s*(?:보급|탈진)\s*】/.test(first) && ops.every(o => o && (o.k === 'guard' || o.k === 'boost') && +o.uses > 0))
      first = first.replace(
        /【\s*(?:보급|탈진)\s*】/g,
        ''
      ); /* 11-25 익스펜션 : 노말 【탈진】 위력 ×1.33 1회 — 등장 때 걸어 두고 한 번 쓰면 사라짐 */ /* 11-23 위력 줄(… 1회)도 — 등장 때 걸어 두고 쓰면 깎는다 */
    if (EVENT_RE.test(first) || (!condL && /\d할(?:로|의)|\d+%\s*(?:확률|로)/.test(first))) return false;
    /* 고르는 대상(아군 1체 · 상대 1체 · 에리어)이 든 구문은 등장 때 묻게 되니 손으로 */
    return ops.every(o => o && (PASSIVE_K.includes(o.k) || o.whl) && (!(o.p || o.pl) || PCK(o)) && !['ally1', 'enemy1', 'area'].includes(o.tgt));
  }
  /* 11-03 20:44 망령 「커맨더 · 옵저버 · 프렌드가드」: 【방호】(또는 「필드 위에 있는 한」) 줄이 아군 · 상대에게 거는 지속 효과인데, 다른 줄의 계기(【탈진】 …)나 「아군 1체」 대상 때문에 등장 때 안 걸리던 것.
    그 줄에 계기 말이 없으면 등장 때 건다 — 「아군 1체」 → 자신 제외 아군 전체, 「상대 1체」 → 상대 전체. 필드에 있는 동안 새로 나온 포켓몬에게도(reAura), 떠나면 풀린다(release) */
  function auraOf(a, etx) {
    const ops = a && a.ops;
    if (!ops || !ops.length || ops.some(o => !o || o.k === 'choice' || !PASSIVE_K.includes(o.k) || o.p || o.pl)) return null;
    if (!ops.some(o => ['ally1', 'enemy1', 'allyx', 'ally', 'enemy', 'others', 'all'].includes(o.tgt)) || passiveOps(ops, etx)) return null;
    const cl = String(etx || '')
      .split(/(?=[①②③④⑤])/)
      .find(
        c =>
          /【방호】|필드\s*(?:위)?에\s*있는\s*(?:한|동안)/.test(c) &&
          /아군|상대|이외/.test(c) &&
          !EVENT_RE.test(c.replace(/【(?:방호|유일|수세)】/g, ''))
      );
    if (!cl) return null;
    return JSON.parse(
      JSON.stringify(ops)
        .replace(/"tgt":"ally1"/g, '"tgt":"allyx"')
        .replace(/"tgt":"enemy1"/g, '"tgt":"enemy"')
    );
  }
  /* 자기 등급 조건: 「공격 : B」 이하일 때 · 「방어 : C」 이하일 때 — 포켓몬 등급표(m.ranks: HP 공격 방어 특공 특방 스피드)를 본다 */
  const GR_IDX = { HP: 0, 공격: 1, 방어: 2, 특공: 3, 특방: 4, 스피드: 5 };
  function gradeVal(g) {
    g = String(g || '').trim();
    const base = S().strip ? S().strip(g) : g.replace(/[+-]$/, '');
    const i = (S().RANKS || ['E', 'D', 'C', 'B', 'A', 'AA', 'AAA', 'S']).indexOf(base);
    if (i < 0) return null;
    return i * 3 + (/\+$/.test(g) ? 1 : /-$/.test(g) ? -1 : 0);
  }
  function gradeCond(m, ops, text) {
    if (!ops || ops.length !== 1 || ops[0].k !== 'choice') return null;
    const t = String(text || '');
    const mm = t.match(/「(HP|공격|방어|특공|특방|스피드)\s*:\s*([A-Z]{1,3}[+-]?)」\s*(이하|이상)일 때/);
    if (!mm) return null;
    if (/①[\s\S]*②/.test(t) && !/^[^②]*「(HP|공격|방어|특공|특방|스피드)\s*:/.test(t)) return null; /* 조건이 ①이 아닌 줄에만 있으면 손으로 */
    const cur = gradeVal((m.ranks || [])[GR_IDX[mm[1]]]),
      lim = gradeVal(mm[2]);
    if (cur == null || lim == null) return null;
    const opt = (ops[0].opts || [])[0];
    if (!opt || !(opt.ops || []).length) return null;
    return { ok: mm[3] === '이하' ? cur <= lim : cur >= lim, ops: opt.ops };
  }
  /* 날씨 · 필드 조건 스피드 (엽록소 · 쓱쓱 · 모래헤치기 · 눈치우기 · 야행성 · 음속 활강 …): 특성 · 포텐셜 글을 보고 순서 계산 때 곱한다 */
  function spMulOf(m, f) {
    let v = 1;
    const why = [];
    const W = (() => {
        let b0 = null;
        try {
          b0 = ctx().b;
        } catch (e) {}
        return b0 && wxNeg(b0) ? '' : String((f.weather || {}).type || '');
      })(),
      TR = String((f.terrain || {}).type || '');
    const wOk = x => x === W || (x === '눈' && W === '싸라기눈') || (x === '싸라기눈' && W === '눈');
    const srcs = [
      [m.ability, m.abilityEff],
      ...potSrc(m)
        .filter(p => p && !p.ph)
        .map(p => [p.name, p.eff])
    ];
    for (const [n, e] of srcs) {
      const t = String(e || '');
      const re = /「(날씨|필드)\s*:\s*([^」]+)」일 때[^.①②③]*?「스피드」(?:를|가|이)\s*(?:(\d+(?:\.\d+)?)배|강화\((\d+(?:\.\d+)?)배\))/g;
      let r;
      while ((r = re.exec(t))) {
        const x = r[2].trim();
        const ok = r[1] === '날씨' ? x.split(/[,/·]\s*/).some(wOk) : TR === x;
        if (!ok) continue;
        const k = +(r[3] || r[4]);
        if (k > 0) {
          v *= k;
          why.push(`${m.name} 「${n}」 스피드 ×${k}`);
        }
      }
    }
    return { v, why };
  }
  /* -스킨 특성 (페어리스킨 · 스카이스킨 · 프리즈스킨 · 일렉트릭스킨 · 노말스킨): 기술 타입을 바꾸고 위력을 강화 */
  function skinOf(m, mv) {
    const t = String((m && m.abilityEff) || '');
    if (!mv || mv.cat === '변화') return null;
    let r = t.match(/자신의 「노말」 기술(?:을|이) 「([^」]+)」 (?:기술로 만들고|기술이 되고|타입으로 하고)[^.]*?강화\((\d+(?:\.\d+)?)배\)/);
    if (r && mv.typeEn === 'Normal') {
      const ty = S().typeEn(r[1]);
      return ty ? { ty, mul: +r[2], name: m.ability } : null;
    }
    r = t.match(/자신의 기술을 「노말」 기술로 (?:만들고|변경하고)[^.]*?강화\((\d+(?:\.\d+)?)배\)/);
    if (r) return { ty: 'Normal', mul: +r[1], name: m.ability };
    return null;
  }
  /* 11-08 23:30 감우 (검토): 소지품 규칙(OM_ITEMS — 공격 창 「소지품」 칸 · 반감열매)이 이미 하는 위력 강화 · 받는 대미지 완화를 레디메이드가 등장 때 또 걸어 ×1.44 가 되던 것(플레이트 · 도폿열매 …) — 겹치는 줄은 빼고 나머지(보호 · 지속 연장 …)만 */
  function itemAutoDedupe(a, name) {
    if (!a || !a.ops || !a.ops.length) return a;
    const r = OI() && OI().rule ? OI().rule(name) : null;
    if (!r) return a;
    const drop = new Set();
    if (r.atk) drop.add('boost');
    if (r.resist || r.guard || r.def || r.half || r.immune) drop.add('guard');
    if (!drop.size) return a;
    const ops = a.ops.filter(o => !(o && drop.has(o.k)));
    if (ops.length === a.ops.length) return a;
    return ops.length ? Object.assign({}, a, { ops }) : null;
  }
  /* 11-23 특성 예지몽: 【등장 (자신 또는 상대)】/「정면」의 기술 배치를 주인에게만 보여 준다 */
  function yejiShow(mid) {
    try {
      const b = ctx().b;
      const m = b.mons[mid];
      if (!m || !m.entry) return;
      const isY = x => abNm(x).replace(/『|』|\s/g, '') === '예지몽';
      const foes = Object.values(b.mons || {}).filter(x => x && x.entry && x.hp && x.hp.cur > 0 && !sameT(x, m, b) && x.entry === m.entry);
      const mvL = x =>
        MVS(x)
          .map(v => v && v.name)
          .filter(Boolean)
          .join(' · ') || '(기술 없음)';
      for (const f of foes) {
        if (isY(m)) A().sysLog(`【특성】 ${m.name} 「예지몽」 — 정면 ${f.name}의 기술 배치: ${mvL(f)}`, 'battle', { gmPriv: 1, mid: m.id });
        if (isY(f)) A().sysLog(`【특성】 ${f.name} 「예지몽」 — 정면 ${m.name}의 기술 배치: ${mvL(m)}`, 'battle', { gmPriv: 1, mid: f.id });
      }
    } catch (e) {
      console.warn('예지몽', e);
    }
  }
  /* 11-23 망령 「선택형은 발동 여부 물어보고」: 「「특성 : X」… 변경할 수 있다」 포텐셜은 등장 때 물어 trOpt[포텐셜 이름] 에 적는다 (【N/시】 는 시합에 한 번만 묻는다) — fx traitMods 가 읽는다 */
  async function traitAsk(mid) {
    try {
      const m = ctx().b.mons[mid];
      if (!m || !FX() || !FX().traitMods) return;
      const cans = FX().traitMods(m).cans || [];
      const seen = {};
      for (const x of cans) {
        if (seen[x.pot]) continue;
        seen[x.pot] = 1;
        const cur = (ctx().b.mons[mid].trOpt || {})[x.pot];
        const pp = potSrc(m, 1).find(q => q && q.name === x.pot);
        const L = pp ? limOf(pp, ctx().b.mons[mid].potUses || {}, ctx().b.mons[mid].potTurn || {}) : { left: null };
        /* 11-23 【N/시】 선택형: 한 번 적용했으면(1) 다음 등장부터는 꺼 둔다(-1) — 「적용 안 함」(0)이면 다음 등장 때 다시 묻는다 */ if (
          x.once &&
          (cur === 1 || cur === -1)
        ) {
          if (cur === 1) await A().set(['battle', 'mons', mid, 'trOpt', x.pot], -1);
          continue;
        }
        if (L.left !== null && L.left <= 0 && L.mmax != null) {
          if (cur === 1) await A().set(['battle', 'mons', mid, 'trOpt', x.pot], -1);
          continue;
        }
        const y = await askYes(`${m.name} 『${x.pot}』\n${x.line}\n\n이번에 적용할까요?`, '적용', '적용 안 함');
        await A().set(['battle', 'mons', mid, 'trOpt', x.pot], y ? 1 : 0);
        if (y && x.once && L.mmax != null) {
          const u = (ctx().b.mons[mid].potUses || {})[x.pot];
          await A().set(['battle', 'mons', mid, 'potUses', x.pot], Math.max(0, (u == null ? L.mmax : +u) - 1));
        }
        if (y) A().sysLog(`【포텐셜】 ${m.name} 『${x.pot}』 — 적용`, 'battle', { mid });
      }
    } catch (e) {
      console.warn('traitAsk', e);
    }
  }
  /* 11-23 망령 「반드시 발동은 특성 그냥 발동시키면 되지」: 공격을 받았을 때 발동하는 특성(백스텝 …)에 「…「특성 : X」가 반드시 발동한다」 포텐셜 조건이 맞으면 그 특성을 강제로 발동시킨다 (자크 『독점액의 탄력』 — 【N/시】 를 센다) */
  const ANUL_RE =
    /【\s*방호\s*】[^\/\n]*\/\s*아군이\s*「([^」:]+)」\s*기술(?:\s*[(（]대미지[)）])?을\s*받으면\s*무효화하고\s*「([^」:]+?)\s*:\s*([+\-]\d+)」/;
  /* 11-23 「아군이 「타입」 기술(대미지)을 받으면 무효화하고 「능력치 : +N」」 — 맞는 쪽 트레이너의 고유 · 같은 편 필드 포켓몬의 포텐셜. 【소진】 · 【N/시】는 limOf 로 */
  const ANULPICK = {};
  const anulKey = (atk, mv) => (atk && atk.id) + '|' + (mv && mv.name) + '|' + (+(ctx().b || {}).turn || 0);
  /* 11-23 08:59 망령 「소진이 동시에 발동할 땐 어느 쪽을 작동시킬지 선택」: 한 기술이 남은 횟수보다 많은 아군에게 맞으면 판정 전에 받는 쪽 주인에게 묻고(ANULPICK), 고른 쪽만 무효 */
  function anulAsk(atk, mv, types, defs, again) {
    try {
      if (!mv || mv.cat === '변화' || (defs || []).length < 2) return false;
      const b = ctx().b;
      const grp = {};
      for (const d of defs) {
        if (!d || d.id === atk.id) continue;
        const an = allyNul(b, d, types);
        if (!an || an.left === null) continue;
        const k = (an.tid || an.mid) + '|' + an.raw;
        (grp[k] = grp[k] || { an, ds: [] }).ds.push(d);
      }
      const K = anulKey(atk, mv);
      for (const k in grp) {
        const g = grp[k];
        if (g.ds.length <= g.an.left) continue;
        const pk = (ANULPICK[K] || {})[k];
        if (pk && pk.length && pk.every(id => g.ds.some(d => d.id === id))) continue;
        (async () => {
          let r = [];
          try {
            r = await uiCtx(b, g.ds[0], g.an.name).choose(
              g.ds.map(d => `${d.name}에게 적용`),
              false
            );
          } catch (e) {}
          const i = r && r.length ? +r[0] : 0;
          ANULPICK[K] = Object.assign({}, ANULPICK[K] || {}, { [k]: [(g.ds[i] || g.ds[0]).id] });
          again();
        })();
        A().toast(`『${g.an.name}』 — 어느 쪽에 적용할지 고르는 중`);
        return true;
      }
    } catch (e) {
      console.warn('anulAsk', e);
    }
    return false;
  }
  function allyNul(b, def, types, K) {
    try {
      if (!def) return null;
      const PK = (K && ANULPICK[K]) || {};
      const pkOk = (own, raw) => {
        const p = PK[own + '|' + raw];
        return !p || p.includes(def.id);
      };
      const tk = [];
      for (const t of types || []) {
        tk.push(String(t));
        try {
          tk.push(String(S().typeKo(t) || ''));
        } catch (e) {}
      }
      const chk = (p, uses, turns) => {
        const x = String((p && p.eff) || '')
          .replace(/<br\s*\/?>/g, '\n')
          .match(ANUL_RE);
        if (!x || !tk.includes(x[1].trim())) return null;
        const L = limOf(p, uses || {}, turns || {});
        if (L.left !== null && L.left <= 0) return null;
        return {
          name: String(p.name)
            .replace(/[『』]/g, '')
            .trim(),
          raw: p.name,
          stat: x[2].trim(),
          n: +x[3],
          mmax: L.mmax,
          per: L.per,
          left: L.left
        };
      };
      const t = (b.trainers || {})[def.tid];
      for (const u of (t && t.unique) || []) {
        if (!u || !u.name) continue;
        const r = chk(u, t.uUses, t.uTurn);
        if (r && pkOk(def.tid, u.name)) return Object.assign(r, { tid: def.tid });
      }
      for (const x of Object.values(b.mons || {})) {
        if (!x || x.id === def.id || !x.entry || !(x.hp && x.hp.cur > 0) || !sameT(x, def, b)) continue;
        for (const p of potSrc(x)) {
          const r = chk(p, x.potUses, x.potTurn);
          if (r && pkOk(x.id, p.name)) return Object.assign(r, { mid: x.id });
        }
      }
    } catch (e) {
      console.warn('allyNul', e);
    }
    return null;
  }
  const SUREHIT = {};
  async function sureHitFire(mid, lh) {
    try {
      const b = ctx().b;
      const m = b.mons[mid];
      if (!m || !m.entry || !(m.hp && m.hp.cur > 0) || !FX() || !FX().traitMods) return;
      if (!/받았을\s*때|받으면/.test(abTxt(m)) || hitRules(m).length) return;
      const tm = FX().traitMods(m);
      if (!tm.sure) return;
      const p = potSrc(m).find(q => q && q.name === tm.sure);
      if (!p) return;
      const L = limOf(p, m.potUses || {}, m.potTurn || {});
      if (L.left !== null && L.left <= 0) return;
      const key = mid + '|' + (+b.turn || 0) + '|' + ((lh && lh.fromId) || '');
      if (SUREHIT[key]) return;
      SUREHIT[key] = 1;
      if (L.mmax != null) {
        const u = (m.potUses || {})[p.name];
        await A().set(['battle', 'mons', mid, 'potUses', p.name], Math.max(0, (u == null ? L.mmax : +u) - 1));
      }
      await potMark(mid, p.name);
      await fireAuto(mid, 'trait', abNm(m), { force: true, head: `【포텐셜】 ${m.name} 『${p.name}』 — 「특성 : ${abNm(m)}」 반드시 발동` });
    } catch (e) {
      console.warn('sureHitFire', e);
    }
  }
  /* 11-23 (224번 남은 구멍): 오라 주인이 혼자 나왔다가 그 뒤에 아군(상대)이 처음 들어오는 경우 — 본뜰 기록(holds)도, 본뜰 다른 포켓몬도 없어 reAura 가 못 걸던 것. 필드의 다른 포켓몬이 가진 「있는 한」 · 【방호】 아군/상대 오라(특성 · 포텐셜)를 새로 들어온 포켓몬에게만 다시 건다 (이미 걸려 있으면 넘김 · 자신 몫은 뺀다) */
  async function auraLate(mid) {
    const b0 = ctx().b;
    const nm = (b0.mons || {})[mid];
    if (!nm || !nm.entry || !FX() || !b0.started) return;
    for (const x0 of Object.values(b0.mons || {})) {
      if (!x0 || x0.id === mid || !x0.entry || !(x0.hp && x0.hp.cur > 0)) continue;
      const list = [];
      if (x0.ability) list.push(['trait', x0.ability]);
      for (const p of potSrc(x0)) if (p && p.name && !p.ph && !potOffWhy(x0, p.name)) list.push(['pot', p.name]);
      for (const [kind, name] of list) {
        const x = ctx().b.mons[x0.id],
          cur = ctx().b.mons[mid];
        if (!x || !x.entry || !cur || !cur.entry) break;
        const a = FX().autoOf(x, kind, name);
        if (!a || !a.ops || !a.ops.length || a.manual) continue;
        const etx = a.text || slotEff(x, kind, name) || '';
        if (limManual(x, kind, name, etx)) continue;
        const tm = FX().timing(etx);
        if (tm.entry) continue;
        let au = auraOf(a, etx);
        /* 구문에 「있는한」이 붙은 상시 줄(반주 · 강철정신 · 승리의별 …)도 — 글에 「필드 위에 있는 한」이 없어 auraOf 가 못 잡는다 */ if (!au) {
          const H = a.ops.filter(o => o && o.hold && !o.p && !o.pl && o.k !== 'choice' && o.k !== 'cond');
          if (H.length && !a.ops.some(o => o && (o.k === 'cond' || o.k === 'choice')) && !tm.passive && !tm.turnEnd) au = H;
        }
        if (!au) continue;
        const ops = au.filter(o => o && o.tgt && o.tgt !== 'self');
        if (!ops.length) continue;
        const nq = String(name)
          .replace(/[『』]/g, '')
          .trim();
        if (JSON.stringify(cur.fx || {}).includes(nq + ' ← ' + x.name)) continue;
        await fireAuto(x.id, kind, name, {
          quiet: true,
          noRoll: true,
          noEv: 1,
          aura: 1,
          auto: { ops, text: etx },
          ctx: { tgtOk: m => !!m && m.id === mid },
          head: `【필드 효과】 ${x.name} 「${nq}」 — 나중에 들어온 ${cur.name}에게`
        });
      }
    }
  }
  async function autoOnEntry(mid, o2) {
    o2 = o2 || {};
    const c = ctx();
    const m = c.b.mons[mid];
    if (!m || !FX()) return;
    yejiShow(mid);
    await traitAsk(mid);
    const list = [];
    /* 11-28 o2.only = 이 포텐셜 이름들만 (페이즈 체인지로 막 켜진 상시 포텐셜을 그때 건다 — phaseReact) */
    const only = o2.only || null;
    if (m.ability && !only) list.push(['trait', m.ability]);
    if (m.item && !IOFF(m) && !only) list.push(['item', m.item]);
    for (const x of only ? [] : m.items2 || [])
      if (x && x.item && !IOFF(m) && !list.some(([k, n]) => k === 'item' && n === x.item))
        list.push(['item', x.item]); /* 11-08 23:12: 소지품 2 · 3번 칸의 상시 · 등장 효과도 */
    for (const p of [...(m.pots || []), ...(m.excl ? [m.excl] : []), ...(m.exclX || [])])
      if (p && p.name && !p.ph && !potOffWhy(m, p.name) && (!only || only.includes(p.name)))
        list.push(['pot', p.name]); /* 11-09 감우 54-G: 【준비】 불충족은 빼고 */
    /* 11-03 감우: 트레이너 고유 포텐셜도 같은 길로 — 【등장】 · 【상시】 이고 구문이 있으면 그 트레이너의 포켓몬이 나올 때 건다 (autoOf 가 m.tid 로 고유 구문을 읽는다). 횟수(【N/시】)가 있는 고유는 손으로(선행 · 임의 발동) */
    if (!only) {
      const t = (c.b.trainers || {})[m.tid];
      for (const u of (t && t.unique) || [])
        if (u && u.name && !/【\s*\d+\s*\/\s*(시|턴)\s*】/.test(String(u.eff || '')) && !list.some(([k, n]) => k === 'pot' && n === u.name))
          list.push(['pot', u.name]);
    }
    /* 11-07 망령 「등장 때 저절로 뜨는 상시류 로그는 본인(포켓몬 주인)만 보이게 + 「출력」 버튼」: 상시 · 지속형으로 걸린 줄(아래 noRoll 길)과 【N/시】 안내는 주인 귓속말(gmPriv — 이름은 예전 그대로, 주인이 없으면 GM)로. 【등장】 계기 효과 · 아군 빈사로 걸린 것(passiveOnly)은 그대로 공개 */ const GP =
      o2.passiveOnly ? 0 : 1;
    const MANL = [],
      FENT = [];
    for (const [kind, name] of list) {
      const a = kind === 'item' ? itemAutoDedupe(FX().autoOf(m, kind, name), name) : FX().autoOf(m, kind, name);
      if (!a || !a.ops || !a.ops.length || a.manual) continue;
      if (kind !== 'item' && HPT_RE.test(String(slotEff(m, kind, name) || ''))) continue;
      /* 11-23 「HP 이하가 되었을 때」 꼴은 hpTrigSweep 이 (등장 때 줄도) */ if (limManual(m, kind, name, slotEff(m, kind, name) || a.text)) {
        if (!MANL.includes(name)) MANL.push(name);
        continue;
      }
      /* 시트에 직접 쓴 구문은 글이 없으니 그 칸의 효과 글에서 【등장】/【상시】 를 읽는다 */ const tm = FX().timing(
        a.text || slotEff(m, kind, name) || ''
      );
      const etx2 = a.text || slotEff(m, kind, name) || '';
      /* 10-26 망령: 표시 없는 상시 특성 · 포텐셜 (테크니션 · 적응력 · 철주먹 · 멀티스케일 …) — 지속형 구문뿐이고 계기 말(받았을 때 · 턴 종료 …)이 없으면 등장 때 건다.
      「공격 : B」 이하일 때 같은 자기 등급 조건(천하장사 · 순수한힘 · 퍼코트 …)은 등급을 보고 맞으면 건다 */
      const gc = !tm.entry && !tm.passive && !tm.turnEnd ? gradeCond(m, a.ops, etx2) : null;
      if (gc) {
        if (gc.ok) {
          const cur = ctx().b.mons[mid];
          if (cur && (cur.fxDone || {})[name]) continue;
          if (await fireAuto(mid, kind, name, { quiet: true, noRoll: true, gmPriv: GP, auto: { ops: gc.ops, text: a.text } })) {
            const d = Object.assign({}, (ctx().b.mons[mid] || {}).fxDone || {});
            d[name] = 1;
            await A().set(['battle', 'mons', mid, 'fxDone'], d);
          }
        }
        continue;
      }
      {
        const au = !tm.entry ? auraOf(a, etx2) : null;
        if (au) {
          const cur = ctx().b.mons[mid];
          if (cur && (cur.fxDone || {})[name]) continue;
          if (await fireAuto(mid, kind, name, { quiet: true, noRoll: true, gmPriv: GP, aura: 1, auto: { ops: au, text: etx2 } })) {
            const d = Object.assign({}, (ctx().b.mons[mid] || {}).fxDone || {});
            d[name] = 1;
            await A().set(['battle', 'mons', mid, 'fxDone'], d);
          }
          continue;
        }
      }
      /* 줄마다 고르는 효과(선택:)에서 늘 켜져 있어야 할 줄만 (하이 블로커 ① 방호수세 …): 계기 말이 없는 지속형 줄을 등장 때 건다 */
      if (!tm.entry && a.ops.length === 1 && a.ops[0].k === 'choice') {
        const po = (a.ops[0].opts || []).filter(
          o =>
            o &&
            o.label &&
            /^[\s-]*[①②③④⑤]/.test(o.label) &&
            !/조건|등장|턴 종료|함성|보급|선행|사전|교대|빈사|받았을|했을|되었을|됐을|\d할/.test(o.label) &&
            passiveOps(o.ops, '')
        );
        if (po.length) {
          const cur = ctx().b.mons[mid];
          if (cur && (cur.fxDone || {})[name]) continue;
          if (await fireAuto(mid, kind, name, { quiet: true, noRoll: true, gmPriv: GP, auto: { ops: po.flatMap(o => o.ops), text: a.text } })) {
            const d = Object.assign({}, (ctx().b.mons[mid] || {}).fxDone || {});
            d[name] = 1;
            await A().set(['battle', 'mons', mid, 'fxDone'], d);
          }
        }
        continue;
      }
      if (
        kind === 'trait' &&
        !o2.passiveOnly &&
        (tm.entry || /【등장\s*\((?!\s*상대)/.test(String(etx2).split(/[②③④⑤]/)[0])) &&
        !(() => {
          /* 11-15: 【등장 (죽어내밀기)】 인데 다른 방식으로 나왔으면 「경호원으로 무효」 줄도 내지 않는다 (아래 방식 판정이 건너뜀) */ const h =
            String(etx2)
              .split(/[②③④⑤]/)[0]
              .match(/【등장\s*\(([^)]+)\)】/);
          if (!h) return false;
          const ws = h[1]
            .split(/[,·]/)
            .map(x => x.trim())
            .filter(x => /교대|죽어내밀기/.test(x));
          return ws.length > 0 && !ws.some(w => String(o2.how || '').includes(w));
        })()
      ) {
        const gd = guardOff(ctx().b, ctx().b.mons[mid] || m);
        if (gd) {
          A().sysLog(`【특성】 ${m.name} 『${String(name).replace(/[『』]/g, '')}』의 【등장】 — ${gd} 「경호원」으로 무효`, 'battle', { mid: m.id });
          continue;
        }
      } /* 11-09 감우 56: 상대 「경호원」 */
      /* 【등장 (통상 교대)】 · 【등장 (임의 교대)】 · 【등장 (죽어내밀기)】: 그렇게 나왔을 때만 (바운서 · 닌자 ②) */
      {
        const hx = String(etx2)
          .split(/[②③④⑤]/)[0]
          .match(/【등장\s*\(([^)]+)\)】/);
        /* 11-28 망령 「슬렌더 맨의 행방불명이 자신이 강제 교대로 등장했을 때 발동 체크 — 수정 필요」: 【등장 (상대, …)】 은 상대가 나올 때(foeInTrig) 몫 — 자신이 나올 때는 건너뛴다 */
        if (hx && tagHit(etx2, 'foeIn')) continue;
        if (hx && !tm.entry && !(a.ops.length === 1 && a.ops[0].k === 'choice')) {
          const abX = hx[1].match(/「특성\s*:\s*([^」]+)」/);
          /* 11-09 감우 55: 【등장 (「특성 : X」)】 = 그 특성일 때 나오면 (엔터프라이즈 『고스트 레기온』) */ const tyX =
            hx[1].match(/「타입\s*:\s*([^」]+)」/);
          /* 11-15 망령 「호타루 분석」: 【등장 (「타입 : X」)】 = 그 타입 포켓몬이 나오면 (호타루 고유 『허수 속에 범람하는 벌레의 무리』 — 전엔 방식 · 특성만 봐서 한 번도 안 걸렸다) */ const tyOk =
            tyX &&
            tyX[1]
              .split(/[,·\/]/)
              .map(z => S().typeEn(z.trim()))
              .filter(Boolean)
              .some(z => tysOf(m).includes(z));
          /* 11-18 망령 백감우 「【1/시】【등장 (선발, 「타입 : 얼음」)】」: 괄호 안 조건이 여럿이면 모두 맞아야 (방식 · 특성 · 타입 AND, 방식끼리는 OR). 전엔 하나만 맞아도 터져 얼음 아닌 선발에도 걸렸다 */ const hwX =
            hx[1]
              .replace(/「[^」]*」/g, '')
              .split(/[,·]/)
              .map(z => z.trim())
              .filter(Boolean);
          const howOk = !hwX.length || (!!o2.how && hx[1].replace(/\s/g, '').includes(String(o2.how).replace(/\s/g, '')));
          const abOk = !abX || abNm(m).replace(/\s/g, '') === abX[1].replace(/\s/g, '');
          const tyOk2 = !tyX || tyOk;
          if (!o2.passiveOnly && (hwX.length || abX || tyX) && howOk && abOk && tyOk2) {
            /* 고유의 【소진】 · 【탈진】: 그 트레이너 몫으로 센다 (선발 둘이 같은 턴에 둘 다 쓰던 것) */ const tU =
              (ctx().b.trainers || {})[m.tid] || {};
            const uq = (tU.unique || []).find(u => u && u.name === name);
            if (uq) {
              const L = limOf(uq, tU.uUses || {}, tU.uTurn || {});
              if (L.left !== null && L.left <= 0) continue;
            }
            const ok = await fireAuto(mid, kind, name, { quiet: true });
            if (ok && uq && /【\s*(소진|탈진)\s*】/.test(String(uq.eff || '')))
              await A().set(['battle', 'trainers', m.tid, 'uTurn', name], +ctx().b.turn || 0);
            if (ok && uq) {
              const L2 = limOf(uq, ((ctx().b.trainers || {})[m.tid] || {}).uUses || {}, {});
              if (L2.mmax != null)
                await A().set(
                  ['battle', 'trainers', m.tid, 'uUses', name],
                  Math.max(
                    0,
                    ((((ctx().b.trainers || {})[m.tid] || {}).uUses || {})[name] == null
                      ? L2.mmax
                      : +(((ctx().b.trainers || {})[m.tid] || {}).uUses || {})[name]) - 1
                  )
                );
            } /* 11-18: 【N/시】 고유도 여기서 한 번 센다 (선발 둘이 같이 나오면 두 번 터지던 것) */
          }
          continue;
        }
      }
      /* 11-07 23:44 망령 「강제 교대로 나온 포켓몬엔 【등장】 키워드는 격발하지 않아」: (강제 교대)가 붙은 【등장 (…)】 은 위에서 따로 — 그 밖의 【등장】 은 건너뛰고 이름만 알린다 */
      /* 11-13 21:21 망령 제보 「불굴의방패 두 번 등장하면 두 번 터진다 — 횟수제 특성의 횟수 적용이 안 돼 있다」: 특성 글 ① 줄의 【N/시】 = 시합 중 N번. 남은 횟수는 m.abUses[특성 이름] (교대해도 남는다) */
      if (tm.entry && kind === 'trait' && !o2.passiveOnly && o2.how !== '강제 교대') {
        const lm = String(etx2)
          .split(/[②③④⑤]/)[0]
          .match(/【\s*(\d+)\s*\/\s*시\s*】/);
        if (lm) {
          const mx = +lm[1];
          const cur = ctx().b.mons[mid] || m;
          const u = (cur.abUses || {})[name];
          const left = u == null ? mx : +u;
          if (left <= 0) {
            A().sysLog(
              `【특성】 ${m.name} 『${String(name).replace(/[『』]/g, '')}』 【${mx}/시】 — 이번 시합에서 이미 다 썼다 (발동하지 않는다)`,
              'battle',
              { mid: m.id }
            );
            continue;
          }
          if (await fireAuto(mid, kind, name, { quiet: true })) await A().set(['battle', 'mons', mid, 'abUses', name], left - 1);
          continue;
        }
      }
      if (tm.entry) {
        if (o2.how === '강제 교대') {
          if (!o2.passiveOnly && !FENT.includes(name)) FENT.push(name);
        } else if (!o2.passiveOnly) await fireAuto(mid, kind, name, Object.assign({ quiet: true }, kind === 'item' ? { auto: a } : {}));
      } else if (tm.passive || (!tm.turnEnd && passiveOps(a.ops, etx2))) {
        if (!condNow(ctx().b, ctx().b.mons[mid], a.ops)) continue;
        const cur = ctx().b.mons[mid];
        if (cur && (cur.fxDone || {})[name]) continue;
        if (await fireAuto(mid, kind, name, Object.assign({ quiet: true, noRoll: true, gmPriv: GP }, kind === 'item' ? { auto: a } : {}))) {
          const d = Object.assign({}, (ctx().b.mons[mid] || {}).fxDone || {});
          d[name] = 1;
          await A().set(['battle', 'mons', mid, 'fxDone'], d);
        }
      }
    }
    if (FENT.length)
      A().sysLog(`${m.name} — 강제 교대로 나와 【등장】 효과는 발동하지 않는다 (${FENT.map(n => '『' + n + '』').join(' ')})`, 'battle', {
        mid: m.id
      });
    /* 11-08 51-2 ⑧ 부스트에너지: 「고대활성」「쿼크차지」 포켓몬이 나올 때 조건(맑음 · 일렉트릭필드)이 없으면 소지품을 써서 특성 효과(가장 높은 능력 ×1.3 · 스피드 ×1.5)를 켠다 */
    if (!o2.passiveOnly) {
      const m1 = ctx().b.mons[mid];
      const ab = String((m1 && m1.ability) || '')
        .replace(/[『』]/g, '')
        .trim();
      if (m1 && m1.hp.cur > 0 && HAS(m1, '부스트에너지') && (ab === '고대활성' || ab === '쿼크차지')) {
        const fb = fieldOf(ctx().b);
        const on =
          ab === '고대활성' ? ['맑음', '큰가뭄'].includes(wxNow(ctx().b)) && !UMB(m1) : String((fb.terrain || {}).type || '') === '일렉트릭필드';
        const have = ((m1.fx || {}).mults || []).some(e => String(e.key || '').startsWith(ab + ' ← '));
        if (!on && !have) {
          if (
            await fireAuto(mid, 'trait', ab, {
              quiet: true,
              noRoll: true,
              auto: { ops: [{ k: 'mult', tgt: 'self', stats: {}, picks: [{ lo: 0, v: 1.3, spd: 1.5 }] }], text: '' },
              head: `【소지품】 ${m1.name} 「부스트에너지」 → 특성 『${ab}』`
            })
          )
            await itemConsume(mid, false, '부스트에너지');
        }
      }
    }
    if (MANL.length && !o2.passiveOnly)
      A().sysLog(
        `【포텐셜】 ${m.name} — ${MANL.map(n => '『' + n + '』').join(' ')} 【N/시】 — 저절로 쓰지 않는다 (【자동】이 없다 · 쓸 때 카드 「발동」 · 선행 입력)`,
        'battle',
        { gmPriv: 1, mid: m.id }
      );
  }
  /* 포켓몬마다 급소 규칙 (10-23 망령 · 제작기 상세 조정): tbl 급소 표 · add 급소 랭크 + · guard 받을 때 방호 · dmg 급소 대미지 배율 · sure 언제나 급소 · never 급소에 맞지 않음 */
  const CRR = m => (m && m.critRule) || {};
  /* 10-24 망령: 지시 급소 보정 (고정식, 오레마스 룰) — 상대 · 야생과 상관없이 공격 쪽 트레이너 「지시」 랭크값 − 3 (A +1 · AA +2 · AAA +3 · S +4). 야생 포켓몬(트레이너 없음)은 0.
    랭크값 E0 · D1 · C2 · B3 · A4 · AA5 · AAA6 · S7, 필드 위 포켓몬의 orderAlly/orderEnemy 를 더한다 (get_status_trainer) */
  function orderCrit(atk, def) {
    const b = ctx().b;
    const T = b.trainers || {};
    const ta = T[atk.tid];
    if (!ta || !def) return { v: 0 };
    const lv = t => {
      let v = S().RANKS.indexOf(S().strip((t.ranks || {})['지시']));
      if (v < 0) v = 0;
      for (const m of Object.values(b.mons || {})) if (m.entry) v += +(sameT(m, t, b) ? m.orderAlly : m.orderEnemy) || 0;
      return Math.min(7, Math.max(0, v));
    };
    const rk = t => S().strip((t.ranks || {})['지시']) || '-';
    const v = Math.max(0, lv(ta) - 3);
    return { v, txt: `${ta.name} 「지시」 ${rk(ta)} — 급소 +${v}` };
  }
  function crAdj(atk, def) {
    return (+CRR(atk).add || 0) - (+CRR(def).guard || 0);
  }
  /* 11-08 망령 「냥타 베어가르기 C+4 가 안 된다」: 기술 자체 급소 보정 「기술이 급소에 맞기 쉽다(C+N)」(베어가르기 등)과 「예리1 · 예리2」 상태(C+1 · C+2, 고유 『휘몰아치는 소드 댄스』 등)가 급소 랭크에 안 들어가던 것.
    기충전 · 드래곤옐은 engine/battle.js critStage 가 따로 더한다. 예리1 · 예리2 가 같이 있으면 큰 쪽 */
  function moveCritOf(mv) {
    const x = String((mv && mv.eff) || '').match(/급소에\s*맞기\s*쉽다\s*\(\s*C\s*\+\s*(\d)\s*\)/);
    return x ? +x[1] : 0;
  }
  function keenCritOf(m) {
    const s = (m && m.states) || {};
    return s.Keen2 ? 2 : s.Keen1 ? 1 : 0;
  }
  function critMulOf(atk) {
    return +CRR(atk).dmg || 0;
  }
  /* 강화 무시 (10-23 망령): 상승 · 감소 · 둘 다(모두) × 방어 · 회피(공격할 때) · 공격 · 명중(받을 때). 돌려줌 {def,eva,atk,acc} = statValue 의 ignore 코드 (0 상승 / 1 감소 / 6 둘 다) */
  /* 10-28 망령 (킬러 자동화): 『역할』은 포켓몬의 역할 포텐셜(m.role)에 있다 — 효과 엔진은 fx.roles 만 보던 탓에 『에이스』 상대 강화(킬러)가 안 걸렸다.
    역할 포텐셜 비고의 「『X』의 『상위 역할』」 · 「『X』『Y』는 동일한 『역할』 취급」도 같은 역할로 친다 */
  function rolesOf(m) {
    const out = new Set(((m && m.fx) || {}).roles || []);
    for (const k in (m && m.apt) || {}) if (aptOn(m, k)) out.add(k);
    const r = String((m && m.role) || '')
      .replace(/『|』/g, '')
      .trim();
    if (r) {
      out.add(r);
      const row = ((DB().maker || {}).pots || []).find(x => x && x[1] === r);
      const note = String((row && row[3]) || '');
      if (/상위 역할|동일한\s*『?역할/.test(note))
        for (const q of note.matchAll(/『([^』]+)』/g)) if (q[1] !== '역할' && q[1] !== '상위 역할') out.add(q[1]);
    }
    /* 11-05 망령 「역할은 분류로」: 분류(러너 · 어태커 · 블로커 · 에이스 · 서포터 · 킬러 계열)도 같이 — 하이 러너 · 닌자 = 러너 */
    if (FX() && (FX().roleFams || FX().roleFam))
      for (const x of [...out]) for (const f of FX().roleFams ? FX().roleFams(x) : [FX().roleFam(x)]) if (f && f !== x) out.add(f);
    return [...out];
  }
  function roleV(m) {
    if (!m) return m;
    let rs = rolesOf(m);
    /* 11-05 망령: 각성체 대가 A-2 — 각성 (대가)가 필드에 없으면 이 트레이너 아군의 역할이 전부 무효: 역할(킬러 상대 판정 등)도, 역할 포텐셜이 건 위력 강화 · 완화 · 회피도 계산에서 뺀다 */
    let mods = null;
    try {
      const off = misagA2Off(ctx().b, m);
      if (off) {
        rs = [];
        const nm = x =>
          String(x || '')
            .replace(/『|』/g, '')
            .trim();
        mods = ((m.fx || {}).mods || []).filter(e => !(off.names.has(nm(e.name)) && (!e.src || off.srcs.has(e.src))));
      }
    } catch (e) {}
    const cur = (m.fx || {}).roles || [];
    if (rs.length === cur.length && !mods) return m;
    return Object.assign({}, m, { fx: Object.assign({}, m.fx || {}, { roles: rs }, mods ? { mods } : {}) });
  }
  function iuIgnore(atk, def, q) {
    const sc = (iu, k) => !iu.scope || iu.scope === 'both' || String(iu.scope).split(',').includes(k);
    const code = iu => {
      const lv = iu.lv || '';
      if (iu.all) return lv === 'rank' ? 6 : lv === 'mod' ? 8 : 7;
      if (iu.dn) return lv === 'rank' ? 4 : lv === 'mod' ? 5 : 1;
      return lv === 'rank' ? 2 : lv === 'mod' ? 3 : 0;
    };
    const iu = (atk.fx || {}).ignoreUp,
      iuD = (def.fx || {}).ignoreUp;
    const o = {};
    const roOk = (x, who) => !x.ro || !x.ro.length || rolesOf(who).some(r => x.ro.includes(r)); /* 킬러: 『에이스』 상대일 때만 */
    const A1 = iu && (iu.dir === 'atk' || iu.dir === 'both') && roOk(iu, def),
      R1 = iuD && (iuD.dir === 'recv' || iuD.dir === 'both') && roOk(iuD, atk);
    o.nm = {};
    if (A1 && sc(iu, 'def')) {
      o.def = code(iu);
      o.nm.def = iu.name;
    }
    if (A1 && sc(iu, 'eva')) {
      o.eva = code(iu);
      o.nm.eva = iu.name;
    }
    if (R1 && sc(iuD, 'atk')) {
      o.atk = code(iuD);
      o.nm.atk = iuD.name;
    }
    if (R1 && sc(iuD, 'acc')) {
      o.acc = code(iuD);
      o.nm.acc = iuD.name;
    }
    /* 11-09 감우 54-C: 조건부 강화 무시 목록(fx iuL) — 기술 · 상대 타입 · 필중기 · 급소 랭크 · 확률 */ try {
      if (FX() && FX().iuList && q) {
        const X = FX().iuList(atk, def, q);
        for (const k of ['def', 'eva', 'atk', 'acc'])
          if (o[k] == null && X[k]) {
            o[k] = X[k].code;
            o.nm[k] = X[k].name;
          }
      }
    } catch (e) {}
    /* 11-15 망령 「거짓된 성녀 — 일루젼이 작동할 때만」: 「「X」의 모습일 때 【방호】/상대의 모든 능력의 상승(강화)를 무시」 — 변장 중(disg)인 맞는 쪽이면 때리는 쪽 공격 · 명중의 상승(랭크 · 배율)을 무시 */
    if (def && def.disg && atk && atk.id !== def.id) {
      const p = potSrc(def).find(
        z => z && /모습일\s*때\s*【\s*방호\s*】\s*\/?\s*상대의\s*모든\s*능력의\s*상승\s*\(\s*강화\s*\)\s*(?:를|을)\s*무시/.test(String(z.eff || ''))
      );
      if (p) {
        const n = String(p.name).replace(/[『』]/g, '');
        if (o.atk == null) {
          o.atk = 0;
          o.nm.atk = n;
        }
        if (o.acc == null) {
          o.acc = 0;
          o.nm.acc = n;
        }
      }
    }
    return o;
  }
  /* 발동 확률 (10-23 망령): 손으로 누른 발동이고 확률이 걸린 효과면 굴리기 전에 그대로 · 반드시 · 바꿔서 를 고른다. 돌려줌 {pSet?,pAdd?,pSure?} 또는 null(닫기) */
  function chanceIn(ops) {
    return (ops || []).some(
      o =>
        o &&
        (((o.p || o.pl) && !(['boost', 'guard', 'eva', 'ignoreup', 'prio', 'noind'].includes(o.k) && !o.turn && o.dur !== 'turn')) ||
          o.k === 'statefx' ||
          (o.k === 'cure' && o.chance && +o.chance < 100) ||
          (o.k === 'choice' && (o.opts || []).some(x => FX().chanceOf(x.label) || FX().timing(x.label).percent || chanceIn(x.ops))))
    );
  }
  function askChance(name, base) {
    return new Promise(res => {
      const md = A()
        .openModal(`<div class="mhead"><h2>${esc(name)} — 발동 확률</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
  <div class="small dim">${base ? '효과 글의 확률 <b>' + base + '%</b>' : '줄마다 확률이 걸린 효과'} — 다른 포텐셜 · 특성으로 확률이 오르거나 반드시 발동하면 여기서 바꾼다</div>
  <div class="pcask"><button class="btn pri" data-c="as">그대로 굴리기</button><button class="btn" data-c="sure">반드시 발동</button></div>
  <div class="pcask"><label>확률 <input type="number" class="n" id="pc_set" placeholder="${base || ''}" min="0" max="100">%</label><label>보정 <input type="number" class="n" id="pc_add" placeholder="0">%p</label><button class="btn" data-c="go">바꿔서 굴리기</button></div>`);
      let done = false;
      const fin = v => {
        if (done) return;
        done = true;
        A().closeModal();
        res(v);
      };
      md.querySelectorAll('[data-c]').forEach(
        el =>
          (el.onclick = () => {
            const c = el.dataset.c;
            if (c === 'as') return fin({});
            if (c === 'sure') return fin({ pSure: 1 });
            const s = $('#pc_set', md).value,
              a = $('#pc_add', md).value;
            fin(Object.assign({}, s !== '' ? { pSet: +s } : {}, a !== '' ? { pAdd: +a } : {}));
          })
      );
      md.querySelector('[data-x]').addEventListener('click', () => {
        if (!done) {
          done = true;
          res(null);
        }
      });
    });
  }
  /* 공격 창에서 쓸 조건 */
  /* 공격 쪽 배율(자속·적응력·달인의띠): 받는 쪽에는 숫자에 녹여서만 보낸다 */
  /* 10-27 망령: 연속기 타별 대미지 (맞은 타만) — am 을 주면 공격 쪽 배율(자속 · 달인의띠)을 곱해 내림. HP 는 hpDamageHits 로 타마다 깎는다 */
  function perOf(d, am) {
    return d && d.hits ? d.hits.filter(h => h.hit > 0).map(h => (am ? Math.floor(h.value * am) : h.value)) : [];
  }
  /* 11-04 20:03 망령 「때렸을 때 적용된 배율 효과 로그에 보기 좋게 · 맞았을 때도 — 서로 뭐가 적용됐는지」: 대상 하나에 들어간 배율 — pub(전체기 · 날씨 · 필드 · 벽 · 화상 · 도우미 …) · atk(자속 · 소지품 · 특성 · 충전 …) · grd(받는 쪽 완화) */
  function mulParts(r, md) {
    const def = r.def;
    const crit = (r.hits || []).some(h => h.v === 2);
    const O = r._opt || {};
    const D = r.dmg || {};
    const H0 = (D.hits || [])[0] || {};
    const pub = [],
      ak = [],
      gd = [];
    const mt = O.multiTarget ? 0.75 : 1,
      wt = +O.weather || 1,
      fd = +O.fieldMul || 1;
    if (O.multiTarget) pub.push('전체기 ×0.75');
    if ((+H0.M || 1) / (mt * wt * fd) < 0.99) pub.push('화상 ×0.5');
    if (wt !== 1) pub.push('날씨 ×' + wt);
    if (fd !== 1) pub.push('필드 ×' + fd);
    if ((+D.wall || 1) < 1 && !((r.mods && r.mods.names) || []).some(x => x.key === '_wall'))
      pub.push(
        '벽 ×' + D.wall + (crit ? ' (급소면 무시)' : '')
      ); /* 11-09 00:09 망령 「벽 배율이 공격 쪽 · 받는 쪽에 두 번 뜬다 — 받는 쪽에 냅둡시다」: 계산은 dmg.wall 한 번뿐. 받는 쪽 이름표(_wall: 「오로라베일」 피해 × …)가 있으면 공격 쪽 「벽」 줄은 뺀다 */
    if (D.ws) pub.push('물놀이 ×0.5');
    if (D.ms) pub.push('흙놀이 ×0.5');
    if (O.helping) pub.push('도우미 ×' + (+O.helping > 1 ? +O.helping : 1.5));
    if (+O.defMul && +O.defMul !== 1) pub.push('받는 쪽 능력 배율 ×' + O.defMul);
    /* 11-07 23:5x 망령 「두꺼운지방 같은 완화가 로그에 안 뜬다」 → 「자속은 숨기는 게 맞고, 공격 쪽도 소지품이나 특성 같은 건 발동하는 건 공개」: 11-04 결정(공개 배율만)을 바꿈.
        공격 쪽 특성 · 포텐셜 · 소지품 · 충전 · 생명의구슬 · 달인의띠는 pub(모두 보는 로그), 받는 쪽 완화(grd)도 HP 적용 로그에 이름까지. atk 에는 자속 · 자유 칸만 남는다 */
    for (const x of (r.mods && r.mods.names) || []) (x.who === def.id ? gd : pub).push(x.txt);
    if ((r.endHalf ?? endHalf(def)) && r.dmg)
      gd.unshift(
        '『버텨라!』 ×0.5'
      ); /* 11-08 20:56 망령 「대미지 로그에 버텨라 0.5배 같은 건 왜 안 떠?」: guard0 에 곱해져 있었지만 이름이 없었다 */ /* 받는 쪽 완화(블로커 등)는 기본 대미지가 아니라 HP 창의 「위력 완화」로 곱한다 */
    if (+O.item1 && +O.item1 !== 1)
      pub.push((md.dataset.it1 ? '소지품 ' + md.dataset.it1.replace(/\s*×\s*[\d.]+\s*$/, '') : '아이템1') + ' ×' + O.item1);
    if (+O.item2 && +O.item2 !== 1) pub.push('아이템2 ×' + O.item2);
    if (+O.trait && +O.trait !== 1) pub.push('특성 ×' + O.trait);
    if (+O.free2 && +O.free2 !== 1) ak.push('자유2 ×' + O.free2);
    {
      const f1 = (+O.free1 || 1) / ((r.mods && r.mods.boost) || 1);
      if (Math.abs(f1 - 1) > 0.001) ak.push('자유1 ×' + Math.round(f1 * 1000) / 1000);
    }
    if (O.charge) pub.push('충전 ×2');
    if (O.lifeOrb) pub.push('생명의구슬 ×1.3');
    if (r.stab) ak.push('자속 ×' + (($('#aadapt', md) || {}).checked ? 2 : 1.5));
    if (($('#abelt', md) || {}).checked && r.eff && r.eff.value > 1) pub.push('달인의띠 ×1.2');
    /* 11-07 23:52 망령 「특성 · 소지품은 발동 표시를 해야 하니 로그에 — 아예 숨겨서 쓰는 구애류 같은 게 아니면」: 숨겨 쓰는 소지품(구애머리띠 · 구애안경 · 구애스카프)은 공개에서 빼고 나만 보는 쪽으로 */
    for (let i = pub.length - 1; i >= 0; i--)
      if (HIDE_IT.test(pub[i])) {
        ak.unshift(pub[i]);
        pub.splice(i, 1);
      }
    return { pub, atk: ak, grd: gd };
  }
  const HIDE_IT = /구애(머리띠|안경|스카프)|구애류/;
  function atkMul(r, md) {
    const ck = id => {
      const el = md ? $('#' + id, md) : document.getElementById(id);
      return !!(el && el.checked);
    };
    return (r.stab ? (ck('aadapt') ? 2 : 1.5) : 1) * (ck('abelt') && r.eff && r.eff.value > 1 ? 1.2 : 1);
  }
  /* 10-26 망령: 이번 턴 공격을 지시받았나 — 공개된 지시(cmds[tid].mons[mid])의 기술이 변화기가 아니면. 교대 · 지시 없음(행동불능 등) · 변화기는 「지시받지 않음」 → 【수세】 · 【공세】 판정에 쓴다 */
  /* 11-07 망령 「지시가 아직 공개 안 됐거나 지시 없이 공격 창을 열면 「지시 안 받음」으로 쳐서 【수세】가 켜진다 — 고쳐야지」:
    지시를 ① 공개된 지시 → ② 이 화면에 있는 내 지시(CMD) → ③ 이번 턴에 실제로 낸 기술(lastMove) 순으로 찾는다. 어디에도 없으면 「모름」 — 공격한 것으로 친다(【수세】 꺼짐) */
  let SECMD = { key: '', m: {} };
  async function secCmdRefresh(c, b) {
    if (!c || !c.ST || !c.ST.secret) return;
    try {
      const rows = await DBS().secretGet(c.ST.room, c.ST.secret, 'cmd');
      const M = {};
      for (const r of rows || []) {
        if (!cmdFresh(r, b)) continue;
        const ms = (r.data || {}).mons || {};
        for (const id in ms) M[id] = ms[id];
      }
      SECMD = { key: turnKey(b), m: M };
    } catch (e) {}
  }
  function ordX(b, m) {
    const pub = (((b.cmds || {})[m.tid] || {}).mons || {})[m.id];
    if (pub && pub.move != null && pub.move !== '') return pub;
    if (SECMD.key === turnKey(b)) {
      const y = SECMD.m[m.id];
      if (y && y.move != null && y.move !== '') return y;
    }
    const loc = ((CMD || {})[m.tid] || {}).mons;
    const l = loc && loc[m.id];
    if (l && l.move != null && l.move !== '') return l;
    return null;
  }
  function ordAtk(b, m) {
    if (!b || !m) return false;
    const x = ordX(b, m);
    if (x) {
      if (x.move === 'switch') return false;
      const mv = MVS(m)[+x.move];
      return !!mv && mv.cat !== '변화';
    }
    const lm = m.lastMove;
    if (lm && +lm.turn === (+b.turn || 0)) {
      const mv = MVS(m).find(v => v && v.name === lm.name);
      return !(mv && mv.cat === '변화');
    }
    /* 11-08 00:02 망령 「미사그 캠퍼스 이요 블로커 적용 안 됨」(#37839: 교대로 막 나온 이요를 PL 화면 공격 창이 「지시 모름 = 공격한 것」으로 봐서 【수세】 블로커 ×0.75 가 빠짐):
     그 트레이너가 턴 개시 뒤 올린 순서 열쇠(ok)를 본다 — 열쇠에 없는 포켓몬(지시가 잠길 때 필드에 없었음 = 교대로 나옴) · 교대 · 기술 없음 · 변화기면 「지시 안 받음」 */
    {
      const ok = ((b.cmds || {})[m.tid] || {}).ok;
      if (ok && ok.key === turnKey(b)) {
        const o = (ok.m || {})[m.id];
        if (!o) return false;
        if (o.sw) return false;
        if (o.atk != null) return !!o.atk;
        if (o.mv === 0) return false;
      }
    }
    if (+m.inSw && +m.inT === (+b.turn || 0)) return false; /* 이번 턴 도중 교대로 나왔다 — 이 턴엔 지시를 받지 않았다 */
    return true;
  }
  /* 11-06 망령 「『HP : 1/2 이하』일 때 『우드혼』을 내보낼 때 【수세】가 적용된다」: 공격을 지시받아도 그 기술이면 자신의 【수세】 효과가 켜진 채 (fx atkKeep · defKeep — 상대의 【공세】 판정은 그대로).
    구문 「수세유지 [기술:우드혼] [타입:풀] [물리|특수] [HP≤1/2]」(sp keepdef) 또는 특성 · 포텐셜 · 소지품 효과 글 (제작기 potlint KEEPDEF_RE 와 같은 꼴) */
  const KEEPDEF_RE =
    /(?:「HP\s*:\s*(\d+\s*\/\s*\d+)\s*이하」\s*일\s*때\s*,?\s*)?((?:「[^」]+」\s*(?:[,·]|과|와)?\s*)+)(?:기술)?\s*(?:을|를)?\s*(?:내보낼|사용할|쓸)\s*때(?:에도|도)?\s*,?\s*【수세】\s*(?:가|이|를|도)?\s*(?:적용|발동|유지|된|되)/;
  function keepDefL(m) {
    const L = spL(m, 'keepdef').map(e => ({
      mv: e.mv || [],
      types: e.types || [],
      cat: e.cat || '',
      hp: e.hp || '',
      c: e
    })); /* 11-23 18시 c = 조건 낱말(수세유지 타임 …)이 실린 원래 줄 */
    const tx = [
      m.ability ? slotEff(m, 'trait', m.ability) : '',
      ...potSrc(m).map(p => p && p.eff),
      ...(IOFF(m) ? [] : [m.item ? slotEff(m, 'item', m.item) : '', ...(m.items2 || []).map(x => x && x.itemEff)])
    ];
    for (const t of tx) {
      const r = String(t || '')
        .replace(/<br\s*\/?>/g, '\n')
        .match(KEEPDEF_RE);
      if (!r) continue;
      const ks = [...r[2].matchAll(/「([^」]+)」/g)].map(x => x[1].trim()).filter(k => k && !/^HP\s*:/.test(k));
      const isTy = k => {
        const e = S().typeEn(k);
        return !!e && e !== k && /^[A-Z]/.test(e);
      };
      const cat = ks.find(k => /^(물리|특수)기?$/.test(k)) || '';
      L.push({
        mv: ks.filter(k => !isTy(k) && k !== cat),
        types: ks.filter(isTy).map(k => S().typeEn(k)),
        cat: cat.replace(/기$/, ''),
        hp: r[1] ? r[1].replace(/\s+/g, '') : ''
      });
    }
    return L;
  }
  function keepDef(m, mv, tys) {
    if (!m || !mv || mv.cat === '변화') return false;
    const L = keepDefL(m);
    if (!L.length) return false;
    const T = tys && tys.length ? tys : mvTysRaw(mv);
    const nm = String(mv.name || '').trim();
    return L.some(e => {
      if (e.mv.length && !e.mv.includes(nm)) return false;
      if (e.types.length && !T.some(t => e.types.includes(t))) return false;
      if (e.cat && mv.cat !== e.cat) return false;
      if (e.hp) {
        const [a, d] = e.hp.split('/').map(Number);
        if (!(d > 0 && m.hp && m.hp.cur * d <= m.hp.max * a)) return false;
      }
      if (e.c) {
        try {
          if (FX().xOk && !FX().xOk(e.c, m, null, null)) return false;
        } catch (_) {}
      }
      return true;
    });
  }
  function ordMv(b, m) {
    if (!b || !m) return null;
    const x = ordX(b, m);
    if (x) {
      if (x.move === 'switch') return null;
      return MVS(m)[+x.move] || null;
    }
    const lm = m.lastMove;
    if (lm && +lm.turn === (+b.turn || 0)) return MVS(m).find(v => v && v.name === lm.name) || null;
    return null;
  }
  /* 11-11 망령 「코유키 『이윽고 당신이 되는 이야기』 【임의】/아군이 「기능 확장」을 내보낼 때 「물리기」와 「특수기」 중 내보냈을 때 더 높은 대미지를 주는 쪽이 된다 — 둘 다 만들어」:
    분류 고르기(셸암즈 꼴)를 쓰는 까닭을 찾는다 — ① 기술 글(셸암즈) ② 자신의 지속 줄 「위력 ×1 분류최대 [기능확장]」 ③ 같은 편 트레이너 고유 · 자신 포텐셜의 구문(분류최대) 또는 글.
    「기능확장」 조건 = 이 기술이 기능 확장(mv.ext). 언제나 이득이라 【임의】도 저절로 고른다 */
  const BC_RE = /「물리기」와\s*「특수기」\s*중[^.]*더\s*(?:높은|큰)\s*대미지/;
  function bestCatWhy(b, atk, mv) {
    if (!atk || !mv || mv.cat === '변화') return '';
    if (BC_RE.test(String(mv.eff || ''))) return `「${mv.name}」`;
    const X = !!mv.ext;
    const okOp = o => o && o.bc && (!o.xmv || X);
    const okTx = t => BC_RE.test(String(t || '')) && (!/기능\s*확장/.test(String(t || '')) || X);
    for (const e of (atk.fx || {}).mods || []) if (e && e.kind === 'boost' && okOp(e)) return `${atk.name} 「${e.name}」`;
    for (const p of [...(atk.pots || []), ...(atk.excl ? [atk.excl] : []), ...(atk.exclX || [])])
      if (p && p.name && !potOffWhy(atk, p.name) && (((p.auto || {}).ops || []).some(okOp) || (!((p.auto || {}).ops || []).length && okTx(p.eff))))
        return `${atk.name} 『${String(p.name).replace(/[『』]/g, '')}』`;
    for (const tid in b.trainers || {}) {
      const t = b.trainers[tid];
      if (!t || !(tid === atk.tid || sameT(tid, atk, b))) continue;
      for (const u of t.unique || [])
        if (u && u.name && (((u.auto || {}).ops || []).some(okOp) || (!((u.auto || {}).ops || []).length && okTx(u.eff))))
          return `${t.name} 고유 『${String(u.name).replace(/[『』]/g, '')}』`;
    }
    return '';
  }
  function bestCatMv(atk, def, mv) {
    const sv = (m, k) => {
      try {
        return +B().statValue(m, k).value || 0;
      } catch (e) {
        return 0;
      }
    };
    const P = sv(atk, 'attack') / Math.max(1, sv(def, 'defense')),
      Sp = sv(atk, 'specialattack') / Math.max(1, sv(def, 'specialdefense'));
    const cat = P > Sp ? '물리' : P < Sp ? '특수' : mv.cat === '물리' ? '물리' : '특수';
    return {
      mv: Object.assign({}, mv, {
        cat,
        atk: cat === '물리' ? '공격' : '특공',
        def: cat === '물리' ? '방어' : '특방',
        contact: cat === '물리' ? 'O' : 'X',
        bcat: 1
      }),
      cat,
      P,
      Sp
    };
  }
  /* 11-11 망령 「(셸암즈 꼴을 손으로 할 때) 분류를 바꾸는 기능이 없어서 빛장 / 리플렉터 적용을 바꿀 수가 없다」: 공격 창 「능력 · 무시」 칸 「분류」(기술대로 · 물리기 · 특수기).
    손으로 고르면 그게 먼저(접촉은 그대로), 안 고르면 분류 고르기(셸암즈 꼴 bestCatWhy) — 장벽 · 「물리기/특수기」 조건 · 받는 쪽 소지품 완화가 바뀐 분류를 따른다 */
  /* 11-11 망령 「산성독 · 프리즈드라이 계통 · 특성 : 참철 같은 것 — 구문으로도」: 기술 글의 상성 덮어쓰기(moveauto effVs, 여럿) + 공격하는 쪽 지속 줄 「위력 ×1 상성×N 상대타입:X …」(FX effOver) → 엔진 vsOver */
  function vsOf(atk, def, mv, moveTypes) {
    const L = [];
    const e = (moveAuto(mv) || {}).effVs;
    if (e) L.push(...(Array.isArray(e) ? e : [e]));
    try {
      if (def && FX() && FX().effOver) L.push(...FX().effOver(roleV(atk), def, moveQuery(atk, def, mv, moveTypes, 1, true)));
    } catch (err) {}
    return L.length ? L : null;
  }
  function catFix(md, atk, def, mv) {
    if (!mv || mv.cat === '변화') return { mv, note: '' };
    const ov = String(((md && md.querySelector('#acat')) || {}).value || '');
    if (ov === '물리' || ov === '특수') {
      if (ov === mv.cat) return { mv, note: '' };
      return {
        mv: Object.assign({}, mv, { cat: ov, atk: ov === '물리' ? '공격' : '특공', def: ov === '물리' ? '방어' : '특방', bcat: 1 }),
        note: `분류 ${ov}기 (공격 창에서 바꿈)`
      };
    }
    const why = bestCatWhy(ctx().b, atk, mv);
    if (!why || !def || def === atk) return { mv, note: '' };
    const R = bestCatMv(atk, def, mv);
    const f = x => Math.round(x * 100) / 100;
    return {
      mv: R.mv,
      note: `${why} — 분류 ${R.cat}기 (${def.name} 기준 공격/방어 ${f(R.P)} · 특공/특방 ${f(R.Sp)}${R.cat === '물리' ? ' · 접촉' : ''})`
    };
  }
  /* 11-23 망령 「완화 태그:필중기 맞아. 사실 필중 효과가 부여되어 있는 것도」: 거르개 낱말 태그:필중기 = 명중 0(필중기) · 「다음 기술 필중」 · 구문 「필중화」로 필중이 된 기술 */
  let MQ_SURE = 0;
  function moveQuery(atk, def, mv, moveTypes, eff, single) {
    const q = moveQuery0(atk, def, mv, moveTypes, eff, single);
    try {
      /* 태그 칸 「필중」은 번개 · 눈보라 같은 조건부 필중(명중 70)에도 붙어 있어 그것만으로는 필중기로 치지 않는다 */ let sure =
        q.tags.includes('필중기') ||
        !!q.sureMv ||
        !!(
          atk &&
          FX() &&
          FX().nextOf &&
          FX()
            .nextOf(atk)
            .some(e => e && e.sure)
        );
      /* 11-23 16:23 망령 「날씨로 필중이 된 기술도」: 기술 글의 「날씨 : X」… 「필중기」 문장이 지금 날씨와 맞으면 (wxLinks 와 같은 읽기) */ if (
        !sure
      ) {
        try {
          const W = wxNow(ctx().b);
          if (W)
            sure = String((mv && mv.eff) || '')
              .split(/(?<=\.)\s*/)
              .some(sen => wxIn(sen, W) && /「필중기」/.test(sen));
        } catch (e) {}
      }
      if (!sure && !MQ_SURE && atk && def && def !== atk && FX() && FX().attackMods) {
        MQ_SURE++;
        try {
          sure = !!(FX().attackMods(roleV(atk), roleV(def), q) || {}).sh;
        } catch (e) {
        } finally {
          MQ_SURE--;
        }
      }
      if (sure) for (const w of ['필중', '필중기']) if (!q.tags.includes(w)) q.tags.push(w);
    } catch (e) {}
    return q;
  }
  function moveQuery0(atk, def, mv, moveTypes, eff, single) {
    const b = ctx().b;
    return {
      uid: atk ? atk.id : '',
      moldMv: !!(moveAuto(mv) || {}).mold,
      prio: (() => {
        try {
          return atk && FX() && FX().prioOf ? FX().prioOf(atk, mv) : +mv.prio || 0;
        } catch (e) {
          return +mv.prio || 0;
        }
      })(),
      /* 11-09 감우 55: 우선도 조건 토큰 (아군/상대 · +/- · 숫자) */ types: moveTypes,
      cat: mv.cat,
      eff: eff,
      single: single,
      stab: !!(eff && eff.stab),
      tags: [
        ...String(mv.tag || '').split(/[,/·\s]+/),
        /* 11-23 16:23 망령: 묶음 해시태그(#탄, 볼, 포 · #물기, 엄니)는 찾기용이라 태그 판정에서 뺀다 — 예전엔 쉼표로 쪼개 넣어 「탄」 기술이 태그:포 에도 걸렸다 */ ...(
          mv.tags || []
        )
          .map(t => String(t || '').replace(/^#/, ''))
          .filter(t => !/,/.test(t)),
        ...(A().contactOf && A().contactOf(mv) === 'O'
          ? ['접촉', '접촉기']
          : A().contactOf && A().contactOf(mv) === 'X'
            ? ['비접촉', '비접촉기']
            : [])
      ]
        .map(x => String(x).trim())
        .filter(x => x && x !== '-'),
      move: mv.name || '',
      defTypes: def ? tysOf(def) : [],
      atkTypes: atk ? tysOf(atk) : [],
      defMon: def || null,
      sureMv: !+mv.acc,
      pursuitHit: (() => {
        try {
          const b = ctx().b;
          return !!(
            atk &&
            (b.order || []).some(
              o => o.mid === atk.id && o.pursuitHit && String(o.move) === String(mv.name || '') && (!def || def.id === o.pursuitHit)
            )
          );
        } catch (e) {
          return false;
        }
      })(),
      /* 11-25 추격발동 조건 (탄달로스 『도약살해자의 추격』) */ pursuit: (() => {
        try {
          return (
            isPursuit(mv, atk) ||
            !!(
              FX() &&
              FX().nextOf &&
              FX()
                .nextOf(atk)
                .some(e => /따라가때리기/.test(String(e.name || '')) || e.pursuit)
            )
          );
        } catch (e) {
          return false;
        }
      })(),
      /* 11-15 【방호】 무시(폭식죄의 추격) */ tmv: !!(mv.ext && mv.ext.item && /기술머신/.test(String(mv.ext.item))),
      xmv: !!mv.ext,
      /* 11-09 감우 54: 필중기 · 맞는 쪽(비례무시 조건) */ /* 11-08 망령 「특정 기술일 때는 웹툴 손봐서」: 기술 이름(기술:) · 「#…」 태그 · 상대 타입(상대타입:) 조건 */ pow:
        +mv.pow || 0,
      recoil: (() => {
        try {
          const a = moveAuto(mv);
          if (a && a.recoil) return true;
        } catch (e) {}
        const t = String(mv.eff || '');
        return /반동/.test(t) && !/행동\s*불능/.test(t);
      })(),
      /* 11-09 이판사판 「반동기」 */ atkAtk: atk === def ? ordAtk(b, atk) : true,
      defAtk: atk === def ? ordAtk(b, def) : ordAtk(b, def),
      ordAtkOf: m => {
        try {
          return ordAtk(b, m) && !keepDef(m, ordMv(b, m));
        } catch (_) {
          return false;
        }
      },
      atkKeep: keepDef(atk, atk === def ? ordMv(b, atk) : mv, moveTypes),
      defKeep: keepDef(def, ordMv(b, def))
    };
  }
  /* 컷인에 쓸 트레이너 그림: 표정(스탠딩) → 시트 그림 */
  function trainerImg(t) {
    if (!t) return '';
    const st = t.stands || [];
    const a = st[+t.standActive || 0] || st[0];
    return (a && a.src) || t.image || '';
  }
  const potKey = n =>
    String(n || '')
      .replace(/『|』/g, '')
      .trim();
  function potLineOf(m, name) {
    return String(((m && m.cutLine) || {})[potKey(name)] || '');
  }
  function uqLineOf(t, name) {
    const u = ((t && t.unique) || []).find(x => x && potKey(x.name) === potKey(name));
    return String((u && u.line) || '');
  }
  function potTagOf(m, name) {
    const k = potKey(name);
    if ((m.excl && potKey(m.excl.name) === k) || (m.exclX || []).some(p => p && potKey(p.name) === k)) return `${m.name}의 전용 포텐셜!`;
    const p = (m.pots || []).find(x => x && potKey(x.name) === k);
    return p && /고유/.test(p.kind || '') ? `${m.name}의 고유 포텐셜!` : `${m.name}의 포텐셜!`;
  }
  /* 11-22 망령 「태그에 【은폐】 추가 — 사용자가 따로 공개하지 않는 이상 시스템 로그에 공개하지 않을 수 있는 키워드」:
    효과 글에 【은폐】가 있는 포텐셜 · 전용 · 고유 · 특성 · 소지품이 발동한 로그는 sysLog 가 주인 귓속말(gmPriv — 「나만 보임」 + 「출력」)로 돌린다. 컷인도 띄우지 않는다.
    판정: 로그에 붙은 효과 글(extra.eff)에 【은폐】가 있거나, 첫 줄이 【포텐셜 · 전용 · 고유 · 특성 · 소지품 · 계기】로 시작하고 그 포켓몬(mid) · 트레이너의 【은폐】 효과 이름이 『』「」로 나오면 */
  const CONCEAL_RE = /【\s*은폐\s*】/;
  const cnm = x =>
    String(x || '')
      .replace(/[『』「」]/g, '')
      .trim();
  function concealNames(b, m) {
    const out = new Set();
    if (!m) return out;
    const add = (n, e) => {
      if (n && CONCEAL_RE.test(String(e || ''))) out.add(cnm(n));
    };
    try {
      for (const p of potSrc(m, true)) if (p) add(p.name, p.eff);
    } catch (e) {}
    add(m.ability, m.abilityEff);
    add(m.item, m.itemEff);
    try {
      const IT = (DB() || {}).items || {};
      for (const q of m.items2 || []) {
        const n = q && q.item;
        if (n) add(n, (IT[cnm(n)] || {}).eff);
      }
      if (m.item && !m.itemEff) add(m.item, (IT[cnm(m.item)] || {}).eff);
    } catch (e) {}
    const t = ((b && b.trainers) || {})[m.tid];
    for (const u of (t && t.unique) || []) if (u) add(u.name, u.eff);
    return out;
  }
  function concealLog(t, extra) {
    try {
      const x = extra || {};
      if (CONCEAL_RE.test(String(x.eff || ''))) return true;
      const s = String(t || '');
      const head = s.split('\n')[0];
      if (!/^【(?:포텐셜|전용|고유|특성|소지품|계기)/.test(head)) return false;
      if (CONCEAL_RE.test(s)) return true;
      const b = ctx().b || {};
      const m = x.mid && (b.mons || {})[x.mid];
      if (!m) return false;
      for (const n of concealNames(b, m)) if (n && (head.includes('『' + n + '』') || head.includes('「' + n + '」'))) return true;
      return false;
    } catch (e) {
      return false;
    }
  }
  function concealPot(b, tok, nm) {
    try {
      if (/^m:/.test(tok)) {
        const m = (b.mons || {})[tok.slice(2)];
        return concealNames(b, m).has(cnm(nm));
      }
      if (/^t:/.test(tok)) {
        const t = (b.trainers || {})[tok.slice(2)];
        const u = ((t && t.unique) || []).find(x => x && cnm(x.name) === cnm(nm));
        return !!(u && CONCEAL_RE.test(String(u.eff || '')));
      }
    } catch (e) {}
    return false;
  }
  function cutFire(tok, src, tag, ment, color, line) {
    try {
      if (!CUT()) return;
      const b = ctx().b || {};
      const nm = String(ment || '').replace(/^『|』$/g, '');
      if (concealPot(b, tok, nm)) return; /* 11-22 【은폐】: 컷인 없이 */
      if (line == null) {
        if (/^m:/.test(tok)) {
          const m = (b.mons || {})[tok.slice(2)];
          if (m) {
            line = potLineOf(m, nm);
            if (tag === m.name) tag = potTagOf(m, nm);
          }
        } else if (/^t:/.test(tok) && /의 고유!$/.test(String(tag || ''))) line = uqLineOf((b.trainers || {})[tok.slice(2)], nm);
      }
      let side = '',
        CC = 0;
      {
        const m = /^m:/.test(tok) ? (b.mons || {})[tok.slice(2)] : null;
        const t = /^t:/.test(tok) ? (b.trainers || {})[tok.slice(2)] : null;
        side = (m && m.side) || (t && t.side) || '';
        /* 11-25: 고유 컷인 = 고유 색, 전용 컷인 = 전용 타입 색 (없으면 원래 편 색) */ {
          const cc =
            t && /의 고유!$/.test(String(tag || ''))
              ? uqColOf(t, nm)
              : m
                ? exColOf(m, nm) ||
                  (() => {
                    const tt = (b.trainers || {})[m.tid];
                    return potSrc(m).some(q => q && q.unique && q.name === nm) ? uqColOf(tt, nm) : '';
                  })()
                : '';
          if (cc) {
            color = cc;
            CC = 1;
          }
        }
      } /* 11-03 (검토 10): 동시 컷인의 좌/우 자리 · PLAYER/RIVAL 글자 */
      CUT().fire(Object.assign({ tok, src, tag, ment, color, line: line || '', side }, CC ? { cc: 1 } : {}));
    } catch (e) {}
  }
  /* 컷인을 띄울 포텐셜: rp.cutin.pot = excl(전용·고유만, 기본) | all | none */
  function wantCut(m, name) {
    const cfg = (A().ST.state.rp || {}).cutin || {};
    const mode = cfg.pot || 'excl';
    if (mode === 'none') return false;
    if (mode === 'all') return true;
    if (m.excl && m.excl.name === name) return true;
    if ((m.exclX || []).some(p => p.name === name)) return true;
    const p = (m.pots || []).find(x => x.name === name);
    return !!(p && /전용|고유/.test(p.kind || ''));
  }
  /* 11-03 감우 (검토 9): 턴 개시 · 턴 종료만 큰 띠(2.3s), 교대 · 행동 순서 · 행동 처리는 0.9s 작은 띠 (sub 없이) */
  const PH_BIG = /^(턴 개시|턴 종료)$/;
  function cutPhase(text, sub) {
    try {
      if (CUT()) CUT().phase(text, PH_BIG.test(String(text || '')) ? sub : '', !PH_BIG.test(String(text || '')));
    } catch (e) {}
  }
  /* 시합 개시 연출 (맵툴 switch_cutscene): rp.cutin.start = vs | warn | off. 레이드 보스가 있으면 경고 */
  function battleStartCut(b, force) {
    const cfg = (A().ST.state.rp || {}).cutin || {};
    const mode = force || cfg.start || 'vs';
    if (mode === 'off' || !CUT()) return;
    /* 10-26 망령: 한 진영에 트레이너가 여럿(따로 세우기 · 개인전)이거나 합친 파티가 6체를 넘으면 — 이름을 모두, 그림 둘, 볼은 트레이너(6체)마다 한 줄 */
    const monsOf = ids =>
      Object.values(b.mons || {})
        .filter(m => ids.includes(m.tid))
        .sort((x, y) => (x.slot || 0) - (y.slot || 0));
    const pack = ms => ({
      balls: ms.slice(0, 6).map(m => (m.hp.cur > 0 ? 1 : 0)),
      mons: ms.slice(0, 6).map(m => ({ img: !c_gm_or_seen(m) ? '' : m.image, name: !c_gm_or_seen(m) ? '비공개' : m.name }))
    });
    const sideData = side => {
      const ids = (((b.sides || {})[side] || {}).trainers || []).filter(tid => monsOf([tid]).length || (b.trainers || {})[tid]);
      const T = ids.map(tid => (b.trainers || {})[tid]).filter(Boolean);
      const all = monsOf(ids);
      if (!T.length && !all.length) return null;
      const t = T[0];
      if (T.length <= 1 && all.length <= 6)
        return Object.assign(
          {
            img: t ? trainerImg(t) : (all[0] || {}).image || '',
            t: t ? t.name : '야생의 ' + (all[0] || {}).name,
            sub: t ? ['지시', '육성', '통솔', '능력'].map(k => k + ' ' + ((t.ranks || {})[k] || '-')).join('·') : ''
          },
          pack(all)
        );
      const parts = [];
      if (T.length > 1) {
        for (const x of T) {
          const ms = monsOf([x.id || ids[T.indexOf(x)]]);
          parts.push(Object.assign({ t: x.name }, pack(ms)));
        }
      } else {
        for (let i = 0; i < all.length; i += 6) parts.push(Object.assign({ t: '' }, pack(all.slice(i, i + 6))));
      }
      const solo = T.some(x => x.solo);
      return {
        img: t ? trainerImg(t) : '',
        img2: T[1] ? trainerImg(T[1]) : '',
        t: T.length > 1 ? T.map(x => x.name).join(solo ? ' · ' : ' & ') : t ? t.name : '',
        sub: '',
        solo,
        parts,
        balls: parts[0].balls,
        mons: parts[0].mons
      };
    };
    function c_gm_or_seen(m) {
      return !!(m.entry || m.seen);
    } /* 지금 나와 있거나 한 번 나온 포켓몬만 그림·이름, 나머지는 볼 */
    const boss = Object.values(b.mons || {}).find(m => m.raid && +m.raid.segments > 0);
    if (mode === 'warn' || boss) {
      const AM = Object.values(b.mons || {});
      const bm =
        boss ||
        AM.find(m => m.side === 'right' && m.entry) ||
        AM.find(m => m.side === 'right') ||
        AM[0] ||
        (force ? { name: '???', image: '', hp: { cur: 1, max: 1 } } : null);
      if (bm) {
        CUT().raid({
          img: bm.image,
          n: bm.name,
          title: cfg.warnTitle || (boss ? '레이드 배틀 : ' + boss.raid.segments : '강적 출현'),
          tape: cfg.warnTape || '⚠ WARNING ⚠ ' + (cfg.warnTitle || (boss ? '레이드 보스 출현' : '강적 출현')),
          nohp: cfg.warnHp ? 0 : 1,
          x: boss ? boss.raid.segments : 0,
          hp: bm.hp.cur > 0 ? Math.max(1, Math.round((bm.hp.cur / bm.hp.max) * 100)) : 0,
          ph: boss ? boss.raid.phase || 1 : 0,
          label: boss ? 'RAID BATTLE' : 'BATTLE'
        });
        return;
      }
    }
    let L = sideData('left'),
      R = sideData('right');
    if (force && !(L && R)) {
      const ex = (t, n) => ({ img: '', t, sub: '', balls: Array(n).fill(1), mons: [] });
      L = L || ex('좌측 트레이너', 6);
      R = R || ex('우측 트레이너', 6);
      A().toast('배틀에 양쪽 파티가 없어서 예시로 띄웠다');
    }
    if (L && R) CUT().vs(L, R);
  } /* 효과음은 로그를 보고 rp_ui 가 울린다 (모두 같은 로그를 받으니 좌석도 들린다) */
