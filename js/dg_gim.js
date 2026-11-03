/* ---------- 11-04 던전 기믹 · 미궁 포텐셜 (OM_DG_GIM) ----------
   망령 「기믹 되돌리기랑, 적어도 조건과 효과를 내가 훨씬 다양하게 설정해볼 수 있어야겠네. 미궁과 야생은 제대로 고유/전용처럼 기능해? 추가 편집 수정 삭제 등도 잘 할 수 있어? UI는 이뻐?」
   · 던전 기믹 d.gim = [{id, n, memo, off, on, every, chance, once, where[], alMin, alMax, ifFlag, noFlag, to, save{stat,target}, unless{type,flag}, fx[{k,v}]}]
     on    : room 처음 들어가는 방 · move 방을 옮길 때마다 · enter 던전에 들어설 때 · rest 세이프룸 휴식 · checkFail 체크 실패 · checkOk 체크 성공
             battle 조우 직전 · win 배틀 이긴 뒤 · lose 배틀 진 뒤 · alert 경계도가 alMin 을 넘어설 때
     fx    : 대상마다 — step 상태 나빠짐 · heal 상태 회복 · hp 동행 HP 감소(a/b) · hpUp 동행 HP 회복 · st 동행 상태 이상 · cure 상태 이상 치유 · ord 4식 · cmd 6령 잃음
             일행 한 번 — al 경계도 · foeLv 다음 조우 Lv · bossLv 보스방 Lv · rest 휴식 단계 ↓ · restUp 휴식 단계 ↑ · flag 표식 얻기 · unflag 표식 잃기 · memo 글만
     옛 꼴(do:{step,al,hp,foeLv,bossLv,rest} · cond.fail)도 읽는다.
   · 되돌리기: 기믹이 걸릴 때마다 바뀌는 칸의 전 값을 state.dg.glog 에 남긴다(던전마다 마지막 12번). 「↶ 되돌리기」는 가장 최근 것부터.
   · 『미궁 포텐셜』 d.mq = [{name, eff, auto}] — 던전 배틀 안의 고유(망령 07:24). 조우 때 그 방 야생 트레이너의 고유(unique)에 붙는다(app.js encounter). 『야생 포텐셜』은 야생 포켓몬의 전용(시트 「전용 포텐셜」). */
window.OM_DG_GIM=(()=>{
 const A=()=>window.OM_APP,ST=()=>(A()&&A().ST&&A().ST.state)||{},DGU=()=>window.OM_DG_UI,K=()=>window.OM_SKILL_UI;
 const H=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));const clone=x=>x===undefined?null:JSON.parse(JSON.stringify(x));
 const sTxt=(s,n)=>String(s==null?'':s).replace(/[\u0000-\u001f]/g,' ').trim().slice(0,n||60);
 const getP=(o,p)=>p.reduce((a,k)=>a==null?undefined:a[k],o);
 const ON=[['room','처음 들어가는 방','🚪'],['move','방을 옮길 때마다','👣'],['enter','던전에 들어설 때','⛩'],['rest','세이프룸 휴식','☗'],['checkFail','체크 실패','✕'],['checkOk','체크 성공','✓'],['battle','조우 직전','⚔'],['win','배틀 이긴 뒤','✦'],['lose','배틀 진 뒤','☠'],['alert','경계도가 기준을 넘을 때','⚠']];
 const TO=[['all','일행 전원'],['healthiest','가장 건강한 사람'],['weakest','가장 다친 사람'],['lead','그 체크의 대표 (없으면 첫째)'],['random','무작위 한 명']];
 /* [k, 이름, 'p'(일행 한 번) | 't'(대상마다), 값 꼴, 기본값] */
 const FX=[['step','상태 단계 나빠짐','t','n',1],['heal','상태 단계 회복','t','n',1],['hp','동행 HP 감소','t','frac','1/4'],['hpUp','동행 HP 회복','t','frac','1/4'],['st','동행 상태 이상','t','st','Poison'],['cure','동행 상태 이상 치유','t','none',''],['ord','4식 잃음','t','n',1],['cmd','6령 잃음','t','n',1],
  ['al','경계도 ±','p','n',10],['foeLv','다음 조우 야생 Lv ±','p','n',5],['bossLv','보스방 Lv ±','p','n',5],['rest','이번 휴식 단계 ↓','p','n',1],['restUp','이번 휴식 단계 ↑','p','n',1],['flag','표식 얻기','p','flag','표식'],['unflag','표식 잃기','p','flag','표식'],['memo','글만 (GM 처리)','p','text','']];
 const FXM=Object.fromEntries(FX.map(x=>[x[0],x]));
 const STS=[['Poison','독'],['Toxic','맹독'],['Burn','화상'],['Paralysis','마비'],['Sleep','잠듦'],['Confusion','혼란'],['Freeze','얼음']];const stKo=k=>(STS.find(x=>x[0]===k)||[k,k])[1];
 const QUAL=['지시','육성','통솔','능력'];
 const TYPES=['노말','불꽃','물','풀','전기','얼음','격투','독','땅','비행','에스퍼','벌레','바위','고스트','드래곤','악','강철','페어리'];
 const STEPN=['건강','부상','중상','빈사'];
 const ONM=Object.fromEntries(ON.map(x=>[x[0],x]));
 /* 본보기 (「+ 기믹」 고르기) — 노트 27 예시 */
 const TPL=[['빈 기믹',{n:'새 기믹',on:'room',to:'all',fx:[{k:'memo',v:'무슨 일이 일어난다'}]}],
  ['열기 — 방 2개마다 상태 +1 (불꽃 동행 면제)',{n:'열기',memo:'뜨거운 김이 올라온다',on:'room',every:2,to:'healthiest',unless:{type:'불꽃',flag:'냉각 장치'},fx:[{k:'step',v:1}]}],
  ['혹한 — 휴식 한 단계 ↓',{n:'혹한',memo:'몸이 데워지지 않는다',on:'rest',unless:{flag:'모닥불'},fx:[{k:'rest',v:1}]}],
  ['물때 — 방 3개마다 경계도 +10',{n:'물때',memo:'물이 차오른다',on:'room',every:3,unless:{flag:'물길 지도'},fx:[{k:'al',v:10}]}],
  ['잠긴 문 — 지시 15 로 피하기 · 못 피하면 상태 +1',{n:'잠긴 문',memo:'굳게 잠긴 문',on:'room',where:['trap'],to:'lead',save:{stat:'지시',target:15},unless:{flag:'출입 카드'},fx:[{k:'step',v:1}]}],
  ['봉인의 속삭임 — 체크 실패 3번째마다 보스방 Lv +5',{n:'봉인의 속삭임',memo:'봉인이 꿈틀거린다',on:'checkFail',every:3,unless:{flag:'봉인 조각'},fx:[{k:'bossLv',v:5}]}],
  ['독 안개 — 조우 직전 동행 「독」 (확률 50%)',{n:'독 안개',memo:'보랏빛 안개',on:'battle',chance:50,to:'random',fx:[{k:'st',v:'Poison'}]}],
  ['경계 사이렌 — 경계도 70 을 넘으면 다음 조우 Lv +5 (한 번)',{n:'경계 사이렌',memo:'사이렌이 울린다',on:'alert',alMin:70,once:1,fx:[{k:'foeLv',v:5}]}]];

 /* ---------- 정리 (가져오기 · 편집 저장 · 옛 꼴) ---------- */
 const fid=(s,i)=>String(s||'').replace(/[^\w가-힣]/g,'').slice(0,16)||('g'+(i+1));
 function fxNorm(f){if(!f||!FXM[f.k])return null;const t=FXM[f.k][3];let v=f.v;if(t==='n')v=clamp(Math.round(+v||0),-50,50);else if(t==='frac')v=/^\d+\/\d+$/.test(String(v))?String(v):'1/4';else if(t==='st')v=STS.some(x=>x[0]===v)?v:'Poison';else if(t==='flag')v=sTxt(v,20)||'표식';else if(t==='text')v=sTxt(v,120);else v='';return {k:f.k,v}}
 function norm(L){const ids=new Set();return (Array.isArray(L)?L:[]).slice(0,16).map((g,i)=>{if(!g||typeof g!=='object')return null;let id=fid(g.id||g.n,i);while(ids.has(id))id+='_';ids.add(id);
  const o={id,n:sTxt(g.n||g.name||'기믹',30),on:ONM[g.on]?g.on:(g.on==='check'&&g.cond&&g.cond.fail?'checkFail':'room')};if(g.cond&&g.cond.fail&&o.on==='check')o.on='checkFail';
  if(g.memo)o.memo=sTxt(g.memo,120);if(g.off)o.off=1;if(+g.every>1)o.every=clamp(Math.round(+g.every),2,12);if(+g.chance>0&&+g.chance<100)o.chance=clamp(Math.round(+g.chance),1,99);if(g.once)o.once=1;
  if(Array.isArray(g.where)&&g.where.length)o.where=g.where.slice(0,16).map(x=>sTxt(x,20)).filter(Boolean);
  for(const f of ['alMin','alMax'])if(g[f]!==''&&g[f]!=null&&Number.isFinite(+g[f]))o[f]=clamp(Math.round(+g[f]),0,100);
  for(const f of ['ifFlag','noFlag'])if(g[f])o[f]=sTxt(g[f],20);
  o.to=TO.some(x=>x[0]===g.to)?g.to:'all';
  if(g.save&&QUAL.includes(g.save.stat)&&+g.save.target>0)o.save={stat:g.save.stat,target:clamp(Math.round(+g.save.target),2,20)};
  const u=g.unless||{},uu={};if(u.type)uu.type=sTxt(u.type,10);if(u.flag)uu.flag=sTxt(u.flag,20);if(Object.keys(uu).length)o.unless=uu;
  let fx=Array.isArray(g.fx)?g.fx:[];if(!fx.length&&g.do&&typeof g.do==='object'){const d=g.do;for(const k of ['step','al','foeLv','bossLv','rest'])if(+d[k])fx.push({k,v:+d[k]});if(d.hp)fx.push({k:'hp',v:d.hp})}
  o.fx=fx.map(fxNorm).filter(Boolean).slice(0,8);return o}).filter(Boolean)}
 function mqNorm(L){return (Array.isArray(L)?L:[]).slice(0,6).map(p=>{if(!p||typeof p!=='object')return null;const o={name:sTxt(p.name,30).replace(/[『』]/g,''),eff:String(p.eff||'').slice(0,1200)};if(!o.name)return null;if(p.auto&&typeof p.auto==='object'&&JSON.stringify(p.auto).length<6000)o.auto=clone(p.auto);return o}).filter(Boolean)}

 /* ---------- 글 ---------- */
 const fxTxt=f=>{const m=FXM[f.k];if(!m)return '';const v=f.v;if(m[3]==='n')return `${m[1].replace(/ ±$/,'')} ${f.k==='al'||f.k==='foeLv'||f.k==='bossLv'?(v>0?'+':'')+v:v}`;if(m[3]==='frac')return `${m[1]} ${v}`;if(m[3]==='st')return `동행 「${stKo(v)}」`;if(m[3]==='flag')return `${m[1]} 「${v}」`;if(m[3]==='text')return v||m[1];return m[1]};
 function sumTxt(g){const on=ONM[g.on]||ON[0];const c=[];if(g.every)c.push(`${g.every}번째마다`);if(g.chance)c.push(`${g.chance}%`);if(g.once)c.push('한 번만');if(g.on==='alert'&&g.alMin!=null)c.push(`${g.alMin} 넘을 때`);else{if(g.alMin!=null)c.push(`경계도 ${g.alMin} 이상`);if(g.alMax!=null)c.push(`${g.alMax} 이하`)}if(g.where&&g.where.length)c.push('방 '+g.where.length+'곳');if(g.ifFlag)c.push(`「${g.ifFlag}」 있을 때`);if(g.noFlag)c.push(`「${g.noFlag}」 없을 때`);
  const who=(TO.find(x=>x[0]===g.to)||TO[0])[1];const fx=(g.fx||[]).map(fxTxt).join(' · ')||'효과 없음';const un=[];if(g.save)un.push(`${g.save.stat} ${g.save.target} 로 피함`);if(g.unless&&g.unless.type)un.push(`${g.unless.type} 동행 면제`);if(g.unless&&g.unless.flag)un.push(`「${g.unless.flag}」 로 꺼짐`);
  return {on:`${on[2]} ${on[1]}`,cond:c.join(' · '),who,fx,un:un.join(' · ')}}

 /* ---------- 실행 ---------- */
 const GLOG=10;
 function askSave(g,tname){return new Promise(res=>{const md=A().openModal(`<div class="mhead"><h2>⛰ 『${H(g.n)}』 피하기</h2><span class="sp"></span></div><p class="small">${H(tname)} — <b>${H(g.save.stat)} ${g.save.target}</b> 체크로 피할 수 있다. 굴린 결과는?</p><div class="row" style="gap:8px;justify-content:flex-end;margin-top:10px"><button class="btn" data-sv="0">못 피했다 — 효과를 건다</button><button class="btn pri" data-sv="1">피했다</button></div>`);
  md.querySelectorAll('[data-sv]').forEach(b=>b.onclick=()=>{A().closeModal();res(b.dataset.sv==='1')});})}
 /* api = {d(지금 던전, id 포함), R, party, walkOf, alAdd, upd, P0, notice} */
 async function run(on,ctx,api){ctx=ctx||{};const d=api&&api.d;if(!d||!Array.isArray(d.gim)||!d.gim.length)return ctx;const G=norm(d.gim);if(!G.some(g=>g.on===on&&!g.off))return ctx;
  const rid=ctx.rid||d.at,room=(api.R(d)||{})[rid]||{};const fl=Object.assign({},d.fl||{}),cnt=Object.assign({},d.gn||{}),done=Object.assign({},d.gdone||{}),gx=Object.assign({},d.gx||{});
  const RO=ST().roster||{},TR=RO.trainers||{},MO=RO.mons||{};const k=K();const injOf=tid=>{try{return +((k&&k.tsk?k.tsk(tid):{}).inj)||0}catch(e){return 0}};const TN=tid=>(TR[tid]||{}).name||tid;
  const snaps=new Map();const snap=p=>{const key=p.join('/');if(!snaps.has(key))snaps.set(key,[p,clone(getP(ST(),p))])};const DP=['dg','list',d.id];
  const lines=[],names=[];let countOnly=false;
  for(const g of G){if(g.off||g.on!==on)continue;const W=g.where||[];if(W.length&&!W.includes('*')&&!W.includes(room.t)&&!W.includes(rid))continue;
   const al=clamp(+d.al||0,0,100);if(on==='alert'){if(g.alMin==null||!(+ctx.from<g.alMin&&+ctx.to>=g.alMin))continue}else{if(g.alMin!=null&&al<g.alMin)continue;if(g.alMax!=null&&al>g.alMax)continue}
   if(g.ifFlag&&!fl[g.ifFlag])continue;if(g.noFlag&&fl[g.noFlag])continue;if(g.once&&done[g.id])continue;
   cnt[g.id]=(+cnt[g.id]||0)+1;countOnly=true;if(g.every&&cnt[g.id]%g.every)continue;if(g.chance&&Math.random()*100>=g.chance){lines.push(`『${g.n}』 — 이번엔 피해 갔다 (${g.chance}%)`);continue}
   const un=g.unless||{};if(un.flag&&fl[un.flag]){lines.push(`『${g.n}』 — 표식 「${un.flag}」 로 꺼져 있다`);continue}
   let T=(api.party(d)||[]).filter(t=>TR[t]&&injOf(t)<3);const to=g.to||'all';
   if(to==='healthiest')T=T.length?[T.slice().sort((a,b)=>injOf(a)-injOf(b))[0]]:[];else if(to==='weakest')T=T.length?[T.slice().sort((a,b)=>injOf(b)-injOf(a))[0]]:[];else if(to==='lead')T=T.length?[ctx.tid&&T.includes(ctx.tid)?ctx.tid:T[0]]:[];else if(to==='random')T=T.length?[T[Math.floor(Math.random()*T.length)]]:[];
   if(un.type)T=T.filter(tid=>{const ex=(api.walkOf(tid)||[]).some(mid=>{const m=MO[mid];return m&&[...(m.typesKo||[]),...(m.types||[])].includes(un.type)});if(ex)lines.push(`『${g.n}』 — ${TN(tid)} 면제 (동행 ${un.type})`);return !ex});
   if(g.save){const keep=[];for(const tid of T){if(await askSave(g,TN(tid)))lines.push(`『${g.n}』 — ${TN(tid)} 피했다 (${g.save.stat} ${g.save.target})`);else keep.push(tid)}T=keep}
   const tfx=g.fx.filter(f=>FXM[f.k][2]==='t'),pfx=g.fx.filter(f=>FXM[f.k][2]==='p');if(!pfx.length&&!T.length)continue;
   names.push(g.n);lines.push(`『${g.n}』${g.memo?' — '+g.memo:''}`);done[g.id]=1;
   for(const tid of T){snap(['skill','trainers',tid]);snap(['roster','trainers',tid,'orderCount']);if(((ST().battle||{}).trainers||{})[tid])snap(['battle','trainers',tid,'orderCount']);const ms=(api.walkOf(tid)||[]).filter(mid=>MO[mid]);for(const mid of ms){snap(['roster','mons',mid]);if(((ST().battle||{}).mons||{})[mid])snap(['battle','mons',mid])}
    for(const f of tfx){try{
     if(f.k==='step'&&k&&k.stepUp){for(let i=0;i<f.v;i++){const r=await k.stepUp(tid,g.n);lines.push(r.line)}}
     else if(f.k==='heal'){const now=injOf(tid),to2=Math.max(0,now-f.v);if(to2!==now){await A().set(['skill','trainers',tid,'inj'],to2);lines.push(`${TN(tid)} 「${STEPN[now]}」 → 「${STEPN[to2]}」 (${g.n})`)}}
     else if((f.k==='hp'||f.k==='st')&&k&&k.applyPenalty){for(const mid of ms){const r=await k.applyPenalty(tid,f.k==='hp'?{dmg:f.v}:{st:f.v},g.n,mid);if(r)lines.push(r.split('\n').slice(1).join(' · '))}}
     else if((f.k==='hpUp'||f.k==='cure')&&k&&k.putMon){for(const mid of ms){await k.putMon(mid,(x,b)=>{if(f.k==='cure'){if(b)x.states={};else x.sheetStates={};return}const [a,c]=String(f.v).split('/').map(Number);const mx=+(x.hp||{}).max||0;const cur=b?(+(x.hp||{}).cur||0):(x.sheetHp==null?mx:+x.sheetHp||0);if(cur<=0)return;const v=Math.min(mx,cur+Math.max(1,Math.floor(mx*a/c)));if(b)x.hp.cur=v;else x.sheetHp=v});const m=MO[mid];lines.push(`${m.name} ${f.k==='cure'?'상태 이상 치유':'HP 회복 '+f.v}`)}}
     else if((f.k==='ord'||f.k==='cmd')&&k&&k.applyPenalty){const r=await k.applyPenalty(tid,f.k==='ord'?{oo:f.v}:{oc:f.v},g.n,'');if(r)lines.push(r.split('\n').slice(1).join(' · '))}
    }catch(e){lines.push(`(${fxTxt(f)} 실패: ${e.message||e})`)}}}
   for(const f of pfx){try{
    if(f.k==='al'){snap([...DP,'al']);const t=await api.alAdd(f.v,g.n,{quiet:1});if(t)lines.push(t)}
    else if(f.k==='foeLv'){gx.foe=(+gx.foe||0)+f.v;lines.push(`다음 조우 야생 Lv ${f.v>0?'+':''}${f.v}`)}
    else if(f.k==='bossLv'){gx.boss=(+gx.boss||0)+f.v;lines.push(`보스방 Lv ${f.v>0?'+':''}${f.v}`)}
    else if(f.k==='rest'){ctx.restDown=(ctx.restDown||0)+f.v;lines.push(`이번 휴식 ${f.v}단계 ↓`)}
    else if(f.k==='restUp'){ctx.restDown=(ctx.restDown||0)-f.v;lines.push(`이번 휴식 ${f.v}단계 ↑`)}
    else if(f.k==='flag'){fl[f.v]=1;lines.push(`표식 「${f.v}」 을 얻었다`)}
    else if(f.k==='unflag'){delete fl[f.v];lines.push(`표식 「${f.v}」 을 잃었다`)}
    else if(f.k==='memo'&&f.v)lines.push(f.v);
   }catch(e){lines.push(`(${fxTxt(f)} 실패: ${e.message||e})`)}}}
  if(!countOnly)return ctx;
  for(const f of ['gn','gdone','gx','fl'])snap([...DP,f]);
  const ops=[[[...DP,'gn'],cnt],[[...DP,'gdone'],done],[[...DP,'gx'],gx],[[...DP,'fl'],fl]];
  if(names.length){const log=(ST().dg||{}).glog||[];const ent={at:Date.now(),did:d.id,dn:d.n||'',on,names,lines:lines.slice(0,20),snaps:[...snaps.values()]};ops.push([['dg','glog'],[...log.filter(x=>x&&x.did===d.id).slice(-(GLOG-1)),...log.filter(x=>x&&x.did!==d.id).slice(-20),ent]])}
  try{await A().setMany(ops)}catch(e){console.warn('gim',e)}
  if(lines.length)A().sysLog(`[${d.n||'던전'}] ⛰ 던전 기믹${names.length?' — '+names.map(n=>'『'+n+'』').join(' '):''}\n${lines.join('\n')}${names.length?'\n(잘못 걸렸으면 던전 패널 「↶ 기믹 되돌리기」)':''}`,'battle');
  return ctx}
 function logOf(did){return ((ST().dg||{}).glog||[]).filter(x=>x&&x.did===did)}
 async function undoLast(did){const log=(ST().dg||{}).glog||[];let i=-1;for(let j=log.length-1;j>=0;j--)if(log[j]&&log[j].did===did){i=j;break}if(i<0)return A().toast('되돌릴 기믹이 없다');const e=log[i];
  const ops=(e.snaps||[]).map(([p,v])=>[p,v]);ops.push([['dg','glog'],log.filter((_,j)=>j!==i)]);try{await A().setMany(ops)}catch(err){return A().toast('되돌리지 못했다: '+err.message)}
  A().sysLog(`[${e.dn||'던전'}] ↶ 던전 기믹 되돌림 — ${(e.names||[]).map(n=>'『'+n+'』').join(' ')} (${new Date(e.at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})})`,'battle');A().toast('되돌렸다')}
 /* 미궁 포텐셜을 야생 트레이너 고유로 (app.js encounter) */
 function mqFor(did){const d=((ST().dg||{}).list||{})[did];return d?mqNorm(d.mq):[]}
 function mqInject(t,did){const L=mqFor(did);if(!L.length)return 0;t.unique=Array.isArray(t.unique)?t.unique.filter(u=>!(u&&u.mq)):[];for(const p of L){const u={name:p.name,eff:p.eff,mq:1};if(p.auto)u.auto=p.auto;t.unique.push(u)}return L.length}

 /* ---------- 편집 창 ---------- */
 const E={did:'',tab:'gim',gim:[],mq:[],open:-1,dirty:false};
 const dOf=()=>((ST().dg||{}).list||{})[E.did];
 const roomsOf=d=>Object.entries((d&&d.r)||{}).map(([id,r])=>({id,n:r.n||id,t:r.t}));
 const TYK=()=>{const T=(DGU()&&DGU().TY)||{};return Object.entries(T).map(([k,v])=>[k,v.k||k])};
 const flagsOf=d=>{const s=new Set(Object.keys((d&&d.fl)||{}));for(const r of Object.values((d&&d.r)||{}))if(r.rw&&r.rw.flag)s.add(r.rw.flag);for(const g of E.gim){if(g.unless&&g.unless.flag)s.add(g.unless.flag);if(g.ifFlag)s.add(g.ifFlag);if(g.noFlag)s.add(g.noFlag);for(const f of g.fx||[])if(f.k==='flag'||f.k==='unflag')s.add(f.v)}return [...s].filter(Boolean)};
 const sel=(attr,opts,v)=>`<select ${attr}>${opts.map(([k,n])=>`<option value="${H(k)}" ${String(k)===String(v)?'selected':''}>${H(n)}</option>`).join('')}</select>`;
 function gimCard(g,i,d){const S=sumTxt(g);const op=E.open===i;
  return `<div class="gmk ${g.off?'off':''} ${op?'op':''}" data-gi="${i}"><div class="gmk-h"><button class="gmk-tg" data-ga="tog" title="${g.off?'꺼져 있음 — 켜기':'켜져 있음 — 끄기'}" aria-pressed="${!g.off}"><i></i></button>
   <button class="gmk-sum" data-ga="open"><b>${H(g.n)}</b><span class="gmk-on">${H(S.on)}${S.cond?' · '+H(S.cond):''}</span><span class="gmk-fx">${H(S.who)} → ${H(S.fx)}</span>${S.un?`<span class="gmk-un">${H(S.un)}</span>`:''}</button>
   <span class="gmk-ac"><button class="btn xs ghost" data-ga="up" title="위로">▲</button><button class="btn xs ghost" data-ga="dn" title="아래로">▼</button><button class="btn xs ghost" data-ga="dup" title="복제">⧉</button><button class="btn xs ghost gmk-del" data-ga="del" title="삭제">✕</button></span></div>
   ${op?gimForm(g,i,d):''}</div>`}
 function gimForm(g,i,d){const rooms=roomsOf(d),tyk=TYK(),fls=flagsOf(d);const W=new Set(g.where||[]);
  const fxRow=(f,j)=>{const m=FXM[f.k];const t=m[3];const val=t==='n'?`<input type="number" class="n" data-gfv="${j}" value="${H(f.v)}" step="1">`:t==='frac'?sel(`data-gfv="${j}"`,[['1/8','1/8'],['1/6','1/6'],['1/4','1/4'],['1/3','1/3'],['1/2','1/2']],f.v):t==='st'?sel(`data-gfv="${j}"`,STS,f.v):t==='flag'?`<input type="text" list="gmFlags" data-gfv="${j}" value="${H(f.v)}" placeholder="표식 이름">`:t==='text'?`<input type="text" data-gfv="${j}" value="${H(f.v)}" placeholder="GM 에게 남길 글">`:'<span class="dim small">—</span>';
   return `<div class="gmk-fxr">${sel(`data-gfk="${j}"`,FX.map(x=>[x[0],(x[2]==='t'?'👤 ':'⛰ ')+x[1]]),f.k)}${val}<button class="btn xs ghost" data-gfx-del="${j}" title="빼기">✕</button></div>`};
  return `<div class="gmk-f">
   <div class="gmk-g2"><label>이름<input type="text" data-gf="n" value="${H(g.n)}" maxlength="30"></label><label>로그에 붙는 글<input type="text" data-gf="memo" value="${H(g.memo||'')}" maxlength="120" placeholder="예: 뜨거운 김이 올라온다"></label></div>
   <fieldset><legend>언제</legend><div class="gmk-g3"><label>때${sel('data-gf="on"',ON.map(x=>[x[0],x[2]+' '+x[1]]),g.on)}</label><label>몇 번째마다<input type="number" class="n" min="1" max="12" data-gf="every" value="${H(g.every||1)}"></label><label>확률 %<input type="number" class="n" min="1" max="100" data-gf="chance" value="${H(g.chance||100)}"></label></div>
    <label class="gmk-chk"><input type="checkbox" data-gf="once" ${g.once?'checked':''}> 이 던전에서 한 번만</label></fieldset>
   <fieldset><legend>조건</legend><div class="gmk-g3"><label>${g.on==='alert'?'넘어설 경계도':'경계도 이상'}<input type="number" class="n" min="0" max="100" data-gf="alMin" value="${H(g.alMin??'')}" placeholder="—"></label>${g.on==='alert'?'':`<label>경계도 이하<input type="number" class="n" min="0" max="100" data-gf="alMax" value="${H(g.alMax??'')}" placeholder="—"></label>`}<label>표식이 있을 때<input type="text" list="gmFlags" data-gf="ifFlag" value="${H(g.ifFlag||'')}" placeholder="—"></label><label>표식이 없을 때<input type="text" list="gmFlags" data-gf="noFlag" value="${H(g.noFlag||'')}" placeholder="—"></label></div>
    <div class="gmk-lab">어느 방 <small>(아무것도 안 고르면 모든 방)</small></div><div class="gmk-chips">${tyk.map(([k,n])=>`<button class="chip ${W.has(k)?'on':''}" data-gw="${H(k)}">${H(n)}</button>`).join('')}<span class="gmk-sep"></span>${rooms.map(r=>`<button class="chip ${W.has(r.id)?'on':''}" data-gw="${H(r.id)}" title="${H(r.id)}">${H(r.n)}</button>`).join('')}</div></fieldset>
   <fieldset><legend>누구에게 · 효과</legend><label>대상${sel('data-gf="to"',TO,g.to)}</label><div class="gmk-fxl">${(g.fx||[]).map(fxRow).join('')||'<p class="dim small">효과가 없다 — 아래에서 더하기</p>'}</div>
    <div class="row" style="gap:6px;align-items:center"><select data-gfx-new><option value="">＋ 효과 더하기</option>${FX.map(x=>`<option value="${x[0]}">${x[2]==='t'?'👤 대상마다':'⛰ 일행 한 번'} · ${H(x[1])}</option>`).join('')}</select><small class="dim">👤 = 대상 트레이너마다 · ⛰ = 일행에 한 번</small></div></fieldset>
   <fieldset><legend>피하기 · 면제</legend><div class="gmk-g3"><label>피하는 체크${sel('data-gf="sv_stat"',[['','없음'],...QUAL.map(q=>[q,q])],g.save?g.save.stat:'')}</label><label>목표<input type="number" class="n" min="2" max="20" data-gf="sv_t" value="${H(g.save?g.save.target:12)}"></label><label>이 타입 동행이면 면제${sel('data-gf="un_type"',[['','없음'],...TYPES.map(t=>[t,t])],(g.unless||{}).type||'')}</label><label>이 표식이면 꺼짐<input type="text" list="gmFlags" data-gf="un_flag" value="${H((g.unless||{}).flag||'')}" placeholder="예: 냉각 장치"></label></div>
    <p class="dg-help" style="margin:2px 0 0">피하는 체크가 있으면 걸릴 때 GM 에게 「피했다 / 못 피했다」를 묻는다. 표식은 곁방의 「보상 표식」(방 편집)에서 얻는다.</p></fieldset>
   <datalist id="gmFlags">${fls.map(f=>`<option value="${H(f)}">`).join('')}</datalist></div>`}
 function mqCard(p,i){return `<div class="gmk mq" data-mi="${i}"><div class="gmk-g2"><label>이름<input type="text" data-mf="name" value="${H(p.name)}" maxlength="30" placeholder="예: 이계의 숨결"></label><span class="gmk-ac" style="align-self:end"><button class="btn xs ${p.auto?'pri':''}" data-ma="auto" title="효과 엔진 구문">${p.auto?'⚙ 자동화 있음':'⚙ 자동화'}</button><button class="btn xs ghost" data-ma="up">▲</button><button class="btn xs ghost" data-ma="dn">▼</button><button class="btn xs ghost gmk-del" data-ma="del">✕</button></span></div>
   <label class="gmk-lab">효과 <small>(【N/시】【선행】 같은 태그 그대로 — 고유 포텐셜과 같은 글)</small><textarea data-mf="eff" rows="3" placeholder="예: 【2/시】【선행】/이번 턴 아군 전체의 스피드를 강화(1.5배)한다.">${H(p.eff)}</textarea></label></div>`}
 function logHTML(){const L=logOf(E.did).slice().reverse();if(!L.length)return '<p class="dim small">아직 걸린 기믹이 없다.</p>';
  return L.map((e,i)=>`<div class="gmk-log"><div class="row" style="gap:8px;align-items:center"><b>${(e.names||[]).map(n=>'『'+H(n)+'』').join(' ')}</b><small class="dim">${H((ONM[e.on]||[0,e.on])[1])} · ${new Date(e.at).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</small><span class="sp"></span>${i===0?'<button class="btn xs" data-gundo>↶ 되돌리기</button>':''}</div><pre>${H((e.lines||[]).join('\n'))}</pre></div>`).join('')+'<p class="dg-help">되돌리기는 가장 최근 것부터 하나씩 — 그때 바뀐 상태 단계 · 4식 6령 · 동행 HP · 경계도 · 표식을 전 값으로 돌린다(은열쇠 덱 패널티는 따로).</p>'}
 function html(){const d=dOf();if(!d)return '<p>던전이 없다</p>';const nG=E.gim.length,nM=E.mq.length,nL=logOf(E.did).length;
  const tabs=[['gim',`⛰ 던전 기믹 ${nG}`],['mq',`♛ 미궁 포텐셜 ${nM}`],['log',`↶ 기록 ${nL}`],['json','{ } JSON']].map(([k,n])=>`<button class="gmk-tab ${E.tab===k?'on':''}" data-gt="${k}">${n}</button>`).join('');
  let body='';
  if(E.tab==='gim')body=`<p class="dg-help" style="margin:0 0 8px">탐사 중(방 · 휴식 · 체크 · 조우)에 저절로 걸리는 던전 규칙. 카드를 눌러 펼쳐 고친다. 끄기 스위치로 잠깐 멈출 수 있다.</p><div class="gmk-list">${E.gim.map((g,i)=>gimCard(g,i,d)).join('')||'<p class="dim small">기믹이 없다.</p>'}</div>
   <div class="row" style="gap:6px;margin-top:8px"><select data-gnew>${TPL.map((t,i)=>`<option value="${i}">${H(t[0])}</option>`).join('')}</select><button class="btn sm" data-gadd>＋ 기믹 더하기</button></div>`;
  else if(E.tab==='mq')body=`<p class="dg-help" style="margin:0 0 8px">『미궁 포텐셜』 = 던전 배틀 안에서 쓰는 야생 쪽 <b>고유</b>. 이 던전의 조우마다 그 방 야생 트레이너의 고유로 붙어서, 배틀 「포텐셜 발동」 · 자동화가 고유와 똑같이 돈다. 룰북: 심도 3 = 1개 · 심도 4 = 2개. 『야생 포텐셜』(전용)은 시트에서 야생 포켓몬의 「전용 포텐셜」로.</p>
   <div class="gmk-list">${E.mq.map(mqCard).join('')||'<p class="dim small">미궁 포텐셜이 없다.</p>'}</div><button class="btn sm" data-madd style="margin-top:8px">＋ 미궁 포텐셜 더하기</button>`;
  else if(E.tab==='log')body=logHTML();
  else body=`<p class="dg-help" style="margin:0 0 6px">고급 — 기믹(gim) · 미궁 포텐셜(mq)을 JSON 으로 한꺼번에. 「JSON 적용」을 누르면 위 칸들에 들어간다(저장은 따로).</p><textarea data-gjson rows="14" style="width:100%;font:12px/1.4 var(--mono,monospace)">${H(JSON.stringify({gim:E.gim,mq:E.mq},null,1))}</textarea><div class="row" style="gap:6px;margin-top:6px"><button class="btn sm" data-gjapply>JSON 적용</button></div>`;
  return `<div class="mhead"><h2>⛰ ${H(d.n||'던전')} — 기믹 · 미궁 포텐셜</h2><span class="sp"></span><button class="btn ghost" data-gx>닫기</button></div>
   <div class="gmk-tabs">${tabs}</div><div class="gmk-body">${body}</div>
   <div class="gmk-foot"><span class="small ${E.dirty?'warn':'dim'}">${E.dirty?'● 저장하지 않은 고침이 있다':'저장됨'}</span><span class="sp"></span>${E.tab==='log'?'':`<button class="btn ghost" data-grev ${E.dirty?'':'disabled'}>고친 것 버리기</button><button class="btn pri" data-gsave ${E.dirty?'':'disabled'}>저장</button>`}</div>`}
 let MD=null;
 function draw(){if(!MD||!document.body.contains(MD))return;const keep=MD.querySelector('.gmk-body');const sc=keep?keep.scrollTop:0;MD.innerHTML=html();const b=MD.querySelector('.gmk-body');if(b)b.scrollTop=sc;bind()}
 const mark=()=>{E.dirty=true;const s=MD&&MD.querySelector('.gmk-foot .small');if(s){s.textContent='● 저장하지 않은 고침이 있다';s.className='small warn'}MD&&MD.querySelectorAll('[data-gsave],[data-grev]').forEach(b=>b.disabled=false)};
 function bind(){const m=MD;if(!m)return;
  m.querySelector('[data-gx]').onclick=()=>{if(E.dirty&&!confirm('저장하지 않은 고침을 버리고 닫을까?'))return;A().closeModal()};
  m.querySelectorAll('[data-gt]').forEach(b=>b.onclick=()=>{E.tab=b.dataset.gt;E.open=-1;draw()});
  const sv=m.querySelector('[data-gsave]');if(sv)sv.onclick=save;const rv=m.querySelector('[data-grev]');if(rv)rv.onclick=()=>{load(E.did);draw()};
  /* 기믹 카드 */
  m.querySelectorAll('[data-gi]').forEach(card=>{const i=+card.dataset.gi;const g=E.gim[i];
   card.querySelectorAll('[data-ga]').forEach(b=>b.onclick=e=>{e.stopPropagation();const a=b.dataset.ga;
    if(a==='open')E.open=E.open===i?-1:i;else if(a==='tog'){g.off=g.off?0:1;mark()}else if(a==='up'&&i>0){[E.gim[i-1],E.gim[i]]=[E.gim[i],E.gim[i-1]];E.open=E.open===i?i-1:E.open;mark()}else if(a==='dn'&&i<E.gim.length-1){[E.gim[i+1],E.gim[i]]=[E.gim[i],E.gim[i+1]];E.open=E.open===i?i+1:E.open;mark()}
    else if(a==='dup'){const c=clone(g);c.id=g.id+'2';c.n=g.n+' (복제)';E.gim.splice(i+1,0,c);E.open=i+1;mark()}else if(a==='del'){if(!confirm(`『${g.n}』 기믹을 지울까?`))return;E.gim.splice(i,1);E.open=-1;mark()}
    draw()});
   card.querySelectorAll('[data-gf]').forEach(inp=>inp.onchange=()=>{const f=inp.dataset.gf,v=inp.type==='checkbox'?inp.checked:inp.value.trim();
    if(f==='n'||f==='memo')g[f]=v;else if(f==='on'){g.on=v;draw()}else if(f==='every'){if(+v>1)g.every=+v;else delete g.every}else if(f==='chance'){if(+v>0&&+v<100)g.chance=+v;else delete g.chance}else if(f==='once'){if(v)g.once=1;else delete g.once}
    else if(f==='alMin'||f==='alMax'){if(v===''||!Number.isFinite(+v))delete g[f];else g[f]=clamp(Math.round(+v),0,100)}else if(f==='ifFlag'||f==='noFlag'){if(v)g[f]=v;else delete g[f]}else if(f==='to')g.to=v;
    else if(f==='sv_stat'){if(v)g.save={stat:v,target:+((g.save||{}).target)||12};else delete g.save;draw()}else if(f==='sv_t'){if(g.save)g.save.target=clamp(Math.round(+v||12),2,20)}
    else if(f==='un_type'||f==='un_flag'){g.unless=g.unless||{};const kk=f==='un_type'?'type':'flag';if(v)g.unless[kk]=v;else delete g.unless[kk];if(!Object.keys(g.unless).length)delete g.unless}
    mark();const sum=card.querySelector('.gmk-sum');if(sum){const S=sumTxt(g);sum.innerHTML=`<b>${H(g.n)}</b><span class="gmk-on">${H(S.on)}${S.cond?' · '+H(S.cond):''}</span><span class="gmk-fx">${H(S.who)} → ${H(S.fx)}</span>${S.un?`<span class="gmk-un">${H(S.un)}</span>`:''}`}});
   card.querySelectorAll('[data-gw]').forEach(b=>b.onclick=()=>{const w=b.dataset.gw;g.where=g.where||[];const j=g.where.indexOf(w);if(j>=0)g.where.splice(j,1);else g.where.push(w);if(!g.where.length)delete g.where;mark();draw()});
   card.querySelectorAll('[data-gfk]').forEach(s=>s.onchange=()=>{const j=+s.dataset.gfk;const m0=FXM[s.value];g.fx[j]={k:s.value,v:m0[4]};mark();draw()});
   card.querySelectorAll('[data-gfv]').forEach(s=>s.onchange=()=>{const j=+s.dataset.gfv;const f=g.fx[j];if(!f)return;const t=FXM[f.k][3];f.v=t==='n'?clamp(Math.round(+s.value||0),-50,50):s.value.trim();mark()});
   card.querySelectorAll('[data-gfx-del]').forEach(b=>b.onclick=()=>{g.fx.splice(+b.dataset.gfxDel,1);mark();draw()});
   const nf=card.querySelector('[data-gfx-new]');if(nf)nf.onchange=()=>{const m0=FXM[nf.value];if(!m0)return;g.fx=g.fx||[];g.fx.push({k:m0[0],v:m0[4]});mark();draw()}});
  const ga=m.querySelector('[data-gadd]');if(ga)ga.onclick=()=>{const t=TPL[+m.querySelector('[data-gnew]').value]||TPL[0];const g=norm([clone(t[1])])[0];let id=g.id;while(E.gim.some(x=>x.id===id))id+='_';g.id=id;E.gim.push(g);E.open=E.gim.length-1;mark();draw()};
  /* 미궁 포텐셜 */
  m.querySelectorAll('[data-mi]').forEach(card=>{const i=+card.dataset.mi;const p=E.mq[i];
   card.querySelectorAll('[data-mf]').forEach(inp=>inp.oninput=()=>{p[inp.dataset.mf]=inp.dataset.mf==='name'?inp.value.replace(/[『』]/g,'').slice(0,30):inp.value.slice(0,1200);mark()});
   card.querySelectorAll('[data-ma]').forEach(b=>b.onclick=()=>{const a=b.dataset.ma;
    if(a==='del'){if(!confirm(`『${p.name||'이름 없음'}』 미궁 포텐셜을 지울까?`))return;E.mq.splice(i,1);mark();draw()}
    else if(a==='up'&&i>0){[E.mq[i-1],E.mq[i]]=[E.mq[i],E.mq[i-1]];mark();draw()}else if(a==='dn'&&i<E.mq.length-1){[E.mq[i+1],E.mq[i]]=[E.mq[i],E.mq[i+1]];mark();draw()}
    else if(a==='auto'){const FU=window.OM_FX_UI;if(!FU||!FU.openEditor)return A().toast('효과 엔진 편집기를 아직 못 불러왔다');if(!p.name)return A().toast('이름을 먼저 적어 줘');const snapE=clone({gim:E.gim,mq:E.mq,tab:E.tab,dirty:E.dirty});
     FU.openEditor({mon:{name:(dOf()||{}).n||'미궁',auto:p.auto?{[p.name]:p.auto}:{},tid:''},kind:'pot',name:p.name,text:p.eff||'',save:async auto=>{const d=dOf();Object.assign(E,{gim:snapE.gim,mq:snapE.mq,tab:'mq',dirty:true});if(auto)E.mq[i].auto=auto;else delete E.mq[i].auto;open(E.did,true);A().toast(auto?'구문을 넣었다 — 「저장」을 눌러야 던전에 남는다':'구문을 뺐다')}})}})});
  const ma=m.querySelector('[data-madd]');if(ma)ma.onclick=()=>{E.mq.push({name:'',eff:''});mark();draw()};
  /* 기록 · JSON */
  const gu=m.querySelector('[data-gundo]');if(gu)gu.onclick=async()=>{if(!confirm('가장 최근 기믹을 되돌릴까? (그때 바뀐 상태 단계 · 4식 6령 · HP · 경계도 · 표식)'))return;await undoLast(E.did);setTimeout(draw,400)};
  const gj=m.querySelector('[data-gjapply]');if(gj)gj.onclick=()=>{let o;try{o=JSON.parse(m.querySelector('[data-gjson]').value)}catch(e){return A().toast('JSON 을 읽지 못했다: '+e.message)}E.gim=norm(Array.isArray(o)?o:o.gim||[]);if(!Array.isArray(o))E.mq=mqNorm(o.mq||[]);mark();A().toast(`기믹 ${E.gim.length} · 미궁 포텐셜 ${E.mq.length} 을 칸에 넣었다 — 「저장」`);E.tab='gim';draw()}}
 function load(did){const d=((ST().dg||{}).list||{})[did]||{};E.did=did;E.gim=norm(d.gim);E.mq=mqNorm(d.mq);E.dirty=false}
 async function save(){const d=dOf();if(!d)return;const G=norm(E.gim),M=mqNorm(E.mq);const bad=E.mq.filter(p=>!(p.name||'').trim()).length;
  const ok=await DGU().dgUpd({['list/'+E.did+'/gim']:G.length?G:null,['list/'+E.did+'/mq']:M.length?M:null});if(!ok)return;E.gim=G;E.mq=M;E.dirty=false;A().toast(`저장 — 기믹 ${G.length} · 미궁 포텐셜 ${M.length}${bad?` (이름 없는 ${bad}개는 뺐다)`:''}`);draw()}
 function open(did,keep){if(!keep)load(did);else E.did=did;if(!keep){E.tab='gim';E.open=-1}MD=A().openModal(html());MD.classList.add('gmk-modal');bind()}
 return {norm,mqNorm,run,undoLast,logOf,mqInject,mqFor,open,sumTxt,ON,FX,TPL}})();
