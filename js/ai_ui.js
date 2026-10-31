/* ---------- AI 에게 맡기기 (10-31 망령 「다른 AI 한테도 쉽게 명령하고 싶어서 · 주소를 첨부하기 귀찮으니 버튼으로」) ----------
   위 띠 「🤖 AI」(GM) → 작은 창: 할 일 · 대전 · 형식 · 정해 둔 것(지침 1-1) · 메모를 고르고 「복사」 → 어느 AI 대화창에든 붙여 넣는다.
   · 「주소로」: 지침 주소(ai/README.md) + 이 방 정보 + 정해 둔 것. 링크를 열 수 있는 AI 용 (짧다)
   · 「지침까지 통째로」: 위에 더해 ai/README.md · battle-guide.md · battle-log.md 본문을 같이 붙인다. 링크를 못 여는 AI 용 (약 6만 자)
   지침 원본은 이 저장소의 ai/ (사람이 읽는 화면 ai/index.html). GM 비밀값은 넣지 않는다. 고른 값은 이 브라우저에 기억. */
"use strict";
window.OM_AI_UI=(()=>{
 const A=()=>window.OM_APP;const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const BASE=new URL('ai/',location.origin+location.pathname.replace(/[^/]*$/,'')).href;
 const LK='om_ai_pref';
 const TASKS=[['battle','배틀 통째로','이 방의 배틀을 GM 대리로 진행해 줘 (판정 · 두 트레이너 지시 · RP · 후일담).','AI 가 웹툴을 직접 조작해 양쪽 지시 · 판정 · 대사 · 후일담까지 전부 한다 (AI 끼리 붙는 배틀 · NPC 전)'],['rp','대사 · 연출만','배틀 판정과 지시는 내가 한다. 너는 트레이너 독백 · 반응 · 나레이션 · 후일담만 맡아 줘.','판정과 지시는 GM(망령)이 하고, AI 는 트레이너 대사 · 나레이션 · 후일담만 쓴다'],['review','끝난 배틀 정리','끝난 배틀의 로그로 지침 5절대로 정리 문서(평가 · 격파 기록 · 반성문)를 만들어 줘.','배틀이 끝난 뒤 로그를 읽고 결과표 · 평가 · 격파 기록 · 반성문을 정리 문서로 만든다']];
 const FMT=['','싱글','더블','트리플'];
 const pref=()=>{try{return Object.assign({task:'battle',fmt:'더블',vs:'',n:'',items:'',hp:'',narr:'1',memo:''},JSON.parse(localStorage.getItem(LK)||'{}'))}catch(e){return {task:'battle',fmt:'더블',vs:'',n:'',items:'',hp:'',narr:'1',memo:''}}};
 const save=p=>{try{localStorage.setItem(LK,JSON.stringify(p))}catch(e){}};
 /* 지금 방의 배틀 사정 (이름만 — 시트 값은 AI 가 웹툴에서 직접 읽는다) */
 function roomInfo(){const ST=A().ST;const r=ST.roomRow||{};const b=(ST.state&&ST.state.battle)||{};const T=((ST.state||{}).roster||{}).trainers||{};
  const names=Object.keys(b.trainers||{}).map(id=>(T[id]&&T[id].name)||id);
  return {name:r.name||ST.room||'',url:location.origin+location.pathname+'#r='+ST.room,names,turn:+b.turn||0,started:!!b.started}}
 function mkPrompt(p,full){const R=roomInfo();const t=TASKS.find(x=>x[0]===p.task)||TASKS[0];const L=[];
  L.push(full?'아래 「지침」을 먼저 끝까지 읽고, 거기 적힌 대로 해 줘. 지침 안의 「감우」는 진행을 맡은 너 자신이야.':`${BASE}README.md 를 읽고, 거기 적힌 순서대로 지침(배틀 진행 지침 → 진행 기록)을 읽은 다음 해 줘. 지침 안의 「감우」는 진행을 맡은 너 자신이야.`);
  L.push('','[할 일] '+t[2]);
  L.push(`[방] 오레마스 웹툴 「${R.name}」 — ${R.url}`+(R.names.length?`\n[지금 배틀에 들어온 트레이너] ${R.names.join(' · ')}${R.started?` (${R.turn}턴 진행 중)`:''}`:''));
  const fixed=[];if(p.vs.trim())fixed.push('대전: '+p.vs.trim());if(p.fmt||p.n.trim())fixed.push('형식: '+[p.fmt,p.n.trim()].filter(Boolean).join(' '));
  if(p.items)fixed.push('소지품: '+(p.items==='ai'?'AI 가 고른다 (지침 1-6)':'시트 그대로'));if(p.hp)fixed.push('HP: '+(p.hp==='full'?'가득 찬 HP 로 시작, 결과는 시트에 반영 안 함':'시트 HP 로 시작, 결과를 시트에 반영'));
  fixed.push('후일담 · 서술: '+(p.narr==='1'?'AI 가 알아서 올린다':'GM 이 한다 — 정리 문서에만'));
  L.push('[정해 둔 것 — 지침 1-1 에서 이건 묻지 않아도 돼]\n- '+fixed.join('\n- '));
  if(p.memo.trim())L.push('[GM 메모]\n'+p.memo.trim());
  L.push('','[기록] 진행 중 새로 알게 된 판정 · 툴 이상 · 정정은 끝날 때 「[기록 제안] 날짜 · 방 · 턴 · 내용 · 누가 정했나」 꼴로 모아서 알려 줘. 지침은 내가 확인한 것만 고친다.');
  return L.join('\n')}
 async function fetchDocs(){const out=[];for(const [f,t] of [['README.md','안내'],['battle-guide.md','배틀 진행 지침'],['battle-log.md','배틀 진행 기록']]){const r=await fetch(BASE+f,{cache:'no-cache'});if(!r.ok)throw new Error(f+' '+r.status);out.push(`\n\n===== 지침 · ${t} (${f}) =====\n\n`+(await r.text()).replace(/^<!--[\s\S]*?-->\s*/,''))}return out.join('')}
 async function copy(text,ok){try{await navigator.clipboard.writeText(text);A().toast(ok)}catch(e){const m=A().openModal(`<div class="mhead"><h2>복사해 주세요</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div><textarea style="width:100%;height:50vh" readonly>${esc(text)}</textarea>`);const ta=m.querySelector('textarea');ta.focus();ta.select()}}
 function open(){if(A().ST.role!=='gm')return A().toast('GM 만 써요');const p=pref();const R=roomInfo();
  const m=A().openModal(`<div class="mhead"><h2>🤖 AI 에게 맡기기</h2><span class="sp"></span><button class="btn ghost" data-x>닫기</button></div>
   <p class="small dim" style="margin:0 0 10px">고르고 「복사」를 누른 뒤, 아무 AI 대화창(Claude · ChatGPT · Gemini …)에 붙여 넣으면 돼요. 지침은 <a href="${esc(BASE)}" target="_blank" rel="noopener">AI 진행 지침 ↗</a>에 있어요.</p>
   <div class="aiu">
    <label class="w2">할 일<span class="aiu-seg">${TASKS.map(([k,l,,d])=>`<button type="button" class="btn sm ${p.task===k?'pri':'ghost'}" data-aitask="${k}" title="${esc(d)}">${l}</button>`).join('')}</span><small class="dim" id="aiTaskD">${esc((TASKS.find(x=>x[0]===p.task)||TASKS[0])[3])}</small></label>
    <label class="w2">대전 <small class="dim">(비우면 AI 가 묻는다)</small><input id="aiVs" value="${esc(p.vs)}" placeholder="${esc(R.names.length>1?R.names.join(' VS '):'서서 VS 카네코 마리')}"></label>
    <label>형식<select id="aiFmt">${FMT.map(f=>`<option ${p.fmt===f?'selected':''} value="${f}">${f||'(묻기)'}</option>`).join('')}</select></label>
    <label>몇 대 몇<input id="aiN" value="${esc(p.n)}" placeholder="6:6"></label>
    <label>소지품<select id="aiItems"><option value="" ${!p.items?'selected':''}>(묻기)</option><option value="sheet" ${p.items==='sheet'?'selected':''}>시트 그대로</option><option value="ai" ${p.items==='ai'?'selected':''}>AI 가 고른다</option></select></label>
    <label>HP · 결과<select id="aiHp"><option value="" ${!p.hp?'selected':''}>(묻기)</option><option value="sheet" ${p.hp==='sheet'?'selected':''}>시트 HP · 결과 반영</option><option value="full" ${p.hp==='full'?'selected':''}>가득 찬 HP · 반영 안 함</option></select></label>
    <label class="w2"><span><input type="checkbox" id="aiNarr" ${p.narr==='1'?'checked':''}> 후일담 · 서술은 AI 가 알아서 올린다</span></label>
    <label class="w2">GM 메모 <small class="dim">(공개 범위 · 끝나는 조건 · 특별 룰 …)</small><textarea id="aiMemo" rows="3" placeholder="서로 선발만 공개 · 전멸까지 · BGM 은 손대지 말 것">${esc(p.memo)}</textarea></label>
   </div>
   <details class="aiu-pv"><summary class="small">붙여 넣을 글 미리 보기</summary><pre id="aiPv"></pre></details>
   <div class="row" style="gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px"><a class="btn sm ghost" href="${esc(BASE)}" target="_blank" rel="noopener">지침 보기 ↗</a><button class="btn sm" id="aiFull" title="링크를 못 여는 AI 용 — 지침 본문(약 6만 자)까지 같이 복사">지침까지 통째로 복사</button><button class="btn sm pri" id="aiCopy" title="링크를 열 수 있는 AI 용 — 짧다">복사 (주소로)</button></div>`);
  const $=s=>m.querySelector(s);
  const read=()=>{const q=pref();q.vs=$('#aiVs').value;q.fmt=$('#aiFmt').value;q.n=$('#aiN').value;q.items=$('#aiItems').value;q.hp=$('#aiHp').value;q.narr=$('#aiNarr').checked?'1':'0';q.memo=$('#aiMemo').value;q.task=(m.querySelector('[data-aitask].pri')||{}).dataset?.aitask||q.task;return q};
  const pv=()=>{const q=read();save(q);$('#aiPv').textContent=mkPrompt(q,false)};pv();
  m.addEventListener('input',pv);m.addEventListener('change',pv);
  m.addEventListener('click',e=>{const t=e.target.closest('[data-aitask]');if(!t)return;m.querySelectorAll('[data-aitask]').forEach(b=>{const on=b===t;b.classList.toggle('pri',on);b.classList.toggle('ghost',!on)});$('#aiTaskD').textContent=(TASKS.find(x=>x[0]===t.dataset.aitask)||TASKS[0])[3];pv()});
  $('#aiCopy').onclick=()=>copy(mkPrompt(read(),false),'복사했어요 — AI 대화창에 붙여 넣어요');
  $('#aiFull').onclick=async()=>{const b=$('#aiFull');b.disabled=true;b.textContent='지침 읽는 중…';try{const d=await fetchDocs();await copy(mkPrompt(read(),true)+d,'지침까지 복사했어요 — AI 대화창에 붙여 넣어요')}catch(e){A().toast('지침을 읽지 못했어요: '+e.message)}finally{b.disabled=false;b.textContent='지침까지 통째로 복사'}}}
 /* 배틀 조작판의 「🤖 AI 에게 맡기기」(data-aihand) — 위 띠는 자리가 없어 배틀 화면에 둔다 (10-31 망령) */
 document.addEventListener('click',e=>{const b=e.target&&e.target.closest&&e.target.closest('[data-aihand]');if(!b)return;e.preventDefault();e.stopPropagation();open()},true);
 return {open,mkPrompt,roomInfo};
})();
