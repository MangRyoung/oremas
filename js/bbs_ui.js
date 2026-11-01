/* ---------- 학교 게시판 (2026-11-02 망령) ----------
   「웹툴 왼쪽 아래 빈 곳에 학교 게시판 아이콘 — SNS 처럼 가볍게 글 올리고 게시판도 팔 수 있게」
   · 방마다 따로. 저장은 방 상태 밖 om_bbs · om_bbs_board 표 (supabase/patch_2026-11-02_게시판.sql — SQL Editor 에서 한 번 실행)
   · 글쓴이 = 캐릭터 (좌석은 자기 트레이너, GM 은 GM · PC · 관계도 NPC 중에서). 글마다 「익명」을 고르면 남에게는 「익명」, GM 과 쓴 사람에게만 실제 이름
   · 누구나(방에 앉은 사람) 게시판을 만든다. 고치기 · 지우기는 GM 또는 만든 사람, 숨기기는 GM
   · 글 · 댓글 · 좋아요 · 그림 한 장. 새 글은 broadcast {t:'bbs'} 로 알리고, 열려 있으면 20초마다 · 닫혀 있으면 90초마다 새 줄만 받아 온다(ver)
   · 안 읽은 표시: 남이 쓴 줄 중 이 브라우저에서 본 ver 보다 뒤의 것 (localStorage om_bbs_seen_<방>) */
"use strict";
window.OM_BBS_UI=(()=>{
 const A=()=>window.OM_APP,DBS=()=>window.OM_STORE,ST=()=>A().ST;
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const $=(s,r)=>(r||document).querySelector(s);
 const img=u=>typeof u==='string'&&/^https?:\/\//.test(u)&&u.length<1000?u:'';
 const LS={get:(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
 const S={rows:new Map(),boards:[],ver:0,board:'free',open:false,md:null,open2:new Set(),draft:'',anon:false,imgUrl:'',busy:false,err:'',noSql:false,cdraft:{},room:'',lastPoll:0,unread:0};
 const room=()=>ST().room||'';const sec=()=>ST().secret||'';
 const role=()=>ST().role||'view';const canWrite=()=>role()==='gm'||role()==='seat';
 const mine=w=>role()==='gm'||(role()==='seat'&&w===ST().seat);
 const seenKey=()=>'om_bbs_seen_'+room();
 const fmtT=t=>{if(!t)return '';const d=new Date(t);const now=Date.now();const s=(now-d)/1000;if(s<60)return '방금';if(s<3600)return Math.floor(s/60)+'분 전';if(s<86400)return Math.floor(s/3600)+'시간 전';const p=n=>String(n).padStart(2,'0');return `${d.getMonth()+1}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`};
 const noSqlMsg='게시판 표가 아직 없어요 — Supabase SQL Editor 에서 supabase/patch_2026-11-02_게시판.sql 을 한 번 실행해 주세요';

 /* ----- 글쓴이 (캐릭터) ----- */
 function authors(){const s=ST(),st=s.state||{};const T=((st.roster||{}).trainers)||{};const out=[];
  if(role()==='seat'){const t=T[s.seat];if(t)out.push({cid:t.id,n:t.name||'?',img:A().portraitOf(t.name,t.image)});else out.push({cid:s.seat,n:s.name||'?',img:''});return out}
  if(role()==='gm'){out.push({cid:'gm',n:'GM'+(s.gmNick?' · '+s.gmNick:''),img:''});
   for(const t of Object.values(T))if(t&&t.name)out.push({cid:t.id,n:t.name,img:A().portraitOf(t.name,t.image)});
   const N=((st.graph||{}).nodes)||{};const have=new Set(out.map(x=>x.n));for(const [id,n] of Object.entries(N)){if(!n||!n.name||have.has(n.name)||n.kind==='org')continue;have.add(n.name);out.push({cid:'n:'+id,n:n.name,img:A().portraitOf(n.name,n.img)})}}
  return out}
 function curAuthor(){const L=authors();const k=LS.get('om_bbs_who_'+room(),'');return L.find(x=>x.cid===k)||L[0]||null}

 /* ----- 받아 오기 ----- */
 async function pull(full){if(!room())return;try{
   if(full||!S.boards.length){const b=await DBS().bbs.boards(room(),sec());S.boards=b||[]}
   const L=await DBS().bbs.feed(room(),sec(),full?0:S.ver);if(full)S.rows.clear();
   for(const r of L||[]){S.rows.set(String(r.id),r);if(+r.ver>S.ver)S.ver=+r.ver}
   S.noSql=false;S.err=''}catch(e){if(DBS().bbs.noFn(e))S.noSql=true;else S.err=String((e&&e.message)||e)}
  S.lastPoll=Date.now();countUnread();if(S.open)draw()}
 function boardList(){const L=S.boards.filter(b=>b&&b.id);if(!L.some(b=>b.id==='free'))L.unshift({id:'free',name:'자유게시판',descr:'아무 이야기나',w:'gm',ord:0,virt:1});return L.sort((a,b)=>(+a.ord||0)-(+b.ord||0))}
 function countUnread(){const seen=+LS.get(seenKey(),0)||0;let n=0;const by={};for(const r of S.rows.values()){if(r.del||+r.ver<=seen)continue;if(r.w&&role()==='seat'&&r.w===ST().seat)continue;if(role()==='gm'&&r.w==='gm')continue;n++;by[r.board]=(by[r.board]||0)+1}S.unread=n;S.unreadBy=by;fab()}
 function markSeen(){LS.set(seenKey(),S.ver);countUnread()}

 /* ----- 아이콘 ----- */
 function fab(){let e=document.getElementById('bbsfab');const inRoom=!!room()&&!!document.getElementById('scene');
  if(!inRoom){if(e)e.hidden=true;return}
  if(!e){e=document.createElement('button');e.type='button';e.id='bbsfab';e.className='bbsfab';e.title='학교 게시판';e.setAttribute('aria-label','학교 게시판 열기');e.onclick=openBoard;document.body.appendChild(e)}
  e.hidden=false;e.innerHTML=`<span class="bbsfab-i" aria-hidden="true">✎</span><span class="bbsfab-t">게시판</span>${S.unread?`<b class="bbsfab-n">${S.unread>99?'99+':S.unread}</b>`:''}`}

 /* ----- 그리기 ----- */
 function avatar(who,anon){const u=anon&&!who.img?'':img(who.img);const ch=[...String(anon&&who.n==='익명'?'?':who.n||'?')][0];return `<i class="bbs-av ${u?'':'txt'}" style="${u?`background-image:url('${cssu(u)}')`:''}">${u?'':esc(ch)}</i>`}
 function nameOf(r){const who=r.who||{};if(r.anon){if(who.n&&who.n!=='익명')return `<b>익명</b><small class="bbs-real" title="GM · 쓴 사람에게만 보여요">${esc(who.n)}</small>`;return '<b>익명</b>'}return `<b>${esc(who.n||'?')}</b>`}
 function bodyHtml(t){return esc(t).replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g,'<br>')}
 function postHtml(r,kids){const who=r.who||{};const lk=Array.isArray(r.likes)?r.likes:[];const me=role()==='gm'?'gm':ST().seat;const liked=lk.includes(me);const open=S.open2.has(String(r.id));
  if(r.del)return `<article class="bbs-post del"><p class="bbs-gone">지운 글이에요</p>${kids.length?commentsHtml(r,kids,open):''}</article>`;
  return `<article class="bbs-post" data-pid="${r.id}">
   <header>${avatar(r.anon&&who.n!=='익명'?{n:'익명'}:who,r.anon)}<div class="bbs-nm">${nameOf(r)}<time>${esc(fmtT(r.at))}</time></div><span class="sp"></span>${mine(r.w)&&r.w?`<button type="button" class="bbs-x" data-bb="del" data-id="${r.id}" title="지우기" aria-label="지우기">✕</button>`:''}</header>
   ${r.body?`<div class="bbs-body">${bodyHtml(r.body)}</div>`:''}${img(r.img)?`<a class="bbs-img" href="${esc(r.img)}" target="_blank" rel="noopener"><img src="${esc(r.img)}" alt="" loading="lazy"></a>`:''}
   <footer><button type="button" class="bbs-act ${liked?'on':''}" data-bb="like" data-id="${r.id}" ${canWrite()?'':'disabled'} aria-pressed="${liked}">♥ <b>${lk.length}</b></button><button type="button" class="bbs-act ${open?'on':''}" data-bb="cm" data-id="${r.id}" aria-expanded="${open}">💬 <b>${kids.filter(k=>!k.del).length}</b></button></footer>
   ${open?commentsHtml(r,kids,true):''}</article>`}
 function commentsHtml(r,kids,open){if(!open)return '';const d=S.cdraft[r.id]||'';
  return `<div class="bbs-cms">${kids.map(c=>{const who=c.who||{};if(c.del)return '<div class="bbs-cm gone">지운 댓글</div>';return `<div class="bbs-cm">${avatar(c.anon&&who.n!=='익명'?{n:'익명'}:who,c.anon)}<div><div class="bbs-nm">${nameOf(c)}<time>${esc(fmtT(c.at))}</time>${mine(c.w)&&c.w?`<button type="button" class="bbs-x" data-bb="del" data-id="${c.id}" title="지우기" aria-label="댓글 지우기">✕</button>`:''}</div><div class="bbs-body">${bodyHtml(c.body)}</div></div></div>`}).join('')}
   ${canWrite()&&!r.del?`<form class="bbs-cform" data-cf="${r.id}"><input type="text" maxlength="1000" placeholder="댓글 달기" value="${esc(d)}" data-cin="${r.id}" aria-label="댓글"><label class="bbs-anon"><input type="checkbox" data-canon="${r.id}"> 익명</label><button type="submit" class="btn xs">달기</button></form>`:''}</div>`}
 function draw(){const md=S.md;if(!md||!document.body.contains(md)){S.open=false;return}
  const B=boardList();if(!B.some(b=>b.id===S.board))S.board=B[0].id;const cur=B.find(b=>b.id===S.board)||B[0];
  const rows=[...S.rows.values()].filter(r=>r.board===cur.id);const tops=rows.filter(r=>!r.parent).sort((a,b)=>+b.id-+a.id);const kidsOf=id=>rows.filter(r=>String(r.parent)===String(id)).sort((a,b)=>+a.id-+b.id);
  const au=curAuthor();const AL=authors();const canEditB=cur&&!cur.virt&&(role()==='gm'||(role()==='seat'&&cur.w===ST().seat));
  md.innerHTML=`<div class="mhead"><h2>학교 게시판</h2><span class="small dim">${esc(ST().roomRow&&ST().roomRow.name||'')}</span><span class="sp"></span><button type="button" class="btn ghost" data-bb="refresh" title="새로 받아 오기">↻</button><button type="button" class="btn ghost" data-x>닫기</button></div>
  ${S.noSql?`<p class="bbs-warn">${esc(noSqlMsg)}</p>`:''}${S.err?`<p class="bbs-warn">${esc(S.err)}</p>`:''}
  <div class="bbs-wrap">
   <nav class="bbs-boards" aria-label="게시판">${B.map(b=>`<button type="button" class="bbs-bd ${b.id===cur.id?'on':''} ${b.hidden?'hid':''}" data-bb="board" data-id="${esc(b.id)}"><span>${esc(b.name)}</span>${(S.unreadBy||{})[b.id]&&b.id!==cur.id?`<b class="bbs-dot" aria-label="새 글">${S.unreadBy[b.id]}</b>`:''}</button>`).join('')}
    ${canWrite()?`<button type="button" class="bbs-bd add" data-bb="newb">＋ 게시판 만들기</button>`:''}</nav>
   <section class="bbs-main">
    <div class="bbs-bhead"><div><h3>${esc(cur.name)}${cur.hidden?' <small class="dim">(숨김)</small>':''}</h3>${cur.descr?`<p class="small dim">${esc(cur.descr)}</p>`:''}</div><span class="sp"></span>${canEditB?`<button type="button" class="btn xs ghost" data-bb="editb">고치기</button>${role()==='gm'?`<button type="button" class="btn xs ghost" data-bb="hideb">${cur.hidden?'보이기':'숨기기'}</button>`:''}<button type="button" class="btn xs ghost danger" data-bb="delb">지우기</button>`:''}</div>
    ${canWrite()&&!S.noSql?`<form class="bbs-compose" data-bb-form="post">
     <div class="bbs-crow">${avatar(S.anon?{n:'익명'}:au||{},S.anon)}${AL.length>1?`<select data-bb-who aria-label="글쓴이">${AL.map(x=>`<option value="${esc(x.cid)}" ${au&&au.cid===x.cid?'selected':''}>${esc(x.n)}</option>`).join('')}</select>`:`<b>${esc(au?au.n:'?')}</b>`}<label class="bbs-anon"><input type="checkbox" data-bb-anon ${S.anon?'checked':''}> 익명</label></div>
     <textarea maxlength="4000" rows="3" placeholder="무슨 일이 있었나요?" data-bb-text aria-label="글">${esc(S.draft)}</textarea>
     ${S.imgUrl?`<div class="bbs-pimg"><img src="${esc(S.imgUrl)}" alt=""><button type="button" class="bbs-x" data-bb="noimg" aria-label="그림 빼기">✕</button></div>`:''}
     <div class="bbs-crow"><label class="btn xs ghost bbs-file">🖼 그림<input type="file" accept="image/*" data-bb-file hidden></label><span class="small dim">${S.anon?'남에게는 「익명」, GM 에게만 이름이 보여요':''}</span><span class="sp"></span><button type="submit" class="btn xs pri" ${S.busy?'disabled':''}>${S.busy?'올리는 중…':'올리기'}</button></div></form>`:(!canWrite()?'<p class="small dim">관전 중에는 읽기만 할 수 있어요.</p>':'')}
    <div class="bbs-feed">${tops.length?tops.map(r=>postHtml(r,kidsOf(r.id))).join(''):'<p class="bbs-empty">아직 글이 없어요. 첫 글을 올려 보세요.</p>'}</div>
   </section></div>`;
  md.querySelectorAll('[data-x]').forEach(b=>b.onclick=close)}

 /* ----- 동작 ----- */
 function notify(){try{DBS().broadcast({t:'bbs',room:room(),at:Date.now()})}catch(e){}}
 async function act(fn,okMsg){try{await fn();if(okMsg)A().toast(okMsg);notify();await pull()}catch(e){A().toast(DBS().bbs.noFn(e)?noSqlMsg:String((e&&e.message)||e))}}
 function onClick(e){const b=e.target.closest('[data-bb]');if(!b||!S.md||!S.md.contains(b))return;const k=b.dataset.bb,id=b.dataset.id;
  if(k==='board'){S.board=id;draw();return}
  if(k==='refresh'){pull(true);return}
  if(k==='like'){act(()=>DBS().bbs.like(room(),sec(),+id));return}
  if(k==='cm'){const s=String(id);if(S.open2.has(s))S.open2.delete(s);else S.open2.add(s);draw();const i=S.md.querySelector(`[data-cin="${s}"]`);if(i)i.focus();return}
  if(k==='del'){if(!confirm('이 글을 지울까요?'))return;act(()=>DBS().bbs.del(room(),sec(),+id),'지웠어요');return}
  if(k==='noimg'){S.imgUrl='';draw();return}
  if(k==='newb'||k==='editb'){const cur=boardList().find(x=>x.id===S.board)||{};const isNew=k==='newb';
   const nm=prompt(isNew?'새 게시판 이름 (30자까지)':'게시판 이름',isNew?'':cur.name||'');if(nm==null||!nm.trim())return;const ds=prompt('한 줄 설명 (비워도 돼요)',isNew?'':cur.descr||'');if(ds==null)return;
   const bid=isNew?'b'+Date.now().toString(36)+Math.random().toString(36).slice(2,5):cur.id;
   act(async()=>{await DBS().bbs.boardPut(room(),sec(),bid,{name:nm.trim().slice(0,30),descr:ds.slice(0,200),ord:isNew?boardList().length:cur.ord});S.board=bid;S.boards=[]},isNew?'게시판을 만들었어요':'고쳤어요');return}
  if(k==='hideb'){const cur=boardList().find(x=>x.id===S.board);if(!cur||cur.virt)return;act(async()=>{await DBS().bbs.boardPut(room(),sec(),cur.id,{name:cur.name,hidden:!cur.hidden});S.boards=[]});return}
  if(k==='delb'){const cur=boardList().find(x=>x.id===S.board);if(!cur||cur.virt)return;if(!confirm(`「${cur.name}」 게시판과 그 글을 모두 지울까요?`))return;act(async()=>{await DBS().bbs.boardPut(room(),sec(),cur.id,{del:true});S.board='free';S.boards=[]},'게시판을 지웠어요');return}}
 async function onSubmit(e){const f=e.target;if(!S.md||!S.md.contains(f))return;
  if(f.matches('[data-bb-form="post"]')){e.preventDefault();const t=String(S.draft||'').trim();if(!t&&!S.imgUrl)return;const au=curAuthor();if(!au)return;S.busy=true;draw();
   try{await DBS().bbs.post(room(),sec(),S.board,null,{n:au.n,img:img(au.img),cid:au.cid},S.anon,t,S.imgUrl);S.draft='';S.imgUrl='';notify()}catch(er){A().toast(DBS().bbs.noFn(er)?noSqlMsg:String((er&&er.message)||er))}
   S.busy=false;await pull();markSeen();return}
  if(f.matches('[data-cf]')){e.preventDefault();const pid=f.dataset.cf;const t=String(S.cdraft[pid]||'').trim();if(!t)return;const au=curAuthor();const an=!!(f.querySelector('[data-canon]')||{}).checked;
   try{await DBS().bbs.post(room(),sec(),S.board,+pid,{n:au.n,img:img(au.img),cid:au.cid},an,t,'');S.cdraft[pid]='';notify()}catch(er){A().toast(DBS().bbs.noFn(er)?noSqlMsg:String((er&&er.message)||er))}
   await pull();markSeen()}}
 function onInput(e){const t=e.target;if(!S.md||!S.md.contains(t))return;
  if(t.matches('[data-bb-text]'))S.draft=t.value;else if(t.matches('[data-cin]'))S.cdraft[t.dataset.cin]=t.value}
 async function onChange(e){const t=e.target;if(!S.md||!S.md.contains(t))return;
  if(t.matches('[data-bb-who]')){LS.set('om_bbs_who_'+room(),t.value);draw();return}
  if(t.matches('[data-bb-anon]')){S.anon=t.checked;draw();return}
  if(t.matches('[data-bb-file]')){const f=t.files&&t.files[0];t.value='';if(!f)return;if(f.size>15*1024*1024){A().toast('그림이 너무 커요 (15MB)');return}
   S.busy=true;draw();try{S.imgUrl=await DBS().uploadImage('bbs/'+room()+'/'+(ST().seat||'gm'),f)}catch(er){A().toast('그림을 올리지 못했어요: '+((er&&er.message)||er))}S.busy=false;draw()}}

 function openBoard(){if(!room())return;S.open=true;S.md=A().openModal('<div class="mhead"><h2>학교 게시판</h2><span class="sp"></span><button type="button" class="btn ghost" data-x>닫기</button></div><p class="small dim">불러오는 중…</p>');S.md.classList.add('bbsmodal');draw();pull(!S.rows.size).then(markSeen)}
 function close(){S.open=false;S.md=null;A().closeModal();markSeen()}
 function onEvent(p){if(!p||(p.room&&p.room!==room()))return;pull().then(()=>{if(S.open)markSeen()})}

 /* 방이 바뀌면 처음부터, 열려 있으면 20초 · 닫혀 있으면 90초마다 새 줄 */
 setInterval(()=>{if(!window.OM_APP||!window.OM_STORE)return;const r=room();if(r!==S.room){S.room=r;S.rows.clear();S.boards=[];S.ver=0;S.board='free';S.lastPoll=0}fab();if(!r)return;
  if(S.open&&(!S.md||!document.body.contains(S.md)))S.open=false;const gap=S.open?20000:90000;if(Date.now()-S.lastPoll>gap&&!S.noSql)pull()},2000);
 document.addEventListener('click',onClick);document.addEventListener('submit',onSubmit);document.addEventListener('input',onInput);document.addEventListener('change',onChange);
 return {openBoard,onEvent,pull}})();
