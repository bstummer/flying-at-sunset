#!/bin/bash
# Render several views of the page (two at a time; software GL is CPU bound) and put them side by
# side in <outdir>/<tag>_all.png.
#
#   tools/render.sh <outdir> <tag> start side away high2 tower giant ...
#   tools/render.sh out v1 start "my=pose:1200,2400,-3000,0.3,0.05"   # name=pose:x,y,z,yaw,pitch
#
# Each argument is a preset name, or name=pose:x,y,z,yaw,pitch[,bank] for an exact camera pose.
# Environment: W, H (default 960x540), SCALE (cloud resolution, 0.5), FRAMES (12), EXTRA (more
# query parameters, e.g. "&dbg=1" or "&seed=3"), PAGE (the page to render), JOBS (2).
# Needs node with Playwright and python3 with Pillow (for the combined image).
set -e
here=$(cd "$(dirname "$0")" && pwd)
out=$1; tag=$2; shift 2
[ -n "$out" ] && [ -n "$tag" ] || { echo "usage: $0 <outdir> <tag> preset|name=pose:x,y,z,yaw,pitch ..."; exit 2; }
mkdir -p "$out"
jobs_max=${JOBS:-2}
files=""
for p in "$@"; do
  name=$p; q="preset=$p"
  case $p in *=pose:*) name=${p%%=*}; q="pose=${p#*=pose:}";; esac
  node "$here/shot.mjs" "$out/${tag}_$name.png" "$q&frames=${FRAMES:-12}&w=${W:-960}&h=${H:-540}&scale=${SCALE:-0.5}${EXTRA}" 1800 > "$out/${tag}_$name.log" 2>&1 &
  files="$files $out/${tag}_$name.png"
  while [ "$(jobs -rp | wc -l)" -ge "$jobs_max" ]; do sleep 1; done
done
wait
for f in $files; do echo "$f $(head -1 "${f%.png}.log")"; grep -i "error\|warn\|timeout" "${f%.png}.log" | head -3 || true; done
python3 "$here/combine.py" "$out/${tag}_all.png" $files
echo "combined: $out/${tag}_all.png"
