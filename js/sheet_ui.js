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
 /* 바뀐 칸만 쓴다 (점검 3-18) — src = 사본을 뜬 원본, n = 고친 사본. 시트를 통째로 쓰면 그 사이 남이 고친 칸이 지워진다 */
 const putMon=(id,src,n)=>A().setDiff(['roster','mons',id],src,n,1);
 const putTr=(id,src,n)=>A().setDiff(['roster','trainers',id],src,n,1);
 function canEdit(c,tid){return c.gm||(!!tid&&tid===c.seat)}
 /* 볼 수 있는 시트: GM 은 전부, 좌석은 내 것 + 휴대폰 연락처의 파티원(같은 방 코드 · 공유 켠 사람) */
 function canSee(c,tid){if(c.gm)return true;if(!c.seat)return false;if(tid===c.seat)return true;const ph=id=>((((c.ST.state.pub||{})[id]||{}).phone)||{});const my=String(ph(c.seat).room||'').trim();if(!my)return false;const o=ph(tid);return String(o.room||'').trim()===my&&o.share!==false}
 const typeChip=en=>A().typeChip(en);

 /* ---------- 렌더 ---------- */
 function render(el){
  const c=ctx();const trs=c.r.trainers||{};const ids=Object.keys(trs).filter(id=>canSee(c,id)).sort((a,b)=>(trs[a].ord||0)-(trs[b].ord||0)||trs[a].name.localeCompare(trs[b].name));
  if(!ids.includes(UI.tid))UI.tid=ids.includes(c.seat)?c.seat:(ids[0]||'');
  const t=trs[UI.tid];
  el.innerHTML=`<div class="sheet">
   <div class="ttabs">${ids.map(id=>`<button class="ttab ${id===UI.tid?'on':''}" data-tid="${id}">${esc(trs[id].name)}${id===c.seat?' <span class="tag me">ME</span>':''}</button>`).join('')}
    <span class="sp"></span>${c.gm?`<button class="btn sm" data-act="import">제작기에서 가져오기</button><button class="btn sm ghost" data-act="newtr">+ 새 트레이너</button>`:(c.seat?`<button class="btn sm ${trs[c.seat]?'ghost':'pri'}" data-act="import" title="제작기에 있는 내 트레이너를 내 자리로 가져온다">${trs[c.seat]?'내 파티 다시 불러오기':'내 파티 불러오기'}</button>`:'')}</div>
   ${t?trainerView(c,t):'<div class="empty">아직 트레이너가 없다.'+(c.gm?' 「제작기에서 가져오기」로 시작한다.':(c.seat?' 「내 파티 불러오기」로 제작기의 트레이너를 가져온다. 남의 시트는 휴대폰 연락처에서 같은 방 코드로 들어와야 보인다.':' 자리에 앉은 뒤 「내 파티 불러오기」.'))+'</div>'}
  </div>`;
  el.querySelectorAll('.ttab').forEach(b=>b.onclick=()=>{UI.tid=b.dataset.tid;UI.mid='';A().renderScene()});
  el.querySelectorAll('[data-act]').forEach(b=>{if(b.tagName==='SELECT'||b.tagName==='INPUT')return;b.onclick=e=>{e.stopPropagation();action(b.dataset)}});
  el.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{UI.mid=b.dataset.pick;A().renderScene()});
  el.querySelectorAll('[data-stab]').forEach(b=>b.onclick=()=>{UI.tab=b.dataset.stab;A().renderScene()});
  el.querySelectorAll('[data-up]').forEach(inp=>inp.onchange=async()=>{const f=inp.files[0];if(!f)return;if(f.size>5*1024*1024)return A().toast('5MB 이하만');A().toast('그림을 올리는 중…');
   try{const url=await DBS().uploadImage(`rooms/${c.ST.room}/${inp.dataset.up==='tr'?'t_':'m_'}${inp.dataset.id}`,f);await A().set(['roster',inp.dataset.up==='tr'?'trainers':'mons',inp.dataset.id,'image'],url);A().toast('올렸다')}catch(e){A().toast('올리지 못했다: '+e.message)}});
  bindAuto(el,c);bindEdits(el,c)}
 function bindAuto(el,c){if(!el||!window.OM_FX_UI)return;const t=c.r.trainers[UI.tid];if(!t||!canEdit(c,t.id))return;
  el.querySelectorAll('[data-auto]').forEach(bt=>bt.onclick=()=>{const mm=c.r.mons[UI.mid];if(!mm)return;const name=bt.dataset.name;const pot=[...(mm.pots||[]),mm.excl,...(mm.exclX||[])].find(p=>p&&p.name===name);
   window.OM_FX_UI.openEditor({mon:mm,kind:bt.dataset.auto,name,text:pot?pot.eff:(bt.dataset.auto==='trait'?mm.abilityEff:mm.itemEff),save:async auto=>{const src=c.r.mons[UI.mid];const nm=JSON.parse(JSON.stringify(src));nm.auto=nm.auto||{};const key=String(name).replace(/『|』/g,'');if(auto)nm.auto[key]=auto;else delete nm.auto[key];await putMon(UI.mid,src,nm);
    const bm=((A().ST.state.battle||{}).mons||{})[UI.mid];if(bm){await A().set(['battle','mons',UI.mid,'auto'],nm.auto)}A().toast(auto?'구문을 저장했다':'구문을 지웠다');A().renderScene()}})});
  /* 트레이너 고유 포텐셜의 구문 */
  el.querySelectorAll('[data-uauto]').forEach(bt=>bt.onclick=()=>{const i=+bt.dataset.uauto;const tt=c.r.trainers[UI.tid];const u=(tt.unique||[])[i];if(!u)return;const fake={name:tt.name,auto:u.auto?{[u.name]:u.auto}:{},tid:''};
   window.OM_FX_UI.openEditor({mon:fake,kind:'pot',name:u.name,text:u.eff||'',save:async auto=>{const src=c.r.trainers[UI.tid];const nt=JSON.parse(JSON.stringify(src));nt.unique[i]=Object.assign({},nt.unique[i]);if(auto)nt.unique[i].auto=auto;else delete nt.unique[i].auto;await putTr(UI.tid,src,nt);
    const btr=((A().ST.state.battle||{}).trainers||{})[UI.tid];if(btr){await A().set(['battle','trainers',UI.tid,'unique'],nt.unique)}A().toast(auto?'구문을 저장했다':'구문을 지웠다');A().renderScene()}})});
 }

 function trainerView(c,t){
  const mons=(t.pids||[]).map(id=>c.r.mons[id]).filter(Boolean);const ed=canEdit(c,t.id);const E=UI.edit&&ed;
  if(!mons.find(m=>m.id===UI.mid))UI.mid=mons[0]?mons[0].id:'';
  const base=t.base||{};
  const tiles=[['포켓몬',mons.length],['메인',base['메인']??'-'],['통솔점',base['통솔점']??'-'],['분배레벨',base['분배레벨']??'-'],['할인점',base['「기술 할인점」']??'-'],['1/시',base['【1/시】']??'-']];
  return `<div class="hero">
    <div class="hpic" style="${t.image?`background-image:url('${cssu(t.image)}')`:''}">${t.image?'':'<span>사진</span>'}</div>
    <div class="hmain"><div class="hname">${E?`<input type="text" data-te="name" value="${esc(t.name)}">`:esc(t.name)}</div>
     <div class="hbadges">${['육성','지시','통솔','능력'].map(k=>E?`<label class="hb">${k} <select data-te="rank_${k}">${['',...RANKS,'B-','A-','AA-'].map(r=>`<option value="${r}" ${(t.ranks||{})[k]===r?'selected':''}>${r||'-'}</option>`).join('')}</select></label>`:`<span class="hb">${k} <b>${esc((t.ranks||{})[k]||'-')}</b></span>`).join('')}${t.solo?'<span class="hb">1인 기준</span>':''}</div>
     ${E?`<div class="row small" style="margin-top:6px"><label>사진 주소 <input type="text" data-te="image" value="${esc(t.image&&!t.image.startsWith('data:')?t.image:'')}" placeholder="https://… (비우면 그대로)" style="width:320px"></label><label class="btn xs">파일 올리기<input type="file" accept="image/*" data-up="tr" data-id="${t.id}" hidden></label></div>`:''}</div>
    <div class="tiles">${tiles.map(([k,v])=>`<div class="tile"><b>${esc(String(v))}</b><span>${k}</span></div>`).join('')}</div>
   </div>
   <div class="stabs"><button class="stab ${UI.tab==='char'?'on':''}" data-stab="char">캐릭터</button><button class="stab ${UI.tab==='poke'?'on':''}" data-stab="poke">포켓몬</button><button class="stab ${UI.tab==='grow'?'on':''}" data-stab="grow">성장</button><button class="stab ${UI.tab==='battle'?'on':''}" data-stab="battle">전투</button>
    <span class="sp"></span>${ed?`<button class="btn sm ${UI.edit?'pri':''}" data-act="toggleedit">${UI.edit?'편집 끝':'✎ 편집'}</button>`:''}${(c.gm||t.id===c.seat)?`<button class="btn sm ghost" data-act="refresh" data-tid="${t.id}" title="제작기 시트에서 다시 읽어 온다 (개체값·소지품·HP는 유지)">제작기 동기화</button><button class="btn sm ghost danger" data-act="deltr" data-tid="${t.id}">삭제</button>`:''}</div>
   ${UI.tab==='char'?charTab(c,t,E):UI.tab==='poke'?pokeTab(c,t,mons,E):UI.tab==='grow'?growTab(c,t,mons,E):battleTab(c,t,mons,E)}`}

 function charTab(c,t,E){
  const d=t.detail||{};const st=t.stands||[];const act=+t.standActive||0;
  const standSec=`<div class="spanel"><div class="sh">스탠딩 <span class="note">무대에 서는 전신 그림 · 제작기에서 넣으면 「제작기 동기화」로 따라온다</span><span class="sp"></span>${canEdit(c,t.id)?`<button class="btn sm" data-act="stands">표정·스탠딩 편집</button>`:''}</div>
   ${st.length?`<div class="stgrid">${st.map((s,i)=>`<div class="stcard ${i===act?'on':''}"><div class="sth" style="${s.src?`background-image:url('${cssu(s.src)}')`:''}"></div><b>${esc(s.label||'기본')}</b>${i===act?' <span class="tag me">기본</span>':''}</div>`).join('')}</div>`:`<div class="small dim">아직 없다 — 초상(위 그림)으로 선다</div>`}</div>`;
  return standSec+`<div class="spanel two">
   <div><div class="sh">자질</div><table class="t">${['육성','지시','통솔','능력'].map(k=>`<tr><th style="width:60px">${k} ${esc((t.ranks||{})[k]||'-')}</th><td>${E?`<input type="text" data-te="detail_${k}" value="${esc(d[k]||'')}" style="width:100%">`:esc(d[k]||'')}</td></tr>`).join('')}</table>
    <div class="sh" style="margin-top:12px">고유 포텐셜</div>${(t.unique||[]).length?`<table class="t">${t.unique.map((u,i)=>`<tr><th style="width:140px;white-space:normal">${E?`<input type="text" data-te="uniq_name_${i}" value="${esc(u.name)}" style="width:100%">`:esc(u.name)}${u.name?uniqAutoBtn(u,i):''}</th><td class="pre small">${E?`<textarea data-te="uniq_eff_${i}" rows="3" style="width:100%">${esc(u.eff)}</textarea>`:esc(u.eff)}</td></tr>`).join('')}</table>`:'<div class="dim small">없음</div>'}${E?`<button class="btn xs" data-act="adduniq">+ 고유</button>`:''}</div>
   <div><div class="sh">메모</div>${E?`<textarea data-te="memo" rows="12" style="width:100%">${esc(t.memo||'')}</textarea>`:`<div class="pre small">${esc(t.memo||'')||'<span class="dim">없음</span>'}</div>`}</div>
  </div>`}

 function pokeTab(c,t,mons,E){
  const m=mons.find(x=>x.id===UI.mid);
  const strip=`<div class="pstrip">${mons.map(x=>`<div class="pcard ${x.id===UI.mid?'on':''}" data-pick="${x.id}"><div class="ppic" style="${x.image?`background-image:url('${cssu(x.image)}')`:''}"></div><div class="pn">${esc(x.name)}</div><div class="pl">Lv.${x.lv} ${x.partner?'<span class="tag">파트너</span>':''}</div></div>`).join('')}
   ${E?`<button class="btn sm ghost" data-act="addmon">+ 포켓몬</button>`:''}</div>`;
  if(!m)return strip+'<div class="empty">포켓몬이 없다.</div>';
  const eff=TYPES18.map(ty=>({ty,v:S().effect(ty,m.teraActive&&m.teraEn!=='-'?[m.teraEn]:m.types)}));
  const lab=v=>v===0?'무':v>=4?'약×4':v>1?'약':v<=0.25?'내¼':v<1?'내':'';
  const sheetHp=m.sheetHp==null?m.hp.max:Math.min(m.sheetHp,m.hp.max);
  const traitNames=Object.keys(DB().traits||{}),itemNames=Object.keys(DB().items||{}),moveNames=Object.keys(DB().moves||{});
  return strip+`<div class="pview">
   <div class="pportrait"><div class="ppbig" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}">${m.image?'':'<span>그림 없음</span>'}</div><div class="ppname">${esc(m.role||'')}${m.pride?' · 프라이드 '+esc(m.pride):''}</div>
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
    <table class="t" style="margin-top:10px"><tr><th style="width:70px">특성</th><td>${E?`<div class="row"><input type="text" data-me="ability" list="traitlist" value="${esc(m.ability)}" style="flex:1"><button class="btn sm" data-db="trait" data-me-target="ability">DB</button></div><datalist id="traitlist">${traitNames.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>`:`<b>${esc(m.ability||'-')}</b>`}<div class="dbmini">${window.OM_DB_UI.effectHtml('trait',m.ability)||`<span class="small dim">${esc(m.abilityEff)}</span>`}</div>${m.ability?autoBtn(m,'trait',m.ability,E):''}</td></tr>
     <tr><th>소지품</th><td>${E?`<div class="row"><input type="text" data-me="item" list="itemlist2" value="${esc(m.item||'')}" style="flex:1"><button class="btn sm" data-db="item" data-me-target="item">DB</button></div><datalist id="itemlist2">${itemNames.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>`:`<b>${esc(m.item||'-')}</b>`}<div class="dbmini">${window.OM_DB_UI.effectHtml('item',m.item)||`<span class="small dim">${esc(m.itemEff)}</span>`}</div>${m.item?autoBtn(m,'item',m.item,E):''}</td></tr></table>
   </div></div>
   <div class="spanel"><div class="sh">기술 ${m.moves.length}</div>
    ${E?`<div class="row small" style="margin-bottom:6px">${m.moves.map((mv,i)=>`<span class="tg">${esc(mv.name)} <button class="btn xs ghost danger" data-act="delmove" data-i="${i}">×</button></span>`).join('')}<input type="text" id="addmove" list="movelist" placeholder="기술 이름 입력 후 Enter" style="width:220px"><button class="btn sm" id="addmovedb">DB</button><datalist id="movelist">${moveNames.map(n=>`<option value="${esc(n)}">`).join('')}</datalist></div>`:''}
    <table class="t"><tr><th>이름</th><th>타입</th><th>분류</th><th>위력</th><th>명중</th><th>범위</th><th>우선</th><th>효과</th></tr>
    ${m.moves.map(mv=>`<tr><td class="nw"><b class="lnk" data-mvdb="${esc(mv.name)}" title="DB 에서 보기">${esc(mv.name)}</b>${mv.missing?' <span class="small" style="color:var(--red)">DB 없음</span>':''}</td><td class="nw">${typeChip(mv.typeEn)}</td><td class="nw">${esc(mv.cat)}</td><td class="mono">${mv.pow||'-'}</td><td class="mono">${mv.acc||'필중'}</td><td class="nw">${esc(mv.range)}</td><td class="mono">${mv.prio||0}</td><td class="pre small eff">${esc(mv.eff)}</td></tr>`).join('')}</table></div>
   <div class="spanel two"><div><div class="sh">포텐셜 ${m.pots.filter(p=>!p.ph).length}</div><table class="t">${m.pots.map((p,i)=>`<tr${p.ph?' style="opacity:.45"':''}><th style="width:140px;white-space:normal">${E?`<input type="text" data-me="pot_name_${i}" value="${esc(p.name)}" style="width:100%">`:esc(p.name)}${p.ph?' <span class="small">(미정)</span>':''}<div class="small dim">${esc(p.kind)}</div>${p.name&&!p.ph?autoBtn(m,'pot',p.name,E):''}</th><td class="pre small">${E?`<textarea data-me="pot_eff_${i}" rows="2" style="width:100%">${esc(p.eff)}</textarea>`:(p.ph?'':esc(p.eff))}</td></tr>`).join('')}</table>${E?`<button class="btn xs" data-act="addpot">+ 포텐셜</button>`:''}</div>
    <div><div class="sh">전용 포텐셜</div>${m.excl||E?`<table class="t"><tr><th style="width:140px;white-space:normal">${E?`<input type="text" data-me="excl_name" value="${esc(m.excl?m.excl.name:'')}" style="width:100%">`:esc(m.excl.name)}${m.excl&&m.excl.name?autoBtn(m,'pot',m.excl.name,E):''}</th><td class="pre small">${E?`<textarea data-me="excl_eff" rows="3" style="width:100%">${esc(m.excl?m.excl.eff:'')}</textarea>`:esc(m.excl.eff)}</td></tr>${(m.exclX||[]).map(x=>`<tr><th>${esc(x.name)}${autoBtn(m,'pot',x.name,E)}</th><td class="pre small">${esc(x.eff)}</td></tr>`).join('')}</table>`:'<div class="dim small">없음</div>'}
     <div class="sh" style="margin-top:12px">메모</div>${E?`<textarea data-me="memo" rows="6" style="width:100%">${esc(m.memo||'')}</textarea>`:`<div class="pre small">${esc(m.memo||'')||'<span class="dim">없음</span>'}</div>`}
     ${E?`<div class="row" style="margin-top:8px"><button class="btn xs ghost danger" data-act="delmon" data-mid="${m.id}">이 포켓몬 삭제</button></div>`:''}</div></div>`}

 function growTab(c,t,mons,E){
  return `<div class="spanel"><div class="sh">레벨</div>
   <div class="small dim" style="margin-bottom:6px">기본 레벨은 육성 ${esc((t.ranks||{})['육성']||'-')} → ${S().baseLevel((t.ranks||{})['육성'])}. 분배레벨 ${esc(String((t.base||{})['분배레벨']??'-'))} 안에서 포켓몬마다 보정을 나눈다. 실수치 = floor(종족치×2×Lv/100) + 5 (HP 는 + Lv + 10).</div>
   <table class="t"><tr><th>포켓몬</th><th>Lv</th><th>보정</th><th>개체값 <span class="dim small">(알까기 · 육성 ${esc((t.ranks||{})['육성']||'-')} → ${S().hatchCount(t)}회)</span></th><th>실수치 (HP/공/방/특공/특방/스피드)</th></tr>
   ${mons.map(m=>`<tr><td class="nw"><b>${esc(m.name)}</b></td><td class="mono">${m.lv}</td><td>${E?`<input type="number" class="n" data-mg="dist" data-mid="${m.id}" value="${m.dist||0}">`:(m.dist||0)}</td><td class="nw"><span class="mono small">${(m.iv||[]).length?esc(m.iv.join('/'))+' <span class="dim">합 '+S().ivSum(m.iv)+'</span>':'<span class="dim">없음</span>'}</span>${canEdit(c,t.id)?` <button class="btn xs" data-act="hatch" data-mid="${m.id}">🥚 알까기</button>`:''}</td><td class="mono small">${m.stats.join(' / ')}</td></tr>`).join('')}</table>
   <div class="small dim" style="margin-top:6px">분배레벨 합: ${mons.reduce((a,m)=>a+(+m.dist||0),0)} / ${esc(String((t.base||{})['분배레벨']??'-'))}</div></div>`}

 /* 자동화 구문 버튼: 레디메이드 자동 / 이 포켓몬의 구문 / 없음 */
 function uniqAutoBtn(u,i){const K=window.OM_FX;if(!K)return '';const has=u.auto&&u.auto.ops&&u.auto.ops.length;const base=K.rm(u.name);const rmHas=base&&base.ops&&base.ops.length&&!base.manual;
  return `<div class="small" style="margin-top:2px"><button class="btn xs ${has?'pri':rmHas?'':'ghost'}" data-uauto="${i}" title="${esc(has?K.unparse(u.auto.ops).join(' / '):rmHas?'레디메이드 자동: '+K.unparse(base.ops).join(' / '):'자동화 없음 — 구문을 써 넣을 수 있다')}">${has?'구문 ✓':rmHas?'자동':'구문'}</button></div>`}
 function autoBtn(m,kind,name,E){const K=window.OM_FX;if(!K)return '';const own=(m.auto||{})[String(name).replace(/『|』/g,'')];const base=K.autoOf(Object.assign({},m,{auto:{}}),kind,name);const has=own&&own.ops&&own.ops.length;const rmHas=base&&base.ops&&base.ops.length&&!base.manual;
  return `<div class="small" style="margin-top:2px"><button class="btn xs ${has?'pri':rmHas?'':'ghost'}" data-auto="${esc(kind)}" data-name="${esc(name)}" title="${esc(has?K.unparse(own.ops).join(' / '):rmHas?'레디메이드 자동: '+K.unparse(base.ops).join(' / '):'자동화 없음 — 구문을 써 넣을 수 있다')}">${has?'구문 ✓':rmHas?'자동':'구문'}</button></div>`}
 function battleTab(c,t,mons,E){
  const OO=window.OM_ORDERS;
  const inB=!!((A().ST.state.battle||{}).trainers||{})[t.id];
  return `<div class="spanel two"><div><div class="sh">지령·명령 <span class="note">4식 6령 — 맵툴 trainer_mgr 와 같은 표</span></div>
    <div id="opanel">${OO.panel(t,E)}</div></div>
   <div><div class="sh">배틀</div><div class="small dim" style="margin-bottom:8px">${inB?'지금 배틀에 들어가 있다. 시트를 고쳤으면 다시 보내야 반영된다 (HP·상태는 배틀 쪽이 따로).':'배틀 씬으로 보내면 이 시트의 레벨·개체값·기술이 그대로 들어간다.'}</div>
    ${c.gm||(t.id===A().ST.seat&&((A().ST.state.rp||{}).plBattle!==false||(A().ST.state.rp||{}).seatOwn===true))?`<div class="row"><button class="btn" data-act="tobattle" data-tid="${t.id}" data-side="left">좌측 진영으로</button><button class="btn" data-act="tobattle" data-tid="${t.id}" data-side="right">우측 진영으로</button></div>`:'<div class="dim small">보내기는 GM 이 한다.</div>'}
    <div class="sh" style="margin-top:14px">파티 순서</div><div class="small dim">첫 칸이 파트너(대표 각성체).</div>
    ${E?`<ol class="porder">${mons.map((m,i)=>`<li>${esc(m.name)} <button class="btn xs ghost" data-act="mvup" data-i="${i}">↑</button><button class="btn xs ghost" data-act="mvdn" data-i="${i}">↓</button> <label class="small"><input type="checkbox" data-me-partner="${m.id}" ${m.partner?'checked':''}> 파트너</label></li>`).join('')}</ol>`:`<ol class="porder">${mons.map(m=>`<li>${esc(m.name)}${m.partner?' <span class="tag">파트너</span>':''}</li>`).join('')}</ol>`}</div></div>`}

 /* ---------- 편집 바인딩 (변경 즉시 저장) ---------- */
 let saveT=null;const pending={tr:null,mon:null,tr0:null,mon0:null,g0:null};
 function bindEdits(el,c){
  const t=c.r.trainers[UI.tid];if(!t||!UI.edit||!canEdit(c,t.id))return;
  const m=c.r.mons[UI.mid];
  const queue=()=>{clearTimeout(saveT);saveT=setTimeout(flush,500)};
  el.querySelectorAll('[data-te]').forEach(inp=>inp.addEventListener('input',()=>{if(!pending.tr){pending.tr0=JSON.parse(JSON.stringify(t));pending.tr=JSON.parse(JSON.stringify(t))}const nt=pending.tr;applyTr(nt,inp.dataset.te,inp.value);queue()}));
  const op=el.querySelector('#opanel');if(op)window.OM_ORDERS.bind(op,()=>pending.tr||c.r.trainers[UI.tid],async nt=>{const src=pending.tr0||c.r.trainers[UI.tid];pending.tr=null;pending.tr0=null;await putTr(nt.id,src,nt);A().renderScene()});
  if(m){el.querySelectorAll('[data-me]').forEach(inp=>inp.addEventListener('input',()=>{if(!pending.mon){pending.mon0=JSON.parse(JSON.stringify(m));pending.mon=JSON.parse(JSON.stringify(m))}const nm=pending.mon;applyMon(nm,inp.dataset.me,inp.value,t);queue()}));
   el.querySelectorAll('[data-db]').forEach(bt=>bt.onclick=()=>{const k=bt.dataset.meTarget;const inp=el.querySelector(`[data-me="${k}"]`);window.OM_DB_UI.open({kind:bt.dataset.db,sel:inp.value,q:'',pick:async name=>{const src=c.r.mons[m.id]||m;const nm=JSON.parse(JSON.stringify(src));applyMon(nm,k,name,t);await putMon(m.id,src,nm);A().renderScene()}})});
   el.querySelectorAll('[data-me-partner]').forEach(cb=>cb.addEventListener('change',async()=>{const mid=cb.dataset.mePartner;await A().set(['roster','mons',mid,'partner'],cb.checked)}));
   const addMove=async n=>{if(!n)return;if(!(DB().moves||{})[n]&&!confirm(`「${n}」은 기술 DB에 없다. 그래도 넣을까?`))return;const src=c.r.mons[UI.mid];const nm=JSON.parse(JSON.stringify(src));nm.moves=nm.moves.filter(x=>x.name!=='발버둥'||nm.moves.length>1);nm.moves.push(I().move(n,false));await putMon(UI.mid,src,nm)};
   const am=$('#addmove',el);if(am)am.addEventListener('keydown',async e=>{if(e.key!=='Enter'||e.isComposing)return;e.preventDefault();addMove(am.value.trim())});
   const amd=$('#addmovedb',el);if(amd)amd.onclick=()=>window.OM_DB_UI.open({kind:'move',sel:am.value.trim(),pick:n=>addMove(n)});
   el.querySelectorAll('[data-mvdb]').forEach(b=>b.onclick=()=>window.OM_DB_UI.open({kind:'move',sel:b.dataset.mvdb}))}
  el.querySelectorAll('[data-mg]').forEach(inp=>inp.addEventListener('input',()=>{const mid=inp.dataset.mid;const src=c.r.mons[mid];if(!src)return;pending.g=pending.g||{};pending.g0=pending.g0||{};if(!pending.g[mid]){pending.g0[mid]=JSON.parse(JSON.stringify(src));pending.g[mid]=JSON.parse(JSON.stringify(src))}const nm=pending.g[mid];const [k,i]=inp.dataset.mg.split('_');
   if(k==='dist')nm.dist=+inp.value||0;recalc(nm,t);queue()}));
  async function flush(){const jobs=[];if(pending.tr){jobs.push(putTr(pending.tr.id,pending.tr0,pending.tr));pending.tr=null;pending.tr0=null}if(pending.mon){jobs.push(putMon(pending.mon.id,pending.mon0,pending.mon));pending.mon=null;pending.mon0=null}
   if(pending.g){for(const mid in pending.g)jobs.push(putMon(mid,(pending.g0||{})[mid],pending.g[mid]));pending.g=null;pending.g0=null}await Promise.all(jobs)}}
 function applyTr(t,k,v){
  if(k==='name')t.name=v;else if(k==='image'){if(v)t.image=v}else if(k==='memo')t.memo=v;else if(k.startsWith('rank_')){t.ranks=t.ranks||{};t.ranks[k.slice(5)]=v}
  else if(k.startsWith('detail_')){t.detail=t.detail||{};t.detail[k.slice(7)]=v}else if(k==='orderStyle')t.orderStyle=+v;else if(k==='commandStyle'){t.commandStyle=+v;t.orderStyle=window.OM_ORDERS.tordOf(+v)}
  if(k==='rank_지시'){const rs=window.OM_ORDERS.resync(t);if(rs){Object.assign(t,rs);A().toast(`지시 ${v} → 지령·명령 계열을 다시 맞췄다`)}}
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
   case 'hatch':return openHatch(d.mid);
   case 'stands':return window.OM_RP_UI.openStands(t.id);
   case 'refresh':return refreshFromMaker(d.tid);
   case 'deltr':if(!c.gm&&t.id!==c.seat)return A().toast('내 시트만 지울 수 있다');if(!confirm(`${t.name} 와 파티를 로스터에서 지울까?`))return;
    /* GM 도 좌석처럼 하나씩 지운다 — 로스터를 통째로 쓰면 그 사이 남이 고친 시트가 지워진다 (점검 2-4) */
    {for(const id of (t.pids||[]))if(c.r.mons[id])await A().set(['roster','mons',id],null);await A().set(['roster','trainers',t.id],null)}
    UI.tid='';A().renderScene();return
   case 'addmon':{if(!t||!canEdit(c,t.id))return;const id='m'+rnd(7);const nm=I().pokemon({id,data:{data:{id,name:'새 포켓몬',t1:'노말',base:['50','50','50','50','50','50'],moves:[]}}},t);nm.src='new';await A().set(['roster','mons',id],nm);await A().set(['roster','trainers',t.id,'pids'],[...(t.pids||[]),id]);UI.mid=id;A().renderScene();return}
   case 'delmon':{const m=c.r.mons[d.mid];if(!m||!confirm(`${m.name} 을 지울까?`))return;await A().set(['roster','trainers',t.id,'pids'],(t.pids||[]).filter(x=>x!==d.mid));await A().set(['roster','mons',d.mid],null);UI.mid='';A().renderScene();return}
   case 'delmove':{const m=c.r.mons[UI.mid];const nm=JSON.parse(JSON.stringify(m));nm.moves.splice(+d.i,1);if(!nm.moves.length)nm.moves=[I().move('발버둥',false)];await putMon(UI.mid,m,nm);return}
   case 'addpot':{const m=c.r.mons[UI.mid];const nm=JSON.parse(JSON.stringify(m));nm.pots.push({name:'',kind:'',eff:''});await putMon(UI.mid,m,nm);return}
   case 'adduniq':{const nt=JSON.parse(JSON.stringify(t));nt.unique=nt.unique||[];nt.unique.push({name:'',eff:''});await putTr(t.id,t,nt);return}
   case 'mvup':case 'mvdn':{const p=[...(t.pids||[])];const i=+d.i,j=d.act==='mvup'?i-1:i+1;if(j<0||j>=p.length)return;[p[i],p[j]]=[p[j],p[i]];await A().set(['roster','trainers',t.id,'pids'],p);return}
   case 'tobattle':return A().loadFromRoster(d.tid,d.side)}}

 /* 제작기 → 로스터 */
 /* 제작기 서명(mkm_me: 이름 + 비밀구) → 해시. 제작기와 같은 사이트(mangryoung.github.io)라 localStorage 를 같이 쓴다 */
 async function makerMe(){try{const o=JSON.parse(localStorage.getItem('mkm_me')||'null');if(!o||!o.secret||!(window.crypto&&crypto.subtle))return '';const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('mkm:'+String(o.secret)));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,24)}catch(e){return ''}}
 async function openImport(){const c=ctx();if(!c.gm&&!c.seat)return;
  let mk;try{mk=await A().loadMaker()}catch(e){return A().toast('제작기 DB를 읽지 못했다: '+e.message)}
  const fold=new Map(mk.folders.map(f=>[f.id,(f.data||{}).name||f.id]));
  /* 제작기에서 비공개로 둔 트레이너·폴더는 GM 과 만든 사람(같은 브라우저의 제작기 서명)에게만 보인다 */
  const me=await makerMe();const fpriv=new Map(mk.folders.map(f=>[f.id,f.data||{}]));const see=o=>!o||!o.priv||c.gm||!!(me&&o.owner===me);
  const list=mk.trainers.map(t=>({id:t.id,d:(t.data&&t.data.data)||{},ord:(t.data||{}).ord||0})).filter(t=>see(t.d)&&see(fpriv.get(t.d.folder))).sort((a,b)=>(fold.get(a.d.folder)||'').localeCompare(fold.get(b.d.folder)||'')||a.ord-b.ord);
  const md=A().openModal(`<div class="mhead"><h2>제작기에서 가져오기</h2><span class="sp"></span><button class="btn sm ghost" id="mkRefresh">새로 읽기</button><button class="btn ghost" data-x>닫기</button></div>
   <input type="text" id="tq" placeholder="트레이너 이름으로 찾기" style="width:100%;margin-bottom:8px">
   <ul class="pick" id="tl">${list.map(t=>`<li data-id="${t.id}"><span class="small dim" style="min-width:90px">${esc(fold.get(t.d.folder)||'-')}</span><b>${esc(t.d.name||'(이름 없음)')}</b><span class="small dim">${esc(['육성','지시','통솔','능력'].map(k=>k+' '+((t.d.ranks||{})[k]||'-')).join(' · '))} · ${(t.d.pids||[]).length}체</span><span class="sp"></span>${c.r.trainers[t.id]?'<span class="tag">있음</span>':''}<button class="btn sm pri" data-pick="${t.id}">가져오기</button></li>`).join('')}</ul>`);
  $('#mkRefresh',md).onclick=async()=>{await A().loadMaker(true);A().closeModal();openImport()};
  $('#tq',md).oninput=e=>{const q=e.target.value.trim();md.querySelectorAll('#tl li').forEach(li=>li.style.display=!q||li.textContent.includes(q)?'':'none')};
  md.querySelectorAll('[data-pick]').forEach(bt=>bt.onclick=async()=>{const tdoc=mk.trainers.find(t=>t.id===bt.dataset.pick);const asId=c.gm?'':c.seat;if(!c.gm&&c.r.trainers[c.seat]&&!confirm(`내 자리의 「${c.r.trainers[c.seat].name}」를 「${(tdoc.data&&tdoc.data.data||{}).name||''}」로 바꿀까? (HP·랭크·메모는 새로 시작)`))return;await importTrainer(tdoc,mk.pokemon,false,asId);A().closeModal();UI.tid=asId||tdoc.id;UI.tab='poke';A().renderScene()})}
 /* base64 그림은 저장소에 올리고 주소로 바꾼다 (방 상태를 가볍게) */
 async function hostImages(room,trainer,mons){const jobs=[];
  const up=async(obj,path)=>{if(!obj.image||!obj.image.startsWith('data:'))return;try{obj.image=await DBS().uploadImage(path,obj.image)}catch(e){console.warn('이미지 올리기 실패',e);obj.image=obj.image.length<150000?obj.image:'';A().toast('그림을 올리지 못했다 (Storage 설정을 확인): '+e.message)}};
  jobs.push(up(trainer,`rooms/${room}/t_${trainer.id}`));for(const m of mons)jobs.push(up(m,`rooms/${room}/m_${m.id}`));await Promise.all(jobs)}
 /* asId: 좌석이 제 자리로 가져올 때 — 트레이너 id 를 좌석 id 로 바꾸고 제작기 id 는 mkId 에 둔다 (새로고침용). GM 이 같은 제작기 트레이너를 또 가져오면 그 자리를 다시 쓴다 */
 async function importTrainer(tdoc,pokeDocs,keep,asId){const c=ctx();const {trainer,mons}=I().party(tdoc,pokeDocs);
  if(!asId){const dup=Object.values(c.r.trainers||{}).find(x=>x.mkId===tdoc.id&&x.id!==tdoc.id);if(dup)asId=dup.id}
  if(asId){trainer.mkId=tdoc.id;trainer.id=asId;for(const m of mons)m.tid=asId}
  const r0=JSON.parse(JSON.stringify(c.r));r0.trainers=r0.trainers||{};r0.mons=r0.mons||{};await hostImages(c.ST.room,trainer,mons);const r=JSON.parse(JSON.stringify(r0));const old=r.trainers[trainer.id];
  trainer.ord=old?old.ord:Object.keys(r.trainers).length;trainer.src='maker';if(old){for(const k of ['orderStyle','commandStyle','orderCount','orderBase','orderPreset','orderType'])if(old[k]!=null)trainer[k]=old[k];trainer.memo=old.memo;const rs=window.OM_ORDERS.resync(trainer);if(rs)Object.assign(trainer,rs)}
  if(!trainer.orderCount)Object.assign(trainer,window.OM_ORDERS.auto(trainer,'assoc',1));if(old){if(old.image&&!trainer.image)trainer.image=old.image;if(!(trainer.stands||[]).length&&(old.stands||[]).length){trainer.stands=old.stands;trainer.standActive=old.standActive}else{for(const s of trainer.stands||[]){const o=(old.stands||[]).find(x=>x.src===s.src);if(!s.kind&&o&&o.kind)s.kind=o.kind}}}
  for(const id of ((old&&old.pids)||[]))if(!trainer.pids.includes(id))delete r.mons[id];
  for(const m of mons){const om=r.mons[m.id];m.src='maker';if(om&&keep){m.iv=om.iv;m.item=om.item||m.item;m.itemEff=om.itemEff||m.itemEff;m.sheetHp=om.sheetHp;m.dist=om.dist;m.ev=om.ev;if(om.image&&!m.image)m.image=om.image;if(!(m.stands||[]).length&&(om.stands||[]).length){m.stands=om.stands;m.standActive=om.standActive||0}recalc(m,trainer)}r.mons[m.id]=m}
  r.trainers[trainer.id]=trainer;
  /* 바뀐 칸만 쓴다 (점검 2-4) — GM 도 로스터를 통째로 쓰지 않는다. 그림을 올리는 사이 남이 고친 시트가 지워지지 않게 */
  await A().setMany(A().diffOps(['roster'],r0,r,3));
  await ensureNode(trainer);
  A().toast(`${trainer.name} 파티 ${mons.length}체를 ${old?'갱신했다':'가져왔다'}`)}
 /* 관계도 노드: 같은 이름이 없으면 PC/NPC 구분대로 만든다 (휴대폰 협력자 · 연락처가 쓴다). 좌석은 graph 를 못 쓰니 GM 일 때만 */
 async function ensureNode(trainer){const c=ctx();if(!c.gm)return;const g=c.ST.state.graph||{nodes:{},edges:{}};const nodes=g.nodes||{};if(Object.values(nodes).some(n=>n.name===trainer.name))return;const i=Object.keys(nodes).length;
  await A().set(['graph','nodes','t_'+trainer.id],{id:'t_'+trainer.id,name:trainer.name,kind:trainer.kind==='npc'?'npc':'pc',img:'',note:'',x:120+(i%6)*140,y:120+Math.floor(i/6)*140,stands:[],standActive:0})}
 async function refreshFromMaker(tid){const c=ctx();const t=c.r.trainers[tid];if(!t)return;if(t.src==='new')return A().toast('제작기에서 온 트레이너가 아니다');
  let mk;try{mk=await A().loadMaker(true)}catch(e){return A().toast(e.message)}const tdoc=mk.trainers.find(x=>x.id===(t.mkId||tid));if(!tdoc)return A().toast('제작기에 이 트레이너가 없다');await importTrainer(tdoc,mk.pokemon,true,t.mkId?tid:'');A().renderScene()}

 /* 알까기 — 후보마다 능력치 이름과 값, 0–1 / 30–31 표시, 개별 다시 굴림 · 개별 수정(✎) · 추가 굴림. 전부 다시 굴림과 합 130 넘는 후보 다시 굴림은 한 번 더 묻는다 */
 function openHatch(mid){const c=ctx();const m=c.r.mons[mid];const t=c.r.trainers[m.tid]||c.r.trainers[UI.tid];if(!m||!canEdit(c,t.id))return;const count=S().hatchCount(t);let rolls=S().hatch(count);let chosen=-1,editing=-1;const used={extra:0,one:0,all:0,edit:0};const edited=new Set();const BIG=130;
  const cell=v=>`<b class="${v<=1?'lo':v>=30?'hi':''}">${v}</b>`;
  const ivTable=iv=>`<div class="ivt">${STATS_KO.map(k=>`<span>${k}</span>`).join('')}${iv.map(cell).join('')}</div>`;
  const ivEdit=(iv,i)=>`<div class="ivt ed">${STATS_KO.map(k=>`<span>${k}</span>`).join('')}${iv.map((v,k)=>`<input type="number" min="0" max="31" value="${v}" data-ivi="${i}" data-ivk="${k}">`).join('')}</div>`;
  const md=A().openModal(`<div class="mhead"><h2>알까기 — ${esc(m.name)}</h2><span class="small dim" id="ivcnt"></span><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="ivnow"><span class="small dim">지금</span>${(m.iv||[]).length?ivTable(m.iv)+`<span class="small">합 <b>${S().ivSum(m.iv)}</b></span>`:'<span class="small dim">없음</span>'}</div>
   <div class="small dim" style="margin:6px 0">하나를 눌러 고른다 · <b class="ivlg lo">0–1</b> 낮음 · <b class="ivlg hi">30–31</b> 높음 · 🎲 = 그 후보만 다시 굴림 · ✎ = 값 고치기 (0–31)</div>
   <div class="ivgrid" id="ivbox"></div>
   <div class="row" style="margin-top:12px"><button class="btn ghost" id="ivre">전부 다시 굴림</button><button class="btn ghost" id="ivadd">+ 추가 굴림</button><span class="sp"></span><button class="btn pri" id="ivok">적용</button></div>`);
  const draw=()=>{$('#ivcnt',md).textContent=`육성 ${(t.ranks||{})['육성']||'-'} → ${count}회${used.extra?' + 추가 '+used.extra+'회':''}`;
   $('#ivbox',md).innerHTML=rolls.map((r,i)=>{const sum=S().ivSum(r);return `<div class="ivc ${chosen===i?'on':''}" data-iv="${i}"><div class="ivh"><span class="dim">#${i+1}</span><span class="sp"></span>${edited.has(i)?'<span class="ivmod">수정됨</span>':''}<span class="ivsum ${sum>BIG?'big':''}">합 ${sum}</span><button class="btn xs ghost" data-ivr="${i}" title="이 후보만 다시 굴림">🎲</button><button class="btn xs ghost ${editing===i?'on':''}" data-ive="${i}" title="${editing===i?'고치기 끝':'이 후보 값 고치기'}">${editing===i?'✓':'✎'}</button></div>${editing===i?ivEdit(r,i):ivTable(r)}</div>`}).join('');
   md.querySelectorAll('[data-iv]').forEach(b=>b.onclick=()=>{chosen=+b.dataset.iv;draw()});
   md.querySelectorAll('[data-ivr]').forEach(b=>b.onclick=e=>{e.stopPropagation();const i=+b.dataset.ivr;const sum=S().ivSum(rolls[i]);
    if(sum>BIG&&!confirm(`#${i+1} 은 합 ${sum} — ${BIG} 넘는 후보다. 정말 다시 굴릴까?`))return;rolls[i]=S().rollIv();used.one++;edited.delete(i);if(editing===i)editing=-1;if(chosen===i)chosen=-1;draw()});
   md.querySelectorAll('[data-ive]').forEach(b=>b.onclick=e=>{e.stopPropagation();const i=+b.dataset.ive;editing=editing===i?-1:i;draw();if(editing===i){const f=md.querySelector(`[data-ivi="${i}"]`);f&&f.select()}});
   md.querySelectorAll('[data-ivi]').forEach(f=>{f.onclick=e=>e.stopPropagation();
    f.onchange=()=>{const i=+f.dataset.ivi,k=+f.dataset.ivk;let v=Math.round(+f.value);if(!isFinite(v))v=0;v=Math.max(0,Math.min(31,v));if(rolls[i][k]!==v){rolls[i]=rolls[i].slice();rolls[i][k]=v;if(!edited.has(i)){edited.add(i);used.edit++}}draw();const n=md.querySelector(`[data-ivi="${i}"][data-ivk="${k+1}"]`);n&&n.select()};
    f.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();f.onchange()}}})};draw();
  $('#ivre',md).onclick=()=>{const big=rolls.filter(r=>S().ivSum(r)>BIG).length;
   if(!confirm(`후보 ${rolls.length}개가 전부 새로 바뀐다.${big?`\n합 ${BIG} 넘는 후보 ${big}개도 같이 사라진다.`:''}\n정말 다시 굴릴까?`))return;rolls=S().hatch(count+used.extra);used.all++;chosen=-1;editing=-1;edited.clear();draw()};
  $('#ivadd',md).onclick=()=>{rolls.push(S().rollIv());used.extra++;draw();const g=$('#ivbox',md);g.lastElementChild&&g.lastElementChild.scrollIntoView({block:'nearest'})};
  $('#ivok',md).onclick=async()=>{if(chosen<0)return A().toast('하나 골라 줘');const nm=JSON.parse(JSON.stringify(m));nm.iv=rolls[chosen];recalc(nm,t);A().closeModal();
   const note=[used.extra?`추가 ${used.extra}회`:'',used.one?`개별 다시 굴림 ${used.one}회`:'',used.all?`전부 다시 굴림 ${used.all}회`:'',edited.has(chosen)?'고른 후보는 손으로 고침':used.edit?`다른 후보 ${used.edit}개 손으로 고침`:''].filter(Boolean).join(' · ');
   if(await putMon(mid,m,nm))A().sysLog(`${m.name} 알까기 → ${nm.iv.join('/')} (합 ${S().ivSum(nm.iv)})${note?' · '+note:''}`)}}

 return {render,UI,importTrainer};
})();
