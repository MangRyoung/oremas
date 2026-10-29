/* ---------- 내 트레이너 미니 카드 (10-24 벨벳 「어느 탭에서나 보이는 머리 카드」 참고) ----------
   RP(아래 띠가 이미 있음) · 시트(머리 카드가 있음) 밖의 탭에서 화면 왼쪽 아래에 접힌 알약으로 뜬다.
   누르면 펼쳐져 랭크 · 상태 · 소지 포켓몬 HP(배틀 중이면 배틀 HP)와 시트 · 굴림 · 폰 단추를 보인다. 접힘 여부는 이 브라우저에서만 기억 */
"use strict";
window.OM_MECARD=(()=>{
 const A=()=>window.OM_APP;
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const KEY='om_mecard_open';let open=(()=>{try{return localStorage.getItem(KEY)==='1'}catch(e){return false}})();
 const HIDE=['rp','sheet','report','guide'];
 function me(){const ST=A().ST;if(ST.role!=='seat')return null;return ((ST.state.roster||{}).trainers||{})[ST.seat]||null}
 function el(){let e=document.getElementById('mecard');if(!e){e=document.createElement('div');e.id='mecard';e.className='mecard';document.body.appendChild(e)}return e}
 function draw(view){const t=me();const e=el();if(!t||HIDE.includes(view)){e.hidden=true;e.innerHTML='';return}e.hidden=false;
  const ST=A().ST;const mons=(t.pids||[]).map(id=>((ST.state.roster||{}).mons||{})[id]).filter(Boolean);const bm=(ST.state.battle||{}).mons||{};
  const K=window.OM_SKILL_UI;const k=K&&K.tsk?K.tsk(t.id):{};const st=k.inj>=3?'<span class="bad">빈사</span>':k.inj>=2?'<span class="bad">중상</span>':k.inj===1?'<span class="bad">부상</span>':'건강';
  const hpOf=m=>{const b=bm[m.id];const h=(b&&b.hp)||m.hp||{cur:0,max:0};const pct=h.max?Math.max(0,Math.min(100,h.cur>0?Math.max(1,Math.round(h.cur/h.max*100)):0)):0;return {h,pct,inB:!!(b&&b.entry)}};
  const av=(u,cls,txt)=>`<i class="${cls}" style="${u?`background-image:url('${cssu(u)}')`:''}">${u?'':esc(txt||'')}</i>`;
  const dots=mons.slice(0,6).map(m=>{const x=hpOf(m);return `<b class="${x.h.cur<=0?'ko':x.pct<=25?'low':x.pct<=50?'mid':''}"></b>`}).join('');
  e.classList.toggle('open',open);
  e.innerHTML=open?`<div class="mcbox"><div class="mch">${av(t.image,'mcav',[...(t.name||'?')][0])}<div class="mcn"><b>${esc(t.name)}</b><small>${st}${k.tired&&k.tired.length?' · 지침 '+k.tired.length:''}</small></div><button type="button" class="mcx" data-mc="fold" title="접기">▾</button></div>
    <div class="mcrk">${['지시','육성','통솔','능력'].map(r=>`<span>${r} <b>${esc((t.ranks||{})[r]||'-')}</b></span>`).join('')}</div>
    <div class="mcmons">${mons.map(m=>{const x=hpOf(m);return `<button type="button" class="mcm ${x.h.cur<=0?'ko':''}" data-mc="mon" data-mid="${esc(m.id)}" title="${esc(m.name)} — 눌러서 한 장 요약">${av(m.image,'mcmi',[...(m.name||'?')][0])}<span class="mcmn"><b>${esc(m.name)}${m.partner?' ★':''}</b><small>Lv.${esc(m.lv??'-')}${x.inB?' · 배틀':''}</small></span><span class="mchp"><i class="${x.pct<=25?'low':x.pct<=50?'mid':''}" style="width:${x.pct}%"></i></span><small class="mchpn">${x.h.cur}/${x.h.max}</small></button>`}).join('')||'<div class="small dim">소지 포켓몬이 없다</div>'}</div>
    <div class="mcbtn"><button type="button" class="btn xs" data-mc="sheet">📄 시트</button><button type="button" class="btn xs" data-mc="roll">🎲 굴림</button><button type="button" class="btn xs" data-mc="phone">📱 폰</button></div></div>`
   :`<button type="button" class="mcpill" data-mc="open" title="내 트레이너 펼치기">${av(t.image,'mcav',[...(t.name||'?')][0])}<span class="mcpn">${esc(t.name)}</span><span class="mcdots">${dots}</span></button>`;
  e.querySelectorAll('[data-mc]').forEach(b=>b.onclick=ev=>{ev.stopPropagation();const a=b.dataset.mc;
   if(a==='open'||a==='fold'){open=a==='open';try{localStorage.setItem(KEY,open?'1':'0')}catch(er){}return draw(view)}
   if(a==='sheet'){const S=window.OM_SHEET_UI;if(S){S.UI.tid=t.id;S.UI.tab='poke'}A().view='sheet';return A().renderScene()}
   if(a==='roll')return window.OM_SKILL_UI&&window.OM_SKILL_UI.open();
   if(a==='phone')return window.OM_PHONE_UI&&window.OM_PHONE_UI.open();
   if(a==='mon'){const m=((A().ST.state.roster||{}).mons||{})[b.dataset.mid];if(m&&window.OM_SHEET_UI)window.OM_SHEET_UI.openCard(m,t.name)}})}
 return {draw};
})();
