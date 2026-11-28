/* 11-28 망령 「포트레이트 따기 … 세션노트/웹툴/로그 정리기에 곧바로 연계」 · 「일단 그렇게 해봐」:
   사이트에 올린 「포트레이트 따기」(oremas/cutter/)를 화면 위에 띄우고, 거기서 자른 그림을 받아 오는 한 곳.
   OM_CUTTER.open({ label, multi, files }) → 자른 File 배열 (닫으면 빈 배열). 같은 사이트의 창과만 말한다.
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

  function open(opt) {
    opt = opt || {};
    if (live) return Promise.resolve([]);
    ensureCss();
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
          frame.contentWindow.postMessage(
            { src: 'om-cutter-host', t: 'init', label: opt.label || '', multi: !!opt.multi, files: opt.files || [] },
            location.origin
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

  return { open };
})();
