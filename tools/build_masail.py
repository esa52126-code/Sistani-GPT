import csv, os, re, sys, statistics
S, OUT, KT = sys.argv[1], sys.argv[2], sys.argv[3]
tr = str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789')
W, H = 2480, 3508  # A4 at 300 dpi

def page_lines(p):
    f = f"{S}/tsv/{p:03d}.tsv"
    if not os.path.exists(f): return []
    rows = list(csv.DictReader(open(f, encoding='utf-8'), delimiter='\t', quoting=csv.QUOTE_NONE))
    lines = {}
    for r in rows:
        if r['level'] == '4':
            lines[(r['block_num'], r['par_num'], r['line_num'])] = dict(
                x=int(r['left']), y=int(r['top']), w=int(r['width']), h=int(r['height']), words=[])
    for r in rows:
        if r['level'] == '5' and (r['text'] or '').strip():
            k = (r['block_num'], r['par_num'], r['line_num'])
            if k in lines: lines[k]['words'].append(r['text'].strip())
    out = [l for l in lines.values() if l['words'] and l['h'] > 25]
    out.sort(key=lambda l: l['y'])
    return out

PAGE_FOR_NUM = [0]
def starts_numbered(text):
    t = text.translate(tr).replace('‏', '').replace('‎', '').strip()
    m = re.match(r'^([0-9]{1,4})\s*[\u06d4\-\u2013_.]', t)
    if m is None: return False
    # single-digit numbers after the first pages are list items inside a masla
    return len(m.group(1)) >= 2 or PAGE_FOR_NUM[0] < 18

# located TOC headings: force a paragraph break at each of them
heading_y = {}
hf = f"{S}/out/headings.tsv"
if os.path.exists(hf):
    for line in open(hf, encoding='utf-8'):
        t = line.rstrip('\n').split('\t')
        if len(t) >= 3 and int(t[2]) >= 0:
            heading_y.setdefault(int(t[1]), []).append(int(t[2]) / 10000 * H)
def is_heading_line(p, y):
    return any(abs(y - hy) < 12 for hy in heading_y.get(p, []))

paras = []  # dicts: page,x0,y0,x1,y1,text,numbered,lead
for p in range(1, 543):
    PAGE_FOR_NUM[0] = p
    lines = page_lines(p)
    # drop running header (top ~7% of page)
    lines = [l for l in lines if l['y'] > 0.065 * H]
    if not lines: continue
    cur = None
    prev = None
    for l in lines:
        text = ' '.join(l['words'])
        hd = is_heading_line(p, l['y'])
        newpara = cur is None or hd or (l['y'] - prev['y']) > 145 or (l['y'] - (prev['y'] + prev['h'])) > 75 \
            or (cur.get('toc') and len(cur['lines']) == 1)
        if newpara:
            if cur: paras.append(cur)
            cur = dict(page=p, x0=l['x'], y0=l['y'], x1=l['x'] + l['w'], y1=l['y'] + l['h'],
                       lines=[text], numbered=starts_numbered(text), lead=text, first=(cur is None), toc=hd)
        else:
            cur['x0'] = min(cur['x0'], l['x']); cur['x1'] = max(cur['x1'], l['x'] + l['w'])
            cur['y1'] = max(cur['y1'], l['y'] + l['h']); cur['lines'].append(text)
        prev = l
    if cur: paras.append(cur)

# Merge headings (single short line, not numbered) into the following paragraph on the same page
merged = []
i = 0
while i < len(paras):
    q = paras[i]
    short = bool(q.get('toc'))
    if short and i + 1 < len(paras) and paras[i + 1]['page'] == q['page']:
        n = paras[i + 1]
        n = dict(n); n['y0'] = q['y0']; n['x0'] = min(n['x0'], q['x0']); n['x1'] = max(n['x1'], q['x1']); n['heading'] = True
        n['lines'] = q['lines'] + n['lines']; n['first'] = q['first']
        paras[i + 1] = n
        i += 1
        continue
    if q.get('toc'): q['heading'] = True
    merged.append(q); i += 1
paras = merged

# Unnumbered paragraphs (lists, follow-up text) belong to the masla above them on the same page
merged = []
for q in paras:
    if merged and not q['numbered'] and not q['first'] and not q.get('heading') and merged[-1]['page'] == q['page']:
        m = merged[-1]
        m['y1'] = max(m['y1'], q['y1']); m['x0'] = min(m['x0'], q['x0']); m['x1'] = max(m['x1'], q['x1'])
        m['lines'] = m['lines'] + q['lines']
        continue
    merged.append(q)
paras = merged

# Continuation: first paragraph on a page that does not start with a number
for q in paras:
    q['cont'] = 1 if (q['first'] and not q['numbered']) else 0

# Estimated masla numbers: chapter anchors + OCR suffix matches + sequential counting
kt = open(KT, encoding='utf-8').read()
ch = [tuple(map(int, t)) for t in re.findall(
    r'pageStart = (\d+),\s*pageEnd = (\d+),\s*maslaStart = (\d+),\s*maslaEnd = (\d+)', kt)]
def expected(p):
    for ps, pe, ms, me in ch:
        if ps <= p <= pe:
            return ms + (me - ms) * (p - ps) / max(1, pe - ps)
    return None
numbered = [k for k, q in enumerate(paras) if q['numbered']]
cands = []
for k in numbered:
    q = paras[k]
    e = expected(q['page'])
    if e is None: continue
    t = re.match(r'^\s*([0-9]{1,4})', q['lead'].translate(tr).replace('‏', '').replace('‎', '')).group(1)
    if len(t) < 2 and e >= 10: continue
    for v in range(max(1, int(e - 40)), int(e + 40)):
        if str(v).endswith(t): cands.append((k, v, len(t) / len(str(v))))
cands.sort()
best = [c[2] for c in cands]; prev = [-1] * len(cands)
pos = {k: i for i, k in enumerate(numbered)}
for i in range(len(cands)):
    ki, vi, wi = cands[i]
    for j in range(max(0, i - 400), i):
        kj, vj, wj = cands[j]
        gap = pos[ki] - pos[kj]
        if kj < ki and vj < vi <= vj + 3 * gap + 8 and best[j] + wi > best[i]:
            best[i] = best[j] + wi; prev[i] = j
anchors = {}
if cands:
    i = max(range(len(cands)), key=lambda x: best[x])
    while i != -1:
        anchors[cands[i][0]] = cands[i][1]; i = prev[i]
# fill numbered paragraphs between anchors by counting
est = {}
akeys = sorted(anchors)
for k in numbered:
    if k in anchors: est[k] = anchors[k]; continue
    before = [a for a in akeys if a < k]
    if before:
        a = before[-1]
        est[k] = anchors[a] + (pos[k] - pos[a])
for k, q in enumerate(paras):
    q['est'] = est.get(k, 0)

with open(f"{OUT}/masail.tsv", 'w', encoding='utf-8') as o:
    for q in paras:
        text = ' '.join(q['lines']).replace('\t', ' ')
        o.write('\t'.join(map(str, [
            q['page'],
            round(q['x0'] / W * 10000), round(q['y0'] / H * 10000),
            round(q['x1'] / W * 10000), round(q['y1'] / H * 10000),
            q['est'], q['cont'], text])) + '\n')
print('paragraphs', len(paras), 'numbered', len(numbered), 'anchors', len(anchors),
      'cont', sum(q['cont'] for q in paras))
