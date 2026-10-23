/* ---------- 처음 둘러보기 · 화면에서 찾기 (10-24 벨벳 「첫 방문 가이드 · 화면에서 찾기」 참고) ----------
   OM_TOUR.run(steps): 화면을 어둡게 하고 진짜 단추 하나만 밝게 뚫어 말풍선으로 설명한다. 단계마다 필요한 탭으로 옮기고, 화면에 없는 것(모바일에서 ☰ 안에 숨은 단추 등)은 건너뛴다.
   처음 들어온 방에서는 아래에 「둘러보기」 쪽지를 한 번 띄운다 (역할마다 한 번 · 이 브라우저에만 기억).
   튜토리얼 탭의 장마다 「🔍 화면에서 찾기」 — 그 장에 나오는 실제 단추를 차례로 짚는다 (FIND) */
"use strict";
window.OM_TOUR=(()=>{
 const A=()=>window.OM_APP;
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const mob=()=>window.matchMedia('(max-width:760px)').matches;
 const role=()=>{const r=A().ST.role;return r==='gm'?'gm':r==='seat'?'seat':'view'};
 /* 단계: {v:탭, m:'scene'|'chat'(모바일 아래 바), s:선택자(쉼표로 여러 개 — 보이는 첫 것), t:제목, d:설명, gm:GM만, pc:PC만, mo:모바일만} */
 const TAB=k=>`#sceneTabs button[data-s="${k}"]`;const MENU='#mbar [data-m="menu"]';   /* 휴대폰에선 상단 단추가 ☰ 메뉴 안에 있다 — 메뉴 단추를 짚는다 */
 const BASE=[
  {s:'#sceneTabs',t:'장면 탭',d:'RP · 배틀 · 시트 · 관계도 · 캘린더 · 제보 · 튜토리얼. GM 이 무대(RP · 배틀)를 바꾸면 모두 그쪽으로 따라가고, 나머지 탭은 각자 본다.'},
  {s:'#presence',t:'접속 중',d:'지금 들어와 있는 사람. 누르면 전체 목록 창이 열리고, 거기서 내 이름도 바꾼다.'},
  {s:'#seatBtn',t:'자리',d:'내 트레이너 자리에 앉는다. 앉으면 내 시트와 포켓몬을 고칠 수 있다.',only:'view',ms:MENU},
  {v:'rp',m:'scene',s:'.rpinput',t:'입력줄',d:'화자를 고르고 대사나 지문을 친다. 표정 · 자동/대사/지문 단추도 여기.'},
  {v:'rp',s:'[data-rp="phone"],#mbar [data-m="phone"]',t:'휴대폰',d:'게임 안 휴대폰. 문자 · 연락처 · SNS · 캘린더.'},
  {v:'rp',s:'[data-rp="gm"]',t:'GM 콘솔',d:'배경 · 음악 · 공지 · 연출 · 지도 · 투표가 모여 있다.',gm:1},
  {pc:1,s:'#side',t:'채팅',d:'세션 로그와 잡담. 주사위는 /r 1d100, 귓속말은 /w 이름 메시지.'},
  {mo:1,s:'#mbar',t:'아래 바',d:'무대 · 채팅 · 휴대폰 · 맨 위 · 메뉴(☰). 상단 단추는 ☰ 안에 있다.'},
  {s:'#skillBtn',t:'스킬 체크',d:'GM 이 체크를 내면 「스킬 체크 !」로 빨갛게 뜬다. 눌러서 굴린다.',ms:MENU},
  {s:'#copyLink',t:'플레이어 링크',d:'이 링크를 플레이어에게 준다. GM 링크는 남에게 주지 말 것.',gm:1,ms:MENU},
  {s:'#roomSet',t:'내 설정',d:'소리 · 알림 · 글자 · 대사 연출 · 단축키.',ms:MENU},
  {s:TAB('guide'),t:'튜토리얼',d:'더 자세한 설명은 여기. 장마다 「🔍 화면에서 찾기」로 실제 단추를 짚어 준다.'}];
 const FIND={
  welcome:BASE,layout:BASE,
  join:[{s:'#seatBtn',t:'자리',d:'누르면 자리 고르기 창. 내 트레이너를 고른다.',ms:MENU},{s:'#presence',t:'접속 중',d:'앉으면 여기 내 이름 옆에 트레이너가 붙는다.'},{s:'#copyLink',t:'플레이어 링크',d:'플레이어에게 줄 링크.',gm:1}],
  talk:[{v:'rp',m:'scene',s:'.rpinput',t:'입력줄',d:'화자를 고르고 Enter. 대사는 무대 말풍선으로, 지문은 띠로 뜬다.'},{v:'rp',m:'chat',s:'#chatIn',t:'채팅 입력',d:'명령(/r · /w)과 잡담은 여기.'}],
  phone:[{v:'rp',s:'[data-rp="phone"],#mbar [data-m="phone"]',t:'휴대폰',d:'키보드 P 로도 열린다.'}],
  rpmisc:[{v:'rp',s:'[data-rp="map"],[data-rp="gm"]',t:'지도 · 소리',d:'무대 위 단추에서 연다.'},{v:'rp',s:'[data-rp="deck"]',t:'덱',d:'은열쇠 · 광기 · 행동 카드.'}],
  gmrp:[{v:'rp',s:'[data-rp="gm"]',t:'GM 콘솔',d:'배경 · 음악 · 공지 · 연출 · 지도 관리 · 투표.',gm:1}],
  sheet:[{v:'sheet',s:'.stabs',t:'시트 띠',d:'캐릭터 · 포켓몬 · 성장 · 전투 쪽.'},{v:'sheet',s:'[data-act="toggleedit"]',t:'편집',d:'켜면 모든 칸을 고칠 수 있다. 안 켜도 글자 칸은 눌러서 바로 고친다.'},{v:'sheet',s:'.shist',t:'되돌리기 · 기록',d:'↶ ↷ 와 🕘 수정 기록 (Ctrl+Z).'}],
  skill:[{s:'#skillBtn',t:'스킬 체크',d:'GM 은 여기서 체크를 내고, 트레이너는 여기서 굴린다.',ms:MENU}],
  db:[{s:'#dbBtn',t:'DB',d:'특성 · 소지품 · 기술 · 포텐셜 · 상태 변화.'},{s:'#rmBtn',t:'레디메이드',d:'자동화 구문이 붙은 효과 모음.'},{s:'#dexBtn',t:'도감',d:'타입 · 약점 · 해석한 기술.'}],
  bscreen:[{v:'battle',s:'.bstat',t:'턴 띠',d:'지금 턴과 단계. GM 은 「턴 진행 ▶」(N).'},{v:'battle',s:'.stadium',t:'필드',d:'왼쪽(파랑)과 오른쪽(빨강) 진영, 가운데 에리어.'},{v:'battle',s:'.fstrip',t:'필드 띠',d:'날씨 · 필드 · 룸 · 설치기.'}],
  flow:[{v:'battle',s:'.bstat .phases,.bstat',t:'단계',d:'지시 → 공개 → 행동 → 턴 종료. GM 이 넘긴다.'}],
  orders:[{v:'battle',s:'#cmdForm',t:'지시 입력',d:'에리어마다 행동 · 대상을 고르고 「준비 완료」.'}],
  attack:[{v:'battle',s:'[data-act="attack"]',t:'공격',d:'자기 차례 포켓몬 카드의 「공격」(A).'}],
  hp:[{v:'battle',s:'[data-act="hp"]',t:'HP',d:'공격을 받으면 「피해 판정 받음」 — 여기서 판정한다.'}],
  status:[{v:'battle',s:'[data-act="edit"]',t:'랭크 · 상태',d:'랭크 ± · 상태 · 소지품 · 테라스탈 (S).'},{v:'battle',s:'.autock',t:'자동화 확인',d:'자동으로 처리되는 포텐셜 · 특성 · 소지품을 한눈에.'}],
  tactics:[{v:'battle',s:'#cmdForm',t:'묘수 · 도감',d:'지시 준비 중에 쓴다.'},{s:'#dexBtn',t:'도감',d:'해석한 만큼 보인다.'}],
  more:[{s:TAB('graph'),t:'관계도',d:'전체 관계도와 「내 인연」 보드.'},{s:TAB('calendar'),t:'캘린더',d:'오늘 날짜 · 날씨 · 일정 · 예보.'}],
  misc:[{s:TAB('report'),t:'제보',d:'버그 · 건의는 여기 「+ 새 제보」.'},{s:'#roomSet',t:'설정 · 단축키',d:'⚙ 설정 → 단축키.'}]};
 const has=id=>!!FIND[id];

 /* ----- 짚기 ----- */
 let T=null;
 const vis=el=>{if(!el)return false;const r=el.getBoundingClientRect();if(r.width<4||r.height<4)return false;const cs=getComputedStyle(el);return cs.visibility!=='hidden'&&cs.display!=='none'};
 const sel=st=>mob()&&st.ms?st.ms+','+st.s:st.s;
 const pick=s=>{for(const one of String(s).split(',')){const el=[...document.querySelectorAll(one.trim())].find(vis);if(el)return el}return null};
 const okFor=st=>{const r=role();if(st.gm&&r!=='gm')return false;if(st.only&&st.only!==r)return false;if(st.pc&&mob())return false;if(st.mo&&!mob())return false;return true};
 function goView(st){const app=A();let moved=false;if(st.v&&app.view!==st.v){app.view=st.v;app.renderScene();moved=true}
  if(mob()&&st.m){const b=document.querySelector(`#mbar [data-m="${st.m}"]`);if(b&&!b.classList.contains('on')){b.click();moved=true}}return moved}
 function close(){if(!T)return;T.ov.remove();window.removeEventListener('resize',T.re);document.removeEventListener('keydown',T.key,true);T=null}
 function run(steps,opt){close();opt=opt||{};const L=(steps||[]).filter(okFor);if(!L.length){A().toast('이 화면에서 짚을 단추가 없다');return}
  const ov=document.createElement('div');ov.className='tour';ov.innerHTML='<div class="tour-hole"></div><div class="tour-bub" role="dialog" aria-live="polite"></div>';document.body.appendChild(ov);
  T={ov,L,i:0,dir:1,title:opt.title||'둘러보기'};
  T.re=()=>place();T.key=e=>{if(e.key==='Escape'){e.preventDefault();close()}else if(e.key==='ArrowRight'||e.key==='Enter'){e.preventDefault();step(1)}else if(e.key==='ArrowLeft'){e.preventDefault();step(-1)}};
  window.addEventListener('resize',T.re);document.addEventListener('keydown',T.key,true);
  ov.addEventListener('click',e=>{const b=e.target.closest('[data-tu]');if(!b)return;const k=b.dataset.tu;if(k==='x')return close();step(k==='n'?1:-1)});
  show()}
 function step(d){if(!T)return;const n=T.i+d;if(n<0)return;if(n>=T.L.length){close();if(T===null&&d>0)A().toast('둘러보기 끝! 튜토리얼 탭에서 언제든 다시 볼 수 있어');return}T.i=n;T.dir=d;show()}
 function show(){const st=T.L[T.i];const moved=goView(st);setTimeout(()=>{if(!T)return;const el=pick(sel(st));if(!el){const n=T.i+T.dir;if(n>=0&&n<T.L.length){T.i=n;return show()}if(T.dir>0)return close();T.dir=1;return}
   el.scrollIntoView({block:'nearest',inline:'nearest'});T.el=el;place()},moved?260:0)}
 function place(){if(!T||!T.el)return;const st=T.L[T.i];const r=T.el.getBoundingClientRect();const pad=6,vw=innerWidth,vh=innerHeight;
  const x=Math.max(2,r.left-pad),y=Math.max(2,r.top-pad),w=Math.min(vw-4,r.width+pad*2),h=Math.min(vh-4,r.height+pad*2);
  const hole=T.ov.querySelector('.tour-hole');Object.assign(hole.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'});
  const bub=T.ov.querySelector('.tour-bub');const last=T.i===T.L.length-1;
  bub.innerHTML=`<div class="tour-h"><small>${esc(T.title)} · ${T.i+1}/${T.L.length}</small><b>${esc(st.t)}</b></div><p>${esc(st.d)}${mob()&&st.ms&&T.el&&T.el.matches(st.ms)?'<br><small class="dim">휴대폰에선 ☰ 메뉴 안에 있다</small>':''}</p><div class="tour-f"><button class="btn xs ghost" data-tu="x">그만</button><span class="sp"></span>${T.i?'<button class="btn sm" data-tu="p">◀</button>':''}<button class="btn sm pri" data-tu="n">${last?'끝':'다음 ▶'}</button></div>`;
  const bw=Math.min(340,vw-24);bub.style.width=bw+'px';const bh=bub.offsetHeight;
  let top=y+h+10,left=Math.max(12,Math.min(vw-bw-12,x+w/2-bw/2));
  if(top+bh>vh-8){top=y-bh-10;if(top<8){top=Math.max(8,Math.min(vh-bh-8,y+h/2-bh/2));   /* 위아래 둘 다 자리가 없으면(채팅처럼 긴 것) 옆으로, 옆도 없으면 안쪽 아래 */
   if(x-bw-14>=8)left=x-bw-14;else if(x+w+14+bw<=vw-8)left=x+w+14;else top=Math.max(8,Math.min(vh-bh-8,y+h-bh-12))}}
  bub.style.top=top+'px';bub.style.left=left+'px';
  const n=bub.querySelector('[data-tu="n"]');if(n)n.focus({preventScroll:true})}
 function find(id){const c=FIND[id];if(!c)return;run(c,{title:'화면에서 찾기'})}

 /* ----- 처음 들어온 방: 둘러보기 쪽지 ----- */
 const KEY=()=>'om_tour_'+role();
 const seen=()=>{try{return localStorage.getItem(KEY())==='1'}catch(e){return true}};
 const mark=()=>{try{localStorage.setItem(KEY(),'1')}catch(e){}};
 function offer(){if(seen()||document.querySelector('.tour-ask'))return;const d=document.createElement('div');d.className='tour-ask';
  d.innerHTML=`<b>처음이야?</b><span>단추 몇 개만 30초 안에 짚어 줄게.</span><div class="tour-f"><button class="btn xs ghost" data-ta="no">괜찮아</button><button class="btn sm pri" data-ta="go">둘러보기</button></div>`;
  document.body.appendChild(d);d.onclick=e=>{const b=e.target.closest('[data-ta]');if(!b)return;mark();d.remove();if(b.dataset.ta==='go')run(BASE,{title:'처음 둘러보기'})}}
 /* 방 화면이 그려지면 한 번 (app.js 는 고치지 않는다) */
 let tick=setInterval(()=>{const app=A();if(!app||!app.ST||!app.ST.room)return;if(!document.querySelector('#sceneTabs button'))return;clearInterval(tick);tick=null;setTimeout(offer,900)},700);
 return {run,find,has,close,base:()=>run(BASE,{title:'처음 둘러보기'}),FIND};
})();
