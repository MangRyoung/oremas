/* ---------- 스킬 체크 (맵툴 skill_judge / js_skillgm 과 같은 규칙) ----------
   자질 주사위: E·D d4 / C d6 / B d8 / A d10 / AA 이상 d12 (단계 ± 로 한 칸씩). 동행 주사위: 혼자 d4 / 자기 포켓몬 dN / 도움 dN / 이능 dN.
   합계 − 목표: +5 대성공 · 0 성공 · −2 대가를 치르고 성공 · 그 아래 실패. 자질 1 + 동행 1 = 펌블(d8 미만 대실패, 그 위는 실패).
   능숙함: 자질 주사위가 1이면 +1 / 서투름: 1이 아니면 −1. 두 번 굴리기: 높은(낮은) 값. NPC 대항: 상대 주사위 합이 목표. */
"use strict";
window.OM_SKILL_UI=(()=>{
 const A=()=>window.OM_APP, S=()=>window.OM_STATS;
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const $=(s,r)=>(r||document).querySelector(s);
 const SK=[['지시','order'],['육성','bride'],['통솔','leadership'],['능력','power']];
 const DIFF=[[5,'쉬움'],[7,'보통'],[9,'어려움'],[11,'매우 어려움']];
 const NPC=[[0,'없음'],[1,'일반인 d4+d4',[4,4]],[2,'일반 트레이너 d6+d6',[6,6]],[3,'숙련 트레이너 d8+d6',[8,6]],[4,'『두목』 d10+d6',[10,6]]];
 const LAD={E:0,D:0,C:1,B:2,A:3,AA:4,AAA:4,S:4},SIDES=[4,6,8,10,12];
 const d=n=>1+Math.floor(Math.random()*n);

 function open(){
  const ST=A().ST;const roster=ST.state.roster||{trainers:{},mons:{}};const b=ST.state.battle||{};
  const trs=Object.assign({},roster.trainers,b.trainers||{});const ids=Object.keys(trs).filter(id=>ST.role==='gm'||id===ST.seat);
  if(!ids.length)return A().toast('자리에 앉아야 굴릴 수 있다');
  const md=A().openModal(`<div class="mhead"><h2>스킬 체크</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="row"><label>트레이너 <select id="skt">${ids.map(id=>`<option value="${id}">${esc(trs[id].name)}</option>`).join('')}</select></label>
    <label>자질 <select id="sks">${SK.map(([n,k])=>`<option value="${n}">${n}</option>`).join('')}</select></label>
    <label>단계 ± <input type="number" class="n" id="skstep" value="0" min="-4" max="4"></label>
    <label>능숙 <select id="skpm"><option value="0">없음</option><option value="1">능숙함 (1이면 +1)</option><option value="-1">서투름 (1 아니면 −1)</option></select></label></div>
   <div class="row" style="margin-top:6px"><label>동행 <select id="skc"><option value="alone">혼자 d4</option><option value="own">자기 포켓몬</option><option value="help">도움</option><option value="inou">이능</option></select></label>
    <label>동행 주사위 <select id="skcs">${[4,6,8,10,12].map(n=>`<option value="${n}" ${n===6?'selected':''}>d${n}</option>`).join('')}</select></label>
    <label>동행 이름 <input type="text" id="skcn" placeholder="포켓몬·도운 사람"></label>
    <label>두 번 <select id="sktw"><option value="0">없음</option><option value="1">높은 값</option><option value="-1">낮은 값</option></select></label>
    <label>보정 <input type="number" class="n" id="skb" value="0"></label></div>
   <div class="row" style="margin-top:6px"><label>난이도 <select id="skd">${DIFF.map(([v,n])=>`<option value="${v}" ${v===7?'selected':''}>${v} ${n}</option>`).join('')}<option value="custom">직접</option></select></label><input type="number" class="n" id="skdv" value="7">
    <label>NPC 대항 <select id="sknpc">${NPC.map(([v,n])=>`<option value="${v}">${n}</option>`).join('')}</select></label>
    <label>이름표 <input type="text" id="skl" placeholder="예: 정보 수집 · 번역소"></label></div>
   <div id="skres" style="margin-top:10px"></div>
   <div class="row" style="margin-top:10px"><span class="sp"></span><button class="btn pri" id="skroll">굴리기</button></div>`);
  $('#skd',md).onchange=()=>{const v=$('#skd',md).value;if(v!=='custom')$('#skdv',md).value=v};
  $('#skroll',md).onclick=()=>{
   const tid=$('#skt',md).value;const t=trs[tid];const stat=$('#sks',md).value;const rank=S().strip((t.ranks||{})[stat]||'');
   let idx=(LAD[rank]??0)+(+$('#skstep',md).value||0);const autofail=idx<0;idx=Math.max(0,Math.min(4,idx));const sides=SIDES[idx];
   const tw=+$('#sktw',md).value;const a1=d(sides),a2=tw?d(sides):null;let raw=tw>0?Math.max(a1,a2):tw<0?Math.min(a1,a2):a1;
   const pm=+$('#skpm',md).value;let chosen=raw;if(pm===1&&raw===1)chosen=2;if(pm===-1&&raw!==1)chosen=raw-1;
   const comp=$('#skc',md).value;const cs=comp==='alone'?4:+$('#skcs',md).value;const cr=d(cs);const cname=$('#skcn',md).value.trim();
   const bonus=+$('#skb',md).value||0;const total=chosen+cr+bonus;
   const npc=NPC.find(x=>x[0]===+$('#sknpc',md).value);let target=+$('#skdv',md).value||7,npcTxt='';
   if(npc&&npc[2]){const n1=d(npc[2][0]),n2=d(npc[2][1]);target=n1+n2;npcTxt=`${npc[1]} → ${n1}+${n2} = ${target}`}
   const diff=total-target;let ri=1;if(diff>=-2)ri=2;if(diff>=0)ri=3;if(diff>=5)ri=4;const fum=chosen===1&&cr===1;if(fum)ri=idx<3?0:1;if(autofail)ri=1;
   const RES=['대실패','실패','대가를 치르고 성공','성공','대성공'];const COL=['#7a1020','#8a1c2b','#8a6a12','#1f7a4a','#1a6ad8'];
   const cdesc=comp==='alone'?'혼자 d4':comp==='own'?`「${cname||'포켓몬'}」 d${cs}`:comp==='help'?`도움 「${cname||'?'}」 d${cs}`:`이능 d${cs}`;
   const label=$('#skl',md).value.trim();
   const text=`스킬 체크 · ${stat} (${rank||'-'})${label?' · '+label:''}\n자질 d${sides} → ${chosen}${tw?` (두 번 ${a1}, ${a2})`:''}${pm===1&&raw===1?' (1 → 능숙함 +1)':pm===-1&&raw!==1?` (${raw} → 서투름 −1)`:''} · ${cdesc} → ${cr}${bonus?` · 보정 ${bonus>0?'+':''}${bonus}`:''}\n합계 ${total} / 목표 ${target}${npcTxt?' ('+npcTxt+')':''}${autofail?' · 주사위가 d4 아래라 자동 실패':''}\n→ ${RES[ri]}`;
   $('#skres',md).innerHTML=`<div style="background:${COL[ri]};color:#fff;padding:10px 12px"><div class="pre">${esc(text)}</div></div><div class="row" style="margin-top:6px"><span class="sp"></span><button class="btn" id="skpost">로그에 올리기</button></div>`;
   $('#skpost',md).onclick=async()=>{await A().sysLog(text,A().ST.role==='gm'?'battle':'dice');A().closeModal()}}}
 return {open};
})();
