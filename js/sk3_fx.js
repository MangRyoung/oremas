/* 11-05 망령 「카드 DB 에 자동화 구문 넣어서 일단 웹툴에서 다 자동화 되도록」 — 은열쇠 카드 효과 실행기 OM_SK3FX.
   카드 DB(제작기 카드 DB 「자동화 구문」 칸, row[9]) 의 「은열쇠 …」 한 줄을 읽는다 (fx.js 가 k:'sk' 로 알아봄).
   1차(11-05): 던전 카드 8장 — 🗝 카드 창에서 「사용」 하면 바로 적용 (GM 화면 · 좌석 요청은 GM 화면이 처리할 때).
     경계도-N · 휴식+1(다음 휴식 한 단계 위) · 부상회복(부상 → 건강) · 일행상태회복 · 일행HP 1/4 · 보스Lv-5(보스방 경계도 Lv 한 단계 아래) · 예비꺼내기 · 길잡이(다음에 처음 들어가는 방 경계도 안 오름)
   스킬 · 배틀 카드는 다음 단계(체크 창 · 공격 창) — 지금은 「사용」 하면 무엇을 하는지 로그에 안내만. */
window.OM_SK3FX=(()=>{
 const A=()=>window.OM_APP,ST=()=>window.OM_APP.ST;
 const DGU=()=>window.OM_DG_UI,SKU=()=>window.OM_SKILL_UI;
 const trs=()=>((ST().state.roster||{}).trainers)||{};
 const mons=()=>((ST().state.roster||{}).mons)||{};
 const nm=tid=>(trs()[tid]||{}).name||tid;
 const row=n=>{const D=window.OM_SK3&&window.OM_SK3.db&&window.OM_SK3.db();return D&&D.get(n)};
 /* 카드 이름 → {code, arg, raw} (없으면 null) */
 function of(n){const r=row(n);const t=String((r||[])[9]||'').trim();const m=t.match(/^은열쇠\s+(\S+)\s*(.*)$/m);if(!m)return null;return {code:m[1],arg:m[2].trim(),raw:t}}
 const curDg=()=>{try{const D=DGU();return D&&D.cur?D.cur():null}catch(e){return null}};
 const party=()=>{try{const D=DGU();const d=curDg();const p=d&&D.party?D.party(d):[];if(p&&p.length)return p}catch(e){}const S=(ST().state.sk3||{}).h||{};return Object.keys(S).filter(id=>trs()[id])};
 const frac=(max,f)=>{const [a,b]=String(f||'1/4').split('/').map(Number);return Math.max(1,Math.floor((+max||0)*(a||1)/(b||4)))};
 const abnKeys=()=>{const st=((window.OM_DB||{}).states||{}).st||{};return k=>!!(st[k]||{}).abn||['Poison','Toxic','Burn','Paralysis','Freeze','Sleep'].includes(k)};
 const dgSet=async(key,v)=>{const d=curDg();const D=DGU();if(!d||!D||!D.dgUpd)return false;return D.dgUpd({[`list/${d.id}/${key}`]:v})};
 /* 한 번 쓰기 — 돌려줌: 로그 줄들 (못 쓰면 {err}) */
 async function onUse(tid,n,ctx){ctx=ctx||{};const e=of(n);if(!e)return {lines:[]};const L=[];const d=curDg();const who=nm(tid);
  switch(e.code){
   case '경계도-10':case '경계도':{const v=+(e.code.match(/-?\d+/)||[0])[0]||-(+e.arg.replace(/[^\d]/g,'')||10);const D=DGU();if(!d||!D||!D.alAdd){L.push(`「${n}」 — 던전 밖이라 경계도는 그대로`);break}const r=await D.alAdd(v<0?v:-Math.abs(v),`은열쇠 「${n}」`);L.push(r||`「${n}」 — 경계도 변화 없음`);break}
   case '휴식+1':{if(!d){L.push(`「${n}」 — 던전 밖: 다음 휴식에 GM 이 한 단계 위로`);break}await dgSet('restUp',1);L.push(`「${n}」 — 다음 휴식이 한 단계 위 (숨돌리기 → 짧은 → 중간)`);break}
   case '부상회복':{const SK=SKU();const T=((ST().state.skill||{}).trainers)||{};const cand=party().filter(id=>(+((T[id]||{}).inj)||0)===1);const pick=cand.includes(tid)?tid:cand[0];if(!pick||!SK||!SK.tsk){L.push(`「${n}」 — 「부상」인 트레이너가 없다`);break}
    await A().set(['skill','trainers',pick,'inj'],0);L.push(`「${n}」 — ${nm(pick)} 「부상」 → 「건강」${cand.length>1?` (부상 ${cand.length}명 중 — 다른 사람이면 GM 이 체크 창에서 고친다)`:''}`);break}
   case '일행상태회복':{const ab=abnKeys();const ids=party();const ops=[];const got=[];for(const m of Object.values(mons())){if(!ids.includes(m.tid))continue;const ss=Object.assign({},m.sheetStates||{});let ch=false;for(const k of Object.keys(ss))if(k!=='Dead'&&ab(k)){delete ss[k];ch=true}if(ch){ops.push([['roster','mons',m.id,'sheetStates'],Object.keys(ss).length?ss:null]);got.push(m.name)}}
    if(ops.length)await A().setMany(ops);L.push(`「${n}」 — ${got.length?got.join(' · ')+' 상태 이상 회복':'고칠 상태 이상이 없다'}${(ST().state.battle||{}).started&&!(ST().state.battle||{}).done?' (배틀 밖에서 쓰는 카드 — 배틀 칸은 그대로)':''}`);break}
   case '일행HP':{const f=e.arg||'1/4';const ids=party();const ops=[];const got=[];for(const m of Object.values(mons())){if(!ids.includes(m.tid))continue;const mx=+((m.hp||{}).max)||0;const dead=!!(m.sheetStates||{}).Dead;const cur=m.sheetHp==null?mx:+m.sheetHp;if(dead||cur<=0||cur>=mx)continue;const v=Math.min(mx,cur+frac(mx,f));ops.push([['roster','mons',m.id,'sheetHp'],v>=mx?null:v]);got.push(`${m.name} +${v-cur}`)}
    if(ops.length)await A().setMany(ops);L.push(`「${n}」 — ${got.length?got.join(' · '):'회복할 포켓몬이 없다'}`);break}
   case '보스Lv-5':{if(!d){L.push(`「${n}」 — 던전 밖이라 쓸 곳이 없다`);break}await dgSet('bossDn',1);L.push(`「${n}」 — 이번 던전에서 경계도로 오르는 보스방 Lv 한 단계 아래 (+10 → +5, +5 → 0)`);break}
   case '길잡이':{if(!d){L.push(`「${n}」 — 던전 밖이라 쓸 곳이 없다`);break}await dgSet('guide',1);L.push(`「${n}」 — GM: 갈림길에서 고른 다음 방의 내용(체크 · 배틀 · 휴식 · 보물)을 알려 준다 · 그 방에 처음 들어갈 때 경계도가 오르지 않는다`);break}
   case '타입공개':case '해석':{const b=ST().state.battle||{};const DX=window.OM_DEX_UI;const mine=Object.values(b.mons||{}).filter(m=>m&&(m.tid===tid||((b.trainers||{})[m.tid]||{}).srcTid===tid));const side=(mine[0]||{}).side;
    const foes=Object.values(b.mons||{}).filter(m=>m&&side&&m.side!==side);if(!b.started&&!foes.length){L.push(`「${n}」 — 배틀이 없다 (상대가 정해지면 다시)`);break}if(!DX||!DX.analyze){L.push(`「${n}」 — 도감 기능을 불러오지 못했다 · GM 이 손으로 공개`);break}
    if(e.code==='타입공개'){let k=0;for(const m of foes){try{await DX.analyze(tid,m.id,{free:1,parts:['type']});k++}catch(er){}}L.push(`「${n}」 — 상대 PT ${k}체의 타입 공개`);break}
    const go=async m=>{try{await DX.analyze(tid,m.id,{free:1})}catch(er){}A().sysLog(`🗝 「${n}」 — ${nm(tid)} 이(가) ${m.name} 해석 (타입 · 종족치 · 특성 · 기술)`,'sys')};
    if(foes.length===1){await go(foes[0]);break}
    if(ST().role==='gm'){const md=A().openModal(`<div class="mhead"><h2>🗝 ${n} — 해석할 상대 1체</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><div class="row" style="gap:6px;flex-wrap:wrap">${foes.map(m=>`<button class="btn" data-a3m="${m.id}">${String(m.name).replace(/[<>&]/g,'')}</button>`).join('')}</div>`);md.querySelectorAll('[data-a3m]').forEach(bt=>bt.onclick=async()=>{const m=foes.find(x=>x.id===bt.dataset.a3m);A().closeModal();if(m)await go(m)})}
    L.push(`「${n}」 — 해석할 상대를 고른다 (GM 화면)`);break}
   case '예비꺼내기':{L.push(`「${n}」 — 예비 덱에서 한 장을 골라 빈 칸에 (휴식이 아니어도)`);ctx.after='refill';break}
   default:L.push(`「${n}」 — ${hintOf(e)}`)}
  return {lines:L,after:ctx.after}}
 /* 아직 자동이 아닌 카드: 어디서 쓰는지 안내 */
 function hintOf(e){const H={'체크+1':'체크 창에서 효과 카드로 (이번 체크 +1 · 부상 이상이면 +2)','체크+2':'체크 창에서 효과 카드로','동료포켓몬':'체크 창에서 — 일행의 동행 포켓몬 중 하나로 판정','1눈다시':'체크 결과에서 — 1 이 나온 주사위를 다시','종족값바꾸기':'체크 창에서 — 종족값 칸을 특공 · 특방 · 스피드 중 하나로','자동성공':'체크 창에서 — 굴려야 하는 눈이 7 이하면 굴리지 않고 성공','대신받기':'동료의 체크 실패에서 — 상태 단계를 이 카드로 대신','명중다시':'공격 창에서 — 명중을 다시','급소무효':'공격 창에서 — 「C+1」 이하 기술의 급소를 일반 명중으로','난수다시':'HP 창에서 — 난수 차이로 쓰러졌을 때 다시','행동다시':'행동 판정에서 — 마비 · 혼란으로 못 움직이면 다시','부가무시':'공격 창에서 — 30% 이하 추가 효과 무시','타입공개':'배틀 준비에서 — 상대 PT 의 타입 공개','해석':'배틀 전에 — 상대 1체의 타입 · 종족치 · 특성 · 기술 해석'};return H[e.code]||'(GM 판단)'}
 return {of,onUse,hintOf}})();
