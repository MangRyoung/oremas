/* ---------- 요약 창 (10-27 망령): 배틀 벤치 트레이너 「카드」 옆 「요약」 ----------
   한 화면: 위에 소지품 소켓 막대 · 포켓몬 수 · 기술 소켓 합, 아래 포켓몬마다 카드(Lv · 타입 · 역할 · HP · 상태 · 특성 · 기술 · 전용 · 소지품 칸).
   소지품 칸을 눌러 바로 착용 · 교체 · 떼기 (상세 창 소지품 바꾸기처럼 지금 배틀의 이 포켓몬만 — 시트는 그대로). */
"use strict";
window.OM_STATUS_UI=(()=>{
 const A=()=>window.OM_APP, DB=()=>window.OM_DB||{};
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const nmI=s=>String(s||'').replace(/『|』/g,'').trim();
 const one=s=>String(s||'').replace(/<br\s*\/?>/g,' ').replace(/\s+/g,' ').trim();
 const X2=2;   /* 소지품 2 · 3번 칸 (시트 탭과 같은 상한) */
 let TID='';

 /* 소지품 한 칸의 소켓: 소지품 DB → 오리지널 소지품(itemOwn.sock). 모르면 null */
 function sockOf(x){const n=nmI(x.item);if(!n)return null;const it=(DB().items||{})[n];const own=!it&&x.itemOwn&&nmI(x.itemOwn.name)===n?x.itemOwn:null;const v=parseFloat(it?it.sock:own?own.sock:'');return isFinite(v)?v:null}
 const effOf=x=>{const n=nmI(x.item);const it=(DB().items||{})[n];return one(x.itemEff||(it&&it.eff)||'')};
 /* 포켓몬의 소지품 칸들. 1번 칸을 다 써서 없어졌으면(itemUsed) 그 이름으로 「다 씀」 */
 function slots(m){const L=[];const used=m.itemUsed&&!nmI(m.item)?m.itemUsed:null;
  L.push(nmI(m.item)?{k:0,item:m.item,itemEff:m.itemEff,itemOwn:m.itemOwn}:used?{k:0,item:used.name,itemEff:used.eff,gone:true}:{k:0,item:''});
  (m.items2||[]).forEach((x,i)=>L.push(Object.assign({k:i+1},x||{item:''})));return L}
 /* 소켓 합 / 상한 — 시트 탭(OM_SHEET_UI.itemSock)과 같은 셈. 다 쓴 소지품도 센다(짤 때의 구성) */
 function sock(t,mons){const fake=mons.map(m=>m.itemUsed&&!nmI(m.item)?Object.assign({},m,{item:m.itemUsed.name}):m);
  const SU=window.OM_SHEET_UI;return SU&&SU.itemSock?SU.itemSock(t,fake):null}
 const mvSock=mv=>{const v=parseFloat(mv.sock);return isFinite(v)?v-(mv.half?0.5:0):null};
 const typeChips=m=>(m.types||[]).filter(x=>x&&x!=='-').map(x=>A().typeChip(x)).join('');
 const stKo=k=>(((DB().states||{}).st||{})[k]||{}).ko||k;
 const canEd=mid=>{const U=window.OM_BATTLE_UI;return !!(U&&U.canEditMon&&U.canEditMon(mid))};

 function body(t,mons){
  const SK=sock(t,mons);
  const by={};for(const m of mons)for(const x of slots(m)){const n=nmI(x.item);if(n)(by[n]=by[n]||[]).push(m.name)}const dup=Object.entries(by).filter(([,v])=>v.length>1);
  let tot=0,unk=0;
  const cards=mons.map(m=>{const hp=m.hp||{cur:0,max:0};const r=hp.max?Math.max(0,Math.min(1,hp.cur/hp.max)):0;const dead=hp.cur<=0;const ed=canEd(m.id);
   const mv=(m.moves||[]).filter(x=>x&&x.name&&!x.ext&&x.name!=='발버둥');let ms=0;
   for(const x of mv){const v=mvSock(x);if(v==null)unk++;else ms+=v}ms=Math.round(ms*10)/10;tot+=ms;
   const st=Object.keys(m.states||{}).filter(k=>m.states[k]&&k!=='Dead');
   const XL=[...(m.excl?[m.excl]:[]),...(m.exclX||[])];
   const S=slots(m);let is=0;for(const x of S){const v=nmI(x.item)?sockOf(x):0;if(v!=null)is+=v}is=Math.round(is*10)/10;
   const itH=S.map(x=>{const n=nmI(x.item);const v=sockOf(x);const e=effOf(x);const dp=n&&(by[n]||[]).length>1;
    if(!n)return ed?`<span class="stx-itw"><button type="button" class="stx-it none" data-sit="${m.id}" data-k="${x.k}" title="눌러서 소지품 착용"><small>소지품 ${x.k+1}</small><b>＋ 착용</b></button>${x.k>0?`<button type="button" class="stx-itx" data-sdel="${m.id}" data-k="${x.k}" title="이 칸 없애기">×</button>`:''}</span>`:`<span class="stx-it none"><small>소지품 ${x.k+1}</small><span class="dim">비어 있음</span></span>`;
    return `<span class="stx-itw"><button type="button" class="stx-it${x.gone?' gone':''}${dp?' dup':''}" ${ed?`data-sit="${m.id}" data-k="${x.k}"`:'disabled'} title="${esc(e)}${ed?'\n— 눌러서 바꾸기':''}"><small>소지품 ${x.k+1}${x.gone?' · 다 씀':''}${dp?' · 겹침':''}</small><b>${esc(n)}</b><span class="stx-sk">소켓 ${v==null?'?':v}</span></button>${ed&&!x.gone?`<button type="button" class="stx-itx" data-soff="${m.id}" data-k="${x.k}" title="떼기">×</button>`:''}</span>`}).join('')
    +(ed&&(m.items2||[]).length<X2?`<button type="button" class="stx-itadd" data-sadd="${m.id}" title="소지품 칸 더하기 (최대 ${X2+1}칸)">＋ 칸</button>`:'');
   return `<div class="stx-card${dead?' dead':''}${m.partner?' ptnr':''}">
    <div class="stx-h"><span class="stx-pic" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}">${m.image?'':esc([...(m.name||'?')][0]||'?')}</span>
     <div class="stx-hm"><div class="stx-nm">${m.partner?'<span class="stx-star" title="파트너">★</span>':''}<b>${esc(m.name)}</b><span class="stx-lv">Lv.${esc(m.lv)}</span>${m.entry?`<span class="tag">${esc(String(m.entry).toUpperCase())}</span>`:''}</div>
      <div class="stx-ty">${typeChips(m)}${m.role?`<span class="stx-pill">${esc(m.role)}</span>`:''}${m.pride?`<span class="stx-pill pr">프라이드 ${esc(m.pride)}</span>`:''}</div></div></div>
    <div class="stx-hp"><span class="hpbar ${r<=.25?'low':r<=.5?'mid':''}"><i style="width:${Math.round(r*100)}%"></i></span><span class="stx-hpn">${dead?'<b class="stx-bad">빈사</b> ':''}${hp.cur}/${hp.max}</span></div>
    ${st.length?`<div class="stx-st">${st.map(k=>`<span class="rk">${esc(stKo(k))}</span>`).join('')}</div>`:''}
    <div class="stx-kv"><span>특성</span><b title="${esc(one(m.abilityEff))}">${esc(m.ability||'—')}</b></div>
    <div class="stx-kv"><span>기술</span><b>${mv.length}개 · 소켓 ${ms}</b></div>
    <div class="stx-mv">${mv.map(x=>{const v=mvSock(x);return `<span class="stx-mvc" title="${esc(one(x.eff).slice(0,200))}">${x.typeEn?A().typeChip(x.typeEn):''}${esc(x.name)}<small>${v==null?'?':v}${x.half?' 할인':''}</small></span>`}).join('')||'<span class="dim small">없음</span>'}</div>
    ${XL.length?`<div class="stx-kv"><span>전용</span><b>${XL.map(x=>`<span title="${esc(one(x.eff).slice(0,200))}">『${esc(x.name)}』</span>`).join(' ')}</b></div>`:''}
    <div class="stx-its"><div class="stx-itsh"><span>소지품</span><small>소켓 ${is}</small></div><div class="stx-itl">${itH}</div></div>
   </div>`}).join('');
  const alive=mons.filter(m=>(m.hp||{}).cur>0).length;tot=Math.round(tot*10)/10;
  const rk=String((t.ranks||{})['지시']||'').replace(/[+-]+$/,'');const ov=(t.base||{})['소지품 소켓'];const byOv=ov!=null&&ov!==''&&isFinite(+ov);
  const sockH=SK?(()=>{const pct=SK.cap?Math.min(100,Math.round(SK.used/SK.cap*100)):0;const left=SK.cap!=null?Math.round((SK.cap-SK.used)*10)/10:null;
   return `<div class="stx-sock${SK.over?' over':''}"><div class="stx-sockh"><span>소지품 소켓</span><b>${SK.cap!=null?`${SK.used} / ${SK.cap}`:SK.used}</b>${left!=null?`<span class="${left<0?'stx-bad':'dim'}">${left<0?`${-left} 넘음`:`${left} 남음`}</span>`:''}<span class="sp"></span><small class="dim">${byOv?`상한 = 제작기 포인트 「소지품 소켓」 ${esc(ov)}`:SK.cap!=null?`지시 ${esc(rk)}${t.solo==3?' · 1인 기준 (3체)':t.solo?' · 1인 기준 (2체)':''}`:'지시 랭크로 상한을 못 정함'}</small></div><div class="stx-bar"><i style="width:${pct}%"></i></div></div>`})():'';
  return `<div class="stx-top">${sockH}<div class="stx-tiles"><div class="stx-tile"><b>${mons.length}</b><span>포켓몬</span></div><div class="stx-tile"><b>${alive} / ${mons.length}</b><span>싸울 수 있음</span></div><div class="stx-tile"><b>${tot}${unk?'+?':''}</b><span>기술 소켓 합</span></div></div></div>
   ${dup.length?`<div class="stx-warn">⚠ 같은 소지품이 겹친다 (한 파티에 하나만): ${dup.map(([it,ns])=>`「${esc(it)}」 ${ns.map(esc).join(' · ')}`).join(' / ')}</div>`:''}
   <div class="stx-grid">${cards||'<div class="dim">포켓몬 없음</div>'}</div>
   <div class="small dim" style="margin-top:8px">HP · 상태 · 소지품은 지금 배틀 값. 소지품을 바꾸면 지금 배틀의 이 포켓몬만 바뀐다 (시트는 그대로, 상세 창 소지품 바꾸기와 같다). 기술 소켓은 기술 DB 소켓(할인 −0.5) 합이라 제작기 PT 기술점(『올드 타입』 고정값 등)과 다를 수 있다.</div>`}

 /* 소지품 칸 고치기: fn(사본) → 로그 줄(빈 글이면 안 바꿈) */
 async function edit(mid,fn){const b=A().ST.state.battle||{};const m0=(b.mons||{})[mid];if(!m0||!canEd(mid))return;const x=JSON.parse(JSON.stringify(m0));const line=fn(x);if(!line)return;
  x.items2=(x.items2||[]).slice(0,X2);
  if(await A().setDiff(['battle','mons',mid],m0,x)){A().sysLog(`${m0.name} ${line}`,'battle');
   const nb=A().ST.state.battle||{};const rows=Object.values(nb.mons||{}).filter(q=>q.tid===m0.tid).flatMap(q=>[q,...(q.items2||[])].map(o=>({item:(o||{}).item,name:q.name})));const d=A().dupItems?A().dupItems(rows):[];if(d.length)A().toast(A().dupItemText(m0.name,d))}
  open(TID)}
 const setX=(x,k,n)=>{const FX=window.OM_FX;const it=(DB().items||{})[n]||{};const eff=String(it.eff||'');
  if(k===0){const was=nmI(x.item);if(FX&&was)FX.removeByName(x,was);x.item=n;x.itemEff=eff;if(n)delete x.itemUsed;return n?(was?`소지품 「${was}」 → 「${n}」`:`소지품 「${n}」 착용`):`소지품 「${was}」 뗌`}
  x.items2=x.items2||[];const o=x.items2[k-1]||{};const was=nmI(o.item);if(FX&&was)FX.removeByName(x,was);x.items2[k-1]={item:n,itemEff:eff};return n?(was?`소지품 ${k+1} 「${was}」 → 「${n}」`:`소지품 ${k+1} 「${n}」 착용`):`소지품 ${k+1} 「${was}」 뗌`};

 function open(tid){
  const U=window.OM_BATTLE_UI;if(!U||!U.canSeeStx||!U.canSeeStx(tid))return A().toast('이 트레이너의 요약은 볼 수 없다');   /* 10-27: 관전 · 상대 차단 */
  TID=tid;const ST=A().ST;const b=ST.state.battle||{};const t=(b.trainers||{})[tid];if(!t)return;
  const mons=Object.values(b.mons||{}).filter(m=>m.tid===tid).sort((x,y)=>(x.slot||0)-(y.slot||0));
  const old=document.querySelector('.stxmodal');const sc=old?old.scrollTop:0;
  const md=A().openModal(`<div class="mhead"><h2>${esc(t.name)} 요약</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="stx">${body(t,mons)}</div>`);
  md.classList.add('wide','stxmodal');if(sc)md.scrollTop=sc;
  const cur=(mid,k)=>{const m=(b.mons||{})[mid];if(!m)return '';return k===0?nmI(m.item):nmI(((m.items2||[])[k-1]||{}).item)};
  md.querySelectorAll('[data-sit]').forEach(el=>el.onclick=()=>{const mid=el.dataset.sit,k=+el.dataset.k;if(!window.OM_DB_UI)return;
   window.OM_DB_UI.open({kind:'item',sel:cur(mid,k),pick:n=>edit(mid,x=>n===cur(mid,k)?'':setX(x,k,n))})});
  md.querySelectorAll('[data-soff]').forEach(el=>el.onclick=()=>{const mid=el.dataset.soff,k=+el.dataset.k;const n=cur(mid,k);if(!n||!confirm(`「${n}」을(를) 뗄까?`))return;edit(mid,x=>setX(x,k,''))});
  md.querySelectorAll('[data-sadd]').forEach(el=>el.onclick=()=>edit(el.dataset.sadd,x=>{x.items2=x.items2||[];if(x.items2.length>=X2)return '';x.items2.push({item:'',itemEff:''});return `소지품 ${x.items2.length+1}번 칸 더함`}));
  md.querySelectorAll('[data-sdel]').forEach(el=>el.onclick=()=>{const k=+el.dataset.k;edit(el.dataset.sdel,x=>{if(!x.items2||!x.items2[k-1]||nmI(x.items2[k-1].item))return '';x.items2.splice(k-1,1);return `소지품 ${k+1}번 칸 없앰`})});
 }
 return {open};
})();
