/* ---------- 11-11 망령 「커뮤 장면 타이머 — 체스 시계처럼 · 일시 정지 · 자기 씬이 끝나면 남은 시간이 멈춤」 (감우) ----------
   state.rp.ctimer = {on, base(분), bank:{좌석: 남은 ms}, run:지금 씬 주인 좌석|'', since:흐르기 시작한 시각(0 = 멈춤), runAt:이 씬을 연 시각, at}
   - 서버에는 버튼을 누를 때만 한 번 쓴다(시작 · 멈춤 · 이어서 · 씬 종료 · ±1분 · 채우기). 1초마다 줄어드는 숫자는 각자 브라우저가 계산한다.
   - 시간 통 = 좌석(PL)마다 하나. 0 이 지나면 알림만 하고 넘친 시간(+m:ss)을 빨갛게 센다(끝내는 건 GM).
   - 조작은 GM. 좌석은 rp 를 못 쓰니 「내 씬 종료」는 pub.<좌석>.ctEnd 에 적고, GM 화면이 보고 대신 끝낸다. */
"use strict";
window.OM_CTIMER=(()=>{
 const A=()=>window.OM_APP;
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const gm=()=>A()&&A().ST.role==='gm';
 const T0=()=>((A().ST.state.rp||{}).ctimer)||null;
 /* 자리에 앉은 좌석 — 아무도 안 앉았으면(GM 혼자 미리 볼 때) 로스터 트레이너 · 시간 통이 이미 있는 사람도 */
 const seats=()=>{const st=A().ST.state;const L=Object.keys(st.seats||{});const base=L.length?L:Object.keys((st.roster||{}).trainers||{});const bk=Object.keys(((st.rp||{}).ctimer||{}).bank||{});return [...new Set([...base,...bk.filter(k=>base.includes(k)||L.length===0)])]};
 const nameOf=s=>{const ST=A().ST;return (((ST.state.roster||{}).trainers||{})[s]||{}).name||((ST.state.seats||{})[s]||{}).name||s};
 const baseMs=T=>Math.max(1,+(T&&T.base)||30)*60000;
 function rem(T,s,now){const b=T.bank&&T.bank[s]!=null?+T.bank[s]:baseMs(T);return b-(T.run===s&&T.since?(now||Date.now())-T.since:0)}
 function fmt(ms){const neg=ms<0;let s=Math.ceil(Math.abs(ms)/1000);if(neg)s=Math.floor(Math.abs(ms)/1000);const m=Math.floor(s/60);return (neg?'+':'')+m+':'+String(s%60).padStart(2,'0')}
 const clone=T=>JSON.parse(JSON.stringify(T||{}));
 function commit(T,now){if(T.run&&T.since){T.bank=T.bank||{};T.bank[T.run]=rem(T,T.run,now);T.since=0}return T}
 async function save(T,log){T.at=Date.now();const ok=await A().set(['rp','ctimer'],T);if(ok!==false&&log)A().sysLog('⏱ '+log);return ok}
 /* ---------- 동작 (GM) ---------- */
 async function start(s){const now=Date.now();const T=commit(clone(T0()||{on:true,base:30,bank:{}}),now);const prev=T.run&&T.run!==s?T.run:'';T.on=true;T.run=s;T.since=now;T.runAt=now;
  return save(T,`${prev?`${nameOf(prev)} 씬 멈춤(남은 ${fmt(rem(T,prev,now))}) → `:''}${nameOf(s)} 씬 시작 — 남은 ${fmt(rem(T,s,now))}`)}
 async function pause(){const T=clone(T0());if(!T.run||!T.since)return;commit(T,Date.now());return save(T,`일시 정지 — ${nameOf(T.run)} 남은 ${fmt(rem(T,T.run))}`)}
 async function resume(){const T=clone(T0());if(!T.run||T.since)return;T.since=Date.now();return save(T,`다시 흐름 — ${nameOf(T.run)}`)}
 async function end(byPl){const T=clone(T0());if(!T.run)return;const s=T.run;commit(T,Date.now());T.run='';T.since=0;return save(T,`${nameOf(s)} 씬 종료${byPl?' (본인)':''} — 남은 ${fmt(rem(T,s))}`)}
 async function adj(s,d){const now=Date.now();const T=commit(clone(T0()||{on:true,base:30,bank:{}}),now);T.bank=T.bank||{};T.bank[s]=rem(T,s,now)+d;if(T.run===s&&T0()&&T0().since)T.since=now;return save(T,`${nameOf(s)} ${d>0?'+':'−'}${Math.abs(d/60000)}분 → ${fmt(T.bank[s])}`)}
 async function fill(min){min=Math.max(1,Math.min(600,+min||30));const T=clone(T0()||{});T.on=true;T.base=min;T.bank={};for(const s of seats())T.bank[s]=min*60000;T.run='';T.since=0;return save(T,`장면 타이머 — 모두 ${min}분으로 채움`)}
 async function setOn(on){const T=clone(T0()||{base:30,bank:{}});if(!on)commit(T,Date.now());T.on=!!on;if(!on){T.run='';T.since=0}return save(T,on?'장면 타이머 켬':'장면 타이머 끔')}
 /* ---------- 좌석: 내 씬 종료 요청 ---------- */
 async function plEnd(){const ST=A().ST,T=T0();if(ST.role!=='seat'||!T||T.run!==ST.seat)return;if(await A().set(['pub',ST.seat,'ctEnd'],{run:T.runAt||0,at:Date.now()}))A().toast('씬 종료를 알렸다 — 내 시계가 멈춘다')}
 /* ---------- 그리기 ---------- */
 const CSS=`.ctim{position:absolute;left:50%;top:44px;transform:translateX(-50%);z-index:30;display:flex;flex-wrap:wrap;gap:4px;align-items:center;justify-content:center;max-width:calc(100% - 16px);padding:4px 6px;border-radius:10px;background:rgba(10,10,12,.72);border:1px solid rgba(255,255,255,.14);font:12px/1.2 'IBM Plex Sans KR',sans-serif;color:#eee;backdrop-filter:blur(2px)}
.ctim .ctc{display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);white-space:nowrap}
.ctim .ctc b{font-weight:600;max-width:7em;overflow:hidden;text-overflow:ellipsis}
.ctim .ctc i{font-style:normal;font-variant-numeric:tabular-nums;font-size:13px}
.ctim .ctc.run{border-color:var(--yel,#ffd12e);background:rgba(255,209,46,.14)}
.ctim .ctc.run i{color:var(--yel,#ffd12e)}
.ctim .ctc.pz i{color:#9ad}
.ctim .ctc.low i{color:#ffa94d}
.ctim .ctc.over i{color:var(--red2,#ff4d6a)}
.ctim .ctc.over{border-color:var(--red2,#ff4d6a)}
.ctim .ctc.gmk{cursor:pointer}.ctim .ctc.gmk:hover{border-color:rgba(255,255,255,.4)}
.ctim .ctb{padding:2px 7px;border-radius:7px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#eee;font:inherit;cursor:pointer}
.ctim .ctb:hover{background:rgba(255,255,255,.18)}.ctim .ctb.endb{border-color:var(--red2,#ff4d6a)}
.ctim .ctl{opacity:.7;font-size:11px;margin-right:2px}
.ctmrow{display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid var(--line,#333)}.ctmrow b{flex:1}.ctmrow i{font-style:normal;font-variant-numeric:tabular-nums;min-width:4.5em;text-align:right}
@media (max-width:760px){.ctim{top:40px;font-size:11px}.ctim .ctc{padding:2px 6px}.ctim .ctc i{font-size:12px}}`;
 function css(){if(document.getElementById('ctimcss'))return;const s=document.createElement('style');s.id='ctimcss';s.textContent=CSS;document.head.appendChild(s)}
 function stripHtml(T,now){const ST=A().ST;const L=seats();if(!L.length)return '';const G=gm();
  const chips=L.map(s=>{const r=rem(T,s,now);const run=T.run===s;const cls=['ctc',run&&T.since?'run':'',run&&!T.since?'pz':'',r<0?'over':(r<60000?'low':''),G?'gmk':''].filter(Boolean).join(' ');
   return `<span class="${cls}" ${G?`data-ct="start" data-s="${esc(s)}" title="${run?'지금 씬 주인':'눌러서 이 사람 씬 시작'}"`:''}>${run?(T.since?'▶':'⏸'):''}<b>${esc(nameOf(s))}</b><i>${fmt(r)}</i></span>`}).join('');
  let btn='';if(G&&T.run)btn=(T.since?`<button class="ctb" data-ct="pause" title="일시 정지">⏸</button>`:`<button class="ctb" data-ct="resume" title="이어서">▶</button>`)+`<button class="ctb endb" data-ct="end" title="이 씬 종료 — 남은 시간이 멈춘다">■ 씬 종료</button>`;
  if(G)btn+=`<button class="ctb" data-ct="open" title="장면 타이머 설정">⚙</button>`;
  if(!G&&ST.role==='seat'&&T.run===ST.seat)btn+=`<button class="ctb endb" data-ct="plend" title="내 씬을 끝내고 시계를 멈춘다">■ 내 씬 종료</button>`;
  return `<span class="ctl">⏱ 장면</span>${chips}${btn}`}
 let LAST='',WARN={};
 function beep(f){try{const C=window.AudioContext||window.webkitAudioContext;const c=new C();const o=c.createOscillator(),g=c.createGain();o.type='triangle';o.frequency.value=f||880;g.gain.setValueAtTime(.0001,c.currentTime);g.gain.exponentialRampToValueAtTime(.15,c.currentTime+.02);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.5);o.connect(g).connect(c.destination);o.start();o.stop(c.currentTime+.55);setTimeout(()=>c.close(),900)}catch(e){}}
 function tick(){try{const app=A();if(!app||!app.ST||!app.ST.room)return;const stage=document.getElementById('rpstage');const T=T0();
  let box=stage&&stage.querySelector(':scope>#ctim');
  if(!stage||!T||!T.on){if(box)box.remove();LAST='';return}
  css();if(!box){box=document.createElement('div');box.id='ctim';box.className='ctim';stage.appendChild(box);box.addEventListener('click',onClick);LAST=''}
  const now=Date.now();const h=stripHtml(T,now);if(h!==LAST){box.innerHTML=h;LAST=h}
  /* 알림: 1분 남음 · 시간 종료 — 각자 화면에서 한 번씩 (씬마다) */
  if(T.run&&T.since){const r=rem(T,T.run,now);const k=T.run+':'+(T.runAt||0);const me=gm()||app.ST.seat===T.run;
   if(r<=60000&&r>0&&!WARN[k+'w']){WARN[k+'w']=1;if(me){app.toast(`⏱ ${nameOf(T.run)} — 1분 남음`);beep(660)}}
   if(r<=0&&!WARN[k+'o']){WARN[k+'o']=1;if(me){app.toast(`⏱ ${nameOf(T.run)} — 시간 종료 (넘친 시간을 센다)`);beep(880);setTimeout(()=>beep(880),350)}}}
  /* GM: 좌석의 「내 씬 종료」 요청을 대신 처리 */
  if(gm()&&T.run){const p=((app.ST.state.pub||{})[T.run]||{}).ctEnd;if(p&&+p.run===+(T.runAt||0)&&!WARN['e'+T.runAt]){WARN['e'+T.runAt]=1;end(true)}}
 }catch(e){console.warn('ctimer',e)}}
 function onClick(e){const b=e.target.closest('[data-ct]');if(!b)return;e.stopPropagation();const k=b.dataset.ct;
  if(k==='plend')return plEnd();if(!gm())return;
  if(k==='start'){const T=T0()||{};if(T.run===b.dataset.s)return T.since?pause():resume();return start(b.dataset.s)}
  if(k==='pause')return pause();if(k==='resume')return resume();if(k==='end')return end();if(k==='open')return open()}
 /* ---------- 설정 창 (GM) ---------- */
 function open(){if(!gm())return A().toast('장면 타이머는 GM 이 다룬다');const T=T0()||{base:30,bank:{}};
  const md=A().openModal(`<div class="mhead"><h2>⏱ 커뮤 장면 타이머</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
  <div class="small dim" style="margin:4px 0 10px">체스 시계처럼 자리마다 시간 통이 하나 — 지금 씬 주인 시계만 흐르고, 씬이 끝나면 남은 시간이 멈춰 다음 씬에 이어 쓴다. 0 이 지나면 알림 + 넘친 시간(+m:ss)을 센다. 무대 위 이름을 누르면 그 사람 씬 시작 · 다시 누르면 일시 정지.</div>
  <div class="row" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><label>한 사람당</label><input type="number" id="ctBase" min="1" max="600" value="${+T.base||30}" style="width:5em"><span>분</span><button class="btn sm pri" data-m="fill">모두 이 시간으로 채우기</button><span class="sp" style="flex:1"></span><button class="btn sm ${T.on?'':'pri'}" data-m="onoff">${T.on?'무대에서 숨기기':'무대에 띄우기'}</button></div>
  <div id="ctRows" style="margin-top:10px"></div>`);
  const rows=()=>{const T=T0()||{base:30,bank:{}};const now=Date.now();const L=seats();const el=md.querySelector('#ctRows');if(!el)return;
   el.innerHTML=L.length?L.map(s=>`<div class="ctmrow"><b>${T.run===s?(T.since?'▶ ':'⏸ '):''}${esc(nameOf(s))}</b><i>${fmt(rem(T,s,now))}</i><button class="btn xs" data-m="adj" data-s="${esc(s)}" data-d="-60000">−1분</button><button class="btn xs" data-m="adj" data-s="${esc(s)}" data-d="60000">+1분</button><button class="btn xs ${T.run===s?'':'pri'}" data-m="start" data-s="${esc(s)}">${T.run===s?(T.since?'⏸ 멈춤':'▶ 이어서'):'▶ 씬 시작'}</button>${T.run===s?`<button class="btn xs" data-m="end">■ 씬 종료</button>`:''}</div>`).join(''):'<div class="small dim">아직 자리에 앉은 플레이어가 없다</div>'};
  rows();const iv=setInterval(()=>{if(!md.isConnected)return clearInterval(iv);rows()},1000);
  md.addEventListener('click',async e=>{if(e.target.closest('[data-x]'))return A().closeModal();const b=e.target.closest('[data-m]');if(!b)return;const k=b.dataset.m;
   if(k==='fill'){const cur=T0();if(cur&&cur.run&&!confirm('지금 흐르는 씬이 있다. 모두 새로 채우고 멈출까?'))return;await fill(md.querySelector('#ctBase').value)}
   else if(k==='onoff'){await setOn(!(T0()||{}).on);const t=T0()||{};b.textContent=t.on?'무대에서 숨기기':'무대에 띄우기';b.classList.toggle('pri',!t.on)}
   else if(k==='adj')await adj(b.dataset.s,+b.dataset.d);
   else if(k==='start'){const t=T0()||{};if(t.run===b.dataset.s)await(t.since?pause():resume());else await start(b.dataset.s)}
   else if(k==='end')await end();
   rows()})}
 setInterval(tick,500);
 return {open,start,pause,resume,end,rem,fmt,tick}})();
