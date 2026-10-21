/* ---------- 필드 전개 (맵툴 「필드 전개 관리」 dialog_field_field · active_field_field · reset_field_field · field_fx_show 를 옮김, 2026-10-21) ----------
   날씨·필드(그래스필드 등)와는 별개로, 배틀 뒤쪽에 까는 무대 — 종류 3가지: 필드 / 스타디움 / 이계.
   공용 목록이 아니라 트레이너 · 포켓몬 각자의 능력이다 (망령 10-21): 제작기 시트 「필드 전개」 → 로스터 → 배틀.
     트레이너.fields / 포켓몬.fields = [{type:0 필드|1 스타디움|2 이계, name, loc(지역), img, eff(효과, 한 줄에 하나), count(지속 턴, -1 = 무한), color(타입 en)}]
     오레마스 시트(캐릭터 · 포켓몬 탭)에서도 고친다. 배틀에서는 로스터 쪽을 먼저 읽는다 (빌려 온 파티는 srcTid · rid).
   전개 중: state.battle.field.stage = 항목 사본 + {count: 남은 턴 (1000 = 무한), at, src:'t:<tid>:<k>'|'m:<mid>:<k>', tid, ownerMid}
     → 배틀 무대 뒤 배경 · 필드 띠의 《종류/이름》 칩 · 전개 연출(모두의 화면) · 로그 카드
     → 턴 종료 때 남은 턴 −1, 0 이 되면 걷힌다. 주인 포켓몬이 쓰러지거나 물러나면 걷힌다 («필드 위에 있는 한»).
   전개는 주인만 (좌석 = 자기 트레이너 · 자기 포켓몬, 포켓몬 것은 그 포켓몬이 나와 있을 때). GM 은 누구 것이든.
   배틀을 직접 못 쓰는 좌석(「플레이어는 자기 것만」 등)은 pub/<좌석>/stageq 에 요청을 적고 GM 화면이 받아 전개한다. */
"use strict";
window.OM_STAGE_UI=(()=>{
 const A=()=>window.OM_APP, BU=()=>window.OM_BATTLE_UI, S=()=>window.OM_STATS, F=()=>window.OM_FIELD, DB=()=>window.OM_DB||{}, DBS=()=>window.OM_STORE;
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const $=(s,r)=>(r||document).querySelector(s);
 const KINDS=['필드','스타디움','이계'],KIND_EN=['FIELD','STADIUM','ANOTHER WORLD'],KIND_CLS=['fld','std','igy'];
 const TYPES=['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];
 const ST=()=>A().ST;const gm=()=>ST().role==='gm';
 const kindOf=e=>{const t=+((e||{}).type)||0;return t>=0&&t<=2?t:0};
 const keyOf=e=>KINDS[kindOf(e)]+'/'+(e.name||'');
 const tcol=en=>{try{return S().typeColor(en)}catch(e){return {bg:'#2d3240',fg:'#fff'}}};
 const tko=en=>{try{return S().typeKo(en)}catch(e){return en}};
 const bgSrc=v=>{v=String(v||'').trim();if(!v)return '';if(/^(https?:|data:|img\/|\.\/|\/)/.test(v))return v;for(const g of DB().bg||[])for(const it of g.i||[])if((it.k===v||it.l===v)&&it.src)return it.src;return ''};
 const effLines=t=>String(t||'').replace(/<br\s*\/?>/g,'\n').split('\n').map(x=>x.trim()).filter(Boolean);
 const fix=a=>(Array.isArray(a)?a:[]).filter(x=>x&&typeof x==='object'&&String(x.name||'').trim()).map(x=>({type:kindOf(x),name:String(x.name).trim(),loc:String(x.loc||''),img:String(x.img||''),eff:String(x.eff||''),count:+x.count>0?Math.round(+x.count):-1,color:String(x.color||'')}));
 function stage(b){b=b||(ST().state.battle||{});const s=(b.field||{}).stage;return s&&s.name?s:null}
 const mgr=()=>{try{return BU().ctx().mgr}catch(e){return gm()}};
 const R=()=>ST().state.roster||{trainers:{},mons:{}};

 /* ----- 배틀에 있는 주인들과 그 필드 (로스터 쪽이 있으면 그걸 — 시트에서 고친 게 바로 따라온다) ----- */
 function owners(){const b=ST().state.battle||{};const r=R();const out=[];
  for(const tid of Object.keys(b.trainers||{})){const t=b.trainers[tid];if(!t)continue;const rt=(r.trainers||{})[t.srcTid||tid];
   out.push({kind:'t',id:tid,tid,name:t.name||tid,img:t.image||'',fields:fix(rt?rt.fields:t.fields),path:rt?['roster','trainers',rt.id||t.srcTid||tid,'fields']:['battle','trainers',tid,'fields'],on:true});
   const mons=Object.values(b.mons||{}).filter(m=>m&&m.tid===tid).sort((x,y)=>(x.slot||0)-(y.slot||0));
   for(const m of mons){const rid=m.rid||m.id;const rm=(r.mons||{})[rid];
    out.push({kind:'m',id:m.id,tid,name:(m.form0||{}).name||m.name,img:m.image||'',fields:fix(rm?rm.fields:m.fields),path:rm?['roster','mons',rid,'fields']:['battle','mons',m.id,'fields'],on:!!(m.entry&&m.hp&&m.hp.cur>0)})}}
  return out}
 const mine=o=>gm()||(!!ST().seat&&o.tid===ST().seat);
 function entries(){const out=[];for(const o of owners())o.fields.forEach((f,k)=>out.push(Object.assign({},f,{key:o.kind+':'+o.id+':'+k,o,k})));return out}
 const find=key=>entries().find(e=>e.key===key)||null;
 /* 좌석이 쓸 수 있는 내 필드가 하나라도 있나 (배틀 위 「필드 전개」 단추) */
 function hasMine(){if(!ST().seat||gm())return false;return owners().some(o=>o.tid===ST().seat&&o.fields.length)}

 /* ----- 필드 띠의 칩 · 무대 배경 ----- */
 function chip(c,f){const s=f&&f.stage;if(!s||!s.name)return '';const k=kindOf(s);const col=tcol(s.color);
  return `<div class="stbar ${KIND_CLS[k]}" data-act="stage" title="눌러서 필드 효과 보기" style="--sc:${esc(col.bg||'#5fd38d')}"><span class="stgb ${KIND_CLS[k]}">${KINDS[k]}</span><b>《${esc(keyOf(s))}》</b>${s.loc?`<small>${esc(s.loc)}</small>`:''}<span class="sp"></span>${s.owner?`<small>주인 ${esc(s.owner)}</small>`:''}<em>${s.count>=1000||!s.count?'∞':s.count+'T'}</em></div>`}
 function bgStyle(f){const s=f&&f.stage;if(!s||!s.name)return '';const u=bgSrc(s.img);if(!u)return '';let abs=u;try{abs=new URL(u,location.href).href}catch(e){}return ` style="--stage:url('${cssu(abs)}')"`}   /* 변수 안의 url() 은 css 파일 기준으로 풀리니 절대 주소로 */
 const canReset=s=>mgr()||(!!s&&!!ST().seat&&s.tid===ST().seat);

 /* ----- 효과 카드 (누구나) ----- */
 function info(){const s=stage();if(!s)return;const k=kindOf(s);const col=tcol(s.color);const u=bgSrc(s.img);
  const md=A().openModal(`<div class="mhead"><h2>《${esc(keyOf(s))}》</h2><span class="stgb ${KIND_CLS[k]}">${KINDS[k]}</span><span class="sp"></span>${canReset(s)?'<button class="btn sm ghost danger" id="stx">필드 걷기</button>':''}<button class="btn ghost" data-x>닫기</button></div>
   <div class="stinfo">${u?`<div class="stimg" style="background-image:url('${cssu(u)}')"></div>`:''}
    <div class="sthd" style="background:${esc(col.bg)};color:${esc(col.fg)}">◆《${esc(keyOf(s))}》의 필드 효과</div>
    <ul class="steff">${effLines(s.eff).map(l=>`<li>${esc(l)}</li>`).join('')||'<li class="dim">효과 글 없음</li>'}</ul>
    <div class="small"><b>지역</b> ${esc(s.loc||'-')} · <b>남은 턴</b> ${s.count>=1000||!s.count?'무한':s.count+'턴'}${s.owner?` · <b>주인</b> ${esc(s.owner)}`:''}</div></div>`);
  const x=$('#stx',md);if(x)x.onclick=async()=>{if(!confirm(`《${keyOf(s)}》을(를) 걷을까?`))return;A().closeModal();await reset()}}

 /* ----- 필드 전개 (맵툴 dialog_field_field) — 주인별로 묶어서 ----- */
 function open(){const s=stage();const cur=s?keyOf(s):'';const all=owners();const L=all.filter(mine);
  const card=(o,f,k)=>{const key=o.kind+':'+o.id+':'+k;const u=bgSrc(f.img);const on=!!s&&s.src===key;const col=tcol(f.color);const can=o.kind==='t'||o.on||gm();
   return `<div class="sfc ${on?'on':''}"><div class="stpic" ${u?`style="background-image:url('${cssu(u)}')"`:''}>${u?'':`<span class="bad">${f.img?'「'+esc(f.img)+'」<br>':''}그림 없음</span>`}</div>
    <div class="stbody"><div class="sthead"><b>${esc(f.name)}</b><span class="stgb ${KIND_CLS[kindOf(f)]}">${KINDS[kindOf(f)]}</span>${f.color?`<span class="type" style="background:${esc(col.bg)};color:${esc(col.fg)}">${esc(tko(f.color))}</span>`:''}</div>
     <div class="strows"><span><b>지역</b>${esc(f.loc||'-')}</span><span><b>지속</b>${+f.count>0?f.count+'턴':'무한'}</span></div>
     <div class="steff1">${esc(effLines(f.eff).join('\n'))||'<span class="dim">효과 글 없음</span>'}</div>
     <div class="stac">${on?(canReset(s)?`<button class="btn sm stnow stoff" data-sgoff title="다시 누르면 걷는다">전개 중 · 누르면 걷기</button>`:'<span class="stnow">전개 중</span>'):can?`<button class="btn sm pri stgo" data-sg="${esc(key)}">필드 전개!</button><label class="small dim">지속 <input type="number" class="n xs" data-sgc="${esc(key)}" value="${+f.count>0?f.count:''}" placeholder="무한"> 턴</label>`:'<span class="small dim">이 포켓몬이 배틀 필드에 나와 있어야 전개할 수 있다</span>'}<span class="sp"></span><button class="btn sm ghost" data-se="${esc(key)}">수정</button><button class="btn sm ghost danger" data-sd="${esc(key)}">삭제</button></div></div></div>`};
  const group=o=>`<div class="sfo"><div class="sfoh"><span class="sfok">${o.kind==='t'?'트레이너':'포켓몬'}</span><b>${esc(o.name)}</b>${o.kind==='m'&&!o.on?'<span class="small dim">대기 중</span>':''}<span class="sp"></span><button class="btn xs" data-sa="${esc(o.kind+':'+o.id)}">＋ 필드</button></div>${o.fields.map((f,k)=>card(o,f,k)).join('')}</div>`;
  const tids=[...new Set(L.map(o=>o.tid))];
  const md=A().openModal(`<div class="mhead"><h2>필드 전개</h2><span class="small dim">${cur?'지금 《'+esc(cur)+'》'+(s.owner?' · '+esc(s.owner):''):'전개된 필드 없음'}</span><span class="sp"></span>${s&&canReset(s)?'<button class="btn sm ghost danger" id="strs">필드 걷기</button>':''}<button class="btn ghost" data-x>닫기</button></div>
   <div class="small dim" style="margin-bottom:8px">필드 · 스타디움 · 이계는 트레이너와 포켓몬 각자의 능력이다. 제작기 시트나 오레마스 시트의 「필드 전개」 칸에 넣어 두면 여기서 주인이 펼친다. 날씨 · 그래스필드는 「필드」 창.</div>
   <div class="stlist">${tids.map(tid=>L.filter(o=>o.tid===tid&&(o.kind==='t'||o.fields.length)).map(group).join('')+(L.filter(o=>o.tid===tid&&o.kind==='m'&&!o.fields.length).length?`<div class="small dim sfmore">필드가 없는 포켓몬: ${L.filter(o=>o.tid===tid&&o.kind==='m'&&!o.fields.length).map(o=>`<button class="btn xs ghost" data-sa="${esc(o.kind+':'+o.id)}">＋ ${esc(o.name)}</button>`).join(' ')}</div>`:'')).join('')||'<div class="empty">배틀에 내 트레이너가 없다.</div>'}</div>`);
  md.classList.add('stmodal');
  const ownerOf=k=>all.find(o=>o.kind+':'+o.id===k);
  md.querySelectorAll('[data-sg]').forEach(b=>b.onclick=async()=>{const v=($(`[data-sgc="${CSS.escape(b.dataset.sg)}"]`,md)||{}).value||'';A().closeModal();await deploy(b.dataset.sg,+v>0?+v:0)});
  md.querySelectorAll('[data-se]').forEach(b=>b.onclick=()=>{const e=find(b.dataset.se);if(e)editIn(e.o,e.k,open)});
  md.querySelectorAll('[data-sa]').forEach(b=>b.onclick=()=>{const o=ownerOf(b.dataset.sa);if(o)editIn(o,null,open)});
  md.querySelectorAll('[data-sd]').forEach(b=>b.onclick=async()=>{const e=find(b.dataset.sd);if(!e||!confirm(`「${e.name}」을(를) ${e.o.name}의 필드에서 지울까?`))return;const list=e.o.fields.slice();list.splice(e.k,1);if(await A().set(e.o.path,list))A().toast('지웠다');open()});
  md.querySelectorAll('[data-sgoff]').forEach(b=>b.onclick=async()=>{A().closeModal();await reset()});
  const rs=$('#strs',md);if(rs)rs.onclick=async()=>{if(!confirm(`《${cur}》을(를) 걷을까?`))return;A().closeModal();await reset()}}
 /* 주인의 목록 하나를 고쳐 쓴다 (path = 로스터 칸, 없으면 배틀 사본) */
 function editIn(o,k,back){editor(k==null?null:o.fields[k],o.name,async v=>{const list=o.fields.slice();if(k==null)list.push(v);else list[k]=v;const ok=await A().set(o.path,list);if(ok)A().toast(k==null?'넣었다':'고쳤다');if(back)back();return ok})}

 /* ----- 등록 · 수정 창 (맵툴 input_field_field / edit_field_field) — 시트에서도 같은 창을 쓴다. done(v) → 저장 ----- */
 function editor(e,ownerName,done){const isNew=!e;e=e||{type:0,name:'',loc:'',img:'',eff:'',count:-1,color:''};
  const bgs=[];for(const g of DB().bg||[])for(const it of g.i||[])if(it.src)bgs.push([it.l||it.k,g.n]);
  const md=A().openModal(`<div class="mhead"><h2>${isNew?'필드 추가':'필드 수정 — '+esc(e.name)}</h2><span class="small dim">${esc(ownerName||'')}</span><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="stform">
    <label>종류<select id="sf_t">${KINDS.map((k,i)=>`<option value="${i}" ${kindOf(e)===i?'selected':''}>${k}</option>`).join('')}</select></label>
    <label>이름<input type="text" id="sf_n" value="${esc(e.name)}" placeholder="예) 세가지 재앙"></label>
    <label>지역<input type="text" id="sf_l" value="${esc(e.loc||'')}" placeholder="예) 재앙, 종말"></label>
    <label>지속 턴<input type="number" class="n" id="sf_c" value="${+e.count>0?e.count:''}" placeholder="비우면 무한"></label>
    <label>색상 타입<select id="sf_k"><option value="">-</option>${TYPES.map(t=>`<option value="${t}" ${e.color===t?'selected':''}>${esc(tko(t))}</option>`).join('')}</select></label>
    <label class="wide">그림<span class="row" style="flex:1;gap:6px"><input type="text" id="sf_i" list="sf_il" value="${esc(e.img||'')}" placeholder="배경 목록 이름 · 주소" style="flex:1"><datalist id="sf_il">${bgs.map(([l,g])=>`<option value="${esc(l)}">${esc(g)}</option>`).join('')}</datalist><label class="btn sm ghost">올리기<input type="file" id="sf_f" accept="image/*" hidden style="display:none"></label></span></label>
    <div class="stprev" id="sf_p"></div>
    <label class="wide">효과<textarea id="sf_e" rows="5" placeholder="한 줄에 하나 — ① ② ③ …">${esc(effLines(e.eff).join('\n'))}</textarea></label>
   </div>
   <div class="row" style="margin-top:10px"><span class="small dim">이 캐릭터의 시트에 저장된다 (제작기 동기화를 하면 제작기 쪽 목록으로 다시 맞춰진다)</span><span class="sp"></span><button class="btn pri" id="sf_ok">${isNew?'추가':'저장'}</button></div>`);
  const prev=()=>{const u=bgSrc($('#sf_i',md).value);$('#sf_p',md).innerHTML=u?`<div class="stimg" style="background-image:url('${cssu(u)}')"></div>`:($('#sf_i',md).value.trim()?'<span class="small" style="color:var(--red2)">그 이름의 배경을 못 찾았다 — 배경 목록 이름이나 주소, 또는 「올리기」</span>':'')};
  $('#sf_i',md).oninput=prev;prev();
  $('#sf_f',md).onchange=async ev=>{const f=ev.target.files[0];if(!f)return;A().toast('올리는 중…');try{$('#sf_i',md).value=await DBS().uploadImage(`rooms/${ST().room}/field_${Date.now().toString(36)}`,f);prev();A().toast('올렸다')}catch(x){A().toast(x.message)}};
  $('#sf_ok',md).onclick=async()=>{const name=$('#sf_n',md).value.trim();if(!name)return A().toast('이름을 적어 줘');
   const v={type:+$('#sf_t',md).value||0,name,loc:$('#sf_l',md).value.trim(),img:$('#sf_i',md).value.trim(),eff:$('#sf_e',md).value.replace(/\r/g,'').trim(),count:+$('#sf_c',md).value>0?+$('#sf_c',md).value:-1,color:$('#sf_k',md).value};
   A().closeModal();await done(v)}}

 /* ----- 시트 칸 (오레마스 시트 캐릭터 · 포켓몬 탭) ----- */
 function sheetSec(list,ed,own){list=fix(list);
  return `<div class="spanel"><div class="sh">필드 전개 <span class="note">배틀 뒤에 펼치는 필드 · 스타디움 · 이계 — 배틀의 「필드 전개」에서 주인이 쓴다</span><span class="sp"></span>${ed?`<button class="btn sm" data-sfa="${esc(own)}">＋ 필드</button>`:''}</div>
   ${list.length?`<div class="sflist">${list.map((f,k)=>{const u=bgSrc(f.img);const col=tcol(f.color);return `<div class="sfrow"><div class="sfpic" ${u?`style="background-image:url('${cssu(u)}')"`:''}></div><div class="sfbody"><div class="row" style="gap:6px;flex-wrap:wrap"><span class="stgb ${KIND_CLS[kindOf(f)]}">${KINDS[kindOf(f)]}</span><b>《${esc(f.name)}》</b>${f.color?`<span class="type" style="background:${esc(col.bg)};color:${esc(col.fg)}">${esc(tko(f.color))}</span>`:''}<span class="small dim">${esc(f.loc||'')}${f.loc?' · ':''}${f.count>0?f.count+'턴':'무한'}</span><span class="sp"></span>${ed?`<button class="btn xs ghost" data-sfe="${esc(own)}" data-k="${k}">수정</button><button class="btn xs ghost danger" data-sfd="${esc(own)}" data-k="${k}">×</button>`:''}</div><div class="pre small dim">${esc(effLines(f.eff).join('\n'))}</div></div></div>`}).join('')}</div>`:'<div class="small dim">없음</div>'}</div>`}
 /* own = 'tr:<id>' | 'mon:<id>' (로스터) */
 function bindSheet(el){const path=own=>{const [k,id]=own.split(':');return ['roster',k==='tr'?'trainers':'mons',id,'fields']};const get=own=>{const [k,id]=own.split(':');const o=(R()[k==='tr'?'trainers':'mons']||{})[id];return o?{name:o.name,fields:fix(o.fields)}:null};
  const save=async(own,list)=>A().set(path(own),list);
  el.querySelectorAll('[data-sfa]').forEach(b=>b.onclick=e=>{e.stopPropagation();const o=get(b.dataset.sfa);if(!o)return;editor(null,o.name,async v=>{if(await save(b.dataset.sfa,[...o.fields,v]))A().toast('넣었다')})});
  el.querySelectorAll('[data-sfe]').forEach(b=>b.onclick=e=>{e.stopPropagation();const o=get(b.dataset.sfe);const k=+b.dataset.k;if(!o||!o.fields[k])return;editor(o.fields[k],o.name,async v=>{const L=o.fields.slice();L[k]=v;if(await save(b.dataset.sfe,L))A().toast('고쳤다')})});
  el.querySelectorAll('[data-sfd]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const o=get(b.dataset.sfd);const k=+b.dataset.k;if(!o||!o.fields[k]||!confirm(`「${o.fields[k].name}」을(를) 지울까?`))return;const L=o.fields.slice();L.splice(k,1);await save(b.dataset.sfd,L)})}

 /* ----- 전개 · 걷기 (맵툴 active_field_field / reset_field_field) ----- */
 async function deploy(key,turns){const e=find(key);if(!e)return A().toast('그 필드를 찾지 못했다');
  if(!mine(e.o))return A().toast('내 트레이너 · 포켓몬의 필드만 전개할 수 있다');
  if(e.o.kind==='m'&&!e.o.on&&!gm())return A().toast(`「${e.o.name}」이(가) 배틀 필드에 나와 있어야 한다`);
  if(!mgr()){/* 배틀을 직접 못 쓰는 좌석 → GM 화면이 받아서 */if(await A().set(['pub',ST().seat,'stageq'],{key,turns:turns||0,at:Date.now()}))A().toast('전개를 요청했다 — GM 화면이 받아 펼친다');return}
  return put(e,turns)}
 async function put(e,turns){const b=ST().state.battle||{};const old=stage(b);
  const s={type:kindOf(e),name:e.name,loc:e.loc||'',img:e.img||'',eff:e.eff||'',color:e.color||'',owner:e.o.name,count:turns>0?turns:(+e.count>0?+e.count:1000),src:e.key,tid:e.o.tid,at:Date.now()};
  if(e.o.kind==='m')s.ownerMid=e.o.id;
  if(!await A().set(['battle','field','stage'],s))return false;
  const k=kindOf(s);const lines=[`◆ ${e.o.name}의 《${keyOf(s)}》 전개${s.loc?' — '+s.loc:''}${s.count>=1000?' · 무한':' · '+s.count+'턴'}`,...effLines(s.eff).map(l=>'· '+l)];
  if(old&&old.src!==s.src)lines.unshift(`《${keyOf(old)}》의 풍경이 옅어져 간다…`);
  if(k===0&&F()&&F().grounded){const off=Object.values(b.mons||{}).filter(m=>m.entry&&m.hp&&m.hp.cur>0&&!F().grounded(m)).map(m=>'「'+m.name+'」');if(off.length)lines.push('◆ 땅 위에 있지 않아 이 「필드」의 영향을 받지 않음 : '+off.join(''))}
  A().sysLog(lines.join('\n'),'battle');return true}
 async function reset(){const s=stage();if(!s)return;
  if(!mgr()){if(s.tid===ST().seat&&await A().set(['pub',ST().seat,'stageq'],{reset:1,src:s.src,at:Date.now()}))A().toast('걷기를 요청했다');return}
  if(await A().set(['battle','field','stage'],null))A().sysLog(`《${keyOf(s)}》의 풍경이 옅어져 간다…`,'battle')}
 /* GM 화면: 좌석의 요청을 받아 처리 (그 좌석 것인지 다시 확인) */
 let busy=false;
 async function absorb(){if(!gm()||busy)return;const pub=ST().state.pub||{};const todo=Object.keys(pub).filter(sid=>pub[sid]&&pub[sid].stageq);if(!todo.length)return;busy=true;
  try{for(const sid of todo){const q=pub[sid].stageq;await A().set(['pub',sid,'stageq'],null);if(!q||Date.now()-(+q.at||0)>120000)continue;
    if(q.reset){const s=stage();if(s&&s.tid===sid&&s.src===q.src&&await A().set(['battle','field','stage'],null))A().sysLog(`《${keyOf(s)}》의 풍경이 옅어져 간다…`,'battle');continue}
    const e=find(q.key);if(!e||e.o.tid!==sid)continue;if(e.o.kind==='m'&&!e.o.on)continue;await put(e,+q.turns||0)}}
  finally{busy=false}}

 /* ----- 턴 종료 (맵툴 progress_field_field): f 는 battle_ui 턴 종료의 필드 사본, 줄을 돌려준다 ----- */
 function turnEnd(b,f){const s=f&&f.stage;if(!s||!s.name)return [];const out=[];
  const om=s.ownerMid&&(b.mons||{})[s.ownerMid];
  if(s.ownerMid&&(!om||!om.entry||!(om.hp&&om.hp.cur>0))){out.push(`주인 「${om?om.name:s.owner}」이(가) 필드에 없어 《${keyOf(s)}》의 풍경이 옅어져 간다…`);delete f.stage;return out}
  if(s.count>0&&s.count<1000){s.count--;if(s.count<=0){out.push(`《${keyOf(s)}》의 풍경이 옅어져 간다…`);delete f.stage}}
  return out}

 /* ----- 전개 연출 (맵툴 field_fx_show): 상태에 새 stage.at 이 오면 모든 화면에서 한 번 ----- */
 let seen=null;
 function onState(){absorb();const s=stage();const at=s?s.at||0:0;if(seen===null){seen=at;return}if(at===seen)return;seen=at;if(!s||Date.now()-at>20000)return;play(s)}
 function play(s){const old=$('#stfx');if(old)old.remove();const k=kindOf(s);const col=tcol(s.color);const u=bgSrc(s.img);
  const el=document.createElement('div');el.id='stfx';el.className='stfx '+KIND_CLS[k];el.style.setProperty('--c1',col.bg||'#5fd38d');
  el.innerHTML=`<div class="dim"></div><div class="flash"></div><div class="fstage"><div class="fbar"></div><div class="fld">${u?`<img src="${esc(u)}" alt="">`:''}<div class="fshade"></div><div class="ftx"><div class="fkind">${KIND_EN[k]}</div><div class="fname">《${esc(s.name)}》</div>${s.loc?`<div class="floc">${esc(s.loc)}</div>`:''}${s.owner?`<div class="floc">${esc(s.owner)}</div>`:''}</div></div><div class="fbar b"></div></div>`;
  el.onclick=()=>el.remove();document.body.appendChild(el);setTimeout(()=>el.remove(),4300)}
 return {chip,bgStyle,info,open,deploy,reset,turnEnd,onState,stage,play,hasMine,editor,sheetSec,bindSheet,fix};
})();
