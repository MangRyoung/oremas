/* ── 조각 00_head.js — 머리 · 상수 · 작은 도우미 ── */
/* ---------- 배틀 씬 UI (1단계: 엔트리 · 지시 입력 · 준비 · 공개 · 행동 순서 · 공격/대미지 · 랭크/상태 · 필드 · 턴 종료) ----------
   상태 모양:
   battle = { turn, phase, mode(에리어 수 1~3), sides:{left:{trainers}, right:{trainers}}, trainers:{tid:{…,side}},
              mons:{mid:{…, side, slot, entry:'a'|'b'|'c'|'', started, hp, rank, mod, states, item}},
              field:{weather:{type,count}, terrain:{type,count}, rooms:{트릭룸..}, etc:{중력..}, objects:{left:{리플렉터:n}, right:{}}},
              cmds:{tid:{mons:{mid:{…}}, order, command, detail}}  (공개된 지시), order:[{slot,mid,name}] }
   ready = {tid:true}   비밀 지시 = om_secret(kind 'cmd', id = tid) */
'use strict';
/* 10-24 망령: 개인전 — 트레이너에 solo 가 켜져 있으면 같은 진영에 서 있어도 그 트레이너 혼자 한 편이다 (정보 비공유 · 서로 적).
   팀 = solo 면 'solo:<트레이너 id>', 아니면 진영(left/right). x = 트레이너 id 문자열 · 포켓몬(tid) · 트레이너 객체(id) */
window.OM_TEAM = function (b, x) {
  b = b || {};
  const trs = b.trainers || {};
  let tid, side;
  if (typeof x === 'string') {
    tid = x;
    side = (trs[x] || {}).side;
  } else if (x) {
    tid = x.tid != null ? x.tid : x.id;
    side = x.side;
  } else return '';
  const t = trs[tid];
  if (t && t.solo) return 'solo:' + tid;
  return side || (t && t.side) || '';
};
window.OM_BATTLE_UI = (() => {
  /* 모바일(760px 이하) 배틀 상단 조작판: 기본은 접어서 TURN · 지금 단계 · 「턴 진행」만 보이고, 「펼치기」로 전부 연다 (css .bstat.fold). 펼친 상태는 브라우저마다 기억 */
  const BFOLD = {
    open: (() => {
      try {
        return localStorage.getItem('om_bfold') === '1';
      } catch (e) {
        return false;
      }
    })()
  };
  /* 11-03 감우 (검토 15-②): 배틀 탭의 화자 칩 줄(rp_ui bspkHtml)은 기본 접힘 — 토글은 브라우저마다 기억 */
  const BSPKF = {
    open: (() => {
      try {
        return localStorage.getItem('om_bspkfold') === '1';
      } catch (e) {
        return false;
      }
    })()
  };
  /* 11-03 감우 (검토 15-①): 조작판(.bstat)이 스크롤로 화면 밖에 나가면 얇은 sticky 바(#bsticky)를 보인다 */
  let STKIO = null,
    STKON = false;
  /* 11-12 01:23 제보 「스크롤을 내린 채 sticky 바의 「턴 진행」 · 행동 순서의 「다음 행동」을 누를 때마다 스크롤이 아래로 내려간다」:
    다시 그릴 때마다 sticky 바가 꺼진 채(display:none) 새로 생겼다가 관찰자가 다시 켜서, 바 높이만큼 내용이 밀리고 브라우저 스크롤 고정(scroll anchoring)이 그만큼 아래로 따라갔다
    → 켜져 있던 상태(STKON)를 기억해 새 바도 처음부터 켠 채로 그린다 */
  function stickyWatch(el) {
    const bs = el.querySelector('.bstat'),
      st = el.querySelector('#bsticky');
    if (STKIO) {
      STKIO.disconnect();
      STKIO = null;
    }
    if (!bs || !st) return;
    if (STKON) st.classList.add('on');
    STKIO = new IntersectionObserver(
      es => {
        for (const e of es) {
          const on = !e.isIntersecting && e.boundingClientRect.top < (e.rootBounds ? e.rootBounds.top : 0);
          STKON = on;
          st.classList.toggle('on', on);
        }
      },
      { root: el.closest('.scene') || null, threshold: 0 }
    );
    STKIO.observe(bs);
  }
  const OI = () => window.OM_ITEMS; /* 소지품 자동화 (js/engine/items.js) */
  const A = () => window.OM_APP,
    S = () => window.OM_STATS,
    B = () => window.OM_BATTLE,
    DB = () => window.OM_DB || {},
    DBS = () => window.OM_STORE;
  const APLOG = () => {
    try {
      return localStorage.getItem('om_aplog') !== '0';
    } catch (e) {
      return true;
    }
  }; /* 【보정】 나만 보는 로그 켜기 (이 브라우저) */
  const esc = s =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const $ = (s, r) => (r || document).querySelector(s);
  const AREAS = ['a', 'b', 'c'];
  const SIDES = ['left', 'right'];
  const SIDE_KO = { left: '좌측', right: '우측' };
  const STAT_KO = {
    attack: '공격',
    defense: '방어',
    specialattack: '특공',
    specialdefense: '특방',
    speed: '스피드',
    accuracy: '명중',
    evasion: '회피',
    critical: '급소'
  };
  const WEATHER = ['', '맑음', '비', '모래바람', '싸라기눈', '눈', '짙은안개', '밤', '별하늘', '큰가뭄', '폭우', '난기류', '극한', '깊은밤'];
  const WEATHER_MUL = {
    극한: { Fire: 0.25 },
    맑음: { Fire: 1.5, Water: 0.5 },
    큰가뭄: { Fire: 1.5, Water: 0 },
    비: { Water: 1.5, Fire: 0.5 },
    폭우: { Water: 1.5, Fire: 0 },
    밤: { Ghost: 1.33, Dark: 1.33 },
    깊은밤: { Ghost: 1.33, Dark: 1.33 },
    별하늘: { Normal: 1.33, Dragon: 1.33 },
    짙은안개: { Poison: 1.33, Fairy: 1.33 }
  }; /* 10-24 제보: 밤 · 별하늘 · 짙은안개(깊은밤 포함)는 ×1.33 — 맑음 · 비만 ×1.5 */
  const TERRAIN = ['', '그래스필드', '일렉트릭필드', '미스트필드', '사이코필드'];
  const ROOMS = ['트릭룸', '매직룸', '원더룸', '블랙룸'];
  const ETC = ['중력', '물놀이', '흙놀이'];
  /* 설치기 분류 (맵툴 레디메이드 생성기의 나눔): 이름, 기본 지속, 설명 */
  const OBJ_CAT = [
    ['wall', '벽·장막', 5, '5턴', ['리플렉터', '빛의장막', '오로라베일', '신비의부적', '흰안개', '주술', '검은숲']],
    ['aid', '진영 효과', 4, '4턴', ['얼음의장벽', '신기루', '순풍', '무지개', '습원', '불바다', '돌격']],
    ['hazA', '설치기 A', 1000, '땅 위 포켓몬만 · 등장 때', ['압정뿌리기', '독압정', '지뢰원', '끈적끈적네트', '기뢰']],
    [
      'hazB',
      '설치기 B',
      1000,
      '모든 포켓몬 · 등장 때',
      ['트램펄린', '스텔스록', '불기둥', '장미원', '가시원', '얼음꼬챙이', '전기발판', '아이스번', '저주의묘', '악의소굴', '전파탑']
    ],
    ['etc', '기타', 2, '', ['희망사항', '이때다!']],
    ['guard', '방어', 1, '이번 턴', ['와이드가드', '트릭가드', '에임가드']]
  ]; /* 10-25 망령: 와이드가드 = 자진 「전체기 방어」 (턴 종료까지) */
  /* 11-07 망령: 설치물 아이콘 (와이드가드 = 전체기 방어, 방패 셋) */
  const OBJ_IMG = {
    와이드가드: 'img/state/WideGuard.webp',
    트릭가드: 'img/state/WideGuard.webp',
    에임가드: 'img/state/WideGuard.webp',
    '리플렉터': 'img/obj/Reflect.webp',
    '빛의장막': 'img/obj/LightScreen.webp',
    '오로라베일': 'img/obj/AuroraVeil.webp',
    '신비의부적': 'img/obj/Safeguard.webp',
    '흰안개': 'img/obj/Mist.webp',
    '주술': 'img/obj/Hex.webp',
    '검은숲': 'img/obj/DarkForest.webp',
    '얼음의장벽': 'img/obj/IceWall.webp',
    '신기루': 'img/obj/Mirage.webp',
    '순풍': 'img/obj/Tailwind.webp',
    '무지개': 'img/obj/Rainbow.webp',
    '습원': 'img/obj/Swamp.webp',
    '불바다': 'img/obj/SeaOfFire.webp',
    '돌격': 'img/obj/Assault.webp',
    '압정뿌리기': 'img/obj/Spikes.webp',
    '독압정': 'img/obj/ToxicSpikes.webp',
    '지뢰원': 'img/obj/Minefield.webp',
    '끈적끈적네트': 'img/obj/StickyWeb.webp',
    '기뢰': 'img/obj/SeaMine.webp',
    '트램펄린': 'img/obj/Trampoline.webp',
    '스텔스록': 'img/obj/StealthRock.webp',
    '불기둥': 'img/obj/FirePillar.webp',
    '장미원': 'img/obj/RoseGarden.webp',
    '가시원': 'img/obj/Thorns.webp',
    '얼음꼬챙이': 'img/obj/IceSpikes.webp',
    '전기발판': 'img/obj/ElectricPlate.webp',
    '아이스번': 'img/obj/BlackIce.webp',
    '저주의묘': 'img/obj/CursedGrave.webp',
    '악의소굴': 'img/obj/WickedDen.webp',
    '전파탑': 'img/obj/RadioTower.webp',
    '희망사항': 'img/obj/Wish.webp',
    '이때다!': 'img/obj/NowOrNever.webp'
  }; /* 11-11 망령 「날씨 · 필드류는 그림이 있는데 설치기는 없지? 다 만들어서 넣자」: 감우가 그린 아이콘 (img/obj · 96px) */
  const objCat = name => OBJ_CAT.find(c => c[4].includes(name)) || OBJ_CAT[4];
  const WALLS = { 리플렉터: 'reflector', 빛의장막: 'lightscreen', 얼음의장벽: 'icewall', 오로라베일: 'aurora' };
  /* 11-11 망령 「익스펜션 : 격투」: 자신의 「단일기 : 격투」가 적진의 「장벽」(리플렉터 · 빛의장막 · 얼음의장벽 · 오로라베일)을 무시한다 */
  /* 11-26 09:20 망령 (권수아 『마음의 양식』 「【탈진】/대상의 공격을 받으면 「우드혼」의 「드레인」을 강화(1/2→3/4)한다」): 쓰는 쪽 포텐셜 글 — 그 기술의 드레인 분수가 앞 분수와 같으면 뒤 분수로 (글로 읽는다 · 구문 없음).
    앞에 붙는 조건은 「대상(상대)의 공격을 받으면」만 안다 — 이번 턴에 그 대상에게 맞았을 때(mons[].hitBy = {t:턴, by:[때린 포켓몬]} · 공격을 적용할 때 적는다). 모르는 조건이 붙은 줄은 손으로.
    횟수(【탈진】 · 【N/시】 …)가 남았을 때만 · 적용하면 drainUpPot 로 potMark */
  let DRUP_RE = null;
  const drupRe = () =>
    DRUP_RE ||
    (DRUP_RE = FX().FRAC.re(
      '「\\s*([^」]+?)\\s*」\\s*의\\s*「?\\s*드레인\\s*」?(?:량)?\\s*(?:을|를|이)\\s*강화\\s*'
    )); /* 묶음: 1 기술 이름 · 2~5 분수 (fx FRAC) */
  function drainUp(atk, mv, MAU, targets, b) {
    try {
      if (!MAU || !MAU.drain || !atk || !mv) return MAU;
      const fr = x => String(x).replace(/\s/g, '');
      const T = +b.turn || 0;
      for (const p of potSrc(atk)) {
        if (!p || !p.name) continue;
        for (const cl of String(p.eff || '')
          .replace(/<br\s*\/?>/g, '\n')
          .split(/(?=[①②③④⑤⑥⑦⑧⑨])|\n/)) {
          const x = cl.match(drupRe());
          if (!x) continue;
          const Q = FX().FRAC.of(x, 2);
          if (!mvNameEq(x[1], mv.name) || Q.fromS !== fr(MAU.drain)) continue;
          const pre = cl
            .slice(0, x.index)
            .replace(/【[^】]*】/g, '')
            .replace(/^[\s\/①②③④⑤⑥⑦⑧⑨]+|\s+$/g, '');
          if (pre) {
            if (!/^(?:대상|상대)의\s*공격을\s*(?:받으면|받았을\s*때|받은\s*턴(?:에)?)$/.test(pre)) continue;
            const ids = (targets || [])
              .map(t => {
                const [sd, ar] = String(t).split('_');
                const d = (entered(b, sd) || {})[ar];
                return d && d.id;
              })
              .filter(Boolean);
            const hb = atk.hitBy && +atk.hitBy.t === T ? atk.hitBy.by || [] : [];
            if (!ids.some(id => hb.includes(id))) continue;
          }
          if (!potLive(atk, p)) continue;
          const L = limOf(p, atk.potUses || {}, atk.potTurn || {});
          if (L.left !== null && L.left <= 0) continue;
          return Object.assign({}, MAU, {
            drain: Q.toS,
            drainBy: `${String(p.name).replace(/[『』]/g, '')} (${Q.fromS}→${Q.toS})`,
            drainUpPot: p.name
          });
        }
      }
    } catch (e) {
      console.warn('drainUp', e);
    }
    return MAU;
  }
  const wallIgn = (atk, mv, tys) =>
    !!atk &&
    String((mv || {}).range || '') === '1체' &&
    (mv || {}).cat !== '변화' &&
    (tys || []).includes('Fighting') &&
    potSrc(atk).some(p => p && String(p.name || '').replace(/[『』\s]/g, '') === '익스펜션:격투');
  /* 10-25 망령: 지금 걸리는 벽 이름 (물리 · 특수 · 불꽃이면 얼음의장벽 빠짐) */
  const wallNames = (objs, cat, ty) =>
    Object.keys(WALLS).filter(
      k =>
        (objs || {})[k] > 0 &&
        (k === '리플렉터' ? cat === 'physical' : k === '빛의장막' ? cat === 'special' : k === '얼음의장벽' ? ty !== 'Fire' : true)
    );
  const catEn = c => (/물리|physical/.test(String(c || '')) ? 'physical' : /특수|special/.test(String(c || '')) ? 'special' : '');
  const slotOf = (side, area) => side + '_' + area;
  /* 11-02 망령 「에리어 바꾸면 자신 대상과 아군 대상이 섞인다」: 지시의 대상은 자리(left_a …)로 적혀 있어, 지시한 뒤 에리어 교대를 하면 「자신」이 옆 아군 자리를 가리켰다.
    지시를 저장할 때 자리마다 그때 있던 포켓몬(tm)을 함께 적고, 쓸 때 같은 편 대상은 그 포켓몬이 지금 있는 자리로 바꾼다(자신 · 아군은 포켓몬을 따라간다).
    상대 대상은 예전처럼 자리 그대로 — 상대가 자리를 바꾸면 그 자리에 온 포켓몬이 맞는다(사이드체인지와 같은 방식). 교대로 들어간 포켓몬이면 자리 그대로 */
  function tmOf(b, targets) {
    const o = {};
    for (const s of targets || []) {
      const i = String(s).indexOf('_');
      if (i < 0) continue;
      const m = Object.values(b.mons || {}).find(q => q.side === s.slice(0, i) && q.entry === s.slice(i + 1));
      if (m) o[s] = m.id;
    }
    return o;
  }
  function tgNow(b, x, me) {
    const L = (x && x.targets) || [];
    const tm = (x && x.tm) || {};
    const out = [];
    for (const s of L) {
      let r = s;
      const mid = tm[s];
      const m = mid && (b.mons || {})[mid];
      if (m && m.entry && m.hp && (!me || m.side === me.side) && String(s).startsWith(m.side + '_')) r = slotOf(m.side, m.entry);
      if (!out.includes(r)) out.push(r);
    }
    return out;
  }
  const TM = (x, b) => window.OM_TEAM(b || ctx().b, x);
  const sameT = (x, y, b) => {
    const p = TM(x, b);
    return !!p && p === TM(y, b);
  }; /* 같은 편인가 (개인전 반영) */
  /* 11-05 망령 「일루젼 — 맵툴에선 어려워 해석 차단으로 바꿨는데, 실기처럼 되면 해보고 싶다」:
    m.disg = 변장한 아군의 mid. 특성 · 포텐셜 「일루젼」이면 등장할 때 벤치 맨 뒤(쓰러지지 않은)로 자동 · 주인 · GM 은 카드에서 바꾸거나 끈다.
    상대 화면(주인 · 같은 편 · GM 이 아닌 화면)에서만 이름 · 그림 · 타입 · Lv · 특성을 그 아군 것으로 그린다(V). 상태(state)는 진짜 그대로 — 계산 · 저장은 진짜로.
    공개 로그 · 컷인은 illuMask 가 진짜 이름 · 그림을 가짜로 바꿔 쓴다(app.js sysLog · cutin.js). 기술의 대미지를 받으면(HP 창 적용) 풀린다 — 「【일루젼】」 줄.
    변장 중 처음 나온 거면 seen 을 켜지 않는다(빠져도 벤치에서 「비공개」 그대로). */
  const ILLU_RE = /^(일루젼|일루전)$/;
  const illuNm = x => String(x || '').replace(/[『』「」\s]/g, '');
  function hasIllu(m) {
    if (!m) return false;
    if (m.illu === false) return false;
    if (m.illu) return true;
    if (illuFk(m) >= 0) return true;
    if (ILLU_RE.test(illuNm((m.form0 && m.form0.ability) || m.ability))) return true;
    return potSrc(m).some(p => p && ILLU_RE.test(illuNm(p.name)));
  }
  /* 11-06 망령 「반드시 「잔다르크」의 모습이 된다 — 변할 모습을 폼체인지 쪽에」: 폼 종류 「일루젼」 = 변장 모습 (이름 · 그림 · 타입 · 특성). disg='@f<k>' */
  function illuFk(m) {
    return m ? formsOf(m).findIndex(f => f && f.kind === '일루젼') : -1;
  }
  function illuOf(b, m) {
    if (!m || !m.disg) return null;
    if (/^@f\d+$/.test(String(m.disg))) {
      const k = +String(m.disg).slice(2);
      const f = formsOf(m)[k];
      if (!f) return null;
      const o = m.form0 || m;
      return {
        id: m.id + '@f' + k,
        dv: '@f' + k,
        fake: true,
        name: f.name || o.name,
        image: f.image || o.image,
        types: f.types || o.types,
        typesKo: f.typesKo || o.typesKo,
        lv: m.lv,
        ability: f.ability || '',
        abilityEff: f.ability ? f.abilityEff : '',
        tera: m.tera,
        teraEn: m.teraEn,
        forms: []
      };
    }
    const t = ((b && b.mons) || {})[m.disg];
    return t && t.id !== m.id ? t : null;
  }
  function illuTrue(c, m) {
    return canEdit(c, m) || (!!c.seat && !c.gm && sameT(c.seat, m, c.b));
  }
  function V(c, m) {
    if (!m) return m;
    const t = illuOf(c.b, m);
    if (!t || illuTrue(c, m)) return m;
    return Object.assign({}, m, {
      name: t.name,
      image: t.image,
      types: t.types,
      typesKo: t.typesKo,
      lv: t.lv,
      ability: t.ability,
      abilityEff: t.abilityEff,
      tera: t.tera,
      teraEn: t.teraEn,
      forms: t.forms,
      form0: null,
      pots: [],
      excl: null,
      exclX: [],
      illuFake: t.id
    });
  }
  function illuChip(c, m, full) {
    if (!m || !illuTrue(c, m)) return '';
    const t = illuOf(c.b, m);
    if (!t && !(full && m.entry && hasIllu(m))) return '';
    return `<span class="rk illu" ${full ? `data-act="illu" data-mid="${m.id}"` : ''} title="일루젼 — ${t ? '상대 화면에는 「' + esc(t.name) + '」(으)로 보인다 · 기술의 대미지를 받으면 풀린다' : '지금은 변장하지 않았다'}${full ? ' · 눌러서 바꾸기' : ''}">🎭 ${t ? esc(t.name) : '변장 없음'}</span>`;
  }
  function illuPick(b, m) {
    const L = Object.values((b && b.mons) || {})
      .filter(x => x && x.tid === m.tid && x.id !== m.id && x.hp && x.hp.cur > 0 && !x.entry)
      .sort((x, y) => (x.slot || 0) - (y.slot || 0));
    return L.length ? L[L.length - 1] : null;
  }
  function illuMask(x, b) {
    b = b || ctx().b;
    const P = [];
    for (const m of Object.values((b && b.mons) || {})) {
      const t = illuOf(b, m);
      if (t && m.name && t.name && m.name !== t.name) P.push([m, t]);
    }
    if (!P.length) return x;
    const fix = v => {
      if (typeof v !== 'string' || !v) return v;
      for (const [m, t] of P) {
        if (m.image && v === m.image) return t.image || '';
        v = v.split(t.name).join('\u0001').split(m.name).join(t.name).split('\u0001').join(t.name);
      }
      return v;
    };
    const walk = v =>
      Array.isArray(v)
        ? v.map(walk)
        : v && typeof v === 'object'
          ? Object.fromEntries(Object.entries(v).map(([k, w]) => [k, k === 'mid' || k === 'id' || k === 'fromId' ? w : walk(w)]))
          : fix(v);
    return walk(x);
  }
  const IMG = () => DB().img || { state: {}, field: {} };
  const W_IMG = {
    맑음: 'weather_Sunny',
    비: 'weather_Rainy',
    모래바람: 'weather_Sandstorm',
    싸라기눈: 'weather_Snowstorm',
    눈: 'weather_Snow',
    짙은안개: 'weather_FoggyMist',
    밤: 'weather_Night',
    별하늘: 'weather_StarryNight',
    큰가뭄: 'weather_Sunny_extreme',
    폭우: 'weather_Rainy_extreme',
    난기류: 'weather_StrongWinds',
    극한: 'weather_Snow_extreme',
    깊은밤: 'weather_Night_extreme'
  };
  const T_IMG = {
    그래스필드: 'field_object_grass',
    일렉트릭필드: 'field_object_electric',
    미스트필드: 'field_object_mist',
    사이코필드: 'field_object_psycho',
    트릭룸: 'room_trick',
    매직룸: 'room_magic',
    원더룸: 'room_wonder',
    블랙룸: 'room_black',
    중력: 'object_gravity',
    물놀이: 'object_watersport',
    흙놀이: 'object_mudsport'
  };
  const fimg = k => (IMG().field[k] ? `img/field/${IMG().field[k]}` : '');
  const simg = k => {
    const v = (((DB().states || {}).st || {})[k] || {}).img || IMG().state[k];
    return !v ? '' : /^(https?:|data:image\/)/.test(v) ? v : `img/state/${v}`;
  }; /* 제작기 상태 변화 DB 의 아이콘이 먼저 */

