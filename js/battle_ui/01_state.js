  /* ── 조각 01_state.js — 상태 읽기 도우미 ── */
  /* ---------- 상태 읽기 도우미 ---------- */
  /* mgr: 배틀 진행 권한 — GM, 그리고 방 설정 「플레이어도 배틀 진행」이 켜져 있으면 자리에 앉은 사람 모두 (모의전). 비밀(상대 지시 엿보기·강제·모두 공개)은 여전히 GM 만 */
  function plBattle() {
    const rp = A().ST.state.rp || {};
    return rp.plBattle !== false;
  }
  /* 방 설정 (GM 이 rp 에 둔다, 서버 om_set_state 가 같은 값으로 막는다)
    strict = rp.seatOwn  : 플레이어는 자기 트레이너·포켓몬·지시만 바꾼다 → 배틀 진행(턴·페이즈·필드)은 GM 만
    fair   = rp.gmHands===false : GM 도 플레이어의 지시·준비를 바꾸지 않고, 플레이어 포켓몬의 HP·랭크·상태 창을 열지 않는다 (자동 처리는 그대로) */
  /* 11-14 망령 「GM 이어도 닉이 다르면 다른 사람인데 GM 권한 · PL 권한 버튼이 공유돼 있으면 어떻게 해」: 배틀 탭 「PL 권한」은 GM 한 사람(계정 · 닉)마다 — rp.gmFair[계정 키]=1.
    방 설정 「GM 불간섭」(rp.gmHands=false)은 그대로 방 전체 규칙(모든 GM). 계정 키 = acctKey() (로그인 계정 u: · 닉 n:), 없으면 'gm' */
  function gmKeyMe() {
    try {
      return (A().acctKey && A().acctKey()) || 'gm';
    } catch (e) {
      return 'gm';
    }
  }
  function gmFairMine(rp) {
    return !!((rp || {}).gmFair || {})[gmKeyMe()];
  }
  function ctx() {
    const ST = A().ST;
    const b = ST.state.battle || {};
    const gm = ST.role === 'gm';
    const rp = ST.state.rp || {};
    const strict = rp.seatOwn === true,
      fair = rp.gmHands === false || (gm && gmFairMine(rp));
    return { ST, b, role: ST.role, seat: ST.seat, gm, strict, fair, mgr: gm || (ST.role === 'seat' && plBattle() && !strict) };
  }
  /* 바뀐 칸만 쓴다 (점검 2-4) — 배틀을 통째로 쓰면 그 사이 남이 바꾼 칸(다른 포켓몬의 피해, 지시 공개 …)이 지워진다.
    nb0 = 사본을 뜰 때의 배틀, nb = 고친 사본 (f 를 주면 필드도 그걸로). 포켓몬은 칸(hp · states …) 하나 단위로, 턴·페이즈는 맨 끝에 쓴다 */
  const snap = x => JSON.parse(JSON.stringify(x === undefined ? ctx().b : x));
  function preSave(m) {
    if (!m) return;
    if (FX() && FX().abSync) FX().abSync(m);
    const st = m.states || {};
    if (st.Grudge && !m.grudgeMove && m.lastMove && m.lastMove.name) m.grudgeMove = m.lastMove.name;
    else if (!st.Grudge && m.grudgeMove) delete m.grudgeMove;
  } /* 11-08 51-2 ㉓ · ㉔ */
  function saveBattle(nb0, nb, f, by, extra) {
    if (f !== undefined) nb.field = f;
    for (const x of Object.values((nb && nb.mons) || {})) preSave(x);
    const FL = faintSweep(nb0, nb);
    const ops = A().diffOps(['battle'], nb0, nb, 3);
    const last = p => (p[1] === 'turn' || p[1] === 'phase' ? 1 : 0);
    ops.sort((x, y) => last(x[0]) - last(y[0]));
    if (extra && extra.length) ops.push(...extra);
    /* 11-03: extra = 배틀 밖 칸(ready …)도 같은 묶음에 */ const fa = snap(nb0.field || {}),
      fz = snap(nb.field || {});
    /* 11-01 망령: by = 전개한 쪽 {n,s,img} — 필드가 바뀌었으면 전개 카드 (fieldLog) */ const sa = stSnap(nb0),
      sz = stSnap(nb); /* 11-01 망령 「상태 변화도 효과 로그」: 상태가 걸리거나 풀렸으면 상태 카드 (stLogAll) */
    return A()
      .setMany(ops)
      .then(r => {
        if (r && ops.length) itemKick();
        if (r && FL.length) A().sysLog(FL.join('\n'), 'battle');
        if (r && ops.length) {
          fieldLog(fa, fz, by, nb, 350);
          stLogAll(sa, sz, by, 350);
          sealKick(nb0, nb, by);
        }
        return r;
      });
  }
  /* 11-05 「봉인」: 어느 길로든(기술 · 특성 인과율 · 포텐셜 …) 새로 걸리면 그 포켓몬의 기술을 공개하고 건 쪽이 봉인할 기술을 고른다. 건 쪽 = by.n 이름의 필드 위 포켓몬 */
  function sealKick(nb0, nb, by) {
    const nw = Object.values(nb.mons || {}).filter(x => (x.states || {}).Seal && !(((nb0.mons || {})[x.id] || {}).states || {}).Seal);
    if (!nw.length) return;
    const caster = by && by.n ? Object.values(nb.mons || {}).find(x => x.name === by.n && x.entry && !nw.includes(x)) : null;
    setTimeout(async () => {
      for (const x of nw) await sealPick(caster ? caster.id : '', x.id);
    }, 400);
  }
  const stSnap = b => {
    const o = {};
    for (const id in (b || {}).mons || {}) {
      const m = b.mons[id];
      if (m)
        o[id] = {
          id,
          name: m.name,
          image: m.image,
          side: m.side,
          entry: m.entry,
          hp: { cur: (m.hp || {}).cur },
          states: Object.assign({}, m.states || {})
        };
    }
    return { mons: o };
  };
  /* 10-23 망령: 쓰러진 포켓몬이 다른 포켓몬에게 건 포텐셜 · 특성 효과(옵저버 …)와 「필드 위에 있는 한」 효과도 퇴장처럼 푼다 */
  function faintSweep(nb0, nb) {
    const L = [];
    if (!FX() || !nb0 || !nb) return L;
    for (const id in nb.mons || {}) {
      const m = nb.mons[id],
        o = (nb0.mons || {})[id];
      if (!o || !o.entry || !m || m.entry || m.hp.cur > 0) continue;
      m.koA = o.entry;
      /* 11-09 감우 56: 쓰러진 자리 (【퇴장 (빈사)】의 정면 · 다음 등장) */ L.push(...auraOff(nb, m).L);
      if (FX().release) L.push(...FX().release(nb, m));
    }
    return L;
  }
  async function faintOff(mid) {
    const nb0 = snap(),
      nb = snap(nb0);
    const m = nb.mons[mid];
    if (!m || m.hp.cur > 0 || !FX()) return;
    const L = [...auraOff(nb, m).L, ...(FX().release ? FX().release(nb, m) : [])];
    if (!L.length) return;
    if (await A().setMany(A().diffOps(['battle'], nb0, nb, 3))) A().sysLog(L.join('\n'), 'battle');
  }
  /* 11-03 감우: 1단계 비교라 states · rank · mod · fx 같은 묶음이 통째로 쓰여, 같은 포켓몬을 둘이 동시에 고치면 한쪽 잎이 사라졌다 — 2단계까지 내려가 바뀐 잎만 (지운 키는 null) */
  /* 11-09 망령 「빈사가 된 포켓몬에게 쓰러질지 유대 할지 물을 때 『자신의 행동 이후로 대미지를 미루는』 옵션 · 자동화 구문에도」:
    m.defer = {v: 미룬 대미지, why, turn, after:'act'(자신의 행동이 끝나면) | 'end'(턴 종료 시)} — 행동이 끝나면(기술 전달 뒤 · 행동 순서 「다음」) 또는 턴 종료 때 한꺼번에 받는다 */
  function deferWhen(b, mid) {
    const ph = +b.phase || 0;
    if (ph < 3) return 'act';
    const O = b.order || [];
    const i = +b.orderIdx || 0;
    const k = O.findIndex(o => o && o.mid === mid && !o.change);
    return k >= i ? 'act' : 'end';
  }
  async function deferFire(mid, when, only) {
    const m0 = snap((ctx().b.mons || {})[mid]);
    if (!m0 || !m0.defer) return false;
    if (only && m0.defer.after !== only) return false;
    const x = snap(m0);
    const D = x.defer;
    delete x.defer;
    const v = Math.max(0, +D.v || 0);
    x.hp.latest = x.hp.cur;
    x.hp.cur = Math.max(0, x.hp.cur - v);
    let line = `【미룬 대미지】 ${x.name} −${v}  ·  HP ${x.hp.latest} → ${x.hp.cur}/${x.hp.max} — ${when}\n${D.why || ''}`;
    if (x.hp.cur <= 0) {
      x.entry = '';
      line += `\n${x.name}은(는) 쓰러졌다!`;
    }
    if (!(await saveMon(m0, mid, x))) return false;
    await A().sysLog(line, 'battle', {
      mid,
      img: x.image || '',
      hp: { name: x.name, prev: x.hp.latest, cur: x.hp.cur, max: x.hp.max, why: D.why || '', faint: x.hp.cur <= 0 }
    });
    if (x.hp.cur <= 0) await faintOff(mid);
    return true;
  }
  async function deferAll(when) {
    for (const id of Object.keys(ctx().b.mons || {})) if (((ctx().b.mons || {})[id] || {}).defer) await deferFire(id, when);
  }
  /* 11-27 망령 「비축하기가 스톡이 안 된다 — 턴이 아니라 카운터로, 필드를 떠나기 전까지 그대로 · 추가 · 감소 · 초기화」:
    비축 카운터 = 상태 「Stockpile」의 수(1~3). 손으로 고친 값(랭크·상태 창 · 상세 창)을 1~3 으로 맞춘다.
    19:20 망령 「방/특방 +1은 기술로 낼 때만 — 카운터 자체로는 안 오른다」: 늘려도 랭크는 그대로, 줄이면 기술로 올린 몫(stockUp) 안에서만 내린다 (fx stockRank) */
  const cntSt = (k, d) => !!(FX() && FX().isCountSt && FX().isCountSt(k, d)); /* 턴으로 줄지 않는 카운터 상태 */
  function stockFix(m0, nm) {
    if (!FX() || !FX().stockOf) return '';
    const st = nm.states || {};
    if (st.Stockpile) st.Stockpile = +st.Stockpile >= 1000 ? 1 : Math.max(1, Math.min(3, +st.Stockpile || 1));
    const a = FX().stockOf(m0);
    const z = FX().stockOf(nm);
    FX().setStock(nm, z);
    if (a === z) return '';
    nm.rank = Object.assign({}, nm.rank || {});
    const r = FX().stockRank ? FX().stockRank(nm, z - a, false) : 0;
    return `비축 카운터 ${a} → ${z}${r ? ` (방어/특방 ${r})` : ''}`;
  }
  function saveMon(m0, mid, nm) {
    preSave(nm);
    return A()
      .setDiff(['battle', 'mons', mid], m0, nm, 2)
      .then(r => {
        if (r) itemKick();
        return r;
      });
  }
  /* 소지품 저장 뒤 점검 (2026-10-23): 내가 저장한 뒤에만, 내가 고칠 수 있는 포켓몬의 HP 열매 · 치유 열매 · 시드 · 룸서비스 · 하양허브 … 를 터트린다 */
  let ITK = 0;
  function itemKick() {
    clearTimeout(ITK);
    ITK = setTimeout(itemSweep, 150);
    hpTrigKick(null, 260);
  }
  /* 11-03 20:54 (PL 「저번 판엔 자동이던 시드가 이번엔 자동이 아니다」): 저장 뒤 점검은 「내가 저장한 뒤」에만 돌아서, 상대 화면이 필드를 바꾸면(일렉트릭메이커 …) 내 포켓몬의 시드가 안 터졌다.
    남이 바꾼 상태가 들어와도 점검한다 — 둘이 같은 포켓몬을 두 번 터트리지 않게 이때는 주인 몫만: GM 은 GM 이 올린 파티 · NPC, 좌석은 자기 트레이너 */
  let ITR = 0;
  function itemKickRemote() {
    clearTimeout(ITR);
    ITR = setTimeout(
      () =>
        itemSweep(m => {
          const c = ctx();
          return c.gm ? !seatOwned(c, m.tid) && canEdit(c, m) : ownT(c, m.tid) && canEdit(c, m);
        }),
      400
    );
    hpTrigKick(m => {
      const c = ctx();
      return c.gm ? !seatOwned(c, m.tid) && canEdit(c, m) : ownT(c, m.tid) && canEdit(c, m);
    }, 1100);
  }
  /* 11-23 14:21 망령 「①【유일】/「HP : 1/2」 이하가 되었을 때 「특성 : 오기」가 발동한다. ②【등장】/「HP : 1/2」 이하일 때 ①효과가 발동한다 — 자동으로」:
    포텐셜 · 특성 글에 「HP : a/b 이하가 되었을 때」가 있고 구문이 있으면, HP 가 저장된 뒤(열매 점검과 같은 때) 그 비율 이하로 **내려간 순간** 한 번 발동한다.
    · 등장한 뒤 한 번이라도 그 비율보다 많았어야 한다 (hpHi) — 이미 이하인 채로 나오면 발동하지 않는다. 단 글에 「【등장】/「HP : a/b」 이하일 때 … 효과가 발동」 줄이 있으면 나올 때도 발동
    · 【유일】 = 배틀에 한 번 (hpTrig 'u' — 교대해도 남는다), 그 밖(【보급】 …) = 나와 있는 동안 한 번 (교대하면 outReset 이 지운다)
    · 구문 맨 앞 「조건 HP≤a/b」는 fireAuto 가 다시 따진다. 등장 자동(autoOnEntry)은 이 꼴을 건너뛴다 — 여기서만 */
  const HPT_RE = /「\s*HP\s*[:：]\s*(\d+)\s*\/\s*(\d+)\s*(?:이하\s*)?」\s*(?:이하)?\s*(?:가|이)\s*(?:되었을|됐을)\s*때/;
  const HPF_RE = /「\s*HP\s*[:：]\s*가득\s*」\s*(?:이|가)\s*(?:되었을|됐을)\s*때/;
  const HPT_ENT = /【\s*등장[^】]*】[^\n]*「\s*HP\s*[:：]\s*\d+\s*\/\s*\d+\s*(?:이하\s*)?」\s*(?:이하)?\s*일\s*때[^\n]*효과가\s*발동/;
  let HPK = 0,
    HPBUSY = 0;
  function hpTrigKick(own, ms) {
    clearTimeout(HPK);
    HPK = setTimeout(() => hpTrigSweep(own).catch(e => console.warn('hpTrig', e)), ms || 260);
  }
  async function hpTrigSweep(own) {
    if (HPBUSY || !FX()) return;
    HPBUSY = 1;
    try {
      const c = ctx();
      if (!c || !c.b || !c.b.started || !c.b.mons) return;
      const ok = typeof own === 'function' ? own : m => canEdit(c, m);
      for (const m0 of Object.values(c.b.mons)) {
        if (!m0 || !m0.entry || !m0.hp || !(m0.hp.cur > 0) || !ok(m0)) continue;
        const list = [];
        if (m0.ability) list.push(['trait', m0.ability]);
        for (const p of potSrc(m0)) if (p && p.name && !p.ph) list.push(['pot', p.name]);
        for (const [kind, name] of list) {
          const tx = String(slotEff(m0, kind, name) || '').replace(/<br\s*\/?>/gi, '\n');
          if (HPF_RE.test(tx)) {
            /* 11-23 저녁 257 (카밀라 『흡정귀의 충만』 「【유일】/「HP : 가득」이 되었을 때 …」): 나온 뒤 한 번이라도 가득이 아니었다가(hpLo) 가득이 된 순간 — 【유일】은 배틀에 한 번, 그 밖은 나와 있는 동안 한 번 */ const cur =
              (ctx().b.mons || {})[m0.id];
            if (!cur || !cur.entry || !(cur.hp.cur > 0)) break;
            const K = 'F:' + name;
            if (cur.hp.cur < cur.hp.max) {
              if (!(cur.hpHi || {})[K]) {
                const h = Object.assign({}, cur.hpHi || {});
                h[K] = 1;
                await A().set(['battle', 'mons', cur.id, 'hpHi'], h);
              }
              continue;
            }
            if ((cur.hpTrig || {})[K] || !(cur.hpHi || {})[K]) continue;
            const a = FX().autoOf(cur, kind, name);
            if (!a || !a.ops || !a.ops.length || a.manual) continue;
            const d = Object.assign({}, cur.hpTrig || {});
            d[K] = /【\s*유일\s*】/.test(tx) ? 'u' : 1;
            await A().set(['battle', 'mons', cur.id, 'hpTrig'], d);
            {
              const h = Object.assign({}, cur.hpHi || {});
              delete h[K];
              await A().set(['battle', 'mons', cur.id, 'hpHi'], h);
            }
            await fireAuto(cur.id, kind, name, {
              quiet: true,
              head: `【${kind === 'trait' ? '특성' : '포텐셜'}】 ${cur.name} 『${String(name).replace(/[『』]/g, '')}』 — 「HP : 가득」이 되었다`
            });
            continue;
          }
          const mm = tx.match(HPT_RE);
          if (!mm) continue;
          const cur = (ctx().b.mons || {})[m0.id];
          if (!cur || !cur.entry || !(cur.hp.cur > 0)) break;
          const thr = Math.max(1, Math.floor((cur.hp.max * +mm[1]) / (+mm[2] || 1)));
          if (cur.hp.cur > thr) {
            if (!(cur.hpHi || {})[name]) {
              const h = Object.assign({}, cur.hpHi || {});
              h[name] = 1;
              await A().set(['battle', 'mons', cur.id, 'hpHi'], h);
            }
            continue;
          }
          if ((cur.hpTrig || {})[name]) continue;
          if (!(cur.hpHi || {})[name] && !HPT_ENT.test(tx)) continue;
          const a = FX().autoOf(cur, kind, name);
          if (!a || !a.ops || !a.ops.length || a.manual) continue;
          const d = Object.assign({}, cur.hpTrig || {});
          d[name] = /【\s*유일\s*】/.test(tx) ? 'u' : 1;
          await A().set(['battle', 'mons', cur.id, 'hpTrig'], d);
          await fireAuto(cur.id, kind, name, {
            quiet: true,
            head: `【${kind === 'trait' ? '특성' : '포텐셜'}】 ${cur.name} 『${String(name).replace(/[『』]/g, '')}』 — 「HP : ${mm[1]}/${mm[2]}」 이하`
          });
        }
      }
    } finally {
      HPBUSY = 0;
    }
  }
  async function itemSweep(own) {
    if (!OI()) return;
    const c = ctx();
    if (!c || !c.b || !c.b.mons) return;
    const b0 = snap(c.b),
      b = snap(b0);
    const f = fieldOf(b);
    let out = [];
    try {
      out = OI().sweep(b, f, typeof own === 'function' ? own : m => canEdit(c, m));
    } catch (e) {
      console.warn(e);
      return;
    }
    if (!out.length) return;
    if (!(await saveBattle(b0, b, f))) return;
    for (const x of out) {
      const m = b.mons[x.mid] || {};
      A().sysLog(`【소지품】 ${m.name} 『${x.name}』\n${x.lines.join('\n')}`, 'battle', {
        mid: x.mid,
        img: m.image || '',
        eff: String(x.eff || '').slice(0, 300)
      });
    }
  }
  /* 플레이어 몫인 트레이너 = 플레이어가 배틀에 올린 것 (trainers[tid].by = 좌석 id). GM 이 불러온 파티(by:'gm')는 PL 권한 중에도 GM 이 그대로 지시·진행한다.
    by 가 없는 예전 배틀은 예전처럼 「주인이 앉아 있는 자리」로 본다 (gmTake 도 GM 몫) */
  function seatOwned(c, tid) {
    if (!tid) return false;
    const t = ((c.b || {}).trainers || {})[tid] || {};
    if (t.by) return t.by !== 'gm';
    return !!(c.ST.state.seats || {})[tid] && !t.gmTake;
  }
  const turnKey = b => String(+b.turn || 0);
  function mode(b) {
    return Math.max(1, Math.min(3, +b.mode || 2));
  } /* 기본 더블(2:2) */
  function entered(b, side) {
    const out = {};
    for (const a of AREAS.slice(0, mode(b))) {
      const m = Object.values(b.mons || {}).find(x => x.side === side && x.entry === a && x.hp.cur > 0);
      out[a] = m || null;
    }
    return out;
  }
  /* 11-11 망령 「(3+3) 트레이너마다 필드 1칸 · 교대는 자기 3체 안에서만」 + 「한 쪽이 전멸하면 빈 공간에는 남은 포켓몬을 낼 수 있게」:
    한 진영의 트레이너 수 = 에리어 수(2 이상)일 때만. 남의 포켓몬이 서 있는 칸 ✗ · 내 포켓몬이 서 있는 칸 = 교대 ·
    빈 칸 = 내가 필드에 아무도 없으면 ○, 이미 하나 내놓았으면 같은 진영에서 기다리는(필드에 없는) 트레이너가 전부 전멸했을 때만 ○.
    내밀기 예약(pend)도 「필드에 있음」으로 센다. null = 제한 없음 */
  /* 11-24 14:45 망령 「태그 2체 에리어 룰 방 설정에서 바꿀 수 있게 — NPC 가 3+3 할 땐 끄고 싶을 수도」: 방 설정 rp.slotFree === true 면 이 규칙을 끈다(제한 없음) */ function slotRule(
    b,
    side
  ) {
    try {
      if (((A().ST.state || {}).rp || {}).slotFree === true) return null;
    } catch (e) {}
    const ids = (((b.sides || {})[side] || {}).trainers || []).filter(x => x && x !== '__swap__' && (b.trainers || {})[x]);
    return ids.length >= 2 && ids.length === mode(b) ? ids : null;
  }
  function okAreas(b, m) {
    const areas = AREAS.slice(0, mode(b));
    const ids = m && slotRule(b, m.side);
    if (!ids) return areas;
    const M = Object.values(b.mons || {}).filter(x => x && x.side === m.side);
    const live = x => x.hp && x.hp.cur > 0;
    const onF = tid => M.some(x => x.tid === tid && x.id !== m.id && live(x) && (x.entry || x.pend));
    const wiped = tid => !M.some(x => x.tid === tid && live(x));
    const waitOK = ids.filter(t => t !== m.tid && !onF(t)).every(wiped);
    return areas.filter(a => {
      const occ = M.find(x => x.entry === a && live(x));
      if (occ) return occ.tid === m.tid;
      return !onF(m.tid) || waitOK;
    });
  }
  function allEntered(b) {
    const out = [];
    for (const s of SIDES) {
      const e = entered(b, s);
      for (const a in e) if (e[a]) out.push({ slot: slotOf(s, a), side: s, area: a, mon: e[a] });
    }
    return out;
  }
  /* 내 지시 칸 · 내 포켓몬 편집은 GM 과 그 자리의 주인만 — 모의전 권한(mgr)과는 별개 */
  /* 파티 불러오기: 진행하는 사람(mgr) + 「자기 것만」 방의 플레이어(자기 자리로) */
  function canLoad(c) {
    return c.mgr || (c.role === 'seat' && !!c.seat && c.strict);
  }
  /* 함께 지시하기 (10-25 망령): 트레이너 시트(roster.trainers.<id>.co)에 적힌 좌석은 그 트레이너를 제 것처럼 다룬다 — 지시 창 · 준비 · 공개 · 포켓몬 조작.
    co 는 시트 주인과 GM 만 쓸 수 있는 칸이고, 서버(om_own)가 같은 칸을 보고 숨긴 지시 읽기 · 저장을 허락한다 */
  /* 11-04 23:17 망령 「PL 이 파티 여러 개 쓰기」: 좌석 X 가 「추가 파티」로 불러온 트레이너는 id 가 X~2 · X~3 … — 그 좌석 것으로 친다 (서버 om_own 도 같은 규칙, supabase/patch_2026-11-04_여러파티.sql) */
  function baseSeat(c, tid) {
    const i = String(tid || '').indexOf('~');
    if (i < 1) return '';
    const s = String(tid).slice(0, i);
    return (c.ST.state.seats || {})[s] ? s : '';
  }
  function coOf(c, tid) {
    const t = ((c.ST.state.roster || {}).trainers || {})[tid];
    const L = t && Array.isArray(t.co) ? t.co.filter(s => s && s !== tid) : [];
    const bt = ((c.b || c.ST.state.battle || {}).trainers || {})[tid];
    for (const x of (bt && bt.mates) || []) if (x && x.seat && x.seat !== tid && !L.includes(x.seat)) L.push(x.seat);
    {
      const bs = baseSeat(c, tid);
      if (bs && !L.includes(bs)) L.push(bs);
    }
    return L;
  } /* 10-25: 함께 지시하기로 합쳐진 손님 좌석(mates.seat)도 */
  function ownT(c, tid) {
    return c.role === 'seat' && !!c.seat && !!tid && (tid === c.seat || coOf(c, tid).includes(c.seat));
  }
  /* 차례 자동 처리(선입력 차감 · 준비 꼴 · 공개)를 누가 맡나: 주인 화면, 주인이 없으면 함께 지시하는 좌석 중 접속한 첫 자리 — 같은 일을 두 화면이 하지 않게 */
  const coHtml = (c, tid) => {
    const L = coOf(c, tid);
    if (!L.length) return '';
    const S = c.ST.state.seats || {};
    return ` <span class="cow" title="이 트레이너를 함께 지시하는 플레이어">👥 ${esc(L.map(s => (S[s] || {}).name || s).join(' · '))}</span>`;
  };
  const coBtn = (c, tid) =>
    (c.gm || c.seat === tid) && ((c.ST.state.roster || {}).trainers || {})[tid]
      ? `<button class="btn xs ghost" data-act="co" data-tid="${tid}" title="여러 플레이어가 이 트레이너의 지시 창 · 조작권을 함께 쓴다">함께 지시</button>`
      : '';
  function lead(c, tid) {
    if (!ownT(c, tid)) return false;
    if (tid === c.seat || baseSeat(c, tid) === c.seat) return true;
    if (!(c.ST.state.seats || {})[tid] || A().online(tid)) return false;
    return (
      coOf(c, tid)
        .filter(s => s === c.seat || A().online(s))
        .sort()[0] === c.seat
    );
  }
  /* 10-27 망령: PL 권한(c.fair) 중의 GM 은 자기가 불러온 트레이너만 — byAcct 가 다른 GM 것이면 지시 · 편집 · 수동 공개를 가린다 (자동 진행은 그대로). byAcct 가 없는 예전 트레이너는 어느 GM 이든 */
  function gmMine(c, tid) {
    const t = ((c.b || {}).trainers || {})[tid] || {};
    if (!t.byAcct || t.byAcct === 'gm') return true;
    const k = A().acctKey ? A().acctKey() : '';
    return !k || t.byAcct === k;
  }
  function fairOff(c, tid) {
    return !!(c.gm && c.fair && (seatOwned(c, tid) || !gmMine(c, tid)));
  }
  function myTrainers(c) {
    const trs = c.b.trainers || {};
    if (c.gm) return Object.keys(trs).filter(t => !fairOff(c, t));
    return Object.keys(trs)
      .filter(t => ownT(c, t))
      .sort((x, y) => (y === c.seat) - (x === c.seat));
  }
  /* 10-27 망령: 요약 창은 그 트레이너를 다루는 사람만 — 좌석 주인 · 함께 지시, GM 은 PL 권한 중이면 자기가 불러온 트레이너만 (관전 · 상대는 못 본다) */
  function stxOk(c, tid) {
    return !!tid && !!(c.b.trainers || {})[tid] && (ownT(c, tid) || (c.gm && !fairOff(c, tid)));
  }
  function canEdit(c, mon) {
    if (mon && ownT(c, mon.tid)) return true;
    return c.gm && !(mon && fairOff(c, mon.tid));
  }
  function fieldOf(b) {
    return Object.assign(
      { weather: { type: '', count: 0 }, terrain: { type: '', count: 0 }, rooms: {}, etc: {}, objects: { left: {}, right: {} } },
      b.field || {}
    );
  }
  function typeChip(en) {
    return A().typeChip(en);
  }
  function monName(b, mid) {
    const m = V(ctx(), (b.mons || {})[mid]);
    return m ? m.name : '?';
  }

