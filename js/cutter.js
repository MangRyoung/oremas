/* 11-28 망령 「포트레이트 따기 … 세션노트/웹툴/로그 정리기에 곧바로 연계」 · 「일단 그렇게 해봐」:
   사이트에 올린 「포트레이트 따기」(oremas/cutter/)를 화면 위에 띄우고, 거기서 자른 그림을 받아 오는 한 곳.
   OM_CUTTER.open({ label, multi, files, src }) → 자른 File 배열 (닫으면 빈 배열). 같은 사이트의 창과만 말한다.
   src(그림 주소)를 주면 그 그림을 받아 처음부터 띄운다 — 칸에 이미 있는 그림을 다시 자를 때. OM_CUTTER.srcIn(칸) 이 칸 안의 그림 주소를 찾아 준다.
   세션 노트 · 제작기 · 로그 정리기도 이 파일을 그대로 불러 쓴다 (경로는 CUTTER_URL 하나). */
window.OM_CUTTER = (() => {
  const CUTTER_URL = '/oremas/cutter/?embed=1&v=202611281300';
  const CSS =
    '.omcut{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:2vh 2vw}' +
    '.omcut iframe{width:min(1600px,100%);height:100%;border:0;border-radius:12px;background:#fff}' +
    '@media (max-width:760px){.omcut{padding:0}.omcut iframe{border-radius:0}}';
  let live = null;

  function ensureCss() {
    if (document.getElementById('omcutcss')) return;
    const st = document.createElement('style');
    st.id = 'omcutcss';
    st.textContent = CSS;
    document.head.append(st);
  }

  /* 11-28 망령 「더 더 개선」: 칸에 이미 그림이 있으면 그 그림으로 시작한다. 칸 안의 img 또는 배경 그림(자기 · 자식)에서 주소를 읽는다 */
  function srcIn(el) {
    if (!el) return '';
    const im = el.querySelector('img');
    if (im && im.src) return im.src;
    for (const x of [el, ...el.querySelectorAll('*')]) {
      const m = /url\(["']?([^"')]+)["']?\)/.exec(x.style.backgroundImage || '');
      if (m) return m[1];
    }
    return '';
  }
  /* 주소의 그림을 File 로. 다른 사이트가 막으면(CORS) 빈손으로 — 그때는 그냥 빈 자르기 창이 뜬다 */
  async function fileFromSrc(src) {
    if (!src) return null;
    try {
      const blob = await (await fetch(src)).blob();
      if (!/^image\//.test(blob.type)) return null;
      return new File([blob], 'now.' + (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg'), { type: blob.type });
    } catch (e) {
      return null;
    }
  }

  function open(opt) {
    opt = opt || {};
    if (live) return Promise.resolve([]);
    ensureCss();
    const first = fileFromSrc(opt.src).then(f => (opt.files || []).concat(f ? [f] : []));
    return new Promise(resolve => {
      const wrap = document.createElement('div');
      wrap.className = 'omcut';
      const frame = document.createElement('iframe');
      frame.src = CUTTER_URL;
      frame.title = '포트레이트 따기';
      wrap.append(frame);
      const done = files => {
        window.removeEventListener('message', onMsg);
        document.removeEventListener('keydown', onKey, true);
        wrap.remove();
        live = null;
        resolve(files || []);
      };
      const onMsg = e => {
        if (e.origin !== location.origin || e.source !== frame.contentWindow || !e.data || e.data.src !== 'om-cutter') return;
        if (e.data.t === 'ready')
          first.then(files =>
            frame.contentWindow.postMessage({ src: 'om-cutter-host', t: 'init', label: opt.label || '', multi: !!opt.multi, files }, location.origin)
          );
        else if (e.data.t === 'out') done(e.data.files);
        else if (e.data.t === 'close') done([]);
      };
      const onKey = e => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          done([]);
        }
      };
      wrap.onclick = e => {
        if (e.target === wrap) done([]);
      };
      window.addEventListener('message', onMsg);
      document.addEventListener('keydown', onKey, true);
      live = wrap;
      document.body.append(wrap);
    });
  }

  return { open, srcIn };
})();
