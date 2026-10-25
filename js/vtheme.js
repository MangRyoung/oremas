/* ---------- VELVET 테마: P4(기본) · P3 · P5 ----------
   html[data-vt] 만 바꾸고, 겉모습은 css/vtheme.css 가 덮는다. 고른 테마는 이 브라우저(localStorage om_vt)에 남는다.
   고르는 단추: PC 는 위 띠 「⚙ 설정」 옆, 휴대폰은 ☰ 메뉴 창 맨 아래. */
"use strict";
window.OM_VT=(()=>{
 const K='om_vt',L=[['p5','P5'],['p3','P3'],['p4','P4']];
 /* 10-24 망령: 기본을 P4 로 — 그 전에 골라 둔 테마도 한 번만 P4 로 돌려 놓는다 (그 뒤 고른 건 그대로) */
 try{if(localStorage.getItem(K+'_d')!=='p4'){localStorage.setItem(K+'_d','p4');localStorage.removeItem(K)}}catch(e){}
 const get=()=>{try{const v=localStorage.getItem(K);return L.some(x=>x[0]===v)?v:'p4'}catch(e){return 'p4'}};
 const set=v=>{if(!L.some(x=>x[0]===v))v='p4';document.documentElement.setAttribute('data-vt',v);try{localStorage.setItem(K,v)}catch(e){}
  document.querySelectorAll('.vtsw button[data-vt]').forEach(b=>b.classList.toggle('on',b.dataset.vt===v));document.querySelectorAll('.vtsw .vtcur').forEach(b=>b.firstChild.textContent=(L.find(x=>x[0]===v)||[])[1]||'P4');document.querySelectorAll('.vtsw.open').forEach(x=>x.classList.remove('open'))};
 document.documentElement.setAttribute('data-vt',get());
 /* 10-25 망령: 위 띠에서는 단추 하나(지금 테마 ▾)로 줄인다 — P5 · P3 은 글씨가 커서 세 칸짜리가 다음 줄로 밀렸다. 누르면 아래로 세 개가 펼쳐진다. 휴대폰 메뉴 창은 세 칸 그대로 */
 const sw=compact=>{const s=document.createElement('span');s.className='vtsw'+(compact?' compact':'');s.title='화면 테마 (VELVET P5 · P3 · P4)';
  const btns=L.map(([k,l])=>`<button type="button" data-vt="${k}" class="${k===get()?'on':''}">${l}</button>`).join('');
  s.innerHTML=compact?`<button type="button" class="vtcur">${(L.find(x=>x[0]===get())||[])[1]}<i>▾</i></button><span class="vtmenu">${btns}</span>`:btns;
  s.onclick=e=>{const b=e.target.closest('button[data-vt]');if(b)return set(b.dataset.vt);if(e.target.closest('.vtcur')){s.classList.toggle('open');if(s.classList.contains('open'))setTimeout(()=>document.addEventListener('pointerdown',function f(ev){if(!s.contains(ev.target))s.classList.remove('open');document.removeEventListener('pointerdown',f,true)},true),0)}};return s};
 let q=0;const put=()=>{q=0;const top=document.querySelector('.top');if(top&&!top.querySelector('.vtsw')){const r=top.querySelector('#roomSet');if(r)r.after(sw(true));else top.appendChild(sw(true))}
  const mm=document.querySelector('.mmenu');if(mm&&!mm.querySelector('.vtsw')){const w=document.createElement('div');w.className='vtrow';w.innerHTML='<span>화면 테마</span>';w.appendChild(sw());mm.appendChild(w)}};
 new MutationObserver(()=>{if(!q)q=requestAnimationFrame(put)}).observe(document.documentElement,{childList:true,subtree:true});
 return {get,set}})();
