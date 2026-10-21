/* ---------- 바꾸기 창 모음 (망령 10-21): 타입 = 18 타입 단추 · 종족치 = 랭크 한 단계 ▲▼ 또는 수치 입력 · 폼체인지 편집 ----------
   배틀 상세 창(app.js openMon)과 오레마스 시트(sheet_ui)가 같이 쓴다. 특성 · 소지품은 DB 창(OM_DB_UI.open)을 그대로.
   저장은 부르는 쪽이 한다 — 여기서는 고른 값만 돌려준다. */
"use strict";
window.OM_PICK=(()=>{
 const A=()=>window.OM_APP, S=()=>window.OM_STATS, DB=()=>window.OM_DB||{}, DBS=()=>window.OM_STORE;
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const $=(s,r)=>(r||document).querySelector(s);
 const TYPES=['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];
 const ko=en=>en&&en!=='-'?S().typeKo(en):'-';
 const col=en=>{try{return S().typeColor(en)}catch(e){return {bg:'#444',fg:'#fff'}}};

 /* 타입: cur = 영문 3칸, opt = {title, max(3), orig(원래 타입 — 「원래대로」), note}. done(영문 3칸, '-' 채움) */
 function types(cur,opt,done){opt=opt||{};const max=opt.max||3;let pick=(cur||[]).filter(t=>t&&t!=='-').slice(0,max);
  const md=A().openModal(`<div class="mhead"><h2>${esc(opt.title||'타입 변경')}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   ${opt.note?`<div class="small dim" style="margin-bottom:8px">${esc(opt.note)}</div>`:''}
   <div class="pkt-now" id="pk_now"></div>
   <div class="pkt-grid">${TYPES.map(t=>{const c=col(t);return `<button type="button" class="pkt" data-t="${t}" style="--tb:${esc(c.bg)};--tf:${esc(c.fg)}"><span>${esc(ko(t))}</span><i></i></button>`}).join('')}</div>
   <div class="small dim" style="margin-top:6px">누른 순서대로 타입 1 · 2${max>2?' · 3':''} — 다시 누르면 빠진다 (최대 ${max}개)</div>
   <div class="row" style="margin-top:12px">${opt.orig?`<button class="btn sm ghost" id="pk_orig">원래대로 (${esc(opt.orig.filter(t=>t&&t!=='-').map(ko).join('/')||'없음')})</button>`:''}<button class="btn sm ghost" id="pk_clr">비우기</button><span class="sp"></span><button class="btn pri" id="pk_ok">적용</button></div>`);
  md.classList.add('pkmodal');
  const draw=()=>{md.querySelectorAll('.pkt').forEach(b=>{const i=pick.indexOf(b.dataset.t);b.classList.toggle('on',i>=0);b.querySelector('i').textContent=i>=0?String(i+1):''});
   $('#pk_now',md).innerHTML=pick.length?pick.map(t=>{const c=col(t);return `<span class="type" style="background:${esc(c.bg)};color:${esc(c.fg)}">${esc(ko(t))}</span>`}).join(''):'<span class="small dim">타입 없음</span>'};
  md.querySelectorAll('.pkt').forEach(b=>b.onclick=()=>{const t=b.dataset.t;const i=pick.indexOf(t);if(i>=0)pick.splice(i,1);else{if(pick.length>=max)pick.shift();pick.push(t)}draw()});
  const o=$('#pk_orig',md);if(o)o.onclick=()=>{pick=opt.orig.filter(t=>t&&t!=='-');draw()};
  $('#pk_clr',md).onclick=()=>{pick=[];draw()};
  $('#pk_ok',md).onclick=async()=>{if(!pick.length&&!confirm('타입을 모두 비울까?'))return;const out=[...pick,'-','-','-'].slice(0,3);A().closeModal();await done(out)};draw()}

 /* 종족치: 랭크 표(DB.maker.grade = [[하한, 이름] …])로 한 단계씩. cur = 6칸, opt = {title, iv, ev, lv, note}. done(새 6칸) */
 const G=()=>((DB().maker||{}).grade||[]).map(([lo,n])=>[+lo,n]).filter(x=>!isNaN(x[0])).sort((a,b)=>a[0]-b[0]);
 const gi=v=>{const g=G();let k=-1;for(let i=0;i<g.length;i++)if(v>=g[i][0])k=i;return k};
 function step(v,d){const g=G();if(!g.length)return Math.max(1,v+d*10);const k=gi(v);const n=Math.max(0,Math.min(g.length-1,k+d));if(n===k)return v;return Math.max(1,g[n][0])}
 function base(cur,opt,done){opt=opt||{};const K=S().STATS_KO;let b=(cur||[]).map(v=>+v||0);const b0=b.slice();
  const md=A().openModal(`<div class="mhead"><h2>${esc(opt.title||'종족치 변경')}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   ${opt.note?`<div class="small dim" style="margin-bottom:8px">${esc(opt.note)}</div>`:''}
   <div class="pkb">${K.map((k,i)=>`<div class="pkbs" data-i="${i}"><small>${esc(k)}</small><b class="pkg"></b><div class="pkbr"><button type="button" class="btn sm" data-d="-1" title="랭크 한 단계 낮추기">▼</button><input type="number" class="n" min="1" max="255" data-v value=""><button type="button" class="btn sm" data-d="1" title="랭크 한 단계 올리기">▲</button></div><em class="pkst"></em></div>`).join('')}</div>
   <div class="row small" style="margin-top:8px"><span>합 <b class="mono" id="pk_sum"></b> <span class="dim" id="pk_sum0"></span></span><span class="sp"></span><button class="btn sm ghost" id="pk_rs">처음 값</button><button class="btn pri" id="pk_ok">적용</button></div>`);
  md.classList.add('pkmodal');
  const draw=()=>{md.querySelectorAll('.pkbs').forEach(el=>{const i=+el.dataset.i;const v=b[i];el.querySelector('.pkg').textContent=S().gradeOf(v);const inp=el.querySelector('[data-v]');if(document.activeElement!==inp)inp.value=v;el.classList.toggle('chg',v!==b0[i]);
    let st='';if(opt.lv){try{st='실수치 '+S().statsOf(b,opt.iv||[0,0,0,0,0,0],opt.ev||[0,0,0,0,0,0],opt.lv)[i]}catch(e){}}el.querySelector('.pkst').textContent=(v!==b0[i]?b0[i]+' → '+v+(st?' · ':''):'')+st});
   const s=b.reduce((a,x)=>a+x,0),s0=b0.reduce((a,x)=>a+x,0);$('#pk_sum',md).textContent=s;$('#pk_sum0',md).textContent=s!==s0?'(처음 '+s0+')':''};
  md.querySelectorAll('.pkbs').forEach(el=>{const i=+el.dataset.i;el.querySelectorAll('[data-d]').forEach(bt=>bt.onclick=()=>{b[i]=step(b[i],+bt.dataset.d);draw()});
   const inp=el.querySelector('[data-v]');inp.oninput=()=>{b[i]=Math.max(1,Math.min(255,+inp.value||0));draw()};inp.onblur=()=>draw()});
  $('#pk_rs',md).onclick=()=>{b=b0.slice();draw()};
  $('#pk_ok',md).onclick=async()=>{A().closeModal();await done(b.map(v=>Math.max(1,v)))};draw()}

 /* 폼체인지 · 메가진화 편집 (제작기 formsHtml 과 같은 칸). m = 시트 포켓몬, f = 고칠 폼(없으면 새로). done(폼) */
 const FORM_KINDS=['폼체인지','메가진화','원시회귀','기타'];
 /* 창이 하나뿐이라 타입 · 특성 · 종족치 창을 다녀오면 적던 값(st)으로 다시 연다 */
 function form(m,f0,done,st){const isNew=!f0;const o=m.form0||m;const f=f0?JSON.parse(JSON.stringify(f0)):{name:'',kind:'폼체인지',typesKo:null,types:null,ability:'',abilityEff:null,base:(o.base||[]).slice(),image:'',cond:'',revert:true,pots:[]};
  st=st||{n:f.name,k:f.kind,c:f.cond||'',r:!!f.revert,i:f.image||'',ty:f.types?f.types.filter(t=>t&&t!=='-'):null,ab:f.ability||'',bs:(f.base||o.base||[]).map(v=>+v||0),pots:(f.pots||[]).map(x=>Object.assign({},x))};
  let {ty,ab,bs,pots}=st;
  const slotName=s=>{const p=(o.pots||[]).find(x=>x.slot===s);return p?p.name:''};
  const md=A().openModal(`<div class="mhead"><h2>${isNew?'폼 추가':'폼 수정'}</h2><span class="small dim">${esc(o.name||'')}</span><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="stform">
    <label>폼 이름<input type="text" id="fm_n" value="${esc(st.n)}" placeholder="예) 메가 리자몽 X"></label>
    <label>종류<select id="fm_k">${FORM_KINDS.map(k=>`<option ${st.k===k?'selected':''}>${k}</option>`).join('')}</select></label>
    <label class="wide">발동 조건<input type="text" id="fm_c" value="${esc(st.c)}" placeholder="예) 「메가스톤」을 지니고 있을 때 · 1/배틀"></label>
    <label class="chk"><span><input type="checkbox" id="fm_r" ${st.r?'checked':''}> 교대하면 원래 모습으로</span></label>
   </div>
   <div class="fmed">
    <div class="fmrow2"><span class="k">타입</span><span id="fm_ty"></span><button class="btn xs" id="fm_tyb">타입 변경</button><button class="btn xs ghost" id="fm_ty0">원래대로</button></div>
    <div class="fmrow2"><span class="k">특성</span><b id="fm_ab"></b><button class="btn xs" id="fm_abb">특성 변경</button><button class="btn xs ghost" id="fm_ab0">원래대로</button></div>
    <div class="fmrow2"><span class="k">종족치</span><span id="fm_bs" class="mono"></span><button class="btn xs" id="fm_bsb">종족치 변경</button></div>
    <div class="fmrow2"><span class="k">그림</span><input type="text" id="fm_i" value="${esc(st.i)}" placeholder="비우면 원래 그림 · https://…" style="flex:1;min-width:0"><label class="btn xs ghost">올리기<input type="file" id="fm_f" accept="image/*" hidden style="display:none"></label></div>
    <div class="fmrow2 top"><span class="k">포텐셜 교체</span><div id="fm_p" style="flex:1;min-width:0"></div></div>
   </div>
   <div class="row" style="margin-top:10px"><span class="small dim">이 폼일 때만 바뀌는 것만 — 비운 칸은 원래 모습 그대로</span><span class="sp"></span><button class="btn pri" id="fm_ok">${isNew?'추가':'저장'}</button></div>`);
  md.classList.add('pkmodal');
  const chips=a=>a.map(t=>{const c=col(t);return `<span class="type" style="background:${esc(c.bg)};color:${esc(c.fg)}">${esc(ko(t))}</span>`}).join('');
  const draw=()=>{$('#fm_ty',md).innerHTML=ty?chips(ty):`<span class="dim small">원래대로 (${chips((o.types||[]).filter(t=>t&&t!=='-'))})</span>`;
   $('#fm_ab',md).innerHTML=ab?esc(ab):`<span class="dim small">원래대로 (${esc(o.ability||'없음')})</span>`;
   $('#fm_bs',md).textContent=S().STATS_KO.map((k,i)=>k+' '+bs[i]).join(' · ');
   $('#fm_p',md).innerHTML=pots.map((x,i)=>`<div class="fmpot2"><select data-ps="${i}">${(o.pots||[]).map(p=>`<option value="${p.slot}" ${p.slot===x.slot?'selected':''}>#${p.slot+1} ${esc(p.name)}</option>`).join('')}<option value="99" ${!(o.pots||[]).some(p=>p.slot===x.slot)?'selected':''}>새 칸</option></select><span class="dim">→</span><input type="text" data-pn="${i}" value="${esc(x.name)}" placeholder="새 포텐셜 이름"><textarea data-pe="${i}" rows="2" placeholder="효과">${esc(x.eff||'')}</textarea><button class="btn xs ghost danger" data-pd="${i}">×</button></div>`).join('')+'<button class="btn xs" id="fm_pa">＋ 교체 칸</button>';
   md.querySelectorAll('[data-ps]').forEach(s=>s.onchange=()=>{pots[+s.dataset.ps].slot=+s.value});
   md.querySelectorAll('[data-pn]').forEach(s=>s.oninput=()=>{pots[+s.dataset.pn].name=s.value});
   md.querySelectorAll('[data-pe]').forEach(s=>s.oninput=()=>{pots[+s.dataset.pe].eff=s.value});
   md.querySelectorAll('[data-pd]').forEach(s=>s.onclick=()=>{pots.splice(+s.dataset.pd,1);draw()});
   $('#fm_pa',md).onclick=()=>{const used=pots.map(x=>x.slot);const free=(o.pots||[]).map(p=>p.slot).find(s=>!used.includes(s));pots.push({slot:free!=null?free:99,name:'',kind:'',eff:''});draw()}};
  /* 하위 창(타입 · 특성 · 종족치)은 이 창 위에 겹쳐 뜬다 */
  const keep=()=>Object.assign(st,{n:$('#fm_n',md).value,k:$('#fm_k',md).value,c:$('#fm_c',md).value,r:$('#fm_r',md).checked,i:$('#fm_i',md).value,ty,ab,bs,pots});
  const back=()=>form(m,f0,done,st);
  $('#fm_tyb',md).onclick=()=>{keep();types(ty||o.types,{title:'폼 타입',max:2},t=>{st.ty=t.filter(x=>x!=='-');if(!st.ty.length)st.ty=null;back()})};
  $('#fm_ty0',md).onclick=()=>{ty=null;draw()};
  $('#fm_abb',md).onclick=()=>{keep();window.OM_DB_UI.open({kind:'trait',sel:ab||o.ability||'',pick:n=>{st.ab=n;back()}})};
  $('#fm_ab0',md).onclick=()=>{ab='';draw()};
  $('#fm_bsb',md).onclick=()=>{keep();base(bs,{title:'폼 종족치',lv:m.lv,iv:m.iv,ev:m.ev},nb=>{st.bs=nb;back()})};
  $('#fm_f',md).onchange=async ev=>{const fl=ev.target.files[0];if(!fl)return;A().toast('올리는 중…');try{$('#fm_i',md).value=await DBS().uploadImage(`rooms/${A().ST.room}/form_${Date.now().toString(36)}`,fl);A().toast('올렸다')}catch(x){A().toast(x.message)}};
  $('#fm_ok',md).onclick=async()=>{const k=keep();if(!k.n.trim())return A().toast('폼 이름을 적어 줘');
   const a=ab?((DB().traits||{})[ab]||{}):null;const P=(DB().maker||{}).pots||[];
   const out={name:k.n.trim(),kind:k.k,typesKo:ty?[...ty.map(ko),'-','-'].slice(0,3):null,types:ty?[...ty,'-','-'].slice(0,3):null,ability:ab,abilityEff:a?String(a.multi||a.single||'').replace(/<br\s*\/?>/gi,'\n'):null,
    base:bs,image:k.i.trim(),cond:k.c.trim(),revert:k.r,pots:pots.filter(x=>x.name.trim()).map(x=>{const row=P.find(r=>r[1]===x.name.trim());return {slot:x.slot,name:x.name.trim().replace(/『|』/g,''),kind:x.kind||(row?row[0]:''),eff:x.eff||(row?String(row[2]||'').replace(/<br\s*\/?>/gi,'\n'):'')}})};
   A().closeModal();await done(out)};
  draw()}
 /* 시트 칸: 폼 목록 (pokeTab) */
 function formsSec(m,ed){const fs=m.forms||[];const o=m;
  return `<div class="spanel"><div class="sh">폼체인지 · 메가진화 <span class="note">배틀 상세의 「폼」 단추로 바뀐다</span><span class="sp"></span>${ed?'<button class="btn sm" data-fma>＋ 폼</button>':''}</div>
   ${fs.length?`<div class="sflist">${fs.map((f,k)=>{const ty=(f.types||o.types||[]).filter(t=>t&&t!=='-');return `<div class="sfrow"><div class="sfpic" ${f.image?`style="background-image:url('${cssu(f.image)}')"`:''}></div><div class="sfbody"><div class="row" style="gap:6px;flex-wrap:wrap"><span class="badge">${esc(f.kind||'폼체인지')}</span><b>${esc(f.name||'(이름 없음)')}</b>${ty.map(t=>{const c=col(t);return `<span class="type" style="background:${esc(c.bg)};color:${esc(c.fg)}">${esc(ko(t))}</span>`}).join('')}${f.revert?'<span class="small dim">교대하면 돌아옴</span>':''}<span class="sp"></span>${ed?`<button class="btn xs ghost" data-fme="${k}">수정</button><button class="btn xs ghost danger" data-fmd="${k}">×</button>`:''}</div>
    <div class="small">특성 ${esc(f.ability||o.ability||'-')}${f.ability?'':' <span class="dim">(그대로)</span>'} · <span class="mono">${(f.base||[]).map((v,i)=>S().STATS_KO[i]+' '+v).join(' ')}</span></div>${(f.pots||[]).length?`<div class="small">포텐셜 ${f.pots.map(x=>{const p=(o.pots||[]).find(q=>q.slot===x.slot);return (p?esc(p.name)+'→':'+')+'「'+esc(x.name)+'」'}).join(' · ')}</div>`:''}${f.cond?`<div class="small" style="color:var(--yel2)">${esc(f.cond)}</div>`:''}</div></div>`}).join('')}</div>`:'<div class="small dim">없음</div>'}</div>`}
 return {types,base,form,formsSec,step};
})();
