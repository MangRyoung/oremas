/* 엔진 로더 — 오레마스 data/*.js · js/engine/*.js 와 제작기 js/fx/*.js 를 브라우저 없이 읽는다.
   window 흉내 객체 하나를 만들어 그 안에서 파일을 차례로 실행한다 (index.html 의 <script> 순서와 같다).
   제작기 폴더는 기본 ../../mangketmon-maker (망령 PC: D:\TRPG\망각\ 아래에 둘이 나란히 · 작업 컨테이너도 같은 모양) */
"use strict";
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..','..');            // oremas
function makerRoot(){return process.env.MK_ROOT||path.resolve(ROOT,'..','mangketmon-maker')}
/* 시뮬 속도용 바꿔 끼우기 (10-27 밤): 효과 엔진의 레디메이드 표를 부를 때마다 새로 합치던 것(rmAll)을 한 번만 — 시뮬엔 방 덮어쓰기(dbx.rm)가 없다 */
const SRC_PATCH={'fx.js':[[/function rmAll\(\)\{/,'let __RMC=null;function rmAll(){if(__RMC)return __RMC;return (__RMC=rmAll0())}function rmAll0(){'],
 /* 11-15 05시 망령 「시뮬에서 구현이 안 되는 게 있다면 만들면서」: 시트 구문 · 레디메이드가 없는 포텐셜은 제작기 구문 추천기(potlint)가 낸 구문으로 — 시뮬에서만 (웹툴은 GM 이 손으로 · 추천기는 시트 작성용) · 기본 끔(LINT=1 로 켬) */
 [/const r=rm\(key\)\|\|\(kind!=='pot'\?rm\(name\):null\);if\(!r\)return null;/,"const r=rm(key)||(kind!=='pot'?rm(name):null);if(!r){if(kind==='pot'&&window.__SIM_LINT){const z=window.__SIM_LINT(m,name);if(z)return z}return null}"]]};
/* 추천기 구문 만들기 (포텐셜 이름 + 효과 글마다 한 번) */
function simLint(win){const C=new Map();return (m,name)=>{if(!process.env.LINT)return null;   /* 11-15 09시: 기본 끔 — 학생 시트 전체에서 18건뿐이고 그중 여럿이 틀림(리버설 우선도 −7 상시 · 유대가 완화 ×1 · 치우천왕 퇴장 계기 빠짐). LINT=1 이면 켬 */const PL=win.MKM_POTLINT,FX=win.OM_FX;if(!PL||!PL.suggest||!FX||!FX.parse||!m)return null;
 const nm=String(name||'').replace(/[『』]/g,'').trim();let eff='';for(const p of [].concat(m.pots||[],m.excl||[],m.exclX||[]))if(p&&String(p.name||'').replace(/[『』]/g,'').trim()===nm){eff=String(p.eff||'');break}
 if(!eff){try{const bt=win.OM_APP&&win.OM_APP.ST&&win.OM_APP.ST.state.battle;const tr=bt&&bt.trainers&&bt.trainers[m.tid];const u=tr&&(tr.unique||[]).find(x=>x&&String(x.name||'').replace(/[『』]/g,'').trim()===nm);if(u)eff=String(u.eff||'')}catch(e){}}
 if(!eff)return null;const k=nm+'|'+eff;if(C.has(k))return C.get(k);
 /* 계기 말(「~할 때」 · 「받으면」)이 있는 글은 추천기가 계기를 빼먹고 상시로 내는 일이 있어(『불굴귀의 압도』 → 등장 때 상대 방어 −1) 쓰지 않는다 */
 if(/(?:을|를|할|했을|받았을|받을|내보낼|되었을|됐을|쓰러뜨렸을|나왔을)\s*때|받으면|맞으면|쓰러지면/.test(eff)){C.set(k,null);return null}let out=null;try{const sg=PL.suggest(eff);const ls=((sg&&sg.lines)||[]).filter(Boolean);if(ls.length){const r=FX.parse(ls.join('\n'));if(r&&r.ops&&r.ops.length&&!(r.err&&r.err.length))out={name:nm,src:'lint',text:eff,ops:r.ops,lint:ls}}}catch(e){}C.set(k,out);return out}}
function load(opts){opts=opts||{};
 const win={console,setTimeout,clearTimeout,Math,Date,JSON,Object,Array,String,Number,Boolean,RegExp,Map,Set,Promise,Error,parseInt,parseFloat,isFinite,isNaN,encodeURIComponent,decodeURIComponent,structuredClone,
  localStorage:{getItem(){return null},setItem(){},removeItem(){}},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},
  navigator:{userAgent:'sim'},location:{hash:'',search:'',href:'sim://'},document:{querySelector(){return null},querySelectorAll(){return []},createElement(){return {style:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},appendChild(){},addEventListener(){}}},body:{appendChild(){}},addEventListener(){},documentElement:{dataset:{},style:{}}},
  addEventListener(){},removeEventListener(){},requestAnimationFrame(f){return setTimeout(f,0)},performance:{now:()=>Date.now()}};
 win.window=win;win.globalThis=win;win.self=win;
 const ctx=vm.createContext(win);
 const MK=makerRoot();
 const files=[
  ['data/const.js'],['data/types.js'],['data/moves.js'],['data/traits.js'],['data/items.js'],
  [path.join(MK,'js/fx/states.js'),'abs'],['data/maker.js'],[path.join(MK,'js/fx/readymade.js'),'abs'],
  ['js/engine/stats.js'],['js/engine/orders.js'],['js/engine/itemrule.js'],['js/engine/items.js'],['js/engine/field.js'],
  [path.join(MK,'js/fx/fx.js'),'abs'],[path.join(MK,'js/fx/moveauto.js'),'abs'],[path.join(MK,'js/potlint.js'),'abs'],['js/engine/import.js'],['js/engine/battle.js']];
 const loaded=[],failed=[];
 for(const [f,abs] of files){const p=abs?f:path.join(ROOT,f);
  if(!fs.existsSync(p)){failed.push({f:p,err:'없음'});continue}
  try{let src=fs.readFileSync(p,'utf8');for(const [re,to] of (SRC_PATCH[path.basename(p)]||[]))src=src.replace(re,to);vm.runInContext(src,ctx,{filename:p});loaded.push(p)}catch(e){failed.push({f:p,err:e.message});if(opts.strict)throw e}}
 win.__SIM_LINT=simLint(win);
 /* 11-15 망령 「헬레나 보구가 해석 조건 제대로 따르나」: 시뮬엔 도감(dex_ui.js)이 없어 「데이터 해석」이 하나도 기록되지 않았다 — 해석 기록만 하는 작은 판(웹툴 dex_ui analyze 와 같은 꼴: state.dex[트레이너] = {used, list, part, fwSeen} · 해석 차단 · 「해석차단」 구문) */
 win.OM_DEX_UI=win.OM_DEX_UI||{scope:()=>'all',analyze:async(viewer,mid,o)=>{o=o||{};const A=win.OM_APP;const st=A.ST.state;const m=((st.battle||{}).mons||{})[mid];if(!m||!viewer)return false;const d=Object.assign({used:0,list:[],part:{},fwSeen:[]},JSON.parse(JSON.stringify((st.dex||{})[viewer]||{})));if(d.list.includes(mid))return false;
  const fw=+m.dexFw||0;let open=true,why='';if(!o.forced){if(fw===1){open=false;why='해석 차단 (1회)';await A.set(['battle','mons',mid,'dexFw'],0)}else if(fw===2){open=false;why='완전 차단'}else{const nd=win.OM_FX&&win.OM_FX.spOf?win.OM_FX.spOf(m,'nodex')[0]:null;if(nd){open=false;why='해석 차단 — 「'+nd.name+'」'}}}
  if(!o.free)d.used=(+d.used||0)+1;if(open)d.list.push(mid);else if(!d.fwSeen.includes(mid))d.fwSeen.push(mid);await A.set(['dex',viewer],d);const vt=((st.battle||{}).trainers||{})[viewer]||{};A.sysLog(`【해석】 ${vt.name||viewer} → ${m.name}${open?' — 데이터 해석':' — '+why}${o.free?' (효과)':' (도감 '+d.used+'회째)'}`,'battle');return open}};
 if(!win.OM_BATTLE||!win.OM_STATS||!win.OM_IMPORT)throw new Error('엔진을 못 읽었다: '+JSON.stringify(failed));
 return {win,loaded,failed,ROOT,MK};}
module.exports={load,ROOT,makerRoot};
