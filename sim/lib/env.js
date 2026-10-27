/* 엔진 로더 — 오레마스 data/*.js · js/engine/*.js 와 제작기 js/fx/*.js 를 브라우저 없이 읽는다.
   window 흉내 객체 하나를 만들어 그 안에서 파일을 차례로 실행한다 (index.html 의 <script> 순서와 같다).
   제작기 폴더는 기본 ../../mangketmon-maker (망령 PC: D:\TRPG\망각\ 아래에 둘이 나란히 · 작업 컨테이너도 같은 모양) */
"use strict";
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..','..');            // oremas
function makerRoot(){return process.env.MK_ROOT||path.resolve(ROOT,'..','mangketmon-maker')}
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
  [path.join(MK,'js/fx/fx.js'),'abs'],[path.join(MK,'js/fx/moveauto.js'),'abs'],['js/engine/import.js'],['js/engine/battle.js']];
 const loaded=[],failed=[];
 for(const [f,abs] of files){const p=abs?f:path.join(ROOT,f);
  if(!fs.existsSync(p)){failed.push({f:p,err:'없음'});continue}
  try{vm.runInContext(fs.readFileSync(p,'utf8'),ctx,{filename:p});loaded.push(p)}catch(e){failed.push({f:p,err:e.message});if(opts.strict)throw e}}
 if(!win.OM_BATTLE||!win.OM_STATS||!win.OM_IMPORT)throw new Error('엔진을 못 읽었다: '+JSON.stringify(failed));
 return {win,loaded,failed,ROOT,MK};}
module.exports={load,ROOT,makerRoot};
