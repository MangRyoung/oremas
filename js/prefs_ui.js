/* ---------- 내 환경 설정 (이 브라우저에서만): 소리 · 알림 · 글자 · 이미지 · 단축키 ----------
   휴대폰 「설정」 앱과 방 설정 창의 「내 설정」 탭이 같은 판(panel)을 쓴다.
   저장: om_prefs (이 파일) · om_ui (글자·폰트·채팅 초상 — app.js UI) · om_vol / om_vol_se (음량 — rp_ui) · om_alarm (알림 켜고 끄기 — app.js)
   채팅 알림음은 파일 대신 WebAudio 로 그린 부드러운 소리. 화면을 보고 있으면 울리지 않는다 (quiet). */
"use strict";
window.OM_PREFS=(()=>{
 const A=()=>window.OM_APP, RP=()=>window.OM_RP_UI;
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const KEY='om_prefs';
 const ACTS=[['chat','채팅 입력칸으로','/'],['phone','휴대폰 열기','p'],['settings','내 설정 열기',','],['bgm','BGM 정지 · 다시','m'],['vRp','RP 화면','1'],['vBattle','배틀 화면','2'],['vSheet','시트 화면','3'],['vGraph','관계도 화면','4'],['vCal','캘린더 화면','5'],
  /* 배틀 화면에서만 (g:'b') · 공격·상태 창이 열려 있을 때만 (g:'m') — battle_ui hotkey */
  ['bProgress','턴 진행 ▶','n','b'],['bNext','다음 행동 ▶',']','b'],['bPrev','이전 행동 ◀','[','b'],['bAttack','지금 차례 공격','a','b'],['bHp','지금 차례 HP','h','b'],['bEdit','지금 차례 랭크·상태','s','b'],
  ['bCmd','지시 입력으로','c','b'],['bReady','준비 완료 · 취소','y','b'],['bFire','포텐셜 발동','q','b'],['bReveal','모두 공개 (GM)','o','b'],['bField','필드','f','b'],['bTurnEnd','턴 종료 처리','e','b'],
  ['mRoll','공격 창 굴리기','r','m'],['mApply','공격·상태 창 적용','Enter','m']];
 const KGRP=[['','일반'],['b','배틀','배틀 화면에서 · 「지금 차례」= 행동 순서의 지금 칸'],['m','배틀 창','공격·상태 창이 열려 있을 때']];
 const DEF={keysOn:1,bgmMute:0,seMute:0,alertVol:0.35,alertSound:'soft',quiet:1,stand:100,cutin:100,keys:Object.fromEntries(ACTS.map(a=>[a[0],a[2]]))};
 let P=load();
 function load(){let o={};try{o=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){}const p=Object.assign({},DEF,o);p.keys=Object.assign({},DEF.keys,o.keys||{});return p}
 function save(){try{localStorage.setItem(KEY,JSON.stringify(P))}catch(e){}apply()}
 function get(){return P}
 function apply(){const r=document.documentElement.style;r.setProperty('--standsc',(+P.stand||100)/100)}
 const lsNum=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:+v}catch(e){return d}};

 /* ----- 알림음: 파일 없이 짧고 부드럽게 ----- */
 let AC=null;function ac(){try{if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();return AC}catch(e){return null}}
 function tone(c,f0,f1,t0,dur,gain,type){const o=c.createOscillator(),g=c.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f0,t0);if(f1&&f1!==f0)o.frequency.exponentialRampToValueAtTime(f1,t0+dur*.6);
  g.gain.setValueAtTime(0.0001,t0);g.gain.exponentialRampToValueAtTime(gain,t0+0.015);g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);o.connect(g).connect(c.destination);o.start(t0);o.stop(t0+dur+0.05)}
 const SOUNDS=[['soft','부드러운 종'],['drop','물방울'],['tick','톡'],['ping','예전 핑'],['off','소리 없음']];
 function alert(kind,force){const v=+P.alertVol;const s=P.alertSound;if(!force&&(s==='off'||!(v>0)))return;if(s==='ping'){try{const u=RP()&&RP().seUrlOf?RP().seUrlOf('Ping'):'';if(u){const a=new Audio(u);a.volume=Math.min(1,v);a.play().catch(()=>{})}}catch(e){}return}
  const c=ac();if(!c)return;const t=c.currentTime+0.01,G=Math.max(0.0002,v*0.22);
  if(s==='drop'){tone(c,1250,620,t,0.16,G,'sine');tone(c,1650,900,t+0.09,0.14,G*0.55,'sine')}
  else if(s==='tick'){tone(c,880,880,t,0.07,G*0.9,'triangle')}
  else{tone(c,1318.5,0,t,0.42,G,'sine');tone(c,987.8,0,t+0.13,0.55,G*0.8,'sine')}}   /* soft: E6 → B5 두 음 */
 /* 화면을 보고 있는 중인가 (탭이 보이고 창에 초점) */
 const watching=()=>document.visibilityState==='visible'&&document.hasFocus();
 function notify(kind){if(P.quiet&&watching())return false;alert(kind);return true}

 /* ----- 단축키 ----- */
 /* 겹침: 같이 쓰일 수 있는 묶음(일반·배틀은 같이, 배틀 창은 따로)에서 같은 키 */
 const kctx=a=>a[3]==='m'?'m':'n';
 const dup=id=>{const v=P.keys[id];if(!v)return false;const me=ACTS.find(a=>a[0]===id);return ACTS.some(a=>a[0]!==id&&P.keys[a[0]]===v&&kctx(a)===kctx(me))};
 const keyName=k=>!k?'없음':k===' '?'Space':k.length===1?k.toUpperCase():k;
 const typing=e=>{const t=e.target;if(!t)return false;const tag=(t.tagName||'').toLowerCase();return tag==='input'||tag==='textarea'||tag==='select'||t.isContentEditable};
 let capturing=null;
 function run(act){const app=A();if(!app)return;
  if(act==='chat'){const i=document.getElementById('chatIn')||document.getElementById('rpline');if(i){i.focus();return}}
  if(act==='phone'){if(window.OM_PHONE_UI)window.OM_PHONE_UI.open('home');return}
  if(act==='settings'){if(app.openRoomSettings)app.openRoomSettings('me');return}
  if(act==='bgm'){setBgmMute(!P.bgmMute);app.toast(P.bgmMute?'BGM 정지':'BGM 다시');return}
  const V={vRp:'rp',vBattle:'battle',vSheet:'sheet',vGraph:'graph',vCal:'calendar'}[act];if(V){app.view=V;app.renderScene()}}
 document.addEventListener('keydown',e=>{if(capturing){e.preventDefault();e.stopPropagation();const done=capturing;capturing=null;if(e.key!=='Escape'){P.keys[done.act]=e.key==='Backspace'||e.key==='Delete'?'':(e.key.length===1?e.key.toLowerCase():e.key);save()}done.redraw();return}
  if(!P.keysOn||e.ctrlKey||e.metaKey||e.altKey||e.isComposing||typing(e))return;
  const k=e.key.length===1?e.key.toLowerCase():e.key;const modal=!!document.querySelector('.modalbg');const app=A();const inBattle=!!app&&app.view==='battle';
  /* 같은 키가 여러 묶음에 있어도 지금 쓸 수 있는 것만: 창이 열려 있으면 「배틀 창」과 내 설정, 아니면 일반 + (배틀 화면이면) 배틀 */
  const ok=a=>a[3]==='m'?modal&&inBattle:modal?a[0]==='settings':a[3]==='b'?inBattle:true;
  const hit=ACTS.find(a=>P.keys[a[0]]&&P.keys[a[0]]===k&&ok(a));if(!hit)return;
  if(hit[3]){const BU=window.OM_BATTLE_UI;if(!BU||!BU.hotkey||!BU.hotkey(hit[0]))return}else run(hit[0]);e.preventDefault()},true);

 /* ----- 소리 연결 ----- */
 function setBgmMute(on){P.bgmMute=on?1:0;save();if(RP()&&RP().bgmMuted)RP().bgmMuted(!!on)}
 function setSeMute(on){P.seMute=on?1:0;save()}

 /* ----- 판 ----- */
 const sw=(id,on,label,sub)=>`<label class="pf-sw"><input type="checkbox" data-pf="${id}" ${on?'checked':''}><i></i><span><b>${label}</b>${sub?`<small>${sub}</small>`:''}</span></label>`;
 const sl=(id,label,min,max,step,val,unit,extra)=>`<div class="pf-sl"><span class="pf-lb">${label}</span><input type="range" data-pf="${id}" min="${min}" max="${max}" step="${step}" value="${val}"><b class="pf-v" data-pfv="${id}">${fmt(val,unit)}</b>${extra||''}</div>`;
 const fmt=(v,u)=>u==='%1'?Math.round(v*100)+'%':u==='%'?Math.round(v)+'%':u==='px'?Math.round(v)+'px':String(v);
 const UNIT={bgm:'%1',se:'%1',alertVol:'%1',scale:'%',chat:'px',dlg:'px',av:'px',stand:'%',cutin:'%'};
 function html(opt){opt=opt||{};const ui=(A()&&A().UI)||{};const al=(A()&&A().alarm)?A().alarm():{chat:1,sms:1,typing:1};const F=(A()&&A().UI_FONTS)||[],H=(A()&&A().UI_HEADS)||[];
  const vb=lsNum('om_vol',0.5),vs=lsNum('om_vol_se',0.7);
  return `<div class="pf ${opt.compact?'cmp':''}">
  <section class="pf-card"><header><i>♪</i><b>소리</b><small>이 기기에서만</small></header>
   ${sl('bgm','BGM',0,1,0.05,vb,'%1',`<button class="pf-mute ${P.bgmMute?'on':''}" data-pfb="bgmMute" title="BGM 정지 · 다시">${P.bgmMute?'정지됨':'정지'}</button>`)}
   ${sl('se','효과음',0,1,0.05,vs,'%1',`<button class="pf-mute ${P.seMute?'on':''}" data-pfb="seMute" title="효과음 끄기 · 켜기">${P.seMute?'꺼짐':'끄기'}</button>`)}
   ${sl('alertVol','알림음',0,1,0.05,P.alertVol,'%1',`<button class="pf-mute" data-pfb="alertTest" title="들어 보기">▶</button>`)}
   <div class="pf-chips">${SOUNDS.map(([k,n])=>`<button class="pf-chip ${P.alertSound===k?'on':''}" data-pfs="${k}">${n}</button>`).join('')}</div></section>
  <section class="pf-card"><header><i>🔔</i><b>알림</b></header>
   ${sw('al_chat',al.chat,'채팅이 올라오면 소리')}
   ${sw('quiet',P.quiet,'화면을 보고 있을 땐 울리지 않기','다른 탭·창에 있을 때만 알림음')}
   ${sw('al_sms',al.sms,'문자가 오면 소리 · 알림')}
   ${sw('al_typing',al.typing,'입력 중 표시')}</section>
  <section class="pf-card"><header><i>가</i><b>글자</b></header>
   ${opt.compact?'':sl('scale','화면 크기 (PC)',80,140,5,ui.scale||100,'%')}
   ${sl('chat','채팅 글씨',11,20,1,ui.chat||13,'px')}
   ${sl('dlg','대사 글씨',16,34,1,ui.dlg||22,'px')}
   <div class="pf-sel"><span class="pf-lb">본문 폰트</span><select data-pf="font">${F.map(([k,n])=>`<option value="${k}" ${ui.font===k?'selected':''}>${esc(n)}</option>`).join('')}</select></div>
   <div class="pf-sel"><span class="pf-lb">제목 폰트</span><select data-pf="head">${H.map(([k,n])=>`<option value="${k}" ${ui.head===k?'selected':''}>${esc(n)}</option>`).join('')}</select></div></section>
  <section class="pf-card"><header><i>▣</i><b>이미지</b></header>
   ${sl('av','채팅 초상',24,72,2,ui.av||40,'px')}
   ${sl('stand','무대 스탠딩',50,150,5,P.stand,'%')}
   ${sl('cutin','컷인',50,150,5,P.cutin,'%',`<button class="pf-mute" data-pfb="cutTest" title="미리 보기">▶</button>`)}</section>
  <section class="pf-card"><header><i>⌨</i><b>단축키</b><small>키보드가 있을 때 · 입력칸 밖에서</small></header>
   ${sw('keysOn',P.keysOn,'단축키 쓰기','끄면 아래 키가 모두 멈춘다 (설정은 남는다)')}
   <div class="pf-keywrap ${P.keysOn?'':'off'}">   ${KGRP.map(([g,gn,gs])=>`${g?`<div class="pf-kgrp"><b>${gn}</b>${gs?`<small>${gs}</small>`:''}</div>`:''}<div class="pf-keys">${ACTS.filter(a=>(a[3]||'')===g).map(([k,n])=>`<div class="pf-key ${dup(k)?'dup':''}"><span>${n}</span><button class="pf-cap ${capturing&&capturing.act===k?'rec':''}" data-pfk="${k}" ${dup(k)?'title="같은 묶음에 같은 키가 있다 — 위의 것만 동작"':''}>${capturing&&capturing.act===k?'키를 눌러 줘…':esc(keyName(P.keys[k]))}</button></div>`).join('')}</div>`).join('')}
   <div class="pf-note">칸을 누르고 키를 누르면 바뀐다 · Backspace 지우기 · Esc 취소 · 노란 칸은 겹친 키</div>
   <div class="pf-foot"><button class="btn xs ghost" data-pfb="keyreset">단축키만 기본으로</button></div></div></section>
  <div class="pf-foot"><button class="btn xs ghost" data-pfb="reset">모두 기본으로</button></div></div>`}
 function bind(root,redraw){const R=()=>{if(redraw)redraw();else{root.innerHTML=html({compact:root.classList.contains('cmp')||!!root.closest('.ph-screen')});bind(root)}};
  const app=A();const UI=app&&app.UI;
  const setUi=(k,v)=>{if(!UI)return;UI[k]=v;try{localStorage.setItem('om_ui',JSON.stringify(UI))}catch(e){}if(app.applyUi)app.applyUi()};
  root.querySelectorAll('input[type=range][data-pf]').forEach(el=>el.oninput=()=>{const k=el.dataset.pf,v=+el.value;const o=root.querySelector(`[data-pfv="${k}"]`);if(o)o.textContent=fmt(v,UNIT[k]);
   if(k==='bgm'){if(RP())RP().setVolume('bgm',v)}else if(k==='se'){if(RP())RP().setVolume('se',v)}else if(k==='alertVol'){P.alertVol=v;save()}else if(k==='stand'||k==='cutin'){P[k]=v;save()}else setUi(k,v)});
  root.querySelectorAll('input[type=range][data-pf="alertVol"]').forEach(el=>el.onchange=()=>alert('test',true));
  root.querySelectorAll('select[data-pf]').forEach(el=>el.onchange=()=>setUi(el.dataset.pf,el.value));
  root.querySelectorAll('input[type=checkbox][data-pf]').forEach(el=>el.onchange=()=>{const k=el.dataset.pf;if(k==='quiet'){P.quiet=el.checked?1:0;save();return}if(k==='keysOn'){P.keysOn=el.checked?1:0;save();return R()}if(k.startsWith('al_')&&app&&app.setAlarm)app.setAlarm(k.slice(3),el.checked)});
  root.querySelectorAll('[data-pfs]').forEach(el=>el.onclick=()=>{P.alertSound=el.dataset.pfs;save();alert('test',true);R()});
  root.querySelectorAll('[data-pfb]').forEach(el=>el.onclick=()=>{const k=el.dataset.pfb;
   if(k==='bgmMute'){setBgmMute(!P.bgmMute);return R()}if(k==='seMute'){setSeMute(!P.seMute);return R()}if(k==='alertTest')return alert('test',true);
   if(k==='cutTest'){if(window.OM_CUTIN&&window.OM_CUTIN.preview)window.OM_CUTIN.preview();return}
   if(k==='keyreset'){if(!confirm('단축키를 모두 기본으로 돌릴까?'))return;P.keys=JSON.parse(JSON.stringify(DEF.keys));save();return R()}
   if(k==='reset'){if(!confirm('내 설정을 모두 기본으로 돌릴까?'))return;const keep=P.bgmMute;P=JSON.parse(JSON.stringify(DEF));save();if(keep&&RP()&&RP().bgmMuted)RP().bgmMuted(false);if(UI&&app.UI_DEF){Object.assign(UI,app.UI_DEF);setUi('scale',UI.scale)}if(RP()){RP().setVolume('bgm',0.5);RP().setVolume('se',0.7)}return R()}});
  root.querySelectorAll('[data-pfk]').forEach(el=>el.onclick=()=>{capturing={act:el.dataset.pfk,redraw:R};R()})}
 apply();
 return {get,html,bind,alert,notify,watching,setBgmMute,apply,ACTS}})();
