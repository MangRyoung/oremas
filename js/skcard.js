/* 은열쇠 카드 한 장 그리기 (2026-11-02 감우) — 오레마스 웹툴 · 망켓몬 제작기가 같은 모양을 쓴다.
   SKCARD.html(c, o) : c = {n 이름, t 종류(쓰는 곳), c 비용, x 효과, img 그림, col 테두리 색(#hex), ic [아이콘…], src 출처, lim 덱 제한 글, auto 자동화 있음,
                            cls 분류(열쇠 · 준비 · 증상 — 11-03, 제작기 카드 DB 12번 칸 · 덱 제한 장수는 13번 칸 deckMax)}
                       o = {cls 덧붙일 class, attr 덧붙일 속성 글, badge 오른쪽 위 딱지(×2 등), sel 골랐음}
   SKCARD.back(n)    : 카드 뒷면 (n = 장수 글, 없어도 된다)
   크기는 바깥에서 width 만 정하면 된다 — 글자 크기가 카드 너비를 따라간다 (container query). */
"use strict";
window.SKCARD=window.SKCARD||(()=>{
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const cssu=s=>String(s||'').replace(/["'()\\\s]/g,m=>encodeURIComponent(m));
 const ICN={'지시':['지','#c8463f'],'육성':['육','#3c9455'],'통솔':['통','#3b6cc0'],'능력':['능','#8a52c6'],'★':['★','#c9a227']};
 const icList=v=>[...new Set((Array.isArray(v)?v:String(v||'').replace(/[*＊☆]/g,'★').split(/[\s,·\/|]+/)).map(x=>String(x).trim()).filter(x=>ICN[x]))];
 /* 쓰는 곳 → 갈래 (색 점) */
 const kindOf=t=>{t=String(t||'');return /배틀/.test(t)?(/대응/.test(t)?'re':'bt'):/체크/.test(t)?'ck':/던전/.test(t)?'dg':/상태|증상|광기/.test(t)?'st':/열쇠/.test(t)?'ky':'etc'};
 /* 효과 글: 『』 「」 용어와 ±숫자를 굵게 (escape 한 뒤라 안전) */
 const fx=x=>esc(String(x??'').replace(/<br\s*\/?>/gi,'\n')).replace(/\r/g,'')
   .replace(/(『[^』\n]{1,24}』|「[^」\n]{1,24}」)/g,'<b class="skk">$1</b>')
   .replace(/(^|[\s(（])([+＋−\-–]\s?\d+(?:\/\d+)?%?)/g,'$1<b class="skn">$2</b>')
   .replace(/\n/g,'<br>');
 /* 분류 (11-03): 열쇠 · 준비 · 증상 → 작은 딱지 색 */
 const clsKey=v=>{v=String(v||'');return /열쇠/.test(v)?'ky':/준비/.test(v)?'pr':/증상|광기|상태/.test(v)?'sy':'etc'};
 const KEY='<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><circle cx="22" cy="22" r="12"/><circle cx="22" cy="22" r="4.5"/><path d="M31 31 54 54M44 44l6-6M49 49l5-5"/></g></svg>';
 function html(c,o){c=c||{};o=o||{};
  const ic=icList(c.ic),cost=c.c!==''&&c.c!=null,k=kindOf(c.t);
  const t=String(c.t||'').split(/\s*·\s*/).filter(Boolean);
  const len=[...String(c.x||'')].length;const dense=len>72?' dense':len>44?' mid':'';
  return `<div class="skc k-${k}${dense}${o.sel?' sel':''}${c.img?'':' noimg'}${o.cls?' '+o.cls:''}" style="--skc:${esc(c.col||'#6b7286')}" ${o.attr||''}><div class="skc-fr"><div class="skc-in">`
   +`<div class="skc-art"${c.img?` style="background-image:url('${cssu(c.img)}')"`:''}>${c.img?'':`<span class="skc-wm">${KEY}</span>`}</div>`
   +`<div class="skc-top">${cost?`<span class="skc-cost" title="비용"><b>${esc(c.c)}</b></span>`:''}<b class="skc-n">${esc(c.n||'?')}</b></div>`
   +(ic.length?`<div class="skc-ic" title="아이콘 — 스킬 체크에 바치면 +1">${ic.map(x=>`<i style="--ic:${ICN[x][1]}" title="${esc(x)}">${ICN[x][0]}</i>`).join('')}</div>`:'')
   +`<div class="skc-body"><div class="skc-t">${t.length?t.map((s,i)=>`<span${i?'':' class="m"'}>${esc(s)}</span>`).join(''):'<span class="m">카드</span>'}</div>`
   +`<div class="skc-x">${fx(c.x)}</div>`
   +`<div class="skc-f">${c.cls?`<i class="skc-cls c-${clsKey(c.cls)}" title="분류">${esc(c.cls)}</i>`:''}<span>${esc(c.src||'')}</span>${c.lim?`<u title="덱 제한">${esc(c.lim)}</u>`:''}${c.auto?'<u class="a" title="자동화 구문이 돈다">AUTO</u>':''}</div></div>`
   +`</div></div>${o.badge!=null&&o.badge!==''?`<em class="skc-q">${esc(o.badge)}</em>`:''}</div>`}
 const back=n=>`<div class="skc back"><div class="skc-fr"><div class="skc-in"><span class="skc-bk">${KEY}</span>${n!=null&&n!==''?`<em>${esc(n)}</em>`:''}</div></div></div>`;
 /* 휴대폰 덱 앱 같은 좁은 칸: 세로 비율 없이 글을 다 보여 주는 납작한 카드 (같은 옷) */
 function flat(c,o){c=c||{};o=o||{};const ic=icList(c.ic),cost=c.c!==''&&c.c!=null,k=kindOf(c.t);const t=String(c.t||'').split(/\s*·\s*/).filter(Boolean);
  return `<div class="dc skf k-${k}${o.sel?' sel':''}${o.cls?' '+o.cls:''}" style="--skc:${esc(c.col||'#6b7286')}" ${o.attr||''}>${o.badge!=null&&o.badge!==''?`<em class="dcb">${esc(o.badge)}</em>`:''}`
   +`<div class="dch">${cost?`<span class="dcc">${esc(c.c)}</span>`:''}<b>${esc(c.n||'?')}</b>${ic.length?`<span class="dcp">${ic.map(x=>`<i style="--ic:${ICN[x][1]}" title="${esc(x)}">${ICN[x][0]}</i>`).join('')}</span>`:''}</div>`
   +(c.img?`<div class="dci" style="background-image:url('${cssu(c.img)}')"></div>`:'')
   +`<div class="dct">${t.length?t.map((s,i)=>`<span${i?'':' class="m"'}>${esc(s)}</span>`).join(''):'<span class="m">카드</span>'}</div>`
   +`<div class="dcx">${fx(c.x)}</div>`
   +(c.auto||c.lim||c.cls?`<div class="dcf">${c.cls?`<i class="skc-cls c-${clsKey(c.cls)}">${esc(c.cls)}</i>`:''}${c.lim?`<u>${esc(c.lim)}</u>`:''}${c.auto?'<u class="a" title="자동화 구문이 돈다">AUTO</u>':''}</div>`:'')+`</div>`}
 const flatBack=n=>`<div class="dc skf back"><span class="skc-bk">${KEY}</span>${n!=null&&n!==''?`<em>${esc(n)}</em>`:''}</div>`;
 return {html,back,flat,flatBack,fx,icList,ICN,kindOf,clsKey}})();
