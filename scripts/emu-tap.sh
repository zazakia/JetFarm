#!/usr/bin/env bash
# Tap the centre of the first accessibility node whose text/content-desc matches $1.
# Usage: scripts/emu-tap.sh "<regex>"   (override device with DEV=<serial>)
set -euo pipefail
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'
DEV="${DEV:-emulator-5554}"
PATTERN="$1"
adb -s "$DEV" shell uiautomator dump /sdcard/qdump.xml >/dev/null
adb -s "$DEV" shell cat /sdcard/qdump.xml > tmp/qdump.xml
node -e '
const fs=require("fs");
const s=fs.readFileSync("tmp/qdump.xml","utf8");
const re=/<node[^>]*>/g; let m; const hits=[];
while((m=re.exec(s))){
  const t=m[0];
  const txt=(t.match(/text="([^"]*)"/)||[])[1]||"";
  const desc=(t.match(/content-desc="([^"]*)"/)||[])[1]||"";
  const b=(t.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)||[]).slice(1).map(Number);
  if(!b.length) continue;
  if(new RegExp(process.argv[1],"i").test(txt+" "+desc)) hits.push({label:txt||desc,b});
}
if(!hits.length){ console.error("NO MATCH for "+process.argv[1]); process.exit(3); }
const h=hits[0];
console.log(Math.round((h.b[0]+h.b[2])/2)+" "+Math.round((h.b[1]+h.b[3])/2)+" # "+h.label);
' "$PATTERN" > tmp/qtap.txt
read -r X Y _ < tmp/qtap.txt
echo "tapping $X $Y ($_)"
adb -s "$DEV" shell input tap "$X" "$Y"
