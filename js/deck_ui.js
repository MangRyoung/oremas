/* ---------- 덱 (맵툴 Lib:Deck 를 휴대폰으로 옮김, 2026-10-21 망령: 「맵툴 캠페인 덱보다 후지잖아~」) ----------
   state.deck2 = {v:2, cur:<기본 덱 id>, seq, ack:{좌석:{rid,err,msg,peek,at}},
     decks:{<id>:{name, own:''(GM)|좌석, cards:{cid:{n 이름,t 종류,c 비용,x 효과,img,col 색,q 장수}}, order:[cid…],
                  pile:[cid…](0 = 맨 위), disc:[…](끝 = 최근), out:[…], hands:{주인:[cid…]}, holders:[주인…],
                  res:[{n 이름,s 시작,m 최대(0 = 없음),o 모자라면 대신 오르는 자원,a:[{t 단계,x 알림}]}], rv:{주인:{자원:값}},
                  opt:{pv 플레이어에게 보이기, dp 뽑은 카드 공개, hp 손패 공개, ar 덱이 비면 버린 카드 섞기, ps 플레이어도 찾기, sfx, md 한 번에 뽑기 최대, hl 손패 한도, cr 비용 자원},
                  log:[{t,x}]}}}
   주인(holder) = 트레이너 id (좌석 id) · NPC 는 'npc:이름'.
   쓰기: GM 화면만 deck2 를 쓴다. 좌석은 pub/<좌석>/deckq/<요청 id> = {p:{op …}, at} 에 줄을 세우고, GM 화면이 순서대로 받아
         맵툴 deck_op_* 와 같은 검사(내 손패만 · 볼 수 있는 덱만 · 고른 카드가 그새 바뀌지 않았는지)를 거쳐 적용한다 (absorb).
         결과는 deck2.ack.<좌석> 로 돌려준다 (토스트 · 엿보기 결과).
   비밀: 방 상태는 모두가 읽으니 덱 순서 · 남의 손패는 화면에서만 가린다 (맵툴도 GM 이 라이브러리를 열면 보였다). */
"use strict";
window.OM_DECK_UI=(()=>{
 const A=()=>window.OM_APP;
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const $=(s,r)=>(r||document).querySelector(s);
 const clone=x=>JSON.parse(JSON.stringify(x));
 const PAL=[['red','#c8504a','빨강'],['orange','#d9822b','주황'],['gold','#b8932a','금색'],['green','#4f9a5a','초록'],['teal','#2f948f','청록'],['blue','#4573c4','파랑'],['purple','#8a5cc4','보라'],['pink','#c45c9a','분홍'],['gray','#6b7286','회색'],['black','#30343f','검정']];
 const colOf=k=>(PAL.find(p=>p[0]===k)||PAL[8])[1];
 const colKey=v=>{v=String(v||'').trim();const p=PAL.find(x=>x[0]===v||x[2]===v);return p?p[0]:'gray'};
 const OPT0={pv:1,dp:0,hp:0,ar:1,ps:0,sfx:1,md:10,hl:0,cr:'',bd:0,sd:0,rp:'',pk:0,pc:2,fl:0};   /* 11-01 개정: pk 패널티(덱 소진 · 빈사 → 증상 카드 · 부상 · 중상 → 덱 맨 위 버리기 · 코스트가 모자라면 그만큼 덱 맨 위 버리기) · pc 증상 칸 (가득 찬 뒤 또 들어오면 퇴장) · fl 박자마다 손패 한도까지 채우기 */   /* 11-01 은열쇠: bd 배틀 시작에 뽑기 · sd 시작 손패(던전 시작 · 긴 휴식) · rp 덱이 바닥나 다시 섞을 때 +1 하는 자원 */
 /* ---------- 11-01 망령 「은열쇠」: 카드 아이콘 (지시 · 육성 · 통솔 · 능력 · ★) — 스킬 체크에 바치면 +1 · 룰북 「은열쇠 (카드 덱)」 ---------- */
 const ICN=['지시','육성','통솔','능력','★'];
 const icOf=c=>[...new Set(String((c&&c.ic)||'').replace(/[*＊☆]/g,'★').split(/[\s,·\/|]+/).map(x=>x.trim()).filter(x=>ICN.includes(x)))];
 const icFits=(c,stat)=>{const L=icOf(c);return L.includes('★')||(!!stat&&L.includes(stat))};
 const icHtml=c=>{const L=icOf(c);return L.length?`<span class="dic" title="아이콘 — 스킬 체크에 바치면 +1">${L.map(esc).join(' · ')}</span>`:''};
 /* 손패 한도에 넣지 않는 카드: 종류에 「상태」가 든 카드 · 스킬 체크 설정의 상태 카드(부상 · 중상 · 빈사) */
 function exemptSet(did){const s=new Set();try{const cd=(((ST().state.skill||{}).cfg)||{}).cards||{};if(cd.deck===did)for(const k of ['c1','c2','c3'])if(cd[k])s.add(cd[k])}catch(e){}return s}
 const isExempt=(dk,cid,ex)=>!!(ex&&ex.has(cid))||/상태/.test(String(((dk.cards||{})[cid]||{}).t||''));
 function handLoad(dk,did,h){const ex=exemptSet(did);return ((dk.hands||{})[h]||[]).filter(c=>!isExempt(dk,c,ex)).length}
 const ST=()=>A().ST;const gm=()=>ST().role==='gm';const me=()=>gm()?'gm':(ST().seat||'');
 const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
 const T=()=>(ST().state.roster||{}).trainers||{};
 const hName=h=>{if(!h)return '';if(String(h).startsWith('npc:'))return h.slice(4);const t=T()[h];return t?t.name:h};
 const num=v=>{const n=parseFloat(v);return isNaN(n)?null:n};

 /* ---------- 데이터 ---------- */
 function DB(){return ST().state.deck2||null}
 function blank(name){return {name:name||'새 덱',own:'',cards:{},order:[],pile:[],disc:[],out:[],hands:{},holders:[],res:[],rv:{},opt:Object.assign({},OPT0),log:[]}}
 function fixDeck(dk){const b=blank(dk.name);for(const k in b)if(dk[k]==null)dk[k]=b[k];dk.opt=Object.assign({},OPT0,dk.opt||{});
  for(const k of ['pile','disc','out','order','holders','res','log'])if(!Array.isArray(dk[k]))dk[k]=[];for(const h in dk.hands)if(!Array.isArray(dk.hands[h]))dk.hands[h]=[];return dk}
 function copies(dk){const out=[];for(const cid of dk.order){const c=dk.cards[cid];if(c)for(let i=0;i<(+c.q||0);i++)out.push(cid)}return out}
 function resetPiles(dk){dk.pile=shuffle(copies(dk));dk.disc=[];dk.out=[];for(const h in dk.hands)dk.hands[h]=[]}
 function startVals(dk){const o={};for(const r of dk.res)o[r.n]=+r.s||0;return o}
 /* 처음 열 때: 예전 은열쇠 · 광기 창(state.deck)의 카드 · 은열쇠 · 광기를 그대로 덱 하나로 옮기고, 맵툴 예시 덱을 하나 더 */
 function seedDb(){const old=ST().state.deck||{};const oc=(old.cards&&old.cards.length)?old.cards:[
   {id:'k1',name:'실타래 되감기',tag:'소진',kind:'battle',q:2,eff:'아군 기술이 명중 굴림으로 빗나갔을 때, 명중을 다시 굴린다.'},
   {id:'k2',name:'안개의 환영',tag:'방호',kind:'battle',q:2,eff:'상대의 C:+1 이하 기술이 급소에 맞았을 때, 급소가 아닌 것으로 한다.'},
   {id:'k3',name:'소금기 어린 부적',tag:'방호',kind:'battle',q:2,eff:'상대 기술의 30% 이하 추가 효과를 무시한다.'},
   {id:'k4',name:'은은한 등불',tag:'받치기',kind:'skill',q:2,eff:'스킬 체크 결과를 한 칸 올린다 (같은 판정에 겹치지 않는다).'},
   {id:'k5',name:'숨 고르기',tag:'회복',kind:'rest',q:2,eff:'배틀 밖에서 지침 1체를 회복하거나 부상을 한 단계 줄인다.'}];
  const cfg=Object.assign({scope:'party',keyStart:0,keyMax:3,madMax:9,thresholds:[{t:3,x:'정보 수집 불리'},{t:5,x:'통솔·능력 체크 불리'},{t:7,x:'12세션 거절에 통솔 11 판정'},{t:9,x:'거절 불가 · 개인 End 1'}]},old.cfg||{});
  const a=blank('은열쇠 · 광기');let n=0;
  for(const c of oc){const id='c'+(++n);a.cards[id]={n:c.name,t:c.tag||'',c:'1',x:c.eff||'',img:'',col:c.kind==='skill'?'teal':c.kind==='rest'?'green':'red',q:+c.q||1};a.order.push(id)}
  a.res=[{n:'은열쇠',s:+cfg.keyStart||0,m:+cfg.keyMax||3,o:'광기',a:[]},{n:'광기',s:0,m:+cfg.madMax||9,o:'',a:(cfg.thresholds||[]).map(x=>({t:+x.t,x:x.x}))}];
  a.opt=Object.assign({},OPT0,{pv:1,cr:'은열쇠'});
  /* 쓴 장수는 버린 카드로, 남은 건 덱으로 */
  const uses=old.uses||{};const left=[];oc.forEach((c,i)=>{const id='c'+(i+1);const u=Math.min(+uses[c.id]||0,+c.q||1);for(let k=0;k<(+c.q||1);k++)(k<u?a.disc:left).push(id)});a.pile=shuffle(left);
  for(const [tid,p] of Object.entries(old.pcs||{})){if(!T()[tid])continue;a.holders.push(tid);a.hands[tid]=[];a.rv[tid]={은열쇠:cfg.scope==='party'?(+((old.party||{}).keys)||+cfg.keyStart||0):(+p.keys||0),광기:+p.mad||0}}
  const b=blank('예시 덱');const ex=[['상처약','도구','1','포켓몬 1마리의 HP를 20 회복한다.','green',3],['몬스터볼','도구','1','야생 포켓몬에게 던진다.\n이번 포획 판정에 +1.','red',3],['기합의 띠','지닌 물건','2','이번 라운드에 쓰러질 만큼 피해를 받으면 HP 1로 버틴다.','orange',2],['성원','전술','0','아군 포켓몬 1마리의 다음 판정에 +1.','gold',3],['숨은 단서','이벤트','0','GM에게 이 장소의 숨겨진 정보를 하나 묻는다.','purple',2],['짙은 안개','이벤트','2','이번 장면 동안 모든 원거리 판정 -1.','gray',1]];
  ex.forEach((r,i)=>{const id='c'+(i+1);b.cards[id]={n:r[0],t:r[1],c:r[2],x:r[3],img:'',col:r[4],q:r[5]};b.order.push(id)});b.res=[{n:'마나',s:3,m:10,o:'',a:[]}];b.opt=Object.assign({},OPT0,{pv:1,cr:'마나'});b.pile=shuffle(copies(b));
  return {v:2,cur:'d1',seq:100,ack:{},decks:{d1:a,d2:b}}}
 const canSee=(dk,who,isGm)=>isGm||!!dk.opt.pv||(!!dk.own&&dk.own===who);
 const isOwner=(dk,who,isGm)=>isGm||(!!dk.own&&dk.own===who);
 function ensureHolder(dk,h){if(!dk.holders.includes(h))dk.holders.push(h);if(!Array.isArray(dk.hands[h]))dk.hands[h]=[];if(!dk.rv[h]||typeof dk.rv[h]!=='object')dk.rv[h]=startVals(dk);for(const r of dk.res)if(dk.rv[h][r.n]==null)dk.rv[h][r.n]=+r.s||0}
 const cardLine=c=>`「${c.n}」${c.t||c.c!==''?` (${[c.t,c.c!==''&&c.c!=null?'비용 '+c.c:''].filter(Boolean).join(' · ')})`:''}${c.x?'\n  '+String(c.x).replace(/\n/g,'\n  '):''}`;
 /* 자원이 단계 값을 넘어설 때(올라갈 때만) 알림 — 맵툴 deck_res_alert */
 const alerts=(def,b,a)=>((def&&def.a)||[]).filter(x=>b<+x.t&&a>=+x.t).map(x=>`⚠ ${def.n} ${x.t} · ${x.x}`);
 const clampRes=(def,v)=>{v=Math.round(+v||0);if(def&&+def.m>0)v=Math.min(+def.m,v);return v};

 /* ---------- 엔진 (맵툴 deck_op_play / deck_op_card / deck_op_admin) — db 사본을 고치고 결과를 돌려준다 ---------- */
 function exec(db,p,who,isGm){const R={err:'',msg:'',pub:[],peek:null,log:''};const E=m=>(R.err=m,R);const op=p.op;db.decks=db.decks||{};db.seq=+db.seq||100;
  const nameOk=n=>String(n||'').trim().slice(0,40);
  const uniq=n=>{let x=n,i=2;const have=Object.values(db.decks).map(d=>d.name);while(have.includes(x))x=n+' '+(i++);return x};
  if(op==='deckNew'){const src=p.copy&&db.decks[p.copy];if(src&&!canSee(fixDeck(src),who,isGm))return E('그 덱은 볼 수 없어.');
   const dk=src?fixDeck(clone(src)):blank();dk.name=uniq(nameOk(p.name)||(src?src.name+' 복사':'새 덱'));dk.own=isGm?'':who;if(src){dk.hands={};dk.holders=[];dk.rv={};dk.log=[];resetPiles(dk)}
   const id='d'+(++db.seq);db.decks[id]=dk;R.newId=id;R.msg=`「${dk.name}」 덱을 만들었어.`;R.pub.push(`${hName(who)||'GM'} · 새 덱 「${dk.name}」`);return R}
  if(op==='import'){let j=p.json;try{if(typeof j==='string')j=JSON.parse(j)}catch(e){return E('JSON 을 읽지 못했어.')}
   if(!j||typeof j!=='object'||!j.cards||!Array.isArray(j.order))return E('덱 내보내기 파일(cards · order)이 아니야.');
   const cards={},order=[];for(const cid of j.order){const c=j.cards[cid];if(!c||!c.n)continue;cards[cid]={n:String(c.n),t:String(c.t||''),c:c.c==null?'':String(c.c),x:String(c.x||''),img:String(c.img||''),col:colKey(c.col),q:Math.max(0,Math.min(99,+c.q||0))};order.push(cid)}
   if(!order.length)return E('카드가 하나도 없어.');
   let id=p.d,dk=p.mode==='replace'&&db.decks[id]?fixDeck(db.decks[id]):null;
   if(dk){if(!isOwner(dk,who,isGm))return E('이 덱을 고칠 권한이 없어.')}else{dk=blank();dk.name=uniq(nameOk(j.name)||'가져온 덱');dk.own=isGm?'':who;id='d'+(++db.seq);db.decks[id]=dk;R.newId=id}
   dk.cards=cards;dk.order=order;dk.opt=Object.assign({},OPT0,j.opt||{});dk.res=Array.isArray(j.res)?j.res.filter(r=>r&&r.n).map(r=>({n:String(r.n),s:+r.s||0,m:+r.m||0,o:String(r.o||''),a:(r.a||[]).filter(x=>x&&x.x!=null).map(x=>({t:+x.t||0,x:String(x.x)}))})):[];
   resetPiles(dk);dk.rv={};for(const h of dk.holders)ensureHolder(dk,h);R.msg=`「${dk.name}」에 카드 ${order.length}종을 넣었어.`;return R}
  const dk=db.decks[p.d];if(!dk)return E('덱이 없어.');fixDeck(dk);
  if(!canSee(dk,who,isGm))return E('이 덱은 볼 수 없어.');
  const own=isOwner(dk,who,isGm);const cards=dk.cards;const cn=cid=>(cards[cid]||{}).n||'?';
  const H=p.h||who;const by=H===who||!who||who==='gm'?hName(H):`${hName(H)} (${hName(who)} 조작)`;
  const HOLDER_OPS=['draw','play','reveal','discard','commit','top','bottom','give','exile','mull','res','take'];
  if(HOLDER_OPS.includes(op)){if(!H||H==='gm')return E('손패 주인을 골라 줘.');if(!isGm&&H!==who)return E('다른 사람의 손패는 건드릴 수 없어.');ensureHolder(dk,H)}
  const hand=HOLDER_OPS.includes(op)?dk.hands[H]:null;
  /* 손패에서 고른 카드 (인덱스와 카드 id 가 둘 다 맞아야 함) */
  let picked=[],pickIdx=[];
  if(['play','reveal','discard','commit','top','bottom','give','exile'].includes(op)){const sel=p.sel||[],ids=p.ids||[];if(!sel.length)return E('카드를 먼저 골라 줘.');if(sel.length!==ids.length)return E('선택이 이상해. 다시 골라 줘.');
   const seen=new Set();for(let i=0;i<sel.length;i++){const ix=+sel[i];if(seen.has(ix))return E('같은 카드를 두 번 골랐어.');seen.add(ix);if(hand[ix]!==ids[i])return E('손패가 그새 바뀌었어. 다시 골라 줘.');picked.push(ids[i])}
   pickIdx=[...sel].map(Number).sort((a,b)=>b-a)}
  const names=picked.map(c=>'「'+cn(c)+'」').join(', ');const take=()=>{for(const ix of pickIdx)hand.splice(ix,1)};
  const logL=x=>{R.log=x;dk.log.push({t:Date.now(),x});if(dk.log.length>80)dk.log.splice(0,dk.log.length-80)};
  const resDef=n=>dk.res.find(r=>r.n===n);
  /* 11-01 은열쇠: 자원 단계에 「| 카드 이름」이 있으면 그 단계를 넘을 때 그 카드 1장을 덱에 섞는다 (광기 카드) */
  const madIns=(def,b,a)=>{let s='';for(const x of ((def&&def.a)||[]))if(x.c&&b<+x.t&&a>=+x.t){const cid=dk.order.find(id=>dk.cards[id]&&dk.cards[id].n===x.c);if(!cid){s+=`\n(「${x.c}」 카드가 이 덱에 없어서 섞지 못했어)`;continue}qtyAdj(dk,cid,1);s+=`\n「${x.c}」 1장을 덱에 섞었어.`}return s};
  const bump=(h,name,dv)=>{const def=resDef(name);if(!def)return '';ensureHolder(dk,h);const rv=dk.rv[h];const b=+rv[name]||0;const a2=clampRes(def,b+dv);if(a2===b)return '';rv[name]=a2;const al=alerts(def,b,a2);return `\n${name} ${b} → ${a2}${al.length?'\n'+al.join('\n'):''}${madIns(def,b,a2)}`};
  /* 11-01 개정 「패널티 카드」: 종류에 「광기」 · 「상흔」이 든 카드. 광기 카드는 칸(opt.pc)까지만, 넘치면 붕괴(던전 이탈) */
  const penIds=kind=>dk.order.filter(id=>dk.cards[id]&&new RegExp(kind==='scar'?'상흔':'증상|광기').test(String(dk.cards[id].t||'')));
  const penN=kind=>penIds(kind).reduce((a,id)=>a+(+dk.cards[id].q||0),0);
  const penIns=(h,kind,why)=>{const L=penIds(kind);const nm=kind==='scar'?'상흔':'증상';if(!L.length)return `\n(${nm} 카드가 이 덱에 없어서 섞지 못했어 — 「은열쇠 기본값」으로 넣을 수 있어)`;
   if(kind==='mad'){const cap=Math.max(0,+dk.opt.pc||2),n=penN('mad');if(n>=cap)return `\n⚠ 퇴장 — ${hName(h)}의 증상 칸(${cap}장)이 이미 가득 찼다${why?' ('+why+')':''}. 던전에서 이탈한다.`;const id=L.slice().sort((a,b)=>(+dk.cards[a].q||0)-(+dk.cards[b].q||0))[0];qtyAdj(dk,id,1);return `\n증상 카드 「${dk.cards[id].n}」 1장을 덱에 섞었어 (증상 ${n+1}/${cap})${why?' — '+why:''}`}
   const id=L[0];qtyAdj(dk,id,1);return `\n상흔 카드 「${dk.cards[id].n}」 1장을 덱에 섞었어 (긴 휴식에 빠진다)${why?' — '+why:''}`};
  /* 덱 맨 위 n장 버리기 (부상 · 중상 · 코스트 부족). 덱이 비면 버린 카드를 섞어 채우고 증상 카드 */
  const mill=(h,n,why)=>{const ids=[];let line='',left=n,guard=0;const exS=exemptSet(p.d);while(left>0&&guard++<40){if(!dk.pile.length&&dk.disc.length){const ex=exemptSet(p.d);const back=dk.disc.filter(c=>!isExempt(dk,c,ex));if(back.length){dk.pile=shuffle(back);dk.disc=dk.disc.filter(c=>isExempt(dk,c,ex));line+='\n덱이 바닥나 버린 카드를 섞어 다시 채웠어.';if(dk.opt.pk)line+=penIns(h,'mad','덱이 바닥남')}}if(!dk.pile.length)break;const c=dk.pile.shift();const cc=dk.cards[c]||{};if(/증상|광기|상흔/.test(String(cc.t||''))||isExempt(dk,c,exS)){if(h){ensureHolder(dk,h);dk.hands[h].push(c)}line+=`\n「${cn(c)}」은(는) 버려지지 않고 손으로 왔어${/증상|광기/.test(String(cc.t||''))?' (뽑을 때 효과가 있으면 일어나)':''} — 한 장 더 버려.`;continue}dk.disc.push(c);ids.push(c);left--}
   return {ids,line:`덱 맨 위 ${ids.length}장을 버렸어${why?' ('+why+')':''}${ids.length?': '+ids.map(c=>'「'+cn(c)+'」').join(' '):''} · 덱 ${dk.pile.length}장 남음${line}`}};
  switch(op){
   case 'draw':{const n=Math.floor(+p.n||1);const mx=+dk.opt.md||10;if(n<1)return E('몇 장 뽑을지 1 이상으로 적어 줘.');if(n>mx)return E(`한 번에 ${mx}장까지만 뽑을 수 있어. (설정에서 바꿀 수 있어)`);
    const got=[];let rec=0,penL='';for(let i=0;i<n;i++){if(!dk.pile.length&&dk.disc.length&&dk.opt.ar){const ex=exemptSet(p.d);const back=dk.disc.filter(c=>!isExempt(dk,c,ex));if(back.length){dk.pile=shuffle(back);dk.disc=dk.disc.filter(c=>isExempt(dk,c,ex));rec++;if(dk.opt.pk)penL+=penIns(H,'mad','덱이 바닥남')}}if(!dk.pile.length)break;const c=dk.pile.shift();got.push(c);hand.push(c)}
    if(!got.length)return E('덱에 남은 카드가 없어.');
    let line=`${by} · 카드 ${got.length}장 뽑음 (덱 ${dk.pile.length}장 남음)`;if(got.length<n)line+=`\n덱이 모자라서 ${got.length}장만 뽑았어.`;if(rec)line+='\n버린 카드를 섞어 덱을 다시 채웠어.';if(rec&&dk.opt.rp)line+=bump(H,dk.opt.rp,rec);line+=penL;   /* 11-01: 다시 섞을 때 광기 카드도 함께 섞였다 */   /* 11-01 은열쇠: 덱이 바닥나 다시 섞으면 광기 +1 */
    R.pub.push(dk.opt.dp?line+'\n'+got.map(c=>cardLine(cards[c])).join('\n'):line);logL(`${by} · ${got.length}장 뽑음`);R.drawn=got;
    R.msg=`${got.length}장 뽑았어: ${got.map(c=>'「'+cn(c)+'」').join(' ')}`;const hl=+dk.opt.hl||0;if(hl>0&&handLoad(dk,p.d,H)>hl)R.msg+=` · 손패가 한도(${hl}장)를 넘었어. 버릴 카드를 골라 줘.${dk.opt.pk?' (증상 카드는 한도로 버릴 수 없어)':''}`;return R}
   case 'pen':{/* 11-01 패널티 카드: kind = mad · scar (덱에 섞기) · heal (회복 장면: 광기 카드 1장 덱에서 빼기) · scarOut (상흔 전부 빼기) */if(!own)return E('GM(덱 주인)만 할 수 있어.');const h=p.h||'';if(h)ensureHolder(dk,h);let line='';
    if(p.kind==='mad'||p.kind==='scar')line=penIns(h,p.kind,p.why||'').trim();
    else if(p.kind==='heal'){const L=penIds('mad').filter(id=>+dk.cards[id].q>0).sort((a,b)=>(+dk.cards[b].q||0)-(+dk.cards[a].q||0));if(!L.length)return E('덱에 증상 카드가 없어.');qtyAdj(dk,L[0],-1);line=`${p.why||'회복'} — 증상 카드 「${dk.cards[L[0]].n}」 1장을 덱에서 뺐어 (증상 ${penN('mad')}/${+dk.opt.pc||2})`}
    else if(p.kind==='mill'){const m=mill(h,Math.max(1,Math.floor(+p.n||1)),p.why||'');line=m.line;R.milled=m.ids}
    else if(p.kind==='unmill'){let k=0;for(const cid of (p.ids||[]).slice().reverse()){const i=dk.disc.lastIndexOf(cid);if(i<0)continue;dk.disc.splice(i,1);dk.pile.unshift(cid);k++}if(!k)return R;line=`되돌림 — 버린 ${k}장을 덱 맨 위로`}
    else if(p.kind==='scarOut'){let n=0;for(const id of penIds('scar')){const q=+dk.cards[id].q||0;if(q>0){qtyAdj(dk,id,-q);n+=q}}if(!n)return R;line=`상흔 카드 ${n}장을 덱에서 뺐어`}
    else if(p.kind==='undo'&&p.cid&&dk.cards[p.cid]&&+dk.cards[p.cid].q>0){qtyAdj(dk,p.cid,-1);line=`되돌림 — 「${dk.cards[p.cid].n}」 1장을 덱에서 뺐어`}
    else return E('모르는 패널티 동작');
    if(line){R.pub.push(`${h?hName(h)+' · ':''}${line}`);logL(line.split('\n')[0]);R.pen={mad:penN('mad'),cap:+dk.opt.pc||2,collapse:/퇴장/.test(line)}}R.msg=line||'바뀐 게 없어.';return R}
   case 'play':{/* 비용 자원이 모자라면 그 자원의 「대신 오르는 자원」이 모자란 만큼 오른다 (예: 은열쇠 대신 광기) */
    const cr=dk.opt.cr||'';let cost=0;for(const c of picked){const v=num((cards[c]||{}).c);if(v!=null)cost+=v}if(num(p.adj)!=null)cost=Math.max(0,cost+num(p.adj));
    const rv=dk.rv[H];let costLine='',ovLine='',ovAlerts=[];
    if(cr){const def=resDef(cr);const have=+rv[cr]||0;const short=Math.max(0,cost-have);const ov=def&&def.o;if(short>0&&!ov&&!dk.opt.pk)return E(`${cr}이(가) 모자라. 필요 ${cost}, 남은 ${have}`);
     const pay=cost-short;rv[cr]=have-pay;if(pay)costLine=`\n${cr} ${have} → ${have-pay}`;
     if(short>0&&!ov){const m=mill(H,short,`${cr} ${short} 모자람`);ovLine='\n'+m.line;R.milled=m.ids}
     else if(short>0){const od=resDef(ov);const b=+rv[ov]||0;const a2=clampRes(od,b+short);rv[ov]=a2;ovLine=`\n${cr}이(가) 모자라서 ${ov} ${b} → ${a2}`;ovAlerts=alerts(od,b,a2);const mi=madIns(od,b,a2);if(mi)ovAlerts.push(mi.trim())}}
    take();dk.disc.push(...picked);
    R.pub.push(`${by} · 카드 사용${cost&&cr?` (비용 ${cost})`:''}${costLine}${ovLine}${ovAlerts.length?'\n'+ovAlerts.join('\n'):''}\n${picked.map(c=>cardLine(cards[c])).join('\n')}`);logL(`${by} · ${names} 사용${ovLine?' ('+ovLine.trim().replace(/.*\s(\S+ \d+ → \d+)$/,'$1')+')':''}`);R.msg=`${names} 사용했어.`;return R}
   case 'reveal':R.pub.push(`${by} · 손패 공개\n${picked.map(c=>cardLine(cards[c])).join('\n')}`);logL(`${by} · ${names} 공개`);R.msg='모두에게 보여 줬어.';return R;
   case 'commit':{/* 11-01 스킬 체크에 바치기: 그 카드를 버리고, 패널티가 켜진 덱이면 덱 맨 위 1장도 버린다 */take();dk.disc.push(...picked);let line=`${by} · 바침: ${names}`;if(dk.opt.pk){const m=mill(H,1,'바치기');line+='\n'+m.line;R.milled=m.ids}R.pub.push(line);logL(`${by} · ${names} 바침`);R.msg='바쳤어.';return R}
   case 'discard':take();dk.disc.push(...picked);R.pub.push(`${by} · 버림: ${names}`);logL(`${by} · ${names} 버림`);R.msg='버렸어.';return R;
   case 'exile':take();dk.out.push(...picked);R.pub.push(`${by} · 제외: ${names}`);logL(`${by} · ${names} 제외`);R.msg='제외했어.';return R;
   case 'top':take();dk.pile.unshift(...picked.slice().reverse());R.pub.push(`${by} · ${picked.length}장을 덱 맨 위로`);logL(`${by} · ${picked.length}장 덱 위로`);R.msg='덱 맨 위에 올렸어.';return R;
   case 'bottom':take();dk.pile.push(...picked);R.pub.push(`${by} · ${picked.length}장을 덱 맨 아래로`);logL(`${by} · ${picked.length}장 덱 아래로`);R.msg='덱 맨 아래에 넣었어.';return R;
   case 'give':{const to=p.to;if(!to||to===H)return E('받을 사람을 골라 줘.');ensureHolder(dk,to);take();dk.hands[to].push(...picked);R.pub.push(`${by} → ${hName(to)} · 카드 ${picked.length}장 건넴${dk.opt.hp?'\n'+picked.map(c=>cardLine(cards[c])).join('\n'):''}`);logL(`${by} → ${hName(to)} · ${picked.length}장`);R.msg=`${hName(to)}에게 건넸어.`;return R}
   case 'mull':{const n=hand.length;if(!n)return E('손패가 비어 있어.');dk.pile=shuffle([...dk.pile,...hand]);dk.hands[H]=[];R.pub.push(`${by} · 손패 ${n}장을 덱에 섞음`);logL(`${by} · 손패 ${n}장 섞음`);R.msg='손패를 덱에 섞었어.';return R}
   case 'res':{const def=resDef(p.n);if(!def)return E('그 자원이 없어.');const rv=dk.rv[H];const b=+rv[def.n]||0;let a2=p.v!=null?clampRes(def,p.v):clampRes(def,b+(+p.dv||0));if(a2<0&&!def.neg)a2=Math.max(a2,-999);if(a2===b)return R;rv[def.n]=a2;
    const al=alerts(def,b,a2);const mi=madIns(def,b,a2);if(mi)al.push(mi.trim());R.pub.push(`${by} · ${def.n} ${b} → ${a2}${al.length?'\n'+al.join('\n'):''}`);logL(`${by} · ${def.n} ${b}→${a2}`);R.quiet=!al.length&&!p.loud;return R}
   case 'take':{/* 덱 · 버린 카드 · 제외 칸에서 손패로 (맵툴 zone 선택 → 손패로) */const z=p.from;if(!['pile','disc','out'].includes(z))return E('어디서 가져올지 모르겠어.');
    if(z==='pile'&&!(own||dk.opt.ps))return E('덱에서 찾기는 GM(덱 주인)만 할 수 있어. (설정 「플레이어도 찾기」)');
    const got=[];for(const cid of p.ids||[]){const i=dk[z].indexOf(cid);if(i<0)continue;dk[z].splice(i,1);got.push(cid)}if(!got.length)return E('그 카드가 이미 없어.');hand.push(...got);if(z==='pile')dk.pile=shuffle(dk.pile);
    const zn={pile:'덱',disc:'버린 카드',out:'제외'}[z];R.pub.push(`${by} · ${zn}에서 ${got.map(c=>'「'+cn(c)+'」').join(', ')}을(를) 손패로${z==='pile'?' (덱을 섞음)':''}`);logL(`${by} · ${zn}→손패 ${got.length}장`);R.msg='손패로 가져왔어.';return R}
   case 'zone':{/* 버린 카드 · 제외 · (GM) 덱 사이 옮기기: from, ids, to = top|bottom|disc|out */const z=p.from,to=p.to;if(!own&&!(dk.opt.ps&&z!=='pile'))return E('GM(덱 주인)만 옮길 수 있어.');if(!['pile','disc','out'].includes(z)||!['top','bottom','disc','out'].includes(to))return E('옮길 곳이 이상해.');
    const got=[];for(const cid of p.ids||[]){const i=dk[z].indexOf(cid);if(i<0)continue;dk[z].splice(i,1);got.push(cid)}if(!got.length)return E('그 카드가 이미 없어.');
    if(to==='top')dk.pile.unshift(...got);else if(to==='bottom')dk.pile.push(...got);else dk[to].push(...got);
    const zn={pile:'덱',disc:'버린 카드',out:'제외',top:'덱 맨 위',bottom:'덱 맨 아래'};R.pub.push(`${hName(who)||'GM'} · ${zn[z]} ${got.length}장 → ${zn[to]}`);logL(`${zn[z]} ${got.length}장 → ${zn[to]}`);R.msg='옮겼어.';return R}
   case 'discAll':{if(!own)return E('GM(덱 주인)만 할 수 있어.');const n=dk.disc.length;if(!n)return E('버린 카드가 없어.');
    if(p.to==='hand'){ensureHolder(dk,H);dk.hands[H].push(...dk.disc);dk.disc=[];R.pub.push(`버린 카드 ${n}장을 ${hName(H)}의 손패로`)}else{dk.pile=shuffle([...dk.pile,...dk.disc]);dk.disc=[];R.pub.push(`버린 카드 ${n}장을 덱에 섞음`)}logL(R.pub[0]);R.msg='했어.';return R}
   case 'shuffle':dk.pile=shuffle(dk.pile);R.pub.push(`${hName(who)||'GM'} · 덱을 섞음 (${dk.pile.length}장)`);logL('덱 섞음');R.msg='섞었어.';return R;
   case 'peek':{if(!(own||dk.opt.ps))return E('엿보기는 GM(덱 주인)만 할 수 있어.');const n=Math.max(1,Math.min(10,Math.floor(+p.n||1)));R.peek=dk.pile.slice(0,n);R.pub.push(`${hName(who)||'GM'} · 덱 위 ${R.peek.length}장을 엿봄`);R.msg=`덱 위 ${R.peek.length}장: ${R.peek.map(c=>'「'+cn(c)+'」').join(' ')}`;return R}
   case 'reset':{if(!own)return E('GM(덱 주인)만 리셋할 수 있어.');resetPiles(dk);if(p.res)for(const h of dk.holders)dk.rv[h]=startVals(dk);R.pub.push(`덱 「${dk.name}」 리셋 — 모든 카드를 모아 섞음 (${dk.pile.length}장)${p.res?' · 자원도 시작값으로':''}`);logL('덱 리셋');R.msg='리셋했어.';return R}
   case 'resReset':{if(!own)return E('GM(덱 주인)만 할 수 있어.');const hs=p.all?dk.holders:[H];for(const h of hs){ensureHolder(dk,h);dk.rv[h]=startVals(dk)}R.pub.push(`${p.all?'모든 손패 주인':hName(H)}의 자원을 시작값으로`);R.msg='시작값으로 돌렸어.';return R}
   case 'holderAdd':{const h=String(p.h||'').trim();if(!h)return E('누구를 넣을지 골라 줘.');if(!own&&h!==who)return E('GM(덱 주인)만 다른 사람을 넣을 수 있어.');ensureHolder(dk,h);R.msg=`${hName(h)}을(를) 손패 주인으로 넣었어.`;return R}
   case 'holderDel':{if(!own)return E('GM(덱 주인)만 뺄 수 있어.');const h=p.h;const hd=dk.hands[h]||[];dk.disc.push(...hd);delete dk.hands[h];delete dk.rv[h];dk.holders=dk.holders.filter(x=>x!==h);R.pub.push(`${hName(h)}을(를) 손패 주인에서 뺌${hd.length?` (손패 ${hd.length}장은 버린 카드로)`:''}`);R.msg='뺐어.';return R}
   case 'logClear':if(!own)return E('GM(덱 주인)만 지울 수 있어.');dk.log=[];R.msg='기록을 지웠어.';return R;
   /* ---- 카드 편집 (덱 주인) ---- */
   case 'cardSave':{if(!own)return E('이 덱을 고칠 권한이 없어.');const c=p.card||{};const n=nameOk(c.n);if(!n)return E('카드 이름을 적어 줘.');
    const v={n,ic:icOf({ic:c.ic}).join(' '),t:String(c.t||'').slice(0,30),c:c.c==null?'':String(c.c).slice(0,8),x:String(c.x||'').slice(0,2000),img:String(c.img||'').slice(0,600),col:colKey(c.col),q:Math.max(0,Math.min(99,Math.floor(+c.q||0))),a:c.a&&c.a.dsl?{dsl:String(c.a.dsl).slice(0,1500),ops:Array.isArray(c.a.ops)?c.a.ops:[]}:null};if(!v.a)delete v.a;
    if(p.cid&&cards[p.cid]){const dv=v.q-(+cards[p.cid].q||0);cards[p.cid]=Object.assign({},cards[p.cid],v,{q:cards[p.cid].q});const fh=qtyAdj(dk,p.cid,dv);R.msg=`「${n}」 고쳤어.${fh?` (손패에서 ${fh}장 빠짐)`:''}`;R.cid=p.cid}
    else{const id='c'+(++db.seq);cards[id]=Object.assign({},v,{q:0});dk.order.push(id);qtyAdj(dk,id,v.q);R.cid=id;R.msg=`「${n}」 ${v.q}장을 덱에 넣고 섞었어.`}return R}
   case 'cardQty':{if(!own)return E('이 덱을 고칠 권한이 없어.');if(!cards[p.cid])return E('그 카드가 없어.');const fh=qtyAdj(dk,p.cid,+p.dv||0);R.msg=`「${cn(p.cid)}」 ${cards[p.cid].q}장${fh?` (손패에서 ${fh}장 빠짐)`:''}`;return R}
   case 'cardDel':{if(!own)return E('이 덱을 고칠 권한이 없어.');if(!cards[p.cid])return E('그 카드가 없어.');const nm=cn(p.cid);qtyAdj(dk,p.cid,-(+cards[p.cid].q||0));for(const z of ['pile','disc','out'])dk[z]=dk[z].filter(x=>x!==p.cid);for(const h in dk.hands)dk.hands[h]=dk.hands[h].filter(x=>x!==p.cid);delete cards[p.cid];dk.order=dk.order.filter(x=>x!==p.cid);R.msg=`「${nm}」 지웠어.`;return R}
   case 'cardMove':{if(!own)return E('이 덱을 고칠 권한이 없어.');const i=dk.order.indexOf(p.cid),j=i+(+p.dir||0);if(i<0||j<0||j>=dk.order.length)return R;[dk.order[i],dk.order[j]]=[dk.order[j],dk.order[i]];return R}
   case 'bulk':{if(!own)return E('이 덱을 고칠 권한이 없어.');const rows=(p.rows||[]).filter(r=>r&&nameOk(r.n));if(!rows.length)return E('넣을 카드가 없어.');let total=0;
    for(const r of rows){const id='c'+(++db.seq);cards[id]={n:nameOk(r.n),ic:icOf({ic:r.ic}).join(' '),t:String(r.t||'').slice(0,30),c:r.c==null?'':String(r.c).slice(0,8),x:String(r.x||''),img:'',col:colKey(r.col),q:0};dk.order.push(id);const q=Math.max(0,Math.min(99,Math.floor(r.q==null?1:+r.q)));qtyAdj(dk,id,q);total+=q}
    R.msg=`카드 ${rows.length}종 ${total}장을 넣고 섞었어.`;R.pub.push(`덱 「${dk.name}」에 카드 ${rows.length}종 ${total}장 추가`);return R}
   /* ---- 덱 관리 · 설정 ---- */
   case 'deckRename':{if(!own)return E('이 덱을 고칠 권한이 없어.');const n=nameOk(p.name);if(!n)return E('이름을 적어 줘.');dk.name=n===dk.name?n:uniq(n);R.msg='이름을 바꿨어.';return R}
   case 'deckDel':{if(!own)return E('이 덱을 지울 권한이 없어.');if(Object.keys(db.decks).length<2)return E('마지막 덱은 지울 수 없어.');const nm=dk.name;delete db.decks[p.d];if(db.cur===p.d)db.cur=Object.keys(db.decks)[0];R.msg=`「${nm}」 덱을 지웠어.`;R.pub.push(`덱 「${nm}」 삭제`);return R}
   case 'deckCur':if(!isGm)return E('GM 만 정할 수 있어.');db.cur=p.d;R.msg=`「${dk.name}」을(를) 플레이어 기본 덱으로 했어.`;return R;
   case 'opt':{if(!own)return E('이 덱을 고칠 권한이 없어.');const o=p.opt||{};const no=Object.assign({},dk.opt);for(const k of ['pv','dp','hp','ar','ps','sfx','pk','fl'])if(o[k]!=null)no[k]=o[k]?1:0;if(o.pc!=null)no.pc=Math.max(0,Math.min(9,Math.floor(+o.pc||0)));
    if(o.md!=null)no.md=Math.max(1,Math.min(30,Math.floor(+o.md||10)));if(o.hl!=null)no.hl=Math.max(0,Math.min(99,Math.floor(+o.hl||0)));if(o.cr!=null)no.cr=String(o.cr);for(const k of ['bd','sd'])if(o[k]!=null)no[k]=Math.max(0,Math.min(5,Math.floor(+o[k]||0)));if(o.rp!=null)no.rp=String(o.rp);
    if(Array.isArray(p.res)){const names=new Set();dk.res=p.res.map(r=>({n:nameOk(r.n),s:Math.round(+r.s||0),m:Math.max(0,Math.round(+r.m||0)),o:String(r.o||''),a:(r.a||[]).filter(x=>x&&(String(x.x||'').trim()||String(x.c||'').trim())).map(x=>Object.assign({t:Math.round(+x.t||0),x:String(x.x||'').trim()},String(x.c||'').trim()?{c:String(x.c).trim().slice(0,40)}:{})).sort((a,b)=>a.t-b.t)})).filter(r=>r.n&&!names.has(r.n)&&names.add(r.n));
     for(const r of dk.res)if(r.o===r.n||!dk.res.some(x=>x.n===r.o))r.o='';for(const h of dk.holders)ensureHolder(dk,h)}
    if(no.cr&&!dk.res.some(r=>r.n===no.cr))no.cr='';if(no.rp&&!dk.res.some(r=>r.n===no.rp))no.rp='';dk.opt=no;R.msg='설정을 저장했어.';return R}
   default:return E('모르는 동작: '+op)}}
 /* 장수 바꾸기 (맵툴 deck_adj): 늘리면 덱에 넣고 섞는다, 줄이면 덱 → 버린 카드 → 제외 → 손패 순으로 뺀다. 손패에서 뺀 장수를 돌려준다 */
 function qtyAdj(dk,cid,dv){const c=dk.cards[cid];if(!c||!dv)return 0;let fromHand=0;
  if(dv>0){for(let i=0;i<dv;i++)dk.pile.push(cid);dk.pile=shuffle(dk.pile)}
  else{let need=-dv;for(const z of ['pile','disc','out']){dk[z]=dk[z].filter(x=>{if(x===cid&&need>0){need--;return false}return true})}
   for(const h in dk.hands){dk.hands[h]=dk.hands[h].filter(x=>{if(x===cid&&need>0){need--;fromHand++;return false}return true})}}
  c.q=Math.max(0,(+c.q||0)+dv);return fromHand}

 /* ---------- 주고받기: GM 은 바로, 좌석은 요청 줄 → GM 화면 ---------- */
 const PEND={};let ackSeen=0;
 async function run(p){if(!p.d&&!['deckNew','import'].includes(p.op))p.d=PV.deck;
  if(gm())return apply(p,'gm',true,null);
  const seat=ST().seat;if(!seat){A().toast('자리에 앉아야 덱을 쓸 수 있어');return null}
  const rid='q'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);PEND[rid]={op:p.op,at:Date.now()};
  if(!await A().set(['pub',seat,'deckq',rid],{p,at:Date.now()})){delete PEND[rid];return null}
  redrawSoon();return {queued:rid}}
 async function apply(p,who,isGm,rid){let db0=DB();const fresh=!db0;if(fresh)db0=seedDb();const db=clone(db0);const R=exec(db,p,who,isGm);
  if(!R.err){const ok=fresh?await A().set(['deck2'],db):await A().setDiff(['deck2'],db0,db,3);if(!ok)R.err='저장하지 못했어.';
   else if(R.pub.length&&!R.quiet){const dk=db.decks[p.d]||db.decks[R.newId]||{};for(const x of R.pub)A().sysLog(`🃏 ${dk.name?'〔'+dk.name+'〕 ':''}${x}`,'sys')}}
  if(R.newId&&who==='gm')PV.deck=R.newId;
  if(!isGm&&rid)await A().set(['deck2','ack',who],{rid,err:R.err||'',msg:R.msg||'',peek:R.peek||null,newId:R.newId||'',d:p.d||'',at:Date.now()});
  else if(isGm){if(R.err)A().toast(R.err);else if(R.msg&&!R.quiet)A().toast(R.msg);if(R.peek)PV.peek={d:p.d,ids:R.peek,at:Date.now()}}
  return R}
 /* GM 화면: 좌석의 요청을 순서대로 받아 처리 */
 let busy=false;
 async function absorb(){if(!gm()||busy)return;const pub=ST().state.pub||{};const todo=[];
  for(const sid of Object.keys(pub)){const q=(pub[sid]||{}).deckq||{};for(const [rid,x] of Object.entries(q))if(x)todo.push({sid,rid,x})}
  if(!todo.length)return;busy=true;todo.sort((a,b)=>(+a.x.at||0)-(+b.x.at||0));
  try{for(const it of todo){if(!await A().set(['pub',it.sid,'deckq',it.rid],null))continue;
    if(!it.x.p||!it.x.p.op||Date.now()-(+it.x.at||0)>10*60000)continue;   /* 예전 은열쇠 창의 선언({card}) · 너무 오래된 요청은 버린다 */
    await apply(it.x.p,it.sid,false,it.rid)}}
  finally{busy=false}}
 /* 좌석: 내 요청의 결과(ack)가 오면 토스트 */
 function onAck(){if(gm())return;const a=((DB()||{}).ack||{})[ST().seat];if(!a||!a.at||a.at<=ackSeen)return;ackSeen=a.at;if(!PEND[a.rid])return;delete PEND[a.rid];
  if(a.err||a.msg)A().toast(a.err||a.msg);if(a.newId)PV.deck=a.newId;if(a.peek)PV.peek={d:a.d,ids:a.peek,at:Date.now()};redrawSoon()}
 const pendingN=()=>Object.keys(PEND).filter(k=>Date.now()-PEND[k].at<60000).length;

 /* ---------- 카드 그림 ---------- */
 function cardHtml(c,o){o=o||{};if(!c)return '';const col=colOf(c.col);const cost=c.c!==''&&c.c!=null;
  return `<div class="dc ${o.sel?'sel':''} ${o.cls||''}" style="--dc:${col}" ${o.attr||''}>${o.badge?`<em class="dcb">${o.badge}</em>`:''}<div class="dch"><b>${esc(c.n)}</b>${cost?`<span class="dcc">${esc(c.c)}</span>`:''}</div>${c.img?`<div class="dci" style="background-image:url('${cssu(c.img)}')"></div>`:''}${c.t||c.ic?`<div class="dct">${icHtml(c)}${esc(c.t||'')}</div>`:''}<div class="dcx">${esc(c.x||'')}</div>${c.a&&c.a.ops&&c.a.ops.length?'<em class="dca" title="자동화 구문이 있다">⚙</em>':''}</div>`}
 const backHtml=n=>`<div class="dc back"><span>🃏</span>${n!=null?`<em>${n}</em>`:''}</div>`;

 /* ---------- 휴대폰 「덱」 앱 ---------- */
 const PV={deck:'',tab:'hand',sel:[],q:'',zsel:{},zone:'disc',peek:null,adj:0,give:'',n:1,arm:'',armT:0};
 try{PV.deck=localStorage.getItem('om_deck_cur')||''}catch(e){}
 let redrawFn=null,rdT=0;const redrawSoon=()=>{clearTimeout(rdT);rdT=setTimeout(()=>{if(redrawFn&&document.querySelector('.ph-deck2'))redrawFn()},40)};
 function visDecks(){const db=DB();if(!db)return [];return Object.entries(db.decks||{}).map(([id,d])=>[id,fixDeck(clone(d))]).filter(([,d])=>canSee(d,me(),gm()))}
 function curDeck(){const L=visDecks();if(!L.length)return null;let x=L.find(([id])=>id===PV.deck);if(!x)x=L.find(([id])=>id===(DB()||{}).cur)||L[0];PV.deck=x[0];try{localStorage.setItem('om_deck_cur',PV.deck)}catch(e){}return x}
 function holderOf(t){if(!t)return '';return t.npc?'npc:'+t.name:t.id}
 function phone(t,canWrite){onAck();
  if(!DB())return `<div class="ph-head deck"><button class="ph-back" data-ph="home">‹</button><div><b>덱</b><small>카드 · 손패 · 자원</small></div></div><div class="ph-empty">아직 덱이 없다.${gm()?'<br><br><button class="btn sm pri" data-pd="mkdeck">📥 제작기 덱 가져오기</button><br><br><button class="btn sm" data-pd="seed">예시 덱 만들기 (은열쇠 · 광기)</button>':'<br>GM 이 덱을 만들면 여기 나온다.'}</div>`;
  const cd=curDeck();if(!cd)return `<div class="ph-head deck"><button class="ph-back" data-ph="home">‹</button><div><b>덱</b></div></div><div class="ph-empty">볼 수 있는 덱이 없다${me()&&!gm()?'<br><br><button class="btn sm" data-pd="newdeck">＋ 내 덱 만들기</button>':''}</div>`;
  const [did,dk]=cd;const H=holderOf(t);const own=isOwner(dk,me(),gm());const mine=canWrite&&(gm()||H===me());
  const L=visDecks();const pn=pendingN();
  const head=`<div class="ph-head deck"><button class="ph-back" data-ph="home">‹</button><div><select class="pd-sel" data-pd="deck">${L.map(([id,d])=>`<option value="${id}" ${id===did?'selected':''}>${esc(d.name)}${(DB()||{}).cur===id?' · 기본':''}${d.own?' · '+esc(hName(d.own)):''}</option>`).join('')}</select><small>${esc(hName(H))}의 손패${pn?` · ⏳ ${pn}`:''}</small></div>${gm()?'<button class="btn xs ghost" data-pd="mkdeck" title="제작기 트레이너 시트의 덱을 이 방으로 (다시 누르면 카드 · 장수만 맞춘다)">📥 제작기</button>':''}<button class="btn xs" data-pd="mgr" title="카드 추가 · 편집 · 설정 · 자원 · 덱 관리">${own?'관리':'카드 목록'}</button></div>`;
  const counts=`<div class="pdz"><span title="남은 덱"><b>${dk.pile.length}</b>덱</span><span title="버린 카드"><b>${dk.disc.length}</b>버림</span><span title="제외"><b>${dk.out.length}</b>제외</span><span title="손패"><b>${(dk.hands[H]||[]).length}</b>손패${+dk.opt.hl?'/'+dk.opt.hl:''}</span></div>`;
  const tabs=`<div class="ph-dtabs">${[['hand','손패'],['zones','덱 · 버린 카드'],['log','기록']].map(([k,n])=>`<button class="${PV.tab===k?'on':''}" data-pd="tab" data-v="${k}">${n}</button>`).join('')}</div>`;
  const body=PV.tab==='zones'?zonesTab(did,dk,H,own,mine):PV.tab==='log'?logTab(dk,own):handTab(did,dk,H,own,mine);
  return `<div class="ph-deck2">${head}${counts}${tabs}${body}</div>`}
 function resBoxes(dk,H,mine,own){if(!dk.res.length)return '';const rv=dk.rv[H]||startVals(dk);
  return `<div class="pdres">${dk.res.map(r=>{const v=rv[r.n]!=null?+rv[r.n]:+r.s||0;const hit=(r.a||[]).filter(x=>v>=+x.t);const cur=hit[hit.length-1];const nx=(r.a||[]).find(x=>+x.t>v);const pct=+r.m>0?Math.max(0,Math.min(100,v/ +r.m*100)):0;
   return `<div class="pdrb ${cur?'hot':''}"><div class="pdrh"><b>${esc(r.n)}</b>${r.o?`<small title="모자라면 대신 오른다">→${esc(r.o)}</small>`:''}<span class="sp"></span>${mine||own?`<button class="btn xs ghost" data-pd="res" data-n="${esc(r.n)}" data-dv="-1">−</button>`:''}<em>${v}${+r.m>0?'<small>/'+r.m+'</small>':''}</em>${mine||own?`<button class="btn xs ghost" data-pd="res" data-n="${esc(r.n)}" data-dv="1">＋</button>`:''}</div>
    ${+r.m>0?`<div class="pdrm"><i style="width:${pct}%"></i>${(r.a||[]).map(x=>`<u style="left:${Math.min(100,+x.t/ +r.m*100)}%" title="${esc(x.t+' · '+x.x)}"></u>`).join('')}</div>`:''}
    ${cur?`<div class="pdra on">${esc(r.n)} ${cur.t} · ${esc(cur.x)}</div>`:''}${nx?`<div class="pdra">다음 ${nx.t} · ${esc(nx.x)}</div>`:''}</div>`}).join('')}</div>`}
 function handTab(did,dk,H,own,mine){const hand=dk.hands[H]||[];PV.sel=PV.sel.filter(i=>i<hand.length);const md=+dk.opt.md||10;
  const draw=mine?`<div class="pddraw"><span class="pdl">뽑기</span>${[1,2,3].filter(n=>n<=md).map(n=>`<button class="btn sm ${n===1?'pri':''}" data-pd="draw" data-n="${n}">${n}장</button>`).join('')}<input type="number" class="n xs" min="1" max="${md}" value="${PV.n}" data-pdn><button class="btn sm" data-pd="drawn">장</button>${own||dk.opt.ps?`<span class="sp"></span><button class="btn sm ghost" data-pd="tab" data-v="zones" title="덱에서 찾아 가져오기">서치</button>`:''}</div>`:'';
  const sel=PV.sel.map(i=>hand[i]);const cr=dk.opt.cr;let cost=0;for(const c of sel){const v=num((dk.cards[c]||{}).c);if(v!=null)cost+=v}const costAdj=Math.max(0,cost+(+PV.adj||0));
  const others=dk.holders.filter(h=>h!==H);
  const bar=mine&&sel.length?`<div class="pdact"><div class="pdact1"><b>${sel.length}장 고름</b>${cr?`<span class="pdcost">비용 ${cr} <button class="btn xs ghost" data-pd="adj" data-dv="-1">−</button><b>${costAdj}</b><button class="btn xs ghost" data-pd="adj" data-dv="1">＋</button>${PV.adj?`<small>(${PV.adj>0?'+':''}${PV.adj})</small>`:''}</span>`:''}<span class="sp"></span><button class="btn xs ghost" data-pd="unsel">고르기 취소</button></div>
   <div class="pdact2"><button class="btn sm pri" data-pd="op" data-op="play">사용</button><button class="btn sm" data-pd="op" data-op="reveal">공개</button><button class="btn sm" data-pd="op" data-op="discard">버리기</button><button class="btn sm ghost" data-pd="op" data-op="top">덱 위로</button><button class="btn sm ghost" data-pd="op" data-op="bottom">덱 아래로</button><button class="btn sm ghost" data-pd="op" data-op="exile">제외</button></div>
   ${others.length?`<div class="pdact2"><select data-pdgive>${others.map(h=>`<option value="${esc(h)}" ${PV.give===h?'selected':''}>${esc(hName(h))}</option>`).join('')}</select><button class="btn sm ghost" data-pd="op" data-op="give">에게 주기</button></div>`:''}</div>`:'';
  const grid=hand.length?`<div class="pdhand">${hand.map((cid,i)=>cardHtml(dk.cards[cid],{sel:PV.sel.includes(i),attr:mine?`data-pdc="${i}"`:''})).join('')}</div>`:`<div class="ph-empty sm">손패가 비어 있다${mine?' — 위에서 뽑아 줘':''}</div>`;
  const tools=mine&&hand.length?`<div class="pdtools"><button class="btn xs ghost" data-pd="selall">모두 고르기</button><span class="sp"></span><button class="btn xs ghost ${PV.arm==='mull'?'arm':''}" data-pd="mull">${PV.arm==='mull'?'한 번 더 누르면 실행':'손패 전부 덱에 섞기'}</button></div>`:'';
  const peek=PV.peek&&PV.peek.d===did&&Date.now()-PV.peek.at<120000?`<div class="ph-sec">엿본 카드 <small>덱 위부터 · 나만</small><span class="sp"></span><button class="btn xs ghost" data-pd="peekx">닫기</button></div><div class="pdhand">${PV.peek.ids.map((c,i)=>cardHtml(dk.cards[c],{badge:i+1})).join('')}</div>`:'';
  const oth=others.length&&(gm()||own||dk.opt.hp)?`<div class="ph-sec">다른 손패${dk.opt.hp?' <small>공개</small>':' <small>GM 만 보임</small>'}</div>${others.map(h=>{const hd=dk.hands[h]||[];return `<div class="pdoth"><b>${esc(hName(h))}</b> <small>${hd.length}장</small><div class="pdhand mini">${hd.map(c=>cardHtml(dk.cards[c],{cls:'mini'})).join('')||'<span class="small dim">없음</span>'}</div></div>`}).join('')}`:others.length?`<div class="ph-sec">다른 손패</div><div class="pdoth">${others.map(h=>`<span class="pdbk"><b>${esc(hName(h))}</b> ${backHtml((dk.hands[h]||[]).length)}</span>`).join('')}</div>`:'';
  return `<div class="ph-dk">${resBoxes(dk,H,mine,own)}${draw}${bar}<div class="ph-sec">손패 <small>${hand.length}장${+dk.opt.hl&&hand.length>+dk.opt.hl?` · <b class="red">한도 ${dk.opt.hl}장 넘음</b>`:''}${mine?' · 눌러서 고르기':''}</small></div>${grid}${tools}${peek}${oth}</div>`}
 function zonesTab(did,dk,H,own,mine){const canFind=own||!!dk.opt.ps;const q=PV.q.trim();const hit=c=>!q||[c.n,c.t,c.x].some(s=>String(s||'').includes(q));
  const zs=PV.zsel;const zbar=z=>{const ids=Object.keys(zs).filter(k=>zs[k]&&k.startsWith(z+':')).map(k=>k.split(':')[2]);if(!ids.length)return '';
   return `<div class="pdact"><div class="pdact1"><b>${ids.length}장 고름</b><span class="sp"></span><button class="btn xs ghost" data-pd="zunsel">취소</button></div><div class="pdact2">${mine?`<button class="btn sm pri" data-pd="ztake" data-z="${z}">손패로</button>`:''}${own?`${z!=='pile'?'<button class="btn sm ghost" data-pd="zmove" data-z="'+z+'" data-to="top">덱 위로</button><button class="btn sm ghost" data-pd="zmove" data-z="'+z+'" data-to="bottom">덱 아래로</button>':''}${z!=='disc'?`<button class="btn sm ghost" data-pd="zmove" data-z="${z}" data-to="disc">버린 카드로</button>`:''}${z!=='out'?`<button class="btn sm ghost" data-pd="zmove" data-z="${z}" data-to="out">제외로</button>`:''}`:''}</div></div>`};
  const zcard=(z,cid,i)=>{const k=z+':'+i+':'+cid;return cardHtml(dk.cards[cid],{sel:!!zs[k],cls:'mini',attr:(mine||own)?`data-pdz="${esc(k)}"`:''})};
  const disc=dk.disc.map((c,i)=>[c,i]).reverse().filter(([c])=>hit(dk.cards[c]||{}));
  const out=dk.out.map((c,i)=>[c,i]).filter(([c])=>hit(dk.cards[c]||{}));
  let pile='';
  if(own)pile=`<div class="pdhand mini">${dk.pile.map((c,i)=>[c,i]).filter(([c])=>hit(dk.cards[c]||{})).map(([c,i])=>zcard('pile',c,i).replace('<div class="dch">',`<div class="dch"><small class="dcn">${i+1}</small>`)).join('')||'<span class="small dim">비어 있음</span>'}</div>`;
  else if(canFind){const g={};for(const c of dk.pile)g[c]=(g[c]||0)+1;pile=`<div class="pdgroup">${Object.entries(g).filter(([c])=>hit(dk.cards[c]||{})).map(([c,n])=>`<div class="pdgr">${cardHtml(dk.cards[c],{cls:'mini',badge:'×'+n})}${mine?`<button class="btn xs" data-pd="ptake" data-c="${esc(c)}">손패로 가져오기</button>`:''}</div>`).join('')||'<span class="small dim">없음</span>'}</div>`}
  else pile=`<div class="pdoth">${backHtml(dk.pile.length)}<span class="small dim">덱 순서는 GM 만 본다</span></div>`;
  return `<div class="ph-dk">${canFind||own?`<div class="pdq"><input type="text" placeholder="카드 이름 · 종류 · 효과로 찾기" value="${esc(PV.q)}" data-pdq></div>`:''}
   <div class="ph-sec">버린 카드 <small>${dk.disc.length}장 · 최근 것부터</small><span class="sp"></span>${own&&dk.disc.length?`<button class="btn xs ghost" data-pd="discall" data-to="hand">전부 손패로</button><button class="btn xs ghost" data-pd="discall" data-to="pile">전부 덱에 섞기</button>`:''}</div>
   ${zbar('disc')}<div class="pdhand mini">${disc.map(([c,i])=>zcard('disc',c,i)).join('')||'<span class="small dim">없음</span>'}</div>
   <div class="ph-sec">제외 <small>${dk.out.length}장</small></div>${zbar('out')}<div class="pdhand mini">${out.map(([c,i])=>zcard('out',c,i)).join('')||'<span class="small dim">없음</span>'}</div>
   <div class="ph-sec">덱 <small>${dk.pile.length}장${own?' · 위부터 (나만)':''}</small><span class="sp"></span>${canFind?`<input type="number" class="n xs" min="1" max="10" value="3" data-pdpk><button class="btn xs ghost" data-pd="peek">엿보기</button>`:''}<button class="btn xs ghost" data-pd="shuffle">섞기</button>${own?`<button class="btn xs ghost danger ${PV.arm==='reset'?'arm':''}" data-pd="reset">${PV.arm==='reset'?'한 번 더 누르면 리셋':'덱 리셋'}</button>`:''}</div>
   ${own?zbar('pile'):''}${pile}</div>`}
 function logTab(dk,own){const L=dk.log.slice().reverse();const tm=t=>{const d=new Date(t);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
  return `<div class="ph-dk"><div class="ph-sec">최근 기록 <small>${L.length}</small><span class="sp"></span>${own&&L.length?'<button class="btn xs ghost" data-pd="logclear">기록 지우기</button>':''}</div><div class="pdlog">${L.map(x=>`<div><small>${tm(x.t)}</small>${esc(x.x)}</div>`).join('')||'<div class="ph-empty sm">아직 없다</div>'}</div></div>`}
 const arm=k=>{if(PV.arm===k&&Date.now()-PV.armT<4000){PV.arm='';return true}PV.arm=k;PV.armT=Date.now();setTimeout(()=>{if(PV.arm===k&&Date.now()-PV.armT>=3900){PV.arm='';redrawSoon()}},4000);return false};
 function bindPhone(md,redraw,t){redrawFn=redraw;const cd=curDeck();const H=holderOf(t);
  md.querySelectorAll('[data-pd]').forEach(b=>{const ev=b.tagName==='SELECT'?'onchange':'onclick';b[ev]=async e=>{e.stopPropagation();const a=b.dataset.pd;const did=cd&&cd[0],dk=cd&&cd[1];const hand=dk?(dk.hands[H]||[]):[];
   switch(a){
    case 'seed':{if(!gm())return;await A().set(['deck2'],seedDb());return redraw()}
    case 'mkdeck':{await importMakerDecks();return redraw()}
    case 'newdeck':{const n=prompt('새 덱 이름','내 덱');if(n==null)return;await run({op:'deckNew',name:n});return redraw()}
    case 'deck':PV.deck=b.value;PV.sel=[];PV.zsel={};PV.peek=null;try{localStorage.setItem('om_deck_cur',PV.deck)}catch(x){}return redraw();
    case 'tab':PV.tab=b.dataset.v;PV.zsel={};return redraw();
    case 'mgr':return openMgr(did,t);
    case 'res':return run({op:'res',h:H,n:b.dataset.n,dv:+b.dataset.dv}).then(redraw);
    case 'draw':return run({op:'draw',h:H,n:+b.dataset.n}).then(redraw);
    case 'drawn':{const v=+(($('[data-pdn]',md)||{}).value)||1;PV.n=v;return run({op:'draw',h:H,n:v}).then(redraw)}
    case 'adj':PV.adj=(+PV.adj||0)+(+b.dataset.dv);return redraw();
    case 'unsel':PV.sel=[];PV.adj=0;return redraw();
    case 'selall':PV.sel=hand.map((_,i)=>i);return redraw();
    case 'op':{const op=b.dataset.op;const sel=PV.sel.slice().sort((x,y)=>x-y);const p={op,h:H,sel,ids:sel.map(i=>hand[i])};
     if(op==='play')p.adj=+PV.adj||0;if(op==='give'){p.to=(($('[data-pdgive]',md)||{}).value)||'';PV.give=p.to}
     if(op==='play'&&dk.opt.cr){let cost=0;for(const c of p.ids){const v=num((dk.cards[c]||{}).c);if(v!=null)cost+=v}cost=Math.max(0,cost+p.adj);const have=+((dk.rv[H]||{})[dk.opt.cr]||0);const def=dk.res.find(r=>r.n===dk.opt.cr);
      if(cost>have&&def&&def.o&&!confirm(`${dk.opt.cr}이(가) ${cost-have} 모자라. 대신 ${def.o}이(가) ${cost-have} 오른다. 쓸까?`))return}
     PV.sel=[];PV.adj=0;await run(p);return redraw()}
    case 'mull':if(!arm('mull'))return redraw();return run({op:'mull',h:H}).then(redraw);
    case 'peekx':PV.peek=null;return redraw();
    case 'peek':{const n=+(($('[data-pdpk]',md)||{}).value)||3;await run({op:'peek',n});PV.tab='hand';return redraw()}
    case 'shuffle':return run({op:'shuffle'}).then(redraw);
    case 'reset':if(!arm('reset'))return redraw();return run({op:'reset'}).then(redraw);
    case 'discall':return run({op:'discAll',to:b.dataset.to,h:H}).then(redraw);
    case 'logclear':return run({op:'logClear'}).then(redraw);
    case 'zunsel':PV.zsel={};return redraw();
    case 'ztake':case 'zmove':{const z=b.dataset.z;const ids=Object.keys(PV.zsel).filter(k=>PV.zsel[k]&&k.startsWith(z+':')).map(k=>k.split(':')[2]);PV.zsel={};
     await run(a==='ztake'?{op:'take',from:z,ids,h:H}:{op:'zone',from:z,ids,to:b.dataset.to});return redraw()}
    case 'ptake':return run({op:'take',from:'pile',ids:[b.dataset.c],h:H}).then(redraw)}}});
  md.querySelectorAll('[data-pdc]').forEach(el=>el.onclick=e=>{e.stopPropagation();const i=+el.dataset.pdc;const k=PV.sel.indexOf(i);if(k>=0)PV.sel.splice(k,1);else PV.sel.push(i);redraw()});
  md.querySelectorAll('[data-pdz]').forEach(el=>el.onclick=e=>{e.stopPropagation();const k=el.dataset.pdz;const z=k.split(':')[0];for(const x in PV.zsel)if(!x.startsWith(z+':'))delete PV.zsel[x];PV.zsel[k]=!PV.zsel[k];redraw()});
  const q=$('[data-pdq]',md);if(q){q.oninput=()=>{PV.q=q.value};q.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){PV.q=q.value;redraw();setTimeout(()=>{const n=$('[data-pdq]');if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length)}},0)}};q.onblur=()=>{if(PV.q!==q.dataset.v){q.dataset.v=PV.q;redraw()}}}}

 /* ---------- 덱 관리 창 (맵툴 「카드 편집」 · 「설정」 탭) — 휴대폰을 덮고, 닫으면 휴대폰으로 ---------- */
 const MG={tab:'cards',edit:null,form:null,bulk:'',json:''};
 function openMgr(did,t){const db=DB();if(!db)return;const raw=(db.decks||{})[did];if(!raw)return;const dk=fixDeck(clone(raw));const own=isOwner(dk,me(),gm());
  const back=()=>{A().closeModal();if(window.OM_PHONE_UI)window.OM_PHONE_UI.open('deck')};
  const re=()=>openMgr(did,t);
  const go=async p=>{p.d=did;const r=await run(p);if(r&&r.newId&&gm()){PV.deck=r.newId;return openMgr(r.newId,t)}setTimeout(re,gm()?0:700);return r};
  const tabs=[['cards','카드 편집'],['opt','설정 · 자원'],['deck','덱 관리']].filter(([k])=>own||k==='cards');if(!tabs.some(x=>x[0]===MG.tab))MG.tab='cards';
  const where=cid=>{const n=a=>a.filter(x=>x===cid).length;let h=0;for(const k in dk.hands)h+=n(dk.hands[k]);return {p:n(dk.pile),d:n(dk.disc),o:n(dk.out),h}};
  let body='';
  if(MG.tab==='cards'){const f=MG.form||(MG.edit&&dk.cards[MG.edit]?Object.assign({},dk.cards[MG.edit]):{n:'',t:'',c:'',x:'',img:'',col:'gray',q:1});MG.form=f;
   const rows=dk.order.map((cid,i)=>{const c=dk.cards[cid];if(!c)return '';const w=where(cid);
    return `<tr class="${MG.edit===cid?'on':''}"><td><span class="dmsw" style="background:${colOf(c.col)}"></span><b class="lnk" data-mg="edit" data-c="${cid}">${esc(c.n)}</b><div class="small dim">${esc(c.t||'')}</div></td><td class="mono">${esc(c.c??'')}</td>
     <td class="nw">${own?`<button class="btn xs ghost" data-mg="qty" data-c="${cid}" data-dv="-1">−</button>`:''}<b class="mono">${c.q}</b>${own?`<button class="btn xs ghost" data-mg="qty" data-c="${cid}" data-dv="1">＋</button>`:''}</td>
     <td class="small dim nw">${own?`덱 ${w.p} · 버림 ${w.d} · 제외 ${w.o} · 손패 ${w.h}`:''}</td>${own?`<td class="nw"><button class="btn xs ghost" data-mg="mv" data-c="${cid}" data-dv="-1" ${i?'':'disabled'}>↑</button><button class="btn xs ghost" data-mg="mv" data-c="${cid}" data-dv="1" ${i<dk.order.length-1?'':'disabled'}>↓</button></td>`:''}</tr>`}).join('');
   const total=dk.order.reduce((a,c)=>a+(+(dk.cards[c]||{}).q||0),0);
   body=`<div class="dmgrid"><div><div class="small dim" style="margin-bottom:6px">카드 ${dk.order.length}종 · ${total}장 ${own?'· 이름을 누르면 오른쪽에서 고친다 · 장수를 늘리면 덱에 넣고 섞는다, 줄이면 덱 → 버림 → 제외 → 손패 순으로 뺀다':''}</div>
     <table class="t dmt"><tr><th>카드</th><th>비용</th><th>장수</th>${own?'<th>어디에</th><th></th>':'<th></th>'}</tr>${rows||'<tr><td colspan="5" class="dim">아직 카드가 없다</td></tr>'}</table></div>
    ${own?`<div class="dmform"><div class="sec">${MG.edit&&dk.cards[MG.edit]?'카드 고치기':'새 카드'}${MG.edit?'<span class="sp"></span><button class="btn xs ghost" data-mg="new">＋ 새 카드로</button>':''}</div>
     <div class="stform"><label>이름<input type="text" id="mf_n" value="${esc(f.n)}" placeholder="예) 상처약"></label><label>종류<input type="text" id="mf_t" value="${esc(f.t)}" placeholder="예) 도구 · 전술 · 이벤트"></label><label title="은열쇠 · 스킬 체크에 바칠 때 맞춰 보는 자질 — 지시 · 육성 · 통솔 · 능력 · ★ (1~2개)">아이콘<input type="text" id="mf_ic" value="${esc(f.ic||'')}" placeholder="예) 지시 통솔 · ★"></label>
      <label>비용<input type="text" id="mf_c" value="${esc(f.c??'')}" placeholder="숫자 · 비우면 없음"></label><label>장수<input type="number" class="n" id="mf_q" min="0" max="99" value="${+f.q||0}"></label>
      <label class="wide">색<span class="dmpal">${PAL.map(p=>`<button type="button" class="dmc ${f.col===p[0]?'on':''}" data-mgc="${p[0]}" style="background:${p[1]}" title="${p[2]}"></button>`).join('')}</span></label>
      <label class="wide">효과<textarea id="mf_x" rows="5" placeholder="카드 효과 · 여러 줄 가능">${esc(f.x)}</textarea></label>
      <label class="wide">자동화 구문 <span class="note">배틀에서 「🃏 카드」로 쓰면 이 구문이 돈다 · 비우면 효과 글만 로그에 (SP · 포텐셜과 같은 구문)</span><textarea id="mf_a" rows="3" style="font-family:var(--mono);font-size:12.5px" placeholder="예) 회복 1/4 아군1체 · 랭크 공격+1 임시 자신 · 상태확률 마비 30% 상대1체">${esc(f.a&&f.a.dsl||'')}</textarea><div class="small" id="mf_ap" style="white-space:pre-wrap"></div><details class="spgen"><summary class="small">⚙ 생성기 — 골라서 구문 만들기</summary><div id="mf_ag"></div></details></label>
      <label class="wide">그림<span class="row" style="gap:6px"><input type="text" id="mf_i" value="${esc(f.img)}" placeholder="https://… (비워도 된다)" style="flex:1"><label class="btn sm ghost">올리기<input type="file" id="mf_f" accept="image/*" hidden style="display:none"></label></span></label></div>
     <div class="dmprev" id="mf_p">${cardHtml(f)}</div>
     <div class="row" style="margin-top:8px">${MG.edit&&dk.cards[MG.edit]?`<button class="btn sm ghost danger" data-mg="del">삭제</button><button class="btn sm ghost" data-mg="dup">복제</button><span class="sp"></span><button class="btn pri" data-mg="save">저장</button>`:'<span class="sp"></span><button class="btn pri" data-mg="save">덱에 추가</button>'}</div>
     <div class="sec" style="margin-top:14px">여러 장 한꺼번에 <span class="note">한 줄에 한 장: 이름 | 종류 | 비용 | 장수 | 효과 | 색 (엑셀에서 붙여 넣은 탭도 된다)</span></div>
     <textarea id="mf_b" rows="4" placeholder="상처약 | 도구 | 1 | 3 | HP 를 20 회복한다 | 초록">${esc(MG.bulk)}</textarea><div class="row"><span class="small dim" id="mf_bp"></span><span class="sp"></span><button class="btn sm" data-mg="bulk">한꺼번에 넣기</button></div></div>`:`<div class="dmform"><div class="small dim">카드를 고치는 건 GM(덱 주인)만 한다.</div><div class="pdhand">${dk.order.map(c=>cardHtml(dk.cards[c],{badge:'×'+dk.cards[c].q})).join('')}</div></div>`}</div>`}
  else if(MG.tab==='opt'){const o=MG.optDraft&&MG.resDid===did?Object.assign({},dk.opt,MG.optDraft):dk.opt;const ck=(k,n,tip)=>`<label class="dmck" title="${esc(tip)}"><input type="checkbox" data-mo="${k}" ${o[k]?'checked':''}> ${n}</label>`;
   body=`<div class="dmopt">${ck('pv','플레이어에게 보이기','끄면 GM(덱 주인)만 이 덱을 본다')}${ck('dp','뽑은 카드 공개','켜면 뽑은 카드 이름 · 효과가 채팅에 나온다')}${ck('hp','손패 공개','켜면 모두가 서로의 손패를 본다')}${ck('ar','덱이 비면 버린 카드 섞기','뽑을 때 덱이 비어 있으면 버린 카드를 섞어 다시 채운다')}${ck('ps','플레이어도 찾기','플레이어도 덱에서 카드를 찾아 가져오고 엿볼 수 있다')}${ck('pk','패널티 (은열쇠)','덱이 바닥나거나 빈사가 되면 증상 카드를 섞는다 · 부상 1장 · 중상 2장 덱 맨 위 버리기 · 코스트가 모자라면 그만큼 덱 맨 위 버리기 · 긴 휴식에 증상 1장 빼기')}${ck('fl','손패 한도까지 채우기','배틀 시작 · 휴식 뽑기 때 정해진 장수 대신 손패 한도가 될 때까지 뽑는다')}</div>
    <div class="row" style="gap:14px;margin:8px 0"><label>한 번에 뽑기 최대 <input type="number" class="n" id="mo_md" min="1" max="30" value="${o.md}"></label><label>손패 한도 <input type="number" class="n" id="mo_hl" min="0" max="99" value="${o.hl}" title="0 = 없음"></label><label>비용 자원 <select id="mo_cr"><option value="">없음</option>${dk.res.map(r=>`<option ${o.cr===r.n?'selected':''}>${esc(r.n)}</option>`).join('')}</select></label></div>
    <div class="row" style="gap:14px;margin:0 0 8px;flex-wrap:wrap" title="11-01 은열쇠 박자 드로우 — GM 화면이 켜져 있을 때 저절로 뽑아 준다"><label>배틀 시작에 <input type="number" class="n" id="mo_bd" min="0" max="5" value="${+o.bd||0}">장</label><label>시작 손패 <input type="number" class="n" id="mo_sd" min="0" max="5" value="${+o.sd||0}" title="던전에 들어갈 때 손패가 비어 있으면 · 긴 휴식 뒤 이만큼 뽑는다 (0 = 안 함)">장</label><label title="증상 카드가 들어올 칸 — 가득 찬 뒤 또 들어와야 하면 퇴장(던전 이탈)">증상 칸 <input type="number" class="n" id="mo_pc" min="0" max="9" value="${o.pc==null?2:+o.pc}">장</label><label>바닥나 섞으면 +1 <select id="mo_rp"><option value="">없음</option>${dk.res.map(r=>`<option ${o.rp===r.n?'selected':''}>${esc(r.n)}</option>`).join('')}</select></label>${own?`<span class="sp"></span><button class="btn sm" data-mg="skpre" title="손패 4 · 박자마다 4장까지 · 코스트 5 · 패널티(증상 칸 2) · 증상 카드 넣기 · 공통 카드 코스트 채우기">🗝 은열쇠 기본값</button>${gm()?'<button class="btn sm ghost" data-mg="skpreall" title="트레이너가 손패 주인인 모든 덱에">모든 덱에</button>':''}`:''}</div>
    <div class="sec">자원 <span class="note">손패 주인마다 따로 · 「대신 오르는 자원」 = 비용이 모자랄 때 모자란 만큼 오르는 자원 (예: 은열쇠 → 광기) · 단계 알림은 한 줄에 「숫자: 문구」 · 「| 카드 이름」을 붙이면 그 단계를 넘을 때 그 카드 1장을 덱에 섞는다 (은열쇠 광기 카드)</span></div>
    <div id="mo_res">${(MG.resDraft&&MG.resDid===did?MG.resDraft:dk.res).map((r,i)=>resRow(r,i,dk)).join('')}</div><div class="row"><button class="btn sm ghost" data-mg="resadd">＋ 자원</button><span class="sp"></span><button class="btn pri" data-mg="optsave">설정 · 자원 저장</button></div>
    <div class="sec" style="margin-top:14px">손패 주인 <span class="note">빼면 그 손패는 버린 카드로</span></div>
    <table class="t">${dk.holders.map(h=>`<tr><td><b>${esc(hName(h))}</b></td><td class="small">${(dk.hands[h]||[]).length}장 · ${dk.res.map(r=>esc(r.n)+' '+((dk.rv[h]||{})[r.n]??r.s)).join(' · ')}</td><td class="nw"><button class="btn xs ghost" data-mg="rvreset" data-h="${esc(h)}">이것만 시작값으로</button><button class="btn xs ghost danger" data-mg="hdel" data-h="${esc(h)}">빼기</button></td></tr>`).join('')||'<tr><td class="dim">아직 없다 — 손패를 처음 쓰면 저절로 들어온다</td></tr>'}</table>
    <div class="row" style="margin-top:6px"><select id="mo_h"><option value="">— 트레이너 —</option>${Object.values(T()).filter(x=>!dk.holders.includes(x.id)).map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select><input type="text" id="mo_hn" placeholder="또는 NPC 이름" style="width:140px"><button class="btn sm" data-mg="hadd">＋ 손패 주인</button><span class="sp"></span><button class="btn sm ghost" data-mg="rvall">모두 시작값으로</button></div>`}
  else{const ex=JSON.stringify({format:'maptool-deck',v:2,name:dk.name,cards:dk.cards,order:dk.order,opt:dk.opt,res:dk.res},null,1);
   body=`<div class="row" style="gap:8px;flex-wrap:wrap"><input type="text" id="md_n" value="${esc(dk.name)}" style="width:200px"><button class="btn sm" data-mg="rename">이름 바꾸기</button><span class="sp"></span>${gm()?`<button class="btn sm ${(db.cur===did)?'pri':''}" data-mg="cur" ${(db.cur===did)?'disabled':''}>${db.cur===did?'플레이어 기본 덱':'플레이어 기본 덱으로'}</button>`:''}</div>
    <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn sm" data-mg="dnew">＋ 새 덱</button><button class="btn sm" data-mg="dcopy">이 덱 복제</button><button class="btn sm ghost ${PV.arm==='mreset'?'arm':''}" data-mg="dreset">${PV.arm==='mreset'?'한 번 더 누르면 리셋':'덱 리셋 (모든 카드 모아 섞기)'}</button><button class="btn sm ghost ${PV.arm==='mresetr'?'arm':''}" data-mg="dresetr">${PV.arm==='mresetr'?'한 번 더 누르면 리셋':'덱 리셋 + 자원 시작값'}</button><span class="sp"></span><button class="btn sm ghost danger ${PV.arm==='mdel'?'arm':''}" data-mg="ddel">${PV.arm==='mdel'?'한 번 더 누르면 삭제':'덱 삭제'}</button></div>
    <div class="sec" style="margin-top:14px">내보내기 <span class="note">맵툴 Lib:Deck 과 같은 꼴 (maptool-deck v2)</span><span class="sp"></span><button class="btn xs" data-mg="copyx">복사</button><button class="btn xs" data-mg="dlx">파일로</button></div><textarea id="md_x" rows="5" readonly style="width:100%;font-size:11px">${esc(ex)}</textarea>
    <div class="sec">가져오기 <span class="note">내보낸 JSON 을 붙여 넣거나 파일을 고른다</span></div><textarea id="md_i" rows="4" style="width:100%;font-size:11px" placeholder='{"format":"maptool-deck","v":2,…}'>${esc(MG.json)}</textarea>
    <div class="row"><label class="btn sm ghost">파일 고르기<input type="file" id="md_if" accept=".json,application/json" hidden style="display:none"></label><span class="sp"></span><button class="btn sm" data-mg="impnew">새 덱으로 가져오기</button><button class="btn sm ghost ${PV.arm==='mimp'?'arm':''}" data-mg="imprep">${PV.arm==='mimp'?'한 번 더 누르면 덮어쓰기':'이 덱을 덮어쓰기'}</button></div>`}
  const md=A().openModal(`<div class="mhead"><h2>덱 관리 — ${esc(dk.name)}</h2><span class="small dim">${dk.own?esc(hName(dk.own))+'의 덱':'GM 덱'}${!gm()?' · 바꾸면 GM 화면이 적용한다':''}</span><span class="sp"></span><button class="btn ghost" data-mg="back">‹ 휴대폰으로</button></div>
   <div class="stabs dmtabs">${tabs.map(([k,n])=>`<button class="stab ${MG.tab===k?'on':''}" data-mgt="${k}">${n}</button>`).join('')}</div>${body}`);
  md.classList.add('dmmodal');
  const bg=md.parentElement;if(bg)bg.onclick=e=>{if(e.target===bg)back()};
  md.querySelectorAll('[data-mgt]').forEach(b=>b.onclick=()=>{MG.tab=b.dataset.mgt;MG.resDraft=null;MG.optDraft=null;re()});
  /* 카드 폼 */
  const rd=()=>{const g=id=>($('#'+id,md)||{}).value;if(!$('#mf_n',md))return;MG.form=Object.assign(MG.form||{},{n:g('mf_n'),ic:g('mf_ic')||'',t:g('mf_t'),c:g('mf_c'),q:+g('mf_q')||0,x:g('mf_x'),img:g('mf_i')});{const dsl=String(g('mf_a')||'').trim();const K=window.OM_FX;if(dsl){const r=K?K.parse(dsl):{ops:[],errs:[]};MG.form.a={dsl,ops:r.ops};const ap=$('#mf_ap',md);if(ap)ap.innerHTML=(r.ops.length?'미리보기: '+esc(K.unparse(r.ops).join(' / ')):'')+(r.errs&&r.errs.length?` <span style="color:var(--red)">모르는 줄: ${esc(r.errs.join(' / '))}</span>`:'')}else{MG.form.a=null;const ap=$('#mf_ap',md);if(ap)ap.innerHTML=''}}const p=$('#mf_p',md);if(p)p.innerHTML=cardHtml(MG.form)};
  ['mf_n','mf_t','mf_ic','mf_c','mf_q','mf_x','mf_i','mf_a'].forEach(id=>{const el=$('#'+id,md);if(el)el.oninput=rd});
  {const ta=$('#mf_a',md),gh=$('#mf_ag',md);if(ta&&gh&&window.OM_FX_UI&&window.OM_FX_UI.mountGen)window.OM_FX_UI.mountGen(gh,ta,{toast:t=>A().toast(t)});if(ta)rd()}
  md.querySelectorAll('[data-mgc]').forEach(b=>b.onclick=()=>{rd();MG.form.col=b.dataset.mgc;md.querySelectorAll('[data-mgc]').forEach(x=>x.classList.toggle('on',x===b));rd()});
  const ff=$('#mf_f',md);if(ff)ff.onchange=async()=>{const f=ff.files[0];if(!f)return;A().toast('올리는 중…');try{$('#mf_i',md).value=await window.OM_STORE.uploadImage(`rooms/${ST().room}/card_${Date.now().toString(36)}`,f);rd();A().toast('올렸다')}catch(e){A().toast(e.message)}};
  const bl=$('#mf_b',md);const parseBulk=s=>String(s||'').split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{const a=(l.includes('\t')?l.split('\t'):l.split('|')).map(x=>x.trim());return {n:a[0],t:a[1]||'',c:a[2]||'',q:a[3]===''||a[3]==null?1:+a[3],x:(a[4]||'').replace(/\\n/g,'\n'),col:a[5]||'',ic:a[6]||''}}).filter(r=>r.n);
  if(bl){const pv=()=>{MG.bulk=bl.value;const r=parseBulk(bl.value);$('#mf_bp',md).textContent=r.length?`${r.length}종 ${r.reduce((a,x)=>a+(isNaN(x.q)?1:x.q),0)}장 — ${r.slice(0,3).map(x=>x.n).join(', ')}${r.length>3?' …':''}`:''};bl.oninput=pv;pv()}
  /* 가져오기 파일 */
  const imf=$('#md_if',md);if(imf)imf.onchange=()=>{const f=imf.files[0];if(!f)return;const rdr=new FileReader();rdr.onload=()=>{MG.json=String(rdr.result||'');$('#md_i',md).value=MG.json};rdr.readAsText(f)};
  const mi=$('#md_i',md);if(mi)mi.oninput=()=>{MG.json=mi.value};
  md.querySelectorAll('[data-mg]').forEach(b=>b.onclick=async()=>{const a=b.dataset.mg,cid=b.dataset.c;
   switch(a){
    case 'back':return back();
    case 'edit':MG.edit=cid;MG.form=null;return re();
    case 'new':MG.edit=null;MG.form=null;return re();
    case 'qty':if(cid===MG.edit)MG.form=null;return go({op:'cardQty',cid,dv:+b.dataset.dv});
    case 'mv':return go({op:'cardMove',cid,dir:+b.dataset.dv});
    case 'save':{rd();const r=await go({op:'cardSave',cid:MG.edit&&dk.cards[MG.edit]?MG.edit:'',card:MG.form});if(r&&!r.err&&!r.queued){MG.edit=r.cid||MG.edit;MG.form=null}return}
    case 'dup':{rd();MG.edit=null;const f=Object.assign({},MG.form,{n:(MG.form.n||'')+' (복사)'});MG.form=null;return go({op:'cardSave',card:f})}
    case 'del':if(!confirm(`「${dk.cards[MG.edit].n}」을(를) 덱에서 지울까? (덱 · 버린 카드 · 손패에 있는 것까지 모두)`))return;{const c=MG.edit;MG.edit=null;MG.form=null;return go({op:'cardDel',cid:c})}
    case 'bulk':{const rows=parseBulk(bl.value);if(!rows.length)return A().toast('넣을 줄이 없어');MG.bulk='';return go({op:'bulk',rows})}
    case 'resadd':{const rs=readRes(md);rs.push({n:'',s:0,m:0,o:'',a:[]});MG.resDraft=rs;MG.resDid=did;MG.optDraft=readOpt(md);return re()}
    case 'resdel':{const rs=readRes(md);rs.splice(+b.dataset.i,1);MG.resDraft=rs;MG.resDid=did;MG.optDraft=readOpt(md);return re()}
    case 'optsave':{const o=readOpt(md);const res=readRes(md);MG.resDraft=null;MG.optDraft=null;
     if(res.length&&!o.cr&&res.some(r=>r.n===dk.opt.cr))o.cr=dk.opt.cr;return go({op:'opt',opt:o,res})}
    case 'skpre':return skPreset([did]).then(re);
    case 'skpreall':return skPreset(Object.keys((DB()||{}).decks||{}).filter(id=>((DB().decks[id]||{}).holders||[]).some(h=>T()[h]))).then(re);
    case 'rvreset':return go({op:'resReset',h:b.dataset.h});
    case 'rvall':return go({op:'resReset',all:1});
    case 'hdel':if(!confirm(`${hName(b.dataset.h)}을(를) 손패 주인에서 뺄까? (손패는 버린 카드로)`))return;return go({op:'holderDel',h:b.dataset.h});
    case 'hadd':{const h=$('#mo_h',md).value||($('#mo_hn',md).value.trim()?'npc:'+$('#mo_hn',md).value.trim():'');if(!h)return A().toast('누구를 넣을지 골라 줘');return go({op:'holderAdd',h})}
    case 'rename':return go({op:'deckRename',name:$('#md_n',md).value});
    case 'cur':return go({op:'deckCur'});
    case 'dnew':{const n=prompt('새 덱 이름','새 덱');if(n==null)return;return go({op:'deckNew',name:n})}
    case 'dcopy':return go({op:'deckNew',copy:did,name:dk.name+' 복사'});
    case 'dreset':if(!arm('mreset'))return re();return go({op:'reset'});
    case 'dresetr':if(!arm('mresetr'))return re();return go({op:'reset',res:1});
    case 'ddel':if(!arm('mdel'))return re();{const r=await run({op:'deckDel',d:did});if(r&&!r.err){PV.deck='';back()}return}
    case 'copyx':{const x=$('#md_x',md);x.select();try{await navigator.clipboard.writeText(x.value);A().toast('복사했다')}catch(e){document.execCommand('copy');A().toast('복사했다')}return}
    case 'dlx':{const blob=new Blob([$('#md_x',md).value],{type:'application/json'});const u=URL.createObjectURL(blob);const l=document.createElement('a');l.href=u;l.download=(dk.name||'deck')+'.json';document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);return}
    case 'impnew':{MG.json=$('#md_i',md).value;const r=await run({op:'import',json:MG.json,mode:'new'});if(r&&!r.err&&!r.queued){MG.json='';if(r.newId)return openMgr(r.newId,t)}return re()}
    case 'imprep':if(!arm('mimp'))return re();{MG.json=$('#md_i',md).value;const r=await go({op:'import',json:MG.json,mode:'replace'});if(r&&!r.err)MG.json='';return}}});
  md.querySelectorAll('[data-mgr-del]').forEach(b=>b.onclick=()=>{const rs=readRes(md);rs.splice(+b.dataset.mgrDel,1);MG.resDraft=rs;MG.resDid=did;MG.optDraft=readOpt(md);re()})}
 function resRow(r,i,dk){const src=r;const names=(MG.resDraft||dk.res).map(x=>x.n).filter(Boolean);
  return `<div class="dmres" data-ri="${i}"><input type="text" data-rk="n" value="${esc(src.n)}" placeholder="이름 (예: 은열쇠)" style="width:110px"><label>시작 <input type="number" class="n xs" data-rk="s" value="${+src.s||0}"></label><label>최대 <input type="number" class="n xs" data-rk="m" value="${+src.m||0}" title="0 = 없음"></label>
   <label>모자라면 <select data-rk="o"><option value="">—</option>${names.filter(n=>n!==src.n).map(n=>`<option ${src.o===n?'selected':''}>${esc(n)}</option>`).join('')}</select></label><button class="btn xs ghost danger" data-mgr-del="${i}">×</button>
   <textarea data-rk="a" rows="4" placeholder="단계 알림: 3: 정보 수집 불리 (한 줄에 하나 · 「| 카드 이름」을 붙이면 그 단계에 그 카드를 덱에 섞는다)">${esc((src.a||[]).map(x=>x.t+': '+(x.x||'')+(x.c?' | '+x.c:'')).join('\n'))}</textarea></div>`}
 function readOpt(md){const o={};md.querySelectorAll('[data-mo]').forEach(x=>o[x.dataset.mo]=x.checked?1:0);o.md=$('#mo_md',md).value;o.hl=$('#mo_hl',md).value;o.cr=$('#mo_cr',md).value;for(const k of ['bd','sd','rp','pc']){const el=$('#mo_'+k,md);if(el)o[k]=el.value}return o}
 function readRes(md){return [...md.querySelectorAll('.dmres')].map(el=>{const g=k=>(el.querySelector(`[data-rk="${k}"]`)||{}).value||'';
  return {n:g('n').trim(),s:+g('s')||0,m:+g('m')||0,o:g('o'),a:g('a').split('\n').map(l=>{const m=l.match(/^\s*(-?\d+)\s*[:：=]\s*(.+)$/);if(!m)return null;const [x,c]=m[2].split('|').map(v=>v.trim());return Object.assign({t:+m[1],x:x||''},c?{c}:{})}).filter(Boolean)}})}
 /* 예전 「덱」 버튼 · 단축키가 부르는 자리 */
 function open(){if(window.OM_PHONE_UI)return window.OM_PHONE_UI.open('deck')}
 /* ---------- 배틀에서 카드 쓰기 (10-26 망령) ----------
   트레이너 칸의 「🃏 카드 n」 → 그 트레이너(=덱 주인 holder) 손패 → 「사용」: 덱의 play(비용 · 버린 더미) + 카드에 자동화 구문이 있으면 SP 처럼 기준 포켓몬에서 돌린다.
   쓸 수 있는 덱: 지금 보는 덱(PV.deck) → 기본 덱 → 그 손패가 있는 덱 순 */
 function deckFor(H){const L=visDecks();const has=([,d])=>(d.hands[H]||[]).length;return L.find(x=>x[0]===PV.deck&&has(x))||L.find(x=>x[0]===(DB()||{}).cur&&has(x))||L.find(has)||L.find(([,d])=>(d.holders||[]).includes(H))||L.find(x=>x[0]===(DB()||{}).cur)||L[0]||null}
 function handCount(tid){const x=deckFor(tid);return x?(x[1].hands[tid]||[]).length:0}
 /* 10-26 망령: 제작기 덱 → 이 방 덱. 트레이너 시트의 「덱 관리」(t.deck=[{n,q}] · deckName) + 카드 DB(dbedit kind cards: 덱·이름·종류·비용·효과·색·그림·기본 장수·비고·자동화 구문)
    로스터(시트)의 트레이너마다 덱 'mk_<tid>' 를 새로 만든다(같은 덱이 있으면 카드 · 장수만 고치고 손패 · 자원은 둔다). GM 만 */
 async function importMakerDecks(){if(!gm())return;const R=((ST().state.roster||{}).trainers)||{};let rows=[];try{rows=await window.OM_STORE.makerDocs('dbedit')}catch(e){return A().toast('제작기 카드 DB 를 못 읽었다: '+e.message)}
  const byName={};for(const r of rows){const d=r.data||{};if(d.kind!=='cards'||d.deleted)continue;const row=d.row||[];if(row[1])byName[row[1]]=row}
  let mk=null;const ts=Object.values(R).filter(t=>t&&Array.isArray(t.deck)&&t.deck.length);
  if(!ts.length){try{mk=await A().loadMaker&&A().loadMaker(true)}catch(e){}}
  const list=ts.length?ts:[];if(!list.length)return A().toast('덱을 가진 트레이너가 없다 — 제작기 트레이너 시트 「덱 관리」에 카드를 넣고, 이 방에 파티를 다시 불러와 줘');
  let db=DB()?clone(DB()):seedDb();if(!DB()){db.decks={};db.cur=''}const K=window.OM_FX;let nd=0,nc=0,miss=[];
  for(const t of list){const id='mk_'+t.id;const old=db.decks[id]?fixDeck(db.decks[id]):null;const dk=old||blank(t.deckName||((t.name||'트레이너')+'의 덱'));dk.name=t.deckName||dk.name;ensureHolder(dk,t.id);
   const keep=new Set();for(const x of t.deck){const r=byName[x.n];if(!r){miss.push(x.n);continue}const cid='k'+[...x.n].reduce((h,c)=>((h*31+c.codePointAt(0))>>>0),7).toString(36);keep.add(cid);
    const dsl=String(r[9]||'').trim();const v={n:x.n,ic:String(r[10]||''),t:String(r[2]||''),c:r[3]==null?'':String(r[3]),x:String(r[4]||''),col:colKey(r[5]),img:String(r[6]||''),q:Math.max(0,+x.q||+r[7]||1)};if(dsl){const p=K?K.parse(dsl):{ops:[]};v.a={dsl,ops:p.ops}}
    const was=dk.cards[cid];const q0=was?(+was.q||0):0;dk.cards[cid]=Object.assign({},v,{q:q0});if(!dk.order.includes(cid))dk.order.push(cid);qtyAdj(dk,cid,v.q-q0);nc++}
   for(const cid of dk.order.slice())if(!keep.has(cid)&&String(cid).startsWith('k')){qtyAdj(dk,cid,-(+dk.cards[cid].q||0));dk.order=dk.order.filter(x=>x!==cid);delete dk.cards[cid];for(const z of ['pile','disc','out'])dk[z]=dk[z].filter(x=>x!==cid)}
   if(!old)dk.pile=shuffle(dk.pile);db.decks[id]=dk;if(!db.cur)db.cur=id;nd++}
  await A().set(['deck2'],db);A().toast(`제작기 덱 ${nd}개 · 카드 ${nc}종을 가져왔다${miss.length?` · 카드 DB 에 없는 것: ${[...new Set(miss)].slice(0,4).join(', ')}`:''}`);redrawSoon()}
 /* 손패 화면: 어두운 무대 위 부채꼴 손패 → 카드를 고르면 가운데로 크게 떠오르고 「사용」 */
 function bigCard(c){const col=colOf(c.col);const cost=c.c!==''&&c.c!=null;const auto=!!(c.a&&c.a.ops&&c.a.ops.length);
  return `<div class="hc" style="--hc:${col}"><div class="hc-in"><div class="hc-top"><b class="hc-n">${esc(c.n)}</b>${cost?`<span class="hc-cost">${esc(c.c)}</span>`:''}</div>
   <div class="hc-art" style="${c.img?`background-image:url('${cssu(c.img)}')`:''}">${c.img?'':`<span class="hc-mono">${esc([...(c.n||'?')][0])}</span>`}</div>
   ${c.t||c.ic?`<div class="hc-type">${icHtml(c)}<span>${esc(c.t||'')}</span></div>`:''}<div class="hc-x">${esc(c.x||'')}</div>${auto?'<div class="hc-auto" title="자동화 구문이 돈다">⚙ AUTO</div>':''}</div></div>`}
 function battleHand(tid,o){o=o||{};const x=deckFor(tid);const BU=window.OM_BATTLE_UI;if(!x){if(gm()&&confirm('이 방에 덱이 없다. 제작기 트레이너 시트의 덱을 가져올까?'))return importMakerDecks().then(()=>{if(deckFor(tid))battleHand(tid,o)});return A().toast('덱이 없다 — GM 이 휴대폰 「덱」에서 덱을 만들거나 제작기 덱을 가져와야 한다')}const [did,dk]=x;const hand=(dk.hands[tid]||[]).slice();
  document.querySelectorAll('.hand-ov').forEach(e=>e.remove());
  const ov=document.createElement('div');ov.className='hand-ov';const n=hand.length;const spread=Math.min(64,Math.max(28,520/Math.max(n,1)));const ang=Math.min(8,40/Math.max(n,1));
  const res=dk.opt.cr?`<span class="ho-res">${esc(dk.opt.cr)} <b>${esc(String(((dk.rv[tid]||{})[dk.opt.cr])??0))}</b></span>`:'';
  ov.innerHTML=`<div class="ho-bg"></div><div class="ho-head"><div><small>${esc(dk.name)}</small><h2>${esc(hName(tid))}의 손패</h2></div>${res}<span class="ho-cnt">${n}<small>장</small></span><span class="sp"></span><button class="ho-btn ho-grave" data-ho="grave" title="버린 카드(무덤) — 잘못 쓴 카드는 여기서 손패로 되돌린다">🪦 무덤 <b>${dk.disc.length}</b></button>${gm()?'<button class="ho-btn" data-ho="mk" title="제작기 트레이너 시트의 덱을 다시 맞춘다">📥 제작기</button>':''}<button class="ho-btn" data-ho="phone">덱 앱</button><button class="ho-btn" data-ho="x">✕</button></div>
   <div class="ho-stage"><div class="ho-focus"></div></div>
   <div class="ho-fan">${hand.map((cid,i)=>{const c=dk.cards[cid];if(!c)return '';const k=i-(n-1)/2;return `<div class="ho-slot" data-hi="${i}" style="--x:${k*spread}px;--r:${k*ang}deg;--y:${Math.abs(k)*Math.abs(k)*2.2}px;--d:${i*45}ms">${bigCard(c)}</div>`}).join('')||'<div class="ho-empty">손패가 비었다</div>'}</div>
   <div class="ho-gv"></div>
   <div class="ho-hint">카드를 골라 · 다시 누르거나 「사용」으로 쓴다 · 「무덤으로」는 효과 없이 버림 · Esc 닫기</div>`;
  document.body.appendChild(ov);requestAnimationFrame(()=>ov.classList.add('on'));
  let sel=-1;const focus=ov.querySelector('.ho-focus');
  const close=()=>{ov.classList.remove('on');ov.classList.add('off');setTimeout(()=>ov.remove(),280);document.removeEventListener('keydown',kd);if(o.onClose)try{o.onClose()}catch(e){}};
  const kd=e=>{if(e.key==='Escape')close()};document.addEventListener('keydown',kd);
  const pick=i=>{sel=i;ov.querySelectorAll('.ho-slot').forEach(s=>s.classList.toggle('sel',+s.dataset.hi===i));const c=dk.cards[hand[i]];
   focus.innerHTML=c?`<div class="ho-big">${bigCard(c)}</div><div class="ho-acts"><button class="ho-use" data-ho="use">사용</button><button class="ho-btn ho-dis" data-ho="discard" title="효과 · 비용 없이 버린 카드로">🪦 무덤으로</button><button class="ho-btn" data-ho="cancel">취소</button></div>`:'';ov.classList.toggle('picked',!!c)};
  ov.addEventListener('click',async e=>{const t=e.target;const h=t.closest('[data-ho]');const sl=t.closest('.ho-slot');
   if(h){const k=h.dataset.ho;if(k==='x')return close();if(k==='phone'){close();PV.deck=did;return open()}if(k==='mk'){close();await importMakerDecks();setTimeout(()=>battleHand(tid,o),300);return}if(k==='cancel'){sel=-1;focus.innerHTML='';ov.classList.remove('picked');ov.querySelectorAll('.ho-slot').forEach(s=>s.classList.remove('sel'));return}if(k==='use')return use(sel);if(k==='discard')return discard(sel);if(k==='grave')return grave();if(k==='back'){ov.classList.remove('gview');return}
    if(k==='revive'){const cid=h.dataset.cid;close();PV.deck=did;const r=await run({op:'take',d:did,h:tid,from:'disc',ids:[cid]});if(r&&r.err)return A().toast(r.err);A().toast(`「${(dk.cards[cid]||{}).n||''}」 을(를) 손패로 되돌렸다`);setTimeout(()=>battleHand(tid,o),350);return}}
   if(sl){const i=+sl.dataset.hi;if(i===sel)return use(i);return pick(i)}
   if(t.classList.contains('ho-bg')||t.classList.contains('ho-stage'))close()});
  /* 10-29 스킬 체크 창에서: 고른 카드를 바로 크게 · 무덤 칸부터 */
  if(o.grave)grave();else if(o.focus>=0&&hand[o.focus])pick(o.focus);
  async function discard(i){const cid=hand[i];const card=dk.cards[cid];if(!card)return;const big=ov.querySelector('.ho-big');if(big)big.classList.add('toss');await new Promise(r=>setTimeout(r,380));close();PV.deck=did;const r=await run({op:'discard',d:did,h:tid,sel:[i],ids:[cid]});if(r&&r.err)return A().toast(r.err);A().toast(`「${card.n}」 → 무덤 (효과 없음)`)}
  function grave(){const g=ov.querySelector('.ho-gv');const L=dk.disc.slice().reverse();g.innerHTML=`<div class="ho-gh"><b>🪦 무덤</b><small>${L.length}장 · 최근 것이 왼쪽 · 누르면 손패로 되돌린다 (잘못 쓴 카드 되돌리기 — 구문으로 바뀐 HP · 랭크는 배틀 화면에서 직접 되돌려 줘)</small><span class="sp"></span><button class="ho-btn" data-ho="back">손패로 돌아가기</button></div><div class="ho-grow">${L.map(cid=>dk.cards[cid]?`<button class="ho-gc" data-ho="revive" data-cid="${esc(cid)}">${bigCard(dk.cards[cid])}<span>↩ 손패로</span></button>`:'').join('')||'<div class="ho-empty">무덤이 비었다</div>'}</div>`;ov.classList.add('gview')}
  async function use(i){const cid=hand[i];const card=dk.cards[cid];if(!card)return;const hasA=!!(card.a&&card.a.ops&&card.a.ops.length);let anchor='';
   if(hasA&&o.pickAnchor){ov.style.visibility='hidden';anchor=await o.pickAnchor(tid);ov.style.visibility='';if(anchor===null)return}
   const big=ov.querySelector('.ho-big');if(big)big.classList.add('play');ov.classList.add('playing');await new Promise(r=>setTimeout(r,520));close();
   PV.deck=did;const head=`【카드】 ${hName(tid)} 『${card.n}』${card.c!==''&&card.c!=null?' (비용 '+card.c+')':''}`;
   /* 10-26 점검: 효과(구문)를 먼저 돌리고, 취소되면 카드도 비용도 그대로 둔다 (전엔 카드부터 소모돼 되돌릴 수 없었다) */
   if(hasA&&anchor&&BU&&BU.fireAuto){const okA=await BU.fireAuto(anchor,'pot',card.n,{auto:Object.assign({name:card.n,src:'card',text:card.x||''},card.a),quiet:true,noRoll:true,head,img:card.img||'',eff:card.x||''});if(okA===false){A().toast('카드 사용을 취소했다 — 카드는 손패에 남는다');setTimeout(()=>battleHand(tid,o),200);return}
    const r=await run({op:'play',d:did,h:tid,sel:[i],ids:[cid],adj:0});if(r&&r.err)return A().toast(r.err+' (효과는 이미 적용됐다)');if(window.OM_CUTIN)window.OM_CUTIN.fire({tok:'card:'+tid,src:card.img||'',tag:`${hName(tid)}의 카드!`,ment:`『${card.n}』`,color:colOf(card.col),line:card.t||'',gh:'CARD'});return}
   const r=await run({op:'play',d:did,h:tid,sel:[i],ids:[cid],adj:0});if(r&&r.err)return A().toast(r.err);
   if(window.OM_CUTIN)window.OM_CUTIN.fire({tok:'card:'+tid,src:card.img||'',tag:`${hName(tid)}의 카드!`,ment:`『${card.n}』`,color:colOf(card.col),line:card.t||'',gh:'CARD'});
   else if(hasA&&!anchor)A().toast(o.where==='dungeon'||o.where==='rp'?'배틀 밖이라 구문은 건너뛰고 효과 글만 남긴다 — HP 같은 건 시트에서 직접':'필드에 기준 포켓몬이 없어 구문은 건너뛰고 효과 글만 남긴다');
   await A().sysLog(`${head}${card.x?'\n'+card.x:''}`,o.where==='dungeon'||o.where==='rp'?'sys':'battle')}}
 /* 스킬 체크 창의 손패 줄 (작은 카드) */
 function handInfo(tid){const x=deckFor(tid);if(!x)return null;const [did,dk]=x;const cr=dk.opt.cr;
  const ex=exemptSet(did);return {did,name:dk.name,disc:dk.disc.length,load:handLoad(dk,did,tid),hl:+dk.opt.hl||0,res:cr?`${cr} ${((dk.rv[tid]||{})[cr])??0}`:'',cards:(dk.hands[tid]||[]).map(cid=>{const c=dk.cards[cid]||{};return {cid,n:c.n||'?',c:c.c,x:c.x||'',img:c.img||'',col:colOf(c.col),ic:icOf(c),ex:isExempt(dk,cid,ex)}})}}
 /* ---------- 11-01 망령 「은열쇠」 박자 드로우 · 기본값 · 체크에 바치기 ---------- */
 /* 그 트레이너의 덱: 제작기에서 가져온 자기 덱(mk_<id>) → 손패 주인으로 든 덱 */
 function deckIdOf(db,tid){const D=(db||{}).decks||{};if(D['mk_'+tid])return 'mk_'+tid;const L=Object.keys(D).filter(id=>(D[id].holders||[]).includes(tid));return L.find(id=>id===db.cur)||L[0]||''}
 /* GM 화면: kind = battle(배틀 시작 · 덱 설정 bd) · start(던전 시작 · 손패가 비었으면 sd) · rest(n 장 · 'reset' = 긴 휴식: 손패 · 버린 카드를 섞고 sd 장) */
 async function beat(kind,tids,n){if(!gm())return [];const db0=DB();if(!db0)return [];const db=clone(db0);const L=[];
  for(const tid of [...new Set(tids||[])]){const did=deckIdOf(db,tid);if(!did)continue;const dk=fixDeck(db.decks[did]);ensureHolder(dk,tid);let k=0;
   const fill=()=>Math.max(0,(+dk.opt.hl||0)-handLoad(dk,did,tid));   /* 11-01: 손패 한도가 될 때까지 */
   if(kind==='battle')k=dk.opt.fl&&+dk.opt.hl?fill():(+dk.opt.bd||0);
   else if(kind==='start'){if(!(+dk.opt.sd)||handLoad(dk,did,tid)>0)continue;k=+dk.opt.sd}
   else if(kind==='rest'){if(n==='reset'){const ex=exemptSet(did);const hand=dk.hands[tid]||[];const back=hand.filter(c=>!isExempt(dk,c,ex));dk.hands[tid]=hand.filter(c=>isExempt(dk,c,ex));const solo=(dk.holders||[]).length<=1;const disc=solo?dk.disc.filter(c=>!isExempt(dk,c,ex)):[];if(solo)dk.disc=dk.disc.filter(c=>isExempt(dk,c,ex));dk.pile=shuffle([...dk.pile,...back,...disc]);L.push(`〔${dk.name}〕 ${hName(tid)} · 긴 휴식 — 손패 ${back.length}장${solo?` · 버린 카드 ${disc.length}장`:''}을 덱에 섞음`);
    if(dk.opt.pk){for(const kd of ['scarOut','heal']){const R2=exec(db,{op:'pen',d:did,h:tid,kind:kd,why:'긴 휴식'},'gm',true);if(R2.pub&&R2.pub.length)L.push(`〔${dk.name}〕 ${R2.pub[0]}`)}}   /* 11-01: 긴 휴식에 증상 카드 1장 빼기 (옛 상흔은 전부) */
    {const cr=dk.opt.cr;const def=cr&&dk.res.find(r=>r.n===cr);if(def){const rv=dk.rv[tid];const b=+rv[cr]||0;const s0=+def.s||0;if(b!==s0){rv[cr]=s0;L.push(`〔${dk.name}〕 ${hName(tid)} · ${cr} ${b} → ${s0}`)}}}   /* 11-01: 코스트는 긴 휴식에만 처음 값으로 */
    k=+dk.opt.sd||3}else{k=Math.max(0,Math.floor(+n||0));if(k>0&&dk.opt.fl&&+dk.opt.hl)k=fill()}}
   if(k<=0)continue;const R=exec(db,{op:'draw',d:did,h:tid,n:k},'gm',true);if(R.err){L.push(`〔${dk.name}〕 ${hName(tid)} · ${R.err}`);continue}
   L.push(...R.pub.map(x=>`〔${dk.name}〕 ${x}`));if(R.msg&&/한도/.test(R.msg))L.push(`〔${dk.name}〕 ${hName(tid)} · 손패가 한도(${+dk.opt.hl}장)를 넘었다 — 골라 버린다`)}
  if(!L.length)return [];if(!await A().setDiff(['deck2'],db0,db,3)){A().toast('덱을 저장하지 못했다');return []}
  const head={battle:'배틀 시작',start:'시작 손패',rest:n==='reset'?'긴 휴식':'휴식'}[kind]||'';A().sysLog(`🃏 ${head} · 은열쇠 뽑기\n${L.join('\n')}`,'sys');redrawSoon();return L}
 /* 은열쇠 기본값 (11-01 개정): 손패 3 · 시작 3 · 배틀 시작 1 · 코스트 5(긴 휴식에 5로) · 패널티 카드(광기 칸 2) · 상흔 1종 · 광기 2종 · 공통 카드 코스트. 옛 「광기」 숫자 자원 · 「은열쇠」 자원은 뺀다 */
 const MAD0=[{n:'안개 속의 목소리',t:'증상',c:'2',x:'뽑으면 바로 공개한다. 손패 한 칸을 차지한다. 바칠 수 없다. 손패에 있는 동안 내 지시 체크 −1.\n치우기 — 통솔 체크(보통 10), 또는 코스트 2. 치워도 버린 카드로 갈 뿐 덱에 남는다.',col:'black'},
  {n:'뒤돌아본 그림자',t:'증상',c:'2',x:'뽑는 순간 경계도 +10. 그다음엔 손패 한 칸을 차지한다. 바칠 수 없다.\n치우기 — 통솔 체크(보통 10), 또는 코스트 2.',col:'black'}];
 const SCAR0=[];
 const COST0={'관찰 노트':1,'지도 펼치기':0,'다른 길로':2,'실타래 되감기':2,'응급 처치':2,'붕대와 진통제':1,'발소리 죽이기':3,'비상식량':1,'함께 버티자':1,'호흡 맞추기':1,'물러서!':1,'기세 올리기':1,'안개의 환영':2,'소금기 어린 부적':1,'손재주':2,'불러내기':0,'은빛 공명':1,'숨 고르기':1};
 async function skPreset(dids){if(!gm())return A().toast('GM 화면에서만');if(!dids.length)return A().toast('트레이너 덱이 없다');let mad=MAD0,scar=SCAR0;
  try{const rows=await window.OM_STORE.makerDocs('dbedit');const L=[],S=[];for(const r of rows){const d=r.data||{};if(d.kind!=='cards'||d.deleted)continue;const w=d.row||[];if(!w[1])continue;const c={n:w[1],t:String(w[2]||''),c:String(w[3]||''),x:String(w[4]||'').replace(/<br\s*\/?>/g,'\n'),col:colKey(w[5]||'black'),img:String(w[6]||'')};if(/광기|증상/.test(String(w[0]||''))){c.t=/광기|증상/.test(c.t)?c.t:'증상';L.push(c)}else if(/상흔/.test(String(w[0]||''))){c.t=/상흔/.test(c.t)?c.t:'상흔';S.push(c)}}if(L.length>=1)mad=L.slice(0,3);if(S.length)scar=S.slice(0,2)}catch(e){}
  const db0=DB();if(!db0)return;const db=clone(db0);let n=0;
  for(const did of dids){const dk0=db.decks[did];if(!dk0)continue;const dk=fixDeck(dk0);const keep=dk.res.filter(r=>!['광기','은열쇠','코스트'].includes(r.n));const old=dk.res.find(r=>r.n==='코스트');
   const res=[{n:'코스트',s:old&&+old.s||5,m:old&&+old.m||5,o:'',a:[]},...keep];
   exec(db,{op:'opt',d:did,opt:{hl:4,sd:4,bd:1,rp:'',ar:1,cr:'코스트',pk:1,pc:2,fl:1},res},'gm',true);
   for(const m of [...mad,...scar])if(!dk.order.some(id=>dk.cards[id]&&dk.cards[id].n===m.n))exec(db,{op:'cardSave',d:did,card:Object.assign({q:0},m)},'gm',true);
   for(const id of dk.order){const c=dk.cards[id];if(!c)continue;if(COST0[c.n]!=null&&(c.c==null||String(c.c).trim()===''))c.c=String(COST0[c.n]);if(/^(열쇠|key)/i.test(String(c.t||''))&&(c.c==null||String(c.c).trim()===''))c.c='2'}
   for(const h of dk.holders){ensureHolder(dk,h);const rv=dk.rv[h];delete rv['은열쇠'];delete rv['광기'];if(rv['코스트']==null)rv['코스트']=res[0].s}n++}
  if(!await A().setDiff(['deck2'],db0,db,3))return A().toast('저장하지 못했다');A().toast(`은열쇠 기본값을 덱 ${n}개에 맞췄다 — 손패 4 (박자마다 4장까지) · 코스트 5 · 증상 칸 2`)}
 /* 11-01 패널티 (GM 화면): kind = mad(빈사 · GM 사건 → 증상 카드) · mill({n}: 부상 1 · 중상 2) · unmill({ids}) · heal(증상 1장 빼기) · undo({cid}) → {cid,milled,collapse} */
 async function penalty(tid,kind,why,x){x=x||{};if(!gm())return null;const db0=DB();if(!db0)return null;const db=clone(db0);const did=deckIdOf(db,tid);if(!did)return null;const dk=fixDeck(db.decks[did]);if(!dk.opt.pk)return null;
  const before=JSON.stringify(Object.fromEntries(dk.order.map(id=>[id,+(dk.cards[id]||{}).q||0])));const R=exec(db,{op:'pen',d:did,h:tid,kind,why,cid:x.cid,n:x.n,ids:x.ids},'gm',true);if(R.err){A().toast(R.err);return null}if(!R.pub.length)return null;
  let added='';const b=JSON.parse(before);for(const id of dk.order)if((+(dk.cards[id]||{}).q||0)>(b[id]||0))added=id;
  if(!await A().setDiff(['deck2'],db0,db,3)){A().toast('덱을 저장하지 못했다');return null}A().sysLog(`🃏 〔${dk.name}〕 ${R.pub.join('\n')}`,'sys');redrawSoon();return {cid:kind==='mad'?added:'',milled:R.milled||[],collapse:!!(R.pen&&R.pen.collapse),line:R.pub[0]}}
 /* 스킬 체크에 바치기: 손패에서 그 카드를 버린 카드로 (효과 없이). 성공하면 카드 정보를 돌려준다 */
 async function commitCard(tid,cid,stat){const x=deckFor(tid);if(!x)return {err:'덱이 없다'};const [did,dk]=x;const hand=dk.hands[tid]||[];const i=hand.indexOf(cid);const c=dk.cards[cid];if(i<0||!c)return {err:'그 카드가 손패에 없다'};
  if(!icFits(c,stat))return {err:`「${c.n}」 은(는) ${stat} 아이콘이 없다`};const r=await run({op:'commit',d:did,h:tid,sel:[i],ids:[cid]});if(r&&r.err)return {err:r.err};return {n:c.n,ic:icOf(c).join(' '),did,cid}}
 return {open,absorb,phone,bindPhone,openMgr,exec,seedDb,onAck,handCount,handInfo,battleHand,importMakerDecks,beat,skPreset,commitCard,icOf,icFits,penalty};
})();
