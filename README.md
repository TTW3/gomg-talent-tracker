# GOMG Talent Tracker

Fan-made static tracker for **Guild of Monster Girls** talents.

## Included
- 4 Talent Boards × 4 slots per Girl.
- Girl/Talent searchable autocomplete.
- Character icons from the GOMG Wiki.
- 481 current Talent source records from the GOMG Wiki Search Talents index.
- English Talent names/effects, including curated translations for Chinese-only source text.
- Talent description popup via the `ⓘ` button.
- Talent Lookup: Girl → Board → Slot.
- SWAP with tier validation.
- Swap history.
- JSON Export / Import / Reset.
- Per-browser private data via localStorage.
- Optional encrypted GitHub sync using AES-GCM.
- GitHub Actions updater for characters and talents.

## Database notes
`game-data.json` currently bundles the 481 source Talent records plus legacy records retained for compatibility with older tracker assignments. Existing `talent_###` IDs are preserved whenever a source Talent can be matched by name, so existing localStorage / encrypted sync data is not silently broken.

The Talent source is:
- https://gomg-wiki.pages.dev/search-talent-new
- https://gomg-wiki.pages.dev/talent-search-index.js

Character source:
- https://gomg-wiki.pages.dev/units/

## GitHub Pages
Upload/commit the repository contents, including:
- `index.html`
- `style.css`
- `app.js`
- `game-data.json`
- `tools/update_game_data.py`
- `.github/workflows/update-game-data.yml`

GitHub Pages will deploy the static site. The updater runs separately through GitHub Actions.

## Existing tracker data
The app keeps user assignments in browser localStorage. The database update does not intentionally overwrite those assignments. For a safety backup, use **Export** before changing versions.
