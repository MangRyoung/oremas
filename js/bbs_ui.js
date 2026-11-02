/* ---------- 학교 게시판 (2026-11-02 망령) ----------
   「웹툴 왼쪽 아래 빈 곳에 학교 게시판 아이콘 — SNS 처럼 가볍게 글 올리고 게시판도 팔 수 있게」
   · 방마다 따로. 저장은 방 상태 밖 om_bbs · om_bbs_board 표 (supabase/patch_2026-11-02_게시판.sql — SQL Editor 에서 한 번 실행)
   · 글쓴이 = 캐릭터 (좌석은 자기 트레이너, GM 은 GM · PC · 관계도 NPC 중에서). 글마다 「익명」을 고르면 남에게는 「익명」, GM 과 쓴 사람에게만 실제 이름
   · 누구나(방에 앉은 사람) 게시판을 만든다. 고치기 · 지우기는 GM 또는 만든 사람, 숨기기는 GM
   · 글 · 댓글 · 좋아요 · 그림 한 장. 새 글은 broadcast {t:'bbs'} 로 알리고, 열려 있으면 20초마다 · 닫혀 있으면 90초마다 새 줄만 받아 온다(ver)
   · 안 읽은 표시: 남이 쓴 줄 중 이 브라우저에서 본 ver 보다 뒤의 것 (localStorage om_bbs_seen_<방>)
   11-02 망령 「PC 들 휴대폰으로도 · 캠페인이 이어진 세션 노트에서도」: mount(칸, {env, who}) — 휴대폰 화면 안에 그린다.
     env = {key, room, secret, role, seat, api(om_bbs_* RPC), upload, toast, notify, authors, roomName} — 없으면 웹툴(OM_APP · OM_STORE) 값.
     세션 노트 휴대폰은 이 파일을 웹툴 주소에서 불러와 apiFromRpc(노트의 rpc) · 이어 둔 웹툴 방 · 이 브라우저의 웹툴 신분으로 쓴다. who = 휴대폰 주인(글쓴이 고정) */
"use strict";
window.OM_BBS_UI=(()=>{
 const A=()=>window.OM_APP,DBS=()=>window.OM_STORE,ST=()=>(window.OM_APP&&window.OM_APP.ST)||{};
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const $=(s,r)=>(r||document).querySelector(s);
 const img=u=>typeof u==='string'&&/^https?:\/\//.test(u)&&u.length<1000?u:'';
 /* 11-02: 세션 노트에는 전역 cssu 가 없다 (그림 있는 글쓴이에서 멈추던 원인) */
 const cssu=s=>String(s??'').replace(/[\s"'()\\<>]/g,c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0').toUpperCase());
 const LS={get:(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
 const S={rows:new Map(),boards:[],ver:0,board:'free',open:false,md:null,open2:new Set(),draft:'',anon:false,imgUrl:'',busy:false,err:'',noSql:false,cdraft:{},room:'',lastPoll:0,unread:0,env:null,who:null,embed:false,ekey:'',more:new Set(),pmore:false,pend:false};
 const isNoFn=e=>{const m=String((e&&(e.message||e.details||e.code))||'');return /PGRST202|Could not find the function|function .* does not exist/i.test(m)};
 /* om_bbs_* RPC 를 아무 rpc(fn,args) 함수로 */
 function apiFromRpc(rpc){return {noFn:isNoFn,boards:(r,s)=>rpc('om_bbs_boards',{p_room:r,p_secret:s||''}),
  boardPut:(r,s,id,o)=>rpc('om_bbs_board_put',{p_room:r,p_secret:s,p_id:id,p_name:o.name??null,p_descr:o.descr??null,p_hidden:o.hidden??null,p_ord:o.ord??null,p_del:!!o.del}),
  feed:(r,s,after)=>rpc('om_bbs_feed',{p_room:r,p_secret:s||'',p_after:after||0}),
  post:(r,s,board,parent,who,anon,body,im)=>rpc('om_bbs_post',{p_room:r,p_secret:s,p_board:board,p_parent:parent||null,p_who:who||{},p_anon:!!anon,p_body:body||'',p_img:im||''}),
  del:(r,s,id)=>rpc('om_bbs_del',{p_room:r,p_secret:s,p_id:id}),like:(r,s,id)=>rpc('om_bbs_like',{p_room:r,p_secret:s,p_id:id})}}
 /* 웹툴 기본 env */
 function omEnv(){return {key:'om',room:()=>ST().room||'',secret:()=>ST().secret||'',role:()=>ST().role||'view',seat:()=>ST().seat||'',api:()=>DBS().bbs,
  upload:f=>DBS().uploadImage('bbs/'+(ST().room||'')+'/'+(ST().seat||'gm'),f),toast:t=>A().toast(t),notify:()=>{try{DBS().broadcast({t:'bbs',room:ST().room,at:Date.now()})}catch(e){}},authors:omAuthors,roomName:()=>(ST().roomRow&&ST().roomRow.name)||''}}
 const E=()=>S.env||omEnv();
 const room=()=>E().room()||'';const sec=()=>E().secret()||'';const API=()=>E().api();const mySeat=()=>E().seat()||'';
 const role=()=>E().role()||'view';const canWrite=()=>role()==='gm'||role()==='seat';
 const mine=w=>role()==='gm'||(role()==='seat'&&w===mySeat());
 const seenKey=()=>'om_bbs_seen_'+room();
 const fmtT=t=>{if(!t)return '';const d=new Date(t);const now=Date.now();const s=(now-d)/1000;if(s<60)return '방금';if(s<3600)return Math.floor(s/60)+'분 전';if(s<86400)return Math.floor(s/3600)+'시간 전';const p=n=>String(n).padStart(2,'0');return `${d.getMonth()+1}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`};
 const noSqlMsg='게시판 표가 아직 없어요 — Supabase SQL Editor 에서 supabase/patch_2026-11-02_게시판.sql 을 한 번 실행해 주세요';

 /* ----- 글쓴이 (캐릭터) ----- */
 /* 글쓴이 목록 — {cid,n,img,sub,grp}. 좌석: 내 트레이너 + 내 포켓몬, GM: GM · PC · 포켓몬 · 관계도 NPC */
 function omAuthors(){const s=ST(),st=s.state||{};const T=((st.roster||{}).trainers)||{};const M=((st.roster||{}).mons)||{};const out=[];const P=(n,i)=>A().portraitOf(n,i);
  const monsOf=tid=>Object.values(M).filter(m=>m&&m.tid===tid&&m.name).map(m=>({cid:'pm:'+m.id,n:m.name,img:P(m.name,m.image),sub:'포켓몬 · '+((T[tid]||{}).name||''),grp:role()==='gm'?'포켓몬':'내 캐릭터'}));
  if(role()==='seat'){const t=T[s.seat];if(t)out.push({cid:t.id,n:t.name||'?',img:P(t.name,t.image),sub:'내 트레이너',grp:'내 캐릭터'},...monsOf(t.id));else out.push({cid:s.seat,n:s.name||'?',img:'',sub:'나',grp:'내 캐릭터'});return out}
  if(role()==='gm'){out.push({cid:'gm',n:'GM'+(s.gmNick?' · '+s.gmNick:''),img:'',sub:'운영 · 공지',grp:''});
   for(const t of Object.values(T))if(t&&t.name)out.push({cid:t.id,n:t.name,img:P(t.name,t.image),sub:t.kind==='npc'?'NPC 트레이너':'PC',grp:t.kind==='npc'?'NPC':'PC'});
   const KN={pc:'PC',npc:'NPC',org:'조직'};const N=((st.graph||{}).nodes)||{};const have=new Set(out.map(x=>x.n));for(const [id,n] of Object.entries(N)){if(!n||!n.name||have.has(n.name)||n.kind==='org')continue;have.add(n.name);out.push({cid:'n:'+id,n:n.name,img:P(n.name,n.img),sub:'관계도 '+(KN[n.kind]||'인물'),grp:'NPC'})}
   for(const t of Object.values(T))if(t&&t.name)out.push(...monsOf(t.id))}
  return out}
 function authors(){if(S.who)return [S.who];return (E().authors||(()=>[]))()}
 function curAuthor(){const L=authors();const k=LS.get('om_bbs_who_'+room(),'');return L.find(x=>x.cid===k)||L[0]||null}
 /* ----- 글쓴이 고르기 창 (웹툴 RP 화자 고르기처럼: 찾기 · 최근 · 묶음 · 초상) ----- */
 const RECK='om_bbs_recent',FOLDK='om_bbs_wfold';   /* 접어 둔 묶음(PC · NPC …)은 기억한다. 지금 고른 글쓴이가 든 묶음은 늘 펼쳐서 */
 function setAuthor(cid){LS.set('om_bbs_who_'+room(),cid);const r=(LS.get(RECK,[])||[]).filter(x=>x!==cid);r.unshift(cid);LS.set(RECK,r.slice(0,8));closeWho();draw()}
 function closeWho(){const p=document.querySelector('.bbs-wp');if(p){p.remove();document.removeEventListener('pointerdown',whoOut,true)}}
 function whoOut(e){const p=document.querySelector('.bbs-wp');if(!p)return;if(p.contains(e.target)||e.target.closest('[data-bb="who"]'))return;closeWho()}
 function openWho(anchor){if(document.querySelector('.bbs-wp')){closeWho();return}const L=authors();const cur=curAuthor();const by=new Map();
  const rec=(LS.get(RECK,[])||[]).map(c=>L.find(x=>x.cid===c)).filter(Boolean).filter(x=>x.cid!=='gm');
  const secs=[];const top=L.filter(x=>!x.grp);if(top.length)secs.push({n:'',L:top});if(rec.length&&L.length>6)secs.push({n:'🕘 최근',L:rec});const FD=new Set(LS.get(FOLDK,[])||[]);
  for(const x of L){if(!x.grp)continue;if(!by.has(x.grp))by.set(x.grp,[]);by.get(x.grp).push(x)}for(const [g,G] of by)secs.push({n:g,L:G});
  const it=x=>`<button type="button" class="bbs-wi ${cur&&cur.cid===x.cid?'on':''}" data-wcid="${esc(x.cid)}" data-q="${esc((x.n+' '+(x.sub||'')).toLowerCase())}">${avatar(x,false)}<span><b>${esc(x.n)}</b><small>${esc(x.sub||'')}</small></span></button>`;
  const p=document.createElement('div');p.className='bbs-wp';p.setAttribute('role','dialog');p.setAttribute('aria-label','글쓴이 고르기');
  p.innerHTML=`${L.length>8?'<div class="bbs-wq"><input type="search" placeholder="이름으로 찾기" autocomplete="off" aria-label="글쓴이 찾기"></div>':''}<div class="bbs-wb">${secs.map(s=>{const fd=!!s.n&&FD.has(s.n)&&!s.L.some(x=>cur&&x.cid===cur.cid);return `<div class="bbs-ws ${fd?'fold':''}">${s.n?`<button type="button" class="bbs-wh" data-wfold="${esc(s.n)}" aria-expanded="${!fd}"><i class="bbs-wcar" aria-hidden="true">▾</i>${esc(s.n)} <small>${s.L.length}</small></button>`:''}<div class="bbs-wg">${s.L.map(it).join('')}</div></div>`}).join('')}</div>`;
  document.body.appendChild(p);const r=anchor.getBoundingClientRect();const W=Math.min(420,innerWidth-16);p.style.width=W+'px';p.style.left=Math.max(8,Math.min(innerWidth-W-8,r.left))+'px';
  const below=innerHeight-r.bottom-10,above=r.top-10;const up=below<300&&above>below;p.style.maxHeight=Math.max(200,Math.min(520,up?above:below))+'px';if(up)p.style.bottom=(innerHeight-r.top+6)+'px';else p.style.top=(r.bottom+6)+'px';
  p.querySelectorAll('[data-wcid]').forEach(b=>b.onclick=()=>setAuthor(b.dataset.wcid));
  p.querySelectorAll('[data-wfold]').forEach(b=>b.onclick=()=>{const sec=b.parentNode;const f=!sec.classList.contains('fold');sec.classList.toggle('fold',f);b.setAttribute('aria-expanded',String(!f));const s=new Set(LS.get(FOLDK,[])||[]);if(f)s.add(b.dataset.wfold);else s.delete(b.dataset.wfold);LS.set(FOLDK,[...s])});
  const q=p.querySelector('input[type=search]');if(q){q.oninput=()=>{const v=q.value.trim().toLowerCase();p.classList.toggle('q',!!v);p.querySelectorAll('.bbs-ws').forEach(sec=>{let n=0;sec.querySelectorAll('[data-wcid]').forEach(b=>{const ok=!v||b.dataset.q.includes(v);b.style.display=ok?'':'none';if(ok)n++});sec.style.display=n?'':'none'})};if(matchMedia('(pointer:fine)').matches)setTimeout(()=>q.focus(),20)}
  p.addEventListener('keydown',e=>{if(e.key==='Escape'){closeWho();anchor.focus()}});setTimeout(()=>document.addEventListener('pointerdown',whoOut,true),0)}

 /* ----- 받아 오기 ----- */
 async function pull(full){if(!room())return;try{const ek=E().key+'|'+room();if(ek!==S.ekey){S.ekey=ek;S.rows.clear();S.boards=[];S.ver=0;full=true}
   if(full||!S.boards.length){const b=await API().boards(room(),sec());S.boards=b||[]}
   const L=await API().feed(room(),sec(),full?0:S.ver);if(full)S.rows.clear();
   for(const r of L||[]){S.rows.set(String(r.id),r);if(+r.ver>S.ver)S.ver=+r.ver}
   S.noSql=false;S.err=''}catch(e){if(API().noFn(e))S.noSql=true;else S.err=String((e&&e.message)||e)}
  S.lastPoll=Date.now();countUnread();redraw()}
 function boardList(){const L=S.boards.filter(b=>b&&b.id);if(!L.some(b=>b.id==='free'))L.unshift({id:'free',name:'자유게시판',descr:'아무 이야기나',w:'gm',ord:0,virt:1});return L.sort((a,b)=>(+a.ord||0)-(+b.ord||0))}
 function countUnread(){const seen=+LS.get(seenKey(),0)||0;let n=0;const by={};for(const r of S.rows.values()){if(r.del||+r.ver<=seen)continue;if(r.w&&role()==='seat'&&r.w===mySeat())continue;if(role()==='gm'&&r.w==='gm')continue;n++;by[r.board]=(by[r.board]||0)+1}S.unread=n;S.unreadBy=by;fab()}
 function markSeen(){LS.set(seenKey(),S.ver);countUnread()}

 /* ----- 아이콘: 채팅창 위 빈 줄(●●● · 시계 사이)에. 그 줄이 숨는 모바일은 채팅 버튼(🧹 📌 💾 ⚙) 맨 앞에 ----- */
 function fab(){if(!window.OM_APP)return;let e=document.getElementById('bbsfab');const inRoom=!!ST().room&&!!document.getElementById('scene');
  const pb=document.querySelector('.phone .pbar'),pl=document.querySelector('.phone .ptitle .plogs');const usePb=!!pb&&getComputedStyle(pb).display!=='none';const host=usePb?pb:pl;
  if(!inRoom||!host){if(e)e.remove();return}
  if(!e){e=document.createElement('button');e.type='button';e.id='bbsfab';e.title='학교 게시판';e.onclick=openBoard}
  const cls=usePb?'bbsfab':'btn xs ghost plog bbsfab-p';if(e.className!==cls)e.className=cls;
  if(usePb){const tm=pb.querySelector('.ptime');if(e.parentNode!==pb||e.nextSibling!==tm)pb.insertBefore(e,tm)}else if(e.parentNode!==pl||pl.firstChild!==e)pl.insertBefore(e,pl.firstChild);
  const n=S.unread;const h=`<span aria-hidden="true">📋</span><span class="plt bbsfab-t">${usePb?'':' '}학교 게시판</span>${n?`<b class="bbsfab-n">${n>99?'99+':n}</b>`:''}`;
  if(e._h!==h){e.innerHTML=h;e._h=h;e.setAttribute('aria-label','학교 게시판 열기'+(n?` (새 글 ${n})`:''))}}

 /* ----- 그리기 ----- */
 function avatar(who,anon){const u=anon&&!who.img?'':img(who.img);const ch=[...String(anon&&who.n==='익명'?'?':who.n||'?')][0];return `<i class="bbs-av ${u?'':'txt'}" style="${u?`background-image:url('${cssu(u)}')`:''}">${u?'':esc(ch)}</i>`}
 function nameOf(r){const who=r.who||{};if(r.anon){if(who.n&&who.n!=='익명')return `<b>익명</b><small class="bbs-real" title="GM · 쓴 사람에게만 보여요">${esc(who.n)}</small>`;return '<b>익명</b>'}return `<b>${esc(who.n||'?')}</b>`}
 function bodyHtml(t){return esc(t).replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g,'<br>')}
 function postHtml(r,kids){const who=r.who||{};const lk=Array.isArray(r.likes)?r.likes:[];const me=role()==='gm'?'gm':mySeat();const liked=lk.includes(me);const open=S.open2.has(String(r.id));
  if(r.del)return `<article class="bbs-post del"><p class="bbs-gone">지운 글이에요</p>${kids.length?commentsHtml(r,kids,open):''}</article>`;
  return `<article class="bbs-post" data-pid="${r.id}">
   <header>${avatar(r.anon&&who.n!=='익명'?{n:'익명'}:who,r.anon)}<div class="bbs-nm">${nameOf(r)}<time>${esc(fmtT(r.at))}</time></div><span class="sp"></span>${mine(r.w)&&r.w?`<button type="button" class="bbs-x" data-bb="del" data-id="${r.id}" title="지우기" aria-label="지우기">✕</button>`:''}</header>
   ${r.body?`<div class="bbs-body">${bodyHtml(r.body)}</div>`:''}${img(r.img)?`<a class="bbs-img" href="${esc(r.img)}" target="_blank" rel="noopener"><img src="${esc(r.img)}" alt="" loading="lazy"></a>`:''}
   <footer><button type="button" class="bbs-act ${liked?'on':''}" data-bb="like" data-id="${r.id}" ${canWrite()?'':'disabled'} aria-pressed="${liked}">♥ <b>${lk.length}</b></button><button type="button" class="bbs-act ${open?'on':''}" data-bb="cm" data-id="${r.id}" aria-expanded="${open}">💬 <b>${kids.filter(k=>!k.del).length}</b></button></footer>
   ${open?commentsHtml(r,kids,true):''}</article>`}
 function commentsHtml(r,kids,open){if(!open)return '';const d=S.cdraft[r.id]||'';
  return `<div class="bbs-cms">${kids.map(c=>{const who=c.who||{};if(c.del)return '<div class="bbs-cm gone">지운 댓글</div>';return `<div class="bbs-cm">${avatar(c.anon&&who.n!=='익명'?{n:'익명'}:who,c.anon)}<div><div class="bbs-nm">${nameOf(c)}<time>${esc(fmtT(c.at))}</time>${mine(c.w)&&c.w?`<button type="button" class="bbs-x" data-bb="del" data-id="${c.id}" title="지우기" aria-label="댓글 지우기">✕</button>`:''}</div><div class="bbs-body">${bodyHtml(c.body)}</div></div></div>`}).join('')}
   ${canWrite()&&!r.del?`<form class="bbs-cform" data-cf="${r.id}"><input type="text" maxlength="1000" placeholder="댓글 달기" value="${esc(d)}" data-cin="${r.id}" aria-label="댓글"><label class="bbs-anon"><input type="checkbox" data-canon="${r.id}"> 익명</label><button type="submit" class="btn xs">달기</button></form>`:''}</div>`}
 /* ----- 11-02 망령 「게시판 창 양쪽으로 — 왼쪽은 휴대폰처럼(내 입력칸 · 연락처), 오른쪽은 게시물. 6개쯤 보이고 그 뒤는 접어서」 -----
   웹툴 창(embed 아님)만 두 칸. 휴대폰 · 세션 노트 안은 한 줄 그대로(접기만 같이). 휴대폰 앱 · 연락처는 OM_PHONE_UI(bookFor · openFor) */
 const FOLD=6;
 const typing=()=>{const a=document.activeElement;return !!(S.md&&a&&S.md.contains(a)&&a.matches('input[type=text],input[type=search],textarea'))};
 function redraw(){if(!S.open)return;if(typing()){S.pend=true;return}S.pend=false;draw()}
 function myCids(){const au=curAuthor();if(role()==='seat')return new Set(authors().map(x=>x.cid));return new Set(au?[au.cid]:[])}
 /* 휴대폰 주인: 좌석은 내 트레이너, GM 은 지금 글쓴이(포켓몬이면 그 트레이너, 관계도 인물은 n:id, GM 은 없음) */
 function phoneTid(au){if(role()==='seat')return mySeat();const c=(au&&au.cid)||'';if(!c||c==='gm')return '';if(c.startsWith('pm:')){const m=((((ST().state||{}).roster||{}).mons)||{})[c.slice(3)];return (m&&m.tid)||''}return c}
 const PHONE=()=>!S.embed&&window.OM_APP&&window.OM_PHONE_UI&&window.OM_PHONE_UI.openFor?window.OM_PHONE_UI:null;
 function composeHtml(au,AL,cur){if(!canWrite())return '<p class="small dim">관전 중에는 읽기만 할 수 있어요.</p>';if(S.noSql)return '';const split=!S.embed;
  const whoRow=split?'':`<div class="bbs-crow">${avatar(S.anon?{n:'익명'}:au||{},S.anon)}${AL.length>1?`<button type="button" class="bbs-who" data-bb="who" aria-haspopup="dialog" title="글쓴이 고르기"><span><b>${esc(au?au.n:'?')}</b><small>${esc(au&&au.sub||'')}</small></span><span class="bbs-car" aria-hidden="true">▾</span></button>`:`<span class="bbs-whos"><b>${esc(au?au.n:'?')}</b>${au&&au.sub?`<small>${esc(au.sub)}</small>`:''}</span>`}<label class="bbs-anon"><input type="checkbox" data-bb-anon ${S.anon?'checked':''}> 익명</label></div>`;
  return `<form class="bbs-compose" data-bb-form="post">${whoRow}${split?`<div class="bbs-to"><span>📋 <b>${esc(cur.name)}</b>에 올려요</span><span class="sp"></span><label class="bbs-sw" title="남에게는 「익명」, GM 에게만 이름이 보여요"><input type="checkbox" data-bb-anon ${S.anon?'checked':''}><i aria-hidden="true"></i>익명</label></div>`:''}
     <textarea maxlength="4000" rows="3" placeholder="${split?'오늘 학교에서 무슨 일이 있었나요?':'무슨 일이 있었나요?'}" data-bb-text aria-label="글">${esc(S.draft)}</textarea>
     ${S.imgUrl?`<div class="bbs-pimg"><img src="${esc(S.imgUrl)}" alt=""><button type="button" class="bbs-x" data-bb="noimg" aria-label="그림 빼기">✕</button></div>`:''}
     <div class="bbs-crow"><label class="btn xs ghost bbs-file">🖼 그림<input type="file" accept="image/*" data-bb-file hidden></label>${split?'':`<span class="small dim">${S.anon?'남에게는 「익명」, GM 에게만 이름이 보여요':'그림은 여기로 끌어다 놓거나 Ctrl+V 로 붙여 넣어도 돼요'}</span>`}<span class="sp"></span><button type="submit" class="btn xs pri" ${S.busy?'disabled':''}>${S.busy?'올리는 중…':'올리기'}</button></div>
     ${split?`<p class="bbs-hint">${S.anon?'남에게는 「익명」, GM 과 나에게만 이름이 보여요':'그림은 끌어다 놓거나 Ctrl+V 로 붙여 넣어도 돼요'}</p>`:''}</form>`}
 /* 오른쪽(또는 한 줄) 글 목록: 앞 6개 + 「이전 글 N개 더 보기」 */
 function feedHtml(cur,tops,kidsOf){const open=S.more.has(cur.id);const rest=tops.length-FOLD;const L=open||rest<=0?tops:tops.slice(0,FOLD);
  return `<div class="bbs-feed">${tops.length?L.map(r=>postHtml(r,kidsOf(r.id))).join(''):'<p class="bbs-empty">아직 글이 없어요. 첫 글을 올려 보세요.</p>'}</div>
   ${rest>0?`<button type="button" class="bbs-more ${open?'on':''}" data-bb="more" aria-expanded="${open}">${open?'▴ 접기 — 최근 6개만 보기':`▾ 이전 글 ${rest}개 더 보기`}</button>`:''}`}
 /* 왼쪽 휴대폰 칸 */
 function phoneHtml(au,AL,cur){const all=[...S.rows.values()].filter(r=>!r.del);const me=myCids();const mineR=all.filter(r=>r.who&&me.has(r.who.cid));
  const nPost=mineR.filter(r=>!r.parent).length,nCm=mineR.filter(r=>r.parent).length,nLike=mineR.reduce((a,r)=>a+(Array.isArray(r.likes)?r.likes.length:0),0);
  const myPost=new Map(all.filter(r=>!r.parent&&r.who&&me.has(r.who.cid)).map(r=>[String(r.id),r]));
  const noti=all.filter(r=>r.parent&&myPost.has(String(r.parent))&&!(r.who&&me.has(r.who.cid))).sort((a,b)=>+b.id-+a.id).slice(0,5);
  const BN=Object.fromEntries(boardList().map(b=>[b.id,b.name]));
  const cal=((ST().state||{}).calendar)||{};const when=[cal.today?(()=>{const d=new Date(cal.today+'T00:00:00');return isNaN(d)?cal.today:`${d.getMonth()+1}월 ${d.getDate()}일 ${'일월화수목금토'[d.getDay()]}요일`})():'',cal.phase||''].filter(Boolean).join(' · ');
  const P=PHONE();const tid=phoneTid(au);let book=[];if(P&&tid&&P.bookFor)try{book=P.bookFor(tid)||[]}catch(e){book=[]}
  const un=P&&role()==='seat'&&P.unreadAll?(()=>{try{return P.unreadAll()}catch(e){return 0}})():0;
  const apps=[['contacts','📞','연락처'],['sms','💬','문자',un],['sns','📸','SNS'],['cal','📅','캘린더'],['notes','📝','메모장'],['home','📱','휴대폰']];
  const prof=`${avatar(S.anon?{n:'익명'}:au||{},S.anon)}<span class="bbs-pmi"><b>${esc(S.anon?'익명':au?au.n:'?')}</b><small>${esc(S.anon?(au?au.n+' (GM · 나만 알아요)':''):(au&&au.sub)||'')}</small><small class="bbs-pstat">글 ${nPost} · 댓글 ${nCm} · ♥ ${nLike}</small></span>`;
  return `<aside class="bbs-phone ${S.pmore?'more':''}" aria-label="내 휴대폰">
   <div class="bbs-pst"><span>${esc(when||'학교 게시판')}</span><span class="sp"></span><span class="bbs-bat" aria-hidden="true">▮▮▮</span></div>
   ${canWrite()&&AL.length>1?`<button type="button" class="bbs-pme" data-bb="who" aria-haspopup="dialog" title="글쓴이 고르기">${prof}<span class="bbs-pch">바꾸기 ▾</span></button>`:`<div class="bbs-pme">${prof}</div>`}
   ${composeHtml(au,AL,cur)}
   ${P||noti.length?`<button type="button" class="bbs-pmorebtn" data-bb="pmore" aria-expanded="${!!S.pmore}">${S.pmore?'▴ 휴대폰 접기':'▾ 휴대폰 — 앱 · 알림 · 연락처'}${noti.length?` <em class="bbs-dot">${noti.length}</em>`:''}</button>`:''}
   <div class="bbs-pextra">
    ${P?`<div class="bbs-apps">${apps.map(([k,ic,n,bd])=>`<button type="button" class="bbs-app" data-bb="app" data-scr="${k}" ${tid||k==='home'?'':'disabled title="GM 이름으로는 휴대폰이 없어요 — 글쓴이를 사람으로 바꿔 주세요"'}><i>${ic}${bd?`<em class="bbs-dot">${bd>99?'99+':bd}</em>`:''}</i><span>${n}</span></button>`).join('')}</div>`:''}
    <div class="bbs-psec">내 글 반응 <span class="sp"></span><small>${noti.length?'최근 댓글':''}</small></div>
    <div class="bbs-plist">${noti.length?noti.map(c=>{const p=myPost.get(String(c.parent));const w=c.anon?{n:'익명'}:c.who||{};return `<button type="button" class="bbs-pit" data-bb="goto" data-id="${p.id}">${avatar(w,c.anon)}<span class="bbs-pit-t"><b>${esc(c.anon?'익명':w.n||'?')} <small>· ${esc(BN[p.board]||'')}</small></b><small>${esc(String(c.body||'').slice(0,60))}</small></span><time>${esc(fmtT(c.at))}</time></button>`}).join(''):`<p class="bbs-pempty">${nPost?'아직 내 글에 달린 댓글이 없어요':'글을 올리면 달린 댓글이 여기 모여요'}</p>`}</div>
    ${P&&tid?`<div class="bbs-psec">연락처 <span class="sp"></span><button type="button" class="bbs-plink" data-bb="app" data-scr="contacts">모두 보기 ›</button></div>
    <div class="bbs-plist">${book.length?book.slice(0,8).map(c=>`<button type="button" class="bbs-pit" data-bb="dm" data-cid="${esc(c.cid)}" title="${esc(c.n)}에게 문자">${avatar({n:c.n,img:c.img},false)}<span class="bbs-pit-t"><b>${esc(c.n)}</b><small>${esc(c.sub||'')}</small></span><span class="bbs-pdm" aria-hidden="true">💬</span></button>`).join('')+(book.length>8?`<p class="bbs-pempty">… ${book.length-8}명 더 — 「모두 보기」</p>`:''):'<p class="bbs-pempty">아직 연락처가 없어요 — 휴대폰 「연락처」에서 건네거나 넣어 주세요</p>'}</div>`:''}
   </div></aside>`}
 function draw(){const md=S.md;if(!md||!document.body.contains(md)){S.open=false;return}
  const B=boardList();if(!B.some(b=>b.id===S.board))S.board=B[0].id;const cur=B.find(b=>b.id===S.board)||B[0];
  const rows=[...S.rows.values()].filter(r=>r.board===cur.id);const tops=rows.filter(r=>!r.parent).sort((a,b)=>+b.id-+a.id);const kidsOf=id=>rows.filter(r=>String(r.parent)===String(id)).sort((a,b)=>+a.id-+b.id);
  const au=curAuthor();const AL=authors();const canEditB=cur&&!cur.virt&&(role()==='gm'||(role()==='seat'&&cur.w===mySeat()));const split=!S.embed;
  const boardsNav=`<nav class="bbs-boards" aria-label="게시판">${B.map(b=>`<button type="button" class="bbs-bd ${b.id===cur.id?'on':''} ${b.hidden?'hid':''}" data-bb="board" data-id="${esc(b.id)}" aria-pressed="${b.id===cur.id}"><span>${esc(b.name)}</span>${(S.unreadBy||{})[b.id]&&b.id!==cur.id?`<b class="bbs-dot" aria-label="새 글">${S.unreadBy[b.id]}</b>`:''}</button>`).join('')}
    ${canWrite()?`<button type="button" class="bbs-bd add" data-bb="newb">＋ 게시판 만들기</button>`:''}</nav>`;
  const bhead=`<div class="bbs-bhead"><div><h3>${esc(cur.name)}${cur.hidden?' <small class="dim">(숨김)</small>':''} <small class="bbs-cnt">${tops.length}</small></h3>${cur.descr?`<p class="small dim">${esc(cur.descr)}</p>`:''}</div><span class="sp"></span>${canEditB?`<button type="button" class="btn xs ghost" data-bb="editb">고치기</button>${role()==='gm'?`<button type="button" class="btn xs ghost" data-bb="hideb">${cur.hidden?'보이기':'숨기기'}</button>`:''}<button type="button" class="btn xs ghost danger" data-bb="delb">지우기</button>`:''}</div>`;
  md.classList.toggle('bbs-embed',!!S.embed&&S.compact!==false);md.classList.toggle('bbs-in',!!S.embed);md.classList.toggle('bbs-split',split);
  md.innerHTML=`${S.embed?`<div class="bbs-ehead">${S.compact===false?'':'<b>학교 게시판</b>'}<small>${esc((E().roomName||(()=>''))())}</small><span class="sp"></span><button type="button" class="btn xs ghost" data-bb="refresh" title="새로 받아 오기">↻</button></div>`:`<div class="mhead"><h2>학교 게시판</h2><span class="small dim">${esc((E().roomName||(()=>''))())}</span><span class="sp"></span><button type="button" class="btn ghost" data-bb="refresh" title="새로 받아 오기">↻</button><button type="button" class="btn ghost" data-x>닫기</button></div>`}
  ${S.noSql?`<p class="bbs-warn">${esc(noSqlMsg)}</p>`:''}${S.err?`<p class="bbs-warn">${esc(S.err)}</p>`:''}
  ${split?`<div class="bbs-split2">${phoneHtml(au,AL,cur)}<section class="bbs-main bbs-right">${boardsNav}${bhead}${feedHtml(cur,tops,kidsOf)}</section></div>`
  :`<div class="bbs-wrap">${boardsNav}<section class="bbs-main">${bhead}${composeHtml(au,AL,cur)}${feedHtml(cur,tops,kidsOf)}</section></div>`}`;
  if(!S.embed)md.querySelectorAll('[data-x]').forEach(b=>b.onclick=close)}

 /* ----- 동작 ----- */
 function notify(){try{(E().notify||(()=>{}))()}catch(e){}}
 const toast=t=>{try{E().toast(t)}catch(e){}};
 async function act(fn,okMsg){try{await fn();if(okMsg)toast(okMsg);notify();await pull()}catch(e){toast(API().noFn(e)?noSqlMsg:String((e&&e.message)||e))}}
 function onClick(e){const b=e.target.closest('[data-bb]');if(!b||!S.md||!S.md.contains(b))return;const k=b.dataset.bb,id=b.dataset.id;
  if(k==='who'){openWho(b);return}
  if(k==='board'){S.board=id;draw();const r=S.md.querySelector('.bbs-right');if(r)r.scrollTop=0;return}
  if(k==='more'){const bd=S.board;const was=S.more.has(bd);if(was)S.more.delete(bd);else S.more.add(bd);draw();if(was){const r=S.md.querySelector('.bbs-right');const m=S.md.querySelector('.bbs-more');if(m)m.scrollIntoView({block:'nearest'});else if(r)r.scrollTop=0}return}
  if(k==='pmore'){S.pmore=!S.pmore;draw();return}
  if(k==='goto'){const r=S.rows.get(String(id));if(!r)return;S.board=r.board;S.open2.add(String(r.id));const tops=[...S.rows.values()].filter(x=>x.board===r.board&&!x.parent).sort((a,b)=>+b.id-+a.id);if(tops.findIndex(x=>String(x.id)===String(r.id))>=FOLD)S.more.add(r.board);draw();
   const el=S.md.querySelector(`.bbs-post[data-pid="${r.id}"]`);if(el){el.scrollIntoView({block:'center',behavior:'smooth'});el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),1600)}return}
  if(k==='app'||k==='dm'){const P=PHONE();if(!P)return;const tid=phoneTid(curAuthor());const scr=b.dataset.scr||'home';const cid=k==='dm'?b.dataset.cid:'';close();P.openFor(tid,scr,cid);return}
  if(k==='refresh'){pull(true);return}
  if(k==='like'){act(()=>API().like(room(),sec(),+id));return}
  if(k==='cm'){const s=String(id);if(S.open2.has(s))S.open2.delete(s);else S.open2.add(s);draw();const i=S.md.querySelector(`[data-cin="${s}"]`);if(i)i.focus();return}
  if(k==='del'){if(!confirm('이 글을 지울까요?'))return;act(()=>API().del(room(),sec(),+id),'지웠어요');return}
  if(k==='noimg'){S.imgUrl='';draw();return}
  if(k==='newb'||k==='editb'){const cur=boardList().find(x=>x.id===S.board)||{};const isNew=k==='newb';
   const nm=prompt(isNew?'새 게시판 이름 (30자까지)':'게시판 이름',isNew?'':cur.name||'');if(nm==null||!nm.trim())return;const ds=prompt('한 줄 설명 (비워도 돼요)',isNew?'':cur.descr||'');if(ds==null)return;
   const bid=isNew?'b'+Date.now().toString(36)+Math.random().toString(36).slice(2,5):cur.id;
   act(async()=>{await API().boardPut(room(),sec(),bid,{name:nm.trim().slice(0,30),descr:ds.slice(0,200),ord:isNew?boardList().length:cur.ord});S.board=bid;S.boards=[]},isNew?'게시판을 만들었어요':'고쳤어요');return}
  if(k==='hideb'){const cur=boardList().find(x=>x.id===S.board);if(!cur||cur.virt)return;act(async()=>{await API().boardPut(room(),sec(),cur.id,{name:cur.name,hidden:!cur.hidden});S.boards=[]});return}
  if(k==='delb'){const cur=boardList().find(x=>x.id===S.board);if(!cur||cur.virt)return;if(!confirm(`「${cur.name}」 게시판과 그 글을 모두 지울까요?`))return;act(async()=>{await API().boardPut(room(),sec(),cur.id,{del:true});S.board='free';S.boards=[]},'게시판을 지웠어요');return}}
 async function onSubmit(e){const f=e.target;if(!S.md||!S.md.contains(f))return;
  if(f.matches('[data-bb-form="post"]')){e.preventDefault();const t=String(S.draft||'').trim();if(!t&&!S.imgUrl)return;const au=curAuthor();if(!au)return;S.busy=true;draw();
   try{await API().post(room(),sec(),S.board,null,{n:au.n,img:img(au.img),cid:au.cid},S.anon,t,S.imgUrl);S.draft='';S.imgUrl='';notify()}catch(er){toast(API().noFn(er)?noSqlMsg:String((er&&er.message)||er))}
   S.busy=false;await pull();markSeen();return}
  if(f.matches('[data-cf]')){e.preventDefault();const pid=f.dataset.cf;const t=String(S.cdraft[pid]||'').trim();if(!t)return;const au=curAuthor();const an=!!(f.querySelector('[data-canon]')||{}).checked;
   try{await API().post(room(),sec(),S.board,+pid,{n:au.n,img:img(au.img),cid:au.cid},an,t,'');S.cdraft[pid]='';notify()}catch(er){toast(API().noFn(er)?noSqlMsg:String((er&&er.message)||er))}
   await pull();markSeen()}}
 function onInput(e){const t=e.target;if(!S.md||!S.md.contains(t))return;
  if(t.matches('[data-bb-text]'))S.draft=t.value;else if(t.matches('[data-cin]'))S.cdraft[t.dataset.cin]=t.value}
 async function onChange(e){const t=e.target;if(!S.md||!S.md.contains(t))return;
  if(t.matches('[data-bb-who]')){LS.set('om_bbs_who_'+room(),t.value);draw();return}
  if(t.matches('[data-bb-anon]')){S.anon=t.checked;draw();return}
  if(t.matches('[data-bb-file]')){const f=t.files&&t.files[0];t.value='';upImg(f)}}
 async function upImg(f){if(!f||S.busy)return;if(!/^image\//.test(f.type||'')){toast('그림 파일만 올릴 수 있어요');return}if(f.size>15*1024*1024){toast('그림이 너무 커요 (15MB)');return}
  S.busy=true;draw();try{S.imgUrl=await E().upload(f)}catch(er){toast('그림을 올리지 못했어요: '+((er&&er.message)||er))}S.busy=false;draw()}
 /* 끌어다 놓기 · 붙여 넣기: 게시판 창 어디에 놓아도 글쓰기 칸의 그림이 된다 (파일 · 다른 웹 페이지의 그림 주소) */
 function dropForm(t){if(!S.open||!S.md||!t||!t.closest||!S.md.contains(t)||!canWrite()||S.noSql)return null;return S.md.querySelector('[data-bb-form="post"]')}
 const dtHas=e=>{const T=[...((e.dataTransfer||{}).types||[])];return T.includes('Files')||T.includes('text/uri-list')};
 let dragT=0;function dragOff(){const f=S.md&&S.md.querySelector('.bbs-compose.drag');if(f)f.classList.remove('drag')}
 function onDragOver(e){const f=dropForm(e.target);if(!f||!dtHas(e))return;e.preventDefault();e.dataTransfer.dropEffect='copy';f.classList.add('drag');clearTimeout(dragT);dragT=setTimeout(dragOff,180)}
 function onDrop(e){const f=dropForm(e.target);if(!f||!dtHas(e))return;e.preventDefault();dragOff();const dt=e.dataTransfer;const file=[...(dt.files||[])].find(x=>/^image\//.test(x.type||''));
  if(file){upImg(file);return}if((dt.files||[]).length){toast('그림 파일만 올릴 수 있어요');return}
  const u=img(String(dt.getData('text/uri-list')||dt.getData('text/plain')||'').split(/\r?\n/).find(x=>x&&x[0]!=='#')||'');if(u){S.imgUrl=u;draw()}else toast('그림을 알아보지 못했어요 — 파일로 저장해서 놓아 주세요')}
 function onPaste(e){if(!dropForm(e.target))return;const it=[...((e.clipboardData||{}).items||[])].find(x=>x.kind==='file'&&/^image\//.test(x.type));if(!it)return;e.preventDefault();upImg(it.getAsFile())}

 function mount(el,o){o=o||{};S.env=o.env||null;S.who=o.who||null;S.embed=true;S.compact=o.compact!==false;closeWho();S.md=el;S.open=true;draw();if(Date.now()-S.lastPoll>3000||(S.env&&S.env.key)+'|'+room()!==S.ekey)pull().then(markSeen);else markSeen()}
 function openBoard(){S.env=null;S.who=null;S.embed=false;S.compact=true;closeWho();if(!room())return;S.open=true;S.md=A().openModal('<div class="mhead"><h2>학교 게시판</h2><span class="sp"></span><button type="button" class="btn ghost" data-x>닫기</button></div><p class="small dim">불러오는 중…</p>');S.md.classList.add('bbsmodal');draw();pull(!S.rows.size).then(markSeen)}
 function close(){closeWho();S.open=false;S.md=null;if(window.OM_APP)A().closeModal();markSeen()}
 function onEvent(p){if(!p||(p.room&&p.room!==room()))return;pull().then(()=>{if(S.open)markSeen()})}

 /* 열려 있으면 20초 · 닫혀 있으면(웹툴만) 90초마다 새 줄. 닫히면 웹툴 기본 env 로 돌아간다 */
 setInterval(()=>{if(S.open&&(!S.md||!document.body.contains(S.md)))S.open=false;
  if(!S.open&&S.env){S.env=null;S.who=null;S.embed=false}
  if(window.OM_APP&&window.OM_STORE)fab();if(!room())return;
  const gap=S.open?20000:(window.OM_APP?90000:0);if(gap&&Date.now()-S.lastPoll>gap&&!S.noSql)pull()},2000);
 document.addEventListener('click',onClick);document.addEventListener('submit',onSubmit);document.addEventListener('input',onInput);document.addEventListener('change',onChange);document.addEventListener('dragover',onDragOver);document.addEventListener('drop',onDrop);document.addEventListener('paste',onPaste);
 /* 글 쓰는 중에 새 글이 와도 칸을 다시 그리지 않는다 (쓰던 칸이 풀리던 것) — 칸을 떠나면 그때 */
 document.addEventListener('focusout',e=>{if(!S.pend||!S.md||!S.md.contains(e.target))return;setTimeout(()=>{if(S.pend&&!typing())redraw()},0)});
 return {V:6,openBoard,mount,onEvent,pull,apiFromRpc,unread:()=>S.unread}})();   /* V: 세션 노트가 이보다 옛 것을 들고 있으면 다시 불러온다 */
