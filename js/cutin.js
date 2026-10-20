/* ---------- 연출 오버레이 (맵툴 Lib:pokemon 의 js_cutin_p5 / js_cut / turn_overlay 를 옮김) ----------
   · fire(list)  : 지시·포텐셜 발동 컷인 (띠 + 카드 + 큰 글씨). list 가 2개면 VS 모양으로 둘 다
   · vs(L,R)     : 시합 개시 VS 컷인
   · raid(opt)   : 경고(위험 등장) 연출
   · phase(text) : 페이즈 띠 (지시 준비 / 턴 개시 / 행동 순서 / 행동 처리 / 턴 종료)
   보내는 쪽은 바로 그리고 broadcast 로 같은 방의 모두에게 보낸다 (저장하지 않는다). */
"use strict";
window.OM_CUTIN=(()=>{
 const DBS=()=>window.OM_STORE, A=()=>window.OM_APP;
 const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const cfg=()=>Object.assign({sc:70,pos:'mid',dim:1,dur:0,on:1},(((A()&&A().ST.state||{}).rp||{}).cutin)||{});
 let unlocked=false;document.addEventListener('pointerdown',()=>{unlocked=true},{once:true});
 function se(name){try{if(window.OM_RP_UI)window.OM_RP_UI.playSe(name,true)}catch(e){}}
 function root(id){let r=document.getElementById(id);if(r)r.remove();r=document.createElement('div');r.id=id;document.body.appendChild(r);return r}
 const rnd=(a,b)=>a+Math.random()*(b-a);
 function jag(fill,stroke,sw,amp){const top=[],bot=[];let x=0;while(x<1000){top.push([x,rnd(0,amp)]);x+=rnd(14,40)}top.push([1000,rnd(0,amp)]);x=1000;while(x>0){bot.push([x,100-rnd(0,amp)]);x-=rnd(14,40)}bot.push([0,100-rnd(0,amp)]);
  const pts=top.concat(bot).map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');return `<svg viewBox="0 0 1000 100" preserveAspectRatio="none"><polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" vector-effect="non-scaling-stroke"/></svg>`}
 function zig(){let p='',x=0,up=true;while(x<=1000){p+=x+','+(up?20:80)+' ';x+=45;up=!up}return `<svg viewBox="0 0 1000 100" preserveAspectRatio="none"><polyline points="${p}" fill="none" stroke="#111" stroke-width="22" vector-effect="non-scaling-stroke"/><polyline points="${p}" fill="none" stroke="#ffe14a" stroke-width="14" vector-effect="non-scaling-stroke"/><polyline points="${p}" fill="none" stroke="#fff" stroke-width="4" vector-effect="non-scaling-stroke"/></svg>`}

 /* ----- 발동 컷인 (P5 꼴) ----- */
 function fireLocal(list){const C=cfg();if(String(C.on)==='0')return;list=(list||[]).slice(0,2);if(!list.length)return;const dual=list.length>1;
  let K=parseFloat(C.sc);if(!(K>0))K=70;K=Math.max(40,Math.min(120,K))/100;const POS=C.pos||'mid',DIM=String(C.dim)==='0'?0:1,DUR=parseFloat(C.dur);const END=DUR>0?DUR:(dual?3.6:3.1);
  const r=root('p5');r.className='p5';r.style.setProperty('--end',END+'s');
  let h=DIM?'<div class="p-dim"></div>':'';h+='<div class="p-shake">';
  list.forEach((c,i)=>{const left=!dual||i===0;const rh=(dual?26:30)*K;const ctr=dual?(i===0?50-20*Math.max(K,.75):50+20*Math.max(K,.75)):(POS==='top'?28:POS==='bot'?72:50);const cw=(dual?30:38)*K;
   const big=String(c.ment||c.name||'');let fs=dual?10:11.5;if(big.length>8)fs=fs*8/big.length;if(fs<5)fs=5;fs*=K;
   h+=`<div class="p-row" style="--rh:${rh}vh;--ry:${ctr-rh/2}vh;--rot:${dual?-5:-7}deg;--org:${left?'0%':'100%'};--d0:${i*.45}s;${c.color?`--pc:${esc(c.color)}`:''}">
    <div class="p-red">${jag(c.color||'#e3101f','#fff',3,10)}</div><div class="p-blk">${jag('#111','#fff',5,22)}</div>
    <div class="p-card ${left?'':'rv'}" style="--cw:${cw}vh;${left?'left':'right'}:22vw;--cx:${left?-60:60}vw"><div class="bk"></div><div class="fr"><div class="ib">${c.src?`<img src="${esc(c.src)}" alt="">`:''}</div><div class="sl"></div></div></div>
    <div class="p-txt" style="${left?'left':'right'}:calc(22vw + ${cw*1.05}vh + ${7*K}vw);text-align:${left?'left':'right'};--tx:${left?50:-50}vw;--ts:${(dual?3:3.8)*K}vh;--fs:${fs}vh">${c.tag?`<div class="p-tag">${esc(c.tag)}</div>`:''}<div class="p-big"><span class="b2">${esc(big)}</span><span class="b3">${esc(big)}</span><span class="b1">${esc(big)}</span><span class="b0">${esc(big)}</span></div></div></div>`});
  if(dual)h+=`<div class="p-zig" style="height:${12*K}vh;margin-top:${-6*K}vh">${zig()}</div><div class="p-vs" style="font-size:${9*K}vh">VS</div>`;
  h+='</div><div class="p-flash"></div>';r.innerHTML=h;
  setTimeout(()=>{if(r.parentNode)r.remove()},(END+.45)*1000)}
 /* 양측이 2.5초 안에 잇달아 발동하면 둘을 한 화면(VS 꼴)에 — 맵툴 cutin_last. 보낸 쪽·받는 쪽 모두 같은 규칙으로 합친다 */
 let lastFire=null;
 function showFire(c){const now=Date.now();let list=[c];
  if(lastFire&&now-lastFire.t<2500&&lastFire.c.tok!==c.tok){list=[lastFire.c,c];lastFire=null}else lastFire={t:now,c};
  fireLocal(list)}
 function fire(c){c=c||{};se(c.se||'cut');showFire(c);DBS().broadcast({t:'cutin',k:'fire',c,se:c.se||'cut'})}

 /* ----- VS 시합 개시 / 경고 ----- */
 function side(cls,S){S=S||{};const mons=(S.mons||[]).slice(0,6);const balls=(S.balls||[]).slice(0,6).map((b,i)=>{const m=mons[i];return `<i class="ball ${b?'':'dead'}" style="animation-delay:${(1.55+i*.1)}s">${m&&m.img?`<img src="${esc(m.img)}" alt="" title="${esc(m.name||'')}">`:''}</i>`}).join('');
  return `<div class="vs-side ${cls}"><div class="por">${S.img?`<img src="${esc(S.img)}" alt="">`:''}</div><div class="txt"><div class="vs-nm">${esc(S.p?'《'+S.p+'》':(S.t||''))}</div><div class="vs-tn">${esc(S.sub||'')}</div><div class="vs-balls">${balls}</div></div></div>`}
 function vsLocal(D){const r=root('cut');r.className='cutov';fit(r);r.innerHTML=`<div class="full vs-blink"></div><div class="full vs-dim"></div><div class="vs-band"></div><div class="full vs-flash"></div><div class="stage">${side('vs-L',D.L)}${side('vs-R',D.R)}<div class="vs-word">VS</div></div>`;setTimeout(()=>r.remove(),4300)}
 function raidLocal(D){const r=root('cut');r.className='cutov';fit(r);const one=D.tape?String(D.tape):'⚠ WARNING ⚠ 레이드 보스 출현';let msg='';for(let i=0;i<8;i++)msg+=one+' ';
  const x=parseInt(D.x,10);let marks='';if(x>1&&x<=20)for(let k=1;k<x;k++)marks+=`<b style="left:${k*100/x}%"></b>`;
  r.innerHTML=`<div class="full rd-dark"></div><div class="full rd-red"></div><div class="rd-tape t"><div>${esc(msg)}</div></div><div class="rd-tape b"><div>${esc(msg)}</div></div><div class="stage"><div class="full rd-shake"><div class="rd-boss">${D.img?`<img src="${esc(D.img)}" alt="">`:''}</div><div class="rd-ttl"><div class="a">${esc(D.label||'RAID BATTLE')}</div><div class="b">${esc((D.title?String(D.title):'레이드 배틀 : '+(D.x||'?'))+(D.n?' — '+D.n:''))}</div>${D.ph>0?`<div class="c">페이즈 ${esc(D.ph)}</div>`:''}</div>${String(D.nohp)==='1'?'':`<div class="rd-hp"><i></i>${marks}</div>`}</div></div>`;
  if(String(D.nohp)!=='1'){let p=parseFloat(D.hp);if(!(p>=0))p=100;setTimeout(()=>{const f=r.querySelector('.rd-hp i');if(f)f.style.width=Math.min(p,100)+'%'},2400)}
  setTimeout(()=>r.remove(),5000)}
 function fit(r){const f=()=>{const s=Math.min(window.innerWidth/960,window.innerHeight/540)*.94;r.style.setProperty('--s',s>0?s:1)};f();[30,80,160,320].forEach(ms=>setTimeout(f,ms))}
 function vs(L,R){vsLocal({L,R});se('cut');DBS().broadcast({t:'cutin',k:'vs',L,R})}
 function raid(D){raidLocal(D);se('cut');DBS().broadcast({t:'cutin',k:'raid',D})}

 /* ----- 페이즈 띠 (turn_overlay): 화면 위 가운데에 잠깐 ----- */
 function phaseLocal(text,sub){const r=root('phov');r.className='phov';r.innerHTML=`<div class="phin"><div class="pht">${esc(text)}</div>${sub?`<div class="phs">${esc(sub)}</div>`:''}</div>`;setTimeout(()=>r.classList.add('out'),1800);setTimeout(()=>r.remove(),2300)}
 function phase(text,sub){phaseLocal(text,sub);DBS().broadcast({t:'cutin',k:'phase',text,sub})}

 function onEvent(p){if(!p||p.t!=='cutin')return;if(p.k==='fire'){se(p.se||'cut');if(p.c)showFire(p.c);else if(p.list)fireLocal(p.list)}else if(p.k==='vs'){se('cut');vsLocal(p)}else if(p.k==='raid'){se('cut');raidLocal(p.D)}else if(p.k==='phase')phaseLocal(p.text,p.sub)}
 return {fire,vs,raid,phase,onEvent,fireLocal,vsLocal,raidLocal};
})();
