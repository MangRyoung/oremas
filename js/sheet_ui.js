/* ---------- 시트 탭: 방 로스터(트레이너·포켓몬) 관리 ----------
   state.roster = { trainers:{tid:{…}}, mons:{mid:{…}} }  — 제작기에서 가져온 뒤 여기서 레벨·개체값·노력치·소지품·기술·특성을 다듬고, 배틀은 여기서 불러온다.
   편집 권한: GM, 또는 그 트레이너 자리에 앉은 플레이어. */
"use strict";
window.OM_SHEET_UI=(()=>{
 const A=()=>window.OM_APP, S=()=>window.OM_STATS, I=()=>window.OM_IMPORT, DB=()=>window.OM_DB||{}, DBS=()=>window.OM_STORE;
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const $=(s,r)=>(r||document).querySelector(s);
 const STATS_KO=['HP','공격','방어','특공','특방','스피드'];
 const TYPES18=['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];
 const RANKS=['E','D','C','B','A','AA','AAA','S'];
 const UI={tid:'',mid:'',tab:'poke',edit:false};
 const rnd=n=>{const a=new Uint8Array(n||6);crypto.getRandomValues(a);return Array.from(a,b=>'abcdefghijklmnopqrstuvwxyz0123456789'[b%36]).join('')};

 function ctx(){const ST=A().ST;const r=ST.state.roster||{trainers:{},mons:{}};return {ST,r,gm:ST.role==='gm',seat:ST.seat}}
 function canEdit(c,tid){return c.gm||(!!tid&&tid===c.seat)}
 const typeChip=en=>A().typeChip(en);

 /* ---------- 렌더 ---------- */
 function render(el){
  const c=ctx();const trs=c.r.trainers||{};const ids=Object.keys(trs).sort((a,b)=>(trs[a].ord||0)-(trs[b].ord||0)||trs[a].name.localeCompare(trs[b].name));
  if(!ids.includes(UI.tid))UI.tid=ids.includes(c.seat)?c.seat:(ids[0]||'');
  const t=trs[UI.tid];
  el.innerHTML=`<div class="sheet">
   <div class="ttabs">${ids.map(id=>`<button class="ttab ${id===UI.tid?'on':''}" data-tid="${id}">${esc(trs[id].name)}${id===c.seat?' <span class="tag me">ME</span>':''}</button>`).join('')}
    <span class="sp"></span>${c.gm?`<button class="btn sm" data-act="import">제작기에서 가져오기</button><button class="btn sm ghost" data-act="newtr">+ 새 트레이너</button>`:''}</div>
   ${t?trainerView(c,t):'<div class="empty">아직 트레이너가 없다.'+(c.gm?' 「제작기에서 가져오기」로 시작한다.':' GM 이 가져오면 여기에 나온다.')+'</div>'}
  </div>`;
  el.querySelectorAll('.ttab').forEach(b=>b.onclick=()=>{UI.tid=b.dataset.tid;UI.mid='';A().renderScene()});
  el.querySelectorAll('[data-act]').forEach(b=>{if(b.tagName==='SELECT'||b.tagName==='INPUT')return;b.onclick=e=>{e.stopPropagation();action(b.dataset)}});
  el.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{UI.mid=b.dataset.pick;A().renderScene()});
  el.querySelectorAll('[data-stab]').forEach(b=>b.onclick=()=>{UI.tab=b.dataset.stab;A().renderScene()});
  el.querySelectorAll('[data-up]').forEach(inp=>inp.onchange=async()=>{const f=inp.files[0];if(!f)return;if(f.size>5*1024*1024)return A().toast('5MB 이하만');A().toast('그림을 올리는 중…');
   try{const url=await DBS().uploadImage(`rooms/${c.ST.room}/${inp.dataset.up==='tr'?'t_':'m_'}${inp.dataset.id}`,f);await A().set(['roster',inp.dataset.up==='tr'?'trainers':'mons',inp.dataset.id,'image'],url);A().toast('올렸다')}catch(e){A().toast('올리지 못했다: '+e.message)}});
  bindEdits(el,c)}

 function trainerView(c,t){
  const mons=(t.pids||[]).map(id=>c.r.mons[id]).filter(Boolean);const ed=canEdit(c,t.id);const E=UI.edit&&ed;
  if(!mons.find(m=>m.id===UI.mid))UI.mid=mons[0]?mons[0].id:'';
  const base=t.base||{};
  const tiles=[['포켓몬',mons.length],['메인',base['메인']??'-'],['통솔점',base['통솔점']??'-'],['분배레벨',base['분배레벨']??'-'],['할인점',base['「기술 할인점」']??'-'],['1/시',base['【1/시】']??'-']];
  return `<div class="hero">
    <div class="hpic" style="${t.image?`background-image:url('${t.image}')`:''}">${t.image?'':'<span>사진</span>'}</div>
    <div class="hmain"><div class="hname">${E?`<input type="text" data-te="name" value="${esc(t.name)}">`:esc(t.name)}</div>
     <div class="hbadges">${['육성','지시','통솔','능력'].map(k=>E?`<label class="hb">${k} <select data-te="rank_${k}">${['',...RANKS,'B-','A-','AA-'].map(r=>`<option value="${r}" ${(t.ranks||{})[k]===r?'selected':''}>${r||'-'}</option>`).join('')}</select></label>`:`<span class="hb">${k} <b>${esc((t.ranks||{})[k]||'-')}</b></span>`).join('')}${t.solo?'<span class="hb">1인 기준</span>':''}</div>
     ${E?`<div class="row small" style="margin-top:6px"><label>사진 주소 <input type="text" data-te="image" value="${esc(t.image&&!t.image.startsWith('data:')?t.image:'')}" placeholder="https://… (비우면 그대로)" style="width:320px"></label><label class="btn xs">파일 올리기<input type="file" accept="image/*" data-up="tr" data-id="${t.id}" hidden></label></div>`:''}</div>
    <div class="tiles">${tiles.map(([k,v])=>`<div class="tile"><b>${esc(String(v))}</b><span>${k}</span></div>`).join('')}</div>
   </div>
   <div class="stabs"><button class="stab ${UI.tab==='char'?'on':''}" data-stab="char">캐릭터</button><button class="stab ${UI.tab==='poke'?'on':''}" data-stab="poke">포켓몬</button><button class="stab ${UI.tab==='grow'?'on':''}" data-stab="grow">성장</button><button class="stab ${UI.tab==='battle'?'on':''}" data-stab="battle">전투</button>
    <span class="sp"></span>${ed?`<button class="btn sm ${UI.edit?'pri':''}" data-act="toggleedit">${UI.edit?'편집 끝':'✎ 편집'}</button>`:''}${c.gm?`<button class="btn sm ghost" data-act="refresh" data-tid="${t.id}" title="제작기 시트에서 다시 읽어 온다 (개체값·소지품·HP는 유지)">제작기 동기화</button><button class="btn sm ghost danger" data-act="deltr" data-tid="${t.id}">삭제</button>`:''}</div>
   ${UI.tab==='char'?charTab(c,t,E):UI.tab==='poke'?pokeTab(c,t,mons,E):UI.tab==='grow'?growTab(c,t,mons,E):battleTab(c,t,mons,E)}`}

 function charTab(c,t,E){
  const d=t.detail||{};
  return `<div class="spanel two">
   <div><div class="sh">자질</div><table class="t">${['육성','지시','통솔','능력'].map(k=>`<tr><th style="width:60px">${k} ${esc((t.ranks||{})[k]||'-')}</th><td>${E?`<input type="text" data-te="detail_${k}" value="${esc(d[k]||'')}" style="width:100%">`:esc(d[k]||'')}</td></tr>`).join('')}</table>
    <div class="sh" style="margin-top:12px">고유 포텐셜</div>${(t.unique||[]).length?`<table class="t">${t.unique.map((u,i)=>`<tr><th style="width:140px;white-space:normal">${E?`<input type="text" data-te="uniq_name_${i}" value="${esc(u.name)}" style="width:100%">`:esc(u.name)}</th><td class="pre small">${E?`<textarea data-te="uniq_eff_${i}" rows="3" style="width:100%">${esc(u.eff)}</textarea>`:esc(u.eff)}</td></tr>`).join('')}</table>`:'<div class="dim small">없음</div>'}${E?`<button class="btn xs" data-act="adduniq">+ 고유</button>`:''}</div>
   <div><div class="sh">메모</div>${E?`<textarea data-te="memo" rows="12" style="width:100%">${esc(t.memo||'')}</textarea>`:`<div class="pre small">${esc(t.memo||'')||'<span class="dim">없음</span>'}</div>`}</div>
  </div>`}

 function pokeTab(c,t,mons,E){
  const m=mons.find(x=>x.id===UI.mid);
  const strip=`<div class="pstrip">${mons.map(x=>`<div class="pcard ${x.id===UI.mid?'on':''}" data-pick="${x.id}"><div class="ppic" style="${x.image?`background-image:url('${x.image}')`:''}"></div><div class="pn">${esc(x.name)}</div><div class="pl">Lv.${x.lv} ${x.partner?'<span class="tag">파트너</span>':''}</div></div>`).join('')}
   ${E?`<button class="btn sm ghost" data-act="addmon">+ 포켓몬</button>`:''}</div>`;
  if(!m)return strip+'<div class="empty">포켓몬이 없다.</div>';
  const eff=TYPES18.map(ty=>({ty,v:S().effect(ty,m.teraActive&&m.teraEn!=='-'?[m.teraEn]:m.types)}));
  const lab=v=>v===0?'무':v>=4?'약×4':v>1?'약':v<=0.25?'내¼':v<1?'내':'';
  const sheetHp=m.sheetHp==null?m.hp.max:Math.min(m.sheetHp,m.hp.max);
  const traitNames=Object.keys(DB().traits||{}),itemNames=Object.keys(DB().items||{}),moveNames=Object.keys(DB().moves||{});
  return strip+`<div class="pview">
   <div class="pportrait"><div class="ppbig" style="${m.image?`background-image:url('${m.image}')`:''}">${m.image?'':'<span>그림 없음</span>'}</div><div class="ppname">${esc(m.role||'')}${m.pride?' · 프라이드 '+esc(m.pride):''}</div>
    ${E?`<input type="text" data-me="image" value="${esc(m.image&&!m.image.startsWith('data:')?m.image:'')}" placeholder="그림 주소 https://… (비우면 그대로)" style="width:100%;margin-top:6px"><label class="btn xs" style="margin-top:6px">파일 올리기<input type="file" accept="image/*" data-up="mon" data-id="${m.id}" hidden></label>`:''}</div>
   <div class="pinfo">
    <div class="plv">Lv <b>${m.lv}</b> <span class="dim small">기본 ${S().baseLevel((t.ranks||{})['육성'])} ${m.dist?(m.dist>0?'+':'')+m.dist:''}</span></div>
    <div class="pbig">${E?`<input type="text" data-me="name" value="${esc(m.name)}">`:esc(m.name)}</div>
    <div class="row small" style="margin:4px 0">${E?['t1','t2','t3'].map((k,i)=>`<select data-me="${k}">${['-',...((DB().types||{}).kor||[]).filter(x=>x!=='-')].map(x=>`<option value="${x}" ${m.typesKo[i]===x?'selected':''}>${x}</option>`).join('')}</select>`).join(''):m.types.filter(x=>x!=='-').map(typeChip).join('')}
     <span class="dim">테라스탈</span> ${E?`<select data-me="tera">${['-',...((DB().types||{}).kor||[]).filter(x=>x!=='-')].map(x=>`<option value="${x}" ${m.tera===x?'selected':''}>${x}</option>`).join('')}</select>`:esc(m.tera)}
     <span class="dim">성별</span> ${E?`<select data-me="gender">${['-','♂','♀'].map(x=>`<option ${m.gender===x?'selected':''}>${x}</option>`).join('')}</select>`:esc(m.gender||'-')}</div>
    <div class="typerow">${eff.map(e=>{const col=S().typeColor(e.ty);return `<div class="tcell ${e.v!==1?'mark':''}" title="${esc(S().typeKo(e.ty))} ×${e.v}"><span class="tch" style="background:${col.bg};color:${col.fg}">${esc(S().typeKo(e.ty).slice(0,1))}</span><span class="tlab ${e.v>1?'weak':e.v<1?'res':''}">${lab(e.v)||'·'}</span></div>`}).join('')}</div>
    <div class="phpl"><span>HP</span><span class="sp"></span><b class="mono">${sheetHp}</b><span class="dim">/${m.hp.max}</span>${E?`<input type="number" class="n" data-me="sheetHp" value="${sheetHp}">`:''}</div>
    <div class="hpbar ${sheetHp/m.hp.max<=0.25?'low':sheetHp/m.hp.max<=0.5?'mid':''}" style="transform:none"><i style="width:${Math.round(sheetHp/m.hp.max*100)}%"></i></div>
    <div class="stat6" style="margin-top:10px">${m.stats.map((v,i)=>`<div><b>${STATS_KO[i]}</b><span class="v">${esc(m.ranks[i])}</span><div class="bs">${E?`<input type="number" class="n xs" data-me="base_${i}" value="${m.base[i]}">`:m.base[i]}</div><div class="small dim">실수치 ${v}</div></div>`).join('')}</div>
    <table class="t" style="margin-top:10px"><tr><th style="width:70px">특성</th><td>${E?`<div class="row"><input type="text" data-me="ability" list="traitlist" value="${esc(m.ability)}" style="flex:1"><button class="btn sm" data-db="trait" data-me-target="ability">DB</button></div><datalist id="traitlist">${traitNames.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>`:`<b>${esc(m.ability||'-')}</b>`}<div class="dbmini">${window.OM_DB_UI.effectHtml('trait',m.ability)||`<span class="small dim">${esc(m.abilityEff)}</span>`}</div></td></tr>
     <tr><th>소지품</th><td>${E?`<div class="row"><input type="text" data-me="item" list="itemlist2" value="${esc(m.item||'')}" style="flex:1"><button class="btn sm" data-db="item" data-me-target="item">DB</button></div><datalist id="itemlist2">${itemNames.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>`:`<b>${esc(m.item||'-')}</b>`}<div class="dbmini">${window.OM_DB_UI.effectHtml('item',m.item)||`<span class="small dim">${esc(m.itemEff)}</span>`}</div></td></tr></table>
   </div></div>
   <div class="spanel"><div class="sh">기술 ${m.moves.length}</div>
    ${E?`<div class="row small" style="margin-bottom:6px">${m.moves.map((mv,i)=>`<span class="tg">${esc(mv.name)} <button class="btn xs ghost danger" data-act="delmove" data-i="${i}">×</button></span>`).join('')}<input type="text" id="addmove" list="movelist" placeholder="기술 이름 입력 후 Enter" style="width:220px"><button class="btn sm" id="addmovedb">DB</button><datalist id="movelist">${moveNames.map(n=>`<option value="${esc(n)}">`).join('')}</datalist></div>`:''}
    <table class="t"><tr><th>이름</th><th>타입</th><th>분류</th><th>위력</th><th>명중</th><th>범위</th><th>우선</th><th>효과</th></tr>
    ${m.moves.map(mv=>`<tr><td class="nw"><b class="lnk" data-mvdb="${esc(mv.name)}" title="DB 에서 보기">${esc(mv.name)}</b>${mv.missing?' <span class="small" style="color:var(--red)">DB 없음</span>':''}</td><td class="nw">${typeChip(mv.typeEn)}</td><td class="nw">${esc(mv.cat)}</td><td class="mono">${mv.pow||'-'}</td><td class="mono">${mv.acc||'필중'}</td><td class="nw">${esc(mv.range)}</td><td class="mono">${mv.prio||0}</td><td class="pre small eff">${esc(mv.eff)}</td></tr>`).join('')}</table></div>
   <div class="spanel two"><div><div class="sh">포텐셜 ${m.pots.filter(p=>!p.ph).length}</div><table class="t">${m.pots.map((p,i)=>`<tr${p.ph?' style="opacity:.45"':''}><th style="width:140px;white-space:normal">${E?`<input type="text" data-me="pot_name_${i}" value="${esc(p.name)}" style="width:100%">`:esc(p.name)}${p.ph?' <span class="small">(미정)</span>':''}<div class="small dim">${esc(p.kind)}</div></th><td class="pre small">${E?`<textarea data-me="pot_eff_${i}" rows="2" style="width:100%">${esc(p.eff)}</textarea>`:(p.ph?'':esc(p.eff))}</td></tr>`).join('')}</table>${E?`<button class="btn xs" data-act="addpot">+ 포텐셜</button>`:''}</div>
    <div><div class="sh">전용 포텐셜</div>${m.excl||E?`<table class="t"><tr><th style="width:140px;white-space:normal">${E?`<input type="text" data-me="excl_name" value="${esc(m.excl?m.excl.name:'')}" style="width:100%">`:esc(m.excl.name)}</th><td class="pre small">${E?`<textarea data-me="excl_eff" rows="3" style="width:100%">${esc(m.excl?m.excl.eff:'')}</textarea>`:esc(m.excl.eff)}</td></tr>${(m.exclX||[]).map(x=>`<tr><th>${esc(x.name)}</th><td class="pre small">${esc(x.eff)}</td></tr>`).join('')}</table>`:'<div class="dim small">없음</div>'}
     <div class="sh" style="margin-top:12px">메모</div>${E?`<textarea data-me="memo" rows="6" style="width:100%">${esc(m.memo||'')}</textarea>`:`<div class="pre small">${esc(m.memo||'')||'<span class="dim">없음</span>'}</div>`}
     ${E?`<div class="row" style="margin-top:8px"><button class="btn xs ghost danger" data-act="delmon" data-mid="${m.id}">이 포켓몬 삭제</button></div>`:''}</div></div>`}

 function growTab(c,t,mons,E){
  return `<div class="spanel"><div class="sh">레벨</div>
   <div class="small dim" style="margin-bottom:6px">기본 레벨은 육성 ${esc((t.ranks||{})['육성']||'-')} → ${S().baseLevel((t.ranks||{})['육성'])}. 분배레벨 ${esc(String((t.base||{})['분배레벨']??'-'))} 안에서 포켓몬마다 보정을 나눈다. 실수치 = floor(종족치×2×Lv/100) + 5 (HP 는 + Lv + 10).</div>
   <table class="t"><tr><th>포켓몬</th><th>Lv</th><th>보정</th><th>실수치 (HP/공/방/특공/특방/스피드)</th></tr>
   ${mons.map(m=>`<tr><td class="nw"><b>${esc(m.name)}</b></td><td class="mono">${m.lv}</td><td>${E?`<input type="number" class="n" data-mg="dist" data-mid="${m.id}" value="${m.dist||0}">`:(m.dist||0)}</td><td class="mono small">${m.stats.join(' / ')}</td></tr>`).join('')}</table>
   <div class="small dim" style="margin-top:6px">분배레벨 합: ${mons.reduce((a,m)=>a+(+m.dist||0),0)} / ${esc(String((t.base||{})['분배레벨']??'-'))}</div></div>`}

 function battleTab(c,t,mons,E){
  const lists=(DB().const||{}).lists||{};const csv=s=>String(s||'').split(',').map(x=>x.trim()).filter(Boolean);
  const style=+(t.orderStyle||0);const cnt=t.orderCount||{};const OK=['retreat','dodge','endure','return','snipe'],CK=['attack','defense','specialattack','specialdefense','speed','heal','snipe','evasion'];
  const inB=!!((A().ST.state.battle||{}).trainers||{})[t.id];
  return `<div class="spanel two"><div><div class="sh">지령·명령</div>
    <div class="row"><label>계열 ${E?`<select data-te="orderStyle">${[['0','협회식 (4식 6령)'],['1','방해 지령'],['2','교회식 (십계)'],['3','야생']].map(([v,n])=>`<option value="${v}" ${style===+v?'selected':''}>${n}</option>`).join('')}</select>`:['협회식','방해','교회식','야생'][style]}</label></div>
    <div class="row" style="margin-top:6px;align-items:flex-start;gap:20px"><div>${OK.map((k,i)=>{const n=csv(lists['list_order_'+style])[i];return n?`<div class="row small">${esc(n)} ${E?`<input type="number" class="n xs" data-te="oc_order_${k}" value="${cnt['order_'+k]??1}">`:`<b>${cnt['order_'+k]??1}</b>`}</div>`:''}).join('')}</div>
     <div>${CK.map((k,i)=>{const n=csv(lists['list_command_'+style])[i];return n?`<div class="row small">${esc(n)} ${E?`<input type="number" class="n xs" data-te="oc_command_${k}" value="${cnt['command_'+k]??1}">`:`<b>${cnt['command_'+k]??1}</b>`}</div>`:''}).join('')}</div></div></div>
   <div><div class="sh">배틀</div><div class="small dim" style="margin-bottom:8px">${inB?'지금 배틀에 들어가 있다. 시트를 고쳤으면 다시 보내야 반영된다 (HP·상태는 배틀 쪽이 따로).':'배틀 씬으로 보내면 이 시트의 레벨·개체값·기술이 그대로 들어간다.'}</div>
    ${c.gm?`<div class="row"><button class="btn" data-act="tobattle" data-tid="${t.id}" data-side="left">좌측 진영으로</button><button class="btn" data-act="tobattle" data-tid="${t.id}" data-side="right">우측 진영으로</button></div>`:'<div class="dim small">보내기는 GM 이 한다.</div>'}
    <div class="sh" style="margin-top:14px">파티 순서</div><div class="small dim">첫 칸이 파트너(대표 각성체).</div>
    ${E?`<ol class="porder">${mons.map((m,i)=>`<li>${esc(m.name)} <button class="btn xs ghost" data-act="mvup" data-i="${i}">↑</button><button class="btn xs ghost" data-act="mvdn" data-i="${i}">↓</button> <label class="small"><input type="checkbox" data-me-partner="${m.id}" ${m.partner?'checked':''}> 파트너</label></li>`).join('')}</ol>`:`<ol class="porder">${mons.map(m=>`<li>${esc(m.name)}${m.partner?' <span class="tag">파트너</span>':''}</li>`).join('')}</ol>`}</div></div>`}

 /* ---------- 편집 바인딩 (변경 즉시 저장) ---------- */
 let saveT=null;const pending={tr:null,mon:null};
 function bindEdits(el,c){
  const t=c.r.trainers[UI.tid];if(!t||!UI.edit||!canEdit(c,t.id))return;
  const m=c.r.mons[UI.mid];
  const queue=()=>{clearTimeout(saveT);saveT=setTimeout(flush,500)};
  el.querySelectorAll('[data-te]').forEach(inp=>inp.addEventListener('input',()=>{const nt=pending.tr||(pending.tr=JSON.parse(JSON.stringify(t)));applyTr(nt,inp.dataset.te,inp.value);queue()}));
  if(m){el.querySelectorAll('[data-me]').forEach(inp=>inp.addEventListener('input',()=>{const nm=pending.mon||(pending.mon=JSON.parse(JSON.stringify(m)));applyMon(nm,inp.dataset.me,inp.value,t);queue()}));
   el.querySelectorAll('[data-db]').forEach(bt=>bt.onclick=()=>{const k=bt.dataset.meTarget;const inp=el.querySelector(`[data-me="${k}"]`);window.OM_DB_UI.open({kind:bt.dataset.db,sel:inp.value,q:'',pick:async name=>{const nm=JSON.parse(JSON.stringify(c.r.mons[m.id]||m));applyMon(nm,k,name,t);await A().set(['roster','mons',m.id],nm);A().renderScene()}})});
   el.querySelectorAll('[data-me-partner]').forEach(cb=>cb.addEventListener('change',async()=>{const mid=cb.dataset.mePartner;const nm=JSON.parse(JSON.stringify(c.r.mons[mid]));nm.partner=cb.checked;await A().set(['roster','mons',mid],nm)}));
   const addMove=async n=>{if(!n)return;if(!(DB().moves||{})[n]&&!confirm(`「${n}」은 기술 DB에 없다. 그래도 넣을까?`))return;const nm=JSON.parse(JSON.stringify(c.r.mons[UI.mid]));nm.moves=nm.moves.filter(x=>x.name!=='발버둥'||nm.moves.length>1);nm.moves.push(I().move(n,false));await A().set(['roster','mons',UI.mid],nm)};
   const am=$('#addmove',el);if(am)am.addEventListener('keydown',async e=>{if(e.key!=='Enter'||e.isComposing)return;e.preventDefault();addMove(am.value.trim())});
   const amd=$('#addmovedb',el);if(amd)amd.onclick=()=>window.OM_DB_UI.open({kind:'move',sel:am.value.trim(),pick:n=>addMove(n)});
   el.querySelectorAll('[data-mvdb]').forEach(b=>b.onclick=()=>window.OM_DB_UI.open({kind:'move',sel:b.dataset.mvdb}))}
  el.querySelectorAll('[data-mg]').forEach(inp=>inp.addEventListener('input',()=>{const mid=inp.dataset.mid;const src=c.r.mons[mid];if(!src)return;pending.g=pending.g||{};const nm=pending.g[mid]||(pending.g[mid]=JSON.parse(JSON.stringify(src)));const [k,i]=inp.dataset.mg.split('_');
   if(k==='dist')nm.dist=+inp.value||0;recalc(nm,t);queue()}));
  async function flush(){const jobs=[];if(pending.tr){jobs.push(A().set(['roster','trainers',pending.tr.id],pending.tr));pending.tr=null}if(pending.mon){jobs.push(A().set(['roster','mons',pending.mon.id],pending.mon));pending.mon=null}
   if(pending.g){for(const mid in pending.g)jobs.push(A().set(['roster','mons',mid],pending.g[mid]));pending.g=null}await Promise.all(jobs)}}
 function applyTr(t,k,v){
  if(k==='name')t.name=v;else if(k==='image'){if(v)t.image=v}else if(k==='memo')t.memo=v;else if(k.startsWith('rank_')){t.ranks=t.ranks||{};t.ranks[k.slice(5)]=v}
  else if(k.startsWith('detail_')){t.detail=t.detail||{};t.detail[k.slice(7)]=v}else if(k==='orderStyle')t.orderStyle=+v;else if(k.startsWith('oc_')){t.orderCount=t.orderCount||{};t.orderCount[k.slice(3)]=+v||0}
  else if(k.startsWith('uniq_')){const [,f,i]=k.split('_');t.unique=t.unique||[];t.unique[+i]=t.unique[+i]||{name:'',eff:''};t.unique[+i][f]=v}}
 function applyMon(m,k,v,t){
  if(k==='name')m.name=v;else if(k==='image'){if(v)m.image=v}else if(k==='memo')m.memo=v;else if(k==='sheetHp')m.sheetHp=Math.max(0,Math.min(m.hp.max,+v||0));
  else if(k==='t1'||k==='t2'||k==='t3'){m.typesKo[+k[1]-1]=v;m.types=m.typesKo.map(S().typeEn)}else if(k==='tera'){m.tera=v;m.teraEn=v==='-'?'-':S().typeEn(v)}else if(k==='gender')m.gender=v;
  else if(k==='ability'){m.ability=v;const a=(DB().traits||{})[v]||{};m.abilityEff=String(a.multi||a.single||'').replace(/<br\s*\/?>/gi,'\n')}
  else if(k==='item'){m.item=v;const it=(DB().items||{})[v]||{};m.itemEff=String(it.eff||'')}
  else if(k.startsWith('base_')){m.base[+k.slice(5)]=+v||0;recalc(m,t)}
  else if(k.startsWith('pot_')){const [,f,i]=k.split('_');m.pots[+i]=m.pots[+i]||{name:'',kind:'',eff:''};m.pots[+i][f]=v;if(f==='name')m.pots[+i].ph=false}
  else if(k==='excl_name'){m.excl=m.excl||{name:'',eff:''};m.excl.name=v}else if(k==='excl_eff'){m.excl=m.excl||{name:'',eff:''};m.excl.eff=v}}
 function recalc(m,t){m.lv=S().levelOf(t,m);m.stats=S().statsOf(m.base,m.iv,m.ev,m.lv);m.ranks=m.base.map(S().gradeOf);const oldMax=m.hp.max;m.hp.max=m.stats[0];if(m.sheetHp==null||m.sheetHp>=oldMax)m.sheetHp=m.hp.max;m.hp.cur=Math.min(m.hp.cur,m.hp.max)}

 /* ---------- 동작 ---------- */
 async function action(d){const c=ctx();const t=c.r.trainers[UI.tid];
  switch(d.act){
   case 'import':return openImport();
   case 'newtr':{const id='t'+rnd(7);const nt={id,name:'새 트레이너',image:'',ranks:{육성:'C',지시:'C',통솔:'C',능력:'C'},base:{},detail:{},unique:[],pids:[],solo:false,ord:Object.keys(c.r.trainers).length,src:'new'};await A().set(['roster','trainers',id],nt);UI.tid=id;UI.edit=true;A().renderScene();return}
   case 'toggleedit':UI.edit=!UI.edit;A().renderScene();return;
   case 'refresh':return refreshFromMaker(d.tid);
   case 'deltr':if(!confirm(`${t.name} 와 파티를 로스터에서 지울까?`))return;{const r=JSON.parse(JSON.stringify(c.r));for(const id of (t.pids||[]))delete r.mons[id];delete r.trainers[t.id];await A().set(['roster'],r);UI.tid='';A().renderScene();return}
   case 'addmon':{if(!t||!canEdit(c,t.id))return;const id='m'+rnd(7);const nm=I().pokemon({id,data:{data:{id,name:'새 포켓몬',t1:'노말',base:['50','50','50','50','50','50'],moves:[]}}},t);nm.src='new';await A().set(['roster','mons',id],nm);await A().set(['roster','trainers',t.id,'pids'],[...(t.pids||[]),id]);UI.mid=id;A().renderScene();return}
   case 'delmon':{const m=c.r.mons[d.mid];if(!m||!confirm(`${m.name} 을 지울까?`))return;await A().set(['roster','trainers',t.id,'pids'],(t.pids||[]).filter(x=>x!==d.mid));await A().set(['roster','mons',d.mid],null);UI.mid='';A().renderScene();return}
   case 'delmove':{const m=c.r.mons[UI.mid];const nm=JSON.parse(JSON.stringify(m));nm.moves.splice(+d.i,1);if(!nm.moves.length)nm.moves=[I().move('발버둥',false)];await A().set(['roster','mons',UI.mid],nm);return}
   case 'addpot':{const m=c.r.mons[UI.mid];const nm=JSON.parse(JSON.stringify(m));nm.pots.push({name:'',kind:'',eff:''});await A().set(['roster','mons',UI.mid],nm);return}
   case 'adduniq':{const nt=JSON.parse(JSON.stringify(t));nt.unique=nt.unique||[];nt.unique.push({name:'',eff:''});await A().set(['roster','trainers',t.id],nt);return}
   case 'mvup':case 'mvdn':{const p=[...(t.pids||[])];const i=+d.i,j=d.act==='mvup'?i-1:i+1;if(j<0||j>=p.length)return;[p[i],p[j]]=[p[j],p[i]];await A().set(['roster','trainers',t.id,'pids'],p);return}
   case 'tobattle':return A().loadFromRoster(d.tid,d.side)}}

 /* 제작기 → 로스터 */
 async function openImport(){const c=ctx();if(!c.gm)return;
  let mk;try{mk=await A().loadMaker()}catch(e){return A().toast('제작기 DB를 읽지 못했다: '+e.message)}
  const fold=new Map(mk.folders.map(f=>[f.id,(f.data||{}).name||f.id]));
  const list=mk.trainers.map(t=>({id:t.id,d:(t.data&&t.data.data)||{},ord:(t.data||{}).ord||0})).sort((a,b)=>(fold.get(a.d.folder)||'').localeCompare(fold.get(b.d.folder)||'')||a.ord-b.ord);
  const md=A().openModal(`<div class="mhead"><h2>제작기에서 가져오기</h2><span class="sp"></span><button class="btn sm ghost" id="mkRefresh">새로 읽기</button><button class="btn ghost" data-x>닫기</button></div>
   <input type="text" id="tq" placeholder="트레이너 이름으로 찾기" style="width:100%;margin-bottom:8px">
   <ul class="pick" id="tl">${list.map(t=>`<li data-id="${t.id}"><span class="small dim" style="min-width:90px">${esc(fold.get(t.d.folder)||'-')}</span><b>${esc(t.d.name||'(이름 없음)')}</b><span class="small dim">${esc(['육성','지시','통솔','능력'].map(k=>k+' '+((t.d.ranks||{})[k]||'-')).join(' · '))} · ${(t.d.pids||[]).length}체</span><span class="sp"></span>${c.r.trainers[t.id]?'<span class="tag">있음</span>':''}<button class="btn sm pri" data-pick="${t.id}">가져오기</button></li>`).join('')}</ul>`);
  $('#mkRefresh',md).onclick=async()=>{await A().loadMaker(true);A().closeModal();openImport()};
  $('#tq',md).oninput=e=>{const q=e.target.value.trim();md.querySelectorAll('#tl li').forEach(li=>li.style.display=!q||li.textContent.includes(q)?'':'none')};
  md.querySelectorAll('[data-pick]').forEach(bt=>bt.onclick=async()=>{const tdoc=mk.trainers.find(t=>t.id===bt.dataset.pick);await importTrainer(tdoc,mk.pokemon,false);A().closeModal();UI.tid=tdoc.id;UI.tab='poke';A().renderScene()})}
 /* base64 그림은 저장소에 올리고 주소로 바꾼다 (방 상태를 가볍게) */
 async function hostImages(room,trainer,mons){const jobs=[];
  const up=async(obj,path)=>{if(!obj.image||!obj.image.startsWith('data:'))return;try{obj.image=await DBS().uploadImage(path,obj.image)}catch(e){console.warn('이미지 올리기 실패',e);obj.image=obj.image.length<150000?obj.image:'';A().toast('그림을 올리지 못했다 (Storage 설정을 확인): '+e.message)}};
  jobs.push(up(trainer,`rooms/${room}/t_${trainer.id}`));for(const m of mons)jobs.push(up(m,`rooms/${room}/m_${m.id}`));await Promise.all(jobs)}
 async function importTrainer(tdoc,pokeDocs,keep){const c=ctx();const {trainer,mons}=I().party(tdoc,pokeDocs);await hostImages(c.ST.room,trainer,mons);const r=JSON.parse(JSON.stringify(c.r));const old=r.trainers[trainer.id];
  trainer.ord=old?old.ord:Object.keys(r.trainers).length;trainer.src='maker';if(old){trainer.orderStyle=old.orderStyle;trainer.orderCount=old.orderCount;trainer.memo=old.memo;if(old.image&&!trainer.image)trainer.image=old.image}
  for(const id of ((old&&old.pids)||[]))if(!trainer.pids.includes(id))delete r.mons[id];
  for(const m of mons){const om=r.mons[m.id];m.src='maker';if(om&&keep){m.iv=om.iv;m.item=om.item||m.item;m.itemEff=om.itemEff||m.itemEff;m.sheetHp=om.sheetHp;m.dist=om.dist;m.ev=om.ev;if(om.image&&!m.image)m.image=om.image;recalc(m,trainer)}r.mons[m.id]=m}
  r.trainers[trainer.id]=trainer;await A().set(['roster'],r);A().toast(`${trainer.name} 파티 ${mons.length}체를 ${old?'갱신했다':'가져왔다'}`)}
 async function refreshFromMaker(tid){const c=ctx();const t=c.r.trainers[tid];if(!t)return;if(t.src==='new')return A().toast('제작기에서 온 트레이너가 아니다');
  let mk;try{mk=await A().loadMaker(true)}catch(e){return A().toast(e.message)}const tdoc=mk.trainers.find(x=>x.id===tid);if(!tdoc)return A().toast('제작기에 이 트레이너가 없다');await importTrainer(tdoc,mk.pokemon,true);A().renderScene()}

 /* 알까기 */
 function openHatch(mid){const c=ctx();const m=c.r.mons[mid];const t=c.r.trainers[m.tid]||c.r.trainers[UI.tid];if(!m||!canEdit(c,t.id))return;const count=S().hatchCount(t);let rolls=S().hatch(count);let chosen=-1;
  const md=A().openModal(`<div class="mhead"><h2>알까기 — ${esc(m.name)}</h2><span class="small dim">육성 ${esc((t.ranks||{})['육성']||'-')} → ${count}회</span><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="small dim">지금: ${m.iv.join('/')} (합 ${S().ivSum(m.iv)})</div><div class="ivs" id="ivbox" style="margin-top:6px"></div>
   <div class="row" style="margin-top:12px"><button class="btn ghost" id="ivre">다시 굴림</button><span class="sp"></span><button class="btn pri" id="ivok">적용</button></div>`);
  const draw=()=>{$('#ivbox',md).innerHTML=rolls.map((r,i)=>`<button class="btn ${chosen===i?'on':''}" data-iv="${i}">${r.join('/')} <span class="dim">합 ${S().ivSum(r)}</span></button>`).join('');md.querySelectorAll('[data-iv]').forEach(b=>b.onclick=()=>{chosen=+b.dataset.iv;draw()})};draw();
  $('#ivre',md).onclick=()=>{rolls=S().hatch(count);chosen=-1;draw()};
  $('#ivok',md).onclick=async()=>{if(chosen<0)return A().toast('하나 골라 줘');const nm=JSON.parse(JSON.stringify(m));nm.iv=rolls[chosen];recalc(nm,t);A().closeModal();if(await A().set(['roster','mons',mid],nm))A().sysLog(`${m.name} 알까기 → ${nm.iv.join('/')} (합 ${S().ivSum(nm.iv)})`)}}

 return {render,UI,importTrainer};
})();
