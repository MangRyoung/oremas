/* ---------- 자동화 구문 편집기 + 생성기 (맵툴 「레디메이드 생성기」·포켓몬 관리의 「구문」을 옮긴 것) ----------
   openEditor({mon, kind:'pot'|'trait'|'item', name, text, save(auto|null)})
   · 레디메이드에 같은 이름의 자동화가 있으면 그것이 기본으로 돈다 (읽기 전용 미리보기 · 「복사해서 고치기」)
   · 이 포켓몬만의 구문(m.auto[name]) 을 한국어 구문으로 쓰거나 생성기로 줄을 만든다. 저장하면 레디메이드보다 우선.
   openRm(name?) : 레디메이드 DB 창 (검색 · 보기 · GM 수정 → state.dbx.rm) */
"use strict";
window.OM_FX_UI=(()=>{
 const A=()=>window.OM_APP, FX=()=>window.OM_FX, DB=()=>window.OM_DB||{};
 const $=(q,el)=>(el||document).querySelector(q);
 const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const HELP=`한 줄에 명령 하나 (「;」로 이어 써도 된다). 대상을 안 쓰면 자신(상태·피해·특성은 상대 1체).
대상: 자신 · 아군전체 · 상대전체 · 자신이외 · 전체 · 아군1체 · 상대1체 · 자신이외무작위 · 상대무작위 · 전원무작위 · 에리어
랭크 [대상] 공격+1 방어-1 … [임시] [강제]        배율 [대상] 공격×1.33 …        초기화 랭크|배율|전부
위력 ×1.3 [대상] [타입:불꽃,물] [물리|특수] [굉장|별로|보통] [단일|전체기] [자속|비자속] [태그:소리,접촉] [위력≥150] [위력≤60] [역할:에이스] [수세|공세] [급소방호1] [급소+1] [확정급소|급소없음] [N회] [이번턴] [N턴] [해제]
완화 ×0.75 … (위력과 같은 조건 — 받는 쪽)
상태 화상 [대상] [N턴] [강제]        상태확률 화상 50% [대상] [1체]        치유 [대상] [독,맹독 | 이상] [N%]        상태초기화 [대상] [전부]
회복 1/4 [대상] [전부] [타입:독]        피해 1/8 [대상] [현재|직전|타입:바위] [제외:독] [상태:잠듦] [빈사없음]
날씨 비 5 · 날씨 해제        필드 그래스필드 5 · 룸 트릭룸 5 · 필드상태 중력 5        설치기 [아군|상대] 리플렉터 5
타입 [대상] 추가|변경|원래 불꽃,비행        특성 [대상] 변경 X · 특성 원래        역할 추가|제거 에이스,블로커        추격 [숨김]
비례무시 [대상] [빈사|설치기|설치기피해|반동] [N턴]        우선도 +1 [대상] [타입:X] [물리|특수|변화] [태그:회복] [이번턴]
면역 [대상] 잠듦,마비 · 면역 이상        감소무시 [대상] [공격] [N턴]        강화무시 [공격시|받음] [방어|회피|공격|양쪽]        하늘위 [대상] [N턴]
확인 "조건 문장"  (발동 때 물어본다)        조건 아군빈사 · 조건 HP≤1/2        레이드 구간:4
선택:   (여러 효과 중 고르기)
- ① 라벨 → 랭크 공격+1
- ② 라벨 → 회복 1/4
효과 글의 표식: 【등장】 등장 때 자동 · 【상시】 처음 한 번 자동 · 【N/시】 횟수 · 드물게/저확률/중확률/고확률 확률 판정`;
 const KINDS=[['rank','랭크 변화'],['mult','배율 변화'],['boost','위력 강화'],['guard','위력 완화'],['state','상태 변화'],['statefx','상태 (확률)'],['cure','상태 치유'],['heal','HP 회복'],['dmg','HP 대미지'],['weather','날씨'],['terrain','필드·룸'],['etc','필드의 상태'],['object','설치기'],['type','타입 변경'],['trait','특성 변경'],['prio','우선도'],['immune','상태 면역'],['nodrop','감소 무시'],['ignoreup','강화 무시'],['noind','비례 대미지/설치기 무시'],['float','하늘 위'],['role','역할 취급'],['pursuit','추격'],['confirm','조건 확인'],['cond','조건 (자동)']];
 const TG=['self','ally','enemy','others','all','ally1','enemy1','randother','randenemy','randall','area'];
 const TYPES=['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];
 const STATS=['attack','defense','specialattack','specialdefense','speed','accuracy','evasion','critical','critical_buff'];
 const sel=(id,opts,v,extra)=>`<select id="${id}" ${extra||''}>${opts.map(o=>`<option value="${esc(o[0])}" ${String(o[0])===String(v)?'selected':''}>${esc(o[1])}</option>`).join('')}</select>`;
 const tgSel=(id,v)=>sel(id,TG.map(t=>[t,FX().TGT_KO[t]]),v||'self');
 const tySel=(id,v,none)=>sel(id,[...(none?[['',none]]:[]),...TYPES.map(t=>[t,FX().TYPE_KO[t]])],v||'');
 const stOpts=()=>{const st=(DB().states||{}).st||{};return Object.keys(st).map(k=>[k,st[k].ko])};
 const stSel=(id,v)=>sel(id,stOpts(),v||'Burn');
 function genForm(kind){const K=FX();const ko=K.STAT_KO;
  const statsRow=mult=>`<div class="ggrid">${STATS.map(k=>`<label>${ko[k]} <input type="number" step="${mult?'0.01':'1'}" class="n xs" data-g="st_${k}" value="${mult?1:0}"></label>`).join('')}</div>`;
  switch(kind){
   case 'rank':return `<div class="row">대상 ${tgSel('g_tgt')} <label><input type="checkbox" data-g="temp"> 임시 (턴 종료까지)</label> <label><input type="checkbox" data-g="forced"> 강제 (감소 무시·흰안개 무시)</label></div>${statsRow(false)}`;
   case 'mult':return `<div class="row">대상 ${tgSel('g_tgt')} <label><input type="checkbox" data-g="temp"> 임시</label></div>${statsRow(true)}`;
   case 'boost':case 'guard':return `<div class="ggrid"><label>배율 ×<input type="number" step="0.01" class="n" data-g="v" value="${kind==='boost'?1.3:0.75}"></label><label>대상 ${tgSel('g_tgt')}</label><label>타입 (쉼표) <input type="text" data-g="types" placeholder="불꽃,물 (비우면 모든 타입)"></label>
     <label>분류 ${sel('g_cat',[['all','모두'],['physical','물리'],['special','특수']],'all')}</label><label>상성 ${sel('g_eff',[['all','상관없음'],['super','효과 굉장'],['weak','효과 별로'],['normal','1배']],'all')}</label><label>범위 ${sel('g_rng',[['all','모두'],['single','단일기'],['multi','전체기']],'all')}</label>
     <label>타입 일치 ${sel('g_sb',[['','상관없음'],['stab','일치'],['nonstab','비일치']],'')}</label><label>태그 (쉼표) <input type="text" data-g="tg" placeholder="소리,접촉"></label><label>위력 ≥ <input type="number" class="n xs" data-g="pmin" value="0"></label><label>위력 ≤ <input type="number" class="n xs" data-g="pmax" value="0"></label>
     <label>역할 상대 <input type="text" data-g="ro" placeholder="에이스"></label><label>자세 ${sel('g_st',[['','상관없음'],['def','【수세】'],['off','【공세】']],'')}</label><label>급소 ${sel('g_cx',[['','보통'],['sure','확정 급소'],['none','급소에 맞지 않음']],'')}</label><label>급소 방호 <input type="number" class="n xs" data-g="cg" value="0"></label><label>급소 C+ <input type="number" class="n xs" data-g="cr" value="0"></label>
     <label>횟수 <input type="number" class="n xs" data-g="uses" value="-1" title="-1 = 해제 전까지"></label><label><input type="checkbox" data-g="turn"> 이번 턴만</label><label>지속 턴 <input type="number" class="n xs" data-g="tl" value="0"></label><label><input type="checkbox" data-g="remove"> 해제</label></div>`;
   case 'state':return `<div class="row">상태 ${stSel('g_state')} 대상 ${tgSel('g_tgt','enemy1')} <label>턴 <input type="number" class="n xs" data-g="count" value="-1" title="-1 = 기본"></label> <label><input type="checkbox" data-g="forced"> 강제</label></div>`;
   case 'statefx':return `<div class="row">상태 ${stSel('g_state')} 대상 ${tgSel('g_tgt','enemy1')} <label>확률 <input type="number" class="n xs" data-g="chance" value="30">%</label> <label><input type="checkbox" data-g="one"> 1체만</label></div>`;
   case 'cure':return `<div class="row">대상 ${tgSel('g_tgt')} <label>상태 (쉼표, 비우면 모든 이상) <input type="text" data-g="states" placeholder="독,맹독"></label> <label>확률 <input type="number" class="n xs" data-g="chance" value="100">%</label></div>`;
   case 'heal':return `<div class="row">대상 ${tgSel('g_tgt')} <label>양 <input type="text" class="n" data-g="value" value="1/4" placeholder="1/4 · 30 · 전부"></label> <label>타입 한정 ${tySel('g_ytype','', '없음')}</label></div>`;
   case 'dmg':return `<div class="row">대상 ${tgSel('g_tgt','enemy1')} <label>양 <input type="text" class="n" data-g="value" value="1/8"></label> 기준 ${sel('g_basis',[['max','최대 HP'],['cur','현재 HP'],['last','직전에 입힌 대미지'],['type','타입 비례']],'max')} <label>타입(비례) ${tySel('g_atype','Rock')}</label> <label>제외 타입 ${tySel('g_xtype','', '없음')}</label> <label><input type="checkbox" data-g="nofaint"> 빈사 없음</label></div>`;
   case 'weather':return `<div class="row">날씨 ${sel('g_w',[['','해제'],['맑음','맑음'],['비','비'],['모래바람','모래바람'],['눈','눈'],['싸라기눈','싸라기눈'],['짙은안개','짙은안개'],['밤','밤'],['별하늘','별하늘'],['폭우','폭우'],['큰가뭄','큰가뭄'],['극한','극한'],['깊은밤','깊은밤'],['난기류','난기류'],['random','무작위']],'비')} <label>턴 <input type="number" class="n xs" data-g="count" value="5"> (1000 = 계속)</label></div>`;
   case 'terrain':return `<div class="row">${sel('g_t',[['','해제'],['그래스필드','그래스필드'],['일렉트릭필드','일렉트릭필드'],['미스트필드','미스트필드'],['사이코필드','사이코필드'],['트릭룸','트릭룸'],['매직룸','매직룸'],['원더룸','원더룸'],['블랙룸','블랙룸']],'그래스필드')} <label>턴 <input type="number" class="n xs" data-g="count" value="5"></label></div>`;
   case 'etc':return `<div class="row">${sel('g_e',[['','해제'],['중력','중력'],['물놀이','물놀이'],['흙놀이','흙놀이']],'중력')} <label>턴 <input type="number" class="n xs" data-g="count" value="5"></label></div>`;
   case 'object':return `<div class="row">진영 ${sel('g_side',[['ally','아군'],['enemy','상대']],'ally')} 설치기 ${sel('g_o',['리플렉터','빛의장막','오로라베일','신비의부적','흰안개','주술','검은숲','얼음의장벽','신기루','순풍','무지개','습원','불바다','돌격','희망사항','압정뿌리기','독압정','스텔스록','끈적끈적네트','기뢰','지뢰원','가시원','장미원','불기둥','아이스번','얼음꼬챙이','전기발판','트램펄린','저주의묘','악의소굴','전파탑'].map(x=>[x,x]),'리플렉터')} <label>턴 <input type="number" class="n xs" data-g="count" value="5"></label></div>`;
   case 'type':return `<div class="row">대상 ${tgSel('g_tgt')} ${sel('g_mode',[['add','타입 추가'],['set','타입 변경'],['reset','원래대로']],'add')} <label>타입 (쉼표) <input type="text" data-g="types" placeholder="불꽃,비행"></label></div>`;
   case 'trait':return `<div class="row">대상 ${tgSel('g_tgt','enemy1')} ${sel('g_mode',[['set','특성 변경'],['reset','원래대로']],'set')} <label>특성 <input type="text" data-g="tn" placeholder="미라"></label></div>`;
   case 'prio':return `<div class="row">대상 ${tgSel('g_tgt')} <label>우선도 <input type="number" step="0.5" class="n xs" data-g="v" value="1"></label> ${sel('g_mode',[['add','더하기'],['set','고정'],['off','해제']],'add')} 분류 ${sel('g_cat',[['all','모두'],['물리','물리'],['특수','특수'],['변화','변화']],'all')} 타입 ${tySel('g_type','', '제한 없음')} <label>태그 <input type="text" data-g="tag" placeholder="회복,드레인"></label> ${sel('g_dur',[['keep','해제 전까지'],['turn','이번 턴']],'keep')}</div>`;
   case 'immune':return `<div class="row">대상 ${tgSel('g_tgt')} <label>상태 (쉼표) <input type="text" data-g="states" placeholder="잠듦,마비 · 이상"></label> <label><input type="checkbox" data-g="off"> 해제</label></div>`;
   case 'nodrop':return `<div class="row">대상 ${tgSel('g_tgt')} 능력 ${sel('g_st',[['','모든 능력'],...STATS.slice(0,7).map(k=>[k,ko[k]])],'')} <label>턴 <input type="number" class="n xs" data-g="turns" value="-1"></label> <label><input type="checkbox" data-g="off"> 해제</label></div>`;
   case 'ignoreup':return `<div class="row">${sel('g_dir',[['atk','공격할 때 상대의'],['recv','받을 때 상대의']],'atk')} ${sel('g_scope',[['both','방어·회피'],['def','방어'],['eva','회피'],['atk','공격']],'both')} 상승 무시 <label>역할 상대 <input type="text" data-g="ro" placeholder="에이스"></label> <label><input type="checkbox" data-g="off"> 해제</label></div>`;
   case 'noind':return `<div class="row">대상 ${tgSel('g_tgt')} ${sel('g_kind',[['','비례 대미지를 받지 않는다'],['noko','비례 대미지로는 빈사가 되지 않는다'],['hazard','설치기를 무시한다'],['hazdmg','설치기의 비례 대미지를 받지 않는다'],['recoil','반동 비례 대미지를 받지 않는다']],'')} <label>턴 <input type="number" class="n xs" data-g="turns" value="-1"></label> <label><input type="checkbox" data-g="off"> 해제</label></div>`;
   case 'float':return `<div class="row">대상 ${tgSel('g_tgt')} <label>턴 <input type="number" class="n xs" data-g="turns" value="-1"></label> <label><input type="checkbox" data-g="off"> 해제</label></div>`;
   case 'role':return `<div class="row">${sel('g_mode',[['add','추가'],['remove','제거'],['clear','초기화']],'add')} <label>역할 (쉼표) <input type="text" data-g="roles" placeholder="에이스,블로커"></label></div>`;
   case 'pursuit':return `<div class="row"><label><input type="checkbox" data-g="hide"> 숨김</label> <label><input type="checkbox" data-g="off"> 해제</label></div>`;
   case 'confirm':return `<div class="row"><label>조건 문장 <input type="text" data-g="q" placeholder="자신이 「특성 : ○○오라」일 때" style="width:360px"></label></div>`;
   case 'cond':return `<div class="row">${sel('g_c',[['ally_fainted','「빈사」 상태인 아군이 있을 때'],['hp_le','HP 가 비율 이하일 때']],'ally_fainted')} <label>비율 <input type="text" class="n xs" data-g="frac" value="1/2"></label></div>`;
  }return ''}
 function genLine(kind,md){const K=FX();const g=k=>{const el=md.querySelector(`[data-g="${k}"]`);return el?(el.type==='checkbox'?el.checked:el.value):''};const s=id=>{const el=$('#'+id,md);return el?el.value:''};const tg=t=>t&&t!=='self'?' '+K.TGT_KO[t].replace(/\s/g,''):'';const tga=t=>' '+K.TGT_KO[t||'enemy1'].replace(/\s/g,'');
  const tyK=txt=>String(txt||'').split(/[,，\s]+/).filter(Boolean).join(',');
  switch(kind){
   case 'rank':case 'mult':{const parts=[];for(const k of STATS){const v=+g('st_'+k);if(kind==='rank'?v!==0:v!==1&&v>0)parts.push(K.STAT_KO[k]+(kind==='rank'?(v>0?'+':'')+v:'×'+v))}if(!parts.length)return '';return (kind==='rank'?'랭크':'배율')+tg(s('g_tgt'))+' '+parts.join(' ')+(g('temp')?' 임시':'')+(g('forced')?' 강제':'')}
   case 'boost':case 'guard':{let l=(kind==='boost'?'위력':'완화')+' ×'+(+g('v')||1)+tg(s('g_tgt'));if(tyK(g('types')))l+=' 타입:'+tyK(g('types'));const cat=s('g_cat');if(cat==='physical')l+=' 물리';if(cat==='special')l+=' 특수';const e=s('g_eff');if(e==='super')l+=' 굉장';if(e==='weak')l+=' 별로';if(e==='normal')l+=' 보통';const r=s('g_rng');if(r==='single')l+=' 단일';if(r==='multi')l+=' 전체기';const sb=s('g_sb');if(sb==='stab')l+=' 자속';if(sb==='nonstab')l+=' 비자속';if(tyK(g('tg')))l+=' 태그:'+tyK(g('tg'));if(+g('pmin'))l+=' 위력≥'+g('pmin');if(+g('pmax'))l+=' 위력≤'+g('pmax');if(tyK(g('ro')))l+=' 역할:'+tyK(g('ro'));const st=s('g_st');if(st==='def')l+=' 수세';if(st==='off')l+=' 공세';const cx=s('g_cx');if(cx==='sure')l+=' 확정급소';if(cx==='none')l+=' 급소없음';if(+g('cg'))l+=' 급소방호'+g('cg');if(+g('cr'))l+=' 급소+'+g('cr');if(+g('uses')>0)l+=' '+g('uses')+'회';if(g('turn'))l+=' 이번턴';if(+g('tl')>0)l+=' '+g('tl')+'턴';if(g('remove'))l+=' 해제';return l}
   case 'state':return '상태 '+K.stKo(s('g_state'))+tga(s('g_tgt'))+(+g('count')>0?' '+g('count')+'턴':'')+(g('forced')?' 강제':'');
   case 'statefx':return '상태확률 '+K.stKo(s('g_state'))+' '+(+g('chance')||100)+'%'+tga(s('g_tgt'))+(g('one')?' 1체':'');
   case 'cure':return '치유'+tg(s('g_tgt'))+' '+(tyK(g('states'))||'이상')+(+g('chance')&&+g('chance')<100?' '+g('chance')+'%':'');
   case 'heal':return '회복 '+(g('value')||'1/4')+tg(s('g_tgt'))+(s('g_ytype')?' 타입:'+K.TYPE_KO[s('g_ytype')]:'');
   case 'dmg':{const b=s('g_basis');return '피해 '+(g('value')||'1/8')+tga(s('g_tgt'))+(b==='cur'?' 현재':b==='last'?' 직전':b==='type'?' 타입:'+K.TYPE_KO[s('g_atype')]:'')+(s('g_xtype')?' 제외:'+K.TYPE_KO[s('g_xtype')]:'')+(g('nofaint')?' 빈사없음':'')}
   case 'weather':{const w=s('g_w');return w?'날씨 '+(w==='random'?'무작위':w)+' '+(+g('count')>=1000?'계속':(+g('count')||5)):'날씨 해제'}
   case 'terrain':{const t=s('g_t');return (/룸$/.test(t)?'룸 ':'필드 ')+(t?t+' '+(+g('count')>=1000?'계속':(+g('count')||5)):'해제')}
   case 'etc':{const e=s('g_e');return '필드상태 '+(e?e+' '+(+g('count')>=1000?'계속':(+g('count')||5)):'해제')}
   case 'object':return '설치기 '+(s('g_side')==='enemy'?'상대 ':'아군 ')+s('g_o')+' '+(+g('count')>=1000?'계속':(+g('count')||5));
   case 'type':{const m=s('g_mode');return '타입'+tg(s('g_tgt'))+' '+({add:'추가',set:'변경',reset:'원래'})[m]+(m==='reset'?'':' '+tyK(g('types')))}
   case 'trait':return '특성'+tga(s('g_tgt'))+' '+(s('g_mode')==='reset'?'원래':'변경 '+g('tn'));
   case 'prio':{const m=s('g_mode');return '우선도 '+(m==='set'?'=':(+g('v')>0?'+':''))+(+g('v')||0)+tg(s('g_tgt'))+(s('g_type')?' 타입:'+K.TYPE_KO[s('g_type')]:'')+(s('g_cat')!=='all'?' '+s('g_cat'):'')+(g('tag')?' 태그:'+tyK(g('tag')):'')+(s('g_dur')==='turn'?' 이번턴':'')+(m==='off'?' 해제':'')}
   case 'immune':return '면역'+tg(s('g_tgt'))+' '+(tyK(g('states'))||'이상')+(g('off')?' 해제':'');
   case 'nodrop':return '감소무시'+tg(s('g_tgt'))+(s('g_st')?' '+K.STAT_KO[s('g_st')]:'')+(+g('turns')>0?' '+g('turns')+'턴':'')+(g('off')?' 해제':'');
   case 'ignoreup':return '강화무시 '+(s('g_dir')==='recv'?'받음':'공격시')+' '+({both:'양쪽',def:'방어',eva:'회피',atk:'공격'})[s('g_scope')]+(tyK(g('ro'))?' 역할:'+tyK(g('ro')):'')+(g('off')?' 해제':'');
   case 'noind':return '비례무시'+tg(s('g_tgt'))+({'':'',noko:' 빈사',hazard:' 설치기',hazdmg:' 설치기피해',recoil:' 반동'})[s('g_kind')]+(+g('turns')>0?' '+g('turns')+'턴':'')+(g('off')?' 해제':'');
   case 'float':return '하늘위'+tg(s('g_tgt'))+(+g('turns')>0?' '+g('turns')+'턴':'')+(g('off')?' 해제':'');
   case 'role':return '역할 '+({add:'추가',remove:'제거',clear:'초기화'})[s('g_mode')]+' '+tyK(g('roles'));
   case 'pursuit':return '추격'+(g('off')?' 해제':'')+(g('hide')?' 숨김':'');
   case 'confirm':return '확인 "'+g('q')+'"';
   case 'cond':return s('g_c')==='hp_le'?'조건 HP≤'+(g('frac')||'1/2'):'조건 아군빈사'}return ''}

 /* ===== 편집기 ===== */
 function openEditor(o){const K=FX();const m=o.mon||{};const own=(m.auto||{})[o.name];const base=K.autoOf(Object.assign({},m,{auto:{}}),o.kind,o.name);const text=o.text||(base&&base.text)||'';const tm=K.timing(text);
  const md=A().openModal(`<div class="mhead"><h2>자동화 구문 · ${esc(o.name)}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   ${text?`<div class="card" style="margin-top:0"><div class="sec">효과</div><div class="small" style="white-space:pre-wrap">${esc(text)}</div><div class="small dim" style="margin-top:4px">표식: ${[tm.entry?'【등장】 자동':'',tm.passive?'【상시】 자동':'',tm.uses?'【'+tm.uses+'/시】':'',tm.percent?tm.percent+' 판정':''].filter(Boolean).join(' · ')||'없음 (카드의 「사용」·「발동」으로)'}</div></div>`:''}
   <div class="card"><div class="sec">레디메이드 자동 <span class="note">${base?(base.manual?'있지만 자동화 미지원 (손으로)':'이 이름의 레디메이드가 있어 구문을 비워 두면 이것이 돈다'):'같은 이름의 레디메이드 없음'}</span></div>
    ${base&&base.ops&&base.ops.length?`<pre class="pm">${esc(K.unparse(base.ops).join('\n'))}</pre><button class="btn xs" id="fxcopy">복사해서 고치기</button>`:'<div class="small dim">없음</div>'}</div>
   <div class="card"><div class="sec">이 포켓몬의 구문 <span class="note">저장하면 레디메이드보다 먼저 쓴다 · 비우고 저장하면 지운다</span></div>
    <textarea id="fxdsl" rows="6" style="width:100%;font-family:var(--mono);font-size:13px">${esc(own?own.dsl||K.unparse(own.ops).join('\n'):'')}</textarea>
    <div id="fxprev" class="small" style="margin-top:6px;white-space:pre-wrap"></div>
    <details class="adv" style="margin-top:6px"><summary>⚙ 생성기 — 항목을 골라 채우고 「줄 추가」</summary><div class="row" style="margin:6px 0">${sel('fxkind',KINDS,'rank')}</div><div id="fxform">${genForm('rank')}</div><div class="row" style="margin-top:6px"><span class="sp"></span><button class="btn sm" id="fxadd">줄 추가</button></div></details>
    <details class="adv"><summary>구문 도움말</summary><pre class="pm" style="white-space:pre-wrap">${esc(HELP)}</pre></details>
    <div class="row" style="margin-top:10px"><button class="btn ghost" id="fxclear">지우기</button><span class="sp"></span><button class="btn pri" id="fxsave">저장</button></div></div>`);
  const prev=()=>{const r=K.parse($('#fxdsl',md).value);const el=$('#fxprev',md);el.innerHTML=(r.ops.length?`<b>미리보기</b>\n${esc(K.unparse(r.ops).join('\n'))}`:'<span class="dim">(비어 있음 — 레디메이드 자동이 있으면 그것이 돈다)</span>')+(r.errs.length?`\n<span style="color:var(--red)">모르는 줄: ${esc(r.errs.join(' / '))}</span>`:'')};
  prev();$('#fxdsl',md).addEventListener('input',prev);
  const cp=$('#fxcopy',md);if(cp)cp.onclick=()=>{$('#fxdsl',md).value=K.unparse(base.ops).join('\n');prev()};
  $('#fxkind',md).onchange=()=>{$('#fxform',md).innerHTML=genForm($('#fxkind',md).value)};
  $('#fxadd',md).onclick=()=>{const l=genLine($('#fxkind',md).value,md);if(!l)return A().toast('값을 넣어 줘');const ta=$('#fxdsl',md);ta.value=(ta.value.trim()?ta.value.replace(/\s+$/,'')+'\n':'')+l;prev()};
  $('#fxclear',md).onclick=async()=>{A().closeModal();await o.save(null)};
  $('#fxsave',md).onclick=async()=>{const dsl=$('#fxdsl',md).value.trim();if(!dsl){A().closeModal();return o.save(null)}const r=K.parse(dsl);if(r.errs.length&&!confirm('모르는 줄이 있다:\n'+r.errs.join('\n')+'\n\n그래도 저장할까? (모르는 줄은 무시된다)'))return;A().closeModal();await o.save({dsl,ops:r.ops})}}

 /* ===== 레디메이드 DB 창 ===== */
 function openRm(q){const K=FX();const all=K.rmAll();const names=Object.keys(all).sort((a,b)=>a.localeCompare(b,'ko'));const gm=A().ST.role==='gm';
  const md=A().openModal(`<div class="mhead"><h2>레디메이드 DB <span class="small dim">${names.length}</span></h2><span class="sp"></span>${gm?'<button class="btn sm" id="rmnew">새로</button>':''}<button class="btn ghost" data-x>닫기</button></div>
   <div class="row"><input type="text" id="rmq" placeholder="이름 · 효과 검색" value="${esc(q||'')}" style="flex:1"><label class="small"><input type="checkbox" id="rmauto" checked> 자동화 있는 것만</label></div><div id="rmlist" class="dblist" style="max-height:60vh;overflow:auto;margin-top:6px"></div>`);
  const draw=()=>{const qq=$('#rmq',md).value.trim().toLowerCase();const onlyAuto=$('#rmauto',md).checked;const ov=((A().ST.state.dbx||{}).rm)||{};
   const rows=names.filter(n=>{const r=all[n];if(onlyAuto&&(!r.ops||!r.ops.length||r.manual))return false;return !qq||n.toLowerCase().includes(qq)||String(r.text||'').toLowerCase().includes(qq)}).slice(0,200);
   $('#rmlist',md).innerHTML=rows.map(n=>{const r=all[n];return `<div class="rmrow"><div class="row"><b>${esc(n)}</b>${ov[n]?'<span class="tag">방 수정</span>':''}${r.manual?'<span class="tag" style="background:#555">손으로</span>':''}<span class="sp"></span>${gm?`<button class="btn xs" data-rmedit="${esc(n)}">수정</button>`:''}</div><div class="small dim" style="white-space:pre-wrap">${esc(r.text||'')}</div>${r.ops&&r.ops.length?`<pre class="pm small">${esc(K.unparse(r.ops).join('\n'))}</pre>`:''}</div>`}).join('')||'<div class="dim small">없음</div>';
   md.querySelectorAll('[data-rmedit]').forEach(b=>b.onclick=()=>editRm(b.dataset.rmedit))};
  draw();$('#rmq',md).addEventListener('input',draw);$('#rmauto',md).onchange=draw;const nb=$('#rmnew',md);if(nb)nb.onclick=()=>editRm('');}
 function editRm(name){const K=FX();const all=K.rmAll();const r=all[name]||{text:'',ops:[]};A().closeModal();
  const md=A().openModal(`<div class="mhead"><h2>레디메이드 ${name?'수정':'새로'}</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <div class="row"><label>이름 <input type="text" id="rmn" value="${esc(name)}" ${name?'readonly':''} style="width:260px"></label></div>
   <div class="sec">효과 글</div><textarea id="rmt" rows="3" style="width:100%">${esc(r.text||'')}</textarea>
   <div class="sec">구문</div><textarea id="rmd" rows="6" style="width:100%;font-family:var(--mono);font-size:13px">${esc(K.unparse(r.ops||[]).join('\n'))}</textarea><div id="rmp" class="small" style="white-space:pre-wrap;margin-top:4px"></div>
   <div class="row" style="margin-top:10px">${name&&((A().ST.state.dbx||{}).rm||{})[name]?'<button class="btn ghost" id="rmreset">기본으로</button>':''}<span class="sp"></span><button class="btn pri" id="rmsave">저장 (방)</button></div>`);
  const prev=()=>{const p=K.parse($('#rmd',md).value);$('#rmp',md).innerHTML=esc(K.unparse(p.ops).join('\n'))+(p.errs.length?`\n<span style="color:var(--red)">모르는 줄: ${esc(p.errs.join(' / '))}</span>`:'')};prev();$('#rmd',md).addEventListener('input',prev);
  $('#rmsave',md).onclick=async()=>{const n=$('#rmn',md).value.trim();if(!n)return A().toast('이름이 필요하다');const p=K.parse($('#rmd',md).value);const ov=Object.assign({},(A().ST.state.dbx||{}).rm||{});ov[n]={text:$('#rmt',md).value,ops:p.ops};A().closeModal();await A().set(['dbx','rm'],ov);A().toast('저장했다');openRm(n)};
  const rs=$('#rmreset',md);if(rs)rs.onclick=async()=>{const ov=Object.assign({},(A().ST.state.dbx||{}).rm||{});delete ov[name];A().closeModal();await A().set(['dbx','rm'],ov);openRm(name)}}
 return {openEditor,openRm,HELP};
})();
