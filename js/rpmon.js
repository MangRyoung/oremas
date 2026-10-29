/* ---------- RP 포켓몬 상세 (10-29 망령 「무대 바에 상세 버튼 — 배틀 상세처럼 데이터 · 능력 변화 · 대미지 · 효과 출력」) ----------
   배틀에 들어 있는 포켓몬이면 배틀 상세(app.js openMon)를 그대로 연다. 아니면 시트(로스터) 포켓몬을 본다:
   지금 HP 는 sheetHp · 상태는 sheetStates · 랭크는 rank (skill_ui · 휴식과 같은 칸). 내 것이 아니면 도감. */
"use strict";
window.OM_RPMON=(()=>{
 const A=()=>window.OM_APP, S=()=>window.OM_STATS, DB=()=>window.OM_DB||{};
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const $=(s,r)=>(r||document).querySelector(s);
 const RK=[['attack','공격'],['defense','방어'],['specialattack','특공'],['specialdefense','특방'],['speed','스피드'],['accuracy','명중'],['evasion','회피'],['critical','급소']];
 const ST=()=>A().ST;const gm=()=>ST().role==='gm';
 const mons=()=>(ST().state.roster||{}).mons||{};const trs=()=>(ST().state.roster||{}).trainers||{};
 const HP=m=>m.sheetHp==null?m.hp.max:Math.max(0,Math.min(m.hp.max,+m.sheetHp||0));
 const frac=(v,s)=>{s=String(s||'').trim();const f=s.match(/^(\d+)\s*\/\s*(\d+)$/);return f?Math.max(1,Math.floor(v*+f[1]/+f[2])):Math.max(0,Math.floor(+s||0))};
 const sdb=()=>((DB().states||{}).st)||{};const stKo=k=>(sdb()[k]||{}).ko||k;
 async function put(mid,fn){const m0=mons()[mid];if(!m0)return false;const x=JSON.parse(JSON.stringify(m0));fn(x);if(x.sheetStates&&!Object.keys(x.sheetStates).length)delete x.sheetStates;return A().setDiff(['roster','mons',mid],m0,x,1)}
 function open(mid){const m=mons()[mid];if(!m)return;const bm=((ST().state.battle||{}).mons||{})[mid];if(bm)return A().openMon(mid);
  const full=gm()||ST().seat===m.tid;if(!full&&window.OM_DEX_UI)return window.OM_DEX_UI.open(mid,ST().seat||'_view');
  const tr=trs()[m.tid]||{name:''};const K=S().STATS_KO;const cur=HP(m);const pct=cur>0?Math.max(1,Math.round(cur/m.hp.max*100)):0;const ss=m.sheetStates||{};const rk=m.rank||{};
  const SH=window.OM_SHEET_UI||{};const pf=SH.potFmt||(t=>esc(t||''));const pk=SH.potKind||(k=>({no:'',lab:k||''}));const HUE=SH.POT_HUE||{};
  const eff=(kind,name,fb)=>(window.OM_DB_UI&&window.OM_DB_UI.effectHtml(kind,name))||`<span class="small dim">${esc(fb||'')}</span>`;
  const an=(kind,name,txt)=>name&&name!=='-'?` <button class="btn xs ghost anb" data-an="${esc(kind)}" data-ann="${esc(name)}" data-ant="${esc(String(txt||'').slice(0,600))}" title="로그에 출력">📢 출력</button>`:'';
  const potCard=(p,kind)=>{const k=pk(kind||p.kind);const hue=kind==='전용'?'#ffd84a':(HUE[k.lab]||'#3fc7c0');return `<div class="potc${p.ph?' ph':''}${kind==='전용'?' ex':''}" style="--ph:${hue}"><div class="poth"><span class="potk">${k.no?`<em>${esc(k.no)}</em>`:''}${k.lab?`<span>${esc(k.lab)}</span>`:''}</span><b class="potn">${esc(p.name)}</b><span class="sp"></span>${p.ph?'':an(kind==='전용'?'전용 포텐셜':'포텐셜',p.name,p.eff)}</div>${p.ph?'':`<div class="pote">${pf(String(p.eff||'').replace(/<br\s*\/?>/gi,'\n'))}</div>`}</div>`};
  const tcol=en=>{try{return S().typeColor(en).bg}catch(e){return '#666'}};
  const mvCard=mv=>`<div class="mvc" style="--tc:${tcol(mv.typeEn)}"><div class="mvh">${A().typeChip(mv.typeEn)}<b class="mvn">${esc(mv.name)}</b><span class="sp"></span><span class="mvcat c-${({물리:'p',특수:'s',변화:'x'})[mv.cat]||'x'}">${esc(mv.cat||'-')}</span>${an('기술',mv.name,mv.eff)}</div><div class="mvs"><span><small>위력</small><b>${mv.pow||'-'}</b></span><span><small>명중</small><b>${mv.acc||'필중'}</b></span><span><small>범위</small><b>${esc(mv.range||'-')}</b></span></div>${mv.eff?`<div class="mve">${pf(mv.eff)}</div>`:''}</div>`;
  const K2=window.OM_SKILL_UI;const comp=K2?(K2.tsk(m.tid).comp||[]).includes(mid):false;
  const md=A().openModal(`<div class="mhead"><h2>${esc(m.name)} <span class="small muted">상세 · 배틀 밖</span></h2><span class="sp"></span>${K2&&K2.setComp?`<button class="btn sm ${comp?'pri':''}" id="rmComp" title="스킬 체크에 함께 굴리는 동행">${comp?'동행 ✓':'동행으로'}</button>`:''}<button class="btn ghost" data-x>닫기</button></div>
   <div class="dxhead"><div class="dxpic" style="${m.image?`background-image:url('${cssu(m.image)}')`:''}"></div>
    <div class="dxinfo"><div class="dxname">${esc(m.name)}<span class="lv">Lv.${m.lv}</span><span class="small muted">${esc(tr.name)}</span><span class="row" style="gap:4px;display:inline-flex">${(m.types||[]).filter(t=>t&&t!=='-').map(A().typeChip).join('')}</span>${m.pride?`<span class="badge">프라이드 ${esc(m.pride)}</span>`:''}</div>
     <div class="dxhp"><div class="hpbar ${pct<=25?'low':pct<=50?'mid':''}"><i style="width:${pct}%"></i></div><span class="mono">${cur} / ${m.hp.max}</span></div>
     <div class="dxrow"><span class="k">특성</span><span><b>${esc(m.ability||'-')}</b>${an('특성',m.ability,m.abilityEff)}<div class="dbmini">${eff('trait',m.ability,m.abilityEff)}</div></span></div>
     <div class="dxrow"><span class="k">소지품</span><span><b>${esc(m.item||'-')}</b>${an('소지품',m.item,m.itemEff)}<div class="dbmini">${eff('item',m.item,m.itemEff)}</div></span></div></div></div>
   <div class="dxlow"><div class="dxabil"><div class="k">능력</div><div class="dxst wide">${(m.ranks||[]).map((r,i)=>`<div><small>${K[i]}</small><b>${esc(r)}</b><em>${(m.base||[])[i]} · ${(m.stats||[])[i]}</em></div>`).join('')}</div></div>
    <div class="dxnowc"><div class="k">랭크 변화 <button class="btn xs ghost" id="rmRk0">전부 0</button></div><div class="prk">${RK.map(([k,n])=>{const v=+rk[k]||0;return `<div class="prki ${v>0?'up':v<0?'dn':''}"><small>${n}</small><span data-rk="${k}" data-dv="-1">−</span><b>${v>0?'+':''}${v}</b><span data-rk="${k}" data-dv="1">＋</span></div>`}).join('')}</div>
     <div class="k" style="margin-top:6px">상태</div><div class="row" style="gap:4px;flex-wrap:wrap">${Object.keys(ss).filter(k=>ss[k]).map(k=>`<span class="chip on" data-stx="${esc(k)}" title="눌러서 풀기">${esc(stKo(k))}${+ss[k]<1000?' '+ss[k]:''} ✕</span>`).join('')||'<span class="small dim">없음</span>'}<select id="rmSt"><option value="">상태 더하기…</option>${Object.keys(sdb()).filter(k=>k!=='Dead').map(k=>`<option value="${esc(k)}">${esc(stKo(k))}</option>`).join('')}</select></div></div></div>
   <div class="hpq"><span class="k">HP 조작</span><input type="text" id="rmHp" placeholder="숫자 · 1/8"><button class="btn sm hpdmg" id="rmDmg">대미지</button><button class="btn sm hpheal" id="rmHeal">회복</button><button class="btn sm ghost hpheal2" id="rmFull">전부 회복</button>
    <span class="qs">${['1/16','1/8','1/4','1/3','1/2'].map(f=>`<button class="btn xs" data-hpf="${f}">−${f}</button>`).join('')}</span><span class="qs qh">${['1/16','1/8','1/4','1/3','1/2'].map(f=>`<button class="btn xs" data-hph="${f}">+${f}</button>`).join('')}</span></div>
   <div class="sec">기술 <span class="note">${(m.moves||[]).length}개</span></div><div class="smvg dxmvg">${(m.moves||[]).filter(x=>!x.hide||full).map(mvCard).join('')}</div>
   ${(m.pots||[]).filter(p=>p&&p.name).length?`<div class="sec">포텐셜</div><div class="dxpots dxpc">${m.pots.filter(p=>p&&p.name).map(p=>potCard(p)).join('')}</div>`:''}
   ${m.excl||(m.exclX||[]).length?`<div class="sec">전용 포텐셜</div><div class="dxpots dxpc">${[...(m.excl?[m.excl]:[]),...(m.exclX||[])].map(p=>potCard(p,'전용')).join('')}</div>`:''}`);
  md.classList.add('wide');const re=()=>{A().closeModal();open(mid)};
  const hpTo=async(to,why)=>{const m1=mons()[mid];const was=HP(m1);to=Math.max(0,Math.min(m1.hp.max,to));if(to===was)return;await put(mid,x=>{x.sheetHp=to});const dl=to-was;A().sysLog(`【${dl<0?'피해':'회복'}】 ${m1.name} ${dl<0?'−':'+'}${Math.abs(dl)}  ·  HP ${was} → ${to}/${m1.hp.max}${why?'\n'+why:''}${to<=0?`\n${m1.name}은(는) 쓰러졌다!`:''}`,'battle',{mid,img:m1.image||''});re()};
  const amt=()=>frac(m.hp.max,$('#rmHp',md).value);
  $('#rmDmg',md).onclick=()=>{const d=amt();if(d)hpTo(HP(m)-d,`${d} 대미지`)};$('#rmHeal',md).onclick=()=>{const d=amt();if(d)hpTo(HP(m)+d,`${d} 회복`)};$('#rmFull',md).onclick=()=>hpTo(m.hp.max,'전부 회복');
  md.querySelectorAll('[data-hpf]').forEach(b=>b.onclick=()=>hpTo(HP(m)-frac(m.hp.max,b.dataset.hpf),`비례 대미지 ${b.dataset.hpf}`));
  md.querySelectorAll('[data-hph]').forEach(b=>b.onclick=()=>hpTo(HP(m)+frac(m.hp.max,b.dataset.hph),`비례 회복 ${b.dataset.hph}`));
  md.querySelectorAll('[data-rk]').forEach(b=>b.onclick=async()=>{const k=b.dataset.rk,dv=+b.dataset.dv;let to=0;await put(mid,x=>{x.rank=x.rank||{};to=x.rank[k]=Math.max(-6,Math.min(6,(+x.rank[k]||0)+dv))});A().sysLog(`${m.name} ${(RK.find(r=>r[0]===k)||[k,k])[1]} ${dv>0?'↑':'↓'} (지금 ${to>0?'+':''}${to})`,'battle',{});re()});
  $('#rmRk0',md).onclick=async()=>{await put(mid,x=>{x.rank={}});A().sysLog(`${m.name} 랭크 변화를 모두 되돌렸다`,'battle',{});re()};
  md.querySelectorAll('[data-stx]').forEach(b=>b.onclick=async()=>{const k=b.dataset.stx;await put(mid,x=>{x.sheetStates=x.sheetStates||{};delete x.sheetStates[k]});A().sysLog(`${m.name} 「${stKo(k)}」 풀림`,'battle',{});re()});
  $('#rmSt',md).onchange=async e=>{const k=e.target.value;if(!k)return;const d=sdb()[k]||{};await put(mid,x=>{x.sheetStates=x.sheetStates||{};x.sheetStates[k]=d.min>=1000||!d.min?1000:+d.min});A().sysLog(`${m.name} 「${stKo(k)}」`,'battle',{});re()};
  md.querySelectorAll('[data-an]').forEach(b=>b.onclick=()=>{A().sysLog(`【${b.dataset.an}】 ${m.name} 『${b.dataset.ann}』${b.dataset.ant?'\n'+String(b.dataset.ant).replace(/<br\s*\/?>/gi,'\n'):''}`,'battle',{mid,img:m.image||''});b.textContent='📢 출력됨';b.disabled=true});
  {const c=$('#rmComp',md);if(c)c.onclick=async()=>{await K2.setComp(m.tid,mid);re()}}}
 return {open};
})();
