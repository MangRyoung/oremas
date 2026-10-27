/* ---------- 파티 공용 4식 · 6령 (10-28 망령 「파티 단위 4식 6령은 휴대폰 파티 기능과 연동」) ----------
   켜기: 방 설정 rp.ppool = true. 끄면 예전처럼 트레이너마다 횟수만 센다.
   파티 = 휴대폰 연락처의 방 코드(pub.<트레이너>.phone.room)가 같은 로스터 트레이너들. 칸 = 인원 × (4식 1 · 6령 2).
   남은 수 = 칸 − (쓴 수 − 돌려받은 수)
     · 쓴 수: 트레이너마다 pub.<트레이너>.phone.pu = {o, c} — 배틀에서 선행 · 임의 발동하면 그 트레이너 칸에 더한다 (좌석도 제 것은 쓸 수 있다)
     · 돌려받은 수: ppool.<코드> = {o, c} — 휴식이 채운다(GM). 쓴 수보다 커지지 않는다. 가득 채우면 둘 다 비운다 */
window.OM_PPOOL=(()=>{
 const A=()=>window.OM_APP;const S=()=>(A()&&A().ST&&A().ST.state)||{};
 const PER={o:1,c:2};
 const on=()=>!!((S().rp||{}).ppool);
 const ph=tid=>(((S().pub||{})[tid]||{}).phone)||{};
 const codeOf=tid=>String(ph(tid).room||'').trim();
 const members=code=>code?Object.keys((S().roster||{}).trainers||{}).filter(t=>codeOf(t)===code):[];
 const spentOf=tid=>{const u=ph(tid).pu||{};return {o:Math.max(0,+u.o||0),c:Math.max(0,+u.c||0)}};
 function stat(code){const M=members(code);const n=M.length;const o0=n*PER.o,c0=n*PER.c;let so=0,sc=0;for(const t of M){const u=spentOf(t);so+=u.o;sc+=u.c}
  const r=(S().ppool||{})[code]||{};const bo=Math.min(Math.max(0,+r.o||0),so),bc=Math.min(Math.max(0,+r.c||0),sc);
  return {code,n,members:M,o0,c0,o:Math.max(0,o0-(so-bo)),c:Math.max(0,c0-(sc-bc)),so,sc,bo,bc}}
 /* 켜져 있고 이 트레이너가 파티(방 코드)에 들어 있으면 그 파티 칸, 아니면 null */
 const ofTid=tid=>{if(!on())return null;const code=codeOf(tid);if(!code)return null;const s=stat(code);return s.n?s:null};
 const left=(tid,kind)=>{const s=ofTid(tid);if(!s)return Infinity;return kind==='order'?s.o:s.c};
 /* 지시 창 횟수: 파티 칸이 0 인 종류는 0 으로 보이게 */
 const cnt=(tid,c)=>{const s=ofTid(tid);if(!s)return c;const o=Object.assign({},c);if(s.o<=0)for(const k in o)if(k.startsWith('order_'))o[k]=0;if(s.c<=0)for(const k in o)if(k.startsWith('command_'))o[k]=0;return o};
 const line=s=>`【파티 공용 · ${s.code}】 4식 남은 ${s.o}/${s.o0} · 6령 남은 ${s.c}/${s.c0}`;
 /* 썼다: n = {o, c} */
 async function use(tid,n){if(!n||(!n.o&&!n.c)||!ofTid(tid))return;const u=spentOf(tid);
  if(!await A().set(['pub',tid,'phone','pu'],{o:u.o+(+n.o||0),c:u.c+(+n.c||0)}))return;const s=ofTid(tid);if(s)A().sysLog(line(s),'battle')}
 /* 돌려받기: n = {o, c} 또는 'full'. 남은 수가 칸을 넘지 않게 */
 async function restore(code,n){const s=stat(code);if(!s.n)return '';let o=s.bo,c=s.bc;
  if(n==='full'){o=s.so;c=s.sc}else{o=Math.min(s.so,s.bo+Math.max(0,+(n&&n.o)||0));c=Math.min(s.sc,s.bc+Math.max(0,+(n&&n.c)||0))}
  if(o===s.bo&&c===s.bc)return '';
  if(o===s.so&&c===s.sc){/* 가득: 쓴 기록과 돌려받은 기록을 함께 비운다 (숫자가 쌓이지 않게) */for(const t of s.members)if(ph(t).pu)await A().set(['pub',t,'phone','pu'],null);await A().set(['ppool',code],null)}
  else await A().set(['ppool',code],{o,c});
  const s2=stat(code);return `파티 ${code}: 공용 4식 +${s2.o-s.o} · 6령 +${s2.c-s.c} (남은 ${s2.o}/${s2.o0} · ${s2.c}/${s2.c0})`}
 /* GM 손 조정: 쓰기 −1 (돌려받은 수부터 줄이고, 없으면 첫 파티원 칸에 더한다) */
 async function spend(code,kind){const s=stat(code);if(!s.n)return;const k=kind==='order'?'o':'c';if((kind==='order'?s.o:s.c)<=0)return;
  if(s['b'+k]>0){const r={o:s.bo,c:s.bc};r[k]--;await A().set(['ppool',code],r)}else{const t=s.members[0];const u=spentOf(t);u[k]++;await A().set(['pub',t,'phone','pu'],u)}}
 /* 여러 트레이너의 파티 코드 (중복 없이) */
 const codesOf=tids=>[...new Set((tids||[]).map(codeOf).filter(Boolean))].filter(c=>stat(c).n);
 return {PER,on,codeOf,members,stat,ofTid,left,cnt,use,restore,spend,codesOf,line}})();
