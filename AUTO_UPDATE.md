# GOMG Talent Tracker – automatic game-data updates

The tracker keeps user assignments in browser `localStorage`; `game-data.json` is the shared reference database shipped with the site.

## Sources
- Character source: https://gomg-wiki.pages.dev/units/
- Talent page: https://gomg-wiki.pages.dev/search-talent-new
- Talent index: https://gomg-wiki.pages.dev/talent-search-index.js

## Schedule
GitHub Actions runs **daily at 02:17 UTC (09:17 Vietnam time)** and can also be run manually from:
**Actions → Update GOMG game data → Run workflow**.

## What the updater does
1. Downloads the current GOMG Wiki Units index.
2. Downloads `talent-search-index.js` and parses `window.TALENT_SEARCH_INDEX`.
3. Refuses to overwrite the database if either source looks suspiciously incomplete.
4. Preserves existing character IDs and `talent_###` IDs when records can be matched safely.
5. Retains old talents that disappear from the current source as `legacy_only=true`, so old tracker assignments still resolve.
6. Fills Chinese-only talent names/effects with the curated English translation map embedded in `tools/update_game_data.py`.
7. Writes `game-data.json` and commits only when it changed.

### Workflow permissions
The repository must contain:
- `.github/workflows/update-game-data.yml`
- `tools/update_game_data.py`

The workflow declares `permissions: contents: write`, so no extra secret is required for the normal GitHub Actions commit.
