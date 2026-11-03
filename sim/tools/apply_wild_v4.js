/* 11-03 20:55 망령 「일단 그대로 작업해보자」 — 초안(이름 v4 · 특성 v2 · 미사그 고유 특성 12)을 야생 DB(db.json) 오리지널 225종에 넣는다.
   + 던전 파일(md*.json · _md_overlay*.js) 속 옛 이름을 새 이름으로(조사 이/가 · 을/를 · 은/는 · 과/와 · 으로/로 맞춤).
   옛 이름은 e.prevName 에 남긴다(e.oldName 은 그 전 이름 그대로). 한 번만 돌린다 — 다시 돌리면 이미 바뀐 이름은 건너뜀. */
const fs=require('fs'),path=require('path');process.chdir(path.join(__dirname,'..'));
const P='data/wild/db.json';const db=JSON.parse(fs.readFileSync(P,'utf8'));
const NM=Object.fromEntries(JSON.parse(fs.readFileSync('data/wild/names_v4_draft.json','utf8')).names.map(n=>[n.id,n]));
const AB=JSON.parse(fs.readFileSync('data/wild/abil_v2_draft.json','utf8')).abil;
const UQ=JSON.parse(fs.readFileSync('data/abil/misag_unique_draft.json','utf8')).abil;const UQby=Object.fromEntries(UQ.map(a=>[a.who,a]));
const ren={};let nN=0,nA=0,nU=0;
for(const e of db.entries){if(e.origin!=='orig')continue;const n=NM[e.id];
 if(n&&e.name===n.old){e.prevName=e.name;e.name=n.neu;ren[n.old]=n.neu;nN++}
 const u=UQby[e.id];
 if(u){if(String(u.to)!==String(e.abilityTo))throw new Error('TO 다름 '+e.id+' '+u.name);e.ability=u.name;e.abilityDesc=u.desc;e.abilityOrig=true;e.abilityUnique=true;e.abilityAuto=u.ops&&u.ops.length?{ops:u.ops}:null;if(!e.abilityAuto)delete e.abilityAuto;e.abilityReads=true;nU++}
 else{const a=AB[e.id];if(!a)continue;e.ability=a.name;e.abilityDesc=a.desc;e.abilityOrig=false;delete e.abilityAuto;delete e.abilityUnique;e.abilityReads=!!a.reads;nA++}}
db.v4={at:'2026-11-03',memo:'이름 v4 · 특성 v2 · 미사그 고유 특성 12 (tools/apply_wild_v4.js)'};
fs.writeFileSync(P,JSON.stringify(db,null,1));
/* 조사 맞추기 */
const bat=w=>{const c=[...w].pop().charCodeAt(0)-0xAC00;return c>=0&&c<11172&&c%28!==0};
const rieul=w=>{const c=[...w].pop().charCodeAt(0)-0xAC00;return c>=0&&c%28===8};
function swap(s,o,n){const B=bat(n),R=rieul(n);
 return s.replace(new RegExp(o+'(이|가|을|를|은|는|과|와|으로|로|이다|다|아|야|이여|여)?(?![가-힣])','g'),(m,j)=>{if(!j)return n;
  const J={이:B?'이':'가',가:B?'이':'가',을:B?'을':'를',를:B?'을':'를',은:B?'은':'는',는:B?'은':'는',과:B?'과':'와',와:B?'과':'와',으로:B&&!R?'으로':'로',로:B&&!R?'으로':'로',이다:B?'이다':'다',다:B?'이다':'다',아:B?'아':'야',야:B?'아':'야'}[j];return n+(J||j)})}
const files=fs.readdirSync('data/dungeons').filter(f=>/^md\d.*\.json$|^_md_overlay.*\.js$/.test(f)).map(f=>'data/dungeons/'+f);
let nF=0;for(const f of files){let s=fs.readFileSync(f,'utf8');const s0=s;for(const [o,n] of Object.entries(ren).sort((a,b)=>b[0].length-a[0].length))if(s.includes(o))s=swap(s,o,n);if(s!==s0){fs.writeFileSync(f,s);nF++}}
console.log({이름:nN,특성:nA,고유:nU,파일:nF});
