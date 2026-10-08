#!/usr/bin/env python3
"""Refresh GOMG Talent Tracker game-data.json.

Sources
-------
Characters: GOMG Wiki Units index.
Talents: GOMG Wiki Search Talents index (window.TALENT_SEARCH_INDEX).

The updater is intentionally conservative:
- character IDs already used by the tracker are preserved;
- old talent_### IDs are preserved when a source talent matches by English or
  source name;
- old talents missing from the current source are retained as legacy_only;
- the update aborts on suspiciously small source data instead of destroying
  the bundled database.
"""
from __future__ import annotations

import copy
import json
import re
import sys
from datetime import date
from html.parser import HTMLParser
from urllib.parse import urljoin
from urllib.request import Request, urlopen

UNITS_URL = "https://gomg-wiki.pages.dev/units/"
TALENT_INDEX_URL = "https://gomg-wiki.pages.dev/talent-search-index.js"
TALENT_PAGE_URL = "https://gomg-wiki.pages.dev/search-talent-new"
HXSNGH_URL = "https://hxsngh.pages.dev/"
OUT = "game-data.json"

# Curated translations for the Chinese-only source entries present in the
# current index. The source remains the authority; these only fill English
# display text when the source has no English translation.
NAME_TRANSLATIONS = {
    "伤害加深":"Deepened Damage", "冬眠蛰伏":"Hibernating Ambush", "剧毒唾液":"Toxic Saliva",
    "动态视觉":"Dynamic Vision", "动能转化":"Kinetic Conversion", "厚实鳞甲":"Thick Scales",
    "变温爆发":"Ectothermic Burst", "变色鳞甲":"Color-Changing Scales", "吸水皮肤":"Water-Absorbing Skin",
    "奇形吹管":"Strange Flute", "巨颚撕咬":"Giant Jaw Bite", "强力后肢":"Powerful Hind Legs",
    "断尾求生":"Tail-Shedding Survival", "施虐打击":"Sadistic Strike", "既定程序":"Preset Program",
    "死亡翻滚":"Death Roll", "沼泽霸主":"Swamp Overlord", "浪潮翻涌":"Surging Tide",
    "清脆蛙鸣":"Clear Frog Call", "猎魔仪式":"Demon Hunt Ritual", "疯狂生长":"Wild Growth",
    "耐心潜伏":"Patient Ambush", "能源自毁":"Energy Self-Destruct", "自我诊断":"Self-Diagnosis",
    "致命毒素":"Deadly Toxin", "超载运行":"Overload", "远古意志":"Ancient Will",
    "难以清洗":"Hard to Cleanse", "默默潜水":"Silent Diving",
}

EFFECT_TRANSLATIONS = {
    "TF01068":"For every 20 Hinder stacks on the target, deal +1 Follow-Up DMG to it.",
    "TF17305_004":"At low HP, lose 15 Toughness less; at high HP, gain 0 Toughness.",
    "TF17202_004":"After dealing DMG, the target gains +2 Hinder stacks.",
    "TF17302_004":"Gain +1 SPD per 5 Precision stacks.",
    "TF17504_004":"Deal +1 total DMG per 30 SPD.",
    "TF17402_004":"When Weakness is not exposed, take -20 total DMG.",
    "TF17205_004":"After gaining Bloodlust, deal +1 total DMG.",
    "TF17204_004":"Cannot be prioritized as an enemy target, and take -40 group Skill DMG.",
    "TF17303_004":"After Weakness is exposed, consume up to 20 Moisture stacks to gain the same amount of Toughness.",
    "TF01072":"When all enemies have max Hinder, gain +2 single-target Skill targets.",
    "TF17401_004":"For every 15 Stun stacks on the target, inflict +15 Remove stacks on it.",
    "TF17301_004":"Gain +4 Action Mana; gain an additional +1 Action Mana per 200 Strength.",
    "TF17201_004":"After the first 4 Weakness Exposures each turn, gain 10 Toughness.",
    "TF01073":"On the first Skill cast each turn, ignore all Defense Points of targets with max Remove.",
    "TF17503_004":"For every 5 actions performed by other allies, immediately perform 1 extra action.",
    "TF17405_004":"After casting a Skill, the enemy target gains +4 Remove stacks and prioritizes targeting self for the rest of the turn.",
    "TF17403_004":"If there are no other Crocodilian allies, deal +30 total DMG; this effect doubles on Swamp maps.",
    "TF01011_000":"Deal +50% single-hit Skill DMG per 450 Soothe stacks.",
    "TF17304_004":"Before action starts, other allied high-Toughness targets gain 4 Inspire stacks.",
    "TF01072_000":"When casting a Skill, gain +1 multi-hit Skill attacks per 100 Annihilation stacks dealt.",
    "TF01071":"Whenever a HP Gain effect occurs, also gain 10 Growth stacks.",
    "TF17203_004":"On the first attack, if no attack has been received this battle, deal +80 total DMG for that attack.",
    "TF17501_004":"After being defeated, apply 6 Shock stacks to the 3 nearest enemies.",
    "TF17502_004":"After action ends, gain 8 Cleanse stacks and gain HP equal to the Cleanse stacks that failed to take effect this time.",
    "TF01033_000":"Deal +1 single-hit Skill DMG per Hinder stack on the target, and remove all Hinder from the target after casting an attack Skill.",
    "TF17505_004":"Gain +1 single-hit Skill attack, but cannot cast Skills on even-numbered turns.",
    "TF17404_004":"Immune to Stun, but SPD -20.",
    "TF01073_000":"For every 25 Hinder stacks inflicted on the target, it gains +1 Hinder stack, but gains -1 stack of other debuffs.",
    "TF01069":"If no attack was received this turn, deal +10 Annihilation stacks this turn.",
    "TF17103_004":"After attacking, gain 4 Mana, but deal -25% total DMG.",
    "TF16001_004":"Deal +4 Annihilation stacks; increase this effect by 1 per enemy target.",
    "TF16402_004":"When casting a Skill, deal +1 HP Loss per 10 HP gained.",
    "TF01070":"When another allied target exposes Weakness, gain 2 Mana.",
    "TF00065":"Whenever a HP Gain effect occurs, also gain 10 Thorns stacks.",
    "TF12702_004":"Before battle starts, trigger your own defeat effect 2 times, but lose HP equal to 20% of Max HP.",
    "TF15904_004":"Before the turn starts, gain HP equal to 50% of current Damage Taken.",
    "TF00052_000":"While at max Soothe, gain +2 multi-hit Skill attacks.",
}

class TableParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.rows=[]; self.row=None; self.cell=None; self.buf=[]; self.in_heading=None; self.headings=[]
    def handle_starttag(self, tag, attrs):
        if tag in ('h1','h2','h3'): self.in_heading=tag; self.buf=[]
        elif tag=='tr': self.row=[]
        elif tag in ('td','th') and self.row is not None: self.cell=[]; self.buf=[]
    def handle_endtag(self, tag):
        if tag in ('h1','h2','h3') and self.in_heading==tag:
            self.headings.append((tag,' '.join(''.join(self.buf).split()))); self.in_heading=None
        elif tag in ('td','th') and self.row is not None and self.cell is not None:
            self.row.append(' '.join(''.join(self.cell).split())); self.cell=None
        elif tag=='tr' and self.row is not None:
            if self.row: self.rows.append(self.row)
            self.row=None
    def handle_data(self,data):
        if self.in_heading: self.buf.append(data)
        if self.cell is not None: self.cell.append(data)

def fetch(url):
    req=Request(url,headers={'User-Agent':'GOMG-Talent-Tracker updater/2.0'})
    with urlopen(req,timeout=45) as r: return r.read().decode('utf-8','replace')

def clean(s): return re.sub(r'\s+',' ',str(s or '')).strip()
def norm(s): return re.sub(r'\s+',' ',str(s or '').strip().lower())

def parse_units(html):
    p=TableParser(); p.feed(html); out=[]
    for row in p.rows:
        if not row or not re.fullmatch(r'M\d+(?:_\d+)?', row[0].strip('` ')): continue
        uid=row[0].strip('` '); alter='_' in uid
        if alter and len(row)>=11:
            base=row[2].strip('` '); name=row[3]; theme=row[4]; cls=row[5]; typ=row[6]; elem=row[7]; terrain=row[8]; source=row[9]
            out.append({'id':uid,'name_en':name,'variant':theme,'base_id':base,'rarity':'','role':cls,'type':typ,'element':elem,'terrain':terrain,'source':source,'kind':'alter'})
        elif not alter:
            # Standard-unit rows have appeared in two layouts on the wiki:
            #   7+ cells: ID | (unused/rarity) | Name | Role | Type | Element | Terrain
            #   6 cells:  ID | Name | Role | Type | Element | Terrain
            # The old parser only accepted the 7-cell layout, which silently
            # dropped every standard character while still parsing alters.
            if len(row) >= 7:
                name, role, typ, elem, terrain = row[2], row[3], row[4], row[5], row[6]
            elif len(row) >= 6:
                name, role, typ, elem, terrain = row[1], row[2], row[3], row[4], row[5]
            else:
                continue
            out.append({'id':uid,'name_en':name,'rarity':'','role':role,'type':typ,'element':elem,'terrain':terrain,'kind':'standard'})
    seen=set(); result=[]
    for x in out:
        if x['id'] not in seen: seen.add(x['id']); result.append(x)
    return result

def parse_talent_index(js):
    # Static page uses: window.TALENT_SEARCH_INDEX = [...];
    m=re.search(r'window\.TALENT_SEARCH_INDEX\s*=\s*(\[.*?\])\s*;?\s*$',js,re.S)
    if not m: raise ValueError('TALENT_SEARCH_INDEX not found')
    raw=json.loads(m.group(1))
    if not isinstance(raw,list): raise ValueError('Talent index is not an array')
    out=[]
    for src in raw:
        if not isinstance(src,dict) or not src.get('id'): continue
        r=copy.deepcopy(src)
        cn=clean(r.get('name_cn'))
        en=clean(r.get('name_en'))
        if not en or en.startswith('[CN:'):
            en=NAME_TRANSLATIONS.get(cn) or (en.replace('[CN:','').rstrip(']') if en else cn)
        effect=clean(r.get('effect_en'))
        if not effect or effect.startswith('[CN:'):
            effect=EFFECT_TRANSLATIONS.get(str(r.get('id'))) or (effect.replace('[CN:','').rstrip(']') if effect else clean(r.get('effect_cn')))
        tiers=r.get('tiers') if isinstance(r.get('tiers'),list) else []
        rank=tiers[0] if tiers else clean(r.get('rank'))
        r['name_en']=en; r['name_source']=cn or r.get('name_source',''); r['description_en']=effect; r['rank']=rank; r['origin']='gomg-wiki-search-index'
        out.append(r)
    # Duplicate source IDs would make migrations ambiguous.
    ids=[x['id'] for x in out]
    if len(ids)!=len(set(ids)): raise ValueError('Duplicate talent source IDs detected')
    return out

def normalize_character_names(chars):
    for c in chars:
        name=clean(c.get('name_en') or c.get('name_source') or c.get('id') or 'Unknown'); variant=clean(c.get('variant') or ''); base=clean(c.get('base_name') or '')
        if variant and not re.search(r'\('+re.escape(variant)+r'\)\s*$',name,re.I): name=f'{base or name} ({variant})'
        c['name_en']=name
    seen={}
    for c in chars: seen[norm(c['name_en'])]=seen.get(norm(c['name_en']),0)+1
    used={}
    for c in chars:
        k=norm(c['name_en'])
        if seen[k]>1:
            suffix=clean(c.get('variant') or c.get('source_id') or c.get('id') or '')
            if suffix and f'({suffix})' not in c['name_en']: c['name_en']=f'{c["name_en"]} ({suffix})'
        k2=norm(c['name_en']); used[k2]=used.get(k2,0)+1
        if used[k2]>1: c['name_en']=f'{c["name_en"]} [{c.get("source_id") or c.get("id") or used[k2]}]'
    return chars

def merge_talents(old_talents, source):
    by_name={norm(x.get('name_en')):x for x in source if x.get('name_en')}
    by_source={norm(x.get('name_source')):x for x in source if x.get('name_source')}
    used_source=set(); result=[]
    for old in old_talents:
        if not isinstance(old,dict) or not old.get('id'): continue
        match=by_name.get(norm(old.get('name_en'))) or by_source.get(norm(old.get('name_source')))
        if match:
            r=copy.deepcopy(match); r['id']=old['id']; r['legacy_source_id']=match['id']; used_source.add(match['id'])
            for k,v in old.items():
                if k not in r and k not in {'id','name_en','name_source','rank','description_en','origin'}: r[k]=v
            result.append(r)
        else:
            r=copy.deepcopy(old); r['legacy_only']=True; result.append(r)
    used_ids={r.get('id') for r in result}; n=1
    for src in source:
        if src['id'] in used_source: continue
        while f'talent_{n:03d}' in used_ids: n+=1
        r=copy.deepcopy(src); r['id']=f'talent_{n:03d}'; r['legacy_source_id']=src['id']; used_ids.add(r['id']); result.append(r); n+=1
    return result

def build_characters(old, units):
    old_chars=old.get('characters',[]) if isinstance(old.get('characters',[]),list) else []
    old_by_source={}; old_by_name={}
    for c in old_chars:
        sid=str(c.get('source_id') or '').strip(); key=(norm(c.get('name_en')),norm(c.get('variant')))
        if sid: old_by_source[sid]=c.get('id')
        if key[0]: old_by_name[key]=c.get('id')
    used={x for x in list(old_by_source.values())+list(old_by_name.values()) if x}; next_num=1
    def new_id():
        nonlocal next_num
        while f'char_{next_num:03d}' in used: next_num+=1
        x=f'char_{next_num:03d}'; used.add(x); return x
    chars=[]
    for u in units:
        sid=str(u.get('id') or '').strip(); key=(norm(u['name_en']),norm(u.get('variant'))); cid=old_by_source.get(sid) or old_by_name.get(key)
        if not cid:
            cid=f'alter_{sid}' if sid.startswith('M') and '_' in sid and f'alter_{sid}' not in used else new_id()
            used.add(cid)
        rec={'id':cid,'name_en':u['name_en']}
        if sid: rec['source_id']=sid; rec['icon']=f'https://gomg-wiki.pages.dev/assets/icons/Header/{sid}.png'
        for k in ('rarity','role','type','element','terrain','variant','base_id','source','kind'):
            if u.get(k): rec[k]=u[k]
        chars.append(rec)
    return chars

def main():
    try:
        units=normalize_character_names(parse_units(fetch(UNITS_URL)))
        source=parse_talent_index(fetch(TALENT_INDEX_URL))
    except Exception as e:
        print(f'ERROR: source refresh failed: {e}',file=sys.stderr); return 2
    if len(units)<100: print(f'ERROR: suspicious unit count {len(units)}',file=sys.stderr); return 3
    if len(source)<200: print(f'ERROR: suspicious talent count {len(source)}',file=sys.stderr); return 4
    try: old=json.load(open(OUT,encoding='utf-8'))
    except Exception: old={'schema_version':5,'characters':[],'talents':[]}
    talents=merge_talents(old.get('talents',[]),source)
    db={
        'schema_version':max(int(old.get('schema_version',5) or 5),5),
        'last_checked':str(date.today()),
        'character_source':UNITS_URL,
        'talent_source':TALENT_PAGE_URL,
        'talent_index_source':TALENT_INDEX_URL,
        'official_update_source':old.get('official_update_source','https://www.chillyroom.com/en/game-news/40/262'),
        'characters':build_characters(old,units),
        'talents':talents,
        'notes':[
            'Characters are refreshed from the GOMG Wiki Units index.',
            'Talents are refreshed from the GOMG Wiki Search Talents index.',
            'Existing talent_### IDs are preserved whenever an old record matches a source name.',
            'Legacy talents missing from the current source are retained with legacy_only=true.',
            'Chinese-only names/effects are filled using the curated English translation map in this updater.'
        ]
    }
    with open(OUT,'w',encoding='utf-8') as f: json.dump(db,f,ensure_ascii=False,indent=2); f.write('\n')
    print(f'Updated characters: {len(db["characters"])}')
    print(f'Source talents: {len(source)}')
    print(f'Bundled talents after merge: {len(db["talents"])}')
    print(f'Legacy-only talents retained: {sum(1 for x in db["talents"] if x.get("legacy_only"))}')
    return 0

if __name__=='__main__': raise SystemExit(main())
