/* ---------- DB 창: 특성 · 소지품 · 기술 · 상태 변화 (맵툴 trait_db / item_db 창을 본뜬 찾아보기 + 고르기) ----------
   OM_DB_UI.open({kind:'trait'|'item'|'move'|'state', sel:'이름', pick:(name,rec)=>{}})  pick 이 있으면 「이 걸로」 버튼이 붙는다
   OM_DB_UI.pretty(text)  효과 문구를 ①②③ 줄 · 【태그】 · 「따옴표」 강조로 */
"use strict";
window.OM_DB_UI=(()=>{
 const A=()=>window.OM_APP, DB=()=>window.OM_DB||{};
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const $=(s,r)=>(r||document).querySelector(s);
 const CIRC='①②③④⑤⑥⑦⑧⑨⑩';
 const KINDS=[['trait','특성'],['item','소지품'],['move','기술'],['state','상태 변화']];
 function pretty(t,opt){opt=opt||{};if(!t)return '<span class="dim small">효과 없음</span>';
  return String(t).split(/<br\s*\/?>|\n/i).filter(l=>l.trim()!=='').map(ln=>{const c=ln.charAt(0);const num=CIRC.includes(c)?c:'';let body=num?ln.slice(1):ln;
   body=esc(body).replace(/【([^】]+)】/g,'<span class="dbtag">$1</span>').replace(/「([^」]+)」/g,'<b class="dbq">「$1」</b>').replace(/(\d+할)/g,'<b class="dbn">$1</b>');
   return `<div class="dbl">${num?`<i>${num}</i>`:(opt.dot===false?'':'<i class="nn">·</i>')}<span>${body}</span></div>`}).join('')}
 function tagsOf(t){const o=[];let m;const re=/【([^】]+)】/g;while((m=re.exec(t||'')))if(!o.includes(m[1]))o.push(m[1]);return o}
 /* 종류별 레코드 → {name, summary(목록용 한 줄), tags, html(상세), search(검색 대상 문자열)} */
 function rows(kind){const d=DB();const S=window.OM_STATS;
  if(kind==='trait')return Object.entries(d.traits||{}).map(([n,v])=>({name:n,summary:String(v.multi||v.single||'').replace(/<br\s*\/?>/gi,' ').replace(/^[①-⑩]/,''),tags:tagsOf((v.multi||'')+(v.single||'')),search:n+' '+(v.multi||'')+' '+(v.single||''),
    html:`<div class="dbsec">배틀 효과</div><div class="dbbody">${pretty(v.multi)}</div>${v.single&&v.single!==v.multi?`<div class="dbsec">룰북 문구</div><div class="dbbody">${pretty(v.single)}</div>`:''}${v.entry&&v.entry.on?`<div class="dbsec">등장 대사</div><div class="dbbody dim small">${esc(v.entry.t)}</div>`:''}`}));
  if(kind==='item')return Object.entries(d.items||{}).map(([n,v])=>({name:n,summary:String(v.eff||'').replace(/<br\s*\/?>/gi,' '),tags:tagsOf(v.eff).concat(v.note&&v.note!=='-'&&v.note.length<=8?[v.note]:[]),search:n+' '+(v.eff||'')+' '+(v.note||''),
    html:`<div class="dbsec">효과</div><div class="dbbody">${pretty(v.eff)}</div><div class="row small" style="margin-top:8px"><span class="chip">소켓 ${esc(v.sock||'-')}</span>${v.note&&v.note!=='-'?`<span class="chip" style="border-color:var(--yel2)">${esc(v.note)}</span>`:''}</div>${v.entry&&v.entry.on?`<div class="dbsec">발동 대사</div><div class="dbbody dim small">${esc(v.entry.t)}</div>`:''}`}));
  if(kind==='move')return Object.values(d.moves||{}).map(v=>({name:v.name,summary:`${v.type} · ${v.cat} · 위력 ${v.pow||'-'} · 명중 ${v.acc||'-'} · ${v.range}${v.eff&&v.eff!=='-'?' · '+v.eff:''}`,tags:(v.tags||[]).map(t=>t.replace(/^#/,'')),search:v.name+' '+(v.eff||'')+' '+(v.tags||[]).join(' ')+' '+(v.en||'')+' '+(v.ja||''),type:v.typeEn,
    html:`<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px">${A().typeChip(v.typeEn)}<span class="chip">${esc(v.cat)}</span><span class="chip">위력 <b>${esc(v.pow||'-')}</b></span><span class="chip">명중 <b>${esc(v.acc||'-')}</b></span><span class="chip">${esc(v.range)}</span>${v.contact==='O'?'<span class="chip">접촉</span>':''}${+v.prio?`<span class="chip">우선도 ${v.prio>0?'+':''}${v.prio}</span>`:''}${v.max>1?`<span class="chip">${v.min}~${v.max}회</span>`:''}<span class="chip">소켓 ${esc(v.sock||'-')}</span></div><div class="dbsec">효과</div><div class="dbbody">${pretty(v.eff==='-'?'':v.eff,{dot:false})}</div>${v.note&&v.note!=='-'?`<div class="dbsec">비고</div><div class="dbbody small">${pretty(v.note,{dot:false})}</div>`:''}<div class="small dim" style="margin-top:8px">${esc(v.atk)} → ${esc(v.def)} · ${esc(v.gen||'')} · ${esc(v.en||'')} ${esc(v.ja||'')}</div>`}));
  if(kind==='state'){const st=(d.states||{}).st||{};const groups=(d.states||{}).groups||[];const gOf={};groups.forEach(g=>g.s.forEach(k=>gOf[k]=g.l));const im=(d.img||{}).state||{};
   return Object.entries(st).map(([k,v])=>({name:v.ko||k,key:k,summary:(v.desc||[]).join(' '),tags:[...new Set([gOf[k]||'기타'].concat(v.abn?['상태 이상']:[],v.neg?['불리']:[]))],search:k+' '+(v.ko||'')+' '+(v.desc||[]).join(' '),img:im[k]?'img/state/'+im[k]:'',
    html:`<div class="row" style="gap:8px;align-items:center;margin-bottom:8px">${im[k]?`<img src="img/state/${im[k]}" style="width:40px;height:40px;object-fit:contain">`:''}<span class="chip">${esc(gOf[k]||'기타')}</span>${v.prog==='turn'?'<span class="chip">턴 감소</span>':''}${v.max&&v.max<1000?`<span class="chip">${v.min===v.max?v.max+'턴':v.min+'~'+v.max+'턴'}</span>`:''}<span class="small dim">${esc(k)}</span></div><div class="dbsec">설명</div><div class="dbbody">${pretty((v.desc||[]).join('\n'),{dot:false})}</div>${v.memo?`<div class="dbsec">메모</div><div class="dbbody small">${esc(v.memo)}</div>`:''}`}))}
  return []}
 const CACHE={};function all(kind){if(!CACHE[kind])CACHE[kind]=rows(kind).sort((a,b)=>a.name.localeCompare(b.name,'ko'));return CACHE[kind]}
 const UI={kind:'trait',q:'',tag:'',sel:'',lim:200,pick:null};
 function open(o){o=o||{};UI.kind=o.kind||'trait';UI.pick=o.pick||null;UI.q=o.q||'';UI.tag='';UI.lim=200;UI.sel=o.sel||'';
  const md=A().openModal(`<div class="mhead"><h2 id="dbtitle">DB</h2><span class="tabs2" id="dbkinds"></span><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="dbwrap"><div class="dbleft"><input type="text" id="dbq" placeholder="이름·효과로 찾기" autocomplete="off"><div class="dbtags" id="dbtags"></div><div class="dblist" id="dblist"></div></div><div class="dbright" id="dbdetail"></div></div>`,{wide:true});
  md.classList.add('dbmodal');
  $('#dbq',md).oninput=e=>{UI.q=e.target.value;UI.lim=200;drawList()};
  render();const q=$('#dbq',md);q.value=UI.q;setTimeout(()=>q.focus(),50)}
 function render(){const md=$('.modal');if(!md)return;
  $('#dbkinds',md).innerHTML=KINDS.map(([k,n])=>`<button class="tab2 ${UI.kind===k?'on':''}" data-kind="${k}">${n} <small>${all(k).length}</small></button>`).join('');
  $('#dbkinds',md).querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{UI.kind=b.dataset.kind;UI.tag='';UI.sel='';UI.lim=200;render()});
  $('#dbtitle',md).textContent=(UI.pick?'고르기 — ':'')+KINDS.find(x=>x[0]===UI.kind)[1];
  const cnt={};all(UI.kind).forEach(r=>r.tags.forEach(t=>{const b=t.replace(/\s*\(.*\)$/,'');cnt[b]=(cnt[b]||0)+1}));
  const top=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]).slice(0,14);
  $('#dbtags',md).innerHTML=top.map(t=>`<button class="chip ${UI.tag===t?'on':''}" data-tag="${esc(t)}">${esc(t)} <small>${cnt[t]}</small></button>`).join('');
  $('#dbtags',md).querySelectorAll('[data-tag]').forEach(b=>b.onclick=()=>{UI.tag=UI.tag===b.dataset.tag?'':b.dataset.tag;UI.lim=200;render()});
  drawList();drawDetail()}
 function filtered(){const q=UI.q.trim().toLowerCase();return all(UI.kind).filter(r=>{if(UI.tag&&!r.tags.some(t=>t.replace(/\s*\(.*\)$/,'')===UI.tag))return false;if(!q)return true;if(r.name.toLowerCase().includes(q))return true;return q.length>=2&&r.search.toLowerCase().includes(q)})}
 function drawList(){const md=$('.modal');if(!md)return;const list=filtered();if(!UI.sel||!list.some(r=>r.name===UI.sel)){if(list.length&&UI.q)UI.sel=list[0].name}
  const el=$('#dblist',md);el.innerHTML=list.slice(0,UI.lim).map(r=>`<div class="dbi ${r.name===UI.sel?'on':''}" data-n="${esc(r.name)}"><div class="dbh">${r.img?`<img src="${r.img}">`:''}${r.type?A().typeChip(r.type):''}<b>${esc(r.name)}</b>${r.tags.slice(0,2).map(t=>`<span class="dbtag sm">${esc(t)}</span>`).join('')}</div><div class="dbe">${esc(r.summary)}</div></div>`).join('')+(list.length>UI.lim?`<button class="btn sm ghost" id="dbmore">더 보기 (${list.length-UI.lim})</button>`:'')+(list.length?'':'<div class="empty">없다</div>');
  el.querySelectorAll('[data-n]').forEach(d=>d.onclick=()=>{UI.sel=d.dataset.n;drawList();drawDetail()});
  el.querySelectorAll('[data-n]').forEach(d=>d.ondblclick=()=>{if(UI.pick)choose()});
  const mo=$('#dbmore',md);if(mo)mo.onclick=()=>{UI.lim+=300;drawList()};
  if(UI.q===''&&!UI.sel){/* 아무것도 안 골랐으면 상세는 빈 채로 */}
  drawDetail()}
 function drawDetail(){const md=$('.modal');if(!md)return;const r=all(UI.kind).find(x=>x.name===UI.sel);const el=$('#dbdetail',md);
  if(!r){el.innerHTML='<div class="empty">왼쪽에서 고르면 여기 자세히 나온다</div>';return}
  el.innerHTML=`<div class="dbcard"><div class="dbth">${r.img?`<img src="${r.img}">`:''}${r.type?A().typeChip(r.type):''}<b>${esc(r.name)}</b><span class="sp"></span>${r.tags.map(t=>`<span class="dbtag">${esc(t)}</span>`).join('')}</div><div class="dbtb">${r.html}</div>${UI.pick?`<div class="dbfoot"><button class="btn pri" id="dbpick">이 걸로</button></div>`:''}</div>`;
  const p=$('#dbpick',md);if(p)p.onclick=choose}
 function choose(){const r=all(UI.kind).find(x=>x.name===UI.sel);if(!r)return;const f=UI.pick;A().closeModal();if(f)f(r.name,r)}
 /* 시트·배틀에서 쓰는 한 줄 요약 (특성/소지품 이름 → 효과 문구 HTML) */
 function effectHtml(kind,name){const d=DB();if(kind==='trait'){const v=(d.traits||{})[name];return v?pretty(v.multi||v.single):''}if(kind==='item'){const v=(d.items||{})[name];return v?pretty(v.eff):''}return ''}
 return {open,pretty,effectHtml};
})();
