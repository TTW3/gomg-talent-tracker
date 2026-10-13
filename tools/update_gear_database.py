#!/usr/bin/env python3
"""Refresh GOMG gear records and their complete Bond effect data from the wiki page."""
import json, re, sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

SOURCE_URL = "https://gomg-wiki.pages.dev/search-gear"
OUTPUT = Path("gear-database.json")
MIN_RECORDS = 1000
MIN_BONDS = 500

def extract_const(html, name):
    match = re.search(r"const\s+" + re.escape(name) + r"\s*=\s*", html)
    if not match:
        raise RuntimeError(f"Could not find embedded const {name} on source page.")
    decoder = json.JSONDecoder()
    try:
        value, _ = decoder.raw_decode(html[match.end():])
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Could not parse {name}: {exc}") from exc
    return value

def main():
    req = Request(SOURCE_URL, headers={"User-Agent": "GOMG-Gear-Database-Updater/1.0"})
    with urlopen(req, timeout=60) as response:
        html = response.read().decode("utf-8", errors="replace")
    data = extract_const(html, "GEAR")
    bond_data = extract_const(html, "BOND_DATA")
    if not isinstance(data, list) or len(data) < MIN_RECORDS:
        raise RuntimeError(f"Source returned only {len(data) if isinstance(data, list) else 0} gear records; refusing to overwrite database.")
    if not isinstance(bond_data, dict) or len(bond_data) < MIN_BONDS:
        raise RuntimeError("Bond effect data is missing or suspiciously small; refusing to overwrite database.")
    ids = [str(item.get("id", "")) for item in data if isinstance(item, dict)]
    if len(ids) != len(data) or any(not item_id for item_id in ids):
        raise RuntimeError("Some gear records are invalid or missing IDs.")
    if len(set(ids)) != len(ids):
        raise RuntimeError("Duplicate gear IDs detected; refusing to overwrite database.")
    if not all(item.get("name") for item in data):
        raise RuntimeError("Some gear records have no names; refusing to overwrite database.")
    bond_slots = 0
    missing = []
    for item in data:
        for bond in item.get("bonds", []):
            bond_slots += 1
            detail = bond_data.get(bond.get("name"))
            if not detail:
                missing.append((item.get("id"), bond.get("name")))
                continue
            bond["basicDesc"] = detail.get("basicDesc", "")
            bond["effect"] = detail.get("basicDesc", "")
            bond["tiers"] = detail.get("tiers", [])
            bond["tags"] = [tag.strip() for tag in str(detail.get("tags", "")).split(",") if tag.strip()]
    if missing:
        sample = ", ".join(f"{gear_id}:{name}" for gear_id, name in missing[:8])
        raise RuntimeError(f"{len(missing)} Bond slots have no effect data (examples: {sample}); refusing to overwrite database.")
    if bond_slots < 3 * MIN_RECORDS:
        raise RuntimeError(f"Only {bond_slots} Bond slots found; refusing to overwrite database.")
    temp = OUTPUT.with_suffix(".json.tmp")
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(OUTPUT)
    print(f"Updated {OUTPUT}: {len(data)} gear records, {bond_slots} Bond slots, {len(bond_data)} Bond definitions at {datetime.now(timezone.utc).isoformat()}")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Gear update failed: {exc}", file=sys.stderr)
        sys.exit(1)
