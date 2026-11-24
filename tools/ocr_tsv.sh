#!/bin/bash
S=/tmp/claude-0/-home-user/333d1d18-8fee-5817-9a93-4c769e1d9227/scratchpad
PDF=/home/user/Sistani-GPT/urdu-tozih.pdf
p=$1; n=$(printf "%03d" $p)
[ -s $S/tsv/$n.tsv ] && exit 0
pdftoppm -r 300 -f $p -l $p -gray -png $PDF $S/tsv/img-$n >/dev/null 2>&1
f=$(ls $S/tsv/img-$n*.png | head -1)
OMP_THREAD_LIMIT=1 tesseract "$f" $S/tsv/$n --tessdata-dir /opt/tessbest -l urd --psm 6 tsv >/dev/null 2>&1
rm -f "$f"
