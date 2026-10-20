/* ---------- 지령(4식)·명령(6령) 계열 — 맵툴 trainer_order_make / js_order 와 같은 표 ----------
   명령 계열 tc (0~8, const.lists.list_command 순서) 를 고르면 지령 계열 tord 가 따라온다.
   키 목록(OK/CK) 은 계열마다 다르고, 이름은 list_order_<tord> / list_command_<tc> 를 그 순서로 읽는다. */
"use strict";
window.OM_ORDERS=(()=>{
 const OK={0:['retreat','dodge','endure','return','snipe'],1:['retreat','dodge','endure','snipe'],2:['retreat','dodge','endure','return','snipe','special'],3:['retreat']};
 const CKALL=['attack','defense','specialattack','specialdefense','speed','heal','accuracy','evasion'];
 const CK={0:CKALL,1:CKALL,2:CKALL,3:CKALL.slice(0,5),4:['attack','defense','specialattack','specialdefense','speed','accuracy','evasion'],5:['attack','defense','specialattack','specialdefense','speed','accuracy','evasion'],6:CKALL,7:['attack','defense'],8:CKALL.slice(0,5)};
 const csv=s=>String(s||'').split(',').map(x=>x.trim()).filter(Boolean);
 const lists=()=>((window.OM_DB||{}).const||{}).lists||{};
 function tordOf(tc){tc=+tc||0;if((tc>=3&&tc<=5)||tc===8)return 2;if(tc===6)return 1;if(tc===7)return 3;return 0}
 function styles(t){const tc=t.commandStyle==null?+(t.orderStyle||0):+t.commandStyle;return {tc,tord:t.orderStyle==null?tordOf(tc):+t.orderStyle}}
 function orderKeys(t){return OK[styles(t).tord]||OK[0]}
 function commandKeys(t){return CK[styles(t).tc]||CKALL}
 function orderNames(t){return csv(lists()['list_order_'+styles(t).tord])}
 function commandNames(t){return csv(lists()['list_command_'+styles(t).tc])}
 function orderName(t,key){const i=orderKeys(t).indexOf(key);return orderNames(t)[i]||key}
 function commandName(t,key){const i=commandKeys(t).indexOf(key);return commandNames(t)[i]||key}
 function commandStyles(){return csv(lists().list_command)}
 function orderStyles(){return csv(lists().list_order)}
 /* 횟수 일괄 제작: 모두 nn, 그 다음 계열 조합별로 0 이 되는 것 (맵툴 trainer_order_make 의 zr) */
 function make(t,tc,nn){tc=+tc||0;nn=+nn||0;const tord=tordOf(tc);const cnt={};
  for(const k of OK[tord])cnt['order_'+k]=nn;for(const k of CK[tc])cnt['command_'+k]=nn;
  let zr=[];if(tord===0)zr=['o.special'];if(tord===1)zr=['o.return','o.special'];if(tord===2)zr=['c.heal'];if(tord===3)zr=['o.dodge','o.endure','o.return','o.snipe','o.special'];
  if(tord===0&&tc<=1)zr.push('o.snipe','c.accuracy','c.evasion');if(tord===0&&tc===2)zr.push('o.snipe');
  if(tord===2&&tc===3)zr.push('o.special','c.accuracy','c.evasion');if(tord===2&&tc===4)zr.push('o.special');if(tord===2&&tc===8)zr.push('o.endure','o.return','o.snipe','o.special','c.accuracy','c.evasion');
  for(const z of zr){const [kind,k]=z.split('.');const key=(kind==='o'?'order_':'command_')+k;if(key in cnt)cnt[key]=0}
  return {commandStyle:tc,orderStyle:tord,orderCount:cnt}}
 return {OK,CK,tordOf,styles,orderKeys,commandKeys,orderNames,commandNames,orderName,commandName,commandStyles,orderStyles,make};
})();
