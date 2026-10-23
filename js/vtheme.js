/* ---------- VELVET 테마: P5(기본) · P3 · P4 ----------
   html[data-vt] 만 바꾸고, 겉모습은 css/vtheme.css 가 덮는다. 고른 테마는 이 브라우저(localStorage om_vt)에 남는다.
   고르는 단추: PC 는 위 띠 「⚙ 설정」 옆, 휴대폰은 ☰ 메뉴 창 맨 아래. */
"use strict";
window.OM_VT=(()=>{
 const K='om_vt',L=[['p5','P5'],['p3','P3'],['p4','P4']];
 const get=()=>{try{const v=localStorage.getItem(K);return L.some(x=>x[0]===v)?v:'p5'}catch(e){return 'p5'}};
 const set=v=>{if(!L.some(x=>x[0]===v))v='p5';document.documentElement.setAttribute('data-vt',v);try{localStorage.setItem(K,v)}catch(e){}
  document.querySelectorAll('.vtsw button').forEach(b=>b.classList.toggle('on',b.dataset.vt===v))};
 document.documentElement.setAttribute('data-vt',get());
 const sw=()=>{const s=document.createElement('span');s.className='vtsw';s.title='화면 테마 (VELVET P5 · P3 · P4)';
  s.innerHTML=L.map(([k,l])=>`<button type="button" data-vt="${k}" class="${k===get()?'on':''}">${l}</button>`).join('');
  s.onclick=e=>{const b=e.target.closest('[data-vt]');if(b)set(b.dataset.vt)};return s};
 let q=0;const put=()=>{q=0;const top=document.querySelector('.top');if(top&&!top.querySelector('.vtsw')){const r=top.querySelector('#roomSet');if(r)r.after(sw());else top.appendChild(sw())}
  const mm=document.querySelector('.mmenu');if(mm&&!mm.querySelector('.vtsw')){const w=document.createElement('div');w.className='vtrow';w.innerHTML='<span>화면 테마</span>';w.appendChild(sw());mm.appendChild(w)}};
 new MutationObserver(()=>{if(!q)q=requestAnimationFrame(put)}).observe(document.documentElement,{childList:true,subtree:true});
 return {get,set}})();
