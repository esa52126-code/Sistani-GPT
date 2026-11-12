"""Builds app/src/main/assets/tauzih.json from the official Urdu text of Tawzih al-Masail
(https://www.sistani.org/urdu/book/61/).

Usage:  python3 tools/build_book_json.py <cache-dir> app/src/main/assets/tauzih.json

Chapter pages are downloaded into <cache-dir> once and reused on later runs.
Output: {"source", "chapters": [{id,title,url,from,to}], "items": [{n,c,s,t}]} where n is the
masla number (0 for unnumbered text), c the chapter index, s the section heading, t the text.
"""
import os,time,urllib.request
import re,html,json,sys
W=sys.argv[1]; OUT=sys.argv[2]
BASE='https://www.sistani.org'
def get(url,path):
    if os.path.exists(path) and os.path.getsize(path)>2000: return
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
    open(path,'wb').write(urllib.request.urlopen(req,timeout=60).read()); time.sleep(0.5)
os.makedirs(W,exist_ok=True)
get(BASE+'/urdu/book/61/',W+'/idx.html')
order=list(dict.fromkeys(re.findall(r'href="/urdu/book/61/(\d+)/"',open(W+'/idx.html',encoding='utf-8').read())))
for i in order: get(f'{BASE}/urdu/book/61/{i}/',f'{W}/{i}.html')
D='۰۱۲۳۴۵۶۷۸۹'
def num(s): return int(''.join(str(D.index(c)) if c in D else c for c in s))
items=[];chapters=[]
last=0
for ci,i in enumerate(order):
    h=open(f'{W}/{i}.html',encoding='utf-8').read()
    title=html.unescape(re.search(r'<h1 class="c">(.*?)</h1>',h,re.S).group(1)).strip()
    title=re.sub(r'\s+',' ',title)
    m=re.search(r'<div class="baz book-text">(.*?)</div>\s*<div class="clr',h,re.S) or re.search(r'<div class="baz book-text">(.*?)</div>',h,re.S)
    b=m.group(1)
    b=re.sub(r'<br\s*/?>','\n',b); b=re.sub(r'</(p|h\d|div|li|tr)>','\n',b)
    b=re.sub(r'<h\d[^>]*>','\n## ',b)
    b=html.unescape(re.sub(r'<[^>]+>','',b)).replace('‌','').replace('\xa0',' ')
    b=re.sub(r'[ \t]+',' ',b); b=re.sub(r' ?\n ?','\n',b); b=re.sub(r'\n{2,}','\n',b).strip()
    b=re.sub(r' ([۔،؛؟!:])',r'\1',b)
    parts=re.split(r'(?m)^(?:\*\s*)?مسئلہ ?\(? ?([۰-۹0-9]+) ?\)',b)
    ch={'id':int(i),'title':title,'url':f'https://www.sistani.org/urdu/book/61/{i}/','from':None,'to':None}
    pre=parts[0].strip()
    section=''
    def push(n,text,sec):
        items.append({'n':n,'c':ci,'s':sec,'t':text})
    if pre:
        pl=pre.split('\n'); heads=[]
        while len(parts)>1 and pl and len(pl[-1])<=70 and not re.search(r'[۔:،؟!؛]$',pl[-1]): heads.insert(0,pl.pop().strip())
        pre='\n'.join(pl).strip()
        body='\n'.join(x for x in pre.split('\n'))
        if pre:
            push(0,pre.replace('## ',''),'')
        if heads: section=heads[-1]
    for k in range(1,len(parts),2):
        n=num(parts[k]); t=parts[k+1].strip()
        lines=t.split('\n')
        # trailing headings belong to next masla
        tail=[]
        while len(lines)>1 and len(lines[-1])<=70 and not re.search(r'[۔:،؟!؛]$|^\(|^[۰-۹0-9]|^\*',lines[-1]): tail.insert(0,lines.pop().strip())
        t='\n'.join(l.replace('## ','') for l in lines).strip()
        if n!=last+1: print('GAP',title,last,n,file=sys.stderr)
        last=n
        if ch['from'] is None: ch['from']=n
        ch['to']=n
        push(n,t,section)
        if tail: section=tail[-1]
    chapters.append(ch)
json.dump({'source':'https://www.sistani.org/urdu/book/61/','chapters':chapters,'items':items},open(OUT,'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
ms=[x for x in items if x['n']]
print(len(chapters),len(items),len(ms),max(x['n'] for x in ms),sum(len(x['t']) for x in items))
print(sorted(len(x['t']) for x in items)[-8:])
for c in chapters: print(c['from'],c['to'],c['title'])
