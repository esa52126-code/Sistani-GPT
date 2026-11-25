import csv, os, sys
S=sys.argv[1]; H=3508
def norm(s):
    o=[]
    for ch in s:
        if ch in 'يىےۓئ': o.append('ی')
        elif ch=='ك': o.append('ک')
        elif ch in 'هةۃۂھ': o.append('ہ')
        elif ch in 'أإآٱ': o.append('ا')
        elif ch=='ؤ': o.append('و')
        elif 'ً'<=ch<='ٟ' or ch in 'ٰـ‌‍‎‏': pass
        else: o.append(ch)
    return ''.join(c for c in o if c.isalpha())
def lines(p):
    f=f"{S}/tsv/{p:03d}.tsv"
    rows=list(csv.DictReader(open(f,encoding='utf-8'),delimiter='\t',quoting=csv.QUOTE_NONE))
    L={}
    for r in rows:
        if r['level']=='4': L[(r['block_num'],r['par_num'],r['line_num'])]=dict(y=int(r['top']),w=int(r['width']),words=[])
    for r in rows:
        if r['level']=='5' and (r['text'] or '').strip():
            k=(r['block_num'],r['par_num'],r['line_num'])
            if k in L: L[k]['words'].append(r['text'])
    return [l for l in L.values() if l['words'] and l['y']>0.065*H]
def grams(s): return {s[i:i+2] for i in range(len(s)-1)}
out=[]; miss=0
for line in open(f"{S}/toc3.tsv",encoding="utf-8"):
    title,page,extra=line.rstrip("\n").split("\t"); page=int(page)
    # the first words are the printed heading; extra words were added for search only
    g=grams(norm(title))
    best=(0,None,None)
    for p in (page, page+1, page-1):
        if not 1<=p<=542: continue
        for l in lines(p):
            t=norm(' '.join(l['words']))
            lg=grams(t)
            if not lg: continue
            # heading lines are short; compare overlap relative to the line
            inter=len(g & lg)
            sc=inter/ max(len(lg),1) * min(1, inter/ max(3,len(g)*0.4))
            if l['w']>1500: sc*=0.35  # full-width lines are body text
            if p!=page: sc*=0.8
            if sc>best[0]: best=(sc,p,l['y'])
    if best[0]<0.25:
        miss+=1; out.append((title,page,-1,extra))
    else:
        out.append((title,best[1],round(best[2]/H*10000),extra))
with open(f"{S}/out/headings.tsv",'w',encoding='utf-8') as o:
    for t,p,y,e in out: o.write(f"{t}\t{p}\t{y}\t{e}\n")
print('headings',len(out),'not located',miss)
