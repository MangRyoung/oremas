/* ---------- SP (서포터) 효과 (맵툴의 SP 기능을 옮김, 2026-10-25 망령) ----------
   배틀 밖에서 돕는 조력자의 한 수. 트레이너마다 여러 개를 적어 두고, 배틀에서 「SP」 → 「발동」.
   트레이너.sps = [{name, prob(%; 비우면 100), theme(한 줄), eff(효과, 한 줄에 하나), img(컷 그림), line(컷인 대사), color}]
   로스터(시트) 쪽에 산다 — 빌려 온 파티는 srcTid. 배틀에만 있는 트레이너는 battle.trainers 쪽에.
   발동: 확률이 100 미만이면 d100 을 굴려 그 값 이하면 성공 → 고유 포텐셜처럼 컷인(모두의 화면) + 로그에 효과. 실패면 로그만.
   주인(그 트레이너의 좌석 · 함께 지시하는 좌석)과 GM 만 고치고 발동한다. */
"use strict";
window.OM_SP_UI=(()=>{
 const A=()=>window.OM_APP,DBS=()=>window.OM_STORE,BU=()=>window.OM_BATTLE_UI;
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const $=(s,r)=>(r||document).querySelector(s);
 const ST=()=>A().ST;const gm=()=>ST().role==='gm';
 const effLines=t=>String(t||'').replace(/<br\s*\/?>/g,'\n').split('\n').map(x=>x.trim()).filter(Boolean);
 const fix=a=>(Array.isArray(a)?a:[]).filter(x=>x&&typeof x==='object'&&String(x.name||'').trim()).map(x=>({name:String(x.name).trim(),prob:x.prob===''||x.prob==null?100:Math.max(0,Math.min(100,Math.round(+x.prob)||0)),theme:String(x.theme||''),eff:String(x.eff||''),img:String(x.img||''),line:String(x.line||''),color:String(x.color||''),auto:x.auto&&typeof x.auto==='object'&&String(x.auto.dsl||'').trim()?{dsl:String(x.auto.dsl),ops:Array.isArray(x.auto.ops)?x.auto.ops:[]}:null}));
 const hasAuto=e=>!!(e&&e.auto&&e.auto.ops&&e.auto.ops.length);
 const COLORS=['#e4002b','#ff8a00','#ffd12e','#3ddc84','#4aa3ff','#9b5cff','#ff4fa3','#222'];
 /* 배틀의 트레이너 → SP 주인 (로스터 쪽 우선) */
 function owners(){const b=ST().state.battle||{};const r=ST().state.roster||{trainers:{}};const out=[];
  for(const tid of Object.keys(b.trainers||{})){const t=b.trainers[tid];if(!t)continue;const rid=t.srcTid||tid;const rt=(r.trainers||{})[rid];
   out.push({tid,name:t.name||tid,side:t.side||'',img:trainerImg(rt||t),sps:fix(rt?rt.sps:t.sps),path:rt?['roster','trainers',rid,'sps']:['battle','trainers',tid,'sps']})}
  return out}
 function trainerImg(t){if(!t)return '';const st=t.stands||[];const a=st[+t.standActive||0]||st[0];return (a&&a.src)||t.image||''}
 function mine(o){if(gm())return true;const seat=ST().seat;if(!seat)return false;if(o.tid===seat)return true;try{const c=BU().ctx();return !!(c&&c.role==='seat'&&((((ST().state.roster||{}).trainers||{})[o.tid]||{}).co||[]).includes(seat))}catch(e){return false}}
 /* 배틀 위 단추를 보일지: 내 트레이너가 이 진영(또는 이 트레이너)에 있으면 */
 function canOpen(side,tid){return owners().some(o=>mine(o)&&(!side||o.side===side)&&(!tid||o.tid===tid))}

 function open(side,tid){side=typeof side==='string'?side:'';tid=typeof tid==='string'?tid:'';const re=()=>open(side,tid);
  const L=owners().filter(mine).filter(o=>(!side||o.side===side)&&(!tid||o.tid===tid));
  const card=(o,e,k)=>`<div class="spc" style="--spc:${esc(e.color||'#ffd12e')}">${e.img?`<i class="spimg" style="background-image:url('${cssu(e.img)}')"></i>`:'<i class="spimg none">SP</i>'}
    <div class="spb"><div class="sph"><b>『${esc(e.name)}』</b>${hasAuto(e)?`<span class="spau" title="${esc(e.auto.dsl)}">⚙ 자동</span>`:''}<span class="spp ${e.prob>=100?'all':''}">${e.prob>=100?'확정':e.prob+'%'}</span></div>${e.theme?`<div class="spt">${esc(e.theme)}</div>`:''}
     <ul class="spe">${effLines(e.eff).map(l=>`<li>${esc(l)}</li>`).join('')||'<li class="dim">효과 글 없음</li>'}</ul>
     <div class="row spa"><button class="btn sm pri" data-spf="${k}" data-tid="${esc(o.tid)}" title="${e.prob>=100?'바로 발동 — 컷인이 모두에게 뜬다':'d100 을 굴려 '+e.prob+' 이하면 발동'}">발동</button>${gm()&&e.prob<100?`<button class="btn sm ghost" data-spf="${k}" data-tid="${esc(o.tid)}" data-force="1" title="굴리지 않고 성공으로 (GM)">확정 발동</button>`:''}<span class="sp"></span><button class="btn xs ghost" data-spe="${k}" data-tid="${esc(o.tid)}">✎ 고치기</button><button class="btn xs ghost danger" data-spd="${k}" data-tid="${esc(o.tid)}">삭제</button></div></div></div>`;
  const md=A().openModal(`<div class="mhead"><h2>SP · 서포터</h2><span class="small dim" style="margin-left:8px">밖에서 돕는 조력자의 한 수 — 확률 · 효과를 적어 두고 배틀에서 발동</span><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   ${L.length?L.map(o=>`<div class="spown"><div class="spoh"><b>${esc(o.name)}</b><small>${o.sps.length}개</small><span class="sp"></span><button class="btn sm" data-spn="${esc(o.tid)}">＋ 새 SP</button></div>${o.sps.map((e,k)=>card(o,e,k)).join('')||'<div class="dim small" style="padding:8px 2px">아직 SP 가 없다 — 「＋ 새 SP」</div>'}</div>`).join(''):'<div class="dim">이 진영에 내 트레이너가 없다.</div>'}`);
  md.classList.add('wide','spmodal');
  const own=t=>L.find(o=>o.tid===t);
  md.querySelectorAll('[data-spn]').forEach(b=>b.onclick=()=>edit(own(b.dataset.spn),-1,re));
  md.querySelectorAll('[data-spe]').forEach(b=>b.onclick=()=>edit(own(b.dataset.tid),+b.dataset.spe,re));
  md.querySelectorAll('[data-spd]').forEach(b=>b.onclick=async()=>{const o=own(b.dataset.tid);const k=+b.dataset.spd;const e=o.sps[k];if(!e||!confirm(`『${e.name}』 SP 를 지울까?`))return;const L2=o.sps.slice();L2.splice(k,1);await A().set(o.path,L2);re()});
  md.querySelectorAll('[data-spf]').forEach(b=>b.onclick=async()=>{const o=own(b.dataset.tid);const e=o&&o.sps[+b.dataset.spf];if(!e)return;b.disabled=true;await fire(o,e,!!b.dataset.force);A().closeModal()})}

 function edit(o,k,back){if(!o)return;const e=k>=0?Object.assign({},o.sps[k]):{name:'',prob:100,theme:'',eff:'',img:'',line:'',color:'#ffd12e'};
  const md=A().openModal(`<div class="mhead"><h2>${k>=0?'SP 고치기':'새 SP'} — ${esc(o.name)}</h2><span class="sp"></span><button class="btn ghost" id="sp_back">← 목록</button></div>
   <div class="spform">
    <label class="ppf"><span>이름</span><input type="text" id="sp_n" value="${esc(e.name)}" placeholder="예) 옛 동료의 지원 사격" autocomplete="off"></label>
    <label class="ppf"><span>확률</span><span class="row" style="gap:8px"><input type="number" id="sp_p" min="0" max="100" value="${e.prob}" style="width:90px"> % <small class="dim">100 이면 굴리지 않고 바로 발동</small></span></label>
    <label class="ppf"><span>테마</span><input type="text" id="sp_t" value="${esc(e.theme)}" placeholder="한 줄 — 누가 · 어떻게 돕는지 (예: 하늘에서 내려오는 은빛 화살)"></label>
    <label class="ppf ppt"><span>효과</span><textarea id="sp_e" rows="4" placeholder="한 줄에 하나 — 예) 상대 전체 방어 −1 랭크">${esc(e.eff)}</textarea></label>
    <label class="ppf"><span>컷인 대사</span><input type="text" id="sp_l" value="${esc(e.line)}" placeholder="(골라도 되고 비워도 된다) 컷인 아래 흰 띠"></label>
    <div class="ppf"><span>컷 그림</span><div style="flex:1;min-width:0;display:flex;gap:10px;align-items:stretch"><div class="sppv" id="sp_pv" style="${e.img?`background-image:url('${cssu(e.img)}')`:''}">${e.img?'':'없으면 트레이너 그림'}</div><div style="flex:1;display:flex;flex-direction:column;gap:6px;min-width:0"><div class="updz" id="sp_dz" tabindex="0"><b>그림 끌어 놓기</b><span>클릭 · Ctrl+V</span><input type="file" accept="image/*" hidden></div><input type="text" id="sp_i" value="${esc(e.img)}" placeholder="또는 그림 주소"></div></div></div>
    <div class="ppf ppt"><span>자동화 구문</span><div style="flex:1;min-width:0"><textarea id="sp_a" rows="3" style="width:100%;font-family:var(--mono);font-size:12.5px" placeholder="(비우면 효과 글만 로그에) — 예) 랭크 공격+1 임시 아군전체 · 상태확률 화상 30% 상대1체">${esc(e.auto?e.auto.dsl:'')}</textarea><div class="small" id="sp_ap" style="white-space:pre-wrap;margin-top:4px"></div><details class="spgen"><summary class="small">⚙ 생성기 — 골라서 구문 만들기</summary><div id="sp_ag"></div></details><details><summary class="small dim">구문 도움말 — 발동 성공 때 고른 내 포켓몬을 기준으로 대상(자신 · 상대1체 · 아군전체 …)을 잡는다</summary><pre class="small" style="white-space:pre-wrap">${esc((window.OM_FX_UI||{}).HELP||'')}</pre></details></div></div>
    <div class="ppf"><span>색</span><span class="spcols">${COLORS.map(c=>`<button type="button" class="spcol ${c===e.color?'on':''}" data-c="${c}" style="background:${c}"></button>`).join('')}</span></div>
    <div class="row" style="margin-top:10px"><span class="sp"></span><button class="btn" id="sp_pre">컷인 미리 보기</button><button class="btn pri" id="sp_ok">저장</button></div></div>`);
  md.classList.add('spmodal');
  const pv=u=>{const p=$('#sp_pv',md);p.style.backgroundImage=u?`url('${cssu(u)}')`:'';p.textContent=u?'':'없으면 트레이너 그림'};
  $('#sp_i',md).oninput=ev=>pv(ev.target.value.trim());
  const up=async f=>{if(!f||!/^image\//.test(f.type||''))return;try{const u=await DBS().uploadImage(`rooms/${ST().room}/sp_${Date.now().toString(36)}${Math.random().toString(36).slice(2,5)}`,f);$('#sp_i',md).value=u;pv(u);A().toast('그림을 올렸다')}catch(err){A().toast('올리지 못했다: '+err.message)}};
  const dz=$('#sp_dz',md),fi=dz.querySelector('input');dz.onclick=()=>fi.click();fi.onchange=()=>up(fi.files[0]);
  dz.addEventListener('dragover',ev=>{ev.preventDefault();dz.classList.add('over')});dz.addEventListener('dragleave',()=>dz.classList.remove('over'));dz.addEventListener('drop',ev=>{ev.preventDefault();dz.classList.remove('over');up(ev.dataTransfer.files[0])});
  md.addEventListener('paste',ev=>{const it=[...(ev.clipboardData||{}).items||[]].find(x=>/^image\//.test(x.type));if(it){ev.preventDefault();up(it.getAsFile())}});
  const K=window.OM_FX;const apv=()=>{const ta=$('#sp_a',md),el=$('#sp_ap',md);if(!K||!ta||!el)return;const r=K.parse(ta.value);el.innerHTML=(r.ops.length?'미리보기: '+esc(K.unparse(r.ops).join(' / ')):'')+(r.errs.length?` <span style="color:var(--red)">모르는 줄: ${esc(r.errs.join(' / '))}</span>`:'')};
  {const ta=$('#sp_a',md);if(ta){ta.addEventListener('input',apv);apv();const gh=$('#sp_ag',md);if(gh&&window.OM_FX_UI&&window.OM_FX_UI.mountGen)window.OM_FX_UI.mountGen(gh,ta,{toast:t=>A().toast(t)})}}
  let col=e.color;md.querySelectorAll('.spcol').forEach(b=>b.onclick=()=>{col=b.dataset.c;md.querySelectorAll('.spcol').forEach(x=>x.classList.toggle('on',x===b))});
  const grab=()=>({name:$('#sp_n',md).value.trim(),prob:Math.max(0,Math.min(100,Math.round(+$('#sp_p',md).value)||0)),theme:$('#sp_t',md).value.trim(),eff:$('#sp_e',md).value,img:$('#sp_i',md).value.trim(),line:$('#sp_l',md).value.trim(),color:col,auto:(()=>{const dsl=$('#sp_a',md).value.trim();if(!dsl)return null;const r=K?K.parse(dsl):{ops:[],errs:[]};return {dsl,ops:r.ops}})()});
  $('#sp_back',md).onclick=()=>{A().closeModal();back&&back()};
  $('#sp_pre',md).onclick=()=>{const g=grab();if(window.OM_CUTIN)window.OM_CUTIN.fireLocal([cutOf(o,Object.assign({},g,{name:g.name||'SP 이름'}))])};
  $('#sp_ok',md).onclick=async()=>{const g=grab();if(!g.name)return A().toast('이름이 필요해');const L=o.sps.slice();if(k>=0)L[k]=g;else L.push(g);await A().set(o.path,L);A().toast(`『${g.name}』 저장`);A().closeModal();back&&back()}}

 function cutOf(o,e){return {tok:'sp:'+o.tid,src:e.img||o.img||'',tag:`${o.name}의 서포터!`,ment:`『${e.name}』`,color:e.color||'#ffd12e',line:e.line||e.theme||'',gh:'SUPPORT'}}
 /* 자동화 구문이 있으면 기준이 될 내 포켓몬(필드 위)을 고른다 — 구문의 대상(자신 · 상대1체 …)은 그 포켓몬에서 잡는다 */
 function pickAnchor(o){const b=ST().state.battle||{};const ms=Object.values(b.mons||{}).filter(m=>m&&m.tid===o.tid&&m.entry&&m.hp&&m.hp.cur>0).sort((x,y)=>String(x.entry).localeCompare(String(y.entry)));
  if(!ms.length)return Promise.resolve('');if(ms.length===1)return Promise.resolve(ms[0].id);
  return new Promise(res=>{let done=false;const md=A().openModal(`<div class="mhead"><h2>SP 구문 — 기준 포켓몬</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="small dim" style="margin-bottom:8px">구문의 「자신 · 아군 · 상대」는 이 포켓몬을 기준으로 잡는다.</div><div class="mmenu">${ms.map(m=>`<button class="btn" data-am="${esc(m.id)}">${esc(m.name)} <small>에리어 ${esc(String(m.entry).toUpperCase())}</small></button>`).join('')}</div>`);
   md.querySelectorAll('[data-am]').forEach(x=>x.onclick=()=>{done=true;A().closeModal();res(x.dataset.am)});const xb=md.querySelector('[data-x]');if(xb)xb.addEventListener('click',()=>{if(!done){done=true;res(null)}})})}
 async function fire(o,e,force){let anchor='';if(hasAuto(e)){anchor=await pickAnchor(o);if(anchor===null)return false}
  const p=e.prob>=100||force?100:e.prob;let roll=0,ok=true;if(p<100){roll=1+Math.floor(Math.random()*100);ok=roll<=p}
  const head=`【SP】 ${o.name}의 서포터 『${e.name}』`+(p<100?` — 확률 ${p}% · d100 = ${roll} → ${ok?'성공!':'실패'}`:force&&e.prob<100?' — GM 확정 발동':'');
  if(!ok){await A().sysLog(`${head}${e.theme?' · '+e.theme:''}`,'battle');A().toast(`실패 — ${roll} > ${p}`);return false}
  if(window.OM_CUTIN)window.OM_CUTIN.fire(cutOf(o,e));
  const body=`${e.theme?'\n'+e.theme:''}${effLines(e.eff).length?'\n'+effLines(e.eff).map(l=>'· '+l).join('\n'):''}`;
  if(hasAuto(e)&&anchor&&BU()&&BU().fireAuto){const m=((ST().state.battle||{}).mons||{})[anchor];const okA=await BU().fireAuto(anchor,'pot',e.name,{auto:Object.assign({name:e.name,src:'sp',text:e.eff||''},e.auto),quiet:true,noRoll:true,head:head+(m?` → 기준 ${m.name}`:''),img:e.img||o.img||'',eff:[e.theme,e.eff].filter(Boolean).join('\n')});if(okA!==false)return true}
  else if(hasAuto(e)&&!anchor)A().toast('필드에 내 포켓몬이 없어 구문은 건너뛰고 효과 글만 남긴다');
  await A().sysLog(`${head}${body}`,'battle');return true}

 return {open,canOpen,owners,fire}})();
