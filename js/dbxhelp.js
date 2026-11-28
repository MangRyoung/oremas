/* 11-28 망령 「드롭박스 업로더 … 웹툴에 곧바로 연계」 · 「(유튜브는) 도우미 켜져 있으면 바로」:
   GM 의 PC 에서 도는 「드롭박스 업로더」 도우미(http://localhost:5078 · uploader.ps1 4판부터)를 부르는 한 곳.
   도우미가 유튜브를 받거나 파일을 받아 드롭박스에 올리고 링크를 돌려준다 — 드롭박스 연결 정보는 도우미 밖으로 나오지 않는다.
   도우미가 꺼져 있으면 info() 가 null · 나머지는 알아듣는 말로 오류를 던진다. */
window.OM_DBXHELP = (() => {
  const BASE = 'http://localhost:5078';
  const OFF = '드롭박스 업로더가 꺼져 있다 — PC 에서 「드롭박스 업로더.bat」을 켠 뒤 다시';
  const YT_RE = /^https?:\/\/(?:[\w-]+\.)?(?:youtube\.com|youtu\.be)\//i;
  const isYoutube = u => YT_RE.test(String(u || '').trim());

  async function call(path, opt, ms) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms || 8000);
    try {
      const r = await fetch(BASE + path, Object.assign({ headers: { 'X-Uploader': '1' }, signal: ctl.signal }, opt || {}));
      const j = await r.json().catch(() => ({}));
      if (!r.ok)
        throw new Error(j.error || (r.status === 403 ? '드롭박스 업로더가 옛 판이다 — 새 판(4판)으로 바꿔야 한다' : '도우미 오류 ' + r.status));
      return j;
    } catch (e) {
      if (e.name === 'AbortError' || e instanceof TypeError) throw new Error(OFF);
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  /* 켜져 있는가 · 드롭박스에 연결돼 있는가. 꺼져 있으면 null */
  async function info() {
    try {
      return await call('/api/info', null, 1500);
    } catch (e) {
      return null;
    }
  }

  const STATE_KO = { starting: '준비 중', download: '유튜브에서 받는 중', upload: '드롭박스에 올리는 중' };
  const wait = ms => new Promise(r => setTimeout(r, ms));

  /* 시작한 작업을 끝날 때까지 지켜본다 → { name, url(공유 링크), direct } */
  async function follow(id, onState) {
    for (;;) {
      await wait(700);
      const st = await call('/api/job?id=' + id);
      if (st.state === 'done') return st;
      if (st.state === 'error') throw new Error(st.message || '받지 못했다');
      if (onState) onState((STATE_KO[st.state] || '하는 중') + (st.pct != null ? ' ' + st.pct + '%' : '') + '…');
    }
  }

  async function ready() {
    const i = await info();
    if (!i) throw new Error(OFF);
    if (!i.connected) throw new Error('드롭박스 업로더가 드롭박스에 연결돼 있지 않다 — 업로더 화면에서 먼저 연결');
  }

  async function fromUrl(url, onState) {
    await ready();
    const { id } = await call('/api/link', {
      method: 'POST',
      headers: { 'X-Uploader': '1', 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    return follow(id, onState);
  }

  async function fromFile(file, onState) {
    await ready();
    if (onState) onState('도우미에게 보내는 중…');
    const { id } = await call('/api/upload?name=' + encodeURIComponent(file.name), { method: 'POST', body: file }, 120000);
    return follow(id, onState);
  }

  /* 파일 이름 → 곡 제목 (확장자 뗀 것) */
  const titleOf = name => String(name || '').replace(/\.[A-Za-z0-9]{2,5}$/, '');

  return { isYoutube, info, fromUrl, fromFile, titleOf };
})();
