/* ---------- 포켓몬 도감 · 데이터 해석 (맵툴 dex_run / print_pokedex / 해석 차단을 옮김) ----------
   『포켓몬 도감』【N/시】【사전】: 지시 랭크로 횟수(B 1 · A 이상 2). 상대 포켓몬 1체를 해석하면 타입·종족치·기술·특성·포텐셜이 보인다.
   부분 해석: 기술 / 타입 / 특성 중 고른 것만 (세 부분이 모이면 전체). 「데이터 해석」(포텐셜 효과)은 횟수 없이·차단 돌파.
   차단(mon.dexFw, GM 이 랭크·상태 창에서): 0 없음 · 1 다음 해석 1회 차단 뒤 자동 해제 · 2 완전 차단(강제 해석만 통함) · 3 일부 차단(허용 부분만) · 4 노이즈(해석은 되지만 글자가 ■ 로 으깨짐).
   상태: state.dex[tid] = {used, list:[mid], part:{mid:[move|type|trait]}, fwSeen:[mid]} */
"use strict";
window.OM_DEX_UI=(()=>{
 const A=()=>window.OM_APP, S=()=>window.OM_STATS, B=()=>window.OM_BATTLE, DB=()=>window.OM_DB||{};
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const $=(s,r)=>(r||document).querySelector(s);
 const PARTS=[['move','기술'],['type','타입'],['trait','특성']];
 const FWN={0:'없음',1:'1회 차단',2:'완전 차단',3:'일부 차단',4:'노이즈 차단'};
 const TYPES=['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];
 const gm=()=>A().ST.role==='gm';const me=()=>A().ST.seat;
 const dx=tid=>Object.assign({used:0,list:[],part:{},fwSeen:[]},((A().ST.state.dex||{})[tid])||{});
 const maxOf=t=>{const L=((DB().const||{}).lists||{}).list_pokedex_count||{E:0,D:0,C:0,B:1,A:2,AA:2,AAA:2,S:2};return +(L[S().strip(((t||{}).ranks||{})['지시']||'')]||0)};
 const monOf=mid=>((A().ST.state.battle||{}).mons||{})[mid]||((A().ST.state.roster||{}).mons||{})[mid];
 const trOf=tid=>((A().ST.state.battle||{}).trainers||{})[tid]||((A().ST.state.roster||{}).trainers||{})[tid]||{};
 /* 보는 사람 기준 공개 범위: 'all' | ['move','type'] | [] */
 function scope(mid,viewer,asPl){const m=monOf(mid);if(!m)return [];if((gm()&&!asPl)||m.tid===viewer)return 'all';const mt=trOf(viewer);if(mt.side&&m.side&&mt.side===m.side)return 'all';const d=dx(viewer);if(d.list.includes(mid))return 'all';return d.part[mid]||[]}
 /* 노이즈: 같은 글에 늘 같은 자리 (이름을 씨앗으로) */
 function noise(text,key){let seed=7;for(const ch of String(key))seed=(seed*31+ch.charCodeAt(0))%2147483647;const rnd=()=>{seed=(seed*48271)%2147483647;return seed/2147483647};const NZ=['■','■','▓','▒','█'];return String(text).split('').map(ch=>/\s/.test(ch)?ch:(rnd()<.35?NZ[Math.floor(rnd()*NZ.length)]:ch)).join('')}
 /* asPl: PL 권한(공평 모드)의 GM 이 자기 트레이너(viewer) 눈으로 본다 — GM 이라고 다 보이지 않는다 */
 function open(mid,viewer,asPl){viewer=viewer||me();const m=monOf(mid);if(!m)return;const G=gm()&&!asPl;const sc=scope(mid,viewer,asPl);const full=sc==='all';const has=p=>full||sc.includes(p);const nz=!full&&false||(m.dexFw===4&&!(G||m.tid===viewer));const N=s=>nz?noise(s,m.name):s;
  const vt=trOf(viewer);const d=dx(viewer);const left=Math.max(0,maxOf(vt)-d.used);const isEnemy=!G&&m.tid!==viewer&&(!vt.side||!m.side||vt.side!==m.side);
  const PH='<div class="dexph">■■■ 미해석 ■■■</div>';const PHs='<span class="dexph sm">■■■</span>';
  const typeRow=()=>has('type')?`<span class="row" style="gap:4px;display:inline-flex">${(m.types||[]).filter(t=>t&&t!=='-').map(t=>A().typeChip(t)).join('')}${m.teraActive?`<span class="rk up">테라 ${esc(m.tera)}</span>`:''}</span>`:PHs;
  const weaks=()=>{if(!has('type'))return PH;const rows=TYPES.map(t=>{const e=B().effectiveness([t],m,{});return [t,e&&typeof e==='object'?+e.value:+e]}).filter(x=>x[1]!==1);
   const G=[[4,'×4','w4'],[2,'×2','w2'],[0.5,'×½','r2'],[0.25,'×¼','r4'],[0,'×0','r0']].map(([v,l,c])=>{const ch=rows.filter(x=>x[1]===v).map(x=>A().typeChip(x[0])).join('');return ch?`<div class="dxw ${c}"><i>${l}</i>${ch}</div>`:''}).join('');
   return `<div class="dxweak">${G||'<span class="dim small">약점·내성 없음</span>'}</div>`};
  const KO=['HP','공격','방어','특공','특방','스피드'];
  const stats=()=>full?`<div class="dxst">${(m.ranks||[]).map((r,i)=>`<div><small>${KO[i]}</small><b>${esc(N(r))}</b></div>`).join('')}</div>`:PH;
  const moves=()=>has('move')?`<table class="t small dxmv"><tr><th>기술</th><th>타입</th><th>분류</th><th>위력</th><th>명중</th><th>효과</th></tr>${(m.moves||[]).filter(mv=>!mv.hide||G||m.tid===viewer).map(mv=>`<tr><td class="nw"><b>${esc(N(mv.name))}</b>${mv.hide?' <span class="small dim" title="한 장 요약 · 남의 도감에 안 나온다">숨김</span>':''}</td><td class="nw">${mv.typeEn?A().typeChip(mv.typeEn):esc(mv.type||'')}</td><td class="nw">${esc(mv.cat||'')}</td><td class="mono">${esc(mv.pow||'-')}</td><td class="mono">${esc(mv.acc||'-')}</td><td class="small eff">${esc(N(mv.eff||''))}</td></tr>`).join('')}</table>`:PH;
  const abE=(()=>{const a=m.abilityOrig!=null?(DB().traits||{})[m.ability]:null;return a?String(a.multi||a.single||'').replace(/<br\s*\/?>/gi,'\n'):(m.abilityEff||'')})();   /* 바뀐 특성은 DB 글 (예전에 바뀐 채 글이 남은 배틀도) */
  const trait=()=>has('trait')?`<b>${esc(N(m.ability||'-'))}</b> <span class="small dim">${esc(N(abE))}</span>`:PHs;
  const own=G||m.tid===viewer;   /* 전용 포텐셜은 주인과 GM 만 — 해석해도 안 보인다 */
  const pots=()=>{if(!full)return PH;const L=[...(m.pots||[]).filter(p=>p&&p.name&&!p.ph),...(own&&m.excl?[Object.assign({kind:'전용'},m.excl)]:[]),...(own?(m.exclX||[]):[]).map(x=>Object.assign({kind:'전용'},x))];
   return `<div class="dxpots">${L.map(p=>`<div class="dxp"><div class="pn"><b>${esc(N(p.name))}</b>${p.kind?`<small>${esc(p.kind)}</small>`:''}</div><div class="pe">${esc(N(p.eff||''))}</div></div>`).join('')||'<div class="dim small">없음</div>'}</div>`};
  const shown=!!(m.seen||m.entry);const nameOk=full||sc.length||shown;
  const md=A().openModal(`<div class="mhead"><h2>${esc(full?m.name:(has('type')||has('move')||has('trait')||m.seen||m.entry?m.name:'???'))} <span class="small dim">도감 정보</span></h2><span class="sp"></span>${nz?'<span class="tag" style="background:#5a2330">◆ 노이즈 차단 — 데이터 일부가 손상됨</span>':''}${!full&&sc.length?`<span class="tag" style="background:#2b3140;color:#f1c75b">◇ 부분 해석 — ${sc.map(p=>(PARTS.find(x=>x[0]===p)||[])[1]).join('·')}</span>`:''}<button class="btn ghost" data-x>닫기</button></div>
   <div class="dxhead"><div class="dxpic" style="${m.image&&nameOk?`background-image:url('${cssu(m.image)}')`:''}"></div>
    <div class="dxinfo"><div class="dxname">${nameOk?esc(N(m.name)):'<span class="dim">비공개</span>'}<span class="lv">Lv.${esc(m.lv)}</span>${typeRow()}</div>
     <div class="dxrow"><span class="k">특성</span><span>${trait()}</span></div>${full?`<div class="dxrow"><span class="k">소지품</span><span>${esc(m.item||'-')}${m.itemEff?` <span class="small dim">${esc(m.itemEff)}</span>`:''}</span></div>`:''}
     ${full?`<div class="dxrow"><span class="k">종족치</span>${stats()}</div>`:`<div class="dxrow"><span class="k">종족치</span>${PHs}</div>`}
     </div><div class="dxside"><div class="k">상성</div>${weaks()}</div></div>
   <div class="sec">기술 <span class="note">${has('move')?(m.moves||[]).filter(mv=>!mv.hide||G||m.tid===viewer).length+'개':''}</span></div>${moves()}
   <div class="sec">포텐셜</div>${pots()}
   ${isEnemy&&!full?`<div class="card hit"><div class="sec">해석 <span class="note">『포켓몬 도감』 남은 ${left}/${maxOf(vt)} (지시 ${esc((vt.ranks||{})['지시']||'-')})</span></div>
    <div class="row" style="flex-wrap:wrap;gap:8px"><span class="small">부분만:</span>${PARTS.map(([k,n])=>`<label class="small"><input type="checkbox" data-part="${k}"> ${n}</label>`).join('')}<span class="small dim">(아무것도 안 고르면 전체)</span><span class="sp"></span><button class="btn pri" data-dex="run" ${left>0?'':'disabled'}>『포켓몬 도감』 해석</button><button class="btn" data-dex="fx" title="포텐셜·효과로 하는 해석 — 횟수 없이, 차단을 돌파한다 (정직하게)">데이터 해석 (효과)</button></div></div>`:''}
   ${gm()?`<div class="card"><div class="sec">GM · 해석 차단 <span class="note">${FWN[+m.dexFw||0]}</span></div><div class="row" style="flex-wrap:wrap;gap:8px"><select id="dexfw">${Object.keys(FWN).map(k=>`<option value="${k}" ${(+m.dexFw||0)===+k?'selected':''}>${k} · ${FWN[k]}</option>`).join('')}</select><span class="small">일부 차단 허용:</span>${PARTS.map(([k,n])=>`<label class="small"><input type="checkbox" data-fwp="${k}" ${((m.dexFwParts||{})[k])?'checked':''}> ${n}</label>`).join('')}<button class="btn sm" data-dex="fwsave">저장</button><span class="sp"></span><span class="small dim">해석한 트레이너: ${Object.entries(A().ST.state.dex||{}).filter(([t,v])=>(v.list||[]).includes(mid)).map(([t])=>esc(trOf(t).name)).join(', ')||'없음'}</span></div></div>`:''}`);
  md.classList.add('wide');
  md.querySelectorAll('[data-dex]').forEach(b=>b.onclick=async()=>{const k=b.dataset.dex;
   if(k==='fwsave'){const parts={};md.querySelectorAll('[data-fwp]').forEach(c=>{if(c.checked)parts[c.dataset.fwp]=1});await A().set(['battle','mons',mid,'dexFw'],+$('#dexfw',md).value);await A().set(['battle','mons',mid,'dexFwParts'],parts);A().toast('저장했다');return}
   const parts=[...md.querySelectorAll('[data-part]:checked')].map(c=>c.dataset.part);A().closeModal();await analyze(viewer,mid,{parts,forced:k==='fx',free:k==='fx'})})}
 /* 해석 실행 (dex_run) */
 async function analyze(viewer,mid,o){o=o||{};const m=monOf(mid);const vt=trOf(viewer);if(!m)return;const d=dx(viewer);const left=maxOf(vt)-d.used;
  if(!o.free&&left<=0)return A().toast('『포켓몬 도감』 남은 횟수가 없다');if(d.list.includes(mid))return A().toast('이미 해석한 포켓몬이다');
  let parts=(o.parts||[]).filter(p=>['move','type','trait'].includes(p));const prev=d.part[mid]||[];const want=parts.length?[...new Set([...prev,...parts])]:['move','type','trait'];
  if(parts.length&&want.length===prev.length)return A().toast('그 부분은 이미 해석했다');
  const fw=+m.dexFw||0;let isOpen=true,why='';
  if(!o.forced){if(fw===1){isOpen=false;why='해석 차단 (1회) — 차단이 풀렸다';await A().set(['battle','mons',mid,'dexFw'],0)}else if(fw===2){isOpen=false;why='완전 차단'}}
  let got=want;if(isOpen&&fw===3&&!o.forced){const allow=m.dexFwParts||{};got=want.filter(p=>allow[p]);if(!got.length){isOpen=false;why='일부 차단 — 허용된 부분이 없다'}else if(got.length<want.length)why='일부 차단 — '+got.map(p=>(PARTS.find(x=>x[0]===p)||[])[1]).join('·')+'만';}
  if(!o.free){d.used=(+d.used||0)+1}
  if(isOpen){const fullNow=got.length===3||(!parts.length&&got.length===3);if(fullNow){if(!d.list.includes(mid))d.list.push(mid);delete d.part[mid]}else d.part[mid]=got}
  else if(!d.fwSeen.includes(mid))d.fwSeen.push(mid);
  await A().set(['dex',viewer],d);
  const tag=`${o.free?'【강제】':`【${Math.max(0,maxOf(vt)-d.used)}/시】【사전】`}${parts.length?'【'+parts.map(p=>(PARTS.find(x=>x[0]===p)||[])[1]).join('·')+'】':''}`;
  A().sysLog(`${o.free?'「데이터 해석」':'『포켓몬 도감』'} ${tag} ${vt.name} → ${isOpen&&(got.length===3)?m.name:'???'}: ${isOpen?'해석 성공!'+(why?' ('+why+')':''):'차단됨 ('+why+')'}`,'battle');
  try{if(window.OM_RP_UI)window.OM_RP_UI.playSe(isOpen?'Ping':'evasion',true)}catch(e){}
  if(isOpen)setTimeout(()=>open(mid,viewer),200)}
 /* 해석 관리 (내 도감) */
 function openMgr(viewer){viewer=viewer||me();if(gm()&&!viewer)return A().toast('GM 은 포켓몬 카드의 「도감」에서 본다');const vt=trOf(viewer);const d=dx(viewer);const b=A().ST.state.battle||{};const enemies=Object.values(b.mons||{}).filter(m=>m.tid!==viewer&&m.side&&m.side!==(vt.side||'')&&(m.seen||m.entry));
  const md=A().openModal(`<div class="mhead"><h2>해석 관리 · ${esc(vt.name||'')}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="row small"><span>『포켓몬 도감』 남은 <b>${Math.max(0,maxOf(vt)-d.used)}</b>/${maxOf(vt)} (지시 ${esc((vt.ranks||{})['지시']||'-')})</span>${gm()?`<span class="sp"></span><button class="btn xs" data-dm="minus">−1</button><button class="btn xs" data-dm="plus">+1</button>`:''}</div>
   <div class="sec">해석 이력 <span class="note">${d.list.length}마리 · 누르면 도감</span></div><div class="row" style="flex-wrap:wrap;gap:4px">${d.list.map(mid=>`<button class="btn xs" data-dm="open" data-mid="${mid}">${esc((monOf(mid)||{}).name||mid)}</button>`).join('')}${Object.keys(d.part).map(mid=>`<button class="btn xs ghost" data-dm="open" data-mid="${mid}">${esc((monOf(mid)||{}).name||'???')} (부분)</button>`).join('')}${!d.list.length&&!Object.keys(d.part).length?'<span class="dim small">아직 없다</span>':''}</div>
   <div class="sec">해석 대상 <span class="note">상대 필드·본 포켓몬</span></div><div class="firelist">${enemies.map(m=>{const sc=scope(m.id,viewer);const full=sc==='all';return `<div class="firerow"><b>${esc(full||sc.length||m.seen?m.name:'비공개')}</b>${full?'<span class="tag on">해석 완료</span>':sc.length?`<span class="tag">부분 ${sc.map(p=>(PARTS.find(x=>x[0]===p)||[])[1]).join('·')}</span>`:''}${d.fwSeen.includes(m.id)?'<span class="tag" style="background:#5a2330">차단됨</span>':''}<span class="sp"></span><button class="btn xs" data-dm="open" data-mid="${m.id}">${full?'도감 열기':'도감 · 해석'}</button></div>`}).join('')||'<div class="small dim">배틀에 상대가 없다</div>'}</div>`);
  md.querySelectorAll('[data-dm]').forEach(b=>b.onclick=async()=>{const k=b.dataset.dm;if(k==='open'){A().closeModal();return open(b.dataset.mid,viewer)}if(k==='minus'||k==='plus'){d.used=Math.max(0,(+d.used||0)+(k==='minus'?1:-1));await A().set(['dex',viewer],d);A().closeModal();openMgr(viewer)}})}
 return {open,openMgr,analyze,scope};
})();
