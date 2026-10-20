/* ---------- 스킬 체크 (스킬 체크 룰 v3 · 맵툴 skill_gm / skill_mgr 를 옮김) ----------
   자질 주사위: D d4 / C d6 / B d8 / A d10 / AA d12, ± 보정 ±1. 동료 주사위: 포켓몬 d6(『유대』 통솔 판정 d8) / 혼자 d4 / 이능(A 이상) 자기 능력 주사위 하나 더.
   결과: 목표+5 대성공 · 목표 이상 성공 · 1~2 모자람 대가를 치르고 성공 · 그 아래 실패 · 두 주사위 모두 1 대실패(A 이상은 실패).
   상황 보정: 주사위 단계 ±1(d4 아래면 자동 실패, d12 위면 d12+1) · 두 번 굴려 높은/낮은 값.
   묘수(지시 A 1회 · AA 2회): 지시 판정 뒤 주사위 하나 다시. 돌봄(육성 B 이상, 휴식 사이 1회): 지친 포켓몬 1체 회복. 이능: 휴식 사이 2회, 실패하면 부상(부상 중이면 중상) + 소지 포켓몬 1체 HP 1/4.
   AA 특권: 세션 1회, 목표 9 이하 이능 판정을 굴리지 않고 성공(이능 1회 소모). 커버: 다른 트레이너가 결과를 한 칸 올리고 부상(중상은 불가). 프라이드 A 고집: 동료 주사위 1 → 대가.
   상태: state.skill = {cfg, offer, trainers:{tid:{myosu,care,inou,aa,inj,tired:[mid]}}, res:{tid:{...}}, hist:[]} */
"use strict";
window.OM_SKILL_UI=(()=>{
 const A=()=>window.OM_APP, S=()=>window.OM_STATS;
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const $=(s,r)=>(r||document).querySelector(s);
 const SK=['지시','육성','통솔','능력'];
 const DIFF=[[5,'쉬움'],[7,'보통'],[9,'어려움'],[11,'매우 어려움']];
 const NPC=[[0,'없음'],[1,'일반인 d4+d4',[4,4]],[2,'일반 트레이너 d6+d6',[6,6]],[3,'숙련 트레이너 d8+d6',[8,6]],[4,'『두목』 d10+d6',[10,6]]];
 const LAD={E:0,D:0,C:1,B:2,A:3,AA:4,AAA:4,S:4},SIDES=[4,6,8,10,12];
 const RES=['대실패','실패','대가를 치르고 성공','성공','대성공'];const COL=['#7a1020','#8a1c2b','#8a6a12','#1f7a4a','#1a6ad8'];
 const CFG0={s1:1,s2:2,both1:1,noinou2:1,nocover2:1,hp1:'1/4',hp2:'1/4',rest:1,inou:2,aa:9,myosuA:1,myosuAA:2};
 const d=n=>1+Math.floor(Math.random()*n);
 const st=()=>A().ST.state.skill||{};
 const cfg=()=>Object.assign({},CFG0,st().cfg||{});
 const trs=()=>Object.assign({},(A().ST.state.roster||{}).trainers||{});
 const mons=()=>(A().ST.state.roster||{}).mons||{};
 const tsk=tid=>Object.assign({myosu:0,care:0,inou:0,aa:0,inj:0,tired:[]},(st().trainers||{})[tid]||{});
 const rankOf=(t,stat)=>String(((t||{}).ranks||{})[stat]||'').trim();
 const lv=r=>LAD[S().strip(r)]??0;
 const sign=r=>/\+$/.test(r)?1:/-$/.test(r)?-1:0;
 const gm=()=>A().ST.role==='gm';
 const me=()=>A().ST.seat;
 const canEdit=tid=>gm()||tid===me();
 const myosuMax=t=>{const r=S().strip(rankOf(t,'지시'));return r==='A'?cfg().myosuA:(LAD[r]>=4?cfg().myosuAA:0)};
 const hasBond=m=>[...(m.pots||[]),m.excl,...(m.exclX||[])].some(p=>p&&/유대/.test(p.name||''));
 const prideA=m=>/^A/.test(S().strip(m.pride||''));
 const frac=(v,s)=>{const m=String(s||'1/4').match(/^(\d+)\s*\/\s*(\d+)$/);return m?Math.max(1,Math.floor(v*+m[1]/+m[2])):Math.max(1,Math.floor(+s||0))};
 async function setT(tid,patch){const cur=tsk(tid);const n=Object.assign(cur,patch);await A().set(['skill','trainers',tid],n);return n}
 async function hpLoss(tid,mid,fracs,why){const m=mons()[mid];if(!m)return '';const loss=frac(m.hp.max,fracs);const nm=JSON.parse(JSON.stringify(m));nm.hp.cur=Math.max(0,nm.hp.cur-loss);await A().set(['roster','mons',mid],nm);
  const bm=((A().ST.state.battle||{}).mons||{})[mid];if(bm){await A().set(['battle','mons',mid,'hp'],Object.assign({},bm.hp,{cur:Math.max(0,bm.hp.cur-loss)}))}return `${m.name} HP −${loss} (${why})`}
 /* 부상 한 단계. 돌려줌 {inj, line} */
 async function injure(tid,pickMid){const t=trs()[tid];const k=tsk(tid);const inj=Math.min(2,(+k.inj||0)+1);await setT(tid,{inj});const line=await hpLoss(tid,pickMid,inj>=2?cfg().hp2:cfg().hp1,inj>=2?'중상':'부상');return {inj,line:`${t.name} ${inj>=2?'「중상」':'「부상」'}${line?' · '+line:''}`}}
 function pickMon(tid,title){return new Promise(res=>{const ms=Object.values(mons()).filter(m=>m.tid===tid&&m.hp.cur>0);if(!ms.length)return res(null);
  const md=A().openModal(`<div class="mhead"><h2>${esc(title)}</h2><span class="sp"></span></div><div class="small dim" style="margin-bottom:6px">소지 포켓몬 1체를 고른다 (체력이 줄어든다)</div><div class="pg">${ms.map(m=>`<div class="pc" data-pk="${m.id}"><div class="pic" style="${m.image?`background-image:url('${m.image}')`:''}"></div><div><b>${esc(m.name)}</b><div class="small dim">HP ${m.hp.cur}/${m.hp.max}</div></div></div>`).join('')}</div>`);
  md.querySelectorAll('[data-pk]').forEach(el=>el.onclick=()=>{A().closeModal();res(el.dataset.pk)})})}

 /* ===== 판정 계산 ===== */
 function dieOf(t,stat,o){ /* o: {inj, step, inou} → {sides, plus, autofail, idx} */
  const r=rankOf(t,stat);let idx=lv(r)+(o.step||0);const injStep=o.inj>=2?cfg().s2:o.inj>=1?cfg().s1:0;idx-=injStep;
  const autofail=idx<0;let plus=sign(r);if(idx>4){plus+=idx-4;idx=4}idx=Math.max(0,Math.min(4,idx));return {sides:SIDES[idx],plus,autofail,idx,injStep}}
 function judge(total,target,fumble,aLv){const diff=total-target;let ri=1;if(diff>=-2)ri=2;if(diff>=0)ri=3;if(diff>=5)ri=4;if(fumble)ri=aLv>=3?1:0;return ri}

 /* ===== 창 ===== */
 function open(){if(gm())return openGm();const tid=me();if(!tid)return A().toast('자리에 앉아야 한다');openPlayer(tid)}

 /* ----- GM ----- */
 function openGm(tab){tab=tab||'offer';const K=st();const T=trs();const O=K.offer;const R=K.res||{};const C=cfg();
  const md=A().openModal(`<div class="mhead"><h2>스킬 체크 <span class="small dim">GM</span></h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="tabs">${[['offer','체크 제시'],['status','트레이너 현황'],['cfg','설정']].map(([k,n])=>`<button class="tb ${tab===k?'on':''}" data-skt="${k}">${n}</button>`).join('')}</div>
   ${tab==='offer'?`${O?`<div class="card hit"><div class="sec">지금 제시된 체크 <span class="note">${esc(O.label||'')}</span></div><div class="small">${esc(O.stat)} · ${O.mode==='inou'?'이능':'기교/일반'} · 목표 ${O.target}${O.npc?' (대항 '+esc(O.npc)+')':''}${O.step?' · 단계 '+(O.step>0?'+':'')+O.step:''}${O.twice?' · 두 번 굴려 '+(O.twice>0?'높은':'낮은')+' 값':''} · 대상: ${(O.ids||[]).map(id=>esc((T[id]||{}).name||id)).join(', ')}${O.pen?'<br>대가·패널티 메모: '+esc(O.pen):''}</div>
     <div class="firelist" style="margin-top:6px">${(O.ids||[]).map(id=>{const r=R[id];const t=T[id]||{};return `<div class="firerow"><b>${esc(t.name)}</b>${r&&r.offerId===O.id?`<span style="color:${COL[r.ri]}">${RES[r.ri]}</span><span class="small dim">${esc(r.text.split('\\n').slice(1).join(' / '))}</span>${r.cover?`<span class="tag">커버 ${esc(T[r.cover.by]&&T[r.cover.by].name)}</span>`:''}`:'<span class="small dim">아직 안 굴림</span>'}<span class="sp"></span><button class="btn xs" data-sk="rollfor" data-tid="${id}">대신 굴리기</button></div>`}).join('')}</div>
     <div class="row" style="margin-top:8px"><span class="sp"></span><button class="btn ghost" data-sk="close">마감 (제시 거두기)</button></div></div>`:''}
    <div class="card"><div class="sec">새 체크 제시</div>
     <div class="row" style="flex-wrap:wrap;gap:8px"><label>이름표 <input type="text" id="so_label" placeholder="예: 정보 수집 · 번역소" style="width:220px"></label><label>자질 <select id="so_stat">${SK.map(s=>`<option value="${s}">${s}</option>`).join('')}</select></label><label>종류 <select id="so_mode"><option value="skill">기교/일반 (자질 + 동료)</option><option value="inou">이능 (A 이상 · 2d능력)</option><option value="any">트레이너가 고름</option></select></label>
      <label>난이도 <select id="so_diff">${DIFF.map(([v,n])=>`<option value="${v}" ${v===7?'selected':''}>${v} ${n}</option>`).join('')}</select></label><label>목표 <input type="number" class="n xs" id="so_target" value="7"></label><label>NPC 대항 <select id="so_npc">${NPC.map(([v,n])=>`<option value="${v}">${n}</option>`).join('')}</select></label></div>
     <div class="row" style="flex-wrap:wrap;gap:8px;margin-top:6px"><label>상황 보정 단계 <select id="so_step"><option value="0">없음</option><option value="1">유리 (한 단계 ↑)</option><option value="-1">불리 (한 단계 ↓)</option></select></label><label>두 번 굴리기 <select id="so_twice"><option value="0">없음</option><option value="1">높은 값</option><option value="-1">낮은 값</option></select></label><label>대가·패널티 메모 <input type="text" id="so_pen" placeholder="실패/대가 때 GM 이 고를 것" style="width:260px"></label></div>
     <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:6px"><span class="small dim">대상</span>${Object.values(T).map(t=>`<label class="chip"><input type="checkbox" data-so-id="${t.id}" checked> ${esc(t.name)}</label>`).join('')}</div>
     <div class="row" style="margin-top:8px"><span class="sp"></span><button class="btn pri" data-sk="offer">제시 (모두에게)</button></div></div>
    <div class="card"><div class="sec">최근 판정 <span class="note">${(K.hist||[]).length}</span></div><div class="small" style="white-space:pre-wrap;max-height:30vh;overflow:auto">${(K.hist||[]).slice(-12).reverse().map(h=>`<div style="border-left:3px solid ${COL[h.ri]};padding:2px 8px;margin:3px 0">${esc(h.text)}</div>`).join('')||'<span class="dim">없음</span>'}</div></div>`
   :tab==='status'?`<div class="card"><div class="sec">트레이너 자원 <span class="note">묘수 · 돌봄 · 이능 · AA 특권 · 부상 · 지침</span></div>
     ${Object.values(T).map(t=>{const k=tsk(t.id);const mm=myosuMax(t);const can=S().strip(rankOf(t,'능력'));const isA=LAD[can]>=3;const tired=k.tired.map(id=>(mons()[id]||{}).name).filter(Boolean);
      return `<div class="firerow" style="flex-wrap:wrap"><b>${esc(t.name)}</b><span class="small">${SK.map(s=>s+' '+esc(rankOf(t,s)||'-')).join(' · ')}</span><span class="sp"></span>
       <span class="small">묘수 ${k.myosu}/${mm}</span><span class="small">돌봄 ${k.care?'사용':(LAD[S().strip(rankOf(t,'육성'))]>=2?'가능':'없음')}</span><span class="small">이능 ${isA?k.inou+'/'+C.inou:'—'}</span><span class="small">AA ${LAD[can]>=4?(k.aa?'사용':'가능'):'—'}</span>
       <span class="small">부상 <select data-sk="inj" data-tid="${t.id}"><option value="0" ${!k.inj?'selected':''}>없음</option><option value="1" ${k.inj===1?'selected':''}>부상</option><option value="2" ${k.inj>=2?'selected':''}>중상</option></select></span>
       <span class="small">지침 ${tired.length?tired.map((n,i)=>`<span class="chip" data-sk="untire" data-tid="${t.id}" data-mid="${k.tired[i]}" title="눌러서 풀기">${esc(n)} ✕</span>`).join(''):'없음'}</span><button class="btn xs ghost" data-sk="resetone" data-tid="${t.id}">초기화</button></div>`}).join('')||'<div class="dim small">로스터에 트레이너가 없다</div>'}
     <div class="row" style="margin-top:10px;gap:6px"><button class="btn" data-sk="rest" title="지침 모두 해제 · 이능 횟수 복구 · 돌봄 복구 · 부상 한 단계 회복">휴식 단계</button><button class="btn ghost" data-sk="session" title="묘수 · AA 특권 · 지침 · 돌봄 · 이능 · 부상 모두 초기화">세션 시작 (전부 초기화)</button></div></div>`
   :`<div class="card"><div class="sec">설정</div><div class="hgrid">
     <label>부상: 자질 주사위 하강 <input type="number" class="n xs" id="sc_s1" value="${C.s1}"></label><label>중상: 하강 <input type="number" class="n xs" id="sc_s2" value="${C.s2}"></label><label><input type="checkbox" id="sc_both1" ${C.both1?'checked':''}> 이능은 두 주사위 모두 하강</label>
     <label>부상 때 포켓몬 HP 감소 <input type="text" class="n xs" id="sc_hp1" value="${esc(C.hp1)}"></label><label>중상 때 <input type="text" class="n xs" id="sc_hp2" value="${esc(C.hp2)}"></label>
     <label><input type="checkbox" id="sc_noinou2" ${C.noinou2?'checked':''}> 중상이면 이능 불가</label><label><input type="checkbox" id="sc_nocover2" ${C.nocover2?'checked':''}> 중상이면 커버 불가</label>
     <label>휴식 때 부상 회복 단계 <input type="number" class="n xs" id="sc_rest" value="${C.rest}"></label><label>휴식 사이 이능 횟수 <input type="number" class="n xs" id="sc_inou" value="${C.inou}"></label><label>AA 특권 목표 상한 <input type="number" class="n xs" id="sc_aa" value="${C.aa}"></label>
     <label>묘수 A <input type="number" class="n xs" id="sc_myosuA" value="${C.myosuA}"></label><label>묘수 AA <input type="number" class="n xs" id="sc_myosuAA" value="${C.myosuAA}"></label></div>
     <div class="row" style="margin-top:8px"><span class="sp"></span><button class="btn pri" data-sk="cfgsave">저장</button></div></div>`}`);
  md.querySelectorAll('[data-skt]').forEach(b=>b.onclick=()=>{A().closeModal();openGm(b.dataset.skt)});
  $('#so_diff',md)&&($('#so_diff',md).onchange=()=>{$('#so_target',md).value=$('#so_diff',md).value});
  md.querySelectorAll('[data-sk]').forEach(el=>{const h=async()=>{const k=el.dataset.sk;
   if(k==='offer'){const ids=[...md.querySelectorAll('[data-so-id]:checked')].map(i=>i.dataset.soId);if(!ids.length)return A().toast('대상을 골라 줘');const npc=NPC.find(x=>x[0]===+$('#so_npc',md).value);
    const o={id:'o'+Date.now().toString(36),label:$('#so_label',md).value.trim(),stat:$('#so_stat',md).value,mode:$('#so_mode',md).value,target:+$('#so_target',md).value||7,npc:npc&&npc[2]?npc[1]:'',npcDice:npc&&npc[2]?npc[2]:null,step:+$('#so_step',md).value||0,twice:+$('#so_twice',md).value||0,pen:$('#so_pen',md).value.trim(),ids,at:Date.now()};
    A().closeModal();await A().set(['skill','offer'],o);await A().set(['skill','res'],{});A().sysLog(`【스킬 체크】 ${o.label?o.label+' · ':''}${o.stat} ${o.mode==='inou'?'이능':''} 목표 ${o.target}${o.npc?' (대항 '+o.npc+')':''}${o.step?' · 단계 '+(o.step>0?'유리':'불리'):''}${o.twice?' · 두 번 굴려 '+(o.twice>0?'높은':'낮은')+' 값':''} → ${ids.map(i=>(T[i]||{}).name).join(', ')} — 상단 「스킬 체크」에서 굴린다`,'battle');try{window.OM_RP_UI&&window.OM_RP_UI.playSe('Ping2')}catch(e){}return openGm('offer')}
   if(k==='close'){A().closeModal();await A().set(['skill','offer'],null);return A().sysLog('스킬 체크 제시를 거뒀다','battle')}
   if(k==='rollfor'){A().closeModal();return openPlayer(el.dataset.tid)}
   if(k==='inj'){await setT(el.dataset.tid,{inj:+el.value});return}
   if(k==='untire'){const t=tsk(el.dataset.tid);t.tired=t.tired.filter(x=>x!==el.dataset.mid);await setT(el.dataset.tid,{tired:t.tired});A().closeModal();return openGm('status')}
   if(k==='resetone'){await A().set(['skill','trainers',el.dataset.tid],{myosu:0,care:0,inou:0,aa:0,inj:0,tired:[]});A().closeModal();return openGm('status')}
   if(k==='rest'){const all={};for(const id in T){const t=tsk(id);all[id]={myosu:t.myosu,aa:t.aa,care:0,inou:0,inj:Math.max(0,(+t.inj||0)-(+C.rest||1)),tired:[]}}A().closeModal();await A().set(['skill','trainers'],all);return A().sysLog('◆ 휴식 단계 — 지침 해제 · 이능·돌봄 횟수 복구 · 부상 한 단계 회복','battle')}
   if(k==='session'){if(!confirm('묘수 · AA 특권 · 지침 · 돌봄 · 이능 · 부상을 모두 초기화할까?'))return;A().closeModal();await A().set(['skill','trainers'],{});await A().set(['skill','hist'],[]);return A().sysLog('◆ 세션 시작 — 스킬 체크 자원 모두 초기화','battle')}
   if(k==='cfgsave'){const g=id=>$('#'+id,md);const n={s1:+g('sc_s1').value||0,s2:+g('sc_s2').value||0,both1:g('sc_both1').checked?1:0,hp1:g('sc_hp1').value.trim(),hp2:g('sc_hp2').value.trim(),noinou2:g('sc_noinou2').checked?1:0,nocover2:g('sc_nocover2').checked?1:0,rest:+g('sc_rest').value||1,inou:+g('sc_inou').value||2,aa:+g('sc_aa').value||9,myosuA:+g('sc_myosuA').value||1,myosuAA:+g('sc_myosuAA').value||2};A().closeModal();await A().set(['skill','cfg'],n);return A().toast('저장했다')}};
   if(el.tagName==='SELECT')el.onchange=h;else el.onclick=h})}

 /* ----- 플레이어 ----- */
 function openPlayer(tid){const T=trs();const t=T[tid];if(!t)return;const K=st();const O=K.offer;const k=tsk(tid);const C=cfg();const R=(K.res||{})[tid];const mine=R&&O&&R.offerId===O.id?R:null;
  const can=S().strip(rankOf(t,'능력'));const aLv=LAD[can]||0;const inouLeft=Math.max(0,C.inou-(+k.inou||0));const myMons=Object.values(mons()).filter(m=>m.hp&&m.hp.cur>0);
  const stat=O?O.stat:'지시';const mode=O?O.mode:'any';
  const md=A().openModal(`<div class="mhead"><h2>스킬 체크 · ${esc(t.name)}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="row small" style="flex-wrap:wrap;gap:10px;margin-bottom:6px"><span>${SK.map(s=>s+' <b>'+esc(rankOf(t,s)||'-')+'</b>').join(' · ')}</span><span class="sp"></span><span>묘수 ${k.myosu}/${myosuMax(t)}</span><span>돌봄 ${k.care?'사용':(LAD[S().strip(rankOf(t,'육성'))]>=2?'가능':'없음')}</span><span>이능 ${aLv>=3?inouLeft+'회 남음':'—'}</span><span>AA 특권 ${aLv>=4?(k.aa?'사용':'가능'):'—'}</span><span style="color:${k.inj?'var(--red)':'inherit'}">${k.inj>=2?'중상':k.inj===1?'부상':'건강'}</span></div>
   ${!O?'<div class="card"><div class="small dim">제시된 체크가 없다. GM 이 제시하면 여기서 굴린다.</div></div>':!(O.ids||[]).includes(tid)&&!gm()?'<div class="card"><div class="small dim">이번 체크는 내 대상이 아니다.</div></div>':`
   <div class="card hit"><div class="sec">${esc(O.label||'스킬 체크')} <span class="note">${esc(O.stat)} · 목표 ${O.target}${O.npc?' (대항 '+esc(O.npc)+')':''}${O.step?' · 단계 '+(O.step>0?'유리 ↑':'불리 ↓'):''}${O.twice?' · 두 번 굴려 '+(O.twice>0?'높은':'낮은')+' 값':''}</span></div>
    ${mine?resultHtml(mine,t,k):`
    <div class="sec">어떻게 굴릴까</div>
    <div class="firelist">
     ${mode!=='inou'?`<label class="firerow"><input type="radio" name="how" value="mon" checked> <b>포켓몬과 함께</b> <span class="small dim">동료 주사위 d6${stat==='통솔'?' (『유대』 d8)':''} · 쓴 포켓몬은 지친다</span></label>
      <div class="pg" id="monpick">${myMons.map(m=>{const tired=Object.values(K.trainers||{}).some(x=>(x.tired||[]).includes(m.id));const own=m.tid===tid;return `<div class="pc ${tired?'off':''}" data-mp="${m.id}" ${tired?'title="지침"':''}><div class="pic" style="${m.image?`background-image:url('${m.image}')`:''}"></div><div><b>${esc(m.name)}</b><div class="small dim">${own?'':esc((T[m.tid]||{}).name||'')+' · '}${tired?'지침':(stat==='통솔'&&hasBond(m)?'『유대』 d8':'d6')}${prideA(m)&&!hasBond(m)?' · 프라이드 A 고집':''}</div></div></div>`}).join('')||'<span class="small dim">포켓몬 없음</span>'}</div>
      <label class="firerow"><input type="radio" name="how" value="alone"> <b>혼자</b> <span class="small dim">동료 주사위 d4</span></label>`:''}
     ${aLv>=3&&mode!=='skill'&&stat==='능력'?`<label class="firerow ${inouLeft<=0||(k.inj>=2&&C.noinou2)?'done':''}"><input type="radio" name="how" value="inou" ${mode==='inou'?'checked':''} ${inouLeft<=0||(k.inj>=2&&C.noinou2)?'disabled':''}> <b>이능</b> <span class="small dim">2d${SIDES[Math.min(4,aLv)]} · 남은 ${inouLeft}회 · 실패하면 부상${k.inj>=2&&C.noinou2?' · 중상이라 불가':''}</span></label>
      ${aLv>=4&&!k.aa&&O.target<=C.aa&&inouLeft>0&&!(k.inj>=2&&C.noinou2)?`<label class="firerow"><input type="radio" name="how" value="aa"> <b>AA 특권</b> <span class="small dim">굴리지 않고 성공 (목표 ${C.aa} 이하 · 세션 1회 · 이능 1회 소모)</span></label>`:''}`:(mode==='inou'?'<div class="small dim">이능 판정은 능력 A 이상만 할 수 있다.</div>':'')}
    </div>
    <div class="row" style="margin-top:8px"><label class="small">보정 <input type="number" class="n xs" id="sk_bonus" value="0"></label><span class="sp"></span><button class="btn pri" id="sk_roll">굴리기</button></div>`}
   </div>`}
   ${O&&Object.keys(K.res||{}).some(id=>id!==tid&&(K.res[id]||{}).offerId===O.id)?`<div class="card"><div class="sec">다른 트레이너의 결과 <span class="note">받치면 결과가 한 칸 오르고 내가 부상을 입는다</span></div><div class="firelist">${Object.keys(K.res).filter(id=>id!==tid&&K.res[id].offerId===O.id).map(id=>{const r=K.res[id];const tt=T[id]||{};const canCover=!r.cover&&r.ri<3&&r.ri>=0&&!(k.inj>=2&&C.nocover2);return `<div class="firerow"><b>${esc(tt.name)}</b><span style="color:${COL[r.ri]}">${RES[r.ri]}</span>${r.cover?`<span class="tag">커버: ${esc((T[r.cover.by]||{}).name)}</span>`:''}<span class="sp"></span>${canCover?`<button class="btn xs" data-cover="${id}">내가 받칠게</button>`:''}</div>`}).join('')}</div></div>`:''}
   <div class="card"><div class="sec">돌봄 <span class="note">육성 B 이상 · 휴식 사이 1회 · 지친 포켓몬 1체 회복</span></div>${LAD[S().strip(rankOf(t,'육성'))]>=2&&!k.care?`<div class="row" style="flex-wrap:wrap;gap:4px">${Object.entries(K.trainers||{}).flatMap(([oid,x])=>(x.tired||[]).map(mid=>`<button class="btn xs" data-care="${mid}" data-owner="${oid}">${esc((mons()[mid]||{}).name||mid)}${oid!==tid?' ('+esc((T[oid]||{}).name)+')':''}</button>`)).join('')||'<span class="small dim">지친 포켓몬이 없다</span>'}</div>`:'<span class="small dim">쓸 수 없다</span>'}</div>`);
  const sel=md.querySelector('#monpick');let pickId=null;if(sel){sel.querySelectorAll('[data-mp]').forEach(el=>el.onclick=()=>{if(el.classList.contains('off'))return;pickId=el.dataset.mp;sel.querySelectorAll('[data-mp]').forEach(x=>x.classList.toggle('on',x===el));const r=md.querySelector('[name=how][value=mon]');if(r)r.checked=true})}
  const rb=$('#sk_roll',md);if(rb)rb.onclick=()=>roll(tid,O,md,pickId);
  md.querySelectorAll('[data-myosu]').forEach(b=>b.onclick=()=>myosu(tid,b.dataset.myosu));
  md.querySelectorAll('[data-cover]').forEach(b=>b.onclick=()=>cover(tid,b.dataset.cover));
  md.querySelectorAll('[data-care]').forEach(b=>b.onclick=()=>care(tid,b.dataset.owner,b.dataset.care))}
 function resultHtml(r,t,k){const O=st().offer;const canMyosu=O&&O.stat==='지시'&&(+k.myosu||0)<myosuMax(t)&&!r.myosu&&r.how!=='aa'&&r.ri>0;
  return `<div style="background:${COL[r.ri]};color:#fff;padding:10px 12px"><div class="pre" style="white-space:pre-wrap">${esc(r.text)}</div></div>${r.cover?`<div class="small" style="margin-top:4px">커버: ${esc((trs()[r.cover.by]||{}).name)} 이(가) 받쳐 ${RES[r.cover.from]} → ${RES[r.ri]}</div>`:''}
   ${canMyosu?`<div class="row" style="margin-top:6px"><span class="small dim">묘수 (${k.myosu}/${myosuMax(t)}): 주사위 하나를 다시 굴린다</span><span class="sp"></span><button class="btn sm" data-myosu="a">자질 주사위 다시</button>${r.how!=='alone'||true?`<button class="btn sm" data-myosu="c">${r.how==='inou'?'두 번째 주사위':'동료 주사위'} 다시</button>`:''}</div>`:''}`}
 /* 굴리기 */
 async function roll(tid,O,md,pickId){const T=trs();const t=T[tid];const k=tsk(tid);const C=cfg();const how=(md.querySelector('[name=how]:checked')||{}).value||'alone';const bonus=+($('#sk_bonus',md)||{}).value||0;
  if(how==='mon'&&!pickId)return A().toast('함께할 포켓몬을 골라 줘');
  const stat=O.stat;const inj=+k.inj||0;const aLv=LAD[S().strip(rankOf(t,'능력'))]||0;
  let target=O.target,npcTxt='';if(O.npcDice){const n1=d(O.npcDice[0]),n2=d(O.npcDice[1]);target=n1+n2;npcTxt=`${O.npc} → ${n1}+${n2} = ${target}`}
  const lines=[];let a={},c={},ri,total=0,fum=false,how2=how;
  if(how==='aa'){ri=3;total=target;lines.push(`AA 특권 — 굴리지 않고 성공 (이능 1회 소모)`);await setT(tid,{aa:1,inou:(+k.inou||0)+1})}
  else{
   const D=dieOf(t,stat,{inj,step:O.step||0});if(D.autofail){ri=1;lines.push(`자질 주사위가 d4 아래로 내려가 자동 실패`)}
   else{
    const twice=O.twice||0;const r1=d(D.sides),r2=twice?d(D.sides):null;const av=twice>0?Math.max(r1,r2):twice<0?Math.min(r1,r2):r1;a={sides:D.sides,r1,r2,v:av,plus:D.plus};
    if(how==='inou'){const Dc=dieOf(t,'능력',{inj:C.both1?inj:0,step:O.step||0});const cv=d(Dc.sides);c={sides:Dc.sides,v:cv,kind:'inou'};await setT(tid,{inou:(+k.inou||0)+1})}
    else if(how==='mon'){const m=mons()[pickId];const bond=stat==='통솔'&&hasBond(m);const cs=bond?8:6;const cv=d(cs);c={sides:cs,v:cv,kind:'mon',mid:pickId,name:m.name,bond,pride:prideA(m)&&!bond};
     const owner=m.tid;const ok=tsk(owner);if(!ok.tired.includes(pickId)){ok.tired.push(pickId);await setT(owner,{tired:ok.tired})}}
    else{c={sides:4,v:d(4),kind:'alone'}}
    total=av+(D.plus||0)+c.v+bonus;fum=av===1&&c.v===1;ri=judge(total,target,fum,how==='inou'?aLv:lv(rankOf(t,stat)));
    lines.push(`자질 d${D.sides}${D.plus?(D.plus>0?'+':'')+D.plus:''} → ${av}${twice?` (두 번 ${r1}, ${r2} 중 ${twice>0?'높은':'낮은'} 값)`:''}${D.injStep?` (${inj>=2?'중상':'부상'} −${D.injStep}단계)`:''}${O.step?` (상황 ${O.step>0?'↑':'↓'})`:''}`);
    lines.push(c.kind==='inou'?`이능 주사위 d${c.sides} → ${c.v}`:c.kind==='mon'?`동료 「${c.name}」 d${c.sides}${c.bond?' (유대)':''} → ${c.v}${c.pride&&c.v===1?' — 프라이드 A 고집! 대가 하나':''}`:`혼자 d4 → ${c.v}`);
    if(bonus)lines.push(`보정 ${bonus>0?'+':''}${bonus}`);if(fum)lines.push('두 주사위 모두 1 — '+(ri===0?'대실패':'A 이상이라 실패로'));}}
  const text=`스킬 체크 · ${t.name} · ${stat}(${rankOf(t,stat)||'-'})${O.label?' · '+O.label:''}${how==='inou'?' · 이능':''}\n${lines.join('\n')}\n합계 ${total} / 목표 ${target}${npcTxt?' ('+npcTxt+')':''}\n→ ${RES[ri]}${c.pride&&c.v===1?' (+ 고집의 대가)':''}`;
  const res={offerId:O.id,tid,how:how2,stat,target,a,c,bonus,ri,total,text,at:Date.now()};
  /* 이능 실패 → 부상 */
  if(how==='inou'&&ri<=1){const mid=await pickMon(tid,'이능 실패 — 부상');const r=await injure(tid,mid);res.inj={prev:inj,mid};res.text+='\n'+r.line}
  await A().set(['skill','res',tid],res);const hist=(st().hist||[]).slice(-40);hist.push({ri,text:res.text,at:res.at});await A().set(['skill','hist'],hist);
  A().closeModal();A().sysLog(res.text,'dice');try{if(window.OM_CUTIN)window.OM_CUTIN.phase(RES[ri],`${t.name} · ${stat} ${total}/${target}`)}catch(e){}
  setTimeout(()=>openPlayer(tid),300)}
 /* 묘수: 주사위 하나 다시 */
 async function myosu(tid,which){const T=trs();const t=T[tid];const k=tsk(tid);const r=JSON.parse(JSON.stringify((st().res||{})[tid]));if(!r||r.myosu)return;
  if(which==='a'){const nv=d(r.a.sides);r.text+=`\n묘수: 자질 주사위 다시 ${r.a.v} → ${nv}`;r.a.v=nv}else{const nv=d(r.c.sides);r.text+=`\n묘수: ${r.c.kind==='inou'?'이능':'동료'} 주사위 다시 ${r.c.v} → ${nv}`;r.c.v=nv}
  r.total=(r.a.v||0)+(r.a.plus||0)+(r.c.v||0)+(r.bonus||0);const fum=r.a.v===1&&r.c.v===1;r.ri=judge(r.total,r.target,fum,r.how==='inou'?LAD[S().strip(rankOf(t,'능력'))]:lv(rankOf(t,r.stat)));r.text+=`\n합계 ${r.total} / 목표 ${r.target} → ${RES[r.ri]}`;r.myosu=1;
  await setT(tid,{myosu:(+k.myosu||0)+1});await A().set(['skill','res',tid],r);A().closeModal();A().sysLog(`${t.name} 묘수! ${which==='a'?'자질':'동료'} 주사위 다시 → 합계 ${r.total} / ${r.target} → ${RES[r.ri]}`,'dice');setTimeout(()=>openPlayer(tid),200)}
 /* 커버 */
 async function cover(byTid,forTid){const T=trs();const k=tsk(byTid);const C=cfg();if(k.inj>=2&&C.nocover2)return A().toast('중상이라 받칠 수 없다');const r=JSON.parse(JSON.stringify((st().res||{})[forTid]));if(!r||r.cover||r.ri>=3)return;
  if(!confirm(`${T[forTid].name}의 「${RES[r.ri]}」을(를) 한 칸 올리고 내가 부상을 입을까?`))return;
  const from=r.ri;r.ri=Math.min(3,r.ri+1);r.cover={by:byTid,from};r.text+=`\n커버: ${T[byTid].name} 이(가) 받침 → ${RES[r.ri]}`;
  /* 이능 실패를 받치면 반동이 사라진다: 원래 부상을 되돌린다 */
  if(r.inj){const ok=tsk(forTid);await setT(forTid,{inj:r.inj.prev});r.text+=`\n${T[forTid].name}의 반동(부상)은 없던 일로`;delete r.inj}
  const mid=await pickMon(byTid,'커버 — 부상');const inj=await injure(byTid,mid);r.text+='\n'+inj.line;
  await A().set(['skill','res',forTid],r);A().closeModal();A().sysLog(`${T[byTid].name} 커버! ${T[forTid].name}: ${RES[from]} → ${RES[r.ri]} · ${inj.line}`,'dice');setTimeout(()=>openPlayer(byTid),200)}
 /* 돌봄 */
 async function care(tid,ownerTid,mid){const k=tsk(tid);if(k.care)return;const ok=tsk(ownerTid);ok.tired=ok.tired.filter(x=>x!==mid);await setT(ownerTid,{tired:ok.tired});await setT(tid,{care:1});A().closeModal();A().sysLog(`${trs()[tid].name} 돌봄 — 「${(mons()[mid]||{}).name}」 지침 회복`,'dice');setTimeout(()=>openPlayer(tid),200)}
 /* 상단 버튼에 제시 표시 */
 function pending(){const O=st().offer;if(!O)return false;const tid=me();if(gm())return true;if(!tid||!(O.ids||[]).includes(tid))return false;const r=(st().res||{})[tid];return !(r&&r.offerId===O.id)}
 return {open,openGm,openPlayer,pending};
})();
