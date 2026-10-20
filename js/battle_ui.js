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
 /* 설치기 분류 (맵툴 레디메이드 생성기의 나눔): 이름, 기본 지속, 설명 */
 const OBJ_CAT=[['wall','벽·장막',5,'5턴',['리플렉터','빛의장막','오로라베일','신비의부적','흰안개','주술','검은숲']],['aid','진영 효과',4,'4턴',['얼음의장벽','신기루','순풍','무지개','습원','불바다','돌격']],['hazA','설치기 A',1000,'땅 위 포켓몬만 · 등장 때',['압정뿌리기','독압정','지뢰원','끈적끈적네트','기뢰']],['hazB','설치기 B',1000,'모든 포켓몬 · 등장 때',['트램펄린','스텔스록','불기둥','장미원','가시원','얼음꼬챙이','전기발판','아이스번','저주의묘','악의소굴','전파탑']],['etc','기타',2,'',['희망사항','이때다!']]];
 const objCat=name=>OBJ_CAT.find(c=>c[4].includes(name))||OBJ_CAT[4];
 const WALLS={리플렉터:'reflector',빛의장막:'lightscreen',얼음의장벽:'icewall',오로라베일:'aurora'};
 const slotOf=(side,area)=>side+'_'+area;
 const lists=()=>((DB().const||{}).lists||{});
 const csv=s=>String(s||'').split(',').map(x=>x.trim()).filter(Boolean);
 const IMG=()=>((DB().img)||{state:{},field:{}});
 const W_IMG={맑음:'weather_Sunny',비:'weather_Rainy',모래바람:'weather_Sandstorm',싸라기눈:'weather_Snowstorm',눈:'weather_Snow',짙은안개:'weather_FoggyMist',밤:'weather_Night',별하늘:'weather_StarryNight',큰가뭄:'weather_Sunny_extreme',폭우:'weather_Rainy_extreme',난기류:'weather_StrongWinds',극한:'weather_Snow_extreme',깊은밤:'weather_Night_extreme'};
 const T_IMG={그래스필드:'field_object_grass',일렉트릭필드:'field_object_electric',미스트필드:'field_object_mist',사이코필드:'field_object_psycho',트릭룸:'room_trick',매직룸:'room_magic',원더룸:'room_wonder',블랙룸:'room_black',중력:'object_gravity',물놀이:'object_watersport',흙놀이:'object_mudsport'};
 const fimg=k=>IMG().field[k]?`img/field/${IMG().field[k]}`:'';const simg=k=>IMG().state[k]?`img/state/${IMG().state[k]}`:'';

 /* ---------- 상태 읽기 도우미 ---------- */
 /* mgr: 배틀 진행 권한 — GM, 그리고 방 설정 「플레이어도 배틀 진행」이 켜져 있으면 자리에 앉은 사람 모두 (모의전). 비밀(상대 지시 엿보기·강제·모두 공개)은 여전히 GM 만 */
 function plBattle(){const rp=A().ST.state.rp||{};return rp.plBattle!==false}
 /* 방 설정 (GM 이 rp 에 둔다, 서버 om_set_state 가 같은 값으로 막는다)
    strict = rp.seatOwn  : 플레이어는 자기 트레이너·포켓몬·지시만 바꾼다 → 배틀 진행(턴·페이즈·필드)은 GM 만
    fair   = rp.gmHands===false : GM 도 플레이어의 지시·준비를 바꾸지 않고, 플레이어 포켓몬의 HP·랭크·상태 창을 열지 않는다 (자동 처리는 그대로) */
 function ctx(){const ST=A().ST;const b=ST.state.battle||{};const gm=ST.role==='gm';const rp=ST.state.rp||{};const strict=rp.seatOwn===true,fair=rp.gmHands===false;
  return {ST,b,role:ST.role,seat:ST.seat,gm,strict,fair,mgr:gm||(ST.role==='seat'&&plBattle()&&!strict)}}
 function seatOwned(c,tid){return !!tid&&!!((c.ST.state.seats||{})[tid])}
 const turnKey=b=>String(+b.turn||0);
 function mode(b){return Math.max(1,Math.min(3,+b.mode||2))}  /* 기본 더블(2:2) */
 function entered(b,side){const out={};for(const a of AREAS.slice(0,mode(b))){const m=Object.values(b.mons||{}).find(x=>x.side===side&&x.entry===a&&x.hp.cur>0);out[a]=m||null}return out}
 function allEntered(b){const out=[];for(const s of SIDES){const e=entered(b,s);for(const a in e)if(e[a])out.push({slot:slotOf(s,a),side:s,area:a,mon:e[a]})}return out}
 /* 내 지시 칸 · 내 포켓몬 편집은 GM 과 그 자리의 주인만 — 모의전 권한(mgr)과는 별개 */
 function myTrainers(c){const trs=c.b.trainers||{};if(c.gm)return Object.keys(trs).filter(t=>!(c.fair&&seatOwned(c,t)));return c.seat&&trs[c.seat]?[c.seat]:[]}
 function canEdit(c,mon){if(mon&&mon.tid===c.seat&&c.role==='seat')return true;return c.gm&&!(c.fair&&mon&&seatOwned(c,mon.tid))}
 function skPend(c,tid){try{const K=c.ST.state.skill||{};const O=K.offer;if(!O)return false;const R=(K.res||{})[tid];return !(R&&R.offerId===O.id)}catch(e){return false}}
 function fieldOf(b){return Object.assign({weather:{type:'',count:0},terrain:{type:'',count:0},rooms:{},etc:{},objects:{left:{},right:{}}},b.field||{})}
 function typeChip(en){return A().typeChip(en)}
 function monName(b,mid){const m=(b.mons||{})[mid];return m?m.name:'?'}

 /* ---------- 렌더 ---------- */
 function render(el){
  const c=ctx();const b=c.b;const f=fieldOf(b);const ready=c.ST.state.ready||{};
  const phases=[[0,'지시 준비'],[1,'턴 개시·공개'],[2,'행동 순서'],[3,'행동 처리'],[5,'턴 종료']];
  const chips=[f.weather.type?`날씨 ${f.weather.type}${f.weather.count?' '+f.weather.count+'T':''}`:'',f.terrain.type?`${f.terrain.type}${f.terrain.count?' '+f.terrain.count+'T':''}`:'',...ROOMS.filter(r=>(f.rooms||{})[r]>0).map(r=>`${r} ${f.rooms[r]}T`),...ETC.filter(r=>(f.etc||{})[r]>0).map(r=>`${r} ${f.etc[r]}T`)].filter(Boolean);
  const mySide=c.mgr?'left':((b.trainers||{})[c.seat]||{}).side||'left';const top=mySide==='left'?'right':'left';
  el.innerHTML=`
  <div class="bstat">
   <div class="turn ${c.mgr?'clickable':''}" ${c.mgr?'data-act="turnset" title="눌러서 턴 번호 조정"':''}><span class="tlab">TURN</span><span class="tnum">${b.turn||0}</span></div>
   <div class="phases">${phases.map(([p,n])=>`<button class="ph ${(+b.phase||0)===p?'on':''}" data-phase="${p}" ${c.mgr?'':'disabled'}>${n}</button>`).join('')}</div>
   <span class="sp"></span>${window.OM_RP_UI&&window.OM_RP_UI.bgmWidgetHtml?window.OM_RP_UI.bgmWidgetHtml():''}
   ${c.mgr?`<div class="gmrow"><label>에리어 <select data-act="mode">${[1,2,3].map(n=>`<option value="${n}" ${mode(b)===n?'selected':''}>${n}</option>`).join('')}</select></label>
    ${!b.started?`<button class="btn sm pri" data-act="start" title="연출(VS/경고)과 함께 시합을 시작한다. 동시 내밀기가 켜져 있으면 예약한 포켓몬이 한꺼번에 나온다">시합 개시</button>`:''}<label class="small" title="켜면 「등장」 대신 「내밀기 예약」을 하고, GM 의 「시합 개시」·「내밀기 실행」 때 양쪽이 동시에 나온다"><input type="checkbox" data-act="simul" ${b.simul?'checked':''}> 동시 내밀기</label>${b.simul?pendStatus(b):''}${b.simul&&b.started&&Object.values(b.mons||{}).some(m=>m.pend)?`<button class="btn sm" data-act="pendgo">내밀기 실행 (${Object.values(b.mons||{}).filter(m=>m.pend).length})</button>`:''}
    <button class="btn sm pri" data-act="progress" title="지시 준비 → 턴 개시 → 행동 순서 → 행동 처리 → 턴 종료 → 다음 턴">턴 진행 ▶ ${['턴 개시','행동 순서','행동 처리','','','턴 종료'][+b.phase||0]||''}</button>${c.gm&&(+b.phase||0)===1?'<button class="btn sm ghost" data-act="reveal" title="아직 안 연 지시를 한꺼번에">모두 공개</button>':''}<button class="btn sm" data-act="field">필드</button>
    <button class="btn sm ghost" data-act="resetcmd">지시 초기화</button><button class="btn sm ghost danger" data-act="clear">배틀 비우기</button>
    ${Object.entries(c.ST.state.pub||{}).filter(([k,v])=>v&&v.time).map(([k,v])=>`<span class="chip" style="border-color:var(--yel)">타임 요청: ${esc((b.trainers[k]||{}).name||k)} → ${esc(monName(b,v.time.mid))} <button class="btn xs pri" data-act="timeok" data-seat="${k}">허가</button></span>`).join('')}</div>`:''}
  </div>
  ${revealStrip(c,ready)}
  <div class="stadium">
   ${benchRow(c,'left',ready)}
   <div class="fieldcol">${areaGrid(c)}${fieldStrip(c,f)}</div>
   ${benchRow(c,'right',ready)}
  </div>
  ${orderBox(c)}
  ${cmdPanel(c,ready)}`;
  el.querySelectorAll('[data-phase]').forEach(bt=>bt.onclick=()=>setPhase(+bt.dataset.phase));autoAdvance();
  if(window.OM_RP_UI&&window.OM_RP_UI.bindBgmWidget)window.OM_RP_UI.bindBgmWidget(el);
  el.querySelectorAll('[data-act]').forEach(bt=>{if(bt.tagName==='SELECT')bt.onchange=()=>action(bt.dataset,bt.value);else if(bt.type==='checkbox')bt.onchange=()=>action(bt.dataset,bt.checked);else bt.onclick=()=>action(bt.dataset)});
  el.querySelectorAll('[data-mon]').forEach(cd=>cd.onclick=e=>{if(e.target.closest('[data-act]'))return;A().openMon(cd.dataset.mon)});
  const form=$('#cmdForm',el);if(form)bindCmdForm(form,c)}
 document.addEventListener('click',e=>{const t=e.target.closest('.mvdb');if(!t)return;e.stopPropagation();e.preventDefault();if(document.querySelector('.modalbg')&&!document.querySelector('.dbmodal'))return;window.OM_DB_UI.open({kind:'move',sel:t.dataset.mvdb})},true);

 /* 턴 개시 뒤 맨 위: 지시 공개 UI (맵툴 open_command). 자기 것(GM 은 모두)은 버튼, 남의 것은 현황. 지령·명령은 공개하지 않고 「4식 6령」 창에서 발동한다 */
 /* 동시 내밀기 현황: 진영마다 예약 수 / 에리어 수. 양쪽 다 차면 「완료」 */
 function pendCount(b,side){const ids=((b.sides||{})[side]||{}).trainers||[];const ms=Object.values(b.mons||{}).filter(m=>ids.includes(m.tid));const need=Math.min(mode(b),ms.filter(m=>m.hp.cur>0).length);return {n:ms.filter(m=>m.pend).length,need}}
 function pendStatus(b){const L=pendCount(b,'left'),R=pendCount(b,'right');const done=L.need>0&&R.need>0&&L.n>=L.need&&R.n>=R.need;return `<span class="chip ${done?'on':''}" title="동시 내밀기 예약">예약 좌 ${L.n}/${L.need} · 우 ${R.n}/${R.need}${done?' — 완료!':''}</span>`}
 function revealStrip(c,ready){const b=c.b;const ph=+b.phase||0;if(ph<1)return '';const mine=myTrainers(c);
  const rows=Object.keys(b.trainers||{}).map(tid=>{const t=b.trainers[tid];const mons=Object.values(b.mons||{}).filter(m=>m.tid===tid&&m.entry&&m.hp.cur>0).sort((x,y)=>x.entry.localeCompare(y.entry));if(!mons.length)return '';const my=mine.includes(tid);
   return `<span class="rs ${my?'my':''}"><b>${esc(t.name)}</b>${mons.map(m=>revealed(b,tid,m.id)?`<i class="ok" title="${esc(m.name)}">${String(m.entry).toUpperCase()} ✓</i>`:my&&ph===1?`<button class="btn xs pri" data-act="revealmon" data-tid="${tid}" data-mid="${m.id}" title="${esc(m.name)} 의 지시를 공개">${String(m.entry).toUpperCase()} 공개</button>`:`<i title="${esc(m.name)}">${String(m.entry).toUpperCase()}</i>`).join('')}${my?`<button class="btn xs" data-act="fire" data-tid="${tid}" title="선행 입력한 지령·명령을 발동 (4식 6령)">4식 6령</button>`:''}</span>`}).join('');
  return `<div class="revealstat"><span class="olab">지시 공개</span>${rows}<span class="sp"></span><span class="small dim">${ph===1?'에리어마다 하나씩 연다 · 다 열리면 행동 순서로':'지령·명령은 「4식 6령」에서 그때그때 발동'}</span></div>`}
 /* 좌측 A | 우측 A / 좌측 B | 우측 B … 열 = 진영, 행 = 에리어 */
 function areaGrid(c){const b=c.b;const ent={left:entered(b,'left'),right:entered(b,'right')};const ids={left:((b.sides||{}).left||{}).trainers||[],right:((b.sides||{}).right||{}).trainers||[]};
  const cell=(side,a)=>{const m=ent[side][a];const slot=slotOf(side,a);return `<div class="area ${side} ${m?'':'empty'}" data-slot="${slot}"><div class="alab ${side}">${SIDE_KO[side]} ${a.toUpperCase()}</div>${m?bigCard(c,m,slot):`<div class="aempty">빈 자리${c.mgr||ids[side].includes(c.seat)?'<br><span class="small">벤치에서 「등장」</span>':''}</div>`}</div>`};
  return `<div class="fgrid"><div class="ahead left">${SIDE_KO.left}</div><div class="ahead right">${SIDE_KO.right}</div>${AREAS.slice(0,mode(b)).map(a=>cell('left',a)+cell('right',a)).join('')}</div>`}
 function areaRow(c,side){const b=c.b;const ent=entered(b,side);const ids=((b.sides||{})[side]||{}).trainers||[];
  return `<div class="arow ${side}"><div class="alabel ${side}">${SIDE_KO[side]}</div>${AREAS.slice(0,mode(b)).map(a=>{const m=ent[a];const slot=slotOf(side,a);
   return `<div class="area ${m?'':'empty'}" data-slot="${slot}"><div class="alab">${a.toUpperCase()}</div>${m?bigCard(c,m,slot):`<div class="aempty">빈 자리${c.mgr||ids.includes(c.seat)?'<br><span class="small">벤치에서 「등장」</span>':''}</div>`}</div>`}).join('')}</div>`}
 function benchRow(c,side,ready){const b=c.b;const ids=((b.sides||{})[side]||{}).trainers||[];const trs=b.trainers||{};const seats=c.ST.state.seats||{};
  const items=ids.map(tid=>{const t=trs[tid]||{name:'?',ranks:{}};const o=seats[tid];const mons=Object.values(b.mons||{}).filter(m=>m.tid===tid).sort((x,y)=>(x.slot||0)-(y.slot||0));const cmdDone=!!(b.cmds||{})[tid];const rd=!!ready[tid];
   return `<div class="tblock"><div class="trainer"><div class="tpic" style="${t.image?`background-image:url('${cssu(t.image)}')`:''}"></div><div class="tinfo"><div class="tn">${esc(t.name)}${tid===c.seat?' <span class="tag me">ME</span>':''}${rd?' <span class="tag ok">READY</span>':cmdDone?' <span class="tag">공개됨</span>':''}</div>
     <div class="rk4">${['육성','지시','통솔','능력'].map(k=>`<span><small>${k}</small><b>${esc(t.ranks[k]||'-')}</b></span>`).join('')}</div>${o?`<div class="tr"><span class="who">${esc(o.name)}</span></div>`:''}</div>
     </div>${(()=>{const U=uniqList(t);const own=c.gm||tid===c.seat;return U.length?`<div class="tuq">${U.map(x=>`<span class="pot sp uq" title="${esc(String(x.p.eff||'').replace(/<br\s*\/?>/g,' ').slice(0,300))}"><em>고유</em>${esc(x.p.name)}${x.max!=null?` <b>${x.left}/${x.max}</b>`:''}${own?(x.left!==null&&x.left<=0?'<small class="dim">다 씀</small>':`<button class="btn xs pri" data-act="ufire" data-tid="${tid}" data-pot="${esc(x.p.name)}" title="고유 포텐셜 발동 — 대상 포켓몬을 고른다">발동</button>`):''}</span>`).join('')}</div>`:''})()}<div class="tbtns">${((c.gm||tid===c.seat)&&mons.some(m=>m.entry))?`<button class="btn xs" data-act="fire" data-tid="${tid}" title="지령·명령 발동 창">4식 6령</button>`:''}${(c.gm||tid===c.seat)?`<button class="btn xs ghost" data-act="dexmgr" data-tid="${tid}" title="도감 · 데이터 해석">해석</button><button class="btn xs ghost ${myosuGlow(c,tid)?'pri':''}" data-act="skillp" data-tid="${tid}" title="「타임」 — 상대가 준비를 마치면 지시의 꼴(교대/기술)을 엿본다">묘수</button>`:''}${(c.gm||tid===c.seat)?`<button class="btn xs ghost" data-act="orders" data-tid="${tid}" title="지령·명령 설정 · 빼기">지령 설정</button>`:''}</div>
    <div class="bench">${mons.map(m=>benchCard(c,m)).join('')||'<div class="dim small">포켓몬 없음</div>'}</div></div>`}).join('');
  return `<div class="bcol ${side}"><div class="shead"><span class="sname">${SIDE_KO[side]} 벤치</span><span class="sp"></span>${c.mgr?`<button class="btn xs" data-act="load" data-side="${side}">+ 파티</button>`:''}</div>${items||'<div class="aempty small">트레이너 없음'+(c.mgr?' — 「+ 파티」':'')+'</div>'}</div>`}
 function fieldStrip(c,f){const w=f.weather.type,t=f.terrain.type;
  const ic=(name,label,cnt,kind)=>{const im=fimg(name);return `<div class="fic ${kind}" title="${esc(label)}">${im?`<img src="${esc(im)}" alt="">`:'<span class="fnoimg"></span>'}<span><small>${({w:'날씨',t:'필드',r:'룸',e:'필드의 상태'})[kind]||''}</small><b>${esc(label)}</b>${cnt?`<em>${cnt>=1000?'∞':cnt+'T'}</em>`:''}</span></div>`};
  const mid=[w?ic(W_IMG[w],w,f.weather.count,'w'):'',t?ic(T_IMG[t],t,f.terrain.count,'t'):'',...ROOMS.filter(r=>(f.rooms||{})[r]>0).map(r=>ic(T_IMG[r],r,f.rooms[r],'r')),...ETC.filter(r=>(f.etc||{})[r]>0).map(r=>ic(T_IMG[r],r,f.etc[r],'e'))].filter(Boolean).join('');
  const objs=side=>{const o=(f.objects||{})[side]||{};const by={};for(const k in o){if(!(o[k]>0))continue;const cat=objCat(k)[0];(by[cat]=by[cat]||[]).push(`<span class="obj ${cat}" title="${esc(objCat(k)[1])}">${esc(k)}${o[k]>=1000?'':` <b>${k==='압정뿌리기'||k==='독압정'?o[k]+'겹':o[k]+'T'}</b>`}</span>`)}
   return OBJ_CAT.filter(cc=>by[cc[0]]).map(cc=>`<span class="ocat"><i>${esc(cc[1])}</i>${by[cc[0]].join('')}</span>`).join('')};
  const gmc=c.mgr?' clickable':'';
  return `<div class="fstrip"><div class="fobjs lft${gmc}" ${c.mgr?'data-act="objects" data-side="left" title="눌러서 좌측 설치기 놓기"':''}><span class="olab left">좌측 설치물</span>${objs('left')||'<span class="dim small">없음</span>'}${c.mgr?'<span class="fplus">＋</span>':''}</div><div class="fmid${gmc}" ${c.mgr?'data-act="field" title="눌러서 날씨·필드·룸·필드의 상태"':''}>${mid||'<span class="dim small">날씨·필드 없음'+(c.mgr?' — 눌러서 설정':'')+'</span>'}</div><div class="fobjs rgt${gmc}" ${c.mgr?'data-act="objects" data-side="right" title="눌러서 우측 설치기 놓기"':''}>${c.mgr?'<span class="fplus">＋</span>':''}${objs('right')||'<span class="dim small">없음</span>'}<span class="olab right">우측 설치물</span></div></div>`}
 function sideBox(c,side,ready){
  const b=c.b;const ids=((b.sides||{})[side]||{}).trainers||[];const trs=b.trainers||{};const seats=c.ST.state.seats||{};
  const ent=entered(b,side);
  const areas=AREAS.slice(0,mode(b)).map(a=>{const m=ent[a];const slot=slotOf(side,a);
   return `<div class="area ${m?'':'empty'}" data-slot="${slot}"><div class="alab">${a.toUpperCase()}</div>${m?bigCard(c,m,slot):`<div class="aempty">빈 자리${c.mgr||ids.includes(c.seat)?'<br><span class="small">벤치에서 「등장」</span>':''}</div>`}</div>`}).join('');
  const bench=ids.map(tid=>{const t=trs[tid]||{name:'?',ranks:{}};const o=seats[tid];const mons=Object.values(b.mons||{}).filter(m=>m.tid===tid).sort((x,y)=>(x.slot||0)-(y.slot||0));
   const cmdDone=!!(b.cmds||{})[tid];const rd=!!ready[tid];
   return `<div class="trainer"><div class="tpic" style="${t.image?`background-image:url('${cssu(t.image)}')`:''}"></div><div class="tinfo"><div class="tn">${esc(t.name)}${tid===c.seat?' <span class="tag me">ME</span>':''}${rd?' <span class="tag ok">READY</span>':cmdDone?' <span class="tag">공개됨</span>':''}</div>
     <div class="tr">${['육성','지시','통솔','능력'].map(k=>`${k} <b>${esc(t.ranks[k]||'-')}</b>`).join(' · ')} · ${o?`<span class="who">${esc(o.name)}</span>`:'<span class="dim">빈 자리</span>'}</div></div>
     ${c.mgr?`<button class="btn xs ghost" data-act="orders" data-tid="${tid}">지령</button><button class="btn xs ghost danger" data-act="unload" data-tid="${tid}">빼기</button>`:''}</div>
    <div class="bench">${mons.map(m=>benchCard(c,m)).join('')||'<div class="dim small">포켓몬 없음</div>'}</div>`}).join('');
  return `<div class="sideBox ${side}"><div class="shead"><span class="sname">${SIDE_KO[side]}</span><span class="sp"></span>${c.mgr?`<button class="btn xs" data-act="load" data-side="${side}">+ 파티</button>`:''}</div>
   <div class="areas">${areas}</div>${bench||'<div class="aempty">트레이너 없음</div>'}</div>`}

 function hpBar(m,full){const hp=m.hp||{max:1,cur:1};const pct=Math.max(0,Math.min(100,Math.round(hp.cur/hp.max*100)));const cls=pct<=25?'low':pct<=50?'mid':'';
  return `<div class="hpbar ${cls}"><i style="width:${pct}%"></i></div><div class="hpnum">${full?`${hp.cur} <span class="dim">/ ${hp.max}</span>`:pct+'%'}</div>`}
 function rankChips(m){const r=m.rank||{};const out=[];for(const k of ['attack','defense','specialattack','specialdefense','speed','accuracy','evasion','critical']){const v=+r[k]||0;if(v)out.push(`<span class="rk ${v>0?'up':'dn'}">${STAT_KO[k]}${v>0?'+':''}${v}</span>`)}
  const md=m.mod||{};for(const k in md){const v=+md[k];if(v&&v!==1)out.push(`<span class="rk ${v>1?'up':'dn'}">${STAT_KO[k]||k}×${v}</span>`)}return out.join('')}
 const FLAG_KO={endure:'버텨라!',surehit:'맞춰라!',dodgePhys:'물러나!',dodgeSpec:'피해라!',swap:'바꿔라!',return:'돌아와!',hitPhys:'지킬 수 없다!',hitSpec:'피할 수 없다!',noEndure:'버틸 수 없다!',acc0:'맞출 수 없다!',dodgeOnce:'주인의 칙령',nullify:'파계',rebirth:'윤회의 법계'};
 function flagChips(m){return Object.keys(m.flags||{}).filter(k=>m.flags[k]&&FLAG_KO[k]).map(k=>`<span class="rk flag">${esc(FLAG_KO[k]||k)}</span>`).join('')+(m.prioDown?'<span class="rk flag" title="아이스번 — 다음 기술 우선도 −1">우선도 −1</span>':'')}
 function stateChips(m){const st=m.states||{};const db=(DB().states||{}).st||{};return Object.keys(st).filter(k=>st[k]).map(k=>{const im=simg(k);return `<span class="stc ${db[k]&&db[k].abn?'abn':''}" title="${esc((db[k]&&db[k].desc||[]).join(' '))}">${im?`<img src="${esc(im)}" alt="">`:''}${esc(db[k]?db[k].ko:k)}${+st[k]>1&&+st[k]<1000?' '+st[k]:''}</span>`}).join('')}
 function bigCard(c,m,slot){const full=canEdit(c,m);const cmd=cmdOf(c.b,m);
  return `<div class="mon big ${m.hp.cur<=0?'fainted':''}" data-mon="${m.id}"><div class="pic" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}"></div>
   <div class="minfo"><div class="nm">${esc(m.name)}<span class="lv">Lv.${m.lv}</span>${((!full&&c.seat)||c.gm)?`<button class="btn xs ghost dexb" data-act="dex" data-mid="${m.id}" title="도감 정보 · 해석">도감</button>`:''}${(!full&&c.seat&&(c.b.trainers[c.seat]||{}).side!==m.side&&(+c.b.phase||0)===0)||c.gm&&!full?`<button class="btn xs ghost dexb" data-act="time" data-mid="${m.id}" title="「타임」 — 상대 지시의 꼴 엿보기">타임</button>`:''}</div><div class="ty">${m.types.filter(t=>t!=='-').map(typeChip).join('')}${m.teraActive?`<span class="rk up">테라 ${esc(m.tera)}</span>`:''}</div>
   ${hpBar(m,full)}<div class="rks">${rankChips(m)}${stateChips(m)}${flagChips(m)}${FX()?FX().chips(m).map(ch=>`<span class="rk fxc ${full?'rm':''}" title="${esc(ch.title)}${full?' — 눌러서 해제':''}" ${full?`data-act="fxoff" data-mid="${m.id}" data-fx="${esc(ch.id)}" data-nm="${esc(ch.name)}"`:''}>${esc(ch.t)}${full?' ✕':''}</span>`).join(''):''}</div>
   ${cmd?`<div class="cmdcard">${cmd}</div>`:(((+c.b.phase||0)>=1&&full&&m.hp.cur>0)?`<div class="revealrow"><button class="btn sm pri" data-act="revealmon" data-tid="${m.tid}" data-mid="${m.id}">지시 공개 (에리어 ${String(m.entry).toUpperCase()})</button></div>`:'')}
   ${potLine(c,m)}
   ${m.lastHit&&full?`<div class="incoming"><b>피해 판정 받음</b> ${esc(m.lastHit.from)}의 「${esc(m.lastHit.move)}」 ${m.lastHit.total}×${m.lastHit.eff}${m.lastHit.crit?' 급소':''} ≈ ${m.lastHit.expect} <button class="btn xs pri" data-act="hp" data-mid="${m.id}">피해 적용</button></div>`:''}
   <div class="mbtns">${full?`<button class="btn xs" data-act="attack" data-mid="${m.id}">공격</button><button class="btn xs ${m.lastHit?'pri':''}" data-act="hp" data-mid="${m.id}">HP</button><button class="btn xs" data-act="pots" data-mid="${m.id}" title="포텐셜 목록 · 출력 · 발동 · 해제">포텐셜</button><button class="btn xs" data-act="edit" data-mid="${m.id}">랭크·상태</button><button class="btn xs ghost" data-act="exit" data-mid="${m.id}" title="바로 퇴장 (랭크·배율·효과 정리)">퇴장</button><button class="btn xs ghost" data-act="exitx" data-mid="${m.id}" title="배턴터치 퇴장 · 강제 교대">퇴장(특수)</button>`:''}</div></div></div>`}
 /* 비공개: 아직 한 번도 나오지 않은 상대 포켓몬은 이름·그림·타입을 숨긴다 (맵툴 「비공개」 토큰) */
 function secret(c,m){if(c.gm||!m)return false;if(m.seen||m.entry)return false;const my=(c.b.trainers||{})[c.seat];return !my||my.side!==m.side}
 function benchCard(c,m){const full=canEdit(c,m);const out=!!m.entry;const sec=secret(c,m);
  if(sec)return `<div class="mon small secret"><div class="btop"><div class="pic"></div><div class="nm">비공개</div></div><div class="hpbar"><i style="width:100%"></i></div><div class="hpnum">?</div></div>`;
  return `<div class="mon small ${m.hp.cur<=0?'fainted':''} ${out?'onfield':''}" data-mon="${m.id}">
   <div class="btop"><div class="pic" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}"></div><div class="nm" title="${esc(m.name)} · ${esc(m.types.filter(t=>t!=='-').map(t=>S().typeKo(t)).join('/'))}">${esc(m.name)}${out?` <span class="tag">${m.entry.toUpperCase()}</span>`:''}</div></div><div class="ty">${m.types.filter(t=>t!=='-').map(typeChip).join('')}</div>${hpBar(m,full)}
   ${!out&&full&&m.hp.cur>0?(c.b.simul?`<button class="btn xs ${m.pend?'pri':''}" data-act="pend" data-mid="${m.id}">${m.pend?'예약 '+String(m.pend).toUpperCase()+' ✓':'내밀기 예약'}</button>`:`<button class="btn xs" data-act="enter" data-mid="${m.id}">등장</button>`):''}</div>`}

 /* 【N/시】 포텐셜 횟수. potUses[name] = 남은 횟수 */
 /* 포켓몬이 쓸 수 있는 포텐셜 전부: 20칸 + 전용 + 트레이너의 고유 */
 function uniqOf(m){const b=ctx().b;const t=(b.trainers||{})[m.tid];return ((t&&t.unique)||[]).filter(u=>u&&u.name).map(u=>Object.assign({kind:'고유',unique:true},u))}
 /* 지시 칸의 포텐셜 선언 칩: 고유(트레이너) · 전용 · 일반, 남은 횟수와 함께 */
 function potDecl(c,m,x,grp){const u=m.potUses||{};const chips=potSrc(m).filter(p=>{const sp=isExcl(m,p);return grp==='sp'?sp:grp==='norm'?!sp:true}).map(p=>{const kind=isExcl(m,p)?'전용':'';const mxm=String(p.eff||'').match(/【(\d+)\/시】/);const pmax=p.max!=null?p.max:(mxm?+mxm[1]:null);const left=pmax!=null?(u[p.name]==null?pmax:+u[p.name]):null;p={...p,max:pmax};const on=(x.pots||[]).includes(p.name);return `<div class="oc ${on?'mine':''} ${left!==null&&left<=0?'dis':''}" data-pdecl="${esc(p.name)}" title="${esc(String(p.eff||'').replace(/<br\s*\/?>/g,' '))}"><b>${kind?'['+esc(kind)+'] ':''}${esc(p.name)}</b>${left!==null?`<small>남은 ${left}/${p.max}</small>`:'<small>횟수 없음</small>'}</div>`});return chips.join('')||`<span class="dim small">${grp==='sp'?'전용 포텐셜이 없다':'선행 입력할 포텐셜이 없다'}</span>`}
 /* 고유(트레이너) · 전용 포텐셜: 지시 선언 · 카드 · 4식 6령 창에서 따로 묶어 보인다 */
 const isExcl=(m,p)=>(m.excl&&m.excl.name===p.name)||(m.exclX||[]).some(q=>q.name===p.name);
 function specialPots(m){const u=m.potUses||{};return potSrc(m).filter(p=>isExcl(m,p)).map(p=>{const mm=String(p.eff||'').match(/【(\d+)\/시】/);const max=mm?+mm[1]:null;const left=max==null?null:(u[p.name]==null?max:+u[p.name]);const a=FX()&&FX().autoOf(m,'pot',p.name);return {p,kind:p.unique?'고유':'전용',max,left,auto:!!(a&&a.ops&&a.ops.length&&!a.manual)}})}
 function spBtn(m,s){const n=esc(s.p.name);if(s.left!==null&&s.left<=0)return '<span class="small dim">다 씀</span>';
  if(s.auto)return `<button class="btn xs pri" data-act="fireauto" data-mid="${m.id}" data-kind="pot" data-pot="${n}" title="자동화 효과를 건다${s.max!=null?' (횟수 1 사용)':''}">발동</button>`;
  if(s.max!=null)return `<button class="btn xs pri" data-act="usepot" data-mid="${m.id}" data-pot="${n}" title="횟수 1을 쓰고 로그에 출력">사용</button>`;
  return `<button class="btn xs" data-act="announce" data-mid="${m.id}" data-kind="pot" data-pot="${n}" title="효과를 로그에 출력">📢 발동</button>`}
 function potSrc(m){return [...(m.pots||[]).filter(p=>p&&!p.ph&&p.name),...(m.excl?[m.excl]:[]),...(m.exclX||[])]}
 /* 고유 포텐셜 = 트레이너 것. 횟수는 battle.trainers[tid].uUses */
 function uniqList(t){return ((t&&t.unique)||[]).filter(u=>u&&u.name).map(u=>{const mm=String(u.eff||'').match(/【(\d+)\/시】/);const max=mm?+mm[1]:null;const left=max==null?null:(((t.uUses||{})[u.name]==null)?max:+(t.uUses||{})[u.name]);return {p:u,kind:'고유',max,left}})}
 function potList(m){const out=[];const src=potSrc(m);
  for(const p of src){const mm=String(p.eff||'').match(/【(\d+)\/시】/);if(mm)out.push({name:p.name,max:+mm[1]})}return out}
 function potLine(c,m){const L=potList(m);const full=canEdit(c,m);const u=m.potUses||{};const Lnames=new Set(L.map(p=>p.name));
  /* 횟수 없는 자동화(포텐셜·특성·소지품) 도 「발동」 버튼으로 */
  const extra=[];if(FX()&&full){const src=potSrc(m).filter(p=>!Lnames.has(p.name));
   for(const p of src){const a=FX().autoOf(m,'pot',p.name);if(a&&a.ops&&a.ops.length&&!a.manual)extra.push(['pot',p.name])}
   if(m.ability){const a=FX().autoOf(m,'trait',m.ability);if(a&&a.ops&&a.ops.length&&!a.manual&&!FX().timing(a.text).entry&&!FX().timing(a.text).passive)extra.push(['trait',m.ability])}
   if(m.item){const a=FX().autoOf(m,'item',m.item);if(a&&a.ops&&a.ops.length&&!a.manual&&!FX().timing(a.text).entry)extra.push(['item',m.item])}}
  const sp=full?specialPots(m).filter(s=>!Lnames.has(s.p.name)&&!extra.some(([k,n])=>k==='pot'&&n===s.p.name)):[];
  const spHtml=sp.length?`<div class="pots sppots">${sp.map(s=>`<span class="pot sp ${s.kind==='고유'?'uq':'ex'}" title="${esc(String(s.p.eff||'').replace(/<br\s*\/?>/g,' ').slice(0,300))}"><em>${s.kind}</em>${esc(s.p.name)}${s.max!=null?` <b>${s.left}/${s.max}</b>`:''}${spBtn(m,s)}</span>`).join('')}</div>`:'';
  if(!L.length&&!extra.length)return spHtml;
  return `<div class="pots">${L.map(p=>{const left=u[p.name]==null?p.max:+u[p.name];const a=FX()&&FX().autoOf(m,'pot',p.name);const spk=(potSrc(m).find(q=>q.name===p.name)||{}).unique?'고유':isExcl(m,p)?'전용':'';return `<span class="pot ${left<=0?'off':''} ${a&&a.ops&&a.ops.length&&!a.manual?'auto':''} ${spk?'sp '+(spk==='고유'?'uq':'ex'):''}" title="${esc(p.name)}${a&&a.ops&&a.ops.length?' · 자동: '+esc(FX().unparse(a.ops).join(' / ')):''}">${spk?`<em>${spk}</em>`:''}${esc(p.name)} <b>${left}/${p.max}</b>${full&&left>0?`<button class="btn xs" data-act="usepot" data-mid="${m.id}" data-pot="${esc(p.name)}">사용</button>`:''}${full&&left<p.max?`<button class="btn xs ghost" data-act="restorepot" data-mid="${m.id}" data-pot="${esc(p.name)}">+</button>`:''}</span>`}).join('')}${extra.map(([k,n])=>{const a=FX().autoOf(m,k,n);return `<span class="pot auto" title="${esc(n)} · ${esc(FX().unparse(a.ops).join(' / '))}">${k==='trait'?'특성 ':k==='item'?'소지품 ':''}${esc(n)}<button class="btn xs" data-act="fireauto" data-mid="${m.id}" data-kind="${k}" data-pot="${esc(n)}">발동</button></span>`}).join('')}</div>${spHtml}`}
 function cmdOf(b,m){const cm=(b.cmds||{})[m.tid];if(!cm||!cm.mons||!cm.mons[m.id])return '';const x=cm.mons[m.id];
  const parts=[];if(x.move==='switch')parts.push(`<b>교대</b> → ${esc(monName(b,x.switch))}`);else if(x.move!=null&&x.move!==''){const mv=(m.moves||[])[+x.move];parts.push(`<b>${esc(mv?mv.name:'?')}</b>${mv?' '+typeChip(mv.typeEn):''}`);if(x.targets&&x.targets.length)parts.push('→ '+x.targets.map(s=>slotName(b,s)).join(', '))}
  if(x.prio&&Object.values(x.prio).some(v=>v!==''&&+v!==0))parts.push('우선도 '+Object.entries(x.prio).filter(([k,v])=>v!==''&&+v!==0).map(([k,v])=>slotName(b,k)+' '+v).join(', '));
  if(x.ochg&&Object.values(x.ochg).some(v=>v!==''&&+v!==20))parts.push('순서 '+Object.entries(x.ochg).filter(([k,v])=>v!==''&&+v!==20).map(([k,v])=>slotName(b,k)+' '+v).join(', '));
  const fd=((cm.fired||{})[m.id])||{};if(fd.order)parts.push(`<span class="rk up">『${esc(orderName(b,m.tid,'order',fd.order))}』</span>`);if(fd.command)parts.push(`<span class="rk up">『${esc(orderName(b,m.tid,'command',fd.command))}』</span>`);
  if(x.pots&&x.pots.length)parts.push(x.pots.map(p=>{const src=potSrc(m).find(q=>q.name===p)||{};const k=src.unique?'고유':(m.excl&&m.excl.name===p)||(m.exclX||[]).some(q=>q.name===p)?'전용':'포텐셜';return `<span class="rk fxc" title="${esc(src.eff||'')}">${k} 『${esc(p)}』</span>`}).join(' '));
  if(cm.detail)parts.push(`<span class="dim">${esc(cm.detail)}</span>`);
  return parts.join(' ')}
 function slotName(b,slot){const [side,area]=String(slot).split('_');const m=entered(b,side)[area];return `${SIDE_KO[side]||side}${(area||'').toUpperCase()}${m?'('+esc(m.name)+')':''}`}
 const OO=()=>window.OM_ORDERS;
 function orderName(b,tid,kind,key){const t=(b.trainers||{})[tid]||{};return kind==='order'?OO().orderName(t,key):OO().commandName(t,key)}

 /* 행동 순서 띠 (맵툴 print_turn_order 꼴: 초상 줄 + 「교대 등장」「통상 교대」「우선도」「순서값」 줄) + 지금 행동 중인 칸 */
 function orderBox(c){const b=c.b;if(!b.order||!b.order.length)return '';const cur=+b.orderIdx||0;
  const cap=o=>{if(!o.started)return '「교대 등장」';if(o.change)return '「통상 교대」';if(o.order!==20)return '「'+esc(orderValueName(o.order))+'」';return '「우선도 : '+(o.prio>0?'+':'')+o.prio+'」'};
  return `<div class="orderbox"><div class="ohead"><span class="olab">행동 순서</span><span class="small dim">${(b.orderNotes||[]).length?esc((b.orderNotes||[]).join(' · ')):'스피드 순 · 초상을 누르면 그 차례로'}</span><span class="sp"></span>${c.mgr?`<button class="btn xs ghost" data-act="oprev">◀</button><span class="small">${Math.min(cur+1,b.order.length)} / ${b.order.length}</span><button class="btn xs pri" data-act="onext">다음 행동 ▶</button>`:''}</div>
   <div class="ostrip">${b.order.map((o,i)=>{const m=(b.mons||{})[o.mid]||{};const dead=m.hp&&m.hp.cur<=0;return `<div class="ocard ${o.side} ${i===cur?'now':i<cur?'done':''} ${dead?'dead':''}" data-act="ojump" data-i="${i}" title="${esc(o.name)} · 스피드 ${Math.round(o.speed)} · d${o.dice}"><span class="onum">${i+1}</span><div class="opt" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}"></div><b class="onm">${esc(o.name)}</b><span class="ocap">${cap(o)}</span>${o.move?`<span class="omv">${o.moveType?typeChip(o.moveType):''}${esc(o.move)}</span>`:''}<span class="osp">S ${Math.round(Math.abs(o.speed))} · d${o.dice}</span></div>`}).join('')}</div></div>`}
 function orderValueName(v){return ({40:'가장 먼저',30:'상대보다 먼저',20:'일반',10:'상대보다 나중에',0:'가장 나중에'})[v]||('순서 '+v)}

 /* ---------- 지시 입력 패널 ---------- */
 let CMD={};  /* 편집 중인 내 지시 {tid:{mons:{},order:{},command:{},detail}} */
 /* ---------- 지시 입력 패널 (맵툴 cmd_ui 와 같은 구성: 포켓몬 탭 → 기술 카드 → 대상 보드 → 지령 풀 → 요약) ---------- */
 const UIC={tab:{}};  /* tid → 선택된 mid */
 function moveCard(mv,i,on,extra){const col=S().typeColor(mv.typeEn);return `<div class="mv ${on?'on':''}" style="background:${col.bg};color:${col.fg}" ${extra||''}><div class="mn">${esc(mv.name)} <i class="mvdb" data-mvdb="${esc(mv.name)}" title="기술 DB">?</i></div><div class="mm">${esc(mv.cat)} · 위력 ${mv.pow||'-'} · 명중 ${mv.acc||'필중'}${mv.prio?' · 우선 '+mv.prio:''}</div><div class="mr">${esc(mv.range)}</div></div>`}
 function tile(m,side,area,on,cls,extra){if(!m)return `<div class="ttile none ${cls||''}"><span class="tn"><small>${SIDE_KO[side]} ${area.toUpperCase()} 빈 자리</small></span></div>`;const pct=Math.max(0,Math.min(100,Math.round(m.hp.cur/m.hp.max*100)));
  return `<div class="ttile ${cls||''} ${on?'on':''}" ${extra||''}><div class="ti" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}"></div><div class="tn"><b>${esc(m.name)}</b><small>${SIDE_KO[side]} ${area.toUpperCase()} · ${m.types.filter(t=>t!=='-').map(typeChip).join('')}</small><div class="hpb ${pct<=25?'low':pct<=50?'mid':''}"><i style="width:${pct}%"></i></div></div><span class="tk">${on?'✓':''}</span></div>`}
 /* 대상판: 열 = 좌측/우측, 행 = 에리어 (무대와 같은 배치). 아군 열은 초록, 상대 열은 빨강 */
 function board(b,mySide,isOn,attr,allowSelf){const ent={left:entered(b,'left'),right:entered(b,'right')};const cls=s=>s===mySide?'al':'en';
  const head=SIDES.map(s=>`<div class="bl ${cls(s)}">${SIDE_KO[s]}${s===mySide?' (아군)':' (상대)'}</div>`).join('');
  const rows=AREAS.slice(0,mode(b)).map(a=>SIDES.map(s=>{const m=ent[s][a];const slot=slotOf(s,a);return tile(m,s,a,m&&isOn(slot,m),cls(s),m?attr(slot,m):'')}).join('')).join('');
  return `<div class="board grid">${head}${rows}</div>`}
 function cmdPanel(c,ready){
  const b=c.b;const tids=myTrainers(c);if(!tids.length)return '';
  const phase=+b.phase||0;
  const blocks=tids.map(tid=>{const t=(b.trainers||{})[tid]||{};const mons=Object.values(b.mons||{}).filter(m=>m.tid===tid&&m.entry&&m.hp.cur>0).sort((x,y)=>x.entry.localeCompare(y.entry));if(!mons.length)return '';
   const cur=CMD[tid]||(CMD[tid]={mons:{},detail:'',upots:[]});cur.upots=cur.upots||[];const UL=uniqList(t);const tmOpen=!!ready[tid]&&timeOf(t,+b.turn||0).sw>=1&&phase===0;const locked=!!ready[tid]&&!tmOpen;
   if(!mons.find(m=>m.id===UIC.tab[tid]))UIC.tab[tid]=mons[0].id;const m=mons.find(x=>x.id===UIC.tab[tid]);
   mons.forEach(mm=>{cur.mons[mm.id]=cur.mons[mm.id]||{move:'',switch:'',targets:[],prio:{},ochg:{},order:'',command:'',pots:[]};cur.mons[mm.id].pots=cur.mons[mm.id].pots||[]});
   const x=cur.mons[m.id];const bench=Object.values(b.mons||{}).filter(mm=>mm.tid===tid&&!mm.entry&&mm.hp.cur>0);
   const oNames=OO().orderNames(t);const cNames=OO().commandNames(t);const OKEYS=OO().orderKeys(t);const CKEYS=OO().commandKeys(t);const cnt=t.orderCount||{};
   const summ=mons.map(mm=>{const xx=cur.mons[mm.id];const pre=[xx.order?`『${esc(OO().orderName(t,xx.order))}』`:'',xx.command?`『${esc(OO().commandName(t,xx.command))}』`:''].filter(Boolean).join(' ');const pd=(xx.pots||[]).length?` <span class="dim">포텐셜 ${xx.pots.map(p=>'『'+esc(p)+'』').join('')}</span>`:'';const tail=(pre?` <span class="dim">선행 ${pre}</span>`:'')+pd;if(xx.move==='switch')return `${mm.name}: 교대 → ${monName(b,xx.switch)||'?'}${tail}`;if(xx.move===''||xx.move==null)return `${mm.name}: <span class="warn">행동 없음</span>${tail}`;const mv=(mm.moves||[])[+xx.move];return `${mm.name}: <b>${mv?esc(mv.name):'?'}</b>${xx.targets.length?' → '+xx.targets.map(sl=>slotName(b,sl)).join(', '):' <span class="warn">대상 없음</span>'}${tail}`}).join(' · ');
   const isSwitch=x.move==='switch';const mvSel=!isSwitch&&x.move!==''?(m.moves||[])[+x.move]:null;
   return `<div class="cmdt ${locked?'locked':''}" data-tid="${tid}">
    <div class="cmdhead"><b>${esc(t.name)}</b> 지시 ${locked?'<span class="tag ok">READY</span><span class="small dim">준비 완료 — 바꾸려면 「준비 해제」</span>':tmOpen?'<span class="tag ok">READY</span><span class="small" style="color:var(--yel2)">「타임」을 썼으니 고칠 수 있다 — 「저장」하면 반영</span>':''}<span class="sp"></span>${phase>=1?`<button class="btn xs" data-act="fire" data-tid="${tid}">4식 6령 발동</button>`:''}${locked?'':`<button class="btn xs ghost" data-act="cmdload" data-tid="${tid}">저장된 지시 불러오기</button>`}</div>
    ${UL.length?`<div class="upre ${locked?'ro':''}"><div class="sec">고유 포텐셜 <span class="tag uqt">트레이너</span> <span class="note">선행 입력 — 턴 중 「4식 6령」에서 「선행 발동」 · 공개해도 상대는 모른다</span></div><div class="pool">${UL.map(s=>`<div class="oc ${cur.upots.includes(s.p.name)?'mine':''} ${s.left!==null&&s.left<=0?'dis':''}" data-upre="${esc(s.p.name)}" title="${esc(String(s.p.eff||'').replace(/<br\s*\/?>/g,' '))}"><b>${esc(s.p.name)}</b><small>${s.max!=null?`남은 ${s.left}/${s.max}`:'횟수 없음'}</small></div>`).join('')}</div></div>`:''}
    <div class="tabs2">${mons.map(mm=>{const xx=cur.mons[mm.id];const mv=xx.move!==''&&xx.move!=='switch'?(mm.moves||[])[+xx.move]:null;return `<div class="tab2 ${mm.id===m.id?'on':''}" data-ctab="${mm.id}"><div class="pic" style="${mm.image?`background-image:url('${cssu(mm.image)}')`:''}"></div><div><b>${esc(mm.name)}</b><small>${xx.move==='switch'?'교대 → '+esc(monName(b,xx.switch)||'?'):mv?esc(mv.name):'미정'}</small></div></div>`}).join('')}</div>
    <div class="pane ${locked?'ro':''}">
     <div class="sec">행동 <span class="seg"><span class="${!isSwitch?'on':''}" data-seg="move">기술</span><span class="${isSwitch?'on':''}" data-seg="switch">교대</span></span><span class="note">에리어 ${m.entry.toUpperCase()}</span></div>
     ${isSwitch?`<div class="pg">${bench.length?bench.map(bm=>`<div class="pc ${x.switch===bm.id?'on':''}" data-sw="${bm.id}"><div class="pic" style="${bm.image?`background-image:url('${cssu(bm.image)}')`:''}"></div><div><b>${esc(bm.name)}</b><div class="small dim">${bm.hp.cur}/${bm.hp.max}</div></div></div>`).join(''):'<div class="dim small">교대할 포켓몬이 없다</div>'}</div>`
     :`<div class="mvg">${(m.moves||[]).map((mv,i)=>moveCard(mv,i,String(x.move)===String(i),`data-mv="${i}"`)).join('')}</div>${mvSel?`<div class="mef">${esc(mvSel.eff||'')}${mvSel.tag&&mvSel.tag!=='-'?` <span class="dim">[${esc(mvSel.tag)}]</span>`:''}</div>`:''}
      ${mvSel?`<div class="sec">대상 <span class="note">범위 ${esc(mvSel.range)} — 누르면 바꿀 수 있다</span></div>${board(b,m.side,(slot)=>x.targets.includes(slot),(slot)=>`data-tgt="${slot}"`)}`:''}`}
     <div class="sec">전용 포텐셜 <span class="tag ext">${esc(m.name)}</span> <span class="note">선행 입력 — 턴 중 「4식 6령」에서 「선행 발동」</span></div><div class="pool">${potDecl(c,m,x,'sp')}</div>
     <div class="sec">지령 <span class="note">4식 · 에리어 ${m.entry.toUpperCase()} ${esc(m.name)} 에 선행 입력 — 턴 중 「4식 6령」에서 발동</span></div><div class="pool">${OKEYS.map((k,i)=>oNames[i]?`<div class="oc ${x.order===k?'mine':''} ${(cnt['order_'+k]??0)<=0?'dis':''}" data-ord="${k}"><b>${esc(oNames[i])}</b><small>남은 ${cnt['order_'+k]??0}</small></div>`:'').join('')||'<span class="dim small">쓸 수 있는 지령이 없다</span>'}</div>
     <div class="sec">명령 <span class="note">6령 · 선행 입력</span></div><div class="pool">${CKEYS.map((k,i)=>cNames[i]?`<div class="oc ${x.command===k?'mine':''} ${(cnt['command_'+k]??0)<=0?'dis':''}" data-cmd="${k}"><b>${esc(cNames[i])}</b><small>남은 ${cnt['command_'+k]??0}</small></div>`:'').join('')||'<span class="dim small">쓸 수 있는 명령이 없다</span>'}</div>
     <div class="sec">일반 포텐셜 선행 입력 <span class="note">필요할 때만</span></div><div class="pool">${potDecl(c,m,x,'norm')}</div>
     <details class="adv"><summary>우선도 · 행동 순서 변경 (${esc(m.name)})</summary><div class="tgts">${allEntered(b).map(s=>`<label class="tg2">${s.area.toUpperCase()} ${esc(s.mon.name)} 우선 <input type="number" class="n" data-f="prio" data-mid="${m.id}" data-slot="${s.slot}" value="${x.prio[s.slot]??''}" placeholder="0"> 순서 <input type="number" class="n" data-f="ochg" data-mid="${m.id}" data-slot="${s.slot}" value="${x.ochg[s.slot]??''}" placeholder="20"></label>`).join('')}</div></details>
     <div class="row" style="margin-top:6px"><input type="text" data-f="detail" value="${esc(cur.detail)}" placeholder="상세 (포텐셜 선언, 자유 메모)" style="flex:1"></div>
    </div>
    <div class="cfoot"><div class="sum">${cur.upots.length?`<div><span class="tag uqt">고유</span> 선행 ${cur.upots.map(n=>'『'+esc(n)+'』').join('')}</div>`:''}${summ}</div>${locked?'':`<button class="btn" data-act="cmdsave" data-tid="${tid}">저장</button>`}<button class="btn ${locked?'':'pri'}" data-act="ready" data-tid="${tid}">${locked?'준비 해제':'준비 완료'}</button></div></div>`}).join('');
  if(!blocks.trim())return '';
  loadPeek().then(pk=>{const el=document.getElementById('peekbox');if(!el||!pk)return;if(pk.turn!==(ctx().b.turn||0))return;el.innerHTML=`<div class="chip" style="border-color:var(--yel);padding:4px 10px">타임 결과 · ${esc(pk.name)}: <b>${esc(pk.text)}</b></div>`});
  return `<form id="cmdForm" class="cmdpanel" onsubmit="return false"><div id="peekbox"></div><div class="cmdtitle">지시 입력 <span class="dim small">${phase===0?'지시 준비 페이즈':'지금은 '+['','턴 개시','행동 순서','행동 처리','','턴 종료'][phase]+' — 입력은 저장만 된다'}</span></div>${blocks}</form>`}
 function rerenderCmd(){const old=$('#cmdForm');if(!old)return;const c=ctx();const tmp=document.createElement('div');tmp.innerHTML=cmdPanel(c,c.ST.state.ready||{});const nf=tmp.firstElementChild;if(!nf){old.remove();return}old.replaceWith(nf);nf.querySelectorAll('[data-act]').forEach(bt=>bt.onclick=()=>action(bt.dataset));bindCmdForm(nf,c)}
 function bindCmdForm(form,c){
  form.querySelectorAll('.cmdt').forEach(blk=>{const tid=blk.dataset.tid;const cur=CMD[tid];const mid=UIC.tab[tid];const x=cur.mons[mid];
   if(blk.classList.contains('locked')){blk.querySelectorAll('[data-ctab]').forEach(el=>el.onclick=()=>{UIC.tab[tid]=el.dataset.ctab;rerenderCmd()});return}
   blk.querySelectorAll('[data-ctab]').forEach(el=>el.onclick=()=>{UIC.tab[tid]=el.dataset.ctab;rerenderCmd()});
   blk.querySelectorAll('[data-upre]').forEach(el=>el.onclick=()=>{if(el.classList.contains('dis'))return;const n=el.dataset.upre;cur.upots=cur.upots||[];const i=cur.upots.indexOf(n);if(i>=0)cur.upots.splice(i,1);else cur.upots.push(n);rerenderCmd()});
   blk.querySelectorAll('[data-seg]').forEach(el=>el.onclick=()=>{if(el.dataset.seg==='switch'){x.move='switch';x.targets=[]}else{x.move='';x.targets=[]}rerenderCmd()});
   blk.querySelectorAll('[data-mv]').forEach(el=>el.onclick=()=>{x.move=el.dataset.mv;x.targets=defaultTargets(c.b,mid,el.dataset.mv);rerenderCmd()});
   blk.querySelectorAll('[data-sw]').forEach(el=>el.onclick=()=>{x.switch=el.dataset.sw;rerenderCmd()});
   blk.querySelectorAll('[data-tgt]').forEach(el=>el.onclick=()=>{const s=el.dataset.tgt;const i=x.targets.indexOf(s);if(i>=0)x.targets.splice(i,1);else x.targets.push(s);rerenderCmd()});
   blk.querySelectorAll('[data-ord]').forEach(el=>el.onclick=()=>{if(el.classList.contains('dis'))return;x.order=x.order===el.dataset.ord?'':el.dataset.ord;rerenderCmd()});
   blk.querySelectorAll('[data-cmd]').forEach(el=>el.onclick=()=>{if(el.classList.contains('dis'))return;x.command=x.command===el.dataset.cmd?'':el.dataset.cmd;rerenderCmd()});
   blk.querySelectorAll('[data-pdecl]').forEach(el=>el.onclick=()=>{if(el.classList.contains('dis'))return;const n=el.dataset.pdecl;x.pots=x.pots||[];const i=x.pots.indexOf(n);if(i>=0)x.pots.splice(i,1);else x.pots.push(n);rerenderCmd()});
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
 /* 페이즈 버튼 = 그 단계의 처리까지 (맵툴 progress_turn 처럼). 「턴 진행 ▶」은 다음 단계로 */
 async function setPhase(p){const c=ctx();if(!c.mgr)return;const b=c.b;p=+p;
  if(p===0){await A().set(['battle','cmds'],{});await A().set(['ready'],{});await A().set(['battle','order'],[]);await A().set(['battle','phase'],0);A().sysLog('페이즈: 지시 준비 — 지시를 입력하고 「준비 완료」','battle');return}
  if(p===1){const tids=Object.keys(b.trainers||{});const ready=c.ST.state.ready||{};const seats=c.ST.state.seats||{};const notReady=tids.filter(t=>seats[t]&&!ready[t]);if(notReady.length&&!confirm(`아직 준비 완료가 아닌 트레이너: ${notReady.map(t=>b.trainers[t].name).join(', ')}\n그래도 턴을 개시할까?`))return;
   if(!b.started){await startBattle();if(!ctx().b.started)return;await new Promise(r=>setTimeout(r,2600))}
   await A().set(['ready'],{});await A().set(['battle','cmds'],{});await A().set(['battle','host'],c.gm?'gm':c.seat);await A().set(['battle','phase'],1);await preCharge();cutPhase('턴 개시',`TURN ${(+b.turn||0)+1} · 지시 공개`);A().sysLog('턴 개시 — 위의 「지시 공개」에서 에리어마다 연다','battle');return}
  if(p===2){const left=unrevealed(b);if(left.length){
    /* GM(보통): 비밀 지시를 읽어 한꺼번에 연다 */
    if(c.gm&&!c.fair){if(!confirm(`아직 안 연 지시가 있다: ${left.join(', ')}\n한꺼번에 열고 행동 순서로 갈까?`))return;await reveal();return computeOrder()}
    /* 모의전 진행자 · GM 불간섭: 남의 비밀 지시는 못 읽으니 각자의 화면에 「공개 요청」을 보낸다. GM 은 NPC 것만 연다 */
    if(c.gm)await reveal(true);const left2=unrevealed(ctx().b);if(!left2.length)return computeOrder();
    if(String(ctx().b.revealReq||'')===turnKey(b)){if(!confirm(`아직 안 연 지시: ${left2.join(', ')}\n(그 플레이어가 접속해 있지 않을 수 있다)\n그대로 행동 순서를 계산할까?`))return;return computeOrder()}
    await A().set(['battle','host'],c.gm?'gm':c.seat);await A().set(['battle','revealReq'],turnKey(b));A().sysLog(`지시 공개 요청 — 각자의 화면이 남은 지시를 연다 (${left2.join(', ')}). 모두 열리면 행동 순서로 넘어간다`,'battle');watch();return}
   return computeOrder()}
  if(p===3){await A().set(['battle','orderIdx'],0);await A().set(['battle','phase'],3);cutPhase('행동 처리','순서대로 공격');A().sysLog('행동 처리 — 순서대로 「공격」, 끝나면 「다음 행동 ▶」','battle');return}
  if(p===5)return turnEnd()}
 function unrevealed(b){const out=[];for(const tid in b.trainers||{}){const t=b.trainers[tid];const mons=Object.values(b.mons||{}).filter(m=>m.tid===tid&&m.entry&&m.hp.cur>0);for(const m of mons)if(!revealed(b,tid,m.id))out.push(`${t.name} ${String(m.entry).toUpperCase()}`)}return out}
 async function progressTurn(){const c=ctx();if(!c.mgr)return;const p=+c.b.phase||0;const next={0:1,1:2,2:3,3:5,5:0}[p];if(next==null)return;return setPhase(next)}
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
   case 'dexmgr':{if(!(c.gm||d.tid===c.seat))return;return window.OM_DEX_UI&&window.OM_DEX_UI.openMgr(d.tid)}
   case 'skillp':{if(!(c.mgr||d.tid===c.seat))return;return openMyosu(d.tid)}
   case 'skillck':{if(!(c.mgr||d.tid===c.seat))return;return window.OM_SKILL_UI&&window.OM_SKILL_UI.openPlayer(d.tid)}
   case 'enter':return enterMon(d.mid);
   case 'pend':return pendMon(d.mid);
   case 'simul':return A().set(['battle','simul'],!!val);
   case 'start':return startBattle();
   case 'pendgo':return applyPending();
   case 'exit':return exitMon(d.mid,{noAsk:true});
   case 'exitx':return exitMon(d.mid);
   case 'fswitch':return forcedSwitch(d.mid);
   case 'edit':return openEdit(d.mid);
   case 'hp':return openHp(d.mid);
   case 'pots':return openPots(d.mid);
   case 'fxoff':{const m=b.mons[d.mid];if(!m||!canEdit(c,m))return;const nm=d.nm||'';const all=FX().chips(m).filter(ch=>ch.name===nm);const compound=nm&&all.length>1;
    if(!confirm(compound?`「${nm}」 의 효과 ${all.length}개를 모두 해제할까?\n${all.map(x=>'· '+x.t).join('\n')}`:`「${nm}」 효과를 해제할까?`))return;
    const nb=JSON.parse(JSON.stringify(b));const x=nb.mons[d.mid];if(compound)FX().removeByName(x,nm);else FX().remove(x,d.fx);await A().set(['battle','mons',d.mid],x);return A().sysLog(`${m.name} 「${nm}」 해제${compound?' ('+all.length+'개)':''}`,'battle')}
   case 'announce':{const m=b.mons[d.mid];if(!m||!canEdit(c,m))return;const [kind,name]=[d.kind,d.pot];const src=kind==='trait'?{name:m.ability,eff:m.abilityEff}:kind==='item'?{name:m.item,eff:m.itemEff}:potSrc(m).find(p=>p&&p.name===name)||{name,eff:''};
    return A().sysLog(`【${({pot:'포텐셜',trait:'특성',item:'소지품'})[kind]}】 ${m.name} 『${src.name}』`,'battle',{mid:m.id,img:m.image||'',eff:String(src.eff||'').replace(/<br\s*\/?>/g,'\n').slice(0,400)})}
   case 'objects':return openObjects(d.side);
   case 'turnset':{if(!c.mgr)return;const v=prompt('턴 번호',String(b.turn||0));if(v==null)return;const n=Math.max(0,parseInt(v,10)||0);await A().set(['battle','turn'],n);return A().sysLog(`턴을 ${n}(으)로 맞췄다`,'battle')}
   case 'dex':return window.OM_DEX_UI&&window.OM_DEX_UI.open(d.mid,c.gm?'':(c.seat||'_view'));
   case 'attack':return openAttack(d.mid);
   case 'usepot':case 'restorepot':{const m=b.mons[d.mid];if(!m||!canEdit(c,m))return;const L=potList(m);const p=L.find(x=>x.name===d.pot);if(!p)return;const u=Object.assign({},m.potUses||{});const cur=u[p.name]==null?p.max:+u[p.name];u[p.name]=d.act==='usepot'?Math.max(0,cur-1):Math.min(p.max,cur+1);if(d.act==='usepot'&&wantCut(m,p.name))cutFire('m:'+m.id,m.image,m.name,`『${p.name}』`,m.side==='left'?'#1f6fd1':'#e3101f');
    await A().set(['battle','mons',d.mid,'potUses'],u);
    if(d.act==='usepot'){ /* 횟수를 깎으면서 효과 글을 카드로 띄운다 (자동화가 있으면 그 카드가 대신 뜬다) */
     const fired=FX()?await fireAuto(d.mid,'pot',p.name,{quiet:true}):false;
     if(fired)A().sysLog(`${m.name} 『${p.name}』 남은 ${u[p.name]}/${p.max}`,'battle');
     else{const src=potSrc(m).find(x=>x&&x.name===p.name)||{};A().sysLog(`【포텐셜】 ${m.name} 『${p.name}』\n사용 — 남은 ${u[p.name]}/${p.max}`,'battle',{mid:m.id,img:m.image||'',eff:String(src.eff||'').replace(/<br\s*\/?>/g,'\n').slice(0,400)})}}
    else A().sysLog(`${m.name} 『${p.name}』 횟수 +1 (남은 ${u[p.name]}/${p.max})`,'battle');return}
   case 'fireauto':{const m=b.mons[d.mid];if(!m||!canEdit(c,m))return;if(d.kind==='pot'&&wantCut(m,d.pot))cutFire('m:'+m.id,m.image,m.name,`『${d.pot}』`,m.side==='left'?'#1f6fd1':'#e3101f');return fireAuto(d.mid,d.kind,d.pot)}
   case 'time':return c.mgr?requestTime(d.mid):openMyosu(c.seat,d.mid);
   case 'myosu':return openMyosu(d.tid);
   case 'timeok':return grantTime(d.seat);
   case 'cmdsave':return saveCmd(d.tid,false);
   case 'ufire':return openUfire(d.tid,d.pot);
   case 'ready':return toggleReady(d.tid);
   case 'cmdload':return loadCmd(d.tid);
   case 'reveal':return reveal();
   case 'order':return computeOrder();
   case 'progress':return progressTurn();
   case 'turnstart':{await A().set(['ready'],{});await A().set(['battle','cmds'],{});await A().set(['battle','phase'],1);A().sysLog('턴 개시 — 각자 지시를 공개하세요 (에리어마다 「공개」)','battle');return}
   case 'revealmon':return revealOne(d.tid,d.mid);
   case 'fire':return openFire(d.tid);
   case 'onext':{const n=Math.min((c.b.order||[]).length,(+c.b.orderIdx||0)+1);await A().set(['battle','orderIdx'],n);if((+c.b.phase||0)===2)await A().set(['battle','phase'],3);if(n<(c.b.order||[]).length)A().sysLog(`▶ ${c.b.order[n].name}의 행동`,'battle');else{A().sysLog('행동 순서 끝 — 턴 종료 처리','battle');if(confirm('행동이 모두 끝났다. 턴 종료 처리를 할까? (비례 대미지·지속 턴·임시 랭크 해제·턴 +1)'))await turnEnd()}return}
   case 'oprev':{await A().set(['battle','orderIdx'],Math.max(0,(+c.b.orderIdx||0)-1));return}
   case 'ojump':{if(!c.mgr)return;await A().set(['battle','orderIdx'],+d.i);return}
   case 'turnend':return turnEnd();
   case 'resetcmd':if(!confirm('공개된 지시와 준비 상태를 지울까?'))return;CMD={};await A().set(['battle','cmds'],{});await A().set(['ready'],{});return}}

 /* 등장: 더블(2:2)이 기본. 트레이너가 둘이면 첫 트레이너 A, 둘째 B 가 기본 자리. 빈 자리가 아니면 고른다. */
 async function enterMon(mid,area,opt){opt=opt||{};const c=ctx();const b=c.b;const m=b.mons[mid];if(!m||!(canEdit(c,m)||(opt.sys&&c.mgr)))return;
  const ent=entered(b,m.side);const areas=AREAS.slice(0,mode(b));
  if(!area){const tids=((b.sides||{})[m.side]||{}).trainers||[];const pref=areas[Math.min(tids.indexOf(m.tid),areas.length-1)]||areas[0];
   const free=areas.filter(a=>!ent[a]);
   if(areas.length===1)area=areas[0];
   else if(!ent[pref])area=pref;
   else if(free.length)area=free[0];
   else{const md=A().openModal(`<div class="mhead"><h2>${esc(m.name)} 등장 — 에리어</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
     <div class="row">${areas.map(a=>`<button class="btn ${ent[a]?'ghost':'pri'}" data-area="${a}">${a.toUpperCase()}${ent[a]?' · '+esc(ent[a].name)+' 과 교대':' · 빈 자리'}</button>`).join('')}</div>`);
    md.querySelectorAll('[data-area]').forEach(bt=>bt.onclick=()=>{A().closeModal();enterMon(mid,bt.dataset.area,opt)});return}}
  if(!areas.includes(area))return A().toast('그런 에리어가 없다');
  const occ=ent[area];
  if(occ&&occ.id!==mid){await exitMon(occ.id,{forced:!!opt.forced,noAsk:!!opt.noAsk,sys:!!opt.sys})}
  const started=(+b.phase||0)!==0;
  await A().set(['battle','mons',mid,'entry'],area);await A().set(['battle','mons',mid,'started'],started);if(!m.seen)await A().set(['battle','mons',mid,'seen'],true);if(m.pend)await A().set(['battle','mons',mid,'pend'],null);
  A().sysLog(`${m.name} 등장 (${SIDE_KO[m.side]} ${area.toUpperCase()})${occ&&occ.id!==mid?' ← '+occ.name:''}`,'battle');
  /* 배턴터치 받기 */
  {const nb=JSON.parse(JSON.stringify(ctx().b));const t=nb.trainers[m.tid];if(t&&t.batton&&t.batton.from!==m.name){const L=applyBatton(nb,nb.mons[mid]);await A().set(['battle','mons',mid],nb.mons[mid]);await A().set(['battle','trainers',m.tid,'batton'],null);if(L.length)A().sysLog(L.join('\n'),'battle')}}
  /* 설치기 (맵툴 hazard_eval): 등장한 쪽의 설치기를 평가한다 */
  if(F()){const nb=JSON.parse(JSON.stringify(ctx().b));const nm=nb.mons[mid];nm.entry=area;const f=fieldOf(nb);const oppSide=m.side==='left'?'right':'left';const opp=entered(nb,oppSide);
   const r=F().hazardsOnEntry(nm,f,opp);if(r.lines.length){if(nm.hp.cur<=0){nm.entry='';r.lines.push(`${nm.name}은(는) 쓰러졌다!`)}else if(r.forced){nm.entry='';r.lines.push(`${nm.name}은(는) 튕겨 나갔다 — 다른 포켓몬을 내보내야 한다`)}
    await A().set(['battle','mons'],nb.mons);await A().set(['battle','field'],f);A().sysLog(`설치기 처리\n${r.lines.join('\n')}`,'battle')}}
  if(FX()&&(ctx().b.mons[mid]||{}).entry)await autoOnEntry(mid)}
 /* 동시 내밀기: 주인이 예약(pend)해 두고, GM 의 「시합 개시」·「내밀기 실행」 때 한꺼번에 등장 (상대는 예약을 못 본다) */
 async function pendMon(mid,area){const c=ctx();const b=c.b;const m=b.mons[mid];if(!m||!canEdit(c,m))return;
  if(m.pend){await A().set(['battle','mons',mid,'pend'],null);return}
  const areas=AREAS.slice(0,mode(b));const taken=Object.values(b.mons).filter(x=>x.side===m.side&&x.id!==m.id&&x.pend).map(x=>x.pend);const ent=entered(b,m.side);
  if(!area){const free=areas.filter(a=>!taken.includes(a));if(areas.length===1)area=areas[0];else if(free.length===1&&areas.every(a=>taken.includes(a)||a===free[0]))area=free[0];
   else{const md=A().openModal(`<div class="mhead"><h2>${esc(m.name)} 내밀기 예약 — 에리어</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="row">${areas.map(a=>`<button class="btn ${taken.includes(a)?'ghost':'pri'}" data-area="${a}">${a.toUpperCase()}${taken.includes(a)?' · 이미 예약':ent[a]?' · '+esc(ent[a].name)+' 과 교대':' · 빈 자리'}</button>`).join('')}</div>`);
    md.querySelectorAll('[data-area]').forEach(bt=>bt.onclick=()=>{A().closeModal();pendMon(mid,bt.dataset.area)});return}}
  await A().set(['battle','mons',mid,'pend'],area);A().toast(`${m.name} 내밀기 예약 (${area.toUpperCase()}) — GM 이 실행하면 나온다`);
  const nb=ctx().b;const L=pendCount(nb,'left'),R=pendCount(nb,'right');if(L.need>0&&R.need>0&&L.n>=L.need&&R.n>=R.need)A().sysLog(`양쪽 내밀기 예약 완료 — GM 「${nb.started?'내밀기 실행':'시합 개시'}」`,'battle')}
 async function applyPending(){const c=ctx();if(!c.mgr)return 0;const b=c.b;const list=Object.values(b.mons||{}).filter(m=>m.pend&&m.hp.cur>0);if(!list.length)return 0;
  A().sysLog('동시 내밀기!','battle');for(const {id,pend} of list.map(m=>({id:m.id,pend:m.pend}))){await enterMon(id,pend,{sys:true})}return list.length}   /* pend 는 enterMon 이 지운다 — 먼저 지우면 set 의 낙관적 반영으로 m.pend 가 사라져 예약 에리어를 잃는다 */
 async function startBattle(){const c=ctx();if(!c.mgr)return;const b=c.b;if(b.started)return;
  if(b.simul){const n=await applyPending();if(!n&&!Object.values(b.mons||{}).some(m=>m.entry)){if(!confirm('예약된 포켓몬이 없다. 그래도 시합을 개시할까?'))return}}
  for(const tid of Object.keys(b.trainers||{}))if((b.trainers[tid]||{}).time)await A().set(['battle','trainers',tid,'time'],null);
  await A().set(['battle','started'],true);if(!(+b.turn||0))await A().set(['battle','turn'],1);A().sysLog('시합 개시! — TURN 1','battle');battleStartCut(ctx().b)}
 /* 퇴장 정리 (맵툴 out_area): 랭크·배율·임시 효과·발동 중인 포텐셜 효과·타입/특성 변경·하늘 위·급소 방호 를 되돌리고, 상태 이상(abn) 과 원념·빈사 빼고는 상태도 푼다.
    배턴터치면 랭크와 넘길 수 있는 상태(bat) 를 트레이너에게 맡겨 두었다가 다음 등장 포켓몬이 받는다. 강제 교대는 배턴터치 없이 정리만 */
 function passable(m){const st=(DB().states||{}).st||{};const rk=Object.values(m.rank||{}).some(v=>+v);const bs=Object.keys(m.states||{}).filter(k=>m.states[k]&&(st[k]||{}).bat);return rk||bs.length>0||!!(+m.critBuff)}
 function outReset(nb,m,opt){opt=opt||{};const st=(DB().states||{}).st||{};const L=[];const t=nb.trainers[m.tid];
  if(opt.batton&&t){const states={};for(const k in (m.states||{}))if(m.states[k]&&(st[k]||{}).bat)states[k]=m.states[k];t.batton={rank:Object.assign({},m.rank||{}),states,critBuff:+m.critBuff||0,from:m.name};L.push(`${m.name} 「배턴터치」 — 랭크·상태를 다음 포켓몬에게 넘긴다`)}
  /* 효과(배율 출처 포함)를 먼저 풀고 나서 랭크·배율을 비운다 — 순서가 바뀌면 배율이 역으로 나뉘어 0.75 같은 값이 남는다 */
  if(FX()){const n=FX().chips(m).length;FX().removeAll(m);if(n)L.push(`${m.name} 발동 중인 효과 ${n}개 해제`)}
  m.rank={};delete m.tempRank;m.mod={};delete m.tempMod;delete m.critBuff;if(m.fx)m.fx.mults=[];
  const gone=[];for(const k in (m.states||{})){if(!m.states[k])continue;const d=st[k]||{};if(d.abn||k==='Grudge'||k==='Dead')continue;delete m.states[k];gone.push(d.ko||k)}
  delete m.flags;delete m.prioDown;delete m.fxDone;if(m.tera!=null)m.teraActive=false;m.entry='';
  if(gone.length)L.push(`${m.name} 상태 해제: ${gone.join('·')}`);return L}
 function applyBatton(nb,m){const t=nb.trainers[m.tid];const bt=t&&t.batton;if(!bt)return [];delete t.batton;m.rank=Object.assign({},bt.rank||{});m.states=Object.assign({},m.states||{},bt.states||{});if(bt.critBuff)m.critBuff=bt.critBuff;
  const st=(DB().states||{}).st||{};const rk=Object.entries(m.rank).filter(([k,v])=>+v).map(([k,v])=>(FX()?FX().STAT_KO[k]:k)+(v>0?'+':'')+v);const ss=Object.keys(bt.states||{}).map(k=>(st[k]||{}).ko||k);
  return [`${m.name} 「배턴터치」 받음 (${bt.from||''}) ${[...rk,...ss].join(' · ')||'없음'}`]}
 async function exitMon(mid,opt){const c=ctx();const m=c.b.mons[mid];if(!m||!(canEdit(c,m)||(opt&&opt.sys&&c.mgr)))return;
  if(!opt){ /* 카드의 「퇴장」: 작은 창에서 고른다 */
   const bench=Object.values(c.b.mons).filter(x=>x.tid===m.tid&&!x.entry&&!x.pend&&x.hp.cur>0&&x.id!==mid);const ps=passable(m);
   const md=A().openModal(`<div class="mhead"><h2>${esc(m.name)} 퇴장 (특수)</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
    <div class="firelist"><label class="firerow ${ps?'':'dis'}" data-ex="batton"><b>배턴터치 퇴장</b><span class="small dim">${ps?'랭크와 넘길 수 있는 상태를 다음에 나오는 포켓몬에게':'넘길 랭크·상태가 없다'}</span></label>
    <label class="firerow ${bench.length?'':'dis'}" data-ex="forced"><b>강제 교대</b><span class="small dim">${bench.length?'배턴터치 없이 나가고 벤치에서 무작위 한 마리가 같은 자리로':'벤치에 교대할 포켓몬이 없다'}</span></label></div>`);
   md.querySelectorAll('[data-ex]').forEach(el=>el.onclick=()=>{const k=el.dataset.ex;if(k==='forced'&&!bench.length)return;if(k==='batton'&&!ps)return;A().closeModal();if(k==='forced')return forcedSwitch(mid);exitMon(mid,{batton:k==='batton',noAsk:true})});return}
  let batton=!!opt.batton;if(!batton&&!opt.forced&&passable(m)&&!opt.noAsk)batton=confirm(`${m.name} 퇴장 — 「배턴터치」인가? (랭크·넘길 수 있는 상태를 다음 포켓몬에게)\n취소 = 그냥 퇴장`);
  const nb=JSON.parse(JSON.stringify(c.b));const L=outReset(nb,nb.mons[mid],{batton});await A().set(['battle','mons',mid],nb.mons[mid]);if(batton)await A().set(['battle','trainers',m.tid,'batton'],nb.trainers[m.tid].batton);
  A().sysLog(`${m.name} ${opt.forced?'강제 퇴장':'퇴장'}${L.length?'\n'+L.join('\n'):''}`,'battle')}
 /* 강제 교대 (맵툴 change_forced): 배턴터치 없이 나가고, 벤치에서 아무 포켓몬이나 같은 에리어로 */
 async function forcedSwitch(mid){const c=ctx();const b=c.b;const m=b.mons[mid];if(!m||!canEdit(c,m)||!m.entry)return;
  const bench=Object.values(b.mons).filter(x=>x.tid===m.tid&&!x.entry&&!x.pend&&x.hp.cur>0&&x.id!==mid);if(!bench.length)return A().toast('교대할 포켓몬이 벤치에 없다');
  const area=m.entry;const pick=bench[Math.floor(Math.random()*bench.length)];
  await exitMon(mid,{forced:true});A().sysLog(`강제 교대 → ${pick.name}`,'battle');await enterMon(pick.id,area,{forced:true})}

 /* ----- 지시 저장 · 준비 · 공개 ----- */
 function cleanCmd(cur){const out={mons:{},detail:cur.detail||'',upots:cur.upots||[]};for(const k in cur.mons){const x=cur.mons[k];out.mons[k]={move:x.move,switch:x.switch,targets:x.targets||[],prio:x.prio||{},ochg:x.ochg||{},order:x.order||'',command:x.command||'',pots:x.pots||[]}}return out}
 /* 공개용: 선행 입력(지령·명령)은 뺀다 — 발동할 때 드러난다 */
 function pubMon(x){x=x||{};return {move:x.move,switch:x.switch,targets:x.targets||[],prio:x.prio||{},ochg:x.ochg||{}}}
 async function saveCmd(tid,quiet){const c=ctx();const cur=CMD[tid];if(!cur)return;
  try{await DBS().secretPut(c.ST.room,c.ST.secret,'cmd',tid,cleanCmd(cur));if(!quiet)A().toast('지시를 저장했다 (공개 전까지 GM만 본다)');if((c.ST.state.ready||{})[tid])await putShape(tid);return true}catch(e){A().toast('저장 실패: '+e.message);return false}}
 /* 지시의 「꼴」만 공개 칸에 둔다 — 「타임」이 보는 건 교대인지 기술인지뿐 (맵툴 active_command_expert 와 같다) */
 async function putShape(tid,clear){const c=ctx();const b=c.b;const cur=CMD[tid];const mons={};if(!clear&&cur){for(const mid in cur.mons){const m=b.mons[mid];if(!m||!m.entry)continue;const x=cur.mons[mid];mons[mid]=x.move==='switch'?'switch':(x.move===''||x.move==null)?'none':'move'}}
  try{await A().set(['pub',tid,'shape'],clear?null:{turn:+b.turn||0,mons})}catch(e){}}
 async function loadCmd(tid){const c=ctx();try{const rows=await DBS().secretGet(c.ST.room,c.ST.secret,'cmd');const r=(rows||[]).find(x=>x.id===tid);if(!r)return A().toast('저장된 지시가 없다');CMD[tid]=Object.assign({mons:{},detail:''},r.data);delete CMD[tid].order;delete CMD[tid].command;A().renderScene();A().toast('불러왔다')}catch(e){A().toast(e.message)}}
 async function toggleReady(tid){const c=ctx();const rd=!!(c.ST.state.ready||{})[tid];
  if(!rd){const ok=await saveCmd(tid,true);if(!ok)return}
  if(rd&&!c.mgr&&(+c.b.phase||0)>=1)return A().toast('턴이 시작돼서 준비를 풀 수 없다');
  const path=c.mgr?['ready',tid]:['ready',c.seat];
  await putShape(tid,rd);
  await A().set(path,rd?null:true);A().sysLog(`${((c.b.trainers||{})[tid]||{}).name||tid} ${rd?'준비 해제':'준비 완료'}`,'battle')}
 /* 턴 개시: 선행 입력한 지령·명령의 횟수를 미리 깎는다 (맵툴 set_turn_start). 주인의 호령(tc 7)은 능력·회복이 횟수를 같이 쓴다 */
 function chargeOne(t,data,b){t.orderCount=t.orderCount||{};const tc=OO().styles(t).tc;
  for(const mid in (data.mons||{})){const m=b.mons[mid];if(!m||!m.entry||m.hp.cur<=0)continue;const x=data.mons[mid];
   if(x.order){const k='order_'+x.order;t.orderCount[k]=Math.max(0,(+t.orderCount[k]||0)-1)}
   if(x.command){if(tc===7){t.orderCount.command_attack=Math.max(0,(+t.orderCount.command_attack||0)-1);t.orderCount.command_defense=Math.max(0,(+t.orderCount.command_defense||0)-1)}else{const k='command_'+x.command;t.orderCount[k]=Math.max(0,(+t.orderCount[k]||0)-1)}}}}
 async function preCharge(){const c=ctx();const b=c.b;const key=turnKey(b);
  if(!c.gm)return selfCharge();
  let rows;try{rows=await DBS().secretGet(c.ST.room,c.ST.secret,'cmd')}catch(e){return}
  const trs=JSON.parse(JSON.stringify(ctx().b.trainers||{}));let any=false;
  for(const r of rows||[]){const t=trs[r.id];if(!t||!r.data||t.pcTurn===key)continue;if(c.fair&&seatOwned(c,r.id))continue;chargeOne(t,r.data,b);t.pcTurn=key;any=true}
  if(any)await A().set(['battle','trainers'],trs)}
 /* 좌석: 내 지시의 선입력분은 내 화면이 깎는다 (모의전 · GM 불간섭 · GM 이 없을 때) */
 const BUSY={},SENT={};
 async function selfCharge(){const c=ctx();const b=c.b;const tid=c.seat;const t=(b.trainers||{})[tid];if(c.role!=='seat'||!t)return;const key=turnKey(b);if(t.pcTurn===key||BUSY.pc===key)return;BUSY.pc=key;
  const cm=await myCmd(c,tid,true);const t2=JSON.parse(JSON.stringify((ctx().b.trainers||{})[tid]||t));if(t2.pcTurn===key)return;if(cm)chargeOne(t2,cm,ctx().b);t2.pcTurn=key;await A().set(['battle','trainers',tid],t2)}
 /* 상태가 바뀔 때마다 (app.js onState): 턴 개시면 내 선입력 차감, 공개 요청이 오면 내 남은 지시를 연다, 진행자는 자동으로 넘긴다 */
 async function watch(){const c=ctx();const b=c.b;if((+b.phase||0)!==1)return;
  if(c.role==='seat'&&c.seat&&(b.trainers||{})[c.seat]){await selfCharge();
   const key=turnKey(b);if(String(b.revealReq||'')===key&&!BUSY.rv){const mine=Object.values(b.mons||{}).filter(m=>m.tid===c.seat&&m.entry&&m.hp.cur>0&&!revealed(b,c.seat,m.id)&&!SENT[key+':'+m.id]);
    if(mine.length){BUSY.rv=1;try{for(const m of mine){if(revealed(ctx().b,c.seat,m.id))continue;SENT[key+':'+m.id]=1;await revealOne(c.seat,m.id,true)}}finally{BUSY.rv=0}}}}
  autoAdvance()}
 /* ----- 4식 6령 발동 창 (맵툴 order_mgr / order_run): 선행 발동 · 임의 발동 · 강제 ----- */
 function openFire(tid){const c=ctx();const b=c.b;const t=(b.trainers||{})[tid];if(!t)return;if(!c.gm&&c.seat!==tid)return;
  const mons=Object.values(b.mons||{}).filter(m=>m.tid===tid&&m.entry&&m.hp.cur>0).sort((x,y)=>x.entry.localeCompare(y.entry));if(!mons.length)return A().toast('필드에 포켓몬이 없다');
  UIC.fire=UIC.fire||{};if(!mons.find(m=>m.id===UIC.fire[tid]))UIC.fire[tid]=mons[0].id;const m=mons.find(x=>x.id===UIC.fire[tid]);
  const cnt=t.orderCount||{};const fired=(((b.cmds||{})[tid]||{}).fired||{})[m.id]||{};const ph=+b.phase||0;
  const md=A().openModal(`<div class="mhead"><h2>4식 6령 · ${esc(t.name)}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="tabs2">${mons.map(mm=>`<div class="tab2 ${mm.id===m.id?'on':''}" data-ftab="${mm.id}"><div class="pic" style="${mm.image?`background-image:url('${cssu(mm.image)}')`:''}"></div><div><b>${esc(mm.name)}</b><small>에리어 ${mm.entry.toUpperCase()}</small></div></div>`).join('')}</div>
   <div class="firepre small dim" id="firepre">선행 입력을 읽는 중…</div>
   ${(()=>{const U=uniqList(t);const E=specialPots(m);const fp=fired.pot||{};const row=(sk,x)=>{const n=x.p.name;const done=!!fp[(sk==='uq'?'u:':'e:')+n];const can=x.left===null||x.left>0;
     return `<div class="firerow ${done?'done':''}" data-sk="${sk}" data-sn="${esc(n)}"><b class="fnm"><span class="tag ${sk==='uq'?'uqt':'ext'}">${sk==='uq'?'고유':'전용'}</span> 『${esc(n)}』</b><span class="fcnt">${x.max!=null?`남은 <b>${x.left}/${x.max}</b>`:'횟수 없음'}</span><span class="sp"></span>
      <button class="btn sm pri" data-sfire="pre" data-sk="${sk}" data-sn="${esc(n)}" hidden>선행 발동</button><button class="btn sm" data-sfire="free" data-sk="${sk}" data-sn="${esc(n)}" ${can&&ph>=1?'':'disabled'}>임의 발동</button>${c.gm?`<button class="btn sm ghost" data-sfire="force" data-sk="${sk}" data-sn="${esc(n)}">강제</button>`:''}</div><div class="small dim" style="padding:0 10px 6px">${esc(String(x.p.eff||'').replace(/<br\s*\/?>/g,' ').slice(0,220))}</div>`};
    return `${U.length?`<div class="sec">고유 포텐셜 <span class="note">${esc(t.name)} · 대상 ${esc(m.name)} (에리어 ${m.entry.toUpperCase()})</span></div><div class="firelist">${U.map(x=>row('uq',x)).join('')}</div>`:''}${E.length?`<div class="sec">전용 포텐셜 <span class="note">${esc(m.name)}</span></div><div class="firelist">${E.map(x=>row('ex',x)).join('')}</div>`:''}`})()}
   ${[['order','지령 (4식)',OO().orderKeys(t),k=>OO().orderName(t,k)],['command','명령 (6령)',OO().commandKeys(t),k=>OO().commandName(t,k)]].map(([kind,title,keys,nm])=>`<div class="sec">${title}</div><div class="firelist">${keys.map(k=>{const ck=(kind==='order'?'order_':'command_')+k;const n=+cnt[ck]||0;const done=fired[kind]===k;
    return `<div class="firerow ${done?'done':''}" data-fk="${k}" data-kind="${kind}"><b class="fnm">『${esc(nm(k))}』</b><span class="fcnt">남은 <b>${n}</b></span><span class="sp"></span>
     <button class="btn sm pri" data-fire="pre" data-kind="${kind}" data-k="${k}" hidden>선행 발동</button><button class="btn sm" data-fire="free" data-kind="${kind}" data-k="${k}" ${n>0&&ph>=1?'':'disabled'} title="남은 횟수 1을 써서 바로 발동">임의 발동</button>${c.gm?`<button class="btn sm ghost" data-fire="force" data-kind="${kind}" data-k="${k}" title="횟수·입력과 상관없이 발동">강제</button>`:''}</div>`}).join('')||'<div class="small dim">쓰는 항목이 없다</div>'}</div>`).join('')}
   <div class="small dim" style="margin-top:8px">선행 발동 : 지시 입력에서 선행 입력한 것을 그 순간 발동 (턴 개시 때 횟수를 깎았다) · 임의 발동 : 남은 횟수 1을 써서 지금 발동 · 강제 : GM 이 횟수와 상관없이</div>`);
  md.querySelectorAll('[data-ftab]').forEach(el=>el.onclick=()=>{UIC.fire[tid]=el.dataset.ftab;A().closeModal();openFire(tid)});
  /* 선행 입력 읽기 (주인·GM 만 읽을 수 있다) */
  myCmd(c,tid,true).then(cm=>{const pre=$('#firepre',md);if(!pre)return;const x=cm&&cm.mons&&cm.mons[m.id]||{};const parts=[];
   for(const kind of ['order','command']){const k=x[kind];if(!k)continue;const nm=kind==='order'?OO().orderName(t,k):OO().commandName(t,k);parts.push(`${kind==='order'?'지령':'명령'} 『${esc(nm)}』${fired[kind]===k?' (발동함)':''}`);
    const bt=md.querySelector(`[data-fire="pre"][data-kind="${kind}"][data-k="${k}"]`);if(bt&&ph>=1&&fired[kind]!==k)bt.hidden=false;const row=md.querySelector(`.firerow[data-kind="${kind}"][data-fk="${k}"]`);if(row)row.classList.add('pre')}
   const fp=fired.pot||{};for(const [sk,list] of [['uq',(cm&&cm.upots)||[]],['ex',x.pots||[]]])for(const n of list){const key=(sk==='uq'?'u:':'e:')+n;const bt=md.querySelector(`[data-sfire="pre"][data-sk="${sk}"][data-sn="${CSS.escape(n)}"]`);if(!bt)continue;parts.push(`${sk==='uq'?'고유':'전용'} 『${esc(n)}』${fp[key]?' (발동함)':''}`);if(ph>=1&&!fp[key])bt.hidden=false;const r=bt.closest('.firerow');if(r)r.classList.add('pre')}
   pre.innerHTML=`${esc(m.name)} (에리어 ${m.entry.toUpperCase()}) 선행 입력: ${parts.join(' · ')||'<span class="dim">없음</span>'}${ph<1?' <span class="dim">— 턴 개시 뒤에 발동할 수 있다</span>':''}`}).catch(()=>{});
  md.querySelectorAll('[data-fire]').forEach(bt=>bt.onclick=()=>fireOrder(tid,m.id,bt.dataset.kind,bt.dataset.k,bt.dataset.fire));
  md.querySelectorAll('[data-sfire]').forEach(bt=>bt.onclick=()=>fireSpecial(tid,m.id,bt.dataset.sk,bt.dataset.sn,bt.dataset.sfire))}
 /* 트레이너 칸의 고유 「발동」: 대상(필드의 내 포켓몬 · 없으면 대상 없이) · 선행/임의/강제 를 고른다 */
 async function openUfire(tid,name){const c=ctx();const b=c.b;const t=(b.trainers||{})[tid];if(!t)return;if(!c.gm&&c.seat!==tid)return;const x=uniqList(t).find(q=>q.p.name===name);if(!x)return;
  const mons=Object.values(b.mons||{}).filter(m=>m.tid===tid&&m.entry&&m.hp.cur>0).sort((p,q)=>p.entry.localeCompare(q.entry));const ph=+b.phase||0;
  const md=A().openModal(`<div class="mhead"><h2><span class="tag uqt">고유</span> 『${esc(name)}』</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="small" style="margin-bottom:8px;white-space:pre-wrap">${esc(String(x.p.eff||'').replace(/<br\s*\/?>/g,'\n'))}</div>
   <div class="small dim">${esc(t.name)} · ${x.max!=null?`남은 ${x.left}/${x.max}`:'횟수 없음'}</div>
   <div class="sec">대상</div><div class="pool">${mons.map((m,i)=>`<div class="oc ${i===0?'mine':''}" data-ut="${m.id}"><b>${esc(m.name)}</b><small>에리어 ${m.entry.toUpperCase()}</small></div>`).join('')}<div class="oc ${mons.length?'':'mine'}" data-ut=""><b>대상 없음</b><small>트레이너만</small></div></div>
   <div class="small dim" id="upre" style="margin-top:6px">선행 입력 확인 중…</div>
   <div class="row" style="margin-top:10px"><span class="sp"></span><button class="btn pri" data-uf="pre" hidden>선행 발동</button><button class="btn" data-uf="free" ${x.left===null||x.left>0?'':'disabled'}>임의 발동</button>${c.gm?'<button class="btn ghost" data-uf="force">강제</button>':''}</div>`);
  let tgt=mons[0]?mons[0].id:'';md.querySelectorAll('[data-ut]').forEach(el=>el.onclick=()=>{tgt=el.dataset.ut;md.querySelectorAll('[data-ut]').forEach(o=>o.classList.toggle('mine',o===el))});
  md.querySelectorAll('[data-uf]').forEach(bt=>bt.onclick=()=>fireSpecial(tid,tgt,'uq',name,bt.dataset.uf));
  try{const rows=await DBS().secretGet(c.ST.room,c.ST.secret,'cmd');const r=(rows||[]).find(q=>q.id===tid);const cm=r&&(r.data||r.v||r.value||r);const up=(cm&&cm.upots)||[];const el=$('#upre',md);if(el)el.textContent=up.includes(name)?'이번 턴에 선행 입력했다':'선행 입력 안 함';if(up.includes(name)&&ph>=1){const p=md.querySelector('[data-uf=pre]');if(p)p.hidden=false}}catch(e){const el=$('#upre',md);if(el)el.textContent=''}}
 /* 고유(트레이너) · 전용 포텐셜 발동: 선행(지시에서 선행 입력한 것) · 임의 · 강제(GM). 횟수는 발동할 때 1 깎는다(강제 제외). 자동화가 있으면 대상 포켓몬에 걸고, 없으면 효과를 로그 카드로 */
 async function fireSpecial(tid,mid,sk,name,how){const c=ctx();const b=c.b;const t=(b.trainers||{})[tid];const m=(b.mons||{})[mid]||null;if(!t||(!m&&sk!=='uq'))return;if(!c.gm&&c.seat!==tid)return;if(how==='force'&&!c.gm)return;
  const x=sk==='uq'?uniqList(t).find(q=>q.p.name===name):specialPots(m).find(q=>q.p.name===name);if(!x)return;
  if(how!=='force'&&x.left!==null&&x.left<=0)return A().toast('남은 횟수가 없다');
  A().closeModal();const tag=how==='pre'?'【선행】':how==='free'?'【임의】':'【강제】';const LB=sk==='uq'?'고유':'전용';
  if(how!=='force'&&x.max!=null){if(sk==='uq'){const uu=Object.assign({},t.uUses||{});uu[name]=Math.max(0,x.left-1);await A().set(['battle','trainers',tid,'uUses'],uu)}else{const uu=Object.assign({},m.potUses||{});uu[name]=Math.max(0,x.left-1);await A().set(['battle','mons',mid,'potUses'],uu)}}
  await A().set(['battle','cmds',tid,'fired',m?mid:'_t','pot',(sk==='uq'?'u:':'e:')+name],1);
  if(sk==='uq'){if(String(((A().ST.state.rp||{}).cutin||{}).ord)!=='0')cutFire('t:'+tid,trainerImg(t),`${t.name}의 고유!`,`『${name}』`,t.side==='left'?'#1f6fd1':'#e3101f')}else if(wantCut(m,name))cutFire('m:'+m.id,m.image,m.name,`『${name}』`,m.side==='left'?'#1f6fd1':'#e3101f');
  const left=x.max!=null?` 【${how==='force'?x.left:Math.max(0,x.left-1)}/${x.max}】`:'';
  const who=sk==='uq'?t.name:m.name;const tgt=sk==='uq'?(m?` → ${m.name} (에리어 ${String(m.entry).toUpperCase()})`:''):'';const img=sk==='uq'?trainerImg(t):(m.image||'');
  const a=m&&FX()&&FX().autoOf(m,'pot',name);
  if(a&&a.ops&&a.ops.length&&!a.manual){await fireAuto(mid,'pot',name,{quiet:true,head:`【${LB}】 ${who} 『${name}』${left}${tag}${tgt}`,img,eff:String(x.p.eff||'')});return}
  A().sysLog(`【${LB}】 ${who} 『${name}』${left}${tag}${tgt?'\n대상:'+tgt.replace(' →',''):''}`,'battle',{mid:m?m.id:'',img,eff:String(x.p.eff||'').replace(/<br\s*\/?>/g,'\n').slice(0,400)})}
 async function fireOrder(tid,mid,kind,key,how){const c=ctx();const b=JSON.parse(JSON.stringify(c.b));const t=b.trainers[tid];const m=b.mons[mid];if(!t||!m)return;
  const name=kind==='order'?OO().orderName(t,key):OO().commandName(t,key);const ck=(kind==='order'?'order_':'command_')+key;t.orderCount=t.orderCount||{};
  let tag='';
  if(how==='pre'){tag='【선행】'}
  else if(how==='free'){if((+t.orderCount[ck]||0)<=0)return A().toast('남은 횟수가 없어 임의 발동할 수 없다');t.orderCount[ck]=(+t.orderCount[ck]||0)-1;if(OO().styles(t).tc===7){const o=kind==='command'?(key==='attack'?'command_defense':'command_attack'):'';if(o)t.orderCount[o]=Math.max(0,(+t.orderCount[o]||0)-1)}tag='【임의】'}
  else if(how==='force'){if(!c.gm)return;tag='【강제】'}
  const f=fieldOf(b);const fx=applyOrder(b.mons,f,t,name,mid);
  if(!fx.length&&FX()){const a=FX().rm(name);if(a&&a.ops&&a.ops.length&&!a.manual){const r=await FX().run(a.ops,uiCtx(b,m,name,m.entry));fx.push(...r.lines)}}
  A().closeModal();
  const okT=await A().set(['battle','trainers',tid],t);if(!okT)return;if(String(((A().ST.state.rp||{}).cutin||{}).ord)!=='0')cutFire('t:'+tid,trainerImg(t),`${t.name}의 지시!`,`『${name}』`,t.side==='left'?'#1f6fd1':'#e3101f');await A().set(['battle','mons'],b.mons);await A().set(['battle','field'],f);await A().set(['battle','cmds',tid,'fired',mid,kind],key);
  const oeff=(FX()&&FX().rm&&(FX().rm(name)||{}).text)||'';
  A().sysLog(`【${kind==='order'?'지령':'명령'}】 ${t.name}의 지시! 『${name}』 → ${m.name} (에리어 ${String(m.entry).toUpperCase()}) 【${Math.max(0,+t.orderCount[ck]||0)}/시】${tag}${fx.length?'\n'+fx.join('\n'):''}`,'battle',{mid:m.id,img:trainerImg(t),eff:String(oeff).replace(/<br\s*\/?>/g,'\n').slice(0,400)})}
 /* 맵툴 open_command 처럼 에리어(포켓몬) 하나씩 공개한다. 좌석은 자기 것만, GM 은 아무 것이나 */
 function revealed(b,tid,part){const cm=((b.cmds||{})[tid]||{});return part==='orders'?!!cm.revealedOrders:!!((cm.mons||{})[part])}
 async function myCmd(c,tid,quiet){let rows;try{rows=await DBS().secretGet(c.ST.room,c.ST.secret,'cmd')}catch(e){if(!quiet)A().toast('지시를 읽지 못했다: '+e.message);return null}const r=(rows||[]).find(x=>x.id===tid);if(!r){if(!quiet)A().toast('저장된 지시가 없다 — 먼저 「저장」');return null}return r.data}
 function revealCardText(b,t,m,x){if(x.move==='switch')return `${t.name} · ${m.name} (${slotName(b,m.side+'_'+m.entry).replace(/<[^>]+>/g,'')}): 「교대」 → ${monName(b,x.switch)}`;
  if(x.move===''||x.move==null)return `${t.name} · ${m.name}: (행동 없음)`;const mv=(m.moves||[])[+x.move]||{};
  return `${t.name} · ${m.name} (${SIDE_KO[m.side]} ${String(m.entry).toUpperCase()}): 「${mv.name||'?'}」 ${mv.type||''}·${mv.cat||''} · 위력 ${mv.pow||'-'} · 명중 ${mv.acc||'-'}${mv.prio?' · 우선도 '+mv.prio:''}${x.targets&&x.targets.length?' → '+x.targets.map(sl=>slotName(b,sl).replace(/<[^>]+>/g,'')).join(', '):''}${mv.eff&&mv.eff!=='-'?'\n   '+mv.eff:''}`}
 let autoT=null;
 function autoAdvance(){const c=ctx();const b=c.b;if(!c.mgr)return;const me=c.gm?'gm':c.seat;if((b.host||'gm')!==me)return;if((+b.phase||0)!==1)return;if(unrevealed(b).length)return;clearTimeout(autoT);autoT=setTimeout(async()=>{const c2=ctx();if((+c2.b.phase||0)!==1||unrevealed(c2.b).length)return;A().sysLog('지시가 모두 공개됐다 — 행동 순서로','battle');await computeOrder()},800)}
 async function revealOne(tid,part,quiet){const c=ctx();const b=c.b;const t=(b.trainers||{})[tid];if(!t)return;if(!c.gm&&c.seat!==tid)return A().toast('내 지시만 공개할 수 있다');
  if(c.gm&&c.fair&&seatOwned(c,tid))return A().toast('GM 불간섭 설정 — 플레이어의 지시는 그 플레이어가 연다');
  const cm=await myCmd(c,tid,quiet);if(!cm)return;
  const m=b.mons[part];if(!m)return;if(revealed(b,tid,part))return;const x=pubMon((cm.mons||{})[part]);
  await A().set(['battle','cmds',tid,'mons',part],x);if(cm.detail&&!((b.cmds||{})[tid]||{}).detail)await A().set(['battle','cmds',tid,'detail'],cm.detail);A().sysLog('【공개】 '+revealCardText(b,t,m,x),'battle')}
 async function reveal(npcOnly){const c=ctx();if(!c.gm)return;const b=c.b;npcOnly=npcOnly||c.fair;
  let rows;try{rows=await DBS().secretGet(c.ST.room,c.ST.secret,'cmd')}catch(e){return A().toast('지시를 읽지 못했다: '+e.message)}
  const cmds={};(rows||[]).forEach(r=>{if((b.trainers||{})[r.id]&&!(npcOnly&&seatOwned(c,r.id)))cmds[r.id]=r.data});
  if(!Object.keys(cmds).length){if(!npcOnly)A().toast('저장된 지시가 없다');return}
  const already=b.cmds||{};const out={};if(npcOnly)for(const tid in already)if(seatOwned(c,tid))out[tid]=already[tid];
  for(const tid in cmds){const cm=cmds[tid];const al=already[tid]||{};const o={mons:{},detail:cm.detail||'',fired:al.fired||{}};for(const mid in (cm.mons||{})){const m=b.mons[mid];if(!m||!m.entry)continue;o.mons[mid]=al.mons&&al.mons[mid]?al.mons[mid]:pubMon(cm.mons[mid])}out[tid]=o}
  await A().set(['battle','cmds'],out);await A().set(['battle','phase'],Math.max(1,+b.phase||0));
  const lines=[];for(const tid in out){if(!cmds[tid])continue;const t=b.trainers[tid];const cm=out[tid];
   for(const mid in cm.mons){const m=b.mons[mid];if(!m||!m.entry)continue;if(already[tid]&&already[tid].mons&&already[tid].mons[mid])continue;lines.push(revealCardText(b,t,m,cm.mons[mid]))}
   if(cm.detail)lines.push(`${t.name}: ${cm.detail}`)}
  if(lines.length)A().sysLog('【모두 공개】\n'+lines.join('\n'),'battle')}

 /* 지령·명령 효과 (Lib:readymade 의 지령 레디메이드와 같은 내용). 랭크는 임시(턴 종료 해제). 플래그는 flags 에 두고 공격 창이 읽는다 */
 const STATWORD={공격:'attack',방어:'defense',특공:'specialattack',특방:'specialdefense',민첩:'speed',저격:'accuracy',회피:'evasion',스피드:'speed',명중:'accuracy'};
 function tempRank(m,k,d){m.rank=m.rank||{};m.tempRank=m.tempRank||{};const lim=k==='critical'?4:6;const b0=+m.rank[k]||0;const a=Math.max(-lim,Math.min(lim,b0+d));m.rank[k]=a;m.tempRank[k]=(+m.tempRank[k]||0)+(a-b0)}   /* 한계(±6)에 막힌 만큼은 기록하지 않는다 — 턴 종료 해제 때 랭크가 깎이지 않게 */
 function applyOrder(mons,f,t,name,targetId){const out=[];const tgt=mons[targetId];const allies=Object.values(mons).filter(m=>m.side===t.side&&m.entry&&m.hp.cur>0);const enemies=Object.values(mons).filter(m=>m.side!==t.side&&m.entry&&m.hp.cur>0);
  const n=String(name||'');let m;
  if((m=n.match(/^(숙달|전개|방해)?(공격|방어|특공|특방|민첩|회복|저격|회피)지령$/))){const pre=m[1]||'',st=m[2];
   if(st==='회복'){if(pre==='방해'){for(const e of enemies){e.states=e.states||{};if(!e.states.HealBlock)e.states.HealBlock=1}out.push(`상대 전체 「회복봉인」 (턴 종료까지)${enemies.length?'':' — 대상 없음'}`);return out}if(tgt){const v=Math.max(1,Math.floor(tgt.hp.max/4));tgt.hp.cur=Math.min(tgt.hp.max,tgt.hp.cur+v);out.push(`${tgt.name} HP +${v}`)}return out}
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
 async function computeOrder(){const c=ctx();if(!c.mgr)return;const b=c.b;const f=fieldOf(b);const iceUsed=[];
  const slots=allEntered(b);if(!slots.length)return A().toast('등장한 포켓몬이 없다');
  const entries=slots.map(s=>{const cm=((b.cmds||{})[s.mon.tid]||{}).mons||{};const x=cm[s.mon.id]||{};
   const prioMap={},orderMap={};for(const k in (x.prio||{}))if(x.prio[k]!=='')prioMap[k]=+x.prio[k];for(const k in (x.ochg||{}))if(x.ochg[k]!=='')orderMap[k]=+x.ochg[k];
   let prioMod=0;if(x.move!==''&&x.move!=='switch'&&x.move!=null){const mv=(s.mon.moves||[])[+x.move];if(mv)prioMod+=FX()?FX().prioOf(s.mon,mv):(+mv.prio||0);if(mv&&s.mon.prioDown){prioMod-=1;iceUsed.push(s.mon)}}
   const objs=(f.objects||{})[s.side]||{};
   return {slot:s.slot,mon:s.mon,cmd:{change:x.move==='switch',priorityMap:prioMap,orderMap},prioMod,started:!!s.mon.started,scarf:s.mon.item==='구애스카프',tailwind:(objs['순풍']||0)>0,swamp:(objs['습원']||0)>0}});
  const rows=B().turnOrder(entries,{trick:((f.rooms||{})['트릭룸']||0)>0});
  const order=rows.map(r=>{const x=(((b.cmds||{})[r.mon.tid]||{}).mons||{})[r.mon.id]||{};const mv=(x.move!==''&&x.move!=='switch'&&x.move!=null)?(r.mon.moves||[])[+x.move]:null;
   return {slot:r.slot,mid:r.mon.id,name:r.mon.name,side:r.mon.side,change:r.change,started:r.started,order:r.order,prio:r.prio,speed:r.speed,dice:r.dice,move:mv?mv.name:(x.move==='switch'?'교대':''),moveType:mv?mv.typeEn:'',targets:x.targets||[],pursuit:mv?mv.name==='추격':false}});
  /* 추격: 교대하는 대상을 노리면 교대보다 먼저 때린다 */
  const notes=[];if(((f.rooms||{})['트릭룸']||0)>0)notes.push('「트릭룸」이 시공간을 뒤틀었다! (스피드 역순)');
  for(const m of iceUsed)notes.push(`${m.name} 「아이스번」 — 이번 기술 우선도 −1`);
  for(const o of order)if(o.pursuit)for(const t of o.targets){const v=order.find(z=>z.slot===t);if(v&&v.change)notes.push(`${o.name}의 「추격」 — 교대하려는 ${v.name}을(를) 먼저 때린다!`)}
  for(const m of iceUsed)await A().set(['battle','mons',m.id,'prioDown'],null);
  await A().set(['battle','order'],order);await A().set(['battle','orderIdx'],0);await A().set(['battle','orderNotes'],notes);await A().set(['battle','phase'],2);
  cutPhase('행동 순서','');A().sysLog('행동 순서\n'+order.map((o,i)=>`${i+1}. ${o.name} (${o.change?'교대 · ':''}${o.order!==20?'순서 '+o.order+' · ':''}${o.prio?'우선 '+o.prio+' · ':''}스피드 ${Math.round(o.speed)} · d${o.dice})`).join('\n'),'battle')}

 /* ----- 턴 종료 ----- */
 async function turnEnd(){const c=ctx();if(!c.mgr)return;const b=JSON.parse(JSON.stringify(c.b));const f=fieldOf(b);const db=(DB().states||{}).st||{};const lines=[];
  if(F()){const slots={};for(const s of SIDES){const e=entered(b,s);for(const a in e)slots[s+'_'+a]=e[a]}
   const r1=F().turnEndStates(b.mons,slots);lines.push(...r1.lines);const r2=F().turnEndField(b.mons,f);lines.push(...r2.lines);
   for(const mid in b.mons){const m=b.mons[mid];if(m.entry&&m.hp.cur<=0){m.entry='';if(!r1.dead.includes(mid))lines.push(`${m.name}은(는) 쓰러졌다!`)}}}
  else for(const mid in b.mons){const m=b.mons[mid];if(!m.entry||m.hp.cur<=0)continue;
   for(const t of B().turnEnd(m)){if(!t.delta)continue;m.hp.cur=Math.max(0,Math.min(m.hp.max,m.hp.cur+t.delta));lines.push(`${m.name} ${db[t.state]?db[t.state].ko:t.state} ${t.delta>0?'+':''}${t.delta} → ${m.hp.cur}`);if(m.hp.cur<=0){lines.push(`${m.name} 빈사!`);m.entry=''}}}
  for(const mid in b.mons){const m=b.mons[mid];if(!m.entry||m.hp.cur<=0)continue;
   const st=m.states||{};for(const k in st){const v=+st[k];const def=db[k]||{};if(def.prog==='turn'&&v>0&&v<1000){st[k]=v-1;if(st[k]<=0){delete st[k];lines.push(`${m.name} ${def.ko||k} 해제`)}}}
   /* 임시 랭크 해제 */
   if(m.tempRank){for(const k in m.tempRank){{const lim=k==='critical'?4:6;m.rank[k]=Math.max(-lim,Math.min(lim,(+m.rank[k]||0)-(+m.tempRank[k]||0)))}}delete m.tempRank;lines.push(`${m.name} 임시 랭크 해제`)}
   if(m.tempMod){for(const k in m.tempMod){m.mod[k]=Math.round(((+m.mod[k]||1)/(+m.tempMod[k]||1))*1000)/1000;if(m.mod[k]===1)delete m.mod[k]}delete m.tempMod}
   if(m.fx&&m.fx.mults&&m.fx.mults.some(e=>e.temp))m.fx.mults=m.fx.mults.filter(e=>!e.temp);
   if(m.flags)delete m.flags;
   m.started=false}
  if(FX())lines.push(...FX().turnEnd(b));
  for(const mid in b.mons){delete b.mons[mid].flags}
  const dec=(o,k)=>{if(o[k]>0){o[k]--;if(o[k]<=0){delete o[k];return true}}return false};
  if(f.weather.type&&f.weather.count>0){f.weather.count--;if(f.weather.count<=0){lines.push(`날씨 ${f.weather.type} 끝`);f.weather={type:'',count:0}}}
  if(f.terrain.type&&f.terrain.count>0){f.terrain.count--;if(f.terrain.count<=0){lines.push(`${f.terrain.type} 끝`);f.terrain={type:'',count:0}}}
  for(const k of ROOMS)if(dec(f.rooms,k))lines.push(`${k} 끝`);for(const k of ETC)if(dec(f.etc,k))lines.push(`${k} 끝`);
  for(const s of SIDES){f.objects[s]=f.objects[s]||{};for(const k in f.objects[s])if(dec(f.objects[s],k))lines.push(`${SIDE_KO[s]} ${k} 끝`)}
  b.field=f;b.cmds={};b.order=[];b.phase=0;b.turn=(+b.turn||0)+1;CMD={};
  await A().set(['battle'],b);await A().set(['ready'],{});
  cutPhase('턴 종료',`다음 턴 ${b.turn} · 지시 준비`);A().sysLog(`턴 종료 처리${lines.length?'\n'+lines.join('\n'):''}\n— 턴 ${b.turn} 지시 준비`,'battle')}

 /* ---------- 묘수 = 「타임」 (맵툴 command_expert): 지시 준비 페이즈에, 상대 트레이너가 준비를 마치면 상대 포켓몬 하나의 지시 꼴(교대/기술)을 본다.
     횟수는 배틀마다 지시 랭크로(A 1회 · AA 이상 2회) + 포켓몬의 timeAlly/timeEnemy 보정. 한 턴에 한 대상만(다시 보기는 자유). 양쪽이 같은 턴에 쓰면 둘 다 그 턴은 더 못 쓴다. 쓰고 나면 READY 여도 지시를 고칠 수 있다 ---------- */
 function timeOf(t,turn){const x=(t&&t.time)||{};const same=(+x.turn||0)===turn;return {used:+x.used||0,forced:+x.forced||0,sw:same?(+x.sw||0):0,target:same?(x.target||''):''}}
 function timeLimit(c,tid){const b=c.b;const t=(b.trainers||{})[tid];if(!t)return 0;let mod=0;for(const m of Object.values(b.mons||{})){if(!m.entry)continue;if(m.side===t.side)mod+=+(m.timeAlly||0);else mod+=+(m.timeEnemy||0)}return Math.max(0,timeCount(t)+mod)}
 function enemyTids(c,tid){const b=c.b;const t=(b.trainers||{})[tid]||{};return Object.keys(b.trainers||{}).filter(k=>(b.trainers[k]||{}).side&&b.trainers[k].side!==t.side)}
 function timeBlocked(c,tid){const b=c.b;const turn=+b.turn||0;const my=timeOf(b.trainers[tid],turn);if(my.sw===2)return true;return my.sw>=1&&enemyTids(c,tid).some(e=>timeOf(b.trainers[e],turn).sw>=1)}
 function myosuGlow(c,tid){const b=c.b;if((+b.phase||0)!==0)return false;const t=b.trainers[tid];if(!t)return false;const my=timeOf(t,+b.turn||0);if(timeBlocked(c,tid))return false;if(my.sw===0&&my.used>=timeLimit(c,tid))return false;const rd=c.ST.state.ready||{};return enemyTids(c,tid).some(e=>rd[e])}
 const SHAPE_KO={switch:'교대하려고 한다…',move:'기술을 내보내려고 한다…',none:'움직일 기색이 없다…'};
 function openMyosu(tid,pick){const c=ctx();const b=c.b;const t=(b.trainers||{})[tid];if(!t)return;if(!(c.mgr||tid===c.seat))return;
  const turn=+b.turn||0;const phase=+b.phase||0;const my=timeOf(t,turn);const lim=timeLimit(c,tid);const rd=c.ST.state.ready||{};const blocked=timeBlocked(c,tid);
  const enemies=Object.values(b.mons||{}).filter(m=>m.entry&&m.hp.cur>0&&m.side!==t.side).sort((x,y)=>String(x.entry).localeCompare(String(y.entry)));
  const left=Math.max(0,lim-my.used);
  const why=m=>{if(phase!==0)return '지시 준비 페이즈에만';if(blocked)return '이번 턴은 더 못 쓴다';if(!rd[m.tid])return '상대가 아직 준비 전';if(my.sw===1&&my.target&&my.target!==m.id)return '이번 턴은 「'+(monName(b,my.target)||'?')+'」만';if(my.sw===0&&my.used>=lim)return lim?'횟수를 다 썼다':'지시 '+(t.ranks['지시']||'-')+' 는 「타임」 0회';return ''};
  const md=A().openModal(`<div class="mhead"><h2>묘수 · 「타임」 <span class="small dim">${esc(t.name)}</span></h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="row small" style="gap:10px;flex-wrap:wrap"><span>지시 <b>${esc(t.ranks['지시']||'-')}</b></span><span>이 배틀 남은 횟수 <b style="color:var(--yel2)">${left}</b> / ${lim}${my.forced?` <span class="dim">(강제 ${my.forced})</span>`:''}</span><span class="dim">이번 턴 ${my.sw===0?'아직 안 씀':my.sw===1?'사용 — 「'+esc(monName(b,my.target)||'?')+'」':'사용 불가'}</span></div>
   ${blocked?'<div class="card" style="border-color:var(--red);margin-top:8px">양 트레이너가 서로의 수를 읽고 있다는 것을 눈치챘다 — 이번 턴은 「타임」을 더 쓸 수 없다.</div>':''}
   <div class="sec" style="margin-top:10px">상대 포켓몬 <span class="note">상대 트레이너가 「준비 완료」를 누른 뒤에만 볼 수 있다 · 보이는 건 교대인지 기술인지뿐</span></div>
   <div class="pg">${enemies.map(m=>{const w=why(m);const seen=my.sw>=1&&my.target===m.id;return `<div class="pc ${w?'dis':''} ${seen?'on':''}" data-tm="${m.id}" title="${esc(w||'엿본다')}"><div class="pic" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}"></div><div><b>${secret(c,m)?'비공개':esc(m.name)}</b><div class="small dim">${SIDE_KO[m.side]} ${String(m.entry).toUpperCase()} · ${esc((b.trainers[m.tid]||{}).name||'')} ${rd[m.tid]?'<span class="tag ok">READY</span>':'<span class="dim">준비 전</span>'}</div>${w?`<div class="small" style="color:var(--red)">${esc(w)}</div>`:seen?'<div class="small" style="color:var(--yel2)">다시 보기</div>':''}</div></div>`}).join('')||'<div class="dim small">상대 포켓몬이 없다</div>'}</div>
   <div class="row small" style="margin-top:10px"><label title="횟수가 다 떨어졌어도 GM 재량으로 쓴다 (강제 사용 횟수로 따로 센다)"><input type="checkbox" id="tmForce" ${c.gm?'':'disabled'}> 강제 사용 (GM)</label><span class="sp"></span>${c.gm?`<button class="btn xs ghost" id="tmReset" title="이 트레이너의 「타임」 횟수를 초기화">횟수 초기화</button>`:''}</div>
   <div id="tmRes"></div>`);
  if(pick){const el=md.querySelector(`[data-tm="${pick}"]`);if(el)el.scrollIntoView()}
  const resetT=$('#tmReset',md);if(resetT)resetT.onclick=async()=>{if(!confirm('「타임」 횟수를 초기화할까?'))return;await A().set(['battle','trainers',tid,'time'],null);A().closeModal();A().sysLog(`${t.name} 「타임」 횟수 초기화`,'battle')};
  md.querySelectorAll('[data-tm]').forEach(el=>el.onclick=async()=>{const m=ctx().b.mons[el.dataset.tm];if(!m)return;const force=!!($('#tmForce',md)&&$('#tmForce',md).checked);const w=why(m);
   if(w&&!(force&&/횟수|0회/.test(w)))return A().toast(w);
   const again=my.sw>=1&&my.target===m.id;
   if(!again&&my.sw===0&&my.used>=lim&&!force)return A().toast(`머리가 아파 더 이상 「타임」을 쓸 수 없다 (최대 ${lim}번)`);
   const shape=((ctx().ST.state.pub||{})[m.tid]||{}).shape;const sh=shape&&(+shape.turn||0)===turn?shape.mons[m.id]:null;
   if(!sh&&!c.mgr)return A().toast('상대의 지시가 아직 저장되지 않았다');
   if(!again){const nt={used:my.used+(force&&my.used>=lim?0:1),forced:my.forced+(force&&my.used>=lim?1:0),turn,sw:1,target:m.id};
    const enemyUsed=enemyTids(c,tid).some(e=>timeOf(ctx().b.trainers[e],turn).sw>=1);if(enemyUsed)nt.sw=2;
    const ok=await A().set(['battle','trainers',tid,'time'],nt);if(!ok)return;
    A().sysLog(`【묘수】 ${t.name} 「타임」 → ${secret(c,m)?'상대 포켓몬':m.name}\n이 배틀 ${nt.used}/${lim}${nt.forced?' · 강제 '+nt.forced:''}`,'battle',{mid:m.id,img:''});
    if(enemyUsed)A().sysLog('양 트레이너는 서로가 서로의 수를 읽고 있다는 것을 눈치챘다!','battle');
    my.sw=nt.sw;my.target=m.id;my.used=nt.used}
   const txt=sh?`「${m.name}」${sh==='none'?'은(는) ':'은(는) '}${SHAPE_KO[sh]}`:'(GM) 저장된 지시 꼴이 없다';
   $('#tmRes',md).innerHTML=`<div class="card hit" style="margin-top:10px"><div class="row" style="gap:10px"><div class="ti" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}"></div><div style="flex:1"><div class="small dim">타임 결과 · 턴 ${turn}</div><b style="font-size:16px">${esc(txt)}</b></div></div></div>`;
   md.querySelectorAll('[data-tm]').forEach(x=>x.classList.toggle('on',x.dataset.tm===m.id))})}

 /* ---------- 타임 (GM 직접 보기 · 옛 요청 흐름) ---------- */
 function timeCount(t){const lt=((DB().const||{}).lists||{}).list_time_count||{E:0,D:0,C:0,B:0,A:1,AA:2,AAA:2,S:2};const r=S().strip((t.ranks||{})['지시']);return +(lt[r]||0)}
 async function requestTime(mid){const c=ctx();const b=c.b;const m=b.mons[mid];if(!m)return;const my=c.mgr?null:c.seat;const t=b.trainers[my];
  if(!c.mgr){if(!t)return;const used=+(t.timeUsed||0);if(used>=timeCount(t))return A().toast('타임 횟수가 없다');if(!confirm(`${m.name} 의 지시를 엿볼까? (타임 ${used+1}/${timeCount(t)})`))return;
   await A().set(['pub',my,'time'],{mid,at:Date.now()});A().sysLog(`${t.name} 「타임」 요청 → ${m.name}`,'chat');return}
  /* GM 은 바로 본다 */
  const rows=await DBS().secretGet(c.ST.room,c.ST.secret,'cmd');const r=(rows||[]).find(x=>x.id===m.tid);const x=r&&r.data&&r.data.mons&&r.data.mons[mid];
  A().openModal(`<div class="mhead"><h2>타임 — ${esc(m.name)}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="pre">${esc(x?describeCmd(b,m,x):'아직 저장된 지시가 없다')}</div>`)}
 function describeCmd(b,m,x){if(!x)return '(없음)';if(x.move==='switch')return `교대 → ${monName(b,x.switch)}`;if(x.move===''||x.move==null)return '(행동 없음)';const mv=(m.moves||[])[+x.move];return `${mv?mv.name:'?'}${x.targets&&x.targets.length?' → '+x.targets.map(sl=>slotName(b,sl).replace(/<[^>]+>/g,'')).join(', '):''}`}
 async function grantTime(seat){const c=ctx();if(!c.mgr)return;const b=c.b;const req=((c.ST.state.pub||{})[seat]||{}).time;if(!req)return;const m=b.mons[req.mid];const t=b.trainers[seat];
  const rows=await DBS().secretGet(c.ST.room,c.ST.secret,'cmd');const r=(rows||[]).find(x=>x.id===(m||{}).tid);const x=r&&r.data&&r.data.mons&&r.data.mons[req.mid];
  await DBS().secretPut(c.ST.room,c.ST.secret,'peek',seat,{mid:req.mid,name:m?m.name:'?',text:m?describeCmd(b,m,x):'?',turn:b.turn||0,at:Date.now()});
  await A().set(['pub',seat,'time'],null);if(t){await A().set(['battle','trainers',seat,'timeUsed'],(+t.timeUsed||0)+1)}
  A().sysLog(`GM: ${t?t.name:seat} 의 「타임」 허가 (${m?m.name:'?'})`,'battle')}
 async function loadPeek(){const c=ctx();if(c.mgr||!c.seat)return null;try{const rows=await DBS().secretGet(c.ST.room,c.ST.secret,'peek');const r=(rows||[]).find(x=>x.id===c.seat);return r?r.data:null}catch(e){return null}}

 /* ---------- 랭크·상태 편집 ---------- */
 /* ---------- 포텐셜 목록 창: 출력(채팅에 알림) · 발동(자동화) · 횟수 · 효과 해제 ---------- */
 function openPots(mid){const c=ctx();const b=c.b;const m=b.mons[mid];if(!m)return;const full=canEdit(c,m);const u=m.potUses||{};const L=potList(m);
  const rows=[...(m.pots||[]).filter(p=>p&&p.name&&!p.ph).map(p=>['pot',p.name,p.kind||'',p.eff||'']),...(m.excl?[['pot',m.excl.name,'전용',m.excl.eff||'']]:[]),...(m.exclX||[]).map(p=>['pot',p.name,'전용',p.eff||'']),...(m.ability?[['trait',m.ability,'특성',m.abilityEff||'']]:[]),...(m.item?[['item',m.item,'소지품',m.itemEff||'']]:[])];
  const chips=FX()?FX().chips(m):[];
  const md=A().openModal(`<div class="mhead"><h2>${esc(m.name)} <span class="small dim">포텐셜 · 특성 · 소지품</span></h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <table class="t potlist">${rows.map(([k,n,kind,eff])=>{const a=FX()&&FX().autoOf(m,k,n);const auto=a&&a.ops&&a.ops.length&&!a.manual;const cnt=L.find(x=>x.name===n);const left=cnt?(u[n]==null?cnt.max:+u[n]):null;const tm=a?FX().timing(a.text||eff):{};
    return `<tr><th style="width:150px;white-space:normal"><b>${esc(n)}</b><div class="small dim">${esc(kind)}</div>${cnt?`<div class="small" style="color:var(--yel2)">남은 ${left}/${cnt.max}</div>`:''}${auto?`<div class="small" style="color:#9fc4ff">자동${tm.entry?' · 등장':tm.passive?' · 상시':''}</div>`:''}</th><td class="pre small" style="white-space:pre-wrap">${esc(String(eff).replace(/<br\s*\/?>/g,'\n'))}</td>
     <td class="nw" style="width:1%">${full?`<div class="row" style="gap:3px;flex-wrap:nowrap"><button class="btn xs" data-pa="announce" data-kind="${k}" data-pot="${esc(n)}" title="효과 글을 채팅에 띄운다">📢 출력</button>${auto?`<button class="btn xs pri" data-pa="fire" data-kind="${k}" data-pot="${esc(n)}">발동</button>`:''}${cnt?`<button class="btn xs" data-pa="use" data-pot="${esc(n)}" ${left>0?'':'disabled'}>사용 −1</button><button class="btn xs ghost" data-pa="restore" data-pot="${esc(n)}" ${left<cnt.max?'':'disabled'}>+1</button>`:''}${window.OM_FX_UI?`<button class="btn xs ghost" data-pa="edit" data-kind="${k}" data-pot="${esc(n)}" data-text="${esc(eff)}">구문</button>`:''}</div>`:''}</td></tr>`}).join('')||'<tr><td class="dim">없음</td></tr>'}</table>
   <div class="sec">발동 중인 효과 <span class="note">${chips.length}</span></div><div class="row" style="flex-wrap:wrap;gap:4px">${chips.map(ch=>`<span class="rk fxc ${full?'rm':''}" title="${esc(ch.title)}" ${full?`data-pa="off" data-fx="${esc(ch.id)}" data-nm="${esc(ch.name)}"`:''}>${esc(ch.t)}${full?' ✕':''}</span>`).join('')||'<span class="small dim">없음</span>'}${full&&chips.length?`<span class="sp"></span><button class="btn xs ghost danger" data-pa="offall">모두 해제</button>`:''}</div>
   ${full&&(m.tempRank&&Object.keys(m.tempRank).length||m.tempMod&&Object.keys(m.tempMod).length)?`<div class="row small" style="margin-top:6px"><span class="dim">임시 랭크·배율(턴 종료까지)이 걸려 있다</span><span class="sp"></span><button class="btn xs ghost" data-pa="temp">임시 랭크 해제</button></div>`:''}`);
  md.querySelectorAll('[data-pa]').forEach(bt=>bt.onclick=async()=>{const k=bt.dataset.pa;const d={mid,pot:bt.dataset.pot,kind:bt.dataset.kind};
   if(k==='announce'){A().closeModal();return action(Object.assign(d,{act:'announce'}))}
   if(k==='fire'){A().closeModal();if(d.kind==='pot'&&wantCut(m,d.pot))cutFire('m:'+m.id,m.image,m.name,`『${d.pot}』`,m.side==='left'?'#1f6fd1':'#e3101f');return fireAuto(mid,d.kind,d.pot)}
   if(k==='use'||k==='restore'){A().closeModal();return action({act:k==='use'?'usepot':'restorepot',mid,pot:d.pot})}
   if(k==='edit'){A().closeModal();return window.OM_FX_UI.openEditor({mon:ctx().b.mons[mid],kind:d.kind,name:d.pot,text:bt.dataset.text,save:async auto=>{const cur=Object.assign({},(ctx().b.mons[mid]||{}).auto||{});if(auto)cur[d.pot]=auto;else delete cur[d.pot];await A().set(['battle','mons',mid,'auto'],cur);const rm=(A().ST.state.roster||{}).mons||{};if(rm[mid])await A().set(['roster','mons',mid,'auto'],cur);A().toast(auto?'구문을 저장했다':'구문을 지웠다')}})}
   if(k==='off'){A().closeModal();return action({act:'fxoff',mid,fx:bt.dataset.fx,nm:bt.dataset.nm})}
   if(k==='offall'){if(!confirm('발동 중인 효과를 모두 해제할까?'))return;const nb=JSON.parse(JSON.stringify(ctx().b));FX().removeAll(nb.mons[mid]);A().closeModal();await A().set(['battle','mons',mid],nb.mons[mid]);return A().sysLog(`${m.name} 효과 모두 해제`,'battle')}
   if(k==='temp'){const nb=JSON.parse(JSON.stringify(ctx().b));const x=nb.mons[mid];if(x.tempRank){for(const kk in x.tempRank)x.rank[kk]=(+x.rank[kk]||0)-(+x.tempRank[kk]||0);delete x.tempRank}if(x.tempMod){for(const kk in x.tempMod){x.mod[kk]=Math.round(((+x.mod[kk]||1)/(+x.tempMod[kk]||1))*1000)/1000;if(x.mod[kk]===1)delete x.mod[kk]}delete x.tempMod}if(x.fx&&x.fx.mults)x.fx.mults=x.fx.mults.filter(e=>!e.temp);A().closeModal();await A().set(['battle','mons',mid],x);return A().sysLog(`${m.name} 임시 랭크·배율 해제`,'battle')}})}
 /* ---------- HP 창 (맵툴 hp_mgr): 받은 피해 판정 적용(완화 배율) · 비율/고정 피해 · 특수 피해 · 회복 ---------- */
 const FRACS=[['1/16',16],['1/8',8],['1/6',6],['1/4',4],['1/3',3],['1/2',2],['2/3',1.5]];
 function parseAmt(v,base){v=String(v||'').trim();if(!v)return 0;const m=v.match(/^(\d+)\s*\/\s*(\d+)$/);if(m)return Math.max(1,Math.floor(base*+m[1]/+m[2]));const n=+v;return isNaN(n)?0:Math.max(0,Math.floor(n))}
 function openHp(mid,tab){const c=ctx();const b=c.b;const m=b.mons[mid];if(!m||!canEdit(c,m))return;tab=tab||(m.lastHit?'dmg':'dmg');const lh=m.lastHit;const pct=Math.round(m.hp.cur/m.hp.max*100);
  const EFFS=[0,0.25,0.5,1,2,4];const fl=raidFloor(m);
  const md=A().openModal(`<div class="mhead"><h2>「HP」 · ${esc(m.name)}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="hphead"><div class="ti" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}"></div><div style="flex:1"><div class="hpbar ${pct<=25?'low':pct<=50?'mid':''}"><i style="width:${pct}%"></i></div><div class="row small"><span>「HP」 <b>${m.hp.cur}</b> / ${m.hp.max} (${pct}%)</span>${m.hp.latest!=null&&m.hp.latest!==m.hp.cur?`<span class="dim">직전 ${m.hp.latest}</span>`:''}<span class="sp"></span><button class="btn xs ghost" data-hp="undo" ${m.hp.latest==null?'disabled':''}>되돌리기</button><button class="btn xs ghost" data-hp="one">HP 1</button><button class="btn xs ghost danger" data-hp="faint">빈사</button></div></div></div>
   <div class="tabs"><button class="tb ${tab==='dmg'?'on':''}" data-hpt="dmg">피해</button><button class="tb ${tab==='heal'?'on':''}" data-hpt="heal">회복</button></div>
   ${tab==='dmg'?`
   ${lh?`<div class="card hit"><div class="sec">기술 피해 <span class="note">받은 피해 판정 — 완화 배율을 넣고 적용</span></div>
     <div class="kv"><span>공격한 포켓몬</span><b>${esc(lh.from)}</b><span>기술</span><b>${esc(lh.move)} ${esc(lh.moveType)} <span style="color:var(--yel2)">×${lh.eff}</span>${lh.crit?' <span style="color:var(--red)">급소</span>':''}${lh.hits>1?' · '+lh.hits+'회':''}</b><span>기본 대미지</span><b style="font-size:15px;color:#ff9b9b">${lh.total} <span class="dim small">(${lh.min}~${lh.max})</span></b><span>위력 완화</span><b>${lh.guard&&lh.guard!==1?'×'+lh.guard:'없음'}${lh.guardNote?` <span class="small dim">${esc(lh.guardNote)}</span>`:''} <span class="note">자동 반영</span></b></div>
     <div class="hgrid"><label>대미지 보정 <input type="number" step="0.01" class="n" id="h_mod" value="1" title="방호·완화·역할 보정 등 배율"></label>
      <label>최종 상성 <select id="h_eff">${EFFS.map(v=>`<option value="${v}" ${v===+lh.eff?'selected':''}>×${v}</option>`).join('')}</select></label>
      <label><input type="checkbox" id="h_berry"> 반감열매</label><label><input type="checkbox" id="h_endure" ${lh.endure?'checked':''}> 버티기 (HP 1 남김)</label>
      <label>고정 대미지 <input type="text" class="n" id="h_forced" placeholder="-1 = 계산값" value="-1" title="숫자 또는 분수(1/8)를 넣으면 그 값으로"></label>
      ${fl?`<label class="small" style="color:var(--yel)">레이드 배리어 하한 ${fl}</label>`:''}</div>
     <div class="row" style="margin-top:8px"><span class="small dim">예상: <b id="h_prev"></b></span><span class="sp"></span><button class="btn pri" data-hp="apply">피해 적용</button><button class="btn ghost xs" data-hp="discard" title="이 판정을 지운다 (피해 없음)">판정 버리기</button></div></div>`
   :'<div class="small dim" style="margin:6px 0">받은 피해 판정이 없다 — 고정·비율 피해로 처리한다.</div>'}
   <div class="card"><div class="sec">비율 · 고정 피해 <span class="note">최대 「HP」 기준</span></div><div class="qs">${FRACS.map(([l,n])=>`<button class="btn sm" data-hp="frac" data-v="${l}">${l} <small>−${Math.max(1,Math.floor(m.hp.max/n))}</small></button>`).join('')}</div>
    <div class="row" style="margin-top:6px"><input type="text" class="n" id="h_cv" placeholder="숫자 또는 분수 (예: 30, 1/8)" style="width:170px"><button class="btn sm" data-hp="custom">피해</button></div></div>
   <div class="card"><div class="sec">특수한 피해</div>
    <div class="spx"><b>↯ 반동</b><span class="small dim">직전에 입힌 대미지의 비율 ${m.lastDealt?`(${m.lastDealt.total} · ${esc(m.lastDealt.targets)})`:'(기록 없음)'}</span><span class="qs">${['1/4','1/3','1/2'].map(x=>`<button class="btn xs" data-hp="recoil" data-v="${x}" ${m.lastDealt?'':'disabled'}>${x}</button>`).join('')}</span></div>
    <div class="spx"><b>% 현재 HP 비례</b><span class="small dim">현재 「HP」(${m.hp.cur})의 비율</span><span class="qs">${['1/2','1/4','1/8'].map(x=>`<button class="btn xs" data-hp="cur" data-v="${x}">${x}</button>`).join('')}</span></div>
    <div class="spx"><b>◈ 타입 비례</b><span class="small dim">최대 「HP」 × 비율 × 상성 (스텔스록처럼)</span><span class="qs"><select id="h_tt" class="mini">${(S().allTypes?S().allTypes():['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy']).map(t=>`<option value="${t}">${esc(S().typeKo(t))}</option>`).join('')}</select><input type="text" class="n xs" id="h_tv" value="1/8"><button class="btn xs" data-hp="typed">피해</button></span></div></div>`
   :`<div class="card"><div class="sec">회복 <span class="note">최대 「HP」 기준</span></div><div class="qs">${FRACS.map(([l,n])=>`<button class="btn sm" data-hp="heal" data-v="${l}">${l} <small>+${Math.max(1,Math.floor(m.hp.max/n))}</small></button>`).join('')}<button class="btn sm" data-hp="full">전부</button></div>
    <div class="row" style="margin-top:6px"><input type="text" class="n" id="h_cv" placeholder="숫자 또는 분수" style="width:170px"><button class="btn sm" data-hp="healc">회복</button></div></div>
   <div class="card"><div class="sec">특수한 회복</div>
    <div class="spx"><b>◆ 드레인</b><span class="small dim">직전에 입힌 대미지의 비율 ${m.lastDealt?`(${m.lastDealt.total})`:'(기록 없음)'}</span><span class="qs">${['1/2','3/4','1/1'].map(x=>`<button class="btn xs" data-hp="drain" data-v="${x}" ${m.lastDealt?'':'disabled'}>${x}</button>`).join('')}</span></div>
    <div class="spx"><b>★ 희망사항</b><span class="small dim">최대 「HP」 1/2</span><span class="qs"><button class="btn xs" data-hp="heal" data-v="1/2">회복</button></span></div></div>`}`);
  md.querySelectorAll('[data-hpt]').forEach(bt=>bt.onclick=()=>{A().closeModal();openHp(mid,bt.dataset.hpt)});
  const calc=()=>{if(!lh)return null;const g=id=>$('#'+id,md);const forced=g('h_forced').value.trim();
   if(forced!==''&&forced!=='-1'){const v=parseAmt(forced,m.hp.max);return {final:Math.min(v,m.hp.cur),after:Math.max(0,m.hp.cur-v)}}
   const r=B().hpDamage(m,lh.total,+g('h_eff').value,{stab:false,guard:lh.guard||1,manual:+g('h_mod').value||1,berryHalf:g('h_berry').checked,endure:g('h_endure').checked,hpFloor:fl});return r};
  const prev=()=>{const r=calc();const el=$('#h_prev',md);if(el&&r)el.textContent=`−${r.final} → HP ${r.after}/${m.hp.max}${r.after<=0?' 빈사':''}`};prev();
  md.querySelectorAll('#h_mod,#h_eff,#h_berry,#h_endure,#h_forced').forEach(el=>{el.addEventListener('input',prev);el.addEventListener('change',prev)});
  const apply=async(delta,why,opt)=>{opt=opt||{};const nb=JSON.parse(JSON.stringify(ctx().b));const x=nb.mons[mid];x.hp.latest=x.hp.cur;
   if(delta<0){let v=-delta;if(opt.floor&&x.hp.cur-v<opt.floor)v=Math.max(0,x.hp.cur-opt.floor);x.hp.cur=Math.max(0,x.hp.cur-v);x.hpOdd=!x.hpOdd;delta=-v}else{const h=Math.min(delta,x.hp.max-x.hp.cur);x.hp.cur+=h;delta=h}
   if(opt.clearHit)delete x.lastHit;let line=`${x.name} ${why} ${delta>0?'+':''}${delta} → HP ${x.hp.cur}/${x.hp.max}`;
   if(x.hp.cur<=0){x.entry='';line+=' · 빈사!';line+=`\n${x.name}은(는) 쓰러졌다!`}
   if(x.raid&&x.raid.segments>0&&opt.floor&&x.hp.cur<=opt.floor&&delta<0){x.raid.broken=(x.raid.broken||0)+1;x.raid.phase=(x.raid.phase||1)+1;line+=`\n${x.name} 배리어 파괴! → 페이즈 ${x.raid.phase}`}
   A().closeModal();if(await A().set(['battle','mons'],nb.mons))A().sysLog(line,'battle')};
  md.querySelectorAll('[data-hp]').forEach(bt=>bt.onclick=async()=>{const k=bt.dataset.hp;const v=bt.dataset.v;const g=id=>$('#'+id,md);
   if(k==='apply'){const r=calc();if(!r)return;const mods=[];if(+g('h_mod').value!==1)mods.push('보정 ×'+g('h_mod').value);if(g('h_berry').checked)mods.push('반감열매');if(g('h_endure').checked)mods.push('버티기');return apply(-r.final,`「${lh.move}」(${lh.from}) 피해${lh.crit?' 급소':''} ×${g('h_eff').value}${mods.length?' · '+mods.join(' · '):''}`,{clearHit:true,floor:fl})}
   if(k==='discard'){const nb=JSON.parse(JSON.stringify(ctx().b));delete nb.mons[mid].lastHit;A().closeModal();await A().set(['battle','mons'],nb.mons);return A().sysLog(`${m.name} 받은 피해 판정을 버렸다`,'battle')}
   if(k==='frac')return apply(-parseAmt(v,m.hp.max),`비율 피해 ${v}`,{floor:fl});
   if(k==='custom'){const a=parseAmt(g('h_cv').value,m.hp.max);if(!a)return A().toast('숫자나 분수를 넣어 줘');return apply(-a,`고정 피해 ${g('h_cv').value}`,{floor:fl})}
   if(k==='recoil'){if(FX()&&FX().noind(m,'recoil'))return A().toast('반동 비례 대미지를 받지 않는다');const a=parseAmt(v,m.lastDealt.total);return apply(-a,`반동 ${v} (입힌 ${m.lastDealt.total})`)}
   if(k==='cur')return apply(-Math.max(1,parseAmt(v,m.hp.cur)),`현재 HP 비례 ${v}`);
   if(k==='typed'){const ty=g('h_tt').value;const mul=B().effectiveness([ty],m,{}).value;if(mul<=0){return A().toast(`${S().typeKo(ty)} 타입은 효과가 없다`)}const base=parseAmt(g('h_tv').value,m.hp.max);return apply(-Math.max(1,Math.floor(base*mul)),`타입 비례 피해 ${S().typeKo(ty)} ${g('h_tv').value} ×${mul}`)}
   if(k==='heal')return apply(parseAmt(v,m.hp.max),`회복 ${v}`);
   if(k==='healc'){const a=parseAmt(g('h_cv').value,m.hp.max);if(!a)return;return apply(a,`회복 ${g('h_cv').value}`)}
   if(k==='full')return apply(m.hp.max-m.hp.cur,'전부 회복');
   if(k==='drain')return apply(parseAmt(v,m.lastDealt.total),`드레인 ${v} (입힌 ${m.lastDealt.total})`);
   if(k==='one')return apply(-(m.hp.cur-1),'HP 1');
   if(k==='faint')return apply(-m.hp.cur,'빈사 처리');
   if(k==='undo'){const nb=JSON.parse(JSON.stringify(ctx().b));const x=nb.mons[mid];const l=x.hp.latest;if(l==null)return;x.hp.latest=x.hp.cur;x.hp.cur=l;if(x.hp.cur>0&&!x.entry&&m.hp.cur<=0){}A().closeModal();await A().set(['battle','mons'],nb.mons);return A().sysLog(`${x.name} HP 되돌리기 → ${x.hp.cur}/${x.hp.max}`,'battle')}})}
 function openEdit(mid){const c=ctx();const b=c.b;const m=b.mons[mid];if(!m||!canEdit(c,m))return;
  const sdb=DB().states||{st:{},groups:[]};const items=Object.keys(DB().items||{});
  const md=A().openModal(`<div class="mhead"><h2>${esc(m.name)} <span class="small dim">랭크·상태·소지품</span></h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   ${FX()?`<div class="card" style="margin-top:0;padding:6px 10px"><div class="sec">자동화 <span class="note">포텐셜·특성·소지품의 구문 — 「발동」은 카드에서</span></div><div class="row" style="flex-wrap:wrap;gap:4px">${[...(m.pots||[]).filter(p=>p&&p.name&&!p.ph).map(p=>['pot',p.name,p.eff]),...(m.excl?[['pot',m.excl.name,m.excl.eff]]:[]),...(m.exclX||[]).map(p=>['pot',p.name,p.eff]),...(m.ability?[['trait',m.ability,m.abilityEff]]:[]),...(m.item?[['item',m.item,m.itemEff]]:[])].map(([k,n,t])=>{const own=(m.auto||{})[n];const base=FX().autoOf(Object.assign({},m,{auto:{}}),k,n);const has=own&&own.ops&&own.ops.length;const rmHas=base&&base.ops&&base.ops.length&&!base.manual;return `<button class="btn xs ${has?'pri':rmHas?'':'ghost'}" data-fxed="${k}" data-name="${esc(n)}" data-text="${esc(t||'')}">${k==='trait'?'특성 ':k==='item'?'소지품 ':''}${esc(n)} ${has?'✓':rmHas?'(자동)':''}</button>`}).join('')||'<span class="small dim">없음</span>'}</div></div>`:''}
   <div class="row" style="margin-bottom:8px"><b>HP</b> <input type="number" id="ehp" value="${m.hp.cur}" style="width:90px"> / ${m.hp.max} <button class="btn sm" id="ehpfull">전부 회복</button><span class="sp"></span><label><input type="checkbox" id="etera" ${m.teraActive?'checked':''}> 테라스탈 ${esc(m.tera)}</label></div>
   <div class="rankgrid">${Object.keys(STAT_KO).map(k=>`<div class="rkrow"><span>${STAT_KO[k]}</span><button class="btn xs" data-rk="${k}" data-d="-1">−</button><b class="mono" id="rk_${k}">${(+m.rank[k]||0)>0?'+':''}${+m.rank[k]||0}</b><button class="btn xs" data-rk="${k}" data-d="1">＋</button>
     <input type="number" step="0.01" class="n" data-mod="${k}" value="${(m.mod||{})[k]!=null&&(m.mod||{})[k]!==1?(m.mod||{})[k]:''}" placeholder="×1" title="배율(mod)"></div>`).join('')}</div>
   <div class="row small" style="margin:6px 0"><label><input type="checkbox" id="etemp"> 이번 변경을 임시 랭크로 (턴 종료 때 해제)</label><button class="btn xs ghost" id="erk0">랭크 전부 0</button></div>
   <div class="row" style="margin:8px 0"><b>소지품</b> <input type="text" id="eitem" list="itemlist" value="${esc(m.item||'')}" style="flex:1"><button class="btn sm" id="eitemdb" type="button">DB</button><datalist id="itemlist">${items.map(i=>`<option value="${esc(i)}">`).join('')}</datalist>
    ${c.mgr?`<b>레이드</b> <input type="number" class="n" id="eraid" value="${(m.raid&&m.raid.segments)||''}" placeholder="구간 X" title="최대 HP 를 X 등분한 자리마다 배리어"><span class="small dim">${m.raid&&m.raid.segments?`페이즈 ${m.raid.phase||1} · 깨짐 ${m.raid.broken||0}`:''}</span>`:''}</div>
   <div class="row" style="margin-top:8px"><b>상태 변화</b><input type="text" id="stq" placeholder="상태 검색 (이름·설명)" style="flex:1"><span class="small dim">걸린 것: ${Object.keys(m.states||{}).filter(k=>m.states[k]).map(k=>(sdb.st[k]||{}).ko||k).join(', ')||'없음'}</span></div>
   <div class="stgroups" id="stgroups">${(sdb.groups||[]).map(g=>`<div class="stg" data-stg><div class="stgl">${esc(g.l)}</div>${g.s.map(k=>{const d=sdb.st[k]||{ko:k};const v=(m.states||{})[k];const im=simg(k);return `<label class="stt ${v?'on':''} ${d.abn?'abn':''}" data-stq="${esc((d.ko+' '+k+' '+(d.desc||[]).join(' ')).toLowerCase())}" title="${esc((d.desc||[]).join(' '))}"><input type="checkbox" data-st="${k}" ${v?'checked':''}>${im?`<img src="${esc(im)}" alt="">`:''}${esc(d.ko)}${d.prog==='turn'||d.prog==='move'?`<input type="number" class="n xs" data-stc="${k}" value="${v&&v<1000?v:(d.min<1000?d.min:'')}" placeholder="T">`:''}</label>`}).join('')}</div>`).join('')}</div>
   <div class="row" style="margin-top:12px"><span class="sp"></span><button class="btn pri" id="esave">적용</button></div>`);
  const rank=Object.assign({},m.rank);const delta={};
  md.querySelectorAll('[data-rk]').forEach(bt=>bt.onclick=()=>{const k=bt.dataset.rk;const lim=k==='critical'?4:6;const p0=+rank[k]||0;rank[k]=Math.max(-lim,Math.min(lim,p0+(+bt.dataset.d)));delta[k]=(delta[k]||0)+(rank[k]-p0);$('#rk_'+k,md).textContent=(rank[k]>0?'+':'')+rank[k]});
  $('#erk0',md).onclick=()=>{for(const k in STAT_KO){rank[k]=0;$('#rk_'+k,md).textContent='0'}};
  md.querySelectorAll('[data-fxed]').forEach(bt=>bt.onclick=()=>{A().closeModal();window.OM_FX_UI.openEditor({mon:ctx().b.mons[mid],kind:bt.dataset.fxed,name:bt.dataset.name,text:bt.dataset.text,save:async auto=>{const cur=Object.assign({},(ctx().b.mons[mid]||{}).auto||{});if(auto)cur[bt.dataset.name]=auto;else delete cur[bt.dataset.name];await A().set(['battle','mons',mid,'auto'],cur);const rm=(A().ST.state.roster||{}).mons||{};if(rm[mid])await A().set(['roster','mons',mid,'auto'],cur);A().toast(auto?'구문을 저장했다':'구문을 지웠다')}})});
  $('#ehpfull',md).onclick=()=>{$('#ehp',md).value=m.hp.max};
  const stq=$('#stq',md);if(stq){stq.oninput=()=>{const q=stq.value.trim().toLowerCase();md.querySelectorAll('.stt').forEach(l=>{l.style.display=!q||l.dataset.stq.includes(q)||l.classList.contains('on')?'':'none'});md.querySelectorAll('[data-stg]').forEach(g=>{g.style.display=[...g.querySelectorAll('.stt')].some(l=>l.style.display!=='none')?'':'none'})};setTimeout(()=>stq.focus(),50)}
  $('#eitemdb',md).onclick=()=>{window.OM_DB_UI.open({kind:'item',sel:$('#eitem',md).value,pick:async name=>{const it=(DB().items||{})[name]||{};await A().set(['battle','mons',mid,'item'],name);await A().set(['battle','mons',mid,'itemEff'],String(it.eff||''));openEdit(mid)}})};
  $('#esave',md).onclick=async()=>{const nm=JSON.parse(JSON.stringify(m));nm.hp.cur=Math.max(0,Math.min(m.hp.max,+$('#ehp',md).value||0));nm.rank=rank;nm.teraActive=$('#etera',md).checked;nm.item=$('#eitem',md).value.trim();
   nm.mod={};md.querySelectorAll('[data-mod]').forEach(i=>{if(i.value!==''&&+i.value!==1)nm.mod[i.dataset.mod]=+i.value});
   /* 손으로 바꾼 배율은 출처 기록에서 떼어 낸다 (나중에 ✕ 로 역으로 나뉘지 않게) */
   if(nm.fx&&nm.fx.mults){nm.fx.mults=nm.fx.mults.map(e=>{const st={};for(const k in e.stats)if((+nm.mod[k]||1)===(+(m.mod||{})[k]||1))st[k]=e.stats[k];return Object.assign({},e,{stats:st})}).filter(e=>Object.keys(e.stats).length)}
   const er=$('#eraid',md);if(er){const X=+er.value||0;if(!X)delete nm.raid;else if(!nm.raid||nm.raid.segments!==X)nm.raid={segments:X,broken:0,phase:1}}
   if($('#etemp',md).checked){nm.tempRank=nm.tempRank||{};for(const k in delta)nm.tempRank[k]=(+nm.tempRank[k]||0)+delta[k]}
   nm.states={};md.querySelectorAll('[data-st]').forEach(cb=>{if(!cb.checked)return;const k=cb.dataset.st;const ci=md.querySelector(`[data-stc="${k}"]`);const d=sdb.st[k]||{};nm.states[k]=ci&&ci.value!==''?+ci.value:(d.min||1)});
   if(nm.hp.cur<=0)nm.entry='';
   A().closeModal();if(await A().set(['battle','mons',mid],nm)){const ch=[];for(const k in STAT_KO){const a=+m.rank[k]||0,b2=+rank[k]||0;if(a!==b2)ch.push(`${STAT_KO[k]} ${a}→${b2>0?'+':''}${b2}`)}
    const sa=Object.keys(m.states||{}).filter(k=>m.states[k]),sb=Object.keys(nm.states);const on=sb.filter(k=>!sa.includes(k)).map(k=>(sdb.st[k]||{}).ko||k),off=sa.filter(k=>!sb.includes(k)).map(k=>(sdb.st[k]||{}).ko||k);
    if(on.length)ch.push('+'+on.join(','));if(off.length)ch.push('−'+off.join(','));if(nm.hp.cur!==m.hp.cur)ch.push(`HP ${m.hp.cur}→${nm.hp.cur}`);if((nm.item||'')!==(m.item||''))ch.push(`소지품 ${nm.item||'없음'}`);
    if(ch.length)A().sysLog(`${m.name}: ${ch.join(' · ')}`,'battle')}}}

 /* ---------- 필드 (GM) ---------- */
 function openField(){const c=ctx();if(!c.mgr)return;const f=fieldOf(c.b);
  const pic=n=>{const im=fimg(n);return im?`<img src="${esc(im)}" alt="">`:'<span class="fnoimg"></span>'};
  const one=(id,list,imgs,cur,cnt,kind)=>`<div class="row fpick ${kind}" data-fp="${id}">${list.filter(Boolean).map(w=>`<span class="fchip ${kind} ${cur===w?'on':''}" data-fv="${esc(w)}" title="${esc(w)}">${pic(imgs[w])}<b>${esc(w)}</b></span>`).join('')}<span class="fchip none ${cur?'':'on'}" data-fv="" title="없음"><b>없음</b></span></div>
   <div class="row small" style="margin-top:4px"><span class="dim">남은 턴</span><input type="number" class="n" id="${id}c" value="${cnt||''}" placeholder="턴" ${cur?'':'disabled'}><span class="dim">(비우면 계속)</span></div>`;
  const md=A().openModal(`<div class="mhead"><h2>날씨 · 필드 · 룸 · 설치기</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="sec">날씨 <span class="note">하나만 · 누르면 바뀐다</span></div>${one('fw',WEATHER,W_IMG,f.weather.type,f.weather.count,'w')}
   <div class="sec">필드 <span class="note">하나만</span></div>${one('ft',TERRAIN,T_IMG,f.terrain.type,f.terrain.count,'t')}
   <div class="sec">룸 · 필드의 상태 <span class="note">여러 개 가능 · 누르면 기본 5턴, 숫자는 남은 턴 (1000 = 계속)</span></div>
   <div class="row" style="flex-wrap:wrap;gap:6px">${[...ROOMS.map(r=>['rooms',r,'r']),...ETC.map(r=>['etc',r,'e'])].map(([g,r,k])=>`<span class="fchip ${k} tog ${(f[g]||{})[r]>0?'on':''}" data-fg="${g}" data-fk="${esc(r)}">${pic(T_IMG[r])}<b>${esc(r)}</b><input type="number" class="n xs" data-fgv="${g}" data-fk="${esc(r)}" value="${(f[g]||{})[r]||''}" placeholder="0"></span>`).join('')}</div>
   <div class="small dim" style="margin-top:8px">설치기는 무대의 「좌측 설치물」「우측 설치물」을 눌러서 놓는다.</div>
   <div class="row" style="margin-top:12px"><button class="btn ghost" id="fclear">전부 걷기</button><span class="sp"></span><button class="btn pri" id="fsave">적용</button></div>`);
  const pickOf=id=>{const on=md.querySelector(`[data-fp="${id}"] .fchip.on`);return on?on.dataset.fv:''};
  md.querySelectorAll('[data-fp]').forEach(g=>g.querySelectorAll('.fchip').forEach(ch=>ch.onclick=()=>{g.querySelectorAll('.fchip').forEach(x=>x.classList.remove('on'));ch.classList.add('on');const inp=$('#'+g.dataset.fp+'c',md);inp.disabled=!ch.dataset.fv;if(!ch.dataset.fv)inp.value=''}));
  md.querySelectorAll('.fchip.tog').forEach(ch=>ch.addEventListener('click',e=>{if(e.target.tagName==='INPUT')return;const inp=ch.querySelector('input');if(+inp.value>0){inp.value='';ch.classList.remove('on')}else{inp.value=5;ch.classList.add('on')}}));
  md.querySelectorAll('[data-fgv]').forEach(i=>i.addEventListener('input',()=>i.closest('.fchip').classList.toggle('on',+i.value>0)));
  $('#fclear',md).onclick=()=>{md.querySelectorAll('[data-fp]').forEach(g=>{g.querySelectorAll('.fchip').forEach(x=>x.classList.toggle('on',!x.dataset.fv));const inp=$('#'+g.dataset.fp+'c',md);inp.value='';inp.disabled=true});md.querySelectorAll('.fchip.tog').forEach(ch=>{ch.querySelector('input').value='';ch.classList.remove('on')})};
  $('#fsave',md).onclick=async()=>{const wt=pickOf('fw'),tt=pickOf('ft');const cnt=id=>{const v=$('#'+id+'c',md).value.trim();return +v||0};
   const nf={weather:{type:wt,count:wt?cnt('fw'):0},terrain:{type:tt,count:tt?cnt('ft'):0},rooms:{},etc:{},objects:{}};
   md.querySelectorAll('[data-fgv]').forEach(i=>{if(+i.value>0)nf[i.dataset.fgv][i.dataset.fk]=+i.value});
   nf.objects=JSON.parse(JSON.stringify(f.objects||{left:{},right:{}}));const tl=v=>(v>=1000||!v)?'':' '+v+'T';
   A().closeModal();if(await A().set(['battle','field'],nf))A().sysLog(`필드 갱신: ${[nf.weather.type&&'날씨 '+nf.weather.type+tl(nf.weather.count),nf.terrain.type&&nf.terrain.type+tl(nf.terrain.count),...Object.entries(nf.rooms).map(([k,v])=>k+tl(v)),...Object.entries(nf.etc).map(([k,v])=>k+tl(v)),...SIDES.flatMap(s=>Object.entries(nf.objects[s]||{}).map(([k,v])=>SIDE_KO[s]+' '+k+tl(v)))].filter(Boolean).join(' · ')||'없음'}`,'battle')}}

 /* 진영별 설치기: 분류별 칩, 누르면 기본 지속으로 놓고, 다시 누르면 치운다. 숫자는 겹/턴 */
 function openObjects(side){const c=ctx();if(!c.mgr)return;const f=fieldOf(c.b);const cur=Object.assign({},(f.objects||{})[side]||{});
  const md=A().openModal(`<div class="mhead"><h2>${SIDE_KO[side]} 설치물</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   ${OBJ_CAT.map(([k,n,dur,desc,list])=>`<div class="sec">${n} <span class="note">${esc(desc)}</span></div><div class="row" style="flex-wrap:wrap;gap:6px">${list.map(o=>`<span class="objchip ${k} ${cur[o]>0?'on':''}" data-oc="${esc(o)}" data-dur="${dur}"><b>${esc(o)}</b><input type="number" class="n xs" data-ov="${esc(o)}" value="${cur[o]>0?cur[o]:''}" placeholder="${dur>=1000?'∞':dur}" title="${o==='압정뿌리기'||o==='독압정'?'겹':'남은 턴 (1000 = 계속)'}"></span>`).join('')}</div>`).join('')}
   <div class="row" style="margin-top:12px"><button class="btn ghost" id="oclear">전부 치우기</button><span class="sp"></span><button class="btn pri" id="osave">적용</button></div>`);
  md.querySelectorAll('[data-oc]').forEach(ch=>ch.addEventListener('click',e=>{if(e.target.tagName==='INPUT')return;const inp=ch.querySelector('input');const o=ch.dataset.oc;if(+inp.value>0){inp.value='';ch.classList.remove('on')}else{inp.value=(o==='압정뿌리기'||o==='독압정')?1:+ch.dataset.dur;ch.classList.add('on')}}));
  md.querySelectorAll('[data-ov]').forEach(i=>i.addEventListener('input',()=>i.closest('.objchip').classList.toggle('on',+i.value>0)));
  $('#oclear',md).onclick=()=>{md.querySelectorAll('[data-ov]').forEach(i=>{i.value='';i.closest('.objchip').classList.remove('on')})};
  $('#osave',md).onclick=async()=>{const n={};md.querySelectorAll('[data-ov]').forEach(i=>{if(+i.value>0)n[i.dataset.ov]=+i.value});A().closeModal();const nf=JSON.parse(JSON.stringify(f));nf.objects=nf.objects||{left:{},right:{}};nf.objects[side]=n;if(await A().set(['battle','field'],nf))A().sysLog(`${SIDE_KO[side]} 설치물: ${Object.entries(n).map(([k,v])=>k+(v>=1000?'':' '+v)).join(' · ')||'없음'}`,'battle')}}
 /* ---------- 지령 설정 (GM) ---------- */
 function openOrders(tid){const c=ctx();if(!c.mgr)return;const t=c.b.trainers[tid];if(!t)return;
  const md=A().openModal(`<div class="mhead"><h2>${esc(t.name)} 지령·명령 (4식 6령)</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div id="opanel">${OO().panel(t,true)}</div><div class="small dim" style="margin-top:6px">바꾸면 바로 저장된다 (배틀 쪽 트레이너만 — 시트는 그대로).</div>
   <div class="row" style="margin-top:12px"><button class="btn xs ghost danger" id="ounload" title="이 트레이너와 포켓몬을 배틀에서 뺀다">배틀에서 빼기</button><span class="sp"></span></div>`);
  $('#ounload',md).onclick=()=>{A().closeModal();A().unloadTrainer(tid)};
  const rebind=()=>OO().bind($('#opanel',md),()=>ctx().b.trainers[tid],async nt=>{await A().set(['battle','trainers',tid],nt);$('#opanel',md).innerHTML=OO().panel(nt,true);rebind()});rebind()}
 const F=()=>window.OM_FIELD;const CUT=()=>window.OM_CUTIN;const FX=()=>window.OM_FX;
 /* ---------- 효과 엔진 연결: 포텐셜·특성·소지품의 자동화를 UI(대상 고르기·확인·선택)와 함께 돌린다 ---------- */
 function uiCtx(b,self,name,area){return {b,self,name,area,viewer:ctx().gm?'':ctx().seat,
  pick:(list,label)=>new Promise(res=>{const md=A().openModal(`<div class="mhead"><h2>${esc(name)} — ${esc(label)}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="pg">${list.map(m=>`<div class="pc" data-pk="${m.id}"><div class="pic" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}"></div><div><b>${esc(m.name)}</b><div class="small dim">${SIDE_KO[m.side]} ${String(m.entry).toUpperCase()} · HP ${m.hp.cur}/${m.hp.max}</div></div></div>`).join('')}</div>`);
   md.querySelectorAll('[data-pk]').forEach(el=>el.onclick=()=>{A().closeModal();res(list.find(m=>m.id===el.dataset.pk))});md.querySelector('[data-x]').addEventListener('click',()=>res(null))}),
  confirm:q=>Promise.resolve(confirm(`「${name}」\n${q}\n\n조건을 만족하는가?`)),
  choose:(labels,multi)=>new Promise(res=>{const md=A().openModal(`<div class="mhead"><h2>${esc(name)} — 발동할 효과</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="firelist">${labels.map((l,i)=>`<label class="firerow"><input type="${multi?'checkbox':'radio'}" name="ch" value="${i}" ${i===0?'checked':''}> <span>${esc(l)}</span></label>`).join('')}</div><div class="row" style="margin-top:10px"><span class="sp"></span><button class="btn pri" id="chok">발동</button></div>`);
   $('#chok',md).onclick=()=>{const v=[...md.querySelectorAll('[name=ch]:checked')].map(i=>+i.value);A().closeModal();res(v)};md.querySelector('[data-x]').addEventListener('click',()=>res([]))})}}
 /* 효과 하나를 돌려서 배틀에 적용한다. kind: pot|trait|item|order. 돌려줌: 적용했으면 true */
 async function fireAuto(mid,kind,name,opt){opt=opt||{};const c=ctx();const b0=c.b;const m0=b0.mons[mid];if(!m0)return false;const auto=FX().autoOf(m0,kind,name);
  if(!auto||!auto.ops||!auto.ops.length||auto.manual){if(!opt.quiet)A().toast(auto&&auto.manual?`「${name}」은(는) 자동화가 없어 손으로 처리한다`:`「${name}」 자동화 없음`);return false}
  const tm=FX().timing(auto.text||'');const nb=JSON.parse(JSON.stringify(b0));const m=nb.mons[mid];const L=[];
  if(tm.percent&&!opt.noRoll){const p=FX().percentOf(tm.percent);const r=Math.floor(Math.random()*100)+1;if(r>p){A().sysLog(`${m.name} 「${name}」 ${tm.percent} 판정 실패 (${r}/${p})`,'battle');return false}L.push(`${tm.percent} 판정 성공 (${r}/${p})`)}
  const r=await FX().run(auto.ops,uiCtx(nb,m,name,opt.area));L.push(...r.lines);
  const f=fieldOf(nb);for(const id in nb.mons){const x=nb.mons[id];if(x.entry&&x.hp.cur<=0){x.entry='';L.push(`${x.name}은(는) 쓰러졌다!`)}}
  if(!await A().set(['battle','mons'],nb.mons))return false;await A().set(['battle','field'],f);
  A().sysLog(opt.head?`${opt.head}${L.length?'\n'+L.join('\n'):''}`:`【${({pot:'포텐셜',trait:'특성',item:'소지품',order:'지령'})[kind]||'효과'}】 ${m.name} 『${name}』${L.length?'\n'+L.join('\n'):''}`,'battle',{mid:m.id,img:opt.img!=null?opt.img:(m.image||''),eff:String(opt.eff||auto.text||(kind==='trait'?m.abilityEff:kind==='item'?m.itemEff:((potSrc(m).find(p=>p&&p.name===name)||{}).eff))||'').replace(/<br\s*\/?>/g,'\n').slice(0,300)});return true}
 /* 등장·상시 자동 발동: 글에 【등장】/【상시】 표식이 있는 특성·소지품·포텐셜 */
 async function autoOnEntry(mid){const c=ctx();const m=c.b.mons[mid];if(!m||!FX())return;const list=[];
  if(m.ability)list.push(['trait',m.ability]);if(m.item)list.push(['item',m.item]);for(const p of [...(m.pots||[]),...(m.excl?[m.excl]:[]),...(m.exclX||[])])if(p&&p.name&&!p.ph)list.push(['pot',p.name]);
  for(const [kind,name] of list){const a=FX().autoOf(m,kind,name);if(!a||!a.ops||!a.ops.length||a.manual)continue;const tm=FX().timing(a.text||'');
   if(tm.entry){await fireAuto(mid,kind,name,{quiet:true})}
   else if(tm.passive){const cur=ctx().b.mons[mid];if(cur&&(cur.fxDone||{})[name])continue;if(await fireAuto(mid,kind,name,{quiet:true,noRoll:true})){const d=Object.assign({},(ctx().b.mons[mid]||{}).fxDone||{});d[name]=1;await A().set(['battle','mons',mid,'fxDone'],d)}}}}
 /* 공격 창에서 쓸 조건 */
 /* 공격 쪽 배율(자속·적응력·달인의띠): 받는 쪽에는 숫자에 녹여서만 보낸다 */
 function atkMul(r,md){const ck=id=>{const el=md?$('#'+id,md):document.getElementById(id);return !!(el&&el.checked)};return (r.stab?(ck('aadapt')?2:1.5):1)*(ck('abelt')&&r.eff&&r.eff.value>1?1.2:1)}
 function moveQuery(atk,def,mv,moveTypes,eff,single){return {types:moveTypes,cat:mv.cat,eff:eff,single:single,stab:!!(eff&&eff.stab),tags:String(mv.tag||'').split(/[,/·\s]+/).filter(x=>x&&x!=='-'),pow:+mv.pow||0}}
 /* 컷인에 쓸 트레이너 그림: 표정(스탠딩) → 시트 그림 */
 function trainerImg(t){if(!t)return '';const st=(t.stands||[]);const a=st[+t.standActive||0]||st[0];return (a&&a.src)||t.image||''}
 function cutFire(tok,src,tag,ment,color){try{if(CUT())CUT().fire({tok,src,tag,ment,color})}catch(e){}}
 /* 컷인을 띄울 포텐셜: rp.cutin.pot = excl(전용·고유만, 기본) | all | none */
 function wantCut(m,name){const cfg=((A().ST.state.rp||{}).cutin)||{};const mode=cfg.pot||'excl';if(mode==='none')return false;if(mode==='all')return true;if(m.excl&&m.excl.name===name)return true;if((m.exclX||[]).some(p=>p.name===name))return true;const p=(m.pots||[]).find(x=>x.name===name);return !!(p&&/전용|고유/.test(p.kind||''))}
 function cutPhase(text,sub){try{if(CUT())CUT().phase(text,sub)}catch(e){}}
 /* 시합 개시 연출 (맵툴 switch_cutscene): rp.cutin.start = vs | warn | off. 레이드 보스가 있으면 경고 */
 function battleStartCut(b,force){const cfg=((A().ST.state.rp||{}).cutin)||{};const mode=force||cfg.start||'vs';if(mode==='off'||!CUT())return;
  const sideData=side=>{const ids=((b.sides||{})[side]||{}).trainers||[];const t=(b.trainers||{})[ids[0]];const mons=Object.values(b.mons||{}).filter(m=>ids.includes(m.tid)).sort((x,y)=>(x.slot||0)-(y.slot||0));
   if(!t&&!mons.length)return null;return {img:t?trainerImg(t):(mons[0]||{}).image||'',t:t?t.name:'야생의 '+(mons[0]||{}).name,sub:t?['육성','지시','통솔','능력'].map(k=>k+' '+((t.ranks||{})[k]||'-')).join('·'):'',balls:mons.slice(0,6).map(m=>m.hp.cur>0?1:0),mons:mons.slice(0,6).map(m=>({img:(!c_gm_or_seen(m))?'':m.image,name:(!c_gm_or_seen(m))?'비공개':m.name}))}};
  function c_gm_or_seen(m){return !!(m.entry||m.seen)}   /* 지금 나와 있거나 한 번 나온 포켓몬만 그림·이름, 나머지는 볼 */
  const boss=Object.values(b.mons||{}).find(m=>m.raid&&+m.raid.segments>0);
  if(mode==='warn'||boss){const bm=boss||Object.values(b.mons||{}).find(m=>m.side==='right'&&m.entry);if(bm){CUT().raid({img:bm.image,n:bm.name,title:cfg.warnTitle||(boss?'레이드 배틀 : '+boss.raid.segments:'강적 출현'),tape:cfg.warnTape||('⚠ WARNING ⚠ '+(cfg.warnTitle||(boss?'레이드 보스 출현':'강적 출현'))),nohp:cfg.warnHp?0:1,x:boss?boss.raid.segments:0,hp:Math.round(bm.hp.cur/bm.hp.max*100),ph:boss?boss.raid.phase||1:0,label:boss?'RAID BATTLE':'BATTLE'});return}}
  const L=sideData('left'),R=sideData('right');if(L&&R)CUT().vs(L,R)}/* 효과음은 로그를 보고 rp_ui 가 울린다 (모두 같은 로그를 받으니 좌석도 들린다) */
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
   <div class="row" style="margin-top:10px"><label class="small" title="풀죽음 → 잠듦 → 마비 → 얼음 → 헤롱헤롱 → 혼란 순서로 판정 (맵툴 check_attack)"><input type="checkbox" id="achk" checked> 행동 판정 먼저</label><span class="sp"></span><button class="btn" id="aroll">굴리기</button><button class="btn pri" id="aapply" disabled>적용</button></div>`);
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
   /* 행동 판정: 상태 변화로 못 움직이면 여기서 끝. 적용하면 상태 변화(잠듦 남은 턴·얼음 해제 등)와 로그만 남는다 */
   if($('#achk',md).checked&&F()&&['Flinch', 'Sleep', 'Paralysis', 'Freeze', 'Attract', 'Confusion'].some(k=>(atk.states||{})[k])){const am=JSON.parse(JSON.stringify(atk));const r=F().actionCheck(am);
    if(!r.ok){let self=0;if(r.selfHit){self=F().confusionHit(am);am.hp.cur=Math.max(0,am.hp.cur-self);r.lines.push(`${am.name} 자작 대미지 −${self} → HP ${am.hp.cur}/${am.hp.max}${am.hp.cur<=0?' 빈사!':''}`)}
     RESULT={check:am,lines:r.lines,mv};$('#ares',md).innerHTML=`<div class="card" style="border-color:var(--red)"><b>행동 실패</b><div class="small" style="white-space:pre-wrap;margin-top:4px">${esc(r.lines.join('\n'))}</div></div>`;$('#aapply',md).disabled=false;return}
    RESULT={checkOnly:am,lines:r.lines};if(r.lines.length)$('#ares',md).innerHTML=`<div class="small dim" style="white-space:pre-wrap">${esc(r.lines.join('\n'))}</div>`}
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
    /* 효과 엔진: 상성을 먼저 보고 강화·완화·급소 조건을 맞춘다 */
    const effPre=mv.cat==='변화'?null:B().effectiveness(moveTypes,def,{multiMode:+g('amulti').value,atkTypes,force:g('aforce').value===''?null:+g('aforce').value,floating:(def.states||{}).MagnetRise||(def.states||{}).Telekinesis||(FX()&&FX().floating(def))});
    const mods=FX()?FX().attackMods(atk,def,Object.assign(moveQuery(atk,def,mv,moveTypes,effPre?effPre.value:1,!multiTarget),{stab:!!(effPre&&effPre.stab)})):{boost:1,guard:1,cg:0,cr:0,cx:'',names:[]};
    const iu=(atk.fx||{}).ignoreUp,iuD=(def.fx||{}).ignoreUp;let igDef=+g('aigdef').value,igAtk=+g('aigatk').value;if(iu&&iu.dir==='atk'&&igDef===-1&&(iu.scope==='def'||iu.scope==='both'||iu.scope==='eva'))igDef=0;if(iuD&&iuD.dir==='recv'&&igAtk===-1&&(iuD.scope==='atk'||iuD.scope==='both'))igAtk=0;
    let hits=[];if(acc.hit){const cnt=n('ahits')||B().multiHits(mv,{skillLink:ck('askill')});const stage=B().critStage(atk,def,{input:n('acrit'),order:n('acritord')+(mods.cr||0)-(mods.cg||0)});
     for(let i=0;i<cnt;i++){const cr=mods.cx==='none'?{crit:false,roll:0,chance:0}:B().critical(stage,{type:+g('acrittype').value,forced:ck('acritforce')||mods.cx==='sure'});hits.push({v:cr.crit?2:1,cr,stage})}}
    const objs=(f.objects||{})[side]||{};const wall={};for(const k in WALLS)if(objs[k]>0)wall[WALLS[k]]=1;
    const dmg=mv.cat==='변화'||!(+g('apow').value)?null:B().damage(atk,def,Object.assign({},mv,{pow:+g('apow').value}),{hits:hits.map(h=>h.v),free1:n('afree1')*(mods.boost||1),free2:n('afree2'),item1:n('aitem1'),item2:n('aitem2'),trait:n('atrait'),weather:n('aweather'),fieldMul:n('afield'),helping:ck('ahelp'),charge:ck('acharge'),lifeOrb:ck('alife'),multiTarget,wall,wallSize:mode(b)>=2?2:1,atkStat:g('aatk').value||undefined,defStat:g('adef').value||undefined,ignoreAtk:igAtk,ignoreDef:igDef,watersport:(f.etc||{})['물놀이']>0,mudsport:(f.etc||{})['흙놀이']>0,scarf:atk.item==='구애스카프',choiceDef:['구애머리띠','구애안경'].includes(def.item||'')&&false,tailwindDef:((f.objects||{})[side]||{})['순풍']>0,swampDef:((f.objects||{})[side]||{})['습원']>0});
    const eff=dmg?B().effectiveness(moveTypes,def,{multiMode:+g('amulti').value,atkTypes,force:g('aforce').value===''?null:+g('aforce').value,floating:(def.states||{}).MagnetRise||(def.states||{}).Telekinesis||(FX()&&FX().floating(def))}):null;
    const stab=eff?eff.stab:false;
    const guard0=(DF.endure?0.5:1)*(mods.guard||1);const endure0=!!DF.endure&&!AF.noEndure;
    const hp=dmg?B().hpDamage(def,dmg.total,eff.value,{stab,adaptability:ck('aadapt'),expertBelt:ck('abelt'),guard:guard0,endure:endure0,hpFloor:raidFloor(def)}):null;
    res.push({slot,def,acc,hits,dmg,eff,stab,hp,guard:guard0,endure:endure0,manual:1,mods})}
   RESULT={mv,targets:res,moveTypes};
   { /* 굴린 시점에 로그로 (자속·보정 같은 공격 쪽 내부 정보는 빼고) */
    const L=res.map(r=>{const hit=r.acc.sure?'필중':r.acc.hit?`명중 ${r.acc.roll}/${r.acc.target}`:`빗나감 ${r.acc.roll}/${r.acc.target}`;if(!r.acc.hit)return `→ ${r.def.name}: ${hit}`;
     const cr=r.hits.length?r.hits.map(h=>h.v===2?`급소!(${h.cr.roll}/${h.cr.chance})`:`${h.cr.roll}/${h.cr.chance}`).join(' · '):'';
     const am=atkMul(r);return `→ ${r.def.name}: ${hit}${cr?' · 급소 '+cr:''}${r.dmg?` · 대미지 ${Math.floor(r.dmg.total*am)}${r.hits.length>1?' ('+r.hits.length+'회)':''} · 상성 ×${r.eff.value}`:' (변화기)'}`});
    A().sysLog(`【공격】 ${atk.name} 『${mv.name}』 ${esc(mv.type||'')} ${mv.cat||''}${+g('apow').value?' 위력 '+g('apow').value:''}
${L.join('\n')}`,'battle',{mid:atk.id,img:atk.image||''})}
   $('#ares',md).innerHTML=`<table class="t"><tr><th>대상</th><th>명중</th><th>급소</th><th>대미지(상성 전)</th><th>상성</th><th>보정</th><th>최종</th></tr>${res.map((r,i)=>`<tr>
    <td class="nw"><div class="row" style="gap:6px;flex-wrap:nowrap"><div class="ti sm" style="${r.def.image?`background-image:url('${cssu(r.def.image)}')`:''}"></div><div><b>${esc(r.def.name)}</b><div class="small dim">HP ${r.def.hp.cur}/${r.def.hp.max}</div>${r.mods&&r.mods.names.length?`<div class="small" style="color:var(--yel2)">${r.mods.names.map(x=>esc(x.txt)).join('<br>')}</div>`:''}</div></div></td>
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
   if(RESULT.check){const am=RESULT.check;if(am.hp.cur<=0)am.entry='';nb.mons[mid]=am;A().closeModal();if(await A().set(['battle','mons'],nb.mons)){A().sysLog(`${atk.name}의 ${RESULT.mv.name}…\n${RESULT.lines.join('\n')}`,'battle')}return}
   if(RESULT.checkOnly){const am=RESULT.checkOnly;nb.mons[mid].states=am.states;if(RESULT.lines.length)lines.push(...RESULT.lines)}
   /* 맵툴처럼 공격 쪽은 판정만 한다. 피해는 받는 쪽이 「HP」 창에서 완화 배율을 넣고 적용한다 (lastHit 에 기록) */
   let dealtAny=false;
   for(const r of RESULT.targets){const def=nb.mons[r.def.id];if(!def)continue;const hitTxt=r.acc.sure?'필중':r.acc.hit?`명중(${r.acc.roll}/${r.acc.target})`:`빗나감(${r.acc.roll}/${r.acc.target})`;
    if(!r.acc.hit){lines.push(`→ ${def.name}: ${hitTxt}`);continue}
    if(!r.dmg){lines.push(`→ ${def.name}: ${hitTxt} (변화기)`);continue}
    const crit=r.hits.some(h=>h.v===2);dealtAny=true;
    const am=atkMul(r,md);
    def.lastHit={from:atk.name,fromId:atk.id,move:RESULT.mv.name,moveType:RESULT.mv.type||'',eff:r.eff.value,effType:r.eff.type||'',total:Math.floor(r.dmg.total*am),min:Math.floor(r.dmg.min*am),max:Math.floor(r.dmg.max*am),hits:r.hits.length,crit,guard:r.guard,guardNote:(r.mods&&r.mods.names.filter(x=>x.who===def.id).map(x=>x.txt).join(' · '))||'',endure:r.endure,expect:r.hp?r.hp.final:0,at:Date.now(),turn:+nb.turn||0};
    if(FX()&&r.mods)FX().consume(nb,r.mods.names);
    lines.push(`→ ${def.name}: ${hitTxt} ${crit?'급소! ':''}${r.hits.length>1?r.hits.length+'회 ':''}대미지 ${def.lastHit.total} ×${r.eff.value}${r.guard&&r.guard!==1?' 완화 ×'+r.guard:''} ≈ ${r.hp?r.hp.final:0} — 받는 쪽이 「HP」에서 적용`)}
   if($('#alife',md).checked&&dealtAny){const a=nb.mons[mid];const rec=Math.max(1,Math.floor(a.hp.max/10));a.hp.latest=a.hp.cur;a.hp.cur=Math.max(0,a.hp.cur-rec);lines.push(`${atk.name} 생명의구슬 반동 −${rec} → ${a.hp.cur}`);if(a.hp.cur<=0){a.entry='';lines.push(`${a.name}은(는) 쓰러졌다!`)}}
   nb.mons[mid].lastDealt={total:RESULT.targets.filter(r=>r.acc.hit&&r.dmg).reduce((a,r)=>a+(r.hp?r.hp.final:0),0),targets:RESULT.targets.filter(r=>r.acc.hit&&r.dmg).map(r=>r.def.name).join(', '),at:Date.now()};
   A().closeModal();if(await A().set(['battle','mons'],nb.mons))A().sysLog(`【전달】 ${atk.name} 『${RESULT.mv.name}』\n${lines.join('\n')}`,'battle',{mid:atk.id,img:atk.image||''})}}

 return {render,watch,ctx,entered,allEntered,fieldOf,resetLocal:()=>{CMD={}},startCut:(m)=>battleStartCut(ctx().b,m),openHp,action};
})();
