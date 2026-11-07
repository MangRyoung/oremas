/* ---------- 소지품 자동화 (2026-10-23 반디) ----------
   소지품 DB(data/items.js) 효과 글을 읽어 규칙으로 바꾼다. 글 꼴이 맵툴 DB 그대로라 정규식으로 충분하다.
   쓰는 곳: 공격 창(위력 · 완화 · 무효 · 급소 · 쓴 뒤) · HP 창(반감열매 · 기합의띠 · 맞은 뒤) · 턴 종료 · 저장 뒤 점검(HP 열매 · 치유 열매 · 시드 …)
   모두 사본을 받아 고치고 로그 줄을 돌려준다. 매직룸 중에는 아무것도 하지 않는다 (OM_FIELD.itemOf) */
"use strict";
window.OM_ITEMS=(()=>{
 const DB=()=>window.OM_DB||{},S=()=>window.OM_STATS,F=()=>window.OM_FIELD,FX=()=>window.OM_FX,B=()=>window.OM_BATTLE;
 const nm=s=>String(s||'').replace(/『|』/g,'').trim();
 const itemOf=m=>!m?'':nm(F()&&F().itemOf?F().itemOf(m):(m.item||''));
 const typesOf=m=>(m.teraActive&&m.teraEn&&m.teraEn!=='-')?[m.teraEn]:(m.types||[]).filter(t=>t&&t!=='-');
 const tEn=k=>{k=String(k||'').trim();return (S()&&S().typeEn&&S().typeEn(k))||k};
 const KO_STAT={'공격':'attack','방어':'defense','특공':'specialattack','특방':'specialdefense','스피드':'speed','명중':'accuracy','회피':'evasion','C':'critical','급소':'critical'};
 const STAT_KO={attack:'공격',defense:'방어',specialattack:'특공',specialdefense:'특방',speed:'스피드',accuracy:'명중',evasion:'회피',critical:'급소'};
 const ABN=['Poison','Toxic','Burn','Paralysis','Freeze','Sleep'];
 const stEn=k=>(FX()&&FX().stEn?FX().stEn(k):'')||'';
 const frac=(max,f)=>{const m=String(f).match(/^(\d+)\/(\d+)$/);return m?Math.max(1,Math.floor(max*+m[1]/+m[2])):Math.max(1,+f||0)};

 /* ----- 규칙: 소지품 DB 의 「구문」(auto)이 있으면 구문, 없으면 효과 글을 읽는다 (js/engine/itemrule.js, 10-24 망령: 제작기 소지품 DB 에 구문을 넣는 방식) ----- */
 const CACHE={};
 function rule(name){name=nm(name);if(!name)return null;const it=(DB().items||{})[name]||{};const e=String(it.eff||'').replace(/<br\s*\/?>/g,' ');const ck=name+'\u0001'+(it.auto||'')+'\u0001'+e;
  if(CACHE[name]&&CACHE[name].ck===ck)return CACHE[name].r;const IR=window.OM_ITEMRULE;const r=Object.assign(IR?IR.ruleOf(name,it):{},{name,eff:e});r.once=!!r.once;CACHE[name]={ck,r};return r}
 /* 그 포켓몬이 지금 쓰는 소지품 규칙 (전용 소지품은 종족이 맞을 때만) */
 /* 제작기 「상세 조정」의 소지품 구문: 그 포켓몬이 그 소지품을 들고 있을 때만 DB 구문 대신 쓴다 */
 const TCACHE={};
 function tuned(n,dsl,own){const ck=n+'\u0001'+dsl+'\u0001'+(own?own.eff:'');if(TCACHE[ck])return TCACHE[ck];const it=(DB().items||{})[n]||own||{};const e=String(it.eff||'').replace(/<br\s*\/?>/g,' ');const IR=window.OM_ITEMRULE;const r=Object.assign(IR?IR.ruleOf(n,{eff:e,auto:dsl}):{},{name:n,eff:e,tuned:1});r.once=!!r.once;return TCACHE[ck]=r}
 /* 오리지널 소지품 (제작기 시트에만 적은 것, DB 에 없음): 시트의 구문 → 없으면 지금 들고 있는 소지품 글(itemEff)을 읽는다. 트릭 등으로 옮겨 가도 글은 따라간다 */
 const OCACHE={};
 function ownOf(m,n){if((DB().items||{})[n])return null;const o=m.itemOwn&&nm(m.itemOwn.name)===n?m.itemOwn:null;const eff=String((o&&o.eff)||m.itemEff||'').replace(/<br\s*\/?>/g,' ');const auto=o?String(o.auto||''):'';if(!eff&&!auto)return null;
  const cons=o?!!o.cons:/소모|사라진다|사라짐/.test(eff);return {eff,auto,cons,sock:'-'}}
 function ownRule(n,o){const ck=n+'\u0001'+o.auto+'\u0001'+o.eff+'\u0001'+o.cons;if(OCACHE[ck])return OCACHE[ck];const IR=window.OM_ITEMRULE;const it={eff:(o.cons&&!/소모품/.test(o.eff)?'소모품/':'')+o.eff,auto:o.auto};const r=Object.assign(IR?IR.ruleOf(n,it):{},{name:n,eff:o.eff,own:1});r.once=!!(r.once||o.cons);return OCACHE[ck]=r}
 function ruleAt(m,x,n){if(!n)return null;const tu=m.itemTune;const own=ownOf(x,n);const r=tu&&tu.dsl&&nm(tu.item)===n?tuned(n,tu.dsl,own):own?ownRule(n,own):rule(n);if(!r)return null;if(r.only&&!r.only.some(o=>String(m.species||'').includes(o)||String(m.name||'').includes(o)||String(m.form||'').includes(o)))return null;return r}
 function of(m){return m?ruleAt(m,m,itemOf(m)):null}
 /* 11-05 망령 「소지품 2 이상부터 자동화도 안 들어가 있다」: 소지품 칸 전부 (k 0 = item, 1~ = items2[k-1]) · 매직룸이면 없음 */
 function slotsOf(m){if(!m||(F()&&F().magic&&F().magic()))return [];const out=[{x:m,k:0,n:nm(m.item)}];(m.items2||[]).forEach((x,i)=>{if(x)out.push({x,k:i+1,n:nm(x.item)})});return out.filter(o=>o.n)}
 function all(m){const out=[];for(const o of slotsOf(m)){const r=ruleAt(m,o.x,o.n);if(r)out.push({r,k:o.k})}return out}
 const names=m=>slotsOf(m).map(o=>o.n);
 const has=(m,n)=>names(m).includes(nm(n));

 /* ----- 공용 손질 ----- */
 function USE(m,lines,b,k){k=+k||0;const x=k?(m.items2||[])[k-1]:m;if(!x)return;const name=nm(x.item);if(!name)return;m.itemUsed={name,eff:x.itemEff||'',turn:+((b||{}).turn)||0,...(k?{k}:{})};try{if(FX())FX().removeByName(m,name)}catch(e){}x.item='';x.itemEff='';if(k)delete x.itemOwn;lines.push(`「${name}」 — 다 써서 없어졌다`)}
 const use=USE;
 function rank(m,stats,lines){const out=[];m.rank=m.rank||{};for(const k in stats){const lim=k==='critical'?4:6;const v=+stats[k];const b4=+m.rank[k]||0;const nv=Math.max(-lim,Math.min(lim,b4+v));if(nv===b4){out.push(`${STAT_KO[k]||k} 더 ${v>0?'오르지':'내려가지'} 않는다`);continue}m.rank[k]=nv;out.push(`${STAT_KO[k]||k} ${v>0?'+':''}${nv-b4} (→ ${nv>0?'+':''}${nv})`)}if(out.length)lines.push(`${m.name} ${out.join(' · ')}`)}
 function heal(m,v,lines,why){if((m.states||{}).HealBlock){lines.push(`${m.name} 「회복봉인」이라 ${why} 회복 못 함`);return 0}const h=Math.min(v,m.hp.max-m.hp.cur);if(h<=0)return 0;m.hp.latest=m.hp.cur;m.hp.cur+=h;lines.push(`${m.name} ${why} +${h} (HP ${m.hp.cur}/${m.hp.max})`);return h}
 function hurt(m,v,lines,why){if(FX()&&FX().noind&&FX().noind(m,'')){lines.push(`${m.name} ${why} — 비례 대미지를 받지 않는다`);return 0}const d=Math.min(v,m.hp.cur);if(d<=0)return 0;m.hp.latest=m.hp.cur;m.hp.cur-=d;lines.push(`${m.name} ${why} −${d} (HP ${m.hp.cur}/${m.hp.max})`);if(m.hp.cur<=0){m.entry='';lines.push(`${m.name}은(는) 쓰러졌다!`)}return d}

 /* 「조건 특방 B 이하」 (마제망토): 그 능력의 종족치 등급이 기준 이하일 때만 (등급을 모르면 건다) */
 function gleOk(m,r){const c=r&&r.gle;if(!c)return true;const i={attack:1,defense:2,specialattack:3,specialdefense:4,speed:5}[c.st];const S=window.OM_STATS;const RK=(S&&S.RANKS)||['E','D','C','B','A','AA','AAA','S'];
  let g=String(((m&&m.ranks)||[])[i]||'').replace(/[+-]+$/,'');if(RK.indexOf(g)<0&&S&&S.gradeOf&&m&&m.base)g=String(S.gradeOf(m.base[i])||'').replace(/[+-]+$/,'');const a=RK.indexOf(g),b=RK.indexOf(c.g);return a<0||b<0?true:a<=b}
 /* ----- 공격 창 ----- */
 /* 공격 쪽 위력 배율. q: {types:[en], cat:'물리'|'특수'|'변화', single} → {v, txt, jewel} | null */
 function atkMul1(atk,r,q){if(!r||!r.atk||q.cat==='변화'||!gleOk(atk,r))return null;const a=r.atk;
  if(a.types&&!a.types.some(t=>(q.types||[]).includes(t)))return null;if(a.cat&&a.cat!==q.cat)return null;if(a.single&&!q.single)return null;
  return {v:a.v,txt:`「${r.name}」 ×${a.v}`,jewel:!!a.single&&r.once,name:r.name}}
 function atkMul(atk,q){const hs=all(atk).map(o=>atkMul1(atk,o.r,q)).filter(Boolean);if(!hs.length)return null;if(hs.length===1)return hs[0];
  const v=Math.round(hs.reduce((p,h)=>p*h.v,1)*1000)/1000;const j=hs.find(h=>h.jewel);return {v,txt:hs.map(h=>h.txt).join(' · '),jewel:!!j,name:(j||hs[0]).name}}
 /* 받는 쪽 완화 (돌격조끼 · 진화의휘석 …) → {v, txt} | null */
 function defGuard(def,cat){const hs=all(def).map(o=>o.r).filter(r=>r.guard&&gleOk(def,r)&&!(r.guard.cat&&r.guard.cat!==cat));if(!hs.length)return null;const v=Math.round(hs.reduce((p,r)=>p*r.guard.v,1)*1000)/1000;return {v,txt:hs.map(r=>`${def.name} 「${r.name}」 ×${Math.round(r.guard.v*1000)/1000}`).join(' · ')}}
 /* 받는 쪽 무효 (스펀지 · 횃불) → 소지품 이름 | '' */
 function immune(def,types){const o=all(def).find(o=>o.r.immune&&o.r.immune.some(t=>(types||[]).includes(t)));return o?o.r.name:''}
 function crit(atk,def){let v=0;for(const o of all(atk))if(o.r.crit)v+=o.r.crit;for(const o of all(def))if(o.r.critGuard)v-=o.r.critGuard;return v}
 /* 받는 쪽 반감열매가 이 공격에 맞나. lh: lastHit {mt, cat, eff, multi} → 열매 이름 | '' */
 function resist(def,lh){if(!lh)return '';for(const o of all(def)){const n=resist1(def,o.r,lh);if(n)return n}return ''}
 function resist1(def,r,lh){if(!r||!r.resist)return '';const x=r.resist;
  if(x.type&&!(lh.mt||[]).includes(x.type))return '';if(x.se&&!(+lh.eff>=2))return '';if(x.cat&&x.cat!==lh.cat)return '';if(x.full&&def.hp.cur<def.hp.max)return '';if(x.multi&&!lh.multi)return '';if(!x.type&&!x.cat&&!x.multi)return '';return r.name}
 /* 기합의띠(HP 가득) · 기합의머리띠(1할) → {name, sure} | null */
 function sash(def){for(const o of all(def)){const s=sash1(def,o.r);if(s)return s}return null}
 function sash1(def,r){if(!r||!r.sash)return null;if(r.sash==='full')return def.hp.cur>=def.hp.max?{name:r.name,sure:1,once:r.once}:null;return {name:r.name,pct:r.sash,once:r.once}}

 /* 공격을 적용한 뒤 공격 쪽: 쥬얼 소모 · 조개껍질방울 · 목스프레이 · 허탕보험 · 풀죽음(왕의징표석) — b 사본을 고친다
    info: {jewel, dealt:[def id], missAll, tags:[...]} */
 function afterAttack(b,atk,info){const L=[];if(!atk||atk.hp.cur<=0)return L;for(const o of all(atk))afterAttack1(b,atk,info,o.r,o.k,L);return L}
 function afterAttack1(b,atk,info,r,k,L){const hitAny=(info.dealt||[]).length>0;
  if(info.jewel&&(typeof info.jewel!=='string'||info.jewel===r.name)&&hitAny&&r.atk&&r.atk.single&&r.once){L.push(`${atk.name} 「${r.name}」으로 위력이 올랐다`);use(atk,L,b,k)}
  if(r.onDeal&&hitAny){const o=r.onDeal;if(o.heal)heal(atk,frac(atk.hp.max,o.heal),L,`「${r.name}」`);if(o.stats&&(!o.tag||(info.tags||[]).includes(o.tag))){L.push(`${atk.name} 「${r.name}」 발동`);rank(atk,o.stats,L);if(r.once)use(atk,L,b,k)}}
  if(r.onMiss&&info.missAll){L.push(`${atk.name} 「${r.name}」 발동 — 빗나갔다`);rank(atk,r.onMiss.stats,L);if(r.once)use(atk,L,b,k)}
  if(r.flinch&&hitAny)for(const id of info.dealt){const d=b.mons[id];if(!d||d.hp.cur<=0)continue;const roll=1+Math.floor(Math.random()*100);
   if(roll<=r.flinch){if(!has(d,'은밀망토')){d.states=d.states||{};if(!d.states.Flinch){d.states.Flinch=1;L.push(`${d.name} 「${r.name}」으로 풀이 죽었다 (${roll}/${r.flinch})`)}}}
   else L.push(`${d.name} 「${r.name}」 풀죽음 실패 (${roll}/${r.flinch})`)}}

 /* ----- HP 창: 맞은 뒤 받는 쪽 반응. b 사본 · def(맞은 쪽) · lh(lastHit) · dealt(받은 피해) · n(맞은 타 수, 연속기) ----- */
 function onHit(b,def,lh,dealt,n){const L=[];if(!(dealt>0))return L;for(const o of all(def))if(o.r.hit)onHit1(b,def,lh,n,o.r,o.k,L);return L}
 function onHit1(b,def,lh,n,r,k,L){const atk=b.mons[lh.fromId];let gone=false;const sx=k?(def.items2||[])[k-1]:def;const L0=L.length;
  const times=r.once?1:Math.max(1,+n||1);   /* 10-27 망령: 한 번 쓰고 없어지지 않는 것(울퉁불퉁멧 등)은 맞은 타마다 */
  const fire=()=>{if(L.length===L0)L.push(`${def.name} 「${r.name}」 발동`)};
  for(const h of r.hit){if(gone)break;
   if(h.pop){fire();L.push(`${def.name}의 「${r.name}」이(가) 터졌다!`);use(def,L,b,k);gone=true;break}
   if(h.se&&!(+lh.eff>=2))continue;if(h.type&&!(lh.mt||[]).includes(h.type))continue;if(h.cat&&h.cat!==lh.cat)continue;if(h.contact&&!lh.ct)continue;
   if(def.hp.cur<=0&&!h.back&&!h.yellow&&!h.setType&&!h.setTrait)continue;   /* 쓰러졌으면 자기 강화는 없다 · 되갚는 것은 한다 */
   fire();
   if(h.stats)for(let i=0;i<times;i++)rank(def,h.stats,L);
   if(h.back)for(let i=0;i<times;i++){if(atk&&atk.hp.cur>0)hurt(atk,frac(atk.hp.max,h.back),L,`「${r.name}」 ${h.back}${times>1?` (${i+1}타)`:''}`)}
   if(h.yellow&&atk&&atk.hp.cur>0){const ks=['attack','defense','specialattack','specialdefense','speed'];let best=ks[0],bv=-1;for(const k of ks){const v=B()&&B().statValue?B().statValue(atk,k).value:0;if(v>bv){bv=v;best=k}}rank(atk,{[best]:-h.yellow},L)}
   if(h.setType&&atk&&atk.hp.cur>0&&atk.teraActive&&atk.teraEn&&atk.teraEn!=='-')L.push(`${atk.name} 「테라스탈」 상태라 타입이 바뀌지 않는다`);else if(h.setType&&atk&&atk.hp.cur>0){atk.typesOrig=atk.typesOrig||(atk.types||[]).slice();atk.typesBy=r.name;atk.types=[h.setType];L.push(`${atk.name} 타입 → ${S()&&S().typeKo?S().typeKo(h.setType):h.setType}`)}
   if(h.setTrait&&atk&&atk.hp.cur>0&&FX()&&FX().spOf&&FX().spOf(atk,'protect').some(e=>(e.what||['trait']).includes('trait')))L.push(`${atk.name} 특성이 바뀌지 않는다 (변경 보호)`);
   else if(h.setTrait&&atk&&atk.hp.cur>0){if(FX()&&FX().setAb)FX().setAb(atk,h.setTrait,r.name);else{if(atk.abilityOrig==null)atk.abilityOrig=atk.ability||'';atk.abilityBy=r.name;atk.ability=h.setTrait}L.push(`${atk.name} 특성 → 「${h.setTrait}」`)}
   if(h.move){if(atk&&atk.hp.cur>0&&!nm(atk.item)){atk.item=sx.item;atk.itemEff=sx.itemEff||'';sx.item='';sx.itemEff='';L.push(`「${r.name}」이(가) ${atk.name}에게 옮겨붙었다`);gone=true}continue}
   if(h.note)L.push(`${def.name} — ${h.note}`);
   if(r.once){use(def,L,b,k);gone=true}}}

 /* HP 열매의 「무작위한 능력치 +N」 · 「가장 높은/낮은 능력치 ±N」 (sweep · eat 함께) */
 function hpExtra(m,h,L){if(h.random){const ks=['attack','defense','specialattack','specialdefense','speed'].filter(k=>(+(m.rank||{})[k]||0)<6);if(ks.length)rank(m,{[ks[Math.floor(Math.random()*ks.length)]]:h.random},L)}
  if(h.pick){const K=['attack','defense','specialattack','specialdefense','speed'];const bs=Array.isArray(m.base)?m.base.map(v=>+v||0):null;let bi=1;if(bs&&bs.length>=6)for(let i=2;i<=5;i++){if(h.pick.lo?bs[i]<bs[bi]:bs[i]>bs[bi])bi=i}L.push(`가장 ${h.pick.lo?'낮은':'높은'} 능력치 → 「${({attack:'공격',defense:'방어',specialattack:'특공',specialdefense:'특방',speed:'스피드'})[K[bi-1]]}」`);rank(m,{[K[bi-1]]:h.pick.v},L)}}   /* 11-05 블루레이져: 종족치로 고름 (fx 「최고」와 같은 셈) */
 /* ----- 저장 뒤 점검: 조건이 맞으면 바로 터지는 소지품 (HP 열매 · 치유 열매 · 시드 · 룸서비스 · 하양허브 · 웨더클리너 · 필드롤러 · 윈드브레이커)
    b 사본 · f 필드 사본 · can(m) 이 화면이 고칠 수 있나 → [{mid, name, lines}] ----- */
 function sweep(b,f,can){const out=[];
  for(const id in b.mons||{}){const m=b.mons[id];if(!m.entry||(can&&!can(m)))continue;for(const {r,k} of all(m)){if(m.hp.cur<=0)break;const L=[];const use=(m,L,b)=>USE(m,L,b,k);
   if(r.hp){const fr=(/먹보/.test(m.ability||'')&&r.hp.frac==='1/4')?'1/2':r.hp.frac;const lim=Math.floor(m.hp.max*+fr.split('/')[0]/+fr.split('/')[1]);
    if(m.hp.cur<=lim){const h=r.hp;L.push(`「HP」 ${fr} 이하`);if(h.heal!=null){if((m.states||{}).HealBlock){L.length=0}else heal(m,typeof h.heal==='number'?h.heal:frac(m.hp.max,h.heal),L,'회복')}
     if(h.stats)rank(m,h.stats,L);hpExtra(m,h,L)
     if(L.length&&r.once)use(m,L,b)}}
   else if(r.cure){const st=m.states||{};const hit=(r.cure.includes('Poison')&&!r.cure.includes('Toxic')?r.cure.concat(['Toxic']):r.cure).filter(k=>st[k]);   /* 11-06 「독」 치유는 맹독도 */if(hit.length){for(const k of hit)delete st[k];L.push(`${hit.map(k=>'「'+((((DB().states||{}).st||{})[k]||{}).ko||k)+'」').join(' · ')} 치유`);if(r.once)use(m,L,b)}}
   else if(r.seed&&f&&(f.terrain||{}).type===r.seed.terrain){L.push(`「${r.seed.terrain}」`);rank(m,r.seed.stats,L);if(r.once)use(m,L,b)}
   else if(r.room&&f&&+((f.rooms||{})[r.room.room]||0)>0){L.push(`「${r.room.room}」`);rank(m,r.room.stats,L);if(r.once)use(m,L,b)}
   else if(r.white){const neg=Object.keys(m.rank||{}).filter(k=>k!=='critical'&&+m.rank[k]<0);if(neg.length){for(const k of neg)m.rank[k]=0;L.push(`${neg.map(k=>STAT_KO[k]||k).join(' · ')} 하락을 되돌렸다`);if(r.once||/허브/.test(r.name))use(m,L,b)}}
   else if(r.clearW&&f&&(f.weather||{}).type){L.push(`날씨 「${f.weather.type}」 해제`);f.weather={type:'',count:0};use(m,L,b)}
   else if(r.clearT&&f&&(f.terrain||{}).type){L.push(`「${f.terrain.type}」 철거`);f.terrain={type:'',count:0};use(m,L,b)}
   else if(r.clearTw&&f){const hit=['left','right'].filter(s=>+((f.objects||{})[s]||{})['순풍']>0);if(hit.length){for(const s of hit)delete f.objects[s]['순풍'];L.push(`${hit.map(s=>s==='left'?'좌측':'우측').join(' · ')} 「순풍」 해제`);use(m,L,b)}}   /* 11-07 망령: 윈드브레이커 — 양쪽 진영 순풍 */
   if(L.length)out.push({mid:id,name:r.name,eff:r.eff,lines:L})}}
  return out}

 /* ----- 11-06 망령 「소지품 기술 전부」: 남의 소지품을 건드리는 기술 — 기술 이름이 아니라 효과 글로 고른다 (같은 글을 쓰는 커스텀 기술도)
    eat 벌레먹기 · 쪼아대기 / knock 탁쳐서떨구기 / steal 도둑질 · 탐내기 / swap 트릭 · 바꿔치기 / fling 내던지기 ----- */
 const MV_RE=[['eat',/「나무열매」를\s*먹는다/],['knock',/「소지품」을\s*전부\s*파괴/],['burnall',/「소지품」을\s*모두\s*파괴/],['rob',/「소지품」을\s*파괴\s*\(\s*약탈\s*\)/],['burn',/대상의\s*「소지품」을\s*파괴/],['steal',/「소지품」을\s*강탈/],['swap',/서로의\s*「소지품」을\s*뒤바꾼다/],['fling',/자신의\s*「소지품」을\s*소비하여\s*공격/],['give',/자신의\s*「소지품」을\s*대상에게\s*건네/]];
 /* 11-08 망령 「1~3 가로」: burn 불태우기 · 황금의바람 · 녹슨바람 · 검은우레 · 신의주먹 · 홍련완 · 패왕권 · 고블린의무리 (한 칸) / burnall 부식가스 (모든 칸) / give 기프트패스.
    파괴된 소지품도 빼앗긴 것처럼 itemTaken (how 'burn') — 배틀 한정 · 시트 그대로 (망령 11-08 「가」) */
 const KIND_KO={eat:'먹기',knock:'떨구기',burn:'파괴',burnall:'모두 파괴',steal:'강탈',swap:'맞바꾸기',fling:'내던지기',give:'건네주기',set:'소지품 지정',rob:'파괴(약탈)'};
 /* 11-08 망령 「파괴(약탈)은 빈손이면 뺏고, 뺏을 수 없으면 파괴 — 파괴+약탈 합친 상위 개념」: rob */
 const hasItemOp=ops=>(ops||[]).some(o=>o&&(o.k==='item'||(o.k==='choice'&&(o.opts||[]).some(x=>hasItemOp(x.ops)))));
 /* 공격 창 미리보기가 대상마다 · 입력마다 부르므로 3초 동안 기억 (rm 은 레디메이드 전체를 합쳐서 한 번에 ~0.4ms) */
 const OWNC=new Map();
 function mvOwnsItem(mv){const key=nm(mv.name)+'\u0001'+String(mv.auto||'');const c=OWNC.get(key),now=Date.now();if(c&&now-c.t<3000)return c.v;let v=false;
  try{const F2=FX();if(F2){if(mv.auto&&F2.parse&&hasItemOp(F2.parse(String(mv.auto)).ops))v=true;else{const R=F2.rm?F2.rm('기술 : '+nm(mv.name)):null;v=!!(R&&hasItemOp(R.ops))}}}catch(e){v=false}
  if(OWNC.size>300)OWNC.clear();OWNC.set(key,{v,t:now});return v}
 function moveKind(mv){if(!mv||mvOwnsItem(mv))return '';const e=String((mv||{}).eff||'');for(const [k,re] of MV_RE)if(re.test(e))return k;return ''}   /* 그 기술 구문(레디메이드 「기술 : 이름」 · 포켓몬별 mv.auto)에 「소지품」 줄이 있으면 구문이 맡는다 (두 번 안 하게) */
 const J=(w,x,y)=>{w=String(w||'');const c=w.charCodeAt(w.length-1);return c>=0xAC00&&c<=0xD7A3&&(c-0xAC00)%28?x:y};   /* 받침 있으면 x */
 const anm=s=>String(s||'').replace(/[『』「」\s]/g,'');
 const reEsc=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 /* 특성 · 포텐셜 이름으로 (일루젼 ILLU_RE 와 같은 방식) */
 function abil(m,re){if(!m)return false;const L=[m.ability,...(m.pots||[]).map(p=>p&&p.name),...(m.excl?[m.excl.name]:[]),...(m.exclX||[]).map(p=>p&&p.name)];return L.some(n=>n&&re.test(anm(n)))}
 const sticky=m=>abil(m,/^점착$/)||protItem(m);
 /* 11-08: 구문 「보호 소지품」(fx sp protect what item) 도 점착처럼 — 소지품이 바뀌지 · 빠지지 않는다 */
 function protItem(m){try{const F2=FX();return !!(F2&&F2.spOf&&F2.spOf(m,'protect').some(e=>(e.what||['trait']).includes('item')))}catch(e){return false}}
 const stickyWhy=m=>abil(m,/^점착$/)?'「점착」':'「보호 (소지품)」';
 const slotX=(m,k)=>k?(m.items2||[])[k-1]:m;
 function held(m){const L=[];if(!m)return L;if(nm(m.item))L.push(0);(m.items2||[]).forEach((x,i)=>{if(x&&nm(x.item))L.push(i+1)});return L}
 function slotRule(m,k){const x=slotX(m,+k||0);const n=x?nm(x.item):'';return n?ruleAt(m,x,n):null}
 function itEff(m,k){const x=slotX(m,k);if(!x)return '';const n=nm(x.item);const db=(DB().items||{})[n];const o=x.itemOwn&&nm(x.itemOwn.name)===n?x.itemOwn:null;return String((db&&db.eff)||(o&&o.eff)||x.itemEff||'').replace(/<br\s*\/?>/g,' ')}
 /* 못 뺏는 소지품: 효과 글 「파괴(변경)되지 않는다」(메가스톤) · 「특성 : X」이 지니면 … (플레이트 · 메모리) · 이름 「…나이트」 · 「…Z」 */
 const NOBREAK=/(?:파괴\s*\(\s*변경\s*\)|변경\s*\(\s*파괴\s*\))\s*되지\s*않는다/;
 function locked(m,k){const x=slotX(m,k);const n=x?nm(x.item):'';if(!n)return false;const e=itEff(m,k);
  const c=e.match(/「특성\s*:\s*([^」]+)」[이가]?\s*지니면\s*(?:파괴\s*\(\s*변경\s*\)|변경\s*\(\s*파괴\s*\))\s*되지\s*않는다/);if(c)return abil(m,new RegExp('^'+reEsc(anm(c[1]))+'$'));
  if(NOBREAK.test(e))return true;return (/나이트[XY]?$/.test(n)&&(!e||/메가/.test(e)))||/Z$/.test(n)}
 /* 칸에서 빼기 — fx · 등장 표시도 뗀다. 배틀에서 얻은 것(itemGot)이면 그 목록에서, 시트 것이면 itemTaken 에 남긴다 (결과 정리 때 시트에서 빼지 않는다) */
 function takeOut(m,k,how,by,turn){const x=slotX(m,k);const n=x?nm(x.item):'';if(!n)return null;const o={name:n,eff:x.itemEff||'',own:x.itemOwn&&nm(x.itemOwn.name)===n?x.itemOwn:null};
  try{if(FX())FX().removeByName(m,n)}catch(e){}if(m.fxDone&&m.fxDone[n]){m.fxDone=Object.assign({},m.fxDone);delete m.fxDone[n]}
  x.item='';x.itemEff='';if(k)delete x.itemOwn;
  const g=m.itemGot||[];const gi=g.indexOf(n);if(gi>=0){m.itemGot=g.filter((_,i)=>i!==gi);if(!m.itemGot.length)delete m.itemGot}else m.itemTaken=[...(m.itemTaken||[]),{name:n,k,how,by:by||'',turn:+turn||0}];return o}
 /* 1번 칸에 넣기 — 다 쓴 시트 소지품 기록(itemUsed)은 itemUsed0 으로 지킨다. 빼앗겼던 제 것이 돌아오면 itemTaken 에서 지운다 */
 function putIn(m,o){if(!o||!o.name)return;if(m.itemUsed&&!m.itemUsed0&&!(m.itemGot||[]).includes(nm(m.itemUsed.name)))m.itemUsed0=m.itemUsed;
  const db=(DB().items||{})[o.name];m.item=o.name;m.itemEff=o.eff||(db&&db.eff)||'';if(o.own)m.itemOwn=o.own;
  const t=m.itemTaken||[];const ti=t.findIndex(q=>q.name===o.name);if(ti>=0){m.itemTaken=t.filter((_,i)=>i!==ti);if(!m.itemTaken.length)delete m.itemTaken}else m.itemGot=[...(m.itemGot||[]),o.name]}
 const isBerry=(n,r)=>/열매$/.test(nm(n))||!!(r&&r.ngift);
 /* 나무열매를 조건(HP 1/2 이하 등) 없이 먹는다 — r 그 열매 규칙. 효과가 있었으면 true (반감열매처럼 맞을 때만 쓰는 것은 false) */
 function eat(m,r,lines){if(!m||!r)return false;const L0=lines.length;
  if(r.hp){const h=r.hp;if(h.heal!=null)heal(m,typeof h.heal==='number'?h.heal:frac(m.hp.max,h.heal),lines,'회복');if(h.stats)rank(m,h.stats,lines);hpExtra(m,h,lines)}
  if(r.cure){const st=m.states||{};const hit=(r.cure.includes('Poison')&&!r.cure.includes('Toxic')?r.cure.concat(['Toxic']):r.cure).filter(k=>st[k]);if(hit.length){for(const k of hit)delete st[k];lines.push(`${m.name} ${hit.map(k=>'「'+((((DB().states||{}).st||{})[k]||{}).ko||k)+'」').join(' · ')} 치유`)}}
  return lines.length>L0}
 /* 내던지기: 위력 (소지품 DB 「fling」 칸 → 없으면 작은 표) · 못 던지는 경우 */
 function flingPow(m){const n=itemOf(m);if(!n)return 0;const db=(DB().items||{})[n];const o=m.itemOwn&&nm(m.itemOwn.name)===n?m.itemOwn:null;const fv=+((db&&db.fling)||(o&&o.fling)||0);if(fv>0)return fv;
  if(n==='검은철구')return 130;if(n==='단단한바위')return 100;if(/플레이트$/.test(n))return 90;if(isBerry(n,slotRule(m,0)))return 10;return 30}
 function flingInfo(m){const n=itemOf(m);if(!n)return {ok:false,why:nm(m&&m.item)?'「매직룸」이라 소지품을 쓸 수 없어':'소지품을 지니고 있지 않아'};if(abil(m,/^서투름$/))return {ok:false,name:n,why:'「서투름」이라'};
  const st=m.states||{};if(st.Embrago||st.Embargo)return {ok:false,name:n,why:'「금제」 상태라'};if(locked(m,0))return {ok:false,name:n,why:`「${n}」${J(n,'은','는')} 던질 수 없는 소지품이라`};return {ok:true,name:n,pow:flingPow(m)}}
 const FLING_ST={'불꽃구슬':'Burn','화염구슬':'Burn','맹독구슬':'Toxic','전기구슬':'Paralysis','독바늘':'Poison','왕의징표석':'Flinch','예리한이빨':'Flinch'};
 /* 탁쳐서떨구기 위력 1.5배: 뺄 수 있는 소지품이 있으면 (점착이어도 1.5배) */
 const knockable=m=>held(m).some(k=>!locked(m,k));
 /* 공격 창 「적용」: b 사본 · aid 공격 쪽 · kind · hits [{id, hit, dmg(대미지로 맞음), final(예상 대미지)}] · q {name, mt, cat, eff:{id:상성}, multi, turn}
    → {lines, st:[{id, en, from}]} — 상태 이상(내던지기 화염구슬 등)은 화면이 FX 로 건다 (면역 · 타입 검사를 같은 길로) */
 function moveFx(b,aid,kind,hits,q){const L=[],ST=[];const a=b&&b.mons[aid];if(!a||!kind)return {lines:L,st:ST};q=q||{};const head=`【소지품】 ${a.name} 『${q.name||''}』 —`;const turn=+q.turn||+(b.turn)||0;
  const sub=d=>d.id!==aid&&!q.force&&!!(d.states||{}).Substitute;
  const H2=q.head?`【소지품】 ${q.head} —`:null;const hd=H2||head;   /* 특성 · 구문이 부를 때 머리말 */
  /* 이번 공격에 먼저 반응할 소지품(반감열매 · HP 가득 기합의띠)은 떼지 않는다 — 받는 쪽 HP 창이 쓴다 */
  const keepOf=(d,h)=>{const s=new Set();if(!h.dmg)return s;const ef=(q.eff||{})[d.id];const rs=resist(d,{mt:q.mt||[],cat:q.cat,eff:ef==null?1:ef,multi:!!q.multi});if(rs)s.add(rs);const sh=sash(d);if(sh&&sh.sure&&(+h.final||0)>=d.hp.cur)s.add(sh.name);return s};
  if(kind==='rob'){for(const h of hits||[]){const d=b.mons[h.id];if(!d||!h.hit||d.id===aid)continue;const can=!nm(a.item)&&a.hp.cur>0&&held(d).some(k=>!locked(d,k));
    const R=moveFx(b,aid,can?'steal':'burn',[h],q);L.push(...R.lines);if(can&&!nm(a.item)&&!sticky(d)){const R2=moveFx(b,aid,'burn',[h],q);L.push(...R2.lines)}}return {lines:L,st:ST}}   /* 빼앗지 못했으면(점착 말고 · 이번 공격에 먼저 쓰일 것 등) 파괴로 */
  if(kind==='fling'){const n=nm(a.item);if(!n)return {lines:L,st:ST};const fr=slotRule(a,0)||rule(n);use(a,[],b,0);L.push(`${hd} 「${n}」${J(n,'을','를')} 던졌다 (다 써서 없어졌다)`);
   const h=hits.find(x=>x.hit&&x.dmg);const d=h&&b.mons[h.id];if(!d)return {lines:L,st:ST};
   if(sub(d)){L.push(`${d.name} 대역인형이 받아 「${n}」 효과는 없다`);return {lines:L,st:ST}}
   if((+h.final||0)>=d.hp.cur){L.push(`${d.name} 쓰러질 대미지라 「${n}」 효과는 건너뜀 (버티면 손으로)`);return {lines:L,st:ST}}
   const en=FLING_ST[n];if(en){ST.push({id:d.id,en,from:n});return {lines:L,st:ST}}
   if(isBerry(n,fr)){const E=[];if(eat(d,fr,E))L.push(`${d.name} 「${n}」 효과`,...E);else L.push(`${d.name} 「${n}」 — 효과 없음`)}
   return {lines:L,st:ST}}
  for(const h of hits||[]){const d=b.mons[h.id];if(!d||!h.hit||(d.id===aid&&!(h.self&&(kind==='set'||kind==='add'))))continue;
   const needDmg=kind!=='swap'&&kind!=='give'&&kind!=='set'&&kind!=='add'&&!q.force&&!(/^burn/.test(kind)&&q.cat==='변화');   /* 부식가스(변화기)는 맞기만 하면 */
   if(needDmg&&!h.dmg)continue;if(kind!=='swap'&&kind!=='give'&&sub(d)){if(held(d).length)L.push(`${hd} ${d.name} 대역인형이 막아 소지품은 그대로`);continue}
   if(kind==='burn'||kind==='burnall'){const ks=held(d);if(!ks.length)continue;if(sticky(d)){L.push(`${hd} ${d.name} ${stickyWhy(d)} — 소지품이 파괴되지 않았다`);continue}const keep=keepOf(d,h);const gone=[],stay=[];
    for(const k of ks){const n=nm(slotX(d,k).item);if(locked(d,k)){stay.push(`「${n}」(파괴되지 않음)`);continue}if(keep.has(n)){stay.push(`「${n}」(이번 공격에 먼저 발동)`);continue}takeOut(d,k,'burn',a.name,turn);gone.push(`「${n}」`);if(kind==='burn')break}
    if(gone.length)L.push(`${hd} ${d.name} 의 ${gone.join(' · ')}${J(gone[gone.length-1].slice(1,-1),'을','를')} 파괴했다 (배틀 한정)`);if(stay.length)L.push(`${d.name} ${stay.join(' · ')} 그대로`);continue}
   if(kind==='give'){const an=nm(a.item);if(!an){L.push(`${hd} 건네줄 소지품이 없어 실패했다`);break}if(locked(a,0)){L.push(`${hd} 「${an}」${J(an,'은','는')} 건넬 수 없는 소지품이라 실패했다`);break}
    if(nm(d.item)){L.push(`${hd} ${d.name}${J(d.name,'은','는')} 이미 소지품을 지니고 있어 실패했다`);continue}
    const o=takeOut(a,0,'give',d.name,turn);putIn(d,o);L.push(`${hd} ${a.name} → ${d.name} 「${o.name}」${J(o.name,'을','를')} 건네주었다`);break}
   /* 11-08 망령 「소지품추가」: 지닌 것은 그대로 두고 빈 칸에 하나 더 — 1번 칸이 비면 1번, 아니면 2 · 3번 칸(빈 칸 → 없으면 새 칸, 3칸까지). 배틀 한정(결과 정리는 1번 칸만 시트로) */
   if(kind==='add'){const n2=nm(q.item);if(!n2)break;if(held(d).some(k=>nm(slotX(d,k).item)===n2)){L.push(`${hd} ${d.name}${J(d.name,'은','는')} 이미 「${n2}」${J(n2,'을','를')} 지니고 있다`);continue}
    if(!nm(d.item)){putIn(d,{name:n2});L.push(`${hd} ${d.name} 「${n2}」${J(n2,'을','를')} 지니게 되었다 (배틀 한정)`);continue}
    d.items2=Array.isArray(d.items2)?d.items2:[];let k=d.items2.findIndex(x=>!x||!nm(x.item));if(k<0){if(d.items2.length>=2){L.push(`${hd} ${d.name} 소지품 칸이 꽉 차(3칸) 「${n2}」${J(n2,'을','를')} 더 지니지 못했다`);continue}d.items2.push({item:'',itemEff:''});k=d.items2.length-1}
    const db=(DB().items||{})[n2];d.items2[k]={item:n2,itemEff:(db&&db.eff)||''};d.itemGot=[...(d.itemGot||[]),n2];L.push(`${hd} ${d.name} 소지품 ${k+2}번 칸에 「${n2}」 — 하나 더 지니게 되었다 (배틀 한정)`);continue}
   if(kind==='set'){const n2=nm(q.item);if(!n2)break;if(sticky(d)&&nm(d.item)){L.push(`${hd} ${d.name} ${stickyWhy(d)} — 소지품이 바뀌지 않았다`);continue}if(nm(d.item)&&locked(d,0)){L.push(`${hd} ${d.name} 「${nm(d.item)}」${J(nm(d.item),'은','는')} 바뀌지 않는 소지품이다`);continue}
    const old=nm(d.item);if(old)takeOut(d,0,'set',a.name,turn);putIn(d,{name:n2});L.push(`${hd} ${d.name} ${old?'「'+old+'」 → ':''}「${n2}」${old?'(으)로 바뀌었다':'을(를) 지니게 되었다'} (배틀 한정)`);continue}
   if(kind==='eat'){const keep=keepOf(d,h);const k=held(d).find(k=>{const n=nm(slotX(d,k).item);return isBerry(n,slotRule(d,k))&&!keep.has(n)});if(k==null)continue;const n=nm(slotX(d,k).item);
    if(sticky(d)){L.push(`${hd} ${d.name} ${stickyWhy(d)} — 「${n}」${J(n,'을','를')} 먹지 못했다`);continue}
    const r=slotRule(d,k)||rule(n);takeOut(d,k,'eat',a.name,turn);L.push(`${hd} ${d.name} 의 「${n}」${J(n,'을','를')} 먹었다`);const E=[];if(a.hp.cur>0&&eat(a,r,E))L.push(...E);else L.push(`${a.name} 「${n}」 — 먹었지만 효과 없음`);continue}
   if(kind==='knock'){const ks=held(d);if(!ks.length)continue;if(sticky(d)){L.push(`${hd} ${d.name} ${stickyWhy(d)} — 소지품이 떨어지지 않았다`);continue}const keep=keepOf(d,h);const gone=[],stay=[];
    for(const k of ks){const n=nm(slotX(d,k).item);if(locked(d,k)){stay.push(`「${n}」(뺄 수 없음)`);continue}if(keep.has(n)){stay.push(`「${n}」(이번 공격에 먼저 발동)`);continue}takeOut(d,k,'knock',a.name,turn);gone.push(`「${n}」`)}
    if(gone.length)L.push(`${hd} ${d.name} 의 ${gone.join(' · ')}${J(gone[gone.length-1].slice(1,-1),'을','를')} 떨어뜨렸다`);if(stay.length)L.push(`${d.name} ${stay.join(' · ')} 그대로`);continue}
   if(kind==='steal'){const keep=keepOf(d,h);const k=held(d).find(k=>!locked(d,k)&&!keep.has(nm(slotX(d,k).item)));if(k==null)continue;const n=nm(slotX(d,k).item);
    if(nm(a.item)){L.push(`${hd} 이미 소지품을 지니고 있어 「${n}」${J(n,'을','를')} 빼앗지 못했다`);continue}
    if(sticky(d)){L.push(`${hd} ${d.name} ${stickyWhy(d)} — 「${n}」${J(n,'을','를')} 빼앗지 못했다`);continue}
    const o=takeOut(d,k,'steal',a.name,turn);putIn(a,o);L.push(`${hd} ${d.name} 의 「${o.name}」${J(o.name,'을','를')} 빼앗았다`);continue}
   if(kind==='swap'){if(sub(d)){L.push(`${hd} ${d.name} 대역인형이 막아 실패했다`);break}const an=nm(a.item),dn=nm(d.item);
    if(!an&&!dn){L.push(`${hd} 둘 다 소지품이 없어 실패했다`);break}
    if((an&&locked(a,0))||(dn&&locked(d,0))){L.push(`${hd} 「${an&&locked(a,0)?an:dn}」${J(an&&locked(a,0)?an:dn,'은','는')} 바꿀 수 없는 소지품이라 실패했다`);break}
    if(sticky(d)&&dn){L.push(`${hd} ${d.name} ${stickyWhy(d)} — 실패했다`);break}
    const oa=an?takeOut(a,0,'swap',d.name,turn):null,od=dn?takeOut(d,0,'swap',a.name,turn):null;if(od)putIn(a,od);if(oa)putIn(d,oa);
    L.push(`${hd} ${a.name} ${oa?'「'+oa.name+'」':'(빈손)'} ↔ ${d.name} ${od?'「'+od.name+'」':'(빈손)'} 맞바꿨다`);break}}
  return {lines:L,st:ST}}

 /* ----- 11-08 망령 「1~3」: 소지품을 건드리는 특성 — 공격 적용 뒤 (battle_ui 가 moveFx 다음에 부른다)
    공격 쪽: 「매지션」(명중한 포켓몬의 소지품을 약탈) · 「파괴의논리」(명중 시 파괴) / 맞은 쪽: 「나쁜손버릇」(공격한 포켓몬의 소지품을 약탈)
    매지션 · 나쁜손버릇 「파괴(약탈)」 = 빈손이면 빼앗고, 빼앗을 수 없으면 파괴 (망령 11-08) · 점착이 막는다. 대미지로 맞은 것만, 쓰러진 쪽은 하지 않는다 ----- */
 function traitFx(b,aid,hits,q){const L=[],ST=[];const a=b&&b.mons[aid];if(!a)return {lines:L,st:ST};q=q||{};const dh=(hits||[]).filter(h=>h&&h.hit&&h.dmg&&h.id!==aid);if(!dh.length)return {lines:L,st:ST};
  const run=(who,kind,hs,tn)=>{const R=moveFx(b,who.id,kind,hs,Object.assign({},q,{head:`${who.name} 「${tn}」`}));L.push(...R.lines)};
  if(a.hp.cur>0&&abil(a,/^파괴의논리$/))run(a,'burn',dh,'파괴의논리');
  if(a.hp.cur>0&&abil(a,/^매지션$/)){const h=dh.find(h=>{const d=b.mons[h.id];return d&&held(d).length});if(h)run(a,'rob',[h],'매지션')}   /* 파괴(약탈): 빈손이면 빼앗고, 못 빼앗으면 파괴 */
  for(const h of dh){const d=b.mons[h.id];if(!d||d.hp.cur<=0||d.side===a.side)continue;if(!abil(d,/^나쁜손버릇$/)||!held(a).length)continue;const R=moveFx(b,d.id,'rob',[{id:a.id,hit:true,dmg:true,final:0}],Object.assign({},q,{head:`${d.name} 「나쁜손버릇」`,force:true,eff:{},mt:[]}));L.push(...R.lines)}
  return {lines:L,st:ST}}
 /* ----- 11-08 효과 엔진(fx.js) 「소지품」 구문: op {k:'item', mode, tgt, name} — fx.js 가 대상을 골라 여기로 넘긴다
    mode break(한 칸 파괴) · breakall(모두) · steal(강탈 — 자신이 받음) · give(자신의 것을 건네줌) · swap(맞바꾸기) · set(「소지품 : 이름」으로 만듦) · add(지닌 것은 두고 빈 칸에 하나 더) */
 function itemOp(b,self,ts,op,name){const kind={break:'burn',breakall:'burnall',rob:'rob',steal:'steal',give:'give',swap:'swap',set:'set',add:'add'}[op&&op.mode]||'';if(!kind||!self)return [];
  const hits=(ts||[]).filter(m=>m&&m.id!==self.id).map(m=>({id:m.id,hit:true,dmg:true,final:0}));if(!hits.length&&kind!=='set'&&kind!=='add')return [`『${name||'효과'}』 소지품 — 대상이 없다`];
  if((kind==='set'||kind==='add')&&(ts||[]).some(m=>m&&m.id===self.id))hits.push({id:self.id,hit:true,dmg:true,final:0,self:1});
  const R=moveFx(b,self.id,kind,hits,{force:true,head:`${self.name} 『${name||'효과'}』`,item:op.name||'',turn:+b.turn||0,eff:{}});return R.lines}

 /* ----- 턴 종료 (field.js turnEndStates 에서): 먹다남은음식 · 검은진흙 · 불꽃구슬 · 맹독구슬 · 끈적끈적바늘 ----- */
 function turnEnd(m,lines,H){for(const {r} of all(m)){if(m.hp.cur<=0)return;if(r.te)turnEnd1(m,lines,H,r)}}
 /* 11-07 망령 「턴 종료 시 HP 회복은 중첩 안 돼 — 가장 높은 것만」: 회복하는 소지품 몫은 field.js 가 다른 회복과 함께 견주어 가장 큰 것 하나만 준다 (H.noHeal 이면 여기선 회복을 건너뛴다) */
 function teHeals(m){const out=[];for(const {r} of all(m)){const t=r.te;if(!t)continue;if(t.sludge&&typesOf(m).includes('Poison'))out.push({v:frac(m.hp.max,t.heal),why:`「${r.name}」`});else if(!t.sludge&&t.heal)out.push({v:frac(m.hp.max,t.heal),why:`「${r.name}」`})}return out}
 function turnEnd1(m,lines,H,r){const t=r.te;
  if(t.sludge){if(typesOf(m).includes('Poison')){if(!H.noHeal&&m.hp.cur<m.hp.max)H.heal(m,frac(m.hp.max,t.heal),lines,`「${r.name}」`)}else H.dmg(m,frac(m.hp.max,t.dmg),lines,`「${r.name}」 ${t.dmg}`);return}
  if(t.heal){if(!H.noHeal&&m.hp.cur<m.hp.max)H.heal(m,frac(m.hp.max,t.heal),lines,`「${r.name}」`);return}
  if(t.dmg){H.dmg(m,frac(m.hp.max,t.dmg),lines,`「${r.name}」 ${t.dmg}`);return}
  if(t.st){const st=m.states||{};if(ABN.some(k=>st[k])||st.Comatose)return;const ty=typesOf(m);if(t.st==='Burn'&&ty.includes('Fire'))return;if((t.st==='Toxic'||t.st==='Poison')&&(ty.includes('Poison')||ty.includes('Steel')))return;
   m.states=st;st[t.st]=1000;lines.push(`${m.name} 「${r.name}」 → 「${(((DB().states||{}).st||{})[t.st]||{}).ko||t.st}」`)}}

 /* 소지품 칸 표시용: 이 소지품이 자동으로 하는 일 한 줄 (없으면 '') */
 function summary(name){const r=rule(name);if(!r)return '';const L=[];if(r.atk)L.push('위력');if(r.guard)L.push('완화');if(r.immune)L.push('무효');if(r.resist)L.push('반감');if(r.sash)L.push('버티기');if(r.crit||r.critGuard)L.push('급소');if(r.hp)L.push('HP 열매');if(r.cure)L.push('치유');if(r.seed||r.room)L.push('필드');if(r.hit)L.push('맞을 때');if(r.te)L.push('턴 종료');if(r.onDeal||r.onMiss||r.flinch)L.push('쓴 뒤');if(r.white||r.clearW||r.clearT||r.clearTw)L.push('조건');return L.join(' · ')}
 return {rule,of,all,names,has,atkMul,defGuard,immune,crit,resist,sash,afterAttack,onHit,sweep,turnEnd,teHeals,summary,use,moveKind,moveFx,traitFx,itemOp,KIND_KO,flingInfo,knockable,locked,sticky,slotRule,eat}})();
