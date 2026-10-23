/* ---------- 연출 오버레이 (맵툴 Lib:pokemon 의 js_cutin_p5 / js_cut / turn_overlay 를 옮김) ----------
   · fire(list)  : 지시·포텐셜 발동 컷인 (띠 + 카드 + 큰 글씨). list 가 2개면 VS 모양으로 둘 다
   · vs(L,R)     : 시합 개시 VS 컷인
   · raid(opt)   : 경고(위험 등장) 연출
   · phase(text) : 페이즈 띠 (지시 준비 / 턴 개시 / 행동 순서 / 행동 처리 / 턴 종료)
   · evo(D)      : 메가진화 · 폼체인지 · 폼 복귀 연출 ({kind:'mega'|'form'|'back', from:{name,img}, to:{name,img}, color})
   보내는 쪽은 바로 그리고 broadcast 로 같은 방의 모두에게 보낸다 (저장하지 않는다). */
"use strict";
window.OM_CUTIN=(()=>{
 const DBS=()=>window.OM_STORE, A=()=>window.OM_APP;
 const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const cfg=()=>Object.assign({sc:70,pos:'mid',dim:1,dur:0,on:1},(((A()&&A().ST.state||{}).rp||{}).cutin)||{});
 let unlocked=false;document.addEventListener('pointerdown',()=>{unlocked=true},{once:true});
 function se(name){try{if(window.OM_RP_UI)window.OM_RP_UI.playSe(name,true)}catch(e){}}
 function sfx(name){try{const U=window.OM_RP_UI;if(!U||!U.seUrlOf(name))return false;U.playSe(name,true);return true}catch(e){return false}}
 function root(id){let r=document.getElementById(id);if(r)r.remove();r=document.createElement('div');r.id=id;document.body.appendChild(r);return r}
 const rnd=(a,b)=>a+Math.random()*(b-a);
 function jag(fill,stroke,sw,amp){const top=[],bot=[];let x=0;while(x<1000){top.push([x,rnd(0,amp)]);x+=rnd(14,40)}top.push([1000,rnd(0,amp)]);x=1000;while(x>0){bot.push([x,100-rnd(0,amp)]);x-=rnd(14,40)}bot.push([0,100-rnd(0,amp)]);
  const pts=top.concat(bot).map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');return `<svg viewBox="0 0 1000 100" preserveAspectRatio="none"><polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" vector-effect="non-scaling-stroke"/></svg>`}
 function zig(){let p='',x=0,up=true;while(x<=1000){p+=x+','+(up?20:80)+' ';x+=45;up=!up}return `<svg viewBox="0 0 1000 100" preserveAspectRatio="none"><polyline points="${p}" fill="none" stroke="#111" stroke-width="22" vector-effect="non-scaling-stroke"/><polyline points="${p}" fill="none" stroke="#ffe14a" stroke-width="14" vector-effect="non-scaling-stroke"/><polyline points="${p}" fill="none" stroke="#fff" stroke-width="4" vector-effect="non-scaling-stroke"/></svg>`}

 /* ----- 발동 컷인 (10-23 망령 새 디자인): 보는 사람의 화면 테마(P5 · P3 · P4)를 따른다. 둘이면 양쪽 끝에서 날아와 가운데서 쾅 → VS.
    c = {src 그림, tag 위 작은 글, ment 큰 글(『이름』), line 컷인 대사, color, gh 띠 뒤 글자} ----- */
 const letters=s=>[...String(s)].map((ch,i)=>`<i style="--i:${i}">${ch===' '?'&nbsp;':esc(ch)}</i>`).join('');
 function vt(){try{const v=document.documentElement.getAttribute('data-vt')||(window.OM_VT&&window.OM_VT.get());return v==='p3'?'3':v==='p5'?'5':'4'}catch(e){return '4'}}
 /* 글자가 띠 칸 밖으로 삐져나가지 않게: 가로는 그림 옆 ~ 화면 끝, 세로는 띠 높이 안으로 줄인다 */
 function fitTxt(r){r.querySelectorAll('.c2-side').forEach(sd=>{const t=sd.querySelector('.c2-txt'),po=sd.querySelector('.c2-por');if(!t)return;t.style.removeProperty('--k');
  const k=parseFloat(getComputedStyle(sd).getPropertyValue('--k'))||1;const nar=r.classList.contains('c2-nar');const aw=nar||!po?innerWidth*.88:innerWidth-po.offsetWidth-14*innerWidth/100;const ah=sd.offsetHeight*.8;
  const f=Math.min(1,aw/Math.max(1,t.offsetWidth),ah/Math.max(1,t.offsetHeight));if(f<1)t.style.setProperty('--k',k*f)})}
 function fireLocal(list){const C=cfg();if(String(C.on)==='0')return;list=(list||[]).slice(0,2);if(!list.length)return;const dual=list.length>1;
  let K=parseFloat(C.sc);if(!(K>0))K=70;K=Math.max(40,Math.min(120,K))/70;   /* 방 설정 「컷인 크기」 70 이 기본 크기 */
  {const pc=window.OM_PREFS?+window.OM_PREFS.get().cutin:100;if(pc>0)K*=pc/100}   /* 내 설정 「컷인」 크기 */
  const POS=C.pos||'mid',DIM=String(C.dim)==='0'?0:1,DUR=parseFloat(C.dur);const END=DUR>0?DUR:(dual?3.6:3.1);
  const nar=innerWidth/Math.max(1,innerHeight)<1;const u=Math.min(innerHeight/100,innerWidth/100*1.5);
  const r=root('cut2');r.className=`c2 c2${vt()}${dual?' c2-vs':''}${nar?' c2-nar':''}`;r.style.cssText=`--u:${u}px;--end:${END}s`;if(dual)r.style.setProperty('--k',.74*K);else r.style.setProperty('--k',K);
  let h=`<div class="c2-dim" ${DIM?'':'style="display:none"'}></div><div class="c2-shake">`;
  list.forEach((c,i)=>{const L=!dual||i===0;const nm=String(c.ment||c.name||'');let fs=dual?10:12.5;if(nm.length>7)fs=fs*7/nm.length;
   const y=dual?'':`--y:${POS==='top'?30:POS==='bot'?70:50}vh;`;const gh=c.gh||(/지시|지령/.test(String(c.tag||''))?'ORDER':'POTENTIAL');const pic=!!c.src;
   h+=`<div class="c2-side ${L?'c2-L':'c2-R'}" style="${y}--pc:${esc(c.color||'#e3101f')};--rot:${dual?-9:-7}deg;--org:${L?'0%':'100%'};--d0:0s;--fs:calc(var(--u)*${fs});--px:${L?-60:60}vw;--tx:${L?40:-40}vw">
    <div class="c2-band"><div class="c2-w"></div><div class="c2-c"></div><div class="c2-k"></div><div class="c2-g">${gh} ${gh} ${gh}</div></div>
    ${pic?`<div class="c2-por" style="${L?'left:7vw':'right:7vw'}"><div class="c2-sh"></div><div class="c2-fr"></div><div class="c2-im" style="background-image:url('${esc(c.src)}')"></div></div>`:''}
    <div class="c2-txt" style="${nar||!pic?(L?'left:6vw':'right:6vw;text-align:right'):(L?'left:calc(7vw + var(--u)*42*var(--k))':'right:calc(7vw + var(--u)*42*var(--k));text-align:right')}">${c.tag?`<span class="c2-tag">${esc(c.tag)}</span>`:''}<span class="c2-name">${letters(nm)}</span>${c.line?`<span class="c2-line">「${esc(String(c.line).replace(/^「|」$/g,''))}」</span>`:''}</div></div>`});
  if(dual){let sp='';for(let a=0;a<360;a+=30)sp+=`<i style="--a:${a+8}deg"></i>`;
   h+=`<div class="c2-crack"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="0,62 22,55 30,58 41,50 47,53 53,46 60,49 70,42 79,45 100,36" fill="none" stroke="#fff" vector-effect="non-scaling-stroke" style="stroke-width:6px"/></svg></div><div class="c2-ring"></div><div class="c2-spark">${sp}</div><div class="c2-vsw"><div class="c2-burst"></div><b>VS</b></div>`}
  h+='</div><div class="c2-flash"></div>';r.innerHTML=h;fitTxt(r);[120,400].forEach(ms=>setTimeout(()=>{if(r.parentNode)fitTxt(r)},ms));   /* 글꼴이 늦게 오면 한 번 더 잰다 */
  if(!list.some(c=>c.se&&c.se!=='cut')){if(dual)setTimeout(()=>synth('hit'),600);else setTimeout(()=>synth('slam'),70)}   /* 따로 고른 효과음이 있으면 그것만 */
  setTimeout(()=>{if(r.parentNode)r.remove()},(END+.45)*1000)}
 /* 효과음 덧대기 (10-23 망령): 파일 없이 브라우저에서 바로 만든다 — VS 충돌 순간 「쾅」 · 혼자일 때 글자 박히는 「탁」. 효과음 끄기 · 음량 설정을 따른다 */
 let AC=null,MX=null;
 function synth(kind){try{if(window.OM_PREFS&&window.OM_PREFS.get().seMute)return;let v=0.7;try{v=+(localStorage.getItem('om_vol_se')??0.7)}catch(e){}if(!(v>0))return;
  if(!AC){AC=new (window.AudioContext||window.webkitAudioContext)();MX=AC.createDynamicsCompressor();MX.threshold.value=-14;MX.knee.value=8;MX.ratio.value=4;MX.attack.value=.003;MX.release.value=.18;MX.connect(AC.destination)}
  if(AC.state==='suspended')AC.resume();const t=AC.currentTime+.01;
  /* 음 하나: 파형 · 시작 · 길이 · 크기 · (끝 높이) — 짧게 올라갔다 부드럽게 줄어든다 */
  const tone=(f,ty,st,du,gn,f2)=>{const o=AC.createOscillator(),g=AC.createGain();o.type=ty;o.frequency.setValueAtTime(f,t+st);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+st+du*.8);
   g.gain.setValueAtTime(0,t+st);g.gain.linearRampToValueAtTime(v*gn,t+st+Math.min(.012,du/4));g.gain.exponentialRampToValueAtTime(.0005,t+st+du);o.connect(g);g.connect(MX);o.start(t+st);o.stop(t+st+du+.02)};
  /* 잡음: 필터 종류 · 높이(끝 높이) · 시작 · 길이 · 크기 */
  const noise=(ft,f,st,du,gn,f2,q)=>{const len=Math.floor(AC.sampleRate*du),buf=AC.createBuffer(1,len,AC.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
   const n=AC.createBufferSource(),fl=AC.createBiquadFilter(),g=AC.createGain();n.buffer=buf;fl.type=ft;fl.Q.value=q||.8;fl.frequency.setValueAtTime(f,t+st);if(f2)fl.frequency.exponentialRampToValueAtTime(f2,t+st+du);
   g.gain.setValueAtTime(0,t+st);g.gain.linearRampToValueAtTime(v*gn,t+st+du*(f2?.6:.04));g.gain.exponentialRampToValueAtTime(.0005,t+st+du);n.connect(fl);fl.connect(g);g.connect(MX);n.start(t+st);n.stop(t+st+du)};
  if(kind==='siren'){for(let k=0;k<6;k++)tone(k%2?620:880,'square',k*.26,.24,.07);return}
  if(kind==='slam'){   /* 발동 컷인: 띠가 쓸고 지나가는 「쉭」 → 글자 박히는 「쾅」 + 쨍 */
   noise('bandpass',500,0,.2,.32,4200,1.2);tone(170,'sine',.19,.38,.85,46);noise('lowpass',3200,.19,.13,.42);tone(1320,'triangle',.2,.5,.07);tone(1980,'triangle',.2,.4,.045);return}
  if(kind==='hit'){   /* VS 충돌 */
   tone(140,'sine',0,.6,.9,38);noise('lowpass',2400,0,.35,.75);tone(1100,'triangle',.01,.55,.05);return}
  if(kind==='ball'){   /* 몬스터볼 열림: 딸깍 → 퐁 → 반짝 */
   noise('highpass',2600,0,.03,.35);tone(320,'sine',.05,.12,.42,980);noise('bandpass',1800,.05,.14,.14,5200,1);
   [1568,2093,2637].forEach((f,i)=>tone(f,'sine',.13+i*.045,.3,.09));return}
  if(kind==='ready'){tone(988,'triangle',0,.22,.2);tone(1319,'triangle',.11,.38,.18);return}   /* 양측 준비 완료: 가벼운 「띵동」 */
  if(kind==='up'){[523,659,784,1047].forEach((f,i)=>tone(f,'triangle',i*.06,.2,.23));tone(2093,'sine',.24,.3,.05);return}   /* 랭크 상승 */
  if(kind==='down'){[784,622,494].forEach((f,i)=>tone(f,'triangle',i*.08,.24,.23,f*.94));return}   /* 랭크 하강 */
  if(kind==='dmg'){noise('lowpass',1900,0,.13,.5);tone(125,'sine',0,.2,.6,58);return}   /* 피해 (보통 · 상태 이상 · 반동 등) */
  if(kind==='dmg_big'){noise('bandpass',1100,0,.2,.6,280,1);tone(160,'sine',0,.32,.75,42);tone(95,'square',.0,.18,.12,40);noise('lowpass',2600,.075,.14,.5);tone(140,'sine',.075,.26,.6,45);return}   /* 효과가 굉장했다 (상성 ×2 이상): 두 번 「콰직」 */
  if(kind==='dmg_weak'){noise('lowpass',650,0,.1,.38);tone(92,'sine',0,.14,.38,62);return}   /* 효과가 별로 (상성 ×1 미만): 둔한 「툭」 */
  if(kind==='heal'){[1047,1319,1568,2093].forEach((f,i)=>tone(f,'sine',i*.07,.6,.08));noise('bandpass',6000,0,.5,.05,9000,2);return}   /* 회복 */
 }catch(e){}}
 /* 양측이 2.5초 안에 잇달아 발동하면 둘을 한 화면(VS 꼴)에 — 맵툴 cutin_last. 보낸 쪽·받는 쪽 모두 같은 규칙으로 합친다 */
 let lastFire=null;
 function showFire(c){const now=Date.now();let list=[c];
  if(lastFire&&now-lastFire.t<2500&&lastFire.c.tok!==c.tok){list=[lastFire.c,c];lastFire=null}else lastFire={t:now,c};
  fireLocal(list)}
 function preview(){fireLocal([{tok:'pv',src:'',tag:'미리 보기',ment:'『컷인 크기』',line:'이 크기로 나온다',color:'#e4002b'}])}
 function fire(c){c=c||{};const S=c.se&&c.se!=='cut'?c.se:'';if(S)se(S);showFire(c);DBS().broadcast({t:'cutin',k:'fire',c,se:S})}   /* 옛 「cut」 은 급소 소리로만 쓴다 */

 /* ----- VS 시합 개시 / 경고 ----- */
 function side(cls,S){S=S||{};const mons=(S.mons||[]).slice(0,6);const balls=(S.balls||[]).slice(0,6).map((b,i)=>{const m=mons[i];return `<i class="ball ${b?'':'dead'}" style="animation-delay:${(1.55+i*.1)}s">${m&&m.img?`<img src="${esc(m.img)}" alt="" title="${esc(m.name||'')}">`:''}</i>`}).join('');
  return `<div class="vs-side ${cls}"><div class="por">${S.img?`<img src="${esc(S.img)}" alt="">`:''}</div><div class="txt"><div class="vs-nm">${esc(S.p?'《'+S.p+'》':(S.t||''))}</div><div class="vs-tn">${esc(S.sub||'')}</div><div class="vs-balls">${balls}</div></div></div>`}
 /* 10-24 망령 새 디자인: 양쪽 판이 대각선으로 날아와 가운데서 부딪히고 VS 가 박힌다 (테마 P5 · P3 · P4, 휴대폰 세로는 위아래로) */
 const vU=()=>Math.min(innerHeight/100,innerWidth/100*1.5),vNar=()=>innerWidth/Math.max(1,innerHeight)<1;
 function vsPane(S,L){S=S||{};const mons=S.mons||[],bl=S.balls||[];
  const balls=Array.from({length:6},(_,i)=>{if(bl[i]==null)return '<i class="v3-ball none"></i>';const m=mons[i]||{};return `<i class="v3-ball${bl[i]?'':' dead'}" style="--bi:${i}" title="${esc(m.name||'')}">${m.img?`<img src="${esc(m.img)}" alt="">`:''}</i>`}).join('');
  const rk=String(S.sub||'').split('·').map(x=>x.trim()).filter(Boolean).map(x=>{const k=x.split(' ')[0],v=x.slice(k.length).trim();return `<span><small>${esc(k)}</small><b>${esc(v||'-')}</b></span>`}).join('');
  return `<div class="v3-pane ${L?'v3-L':'v3-R'}"><div class="v3-bg"></div><div class="v3-lines"></div><div class="v3-por${S.img?'':' none'}"${S.img?` style="background-image:url('${cssu(S.img)}')"`:''}></div>
   <div class="v3-plate"><div class="v3-side">${L?'PLAYER':'RIVAL'}</div><div class="v3-nm">${esc(S.p?'《'+S.p+'》':(S.t||'???'))}</div>${rk?`<div class="v3-rk">${rk}</div>`:''}<div class="v3-balls">${balls}</div></div></div>`}
 function vsLocal(D){D=D||{};const r=root('cut');const nar=vNar();const sa=nar?90-Math.atan(.10*innerHeight/innerWidth)*180/Math.PI:Math.atan(.14*innerWidth/innerHeight)*180/Math.PI;r.className=`v3 v3${vt()}${nar?' v3-nar':''}`;r.style.cssText=`--u:${vU()}px;--sa:${sa.toFixed(2)}deg`;
  let sp='';for(let a=0;a<360;a+=30)sp+=`<i style="--a:${a+12}deg"></i>`;
  r.innerHTML=`<div class="v3-dim"></div><div class="v3-shake">${vsPane(D.L,1)}${vsPane(D.R,0)}<div class="v3-seam"></div><div class="v3-ring"></div><div class="v3-spark">${sp}</div><div class="v3-vs"><b>V</b><b>S</b></div></div><div class="v3-top"><span>BATTLE START</span></div><div class="v3-flash"></div>`;
  setTimeout(()=>synth('hit'),560);setTimeout(()=>{if(r.parentNode)r.remove()},4500)}
 /* 경고: 붉은 경보 + 기울어진 경고 테이프 + 글리치 WARNING → 실루엣이 드러나는 강적 · 레이드 HP 칸 */
 function raidLocal(D){D=D||{};const r=root('cut');r.className=`r3 v3${vt()}${vNar()?' v3-nar':''}`;r.style.cssText=`--u:${vU()}px`;
  const one=D.tape?String(D.tape):'⚠ WARNING ⚠ 레이드 보스 출현';let msg='';for(let i=0;i<8;i++)msg+=`<span>${esc(one)}</span>`;
  const x=parseInt(D.x,10);let marks='';if(x>1&&x<=20)for(let k=1;k<x;k++)marks+=`<b style="left:${k*100/x}%"></b>`;const nohp=String(D.nohp)==='1';
  const title=D.title?String(D.title):'레이드 배틀 : '+(D.x||'?');
  r.innerHTML=`<div class="r3-dark"></div><div class="r3-vig"></div><div class="r3-scan"></div>
   <div class="r3-tape t"><div>${msg}${msg}</div></div><div class="r3-tape b"><div>${msg}${msg}</div></div>
   <div class="r3-warn"><b data-t="WARNING">WARNING</b></div>
   <div class="r3-shake"><div class="r3-boss"><div class="r3-glow"></div><div class="r3-im${D.img?'':' none'}"${D.img?` style="background-image:url('${cssu(D.img)}')"`:''}></div><div class="r3-fr"></div></div>
    <div class="r3-ttl"><div class="a">${esc(D.label||'RAID BATTLE')}</div><div class="b">${esc(title)}</div>${D.n?`<div class="n">${esc(D.n)}</div>`:''}${D.ph>0?`<div class="c">PHASE ${esc(D.ph)}</div>`:''}</div>
    ${nohp?'':`<div class="r3-hp"><i></i>${marks}</div>`}</div><div class="r3-flash"></div>`;
  if(!nohp){let p=parseFloat(D.hp);if(!(p>=0))p=100;setTimeout(()=>{const f=r.querySelector('.r3-hp i');if(f)f.style.width=Math.min(p,100)+'%'},2500)}
  if(!sfx('raid_warning'))synth('siren');setTimeout(()=>{if(r.parentNode)r.remove()},5400)}   /* 맵툴에서 쓰던 경고음. 목록에 없으면 브라우저 사이렌 */
 function fit(r){const f=()=>{const s=Math.min(window.innerWidth/960,window.innerHeight/540)*.94;r.style.setProperty('--s',s>0?s:1)};f();[30,80,160,320].forEach(ms=>setTimeout(f,ms))}
 function vs(L,R){vsLocal({L,R});DBS().broadcast({t:'cutin',k:'vs',L,R})}
 function raid(D){raidLocal(D);DBS().broadcast({t:'cutin',k:'raid',D})}

 /* ----- 페이즈 띠 (turn_overlay): 화면 위 가운데에 잠깐 ----- */
 function phaseLocal(text,sub){const r=root('phov');r.className='phov';r.innerHTML=`<div class="phin"><div class="pht">${esc(text)}</div>${sub?`<div class="phs">${esc(sub)}</div>`:''}</div>`;setTimeout(()=>r.classList.add('out'),1800);setTimeout(()=>r.remove(),2300)}
 function phase(text,sub){phaseLocal(text,sub);DBS().broadcast({t:'cutin',k:'phase',text,sub})}

 /* ----- 진화 연출: 메가진화(빛 고치 → 실루엣 깜빡임 → 번쩍 → 새 모습 + 무지개 고리) · 폼체인지(띠 위에서 실루엣이 돌며 바뀜) · 폼 복귀 ----- */
 function evoLocal(D){D=D||{};if(String(cfg().on)==='0')return;const r=root('cut');r.className='cutov evo '+(D.kind==='mega'?'ev-mega':'ev-form');fit(r);
  const im=(x,c)=>x&&x.img?`<img class="${c}" src="${esc(x.img)}" alt="">`:`<i class="${c} ev-ball"></i>`;const fr=D.from||{},to=D.to||{};const col=D.color||'#e3101f';
  const title=D.kind==='mega'?'메가진화':D.kind==='back'?'원래 모습으로':(D.label||'폼체인지');
  if(D.kind==='mega'){r.innerHTML=`<div class="full ev-dim"></div><div class="stage">
    <div class="ev-rays"></div><div class="ev-orb"><i></i><i></i><i></i></div>
    <div class="ev-mon">${im(fr,'ev-a')}${im(to,'ev-b')}</div>
    <div class="ev-ring"></div><div class="ev-ring r2"></div>
    <div class="ev-txt"><div class="ev-t1">${esc(fr.name||'')}의</div><div class="ev-t2">${esc(title)}!</div><div class="ev-t3">「${esc(to.name||'')}」</div></div></div><div class="full ev-flash"></div>`;
   setTimeout(()=>r.remove(),5200)}
  else{r.style.setProperty('--ec',col);r.innerHTML=`<div class="full ev-dim"></div><div class="ev-band"></div><div class="stage">
    <div class="ev-mon">${im(fr,'ev-a')}${im(to,'ev-b')}</div><div class="ev-spark"></div>
    <div class="ev-txt"><div class="ev-t2">${esc(title)}</div><div class="ev-t3">${esc(fr.name||'')} → 「${esc(to.name||'')}」</div></div></div><div class="full ev-flash"></div>`;
   setTimeout(()=>r.remove(),3400)}}
 function evo(D){evoLocal(D);se('cut');DBS().broadcast({t:'cutin',k:'evo',D})}

 function onEvent(p){if(!p||p.t!=='cutin')return;if(p.k==='fire'){if(p.se&&p.se!=='cut')se(p.se);if(p.c)showFire(p.c);else if(p.list)fireLocal(p.list)}else if(p.k==='vs'){vsLocal(p)}else if(p.k==='raid'){raidLocal(p.D)}else if(p.k==='phase')phaseLocal(p.text,p.sub);else if(p.k==='evo'){se('cut');evoLocal(p.D)}}
 return {synth,preview,fire,vs,raid,phase,evo,evoLocal,onEvent,fireLocal,vsLocal,raidLocal};
})();
