/* ---------- 시트 되돌리기 ↶↷ · 수정 기록 (10-24 벨벳 「undo / 편집 기록」 참고) ----------
   시트가 쓰는 OM_APP.setDiff(['roster','mons'|'trainers',id], 원본, 사본) 를 감싸서, 바뀐 맨 위 칸의 앞뒤 값을 이 브라우저에 남긴다 (방마다 최근 60개).
   되돌릴 때는 그 칸이 아직 「고친 뒤 값」 그대로일 때만 돌린다 — 그 사이 남(GM · 다른 창)이 고친 칸은 건드리지 않는다.
   sheet_ui.js 는 고치지 않는다: 시트 탭을 그린 뒤 위 띠(.stabs)에 단추만 끼운다 */
"use strict";
window.OM_SHEET_HIST=(()=>{
 const A=()=>window.OM_APP;
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const MAX=60,BIG=120000;   /* 한 칸이 이보다 크면(그림 data: 주소 등) 기록하지 않는다 — 브라우저 저장 공간 보호 */
 const KO={name:'이름',hp:'HP',lv:'레벨',base:'종족치',iv:'개체값',ev:'노력치',moves:'기술',pots:'포텐셜',item:'소지품',itemEff:'소지품 효과',ability:'특성',abilityEff:'특성 효과',image:'그림',stands:'스탠딩',standActive:'스탠딩 선택',ranks:'랭크',note:'메모',memo:'메모',pids:'파티',types:'타입',nature:'성격',exp:'경험치',money:'돈',bag:'가방',unique:'고유 포텐셜',priv:'공개 여부',partner:'파트너',auto:'자동화 구문',excl:'전용 포텐셜',stats:'실수치',sex:'성별',age:'나이',title:'칭호',skills:'스킬'};
 const ko=k=>KO[k]||k;
 const room=()=>A().ST.room||'_';
 const key=()=>'om_shist_'+room();
 const J=v=>JSON.stringify(v===undefined?null:v);
 const same=(a,b)=>J(a)===J(b);
 const load=()=>{try{const v=JSON.parse(localStorage.getItem(key())||'[]');return Array.isArray(v)?v:[]}catch(e){return []}};
 const save=L=>{try{localStorage.setItem(key(),JSON.stringify(L.slice(-MAX)))}catch(e){try{localStorage.setItem(key(),JSON.stringify(L.slice(-Math.floor(MAX/3))))}catch(e2){}}};
 const ST={undo:[],redo:[],busy:false};   /* undo/redo: 기록 id 목록 (이 창에서 한 것만) */
 const rid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
 const cur=(kind,id)=>(((A().ST.state.roster||{})[kind])||{})[id];

 /* 감싸기: 시트에서 쓰는 setDiff 만 기록 */
 let raw=null;
 function wrap(){const app=A();if(!app||raw)return;raw=app.setDiff;
  app.setDiff=function(path,before,after,depth){const p=Array.isArray(path)?path:[];
   if(!ST.busy&&p.length===3&&p[0]==='roster'&&(p[1]==='mons'||p[1]==='trainers')&&before&&after){try{record(p[1],p[2],before,after)}catch(e){}}
   return raw.apply(this,arguments)}}
 function record(kind,id,b,a){const ch={};for(const k of new Set([...Object.keys(b||{}),...Object.keys(a||{})])){if(same(b[k],a[k]))continue;const jb=J(b[k]),ja=J(a[k]);if(jb.length>BIG||ja.length>BIG)continue;ch[k]={b:b[k]===undefined?null:b[k],a:a[k]===undefined?null:a[k]}}
  if(!Object.keys(ch).length)return;
  const L=load();const last=L[L.length-1];const now=Date.now();
  /* 같은 칸을 2초 안에 이어서 고치면(숫자 칸 ▲▼ 연타) 한 줄로 합친다 */
  if(last&&last.kind===kind&&last.id===id&&now-last.at<2000&&Object.keys(ch).every(k=>last.ch[k])&&ST.undo[ST.undo.length-1]===last.rid){for(const k in ch)last.ch[k].a=ch[k].a;last.at=now;save(L);paint();return}
  const e={rid:rid(),at:now,kind,id,tid:kind==='mons'?(a.tid||b.tid||''):id,name:a.name||b.name||'',ch};L.push(e);save(L);ST.undo.push(e.rid);ST.redo=[];paint()}

 /* 한 기록을 앞(b) 또는 뒤(a) 값으로: 지금 값이 반대쪽과 같을 때만 */
 async function apply(e,dir){const o=cur(e.kind,e.id);if(!o)return {n:0,skip:Object.keys(e.ch).length,gone:true};
  const n=JSON.parse(JSON.stringify(o));let ok=0,skip=0;
  for(const k in e.ch){const from=dir==='undo'?e.ch[k].a:e.ch[k].b,to=dir==='undo'?e.ch[k].b:e.ch[k].a;
   if(!same(o[k]===undefined?null:o[k],from)){skip++;continue}if(to===null)delete n[k];else n[k]=JSON.parse(JSON.stringify(to));ok++}
  if(ok){ST.busy=true;try{await raw.call(A(),['roster',e.kind,e.id],o,n,1)}finally{ST.busy=false}}
  return {n:ok,skip}}
 const say=(r,verb,e)=>{const nm=e.name?`「${e.name}」 `:'';if(r.gone)return A().toast(`${nm}시트가 없어져서 ${verb} 못했다`);
  A().toast(r.n?`${nm}${verb} (${r.n}칸)${r.skip?` · 그 사이 바뀐 ${r.skip}칸은 그대로`:''}`:`${nm}그 사이 다시 바뀌어서 ${verb} 칸이 없다`)};
 const find=r=>load().find(e=>e.rid===r);
 async function undo(){const r=ST.undo.pop();if(!r)return A().toast('되돌릴 수정이 없다');const e=find(r);if(!e)return paint();const res=await apply(e,'undo');ST.redo.push(r);say(res,'되돌렸다',e);paint()}
 async function redo(){const r=ST.redo.pop();if(!r)return A().toast('다시 할 수정이 없다');const e=find(r);if(!e)return paint();const res=await apply(e,'redo');ST.undo.push(r);say(res,'다시 했다',e);paint()}

 /* 수정 기록 창 */
 const tm=t=>{const d=new Date(t);const p=n=>String(n).padStart(2,'0');return `${d.getMonth()+1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`};
 const short=v=>{if(v===null||v===undefined||v==='')return '없음';if(typeof v==='object'){if(Array.isArray(v)){const ns=v.map(x=>x&&typeof x==='object'?(x.name||x.label||''):x).filter(x=>x!==''&&x!=null);return ns.length?ns.slice(0,4).join(', ')+(ns.length>4?` 외 ${ns.length-4}`:''):`${v.length}개`}
  if('cur' in v&&'max' in v)return `${v.cur}/${v.max}`;return '…'}const s=String(v);return /^data:/.test(s)?'(그림)':s.length>24?s.slice(0,24)+'…':s};
 function openList(tid){const L=load().filter(e=>!tid||e.tid===tid).reverse();
  const row=e=>`<div class="shrow" data-rid="${e.rid}"><div class="shrh"><b>${esc(e.name||'?')}</b><span class="small dim">${e.kind==='mons'?'포켓몬':'트레이너'} · ${tm(e.at)}</span>${ST.undo.includes(e.rid)?'<span class="shme">이 창</span>':''}</div>
   <div class="shch">${Object.entries(e.ch).map(([k,v])=>`<span><i>${esc(ko(k))}</i> ${esc(short(v.b))} → <em>${esc(short(v.a))}</em></span>`).join('')}</div>
   <div class="shbt"><button class="btn xs" data-sh="one">이 수정만 되돌리기</button><button class="btn xs ghost" data-sh="to" title="이보다 뒤에 한 수정을 모두 되돌려, 이 수정 직후 모습으로">이때로</button></div></div>`;
  const md=A().openModal(`<div class="mhead"><h2>수정 기록 <span class="small dim">이 브라우저에서 한 시트 수정 · 최근 ${MAX}개</span></h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="shlist">${L.length?L.map(row).join(''):'<div class="empty small">아직 기록이 없다<br><span class="dim">시트를 고치면 여기에 쌓인다</span></div>'}</div>
   ${L.length?`<div class="row afoot"><span class="small dim">남이 그 사이 고친 칸은 건드리지 않는다</span><span class="sp"></span><button class="btn xs ghost danger" id="shclr">기록 지우기</button></div>`:''}`);
  md.querySelectorAll('[data-sh]').forEach(b=>b.onclick=async()=>{const r=b.closest('[data-rid]').dataset.rid;const all=load();const i=all.findIndex(e=>e.rid===r);if(i<0)return;
   if(b.dataset.sh==='one'){const res=await apply(all[i],'undo');ST.undo=ST.undo.filter(x=>x!==r);say(res,'되돌렸다',all[i])}
   else{const later=all.slice(i+1).filter(e=>!tid||e.tid===tid).reverse();if(!later.length)return A().toast('이게 가장 최근 수정이다');if(!confirm(`이 뒤에 한 수정 ${later.length}개를 되돌릴까?`))return;let n=0,sk=0;for(const e of later){const res=await apply(e,'undo');n+=res.n;sk+=res.skip}ST.undo=ST.undo.filter(x=>!later.some(e=>e.rid===x));A().toast(`${n}칸 되돌렸다${sk?` · 그 사이 바뀐 ${sk}칸은 그대로`:''}`)}
   A().closeModal();paint()});
  const c=md.querySelector('#shclr');if(c)c.onclick=()=>{if(!confirm('이 방의 수정 기록을 이 브라우저에서 지울까? (시트는 그대로)'))return;save(load().filter(e=>tid&&e.tid!==tid));ST.undo=[];ST.redo=[];A().closeModal();paint()}}

 /* 시트 탭 위 띠에 단추 끼우기 */
 let host=null,tidNow='';
 function paint(){if(!host||!host.isConnected)return;const u=host.querySelector('[data-shu]'),r=host.querySelector('[data-shr]');if(u)u.disabled=!ST.undo.length;if(r)r.disabled=!ST.redo.length}
 function inject(el){const bar=el&&el.querySelector('.stabs');if(!bar||bar.querySelector('.shist'))return;if(!bar.querySelector('[data-act="toggleedit"]'))return;   /* 고칠 수 있는 시트만 */
  const tb=bar.querySelector('[data-act="refresh"],[data-act="deltr"]');tidNow=tb?tb.dataset.tid||'':'';
  const s=document.createElement('span');s.className='shist';s.innerHTML=`<button class="btn sm ghost" data-shu title="되돌리기 (Ctrl+Z)">↶</button><button class="btn sm ghost" data-shr title="다시 하기 (Ctrl+Shift+Z)">↷</button><button class="btn sm ghost" data-shl title="수정 기록">🕘<span class="shlb"> 기록</span></button>`;
  const sp=bar.querySelector('.sp');if(sp)sp.after(s);else bar.appendChild(s);host=s;
  s.querySelector('[data-shu]').onclick=undo;s.querySelector('[data-shr]').onclick=redo;s.querySelector('[data-shl]').onclick=()=>openList(tidNow);paint()}
 function hook(){const S=window.OM_SHEET_UI;if(!S||S.__hist)return;const r0=S.render;S.render=function(el){const out=r0.apply(this,arguments);try{inject(el)}catch(e){}return out};S.__hist=1}
 document.addEventListener('keydown',ev=>{if(!(ev.ctrlKey||ev.metaKey)||ev.key.toLowerCase()!=='z')return;const t=ev.target;if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))return;
  if(!host||!host.isConnected||document.querySelector('.modal'))return;ev.preventDefault();(ev.shiftKey?redo:undo)()});
 function init(){wrap();hook()}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
 return {undo,redo,openList,init};
})();
