#!/bin/sh
# 새 로직 승률 = (왼쪽 new 의 왼 승 + 오른쪽 new 의 오 승) / 전체
N=${1:-2}
A=$(node tools/pvp.js --n $N --polL new --quiet 1 | head -1)
B=$(node tools/pvp.js --n $N --polR new --quiet 1 | head -1)
echo "$A"; echo "$B"
node -e "const a=process.argv[1],b=process.argv[2];const g=s=>({l:+s.match(/왼 (\d+)/)[1],r:+s.match(/오 (\d+)/)[1],n:+s.match(/(\d+)판/)[1]});const x=g(a),y=g(b);console.log('새 로직 승률',((x.l+y.r)/(x.n+y.n)*100).toFixed(1)+'%')" "$A" "$B"
