/* ---------- 캘린더 탭 ----------
   state.calendar = { today:'YYYY-MM-DD'(게임 안 날짜), weather:'☁', events:{ 'YYYY-MM-DD':[{id,t,k,note}] }, fc:{ 'YYYY-MM-DD':'🌧' } }
   10-24 벨벳 참고: D-day 카드 · 활동 점(그 날 RP 가 오간 정도) · GM 예보(fc — 자동으로 만들지 않고 GM 이 적은 것만. 날짜를 넘기면 그 날 예보가 오늘 날씨가 된다)
   GM 이 오늘·날씨·일정을 고치고, 모두가 본다. */
"use strict";
window.OM_CAL_UI=(()=>{
 const A=()=>window.OM_APP;
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const $=(s,r)=>(r||document).querySelector(s);
 const rnd=n=>{const a=new Uint8Array(n||6);crypto.getRandomValues(a);return Array.from(a,b=>'abcdefghijklmnopqrstuvwxyz0123456789'[b%36]).join('')};
 const KINDS={session:['세션','#fff'],event:['사건','var(--red)'],commu:['커뮤','#f5d000'],battle:['배틀','#ff6a00'],memo:['메모','#8a8a8a']};
 const WD=['일','월','화','수','목','금','토'];const WEATHERS=['☀','⛅','☁','🌧','⛈','🌫','❄','🌙'];
 let view='';
 function C(){return A().ST.state.calendar||{}}
 function gm(){return A().ST.role==='gm'}
 const pad=n=>String(n).padStart(2,'0');const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
 function parse(s){const m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?new Date(+m[1],+m[2]-1,+m[3]):null}
 /* D-day: 오늘(게임 안)에서 며칠 남았나. 0 이면 D-DAY */
 const dd=(a,b)=>{const x=parse(a),y=parse(b);return x&&y?Math.round((x-y)/864e5):null};
 const ddL=n=>n===0?'D-DAY':n>0?'D-'+n:'D+'+(-n);
 function todayOf(c){return (c||C()).today||ymd(new Date())}
 /* 다가오는 첫 일정 (메모는 뺀다). 무대 날짜 표 옆 D-day 칩도 이걸 쓴다 */
 function next(c,within){c=c||C();const t=todayOf(c);const ev=c.events||{};
  for(const k of Object.keys(ev).filter(k=>k>=t).sort()){const n=dd(k,t);if(within!=null&&n>within)break;const e=(ev[k]||[]).find(x=>x.k!=='memo');if(e)return Object.assign({date:k,n},e)}return null}
 /* 활동 점: 기록의 「날짜: YYYY-MM-DD」 줄을 따라가며, 그 사이 오간 세션 대사 수를 그 날짜에 센다.
    첫 날짜 줄 앞의 대사는 어느 날인지 몰라서 빼고, 날짜 줄이 하나도 없는 방이면 모두 오늘로 */
 let ACT={n:-1,last:0,map:{}};
 function activity(){const ST=A().ST;const L=ST.log||[];const last=L.length?L[L.length-1].id:0;if(ACT.n===L.length&&ACT.last===last&&ACT.room===ST.room)return ACT.map;
  const map={};const hasDate=L.some(r=>r.kind==='sys'&&/^날짜: \d{4}-\d{2}-\d{2}/.test((r.data||{}).t||''));let cur=hasDate?null:todayOf();
  for(const r of L){const d=r.data||{};if(r.kind==='sys'){const m=String(d.t||'').match(/^날짜: (\d{4}-\d{2}-\d{2})/);if(m)cur=m[1];continue}
   if(!cur||r.kind!=='chat'||d.ch==='ooc'||d.bat||d.clear||!(d.t||d.img))continue;map[cur]=(map[cur]||0)+1}
  ACT={n:L.length,last,room:ST.room,map};return map}
 const actLv=n=>!n?0:n<10?1:n<40?2:3;

 function render(el){
  const c=C();const today=parse(c.today)||new Date();if(!view)view=c.today?c.today.slice(0,7):ymd(today).slice(0,7);
  const [vy,vm]=view.split('-').map(Number);const first=new Date(vy,vm-1,1);const start=new Date(first);start.setDate(1-first.getDay());
  const ev=c.events||{};const cells=[];for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);cells.push(d)}
  const todayS=c.today||ymd(today);
  const upcoming=Object.keys(ev).filter(k=>k>=todayS).sort().slice(0,8).flatMap(k=>(ev[k]||[]).map(e=>({date:k,...e})));
  const act=activity();const fc=c.fc||{};const nx=next(c);
  const week=[...Array(7)].map((_,i)=>{const d=new Date(parse(todayS)||today);d.setDate(d.getDate()+i);const k=ymd(d);return {k,d,w:i===0?(c.weather||fc[k]||''):(fc[k]||'')}});
  el.innerHTML=`<div class="cal">
   <div class="calhead"><div class="caltoday"><div class="cd">${esc(todayS.slice(5).replace('-','/'))}</div><div class="cw">${WD[(parse(todayS)||today).getDay()]}</div><div class="cwx">${esc(c.weather||'')}</div>${c.phase?`<div class="cph">${esc(c.phase)}</div>`:''}</div>
    <div class="caltitle"><div class="small dim">MONTHLY SCHEDULE</div><div class="cm">${vy}.<b>${pad(vm)}</b></div></div><span class="sp"></span>
    <div class="row"><button class="btn xs" data-c="prev">‹</button><button class="btn xs" data-c="now">오늘</button><button class="btn xs" data-c="next">›</button></div>
    ${gm()?`<div class="row" style="margin-left:12px"><button class="btn xs ghost" data-c="day-">오늘 −1</button><button class="btn xs ghost" data-c="day+">오늘 +1</button><select id="cwsel">${['',...WEATHERS].map(w=>`<option value="${w}" ${c.weather===w?'selected':''}>${w||'날씨'}</option>`).join('')}</select><select id="cpsel" title="밤낮">${['','아침','점심','오후','저녁','밤','심야'].map(w=>`<option value="${w}" ${(c.phase||'')===w?'selected':''}>${w||'밤낮'}</option>`).join('')}</select><button class="btn xs" data-c="add">+ 일정</button><label class="small calrpd" title="RP 화면 왼쪽 위, 배경 이름 위에 날짜 · 요일 · 날씨를 띄운다"><input type="checkbox" id="crpd" ${c.rpDate===0?'':(c.rpDate||c.today)?'checked':''}> RP 에 날짜 표기</label></div>`:''}</div>
   <div class="calbody"><div class="calgrid">${WD.map((w,i)=>`<div class="cwd ${i===0?'sun':i===6?'sat':''}">${w}</div>`).join('')}
    ${cells.map(d=>{const k=ymd(d);const out=d.getMonth()!==vm-1;const list=ev[k]||[];return `<div class="ccell ${out?'out':''} ${k===todayS?'today':''} ${d.getDay()===0?'sun':d.getDay()===6?'sat':''}" data-d="${k}"><div class="cn">${d.getDate()}${k===todayS?'<span class="tt">TODAY</span>':''}${actLv(act[k])?`<i class="cact l${actLv(act[k])}" title="이 날 오간 대사 ${act[k]}줄"></i>`:''}${k>todayS&&fc[k]?`<span class="cfc" title="예보">${esc(fc[k])}</span>`:''}</div>${list.map(e=>`<div class="cev" data-e="${e.id}" data-d="${k}" style="border-color:${(KINDS[e.k]||KINDS.memo)[1]}">${esc(e.t)}</div>`).join('')}</div>`}).join('')}</div>
    <div class="calside">${nx?`<div class="cdday" data-e="${esc(nx.id)}" data-d="${nx.date}" style="--kc:${(KINDS[nx.k]||KINDS.memo)[1]}"><div class="cddn">${ddL(nx.n)}</div><div class="cddt"><span class="cddk">${(KINDS[nx.k]||KINDS.memo)[0]}</span><b>${esc(nx.t)}</b><small>${esc(nx.date.slice(5).replace('-','/'))} (${WD[parse(nx.date).getDay()]})${nx.n===0?' · 오늘':''}</small></div></div>`:''}
     <div class="cfcw"><div class="small dim">FORECAST <span class="cfcn">GM 예보</span></div><div class="cfcs">${week.map((x,i)=>`<button class="cfd ${i===0?'now':''} ${x.d.getDay()===0?'sun':x.d.getDay()===6?'sat':''}" data-d="${x.k}" ${gm()||x.w?'':'disabled'}><i>${i===0?'오늘':WD[x.d.getDay()]}</i><b>${esc(x.w)||'·'}</b><small>${x.d.getDate()}</small></button>`).join('')}</div>${gm()?'<div class="small dim cfch">날을 눌러 예보를 적어 둬. 날짜를 넘기면 그 날 예보가 오늘 날씨가 돼.</div>':''}</div>
     <div class="small dim">MISSION &amp; EVENTS</div><div class="cup">UPCOMING <b>EVENTS</b></div><div class="small dim" style="margin-bottom:8px">${upcoming.length} scheduled</div>
     ${upcoming.length?upcoming.map(e=>`<div class="cupi" data-e="${e.id}" data-d="${e.date}"><span class="cupd">${esc(e.date.slice(5).replace('-','/'))}</span><span class="cupdd ${dd(e.date,todayS)===0?'on':''}">${ddL(dd(e.date,todayS))}</span><span class="tag" style="border-color:${(KINDS[e.k]||KINDS.memo)[1]}">${(KINDS[e.k]||KINDS.memo)[0]}</span> ${esc(e.t)}</div>`).join(''):'<div class="empty small">예정된 일정이 없어</div>'}
     <div class="cleg small dim"><span><i class="cact l1"></i><i class="cact l2"></i><i class="cact l3"></i> RP 가 오간 날 (많을수록 진하게)</span></div></div></div></div>`;
  el.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>ctl(b.dataset.c));
  const ws=$('#cwsel',el);if(ws)ws.onchange=()=>A().set(['calendar','weather'],ws.value);
  const rd=$('#crpd',el);if(rd)rd.onchange=async()=>{await A().set(['calendar','rpDate'],rd.checked?1:0);A().toast(rd.checked?'RP 화면에 날짜를 띄운다':'RP 화면에서 날짜를 숨긴다')};
  const ps=$('#cpsel',el);if(ps)ps.onchange=async()=>{await A().set(['calendar','phase'],ps.value);if(ps.value)A().sysLog(`시간대: ${ps.value}`)};
  el.querySelectorAll('.cev,.cupi,.cdday').forEach(x=>x.onclick=e=>{e.stopPropagation();openDay(x.dataset.d,x.dataset.e)});
  el.querySelectorAll('.cfd').forEach(x=>x.onclick=()=>openDay(x.dataset.d,null));
  el.querySelectorAll('.ccell').forEach(x=>{if(gm()||x.querySelector('.cev,.cfc'))x.classList.add('cclk');x.onclick=()=>openDay(x.dataset.d,null)})}
 async function ctl(k){const c=C();const [vy,vm]=view.split('-').map(Number);
  if(k==='prev'){const d=new Date(vy,vm-2,1);view=ymd(d).slice(0,7)}if(k==='next'){const d=new Date(vy,vm,1);view=ymd(d).slice(0,7)}if(k==='now'){view=(c.today||ymd(new Date())).slice(0,7)}
  if(k==='day+'||k==='day-'){const d=parse(c.today)||new Date();d.setDate(d.getDate()+(k==='day+'?1:-1));await A().set(['calendar','today'],ymd(d));A().sysLog(`날짜: ${ymd(d)} (${WD[d.getDay()]})`);view=ymd(d).slice(0,7);await applyFc(ymd(d))}
  if(k==='add')return openDay(c.today||ymd(new Date()),null);
  A().renderScene()}
 /* 그 날 예보가 있으면 오늘 날씨로 (예보와 이미 같으면 그대로) */
 async function applyFc(date){const w=(C().fc||{})[date];if(!w||C().weather===w)return;await A().set(['calendar','weather'],w);A().sysLog(`날씨: ${w} (예보대로)`)}
 /* 날짜 창: 그 날의 일정 목록 + (GM) 바로 쓰고 고치는 칸. id 를 주면 그 일정을 고치는 상태로 연다 */
 function openDay(date,id){const c=C();const E=gm();const d=parse(date);if(!d)return;const todayS=c.today||ymd(new Date());
  const list=(c.events||{})[date]||[];let e=id?list.find(x=>x.id===id)||null:null;const fw=(c.fc||{})[date]||'';if(!E&&!list.length&&!id&&!fw)return;const nd0=dd(date,todayS);
  const kc=k=>(KINDS[k]||KINDS.memo);const dw=d.getDay();
  const item=x=>`<div class="cdi ${e&&e.id===x.id?'on':''}" data-de="${x.id}" style="--kc:${kc(x.k)[1]}"><div class="cdit"><span class="cdk">${kc(x.k)[0]}</span><b>${esc(x.t)}</b>${E?'<span class="cdie">고치기</span>':''}</div>${x.note?`<div class="cdin">${esc(x.note)}</div>`:''}</div>`;
  const k0=e?e.k:'session';
  const md=A().openModal(`<div class="mhead cdh"><div class="cdd ${dw===0?'sun':dw===6?'sat':''}"><b>${pad(d.getMonth()+1)}/${pad(d.getDate())}</b><span>${WD[dw]}</span></div><div class="cdy"><span class="small dim">${d.getFullYear()}</span>${date===todayS?'<span class="tt">TODAY</span>':`<span class="cdddl">${ddL(nd0)}</span>`}</div><span class="sp"></span><button class="btn xs" data-dn="-1" title="전날">‹</button><button class="btn xs" data-dn="1" title="다음날">›</button><button class="btn ghost" data-x>닫기</button></div>
   ${E&&date>=todayS?`<div class="cdfc"><b>예보</b>${['',...WEATHERS].map(w=>`<button class="cdfw ${fw===w?'on':''}" data-fw="${w}" title="${w?'이 날 예보: '+w:'예보 지우기'}">${w||'없음'}</button>`).join('')}</div>`:(fw&&date>todayS?`<div class="cdfc"><b>예보</b><span class="cdfw on">${esc(fw)}</span><span class="small dim">GM 예보 — 바뀔 수도 있어</span></div>`:'')}
   <div class="cdl">${list.map(item).join('')||'<div class="empty small">이 날 일정이 없어</div>'}</div>
   ${E?`<div class="cdf"><div class="cdfh"><b>${e?'일정 고치기':'새 일정'}</b>${e?'<button class="btn xs ghost" id="enew">+ 새로 쓰기</button>':''}</div>
    <div class="cdks">${Object.entries(KINDS).map(([k,[n,col]])=>`<button class="cdkb ${k0===k?'on':''}" data-ek="${k}" style="--kc:${col}">${n}</button>`).join('')}</div>
    <input type="text" id="et" value="${esc(e?e.t:'')}" placeholder="제목 (Enter 로 저장)" class="cdti">
    <textarea id="en" rows="3" placeholder="메모">${esc(e?e.note||'':'')}</textarea>
    <div class="row cdfb">${e?`<label class="small dim">날짜 옮기기 <input type="date" id="ed" value="${esc(date)}"></label><button class="btn sm ghost danger" id="edel">삭제</button>`:''}<span class="sp"></span>${date!==todayS?'<button class="btn sm ghost" id="etoday">이 날을 오늘로</button>':''}<button class="btn pri" id="eok">${e?'저장':'추가'}</button></div></div>`:''}`);
  md.querySelectorAll('[data-dn]').forEach(b=>b.onclick=()=>{const n=new Date(d);n.setDate(n.getDate()+ +b.dataset.dn);const ns=ymd(n);if(!E&&!((C().events||{})[ns]||[]).length){A().closeModal();return A().toast(`${ns.slice(5).replace('-','/')} 일정 없음`)}openDay(ns)});
  md.querySelectorAll('[data-de]').forEach(x=>x.onclick=()=>{if(E)openDay(date,x.dataset.de)});
  if(!E)return;
  md.querySelectorAll('[data-fw]').forEach(b=>b.onclick=async()=>{const w=b.dataset.fw;const f=Object.assign({},C().fc||{});if(w)f[date]=w;else delete f[date];
   for(const k in f)if(k<todayOf())delete f[k];   /* 지난 예보는 치운다 */
   await A().set(['calendar','fc'],f);if(date===todayOf()&&w)await A().set(['calendar','weather'],w);md.querySelectorAll('[data-fw]').forEach(y=>y.classList.toggle('on',y===b));A().renderScene()});
  let k=k0;md.querySelectorAll('[data-ek]').forEach(b=>b.onclick=()=>{k=b.dataset.ek;md.querySelectorAll('[data-ek]').forEach(y=>y.classList.toggle('on',y===b))});
  const nb=$('#enew',md);if(nb)nb.onclick=()=>openDay(date);
  const save=async()=>{const nd=e?$('#ed',md).value.trim():date;if(!parse(nd))return A().toast('날짜를 골라 줘');const ne={id:e?e.id:'ev'+rnd(6),t:$('#et',md).value.trim()||'(제목 없음)',k,note:$('#en',md).value};
   const evs=JSON.parse(JSON.stringify(C().events||{}));if(e){evs[date]=(evs[date]||[]).filter(x=>x.id!==e.id);if(!evs[date].length)delete evs[date]}(evs[nd]=evs[nd]||[]).push(ne);A().closeModal();await A().set(['calendar','events'],evs)};
  $('#eok',md).onclick=save;$('#et',md).onkeydown=ev=>{if(ev.key==='Enter'&&!ev.isComposing){ev.preventDefault();save()}};
  const del=$('#edel',md);if(del)del.onclick=async()=>{if(!confirm(`「${e.t}」 일정을 지울까?`))return;const evs=JSON.parse(JSON.stringify(C().events||{}));evs[date]=(evs[date]||[]).filter(x=>x.id!==e.id);if(!evs[date].length)delete evs[date];A().closeModal();await A().set(['calendar','events'],evs)};
  const tb=$('#etoday',md);if(tb)tb.onclick=async()=>{await A().set(['calendar','today'],date);A().sysLog(`날짜: ${date} (${WD[dw]})`);view=date.slice(0,7);await applyFc(date);A().closeModal();A().renderScene()};
  if(!e)setTimeout(()=>{const t=$('#et',md);if(t)t.focus()},30)}
 return {render,next,ddL};
})();
