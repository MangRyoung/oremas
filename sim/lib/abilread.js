/* 시뮬(= 웹툴 배틀 코드)이 이 특성을 읽어 저절로 처리하는가 (10-28 망령 「시뮬이 못 다루는 특성은 덜 뽑히게」).
   야생 생성(mongen.pickAbility)이 제작기 특성을 고를 때 쓴다 — 「글만」(GM 이 손으로 판정해야 하는) 특성은 시뮬 승률에 안 잡혀서,
   그런 특성을 단 야생은 실제보다 약하게 재진다.
   읽는다고 보는 것: ① 레디메이드 자동 효과(FX.autoOf, 손 발동 manual 아님) ② 피격 반응(battle_ui hitRules: 「…를 받으면」)
                    ③ 받는 쪽 방어(hitShield: HP 가득 반감 · 탈) · -스킨(skinOf) · 날씨 스피드(spMulOf) · 급소 안 맞음 ④ 시뮬 GM(battle3: 「X 상태일 때 턴 종료 HP 회복」) ⑤ 웹툴이 이름으로 아는 것(하늘의은총 · 스킬링크) */
"use strict";
const NAMED=new Set(['하늘의은총','스킬링크']);
let H=null;const memo=new Map();
function how(W,name,desc){if(!W)return '?';const k=name+'\u0001'+desc;if(memo.has(k))return memo.get(k);let r='';
 try{const FX=W.OM_FX;const au=FX&&FX.autoOf({},'trait',name);if(au&&au.ops&&au.ops.length&&!au.manual)r='자동'}catch(e){}
 if(!r){try{if(!H)H=require('./webtool.js').load(W);const m={id:'x',name:'x',ability:name,abilityEff:desc,hp:{max:100,cur:100},types:['Normal']};
  if(H.fn.hitRules(m).length)r='피격 반응';else{const sh=H.fn.hitShield(m,{cat:'물리'});if(sh.fullGuard||sh.disguise)r='방어';else if(H.fn.skinOf(m,{cat:'물리',typeEn:'Normal'}))r='스킨'}}catch(e){}}
 /* 웹툴이 글을 직접 읽는 것: 날씨 · 필드 조건 스피드(spMulOf) · 급소 안 맞음(공격 창) */
 if(!r&&/「(날씨|필드)\s*:\s*[^」]+」일 때[^.①②③]*?「스피드」(?:를|가|이)\s*(?:\d+(?:\.\d+)?배|강화\()/.test(desc))r='스피드';
 if(!r&&/자신의\s*급소에\s*맞지\s*않는다/.test(desc))r='급소';
 if(!r&&/상태일 때 턴 종료 시 「HP」를/.test(desc))r='시뮬 GM';
 if(!r&&NAMED.has(name))r='이름';
 memo.set(k,r);return r}
module.exports={how,reads:(W,name,desc)=>!!how(W,name,desc)};
