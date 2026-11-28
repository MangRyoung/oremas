/* 11-28 망령 「드롭박스 업로더 … 세션노트/웹툴/로그 정리기에 곧바로 연계」 · 잇는 방식 「업로더에서 보내기」:
   PC 의 드롭박스 업로더가 보낸 것(곡 = 제목 + 주소, 그림 = 파일)을 이 브라우저에 담아 두는 「받은 것」 보관함.
   세 도구가 같은 주소(mangryoung.github.io)라 한 벌을 같이 쓴다. 담는 곳은 /oremas/inbox.html, 꺼내 쓰는 곳은 각 도구.
   OM_INBOX.add(item) · list(kind) · remove(id) · onChange(fn). 사흘 지난 것은 목록을 읽을 때 치운다. */
window.OM_INBOX = (() => {
  const DB_NAME = 'om_inbox';
  const STORE = 'items';
  const KEEP_MS = 3 * 24 * 60 * 60 * 1000;
  const chan = 'BroadcastChannel' in window ? new BroadcastChannel(DB_NAME) : null;

  function db() {
    return new Promise((resolve, reject) => {
      const rq = indexedDB.open(DB_NAME, 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore(STORE, { keyPath: 'id' });
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => reject(rq.error);
    });
  }
  async function run(mode, job) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, mode);
      const rq = job(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(rq && rq.result);
      tx.onerror = () => reject(tx.error);
    });
  }
  const changed = () => chan && chan.postMessage('changed');

  /* item = { kind: 'song', title, url } 또는 { kind: 'image', title, blob } */
  async function add(item) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await run('readwrite', st => st.put({ ...item, id, at: Date.now() }));
    changed();
    return id;
  }
  async function remove(id) {
    await run('readwrite', st => st.delete(id));
    changed();
  }
  async function list(kind) {
    const all = (await run('readonly', st => st.getAll())) || [];
    const old = all.filter(x => Date.now() - x.at > KEEP_MS);
    for (const x of old) await run('readwrite', st => st.delete(x.id));
    return all.filter(x => !old.includes(x) && (!kind || x.kind === kind)).sort((a, b) => a.at - b.at);
  }
  function onChange(fn) {
    if (chan) chan.addEventListener('message', fn);
  }

  return { add, remove, list, onChange };
})();
