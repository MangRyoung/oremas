/* ---------- 현황 창 (10-27 망령): 배틀 벤치 트레이너 「해석 · 묘수 · 설정」 옆 「현황」 ----------
   PT 서머리(포켓몬마다 Lv · 타입 · 역할 · 특성 · HP · 상태 · 기술 소켓 · 전용) · 소지품 착용(포켓몬마다 1~3번 칸) · 소지품 소켓(합 / 「지시」 랭크 상한).
   보는 값은 배틀 쪽 트레이너 · 포켓몬(지금 HP · 다 쓴 소지품 포함). 고치는 곳은 시트 · 상세 창 — 여기는 보기만 */
"use strict";
window.OM_STATUS_UI=(()=>{
 const A=()=>window.OM_APP, DB=()=>window.OM_DB||{};
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const nmI=s=>String(s||'').replace(/『|』/g,'').trim();
 const one=s=>String(s||'').replace(/<br\s*\/?>/g,' ').replace(/\s+/g,' ').trim();
 let TAB='sum';

 /* 소지품 한 칸의 소켓: 소지품 DB → 오리지널 소지품(itemOwn.sock). 모르면 null */
 function sockOf(x){const n=nmI(x.item);if(!n)return null;const it=(DB().items||{})[n];const own=!it&&x.itemOwn&&nmI(x.itemOwn.name)===n?x.itemOwn:null;const v=parseFloat(it?it.sock:own?own.sock:'');return isFinite(v)?v:null}
 const effOf=x=>{const n=nmI(x.item);const it=(DB().items||{})[n];return one(x.itemEff||(it&&it.eff)||'')};
 /* 포켓몬의 소지품 칸들. 1번 칸을 다 써서 없어졌으면(itemUsed) 그 이름으로 「다 씀」 */
 function slots(m){const L=[];const used=m.itemUsed&&!nmI(m.item)?m.itemUsed:null;
  L.push(nmI(m.item)?{k:1,item:m.item,itemEff:m.itemEff,itemOwn:m.itemOwn}:used?{k:1,item:used.name,itemEff:used.eff,gone:true}:{k:1,item:''});
  (m.items2||[]).forEach((x,i)=>L.push(Object.assign({k:i+2},x||{item:''})));return L}
 /* 소켓 합 / 상한 — 시트 탭(OM_SHEET_UI.itemSock)과 같은 셈. 다 쓴 소지품도 세운다(짤 때의 구성) */
 function sock(t,mons){const fake=mons.map(m=>m.itemUsed&&!nmI(m.item)?Object.assign({},m,{item:m.itemUsed.name}):m);
  const SU=window.OM_SHEET_UI;return SU&&SU.itemSock?SU.itemSock(t,fake):null}
 const mvSock=mv=>{const v=parseFloat(mv.sock);return isFinite(v)?v-(mv.half?0.5:0):null};
 const typeChips=m=>(m.types||[]).filter(x=>x&&x!=='-').map(x=>A().typeChip(x)).join('');
 const stKo=k=>(((DB().states||{}).st||{})[k]||{}).ko||k;

 function sumTab(t,mons,SK){
  let tot=0,unk=0;
  const cards=mons.map(m=>{const hp=m.hp||{cur:0,max:0};const r=hp.max?Math.max(0,Math.min(1,hp.cur/hp.max)):0;const dead=hp.cur<=0;
   const mv=(m.moves||[]).filter(x=>x&&x.name&&!x.ext&&x.name!=='발버둥');let ms=0;
   for(const x of mv){const v=mvSock(x);if(v==null)unk++;else ms+=v}ms=Math.round(ms*10)/10;tot+=ms;
   const st=Object.keys(m.states||{}).filter(k=>m.states[k]&&k!=='Dead');
   const XL=[...(m.excl?[m.excl]:[]),...(m.exclX||[])];
   const its=slots(m).filter(x=>nmI(x.item));
   return `<div class="stx-card${dead?' dead':''}${m.partner?' ptnr':''}">
    <div class="stx-h"><span class="stx-pic" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}">${m.image?'':esc([...(m.name||'?')][0]||'?')}</span>
     <div class="stx-hm"><div class="stx-nm">${m.partner?'<span class="stx-star" title="파트너">★</span>':''}<b>${esc(m.name)}</b><span class="stx-lv">Lv.${esc(m.lv)}</span>${m.entry?`<span class="tag">${esc(String(m.entry).toUpperCase())}</span>`:''}</div>
      <div class="stx-ty">${typeChips(m)}${m.role?`<span class="stx-pill">${esc(m.role)}</span>`:''}${m.pride?`<span class="stx-pill pr">프라이드 ${esc(m.pride)}</span>`:''}</div></div></div>
    <div class="stx-hp"><span class="hpbar ${r<=.25?'low':r<=.5?'mid':''}"><i style="width:${Math.round(r*100)}%"></i></span><span class="stx-hpn">${dead?'<b class="stx-bad">빈사</b> ':''}${hp.cur}/${hp.max}</span></div>
    ${st.length?`<div class="stx-st">${st.map(k=>`<span class="rk">${esc(stKo(k))}</span>`).join('')}</div>`:''}
    <div class="stx-kv"><span>특성</span><b title="${esc(one(m.abilityEff))}">${esc(m.ability||'—')}</b></div>
    <div class="stx-kv"><span>소지품</span><b>${its.length?its.map(x=>`<span class="${x.gone?'stx-gone':''}" title="${esc(effOf(x))}">${esc(nmI(x.item))}${x.gone?' (다 씀)':''}</span>`).join(' · '):'<span class="dim">없음</span>'}</b></div>
    <div class="stx-kv"><span>기술</span><b>${mv.length}개 · 소켓 ${ms}</b></div>
    <div class="stx-mv">${mv.map(x=>{const v=mvSock(x);return `<span class="stx-mvc" title="${esc(one(x.eff).slice(0,200))}">${x.typeEn?A().typeChip(x.typeEn):''}${esc(x.name)}<small>${v==null?'?':v}${x.half?' 할인':''}</small></span>`}).join('')||'<span class="dim small">없음</span>'}</div>
    ${XL.length?`<div class="stx-kv"><span>전용</span><b>${XL.map(x=>`<span title="${esc(one(x.eff).slice(0,200))}">『${esc(x.name)}』</span>`).join(' ')}</b></div>`:''}
   </div>`}).join('');
  const alive=mons.filter(m=>(m.hp||{}).cur>0).length;
  tot=Math.round(tot*10)/10;
  const tiles=[['포켓몬',`${mons.length}`],['싸울 수 있음',`${alive} / ${mons.length}`],['기술 소켓 합',`${tot}${unk?' +?':''}`],['소지품 소켓',SK?(SK.cap!=null?`${SK.used} / ${SK.cap}`:String(SK.used)):'—',SK&&SK.over]];
  return `<div class="stx-tiles">${tiles.map(([k,v,bad])=>`<div class="stx-tile${bad?' over':''}"><b>${esc(v)}</b><span>${k}</span></div>`).join('')}</div>
   <div class="stx-grid">${cards||'<div class="dim">포켓몬 없음</div>'}</div>
   <div class="small dim" style="margin-top:8px">HP · 상태 · 소지품은 지금 배틀 값. 기술 소켓은 기술 DB 소켓(할인 −0.5) 합으로, 제작기의 PT 기술점(『올드 타입』 고정값 등)과 다를 수 있다.</div>`}

 function wearTab(t,mons){
  const all=[];for(const m of mons)for(const x of slots(m))if(nmI(x.item))all.push([nmI(x.item),m.name]);
  const by={};for(const [it,n] of all)(by[it]=by[it]||[]).push(n);const dup=Object.entries(by).filter(([,v])=>v.length>1);
  const n2=Math.max(1,...mons.map(m=>slots(m).length));
  const rows=mons.map(m=>{const S=slots(m);let s=0,unk=false;for(const x of S){if(!nmI(x.item))continue;const v=sockOf(x);if(v==null)unk=true;else s+=v}s=Math.round(s*10)/10;
   return `<div class="stx-wr"><div class="stx-wn"><span class="stx-pic sm" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}">${m.image?'':esc([...(m.name||'?')][0]||'?')}</span><b>${esc(m.name)}</b></div>
    <div class="stx-ws">${Array.from({length:n2},(_,i)=>{const x=S[i];if(!x)return '';const n=nmI(x.item);if(!n)return `<div class="stx-it none"><small>소지품 ${i+1}</small><span class="dim">비어 있음</span></div>`;const v=sockOf(x);const e=effOf(x);const dp=(by[n]||[]).length>1;
     return `<div class="stx-it${x.gone?' gone':''}${dp?' dup':''}" title="${esc(e)}"><small>소지품 ${i+1}${x.gone?' · 다 씀':''}${dp?' · 겹침':''}</small><b>${esc(n)}</b><span class="stx-sk">${v==null?'소켓 ?':'소켓 '+v}</span>${e?`<span class="stx-ie">${esc(e.slice(0,90))}${e.length>90?'…':''}</span>`:''}</div>`}).join('')}</div>
    <div class="stx-wt"><small>소켓</small><b>${s}${unk?'+?':''}</b></div></div>`}).join('');
  return `${dup.length?`<div class="stx-warn">⚠ 같은 소지품이 겹친다 (한 파티에 하나만): ${dup.map(([it,ns])=>`「${esc(it)}」 ${ns.map(esc).join(' · ')}`).join(' / ')}</div>`:''}
   <div class="stx-wear">${rows||'<div class="dim">포켓몬 없음</div>'}</div>
   <div class="small dim" style="margin-top:8px">2 · 3번 칸은 제작기 시트에서 더한 칸. 소지품을 바꾸려면 시트 탭이나 포켓몬 상세 창에서.</div>`}

 function sockTab(t,mons,SK){
  if(!SK)return '<div class="dim">시트 모듈을 불러오지 못해 소켓을 셀 수 없다</div>';
  const L=[];for(const m of mons)for(const x of slots(m)){const n=nmI(x.item);if(!n)continue;L.push({n,who:m.name,v:sockOf(x),gone:!!x.gone,k:x.k})}
  L.sort((a,b)=>(b.v??99)-(a.v??99));
  const rk=String((t.ranks||{})['지시']||'').replace(/[+-]+$/,'');const ov=(t.base||{})['소지품 소켓'];const byOv=ov!=null&&ov!==''&&isFinite(+ov);
  const pct=SK.cap?Math.min(100,Math.round(SK.used/SK.cap*100)):0;const left=SK.cap!=null?Math.round((SK.cap-SK.used)*10)/10:null;
  return `<div class="stx-sock${SK.over?' over':''}"><div class="stx-sockh"><span>소지품 소켓</span><b>${SK.cap!=null?`${SK.used} / ${SK.cap}`:SK.used}</b>${left!=null?`<span class="${left<0?'stx-bad':'dim'}">${left<0?`${-left} 넘음`:`${left} 남음`}</span>`:''}</div>
    <div class="stx-bar"><i style="width:${pct}%"></i></div>
    <div class="small dim">${byOv?`상한 = 제작기 포인트 「소지품 소켓」 ${esc(ov)}`:SK.cap!=null?`상한 = 지시 ${esc(rk)}${t.solo==3?' · 1인 기준 (3체)':t.solo?' · 1인 기준 (2체)':''} (룰북: D 7 · C 9 · B 10 · A 11 · AA 12)`:'지시 랭크로 상한을 못 정함'}</div></div>
   <table class="t stx-tb"><tr><th>소지품</th><th>지닌 포켓몬</th><th class="n">소켓</th></tr>${L.map(x=>`<tr class="${x.gone?'stx-dim':''}"><td>${esc(x.n)}${x.gone?' <small class="dim">다 씀</small>':''}${x.k>1?` <small class="dim">${x.k}번 칸</small>`:''}</td><td>${esc(x.who)}</td><td class="n">${x.v==null?'<span class="stx-bad" title="소지품 DB 에 소켓이 없다">?</span>':x.v}</td></tr>`).join('')||'<tr><td colspan="3" class="dim">지닌 소지품 없음</td></tr>'}
   <tr class="stx-sumr"><td colspan="2">합계</td><td class="n">${SK.used}</td></tr></table>`}

 function open(tid){
  const ST=A().ST;const b=ST.state.battle||{};const t=(b.trainers||{})[tid];if(!t)return;
  const mons=Object.values(b.mons||{}).filter(m=>m.tid===tid).sort((x,y)=>(x.slot||0)-(y.slot||0));
  const SK=sock(t,mons);
  const body=TAB==='wear'?wearTab(t,mons):TAB==='sock'?sockTab(t,mons,SK):sumTab(t,mons,SK);
  const md=A().openModal(`<div class="mhead"><h2>${esc(t.name)} 현황</h2><span class="tabs2" style="margin-left:14px;flex:0 1 420px">${[['sum','PT 서머리'],['wear','소지품 착용'],['sock','소지품 소켓']].map(([k,n])=>`<button class="tab2 ${TAB===k?'on':''}" data-stxt="${k}">${n}</button>`).join('')}</span><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="stx">${body}</div>`);
  md.classList.add('wide','stxmodal');
  md.querySelectorAll('[data-stxt]').forEach(x=>x.onclick=()=>{TAB=x.dataset.stxt;open(tid)});
 }
 return {open};
})();
