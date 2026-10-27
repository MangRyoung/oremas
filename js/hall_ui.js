/* ---------- 전당 (2026-10-27 망령) ----------
   끝난 배틀을 남기는 곳. 「배틀 비우기」 · 「결과 정리」 때 등록할지 묻고, 등록하면 마무리 시점 요약 + 승패 + 간략 로그를 남긴다.
   목록에서 한 판을 누르면 요약 · 간략 로그 · 코멘트, PNG 복사 · 저장.
   저장: 방 상태가 아니라 om_hall 표 (supabase/patch_2026-10-27_전당.sql) — 방 상태는 바뀔 때마다 통째로 쓰고 실시간으로 나가니 쌓이는 기록은 따로 둔다.
     head = {t 제목, r 'left'|'right'|'draw'|'', mode, turn, sides:{left|right:{tr:[{n,img}], mons:[{n,img,lv,hp,mx,st[],it,on,dead}]}}, fld[], by, at0}
     log  = 'g:' + gzip(JSON [[턴, 글]…]) 의 base64 (안 되는 브라우저는 'j:' + JSON) — 목록에서는 안 읽고 한 판을 열 때만
     그림은 주소(http)만 남긴다 — base64 그림은 버린다 */
"use strict";
window.OM_HALL_UI=(()=>{
 const A=()=>window.OM_APP,DBS=()=>window.OM_STORE,ST=()=>A().ST;
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const $=(s,r)=>(r||document).querySelector(s);
 const rnd=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
 const SIDES=['left','right'],SK={left:'좌측',right:'우측'};
 const img=u=>typeof u==='string'&&/^https?:\/\//.test(u)&&u.length<500?u:'';
 const fmtT=t=>{if(!t)return '';const d=new Date(t);const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}.${p(d.getMonth()+1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`};
 const myName=()=>{const s=ST();if(s.role==='gm')return 'GM'+(s.gmNick?' · '+s.gmNick:'');const t=((s.state.roster||{}).trainers||{})[s.seat];return s.name||(t&&t.name)||'?'};
 const canWrite=()=>!!ST().role&&ST().role!=='view';
 const mine=w=>ST().role==='gm'||(ST().role==='seat'&&w===ST().seat);

 /* ----- 요약 만들기 ----- */
 function stKo(k){const d=(((window.OM_DB||{}).states||{}).st||{})[k];return (d&&d.ko)||k}
 const SHOW_ST=['Poison','Toxic','Burn','Paralysis','Freeze','Sleep','Confusion','Dead'];
 function trImg(t){if(!t)return '';const st=t.stands||[];const a=st[+t.standActive||0]||st[0];return img(t.image)||img(a&&a.src)}
 function sideTids(b,s){const L=((b.sides||{})[s]||{}).trainers||[];const T=b.trainers||{};return [...new Set([...L,...Object.keys(T).filter(id=>T[id]&&T[id].side===s)])].filter(id=>T[id])}
 function snap(b){const T=b.trainers||{};const sides={};
  for(const s of SIDES){const tids=sideTids(b,s);
   const mons=Object.values(b.mons||{}).filter(m=>m&&tids.includes(m.tid)).sort((x,y)=>tids.indexOf(x.tid)-tids.indexOf(y.tid)||(x.slot||0)-(y.slot||0));
   sides[s]={tr:tids.map(id=>({n:String(T[id].name||'?').slice(0,40),img:trImg(T[id])})),
    mons:mons.map(m=>{const hp=m.hp||{};const dead=(+hp.cur||0)<=0||!!(m.states||{}).Dead;const st=Object.keys(m.states||{}).filter(k=>(m.states||{})[k]&&SHOW_ST.includes(k)&&k!=='Dead').map(stKo).slice(0,3);
     return Object.assign({n:String((m.form0||{}).name||m.name||'?').slice(0,30),img:img(m.image),lv:+m.lv||0,hp:Math.max(0,+hp.cur||0),mx:+hp.max||0},st.length?{st}:{},m.item?{it:String(m.item).slice(0,30)}:{},m.entry&&!dead?{on:1}:{},dead?{dead:1}:{})})}}
  const f=b.field||{};const fld=[(f.weather||{}).type&&'날씨 '+f.weather.type,(f.terrain||{}).type,...Object.keys(f.rooms||{}).filter(k=>(f.rooms||{})[k])].filter(Boolean).slice(0,6);
  return {sides,mode:+b.mode||1,turn:+b.turn||0,fld,at0:+b.at0||0}}
 function alive(sd){return (sd.mons||[]).filter(m=>!m.dead).length}
 function guess(h){const l=alive(h.sides.left),r=alive(h.sides.right);if(l&&!r)return 'left';if(r&&!l)return 'right';if(!l&&!r)return 'draw';return ''}
 const trNames=sd=>(sd.tr||[]).map(t=>t.n).join(' · ')||'?';
 const resTxt=h=>h.r==='left'?trNames(h.sides.left)+' 승':h.r==='right'?trNames(h.sides.right)+' 승':h.r==='draw'?'무승부':'승패 없음';

 /* ----- 간략 로그: 이 배틀(시합 개시 뒤)의 배틀 로그만 · 한 줄 500자까지 · gzip ----- */
 async function battleLog(b){const room=ST().room;let from=+b.log0||0;
  if(!from){const L=ST().log||[];for(let i=L.length-1;i>=0;i--){const t=String((L[i].data||{}).t||'');if(L[i].kind==='battle'&&/^시합 개시/.test(t)){from=L[i].id-1;break}}   /* 예전 배틀(log0 이 없던 때): 화면에 남은 로그에서 「시합 개시」 */
   if(!from){const f=(ST().log||[]).find(r=>r.kind==='battle');from=f?f.id-1:0}}
  const rows=[];let after=from;for(let k=0;k<20;k++){const got=await DBS().getLog(room,after,500);if(!got.length)break;rows.push(...got);after=got[got.length-1].id;if(got.length<500)break}
  let turn=0;const out=[];
  for(const r of rows){if(r.kind!=='battle')continue;const t=String((r.data||{}).t||'').trim();if(!t)continue;const m=t.match(/TURN (\d+)/);if(m&&/^(턴 개시|시합 개시)/.test(t))turn=+m[1];
   out.push([turn,t.length>500?t.slice(0,500)+'…':t])}
  return out}
 async function pack(lines){const js=JSON.stringify(lines);
  try{if(window.CompressionStream){const cs=new Blob([js]).stream().pipeThrough(new CompressionStream('gzip'));const buf=new Uint8Array(await new Response(cs).arrayBuffer());let s='';for(let i=0;i<buf.length;i+=0x8000)s+=String.fromCharCode.apply(null,buf.subarray(i,i+0x8000));return 'g:'+btoa(s)}}catch(e){}
  return 'j:'+js}
 async function unpack(s){if(!s)return [];try{if(s.startsWith('j:'))return JSON.parse(s.slice(2));if(s.startsWith('g:')){const bin=atob(s.slice(2));const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);const ds=new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'));return JSON.parse(await new Response(ds).text())}}catch(e){console.warn('전당 로그',e)}return null}
 async function packFit(lines){let L=lines,p=await pack(L);   /* 서버 한도 120KB — 넘으면 줄마다 더 짧게, 그래도 넘으면 앞쪽(초반 턴)부터 덜어 낸다 */
  if(p.length>118000){L=L.map(([t,x])=>[t,x.length>200?x.slice(0,200)+'…':x]);p=await pack(L)}
  while(p.length>118000&&L.length>20){L=L.slice(Math.ceil(L.length*.2));p=await pack([[0,'(앞쪽 로그는 길어서 뺐다)'],...L])}return p}

 /* ----- 등록 묻기: 배틀 비우기(opt.clear) · 결과 정리 ----- 돌려주는 값: 'saved' | 'skip' | 'cancel' */
 function worth(b){return !!(b&&b.started&&!b.hallId&&Object.keys(b.trainers||{}).length&&SIDES.some(s=>sideTids(b,s).length))}
 function offer(b,opt){opt=opt||{};return new Promise(done=>{const h=snap(b);const g=guess(h);const def=`${trNames(h.sides.left)} vs ${trNames(h.sides.right)}`;
  const md=A().openModal(`<div class="mhead"><h2>🏆 전당에 남길까?</h2><span class="sp"></span><button class="btn ghost" data-hx="cancel">${opt.clear?'취소':'닫기'}</button></div>
   <div class="small dim" style="margin-bottom:8px">${opt.clear?'배틀을 비우기 전에':'결과를 정리하면서'} 지금 상황(턴 ${h.turn} · 남은 포켓몬 · HP · 상태)과 승패, 간략 로그를 「전당」 탭에 남긴다.</div>
   <label class="hall-fl"><span>제목</span><input type="text" id="hl_t" maxlength="80" value="${esc(def)}"></label>
   <div class="hall-fl"><span>승패</span><div class="hall-res">${[['left',trNames(h.sides.left)+' 승'],['right',trNames(h.sides.right)+' 승'],['draw','무승부'],['','기록 안 함']].map(([k,n])=>`<label class="btn sm ${g===k?'pri':'ghost'}"><input type="radio" name="hl_r" value="${k}" ${g===k?'checked':''} hidden>${esc(n)}</label>`).join('')}</div></div>
   <label class="hall-fl top"><span>코멘트</span><textarea id="hl_c" rows="3" maxlength="4000" placeholder="(선택) 첫 코멘트 — 여러 줄 가능"></textarea></label>
   <div class="hallprev">${sumHtml(Object.assign({},h,{t:'',r:g}),true)}</div>
   <div class="row" style="margin-top:10px;gap:6px;flex-wrap:wrap"><span class="sp"></span>${opt.clear?'<button class="btn" data-hx="skip">등록 안 하고 비우기</button><button class="btn pri" data-hx="save">등록하고 비우기</button>':'<button class="btn" data-hx="skip">건너뛰기</button><button class="btn pri" data-hx="save">전당에 등록</button>'}</div>`);
  const bg=md.closest('.modalbg');let fin=false;const end=v=>{if(fin)return;fin=true;done(v)};
  new MutationObserver((_,o)=>{if(!bg.isConnected){o.disconnect();end('cancel')}}).observe(document.body,{childList:true});   /* 바깥을 눌러 닫음 = 취소 */
  md.querySelectorAll('input[name=hl_r]').forEach(r=>r.onchange=()=>{md.querySelectorAll('.hall-res label').forEach(l=>{const on=l.querySelector('input').checked;l.classList.toggle('pri',on);l.classList.toggle('ghost',!on)});const p=$('.hallprev',md);if(p)p.innerHTML=sumHtml(Object.assign({},h,{t:'',r:r.value}),true)});
  md.querySelectorAll('[data-hx]').forEach(bt=>bt.onclick=async()=>{const k=bt.dataset.hx;if(k!=='save'){A().closeModal();return end(k)}
   bt.disabled=true;bt.textContent='남기는 중…';
   try{const id=rnd();const r=(md.querySelector('input[name=hl_r]:checked')||{}).value||'';const head=Object.assign(h,{t:$('#hl_t',md).value.trim().slice(0,80)||def,r,by:myName()});
    const log=await packFit(await battleLog(b));await DBS().hall.put(ST().room,ST().secret,id,head,log);
    const c=$('#hl_c',md).value.trim();if(c)try{await DBS().hall.cm(ST().room,ST().secret,id,myName(),c)}catch(e){}
    try{await A().set(['battle','hallId'],id)}catch(e){}LIST=null;END=false;ping();
    A().sysLog(`🏆 전당에 남겼다 — ${head.t} (${resTxt(head)} · 턴 ${head.turn})`,'battle');A().closeModal();end('saved')}
   catch(e){bt.disabled=false;bt.textContent='다시 시도';const nf=DBS().hall.noFn(e.raw||e);A().toast(nf?'전당 표가 아직 없다 — GM 이 supabase/patch_2026-10-27_전당.sql 을 한 번 돌려야 한다':'전당에 남기지 못했다: '+e.message)}})})}

 /* ----- 요약 카드 (목록 · 상세 · PNG 공용) ----- */
 function monHtml(m){const pc=m.mx?Math.round(m.hp/m.mx*100):0;const col=pc>50?'var(--ok)':pc>20?'var(--yel)':'var(--red)';
  return `<div class="hm ${m.dead?'dead':''} ${m.on?'on':''}" title="${esc(m.n)}${m.lv?' Lv'+m.lv:''}${m.it?' · '+esc(m.it):''}">${m.img?`<img src="${esc(m.img)}" alt="" crossorigin="anonymous" loading="lazy">`:`<i>${esc(m.n.slice(0,1))}</i>`}<b>${esc(m.n)}</b><span class="hmbar"><u style="width:${m.dead?0:Math.max(2,pc)}%;background:${col}"></u></span><small>${m.dead?'빈사':m.hp+'/'+m.mx}${m.st?' · '+esc(m.st.join('·')):''}</small></div>`}
 function sideHtml(h,s){const sd=h.sides[s]||{tr:[],mons:[]};const win=h.r===s,lose=h.r&&h.r!=='draw'&&h.r!==s;
  return `<div class="hs ${s} ${win?'win':''} ${lose?'lose':''}"><div class="hst">${(sd.tr||[]).map(t=>`<span class="htr">${t.img?`<img src="${esc(t.img)}" alt="" crossorigin="anonymous" loading="lazy">`:''}<b>${esc(t.n)}</b></span>`).join('')}${win?'<em class="hwin">WIN</em>':lose?'<em class="hlose">LOSE</em>':''}<span class="hcnt">${alive(sd)}/${(sd.mons||[]).length}</span></div><div class="hms">${(sd.mons||[]).map(monHtml).join('')}</div></div>`}
 function sumHtml(h,mini){return `<div class="hsum ${mini?'mini':''}">${h.t?`<div class="hsumt"><b>${esc(h.t)}</b><span class="hres ${h.r||'none'}">${esc(resTxt(h))}</span></div>`:''}
  <div class="hvs">${sideHtml(h,'left')}<div class="hvsx">VS</div>${sideHtml(h,'right')}</div>
  <div class="small dim hmeta">${[h.mode>=3?'트리플':h.mode===2?'더블':'싱글',h.turn?'턴 '+h.turn+'에 마무리':'',...(h.fld||[])].filter(Boolean).map(esc).join(' · ')}</div></div>`}

 /* ----- 목록 ----- */
 /* 10-27 망령: 판이 많이 쌓인다 — 목록은 한 줄씩 촘촘하게(날짜 · 제목 · 승패 · 양쪽 트레이너와 남은 수 · 턴 · 코멘트 수), 누르면 상세 · 편집.
    서버 목록은 가벼운 요약(이름 · 남은 수)만 60판씩 — 「더 보기」나 찾기를 하면 다음 묶음을 더 읽는다 */
 const PAGE=60;let LIST=null,LOADING=false,ERRM='',Q='',RF='',END=false;
 function ping(){try{DBS().broadcast({t:'hall'})}catch(e){}}
 function onEvent(){LIST=null;END=false;if(A().view==='hall')A().renderScene()}
 async function load(more){if(LOADING)return;LOADING=true;ERRM='';
  try{const before=more&&LIST&&LIST.length?LIST[LIST.length-1].at:null;const got=(await DBS().hall.list(ST().room,before,PAGE))||[];LIST=more&&LIST?LIST.concat(got.filter(x=>!LIST.some(y=>y.id===x.id))):got;END=got.length<PAGE}
  catch(e){if(!more)LIST=[];END=true;ERRM=DBS().hall.noFn(e.raw||e)?'nofn':e.message}
  LOADING=false;if(A().view==='hall')A().renderScene()}
 const cnt=sd=>`${alive(sd||{})}/${((sd||{}).mons||[]).length}`;
 const resShort=h=>h.r==='left'||h.r==='right'?'승':h.r==='draw'?'무':'—';
 const dShort=t=>{if(!t)return '';const d=new Date(t);const p=n=>String(n).padStart(2,'0');const y=d.getFullYear()===new Date().getFullYear()?'':String(d.getFullYear()).slice(2)+'.';return `${y}${p(d.getMonth()+1)}.${p(d.getDate())}`};
 function rowHtml(x){const h=x.head||{};const S=h.sides||{};const side=s=>{const sd=S[s]||{};const w=h.r===s,l=h.r&&h.r!=='draw'&&h.r!==s;return `<span class="hrs ${s} ${w?'win':''} ${l?'lose':''}"><b>${esc(trNames(sd))}</b><i>${cnt(sd)}</i>${w?'<em>WIN</em>':'<em class="no"></em>'}</span>`};
  return `<div class="hrow ${h.r||'none'}" data-id="${esc(x.id)}" role="button" tabindex="0" title="${esc(fmtT(x.at))}${h.by?' · '+esc(h.by):''}"><span class="hrd">${dShort(x.at)}</span><b class="hrt">${esc(h.t||'(제목 없음)')}</b><span class="hrvs">${side('left')}<span class="hrx">vs</span>${side('right')}</span><span class="hrm">${h.r==='draw'?'<span class="hdraw">무승부</span>':''}${h.turn?'T'+h.turn:''}${x.ncm?` · 💬${x.ncm}`:''}</span></div>`}
 function render(el){if(LIST==null){el.innerHTML='<div class="hall"><div class="empty">전당을 불러오는 중…</div></div>';load();return}
  const ae=document.activeElement;if(ae&&ae.id==='hallQ'&&el.contains(ae)&&el.querySelector('.hall'))return;   /* 찾기 칸에 쓰는 중이면 다시 그리지 않는다 */
  const q=Q.trim().toLowerCase();const shown=LIST.filter(x=>{const h=x.head||{};if(RF&&(RF==='none'?h.r:h.r!==RF))return false;if(!q)return true;return [h.t,h.by,trNames((h.sides||{}).left||{}),trNames((h.sides||{}).right||{}),...SIDES.flatMap(s=>(((h.sides||{})[s]||{}).mons||[]).map(m=>m.n))].join(' ').toLowerCase().includes(q)});
  if((q||RF)&&!END&&!LOADING)setTimeout(()=>load(true),0);   /* 찾을 때는 남은 판도 다 읽어 와서 찾는다 */
  el.innerHTML=`<div class="hall rpt">
   <div class="rpthead"><div><div class="small dim">HALL OF FAME</div><h2>🏆 전당</h2></div><span class="chip">${LIST.length}${END?'':'+'}판</span><span class="sp"></span>
    <input type="search" id="hallQ" placeholder="트레이너 · 포켓몬 · 제목" value="${esc(Q)}"><button class="btn sm ghost" data-h="re" title="다시 불러오기">새로</button></div>
   ${ERRM==='nofn'?`<div class="card hallwarn"><b>전당 표가 아직 없다.</b> GM 이 Supabase SQL 편집기에서 <span class="mono">supabase/patch_2026-10-27_전당.sql</span> 을 한 번 돌리면 쓸 수 있다.</div>`:ERRM?`<div class="card hallwarn">불러오지 못했다: ${esc(ERRM)}</div>`:''}
   <div class="row rptfilt">${[['','전부'],['left','좌측 승'],['right','우측 승'],['draw','무승부'],['none','승패 없음']].map(([k,n])=>`<button class="btn xs ${RF===k?'pri':'ghost'}" data-rf="${k}">${n}</button>`).join('')}${q||RF?`<span class="small dim" style="margin-left:6px">${shown.length}판</span>`:''}</div>
   ${shown.length?`<div class="hrows">${shown.map(rowHtml).join('')}</div>`
    :`<div class="empty">${LIST.length?(LOADING?'찾는 중…':'조건에 맞는 기록이 없다'):'아직 전당에 남긴 배틀이 없다. 배틀 화면의 「배틀 비우기」나 「결과 정리」 때 남길 수 있다.'}</div>`}
   ${!END&&!q&&!RF&&LIST.length?`<div class="row" style="justify-content:center;margin-top:10px"><button class="btn sm" data-h="more">${LOADING?'불러오는 중…':'더 보기'}</button></div>`:''}</div>`;
  const qi=$('#hallQ',el);if(qi)qi.oninput=()=>{Q=qi.value;clearTimeout(qi._t);qi._t=setTimeout(()=>{const p=qi.selectionStart;qi.blur();render(el);const n=$('#hallQ',el);if(n){n.focus();try{n.setSelectionRange(p,p)}catch(e){}}},250)};
  el.querySelectorAll('[data-rf]').forEach(b=>b.onclick=()=>{RF=b.dataset.rf;render(el)});
  const re=el.querySelector('[data-h="re"]');if(re)re.onclick=()=>{LIST=null;END=false;render(el)};
  const mo=el.querySelector('[data-h="more"]');if(mo)mo.onclick=()=>load(true);
  el.querySelectorAll('.hrow').forEach(c=>{c.onclick=()=>openOne(c.dataset.id);c.onkeydown=e=>{if(e.key==='Enter')openOne(c.dataset.id)}})}

 /* ----- 한 판 ----- */
 async function openOne(id){let x;try{x=await DBS().hall.get(ST().room,id)}catch(e){return A().toast('불러오지 못했다: '+e.message)}if(!x)return A().toast('그 기록이 없다 (지워졌을 수 있다)');
  const h=x.head||{};let lines=null;const canEd=mine(x.w);
  const cmHtml=c=>`<div class="hcm" data-ci="${esc(c.i)}"><b>${esc(c.by||'?')}</b> <span class="small dim">${fmtT(c.at)}</span>${mine(c.w)?'<button class="btn xs ghost danger hcmdel" title="지우기">×</button>':''}<div>${esc(c.t)}</div></div>`;
  const md=A().openModal(`<div class="mhead"><h2>🏆 전당</h2><span class="sp"></span>${canEd?'<button class="btn sm" data-ho="edt" title="제목 · 승패 고치기 · 기록 지우기">✎ 편집</button>':''}<button class="btn sm" data-ho="copy" title="요약 · 코멘트를 그림으로 클립보드에">PNG 복사</button><button class="btn sm" data-ho="save">PNG 저장</button><button class="btn ghost" data-x>닫기</button></div>
   ${canEd?`<div class="hedit" id="hEd" hidden><label class="hall-fl"><span>제목</span><input type="text" id="hEdT" maxlength="80" value="${esc(h.t||'')}"></label><label class="hall-fl"><span>승패</span><select id="hEdR">${[['left',trNames(h.sides.left)+' 승'],['right',trNames(h.sides.right)+' 승'],['draw','무승부'],['','승패 없음']].map(([k,n])=>`<option value="${k}" ${(h.r||'')===k?'selected':''}>${esc(n)}</option>`).join('')}</select></label><div class="row" style="gap:6px"><button class="btn sm ghost danger" data-ho="del">기록 지우기</button><span class="sp"></span><button class="btn sm ghost" data-ho="edt">그만두기</button><button class="btn sm pri" data-ho="ed">저장</button></div></div>`:''}
   <div class="hallshot"><div class="hshot-h"><span>HALL OF FAME</span><span class="sp"></span><span>${esc(fmtT(x.at))}${h.by?' · '+esc(h.by):''}</span></div>${sumHtml(h,false)}<div class="hcms" id="hcms">${(x.cm||[]).map(cmHtml).join('')}</div></div>
   ${canWrite()?`<div class="hcmin"><textarea id="hcmT" rows="3" maxlength="4000" placeholder="코멘트 — 여러 줄 그대로 남는다 · Ctrl+Enter 로 달기"></textarea><div class="row"><label class="small hlogpng"><input type="checkbox" id="hlogpng"> PNG 에 간략 로그도 넣기</label><span class="sp"></span><span class="small dim" id="hcmN"></span><button class="btn sm pri" data-ho="cm">코멘트 달기</button></div></div>`:'<div class="row"><label class="small hlogpng"><input type="checkbox" id="hlogpng"> PNG 에 간략 로그도 넣기</label><span class="sp"></span><span class="small dim">자리에 앉으면 코멘트를 쓸 수 있다.</span></div>'}
   <details class="hlog" id="hlog"><summary>배틀 로그 (간략) <span class="small dim">${x.log?Math.max(1,Math.round(x.log.length/1024))+'KB':'없음'}</span></summary><div class="hlogb" id="hlogb"><div class="small dim">펼치면 불러온다</div></div></details>`);
  md.classList.add('hallmodal');
  const showLog=async()=>{if(lines)return lines;const box=$('#hlogb',md);lines=await unpack(x.log);if(!box)return lines;if(lines==null){box.innerHTML='<div class="small dim">이 브라우저에서 로그를 풀지 못했다</div>';return []}
   if(!lines.length){box.innerHTML='<div class="small dim">남은 로그가 없다</div>';return lines}
   let cur=-1,html='';for(const [t,s] of lines){if(t!==cur){cur=t;html+=`<div class="hlturn">${t?'TURN '+t:'시작 전'}</div>`}const [a,...rest]=String(s).split('\n');html+=`<div class="hlrow"><b>${esc(a)}</b>${rest.length?`<span>${esc(rest.join('\n'))}</span>`:''}</div>`}
   box.innerHTML=html;return lines};
  $('#hlog',md).addEventListener('toggle',e=>{if(e.target.open)showLog()});
  const redrawCm=c=>{x.cm=c;const box=$('#hcms',md);box.innerHTML=c.map(cmHtml).join('');bindCm()};
  const bindCm=()=>md.querySelectorAll('.hcmdel').forEach(b=>b.onclick=async()=>{const ci=b.closest('[data-ci]').dataset.ci;if(!confirm('이 코멘트를 지울까?'))return;try{redrawCm(await DBS().hall.cm(ST().room,ST().secret,id,'',null,ci));ping()}catch(e){A().toast(e.message)}});bindCm();
  const post=async()=>{const i=$('#hcmT',md);const t=i.value.trim();if(!t)return;i.disabled=true;try{redrawCm(await DBS().hall.cm(ST().room,ST().secret,id,myName(),t));i.value='';i.style.height='';LIST=null;ping()}catch(e){A().toast('코멘트를 남기지 못했다: '+e.message)}i.disabled=false;i.focus()};
  const ti=$('#hcmT',md);if(ti){const grow=()=>{ti.style.height='auto';ti.style.height=Math.min(ti.scrollHeight+2,window.innerHeight*.45)+'px';const n=$('#hcmN',md);if(n)n.textContent=ti.value.length>3000?ti.value.length+'/4000':''};ti.oninput=grow;ti.onkeydown=e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!e.isComposing){e.preventDefault();post()}}}   /* 코멘트는 5~10줄도 — 엔터는 줄바꿈, Ctrl+Enter 로 달기 */
  md.querySelectorAll('[data-ho]').forEach(b=>b.onclick=async()=>{const k=b.dataset.ho;
   if(k==='cm')return post();
   if(k==='edt'){const e=$('#hEd',md);if(e){e.hidden=!e.hidden;if(!e.hidden)$('#hEdT',md).focus()}return}
   if(k==='copy'||k==='save')return shot(md,h,k,$('#hlogpng',md).checked?await showLog():null);
   if(k==='ed'){const nh=Object.assign({},h,{r:$('#hEdR',md).value,t:$('#hEdT',md).value.trim().slice(0,80)||h.t});try{await DBS().hall.put(ST().room,ST().secret,id,nh,null);LIST=null;END=false;ping();A().toast('고쳤다');openOne(id)}catch(e){A().toast(e.message)}return}
   if(k==='del'){if(!confirm(`「${h.t}」 기록을 전당에서 지울까? 되돌릴 수 없다.`))return;try{await DBS().hall.del(ST().room,ST().secret,id);LIST=null;END=false;ping();A().closeModal();A().toast('지웠다');if(A().view==='hall')A().renderScene()}catch(e){A().toast(e.message)}}})}

 /* ----- PNG: 요약 + 코멘트 (+ 고르면 간략 로그) ----- */
 async function h2c(){if(window.html2canvas)return;await new Promise((ok,no)=>{const sc=document.createElement('script');sc.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';sc.onload=ok;sc.onerror=()=>no(new Error('html2canvas 를 불러오지 못했다'));document.head.appendChild(sc)})}
 async function shot(md,h,k,lines){const src=$('.hallshot',md);if(!src)return;
  const box=src.cloneNode(true);box.classList.add('pngwrap');if(lines&&lines.length){const lg=document.createElement('div');lg.className='hlogpngb';let cur=-1;for(const [t,s] of lines){if(t!==cur){cur=t;const d=document.createElement('div');d.className='hlturn';d.textContent=t?'TURN '+t:'시작 전';lg.appendChild(d)}const d=document.createElement('div');d.className='hlrow';d.textContent=String(s).split('\n')[0];lg.appendChild(d)}box.appendChild(lg)}
  const host=document.createElement('div');host.style.cssText='position:fixed;left:-10000px;top:0;width:760px';host.appendChild(box);document.body.appendChild(host);
  try{await h2c();const cv=await window.html2canvas(box,{backgroundColor:'#141414',scale:2,useCORS:true,onclone:(cd,ce)=>{try{window.OM_PNGFIX&&window.OM_PNGFIX(cd,ce)}catch(e){}}});
   const name=String(h.t||'전당').replace(/[\\/:*?"<>|]/g,'_').slice(0,60)+'.png';
   if(k==='copy'){try{const blob=await new Promise(r=>cv.toBlob(r,'image/png'));await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);A().toast('PNG 를 복사했다')}catch(e){A().toast('이 브라우저는 그림 복사가 안 된다 — 대신 저장한다');k='save'}}
   if(k==='save'){const a=document.createElement('a');a.download=name;a.href=cv.toDataURL('image/png');a.click()}}
  catch(e){A().toast('PNG 로 만들지 못했다 ('+e.message+')')}finally{host.remove()}}

 return {render,offer,worth,onEvent,snap}
})();
