/* ---------- 스탠딩 감정 연출 (2026-10-26 망령: 「스탠딩에 감정 애니메이션 같은 걸 기본으로」) ----------
   감정 하나 = 움직임(스탠딩이 뛰거나 떨거나) + 머리 위 아이콘(! ? 💢 ♪ …) + 짧은 소리.
   쓰는 법 (RP 무대 입력줄)
     · 대사 앞에 「!감정」:  !놀람 "뭐라고?"   /   @smile !기쁨 "다녀왔어!"
     · 감정만:              !한숨            (대사 없이 무대에서 움직임만 — 모두에게 바로)
     · 😮 버튼:            입력줄이 비었으면 바로 연출, 글이 있으면 다음 대사에 붙는다
     · 표정 이름이 감정 이름이면 저절로: @angry · @놀람 · @shy … (아래 al 목록)
   줄에는 data.em = 감정 키로 남는다. 대사 없는 연출은 저장하지 않는 신호(broadcast {t:'emo'})로 보낸다.
   소리: 효과음 목록(OM_DB.se)에 「emo_<키>」 가 있으면 그 파일, 없으면 브라우저가 만드는 짧은 소리. 효과음 끄기 · 음량은 그대로 따른다. */
"use strict";
window.OM_EMO=(()=>{
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 /* 감정 목록: ko 이름 · al 별칭(입력 · 표정 이름에서 알아듣는 말) · mo 움직임 · ic 아이콘 */
 const L=[
  ['surprise','놀람',['놀람','깜짝','놀란','surprise','surprised','shocked','shock','exclaim'],'jump','exclaim'],
  ['question','의문',['의문','갸웃','물음','question','confused','curious','huh'],'tilt','question'],
  ['angry','화남',['화남','분노','짜증','angry','annoyed','mad','pouting'],'shake','vein'],
  ['happy','기쁨',['기쁨','신남','즐거움','happy','joyful','excited','laughing','giggling','music'],'hop','note'],
  ['heart','하트',['하트','반함','사랑','heart','love','love_stuck','admiring'],'bounce','heart'],
  ['sweat','당황',['당황','땀','곤란','sweat','nervous','flustered','nervous_smiling'],'tremble','sweat'],
  ['sad','슬픔',['슬픔','우울','훌쩍','sad','depressed','disappointed','crying','tear'],'sink','tear'],
  ['shy','부끄',['부끄','수줍','부끄러움','shy','blush','embarrassed','full_face_blush','blushing_shyly'],'sway','blush'],
  ['think','생각',['생각','고민','음','think','thinking','dot'],'lean','dots'],
  ['idea','번뜩',['번뜩','아하','idea','bulb'],'pop','bulb'],
  ['sigh','한숨',['한숨','휴','sigh','bored'],'deflate','puff'],
  ['sleepy','졸림',['졸림','꾸벅','sleepy','zzz','sleep'],'doze','zzz'],
  ['sparkle','반짝',['반짝','자신만만','sparkle','twinkle','smug','proud'],'pop','sparkle'],
  ['fear','오싹',['오싹','공포','겁','fear','scared'],'shiver','gloom'],
  ['nod','끄덕',['끄덕','응','nod','yes'],'nod',''],
  ['no','도리도리',['도리도리','절레절레','아니','no','shake_head'],'headshake','']
 ];
 const E={};for(const [k,ko,al,mo,ic] of L)E[k]={k,ko,al,mo,ic};
 const AL=new Map();for(const e of Object.values(E)){AL.set(e.k,e.k);AL.set(e.ko,e.k);for(const a of e.al)AL.set(String(a).toLowerCase(),e.k)}
 const find=w=>AL.get(String(w||'').trim().toLowerCase().replace(/^[!！]/,''))||'';
 /* 표정(스탠딩) 이름 → 감정. 「angry_2」「놀람(작게)」처럼 붙은 꼬리도 떼고 본다 */
 function fromLabel(label){const s=String(label||'').trim();if(!s)return '';return find(s)||find(s.replace(/[\s_\-]*(\d+|\(.*\)|\[.*\])$/,''))||''}
 /* 입력줄: 맨 앞이나 맨 뒤의 「!감정」 하나를 떼어 낸다. 「!!」 「!?」 처럼 감정 이름이 아니면 그대로 둔다 */
 function parse(t){t=String(t||'');let m=t.match(/^[!！](\S+)\s*([\s\S]*)$/);if(m&&find(m[1]))return {em:find(m[1]),text:m[2].trim()};
  m=t.match(/^([\s\S]*?)\s+[!！](\S+)$/);if(m&&find(m[2]))return {em:find(m[2]),text:m[1].trim()};return {em:'',text:t}}

 /* ----- 아이콘 (64×64 SVG, 직접 그린 단순 도형) ----- */
 const T=(s,f,sz,x,y)=>`<text x="${x||32}" y="${y||50}" text-anchor="middle" font-size="${sz||52}" font-weight="900" font-family="Arial Black,Arial,sans-serif" fill="${f}" stroke="#1b1d24" stroke-width="5" paint-order="stroke" stroke-linejoin="round">${s}</text>`;
 const ICON={
  exclaim:`<g class="emo-i-exclaim">${T('!','#ffd23f',62)}</g><g class="emo-rays" stroke="#ffd23f" stroke-width="5" stroke-linecap="round"><path d="M10 14 4 8M54 14l6-6M6 32H0M58 32h6"/></g>`,
  question:`<g class="emo-i-q">${T('?','#7ec8ff',58)}</g>`,
  vein:`<g fill="none" stroke="#1b1d24" stroke-width="11" stroke-linecap="round"><path d="M26 8q2 14-16 16M38 8q-2 14 16 16M26 56q2-14-16-16M38 56q-2-14 16-16"/></g><g fill="none" stroke="#ff3b4f" stroke-width="6" stroke-linecap="round"><path d="M26 8q2 14-16 16M38 8q-2 14 16 16M26 56q2-14-16-16M38 56q-2-14 16-16"/></g>`,
  note:`<g class="emo-i-n1">${T('♪','#6fd6ff',40,22,40)}</g><g class="emo-i-n2">${T('♫','#ffd23f',34,46,52)}</g>`,
  heart:`<path d="M32 56C10 42 4 28 12 18c8-10 18-6 20 4 2-10 12-14 20-4 8 10 2 24-20 38z" fill="#ff5c8a" stroke="#1b1d24" stroke-width="4" stroke-linejoin="round"/><path d="M18 22q4-6 9-3" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/>`,
  sweat:`<path class="emo-drop" d="M32 6c8 14 16 22 16 33a16 16 0 0 1-32 0c0-11 8-19 16-33z" fill="#8fd8ff" stroke="#1b1d24" stroke-width="4"/><path d="M24 38q0-7 5-11" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".85"/>`,
  tear:`<g class="emo-drop"><path d="M22 10c6 10 11 16 11 24a11 11 0 0 1-22 0c0-8 5-14 11-24z" fill="#6fb6ff" stroke="#1b1d24" stroke-width="4"/></g><g class="emo-drop2"><path d="M46 22c5 8 9 13 9 19a9 9 0 0 1-18 0c0-6 4-11 9-19z" fill="#6fb6ff" stroke="#1b1d24" stroke-width="4"/></g>`,
  blush:`<g stroke="#1b1d24" stroke-width="9" stroke-linecap="round"><path d="M12 44 22 22M26 44l10-22M40 44l10-22"/></g><g stroke="#ff7fa3" stroke-width="5" stroke-linecap="round"><path d="M12 44 22 22M26 44l10-22M40 44l10-22"/></g>`,
  dots:`<g stroke="#1b1d24" stroke-width="4"><circle class="emo-d1" cx="14" cy="38" r="6" fill="#fff"/><circle class="emo-d2" cx="32" cy="38" r="6" fill="#fff"/><circle class="emo-d3" cx="50" cy="38" r="6" fill="#fff"/></g>`,
  bulb:`<g class="emo-rays" stroke="#ffd23f" stroke-width="5" stroke-linecap="round"><path d="M32 2v6M8 12l5 5M56 12l-5 5M2 30h6M56 30h6"/></g><circle cx="32" cy="30" r="15" fill="#ffe36b" stroke="#1b1d24" stroke-width="4"/><rect x="25" y="44" width="14" height="12" rx="3" fill="#c9ced8" stroke="#1b1d24" stroke-width="4"/><path d="M26 26q2-6 8-7" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`,
  puff:`<g class="emo-puff" fill="#eef2f7" stroke="#1b1d24" stroke-width="4"><ellipse cx="24" cy="38" rx="14" ry="11"/><ellipse cx="40" cy="32" rx="15" ry="12"/><ellipse cx="44" cy="44" rx="10" ry="8"/></g>`,
  zzz:`<g class="emo-z1">${T('Z','#c9b8ff',30,18,52)}</g><g class="emo-z2">${T('Z','#c9b8ff',24,36,34)}</g><g class="emo-z3">${T('z','#c9b8ff',20,52,18)}</g>`,
  sparkle:`<path class="emo-s1" d="M24 8l5 17 17 5-17 5-5 17-5-17-17-5 17-5z" fill="#ffe45c" stroke="#1b1d24" stroke-width="3.5" stroke-linejoin="round"/><path class="emo-s2" d="M48 34l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="#fff6b0" stroke="#1b1d24" stroke-width="3" stroke-linejoin="round"/>`,
  gloom:`<g stroke="#1b1d24" stroke-width="9" stroke-linecap="round"><path d="M16 6v34M32 2v40M48 6v34"/></g><g stroke="#7d8cff" stroke-width="5" stroke-linecap="round"><path d="M16 6v34M32 2v40M48 6v34"/></g>`
 };
 const svg=(ic,cls)=>ICON[ic]?`<svg class="${cls||''}" viewBox="0 0 64 64" aria-hidden="true">${ICON[ic]}</svg>`:'';

 /* ----- 소리: 효과음 목록의 emo_<키> → 없으면 짧게 만든 소리 ----- */
 let AC=null;
 function vol(){try{if(window.OM_PREFS&&window.OM_PREFS.get().seMute)return 0;const v=+(localStorage.getItem('om_vol_se')??0.7);return v>0?v:0}catch(e){return .7}}
 function sound(k){const v=vol();if(!v)return;try{const U=window.OM_RP_UI;if(U&&U.seUrlOf&&U.seUrlOf('emo_'+k)){U.playSe('emo_'+k,true);return}}catch(e){}
  try{if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();const t0=AC.currentTime+.01;
   const tone=(f,st,du,gn,f2,ty)=>{const o=AC.createOscillator(),g=AC.createGain();o.type=ty||'triangle';o.frequency.setValueAtTime(f,t0+st);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t0+st+du*.85);g.gain.setValueAtTime(0,t0+st);g.gain.linearRampToValueAtTime(v*gn,t0+st+.012);g.gain.exponentialRampToValueAtTime(.0005,t0+st+du);o.connect(g);g.connect(AC.destination);o.start(t0+st);o.stop(t0+st+du+.03)};
   const P={surprise:()=>{tone(880,0,.09,.22,1320);tone(1320,.09,.14,.22,1760)},question:()=>tone(520,0,.28,.2,980),angry:()=>{tone(150,0,.18,.28,110,'sawtooth');tone(140,.17,.2,.24,95,'sawtooth')},
    happy:()=>{tone(784,0,.1,.18);tone(988,.09,.1,.18);tone(1319,.18,.16,.18)},heart:()=>{tone(660,0,.16,.18,990,'sine');tone(990,.15,.22,.14,1320,'sine')},sweat:()=>tone(1200,0,.22,.14,520,'sine'),
    sad:()=>{tone(440,0,.3,.16,392,'sine');tone(392,.28,.42,.14,330,'sine')},shy:()=>{for(let i=0;i<4;i++)tone(1800+i*120,i*.05,.06,.07,null,'sine')},think:()=>{for(let i=0;i<3;i++)tone(660,i*.2,.06,.12,null,'sine')},
    idea:()=>{tone(1568,0,.35,.2,null,'sine');tone(2093,.06,.3,.1,null,'sine')},sigh:()=>tone(330,0,.5,.12,180,'sine'),sleepy:()=>{tone(300,0,.4,.08,260,'sine');tone(260,.45,.5,.07,220,'sine')},
    sparkle:()=>{[2093,2637,3136,3951].forEach((f,i)=>tone(f,i*.05,.2,.06,null,'sine'))},fear:()=>{for(let i=0;i<6;i++)tone(220+(i%2)*14,i*.06,.07,.1,null,'square')},nod:()=>tone(700,0,.06,.12,null,'sine'),no:()=>{tone(500,0,.07,.1,null,'sine');tone(420,.12,.07,.1,null,'sine')}};
   (P[k]||(()=>{}))()}catch(e){}}

 /* ----- 연출: 대상 = 무대의 그 인물 스탠딩. 없으면 대사 상자 이름표 위에 아이콘만 ----- */
 const REDUCE=()=>{try{return matchMedia('(prefers-reduced-motion:reduce)').matches}catch(e){return false}};
 function standOf(key){if(!key)return null;return [...document.querySelectorAll('#stands .stand')].find(x=>x.dataset.key===key&&!x.classList.contains('out'))||null}
 function play(target,k,opt){const e=E[k];if(!e||!target)return false;opt=opt||{};
  const isStand=target.classList.contains('stand');
  if(isStand&&!REDUCE()&&e.mo){target.classList.remove('emo-mo');target.removeAttribute('data-emo');void target.offsetWidth;target.dataset.emo=e.mo;target.classList.add('emo-mo');clearTimeout(target._emoT);target._emoT=setTimeout(()=>{target.classList.remove('emo-mo');target.removeAttribute('data-emo')},2200)}
  target.querySelectorAll(':scope>.emo-bub').forEach(x=>x.remove());
  if(e.ic){const b=document.createElement('div');b.className='emo-bub emo-'+e.ic;b.innerHTML=svg(e.ic);
   if(isStand){const img=target.querySelector('img');const tr=target.getBoundingClientRect(),ir=img?img.getBoundingClientRect():tr;const sg=(target.closest('#rpstage')||document.body).getBoundingClientRect();
    /* 머리 옆 (스탠딩 위쪽 1할 · 무대 가운데 쪽으로 비켜서). 무대 위로 넘치면 무대 안으로 내린다 */
    const sz=Math.max(40,Math.min(88,ir.height*.12));const side=target.classList.contains('right')?-1:1;
    let top=ir.top-tr.top+ir.height*.08;top=Math.max(top,sg.top-tr.top+sz/2+6);const cx=ir.left-tr.left+ir.width*(side>0?.78:.22);
    {const rb=document.getElementById('rpbtns');if(rb){const r=rb.getBoundingClientRect(),bx=tr.left+cx;if(r.height&&bx+sz/2>r.left&&bx-sz/2<r.right)top=Math.max(top,r.bottom-tr.top+sz/2+4)}}   /* 위 버튼 줄에 가리지 않게 */
    b.style.top=top+'px';b.style.left=cx+'px';b.style.setProperty('--sz',sz+'px')}
   else{b.classList.add('emo-dlg')}
   target.appendChild(b);setTimeout(()=>b.remove(),2300)}
  if(!opt.silent)sound(k);return true}
 /* 스탠딩이 다 뜬 뒤에 연출한다 — 막 등장한 스탠딩은 그림을 다 받고 등장 애니메이션(standin)이 끝날 때까지 기다린다 (위치를 그림 크기로 재니까) */
 function whenReady(key,cb,n){n=n||0;const st=standOf(key),img=st&&st.querySelector('img');
  if(st&&img&&img.complete&&img.naturalWidth){let an=[];try{an=st.getAnimations().filter(a=>/standin/.test(a.animationName||''))}catch(e){}if(an.length)return Promise.all(an.map(a=>a.finished.catch(()=>{}))).then(()=>cb(standOf(key)));return cb(st)}
  if(n>40)return cb(null);setTimeout(()=>whenReady(key,cb,n+1),80)}
 /* opt.enter: 무대에 없으면 올린다 (rp_ui stageEnter) · opt.standOnly: 스탠딩이 없으면 대사 상자로 대신하지 않는다 */
 function playKey(key,k,opt){opt=opt||{};if(!E[k])return false;
  if(opt.enter&&key&&!standOf(key)){try{window.OM_RP_UI&&window.OM_RP_UI.stageEnter&&window.OM_RP_UI.stageEnter(key)}catch(e){}}
  whenReady(key,st=>{if(st)return play(st,k,opt);const d=document.querySelector('#dlg .dname');if(d&&!opt.standOnly&&!opt.enter)return play(d,k,opt);if(!opt.silent)sound(k)});return true}

 /* ----- 😮 버튼 · 고르기 창 ----- */
 let pending='';
 function takePending(){const p=pending;pending='';paintBtn();return p}
 function paintBtn(){const b=document.getElementById('rpemo');if(!b)return;const e=E[pending];b.classList.toggle('on',!!e);b.innerHTML=e&&e.ic?svg(e.ic,'emo-btn-ic'):(e?esc(e.ko):'😮');b.title=e?`다음 대사에 「${e.ko}」 — 한 번 더 누르면 바꾸기 · 지우기`:'감정 연출 — 스탠딩이 움직이고 머리 위에 아이콘'}
 function btnHtml(){return `<button type="button" class="btn rpemo" id="rpemo" title="감정 연출 — 스탠딩이 움직이고 머리 위에 아이콘">😮</button>`}
 /* onNow(k): 입력줄이 비었을 때 바로 연출할 함수 (rp_ui 가 넘긴다) */
 function bind(btn,onNow){if(!btn||btn._emo)return;btn._emo=1;paintBtn();btn.onclick=e=>{e.preventDefault();openPick(btn,onNow)}}
 function openPick(btn,onNow){let pop=document.getElementById('emopop');if(pop){pop.remove();return}
  pop=document.createElement('div');pop.id='emopop';pop.className='emopop';
  pop.innerHTML=`<div class="emopop-h"><b>감정 연출</b><span>입력줄이 비었으면 바로 · 글이 있으면 다음 대사에</span></div><div class="emogrid">${Object.values(E).map(e=>`<button type="button" class="emoc ${pending===e.k?'on':''}" data-emo="${e.k}" title="!${esc(e.ko)}">${e.ic?svg(e.ic,'emoc-ic'):'<span class="emoc-mo">↕</span>'}<span>${esc(e.ko)}</span></button>`).join('')}</div>${pending?'<button type="button" class="btn sm ghost emoclr" data-emo="">붙인 감정 지우기</button>':''}<div class="emopop-f">입력: <code>!놀람 "대사"</code> · <code>@표정 !기쁨 …</code> · 표정 이름이 <code>angry</code>·<code>놀람</code> 처럼 감정 이름이면 저절로</div>`;
  document.body.appendChild(pop);const r=btn.getBoundingClientRect();const w=Math.min(340,innerWidth-16);pop.style.width=w+'px';pop.style.left=Math.max(8,Math.min(innerWidth-w-8,r.left+r.width/2-w/2))+'px';pop.style.bottom=(innerHeight-r.top+8)+'px';
  pop.querySelectorAll('[data-emo]').forEach(c=>c.onclick=()=>{const k=c.dataset.emo;pop.remove();const inp=document.getElementById('rpline');
   if(!k){pending='';paintBtn();return}
   if(inp&&inp.value.trim()){pending=pending===k?'':k;paintBtn();inp.focus();return}
   pending='';paintBtn();if(onNow)onNow(k)});
  setTimeout(()=>{const off=ev=>{if(!pop.isConnected)return document.removeEventListener('pointerdown',off,true);if(!pop.contains(ev.target)&&ev.target!==btn){pop.remove();document.removeEventListener('pointerdown',off,true)}};document.addEventListener('pointerdown',off,true)},0)}

 /* 남이 보낸 「감정만」 신호 */
 function onEvent(p){if(!p||p.t!=='emo'||!E[p.em])return;if(Date.now()-(+p.at||0)>8000)return;playKey(String(p.key||''),p.em,{enter:true})}
 return {E,LIST:L.map(x=>x[0]),find,fromLabel,parse,play,playKey,standOf,sound,svg,btnHtml,bind,paintBtn,takePending,get pending(){return pending},onEvent};
})();
