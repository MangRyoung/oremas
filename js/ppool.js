/* ---------- 파티 현황 (10-28 망령 「파티 단위 4식 6령은 휴대폰 파티 기능과 연동 — 합쳐진 목록을 보여 주고, 파티 포켓몬 현황도」) ----------
   파티 = 휴대폰 연락처의 방 코드(pub.<트레이너>.phone.room)가 같은 로스터 트레이너들.
   공용 4식 · 6령 = 파티원마다의 4식 · 6령 목록을 합친 것 (1인 4식 1 · 6령 2 를 파티가 합친다). 남은 수는 각 주인의 횟수 그대로 —
   배틀 중이면 배틀 쪽 횟수, 아니면 시트 쪽. 쓰면 주인의 횟수가 줄고(배틀), 휴식이 채운다(skill_ui applyRest 「파티 4식 · 6령 회복」 · 긴 휴식 = 가득).
   포켓몬 현황 = 파티원 포켓몬의 HP · 상태 · 소지품 (배틀 중이면 배틀 쪽). 휴대폰 「파티」 앱과 던전 PT 패널이 같은 그림을 쓴다 */
window.OM_PPOOL=(()=>{
 const A=()=>window.OM_APP;const S=()=>(A()&&A().ST&&A().ST.state)||{};const OO=()=>window.OM_ORDERS;
 const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const RT=()=>((S().roster||{}).trainers)||{},RM=()=>((S().roster||{}).mons)||{};
 const codeOf=tid=>String(((((S().pub||{})[tid]||{}).phone)||{}).room||'').trim();
 const shared=tid=>((((S().pub||{})[tid]||{}).phone)||{}).share!==false&&!(RT()[tid]||{}).priv;   /* 휴대폰 연락처와 같다: 공유를 끈 · 비공개 시트는 남에게 안 보인다 */
 const members=(code,me)=>code?Object.keys(RT()).filter(t=>codeOf(t)===code&&(t===me||shared(t))).sort((a,b)=>(RT()[a].ord||0)-(RT()[b].ord||0)):[];
 const codesOf=tids=>[...new Set((tids||[]).map(codeOf).filter(Boolean))].filter(c=>members(c).length);
 /* 배틀 중이면 배틀 쪽 사본 (빌려 쓴 트레이너는 srcTid · 포켓몬은 rid 로 찾는다) */
 const B=()=>{const b=S().battle||{};return b.started&&!b.done?b:null};   /* 10-31: 던전으로 돌아온 배틀(done)은 끝난 것 — 시트 쪽 횟수를 본다 */
 /* 10-31 망령 「2체 3파티가 디폴트」: 2체 기준 트레이너는 제작기에서 고른 4식 · 6령(twoPick)만 가득 값이 있다 (1인 4식 1 · 6령 2). 나머지 항목은 0 */
 function maxOf(tid,src){const t=RT()[tid]||{};src=src||t;let FL={};try{FL=OO().fill(src,src.orderBase||1)||{}}catch(e){FL={}}if(!t.two||!t.twoPick)return FL;const pk=t.twoPick;const o={};for(const k in FL){const m=k.match(/^(order|command)_([a-z]+)$/);o[k]=m&&((m[1]==='order'?pk.o:pk.c)||[]).includes(m[2])?FL[k]:0}return o}
 const bTr=tid=>{const b=B();if(!b)return null;const T=b.trainers||{};return T[tid]||Object.values(T).find(x=>x&&x.srcTid===tid)||null};
 const bMon=mid=>{const b=B();if(!b)return null;const M=b.mons||{};return M[mid]||Object.values(M).find(x=>x&&x.rid===mid)||null};
 /* 한 사람의 4식 · 6령: [{tid, kind, key, name, left, max}] — max = 제작한 값(가득) */
 function itemsOf(tid){const t=RT()[tid];if(!t||!OO())return [];const bt=bTr(tid);const src=bt&&bt.orderCount?bt:t;const FL=maxOf(tid,src);const two=!!(t.two&&t.twoPick);
  const cnt=src.orderCount||{};const out=[];
  for(const k of Object.keys(Object.assign({},FL,cnt))){const m=k.match(/^(order|command)_([a-z]+)$/);if(!m)continue;const max=two?(+FL[k]||0):Math.max(+FL[k]||0,+cnt[k]||0);if(max<=0)continue;
   const kind=m[1],key=m[2];let name=key;try{name=kind==='order'?OO().orderName(src,key):OO().commandName(src,key)}catch(e){}
   out.push({tid,kind,key,name,left:Math.max(0,Math.min(two?max:1e9,+cnt[k]||0)),max})}
  return out}
 function stat(code,me){const M=members(code,me);const it=M.flatMap(itemsOf);const sum=(kind,f)=>it.filter(x=>x.kind===kind).reduce((a,x)=>a+x[f],0);
  return {code,n:M.length,members:M,items:it,o:sum('order','left'),o0:sum('order','max'),c:sum('command','left'),c0:sum('command','max')}}
 /* 포켓몬 현황: [{tid, mons:[{id, name, img, lv, hp, max, dead, st:[...], item, inB}]}] */
 const ST_KO={Poison:'독',Toxic:'맹독',Burn:'화상',Paralysis:'마비',Freeze:'얼음',Sleep:'잠듦',Confusion:'혼란'};
 function monsOf(tid){const t=RT()[tid]||{};const R=RM();const ids=(t.pids||[]).filter(id=>R[id]);for(const id in R)if(R[id]&&R[id].tid===tid&&!ids.includes(id))ids.push(id);
  if(t.two){const aw=ids.filter(id=>R[id].awaken);if(aw.length)ids.splice(0,ids.length,...aw)}   /* 10-31: 2체 기준이면 각성체만 */
  return ids.map(id=>{const r=R[id];const bm=bMon(id);let max,cur,sts;
   if(bm){const hp=bm.hp||{};max=+hp.max||0;cur=Math.max(0,+(hp.cur==null?max:hp.cur)||0);sts=bm.states||{}}
   else{max=Math.max(1,(r.hp&&r.hp.max)||(r.stats||[])[0]||1);sts=r.sheetStates||{};cur=sts.Dead?0:r.sheetHp==null?max:Math.max(0,Math.min(max,+r.sheetHp||0))}   /* 던전 monHp 와 같다 */
   const x=bm||r;return {id,name:r.name||x.name||'?',img:r.image||x.image||'',lv:+(r.lv||x.lv)||0,hp:cur,max,dead:cur<=0||!!sts.Dead,st:Object.keys(sts).filter(k=>sts[k]&&k!=='Dead').map(k=>((((window.OM_DB||{}).states||{}).st||{})[k]||{}).ko||ST_KO[k]||k),item:x.item||'',inB:!!bm}})}
 /* ---------- 그림 (휴대폰 · 던전이 같이 쓴다) ---------- */
 const tName=tid=>(RT()[tid]||{}).name||tid;
 const pips=(l,m)=>Array.from({length:Math.min(m,6)},(_,i)=>`<i class="${i<l?'on':''}"></i>`).join('')+(m>6?`<em>${l}/${m}</em>`:'');
 /* 같은 이름끼리 한 줄로 합친다: 『버텨라!』 2/3 — 누가 몇 개 */
 function group(s,kind){const G=new Map;for(const x of s.items.filter(x=>x.kind===kind)){const g=G.get(x.name)||{name:x.name,left:0,max:0,who:[]};g.left+=x.left;g.max+=x.max;g.who.push(x);G.set(x.name,g)}return [...G.values()]}
 function ordHTML(s,kind){const L=group(s,kind);const lab=kind==='order'?'4식':'6령';const left=kind==='order'?s.o:s.c,max=kind==='order'?s.o0:s.c0;
  return `<div class="pp-sec ${kind==='order'?'o':'c'}"><div class="pp-h"><b>공용 ${lab}</b><span class="pp-n ${left?'':'z'}">${left}<small>/${max}</small></span></div>
   ${L.length?`<div class="pp-list">${L.map(g=>`<div class="pp-it ${g.left?'':'z'}"><span class="pp-nm">『${esc(g.name)}』</span><span class="pp-cnt">${g.left}<small>/${g.max}</small></span><span class="pp-who">${g.who.map(x=>`<span class="${x.left?'':'z'}" title="${esc(tName(x.tid))} ${x.left}/${x.max}">${esc(tName(x.tid))}<span class="pp-pip">${pips(x.left,x.max)}</span></span>`).join('')}</span></div>`).join('')}</div>`:`<div class="pp-empty">아직 ${lab}이 없다 — 제작기 시트의 지시 체계</div>`}</div>`}
 function monHTML(s){return `<div class="pp-sec m"><div class="pp-h"><b>포켓몬 현황</b>${B()?'<span class="pp-tag">배틀 중 값</span>':''}</div>
   ${s.members.map(tid=>{const L=monsOf(tid);const up=L.filter(m=>!m.dead).length;return `<div class="pp-tr"><div class="pp-trh"><b>${esc(tName(tid))}</b><small>${up}/${L.length}</small></div>
    ${L.length?L.map(m=>{const r=m.max?m.hp/m.max:0;const cls=m.dead?'dead':r<=.25?'red':r<=.5?'yel':'';return `<div class="pp-mon ${m.dead?'dead':''}">${m.img?`<img src="${esc(m.img)}" alt="" loading="lazy">`:'<i class="pp-av"></i>'}<div class="pp-mi"><div class="pp-mt"><b>${esc(m.name)}</b>${m.lv?`<small>Lv${m.lv}</small>`:''}${m.dead?'<span class="pp-st dead">빈사</span>':''}${m.st.map(x=>`<span class="pp-st">${esc(x)}</span>`).join('')}</div>
     <div class="pp-hp"><div class="pp-bar ${cls}"><i style="width:${Math.round(r*100)}%"></i></div><span class="mono">${m.hp}/${m.max}</span></div>${m.item?`<small class="pp-item">${esc(m.item)}</small>`:''}</div></div>`}).join(''):'<div class="pp-empty">포켓몬 없음</div>'}</div>`}).join('')}</div>`}
 /* 파티 한 덩어리 전부 (opt.only = 'ord' | 'mon') */
 function html(code,opt){opt=opt||{};const s=stat(code,opt.me);if(!s.n)return '<div class="pp-empty">이 방 코드의 파티원이 없다</div>';
  return `<div class="pp">${opt.only==='mon'?'':ordHTML(s,'order')+ordHTML(s,'command')}${opt.only==='ord'?'':monHTML(s)}</div>`}
 /* 짧은 요약 줄 (던전 PT 패널 맨 위) */
 function chip(code,me){const s=stat(code,me);const up=s.members.flatMap(monsOf);const alive=up.filter(m=>!m.dead).length;
  return `<span>4식 <b class="${s.o?'':'z'}">${s.o}</b>/${s.o0}</span><span>6령 <b class="${s.c?'':'z'}">${s.c}</b>/${s.c0}</span><span>포켓몬 <b class="${alive?'':'z'}">${alive}</b>/${up.length}</span>`}
 return {codeOf,members,codesOf,itemsOf,maxOf,stat,group,monsOf,html,chip}})();
