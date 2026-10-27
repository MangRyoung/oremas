/* 배틀 입구 (10-27 밤): runBattle = 배틀 v3(battle3.js, 비동기 · 웹툴 배틀 코드 그대로) · runBattleSync = 옛 v2(battle_v2.js, 동기 · 약식 — 야생 DB 생성 검토용) */
"use strict";
const V3=require('./battle3.js'),V2=require('./battle_v2.js');
module.exports={runBattle:V3.runBattle,runBattleSync:V2.runBattle,mkRng:V2.mkRng,POL:V2.POL};
