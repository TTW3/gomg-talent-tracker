#!/usr/bin/env python3
"""Update GOMG tracker game-data.json from public community data sources.

Primary source: GMG Wiki static Units index (unit IDs/names + metadata).
Secondary source: hxsngh helper site is probed for JSON/JS data when discoverable.
The script preserves existing talent records when a source cannot provide a safe
English talent name, rather than inventing translations.
"""
from __future__ import annotations
import json, re, sys
from datetime import date
from html.parser import HTMLParser
from urllib.parse import urljoin
from urllib.request import Request, urlopen

UNITS_URL = "https://gomg-wiki.pages.dev/units/"
HXSNGH_URL = "https://hxsngh.pages.dev/"
OUT = "game-data.json"

class TableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows=[]; self.row=None; self.cell=None; self.buf=[]; self.in_heading=None
        self.headings=[]
    def handle_starttag(self, tag, attrs):
        if tag in ('h1','h2','h3'):
            self.in_heading=tag; self.buf=[]
        elif tag=='tr':
            self.row=[]
        elif tag in ('td','th') and self.row is not None:
            self.cell=[]; self.buf=[]
    def handle_endtag(self, tag):
        if tag in ('h1','h2','h3') and self.in_heading==tag:
            txt=' '.join(''.join(self.buf).split())
            self.headings.append((tag,txt)); self.in_heading=None
        elif tag in ('td','th') and self.row is not None and self.cell is not None:
            txt=' '.join(''.join(self.cell).split())
            self.row.append(txt); self.cell=None
        elif tag=='tr' and self.row is not None:
            if self.row: self.rows.append(self.row)
            self.row=None
    def handle_data(self,data):
        if self.in_heading: self.buf.append(data)
        if self.cell is not None: self.cell.append(data)

def fetch(url):
    req=Request(url,headers={'User-Agent':'GOMG-Talent-Tracker updater/1.0'})
    with urlopen(req,timeout=30) as r: return r.read().decode('utf-8','replace')

def clean(s):
    return re.sub(r'\s+',' ',s).strip()

def parse_units(html):
    p=TableParser(); p.feed(html)
    # Unit rows always begin with M... IDs. Header rows are ignored.
    out=[]; section='standard'; step=''
    # Infer section/step from heading order by scanning textual HTML markers.
    # We also use row shape: alter rows have an extra "Std base" + "Alter Theme" column.
    for row in p.rows:
        if not row or not re.fullmatch(r'M\d+(?:_\d+)?', row[0].strip('` ')): continue
        uid=row[0].strip('` ')
        alter='_' in uid
        # Find name by fixed table schema.
        if alter and len(row)>=11:
            base=row[2].strip('` '); name=row[3]; theme=row[4]; cls=row[5]; typ=row[6]; elem=row[7]; terrain=row[8]
            source=row[9]
            out.append({'id':uid,'name_en':name,'variant':theme,'base_id':base,'rarity':'','role':cls,'type':typ,'element':elem,'terrain':terrain,'source':source,'kind':'alter'})
        elif not alter and len(row)>=7:
            name=row[2]; cls=row[3]; typ=row[4]; elem=row[5]; terrain=row[6]
            out.append({'id':uid,'name_en':name,'rarity':'','role':cls,'type':typ,'element':elem,'terrain':terrain,'kind':'standard'})
    # De-duplicate by ID and keep order from source.
    seen=set(); result=[]
    for x in out:
        if x['id'] not in seen:
            seen.add(x['id']); result.append(x)
    return result

def probe_hxsngh():
    """Best-effort supplemental probe. The site is a JS app, so don't fail the update if its internals move."""
    try:
        html=fetch(HXSNGH_URL)
    except Exception as e:
        return {'status':'unavailable','detail':str(e)}
    scripts=re.findall(r'<script[^>]+src=[\"\']([^\"\']+)',html,re.I)
    assets=[]
    for s in scripts[:30]:
        assets.append(urljoin(HXSNGH_URL,s))
    json_urls=[]
    for u in assets:
        try:
            js=fetch(u)
        except Exception:
            continue
        # Static JSON/data assets referenced by the app bundle.
        for m in re.findall(r'[\"\']([^\"\']+\.(?:json|csv)(?:\?[^\"\']*)?)[\"\']',js,re.I):
            json_urls.append(urljoin(u,m))
    return {'status':'ok','scripts':len(scripts),'data_urls':sorted(set(json_urls))[:50]}

def normalize_character_names(chars):
    """Make every character display name unique, especially Alter units."""
    # First prefer the explicit variant supplied by the source.
    for c in chars:
        name = clean(c.get('name_en') or c.get('name_source') or c.get('id') or 'Unknown')
        variant = clean(c.get('variant') or '')
        base = clean(c.get('base_name') or '')
        if variant:
            # If the source already included the variant, don't duplicate it.
            if not re.search(r'\(' + re.escape(variant) + r'\)\s*$', name, re.I):
                name = f"{base or name} ({variant})"
        c['name_en'] = name

    # Final safety net: no two records may have the same display name.
    seen = {}
    for c in chars:
        key = normalize_key(c['name_en'])
        seen[key] = seen.get(key, 0) + 1
    used = {}
    for c in chars:
        key = normalize_key(c['name_en'])
        if seen[key] > 1:
            variant = clean(c.get('variant') or '')
            source_id = clean(c.get('source_id') or c.get('id') or '')
            suffix = variant or source_id
            if suffix and f"({suffix})" not in c['name_en']:
                c['name_en'] = f"{c['name_en']} ({suffix})"
        # Absolute last resort if the source still gives duplicates.
        k2 = normalize_key(c['name_en'])
        used[k2] = used.get(k2, 0) + 1
        if used[k2] > 1:
            sid = clean(c.get('source_id') or c.get('id') or str(used[k2]))
            c['name_en'] = f"{c['name_en']} [{sid}]"
    return chars

def normalize_key(s):
    return re.sub(r'\s+', ' ', str(s or '').strip().lower())

def merge_preserve_talents(old,new):
    # Keep existing curated English talent names. The updater can add safe records later
    # when a machine-readable English source is found.
    old_t={x.get('id'):x for x in old.get('talents',[]) if isinstance(x,dict) and x.get('id')}
    new['talents']=list(old_t.values())
    return new

def main():
    try:
        html=fetch(UNITS_URL)
    except Exception as e:
        print(f'ERROR: cannot fetch {UNITS_URL}: {e}',file=sys.stderr); return 2
    units=parse_units(html)
    if len(units) < 100:
        print(f'ERROR: suspicious unit count {len(units)}; refusing to overwrite database',file=sys.stderr); return 3
    try:
        old=json.load(open(OUT,encoding='utf-8'))
    except Exception:
        old={'schema_version':3,'talents':[]}
    # Normalize names before matching. Every Alter must remain uniquely addressable.
    units=normalize_character_names(units)

    # Preserve tracker IDs by source_id first, then by display name + variant.
    # This is important because localStorage stores charId values.
    old_chars=old.get('characters',[]) if isinstance(old.get('characters',[]),list) else []
    old_by_source={}
    old_by_name={}
    for c in old_chars:
        sid=str(c.get('source_id') or '').strip()
        key=(normalize_key(c.get('name_en','')), normalize_key(c.get('variant','')))
        if sid: old_by_source[sid]=c.get('id')
        if key[0]: old_by_name[key]=c.get('id')
    used=set(x for x in list(old_by_source.values())+list(old_by_name.values()) if x)
    next_num=1
    def new_id():
        nonlocal next_num
        while f'char_{next_num:03d}' in used: next_num+=1
        x=f'char_{next_num:03d}'; used.add(x); return x
    chars=[]
    for u in units:
        sid=str(u.get('id') or '').strip()
        key=(normalize_key(u['name_en']), normalize_key(u.get('variant','')))
        cid=old_by_source.get(sid) or old_by_name.get(key)
        # Keep the existing alter-style ID when it is already present.
        if not cid:
            if sid.startswith('M') and '_' in sid:
                cid=f'alter_{sid}'
                if cid in used: cid=new_id()
                else: used.add(cid)
            else:
                cid=new_id()
        rec={'id':cid,'name_en':u['name_en']}
        # Keep the machine-readable source ID so future updates can match safely.
        if sid:
            rec['source_id']=sid
            rec['icon']=f'https://gomg-wiki.pages.dev/assets/icons/Header/{sid}.png'
        if u.get('base_name'): rec['base_name']=u['base_name']
        for k in ('rarity','role','type','element','terrain','variant','base_id','source','kind'):
            if u.get(k): rec[k]=u[k]
        chars.append(rec)
    db={'schema_version':4,'last_checked':str(date.today()),'character_source':UNITS_URL,'talent_source':old.get('talent_source','https://mocha-gameguide.com/gensho/talents/'),'official_update_source':old.get('official_update_source','https://www.chillyroom.com/en/game-news/40/262'),'characters':chars,'talents':old.get('talents',[]),'notes':[
        'Characters are refreshed from the GMG Wiki Units index (auto-generated from RoleDataTable).',
        'hxsngh.pages.dev is used as a supplemental probe when machine-readable assets are discoverable; it is not allowed to overwrite curated English names blindly.'
    ]}
    db=merge_preserve_talents(old,db)
    with open(OUT,'w',encoding='utf-8') as f: json.dump(db,f,ensure_ascii=False,indent=2); f.write('\n')
    print(f'Updated characters: {len(chars)}')
    print(f'Preserved curated talents: {len(db["talents"])}')
    probe=probe_hxsngh(); print('hxsngh probe:',json.dumps(probe,ensure_ascii=False))
    return 0

if __name__=='__main__': raise SystemExit(main())
