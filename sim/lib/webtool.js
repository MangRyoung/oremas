/* 웹툴 배틀 코드(oremas js/battle_ui.js)를 화면 없이 불러온다 — 10-27 밤 망령 「특성 · 소지품 · 포텐셜 · 날씨 · 필드 · 변화기 셋 다 넣어야지」.
   시뮬이 따로 흉내 내지 않고 웹툴과 같은 코드(등장 · 행동 순서 · 턴 종료 · 피격 반응 · 4식 6령 효과 · 효과 엔진)를 쓴다.
   · battle_ui.js 원문을 읽어 몇 군데만 바꿔 끼운다(PATCH): 내부 함수 꺼내기 · 확인 창(askYes) · 효과 엔진 문맥(uiCtx) — 사람이 누르던 곳은 시뮬이 답한다.
     웹툴이 바뀌어 바꿔 끼울 자리를 못 찾으면 바로 오류를 낸다(조용히 틀리지 않게).
   · OM_APP(화면 · 저장소)는 상태 객체 하나에 쓰는 가짜로, 화면 그리기 · 컷인 · 소리는 아무 일도 안 하는 가짜 DOM 으로.
   · 난수: Math.random 을 배틀마다 씨앗 난수로 바꿔 끼운다(같은 씨앗 = 같은 결과). setTimeout 은 바로(setImmediate) 돈다.
   쓰는 법: const H=require('./webtool.js').load(W); H.reset(battle); await H.fn.enterMon(...); H.state.battle … */
"use strict";
const fs=require('fs'),path=require('path'),vm=require('vm');
const {ROOT}=require('./env.js');

/* 무엇이든 받아 주는 가짜 DOM 요소: 속성은 다시 가짜, 호출해도 가짜, 값으로 쓰면 빈 글자 */
function dummy(){const f=function(){};let P;const H={get:(t,k)=>{if(k===Symbol.toPrimitive)return ()=>'';if(k===Symbol.iterator)return function*(){};if(k==='then')return undefined;if(k==='length')return 0;if(k==='checked'||k==='disabled'||k==='hidden')return false;if(k==='value'||k==='textContent'||k==='innerHTML'||k==='className'||k==='id')return '';if(k==='dataset'||k==='style')return {};if(k==='classList')return {add(){},remove(){},toggle(){},contains(){return false}};if(k==='querySelectorAll'||k==='getElementsByClassName'||k==='getElementsByTagName')return ()=>[];if(k==='querySelector'||k==='getElementById'||k==='closest')return ()=>P;return P},set:()=>true,apply:()=>P,construct:()=>P};P=new Proxy(f,H);return P}

/* 웹툴 원문에 바꿔 끼울 것 — [찾을 글, 바꿀 글]. 못 찾으면 오류 */
const PATCH=[
 /* 내부 함수 꺼내기 (IIFE 끝의 return 앞) */
 [" return {askYes,", " window.__BUI_GET=n=>{try{return eval(n)}catch(e){return undefined}};\n return {askYes,"],
 /* 확인 창: 시뮬이 답한다 (기본 = 예) */
 [" function askYes(q,yes,no){return new Promise(res=>{", " function askYes(q,yes,no){if(window.__SIM&&window.__SIM.ask)return Promise.resolve(window.__SIM.ask(q,yes,no));return new Promise(res=>{"],
 /* 효과 엔진 문맥: 대상 고르기 · 조건 확인 · 선택지 — 시뮬이 답한다 */
 [" function uiCtx(b,self,name,area){const L=localUi(b,self,name,area);", " function uiCtx(b,self,name,area){if(window.__SIM&&window.__SIM.uiCtx)return window.__SIM.uiCtx(b,self,name,area);const L=localUi(b,self,name,area);"]];

/* 바뀐 칸 찾기 (웹툴 app.js diffOps 와 같은 뜻) — JSON 글자 비교 대신 빠른 깊은 비교 */
function deq(a,b){if(a===b)return true;if(a==null||b==null)return (a==null)&&(b==null);const ta=typeof a,tb=typeof b;if(ta!=='object'||tb!=='object')return a===b;const aa=Array.isArray(a),ab=Array.isArray(b);if(aa!==ab)return false;
 if(aa){if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(!deq(a[i],b[i]))return false;return true}
 const ka=Object.keys(a).filter(k=>a[k]!==undefined),kb=Object.keys(b).filter(k=>b[k]!==undefined);if(ka.length!==kb.length)return false;for(const k of ka)if(!deq(a[k],b[k]))return false;return true}
const sameJ=(a,b)=>deq(a===undefined?null:a,b===undefined?null:b);
const isObj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
function diffOps(p,before,after,depth,out){out=out||[];if(sameJ(before,after))return out;if(!(depth>0)||!isObj(before)||!isObj(after)){out.push([p,after===undefined?null:after]);return out}
 for(const k of new Set([...Object.keys(before),...Object.keys(after)]))diffOps(p.concat(k),before[k],after[k],depth-1,out);return out}

function load(W){if(W.__H)return W.__H;
 const ST={state:{battle:{},rp:{},roster:{trainers:{},mons:{}},seats:{},skill:{}},role:'gm',seat:'',room:'sim',secret:''};
 const H={ST,state:ST.state,logs:[],fn:{}};
 const setPath=(p,v)=>{if(!p||!p.length){ST.state=v||{};H.state=ST.state;return}let o=ST.state;for(let i=0;i<p.length-1;i++){if(typeof o[p[i]]!=='object'||o[p[i]]==null)o[p[i]]={};o=o[p[i]]}if(v===null||v===undefined)delete o[p[p.length-1]];else o[p[p.length-1]]=v};
 const D=dummy();const ok=Promise.resolve(true);
 const contactOf=mv=>{const c=mv&&mv.contact;if(c==='O'||c==='X')return c;const d=((W.OM_DB||{}).moves||{})[mv&&mv.name];return d&&d.contact||'-'};
 W.OM_APP={ST,
  set:(p,v)=>{setPath(p,v);return ok},setMany:ops=>{for(const [p,v] of ops)setPath(p,v);return ok},setDiff:(p,a,b,d)=>{for(const [q,v] of diffOps(p,a,b,d==null?1:d))setPath(q,v);return ok},diffOps,
  sysLog:(t,k)=>{if(H.logOn)H.logs.push(String(t))},selfLog:()=>{},toast:()=>{},openModal:()=>D,closeModal:()=>{},renderScene:()=>{},presList:()=>[],online:()=>false,
  contactOf,acctKey:()=>'',typeChip:()=>'',dupItems:()=>[],dupItemText:()=>'',unloadTrainer:()=>{},auto:()=>{},parse:x=>x,openMon:()=>{},openLoadParty:()=>{},openHatch:()=>{},describe:()=>''};
 W.OM_STORE={secretGet:()=>Promise.resolve([]),setState:()=>Promise.resolve(true)};
 /* 가짜 DOM · 타이머 · 난수 */
 const doc=W.document;doc.querySelector=()=>D;doc.querySelectorAll=()=>[];doc.getElementById=()=>D;doc.createElement=()=>D;doc.body=D;doc.addEventListener=()=>{};doc.head=D;
 W.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});W.CSS={escape:s=>String(s)};W.getComputedStyle=()=>({});W.innerWidth=1280;W.Audio=function(){return D};W.Image=function(){return D};
 W.setTimeout=(f)=>{if(typeof f!=='function')return 0;return setImmediate(()=>{try{f()}catch(e){if(H.onErr)H.onErr(e)}})};W.clearTimeout=h=>{if(h)clearImmediate(h)};W.setInterval=()=>0;W.clearInterval=()=>{};
 W.requestAnimationFrame=f=>W.setTimeout(f);
 const M=Object.create(Math);M.random=Math.random;W.Math=M;H.setRng=r=>{M.random=r};
 W.confirm=()=>true;W.alert=()=>{};
 /* battle_ui.js 원문 + 바꿔 끼우기 */
 const file=path.join(ROOT,'js','battle_ui.js');let src=fs.readFileSync(file,'utf8');
 for(const [a,b] of PATCH){const i=src.indexOf(a);if(i<0)throw new Error('웹툴 battle_ui.js 가 바뀌어 바꿔 끼울 자리를 못 찾았다: '+a.slice(0,60));if(src.indexOf(a,i+1)>=0)throw new Error('바꿔 끼울 자리가 여럿: '+a.slice(0,60));src=src.slice(0,i)+b+src.slice(i+a.length)}
 vm.runInContext(src,W,{filename:file});
 H.get=n=>W.__BUI_GET(n);
 const NAMES=['ctx','snap','saveBattle','startBattle','enterMon','exitMon','forcedSwitch','autoEntryAll','autoOnEntry','computeOrder','turnEnd','applyOrder','tempRank','fireAuto','abilityHitReact','itemHitReact','itemConsume','itemSweep','faintOff','faintSweep',
  'entered','allEntered','fieldOf','skinOf','hitShield','hsOpt','moveQuery','specialPowFor','powStepOf','rollGroup','secRolls','tgtFor','foulAtk','iuIgnore','critMulOf','crAdj','orderCrit','itemCrit','protMove','protBypass','raidFloor','raidPhase','spMulOf','grd','tysOf','IT','MVS','moveAuto',
  'CHARGE_ST','movesDown','WEATHER_MUL','WALLS','wallNames','catEn','isPursuit','mode','sameT','potSrc','outReset','auraOff','perOf','leadAcc','CRR','chanceLive','secAdd0','secSure0','endCands','END_T','STATWORD','FOUL_RE','protMove','passable','applyBatton','isExcl','uniqList','limOf','abTxt','abNm','hitRules','resultOf','formSet','hpFormWatch','futureFire','raidExtra','condNow','passiveOps','gradeCond','SIDES','AREAS','SIDE_KO','OBJ_CAT','objCat','TERRAIN','ROOMS','ETC','setPhase','autoTurnStart','fireOrder','noOrdWhy','defaultTargets','pursuitX2','switchGuard','preCharge','slotEff','enterMon','exitMon','faintWatch'];
 for(const n of NAMES){const v=H.get(n);if(v!==undefined)H.fn[n]=v}
 H.missing=NAMES.filter(n=>H.fn[n]===undefined);
 /* 배틀 상태를 통째로 바꾼다 */
 H.reset=b=>{ST.state.battle=b;H.logs.length=0};
 /* 사람이 답하던 곳 — 시뮬 기본 답 (H.answer 로 바꿀 수 있다). 물은 것은 H.asked 에 센다 */
 H.asked={};const note=(k,q)=>{const key=k+': '+String(q||'').slice(0,120);H.asked[key]=(H.asked[key]||0)+1};
 H.answer={
  ask:(q)=>{note('확인',q);return !/배턴터치/.test(String(q||''))},
  /* 효과 엔진 「조건을 만족하는가?」: HP 조건만 읽고 나머지는 「아니요」(모르는 조건으로 효과가 나가지 않게) — 물은 글은 H.asked 로 모아 고친다 */
  confirm:(q,self,b)=>{note('조건',q);const t=String(q||'');let m=t.match(/HP\s*[:：]?\s*(\d+)\s*\/\s*(\d+)\s*이하/);if(m&&self)return self.hp.cur<=self.hp.max*(+m[1])/(+m[2]);m=t.match(/HP\s*[:：]?\s*(\d+)\s*\/\s*(\d+)\s*이상/);if(m&&self)return self.hp.cur>=self.hp.max*(+m[1])/(+m[2]);if(/HP\s*[:：]?\s*가득/.test(t)&&self)return self.hp.cur>=self.hp.max;return false},
  choose:(labels,multi)=>{note('선택',labels.join(' / '));return [0]},
  /* 대상 고르기: 상대 쪽이면 가장 위협적인(공격 · 특공 높은) 상대, 같은 편이면 HP 비율이 가장 낮은 아군 */
  pick:(list,label,self,b)=>{note('대상',label);if(!list.length)return null;const foe=self&&list.every(x=>x.side!==self.side);if(foe)return list.slice().sort((a,c)=>Math.max(c.stats[1],c.stats[3])-Math.max(a.stats[1],a.stats[3]))[0];return list.slice().sort((a,c)=>a.hp.cur/a.hp.max-c.hp.cur/c.hp.max)[0]}};
 W.__SIM={ask:(q,y,n)=>H.answer.ask(q,y,n),uiCtx:(b,self,name,area)=>({b,self,name,area,viewer:'',
  pick:(list,label)=>Promise.resolve(H.answer.pick(list,label,self,b)),confirm:q=>Promise.resolve(!!H.answer.confirm(q,self,b)),choose:(labels,multi)=>Promise.resolve(H.answer.choose(labels,multi,self,b))})};
 W.__H=H;return H}
module.exports={load,PATCH,diffOps,dummy};
