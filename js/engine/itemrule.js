/* ---------- 소지품 구문 (2026-10-24 반디) ----------
   소지품 하나가 자동으로 하는 일을 한국어 구문 몇 줄로 적는다. 제작기 소지품 DB 「구문」 칸에 들어가고, 오레마스 js/engine/items.js 가 읽는다.
   · fromEff(이름, 효과 글) — 효과 글(맵툴 DB 꼴)을 읽어 규칙을 만든다 (구문이 비어 있을 때 · 「효과 글에서 만들기」)
   · toText(규칙) → 구문 · parse(구문) → {rule, errs}
   제작기 js/fx/itemrule.js 와 같은 파일이다 — 한쪽을 고치면 다른 쪽도 같이 고친다.

   구문 (한 줄에 하나):
     전용 피카츄/라이츄 · 소모품
     공격 강화 ×1.2 · 공격 강화 물리기 ×1.5 · 공격 강화 타입 불꽃/물 ×1.2 · 공격 강화 단일기 불꽃 ×1.3
     받는 대미지 ×0.67 · 받는 대미지 특수기 ×0.67 · 급소 +1 · 급소 방호 1
     무효 타입 땅 · 반감 타입 불꽃 · 반감 타입 불꽃 효과 굉장 · 반감 물리기 HP 가득 · 반감 전체기
     버티기 HP 가득 · 버티기 10%
     HP 1/4 이하: 회복 1/4, 공격 +1, 무작위 +2      (회복 20 처럼 수도)
     치유 마비/독 · 필드 일렉트릭필드: 방어 +1 · 룸 트릭룸: 스피드 -1 · 날씨 해제 · 필드 철거 · 하락 되돌리기
     맞으면: 공격 +1 · 맞으면 (효과 굉장): 공격 +2, 특공 +2 · 맞으면 (타입 물): 특공 +1 · 맞으면 (물리기): 반사 1/8
       맞으면 (접촉기): 타입 바꾸기 벌레 / 특성 바꾸기 미라 / 옮겨붙는다 · 맞으면: 가장 높은 능력 -1 · 맞으면: 터진다 · 맞으면: 메모 (글)
     턴 종료: 회복 1/16 · 턴 종료: 대미지 1/8 · 턴 종료: 상태 화상 · 턴 종료: 독 타입이면 회복 1/16 아니면 대미지 1/8
     명중하면: 회복 1/8 · 명중하면 (태그 소리): 특공 +1 · 빗나가면: 스피드 +2 · 풀죽음 10% */
"use strict";
window.OM_ITEMRULE=(()=>{
 const FX=()=>window.OM_FX||{};
 const TYPE_KO0={Normal:'노말',Fire:'불꽃',Water:'물',Electric:'전기',Grass:'풀',Ice:'얼음',Fighting:'격투',Poison:'독',Ground:'땅',Flying:'비행',Psychic:'에스퍼',Bug:'벌레',Rock:'바위',Ghost:'고스트',Dragon:'드래곤',Dark:'악',Steel:'강철',Fairy:'페어리',God:'신',Shadow:'그림자',Wild:'야생'};
 const TK=()=>FX().TYPE_KO||TYPE_KO0;
 const tEn=k=>{k=String(k||'').trim();const S=window.OM_STATS;if(S&&S.typeEn){const v=S.typeEn(k);if(v)return v}const T=TK();if(T[k])return k;for(const e in T)if(T[e]===k)return e;return k};
 const tKo=k=>TK()[k]||k;
 const ABN=['Poison','Toxic','Burn','Paralysis','Freeze','Sleep'];
 const stEn=k=>(FX().stEn?FX().stEn(k):'')||'';
 const stKo=k=>(FX().stKo?FX().stKo(k):'')||k;
 const KO_STAT={'공격':'attack','방어':'defense','특공':'specialattack','특방':'specialdefense','스피드':'speed','명중':'accuracy','회피':'evasion','C':'critical','급소':'critical'};
 const STAT_KO={attack:'공격',defense:'방어',specialattack:'특공',specialdefense:'특방',speed:'스피드',accuracy:'명중',evasion:'회피',critical:'급소'};
 const CAT_KO={'물리':'물리기','특수':'특수기'},KO_CAT={'물리기':'물리','특수기':'특수'};
 const SKIP=new Set(['생명의구슬','달인의띠','구애스카프','광각렌즈']);   /* 공격 창에 따로 칸이 있는 것 */
 const nm=s=>String(s||'').replace(/『|』/g,'').trim();
 const num=v=>Math.round(+v*1000)/1000;

 /* ===== 효과 글 → 규칙 (예전 items.js rule() 의 정규식 그대로) ===== */
 function fromEff(name,eff){name=nm(name);const e=String(eff||'').replace(/<br\s*\/?>/g,' ');const r={};let x;
  if(/소모품/.test(e)||name==='멘탈허브')r.once=1;
  const only=e.match(/^((?:「[^」]+」)+)\s*전용/);if(only)r.only=[...only[1].matchAll(/「([^」]+)」/g)].map(a=>a[1]);
  if(!SKIP.has(name)){
   if((x=e.match(/「([^」]+)」 기술의 대미지를 강화\((\d+(?:\.\d+)?)배\)/)))r.atk={types:x[1].split('/').map(tEn),v:+x[2]};
   else if((x=e.match(/「단일기 : ([^」]+)」의 위력을 강화\((\d+(?:\.\d+)?)배\)/)))r.atk={types:[tEn(x[1])],v:+x[2],single:1};
   else if((x=e.match(/「(물리기|특수기)」의 대미지를 강화\((\d+(?:\.\d+)?)배\)/)))r.atk={cat:KO_CAT[x[1]],v:+x[2]};
   else if(!/이하일 때|이상일 때/.test(e)&&((x=e.match(/「([^」]+)」(?:을|를) 강화\((\d+(?:\.\d+)?)배\)/))||(x=e.match(/「([^」]+)」(?:을|를) (\d+(?:\.\d+)?)배로 만든다/)))){
    const ks=x[1].split('/').map(k=>KO_STAT[k.trim()]).filter(Boolean);const v=+x[2];
    if(ks.includes('attack')&&ks.includes('specialattack'))r.atk={v};else if(ks.includes('attack'))r.atk={cat:'물리',v};else if(ks.includes('specialattack'))r.atk={cat:'특수',v};
    if(ks.includes('defense')&&ks.includes('specialdefense'))r.guard={v:num(1/v)};else if(ks.includes('defense'))r.guard={cat:'물리',v:num(1/v)};else if(ks.includes('specialdefense'))r.guard={cat:'특수',v:num(1/v)}}}
  if((x=e.match(/급소에 맞기 쉬워진다\(C\+(\d)\)/)))r.crit=+x[1];if((x=e.match(/급소에 맞기 어려워진다\(C-(\d)\)/)))r.critGuard=+x[1];
  if((x=e.match(/「([^」]+)」 기술을 무효화/)))r.immune=[tEn(x[1])];
  if((x=e.match(/「상성 : 2~8배」인 「([^」]+)」 기술로 받을 대미지를 반감/)))r.resist={type:tEn(x[1]),se:1};
  else if((x=e.match(/「HP : 가득」일 때 「(물리기|특수기)」로 받을 대미지를 반감/)))r.resist={cat:KO_CAT[x[1]],full:1};
  else if(/「전체기」로 받을 대미지를 반감/.test(e))r.resist={multi:1};
  else if((x=e.match(/「([^」]+)」 기술로 받을 대미지를 반감/)))r.resist={type:tEn(x[1])};
  if(/「HP : 가득」일 때 기술 대미지로 「빈사」/.test(e))r.sash='full';else if((x=e.match(/(\d)할로 기술 대미지로 「빈사」/)))r.sash=+x[1]*10;
  if((x=e.match(/「HP : (\d+\/\d+) 이하」일 때 (.+)$/))&&!/명중률/.test(x[2])){const h={frac:x[1]};const t=x[2];let y;
   if((y=t.match(/「HP」를 (\d+\/\d+)만큼 회복/)))h.heal=y[1];else if((y=t.match(/「HP」를 「?(\d+)」?만큼 회복/)))h.heal=+y[1];
   if((y=t.match(/「(공격|방어|특공|특방|스피드) : \+(\d)」/)))h.stats={[KO_STAT[y[1]]]:+y[2]};
   if((y=t.match(/「(?:예리 : )?C ?:? ?\+(\d)」/)))h.stats={critical:+y[1]};
   if((y=t.match(/「무작위한 능력치 : \+(\d)」/)))h.random=+y[1];
   if(h.heal!=null||h.stats||h.random)r.hp=h}
  if(/치유한다/.test(e)){const before=e.split('치유한다')[0];const sts=[...before.matchAll(/「([^」]+)」/g)].map(a=>stEn(a[1])).filter(Boolean);if(/모든 상태 이상/.test(e))sts.push(...ABN);if(sts.length)r.cure=[...new Set(sts)]}
  if((x=e.match(/「필드 : ([^」]+)」일 때 「(방어|특방|공격|특공|스피드) : \+(\d)」/)))r.seed={terrain:x[1],stats:{[KO_STAT[x[2]]]:+x[3]}};
  if((x=e.match(/「(트릭룸|원더룸|매직룸)」이 전개되어 있을 때 「(\S+) : ([+-]\d)」/)))r.room={room:x[1],stats:{[KO_STAT[x[2]]]:+x[3]}};
  if(/「필드의 상태 : 날씨」일 때 「날씨」를 해제/.test(e))r.clearW=1;if(/「필드의 상태 : 필드」일 때 「필드」를 철거/.test(e))r.clearT=1;
  if(/능력 : -」가 되었을 때 해당 능력을 초기화/.test(e))r.white=1;
  const hit=[];
  if(/「상성 : 2~8배」인 기술을 받으면 「공격\/특공 : \+2」/.test(e))hit.push({se:1,stats:{attack:2,specialattack:2}});
  else if((x=e.match(/「([^」]+)」 기술을 받으면 「(\S+) : \+(\d)」/)))hit.push({type:tEn(x[1]),stats:{[KO_STAT[x[2]]]:+x[3]}});
  if((x=e.match(/「(물리기|특수기)」를 받았을 때 「(\S+) : \+(\d)」/)))hit.push({cat:KO_CAT[x[1]],stats:{[KO_STAT[x[2]]]:+x[3]}});
  if((x=e.match(/「(물리기|특수기)」를 받았을 때 대상에게 (\d+\/\d+)의 비례 대미지/)))hit.push({cat:KO_CAT[x[1]],back:x[2]});
  if((x=e.match(/「접촉기」를 받으면 대상에게 (\d+\/\d+)의 비례 대미지/)))hit.push({contact:1,back:x[1]});
  if((x=e.match(/「접촉기」를 받았을 때 대상을 「타입 : ([^」]+)」/)))hit.push({contact:1,setType:tEn(x[1])});
  if((x=e.match(/「접촉기」를 받았을 때 대상을 「특성 : ([^」]+)」/)))hit.push({contact:1,setTrait:x[1]});
  if((x=e.match(/공격을 받으면 대상에게 「가장 높은 능력 : -(\d)」/)))hit.push({yellow:+x[1]});
  if(/공격을 받으면 대상을 강제 교대/.test(e))hit.push({note:'공격한 포켓몬을 강제 교대시킨다 (「퇴장 → 강제 교대」로)'});
  if(/공격을 받으면 임의 교대/.test(e))hit.push({note:'임의 교대할 수 있다 (「퇴장」 → 벤치에서 등장)'});
  if(/공격을 받으면 파괴된다/.test(e))hit.push({pop:1});
  if(/「접촉기」를 받으면 대상에게로 옮겨간다/.test(e))hit.push({contact:1,move:1});
  if(hit.length)r.hit=hit;
  if((x=e.match(/턴 종료 시 「HP」를 (\d+\/\d+)만큼 회복/)))r.te={heal:x[1]};
  if(/「타입 : 독」 : 턴 종료 시 (\d+\/\d+)만큼 「HP」회복/.test(e)){x=e.match(/「타입 : 독」 : 턴 종료 시 (\d+\/\d+)만큼.*?(\d+\/\d+)만큼 비례 대미지/);if(x)r.te={sludge:1,heal:x[1],dmg:x[2]}}
  if((x=e.match(/턴 종료 시 「(화상|맹독|독)」 상태가 된다/)))r.te={st:stEn(x[1])};
  if((x=e.match(/매 턴 종료 시 (\d+\/\d+)의 비례 대미지를 입는다/)))r.te={dmg:x[1]};
  if((x=e.match(/공격이 명중했을 때 자신의 「HP」를 (\d+\/\d+)만큼 회복/)))r.onDeal={heal:x[1]};
  if((x=e.match(/「([^」]+)」 기술이 명중했을 때 자신의 「(\S+) : \+(\d)」/)))r.onDeal={tag:x[1],stats:{[KO_STAT[x[2]]]:+x[3]}};
  if((x=e.match(/명중 판정에 의해서 명중하지 않았을 때 「(\S+) : \+(\d)」/)))r.onMiss={stats:{[KO_STAT[x[1]]]:+x[2]}};
  if((x=e.match(/「(\d)할 : 풀죽음」을 부여/)))r.flinch=+x[1]*10;
  return r}

 /* ===== 규칙 → 구문 ===== */
 const stTxt=st=>Object.keys(st||{}).map(k=>`${STAT_KO[k]||k} ${+st[k]>=0?'+':''}${+st[k]}`).join(', ');
 /* 자동으로 하는 일이 있나 (전용 · 소모품만 있으면 없음) */
 const has=r=>!!r&&Object.keys(r).some(k=>k!=='once'&&k!=='only');
 function toText(r){if(!r)return '';const L=[];
  if(r.only&&r.only.length)L.push('전용 '+r.only.join('/'));if(r.once)L.push('소모품');
  if(r.atk){const a=r.atk;L.push('공격 강화 '+(a.single?'단일기 '+a.types.map(tKo).join('/')+' ':a.types?'타입 '+a.types.map(tKo).join('/')+' ':a.cat?CAT_KO[a.cat]+' ':'')+'×'+num(a.v))}
  if(r.gle)L.push(`조건 ${STAT_KO[r.gle.st]||r.gle.st} ${r.gle.g} 이하`);
  if(r.guard)L.push('받는 대미지 '+(r.guard.cat?CAT_KO[r.guard.cat]+' ':'')+'×'+num(r.guard.v));
  if(r.crit)L.push('급소 +'+r.crit);if(r.critGuard)L.push('급소 방호 '+r.critGuard);
  if(r.immune)L.push('무효 타입 '+r.immune.map(tKo).join('/'));
  if(r.resist){const x=r.resist;L.push('반감 '+(x.multi?'전체기':x.cat?CAT_KO[x.cat]:'타입 '+tKo(x.type))+(x.se?' 효과 굉장':'')+(x.full?' HP 가득':''))}
  if(r.sash)L.push('버티기 '+(r.sash==='full'?'HP 가득':r.sash+'%'));
  if(r.hp){const h=r.hp,A=[];if(h.heal!=null)A.push('회복 '+h.heal);if(h.stats)A.push(stTxt(h.stats));if(h.random)A.push('무작위 +'+h.random);L.push(`HP ${h.frac} 이하: ${A.join(', ')}`)}
  if(r.cure)L.push('치유 '+r.cure.map(stKo).join('/'));
  if(r.seed)L.push(`필드 ${r.seed.terrain}: ${stTxt(r.seed.stats)}`);
  if(r.room)L.push(`룸 ${r.room.room}: ${stTxt(r.room.stats)}`);
  if(r.clearW)L.push('날씨 해제');if(r.clearT)L.push('필드 철거');if(r.white)L.push('하락 되돌리기');
  for(const h of r.hit||[]){const c=h.se?'효과 굉장':h.type?'타입 '+tKo(h.type):h.cat?CAT_KO[h.cat]:h.contact?'접촉기':'';
   const A=[];if(h.stats)A.push(stTxt(h.stats));if(h.back)A.push('반사 '+h.back);if(h.setType)A.push('타입 바꾸기 '+tKo(h.setType));if(h.setTrait)A.push('특성 바꾸기 '+h.setTrait);if(h.yellow)A.push('가장 높은 능력 -'+h.yellow);if(h.pop)A.push('터진다');if(h.move)A.push('옮겨붙는다');if(h.note)A.push('메모 '+h.note);
   L.push(`맞으면${c?` (${c})`:''}: ${A.join(', ')}`)}
  if(r.te){const t=r.te;L.push('턴 종료: '+(t.sludge?`독 타입이면 회복 ${t.heal} 아니면 대미지 ${t.dmg}`:t.heal?'회복 '+t.heal:t.dmg?'대미지 '+t.dmg:t.st?'상태 '+stKo(t.st):''))}
  if(r.onDeal){const o=r.onDeal;L.push(`명중하면${o.tag?` (태그 ${o.tag})`:''}: `+[o.heal?'회복 '+o.heal:'',o.stats?stTxt(o.stats):''].filter(Boolean).join(', '))}
  if(r.onMiss)L.push('빗나가면: '+stTxt(r.onMiss.stats));
  if(r.flinch)L.push('풀죽음 '+r.flinch+'%');
  return L.join('\n')}

 /* ===== 구문 → 규칙 ===== */
 const FR=/^(\d+\/\d+)$/;
 function stats(s,errs,line){const o={};for(const p of String(s).split(/\s*,\s*/)){const m=p.trim().match(/^(공격|방어|특공|특방|스피드|명중|회피|급소|C)\s*([+-]\d)$/);if(!m){errs.push(line);return null}o[KO_STAT[m[1]]]=+m[2]}return o}
 const typeList=s=>String(s).split('/').map(t=>tEn(t.trim())).filter(Boolean);
 function parse(text){const r={},errs=[];const hit=[];
  for(let line of String(text||'').split(/\r?\n/)){line=line.trim();if(!line||/^(#|\/\/)/.test(line))continue;let m;
   const bad=()=>errs.push(line);
   if((m=line.match(/^전용\s+(.+)$/)))r.only=m[1].split('/').map(s=>s.trim()).filter(Boolean);
   else if(line==='소모품')r.once=1;
   else if((m=line.match(/^조건\s+(공격|방어|특공|특방|스피드)\s+([A-Z]+)\s*이하$/)))r.gle={st:KO_STAT[m[1]],g:m[2]};   /* 종족치 등급이 그 이하일 때만 공격 강화 · 받는 대미지가 걸린다 */
   else if((m=line.match(/^공격 강화\s*(?:(단일기|타입)\s+(\S+)\s+|(물리기|특수기)\s+)?[×x*]\s*(\d+(?:\.\d+)?)$/))){const a={v:+m[4]};if(m[1]){a.types=typeList(m[2]);if(m[1]==='단일기')a.single=1}else if(m[3])a.cat=KO_CAT[m[3]];r.atk=a}
   else if((m=line.match(/^받는 대미지\s*(?:(물리기|특수기)\s+)?[×x*]\s*(\d+(?:\.\d+)?)$/))){r.guard={v:+m[2]};if(m[1])r.guard={cat:KO_CAT[m[1]],v:+m[2]}}
   else if((m=line.match(/^급소 방호\s*(\d)$/)))r.critGuard=+m[1];
   else if((m=line.match(/^급소\s*\+(\d)$/)))r.crit=+m[1];
   else if((m=line.match(/^무효 타입\s+(\S+)$/)))r.immune=typeList(m[1]);
   else if((m=line.match(/^반감\s+(?:(전체기)|(물리기|특수기)|타입\s+(\S+))(\s+효과 굉장)?(\s+HP 가득)?$/))){const x={};if(m[1])x.multi=1;else if(m[2])x.cat=KO_CAT[m[2]];else x.type=tEn(m[3]);if(m[4])x.se=1;if(m[5])x.full=1;r.resist=x}
   else if((m=line.match(/^버티기\s+(?:(HP 가득)|(\d+)%)$/)))r.sash=m[1]?'full':+m[2];
   else if((m=line.match(/^HP\s+(\d+\/\d+)\s*이하\s*:\s*(.+)$/))){const h={frac:m[1]};for(const p of m[2].split(/\s*,\s*/)){let y;
     if((y=p.match(/^회복\s+(\d+\/\d+|\d+)$/)))h.heal=FR.test(y[1])?y[1]:+y[1];else if((y=p.match(/^무작위\s*\+(\d)$/)))h.random=+y[1];else{const s=stats(p,errs,line);if(s)h.stats=Object.assign(h.stats||{},s)}}
    r.hp=h}
   else if((m=line.match(/^치유\s+(.+)$/))){const sts=m[1].split('/').map(s=>stEn(s.trim())).filter(Boolean);if(sts.length)r.cure=sts;else bad()}
   else if((m=line.match(/^필드\s+(.+?)\s*:\s*(.+)$/))){const s=stats(m[2],errs,line);if(s)r.seed={terrain:m[1],stats:s}}
   else if((m=line.match(/^룸\s+(.+?)\s*:\s*(.+)$/))){const s=stats(m[2],errs,line);if(s)r.room={room:m[1],stats:s}}
   else if(line==='날씨 해제')r.clearW=1;else if(line==='필드 철거')r.clearT=1;else if(line==='하락 되돌리기')r.white=1;
   else if((m=line.match(/^맞으면\s*(?:\(([^)]*)\))?\s*:\s*(.+)$/))){const h={};const c=(m[1]||'').trim();let y;
     if(c==='효과 굉장')h.se=1;else if((y=c.match(/^타입\s+(\S+)$/)))h.type=tEn(y[1]);else if(KO_CAT[c])h.cat=KO_CAT[c];else if(c==='접촉기')h.contact=1;else if(c){bad();continue}
     const rest=m[2].trim();
     if((y=rest.match(/^메모\s+(.+)$/)))h.note=y[1];
     else for(const p of rest.split(/\s*,\s*/)){let z;
      if((z=p.match(/^반사\s+(\d+\/\d+)$/)))h.back=z[1];else if((z=p.match(/^타입 바꾸기\s+(\S+)$/)))h.setType=tEn(z[1]);else if((z=p.match(/^특성 바꾸기\s+(.+)$/)))h.setTrait=z[1];
      else if((z=p.match(/^가장 높은 능력\s*-(\d)$/)))h.yellow=+z[1];else if(p==='터진다')h.pop=1;else if(p==='옮겨붙는다')h.move=1;
      else{const s=stats(p,errs,line);if(s)h.stats=Object.assign(h.stats||{},s)}}
     hit.push(h)}
   else if((m=line.match(/^턴 종료\s*:\s*(.+)$/))){const t=m[1].trim();let y;
     if((y=t.match(/^독 타입이면 회복\s+(\d+\/\d+)\s+아니면 대미지\s+(\d+\/\d+)$/)))r.te={sludge:1,heal:y[1],dmg:y[2]};else if((y=t.match(/^회복\s+(\d+\/\d+)$/)))r.te={heal:y[1]};
     else if((y=t.match(/^대미지\s+(\d+\/\d+)$/)))r.te={dmg:y[1]};else if((y=t.match(/^상태\s+(.+)$/))&&stEn(y[1]))r.te={st:stEn(y[1])};else bad()}
   else if((m=line.match(/^명중하면\s*(?:\(태그\s+([^)]+)\))?\s*:\s*(.+)$/))){const o={};if(m[1])o.tag=m[1].trim();for(const p of m[2].split(/\s*,\s*/)){let y;if((y=p.match(/^회복\s+(\d+\/\d+)$/)))o.heal=y[1];else{const s=stats(p,errs,line);if(s)o.stats=Object.assign(o.stats||{},s)}}r.onDeal=o}
   else if((m=line.match(/^빗나가면\s*:\s*(.+)$/))){const s=stats(m[1],errs,line);if(s)r.onMiss={stats:s}}
   else if((m=line.match(/^풀죽음\s+(\d+)%$/)))r.flinch=+m[1];
   else bad()}
  if(hit.length)r.hit=hit;
  return {rule:r,errs:[...new Set(errs)]}}

 /* 쓰는 쪽: 구문이 있으면 구문, 없으면 효과 글 */
 function ruleOf(name,item){item=item||{};const a=String(item.auto||'').trim();if(a)return Object.assign(parse(a).rule,{src:'auto'});return Object.assign(fromEff(name,item.eff),{src:'eff'})}
 return {fromEff,toText,parse,ruleOf,has}})();
