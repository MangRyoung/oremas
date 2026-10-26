/* 모바일 무대: 위쪽 메뉴(장소 이름 · 배경/BGM/기록… 버튼)가 끝나는 높이를 재서 --sttop 에 넣는다.
   스탠딩은 그 아래에서 무대 바닥까지만 서므로 메뉴와 겹치지 않는다 (css/app.css 의 모바일 무대 블록). rp_ui.js 와는 따로 돈다 */
"use strict";
(()=>{const MQ=matchMedia('(max-width:760px)');let raf=0,last='';
 function fit(){raf=0;const st=document.getElementById('rpstage');if(!st)return;
  const r=st.getBoundingClientRect();let b=0;
  /* 10-26 망령: 넓은 화면이라도 옆 패널 때문에 무대가 좁으면 버튼이 한 글자 폭으로 찌그러졌다 — 이름 칸 폭은 늘 넘겨 버튼 줄이 그 오른쪽에서 두 줄로 접히게 */
  /* 던전 중엔 장소 이름 칸이 숨고 왼쪽 HUD 가 그 자리 — 보이는 쪽 오른쪽 끝을 쓴다 */
  if(!MQ.matches){let w='';{const tg=st.querySelector('.stagetags');const q=tg&&tg.offsetWidth?tg.getBoundingClientRect():null;if(q&&q.width>0)w=Math.round(q.right-r.left)+'px'}
   /* HUD 는 자식이 칸 밖으로 넘치니 맨 윗줄(던전 이름) 자식들 오른쪽 끝을 쓴다 */
   if(!w){const hd=st.querySelector(':scope>.dgrp-hud');if(hd){let R=0;for(const x of [hd,...hd.children]){if(!x.offsetWidth)continue;const q=x.getBoundingClientRect();if(q.top<r.top+64)R=Math.max(R,q.right)}if(R)w=Math.round(R-r.left)+'px'}}
   /* 버튼 줄이 두 줄로 접히면 오른쪽 지도 칸이 그 밑에서 시작하게 --btnb */
   {const bt=st.querySelector('#rpbtns');const q=bt&&bt.getBoundingClientRect();const v=q&&q.height?Math.round(q.bottom-r.top)+'px':'';if(v){if(st.style.getPropertyValue('--btnb')!==v)st.style.setProperty('--btnb',v)}else st.style.removeProperty('--btnb')}
   if(w){if(st.style.getPropertyValue('--tagw')!==w)st.style.setProperty('--tagw',w)}else st.style.removeProperty('--tagw')}
  if(!MQ.matches){if(last){st.style.removeProperty('--sttop');last=''}return}
  /* 10-23 망령: 버튼 줄은 장소 이름과 같은 줄에서 시작 — 왼쪽 이름 칸 폭 · 높이를 --tagw/--tagh 로 넘겨 그만큼 비운다 */
  /* 10-26: 던전 중엔 장소 이름이 숨어 칸 크기가 0 — 그대로 재면 「화자」 버튼이 무대 위로 사라졌다 */
  const tg=st.querySelector('.stagetags');const tq=tg&&tg.getBoundingClientRect();if(tg&&!(tq.width>0&&tq.height>0)){st.style.removeProperty('--tagw');st.style.removeProperty('--tagh')}
  if(tg&&tq.width>0&&tq.height>0){const q=tq,w=Math.round(q.right-r.left)+'px',h=Math.round(q.bottom-r.top)+'px';if(st.style.getPropertyValue('--tagw')!==w)st.style.setProperty('--tagw',w);if(st.style.getPropertyValue('--tagh')!==h)st.style.setProperty('--tagh',h)}
  for(const el of st.querySelectorAll('#rpbtns,.rpbtns,.stagetags,.rpspkbtn')){const q=el.getBoundingClientRect();if(q.height>0&&q.bottom>r.top)b=Math.max(b,q.bottom-r.top)}
  const v=Math.round(b+6)+'px';if(v!==last||st.style.getPropertyValue('--sttop')!==v){st.style.setProperty('--sttop',v);last=v}}
 const kick=()=>{if(!raf)raf=requestAnimationFrame(fit)};
 const start=()=>{new MutationObserver(kick).observe(document.body,{childList:true,subtree:true});kick()};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
 addEventListener('resize',kick);MQ.addEventListener&&MQ.addEventListener('change',kick)})();
