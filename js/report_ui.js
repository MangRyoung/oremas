/* ---------- 건의 · 제보 탭 ----------
   개선 건의와 배틀 중 오류를 방 데이터에 남겨 GM 과 플레이어가 같이 본다. 「복사」로 반디(클로드)에게 그대로 붙여 넣는다.
   좌석이 쓴 것 = state.pub[seat].reports[id]   (좌석은 자기 pub 만 쓸 수 있다)
   GM 이 쓴 것  = state.reports[id]
   한 건 = {id, k:'bug'|'idea', title, body, by, seat, at, ed, ctx:{view,battle,log,err,ua,v}, cm:[{t,by,at}]}
   GM 처리     = state.reportsMeta[id] = {st:'new'|'ack'|'done'|'hold', cm:[{t,by,at}], at}   (gmHands=false 방에서도 GM 이 쓸 수 있게 따로 둔다)
   오류는 이 파일이 뜬 뒤부터 window.onerror · unhandledrejection · console.error/warn · 토스트를 30개까지 모아 둔다. */
"use strict";
window.OM_REPORT_UI=(()=>{
 const A=()=>window.OM_APP;
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const $=(s,r)=>(r||document).querySelector(s);
 const rnd=n=>{const a=new Uint8Array(n||6);crypto.getRandomValues(a);return Array.from(a,b=>'abcdefghijklmnopqrstuvwxyz0123456789'[b%36]).join('')};
 const KINDS={bug:['🐞','버그 · 오류'],idea:['💡','건의 · 개선']};
 const STS={new:['접수','#8a8a8a'],ack:['확인 중','var(--yel)'],done:['해결','var(--ok)'],hold:['보류','var(--blue)']};
 const VIEWN={rp:'RP',battle:'배틀',sheet:'시트',graph:'관계도',calendar:'캘린더'};
 const PHASES={0:'지시 준비',1:'턴 개시·공개',2:'행동 순서',3:'행동 처리',5:'턴 종료'};

 /* ----- 오류 모으기 ----- */
 const ERR=[];
 const cut=(s,n)=>{s=String(s??'');return s.length>n?s.slice(0,n)+'…':s};
 function note(kind,msg){try{const t=cut(msg,400).trim();if(!t)return;const last=ERR[ERR.length-1];if(last&&last.t===t&&last.k===kind){last.n=(last.n||1)+1;last.at=Date.now();return}ERR.push({k:kind,t,at:Date.now()});if(ERR.length>30)ERR.shift()}catch(e){}}
 const argStr=a=>Array.from(a,x=>x instanceof Error?(x.message+(x.stack?' @ '+String(x.stack).split('\n').slice(1,3).map(s=>s.trim()).join(' / '):'')):typeof x==='object'?(()=>{try{return JSON.stringify(x)}catch(e){return String(x)}})():String(x)).join(' ');
 window.addEventListener('error',e=>note('error',(e.message||'오류')+(e.filename?` (${String(e.filename).split('/').pop().split('?')[0]}:${e.lineno||0})`:'')));
 window.addEventListener('unhandledrejection',e=>{const r=e.reason;note('promise',r instanceof Error?argStr([r]):String(r))});
 for(const lv of ['error','warn']){const o=console[lv];if(typeof o!=='function')continue;console[lv]=function(...a){note(lv,argStr(a));return o.apply(this,a)}}

 /* ----- 데이터 ----- */
 const ST=()=>A().ST;
 const gm=()=>ST().role==='gm';
 const mine=r=>(gm()&&r.seat==='gm')||(ST().role==='seat'&&r.seat===ST().seat);
 function all(){const s=ST().state||{};const out=[];
  for(const [id,r] of Object.entries(s.reports||{}))if(r&&typeof r==='object')out.push(Object.assign({},r,{id,seat:'gm'}));
  for(const [seat,p] of Object.entries(s.pub||{}))for(const [id,r] of Object.entries((p&&p.reports)||{}))if(r&&typeof r==='object')out.push(Object.assign({},r,{id,seat}));
  const meta=s.reportsMeta||{};
  return out.map(r=>Object.assign(r,{meta:meta[r.id]||{}})).sort((a,b)=>(b.at||0)-(a.at||0))}
 const pathOf=r=>r.seat==='gm'?['reports',r.id]:['pub',r.seat,'reports',r.id];
 const stOf=r=>STS[r.meta.st]?r.meta.st:'new';
 const open=r=>stOf(r)!=='done';
 const fmtT=t=>{if(!t)return '';const d=new Date(t);const p=n=>String(n).padStart(2,'0');return `${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`};
 const replies=r=>[...(r.cm||[]),...(r.meta.cm||[])].filter(c=>c&&c.t).sort((a,b)=>(a.at||0)-(b.at||0));

 /* ----- 지금 상황 찍어 두기 ----- */
 function snapBattle(){const b=(ST().state||{}).battle||{};const mons=Object.values(b.mons||{});
  if(!(+b.turn)&&!mons.some(m=>m&&m.entry))return null;
  const f=b.field||{};const fx=[];if(f.weather&&f.weather.type)fx.push(`날씨 ${f.weather.type}${f.weather.count?' '+f.weather.count:''}`);if(f.terrain&&f.terrain.type)fx.push(`필드 ${f.terrain.type}${f.terrain.count?' '+f.terrain.count:''}`);
  for(const k of Object.keys(f.rooms||{}))if(f.rooms[k])fx.push(k);for(const k of Object.keys(f.etc||{}))if(f.etc[k])fx.push(k);
  for(const sd of ['left','right'])for(const k of Object.keys(((f.objects||{})[sd])||{}))if(f.objects[sd][k])fx.push(`${sd==='left'?'좌':'우'} ${k}`);
  const on=mons.filter(m=>m&&m.entry).sort((x,y)=>String(x.side).localeCompare(String(y.side))||String(x.entry).localeCompare(String(y.entry))).map(m=>{const hp=m.hp||{};const sts=Object.keys(m.states||{}).filter(k=>m.states[k]);const rk=Object.entries(m.rank||{}).filter(([k,v])=>+v).map(([k,v])=>`${k}${+v>0?'+':''}${v}`);
   return `${m.side==='left'?'좌':m.side==='right'?'우':'?'}${String(m.entry||'').toUpperCase()} ${m.name||m.id} HP ${hp.cur??'?'}/${hp.max??'?'}${sts.length?' · '+sts.join(','):''}${rk.length?' · '+rk.join(' '):''}${m.item?' · 🎒'+(m.item.name||m.item):''}`});
  return {turn:+b.turn||0,phase:PHASES[+b.phase||0]||String(b.phase||0),mode:+b.mode||1,field:fx,mons:on}}
 function snapLog(){const L=(ST().log||[]).filter(r=>r&&r.data&&!r.data.sms&&r.kind!=='whisper'&&(r.kind!=='chat'||r.data.bat||!r.data.ch||r.data.ch!=='o'));
  return L.slice(-15).map(r=>`[${fmtT(r.at)}] ${r.kind==='chat'?'':r.kind+' · '}${r.name?r.name+': ':''}${cut(String(r.data.t||'').replace(/\s+/g,' '),220)}`)}
 function snap(opt){const c={view:VIEWN[ST().lastView]||ST().lastView||'',v:ST().v,ua:cut(navigator.userAgent,160),w:innerWidth};
  if(opt.battle){const b=snapBattle();if(b)c.battle=b;c.log=snapLog()}
  if(opt.err&&ERR.length)c.err=ERR.slice(-15).map(e=>`[${fmtT(e.at)}] ${e.k}${e.n>1?' ×'+e.n:''}: ${e.t}`);
  return c}

 /* ----- 그리기 ----- */
 let filt='open',kfilt='',formOpen=false,editId='';
 const draft={k:'bug',title:'',body:'',battle:true,err:true};
 let edDraft=null;
 const cmDraft={};
 function render(el){
  const ae=document.activeElement;   /* 쓰는 중에 남의 변경이 와도 입력칸이 날아가지 않게 */
  if(el&&ae&&el.contains(ae)&&(ae.tagName==='TEXTAREA'||(ae.tagName==='INPUT'&&ae.type==='text'))&&el.querySelector('.rpt')){
   if(!ae._omb){ae._omb=1;ae.addEventListener('blur',()=>setTimeout(()=>{if(A().view==='report')A().renderScene()},300),{once:true})}
   return}
  const list=all();const can=!!ST().role;
  const shown=list.filter(r=>(filt==='all'||(filt==='open'?open(r):!open(r)))&&(!kfilt||r.k===kfilt));
  const nOpen=list.filter(open).length;
  el.innerHTML=`<div class="rpt">
   <div class="rpthead"><div><div class="small dim">FEEDBACK · BUG REPORT</div><h2>건의 · 제보</h2></div>
    <span class="chip">열림 ${nOpen}</span><span class="chip dim">해결 ${list.length-nOpen}</span><span class="sp"></span>
    <button class="btn sm" data-r="copy" title="지금 보이는 목록을 마크다운으로 복사 — 반디에게 그대로 붙여 넣기">📋 복사</button>
    <button class="btn sm ghost" data-r="save" title="전부 JSON 파일로 저장">💾 파일</button>
    ${can?`<button class="btn sm pri" data-r="new">${formOpen&&!editId?'접기':'+ 새 제보'}</button>`:''}</div>
   ${can?'':'<div class="small muted" style="margin-bottom:8px">자리에 앉으면 제보를 쓸 수 있다. 보는 것은 누구나.</div>'}
   ${formOpen?form():''}
   <div class="row rptfilt">${[['open','열린 것'],['done','해결'],['all','전부']].map(([k,n])=>`<button class="btn xs ${filt===k?'pri':'ghost'}" data-f="${k}">${n}</button>`).join('')}<span style="width:10px"></span>
    ${[['','모든 종류'],['bug','🐞 버그'],['idea','💡 건의']].map(([k,n])=>`<button class="btn xs ${kfilt===k?'pri':'ghost'}" data-kf="${k}">${n}</button>`).join('')}</div>
   ${shown.length?`<div class="rptlist">${shown.map(card).join('')}</div>`:`<div class="empty">${list.length?'조건에 맞는 제보가 없다':'아직 제보가 없다. 배틀 중에 이상하면 바로 「+ 새 제보」.'}</div>`}
  </div>`;
  bind(el,list)}
 function form(){const ed=editId?all().find(r=>r.id===editId):null;if(editId&&!ed){editId='';formOpen=false;return ''}const d=ed?(edDraft||(edDraft={k:ed.k,title:ed.title,body:ed.body})):draft;
  return `<div class="rptform">
   <div class="row">${Object.entries(KINDS).map(([k,[ic,n]])=>`<button class="btn sm ${d.k===k?'pri':'ghost'}" data-k="${k}">${ic} ${n}</button>`).join('')}<span class="sp"></span>${ed?'<span class="small dim">고치는 중</span>':''}</div>
   <input type="text" id="rptTitle" maxlength="120" placeholder="${d.k==='bug'?'한 줄 요약 (예: 촛불의 영창 썼는데 명중 랭크가 안 오름)':'한 줄 요약 (예: 지시 창에서 기술 PP 도 보여 줘)'}" value="${esc(d.title||'')}">
   <textarea id="rptBody" rows="5" maxlength="4000" placeholder="${d.k==='bug'?'무엇을 했고 · 무엇을 기대했고 · 실제로 무엇이 됐는지. 누구 포켓몬, 어떤 기술·특성이었는지도.':'어떤 화면에서 무엇이 불편했고, 어떻게 바뀌면 좋겠는지.'}">${esc(d.body||'')}</textarea>
   ${ed?'':`<div class="row small"><label><input type="checkbox" id="rptB" ${draft.battle?'checked':''}> 배틀 상황 · 최근 로그 붙이기</label><label><input type="checkbox" id="rptE" ${draft.err?'checked':''}> 최근 오류 붙이기 <span class="dim">(${ERR.length}건)</span></label></div>`}
   <div class="row"><span class="sp"></span>${ed?'<button class="btn sm ghost" data-r="cancel">그만두기</button>':''}<button class="btn sm pri" data-r="post">${ed?'고친 것 저장':'올리기'}</button></div></div>`}
 function card(r){const [ic,kn]=KINDS[r.k]||KINDS.bug;const st=stOf(r);const [sn,sc]=STS[st];const c=r.ctx||{};const cms=replies(r);const canEd=mine(r);
  const ctxN=(c.battle?1:0)+((c.log||[]).length?1:0)+((c.err||[]).length?1:0);
  return `<div class="rptcard ${st} ${r.k}" data-id="${esc(r.id)}">
   <div class="row rpttop"><span class="rptk">${ic}</span><b class="rptt">${esc(r.title||'(제목 없음)')}</b><span class="sp"></span>
    <span class="rptst" style="--c:${sc}">${sn}</span></div>
   <div class="small dim">${esc(kn)} · ${esc(r.by||r.seat)} · ${fmtT(r.at)}${r.ed?' · 고침 '+fmtT(r.ed):''}</div>
   ${r.body?`<div class="rptb">${esc(r.body)}</div>`:''}
   ${ctxN?`<details class="rptctx"><summary>붙인 상황 보기${c.err&&c.err.length?` · <span style="color:var(--red2)">오류 ${c.err.length}</span>`:''}${c.battle?` · 턴 ${c.battle.turn} ${esc(c.battle.phase)}`:''}</summary>${ctxHtml(c)}</details>`:''}
   ${cms.length?`<div class="rptcm">${cms.map(m=>`<div><b>${esc(m.by||'')}</b> <span class="small dim">${fmtT(m.at)}</span><div>${esc(m.t)}</div></div>`).join('')}</div>`:''}
   <div class="row rptact">
    ${gm()?`<select data-st title="처리 상태">${Object.entries(STS).map(([k,[n]])=>`<option value="${k}" ${st===k?'selected':''}>${n}</option>`).join('')}</select>`:''}
    ${gm()||canEd?`<input type="text" data-cm placeholder="${gm()?'답글 · 처리 메모':'덧붙이기'}" value="${esc(cmDraft[r.id]||'')}"><button class="btn xs" data-r="cm">달기</button>`:''}
    <span class="sp"></span><button class="btn xs ghost" data-r="copy1">복사</button>
    ${canEd?'<button class="btn xs ghost" data-r="edit">고치기</button>':''}${canEd||gm()?'<button class="btn xs ghost danger" data-r="del">지우기</button>':''}</div></div>`}
 function ctxHtml(c){const sec=(t,a)=>a&&a.length?`<div class="rptsec"><div class="small dim">${t}</div><pre>${esc(a.join('\n'))}</pre></div>`:'';const b=c.battle;
  return (b?sec(`배틀 · 턴 ${b.turn} · ${b.phase} · 에리어 ${b.mode}`,[...(b.field.length?['필드: '+b.field.join(', ')]:[]),...b.mons]):'')+sec('최근 로그',c.log)+sec('오류',c.err)+`<div class="small dim">${esc([c.view&&'보던 탭 '+c.view,c.v&&'상태 v'+c.v,c.w&&'폭 '+c.w+'px',c.ua].filter(Boolean).join(' · '))}</div>`}

 /* ----- 내보내기 ----- */
 function md(r){const [,kn]=KINDS[r.k]||KINDS.bug;const c=r.ctx||{};const L=[`### [${kn.split(' ')[0]}] ${r.title||'(제목 없음)'}`,`- ${STS[stOf(r)][0]} · ${r.by||r.seat} · ${fmtT(r.at)} · id ${r.id}`];
  if(r.body)L.push('',r.body);
  const b=c.battle;if(b){L.push('',`배틀: 턴 ${b.turn} · ${b.phase} · 에리어 ${b.mode}${b.field.length?' · '+b.field.join(', '):''}`);for(const m of b.mons)L.push('- '+m)}
  if((c.log||[]).length)L.push('','최근 로그:','```',...c.log,'```');
  if((c.err||[]).length)L.push('','오류:','```',...c.err,'```');
  if(c.view||c.ua)L.push('',`환경: ${[c.view&&'탭 '+c.view,c.v&&'v'+c.v,c.w&&c.w+'px',c.ua].filter(Boolean).join(' · ')}`);
  const cms=replies(r);if(cms.length){L.push('','답글:');for(const m of cms)L.push(`- ${m.by||''} (${fmtT(m.at)}): ${m.t}`)}
  return L.join('\n')}
 async function copy(t){try{await navigator.clipboard.writeText(t);A().toast('복사했다 — 반디에게 붙여 넣으면 된다')}catch(e){const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand('copy')}catch(e2){}ta.remove();A().toast(ok?'복사했다':'복사가 막혔다 — 「💾 파일」로 저장해 줘')}}
 function save(list){const room=(ST().roomRow||{}).name||ST().room||'room';const blob=new Blob([JSON.stringify({room:ST().room,name:room,at:new Date().toISOString(),reports:list.map(r=>Object.assign({},r,{st:stOf(r)}))},null,1)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`오레마스_제보_${String(room).replace(/[\\/:*?"<>|]/g,'_')}_${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}

 /* ----- 동작 ----- */
 function bind(el,list){const root=$('.rpt',el);const byId=id=>list.find(r=>r.id===id);
  const syncDraft=()=>{const t=$('#rptTitle',root),b=$('#rptBody',root);const d=editId?edDraft:draft;if(!d)return;if(t)d.title=t.value;if(b)d.body=b.value;if(!editId){const cb=$('#rptB',root),ce=$('#rptE',root);if(cb)draft.battle=cb.checked;if(ce)draft.err=ce.checked}};
  root.querySelectorAll('#rptTitle,#rptBody,#rptB,#rptE').forEach(x=>x.addEventListener(x.type==='checkbox'?'change':'input',syncDraft));
  root.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{syncDraft();if(editId){if(edDraft)edDraft.k=b.dataset.k}else{draft.k=b.dataset.k;draft.battle=draft.err=draft.k==='bug'}render(el)});
  root.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{filt=b.dataset.f;render(el)});
  root.querySelectorAll('[data-kf]').forEach(b=>b.onclick=()=>{kfilt=b.dataset.kf;render(el)});
  root.querySelectorAll('[data-cm]').forEach(x=>{const id=x.closest('[data-id]').dataset.id;x.oninput=()=>{cmDraft[id]=x.value};x.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();addCm(byId(id),x.value)}}});
  root.querySelectorAll('select[data-st]').forEach(s=>s.onchange=async()=>{const r=byId(s.closest('[data-id]').dataset.id);if(!r)return;const m=Object.assign({},r.meta,{st:s.value,at:Date.now()});if(await A().set(['reportsMeta',r.id],m))A().toast(`「${r.title}」 → ${STS[s.value][0]}`)});
  root.querySelectorAll('[data-r]').forEach(b=>b.onclick=async()=>{const a=b.dataset.r;const card=b.closest('[data-id]');const r=card?byId(card.dataset.id):null;
   if(a==='new'){if(formOpen&&!editId){syncDraft();formOpen=false}else{formOpen=true;editId='';edDraft=null}render(el);if(formOpen){const t=$('#rptTitle',el);if(t)t.focus()}}
   else if(a==='cancel'){formOpen=false;editId='';edDraft=null;render(el)}
   else if(a==='post'){syncDraft();const t=$('#rptTitle',root).value.trim(),bd=$('#rptBody',root).value.trim();if(!t&&!bd)return A().toast('한 줄이라도 적어 줘');
    if(editId){const ed=byId(editId);if(ed)await post(ed,{k:(edDraft||ed).k,title:t,body:bd},true)}else await post(null,{k:draft.k,title:t,body:bd})}
   else if(a==='edit'&&r){editId=r.id;edDraft=null;formOpen=true;render(el);el.scrollTo?.({top:0,behavior:'smooth'})}
   else if(a==='del'&&r){if(!confirm(`「${r.title||'제목 없음'}」 제보를 지울까?`))return;if(await A().set(pathOf(r),null)){if(gm()&&r.meta&&Object.keys(r.meta).length)await A().set(['reportsMeta',r.id],null);A().toast('지웠다')}}
   else if(a==='cm'&&r){const x=$('[data-cm]',card);addCm(r,x?x.value:'')}
   else if(a==='copy1'&&r)copy(md(r));
   else if(a==='copy'){const s=list.filter(r=>(filt==='all'||(filt==='open'?open(r):!open(r)))&&(!kfilt||r.k===kfilt));if(!s.length)return A().toast('복사할 제보가 없다');
    copy(`# 오레마스 건의 · 제보 — ${(ST().roomRow||{}).name||ST().room} (${s.length}건, ${fmtT(Date.now())})\n\n`+s.map(md).join('\n\n---\n\n'))}
   else if(a==='save')save(list)})}
 async function post(old,d,isEdit){const s=ST();const who=s.role==='gm'?'GM':(((s.state.roster||{}).trainers||{})[s.seat]||{}).name?`${s.name} (${s.state.roster.trainers[s.seat].name})`:s.name;
  let r;if(isEdit&&old){r=Object.assign({},old,{k:d.k,title:d.title,body:d.body,ed:Date.now()});delete r.meta;delete r.id;delete r.seat}
  else r={k:d.k,title:d.title,body:d.body,by:who||'?',at:Date.now(),ctx:snap({battle:draft.battle,err:draft.err})};
  const id=isEdit&&old?old.id:Date.now().toString(36)+rnd(4);const path=isEdit&&old?pathOf(old):(s.role==='gm'?['reports',id]:['pub',s.seat,'reports',id]);
  if(!(await A().set(path,r)))return;
  if(!isEdit){Object.assign(draft,{title:'',body:''});A().sysLog(`${KINDS[d.k][0]} 제보: ${d.title||cut(d.body,40)}`,'sys')}
  formOpen=false;editId='';edDraft=null;A().toast(isEdit?'고쳤다':'올렸다 — 「제보」 탭에서 모두가 본다');A().renderScene()}
 async function addCm(r,t){t=String(t||'').trim();if(!r||!t)return;const s=ST();const c={t:cut(t,1000),by:s.role==='gm'?'GM':s.name,at:Date.now()};
  const ok=gm()?await A().set(['reportsMeta',r.id],Object.assign({},r.meta,{cm:[...(r.meta.cm||[]),c],at:Date.now()},r.meta.st?{}:{st:'ack'})):await A().set([...pathOf(r),'cm'],[...(r.cm||[]),c]);
  if(ok){delete cmDraft[r.id];A().renderScene()}}

 return {render,note,errors:()=>ERR.slice(),all,md}
})();
