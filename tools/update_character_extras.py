#!/usr/bin/env python3
"""Refresh Trait / Title / Perk data from GOMG Wiki character profile pages."""
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

BASE = "https://gomg-wiki.pages.dev/"
UNITS_INDEX = urljoin(BASE, "units/")
OUTPUT = Path("character-extras.json")
MIN_PROFILES = 180
TIMEOUT = 25
HEADERS = {"User-Agent": "GOMG-Talent-Tracker-DataUpdater/1.0 (GitHub Actions)"}

def text_with_markup(node):
    # Preserve readable inline content and strip layout-only whitespace.
    if node is None:
        return ""
    return re.sub(r"\s+", " ", node.get_text(" ", strip=True)).strip()

def extract_field(soup, field):
    headings = soup.find_all(["h2", "h3"])
    target = next((h for h in headings if h.get_text(" ", strip=True).casefold() == field.casefold()), None)
    if target is None:
        return None
    name_line = target.find_next_sibling()
    # Expected Wiki format: paragraph with strong name, code ID, and unlock star.
    if name_line is None or name_line.name != "p":
        return None
    strong = name_line.find("strong")
    code = name_line.find("code")
    line = text_with_markup(name_line)
    if not strong or not code:
        return None
    name = strong.get_text(" ", strip=True)
    ident = code.get_text(" ", strip=True)
    unlock_match = re.search(r"UnlockStar\s+\d+", line)
    unlock = unlock_match.group(0) if unlock_match else ""
    effects = []
    node = name_line.find_next_sibling()
    while node is not None and node.name not in ("h2", "h3"):
        if node.name in ("blockquote", "p", "ul", "ol"):
            txt = text_with_markup(node)
            if txt:
                # A blockquote may contain multiple effect paragraphs. Keep each paragraph separately.
                if node.name == "blockquote":
                    parts = [text_with_markup(p) for p in node.find_all("p", recursive=False)]
                    effects.extend(p for p in parts if p)
                else:
                    effects.append(txt)
        node = node.find_next_sibling()
    return {"name": name, "id": ident, "unlock": unlock, "effect": effects}

def profile_links(session):
    response = session.get(UNITS_INDEX, timeout=TIMEOUT)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    urls = set()
    for a in soup.select('a[href]'):
        href = a.get("href", "")
        if not href.endswith(".html") or "/units/" not in urljoin(UNITS_INDEX, href):
            continue
        full = urljoin(UNITS_INDEX, href)
        path = urlparse(full).path
        if "/units/" in path and path.endswith(".html") and not path.endswith("/index.html"):
            urls.add(full)
    # Wiki's unit index can contain links to other unit-related pages; profile pages are identified by content.
    return sorted(urls)

def stem_from_url(url):
    return Path(urlparse(url).path).stem

def main():
    old = json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else {}
    old_by_stem = {x.get("stem"): x for x in old.get("data", []) if x.get("stem")}
    session = requests.Session()
    session.headers.update(HEADERS)
    urls = profile_links(session)
    if len(urls) < MIN_PROFILES:
        raise RuntimeError(f"Only discovered {len(urls)} profile-like links; refusing to overwrite data.")
    output = []
    seen = set()
    failed = []
    for i, url in enumerate(urls, 1):
        stem = stem_from_url(url)
        try:
            r = session.get(url, timeout=TIMEOUT)
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "html.parser")
            h1 = soup.find("h1")
            if h1 is None:
                raise ValueError("missing h1")
            character = h1.get_text(" ", strip=True)
            trait = extract_field(soup, "Trait")
            title = extract_field(soup, "Title")
            perk = extract_field(soup, "Perk")
            # A valid profile must expose all three sections, including explicit empty/missing values.
            # Keep old entry if page is incomplete; do not silently erase valid data.
            if not all((trait, title, perk)):
                raise ValueError("one or more Trait/Title/Perk sections could not be parsed")
            old_item = old_by_stem.get(stem, {})
            icon = old_item.get("icon", "")
            icon_img = soup.select_one('img[src*="/assets/icons/Header/"]')
            if icon_img and icon_img.get("src"):
                icon = urljoin(url, icon_img["src"])
            unit_id = ""
            id_code = soup.find("p")
            if id_code:
                m = re.search(r"\bID:\s*([A-Za-z0-9_-]+)", id_code.get_text(" ", strip=True))
                if m:
                    unit_id = m.group(1)
            output.append({
                "stem": stem,
                "character_id": old_item.get("character_id", ""),
                "character": old_item.get("character", character),
                "base_name": old_item.get("base_name", character),
                "variant": old_item.get("variant", ""),
                "icon": icon,
                "profile": url,
                "trait": trait,
                "title": title,
                "perk": perk
            })
            seen.add(stem)
        except Exception as exc:
            failed.append({"url": url, "error": str(exc)})
            # Preserve prior record for transient errors, but fail the run below if too many fail.
            if stem in old_by_stem:
                output.append(old_by_stem[stem])
        if i % 20 == 0:
            print(f"Processed {i}/{len(urls)} profiles")
        time.sleep(0.05)
    if len(output) < MIN_PROFILES or len(failed) > max(8, int(len(urls) * 0.10)):
        raise RuntimeError(f"Unsafe refresh: output={len(output)}, discovered={len(urls)}, failed={len(failed)}")
    # Keep previously known entries that the index temporarily omitted.
    output_stems = {x.get("stem") for x in output}
    for stem, item in old_by_stem.items():
        if stem not in output_stems:
            output.append(item)
    output.sort(key=lambda x: (x.get("character", "").casefold(), x.get("stem", "")))
    result = {
        "schema_version": old.get("schema_version", 1),
        "source": BASE,
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "profilesFound": len(urls),
        "profilesRead": len(seen),
        "failed": failed,
        "count": len(output),
        "data": output
    }
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(output)} entries; parsed {len(seen)}; failed {len(failed)}.")

if __name__ == "__main__":
    main()
