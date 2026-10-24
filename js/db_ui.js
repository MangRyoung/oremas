/* ---------- DB 창: 특성 · 소지품 · 기술 · 상태 변화 (맵툴 trait_db / item_db 창을 본뜬 찾아보기 + 고르기) ----------
   OM_DB_UI.open({kind:'trait'|'item'|'move'|'state', sel:'이름', pick:(name,rec)=>{}})  pick 이 있으면 「이 걸로」 버튼이 붙는다
   OM_DB_UI.pretty(text)  효과 문구를 ①②③ 줄 · 【태그】 · 「따옴표」 강조로 */
"use strict";
window.OM_DB_UI=(()=>{
 const A=()=>window.OM_APP, DB=()=>window.OM_DB||{};
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const $=(s,r)=>(r||document).querySelector(s);
 const CIRC='①②③④⑤⑥⑦⑧⑨⑩';
 const KINDS=[['trait','특성'],['item','소지품'],['move','기술'],['pot','포텐셜'],['state','상태 변화']];
 function pretty(t,opt){opt=opt||{};if(!t)return '<span class="dim small">효과 없음</span>';
  return String(t).split(/<br\s*\/?>|\n/i).filter(l=>l.trim()!=='').map(ln=>{const c=ln.charAt(0);const num=CIRC.includes(c)?c:'';let body=num?ln.slice(1):ln;
   body=esc(body).replace(/【([^】]+)】/g,'<span class="dbtag">$1</span>').replace(/「([^」]+)」/g,'<b class="dbq">「$1」</b>').replace(/(\d+할)/g,'<b class="dbn">$1</b>');
   return `<div class="dbl">${num?`<i>${num}</i>`:(opt.dot===false?'':'<i class="nn">·</i>')}<span>${body}</span></div>`}).join('')}
 function tagsOf(t){const o=[];let m;const re=/【([^】]+)】/g;while((m=re.exec(t||'')))if(!o.includes(m[1]))o.push(m[1]);return o}
 /* 종류별 레코드 → {name, summary(목록용 한 줄), tags, html(상세), search(검색 대상 문자열)} */
 function rows(kind){const d=DB();const S=window.OM_STATS;
  if(kind==='trait')return Object.entries(d.traits||{}).map(([n,v])=>({name:n,summary:String(v.multi||v.single||'').replace(/<br\s*\/?>/gi,' ').replace(/^[①-⑩]/,''),tags:tagsOf((v.multi||'')+(v.single||'')),search:n+' '+(v.multi||'')+' '+(v.single||''),
    html:`${v.src?`<div class="row small" style="margin-bottom:6px"><span class="chip" style="border-color:var(--yel2)">${esc(v.src==='maker'?'제작기에서':'방에서 고침')}</span>${v.cost?`<span class="chip">비용 ${esc(v.cost)}</span>`:''}</div>`:''}<div class="dbsec">배틀 효과</div><div class="dbbody">${pretty(v.multi)}</div>${v.single&&v.single!==v.multi?`<div class="dbsec">룰북 문구</div><div class="dbbody">${pretty(v.single)}</div>`:''}${v.entry&&v.entry.on?`<div class="dbsec">등장 대사</div><div class="dbbody dim small">${esc(v.entry.t)}</div>`:''}`}));
  if(kind==='item')return Object.entries(d.items||{}).map(([n,v])=>({name:n,summary:String(v.eff||'').replace(/<br\s*\/?>/gi,' '),tags:tagsOf(v.eff).concat(v.note&&v.note!=='-'&&v.note.length<=8?[v.note]:[]),search:n+' '+(v.eff||'')+' '+(v.note||''),
    html:`<div class="dbsec">효과</div><div class="dbbody">${pretty(v.eff)}</div><div class="row small" style="margin-top:8px"><span class="chip">소켓 ${esc(v.sock||'-')}</span>${v.note&&v.note!=='-'?`<span class="chip" style="border-color:var(--yel2)">${esc(v.note)}</span>`:''}</div>${v.entry&&v.entry.on?`<div class="dbsec">발동 대사</div><div class="dbbody dim small">${esc(v.entry.t)}</div>`:''}`}));
  if(kind==='move')return Object.values(d.moves||{}).map(v=>({name:v.name,summary:`${v.type} · ${v.cat} · 위력 ${v.pow||'-'} · 명중 ${v.acc||'-'} · ${v.range}${v.eff&&v.eff!=='-'?' · '+v.eff:''}`,tags:(v.tags||[]).map(t=>t.replace(/^#/,'')),search:v.name+' '+(v.eff||'')+' '+(v.tags||[]).join(' ')+' '+(v.en||'')+' '+(v.ja||''),type:v.typeEn,
    html:`<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px">${A().typeChip(v.typeEn)}<span class="chip">${esc(v.cat)}</span><span class="chip">위력 <b>${esc(v.pow||'-')}</b></span><span class="chip">명중 <b>${esc(v.acc||'-')}</b></span><span class="chip">${esc(v.range)}</span>${v.contact==='O'?'<span class="chip">접촉</span>':''}${+v.prio?`<span class="chip">우선도 ${v.prio>0?'+':''}${v.prio}</span>`:''}${v.max>1?`<span class="chip">${v.min}~${v.max}회</span>`:''}<span class="chip">소켓 ${esc(v.sock||'-')}</span></div><div class="dbsec">효과</div><div class="dbbody">${pretty(v.eff==='-'?'':v.eff,{dot:false})}</div>${v.note&&v.note!=='-'?`<div class="dbsec">비고</div><div class="dbbody small">${pretty(v.note,{dot:false})}</div>`:''}<div class="small dim" style="margin-top:8px">${esc(v.atk)} → ${esc(v.def)} · ${esc(v.gen||'')} · ${esc(v.en||'')} ${esc(v.ja||'')}</div>`}));
  if(kind==='pot'){return ((d.maker||{}).pots||[]).map((p,i)=>({name:p[1],group:p[0],summary:String(p[2]||'').replace(/\n/g,' '),tags:[String(p[0]||'').replace(/^[\d.]+\s*/,'')].concat(tagsOf(p[2])).concat(p.src==='maker'?['제작기']:[]),search:p[0]+' '+p[1]+' '+(p[2]||'')+' '+(p[3]||''),
    html:`<div class="row small" style="margin-bottom:6px"><span class="chip">${esc(p[0])}</span>${p.src?`<span class="chip" style="border-color:var(--yel2)">${esc(p.src==='maker'?'제작기에서':'방에서 고침')}</span>`:''}</div><div class="dbsec">효과</div><div class="dbbody">${pretty(p[2])}</div>${p[3]?`<div class="dbsec">비고</div><div class="dbbody small">${pretty(p[3],{dot:false})}</div>`:''}`}))}
  if(kind==='state'){const st=(d.states||{}).st||{};const groups=(d.states||{}).groups||[];const gOf={};groups.forEach(g=>g.s.forEach(k=>gOf[k]=g.l));const im0=(d.img||{}).state||{};const im={};for(const k in st){const v=(st[k]||{}).img||im0[k];if(v)im[k]=/^(https?:|data:image\/)/.test(v)?v:'img/state/'+v}
   return Object.entries(st).map(([k,v])=>({name:v.ko||k,key:k,summary:(v.desc||[]).join(' '),tags:[...new Set([gOf[k]||'기타'].concat(v.abn?['상태 이상']:[],v.neg?['불리']:[]))],search:k+' '+(v.ko||'')+' '+(v.desc||[]).join(' '),img:im[k]||'',
    html:`<div class="row" style="gap:8px;align-items:center;margin-bottom:8px">${im[k]?`<img src="${esc(im[k])}" style="width:40px;height:40px;object-fit:contain">`:''}<span class="chip">${esc(gOf[k]||'기타')}</span>${v.prog==='turn'?'<span class="chip">턴 감소</span>':''}${v.max&&v.max<1000?`<span class="chip">${v.min===v.max?v.max+'턴':v.min+'~'+v.max+'턴'}</span>`:''}<span class="small dim">${esc(k)}</span></div><div class="dbsec">설명</div><div class="dbbody">${pretty((v.desc||[]).join('\n'),{dot:false})}</div>${v.memo?`<div class="dbsec">메모</div><div class="dbbody small">${esc(v.memo)}</div>`:''}`}))}
  return []}
 const CACHE={};function all(kind){if(!CACHE[kind])CACHE[kind]=rows(kind).sort((a,b)=>a.name.localeCompare(b.name,'ko'));return CACHE[kind]}
 const UI={kind:'trait',q:'',tag:'',sel:'',lim:200,pick:null};
 function open(o){o=o||{};UI.kind=o.kind||'trait';UI.pick=o.pick||null;UI.q=o.q||'';UI.tag='';UI.lim=200;UI.sel=o.sel||'';
  const md=A().openModal(`<div class="mhead"><h2 id="dbtitle">DB</h2><span class="tabs2" id="dbkinds"></span><span class="sp"></span><span id="dbtools" class="row"></span><button class="btn ghost" data-x>닫기</button></div><div class="dbwrap"><div class="dbleft"><input type="text" id="dbq" placeholder="이름·효과로 찾기" autocomplete="off"><div class="dbtags" id="dbtags"></div><div class="dblist" id="dblist"></div></div><div class="dbright" id="dbdetail"></div></div>`,{wide:true});
  md.classList.add('dbmodal');
  $('#dbq',md).oninput=e=>{UI.q=e.target.value;UI.lim=200;drawList()};
  render();const q=$('#dbq',md);q.value=UI.q;setTimeout(()=>q.focus(),50)}
 function render(){const md=$('.modal');if(!md)return;
  $('#dbkinds',md).innerHTML=KINDS.map(([k,n])=>`<button class="tab2 ${UI.kind===k?'on':''}" data-kind="${k}">${n} <small>${all(k).length}</small></button>`).join('');
  $('#dbkinds',md).querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{UI.kind=b.dataset.kind;UI.tag='';UI.sel='';UI.lim=200;render()});
  $('#dbtitle',md).textContent=(UI.pick?'고르기 — ':'')+KINDS.find(x=>x[0]===UI.kind)[1];
  const tb=$('#dbtools',md);if(tb){tb.innerHTML=A().ST.role==='gm'?`${UI.kind!=='state'?'<button class="btn sm" id="dbnew">+ 새로</button>':''}<button class="btn sm ghost" id="dbsync" title="제작기 DB 수정은 GM 화면이 2분마다 · 창으로 돌아올 때 자동으로 가져온다. 이 단추는 전부 다시 읽기">제작기 다시 읽기</button>`:'';const nw=$('#dbnew',md);if(nw)nw.onclick=()=>openEdit(UI.kind,'',true);const sy=$('#dbsync',md);if(sy)sy.onclick=syncMaker}
  const cnt={};all(UI.kind).forEach(r=>r.tags.forEach(t=>{const b=t.replace(/\s*\(.*\)$/,'');cnt[b]=(cnt[b]||0)+1}));
  const top=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]).slice(0,14);
  $('#dbtags',md).innerHTML=top.map(t=>`<button class="chip ${UI.tag===t?'on':''}" data-tag="${esc(t)}">${esc(t)} <small>${cnt[t]}</small></button>`).join('');
  $('#dbtags',md).querySelectorAll('[data-tag]').forEach(b=>b.onclick=()=>{UI.tag=UI.tag===b.dataset.tag?'':b.dataset.tag;UI.lim=200;render()});
  drawList();drawDetail()}
 function filtered(){const q=UI.q.trim().toLowerCase();return all(UI.kind).filter(r=>{if(UI.tag&&!r.tags.some(t=>t.replace(/\s*\(.*\)$/,'')===UI.tag))return false;if(!q)return true;if(r.name.toLowerCase().includes(q))return true;return q.length>=2&&r.search.toLowerCase().includes(q)})}
 function drawList(){const md=$('.modal');if(!md)return;const list=filtered();if(!UI.sel||!list.some(r=>r.name===UI.sel)){if(list.length&&UI.q)UI.sel=list[0].name}
  const el=$('#dblist',md);el.innerHTML=list.slice(0,UI.lim).map(r=>`<div class="dbi ${r.name===UI.sel?'on':''}" data-n="${esc(r.name)}"><div class="dbh">${r.img?`<img src="${esc(r.img)}">`:''}${r.type?A().typeChip(r.type):''}<b>${esc(r.name)}</b>${r.tags.slice(0,2).map(t=>`<span class="dbtag sm">${esc(t)}</span>`).join('')}</div><div class="dbe">${esc(r.summary)}</div></div>`).join('')+(list.length>UI.lim?`<button class="btn sm ghost" id="dbmore">더 보기 (${list.length-UI.lim})</button>`:'')+(list.length?'':'<div class="empty">없다</div>');
  el.querySelectorAll('[data-n]').forEach(d=>d.onclick=()=>{UI.sel=d.dataset.n;drawList();drawDetail()});
  el.querySelectorAll('[data-n]').forEach(d=>d.ondblclick=()=>{if(UI.pick)choose()});
  const mo=$('#dbmore',md);if(mo)mo.onclick=()=>{UI.lim+=300;drawList()};
  if(UI.q===''&&!UI.sel){/* 아무것도 안 골랐으면 상세는 빈 채로 */}
  drawDetail()}
 function drawDetail(){const md=$('.modal');if(!md)return;const r=all(UI.kind).find(x=>x.name===UI.sel);const el=$('#dbdetail',md);
  if(!r){el.innerHTML='<div class="empty">왼쪽에서 고르면 여기 자세히 나온다</div>';return}
  const isGm=A().ST.role==='gm';const ov=UI.kind==='state'?((A().ST.state.dbx||{}).st||{})[r.key]:((A().ST.state.dbx||{})[UI.kind]||{})[r.name];
  el.innerHTML=`<div class="dbcard"><div class="dbth">${r.img?`<img src="${esc(r.img)}">`:''}${r.type?A().typeChip(r.type):''}<b>${esc(r.name)}</b><span class="sp"></span>${r.tags.map(t=>`<span class="dbtag">${esc(t)}</span>`).join('')}</div><div class="dbtb">${r.html}${UI.kind==='move'?mvAuto(r.name):''}</div><div class="dbfoot">${isGm?`<button class="btn sm ghost" id="dbedit">수정</button><button class="btn sm ghost" id="dbdup">사본</button>${ov?'<button class="btn sm ghost" id="dbrevert">기본으로</button>':''}<button class="btn sm ghost danger" id="dbdel">삭제</button>`:''}<span class="sp"></span>${UI.pick?`<button class="btn pri" id="dbpick">이 걸로</button>`:''}</div></div>`;
  const p=$('#dbpick',md);if(p)p.onclick=choose;
  if(UI.kind==='state'){/* 10-21 망령: 상태 변화도 방마다 고치기 · 사본 · 삭제 (dbx.st[키]) — 캠페인마다 다른 세팅 */
   const e=$('#dbedit',md);if(e)e.onclick=()=>openStEdit(r.key,false);const du=$('#dbdup',md);if(du)du.onclick=()=>openStEdit(r.key,true);
   const rv=$('#dbrevert',md);if(rv)rv.onclick=async()=>{await A().set(['dbx','st',r.key],null);await A().set(['dbx','at'],Date.now());refresh()};
   const dl=$('#dbdel',md);if(dl)dl.onclick=async()=>{if(!confirm(`상태 「${r.name}」을 이 방의 DB 에서 지울까? (기본 DB 는 그대로, 「기본으로」로 되돌릴 수 있다)`))return;await A().set(['dbx','st',r.key],{del:1,src:'room'});await A().set(['dbx','at'],Date.now());UI.sel='';refresh()};
   const p2=$('#dbpick',md);if(p2)p2.onclick=choose;return}
  const e=$('#dbedit',md);if(e)e.onclick=()=>openEdit(UI.kind,r.name,false);const du=$('#dbdup',md);if(du)du.onclick=()=>openEdit(UI.kind,r.name,true);
  const rv=$('#dbrevert',md);if(rv)rv.onclick=async()=>{await A().set(['dbx',UI.kind,r.name],null);await A().set(['dbx','at'],Date.now());refresh()};
  const dl=$('#dbdel',md);if(dl)dl.onclick=async()=>{if(!confirm(`「${r.name}」을 이 방의 DB 에서 지울까? (기본 DB 는 그대로, 「기본으로」로 되돌릴 수 있다)`))return;await A().set(['dbx',UI.kind,r.name],{del:1});await A().set(['dbx','at'],Date.now());UI.sel='';refresh()}}
 /* 기술 자동화 요약 (제작기 moveauto): 공격 창 「적용」 때 자동으로 들어가는 것 / 손으로 할 것 */
 function mvAuto(name){const MA=window.OM_MOVEAUTO,rec=recOf('move',name);if(!MA||!rec)return '';const a=MA.parse(rec);if(!a)return '';const on=MA.auto(a);if(!on&&!a.notes.length)return '';
  return `<div class="dbauto">${on?`<div><b>⚙ 자동</b> ${esc(MA.describe(a))}</div>`:''}${a.notes.length?`<div class="dim"><b>✋ 손으로</b> ${a.notes.map(esc).join(' · ')}</div>`:''}</div>`}
 function refresh(){applyOverride(A().ST.state.dbx);CACHE[UI.kind]=null;render()}
 function choose(){const r=all(UI.kind).find(x=>x.name===UI.sel);if(!r)return;const f=UI.pick;A().closeModal();if(f)f(r.name,r)}
 /* ----- 수정 (GM): 방 상태 dbx[kind][name] 에 덮어쓰기 → 모두에게 실시간 반영 ----- */
 const FIELDS={trait:[['multi','배틀 효과 (①②③ 줄바꿈)','area'],['single','룰북 문구','area'],['cost','비용','text']],item:[['eff','효과','area'],['auto','구문 (소지품 자동화 · 비우면 효과 글을 읽는다)','area'],['sock','소켓','text'],['note','비고','text']],move:[['type','타입','text'],['cat','분류 (물리/특수/변화)','text'],['pow','위력','num'],['acc','명중','num'],['range','범위','text'],['contact','접촉 (O/X)','text'],['prio','우선도','num'],['min','연속 최소','num'],['max','연속 최대','num'],['tag','태그','text'],['eff','효과','area'],['note','비고','area']],pot:[['group','분류 (예: 00.1. 역할)','text'],['eff','효과','area'],['note','비고','area']]};
 function recOf(kind,name){const d=DB();if(kind==='trait')return (d.traits||{})[name];if(kind==='item')return (d.items||{})[name];if(kind==='move')return (d.moves||{})[name];if(kind==='pot'){const p=((d.maker||{}).pots||[]).find(x=>x[1]===name);return p?{group:p[0],eff:p[2],note:p[3]}:null}return null}
 function openEdit(kind,name,dup){const base=name?recOf(kind,name):null;const cur=Object.assign({},base||{});if(kind==='move'&&base)cur.type=base.type;
  const fs=FIELDS[kind]||[];const nm=dup?(name?name+' (사본)':''):name;
  const md=A().openModal(`<div class="mhead"><h2>${name&&!dup?'수정':'새로 만들기'} — ${KINDS.find(x=>x[0]===kind)[1]}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="row" style="margin-bottom:6px"><b style="width:110px">이름</b><input type="text" id="ed_name" value="${esc(nm)}" style="flex:1" ${name&&!dup?'readonly':''}></div>
   ${fs.map(([k,l,t])=>`<div class="row" style="margin-bottom:6px;align-items:flex-start"><b style="width:110px;padding-top:6px">${l}</b>${t==='area'?`<textarea data-ed="${k}" rows="4" style="flex:1">${esc(String(cur[k]==null?'':cur[k]).replace(/<br\s*\/?>/gi,'\n'))}</textarea>`:`<input type="${t==='num'?'number':'text'}" data-ed="${k}" value="${esc(cur[k]==null?'':cur[k])}" style="${t==='num'?'width:90px':'flex:1'}">`}</div>`).join('')}
   <div class="small dim">【태그】 「강조」 ①②③ 을 그대로 쓰면 맵툴처럼 꾸며진다. 저장하면 이 방의 모두에게 바로 반영된다 (기본 DB 파일은 그대로).</div>
   <div class="row" style="margin-top:10px"><span class="sp"></span><button class="btn pri" id="ed_ok">저장</button></div>`);
  $('#ed_ok',md).onclick=async()=>{const n=$('#ed_name',md).value.trim();if(!n)return A().toast('이름이 필요해');const rec={};fs.forEach(([k,l,t])=>{const v=md.querySelector(`[data-ed="${k}"]`).value;rec[k]=t==='num'?(v===''?'':+v):v});
   if(kind==='move'){rec.name=n;rec.typeEn=window.OM_STATS.typeEn(rec.type);rec.cat=rec.cat||'변화';rec.range=rec.range||'1체';rec.contact=rec.contact||'X';rec.tags=String(rec.tag||'').split(/\s+/).filter(Boolean)}
   rec.src='room';A().closeModal();await A().set(['dbx',kind,n],rec);await A().set(['dbx','at'],Date.now());UI.sel=n;if(document.querySelector('.dbmodal'))refresh();else open({kind,sel:n})}}
 /* 상태 변화 수정: 키(영문)는 그대로, 이름·그룹·턴·설명·그림을 방 DB(dbx.st)에 */
 function openStEdit(key,dup){const sd=DB().states||{st:{},groups:[]};const cur=Object.assign({},(sd.st||{})[key]||{});const gOf=((sd.groups||[]).find(g=>g.s.includes(key))||{}).l||'(숨김)';
  const nk=dup?(key+'_'+Date.now().toString(36).slice(-4)):key;const groups=[...new Set([...(sd.groups||[]).map(g=>g.l),gOf,'(숨김)'])];
  const md=A().openModal(`<div class="mhead"><h2>${dup?'사본 만들기':'수정'} — 상태 변화</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="stedg">
    <label><b>이름</b><input type="text" id="se_ko" value="${esc((cur.ko||key)+(dup?' (사본)':''))}"></label>
    <label><b>키</b><input type="text" id="se_key" value="${esc(nk)}" ${dup?'':'readonly'} title="자동화 구문·배틀이 쓰는 영문 키"></label>
    <label><b>그룹</b><input type="text" id="se_grp" list="se_gl" value="${esc(gOf)}"><datalist id="se_gl">${groups.map(g=>`<option value="${esc(g)}">`).join('')}</datalist></label>
    <label><b>진행</b><select id="se_prog">${[['turn','턴 감소'],['move','기술 사용 시 감소'],['','유지']].map(([v,n])=>`<option value="${v}" ${(cur.prog||'')===v?'selected':''}>${n}</option>`).join('')}</select></label>
    <label><b>최소 턴</b><input type="number" id="se_min" value="${cur.min??1}" title="1000 = 계속"></label>
    <label><b>최대 턴</b><input type="number" id="se_max" value="${cur.max??1}" title="1000 = 계속"></label>
    <label class="seck"><input type="checkbox" id="se_abn" ${cur.abn?'checked':''}> 상태 이상</label><label class="seck"><input type="checkbox" id="se_neg" ${cur.neg?'checked':''}> 불리 (해제 대상)</label>
    <label class="sefull"><b>그림 주소</b><span class="row" style="gap:6px;flex:1"><input type="text" id="se_img" value="${esc(cur.img||'')}" placeholder="https://… 또는 img/state 파일 이름" style="flex:1"><img id="se_imgv" alt="" style="width:28px;height:28px;object-fit:contain"></span></label>
    <label class="sefull"><b>설명</b><textarea id="se_desc" rows="5" placeholder="한 줄에 하나씩">${esc((cur.desc||[]).join('\n'))}</textarea></label>
    <label class="sefull"><b>메모</b><input type="text" id="se_memo" value="${esc(cur.memo||'')}"></label>
   </div>
   <div class="small dim">저장하면 이 방의 모두에게 바로 반영된다 (기본 DB 파일은 그대로 · 「기본으로」로 되돌릴 수 있다).</div>
   <div class="row" style="margin-top:10px"><span class="sp"></span><button class="btn pri" id="se_ok">저장</button></div>`);
  const iv=()=>{const v=$('#se_img',md).value.trim();const im=$('#se_imgv',md);im.src=!v?'':/^(https?:|data:image\/)/.test(v)?v:'img/state/'+v;im.style.visibility=v?'visible':'hidden'};$('#se_img',md).oninput=iv;iv();
  $('#se_ok',md).onclick=async()=>{const k=$('#se_key',md).value.trim().replace(/[^\w가-힣-]/g,'');const ko=$('#se_ko',md).value.trim();if(!k||!ko)return A().toast('이름과 키가 필요해');if(dup&&(sd.st||{})[k])return A().toast('이미 있는 키다');
   const e={ko,min:+$('#se_min',md).value||1,max:+$('#se_max',md).value||1,roll:cur.roll||'',prog:$('#se_prog',md).value,abn:$('#se_abn',md).checked?1:0,neg:$('#se_neg',md).checked?1:0,bat:cur.bat||0,desc:$('#se_desc',md).value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean),memo:$('#se_memo',md).value,img:$('#se_img',md).value.trim()};
   A().closeModal();await A().set(['dbx','st',k],{group:$('#se_grp',md).value.trim()||'기타',e,src:'room'});await A().set(['dbx','at'],Date.now());UI.sel=ko;if(document.querySelector('.dbmodal'))refresh();else open({kind:'state',sel:ko})}}
 let BASE=null,appliedAt=null;
 /* 10-21 망령: 제작기 DB 에 새로 넣은 특성·포텐셜(dbedit)은 「제작기 새로고침」 전이라도 시트를 가져올 때 읽어 둔다 (이 화면에만 · 방에서 고친 것이 이긴다) */
 let MKX=null,mkxP=null;
 function ensureMaker(){if(MKX)return Promise.resolve(MKX);if(mkxP)return mkxP;mkxP=(async()=>{const x={trait:{},pot:{},item:{}};try{const rows=await window.OM_STORE.makerDocs('dbedit');
   for(const r of rows||[]){const d=r.data||{};const row=d.row||[];if(!d.key||d.deleted)continue;if(d.kind==='abil')x.trait[d.key]={multi:String(row[2]||''),single:String(row[2]||''),cost:row[0]||''};else if(d.kind==='pots')x.pot[d.key]={group:row[0]||'',eff:row[2]||'',note:row[3]||''};else if(d.kind==='items')x.item[d.key]=mkItem(row)}}catch(e){console.warn('제작기 DB 를 읽지 못했다',e)}
   MKX=x;appliedAt=null;applyOverride(A().ST.state.dbx);return MKX})();return mkxP}
 /* 비어 있는 특성·포텐셜 효과 글을 DB 로 채운다 (예전에 빈 채로 가져온 시트도) */
 function fillEff(m){if(!m)return false;const d=DB();let ch=false;const pr=n=>((d.maker||{}).pots||[]).find(r=>r[1]===n);
  if(m.ability&&!m.abilityEff){const v=(d.traits||{})[m.ability];if(v&&(v.multi||v.single)){m.abilityEff=String(v.multi||v.single).replace(/<br\s*\/?>/gi,'\n');ch=true}}
  for(const p of m.pots||[]){if(p.eff)continue;const r=pr(p.name)||pr('『'+p.name+'』');if(r&&r[2]){p.eff=String(r[2]).replace(/<br\s*\/?>/gi,'\n');if(!p.kind)p.kind=r[0]||'';ch=true}}
  return ch}
 /* 제작기 소지품 행 [종류,도구,별칭,소모(O),효과,소켓,비고,구문] → 오레마스 소지품 {eff, sock, note, auto} (10-24: 구문 = 소지품 자동화) */
 const mkItem=row=>({eff:(row[3]==='O'&&!/소모품/.test(String(row[4]||''))?'소모품/':'')+String(row[4]||''),sock:String(row[5]||''),note:String(row[6]||''),auto:String(row[7]||'')});
 function applyOverride(dbx){const d=DB();if(!BASE)BASE={traits:Object.assign({},d.traits),items:Object.assign({},d.items),moves:Object.assign({},d.moves),pots:((d.maker||{}).pots||[]).slice(),states:d.states?JSON.parse(JSON.stringify(d.states)):null};
  const at=(dbx||{}).at||0;if(at===appliedAt&&appliedAt!==null)return;appliedAt=at;dbx=dbx||{};
  const merge=(base,ov)=>{const out=Object.assign({},base);for(const k in ov||{}){if(ov[k]&&ov[k].del)delete out[k];else out[k]=Object.assign({},base[k]||{},ov[k])}return out};
  d.traits=merge(MKX?merge(BASE.traits,MKX.trait):BASE.traits,dbx.trait);d.items=merge(MKX?merge(BASE.items,MKX.item):BASE.items,dbx.item);d.moves=merge(BASE.moves,dbx.move);
  const POV=Object.assign({},MKX?MKX.pot:{},dbx.pot||{});
  const pots=BASE.pots.filter(p=>!(POV[p[1]]));for(const n in POV){const o=POV[n];if(o.del)continue;const row=[o.group||'99. 기타',n,o.eff||'',o.note||''];row.src=o.src;const i=BASE.pots.findIndex(p=>p[1]===n);if(i>=0)pots.splice(Math.min(i,pots.length),0,row);else pots.push(row)}
  if(d.maker)d.maker.pots=pots;
  /* 상태 변화: 제작기 상태 변화 DB 에서 고친 상태(dbx.st[키] = {e, group} | {del}). 같은 그룹이면 자리를 지킨다 */
  if(BASE.states){const S0=BASE.states,so=dbx.st||{};const st=Object.assign({},S0.st);const groups=(S0.groups||[]).map(g=>({l:g.l,s:g.s.slice()}));let hidden=(S0.hidden||[]).slice();
   for(const k in so){const o=so[k]||{};let kept=false;for(const g of groups){const i=g.s.indexOf(k);if(i<0)continue;if(!o.del&&g.l===o.group){kept=true;continue}g.s.splice(i,1)}if(o.del||!(o.group&&o.group!=='(숨김)'))hidden=hidden.filter(x=>x!==k);
    if(o.del){delete st[k];continue}st[k]=Object.assign({},o.e||{});if(kept)continue;if(o.group&&o.group!=='(숨김)'){let g=groups.find(x=>x.l===o.group);if(!g)groups.push(g={l:o.group,s:[]});g.s.push(k)}else if(!hidden.includes(k))hidden.push(k)}
   d.states=Object.assign({},S0,{groups:groups.filter(g=>g.s.length),hidden,st})}
  for(const k in CACHE)CACHE[k]=null}
 /* 제작기의 dbedit (특성 abil · 포텐셜 pots) 를 이 방 DB 에 가져온다 */
 /* 제작기의 dbedit (특성 abil · 포텐셜 pots · 소지품 items · 상태 st · 레디메이드 rm) 를 이 방 DB(dbx)에 섞는다. 돌려줌: 바뀐 개수 {n,ns,nr}
    full: 전부 읽은 것 (제작기 상태 변화는 새로 받는다) · 아니면 바뀐 문서만 (10-24 자동 반영). 방에서 직접 고친 것(src 'room')은 건드리지 않는다 */
 function mergeMaker(dbx,rows,full){dbx.trait=dbx.trait||{};dbx.item=dbx.item||{};dbx.pot=dbx.pot||{};dbx.st=dbx.st||{};dbx.rm=dbx.rm||{};let n=0,ns=0,nr=0;
  if(full)for(const k in dbx.st)if(dbx.st[k]&&dbx.st[k].src==='maker')delete dbx.st[k];/* 제작기 것은 매번 새로 받는다 (원래대로 되돌린 상태도 따라가게) */
  const num=v=>{const x=+v;return v===''||v==null||isNaN(x)?0:x};const FX=window.OM_FX;const RB=(window.OM_DB||{}).readymade||{};
  for(const r of rows||[]){const d=r.data||{};const row=d.row||[];if(!d.key)continue;
   if(d.kind==='abil'){const cur=(dbx.trait[d.key]||{});if(cur.src==='room')continue;if(d.deleted){if(cur.src==='maker'){delete dbx.trait[d.key];n++}continue}const eff=String(row[2]||'');const base=BASE&&BASE.traits[d.key];if(base&&base.multi===eff){if(cur.src==='maker'){delete dbx.trait[d.key];n++}continue}dbx.trait[d.key]={multi:eff,single:(base&&base.single)||eff,cost:row[0]||'',src:'maker'};n++}
   else if(d.kind==='st'){if((dbx.st[d.key]||{}).src==='room')continue;if(d.deleted){dbx.st[d.key]={del:1,src:'maker'};ns++;continue}const r=row;dbx.st[d.key]={group:String(r[2]||''),e:{ko:r[1]||d.key,min:num(r[3]),max:num(r[4]),roll:r[5]||'',prog:r[6]||'turn',abn:r[7]==='O'?1:0,neg:r[8]==='O'?1:0,bat:r[9]==='O'?1:0,desc:String(r[10]||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),memo:r[11]||'',img:r[12]||((BASE&&BASE.states&&BASE.states.st[d.key])||((DB().states||{}).st||{})[d.key]||{}).img||''},src:'maker'};ns++}
   else if(d.kind==='items'){const cur=(dbx.item[d.key]||{});if(cur.src==='room')continue;if(d.deleted){if(cur.src==='maker'){delete dbx.item[d.key];n++}continue}const it=mkItem(row);const base=BASE&&BASE.items[d.key];if(base&&base.eff===it.eff&&String(base.auto||'')===it.auto){if(cur.src==='maker'){delete dbx.item[d.key];n++}continue}dbx.item[d.key]=Object.assign(it,{src:'maker'});n++}
   else if(d.kind==='pots'){const cur=(dbx.pot[d.key]||{});if(cur.src==='room')continue;if(d.deleted){if(cur.src==='maker'){delete dbx.pot[d.key];n++}continue}const base=BASE&&BASE.pots.find(p=>p[1]===d.key);if(base&&base[2]===row[2]){if(cur.src==='maker'){delete dbx.pot[d.key];n++}continue}dbx.pot[d.key]={group:row[0]||'',eff:row[2]||'',note:row[3]||'',src:'maker'};n++}
   else if(d.kind==='rm'&&FX){const cur=dbx.rm[d.key]||{};if(cur.src==='room')continue;
    if(d.deleted){if(RB[d.key]&&!cur.deleted){dbx.rm[d.key]={deleted:1,src:'maker'};nr++}continue}
    const text=String(row[1]||''),dsl=String(row[2]||''),manual=row[3]==='O';const pc=String(row[4]==null?'':row[4]).trim();const b=RB[d.key];
    if(b&&b.text===text&&FX.unparse(b.ops||[]).join('\n')===dsl&&!!b.manual===manual&&String(b.p==null?'':b.p)===pc){if(cur.src==='maker'){delete dbx.rm[d.key];nr++}continue}
    const v={text,ops:FX.parse(dsl).ops,src:'maker'};if(manual)v.manual=1;if(pc!==''&&+pc>0)v.p=Math.min(100,+pc);if(JSON.stringify(Object.assign({},cur,{src:''}))===JSON.stringify(Object.assign({},v,{src:''})))continue;dbx.rm[d.key]=v;nr++}}
  return {n,ns,nr}}
 const maxAt=rows=>(rows||[]).reduce((m,r)=>r.updated_at&&r.updated_at>m?r.updated_at:m,'');
 /* 「제작기 새로고침」 단추: 전부 읽는다 */
 async function syncMaker(){A().toast('제작기에서 읽는 중…');let rows;try{rows=window.OM_STORE.makerDocsSince?await window.OM_STORE.makerDocsSince('dbedit',null):await window.OM_STORE.makerDocs('dbedit')}catch(e){return A().toast('읽지 못했다: '+e.message)}
  const dbx=JSON.parse(JSON.stringify(A().ST.state.dbx||{}));const c=mergeMaker(dbx,rows,true);const at=maxAt(rows);if(at)dbx.mkSeen=at;
  dbx.at=Date.now();await A().set(['dbx'],dbx);MKX=null;mkxP=null;A().toast(`제작기에서 ${c.n}개 가져왔다 (특성·포텐셜·소지품)${c.ns?` · 상태 변화 ${c.ns}개`:''}${c.nr?` · 레디메이드 ${c.nr}개`:''}`);if(document.querySelector('.dbmodal'))refresh()}
 /* 10-24 망령: 제작기 DB 자동 반영 — GM 화면이 2분마다(그리고 창으로 돌아올 때) 지난번 뒤에 바뀐 제작기 DB 문서만 읽어 방 DB 에 섞는다.
    바뀐 게 없으면 빈 응답 하나라 사용량은 거의 없다. 처음 한 번(mkSeen 없음)은 전부 읽는다 */
 let AUTO=false,PULL=false,LASTP=0;
 async function pullMaker(){if(PULL||A().ST.role!=='gm'||!A().ST.room||!window.OM_STORE||!window.OM_STORE.makerDocsSince)return;if(document.visibilityState==='hidden')return;if(Date.now()-LASTP<20000)return;PULL=true;LASTP=Date.now();
  try{const d0=A().ST.state.dbx||{};const since=d0.mkSeen||null;const rows=await window.OM_STORE.makerDocsSince('dbedit',since);if(!rows.length)return;
   const dbx=JSON.parse(JSON.stringify(A().ST.state.dbx||{}));const c=mergeMaker(dbx,rows,!since);const at=maxAt(rows);if(at)dbx.mkSeen=at;
   if(!c.n&&!c.ns&&!c.nr&&since){await A().set(['dbx','mkSeen'],dbx.mkSeen);return}
   dbx.at=Date.now();await A().set(['dbx'],dbx);MKX=null;mkxP=null;
   const tot=c.n+c.ns+c.nr;if(tot&&since)A().toast(`제작기 DB 변경 ${tot}개를 반영했다`);if(document.querySelector('.dbmodal'))refresh()}
  catch(e){console.warn('제작기 DB 자동 반영',e)}finally{PULL=false}}
 function startAuto(){if(AUTO)return;AUTO=true;setTimeout(pullMaker,5000);setInterval(pullMaker,120000);addEventListener('focus',()=>setTimeout(pullMaker,300));document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')setTimeout(pullMaker,300)})}
 /* 시트·배틀에서 쓰는 한 줄 요약 (특성/소지품 이름 → 효과 문구 HTML) */
 function effectHtml(kind,name){const d=DB();if(kind==='trait'){const v=(d.traits||{})[name];return v?pretty(v.multi||v.single):''}if(kind==='item'){const v=(d.items||{})[name];return v?pretty(v.eff):''}return ''}
 return {open,pretty,effectHtml,applyOverride,syncMaker,pullMaker,startAuto,ensureMaker,fillEff};
})();
