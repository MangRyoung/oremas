/* ---------- 파티 불러오기 창 (11-09 망령 「파티 불러오기 ui 꼬라지 — 이미지도 뜨게, 자질 좀 더 잘 나오게, 소지들도 서머리 정돈,
   폴더 · 정리 · 숨김 기능 다 있어야 할 거 아냐, 야생도 저렇게 많이 깔아두면 나보고 어쩌라고」) ----------
   · 폴더 = 시트 탭과 같은 폴더 (OM_SHEET_UI.foldOf — GM 이 정한 sfold → 제작기 폴더 이름 → 던전 야생은 「야생 · 던전」), 순서 = roster.sfo
   · 위 칩: 전체 / 폴더마다 / 야생(던전 야생을 하나로) / 미분류 / 숨김 — 「전체」에서는 폴더마다 접는 묶음, 야생 묶음은 처음엔 접힘
   · 숨기기: 이 브라우저 · 방마다 (불러오기 창에서만 안 보인다 — 시트는 그대로). 「숨김」 칩에서 다시 보이기
   · 찾기(트레이너 · 포켓몬 이름) · 정렬(시트 순서 / 이름 / 평균 레벨) · 마지막에 본 칩과 정렬은 기억
   · 줄 = 트레이너 초상 · 이름 · 자질(지시 · 육성 · 통솔 · 능력) · 소지 포켓몬(초상 · Lv · 타입 · 특성 · 소지품 요약) · 2체 기준 · 불러오기 */
"use strict";
window.OM_LP_UI=(()=>{
 const A=()=>window.OM_APP,SH=()=>window.OM_SHEET_UI,S=()=>window.OM_STATS;
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const cssu=u=>String(u||'').replace(/['"()\\\s]/g,c=>encodeURIComponent(c));
 const ST=()=>A().ST;const room=()=>ST().room||'';
 const RK=['지시','육성','통솔','능력'];
 const LS={get:(k,d)=>{try{const v=localStorage.getItem(k+room());return v==null?d:JSON.parse(v)}catch(e){return d}},set:(k,v)=>{try{localStorage.setItem(k+room(),JSON.stringify(v))}catch(e){}}};
 const hidden=()=>{const o=LS.get('om_lphide_',{});return o&&typeof o==='object'?o:{}};
 const closed=()=>{const o=LS.get('om_lpcl_',{});return o&&typeof o==='object'?o:{}};
 const isW=f=>/^야생/.test(f||'');
 const isCl=f=>{const o=closed();return o[f]!=null?!!o[f]:isW(f)};
 const foldOf=t=>{try{const S2=SH();if(S2&&S2.foldOf)return S2.foldOf(t)||''}catch(e){}const v=String(t&&t.sfold!=null?t.sfold:((t&&t.folderName)||'')).trim();return v||(t&&t.wild?'야생':'')};
 const tcol=en=>{try{return S().typeColor(en)}catch(e){return {bg:'#2d3240',fg:'#fff'}}};
 const tko=en=>{try{return S().typeKo(en)}catch(e){return en}};
 const gradeCls=g=>({S:'s',A:'a',B:'b',C:'c',D:'d',E:'e'})[String(g||'').trim().charAt(0).toUpperCase()]||'n';
 const monTypes=m=>{const en=(m.types||[]).filter(x=>x&&x!=='-');if(en.length)return en;return (m.typesKo||[]).filter(x=>x&&x!=='-').map(k=>{try{return S().typeEn(k)}catch(e){return k}})};
 const monLv=m=>+m.lv||+m.level||0;

 function rowsOf(){const r=(ST().state.roster)||{trainers:{},mons:{}};const trs=r.trainers||{};const ms=r.mons||{};
  return Object.keys(trs).map(id=>{const t=trs[id];const pids=(t.pids||[]).filter(x=>ms[x]);const inc=new Set(A().twoPids(t));
   const mons=pids.map(x=>ms[x]);const lvs=mons.map(monLv).filter(Boolean);
   return {id,t,f:foldOf(t),mons,inc,avg:lvs.length?Math.round(lvs.reduce((a,b)=>a+b,0)/lvs.length):0,n:inc.size}})}

 function monChip(m,on){const ty=monTypes(m);const lv=monLv(m);
  const tip=[m.name+(lv?` Lv ${lv}`:''),ty.map(tko).join('/'),m.ability?'특성 '+m.ability:'',m.item?'소지품 '+m.item:'',m.awaken?'각성체':'',on?'':'(2체 기준 — 이번엔 빠진다)'].filter(Boolean).join(' · ');
  return `<span class="lpm${on?'':' off'}" title="${esc(tip)}"><i class="lpmp" style="${m.image?`background-image:url('${cssu(m.image)}');`:''}border-color:${esc(tcol(ty[0]).bg)}">${m.image?'':esc(String(m.name||'?').charAt(0))}${m.awaken?'<em class="lpaw">각</em>':''}</i><span class="lpmn">${esc(m.name||'?')}</span><span class="lpml">${lv?'Lv '+lv:''}<span class="lpty">${ty.map(en=>`<b style="background:${esc(tcol(en).bg)}" title="${esc(tko(en))}"></b>`).join('')}</span></span>${m.item?`<span class="lpmi">${esc(m.item)}</span>`:''}</span>`}

 function rowHtml(R,inB,H){const t=R.t;const id=R.id;const gm=ST().role==='gm';const seat=ST().seat;
  const inBat=inB[id]||Object.values(inB).some(x=>x&&x.srcTid===id);const tw=A().twoAble(t)&&(gm||id===seat);
  return `<div class="lpr${inBat?' inb':''}" data-lpid="${esc(id)}">
   <div class="lpp" style="${t.image?`background-image:url('${cssu(t.image)}')`:''}">${t.image?'':esc(String(t.name||'?').charAt(0))}</div>
   <div class="lpb">
    <div class="lph"><b class="lpn">${esc(t.name||'(이름 없음)')}</b>${id===seat?'<span class="tag me">ME</span>':''}${inBat?'<span class="tag">배틀에 있음</span>':''}${(!gm&&id!==seat)?'<span class="tag" title="불러온 사람이 지시한다 (내 몫으로 올림)">빌려 쓰기</span>':''}${R.f?`<span class="lpf">${esc(R.f)}</span>`:''}</div>
    <div class="lprk">${RK.map(k=>{const g=(t.ranks||{})[k]||'-';return `<span class="lpg g-${gradeCls(g)}"><small>${k}</small><b>${esc(g)}</b></span>`}).join('')}<span class="lpcnt">${R.n}체${R.avg?` · 평균 Lv ${R.avg}`:''}</span></div>
    <div class="lpms">${R.mons.map(m=>monChip(m,R.inc.has(m.id))).join('')||'<span class="dim small">포켓몬 없음</span>'}</div>
   </div>
   <div class="lpa">${tw?`<button class="btn xs ${t.two?'on':'ghost'}" data-lptwo="${esc(id)}" title="미사그 대학: 각성체 2체만 + 제작기 「2체 기준」 4식 · 6령 / 다시 누르면 6체">${t.two?'2체 기준 ✓':'6체 · 2체로'}</button>`:''}<button class="btn xs ghost" data-lphide="${esc(id)}" title="${H?'불러오기 창에 다시 보이기':'불러오기 창에서 숨긴다 (이 브라우저 · 이 방만 — 시트는 그대로)'}">${H?'다시 보이기':'숨기기'}</button><button class="btn sm pri" data-lppick="${esc(id)}">불러오기</button></div></div>`}

 function open(side){
  const st={q:'',F:LS.get('om_lpf_','*'),sort:LS.get('om_lps_','ord')};
  const md=A().openModal(`<div class="mhead"><h2>${side==='left'?'좌측':'우측'} 진영에 파티 불러오기</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div id="lpbox" class="lpbox"></div>`);
  md.classList.add('lpmodal');const box=md.querySelector('#lpbox');
  const draw=()=>{const all=rowsOf();const H=hidden();const inB=(ST().state.battle||{}).trainers||{};const seat=ST().seat;
   const R0=(((ST().state.roster)||{}).sfo);const FO=Array.isArray(R0)?R0:[];const foi=f=>{const i=FO.indexOf(f);return i<0?1e4+(isW(f)?5e3:0):i};
   const vis=all.filter(R=>!H[R.id]);const hid=all.filter(R=>H[R.id]);
   const folds=[...new Set(vis.map(R=>R.f).filter(f=>f&&!isW(f)))].sort((a,b)=>foi(a)-foi(b)||a.localeCompare(b));
   const wN=vis.filter(R=>isW(R.f)).length,uN=vis.filter(R=>!R.f).length;
   let F=st.F;if(F!=='*'&&!(F==='@야생'?wN:F===''?uN:F==='@숨김'?hid.length:folds.includes(F)))F='*';
   const q=st.q.trim().toLowerCase();const hit=R=>!q||String(R.t.name||'').toLowerCase().includes(q)||R.mons.some(m=>String(m.name||'').toLowerCase().includes(q))||String(R.f).toLowerCase().includes(q);
   let L=(F==='@숨김'?hid:F==='*'?vis:F==='@야생'?vis.filter(R=>isW(R.f)):F===''?vis.filter(R=>!R.f):vis.filter(R=>R.f===F)).filter(hit);
   const so={ord:(a,b)=>(a.t.ord||0)-(b.t.ord||0),name:(a,b)=>String(a.t.name||'').localeCompare(String(b.t.name||'')),lv:(a,b)=>b.avg-a.avg}[st.sort]||((a,b)=>0);
   L.sort((a,b)=>((b.id===seat)-(a.id===seat))||so(a,b)||String(a.t.name||'').localeCompare(String(b.t.name||'')));
   /* 「전체」: 폴더마다 묶음 — 내 자리 · 폴더 순서 · 미분류 · 야생(하나로) */
   const gk=R=>isW(R.f)?'야생':(R.f||'미분류');
   const groups=[];if(F==='*'&&!q){const G=new Map();for(const R of L){const k=gk(R);if(!G.has(k))G.set(k,[]);G.get(k).push(R)}
     const ko=k=>k==='야생'?2e4:k==='미분류'?1.5e4:foi(k);[...G.keys()].sort((a,b)=>ko(a)-ko(b)||a.localeCompare(b)).forEach(k=>groups.push([k,G.get(k)]))}
   else groups.push(['',L]);
   const chip=(v,lab,n)=>`<button type="button" class="tfold ${F===v?'on':''}" data-lpf="${esc(v)}">${esc(lab)} <small>${n}</small></button>`;
   box.innerHTML=`<div class="lptop"><input type="search" id="lpq" placeholder="트레이너 · 포켓몬 · 폴더 찾기" value="${esc(st.q)}"><select id="lps" title="정렬"><option value="ord" ${st.sort==='ord'?'selected':''}>시트 순서</option><option value="name" ${st.sort==='name'?'selected':''}>이름순</option><option value="lv" ${st.sort==='lv'?'selected':''}>평균 레벨 높은 순</option></select>${ST().role==='gm'&&SH()&&SH().openFolders?'<button class="btn sm ghost" id="lpfo" title="시트 탭과 같은 폴더 — 이름을 적어 묶는다">폴더 정리</button>':''}</div>
    <div class="tfolds lpfolds">${chip('*','전체',vis.length)}${folds.map(f=>chip(f,f,vis.filter(R=>R.f===f).length)).join('')}${uN&&folds.length?chip('','미분류',uN):''}${wN?chip('@야생','야생',wN):''}${hid.length?chip('@숨김','숨김',hid.length):''}</div>
    <div class="lplist">${L.length?groups.map(([k,rs])=>{if(!k)return rs.map(R=>rowHtml(R,inB,!!H[R.id])).join('');const cl=isCl(k);return `<div class="lpgrp${cl?' cl':''}"><button type="button" class="lpgh" data-lpg="${esc(k)}"><i>${cl?'▸':'▾'}</i> ${esc(k)} <small>${rs.length}</small>${k==='야생'?'<small class="dim"> — 던전 야생 시트</small>':''}</button>${cl?'':rs.map(R=>rowHtml(R,inB,false)).join('')}</div>`}).join(''):`<div class="empty">${all.length?'맞는 트레이너가 없다.':'로스터가 비어 있다.'}</div>`}</div>
    <div class="row" style="margin-top:10px"><span class="small muted">트레이너는 「시트」 탭에서 제작기에서 가져오거나 새로 만든다. 숨기기는 이 창에서만 (이 브라우저).</span><span class="sp"></span><button class="btn sm" id="lpsheet">시트 탭으로</button></div>`;
   const qi=box.querySelector('#lpq');qi.oninput=()=>{st.q=qi.value;const p=qi.selectionStart;draw();const q2=box.querySelector('#lpq');q2.focus();try{q2.setSelectionRange(p,p)}catch(e){}};
   box.querySelector('#lps').onchange=e=>{st.sort=e.target.value;LS.set('om_lps_',st.sort);draw()};
   const fo=box.querySelector('#lpfo');if(fo)fo.onclick=()=>{A().closeModal();SH().openFolders()};
   box.querySelector('#lpsheet').onclick=()=>{A().closeModal();A().goView('sheet')};
   box.querySelectorAll('[data-lpf]').forEach(b=>b.onclick=()=>{st.F=b.dataset.lpf;LS.set('om_lpf_',st.F);draw()});
   box.querySelectorAll('[data-lpg]').forEach(b=>b.onclick=()=>{const k=b.dataset.lpg;const o=closed();o[k]=isCl(k)?0:1;LS.set('om_lpcl_',o);draw()});
   box.querySelectorAll('[data-lphide]').forEach(b=>b.onclick=()=>{const id=b.dataset.lphide;const o=hidden();if(o[id])delete o[id];else o[id]=1;LS.set('om_lphide_',o);A().toast(o[id]?'숨겼다 — 「숨김」 칩에서 다시 보이게 할 수 있다':'다시 보이게 했다');draw()});
   box.querySelectorAll('[data-lppick]').forEach(b=>b.onclick=async()=>{A().closeModal();await A().loadFromRoster(b.dataset.lppick,side)});
   box.querySelectorAll('[data-lptwo]').forEach(b=>b.onclick=async()=>{const t=((ST().state.roster||{}).trainers||{})[b.dataset.lptwo];if(!t)return;if(await A().setTwo(t.id,!t.two)){draw();setTimeout(draw,400)}})};
  draw()}
 return {open};
})();
