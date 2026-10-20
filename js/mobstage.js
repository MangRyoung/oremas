/* 모바일 무대: 위쪽 메뉴(장소 이름 · 배경/BGM/기록… 버튼)가 끝나는 높이를 재서 --sttop 에 넣는다.
   스탠딩은 그 아래에서 무대 바닥까지만 서므로 메뉴와 겹치지 않는다 (css/app.css 의 모바일 무대 블록). rp_ui.js 와는 따로 돈다 */
"use strict";
(()=>{const MQ=matchMedia('(max-width:760px)');let raf=0,last='';
 function fit(){raf=0;const st=document.getElementById('rpstage');if(!st)return;
  if(!MQ.matches){if(last){st.style.removeProperty('--sttop');last=''}return}
  const r=st.getBoundingClientRect();let b=0;
  for(const el of st.querySelectorAll('#rpbtns,.rpbtns,.stagetags')){const q=el.getBoundingClientRect();if(q.height>0&&q.bottom>r.top)b=Math.max(b,q.bottom-r.top)}
  const v=Math.round(b+6)+'px';if(v!==last||st.style.getPropertyValue('--sttop')!==v){st.style.setProperty('--sttop',v);last=v}}
 const kick=()=>{if(!raf)raf=requestAnimationFrame(fit)};
 const start=()=>{new MutationObserver(kick).observe(document.body,{childList:true,subtree:true});kick()};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
 addEventListener('resize',kick);MQ.addEventListener&&MQ.addEventListener('change',kick)})();
