/* ---------- 배틀 씬 UI (1단계: 엔트리 · 지시 입력 · 준비 · 공개 · 행동 순서 · 공격/대미지 · 랭크/상태 · 필드 · 턴 종료) ----------
   상태 모양:
   battle = { turn, phase, mode(에리어 수 1~3), sides:{left:{trainers}, right:{trainers}}, trainers:{tid:{…,side}},
              mons:{mid:{…, side, slot, entry:'a'|'b'|'c'|'', started, hp, rank, mod, states, item}},
              field:{weather:{type,count}, terrain:{type,count}, rooms:{트릭룸..}, etc:{중력..}, objects:{left:{리플렉터:n}, right:{}}},
              cmds:{tid:{mons:{mid:{…}}, order, command, detail}}  (공개된 지시), order:[{slot,mid,name}] }
   ready = {tid:true}   비밀 지시 = om_secret(kind 'cmd', id = tid) */
"use strict";
window.OM_BATTLE_UI=(()=>{
 const A=()=>window.OM_APP, S=()=>window.OM_STATS, B=()=>window.OM_BATTLE, DB=()=>window.OM_DB||{}, DBS=()=>window.OM_STORE;
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const $=(s,r)=>(r||document).querySelector(s);
 const AREAS=['a','b','c'];const SIDES=['left','right'];
 const SIDE_KO={left:'좌측',right:'우측'};
 const STAT_KO={attack:'공격',defense:'방어',specialattack:'특공',specialdefense:'특방',speed:'스피드',accuracy:'명중',evasion:'회피',critical:'급소'};
 const ORDER_KEYS=['retreat','dodge','endure','return','snipe'];const COMMAND_KEYS=['attack','defense','specialattack','specialdefense','speed','heal','snipe','evasion'];
 const WEATHER=['','맑음','비','모래바람','싸라기눈','눈','짙은안개','밤','별하늘','큰가뭄','폭우','난기류','극한','깊은밤'];
 const WEATHER_MUL={맑음:{Fire:1.5,Water:0.5},큰가뭄:{Fire:1.5,Water:0},비:{Water:1.5,Fire:0.5},폭우:{Water:1.5,Fire:0},밤:{Ghost:1.5,Dark:1.5},깊은밤:{Ghost:1.5,Dark:1.5},별하늘:{Normal:1.5,Dragon:1.5},짙은안개:{Poison:1.5,Fairy:1.5}};
 const TERRAIN=['','그래스필드','일렉트릭필드','미스트필드','사이코필드'];
 const ROOMS=['트릭룸','매직룸','원더룸','블랙룸'];const ETC=['중력','물놀이','흙놀이'];
 const OBJECTS=()=>String(((DB().const||{}).lists||{}).list_object_kor||'').split(',').map(x=>x.trim()).filter(Boolean);
 const WALLS={리플렉터:'reflector',빛의장막:'lightscreen',얼음의장벽:'icewall',오로라베일:'aurora'};
 const slotOf=(side,area)=>side+'_'+area;
 const lists=()=>((DB().const||{}).lists||{});
 const csv=s=>String(s||'').split(',').map(x=>x.trim()).filter(Boolean);

 /* ---------- 상태 읽기 도우미 ---------- */
 function ctx(){const ST=A().ST;const b=ST.state.battle||{};return {ST,b,role:ST.role,seat:ST.seat,gm:ST.role==='gm'}}
 function mode(b){return Math.max(1,Math.min(3,+b.mode||1))}
 function entered(b,side){const out={};for(const a of AREAS.slice(0,mode(b))){const m=Object.values(b.mons||{}).find(x=>x.side===side&&x.entry===a&&x.hp.cur>0);out[a]=m||null}return out}
 function allEntered(b){const out=[];for(const s of SIDES){const e=entered(b,s);for(const a in e)if(e[a])out.push({slot:slotOf(s,a),side:s,area:a,mon:e[a]})}return out}
 function myTrainers(c){const trs=c.b.trainers||{};if(c.gm)return Object.keys(trs);return c.seat&&trs[c.seat]?[c.seat]:[]}
 function canEdit(c,mon){return c.gm||(mon&&mon.tid===c.seat)}
 function fieldOf(b){return Object.assign({weather:{type:'',count:0},terrain:{type:'',count:0},rooms:{},etc:{},objects:{left:{},right:{}}},b.field||{})}
 function typeChip(en){return A().typeChip(en)}
 function monName(b,mid){const m=(b.mons||{})[mid];return m?m.name:'?'}

 /* ---------- 렌더 ---------- */
 function render(el){
  const c=ctx();const b=c.b;const f=fieldOf(b);const ready=c.ST.state.ready||{};
  const phases=[[0,'지시 준비'],[1,'턴 개시·공개'],[2,'행동 순서'],[3,'행동 처리'],[5,'턴 종료']];
  const chips=[f.weather.type?`날씨 ${f.weather.type}${f.weather.count?' '+f.weather.count+'T':''}`:'',f.terrain.type?`${f.terrain.type}${f.terrain.count?' '+f.terrain.count+'T':''}`:'',...ROOMS.filter(r=>(f.rooms||{})[r]>0).map(r=>`${r} ${f.rooms[r]}T`),...ETC.filter(r=>(f.etc||{})[r]>0).map(r=>`${r} ${f.etc[r]}T`)].filter(Boolean);
  el.innerHTML=`
  <div class="bstat">
   <div class="turn"><span class="tlab">TURN</span><span class="tnum">${b.turn||0}</span></div>
   <div class="phases">${phases.map(([p,n])=>`<button class="ph ${(+b.phase||0)===p?'on':''}" data-phase="${p}" ${c.gm?'':'disabled'}>${n}</button>`).join('')}</div>
   <span class="sp"></span>
   <div class="fchips">${chips.map(x=>`<span class="chip">${esc(x)}</span>`).join('')||'<span class="chip dim">날씨·필드 없음</span>'}${c.gm?'<button class="btn sm" data-act="field">필드</button>':''}</div>
   ${c.gm?`<div class="gmrow"><label>에리어 <select data-act="mode">${[1,2,3].map(n=>`<option value="${n}" ${mode(b)===n?'selected':''}>${n}</option>`).join('')}</select></label>
    <button class="btn sm" data-act="reveal">지시 공개</button><button class="btn sm" data-act="order">행동 순서</button><button class="btn sm" data-act="turnend">턴 종료 처리</button>
    <button class="btn sm ghost" data-act="resetcmd">지시 초기화</button><button class="btn sm ghost danger" data-act="clear">배틀 비우기</button></div>`:''}
  </div>
  <div class="arena">${SIDES.map(side=>sideBox(c,side,ready)).join('')}</div>
  ${orderBox(c)}
  ${cmdPanel(c,ready)}`;
  el.querySelectorAll('[data-phase]').forEach(bt=>bt.onclick=()=>setPhase(+bt.dataset.phase));
  el.querySelectorAll('[data-act]').forEach(bt=>{if(bt.tagName==='SELECT')bt.onchange=()=>action(bt.dataset,bt.value);else bt.onclick=()=>action(bt.dataset)});
  el.querySelectorAll('[data-mon]').forEach(cd=>cd.onclick=e=>{if(e.target.closest('[data-act]'))return;A().openMon(cd.dataset.mon)});
  const form=$('#cmdForm',el);if(form)bindCmdForm(form,c)}

 function sideBox(c,side,ready){
  const b=c.b;const ids=((b.sides||{})[side]||{}).trainers||[];const trs=b.trainers||{};const seats=c.ST.state.seats||{};
  const ent=entered(b,side);
  const areas=AREAS.slice(0,mode(b)).map(a=>{const m=ent[a];const slot=slotOf(side,a);
   return `<div class="area ${m?'':'empty'}" data-slot="${slot}"><div class="alab">${a.toUpperCase()}</div>${m?bigCard(c,m,slot):`<div class="aempty">빈 자리${c.gm||ids.includes(c.seat)?'<br><span class="small">벤치에서 「등장」</span>':''}</div>`}</div>`}).join('');
  const bench=ids.map(tid=>{const t=trs[tid]||{name:'?',ranks:{}};const o=seats[tid];const mons=Object.values(b.mons||{}).filter(m=>m.tid===tid).sort((x,y)=>(x.slot||0)-(y.slot||0));
   const cmdDone=!!(b.cmds||{})[tid];const rd=!!ready[tid];
   return `<div class="trainer"><div class="tpic" style="${t.image?`background-image:url('${t.image}')`:''}"></div><div class="tinfo"><div class="tn">${esc(t.name)}${tid===c.seat?' <span class="tag me">ME</span>':''}${rd?' <span class="tag ok">READY</span>':cmdDone?' <span class="tag">공개됨</span>':''}</div>
     <div class="tr">${['육성','지시','통솔','능력'].map(k=>`${k} <b>${esc(t.ranks[k]||'-')}</b>`).join(' · ')} · ${o?`<span class="who">${esc(o.name)}</span>`:'<span class="dim">빈 자리</span>'}</div></div>
     ${c.gm?`<button class="btn xs ghost" data-act="iv" data-tid="${tid}">알까기</button><button class="btn xs ghost" data-act="orders" data-tid="${tid}">지령</button><button class="btn xs ghost danger" data-act="unload" data-tid="${tid}">빼기</button>`:''}</div>
    <div class="bench">${mons.map(m=>benchCard(c,m)).join('')||'<div class="dim small">포켓몬 없음</div>'}</div>`}).join('');
  return `<div class="sideBox ${side}"><div class="shead"><span class="sname">${SIDE_KO[side]}</span><span class="sp"></span>${c.gm?`<button class="btn xs" data-act="load" data-side="${side}">+ 파티</button>`:''}</div>
   <div class="areas">${areas}</div>${bench||'<div class="aempty">트레이너 없음</div>'}</div>`}

 function hpBar(m,full){const hp=m.hp||{max:1,cur:1};const pct=Math.max(0,Math.min(100,Math.round(hp.cur/hp.max*100)));const cls=pct<=25?'low':pct<=50?'mid':'';
  return `<div class="hpbar ${cls}"><i style="width:${pct}%"></i></div><div class="hpnum">${full?`${hp.cur} <span class="dim">/ ${hp.max}</span>`:pct+'%'}</div>`}
 function rankChips(m){const r=m.rank||{};const out=[];for(const k of ['attack','defense','specialattack','specialdefense','speed','accuracy','evasion','critical']){const v=+r[k]||0;if(v)out.push(`<span class="rk ${v>0?'up':'dn'}">${STAT_KO[k]}${v>0?'+':''}${v}</span>`)}
  const md=m.mod||{};for(const k in md){const v=+md[k];if(v&&v!==1)out.push(`<span class="rk ${v>1?'up':'dn'}">${STAT_KO[k]||k}×${v}</span>`)}return out.join('')}
 function stateChips(m){const st=m.states||{};const db=(DB().states||{}).st||{};return Object.keys(st).filter(k=>st[k]).map(k=>`<span class="stc ${db[k]&&db[k].abn?'abn':''}">${esc(db[k]?db[k].ko:k)}${+st[k]>1&&+st[k]<1000?' '+st[k]:''}</span>`).join('')}
 function bigCard(c,m,slot){const full=canEdit(c,m);const cmd=cmdOf(c.b,m);
  return `<div class="mon big ${m.hp.cur<=0?'fainted':''}" data-mon="${m.id}"><div class="pic" style="${m.image?`background-image:url('${m.image}')`:''}"></div>
   <div class="minfo"><div class="nm">${esc(m.name)}<span class="lv">Lv.${m.lv}</span></div><div class="ty">${m.types.filter(t=>t!=='-').map(typeChip).join('')}${m.teraActive?`<span class="rk up">테라 ${esc(m.tera)}</span>`:''}</div>
   ${hpBar(m,full)}<div class="rks">${rankChips(m)}${stateChips(m)}</div>
   ${cmd?`<div class="cmdcard">${cmd}</div>`:''}
   <div class="mbtns">${full?`<button class="btn xs" data-act="attack" data-mid="${m.id}">공격</button><button class="btn xs" data-act="edit" data-mid="${m.id}">랭크·상태</button><button class="btn xs ghost" data-act="exit" data-mid="${m.id}">퇴장</button>`:''}</div></div></div>`}
 function benchCard(c,m){const full=canEdit(c,m);const out=!!m.entry;
  return `<div class="mon small ${m.hp.cur<=0?'fainted':''} ${out?'onfield':''}" data-mon="${m.id}"><div class="pic" style="${m.image?`background-image:url('${m.image}')`:''}"></div>
   <div class="nm">${esc(m.name)}</div><div class="ty">${m.types.filter(t=>t!=='-').map(typeChip).join('')}</div>${hpBar(m,full)}
   ${out?`<div class="dim small">에리어 ${m.entry.toUpperCase()}</div>`:full&&m.hp.cur>0?`<button class="btn xs" data-act="enter" data-mid="${m.id}">등장</button>`:''}</div>`}

 function cmdOf(b,m){const cm=(b.cmds||{})[m.tid];if(!cm||!cm.mons||!cm.mons[m.id])return '';const x=cm.mons[m.id];
  const parts=[];if(x.move==='switch')parts.push(`<b>교대</b> → ${esc(monName(b,x.switch))}`);else if(x.move!=null&&x.move!==''){const mv=(m.moves||[])[+x.move];parts.push(`<b>${esc(mv?mv.name:'?')}</b>${mv?' '+typeChip(mv.typeEn):''}`);if(x.targets&&x.targets.length)parts.push('→ '+x.targets.map(s=>slotName(b,s)).join(', '))}
  if(x.prio&&Object.values(x.prio).some(v=>v!==''&&+v!==0))parts.push('우선도 '+Object.entries(x.prio).filter(([k,v])=>v!==''&&+v!==0).map(([k,v])=>slotName(b,k)+' '+v).join(', '));
  if(x.ochg&&Object.values(x.ochg).some(v=>v!==''&&+v!==20))parts.push('순서 '+Object.entries(x.ochg).filter(([k,v])=>v!==''&&+v!==20).map(([k,v])=>slotName(b,k)+' '+v).join(', '));
  if(cm.order&&cm.order.type&&cm.order.target===m.id)parts.push(`<span class="rk up">${esc(orderName(b,m.tid,'order',cm.order.type))}</span>`);
  if(cm.command&&cm.command.type&&cm.command.target===m.id)parts.push(`<span class="rk up">${esc(orderName(b,m.tid,'command',cm.command.type))}</span>`);
  if(cm.detail)parts.push(`<span class="dim">${esc(cm.detail)}</span>`);
  return parts.join(' ')}
 function slotName(b,slot){const [side,area]=String(slot).split('_');const m=entered(b,side)[area];return `${SIDE_KO[side]||side}${(area||'').toUpperCase()}${m?'('+esc(m.name)+')':''}`}
 function orderName(b,tid,kind,key){const t=(b.trainers||{})[tid]||{};const style=+(t.orderStyle||0);
  if(kind==='order'){const names=csv(lists()['list_order_'+style]);const i=ORDER_KEYS.indexOf(key);return names[i]||key}
  const names=csv(lists()['list_command_'+style]);const i=COMMAND_KEYS.indexOf(key);return names[i]||key}

 function orderBox(c){const b=c.b;if(!b.order||!b.order.length)return '';
  return `<div class="orderbox"><div class="olab">행동 순서</div>${b.order.map((o,i)=>`<span class="ord ${o.side}"><b>${i+1}</b> ${esc(o.name)} <span class="dim small">${o.change?'교대':''}${o.order!==20?' 순서'+o.order:''}${o.prio?' 우선'+o.prio:''} ${Math.round(o.speed)}</span></span>`).join('')}</div>`}

 /* ---------- 지시 입력 패널 ---------- */
 let CMD={};  /* 편집 중인 내 지시 {tid:{mons:{},order:{},command:{},detail}} */
 function cmdPanel(c,ready){
  const b=c.b;const tids=myTrainers(c);if(!tids.length)return '';
  const phase=+b.phase||0;
  const blocks=tids.map(tid=>{const t=(b.trainers||{})[tid]||{};const mons=Object.values(b.mons||{}).filter(m=>m.tid===tid&&m.entry&&m.hp.cur>0);if(!mons.length)return '';
   const cur=CMD[tid]||(CMD[tid]={mons:{},order:{},command:{},detail:''});
   const slots=allEntered(b);const bench=Object.values(b.mons||{}).filter(m=>m.tid===tid&&!m.entry&&m.hp.cur>0);
   const style=+(t.orderStyle||0);const oNames=csv(lists()['list_order_'+style]);const cNames=csv(lists()['list_command_'+style]);const cnt=t.orderCount||{};
   return `<div class="cmdt" data-tid="${tid}"><div class="cmdhead"><b>${esc(t.name)}</b> 지시 ${ready[tid]?'<span class="tag ok">READY</span>':''}<span class="sp"></span>
     <button class="btn xs ghost" data-act="cmdload" data-tid="${tid}">저장된 지시 불러오기</button></div>
    ${mons.map(m=>{const x=cur.mons[m.id]||(cur.mons[m.id]={move:'',switch:'',targets:[],prio:{},ochg:{}});const mv=x.move!==''&&x.move!=='switch'?(m.moves||[])[+x.move]:null;
     return `<div class="cmdmon"><div class="cmdname">${esc(m.name)} <span class="dim small">에리어 ${m.entry.toUpperCase()}</span></div>
      <label>행동 <select data-f="move" data-mid="${m.id}"><option value="">-</option>${(m.moves||[]).map((mv,i)=>`<option value="${i}" ${String(x.move)===String(i)?'selected':''}>${esc(mv.name)} (${esc(mv.type)} ${mv.pow||'-'}/${mv.acc||'필중'})</option>`).join('')}<option value="switch" ${x.move==='switch'?'selected':''}>교대</option></select></label>
      ${x.move==='switch'?`<label>교대 상대 <select data-f="switch" data-mid="${m.id}"><option value="">-</option>${bench.map(bm=>`<option value="${bm.id}" ${x.switch===bm.id?'selected':''}>${esc(bm.name)}</option>`).join('')}</select></label>`:''}
      ${mv?`<div class="tgts">대상 ${slots.map(s=>`<label class="tg ${s.side}"><input type="checkbox" data-f="target" data-mid="${m.id}" value="${s.slot}" ${x.targets.includes(s.slot)?'checked':''}>${s.area.toUpperCase()} ${esc(s.mon.name)}</label>`).join('')}<span class="dim small">범위 ${esc(mv.range)}</span></div>`:''}
      <details class="adv"><summary>우선도·행동 순서 변경</summary><div class="tgts">${slots.map(s=>`<label class="tg">${s.area.toUpperCase()} ${esc(s.mon.name)} 우선 <input type="number" class="n" data-f="prio" data-mid="${m.id}" data-slot="${s.slot}" value="${x.prio[s.slot]??''}" placeholder="0"> 순서 <input type="number" class="n" data-f="ochg" data-mid="${m.id}" data-slot="${s.slot}" value="${x.ochg[s.slot]??''}" placeholder="20"></label>`).join('')}</div></details></div>`}).join('')}
    <div class="cmdrow"><label>지령 <select data-f="order"><option value="">-</option>${ORDER_KEYS.map((k,i)=>oNames[i]?`<option value="${k}" ${cur.order.type===k?'selected':''}>${esc(oNames[i])} (${cnt['order_'+k]??1})</option>`:'').join('')}</select></label>
     <label>대상 <select data-f="orderTarget"><option value="">-</option>${mons.map(m=>`<option value="${m.id}" ${cur.order.target===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}</select></label>
     <label>명령 <select data-f="command"><option value="">-</option>${COMMAND_KEYS.map((k,i)=>cNames[i]?`<option value="${k}" ${cur.command.type===k?'selected':''}>${esc(cNames[i])} (${cnt['command_'+k]??1})</option>`:'').join('')}</select></label>
     <label>대상 <select data-f="commandTarget"><option value="">-</option>${mons.map(m=>`<option value="${m.id}" ${cur.command.target===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}</select></label></div>
    <div class="cmdrow"><input type="text" data-f="detail" value="${esc(cur.detail)}" placeholder="상세 (포텐셜 선언, 자유 메모)" style="flex:1">
     <button class="btn" data-act="cmdsave" data-tid="${tid}">저장</button><button class="btn pri" data-act="ready" data-tid="${tid}">${ready[tid]?'준비 해제':'준비 완료'}</button></div></div>`}).join('');
  if(!blocks.trim())return '';
  return `<form id="cmdForm" class="cmdpanel" onsubmit="return false"><div class="cmdtitle">지시 입력 <span class="dim small">${phase===0?'지시 준비 페이즈':'지금은 '+['','턴 개시','행동 순서','행동 처리','','턴 종료'][phase]+' — 입력은 저장만 된다'}</span></div>${blocks}</form>`}
 function rerenderCmd(){const old=$('#cmdForm');if(!old)return;const c=ctx();const tmp=document.createElement('div');tmp.innerHTML=cmdPanel(c,c.ST.state.ready||{});const nf=tmp.firstElementChild;if(!nf){old.remove();return}old.replaceWith(nf);nf.querySelectorAll('[data-act]').forEach(bt=>bt.onclick=()=>action(bt.dataset));bindCmdForm(nf,c)}
 function bindCmdForm(form,c){
  form.querySelectorAll('[data-f]').forEach(el=>{const tid=el.closest('.cmdt').dataset.tid;const cur=CMD[tid];
   const h=()=>{const f=el.dataset.f,mid=el.dataset.mid;
    if(f==='move'){cur.mons[mid].move=el.value;cur.mons[mid].targets=defaultTargets(c.b,mid,el.value);rerenderCmd();return}
    if(f==='switch')cur.mons[mid].switch=el.value;
    if(f==='target'){const t=cur.mons[mid].targets;const i=t.indexOf(el.value);if(el.checked&&i<0)t.push(el.value);if(!el.checked&&i>=0)t.splice(i,1)}
    if(f==='prio')cur.mons[mid].prio[el.dataset.slot]=el.value;
    if(f==='ochg')cur.mons[mid].ochg[el.dataset.slot]=el.value;
    if(f==='order')cur.order.type=el.value;if(f==='orderTarget')cur.order.target=el.value;
    if(f==='command')cur.command.type=el.value;if(f==='commandTarget')cur.command.target=el.value;
    if(f==='detail')cur.detail=el.value};
   el.addEventListener('change',h);if(el.type==='text'||el.type==='number')el.addEventListener('input',h)})}
 function defaultTargets(b,mid,moveIdx){const m=b.mons[mid];if(!m||moveIdx===''||moveIdx==='switch')return [];const mv=(m.moves||[])[+moveIdx];if(!mv)return [];
  const slots=allEntered(b);const my=slots.find(s=>s.mon.id===mid);const r=String(mv.range||'');
  const enemies=slots.filter(s=>s.side!==m.side),allies=slots.filter(s=>s.side===m.side&&s.mon.id!==mid);
  if(r==='자신')return my?[my.slot]:[];if(r==='상대 전체'||r==='적진')return enemies.map(s=>s.slot);if(r==='아군 전체'||r==='자진')return slots.filter(s=>s.side===m.side).map(s=>s.slot);
  if(r==='자신 이외')return slots.filter(s=>s.mon.id!==mid).map(s=>s.slot);if(r==='전체'||r==='필드 전체')return slots.map(s=>s.slot);
  if(r==='아군')return allies.map(s=>s.slot).slice(0,1);
  if(r==='상대 2체')return enemies.map(s=>s.slot).slice(0,2);
  return enemies.map(s=>s.slot).slice(0,1)}

 /* ---------- 동작 ---------- */
 async function setPhase(p){const c=ctx();if(!c.gm)return;await A().set(['battle','phase'],p);A().sysLog(`페이즈: ${['지시 준비','턴 개시·공개','행동 순서','행동 처리','','턴 종료'][p]}`,'battle')}
 async function action(d,val){
  const c=ctx();const b=c.b;
  switch(d.act){
   case 'load':return A().openLoadParty(d.side);
   case 'unload':return A().unloadTrainer(d.tid);
   case 'clear':if(!confirm('배틀 상태를 전부 비울까? (좌석은 남는다)'))return;CMD={};return A().set(['battle'],{turn:0,phase:0,mode:mode(b),sides:{left:{trainers:[]},right:{trainers:[]}},trainers:{},mons:{},field:{},cmds:{},order:[]});
   case 'iv':return A().openHatch(d.tid);
   case 'mode':return A().set(['battle','mode'],+val);
   case 'field':return openField();
   case 'orders':return openOrders(d.tid);
   case 'enter':return enterMon(d.mid);
   case 'exit':return exitMon(d.mid);
   case 'edit':return openEdit(d.mid);
   case 'attack':return openAttack(d.mid);
   case 'cmdsave':return saveCmd(d.tid,false);
   case 'ready':return toggleReady(d.tid);
   case 'cmdload':return loadCmd(d.tid);
   case 'reveal':return reveal();
   case 'order':return computeOrder();
   case 'turnend':return turnEnd();
   case 'resetcmd':if(!confirm('공개된 지시와 준비 상태를 지울까?'))return;CMD={};await A().set(['battle','cmds'],{});await A().set(['ready'],{});return}}

 async function enterMon(mid){const c=ctx();const b=c.b;const m=b.mons[mid];if(!m||!canEdit(c,m))return;
  const ent=entered(b,m.side);const free=AREAS.slice(0,mode(b)).filter(a=>!ent[a]);
  let area=free[0];
  if(mode(b)>1){const pick=prompt(`에리어를 골라 줘 (${AREAS.slice(0,mode(b)).map(a=>a.toUpperCase()).join('/')})${free.length?' · 빈 자리: '+free.map(a=>a.toUpperCase()).join(','):''}`,(area||'a').toUpperCase());if(pick==null)return;area=pick.trim().toLowerCase()}
  if(!AREAS.slice(0,mode(b)).includes(area))return A().toast('그런 에리어가 없다');
  const occ=ent[area];
  if(occ&&occ.id!==mid){await A().set(['battle','mons',occ.id,'entry'],'')}
  const started=(+b.phase||0)!==0;
  await A().set(['battle','mons',mid,'entry'],area);await A().set(['battle','mons',mid,'started'],started);
  A().sysLog(`${m.name} 등장 (${SIDE_KO[m.side]} ${area.toUpperCase()})${occ&&occ.id!==mid?' ← '+occ.name+' 퇴장':''}`,'battle')}
 async function exitMon(mid){const c=ctx();const m=c.b.mons[mid];if(!m||!canEdit(c,m))return;await A().set(['battle','mons',mid,'entry'],'');A().sysLog(`${m.name} 퇴장`,'battle')}

 /* ----- 지시 저장 · 준비 · 공개 ----- */
 function cleanCmd(cur){const out={mons:{},order:cur.order||{},command:cur.command||{},detail:cur.detail||''};for(const k in cur.mons){const x=cur.mons[k];out.mons[k]={move:x.move,switch:x.switch,targets:x.targets||[],prio:x.prio||{},ochg:x.ochg||{}}}return out}
 async function saveCmd(tid,quiet){const c=ctx();const cur=CMD[tid];if(!cur)return;
  try{await DBS().secretPut(c.ST.room,c.ST.secret,'cmd',tid,cleanCmd(cur));if(!quiet)A().toast('지시를 저장했다 (공개 전까지 GM만 본다)');return true}catch(e){A().toast('저장 실패: '+e.message);return false}}
 async function loadCmd(tid){const c=ctx();try{const rows=await DBS().secretGet(c.ST.room,c.ST.secret,'cmd');const r=(rows||[]).find(x=>x.id===tid);if(!r)return A().toast('저장된 지시가 없다');CMD[tid]=Object.assign({mons:{},order:{},command:{},detail:''},r.data);A().renderScene();A().toast('불러왔다')}catch(e){A().toast(e.message)}}
 async function toggleReady(tid){const c=ctx();const rd=!!(c.ST.state.ready||{})[tid];
  if(!rd){const ok=await saveCmd(tid,true);if(!ok)return}
  const path=c.gm?['ready',tid]:['ready',c.seat];
  await A().set(path,rd?null:true);A().sysLog(`${((c.b.trainers||{})[tid]||{}).name||tid} ${rd?'준비 해제':'준비 완료'}`,'battle')}
 async function reveal(){const c=ctx();if(!c.gm)return;const b=c.b;
  let rows;try{rows=await DBS().secretGet(c.ST.room,c.ST.secret,'cmd')}catch(e){return A().toast('지시를 읽지 못했다: '+e.message)}
  const cmds={};(rows||[]).forEach(r=>{if((b.trainers||{})[r.id])cmds[r.id]=r.data});
  if(!Object.keys(cmds).length)return A().toast('저장된 지시가 없다');
  /* 지령·명령 횟수 차감 */
  const trs=JSON.parse(JSON.stringify(b.trainers||{}));
  for(const tid in cmds){const t=trs[tid];if(!t)continue;t.orderCount=t.orderCount||{};const cm=cmds[tid];
   if(cm.order&&cm.order.type){const k='order_'+cm.order.type;t.orderCount[k]=(t.orderCount[k]??1)-1}
   if(cm.command&&cm.command.type){const k='command_'+cm.command.type;t.orderCount[k]=(t.orderCount[k]??1)-1}}
  await A().set(['battle','trainers'],trs);await A().set(['battle','cmds'],cmds);await A().set(['ready'],{});await A().set(['battle','phase'],1);
  /* 로그 카드 */
  const lines=[];for(const tid in cmds){const t=trs[tid];const cm=cmds[tid];
   for(const mid in cm.mons){const m=b.mons[mid];if(!m||!m.entry)continue;const x=cm.mons[mid];let s='';
    if(x.move==='switch')s=`교대 → ${monName(b,x.switch)}`;else if(x.move!==''&&x.move!=null){const mv=(m.moves||[])[+x.move];s=(mv?mv.name:'?')+(x.targets&&x.targets.length?' → '+x.targets.map(sl=>slotName(b,sl).replace(/<[^>]+>/g,'')).join(', '):'')}else s='(행동 없음)';
    lines.push(`${t.name} · ${m.name}: ${s}`)}
   if(cm.order&&cm.order.type)lines.push(`${t.name} 지령 「${orderName(b,tid,'order',cm.order.type)}」 → ${monName(b,cm.order.target)}`);
   if(cm.command&&cm.command.type)lines.push(`${t.name} 명령 「${orderName(b,tid,'command',cm.command.type)}」 → ${monName(b,cm.command.target)}`);
   if(cm.detail)lines.push(`${t.name}: ${cm.detail}`)}
  A().sysLog('지시 공개\n'+lines.join('\n'),'battle')}

 /* ----- 행동 순서 ----- */
 async function computeOrder(){const c=ctx();if(!c.gm)return;const b=c.b;const f=fieldOf(b);
  const slots=allEntered(b);if(!slots.length)return A().toast('등장한 포켓몬이 없다');
  const entries=slots.map(s=>{const cm=((b.cmds||{})[s.mon.tid]||{}).mons||{};const x=cm[s.mon.id]||{};
   const prioMap={},orderMap={};for(const k in (x.prio||{}))if(x.prio[k]!=='')prioMap[k]=+x.prio[k];for(const k in (x.ochg||{}))if(x.ochg[k]!=='')orderMap[k]=+x.ochg[k];
   let prioMod=0;if(x.move!==''&&x.move!=='switch'&&x.move!=null){const mv=(s.mon.moves||[])[+x.move];if(mv)prioMod+=+mv.prio||0}
   const objs=(f.objects||{})[s.side]||{};
   return {slot:s.slot,mon:s.mon,cmd:{change:x.move==='switch',priorityMap:prioMap,orderMap},prioMod,started:!!s.mon.started,scarf:s.mon.item==='구애스카프',tailwind:(objs['순풍']||0)>0,swamp:(objs['습원']||0)>0}});
  const rows=B().turnOrder(entries,{trick:((f.rooms||{})['트릭룸']||0)>0});
  const order=rows.map(r=>({slot:r.slot,mid:r.mon.id,name:r.mon.name,side:r.mon.side,change:r.change,order:r.order,prio:r.prio,speed:r.speed,dice:r.dice}));
  await A().set(['battle','order'],order);await A().set(['battle','phase'],2);
  A().sysLog('행동 순서\n'+order.map((o,i)=>`${i+1}. ${o.name} (${o.change?'교대 · ':''}${o.order!==20?'순서 '+o.order+' · ':''}${o.prio?'우선 '+o.prio+' · ':''}스피드 ${Math.round(o.speed)} · d${o.dice})`).join('\n'),'battle')}

 /* ----- 턴 종료 ----- */
 async function turnEnd(){const c=ctx();if(!c.gm)return;const b=JSON.parse(JSON.stringify(c.b));const f=fieldOf(b);const db=(DB().states||{}).st||{};const lines=[];
  for(const mid in b.mons){const m=b.mons[mid];if(!m.entry||m.hp.cur<=0)continue;
   for(const t of B().turnEnd(m)){if(!t.delta)continue;m.hp.cur=Math.max(0,Math.min(m.hp.max,m.hp.cur+t.delta));lines.push(`${m.name} ${db[t.state]?db[t.state].ko:t.state} ${t.delta>0?'+':''}${t.delta} → ${m.hp.cur}`);if(m.hp.cur<=0){lines.push(`${m.name} 빈사!`);m.entry=''}}
   const st=m.states||{};for(const k in st){const v=+st[k];const def=db[k]||{};if(def.prog==='turn'&&v>0&&v<1000){st[k]=v-1;if(st[k]<=0){delete st[k];lines.push(`${m.name} ${def.ko||k} 해제`)}}}
   /* 임시 랭크 해제 */
   if(m.tempRank){for(const k in m.tempRank){m.rank[k]=(+m.rank[k]||0)-(+m.tempRank[k]||0)}delete m.tempRank;lines.push(`${m.name} 임시 랭크 해제`)}
   m.started=false}
  const dec=(o,k)=>{if(o[k]>0){o[k]--;if(o[k]<=0){delete o[k];return true}}return false};
  if(f.weather.type&&f.weather.count>0){f.weather.count--;if(f.weather.count<=0){lines.push(`날씨 ${f.weather.type} 끝`);f.weather={type:'',count:0}}}
  if(f.terrain.type&&f.terrain.count>0){f.terrain.count--;if(f.terrain.count<=0){lines.push(`${f.terrain.type} 끝`);f.terrain={type:'',count:0}}}
  for(const k of ROOMS)if(dec(f.rooms,k))lines.push(`${k} 끝`);for(const k of ETC)if(dec(f.etc,k))lines.push(`${k} 끝`);
  for(const s of SIDES){f.objects[s]=f.objects[s]||{};for(const k in f.objects[s])if(dec(f.objects[s],k))lines.push(`${SIDE_KO[s]} ${k} 끝`)}
  b.field=f;b.cmds={};b.order=[];b.phase=0;b.turn=(+b.turn||0)+1;CMD={};
  await A().set(['battle'],b);await A().set(['ready'],{});
  A().sysLog(`턴 종료 처리${lines.length?'\n'+lines.join('\n'):''}\n— 턴 ${b.turn} 지시 준비`,'battle')}

 /* ---------- 랭크·상태 편집 ---------- */
 function openEdit(mid){const c=ctx();const b=c.b;const m=b.mons[mid];if(!m||!canEdit(c,m))return;
  const sdb=DB().states||{st:{},groups:[]};const items=Object.keys(DB().items||{});
  const md=A().openModal(`<div class="mhead"><h2>${esc(m.name)} <span class="small dim">랭크·상태·소지품</span></h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="row" style="margin-bottom:8px"><b>HP</b> <input type="number" id="ehp" value="${m.hp.cur}" style="width:90px"> / ${m.hp.max} <button class="btn sm" id="ehpfull">전부 회복</button><span class="sp"></span><label><input type="checkbox" id="etera" ${m.teraActive?'checked':''}> 테라스탈 ${esc(m.tera)}</label></div>
   <div class="rankgrid">${Object.keys(STAT_KO).map(k=>`<div class="rkrow"><span>${STAT_KO[k]}</span><button class="btn xs" data-rk="${k}" data-d="-1">−</button><b class="mono" id="rk_${k}">${(+m.rank[k]||0)>0?'+':''}${+m.rank[k]||0}</b><button class="btn xs" data-rk="${k}" data-d="1">＋</button>
     <input type="number" step="0.01" class="n" data-mod="${k}" value="${(m.mod||{})[k]!=null&&(m.mod||{})[k]!==1?(m.mod||{})[k]:''}" placeholder="×1" title="배율(mod)"></div>`).join('')}</div>
   <div class="row small" style="margin:6px 0"><label><input type="checkbox" id="etemp"> 이번 변경을 임시 랭크로 (턴 종료 때 해제)</label><button class="btn xs ghost" id="erk0">랭크 전부 0</button></div>
   <div class="row" style="margin:8px 0"><b>소지품</b> <input type="text" id="eitem" list="itemlist" value="${esc(m.item||'')}" style="flex:1"><datalist id="itemlist">${items.map(i=>`<option value="${esc(i)}">`).join('')}</datalist></div>
   <div class="stgroups">${(sdb.groups||[]).map(g=>`<div class="stg"><div class="stgl">${esc(g.l)}</div>${g.s.map(k=>{const d=sdb.st[k]||{ko:k};const v=(m.states||{})[k];return `<label class="stt ${v?'on':''}" title="${esc((d.desc||[]).join(' '))}"><input type="checkbox" data-st="${k}" ${v?'checked':''}>${esc(d.ko)}${d.prog==='turn'||d.prog==='move'?`<input type="number" class="n xs" data-stc="${k}" value="${v&&v<1000?v:(d.min<1000?d.min:'')}" placeholder="T">`:''}</label>`}).join('')}</div>`).join('')}</div>
   <div class="row" style="margin-top:12px"><span class="sp"></span><button class="btn pri" id="esave">적용</button></div>`);
  const rank=Object.assign({},m.rank);const delta={};
  md.querySelectorAll('[data-rk]').forEach(bt=>bt.onclick=()=>{const k=bt.dataset.rk;const lim=k==='critical'?4:6;rank[k]=Math.max(-lim,Math.min(lim,(+rank[k]||0)+(+bt.dataset.d)));delta[k]=(delta[k]||0)+(+bt.dataset.d);$('#rk_'+k,md).textContent=(rank[k]>0?'+':'')+rank[k]});
  $('#erk0',md).onclick=()=>{for(const k in STAT_KO){rank[k]=0;$('#rk_'+k,md).textContent='0'}};
  $('#ehpfull',md).onclick=()=>{$('#ehp',md).value=m.hp.max};
  $('#esave',md).onclick=async()=>{const nm=JSON.parse(JSON.stringify(m));nm.hp.cur=Math.max(0,Math.min(m.hp.max,+$('#ehp',md).value||0));nm.rank=rank;nm.teraActive=$('#etera',md).checked;nm.item=$('#eitem',md).value.trim();
   nm.mod={};md.querySelectorAll('[data-mod]').forEach(i=>{if(i.value!==''&&+i.value!==1)nm.mod[i.dataset.mod]=+i.value});
   if($('#etemp',md).checked){nm.tempRank=nm.tempRank||{};for(const k in delta)nm.tempRank[k]=(+nm.tempRank[k]||0)+delta[k]}
   nm.states={};md.querySelectorAll('[data-st]').forEach(cb=>{if(!cb.checked)return;const k=cb.dataset.st;const ci=md.querySelector(`[data-stc="${k}"]`);const d=sdb.st[k]||{};nm.states[k]=ci&&ci.value!==''?+ci.value:(d.min||1)});
   if(nm.hp.cur<=0)nm.entry='';
   A().closeModal();if(await A().set(['battle','mons',mid],nm)){const ch=[];for(const k in STAT_KO){const a=+m.rank[k]||0,b2=+rank[k]||0;if(a!==b2)ch.push(`${STAT_KO[k]} ${a}→${b2>0?'+':''}${b2}`)}
    const sa=Object.keys(m.states||{}).filter(k=>m.states[k]),sb=Object.keys(nm.states);const on=sb.filter(k=>!sa.includes(k)).map(k=>(sdb.st[k]||{}).ko||k),off=sa.filter(k=>!sb.includes(k)).map(k=>(sdb.st[k]||{}).ko||k);
    if(on.length)ch.push('+'+on.join(','));if(off.length)ch.push('−'+off.join(','));if(nm.hp.cur!==m.hp.cur)ch.push(`HP ${m.hp.cur}→${nm.hp.cur}`);if((nm.item||'')!==(m.item||''))ch.push(`소지품 ${nm.item||'없음'}`);
    if(ch.length)A().sysLog(`${m.name}: ${ch.join(' · ')}`,'battle')}}}

 /* ---------- 필드 (GM) ---------- */
 function openField(){const c=ctx();if(!c.gm)return;const f=fieldOf(c.b);const objs=OBJECTS();
  const md=A().openModal(`<div class="mhead"><h2>날씨 · 필드 · 룸 · 설치기</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="row"><label>날씨 <select id="fw">${WEATHER.map(w=>`<option value="${w}" ${f.weather.type===w?'selected':''}>${w||'없음'}</option>`).join('')}</select></label><input type="number" class="n" id="fwc" value="${f.weather.count||''}" placeholder="턴">
    <label>필드 <select id="ft">${TERRAIN.map(w=>`<option value="${w}" ${f.terrain.type===w?'selected':''}>${w||'없음'}</option>`).join('')}</select></label><input type="number" class="n" id="ftc" value="${f.terrain.count||''}" placeholder="턴"></div>
   <div class="row" style="margin-top:8px">${[...ROOMS.map(r=>['rooms',r]),...ETC.map(r=>['etc',r])].map(([g,r])=>`<label>${r} <input type="number" class="n" data-fg="${g}" data-fk="${r}" value="${(f[g]||{})[r]||''}" placeholder="0"></label>`).join('')}</div>
   <div class="fobj">${SIDES.map(s=>`<div><div class="stgl">${SIDE_KO[s]} 진영 설치기</div><div class="objgrid">${objs.map(o=>`<label>${esc(o)} <input type="number" class="n xs" data-obj="${s}" data-ok="${esc(o)}" value="${(f.objects[s]||{})[o]||''}" placeholder="0"></label>`).join('')}</div></div>`).join('')}</div>
   <div class="row" style="margin-top:12px"><span class="sp"></span><button class="btn pri" id="fsave">적용</button></div>`);
  $('#fsave',md).onclick=async()=>{const nf={weather:{type:$('#fw',md).value,count:+$('#fwc',md).value||0},terrain:{type:$('#ft',md).value,count:+$('#ftc',md).value||0},rooms:{},etc:{},objects:{left:{},right:{}}};
   md.querySelectorAll('[data-fg]').forEach(i=>{if(+i.value>0)nf[i.dataset.fg][i.dataset.fk]=+i.value});
   md.querySelectorAll('[data-obj]').forEach(i=>{if(+i.value>0)nf.objects[i.dataset.obj][i.dataset.ok]=+i.value});
   A().closeModal();if(await A().set(['battle','field'],nf))A().sysLog(`필드 갱신: ${[nf.weather.type&&'날씨 '+nf.weather.type+' '+nf.weather.count+'T',nf.terrain.type&&nf.terrain.type+' '+nf.terrain.count+'T',...Object.entries(nf.rooms).map(([k,v])=>k+' '+v+'T'),...Object.entries(nf.etc).map(([k,v])=>k+' '+v+'T'),...SIDES.flatMap(s=>Object.entries(nf.objects[s]).map(([k,v])=>SIDE_KO[s]+' '+k+' '+v))].filter(Boolean).join(' · ')||'없음'}`,'battle')}}

 /* ---------- 지령 설정 (GM) ---------- */
 function openOrders(tid){const c=ctx();if(!c.gm)return;const t=c.b.trainers[tid];if(!t)return;const cnt=t.orderCount||{};const style=+(t.orderStyle||0);
  const md=A().openModal(`<div class="mhead"><h2>${esc(t.name)} 지령·명령</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="row"><label>계열 <select id="ostyle">${[['0','협회식 (4식 6령)'],['1','방해 지령'],['2','교회식 (십계)'],['3','야생']].map(([v,n])=>`<option value="${v}" ${style===+v?'selected':''}>${n}</option>`).join('')}</select></label></div>
   <div class="row" style="margin-top:8px;align-items:flex-start"><div><div class="stgl">지령 남은 횟수</div>${ORDER_KEYS.map((k,i)=>`<label class="row">${esc(csv(lists()['list_order_'+style])[i]||k)} <input type="number" class="n" data-oc="order_${k}" value="${cnt['order_'+k]??1}"></label>`).join('')}</div>
    <div><div class="stgl">명령 남은 횟수</div>${COMMAND_KEYS.map((k,i)=>`<label class="row">${esc(csv(lists()['list_command_'+style])[i]||k)} <input type="number" class="n" data-oc="command_${k}" value="${cnt['command_'+k]??1}"></label>`).join('')}</div></div>
   <div class="row" style="margin-top:12px"><span class="sp"></span><button class="btn pri" id="osave">적용</button></div>`);
  $('#ostyle',md).onchange=()=>{/* 계열이 바뀌면 이름만 바뀌므로 다시 연다 */};
  $('#osave',md).onclick=async()=>{const nt=JSON.parse(JSON.stringify(t));nt.orderStyle=+$('#ostyle',md).value;nt.orderCount={};md.querySelectorAll('[data-oc]').forEach(i=>nt.orderCount[i.dataset.oc]=+i.value||0);A().closeModal();await A().set(['battle','trainers',tid],nt)}}

 /* ---------- 공격 ---------- */
 function openAttack(mid){const c=ctx();const b=c.b;const atk=b.mons[mid];if(!atk||!canEdit(c,atk))return;const f=fieldOf(b);
  const x=(((b.cmds||{})[atk.tid]||{}).mons||{})[mid]||{};const slots=allEntered(b);
  const defMoveIdx=x.move!==''&&x.move!=='switch'&&x.move!=null?+x.move:0;
  const md=A().openModal(`<div class="mhead"><h2>공격 — ${esc(atk.name)}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="row"><label>기술 <select id="amove">${(atk.moves||[]).map((mv,i)=>`<option value="${i}" ${i===defMoveIdx?'selected':''}>${esc(mv.name)} (${esc(mv.type)} ${esc(mv.cat)} ${mv.pow||'-'}/${mv.acc||'필중'})</option>`).join('')}</select></label>
    <label>위력 <input type="number" class="n" id="apow"></label><label>명중 배율 <input type="number" step="0.01" class="n" id="aacc" value="1"></label></div>
   <div class="tgts" style="margin:6px 0">대상 ${slots.filter(s=>s.mon.id!==mid||true).map(s=>`<label class="tg ${s.side}"><input type="checkbox" data-t="${s.slot}" ${(x.targets||[]).includes(s.slot)?'checked':''}>${s.area.toUpperCase()} ${esc(s.mon.name)}</label>`).join('')}</div>
   <details class="adv" open><summary>보정</summary><div class="agrid">
    <label>급소 +<input type="number" class="n" id="acrit" value="0" title="입력 보정"></label><label>급소 지시보정 <input type="number" class="n" id="acritord" value="0"></label><label>급소 표 <select id="acrittype"><option value="0">0 (기본)</option><option value="2">2</option><option value="1">1</option></select></label>
    <label><input type="checkbox" id="acritforce"> 급소 확정</label>
    <label>자유 1 <input type="number" step="0.01" class="n" id="afree1" value="1"></label><label>자유 2 <input type="number" step="0.01" class="n" id="afree2" value="1"></label><label>아이템 1 <input type="number" step="0.01" class="n" id="aitem1" value="1"></label><label>아이템 2 <input type="number" step="0.01" class="n" id="aitem2" value="1"></label><label>특성 <input type="number" step="0.01" class="n" id="atrait" value="1"></label>
    <label>날씨 <input type="number" step="0.01" class="n" id="aweather" value="1"></label><label>필드 <input type="number" step="0.01" class="n" id="afield" value="1"></label>
    <label><input type="checkbox" id="ahelp" ${(atk.states||{}).HelpingHand?'checked':''}> 도우미 1.5</label><label><input type="checkbox" id="acharge"> 충전계 ×2</label><label><input type="checkbox" id="alife" ${atk.item==='생명의구슬'?'checked':''}> 생명의구슬 1.3</label>
    <label><input type="checkbox" id="aadapt"> 적응력 (자속 2배)</label><label><input type="checkbox" id="abelt" ${atk.item==='달인의띠'?'checked':''}> 달인의띠 1.2</label>
    <label>공격 능력 <select id="aatk"><option value="">기본</option>${['attack','specialattack','defense','specialdefense','speed'].map(k=>`<option value="${k}">${STAT_KO[k]}</option>`).join('')}</select></label>
    <label>방어 능력 <select id="adef"><option value="">기본</option>${['defense','specialdefense','attack','specialattack','speed'].map(k=>`<option value="${k}">${STAT_KO[k]}</option>`).join('')}</select></label>
    <label>공격 측 무시 <select id="aigatk"><option value="-1">없음</option><option value="0">상승(강화)</option><option value="1">하락(저하)</option></select></label>
    <label>방어 측 무시 <select id="aigdef"><option value="-1">없음</option><option value="0">상승(강화)</option><option value="1">하락(저하)</option></select></label>
    <label>복합 상성 <select id="amulti"><option value="0">첫 타입</option><option value="1">상대에게 유리</option><option value="2">상대에게 불리</option></select></label>
    <label>상성 강제 <select id="aforce"><option value="">없음</option><option value="4">4</option><option value="2">2</option><option value="1">1</option><option value="0.5">½</option><option value="0.25">¼</option><option value="0">무효</option></select></label>
    <label>연속 <input type="number" class="n" id="ahits" placeholder="자동"></label><label><input type="checkbox" id="askill"> 스킬링크</label><label><input type="checkbox" id="asure"> 필중 처리</label>
   </div></details>
   <div id="ares"></div>
   <div class="row" style="margin-top:10px"><span class="sp"></span><button class="btn" id="aroll">굴리기</button><button class="btn pri" id="aapply" disabled>적용</button></div>`);
  const mvSel=$('#amove',md);const syncMove=()=>{const mv=(atk.moves||[])[+mvSel.value]||{};$('#apow',md).value=mv.pow||0;const wm=WEATHER_MUL[f.weather.type]||{};$('#aweather',md).value=wm[mv.typeEn]!=null?wm[mv.typeEn]:1;
   let fm=1;const ft=f.terrain.type;if(ft==='그래스필드'&&mv.typeEn==='Grass')fm=1.3;if(ft==='일렉트릭필드'&&mv.typeEn==='Electric')fm=1.3;if(ft==='사이코필드'&&mv.typeEn==='Psychic')fm=1.3;if(ft==='미스트필드'&&mv.typeEn==='Dragon')fm=0.5;$('#afield',md).value=fm;
   const dflt=defaultTargets(b,mid,String(mvSel.value));if(x.move==null||x.move===''||+x.move!==+mvSel.value){md.querySelectorAll('[data-t]').forEach(cb=>cb.checked=dflt.includes(cb.dataset.t))}};
  mvSel.onchange=syncMove;syncMove();
  let RESULT=null;
  $('#aroll',md).onclick=()=>{
   const mv=(atk.moves||[])[+mvSel.value];if(!mv)return;
   const targets=[...md.querySelectorAll('[data-t]:checked')].map(cb=>cb.dataset.t);if(!targets.length)return A().toast('대상을 골라 줘');
   const g=id=>$('#'+id,md);const n=id=>+g(id).value;const ck=id=>g(id).checked;
   const moveTypes=String(mv.type||'').split(/[()/,]/).map(t=>t.trim()).filter(Boolean).map(S().typeEn);
   const atkTypes=atk.teraActive&&atk.teraEn!=='-'?[...atk.types,atk.teraEn]:atk.types;
   const res=[];const multiTarget=targets.length>1;
   for(const slot of targets){const [side,area]=slot.split('_');const def=entered(b,side)[area];if(!def)continue;
    const acc=B().accuracy(atk,def,{acc:mv.acc},{accMult:n('aacc'),sureHit:ck('asure'),starry:f.weather.type==='별하늘',fog:f.weather.type==='짙은안개',fogImmune:moveTypes.some(t=>t==='Poison'||t==='Fairy'),gravity:(f.etc||{})['중력']>0,wideLens:atk.item==='광각렌즈'});
    let hits=[];if(acc.hit){const cnt=n('ahits')||B().multiHits(mv,{skillLink:ck('askill')});const stage=B().critStage(atk,def,{input:n('acrit'),order:n('acritord')});
     for(let i=0;i<cnt;i++){const cr=B().critical(stage,{type:+g('acrittype').value,forced:ck('acritforce')});hits.push({v:cr.crit?2:1,cr,stage})}}
    const objs=(f.objects||{})[side]||{};const wall={};for(const k in WALLS)if(objs[k]>0)wall[WALLS[k]]=1;
    const dmg=mv.cat==='변화'||!(+g('apow').value)?null:B().damage(atk,def,Object.assign({},mv,{pow:+g('apow').value}),{hits:hits.map(h=>h.v),free1:n('afree1'),free2:n('afree2'),item1:n('aitem1'),item2:n('aitem2'),trait:n('atrait'),weather:n('aweather'),fieldMul:n('afield'),helping:ck('ahelp'),charge:ck('acharge'),lifeOrb:ck('alife'),multiTarget,wall,wallSize:mode(b)>=2?2:1,atkStat:g('aatk').value||undefined,defStat:g('adef').value||undefined,ignoreAtk:+g('aigatk').value,ignoreDef:+g('aigdef').value,watersport:(f.etc||{})['물놀이']>0,mudsport:(f.etc||{})['흙놀이']>0,scarf:atk.item==='구애스카프',choiceDef:['구애머리띠','구애안경'].includes(def.item||'')&&false,tailwindDef:((f.objects||{})[side]||{})['순풍']>0,swampDef:((f.objects||{})[side]||{})['습원']>0});
    const eff=dmg?B().effectiveness(moveTypes,def,{multiMode:+g('amulti').value,atkTypes,force:g('aforce').value===''?null:+g('aforce').value,floating:(def.states||{}).MagnetRise||(def.states||{}).Telekinesis}):null;
    const stab=eff?eff.stab:false;
    const hp=dmg?B().hpDamage(def,dmg.total,eff.value,{stab,adaptability:ck('aadapt'),expertBelt:ck('abelt'),guard:1}):null;
    res.push({slot,def,acc,hits,dmg,eff,stab,hp,guard:1,manual:1})}
   RESULT={mv,targets:res,moveTypes};
   $('#ares',md).innerHTML=`<table class="t"><tr><th>대상</th><th>명중</th><th>급소</th><th>대미지(상성 전)</th><th>상성</th><th>보정</th><th>최종</th></tr>${res.map((r,i)=>`<tr>
    <td><b>${esc(r.def.name)}</b><div class="small dim">HP ${r.def.hp.cur}/${r.def.hp.max}</div></td>
    <td>${r.acc.sure?'필중':(r.acc.hit?'<b style="color:var(--ok)">명중</b>':'<b style="color:var(--red)">빗나감</b>')+`<div class="small dim">${r.acc.roll} / ${r.acc.target}</div>`}</td>
    <td>${r.hits.map(h=>h.v===2?`<b style="color:var(--red)">급소</b>`:'-').join('<br>')}<div class="small dim">${r.hits.map(h=>h.cr.roll+'/'+h.cr.chance).join('<br>')}</div></td>
    <td>${r.dmg?`<b class="mono">${r.dmg.total}</b> <span class="small dim">(${r.dmg.min}~${r.dmg.max}${r.hits.length>1?' · '+r.hits.length+'회':''})</span>`:'-'}</td>
    <td>${r.eff?`<b>×${r.eff.value}</b> <span class="small dim">${esc(S().typeKo(r.eff.type))}${r.stab?' · 자속':''}</span>`:'-'}</td>
    <td>${r.dmg?`<label class="small">버텨라/방호 <input type="number" step="0.01" class="n xs" data-guard="${i}" value="1"></label> <label class="small">수동 <input type="number" step="0.01" class="n xs" data-manual="${i}" value="1"></label> <label class="small"><input type="checkbox" data-berry="${i}"> 반감열매</label> <label class="small"><input type="checkbox" data-endure="${i}"> 버티기</label>`:''}</td>
    <td><b class="mono" id="fin_${i}">${r.hp&&r.acc.hit?r.hp.final:0}</b><div class="small dim" id="aft_${i}">→ ${r.hp&&r.acc.hit?r.hp.after:r.def.hp.cur}</div></td></tr>`).join('')}</table>
    <div class="small dim" style="margin-top:4px">${esc(mv.name)} · L${atk.lv} 위력 ${g('apow').value} · ${res[0]&&res[0].dmg?`공격 ${Math.round(res[0].dmg.hits[0]?res[0].dmg.hits[0].A:0)} / 방어 ${Math.round(res[0].dmg.hits[0]?res[0].dmg.hits[0].D:0)} · M ${res[0].dmg.M} · 벽 ${res[0].dmg.wall}`:''}</div>`;
   const recompute=()=>{res.forEach((r,i)=>{if(!r.dmg)return;const gd=md.querySelector(`[data-guard="${i}"]`),mn=md.querySelector(`[data-manual="${i}"]`),br=md.querySelector(`[data-berry="${i}"]`),en=md.querySelector(`[data-endure="${i}"]`);
     r.hp=B().hpDamage(r.def,r.dmg.total,r.eff.value,{stab:r.stab,adaptability:ck('aadapt'),expertBelt:ck('abelt'),guard:+gd.value||1,manual:+mn.value||1,berryHalf:br.checked,endure:en.checked});
     $('#fin_'+i,md).textContent=r.acc.hit?r.hp.final:0;$('#aft_'+i,md).textContent='→ '+(r.acc.hit?r.hp.after:r.def.hp.cur)})};
   md.querySelectorAll('[data-guard],[data-manual],[data-berry],[data-endure]').forEach(el=>el.addEventListener('input',recompute));
   $('#aapply',md).disabled=false};
  $('#aapply',md).onclick=async()=>{if(!RESULT)return;const nb=JSON.parse(JSON.stringify(ctx().b));const lines=[];
   for(const r of RESULT.targets){const def=nb.mons[r.def.id];if(!def)continue;const hitTxt=r.acc.sure?'필중':r.acc.hit?`명중(${r.acc.roll}/${r.acc.target})`:`빗나감(${r.acc.roll}/${r.acc.target})`;
    if(!r.acc.hit){lines.push(`→ ${def.name}: ${hitTxt}`);continue}
    if(!r.dmg){lines.push(`→ ${def.name}: ${hitTxt} (변화기)`);continue}
    const dmgv=r.hp.final;def.hp.cur=Math.max(0,def.hp.cur-dmgv);def.hpOdd=!def.hpOdd;
    lines.push(`→ ${def.name}: ${hitTxt} ${r.hits.some(h=>h.v===2)?'급소! ':''}${r.hits.length>1?r.hits.length+'회 ':''}${r.dmg.total}×${r.eff.value}${r.stab?'×자속':''} = ${dmgv} → HP ${def.hp.cur}/${def.hp.max}${def.hp.cur<=0?' 빈사!':''}`);
    if(def.hp.cur<=0)def.entry=''}
   if($('#alife',md).checked&&RESULT.targets.some(r=>r.acc.hit&&r.dmg)){const a=nb.mons[mid];const rec=Math.max(1,Math.floor(a.hp.max/10));a.hp.cur=Math.max(0,a.hp.cur-rec);lines.push(`${atk.name} 생명의구슬 반동 −${rec} → ${a.hp.cur}`);if(a.hp.cur<=0)a.entry=''}
   A().closeModal();if(await A().set(['battle','mons'],nb.mons))A().sysLog(`${atk.name}의 ${RESULT.mv.name}!\n${lines.join('\n')}`,'battle')}}

 return {render,ctx,entered,allEntered,fieldOf,resetLocal:()=>{CMD={}}};
})();
