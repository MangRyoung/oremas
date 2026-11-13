/* ---------- 상태 변화 · 설치기 · 필드 자동 처리 (맵툴 check_attack / state_turnend / hazard_eval·apply / field_turnend 를 옮김) ----------
   모두 순수 함수: 포켓몬·필드 사본을 받아 고치고, 로그 줄을 돌려준다. */
"use strict";
window.OM_FIELD=(()=>{
 const DB=()=>window.OM_DB||{}, B=()=>window.OM_BATTLE;
 const has=(m,k)=>!!((m.states||{})[k]);
 const C=()=>(DB().const||{}).campaign||{};
 const pct=(k,def)=>{const v=C()['percent_'+k];if(v==null||v==='')return def;const m=String(v).match(/^(\d+)\s*\/\s*(\d+)$/);return m?+m[1]/+m[2]:(+v>1?+v/100:+v)};
 const d10000=()=>1+Math.floor(Math.random()*10000);
 const ko=k=>{const st=(DB().states||{}).st||{};return (st[k]&&st[k].ko)||k};
 const typesOf=m=>(m.teraActive&&m.teraEn&&m.teraEn!=='-')?[m.teraEn]:(m.types||[]).filter(t=>t&&t!=='-');
 const frac=(m,n,d)=>Math.max(1,Math.floor(m.hp.max*n/d));
 /* 10-22 망령: 시트에 적어 둔 상태 변화 사양 (『수선녀의 요술』 「아쿠아링」 1/8 → 1/6 등) — OM_FX.stMod. sf(m,'AquaRing',1,8) = [양, 표시] */
 const sf=(m,en,n,d)=>{const o=FX()&&FX().stMod?FX().stMod(m,en):null;if(o&&o.d>0)return [frac(m,o.n,o.d),`${o.n}/${o.d} 『${o.name}』`];return [frac(m,n,d),`${n}/${d}`]};
 const dmg=(m,v,lines,why)=>{v=+v;if(!isFinite(v))return 0;if(noind(m,'')){lines.push(`${m.name} ${why} — 비례 대미지를 받지 않는다`);return 0}const floor=noind(m,'noko')?1:0;const d=Math.max(0,Math.min(m.hp.cur-floor,v));if(d<=0){if(floor)lines.push(`${m.name} ${why} — 비례 대미지로는 빈사가 되지 않는다`);return 0}m.hp.cur-=d;lines.push(`${m.name} ${why} −${d} (HP ${m.hp.cur}/${m.hp.max})`);return d};
 const heal=(m,v,lines,why)=>{if(has(m,'HealBlock')){lines.push(`${m.name} ${why} — 「회복봉인」이라 회복하지 못함`);return 0}const h=Math.min(v,m.hp.max-m.hp.cur);if(h<=0)return 0;m.hp.cur+=h;lines.push(`${m.name} ${why} +${h} (HP ${m.hp.cur}/${m.hp.max})`);return h};
const FX=()=>window.OM_FX;
 const ABN=['Poison','Toxic','Burn','Paralysis','Freeze','Sleep','Comatose'];
 const isAbn=m=>ABN.some(k=>has(m,k));
  const magic=()=>!!(FX()&&FX().magicRoom&&FX().magicRoom());
 /* 11-08 23:12 망령 「금제와 서투름은 지닌 효과도 전부 꺼」: 「금제」 상태 · 특성 「서투름」(특성 파괴 중이면 아님)이면 매직룸처럼 그 포켓몬의 소지품 효과가 없다 */
 const itemOff=m=>!!m&&(magic()||has(m,'Embrago')||has(m,'Embargo')||(/^\s*『?서투름』?\s*$/.test(String(m.ability||''))&&!has(m,'TraitBroken')));
 const itemOffWhy=m=>!m?'':magic()?'매직룸':(has(m,'Embrago')||has(m,'Embargo'))?'금제':itemOff(m)?'서투름':'';
 const itemOf=m=>itemOff(m)?'':(m.item||'');   /* 매직룸 · 금제 · 서투름 동안 소지품 효과 없음 */
 /* 11-05 망령: 소지품 2 · 3번 칸까지 (이름을 이어 붙인 글 — 정규식 검사용) */
 const itemsOf=m=>!m||itemOff(m)?'':[m.item,...(m.items2||[]).map(x=>x&&x.item)].filter(Boolean).join(' ');
 /* 꺼진 소지품에서 온 능력 배율(레디메이드 「배율」 — m.mod 에 곱해 둔 것)을 되돌릴 몫: statValue 가 나눈다 */
 const itemOffMult=(m,stat)=>{if(!itemOff(m))return 1;const N=[m.item,...(m.items2||[]).map(x=>x&&x.item)].map(x=>String(x||'').replace(/『|』/g,'').trim()).filter(Boolean);let v=1;for(const e of ((m.fx||{}).mults||[])){const k=String(e.key||e.name||'').split(' ← ')[0].replace(/『|』/g,'').trim();if(N.includes(k)&&e.stats&&+e.stats[stat])v*=+e.stats[stat]}return v};
 const tblock=(m,k)=>FX()&&FX().terrainBlock?FX().terrainBlock(m,k):'';
 const grounded=m=>/검은철구/.test(itemsOf(m))||has(m,'SmackDown')||   /* 11-08 51-2 ㉑ 「떨어뜨리기」 = 땅에 떨어진다 */!(typesOf(m).includes('Flying')||/풍선/.test(itemsOf(m))||has(m,'MagnetRise')||has(m,'Telekinesis')||has(m,'Fly')||/부유/.test(m.ability||'')||(FX()&&FX().floating(m)));
 const noind=(m,k)=>!!(FX()&&FX().noind(m,k));
 /* 11-09: 「감소무시」(fx nodrop) 가 있으면 내리지 않는다 — 끈적끈적네트 · 문어굳히기 · 물엿범벅. 내렸으면 true */
 const rankDown=(m,k,n)=>{{const F=window.OM_FX;if(F&&F.rkRedir&&n)k=F.rkRedir(m,k,n)}   /* 11-10 랭크전환 */if(n<0){const FX=window.OM_FX;const nd=FX&&FX.nodropHit?FX.nodropHit(m,k):'';if(nd){m._nd=nd;return false}}m.rank=m.rank||{};m.rank[k]=Math.max(-6,Math.min(6,(+m.rank[k]||0)+n));return true};
 const setState=(m,k,count)=>{m.states=m.states||{};if(m.states[k])return false;const st=((DB().states||{}).st||{})[k]||{};{const d=st;m.states[k]=count!=null?count:(d.min>=1000||!d.min?1000:(+d.max>+d.min&&+d.max<1000?+d.min+Math.floor(Math.random()*(+d.max-+d.min+1)):+d.min))}return true};
 const clearState=(m,k)=>{if(m.states)delete m.states[k]};
 const curTurn=()=>{try{const t=(((window.OM_APP||{}).ST||{}).state||{}).battle;return t&&t.turn!=null?+t.turn:null}catch(e){return null}};   /* 11-08: 잠듦 깨는 턴 (m.wakeT) */

 /* ----- 행동 판정 (check_attack): 풀죽음 → 잠듦 → 마비 → 얼음 → 헤롱헤롱 → 혼란. 돌려줌 {ok, selfHit, lines} ----- */
 function actionCheck(m){const lines=[];const st=m.states||{};let failed=0;
  const roll=(k,p,failMsg,okMsg,invert)=>{if(failed||!st[k])return;const d=d10000();const lim=Math.round(p*10000);const hit=d<=lim;if(hit){failed=k==='Confusion'?2:1;lines.push(`${m.name}${failMsg} (판정 ${invert?10000-d:d})`);if(k==='Flinch')clearState(m,'Flinch')}else lines.push(`${m.name}${okMsg} (판정 ${invert?10000-d:d})`)};
  roll('Flinch',pct('flinch',1),'은(는) 풀이 죽어 움직일 수 없다...','');
  /* 10-26 망령: 깨어나는 턴엔 바로 행동한다 (전엔 그 턴도 실패로 끝났다)
     11-08 감우 (망령 「혼란 · 잠듦 · 얼음 같이 고쳐」): 「N턴」 = 그 상태로 막히는 행동 N번. 예전엔 판정 전에 1 을 빼서 N-1 번뿐이었다(1턴이면 바로 깸).
     잠듦은 마지막으로 잠든 행동 뒤에도 그 턴 끝까지는 잠든 채(악몽 · 꿈먹기 …) — m.wakeT = 그 턴, 턴 종료(turnEndStates)에 깬다. 같은 턴에 또 행동하면 그대로 잠듦. 1000 이상(영구)은 줄이지 않는다 */
  if(!failed&&st.Sleep){const d=d10000();const lim=Math.round(pct('sleep',1)*10000);const n0=+st.Sleep||1;const T=curTurn();
   if(m.wakeT!=null&&T!=null&&+m.wakeT===T){failed=1;lines.push(`${m.name}은(는) 쿨쿨 잠자고 있다... (이번 턴 끝에 깬다)`)}
   else if(m.wakeT!=null&&T!=null&&+m.wakeT<T){delete m.wakeT;clearState(m,'Sleep');lines.push(`${m.name}은(는) 눈을 떴다!`)}
   else if(d<=lim){failed=1;const left=n0>=1000?n0:n0-1;if(left<=0){if(T!=null){m.wakeT=T;lines.push(`${m.name}은(는) 쿨쿨 잠자고 있다... (이번 턴 끝에 깬다)`)}else{clearState(m,'Sleep');lines.push(`${m.name}은(는) 쿨쿨 잠자고 있다... (다음 행동부터 깬다)`)}}else{m.states.Sleep=left;lines.push(`${m.name}은(는) 쿨쿨 잠자고 있다...${left<1000?` (남은 ${left}턴)`:''}`)}}}
  roll('Paralysis',pct('paralysis',1/8),'은(는) 몸이 저려서 움직일 수 없다...','은(는) 몸이 저려도 지시를 따른다!');
  /* 얼음: 「N턴」 = 얼어서 막힐 수 있는 행동 N번(DB 2 → 3번째 기술에서 풀림). 그 사이엔 3/4 로 못 움직이고 1/4 로 깨고 나온다. 11-08 감우: 예전엔 판정 전에 1 을 빼서 N-1 번뿐이었다 */
  if(!failed&&st.Freeze){const d=d10000();const lim=Math.round(pct('freeze',3/4)*10000);const n0=+st.Freeze||1;const left=n0>=1000?n0:n0-1;if(d<=lim){failed=1;if(left<=0){clearState(m,'Freeze');lines.push(`${m.name}은(는) 얼어붙어 움직일 수 없다... (판정 ${10000-d}) — 얼음이 녹기 시작했다! (다음 행동부터 움직인다)`)}else{m.states.Freeze=left;lines.push(`${m.name}은(는) 얼어붙어 움직일 수 없다... (${left<1000?`남은 ${left} · `:''}판정 ${10000-d})`)}}else{clearState(m,'Freeze');lines.push(`${m.name}은(는) 얼음을 깨부수고 나왔다! (판정 ${10000-d})`)}}
  roll('Attract',pct('attract',1/2),'은(는) 이상형에게 홀딱 반해있다...','은(는) 정신을 차리고 지시를 따른다!');
  /* 11-08 감우 (망령 「혼란 1턴만 걸린다」): 혼란 N턴 = 혼란 상태로 행동하는 횟수 N (DB 1~4). 판정을 먼저 하고, 마지막 판정 뒤에 푼다. 1000 이상(영구 · 파괴의유전자)은 줄이지 않는다 */
  if(!failed&&st.Confusion){const d=d10000();const lim=Math.round(pct('confusion',1/3)*10000);const n0=+st.Confusion||1;const left=n0>=1000?n0:n0-1;if(d<=lim){failed=2;lines.push(`${m.name}은(는) 영문도 모르고 스스로를 공격했다...! (판정 ${d})`)}else lines.push(`${m.name}은(는) 혼란스러워 하면서도 지시를 따른다! (판정 ${d})`);if(left<=0){clearState(m,'Confusion');lines.push(`${m.name}의 혼란이 풀렸다!`)}else{m.states.Confusion=left;if(left<1000)lines.push(`${m.name} 「혼란」 남은 ${left}턴`)}}
  return {ok:failed===0,selfHit:failed===2,lines}}
 /* 혼란 자작 대미지: 위력 40 노말 물리, 상성·랭크 무시 (공격/방어 실수치만) */
 function confusionHit(m){const st=B().statValue;const A=st(m,'attack').value,D=st(m,'defense').value;const base=Math.floor(Math.floor(Math.floor(2*m.lv/5+2)*40*A/D)/50)+2;return Math.max(1,Math.floor(base*(85+Math.floor(Math.random()*16))/100))}

 /* ----- 턴 종료 상태 처리 (state_turnend). mons: 사본, slots: {slot:mon} (씨뿌리기 회복 상대 찾기) ----- */
 /* 11-07 23:37 망령 「턴 종료 시 HP 회복은 중첩 안 돼. 가장 높은 것만」: 희망사항 · 아쿠아링 · 뿌리박기 · 환희의노래 · 회복 소지품 · 그래스필드 중 가장 큰 것 하나만.
    opt.field 를 주면 그래스필드도 여기서 견준다(turnEndField 는 opt.noGrass). 턴 종료 단계에서 특성 · 포텐셜로 먼저 회복한 몫(m.teHeal {t,v})이 있으면 그보다 큰 만큼만 더 준다 */
 function turnEndStates(mons,slots,opt){opt=opt||{};const lines=[];const dead=[];const fld=opt.field||null;const T=opt.turn;
  /* 11-08 감우: 마지막으로 잠든 행동을 한 턴(m.wakeT)이 끝나면 깬다 — 다음 행동부터 움직인다. 잠듦이 이미 풀렸으면 표만 지운다 */
  for(const id in mons){const m=mons[id];if(!m||m.wakeT==null)continue;if(T!=null&&+m.wakeT>+T)continue;const was=has(m,'Sleep');delete m.wakeT;if(was){clearState(m,'Sleep');if(m.hp&&m.hp.cur>0)lines.push(`${m.name}은(는) 눈을 떴다!`)}}
  /* 11-13 22:16 망령 제보 「먹밥 힐이 상태이상 딜보다 먼저 들어간다」 — 룰북 턴 종료 순서대로 모두를 한 단계씩:
     ① 가장 마지막에(미래예지 — battle_ui) ② 돌아와 ③ 슬립 대미지(독 · 화상 … · 날씨는 battle_ui 가 이 앞에 turnEndField) ④ 드레인(씨뿌리기) ⑤ 회복(먹다남은음식 · 아쿠아링 · 그래스필드 …) ⑥ 카운트 · 맹독구슬 등 ⑦ 턴 종료 */
  const LIVE=[];for(const id in mons){const m=mons[id];if(!m.entry||m.hp.cur<=0||has(m,'Dead'))continue;LIVE.push(m)}
  const each=fn=>{for(const m of LIVE){if(m.hp.cur<=0)continue;const st=m.states||{};const sleeping=has(m,'Sleep')||has(m,'Comatose');fn(m,st,sleeping)}};
  /* ③ 슬립 대미지 */
  each((m,st,sleeping)=>{
   if(st.Toxic){m.toxicN=Math.min(15,(+m.toxicN||0)+1);dmg(m,frac(m,m.toxicN,16),lines,`「맹독」 ${m.toxicN}/16`)}else m.toxicN=0;
   if(st.Poison){const [v,tx]=sf(m,'Poison',1,8);dmg(m,v,lines,`「독」 ${tx}`)}if(st.Burn){const [v,tx]=sf(m,'Burn',1,16);dmg(m,v,lines,`「화상」 ${tx}`)}
   if(st.Nightmare&&sleeping){const [v,tx]=sf(m,'Nightmare',1,4);dmg(m,v,lines,`「악몽」 ${tx}`)}if(st.Curse){const [v,tx]=sf(m,'Curse',1,4);dmg(m,v,lines,`「저주」 ${tx}`)}if(st.Bind){/* 11-08 51-2 ⑪ 조임밴드: 조이기를 건 쪽(m.bindFrom)이 지니면 1/8 → 1/6 */const bf=m.bindFrom&&mons[m.bindFrom];const band=bf&&/조임밴드/.test(itemsOf(bf));const [v,tx]=band?[frac(m,1,6),'1/6 「조임밴드」']:sf(m,'Bind',1,8);dmg(m,v,lines,`「바인드」 ${tx}`)}
   if(st.SaltCure){const ty=typesOf(m);const sw=ty.includes('Steel')||ty.includes('Water');dmg(m,sw?frac(m,1,6):frac(m,1,8),lines,`「소금절이」 ${sw?'1/6':'1/8'}`)}
   if(st.ThunderCage){const mul=B().effectiveness(['Electric'],m,{}).value;if(mul>0)dmg(m,Math.max(1,Math.floor(m.hp.max/8*mul)),lines,`「썬더프리즌」 전기 1/8 ×${mul}`);else lines.push(`${m.name} 「썬더프리즌」 전기 타입 효과가 없음`)}
  });
  /* ④ 드레인 */
  each((m,st,sleeping)=>{
   if(st.LeechSeed){const from=m.seedFrom||((m.side==='left'?'right':'left')+'_'+m.entry);const to=slots[from];if(!to||to.hp.cur<=0)lines.push(`${m.name} 「씨뿌리기」 씨를 뿌린 ${String(from).split('_')[1].toUpperCase()} 에리어에 포켓몬이 없어 회복 없음`);else{const [v,tx]=sf(m,'LeechSeed',1,8);const d=dmg(m,v,lines,`「씨뿌리기」 드레인 ${tx}`);if(d>0)heal(to,d,lines,`「씨뿌리기」(${m.name})`)}}
  });
  /* ⑤ 회복 — 가장 높은 것 하나만 */
  each((m,st,sleeping)=>{
   const HC=[];const hc=(m2,v,ln,why)=>{HC.push({v,why});return 0};   /* 희망사항: 건 턴은 표시만, 다음 턴 종료에 1/2 */
   if(st.Wish){const [wv,wt]=sf(m,'Wish',1,2);if(!m.wishWait){m.wishWait=1;lines.push(`${m.name} 「희망사항」 다음 턴 종료 시 ${wt} 회복`)}else{m.wishWait=0;hc(m,wv,lines,`「희망사항」 ${wt}`);clearState(m,'Wish')}}
   for(const [k,n,d,ko] of [['AquaRing',1,8,'아쿠아링'],['Ingrain',1,16,'뿌리박기'],['Chant',1,16,'환희의노래']])if(st[k]){const [v,tx]=sf(m,k,n,d);hc(m,v,lines,`「${ko}」 ${tx}`)}
   if(window.OM_ITEMS&&window.OM_ITEMS.teHeals)HC.push(...window.OM_ITEMS.teHeals(m));
   if(fld&&(fld.terrain||{}).type==='그래스필드'){if(grounded(m))HC.push({v:frac(m,1,16),why:'「그래스필드」'});else lines.push(`${m.name} 땅 위가 아니라 그래스필드 회복 제외`)}
   {const pr=m.teHeal&&(T==null||+m.teHeal.t===+T)?(+m.teHeal.v||0):0;if(HC.length){HC.sort((a,b)=>b.v-a.v);const top=HC[0];const add=top.v-pr;
     if(add>0&&m.hp.cur<m.hp.max)heal(m,add,lines,top.why+(pr>0?` (먼저 ${pr} 회복한 몫을 뺀 나머지)`:''));
     if(HC.length>1||pr>0)lines.push(`${m.name} 턴 종료 회복은 가장 높은 것만 — ${HC.slice(1).map(x=>x.why+' '+x.v).concat(pr>0&&add<=0?[`${top.why} ${top.v}`]:[]).join(' · ')||'나머지'} 안 겹침`)}}
   delete m.teHeal;
  });
  /* ⑥ 그 밖 카운트 · 소지품(맹독구슬 · 불꽃구슬 · 끈적끈적바늘 …) */
  each((m,st,sleeping)=>{
   if(st.OctoLock){rankDown(m,'defense',-1);rankDown(m,'specialdefense',-1);lines.push(`${m.name} 「문어굳히기」 방어·특방 −1`)}
   if(st.SyrupBomb){m.syrupN=(+m.syrupN||0)+1;rankDown(m,'speed',-1);lines.push(`${m.name} 「물엿범벅」 스피드 −1 (${m.syrupN}/3)`);if(m.syrupN>=3){clearState(m,'SyrupBomb');m.syrupN=0}}
   if(st.DeathCount){const c=+st.DeathCount||0;if(c<=1){lines.push(`${m.name} 「죽음의카운트」 0 · 「빈사」`);m.hp.cur=0;dead.push(m.id)}else lines.push(`${m.name} 「죽음의카운트」 ${c-1}`)}
   for(const [k,to,kn,tn] of [['Yawn','Sleep','하품','잠듦'],['Hibernation','Freeze','동면','얼음']]){if(!st[k])continue;const c=+st[k]||0;if(c>1)continue;const tb=tblock(m,to);if(tb)lines.push(`${m.name} 「${kn}」 땅 위라서 「${tb}」가 「${tn}」을(를) 막았다`);else if(isAbn(m))lines.push(`${m.name} 「${kn}」 이미 상태 이상이라 「${tn}」 상태가 되지 않음`);else{setState(m,to);lines.push(`${m.name} 「${kn}」 → 「${tn}」`)}}
   /* 소지품 (먹다남은음식 · 검은진흙 · 불꽃구슬 · 맹독구슬 · 끈적끈적바늘) — js/engine/items.js */
   if(m.hp.cur>0&&window.OM_ITEMS)window.OM_ITEMS.turnEnd(m,lines,{heal,dmg,noHeal:1});
  });
  for(const m of LIVE){if(m.hp.cur<=0&&!dead.includes(m.id)){dead.push(m.id);lines.push(`${m.name}은(는) 쓰러졌다!`)}}
  return {lines,dead}}

 /* ----- 필드 턴 종료 (field_turnend): 그래스필드 1/16 회복(땅 위), 불바다 1/8(불꽃 제외) ----- */
 function turnEndField(mons,field,opt){const lines=[];const f=field||{};
  if((f.terrain||{}).type==='그래스필드'&&!(opt&&opt.noGrass)){for(const id in mons){const m=mons[id];if(!m.entry||m.hp.cur<=0)continue;if(!grounded(m)){lines.push(`${m.name} 땅 위가 아니라 그래스필드 회복 제외`);continue}if(m.hp.cur<m.hp.max)heal(m,frac(m,1,16),lines,'「그래스필드」')}}
  /* 모래바람: 바위·땅·강철 타입이 아니면 1/16 (방진고글·모래 계열 특성·숨은 상태는 제외). 싸라기눈은 턴 끝 대미지 없음 */
  /* 11-07 에어록 · 날씨부정: 필드 위에 있는 한 「날씨」의 효과 없음 (턴 끝 모래바람도) */
  const wxNeg=Object.values(mons||{}).find(m=>m&&m.entry&&m.hp&&m.hp.cur>0&&/에어록|날씨부정/.test(String(m.ability||'')));
  if((f.weather||{}).type==='모래바람'&&wxNeg)lines.push(`${wxNeg.name} 특성 「${wxNeg.ability}」 — 「모래바람」 효과 없음`);
  if((f.weather||{}).type==='모래바람'&&!wxNeg){for(const id in mons){const m=mons[id];if(!m.entry||m.hp.cur<=0)continue;const ty=typesOf(m);
   if(['Rock','Ground','Steel'].some(t=>ty.includes(t)))continue;
   if(/방진고글/.test(itemsOf(m))){lines.push(`${m.name} 「방진고글」로 「모래바람」을 막았다`);continue}
   if(/만능우산/.test(itemsOf(m))){lines.push(`${m.name} 「만능우산」 — 「모래바람」 영향 없음`);continue}   /* 11-08 51-2 ⑫ */
   if(/모래숨기|모래헤치기|모래의힘|방진/.test(m.ability||'')){lines.push(`${m.name} 특성 「${m.ability}」 — 「모래바람」 영향 없음`);continue}
   if(['VanishToHole','VanishToWater'].some(k=>has(m,k))){lines.push(`${m.name} 숨어 있어 「모래바람」 영향 없음`);continue}
   dmg(m,frac(m,1,16),lines,'「모래바람」 1/16')}}
  for(const side of ['left','right']){if(((f.objects||{})[side]||{})['불바다']>0){for(const id in mons){const m=mons[id];if(!m.entry||m.side!==side||m.hp.cur<=0)continue;if(typesOf(m).includes('Fire')){lines.push(`${m.name} 불꽃 타입이라 「불바다」 제외`);continue}dmg(m,frac(m,1,8),lines,'「불바다」 1/8')}}}
  return {lines}}

 /* ----- 설치기 (hazard_eval/apply): 등장할 때. A 급은 땅 위에서만, B 급은 모두. 통굽부츠 면역. 제거 규칙(벌레가 갉아먹음 등) ----- */
 const HAZ=[{k:'압정뿌리기',c:'A',kind:'spike'},{k:'독압정',c:'A',kind:'tspike'},{k:'지뢰원',c:'A',f:4,once:1,d:'「HP」 1/4'},{k:'끈적끈적네트',c:'A',kind:'net'},{k:'기뢰',c:'A',kind:'mine',once:1},{k:'트램펄린',c:'B',kind:'bounce',once:1},{k:'스텔스록',c:'B',ty:'Rock'},{k:'불기둥',c:'B',ty:'Fire'},{k:'장미원',c:'B',kind:'rose',f:8},{k:'가시원',c:'B',ty:'Grass'},{k:'얼음꼬챙이',c:'B',ty:'Ice'},{k:'전기발판',c:'B',ty:'Electric'},{k:'아이스번',c:'B',kind:'iceburn'},{k:'저주의묘',c:'B',st:'Curse'},{k:'악의소굴',c:'B',st:'Knave'},{k:'전파탑',c:'B',st:'Electrify'}];
 const RM={장미원:{t:['Bug'],g:0,v:'갉아먹었다'},가시원:{t:['Bug'],g:0,v:'갉아먹었다'},얼음꼬챙이:{t:['Fire'],g:0,v:'녹여 없앴다'},전기발판:{t:['Ground'],g:0,v:'접지시켰다'},아이스번:{t:['Fire','Ice'],g:0,v:'치웠다'},독압정:{t:['Poison'],g:1,v:'흡수했다'},기뢰:{t:['Ground'],g:1,v:'접지시켰다'},불기둥:{t:['Water'],g:0,v:'꺼트렸다'}};
 function hazardsOnEntry(m,field,slotsOpp){const lines=[];const f=field||{};const objs=(f.objects||{})[m.side]||{};const gd=grounded(m);const boots=/통굽부츠/.test(itemsOf(m));const ty=typesOf(m);const removed=[];let forced=false;
  if(noind(m,'hazard')&&Object.keys(objs).some(k=>+objs[k]>0)){lines.push(`${m.name} 설치기를 무시한다`);return {lines,removed,forced}}
  for(const h of HAZ){const n=+objs[h.k]||0;if(n<=0)continue;if(noind(m,'hazdmg')&&(h.ty||h.kind==='spike'||h.f)){lines.push(`${m.name} 「${h.k}」 비례 대미지를 받지 않는다`);continue}
   const rm=RM[h.k];let rmHit='';if(rm){rmHit=rm.t.find(t=>ty.includes(t))||'';if(rmHit&&rm.g&&!gd)rmHit=''}
   if(rmHit){lines.push(`${m.name}(${rmHit})이(가) 「${h.k}」을(를) ${rm.v}`);delete objs[h.k];removed.push(h.k);continue}
   if(boots){lines.push(`${m.name} 「통굽부츠」라 「${h.k}」 영향 없음`);continue}
   if(h.c==='A'&&!gd){lines.push(`${m.name} 땅 위가 아니라 「${h.k}」 영향 없음`);continue}
   if(h.ty){const mul=B().effectiveness([h.ty],m,{}).value;if(mul<=0){lines.push(`${m.name} 「${h.k}」 효과가 없음`);continue}dmg(m,Math.max(1,Math.floor(m.hp.max/8*mul)),lines,`「${h.k}」 1/8 ×${mul}`);continue}
   if(h.kind==='spike'){const layers=Math.min(3,Math.max(1,n));const d=10-2*layers;dmg(m,frac(m,1,d),lines,`「압정뿌리기」(${layers}층) 1/${d}`);continue}
   if(h.kind==='tspike'){if(ty.includes('Poison')||ty.includes('Steel')){lines.push(`${m.name} 독·강철 타입이라 「독압정」 영향 없음`);continue}if(isAbn(m)){lines.push(`${m.name} 이미 상태 이상이라 「독압정」 영향 없음`);continue}{const tb=tblock(m,'Poison');if(tb){lines.push(`${m.name} 땅 위라서 「${tb}」가 「독압정」 독을 막았다`);continue}}const k=n>=2?'Toxic':'Poison';setState(m,k);lines.push(`${m.name} 「독압정」 → 「${ko(k)}」`);continue}
   if(h.kind==='net'){if(rankDown(m,'speed',-1))lines.push(`${m.name} 「끈적끈적네트」 스피드 −1`);else lines.push(`${m.name} 「끈적끈적네트」 — 스피드 감소 무시 (${m._nd||''})`);delete m._nd;continue}
   if(h.kind==='mine'){if(isAbn(m)||ty.includes('Electric')||tblock(m,'Paralysis')){lines.push(`${m.name} 「기뢰」 영향 없음`)}else{setState(m,'Paralysis');lines.push(`${m.name} 「기뢰」 → 「마비」`)}delete objs[h.k];removed.push(h.k);continue}
   if(h.kind==='bounce'){forced=true;lines.push(`${m.name} 「트램펄린」 — 강제 교대!`);delete objs[h.k];removed.push(h.k);continue}
   if(h.kind==='rose'){const d=frac(m,1,8);const got=dmg(m,d,lines,'「장미원」 1/8 드레인');const opp=slotsOpp&&slotsOpp[m.entry];if(got>0&&opp&&opp.hp.cur>0)heal(opp,got,lines,'「장미원」');continue}
   if(h.kind==='iceburn'){m.prioDown=1;   /* flags 는 턴 종료에 지워지니 따로 둔다 — 행동 순서(computeOrder)가 다음 기술에 −1 하고 지운다 */lines.push(`${m.name} 「아이스번」 다음 기술에 「우선도 : -1」`);continue}
   if(h.st){if(setState(m,h.st))lines.push(`${m.name} 「${h.k}」 → 「${ko(h.st)}」`);continue}
   if(h.f){dmg(m,frac(m,1,h.f),lines,`「${h.k}」 1/${h.f}`);if(h.once){delete objs[h.k];removed.push(h.k)}}}
  return {lines,removed,forced}}
 return {actionCheck,confusionHit,turnEndStates,turnEndField,hazardsOnEntry,grounded,itemOf,itemsOf,itemOff,itemOffWhy,itemOffMult,magic,HAZ,RM};   /* 11-01 망령: HAZ · RM 은 설치물 전개 카드(battle_ui fcInfo)가 효과 글을 만드는 데 읽는다 */
})();
