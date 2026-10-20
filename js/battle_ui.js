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
 const IMG=()=>((DB().img)||{state:{},field:{}});
 const W_IMG={맑음:'weather_Sunny',비:'weather_Rainy',모래바람:'weather_Sandstorm',싸라기눈:'weather_Snowstorm',눈:'weather_Snow',짙은안개:'weather_FoggyMist',밤:'weather_Night',별하늘:'weather_StarryNight',큰가뭄:'weather_Sunny_extreme',폭우:'weather_Rainy_extreme',난기류:'weather_StrongWinds',극한:'weather_Snow_extreme',깊은밤:'weather_Night_extreme'};
 const T_IMG={그래스필드:'field_object_grass',일렉트릭필드:'field_object_electric',미스트필드:'field_object_mist',사이코필드:'field_object_psycho',트릭룸:'room_trick',매직룸:'room_magic',원더룸:'room_wonder',블랙룸:'room_black',중력:'object_gravity',물놀이:'object_watersport',흙놀이:'object_mudsport'};
 const fimg=k=>IMG().field[k]?`img/field/${IMG().field[k]}`:'';const simg=k=>IMG().state[k]?`img/state/${IMG().state[k]}`:'';

 /* ---------- 상태 읽기 도우미 ---------- */
 function ctx(){const ST=A().ST;const b=ST.state.battle||{};return {ST,b,role:ST.role,seat:ST.seat,gm:ST.role==='gm'}}
 function mode(b){return Math.max(1,Math.min(3,+b.mode||2))}  /* 기본 더블(2:2) */
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
  const mySide=c.gm?'left':((b.trainers||{})[c.seat]||{}).side||'left';const top=mySide==='left'?'right':'left';
  el.innerHTML=`
  <div class="bstat">
   <div class="turn"><span class="tlab">TURN</span><span class="tnum">${b.turn||0}</span></div>
   <div class="phases">${phases.map(([p,n])=>`<button class="ph ${(+b.phase||0)===p?'on':''}" data-phase="${p}" ${c.gm?'':'disabled'}>${n}</button>`).join('')}</div>
   <span class="sp"></span>
   ${c.gm?`<div class="gmrow"><label>에리어 <select data-act="mode">${[1,2,3].map(n=>`<option value="${n}" ${mode(b)===n?'selected':''}>${n}</option>`).join('')}</select></label>
    <button class="btn sm" data-act="reveal">지시 공개</button><button class="btn sm" data-act="order">행동 순서</button><button class="btn sm" data-act="turnend">턴 종료 처리</button><button class="btn sm" data-act="field">필드</button>
    <button class="btn sm ghost" data-act="resetcmd">지시 초기화</button><button class="btn sm ghost danger" data-act="clear">배틀 비우기</button>
    ${Object.entries(c.ST.state.pub||{}).filter(([k,v])=>v&&v.time).map(([k,v])=>`<span class="chip" style="border-color:var(--yel)">타임 요청: ${esc((b.trainers[k]||{}).name||k)} → ${esc(monName(b,v.time.mid))} <button class="btn xs pri" data-act="timeok" data-seat="${k}">허가</button></span>`).join('')}</div>`:''}
  </div>
  <div class="stadium">
   ${areaGrid(c)}
   ${fieldStrip(c,f)}
   <div class="benches">${benchRow(c,'left',ready)}${benchRow(c,'right',ready)}</div>
  </div>
  ${orderBox(c)}
  ${cmdPanel(c,ready)}`;
  el.querySelectorAll('[data-phase]').forEach(bt=>bt.onclick=()=>setPhase(+bt.dataset.phase));
  el.querySelectorAll('[data-act]').forEach(bt=>{if(bt.tagName==='SELECT')bt.onchange=()=>action(bt.dataset,bt.value);else bt.onclick=()=>action(bt.dataset)});
  el.querySelectorAll('[data-mon]').forEach(cd=>cd.onclick=e=>{if(e.target.closest('[data-act]'))return;A().openMon(cd.dataset.mon)});
  const form=$('#cmdForm',el);if(form)bindCmdForm(form,c)}
 document.addEventListener('click',e=>{const t=e.target.closest('.mvdb');if(!t)return;e.stopPropagation();e.preventDefault();if(document.querySelector('.modalbg')&&!document.querySelector('.dbmodal'))return;window.OM_DB_UI.open({kind:'move',sel:t.dataset.mvdb})},true);

 /* 좌측 A | 우측 A / 좌측 B | 우측 B … 열 = 진영, 행 = 에리어 */
 function areaGrid(c){const b=c.b;const ent={left:entered(b,'left'),right:entered(b,'right')};const ids={left:((b.sides||{}).left||{}).trainers||[],right:((b.sides||{}).right||{}).trainers||[]};
  const cell=(side,a)=>{const m=ent[side][a];const slot=slotOf(side,a);return `<div class="area ${side} ${m?'':'empty'}" data-slot="${slot}"><div class="alab ${side}">${SIDE_KO[side]} ${a.toUpperCase()}</div>${m?bigCard(c,m,slot):`<div class="aempty">빈 자리${c.gm||ids[side].includes(c.seat)?'<br><span class="small">벤치에서 「등장」</span>':''}</div>`}</div>`};
  return `<div class="fgrid"><div class="ahead left">${SIDE_KO.left}</div><div class="ahead right">${SIDE_KO.right}</div>${AREAS.slice(0,mode(b)).map(a=>cell('left',a)+cell('right',a)).join('')}</div>`}
 function areaRow(c,side){const b=c.b;const ent=entered(b,side);const ids=((b.sides||{})[side]||{}).trainers||[];
  return `<div class="arow ${side}"><div class="alabel ${side}">${SIDE_KO[side]}</div>${AREAS.slice(0,mode(b)).map(a=>{const m=ent[a];const slot=slotOf(side,a);
   return `<div class="area ${m?'':'empty'}" data-slot="${slot}"><div class="alab">${a.toUpperCase()}</div>${m?bigCard(c,m,slot):`<div class="aempty">빈 자리${c.gm||ids.includes(c.seat)?'<br><span class="small">벤치에서 「등장」</span>':''}</div>`}</div>`}).join('')}</div>`}
 function benchRow(c,side,ready){const b=c.b;const ids=((b.sides||{})[side]||{}).trainers||[];const trs=b.trainers||{};const seats=c.ST.state.seats||{};
  const items=ids.map(tid=>{const t=trs[tid]||{name:'?',ranks:{}};const o=seats[tid];const mons=Object.values(b.mons||{}).filter(m=>m.tid===tid).sort((x,y)=>(x.slot||0)-(y.slot||0));const cmdDone=!!(b.cmds||{})[tid];const rd=!!ready[tid];
   return `<div class="tblock"><div class="trainer"><div class="tpic" style="${t.image?`background-image:url('${t.image}')`:''}"></div><div class="tinfo"><div class="tn">${esc(t.name)}${tid===c.seat?' <span class="tag me">ME</span>':''}${rd?' <span class="tag ok">READY</span>':cmdDone?' <span class="tag">공개됨</span>':''}</div>
     <div class="tr">${['육성','지시','통솔','능력'].map(k=>`${k} <b>${esc(t.ranks[k]||'-')}</b>`).join(' · ')} · ${o?`<span class="who">${esc(o.name)}</span>`:'<span class="dim">빈 자리</span>'}</div></div>
     ${c.gm?`<button class="btn xs ghost" data-act="orders" data-tid="${tid}">지령</button><button class="btn xs ghost danger" data-act="unload" data-tid="${tid}">빼기</button>`:''}</div>
    <div class="bench">${mons.map(m=>benchCard(c,m)).join('')||'<div class="dim small">포켓몬 없음</div>'}</div></div>`}).join('');
  return `<div class="brow ${side}"><div class="shead"><span class="sname">${SIDE_KO[side]} 벤치</span><span class="sp"></span>${c.gm?`<button class="btn xs" data-act="load" data-side="${side}">+ 파티</button>`:''}</div>${items||'<div class="aempty small">트레이너 없음'+(c.gm?' — 「+ 파티」로 로스터에서 불러온다':'')+'</div>'}</div>`}
 function fieldStrip(c,f){const w=f.weather.type,t=f.terrain.type;
  const ic=(name,label,cnt)=>{const im=fimg(name);return `<div class="fic" title="${esc(label)}">${im?`<img src="${im}" alt="">`:'<span class="fnoimg"></span>'}<span>${esc(label)}${cnt?` <b>${cnt}T</b>`:''}</span></div>`};
  const mid=[w?ic(W_IMG[w],w,f.weather.count):'',t?ic(T_IMG[t],t,f.terrain.count):'',...ROOMS.filter(r=>(f.rooms||{})[r]>0).map(r=>ic(T_IMG[r],r,f.rooms[r])),...ETC.filter(r=>(f.etc||{})[r]>0).map(r=>ic(T_IMG[r],r,f.etc[r]))].filter(Boolean).join('');
  const objs=side=>Object.entries((f.objects||{})[side]||{}).filter(([k,v])=>v>0).map(([k,v])=>`<span class="obj">${esc(k)} <b>${v}</b></span>`).join('');
  return `<div class="fstrip"><div class="fobjs top"><span class="olab left">좌측 설치물</span>${objs('left')||'<span class="dim small">없음</span>'}</div><div class="fmid">${mid||'<span class="dim small">날씨·필드 없음</span>'}${c.gm?'<button class="btn xs" data-act="field">필드</button>':''}</div><div class="fobjs bottom">${objs('right')||'<span class="dim small">없음</span>'}<span class="olab right">우측 설치물</span></div></div>`}
 function sideBox(c,side,ready){
  const b=c.b;const ids=((b.sides||{})[side]||{}).trainers||[];const trs=b.trainers||{};const seats=c.ST.state.seats||{};
  const ent=entered(b,side);
  const areas=AREAS.slice(0,mode(b)).map(a=>{const m=ent[a];const slot=slotOf(side,a);
   return `<div class="area ${m?'':'empty'}" data-slot="${slot}"><div class="alab">${a.toUpperCase()}</div>${m?bigCard(c,m,slot):`<div class="aempty">빈 자리${c.gm||ids.includes(c.seat)?'<br><span class="small">벤치에서 「등장」</span>':''}</div>`}</div>`}).join('');
  const bench=ids.map(tid=>{const t=trs[tid]||{name:'?',ranks:{}};const o=seats[tid];const mons=Object.values(b.mons||{}).filter(m=>m.tid===tid).sort((x,y)=>(x.slot||0)-(y.slot||0));
   const cmdDone=!!(b.cmds||{})[tid];const rd=!!ready[tid];
   return `<div class="trainer"><div class="tpic" style="${t.image?`background-image:url('${t.image}')`:''}"></div><div class="tinfo"><div class="tn">${esc(t.name)}${tid===c.seat?' <span class="tag me">ME</span>':''}${rd?' <span class="tag ok">READY</span>':cmdDone?' <span class="tag">공개됨</span>':''}</div>
     <div class="tr">${['육성','지시','통솔','능력'].map(k=>`${k} <b>${esc(t.ranks[k]||'-')}</b>`).join(' · ')} · ${o?`<span class="who">${esc(o.name)}</span>`:'<span class="dim">빈 자리</span>'}</div></div>
     ${c.gm?`<button class="btn xs ghost" data-act="orders" data-tid="${tid}">지령</button><button class="btn xs ghost danger" data-act="unload" data-tid="${tid}">빼기</button>`:''}</div>
    <div class="bench">${mons.map(m=>benchCard(c,m)).join('')||'<div class="dim small">포켓몬 없음</div>'}</div>`}).join('');
  return `<div class="sideBox ${side}"><div class="shead"><span class="sname">${SIDE_KO[side]}</span><span class="sp"></span>${c.gm?`<button class="btn xs" data-act="load" data-side="${side}">+ 파티</button>`:''}</div>
   <div class="areas">${areas}</div>${bench||'<div class="aempty">트레이너 없음</div>'}</div>`}

 function hpBar(m,full){const hp=m.hp||{max:1,cur:1};const pct=Math.max(0,Math.min(100,Math.round(hp.cur/hp.max*100)));const cls=pct<=25?'low':pct<=50?'mid':'';
  return `<div class="hpbar ${cls}"><i style="width:${pct}%"></i></div><div class="hpnum">${full?`${hp.cur} <span class="dim">/ ${hp.max}</span>`:pct+'%'}</div>`}
 function rankChips(m){const r=m.rank||{};const out=[];for(const k of ['attack','defense','specialattack','specialdefense','speed','accuracy','evasion','critical']){const v=+r[k]||0;if(v)out.push(`<span class="rk ${v>0?'up':'dn'}">${STAT_KO[k]}${v>0?'+':''}${v}</span>`)}
  const md=m.mod||{};for(const k in md){const v=+md[k];if(v&&v!==1)out.push(`<span class="rk ${v>1?'up':'dn'}">${STAT_KO[k]||k}×${v}</span>`)}return out.join('')}
 const FLAG_KO={endure:'버텨라!',surehit:'맞춰라!',dodgePhys:'물러나!',dodgeSpec:'피해라!',swap:'바꿔라!',return:'돌아와!',hitPhys:'지킬 수 없다!',hitSpec:'피할 수 없다!',noEndure:'버틸 수 없다!',acc0:'맞출 수 없다!',dodgeOnce:'주인의 칙령',nullify:'파계',rebirth:'윤회의 법계'};
 function flagChips(m){return Object.keys(m.flags||{}).filter(k=>m.flags[k]).map(k=>`<span class="rk flag">${esc(FLAG_KO[k]||k)}</span>`).join('')}
 function stateChips(m){const st=m.states||{};const db=(DB().states||{}).st||{};return Object.keys(st).filter(k=>st[k]).map(k=>{const im=simg(k);return `<span class="stc ${db[k]&&db[k].abn?'abn':''}" title="${esc((db[k]&&db[k].desc||[]).join(' '))}">${im?`<img src="${im}" alt="">`:''}${esc(db[k]?db[k].ko:k)}${+st[k]>1&&+st[k]<1000?' '+st[k]:''}</span>`}).join('')}
 function bigCard(c,m,slot){const full=canEdit(c,m);const cmd=cmdOf(c.b,m);
  return `<div class="mon big ${m.hp.cur<=0?'fainted':''}" data-mon="${m.id}"><div class="pic" style="${m.image?`background-image:url('${m.image}')`:''}"></div>
   <div class="minfo"><div class="nm">${esc(m.name)}<span class="lv">Lv.${m.lv}</span></div><div class="ty">${m.types.filter(t=>t!=='-').map(typeChip).join('')}${m.teraActive?`<span class="rk up">테라 ${esc(m.tera)}</span>`:''}</div>
   ${hpBar(m,full)}<div class="rks">${rankChips(m)}${stateChips(m)}${flagChips(m)}</div>
   ${cmd?`<div class="cmdcard">${cmd}</div>`:''}
   ${potLine(c,m)}
   <div class="mbtns">${full?`<button class="btn xs" data-act="attack" data-mid="${m.id}">공격</button><button class="btn xs" data-act="edit" data-mid="${m.id}">랭크·상태</button><button class="btn xs ghost" data-act="exit" data-mid="${m.id}">퇴장</button>`:''}${(!full&&c.seat&&(c.b.trainers[c.seat]||{}).side!==m.side&&(+c.b.phase||0)===0)||c.gm&&!full?`<button class="btn xs ghost" data-act="time" data-mid="${m.id}" title="상대 지시 엿보기">타임</button>`:''}</div></div></div>`}
 function benchCard(c,m){const full=canEdit(c,m);const out=!!m.entry;
  return `<div class="mon small ${m.hp.cur<=0?'fainted':''} ${out?'onfield':''}" data-mon="${m.id}"><div class="pic" style="${m.image?`background-image:url('${m.image}')`:''}"></div>
   <div class="nm">${esc(m.name)}</div><div class="ty">${m.types.filter(t=>t!=='-').map(typeChip).join('')}</div>${hpBar(m,full)}
   ${out?`<div class="dim small">에리어 ${m.entry.toUpperCase()}</div>`:full&&m.hp.cur>0?`<button class="btn xs" data-act="enter" data-mid="${m.id}">등장</button>`:''}</div>`}

 /* 【N/시】 포텐셜 횟수. potUses[name] = 남은 횟수 */
 function potList(m){const out=[];const src=[...(m.pots||[]).filter(p=>!p.ph&&p.name),...(m.excl?[m.excl]:[]),...(m.exclX||[])];
  for(const p of src){const mm=String(p.eff||'').match(/【(\d+)\/시】/);if(mm)out.push({name:p.name,max:+mm[1]})}return out}
 function potLine(c,m){const L=potList(m);if(!L.length)return '';const full=canEdit(c,m);const u=m.potUses||{};
  return `<div class="pots">${L.map(p=>{const left=u[p.name]==null?p.max:+u[p.name];return `<span class="pot ${left<=0?'off':''}" title="${esc(p.name)}">${esc(p.name)} <b>${left}/${p.max}</b>${full&&left>0?`<button class="btn xs" data-act="usepot" data-mid="${m.id}" data-pot="${esc(p.name)}">사용</button>`:''}${full&&left<p.max?`<button class="btn xs ghost" data-act="restorepot" data-mid="${m.id}" data-pot="${esc(p.name)}">+</button>`:''}</span>`}).join('')}</div>`}
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
 /* ---------- 지시 입력 패널 (맵툴 cmd_ui 와 같은 구성: 포켓몬 탭 → 기술 카드 → 대상 보드 → 지령 풀 → 요약) ---------- */
 const UIC={tab:{}};  /* tid → 선택된 mid */
 function moveCard(mv,i,on,extra){const col=S().typeColor(mv.typeEn);return `<div class="mv ${on?'on':''}" style="background:${col.bg};color:${col.fg}" ${extra||''}><div class="mn">${esc(mv.name)} <i class="mvdb" data-mvdb="${esc(mv.name)}" title="기술 DB">?</i></div><div class="mm">${esc(mv.cat)} · 위력 ${mv.pow||'-'} · 명중 ${mv.acc||'필중'}${mv.prio?' · 우선 '+mv.prio:''}</div><div class="mr">${esc(mv.range)}</div></div>`}
 function tile(m,side,area,on,cls,extra){if(!m)return `<div class="tg none ${cls||''}"><span class="tn"><small>${SIDE_KO[side]} ${area.toUpperCase()} 빈 자리</small></span></div>`;const pct=Math.max(0,Math.min(100,Math.round(m.hp.cur/m.hp.max*100)));
  return `<div class="tg ${cls||''} ${on?'on':''}" ${extra||''}><div class="ti" style="${m.image?`background-image:url('${m.image}')`:''}"></div><div class="tn"><b>${esc(m.name)}</b><small>${SIDE_KO[side]} ${area.toUpperCase()} · ${m.types.filter(t=>t!=='-').map(typeChip).join('')}</small><div class="hpb ${pct<=25?'low':pct<=50?'mid':''}"><i style="width:${pct}%"></i></div></div><span class="tk">${on?'✓':''}</span></div>`}
 /* 대상판: 열 = 좌측/우측, 행 = 에리어 (무대와 같은 배치). 아군 열은 초록, 상대 열은 빨강 */
 function board(b,mySide,isOn,attr,allowSelf){const ent={left:entered(b,'left'),right:entered(b,'right')};const cls=s=>s===mySide?'al':'en';
  const head=SIDES.map(s=>`<div class="bl ${cls(s)}">${SIDE_KO[s]}${s===mySide?' (아군)':' (상대)'}</div>`).join('');
  const rows=AREAS.slice(0,mode(b)).map(a=>SIDES.map(s=>{const m=ent[s][a];const slot=slotOf(s,a);return tile(m,s,a,m&&isOn(slot,m),cls(s),m?attr(slot,m):'')}).join('')).join('');
  return `<div class="board grid">${head}${rows}</div>`}
 function cmdPanel(c,ready){
  const b=c.b;const tids=myTrainers(c);if(!tids.length)return '';
  const phase=+b.phase||0;
  const blocks=tids.map(tid=>{const t=(b.trainers||{})[tid]||{};const mons=Object.values(b.mons||{}).filter(m=>m.tid===tid&&m.entry&&m.hp.cur>0).sort((x,y)=>x.entry.localeCompare(y.entry));if(!mons.length)return '';
   const cur=CMD[tid]||(CMD[tid]={mons:{},order:{},command:{},detail:''});
   if(!mons.find(m=>m.id===UIC.tab[tid]))UIC.tab[tid]=mons[0].id;const m=mons.find(x=>x.id===UIC.tab[tid]);
   mons.forEach(mm=>{cur.mons[mm.id]=cur.mons[mm.id]||{move:'',switch:'',targets:[],prio:{},ochg:{}}});
   const x=cur.mons[m.id];const bench=Object.values(b.mons||{}).filter(mm=>mm.tid===tid&&!mm.entry&&mm.hp.cur>0);
   const style=+(t.orderStyle||0);const oNames=csv(lists()['list_order_'+style]);const cNames=csv(lists()['list_command_'+style]);const cnt=t.orderCount||{};
   const summ=mons.map(mm=>{const xx=cur.mons[mm.id];if(xx.move==='switch')return `${mm.name}: 교대 → ${monName(b,xx.switch)||'?'}`;if(xx.move===''||xx.move==null)return `${mm.name}: <span class="warn">행동 없음</span>`;const mv=(mm.moves||[])[+xx.move];return `${mm.name}: <b>${mv?esc(mv.name):'?'}</b>${xx.targets.length?' → '+xx.targets.map(sl=>slotName(b,sl)).join(', '):' <span class="warn">대상 없음</span>'}`}).join(' · ');
   const isSwitch=x.move==='switch';const mvSel=!isSwitch&&x.move!==''?(m.moves||[])[+x.move]:null;
   return `<div class="cmdt" data-tid="${tid}">
    <div class="cmdhead"><b>${esc(t.name)}</b> 지시 ${ready[tid]?'<span class="tag ok">READY</span>':''}<span class="sp"></span><button class="btn xs ghost" data-act="cmdload" data-tid="${tid}">저장된 지시 불러오기</button></div>
    <div class="tabs2">${mons.map(mm=>{const xx=cur.mons[mm.id];const mv=xx.move!==''&&xx.move!=='switch'?(mm.moves||[])[+xx.move]:null;return `<div class="tab2 ${mm.id===m.id?'on':''}" data-ctab="${mm.id}"><div class="pic" style="${mm.image?`background-image:url('${mm.image}')`:''}"></div><div><b>${esc(mm.name)}</b><small>${xx.move==='switch'?'교대 → '+esc(monName(b,xx.switch)||'?'):mv?esc(mv.name):'미정'}</small></div></div>`}).join('')}</div>
    <div class="pane">
     <div class="sec">행동 <span class="seg"><span class="${!isSwitch?'on':''}" data-seg="move">기술</span><span class="${isSwitch?'on':''}" data-seg="switch">교대</span></span><span class="note">에리어 ${m.entry.toUpperCase()}</span></div>
     ${isSwitch?`<div class="pg">${bench.length?bench.map(bm=>`<div class="pc ${x.switch===bm.id?'on':''}" data-sw="${bm.id}"><div class="pic" style="${bm.image?`background-image:url('${bm.image}')`:''}"></div><div><b>${esc(bm.name)}</b><div class="small dim">${bm.hp.cur}/${bm.hp.max}</div></div></div>`).join(''):'<div class="dim small">교대할 포켓몬이 없다</div>'}</div>`
     :`<div class="mvg">${(m.moves||[]).map((mv,i)=>moveCard(mv,i,String(x.move)===String(i),`data-mv="${i}"`)).join('')}</div>${mvSel?`<div class="mef">${esc(mvSel.eff||'')}${mvSel.tag&&mvSel.tag!=='-'?` <span class="dim">[${esc(mvSel.tag)}]</span>`:''}</div>`:''}
      ${mvSel?`<div class="sec">대상 <span class="note">범위 ${esc(mvSel.range)} — 누르면 바꿀 수 있다</span></div>${board(b,m.side,(slot)=>x.targets.includes(slot),(slot)=>`data-tgt="${slot}"`)}`:''}`}
     <div class="sec">지령 <span class="note">4식 · 선행 입력</span></div><div class="pool">${ORDER_KEYS.map((k,i)=>oNames[i]?`<div class="oc ${cur.order.type===k?'mine':''} ${(cnt['order_'+k]??1)<=0?'dis':''}" data-ord="${k}"><b>${esc(oNames[i])}</b><small>남은 ${cnt['order_'+k]??1}${cur.order.type===k&&cur.order.target?' · → '+esc(monName(b,cur.order.target)):''}</small></div>`:'').join('')}</div>
     ${cur.order.type?`<div class="row small" style="margin:4px 0 0 2px">대상: ${mons.map(mm=>`<span class="tgl ${cur.order.target===mm.id?'on':''}" data-ordt="${mm.id}">${esc(mm.name)}</span>`).join('')}</div>`:''}
     <div class="sec">명령 <span class="note">6령</span></div><div class="pool">${COMMAND_KEYS.map((k,i)=>cNames[i]?`<div class="oc ${cur.command.type===k?'mine':''} ${(cnt['command_'+k]??1)<=0?'dis':''}" data-cmd="${k}"><b>${esc(cNames[i])}</b><small>남은 ${cnt['command_'+k]??1}${cur.command.type===k&&cur.command.target?' · → '+esc(monName(b,cur.command.target)):''}</small></div>`:'').join('')}</div>
     ${cur.command.type?`<div class="row small" style="margin:4px 0 0 2px">대상: ${mons.map(mm=>`<span class="tgl ${cur.command.target===mm.id?'on':''}" data-cmdt="${mm.id}">${esc(mm.name)}</span>`).join('')}</div>`:''}
     <details class="adv"><summary>우선도 · 행동 순서 변경 (${esc(m.name)})</summary><div class="tgts">${allEntered(b).map(s=>`<label class="tg2">${s.area.toUpperCase()} ${esc(s.mon.name)} 우선 <input type="number" class="n" data-f="prio" data-mid="${m.id}" data-slot="${s.slot}" value="${x.prio[s.slot]??''}" placeholder="0"> 순서 <input type="number" class="n" data-f="ochg" data-mid="${m.id}" data-slot="${s.slot}" value="${x.ochg[s.slot]??''}" placeholder="20"></label>`).join('')}</div></details>
     <div class="row" style="margin-top:6px"><input type="text" data-f="detail" value="${esc(cur.detail)}" placeholder="상세 (포텐셜 선언, 자유 메모)" style="flex:1"></div>
    </div>
    <div class="cfoot"><div class="sum">${summ}</div><button class="btn" data-act="cmdsave" data-tid="${tid}">저장</button><button class="btn pri" data-act="ready" data-tid="${tid}">${ready[tid]?'준비 해제':'준비 완료'}</button></div></div>`}).join('');
  if(!blocks.trim())return '';
  loadPeek().then(pk=>{const el=document.getElementById('peekbox');if(!el||!pk)return;if(pk.turn!==(ctx().b.turn||0))return;el.innerHTML=`<div class="chip" style="border-color:var(--yel);padding:4px 10px">타임 결과 · ${esc(pk.name)}: <b>${esc(pk.text)}</b></div>`});
  return `<form id="cmdForm" class="cmdpanel" onsubmit="return false"><div id="peekbox"></div><div class="cmdtitle">지시 입력 <span class="dim small">${phase===0?'지시 준비 페이즈':'지금은 '+['','턴 개시','행동 순서','행동 처리','','턴 종료'][phase]+' — 입력은 저장만 된다'}</span></div>${blocks}</form>`}
 function rerenderCmd(){const old=$('#cmdForm');if(!old)return;const c=ctx();const tmp=document.createElement('div');tmp.innerHTML=cmdPanel(c,c.ST.state.ready||{});const nf=tmp.firstElementChild;if(!nf){old.remove();return}old.replaceWith(nf);nf.querySelectorAll('[data-act]').forEach(bt=>bt.onclick=()=>action(bt.dataset));bindCmdForm(nf,c)}
 function bindCmdForm(form,c){
  form.querySelectorAll('.cmdt').forEach(blk=>{const tid=blk.dataset.tid;const cur=CMD[tid];const mid=UIC.tab[tid];const x=cur.mons[mid];
   blk.querySelectorAll('[data-ctab]').forEach(el=>el.onclick=()=>{UIC.tab[tid]=el.dataset.ctab;rerenderCmd()});
   blk.querySelectorAll('[data-seg]').forEach(el=>el.onclick=()=>{if(el.dataset.seg==='switch'){x.move='switch';x.targets=[]}else{x.move='';x.targets=[]}rerenderCmd()});
   blk.querySelectorAll('[data-mv]').forEach(el=>el.onclick=()=>{x.move=el.dataset.mv;x.targets=defaultTargets(c.b,mid,el.dataset.mv);rerenderCmd()});
   blk.querySelectorAll('[data-sw]').forEach(el=>el.onclick=()=>{x.switch=el.dataset.sw;rerenderCmd()});
   blk.querySelectorAll('[data-tgt]').forEach(el=>el.onclick=()=>{const s=el.dataset.tgt;const i=x.targets.indexOf(s);if(i>=0)x.targets.splice(i,1);else x.targets.push(s);rerenderCmd()});
   blk.querySelectorAll('[data-ord]').forEach(el=>el.onclick=()=>{if(el.classList.contains('dis'))return;cur.order.type=cur.order.type===el.dataset.ord?'':el.dataset.ord;if(cur.order.type&&!cur.order.target)cur.order.target=mid;rerenderCmd()});
   blk.querySelectorAll('[data-ordt]').forEach(el=>el.onclick=()=>{cur.order.target=el.dataset.ordt;rerenderCmd()});
   blk.querySelectorAll('[data-cmd]').forEach(el=>el.onclick=()=>{if(el.classList.contains('dis'))return;cur.command.type=cur.command.type===el.dataset.cmd?'':el.dataset.cmd;if(cur.command.type&&!cur.command.target)cur.command.target=mid;rerenderCmd()});
   blk.querySelectorAll('[data-cmdt]').forEach(el=>el.onclick=()=>{cur.command.target=el.dataset.cmdt;rerenderCmd()});
   blk.querySelectorAll('[data-f]').forEach(el=>{const h=()=>{const f=el.dataset.f;const xm=cur.mons[el.dataset.mid]||x;if(f==='prio')xm.prio[el.dataset.slot]=el.value;if(f==='ochg')xm.ochg[el.dataset.slot]=el.value;if(f==='detail')cur.detail=el.value};el.addEventListener('input',h);el.addEventListener('change',h)})})}
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
   case 'usepot':case 'restorepot':{const m=b.mons[d.mid];if(!m||!canEdit(c,m))return;const L=potList(m);const p=L.find(x=>x.name===d.pot);if(!p)return;const u=Object.assign({},m.potUses||{});const cur=u[p.name]==null?p.max:+u[p.name];u[p.name]=d.act==='usepot'?Math.max(0,cur-1):Math.min(p.max,cur+1);
    await A().set(['battle','mons',d.mid,'potUses'],u);if(d.act==='usepot')A().sysLog(`${m.name} 『${p.name}』 사용 (남은 ${u[p.name]}/${p.max})`,'battle');return}
   case 'time':return requestTime(d.mid);
   case 'timeok':return grantTime(d.seat);
   case 'cmdsave':return saveCmd(d.tid,false);
   case 'ready':return toggleReady(d.tid);
   case 'cmdload':return loadCmd(d.tid);
   case 'reveal':return reveal();
   case 'order':return computeOrder();
   case 'turnend':return turnEnd();
   case 'resetcmd':if(!confirm('공개된 지시와 준비 상태를 지울까?'))return;CMD={};await A().set(['battle','cmds'],{});await A().set(['ready'],{});return}}

 /* 등장: 더블(2:2)이 기본. 트레이너가 둘이면 첫 트레이너 A, 둘째 B 가 기본 자리. 빈 자리가 아니면 고른다. */
 async function enterMon(mid,area){const c=ctx();const b=c.b;const m=b.mons[mid];if(!m||!canEdit(c,m))return;
  const ent=entered(b,m.side);const areas=AREAS.slice(0,mode(b));
  if(!area){const tids=((b.sides||{})[m.side]||{}).trainers||[];const pref=areas[Math.min(tids.indexOf(m.tid),areas.length-1)]||areas[0];
   const free=areas.filter(a=>!ent[a]);
   if(areas.length===1)area=areas[0];
   else if(!ent[pref])area=pref;
   else if(free.length)area=free[0];
   else{const md=A().openModal(`<div class="mhead"><h2>${esc(m.name)} 등장 — 에리어</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
     <div class="row">${areas.map(a=>`<button class="btn ${ent[a]?'ghost':'pri'}" data-area="${a}">${a.toUpperCase()}${ent[a]?' · '+esc(ent[a].name)+' 과 교대':' · 빈 자리'}</button>`).join('')}</div>`);
    md.querySelectorAll('[data-area]').forEach(bt=>bt.onclick=()=>{A().closeModal();enterMon(mid,bt.dataset.area)});return}}
  if(!areas.includes(area))return A().toast('그런 에리어가 없다');
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
  /* 지령·명령 횟수 차감 + 효과 자동 적용 */
  const trs=JSON.parse(JSON.stringify(b.trainers||{}));const mons=JSON.parse(JSON.stringify(b.mons||{}));const f=fieldOf(JSON.parse(JSON.stringify(b)));const fx=[];
  for(const tid in cmds){const t=trs[tid];if(!t)continue;t.orderCount=t.orderCount||{};const cm=cmds[tid];
   if(cm.order&&cm.order.type){const k='order_'+cm.order.type;t.orderCount[k]=(t.orderCount[k]??1)-1;fx.push(...applyOrder(mons,f,t,orderName(b,tid,'order',cm.order.type),cm.order.target))}
   if(cm.command&&cm.command.type){const k='command_'+cm.command.type;t.orderCount[k]=(t.orderCount[k]??1)-1;fx.push(...applyOrder(mons,f,t,orderName(b,tid,'command',cm.command.type),cm.command.target))}}
  await A().set(['battle','trainers'],trs);await A().set(['battle','mons'],mons);await A().set(['battle','field'],f);await A().set(['battle','cmds'],cmds);await A().set(['ready'],{});await A().set(['battle','phase'],1);
  /* 로그 카드 */
  const lines=[];for(const tid in cmds){const t=trs[tid];const cm=cmds[tid];
   for(const mid in cm.mons){const m=b.mons[mid];if(!m||!m.entry)continue;const x=cm.mons[mid];let s='';
    if(x.move==='switch')s=`교대 → ${monName(b,x.switch)}`;else if(x.move!==''&&x.move!=null){const mv=(m.moves||[])[+x.move];s=(mv?mv.name:'?')+(x.targets&&x.targets.length?' → '+x.targets.map(sl=>slotName(b,sl).replace(/<[^>]+>/g,'')).join(', '):'')}else s='(행동 없음)';
    lines.push(`${t.name} · ${m.name}: ${s}`)}
   if(cm.order&&cm.order.type)lines.push(`${t.name} 지령 「${orderName(b,tid,'order',cm.order.type)}」 → ${monName(b,cm.order.target)}`);
   if(cm.command&&cm.command.type)lines.push(`${t.name} 명령 「${orderName(b,tid,'command',cm.command.type)}」 → ${monName(b,cm.command.target)}`);
   if(cm.detail)lines.push(`${t.name}: ${cm.detail}`)}
  if(fx.length)lines.push('— 지령 효과: '+fx.join(' / '));
  A().sysLog('지시 공개\n'+lines.join('\n'),'battle')}

 /* 지령·명령 효과 (Lib:readymade 의 지령 레디메이드와 같은 내용). 랭크는 임시(턴 종료 해제). 플래그는 flags 에 두고 공격 창이 읽는다 */
 const STATWORD={공격:'attack',방어:'defense',특공:'specialattack',특방:'specialdefense',민첩:'speed',저격:'accuracy',회피:'evasion',스피드:'speed',명중:'accuracy'};
 function tempRank(m,k,d){m.rank=m.rank||{};m.tempRank=m.tempRank||{};m.rank[k]=Math.max(-6,Math.min(6,(+m.rank[k]||0)+d));m.tempRank[k]=(+m.tempRank[k]||0)+d}
 function applyOrder(mons,f,t,name,targetId){const out=[];const tgt=mons[targetId];const allies=Object.values(mons).filter(m=>m.side===t.side&&m.entry&&m.hp.cur>0);const enemies=Object.values(mons).filter(m=>m.side!==t.side&&m.entry&&m.hp.cur>0);
  const n=String(name||'');let m;
  if((m=n.match(/^(숙달|전개|방해)?(공격|방어|특공|특방|민첩|회복|저격|회피)지령$/))){const pre=m[1]||'',st=m[2];
   if(st==='회복'){if(tgt){const v=Math.max(1,Math.floor(tgt.hp.max/4));tgt.hp.cur=Math.min(tgt.hp.max,tgt.hp.cur+v);out.push(`${tgt.name} HP +${v}`)}return out}
   const k=STATWORD[st];
   if(pre==='방해'){for(const e of enemies){e.rank=e.rank||{};e.rank[k]=Math.max(-6,(+e.rank[k]||0)-1)}out.push(`상대 전체 ${st} −1`);return out}
   if(!tgt)return out;
   if(pre==='전개'){tgt.mod=tgt.mod||{};tgt.mod[k]=(+tgt.mod[k]||1)*2;tgt.tempMod=tgt.tempMod||{};tgt.tempMod[k]=(+tgt.tempMod[k]||1)*2;out.push(`${tgt.name} ${st} ×2`);return out}
   tempRank(tgt,k,1);out.push(`${tgt.name} ${st} +1`);return out}
  if((m=n.match(/^(검|방패|관|잔|날개)의 영창$/))){const k={검:'attack',방패:'defense',관:'specialattack',잔:'specialdefense',날개:'speed'}[m[1]];for(const a of allies)tempRank(a,k,1);out.push(`아군 전체 ${STAT_KO[k]} +1`);return out}
  if(n==='물리결계'||n==='특수결계'){f.objects[t.side]=f.objects[t.side]||{};f.objects[t.side][n==='물리결계'?'리플렉터':'빛의장막']=3;out.push(`${SIDE_KO[t.side]} ${n==='물리결계'?'리플렉터':'빛의장막'} 3T`);return out}
  if(n==='치유의 법계'){for(const a of allies){const v=Math.max(1,Math.floor(a.hp.max/4));a.hp.cur=Math.min(a.hp.max,a.hp.cur+v)}out.push('아군 전체 HP 1/4 회복');return out}
  if(n==='정화의 법계'){const db=(DB().states||{}).st||{};let c=0;for(const a of allies){for(const k in (a.states||{})){if(db[k]&&db[k].neg){delete a.states[k];c++}}}out.push(`아군 상태 이상 ${c}개 해제`);return out}
  if(n==='주인의 호령'){out.push('주인의 호령 — 효과는 손으로 (강화 1.5 또는 HP 1/2)');return out}
  /* 4식: 플래그 */
  const FLAG={'버텨라!':'endure','맞춰라!':'surehit','물러나!':'dodgePhys','피해라!':'dodgeSpec','바꿔라!':'swap','돌아와!':'return','지킬 수 없다!':'hitPhys','피할 수 없다!':'hitSpec','버틸 수 없다!':'noEndure','맞출 수 없다!':'acc0','주인의 칙령':'dodgeOnce','파계':'nullify','윤회의 법계':'rebirth'};
  if(FLAG[n]){if(tgt){tgt.flags=tgt.flags||{};tgt.flags[FLAG[n]]=1;out.push(`${tgt.name} 「${n}」`)}else out.push(`「${n}」 (대상 없음)`);return out}
  out.push(`「${n}」 — 손으로 처리`);return out}

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
   if(m.tempMod){for(const k in m.tempMod){m.mod[k]=Math.round(((+m.mod[k]||1)/(+m.tempMod[k]||1))*1000)/1000;if(m.mod[k]===1)delete m.mod[k]}delete m.tempMod}
   if(m.flags)delete m.flags;
   m.started=false}
  for(const mid in b.mons){delete b.mons[mid].flags}
  const dec=(o,k)=>{if(o[k]>0){o[k]--;if(o[k]<=0){delete o[k];return true}}return false};
  if(f.weather.type&&f.weather.count>0){f.weather.count--;if(f.weather.count<=0){lines.push(`날씨 ${f.weather.type} 끝`);f.weather={type:'',count:0}}}
  if(f.terrain.type&&f.terrain.count>0){f.terrain.count--;if(f.terrain.count<=0){lines.push(`${f.terrain.type} 끝`);f.terrain={type:'',count:0}}}
  for(const k of ROOMS)if(dec(f.rooms,k))lines.push(`${k} 끝`);for(const k of ETC)if(dec(f.etc,k))lines.push(`${k} 끝`);
  for(const s of SIDES){f.objects[s]=f.objects[s]||{};for(const k in f.objects[s])if(dec(f.objects[s],k))lines.push(`${SIDE_KO[s]} ${k} 끝`)}
  b.field=f;b.cmds={};b.order=[];b.phase=0;b.turn=(+b.turn||0)+1;CMD={};
  await A().set(['battle'],b);await A().set(['ready'],{});
  A().sysLog(`턴 종료 처리${lines.length?'\n'+lines.join('\n'):''}\n— 턴 ${b.turn} 지시 준비`,'battle')}

 /* ---------- 타임 (상대 지시 엿보기): 좌석이 요청 → GM 허가 → 비밀 칸(peek)으로 전달 ---------- */
 function timeCount(t){const lt=((DB().const||{}).lists||{}).list_time_count||{E:0,D:0,C:0,B:0,A:1,AA:2,AAA:2,S:2};const r=S().strip((t.ranks||{})['지시']);return +(lt[r]||0)}
 async function requestTime(mid){const c=ctx();const b=c.b;const m=b.mons[mid];if(!m)return;const my=c.gm?null:c.seat;const t=b.trainers[my];
  if(!c.gm){if(!t)return;const used=+(t.timeUsed||0);if(used>=timeCount(t))return A().toast('타임 횟수가 없다');if(!confirm(`${m.name} 의 지시를 엿볼까? (타임 ${used+1}/${timeCount(t)})`))return;
   await A().set(['pub',my,'time'],{mid,at:Date.now()});A().sysLog(`${t.name} 「타임」 요청 → ${m.name}`,'chat');return}
  /* GM 은 바로 본다 */
  const rows=await DBS().secretGet(c.ST.room,c.ST.secret,'cmd');const r=(rows||[]).find(x=>x.id===m.tid);const x=r&&r.data&&r.data.mons&&r.data.mons[mid];
  A().openModal(`<div class="mhead"><h2>타임 — ${esc(m.name)}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="pre">${esc(x?describeCmd(b,m,x):'아직 저장된 지시가 없다')}</div>`)}
 function describeCmd(b,m,x){if(!x)return '(없음)';if(x.move==='switch')return `교대 → ${monName(b,x.switch)}`;if(x.move===''||x.move==null)return '(행동 없음)';const mv=(m.moves||[])[+x.move];return `${mv?mv.name:'?'}${x.targets&&x.targets.length?' → '+x.targets.map(sl=>slotName(b,sl).replace(/<[^>]+>/g,'')).join(', '):''}`}
 async function grantTime(seat){const c=ctx();if(!c.gm)return;const b=c.b;const req=((c.ST.state.pub||{})[seat]||{}).time;if(!req)return;const m=b.mons[req.mid];const t=b.trainers[seat];
  const rows=await DBS().secretGet(c.ST.room,c.ST.secret,'cmd');const r=(rows||[]).find(x=>x.id===(m||{}).tid);const x=r&&r.data&&r.data.mons&&r.data.mons[req.mid];
  await DBS().secretPut(c.ST.room,c.ST.secret,'peek',seat,{mid:req.mid,name:m?m.name:'?',text:m?describeCmd(b,m,x):'?',turn:b.turn||0,at:Date.now()});
  await A().set(['pub',seat,'time'],null);if(t){await A().set(['battle','trainers',seat,'timeUsed'],(+t.timeUsed||0)+1)}
  A().sysLog(`GM: ${t?t.name:seat} 의 「타임」 허가 (${m?m.name:'?'})`,'battle')}
 async function loadPeek(){const c=ctx();if(c.gm||!c.seat)return null;try{const rows=await DBS().secretGet(c.ST.room,c.ST.secret,'peek');const r=(rows||[]).find(x=>x.id===c.seat);return r?r.data:null}catch(e){return null}}

 /* ---------- 랭크·상태 편집 ---------- */
 function openEdit(mid){const c=ctx();const b=c.b;const m=b.mons[mid];if(!m||!canEdit(c,m))return;
  const sdb=DB().states||{st:{},groups:[]};const items=Object.keys(DB().items||{});
  const md=A().openModal(`<div class="mhead"><h2>${esc(m.name)} <span class="small dim">랭크·상태·소지품</span></h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="row" style="margin-bottom:8px"><b>HP</b> <input type="number" id="ehp" value="${m.hp.cur}" style="width:90px"> / ${m.hp.max} <button class="btn sm" id="ehpfull">전부 회복</button><span class="sp"></span><label><input type="checkbox" id="etera" ${m.teraActive?'checked':''}> 테라스탈 ${esc(m.tera)}</label></div>
   <div class="rankgrid">${Object.keys(STAT_KO).map(k=>`<div class="rkrow"><span>${STAT_KO[k]}</span><button class="btn xs" data-rk="${k}" data-d="-1">−</button><b class="mono" id="rk_${k}">${(+m.rank[k]||0)>0?'+':''}${+m.rank[k]||0}</b><button class="btn xs" data-rk="${k}" data-d="1">＋</button>
     <input type="number" step="0.01" class="n" data-mod="${k}" value="${(m.mod||{})[k]!=null&&(m.mod||{})[k]!==1?(m.mod||{})[k]:''}" placeholder="×1" title="배율(mod)"></div>`).join('')}</div>
   <div class="row small" style="margin:6px 0"><label><input type="checkbox" id="etemp"> 이번 변경을 임시 랭크로 (턴 종료 때 해제)</label><button class="btn xs ghost" id="erk0">랭크 전부 0</button></div>
   <div class="row" style="margin:8px 0"><b>소지품</b> <input type="text" id="eitem" list="itemlist" value="${esc(m.item||'')}" style="flex:1"><button class="btn sm" id="eitemdb" type="button">DB</button><datalist id="itemlist">${items.map(i=>`<option value="${esc(i)}">`).join('')}</datalist>
    ${c.gm?`<b>레이드</b> <input type="number" class="n" id="eraid" value="${(m.raid&&m.raid.segments)||''}" placeholder="구간 X" title="최대 HP 를 X 등분한 자리마다 배리어"><span class="small dim">${m.raid&&m.raid.segments?`페이즈 ${m.raid.phase||1} · 깨짐 ${m.raid.broken||0}`:''}</span>`:''}</div>
   <div class="stgroups">${(sdb.groups||[]).map(g=>`<div class="stg"><div class="stgl">${esc(g.l)}</div>${g.s.map(k=>{const d=sdb.st[k]||{ko:k};const v=(m.states||{})[k];return `<label class="stt ${v?'on':''}" title="${esc((d.desc||[]).join(' '))}"><input type="checkbox" data-st="${k}" ${v?'checked':''}>${esc(d.ko)}${d.prog==='turn'||d.prog==='move'?`<input type="number" class="n xs" data-stc="${k}" value="${v&&v<1000?v:(d.min<1000?d.min:'')}" placeholder="T">`:''}</label>`}).join('')}</div>`).join('')}</div>
   <div class="row" style="margin-top:12px"><span class="sp"></span><button class="btn pri" id="esave">적용</button></div>`);
  const rank=Object.assign({},m.rank);const delta={};
  md.querySelectorAll('[data-rk]').forEach(bt=>bt.onclick=()=>{const k=bt.dataset.rk;const lim=k==='critical'?4:6;rank[k]=Math.max(-lim,Math.min(lim,(+rank[k]||0)+(+bt.dataset.d)));delta[k]=(delta[k]||0)+(+bt.dataset.d);$('#rk_'+k,md).textContent=(rank[k]>0?'+':'')+rank[k]});
  $('#erk0',md).onclick=()=>{for(const k in STAT_KO){rank[k]=0;$('#rk_'+k,md).textContent='0'}};
  $('#ehpfull',md).onclick=()=>{$('#ehp',md).value=m.hp.max};
  $('#eitemdb',md).onclick=()=>{window.OM_DB_UI.open({kind:'item',sel:$('#eitem',md).value,pick:async name=>{const it=(DB().items||{})[name]||{};await A().set(['battle','mons',mid,'item'],name);await A().set(['battle','mons',mid,'itemEff'],String(it.eff||''));openEdit(mid)}})};
  $('#esave',md).onclick=async()=>{const nm=JSON.parse(JSON.stringify(m));nm.hp.cur=Math.max(0,Math.min(m.hp.max,+$('#ehp',md).value||0));nm.rank=rank;nm.teraActive=$('#etera',md).checked;nm.item=$('#eitem',md).value.trim();
   nm.mod={};md.querySelectorAll('[data-mod]').forEach(i=>{if(i.value!==''&&+i.value!==1)nm.mod[i.dataset.mod]=+i.value});
   const er=$('#eraid',md);if(er){const X=+er.value||0;if(!X)delete nm.raid;else if(!nm.raid||nm.raid.segments!==X)nm.raid={segments:X,broken:0,phase:1}}
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

 /* 레이드 배리어: 최대 HP × k/X 자리마다 하한. 깨진 것(broken) 아래로 내려간다 */
 function raidFloor(m){if(!m||!m.raid||!(+m.raid.segments>0))return 0;const X=+m.raid.segments,br=+m.raid.broken||0;let fl=0;for(let k=X-1-br;k>=1;k--){const v=Math.floor(m.hp.max*k/X);if(v<m.hp.cur){fl=v;break}}return fl}
 /* ---------- 공격 ---------- */
 function openAttack(mid){const c=ctx();const b=c.b;const atk=b.mons[mid];if(!atk||!canEdit(c,atk))return;const f=fieldOf(b);
  const x=(((b.cmds||{})[atk.tid]||{}).mons||{})[mid]||{};const slots=allEntered(b);
  const defMoveIdx=x.move!==''&&x.move!=='switch'&&x.move!=null?+x.move:0;
  const md=A().openModal(`<div class="mhead"><h2>공격 — ${esc(atk.name)}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <select id="amove" hidden>${(atk.moves||[]).map((mv,i)=>`<option value="${i}" ${i===defMoveIdx?'selected':''}>${esc(mv.name)}</option>`).join('')}</select>
   <div class="sec">기술</div><div class="mvg" id="amvg">${(atk.moves||[]).map((mv,i)=>moveCard(mv,i,i===defMoveIdx,`data-amv="${i}"`)).join('')}</div>
   <div class="row small" style="margin-top:6px"><label>위력 <input type="number" class="n" id="apow"></label><label>명중 배율 <input type="number" step="0.01" class="n" id="aacc" value="1"></label><span id="amef" class="dim"></span></div>
   <div class="sec">대상 <span class="note">누르면 고르고 푼다</span></div><div id="aboard">${board(b,atk.side,(slot)=>(x.targets||[]).includes(slot),(slot)=>`data-at="${slot}"`)}</div>
   <div hidden>${slots.map(s=>`<input type="checkbox" data-t="${s.slot}" ${(x.targets||[]).includes(s.slot)?'checked':''}>`).join('')}</div>
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
  const mvSel=$('#amove',md);
  const syncBoard=()=>{md.querySelectorAll('[data-at]').forEach(t=>{const cb=md.querySelector(`[data-t="${t.dataset.at}"]`);t.classList.toggle('on',!!(cb&&cb.checked));const tk=t.querySelector('.tk');if(tk)tk.textContent=cb&&cb.checked?'✓':''})};
  md.querySelectorAll('[data-at]').forEach(t=>t.onclick=()=>{const cb=md.querySelector(`[data-t="${t.dataset.at}"]`);if(cb){cb.checked=!cb.checked;syncBoard()}});
  md.querySelectorAll('[data-amv]').forEach(cd=>cd.onclick=()=>{mvSel.value=cd.dataset.amv;md.querySelectorAll('[data-amv]').forEach(q=>q.classList.toggle('on',q===cd));syncMove()});
  const syncMove=()=>{const mv=(atk.moves||[])[+mvSel.value]||{};$('#apow',md).value=mv.pow||0;$('#amef',md).textContent=mv.eff||'';const wm=WEATHER_MUL[f.weather.type]||{};$('#aweather',md).value=wm[mv.typeEn]!=null?wm[mv.typeEn]:1;
   let fm=1;const ft=f.terrain.type;if(ft==='그래스필드'&&mv.typeEn==='Grass')fm=1.3;if(ft==='일렉트릭필드'&&mv.typeEn==='Electric')fm=1.3;if(ft==='사이코필드'&&mv.typeEn==='Psychic')fm=1.3;if(ft==='미스트필드'&&mv.typeEn==='Dragon')fm=0.5;$('#afield',md).value=fm;
   const dflt=defaultTargets(b,mid,String(mvSel.value));if(x.move==null||x.move===''||+x.move!==+mvSel.value){md.querySelectorAll('[data-t]').forEach(cb=>cb.checked=dflt.includes(cb.dataset.t))}syncBoard()};
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
    const AF=atk.flags||{},DF=def.flags||{};const phys=mv.cat==='물리',spec=mv.cat==='특수';
    const sure=ck('asure')||AF.surehit||(phys&&AF.hitPhys)||(spec&&AF.hitSpec);
    const autoMiss=(phys&&DF.dodgePhys)||(spec&&DF.dodgeSpec)||AF.acc0;
    const acc=autoMiss?{sure:false,hit:false,target:0,roll:0,acc:0,eva:0,note:'지령으로 회피/명중 0'}:B().accuracy(atk,def,{acc:mv.acc},{accMult:n('aacc'),sureHit:sure,starry:f.weather.type==='별하늘',fog:f.weather.type==='짙은안개',fogImmune:moveTypes.some(t=>t==='Poison'||t==='Fairy'),gravity:(f.etc||{})['중력']>0,wideLens:atk.item==='광각렌즈'});
    let hits=[];if(acc.hit){const cnt=n('ahits')||B().multiHits(mv,{skillLink:ck('askill')});const stage=B().critStage(atk,def,{input:n('acrit'),order:n('acritord')});
     for(let i=0;i<cnt;i++){const cr=B().critical(stage,{type:+g('acrittype').value,forced:ck('acritforce')});hits.push({v:cr.crit?2:1,cr,stage})}}
    const objs=(f.objects||{})[side]||{};const wall={};for(const k in WALLS)if(objs[k]>0)wall[WALLS[k]]=1;
    const dmg=mv.cat==='변화'||!(+g('apow').value)?null:B().damage(atk,def,Object.assign({},mv,{pow:+g('apow').value}),{hits:hits.map(h=>h.v),free1:n('afree1'),free2:n('afree2'),item1:n('aitem1'),item2:n('aitem2'),trait:n('atrait'),weather:n('aweather'),fieldMul:n('afield'),helping:ck('ahelp'),charge:ck('acharge'),lifeOrb:ck('alife'),multiTarget,wall,wallSize:mode(b)>=2?2:1,atkStat:g('aatk').value||undefined,defStat:g('adef').value||undefined,ignoreAtk:+g('aigatk').value,ignoreDef:+g('aigdef').value,watersport:(f.etc||{})['물놀이']>0,mudsport:(f.etc||{})['흙놀이']>0,scarf:atk.item==='구애스카프',choiceDef:['구애머리띠','구애안경'].includes(def.item||'')&&false,tailwindDef:((f.objects||{})[side]||{})['순풍']>0,swampDef:((f.objects||{})[side]||{})['습원']>0});
    const eff=dmg?B().effectiveness(moveTypes,def,{multiMode:+g('amulti').value,atkTypes,force:g('aforce').value===''?null:+g('aforce').value,floating:(def.states||{}).MagnetRise||(def.states||{}).Telekinesis}):null;
    const stab=eff?eff.stab:false;
    const guard0=DF.endure?0.5:1;const endure0=!!DF.endure&&!AF.noEndure;
    const hp=dmg?B().hpDamage(def,dmg.total,eff.value,{stab,adaptability:ck('aadapt'),expertBelt:ck('abelt'),guard:guard0,endure:endure0,hpFloor:raidFloor(def)}):null;
    res.push({slot,def,acc,hits,dmg,eff,stab,hp,guard:guard0,endure:endure0,manual:1})}
   RESULT={mv,targets:res,moveTypes};
   $('#ares',md).innerHTML=`<table class="t"><tr><th>대상</th><th>명중</th><th>급소</th><th>대미지(상성 전)</th><th>상성</th><th>보정</th><th>최종</th></tr>${res.map((r,i)=>`<tr>
    <td class="nw"><div class="row" style="gap:6px;flex-wrap:nowrap"><div class="ti sm" style="${r.def.image?`background-image:url('${r.def.image}')`:''}"></div><div><b>${esc(r.def.name)}</b><div class="small dim">HP ${r.def.hp.cur}/${r.def.hp.max}</div></div></div></td>
    <td>${r.acc.sure?'필중':(r.acc.hit?'<b style="color:var(--ok)">명중</b>':'<b style="color:var(--red)">빗나감</b>')+`<div class="small dim">${r.acc.note?esc(r.acc.note):r.acc.roll+' / '+r.acc.target}</div>`}</td>
    <td>${r.hits.map(h=>h.v===2?`<b style="color:var(--red)">급소</b>`:'-').join('<br>')}<div class="small dim">${r.hits.map(h=>h.cr.roll+'/'+h.cr.chance).join('<br>')}</div></td>
    <td>${r.dmg?`<b class="mono">${r.dmg.total}</b> <span class="small dim">(${r.dmg.min}~${r.dmg.max}${r.hits.length>1?' · '+r.hits.length+'회':''})</span>`:'-'}</td>
    <td>${r.eff?`<b>×${r.eff.value}</b> <span class="small dim">${esc(S().typeKo(r.eff.type))}${r.stab?' · 자속':''}</span>`:'-'}</td>
    <td>${r.dmg?`<label class="small">버텨라/방호 <input type="number" step="0.01" class="n xs" data-guard="${i}" value="${r.guard}"></label> <label class="small">수동 <input type="number" step="0.01" class="n xs" data-manual="${i}" value="1"></label> <label class="small"><input type="checkbox" data-berry="${i}"> 반감열매</label> <label class="small"><input type="checkbox" data-endure="${i}" ${r.endure?'checked':''}> 버티기</label>${raidFloor(r.def)?`<div class="small" style="color:var(--yel)">레이드 배리어 하한 ${raidFloor(r.def)}</div>`:''}`:''}</td>
    <td><b class="mono" id="fin_${i}">${r.hp&&r.acc.hit?r.hp.final:0}</b><div class="small dim" id="aft_${i}">→ ${r.hp&&r.acc.hit?r.hp.after:r.def.hp.cur}</div></td></tr>`).join('')}</table>
    <div class="small dim" style="margin-top:4px">${esc(mv.name)} · L${atk.lv} 위력 ${g('apow').value} · ${res[0]&&res[0].dmg?`공격 ${Math.round(res[0].dmg.hits[0]?res[0].dmg.hits[0].A:0)} / 방어 ${Math.round(res[0].dmg.hits[0]?res[0].dmg.hits[0].D:0)} · M ${res[0].dmg.M} · 벽 ${res[0].dmg.wall}`:''}</div>`;
   const recompute=()=>{res.forEach((r,i)=>{if(!r.dmg)return;const gd=md.querySelector(`[data-guard="${i}"]`),mn=md.querySelector(`[data-manual="${i}"]`),br=md.querySelector(`[data-berry="${i}"]`),en=md.querySelector(`[data-endure="${i}"]`);
     r.hp=B().hpDamage(r.def,r.dmg.total,r.eff.value,{stab:r.stab,adaptability:ck('aadapt'),expertBelt:ck('abelt'),guard:+gd.value||1,manual:+mn.value||1,berryHalf:br.checked,endure:en.checked,hpFloor:raidFloor(r.def)});
     $('#fin_'+i,md).textContent=r.acc.hit?r.hp.final:0;$('#aft_'+i,md).textContent='→ '+(r.acc.hit?r.hp.after:r.def.hp.cur)})};
   md.querySelectorAll('[data-guard],[data-manual],[data-berry],[data-endure]').forEach(el=>el.addEventListener('input',recompute));
   $('#aapply',md).disabled=false};
  $('#aapply',md).onclick=async()=>{if(!RESULT)return;const nb=JSON.parse(JSON.stringify(ctx().b));const lines=[];
   for(const r of RESULT.targets){const def=nb.mons[r.def.id];if(!def)continue;const hitTxt=r.acc.sure?'필중':r.acc.hit?`명중(${r.acc.roll}/${r.acc.target})`:`빗나감(${r.acc.roll}/${r.acc.target})`;
    if(!r.acc.hit){lines.push(`→ ${def.name}: ${hitTxt}`);continue}
    if(!r.dmg){lines.push(`→ ${def.name}: ${hitTxt} (변화기)`);continue}
    const dmgv=r.hp.final;def.hp.cur=Math.max(0,def.hp.cur-dmgv);def.hpOdd=!def.hpOdd;
    if(def.raid&&def.raid.segments>0){const fl=raidFloor(r.def);if(fl&&def.hp.cur<=fl){def.raid.broken=(def.raid.broken||0)+1;def.raid.phase=(def.raid.phase||1)+1;lines.push(`${def.name} 배리어 파괴! → 페이즈 ${def.raid.phase}`)}}
    lines.push(`→ ${def.name}: ${hitTxt} ${r.hits.some(h=>h.v===2)?'급소! ':''}${r.hits.length>1?r.hits.length+'회 ':''}${r.dmg.total}×${r.eff.value}${r.stab?'×자속':''} = ${dmgv} → HP ${def.hp.cur}/${def.hp.max}${def.hp.cur<=0?' 빈사!':''}`);
    if(def.hp.cur<=0)def.entry=''}
   if($('#alife',md).checked&&RESULT.targets.some(r=>r.acc.hit&&r.dmg)){const a=nb.mons[mid];const rec=Math.max(1,Math.floor(a.hp.max/10));a.hp.cur=Math.max(0,a.hp.cur-rec);lines.push(`${atk.name} 생명의구슬 반동 −${rec} → ${a.hp.cur}`);if(a.hp.cur<=0)a.entry=''}
   A().closeModal();if(await A().set(['battle','mons'],nb.mons))A().sysLog(`${atk.name}의 ${RESULT.mv.name}!\n${lines.join('\n')}`,'battle')}}

 return {render,ctx,entered,allEntered,fieldOf,resetLocal:()=>{CMD={}}};
})();
