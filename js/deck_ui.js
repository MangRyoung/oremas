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
 const OPT0={pv:1,dp:0,hp:0,ar:1,ps:0,sfx:1,md:10,hl:0,cr:''};
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
  const HOLDER_OPS=['draw','play','reveal','discard','top','bottom','give','exile','mull','res','take'];
  if(HOLDER_OPS.includes(op)){if(!H||H==='gm')return E('손패 주인을 골라 줘.');if(!isGm&&H!==who)return E('다른 사람의 손패는 건드릴 수 없어.');ensureHolder(dk,H)}
  const hand=HOLDER_OPS.includes(op)?dk.hands[H]:null;
  /* 손패에서 고른 카드 (인덱스와 카드 id 가 둘 다 맞아야 함) */
  let picked=[],pickIdx=[];
  if(['play','reveal','discard','top','bottom','give','exile'].includes(op)){const sel=p.sel||[],ids=p.ids||[];if(!sel.length)return E('카드를 먼저 골라 줘.');if(sel.length!==ids.length)return E('선택이 이상해. 다시 골라 줘.');
   const seen=new Set();for(let i=0;i<sel.length;i++){const ix=+sel[i];if(seen.has(ix))return E('같은 카드를 두 번 골랐어.');seen.add(ix);if(hand[ix]!==ids[i])return E('손패가 그새 바뀌었어. 다시 골라 줘.');picked.push(ids[i])}
   pickIdx=[...sel].map(Number).sort((a,b)=>b-a)}
  const names=picked.map(c=>'「'+cn(c)+'」').join(', ');const take=()=>{for(const ix of pickIdx)hand.splice(ix,1)};
  const logL=x=>{R.log=x;dk.log.push({t:Date.now(),x});if(dk.log.length>80)dk.log.splice(0,dk.log.length-80)};
  const resDef=n=>dk.res.find(r=>r.n===n);
  switch(op){
   case 'draw':{const n=Math.floor(+p.n||1);const mx=+dk.opt.md||10;if(n<1)return E('몇 장 뽑을지 1 이상으로 적어 줘.');if(n>mx)return E(`한 번에 ${mx}장까지만 뽑을 수 있어. (설정에서 바꿀 수 있어)`);
    const got=[];let rec=0;for(let i=0;i<n;i++){if(!dk.pile.length&&dk.disc.length&&dk.opt.ar){dk.pile=shuffle(dk.disc);dk.disc=[];rec=1}if(!dk.pile.length)break;const c=dk.pile.shift();got.push(c);hand.push(c)}
    if(!got.length)return E('덱에 남은 카드가 없어.');
    let line=`${by} · 카드 ${got.length}장 뽑음 (덱 ${dk.pile.length}장 남음)`;if(got.length<n)line+=`\n덱이 모자라서 ${got.length}장만 뽑았어.`;if(rec)line+='\n버린 카드를 섞어 덱을 다시 채웠어.';
    R.pub.push(dk.opt.dp?line+'\n'+got.map(c=>cardLine(cards[c])).join('\n'):line);logL(`${by} · ${got.length}장 뽑음`);R.drawn=got;
    R.msg=`${got.length}장 뽑았어: ${got.map(c=>'「'+cn(c)+'」').join(' ')}`;const hl=+dk.opt.hl||0;if(hl>0&&hand.length>hl)R.msg+=` · 손패가 한도(${hl}장)를 넘었어. 버릴 카드를 골라 줘.`;return R}
   case 'play':{/* 비용 자원이 모자라면 그 자원의 「대신 오르는 자원」이 모자란 만큼 오른다 (예: 은열쇠 대신 광기) */
    const cr=dk.opt.cr||'';let cost=0;for(const c of picked){const v=num((cards[c]||{}).c);if(v!=null)cost+=v}if(num(p.adj)!=null)cost=Math.max(0,cost+num(p.adj));
    const rv=dk.rv[H];let costLine='',ovLine='',ovAlerts=[];
    if(cr){const def=resDef(cr);const have=+rv[cr]||0;const short=Math.max(0,cost-have);const ov=def&&def.o;if(short>0&&!ov)return E(`${cr}이(가) 모자라. 필요 ${cost}, 남은 ${have}`);
     const pay=cost-short;rv[cr]=have-pay;if(pay)costLine=`\n${cr} ${have} → ${have-pay}`;
     if(short>0){const od=resDef(ov);const b=+rv[ov]||0;const a2=clampRes(od,b+short);rv[ov]=a2;ovLine=`\n${cr}이(가) 모자라서 ${ov} ${b} → ${a2}`;ovAlerts=alerts(od,b,a2)}}
    take();dk.disc.push(...picked);
    R.pub.push(`${by} · 카드 사용${cost&&cr?` (비용 ${cost})`:''}${costLine}${ovLine}${ovAlerts.length?'\n'+ovAlerts.join('\n'):''}\n${picked.map(c=>cardLine(cards[c])).join('\n')}`);logL(`${by} · ${names} 사용${ovLine?' ('+ovLine.trim().replace(/.*\s(\S+ \d+ → \d+)$/,'$1')+')':''}`);R.msg=`${names} 사용했어.`;return R}
   case 'reveal':R.pub.push(`${by} · 손패 공개\n${picked.map(c=>cardLine(cards[c])).join('\n')}`);logL(`${by} · ${names} 공개`);R.msg='모두에게 보여 줬어.';return R;
   case 'discard':take();dk.disc.push(...picked);R.pub.push(`${by} · 버림: ${names}`);logL(`${by} · ${names} 버림`);R.msg='버렸어.';return R;
   case 'exile':take();dk.out.push(...picked);R.pub.push(`${by} · 제외: ${names}`);logL(`${by} · ${names} 제외`);R.msg='제외했어.';return R;
   case 'top':take();dk.pile.unshift(...picked.slice().reverse());R.pub.push(`${by} · ${picked.length}장을 덱 맨 위로`);logL(`${by} · ${picked.length}장 덱 위로`);R.msg='덱 맨 위에 올렸어.';return R;
   case 'bottom':take();dk.pile.push(...picked);R.pub.push(`${by} · ${picked.length}장을 덱 맨 아래로`);logL(`${by} · ${picked.length}장 덱 아래로`);R.msg='덱 맨 아래에 넣었어.';return R;
   case 'give':{const to=p.to;if(!to||to===H)return E('받을 사람을 골라 줘.');ensureHolder(dk,to);take();dk.hands[to].push(...picked);R.pub.push(`${by} → ${hName(to)} · 카드 ${picked.length}장 건넴${dk.opt.hp?'\n'+picked.map(c=>cardLine(cards[c])).join('\n'):''}`);logL(`${by} → ${hName(to)} · ${picked.length}장`);R.msg=`${hName(to)}에게 건넸어.`;return R}
   case 'mull':{const n=hand.length;if(!n)return E('손패가 비어 있어.');dk.pile=shuffle([...dk.pile,...hand]);dk.hands[H]=[];R.pub.push(`${by} · 손패 ${n}장을 덱에 섞음`);logL(`${by} · 손패 ${n}장 섞음`);R.msg='손패를 덱에 섞었어.';return R}
   case 'res':{const def=resDef(p.n);if(!def)return E('그 자원이 없어.');const rv=dk.rv[H];const b=+rv[def.n]||0;let a2=p.v!=null?clampRes(def,p.v):clampRes(def,b+(+p.dv||0));if(a2<0&&!def.neg)a2=Math.max(a2,-999);if(a2===b)return R;rv[def.n]=a2;
    const al=alerts(def,b,a2);R.pub.push(`${by} · ${def.n} ${b} → ${a2}${al.length?'\n'+al.join('\n'):''}`);logL(`${by} · ${def.n} ${b}→${a2}`);R.quiet=!al.length&&!p.loud;return R}
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
    const v={n,t:String(c.t||'').slice(0,30),c:c.c==null?'':String(c.c).slice(0,8),x:String(c.x||'').slice(0,2000),img:String(c.img||'').slice(0,600),col:colKey(c.col),q:Math.max(0,Math.min(99,Math.floor(+c.q||0))),a:c.a&&c.a.dsl?{dsl:String(c.a.dsl).slice(0,1500),ops:Array.isArray(c.a.ops)?c.a.ops:[]}:null};if(!v.a)delete v.a;
    if(p.cid&&cards[p.cid]){const dv=v.q-(+cards[p.cid].q||0);cards[p.cid]=Object.assign({},cards[p.cid],v,{q:cards[p.cid].q});const fh=qtyAdj(dk,p.cid,dv);R.msg=`「${n}」 고쳤어.${fh?` (손패에서 ${fh}장 빠짐)`:''}`;R.cid=p.cid}
    else{const id='c'+(++db.seq);cards[id]=Object.assign({},v,{q:0});dk.order.push(id);qtyAdj(dk,id,v.q);R.cid=id;R.msg=`「${n}」 ${v.q}장을 덱에 넣고 섞었어.`}return R}
   case 'cardQty':{if(!own)return E('이 덱을 고칠 권한이 없어.');if(!cards[p.cid])return E('그 카드가 없어.');const fh=qtyAdj(dk,p.cid,+p.dv||0);R.msg=`「${cn(p.cid)}」 ${cards[p.cid].q}장${fh?` (손패에서 ${fh}장 빠짐)`:''}`;return R}
   case 'cardDel':{if(!own)return E('이 덱을 고칠 권한이 없어.');if(!cards[p.cid])return E('그 카드가 없어.');const nm=cn(p.cid);qtyAdj(dk,p.cid,-(+cards[p.cid].q||0));for(const z of ['pile','disc','out'])dk[z]=dk[z].filter(x=>x!==p.cid);for(const h in dk.hands)dk.hands[h]=dk.hands[h].filter(x=>x!==p.cid);delete cards[p.cid];dk.order=dk.order.filter(x=>x!==p.cid);R.msg=`「${nm}」 지웠어.`;return R}
   case 'cardMove':{if(!own)return E('이 덱을 고칠 권한이 없어.');const i=dk.order.indexOf(p.cid),j=i+(+p.dir||0);if(i<0||j<0||j>=dk.order.length)return R;[dk.order[i],dk.order[j]]=[dk.order[j],dk.order[i]];return R}
   case 'bulk':{if(!own)return E('이 덱을 고칠 권한이 없어.');const rows=(p.rows||[]).filter(r=>r&&nameOk(r.n));if(!rows.length)return E('넣을 카드가 없어.');let total=0;
    for(const r of rows){const id='c'+(++db.seq);cards[id]={n:nameOk(r.n),t:String(r.t||'').slice(0,30),c:r.c==null?'':String(r.c).slice(0,8),x:String(r.x||''),img:'',col:colKey(r.col),q:0};dk.order.push(id);const q=Math.max(0,Math.min(99,Math.floor(r.q==null?1:+r.q)));qtyAdj(dk,id,q);total+=q}
    R.msg=`카드 ${rows.length}종 ${total}장을 넣고 섞었어.`;R.pub.push(`덱 「${dk.name}」에 카드 ${rows.length}종 ${total}장 추가`);return R}
   /* ---- 덱 관리 · 설정 ---- */
   case 'deckRename':{if(!own)return E('이 덱을 고칠 권한이 없어.');const n=nameOk(p.name);if(!n)return E('이름을 적어 줘.');dk.name=n===dk.name?n:uniq(n);R.msg='이름을 바꿨어.';return R}
   case 'deckDel':{if(!own)return E('이 덱을 지울 권한이 없어.');if(Object.keys(db.decks).length<2)return E('마지막 덱은 지울 수 없어.');const nm=dk.name;delete db.decks[p.d];if(db.cur===p.d)db.cur=Object.keys(db.decks)[0];R.msg=`「${nm}」 덱을 지웠어.`;R.pub.push(`덱 「${nm}」 삭제`);return R}
   case 'deckCur':if(!isGm)return E('GM 만 정할 수 있어.');db.cur=p.d;R.msg=`「${dk.name}」을(를) 플레이어 기본 덱으로 했어.`;return R;
   case 'opt':{if(!own)return E('이 덱을 고칠 권한이 없어.');const o=p.opt||{};const no=Object.assign({},dk.opt);for(const k of ['pv','dp','hp','ar','ps','sfx'])if(o[k]!=null)no[k]=o[k]?1:0;
    if(o.md!=null)no.md=Math.max(1,Math.min(30,Math.floor(+o.md||10)));if(o.hl!=null)no.hl=Math.max(0,Math.min(99,Math.floor(+o.hl||0)));if(o.cr!=null)no.cr=String(o.cr);
    if(Array.isArray(p.res)){const names=new Set();dk.res=p.res.map(r=>({n:nameOk(r.n),s:Math.round(+r.s||0),m:Math.max(0,Math.round(+r.m||0)),o:String(r.o||''),a:(r.a||[]).filter(x=>x&&String(x.x||'').trim()).map(x=>({t:Math.round(+x.t||0),x:String(x.x).trim()})).sort((a,b)=>a.t-b.t)})).filter(r=>r.n&&!names.has(r.n)&&names.add(r.n));
     for(const r of dk.res)if(r.o===r.n||!dk.res.some(x=>x.n===r.o))r.o='';for(const h of dk.holders)ensureHolder(dk,h)}
    if(no.cr&&!dk.res.some(r=>r.n===no.cr))no.cr='';dk.opt=no;R.msg='설정을 저장했어.';return R}
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
  return `<div class="dc ${o.sel?'sel':''} ${o.cls||''}" style="--dc:${col}" ${o.attr||''}>${o.badge?`<em class="dcb">${o.badge}</em>`:''}<div class="dch"><b>${esc(c.n)}</b>${cost?`<span class="dcc">${esc(c.c)}</span>`:''}</div>${c.img?`<div class="dci" style="background-image:url('${cssu(c.img)}')"></div>`:''}${c.t?`<div class="dct">${esc(c.t)}</div>`:''}<div class="dcx">${esc(c.x||'')}</div>${c.a&&c.a.ops&&c.a.ops.length?'<em class="dca" title="자동화 구문이 있다">⚙</em>':''}</div>`}
 const backHtml=n=>`<div class="dc back"><span>🃏</span>${n!=null?`<em>${n}</em>`:''}</div>`;

 /* ---------- 휴대폰 「덱」 앱 ---------- */
 const PV={deck:'',tab:'hand',sel:[],q:'',zsel:{},zone:'disc',peek:null,adj:0,give:'',n:1,arm:'',armT:0};
 try{PV.deck=localStorage.getItem('om_deck_cur')||''}catch(e){}
 let redrawFn=null,rdT=0;const redrawSoon=()=>{clearTimeout(rdT);rdT=setTimeout(()=>{if(redrawFn&&document.querySelector('.ph-deck2'))redrawFn()},40)};
 function visDecks(){const db=DB();if(!db)return [];return Object.entries(db.decks||{}).map(([id,d])=>[id,fixDeck(clone(d))]).filter(([,d])=>canSee(d,me(),gm()))}
 function curDeck(){const L=visDecks();if(!L.length)return null;let x=L.find(([id])=>id===PV.deck);if(!x)x=L.find(([id])=>id===(DB()||{}).cur)||L[0];PV.deck=x[0];try{localStorage.setItem('om_deck_cur',PV.deck)}catch(e){}return x}
 function holderOf(t){if(!t)return '';return t.npc?'npc:'+t.name:t.id}
 function phone(t,canWrite){onAck();
  if(!DB())return `<div class="ph-head deck"><button class="ph-back" data-ph="home">‹</button><div><b>덱</b><small>카드 · 손패 · 자원</small></div></div><div class="ph-empty">아직 덱이 없다.${gm()?'<br><br><button class="btn sm pri" data-pd="seed">덱 만들기 (예전 은열쇠 · 광기 카드를 옮겨 온다)</button>':'<br>GM 이 덱을 만들면 여기 나온다.'}</div>`;
  const cd=curDeck();if(!cd)return `<div class="ph-head deck"><button class="ph-back" data-ph="home">‹</button><div><b>덱</b></div></div><div class="ph-empty">볼 수 있는 덱이 없다${me()&&!gm()?'<br><br><button class="btn sm" data-pd="newdeck">＋ 내 덱 만들기</button>':''}</div>`;
  const [did,dk]=cd;const H=holderOf(t);const own=isOwner(dk,me(),gm());const mine=canWrite&&(gm()||H===me());
  const L=visDecks();const pn=pendingN();
  const head=`<div class="ph-head deck"><button class="ph-back" data-ph="home">‹</button><div><select class="pd-sel" data-pd="deck">${L.map(([id,d])=>`<option value="${id}" ${id===did?'selected':''}>${esc(d.name)}${(DB()||{}).cur===id?' · 기본':''}${d.own?' · '+esc(hName(d.own)):''}</option>`).join('')}</select><small>${esc(hName(H))}의 손패${pn?` · ⏳ ${pn}`:''}</small></div><button class="btn xs" data-pd="mgr" title="카드 추가 · 편집 · 설정 · 자원 · 덱 관리">${own?'관리':'카드 목록'}</button></div>`;
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
     <div class="stform"><label>이름<input type="text" id="mf_n" value="${esc(f.n)}" placeholder="예) 상처약"></label><label>종류<input type="text" id="mf_t" value="${esc(f.t)}" placeholder="예) 도구 · 전술 · 이벤트"></label>
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
   body=`<div class="dmopt">${ck('pv','플레이어에게 보이기','끄면 GM(덱 주인)만 이 덱을 본다')}${ck('dp','뽑은 카드 공개','켜면 뽑은 카드 이름 · 효과가 채팅에 나온다')}${ck('hp','손패 공개','켜면 모두가 서로의 손패를 본다')}${ck('ar','덱이 비면 버린 카드 섞기','뽑을 때 덱이 비어 있으면 버린 카드를 섞어 다시 채운다')}${ck('ps','플레이어도 찾기','플레이어도 덱에서 카드를 찾아 가져오고 엿볼 수 있다')}</div>
    <div class="row" style="gap:14px;margin:8px 0"><label>한 번에 뽑기 최대 <input type="number" class="n" id="mo_md" min="1" max="30" value="${o.md}"></label><label>손패 한도 <input type="number" class="n" id="mo_hl" min="0" max="99" value="${o.hl}" title="0 = 없음"></label><label>비용 자원 <select id="mo_cr"><option value="">없음</option>${dk.res.map(r=>`<option ${o.cr===r.n?'selected':''}>${esc(r.n)}</option>`).join('')}</select></label></div>
    <div class="sec">자원 <span class="note">손패 주인마다 따로 · 「대신 오르는 자원」 = 비용이 모자랄 때 모자란 만큼 오르는 자원 (예: 은열쇠 → 광기) · 단계 알림은 한 줄에 「숫자: 문구」</span></div>
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
  const rd=()=>{const g=id=>($('#'+id,md)||{}).value;if(!$('#mf_n',md))return;MG.form=Object.assign(MG.form||{},{n:g('mf_n'),t:g('mf_t'),c:g('mf_c'),q:+g('mf_q')||0,x:g('mf_x'),img:g('mf_i')});{const dsl=String(g('mf_a')||'').trim();const K=window.OM_FX;if(dsl){const r=K?K.parse(dsl):{ops:[],errs:[]};MG.form.a={dsl,ops:r.ops};const ap=$('#mf_ap',md);if(ap)ap.innerHTML=(r.ops.length?'미리보기: '+esc(K.unparse(r.ops).join(' / ')):'')+(r.errs&&r.errs.length?` <span style="color:var(--red)">모르는 줄: ${esc(r.errs.join(' / '))}</span>`:'')}else{MG.form.a=null;const ap=$('#mf_ap',md);if(ap)ap.innerHTML=''}}const p=$('#mf_p',md);if(p)p.innerHTML=cardHtml(MG.form)};
  ['mf_n','mf_t','mf_c','mf_q','mf_x','mf_i','mf_a'].forEach(id=>{const el=$('#'+id,md);if(el)el.oninput=rd});
  {const ta=$('#mf_a',md),gh=$('#mf_ag',md);if(ta&&gh&&window.OM_FX_UI&&window.OM_FX_UI.mountGen)window.OM_FX_UI.mountGen(gh,ta,{toast:t=>A().toast(t)});if(ta)rd()}
  md.querySelectorAll('[data-mgc]').forEach(b=>b.onclick=()=>{rd();MG.form.col=b.dataset.mgc;md.querySelectorAll('[data-mgc]').forEach(x=>x.classList.toggle('on',x===b));rd()});
  const ff=$('#mf_f',md);if(ff)ff.onchange=async()=>{const f=ff.files[0];if(!f)return;A().toast('올리는 중…');try{$('#mf_i',md).value=await window.OM_STORE.uploadImage(`rooms/${ST().room}/card_${Date.now().toString(36)}`,f);rd();A().toast('올렸다')}catch(e){A().toast(e.message)}};
  const bl=$('#mf_b',md);const parseBulk=s=>String(s||'').split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{const a=(l.includes('\t')?l.split('\t'):l.split('|')).map(x=>x.trim());return {n:a[0],t:a[1]||'',c:a[2]||'',q:a[3]===''||a[3]==null?1:+a[3],x:(a[4]||'').replace(/\\n/g,'\n'),col:a[5]||''}}).filter(r=>r.n);
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
   <textarea data-rk="a" rows="2" placeholder="단계 알림: 3: 정보 수집 불리 (한 줄에 하나)">${esc((src.a||[]).map(x=>x.t+': '+x.x).join('\n'))}</textarea></div>`}
 function readOpt(md){const o={};md.querySelectorAll('[data-mo]').forEach(x=>o[x.dataset.mo]=x.checked?1:0);o.md=$('#mo_md',md).value;o.hl=$('#mo_hl',md).value;o.cr=$('#mo_cr',md).value;return o}
 function readRes(md){return [...md.querySelectorAll('.dmres')].map(el=>{const g=k=>(el.querySelector(`[data-rk="${k}"]`)||{}).value||'';
  return {n:g('n').trim(),s:+g('s')||0,m:+g('m')||0,o:g('o'),a:g('a').split('\n').map(l=>{const m=l.match(/^\s*(-?\d+)\s*[:：=]\s*(.+)$/);return m?{t:+m[1],x:m[2].trim()}:null}).filter(Boolean)}})}
 /* 예전 「덱」 버튼 · 단축키가 부르는 자리 */
 function open(){if(window.OM_PHONE_UI)return window.OM_PHONE_UI.open('deck')}
 /* ---------- 배틀에서 카드 쓰기 (10-26 망령) ----------
   트레이너 칸의 「🃏 카드 n」 → 그 트레이너(=덱 주인 holder) 손패 → 「사용」: 덱의 play(비용 · 버린 더미) + 카드에 자동화 구문이 있으면 SP 처럼 기준 포켓몬에서 돌린다.
   쓸 수 있는 덱: 지금 보는 덱(PV.deck) → 기본 덱 → 그 손패가 있는 덱 순 */
 function deckFor(H){const L=visDecks();const has=([,d])=>(d.hands[H]||[]).length;return L.find(x=>x[0]===PV.deck&&has(x))||L.find(x=>x[0]===(DB()||{}).cur&&has(x))||L.find(has)||null}
 function handCount(tid){const x=deckFor(tid);return x?(x[1].hands[tid]||[]).length:0}
 function battleHand(tid,o){o=o||{};const x=deckFor(tid);const BU=window.OM_BATTLE_UI;if(!x)return A().toast('손패가 없다 — 휴대폰 「덱」에서 먼저 뽑아 둬');const [did,dk]=x;const hand=dk.hands[tid]||[];
  const md=A().openModal(`<div class="mhead"><h2>🃏 ${esc(hName(tid))}의 손패 <small class="dim">${esc(dk.name)} · ${hand.length}장</small></h2><span class="sp"></span><button class="btn sm ghost" data-bh="phone">덱 앱</button><button class="btn ghost" data-x>닫기</button></div>
   ${dk.opt.cr?`<div class="small dim" style="margin-bottom:6px">비용 자원: ${esc(dk.opt.cr)} ${esc(String(((dk.rv[tid]||{})[dk.opt.cr])??''))}</div>`:''}
   <div class="dchand bh">${hand.map((cid,i)=>cardHtml(dk.cards[cid],{attr:`data-bhi="${i}"`})).join('')||'<div class="dim">손패가 비었다</div>'}</div>
   <div class="small dim" style="margin-top:8px">카드를 누르면 쓴다 — 비용을 내고 버린 더미로, ⚙ 카드는 구문이 돈다.</div>`,'wide');
  md.addEventListener('click',async e=>{if(e.target.closest('[data-bh="phone"]')){A().closeModal();PV.deck=did;return open()}const c=e.target.closest('[data-bhi]');if(!c)return;const i=+c.dataset.bhi;const cid=hand[i];const card=dk.cards[cid];if(!card)return;
   if(!confirm(`「${card.n}」을(를) 쓸까?`))return;
   const hasA=!!(card.a&&card.a.ops&&card.a.ops.length);let anchor='';if(hasA&&o.pickAnchor){anchor=await o.pickAnchor(tid);if(anchor===null)return}
   A().closeModal();PV.deck=did;const r=await run({op:'play',d:did,h:tid,sel:[i],ids:[cid],adj:0});if(r&&r.err)return A().toast(r.err);
   const head=`【카드】 ${hName(tid)} 『${card.n}』${card.c!==''&&card.c!=null?' (비용 '+card.c+')':''}`;
   if(window.OM_CUTIN)window.OM_CUTIN.fire({tok:'card:'+tid,src:card.img||'',tag:`${hName(tid)}의 카드!`,ment:`『${card.n}』`,color:colOf(card.col),line:card.t||'',gh:'CARD'});
   if(hasA&&anchor&&BU&&BU.fireAuto){const okA=await BU.fireAuto(anchor,'pot',card.n,{auto:Object.assign({name:card.n,src:'card',text:card.x||''},card.a),quiet:true,noRoll:true,head,img:card.img||'',eff:card.x||''});if(okA!==false)return}
   else if(hasA&&!anchor)A().toast('필드에 기준 포켓몬이 없어 구문은 건너뛰고 효과 글만 남긴다');
   await A().sysLog(`${head}${card.x?'\n'+card.x:''}`,'battle')})}
 return {open,absorb,phone,bindPhone,openMgr,exec,seedDb,onAck,handCount,battleHand};
})();
