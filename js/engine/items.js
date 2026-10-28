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
 function of(m){const n=itemOf(m);if(!n)return null;const tu=m.itemTune;const own=ownOf(m,n);const r=tu&&tu.dsl&&nm(tu.item)===n?tuned(n,tu.dsl,own):own?ownRule(n,own):rule(n);if(!r)return null;if(r.only&&!r.only.some(o=>String(m.species||'').includes(o)||String(m.name||'').includes(o)||String(m.form||'').includes(o)))return null;return r}

 /* ----- 공용 손질 ----- */
 function use(m,lines,b){const name=nm(m.item);if(!name)return;m.itemUsed={name,eff:m.itemEff||'',turn:+((b||{}).turn)||0};try{if(FX())FX().removeByName(m,name)}catch(e){}m.item='';m.itemEff='';lines.push(`「${name}」 — 다 써서 없어졌다`)}
 function rank(m,stats,lines){const out=[];m.rank=m.rank||{};for(const k in stats){const lim=k==='critical'?4:6;const v=+stats[k];const b4=+m.rank[k]||0;const nv=Math.max(-lim,Math.min(lim,b4+v));if(nv===b4){out.push(`${STAT_KO[k]||k} 더 ${v>0?'오르지':'내려가지'} 않는다`);continue}m.rank[k]=nv;out.push(`${STAT_KO[k]||k} ${v>0?'+':''}${nv-b4} (→ ${nv>0?'+':''}${nv})`)}if(out.length)lines.push(`${m.name} ${out.join(' · ')}`)}
 function heal(m,v,lines,why){if((m.states||{}).HealBlock){lines.push(`${m.name} 「회복봉인」이라 ${why} 회복 못 함`);return 0}const h=Math.min(v,m.hp.max-m.hp.cur);if(h<=0)return 0;m.hp.latest=m.hp.cur;m.hp.cur+=h;lines.push(`${m.name} ${why} +${h} (HP ${m.hp.cur}/${m.hp.max})`);return h}
 function hurt(m,v,lines,why){if(FX()&&FX().noind&&FX().noind(m,'')){lines.push(`${m.name} ${why} — 비례 대미지를 받지 않는다`);return 0}const d=Math.min(v,m.hp.cur);if(d<=0)return 0;m.hp.latest=m.hp.cur;m.hp.cur-=d;lines.push(`${m.name} ${why} −${d} (HP ${m.hp.cur}/${m.hp.max})`);if(m.hp.cur<=0){m.entry='';lines.push(`${m.name}은(는) 쓰러졌다!`)}return d}

 /* 「조건 특방 B 이하」 (마제망토): 그 능력의 종족치 등급이 기준 이하일 때만 (등급을 모르면 건다) */
 function gleOk(m,r){const c=r&&r.gle;if(!c)return true;const i={attack:1,defense:2,specialattack:3,specialdefense:4,speed:5}[c.st];const S=window.OM_STATS;const RK=(S&&S.RANKS)||['E','D','C','B','A','AA','AAA','S'];
  let g=String(((m&&m.ranks)||[])[i]||'').replace(/[+-]+$/,'');if(RK.indexOf(g)<0&&S&&S.gradeOf&&m&&m.base)g=String(S.gradeOf(m.base[i])||'').replace(/[+-]+$/,'');const a=RK.indexOf(g),b=RK.indexOf(c.g);return a<0||b<0?true:a<=b}
 /* ----- 공격 창 ----- */
 /* 공격 쪽 위력 배율. q: {types:[en], cat:'물리'|'특수'|'변화', single} → {v, txt, jewel} | null */
 function atkMul(atk,q){const r=of(atk);if(!r||!r.atk||q.cat==='변화'||!gleOk(atk,r))return null;const a=r.atk;
  if(a.types&&!a.types.some(t=>(q.types||[]).includes(t)))return null;if(a.cat&&a.cat!==q.cat)return null;if(a.single&&!q.single)return null;
  return {v:a.v,txt:`「${r.name}」 ×${a.v}`,jewel:!!a.single&&r.once,name:r.name}}
 /* 받는 쪽 완화 (돌격조끼 · 진화의휘석 …) → {v, txt} | null */
 function defGuard(def,cat){const r=of(def);if(!r||!r.guard||!gleOk(def,r))return null;if(r.guard.cat&&r.guard.cat!==cat)return null;const v=Math.round(r.guard.v*1000)/1000;return {v,txt:`${def.name} 「${r.name}」 ×${v}`}}
 /* 받는 쪽 무효 (스펀지 · 횃불) → 소지품 이름 | '' */
 function immune(def,types){const r=of(def);return r&&r.immune&&r.immune.some(t=>(types||[]).includes(t))?r.name:''}
 function crit(atk,def){let v=0;const a=of(atk),d=of(def);if(a&&a.crit)v+=a.crit;if(d&&d.critGuard)v-=d.critGuard;return v}
 /* 받는 쪽 반감열매가 이 공격에 맞나. lh: lastHit {mt, cat, eff, multi} → 열매 이름 | '' */
 function resist(def,lh){const r=of(def);if(!r||!r.resist||!lh)return '';const x=r.resist;
  if(x.type&&!(lh.mt||[]).includes(x.type))return '';if(x.se&&!(+lh.eff>=2))return '';if(x.cat&&x.cat!==lh.cat)return '';if(x.full&&def.hp.cur<def.hp.max)return '';if(x.multi&&!lh.multi)return '';if(!x.type&&!x.cat&&!x.multi)return '';return r.name}
 /* 기합의띠(HP 가득) · 기합의머리띠(1할) → {name, sure} | null */
 function sash(def){const r=of(def);if(!r||!r.sash)return null;if(r.sash==='full')return def.hp.cur>=def.hp.max?{name:r.name,sure:1,once:r.once}:null;return {name:r.name,pct:r.sash,once:r.once}}

 /* 공격을 적용한 뒤 공격 쪽: 쥬얼 소모 · 조개껍질방울 · 목스프레이 · 허탕보험 · 풀죽음(왕의징표석) — b 사본을 고친다
    info: {jewel, dealt:[def id], missAll, tags:[...]} */
 function afterAttack(b,atk,info){const L=[];const r=of(atk);if(!r||atk.hp.cur<=0)return L;const hitAny=(info.dealt||[]).length>0;
  if(info.jewel&&hitAny&&r.atk&&r.atk.single){L.push(`${atk.name} 「${r.name}」으로 위력이 올랐다`);use(atk,L,b)}
  if(r.onDeal&&hitAny){const o=r.onDeal;if(o.heal)heal(atk,frac(atk.hp.max,o.heal),L,`「${r.name}」`);if(o.stats&&(!o.tag||(info.tags||[]).includes(o.tag))){L.push(`${atk.name} 「${r.name}」 발동`);rank(atk,o.stats,L);if(r.once)use(atk,L,b)}}
  if(r.onMiss&&info.missAll){L.push(`${atk.name} 「${r.name}」 발동 — 빗나갔다`);rank(atk,r.onMiss.stats,L);if(r.once)use(atk,L,b)}
  if(r.flinch&&hitAny)for(const id of info.dealt){const d=b.mons[id];if(!d||d.hp.cur<=0)continue;const roll=1+Math.floor(Math.random()*100);
   if(roll<=r.flinch){if(itemOf(d)!=='은밀망토'){d.states=d.states||{};if(!d.states.Flinch){d.states.Flinch=1;L.push(`${d.name} 「${r.name}」으로 풀이 죽었다 (${roll}/${r.flinch})`)}}}
   else L.push(`${d.name} 「${r.name}」 풀죽음 실패 (${roll}/${r.flinch})`)}
  return L}

 /* ----- HP 창: 맞은 뒤 받는 쪽 반응. b 사본 · def(맞은 쪽) · lh(lastHit) · dealt(받은 피해) · n(맞은 타 수, 연속기) ----- */
 function onHit(b,def,lh,dealt,n){const L=[];const r=of(def);if(!r||!r.hit||!(dealt>0))return L;const atk=b.mons[lh.fromId];let gone=false;
  const times=r.once?1:Math.max(1,+n||1);   /* 10-27 망령: 한 번 쓰고 없어지지 않는 것(울퉁불퉁멧 등)은 맞은 타마다 */
  const fire=()=>{if(!L.length)L.push(`${def.name} 「${r.name}」 발동`)};
  for(const h of r.hit){if(gone)break;
   if(h.pop){fire();L.push(`${def.name}의 「${r.name}」이(가) 터졌다!`);use(def,L,b);gone=true;break}
   if(h.se&&!(+lh.eff>=2))continue;if(h.type&&!(lh.mt||[]).includes(h.type))continue;if(h.cat&&h.cat!==lh.cat)continue;if(h.contact&&!lh.ct)continue;
   if(def.hp.cur<=0&&!h.back&&!h.yellow&&!h.setType&&!h.setTrait)continue;   /* 쓰러졌으면 자기 강화는 없다 · 되갚는 것은 한다 */
   fire();
   if(h.stats)for(let i=0;i<times;i++)rank(def,h.stats,L);
   if(h.back)for(let i=0;i<times;i++){if(atk&&atk.hp.cur>0)hurt(atk,frac(atk.hp.max,h.back),L,`「${r.name}」 ${h.back}${times>1?` (${i+1}타)`:''}`)}
   if(h.yellow&&atk&&atk.hp.cur>0){const ks=['attack','defense','specialattack','specialdefense','speed'];let best=ks[0],bv=-1;for(const k of ks){const v=B()&&B().statValue?B().statValue(atk,k).value:0;if(v>bv){bv=v;best=k}}rank(atk,{[best]:-h.yellow},L)}
   if(h.setType&&atk&&atk.hp.cur>0){atk.typesOrig=atk.typesOrig||(atk.types||[]).slice();atk.typesBy=r.name;atk.types=[h.setType];L.push(`${atk.name} 타입 → ${S()&&S().typeKo?S().typeKo(h.setType):h.setType}`)}
   if(h.setTrait&&atk&&atk.hp.cur>0){if(FX()&&FX().setAb)FX().setAb(atk,h.setTrait,r.name);else{if(atk.abilityOrig==null)atk.abilityOrig=atk.ability||'';atk.abilityBy=r.name;atk.ability=h.setTrait}L.push(`${atk.name} 특성 → 「${h.setTrait}」`)}
   if(h.move){if(atk&&atk.hp.cur>0&&!nm(atk.item)){atk.item=def.item;atk.itemEff=def.itemEff||'';def.item='';def.itemEff='';L.push(`「${r.name}」이(가) ${atk.name}에게 옮겨붙었다`);gone=true}continue}
   if(h.note)L.push(`${def.name} — ${h.note}`);
   if(r.once){use(def,L,b);gone=true}}
  return L}

 /* ----- 저장 뒤 점검: 조건이 맞으면 바로 터지는 소지품 (HP 열매 · 치유 열매 · 시드 · 룸서비스 · 하양허브 · 웨더클리너 · 필드롤러)
    b 사본 · f 필드 사본 · can(m) 이 화면이 고칠 수 있나 → [{mid, name, lines}] ----- */
 function sweep(b,f,can){const out=[];
  for(const id in b.mons||{}){const m=b.mons[id];if(!m.entry||m.hp.cur<=0||(can&&!can(m)))continue;const r=of(m);if(!r)continue;const L=[];
   if(r.hp){const fr=(/먹보/.test(m.ability||'')&&r.hp.frac==='1/4')?'1/2':r.hp.frac;const lim=Math.floor(m.hp.max*+fr.split('/')[0]/+fr.split('/')[1]);
    if(m.hp.cur<=lim){const h=r.hp;L.push(`「HP」 ${fr} 이하`);if(h.heal!=null){if((m.states||{}).HealBlock){L.length=0}else heal(m,typeof h.heal==='number'?h.heal:frac(m.hp.max,h.heal),L,'회복')}
     if(h.stats)rank(m,h.stats,L);if(h.random){const ks=['attack','defense','specialattack','specialdefense','speed'].filter(k=>(+(m.rank||{})[k]||0)<6);if(ks.length)rank(m,{[ks[Math.floor(Math.random()*ks.length)]]:h.random},L)}
     if(L.length&&r.once)use(m,L,b)}}
   else if(r.cure){const st=m.states||{};const hit=r.cure.filter(k=>st[k]);if(hit.length){for(const k of hit)delete st[k];L.push(`${hit.map(k=>'「'+((((DB().states||{}).st||{})[k]||{}).ko||k)+'」').join(' · ')} 치유`);if(r.once)use(m,L,b)}}
   else if(r.seed&&f&&(f.terrain||{}).type===r.seed.terrain){L.push(`「${r.seed.terrain}」`);rank(m,r.seed.stats,L);if(r.once)use(m,L,b)}
   else if(r.room&&f&&+((f.rooms||{})[r.room.room]||0)>0){L.push(`「${r.room.room}」`);rank(m,r.room.stats,L);if(r.once)use(m,L,b)}
   else if(r.white){const neg=Object.keys(m.rank||{}).filter(k=>k!=='critical'&&+m.rank[k]<0);if(neg.length){for(const k of neg)m.rank[k]=0;L.push(`${neg.map(k=>STAT_KO[k]||k).join(' · ')} 하락을 되돌렸다`);if(r.once||/허브/.test(r.name))use(m,L,b)}}
   else if(r.clearW&&f&&(f.weather||{}).type){L.push(`날씨 「${f.weather.type}」 해제`);f.weather={type:'',count:0};use(m,L,b)}
   else if(r.clearT&&f&&(f.terrain||{}).type){L.push(`「${f.terrain.type}」 철거`);f.terrain={type:'',count:0};use(m,L,b)}
   if(L.length)out.push({mid:id,name:r.name,eff:r.eff,lines:L})}
  return out}

 /* ----- 턴 종료 (field.js turnEndStates 에서): 먹다남은음식 · 검은진흙 · 불꽃구슬 · 맹독구슬 · 끈적끈적바늘 ----- */
 function turnEnd(m,lines,H){const r=of(m);if(!r||!r.te||m.hp.cur<=0)return;const t=r.te;
  if(t.sludge){if(typesOf(m).includes('Poison')){if(m.hp.cur<m.hp.max)H.heal(m,frac(m.hp.max,t.heal),lines,`「${r.name}」`)}else H.dmg(m,frac(m.hp.max,t.dmg),lines,`「${r.name}」 ${t.dmg}`);return}
  if(t.heal){if(m.hp.cur<m.hp.max)H.heal(m,frac(m.hp.max,t.heal),lines,`「${r.name}」`);return}
  if(t.dmg){H.dmg(m,frac(m.hp.max,t.dmg),lines,`「${r.name}」 ${t.dmg}`);return}
  if(t.st){const st=m.states||{};if(ABN.some(k=>st[k])||st.Comatose)return;const ty=typesOf(m);if(t.st==='Burn'&&ty.includes('Fire'))return;if((t.st==='Toxic'||t.st==='Poison')&&(ty.includes('Poison')||ty.includes('Steel')))return;
   m.states=st;st[t.st]=1000;lines.push(`${m.name} 「${r.name}」 → 「${(((DB().states||{}).st||{})[t.st]||{}).ko||t.st}」`)}}

 /* 소지품 칸 표시용: 이 소지품이 자동으로 하는 일 한 줄 (없으면 '') */
 function summary(name){const r=rule(name);if(!r)return '';const L=[];if(r.atk)L.push('위력');if(r.guard)L.push('완화');if(r.immune)L.push('무효');if(r.resist)L.push('반감');if(r.sash)L.push('버티기');if(r.crit||r.critGuard)L.push('급소');if(r.hp)L.push('HP 열매');if(r.cure)L.push('치유');if(r.seed||r.room)L.push('필드');if(r.hit)L.push('맞을 때');if(r.te)L.push('턴 종료');if(r.onDeal||r.onMiss||r.flinch)L.push('쓴 뒤');if(r.white||r.clearW||r.clearT)L.push('조건');return L.join(' · ')}
 return {rule,of,atkMul,defGuard,immune,crit,resist,sash,afterAttack,onHit,sweep,turnEnd,summary,use}})();
