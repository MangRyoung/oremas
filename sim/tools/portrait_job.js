/* 미사그 변이체 포트 작업 목록 만들기 (11-03 감우) — lib/artprompt.js 규칙(H3) 그대로.
   node tools/portrait_job.js --dungeon md1_forest,md2_sea   또는   --ids w001,w002   [--all-orig] [--out data/dungeon_img/job_X.json]
   → {memo, H, N, T:[[id, 이름, 변이 특징, 태그]]} — NAI 탭에서 prompt = H + 태그, 금지 칸 = N. 실제 포켓몬(origin old)은 뺀다(공식 그림 줄). */
const fs=require('fs'),path=require('path');process.chdir(path.join(__dirname,'..'));
const A=require('../lib/artprompt.js');const arg=k=>{const i=process.argv.indexOf('--'+k);return i<0?null:(process.argv[i+1]||true)};
const src=fs.readFileSync('ui/index.html','utf8');const grab=v=>(0,eval)('('+src.match(new RegExp('const '+v+'=(\\{[^;]*\\});'))[1]+')');
const T={TYPE_EN:grab('TYPE_EN'),KIND_EN:grab('KIND_EN'),SIZE_EN:grab('SIZE_EN'),ROOT_EN:grab('ROOT_EN')};const HAB_EN=grab('HAB_EN');
const BG={md1_forest:'a misty overgrown forest with vines',md2_sea:'a sea cave with tide pools and turquoise water',md3_snow:'a snowy mountain with ice walls',md4_cave:'an old underground mine tunnel with wooden beams and lanterns',md5_house:'a dusty abandoned victorian house interior with moonlight',md6_ruin:'ancient stone ruins with carved runes',md7_lab:'an old brick laboratory basement with brass pipes, wooden shelves and gas lamps',md8_volc:'a volcanic cave with black rock and glowing lava cracks'};
const db=JSON.parse(fs.readFileSync('data/wild/db.json','utf8')).entries;const by=Object.fromEntries(db.map(e=>[e.id,e]));
const pick=new Map();   /* id → {bg, boss} */
if(arg('dungeon'))for(const id of String(arg('dungeon')).split(',')){const dg=JSON.parse(fs.readFileSync('data/dungeons/'+id+'.json','utf8'));for(const r of dg.rooms)if(r.enc)r.enc.mix.forEach((m,j)=>{const boss=!!(r.enc.boss&&j===(+r.enc.bossAt||0));const p=pick.get(m.db)||{};pick.set(m.db,{bg:p.bg||BG[id]||(dg.theme&&HAB_EN[dg.theme])||'',boss:p.boss||boss})})}
if(arg('ids'))for(const id of String(arg('ids')).split(','))pick.set(id,{bg:'',boss:false});
if(arg('all-orig'))for(const e of db)if(e.origin==='orig'&&!pick.has(e.id))pick.set(e.id,{bg:'',boss:e.role==='보스'});
const out=[];for(const [id,o] of pick){const e=by[id];if(!e||e.origin!=='orig')continue;const bg=o.bg||(HAB_EN[(e.hab||[])[0]]||'');const P=A.portrait(e,T,{bg,boss:o.boss});out.push([id,e.name,P.traits,P.prompt.slice(A.MSTYLE.H2.length)])}
const job={memo:`${new Date().toISOString().slice(0,10)} 미사그 변이체 포트 (lib/artprompt.js H3 · tools/portrait_job.js)`,H:A.MSTYLE.H2,N:A.MNEG_BASE+', '+A.MNEG2,T:out};
const f=arg('out')||'data/dungeon_img/job_portrait.json';fs.writeFileSync(f,JSON.stringify(job,null,1));console.log(f,out.length+'체');
