/* ---------- 캘린더 탭 ----------
   state.calendar = { today:'YYYY-MM-DD'(게임 안 날짜), weather:'☁', events:{ 'YYYY-MM-DD':[{id,t,k,note}] } }
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

 function render(el){
  const c=C();const today=parse(c.today)||new Date();if(!view)view=c.today?c.today.slice(0,7):ymd(today).slice(0,7);
  const [vy,vm]=view.split('-').map(Number);const first=new Date(vy,vm-1,1);const start=new Date(first);start.setDate(1-first.getDay());
  const ev=c.events||{};const cells=[];for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);cells.push(d)}
  const todayS=c.today||ymd(today);
  const upcoming=Object.keys(ev).filter(k=>k>=todayS).sort().slice(0,8).flatMap(k=>(ev[k]||[]).map(e=>({date:k,...e})));
  el.innerHTML=`<div class="cal">
   <div class="calhead"><div class="caltoday"><div class="cd">${esc(todayS.slice(5).replace('-','/'))}</div><div class="cw">${WD[(parse(todayS)||today).getDay()]}</div><div class="cwx">${esc(c.weather||'')}</div></div>
    <div class="caltitle"><div class="small dim">MONTHLY SCHEDULE</div><div class="cm">${vy}.<b>${pad(vm)}</b></div></div><span class="sp"></span>
    <div class="row"><button class="btn xs" data-c="prev">‹</button><button class="btn xs" data-c="now">오늘</button><button class="btn xs" data-c="next">›</button></div>
    ${gm()?`<div class="row" style="margin-left:12px"><button class="btn xs ghost" data-c="day-">오늘 −1</button><button class="btn xs ghost" data-c="day+">오늘 +1</button><select id="cwsel">${['',...WEATHERS].map(w=>`<option value="${w}" ${c.weather===w?'selected':''}>${w||'날씨'}</option>`).join('')}</select><button class="btn xs" data-c="add">+ 일정</button></div>`:''}</div>
   <div class="calbody"><div class="calgrid">${WD.map((w,i)=>`<div class="cwd ${i===0?'sun':i===6?'sat':''}">${w}</div>`).join('')}
    ${cells.map(d=>{const k=ymd(d);const out=d.getMonth()!==vm-1;const list=ev[k]||[];return `<div class="ccell ${out?'out':''} ${k===todayS?'today':''} ${d.getDay()===0?'sun':d.getDay()===6?'sat':''}" data-d="${k}"><div class="cn">${d.getDate()}${k===todayS?'<span class="tt">TODAY</span>':''}</div>${list.map(e=>`<div class="cev" data-e="${e.id}" data-d="${k}" style="border-color:${(KINDS[e.k]||KINDS.memo)[1]}">${esc(e.t)}</div>`).join('')}</div>`}).join('')}</div>
    <div class="calside"><div class="small dim">MISSION &amp; EVENTS</div><div class="cup">UPCOMING <b>EVENTS</b></div><div class="small dim" style="margin-bottom:8px">${upcoming.length} scheduled</div>
     ${upcoming.length?upcoming.map(e=>`<div class="cupi" data-e="${e.id}" data-d="${e.date}"><span class="cupd">${esc(e.date.slice(5).replace('-','/'))}</span><span class="tag" style="border-color:${(KINDS[e.k]||KINDS.memo)[1]}">${(KINDS[e.k]||KINDS.memo)[0]}</span> ${esc(e.t)}</div>`).join(''):'<div class="empty small">예정된 일정이 없어</div>'}</div></div></div>`;
  el.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>ctl(b.dataset.c));
  const ws=$('#cwsel',el);if(ws)ws.onchange=()=>A().set(['calendar','weather'],ws.value);
  el.querySelectorAll('.cev,.cupi').forEach(x=>x.onclick=e=>{e.stopPropagation();openEvent(x.dataset.d,x.dataset.e)});
  if(gm())el.querySelectorAll('.ccell').forEach(x=>x.ondblclick=()=>openEvent(x.dataset.d,null))}
 async function ctl(k){const c=C();const [vy,vm]=view.split('-').map(Number);
  if(k==='prev'){const d=new Date(vy,vm-2,1);view=ymd(d).slice(0,7)}if(k==='next'){const d=new Date(vy,vm,1);view=ymd(d).slice(0,7)}if(k==='now'){view=(c.today||ymd(new Date())).slice(0,7)}
  if(k==='day+'||k==='day-'){const d=parse(c.today)||new Date();d.setDate(d.getDate()+(k==='day+'?1:-1));await A().set(['calendar','today'],ymd(d));A().sysLog(`날짜: ${ymd(d)} (${WD[d.getDay()]})`);view=ymd(d).slice(0,7)}
  if(k==='add')return openEvent(c.today||ymd(new Date()),null);
  A().renderScene()}
 function openEvent(date,id){const c=C();const list=(c.events||{})[date]||[];const e=id?list.find(x=>x.id===id):null;const E=gm();
  if(!E&&!e)return;
  const md=A().openModal(`<div class="mhead"><h2>${e?'일정':'일정 추가'}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   ${E?`<div class="row"><label>날짜 <input type="text" id="ed" value="${esc(date)}" placeholder="YYYY-MM-DD"></label><label>종류 <select id="ek">${Object.entries(KINDS).map(([k,[n]])=>`<option value="${k}" ${(e?e.k:'session')===k?'selected':''}>${n}</option>`).join('')}</select></label></div>
    <div class="row" style="margin-top:6px"><input type="text" id="et" value="${esc(e?e.t:'')}" placeholder="제목" style="flex:1"></div><div style="margin-top:6px"><textarea id="en" rows="4" style="width:100%" placeholder="메모">${esc(e?e.note||'':'')}</textarea></div>
    <div class="row" style="margin-top:10px">${e?`<button class="btn sm ghost danger" id="edel">삭제</button>`:''}<span class="sp"></span><button class="btn pri" id="eok">저장</button></div>`
   :`<div><span class="tag">${(KINDS[e.k]||KINDS.memo)[0]}</span> <b>${esc(e.t)}</b> <span class="dim small">${esc(date)}</span></div><div class="pre small" style="margin-top:8px">${esc(e.note||'')}</div>`}`);
  if(!E)return;
  $('#eok',md).onclick=async()=>{const nd=$('#ed',md).value.trim();if(!parse(nd))return A().toast('날짜는 YYYY-MM-DD');const ne={id:e?e.id:'ev'+rnd(6),t:$('#et',md).value.trim()||'(제목 없음)',k:$('#ek',md).value,note:$('#en',md).value};
   const evs=JSON.parse(JSON.stringify(c.events||{}));if(e){evs[date]=(evs[date]||[]).filter(x=>x.id!==e.id);if(!evs[date].length)delete evs[date]}(evs[nd]=evs[nd]||[]).push(ne);A().closeModal();await A().set(['calendar','events'],evs)};
  const del=$('#edel',md);if(del)del.onclick=async()=>{const evs=JSON.parse(JSON.stringify(c.events||{}));evs[date]=(evs[date]||[]).filter(x=>x.id!==e.id);if(!evs[date].length)delete evs[date];A().closeModal();await A().set(['calendar','events'],evs)}}
 return {render};
})();
