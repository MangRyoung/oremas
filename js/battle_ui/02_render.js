  /* ── 조각 02_render.js — 렌더(배틀 화면 그리기) ── */
  /* ---------- 렌더 ---------- */
  /* 상태 설명의 %campaign:키% (맵툴 룰 상수) 를 값으로 — DB 가 바뀔 때마다 한 번 */
  let DESC_FIX = null;
  function fixStDesc() {
    const st = (DB().states || {}).st;
    if (!st || DESC_FIX === st) return;
    DESC_FIX = st;
    const C = (DB().const || {}).campaign || {};
    const rp = s => String(s).replace(/%campaign:([^%]+)%/g, (a, k) => (C[k] != null ? String(C[k]) : a));
    for (const k in st) {
      const d = st[k];
      if (d && Array.isArray(d.desc)) d.desc = d.desc.map(rp);
    }
  }
  function render(el) {
    fixStDesc();
    setTimeout(() => {
      try {
        dupWatch(ctx(), ctx().b);
      } catch (e) {}
      delayWatch(ctx(), ctx().b).catch(() => {});
      syncWatch(ctx(), ctx().b).catch(e => console.warn(e));
    }, 0);
    const c = ctx();
    const b = c.b;
    const f = fieldOf(b);
    const ready = c.ST.state.ready || {};
    const phases = [
      [0, '지시 준비'],
      [1, '턴 개시'],
      [2, '행동 순서'],
      [3, '행동 처리'],
      [5, '턴 종료']
    ];
    const chips = [
      f.weather.type ? `날씨 ${f.weather.type}${f.weather.count ? ' ' + f.weather.count + 'T' : ''}${wxNeg(ctx().b) ? ' (무효)' : ''}` : '',
      f.terrain.type ? `${f.terrain.type}${f.terrain.count ? ' ' + f.terrain.count + 'T' : ''}` : '',
      ...ROOMS.filter(r => (f.rooms || {})[r] > 0).map(r => `${r} ${f.rooms[r]}T`),
      ...ETC.filter(r => (f.etc || {})[r] > 0).map(r => `${r} ${f.etc[r]}T`)
    ].filter(Boolean);
    const mySide = c.mgr ? 'left' : ((b.trainers || {})[myTrainers(c)[0]] || {}).side || 'left';
    /* 11-03 감우: #scene 을 통째로 다시 그리면 치고 있던 입력칸(지시 상세 · 우선도 · 제한 시간)의 포커스가 빠졌다 — rp_ui 처럼 어느 칸이었는지(id 또는 data 열쇠) 와 커서를 기억했다가 그린 뒤 되찾는다.
     지시 입력 영역(#cmdForm)은 HTML 이 지난번과 같으면 옛 요소를 그대로 다시 붙인다 (접힌 칸 · 스크롤 유지) */
    const FK = x =>
      x
        ? x.id
          ? '#' + x.id
          : x.dataset && x.dataset.f
            ? `[data-f="${x.dataset.f}"]${x.dataset.mid ? `[data-mid="${x.dataset.mid}"]` : ''}${x.dataset.slot ? `[data-slot="${x.dataset.slot}"]` : ''}`
            : ''
        : '';
    const ae = document.activeElement;
    const keep =
      ae && el.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)
        ? { sel: FK(ae), v: ae.value, s: ae.selectionStart, e: ae.selectionEnd }
        : null;
    const oldForm = $('#cmdForm', el);
    const cmdH = cmdPanel(c, ready);
    const sameCmd = !!(oldForm && oldForm._h === cmdH);
    /* 11-03 감우 (검토 15-①): 얇은 sticky 바 — 조작판(.bstat)이 화면 밖으로 나가면 보인다 (stickyWatch). 턴 진행 · 지금 페이즈 · 필드 칩 · 다음 행동 · 되돌리기만 */
    const phN =
      (phases.find(([p]) => p === (+b.phase || 0)) || [, ''])[1] +
      ((+b.phase || 0) === 1 && b.tstep ? (+b.tstep === 1 ? ' · 교대' : ' · 포텐셜 발동') : '');
    const nxt =
      (+b.phase || 0) === 1 ? (+b.tstep === 2 ? '행동 순서' : '다음') : ['턴 개시', '행동 순서', '행동 처리', '', '', '턴 종료'][+b.phase || 0] || '';
    const ordOn = (b.order || []).length && (+b.phase || 0) >= 2 && (+b.phase || 0) < 5;
    const oi = Math.min((+b.orderIdx || 0) + 1, (b.order || []).length);
    const pvpChip = b.pvp ? '<span class="chip pvpc" title="PVP 모드 — 양쪽 도감 · 벤치가 모두에게 공개된다">PVP</span>' : '';
    const sticky = `<div class="bsticky" id="bsticky"><span class="bstk"><b>TURN ${b.turn || 0}</b><i>${esc(phN)}</i></span>${pvpChip}${c.mgr ? `<button class="btn xs pri" data-act="progress" title="다음 단계로">턴 진행 ▶${nxt ? ' ' + esc(nxt) : ''}</button>` : ''}${ordOn ? (c.mgr ? `<button class="btn xs" data-act="onext" title="행동 순서의 다음 차례">다음 행동 ▶ <small>${oi}/${(b.order || []).length}</small></button>` : `<span class="chip" title="행동 순서">행동 ${oi}/${(b.order || []).length}</span>`) : ''}<span class="bstf ${c.mgr ? 'clickable' : ''}" ${c.mgr ? 'data-act="field" title="날씨 · 필드 · 룸"' : ''}>${chips.length ? chips.map(x => `<span class="chip">${esc(x)}</span>`).join('') : '<span class="dim small">날씨·필드 없음</span>'}</span><span class="sp"></span>${canRewind(c) ? `<button class="btn xs ghost" data-act="rewind" title="이 턴의 턴 개시 직후로 되돌린다">↶ 되돌리기</button>` : ''}</div>`;
    el.innerHTML = `${sticky}<div class="bstat ${BFOLD.open ? '' : 'fold'}">
   <div class="turn ${c.mgr ? 'clickable' : ''}" ${c.mgr ? 'data-act="turnset" title="눌러서 턴 번호 조정"' : ''}><span class="tlab">TURN</span><span class="tnum">${b.turn || 0}</span></div>${!c.mgr && (c.gm || (c.role === 'seat' && c.seat)) ? `<button class="btn sm ghost aihandb" data-aihand title="AI 에게 맡기기 — 지침 주소 · 이 방 · 정해 둔 것을 한 번에 복사해 아무 AI 대화창에 붙여 넣어요${c.gm ? '' : ' (PL: 내 트레이너 지시 · 대사)'} (js/ai_ui.js)">🤖 AI</button>` : ''}
   <span class="phnow">${esc((phases.find(([p]) => p === (+b.phase || 0)) || [, ''])[1])}${(+b.phase || 0) === 1 && b.tstep ? (+b.tstep === 1 ? ' · 교대' : ' · 포텐셜 발동') : ''}</span>${pvpChip}<span id="bdl" class="bdl">${dlHtml(c, b)}</span><button class="btn sm ghost bfold" data-bfold title="조작판 펼치기 · 접기">${BFOLD.open ? '접기 ▴' : '펼치기 ▾'}</button>
   <div class="phases">${phases
     .map(([p, n]) => {
       const ph0 = +b.phase || 0,
         ts = +b.tstep || 0;
       const on = ph0 === p && (p !== 1 || ts < 1);
       const btn = `<button class="ph ${on ? 'on' : ''}" data-phase="${p}" ${c.mgr ? '' : 'disabled'}>${n}</button>`;
       /* 11-03 21:00 망령 「교대와 선행 입력 발동 타이밍은 다르니 페이즈를 나누자 — 교대 뒤 선행 포텐셜」: 턴 개시 안의 두 단계를 따로 보인다 (누르면 다음 단계로) */
       return p !== 1
         ? btn
         : btn +
             `<button class="ph sub ${ph0 === 1 && ts === 1 ? 'on' : ''}" data-tstepb="1" ${c.mgr ? '' : 'disabled'} title="교대 — 교대 지시가 있으면 여기서 바꾼다">교대</button><button class="ph sub ${ph0 === 1 && ts === 2 ? 'on' : ''}" data-tstepb="2" ${c.mgr ? '' : 'disabled'} title="선행 발동 — 지령 · 선행 포텐셜 (턴 개시에 쓰는 것은 저절로)">선행 발동</button>`;
     })
     .join(
       ''
     )}</div>${c.mgr || c.seat ? '<button class="btn sm autock" data-act="autock" title="내 트레이너 · 필드 위 내 포켓몬에서 자동으로 처리되는 것 (포텐셜 · 특성 · 소지품 · 기술 · 지령)">⚙ 자동화 확인</button>' : ''}
   <span class="sp"></span>${c.mgr ? '' : `<span id="typingBat" class="typingslot">${window.OM_RP_UI && window.OM_RP_UI.typingHtml ? window.OM_RP_UI.typingHtml() : ''}</span>${window.OM_RP_UI && window.OM_RP_UI.bsayToggleHtml ? window.OM_RP_UI.bsayToggleHtml() : ''}<span class="sp"></span>`}   <!-- 11-17 망령 「모바일에서 대사창 끄기 버튼 어딨음?」: 대사창 켜기/끄기는 이 브라우저 설정이라 GM 이 아니어도 (PL 권한 줄 · PL 은 위 줄) -->${window.OM_RP_UI && window.OM_RP_UI.bgmWidgetHtml ? window.OM_RP_UI.bgmWidgetHtml() : ''}   <!-- 11-03 20:47 망령 「BGM 을 오른쪽 위로 올려 한 줄로 · 입력 중은 PVP · PL 권한 줄 오른쪽에」: 진행자(mgr)는 입력 중 칸이 GM 줄 아랫줄 끝으로 -->
   ${
     c.mgr
       ? `<div class="gmrow"><label title="${b.started ? '시합 중에는 바꿀 수 없다 — 「배틀 비우기」 뒤에' : '싱글 1 · 더블 2 · 트리플 3 에리어'}">에리어 <select data-act="mode" ${b.started ? 'disabled' : ''}>${[
           [1, '싱글'],
           [2, '더블'],
           [3, '트리플']
         ]
           .map(([n, l]) => `<option value="${n}" ${mode(b) === n ? 'selected' : ''}>${l}</option>`)
           .join('')}</select>${b.started ? ' 🔒' : ''}</label>
    ${!b.started ? `<button class="btn sm pri" data-act="start" title="연출(VS/경고)과 함께 시합을 시작한다. 동시 내밀기가 켜져 있으면 예약한 포켓몬이 한꺼번에 나온다">시합 개시</button>` : ''}
    <button class="btn sm pri" data-act="progress" title="지시 준비 → 턴 개시 → 행동 순서 → 행동 처리 → 턴 종료 → 다음 턴">턴 진행 ▶ ${(+b.phase || 0) === 1 ? (+b.tstep === 2 ? '행동 순서' : '다음') : ['턴 개시', '행동 순서', '행동 처리', '', '', '턴 종료'][+b.phase || 0] || ''}</button>${
      simAny(b)
        ? (() => {
            const np = Object.values(b.mons || {}).filter(m => m.pend).length;
            return `<button class="btn sm ${np ? 'pri' : 'ghost'}" data-act="pendgo" ${np ? '' : 'disabled'} title="예약한 포켓몬을 양쪽 동시에 내보낸다">동시 내밀기 실행${np ? ' (' + np + ')' : ''}</button>`;
          })()
        : ''
    }${c.gm && (+b.phase || 0) === 1 ? '<button class="btn sm ghost" data-act="reveal" title="아직 안 연 지시를 한꺼번에">모두 공개</button>' : ''}<button class="btn sm" data-act="field" title="날씨 · 그래스필드 등 · 룸 · 필드의 상태">필드</button><button class="btn sm ghost" data-act="rest" title="배틀에 선 트레이너에게 휴식(긴 · 중간 · 숨돌리기)을 바로 건다 — 단계 내용은 스킬 체크 「휴식」 탭">휴식</button>
    <button class="btn sm ghost" data-act="resetcmd" title="모든 지시 · 준비 완료 · 행동 순서를 지운다">초기화</button>${(+b.phase || 0) === 0 ? `<label class="dlset" title="지시 입력 제한 시간(분) — 비우면 제한 없음. 시간이 지나면 「준비 안 된 자리를 행동 없음으로 두고 진행」 단추가 뜬다">⏱ <input type="number" id="dlmin" min="0" max="180" data-act="deadline" value="${+b.deadline > Date.now() ? Math.max(1, Math.ceil((+b.deadline - Date.now()) / 60000)) : ''}" placeholder="분"></label>` : ''}<span class="snapbtns">${canRewind(c) ? `<button class="btn sm ghost" data-act="rewind" title="이 턴의 턴 개시 직후(체크포인트)로 배틀을 되돌린다 — 턴 개시 때마다 남는다 (최근 3턴)">↶ 턴 처음</button>` : ''}<button class="btn sm ghost" data-act="bresume" title="배틀 저장 · 이어서 하기 — 지금 배틀을 이름 붙여 저장하거나, 저장한 배틀을 불러온다">저장 ▾</button></span><span class="gmbr" aria-hidden="true"></span>${c.gm ? '<button class="btn sm" data-act="result" title="HP·빈사·상태 이상·포텐셜 횟수·쓴 소지품을 시트에 돌려준다">결과 정리</button>' : ''}<button class="btn sm ghost danger" data-act="clear" title="배틀을 비운다 (전당에 남길지 먼저 묻는다)">비우기</button>${window.OM_RP_UI && window.OM_RP_UI.bsayToggleHtml ? window.OM_RP_UI.bsayToggleHtml() : ''}${c.mgr ? `<button class="btn sm pvpb ${b.pvp ? 'pri' : 'ghost'}" data-act="pvp" title="${b.pvp ? 'PVP 모드 중 — 양쪽 도감 · 비공개 벤치가 모두에게 공개된다. 누르면 해제(해석한 만큼만 보이게)' : 'PVP 설정 — 켜면 서로의 도감 정보(타입 · 약점 · 종족치 · 기술 · 특성 · 포텐셜)와 비공개 벤치가 모두에게 공개된다 (해석 횟수는 안 쓴다)'}">PVP</button>` : ''}${c.gm ? `<button class="btn sm gmh ${c.fair ? 'pri' : 'ghost'}" data-act="gmhands" title="켜면 GM 도 플레이어처럼 — 플레이어가 올린 트레이너의 지시·준비·HP·상태는 그 플레이어만. GM 이 불러온 파티·NPC 는 GM 이 그대로 지시하고 진행한다 — 이 GM(계정 · 닉)에게만 적용 (방 설정 「GM 불간섭」은 모든 GM)"><span class="lbl">${c.fair ? '↩ GM 권한' : 'PL 권한'}</span><span class="sh">${c.fair ? '↩ GM' : 'PL'}</span></button>` : ''}${c.gm || (c.role === 'seat' && c.seat) ? `<button class="btn sm ghost aihandb gmai" data-aihand title="AI 에게 맡기기 — 지침 주소 · 이 방 · 정해 둔 것을 한 번에 복사해 아무 AI 대화창에 붙여 넣어요${c.gm ? '' : ' (PL: 내 트레이너 지시 · 대사)'} (js/ai_ui.js)">🤖 AI</button>` : ''}
    <span class="gmty"><span id="typingBat" class="typingslot">${window.OM_RP_UI && window.OM_RP_UI.typingHtml ? window.OM_RP_UI.typingHtml() : ''}</span></span>
    ${Object.entries(c.ST.state.pub || {})
      .filter(([k, v]) => v && v.time)
      .map(
        ([k, v]) =>
          `<span class="chip" style="border-color:var(--yel)">타임 요청: ${esc((b.trainers[k] || {}).name || k)} → ${esc(monName(b, v.time.mid))} <button class="btn xs pri" data-act="timeok" data-seat="${k}">허가</button></span>`
      )
      .join('')}</div>`
       : ''
   }
   ${c.gm && window.OM_RP_UI && window.OM_RP_UI.bspkHtml ? `<div class="bspkfold">${window.OM_RP_UI.bspkHtml()}</div>` : ''}
  </div>
  ${revealStrip(c, ready)}${endPanel(c)}
  <div class="stadium">
   ${benchRow(c, 'left', ready)}
   <div class="fieldcol ${f.stage && f.stage.name ? 'staged' : ''} ${fieldBg(f).cls}" style="${fieldBg(f).st}">${areaGrid(c)}${window.OM_STAGE_UI ? window.OM_STAGE_UI.chip(c, f) : ''}${fieldStrip(c, f)}</div>
   ${benchRow(c, 'right', ready)}
  </div>
  ${orderBox(c)}
  ${sameCmd ? '<form id="cmdForm" class="cmdpanel"></form>' : cmdH}`;
    if (sameCmd) {
      const ph = $('#cmdForm', el);
      if (ph) ph.replaceWith(oldForm);
    } else {
      const nf = $('#cmdForm', el);
      if (nf) nf._h = cmdH;
    }
    stickyWatch(el);
    el.querySelectorAll('[data-phase]').forEach(bt => (bt.onclick = () => setPhase(+bt.dataset.phase)));
    el.querySelectorAll('[data-tstepb]').forEach(
      bt =>
        (bt.onclick = () => {
          const b2 = ctx().b;
          if ((+b2.phase || 0) !== 1) return A().toast('턴 개시 뒤에 — 「턴 진행 ▶」으로 들어간다');
          if ((+b2.tstep || 0) >= +bt.dataset.tstepb) return;
          return stepTurn();
        })
    );
    autoAdvance();
    try {
      if (window.OM_RP_UI && window.OM_RP_UI.bspkBind) window.OM_RP_UI.bspkBind(el);
    } catch (e) {
      console.warn(e);
    }
    if (window.OM_RP_UI && window.OM_RP_UI.bindBgmWidget) window.OM_RP_UI.bindBgmWidget(el);
    {
      const fb = el.querySelector('[data-bfold]');
      if (fb)
        fb.onclick = () => {
          BFOLD.open = !BFOLD.open;
          try {
            localStorage.setItem('om_bfold', BFOLD.open ? '1' : '0');
          } catch (e) {}
          const bs = fb.closest('.bstat');
          bs.classList.toggle('fold', !BFOLD.open);
          fb.textContent = BFOLD.open ? '접기 ▴' : '펼치기 ▾';
        };
    }
    /* 11-28 망령 「필드랑 SP 버튼이 따로 안 눌리는데」: 트레이너 칸(data-act=stx) 안의 단추를 누르면 칸의 요약까지 같이 열려 창을 덮었다 — 안쪽 단추를 누른 클릭은 바깥 칸이 받지 않는다 */
    const ownClick = (bt, e) => !e || !e.target.closest || e.target.closest('[data-act]') === bt;
    el.querySelectorAll('[data-act]').forEach(bt => {
      if (bt.tagName === 'SELECT') bt.onchange = () => action(bt.dataset, bt.value);
      else if (bt.type === 'checkbox') bt.onchange = () => action(bt.dataset, bt.checked);
      else if (bt.tagName === 'INPUT') bt.onchange = () => action(bt.dataset, bt.value);
      else bt.onclick = e => ownClick(bt, e) && action(bt.dataset);
    });
    el.querySelectorAll('[data-mon]').forEach(
      cd =>
        (cd.onclick = e => {
          if (e.target.closest('[data-act]')) return;
          A().openMon(cd.dataset.mon);
        })
    );
    const form = $('#cmdForm', el);
    if (form) bindCmdForm(form, c);
    cmdFab(form);
    refreshSide(c);
    try {
      hitWatch(c);
      reflash();
    } catch (e) {
      console.warn('hitWatch', e);
    }
    if (keep && keep.sel) {
      try {
        const t = el.querySelector(keep.sel);
        if (t && !t.disabled) {
          if (t.value !== keep.v && /^(INPUT|TEXTAREA)$/.test(t.tagName) && t.type !== 'number') t.value = keep.v;
          t.focus({ preventScroll: true });
          if (keep.s != null && t.setSelectionRange)
            try {
              t.setSelectionRange(keep.s, keep.e);
            } catch (e) {}
        }
      } catch (e) {}
    }
  }
  /* 폰: 카드 「⋯」로 나머지 버튼 펼치기 */
  document.addEventListener('click', e => {
    const h = e.target.closest('[data-bfold]');
    if (!h || e.target.closest('button,label,input,select,a,.chip') || !matchMedia('(max-width:760px)').matches) return;
    const sd = h.dataset.bfold;
    UIC.bfold = UIC.bfold || {};
    UIC.bfold[sd] = !UIC.bfold[sd];
    const col = h.closest('.bcol');
    if (col) col.classList.toggle('fold', UIC.bfold[sd]);
  });
  document.addEventListener(
    'click',
    e => {
      const t = e.target.closest('[data-mmore]');
      if (!t) return;
      e.stopPropagation();
      const box = t.closest('.mbtns');
      const on = box.classList.toggle('open');
      {
        const nx = box.nextElementSibling;
        if (nx && nx.classList.contains('mbtns2')) nx.classList.toggle('open', on);
      }
      t.setAttribute('aria-expanded', on ? 'true' : 'false');
    },
    true
  );
  /* 폰: 지시 입력 칸이 화면 밖이면 아래에 「지시 입력」 버튼을 띄워 바로 내려간다 */
  let FAB = null,
    FABIO = null;
  function cmdFab(form) {
    if (!FAB || !FAB.isConnected) {
      FAB = document.createElement('button');
      FAB.type = 'button';
      FAB.className = 'cmdfab';
      FAB.innerHTML = '✎ 지시 입력';
      FAB.onclick = () => {
        const f = document.getElementById('cmdForm');
        if (f) f.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      document.body.appendChild(FAB);
    }
    if (FABIO) {
      FABIO.disconnect();
      FABIO = null;
    }
    if (!form) {
      FAB.classList.remove('on');
      return;
    }
    FABIO = new IntersectionObserver(
      es => {
        for (const e of es) FAB.classList.toggle('on', !e.isIntersecting && e.boundingClientRect.top > 0);
      },
      { threshold: 0 }
    );
    FABIO.observe(form);
  }
  document.addEventListener(
    'click',
    e => {
      const t = e.target.closest('.mvdb');
      if (!t) return;
      e.stopPropagation();
      e.preventDefault();
      if (document.querySelector('.modalbg') && !document.querySelector('.dbmodal')) return;
      window.OM_DB_UI.open({ kind: 'move', sel: t.dataset.mvdb });
    },
    true
  );
  /* ---------- 11-03 감우 (검토 18): 피해 받는 쪽 알림 — 내 포켓몬에 lastHit 이 새로 생기면 토스트 「○○ 피해 판정 받음 — 적용」(누르면 HP 창) + 효과음, 휴대폰 cmdfab 에 숫자 뱃지. 같은 lastHit(mid + at)에 한 번만 ---------- */
  const HITSEEN = new Set();
  let HITT = null;
  function myHits(c) {
    const mine = myTrainers(c);
    return Object.values(c.b.mons || {}).filter(m => m && m.lastHit && m.entry && m.hp.cur > 0 && mine.includes(m.tid) && canEdit(c, m));
  }
  function hitBadge() {
    const c = ctx();
    const n = c.b && c.b.mons ? myHits(c).length : 0;
    if (FAB && FAB.isConnected) {
      FAB.dataset.badge = n ? String(n) : '';
      FAB.classList.toggle('hit', n > 0);
    }
    return n;
  }
  function hitWatch(c) {
    const L = myHits(c);
    hitBadge();
    const fresh = L.filter(m => {
      const k = m.id + ':' + (+m.lastHit.at || 0);
      if (HITSEEN.has(k)) return false;
      HITSEEN.add(k);
      return Date.now() - (+m.lastHit.at || 0) < 60000;
    });
    if (!fresh.length) return;
    const m = fresh[fresh.length - 1];
    let el = document.querySelector('.hittoast');
    if (!el) {
      el = document.createElement('button');
      el.type = 'button';
      el.className = 'hittoast';
      document.body.appendChild(el);
    }
    el.innerHTML = `<b>${esc(m.name)}</b> 피해 판정 받음${fresh.length > 1 ? ` 외 ${fresh.length - 1}` : ''} <span class="hta">— 적용</span>`;
    el.onclick = () => {
      el.remove();
      openHp(m.id, 'dmg');
    };
    el.classList.add('on');
    clearTimeout(HITT);
    HITT = setTimeout(() => {
      el.classList.remove('on');
      setTimeout(() => {
        if (!el.classList.contains('on')) el.remove();
      }, 300);
    }, 8000);
    try {
      const U = window.OM_RP_UI;
      if (U && U.seUrlOf && U.seUrlOf('Ping')) U.playSe('Ping', true);
      else if (CUT() && CUT().synth) CUT().synth('ready');
    } catch (e) {}
  }

  /* 턴 개시 뒤 맨 위: 지시 공개 UI (맵툴 open_command). 자기 것(GM 은 모두)은 버튼, 남의 것은 현황. 지령·명령은 공개하지 않고 「4식 6령」 창에서 발동한다 */
  /* 11-17 시노비 「HP 탭 반동: 전체기면 반동을 부여한 상대가 1체여도 2체에게 가한 대미지로」: 직전 공격이 여럿을 맞혔으면 반동 · 드레인의 기준을 「전체 / 대상 하나」로 고른다 */
  function ldSel(m) {
    const L = m.lastDealt && m.lastDealt.per;
    if (!L || L.length < 2) return '';
    return `<div class="spx"><b>↯ 기준</b><span class="small dim">반동 · 드레인을 셀 대미지</span><span class="qs"><select id="h_ldt" class="mini"><option value="">전체 ${m.lastDealt.total}</option>${L.map((x, i) => `<option value="${i}">${esc(x.n)} 몫 ${x.v}</option>`).join('')}</select></span></div>`;
  }
  function ldPick(m, md) {
    const L = m.lastDealt || { total: 0 };
    const el = md && md.querySelector('#h_ldt');
    const i = el && el.value !== '' ? +el.value : -1;
    const x = i >= 0 && L.per ? L.per[i] : null;
    return x ? { v: +x.v || 0, n: x.n } : { v: +L.total || 0, n: '' };
  }
  /* 급소 소지품: 초점렌즈·예리한손톱 C+1, 럭키펀치(럭키) C+2, 받는 쪽 방검조끼 C-2 — 맵툴처럼 자동 */
  function itemCrit(atk, def) {
    if (OI()) return OI().crit(atk, def);
    let v = 0;
    const ai = IT(atk),
      di = IT(def);
    if (ai === '초점렌즈' || ai === '예리한손톱') v += 1;
    if (ai === '럭키펀치' && /럭키/.test(atk.species || atk.name || '')) v += 2;
    if (di === '방검조끼') v -= 2;
    return v;
  }
  /* 기술 부가효과 굴림: 효과 글의 「N할 …」마다 1d10 ≤ N 이면 발동. 10할은 굴리지 않고 확정. 하늘의은총 ×2, 받는 쪽 은밀망토면 없음. 적용은 손으로 */
  /* 10-27 제보: 부가효과 확률을 공격 창에서 바꿀 수 있게 — SECADJ = {add:%p, sure} (공격 창 「부가효과」 칸). 보정이 있으면 %로 굴린다 */
  let SECADJ = { add: 0, sure: false };
  function secRoll(n) {
    const A0 = SECADJ || {};
    if (A0.sure) return { ok: true, txt: ' — 확정 (손으로)' };
    if (!A0.add) {
      if (n >= 10) return { ok: true, txt: ' — 확정' };
      const r = 1 + Math.floor(Math.random() * 10);
      const ok = r <= n;
      return { ok, txt: ` — 굴림 ${r}/${n} ${ok ? '발동!' : '불발'}` };
    }
    const p = Math.max(0, Math.min(100, n * 10 + (+A0.add || 0)));
    if (p >= 100) return { ok: true, txt: ` → ${p}% (보정 ${A0.add > 0 ? '+' : ''}${A0.add}%p) — 확정` };
    const r = 1 + Math.floor(Math.random() * 100);
    const ok = r <= p;
    return { ok, txt: ` → ${p}% (보정 ${A0.add > 0 ? '+' : ''}${A0.add}%p) — 굴림 ${r}/${p} ${ok ? '발동!' : '불발'}` };
  }
  function secRolls(atk, def, mv) {
    const t = String(mv.eff || '');
    const out = [];
    const re = /(\d+)할\s*(?:의\s*확률로\s*|로\s*)?([^.。\n]*)/g;
    let m;
    const SI = def ? SECXM[def.id] || null : null;
    while ((m = re.exec(t))) {
      let n = +m[1];
      const what = m[2].trim() || '추가 효과';
      if (SI && SI.set) n = SI.set;
      if (atk.ability === '하늘의은총' || rainbowOn(atk)) n = Math.min(10, n * 2);
      if (SI) {
        if (SI.mul !== 1) n = Math.min(10, Math.round(n * SI.mul * 10) / 10);
        if (SI.sure) n = 10;
      }
      if (SI && SI.imm && def && def.id !== atk.id) {
        out.push({ ok: false, line: `부가효과 ${m[1]}할 ${what} — ${def.name} 「${SI.imm}」로 받지 않음` });
        continue;
      }
      if (covOf(def)) {
        out.push({ ok: false, line: `부가효과 ${m[1]}할 ${what} — ${covOf(def)}로 받지 않음` });
        continue;
      }
      const R = secRoll(n);
      out.push({ ok: R.ok, line: `부가효과 ${n}할 ${what}${R.txt}` });
    }
    return out;
  }
  /* 기술 자동화 (제작기 js/fx/moveauto.js): 효과 글 → 굴림 + 적용할 op. 맞은 대상마다(target) / 한 번만(once) */
  const MA = () => window.OM_MOVEAUTO;
  const CHARGE_ST = {
    Charge: 'Electric',
    Heat: 'Fire',
    Cool: 'Ice',
    Load: 'Steel'
  }; /* 다음 그 타입 기술 대미지 2배 (공격 창 「충전계 ×2」를 자동으로 켠다) */
  function moveAuto(mv) {
    if (!MA() || !FX()) return null;
    try {
      return MA().parse(mv);
    } catch (e) {
      return null;
    }
  }
  /* 10-22 망령: 발버둥 — 기술 목록 끝에 늘 붙는 칸 (「망각」 · 쓸 기술이 없을 때). 번호 = 원래 기술 수 다음 */
  let STRUG = null;
  const XMV = {}; /* 11-03 「기술사용」 구문: 공격 창을 연 동안만 그 기술을 기술 목록 끝에 붙인다 */
  /* 11-15: 「아군이 「기능 확장」을 내보낼 때 「물리기」와 「특수기」 중 내보냈을 때 더 높은 대미지를 주는 쪽이 된다」(오토나시 고유 『이윽고 당신이 되는 이야기』) — 같은 편 트레이너 고유 · 그 포켓몬 포텐셜에서 찾는다 */
  const BESTCAT_RE = /「\s*기능\s*확장\s*」\s*을\s*내보낼\s*때\s*「\s*물리기\s*」\s*와\s*「\s*특수기\s*」\s*중[^.]*더\s*높은\s*대미지/;
  function bestCatOn(m) {
    try {
      if (!m || !m.tid) return null;
      const b = (A().ST.state || {}).battle || {};
      const T = b.trainers || {};
      const sd = (T[m.tid] || {}).side;
      for (const t of Object.values(T)) {
        if (!t || (sd && t.side !== sd && t.id !== m.tid)) continue;
        const u = (t.unique || []).find(x => x && BESTCAT_RE.test(String(x.eff || '')));
        if (u) return u.name;
      }
      const p = potSrc(m).find(q => q && !q.ph && BESTCAT_RE.test(String(q.eff || '')));
      return p ? p.name : null;
    } catch (e) {
      return null;
    }
  }
  /* 11-15 11시 망령 「장승요의 전용이 제대로 발동되고 있는지도」: 「「X」를 「범위 : R」로 변경하여 필중시킨다. 이 때 자신의 「A」를 「B」와 같게한다」(장승요 전용 『화룡정점의 마지막 한 붓』 ①【1/시】【자동】) —
    그 기술을 낼 때 저절로: 횟수가 남았으면 기술 목록의 X 가 범위 R · 필중(명중 0), 그 판 대미지는 A 를 B 값으로(foulAtk) · 적용 뒤 횟수 −1 + 구문(실수치변경) + 「전용 포텐셜이 발동했을 때」 계기(rcvReact — 『천지를 먹어 그리다』)
    ② 「「Y」를 내보냈을 때 ①의 사용횟수를 회복」. 기술 이름은 이웃한 두 글자가 바뀐 것도 같다고 본다 (시트 글은 「화룡정점」 · DB 기술은 「화룡점정」) */
  const MVMOD_RE =
    /「([^」]+)」\s*(?:을|를)\s*「\s*범위\s*:\s*([^」]+)」\s*(?:으로|로)\s*변경하여\s*(필중시킨다)?(?:[^①②③④]*?자신의\s*「\s*(공격|방어|특공|특방|스피드)\s*」\s*(?:을|를)\s*「\s*(공격|방어|특공|특방|스피드)\s*」\s*(?:과|와)\s*같게)?/;
  function mvNameEq(a, b) {
    const n = x => String(x || '').replace(/[『』「」\s]/g, '');
    a = n(a);
    b = n(b);
    if (a === b) return true;
    if (a.length < 3 || a.length !== b.length) return false;
    const d = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d.push(i);
    return d.length === 2 && d[1] === d[0] + 1 && a[d[0]] === b[d[1]] && a[d[1]] === b[d[0]];
  }
  function mvModOf(m) {
    if (!m || !m.id || !m.tid) return [];
    const out = [];
    let src = [];
    try {
      src = potSrc(m);
    } catch (e) {
      return [];
    }
    for (const p of src) {
      if (!p || !p.name || p.ph) continue;
      const c1 = String(p.eff || '').split(/[②③④⑤]/)[0];
      if (!/【\s*자동\s*】/.test(c1)) continue;
      const x = c1.match(MVMOD_RE);
      if (!x) continue;
      const L = limOf(p, m.potUses || {}, m.potTurn || {});
      if (L.left !== null && L.left <= 0) continue;
      try {
        if (potOffWhy(m, p.name)) continue;
      } catch (e) {}
      out.push({ src: p.name, mv: x[1].trim(), range: x[2].trim(), sure: !!x[3], to: x[4] || '', from: x[5] || '' });
    }
    return out;
  }
  /* 11-15 11시 (로르 샤흐트 나나치 『나락 스튜』): 「「타입 : 무작위」 기술이 「물리기」가 된다」 — 자기 포텐셜 · 전용에 있으면 무작위 타입 기술(혼돈의물감)의 분류를 바꾼다 (공격 · 방어 능력도 그 분류대로) */
  const RNDCAT_RE = /「\s*타입\s*:\s*무작위\s*」\s*기술(?:이|은|을)?\s*「\s*(물리기|특수기)\s*」\s*(?:가|이|로)\s*된다/;
  const rndCatOf = m => {
    if (!m || !m.id || !m.tid) return '';
    try {
      for (const p of potSrc(m)) {
        if (!p || p.ph) continue;
        const x = String(p.eff || '').match(RNDCAT_RE);
        if (x && !potOffWhy(m, p.name)) return x[1] === '물리기' ? '물리' : '특수';
      }
    } catch (e) {}
    return '';
  };
  /* 11-15 11시 (전은영 울트라드래곤 『사두룡의 숨결』 「「테라버스트」를 「거합」 기술로 취급한다」): 자기 포텐셜의 「「X」를 「Y」 기술로 취급한다」 — X 에 태그 Y (자세 → 다음 「거합」 타입 · 「거합」 조건이 본다) */
  const tyEnStrict = x => {
    try {
      const k = String(x || '').trim();
      const t = S().typeEn(k);
      return t && t !== k && t !== '-' ? t : '';
    } catch (e) {
      return '';
    }
  }; /* S().typeEn 은 모르는 낱말을 그대로 돌려준다 — 진짜 타입 이름일 때만 영문 타입을 돌려준다 (11-23 방 시험에서 걸림) */
  /* 11-23 저녁 감우 257 (세바스찬 《연주회장/오케스트라 피트》 「①【H】 PT의 「소리」「춤」 기술을 「명중률 : 100」으로 만든다 ②【H】 PT 이외의 … 「명중률 : 50」」): 전개 중인 필드 글의 【H】 줄을 읽어 기술 명중률을 바꾼다 — H 파티 = stage.hTid 트레이너의 포켓몬, 낫표 = 기술 태그 · 타입 · 이름. 필중기(명중 0)는 건드리지 않는다 */
  const STG_ACC_RE = /【\s*H\s*】\s*PT\s*(이외)?\s*의\s*((?:「[^」:]+」\s*[,·]?\s*)+)\s*기술을\s*「\s*명중률\s*[:：]\s*(\d+)\s*」/g;
  function stageAccApply(m, L) {
    try {
      const s = ((ctx().b || {}).field || {}).stage;
      if (!m || !s || !s.name || !s.hTid || !s.eff || !/【\s*H\s*】/.test(s.eff)) return L;
      const nq = x => String(x || '').replace(/\s/g, '');
      const R = [...String(s.eff).matchAll(STG_ACC_RE)].map(r => ({
        out: !!r[1],
        w: [...r[2].matchAll(/「([^」]+)」/g)].map(x => nq(x[1])),
        acc: +r[3]
      }));
      if (!R.length) return L;
      const mine = m.tid === s.hTid;
      return L.map(x => {
        if (!x || !(+x.acc > 0)) return x;
        const tg = String(x.tag || '')
          .split(/[,\/·\s#]+/)
          .map(nq)
          .concat([nq(x.name), nq(x.type)]);
        const e = R.find(r => r.out !== mine && r.w.some(w => tg.includes(w)));
        return e && +x.acc !== e.acc ? Object.assign({}, x, { acc: e.acc, stgAcc: s.name }) : x;
      });
    } catch (e) {
      return L;
    }
  }
  /* 11-23 저녁 감우 257 (백감우 고유 『쏟아지는 천화』 「【선행】【탈진】/필드의 상태가 「날씨 : 싸라기눈」일 때 이번 턴 아군의 「얼음」 기술을 「대상 : 상대 전체」로 변경한다」): 그 고유를 이번 턴에 발동했으면(trainers.uTurn) 그 트레이너 포켓몬의 그 타입(· 태그 · 이름) 공격기 중 1체 · 정면 기술의 범위를 바꾼다. 글에 날씨 조건이 있으면 지금 날씨도 본다 */
  const UQ_RANGE_RE =
    /(?:「\s*날씨\s*[:：]\s*([^」]+)」\s*일\s*때[^「\n]*)?아군의\s*「([^」:]+)」\s*기술을\s*「\s*(?:대상|범위)\s*[:：]\s*([^」]+?)\s*」\s*(?:으로|로)\s*변경/;
  function uqRangeApply(m, L) {
    try {
      const b = ctx().b || {};
      const t = m && (b.trainers || {})[m.tid];
      if (!t || !Array.isArray(t.unique) || !t.uTurn) return L;
      const T = +b.turn || 0;
      const nq = x => String(x || '').replace(/\s/g, '');
      const R = [];
      for (const u of t.unique) {
        if (!u || !u.name) continue;
        const nm = String(u.name)
          .replace(/[『』]/g, '')
          .trim();
        if (+(t.uTurn || {})[nm] !== T && +(t.uTurn || {})[u.name] !== T) continue;
        if ((t.potOff || {})[nm]) continue;
        const r = String(u.eff || '').match(UQ_RANGE_RE);
        if (!r) continue;
        if (
          r[1] &&
          !r[1]
            .split(/[,\/·]/)
            .map(nq)
            .includes(nq(wxNow(b)))
        )
          continue;
        R.push({ w: nq(r[2]), range: r[3].trim(), src: nm });
      }
      if (!R.length) return L;
      return L.map(x => {
        if (!x || x.cat === '변화' || !/^(1체|정면)$/.test(String(x.range || '').trim())) return x;
        const tg = String(x.tag || '')
          .split(/[,\/·\s#]+/)
          .map(nq)
          .concat([nq(x.name), nq(x.type)]);
        const e = R.find(r => tg.includes(r.w));
        return e ? Object.assign({}, x, { range: e.range, uqRange: e.src }) : x;
      });
    } catch (e) {
      return L;
    }
  }
  const TREAT2_RE = /「([^」:]+)」\s*(?:이|가)\s*「\s*([^」:]+?)\s*」\s*기술이\s*된다/g;
  const TREAT_RE = /「([^」]+)」\s*(?:을|를)\s*「\s*([^」]+?)\s*」\s*기술로\s*취급한다/g;
  const treatOf = m => {
    const out = [];
    if (!m || !m.id || !m.tid) return out;
    try {
      for (const z of m.treatX || []) if (z && z.tag) out.push({ mv: '*', tag: z.tag });
      for (const p of potSrc(m)) {
        if (!p || p.ph || potOffWhy(m, p.name)) continue;
        for (const x of String(p.eff || '').matchAll(TREAT_RE)) out.push({ mv: x[1].trim(), tag: x[2].trim() });
        for (const x of String(p.eff || '').matchAll(TREAT2_RE)) {
          const tg = x[2].trim();
          if (tg && !tyEnStrict(tg)) out.push({ mv: x[1].trim(), tag: tg });
        }
      }
    } catch (e) {}
    return out;
  }; /* 11-23 저녁 감우 256: 「X」이 「소리」 기술이 된다 (타르티니 『악마의 트릴』 ①) — 낫표 안이 타입 이름이 아니면 태그를 붙인다 (타입이면 구문 기술타입 몫) */
  /* 11-17 망령 「싱크로노이즈계열이 1타입만 참조」: 싱크로노이즈 글(「대상이 자신과 같은 「타입」이라면 …」)도 자기 타입 전부로 바꿔 쓴다 · moveauto 가 onlyVsL(여럿)을 버리던 것도 고침 */
  /* 11-15 망령 「진서현 분석」: 「자신의 「타입1」과 같은 타입이 된다 · 자신과 같은 타입인 대상에게 「효과가 굉장」 · 자신과 같은 타입 이외라면 실패」(파동공진파) — 쓰는 포켓몬의 타입으로 글을 바꿔 쓴 사본 (실패 · 상성은 기술 자동화가 읽는다) */
  const selfTyApply = (m, L) => {
    if (!m || !m.id) return L;
    let ty = [];
    try {
      ty = tysOf(m).filter(t => t && t !== '-');
    } catch (e) {}
    if (!ty.length) return L;
    const ko = ty.map(t => S().typeKo(t));
    return L.map(x => {
      if (!x) return x;
      const e = String(x.eff || '');
      if (!/자신의\s*「\s*타입\s*1\s*」\s*과\s*같은\s*타입이\s*된다|자신과\s*같은\s*「?\s*타입/.test(e)) return x;
      let e2 = e
        .replace(
          /대상이\s*자신과\s*같은\s*「\s*타입\s*」\s*이라면\s*「\s*상성\s*:\s*2배\s*」\s*가\s*된다\.?\s*그렇지\s*않다면\s*실패한다/,
          `「타입 : ${ko.join(', ')}」에게 「상성 : 2배」가 된다. 「타입 : ${ko.join(', ')}」 이외에게 내보내면 실패한다`
        )
        .replace(/자신과\s*같은\s*타입인\s*대상에게\s*「\s*효과가\s*굉장\s*」\s*하게\s*된다/, `「타입 : ${ko.join(', ')}」에게 「상성 : 2배」가 된다`)
        .replace(/자신과\s*같은\s*타입\s*이외라면\s*실패한다/, `「타입 : ${ko.join(', ')}」 이외에게 내보내면 실패한다`);
      const o = Object.assign({}, x, { eff: e2 });
      if (/자신의\s*「\s*타입\s*1\s*」\s*과\s*같은\s*타입이\s*된다/.test(e)) {
        o.type = ko[0];
        o.typeEn = ty[0];
      }
      return o;
    });
  };
  const mvModApply = (m, L) => {
    L = selfTyApply(m, L);
    {
      const TR = treatOf(m);
      if (TR.length)
        L = L.map(x => {
          if (!x) return x;
          const add = TR.filter(
            z => (z.mv === '*' || mvNameEq(z.mv, x.name)) && !new RegExp('(^|[,\\s])' + z.tag + '($|[,\\s])').test(String(x.tag || ''))
          );
          if (!add.length) return x;
          const t0 = String(x.tag || '').replace(/^-$/, '');
          return Object.assign({}, x, {
            tag: [t0, ...add.map(z => z.tag)].filter(Boolean).join(','),
            tags: [].concat(
              x.tags || [],
              add.map(z => '#' + z.tag)
            )
          });
        });
    }
    L = stageAccApply(m, L);
    L = uqRangeApply(m, L);
    /* 태그 부여(취급) 뒤에 — 붙은 태그도 본다 */ {
      const rc = rndCatOf(m);
      if (rc)
        L = L.map(x =>
          x && isRndMove(x) && x.cat !== '변화' && x.cat !== rc
            ? Object.assign({}, x, { cat: rc, atk: rc === '물리' ? '공격' : '특공', def: rc === '물리' ? '방어' : '특방' })
            : x
        );
    }
    const MM = mvModOf(m);
    if (!MM.length) return L;
    return L.map(x => {
      const e = x && MM.find(z => mvNameEq(z.mv, x.name));
      return e ? Object.assign({}, x, { range: e.range }, e.sure ? { acc: 0 } : {}, { mvmod: e }) : x;
    });
  };
  async function mvModAfter(mid, R) {
    try {
      if (!R || R.check || !R.mv) return;
      const b = ctx().b;
      const m = b.mons[mid];
      if (!m) return;
      const T = +b.turn || 0;
      for (const p of potSrc(m)) {
        const e = String((p && p.eff) || '');
        const r2 = e.match(/「([^」]+)」\s*(?:을|를)\s*내보냈을\s*때\s*①\s*의\s*사용\s*횟수를\s*회복/);
        if (!r2 || !mvNameEq(r2[1], R.mv.name)) continue;
        const mm = e.match(/【(\d+)\/시】/);
        const u = (m.potUses || {})[p.name];
        if (mm && u != null && +u < +mm[1]) {
          await A().set(['battle', 'mons', mid, 'potUses', p.name], +mm[1]);
          A().sysLog(`【포텐셜】 ${m.name} 『${p.name}』 ② — 「${R.mv.name}」을(를) 내보내 ① 의 사용 횟수를 회복했다 (${mm[1]}/${mm[1]})`, 'battle', {
            mid,
            img: m.image || ''
          });
        }
      }
      const md = R.mv.mvmod;
      if (!md) return;
      const p = potSrc(m).find(q => q && q.name === md.src);
      if (!p) return;
      const L = limOf(p, m.potUses || {}, m.potTurn || {});
      if (L.left !== null && L.left <= 0) return;
      if (L.mmax != null) {
        const u = (m.potUses || {})[p.name];
        await A().set(['battle', 'mons', mid, 'potUses', p.name], Math.max(0, (u == null ? L.mmax : +u) - 1));
      }
      if (L.per) await A().set(['battle', 'mons', mid, 'potTurn', p.name], T);
      const ex = (m.excl && m.excl.name === p.name) || (m.exclX || []).some(q => q && q.name === p.name);
      A().sysLog(
        `【${ex ? '전용' : '포텐셜'}】 ${m.name} 『${p.name}』【자동】 — 「${R.mv.name}」 범위 「${md.range}」${md.sure ? ' · 필중' : ''}${md.to ? ` · 「${md.to}」을(를) 「${md.from}」 값으로` : ''}`,
        'battle',
        { mid, img: m.image || '' }
      );
      const au = FX() && FX().autoOf(m, 'pot', p.name);
      if (au && au.ops && au.ops.length && !au.manual)
        await fireAuto(mid, 'pot', p.name, { quiet: true, noRoll: true, noEv: 1, head: `【${ex ? '전용' : '포텐셜'}】 ${m.name} 『${p.name}』` });
      /* 「『전용 포텐셜』이 발동한 턴 「X」를 내보낸 뒤」(『천지를 먹어 그리다』)는 아래 rcvReact('excl') 가 건다 — 기술을 낸 뒤라 때가 맞다 */
      if (ex) setTimeout(() => rcvReact(m.tid, mid, 'excl', p.name).catch(e => console.warn('rcvReact', e)), 600);
    } catch (e) {
      console.warn('mvModAfter', e);
    }
  }
  function MVS(m) {
    const a = mvModApply(m, teraBlastL(m, (m && m.moves) || []));
    const bc = bestCatOn(m);
    const X = mvModApply(
      m,
      extMoves(m)
        .concat(m && XMV[m.id] ? [XMV[m.id]] : [])
        .map(x => (bc && x && (x.cat === '물리' || x.cat === '특수') ? Object.assign({}, x, { bestCat: bc }) : x))
    );
    if (a.some(x => x && x.name === '발버둥')) return X.length ? [...a, ...X] : a;
    if (!STRUG)
      STRUG = Object.assign(
        window.OM_IMPORT
          ? window.OM_IMPORT.move('발버둥', false)
          : { name: '발버둥', cat: '물리', pow: 50, acc: 0, range: '1체', type: '-', typeEn: '-' },
        { virt: 1 }
      );
    return [...a, STRUG, ...X];
  }
  /* 10-27 망령: 트레이너가 주는 「기능 확장 : 기술」 — 제작기 트레이너 시트 「기능 확장」(t.ext). 기술 목록 맨 뒤(발버둥 다음)에 붙어 지시 · 공격 창에서 고른다.
    횟수는 배틀 트레이너 extUse[번호] (공격 창 「적용」 때 1 씩). who 가 있으면 그 포켓몬만, 없으면 PT 전원 */
  /* 11-02 망령: 테라스탈 · 테라버스트 — 「테라스탈」 상태면 테라 타입이 되고 「공격」「특공」(랭크 · 배율 포함) 중 높은 쪽 분류. 원본 기술은 건드리지 않고 사본만 */
  /* 11-04 망령 「기술 타입에 무작위 — 다크 · 신 빼고 18 타입 중에 랜덤」: 기술 DB 타입 칸이 「무작위」면 쓸 때마다 18 타입 중 하나 */
  const RND18 = [
    'Normal',
    'Fire',
    'Water',
    'Grass',
    'Electric',
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
  function isRndMove(mv) {
    return !!mv && (String(mv.type || '').trim() === '무작위' || mv.typeEn === '무작위' || mv.typeEn === 'Random');
  }
  function rndType() {
    return RND18[Math.floor(Math.random() * RND18.length)];
  }
  function teraOn(m) {
    return !!(m && m.teraActive && m.teraEn && m.teraEn !== '-');
  }
  function teraSame(m) {
    return teraOn(m) && (m.types || []).includes(m.teraEn);
  } /* 타입 1~3 에 타입 4 와 같은 타입 → 「적응력」 */
  function hasTera(m) {
    return !!(m && m.teraEn && m.teraEn !== '-');
  }
  function teraBlastL(m, a) {
    if (!teraOn(m) || !a.some(x => x && /^테라버스트/.test(String(x.name || '')))) return a;
    let ph = false;
    try {
      ph = B().statValue(m, 'attack').value > B().statValue(m, 'specialattack').value;
    } catch (e) {}
    return a.map(x =>
      x && /^테라버스트/.test(String(x.name || ''))
        ? Object.assign({}, x, {
            type: S().typeKo(m.teraEn),
            typeEn: m.teraEn,
            cat: ph ? '물리' : '특수',
            atk: ph ? '공격' : '특공',
            def: ph ? '방어' : '특방',
            teraB: 1
          })
        : x
    );
  }
  /* 11-07 지마 「기술머신을 제작기 DB 에 넣었는데 웹툴에서 안 된다」: 소지품 효과 글 「「기능 확장 : 기술」을 내보낼 수 있다」(기술머신 : …) — 들고 있으면 그 기술을 기술 목록 맨 뒤에.
    적용하면 그 소지품이 소모품이면(제작기 「소모」 O) 칸에서 빼고 itemUsed 에 남긴다 */
  const EXT_IT_RE = /「\s*기능\s*확장\s*:\s*([^」]+?)\s*」(?:을|를)?\s*내보낼\s*수\s*있다/g;
  function itemExtMoves(m) {
    if (!m || IOFF(m)) return [];
    const out = [];
    const IT = DB().items || {};
    const slots = [{ k: 0, item: m.item, eff: m.itemEff }].concat(
      (m.items2 || []).map((x, i) => ({ k: i + 1, item: x && x.item, eff: x && x.itemEff }))
    );
    for (const sl of slots) {
      const nm = String(sl.item || '')
        .replace(/[『』]/g, '')
        .trim();
      if (!nm) continue;
      const db = IT[nm] || {};
      const eff = String(sl.eff || db.eff || '');
      if (!/기능\s*확장/.test(eff)) continue;
      const once = /^소모품/.test(String(db.eff || '')) || /^소모품/.test(eff);
      for (const mm of eff.matchAll(EXT_IT_RE)) {
        const mv = mm[1].trim();
        const base = window.OM_IMPORT
          ? window.OM_IMPORT.move(mv, false)
          : { name: mv, cat: '', pow: 0, acc: 0, range: '1체', type: '-', typeEn: '-' };
        out.push(Object.assign({}, base, { ext: { item: nm, k: sl.k, once, lim: 0, used: 0, left: null, kind: 'act', src: nm } }));
      }
    }
    return out;
  }
  /* 11-07 망령 「어시스트 · 커맨더: 【탈진】/「기능확장 : 도우미, 감싸기, 쉬프트업」을 내보낼 수 있다 — 기술 목록에 넣지 말고 기능 확장으로」:
    포텐셜 · 전용 · 특성 효과 글의 「기능 확장 : A, B, C」(쉼표 · 가운뎃점으로 여럿) · 옛 글 「기술 배치에 「A」「B」를 추가한다」 → 기술 목록 맨 뒤에 (횟수 없음 · 이미 배운 기술은 빼고) */
  const EXT_LIST_RE = /「\s*기능\s*확장\s*:\s*([^」]+?)\s*」(?:을|를)?\s*내보낼\s*수\s*있다/g,
    EXT_OLD_RE = /기술\s*배치에\s*((?:「[^」]+」\s*)+)(?:을|를)?\s*추가한다/g;
  function extNamesOf(eff) {
    const out = [];
    const t = String(eff || '');
    for (const mm of t.matchAll(EXT_LIST_RE)) out.push(...mm[1].split(/\s*[,，·、]\s*/));
    for (const mm of t.matchAll(EXT_OLD_RE)) out.push(...[...mm[1].matchAll(/「([^」]+)」/g)].map(x => x[1]));
    return [...new Set(out.map(x => x.trim()).filter(Boolean))];
  }
  function famFired(m, X) {
    const b = (A().ST.state || {}).battle || {};
    const t = (b.trainers || {})[m.tid];
    if (!t) return false;
    const fd = ((b.cmds || {})[m.tid] || {}).fired || {};
    const x0 = String(X || '').replace(/\s/g, '');
    for (const v of Object.values(fd)) {
      if (!v) continue;
      for (const kind of ['order', 'command']) {
        if (v[kind] == null) continue;
        let n = '';
        try {
          n = pName(b, m.tid, kind, v[kind]);
        } catch (e) {}
        const row = potRowOf(n) || potRowOf(String(n).replace(/[!！]$/, '')) || [];
        const fam = row[0] || '';
        if (
          x0 === '영창'
            ? kind === 'command' && (fam === '영창' || /영창$/.test(n))
            : x0 === '결계'
              ? kind === 'order' && (fam === '5계' || /결계$/.test(n))
              : x0 === '지령'
                ? kind === 'command'
                : x0 === '4식' || x0 === '명령'
                  ? kind === 'order'
                  : String(n).replace(/\s/g, '') === x0
        )
          return true;
      }
    }
    return false;
  }
  function potExtMoves(m) {
    if (!m) return [];
    const have = new Set((m.moves || []).map(x => x && String(x.name || '').trim()));
    const out = [];
    const seen = new Set();
    const src = [
      ...potSrc(m).map(p => ({
        raw: p.name,
        n: String(p.name || '')
          .replace(/[『』]/g, '')
          .trim(),
        e: p.eff || (FX() && FX().effOf ? FX().effOf('pot', String(p.name || '').replace(/[『』]/g, '')) : '')
      })),
      ...(m.ability ? [{ n: m.ability, e: m.abilityEff || (FX() && FX().effOf ? FX().effOf('trait', m.ability) : '') }] : [])
    ];
    src.push(...partyExtSrc(m)); /* 11-09 감우 54-F: 다른 포켓몬 · 고유의 「PT 전원이 기능 확장」 */
    for (const s of src) {
      if (!s.n || !/기능\s*확장|기술\s*배치에/.test(String(s.e || ''))) continue;
      if (potOffWhy(m, s.n)) continue;
      /* 11-18 망령 「사메이마루 아야 『스펠 카드』 【1/시】/『영창』이 발동한 턴 「기능 확장 : 영창」을 내보낼 수 있다」: 「『X』이 발동한 턴」이면 같은 트레이너가 이번 턴 X(영창 · 결계 · 지령 · 4식 · 그 이름)를 냈을 때만 · 【N/시】면 포텐셜 횟수로 센다 */
      {
        const gt = String(s.e || '').match(/『([^』]+)』\s*(?:이|가)\s*발동한\s*턴/);
        if (gt && !famFired(m, gt[1])) continue;
      }
      const lm = s.raw ? String(s.e || '').match(/【\s*(\d+)\s*\/\s*시\s*】/) : null;
      const lim = lm ? +lm[1] : 0;
      const lft = lim ? ((m.potUses || {})[s.raw] == null ? lim : +(m.potUses || {})[s.raw]) : null;
      for (const mv of extNamesOf(s.e)) {
        if (have.has(mv) || seen.has(mv)) continue;
        seen.add(mv);
        const base = window.OM_IMPORT
          ? window.OM_IMPORT.move(mv, false)
          : { name: mv, cat: '', pow: 0, acc: 0, range: '1체', type: '-', typeEn: '-' };
        out.push(
          Object.assign({}, base, {
            ext: { pot: s.n, potRaw: s.raw || '', lim, used: lim ? lim - lft : 0, left: lim ? Math.max(0, lft) : null, kind: 'act', src: s.n }
          })
        );
      }
    }
    return out;
  }
  function extMoves(m) {
    if (!m || !m.tid) return [];
    const IX = itemExtMoves(m).concat(potExtMoves(m));
    const b = (A().ST.state || {}).battle || {};
    const t = (b.trainers || {})[m.tid];
    const L = t && Array.isArray(t.ext) ? t.ext : [];
    if (!L.length) return IX;
    const U = t.extUse || {};
    const out = [];
    L.forEach((e, i) => {
      if (!e || !e.mv || (e.who && e.who !== m.id)) return;
      const base = window.OM_IMPORT
        ? window.OM_IMPORT.move(e.mv, false)
        : { name: e.mv, cat: '', pow: 0, acc: 0, range: '1체', type: '-', typeEn: '-' };
      const lim = +e.lim || 0,
        used = +U[i] || 0;
      out.push(
        Object.assign({}, base, {
          ext: { i, lim, used, left: lim ? Math.max(0, lim - used) : null, kind: e.kind === 'extra' ? 'extra' : 'act', src: e.src || '', tid: m.tid }
        })
      );
    });
    {
      const nm = x => String((x && x.name) || '').replace(/\s/g, '');
      const has = new Set(out.map(nm));
      return out.concat(IX.filter(x => !has.has(nm(x))));
    }
  } /* 11-09 망령 「드래곤옐은 하나만」: 트레이너 기능 확장(t.ext — 횟수 셈)과 같은 기술은 포텐셜 · 고유 쪽 줄을 뺀다 */
  function extGone(mv) {
    return !!(mv && mv.ext && mv.ext.lim && mv.ext.left <= 0);
  }
  let SECX = 1; /* 11-03 「추가효과 ×N」: 공격 창이 지금 기술에 맞춰 정한다 */
  /* 11-09 감우 54-D: 대상마다 추가 효과 규칙 — SECXM[대상 id] = {mul, set(N할로), sure, add[부여], rep(바꾸기), imm(받는 쪽 면역 이름)} · '_' = 첫 대상 (한 번 거는 줄) */
  let SECXM = {};
  function secInfo(atk, def, mv, tys, q) {
    const o = { mul: 1, set: 0, sure: '', add: [], rep: null, imm: '', nm: [] };
    const ok = (e, own, oth, fd) => !(FX() && FX().condAll) || FX().condAll(e, own, oth, q, fd);
    for (const e of spL(atk, 'secx')) {
      if (!spHit(e, mv, tys)) continue;
      if (e.rng === 'single' && q && q.single === false) continue;
      if (e.rng === 'multi' && !(q && q.single === false)) continue;
      /* 11-14 단일기 · 전체기 */ if (!ok(e, atk, def, true)) continue;
      if (e.mode === 'sure') {
        o.sure = e.name;
        o.nm.push(`「${e.name}」 추가 효과 반드시`);
      } else if (e.mode === 'set') {
        o.set = Math.max(o.set, +e.n || 0);
        o.nm.push(`「${e.name}」 추가 효과 ${e.n}할`);
      } else if (e.mode === 'add') {
        o.add.push(e);
        o.nm.push(`「${e.name}」 추가 효과 부여`);
      } else if (e.mode === 'rep') {
        o.rep = e;
        o.nm.push(`「${e.name}」 추가 효과 변경`);
      } else {
        o.mul *= +e.v || 1;
        if (+e.v !== 1) o.nm.push(`「${e.name}」 추가 효과 ×${e.v}`);
      }
    }
    if (def && def.id !== atk.id)
      for (const e of spL(def, 'secimm')) {
        if (!spHit(e, mv, tys) && ((e.types && e.types.length) || (e.tg && e.tg.length))) continue;
        if (!ok(e, def, atk, false)) continue;
        o.imm = e.name;
        break;
      }
    return o;
  }
  function secGroups(atk, def, groups, mv) {
    const SI = def ? SECXM[def.id] : null;
    if (!SI || (!SI.rep && !SI.add.length)) return groups ? groups.map(g => rollGroup(atk, def, g)) : secRolls(atk, def, mv);
    const mk = e => ({
      n: +e.n || 10,
      sec: true,
      label: `「${e.name}」 ${(+e.n || 10) < 10 ? +e.n + '할 ' : ''}「${FX().stKo ? FX().stKo(e.state) : e.state}」`,
      who: 'target',
      ops: [Object.assign({ k: 'state', tgt: 'target', state: e.state }, +e.cnt > 0 ? { count: +e.cnt } : {})],
      when: 'hit'
    });
    /* 11-23 기술을 이름으로 짚은 「바꾸기」(기술:섬뜩한주문)는 그 기술이 대상에게 거는 본 효과(10할 「상태」)도 갈아 끼운다 */ let out;
    if (SI.rep && SI.rep.mv && SI.rep.mv.length && +SI.rep.pc > 0 && +SI.rep.pc < 100 && !(Math.random() * 100 < +SI.rep.pc)) {
      /* 11-23 「「기술」이 저확률로 A 대신 B」(인형사의 영사): 줄 앞 확률(「저확률: 추가효과 바꾸기 …」)은 기술을 쓸 때마다 굴린다 — 안 터지면 원래 효과 그대로 */ out =
        groups ? groups.map(g => rollGroup(atk, def, g)) : secRolls(atk, def, mv);
    } else if (SI.rep) {
      const nmd = !!(SI.rep.mv && SI.rep.mv.length);
      const rest = (groups || []).filter(g => !g.sec && !(nmd && g.who === 'target' && (g.ops || []).some(o => o && o.k === 'state')));
      out = rest.map(g => rollGroup(atk, def, g)).concat([rollGroup(atk, def, mk(SI.rep))]);
    } else out = groups ? groups.map(g => rollGroup(atk, def, g)) : secRolls(atk, def, mv);
    for (const e of SI.add) out.push(rollGroup(atk, def, mk(e)));
    return out;
  }
  function rollGroup(atk, def, g) {
    let n = g.n;
    const SI = g.sec ? (def && SECXM[def.id]) || SECXM._ || null : null;
    if (SI && SI.imm && def && def.id !== atk.id) return { g, ok: false, line: `${g.label} — ${def.name} 「${SI.imm}」로 받지 않음` };
    if (SI && SI.set && !SI.rep) n = SI.set;
    if (g.sec && (atk.ability === '하늘의은총' || rainbowOn(atk))) n = Math.min(10, n * 2);
    if (SI) {
      if (SI.mul !== 1) n = Math.min(10, Math.round(n * SI.mul * 10) / 10);
    } else if (g.sec && SECX !== 1) n = Math.min(10, Math.round(n * SECX * 10) / 10);
    if (SI && SI.sure) n = 10;
    const what = g.label;
    if (g.sec && def && def.id !== atk.id && covOf(def)) return { g, ok: false, line: `${what} — ${covOf(def)}로 받지 않음` };
    const pick = g.oneOf ? g.oneOf[Math.floor(Math.random() * g.oneOf.length)] : null;
    const pk = pick
      ? ' → ' +
        FX()
          .unparse(pick)
          .join(' ')
          .replace(/^상태 /, '')
          .replace(/ target.*$/, '')
      : '';
    if (!((SECADJ || {}).add || (SECADJ || {}).sure) || n >= 10) {
      if (n >= 10) return { g, ok: true, ops: pick || g.ops, line: `${what}${pk}${g.sec ? ' — 확정' : ''}` };
      const r = 1 + Math.floor(Math.random() * 10);
      const ok = r <= n;
      return { g, ok, ops: pick || g.ops, line: `${what} — 굴림 ${r}/${n} ${ok ? '발동!' + pk : '불발'}` };
    }
    const R = secRoll(n);
    return { g, ok: R.ok, ops: pick || g.ops, line: `${what}${R.txt}${R.ok ? pk : ''}` };
  }
  const tgtFor = (atk, def) => op =>
    op.tgt !== 'target' ? op : Object.assign({}, op, { tgt: def.id === atk.id ? 'self' : !sameT(def, atk) ? 'enemy1' : 'ally1' });
  /* 변칙 위력 기술 (맵툴 get_special_move_power 를 옮김): 이름 → (def)=>{pow, note, fixed} */
  const SPMAP = {
    테라클러스터: 'tclu',
    헤비봄버: 'heavy',
    머슬봄버: 'heavy',
    때려부수기: 'heavy',
    메테오퍼니셔: 'heavy',
    아쿠아스탬프: 'heavy',
    록스탬프: 'heavy',
    히트스탬프: 'heavy',
    질주: 'ball',
    마하비행: 'ball',
    앞지르기: 'ball',
    일렉트릭볼: 'ball',
    드래곤에너지: 'spout',
    해수스파우팅: 'spout',
    분화: 'spout',
    기사회생: 'flail',
    바둥바둥: 'flail',
    플레임블래스트: 'flail',
    스완송: 'flail',
    하드프레스: 'press',
    묵사발: 'crush',
    쥐어짜기: 'crush',
    안다리걸기: 'grass',
    풀묶기: 'grass',
    자이로볼: 'gyro',
    매그니튜드: 'mag',
    엘렉키슬롯: 'mag',
    프레젠트: 'present',
    사이코웨이브: 'psywave',
    토해내기: 'spit'
  };
  /* 10-27 망령: 「명중할 때 마다 위력이 「N」씩 증가」(트리플악셀 20 · 트리플킥 10) — 타마다 위력 +N. 0 = 해당 없음 */
  function powStepOf(mv) {
    const m = String((mv || {}).eff || '').match(/명중할\s*때\s*마다\s*위력이\s*「?\s*(\d+)\s*」?\s*씩\s*증가/);
    return m ? +m[1] : 0;
  }
  function specialPowFor(name, atk) {
    const k = SPMAP[String(name || '').trim()];
    if (!k) return null;
    const sv = (m, k) => +B().statValue(m, k).value || 0; /* statValue 는 {value,rank,…} 를 돌려준다 — 숫자만 */
    const spd = m => {
      let v = sv(m, 'speed');
      if ((m.states || {}).Paralysis && !(B().calcSt && B().calcSt(m, 'ParaSpeed'))) v = v / 2;
      return v;
    };
    const ladder = (x, steps, start) => {
      let p = start;
      for (const [t, v] of steps) if (x > t) p = v;
      return p;
    };
    const hpR = m => (m.hp.max > 0 ? m.hp.cur / m.hp.max : 0);
    if (k === 'mag') {
      const r = 1 + Math.floor(Math.random() * 256);
      let p = 10;
      for (const [t, v] of [
        [25, 30],
        [76, 50],
        [153, 70],
        [204, 90],
        [229, 110],
        [242, 150]
      ])
        if (r >= t) p = v;
      return () => ({ pow: p, note: `변칙 위력 ${name}: 판정 ${r}/256 → 위력 ${p}` });
    }
    if (k === 'present') {
      const r = 1 + Math.floor(Math.random() * 100);
      const p = r > 90 ? 120 : r > 60 ? 80 : r > 20 ? 40 : null;
      return () =>
        p
          ? { pow: p, note: `변칙 위력 ${name}: 판정 ${r} → 위력 ${p}` }
          : { pow: 0, fixed: 1, note: `변칙 위력 ${name}: 판정 ${r} → 대상 HP 1/2 회복 (손으로)` };
    }
    if (k === 'spit') {
      const n = FX() && FX().stockOf ? FX().stockOf(atk) : Math.max(0, Math.min(3, +atk.stock || 0));
      return () =>
        n
          ? { pow: 100 * n, note: `변칙 위력 ${name}: 비축 카운터 ${n} → 위력 ${100 * n}` }
          : { pow: 0, fixed: 1, note: `${name}: 비축 카운터 0 — 실패` };
    } /* 11-18 비축 카운터 */
    if (k === 'psywave') {
      const r = Math.floor(Math.random() * 11) + 5;
      const v = Math.max(1, Math.floor(((+atk.lv || 1) * r) / 10));
      return () => ({ pow: 0, fixed: 1, note: `${name}: 고정 대미지 ${v} (Lv ${atk.lv} × ${r / 10}) — HP 조작으로 적용` });
    }
    return def => {
      let p,
        why = '';
      if (k === 'heavy') {
        const a = sv(atk, 'defense'),
          d = sv(def, 'defense');
        const x = d > 0 ? a / d : 0;
        p = ladder(
          x,
          [
            [1, 60],
            [1.5, 80],
            [2, 100],
            [2.5, 120]
          ],
          40
        );
        why = `방어 ${Math.floor(a)}/${Math.floor(d)}`;
      } else if (k === 'ball') {
        const a = spd(atk),
          d = spd(def);
        const x = d > 0 ? a / d : 0;
        p = ladder(
          x,
          [
            [1, 60],
            [2, 80],
            [3, 120],
            [4, 150]
          ],
          40
        );
        why = `스피드 ${Math.floor(a)}/${Math.floor(d)}`;
      } else if (k === 'gyro') {
        const a = spd(atk),
          d = spd(def);
        p = a > 0 ? Math.floor(Math.max(1, Math.min(150, (25 * d) / a + 1))) : 1;
        why = `스피드 ${Math.floor(a)} vs ${Math.floor(d)}`;
      } else if (k === 'spout') {
        p = Math.max(1, Math.floor(150 * hpR(atk)));
        why = `자신 HP ${atk.hp.cur}/${atk.hp.max}`;
      } else if (k === 'flail') {
        const x = atk.hp.max > 0 ? Math.floor((atk.hp.cur * 48) / atk.hp.max) : 0;
        p = 20;
        for (const [t, v] of [
          [32, 40],
          [16, 80],
          [9, 100],
          [4, 150],
          [1, 200]
        ])
          if (x < t) p = v;
        why = `자신 HP ${atk.hp.cur}/${atk.hp.max}`;
      } else if (k === 'press') {
        p = def.hp.cur > 0 ? Math.max(1, Math.floor(100 * hpR(def))) : 1;
        why = `대상 HP ${def.hp.cur}/${def.hp.max}`;
      } else if (k === 'crush') {
        p = def.hp.cur > 0 ? Math.max(1, Math.floor(120 * hpR(def))) : 1;
        why = `대상 HP ${def.hp.cur}/${def.hp.max}`;
      } else if (k === 'tclu') {
        const on = teraOn(def);
        p = on ? 240 : 120;
        why = on ? '대상이 「테라스탈」 상태 — 위력 2배' : '대상이 테라스탈 아님';
      } /* 11-02 망령 */
      else if (k === 'grass') {
        const bh = +(def.base || [])[0] || 0;
        p = 20;
        for (const [t, v] of [
          [60, 40],
          [90, 80],
          [120, 100],
          [150, 120]
        ])
          if (bh >= t) p = v;
        why = `대상 HP 종족치 ${bh}`;
      }
      return { pow: p, note: `변칙 위력 ${name}: ${why} → 위력 ${p}` };
    };
  }
  /* 동시 내밀기는 트레이너마다 (2026-10-23 망령: 각자 자기가 켠다 — 누가 켜도 상대 것은 안 바뀐다). 예전 배틀의 b.simul 은 안 정한 트레이너의 기본값 */
  const fxForceOn = (b, tid) => !!(((b || {}).trainers || {})[tid] || {}).forceFx; /* 11-09 강제 발동 토글 (트레이너마다) */
  const simOn = (b, tid) => {
    const t = (b.trainers || {})[tid] || {};
    return t.simul != null ? !!t.simul : !!b.simul;
  };
  const simAny = b => Object.keys(b.trainers || {}).some(t => simOn(b, t)) || Object.values(b.mons || {}).some(m => m.pend);
  const simSide = (b, side) => (((b.sides || {})[side] || {}).trainers || []).some(t => simOn(b, t));
  /* 동시 내밀기 현황: 진영마다 예약 수 / 에리어 수. 양쪽 다 차면 「완료」 */
  function pendCount(b, side) {
    const ids = ((b.sides || {})[side] || {}).trainers || [];
    const ms = Object.values(b.mons || {}).filter(m => ids.includes(m.tid));
    const need = Math.min(mode(b), ms.filter(m => m.hp.cur > 0).length);
    return { n: ms.filter(m => m.pend).length, need };
  }
  /* 11-08 20:53 망령 「저 칸 위치는 좋은데 없을 땐 안 보이게 하니 칸이 위아래로 왔다갔다 — 뭘 안 띄울 때에도 유지」: 턴 개시 전(지시 준비)에도 같은 칸을 흐리게 둔다. 배틀에 트레이너가 하나도 없을 때만 뺀다 */
  function revealStrip(c, ready) {
    const b = c.b;
    const ph = +b.phase || 0;
    if (!Object.keys(b.trainers || {}).length) return '';
    const mine = myTrainers(c);
    const idle = ph < 1;
    const rows = Object.keys(b.trainers || {})
      .map(tid => {
        const t = b.trainers[tid];
        const mons = Object.values(b.mons || {})
          .filter(m => m.tid === tid && m.entry && m.hp.cur > 0)
          .sort((x, y) => x.entry.localeCompare(y.entry));
        if (!mons.length) return '';
        const my = mine.includes(tid);
        return `<span class="rs ${my ? 'my' : ''}"><b>${esc(t.name)}</b>${mons.map(m => (!idle && revealed(b, tid, m.id) ? `<i class="ok" title="${esc(m.name)}">${String(m.entry).toUpperCase()} ✓</i>` : my && ph >= 2 && turnReached(b, m) ? `<button class="btn xs pri" data-act="revealmon" data-tid="${tid}" data-mid="${m.id}" title="${esc(m.name)} 의 지시를 공개">${String(m.entry).toUpperCase()} 공개</button>` : `<i title="${esc(m.name)}">${String(m.entry).toUpperCase()}</i>`)).join('')}${my ? `<button class="btn xs" data-act="fire" data-tid="${tid}" title="선행 입력한 지령·명령 · 고유·전용 포텐셜을 발동" ${idle ? 'disabled style="visibility:hidden"' : ''}>포텐셜 발동</button>` : ''}</span>`;
      })
      .join('');
    const MSG = idle
      ? b.started
        ? '지시 준비 중 — 턴 개시 뒤 여기서 지시를 공개한다'
        : '시합 개시 전'
      : ph === 1
        ? '턴 개시 — 지령 · 턴 개시 포텐셜은 「포텐셜 발동」. 지시(기술·교대)는 행동 순서가 오면 그 포켓몬부터 공개된다'
        : '지시는 자기 차례에 공개 · 지령·명령·고유·전용은 「포텐셜 발동」에서 그때그때';
    return `<div class="revealstat ${idle ? 'idle' : ''}"><span class="olab">지시 공개</span>${rows}<span class="small dim rvmsg" title="${esc(MSG)}">${esc(MSG)}</span></div>`;
  }
  /* 좌측 A | 우측 A / 좌측 B | 우측 B … 열 = 진영, 행 = 에리어 */
  function areaGrid(c) {
    const b = c.b;
    const ent = { left: entered(b, 'left'), right: entered(b, 'right') };
    const ids = { left: ((b.sides || {}).left || {}).trainers || [], right: ((b.sides || {}).right || {}).trainers || [] };
    const cell = (side, a) => {
      const m = ent[side][a];
      const slot = slotOf(side, a);
      return `<div class="area ${side} ${m ? '' : 'empty'}" data-slot="${slot}"><div class="alab ${side}">${SIDE_KO[side]} ${a.toUpperCase()}</div>${m ? bigCard(c, m, slot) : `<div class="aempty">빈 자리${c.mgr || ids[side].includes(c.seat) ? '<br><span class="small">벤치에서 「등장」</span>' : ''}</div>`}</div>`;
    };
    return `<div class="fgrid"><div class="ahead left">${SIDE_KO.left}</div><div class="ahead right">${SIDE_KO.right}</div>${AREAS.slice(0, mode(b))
      .map(a => cell('left', a) + cell('right', a))
      .join('')}</div>`;
  }
  const ffTg = (c, b, tid, lab) =>
    `<label class="btn xs ${fxForceOn(b, tid) ? 'pri ffon' : 'ghost'} fftg" ${fxForceOn(b, tid) ? 'style="background:#e3531f!important;border-color:#e3531f!important;color:#fff!important"' : ''} title="켜 두면 ${esc(((b.trainers || {})[tid] || {}).name || '')}의 포켓몬 · 고유 포텐셜을 손으로 발동할 때 조건 · 확인 · 확률을 건너뛰고 바로 강제 발동한다 (저절로 터지는 효과 · 필드 · SP 는 그대로). 오류 대비용 — 다 쓰면 끈다"><input type="checkbox" data-act="fxforce" data-tid="${tid}" ${fxForceOn(b, tid) ? 'checked' : ''}> 강제</label>`;
  function benchRow(c, side, ready) {
    const b = c.b;
    const ids = ((b.sides || {})[side] || {}).trainers || [];
    const trs = b.trainers || {};
    const seats = c.ST.state.seats || {};
    const feB =
      window.OM_STAGE_UI && (c.mgr ? ids.length : ids.some(t => ownT(c, t)))
        ? `<button class="btn xs" data-act="stagemgr" data-side="${side}" title="${c.mgr ? '트레이너 · 포켓몬이 각자 가진' : '내 트레이너 · 포켓몬의'} 필드 · 스타디움 · 이계를 펼친다">필드 전개</button>`
        : '';
    /* 10-25 망령: 한 진영에 트레이너가 둘 이상이면(개인전 · 따로 세우기) 함께 지시 · 필드 전개 · 동시 내밀기를 머리 줄에 이름 붙여 늘어놓지 않고, 각 트레이너 칸 안에 따로 단다 */
    const multi = ids.length > 1;
    const perT = tid => {
      if (!multi) return '';
      const t = trs[tid];
      if (!t) return '';
      const own = c.gm || ownT(c, tid);
      const fe =
        window.OM_STAGE_UI && (c.mgr || ownT(c, tid))
          ? `<button class="btn xs" data-act="stagemgr" data-side="${side}" data-tid="${tid}" title="${esc(t.name || '')}의 트레이너 · 포켓몬이 가진 필드 · 스타디움 · 이계를 펼친다">필드 전개</button>`
          : '';
      const sm = own
        ? `<label class="btn xs ${simOn(b, tid) ? 'pri' : 'ghost'} simtg" title="켜면 ${esc(t.name || '')}은(는) 「등장」 대신 「내밀기 예약」 — 「시합 개시」·「내밀기 실행」 때 예약한 포켓몬이 양쪽 동시에 나온다"><input type="checkbox" data-act="simul" data-tid="${tid}" ${simOn(b, tid) ? 'checked' : ''}> 동시 내밀기</label>`
        : '';
      const spb =
        window.OM_SP_UI && window.OM_SP_UI.canOpen('', tid)
          ? `<button class="btn xs spbtn" data-act="spmgr" data-side="${side}" data-tid="${tid}" title="SP (서포터) — 밖에서 돕는 조력자의 한 수">SP</button>`
          : '';
      const sb =
        stxOk(c, tid) && window.OM_STATUS_UI
          ? `<button class="btn xs ghost" data-act="stx" data-tid="${tid}" title="PT 요약 — 포켓몬 · 소지품 착용 · 소지품 소켓">요약</button>`
          : ''; /* 10-27 망령: 「현황」 → 「요약」, 카드 옆으로 */
      const cb = cardBtn(c, tid);
      return cb || sm || sb ? `<div class="tbtns tbtns-own">${cb}${sb}<span class="sp"></span>${sm}</div>` : '';
    };
    const items = ids
      .map((tid, ti) => {
        const t = trs[tid] || { name: '?', ranks: {} };
        const o = seats[tid];
        const mons = Object.values(b.mons || {})
          .filter(m => m.tid === tid)
          .sort((x, y) => (x.slot || 0) - (y.slot || 0));
        const cmdDone = !!(b.cmds || {})[tid];
        const rd = !!ready[tid];
        /* 11-27 망령 「여기도 누르면 요약 나오게」: 트레이너 칸(그림 · 이름 · 자질)을 누르면 요약 창 — 볼 수 있는 사람만 (안의 필드 · SP 단추는 제 일을 한다) */
        const sx =
          stxOk(c, tid) && window.OM_STATUS_UI
            ? ` data-act="stx" data-tid="${tid}" title="누르면 요약 — 자질 · 고유 · 포켓몬 · 소지품" style="cursor:pointer"`
            : '';
        return `<div class="tblock"><div class="trainer"${sx}><div class="tpic" style="${t.image ? `background-image:url('${cssu(t.image)}')` : ''}"></div><div class="tinfo"><div class="tn">${esc(t.name)}${tid === c.seat ? ' <span class="tag me">ME</span>' : ownT(c, tid) ? ' <span class="tag me co" title="함께 지시하는 트레이너">함께</span>' : ''}${rd ? ' <span class="tag ok">READY</span>' : cmdDone ? ' <span class="tag">공개됨</span>' : ''}${soloTag(c, tid, ids)}${(() => {
          /* 10-26 망령: 필드 전개 · SP 는 자주 안 쓰니 이름 줄 빈 곳으로 작게 올리고, 그 자리(아래 줄)엔 카드 */ const own =
            c.gm || tid === c.seat || ownT(c, tid);
          if (!own) return '';
          const fe =
            window.OM_STAGE_UI && (c.mgr || ownT(c, tid))
              ? `<button class="btn xs ghost tnmini" data-act="stagemgr" data-side="${side}" data-tid="${tid}" title="필드 · 스타디움 · 이계를 펼친다">필드</button>`
              : '';
          const sp =
            window.OM_SP_UI && window.OM_SP_UI.canOpen('', tid)
              ? `<button class="btn xs ghost tnmini spbtn" data-act="spmgr" data-side="${side}" data-tid="${tid}" title="SP (서포터) — 밖에서 돕는 조력자의 한 수">SP</button>`
              : '';
          const ff = '';
          /* 11-09 망령 「줄이 밀렸잖아」: 강제 발동 토글도 자주 안 쓰니 이름 줄 (필드 · SP 옆) */ return fe || sp || ff
            ? `<span class="tnmore">${fe}${sp}${ff}</span>`
            : '';
        })()}</div>
     <div class="rk4">${['지시', '육성', '통솔', '능력'].map(k => `<span><small>${k}</small><b>${esc(t.ranks[k] || '-')}</b></span>`).join('')}</div>${o || coOf(c, tid).length ? `<div class="tr">${o ? `<span class="who">${esc(o.name)}</span>` : ''}${coHtml(c, tid)}</div>` : ''}</div>
     </div>${perT(tid)}${(() => {
       const U = uniqList(t);
       const own = c.gm || tid === c.seat || ownT(c, tid);
       /* 10-25 망령: 상대 트레이너의 고유는 좌석 화면에 안 보인다 (같은 편 · GM 만) */ if (!c.gm && !own) {
         const mineT = myTrainers(c);
         if (!mineT.some(x => window.OM_TEAM(c.b, x) === window.OM_TEAM(c.b, tid))) return '';
       }
       return U.length
         ? `<div class="tuq">${U.map(
             x =>
               `<span class="pot sp uq"${spSty(hexOk(x.p.color))} title="${esc(x.p.name)} — ${esc(
                 String(x.p.eff || '')
                   .replace(/<br\s*\/?>/g, ' ')
                   .slice(0, 300)
               )}"><em>고유</em><span class="potn">${esc(x.p.name)}</span>${x.max != null ? pipsL(x) : ''}${own ? (x.left !== null && x.left <= 0 && !(twoStage(x.p.eff) && preDoneOf(t, x.p.name)) ? (x.ml > 0 ? '<small class="dim">이번 턴 씀</small>' : '<small class="dim">다 씀</small>') : (twoStage(x.p.eff) && !preDoneOf(t, x.p.name) && (+c.b.phase || 0) === 0 ? `<button class="btn xs pri" data-act="usaj" data-tid="${tid}" data-pot="${esc(x.p.name)}" title="① 【사전】 — 지금(지시 전) 발동 · 공개. 그다음 ② 는 선행 입력으로 기술을 고르면 턴 개시 때 공개된다">① 사전 발동</button>` : twoStage(x.p.eff) && preDoneOf(t, x.p.name) ? '<small class="tag ok">① 사용</small>' : '') + (effPre(x.p.eff) && preTrOK(c, tid) ? preUqBtn(c, tid, x.p.name) : `<button class="btn xs pri" data-act="ufire" data-tid="${tid}" data-pot="${esc(x.p.name)}" title="고유 포텐셜 발동 — 대상 포켓몬을 고른다">발동</button>`)) : ''}</span>`
           ).join('')}</div>`
         : '';
     })()}<div class="tbtns">${(c.gm || ownT(c, tid)) && mons.some(m => m.entry) ? `<button class="btn xs" data-act="fire" data-tid="${tid}" title="지령·명령 · 고유·전용 포텐셜 발동 창">포텐셜 발동</button>` : ''}${c.gm || ownT(c, tid) ? `<button class="btn xs ghost" data-act="orders" data-tid="${tid}" title="지령·명령 · 고유·전용 포텐셜 횟수 설정 · 빼기">설정</button><button class="btn xs ghost ${myosuGlow(c, tid) ? 'pri' : ''}" data-act="intel" data-tid="${tid}" title="해석(도감 · 데이터) · 묘수(「타임」)">해석·묘수</button>` : ''}${tid === c.seat || ownT(c, tid) || (c.gm && !fairOff(c, tid)) ? ffTg(c, b, tid, '') : ''}</div>
    <div class="bench">${mons.map(m => benchCard(c, m)).join('') || '<div class="dim small">포켓몬 없음</div>'}</div></div>`;
      })
      .join('');
    /* 10-21 망령: 폰에서 벤치 머리를 누르면 접는다 (접으면 트레이너별 남은 포켓몬 수만) */
    /* 10-22 망령: 동시 내밀기 켜기는 벤치 머리(「+ 파티」 옆)로. 내 트레이너만, 여럿이면 이름을 붙인다 */
    const simIds = ids.filter(tid => trs[tid] && (c.gm || ownT(c, tid)));
    const simTg = simIds
      .map(
        tid =>
          `<label class="btn xs ${simOn(b, tid) ? 'pri' : 'ghost'} simtg" title="켜면 ${esc(trs[tid].name || '')}은(는) 「등장」 대신 「내밀기 예약」 — 「시합 개시」·「내밀기 실행」 때 예약한 포켓몬이 양쪽 동시에 나온다. 내 것만 바뀐다"><input type="checkbox" data-act="simul" data-tid="${tid}" ${simOn(b, tid) ? 'checked' : ''}> 동시 내밀기${simIds.length > 1 ? ' · ' + esc(String(trs[tid].name || '').slice(0, 6)) : ''}</label>`
      )
      .join('');
    const bfs = ids
      .map(tid => {
        const ms = Object.values(b.mons || {}).filter(m => m.tid === tid);
        return `${esc((trs[tid] || {}).name || '?')} ${ms.filter(m => m.hp.cur > 0).length}/${ms.length}`;
      })
      .join(' · ');
    return `<div class="bcol ${side} ${(UIC.bfold || {})[side] ? 'fold' : ''}"><div class="shead" data-bfold="${side}"><i class="bfc" aria-hidden="true"></i><span class="sname">${SIDE_KO[side]} 벤치</span>${bfs ? `<small class="bfs">${bfs}</small>` : ''}${
      simSide(b, side)
        ? (() => {
            const P = pendCount(b, side);
            return `<span class="chip simpc ${P.need > 0 && P.n >= P.need ? 'on' : ''}" title="동시 내밀기 예약">예약 ${P.n}/${P.need}</span>`;
          })()
        : ''
    }<span class="sp"></span>${(() => {
      /* 10-25 망령: 함께 지시는 「+ 파티」 왼쪽으로 — 아래 줄(필드 전개 · 동시 내밀기)이 두 줄로 넘치지 않게. 트레이너가 여럿이면 눌러서 고른다 */ const co =
        ids.filter(tid => coBtn(c, tid));
      return co.length === 1
        ? coBtn(c, co[0]).replace('>함께 지시</button>', '>👥 함께</button>')
        : co.length > 1
          ? `<button class="btn xs ghost" data-act="copick" data-side="${side}" title="여러 플레이어가 한 트레이너의 지시 창 · 조작권을 함께 쓴다 — 트레이너를 고른다">👥 함께</button>`
          : '';
    })()}${canLoad(c) && !simSide(b, side) ? (c.gm ? `<button class="btn xs" data-act="addpick" data-side="${side}" title="이 진영에 파티를 불러오거나, 지원 폴더에서 포켓몬만 부른다">+ 추가 ▾</button>` : `<button class="btn xs" data-act="load" data-side="${side}" title="${c.mgr ? '이 진영에 파티를 불러온다' : '내 자리로 파티를 불러온다 (불러온 사람이 지시)'}">+ 파티</button>`) : ''}</div>${(() => {
      /* 10-21 망령: 좌측 벤치 아래 줄 — 왼쪽 필드 전개, 오른쪽(+ 파티 밑) 동시 내밀기 · 내밀기 실행 */
      const fe =
        window.OM_STAGE_UI && (c.mgr ? ids.length : ids.some(t => ownT(c, t)))
          ? `<button class="btn xs" data-act="stagemgr" data-side="${side}" title="${c.mgr ? '트레이너 · 포켓몬이 각자 가진' : '내 트레이너 · 포켓몬의'} 필드 · 스타디움 · 이계를 펼친다">필드 전개</button>`
          : '';
      /* 함께 지시는 머리 줄 「+ 파티」 왼쪽으로 옮겼다 (10-25) */ /* 10-24 망령: 함께 지시 · 필드 전개도 이 줄 왼쪽으로 (벤치 맨 아래에 있으면 밀려 안 보였다) */
      const sm =
        simTg; /* 10-25 망령: 동시 내밀기는 제목줄 대신 이 줄 오른쪽(+ 파티 밑 빈 곳) — 제목줄에 두면 「+ 파티」가 밀려 칸이 하나 더 생겼다 */
      if (multi) return ''; /* 여럿이면 각 트레이너 칸에 (perT) */
      const spb =
        window.OM_SP_UI && window.OM_SP_UI.canOpen(side, '')
          ? `<button class="btn xs spbtn" data-act="spmgr" data-side="${side}" title="SP (서포터) — 밖에서 돕는 조력자의 한 수">SP</button>`
          : ''; /* 10-25 망령: SP(서포터) — 필드 전개 옆 */
      const cb = ids.length === 1 ? cardBtn(c, ids[0]) : '';
      const sb =
        ids.length === 1 && stxOk(c, ids[0]) && window.OM_STATUS_UI
          ? `<button class="btn xs ghost" data-act="stx" data-tid="${ids[0]}" title="PT 요약 — 포켓몬 · 소지품 착용 · 소지품 소켓">요약</button>`
          : '';
      return sm || cb || sb ? `<div class="shead2">${cb}${sb}<span class="sp"></span>${sm}</div>` : '';
    })()}${items || '<div class="aempty small">트레이너 없음' + (canLoad(c) ? ` — <button class="btn xs pri" data-act="load" data-side="${side}">+ 파티 불러오기</button>` : ' — 진행하는 사람이 파티를 불러온다') + '</div>'}${sidePanel(c, side, ready)}</div>`;
  }
  /* 벤치 아래 빈 곳: 그 진영이 입력해 둔 지시 현황. 내 트레이너(GM 은 볼 수 있는 것 전부)는 편집 중인 지시를, 남의 것은 공개된 만큼만 */
  function cardBtn(c, tid) {
    {
      const R3 = window.OM_SK3R;
      const own = c.gm || tid === c.seat || ownT(c, tid);
      if (R3 && R3.openOne) {
        if (!own) return '';
        const n = R3.heldOf
          ? R3.heldOf(tid)
          : null; /* 11-04 19:46 망령 「카드 눌렀을 때 UI 는 지금 룰적으로 — 큰 창 · 코스트 필요 없다」: 은열쇠 네 칸 작은 창 */
        return `<button class="btn xs ghost cardtg ${n ? '' : 'empty'}" data-act="sk3one" data-tid="${tid}" title="은열쇠 카드 — 체크 · 던전 · 배틀 · 예비 (배틀 카드는 자기 포켓몬에게만)">🗝 카드 <b>${n == null ? '-' : n + '/4'}</b></button>`;
      }
    }
    const D = window.OM_DECK_UI;
    if (!D || !D.handCount) return '';
    const own = c.gm || tid === c.seat || ownT(c, tid);
    if (!own) return '';
    const n = D.handCount(tid);
    const t = (c.b.trainers || {})[tid] || {};
    return `<button class="btn xs ghost cardtg ${n ? '' : 'empty'}" data-act="cards" data-tid="${tid}" title="손패에서 카드를 쓴다 · 무덤(버린 카드)에서 되돌리기도 여기서">🃏 카드 <b>${n}</b></button>`;
  }
  function sidePanel(c, side, ready) {
    const b = c.b;
    const trs = b.trainers || {};
    const ids = (((b.sides || {})[side] || {}).trainers || []).filter(t => trs[t]);
    if (!ids.length) return '';
    const mine = myTrainers(c);
    const ph = +b.phase || 0;
    const blocks = ids
      .map(tid => {
        const t = trs[tid];
        const mons = Object.values(b.mons || {})
          .filter(m => m.tid === tid && m.entry && m.hp.cur > 0)
          .sort((x, y) => x.entry.localeCompare(y.entry));
        const rd = !!ready[tid];
        const pub = (b.cmds || {})[tid];
        const own = mine.includes(tid);
        const cur = own ? cmdNow(tid, b) : null;
        const tag = pub ? '<span class="tag ok">공개됨</span>' : rd ? '<span class="tag ok">READY</span>' : '<span class="tag">입력 중</span>';
        const row = m => {
          let body;
          if (own && cur) {
            const xx = (cur.mons || {})[m.id] || {};
            const pre = [
              xx.order ? pName(ctx().b, m.tid, 'order', xx.order) : '',
              xx.command ? pName(ctx().b, m.tid, 'command', xx.command) : ''
            ].filter(Boolean);
            let act;
            if (xx.move === 'switch') act = `<b>교대</b> → ${esc(monName(b, xx.switch) || '?')}`;
            else if (xx.move === '' || xx.move == null) act = '<span class="warn">행동 없음</span>';
            else {
              const mv = MVS(m)[+xx.move];
              act = `<b>${mv ? esc(mv.name) : '?'}</b>${mv ? typeChip(mv.typeEn) : ''}${(xx.targets || []).length ? `<span class="bct">→ ${xx.targets.map(sl => esc(slotName(b, sl))).join(', ')}</span>` : '<span class="warn"> 대상 없음</span>'}`;
            }
            body = `<div class="bca">${act}</div>${pre.length || (xx.pots || []).length ? `<div class="bcp">${pre.map(n => `<span class="rk up">선행 『${esc(n)}』</span>`).join('')}${(xx.pots || []).map(n => `<span class="rk fxc">『${esc(n)}』</span>`).join('')}</div>` : ''}`;
          } else if (pub && pub.mons && pub.mons[m.id]) body = `<div class="bca">${cmdOf(b, m)}</div>`;
          else body = `<div class="bca dim">${rd ? '입력 완료 · 비공개' : '입력 중'}</div>`;
          {
            const v = V(c, m);
            return `<div class="bc"><span class="bop" style="${v.image ? `background-image:url('${cssu(v.image)}')` : ''}"></span><div class="bcb"><div class="bcn"><i>${String(m.entry).toUpperCase()}</i>${esc(v.name)}</div>${body}</div></div>`;
          }
        };
        const up =
          own && cur && (cur.upots || []).length
            ? `<div class="bcp bcu">${cur.upots.map(n => `<span class="rk fxc">고유 『${esc(n)}』</span>`).join('')}</div>`
            : '';
        /* 10-21 망령: A·B(·C) 칸은 늘 같은 자리에 (비거나 쓰러져도 줄이 빠져서 밀리지 않게). 같은 진영의 다른 트레이너가 쓰는 칸만 뺀다 */
        const ent = entered(b, side);
        const slotsT = AREAS.slice(0, mode(b)).filter(a => !ent[a] || ent[a].tid === tid || ids.length === 1);
        const rows = slotsT.map(a => {
          const m = mons.find(x => x.entry === a);
          return m
            ? row(m)
            : `<div class="bc empty"><span class="bop"></span><div class="bcb"><div class="bcn"><i>${a.toUpperCase()}</i>빈 자리</div><div class="bca dim">—</div></div></div>`;
        });
        return `<div class="bct1"><div class="bth"><b>${esc(t.name)}</b><span class="sp"></span>${tag}</div>${rows.join('')}${up}</div>`;
      })
      .join('');
    /* 폰: 벤치와 배틀 칸 사이를 밀어내지 않게 접어 두고 요약만 (열고 닫은 건 기억) */
    const ph1 = window.matchMedia && matchMedia('(max-width:760px)').matches;
    UIC.bside = UIC.bside || {};
    const open = !ph1 || UIC.bside[side];
    const sum = ids.map(tid => `${esc(trs[tid].name)} ${(b.cmds || {})[tid] ? '공개됨' : ready[tid] ? 'READY' : '입력 중'}`).join(' · ');
    return `<details class="bside" data-bside="${side}" ${open ? 'open' : ''}><summary class="bsh"><span>지시 현황</span><small class="bsum">${sum}</small><span class="sp"></span><b>TURN ${+b.turn || 0}</b></summary>${blocks}</details>`;
  }
  /* 10-21 망령: 날씨 · 필드 · 룸 · 《필드》 그림을 배틀맵 뒤에 반투명하게 깐다 (맵툴 Lib:field 0.75 · Lib:field_object 0.5 처럼) */
  const fbgUrl = k => {
    if (!k) return '';
    let u = `img/fieldbg/${k}.webp?v=2`;
    try {
      u = new URL(u, location.href).href;
    } catch (e) {}
    return `url('${cssu(u)}')`;
  };
  function fieldBg(f) {
    f = f || {};
    const w = (f.weather || {}).type,
      t = (f.terrain || {}).type;
    const cls = [],
      st = [];
    const ss = window.OM_STAGE_UI ? window.OM_STAGE_UI.bgStyle(f) : '';
    const m = ss.match(/style="([^"]*)"/);
    if (m) st.push(m[1]);
    const low = [...ROOMS.filter(r => (f.rooms || {})[r] > 0), ...ETC.filter(r => (f.etc || {})[r] > 0), t]
      .filter(Boolean)
      .map(k => fbgUrl(T_IMG[k]))
      .filter(Boolean);
    if (w && W_IMG[w]) {
      cls.push('fbw', 'w-' + W_IMG[w]);
      st.push(`--fbw:${fbgUrl(W_IMG[w])}`);
    }
    if (low.length) {
      cls.push('fbt');
      st.push(`--fbt:${low.join(',')}`);
    }
    if (cls.length) cls.push('fxbg');
    return { cls: cls.join(' '), st: st.join(';') };
  }
  function fieldStrip(c, f) {
    const w = f.weather.type,
      t = f.terrain.type;
    const ic = (name, label, cnt, kind) => {
      const im = fimg(name);
      return `<div class="fic ${kind}" title="${esc(label)}">${im ? `<img src="${esc(im)}" alt="">` : '<span class="fnoimg"></span>'}<span><small>${{ w: '날씨', t: '필드', r: '룸', e: '필드의 상태' }[kind] || ''}</small><b>${esc(label)}</b>${cnt ? `<em>${cnt >= 1000 ? '∞' : cnt + 'T'}</em>` : ''}</span></div>`;
    };
    const wN = w && wxNeg(c.b);
    const mid = [
      w ? ic(W_IMG[w], wN ? w + ' (무효 · ' + wN.name + ')' : w, f.weather.count, 'w') : '',
      t ? ic(T_IMG[t], t, f.terrain.count, 't') : '',
      ...ROOMS.filter(r => (f.rooms || {})[r] > 0).map(r => ic(T_IMG[r], r, f.rooms[r], 'r')),
      ...ETC.filter(r => (f.etc || {})[r] > 0).map(r => ic(T_IMG[r], r, f.etc[r], 'e'))
    ]
      .filter(Boolean)
      .join('');
    const objs = side => {
      const o = (f.objects || {})[side] || {};
      const by = {};
      for (const k in o) {
        if (!(o[k] > 0)) continue;
        const cat = objCat(k)[0];
        (by[cat] = by[cat] || []).push(
          `<span class="obj ${cat}" title="${esc(objCat(k)[1])}">${OBJ_IMG[k] ? `<img class="oimg" src="${OBJ_IMG[k]}" alt="">` : ''}${esc(k)}${o[k] >= 1000 ? '' : ` <b>${k === '압정뿌리기' || k === '독압정' ? o[k] + '겹' : o[k] + 'T'}</b>`}</span>`
        );
      }
      return OBJ_CAT.filter(cc => by[cc[0]])
        .map(cc => `<span class="ocat"><i>${esc(cc[1])}</i>${by[cc[0]].join('')}</span>`)
        .join('');
    };
    const gmc = c.mgr ? ' clickable' : '';
    return `<div class="fstrip"><div class="fobjs lft${gmc}" ${c.mgr ? 'data-act="objects" data-side="left" title="눌러서 좌측 설치기 놓기"' : ''}><span class="olab left">좌측 설치물</span>${objs('left') || '<span class="dim small">없음</span>'}${c.mgr ? '<span class="fplus">＋</span>' : ''}</div><div class="fmid${gmc}" ${c.mgr ? 'data-act="field" title="눌러서 날씨·필드·룸·필드의 상태"' : ''}>${mid || '<span class="dim small">날씨·필드 없음' + (c.mgr ? ' — 눌러서 설정' : '') + '</span>'}</div><div class="fobjs rgt${gmc}" ${c.mgr ? 'data-act="objects" data-side="right" title="눌러서 우측 설치기 놓기"' : ''}>${c.mgr ? '<span class="fplus">＋</span>' : ''}${objs('right') || '<span class="dim small">없음</span>'}<span class="olab right">우측 설치물</span></div></div>`;
  }

  /* HP 막대: 지난번 값에서 새 값으로 줄어들고(늘고), 빨간 잔상이 뒤따라온다 */
  const HPPREV = new Map();
  let hpQ = 0;
