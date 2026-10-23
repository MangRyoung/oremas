/* ---------- 명령(4식, ORDER)·지령(6령, COMMAND) — 맵툴 js_trainer / js_order 와 같은 표 ----------
   · 명령 계열 tc (0~8, const.lists.list_command 순서) → 지령 계열 tord (0~3, list_order 순서) 가 따라온다 (tordOf).
   · 「지령 종류」(협회식/십계/야생/방해) 를 고르면 트레이너의 지시 랭크로 세부 계열이 자동으로 정해진다 (presetTc).
   · 항목(retreat/attack …)마다 다른 계열을 쓸 수 있다: t.orderType = {o_<k>: tord', c_<k>: tc'} (맵툴 type_order_<k>/type_command_<k>).
     이름은 그 항목의 계열 목록(list_order_<tord>/list_command_<tc>)에서 읽고, 그 계열에 없는 항목은 이름이 없어 0 이 된다.
   · 횟수: t.orderCount = {order_<k>, command_<k>}, 기준 횟수 t.orderBase.
   · 함께 지시하기(10-23 망령): 합친 트레이너 몫은 t.coOrd[n-1] 에 두고 항목 키 뒤에 「@n」 을 붙인다 (retreat@1 · order_retreat@1). */
"use strict";
window.OM_ORDERS=(()=>{
 const LO=['retreat','dodge','endure','return','snipe','special'];
 const LC=['attack','defense','specialattack','specialdefense','speed','heal','accuracy','evasion'];
 const OK={0:['retreat','dodge','endure','return','snipe'],1:['retreat','dodge','endure','snipe'],2:['retreat','dodge','endure','return','snipe','special'],3:['retreat']};
 const CKALL=LC;
 const CK={0:CKALL,1:CKALL,2:CKALL,3:CKALL.slice(0,5),4:['attack','defense','specialattack','specialdefense','speed','accuracy','evasion'],5:['attack','defense','specialattack','specialdefense','speed','accuracy','evasion'],6:CKALL,7:['attack','defense'],8:CKALL.slice(0,5)};
 const KO={retreat:'물러나',dodge:'피해라',endure:'버텨라',return:'바꿔라',snipe:'맞춰라',special:'특수',attack:'공격',defense:'방어',specialattack:'특공',specialdefense:'특방',speed:'스피드',heal:'회복',accuracy:'명중',evasion:'회피'};
 const PRESETS=[['assoc','협회식'],['ten','십계'],['wild','야생'],['jam','방해']];
 const csv=s=>String(s||'').split(',').map(x=>x.trim()).filter(Boolean);
 const lists=()=>((window.OM_DB||{}).const||{}).lists||{};
 const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const short=s=>String(s||'').replace(/^\d+\.\s*/,'').replace(/\s*\(.*\)\s*$/,'');
 function tordOf(tc){tc=+tc||0;if((tc>=3&&tc<=5)||tc===8)return 2;if(tc===6)return 1;if(tc===7)return 3;return 0}
 function styles(t){t=t||{};const tc=t.commandStyle==null?+(t.orderStyle||0):+t.commandStyle;return {tc,tord:t.orderStyle==null?tordOf(tc):+t.orderStyle}}
 /* 지시 랭크 → 세부 계열 (맵툴 rankLv / tcOf) */
 function rankLv(r){const b=String(r||'').replace(/[+\-]/g,'').toUpperCase();const m={E:0,D:0,C:1,B:2,A:3,AA:4,AAA:5,S:6,EX:6};return m.hasOwnProperty(b)?m[b]:1}
 function ordRank(t){const r=((t||{}).ranks||{})['지시'];return String(r==null?'':r).trim()}
 function presetTc(preset,rank){const lv=rankLv(rank);if(preset==='assoc')return lv>=3?2:(lv>=2?1:0);if(preset==='ten')return lv>=4?5:(lv>=3?4:(lv>=2?3:8));if(preset==='wild')return 7;if(preset==='jam')return 6;return NaN}
 function presetName(p){const x=PRESETS.find(q=>q[0]===p);return x?x[1]:''}
 /* 항목별 계열 */
 const sp=k=>{k=String(k==null?'':k);const i=k.indexOf('@');return i<0?[k,0]:[k.slice(0,i),+k.slice(i+1)||0]};
 function coOf(t,n){return (((t||{}).coOrd)||[])[n-1]||null}
 function itemType(t,kind,k){{const [b,n]=sp(k);if(n){const co=coOf(t,n);return co?itemType(co,kind,b):-1}}const st=styles(t);const ot=(t||{}).orderType||{};const v=ot[(kind==='order'?'o_':'c_')+k];return v==null||v===''?(kind==='order'?st.tord:st.tc):+v}
 function nameOf(kind,fam,k){k=sp(k)[0];const keys=kind==='order'?OK[fam]:CK[fam];const i=(keys||[]).indexOf(k);if(i<0)return '';return csv(lists()[(kind==='order'?'list_order_':'list_command_')+fam])[i]||''}
 function orderName(t,key){return nameOf('order',itemType(t,'order',key),key)||key}
 function commandName(t,key){return nameOf('command',itemType(t,'command',key),key)||key}
 /* 쓰는 항목: 그 항목의 계열에 이름이 있는 것 (배틀 지시 입력 · 공개에서 쓴다) */
 function coKeys(t,kind){const out=[];((t||{}).coOrd||[]).forEach((co,i)=>{for(const k of (kind==='order'?co.ok:co.ck)||[])if(nameOf(kind,itemType(co,kind,k),k))out.push(k+'@'+(i+1))});return out}
 function orderKeys(t){return LO.filter(k=>nameOf('order',itemType(t,'order',k),k)).concat(coKeys(t,'order'))}
 function commandKeys(t){return LC.filter(k=>nameOf('command',itemType(t,'command',k),k)).concat(coKeys(t,'command'))}
 /* 키 → 그 몫의 주인 이름 (합친 트레이너 몫이면) */
 function ownerOf(t,k){const n=sp(k)[1];const co=n&&coOf(t,n);return co?String(co.name||''):''}
 /* 『주인의 호령』(tc 7): 능력 · 회복은 횟수를 함께 쓴다 — 같이 깎을 키 (없으면 '') */
 function shareKey(t,k){const [b,n]=sp(k);const st=n?styles(coOf(t,n)||{}):styles(t);if(st.tc!==7)return '';const o=b==='attack'?'defense':b==='defense'?'attack':'';return o?o+(n?'@'+n:''):''}
 function orderNames(t){return orderKeys(t).map(k=>orderName(t,k))}
 function commandNames(t){return commandKeys(t).map(k=>commandName(t,k))}
 function commandStyles(){return csv(lists().list_command)}
 function orderStyles(){return csv(lists().list_order)}
 /* 0 이 되는 항목 (맵툴 zeros) */
 function zeros(tord,tc){let z=[];if(tord===0)z=['special'];if(tord===1)z=['return','special'];if(tord===2)z=['heal'];if(tord===3)z=['dodge','endure','return','snipe','special'];
  if(tord===0&&tc<=1)z.push('snipe','accuracy','evasion');if(tord===0&&tc===2)z.push('snipe');
  if(tord===2&&tc===3)z.push('special','accuracy','evasion');if(tord===2&&tc===4)z.push('special');if(tord===2&&tc===8)z.push('endure','return','snipe','special','accuracy','evasion');return z}
 /* 횟수 채우기 (맵툴 fillKeys): 이름 없는 항목·0 규칙 항목은 0, 나머지 nn. 항목별 예외 계열은 그대로 둔다 */
 function fill(t,nn){const st=styles(t);nn=+nn||0;const z=zeros(st.tord,st.tc);const cnt={};
  for(const k of LO){const nm=nameOf('order',itemType(t,'order',k),k);const ex=itemType(t,'order',k)!==st.tord;cnt['order_'+k]=(!nm||(!ex&&z.includes(k)))?0:nn}
  for(const k of LC){const nm=nameOf('command',itemType(t,'command',k),k);const ex=itemType(t,'command',k)!==st.tc;cnt['command_'+k]=(!nm||(!ex&&z.includes(k)))?0:nn}
  ((t||{}).coOrd||[]).forEach((co,i)=>{const v=co.orderBase==null?nn:+co.orderBase||0;for(const k of co.ok||[])cnt['order_'+k+'@'+(i+1)]=v;for(const k of co.ck||[])cnt['command_'+k+'@'+(i+1)]=v});
  return cnt}
 /* 계열 지정 + 횟수 제작. preset 이 있으면 지시 랭크로 tc 를 고른다. 항목별 예외는 reset 이면 지운다 */
 function make(t,tc,nn,opt){opt=opt||{};tc=+tc||0;const tord=tordOf(tc);const nt=Object.assign({},t,{commandStyle:tc,orderStyle:tord,orderBase:+nn||0});
  if(opt.preset)nt.orderPreset=opt.preset;if(opt.reset||!nt.orderType)nt.orderType={};
  nt.orderCount=fill(nt,nn);return {commandStyle:tc,orderStyle:tord,orderBase:nt.orderBase,orderPreset:nt.orderPreset,orderType:nt.orderType,orderCount:nt.orderCount}}
 function auto(t,preset,nn){preset=preset||t.orderPreset||'assoc';const tc=presetTc(preset,ordRank(t));return make(t,isNaN(tc)?0:tc,nn==null?(t.orderBase||1):nn,{preset,reset:true})}
 /* 지시 랭크가 바뀌었을 때: 자동 종류면 세부 계열을 다시 고르고, 달라졌으면 다시 채운다. 바뀐 게 없으면 null */
 function resync(t){const p=t.orderPreset;if(p!=='assoc'&&p!=='ten')return null;const tc=presetTc(p,ordRank(t));if(isNaN(tc)||tc===styles(t).tc)return null;return make(t,tc,t.orderBase||1,{preset:p,reset:false})}
 /* 항목 하나의 계열 바꾸기: 그 계열에 이름이 있으면 기준 횟수, 없으면 0 */
 function setItemType(t,kind,k,fam){const nt=JSON.parse(JSON.stringify(t));nt.orderType=nt.orderType||{};const st=styles(nt);const def=kind==='order'?st.tord:st.tc;
  if(+fam===def)delete nt.orderType[(kind==='order'?'o_':'c_')+k];else nt.orderType[(kind==='order'?'o_':'c_')+k]=+fam;
  nt.orderCount=nt.orderCount||{};const nm=nameOf(kind,+fam,k);nt.orderCount[(kind==='order'?'order_':'command_')+k]=nm?(nt.orderBase||1):0;return nt}

 /* ----- 공용 패널 (시트 배틀 탭 · 배틀 GM 창). E: 고칠 수 있나. save(nt) 로 저장한다 ----- */
 function panel(t,E){const st=styles(t);const cnt=t.orderCount||{};const rk=ordRank(t);const preset=t.orderPreset||'';const CL=commandStyles(),LORD=orderStyles();
  const presetOpts=PRESETS.map(([p,n])=>{const tc=presetTc(p,rk);return `<option value="${p}" ${preset===p?'selected':''}>${n}${(p==='assoc'||p==='ten')?` (지시 ${esc(rk||'-')} → ${esc(short(CL[tc]||'-'))})`:''}</option>`}).join('');
  const grp=(kind)=>{const keys=kind==='order'?LO:LC;const def=kind==='order'?st.tord:st.tc;const L=kind==='order'?LORD:CL;const z=zeros(st.tord,st.tc);
   const shown=keys.filter(k=>{const f=itemType(t,kind,k);const nm=nameOf(kind,f,k);const c=+cnt[(kind==='order'?'order_':'command_')+k]||0;return E||c>0||(nm&&(f!==def||!z.includes(k)))});
   const exc=keys.filter(k=>itemType(t,kind,k)!==def).length;
   return `<div class="ogrp"><div class="ogh"><span class="gk ${kind==='order'?'':'c'}">${kind==='order'?'ORDER':'COMMAND'}</span><b>${kind==='order'?'명령 (4식)':'지령 (6령)'}</b><span class="small dim">${esc(short(L[def]||''))}</span>${exc?`<span class="exc">예외 ${exc}개</span>`:''}</div>
    <div class="ogrid">${shown.map(k=>{const f=itemType(t,kind,k);const nm=nameOf(kind,f,k);const ck=(kind==='order'?'order_':'command_')+k;const v=+cnt[ck]||0;const ex=f!==def;
     return `<div class="oc2 ${v===0?'zero':''} ${ex?'ex':''}"><div class="nm">${nm?`『${esc(nm)}』`:'<span class="dim">(이 계열엔 없음)</span>'}<small>${KO[k]||k}${ex?' · 예외 계열':''}</small></div>
      ${E?`<select class="mini" data-oo="fam" data-kind="${kind}" data-k="${k}" title="이 항목만 다른 계열로">${L.map((n,i)=>`<option value="${i}" ${f===i?'selected':''}>${esc(short(n))}${nameOf(kind,i,k)?'':' (없음)'}</option>`).join('')}</select><span class="step"><button type="button" data-oo="cnt" data-k="${ck}" data-d="-1">−</button><b>${v}</b><button type="button" data-oo="cnt" data-k="${ck}" data-d="1">+</button></span>`:`<span class="kchip ${ex?'x':''}">${esc(short(L[f]||'-'))}</span><b class="cntv">${v}</b>`}</div>`}).join('')||'<div class="small dim">이 계열에서 쓰는 항목이 없다.</div>'}</div></div>`};
  return `<div class="opanel">
   <div class="row" style="flex-wrap:wrap;gap:8px;align-items:center">
    <label>지령 종류 ${E?`<select data-oo="preset"><option value="">(직접 고름)</option>${presetOpts}</select>`:`<b>${esc(presetName(preset)||'직접')}</b>`}</label>
    <label>지령 계열 ${E?`<select data-oo="tc">${CL.map((n,i)=>`<option value="${i}" ${st.tc===i?'selected':''}>${esc(n)}</option>`).join('')}</select>`:`<b>${esc(CL[st.tc]||'')}</b>`}</label>
    <label>명령 계열 <b>${esc(LORD[st.tord]||'')}</b></label>
    <label>기준 횟수 ${E?`<input type="number" class="n xs" data-oo="base" value="${t.orderBase??Math.max(1,...Object.values(cnt).map(Number).filter(x=>!isNaN(x)))}">`:`<b>${t.orderBase??1}</b>`}</label>
    ${E?`<button class="btn sm" data-oo="fill" title="쓰는 항목을 기준 횟수로 채움 (계열상 쓰지 않는 항목은 0)">기준 횟수로 채우기</button>`:''}
   </div>
   <div class="small dim" style="margin:4px 0 6px">지령 종류를 고르면 지시 랭크(${esc(rk||'-')})에 맞는 계열이 자동으로 정해지고 횟수가 채워진다. 항목마다 계열을 따로 바꿀 수 있다 (예외).</div>
   ${grp('order')}${grp('command')}${coGrp(t,E)}
   ${st.tc===7?'<div class="small dim" style="margin-top:4px">『주인의 호령』 능력 · 회복은 횟수를 함께 쓴다.</div>':''}
  </div>`}
 /* 합친 트레이너 몫 (함께 지시하기) — 횟수만 고친다 */
 function coGrp(t,E){const cnt=t.orderCount||{};return ((t||{}).coOrd||[]).map((co,i)=>{const n=i+1;const row=kind=>((kind==='order'?co.ok:co.ck)||[]).map(k=>{const nm=nameOf(kind,itemType(co,kind,k),k);if(!nm)return '';const ck=(kind==='order'?'order_':'command_')+k+'@'+n;const v=+cnt[ck]||0;
   return `<div class="oc2 ${v===0?'zero':''}"><div class="nm">『${esc(nm)}』<small>${KO[k]||k}</small></div>${E?`<span class="step"><button type="button" data-oo="cnt" data-k="${ck}" data-d="-1">−</button><b>${v}</b><button type="button" data-oo="cnt" data-k="${ck}" data-d="1">+</button></span>`:`<b class="cntv">${v}</b>`}</div>`}).join('');
  const st=styles(co);return `<div class="ogrp co"><div class="ogh"><span class="gk uq">함께</span><b>${esc(co.name||'')} 몫</b><span class="small dim">${esc(short(orderStyles()[st.tord]||''))} · ${esc(short(commandStyles()[st.tc]||''))}</span></div><div class="ogrid">${row('order')}${row('command')}</div></div>`}).join('')}
 /* 함께 지시하기 (10-23 망령): 트레이너 h 에 g 를 합칠 때 4식/6령. mode host=h 것으로 통일 · guest=g 것으로 통일 · both=모두 합치기
    (같은 이름은 횟수를 더하고, h 에 없는 이름은 g 몫(coOrd)으로 붙인다). 돌려줌: h 에 덮어쓸 칸 */
 function merge(h,g,mode){h=h||{};g=g||{};const gc=g.orderCount&&Object.keys(g.orderCount).length?g.orderCount:fill(g,g.orderBase||1);
  const hc=Object.assign({},h.orderCount||{});const co=JSON.parse(JSON.stringify(h.coOrd||[]));
  const keep=()=>{const o={};for(const k in hc)if(k.includes('@'))o[k]=hc[k];return o};
  if(mode==='guest')return {commandStyle:styles(g).tc,orderStyle:styles(g).tord,orderBase:g.orderBase==null?1:g.orderBase,orderPreset:g.orderPreset||'',orderType:JSON.parse(JSON.stringify(g.orderType||{})),orderCount:Object.assign({},gc,keep()),coOrd:co};
  if(mode!=='both')return {orderCount:hc,coOrd:co};
  const ent={name:String(g.name||''),ranks:g.ranks||{},commandStyle:styles(g).tc,orderStyle:styles(g).tord,orderType:JSON.parse(JSON.stringify(g.orderType||{})),orderBase:g.orderBase==null?1:g.orderBase,ok:[],ck:[]};const n=co.length+1;
  for(const kind of ['order','command']){const P=kind==='order'?'order_':'command_';const hk=(kind==='order'?orderKeys:commandKeys)(h);const hn=new Map(hk.map(k=>[nameOf(kind,itemType(h,kind,k),k),k]));
   for(const k of (kind==='order'?orderKeys:commandKeys)(g)){if(k.includes('@'))continue;const nm=nameOf(kind,itemType(g,kind,k),k);const v=+gc[P+k]||0;if(!nm)continue;
    if(hn.has(nm)){const hk2=hn.get(nm);hc[P+hk2]=(+hc[P+hk2]||0)+v}else if(v>0){(kind==='order'?ent.ok:ent.ck).push(k);hc[P+k+'@'+n]=v}}}
  if(ent.ok.length||ent.ck.length)co.push(ent);return {orderCount:hc,coOrd:co}}
 /* 미리 보기: 이름 × 남은 횟수 */
 function chips(t){const cnt=t.orderCount||{};const one=kind=>(kind==='order'?orderKeys:commandKeys)(t).map(k=>{const v=+cnt[(kind==='order'?'order_':'command_')+k]||0;const ow=ownerOf(t,k);return `<span class="mgc ${v?'':'z'} ${ow?'co':''}" title="${esc(ow?ow+' 몫':'')}">${esc(kind==='order'?orderName(t,k):commandName(t,k))}<b>${v}</b></span>`}).join('')||'<span class="small dim">없음</span>';
  return `<div class="mgrow"><span class="gk">ORDER</span><b>명령 (4식)</b></div><div class="mgl">${one('order')}</div><div class="mgrow"><span class="gk c">COMMAND</span><b>지령 (6령)</b></div><div class="mgl">${one('command')}</div>`}
 /* 패널 이벤트: save(nt) 를 부른다 (저장 뒤 다시 그리는 건 부르는 쪽) */
 function bind(root,getT,save){root.querySelectorAll('[data-oo]').forEach(el=>{const op=el.dataset.oo;
  const h=async()=>{const t=getT();let nt;
   if(op==='preset'){const p=el.value;if(!p)return;nt=Object.assign(JSON.parse(JSON.stringify(t)),auto(t,p,base(root,t)))}
   else if(op==='tc'){nt=Object.assign(JSON.parse(JSON.stringify(t)),make(t,el.value,base(root,t),{reset:true}));nt.orderPreset=''}
   else if(op==='base'){nt=JSON.parse(JSON.stringify(t));nt.orderBase=+el.value||0}
   else if(op==='fill'){nt=JSON.parse(JSON.stringify(t));nt.orderBase=base(root,t);nt.orderCount=fill(nt,nt.orderBase)}
   else if(op==='fam'){nt=setItemType(t,el.dataset.kind,el.dataset.k,el.value)}
   else if(op==='cnt'){nt=JSON.parse(JSON.stringify(t));nt.orderCount=nt.orderCount||{};nt.orderCount[el.dataset.k]=Math.max(0,(+nt.orderCount[el.dataset.k]||0)+(+el.dataset.d))}
   if(nt)await save(nt)};
  if(el.tagName==='BUTTON')el.onclick=h;else el.onchange=h})}
 function base(root,t){const i=root.querySelector('[data-oo="base"]');return i?(+i.value||0):(t.orderBase||1)}
 return {merge,chips,sp,coKeys,ownerOf,shareKey,LO,LC,OK,CK,KO,PRESETS,tordOf,styles,rankLv,ordRank,presetTc,presetName,itemType,nameOf,orderKeys,commandKeys,orderNames,commandNames,orderName,commandName,commandStyles,orderStyles,zeros,fill,make,auto,resync,setItemType,panel,bind};
})();
