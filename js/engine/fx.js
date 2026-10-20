/* ---------- 효과 엔진 (레디메이드 자동화) ----------
   맵툴 Lib:readymade 의 매크로를 「명령(op)」 목록으로 옮긴 것(data/readymade.js)을 실행한다.
   · 한국어 구문(DSL) ↔ op 목록 양방향 변환 (parse / unparse) — 포텐셜·특성·소지품에 손으로 써 넣거나, 생성기로 만든다.
   · 효과는 포켓몬의 m.fx 에 이름 붙은 항목으로 남고(위력 강화·완화, 우선도, 면역, 감소 무시, 비례 무시, 하늘 위 …),
     공격 창·HP 창·행동 순서·턴 종료가 자동으로 읽는다. 횟수·턴이 다 되면 저절로 사라진다.
   · 모두 순수 함수: 배틀 사본(b)과 문맥(ctx)을 받아 고치고 로그 줄을 돌려준다. 선택·확인이 필요하면 ctx.ask 로 묻는다 (async).
   대상(tgt): self 자신 · ally 아군 전체 · enemy 상대 전체 · others 자신 이외 · all 전체 · ally1 아군 1체 · enemy1 상대 1체 ·
            randother 자신 이외 무작위 · randenemy 상대 무작위 · randall 전원 무작위 · area 지정 에리어(지령) */
"use strict";
window.OM_FX=(()=>{
 const DB=()=>window.OM_DB||{}, B=()=>window.OM_BATTLE, S=()=>window.OM_STATS;
 const STATS=['attack','defense','specialattack','specialdefense','speed','accuracy','evasion','critical','critical_buff'];
 const STAT_KO={attack:'공격',defense:'방어',specialattack:'특공',specialdefense:'특방',speed:'스피드',accuracy:'명중',evasion:'회피',critical:'급소',critical_buff:'급소방호'};
 const KO_STAT={};for(const k in STAT_KO)KO_STAT[STAT_KO[k]]=k;KO_STAT['특수공격']='specialattack';KO_STAT['특수방어']='specialdefense';KO_STAT['민첩']='speed';KO_STAT['속도']='speed';
 const TGT_KO={self:'자신',ally:'아군 전체',enemy:'상대 전체',others:'자신 이외',all:'전체',ally1:'아군 1체',enemy1:'상대 1체',randother:'자신 이외 무작위 1체',randenemy:'상대 무작위 1체',randall:'전원 무작위 1체',area:'지정 에리어'};
 const KO_TGT={자신:'self',아군전체:'ally',아군:'ally',상대전체:'enemy',상대:'enemy',자신이외:'others',전체:'all',아군1체:'ally1',아군1:'ally1',상대1체:'enemy1',상대1:'enemy1',무작위1:'randother',자신이외무작위:'randother',상대무작위:'randenemy',전원무작위:'randall',에리어:'area',지정에리어:'area'};
 const TYPE_KO={Normal:'노말',Fire:'불꽃',Water:'물',Electric:'전기',Grass:'풀',Ice:'얼음',Fighting:'격투',Poison:'독',Ground:'땅',Flying:'비행',Psychic:'에스퍼',Bug:'벌레',Rock:'바위',Ghost:'고스트',Dragon:'드래곤',Dark:'악',Steel:'강철',Fairy:'페어리',God:'신',Shadow:'그림자',Wild:'야생'};
 const KO_TYPE={};for(const k in TYPE_KO)KO_TYPE[TYPE_KO[k]]=k;
 const NEG=['Poison','Toxic','Burn','Paralysis','Freeze','Sleep','SyrupBomb','Confusion','Flinch','Embrago','Silence','Seal','Powder','Oblivion','TraitBroken','Taunt','Encore','Attract','HealBlock','Disable','Torrment','MeanLook','Bind','OctoLock','Block','Curse','LeechSeed','SaltCure','Nightmare','Yawn','DeathCount','LockOn','Telekinesis'];
 const ABN=['Poison','Toxic','Burn','Paralysis','Freeze','Sleep'];
 const stDB=()=>((DB().states||{}).st)||{};
 const stKo=k=>(stDB()[k]||{}).ko||k;
 function stEn(kor){kor=String(kor||'').trim();const st=stDB();if(st[kor])return kor;for(const k in st)if(st[k].ko===kor)return k;return ''}
 const typesOf=m=>(m.teraActive&&m.teraEn&&m.teraEn!=='-')?[m.teraEn]:(m.types||[]).filter(t=>t&&t!=='-');
 const frac=(base,v)=>{v=String(v||'').trim();const m=v.match(/^(\d+)\s*\/\s*(\d+)$/);if(m)return Math.max(1,Math.floor(base*+m[1]/+m[2]));const n=+v;return isNaN(n)?0:Math.floor(n)};
 const fx=m=>{m.fx=m.fx||{mods:[],noind:[],prio:[],immune:[],nodrop:[],roles:[]};for(const k of ['mods','noind','prio','immune','nodrop','roles'])m.fx[k]=m.fx[k]||[];return m.fx};
 const alive=m=>m&&m.hp&&m.hp.cur>0;

 /* ===== 레디메이드 찾기: 방 덮어쓰기(dbx.rm) → 기본 ===== */
 function rmAll(){const base=DB().readymade||{};const ov=(((window.OM_APP||{}).ST||{}).state||{}).dbx;const o=(ov&&ov.rm)||{};return Object.assign({},base,o)}
 function rm(name){if(!name)return null;const all=rmAll();name=String(name).replace(/『|』/g,'').trim();return all[name]||null}
 /* 포켓몬의 포텐셜/특성/소지품에 붙은 자동화: 개별 구문(m.auto[name]) → 레디메이드 */
 function autoOf(m,kind,name){name=String(name||'').replace(/『|』/g,'').trim();const own=(m&&m.auto||{})[name];if(own&&own.ops)return Object.assign({name,src:'own'},own);
  const key=kind==='trait'?'특성 : '+name:kind==='item'?'소지품 : '+name:name;const r=rm(key)||(kind!=='pot'?rm(name):null);if(!r)return null;return Object.assign({name,src:'rm',key},r)}

 /* ===== 대상 고르기 ===== */
 function sideMons(b,side){return Object.values(b.mons||{}).filter(m=>m.side===side&&m.entry&&alive(m))}
 async function targets(b,self,tgt,ctx){const my=self.side,op=my==='left'?'right':'left';const allies=sideMons(b,my),enemies=sideMons(b,op);
  const pick=async(list,label)=>{if(!list.length)return [];if(list.length===1)return [list[0]];if(ctx.pick)return [await ctx.pick(list,label)].filter(Boolean);return [list[0]]};
  const rnd=list=>list.length?[list[Math.floor(Math.random()*list.length)]]:[];
  switch(tgt){case 'self':return [self];case 'ally':return allies.length?allies:[self];case 'enemy':return enemies;case 'others':return [...allies,...enemies].filter(m=>m.id!==self.id);case 'all':return [...allies,...enemies];
   case 'ally1':return pick(allies.filter(m=>m.id!==self.id),'아군 1체');case 'enemy1':return pick(enemies,'상대 1체');case 'randother':return rnd([...allies,...enemies].filter(m=>m.id!==self.id));case 'randenemy':return rnd(enemies);case 'randall':return rnd([...allies,...enemies]);
   case 'area':{if(ctx.area){const m=allies.find(x=>x.entry===ctx.area);if(m)return [m]}return pick(allies,'에리어')}default:return [self]}}

 /* ===== 실행 ===== */
 /* ctx: {b(사본), self(포켓몬), name(효과 이름), area?, pick(list,label)->mon, confirm(q)->bool, choose(labels,multi)->idx[]} */
 async function run(ops,ctx){const L=[];const b=ctx.b;const self=ctx.self;const name=ctx.name||'효과';let stop=false;
  for(const op of ops||[]){if(stop)break;
   try{
    switch(op.k){
     case 'confirm':{const ok=ctx.confirm?await ctx.confirm(op.q):true;if(!ok){L.push(`「${name}」 조건을 만족하지 않아 발동하지 않았다 (${op.q})`);stop=true}break}
     case 'cond':{let ok=true;if(op.c==='ally_fainted')ok=Object.values(b.mons||{}).some(m=>m.side===self.side&&m.id!==self.id&&m.hp.cur<=0);
       else if(op.c==='hp_le')ok=self.hp.cur<=frac(self.hp.max,op.frac);if(!ok){L.push(`「${name}」 조건(${op.c==='ally_fainted'?'빈사 상태인 아군':'HP '+op.frac+' 이하'})을 만족하지 않아 발동하지 않았다`);stop=true}break}
     case 'choice':{let idx=[0];if(ctx.choose)idx=await ctx.choose(op.opts.map(o=>o.label),op.opts.some(o=>o.multi));if(!idx||!idx.length){stop=true;break}
       for(const i of idx){const o=op.opts[i];if(!o)continue;L.push(`▶ ${o.label}`);const r=await run(o.ops,ctx);L.push(...r.lines)}break}
     case 'rank':case 'mult':{const ts=await targets(b,self,op.tgt,ctx);for(const m of ts)L.push(...applyStats(m,op,self,name));break}
     case 'reset':{const ts=await targets(b,self,op.tgt||'self',ctx);for(const m of ts){if(op.what!=='mult'){m.rank={};delete m.tempRank}if(op.what!=='rank'){m.mod={};delete m.tempMod}L.push(`${m.name} ${op.what==='rank'?'랭크':op.what==='mult'?'배율':'랭크·배율'} 초기화`)}break}
     case 'boost':case 'guard':{const ts=await targets(b,self,op.tgt,ctx);for(const m of ts){const F=fx(m);const key=name+' ← '+self.name;if(op.remove){F.mods=F.mods.filter(e=>e.key!==key);L.push(`${m.name} 「${name}」 ${op.k==='boost'?'위력 강화':'위력 완화'} 해제`);continue}
       const e={key,name,kind:op.k,v:+op.v||1,types:op.types||[],cat:op.cat||'all',eff:op.eff||'all',rng:op.rng||'all',uses:op.uses==null?-1:+op.uses,turn:op.turn?(+b.turn||0):-1,until:op.tl>0?(+b.turn||0)+op.tl-1:-1,ro:op.ro||[],st:op.st||'',tg:op.tg||[],sb:op.sb||'',pmin:+op.pmin||0,pmax:+op.pmax||0,cg:+op.cg||0,cr:+op.cr||0,cx:op.cx||'',eg:op.eg||'',src:self.name};
       F.mods=F.mods.filter(x=>x.key!==key);F.mods.push(e);L.push(`${m.name} ${modDesc(e)}`)}break}
     case 'state':{const en=stEn(op.state)||op.state;const ts=await targets(b,self,op.tgt,ctx);for(const m of ts)L.push(setState(m,en,op.count,op.forced,self,name));break}
     case 'statefx':{const en=stEn(op.state)||op.state;let ts=await targets(b,self,op.tgt,ctx);if(op.self)ts=[self];if(op.pick==='one'&&ts.length>1)ts=[ts[Math.floor(Math.random()*ts.length)]];
       for(const m of ts){const r=Math.floor(Math.random()*100)+1;if(r<=(+op.chance||100))L.push(setState(m,en,-1,0,self,name)+` (${r}/${op.chance})`);else L.push(`${m.name} 「${stKo(en)}」 실패 (${r}/${op.chance})`)}break}
     case 'cure':{let ts=await targets(b,self,op.tgt,ctx);if(op.self)ts=[self];const list=op.states==='negative'||!op.states?NEG:op.states;
       for(const m of ts){if(op.chance&&+op.chance<100){const r=Math.floor(Math.random()*100)+1;if(r>+op.chance){L.push(`${m.name} 치유 실패 (${r}/${op.chance})`);continue}}
        const cured=[];for(const k of list)if((m.states||{})[k]){delete m.states[k];cured.push(stKo(k))}L.push(cured.length?`${m.name} 「${cured.join('」「')}」 해제`:`${m.name} 해제할 상태가 없다`)}break}
     case 'heal':{const ts=await targets(b,self,op.tgt||'self',ctx);for(const m of ts){if((m.states||{}).HealBlock){L.push(`${m.name} 「회복봉인」이라 회복하지 못함`);continue}if(op.ytype&&!typesOf(m).includes(op.ytype)){L.push(`${m.name} ${TYPE_KO[op.ytype]||op.ytype} 타입이 아니라 회복 없음`);continue}
       const v=op.value==='full'?m.hp.max-m.hp.cur:frac(m.hp.max,op.value);const h=Math.min(v,m.hp.max-m.hp.cur);m.hp.latest=m.hp.cur;m.hp.cur+=h;L.push(`${m.name} 「${name}」 회복 +${h} (HP ${m.hp.cur}/${m.hp.max})`)}break}
     case 'dmg':{const ts=await targets(b,self,op.tgt||'enemy1',ctx);for(const m of ts){if(op.st&&!(m.states||{})[op.st]){L.push(`${m.name} 「${stKo(op.st)}」 상태가 아니라 대미지 없음`);continue}if(op.xtype&&typesOf(m).includes(op.xtype)){L.push(`${m.name} ${TYPE_KO[op.xtype]||op.xtype} 타입이라 대미지 없음`);continue}
       let v=0;if(op.basis==='cur')v=frac(m.hp.cur,op.value);else if(op.basis==='type'){const mul=B().effectiveness([op.atype],m,{});if(mul<=0){L.push(`${m.name} ${TYPE_KO[op.atype]||op.atype} 타입 효과 없음`);continue}v=Math.max(1,Math.floor(frac(m.hp.max,op.value)*mul))}else if(op.basis==='last')v=frac((self.lastDealt||{}).total||0,op.value);else v=frac(m.hp.max,op.value);
       if(noind(m,'')){L.push(`${m.name} 비례 대미지를 받지 않는다 (${noindName(m,'')})`);continue}const floor=(op.nofaint||noind(m,'noko'))?1:0;const d=Math.max(0,Math.min(v,m.hp.cur-floor));m.hp.latest=m.hp.cur;m.hp.cur-=d;L.push(`${m.name} 「${name}」 대미지 −${d} (HP ${m.hp.cur}/${m.hp.max})${m.hp.cur<=0?' 빈사!':''}`);if(m.hp.cur<=0)m.entry=''}break}
     case 'weather':{const f=field(b);if(op.w==='random'){const W=['맑음','비','모래바람','눈','짙은안개','밤','별하늘'];op=Object.assign({},op,{w:W[Math.floor(Math.random()*W.length)]})}f.weather={type:op.w||'',count:op.w?(+op.count||5):0};L.push(op.w?`날씨 「${op.w}」 ${op.count>=1000?'계속':op.count+'턴'}`:'날씨 초기화');break}
     case 'terrain':{const f=field(b);if(op.room){if(!op.t){f.rooms={};L.push('룸 초기화')}else{f.rooms[op.t]=+op.count||5;L.push(`「${op.t}」 ${op.count>=1000?'계속':op.count+'턴'}`)}}else{f.terrain={type:op.t||'',count:op.t?(+op.count||5):0};L.push(op.t?`「${op.t}」 ${op.count>=1000?'계속':op.count+'턴'}`:'필드 초기화')}break}
     case 'etc':{const f=field(b);if(!op.e){f.etc={};L.push('필드의 상태 초기화')}else{f.etc[op.e]=+op.count||5;L.push(`「${op.e}」 ${op.count>=1000?'계속':op.count+'턴'}`)}break}
     case 'object':{const f=field(b);const side=op.side==='enemy'?(self.side==='left'?'right':'left'):self.side;f.objects[side]=f.objects[side]||{};const cur=+f.objects[side][op.o]||0;
       if(op.o==='압정뿌리기'||op.o==='독압정'){const mx=op.o==='압정뿌리기'?3:2;f.objects[side][op.o]=Math.min(mx,cur+1);L.push(`${side==='left'?'좌측':'우측'} 「${op.o}」 ${f.objects[side][op.o]}겹`)}else{f.objects[side][op.o]=+op.count||5;L.push(`${side==='left'?'좌측':'우측'} 「${op.o}」 ${op.count>=1000?'계속':op.count+'턴'}`)}break}
     case 'type':{const ts=await targets(b,self,op.tgt||'self',ctx);for(const m of ts){if(op.mode==='reset'){if(m.typesOrig){m.types=m.typesOrig;delete m.typesOrig}L.push(`${m.name} 타입 원래대로`);continue}m.typesOrig=m.typesOrig||m.types.slice();
       const add=(op.types||[]).map(t=>KO_TYPE[t]||t);if(op.mode==='set')m.types=add;else m.types=[...new Set([...m.types.filter(t=>t!=='-'),...add])];L.push(`${m.name} 타입 ${op.mode==='set'?'→':'+'} ${add.map(t=>TYPE_KO[t]||t).join('/')}`)}break}
     case 'trait':{const ts=await targets(b,self,op.tgt||'enemy1',ctx);for(const m of ts){if(op.mode==='reset'){if(m.abilityOrig!=null){m.ability=m.abilityOrig;delete m.abilityOrig}L.push(`${m.name} 특성 원래대로`);continue}if(m.abilityOrig==null)m.abilityOrig=m.ability||'';m.ability=op.tn;L.push(`${m.name} 특성 → 「${op.tn}」`)}break}
     case 'noind':{const ts=await targets(b,self,op.tgt||'self',ctx);for(const m of ts){const F=fx(m);const key=name+' ← '+self.name;if(op.mode==='off'){F.noind=F.noind.filter(e=>e.key!==key)}else if(op.mode==='clear'){F.noind=F.noind.filter(e=>e.kind!==(op.kind||''))}else{F.noind=F.noind.filter(e=>e.key!==key);F.noind.push({key,name,kind:op.kind||'',until:op.turns>0?(+b.turn||0)+op.turns-1:-1})}L.push(`${m.name} ${op.mode==='on'?'':'해제 — '}${NOIND_KO[op.kind||'']}`)}break}
     case 'prio':{const ts=await targets(b,self,op.tgt||'self',ctx);for(const m of ts){const F=fx(m);const key=name+' ← '+self.name;if(op.mode==='off'){F.prio=F.prio.filter(e=>e.key!==key)}else{F.prio=F.prio.filter(e=>e.key!==key);F.prio.push({key,name,v:+op.v||0,mode:op.mode||'add',cat:op.cat||'all',type:op.type||'',tag:op.tag||'',turn:op.dur==='turn'?(+b.turn||0):-1})}L.push(`${m.name} 우선도 ${op.mode==='set'?'= ':(op.v>0?'+':'')}${op.v} (${op.type?(TYPE_KO[op.type]||op.type)+' 타입 ':''}${op.cat&&op.cat!=='all'?op.cat+' ':''}${op.tag?'「'+op.tag+'」 ':''}기술${op.dur==='turn'?' · 이번 턴':''})`)}break}
     case 'immune':{const ts=await targets(b,self,op.tgt||'self',ctx);for(const m of ts){const F=fx(m);const key=name+' ← '+self.name;F.immune=F.immune.filter(e=>e.key!==key);if(op.mode!=='off')F.immune.push({key,name,states:op.states||[]});L.push(`${m.name} 「${(op.states||[]).map(stKo).join('」「')}」 면역${op.mode==='off'?' 해제':''}`)}break}
     case 'nodrop':{const ts=await targets(b,self,op.tgt||'self',ctx);for(const m of ts){const F=fx(m);const key=name+' ← '+self.name;F.nodrop=F.nodrop.filter(e=>e.key!==key);if(op.mode!=='off')F.nodrop.push({key,name,st:op.st||'',until:op.turns>0?(+b.turn||0)+op.turns-1:-1,ytype:op.ytype||'',ro:op.ro||[]});L.push(`${m.name} ${op.st?STAT_KO[op.st]+' ':'능력 '}감소 무시${op.mode==='off'?' 해제':''}`)}break}
     case 'ignoreup':{const F=fx(self);F.ignoreUp=op.on?{dir:op.dir||'atk',scope:op.scope||'both',ro:op.ro||[]}:null;L.push(`${self.name} ${op.dir==='recv'?'받을 때 상대의':'공격할 때 상대의'} ${({def:'방어',eva:'회피',atk:'공격',both:'방어·회피'})[op.scope]||'능력'} 상승 무시${op.on?'':' 해제'}`);break}
     case 'float':{const ts=await targets(b,self,op.tgt||'self',ctx);for(const m of ts){const F=fx(m);F.float=op.mode==='off'?null:{until:op.turns>0?(+b.turn||0)+op.turns-1:-1};L.push(`${m.name} 하늘 위${op.mode==='off'?' 해제':''}`)}break}
     case 'role':{const F=fx(self);if(op.mode==='clear')F.roles=[];else if(op.mode==='remove')F.roles=F.roles.filter(r=>!(op.roles||[]).includes(r));else F.roles=[...new Set([...F.roles,...(op.roles||[])])];L.push(`${self.name} 역할 취급: ${F.roles.join('·')||'없음'}`);break}
     case 'pursuit':{self.flags=self.flags||{};self.flags.pursuit=!!op.on;L.push(`${self.name} 다음 기술에 「따라가때리기」${op.on?'':' 해제'}`);break}
     case 'resetstates':{const ts=await targets(b,self,op.tgt||'self',ctx);for(const m of ts){const list=op.group==='condition_abnormal'?ABN:NEG;const c=[];for(const k of list)if((m.states||{})[k]){delete m.states[k];c.push(stKo(k))}L.push(`${m.name} ${c.length?'「'+c.join('」「')+'」 해제':'해제할 상태 없음'}`)}break}
     case 'raid':{self.raid=Object.assign({},self.raid||{},{segments:+op.x||(self.raid||{}).segments||0,floor:op.floor,cure:op.cure,cstat:op.cstat,rup:op.rup});L.push(`${self.name} 레이드 배틀 설정 (구간 ${self.raid.segments||'?'})`);break}
     case 'dex':{const ts=await targets(b,self,'enemy1',ctx);const tg=ts[0];L.push(`「${name}」 데이터 해석${tg?' → '+tg.name:''}`);if(tg&&window.OM_DEX_UI&&ctx.viewer!==undefined)setTimeout(()=>window.OM_DEX_UI.analyze(ctx.viewer||self.tid,tg.id,{forced:true,free:true}),400);break}
     default:L.push(`(모르는 명령 ${op.k})`)}
   }catch(e){L.push(`(${op.k} 처리 중 오류: ${e.message})`)}}
  return {lines:L,b}}
 const NOIND_KO={'':'비례 대미지를 받지 않는다',noko:'비례 대미지로는 빈사가 되지 않는다',hazard:'설치기를 무시한다',hazdmg:'설치기의 비례 대미지를 받지 않는다',recoil:'반동 비례 대미지를 받지 않는다'};
 function field(b){b.field=Object.assign({weather:{type:'',count:0},terrain:{type:'',count:0},rooms:{},etc:{},objects:{left:{},right:{}}},b.field||{});b.field.objects=b.field.objects||{left:{},right:{}};return b.field}
 function applyStats(m,op,self,name){const L=[];const isMult=op.k==='mult';const parts=[];
  for(const k in op.stats){const v=+op.stats[k];if(!v)continue;
   if(!isMult){ /* 랭크 */
    if(v<0&&!op.forced&&m.id!==self.id){const nd=nodropHit(m,k);if(nd){L.push(`${m.name} ${STAT_KO[k]} 감소 무시 (${nd})`);continue}}
    if(k==='critical_buff'){m.critBuff=(+m.critBuff||0)+v;parts.push(`급소 방호 ${v>0?'+':''}${v}`);continue}
    m.rank=m.rank||{};const lim=k==='critical'?4:6;const before=+m.rank[k]||0;const after=Math.max(-lim,Math.min(lim,before+v));m.rank[k]=after;if(op.temp){m.tempRank=m.tempRank||{};m.tempRank[k]=(+m.tempRank[k]||0)+(after-before)}
    parts.push(`${STAT_KO[k]} ${v>0?'+':''}${v}${after!==before+v?' (한계 '+after+')':''}`)}
   else{m.mod=m.mod||{};m.mod[k]=Math.round(((+m.mod[k]||1)*v)*1000)/1000;if(op.temp){m.tempMod=m.tempMod||{};m.tempMod[k]=Math.round(((+m.tempMod[k]||1)*v)*1000)/1000}parts.push(`${STAT_KO[k]} ×${v}`)}}
  if(parts.length)L.push(`${m.name} 「${name}」 ${parts.join(' · ')}${op.temp?' (턴 종료까지)':''}`);return L}
 function setState(m,en,count,forced,self,name){if(!en)return `${m.name} 모르는 상태`;m.states=m.states||{};if(m.states[en])return `${m.name} 이미 「${stKo(en)}」`;
  if(!forced){const im=immuneHit(m,en);if(im)return `${m.name} 「${stKo(en)}」 면역 (${im})`;if(ABN.includes(en)&&ABN.some(k=>m.states[k]))return `${m.name} 이미 상태 이상이라 「${stKo(en)}」이 되지 않음`;
   if(en==='Burn'&&typesOf(m).includes('Fire'))return `${m.name} 불꽃 타입이라 「화상」 없음`;if((en==='Poison'||en==='Toxic')&&(typesOf(m).includes('Poison')||typesOf(m).includes('Steel')))return `${m.name} 독·강철 타입이라 「${stKo(en)}」 없음`;if(en==='Paralysis'&&typesOf(m).includes('Electric'))return `${m.name} 전기 타입이라 「마비」 없음`;if(en==='Freeze'&&typesOf(m).includes('Ice'))return `${m.name} 얼음 타입이라 「얼음」 없음`}
  const d=stDB()[en]||{};const c=count!=null&&+count>0?+count:(d.min<1000?d.min:1000);m.states[en]=c;return `${m.name} 「${stKo(en)}」${c<1000?' '+c+'턴':''}`}
 function immuneHit(m,en){for(const e of (m.fx&&m.fx.immune)||[]){if(e.states.includes(en)||(e.states.includes('abnormal')&&ABN.includes(en)))return e.name}return ''}
 function nodropHit(m,stat){const t=+(((window.OM_APP||{}).ST||{}).state||{}).battle?.turn||0;for(const e of (m.fx&&m.fx.nodrop)||[]){if(e.until>=0&&t>e.until)continue;if(!e.st||e.st===stat)return e.name}return ''}
 function noind(m,kind){const t=curTurn();for(const e of (m.fx&&m.fx.noind)||[]){if(e.until>=0&&t>e.until)continue;if(e.kind===''||e.kind===kind)return true}return false}
 function noindName(m,kind){for(const e of (m.fx&&m.fx.noind)||[]){if(e.kind===''||e.kind===kind)return e.name}return ''}
 function floating(m){const f=m.fx&&m.fx.float;if(!f)return false;const t=curTurn();return !(f.until>=0&&t>f.until)}
 function curTurn(){return +((((window.OM_APP||{}).ST||{}).state||{}).battle||{}).turn||0}
 function modDesc(e){const parts=[];if(e.types&&e.types.length)parts.push(e.types.map(t=>TYPE_KO[t]||t).join('·'));else parts.push('모든 타입');if(e.cat==='physical')parts.push('물리');if(e.cat==='special')parts.push('특수');
  if(e.eff==='super')parts.push('효과 굉장');if(e.eff==='weak')parts.push('효과 별로');if(e.eff==='normal')parts.push('상성 1배');if(e.rng==='single')parts.push('단일기');if(e.rng==='multi')parts.push('전체기');
  if(e.sb==='stab')parts.push('타입 일치');if(e.sb==='nonstab')parts.push('타입 비일치');if(e.tg&&e.tg.length)parts.push('「'+e.tg.join('」「')+'」 기술');if(e.pmin)parts.push('위력 '+e.pmin+' 이상');if(e.pmax)parts.push('위력 '+e.pmax+' 이하');
  if(e.ro&&e.ro.length)parts.push('『'+e.ro.join('』『')+'』 상대');if(e.st==='def')parts.push('【수세】');if(e.st==='off')parts.push('【공세】');if(e.cg)parts.push('급소 방호 '+e.cg);if(e.cr)parts.push('급소 C+'+e.cr);if(e.cx==='sure')parts.push('확정 급소');if(e.cx==='none')parts.push('급소에 맞지 않음');
  const dur=e.uses>0?'남은 '+e.uses+'회':e.turn>=0?'이번 턴':e.until>=0?(e.until-curTurn()+1)+'턴':'해제 전까지';
  return `「${e.name}」 ${e.kind==='boost'?'위력 강화':'위력 완화'} ×${e.v} (${parts.join(' / ')} / ${dur})`}

 /* ===== 공격 계산이 읽는 것: 강화(공격 쪽)·완화(받는 쪽)·급소 ===== */
 function liveMods(m){const t=curTurn();return ((m.fx&&m.fx.mods)||[]).filter(e=>!(e.uses===0)&&!(e.turn>=0&&e.turn<t)&&!(e.until>=0&&t>e.until))}
 function matchMod(e,q){ /* q: {types[], cat('물리'|'특수'|'변화'), eff(mult), single, stab, tags[], pow, roles[], egg, stance} */
  if(e.types.length&&!(q.types||[]).some(t=>e.types.includes(t)))return false;
  if(e.cat==='physical'&&q.cat!=='물리')return false;if(e.cat==='special'&&q.cat!=='특수')return false;
  if(e.eff==='super'&&!(q.eff>1))return false;if(e.eff==='weak'&&!(q.eff<1&&q.eff>0))return false;if(e.eff==='normal'&&q.eff!==1)return false;
  if(e.rng==='single'&&q.single===false)return false;if(e.rng==='multi'&&q.single!==false)return false;
  if(e.sb==='stab'&&!q.stab)return false;if(e.sb==='nonstab'&&q.stab)return false;
  if(e.tg&&e.tg.length&&!(q.tags||[]).some(t=>e.tg.includes(t)))return false;
  if(e.pmin&&!(q.pow>=e.pmin))return false;if(e.pmax&&!(q.pow<=e.pmax))return false;
  if(e.ro&&e.ro.length&&!(q.roles||[]).some(r=>e.ro.includes(r)))return false;
  if(e.eg&&!(q.egg||[]).some(g=>e.eg.split(',').includes(g)))return false;
  if(e.st&&q.stance&&e.st!==q.stance)return false;return true}
 function attackMods(atk,def,q){const out={boost:1,guard:1,cg:0,cr:0,cx:'',names:[]};
  for(const e of liveMods(atk)){if(e.kind!=='boost')continue;const qq=Object.assign({},q,{roles:(def.fx&&def.fx.roles)||[],egg:def.egg||[]});if(!matchMod(e,qq))continue;out.boost*=e.v;out.cr+=e.cr||0;if(e.cx)out.cx=e.cx;out.names.push({key:e.key,who:atk.id,txt:`${atk.name} 「${e.name}」 ×${e.v}`})}
  for(const e of liveMods(def)){if(e.kind!=='guard')continue;const qq=Object.assign({},q,{roles:(atk.fx&&atk.fx.roles)||[],egg:atk.egg||[]});if(!matchMod(e,qq))continue;out.guard*=e.v;out.cg+=e.cg||0;if(e.cx==='none')out.cx='none';out.names.push({key:e.key,who:def.id,txt:`${def.name} 「${e.name}」 ×${e.v}`})}
  out.boost=Math.round(out.boost*1000)/1000;out.guard=Math.round(out.guard*1000)/1000;return out}
 /* 쓴 뒤: 횟수 있는 항목을 깎는다 (b 사본의 포켓몬에) */
 function consume(b,names){for(const n of names||[]){const m=b.mons[n.who];if(!m||!m.fx)continue;const e=m.fx.mods.find(x=>x.key===n.key);if(!e)continue;if(e.uses>0){e.uses--;if(e.uses===0)m.fx.mods=m.fx.mods.filter(x=>x!==e)}}}
 function prioOf(m,mv){let p=+(mv&&mv.prio)||0;let set=null;const t=curTurn();for(const e of (m.fx&&m.fx.prio)||[]){if(e.turn>=0&&e.turn<t)continue;if(e.cat&&e.cat!=='all'&&e.cat!==mv.cat)continue;if(e.type&&e.type!==mv.typeEn)continue;if(e.tag&&!e.tag.split(',').some(x=>String(mv.tag||mv.name||'').includes(x.trim())))continue;if(e.mode==='set')set=e.v;else p+=e.v}return set!=null?set:p}
 /* 턴 종료: 기한 지난 항목 정리 */
 function turnEnd(b){const t=+b.turn||0;const L=[];for(const id in b.mons||{}){const m=b.mons[id];if(!m.fx)continue;const F=m.fx;
  const gone=[];F.mods=F.mods.filter(e=>{const dead=(e.turn>=0&&e.turn<=t)||(e.until>=0&&t>=e.until)||e.uses===0;if(dead)gone.push(e.name);return !dead});
  F.noind=F.noind.filter(e=>!(e.until>=0&&t>=e.until));F.nodrop=F.nodrop.filter(e=>!(e.until>=0&&t>=e.until));F.prio=F.prio.filter(e=>!(e.turn>=0&&e.turn<=t));if(F.float&&F.float.until>=0&&t>=F.float.until)F.float=null;
  if(gone.length)L.push(`${m.name} 「${gone.join('」「')}」 끝`)}return L}

 /* ===== 포켓몬 카드에 보여 줄 효과 칩 ===== */
 function chips(m){const out=[];for(const e of liveMods(m))out.push({t:`${e.kind==='boost'?'강화':'완화'} ×${e.v}`,title:modDesc(e)});for(const e of (m.fx&&m.fx.noind)||[])out.push({t:'비례 무시',title:e.name+' — '+NOIND_KO[e.kind||'']});
  for(const e of (m.fx&&m.fx.prio)||[])out.push({t:`우선도 ${e.mode==='set'?'=':(e.v>0?'+':'')}${e.v}`,title:e.name});for(const e of (m.fx&&m.fx.immune)||[])out.push({t:'면역 '+e.states.map(stKo).join('·'),title:e.name});
  for(const e of (m.fx&&m.fx.nodrop)||[])out.push({t:(e.st?STAT_KO[e.st]+' ':'')+'감소 무시',title:e.name});if(m.fx&&m.fx.ignoreUp)out.push({t:'강화 무시',title:'상대의 능력 상승 무시'});if(floating(m))out.push({t:'하늘 위',title:'땅 위 효과를 받지 않는다'});
  if(m.fx&&m.fx.roles&&m.fx.roles.length)out.push({t:'역할 '+m.fx.roles.join('·'),title:'역할 취급'});if(m.typesOrig)out.push({t:'타입 변경',title:'원래 '+m.typesOrig.map(t=>TYPE_KO[t]||t).join('/')});if(m.abilityOrig!=null)out.push({t:'특성 변경',title:'원래 '+(m.abilityOrig||'없음')});return out}

 /* ===== 발동 시점·확률 (효과 글의 표식) ===== */
 function timing(text){const t=String(text||'');const out={entry:/【등장】/.test(t),passive:/【상시】/.test(t),turnEnd:/【턴 종료】|턴 종료 시/.test(t),pre:/【선행】/.test(t),uses:(t.match(/【(\d+)\/시】/)||[])[1]||'',percent:''};
  for(const [k,v] of [['드물게','드물게'],['저확률','저확률'],['중확률','중확률'],['고확률','고확률']])if(t.includes(k))out.percent=v;return out}
 function percentOf(label){const C=(DB().const||{}).campaign||{};const v=C['percent_'+label];if(v==null||v==='')return {드물게:10,저확률:30,중확률:50,고확률:60}[label]||100;return +v>1?+v:+v*100}

 /* ===== 한국어 구문 ↔ op ===== */
 const TGT_WORDS=Object.keys(KO_TGT).sort((a,b)=>b.length-a.length);
 function tgtOf(words){for(let i=0;i<words.length;i++){const w=words[i].replace(/\s/g,'');const k=KO_TGT[w];if(k){words.splice(i,1);return k}}return null}
 function parseLine(line){line=line.trim();if(!line||line.startsWith('#'))return null;const words=line.split(/\s+/);const head=words.shift();
  const n=s=>{const m=String(s).match(/-?\d+(\.\d+)?/);return m?+m[0]:0};const turns=()=>{const i=words.findIndex(w=>/^\d+턴$/.test(w));if(i<0)return null;const v=+words[i].replace('턴','');words.splice(i,1);return v};const has=w=>{const i=words.indexOf(w);if(i<0)return false;words.splice(i,1);return true};
  const types=()=>{const i=words.findIndex(w=>/^타입[:：]?/.test(w));if(i<0)return [];let v=words[i].replace(/^타입[:：]?/,'');if(!v&&words[i+1]){v=words[i+1];words.splice(i,2)}else words.splice(i,1);return v.split(/[,/·]/).map(x=>KO_TYPE[x.trim()]||x.trim()).filter(Boolean)};
  switch(head){
   case '랭크':case '배율':{const tgt=tgtOf(words)||'self';const temp=has('임시')||has('턴종료까지');const forced=has('강제');const stats={};for(const w of words){const m=w.match(/^(.+?)\s*([+\-×x*])\s*(\d+(?:\.\d+)?)$/);if(!m)continue;const k=KO_STAT[m[1]];if(!k)continue;stats[k]=m[2]==='-'?-+m[3]:+m[3]}return Object.assign({k:head==='랭크'?'rank':'mult',tgt,stats},temp?{temp:1}:{},forced?{forced:1}:{})}
   case '초기화':{const what=words.includes('배율')?'mult':words.includes('랭크')?'rank':'all';return {k:'reset',what,tgt:tgtOf(words)||'self'}}
   case '위력':case '완화':{const op={k:head==='위력'?'boost':'guard',tgt:'self',v:1,types:[],cat:'all',eff:'all',rng:'all',uses:-1,turn:0,tl:0,ro:[],st:'',tg:[],sb:''};const vi=words.findIndex(w=>/^[×x*]?\d+(\.\d+)?$/.test(w));if(vi>=0){op.v=n(words[vi]);words.splice(vi,1)}
    op.tgt=tgtOf(words)||'self';op.types=types();if(has('물리'))op.cat='physical';if(has('특수'))op.cat='special';if(has('굉장'))op.eff='super';if(has('별로'))op.eff='weak';if(has('보통'))op.eff='normal';if(has('단일'))op.rng='single';if(has('전체기'))op.rng='multi';if(has('자속'))op.sb='stab';if(has('비자속'))op.sb='nonstab';if(has('이번턴'))op.turn=1;if(has('수세'))op.st='def';if(has('공세'))op.st='off';if(has('확정급소'))op.cx='sure';if(has('급소없음'))op.cx='none';if(has('해제'))op.remove=1;
    const tl=turns();if(tl!=null)op.tl=tl;const ui=words.findIndex(w=>/^\d+회$/.test(w));if(ui>=0){op.uses=+words[ui].replace('회','');words.splice(ui,1)}
    for(let i=words.length-1;i>=0;i--){const w=words[i];let m;if((m=w.match(/^태그[:：]?(.+)$/))){op.tg=m[1].split(/[,·]/).filter(Boolean);words.splice(i,1)}else if((m=w.match(/^역할[:：]?(.+)$/))){op.ro=m[1].split(/[,·]/).filter(Boolean);words.splice(i,1)}else if((m=w.match(/^위력[≥>=]+(\d+)$/))){op.pmin=+m[1];words.splice(i,1)}else if((m=w.match(/^위력[≤<=]+(\d+)$/))){op.pmax=+m[1];words.splice(i,1)}else if((m=w.match(/^급소방호(\d+)$/))){op.cg=+m[1];words.splice(i,1)}else if((m=w.match(/^급소\+(\d+)$/))){op.cr=+m[1];words.splice(i,1)}else if((m=w.match(/^알그룹[:：]?(.+)$/))){op.eg=m[1];words.splice(i,1)}}
    return op}
   case '상태':{const state=words.shift();const forced=has('강제');const tl=turns();return {k:'state',state,tgt:tgtOf(words)||'enemy1',count:tl!=null?tl:-1,forced:forced?1:0}}
   case '상태확률':{const state=words.shift();const ci=words.findIndex(w=>/^\d+%$/.test(w));const chance=ci>=0?+words.splice(ci,1)[0].replace('%',''):100;const pick=has('1체')?'one':'';return {k:'statefx',state,tgt:tgtOf(words)||'enemy1',chance,pick,ask:'',self:0}}
   case '치유':{const ci=words.findIndex(w=>/^\d+%$/.test(w));const chance=ci>=0?+words.splice(ci,1)[0].replace('%',''):100;const tgt=tgtOf(words)||'self';const rest=words.join(',').split(/[,·]/).map(x=>x.trim()).filter(Boolean);const states=(!rest.length||rest.includes('이상')||rest.includes('전부'))?'negative':rest.map(x=>stEn(x)||x);return {k:'cure',tgt,states,chance,self:0}}
   case '회복':{const v=words.find(w=>/^\d+\/\d+$|^\d+$|^전부$/.test(w))||'1/4';words.splice(words.indexOf(v),1);const ty=types();return Object.assign({k:'heal',tgt:tgtOf(words)||'self',value:v==='전부'?'full':v},ty.length?{ytype:ty[0]}:{})}
   case '피해':{const v=words.find(w=>/^\d+\/\d+$|^\d+$/.test(w))||'1/8';words.splice(words.indexOf(v),1);const op={k:'dmg',tgt:'enemy1',value:v,basis:'max'};if(has('현재'))op.basis='cur';if(has('직전'))op.basis='last';if(has('빈사없음'))op.nofaint=1;const ty=types();if(ty.length){op.basis='type';op.atype=ty[0]}const xi=words.findIndex(w=>/^제외[:：]?/.test(w));if(xi>=0){op.xtype=KO_TYPE[words[xi].replace(/^제외[:：]?/,'')]||'';words.splice(xi,1)}const si=words.findIndex(w=>/^상태[:：]/.test(w));if(si>=0){op.st=stEn(words[si].replace(/^상태[:：]/,''))||'';words.splice(si,1)}op.tgt=tgtOf(words)||'enemy1';return op}
   case '날씨':{const w=words.shift()||'';if(w==='해제'||w==='초기화')return {k:'weather',w:'',count:0};const c=words.find(x=>/^\d+$|^계속$/.test(x));return {k:'weather',w:w==='무작위'?'random':w,count:c==='계속'?1000:(+c||5)}}
   case '필드':case '룸':{const t=words.shift()||'';if(t==='해제'||t==='초기화')return {k:'terrain',t:'',room:head==='룸',count:0};const c=words.find(x=>/^\d+$|^계속$/.test(x));return {k:'terrain',t,room:head==='룸'||/룸$/.test(t),count:c==='계속'?1000:(+c||5)}}
   case '필드상태':{const e=words.shift()||'';if(e==='해제')return {k:'etc',e:'',count:0};const c=words.find(x=>/^\d+$|^계속$/.test(x));return {k:'etc',e,count:c==='계속'?1000:(+c||5)}}
   case '설치기':{let side='ally';if(has('상대')||has('적진'))side='enemy';has('아군');has('자진');const o=words.shift()||'';const c=words.find(x=>/^\d+$|^계속$/.test(x));return {k:'object',side,o,count:c==='계속'?1000:(+c||5)}}
   case '타입':{const tgt=tgtOf(words)||'self';let mode='add';if(has('변경'))mode='set';if(has('원래')||has('해제'))mode='reset';has('추가');const ts=words.join(',').split(/[,/·]/).map(x=>KO_TYPE[x.trim()]||x.trim()).filter(Boolean);return {k:'type',tgt,mode,types:ts}}
   case '특성':{const tgt=tgtOf(words)||'enemy1';let mode='set';if(has('원래')||has('해제'))mode='reset';has('변경');return {k:'trait',tgt,mode,tn:words.join(' ')}}
   case '비례무시':{const tgt=tgtOf(words)||'self';const tl=turns();let kind='';if(has('빈사'))kind='noko';if(has('설치기'))kind='hazard';if(has('설치기피해'))kind='hazdmg';if(has('반동'))kind='recoil';const mode=has('해제')?'off':'on';return {k:'noind',tgt,mode,kind,turns:tl!=null?tl:-1}}
   case '우선도':{const vi=words.findIndex(w=>/^[+\-=]?\d+(\.\d+)?$/.test(w));let v=0,mode='add';if(vi>=0){const w=words.splice(vi,1)[0];if(w.startsWith('='))mode='set';v=n(w)}const tgt=tgtOf(words)||'self';const ty=types();let cat='all';if(has('물리'))cat='물리';if(has('특수'))cat='특수';if(has('변화'))cat='변화';const dur=has('이번턴')?'turn':'keep';if(has('해제'))mode='off';const ti=words.findIndex(w=>/^태그[:：]?/.test(w));const tag=ti>=0?words.splice(ti,1)[0].replace(/^태그[:：]?/,''):'';return {k:'prio',tgt,mode,v,cat,type:ty[0]||'',dur,tag}}
   case '면역':{const tgt=tgtOf(words)||'self';const mode=has('해제')?'off':'on';const states=words.join(',').split(/[,·]/).map(x=>x.trim()).filter(Boolean).map(x=>x==='이상'?'abnormal':(stEn(x)||x));return {k:'immune',tgt,mode,states}}
   case '감소무시':{const tgt=tgtOf(words)||'self';const tl=turns();const mode=has('해제')?'off':'on';const st=KO_STAT[words[0]]||'';return {k:'nodrop',tgt,mode,st,turns:tl!=null?tl:-1,ytype:'',ro:[]}}
   case '강화무시':{const dir=has('받음')||has('받을때')?'recv':'atk';has('공격시');let scope='both';if(has('방어'))scope='def';if(has('회피'))scope='eva';if(has('공격'))scope='atk';if(has('양쪽'))scope='both';const ri=words.findIndex(w=>/^역할[:：]?/.test(w));const ro=ri>=0?words.splice(ri,1)[0].replace(/^역할[:：]?/,'').split(',').filter(Boolean):[];return {k:'ignoreup',dir,scope,on:has('해제')?0:1,mode:0,ro}}
   case '하늘위':{const tgt=tgtOf(words)||'self';const tl=turns();return {k:'float',tgt,mode:has('해제')?'off':'on',turns:tl!=null?tl:-1}}
   case '역할':{let mode='add';if(has('제거'))mode='remove';if(has('초기화'))mode='clear';has('추가');return {k:'role',mode,roles:words.join(',').split(/[,·]/).map(x=>x.trim()).filter(Boolean)}}
   case '추격':return {k:'pursuit',on:has('해제')?0:1,hide:has('숨김')?1:0,tgt:'self'};
   case '상태초기화':return {k:'resetstates',tgt:tgtOf(words)||'self',group:has('전부')?'negative':'condition_abnormal'};
   case '확인':return {k:'confirm',q:words.join(' ').replace(/^["“]|["”]$/g,'')};
   case '조건':{const w=words.join('');if(/아군빈사/.test(w))return {k:'cond',c:'ally_fainted'};const m=w.match(/HP[≤<=]+(\d+\/\d+)/);if(m)return {k:'cond',c:'hp_le',frac:m[1]};return {k:'confirm',q:words.join(' ')}}
   case '해석':return {k:'dex',mode:'scouter'};
   case '레이드':{const m=words.join(' ').match(/구간[:：]?(\d+)/);return {k:'raid',on:1,x:m?+m[1]:'',cond:'cap',floor:1,cure:1,cstat:1,rup:1,rmod:0}}
   default:return {k:'?',raw:line}}}
 /* 여러 줄 구문: 「선택:」 뒤의 「- 라벨 → 구문; 구문」 줄들은 선택지 */
 function parse(text){const ops=[];const errs=[];let choice=null;
  for(const raw of String(text||'').split(/\n|;/)){const line=raw.trim();if(!line)continue;
   if(/^선택[:：]?$/.test(line)){choice={k:'choice',opts:[]};ops.push(choice);continue}
   if(choice&&/^[-·•]/.test(line)){const t=line.replace(/^[-·•]\s*/,'');const ai=t.search(/→|->/);const label=(ai<0?t:t.slice(0,ai)).trim();const body=ai<0?'':t.slice(ai).replace(/^(→|->)/,'');const sub=[];for(const seg of body.split(/[,，]\s*(?=[가-힣]+\s)/)){const op=parseLine(seg);if(op&&op.k!=='?')sub.push(op);else if(op)errs.push(op.raw)}choice.opts.push({label,ops:sub,multi:/^①|②|③|\[.\]/.test(label)?0:0});continue}
   choice=null;const op=parseLine(line);if(!op)continue;if(op.k==='?')errs.push(op.raw);else ops.push(op)}
  return {ops,errs}}
 function unparse(ops){const L=[];const tg=t=>t&&t!=='self'?' '+(TGT_KO[t]||t).replace(/\s/g,''):'';const ty=ts=>ts&&ts.length?' 타입:'+ts.map(t=>TYPE_KO[t]||t).join(','):'';
  const tga=t=>' '+(TGT_KO[t||'enemy1']||t).replace(/\s/g,'');
  for(const op of ops||[]){switch(op.k){
   case 'rank':case 'mult':L.push((op.k==='rank'?'랭크':'배율')+tg(op.tgt)+' '+Object.entries(op.stats||{}).map(([k,v])=>STAT_KO[k]+(op.k==='rank'?(v>0?'+':'')+v:'×'+v)).join(' ')+(op.temp?' 임시':'')+(op.forced?' 강제':''));break;
   case 'reset':L.push('초기화 '+({rank:'랭크',mult:'배율'}[op.what]||'전부')+tg(op.tgt));break;
   case 'boost':case 'guard':{let s=(op.k==='boost'?'위력':'완화')+' ×'+op.v+tg(op.tgt)+ty(op.types);if(op.cat==='physical')s+=' 물리';if(op.cat==='special')s+=' 특수';if(op.eff==='super')s+=' 굉장';if(op.eff==='weak')s+=' 별로';if(op.eff==='normal')s+=' 보통';if(op.rng==='single')s+=' 단일';if(op.rng==='multi')s+=' 전체기';if(op.sb==='stab')s+=' 자속';if(op.sb==='nonstab')s+=' 비자속';if(op.tg&&op.tg.length)s+=' 태그:'+op.tg.join(',');if(op.pmin)s+=' 위력≥'+op.pmin;if(op.pmax)s+=' 위력≤'+op.pmax;if(op.ro&&op.ro.length)s+=' 역할:'+op.ro.join(',');if(op.st==='def')s+=' 수세';if(op.st==='off')s+=' 공세';if(op.cg)s+=' 급소방호'+op.cg;if(op.cr)s+=' 급소+'+op.cr;if(op.cx==='sure')s+=' 확정급소';if(op.cx==='none')s+=' 급소없음';if(op.eg)s+=' 알그룹:'+op.eg;if(op.uses>0)s+=' '+op.uses+'회';if(op.turn)s+=' 이번턴';if(op.tl>0)s+=' '+op.tl+'턴';if(op.remove)s+=' 해제';L.push(s);break}
   case 'state':L.push('상태 '+stKo(op.state)+tga(op.tgt)+(op.count>0?' '+op.count+'턴':'')+(op.forced?' 강제':''));break;
   case 'statefx':L.push('상태확률 '+stKo(op.state)+' '+op.chance+'%'+tga(op.tgt)+(op.pick==='one'?' 1체':''));break;
   case 'cure':L.push('치유'+tg(op.tgt)+' '+(op.states==='negative'?'이상':op.states.map(stKo).join(','))+(op.chance&&op.chance<100?' '+op.chance+'%':''));break;
   case 'heal':L.push('회복 '+(op.value==='full'?'전부':op.value)+tg(op.tgt)+(op.ytype?ty([op.ytype]):''));break;
   case 'dmg':L.push('피해 '+op.value+tga(op.tgt)+(op.basis==='cur'?' 현재':op.basis==='last'?' 직전':op.basis==='type'?ty([op.atype]):'')+(op.xtype?' 제외:'+(TYPE_KO[op.xtype]||op.xtype):'')+(op.st?' 상태:'+stKo(op.st):'')+(op.nofaint?' 빈사없음':''));break;
   case 'weather':L.push(op.w?'날씨 '+(op.w==='random'?'무작위':op.w)+' '+(op.count>=1000?'계속':op.count):'날씨 해제');break;
   case 'terrain':L.push((op.room?'룸 ':'필드 ')+(op.t?op.t+' '+(op.count>=1000?'계속':op.count):'해제'));break;
   case 'etc':L.push('필드상태 '+(op.e?op.e+' '+(op.count>=1000?'계속':op.count):'해제'));break;
   case 'object':L.push('설치기 '+(op.side==='enemy'?'상대 ':'아군 ')+op.o+(op.count&&op.count!==5?' '+(op.count>=1000?'계속':op.count):''));break;
   case 'type':L.push('타입'+tg(op.tgt)+' '+({add:'추가',set:'변경',reset:'원래'})[op.mode]+(op.mode==='reset'?'':' '+(op.types||[]).map(t=>TYPE_KO[t]||t).join(',')));break;
   case 'trait':L.push('특성'+tga(op.tgt)+' '+(op.mode==='reset'?'원래':'변경 '+op.tn));break;
   case 'noind':L.push('비례무시'+tg(op.tgt)+({'':'',noko:' 빈사',hazard:' 설치기',hazdmg:' 설치기피해',recoil:' 반동'})[op.kind||'']+(op.turns>0?' '+op.turns+'턴':'')+(op.mode==='off'?' 해제':''));break;
   case 'prio':L.push('우선도 '+(op.mode==='set'?'=':(op.v>0?'+':''))+op.v+tg(op.tgt)+(op.type?ty([op.type]):'')+(op.cat&&op.cat!=='all'?' '+op.cat:'')+(op.tag?' 태그:'+op.tag:'')+(op.dur==='turn'?' 이번턴':'')+(op.mode==='off'?' 해제':''));break;
   case 'immune':L.push('면역'+tg(op.tgt)+' '+(op.states||[]).map(s=>s==='abnormal'?'이상':stKo(s)).join(',')+(op.mode==='off'?' 해제':''));break;
   case 'nodrop':L.push('감소무시'+tg(op.tgt)+(op.st?' '+STAT_KO[op.st]:'')+(op.turns>0?' '+op.turns+'턴':'')+(op.mode==='off'?' 해제':''));break;
   case 'ignoreup':L.push('강화무시 '+(op.dir==='recv'?'받음':'공격시')+' '+({def:'방어',eva:'회피',atk:'공격',both:'양쪽'})[op.scope]+(op.ro&&op.ro.length?' 역할:'+op.ro.join(','):'')+(op.on?'':' 해제'));break;
   case 'float':L.push('하늘위'+tg(op.tgt)+(op.turns>0?' '+op.turns+'턴':'')+(op.mode==='off'?' 해제':''));break;
   case 'role':L.push('역할 '+({add:'추가',remove:'제거',clear:'초기화'})[op.mode]+' '+(op.roles||[]).join(','));break;
   case 'pursuit':L.push('추격'+(op.on?'':' 해제')+(op.hide?' 숨김':''));break;
   case 'resetstates':L.push('상태초기화'+tg(op.tgt)+(op.group==='negative'?' 전부':''));break;
   case 'confirm':L.push('확인 "'+op.q+'"');break;
   case 'cond':L.push('조건 '+(op.c==='ally_fainted'?'아군빈사':'HP≤'+op.frac));break;
   case 'choice':L.push('선택:');for(const o of op.opts)L.push('- '+o.label+' → '+unparse(o.ops).join('; '));break;
   case 'raid':L.push('레이드'+(op.x?' 구간:'+op.x:''));break;case 'dex':L.push('해석');break;
   default:L.push('# '+JSON.stringify(op))}}
  return L}
 /* 사람이 읽는 설명 (미리보기·로그) */
 function describe(ops){return unparse(ops)}
 return {rm,rmAll,autoOf,run,attackMods,consume,prioOf,turnEnd,chips,timing,percentOf,parse,unparse,describe,noind,floating,immuneHit,nodropHit,liveMods,modDesc,TGT_KO,STAT_KO,TYPE_KO,NEG,ABN,stEn,stKo};
})();
